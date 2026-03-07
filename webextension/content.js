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
    function scrapeJobData() {
        const data = {};

        // Job Title
        data.title =
            getTextContent(".job-details-jobs-unified-top-card__job-title h1") ||
            getTextContent(".jobs-unified-top-card__job-title") ||
            getTextContent(".t-24.t-bold.inline") ||
            getTextContent("h1.topcard__title") ||
            getTextContent("h1") ||
            "";

        // Company Name
        data.company =
            getTextContent(".job-details-jobs-unified-top-card__company-name") ||
            getTextContent(".jobs-unified-top-card__company-name") ||
            getTextContent(".topcard__org-name-link") ||
            getTextContent("a.topcard__org-name-link") ||
            "";

        // Location
        data.location =
            getTextContent(".job-details-jobs-unified-top-card__bullet") ||
            getTextContent(".jobs-unified-top-card__bullet") ||
            getTextContent(".topcard__flavor--bullet") ||
            "";

        // Workplace Type (Remote, Hybrid, On-site)
        data.workplaceType =
            getTextContent(".job-details-jobs-unified-top-card__workplace-type") ||
            getTextContent(".jobs-unified-top-card__workplace-type") ||
            "";

        // Posted Date
        data.postedDate =
            getTextContent(".job-details-jobs-unified-top-card__posted-date") ||
            getTextContent(".jobs-unified-top-card__posted-date") ||
            getTextContent(".posted-time-ago__text") ||
            "";

        // Applicant Count
        data.applicantCount =
            getTextContent(".job-details-jobs-unified-top-card__applicant-count") ||
            getTextContent(".jobs-unified-top-card__applicant-count") ||
            getTextContent(".num-applicants__caption") ||
            "";

        // Job Description
        data.description =
            getTextContent(".jobs-description-content__text") ||
            getTextContent(".jobs-description__content") ||
            getTextContent(".job-details-jobs-unified-top-card__job-description") ||
            getTextContent("#job-details") ||
            getTextContent(".description__text") ||
            "";

        // Salary
        data.salary =
            getTextContent(".job-details-jobs-unified-top-card__job-insight--highlight") ||
            getTextContent(".salary-main-rail__data-body") ||
            getTextContent(".compensation__salary") ||
            "";

        // Job criteria items (Seniority, Employment Type, etc.)
        const criteriaItems = document.querySelectorAll(
            ".job-details-jobs-unified-top-card__job-insight, .jobs-unified-top-card__job-insight, .description__job-criteria-item"
        );
        criteriaItems.forEach((item) => {
            const label = (
                item.querySelector(
                    ".job-details-jobs-unified-top-card__job-insight-view-model-secondary, h3"
                )?.textContent || ""
            ).trim().toLowerCase();
            const value = (
                item.querySelector("span:last-child, .description__job-criteria-text")
                    ?.textContent || ""
            ).trim();

            if (label.includes("seniority")) data.seniorityLevel = value;
            if (label.includes("employment")) data.employmentType = value;
            if (label.includes("function")) data.jobFunction = value;
            if (label.includes("industr")) data.industries = value;
        });

        // Company About / Description
        data.companyDescription =
            getTextContent(".jobs-company__company-description") ||
            getTextContent(".top-card-layout__card .topcard__flavor--metadata") ||
            "";

        // Clean up whitespace
        Object.keys(data).forEach((key) => {
            if (typeof data[key] === "string") {
                data[key] = data[key].replace(/\s+/g, " ").trim();
            }
        });

        return data;
    }

    function getTextContent(selector) {
        const el = document.querySelector(selector);
        return el ? el.textContent.trim() : null;
    }

    // ── Handle Analyze Click (placeholder) ───────────────────
    async function handleAnalyzeClick() {
        const jobData = scrapeJobData();
        console.log("Scraped job data:", jobData);
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
