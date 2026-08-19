"""
Domain Scan Pipeline — 9-Step Processing Workflow

WHY THIS FILE EXISTS:
    The pipeline is the core invariant of the system.  Every scan —
    regardless of target — follows the exact same sequence of steps.
    Extracting it from the service makes it independently testable
    and guarantees workflow consistency.

PIPELINE STEPS:
    1. validate_target    — domain format, not private IP
    2. collect_data       — run all collectors (parallel where possible)
    3. normalize_data     — canonical format for all results
    4. deduplicate        — remove duplicate assets across collectors
    5. validate_results   — sanity-check discovered data
    6. enrich_results     — cross-reference, add metadata
    7. classify_results   — tag assets by type and risk
    8. store_results      — persist to database
    9. generate_report    — produce final structured JSON

WHAT IT ACCEPTS:
    Target domain, HTTP session, database session, scan ID.

WHAT IT RETURNS:
    A DomainReportSchema dict with all discovered assets and analysis.
"""
from __future__ import annotations

import asyncio
import time
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import aiohttp

from common.exceptions import ValidationException
from common.logger import get_logger
from common.utils import (
    clean_domain,
    classify_ip_address,
    deduplicate_list,
    extract_root_domain,
    generate_asset_id,
    generate_deterministic_id,
    is_private_ip,
    is_valid_domain,
)
from config import settings
from modules.domain.analyzer.admin import AdminAnalyzer
from modules.domain.analyzer.api_discovery import APIDiscoveryAnalyzer
from modules.domain.analyzer.attack_surface import AttackSurfaceAnalyzer
from modules.domain.analyzer.login_portal import LoginPortalAnalyzer
from modules.domain.analyzer.staging import StagingAnalyzer
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
from modules.domain.repository import DomainRepository
from modules.domain.schemas import (
    AssetType,
    CollectorResult,
    CollectorStatus,
    DomainReportSchema,
    ScanStatus,
)

logger = get_logger("domain", "pipeline")


