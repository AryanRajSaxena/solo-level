from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager
from datetime import date, datetime, timedelta, timezone
from typing import Annotated, Literal
from uuid import uuid4

from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from . import db

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
    is_custom: bool = False
    ramp_key: str | None = None

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

class ProfileUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=50)
    title: str | None = Field(default=None, max_length=50)
    journey_start_date: str | None = None

class Raid(BaseModel):
    id: str | None = None
    name: str = "The Architect's Trial"
    detail: str = "Complete every active quest twice this week"
    target: int = 0
    unit: str = "completions"
    xp: int = 300
    status: RaidStatus = "ACTIVE"
    week_key: str = ""
    required_quest_ids: list[str] = Field(default_factory=list)
    evaluated_at: datetime | None = None
    is_current: bool = True

class UserState(BaseModel):
    profile: Profile = Field(default_factory=Profile)
    quests: list[Quest] = Field(default_factory=list)
    rest_days: list[int] = Field(default_factory=lambda: [0])
    daily_history: dict[str, list[str]] = Field(default_factory=dict)
    raid: Raid = Field(default_factory=Raid)
    last_raid: Raid | None = None

class RestDaysUpdate(BaseModel):
    days: list[int]

def required_ids_on_date(quests: list[dict], rest_days: list[int], current: date) -> list[str]:
    if current.weekday() == 6:
        weekday = 0
    else:
        weekday = current.weekday() + 1
    if weekday in rest_days:
        return []
    return [quest["id"] for quest in quests if weekday in quest["weekdays"]]

def required_ids_for_week(quests: list[dict], rest_days: list[int], start: date) -> list[str]:
    ids: list[str] = []
    for offset in range(7):
        for quest_id in required_ids_on_date(quests, rest_days, start + timedelta(days=offset)):
            if quest_id not in ids:
                ids.append(quest_id)
    return ids

def date_is_complete(quests: list[dict], rest_days: list[int], history: dict[str, list[str]], current: date) -> bool:
    required_ids = required_ids_on_date(quests, rest_days, current)
    if not required_ids:
        return True
    completed_ids = history.get(current.isoformat(), [])
    return all(quest_id in completed_ids for quest_id in required_ids)

def calculate_streak(profile: dict, quests: list[dict], rest_days: list[int], history: dict[str, list[str]], current: date) -> int:
    last_date = profile.get("last_completed_date")
    if not last_date:
        return 1
    if last_date == current.isoformat():
        return profile.get("streak", 0)

    cursor = current - timedelta(days=1)
    previous = date.fromisoformat(last_date)
    while cursor > previous:
        if not date_is_complete(quests, rest_days, history, cursor):
            return 1
        cursor -= timedelta(days=1)
    return profile.get("streak", 0) + 1

def raid_progress(history: dict[str, list[str]], raid: dict) -> int:
    week_start = raid["week_key"]
    week_end = (date.fromisoformat(week_start) + timedelta(days=7)).isoformat()
    return sum(
        min(2, sum(quest_id in ids for day, ids in history.items() if week_start <= day < week_end))
        for quest_id in raid["required_quest_ids"]
    )

async def evaluate_raid_db(user_id: str, raid: dict, history: dict[str, list[str]]) -> dict:
    if raid["status"] != "ACTIVE":
        return raid
    prog = raid_progress(history, raid)
    status = "PASSED" if prog >= raid["target"] else "FAILED"
    evaluated_at = datetime.now(timezone.utc).replace(microsecond=0).isoformat()
    return await db.update_raid(raid["id"], {"status": status, "evaluated_at": evaluated_at})

async def roll_ended_raids_for_user(user_id: str) -> None:
    current_key = week_key()
    # The configured Supabase client is synchronous; only await our async
    # database wrapper functions, not the client's APIResponse.
    active_raid_data = db.supabase.table("raids").select("*").eq("user_id", user_id).eq("is_current", True).execute()
    if not active_raid_data.data:
        return
    active_raid = active_raid_data.data[0]
    
    if active_raid["week_key"] >= current_key:
        return
        
    if active_raid["status"] == "ACTIVE":
        completions = await db.get_completions(user_id)
        history = {}
        for c in completions:
            d = c["completed_date"]
            history.setdefault(d, []).append(c["quest_id"])
        await evaluate_raid_db(user_id, active_raid, history)
    
    # Create new raid for current week
    quests = await db.get_quests(user_id)
    rest_days = await db.get_rest_days(user_id)
    req_ids = required_ids_for_week(quests, rest_days, date.fromisoformat(current_key))
    await db.get_or_create_current_raid(user_id, current_key, req_ids, len(req_ids) * 2)

