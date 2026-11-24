# DevOps Group Project

A wardrobe app. You add your clothes once (name, category, color, warmth 1 to 5, price). Each time you wear something you tap "wearing this", and the app shows what each piece costs you per wear and which pieces you have not worn in 60 days.

Built as a Scrum team for the Software Development and DevOps group assignment: planned in sprints, delivered by an automated pipeline, deployed on Azure, and monitored in production.

**Live URL:** https://zealous-moss-0723d1803.6.azurestaticapps.net

> The first request after a quiet period can take 20 to 30 seconds. The Container Apps scale to zero and the serverless databases auto-pause, so they have to wake up first.

## Architecture

Two services, each in its own container with its own database, talking over HTTP. The UI is a static site that calls both from the browser, with CORS restricted to the UI's origin. This is what runs in the resource group `rg-sdd-3b-g7`:

```
                 Browser
                    |
                    v
   Static Web App  sdd-3b-g7-ui  (HTML/JS)
        |                               |
        | /items                        | /wears, /stats/*
        v                               v
 Container App                   Container App
 sdd-3b-g7-wardrobe  <--- HTTP ---  sdd-3b-g7-outfit
        |               GET /items      |
        |               3 s timeout     |
        v                               v
 Serverless Azure SQL            Serverless Azure SQL
 sdd-3b-g7-wardrobe-db           sdd-3b-g7-outfit-db
 (items)                         (wears)
        \                              /
         +---- both on sdd-3b-g7-sql -+

 Both apps log one line per request to stdout
   ---> Log Analytics workspace sdd-3b-g7-logs
```

| Service | Endpoints | Database |
|---------|-----------|----------|
| wardrobe-service | `GET /health`, `GET /items`, `GET /items/{id}`, `POST /items`, `PUT /items/{id}`, `DELETE /items/{id}` | `items` |
| outfit-service | `GET /health`, `POST /wears`, `GET /stats/cost-per-wear`, `GET /stats/unworn` | `wears` |

**Why this split:** wardrobe-service is a small, stable CRUD service that owns the clothes. Outfit-service owns the wear history and the logic built on it, and only reads items from wardrobe-service over HTTP. Each can be deployed and can fail on its own. See [decisions.md](docs/decisions.md) and [data-model.md](docs/data-model.md).

**Partial failure behavior**

- Wardrobe-service down: the stats endpoints answer 503 `wardrobe unavailable, try again later` within 3 seconds. Logging a wear still works, since outfit-service only stores item ids.
- After a quiet period, wardrobe-service needs 10 to 20 seconds to wake up, which is longer than that 3-second timeout, so the very first stats request can get the same 503. The UI checks `/health` on both services when the page loads, which wakes them up.
- Outfit-service down: adding, editing and deleting items keeps working.
- Wardrobe database down or still waking up: wardrobe-service answers 503 `wardrobe database unavailable, try again later` instead of a stack trace, and `/health` stays up.

## Tech stack

- Backend: Python 3.12 + FastAPI (both services), `pyodbc` with Microsoft ODBC Driver 18, plain SQL migrations
- Frontend: plain HTML, CSS and JS as static files, service URLs in `ui/config.js`
- Database: SQL Server in Docker Compose locally, Azure SQL Database serverless in production
- Containers: Docker, images in GitHub Container Registry tagged with the commit SHA
- CI/CD: GitHub Actions, logging in to Azure with OIDC (no client secret)
- Hosting: Azure Container Apps (Consumption, scale to zero, max 1 replica) and Azure Static Web Apps
- Monitoring: Log Analytics workspace of the Container Apps environment

## Repo structure

