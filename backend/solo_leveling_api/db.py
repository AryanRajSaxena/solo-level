from supabase import create_client, Client
import os
from dotenv import load_dotenv
from uuid import uuid4

load_dotenv()

supabase: Client | None = None

def init_supabase():
    global supabase
    if supabase is None:
        url = os.environ.get("SUPABASE_URL")
        key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
        if url and key:
            try:
                supabase = create_client(url, key)
            except Exception as e:
                print(f"[Supabase] Connection error: {e}")
        else:
            print("[Supabase] Notice: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY not set yet in .env")

async def get_or_create_profile(user_id: str) -> dict:
    res = supabase.table("profiles").select("*").eq("user_id", user_id).execute()
    if res.data:
        return res.data[0]
    
    # insert with defaults
    res = supabase.table("profiles").insert({"user_id": user_id}).execute()
    return res.data[0]

async def get_quests(user_id: str) -> list[dict]:
    res = supabase.table("quests").select("*").eq("user_id", user_id).execute()
    return res.data

async def insert_starter_quests(user_id: str) -> list[dict]:
    starter = [
        {"id": f"{user_id}_pushups", "user_id": user_id, "title": "100 push-ups", "detail": "Build raw strength", "category": "TRAINING", "target": 20, "unit": "reps", "xp": 40, "stat": "STR", "weekdays": [1, 2, 3, 4, 5, 6], "is_custom": False, "ramp_key": "PUSHUPS"},
        {"id": f"{user_id}_situps", "user_id": user_id, "title": "20 sit-ups", "detail": "Forge your core", "category": "TRAINING", "target": 20, "unit": "reps", "xp": 40, "stat": "STAMINA", "weekdays": [1, 2, 3, 4, 5, 6], "is_custom": False, "ramp_key": "SITUPS"},
        {"id": f"{user_id}_gym", "user_id": user_id, "title": "Gym regimen", "detail": "45 min minimum", "category": "TRAINING", "target": 45, "unit": "min", "xp": 55, "stat": "STAMINA", "weekdays": [1, 3, 5], "is_custom": False, "ramp_key": None},
        {"id": f"{user_id}_coding", "user_id": user_id, "title": "Deep work coding", "detail": "No distractions", "category": "MIND", "target": 60, "unit": "min", "xp": 65, "stat": "INT", "weekdays": [0, 1, 2, 3, 4, 5, 6], "is_custom": False, "ramp_key": None},
        {"id": f"{user_id}_gum", "user_id": user_id, "title": "Chew gum", "detail": "Sharpen the jawline", "category": "DISCIPLINE", "target": 20, "unit": "min", "xp": 15, "stat": "DISCIPLINE", "weekdays": [0, 1, 2, 3, 4, 5, 6], "is_custom": False, "ramp_key": None},
    ]
    res = supabase.table("quests").insert(starter).execute()
    return res.data

async def create_quest(user_id: str, quest_data: dict) -> dict:
    quest_data["user_id"] = user_id
    res = supabase.table("quests").insert(quest_data).execute()
    return res.data[0]

async def delete_quest(user_id: str, quest_id: str) -> None:
    supabase.table("quests").delete().eq("user_id", user_id).eq("id", quest_id).execute()

async def record_completion(user_id: str, quest_id: str, completed_date: str) -> dict | None:
    res = supabase.table("daily_completions").upsert({
        "user_id": user_id,
        "quest_id": quest_id,
        "completed_date": completed_date
    }, on_conflict="user_id,quest_id,completed_date").execute()
    if res.data:
        return res.data[0]
    return None

async def get_completions(user_id: str, start_date: str | None = None, end_date: str | None = None) -> list[dict]:
    query = supabase.table("daily_completions").select("*").eq("user_id", user_id)
    if start_date:
        query = query.gte("completed_date", start_date)
    if end_date:
        query = query.lt("completed_date", end_date)
    res = query.execute()
    return res.data

async def update_profile(user_id: str, updates: dict) -> dict:
    res = supabase.table("profiles").update(updates).eq("user_id", user_id).execute()
    return res.data[0] if res.data else {}

async def get_or_create_current_raid(user_id: str, week_key: str, required_quest_ids: list[str], target: int) -> dict:
    res = supabase.table("raids").select("*").eq("user_id", user_id).eq("is_current", True).execute()
    if res.data and res.data[0]["week_key"] == week_key:
        return res.data[0]
        
    if res.data:
        supabase.table("raids").update({"is_current": False}).eq("id", res.data[0]["id"]).execute()
        
    new_raid = {
        "user_id": user_id,
        "week_key": week_key,
        "required_quest_ids": required_quest_ids,
        "target": target,
        "is_current": True,
        "status": "ACTIVE"
    }
    res = supabase.table("raids").insert(new_raid).execute()
    return res.data[0]

async def get_last_raid(user_id: str) -> dict | None:
    res = supabase.table("raids").select("*").eq("user_id", user_id).eq("is_current", False).order("created_at", desc=True).limit(1).execute()
    return res.data[0] if res.data else None

async def update_raid(raid_id: str, updates: dict) -> dict:
    res = supabase.table("raids").update(updates).eq("id", raid_id).execute()
    return res.data[0] if res.data else {}

async def get_rest_days(user_id: str) -> list[int]:
    res = supabase.table("rest_days").select("day").eq("user_id", user_id).execute()
    if not res.data:
        # Default is usually [0], but let's insert and return
        return [0]
    return [row["day"] for row in res.data]

async def set_rest_days(user_id: str, days: list[int]) -> list[int]:
    supabase.table("rest_days").delete().eq("user_id", user_id).execute()
    if days:
        supabase.table("rest_days").insert([{"user_id": user_id, "day": day} for day in days]).execute()
    return days

async def get_all_active_raids() -> list[dict]:
    res = supabase.table("raids").select("*").eq("is_current", True).execute()
    return res.data
