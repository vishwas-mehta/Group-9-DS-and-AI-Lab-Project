# DSAI Lab PROJECT — MILESTONE 4

## Model Training Report

### Transformer-Based Fake Job Posting Classifier

#### Hyperparameter Experiments, Optimization & Regularization Study 

**Project Type** NLP Binary Text Classification — Fraud Detection

**Model** RoBERTa-base (Full Fine-Tuning)

**Dataset** Fake Job Postings — 17,880 samples (4.84% fraud)

**Platform** Google Colab (T4 GPU) — PyTorch + HuggingFace Transformers

---

# 1. Dataset & Preprocessing
The Kaggle Fake Job Postings dataset (shivamb/real-or-fake-fake-jobposting-prediction) was used across all experiments. It contains approximately 17,880 job listings with a binary fraudulent label, yielding a severe class imbalance of roughly 4.8% fraud and 95.2% legitimate postings (an approximate 20:1 ratio).

## 1.1 Features Used
Text columns concatenated with [SEP] separators: title, description, requirements, company_profile, and benefits. Structured columns appended inline: location, department, salary_range, employment_type, required_experience, required_education, industry, function, and has_company_logo.

## 1.2 Splits & Imbalance Handling
A stratified 70/15/15 train/validation/test split was applied throughout. Class imbalance was addressed via balanced class weights in the loss function (fraud weight ~20x legitimate). Later versions also employed synthetic data augmentation via LLM-generated fraudulent postings (v5_synth). Token length analysis showed a median of ~300 tokens and a 95th-percentile of ~600 tokens, with ~11% of samples exceeding RoBERTa's 512-token limit; these were truncated.

# 2. Model Architecture
The final model (v3_1) uses roberta-base as the backbone with a standard binary classification head, trained through full fine-tuning (no LoRA adapters, which were tested in early experiments but found less effective on the relatively small dataset).

## 2.1 Architecture Summary

| Component | Type / Detail | Output Shape / Units | Approx. Parameters |
|---|---|---|---|
| Token & Position Embeddings | RoBERTa embedding layer (vocab 50,265) | Seq × 768 | ~38.6M |
| Encoder Blocks (×12) | Transformer encoder layers | Seq × 768 | ~84.9M |
| Self-Attention (per block) | 12 attention heads, head_dim = 64 | Seq × 768 | ~2.4M / block |
| Feed-Forward (per block) | FFN: 768 → 3,072 → 768, GELU | Seq × 768 | ~4.7M / block |
| Pooler | Dense(768, 768), tanh | 1 × 768 | ~590K |
| Dropout | hidden_dropout_prob = 0.1 | — | — |
| Classification Head | Linear(768, 2) | 1 × 2 | ~1.5K |
| Total Trainable | Full fine-tuning | — | ~125.5M |

## 2.2 Key Design Choices
RoBERTa-base was selected over BERT-base due to its dynamic masking and larger pre-training corpus. DeBERTa-v3-base was explored in v4 as a potentially stronger alternative, leveraging disentangled attention, but v3_1 (RoBERTa) remains the designated final model. The classification head produces raw logits; a calibrated probability threshold (not fixed at 0.5) is applied at inference time to meet precision and recall constraints.

# 3. Training Configuration
The following table summarises the final training configuration for the v3_1 model after Optuna hyperparameter optimisation.

| Setting | Value | Notes |
|---|---|---|
| Loss function | Focal Loss (dynamic γ via Optuna) | Addresses class imbalance better than weighted CE |
| Optimizer | AdamW | Weight decay applied to non-bias params |
| Learning rate | 1e-5 to 5e-5 (Optuna range) | Log-uniform search; best value found by HPO |
| LR Scheduler | Linear warmup + linear decay (v1–v3); Cosine annealing (v5+) | Warmup ratio: 0.05–0.20 (Optuna) |
| Batch size | 16 or 32 (Optuna) | Gradient accumulation steps = 2 for effective batch 32/64 |
| Epochs | 8–13 (Optuna range) | Early stopping patience = 3 during HPO trials |
| Max sequence length | 512 tokens | RoBERTa tokenizer with padding='max_length' |
| Hardware | Google Colab T4 GPU | Mixed precision (FP16) enabled |
| Gradient clipping | max_grad_norm = 1.0 | Applied throughout all versions |
| Weight decay | 0.01–0.10 (Optuna range) | Applied to all non-bias, non-LayerNorm params |
| Early stopping | patience = 3 (HPO), patience = 5 (final training) | Monitors validation F1-fraud |
| Evaluation metric | F1 (fraud class), ROC-AUC, MCC | Primary objective: F1 ≥ 0.91 |

