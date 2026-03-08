// ============================================================
// Background Service Worker — Pipeline Orchestrator
// This is the central hub. It receives job data from the content
// script, runs the LangChain-inspired analysis pipeline, and
// returns results.
//
// Architecture:
//   content.js → sendMessage → background.js → Pipeline → Gemini
//                                                  ↓
//   content.js ← sendResponse ← background.js ← Results
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

// ============================================================
// Tool Registry Setup — Register all tools at startup
// ============================================================

const registry = new ToolRegistry();

// Register core tools
registry.register(new DetectLinksTool(), "scraping");
registry.register(new LinkScraperTool(), "scraping");
registry.register(new ContentAggregatorTool(), "processing");
registry.register(new JobAnalyzerTool(), "analysis");

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

    console.log("[Background] Starting standard analysis for:", jobData.title);

    // Build pipeline with standard config
    const config = new PipelineConfig({
        enableLinkScraping: true,
        maxLinksToScrape: 5,
        linkTimeoutMs: 10000,
        analysisDepth: "standard",
    });

    const pipeline = PipelineBuilder.createDefault(registry, config);

    // Log pipeline description
    console.log("[Background] Pipeline:\n" + pipeline.describe());

    // Send progress updates to content script
    const tabId = sender.tab?.id;
    if (tabId) {
        pipeline.onStepStart = ({ stepIndex, stepLabel, totalSteps }) => {
            sendProgressUpdate(tabId, {
                step: stepIndex + 1,
                totalSteps,
                label: stepLabel,
                status: "running",
            });
        };

        pipeline.onStepComplete = ({ stepIndex, stepLabel, totalSteps, result }) => {
            sendProgressUpdate(tabId, {
                step: stepIndex + 1,
                totalSteps,
                label: stepLabel,
                status: result.success ? "complete" : "failed",
            });
        };
    }

    // Run the pipeline
    const chainResult = await pipeline.run(
        { jobData, domLinks },
        { tabId, url: sender.tab?.url }
    );

    if (!chainResult.success) {
        throw new Error(chainResult.error);
    }

    // Return the analysis result
    return chainResult.data;
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

    console.log("[Background] Starting QUICK analysis for:", jobData.title);

    const config = PipelineConfig.quick();

    // Build pipeline without link scraping
    const pipeline = new PipelineBuilder(registry, config)
        .withLinkDetection()
        // Skip link scraping
        .withContentAggregation()
        .withJobAnalysis()
        .build("quick_analysis_pipeline");

    const chainResult = await pipeline.run(
        { jobData, domLinks: [] },
        { tabId: sender.tab?.id }
    );

    if (!chainResult.success) {
        throw new Error(chainResult.error);
    }

    return chainResult.data;
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

    console.log("[Background] Starting DEEP analysis for:", jobData.title);

    const config = PipelineConfig.deep();

    const pipeline = PipelineBuilder.createDefault(registry, config);

    // Send progress updates
    const tabId = sender.tab?.id;
    if (tabId) {
        pipeline.onStepStart = ({ stepIndex, stepLabel, totalSteps }) => {
            sendProgressUpdate(tabId, {
                step: stepIndex + 1,
                totalSteps,
                label: stepLabel,
                status: "running",
            });
        };
    }

    const chainResult = await pipeline.run(
        { jobData, domLinks },
        { tabId, url: sender.tab?.url }
    );

    if (!chainResult.success) {
        throw new Error(chainResult.error);
    }

    return chainResult.data;
}

// ============================================================
// Utility Functions
// ============================================================

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
