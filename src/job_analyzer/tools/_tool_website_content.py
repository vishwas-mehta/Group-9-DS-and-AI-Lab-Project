"""
Under Maintanace

TOOL: Extract clean text + metadata from any website.
100% free — trafilatura handles all HTML parsing internally.

trafilatura removes ads, navbars, footers automatically.
Docs: https://trafilatura.readthedocs.io/
"""
import sys, json
import trafilatura
from trafilatura import fetch_url, extract, extract_metadata
sys.path.insert(0, "..")

def extract_website_content(url: str) -> dict:
    """
    Fetch a URL and extract its main content and structured metadata.
    No HTML parsing needed — trafilatura does it all.

    INPUT : url string
    OUTPUT: {ok, data: {url, extracted_text, word_count, metadata}}

    Test: python tool_website_content.py
    """
    if not url:
        return {"ok": False, "error": "url is required"}

    if not url.strip().startswith(("http://", "https://")):
        url = "https://" + url.strip()

    try:
        downloaded = fetch_url(url)
        if not downloaded:
            return {"ok": False, "error": "Could not fetch page", "data": {"url": url}}

        text = extract(downloaded, include_links=False,
                       include_images=False, include_tables=True)
        meta = extract_metadata(downloaded)

        meta_dict = {}
        if meta:
            meta_dict = {
                "title":       meta.title,
                "description": meta.description,
                "author":      meta.author,
                "sitename":    meta.sitename,
                "date":        meta.date,
                "language":    meta.language,
                "categories":  meta.categories,
                "tags":        meta.tags,
            }

        return {
            "ok": True,
            "data": {
                "url":            url,
                "extracted_text": text,
                "word_count":     len(text.split()) if text else 0,
                "metadata":       meta_dict,
            }
        }
    except Exception as e:
        return {"ok": False, "error": str(e), "data": {"url": url}}


if __name__ == "__main__":
    r = extract_website_content("https://infosys.com")
    if r["ok"] and r["data"]["extracted_text"]:
        r["data"]["extracted_text"] = r["data"]["extracted_text"][:500] + "..."
    print(json.dumps(r, indent=2))
