"""
milestone3_pipeline.py — Milestone 3: End-to-End Pipeline Verification
=======================================================================
Transformer-Based Fake Job Posting Detection
Section 4.1 — AI-Powered Fraud Classification System

This script demonstrates the COMPLETE end-to-end pipeline on a small
subset of data, verifying that every component works together:

  1. Data Loading / Synthetic Data Generation
  2. Preprocessing & Feature Engineering
  3. Stratified Train / Val / Test Split
  4. Tokenization & HuggingFace Dataset Construction
  5. Model Architecture (RoBERTa-base + Focal Loss)
  6. Training (1 epoch on a small subset)
  7. Evaluation with metrics (F1, Precision, Recall, ROC-AUC)
  8. Single-Posting Inference Demo

Usage:
    # If you have the real dataset:
    python milestone3_pipeline.py --data_path data/fake_job_postings.csv

    # If you do NOT have the dataset (uses built-in synthetic data):
    python milestone3_pipeline.py
"""

import os
import sys
import argparse
import warnings
import numpy as np
import pandas as pd
import torch

from sklearn.model_selection import train_test_split
from sklearn.utils.class_weight import compute_class_weight
from sklearn.metrics import (
    classification_report,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
    matthews_corrcoef,
)

from transformers import (
    AutoTokenizer,
    AutoModelForSequenceClassification,
    TrainingArguments,
    Trainer,
)
from datasets import Dataset

warnings.filterwarnings("ignore")

# ══════════════════════════════════════════════════════════════════════════════
# CONSTANTS — Same as in train.py and the Colab notebook
# ══════════════════════════════════════════════════════════════════════════════

# The pre-trained transformer backbone used for classification.
# RoBERTa-base has 125M parameters and was chosen for its strong
# performance on NLP tasks and its robustness to noisy text.
MODEL_NAME = "roberta-base"

# Maximum number of tokens per input sequence.
# RoBERTa supports up to 512 tokens. Sequences longer than this are truncated;
# shorter sequences are padded with special [PAD] tokens.
MAX_SEQ_LEN = 512

# Device selection: use GPU if available, otherwise fall back to CPU.
DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")

# ── Column definitions ────────────────────────────────────────────────────────
# These match exactly the column groups from the Colab notebook (Phase 2).
# TEXT_COLS   — free-text fields (title, description, etc.)
# STRUCT_COLS — structured metadata fields (location, salary, etc.)
TEXT_COLS = [
    "title", "description", "requirements",
    "company_profile", "benefits",
]

STRUCT_COLS = [
    "location", "department", "salary_range", "employment_type",
    "required_experience", "required_education", "industry",
    "function", "has_company_logo",
]

# ── Focal Loss Hyperparameters (from Optuna run-17, trial 18) ─────────────────
# These are the best hyperparameters discovered during the Optuna search
# in the Colab notebook.  They are used identically in train.py.
BEST_GAMMA        = 1.6919871410013687   # Focal Loss gamma
BEST_FRAUD_WEIGHT = 2.8251219104371517   # class weight for fraud class


# ══════════════════════════════════════════════════════════════════════════════
# STEP 1 — DATA LOADING
# ══════════════════════════════════════════════════════════════════════════════
# If the user provides a path to the real CSV, we load it.
# Otherwise, we generate a small synthetic dataset that mimics the
# real data's structure and class distribution (~95% legit, ~5% fraud).
# This allows the pipeline to be verified even without the real data.

