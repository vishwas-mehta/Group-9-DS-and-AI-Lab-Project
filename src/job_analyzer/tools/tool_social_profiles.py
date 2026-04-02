"""
TOOL: Find company social media profiles via DuckDuckGo.
100% free — duckduckgo-search, no API key.
"""
import sys, json, time
from ddgs import DDGS
sys.path.insert(0, "..")

PLATFORMS = {
    "linkedin":  "site:linkedin.com/company",
    "twitter_x": "site:x.com OR site:twitter.com",
    "github":    "site:github.com",
    "facebook":  "site:facebook.com",
    "instagram": "site:instagram.com",
    "youtube":   "site:youtube.com",
    "glassdoor": "site:glassdoor.com",
}

def check_social_profiles(company_name: str) -> dict:
    """
    Search for each social platform individually.

    INPUT : company name
    OUTPUT: {ok, data: {company_name, platforms_found, profiles}}

    Test: python tool_social_profiles.py
    """
    if not company_name:
        return {"ok": False, "error": "company_name is required"}

    profiles = {}
    with DDGS() as ddgs:
        for platform, site_filter in PLATFORMS.items():
            query = f'"{company_name}" {site_filter}'
            try:
                results = ddgs.text(query, max_results=3)
                profiles[platform] = {
                    "found":    len(results) > 0,
                    "links":    [r["href"] for r in results if r.get("href")],
                    "snippets": [r.get("body", "") for r in results],
                }
            except Exception as e:
                profiles[platform] = {"found": False, "links": [], "error": str(e)}
            time.sleep(0.4)

    return {
        "ok": True,
        "data": {
            "company_name":    company_name,
            "platforms_found": sum(1 for p in profiles.values() if p.get("found")),
            "profiles":        profiles,
        }
    }


if __name__ == "__main__":
    print(json.dumps(check_social_profiles("10x construction"), indent=2))
