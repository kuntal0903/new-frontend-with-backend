"""
Domain Validator & DNS Delegation Verifier

WHY THIS FILE EXISTS:
    Validates a domain BEFORE starting any scanning or enumeration.
    Checks syntax, public suffix eligibility, and authoritative DNS delegation
    (NS, SOA, A, AAAA, MX records).

    Prevents wasted enumeration, timeouts, and false positives on nonexistent,
    unregistered, or broken domains.

VALIDATION STATES:
    - VALID: Domain is syntactically correct and actively delegated via DNS.
    - INVALID_SYNTAX: Malformed hostname, invalid characters, or out-of-spec labels.
    - NXDOMAIN: Domain is confirmed nonexistent by authoritative/public resolvers.
    - NO_DELEGATION: No NS or SOA records found (not delegated from parent zone).
    - DNS_SERVFAIL: Upstream DNS server returned SERVFAIL or query was refused.
    - DNS_TIMEOUT: Resolver timed out during authoritative verification.
"""
from __future__ import annotations

import asyncio
from dataclasses import asdict, dataclass, field
from typing import Any, Dict, List, Optional

import dns.asyncresolver
import dns.exception
import dns.name
import dns.rdatatype
import dns.resolver

from common.logger import get_logger
from common.utils import clean_domain, extract_root_domain, is_valid_domain

logger = get_logger("domain", "validator")


@dataclass
class DomainValidationResult:
    domain: str
    root_domain: str
    syntax_valid: bool
    dns_delegated: bool
    status: str  # "VALID" | "INVALID_SYNTAX" | "NXDOMAIN" | "NO_DELEGATION" | "DNS_SERVFAIL" | "DNS_TIMEOUT" | "UNKNOWN"
    reason: str
    details: Dict[str, Any] = field(default_factory=dict)

    def is_eligible_for_scan(self) -> bool:
        """Returns True only if the target is deemed valid and delegated for scanning."""
        return self.status == "VALID" and self.syntax_valid and self.dns_delegated

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


class DomainValidator:
    """Performs rigorous pre-scan domain syntax and DNS delegation validation."""

    def __init__(self, timeout: float = 6.0):
        self.timeout = timeout

    async def validate(self, raw_input: str) -> DomainValidationResult:
        """
        Validate *raw_input* end-to-end.
        1. Normalize & Syntax Check
        2. DNS Delegation & Existence Verification (NS, SOA, A, AAAA, MX)
        """
        cleaned = clean_domain(raw_input)
        if not cleaned or not is_valid_domain(cleaned):
            return DomainValidationResult(
                domain=raw_input,
                root_domain="",
                syntax_valid=False,
                dns_delegated=False,
                status="INVALID_SYNTAX",
                reason=f"The domain '{raw_input}' has an invalid syntax or character format.",
            )

        root = extract_root_domain(cleaned)

        # Check DNS resolution
        resolver = dns.asyncresolver.Resolver()
        resolver.lifetime = self.timeout

        # Test both target and root domain
        delegation_info: Dict[str, Any] = {
            "target": cleaned,
            "root_domain": root,
            "records_found": {},
            "rcode": None,
        }

        # Check records for delegation: SOA, NS, A, AAAA, MX, CNAME
        record_types = ["NS", "SOA", "A", "AAAA", "MX", "CNAME"]
        records_found: Dict[str, List[str]] = {}
        had_nxdomain = False
        had_timeout = False
        had_servfail = False

        for rtype in record_types:
            try:
                ans = await resolver.resolve(cleaned, rtype)
                vals = [rr.to_text() for rr in ans]
                if vals:
                    records_found[rtype] = vals
            except dns.resolver.NXDOMAIN:
                had_nxdomain = True
                break
            except dns.resolver.NoAnswer:
                continue
            except dns.resolver.NoNameservers:
                had_servfail = True
            except dns.exception.Timeout:
                had_timeout = True
            except Exception as e:
                err_str = str(e).lower()
                if "servfail" in err_str or "refused" in err_str:
                    had_servfail = True

        # If target has records, it is valid
        if records_found:
            delegation_info["records_found"] = records_found
            return DomainValidationResult(
                domain=cleaned,
                root_domain=root,
                syntax_valid=True,
                dns_delegated=True,
                status="VALID",
                reason="Domain is delegated and active in DNS.",
                details=delegation_info,
            )

        # If NXDOMAIN occurred on target, check root domain
        if had_nxdomain:
            if root != cleaned:
                # The target subdomain is NXDOMAIN, check if root exists
                try:
                    root_ans = await resolver.resolve(root, "SOA")
                    if root_ans:
                        delegation_info["root_soa"] = [rr.to_text() for rr in root_ans]
                        # Root exists, but this specific subdomain does not
                        return DomainValidationResult(
                            domain=cleaned,
                            root_domain=root,
                            syntax_valid=True,
                            dns_delegated=False,
                            status="NXDOMAIN",
                            reason=f"The host '{cleaned}' does not exist (NXDOMAIN) within parent zone '{root}'.",
                            details=delegation_info,
                        )
                except Exception:
                    pass

            return DomainValidationResult(
                domain=cleaned,
                root_domain=root,
                syntax_valid=True,
                dns_delegated=False,
                status="NXDOMAIN",
                reason=f"The domain '{cleaned}' does not exist (NXDOMAIN).",
                details=delegation_info,
            )

        if had_timeout:
            return DomainValidationResult(
                domain=cleaned,
                root_domain=root,
                syntax_valid=True,
                dns_delegated=False,
                status="DNS_TIMEOUT",
                reason="DNS query timed out during delegation verification.",
                details=delegation_info,
            )

        if had_servfail:
            return DomainValidationResult(
                domain=cleaned,
                root_domain=root,
                syntax_valid=True,
                dns_delegated=False,
                status="DNS_SERVFAIL",
                reason="Authoritative nameservers returned SERVFAIL or refused the query.",
                details=delegation_info,
            )

        # Also check root domain SOA/NS as a fallback check
        try:
            root_ans = await resolver.resolve(root, "NS")
            if root_ans:
                records_found["root_NS"] = [rr.to_text() for rr in root_ans]
                delegation_info["records_found"] = records_found
                return DomainValidationResult(
                    domain=cleaned,
                    root_domain=root,
                    syntax_valid=True,
                    dns_delegated=True,
                    status="VALID",
                    reason="Root domain is delegated via NS.",
                    details=delegation_info,
                )
        except dns.resolver.NXDOMAIN:
            return DomainValidationResult(
                domain=cleaned,
                root_domain=root,
                syntax_valid=True,
                dns_delegated=False,
                status="NXDOMAIN",
                reason=f"Parent zone '{root}' does not exist.",
                details=delegation_info,
            )
        except Exception:
            pass

        return DomainValidationResult(
            domain=cleaned,
            root_domain=root,
            syntax_valid=True,
            dns_delegated=False,
            status="NO_DELEGATION",
            reason=f"No authoritative DNS delegation records (NS, SOA, A, MX) found for '{cleaned}'.",
            details=delegation_info,
        )