def generate_synthetic_data(n_samples=300):
    """
    Generate a small synthetic dataset that mimics the structure
    of the Kaggle Fake Job Postings dataset (17,880 rows, 18 columns).

    The synthetic data preserves:
      - Column names and types matching the real dataset
      - Class imbalance (~95% legitimate, ~5% fraudulent)
      - Realistic-looking text fields with fraud signals in the positive class

    Args:
        n_samples: total number of synthetic job postings to generate.

    Returns:
        pandas DataFrame with the same schema as fake_job_postings.csv.
    """
    print(f"\n  ⚠️  No real dataset provided — generating {n_samples} synthetic samples")
    print(f"      (This is for pipeline verification only, not real training)\n")

    np.random.seed(42)

    # ~5% fraud ratio to match the real dataset's imbalance
    n_fraud = max(int(n_samples * 0.05), 5)
    n_legit = n_samples - n_fraud

    rows = []

    # ── Generate LEGITIMATE postings ──────────────────────────────────────────
    for i in range(n_legit):
        rows.append({
            "job_id": i + 1,
            "title": np.random.choice([
                "Software Engineer", "Data Analyst", "Marketing Manager",
                "Product Designer", "Sales Representative", "HR Coordinator",
                "Financial Analyst", "Research Scientist",
            ]),
            "location": np.random.choice([
                "US, NY, New York", "US, CA, San Francisco",
                "GB, , London", "DE, , Berlin",
            ]),
            "department": np.random.choice(["Engineering", "Marketing", "Sales", "HR", None]),
            "salary_range": np.random.choice(["50000-80000", "80000-120000", None, None]),
            "company_profile": "We are a leading technology company with a strong track record.",
            "description": (
                "We are seeking a talented professional to join our team. "
                "The ideal candidate will have relevant experience and strong skills. "
                "This is a full-time position with competitive benefits."
            ),
            "requirements": "Bachelor's degree required. 2+ years of experience preferred.",
            "benefits": np.random.choice(["Health insurance, 401k, PTO", None]),
            "telecommuting": np.random.choice([0, 1], p=[0.9, 0.1]),
            "has_company_logo": 1,
            "has_questions": np.random.choice([0, 1]),
            "employment_type": np.random.choice(["Full-time", "Part-time", "Contract"]),
            "required_experience": np.random.choice([
                "Entry level", "Mid-Senior level", "Associate",
            ]),
            "required_education": np.random.choice([
                "Bachelor's Degree", "Master's Degree", None,
            ]),
            "industry": np.random.choice([
                "Computer Software", "Financial Services",
                "Marketing and Advertising",
            ]),
            "function": np.random.choice(["Engineering", "Marketing", "Sales"]),
            "fraudulent": 0,
        })

    # ── Generate FRAUDULENT postings ──────────────────────────────────────────
    # Fraud postings typically have: vague descriptions, missing company info,
    # unrealistic salary, urgency language, PII requests.
    for i in range(n_fraud):
        rows.append({
            "job_id": n_legit + i + 1,
            "title": np.random.choice([
                "Work From Home Agent Needed",
                "Easy Money Data Entry",
                "Home Based Customer Service",
                "Online Survey Processor",
            ]),
            "location": np.random.choice(["", None, "US, , "]),
            "department": None,
            "salary_range": np.random.choice(["5000-20000", None]),
            "company_profile": "",  # Missing — strong fraud signal
            "description": (
                "Earn $5000/week working from home! No experience needed. "
                "Send your bank details to get started immediately. "
                "Limited spots available. Apply now! Act fast!"
            ),
            "requirements": np.random.choice([
                "None required. Must have bank account.",
                "",
            ]),
            "benefits": None,  # Missing — fraud signal
            "telecommuting": 1,
            "has_company_logo": 0,  # Missing logo — strong fraud signal
            "has_questions": 0,
            "employment_type": np.random.choice(["Part-time", "Other", None]),
            "required_experience": np.random.choice(["Not Applicable", None]),
            "required_education": None,
            "industry": None,
            "function": None,
            "fraudulent": 1,
        })

    df = pd.DataFrame(rows)
    # Shuffle so fraud samples are not all at the end
    df = df.sample(frac=1, random_state=42).reset_index(drop=True)
    return df


def load_data(data_path=None):
    """
    Load the dataset — either from a CSV file or generate synthetic data.

    Args:
        data_path: path to fake_job_postings.csv (or None to use synthetic data).

    Returns:
        pandas DataFrame with columns matching the Kaggle dataset schema.
    """
    if data_path and os.path.exists(data_path):
        df = pd.read_csv(data_path)
        print(f"\n  ✅ Loaded real dataset: {data_path}")
        print(f"     Shape: {df.shape}")
    else:
        df = generate_synthetic_data(n_samples=300)

    # Print class distribution (matches EDA in Phase 2 of the Colab notebook)
    label_counts = df["fraudulent"].value_counts()
    fraud_rate = label_counts.get(1, 0) / len(df) * 100
    print(f"\n  Class Distribution:")
    print(f"    Legitimate : {label_counts.get(0, 0):,} ({100 - fraud_rate:.1f}%)")
    print(f"    Fraudulent : {label_counts.get(1, 0):,} ({fraud_rate:.1f}%)")
    print(f"    Imbalance  : {label_counts.get(0, 0) / max(label_counts.get(1, 0), 1):.1f}:1")

    return df


