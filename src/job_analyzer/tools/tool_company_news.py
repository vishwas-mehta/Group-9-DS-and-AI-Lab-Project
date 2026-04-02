"""
TOOL: Fetch recent news about a company via DuckDuckGo News.
100% free — no API key needed.

Uses DDGS().news() which returns structured news articles with:
  date, title, url, source, body
"""
import sys, json, time
from ddgs import DDGS
sys.path.insert(0, "..")

def search_company_news(company_name: str, max_results: int = 8) -> dict:
    """
    Fetch recent news about the company.

    INPUT : company name, optional max_results (default 8)
    OUTPUT: {ok, data: {company_name, articles: [{date,title,url,source,snippet}]}}

    Useful for: funding news, layoffs, fraud cases, press coverage.
    Test: python tool_company_news.py
    """
    if not company_name:
        return {"ok": False, "error": "company_name is required"}

    articles = []
    try:
        with DDGS() as ddgs:
            raw = ddgs.news(f'"{company_name}"', max_results=max_results)
            articles = [
                {
                    "date":    r.get("date"),
                    "title":   r.get("title"),
                    "url":     r.get("url"),
                    "source":  r.get("source"),
                    "snippet": r.get("body"),
                }
                for r in raw
            ]
    except Exception as e:
        return {"ok": False, "error": str(e), "data": {"company_name": company_name}}

    return {
        "ok": True,
        "data": {
            "company_name": company_name,
            "total_articles": len(articles),
            "articles": articles,
        }
    }


if __name__ == "__main__":
    print(json.dumps(search_company_news("Infosys"), indent=2))