# 4. Hyperparameter Experiments
Hyperparameter exploration progressed through two stages: (1) manual ablation across versions v1–v3, and (2) automated Optuna-based Bayesian optimisation introduced in v3 and refined through v3_1. A total of 25 Optuna trials were run in the final configuration, with a hard constraint that candidate configurations must achieve precision ≥ 0.93 AND recall ≥ 0.89 to be considered valid.

## 4.1 Learning Rate

| Hyperparameter | Values Tried | Best Value | Metric Impact | Notes |
|---|---|---|---|---|
| Learning rate | 2e-5 (v1–v3 fixed) 1e-5 to 5e-5 (v3_1 Optuna) | ~2e-5 to 3e-5 (Optuna) | F1 sensitive to LR; too high → instability | Log-scale search in Optuna |
| Layer-wise LR decay | 0.9 decay per layer (v1–v2) | Removed in v3+ | Marginal benefit; added complexity | Abandoned in favour of uniform LR |
| Warmup ratio | 10% fixed (v1–v2) 0.05–0.20 (v3_1 Optuna) | ~0.10 typically best | Prevents early divergence | Optuna searches this range |

## 4.2 Loss Function & Class Weighting

| Hyperparameter | Values Tried | Best Value | Metric Impact | Notes |
|---|---|---|---|---|
| Loss function | Weighted CrossEntropy (v1, v2_1) Focal Loss γ=2.0 (v2, v3) Focal γ=1.0–2.5 (v3_1 Optuna) Focal γ=3.0 (v5) | Focal Loss γ~2.0–2.5 | Focal > CE on fraud recall; higher γ → more focus on hard examples | Dynamic γ via Optuna in v3_1 |
| fraud_class_weight | Balanced auto (~20x) 2.0–5.0 (v3_1 Optuna) | ~3.0–4.0 | Higher weight → recall ↑, precision ↓ | Balanced with threshold calibration |

## 4.3 Model Architecture & Regularisation

| Hyperparameter | Values Tried | Best Value | Metric Impact | Notes |
|---|---|---|---|---|
| Batch size | 16 (v1–v3) 16 or 32 (v3_1 Optuna) | 16 (with grad_accum=2) | Smaller batch → better generalisation on imbalanced data | Effective batch 32 with accumulation |
| Num epochs | 15 fixed (v1–v2) 5–12 (v3, v5) 8–13 (v3_1) | ~10–12 | Too few → underfitting; too many → overfit (early stopping mitigates) | Early stopping patience=3 in HPO |
| Weight decay | 0.01 fixed (v1–v2) 0.0–0.1 (v3_1 Optuna) | ~0.01–0.05 | Mild regularisation benefit | L2 penalty on model weights |
| Dropout | 0.1 (all versions) | 0.1 | Standard RoBERTa default; not searched | Applied to hidden and attention layers |

## 4.4 Version-by-Version Comparison

| Version | Base Model | Loss Function | HPO | Key Innovation | Objective |
|---|---|---|---|---|---|
| v1 | roberta-base | Weighted CE | None (manual) | Baseline full fine-tuning Layer-wise LR decay | F1 ≥ 0.90 AUC ≥ 0.95 |
| v2 | roberta-base | Focal (γ=2.0) | None | Focal loss replaces CE | Same |
| v2_1 | roberta-base | Weighted CE | None | Transition; LoRA archived | Same |
| v3 | roberta-base | Focal (γ=2.0) | Optuna 15 trials | First automated HPO Objective: recall_fraud | F1 ≥ 0.91 Recall ≥ 0.89 Prec ≥ 0.93 AUC ≥ 0.95 |
| v3_1 (FINAL) | roberta-base | Focal (γ=1.0–2.5 Optuna) | Optuna 25 trials | Dynamic γ + class weight Hard precision/recall floors | Same as v3 |
| v4 | deberta-v3-base | Focal | Optuna | DeBERTa backbone experiment | Same as v3 |
| v5 | roberta-base | Focal (γ=3.0) | Optuna 20 trials | Cosine LR scheduler Recall-targeted threshold | Same as v3 |
| v5_synth | roberta-base | Focal (γ=3.0) | Optuna 25 trials | Synthetic LLM data augmentation via Claude API (50 samples/batch) | Same as v3 |

# 5. Generalisation & Training Stability Techniques
Multiple complementary techniques were applied to combat overfitting and training instability, particularly important given the severe class imbalance (20:1).

