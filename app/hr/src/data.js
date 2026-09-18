export const requirements = [
  {
    title: "SQL",
    icon: "database",
    statement:
      "Write and optimise SQL queries to explore, join and analyse business data.",
    summary:
      "Uses joins, CTEs and window functions to analyse customer transactions.",
    source: "customer_churn_analysis.sql",
    rationale:
      "The submitted project demonstrates data retrieval, aggregation and cohort analysis directly aligned with the SQL requirement.",
    snippet:
      "WITH monthly_orders AS (\n  SELECT customer_id, DATE_TRUNC('month', order_date) AS month,\n         SUM(total) AS revenue\n  FROM orders GROUP BY 1, 2\n)\nSELECT *, LAG(revenue) OVER (\n  PARTITION BY customer_id ORDER BY month\n) AS previous_month_revenue\nFROM monthly_orders;",
    uncertainty:
      "Query performance on production-scale data has not been observed.",
  },
  {
    title: "Data Analysis",
    icon: "chart",
    statement:
      "Clean, analyse and visualise data to communicate meaningful insights.",
    summary:
      "Cleans transaction data and visualises retention and sales patterns.",
    source: "sales_analysis_project.md",
    rationale:
      "The project shows a reproducible cleaning workflow, useful comparisons and clear visual communication.",
    snippet:
      "Removed duplicate order IDs, standardised date fields and documented missing values. Compared monthly revenue and customer retention by cohort. Built a dashboard showing sales trends and segment-level differences.",
    uncertainty:
      "The project uses a prepared dataset; handling an ambiguous business brief remains unobserved.",
  },
  {
    title: "Business Problem Solving",
    icon: "compass",
    statement:
      "Frame business problems, test hypotheses and recommend evidence-led actions.",
    summary:
      "Technical analysis is visible. The reasoning behind business decisions is not yet clear.",
    source: "alex_chen_resume.md",
    rationale:
      "Existing materials describe tools and outputs, but do not show how Alex framed an ambiguous problem, tested alternatives or chose an action.",
    snippet:
      "Junior analyst with SQL, Python and dashboard experience. Projects include customer churn analysis and an e-commerce sales dashboard. Presented analytical findings in university team projects.",
    uncertainty:
      "No observable evidence of hypothesis testing, targeted evidence seeking or prioritised business recommendations.",
  },
];
export const resources = {
  "website_traffic.csv":
    "period,sessions,orders,conversion_rate\nPrevious month,1000000,34000,3.4%\nLast 4 weeks,1180000,30680,2.6%",
  "campaigns.csv":
    "channel,previous_sessions,current_sessions,previous_conversion,current_conversion\nOrganic,300000,324000,3.8%,3.5%\nPaid Search,300000,426000,3.2%,1.8%\nSocial,160000,200000,2.8%,2.1%\nEmail,80000,77600,4.5%,4.4%\nDirect,160000,152400,3.4875%,2.6601%",
  "orders.csv":
    "period,orders,ad_spend_aud\nPrevious month,34000,41739.13\nLast 4 weeks,30680,48000",
  "landing_pages.csv":
    "channel,device,sessions,orders,conversion_rate\nPaid Search,Mobile,300000,4200,1.4%\nPaid Search,Desktop,126000,3468,2.7524%",
  "product_catalog.csv":
    "category,availability\nHome essentials,In stock\nEveryday accessories,In stock\nSeasonal collection,Limited stock",
  "business_context.md":
    "# HarbourCart · Business context\n\nHarbourCart is an Australian e-commerce retailer. During the last four weeks, website traffic rose by 18%, conversion fell from 3.4% to 2.6%, and advertising spend rose by 15%.\n\nNew Paid Search campaigns launched at the start of the period. The marketing team is considering further spend. Investigate likely drivers and recommend what to validate before increasing the budget.\n\nThe extracts are aggregated. Campaign × device × landing-page detail, page-speed measurements and checkout events have not yet been provided.",
};
export const channels = [
  {
    name: "Organic",
    previous: 3.8,
    current: 3.5,
    traffic: "324,000",
    change: "+8%",
  },
  {
    name: "Paid Search",
    previous: 3.2,
    current: 1.8,
    traffic: "426,000",
    change: "+42%",
  },
  {
    name: "Social",
    previous: 2.8,
    current: 2.1,
    traffic: "200,000",
    change: "+25%",
  },
  {
    name: "Email",
    previous: 4.5,
    current: 4.4,
    traffic: "77,600",
    change: "−3%",
  },
  {
    name: "Direct",
    previous: 3.49,
    current: 2.66,
    traffic: "152,400",
    change: "−4.8%",
  },
];
export const timeline = [
  {
    time: "00:00",
    title: "Started the investigation",
    detail:
      "Read the business brief and identified the conversion decline as the central question.",
    source: "business_context.md",
    kind: "Context",
  },
  {
    time: "01:12",
    title: "Opened campaign performance",
    detail:
      "Compared current and previous conversion rates across five acquisition channels.",
    source: "campaigns.csv",
    kind: "Exploration",
  },
  {
    time: "03:24",
    title: "Filtered to Paid Search",
    detail:
      "Isolated a 42% traffic increase alongside a conversion decline from 3.2% to 1.8%.",
    source: "campaigns.csv",
    kind: "Exploration",
  },
  {
    time: "05:17",
    title: "Opened landing-page data",
    detail: "Examined the device breakdown within Paid Search.",
    source: "landing_pages.csv",
    kind: "Exploration",
  },
  {
    time: "07:10",
    title: "Compared mobile and desktop",
    detail:
      "Created a device comparison: mobile conversion is 1.4%, versus approximately 2.8% on desktop.",
    source: "landing_pages.csv",
    kind: "Analysis",
  },
  {
    time: "09:03",
    title: "Added a key finding",
    detail:
      "“The largest decline is in Paid Search. Mobile performance warrants closer investigation.”",
    source: "finding",
    kind: "Finding",
  },
  {
    time: "10:45",
    title: "Wrote two testable hypotheses",
    detail:
      "Lower-intent campaign traffic and mobile landing-page friction may both contribute.",
    source: "hypothesis",
    kind: "Hypothesis",
  },
  {
    time: "12:01",
    title: "Requested additional evidence",
    detail:
      "Requested campaign × device × landing-page conversion, load times and checkout funnel events.",
    source: "data",
    kind: "Evidence request",
  },
  {
    time: "14:20",
    title: "Finalised a recommendation",
    detail:
      "Validate campaign quality and mobile performance before expanding advertising spend.",
    source: "recommendation",
    kind: "Decision",
  },
  {
    time: "14:35",
    title: "Submitted the work sample",
    detail:
      "Final report includes findings, hypotheses, open questions and prioritised next steps.",
    source: "summary",
    kind: "Submission",
  },
];
export const dimensions = [
  {
    title: "Problem Framing",
    icon: "compass",
    strength: "High",
    text: "Prioritised the conversion decline over the headline increase in traffic, and connected it to the advertising decision.",
    source: "Executive summary",
    target: "summary",
    trace: "00:00 · Read the business brief",
  },
  {
    title: "Evidence Navigation",
    icon: "layers",
    strength: "High",
    text: "Moved from channel comparisons to Paid Search, then to its mobile and desktop segments.",
    source: "Key findings + investigation trace",
    target: "finding",
    trace: "01:12–07:10 · Explored two datasets",
  },
  {
    title: "Hypothesis Formation",
    icon: "bulb",
    strength: "Medium",
    text: "Proposed two plausible, testable explanations. The available aggregates do not establish which is causal.",
    source: "Hypotheses",
    target: "hypothesis",
    trace: "10:45 · Added two hypotheses",
  },
  {
    title: "Evidence Seeking",
    icon: "search",
    strength: "High",
    text: "Requested a specific campaign × device × landing-page breakdown and funnel events to distinguish the explanations.",
    source: "Additional evidence needed",
    target: "data",
    trace: "12:01 · Requested additional data",
  },
  {
    title: "Decision Making",
    icon: "check",
    strength: "High",
    text: "Recommended a reversible, prioritised validation step before increasing spend, while explicitly retaining uncertainty.",
    source: "Recommended next steps",
    target: "recommendation",
    trace: "14:20 · Finalised recommendation",
  },
];
export const workSections = {
  summary: {
    title: "Executive Summary",
    text: "HarbourCart’s conversion decline is concentrated in Paid Search, where traffic grew 42% while conversion fell from 3.2% to 1.8%. Mobile Paid Search conversion is notably lower than desktop. I recommend validating traffic quality and the mobile landing-page experience before increasing advertising spend. These patterns identify where to investigate; they do not yet establish a cause.",
  },
  finding: {
    title: "Key Findings",
    text: "Paid Search is the largest observed deterioration: conversion fell 1.4 percentage points, while its traffic share increased. Within this channel, mobile converts at 1.4% versus approximately 2.8% for desktop. Email remains comparatively stable. Source: campaigns.csv and landing_pages.csv.",
  },
  hypothesis: {
    title: "Hypotheses",
    text: "H1 — New paid campaigns may be attracting lower-intent visitors. Test by comparing campaign and audience cohorts.\n\nH2 — Mobile landing-page friction may be increasing drop-off. Test with page-load metrics and device-level funnel events. Both explanations remain unvalidated.",
  },
  data: {
    title: "Additional Evidence Needed",
    text: "Request campaign × device × landing-page conversion rates, page-load times and checkout funnel events. Compare the same segments before and after the campaign launch to separate traffic-mix effects from experience changes.",
  },
  recommendation: {
    title: "Recommended Next Steps",
    text: "1. Audit the highest-volume Paid Search campaigns by device and landing page.\n2. Validate mobile speed and checkout drop-off with the product team.\n3. Run a controlled improvement on the weakest segment before scaling spend; monitor conversion and acquisition cost.",
  },
};
