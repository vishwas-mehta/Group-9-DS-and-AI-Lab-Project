# 1.1 Directory Structure

## Repository-Level Directory Structure

The project follows a clean separation of concerns across data, source code, experimentation notebooks, deployment tooling, and milestone documentation.

```
Group-9-DS-and-AI-Lab-Project/             ← Repository Root
│
├── data/                                  ← 🗂️ All Datasets (git-ignored, see §1.1.1 below)
│   └── raw/
│       └── fake_job_postings.csv          ← Raw dataset (17,880 rows × 18 columns)
│                                             Source: Kaggle — shivamb/real-or-fake-fake-jobposting-prediction
│
├── models/                                ← 🗂️ Saved Model Artifacts (git-ignored, see §1.1.2 below)
│   └── roberta-focal-best/                ← Best trained model checkpoint
│       ├── config.json                    ← Model architecture config
│       ├── model.safetensors              ← Trained weights (~500 MB)
│       ├── tokenizer.json                 ← BPE tokenizer vocabulary
│       ├── tokenizer_config.json          ← Tokenizer settings
│       ├── special_tokens_map.json        ← Special token definitions
│       ├── inference_config.json          ← Threshold, metrics, HP snapshot
│       └── training_summary.json          ← Best epoch, final metrics summary
│
├── src/                                   ← 🧠 Core Source Code
│   ├── __init__.py
│   ├── train.py                           ← Production training script
│   ├── eval.py                            ← Production evaluation script
│   ├── utils/                             ← Shared utility modules
│   │   ├── __init__.py                    ← Public API exports
│   │   ├── data.py                        ← Data loading, feature engineering, splits
│   │   ├── focal_loss.py                  ← FocalLoss + FocalLossTrainer
│   │   └── metrics.py                     ← Evaluation metrics, threshold sweep
│   └── tools/                             ← Auxiliary detection tools
│       ├── __init__.py
│       └── metadata_detector/             ← Metadata-based anomaly detector
│           ├── __init__.py
│           ├── detector.py                ← MetadataDetector orchestrator
│           ├── metadata_preprocessing.py  ← Feature engineering for metadata
│           ├── anomaly_model.py           ← IsolationForest anomaly model
│           └── rules_engine.py            ← Rule-based fraud signal scorer
│
├── notebook/                              ← 📓 Experimentation Notebooks
│   ├── transformer_fraud_classifier_v3_1.ipynb  ← Full experimentation (EDA → Optuna → eval)
│   └── rule_discovery_ebm.ipynb           ← EBM-based interpretable rule discovery
│
├── webextension/                          ← 🌐 Chrome Extension — LinkedIn Job Predictor
│   ├── manifest.json                      ← Extension manifest (MV3)
│   ├── background.js                      ← Service worker (API calls)
│   ├── content.js                         ← Page content extraction
│   ├── content.css                        ← Injected page styles
│   ├── popup.html                         ← Extension popup UI
│   ├── popup.css                          ← Popup styling
│   ├── popup.js                           ← Popup logic
│   ├── icons/                             ← Extension icons
│   │   ├── icon16.png
│   │   ├── icon48.png
│   │   └── icon128.png
│   ├── lib/                               ← Bundled JS libraries
│   │   ├── langchain-core.js
│   │   └── pipeline.js
│   ├── tools/                             ← Analysis tools for extension
│   │   ├── job-analyzer-tool.js
│   │   ├── link-detector.js
│   │   ├── link-scraper.js
│   │   └── text-extractor.js
│   ├── .gitignore
│   ├── README.md
│   ├── SETUP.md
│   ├── ARCHITECTURE.md
│   └── CHAIN_DOCS.md
│
├── AgenticWork/                           ← 🤖 LLM-Powered Job Parser Agent
│   ├── job_parser_agent.py                ← Extracts 18 structured features from job docs
│   ├── example.py                         ← Usage example
│   ├── job1.pdf                           ← Sample job posting (PDF)
│   ├── requirements.txt                   ← Agent-specific dependencies
│   └── README.md
│
├── Milestone-1/                           ← 📋 Milestone 1 Deliverables
│   ├── Milestone-1-Report.md
│   ├── Milestone-1-Slides.pdf
│   ├── Milestone-1-Slides.pptx
│   ├── Milestone-1-Slides_0.pdf
│   ├── Milestone-1-Slides_0.pptx
│   ├── Team-Contribution-Tracker.md
│   └── Workflow.png
│
├── Milestone-2/                           ← 📋 Milestone 2 Deliverables
│   ├── Milestone-2-Report.pdf
│   ├── Milestone-2-Slides.pdf
│   ├── Milestone-2-Slides.pptx
│   └── Team-Contribution-Tracker.md
│
├── Milestone-3/                           ← 📋 Milestone 3 Deliverables (This Report)
│   ├── Milestone-3-Report.md              ← Primary report
│   ├── Milestone-3-Report-2.md            ← Supplementary report
│   ├── Milestone3_pipeline.py             ← End-to-end pipeline verification script
│   ├── Slides1.pdf                        ← Presentation slides (Part 1)
│   ├── Slides2.pdf                        ← Presentation slides (Part 2)
│   ├── Team-Contribution-Tracker.md
│   └── Infographics/                      ← Report diagrams & visuals
│       ├── Archi.png
│       ├── ArchiJusti.png
│       ├── DataFlow.png
│       ├── DataSplit.png
│       ├── DataSteps.png
│       ├── DirectoryStructure.png
│       ├── EndEndPipe.png
│       ├── Head.png
│       └── Overview.png
│
├── docs/                                  ← 📄 Project Documentation
│   ├── problem_statement.md               ← Problem statement description
│   ├── metadata_detector.md               ← Metadata detector documentation
│   ├── Milestone3_Report.pdf              ← Compiled Milestone 3 PDF report
│   └── Group9_ProblemStatement.pdf        ← Official problem statement PDF
│
├── static/                                ← 🖼️ Static Assets
│   └── Milestone2Summary.png              ← Summary infographic (used in README)
│
├── Group9-Statement/                      ← 📄 Original Problem Statement
│   └── Group9_ProblemStatement.pdf
│
├── IntialWork/                            ← 📝 Early-Stage / Rough Work
│   ├── M3_report_rough.md                 ← Rough draft for Milestone 3 report
│   ├── Slides _ArunM1.pdf
│   └── Slides-M1.pdf
│
├── checkpoints/                           ← Training checkpoints (git-ignored)
│
├── requirements.txt                       ← Python dependencies (pip install -r)
├── README.md                              ← Project overview & usage guide
├── Workflow.png                           ← High-level workflow diagram
└── .gitignore                             ← Git exclusions (data/, models/, checkpoints/, etc.)
```

