from datetime import date, timedelta

from app.stats import cost_per_wear, unworn_items


ITEMS = [
    {"id": 1, "name": "Blue jacket", "price": 120.0},
    {"id": 2, "name": "Black shoes", "price": 60.0},
    {"id": 3, "name": "Grey sweater", "price": 80.0},
]


def test_cost_per_wear_never_worn_returns_full_price() -> None:
    result = cost_per_wear(ITEMS, [(1, date.today())])

    assert result[0]["cost_per_wear"] == 120.0
    assert result[1]["cost_per_wear"] == 60.0
    assert result[1]["status"] == "not worn yet"


def test_cost_per_wear_divides_price_by_wear_count() -> None:
    result = cost_per_wear(
        ITEMS,
        [(1, date.today()), (1, date.today()), (2, date.today())],
    )

    assert result[0]["cost_per_wear"] == 60.0
    assert result[0]["wear_count"] == 2
    assert result[1]["cost_per_wear"] == 60.0


def test_unworn_boundaries_include_60_and_61_days() -> None:
    today = date(2026, 11, 23)
    wears = [
        (1, today - timedelta(days=59)),
        (2, today - timedelta(days=60)),
        (3, today - timedelta(days=61)),
    ]

    result = unworn_items(ITEMS, wears, today=today)

    assert [item["id"] for item in result] == [2, 3]
