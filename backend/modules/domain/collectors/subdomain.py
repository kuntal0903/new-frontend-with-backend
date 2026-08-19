"""
Subdomain Discovery Collector

WHY THIS FILE EXISTS:
    Multi-source subdomain enumeration — the single most important
    discovery task in attack surface mapping.

DATA SOURCES (independent, results merged):
    1. crt.sh Certificate Transparency logs
    2. DNS brute-force using a configurable wordlist

WHAT IT ACCEPTS:
    A root domain string and optional kwargs:
        - ct_domains: List[str] — SAN domains from the certificate
          collector (injected during enrichment phase)

WHAT IT RETURNS:
    CollectorResult with deduplicated, validated subdomain list
    and per-source attribution.
"""
import asyncio
from typing import Any, Dict, List, Set

import aiohttp
import dns.asyncresolver
import dns.exception
import dns.resolver

from common.utils import is_valid_domain, normalize_domain
from config import settings
from modules.domain.collectors.base import BaseCollector
from modules.domain.collectors.wildcard_detector import WildcardDetector

# ── Wordlists ────────────────────────────────────────────────────────

_WORDLIST_SMALL: List[str] = [
    "www", "mail", "ftp", "smtp", "pop", "imap", "webmail",
    "admin", "portal", "vpn", "remote", "ns1", "ns2",
    "api", "dev", "staging", "test", "qa", "uat", "beta",
    "demo", "sandbox", "preprod", "prod", "app", "web",
    "cdn", "static", "assets", "media", "img", "images",
    "docs", "wiki", "support", "help", "status", "monitor",
    "grafana", "kibana", "jenkins", "gitlab", "git", "ci",
    "auth", "sso", "login", "id", "oauth", "accounts",
    "dashboard", "panel", "cpanel", "whm", "manage",
    "db", "database", "mysql", "postgres", "redis", "mongo",
    "elastic", "search", "log", "logs", "syslog",
    "mx", "relay", "gateway", "proxy", "lb", "load",
    "backup", "bak", "old", "new", "v2", "internal",
    "intranet", "extranet", "partner", "client", "customer",
    "shop", "store", "pay", "payment", "billing", "invoice",
    "m", "mobile", "blog", "news", "forum", "community",
]

_WORDLIST_MEDIUM: List[str] = _WORDLIST_SMALL + [
    "www2", "www3", "mail2", "smtp2", "ns3", "ns4",
    "api2", "api-v2", "rest", "graphql", "ws", "websocket",
    "dev1", "dev2", "stage", "stg", "tst", "testing",
    "alpha", "preview", "canary", "edge", "next",
    "assets2", "cdn2", "upload", "files", "share",
    "crm", "erp", "hr", "it", "ops", "devops",
    "jira", "confluence", "slack", "teams", "zoom",
    "prometheus", "nagios", "zabbix", "splunk", "datadog",
    "vault", "secrets", "key", "cert", "pki",
    "s3", "storage", "archive", "cache", "memcached",
    "mq", "queue", "rabbit", "kafka",
    "k8s", "kube", "docker", "registry", "container",
    "ci-cd", "build", "deploy", "release", "artifact",
    "sentry", "error", "debug", "trace",
    "staging-api", "dev-api", "test-api",
]


