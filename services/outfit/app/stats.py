"""Wear statistics: cost per wear and items not worn recently.

Pure functions with no database or HTTP calls. The endpoints pass in the items
fetched from wardrobe-service and the wears stored by outfit-service.

Expected shapes:
    item: {"id": int, "price": float, ...}   (extra keys are ignored)
    wear: {"item_id": int, "date": datetime.date}
"""

from datetime import date, timedelta

UNWORN_AFTER_DAYS = 60


def cost_per_wear(items: list[dict], wears: list[dict]) -> list[dict]:
    """Return price divided by number of wears for each item.

    An item that was never worn keeps its full price as the cost, with
    ``worn`` set to False, so there is no division by zero. Wears that point
    to an item that no longer exists are ignored.
    """
    wear_counts: dict[int, int] = {}
    for wear in wears:
        wear_counts[wear["item_id"]] = wear_counts.get(wear["item_id"], 0) + 1

    results = []
    for item in items:
        count = wear_counts.get(item["id"], 0)
        cost = item["price"] / count if count else item["price"]
        results.append(
            {
                "item_id": item["id"],
                "price": item["price"],
                "wears": count,
                "cost_per_wear": round(cost, 2),
                "worn": count > 0,
            }
        )
    return results


def unworn_items(
    items: list[dict],
    wears: list[dict],
    today: date,
    days: int = UNWORN_AFTER_DAYS,
) -> list[dict]:
    """Return the items with no wear in the last ``days`` days.

    An item worn exactly ``days`` days ago counts as unworn; one worn
    ``days - 1`` days ago does not. Items never worn are included, with
    ``last_worn`` set to None.
    """
    cutoff = today - timedelta(days=days)

    last_worn: dict[int, date] = {}
    for wear in wears:
        item_id = wear["item_id"]
        if item_id not in last_worn or wear["date"] > last_worn[item_id]:
            last_worn[item_id] = wear["date"]

    results = []
    for item in items:
        last = last_worn.get(item["id"])
        if last is None or last <= cutoff:
            results.append({"item_id": item["id"], "last_worn": last})
    return results
