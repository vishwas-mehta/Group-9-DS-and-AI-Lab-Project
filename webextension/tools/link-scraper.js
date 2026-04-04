// ============================================================
// Link Scraper Tool
// Fetches external URLs and extracts their text content.
// Works within the Chrome extension service worker context.
// ============================================================

import { BaseTool, ToolResult } from "../lib/langchain-core.js";
import { TextExtractor } from "./text-extractor.js";

/**
 * Retry configuration for fetch operations.
 * External URLs can be flaky — we retry with exponential backoff.
 */
const RETRY_CONFIG = {
    maxRetries: 2,
    initialDelayMs: 500,
    backoffMultiplier: 2,
    retryableStatusCodes: [408, 429, 500, 502, 503, 504],
};

/**
 * User-Agent string to use when fetching external pages.
 * Some sites block requests without a proper user agent.
 */
const USER_AGENT =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

/**
 * Content types that we can meaningfully extract text from.
 */
const SUPPORTED_CONTENT_TYPES = [
    "text/html",
    "text/plain",
    "text/xml",
    "application/xhtml+xml",
    "application/xml",
    "application/json",
];

/**
 * LinkScraperTool — Fetches external URLs found in job descriptions
 * and extracts their text content for analysis.
 * 
 * This tool handles:
 * - Parallel fetching with concurrency limits
 * - Retry with exponential backoff
 * - Content type validation
 * - Timeout enforcement
 * - Error isolation (one failed link doesn't break the pipeline)
 * 
 * Input: { jobData, links, config }
 * Output: { jobData, links, scrapedContent }
 */
export class LinkScraperTool extends BaseTool {
    constructor() {
        super({
            name: "link_scraper",
            description:
                "Fetches external URLs and extracts text content for enriching job analysis",
            version: "1.0.0",
            requiredInputFields: ["links"],
            outputFields: ["jobData", "links", "scrapedContent"],
            cacheable: true,
        });
    }

    /**
     * @param {Object} input
     * @param {Object} input.jobData - Original job data
     * @param {Object[]} input.links - Links to scrape from DetectLinksTool
     * @param {Object} [input.config] - Pipeline configuration
     * @param {Object} context
     * @returns {Promise<ToolResult>}
     */
    async _execute(input, context) {
        const { jobData, links, config = {} } = input;
        const timeoutMs = config.linkTimeoutMs || 10000;
        const maxConcurrent = 3; // Max parallel fetches

        if (!links || links.length === 0) {
            return ToolResult.ok(
                {
                    jobData,
                    links: [],
                    scrapedContent: [],
                },
                { message: "No links to scrape" }
            );
        }

        console.log(
            `[LinkScraperTool] Scraping ${links.length} links (timeout: ${timeoutMs}ms)`
        );

        // Process links in batches for controlled concurrency
        const scrapedContent = [];
        const batches = this._createBatches(links, maxConcurrent);

        for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
            const batch = batches[batchIdx];
            console.log(
                `[LinkScraperTool] Processing batch ${batchIdx + 1}/${batches.length} (${batch.length} links)`
            );

            // Process batch in parallel
            const batchResults = await Promise.allSettled(
                batch.map((link) =>
                    this._scrapeLink(link, timeoutMs)
                )
            );

            // Collect results
            for (let i = 0; i < batchResults.length; i++) {
                const result = batchResults[i];
                const link = batch[i];

                if (result.status === "fulfilled") {
                    scrapedContent.push(result.value);
                } else {
                    scrapedContent.push({
                        url: link.url,
                        success: false,
                        error: result.reason?.message || "Unknown error",
                        content: null,
                        metadata: {},
                    });
                }
            }
        }

        // Calculate stats
        const successCount = scrapedContent.filter((s) => s.success).length;
        const failCount = scrapedContent.filter((s) => !s.success).length;
        const totalContentLength = scrapedContent
            .filter((s) => s.success && s.content)
            .reduce((total, s) => total + s.content.length, 0);

        console.log(
            `[LinkScraperTool] Completed: ${successCount} succeeded, ${failCount} failed, ${totalContentLength} total chars`
        );