# ══════════════════════════════════════════════════════════════════════════════
# STEP 2 — PREPROCESSING & FEATURE ENGINEERING
# ══════════════════════════════════════════════════════════════════════════════
# This is the core preprocessing function, identical to the one in the
# Colab notebook (Phase 2.1) and in utils/data.py.
#
# STRATEGY:  Concatenate ALL available fields into a single text sequence
#            separated by [SEP] tokens.  Structured fields are formatted as
#            "Field Name: value" so the transformer can learn from metadata.
#
# WHY:       RoBERTa processes a single text sequence.  By combining
#            structured fields (location, salary, etc.) with free-text fields
#            (description, requirements, etc.), the model can learn
#            cross-field patterns that indicate fraud.

def build_input_text(row):
    """
    Concatenate all features of a job posting into a single text sequence
    for the transformer model.

    Processing order:
      1. Structured metadata first (short key-value pairs)
      2. Free-text fields after (longer narrative text)

    Fields are joined with ' [SEP] ' — RoBERTa's separator token.
    Missing / NaN / empty fields are silently skipped.

    Args:
        row: a dict-like object (DataFrame row) with job posting fields.

    Returns:
        A single string ready for tokenization.
    """
    parts = []

    # ── Structured metadata (short, key-value format) ─────────────────────────
    for col in STRUCT_COLS:
        val = str(row.get(col, "") or "").strip()
        if val and val.lower() not in ("nan", "none", ""):
            # Convert column name to human-readable format
            # e.g., "required_experience" → "Required Experience"
            parts.append(f"{col.replace('_', ' ').title()}: {val}")

    # ── Free-text fields (longer narrative content) ───────────────────────────
    for col in TEXT_COLS:
        val = str(row.get(col, "") or "").strip()
        if val and val.lower() not in ("nan", "none", ""):
            parts.append(val)

    return " [SEP] ".join(parts)


def preprocess_data(df):
    """
    Apply preprocessing to the raw DataFrame:
      1. Build the unified input_text column
      2. Create the integer label column

    Args:
        df: raw DataFrame loaded from CSV or synthetic generation.

    Returns:
        DataFrame with 'input_text' and 'label' columns added.
    """
    print("\n" + "=" * 60)
    print("  STEP 2 — Preprocessing & Feature Engineering")
    print("=" * 60)

    # Fill NaN in description to avoid errors
    df["description"] = df["description"].fillna("")

    # Build the unified text input for each posting
    df["input_text"] = df.apply(build_input_text, axis=1)
    df["label"] = df["fraudulent"].astype(int)

    # Show a sample of the preprocessed text
    print(f"\n  Sample preprocessed input (first posting):")
    print(f"  {df['input_text'].iloc[0][:300]}...")

    # Approximate token count (BPE inflates word count by ~1.3x)
    df["approx_tokens"] = df["input_text"].str.split().str.len() * 1.3
    print(f"\n  Median approx tokens : {df['approx_tokens'].median():.0f}")
    print(f"  95th pct tokens      : {df['approx_tokens'].quantile(0.95):.0f}")

    return df


# ══════════════════════════════════════════════════════════════════════════════
# STEP 3 — TRAIN / VAL / TEST SPLIT
# ══════════════════════════════════════════════════════════════════════════════
# We use a stratified 70/15/15 split — identical to the Colab notebook
# and train.py.  Stratification ensures each split has the same fraud
# ratio as the full dataset.

