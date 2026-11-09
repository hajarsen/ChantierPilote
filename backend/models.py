"""Request contracts for Banyra, independent of any ERP model."""
import re
from datetime import date
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


class Model(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class Credentials(Model):
    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=1, max_length=256)

    @field_validator("email")
    @classmethod
    def email_format(cls, value: str) -> str:
        if not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", value):
            raise ValueError("Adresse e-mail invalide")
        return value.lower()


class Registration(Credentials):
    name: str = Field(min_length=2, max_length=100)

    @field_validator("password")
    @classmethod
    def strength(cls, value: str) -> str:
        if len(value) < 12 or not any(c.isalpha() for c in value) or not any(c.isdigit() for c in value):
            raise ValueError("Utilisez au moins 12 caractères, une lettre et un chiffre")
        return value


class ProjectInput(Model):
    name: str = Field(min_length=2, max_length=160)
    reference: str = Field(default="", max_length=60)
    city: str = Field(default="", max_length=100)
    client: str = Field(default="", max_length=160)
    budget: Decimal = Field(default=Decimal(0), ge=0, le=Decimal("999999999999"), max_digits=14, decimal_places=2)
    vat: Decimal = Field(default=Decimal(0), ge=0, le=100, max_digits=5, decimal_places=2)
    start_date: date = Field(default_factory=date.today)


class Check(Model):
    label: str = Field(min_length=1, max_length=300)
    done: bool = False


class TaskInput(Model):
    title: str = Field(min_length=2, max_length=200)
    description: str = Field(default="", max_length=5000)
    kind: Literal["action", "reserve", "quality", "safety"] = "action"
    trade: str = Field(default="Général", max_length=100)
    assignee_id: str | None = None
    due_date: date | None = None
    status: Literal["open", "doing", "done"] = "open"
    priority: Literal["normal", "high", "urgent"] = "normal"
    checks: list[Check] = Field(default_factory=list, max_length=50)


class TaskPatch(TaskInput):
    version: int = Field(ge=1)


class Diary(Model):
    date: date
    notes: str = Field(min_length=2, max_length=10000)
    workforce: int = Field(default=0, ge=0, le=100000)
    weather: str = Field(default="", max_length=100)


class Money(Model):
    amount: Decimal = Field(gt=0, le=Decimal("999999999999"), max_digits=14, decimal_places=2)


class Expense(Money):
    title: str = Field(min_length=2, max_length=200)
    category: Literal["Matériaux", "Main-d’œuvre", "Matériel", "Sous-traitance", "Autre"] = "Matériaux"
    supplier: str = Field(default="", max_length=160)
    date: date


class Contract(Money):
    title: str = Field(min_length=2, max_length=200)
    partner: str = Field(min_length=2, max_length=160)
    reference: str = Field(default="", max_length=80)
    retention: Decimal = Field(default=Decimal(0), ge=0, le=100, max_digits=5, decimal_places=2)
    payment_days: int = Field(default=30, ge=0, le=365)


class Valuation(Money):
    contract_id: str
    period: str = Field(pattern=r"^\d{4}-(0[1-9]|1[0-2])$")
    status: Literal["draft", "approved", "paid"] = "draft"


class Supply(Model):
    title: str = Field(min_length=2, max_length=200)
    supplier: str = Field(min_length=2, max_length=160)
    quantity: Decimal = Field(gt=0, le=Decimal("999999999"), max_digits=12, decimal_places=3)
    unit_price: Decimal = Field(ge=0, le=Decimal("999999999"), max_digits=11, decimal_places=2)
    delivery: date
    status: Literal["draft", "ordered", "received", "cancelled"] = "draft"


class Meeting(Model):
    title: str = Field(min_length=2, max_length=200)
    date: date
    participants: str = Field(default="", max_length=1000)
    notes: str = Field(min_length=2, max_length=10000)


class EntryInput(Model):
    kind: Literal["diary", "expense", "contract", "valuation", "supply", "meeting"]
    data: dict


class EntryPatch(EntryInput):
    version: int = Field(ge=1)


class Invitation(Model):
    email: str = Field(min_length=3, max_length=254)
    role: Literal["member", "viewer"] = "member"

    _email_format = field_validator("email")(Credentials.email_format.__func__)


class AcceptInvite(Model):
    token: str = Field(min_length=30, max_length=200)


ENTRY_MODELS = {"diary": Diary, "expense": Expense, "contract": Contract, "valuation": Valuation, "supply": Supply, "meeting": Meeting}
