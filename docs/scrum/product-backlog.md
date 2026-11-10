# Product Backlog

The initial backlog, ordered by priority.

Size is a rough guess (S is under half a day, M is about a day, L is two days or more)

| # | Story | Area | Size | Target |
|---|-------|------|------|--------|
| 1 | CI checks every pull request | Pipeline | M | Sprint 1 |
| 2 | Azure resources created by code | Pipeline | M | Sprint 1 |
| 3 | Hello World deployed by the pipeline | Pipeline | L | Sprint 1 |
| 4 | Databases and migrations on startup | Wardrobe, Outfit | M | Sprint 1 |
| 5 | Add a clothing item | Wardrobe, UI | M | Sprint 1 |
| 6 | See my wardrobe | Wardrobe, UI | S | Sprint 1 |
| 7 | Edit a clothing item | Wardrobe, UI | S | Sprint 1 |
| 8 | Delete a clothing item | Wardrobe, UI | S | Sprint 1 |
| 9 | Log what I am wearing | Outfit, UI | M | Sprint 2 |
| 10 | See cost per wear | Outfit, UI | M | Sprint 2 |
| 11 | See pieces I have not worn in 60 days | Outfit, UI | S | Sprint 2 |
| 12 | Get an outfit suggestion from the weather | Outfit, UI | L | Sprint 2 |
| 13 | Pick the weather myself when the weather service is down | Outfit, UI | S | Sprint 2 |
| 14 | Clear messages when a service is down | Outfit, UI | S | Sprint 2 |
| 15 | Monitoring dashboard | Monitoring | M | Sprint 2 |
| 16 | Service Level Objective | Monitoring | S | Sprint 2 |
| 17 | Project documentation | Docs | M | Sprint 2 |
| 18 | Smoke test against the live URL | Pipeline | S | Stretch |
| 19 | Zero-downtime deploy with revisions | Pipeline | M | Stretch |
| 20 | Rain reminder | Outfit, UI | S | Stretch |
| 21 | Color matching in suggestions | Outfit | M | Stretch |

## Sprint 1 candidates

### 1. CI checks every pull request

As a developer, I want every pull request checked automatically, so that broken code never reaches `main`.

- [ ] Runs on every pull request and every push
- [ ] Runs `ruff check` and `ruff format --check` on both services
- [ ] Runs the tests of both services with coverage and fails below 70% on the core logic
- [ ] Builds both Docker images
- [ ] Is a required status check in the branch protection of `main`

### 2. Azure resources created by code

As the team, we want the Azure setup written as code, so that anyone can reproduce it and nothing is changed by hand.

- [ ] Bicep (or an Azure CLI script) creates 2 Container Apps on the Consumption plan (min 0, max 1 replica), 2 serverless SQL databases with auto-pause and 1 Static Web App
- [ ] Every resource lives in `rg-sdd-<class>-g<N>` and starts with the prefix `sdd-<class>-g<N>`
- [ ] Uses the group's own service principal, stored only as a GitHub secret
- [ ] The README explains how to run it

### 3. Hello World deployed by the pipeline

As the team, we want every merge to `main` to deploy itself, so that the live app always matches `main`.

- [ ] On merge to `main`, both images are pushed to GHCR tagged with the commit SHA
- [ ] Both services and the UI are deployed only if CI passed
- [ ] The run checks `/health` on both services and fails if it does not get a 200 in time, with enough wait for a cold start
- [ ] The live UI shows both services as up
- [ ] The live URL is in the README

### 4. Databases and migrations on startup

As a developer, I want each service to set up its own database schema on startup, so that local, CI and Azure always have the same schema.

- [ ] SQL Server runs in `docker compose`, with a separate database for each service
- [ ] Each service reads its connection string from an environment variable
- [ ] Migrations are numbered SQL files, applied in order on startup and recorded in a table so they never run twice
- [ ] Tests and CI never connect to the Azure databases

### 5. Add a clothing item

As a user, I want to add a piece of clothing with its name, category, color, warmth and price, so that the app knows what I own.

- [ ] `POST /items` in wardrobe-service saves the item and returns it with its id
- [ ] Category is one of top, bottom, shoes or outerwear
- [ ] Warmth is a whole number from 1 to 5, price is 0 or more, and name is required
- [ ] Invalid input returns 422 with a message that says which field is wrong
- [ ] The UI has a form to add an item, and the item is still there after a restart

### 6. See my wardrobe

As a user, I want to see all my clothes grouped by category, so that I know what I have.

- [ ] `GET /items` returns all items, and `GET /items/{id}` returns one item or 404
- [ ] The UI lists the items grouped by category
- [ ] An empty wardrobe shows a short message instead of an empty page

### 7. Edit a clothing item

As a user, I want to change an item's details, so that I can fix mistakes or update the price.

- [ ] `PUT /items/{id}` updates the item with the same validation as adding one
- [ ] Editing an item that does not exist returns 404
- [ ] The UI lets me edit an item from the list

### 8. Delete a clothing item

As a user, I want to remove a piece I no longer own, so that suggestions only use real clothes.