def split_data(df):
    """
    Split the dataset into Train (70%), Validation (15%), Test (15%) sets
    using stratified sampling to preserve the class distribution.

    Args:
        df: preprocessed DataFrame with 'input_text' and 'label' columns.

    Returns:
        Tuple of (train_df, val_df, test_df).
    """
    print("\n" + "=" * 60)
    print("  STEP 3 — Stratified Train / Val / Test Split (70/15/15)")
    print("=" * 60)

    # Keep only the columns needed for training
    df_clean = df[["input_text", "label"]].dropna().reset_index(drop=True)

    # First split: 70% train, 30% temporary
    train_df, temp_df = train_test_split(
        df_clean, test_size=0.30, stratify=df_clean["label"], random_state=42,
    )

    # Second split: 50/50 on the 30% → 15% val + 15% test
    val_df, test_df = train_test_split(
        temp_df, test_size=0.50, stratify=temp_df["label"], random_state=42,
    )

    for split, name in [(train_df, "Train"), (val_df, "Val"), (test_df, "Test")]:
        n_fraud = split["label"].sum()
        print(f"  {name:5s}: {len(split):5,} samples | fraud={n_fraud:3} "
              f"({n_fraud / len(split) * 100:.1f}%)")

    return train_df, val_df, test_df


# ══════════════════════════════════════════════════════════════════════════════
# STEP 4 — TOKENIZATION & HUGGINGFACE DATASET CONSTRUCTION
# ══════════════════════════════════════════════════════════════════════════════
# The tokenizer converts raw text into token IDs that the transformer
# understands.  We use RoBERTa's BPE (Byte-Pair Encoding) tokenizer.
#
# Key settings:
#   truncation=True    — cut sequences longer than MAX_SEQ_LEN (512)
#   padding='max_length' — pad shorter sequences to exactly 512 tokens
#   max_length=512     — the fixed sequence length

def build_hf_datasets(train_df, val_df, test_df, tokenizer):
    """
    Convert pandas DataFrames into HuggingFace Dataset objects with
    tokenized inputs ready for the Trainer.

    Each sample becomes:
      - input_ids      : tensor of token IDs, shape [MAX_SEQ_LEN]
      - attention_mask  : tensor of 1s (real tokens) and 0s (padding)
      - labels          : integer label (0 = legitimate, 1 = fraudulent)

    Args:
        train_df, val_df, test_df: DataFrames with 'input_text' and 'label'.
        tokenizer: HuggingFace AutoTokenizer instance.

    Returns:
        Tuple of (train_ds, val_ds, test_ds) HuggingFace Datasets.
    """
    print("\n" + "=" * 60)
    print("  STEP 4 — Tokenization & HuggingFace Dataset Construction")
    print("=" * 60)

    def tokenize_fn(batch):
        """Tokenize a batch of input texts."""
        return tokenizer(
            batch["input_text"],
            truncation=True,
            padding="max_length",
            max_length=MAX_SEQ_LEN,
        )

    def to_hf_dataset(df_split):
        """Convert a DataFrame split to a HuggingFace Dataset."""
        ds = Dataset.from_pandas(df_split.reset_index(drop=True))
        ds = ds.map(tokenize_fn, batched=True, batch_size=64)
        ds = ds.rename_column("label", "labels")
        ds.set_format("torch", columns=["input_ids", "attention_mask", "labels"])
        return ds

    train_ds = to_hf_dataset(train_df)
    val_ds   = to_hf_dataset(val_df)
    test_ds  = to_hf_dataset(test_df)

    print(f"\n  Train dataset : {train_ds}")
    print(f"  Val dataset   : {val_ds}")
    print(f"  Test dataset  : {test_ds}")

    # Show input format specification
    sample = train_ds[0]
    print(f"\n  ── Input Format Specification ──")
    print(f"  input_ids shape      : {sample['input_ids'].shape}  (={MAX_SEQ_LEN} tokens)")
    print(f"  attention_mask shape : {sample['attention_mask'].shape}")
    print(f"  labels shape         : {sample['labels'].shape}  (scalar: 0 or 1)")
    print(f"  input_ids dtype      : {sample['input_ids'].dtype}")
    print(f"  attention_mask dtype : {sample['attention_mask'].dtype}")
    print(f"  labels dtype         : {sample['labels'].dtype}")

    return train_ds, val_ds, test_ds


# ══════════════════════════════════════════════════════════════════════════════
# STEP 5 — FOCAL LOSS & CUSTOM TRAINER
# ══════════════════════════════════════════════════════════════════════════════
# Standard Cross-Entropy loss treats all samples equally.  With a 20:1
# class imbalance (95% legit vs. 5% fraud), the model would learn to
# just predict "legitimate" all the time and still get 95% accuracy.
#
# FOCAL LOSS solves this by:
#   1. Applying class weights (alpha) to up-weight the minority class
#   2. Down-weighting "easy" examples (high pt) with the (1-pt)^gamma term
#      so the model focuses on hard-to-classify fraud samples
#
# Formula:  FL(pt) = -alpha_t * (1 - pt)^gamma * log(pt)
#
# This is identical to the FocalLoss class in the Colab notebook and train.py.

