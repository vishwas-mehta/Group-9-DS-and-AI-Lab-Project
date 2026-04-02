# Fake Job Listing Detection using Deep Learning and Agentic Generative AI

**Milestone 1**

<div align="center">
  <img src="./Workflow.png" alt="Proposed System Workflow Architecture" width="800">
  <br>
  <em>Figure 1: High-level architecture of the proposed agentic AI fake job detection system.</em>
</div>

---

## 1. Problem Statement

Every day, thousands of people search for jobs online. While this has made job hunting easier, it has also opened the door for scammers who post fake job listings. These fraudulent postings often look completely real — they have company names, job titles, salary ranges, and detailed descriptions. But their real goal is to steal money, personal information, or login credentials from unsuspecting job seekers.

Fraudsters create fake job advertisements to:

- Collect personal data (identity theft)
- Demand advance payment
- Conduct phishing attacks
- Scam job seekers emotionally and financially

These fake listings are often written professionally and look legitimate. Because of this, traditional detection methods fail to identify them accurately.

There is a strong need for an intelligent, scalable, and explainable AI system that can detect fake job listings automatically.

### Clear Problem Definition

The problem is:

> How can we accurately detect fake job listings using deep learning while also providing clear explanations and verification evidence for the prediction?

The system must:

- Take a job posting as input
- Predict whether it is fake or genuine
- Provide an explanation of why it is fake
- Verify suspicious attributes using additional tools

This project goes beyond simple classification and introduces an intelligent agent-based verification system.

### Current Status of Fake Job Listings

The current landscape of online job seeking is **highly vulnerable to fraud**, making the timely and accurate detection of fake job listings a critical necessity. The situation is **dire**, with thousands of job seekers falling victim to scams annually. These fraudulent listings are becoming increasingly sophisticated, exploiting common and unique vulnerabilities.

Many people are fooled by:

- **Common Scams:** These often involve requests for advance payments for training, background checks, or equipment; promises of unrealistically high salaries for simple work-from-home positions; or job offers made without any interview. (See examples of **Advance-Fee Scams** and **Work-at-Home Schemes** below).
- **Unique and Targeted Scams:** These use advanced tactics, such as mimicking the branding and website design of well-known, legitimate companies to steal personal information (phishing) or using social engineering to execute complex financial frauds. (See examples of **Corporate Impersonation** and **High-Value Scams** below).

The severity of this issue is underlined by continuous news reports and statistics that track the damage done to victims. This data shows just how **serious and widespread** the need is for an effective, multi-layered detection system.

---

#### News and Case Reports Highlighting the Severity of Fake Job Listings

Below are examples demonstrating the breadth and financial impact of job scams, emphasizing the urgent need for robust detection methods:

