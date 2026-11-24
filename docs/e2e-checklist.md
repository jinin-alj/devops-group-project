# End-to-end test checklist

A manual check of the deployed product, run from the live URL in the [README](../README.md) before the `submission` tag.

**Run by:** Dana (@danadabbah16)
**Date:** 24 November 2026

| # | Step | Expected result | Result |
|---|------|-----------------|--------|
| 1 | Open the live URL | The page loads and both services show as available | PASS|
| 2 | Add an item with name, category, color, warmth and price | The item appears in the wardrobe list | PASS |
| 3 | Reload the page | The item is still there | PASS |
| 4 | Add an item with an empty name or a warmth of 9 | A clear validation message, and nothing is saved | PASS |
| 5 | Edit the price of an item | The list shows the new price | PASS |
| 6 | Log a wear for an item | The wear is saved without an error | PASS |
| 7 | Look at cost per wear | A worn item shows price divided by wears, and a never-worn item shows its full price | PASS |
| 8 | Look at the unworn list | Items never worn are listed | PASS |
| 9 | Delete an item and confirm | The item disappears from the list and from the statistics | PASS |
| 10 | Open `/health` on both service URLs | Each returns 200 with `"status": "ok"` | PASS |

## Bugs found and fixed

| Bug | Found | Fix |
|-----|-------|-----|
| Outfit service could not reach its database or wardrobe-service on Azure, because it did not read `DB_*` and `WARDROBE_URL` as the deployment sets them | After the first deploy | Pull request #19 |

## Open issues

- None found.