class DomainPipeline:
    """
    Orchestrates the 9-step domain scan workflow.

    The pipeline is stateless — all context is passed via arguments
    so the same instance can run multiple scans concurrently.
    """

    # ── Step 1: Validate Target ──────────────────────────────────────

    def validate_target(self, domain: str) -> str:
        """Clean and validate the target domain."""
        logger.info("Step 1/9: Validating target", extra={"domain": domain})
        cleaned = clean_domain(domain)
        if not is_valid_domain(cleaned):
            raise ValidationException(f"Invalid domain: '{domain}'")
        return cleaned

    # ── Step 2: Collect Data ─────────────────────────────────────────

    async def collect_data(
        self,
        domain: str,
        session: aiohttp.ClientSession,
    ) -> Dict[str, CollectorResult]:
        """
        Run all collectors.
        Independent collectors run in parallel; dependent ones run after.
        """
        logger.info("Step 2/9: Collecting data", extra={"domain": domain})

        # Phase A: Independent collectors (no cross-dependencies)
        independent: Dict[str, BaseCollector] = {
            "dns": DNSCollector(session=session),
            "nameserver": NameserverCollector(session=session),
            "mail": MailCollector(session=session),
            "certificate": CertificateCollector(session=session),
            "subdomain": SubdomainCollector(session=session),
            "http_header": HTTPHeaderCollector(session=session),
            "ports": PortCollector(session=session),
        }

        semaphore = asyncio.Semaphore(settings.MAX_CONCURRENT_COLLECTORS)

        async def _run(name: str, collector: BaseCollector) -> tuple:
            async with semaphore:
                result = await collector.execute(domain)
                return name, result

        phase_a_tasks = [_run(n, c) for n, c in independent.items()]
        phase_a_results = await asyncio.gather(*phase_a_tasks, return_exceptions=True)

        results: Dict[str, CollectorResult] = {}
        for item in phase_a_results:
            if isinstance(item, Exception):
                logger.error("Collector crashed", extra={"error": str(item)})
                continue
            name, result = item
            results[name] = result

        # Phase B: Dependent collectors (need data from Phase A)
        # Technology collector can use header data
        headers = {}
        header_result = results.get("http_header")
        if header_result and header_result.status == CollectorStatus.SUCCESS:
            headers = header_result.processed_data.get("headers", {})

        # Cloud collector benefits from DNS + header data
        cloud_collector = CloudCollector(session=session)
        results["cloud"] = await cloud_collector.execute(domain, headers=headers)

        # WAF collector benefits from header data
        waf_collector = WAFCollector(session=session)
        results["waf"] = await waf_collector.execute(domain, headers=headers)

        # Technology collector
        tech_collector = TechnologyCollector(session=session)
        results["technology"] = await tech_collector.execute(domain)

        logger.info(
            "Data collection complete",
            extra={
                "domain": domain,
                "collectors_run": len(results),
                "successful": sum(
                    1 for r in results.values()
                    if r.status == CollectorStatus.SUCCESS
                ),
            },
        )
        return results

    # ── Step 3: Normalize Data ───────────────────────────────────────

    def normalize_data(
        self,
        domain: str,
        results: Dict[str, CollectorResult],
    ) -> List[Dict[str, Any]]:
        """Convert all collector outputs into a flat list of asset dicts with full provenance."""
        logger.info("Step 3/9: Normalizing data", extra={"domain": domain})
        assets: List[Dict[str, Any]] = []
        now = datetime.now(timezone.utc)

        # Root domain itself
        assets.append(self._make_asset(
            AssetType.ROOT_DOMAIN, domain, "system",
            confidence=1.0,
            lifecycle_status="active",
            validation_status="validated",
            evidence=[{"source": "system", "detail": "Target root domain", "timestamp": now.isoformat()}],
        ))

        # DNS records → assets
        dns_r = results.get("dns")
        if dns_r and dns_r.status != CollectorStatus.FAILED:
            for rtype, records in dns_r.processed_data.get("records", {}).items():
                for rec in records:
                    assets.append(self._make_asset(
                        AssetType.DNS_RECORD,
                        f"{rtype}:{rec.get('value', '')}",
                        "dns",
                        raw_data=rec,
                        confidence=dns_r.confidence,
                        lifecycle_status="active",
                        validation_status="validated",
                        evidence=[{"source": "dnspython", "record_type": rtype, "value": rec.get("value")}],
                    ))
                    # Extract IPs from A/AAAA records
                    if rtype in ("A", "AAAA"):
                        ip_val = rec.get("value", "")
                        ip_cat = classify_ip_address(ip_val)
                        assets.append(self._make_asset(
                            AssetType.IP_ADDRESS,
                            ip_val,
                            "dns",
                            confidence=dns_r.confidence,
                            lifecycle_status="active",
                            validation_status="validated" if ip_cat == "PUBLIC" else "invalid",
                            raw_data={"classification": ip_cat, "record_type": rtype},
                            evidence=[{"source": "dnspython", "classification": ip_cat, "record_type": rtype}],
                        ))

        # Subdomains (Verified Active vs Historical) → assets
        sub_r = results.get("subdomain")
        if sub_r and sub_r.status != CollectorStatus.FAILED:
            # 1. Verified Active Subdomains
            for ver_sub in sub_r.processed_data.get("verified_subdomains", []):
                sname = ver_sub["subdomain"]
                assets.append(self._make_asset(
                    AssetType.SUBDOMAIN,
                    sname,
                    ver_sub.get("sources", ["subdomain"])[0],
                    sources=ver_sub.get("sources", ["subdomain"]),
                    confidence=1.0 if len(ver_sub.get("sources", [])) > 1 else 0.8,
                    lifecycle_status="active",
                    validation_status="validated",
                    raw_data=ver_sub,
                    evidence=[{"source": s, "dns": ver_sub.get("dns_records", {})} for s in ver_sub.get("sources", [])],
                ))

            # 2. Historical Subdomains (recorded in CT / archive, but currently NXDOMAIN)
            for hist_sub in sub_r.processed_data.get("historical_subdomains", []):
                sname = hist_sub["subdomain"]
                assets.append(self._make_asset(
                    AssetType.SUBDOMAIN,
                    sname,
                    hist_sub.get("sources", ["crt.sh"])[0],
                    sources=hist_sub.get("sources", ["crt.sh"]),
                    confidence=0.5,
                    lifecycle_status="historical",
                    validation_status="unvalidated",
                    raw_data=hist_sub,
                    evidence=[{"source": s, "status": "HISTORICAL", "reason": hist_sub.get("reason", "NXDOMAIN")} for s in hist_sub.get("sources", [])],
                ))

        # Nameservers → assets
        ns_r = results.get("nameserver")
        if ns_r and ns_r.status != CollectorStatus.FAILED:
            for ns in ns_r.processed_data.get("nameservers", []):
                assets.append(self._make_asset(
                    AssetType.NAMESERVER,
                    ns.get("nameserver", ""),
                    "nameserver",
                    raw_data=ns,
                    confidence=ns_r.confidence,
                    lifecycle_status="active",
                    validation_status="validated",
                    evidence=[{"source": "dnspython", "nameserver": ns.get("nameserver")}],
                ))

        # Mail servers → assets
        mail_r = results.get("mail")
        if mail_r and mail_r.status != CollectorStatus.FAILED:
            for mx in mail_r.processed_data.get("mx_records", []):
                assets.append(self._make_asset(
                    AssetType.MAIL_SERVER,
                    mx.get("exchange", ""),
                    "mail",
                    raw_data=mx,
                    confidence=mail_r.confidence,
                    lifecycle_status="active",
                    validation_status="validated",
                    evidence=[{"source": "dnspython", "exchange": mx.get("exchange"), "preference": mx.get("preference")}],
                ))

        # Certificates → assets
        cert_r = results.get("certificate")
        if cert_r and cert_r.status != CollectorStatus.FAILED:
            cert = cert_r.processed_data.get("certificate")
            if cert:
                assets.append(self._make_asset(
                    AssetType.CERTIFICATE,
                    cert.get("subject", domain),
                    "certificate",
                    raw_data=cert,
                    confidence=cert_r.confidence,
                    lifecycle_status="active" if not cert.get("is_expired") else "historical",
                    validation_status="validated",
                    evidence=[{"source": "tls_handshake", "issuer": cert.get("issuer"), "san": cert.get("san", [])}],
                ))

        # Open ports → assets
        port_r = results.get("ports")
        if port_r and port_r.status != CollectorStatus.FAILED:
            for port in port_r.processed_data.get("open_ports", []):
                assets.append(self._make_asset(
                    AssetType.OPEN_PORT,
                    f"{domain}:{port['port']}",
                    "ports",
                    raw_data=port,
                    confidence=port_r.confidence,
                    lifecycle_status="active",
                    validation_status="validated",
                    evidence=[{"source": "tcp_connect", "port": port["port"], "banner": port.get("banner", "")}],
                ))
                if port.get("service") and port["service"] != "unknown":
                    assets.append(self._make_asset(
                        AssetType.SERVICE,
                        f"{port['service']}:{port['port']}",
                        "ports",
                        raw_data=port,
                        confidence=0.9 if port.get("banner") else 0.6,
                        lifecycle_status="active",
                        validation_status="validated",
                        evidence=[{"source": "tcp_banner" if port.get("banner") else "port_mapping", "service": port["service"]}],
                    ))

        # Technologies → assets
        tech_r = results.get("technology")
        if tech_r and tech_r.status != CollectorStatus.FAILED:
            for tech in tech_r.processed_data.get("technologies", []):
                assets.append(self._make_asset(
                    AssetType.TECHNOLOGY,
                    tech.get("name", ""),
                    "technology",
                    raw_data=tech,
                    confidence=tech_r.confidence,
                    lifecycle_status="active",
                    validation_status="validated",
                    evidence=[{"source": "http_fingerprint", "evidence": tech.get("evidence", "")}],
                ))

        # Cloud providers → assets
        cloud_r = results.get("cloud")
        if cloud_r and cloud_r.status != CollectorStatus.FAILED:
            for provider in cloud_r.processed_data.get("cloud_providers", []):
                assets.append(self._make_asset(
                    AssetType.CLOUD_PROVIDER, provider, "cloud",
                    confidence=cloud_r.confidence,
                    lifecycle_status="active",
                    validation_status="validated",
                    evidence=[{"source": "cname_or_header", "provider": provider}],
                ))
            for cdn in cloud_r.processed_data.get("cdn_providers", []):
                assets.append(self._make_asset(
                    AssetType.CDN_PROVIDER, cdn, "cloud",
                    confidence=cloud_r.confidence,
                    lifecycle_status="active",
                    validation_status="validated",
                    evidence=[{"source": "cname_or_header", "cdn": cdn}],
                ))

        # WAF → assets
        waf_r = results.get("waf")
        if waf_r and waf_r.status != CollectorStatus.FAILED:
            for waf in waf_r.processed_data.get("waf_providers", []):
                assets.append(self._make_asset(
                    AssetType.WAF, waf, "waf",
                    confidence=waf_r.confidence,
                    lifecycle_status="active",
                    validation_status="validated",
                    evidence=[{"source": "waf_fingerprint", "waf": waf}],
                ))

        # Security headers → assets
        header_r = results.get("http_header")
        if header_r and header_r.status != CollectorStatus.FAILED:
            sec = header_r.processed_data.get("security_headers", {})
            if sec:
                assets.append(self._make_asset(
                    AssetType.HTTP_HEADER,
                    f"security_headers_score:{sec.get('score', 0)}",
                    "http_header",
                    raw_data=sec,
                    confidence=header_r.confidence,
                    lifecycle_status="active",
                    validation_status="validated",
                    evidence=[{"source": "http_headers", "score": sec.get("score", 0), "present": len(sec.get("present", []))}],
                ))

        return assets

    # ── Step 4: Deduplicate ──────────────────────────────────────────

    def deduplicate(self, assets: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Remove duplicate assets by (asset_type, asset_value), merging evidence and sources."""
        logger.info("Step 4/9: Deduplicating", extra={"before": len(assets)})
        seen: Dict[tuple, Dict[str, Any]] = {}
        for asset in assets:
            key = (asset["asset_type"], asset["asset_value"])
            if key not in seen:
                seen[key] = asset
            else:
                existing = seen[key]
                # Merge sources
                existing_sources = existing.setdefault("sources", [existing["discovery_source"]])
                for s in asset.get("sources", [asset.get("discovery_source", "")]):
                    if s and s not in existing_sources:
                        existing_sources.append(s)
                # Merge methods
                existing_methods = existing.setdefault("methods", [existing["discovery_source"]])
                for m in asset.get("methods", [asset.get("discovery_source", "")]):
                    if m and m not in existing_methods:
                        existing_methods.append(m)
                # Merge evidence
                existing_ev = existing.setdefault("evidence", [])
                for ev in asset.get("evidence", []):
                    if ev not in existing_ev:
                        existing_ev.append(ev)
                # Update confidence based on multi-source confirmation
                if len(existing_sources) >= 2 and existing["lifecycle_status"] == "active":
                    existing["confidence_score"] = 1.0
        unique = list(seen.values())
        logger.info("Deduplication done", extra={"after": len(unique)})
        return unique

    # ── Step 5: Validate Results ─────────────────────────────────────

    def validate_results(
        self, assets: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """Sanity-check asset values; classify IPs and flag private IP anomalies."""
        logger.info("Step 5/9: Validating results", extra={"count": len(assets)})
        validated: List[Dict[str, Any]] = []
        for asset in assets:
            value = asset.get("asset_value", "")
            if not value or str(value).strip() == "":
                continue

            # Classify IP addresses and detect private/reserved anomalies
            if asset["asset_type"] == AssetType.IP_ADDRESS.value:
                ip_class = classify_ip_address(value)
                asset["ip_classification"] = ip_class
                if ip_class != "PUBLIC":
                    # Flag anomaly: Private/Loopback/Reserved IP for a domain
                    asset["validation_status"] = "invalid"
                    asset["anomaly"] = f"Unexpected {ip_class} IP address returned for public domain."
                    asset["confidence_score"] = 0.2
                else:
                    asset["validation_status"] = "validated"

            validated.append(asset)
        return validated

    # ── Step 6: Enrich Results ───────────────────────────────────────

    def enrich_results(
        self,
        domain: str,
        assets: List[Dict[str, Any]],
        collector_results: Dict[str, CollectorResult],
    ) -> List[Dict[str, Any]]:
        """Add metadata and cross-references to assets."""
        logger.info("Step 6/9: Enriching results", extra={"count": len(assets)})
        for asset in assets:
            asset["root_domain"] = extract_root_domain(domain)
            asset["scan_domain"] = domain
        return assets

    # ── Step 7: Classify Results ─────────────────────────────────────

    def classify_results(
        self, assets: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """Tag assets with exposure classification."""
        logger.info("Step 7/9: Classifying results", extra={"count": len(assets)})
        for asset in assets:
            asset["exposure"] = self._classify_exposure(asset)
        return assets

    # ── Step 8: Store Results ────────────────────────────────────────

    async def store_results(
        self,
        scan_id: str,
        assets: List[Dict[str, Any]],
        collector_results: Dict[str, CollectorResult],
        repo: DomainRepository,
    ) -> int:
        """Persist assets and collector runs to the database."""
        logger.info("Step 8/9: Storing results", extra={"count": len(assets)})

        # Store assets
        stored = await repo.store_assets(scan_id, assets)

        # Store collector runs
        for name, result in collector_results.items():
            await repo.store_collector_run(
                scan_id=scan_id,
                collector_name=name,
                status=result.status.value,
                execution_time=result.execution_time,
                records_found=len(result.processed_data),
                errors=result.errors,
            )

        return stored

    # ── Step 9: Generate Report ──────────────────────────────────────

    async def generate_report(
        self,
        scan_id: str,
        domain: str,
        started_at: datetime,
        assets: List[Dict[str, Any]],
        collector_results: Dict[str, CollectorResult],
        attack_surface: Dict[str, Any],
        analyzer_results: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Assemble the final structured report."""
        logger.info("Step 9/9: Generating report", extra={"domain": domain})
        now = datetime.now(timezone.utc)

        # Group assets by type
        grouped: Dict[str, List[Dict[str, Any]]] = {}
        for asset in assets:
            atype = asset["asset_type"]
            grouped.setdefault(atype, []).append(asset)

        report = DomainReportSchema(
            scan_id=scan_id,
            target_domain=domain,
            status=ScanStatus.COMPLETED,
            started_at=started_at,
            completed_at=now,
            duration_seconds=round((now - started_at).total_seconds(), 2),
            total_assets_found=len(assets),
            collector_results=collector_results,
            assets=grouped,
            attack_surface={
                **attack_surface,
                "analyzers": analyzer_results,
            },
            scan_config={
                "timeout": settings.SCAN_TIMEOUT_SECONDS,
                "max_collectors": settings.MAX_CONCURRENT_COLLECTORS,
                "ports_scanned": len(settings.DEFAULT_PORTS),
            },
        )
        return report.model_dump(mode="json")

    # ── Private Helpers ──────────────────────────────────────────────

    @staticmethod
    def _make_asset(
        asset_type: AssetType,
        value: str,
        source: str,
        raw_data: Optional[Dict] = None,
        confidence: float = 1.0,
        evidence: Optional[List[Dict[str, Any]]] = None,
        sources: Optional[List[str]] = None,
        lifecycle_status: str = "discovered",
        validation_status: str = "unvalidated",
    ) -> Dict[str, Any]:
        """Build a standardised asset dict with full evidence schema."""
        src_list = sources or [source]
        now = datetime.now(timezone.utc)
        return {
            "id": generate_asset_id(),
            "asset_type": asset_type.value,
            "asset_value": value,
            "discovery_source": source,
            "sources": src_list,
            "methods": [source],
            "evidence": evidence or [],
            "raw_data": raw_data or {},
            "confidence_score": confidence,
            "validation_status": validation_status,
            "lifecycle_status": lifecycle_status,
            "first_seen": now,
            "last_seen": now,
            "last_verified": now if lifecycle_status == "active" else None,
        }

    @staticmethod
    def _classify_exposure(asset: Dict[str, Any]) -> str:
        """Classify an asset's exposure level."""
        atype = asset.get("asset_type", "")
        if atype in (
            AssetType.OPEN_PORT.value,
            AssetType.ADMIN_PORTAL.value,
            AssetType.LOGIN_PORTAL.value,
            AssetType.STAGING_ENV.value,
        ):
            return "high"
        if atype in (
            AssetType.API_ENDPOINT.value,
            AssetType.SERVICE.value,
        ):
            return "medium"
        return "low"
