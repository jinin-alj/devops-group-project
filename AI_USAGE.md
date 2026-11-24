# AI Usage

One row per significant piece of AI-assisted work, including workflows, Dockerfiles and IaC. Each member adds their own rows in the pull request that contains the work.

| Date | Member | Tool | What it was used for | Files | How it was checked |
|------|--------|------|----------------------|-------|--------------------|
| 2026-11-23 | Dana (@danadabbah16) | Claude | Drafted the cost-per-wear and unworn-items functions and their unit tests | `services/outfit/app/stats.py`, `services/outfit/tests/test_stats.py` | Read and reviewed the code |
| 2026-11-23 | Dana (@danadabbah16) | Claude | Drafted the Sprint 1 notes from the repository history | `docs/scrum/sprint-1.md` | Checked against the merged pull requests and the Product Backlog |
| 2026-11-10 | Jinin (@jinin-alj) | Claude | Helped set up the Sprint 0 skeleton | `services/`, `docker-compose.yml`, `ui/index.html` | Reviewed and adjusted the code, ran the tests and `docker compose up` |
| 2026-11-24 | Jinin (@jinin-alj) | Claude | Helped write the wardrobe database layer, migrations and items CRUD with their tests | `services/wardrobe/`, `docker-compose.yml` | Reviewed and edited the code, ran the tests and checked the endpoints against SQL Server locally |
| 2026-11-24 | Jinin (@jinin-alj) | Claude | Helped draft the data model page and the storage decision record | `docs/data-model.md`, `docs/decisions.md` | Checked against the migration files |
| 2026-11-10 | Salome (@salomeshioshvili) | Cursor | Drafted the initial project README (scope, architecture sketch, checklist) | `README.md` | Edited to match the group plan and later updated against the live deploy |
| 2026-11-19 | Salome (@salomeshioshvili) | Cursor | Drafted Sprint 2 plan with owners, shared Item/Wear/Stats contracts and working agreements | `docs/scrum/sprint-2.md` | Reviewed with the team roles and the product backlog |
| 2026-11-24 | Salome (@salomeshioshvili) | Cursor | Redesigned the Wardrobe UI to the mockup (layout, styles, client behaviour) | `ui/index.html`, `ui/style.css`, `ui/app.js` | Ran locally with Docker Compose; hard-refreshed and exercised add, wear, weather and navigation |
| 2026-11-24 | Dana (@danadabbah16) | Claude | Drafted the Sprint 2 review and retrospective from the repository history | `docs/scrum/sprint-2.md` | Checked against the merged pull requests |
