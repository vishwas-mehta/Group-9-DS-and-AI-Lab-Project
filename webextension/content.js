// ============================================================
// Content Script — Injected on LinkedIn pages
// Handles: Button injection, DOM scraping, Results overlay
// ============================================================

(function () {
    "use strict";

    // Prevent double injection
    if (window.__linkedinJobPredictor) return;
    window.__linkedinJobPredictor = true;

    // ── Floating Analyze Button ──────────────────────────────
    function createAnalyzeButton() {
        if (document.getElementById("ljp-analyze-btn")) return;

        const btn = document.createElement("button");
        btn.id = "ljp-analyze-btn";
        btn.innerHTML = `
      <span class="ljp-btn-icon">🔍</span>
      <span class="ljp-btn-text">Analyze Job</span>
    `;
        btn.addEventListener("click", handleAnalyzeClick);
        document.body.appendChild(btn);
    }

    // ── Scrape Job Data ──────────────────────────────────────
    // ── Helper: try multiple selectors and return first match ──
    function getTextContent(selector) {
        try {
            const el = document.querySelector(selector);
            if (!el) return null;
            const text = el.textContent.trim();
            return text.length > 0 ? text : null;
        } catch {
            return null;
        }
    }

    function getTextFromSelectors(selectors) {
        for (const sel of selectors) {
            const result = getTextContent(sel);
            if (result) return result;
        }
        return null;
    }

    // ── Helper: wildcard attribute match ────────────────────────
    // LinkedIn changes exact class names but keeps partial patterns
    function getTextByAttrContains(attrValue, tag = "*") {
        try {
            const el = document.querySelector(`${tag}[class*="${attrValue}"]`);
            if (!el) return null;
            const text = el.textContent.trim();
            return text.length > 0 ? text : null;
        } catch {
            return null;
        }
    }

    // ── Scrape Job Data ──────────────────────────────────────
    function scrapeJobData() {
        const data = {};

        // --- DEBUG: Log what the DOM looks like for future troubleshooting ---
        const jobDetailPane = document.querySelector('.jobs-search__job-details, .scaffold-layout__detail, [class*="job-details"], [class*="jobs-details"]');
        if (jobDetailPane) {
            console.log("[Content] Found job detail pane:", jobDetailPane.className);
        } else {
            console.log("[Content] No job detail pane found. Available top-level classes:", 
                [...document.querySelectorAll('[class*="job"]')].slice(0, 10).map(el => el.className).join(" | "));
        }

        // Job Title — try multiple selectors (LinkedIn A/B tests class names)
        data.title =
            getTextFromSelectors([
                ".job-details-jobs-unified-top-card__job-title h1",
                ".job-details-jobs-unified-top-card__job-title",
                ".jobs-unified-top-card__job-title",
                ".t-24.t-bold.inline",
                ".top-card-layout__title",
                "h1.topcard__title",
                "h2.t-24.t-bold",
            ]) ||
            getTextByAttrContains("job-title", "h1") ||
            getTextByAttrContains("job-title") ||
            getTextByAttrContains("topcard__title") ||
            // Broader fallback: the first h1 inside the job detail pane
            (() => {
                const pane = document.querySelector('.jobs-search__job-details, .scaffold-layout__detail, [class*="job-details"]');
                if (pane) {
                    const h1 = pane.querySelector("h1");
                    if (h1) return h1.textContent.trim();
                }
                // Last resort: first h1 on page (risky but better than nothing)
                return getTextContent("h1");
            })() ||
            "";

        // Company Name
        data.company =
            getTextFromSelectors([
                ".job-details-jobs-unified-top-card__company-name a",
                ".job-details-jobs-unified-top-card__company-name",
                ".jobs-unified-top-card__company-name a",
                ".jobs-unified-top-card__company-name",
                ".topcard__org-name-link",
                ".top-card-layout__flavor--black-link",
                "a.topcard__org-name-link",
            ]) ||
            getTextByAttrContains("company-name", "a") ||
            getTextByAttrContains("company-name") ||
            getTextByAttrContains("org-name") ||
            // Broader fallback: look for company link near the title
            (() => {
                const pane = document.querySelector('.jobs-search__job-details, .scaffold-layout__detail, [class*="job-details"]');
                if (pane) {
                    // Company name is usually the first prominent link after the title
                    const links = pane.querySelectorAll("a");
                    for (const link of links) {
                        const href = link.getAttribute("href") || "";
                        if (href.includes("/company/")) {
                            const text = link.textContent.trim();
                            if (text.length > 1 && text.length < 100) return text;
                        }
                    }
                }
                return null;
            })() ||
            "";

        // Location
        data.location =
            getTextFromSelectors([
                ".job-details-jobs-unified-top-card__bullet",
                ".jobs-unified-top-card__bullet",
                ".topcard__flavor--bullet",
                ".top-card-layout__second-subline span",
            ]) ||
            getTextByAttrContains("bullet") ||
            // Fallback: look for location-like text near badges
            (() => {
                const pane = document.querySelector('.jobs-search__job-details, .scaffold-layout__detail, [class*="job-details"]');
                if (pane) {
                    const spans = pane.querySelectorAll("span");
                    for (const span of spans) {
                        const text = span.textContent.trim();
                        // Location patterns: contains comma + region/country names
                        if (text.length > 3 && text.length < 80 &&
                            (text.includes(",") || text.match(/\b(Remote|Hybrid|On-site|India|USA|UK|Bengaluru|Bangalore|Mumbai|Delhi|Hyderabad)\b/i))) {
                            // Make sure it's not inside a button or link to another job
                            if (!span.closest("button, [class*='btn'], [class*='footer']")) {
                                return text;
                            }
                        }
                    }
                }
                return null;
            })() ||
            "";

        // Workplace Type (Remote, Hybrid, On-site)
        data.workplaceType =
            getTextFromSelectors([
                ".job-details-jobs-unified-top-card__workplace-type",
                ".jobs-unified-top-card__workplace-type",
            ]) ||
            getTextByAttrContains("workplace-type") ||
            // Fallback: look for badge/pill with workplace type text
            (() => {
                const pane = document.querySelector('.jobs-search__job-details, .scaffold-layout__detail, [class*="job-details"]');
                if (pane) {
                    const pills = pane.querySelectorAll('li, span[class*="tag"], span[class*="pill"], span[class*="badge"]');
                    for (const pill of pills) {
                        const text = pill.textContent.trim().toLowerCase();
                        if (text === "remote" || text === "on-site" || text === "hybrid") {
                            return pill.textContent.trim();
                        }
                    }
                }
                return null;
            })() ||
            "";

        // Posted Date
        data.postedDate =
            getTextFromSelectors([
                ".job-details-jobs-unified-top-card__posted-date",
                ".jobs-unified-top-card__posted-date",
                ".posted-time-ago__text",
            ]) ||
            getTextByAttrContains("posted-date") ||
            // Fallback: look for "X days ago" / "X hours ago" pattern
            (() => {
                const pane = document.querySelector('.jobs-search__job-details, .scaffold-layout__detail, [class*="job-details"]');
                if (pane) {
                    const spans = pane.querySelectorAll("span");
                    for (const span of spans) {
                        const text = span.textContent.trim();
                        if (text.match(/\d+\s+(day|hour|week|month|minute)s?\s+ago/i)) {
                            return text;
                        }
                    }
                }
                return null;
            })() ||
            "";

        // Applicant Count
        data.applicantCount =
            getTextFromSelectors([
                ".job-details-jobs-unified-top-card__applicant-count",
                ".jobs-unified-top-card__applicant-count",
                ".num-applicants__caption",
            ]) ||
            getTextByAttrContains("applicant") ||
            // Fallback: look for "Over X applicants" pattern
            (() => {
                const pane = document.querySelector('.jobs-search__job-details, .scaffold-layout__detail, [class*="job-details"]');
                if (pane) {
                    const spans = pane.querySelectorAll("span");
                    for (const span of spans) {
                        const text = span.textContent.trim();
                        if (text.match(/\d+\s*applicant/i) || text.match(/over\s+\d+/i)) {
                            return text;
                        }
                    }
                }
                return null;
            })() ||
            "";

        // Job Description — critical field, try many selectors
        data.description =
            getTextFromSelectors([
                ".jobs-description-content__text",
                ".jobs-description__content",
                ".jobs-box__html-content",
                "#job-details",
                ".job-details-jobs-unified-top-card__job-description",
                ".description__text",
                ".show-more-less-html__markup",
                "article.jobs-description",
            ]) ||
            getTextByAttrContains("description-content") ||
            getTextByAttrContains("jobs-description") ||
            getTextByAttrContains("job-details") ||
            // Fallback: try to find any "About the job" section
            getDescriptionFromAboutSection() ||
            // Nuclear fallback: scrape any large text block from the detail pane
            getDescriptionNuclearFallback() ||
            "";

        // Salary
        data.salary =
            getTextFromSelectors([
                ".job-details-jobs-unified-top-card__job-insight--highlight",
                ".salary-main-rail__data-body",
                ".compensation__salary",
            ]) ||
            getTextByAttrContains("salary") ||
            getTextByAttrContains("compensation") ||
            "";

        // Job criteria items (Seniority, Employment Type, etc.)
        const criteriaItems = document.querySelectorAll(
            '[class*="job-insight"], [class*="job-criteria"], .description__job-criteria-item, .jobs-box__list-item'
        );
        criteriaItems.forEach((item) => {
            const text = item.textContent.trim();
            const label = (
                item.querySelector(
                    '[class*="insight-view-model-secondary"], h3, .t-black--light, [class*="subtitle"]'
                )?.textContent || ""
            ).trim().toLowerCase();
            const value = (
                item.querySelector('span:last-child, [class*="criteria-text"], .t-black.t-normal')
                    ?.textContent || ""
            ).trim();

            if (label.includes("seniority") || text.toLowerCase().includes("seniority"))
                data.seniorityLevel = value || text;
            if (label.includes("employment") || text.toLowerCase().includes("full-time") || text.toLowerCase().includes("part-time") || text.toLowerCase().includes("internship"))
                data.employmentType = value || text;
            if (label.includes("function") || text.toLowerCase().includes("function"))
                data.jobFunction = value || text;
            if (label.includes("industr") || text.toLowerCase().includes("industr"))
                data.industries = value || text;
        });

        // Also extract from pill/badge elements (On-site, Internship, etc.)
        const pills = document.querySelectorAll('.jobs-search__job-details li span, .scaffold-layout__detail li span, [class*="job-details"] li span');
        for (const pill of pills) {
            const text = pill.textContent.trim().toLowerCase();
            if (text === "internship" || text === "full-time" || text === "part-time" || text === "contract")
                data.employmentType = data.employmentType || pill.textContent.trim();
            if (text === "on-site" || text === "remote" || text === "hybrid")
                data.workplaceType = data.workplaceType || pill.textContent.trim();
        }

        // Company About / Description
        data.companyDescription =
            getTextFromSelectors([
                ".jobs-company__company-description",
                ".top-card-layout__card .topcard__flavor--metadata",
            ]) ||
            getTextByAttrContains("company-description") ||
            "";

        // Clean up whitespace
        Object.keys(data).forEach((key) => {
            if (typeof data[key] === "string") {
                data[key] = data[key].replace(/\s+/g, " ").trim();
            }
        });

        console.log("[Content] Scraped data fields:", Object.keys(data).filter(k => data[k]).length, "non-empty");
        console.log("[Content] Title:", data.title?.substring(0, 60));
        console.log("[Content] Company:", data.company?.substring(0, 60));
        console.log("[Content] Description length:", data.description?.length);

        return data;
    }

    /**
     * Fallback: try to find job description from "About the job" section
     * by walking the DOM for known heading patterns.
     */
    function getDescriptionFromAboutSection() {
        // Strategy 1: Use TreeWalker to find text nodes containing "About the job"
        const walker = document.createTreeWalker(
            document.body,
            NodeFilter.SHOW_TEXT,
            {
                acceptNode: (node) => {
                    const text = node.textContent.trim().toLowerCase();
                    if (text === "about the job" || text === "about this role" || text === "about the role") {
                        return NodeFilter.FILTER_ACCEPT;
                    }
                    return NodeFilter.FILTER_SKIP;
                }
            }
        );

        let textNode;
        while ((textNode = walker.nextNode())) {
            // Found the heading text node — now find the description content near it
            const headingEl = textNode.parentElement;
            if (!headingEl) continue;
            console.log("[Content] Found 'About the job' heading in:", headingEl.tagName, headingEl.className);

            // Strategy A: Look at siblings of the heading element
            let sibling = headingEl.nextElementSibling;
            while (sibling) {
                const content = sibling.textContent.trim();
                if (content.length > 50) {
                    console.log("[Content] Found description via sibling, length:", content.length);
                    return content;
                }
                sibling = sibling.nextElementSibling;
            }

            // Strategy B: Look at siblings of the heading's parent
            let parent = headingEl.parentElement;
            for (let depth = 0; depth < 3 && parent; depth++) {
                let parentSibling = parent.nextElementSibling;
                while (parentSibling) {
                    const content = parentSibling.textContent.trim();
                    if (content.length > 50) {
                        console.log("[Content] Found description via parent sibling (depth " + depth + "), length:", content.length);
                        return content;
                    }
                    parentSibling = parentSibling.nextElementSibling;
                }
                parent = parent.parentElement;
            }

            // Strategy C: Get the closest section/container and take ALL its text
            const container = headingEl.closest("section, article, div");
            if (container) {
                const fullText = container.textContent.trim();
                if (fullText.length > 100) {
                    console.log("[Content] Found description via container, length:", fullText.length);
                    return fullText;
                }
            }
        }

        // Strategy 2: Also check for elements using includes() (less strict)
        const allElements = document.querySelectorAll("h2, h3, h4, span, div, p");
        for (const el of allElements) {
            const text = el.textContent.trim().toLowerCase();
            // Only check elements with short text (likely headings, not full paragraphs)
            if (text.length > 50) continue;
            if (text.includes("about the job") || text.includes("about this role") || text.includes("about the role")) {
                let sibling = el.nextElementSibling;
                while (sibling) {
                    const content = sibling.textContent.trim();
                    if (content.length > 50) return content;
                    sibling = sibling.nextElementSibling;
                }
                let parent = el.parentElement;
                for (let depth = 0; depth < 3 && parent; depth++) {
                    let parentSibling = parent.nextElementSibling;
                    while (parentSibling) {
                        const content = parentSibling.textContent.trim();
                        if (content.length > 50) return content;
                        parentSibling = parentSibling.nextElementSibling;
                    }
                    parent = parent.parentElement;
                }
            }
        }
        return null;
    }

    /**
     * Nuclear fallback: find the largest text block in the job detail pane.
     * This handles cases where LinkedIn completely changes their class names.
     */
    function getDescriptionNuclearFallback() {
        // Find all divs/sections with substantial text - search the ENTIRE document
        const candidates = document.querySelectorAll("div, section, article");
        let bestText = null;
        let bestLength = 200; // Minimum threshold

        for (const el of candidates) {
            // Skip only truly irrelevant containers
            if (el.closest("nav, footer")) continue;
            // Skip our own extension elements
            if (el.id && el.id.startsWith("ljp-")) continue;

            const text = el.textContent.trim();
            // Look for elements with job-description-like content
            const lowerText = text.toLowerCase();
            const hasJobKeywords = (
                lowerText.includes("responsibilities") ||
                lowerText.includes("requirements") ||
                lowerText.includes("qualifications") ||
                lowerText.includes("experience") ||
                lowerText.includes("about the role") ||
                lowerText.includes("about the job") ||
                lowerText.includes("what you") ||
                lowerText.includes("we are looking") ||
                lowerText.includes("we're looking") ||
                lowerText.includes("job description") ||
                lowerText.includes("key skills") ||
                lowerText.includes("who you are")
            );

            if (hasJobKeywords && text.length > bestLength && text.length < 20000) {
                bestLength = text.length;
                bestText = text;
            }
        }

        if (bestText) {
            console.log("[Content] Used nuclear fallback for description, length:", bestText.length);
        }
        return bestText;
    }

    /**
     * ABSOLUTE LAST RESORT: Extract raw visible text from the page.
     * This CANNOT fail — it grabs all visible text and tries to parse it.
     */
    function rawTextFallback() {
        console.log("[Content] === USING RAW TEXT FALLBACK ===");
        const data = {};

        // Get ALL visible text on the page
        const fullPageText = document.body.innerText;
        console.log("[Content] Full page text length:", fullPageText.length);

        // Try to extract title from any h1 on the page (tag-based, no classes)
        const h1Elements = document.getElementsByTagName("h1");
        for (const h1 of h1Elements) {
            const text = h1.innerText.trim();
            if (text.length > 2 && text.length < 200) {
                data.title = text;
                console.log("[Content] Raw fallback found h1 title:", text);
                break;
            }
        }

        // Try h2 if no h1
        if (!data.title) {
            const h2Elements = document.getElementsByTagName("h2");
            for (const h2 of h2Elements) {
                const text = h2.innerText.trim();
                if (text.length > 2 && text.length < 200) {
                    data.title = text;
                    console.log("[Content] Raw fallback found h2 title:", text);
                    break;
                }
            }
        }

        // Try to find company by looking for links to /company/ pages
        const allLinks = document.getElementsByTagName("a");
        for (const link of allLinks) {
            const href = link.getAttribute("href") || "";
            if (href.includes("/company/") && !href.includes("/jobs")) {
                const text = link.innerText.trim();
                if (text.length > 1 && text.length < 100) {
                    data.company = text;
                    console.log("[Content] Raw fallback found company:", text);
                    break;
                }
            }
        }

        // For description, find "About the job" in the visible text and take everything after it
        const aboutIdx = fullPageText.toLowerCase().indexOf("about the job");
        if (aboutIdx !== -1) {
            // Take text from "About the job" onwards (up to 10000 chars)
            data.description = fullPageText.substring(aboutIdx, aboutIdx + 10000).trim();
            console.log("[Content] Raw fallback found description from 'About the job', length:", data.description.length);
        } else {
            // Just take a big chunk of the page text as description
            // Skip first 500 chars (likely navigation) and take up to 10000
            data.description = fullPageText.substring(500, 10500).trim();
            console.log("[Content] Raw fallback using page text slice, length:", data.description.length);
        }

        // Try to find location by looking for common patterns
        const locationMatch = fullPageText.match(/([A-Z][a-z]+(?:,\s*[A-Z][a-z]+)*(?:,\s*(?:India|USA|UK|Canada|Australia|Germany|Singapore)))/m);
        if (locationMatch) {
            data.location = locationMatch[1];
        }

        // Clean up
        Object.keys(data).forEach((key) => {
            if (typeof data[key] === "string") {
                data[key] = data[key].replace(/\s+/g, " ").trim();
            }
        });

        return data;
    }

    /**
     * Wait for job content to load in the DOM (LinkedIn loads async).
     * Retries up to maxAttempts with a delay between each attempt.
     */
    async function waitForJobContent(maxAttempts = 5, delayMs = 800) {
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            const data = scrapeJobData();
            if (data.title || data.description) {
                console.log(`[Content] Found job content on attempt ${attempt + 1}`);
                return data;
            }
            console.log(`[Content] Waiting for job content (attempt ${attempt + 1}/${maxAttempts})...`);
            await new Promise(resolve => setTimeout(resolve, delayMs));
        }
        console.log("[Content] Final scrape attempt after all retries");
        return scrapeJobData(); // Final attempt
    }

    // ── Extract Links from Job Description DOM ────────────────
    function extractLinksFromDOM() {
        const links = [];
        const linkSeen = new Set();

        // Selectors for job description areas
        const descriptionSelectors = [
            '.jobs-description__content',
            '.jobs-description',
            '.job-details-jobs-unified-top-card__job-insight',
            '.jobs-unified-top-card__job-insight',
            '.jobs-box__html-content',
            '.jobs-description-content__text',
            '[class*="description"]',
            '[class*="job-details"]',
        ];

        // Find the description container
        let descContainer = null;
        for (const sel of descriptionSelectors) {
            descContainer = document.querySelector(sel);
            if (descContainer) break;
        }

        // If we found a description container, extract links from it
        if (descContainer) {
            const anchors = descContainer.querySelectorAll('a[href]');
            for (const anchor of anchors) {
                const href = anchor.href;
                const text = anchor.textContent.trim();

                if (href && !linkSeen.has(href) && href.startsWith('http')) {
                    linkSeen.add(href);
                    links.push({
                        url: href,
                        text: text || href,
                        source: 'job_description_dom',
                    });
                }
            }
        }

        // Also check the "About the company" section
        const aboutSection = document.querySelector('.jobs-company__box');
        if (aboutSection) {
            const aboutAnchors = aboutSection.querySelectorAll('a[href]');
            for (const anchor of aboutAnchors) {
                const href = anchor.href;
                if (href && !linkSeen.has(href) && href.startsWith('http')) {
                    linkSeen.add(href);
                    links.push({
                        url: href,
                        text: anchor.textContent.trim() || href,
                        source: 'company_section_dom',
                    });
                }
            }
        }

        // Check for links in the "How you match" or insights section
        const insightLinks = document.querySelectorAll(
            '.job-details-how-you-match a[href], .jobs-unified-top-card a[href]'
        );
        for (const anchor of insightLinks) {
            const href = anchor.href;
            if (href && !linkSeen.has(href) && href.startsWith('http')) {
                linkSeen.add(href);
                links.push({
                    url: href,
                    text: anchor.textContent.trim() || href,
                    source: 'insights_dom',
                });
            }
        }

        console.log(`[Content] Extracted ${links.length} links from DOM`);
        return links;
    }

    // ── Progress Indicator ────────────────────────────────────
    function showProgressIndicator(progress) {
        let indicator = document.getElementById('ljp-progress');

        if (!indicator) {
            indicator = document.createElement('div');
            indicator.id = 'ljp-progress';
            document.body.appendChild(indicator);
        }

        const percentage = Math.round((progress.step / progress.totalSteps) * 100);
        const statusEmoji = progress.status === 'complete' ? '✅' :
            progress.status === 'failed' ? '❌' : '⏳';

        indicator.innerHTML = `
            <div class="ljp-progress-content">
                <div class="ljp-progress-header">🛡️ Analyzing Job</div>
                <div class="ljp-progress-step">
                    ${statusEmoji} Step ${progress.step}/${progress.totalSteps}: ${progress.label}
                </div>
                <div class="ljp-progress-bar-container">
                    <div class="ljp-progress-bar-fill" style="width: ${percentage}%"></div>
                </div>
                <div class="ljp-progress-percent">${percentage}%</div>
            </div>
        `;

        indicator.classList.add('ljp-progress-visible');

        // Auto-hide after last step completes
        if (progress.step === progress.totalSteps &&
            (progress.status === 'complete' || progress.status === 'failed')) {
            setTimeout(() => {
                indicator.classList.remove('ljp-progress-visible');
                setTimeout(() => indicator.remove(), 300);
            }, 1500);
        }
    }

    // Listen for progress updates from background
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.type === 'ANALYSIS_PROGRESS') {
            showProgressIndicator(message.data);
        }
    });

    // ── Handle Analyze Click ─────────────────────────────────
    async function handleAnalyzeClick() {
        const btn = document.getElementById("ljp-analyze-btn");

        // Show loading state
        btn.classList.add("ljp-loading");
        btn.innerHTML = `
      <span class="ljp-spinner"></span>
      <span class="ljp-btn-text">Analyzing...</span>
    `;
        btn.disabled = true;

        try {
            // Wait for job content to load (LinkedIn loads async)
            let jobData = await waitForJobContent(5, 800);

            // Extract links from the job description DOM
            const domLinks = extractLinksFromDOM();

            // If structured scraping failed, use raw text fallback
            if (!jobData.title && !jobData.description) {
                console.log("[Content] Structured scraping failed — trying raw text fallback...");
                jobData = rawTextFallback();
            }

            // Validate we have something to analyze
            if (!jobData.title && !jobData.description) {
                // Last absolute resort — just grab document.body.innerText
                console.log("[Content] Even raw fallback failed — sending full page text");
                jobData = {
                    title: document.title || "LinkedIn Job",
                    description: document.body.innerText.substring(0, 10000),
                    company: "",
                    location: "",
                };
            }

            console.log(`[Content] Sending to pipeline: title=${!!jobData.title}, desc_len=${jobData.description?.length || 0}, ${domLinks.length} DOM links`);

            // Send job data + DOM links to background pipeline
            const response = await chrome.runtime.sendMessage({
                type: "ANALYZE_JOB",
                data: {
                    jobData: jobData,
                    domLinks: domLinks,
                },
            });

            if (response.success) {
                showResultsOverlay(response.data, jobData);
            } else {
                showErrorOverlay(response.error);
            }
        } catch (error) {
            showErrorOverlay(error.message);
        } finally {
            // Reset button
            btn.classList.remove("ljp-loading");
            btn.innerHTML = `
        <span class="ljp-btn-icon">🔍</span>
        <span class="ljp-btn-text">Analyze Job</span>
      `;
            btn.disabled = false;
        }
    }

    function escapeHtml(str) {
        const div = document.createElement("div");
        div.textContent = str;
        return div.innerHTML;
    }

    // ── Results Overlay ──────────────────────────────────────
    function showResultsOverlay(result, jobData) {
        removeOverlay();

        const verdictConfig = {
            SAFE: { emoji: "✅", label: "Safe to Apply", color: "#00c853", bg: "rgba(0, 200, 83, 0.1)" },
            SUSPICIOUS: { emoji: "⚠️", label: "Suspicious", color: "#ff9100", bg: "rgba(255, 145, 0, 0.1)" },
            LIKELY_FAKE: { emoji: "❌", label: "Likely Fake", color: "#ff1744", bg: "rgba(255, 23, 68, 0.1)" },
        };

        const v = verdictConfig[result.verdict] || verdictConfig["SUSPICIOUS"];

        const overlay = document.createElement("div");
        overlay.id = "ljp-overlay";
        overlay.innerHTML = `
      <div class="ljp-overlay-backdrop" id="ljp-backdrop"></div>
      <div class="ljp-results-panel">
        <div class="ljp-results-header">
          <div class="ljp-results-title">
            <span class="ljp-logo">🛡️</span>
            Job Legitimacy Report
          </div>
          <button class="ljp-close-btn" id="ljp-close-btn">✕</button>
        </div>
        <div class="ljp-job-info">
          <div class="ljp-job-name">${escapeHtml(jobData.title || "Unknown Job")}</div>
          <div class="ljp-company-name">${escapeHtml(jobData.company || "Unknown Company")}</div>
        </div>
        <div class="ljp-verdict-card" style="background: ${v.bg}; border-left: 4px solid ${v.color};">
          <div class="ljp-verdict-row">
            <span class="ljp-verdict-emoji">${v.emoji}</span>
            <div>
              <div class="ljp-verdict-label" style="color: ${v.color};">${v.label}</div>
              <div class="ljp-confidence">Confidence: ${result.confidence}%</div>
            </div>
          </div>
          <div class="ljp-confidence-bar">
            <div class="ljp-confidence-fill" style="width: ${result.confidence}%; background: ${v.color};"></div>
          </div>
        </div>
        <div class="ljp-section">
          <div class="ljp-section-title">📋 Summary</div>
          <p class="ljp-summary">${escapeHtml(result.summary || "")}</p>
        </div>
        <div class="ljp-section">
          <div class="ljp-section-title">🔎 Key Findings</div>
          <ul class="ljp-reasons">
            ${(result.reasons || []).map((r) => `<li>${escapeHtml(r)}</li>`).join("")}
          </ul>
        </div>
        ${result.tips ? `
        <div class="ljp-section ljp-tip">
          <div class="ljp-section-title">💡 Tip</div>
          <p>${escapeHtml(result.tips)}</p>
        </div>` : ""}
        <div class="ljp-footer">Powered by Gemini AI · Results are advisory only</div>
      </div>
    `;

        document.body.appendChild(overlay);
        requestAnimationFrame(() => overlay.classList.add("ljp-visible"));

        document.getElementById("ljp-close-btn").addEventListener("click", removeOverlay);
        document.getElementById("ljp-backdrop").addEventListener("click", removeOverlay);
    }

    function showErrorOverlay(message) {
        removeOverlay();

        const overlay = document.createElement("div");
        overlay.id = "ljp-overlay";
        overlay.innerHTML = `
      <div class="ljp-overlay-backdrop" id="ljp-backdrop"></div>
      <div class="ljp-results-panel ljp-error-panel">
        <div class="ljp-results-header">
          <div class="ljp-results-title"><span class="ljp-logo">⚠️</span> Analysis Error</div>
          <button class="ljp-close-btn" id="ljp-close-btn">✕</button>
        </div>
        <div class="ljp-error-message"><p>${escapeHtml(message)}</p></div>
        <div class="ljp-footer">Make sure your Gemini API key is set correctly</div>
      </div>
    `;

        document.body.appendChild(overlay);
        requestAnimationFrame(() => overlay.classList.add("ljp-visible"));

        document.getElementById("ljp-close-btn").addEventListener("click", removeOverlay);
        document.getElementById("ljp-backdrop").addEventListener("click", removeOverlay);
    }

    function removeOverlay() {
        const overlay = document.getElementById("ljp-overlay");
        if (overlay) {
            overlay.classList.remove("ljp-visible");
            setTimeout(() => overlay.remove(), 300);
        }
    }

    // ── Initialize ───────────────────────────────────────────
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", createAnalyzeButton);
    } else {
        createAnalyzeButton();
    }

    // Re-inject button on SPA navigation
    const observer = new MutationObserver(() => {
        if (!document.getElementById("ljp-analyze-btn")) {
            createAnalyzeButton();
        }
    });
    observer.observe(document.body, { childList: true, subtree: true });
})();
