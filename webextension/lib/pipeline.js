// ============================================================
// Pipeline Orchestrator
// High-level factory that builds pre-configured chains
// for specific use cases (job analysis, link scraping, etc.)
// ============================================================

import {
    Chain,
    ChainStep,
    ToolRegistry,
    BaseTool,
    ToolResult,
} from "./langchain-core.js";

/**
 * PipelineConfig — Configuration options for the analysis pipeline.
 * Controls which tools run, concurrency, and behavior flags.
 */
export class PipelineConfig {
    /**
     * @param {Object} [options]
     * @param {boolean} [options.enableLinkScraping] - Whether to scrape external links
     * @param {number} [options.maxLinksToScrape] - Maximum number of links to follow
     * @param {number} [options.linkTimeoutMs] - Timeout per link fetch in ms
     * @param {boolean} [options.enableCaching] - Cache tool results
     * @param {boolean} [options.verboseLogging] - Enable detailed console logging
     * @param {string} [options.analysisDepth] - 'quick' | 'standard' | 'deep'
     * @param {number} [options.maxContentLength] - Max chars to send to AI
     */
    constructor({
        enableLinkScraping = true,
        maxLinksToScrape = 5,
        linkTimeoutMs = 10000,
        enableCaching = true,
        verboseLogging = true,
        analysisDepth = "standard",
        maxContentLength = 15000,
    } = {}) {
        this.enableLinkScraping = enableLinkScraping;
        this.maxLinksToScrape = maxLinksToScrape;
        this.linkTimeoutMs = linkTimeoutMs;
        this.enableCaching = enableCaching;
        this.verboseLogging = verboseLogging;
        this.analysisDepth = analysisDepth;
        this.maxContentLength = maxContentLength;
    }

    /**
     * Create a quick-scan config (skip link scraping).
     * @returns {PipelineConfig}
     */
    static quick() {
        return new PipelineConfig({
            enableLinkScraping: false,
            analysisDepth: "quick",
            maxContentLength: 5000,
        });
    }

    /**
     * Create a deep-scan config (more links, more content).
     * @returns {PipelineConfig}
     */
    static deep() {
        return new PipelineConfig({
            enableLinkScraping: true,
            maxLinksToScrape: 10,
            linkTimeoutMs: 15000,
            analysisDepth: "deep",
            maxContentLength: 25000,
        });
    }

    /**
     * Serialize config for logging.
     * @returns {Object}
     */
    toJSON() {
        return { ...this };
    }
}

/**
 * PipelineBuilder — Fluent builder for constructing analysis pipelines.
 * 
 * Usage:
 *   const pipeline = new PipelineBuilder(registry)
 *     .withLinkDetection()
 *     .withLinkScraping()
 *     .withJobAnalysis()
 *     .build();
 */
export class PipelineBuilder {
    /**
     * @param {ToolRegistry} registry
     * @param {PipelineConfig} [config]
     */
    constructor(registry, config = new PipelineConfig()) {
        this.registry = registry;
        this.config = config;
        this._steps = [];
        this._callbacks = {};
    }

    /**
     * Add link detection step.
     * @returns {PipelineBuilder}
     */
    withLinkDetection() {
        this._steps.push(
            new ChainStep({
                toolName: "link_detector",
                label: "Detect Links in Job Description",
                inputTransform: (input) => ({
                    jobData: input.jobData || input,
                    domLinks: input.domLinks || [],
                    config: this.config,
                }),
            })
        );
        return this;
    }

    /**
     * Add link scraping step (conditional on links being found).
     * @returns {PipelineBuilder}
     */
    withLinkScraping() {
        this._steps.push(
            new ChainStep({
                toolName: "link_scraper",
                label: "Scrape External Link Content",
                optional: true,
                condition: (input) => {
                    // Only run if link detection found links AND scraping is enabled
                    return (
                        this.config.enableLinkScraping &&
                        input?.links &&
                        input.links.length > 0
                    );
                },
                inputTransform: (input) => ({
                    ...input,
                    config: this.config,
                }),
            })
        );
        return this;
    }

    /**
     * Add content aggregation step.
     * @returns {PipelineBuilder}
     */
    withContentAggregation() {
        this._steps.push(
            new ChainStep({
                toolName: "content_aggregator",
                label: "Aggregate All Content",
                inputTransform: (input) => ({
                    ...input,
                    config: this.config,
                }),
            })
        );
        return this;
    }

