"""
TOOL: Company summary from Wikipedia REST API.

Strategy:
  1. Try direct slug:  /page/summary/Company_Name
  2. On 404, fallback: opensearch → best title → summary
"""
import sys, json, requests
sys.path.insert(0, "..")
try:
    from .. import config
except ImportError:
    import config


def get_company_wikipedia(company_name: str) -> dict:
    """
    INPUT : company name string
    OUTPUT: {ok, data: {title, description, extract, wikipedia_url, thumbnail_url}}

    Test: python tool_company_wikipedia.py
    """
    if not company_name:
        return {"ok": False, "error": "company_name is required"}

    slug = company_name.strip().replace(" ", "_")
    SUMMARY_BASE = "https://en.wikipedia.org/api/rest_v1/page/summary"

    def _fetch(title):
        return requests.get(f"{SUMMARY_BASE}/{title}",
                            params={"redirect": "true"},
                            headers=config.REQUEST_HEADERS,
                            timeout=config.REQUEST_TIMEOUT)
    try:
        res = _fetch(slug)

        if res.status_code == 404:
            sr = requests.get("https://en.wikipedia.org/w/api.php",
                              params={"action": "opensearch", "format": "json",
                                      "limit": 1, "search": company_name},
                              headers=config.REQUEST_HEADERS,
                              timeout=config.REQUEST_TIMEOUT)
            sr.raise_for_status()
            data = sr.json()
            if len(data) >= 2 and data[1]:
                res = _fetch(data[1][0].replace(" ", "_"))
            else:
                return {"ok": False, "error": "Not found on Wikipedia"}

        res.raise_for_status()
        p = res.json()
        return {
            "ok": True,
            "data": {
                "title":         p.get("title"),
                "description":   p.get("description"),
                "extract":       p.get("extract"),
                "wikipedia_url": p.get("content_urls", {}).get("desktop", {}).get("page"),
                "thumbnail_url": p.get("thumbnail", {}).get("source"),
            }
        }
    except Exception as e:
        return {"ok": False, "error": str(e)}


if __name__ == "__main__":
    print(json.dumps(get_company_wikipedia("Infosys"), indent=2))
