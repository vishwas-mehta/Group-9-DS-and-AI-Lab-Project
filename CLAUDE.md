# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Webetention is a two-track fraud job posting detection system:
1. **Python backend**: Fine-tuned RoBERTa-base model + 12-tool free evidence pipeline
2. **JavaScript frontend**: Chrome MV3 extension with LangChain-inspired pipeline + Gemini AI

The model weights are published on HuggingFace as `aditya963/fraud-job-classifier`.

## Commands

### Python ML Pipeline

```bash
# Install Python dependencies
pip install -r requirements.txt
python -m spacy download en_core_web_sm  # Required for spaCy NER

# Train the RoBERTa model
python src/train.py --data_path data/fake_job_postings.csv --output_dir models/roberta-focal-best

# Evaluate / single inference
python src/eval.py --model_dir models/roberta-focal-best --data_path data/fake_job_postings.csv
python src/eval.py --model_dir models/roberta-focal-best --infer

# Run the free evidence pipeline on a job document
cd src/job_analyzer
python run.py path/to/job_posting.pdf
# Outputs: evidence_output.json + llm_prompt.txt

# Test individual evidence tools
python src/job_analyzer/tools/tool_email_verify.py
python src/job_analyzer/tools/tool_domain_reputation.py
```

### Chrome Extension

No build step — the extension uses vanilla ES modules loaded directly by the browser.

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** → select the `webextension/` directory
4. Open the extension popup and paste a Gemini API key

## Architecture

### Python ML Stack

- **Data** (`src/utils/data.py`): Loads the Kaggle Fake Job Postings CSV (17,880 samples, 4.8% fraud). Features are built by concatenating metadata + free-text fields with `[SEP]` tokens. Stratified 70/15/15 split.
- **Model** (`src/train.py`): `roberta-base` fine-tuned with Focal Loss (gamma=1.69, fraud weight=2.83), AdamW + cosine LR scheduler. Hyperparameters Optuna-tuned over 25 trials. Best threshold: 0.87 (calibrated on test set).
- **Evaluation** (`src/eval.py`): Generates F1/Precision/Recall/ROC-AUC/MCC metrics, threshold sweep, confusion matrix, and ROC/PR curve plots.

### Free Evidence Pipeline (`src/job_analyzer/`)

12 tool chain that requires **no API keys**:

| Stage | Tools | Method |
|-------|-------|--------|
| Extract | `tool_extract_job_details` | spaCy NER + phonenumbers |
| Verify email & domain | `tool_email_verify`, `tool_domain_reputation` | DNS MX + WHOIS |
| Company research | `tool_company_wikipedia`, `tool_company_web_search`, `tool_company_news` | Wikipedia API + DuckDuckGo |
| Website | `tool_website_verify`, `tool_website_content` | HTTP + trafilatura |
| Social/boards | `tool_social_profiles`, `tool_job_boards` | DuckDuckGo |
| Signal scoring | `tool_phone_check`, `tool_scam_signals` | phonenumbers + keyword scoring |

`run.py` orchestrates all 12 tools and writes `evidence_output.json` + `llm_prompt.txt` (ready for Step 2 manual LLM review).

### Chrome Extension (`webextension/`)

**Data flow:** LinkedIn DOM → `content.js` scrapes → `background.js` service worker orchestrates tools → Gemini API → verdict overlay injected by `content.js`.

**Custom framework** (`webextension/lib/`):
- `langchain-core.js`: `BaseTool` (timing, caching, validation), `ToolRegistry`, `Chain`, `ToolResult`
- `pipeline.js`: `PipelineConfig` (Standard/Quick/Deep modes), `PipelineBuilder`, `ContentAggregatorTool`

**Tool pipeline** (`webextension/tools/`):
1. `DetectLinksTool` — regex URL extraction + categorization (job board / career / social / form)
2. `LinkScraperTool` — parallel fetch (concurrency=3) with retry/backoff
3. `TextExtractor` — HTML → clean text, JSON-LD extraction
4. `JobAnalyzerTool` — builds prompt with 30-point red flag taxonomy, calls Gemini, parses JSON verdict

**Analysis modes** (configured in `background.js`):
- **Quick**: No link scraping, brief prompt
- **Standard**: Scrape 5 links, thorough prompt
- **Deep**: Scrape 10 links, exhaustive prompt

**Verdicts**: `SAFE` / `SUSPICIOUS` / `LIKELY_FAKE` with confidence score, summary, key findings, and actionable tips rendered as a slide-in overlay panel.

**Settings**: Gemini API key stored via `chrome.storage.local`, managed in `popup.html/js`.

### LangChain ReAct Agent (`AgenticWork/` and `src/job_analyzer/job_parser_agent.py`)

Extracts 18 structured features from multi-format job documents (PDF, DOCX, HTML, MD, TXT) using LangChain ReAct. Separate `requirements.txt` in `AgenticWork/` includes `langchain`, `langchain-openai`, `docx2txt`, `pypdf`, `unstructured`.

## Key Configuration

- `src/job_analyzer/config.py`: `REQUEST_TIMEOUT=20`, `DEFAULT_PHONE_REGION="IN"`, User-Agent header
- `webextension/manifest.json`: MV3, host permissions include `https://*/*` for link scraping and `https://generativelanguage.googleapis.com/*` for Gemini
- Model hyperparameters (LR=2.59e-05, batch=16, threshold=0.87) are in `src/train.py` — sourced from Optuna trial 18
