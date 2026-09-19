> Synthetic demo work sample, newly authored from the project scope described in the supplied fictional CV. It was not attached to the original CV. The figures and text below are demonstration material, not verified employment outcomes.

# Customer Churn Prediction: method note

## Project scope
Companion to Ann's March-May 2026 capstone. The CV describes a 45,000-customer dataset, SQL/Python, model comparison, cross-validation, class-weight adjustment and SHAP. This new note illustrates that scope; it does not reproduce an actual repository or execution log.

The CV's AUC of 0.82 refers to a separate internship project. It is not a capstone result, an EvidenceBridge match percentage or a hiring probability. No new measured model-performance claim is made here.

## Prepared cohort for this demonstration

| Quantity | Count |
|---|---:|
| Customers | 45,000 |
| Churn label = 1 | 6,750 |
| Churn label = 0 | 38,250 |

The class split above is newly authored demonstration data, not an extra fact found in the CV. Positive prevalence is 6,750 / 45,000 = 15.0%. Predicting the majority class for everyone would produce 85.0% accuracy and zero recall of churn cases; accuracy alone is therefore a poor selection criterion for this exercise.

## Reviewable procedure
1. Keep one snapshot per customer. Check duplicates before any split and investigate invalid labels.
2. Prepare a stratified customer-disjoint split: 31,500 training, 6,750 validation and 6,750 holdout customers. Corresponding positive counts are 4,725 / 1,012 / 1,013 (allocation rounded to whole customers); all counts reconcile.
3. Fit preprocessing within each training fold. Compare logistic regression, random forest and XGBoost with the same folds. Class weighting is applied during training, not by modifying the holdout labels.
4. Use validation data to inspect the recall/precision trade-off and select a decision threshold. Keep the holdout untouched until that selection is frozen. Report the confusion matrix as well as AUC and recall.
5. SHAP can describe model associations. It does not establish why customers leave or show that changing a feature would prevent churn.

## Limits and handover
These are a prepared cohort and a reviewable procedure, not observed model outputs. Feature-construction code, the label-window audit and execution records would be needed to validate implementation. A customer-random split does not by itself establish performance in a later trading period. The original CV mentions model limitations but does not attach them.

A risk score could help a business prioritise follow-up. A contact policy would still need capacity, intervention cost, customer consent and measured outcomes. This note does not specify a campaign budget, select a retention intervention or claim revenue improvement.
