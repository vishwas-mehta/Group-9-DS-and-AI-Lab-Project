# Metadata Anomaly Detector

### Fake Job Listing Detection System

### DS & AI Lab Project – Technical Report

---

# 1. Introduction

Online recruitment platforms have significantly simplified job searching but have also enabled the rapid proliferation of fraudulent job listings. These listings often mimic legitimate job advertisements and exploit job seekers through scams such as advance-fee fraud, phishing attacks, and identity theft.

While modern NLP models can analyze textual content of job descriptions, fraudulent postings also exhibit **structural anomalies in their metadata**. For example:

* Missing company information
* Absence of company logos
* Unrealistic job requirements
* Lack of salary details
* Suspicious remote work offers

To detect such patterns, this project implements a **Metadata Anomaly Detector** as part of a larger **Agentic Fraud Detection System**.

The Metadata Detector combines:

* **Rule-based fraud signals derived from explainable machine learning**
* **Unsupervised anomaly detection using Isolation Forest**
* **Feature engineering from job posting metadata**

The objective is to detect **structural inconsistencies in job postings that may indicate fraudulent activity**.

---

# 2. System Architecture

The Metadata Detector is implemented as **Tool-2** within the overall fraud detection pipeline.

## Overall Fraud Detection System

```
Job Listing Input
        ↓
Agent Controller
        ↓
Tool 1: Transformer Fraud Classifier
Tool 2: Metadata Anomaly Detector
Tool 3: Company Verification
        ↓
Evidence Aggregation
        ↓
GenAI Explanation Generator
        ↓
Fraud Risk Report
```

The Metadata Detector focuses exclusively on **metadata-based fraud indicators**.

---

# 3. Metadata Detector Architecture

The Metadata Detector consists of three major components:

```
MetadataDetector
      │
      ├── MetadataPreprocessor
      ├── MetadataAnomalyModel (Isolation Forest)
      └── RulesEngine (Data-Driven Fraud Rules)
```

### Workflow

```
Raw Job Posting
      ↓
MetadataPreprocessor
      ↓
Feature Vector
      ↓
Isolation Forest Anomaly Detection
      ↓
Rule Engine Evaluation
      ↓
Combined Metadata Risk Score
```

---

# 4. File-Level System Design

The metadata detector module is implemented in:

```
src/tools/metadata_detector/
```

### Module Structure

```
metadata_detector/
│
├── __init__.py
├── metadata_preprocessing.py
├── anomaly_model.py
├── rules_engine.py
└── detector.py
```

---

# 5. MetadataPreprocessor

### Purpose

The `MetadataPreprocessor` transforms raw job posting data into a structured feature representation suitable for machine learning models.

### Responsibilities

1. Handle missing values
2. Convert categorical metadata into numerical features
3. Generate derived metadata signals

### Example Features

| Feature                 | Description                     |
| ----------------------- | ------------------------------- |
| telecommuting           | Whether the job is remote       |
| has_company_logo        | Presence of company logo        |
| has_questions           | Application screening questions |
| missing_company_profile | Binary indicator                |
| missing_salary          | Missing salary range            |
| missing_department      | Missing department field        |

### Why Preprocessing is Necessary

Machine learning algorithms require **numerical input features**. Raw job metadata often contains:

* categorical variables
* missing fields
* textual indicators

Feature engineering transforms these attributes into **structured signals usable by anomaly detection models**.

---

# 6. MetadataAnomalyModel

### Model Used

**Isolation Forest**

Implemented in:

```
anomaly_model.py
```

### Algorithm Overview

Isolation Forest is an **unsupervised anomaly detection algorithm** that isolates anomalies by randomly partitioning the data space.

Unlike traditional models that profile normal instances, Isolation Forest works by:

1. Randomly selecting a feature
2. Randomly selecting a split value
3. Recursively partitioning the data

Anomalies are **isolated faster** because they are rare and different from normal data points.

### Model Configuration

```
IsolationForest(
    n_estimators = 200
    contamination = 0.05
    random_state = 42
)
```

### Output

The model produces an anomaly score which is normalized to a range:

```
0 → normal metadata
1 → highly anomalous metadata
```

### Why Isolation Forest Was Chosen

Isolation Forest is well suited for this task because:

* It works with **high dimensional tabular data**
* It **does not require labeled fraud examples**
* It is widely used in **fraud detection systems**

Reference:

Liu, F.T., Ting, K.M., Zhou, Z.H. (2008)
Isolation Forest. *IEEE International Conference on Data Mining.*

---

# 7. RulesEngine

### Purpose

While anomaly detection captures unusual patterns, many fraud signals are **well-known heuristics**.

The Rules Engine encodes **interpretable fraud rules derived from explainable ML analysis**.

Example rules include:

| Rule                    | Rationale                                  |
| ----------------------- | ------------------------------------------ |
| Missing company profile | Fraud postings often hide company details  |
| No company logo         | Legitimate companies usually include logos |
| Remote job listing      | Many scams advertise remote jobs           |
| Missing salary          | Fraud postings hide compensation details   |
| Entry-level requirement | Scammers target inexperienced applicants   |

### Example Rule

```
if row["missing_company_profile"] == 1:
    score += 0.25
```

The rule engine returns:

```
{
 flags: [triggered rules],
 rule_score: normalized score
}
```

---

# 8. Rule Discovery Methodology

Fraud rules were **not arbitrarily chosen**. Instead they were derived through a systematic data analysis process.

Three explainable ML techniques were used:

### 1. LightGBM Feature Importance

A gradient boosting model was trained on metadata features to identify which attributes most influence fraud prediction.

Observed key features:

* missing_company_profile
* has_company_logo
* telecommuting
* missing_salary

### 2. SHAP (SHapley Additive Explanations)

SHAP analysis was used to understand **how individual features affect model predictions**.

SHAP summary plots showed that:

* missing company profile strongly increases fraud probability
* absence of company logo increases fraud probability
* remote job listings correlate with fraud

### 3. Explainable Boosting Machines (EBM)

EBM models were trained to extract **interpretable feature contributions**.

EBM confirmed:

* metadata completeness is a strong fraud indicator
* certain job attributes interact to increase fraud risk

These techniques provided **model-validated evidence** for the final rule set.

---

# 9. Metadata Risk Score Calculation

The Metadata Detector combines anomaly detection and rule-based signals.

```
final_score =
0.7 * anomaly_score
+ 0.3 * rule_score
```

This weighting reflects:

| Signal        | Weight | Reason                         |
| ------------- | ------ | ------------------------------ |
| Anomaly score | 0.7    | structural anomaly detection   |
| Rule score    | 0.3    | interpretable fraud indicators |

The final risk score is classified into:

| Score     | Risk Level |
| --------- | ---------- |
| 0 – 0.3   | Low        |
| 0.3 – 0.6 | Medium     |
| 0.6 – 1.0 | High       |

---

# 10. Example Output

```
{
 "metadata_risk_score": 0.745,
 "anomaly_score": 1.0,
 "rule_score": 0.15,
 "flags": ["missing_salary"],
 "risk_level": "high"
}
```

Interpretation:

* metadata pattern is highly anomalous
* at least one fraud rule triggered
* job posting classified as high risk

---

# 11. Advantages of the Metadata Detector

The system provides several benefits:

### Interpretability

Fraud signals are transparent through rule explanations.

### Robustness

Combining anomaly detection and rules improves reliability.

### Scalability

Isolation Forest scales efficiently to large datasets.

### Complementarity

Metadata analysis complements NLP-based fraud detection.

---

# 12. Integration with the Overall System

The Metadata Detector operates alongside other components.

```
Transformer Classifier → detects textual fraud patterns
Metadata Detector → detects structural anomalies
Company Verifier → evaluates employer legitimacy
```

The outputs are combined by the **Evidence Aggregator** to produce the final fraud probability.

---

# 13. Related Research

Several studies have explored machine learning methods for fraud detection.

1. Liu, F.T., Ting, K.M., Zhou, Z.H. (2008)
   *Isolation Forest*. IEEE International Conference on Data Mining.

2. Lundberg, S., Lee, S. (2017)
   *A Unified Approach to Interpreting Model Predictions*.
   Advances in Neural Information Processing Systems.

3. Caruana, R. et al. (2015)
   *Intelligible Models for Healthcare: Predicting Pneumonia Risk*.
   KDD Conference.

4. Ribeiro, M. et al. (2016)
   *Why Should I Trust You? Explaining the Predictions of Any Classifier*.
   ACM SIGKDD.

5. Dal Pozzolo, A. et al. (2017)
   *Credit Card Fraud Detection: A Realistic Modeling Approach*.
   IEEE Transactions on Neural Networks.

These works demonstrate the effectiveness of combining **anomaly detection and interpretable machine learning for fraud detection tasks**.

---

# 14. Conclusion

The Metadata Anomaly Detector provides a robust mechanism for identifying suspicious job postings based on structural metadata patterns.

Key contributions of this module include:

* Feature engineering for job posting metadata
* Unsupervised anomaly detection using Isolation Forest
* Interpretable fraud rule discovery via explainable ML
* Integration of rule-based and statistical fraud signals

The module forms a critical component of the larger **Agentic Fraud Detection System**, complementing textual analysis and company verification to provide comprehensive fraud risk assessment.

---

# 15. Future Improvements

Possible extensions include:

* dynamic rule weighting using Bayesian methods
* company legitimacy verification using external databases
* graph-based employer reputation analysis
* temporal analysis of job posting behavior

These improvements could further enhance the accuracy and reliability of the fraud detection system.

---
