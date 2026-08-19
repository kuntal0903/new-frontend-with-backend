"""
Shared Helper Utilities

WHY THIS FILE EXISTS:
    Pure functions used by multiple collectors and the pipeline.
    Domain validation, IP classification, deduplication, UUID generation.
    No side effects — every function is deterministic and testable.

WHAT IT ACCEPTS / RETURNS:
    Each function documents its inputs and outputs via type hints.
    All functions operate on primitive types (str, list, bool).

DESIGN:
    Pure utility module.  No classes, no state, no I/O.
    If a utility needs I/O (network, disk), it belongs in a collector.
"""
import hashlib
import ipaddress
import re
import uuid
from typing import Any, Dict, List, Optional
from urllib.parse import urlparse

import tldextract


# ── Domain Validation & Normalization ────────────────────────────────

_DOMAIN_RE = re.compile(
    r"^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,63}$"
)


def clean_domain(domain: str) -> str:
    """
    Robustly clean and normalize a user-supplied domain or URL string.
    - Strips leading/trailing whitespace
    - Lowercases
    - Strips protocols (http://, https://, ftp://, etc.)
    - Strips paths, query parameters, fragments
    - Strips port numbers
    - Strips trailing dots (e.g. example.com.)
    - Handles IDN / Punycode conversion
    """
    if not domain or not isinstance(domain, str):
        return ""

    domain = domain.strip().lower()

    # If scheme exists or starts with //, use urlparse
    if "://" in domain or domain.startswith("//"):
        parsed = urlparse(domain if "://" in domain else f"http:{domain}")
        domain = parsed.hostname or domain
    else:
        # Strip path / query
        domain = domain.split("/")[0].split("?")[0].split("#")[0]
        # Strip port if present (avoid breaking IPv6 by checking colon count)
        if ":" in domain and domain.count(":") == 1:
            domain = domain.split(":")[0]

    domain = domain.rstrip(".")

    # Handle IDN / Punycode conversion if non-ascii characters are present
    try:
        domain = domain.encode("idna").decode("ascii")
    except Exception:
        pass

    return domain


def is_valid_domain(domain: str) -> bool:
    """Return True if *domain* matches a syntactically valid domain name."""
    if not domain:
        return False
    cleaned = clean_domain(domain)
    if not (1 <= len(cleaned) <= 253):
        return False
    # Check overall regex
    if not _DOMAIN_RE.match(cleaned):
        return False
    # Check each label length (1-63 chars)
    labels = cleaned.split(".")
    if len(labels) < 2:
        return False
    for label in labels:
        if not (1 <= len(label) <= 63):
            return False
        if label.startswith("-") or label.endswith("-"):
            return False
    return True


def normalize_domain(raw: str) -> Optional[str]:
    """Clean *raw* and return it only if it is a valid domain, else ``None``."""
    cleaned = clean_domain(raw)
    return cleaned if is_valid_domain(cleaned) else None


def extract_root_domain(domain: str) -> str:
    """
    Extract the registrable (root) domain from a FQDN using tldextract.
    Examples:
        api.example.com      -> example.com
        api.example.co.uk    -> example.co.uk
        sub.api.example.com  -> example.com
    """
    cleaned = clean_domain(domain)
    extracted = tldextract.extract(cleaned)
    if extracted.domain and extracted.suffix:
        return f"{extracted.domain}.{extracted.suffix}"
    parts = cleaned.split(".")
    if len(parts) >= 2:
        return ".".join(parts[-2:])
    return cleaned


# ── IP Utilities & Classification ────────────────────────────────────


def is_valid_ip(address: str) -> bool:
    """Return True if *address* is a valid IPv4 or IPv6 address."""
    try:
        ipaddress.ip_address(address)
        return True
    except ValueError:
        return False


def is_private_ip(address: str) -> bool:
    """Return True if *address* is in a private / reserved / loopback range."""
    try:
        ip = ipaddress.ip_address(address)
        return ip.is_private or ip.is_loopback or ip.is_reserved or ip.is_link_local or ip.is_multicast
    except ValueError:
        return False


def classify_ip_address(address: str) -> str:
    """
    Classify an IP address into standard categories:
    PUBLIC, PRIVATE, LOOPBACK, LINK_LOCAL, MULTICAST, RESERVED, TEST, INVALID.
    """
    try:
        ip = ipaddress.ip_address(address)
        if ip.is_loopback:
            return "LOOPBACK"
        if ip.is_private:
            return "PRIVATE"
        if ip.is_link_local:
            return "LINK_LOCAL"
        if ip.is_multicast:
            return "MULTICAST"
        if ip.is_reserved:
            return "RESERVED"
        # Test / Documentation subnets (e.g. 192.0.2.0/24, 198.51.100.0/24, 203.0.113.0/24)
        if ip.version == 4:
            if any(ip in ipaddress.ip_network(net) for net in ["192.0.2.0/24", "198.51.100.0/24", "203.0.113.0/24", "233.252.0.0/24"]):
                return "DOCUMENTATION/TEST"
        elif ip.version == 6:
            if ip in ipaddress.ip_network("2001:db8::/32"):
                return "DOCUMENTATION/TEST"
        if ip.is_global:
            return "PUBLIC"
        return "RESERVED"
    except ValueError:
        return "INVALID"



# ── Deduplication ────────────────────────────────────────────────────


def deduplicate_list(items: List[Any], key: Optional[str] = None) -> List[Any]:
    """
    Remove duplicates while preserving insertion order.

    Parameters
    ----------
    items : list
        Input list (of primitives or dicts).
    key : str, optional
        If items are dicts, deduplicate by this dict key.
    """
    seen: set = set()
    result: List[Any] = []
    for item in items:
        identifier = item.get(key) if key and isinstance(item, dict) else item
        hashable = _make_hashable(identifier)
        if hashable not in seen:
            seen.add(hashable)
            result.append(item)
    return result


def _make_hashable(obj: Any) -> Any:
    """Convert *obj* to a hashable representation for set membership."""
    if isinstance(obj, dict):
        return tuple(sorted(obj.items()))
    if isinstance(obj, (list, tuple)):
        return tuple(obj)
    return obj


# ── UUID Generation ──────────────────────────────────────────────────


def generate_asset_id() -> str:
    """Generate a UUID4 string for asset identification."""
    return str(uuid.uuid4())


def generate_deterministic_id(*parts: str) -> str:
    """
    Generate a deterministic UUID5-style ID from input parts.

    Useful for deduplication: the same asset discovered twice
    produces the same ID.
    """
    raw = "|".join(str(p) for p in parts)
    digest = hashlib.sha256(raw.encode()).hexdigest()
    return str(uuid.UUID(digest[:32]))


# ── Miscellaneous ────────────────────────────────────────────────────


def safe_get(data: Dict, *keys: str, default: Any = None) -> Any:
    """Safely traverse nested dicts without raising KeyError."""
    current = data
    for key in keys:
        if isinstance(current, dict):
            current = current.get(key, default)
        else:
            return default
    return current