---

## 1.1.1 Dataset Organisation — Raw & Processed Data

The raw dataset is stored under the `data/` directory (git-ignored to avoid committing large files to version control). The full Kaggle CSV is the single source of truth; all processed artifacts are generated **in-memory** at runtime.

```
data/
└── raw/
    └── fake_job_postings.csv              ← 17,880 rows × 18 columns
                                              • 17,014 legitimate (95.2%)
                                              •    866 fraudulent  (4.8%)
                                              Source: Kaggle (shivamb/real-or-fake-fake-jobposting-prediction)
```

| Attribute | Details |
|---|---|
| **File** | `fake_job_postings.csv` |
| **Rows** | 17,880 job postings |
| **Columns** | 18 features (see table below) |
| **Label Column** | `fraudulent` (0 = Legitimate, 1 = Fraudulent) |
| **Class Distribution** | 95.2% Legitimate · 4.8% Fraudulent |
| **Storage** | Local only (git-ignored via `.gitignore`) |
| **Hosted Weights** | [aditya963/fraud-job-classifier](https://huggingface.co/aditya963/fraud-job-classifier) on HuggingFace Hub |

### Feature Categories

| Category | Columns | Usage in Pipeline |
|---|---|---|
| **Free-Text Fields** | `title`, `description`, `requirements`, `company_profile`, `benefits` | Concatenated into `input_text` using `[SEP]` separator |
| **Structured Metadata** | `location`, `department`, `salary_range`, `employment_type`, `required_experience`, `required_education`, `industry`, `function` | Prefixed as `"Field Name: value"` and prepended to `input_text` |
| **Binary Flags** | `telecommuting`, `has_company_logo`, `has_questions` | Used by `metadata_detector` rules engine; `has_company_logo` included in structured input |
| **Target Label** | `fraudulent` | Binary label (0/1) |

---

## 1.1.2 Training, Validation & Test Splits

There are **no pre-saved split files**. All splits are created **programmatically at runtime** (in `src/utils/data.py` and `Milestone-3/Milestone3_pipeline.py`) using a **stratified 70 / 15 / 15** split with `random_state=42` to ensure full reproducibility across training and evaluation runs.

```
fake_job_postings.csv  (17,880 rows)
         │
         ▼
┌──────────────────────────────────────────────────────────────────────┐
│  Stratified Split  (sklearn.model_selection.train_test_split)       │
│  random_state = 42   ·   stratify = df["label"]                    │
│                                                                      │
│  Step 1:  70% Train  /  30% Temp      (test_size=0.30)              │
│  Step 2:  50% Val    /  50% Test      (on Temp, test_size=0.50)     │
└──────────────────────────────────────────────────────────────────────┘
         │                    │                    │
         ▼                    ▼                    ▼
   ┌───────────┐       ┌───────────┐       ┌───────────┐
   │   TRAIN   │       │    VAL    │       │   TEST    │
   │  12,516   │       │   2,682   │       │   2,682   │
   │  (70.0%)  │       │  (15.0%)  │       │  (15.0%)  │
   │           │       │           │       │           │
   │ fraud≈4.8%│       │ fraud≈4.8%│       │ fraud≈4.8%│
   └───────────┘       └───────────┘       └───────────┘
         │                    │                    │
         ▼                    ▼                    ▼
  ┌──────────────┐   ┌──────────────┐    ┌──────────────┐
  │ build_input  │   │ build_input  │    │ build_input  │
  │    _text()   │   │    _text()   │    │    _text()   │
  │  Tokenize    │   │  Tokenize    │    │  Tokenize    │
  │  (BPE, 512)  │   │  (BPE, 512)  │    │  (BPE, 512)  │
  └──────────────┘   └──────────────┘    └──────────────┘
         │                    │                    │
         ▼                    ▼                    ▼
    HF Dataset           HF Dataset           HF Dataset
   (train_ds)            (val_ds)             (test_ds)
   format: torch         format: torch        format: torch
   ┌────────────┐       ┌────────────┐       ┌────────────┐
   │ input_ids  │       │ input_ids  │       │ input_ids  │
   │ attn_mask  │       │ attn_mask  │       │ attn_mask  │
   │ labels     │       │ labels     │       │ labels     │
   └────────────┘       └────────────┘       └────────────┘
        │                     │                     │
        ▼                     ▼                     ▼
    train.py              train.py              eval.py
   (training)           (validation)         (final evaluation)
```

### Split Statistics

| Split | Samples | Fraud Count | Fraud % | Purpose | Used By |
|---|---|---|---|---|---|
| **Train** | 12,516 | ~601 | ~4.8% | Model weight updates via Focal Loss + cosine LR | `src/train.py` |
| **Validation** | 2,682 | ~129 | ~4.8% | Early stopping, best-epoch selection, HP tuning | `src/train.py` |
| **Test** | 2,682 | ~129 | ~4.8% | Final held-out evaluation, threshold calibration | `src/eval.py` |

### Key Design Decisions

1. **No pre-split files on disk** — The same `random_state=42` and stratify logic ensures identical splits every time `load_and_prepare_data()` is called, whether from `train.py`, `eval.py`, or `Milestone3_pipeline.py`.
2. **Stratified splitting** — Preserves the original 4.8% fraud ratio in every split, critical given the severe class imbalance (≈ 20:1).
3. **In-memory preprocessing** — The `input_text` column (concatenation of all structured + free-text fields with `[SEP]` tokens) is computed at runtime, not stored as a separate file.
4. **Tokenisation on-the-fly** — BPE tokenisation (RoBERTa, max 512 tokens) is applied during `build_hf_datasets()`, producing PyTorch-ready `input_ids`, `attention_mask`, and `labels` tensors.

---

## 1.1.3 Model Output Artifacts

After a successful training run, the following artifacts are produced in the `models/` directory (git-ignored; hosted on [HuggingFace Hub](https://huggingface.co/aditya963/fraud-job-classifier)):

```
models/roberta-focal-best/                 ← Saved Model Artifacts
├── config.json                            ← RoBERTa architecture config (num_labels=2)
├── model.safetensors                      ← Trained model weights (~500 MB)
├── tokenizer.json                         ← Full BPE tokenizer vocabulary
├── tokenizer_config.json                  ← Tokenizer settings (max_length, padding, etc.)
├── special_tokens_map.json                ← <s>, </s>, <pad>, <mask> definitions
├── inference_config.json                  ← Final threshold (0.87), val/test metrics, HP snapshot
├── training_summary.json                  ← Best epoch, best val F1, hyperparameters used
├── test_results.json                      ← Final test set metric scores (auto-created by eval.py)
└── eval_plots.png                         ← Confusion matrix, ROC, PR curves (auto-created by eval.py)
```

---

## 1.1.4 Git-Ignored Resources

The following directories and files are listed in `.gitignore` and exist only on the local machine (or are hosted externally):

| Path | Reason | Alternative Access |
|---|---|---|
| `data/` | Raw dataset too large for GitHub | Download from [Kaggle](https://www.kaggle.com/datasets/shivamb/real-or-fake-fake-jobposting-prediction) |
| `models/` | Model weights too large (~500 MB) | Hosted on [HuggingFace Hub](https://huggingface.co/aditya963/fraud-job-classifier) |
| `checkpoints/` | Intermediate training checkpoints | Re-created by running `train.py` |
| `*.npy` | Test probability arrays | Re-generated by `eval.py` |
| `__pycache__/`, `*.pyc` | Python bytecode cache | Auto-generated |
| `.env` | Environment secrets (API keys) | Create manually per `SETUP.md` |