class FocalLoss(torch.nn.Module):
    """
    Focal Loss for binary classification with class imbalance.

    Args:
        alpha:     class weight tensor, shape [num_classes].
                   Higher weight = more penalty for misclassifying that class.
        gamma:     focusing parameter (default=2.0).
                   Higher gamma = stronger focus on hard examples.
        reduction: 'mean' (average loss) or 'sum'.
    """
    def __init__(self, alpha=None, gamma=2.0, reduction="mean"):
        super().__init__()
        self.alpha = alpha
        self.gamma = gamma
        self.reduction = reduction

    def forward(self, logits, labels):
        # Standard cross-entropy loss per sample (unreduced)
        ce_loss = torch.nn.functional.cross_entropy(
            logits, labels, weight=self.alpha, reduction="none",
        )
        # pt = probability assigned to the correct class
        pt = torch.exp(-ce_loss)
        # Focal weight: down-weight easy examples (high pt)
        focal_weight = (1 - pt) ** self.gamma
        # Final focal loss
        loss = focal_weight * ce_loss
        return loss.mean() if self.reduction == "mean" else loss.sum()


class FocalLossTrainer(Trainer):
    """
    Custom HuggingFace Trainer that uses Focal Loss instead of the
    default Cross-Entropy loss.

    The gamma and fraud_class_weight are read from self.args at each
    forward pass, making this compatible with Optuna hyperparameter search.
    """
    def compute_loss(self, model, inputs, return_outputs=False, **kwargs):
        labels  = inputs.pop("labels")
        outputs = model(**inputs)
        logits  = outputs.logits

        # Read focal parameters from training args
        gamma              = getattr(self.args, "focal_gamma", BEST_GAMMA)
        fraud_class_weight = getattr(self.args, "fraud_class_weight", BEST_FRAUD_WEIGHT)

        # Build alpha tensor: [legit_weight, fraud_weight]
        alpha = torch.tensor(
            [self.class_weights[0], fraud_class_weight],
            dtype=torch.float,
        ).to(logits.device)

        loss = FocalLoss(alpha=alpha, gamma=gamma)(logits, labels)
        return (loss, outputs) if return_outputs else loss


# ══════════════════════════════════════════════════════════════════════════════
# STEP 6 — MODEL ARCHITECTURE
# ══════════════════════════════════════════════════════════════════════════════
# Architecture: RoBERTa-base + Linear Classification Head
#
#   Input tokens (512)
#       ↓
#   RoBERTa Encoder (12 transformer layers, 768-dim hidden)
#       ↓
#   [CLS] token representation (768-dim)
#       ↓
#   Dropout (0.1)
#       ↓
#   Linear layer (768 → 2)   ← classification head
#       ↓
#   Softmax → [P(legit), P(fraud)]
#
# Total parameters: ~125M (all trainable — full fine-tuning)

def load_model():
    """
    Load the RoBERTa-base model with a 2-class classification head.

    Returns:
        model on the appropriate device (GPU or CPU).
    """
    print("\n" + "=" * 60)
    print("  STEP 6 — Model Architecture (RoBERTa-base)")
    print("=" * 60)

    model = AutoModelForSequenceClassification.from_pretrained(
        MODEL_NAME,
        num_labels=2,                    # Binary: legitimate vs. fraudulent
        hidden_dropout_prob=0.1,         # Regularization in transformer layers
        attention_probs_dropout_prob=0.1, # Regularization in attention heads
    ).to(DEVICE)

    total_params = sum(p.numel() for p in model.parameters())
    print(f"\n  Model         : {MODEL_NAME}")
    print(f"  Num labels    : 2 (Legitimate, Fraudulent)")
    print(f"  Total params  : {total_params:,}")
    print(f"  Hidden dim    : 768")
    print(f"  Layers        : 12 transformer encoder layers")
    print(f"  Attention     : 12 heads per layer")
    print(f"  Max seq len   : {MAX_SEQ_LEN}")
    print(f"  Dropout       : 0.1 (hidden + attention)")
    print(f"  Device        : {DEVICE}")

    return model