```
devops-group-project/
├── README.md
├── AI_USAGE.md
├── docker-compose.yml          # SQL Server, db-init, both services, the UI
├── .env.example                # optional overrides for docker compose
├── .github/workflows/
│   ├── ci.yml                  # ruff, format check, tests with 70% coverage, image build
│   └── cd.yml                  # on merge to main: CI, push images, deploy, /health check, UI
├── infra/
│   └── setup.sh                # one-time Azure setup (Azure CLI)
├── services/
│   ├── wardrobe/
│   │   ├── Dockerfile
│   │   ├── requirements.txt        # pinned runtime dependencies
│   │   ├── requirements-dev.txt    # adds pytest, pytest-cov, ruff
│   │   ├── app/
│   │   │   ├── main.py             # endpoints, startup, request logging, CORS
│   │   │   ├── items.py            # item model and validation
│   │   │   ├── repository.py       # SQL and in-memory storage
│   │   │   ├── db.py               # connection from DB_* settings, startup retry
│   │   │   └── migrations.py       # applies migrations/*.sql once each
│   │   ├── migrations/001_create_items.sql
│   │   └── tests/
│   └── outfit/
│       ├── Dockerfile
│       ├── requirements.txt
│       ├── requirements-dev.txt
│       ├── app/
│       │   ├── main.py             # endpoints, call to wardrobe-service with a timeout
│       │   ├── stats.py            # cost per wear and unworn items (pure functions)
│       │   └── db.py               # wear storage and migrations
│       ├── migrations/001_create_wear_log.sql
│       └── tests/
├── ui/
│   ├── index.html
│   ├── app.js                  # UI logic and calls to both services
│   ├── style.css
│   └── config.js               # service URLs, rewritten by CD for Azure
└── docs/
    ├── decisions.md            # decision records
    ├── data-model.md           # entities and diagram, matching the migrations
    ├── monitoring.md           # Log Analytics queries, dashboard and the SLO
    └── scrum/                  # Definition of Done, backlog, one file per sprint
```

## Run locally

Requires Docker. No `.env` file is needed, the defaults in `docker-compose.yml` work as they are.

```bash
git clone https://github.com/salomeshioshvili/devops-group-project.git
cd devops-group-project
docker compose up --build
```

| What | URL |
|------|-----|
| UI | http://localhost:8080 |
| wardrobe-service | http://localhost:8001/health |
| outfit-service | http://localhost:8002/health |

SQL Server takes about 30 seconds to start the first time. A `db-init` step then creates the `wardrobe` and `outfit` databases, and each service applies its migrations on startup. Each request writes one line to stdout, for example `method=GET path=/items status=200 duration_ms=4.2`, which you can follow with `docker compose logs -f`.

To change a default, copy `.env.example` to `.env` and edit it. The SQL Server password in compose is only for the local container and is never used in Azure.

## Run the tests

Requires Python 3.12, the same version as CI and the Docker images. From each service folder:

```bash
cd services/wardrobe
python3.12 -m venv .venv
.venv/bin/pip install -r requirements-dev.txt
.venv/bin/ruff check app tests && .venv/bin/ruff format --check app tests
.venv/bin/pytest --cov=app --cov-fail-under=70
```

Do the same in `services/outfit`. The tests never need a database: they use in-memory storage and fakes, so they run anywhere, including CI.

## CI/CD

- **CI** (`ci.yml`) runs on every pull request and on pushes to other branches: `ruff check`, `ruff format --check`, the tests with coverage (fails below 70%), and a Docker build of both images.
- **CD** (`cd.yml`) runs on every merge to `main`: it runs CI first, pushes both images to GHCR tagged with the commit SHA, updates both Container Apps, and checks `/health` on each up to 30 times, 10 seconds apart, failing the run if it never returns 200. Migrations run on startup, so a passing `/health` also means they were applied. It then writes the Azure URLs into `ui/config.js` and deploys the UI to the Static Web App.
- No direct pushes to `main`. Every change reaches it through a pull request approved by another team member.

## Reproduce the Azure setup

Everything lives in the group's resource group `rg-sdd-3b-g7`, in the subscription **Azure Simple IE Instituto de Empresa, S.L.** (tenant `5ca2bc70-353c-4d1f-b7d7-7f2b2259df68`). Resource names start with `sdd-3b-g7-`.

One-time setup, run by a team member with Contributor on the resource group:

```bash
az login --tenant 5ca2bc70-353c-4d1f-b7d7-7f2b2259df68
az account set --subscription "Azure Simple IE Instituto de Empresa, S.L."
gh auth login
CLASS=3b GROUP=7 ./infra/setup.sh
```

