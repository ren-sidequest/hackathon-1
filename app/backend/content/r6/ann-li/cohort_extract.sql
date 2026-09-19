-- SYNTHETIC DEMO WORK SAMPLE: Customer Churn Prediction capstone.
-- Newly authored companion to Ann Li's fictional CV; not recovered from a GitHub repository.
-- Static SQL for a prepared feature-table contract. No execution result is attached.
-- customer_features: one row per (customer_id, snapshot_date).
-- The prepared cohort contains 45,000 customers at snapshot_date 2025-12-31.
-- Feature windows end before 2026-01-01; churn_next_60d is a later outcome label.
SELECT customer_id, snapshot_date,
       purchases_last_90d, spend_last_90d_aud, days_since_last_purchase,
       churn_next_60d
FROM customer_features
WHERE snapshot_date = DATE '2025-12-31';

-- Keep customer_id for customer-level split checks, not as a model input.
-- Separate churn_next_60d from the feature matrix before fitting a model.
-- Proposed checks: unique customer_id within this snapshot; 45,000 rows;
-- 6,750 positive labels and 38,250 negative labels; labels in {0,1}.
-- Inspect missing feature values; learn any imputation only on training folds.
-- The feature construction SQL and outcome-window audit are not in this extract.
