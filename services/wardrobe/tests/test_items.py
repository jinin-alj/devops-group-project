import pytest
from pydantic import ValidationError

from app.items import ItemIn

VALID_ITEM = {
    "name": "Blue jeans",
    "category": "bottom",
    "color": "#1f3a93",
    "warmth": 3,
    "price": 49.99,
}


def make_item(**changes) -> dict:
    item = dict(VALID_ITEM)
    item.update(changes)
    return item


def test_a_valid_item_is_accepted() -> None:
    item = ItemIn(**VALID_ITEM)
    assert item.name == "Blue jeans"
    assert item.price == 49.99


def test_name_is_trimmed() -> None:
    assert ItemIn(**make_item(name="  Scarf  ")).name == "Scarf"


@pytest.mark.parametrize(
    "field, value",
    [
        ("name", ""),
        ("name", "   "),
        ("name", "x" * 101),
        ("category", "hat"),
        ("color", ""),
        ("warmth", 0),
        ("warmth", 6),
        ("warmth", 2.5),
        ("price", -1),
        ("price", 100_000_000),
    ],
)
def test_invalid_values_name_the_wrong_field(field: str, value) -> None:
    with pytest.raises(ValidationError) as error:
        ItemIn(**make_item(**{field: value}))
    assert error.value.errors()[0]["loc"] == (field,)


def test_every_field_is_required() -> None:
    with pytest.raises(ValidationError) as error:
        ItemIn()
    missing = []
    for problem in error.value.errors():
        missing.append(problem["loc"][0])
    assert sorted(missing) == ["category", "color", "name", "price", "warmth"]


@pytest.mark.parametrize("category", ["top", "bottom", "shoes", "outerwear"])
def test_all_agreed_categories_are_allowed(category: str) -> None:
    assert ItemIn(**make_item(category=category)).category == category