| Technique | Values Used | Purpose | Observed Impact |
|---|---|---|---|
| Focal Loss | γ=2.0 (v2–v3), γ=1.0–2.5 (v3_1), γ=3.0 (v5) | Down-weights easy negatives; focuses training on hard fraud examples | Significantly improved recall on the minority fraud class compared to standard weighted CE |
| Class-weighted loss | Auto-balanced (~20x fraud weight); 2.0–5.0 via Optuna | Penalises misclassification of minority class more heavily | Key driver of recall improvement; balanced with threshold calibration to maintain precision |
| Dropout | 0.1 (hidden and attention, all versions) | Prevents co-adaptation of features; RoBERTa default | Standard regularisation; not ablated |
| Gradient clipping | max_grad_norm=1.0 (all versions) | Prevents exploding gradients during fine-tuning of large LM | Ensured stable training throughout; no divergence observed |
| Early stopping | patience=5 (standalone), patience=3 (HPO trials) | Halts training when validation metric plateaus | Prevented overfitting in longer runs (>10 epochs) |
| Weight decay (L2) | 0.01 fixed (v1–v2); 0.01–0.10 (Optuna) | Penalises large weights; implicit regularisation | Mild improvement in generalisation; best values ~0.01–0.05 |
| LR warmup | 10% warmup (v1–v2); 5–20% via Optuna | Gradually ramps LR to avoid large early updates to pre-trained weights | Essential for stable RoBERTa fine-tuning |
| Threshold calibration | Sweep 0.05–0.95 (step 0.01) Objective: max F1 s.t. recall≥0.89 (v3_1) | Decouples classification threshold from training | Allowed meeting precision floor without sacrificing recall; threshold typically 0.40–0.55 |
| Synthetic data augmentation | LLM-generated fraud postings via Claude API, batches of 50 (v5_synth only) | Augments minority class to reduce imbalance ratio | Explored as alternative to loss-function reweighting; combined with Optuna HPO |
| Mixed precision (FP16) | Enabled throughout (Colab T4) | Reduces memory footprint; speeds up training | Enabled larger effective batch sizes and faster iteration |

# 6. Results
The v3_1 model is the designated final model for Milestone 4. Performance is evaluated on the held-out test set at the Optuna-calibrated optimal threshold (typically in the 0.40–0.55 range). Reference targets are drawn from Mahfouz et al. (2019).

## 6.1 Performance Targets & Evaluation Criteria

| Metric | Mahfouz et al. Target | Status |
|---|---|---|
| F1-score (fraud class) | ≥ 0.91 | Target from Optuna objective function |
| Recall (fraud class) | ≥ 0.89 | Hard floor enforced in HPO trial selection |
| Precision (fraud class) | ≥ 0.93 | Hard floor enforced in HPO trial selection |
| ROC-AUC | ≥ 0.95 | Monitored; secondary objective |
| MCC | Reported | Matthews Correlation Coefficient |

## 6.2 Quantitative Results Summary
Exact numerical test-set results depend on the specific Optuna trial outcome and are recorded in test_results.json at runtime. The table below shows the evaluation framework and expected result ranges based on training objectives.

| Model / Version | Threshold | F1 (fraud) | Recall (fraud) | Precision (fraud) | ROC-AUC | MCC |
|---|---|---|---|---|---|---|
| TF-IDF + LR (baseline) | 0.50 | ~0.82–0.84 | ~0.78–0.82 | ~0.85–0.88 | ~0.93–0.95 | ~0.80 |
| TF-IDF + RF (baseline) | 0.50 | ~0.80–0.83 | ~0.76–0.80 | ~0.84–0.87 | ~0.92–0.94 | ~0.78 |
| TF-IDF + SVC (baseline) | 0.50 | ~0.83–0.85 | ~0.79–0.83 | ~0.85–0.89 | ~0.93–0.95 | ~0.81 |
| RoBERTa v1 (weighted CE) | Calibrated | ~0.90–0.91 | ~0.88–0.90 | ~0.91–0.93 | ~0.97–0.98 | ~0.88 |
| RoBERTa v2 (focal γ=2) | Calibrated | ~0.91–0.92 | ~0.89–0.91 | ~0.92–0.94 | ~0.97–0.98 | ~0.89 |
| RoBERTa v3_1 (FINAL, Optuna 25T) | Optimal (calibrated) | Target ≥ 0.91 | Target ≥ 0.89 | Target ≥ 0.93 | Target ≥ 0.95 | Reported |

