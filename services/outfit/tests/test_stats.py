from datetime import date, timedelta

from app.stats import cost_per_wear, unworn_items

TODAY = date(2026, 11, 23)


def days_ago(days: int) -> date:
    return TODAY - timedelta(days=days)


def test_cost_per_wear_divides_price_by_wears():
    items = [{"id": 1, "price": 60.0}]
    wears = [{"item_id": 1, "date": days_ago(n)} for n in (1, 2, 3)]

    result = cost_per_wear(items, wears)

    assert result == [
        {"item_id": 1, "price": 60.0, "wears": 3, "cost_per_wear": 20.0, "worn": True}
    ]


def test_cost_per_wear_never_worn_shows_full_price():
    result = cost_per_wear([{"id": 1, "price": 45.5}], [])

    assert result[0]["cost_per_wear"] == 45.5
    assert result[0]["wears"] == 0
    assert result[0]["worn"] is False


def test_cost_per_wear_rounds_to_two_decimals():
    items = [{"id": 1, "price": 10.0}]
    wears = [{"item_id": 1, "date": days_ago(n)} for n in (1, 2, 3)]

    assert cost_per_wear(items, wears)[0]["cost_per_wear"] == 3.33


def test_cost_per_wear_free_item_costs_nothing():
    wears = [{"item_id": 1, "date": days_ago(1)}]

    assert cost_per_wear([{"id": 1, "price": 0}], wears)[0]["cost_per_wear"] == 0


def test_cost_per_wear_ignores_wears_of_deleted_items():
    items = [{"id": 1, "price": 30.0}]
    wears = [{"item_id": 1, "date": days_ago(1)}, {"item_id": 99, "date": days_ago(1)}]

    result = cost_per_wear(items, wears)

    assert [row["item_id"] for row in result] == [1]
    assert result[0]["wears"] == 1


def test_cost_per_wear_empty_wardrobe():
    assert cost_per_wear([], []) == []


def test_unworn_item_worn_59_days_ago_is_not_listed():
    wears = [{"item_id": 1, "date": days_ago(59)}]

    assert unworn_items([{"id": 1, "price": 10.0}], wears, TODAY) == []


def test_unworn_item_worn_60_days_ago_is_listed():
    wears = [{"item_id": 1, "date": days_ago(60)}]

    result = unworn_items([{"id": 1, "price": 10.0}], wears, TODAY)

    assert result == [{"item_id": 1, "last_worn": days_ago(60)}]


def test_unworn_item_worn_61_days_ago_is_listed():
    wears = [{"item_id": 1, "date": days_ago(61)}]

    result = unworn_items([{"id": 1, "price": 10.0}], wears, TODAY)

    assert result == [{"item_id": 1, "last_worn": days_ago(61)}]


def test_unworn_includes_items_never_worn():
    result = unworn_items([{"id": 1, "price": 10.0}], [], TODAY)

    assert result == [{"item_id": 1, "last_worn": None}]


def test_unworn_uses_the_most_recent_wear():
    wears = [{"item_id": 1, "date": days_ago(200)}, {"item_id": 1, "date": days_ago(5)}]

    assert unworn_items([{"id": 1, "price": 10.0}], wears, TODAY) == []


def test_unworn_ignores_wears_of_deleted_items():
    wears = [{"item_id": 99, "date": days_ago(100)}]

    assert unworn_items([], wears, TODAY) == []