# ══════════════════════════════════════════════════════════════════════════════
# STEP 7 — EVALUATION METRICS
# ══════════════════════════════════════════════════════════════════════════════
# We use the same compute_metrics function as in the Colab notebook.
# During training, predictions are made at threshold=0.5.
# During final evaluation, we calibrate the threshold.

def compute_metrics(eval_pred):
    """
    Compute evaluation metrics from model predictions.

    Metrics:
      - f1_fraud       : F1 score for the fraud class (primary metric)
      - recall_fraud   : fraction of real frauds correctly caught
      - precision_fraud: fraction of predicted frauds that are real
      - roc_auc        : area under the ROC curve

    Args:
        eval_pred: EvalPrediction with .predictions (logits) and .label_ids.

    Returns:
        dict of metric names → values.
    """
    logits, labels = eval_pred
    probs = torch.softmax(torch.tensor(logits), dim=-1).numpy()[:, 1]
    preds = (probs >= 0.5).astype(int)

    return {
        "f1_fraud":        f1_score(labels, preds, pos_label=1, zero_division=0),
        "recall_fraud":    recall_score(labels, preds, pos_label=1, zero_division=0),
        "precision_fraud": precision_score(labels, preds, pos_label=1, zero_division=0),
        "roc_auc":         roc_auc_score(labels, probs) if len(set(labels)) > 1 else 0.0,
    }


# ══════════════════════════════════════════════════════════════════════════════
# STEP 8 — TRAINING (1 EPOCH ON SMALL SUBSET)
# ══════════════════════════════════════════════════════════════════════════════
# We train for just 1 epoch to verify the pipeline works.
# The goal is NOT to achieve good metrics — only to confirm that
# data flows correctly through every component.

def train_model(model, tokenizer, train_ds, val_ds, class_weights, output_dir):
    """
    Configure and run training for 1 epoch using FocalLossTrainer.

    Args:
        model:        the RoBERTa model.
        tokenizer:    the tokenizer.
        train_ds:     HuggingFace Dataset for training.
        val_ds:       HuggingFace Dataset for validation.
        class_weights: numpy array of [legit_weight, fraud_weight].
        output_dir:   directory to save checkpoints.

    Returns:
        The trained FocalLossTrainer instance.
    """
    print("\n" + "=" * 60)
    print("  STEP 8 — Training (1 epoch, pipeline verification)")
    print("=" * 60)

    training_args = TrainingArguments(
        output_dir                  = output_dir,
        num_train_epochs            = 1,        # Just 1 epoch for verification
        per_device_train_batch_size = 8,        # Small batch for CPU compatibility
        per_device_eval_batch_size  = 8,
        learning_rate               = 2.59e-05, # From Optuna best HP
        weight_decay                = 0.07,
        warmup_ratio                = 0.15,
        lr_scheduler_type           = "cosine", # Cosine annealing schedule
        fp16                        = torch.cuda.is_available(),
        max_grad_norm               = 1.0,
        eval_strategy               = "epoch",
        save_strategy               = "no",     # Don't save checkpoints in verification
        logging_steps               = 10,
        report_to                   = "none",
        seed                        = 42,
    )

    # Inject focal loss parameters into training_args
    # (read by FocalLossTrainer.compute_loss via getattr)
    training_args.focal_gamma        = BEST_GAMMA
    training_args.fraud_class_weight = BEST_FRAUD_WEIGHT

    print(f"\n  Hyperparameters:")
    print(f"    Learning rate  : {training_args.learning_rate:.2e}")
    print(f"    Batch size     : {training_args.per_device_train_batch_size}")
    print(f"    Weight decay   : {training_args.weight_decay:.4f}")
    print(f"    Warmup ratio   : {training_args.warmup_ratio:.2f}")
    print(f"    Epochs         : {training_args.num_train_epochs}")
    print(f"    LR scheduler   : cosine")
    print(f"    Focal gamma    : {BEST_GAMMA:.4f}")
    print(f"    Fraud weight   : {BEST_FRAUD_WEIGHT:.4f}")
    print(f"    Loss function  : Focal Loss")

    trainer = FocalLossTrainer(
        model           = model,
        args            = training_args,
        train_dataset   = train_ds,
        eval_dataset    = val_ds,
        compute_metrics = compute_metrics,
    )
    trainer.class_weights = class_weights  # Used by compute_loss

    print("\n  ✅ Trainer configured — starting training...")
    trainer.train()
    print("  ✅ Training complete (1 epoch)")

    return trainer


