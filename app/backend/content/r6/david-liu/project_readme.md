> Synthetic demo work sample, newly authored from the project scope described in the supplied fictional CV. It was not attached to the original CV. The figures and text below are demonstration material, not verified employment outcomes.

# Task Management Web Application: database note

## Scope
Companion to David's March-May 2026 university project. His CV names React, Node.js, Express, MySQL, login, task creation, status updates and basic search. The attached query illustrates the data-retrieval part of that scope, without adding a new analytics internship or unmentioned business project.

## Data contract and behaviour
A user can create many tasks. Each task has one creator ID and its own primary key. The task-list endpoint supplies the signed-in user's ID to the parameterised query. Status changes are handled by a separate endpoint; mutation code is not included here.

The join retrieves the creator display name; it should not multiply tasks. Proposed functional checks are listed beside the SQL. No run log, coverage percentage or performance benchmark is supplied.

## What this sample does and does not cover
The material shows a proposed application query and basic checking approach. It contains no period-over-period business comparison, conversion calculation, customer-behaviour investigation or business recommendation. The CV's software-development experience should not be relabelled as demonstrated data-analysis results.
