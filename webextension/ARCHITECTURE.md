# 🏗️ Extension Architecture

## Data Flow

```
LinkedIn Page (DOM)
    │
    ▼
content.js ──── Scrapes job data ────┐
    │                                │
    │  Button click triggers flow    │
    │                                ▼
    │                         jobData object
    │                          {title, company,
    │                           description, ...}
    │                                │
    │   chrome.runtime.sendMessage() │
    │                                ▼
background.js ──── Receives message ─┐
    │                                │
    │   1. Reads API key from        │
    │      chrome.storage.local      │
    │   2. Builds structured prompt  │
    │   3. Calls Gemini API          │
    │                                ▼
    │                         Gemini Response
    │                          {verdict, confidence,
    │                           reasons, summary, tips}
    │                                │
    │   sendResponse()               │
    │                                ▼
content.js ──── Displays overlay ────┘
    │
    ▼
Results Panel (DOM overlay on LinkedIn)
```

## File Responsibilities

| File | Role | Runs In |
|------|------|---------|
| `manifest.json` | Extension config, permissions, script registration | Chrome |
| `content.js` | Button injection, DOM scraping, overlay rendering | LinkedIn page |
| `content.css` | Styles for button and overlay (injected into LinkedIn) | LinkedIn page |
| `background.js` | Gemini API communication, prompt engineering | Service worker |
| `popup.html/css/js` | API key settings UI | Extension popup |

## Swapping the AI Backend

To replace Gemini with your agentic flow, modify only `background.js`:

```javascript
// Replace this function:
async function callGeminiAPI(apiKey, prompt) { ... }

// With your agentic call:
async function callAgenticPipeline(apiKey, prompt) {
    // Your multi-agent orchestration here
    // Must return: { verdict, confidence, reasons, summary, tips }
}
```

The content script doesn't care HOW the analysis is done — it only cares about the response shape.
