// ============================================================
// Link Detector Tool
// Detects and categorizes URLs found in job description text.
// Filters out LinkedIn-internal links and irrelevant URLs.
// ============================================================

import { BaseTool, ToolResult } from "../lib/langchain-core.js";

/**
 * URL pattern categories — helps classify links by their likely content.
 * This allows us to prioritize which links to scrape.
 */
const URL_CATEGORIES = {
    JOB_BOARD: {
        patterns: [
            /indeed\.com/i,
            /glassdoor\.com/i,
            /monster\.com/i,
            /ziprecruiter\.com/i,
            /dice\.com/i,
            /careerbuilder\.com/i,
            /simplyhired\.com/i,
            /lever\.co/i,
            /greenhouse\.io/i,
            /workday\.com/i,
            /smartrecruiters\.com/i,
            /jobvite\.com/i,
            /breezy\.hr/i,
            /ashbyhq\.com/i,
            /hire\.lever\.co/i,
            /boards\.greenhouse\.io/i,
            /jobs\.ashbyhq\.com/i,
        ],
        priority: 1,
        label: "Job Board / ATS Portal",
    },
    COMPANY_CAREER: {
        patterns: [
            /\/careers?\//i,
            /\/jobs?\//i,
            /\/hiring/i,
            /\/openings?\//i,
            /\/positions?\//i,
            /\/opportunities?\//i,
            /\/work-with-us/i,
            /\/join-us/i,
            /\/vacancies?\//i,
            /\/apply/i,
        ],
        priority: 2,
        label: "Company Careers Page",
    },
    DOCUMENT: {
        patterns: [
            /\.pdf$/i,
            /\.docx?$/i,
            /\.txt$/i,
            /docs\.google\.com/i,
            /drive\.google\.com/i,
            /notion\.site/i,
            /notion\.so/i,
            /dropbox\.com/i,
        ],
        priority: 1,
        label: "Document / File",
    },
    FORM: {
        patterns: [
            /forms\.gle/i,
            /docs\.google\.com\/forms/i,
            /typeform\.com/i,
            /jotform\.com/i,
            /airtable\.com/i,
            /surveymonkey\.com/i,
            /wufoo\.com/i,
        ],
        priority: 3,
        label: "Application Form",
    },
    SOCIAL_MEDIA: {
        patterns: [
            /twitter\.com/i,
            /x\.com/i,
            /facebook\.com/i,
            /instagram\.com/i,
            /youtube\.com/i,
            /tiktok\.com/i,
        ],
        priority: 5,
        label: "Social Media",
    },
    GENERAL: {
        patterns: [],
        priority: 4,
        label: "General Website",
    },
};

/**
 * Domains to always skip — these are LinkedIn internal or irrelevant links.
 */
const SKIP_DOMAINS = [
    "linkedin.com",
    "www.linkedin.com",
    "lnkd.in",
    "bit.ly",
    "goo.gl",
    "t.co",
    "linkedin.com/in/",
    "linkedin.com/company/",
    "linkedin.com/school/",
    "linkedin.com/feed/",
    "linkedin.com/messaging/",
    "linkedin.com/notifications/",
    "linkedin.com/mynetwork/",
    "linkedin.com/search/",
];

/**
 * DetectLinksTool — Scans job description text and DOM elements
 * to find external URLs that might contain additional job information.
 * 
 * Input: { jobData, links (from DOM), config }
 * Output: { jobData, links: [{ url, category, priority, context }] }
 */
export class DetectLinksTool extends BaseTool {
    constructor() {
        super({
            name: "link_detector",
            description:
                "Detects and categorizes external URLs in job descriptions that may contain additional job information",
            version: "1.0.0",
            requiredInputFields: ["jobData"],
            outputFields: ["jobData", "links"],
            cacheable: false,
        });
    }

    /**
     * @param {Object} input
     * @param {Object} input.jobData - Scraped job data from LinkedIn
     * @param {string[]} [input.domLinks] - Links extracted from DOM by content script
     * @param {Object} [input.config] - Pipeline configuration
     * @param {Object} context
     * @returns {Promise<ToolResult>}
     */
    async _execute(input, context) {
        const { jobData, domLinks = [], config = {} } = input;
        const maxLinks = config.maxLinksToScrape || 5;

        const foundLinks = new Map(); // url -> link info (deduplication)

        // 1. Extract URLs from the description text using regex
        const textUrls = this._extractUrlsFromText(jobData.description || "");
        for (const urlInfo of textUrls) {
            if (!this._shouldSkip(urlInfo.url)) {
                foundLinks.set(urlInfo.url, urlInfo);
            }
        }

        // 2. Extract URLs from company description
        const companyUrls = this._extractUrlsFromText(
            jobData.companyDescription || ""
        );
        for (const urlInfo of companyUrls) {
            if (!this._shouldSkip(urlInfo.url)) {
                urlInfo.context = "Company description";
                foundLinks.set(urlInfo.url, urlInfo);
            }
        }

        // 3. Process DOM-extracted links (passed from content script)
        for (const link of domLinks) {
            const url = typeof link === "string" ? link : link.url;
            if (url && !this._shouldSkip(url) && !foundLinks.has(url)) {
                const category = this._categorizeUrl(url);
                foundLinks.set(url, {
                    url: url,
                    category: category.label,
                    priority: category.priority,
                    context: typeof link === "object" ? link.text || "" : "",
                    source: "dom",
                });
            }
        }

        // 4. Sort by priority (lower = higher priority) and limit
        const sortedLinks = [...foundLinks.values()]
            .sort((a, b) => a.priority - b.priority)
            .slice(0, maxLinks);

        // 5. Log findings
        console.log(
            `[DetectLinksTool] Found ${foundLinks.size} unique links, using top ${sortedLinks.length}`
        );
        for (const link of sortedLinks) {
            console.log(
                `  → [${link.category}] ${link.url.substring(0, 80)}`
            );
        }

        return ToolResult.ok(
            {
                jobData: jobData,
                links: sortedLinks,
                domLinks: domLinks,
            },
            {
                totalLinksFound: foundLinks.size,
                linksToScrape: sortedLinks.length,
                categories: this._countCategories(sortedLinks),
            }
        );
    }

