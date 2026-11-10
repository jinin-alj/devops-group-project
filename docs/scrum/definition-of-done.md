# Definition of Done

A backlog item is done only when every box below is ticked. 

## Process

- [ ] Acceptance criteria of the user story are met
- [ ] Merged to `main` through a pull request reviewed and approved by another team member
- [ ] CI is green on the pull request (lint, format check, tests with coverage, image build)
- [ ] Deployed to Azure by the pipeline, and `/health` returns 200 after the deploy

## Code

- [ ] Tests added or updated for any new logic, and coverage on the core logic stays at 70% or above
- [ ] Every endpoint logs one line per request (method, path, status, duration) and no request bodies
- [ ] Schema changes go through a new versioned migration file and never through edits to an old one
- [ ] Calls to the other service or to an external API have a timeout and return a clear error message

## Containers and security

- [ ] Dockerfiles copy only what they need (no `COPY . .`), run as a non-root user and use pinned dependencies
- [ ] No secrets in the code, the images or the Git history. Configuration comes from environment variables and GitHub secrets

## Documentation

- [ ] README, `docs/decisions.md` or `docs/data-model.md` updated if the change affects them
- [ ] `AI_USAGE.md` updated if AI helped with the work

## Note for Sprint 0

The pipeline does not exist until Sprint 1, so for Sprint 0 items "deployed" means the item works from a clean clone with `docker compose up`.
