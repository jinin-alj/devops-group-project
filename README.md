# DevOps Group Project

A wardrobe app. You add your clothes once (category, color, warmth 1 to 5, price). Each morning it checks the weather and builds an outfit from what you own. You tap "wearing this" to log it, and the app shows cost per wear and which pieces you haven't worn in 60 days.

Built as a Scrum team for the Software Development and DevOps group assignment: planned in sprints, delivered by an automated pipeline, deployed on Azure, and monitored in production.

**Live URL:** `TODO (add after the first deploy)`

## Architecture

Two services, each in its own container with its own database. The UI is a static site that calls both from the browser (CORS restricted to the UI's origin).

```
Browser (Static Web App: sdd-<class>-g<N>-ui)
   |                              |
   v                              v
wardrobe-service (A)         outfit-service (B) ---> Open-Meteo (weather)
   |                              |   \
   v                              |    `--- HTTP ---> wardrobe-service (fetch items)
Azure SQL serverless (A)     Azure SQL serverless (B)
```

| Service | What it does | Database |
|---------|--------------|----------|
| wardrobe-service (A) | CRUD for clothing items | items |
| outfit-service (B) | Wear log, outfit suggestions, cost-per-wear stats. Fetches items from A and calls Open-Meteo | wear log |

**Why this split:** A is a simple, stable CRUD service. B holds the logic and the external dependencies, so the two can fail independently.

**Partial failure behavior**

- Weather API down: B asks for a manual cold / mild / hot choice.
- A down: B answers "wardrobe unavailable" after a timeout, with no stack trace and no hung request.
- B down: A's CRUD keeps working.

Keep this diagram in sync with what is actually deployed on Azure.

## Tech stack

- Backend: Python + FastAPI (both services)
- Frontend: plain HTML/JS, static files
- Database: SQL Server in Docker Compose locally, Azure SQL Database serverless in production
- Containers: Docker, images in GitHub Container Registry
- CI/CD: GitHub Actions
- Hosting: Azure Container Apps (Consumption, scale to zero, max 1 replica) and Azure Static Web Apps
- Monitoring: Log Analytics workspace of the Container Apps environment

## Repo structure

```
devops-group-project/
├── README.md
├── AI_USAGE.md
├── docker-compose.yml
├── .gitignore
├── .env.example
├── .github/
│   └── workflows/
│       ├── ci.yml              # PRs and pushes: lint, format, tests + coverage, image build
│       └── cd.yml              # merge to main: push images (SHA tag), deploy, migrate, /health check
├── services/
│   ├── wardrobe/
│   │   ├── Dockerfile
│   │   ├── requirements.txt    # pinned versions
│   │   ├── app/
│   │   │   ├── main.py
│   │   │   ├── routes.py
│   │   │   ├── logic.py        # core logic (70% coverage target)
│   │   │   └── db.py
│   │   ├── migrations/
│   │   │   └── 001_create_items.sql
│   │   └── tests/
│   └── outfit/
│       ├── Dockerfile
│       ├── requirements.txt
│       ├── app/
│       │   ├── main.py
│       │   ├── routes.py
│       │   ├── scoring.py      # warmth mapping + outfit scoring
│       │   ├── stats.py        # cost per wear, unworn items
│       │   ├── clients.py      # calls to wardrobe-service + Open-Meteo, with timeouts
│       │   └── db.py
│       ├── migrations/
│       │   └── 001_create_wear_log.sql
│       └── tests/
├── ui/
│   ├── index.html
│   ├── app.js
│   └── style.css
├── infra/
│   └── setup.sh                # Azure CLI (or Bicep) for the one-time setup
└── docs/
    ├── decisions.md            # 4 to 6 decision records
    ├── data-model.md           # entities + diagram, matches the migrations
    ├── monitoring.md           # saved Log Analytics queries + the SLO
    └── scrum/
        ├── definition-of-done.md
        ├── sprint-0.md
        ├── sprint-1.md
        └── sprint-2.md
```

## Run locally

Requires Docker.

```bash
git clone https://github.com/<org-or-user>/devops-group-project.git
cd devops-group-project
cp .env.example .env
docker compose up --build
```

| What | URL |
|------|-----|
| wardrobe-service | http://localhost:8001/health |
| outfit-service | http://localhost:8002/health |
| UI | http://localhost:8080 |

Migrations are applied automatically on startup.

## Run the tests

```bash
cd services/wardrobe && pip install -r requirements.txt && pytest --cov=app
cd services/outfit && pip install -r requirements.txt && pytest --cov=app
```

CI fails if coverage on the core logic drops below 70%.

## CI/CD

- **On every pull request and push (CI):** lint, format check, tests with coverage, Docker image build.
- **On merge to main (CD):** push images tagged with the commit SHA, deploy both services and the UI to Azure only if CI passed, apply migrations, then check `/health` and fail the run if it doesn't return 200 in time.
- No direct pushes to `main`. Every change goes through a pull request approved by another team member.

## Reproduce the Azure setup

Everything lives in the group's resource group, `rg-sdd-<class>-g<N>`, and every resource name starts with the prefix `sdd-<class>-g<N>`.

```bash
az login
./infra/setup.sh
```

This creates two Container Apps, two serverless SQL databases (auto-pause) and one Static Web App. Configuration goes through environment variables and GitHub secrets only. No secrets are stored in the repo.

## Monitoring

Request logs (method, path, status, duration) go to stdout and are queryable in Log Analytics. The dashboard shows request count, error rate and response time. The SLO and the query that measures it are in [docs/monitoring.md](docs/monitoring.md).

## Documentation

- [Decision records](docs/decisions.md)
- [Data model](docs/data-model.md)
- [Monitoring and SLO](docs/monitoring.md)
- [Scrum: Definition of Done and sprint notes](docs/scrum/)
- [AI usage](AI_USAGE.md)

## Team

| Name | GitHub | Sprint 0 | Sprint 1 | Sprint 2 |
|------|--------|----------|----------|----------|
| TODO | @todo  | PO / SM / Dev | | |

Roles rotate each sprint (one Product Owner, one Scrum Master, everyone else Developer).

---

## What "done" means

### Sprint 0 is done when

- [ ] Team, roles and product idea are decided and recorded in `docs/scrum/sprint-0.md`
- [ ] Repo created and shared with the professor, with the structure above in place
- [ ] Branch protection on `main` (pull request + 1 approval, no direct pushes)
- [ ] GitHub Project set up with the initial backlog as user stories with acceptance criteria
- [ ] `docs/scrum/definition-of-done.md` written
- [ ] `docker compose up` from a clean clone brings up both services, and `/health` returns 200 on each

### Sprint 1 is done when

- [ ] Hello World of both services and the UI is deployed to Azure by the pipeline (in the first days of the sprint)
- [ ] CI runs on every pull request: lint, format check, tests with coverage, image build
- [ ] CD runs on merge to `main`: images tagged with the commit SHA, deploy, migrations, `/health` check that fails the run if it doesn't return 200
- [ ] First feature works end to end on the live URL: add a clothing item in the UI and see it persisted
- [ ] `docs/scrum/sprint-1.md` filled in (goal, items done and not done, retrospective agreements)

### The MVP is done when

- [ ] Wardrobe: full CRUD on clothing items, live
- [ ] Wear log: "wearing this" is stored by service B
- [ ] Stats: cost per wear and "not worn in 60 days" show in the UI
- [ ] Outfit suggestion works from the weather, with the manual fallback when Open-Meteo fails
- [ ] Partial failure demoed: stop one service and the other keeps working, with a clear message instead of a stack trace
- [ ] `GET /health` on both services, and one log line per request (method, path, status, duration)
- [ ] Migrations applied on startup in both services
- [ ] No secrets in the repo or its history
- [ ] Coverage is 70% or higher on the core logic of each service
- [ ] Log Analytics: request logs are queryable, a dashboard or saved queries show request count, error rate and response time, and one SLO has a query that measures it
- [ ] All docs in place: README, `decisions.md`, `data-model.md`, `docs/scrum/*`, `AI_USAGE.md`
- [ ] Commit tagged `submission` on `main` and pushed before **24 Nov, 23:59**, with the URL and SHA submitted on Blackboard
- [ ] Every member has submitted their individual contribution statement

### A single backlog item is done when (Definition of Done)

Copy this into `docs/scrum/definition-of-done.md`.

- [ ] Acceptance criteria met
- [ ] Merged to `main` through a pull request approved by another team member
- [ ] CI is green
- [ ] Deployed to Azure by the pipeline
- [ ] Tests added for new logic
- [ ] Docs updated if behavior changed (README, data model, decisions)
- [ ] `AI_USAGE.md` updated if AI helped

### Cut list if time runs out (in this order)

1. Color scoring in outfit suggestions
2. Umbrella / rain reminder
3. "Avoid recently worn items" rule
4. The outfit suggestion itself, keeping the wear log and cost per wear

Never cut: the deployed pipeline, health checks, monitoring, tests, docs.
