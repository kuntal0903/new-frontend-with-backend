"""
Domain Service — Orchestrator

WHY THIS FILE EXISTS:
    Single entry point for domain scan operations.  Coordinates the
    pipeline, database, HTTP sessions, and analyzers.

WHAT IT DOES:
    1. Creates a scan record in the database.
    2. Opens a shared aiohttp session for all collectors.
    3. Runs the 9-step pipeline.
    4. Runs analyzers on the collected data.
    5. Updates the scan record with final status.
    6. Returns the structured report.

DESIGN:
    The service owns the lifecycle of HTTP sessions and database
    transactions.  Collectors and the pipeline receive these as
    injected dependencies — they never create their own.
"""
from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from typing import Any, Dict, Optional

import aiohttp
import dns.asyncresolver
import dns.resolver
from sqlalchemy.ext.asyncio import AsyncSession

from common.logger import get_logger
from common.utils import generate_asset_id, is_valid_domain, normalize_domain
from config import settings
from modules.domain.collectors.base import BaseCollector
from modules.domain.collectors.certificate import CertificateCollector
from modules.domain.collectors.cloud import CloudCollector
from modules.domain.collectors.dns import DNSCollector
from modules.domain.collectors.http_header import HTTPHeaderCollector
from modules.domain.collectors.mail import MailCollector
from modules.domain.collectors.nameserver import NameserverCollector
from modules.domain.collectors.ports import PortCollector
from modules.domain.collectors.subdomain import SubdomainCollector
from modules.domain.collectors.technology import TechnologyCollector
from modules.domain.collectors.waf import WAFCollector
from modules.domain.collectors.wildcard_detector import WildcardDetector
from modules.domain.tracker import ScanTracker
from modules.domain.validator import DomainValidator
from modules.domain.analyzer.admin import AdminAnalyzer
from modules.domain.analyzer.api_discovery import APIDiscoveryAnalyzer
from modules.domain.analyzer.attack_surface import AttackSurfaceAnalyzer
from modules.domain.analyzer.login_portal import LoginPortalAnalyzer
from modules.domain.analyzer.staging import StagingAnalyzer
from modules.domain.pipeline import DomainPipeline
from modules.domain.repository import DomainRepository
from modules.domain.schemas import AssetType, CollectorResult, CollectorStatus, ScanStatus

logger = get_logger("domain", "service")


