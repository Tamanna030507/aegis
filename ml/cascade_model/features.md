## Cascade Model Feature Set

### Input Features (6 total)

| Feature | Description | Range |
|---|---|---|
| `tissue_resistance_index` | Ratio of patient's intraop tissue resistance vs cohort mean | 0.5 – 2.0 (1.0 = average) |
| `wound_score_delta` | Change in wound score since last check-in | -40 to +5 |
| `pcps` | Pharmacokinetically-corrected pain severity | 0 – 10 |
| `days_post_op` | Days since surgery | 1 – 14 |
| `procedure_complexity` | 0=simple, 1=moderate, 2=complex | 0, 1, 2 |
| `temp_trend` | Temperature change (°C) from baseline | -1 to +2 |

### Output Labels (7 binary complication flags)

| Index | Complication | Clinical Meaning |
|---|---|---|
| 0 | `elevated_wound_tension` | Wound under abnormal mechanical stress |
| 1 | `lymphatic_disruption` | Lymphatic channel damage post-colectomy |
| 2 | `seroma_formation` | Fluid accumulation in surgical space |
| 3 | `surgical_site_infection` | SSI — most critical preventable complication |
| 4 | `delayed_healing` | Wound closure slower than healing class predicts |
| 5 | `anastomosis_leak` | Bowel join integrity failure (high mortality risk) |
| 6 | `hematoma` | Blood collection in surgical field |

### Model Architecture
- **Algorithm**: Scikit-learn `GradientBoostingClassifier` (n_estimators=80, max_depth=4, lr=0.1)
- **Wrapper**: `MultiOutputClassifier` (independent GBM per complication type)
- **Training data**: 3,000 synthetic patient records (2,400 train / 600 test)
- **Validation accuracy**: 92–94% per complication class
- **Inference**: ~5ms per patient (deterministic, no API call)

### Cascade DAG Construction
The cascade_agent.py uses Gemini API to:
1. Receive the probability vector from model.pkl
2. Apply clinical decision tree rules (e.g., seroma → SSI pathway)
3. Identify the optimal intervention window node
4. Output a structured DAG JSON for D3 visualization
