// ============================================================
// RoBERTa Tool
// Calls the HuggingFace Inference API to get a fraud probability
// from the fine-tuned RoBERTa model (aditya963/fraud-job-classifier).
//
// Input:  { jobData }
// Output: { fraudProbability, verdict, confidence, standardizedText, skipped }
// ============================================================

import { BaseTool, ToolResult } from "../lib/langchain-core.js";

const HF_MODEL_URL =
    "https://api-inference.huggingface.co/models/aditya963/fraud-job-classifier";

// Fraud probability threshold — matches the value used during training
const FRAUD_THRESHOLD = 0.87;

// Max chars of standardized text sent to the model (RoBERTa tokenizes to 512 tokens)
const MAX_INPUT_CHARS = 3000;

/**
 * Build the [SEP]-delimited input string that RoBERTa was trained on.
 * Mirrors Python's build_input_text() from pipeline_demo.py exactly.
 *
 * Structured fields come first (short key:value), then free-text fields.
 */
function buildInputText(jobData) {
    const structFields = [
        ["Location", jobData.location],
        ["Salary", jobData.salary],
        ["Employment Type", jobData.employmentType],
        ["Seniority Level", jobData.seniorityLevel],
        ["Job Function", jobData.jobFunction],
        ["Industries", jobData.industries],
        ["Workplace Type", jobData.workplaceType],
    ];

    const textFields = [
        jobData.title,
        jobData.company,
        jobData.description,
        jobData.companyDescription,
    ];

    const parts = [];

    for (const [label, val] of structFields) {
        const v = (val || "").trim();
        if (v) parts.push(`${label}: ${v}`);
    }

    for (const val of textFields) {
        const v = (val || "").trim();
        if (v) parts.push(v);
    }

    return parts.join(" [SEP] ").substring(0, MAX_INPUT_CHARS);
}

/**
 * RoBERTaTool — Runs the fine-tuned fraud classifier via HuggingFace Inference API.
 *
 * The model was trained on 17,880 job postings and achieves:
 *   F1 (fraud) = 0.907  |  AUC = 0.993  |  Threshold = 0.87
 *
 * If no HF API key is stored, the tool skips gracefully so the rest
 * of the pipeline (Gemini analysis) still runs.
 */
export class RoBERTaTool extends BaseTool {
    constructor() {
        super({
            name: "roberta_analyzer",
            description:
                "Runs fine-tuned RoBERTa fraud classifier via HuggingFace Inference API",
            version: "1.0.0",
            requiredInputFields: ["jobData"],
            outputFields: ["fraudProbability", "verdict", "confidence", "skipped"],
            cacheable: false,
        });
    }

    /**
     * @param {Object} input
     * @param {Object} input.jobData
     * @param {Object} context
     * @returns {Promise<ToolResult>}
     */
    async _execute(input, context) {
        const { jobData } = input;

        // Get HuggingFace API key
        const hfApiKey = await this._getHfApiKey();
        if (!hfApiKey) {
            console.log("[RoBERTa] No HF API key — skipping ML prediction");
            return ToolResult.ok(
                { skipped: true, reason: "No HuggingFace API key configured" },
                { skipped: true }
            );
        }

        // Build standardized input text
        const standardizedText = buildInputText(jobData);
        console.log(
            `[RoBERTa] Standardized input (${standardizedText.length} chars): "${standardizedText.substring(0, 120)}..."`
        );

        // Call HuggingFace Inference API
        const response = await fetch(HF_MODEL_URL, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${hfApiKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ inputs: standardizedText }),
        });

        if (!response.ok) {
            const errorText = await response.text().catch(() => "");
            // Model may be loading (503) — treat as skip rather than hard failure
            if (response.status === 503) {
                console.warn("[RoBERTa] Model is loading (503) — skipping for this request");
                return ToolResult.ok(
                    { skipped: true, reason: "Model is loading, please retry shortly" },
                    { skipped: true }
                );
            }
            throw new Error(`HuggingFace API error (${response.status}): ${errorText.substring(0, 200)}`);
        }

        // HF sequence classification response:
        // [[{label: "LABEL_0", score: 0.04}, {label: "LABEL_1", score: 0.96}]]
        // LABEL_0 = legitimate, LABEL_1 = fraudulent
        const data = await response.json();
        const scores = Array.isArray(data[0]) ? data[0] : data;

        let fraudProbability = 0;
        for (const item of scores) {
            if (item.label === "LABEL_1" || item.label === "1" || item.label === "FRAUDULENT") {
                fraudProbability = item.score;
                break;
            }
        }
        // Fallback: if labels are not as expected, take the higher score
        if (!fraudProbability && scores.length === 2) {
            fraudProbability = Math.max(scores[0].score, scores[1].score) === scores[0].score
                ? 1 - scores[0].score
                : scores[1].score;
        }

        const isFraud = fraudProbability >= FRAUD_THRESHOLD;
        const verdict = isFraud ? "FRAUDULENT" : "LEGITIMATE";

        // Confidence band: how far the probability is from the threshold
        const distFromThreshold = Math.abs(fraudProbability - FRAUD_THRESHOLD);
        const confidence =
            distFromThreshold > 0.25 ? "HIGH" :
            distFromThreshold > 0.10 ? "MEDIUM" : "LOW";

        console.log(
            `[RoBERTa] Fraud probability: ${(fraudProbability * 100).toFixed(1)}% → ${verdict} (${confidence} confidence)`
        );

        return ToolResult.ok(
            {
                skipped: false,
                fraudProbability: parseFloat(fraudProbability.toFixed(4)),
                fraudPercent: parseFloat((fraudProbability * 100).toFixed(1)),
                verdict,
                confidence,
                threshold: FRAUD_THRESHOLD,
                standardizedText,
            },
            { model: "aditya963/fraud-job-classifier", threshold: FRAUD_THRESHOLD }
        );
    }

    /**
     * Retrieve the HuggingFace API key from Chrome storage.
     * @returns {Promise<string|null>}
     */
    _getHfApiKey() {
        return new Promise((resolve) => {
            chrome.storage.local.get(["hfApiKey"], (result) => {
                resolve(result.hfApiKey || null);
            });
        });
    }
}