    /**
     * Add AI job analysis step.
     * @returns {PipelineBuilder}
     */
    withJobAnalysis() {
        this._steps.push(
            new ChainStep({
                toolName: "job_analyzer",
                label: "AI Job Legitimacy Analysis",
                inputTransform: (input) => ({
                    ...input,
                    config: this.config,
                }),
            })
        );
        return this;
    }

    /**
     * Set step progress callback.
     * @param {Function} callback
     * @returns {PipelineBuilder}
     */
    onProgress(callback) {
        this._callbacks.onStepStart = callback;
        return this;
    }

    /**
     * Set error callback.
     * @param {Function} callback
     * @returns {PipelineBuilder}
     */
    onError(callback) {
        this._callbacks.onError = callback;
        return this;
    }

    /**
     * Build and return the configured chain.
     * @param {string} [name] - Optional chain name
     * @returns {Chain}
     */
    build(name = "job_analysis_pipeline") {
        const chain = new Chain({
            name,
            registry: this.registry,
            description:
                "Full job analysis pipeline: detect links → scrape content → aggregate → analyze with AI",
            ...this._callbacks,
        });

        for (const step of this._steps) {
            chain.addStep(step);
        }

        return chain;
    }

    /**
     * Build the default full pipeline.
     * @param {ToolRegistry} registry
     * @param {PipelineConfig} [config]
     * @returns {Chain}
     */
    static createDefault(registry, config = new PipelineConfig()) {
        return new PipelineBuilder(registry, config)
            .withLinkDetection()
            .withLinkScraping()
            .withContentAggregation()
            .withJobAnalysis()
            .build();
    }
}

/**
 * ContentAggregatorTool — Combines original job data with scraped
 * link content into a single enriched document for analysis.
 */
export class ContentAggregatorTool extends BaseTool {
    constructor() {
        super({
            name: "content_aggregator",
            description:
                "Aggregates job listing data with scraped external content into a single enriched document",
            version: "1.0.0",
            outputFields: ["enrichedJobData", "totalContentLength", "sourceCount"],
        });
    }

    /**
     * @param {Object} input
     * @param {Object} input.jobData - Original scraped job data
     * @param {Object[]} [input.scrapedContent] - Content from external links
     * @param {Object} [input.config] - Pipeline configuration
     * @param {Object} context
     * @returns {Promise<ToolResult>}
     */
    async _execute(input, context) {
        const { jobData, scrapedContent = [], config = {} } = input;
        const maxContentLength = config.maxContentLength || 15000;

        // Start with original job data
        const enrichedData = { ...jobData };
        const contentParts = [];
        let totalLength = 0;

        // Add original description
        if (jobData.description) {
            contentParts.push({
                source: "LinkedIn Job Description",
                content: jobData.description,
                type: "primary",
            });
            totalLength += jobData.description.length;
        }

        // Add company description
        if (jobData.companyDescription) {
            contentParts.push({
                source: "Company Description",
                content: jobData.companyDescription,
                type: "primary",
            });
            totalLength += jobData.companyDescription.length;
        }

        // Add scraped link content
        for (const scraped of scrapedContent) {
            if (!scraped.success || !scraped.content) continue;

            // Truncate if we're getting too long
            let content = scraped.content;
            if (totalLength + content.length > maxContentLength) {
                const remaining = maxContentLength - totalLength;
                if (remaining > 200) {
                    content = content.substring(0, remaining) + "\n[Content truncated...]";
                } else {
                    continue; // Skip this link, already at limit
                }
            }

            contentParts.push({
                source: `External Link: ${scraped.url}`,
                content: content,
                type: "external",
            });
            totalLength += content.length;
        }

        // Build the enriched description
        const enrichedDescription = contentParts
            .map((part) => {
                const divider = "─".repeat(40);
                return `\n${divider}\n📄 Source: ${part.source}\n${divider}\n${part.content}`;
            })
            .join("\n\n");

        enrichedData.enrichedDescription = enrichedDescription;
        enrichedData.originalDescription = jobData.description;
        enrichedData.contentSources = contentParts.map((p) => ({
            source: p.source,
            type: p.type,
            length: p.content.length,
        }));

        return ToolResult.ok(
            {
                jobData: enrichedData,
                links: input.links || [],
                scrapedContent: scrapedContent,
            },
            {
                totalContentLength: totalLength,
                sourceCount: contentParts.length,
                truncated: totalLength >= maxContentLength,
            }
        );
    }
}
