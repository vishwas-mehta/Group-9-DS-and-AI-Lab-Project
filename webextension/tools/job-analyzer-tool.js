// ============================================================
// Job Analyzer Tool
// Wraps the Gemini API call as a LangChain-style tool.
// Builds prompts and parses AI responses for job analysis.
// ============================================================

import { BaseTool, ToolResult } from "../lib/langchain-core.js";

/**
 * Gemini model configuration.
 * Centralized here so it's easy to modify or switch models.
 */
const GEMINI_CONFIG = {
    model: "gemini-2.0-flash",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/models",
    temperature: 0.3,
    topP: 0.8,
    maxOutputTokens: 2048,
};

/**
 * Analysis depth configurations.
 * Controls how thorough the AI analysis should be.
 */
const ANALYSIS_DEPTHS = {
    quick: {
        systemPromptAddition:
            "Provide a brief analysis. Focus on the most obvious red flags only.",
        maxOutputTokens: 1024,
        temperature: 0.2,
    },
    standard: {
        systemPromptAddition:
            "Provide a thorough analysis covering all red flag categories.",
        maxOutputTokens: 2048,
        temperature: 0.3,
    },
    deep: {
        systemPromptAddition:
            "Provide an extremely detailed analysis. Cross-reference all available data, check for consistency between the job description and external content, and provide specific evidence for each finding. Include a risk score breakdown.",
        maxOutputTokens: 4096,
        temperature: 0.4,
    },
};

/**
 * Red flags taxonomy — comprehensive list of job scam indicators.
 * Organized by category for structured analysis.
 */
const RED_FLAGS_TAXONOMY = {
    description_quality: [
        "Vague job descriptions with no specific responsibilities",
        "Excessive use of buzzwords without substance",
        "Copy-pasted descriptions from multiple different jobs",
        "Grammatical errors and poor formatting",
        "Missing key information (team, project, tech stack)",
    ],
    compensation: [
        "Unrealistically high salary for the role/experience level",
        "Salary range is extremely wide (e.g., $30k-$200k)",
        "Promises of guaranteed bonuses without clear criteria",
        "Requires upfront payments, fees, or purchases",
        "Commission-only compensation for non-sales roles",
    ],
    company_info: [
        "No company name or very new company",
        "Company website doesn't match claimed industry",
        "No LinkedIn company page or very few followers",
        "Inconsistent company information across sources",
        "Company has no verifiable online presence",
    ],
    application_process: [
        "Requests personal information (SSN, bank details) upfront",
        "Immediate hire without interview promises",
        "Asks to communicate via personal email/WhatsApp",
        "Application through external suspicious forms",
        "No clear hiring timeline or process described",
    ],
    job_logistics: [
        "No clear job location or 'work from anywhere' for roles requiring presence",
        "Job posted in wrong category or location",
        "Duplicate postings across many locations simultaneously",
        "Job has been reposted many times without changes",
        "Requirements don't match the job title",
    ],
    external_content: [
        "External link leads to unrelated content",
        "External link is broken or returns errors",
        "External site has no HTTPS or looks unprofessional",
        "Job description on external site differs from LinkedIn",
        "External link requires sensitive information before showing the job",
    ],
};

/**
 * JobAnalyzerTool — Sends enriched job data to Gemini for analysis.
 * 
 * This is the final step in the pipeline. It takes the aggregated
 * content (original job data + scraped link content) and gets an
 * AI prediction on whether the job is legitimate.
 * 
 * Input: { jobData, links, scrapedContent, config }
 * Output: { verdict, confidence, reasons, summary, tips, metadata }
 */
export class JobAnalyzerTool extends BaseTool {
    constructor() {
        super({
            name: "job_analyzer",
            description:
                "Analyzes enriched job data using Gemini AI to predict job legitimacy",
            version: "2.0.0",
            requiredInputFields: ["jobData"],
            outputFields: [
                "verdict",
                "confidence",
                "reasons",
                "summary",
                "tips",
            ],
            cacheable: false,
        });
    }

    /**
     * @param {Object} input
     * @param {Object} input.jobData - Enriched job data (may include enrichedDescription)
     * @param {Object[]} [input.links] - Detected links
     * @param {Object[]} [input.scrapedContent] - Scraped content from links
     * @param {Object} [input.config] - Pipeline configuration
     * @param {Object} context
     * @returns {Promise<ToolResult>}
     */
    async _execute(input, context) {
        const { jobData, links = [], scrapedContent = [], config = {} } = input;

        // Get API key
        const apiKey = await this._getApiKey();
        if (!apiKey) {
            return ToolResult.fail(
                "No Gemini API key found. Click the extension icon to set your API key."
            );
        }

        // Determine analysis depth
        const depth = config.analysisDepth || "standard";
        const depthConfig = ANALYSIS_DEPTHS[depth] || ANALYSIS_DEPTHS.standard;

        // Build the prompt
        const prompt = this._buildPrompt(jobData, links, scrapedContent, depthConfig);

        // Call Gemini API
        const analysisResult = await this._callGemini(
            apiKey,
            prompt,
            depthConfig
        );

        // Enrich result with pipeline metadata
        analysisResult.pipelineMetadata = {
            analysisDepth: depth,
            linksDetected: links.length,
            linksScraped: scrapedContent.filter((s) => s.success).length,
            contentSources: jobData.contentSources || [],
            totalContentLength: jobData.enrichedDescription?.length || 0,
        };

        return ToolResult.ok(analysisResult, {
            model: GEMINI_CONFIG.model,
            analysisDepth: depth,
            promptLength: prompt.userMessage.length,
        });
    }

