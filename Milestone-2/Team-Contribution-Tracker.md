# Team Contribution Tracker — Milestone 2

**Project:** Fake Job Listing Detection using Deep Learning and Agentic Generative AI

This document tracks the work completed and responsibilities assigned for Milestone 2.

---

## 1. Arun Dutta — Project Planning & Documentation Lead

### Contributions in Milestone 2

- **Project Outlining & Markdown Creation:** Created and structured the project markdown files, including the `Milestone-2-Report.md` and `Team-Contribution-Tracker.md`.
- **Task Management:** Defined and allocated the required project work across the team, setting a clear roadmap for Milestone 2.

---

## 2. Hritik Roshan Maurya — Agentic AI Engineering & Real-Time Data Architecture Lead

### Contributions in Milestone 2

- **LangChain v1.x Agent For Data Collection:** Successfully implemented the agentic extraction architecture required to build our real-time dataset from unstructured files.
- **Real-Time Job Data Extractor:** Designed and implemented the `job_parser_agent.py` module capable of parsing PDFs, Word docs, and HTML job postings to convert raw files into structured data.
- **Structured Output Engineering:** Utilized `.with_structured_output()` for high-precision extraction of 16 key job features (Title, Description, Benefits, etc.) to match the primary Kaggle dataset schema.
- **CLI & Integration Layer:** Developed an easy-to-use CLI agent and library interface to support seamless integration of real-world job data into the pipeline.

---

## 3. Vivek Bajaj — Dataset Identification & Pipeline Lead

### Contributions in Milestone 2

- **Primary Dataset Identification & Curation:** Spearheaded the research, selection, and processing of the primary Kaggle fake job posting dataset and supplementary OOD datasets, ensuring they met the project's criteria for fraud detection.
- **Data Augmentation Strategy:** Designed the synthetic data augmentation strategy using GPT-4, setting conditional triggers to generate supplementary data if fraud recall targets were unmet due to class imbalance.
- **Baseline Fraud Classifier:** Built the initial training notebook featuring a RoBERTa fraud classifier to validate the dataset's efficacy, utilizing Optuna Hyperparameter Optimization (HPO) and Focal Loss.
- **Model Deployment & Documentation:** Wrote the project README detailing the training results, inference usage instructions, and published the final model to the HuggingFace Hub.

---

## 4. Vishwas Mehta — Browser Extension Engineering Lead

### Contributions in Milestone 2

- **Browser Extension Development:** Worked on the browser extension to integrate fake job detection capabilities directly into the user's browser, enabling real-time classification.
