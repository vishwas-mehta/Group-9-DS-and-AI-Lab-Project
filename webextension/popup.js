// ============================================================
// Popup Script — API Key Management
// ============================================================

document.addEventListener("DOMContentLoaded", () => {
    const apiKeyInput = document.getElementById("api-key");
    const hfApiKeyInput = document.getElementById("hf-api-key");
    const saveBtn = document.getElementById("save-btn");
    const toggleKeyBtn = document.getElementById("toggle-key");
    const toggleHfKeyBtn = document.getElementById("toggle-hf-key");
    const statusDot = document.getElementById("status-dot");
    const statusText = document.getElementById("status-text");

    // ── Load saved keys ──────────────────────────────────────
    chrome.storage.local.get(["geminiApiKey", "hfApiKey"], (result) => {
        if (result.geminiApiKey) {
            apiKeyInput.value = result.geminiApiKey;
        }
        if (result.hfApiKey) {
            hfApiKeyInput.value = result.hfApiKey;
        }
        setStatus(!!result.geminiApiKey, !!result.hfApiKey);
    });

    // ── Save keys ────────────────────────────────────────────
    saveBtn.addEventListener("click", () => {
        const geminiKey = apiKeyInput.value.trim();

        if (!geminiKey) {
            shakeButton();
            return;
        }

        const toStore = { geminiApiKey: geminiKey };
        const hfKey = hfApiKeyInput.value.trim();
        if (hfKey) toStore.hfApiKey = hfKey;

        chrome.storage.local.set(toStore, () => {
            saveBtn.classList.add("saved");
            saveBtn.querySelector(".btn-text").textContent = "✓ Saved!";
            setStatus(true, !!hfKey);

            setTimeout(() => {
                saveBtn.classList.remove("saved");
                saveBtn.querySelector(".btn-text").textContent = "Save Keys";
            }, 2000);
        });
    });

    // ── Toggle visibility ─────────────────────────────────────
    toggleKeyBtn.addEventListener("click", () => {
        apiKeyInput.type = apiKeyInput.type === "password" ? "text" : "password";
        toggleKeyBtn.textContent = apiKeyInput.type === "password" ? "👁️" : "🔒";
    });

    toggleHfKeyBtn.addEventListener("click", () => {
        hfApiKeyInput.type = hfApiKeyInput.type === "password" ? "text" : "password";
        toggleHfKeyBtn.textContent = hfApiKeyInput.type === "password" ? "👁️" : "🔒";
    });

    // ── Helpers ──────────────────────────────────────────────
    function setStatus(hasGemini, hasHf) {
        if (hasGemini && hasHf) {
            statusDot.className = "status-dot active";
            statusText.textContent = "Gemini + RoBERTa ready — Full analysis enabled";
        } else if (hasGemini) {
            statusDot.className = "status-dot active";
            statusText.textContent = "Gemini ready — Add HF token for ML model";
        } else {
            statusDot.className = "status-dot inactive";
            statusText.textContent = "No Gemini key — Enter key below";
        }
    }

    function shakeButton() {
        saveBtn.style.animation = "shake 0.4s ease";
        apiKeyInput.style.borderColor = "rgba(255, 107, 107, 0.5)";
        setTimeout(() => {
            saveBtn.style.animation = "";
            apiKeyInput.style.borderColor = "";
        }, 400);
    }
});