async def raid_scheduler() -> None:
    while True:
        try:
            current_key = week_key()
            active_raids = await db.get_all_active_raids()
            for r in active_raids:
                if r["week_key"] < current_key:
                    await roll_ended_raids_for_user(r["user_id"])
        except Exception as e:
            print(f"Raid scheduler error: {e}")
        await asyncio.sleep(60)

@asynccontextmanager
async def lifespan(_: FastAPI):
    db.init_supabase()
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

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def current_user_id(authorization: Annotated[str | None, Header()] = None) -> str:
    """Resolve a bearer token to a Supabase user.

    Token signatures may use Supabase's legacy JWT secret or an asymmetric
    signing key. Delegating validation to the project's Auth service supports
    both configurations and prevents the API's environment from drifting from
    the project that issued the token.
    """
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Bearer token required.")

    if db.supabase is None:
        raise HTTPException(status_code=503, detail="Supabase authentication is not configured.")

    token = authorization.split(" ", 1)[1].strip()
    try:
        response = db.supabase.auth.get_user(token)
        user = response.user
        if not user or not user.id:
            raise ValueError("Supabase returned no user")
        return user.id
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired token.")

UserId = Annotated[str, Depends(current_user_id)]

def db_profile_to_pydantic(p: dict) -> Profile:
    return Profile(
        name=p["name"],
        level=p["level"],
        xp=p["xp"],
        xp_to_next=p["xp_to_next"],
        rank=p["rank"],
        streak=p["streak"],
        longest_streak=p["longest_streak"],
        stats={
            "STR": p["stat_str"],
            "INT": p["stat_int"],
            "STAMINA": p["stat_stamina"],
            "DISCIPLINE": p["stat_discipline"]
        },
        title=p["title"],
        lockdown_until=p.get("lockdown_until"),
        last_completed_date=p.get("last_completed_date")
    )

def db_quest_to_pydantic(q: dict, completions: list[dict]) -> Quest:
    dates = [c["completed_date"] for c in completions if c["quest_id"] == q["id"]]
    today = today_utc().isoformat()
    return Quest(
        id=q["id"],
        title=q["title"],
        detail=q["detail"],
        category=q["category"],
        target=q["target"],
        unit=q["unit"],
        xp=q["xp"],
        stat=q["stat"],
        weekdays=q["weekdays"],
        is_custom=q.get("is_custom", False),
        ramp_key=q.get("ramp_key"),
        completed_on=today if today in dates else None,
        completion_dates=dates
    )

def db_raid_to_pydantic(r: dict | None) -> Raid | None:
    if not r:
        return None
    return Raid(
        id=r["id"],
        name=r["name"],
        detail=r["detail"],
        target=r["target"],
        unit=r["unit"],
        xp=r["xp"],
        status=r["status"],
        week_key=r["week_key"],
        required_quest_ids=r["required_quest_ids"],
        evaluated_at=r.get("evaluated_at"),
        is_current=r["is_current"]
    )

@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}

@app.get("/api/v1/state", response_model=UserState)
async def get_state(user_id: UserId) -> UserState:
    await roll_ended_raids_for_user(user_id)
    
    p = await db.get_or_create_profile(user_id)
    quests_data = await db.get_quests(user_id)
    if not quests_data:
        quests_data = await db.insert_starter_quests(user_id)
        
    completions = await db.get_completions(user_id)
    history = {}
    for c in completions:
        history.setdefault(c["completed_date"], []).append(c["quest_id"])
        
    rest_days = await db.get_rest_days(user_id)
    
    current_key = week_key()
    req_ids = required_ids_for_week(quests_data, rest_days, date.fromisoformat(current_key))
    raid_data = await db.get_or_create_current_raid(user_id, current_key, req_ids, len(req_ids) * 2)
    last_raid_data = await db.get_last_raid(user_id)
    
    return UserState(
        profile=db_profile_to_pydantic(p),
        quests=[db_quest_to_pydantic(q, completions) for q in quests_data],
        rest_days=rest_days,
        daily_history=history,
        raid=db_raid_to_pydantic(raid_data),
        last_raid=db_raid_to_pydantic(last_raid_data)
    )

@app.post("/api/v1/quests", response_model=Quest, status_code=201)
async def create_quest(payload: QuestCreate, user_id: UserId) -> Quest:
    q_data = payload.model_dump()
    q_data["id"] = str(uuid4())
    q_data["is_custom"] = True
    new_q = await db.create_quest(user_id, q_data)
    return db_quest_to_pydantic(new_q, [])

@app.delete("/api/v1/quests/{quest_id}")
async def delete_quest(quest_id: str, user_id: UserId):
    quests = await db.get_quests(user_id)
    target = next((q for q in quests if q["id"] == quest_id or q["id"] == f"{user_id}_{quest_id}" or q["id"].endswith(f"_{quest_id}")), None)
    real_id = target["id"] if target else quest_id
    await db.delete_quest(user_id, real_id)
    return {"status": "deleted"}

