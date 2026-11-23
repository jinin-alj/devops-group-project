# Sprint 2

**Dates:** 19–24 November 2026

## Roles

| Role | Member |
|------|--------|
| Product Owner | TBD |
| Scrum Master | TBD |
| Developers | All 5 members |

## Sprint Goal

The MVP is live on Azure and deployed by the pipeline: full CRUD on clothing items, a wear log with cost per wear and unworn items, clear messages when a service is down, and a monitoring dashboard with one SLO.

## Items selected

Item numbers refer to the [Product Backlog](product-backlog.md). Items 2 to 8 were carried over from Sprint 1.

| # | Item | Owner | Status |
|---|------|-------|--------|
| 2 | Azure resources created by code | Salome | |
| 3 | Hello World deployed by the pipeline | Salome | |
| 4 | Databases and migrations on startup | TBD (wardrobe), TBD (outfit) | |
| 5–8 | Add, see, edit and delete a clothing item | TBD (wardrobe), TBD (UI) | |
| 9 | Log what I am wearing | TBD (outfit), TBD (UI) | |
| 10 | See cost per wear | Dana (logic), TBD (outfit, UI) | |
| 11 | See pieces I have not worn in 60 days | Dana (logic), TBD (outfit, UI) | |
| 14 | Clear messages when a service is down | TBD (outfit), TBD (UI) | |
| 15 | Monitoring dashboard | TBD (UI and monitoring) | |
| 16 | Service Level Objective | TBD (UI and monitoring) | |
| 17 | Project documentation | Everyone, coordinated by Dana | |

Not selected: the weather suggestion and its manual fallback (12, 13) and the stretch items (18 to 21). They stay in the backlog for a next sprint.

## Who does what

**Azure and CD – Salome**

- Azure setup script: 2 Container Apps, 2 serverless SQL databases, 1 Static Web App, and the Log Analytics workspace of the Container Apps environment
- `cd.yml`: push images tagged with the commit SHA, deploy the services and the UI, check `/health`
- Live URL in the README
- Decision record: deployment and pipeline

**Wardrobe service – TBD**

- Migration runner, merged first so the outfit service can reuse it
- SQL Server in `docker-compose.yml`, with one database per service
- Items CRUD with validation, tests with 70% or more coverage
- `docs/data-model.md`
- Decision record: storage and data model

**Outfit service – TBD**

- Its own database and migration, using the wardrobe migration runner
- `POST /wears`, `GET /stats/cost-per-wear`, `GET /stats/unworn`
- Calls to wardrobe-service with a timeout and a clear 503 message
- Decision record: two-service architecture and partial failure

**UI and monitoring – TBD**

- Add, list, edit and delete items
- "Wearing this" button and the stats
- Friendly messages when a service is down
- Service URLs kept in one place, so the deploy can point them to Azure
- Log Analytics queries, dashboard and SLO in `docs/monitoring.md`
- Decision records: frontend, monitoring

**Stats logic and docs – Dana**

- Cost per wear and items not worn in 60 days, as pure functions
- Unit tests, including never-worn items and the 59, 60 and 61 day edges
- `docs/scrum/sprint-2.md` (review and retrospective), `AI_USAGE.md`, README team table

## Shared interfaces

Everyone works against these from the start, so no one waits for another member's pull request. A change to them is agreed in the team chat first.

**Item** (wardrobe-service)

| Field | Type | Rule |
|-------|------|------|
| `id` | integer | set by the database |
| `name` | string | required |
| `category` | string | `top`, `bottom`, `shoes` or `outerwear` |
| `color` | string | required |
| `warmth` | integer | 1 to 5 |
| `price` | number | 0 or more |

Endpoints: `POST /items`, `GET /items`, `GET /items/{id}`, `PUT /items/{id}`, `DELETE /items/{id}`. Invalid input returns 422, an unknown id returns 404, a delete returns 204.

**Wear** (outfit-service)

`POST /wears` with `{"item_ids": [1, 2], "worn_on": "2026-11-24"}`. `worn_on` defaults to today, and a date in the future returns 422. Only item ids are stored, so logging works while wardrobe-service is down.

**Stats functions** (outfit-service, pure, no database or HTTP)

- `cost_per_wear(items, wears)` returns one entry per item: `item_id`, `name`, `price`, `wears` and `cost_per_wear`. An item never worn has `wears` 0 and `cost_per_wear` equal to its price.
- `unworn(items, wears, today, days=60)` returns the items with no wear in the last `days` days, including items never worn.

**Environment variables**

| Variable | Used by |
|----------|---------|
| `DB_HOST`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` | both services |
| `ALLOWED_ORIGIN` | both services (CORS) |
| `WARDROBE_URL` | outfit-service |

## Working agreements

- Everyone starts now and builds against `docker compose` locally. No one waits for the Azure deploy.
- The wardrobe owner is the only one who edits `docker-compose.yml`, to avoid merge conflicts.
- Tests never need a real database. Logic lives in plain functions that are tested directly.
- One small pull request per piece of work, branched from the latest `main` and reviewed within a few hours.
- If the deploy is blocked, the team helps with it before continuing feature work.
- Feature freeze on 24 November at 21:00. After that, only fixes and documentation.
- The commit tagged `submission` is pushed before 24 November, 23:59.

## Sprint Review

To be filled in after the review on 25–26 November: items done and not done.

## Retrospective agreements

To be filled in after the retrospective.