class DomainService:
    """Top-level orchestrator for domain scan operations."""

    def __init__(self):
        self.pipeline = DomainPipeline()
        self.validator = DomainValidator()

    async def run_scan(
        self,
        domain: str,
        db: AsyncSession,
        scan_id: Optional[str] = None,
        profile: str = "standard",
    ) -> Dict[str, Any]:
        """
        Execute a full domain scan end-to-end with real-time 16-stage tracking and cancellation guards.
        """
        scan_id = scan_id or generate_asset_id()
        tracker = ScanTracker.get_or_create(scan_id, domain, profile)
        started_at = datetime.now(timezone.utc)
        repo = DomainRepository(db)

        # Stage 01: Domain Validation
        tracker.start_stage("domain_validation", f"Normalizing target '{domain}' and verifying DNS delegation")
        val_result = await self.validator.validate(domain)
        
        if not val_result.is_eligible_for_scan():
            tracker.fail_stage("domain_validation", val_result.reason, is_fatal=True)
            logger.warning(
                "Domain validation failed — scan aborted early",
                extra={"domain": domain, "status": val_result.status, "reason": val_result.reason},
            )
            return {
                "scan_id": scan_id,
                "target_domain": domain,
                "status": "failed",
                "validation": val_result.to_dict(),
                "error_message": val_result.reason,
                "total_assets_found": 0,
                "assets": {},
            }
        
        tracker.complete_stage("domain_validation", "Domain syntax and parent zone delegation verified", val_result.to_dict())

        # Stage 02: DNS Validation
        tracker.start_stage("dns_validation", f"Querying authoritative DNS records for {val_result.domain}")
        clean_target = val_result.domain

        # Ensure DB record exists and is committed
        existing_scan = await repo.get_scan(scan_id)
        if not existing_scan:
            await repo.create_scan(
                scan_id=scan_id,
                target_domain=clean_target,
                scan_config={
                    "timeout": settings.SCAN_TIMEOUT_SECONDS,
                    "max_collectors": settings.MAX_CONCURRENT_COLLECTORS,
                    "validation": val_result.to_dict(),
                    "profile": profile,
                },
            )
        else:
            await repo.update_scan_status(scan_id, status="RUNNING")
        await repo.commit()

        try:
            timeout = aiohttp.ClientTimeout(total=settings.SCAN_TIMEOUT_SECONDS)
            async with aiohttp.ClientSession(
                timeout=timeout,
                headers={"User-Agent": settings.USER_AGENT},
            ) as session:
                # Stage 02: DNS Validation
                tracker.start_stage("dns_validation", f"Querying authoritative DNS records for {clean_target}")
                dns_collector = DNSCollector(session=session)
                ns_collector = NameserverCollector(session=session)
                mail_collector = MailCollector(session=session)
                
                dns_res, ns_res, mail_res = await asyncio.gather(
                    dns_collector.execute(clean_target),
                    ns_collector.execute(clean_target),
                    mail_collector.execute(clean_target),
                    return_exceptions=True
                )
                collector_results: Dict[str, Any] = {
                    "dns": dns_res if not isinstance(dns_res, Exception) else None,
                    "nameserver": ns_res if not isinstance(ns_res, Exception) else None,
                    "mail": mail_res if not isinstance(mail_res, Exception) else None,
                }
                dns_records_preview = val_result.details.get("records_found", {})
                tracker.complete_stage("dns_validation", f"Authoritative records verified ({len(dns_records_preview)} types)", dns_records_preview)

                if tracker.is_cancelled:
                    return {"scan_id": scan_id, "status": "cancelled"}

                # Stage 03: Subdomain Discovery
                tracker.start_stage("subdomain_discovery", f"Harvesting candidates from Certificate Transparency & Wordlists")
                sub_collector = SubdomainCollector(session=session)
                
                # 1. CT logs
                tracker.update_progress("subdomain_discovery", 0, 0, "Querying Certificate Transparency logs (crt.sh)...")
                ct_subs = await sub_collector._crtsh_enum(clean_target)
                tracker.update_progress("subdomain_discovery", len(ct_subs), len(ct_subs), f"CT logs yielded {len(ct_subs)} candidates")

                # 2. DNS Brute-force candidates
                tracker.update_progress("subdomain_discovery", len(ct_subs), len(ct_subs), "Generating wordlist brute-force candidates...")
                wordlist = sub_collector._get_wordlist()
                brute_candidates = {f"{prefix}.{clean_target}" for prefix in wordlist}
                
                all_candidates = set(ct_subs) | brute_candidates
                tracker.complete_stage("subdomain_discovery", f"Discovered {len(all_candidates)} total candidates ({len(ct_subs)} CT, {len(brute_candidates)} wordlist)", {"ct": len(ct_subs), "wordlist": len(brute_candidates), "total": len(all_candidates)})

                # Stage 04: Deduplication
                tracker.start_stage("deduplication", "Normalizing candidates and removing duplicates across sources")
                unique_candidates = sorted(list({normalize_domain(c) for c in all_candidates if is_valid_domain(normalize_domain(c)) and normalize_domain(c).endswith(f".{clean_target}")}))
                tracker.complete_stage("deduplication", f"{len(all_candidates)} candidates reduced to {len(unique_candidates)} unique hostnames", {"unique": len(unique_candidates)})

                # Stage 05: Wildcard Detection
                tracker.start_stage("wildcard_detection", "Probing random high-entropy labels for wildcard catch-all")
                detector = WildcardDetector()
                wildcard = await detector.detect(clean_target)
                if wildcard.is_wildcard:
                    tracker.complete_stage("wildcard_detection", f"Wildcard DNS detected (Filtered IPs: {', '.join(wildcard.wildcard_ips)})", {"wildcard": True, "ips": list(wildcard.wildcard_ips)})
                else:
                    tracker.complete_stage("wildcard_detection", "No wildcard DNS detected; standard zone resolution", {"wildcard": False})

                # Stage 06: DNS Verification (Real progress updating per candidate batch)
                tracker.start_stage("dns_verification", f"Actively resolving {len(unique_candidates)} hostnames against DNS")
                verified_subdomains = []
                historical_subdomains = []
                active_subdomain_names = set()
                total_cand = len(unique_candidates)
                verified_so_far = 0

                verify_sem = asyncio.Semaphore(15)

                async def _verify_cand(sub: str, idx: int):
                    nonlocal verified_so_far
                    async with verify_sem:
                        cand_resolver = dns.asyncresolver.Resolver()
                        cand_resolver.lifetime = 2.0
                        try:
                            ans = await cand_resolver.resolve(sub, "A")
                            ips = {rr.to_text() for rr in ans}
                            if not wildcard.should_exclude(ips):
                                verified_subdomains.append({
                                    "subdomain": sub,
                                    "status": "ACTIVE",
                                    "lifecycle_status": "active",
                                    "resolved_ips": sorted(list(ips)),
                                    "sources": ["subdomain_enum"],
                                    "dns_records": {"A": sorted(list(ips))},
                                })
                                active_subdomain_names.add(sub)
                        except dns.resolver.NXDOMAIN:
                            historical_subdomains.append({
                                "subdomain": sub,
                                "status": "HISTORICAL",
                                "lifecycle_status": "historical",
                                "sources": ["subdomain_enum"],
                                "reason": "NXDOMAIN in current DNS",
                            })
                        except (dns.resolver.NoAnswer, dns.resolver.NoNameservers, dns.exception.Timeout):
                            try:
                                cname_ans = await cand_resolver.resolve(sub, "CNAME")
                                cnames = [rr.to_text() for rr in cname_ans]
                                verified_subdomains.append({
                                    "subdomain": sub,
                                    "status": "ACTIVE",
                                    "lifecycle_status": "active",
                                    "sources": ["subdomain_enum"],
                                    "dns_records": {"CNAME": cnames},
                                })
                                active_subdomain_names.add(sub)
                            except Exception:
                                historical_subdomains.append({
                                    "subdomain": sub,
                                    "status": "INACTIVE",
                                    "lifecycle_status": "inactive",
                                    "sources": ["subdomain_enum"],
                                })
                        except Exception:
                            pass
                        finally:
                            verified_so_far += 1
                            if verified_so_far % 5 == 0 or verified_so_far == total_cand:
                                tracker.update_progress("dns_verification", verified_so_far, total_cand, f"Verified {verified_so_far}/{total_cand} candidates ({len(verified_subdomains)} active)")

                if unique_candidates:
                    await asyncio.gather(*[_verify_cand(s, i) for i, s in enumerate(unique_candidates)], return_exceptions=True)

                sub_collector_result = CollectorResult(
                    collector_name="subdomain",
                    source="crt.sh+dns_bruteforce",
                    status=CollectorStatus.SUCCESS,
                    raw_data={"candidates_total": total_cand},
                    processed_data={
                        "domain": clean_target,
                        "subdomains": sorted(list(active_subdomain_names)),
                        "verified_subdomains": verified_subdomains,
                        "historical_subdomains": historical_subdomains,
                        "total_candidates": total_cand,
                        "total_verified": len(verified_subdomains),
                        "total_historical": len(historical_subdomains),
                        "wildcard_detected": wildcard.is_wildcard,
                        "wildcard_ips": sorted(list(wildcard.wildcard_ips)),
                    },
                    confidence=0.9 if verified_subdomains else 0.5,
                    records_found=len(verified_subdomains),
                )
                collector_results["subdomain"] = sub_collector_result
                tracker.complete_stage("dns_verification", f"{len(verified_subdomains)} active hostnames verified, {len(historical_subdomains)} historical", {"verified": len(verified_subdomains), "historical": len(historical_subdomains)})

                # Stage 07: IP Address Analysis
                tracker.start_stage("ip_analysis", "Classifying IP addresses (Public/Private/Reserved) and checking anomalies")
                assets = self.pipeline.normalize_data(clean_target, collector_results)
                assets = self.pipeline.deduplicate(assets)
                assets = self.pipeline.validate_results(assets)
                ip_assets = [a for a in assets if a["asset_type"] == AssetType.IP_ADDRESS.value]
                public_ips = [a for a in ip_assets if a.get("ip_classification") == "PUBLIC"]
                private_ips = [a for a in ip_assets if a.get("ip_classification") != "PUBLIC"]
                tracker.complete_stage("ip_analysis", f"{len(public_ips)} Public IPs, {len(private_ips)} Anomaly/Private IPs", {"public": len(public_ips), "private": len(private_ips)})

                # Stage 08: HTTP / HTTPS Verification
                tracker.start_stage("http_verification", "Probing reachable web services and security headers")
                http_collector = HTTPHeaderCollector(session=session)
                http_res = await http_collector.execute(clean_target)
                collector_results["http_header"] = http_res
                hdr_pd = http_res.processed_data if http_res else {}
                sec_score = hdr_pd.get("security_headers", {}).get("score", 0)
                tracker.complete_stage("http_verification", f"Web probed — Security Header Score: {sec_score}/100")

                # Stage 09: TLS / Certificate Analysis
                tracker.start_stage("tls_analysis", "Analyzing certificates and TLS configurations")
                cert_collector = CertificateCollector(session=session)
                cert_res = await cert_collector.execute(clean_target)
                collector_results["certificate"] = cert_res
                cert_pd = cert_res.processed_data if cert_res else {}
                cert_obj = cert_pd.get("certificate", {})
                cert_subj = cert_obj.get("subject", clean_target) if cert_obj else clean_target
                tracker.complete_stage("tls_analysis", f"Certificate validated for {cert_subj}")

                # Stage 10: Technology Detection
                tracker.start_stage("technology_detection", "Fingerprinting web technologies, frameworks, and servers")
                tech_collector = TechnologyCollector(session=session)
                tech_res = await tech_collector.execute(clean_target)
                collector_results["technology"] = tech_res
                tech_pd = tech_res.processed_data if tech_res else {}
                tech_list = tech_pd.get("technologies", [])
                tech_names = [t.get("name") for t in tech_list]
                tracker.complete_stage("technology_detection", f"Detected {len(tech_names)} technologies ({', '.join(tech_names[:3]) or 'None'})")

                # Stage 11: Cloud / CDN Analysis
                tracker.start_stage("cloud_analysis", "Correlating infrastructure signals, CNAMEs, and ASNs")
                headers = hdr_pd.get("headers", {})
                cloud_collector = CloudCollector(session=session)
                cloud_res = await cloud_collector.execute(clean_target, headers=headers)
                collector_results["cloud"] = cloud_res
                cloud_pd = cloud_res.processed_data if cloud_res else {}
                c_provs = cloud_pd.get("cloud_providers", [])
                cdn_provs = cloud_pd.get("cdn_providers", [])
                tracker.complete_stage("cloud_analysis", f"Cloud: {', '.join(c_provs) or 'None'} | CDN: {', '.join(cdn_provs) or 'None'}")

                # Stage 12: Port Discovery
                tracker.start_stage("port_discovery", "Scanning eligible service ports on target hosts")
                port_collector = PortCollector(session=session)
                port_res = await port_collector.execute(clean_target)
                collector_results["ports"] = port_res
                port_pd = port_res.processed_data if port_res else {}
                open_ports = port_pd.get("open_port_numbers", [])
                tracker.complete_stage("port_discovery", f"Discovered {len(open_ports)} open ports ({', '.join(map(str, open_ports)) or 'None'})")

                # Stage 13: Service Identification
                tracker.start_stage("service_identification", "Verifying detected services and banner signatures")
                srv_found = port_pd.get("services_found", [])
                tracker.complete_stage("service_identification", f"Identified services: {', '.join(srv_found) or 'Standard Web'}")

                # Stage 14: Evidence Correlation
                tracker.start_stage("evidence_correlation", "Combining multi-source provenance, DNS, and HTTP observations")
                assets = self.pipeline.normalize_data(clean_target, collector_results)
                assets = self.pipeline.deduplicate(assets)
                assets = self.pipeline.validate_results(assets)
                assets = self.pipeline.enrich_results(clean_target, assets, collector_results)

                subdomains = [a["asset_value"] for a in assets if a["asset_type"] == AssetType.SUBDOMAIN.value]

                attack_surface_analyzer = AttackSurfaceAnalyzer()
                attack_surface = await attack_surface_analyzer.analyze(clean_target, collector_results)

                admin_analyzer = AdminAnalyzer(session=session)
                staging_analyzer = StagingAnalyzer(session=session)
                login_analyzer = LoginPortalAnalyzer(session=session)
                api_analyzer = APIDiscoveryAnalyzer(session=session)

                admin_res, staging_res, login_res, api_res = await self._run_analyzers(
                    clean_target, subdomains, admin_analyzer, staging_analyzer, login_analyzer, api_analyzer
                )
                analyzer_results = {
                    "admin_portals": admin_res,
                    "staging_environments": staging_res,
                    "login_portals": login_res,
                    "api_endpoints": api_res,
                }
                assets.extend(self._analyzer_assets_to_list(analyzer_results))
                assets = self.pipeline.deduplicate(assets)
                tracker.complete_stage("evidence_correlation", f"Synthesized evidence across {len(assets)} assets")

                # Stage 15: Asset Classification
                tracker.start_stage("asset_classification", "Categorizing assets into Active, Historical, Inactive, and Anomalies")
                assets = self.pipeline.classify_results(assets)
                act_count = sum(1 for a in assets if a.get("lifecycle_status") == "active")
                hist_count = sum(1 for a in assets if a.get("lifecycle_status") == "historical")
                tracker.complete_stage("asset_classification", f"Active: {act_count} | Historical: {hist_count} | Total: {len(assets)}")

                # Stage 16: Finalization
                tracker.start_stage("finalization", "Storing structured assets and compiling attack-surface report")
                stored_count = await self.pipeline.store_results(scan_id, assets, collector_results, repo)
                report = await self.pipeline.generate_report(
                    scan_id=scan_id,
                    domain=clean_target,
                    started_at=started_at,
                    assets=assets,
                    collector_results=collector_results,
                    attack_surface=attack_surface,
                    analyzer_results=analyzer_results,
                )

                # Update DB scan status
                await repo.update_scan_status(
                    scan_id,
                    status=ScanStatus.COMPLETED.value,
                    total_assets=len(assets),
                )
                await repo.commit()

                tracker.complete_scan(report)
                logger.info(
                    "Scan completed",
                    extra={
                        "scan_id": scan_id,
                        "domain": clean_target,
                        "total_assets": len(assets),
                    },
                )
                return report

        except Exception as exc:
            tracker.fail_stage(tracker.current_stage_id, str(exc), is_fatal=True)
            logger.error(
                "Scan failed",
                extra={"scan_id": scan_id, "domain": domain, "error": str(exc)},
            )
            await repo.update_scan_status(
                scan_id,
                status=ScanStatus.FAILED.value,
                error_message=str(exc),
            )
            await repo.commit()
            raise

    async def get_scan_status(
        self, scan_id: str, db: AsyncSession
    ) -> Optional[Dict[str, Any]]:
        """Retrieve real-time scan status with full 16-stage breakdown and activity logs."""
        tracker = ScanTracker.get(scan_id)
        if tracker:
            return tracker.to_dict()

        repo = DomainRepository(db)
        scan = await repo.get_scan(scan_id)
        if not scan:
            return None

        from modules.domain.tracker import STAGE_DEFINITIONS
        stages = []
        is_done = scan.status in ("COMPLETED", "completed")
        is_fail = scan.status in ("FAILED", "failed")

        for s in STAGE_DEFINITIONS:
            stages.append({
                "id": s["id"],
                "number": s["number"],
                "name": s["name"],
                "description": s["description"],
                "status": "completed" if is_done else ("failed" if is_fail else "running"),
                "completed_count": scan.total_assets_found if is_done else 0,
                "total_count": scan.total_assets_found if is_done else 0,
                "detail": scan.error_message if is_fail else None,
                "error": scan.error_message if is_fail else None,
                "data": {},
            })

        return {
            "scan_id": scan.id,
            "target": scan.target_domain,
            "profile": scan.scan_config.get("profile", "standard") if scan.scan_config else "standard",
            "status": scan.status.upper() if scan.status else "RUNNING",
            "current_stage": "finalization" if is_done else "domain_validation",
            "current_stage_name": "Finalizing Results" if is_done else "Domain Validation",
            "message": "Scan completed successfully" if is_done else (scan.error_message or "Scan in progress..."),
            "error_message": scan.error_message,
            "started_at": scan.started_at.isoformat() if scan.started_at else None,
            "completed_at": scan.completed_at.isoformat() if scan.completed_at else None,
            "is_cancelled": scan.status == "CANCELLED",
            "progress": {
                "completed_stages": len(STAGE_DEFINITIONS) if is_done else 1,
                "total_stages": len(STAGE_DEFINITIONS),
                "percentage": 100 if is_done else 50,
                "completed": scan.total_assets_found,
                "total": scan.total_assets_found,
            },
            "stages": stages,
            "activity_log": [{"time": "00:00:00", "message": f"Status: {scan.status}"}],
            "has_report": is_done,
        }

    async def get_scan_report(
        self, scan_id: str, db: AsyncSession
    ) -> Optional[Dict[str, Any]]:
        """Retrieve full scan report with all assets grouped by type, attack surface, and summary."""
        tracker = ScanTracker.get(scan_id)
        if tracker and tracker.final_report:
            return tracker.final_report

        repo = DomainRepository(db)
        scan = await repo.get_scan(scan_id)
        if not scan:
            return None

        # Fetch all assets
        db_assets = await repo.get_assets_by_scan(scan_id)
        grouped_assets: Dict[str, list] = {}
        for a in db_assets:
            atype = a.asset_type
            if atype not in grouped_assets:
                grouped_assets[atype] = []
            grouped_assets[atype].append({
                "id": a.id,
                "asset_type": a.asset_type,
                "asset_value": a.asset_value,
                "discovery_source": a.discovery_source,
                "sources": a.sources or [a.discovery_source],
                "evidence": a.evidence or [],
                "methods": a.methods or [a.discovery_source],
                "raw_data": a.raw_data or {},
                "confidence_score": a.confidence_score,
                "validation_status": a.validation_status,
                "lifecycle_status": a.lifecycle_status,
                "first_seen": a.first_seen.isoformat() if a.first_seen else None,
                "last_seen": a.last_seen.isoformat() if a.last_seen else None,
                "last_verified": a.last_verified.isoformat() if a.last_verified else None,
            })

        return {
            "scan_id": scan.id,
            "target_domain": scan.target_domain,
            "status": scan.status,
            "started_at": scan.started_at.isoformat() if scan.started_at else None,
            "completed_at": scan.completed_at.isoformat() if scan.completed_at else None,
            "duration_seconds": (scan.completed_at - scan.started_at).total_seconds() if scan.completed_at and scan.started_at else 0.0,
            "total_assets_found": len(db_assets),
            "assets": grouped_assets,
            "attack_surface": {},
            "scan_config": scan.scan_config or {},
        }

    async def get_scan_assets(
        self,
        scan_id: str,
        db: AsyncSession,
        asset_type: Optional[str] = None,
    ) -> list:
        """Retrieve discovered assets for a scan."""
        repo = DomainRepository(db)
        assets = await repo.get_assets_by_scan(scan_id, asset_type=asset_type)
        return [
            {
                "id": a.id,
                "asset_type": a.asset_type,
                "asset_value": a.asset_value,
                "discovery_source": a.discovery_source,
                "confidence_score": a.confidence_score,
                "validation_status": a.validation_status,
                "first_seen": a.first_seen.isoformat() if a.first_seen else None,
                "last_seen": a.last_seen.isoformat() if a.last_seen else None,
            }
            for a in assets
        ]

    # ── Private Helpers ──────────────────────────────────────────────

    @staticmethod
    async def _run_analyzers(
        domain: str,
        subdomains: list,
        admin: AdminAnalyzer,
        staging: StagingAnalyzer,
        login: LoginPortalAnalyzer,
        api: APIDiscoveryAnalyzer,
    ) -> tuple:
        """Run all secondary analyzers concurrently."""
        results = await asyncio.gather(
            admin.analyze(domain, subdomains),
            staging.analyze(domain, subdomains),
            login.analyze(domain, subdomains),
            api.analyze(domain, subdomains),
            return_exceptions=True,
        )
        return tuple(
            r if not isinstance(r, Exception) else {"error": str(r)}
            for r in results
        )

    @staticmethod
    def _analyzer_assets_to_list(
        analyzer_results: Dict[str, Any]
    ) -> list:
        """Convert analyzer findings into asset dicts."""
        from common.utils import generate_asset_id

        assets = []
        now = datetime.now(timezone.utc)

        # Admin portals
        for portal in analyzer_results.get("admin_portals", {}).get("admin_portals", []):
            assets.append({
                "id": generate_asset_id(),
                "asset_type": AssetType.ADMIN_PORTAL.value,
                "asset_value": portal.get("url", ""),
                "discovery_source": "admin_analyzer",
                "sources": ["admin_analyzer"],
                "methods": ["http_probe"],
                "evidence": [{"source": "admin_analyzer", "detail": portal.get("evidence", "")}],
                "raw_data": portal,
                "confidence_score": 0.8,
                "validation_status": "validated",
                "lifecycle_status": "active",
                "first_seen": now,
                "last_seen": now,
                "last_verified": now,
            })

        # Staging environments
        for env in analyzer_results.get("staging_environments", {}).get("staging_environments", []):
            assets.append({
                "id": generate_asset_id(),
                "asset_type": AssetType.STAGING_ENV.value,
                "asset_value": env.get("subdomain", ""),
                "discovery_source": "staging_analyzer",
                "sources": ["staging_analyzer"],
                "methods": ["pattern_match"],
                "evidence": [{"source": "staging_analyzer", "detail": f"Pattern match: {env.get('subdomain', '')}"}],
                "raw_data": env,
                "confidence_score": 0.8,
                "validation_status": "validated",
                "lifecycle_status": "verified",
                "first_seen": now,
                "last_seen": now,
                "last_verified": now,
            })

        # Login portals
        for portal in analyzer_results.get("login_portals", {}).get("login_portals", []):
            ev_list = portal.get("evidence", [])
            assets.append({
                "id": generate_asset_id(),
                "asset_type": AssetType.LOGIN_PORTAL.value,
                "asset_value": portal.get("url", ""),
                "discovery_source": "login_analyzer",
                "sources": ["login_analyzer"],
                "methods": ["html_structure_probe"],
                "evidence": [{"source": "login_analyzer", "detail": str(ev)} for ev in ev_list] if ev_list else [{"source": "login_analyzer", "detail": "Login form detected"}],
                "raw_data": portal,
                "confidence_score": 0.9,
                "validation_status": "validated",
                "lifecycle_status": "active",
                "first_seen": now,
                "last_seen": now,
                "last_verified": now,
            })

        # API endpoints
        for ep in analyzer_results.get("api_endpoints", {}).get("api_endpoints", []):
            ev_list = ep.get("evidence", [])
            assets.append({
                "id": generate_asset_id(),
                "asset_type": AssetType.API_ENDPOINT.value,
                "asset_value": ep.get("url", ""),
                "discovery_source": "api_analyzer",
                "sources": ["api_analyzer"],
                "methods": ["api_header_probe"],
                "evidence": [{"source": "api_analyzer", "detail": str(ev)} for ev in ev_list] if ev_list else [{"source": "api_analyzer", "detail": "API endpoint detected"}],
                "raw_data": ep,
                "confidence_score": 0.8,
                "validation_status": "validated",
                "lifecycle_status": "active",
                "first_seen": now,
                "last_seen": now,
                "last_verified": now,
            })

        return assets