    /**
     * Build the analysis prompt with all available data.
     * 
     * @param {Object} jobData
     * @param {Object[]} links
     * @param {Object[]} scrapedContent
     * @param {Object} depthConfig
     * @returns {{ systemInstruction: string, userMessage: string }}
     */
    _buildPrompt(jobData, links, scrapedContent, depthConfig) {
        // Build red flags reference
        const redFlagsText = Object.entries(RED_FLAGS_TAXONOMY)
            .map(([category, flags]) => {
                const categoryLabel = category.replace(/_/g, " ").toUpperCase();
                return `\n${categoryLabel}:\n${flags.map((f) => `  - ${f}`).join("\n")}`;
            })
            .join("\n");

        const systemInstruction = `You are a Job Legitimacy Analyzer — an expert system designed to protect job seekers from fraudulent postings.

Your task is to analyze a job listing (including any content scraped from external links) and determine its legitimacy.

${depthConfig.systemPromptAddition}

COMPREHENSIVE RED FLAGS TAXONOMY:
${redFlagsText}

ANALYSIS METHODOLOGY:
1. First, evaluate the primary job listing from LinkedIn
2. If external content was scraped from links in the description, cross-reference it with the LinkedIn listing
3. Check for consistency between sources — discrepancies are a major red flag
4. Consider the overall quality and professionalism of the posting
5. Factor in the company's verifiability and online presence

SPECIAL ATTENTION for external links:
- If the job description contains links that were scraped, compare the external content with the LinkedIn listing
- Differences in job title, company, requirements, or compensation between sources are suspicious
- External links to personal forms, suspicious domains, or non-HTTPS sites increase suspicion
- If external links failed to load, note this as a potential concern

RESPONSE FORMAT — Respond ONLY with valid JSON (no markdown, no code fences):
{
    "verdict": "SAFE" | "SUSPICIOUS" | "LIKELY_FAKE",
    "confidence": <number 1-100>,
    "riskScore": {
        "descriptionQuality": <1-10>,
        "compensationFlags": <1-10>,
        "companyLegitimacy": <1-10>,
        "applicationProcess": <1-10>,
        "externalContent": <1-10>,
        "overall": <1-10>
    },
    "reasons": ["reason1", "reason2", "reason3", ...],
    "positiveSignals": ["signal1", "signal2", ...],
    "summary": "A detailed 3-5 sentence summary of your analysis",
    "tips": "2-3 actionable tips for the applicant",
    "externalContentAnalysis": {
        "consistent": true|false,
        "discrepancies": ["discrepancy1", ...],
        "additionalInfo": "any useful info found in external links"
    }
}`;

        // Build user message with all available data
        let userMessage = `=== JOB LISTING ANALYSIS REQUEST ===

PRIMARY LISTING (from LinkedIn):

Job Title: ${jobData.title || "Not found"}
Company: ${jobData.company || "Not found"}
Location: ${jobData.location || "Not found"}
Workplace Type: ${jobData.workplaceType || "Not found"}
Posted Date: ${jobData.postedDate || "Not found"}
Applicant Count: ${jobData.applicantCount || "Not found"}
Salary/Pay: ${jobData.salary || "Not found"}
Seniority Level: ${jobData.seniorityLevel || "Not found"}
Employment Type: ${jobData.employmentType || "Not found"}
Job Function: ${jobData.jobFunction || "Not found"}
Industries: ${jobData.industries || "Not found"}`;

        // Add enriched description if available (includes external content)
        if (jobData.enrichedDescription) {
            userMessage += `\n\n=== ENRICHED CONTENT (LinkedIn + External Sources) ===\n${jobData.enrichedDescription}`;
        } else {
            // Fallback to original description
            userMessage += `\n\nJob Description:\n${jobData.description || "No description found"}`;
            if (jobData.companyDescription) {
                userMessage += `\n\nCompany Description:\n${jobData.companyDescription}`;
            }
        }

        // Add link analysis summary
        if (links.length > 0) {
            userMessage += `\n\n=== EXTERNAL LINKS FOUND (${links.length}) ===`;
            for (const link of links) {
                userMessage += `\n- [${link.category}] ${link.url}`;
                if (link.context) {
                    userMessage += ` (context: "${link.context.substring(0, 100)}")`;
                }
            }
        }

        // Add scraping results summary
        if (scrapedContent.length > 0) {
            const succeeded = scrapedContent.filter((s) => s.success);
            const failed = scrapedContent.filter((s) => !s.success);

            userMessage += `\n\n=== LINK SCRAPING RESULTS ===`;
            userMessage += `\nSuccessfully scraped: ${succeeded.length}/${scrapedContent.length}`;

            if (failed.length > 0) {
                userMessage += `\nFailed links:`;
                for (const f of failed) {
                    userMessage += `\n  ✗ ${f.url}: ${f.error}`;
                }
            }

            // Add metadata from successful scrapes
            for (const s of succeeded) {
                if (s.metadata?.pageTitle) {
                    userMessage += `\n  Page title for ${s.url}: "${s.metadata.pageTitle}"`;
                }
                if (s.metadata?.hasJobContent !== undefined) {
                    userMessage += `\n  Contains job content: ${s.metadata.hasJobContent}`;
                }
            }
        }

        // Add content source summary
        if (jobData.contentSources) {
            userMessage += `\n\n=== CONTENT SOURCES ===`;
            for (const source of jobData.contentSources) {
                userMessage += `\n- [${source.type}] ${source.source}: ${source.length} chars`;
            }
        }

        return { systemInstruction, userMessage };
    }

