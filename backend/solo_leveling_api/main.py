from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager
from datetime import date, datetime, timedelta, timezone
from typing import Annotated, Literal
from uuid import uuid4

from fastapi import Depends, FastAPI, Header, HTTPException
from pydantic import BaseModel, Field

Rank = Literal["E", "D", "C", "B", "A", "S"]
Stat = Literal["STR", "INT", "STAMINA", "DISCIPLINE"]
Category = Literal["TRAINING", "MIND", "DISCIPLINE", "RECOVERY"]
RaidStatus = Literal["ACTIVE", "PASSED", "FAILED", "CLAIMED"]

XP_BASE = 1000
XP_STEP_PER_LEVEL = 100


def xp_to_next_for_level(level: int) -> int:
    return XP_BASE + max(0, level - 1) * XP_STEP_PER_LEVEL


def rank_for_level(level: int) -> Rank:
    for threshold, rank in [(50, "S"), (35, "A"), (25, "B"), (15, "C"), (8, "D"), (0, "E")]:
        if level >= threshold:
            return rank
    return "E"


def today_utc() -> date:
    return datetime.now(timezone.utc).date()


def week_key(day: date | None = None) -> str:
    current = day or today_utc()
    return (current - timedelta(days=(current.weekday() + 1) % 7)).isoformat()


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
    completion_dates: list[str] = Field(default_factory=list)


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
    last_completed_date: str | None = None


class Raid(BaseModel):
    name: str = "The Architect's Trial"
    detail: str = "Complete every active quest twice this week"
    target: int = 0
    unit: str = "completions"
    xp: int = 300
    status: RaidStatus = "ACTIVE"
    week_key: str = ""
    required_quest_ids: list[str] = Field(default_factory=list)
    evaluated_at: datetime | None = None


class UserState(BaseModel):
    profile: Profile = Field(default_factory=Profile)
    quests: list[Quest] = Field(default_factory=list)
    rest_days: list[int] = Field(default_factory=lambda: [0])
    daily_history: dict[str, list[str]] = Field(default_factory=dict)
    raid: Raid = Field(default_factory=Raid)
    last_raid: Raid | None = None


STORAGE: dict[str, UserState] = {}


def starter_quests() -> list[Quest]:
    return [
        Quest(id="pushups", title="100 push-ups", detail="Build raw strength", category="TRAINING", target=100, unit="reps", xp=40, stat="STR", weekdays=[1, 2, 3, 4, 5, 6]),
        Quest(id="situps", title="100 sit-ups", detail="Forge your core", category="TRAINING", target=100, unit="reps", xp=40, stat="STAMINA", weekdays=[1, 2, 3, 4, 5, 6]),
        Quest(id="gym", title="Gym regimen", detail="45 min minimum", category="TRAINING", target=45, unit="min", xp=55, stat="STAMINA", weekdays=[1, 3, 5]),
        Quest(id="coding", title="Deep work coding", detail="No distractions", category="MIND", target=60, unit="min", xp=65, stat="INT", weekdays=[0, 1, 2, 3, 4, 5, 6]),
        Quest(id="gum", title="Chew gum", detail="Sharpen the jawline", category="DISCIPLINE", target=20, unit="min", xp=15, stat="DISCIPLINE", weekdays=[0, 1, 2, 3, 4, 5, 6]),
    ]


def required_ids_on_date(state: UserState, current: date) -> list[str]:
    if current.weekday() == 6:
        weekday = 0
    else:
        weekday = current.weekday() + 1
    if weekday in state.rest_days:
        return []
    return [quest.id for quest in state.quests if weekday in quest.weekdays]


def required_ids_for_week(state: UserState, start: date) -> list[str]:
    ids: list[str] = []
    for offset in range(7):
        for quest_id in required_ids_on_date(state, start + timedelta(days=offset)):
            if quest_id not in ids:
                ids.append(quest_id)
    return ids


def date_is_complete(state: UserState, current: date) -> bool:
    required_ids = required_ids_on_date(state, current)
    if not required_ids:
        return True
    completed_ids = state.daily_history.get(current.isoformat(), [])
    return all(quest_id in completed_ids for quest_id in required_ids)


def calculate_streak(state: UserState, current: date) -> int:
    last_date = state.profile.last_completed_date
    if not last_date:
        return 1
    if last_date == current.isoformat():
        return state.profile.streak

    cursor = current - timedelta(days=1)
    previous = date.fromisoformat(last_date)
    while cursor > previous:
        if not date_is_complete(state, cursor):
            return 1
        cursor -= timedelta(days=1)
    return state.profile.streak + 1


