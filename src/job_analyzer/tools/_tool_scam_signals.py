"""
Need to modify using llm

TOOL: Scam signal detector — keyword-based weighted scoring.
100% free — no library, no API, pure Python keyword matching.

Score: 0-100.  risk_level: low / medium / high
"""
import sys, json
sys.path.insert(0, "..")

RULES = {
    "asks_for_money": {
        "keywords": ["registration fee","pay a fee","processing fee",
                     "security deposit","upfront payment","pay to join","training fee"],
        "weight": 30,
        "description": "Job asks applicant to pay money upfront",
    },
    "requests_bank_details": {
        "keywords": ["bank account","account number","ifsc code",
                     "upi id","send money","western union","wire transfer"],
        "weight": 35,
        "description": "Posting requests sensitive banking/financial information",
    },
    "high_pressure": {
        "keywords": ["immediate joining","urgent hiring","limited slots",
                     "apply immediately","last day today","only 10 seats","hurry"],
        "weight": 15,
        "description": "Uses high-pressure urgency to rush applicants",
    },
    "unrealistic_promises": {
        "keywords": ["earn daily","easy money","no experience needed",
                     "guaranteed income","make money from home","passive income",
                     "work 2 hours","earn lakhs weekly"],
        "weight": 20,
        "description": "Promises unrealistic salary or income",
    },
    "unofficial_contact": {
        "keywords": ["whatsapp only","telegram only","contact on whatsapp",
                     "message on telegram","gmail.com","yahoo.com","outlook.com"],
        "weight": 15,
        "description": "Contact only via personal/unofficial channels",
    },
    "pre_interview_docs": {
        "keywords": ["aadhaar copy","pan card copy","passport copy",
                     "id proof before interview","documents before hiring",
                     "send photo id"],
        "weight": 25,
        "description": "Demands identity documents before formal interview",
    },
    "vague_company": {
        "keywords": ["undisclosed company","confidential client",
                     "mnc company hiring","us based company hiring locally"],
        "weight": 10,
        "description": "Company identity is deliberately hidden",
    },
}

def detect_scam_signals(job_text: str) -> dict:
    """
    Score a job posting for scam indicators.

    INPUT : raw job posting text
    OUTPUT: {ok, data: {scam_score, risk_level, signals_found, matched_signals}}

    Test: python tool_scam_signals.py
    """
    if not job_text:
        return {"ok": False, "error": "job_text is required"}

    text_lower = job_text.lower()
    matched    = {}
    score      = 0

    for rule_name, rule in RULES.items():
        hits = [kw for kw in rule["keywords"] if kw in text_lower]
        if hits:
            matched[rule_name] = {
                "description":      rule["description"],
                "matched_keywords": hits,
                "weight":           rule["weight"],
            }
            score += rule["weight"] * len(hits)

    score = min(score, 100)

    return {
        "ok": True,
        "data": {
            "scam_score":      score,
            "risk_level":      "high" if score >= 60 else "medium" if score >= 25 else "low",
            "signals_found":   len(matched),
            "is_clean":        len(matched) == 0,
            "matched_signals": matched,
        }
    }


if __name__ == "__main__":
    fake = ("Urgent! No experience needed. Earn daily from home. "
            "WhatsApp only. Pay registration fee. Send Aadhaar copy.")
    print(json.dumps(detect_scam_signals(fake), indent=2))
