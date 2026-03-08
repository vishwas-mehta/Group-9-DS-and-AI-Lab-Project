// ============================================================
// Text Extractor Utility
// Extracts meaningful text content from raw HTML responses.
// Handles various page structures and removes noise elements.
// ============================================================

/**
 * TextExtractorConfig — Configuration for text extraction behavior.
 */
export const TextExtractorConfig = {
    /** Maximum output text length */
    MAX_TEXT_LENGTH: 10000,

    /** Minimum paragraph length to keep (filters noise) */
    MIN_PARAGRAPH_LENGTH: 20,

    /** HTML tags to completely remove (including their content) */
    REMOVE_TAGS: [
        "script",
        "style",
        "noscript",
        "iframe",
        "svg",
        "canvas",
        "video",
        "audio",
        "map",
        "object",
        "embed",
        "applet",
        "form",
        "input",
        "select",
        "textarea",
        "button",
        "nav",
        "header",
        "footer",
        "aside",
        "menu",
        "menuitem",
    ],

    /** CSS selectors for elements to remove (common noise) */
    REMOVE_SELECTORS: [
        "[role='navigation']",
        "[role='banner']",
        "[role='contentinfo']",
        "[aria-hidden='true']",
        ".cookie-banner",
        ".cookie-consent",
        ".popup",
        ".modal",
        ".overlay",
        ".ad",
        ".advertisement",
        ".sidebar",
        ".related-posts",
        ".comments",
        ".social-share",
        ".breadcrumb",
        ".pagination",
        "#cookie-notice",
        "#gdpr",
    ],

    /** CSS selectors that likely contain the main content */
    CONTENT_SELECTORS: [
        "article",
        "[role='main']",
        "main",
        ".job-description",
        ".job-details",
        ".posting-body",
        ".description",
        ".content",
        ".entry-content",
        ".post-content",
        "#job-description",
        "#job-details",
        "#content",
        ".section-content",
        ".details-body",
    ],
};

/**
 * TextExtractor — Extracts clean, meaningful text from raw HTML.
 * 
 * This utility uses DOMParser (available in service workers) to parse
 * HTML and extract text content, focusing on:
 * - Job descriptions and requirements
 * - Company information
 * - Application details
 * 
 * It removes navigation, ads, scripts, and other noise elements.
 */
export class TextExtractor {
    /**
     * Extract text from a raw HTML string.
     * 
     * @param {string} html - Raw HTML content
     * @param {Object} [options]
     * @param {number} [options.maxLength] - Maximum text length
     * @param {boolean} [options.preserveStructure] - Keep basic formatting
     * @param {boolean} [options.extractMetadata] - Also extract page metadata
     * @returns {ExtractedContent}
     */
    static extract(html, options = {}) {
        const {
            maxLength = TextExtractorConfig.MAX_TEXT_LENGTH,
            preserveStructure = true,
            extractMetadata = true,
        } = options;

        if (!html || typeof html !== "string") {
            return new ExtractedContent({
                text: "",
                metadata: {},
                success: false,
                error: "No HTML provided",
            });
        }

        // Try DOMParser first (available in Chrome 114+ service workers)
        // Falls back to regex-based extraction for older versions
        try {
            if (typeof DOMParser === "undefined") {
                throw new ReferenceError("DOMParser not available");
            }

            const parser = new DOMParser();
            const doc = parser.parseFromString(html, "text/html");

            // Extract metadata first
            const metadata = extractMetadata
                ? TextExtractor._extractMetadata(doc)
                : {};

            // Remove noise elements
            TextExtractor._removeNoiseElements(doc);

            // Try to find main content area
            let contentElement = TextExtractor._findMainContent(doc);

            // Extract text based on strategy
            let text;
            if (contentElement) {
                text = TextExtractor._extractFromElement(
                    contentElement,
                    preserveStructure
                );
                metadata.contentSource = "main_content_area";
            } else if (doc.body) {
                // Fallback: extract from body
                text = TextExtractor._extractFromElement(
                    doc.body,
                    preserveStructure
                );
                metadata.contentSource = "full_body_fallback";
            } else {
                // Body is null (malformed HTML), use regex fallback
                throw new Error("DOMParser produced no body element");
            }

            // Clean and truncate
            text = TextExtractor._cleanText(text, maxLength);

            return new ExtractedContent({
                text,
                metadata,
                success: text.length > 0,
                wordCount: text.split(/\s+/).filter(Boolean).length,
            });
        } catch (domError) {
            // Fallback: regex-based extraction (works in all environments)
            console.warn(
                "[TextExtractor] DOMParser unavailable or failed, using regex fallback:",
                domError.message
            );
            return TextExtractor._extractWithRegex(html, maxLength);
        }
    }