class SubdomainCollector(BaseCollector):
    """Multi-source subdomain discovery with deduplication."""

    collector_name = "subdomain"
    source_name = "crt.sh+dns_bruteforce"

    async def collect(self, target: str, **kwargs: Any) -> Dict[str, Any]:
        found: Dict[str, Set[str]] = {
            "crt.sh": set(),
            "dns_bruteforce": set(),
            "certificate_san": set(),
        }
        errors: List[str] = []

        # Source 1: crt.sh CT log
        try:
            ct_subs = await self._crtsh_enum(target)
            found["crt.sh"] = ct_subs
        except Exception as exc:
            errors.append(f"crt.sh failed: {exc}")

        # Source 2: DNS brute-force
        if settings.SUBDOMAIN_BRUTEFORCE_ENABLED:
            try:
                brute_subs = await self._dns_bruteforce(target)
                found["dns_bruteforce"] = brute_subs
            except Exception as exc:
                errors.append(f"DNS bruteforce failed: {exc}")

        # Source 3: Certificate SAN (injected by orchestrator)
        ct_domains: List[str] = kwargs.get("ct_domains", [])
        for d in ct_domains:
            normalised = normalize_domain(d)
            if normalised and normalised.endswith(f".{target}"):
                found["certificate_san"].add(normalised)

        # Merge candidate subdomains
        candidate_subdomains: Set[str] = set()
        for source_subs in found.values():
            candidate_subdomains.update(source_subs)

        # Step 2: Wildcard Detection
        detector = WildcardDetector()
        wildcard = await detector.detect(target)
        self._last_wildcard_detected = wildcard.is_wildcard
        self._last_wildcard_ips = wildcard.wildcard_ips

        # Step 3: Active DNS Verification for ALL candidates (CT logs + SAN + brute force)
        verified_subdomains: List[Dict[str, Any]] = []
        historical_subdomains: List[Dict[str, Any]] = []
        active_subdomain_names: Set[str] = set()

        verify_semaphore = asyncio.Semaphore(15)

        async def _verify_candidate(sub: str):
            async with verify_semaphore:
                sources = [src for src, subs in found.items() if sub in subs]
                cand_resolver = dns.asyncresolver.Resolver()
                cand_resolver.lifetime = 2.0
                try:
                    ans = await cand_resolver.resolve(sub, "A")
                    ips = {rr.to_text() for rr in ans}
                    if wildcard.should_exclude(ips):
                        return
                    verified_subdomains.append({
                        "subdomain": sub,
                        "status": "ACTIVE",
                        "lifecycle_status": "active",
                        "resolved_ips": sorted(list(ips)),
                        "sources": sources,
                        "dns_records": {"A": sorted(list(ips))},
                    })
                    active_subdomain_names.add(sub)
                except dns.resolver.NXDOMAIN:
                    historical_subdomains.append({
                        "subdomain": sub,
                        "status": "HISTORICAL",
                        "lifecycle_status": "historical",
                        "sources": sources,
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
                            "sources": sources,
                            "dns_records": {"CNAME": cnames},
                        })
                        active_subdomain_names.add(sub)
                    except Exception:
                        historical_subdomains.append({
                            "subdomain": sub,
                            "status": "INACTIVE",
                            "lifecycle_status": "inactive",
                            "sources": sources,
                        })
                except Exception:
                    pass

        if candidate_subdomains:
            await asyncio.gather(*[_verify_candidate(s) for s in candidate_subdomains], return_exceptions=True)

        return {
            "raw_data": {
                "domain": target,
                "candidates_total": len(candidate_subdomains),
                "by_source": {k: sorted(v) for k, v in found.items()},
                "errors": errors,
            },
            "processed_data": {
                "domain": target,
                "subdomains": sorted(active_subdomain_names),
                "verified_subdomains": verified_subdomains,
                "historical_subdomains": historical_subdomains,
                "total_candidates": len(candidate_subdomains),
                "total_verified": len(verified_subdomains),
                "total_historical": len(historical_subdomains),
                "wildcard_detected": wildcard.is_wildcard,
                "wildcard_ips": sorted(wildcard.wildcard_ips),
            },
        }

    def get_confidence(self, raw: Dict[str, Any]) -> float:
        pd = raw.get("processed_data", {})
        sources_with_data = sum(
            1 for v in pd.get("by_source_count", {}).values() if v > 0
        )
        if sources_with_data >= 2:
            return 1.0
        if sources_with_data == 1:
            return 0.7
        return 0.3

    # ── crt.sh & CT Discovery ────────────────────────────────────────

    async def _crtsh_enum(self, domain: str) -> Set[str]:
        session = await self._get_session()
        url = f"https://crt.sh/?q=%.{domain}&output=json"
        try:
            async with session.get(url, timeout=aiohttp.ClientTimeout(total=8)) as resp:
                if resp.status == 200:
                    data = await resp.json(content_type=None)
                    if isinstance(data, list):
                        results: Set[str] = set()
                        for entry in data:
                            for field in ("common_name", "name_value"):
                                raw_value = entry.get(field, "")
                                for name in raw_value.split("\n"):
                                    name = name.strip().lower().lstrip("*.")
                                    if (
                                        is_valid_domain(name)
                                        and name.endswith(f".{domain}")
                                        and name != domain
                                    ):
                                        results.add(name)
                                        if len(results) >= 200:
                                            return results
                        return results
        except Exception as e:
            self.logger.debug(f"crt.sh query timed out or failed: {e}")

        return set()

    # ── DNS Brute-force Candidate Generation ───────────────────────────

    async def _dns_bruteforce(self, domain: str) -> Set[str]:
        """
        Generate subdomain candidates using wordlist with bounded concurrency.
        """
        wordlist = self._get_wordlist()
        resolver = dns.asyncresolver.Resolver()
        resolver.lifetime = 1.5

        found: Set[str] = set()
        semaphore = asyncio.Semaphore(20)

        async def _check(prefix: str):
            fqdn = f"{prefix}.{domain}"
            async with semaphore:
                try:
                    await resolver.resolve(fqdn, "A")
                    found.add(fqdn)
                except Exception:
                    pass

        await asyncio.gather(*[_check(p) for p in wordlist], return_exceptions=True)
        return found

    @staticmethod
    def _get_wordlist() -> List[str]:
        size = settings.SUBDOMAIN_WORDLIST_SIZE
        if size == "medium":
            return _WORDLIST_MEDIUM
        # Default to small
        return _WORDLIST_SMALL
