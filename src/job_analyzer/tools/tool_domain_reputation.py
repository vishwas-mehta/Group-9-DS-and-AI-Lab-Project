"""
TOOL: Domain WHOIS reputation check — age, registrar, expiry, liveness.
100% free — python-whois + requests.

Risk thresholds:
  < 180 days old  → HIGH   (freshly registered, common pattern in scam jobs)
  180-730 days    → MEDIUM
  > 730 days      → LOW    (established domain)
"""
import sys, json, requests, whois
from datetime import datetime, timezone
sys.path.insert(0, "..")
try:
    from .. import config
except ImportError:
    import config

def _pick(val):
    return val[0] if isinstance(val, list) else val

def _days_since(dt):
    if not dt: return None
    try:
        now = datetime.now(timezone.utc)
        if dt.tzinfo is None: dt = dt.replace(tzinfo=timezone.utc)
        return max((now - dt).days, 0)
    except: return None

def _iso(dt):
    return dt.isoformat() if dt else None

def _bare_domain(value: str) -> str:
    """Strip protocol/path, return hostname only."""
    v = value.strip().lower()
    for p in ("https://", "http://"):
        if v.startswith(p): v = v[len(p):]
    v = v.split("/")[0]
    return v[4:] if v.startswith("www.") else v

def check_domain_reputation(domain_or_email: str) -> dict:
    """
    WHOIS lookup for a domain or email address.

    INPUT : domain (infosys.com) OR email (hr@infosys.com) OR URL
    OUTPUT: {ok, data: {domain, registrar, creation_date, domain_age_days,
                        expiration_date, is_live, risk_level}}

    Test: python tool_domain_reputation.py
    """
    if not domain_or_email:
        return {"ok": False, "error": "domain or email required"}

    raw = domain_or_email.strip()
    domain = raw.split("@")[-1].lower() if ("@" in raw and not raw.startswith("http")) \
             else _bare_domain(raw)

    try:
        w = whois.whois(domain)
        created = _pick(getattr(w, "creation_date", None))
        expires = _pick(getattr(w, "expiration_date", None))
        updated = _pick(getattr(w, "updated_date", None))
        age     = _days_since(created)

        is_live = False
        live_url = None
        try:
            r = requests.get(f"https://{domain}", headers=config.REQUEST_HEADERS,
                             timeout=10, allow_redirects=True)
            is_live  = r.status_code < 500
            live_url = r.url
        except: pass

        risk = "high" if age is not None and age < 180 else \
               "medium" if age is not None and age < 730 else "low"

        return {
            "ok": True,
            "data": {
                "domain":          domain,
                "registrar":       getattr(w, "registrar", None),
                "creation_date":   _iso(created),
                "expiration_date": _iso(expires),
                "updated_date":    _iso(updated),
                "domain_age_days": age,
                "is_live":         is_live,
                "live_url":        live_url,
                "risk_level":      risk,
            }
        }
    except Exception as e:
        return {"ok": False, "error": str(e), "data": {"domain": domain}}


if __name__ == "__main__":
    print(json.dumps(check_domain_reputation("infosys.com"), indent=2))