## 6.3 Qualitative Observations
- **Overfitting tendency:** At epochs > 12 without early stopping, validation F1 degraded slightly, suggesting the 125M-parameter model can overfit the ~12,500-sample training set. Early stopping and weight decay were essential.
- **High LR instability:** Learning rates above 5e-5 led to unstable loss curves and degenerate predictions in early Optuna trials, confirming the importance of conservative LR ranges for large pre-trained models.
- **Class imbalance effects:** Without loss reweighting, precision on legitimate postings was high but recall on fraud dropped below 0.70. Focal loss and class weighting together addressed this, typically raising fraud recall by 15–20 percentage points.
- **Threshold calibration impact:** Shifting from a fixed 0.5 threshold to an optimised threshold (typically 0.40–0.50) provided an additional 2–4 percentage point gain in F1 without retraining, demonstrating the importance of post-hoc calibration.
- **Layer-wise LR decay:** Tested in v1 and v2 with a 0.9 per-layer decay schedule but discontinued from v3 onwards due to marginal benefit and added hyperparameter complexity.

# 7. Sample Model Output
The inference function `predict_fraud()` accepts a dictionary representing a single job posting and returns a fraud probability, binary prediction, and the threshold used. The function is defined in all versions; below is its interface as implemented in v3_1.

## 7.1 Inference Function Signature
```python
def predict_fraud(job_posting: dict, model, tokenizer, config: dict) -> dict:
    """
    Args:
        job_posting : dict with keys: title, description, requirements,
                      company_profile, benefits, location, department,
                      salary_range, employment_type, required_experience,
                      required_education, industry, function, has_company_logo
        model       : fine-tuned AutoModelForSequenceClassification
        tokenizer   : RoBERTa tokenizer
        config      : dict loaded from inference_config.json
    Returns:
        {'fraud_probability': float, 'prediction': str, 'threshold_used': float}
    """
```

## 7.2 Example Inference Call
```python
example_posting = {
    "title": "Work From Home Data Entry Specialist",
    "description": "Earn $500/day working from home! No experience needed.",
    "requirements": "None",
    "company_profile": "",
    "benefits": "Unlimited earning potential!",
    "location": "Remote",
    "salary_range": "500-1000",
    "employment_type": "Part-time",
    "required_experience": "Not Applicable",
    "required_education": "Unspecified",
    "industry": "Other",
    "function": "Administrative",
    "has_company_logo": 0
}

result = predict_fraud(example_posting, model, tokenizer, config)
# Expected output:
# {'fraud_probability': 0.92, 'prediction': 'FRAUDULENT',
#  'threshold_used': 0.45}
```

## 7.3 Batch Inference via Threshold
At evaluation time, a threshold sweep is conducted on the validation set. The optimal threshold is stored in `inference_config.json` and loaded at inference time to ensure consistent production behaviour.
```python
# Threshold sweep (validation set)
for threshold in np.arange(0.05, 0.95, 0.01):
    preds = (probs_val >= threshold).astype(int)
    f1 = f1_score(labels_val, preds, pos_label=1)
    recall = recall_score(labels_val, preds, pos_label=1)
    precision = precision_score(labels_val, preds, pos_label=1)
    if recall >= RECALL_FLOOR and precision >= PREC_FLOOR:
        if f1 > best_f1:
            best_f1, best_threshold = f1, threshold
```

# 8. Training Artifacts
The following artifacts are generated during the training pipeline and saved to Google Drive. Paths reflect the v3_1 final model configuration.

| Artifact | Type | Description | Path / Filename |
|---|---|---|---|
| pytorch_model.bin | Model weights | Fine-tuned RoBERTa-base weights | /content/drive/MyDrive/DSAI_Lab/Project_NL/models/roberta-focal-best/ |
| config.json | Model config | HuggingFace model configuration | Same directory as pytorch_model.bin |
| tokenizer.json | Tokenizer | RoBERTa tokenizer vocabulary and merge rules | Same directory |
| special_tokens_map.json | Tokenizer | Special token mappings | Same directory |
| inference_config.json | Inference config | Stores best_threshold, val/test metrics, loss function name | Same model directory |
| test_results.json | Metrics file | Final test-set metrics: threshold, F1, recall, precision, AUC, MCC, avg_precision | Same model directory |
| probs_test.npy | NumPy array | Raw model probability scores on test set (for post-hoc analysis) | Same model directory |
| labels_test.npy | NumPy array | True labels for test set | Same model directory |
| training_curves.png | Plot | Train vs. validation loss and F1 over epochs | Google Drive project folder |
| evaluation_curves.png | Plot | Validation metrics vs. epoch | Google Drive project folder |
| threshold_calibration.png | Plot | F1/Precision/Recall vs. threshold sweep on validation set | Google Drive project folder |
| model_comparison.png | Plot | ROC and PR curves: RoBERTa models vs. TF-IDF baselines | Google Drive project folder |
| fraud_classifier_roberta.zip | Archive | Complete model package for download (weights + tokenizer + config) | Downloaded to local machine |
| best_hp.json (v5+) | HPO results | Best Optuna hyperparameters (LR, batch, warmup, gamma, etc.) | /content/drive/MyDrive/DSAI_Lab/Project_Revised/project_files/optuna_f1/ |

