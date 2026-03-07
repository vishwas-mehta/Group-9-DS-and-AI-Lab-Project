# ⚡ Quick Setup Guide

## Prerequisites
- Google Chrome browser (v88+ for Manifest V3 support)
- A Google Gemini API key ([Get one free here](https://aistudio.google.com/app/apikey))

## Installation (30 seconds)

1. **Download** this repository or clone it:
   ```bash
   git clone https://github.com/hrmiitm/Group-9-DS-and-AI-Lab-Project.git
   ```

2. **Open Chrome** and go to:
   ```
   chrome://extensions
   ```

3. **Enable Developer Mode** — toggle in the top-right corner

4. **Click "Load unpacked"** — select the `webextension/` folder from this repo

5. **Click the extension icon** (🛡️) in Chrome toolbar → paste your Gemini API key → Save

6. **Navigate to LinkedIn** → open any job listing → click **"🔍 Analyze Job"**!

## That's it! 🎉

The extension will analyze the job listing and show you:
- ✅ **Safe to Apply** — Job looks legitimate
- ⚠️ **Suspicious** — Some red flags detected
- ❌ **Likely Fake** — Multiple red flags, proceed with caution

## API Key Notes
- Free tier: 15 requests/minute, 1M tokens/day
- Key is stored locally in your browser (never shared)
- You can change the key anytime via the extension popup
