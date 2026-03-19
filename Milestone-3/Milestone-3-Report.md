# DSAI PROJECT — MILESTONE 3

## Model Architecture Design, Justification & Pipeline Verification

![Overview](Infographics/Head.png)

### Transformer-Based Fake Job Posting Classifier

**Project Type** NLP Binary Text Classification — Fraud Detection

**Model** RoBERTa-base (Full Fine-Tuning)

**Dataset** Fake Job Postings — 17,880 samples (4.84% fraud)

**Platform** Google Colab (T4 GPU) — PyTorch + HuggingFace Transformers


---

# 1. Dataset Organization

## 1.1 Directory Structure

![Directory Structure](Infographics/DirectoryStructure.png)

The project follows a clean separation of raw data, processed artifacts, and model outputs:

```
Q1/                                    ← Project Root
│
├── fake_job_postings.csv              ← Raw dataset (17,880 rows, 18 columns)
│                                         Source: Kaggle shivamb/real-or-fake-fake-jobposting-prediction
│
├── train.py                           ← Production training script
├── eval.py                            ← Production evaluation script
├── milestone3_pipeline.py             ← End-to-end pipeline verification (Milestone 3)
│
├── rule_discovery_ebm.ipynb           ← EBM-based interpretable rule discovery
├── transformer_fraud_classifier_v3_1.ipynb  ← Full experimentation notebook
│
├── Milestone 2.md                     ← Milestone 2 report
├── Milestone 3.md                     ← This report
│
├── milestone3_output/                 ← Training checkpoints & logs (auto-created)
│   ├── checkpoint-xxx/
│   └── runs/
│
└── fraud_detector_final/              ← Saved model artifacts (from train.py)
    ├── config.json
    ├── model.safetensors
    ├── tokenizer.json
    ├── tokenizer_config.json
    ├── special_tokens_map.json
    ├── inference_config.json           ← Threshold, metrics, HP snapshot
    └── training_summary.json
```

## 1.2 Data Splits

![Data Splits](Infographics/DataSplit.png)

The dataset is divided using **stratified sampling** to preserve the 4.84% fraud rate in every split:

| Split       | Proportion | Samples  | Fraud Samples | Fraud Rate |
|-------------|-----------|----------|---------------|------------|
| Training    | 70%       | 12,516   | ~606          | ~4.84%     |
| Validation  | 15%       | 2,682    | ~130          | ~4.84%     |
| Test        | 15%       | 2,682    | ~130          | ~4.84%     |
| **Total**   | **100%**  | **17,880** | **866**     | **4.84%**  |

The split is performed using `sklearn.model_selection.train_test_split` with `stratify=df['label']` and `random_state=42` for reproducibility. The two-step split process:

1. Split 70% train / 30% temp
2. Split the 30% temp into 50/50 → 15% val + 15% test

---

# 2. Preprocessing Pipeline

## 2.1 Overview

![Overview](Infographics/Overview.png)

The raw CSV contains both structured metadata fields (e.g. location, employment type) and free-
text fields (e.g. description, requirements). A unified preprocessing pipeline converts these
heterogeneous signals into a single token sequence suitable for a transformer encoder.

## 2.2 Steps

![Data Steps](Infographics/DataSteps.png)

### Step 1 — Missing Value Handling
- NaN / None values in text fields are replaced with empty strings.
- Missing values are **not imputed** — their absence is itself a signal (e.g., missing `company_profile` strongly correlates with fraud).

### Step 2 — Structured Field Formatting
- Structured metadata columns (`location`, `department`, `salary_range`, `employment_type`, `required_experience`, `required_education`, `industry`, `function`, `has_company_logo`) are formatted as **key-value pairs**:
  ```
  "Location: US, NY, New York"
  "Has Company Logo: 1"
  ```
- This preserves the field name context so the transformer can learn metadata semantics.

### Step 3 — Text Concatenation
- All non-empty fields are joined using `[SEP]` as a delimiter:
  ```
  Location: US, NY, New York [SEP] Employment Type: Full-time [SEP]
  Has Company Logo: 1 [SEP] Software Engineer [SEP] We are seeking
  a talented professional... [SEP] Bachelor's degree required...
  ```
- **Structured fields come first** (short), followed by **free-text fields** (long).
- This ordering ensures metadata is at the beginning of the token window and is never truncated.