    /**
     * Call the Gemini API and parse the response.
     * 
     * @param {string} apiKey
     * @param {{ systemInstruction: string, userMessage: string }} prompt
     * @param {Object} depthConfig
     * @returns {Promise<Object>}
     */
    async _callGemini(apiKey, prompt, depthConfig) {
        const url = `${GEMINI_CONFIG.baseUrl}/${GEMINI_CONFIG.model}:generateContent?key=${apiKey}`;

        const body = {
            system_instruction: {
                parts: [{ text: prompt.systemInstruction }],
            },
            contents: [
                {
                    role: "user",
                    parts: [{ text: prompt.userMessage }],
                },
            ],
            generationConfig: {
                temperature: depthConfig.temperature || GEMINI_CONFIG.temperature,
                topP: GEMINI_CONFIG.topP,
                maxOutputTokens:
                    depthConfig.maxOutputTokens || GEMINI_CONFIG.maxOutputTokens,
            },
        };

        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(
                `Gemini API error (${response.status}): ${errorData.error?.message || "Unknown error"}`
            );
        }

        const data = await response.json();

        // Extract text from Gemini response
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) {
            throw new Error("Empty response from Gemini API");
        }

        // Parse JSON from response
        const cleanedText = text
            .replace(/```json\n?/g, "")
            .replace(/```\n?/g, "")
            .trim();

        try {
            const parsed = JSON.parse(cleanedText);
            return this._validateResponse(parsed);
        } catch (e) {
            throw new Error(
                "Failed to parse Gemini response as JSON. Raw: " +
                text.substring(0, 300)
            );
        }
    }

    /**
     * Validate and normalize the AI response.
     * Ensures all required fields are present with correct types.
     * 
     * @param {Object} response
     * @returns {Object} Validated response
     */
    _validateResponse(response) {
        // Ensure verdict is valid
        const validVerdicts = ["SAFE", "SUSPICIOUS", "LIKELY_FAKE"];
        if (!validVerdicts.includes(response.verdict)) {
            response.verdict = "SUSPICIOUS"; // Default to suspicious
        }

        // Ensure confidence is a number 1-100
        response.confidence = Math.min(
            100,
            Math.max(1, parseInt(response.confidence) || 50)
        );

        // Ensure reasons is an array
        if (!Array.isArray(response.reasons)) {
            response.reasons = [response.reasons || "Analysis inconclusive"];
        }

        // Ensure positive signals is an array
        if (!Array.isArray(response.positiveSignals)) {
            response.positiveSignals = [];
        }

        // Ensure summary is a string
        if (typeof response.summary !== "string") {
            response.summary = "Analysis complete. See reasons for details.";
        }

        // Ensure tips is a string
        if (typeof response.tips !== "string") {
            response.tips =
                "Always verify the company and role through independent research.";
        }

        // Ensure risk score object
        if (!response.riskScore || typeof response.riskScore !== "object") {
            response.riskScore = {
                descriptionQuality: 5,
                compensationFlags: 5,
                companyLegitimacy: 5,
                applicationProcess: 5,
                externalContent: 5,
                overall: 5,
            };
        }

        // Ensure external content analysis
        if (
            !response.externalContentAnalysis ||
            typeof response.externalContentAnalysis !== "object"
        ) {
            response.externalContentAnalysis = {
                consistent: true,
                discrepancies: [],
                additionalInfo: "",
            };
        }

        return response;
    }

    /**
     * Get the Gemini API key from Chrome storage.
     * @returns {Promise<string|null>}
     */
    _getApiKey() {
        return new Promise((resolve) => {
            chrome.storage.local.get(["geminiApiKey"], (result) => {
                resolve(result.geminiApiKey || null);
            });
        });
    }
}
