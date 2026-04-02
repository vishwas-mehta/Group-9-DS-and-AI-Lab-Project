# Job Posting Analyzer — Step 1: Free Evidence Layer

**Zero API keys. Zero paid services. 100% free.**

## Architecture

```
Job Posting Text
      │
      ▼
 run.py (Step 1)
  ├── tool_extract_job_details   → spaCy NER + phonenumbers
  ├── tool_company_wikipedia     → Wikipedia REST API (free)
  ├── tool_company_web_search    → DuckDuckGo multi-angle search
  ├── tool_company_news          → DuckDuckGo News
  ├── tool_email_verify          → email-validator + DNS MX
  ├── tool_domain_reputation     → python-whois
  ├── tool_website_verify        → requests HTTP check
  ├── tool_website_content       → trafilatura (clean text extraction)
  ├── tool_social_profiles       → DuckDuckGo platform search
  ├── tool_job_boards            → DuckDuckGo job board search
  ├── tool_scam_signals          → keyword scoring
  └── tool_phone_check           → phonenumbers library
      │
      ▼
evidence_output.json  +  llm_prompt.txt
      │
      ▼
Step 2: Gemini / Perplexity / ChatGPT → Final Report
```

## Setup (2 commands)

```bash
pip install -r requirements.txt
python -m spacy download en_core_web_sm
```

## Run

```bash
cd job_analyzer
python run.py
# outputs: evidence_output.json + llm_prompt.txt
```

## Test any single tool

```bash
python tools/tool_extract_job_details.py
python tools/tool_email_verify.py
python tools/tool_domain_reputation.py
python tools/tool_website_verify.py
python tools/tool_website_content.py
python tools/tool_company_wikipedia.py
python tools/tool_company_web_search.py
python tools/tool_company_news.py
python tools/tool_social_profiles.py
python tools/tool_job_boards.py
python tools/tool_scam_signals.py
python tools/tool_phone_check.py
```

## Integrate Gemini/Perplexity research (optional)

In run.py, fill the `gemini_data` dict with your Perplexity findings:
```python
gemini_data = {
    "company_founded": "1981",
    "glassdoor_rating": "3.9/5",
    "perplexity_summary": "Infosys is a multinational IT company..."
}
result = run_all_tools(raw, gemini_enrichment=gemini_data)
```
This merges your research with the automated evidence before LLM Step 2.

## All tools return this structure

```json
{ "ok": true,  "data": { ... } }
{ "ok": false, "error": "reason" }
```