### Step 4 — Tokenization (BPE)
- The combined text is tokenized using **RoBERTa's Byte-Pair Encoding (BPE)** tokenizer.
- Settings:
  - `max_length = 512` (RoBERTa's maximum sequence length)
  - `truncation = True` (truncate sequences exceeding 512 tokens)
  - `padding = 'max_length'` (pad shorter sequences to exactly 512 tokens)

### Step 5 — Tensor Construction
- Each sample becomes three tensors:
  - `input_ids`: token indices, shape `[512]`
  - `attention_mask`: 1 for real tokens, 0 for padding, shape `[512]`
  - `labels`: integer class label (0 = legitimate, 1 = fraudulent), scalar 

---

# 3. Model Architecture

![Architecture](Infographics/Archi.png)

## 3.1 Architecture Description

The model is a **fully fine-tuned RoBERTa-base** transformer with a linear classification head. It follows the standard HuggingFace `AutoModelForSequenceClassification` pattern.

### Major Components

| Component | Description |
|-----------|------------|
| **Token Embedding Layer** | Converts 512 token IDs into 768-dimensional dense vectors. Includes position embeddings and token type embeddings. |
| **Transformer Encoder** | 12 stacked transformer layers, each with 12 self-attention heads and 768 hidden dimensions. Each layer applies multi-head self-attention → LayerNorm → feed-forward (3072 intermediate) → LayerNorm. |
| **[CLS] Pooling** | The output of the first token (`[CLS]`) is taken as the sequence-level representation (768-dim vector). |
| **Dropout** | Applied at rate 0.1 to prevent overfitting. |
| **Classification Head** | Linear layer mapping 768 dimensions → 2 logits (legitimate, fraudulent). |
| **Focal Loss** | Custom loss function replacing standard CrossEntropy. Uses gamma=1.69 and class-weighted alpha to handle 20:1 class imbalance. |

### Parameter Summary

| Layer           | Parameters  |
| --------------- | ----------- |
| Embeddings      | ~23.8M      |
| Encoder (×12)   | ~85.1M      |
| Pooler          | ~0.6M       |
| Classifier Head | ~1.5K       |
| **Total**       | **~125M**   |

All parameters are **trainable** (full fine-tuning, no LoRA/adapter).

## 3.2 Data Flow Diagram

![Data Flow Diagram](Infographics/DataFlow.png)

```
                    ┌─────────────────────────────┐
                    │ Raw Job Posting (18 fields) |
                    └──────────────┬──────────────┘
                                   │
                         ┌─────────▼─────────┐
                         │  build_input_text()│
                         │  Concatenate all   │
                         │  fields with [SEP] │
                         └─────────┬─────────┘
                                   │
                    ┌──────────────▼──────────────┐
                    │ Unified Text String         │
                    │ "Location: US [SEP]         |
                    |  Emp Type: Full-time"       │
                    └──────────────┬──────────────┘
                                   │
                    ┌──────────────▼──────────────┐
                    │ RoBERTa BPE Tokenizer        │
                    │ → input_ids [512]             │
                    │ → attention_mask [512]        │
                    └──────────────┬──────────────┘
                                   │
                    ┌──────────────▼──────────────┐
                    │ RoBERTa Encoder (12 layers)  │
                    │ 768-dim hidden, 12 heads     │
                    └──────────────┬──────────────┘
                                   │
                    ┌──────────────▼──────────────┐
                    │ [CLS] Token Representation   │
                    │ (768-dimensional vector)     │
                    └──────────────┬──────────────┘
                                   │
                    ┌──────────────▼──────────────┐
                    │  Dropout (0.1)               │
                    └──────────────┬──────────────┘
                                   │
                    ┌──────────────▼──────────────┐
                    │  Linear Layer (768 → 2)      │
                    └──────────────┬──────────────┘
                                   │
                    ┌──────────────▼──────────────┐
                    │  Softmax                     │
                    │  → P(legit), P(fraud)        │
                    └──────────────┬──────────────┘
                                   │
                    ┌──────────────▼──────────────┐
                    │  Threshold Comparison        │
                    │  P(fraud) ≥ threshold?       │
                    │  → LEGITIMATE / FRAUDULENT   │
                    └─────────────────────────────┘
```

---

# 4. Input Format Specification

The processed data matches the RoBERTa model's expected input format exactly:

| Tensor            | Shape    | Dtype     | Description |
|-------------------|---------|-----------|-------------|
| `input_ids`       | `[512]` | `int64`   | BPE token indices. Vocabulary size = 50,265. |
| `attention_mask`  | `[512]` | `int64`   | 1 for real tokens, 0 for padding tokens. |
| `labels`          | scalar  | `int64`   | 0 = legitimate, 1 = fraudulent. |

**Batched** (during training): tensors are stacked into shape `[batch_size, 512]`.

### Embedding Details

| Property                  | Value |
|---------------------------|-------|
| Token embedding dimension | 768   |
| Position embedding range  | 0–513 (514 positions, 512 usable) |
| Vocabulary size           | 50,265 tokens |
| Padding token ID          | 1     |
| [CLS] token ID            | 0     |
| [SEP] / `</s>` token ID  | 2     |

---

# 5. Architecture Justification

![Architecture Justification](Infographics/ArchiJusti.png)

## 5.1 Why a Transformer Encoder?

Fraud detection in job postings is a semantically rich task. Fraudulent ads often contain subtle
linguistic cues (exaggerated earnings claims, absent company details, urgency language)
alongside structural signals (missing logo, no company profile). Bag-of-words models fail to
capture cross-sentence context and subtle paraphrase patterns. Transformer self-attention
attends globally over the entire 512-token sequence, linking salary claims in the structured
metadata to suspicious language buried in the description.

## 5.2 Why RoBERTa?

| Criterion | RoBERTa-base | TF-IDF + Classical ML |
|-----------|-------------|----------------------|
| **Contextual understanding** | Full bidirectional context across 512 tokens. Understands semantic meaning, sarcasm, urgency language. | Bag-of-words — no word order, no context. |
| **Transfer learning** | Pre-trained on 160GB of text. Requires only fine-tuning. | No pre-training. Learns only from task data. |
| **Feature engineering** | Automatic — learns features end-to-end. | Manual — requires hand-crafted features. |
| **Cross-field reasoning** | Can correlate signals across title, description, salary, etc. in one attention pass. | Each feature processed independently. |
| **Performance** | Superior on NLP benchmarks (GLUE, SuperGLUE). | Competitive on simple tasks, weaker on complex NLP. |

## 5.3 Why Full Fine-Tuning over LoRA/Adapters?

Parameter-efficient methods (LoRA ~0.9M trainable params) freeze the encoder backbone and
add rank-decomposed weight matrices. While computationally cheaper, they limit the encoder's
ability to shift representations towards fraud-specific patterns. Given the highly imbalanced and
domain-specific nature of the data (only 866 fraudulent examples), full fine-tuning allows every
layer to adapt, yielding improved recall on the hard minority class. The 125M parameter model
fits in T4 VRAM at fp32 with batch size 16 with gradient checkpointing.

## 5.4 Why Focal Loss Over Standard Cross-Entropy?

The dataset has a **20:1 class imbalance** (95.16% legitimate vs. 4.84% fraudulent). With standard cross-entropy:
- The model achieves 95%+ accuracy by simply predicting "legitimate" for everything.
- It never learns to detect fraud.

**Focal Loss** addresses this in two ways:

1. **Class weighting (alpha):** Assigns higher loss penalty to fraud class misclassification.
2. **Focusing parameter (gamma):** Down-weights "easy" examples (correctly classified with high confidence) so the model spends more gradient updates on hard fraud examples.

Formula:

```
FL(pₜ) = −αₜ · (1 − pₜ)ᵞ · log(pₜ)
```

Where `pₜ` is the predicted probability for the true class.

## 5.5 Key Strengths

- **High fraud recall:** Focal Loss + class weights ensure the model catches most fraudulent postings.
- **No manual features:** Unlike TF-IDF pipelines, the model automatically discovers textual fraud signals.
- **Robust to noisy text:** RoBERTa was specifically trained to be robust to noisy and diverse text, which is common in job postings.

## 5.6 Limitations

- **Computational cost:** 125M parameters require significant GPU memory. Training takes hours on a single GPU.
- **512-token limit:** Postings longer than ~400 words may lose information due to truncation (~8-12% of samples are affected).
- **Black-box nature:** The model cannot explain *why* it flagged a posting as of now.

---

# 6. End-to-End Pipeline Verification

![End-to-End Pipeline Verification](Infographics/EndEndPipe.png)

To verify that all pipeline components integrate correctly without requiring a full GPU training run,
a lightweight demo script (pipeline_demo.ipynb) passes a 50-sample subset through the complete
workflow from raw CSV loading to model inference. The demo uses CPU and runs in under 5
minutes on any standard machine.


## Pipeline Steps Verified

| # | Component | Status | Description |
|---|-----------|--------|-------------|
| 1 | Data Loading | ✅ | DataFrame with 50 rows loaded, columns validated |
| 2 | Missing value handling | ✅ | No NaN values in text fields after fillna |
| 3 | Preprocessing | ✅ | `build_input_text()` concatenates fields with `[SEP]` |
| 4 | Data Splitting | ✅ | Stratified 70/15/15 split preserving class ratio |
| 5 | Tokenization | ✅ | RoBERTa BPE tokenizer, max_length=512, padding=max_length |
| 6 | Dataset Construction | ✅ | Pandas → HuggingFace Dataset with torch tensors |
| 7 | Model Loading | ✅ | RoBERTa classification head created, param count printed |
| 8 | Forward pass (1 batch) | ✅ | Logits (batch,2) produced without error |
| 9 | Loss computation (Focal Loss) | ✅ | Scalar loss computed and printed |
| 10 | Evaluation | ✅ | F1, Precision, Recall, ROC-AUC on test set |
| 11 | Inference Demo | ✅ | Single-posting prediction with fraud probability |

---

# 7. Sample Outputs, Loss Functions & Evaluation Metrics

## 7.1 Sample Model Output

```
Input (truncated):
'Employment Type: Part-time [SEP] Salary Range: 5000-20000 [SEP]
Work From Home Data Entry Specialist [SEP] Earn $5000/week working
from home. No experience needed. Send your bank details to get
started immediately.'
```
```
Model Output:
{
'fraud_probability': 0.9847,
'prediction': 'FRAUDULENT',
'threshold_used': 0.
}
```
For a genuine-looking posting (complete company profile, realistic salary, detailed requirements),
the model outputs:

```
Model Output:
{
'fraud_probability': 0.0213,
'prediction': 'LEGITIMATE',
'threshold_used': 0.
}
```

## 7.2 Loss Function — Focal Loss

```
FL(pₜ) = −αₜ · (1 − pₜ)ᵞ · log(pₜ)
```

| Parameter | Value | Role |
|-----------|-------|------|
| `pₜ` |   | softmax probability of the ground-truth class |
| `gamma (γ)` | 1.6920 (Optuna-tuned) | Focusing parameter — higher values down-weight easy examples more aggressively |
| `alpha (α)` | `[class_weight_legit, 2.83]` | Per-class weights — balancing the 95:5 imbalance |

## 7.3 Evaluation Metrics

| Metric | Formula | Interpretation |
|--------|---------|----------------|
| **F1 Score (fraud)** | `2 · (Precision · Recall) / (Precision + Recall)` | Harmonic mean of precision and recall for the fraud class. Primary metric. |
| **Recall (fraud)** | `TP / (TP + FN)` | Fraction of real fraud cases correctly detected. Critical for safety. |
| **Precision (fraud)** | `TP / (TP + FP)` | Fraction of predicted fraud cases that are actually fraud. Reduces false alarms. |
| **ROC-AUC** | Area under ROC curve | Overall ranking quality, threshold-independent. |
| **MCC** | Matthews Correlation Coefficient | Balanced metric suitable for imbalanced datasets. |

### Target Performance (Mahfouz Targets)

| Metric | Target | Achieved (Full Training) |
|--------|--------|--------------------------|
| F1 (fraud) | ≥ 0.85 | ~0.90+ |
| Recall (fraud) | ≥ 0.90 | ~0.94+ |
| Precision (fraud) | ≥ 0.80 | ~0.87+ |
| ROC-AUC | ≥ 0.95 | ~0.99+ |

*Note: The values above are from full-scale training (9 epochs, full dataset). The Milestone 3 verification run uses only 1 epoch on a tiny subset and will show lower performance.*
