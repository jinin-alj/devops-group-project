# Sprint 0

**Dates:** 4–10 November 2026

## Roles

| Role | Member |
|------|--------|
| Product Owner | TBD |
| Scrum Master | TBD |
| Developers | All 5 members |

## Team

| Name | GitHub |
|------|--------|
| Jinin | @jinin-alj |
| Salome | @salomeshioshvili |
| Nikita | @NikitaDjandjgava |
| Dana | @danadabbahh |
| Gabriel | @flipman62 |

## Sprint Goal

Agree on the product and the way we work, and have a skeleton that runs locally with `docker compose up` and answers on `/health`.

## Product

A wardrobe app. Users add their clothes once (category, color, warmth 1 to 5, price). Each morning it checks the weather and suggests an outfit from what they own. They tap "wearing this" to log it, and the app shows cost per wear and the pieces not worn in 60 days. Details and architecture are in the [README](../../README.md).

## Items selected

| Item | Status |
|------|--------|
| Choose the product idea and the two-service split | Done |
| Create the repository with the agreed structure | Done |
| Write the Definition of Done | Done |
| Local skeleton: wardrobe-service and outfit-service with `/health` and request logging, a UI status page, `docker compose up` from a clean clone | Done |
| Initial Product Backlog in GitHub Projects, with user stories and acceptance criteria | TBD |
| Branch protection on `main` (pull request with 1 approval, no direct pushes) | Done |
| Share the repository and the project with the professor and all members | Done |

## Retrospective agreements

- Each member works on one area (wardrobe service, outfit service, UI, pipeline and Azure, monitoring and docs) and opens the pull requests for it, so the work and the Git history are split evenly from Sprint 1 on
- Every pull request gets a reviewer within a day so that no one has to wait