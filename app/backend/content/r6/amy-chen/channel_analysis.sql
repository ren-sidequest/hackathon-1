-- SYNTHETIC DEMO WORK SAMPLE: Online Sales Channel Analysis.
-- Newly authored companion to Amy Chen's fictional CV, not code extracted from that CV.
-- Static review only: no query execution or production result is claimed.
-- Prepared input: channel_period_metrics, one row per (period_start, channel).
-- period_start identifies a complete four-week reporting window, not a transaction date.
-- Previous: [2026-03-02,2026-03-30); current: [2026-03-30,2026-04-27).
-- Columns: period_start DATE, channel TEXT, sessions INTEGER, completed_orders INTEGER.
-- Channels are mutually exclusive acquisition groups. No join is required.
SELECT period_start, channel,
       SUM(sessions) AS sessions,
       SUM(completed_orders) AS completed_orders,
       100.0 * SUM(completed_orders) / NULLIF(SUM(sessions), 0) AS conversion_pct
FROM channel_period_metrics
WHERE period_start IN (DATE '2026-03-02', DATE '2026-03-30')
GROUP BY period_start, channel
ORDER BY period_start, channel;

-- Proposed pre-report checks (not recorded execution results):
-- 1. GROUP BY period_start, channel HAVING COUNT(*) > 1 should return zero rows.
-- 2. Count null or negative counts; investigate every flagged row before publishing.
-- 3. A zero-session group returns NULL, not a valid zero conversion rate.
-- 4. Reconcile each period to the prepared totals in channel_analysis.md.
-- 5. Confirm the upstream export actually uses the stated windows and definitions;
--    this query trusts period labels and does not verify the raw timestamp mapping.
