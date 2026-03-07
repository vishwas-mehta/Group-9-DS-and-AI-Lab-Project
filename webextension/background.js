// ============================================================
// Background Service Worker — Gemini API Communication
// This is the file you'll swap out for your agentic flow later.
// ============================================================

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === "ANALYZE_JOB") {
        handleAnalyzeJob(request.data)
            .then((result) => sendResponse({ success: true, data: result }))
            .catch((error) =>
                sendResponse({ success: false, error: error.message })
            );
        return true;
    }
});

async function handleAnalyzeJob(jobData) {
    const apiKey = await getApiKey();
    if (!apiKey) {
        throw new Error(
            "No Gemini API key found. Click the extension icon to set your API key."
        );
    }
    const prompt = buildPrompt(jobData);
    const result = await callGeminiAPI(apiKey, prompt);
    return result;
}

function getApiKey() {
    return new Promise((resolve) => {
        chrome.storage.local.get(["geminiApiKey"], (result) => {
            resolve(result.geminiApiKey || null);
        });
    });
}

function buildPrompt(jobData) {
    const systemInstruction = `You are a Job Legitimacy Analyzer. Your role is to analyze job listings and determine whether they are legitimate, suspicious, or potentially fake.

Analyze the following job listing data scraped from LinkedIn. Consider these red flags:
- Vague job descriptions with no specific responsibilities
- Unrealistically high salary for the role/experience level
- No company information or very new company
- Requests for personal information or upfront payments
- Poor grammar and spelling
- Too-good-to-be-true benefits
- No clear job requirements
- Generic company descriptions
- Suspicious contact methods
- Immediate hire without interview promises

Respond ONLY with valid JSON in this exact format (no markdown, no code fences):
{
  "verdict": "SAFE" | "SUSPICIOUS" | "LIKELY_FAKE",
  "confidence": <number 1-100>,
  "reasons": ["reason1", "reason2", "reason3"],
  "summary": "A brief 2-3 sentence summary of your analysis",
  "tips": "One actionable tip for the applicant"
}`;

    const userMessage = `Here is the job listing data to analyze:

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
Industries: ${jobData.industries || "Not found"}

Job Description:
${jobData.description || "No description found"}

Company Description:
${jobData.companyDescription || "Not found"}`;

    return { systemInstruction, userMessage };
}