# ══════════════════════════════════════════════════════════════════════════════
# STEP 9 — EVALUATION ON TEST SET
# ══════════════════════════════════════════════════════════════════════════════

def evaluate_model(trainer, test_ds):
    """
    Run the trained model on the test set and print metrics.

    Args:
        trainer: the trained FocalLossTrainer.
        test_ds: HuggingFace Dataset for testing.

    Returns:
        Tuple of (metrics dict, probabilities array, labels array).
    """
    print("\n" + "=" * 60)
    print("  STEP 9 — Evaluation on Test Set")
    print("=" * 60)

    output = trainer.predict(test_ds)
    probs  = torch.softmax(torch.tensor(output.predictions), dim=-1).numpy()[:, 1]
    labels = output.label_ids
    preds  = (probs >= 0.5).astype(int)

    metrics = {
        "f1_fraud":        f1_score(labels, preds, pos_label=1, zero_division=0),
        "recall_fraud":    recall_score(labels, preds, pos_label=1, zero_division=0),
        "precision_fraud": precision_score(labels, preds, pos_label=1, zero_division=0),
        "roc_auc":         roc_auc_score(labels, probs) if len(set(labels)) > 1 else 0.0,
        "mcc":             matthews_corrcoef(labels, preds),
    }

    print(f"\n  Classification Report:")
    print(classification_report(
        labels, preds,
        target_names=["Legitimate", "Fraudulent"],
        zero_division=0,
    ))

    print(f"  Metrics Summary:")
    print(f"    F1 (fraud)       : {metrics['f1_fraud']:.4f}")
    print(f"    Recall (fraud)   : {metrics['recall_fraud']:.4f}")
    print(f"    Precision (fraud): {metrics['precision_fraud']:.4f}")
    print(f"    ROC-AUC          : {metrics['roc_auc']:.4f}")
    print(f"    MCC              : {metrics['mcc']:.4f}")

    # ── Show example model outputs ────────────────────────────────────────────
    print(f"\n  ── Sample Model Outputs (first 5 test samples) ──")
    print(f"  {'True':>6s}  {'Pred':>6s}  {'P(fraud)':>10s}")
    print(f"  {'─' * 6}  {'─' * 6}  {'─' * 10}")
    for i in range(min(5, len(labels))):
        true_label = "Fraud" if labels[i] == 1 else "Legit"
        pred_label = "Fraud" if preds[i] == 1 else "Legit"
        print(f"  {true_label:>6s}  {pred_label:>6s}  {probs[i]:>10.4f}")

    return metrics, probs, labels


# ══════════════════════════════════════════════════════════════════════════════
# STEP 10 — SINGLE-POSTING INFERENCE DEMO
# ══════════════════════════════════════════════════════════════════════════════
# This demonstrates how the model would be used in production:
# given a single job posting, predict whether it is fraudulent.

def predict_fraud(job_posting, model, tokenizer, threshold=0.5):
    """
    Predict fraud probability for a single job posting.

    Args:
        job_posting: dict with keys matching TEXT_COLS and STRUCT_COLS.
        model:       trained model in eval mode.
        tokenizer:   tokenizer instance.
        threshold:   decision threshold (default 0.5 for verification).

    Returns:
        Dict with fraud_probability, prediction, and threshold_used.
    """
    text   = build_input_text(job_posting)
    inputs = tokenizer(
        text,
        return_tensors="pt",
        truncation=True,
        max_length=MAX_SEQ_LEN,
        padding="max_length",
    )
    inputs = {k: v.to(DEVICE) for k, v in inputs.items()}

    with torch.no_grad():
        logits = model(**inputs).logits

    prob_fraud = torch.softmax(logits, dim=-1)[0, 1].item()
    prediction = "FRAUDULENT" if prob_fraud >= threshold else "LEGITIMATE"

    return {
        "fraud_probability": round(prob_fraud, 4),
        "prediction":        prediction,
        "threshold_used":    threshold,
    }