    /**
     * Regex-based fallback extraction for environments without DOMParser.
     * Less accurate than DOM-based extraction but works everywhere.
     * 
     * @param {string} html - Raw HTML string
     * @param {number} maxLength - Max output length
     * @returns {ExtractedContent}
     */
    static _extractWithRegex(html, maxLength) {
        const metadata = {};

        try {
            // Extract title
            const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
            if (titleMatch) metadata.pageTitle = titleMatch[1].trim();

            // Extract meta description
            const descMatch = html.match(
                /<meta[^>]*name=["']description["'][^>]*content=["']([\s\S]*?)["'][^>]*>/i
            );
            if (descMatch) metadata.metaDescription = descMatch[1].trim();

            // Extract OG title
            const ogTitleMatch = html.match(
                /<meta[^>]*property=["']og:title["'][^>]*content=["']([\s\S]*?)["'][^>]*>/i
            );
            if (ogTitleMatch) metadata.ogTitle = ogTitleMatch[1].trim();

            metadata.contentSource = "regex_fallback";

            // Remove script and style blocks
            let text = html
                .replace(/<script[\s\S]*?<\/script>/gi, "")
                .replace(/<style[\s\S]*?<\/style>/gi, "")
                .replace(/<noscript[\s\S]*?<\/noscript>/gi, "")
                .replace(/<nav[\s\S]*?<\/nav>/gi, "")
                .replace(/<header[\s\S]*?<\/header>/gi, "")
                .replace(/<footer[\s\S]*?<\/footer>/gi, "");

            // Convert block-level tags to newlines
            text = text
                .replace(/<\/?(p|div|br|h[1-6]|li|tr|section|article)[^>]*>/gi, "\n")
                .replace(/<\/?(ul|ol|table|tbody|thead)[^>]*>/gi, "\n");

            // Strip all remaining HTML tags
            text = text.replace(/<[^>]*>/g, " ");

            // Decode common HTML entities
            text = text
                .replace(/&amp;/g, "&")
                .replace(/&lt;/g, "<")
                .replace(/&gt;/g, ">")
                .replace(/&quot;/g, '"')
                .replace(/&#39;/g, "'")
                .replace(/&nbsp;/g, " ")
                .replace(/&#\d+;/g, " ");

            // Clean up whitespace
            text = TextExtractor._cleanText(text, maxLength);

            return new ExtractedContent({
                text,
                metadata,
                success: text.length > 0,
                wordCount: text.split(/\s+/).filter(Boolean).length,
            });
        } catch (error) {
            return new ExtractedContent({
                text: "",
                metadata: {},
                success: false,
                error: `Regex extraction failed: ${error.message}`,
            });
        }
    }

    /**
     * Extract metadata from the HTML document.
     * @param {Document} doc
     * @returns {Object}
     */
    static _extractMetadata(doc) {
        const metadata = {};

        // Page title
        const title = doc.querySelector("title");
        if (title) metadata.pageTitle = title.textContent.trim();

        // Meta description
        const metaDesc = doc.querySelector('meta[name="description"]');
        if (metaDesc) metadata.metaDescription = metaDesc.getAttribute("content");

        // Open Graph data
        const ogTitle = doc.querySelector('meta[property="og:title"]');
        if (ogTitle) metadata.ogTitle = ogTitle.getAttribute("content");

        const ogDesc = doc.querySelector('meta[property="og:description"]');
        if (ogDesc) metadata.ogDescription = ogDesc.getAttribute("content");

        const ogSiteName = doc.querySelector('meta[property="og:site_name"]');
        if (ogSiteName) metadata.siteName = ogSiteName.getAttribute("content");

        // Structured data (JSON-LD) — often contains job posting info
        const jsonLdScripts = doc.querySelectorAll(
            'script[type="application/ld+json"]'
        );
        if (jsonLdScripts.length > 0) {
            metadata.structuredData = [];
            for (const script of jsonLdScripts) {
                try {
                    const data = JSON.parse(script.textContent);
                    // Look for JobPosting schema
                    if (
                        data["@type"] === "JobPosting" ||
                        data["@type"]?.includes?.("JobPosting")
                    ) {
                        metadata.jobPostingSchema = {
                            title: data.title,
                            description: data.description
                                ? TextExtractor._stripHtml(data.description)
                                : null,
                            company:
                                data.hiringOrganization?.name || null,
                            location:
                                data.jobLocation?.address?.addressLocality ||
                                null,
                            salary: data.baseSalary
                                ? `${data.baseSalary.value?.minValue || ""}-${data.baseSalary.value?.maxValue || ""} ${data.baseSalary.currency || ""}`
                                : null,
                            employmentType: data.employmentType || null,
                            datePosted: data.datePosted || null,
                        };
                    }
                    metadata.structuredData.push(data);
                } catch {
                    // Malformed JSON-LD, skip
                }
            }
        }

        // Canonical URL
        const canonical = doc.querySelector('link[rel="canonical"]');
        if (canonical) metadata.canonicalUrl = canonical.getAttribute("href");

        return metadata;
    }

    /**
     * Remove noise elements (scripts, styles, nav, ads, etc.)
     * @param {Document} doc
     */
    static _removeNoiseElements(doc) {
        // Remove tags entirely
        for (const tag of TextExtractorConfig.REMOVE_TAGS) {
            const elements = doc.querySelectorAll(tag);
            for (const el of elements) {
                el.remove();
            }
        }

        // Remove by selector
        for (const selector of TextExtractorConfig.REMOVE_SELECTORS) {
            try {
                const elements = doc.querySelectorAll(selector);
                for (const el of elements) {
                    el.remove();
                }
            } catch {
                // Invalid selector, skip
            }
        }

        // Remove hidden elements
        const hidden = doc.querySelectorAll(
            '[style*="display: none"], [style*="display:none"], [style*="visibility: hidden"], [hidden]'
        );
        for (const el of hidden) {
            el.remove();
        }
    }

    /**
     * Find the main content area of the page.
     * Tries multiple strategies to identify the most relevant content.
     * 
     * @param {Document} doc
     * @returns {Element|null}
     */
    static _findMainContent(doc) {
        // Strategy 1: Try known content selectors
        for (const selector of TextExtractorConfig.CONTENT_SELECTORS) {
            try {
                const el = doc.querySelector(selector);
                if (el && el.textContent.trim().length > 100) {
                    return el;
                }
            } catch {
                continue;
            }
        }

        // Strategy 2: Find the element with the most text content
        const candidates = doc.querySelectorAll(
            "div, section, article, main"
        );
        let bestCandidate = null;
        let bestScore = 0;

        for (const candidate of candidates) {
            const text = candidate.textContent.trim();
            const textLength = text.length;

            // Score based on text density (text length relative to HTML length)
            const htmlLength = candidate.innerHTML.length;
            const density =
                htmlLength > 0 ? textLength / htmlLength : 0;

            // Prefer elements with substantial text and good density
            const score = textLength * density;

            if (score > bestScore && textLength > 200) {
                bestScore = score;
                bestCandidate = candidate;
            }
        }

        return bestCandidate;
    }

    /**
     * Extract text from an element, optionally preserving structure.
     * 
     * @param {Element} element
     * @param {boolean} preserveStructure
     * @returns {string}
     */
    static _extractFromElement(element, preserveStructure) {
        if (!preserveStructure) {
            return element.textContent || "";
        }

        const lines = [];

        // In service worker context, there's no global `document`.
        // Use the element's ownerDocument instead.
        // NodeFilter.SHOW_ELEMENT = 1, NodeFilter.SHOW_TEXT = 4
        // Node.TEXT_NODE = 3, Node.ELEMENT_NODE = 1
        const ownerDoc = element.ownerDocument || element;
        const walker = ownerDoc.createTreeWalker(
            element,
            1 | 4, // SHOW_ELEMENT | SHOW_TEXT
            null
        );

        let currentNode;
        while ((currentNode = walker.nextNode())) {
            if (currentNode.nodeType === 3) { // TEXT_NODE
                const text = currentNode.textContent.trim();
                if (text) {
                    lines.push(text);
                }
            } else if (currentNode.nodeType === 1) { // ELEMENT_NODE
                const tagName = currentNode.tagName.toLowerCase();

                // Add blank lines for block-level elements
                if (
                    [
                        "p",
                        "div",
                        "section",
                        "article",
                        "h1",
                        "h2",
                        "h3",
                        "h4",
                        "h5",
                        "h6",
                        "br",
                        "hr",
                        "li",
                        "tr",
                    ].includes(tagName)
                ) {
                    lines.push("");
                }

                // Add heading markers
                if (/^h[1-6]$/.test(tagName)) {
                    const level = parseInt(tagName[1]);
                    const prefix = "#".repeat(level);
                    lines.push(`${prefix} `);
                }

                // Add list markers
                if (tagName === "li") {
                    lines.push("• ");
                }
            }
        }

        return lines.join(" ");
    }

    /**
     * Clean extracted text — normalize whitespace, remove noise, truncate.
     * 
     * @param {string} text
     * @param {number} maxLength
     * @returns {string}
     */
    static _cleanText(text, maxLength) {
        let cleaned = text
            // Normalize whitespace
            .replace(/[\t\r]+/g, " ")
            // Collapse multiple newlines
            .replace(/\n{3,}/g, "\n\n")
            // Collapse multiple spaces
            .replace(/ {2,}/g, " ")
            // Remove lines that are just whitespace
            .replace(/^\s+$/gm, "")
            // Trim
            .trim();

        // Filter out very short paragraphs (likely noise)
        const paragraphs = cleaned.split(/\n\n+/);
        const meaningful = paragraphs.filter(
            (p) =>
                p.trim().length >= TextExtractorConfig.MIN_PARAGRAPH_LENGTH ||
                /^#+\s/.test(p.trim()) // Keep headings
        );
        cleaned = meaningful.join("\n\n");

        // Truncate if needed
        if (cleaned.length > maxLength) {
            cleaned =
                cleaned.substring(0, maxLength) +
                "\n\n[Content truncated at " +
                maxLength +
                " characters]";
        }

        return cleaned;
    }

    /**
     * Strip HTML tags from a string (simple utility).
     * @param {string} html
     * @returns {string}
     */
    static _stripHtml(html) {
        return html
            .replace(/<[^>]*>/g, " ")
            .replace(/\s+/g, " ")
            .trim();
    }
}

/**
 * ExtractedContent — Result of text extraction from HTML.
 */
export class ExtractedContent {
    /**
     * @param {Object} options
     * @param {string} options.text - Extracted text
     * @param {Object} [options.metadata] - Page metadata
     * @param {boolean} [options.success] - Whether extraction succeeded
     * @param {string} [options.error] - Error message if failed
     * @param {number} [options.wordCount] - Number of words extracted
     */
    constructor({ text, metadata = {}, success = true, error = null, wordCount = 0 }) {
        this.text = text;
        this.metadata = metadata;
        this.success = success;
        this.error = error;
        this.wordCount = wordCount || text.split(/\s+/).filter(Boolean).length;
    }

    /**
     * Get a brief summary of the extracted content.
     * @returns {string}
     */
    getSummary() {
        return `ExtractedContent: ${this.wordCount} words, ${this.text.length} chars, success=${this.success}`;
    }

    /**
     * Check if the content contains job-related keywords.
     * @returns {boolean}
     */
    hasJobContent() {
        const jobKeywords = [
            "job",
            "position",
            "role",
            "responsibilities",
            "requirements",
            "qualifications",
            "experience",
            "salary",
            "compensation",
            "benefits",
            "skills",
            "apply",
            "application",
            "hiring",
            "team",
            "company",
            "about us",
        ];

        const lowerText = this.text.toLowerCase();
        const matchCount = jobKeywords.filter((kw) =>
            lowerText.includes(kw)
        ).length;

        return matchCount >= 3; // At least 3 job-related keywords
    }
}
