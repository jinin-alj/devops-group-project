# Sprint 1

**Dates:** 11–18 November 2026

## Roles

| Role | Member |
|------|--------|
| Product Owner | Jinin Aljayyousi |
| Scrum Master | Nikita |
| Developers | All 5 members |

## Sprint Goal

Have the skeleton deployed to Azure by the pipeline, then deliver the first core feature end to end: add a clothing item in the UI and see it persisted.

## Items selected

Backlog items 1 to 8 (see the [Product Backlog](product-backlog.md)).

| # | Item | Status |
|---|------|--------|
| 1 | CI checks every pull request | Done (pull request #5, merged 17 November) |
| 2 | Azure resources created by code | Not done |
| 3 | Hello World deployed by the pipeline | Not done |
| 4 | Databases and migrations on startup | Not done |
| 5 | Add a clothing item | Not done |
| 6 | See my wardrobe | Not done |
| 7 | Edit a clothing item | Not done |
| 8 | Delete a clothing item | Not done |


## Retrospective agreements

- Each member owns one area and opens the pull requests for it: Azure and CD, wardrobe service, outfit service, UI and monitoring, stats logic and docs
- The deployment comes first: the skeleton goes to Azure through the pipeline before more features are built
- Shared interfaces (data shapes and endpoints) are agreed before coding, so the areas can be built in parallel without blocking each other
- Every pull request is reviewed the same day
- Feature freeze at 21:00 on the last day of Sprint 2, leaving time for the documentation and the `submission` tag