def run_inference_demo(model, tokenizer):
    """
    Run inference on a hardcoded sample posting with obvious fraud signals.
    """
    print("\n" + "=" * 60)
    print("  STEP 10 — Single-Posting Inference Demo")
    print("=" * 60)

    sample_posting = {
        "title":               "Work From Home Data Entry Specialist",
        "description":         (
            "Earn $5000/week working from home. No experience needed. "
            "Send your bank details to get started immediately. "
            "Limited spots available. Apply now!"
        ),
        "requirements":        "None required. Must have bank account.",
        "salary_range":        "5000-20000",
        "employment_type":     "Part-time",
        "required_experience": "Not Applicable",
        "company_profile":     "",
        "location":            "",
        "department":          "",
        "benefits":            "",
        "industry":            "",
        "function":            "",
        "required_education":  "",
        "has_company_logo":    0,
    }

    model.eval()
    result = predict_fraud(sample_posting, model, tokenizer)

    print(f"\n  Job Posting: \"{sample_posting['title']}\"")
    print(f"  Description: \"{sample_posting['description'][:80]}...\"")
    print(f"\n  ── Prediction ──")
    print(f"  Fraud probability : {result['fraud_probability']:.1%}")
    print(f"  Prediction        : {result['prediction']}")
    print(f"  Threshold used    : {result['threshold_used']}")

    return result


# ══════════════════════════════════════════════════════════════════════════════
# MAIN — RUN THE FULL PIPELINE
# ══════════════════════════════════════════════════════════════════════════════

def main():
    parser = argparse.ArgumentParser(
        description="Milestone 3: End-to-End Pipeline Verification",
    )
    parser.add_argument(
        "--data_path", type=str, default=None,
        help="Path to fake_job_postings.csv (omit to use synthetic data)",
    )
    args = parser.parse_args()

    print("\n" + "=" * 60)
    print("  Milestone 3 — End-to-End Pipeline Verification")
    print(f"  Model  : {MODEL_NAME}")
    print(f"  Device : {DEVICE}")
    print("=" * 60)

    # ── Step 1: Load Data ─────────────────────────────────────────────────────
    df = load_data(args.data_path)

    # ── Step 2: Preprocess ────────────────────────────────────────────────────
    df = preprocess_data(df)

    # ── Step 3: Split ─────────────────────────────────────────────────────────
    train_df, val_df, test_df = split_data(df)

    # ── Step 4: Tokenize ──────────────────────────────────────────────────────
    tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
    train_ds, val_ds, test_ds = build_hf_datasets(train_df, val_df, test_df, tokenizer)

    # ── Step 5: Class Weights ─────────────────────────────────────────────────
    # Compute balanced class weights from the training set.
    # These compensate for the 20:1 class imbalance.
    class_weights = compute_class_weight(
        class_weight="balanced",
        classes=np.array([0, 1]),
        y=train_df["label"].values,
    )
    print(f"\n  Class weights → Legit: {class_weights[0]:.3f} | Fraud: {class_weights[1]:.3f}")

    # ── Step 6: Load Model ────────────────────────────────────────────────────
    model = load_model()

    # ── Step 7-8: Train ───────────────────────────────────────────────────────
    output_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "milestone3_output")
    trainer = train_model(model, tokenizer, train_ds, val_ds, class_weights, output_dir)

    # ── Step 9: Evaluate ──────────────────────────────────────────────────────
    metrics, probs, labels = evaluate_model(trainer, test_ds)

    # ── Step 10: Inference Demo ───────────────────────────────────────────────
    run_inference_demo(model, tokenizer)

    # ── Final Summary ─────────────────────────────────────────────────────────
    print("\n" + "=" * 60)
    print("  ✅ PIPELINE VERIFICATION COMPLETE")
    print("=" * 60)
    print("  All components verified:")
    print("    [✅] Data loading")
    print("    [✅] Preprocessing & feature engineering")
    print("    [✅] Stratified train/val/test split")
    print("    [✅] Tokenization & HF dataset construction")
    print("    [✅] Model architecture (RoBERTa + classification head)")
    print("    [✅] Focal Loss + FocalLossTrainer")
    print("    [✅] Training (1 epoch)")
    print("    [✅] Evaluation with metrics")
    print("    [✅] Single-posting inference")
    print("=" * 60)


if __name__ == "__main__":
    main()