def create_raid(state: UserState, key: str | None = None) -> Raid:
    start = date.fromisoformat(key or week_key())
    required_ids = required_ids_for_week(state, start)
    return Raid(
        week_key=start.isoformat(),
        target=len(required_ids) * 2,
        required_quest_ids=required_ids,
    )


def raid_progress(state: UserState, raid: Raid) -> int:
    return sum(
        min(2, sum(quest_id in ids for day, ids in state.daily_history.items() if raid.week_key <= day < (date.fromisoformat(raid.week_key) + timedelta(days=7)).isoformat()))
        for quest_id in raid.required_quest_ids
    )


def evaluate_raid(state: UserState, raid: Raid) -> Raid:
    if raid.status != "ACTIVE":
        return raid
    return raid.model_copy(
        update={
            "status": "PASSED" if raid_progress(state, raid) >= raid.target else "FAILED",
            "evaluated_at": datetime.now(timezone.utc).replace(microsecond=0),
        }
    )


def roll_ended_raids() -> None:
    current_key = week_key()
    for state in STORAGE.values():
        if state.raid.week_key >= current_key:
            continue
        if state.raid.status == "ACTIVE":
            state.last_raid = evaluate_raid(state, state.raid)
        state.raid = create_raid(state, current_key)


async def raid_scheduler() -> None:
    while True:
        roll_ended_raids()
        await asyncio.sleep(60)


@asynccontextmanager
async def lifespan(_: FastAPI):
    task = asyncio.create_task(raid_scheduler())
    try:
        yield
    finally:
        task.cancel()
        await asyncio.gather(task, return_exceptions=True)


app = FastAPI(
    title="Solo Leveling Quest API",
    version="0.2.0",
    description="Account-scoped quest, progression, raid, and penalty APIs for Solo Leveling Quest.",
    lifespan=lifespan,
)


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
        state = UserState(quests=starter_quests())
        state.raid = create_raid(state)
        STORAGE[user_id] = state
    return STORAGE[user_id]


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/v1/state", response_model=UserState)
def get_state(user_id: UserId) -> UserState:
    state = state_for(user_id)
    roll_ended_raids()
    return state


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
    today = today_utc().isoformat()
    if today in quest.completion_dates:
        return state.profile

    quest.completion_dates.append(today)
    quest.completed_on = today
    state.daily_history[today] = [*state.daily_history.get(today, []), quest_id]
    state.profile.xp += quest.xp
    state.profile.stats[quest.stat] += 1

    required_today = required_ids_on_date(state, today_utc())
    if required_today and all(item in state.daily_history[today] for item in required_today):
        if state.profile.last_completed_date != today:
            state.profile.streak = calculate_streak(state, today_utc())
            state.profile.longest_streak = max(state.profile.longest_streak, state.profile.streak)
            state.profile.last_completed_date = today

    while state.profile.xp >= state.profile.xp_to_next:
        state.profile.xp -= state.profile.xp_to_next
        state.profile.level += 1
        state.profile.xp_to_next = xp_to_next_for_level(state.profile.level)
    state.profile.rank = rank_for_level(state.profile.level)
    return state.profile


@app.post("/api/v1/penalty", response_model=Profile)
def apply_penalty(user_id: UserId) -> Profile:
    state = state_for(user_id)
    state.profile.lockdown_until = datetime.now(timezone.utc).replace(microsecond=0) + timedelta(hours=24)
    state.profile.streak = 0
    state.profile.last_completed_date = None
    state.profile.xp = max(0, state.profile.xp - 100)
    return state.profile


@app.post("/api/v1/raid/claim", response_model=Profile)
def claim_raid(user_id: UserId) -> Profile:
    state = state_for(user_id)
    roll_ended_raids()
    if state.last_raid and state.last_raid.status == "CLAIMED":
        return state.profile
    if not state.last_raid or state.last_raid.status != "PASSED":
        raise HTTPException(status_code=409, detail="The scheduled evaluator has not produced a passed raid.")

    state.last_raid.status = "CLAIMED"
    state.profile.title = "Breaker of the Architect"
    state.profile.stats["DISCIPLINE"] += 3
    state.profile.xp += state.last_raid.xp
    while state.profile.xp >= state.profile.xp_to_next:
        state.profile.xp -= state.profile.xp_to_next
        state.profile.level += 1
        state.profile.xp_to_next = xp_to_next_for_level(state.profile.level)
    state.profile.rank = rank_for_level(state.profile.level)
    return state.profile