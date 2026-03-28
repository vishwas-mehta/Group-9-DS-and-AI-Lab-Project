# Team Contribution Tracker — Milestone 4

**Project:** Fake Job Listing Detection using Deep Learning and Agentic Generative AI

This document tracks the work completed and responsibilities assigned for Milestone 4.

---

## 🤝 Collaborative Effort

For Milestone 4, the entire team—**Arun Dutta, Hritik Roshan Maurya, Vivek Bajaj, and Vishwas Mehta**—worked collaboratively across all stages of the project, including advanced model training, hyperparameter optimization, regularization, and comprehensive evaluation. 

Our joint contributions focused on the following key areas extracted from the Milestone 4 Report:

### 🧠 Model Architecture & Refinement
- **Transformer Implementation:** Collectively worked on finalizing the RoBERTa-base architecture for full fine-tuning and systematically explored alternatives like DeBERTa-v3-base to establish the final `v3_1` model.

### ⚙️ Hyperparameter Optimization (HPO)
- **Optuna Integration:** Jointly designed and executed automated Bayesian optimization using Optuna. Managed multiple trials to pinpoint optimal learning rates, warmup ratios, and weight decay while enforcing hard precision and recall floors.

### ⚖️ Training Strategies & Loss Calibration 
- **Focal Loss & Class Weights:** Shared contributions in addressing the severe ~20:1 class imbalance by implementing dynamic Focal Loss (tuning the gamma parameter) and optimizing class weighting.

### 🛡️ Generalization & Training Stability
- **Regularization Techniques:** Combined efforts in applying gradient clipping, early stopping, and mixed precision (FP16) training to prevent overfitting and ensure stable training across 125M parameters on a T4 GPU.

### 📊 Evaluation & Inference Pipeline
- **Threshold Calibration & Inference:** All members contributed to calibrating the optimal prediction threshold via validation sets (moving away from the default 0.5) and developing the robust `predict_fraud()` inference interface.

### 📝 Documentation & Artifact Management
- **Reporting & Analysis:** Documentation, drawing qualitative observations, plotting training curves, and managing all output artifacts (metrics, model weights, configs) were completed collaboratively.

---

*All team members actively participated in regular code reviews, pair programming sessions, and architectural discussions to achieve the rigorous F1, Precision, and Recall targets set for Milestone 4.*
