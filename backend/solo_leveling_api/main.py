from __future__ import annotations

from datetime import datetime, timezone
from typing import Annotated, Literal
from uuid import uuid4

from fastapi import Depends, FastAPI, Header, HTTPException
from pydantic import BaseModel, Field

app = FastAPI(
    title="Solo Leveling Quest API",
    version="0.1.0",
    description="Account-scoped quest, progression, raid, and penalty APIs for Solo Leveling Quest.",
)

Rank = Literal["E", "D", "C", "B", "A", "S"]
Stat = Literal["STR", "INT", "STAMINA", "DISCIPLINE"]
Category = Literal["TRAINING", "MIND", "DISCIPLINE", "RECOVERY"]


class Quest(BaseModel):
    id: str
    title: str
    detail: str
    category: Category
    target: int = Field(gt=0)
    unit: str
    xp: int = Field(gt=0)
    stat: Stat
    weekdays: list[int] = Field(min_length=1, max_length=7)
    completed_on: str | None = None


class QuestCreate(BaseModel):
    title: str = Field(min_length=1, max_length=80)
    detail: str = Field(default="Custom daily objective", max_length=160)
    category: Category = "DISCIPLINE"
    target: int = Field(default=1, gt=0)
    unit: str = Field(default="set", max_length=20)
    xp: int = Field(default=25, gt=0, le=500)
    stat: Stat = "DISCIPLINE"
    weekdays: list[int] = Field(default_factory=lambda: [0, 1, 2, 3, 4, 5, 6], min_length=1, max_length=7)


class Profile(BaseModel):
    name: str = "AWAKENED HUNTER"
    level: int = 1
    xp: int = 0
    xp_to_next: int = 1000
    rank: Rank = "E"
    streak: int = 0
    longest_streak: int = 0
    stats: dict[Stat, int] = Field(default_factory=lambda: {"STR": 1, "INT": 1, "STAMINA": 1, "DISCIPLINE": 1})
    title: str = "Unranked"
    lockdown_until: datetime | None = None


class Raid(BaseModel):
    name: str = "The Architect's Trial"
    detail: str = "Complete every active quest twice this week"
    target: int = 10
    xp: int = 300
    completed: bool = False
    week_key: str = ""


class UserState(BaseModel):
    profile: Profile = Field(default_factory=Profile)
    quests: list[Quest] = Field(default_factory=list)
    rest_days: list[int] = Field(default_factory=lambda: [0])
    raid: Raid = Field(default_factory=Raid)


STORAGE: dict[str, UserState] = {}


def current_user_id(authorization: Annotated[str | None, Header()] = None) -> str:
    """Trust Clerk as the authentication boundary.

    The production adapter should validate the Clerk bearer token before passing
    the subject here. Keeping this dependency isolated makes that adapter
    replaceable without changing quest or progression routes.
    """

    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="A Clerk bearer token is required.")
    token = authorization.split(" ", 1)[1].strip()
    if not token:
        raise HTTPException(status_code=401, detail="Invalid Clerk bearer token.")
    return token


UserId = Annotated[str, Depends(current_user_id)]


def state_for(user_id: str) -> UserState:
    if user_id not in STORAGE:
        STORAGE[user_id] = UserState(
            quests=[
                Quest(id="pushups", title="100 push-ups", detail="Build raw strength", category="TRAINING", target=100, unit="reps", xp=40, stat="STR", weekdays=[1, 2, 3, 4, 5, 6]),
                Quest(id="situps", title="100 sit-ups", detail="Forge your core", category="TRAINING", target=100, unit="reps", xp=40, stat="STAMINA", weekdays=[1, 2, 3, 4, 5, 6]),
                Quest(id="gym", title="Gym regimen", detail="45 min minimum", category="TRAINING", target=45, unit="min", xp=55, stat="STAMINA", weekdays=[1, 3, 5]),
                Quest(id="coding", title="Deep work coding", detail="No distractions", category="MIND", target=60, unit="min", xp=65, stat="INT", weekdays=[0, 1, 2, 3, 4, 5, 6]),
                Quest(id="gum", title="Chew gum", detail="Sharpen the jawline", category="DISCIPLINE", target=20, unit="min", xp=15, stat="DISCIPLINE", weekdays=[0, 1, 2, 3, 4, 5, 6]),
            ],
            raid=Raid(week_key=datetime.now(timezone.utc).date().isoformat()),
        )
    return STORAGE[user_id]


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/v1/state", response_model=UserState)
def get_state(user_id: UserId) -> UserState:
    return state_for(user_id)


@app.post("/api/v1/quests", response_model=Quest, status_code=201)
def create_quest(payload: QuestCreate, user_id: UserId) -> Quest:
    state = state_for(user_id)
    quest = Quest(id=str(uuid4()), **payload.model_dump())
    state.quests.append(quest)
    return quest


@app.post("/api/v1/quests/{quest_id}/complete", response_model=Profile)
def complete_quest(quest_id: str, user_id: UserId) -> Profile:
    state = state_for(user_id)
    quest = next((item for item in state.quests if item.id == quest_id), None)
    if not quest:
        raise HTTPException(status_code=404, detail="Quest not found.")
    today = datetime.now(timezone.utc).date().isoformat()
    if quest.completed_on == today:
        return state.profile
    quest.completed_on = today
    state.profile.xp += quest.xp
    state.profile.stats[quest.stat] += 1
    state.profile.streak += 1
    state.profile.longest_streak = max(state.profile.longest_streak, state.profile.streak)
    while state.profile.xp >= state.profile.xp_to_next:
        state.profile.xp -= state.profile.xp_to_next
        state.profile.level += 1
        state.profile.xp_to_next = 1000 + state.profile.level * 50
    state.profile.rank = next(
        rank for threshold, rank in [(50, "S"), (35, "A"), (25, "B"), (15, "C"), (8, "D"), (0, "E")]
        if state.profile.level >= threshold
    )
    return state.profile


@app.post("/api/v1/penalty", response_model=Profile)
def apply_penalty(user_id: UserId) -> Profile:
    state = state_for(user_id)
    state.profile.lockdown_until = datetime.now(timezone.utc).replace(microsecond=0) + __import__("datetime").timedelta(hours=24)
    state.profile.streak = 0
    state.profile.xp = max(0, state.profile.xp - 100)
    return state.profile


@app.post("/api/v1/raid/claim", response_model=Profile)
def claim_raid(user_id: UserId) -> Profile:
    state = state_for(user_id)
    if state.raid.completed:
        return state.profile
    today_index = datetime.now(timezone.utc).weekday()
    active = [quest for quest in state.quests if today_index in quest.weekdays]
    if any(quest.completed_on != datetime.now(timezone.utc).date().isoformat() for quest in active):
        raise HTTPException(status_code=409, detail="Every active quest must be complete before the raid is claimed.")
    state.raid.completed = True
    state.profile.title = "Breaker of the Architect"
    state.profile.stats["DISCIPLINE"] += 3
    state.profile.xp += state.raid.xp
    return state.profile