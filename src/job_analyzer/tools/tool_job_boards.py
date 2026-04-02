"""
TOOL: Check if a job posting appears on trusted job boards.
100% free — DuckDuckGo search, no API key.

Verdict logic:
  3+ boards → strong_presence   (likely legitimate)
  1-2 boards → moderate_presence
  0 boards   → not_found        (red flag)
"""
import sys, json, time
from ddgs import DDGS
sys.path.insert(0, "..")

JOB_BOARDS = {
    "linkedin_jobs": "site:linkedin.com/jobs",
    "indeed":        "site:indeed.com",
    "glassdoor":     "site:glassdoor.com",
    "naukri":        "site:naukri.com",
    "foundit":       "site:foundit.in",
    "wellfound":     "site:wellfound.com",
    "shine":         "site:shine.com",
    "instahyre":     "site:instahyre.com",
}

def check_job_boards(job_title: str, company_name: str, location: str = None) -> dict:
    """
    INPUT : job_title, company_name, optional location
    OUTPUT: {ok, data: {boards_found, verdict, boards}}

    Test: python tool_job_boards.py
    """
    if not job_title or not company_name:
        return {"ok": False, "error": "job_title and company_name are required"}

    base = f'"{job_title}" "{company_name}"'
    if location:
        base += f' "{location}"'

    board_results = {}
    with DDGS() as ddgs:
        for board, site_filter in JOB_BOARDS.items():
            try:
                results = ddgs.text(f"{base} {site_filter}", max_results=3)
                board_results[board] = {
                    "found":   len(results) > 0,
                    "results": [{"title": r.get("title"), "url": r.get("href"),
                                 "snippet": r.get("body")} for r in results],
                }
            except Exception as e:
                board_results[board] = {"found": False, "results": [], "error": str(e)}
            time.sleep(0.4)

    found_count = sum(1 for b in board_results.values() if b.get("found"))

    return {
        "ok": True,
        "data": {
            "job_title":    job_title,
            "company_name": company_name,
            "location":     location,
            "boards_found": found_count,
            "verdict":      "strong_presence"   if found_count >= 3 else
                            "moderate_presence" if found_count >= 1 else
                            "not_found_on_boards",
            "boards":       board_results,
        }
    }


if __name__ == "__main__":
    print(json.dumps(
        check_job_boards("Backend Python Developer", "Infosys", "Chennai"), indent=2))
