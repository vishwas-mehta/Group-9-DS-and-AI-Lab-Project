# Fake Job Listing Detection using Deep Learning and Agentic Generative AI

**Milestone 3 — Model Architecture**

---

## 1. Overview

This milestone documents the **model architecture selection**, the **rationale behind every design choice**, and the **end-to-end pipeline** — from raw CSV to trained model artifacts hosted on HuggingFace Hub.

All code referenced in this report lives under `src/` and is fully runnable from the repository root.

---

## 2. Model Architecture Selection

### 2.1 Chosen Architecture — RoBERTa-base

| Attribute | Detail |
|---|---|
| **Backbone** | `roberta-base` (125 M parameters) |
| **Head** | Linear classification head (`num_labels=2`) |
| **Fine-tuning** | Full (all layers trainable) |
| **Loss function** | Focal Loss (custom) |
| **LR scheduler** | Cosine annealing with warmup |
| **Hyperparameter search** | Optuna (25-trial Bayesian search) |
| **Early stopping** | Patience = 3 epochs on validation F1 |

The classifier is built on top of HuggingFace's `AutoModelForSequenceClassification`, adding a standard 2-class (`Legitimate` vs. `Fraudulent`) linear head on top of the [CLS] token representation.

### 2.2 Alternative Architectures Considered

| Architecture | Pros | Cons | Why Not Chosen |
|---|---|---|---|
| **BERT-base** | Strong contextual representations | Slightly lower performance than RoBERTa on downstream tasks | RoBERTa has better pre-training (dynamic masking, larger data) |
| **DistilBERT** | 40% faster, 60% smaller | ≈ 2-3% F1 drop on fraud class | We prioritise detection accuracy over inference speed |
| **LSTM / BiLSTM** | Good sequential modelling | Cannot capture long-range dependencies as well; lower F1 (~0.83) | Transformer self-attention is strictly superior for this task |
| **CNN (TextCNN)** | Fast inference | Limited context window; F1 ≈ 0.78 | Insufficient for 512-token job postings |
| **Logistic Regression + TF-IDF** | Simple baseline | No semantic understanding; F1 ≈ 0.73 | Baseline only |

---

## 3. Architecture Justification

### 3.1 Why RoBERTa over BERT?

RoBERTa (Liu et al., 2019) improves on BERT in three critical ways:

1. **Dynamic masking** — masks are generated on-the-fly during pre-training instead of being fixed, giving the model more diverse training signal.
2. **Larger pre-training corpus** — trained on 160 GB of text (vs. 16 GB for BERT), resulting in richer language representations.
3. **No Next Sentence Prediction (NSP)** — removing the NSP objective improved single-sequence classification tasks, which is exactly our use case.

These improvements translate to a consistent ~1-2% F1 improvement on downstream text classification benchmarks compared to BERT-base.

### 3.2 Why Full Fine-Tuning?

We fine-tune **all layers** of RoBERTa rather than freezing the backbone and training only the classification head. Our rationale:

- **Domain shift** — job postings have a specific vocabulary (employment types, salary ranges, company jargon) that differs from the general-domain pre-training data.
- **Dataset size** — with 17,880 samples and a 70/15/15 split, we have ~12,500 training samples — sufficient to fine-tune a 125M-parameter model without catastrophic overfitting, especially with weight decay and early stopping.
- **Empirical result** — full fine-tuning yielded F1=0.907 on the fraud class vs. F1≈0.85 with frozen backbone (head-only) training.

### 3.3 Why Focal Loss?

The dataset is **severely imbalanced** — only 4.8% of postings are fraudulent. Standard cross-entropy treats all samples equally, causing the model to optimise for the majority class (legitimate) and under-detect fraud.

**Focal Loss** (Lin et al., 2017) addresses this by:

$$FL(p_t) = -\alpha_t (1 - p_t)^\gamma \log(p_t)$$

- **Down-weighting easy examples** — when the model is confident (high $p_t$), the loss is reduced by $(1 - p_t)^\gamma$.
- **Focusing on hard examples** — misclassified or uncertain examples receive a larger gradient signal.

Our Focal Loss implementation (`src/utils/focal_loss.py`) uses:

| Parameter | Value | Meaning |
|---|---|---|
| `gamma` (γ) | 1.6920 | Focusing strength — found via Optuna |
| `fraud_class_weight` (α₁) | 2.8251 | Up-weights fraud class gradients |
| `legit_class_weight` (α₀) | Computed via `sklearn.compute_class_weight('balanced')` | Balances class frequencies |

The `FocalLossTrainer` class extends HuggingFace's `Trainer` to inject the custom loss at every forward pass without modifying any other training logic.

### 3.4 Why Cosine Annealing with Warmup?

The learning rate schedule follows a **cosine annealing** curve with a **linear warmup** phase:

1. **Warmup (15% of training)** — linearly ramps the LR from 0 to the peak value, preventing early destabilisation of pre-trained weights.
2. **Cosine decay** — smoothly decays the LR to near zero, allowing the model to settle into a sharper minimum during later epochs.

This schedule is well-established for Transformer fine-tuning and avoids the abrupt LR drops of step-decay schedules.

### 3.5 Why Optuna for Hyperparameter Search?

Rather than manual trial-and-error or grid search, we used **Optuna** (Akiba et al., 2019) — a Bayesian optimisation framework — to search for the best hyperparameters.

- **25 trials** were conducted.
- The objective maximised was **validation F1 on the fraud class**.
- The best trial (Run-17, Trial 18) at epoch 4 yielded: F1=0.920, Precision=0.958, Recall=0.884.

The best hyperparameters found are used as constants in `src/train.py`:

| Hyperparameter | Value |
|---|---|
| Learning rate | 2.59e-05 |
| Batch size | 16 |
| Weight decay | 0.0702 |
| Warmup ratio | 0.1506 |
| Epochs | 9 (early stopped at 7) |
| Focal gamma (γ) | 1.6920 |
| Fraud class weight (α₁) | 2.8251 |
