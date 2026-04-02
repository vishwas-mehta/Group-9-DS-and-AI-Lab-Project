"""
TOOL: Multi-angle DuckDuckGo search for company intel.
100% free — no API key, uses duckduckgo-search library.

Runs 5 targeted queries covering:
  general info, employee reviews, scam/fraud signals,
  Glassdoor presence, news mentions.
"""
import sys, json, time
from ddgs import DDGS
sys.path.insert(0, "..")

SEARCH_ANGLES = {
    "general_info":   '"{}" company founded headquarters about',
    "employee_review":'"{}" company employee reviews work culture',
    "scam_fraud":     '"{}" scam fraud fake complaint cheating',
    "glassdoor":      '"{}" site:glassdoor.com',
    "linkedin_page":  '"{}" site:linkedin.com/company',
}

def search_company_web(company_name: str) -> dict:
    """
    Run 5 DDG searches for the company and return collected snippets.

    INPUT : company name
    OUTPUT: {ok, data: {company_name, searches: {angle: [{title,url,snippet}]}}}

    LLM will use the snippets to assess legitimacy, culture, and reputation.
    Test: python tool_company_web_search.py
    """
    if not company_name:
        return {"ok": False, "error": "company_name is required"}

    searches = {}
    with DDGS() as ddgs:
        for angle, query_tmpl in SEARCH_ANGLES.items():
            query = query_tmpl.format(company_name)
            try:
                results = ddgs.text(query, max_results=4)
                searches[angle] = [
                    {"title": r.get("title"), "url": r.get("href"), "snippet": r.get("body")}
                    for r in results
                ]
            except Exception as e:
                searches[angle] = [{"error": str(e)}]
            time.sleep(0.4)

    return {
        "ok": True,
        "data": {
            "company_name": company_name,
            "searches": searches,
        }
    }


if __name__ == "__main__":
    print(json.dumps(search_company_web("Infosys"), indent=2))