The script creates the Log Analytics workspace, the Container Apps environment, two Container Apps (Consumption, 0 to 1 replica), a SQL server with two serverless databases (auto-pause after 60 minutes) and the Static Web App. It generates the database password and stores it only as a Container Apps secret. Each app gets `DB_HOST`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` and `ALLOWED_ORIGIN`, and outfit-service also gets `WARDROBE_URL`.

The pipeline identity is the managed identity `sdd-3b-g7-github` (created by the professor). The script adds federated credentials for `main` (name form and numeric-ID form), and sets GitHub variables `AZURE_PREFIX` / `AZURE_RESOURCE_GROUP` plus secrets `AZURE_CLIENT_ID` / `AZURE_TENANT_ID` / `AZURE_SUBSCRIPTION_ID`. There is no client secret: `azure/login` uses OIDC.

After the first image push, make both GHCR packages public so Azure can pull them. Then every merge to `main` deploys through `.github/workflows/cd.yml`. Nothing is changed by hand in Azure.

## Monitoring

Both services log one line per request to stdout (method, path, status, duration), at INFO level and without request bodies. Container Apps sends these lines to the Log Analytics workspace, where saved queries and the dashboard show request count, error rate and response time.

**SLO:** at least 99% of `GET /items` requests return 2xx in under 500 ms over the previous seven days. The query that measures it is in [docs/monitoring.md](docs/monitoring.md).

## Scope

Built in this project: full CRUD on clothing items, the wear log, cost per wear, items not worn in 60 days, clear messages when a service is down, the pipeline, and monitoring with one SLO.

The UI also suggests a next-day outfit from the clothes in the wardrobe. It maps
the noon forecast to a target warmth rating: 5 at 8°C or below, 4 at 9–14°C, 3
at 15–20°C, 2 at 21–26°C, and 1 above 26°C. Every pair of suggested pieces
must have warmth ratings within two points. Compatible outerwear is added for
the colder warmth targets when available. Warmth fit is the main ranking
factor; analogous hues (up to 35° apart) and complementary hues (within 25° of
opposite) improve the color score, while neutral colors work with other hues.
The selected item colors are shown together as a palette on the recommendation
card. Among otherwise similar choices, the UI gives a small preference to items
returned by `GET /stats/unworn`; that endpoint only identifies never-worn items
and items with no wear in the last 60 days, so the UI cannot compare recency for
items worn more recently.

For the forecast, the browser asks permission to use its location and requests
the next-day hourly forecast directly from Open-Meteo. Coordinates are used for
that request and are not saved by the app. If permission is denied or weather
is unavailable, the UI explains the issue and uses a neutral warmth target
rather than claiming a location-specific forecast.

Not built, and left in the [Product Backlog](docs/scrum/product-backlog.md) for a next sprint: a manual weather fallback and rain reminder.

## Documentation

- [Decision records](docs/decisions.md)
- [Data model](docs/data-model.md)
- [Monitoring and SLO](docs/monitoring.md)
- [Definition of Done](docs/scrum/definition-of-done.md) and the notes for [Sprint 0](docs/scrum/sprint-0.md), [Sprint 1](docs/scrum/sprint-1.md) and [Sprint 2](docs/scrum/sprint-2.md)
- [AI usage](AI_USAGE.md)
- [End-to-end test checklist](docs/e2e-checklist.md)

## Team

| Name | GitHub | Sprint 0 | Sprint 1 | Sprint 2 | Main area |
|------|--------|----------|----------|----------|-----------|
| Dana | [@danadabbah16](https://github.com/danadabbah16) | Product Owner | | Scrum Master | Stats logic, Scrum docs |
| Gabriel | [@flipman62](https://github.com/flipman62) | Scrum Master | | | Outfit service, CI |
| Jinin | [@jinin-alj](https://github.com/jinin-alj) | | Product Owner | | Wardrobe service, local skeleton |
| Nikita | [@NikitaDjandjgava](https://github.com/NikitaDjandjgava) | | Scrum Master | | First UI version, monitoring. |
| Salome | [@salomeshioshvili](https://github.com/salomeshioshvili) | | | Product Owner | zure setup and CD to Azure setup, CD, UI redesign |

Everyone is a Developer in every sprint. The table shows who also held the Product Owner or Scrum Master role, as recorded in the sprint notes in `docs/scrum/`.