- [ ] `DELETE /items/{id}` removes the item and returns 204, or 404 if it does not exist
- [ ] The UI asks for confirmation before deleting
- [ ] Wear history in outfit-service for a deleted item is ignored in stats and suggestions (decision recorded in `docs/decisions.md`)

## Sprint 2 candidates

### 9. Log what I am wearing

As a user, I want to tap "wearing this", so that the app knows how often I wear each piece.

- [ ] `POST /wears` in outfit-service saves the item ids and a date
- [ ] The date defaults to today and can be set to an earlier day, which also lets us load demo history
- [ ] A date in the future returns 422
- [ ] Logging still works when wardrobe-service is down, since only the item ids are stored
- [ ] The UI has a "wearing this" button on each item and on a suggested outfit

### 10. See cost per wear

As a user, I want to see what each piece costs me per wear, so that I know which clothes are worth what I paid.

- [ ] `GET /stats/cost-per-wear` returns price divided by number of wears for each item
- [ ] An item that was never worn shows its full price and "not worn yet", with no division by zero
- [ ] Outfit-service fetches the items from wardrobe-service with a timeout
- [ ] The calculation has unit tests, including the never-worn case
- [ ] The UI shows the cost per wear next to each item

### 11. See pieces I have not worn in 60 days

As a user, I want to see the clothes I have not worn in the last 60 days, so that I can wear them or give them away.

- [ ] `GET /stats/unworn` returns items with no wear in the last 60 days, including items never worn
- [ ] Unit tests cover the edges at 59, 60 and 61 days
- [ ] The UI shows the list

### 12. Get an outfit suggestion from the weather

As a user, I want an outfit suggested from today's weather, so that I do not have to think about it in the morning.

- [ ] `GET /suggestion` gets today's temperature from Open-Meteo for a default city, which can be changed with `lat` and `lon`
- [ ] The temperature maps to cold, mild or hot, and each band maps to a warmth range
- [ ] The suggestion has one top, one bottom and one pair of shoes, plus outerwear when it is cold
- [ ] Among items that fit, the one worn least recently is picked, so the same input always gives the same outfit
- [ ] If a category has nothing that fits, the response says so instead of failing
- [ ] The weather is cached for an hour so we do not call Open-Meteo on every request
- [ ] The mapping and the picking have unit tests

### 13. Pick the weather myself when the weather service is down

As a user, I want to choose cold, mild or hot myself when the weather cannot be fetched, so that I still get a suggestion.

- [ ] If Open-Meteo fails or takes longer than 3 seconds, the response says the weather is unavailable
- [ ] `GET /suggestion?band=cold` (or mild, hot) works without calling Open-Meteo
- [ ] The UI shows the three choices when the weather is unavailable

### 14. Clear messages when a service is down

As a user, I want a clear message when part of the app is down, so that I know what still works.

- [ ] With wardrobe-service stopped, outfit-service answers within a few seconds with 503 and "wardrobe unavailable, try again later", with no stack trace
- [ ] With outfit-service stopped, adding, editing and deleting items still works
- [ ] The UI shows a friendly message for each case instead of hanging
- [ ] Both cases are tested and shown in the Sprint Review demo

### 15. Monitoring dashboard

As the team, we want a dashboard of how the app behaves in production, so that we notice problems before users do.

- [ ] Request logs from both services can be queried in Log Analytics
- [ ] Saved queries or an Azure Workbook show request count, error rate and response time per service
- [ ] Logs stay at INFO level with no request bodies
- [ ] The queries are in `docs/monitoring.md`

### 16. Service Level Objective

As the team, we want one clear target for the app's reliability, so that we can tell whether it is good enough.

- [ ] One SLO is written down, chosen so that cold starts from scaling to zero do not break it by design
- [ ] A Log Analytics query measures it
- [ ] The SLO and its query are in `docs/monitoring.md` and shown in the Sprint Review

### 17. Project documentation

As a reader of the repository, I want the docs to match what is deployed, so that I can understand and run the project.

- [ ] The README has the live URL, an architecture diagram that matches Azure, and how to run, test and set up the project
- [ ] `docs/decisions.md` has 4 to 6 decision records
- [ ] `docs/data-model.md` has the entities and a diagram that match the migrations
- [ ] `AI_USAGE.md` lists every significant piece of AI-assisted work
- [ ] `docs/scrum/sprint-1.md` and `sprint-2.md` are filled in

## Stretch, only on top of a working MVP

### 18. Smoke test against the live URL

As the team, we want the pipeline to try a real request after each deploy, so that a broken deploy fails the run.

- [ ] After deploy, the pipeline creates, reads and deletes a test item on the live API and fails the run if any step fails

### 19. Zero-downtime deploy with revisions

As a user, I want deploys to happen without the app going down, so that I never see an error during a release.

- [ ] New revisions get traffic only after `/health` returns 200, using Container Apps revisions

### 20. Rain reminder

As a user, I want a reminder to take an umbrella when rain is forecast, so that I do not get caught out.

- [ ] The suggestion includes a rain note when Open-Meteo forecasts rain for today

### 21. Color matching in suggestions

As a user, I want the suggested pieces to go together, so that the outfit looks good.

- [ ] Suggestions avoid color combinations on a short list of clashes, with unit tests
