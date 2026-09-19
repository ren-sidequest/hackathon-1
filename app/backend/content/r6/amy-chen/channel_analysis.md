> Synthetic demo work sample, newly authored from the project scope described in the supplied fictional CV. It was not attached to the original CV. The figures and text below are demonstration material, not verified employment outcomes.

# Online Sales Channel Analysis

## Project scope
Companion to the university project named in Amy's CV (March-May 2026). This is an independent past-project exercise, not the shared employer task and not a submission to the hiring workflow. The input is a prepared channel export; raw transactions are not included.

## Prepared input
Two consecutive four-week periods: previous [2026-03-02,2026-03-30), current [2026-03-30,2026-04-27). A completed order and a session use the same definitions in both periods.

| Period | Channel | Sessions | Completed orders |
|---|---|---:|---:|
| Previous | Paid Search | 1,500 | 60 |
| Previous | Organic | 2,500 | 140 |
| Current | Paid Search | 2,400 | 72 |
| Current | Organic | 2,600 | 153 |

## Calculation worksheet
Conversion = completed orders / sessions * 100.

- Total sessions: 4,000 to 5,000 (+25.0%).
- Completed orders: 200 to 225 (+12.5%).
- Overall conversion: 5.0% to 4.5% (-0.5 percentage points; -10.0% relative).
- Paid Search conversion: 4.0% to 3.0%; its session share rises from 37.5% to 48.0%.
- Organic conversion: 5.6% to approximately 5.8846%.
- Aggregate rates use total orders divided by total sessions, not an unweighted average of channel percentages. Round after calculating.

The SQL file and this table describe the same population. They are not two sets of orders. The upstream timestamp mapping and original export checks remain to be inspected.

## Short note to the operations team
Orders increased even though overall conversion fell. Paid Search brought more sessions and orders, but converted a smaller share of its sessions. Before interpreting an increase in promotional activity, I would look at the paid-traffic composition. Campaign mix is one possible explanation, not a demonstrated cause. I would request campaign and device breakdowns for the same two periods.