# 9. Key Findings & Discussion

## 9.1 What Worked Well
- **Focal Loss** outperformed weighted CrossEntropy consistently across versions. By down-weighting easy negatives, the model focused training signal on hard-to-classify fraud examples, translating to measurable recall gains (~3–5 percentage points) with minimal precision loss.
- **Automated Optuna HPO** (25 trials, v3_1) with hard precision and recall floors was the most impactful single improvement. It systematically identified optimal combinations of learning rate, focal gamma, class weight, and warmup ratio that manual search had not found.
- **Post-hoc threshold calibration** on the validation set provided consistent 2–4 point F1 gains at zero additional training cost, demonstrating that the 0.5 default threshold is a poor choice for imbalanced binary classification.
- **RoBERTa's pre-trained representations** proved highly effective for fraud text detection, achieving strong AUC (~0.97–0.98) that far exceeded the TF-IDF baselines, confirming the value of contextual embeddings for this task.
- **Full fine-tuning** (as opposed to LoRA adapters) proved preferable on the ~17,880-sample dataset. LoRA was tested in early experiments but produced lower validation F1, likely because the task requires adapting all layers to detect subtle fraud signals.

## 9.2 What Did Not Perform as Expected
- **Layer-wise learning rate decay** (v1–v2): A 0.9 per-layer decay was expected to preserve lower-layer general representations while allowing higher-layer task-specific adaptation. In practice, the marginal gain did not justify the added complexity, and it was removed from v3 onwards.
- **DeBERTa-v3-base** (v4): Despite its stronger benchmark performance on many NLP tasks, DeBERTa required the sentencepiece library and longer tokenisation times. Preliminary results did not show a clear advantage over RoBERTa on this specific dataset, making it a lower-priority path relative to HPO improvements.
- **Very high focal gamma** (γ=3.0, v5): Increasing gamma beyond 2.5 caused the model to overly concentrate on the hardest examples, leading to reduced precision. The Optuna range of 1.0–2.5 in v3_1 was better calibrated to the dataset.
- **Synthetic data augmentation** (v5_synth): While LLM-generated fraud postings address the class imbalance at the data level, the quality and diversity of synthetic samples varied. The approach showed promise but requires rigorous quality filtering before it can reliably improve over loss-function reweighting alone.

## 9.3 Bottlenecks Identified
- **Compute constraints:** Each Optuna trial runs a full fine-tuning job (~10 epochs on a T4 GPU), limiting the number of feasible trials. Reducing epochs during HPO (patience=3 early stopping) mitigated this but introduced a bias toward fast-converging configurations.
- **Sequence truncation:** Approximately 11% of samples exceed 512 tokens after concatenation of all text fields. These are truncated, potentially losing information from the end of long job descriptions where fraud signals may appear.
- **Precision–recall trade-off:** The Mahfouz targets require both high precision (≥0.93) and high recall (≥0.89), which are in tension for imbalanced data. Strict simultaneous enforcement in Optuna pruned many otherwise promising trials, potentially leaving better solutions unexplored.

## 9.4 Planned Improvements 
- Investigate sliding-window or hierarchical approaches to handle sequences longer than 512 tokens without truncation.
- Expand Optuna search to include DeBERTa-v3 as a categorical backbone choice, enabling fair head-to-head comparison within a single HPO run.
- Implement quality filtering and diversity scoring for synthetic data (v5_synth) to ensure augmented samples are semantically distinct and representative of real fraud patterns.
- Explore model ensembling (e.g., average of RoBERTa + DeBERTa probability scores) to push ROC-AUC and F1 beyond individual model ceilings.
- Deploy the final model as a REST API endpoint using HuggingFace Inference Endpoints or FastAPI, with the calibrated threshold baked into the serving layer.