    /**
     * Extract URLs from plain text using regex.
     * Handles various URL formats including those without protocol.
     * 
     * @param {string} text
     * @returns {Object[]} Array of { url, category, priority, context, source }
     */
    _extractUrlsFromText(text) {
        if (!text) return [];

        const results = [];

        // Pattern 1: Standard URLs with protocol
        const urlPatternWithProtocol =
            /https?:\/\/(?:[\w-]+\.)+[\w-]+(?:\/[\w\-._~:/?#[\]@!$&'()*+,;=%]*)?/gi;

        // Pattern 2: URLs without protocol (www.example.com)
        const urlPatternWithoutProtocol =
            /(?:^|\s)(www\.(?:[\w-]+\.)+[\w-]+(?:\/[\w\-._~:/?#[\]@!$&'()*+,;=%]*)?)/gi;

        // Extract with protocol
        let match;
        while ((match = urlPatternWithProtocol.exec(text)) !== null) {
            const url = this._cleanUrl(match[0]);
            if (this._isValidUrl(url)) {
                const category = this._categorizeUrl(url);
                const contextStart = Math.max(0, match.index - 50);
                const contextEnd = Math.min(
                    text.length,
                    match.index + match[0].length + 50
                );

                results.push({
                    url: url,
                    category: category.label,
                    priority: category.priority,
                    context: text
                        .substring(contextStart, contextEnd)
                        .replace(/\s+/g, " ")
                        .trim(),
                    source: "text_regex",
                });
            }
        }

        // Extract without protocol
        while ((match = urlPatternWithoutProtocol.exec(text)) !== null) {
            const url = "https://" + this._cleanUrl(match[1].trim());
            if (this._isValidUrl(url) && !results.some((r) => r.url === url)) {
                const category = this._categorizeUrl(url);
                results.push({
                    url: url,
                    category: category.label,
                    priority: category.priority,
                    context: "",
                    source: "text_regex_no_protocol",
                });
            }
        }

        return results;
    }

    /**
     * Categorize a URL based on known patterns.
     * @param {string} url
     * @returns {{ label: string, priority: number }}
     */
    _categorizeUrl(url) {
        for (const [, category] of Object.entries(URL_CATEGORIES)) {
            if (category.patterns.length === 0) continue;
            for (const pattern of category.patterns) {
                if (pattern.test(url)) {
                    return { label: category.label, priority: category.priority };
                }
            }
        }
        return {
            label: URL_CATEGORIES.GENERAL.label,
            priority: URL_CATEGORIES.GENERAL.priority,
        };
    }

    /**
     * Check if a URL should be skipped (LinkedIn internal, etc.)
     * @param {string} url
     * @returns {boolean}
     */
    _shouldSkip(url) {
        try {
            const parsed = new URL(url);
            const hostname = parsed.hostname.toLowerCase();

            // Check skip domains
            for (const domain of SKIP_DOMAINS) {
                if (domain.includes("/")) {
                    // Check full path
                    if (url.toLowerCase().includes(domain)) return true;
                } else {
                    // Check hostname only
                    if (
                        hostname === domain ||
                        hostname.endsWith("." + domain)
                    ) {
                        return true;
                    }
                }
            }

            // Skip data URLs, javascript, mailto, tel
            if (/^(data|javascript|mailto|tel):/i.test(url)) return true;

            // Skip very short URLs (likely fragments)
            if (url.length < 12) return true;

            return false;
        } catch {
            return true; // Invalid URL, skip
        }
    }

    /**
     * Clean a URL — remove trailing punctuation, fragments, etc.
     * @param {string} url
     * @returns {string}
     */
    _cleanUrl(url) {
        return url
            .replace(/[.,;:!?)}\]]+$/, "") // Remove trailing punctuation
            .replace(/&amp;/g, "&") // Decode HTML entities
            .trim();
    }

    /**
     * Validate that a URL is well-formed.
     * @param {string} url
     * @returns {boolean}
     */
    _isValidUrl(url) {
        try {
            const parsed = new URL(url);
            return ["http:", "https:"].includes(parsed.protocol);
        } catch {
            return false;
        }
    }

    /**
     * Count links per category.
     * @param {Object[]} links
     * @returns {Object}
     */
    _countCategories(links) {
        const counts = {};
        for (const link of links) {
            counts[link.category] = (counts[link.category] || 0) + 1;
        }
        return counts;
    }
}