1. **Advance-Fee Recruitment Scams (Common):** Fake employers requesting registration or processing fees from applicants, then disappearing.
   - *Link:* [https://en.wikipedia.org/wiki/Advance-fee_scam](https://en.wikipedia.org/wiki/Advance-fee_scam)
2. **Work-from-Home Typing and Task Scams (Common):** Require upfront payments for materials or access but do not provide legitimate work.
   - *Link:* [https://en.wikipedia.org/wiki/Work-at-home_scheme](https://en.wikipedia.org/wiki/Work-at-home_scheme)
3. **Content-Writing/Sample Work Scams (Exploiting Freshers):** Students are asked to complete substantial assignments, which are then collected without hiring or payment.
   - *Report:* [https://www.linkedin.com/posts/loveena-sirohi_many-indian-students-fall-victim-to-a-job-activity-7272979802234527744-0b-C](https://www.linkedin.com/posts/loveena-sirohi_many-indian-students-fall-victim-to-a-job-activity-7272979802234527744-0b-C)
4. **Financial Fraud via Work-from-Home (India Focus):** Warnings from institutions about online offers demanding fees or personal data leading to fraud.
   - *Report:* [https://www.bajajfinserv.in/work-from-home-scam-guide](https://www.bajajfinserv.in/work-from-home-scam-guide)
5. **Corporate Impersonation (TCS Warning):** Fraudulent recruiters issuing fake interview calls and appointment letters using the company's name.
   - *Alert:* [https://www.tcs.com/careers/india/recruitment-fraud-alert](https://www.tcs.com/careers/india/recruitment-fraud-alert)
6. **Corporate Impersonation (Amazon Warning):** Impersonators sending fake job offers and requesting training or onboarding fees.
   - *Alert:* [https://amazon.jobs/content/en/how-we-hire/fraud-alert-india](https://amazon.jobs/content/en/how-we-hire/fraud-alert-india)
7. **High-Value Overseas Scam (Lucknow):** Resident lost ₹2.34 lakh after paying fees for a fraudulent overseas job offer with fake appointment documents.
   - *Report:* [https://timesofindia.indiatimes.com/city/lucknow/gomtinagar-resident-loses-rs-2-34l-in-fake-job-scam/articleshow/124818231.cms](https://timesofindia.indiatimes.com/city/lucknow/gomtinagar-resident-loses-rs-2-34l-in-fake-job-scam/articleshow/124818231.cms)
8. **Government Job Fraud (Bengaluru):** Job aspirants were cheated of ₹48 lakh by individuals promising High Court positions using fake recruitment procedures.
   - *Report:* [https://timesofindia.indiatimes.com/city/bengaluru/courting-trouble-4-job-aspirants-promised-high-court-posts-cheated-of-rs-48-lakh/articleshow/128759891.cms](https://timesofindia.indiatimes.com/city/bengaluru/courting-trouble-4-job-aspirants-promised-high-court-posts-cheated-of-rs-48-lakh/articleshow/128759891.cms)
9. **Exploitation/Trafficking (Overseas):** Case where youths were lured with overseas job promises but forced into cybercrime operations abroad.
   - *Report:* [https://timesofindia.indiatimes.com/city/jaipur/man-held-for-trafficking-youths-into-cybercrime/articleshow/128574088.cms](https://timesofindia.indiatimes.com/city/jaipur/man-held-for-trafficking-youths-into-cybercrime/articleshow/128574088.cms)
10. **The Hollywood Con Queen Scam (Unique/Targeted):** A major scam involving fake film production offers that persuaded professionals to travel and spend money on non-existent projects.
    - *Link:* [https://en.wikipedia.org/wiki/Hollywood_Con_Queen_scam](https://en.wikipedia.org/wiki/Hollywood_Con_Queen_scam)

---

## 2. Scope and Boundaries

### What this project covers:

- Analyzing **text-based job postings** that include job description, company profile, salary details, employment type, location, and contact information.
- Building a **deep learning model** (Transformer-based) to classify job listings as real or fake.
- Building an **agentic verification system** that checks specific suspicious attributes using multiple tools.
- Generating **human-readable explanations** for each decision the system makes.

### What this project does NOT cover:

- Detection of fake listings in non-English languages (the initial scope is English only).
- Full production-level deployment on a recruitment platform.
- Video or audio-based job scam detection.

---

## 3. Stakeholders

| Stakeholder | How They Are Affected |
| --- | --- |
| **Job Seekers** | Primary victims of fake listings; they risk financial loss and emotional distress. |
| **Recruitment Platforms** | Need to protect their reputation and maintain trust by filtering out fraudulent postings. |
| **Legitimate Employers** | Want to prevent misuse of their brand name. |
| **Cybersecurity & Trust Teams** | Responsible for platform safety; need intelligent tools to assist manual review. |
| **Researchers & AI Engineers** | Interested in advancing fraud detection, NLP, and explainable AI. |
| **Regulatory Bodies** | Government and consumer protection agencies that monitor online employment fraud. |

---

## 4. Project Objectives

The following objectives are measurable and directly aligned with solving the problem described above:

1. **Build a fraud classification model** using a pre-trained Transformer (like RoBERTa) that achieves at least **95% accuracy** and an **F1-score of 0.90 or above** on the EMSCAD dataset. **Detailed Implementation Report:** [TransformerImplementationPlan.docx](https://docs.google.com/document/u/0/d/15GrlPQBdA4N-3A80D5Lg5afILg35usXT/edit)

2. **Develop an agentic verification framework** that uses at least 3 verification tools (metadata anomaly detection, company domain validation, salary range checker) to cross-check suspicious attributes in a listing. **Detailed Preliminary Plan:** [Agentic System Integration Plan](https://docs.google.com/document/d/1Q2MGJDHn7yGBy1jOR6owZRh9HBsEFi64jevSFN2qMp4/edit?usp=sharing)

3. **Create an explainability layer** using a Generative AI component that produces a structured, human-readable fraud report for every analyzed listing — covering deceptive language, suspicious metadata, and verification mismatches.

4. **Deliver a working prototype** that can accept a job listing as input and output: (a) a fraud probability score, (b) a verdict (Fraudulent / Legitimate), and (c) a plain-language explanation.

---

## 5. Literature Review and Existing Solutions

This section reviews existing academic research and industry tools for fake job listing detection, highlighting their strengths and weaknesses.

### 5.1 Existing Approaches

Current fraud detection systems mainly rely on:

#### 5.1.1 Rule-Based and Keyword Filtering Approaches

**How they work:** These are the simplest methods. They flag job listings that contain certain suspicious words or phrases (e.g., "no experience needed," "work from home," "send money first").

**Strengths:**

- Very fast and easy to implement.
- Low computational cost.
- Easy to explain to non-technical stakeholders.

**Weaknesses:**

- Scammers easily bypass these filters by rewording their listings.
- High false positive rate — many legitimate jobs get flagged.
- Cannot understand context or nuance in language.

**Example tools:** Many early job board filters and basic spam detection systems use this approach.

---

#### 5.1.2 Machine Learning Approaches (Pre-Deep Learning)

Several academic papers have explored classical machine learning for fake job detection.

Vidros et al. (2017) — *"Automatic Detection of Online Recruitment Frauds"* — published one of the earliest studies using the EMSCAD dataset. They used features like TF-IDF text vectors along with metadata features and trained classifiers including Naive Bayes, Logistic Regression, Random Forest, and k-Nearest Neighbors.

| Model | Accuracy | F1-Score (Fraud Class) |
| --- | --- | --- |
| Naive Bayes | ~93% | ~0.62 |
| Logistic Regression | ~95% | ~0.73 |
| Random Forest | ~97% | ~0.82 |

**Strengths:**

- Better than simple keyword filtering.
- Random Forest handled feature importance well.

**Weaknesses:**

- TF-IDF does not capture word meaning or context (e.g., it treats "free" in "free training" and "free salary" the same way).
- Struggled with class imbalance (fraudulent listings are rare).
- No explanation of why a listing was flagged.

---

#### 5.1.3 Deep Learning Approaches (CNN, LSTM, BiLSTM)

With the rise of deep learning, researchers started using neural networks for better text understanding.

Alghamdi et al. (2020) and several other researchers applied Convolutional Neural Networks (CNNs) and Long Short-Term Memory (LSTM) networks on job listing text.

| Model | Accuracy | F1-Score (Fraud Class) |
| --- | --- | --- |
| CNN | ~96% | ~0.78 |
| LSTM | ~96.5% | ~0.80 |
| BiLSTM | ~97% | ~0.83 |

**Strengths:**

- Much better at capturing language patterns and sequences.
- BiLSTM reads text in both directions, improving context understanding.

**Weaknesses:**

- Still not great at capturing long-range dependencies in text (e.g., a contradiction between paragraph 1 and paragraph 5).
- Training takes longer and requires more data.
- Still operate as "black boxes" — no explanation of why something is fraudulent.

---

#### 5.1.4 Transformer-Based Approaches (BERT, RoBERTa)

The introduction of BERT (Bidirectional Encoder Representations from Transformers) by Google in 2018 revolutionized NLP tasks.

Mahfouz et al. (2019) and subsequent researchers fine-tuned BERT for job fraud detection and achieved significantly better results.

| Model | Accuracy | F1-Score (Fraud Class) | Precision | Recall |
| --- | --- | --- | --- | --- |
| BERT (base) | ~98% | ~0.88 | ~0.91 | ~0.85 |
| RoBERTa (base) | ~98.5% | ~0.91 | ~0.93 | ~0.89 |
| DistilBERT | ~97.5% | ~0.86 | ~0.89 | ~0.83 |

**Strengths:**

- Understands deep semantic meaning and context in text.
- Pre-trained on massive datasets — requires less task-specific data.
- State-of-the-art performance on text classification benchmarks.

**Weaknesses:**

- Computationally expensive (needs GPUs).
- Still focuses only on text — ignores structured metadata (salary, location, email).
- No multi-step reasoning or verification — a single model makes the call.
- No explanation layer.

---

#### 5.1.5 Explainable AI (XAI) Approaches

A few studies have tried to make fraud detection models explainable using tools like **LIME** (Local Interpretable Model-Agnostic Explanations) and **SHAP** (SHapley Additive exPlanations).

**Strengths:**

- Highlights which words or features contributed most to the fraud prediction.
- Increases user trust.

**Weaknesses:**

- LIME and SHAP show feature importance but not a human-friendly narrative explanation.
- These are difficult for non-technical users to understand.
- The explanations are technical (e.g., "word X had weight 0.45") rather than conversational.

---

### 5.2 Industry Standards & Evaluation Metrics

Fraud detection systems are evaluated using:

- Accuracy
- Precision
- Recall
- F1-Score
- ROC-AUC

Since fake job detection is an imbalanced classification problem, the most important metrics are:

- **Precision** (reduce false positives)
- **Recall** (detect maximum fraud cases)
- **F1-Score** (balance of both)

---

## 6. Gap Analysis and Our Approach

Based on the literature review, the following key gaps exist in current solutions:

### Gaps in Existing Work

| Gap | Description |
| --- | --- |
| **No multi-step agentic verification** | Current models make a single prediction without verifying specific claims in the listing (company domain, salary range, email legitimacy). |
| **Poor explainability** | Most models are black boxes. LIME/SHAP provide numbers, not narratives. Job seekers cannot understand why a listing was flagged. |
| **Ignoring metadata** | Many models only use job description text, ignoring powerful signals like email domain, missing company info, and unrealistic salaries. |
| **Class imbalance not well handled** | Fraudulent listings are rare (~4.8% of data). Most models have low recall on the fraud class, meaning many fake jobs slip through. |
| **No generative explanation** | No existing system gives a user-friendly, structured, human-readable fraud report. |

### How Our Approach Addresses These Gaps

| Our Component | Gap Addressed |
| --- | --- |
| **Transformer Classifier (RoBERTa)** | High-accuracy text understanding, beating older ML/DL baselines. |
| **Agentic Verification Framework** | Multi-step verification of metadata, company domains, and email patterns — not just taking the text at face value. |
| **Generative AI Explanation Layer** | Produces a readable, structured fraud report — not just a score or a list of features. |
| **Combined Text + Metadata pipeline** | Catches more fraud signals than text-only models. |

---

## Key Differences from Existing Systems

| Feature | Traditional ML | Deep Learning | Proposed System |
| --- | --- | --- | --- |
| Context Understanding | Low | High | High |
| Metadata Verification | No | No | Yes |
| Multi-step Reasoning | No | No | Yes |
| Structured Explanation | No | Limited | Yes |
| Agent-Based System | No | No | Yes |

---

## Opportunities

This project creates major opportunities:

1. Improve trust in online hiring platforms
2. Reduce financial scams
3. Provide explainable AI for real-world use
4. Introduce agentic AI in fraud detection
5. Extend framework to:
   - Fake product reviews
   - Phishing email detection
   - Online marketplace fraud

---

## 7. References

1. Vidros, S., Kolias, C., Kambourakis, G., & Maglaras, L. (2017). *Automatic Detection of Online Recruitment Frauds: Characteristics, Methods, and a Public Dataset*. Future Internet, 9(1), 6. <https://doi.org/10.3390/fi9010006>
2. Devlin, J., Chang, M. W., Lee, K., & Toutanova, K. (2019). *BERT: Pre-training of Deep Bidirectional Transformers for Language Understanding*. NAACL-HLT 2019. <https://arxiv.org/abs/1810.04805>
3. Liu, Y., Ott, M., Goyal, N., et al. (2019). *RoBERTa: A Robustly Optimized BERT Pretraining Approach*. arXiv. <https://arxiv.org/abs/1907.11692>
4. Amaar, A., Aljedaani, W., Rustam, F., Ullah, S., Rupapara, V., & Ludi, S. (2022). *Detection of Fake Job Postings by Using Machine Learning and Natural Language Processing*. Neural Processing Letters, 54, 3323–3346. <https://doi.org/10.1007/s11063-022-10731-1>
5. Alghamdi, J., Lin, Y., & Luo, S. (2020). *Toward Online Recruitment Fraud Detection: A Machine Learning and Deep Learning Approach*. IEEE International Conference on Big Data. <https://doi.org/10.1109/BigData50022.2020.9378021>
6. Ribeiro, M. T., Singh, S., & Guestrin, C. (2016). *"Why Should I Trust You?": Explaining the Predictions of Any Classifier*. KDD 2016. <https://arxiv.org/abs/1602.04938>
7. Lundberg, S. M., & Lee, S. I. (2017). *A Unified Approach to Interpreting Model Predictions (SHAP)*. NeurIPS 2017. <https://arxiv.org/abs/1705.07874>
8. Park, J., & Kim, D. (2022). *Employment Scam Detection Using BERT-Based Text Classification and Metadata Feature Engineering*. Applied Sciences, 12(14). <https://doi.org/10.3390/app12147197>
9. Chawla, N. V., Bowyer, K. W., Hall, L. O., & Kegelmeyer, W. P. (2002). *SMOTE: Synthetic Minority Over-sampling Technique*. Journal of Artificial Intelligence Research, 16, 321–357. <https://doi.org/10.1613/jair.953>
10. EMSCAD Dataset — Employment Scam Aegean Dataset. University of the Aegean. Available at: <https://www.kaggle.com/datasets/shivamb/real-or-fake-fake-jobposting-prediction>