@app.put("/api/v1/rest-days")
async def update_rest_days(payload: RestDaysUpdate, user_id: UserId):
    days = await db.set_rest_days(user_id, payload.days)
    return {"days": days}

@app.post("/api/v1/quests/{quest_id}/complete", response_model=Profile)
async def complete_quest(quest_id: str, user_id: UserId) -> Profile:
    quests = await db.get_quests(user_id)
    quest = next((q for q in quests if q["id"] == quest_id or q["id"] == f"{user_id}_{quest_id}" or q["id"].endswith(f"_{quest_id}") or (q.get("ramp_key") and q.get("ramp_key").lower() == quest_id.lower())), None)
    if not quest:
        raise HTTPException(status_code=404, detail="Quest not found.")
        
    today = today_utc().isoformat()
    await db.record_completion(user_id, quest["id"], today)
    
    profile = await db.get_or_create_profile(user_id)
    completions = await db.get_completions(user_id)
    
    history = {}
    for c in completions:
        history.setdefault(c["completed_date"], []).append(c["quest_id"])
        
    updates = {}
    updates["xp"] = profile["xp"] + quest["xp"]
    stat_key = f"stat_{quest['stat'].lower()}"
    updates[stat_key] = profile[stat_key] + 1
    
    rest_days = await db.get_rest_days(user_id)
    required_today = required_ids_on_date(quests, rest_days, today_utc())
    
    if required_today and all(item in history.get(today, []) for item in required_today):
        if profile.get("last_completed_date") != today:
            streak = calculate_streak(profile, quests, rest_days, history, today_utc())
            updates["streak"] = streak
            updates["longest_streak"] = max(profile.get("longest_streak", 0), streak)
            updates["last_completed_date"] = today
            profile.update(updates)

    while updates["xp"] >= profile["xp_to_next"]:
        updates["xp"] -= profile["xp_to_next"]
        updates["level"] = profile.get("level", 1) + 1
        updates["xp_to_next"] = xp_to_next_for_level(updates["level"])
        profile.update(updates)
        
    updates["rank"] = rank_for_level(updates.get("level", profile["level"]))
    
    updated_profile = await db.update_profile(user_id, updates)
    return db_profile_to_pydantic(updated_profile)

@app.post("/api/v1/penalty", response_model=Profile)
async def apply_penalty(user_id: UserId) -> Profile:
    profile = await db.get_or_create_profile(user_id)
    updates = {
        "lockdown_until": (datetime.now(timezone.utc).replace(microsecond=0) + timedelta(hours=24)).isoformat(),
        "streak": 0,
        "last_completed_date": None,
        "xp": max(0, profile["xp"] - 100)
    }
    updated = await db.update_profile(user_id, updates)
    return db_profile_to_pydantic(updated)

@app.post("/api/v1/raid/claim", response_model=Profile)
async def claim_raid(user_id: UserId) -> Profile:
    await roll_ended_raids_for_user(user_id)
    
    last_raid = await db.get_last_raid(user_id)
    profile = await db.get_or_create_profile(user_id)
    
    if last_raid and last_raid["status"] == "CLAIMED":
        return db_profile_to_pydantic(profile)
    if not last_raid or last_raid["status"] != "PASSED":
        raise HTTPException(status_code=409, detail="The scheduled evaluator has not produced a passed raid.")

    await db.update_raid(last_raid["id"], {"status": "CLAIMED"})
    
    updates = {
        "title": "Breaker of the Architect",
        "stat_discipline": profile["stat_discipline"] + 3,
        "xp": profile["xp"] + last_raid["xp"]
    }
    profile.update(updates)
    
    while updates["xp"] >= profile["xp_to_next"]:
        updates["xp"] -= profile["xp_to_next"]
        updates["level"] = profile.get("level", 1) + 1
        updates["xp_to_next"] = xp_to_next_for_level(updates["level"])
        profile.update(updates)
        
    updates["rank"] = rank_for_level(updates.get("level", profile["level"]))
    
    updated = await db.update_profile(user_id, updates)
    return db_profile_to_pydantic(updated)

@app.patch("/api/v1/profile", response_model=Profile)
async def update_profile_endpoint(payload: ProfileUpdate, user_id: UserId) -> Profile:
    updates = {k: v for k, v in payload.model_dump(exclude_unset=True).items() if v is not None}
    if not updates:
        p = await db.get_or_create_profile(user_id)
        return db_profile_to_pydantic(p)
    updated = await db.update_profile(user_id, updates)
    return db_profile_to_pydantic(updated)
