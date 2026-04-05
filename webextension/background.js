// ============================================================
// Background Service Worker — Pipeline Orchestrator
//
// New parallel architecture:
//   content.js → sendMessage → background.js
//       ├── RoBERTaTool (HF Inference API)  ─┐ parallel
//       └── DetectLinks → Scrape → Aggregate ┘
//                    ↓ (both complete)
//              JobAnalyzerTool (Gemini)
//              receives: RoBERTa score + scraped evidence
//                    ↓
//   content.js ← sendResponse ← Results
// ============================================================

import { ToolRegistry } from "./lib/langchain-core.js";
import {
    PipelineBuilder,
    PipelineConfig,
    ContentAggregatorTool,
} from "./lib/pipeline.js";
import { DetectLinksTool } from "./tools/link-detector.js";
import { LinkScraperTool } from "./tools/link-scraper.js";
import { JobAnalyzerTool } from "./tools/job-analyzer-tool.js";
import { RoBERTaTool } from "./tools/roberta-tool.js";

// ============================================================
// Tool Registry Setup — Register all tools at startup
// ============================================================

const registry = new ToolRegistry();

// Register core tools
registry.register(new DetectLinksTool(), "scraping");
registry.register(new LinkScraperTool(), "scraping");
registry.register(new ContentAggregatorTool(), "processing");
registry.register(new JobAnalyzerTool(), "analysis");
registry.register(new RoBERTaTool(), "ml");

console.log("[Background] Tool registry initialized:");
console.log("[Background] Registered tools:", registry.listTools());

// ============================================================
// Message Handlers
// ============================================================

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    switch (request.type) {
        case "ANALYZE_JOB":
            handleAnalyzeJob(request.data, sender)
                .then((result) => sendResponse({ success: true, data: result }))
                .catch((error) =>
                    sendResponse({ success: false, error: error.message })
                );
            return true; // Keep message channel open for async response

        case "ANALYZE_JOB_QUICK":
            handleAnalyzeJobQuick(request.data, sender)
                .then((result) => sendResponse({ success: true, data: result }))
                .catch((error) =>
                    sendResponse({ success: false, error: error.message })
                );
            return true;

        case "ANALYZE_JOB_DEEP":
            handleAnalyzeJobDeep(request.data, sender)
                .then((result) => sendResponse({ success: true, data: result }))
                .catch((error) =>
                    sendResponse({ success: false, error: error.message })
                );
            return true;

        case "GET_PIPELINE_STATUS":
            sendResponse({
                success: true,
                data: {
                    tools: registry.listTools(),
                    stats: registry.getAllStats(),
                },
            });
            return false;

        case "GET_TOOL_STATS":
            sendResponse({
                success: true,
                data: registry.getAllStats(),
            });
            return false;

        default:
            console.warn("[Background] Unknown message type:", request.type);
            sendResponse({
                success: false,
                error: `Unknown message type: ${request.type}`,
            });
            return false;
    }
});

// ============================================================
// Pipeline Execution Handlers
// ============================================================

/**
 * Standard analysis — detects links, scrapes them, aggregates, analyzes.
 * 
 * @param {Object} data - Job data + DOM links from content script
 * @param {Object} sender - Chrome sender info
 * @returns {Promise<Object>}
 */
async function handleAnalyzeJob(data, sender) {
    const { jobData, domLinks = [] } = data;
    const tabId = sender.tab?.id;

    console.log("[Background] Starting standard analysis for:", jobData.title);

    const config = new PipelineConfig({
        enableLinkScraping: true,
        maxLinksToScrape: 5,
        linkTimeoutMs: 10000,
        analysisDepth: "standard",
    });

    // Scraping-only pipeline (no JobAnalyzerTool) so we can run it in parallel with RoBERTa
    const scrapingPipeline = PipelineBuilder.createScrapingOnly(registry, config);

    if (tabId) {
        scrapingPipeline.onStepStart = ({ stepIndex, stepLabel, totalSteps }) => {
            sendProgressUpdate(tabId, {
                step: stepIndex + 1,
                totalSteps: totalSteps + 2, // +1 RoBERTa +1 Gemini
                label: stepLabel,
                status: "running",
            });
        };
    }

    sendProgressUpdate(tabId, { step: 1, totalSteps: 5, label: "Running ML model + scraping links", status: "running" });

    // ── PHASE 1: RoBERTa + link scraping in parallel ──────────────────────
    const [robertaResult, scrapingResult] = await Promise.all([
        runRoBERTa(jobData, tabId),
        scrapingPipeline.run({ jobData, domLinks }, { tabId, url: sender.tab?.url }),
    ]);

    if (!scrapingResult.success) {
        throw new Error(scrapingResult.error);
    }

    // ── PHASE 2: Gemini combines both signals ─────────────────────────────
    sendProgressUpdate(tabId, { step: 5, totalSteps: 5, label: "AI Job Legitimacy Analysis", status: "running" });

    const jobAnalyzerTool = registry.get("job_analyzer");
    const analysisResult = await jobAnalyzerTool.execute(
        {
            ...scrapingResult.data,
            robertaResult,
            config,
        },
        { tabId }
    );

    if (!analysisResult.success) {
        throw new Error(analysisResult.error);
    }

    // Attach links + robertaResult so the UI can show them
    return {
        ...analysisResult.data,
        robertaResult,
        detectedLinks: scrapingResult.data?.links || [],
        scrapedContent: scrapingResult.data?.scrapedContent || [],
    };
}

