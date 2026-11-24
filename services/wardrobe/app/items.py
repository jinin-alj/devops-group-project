from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

MAX_NAME_LENGTH = 100
MAX_COLOR_LENGTH = 30
MAX_PRICE = 99_999_999.99


class ItemIn(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    name: str = Field(min_length=1, max_length=MAX_NAME_LENGTH)
    category: Literal["top", "bottom", "shoes", "outerwear"]
    color: str = Field(min_length=1, max_length=MAX_COLOR_LENGTH)
    warmth: int = Field(ge=1, le=5, strict=True)
    price: float = Field(ge=0, le=MAX_PRICE)


class Item(ItemIn):
    id: int
