from datetime import date, timedelta
from typing import Any


def cost_per_wear(
    items: list[dict[str, Any]],
    wears: list[tuple[int, date]],
) -> list[dict[str, Any]]:
    wear_counts: dict[int, int] = {}
    for item_id, _ in wears:
        wear_counts[item_id] = wear_counts.get(item_id, 0) + 1

    result = []
    for item in items:
        item_id = int(item["id"])
        wear_count = wear_counts.get(item_id, 0)
        price = float(item["price"])
        if wear_count == 0:
            cost = price
            status = "not worn yet"
        else:
            cost = round(price / wear_count, 2)
            status = None

        entry: dict[str, Any] = {
            "id": item_id,
            "name": item["name"],
            "price": price,
            "wear_count": wear_count,
            "cost_per_wear": cost,
        }
        if status:
            entry["status"] = status
        result.append(entry)
    return result


def unworn_items(
    items: list[dict[str, Any]],
    wears: list[tuple[int, date]],
    today: date | None = None,
) -> list[dict[str, Any]]:
    reference_date = today or date.today()
    cutoff = reference_date - timedelta(days=60)

    most_recent_wear: dict[int, date] = {}
    for item_id, worn_on in wears:
        if item_id not in most_recent_wear or worn_on > most_recent_wear[item_id]:
            most_recent_wear[item_id] = worn_on

    result = []
    for item in items:
        item_id = int(item["id"])
        last_worn = most_recent_wear.get(item_id)
        if last_worn is None or last_worn <= cutoff:
            result.append(
                {
                    "id": item_id,
                    "name": item["name"],
                    "last_worn": last_worn.isoformat() if last_worn else None,
                }
            )
    return result