/**
 * Quick analysis — skips link scraping for faster results.
 * 
 * @param {Object} data
 * @param {Object} sender
 * @returns {Promise<Object>}
 */
async function handleAnalyzeJobQuick(data, sender) {
    const { jobData } = data;
    const tabId = sender.tab?.id;

    console.log("[Background] Starting QUICK analysis for:", jobData.title);

    const config = PipelineConfig.quick();

    // Quick scraping pipeline (link detection + aggregation, no scraping)
    const scrapingPipeline = new PipelineBuilder(registry, config)
        .withLinkDetection()
        .withContentAggregation()
        .build("quick_scraping_pipeline");

    sendProgressUpdate(tabId, { step: 1, totalSteps: 3, label: "Running ML model", status: "running" });

    const [robertaResult, scrapingResult] = await Promise.all([
        runRoBERTa(jobData, tabId),
        scrapingPipeline.run({ jobData, domLinks: [] }, { tabId }),
    ]);

    if (!scrapingResult.success) {
        throw new Error(scrapingResult.error);
    }

    sendProgressUpdate(tabId, { step: 3, totalSteps: 3, label: "AI Job Legitimacy Analysis", status: "running" });

    const jobAnalyzerTool = registry.get("job_analyzer");
    const analysisResult = await jobAnalyzerTool.execute(
        { ...scrapingResult.data, robertaResult, config },
        { tabId }
    );

    if (!analysisResult.success) {
        throw new Error(analysisResult.error);
    }

    return {
        ...analysisResult.data,
        robertaResult,
        detectedLinks: scrapingResult.data?.links || [],
        scrapedContent: scrapingResult.data?.scrapedContent || [],
    };
}

/**
 * Deep analysis — maximum link scraping and thorough AI analysis.
 * 
 * @param {Object} data
 * @param {Object} sender
 * @returns {Promise<Object>}
 */
async function handleAnalyzeJobDeep(data, sender) {
    const { jobData, domLinks = [] } = data;
    const tabId = sender.tab?.id;

    console.log("[Background] Starting DEEP analysis for:", jobData.title);

    const config = PipelineConfig.deep();

    const scrapingPipeline = PipelineBuilder.createScrapingOnly(registry, config);

    if (tabId) {
        scrapingPipeline.onStepStart = ({ stepIndex, stepLabel, totalSteps }) => {
            sendProgressUpdate(tabId, {
                step: stepIndex + 1,
                totalSteps: totalSteps + 2,
                label: stepLabel,
                status: "running",
            });
        };
    }

    sendProgressUpdate(tabId, { step: 1, totalSteps: 6, label: "Running ML model + scraping links (deep)", status: "running" });

    const [robertaResult, scrapingResult] = await Promise.all([
        runRoBERTa(jobData, tabId),
        scrapingPipeline.run({ jobData, domLinks }, { tabId, url: sender.tab?.url }),
    ]);

    if (!scrapingResult.success) {
        throw new Error(scrapingResult.error);
    }

    sendProgressUpdate(tabId, { step: 6, totalSteps: 6, label: "AI Job Legitimacy Analysis (deep)", status: "running" });

    const jobAnalyzerTool = registry.get("job_analyzer");
    const analysisResult = await jobAnalyzerTool.execute(
        { ...scrapingResult.data, robertaResult, config },
        { tabId }
    );

    if (!analysisResult.success) {
        throw new Error(analysisResult.error);
    }

    return {
        ...analysisResult.data,
        robertaResult,
        detectedLinks: scrapingResult.data?.links || [],
        scrapedContent: scrapingResult.data?.scrapedContent || [],
    };
}

// ============================================================
// Utility Functions
// ============================================================

/**
 * Run the RoBERTa ML tool, always resolving (never rejecting) so it
 * can be used safely in Promise.all alongside other pipeline steps.
 *
 * @param {Object} jobData
 * @param {number|undefined} tabId
 * @returns {Promise<Object>} robertaResult data
 */
async function runRoBERTa(jobData, tabId) {
    const robertaTool = registry.get("roberta_analyzer");
    if (!robertaTool) {
        return { skipped: true, reason: "Tool not registered" };
    }
    try {
        const result = await robertaTool.execute({ jobData }, { tabId });
        return result.data;
    } catch (err) {
        console.warn("[Background] RoBERTa error:", err.message);
        return { skipped: true, reason: err.message };
    }
}

/**
 * Send a progress update to the content script.
 * 
 * @param {number} tabId
 * @param {Object} progress
 */
function sendProgressUpdate(tabId, progress) {
    try {
        chrome.tabs.sendMessage(tabId, {
            type: "ANALYSIS_PROGRESS",
            data: progress,
        });
    } catch (error) {
        // Tab might have been closed, ignore
        console.warn("[Background] Failed to send progress update:", error);
    }
}

// ============================================================
// Extension Lifecycle Events
// ============================================================

/**
 * Handle extension installation or update.
 */
chrome.runtime.onInstalled.addListener((details) => {
    console.log("[Background] Extension installed/updated:", details.reason);

    if (details.reason === "install") {
        console.log("[Background] First install — welcome!");
    } else if (details.reason === "update") {
        console.log(
            `[Background] Updated from v${details.previousVersion} to v2.0.0`
        );
    }
});

/**
 * Handle service worker startup.
 */
console.log("[Background] Service worker started. Pipeline ready.");
console.log("[Background] Available analysis modes: standard, quick, deep");