        return ToolResult.ok(
            {
                jobData,
                links,
                scrapedContent,
            },
            {
                successCount,
                failCount,
                totalContentLength,
                linksProcessed: links.length,
            }
        );
    }

    /**
     * Scrape a single link — fetch, validate, extract text.
     * 
     * @param {Object} link - Link object from DetectLinksTool
     * @param {number} timeoutMs - Fetch timeout
     * @returns {Promise<Object>} Scraped content result
     */
    async _scrapeLink(link, timeoutMs) {
        const url = link.url;
        const startTime = performance.now();

        console.log(`[LinkScraperTool] Fetching: ${url.substring(0, 80)}`);

        try {
            // Fetch with timeout and retry
            const html = await this._fetchWithRetry(url, timeoutMs);

            // Extract text content
            const extracted = TextExtractor.extract(html, {
                maxLength: 8000,
                preserveStructure: true,
                extractMetadata: true,
            });

            const fetchTime = Math.round(performance.now() - startTime);

            if (!extracted.success || !extracted.text) {
                return {
                    url,
                    success: false,
                    error: extracted.error || "No content extracted",
                    content: null,
                    metadata: { fetchTimeMs: fetchTime },
                };
            }

            console.log(
                `[LinkScraperTool] ✓ ${url.substring(0, 50)}: ${extracted.wordCount} words in ${fetchTime}ms`
            );

            return {
                url,
                success: true,
                content: extracted.text,
                metadata: {
                    ...extracted.metadata,
                    fetchTimeMs: fetchTime,
                    wordCount: extracted.wordCount,
                    contentLength: extracted.text.length,
                    category: link.category || "unknown",
                    hasJobContent: extracted.hasJobContent(),
                },
                error: null,
            };
        } catch (error) {
            const fetchTime = Math.round(performance.now() - startTime);

            console.warn(
                `[LinkScraperTool] ✗ ${url.substring(0, 50)}: ${error.message}`
            );

            return {
                url,
                success: false,
                error: error.message,
                content: null,
                metadata: {
                    fetchTimeMs: fetchTime,
                    category: link.category || "unknown",
                },
            };
        }
    }

    /**
     * Fetch a URL with retry and exponential backoff.
     * 
     * @param {string} url
     * @param {number} timeoutMs
     * @returns {Promise<string>} HTML content
     */
    async _fetchWithRetry(url, timeoutMs) {
        let lastError;

        for (let attempt = 0; attempt <= RETRY_CONFIG.maxRetries; attempt++) {
            try {
                // Exponential backoff for retries
                if (attempt > 0) {
                    const delay =
                        RETRY_CONFIG.initialDelayMs *
                        Math.pow(RETRY_CONFIG.backoffMultiplier, attempt - 1);
                    console.log(
                        `[LinkScraperTool] Retry ${attempt}/${RETRY_CONFIG.maxRetries} for ${url.substring(0, 50)} (delay: ${delay}ms)`
                    );
                    await this._sleep(delay);
                }

                // Create abort controller for timeout
                const controller = new AbortController();
                const timeoutId = setTimeout(
                    () => controller.abort(),
                    timeoutMs
                );

                const response = await fetch(url, {
                    method: "GET",
                    headers: {
                        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                        "Accept-Language": "en-US,en;q=0.9",
                        "Cache-Control": "no-cache",
                    },
                    signal: controller.signal,
                    redirect: "follow",
                });

                clearTimeout(timeoutId);

                // Check status
                if (!response.ok) {
                    if (
                        RETRY_CONFIG.retryableStatusCodes.includes(
                            response.status
                        )
                    ) {
                        throw new RetryableError(
                            `HTTP ${response.status}: ${response.statusText}`
                        );
                    }
                    throw new Error(
                        `HTTP ${response.status}: ${response.statusText}`
                    );
                }

                // Validate content type
                const contentType =
                    response.headers.get("content-type") || "";
                const isSupported = SUPPORTED_CONTENT_TYPES.some((type) =>
                    contentType.toLowerCase().includes(type)
                );

                if (!isSupported) {
                    throw new Error(
                        `Unsupported content type: ${contentType}`
                    );
                }

                // Check content length (skip huge pages)
                const contentLength = response.headers.get("content-length");
                if (contentLength && parseInt(contentLength) > 5_000_000) {
                    throw new Error(
                        `Content too large: ${contentLength} bytes`
                    );
                }

                const html = await response.text();

                // Validate we got meaningful content
                if (!html || html.trim().length < 50) {
                    throw new Error("Empty or minimal response body");
                }

                return html;
            } catch (error) {
                lastError = error;

                // Only retry on retryable errors
                if (
                    !(error instanceof RetryableError) &&
                    error.name !== "AbortError"
                ) {
                    throw error;
                }

                // If it's an abort (timeout), wrap error
                if (error.name === "AbortError") {
                    lastError = new Error(
                        `Fetch timeout after ${timeoutMs}ms`
                    );
                    if (attempt >= RETRY_CONFIG.maxRetries) {
                        throw lastError;
                    }
                }
            }
        }

        throw lastError || new Error("Max retries exceeded");
    }

    /**
     * Split an array into batches of a given size.
     * @param {Array} items
     * @param {number} batchSize
     * @returns {Array[]}
     */
    _createBatches(items, batchSize) {
        const batches = [];
        for (let i = 0; i < items.length; i += batchSize) {
            batches.push(items.slice(i, i + batchSize));
        }
        return batches;
    }

    /**
     * Sleep helper for retry backoff.
     * @param {number} ms
     * @returns {Promise<void>}
     */
    _sleep(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}

/**
 * Custom error class for retryable fetch errors.
 */
class RetryableError extends Error {
    constructor(message) {
        super(message);
        this.name = "RetryableError";
    }
}
