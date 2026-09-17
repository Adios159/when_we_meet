"""
FreeTime Finder - backend
-------------------------
여러 사람이 각자 시간표(09:00~18:00, 30분 단위 18칸)를 제출하면,
전원이 비어있는(free) 시간대만 계산해서 돌려주는 백엔드.

프라이버시 설계:
- 과목명, 작성자 이름 등은 애초에 서버로 전송/저장하지 않는다.
- 저장되는 건 방(room) 하나당 여러 개의 "18칸 boolean 배열(busy/free)"뿐.
- overlap API는 원본 제출 데이터를 절대 돌려주지 않고,
  "칸별로 몇 명이 비어있는지"와 "전원이 비어있는 칸"만 계산해서 응답한다.
  -> 그래서 프론트엔드는 "누가 몇 시에 바쁜지"를 재구성할 방법이 없음.

실행:
    cd backend
    pip install fastapi uvicorn --break-system-packages
    uvicorn main:app --reload --port 8000
"""

import json
import sqlite3
import uuid
from contextlib import contextmanager
from pathlib import Path
from typing import List

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

DB_PATH = Path(__file__).parent / "freetime.db"
SLOT_COUNT = 18  # 09:00 ~ 18:00, 30분 단위 => (18-9)*2 = 18칸
DAY_LABELS = ["월", "화", "수", "목", "금"]
DAY_COUNT = len(DAY_LABELS)
TOTAL_CELLS = DAY_COUNT * SLOT_COUNT  # 요일별 x 시간대 = 90칸
# 인덱스 규칙: index = day * SLOT_COUNT + slot (요일 우선, 그 안에서 시간 순)

app = FastAPI(title="FreeTime Finder API")

# 개발 편의를 위해 전체 허용. 배포 시에는 프론트엔드 도메인으로 좁히는 것을 권장.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@contextmanager
def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def init_db():
    with get_db() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS rooms (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS submissions (
                id TEXT PRIMARY KEY,
                room_id TEXT NOT NULL,
                slots TEXT NOT NULL,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (room_id) REFERENCES rooms(id)
            )
            """
        )


init_db()


# ---------- Pydantic 모델 ----------

class CreateRoomRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=60)


class RoomResponse(BaseModel):
    room_id: str
    name: str


class SubmitSlotsRequest(BaseModel):
    slots: List[bool] = Field(..., min_length=TOTAL_CELLS, max_length=TOTAL_CELLS)
    submission_id: str | None = None  # 있으면 해당 제출을 덮어씀 (본인 시간표 수정용)


class SubmitSlotsResponse(BaseModel):
    submission_id: str


class OverlapResponse(BaseModel):
    room_name: str
    submission_count: int
    free_counts: List[int]        # 칸별로 "비어있는 사람 수" (index = day*SLOT_COUNT+slot)
    all_free: List[bool]          # 칸별로 "전원이 비어있는지"
    slot_labels: List[str]        # "09:00", "09:30", ...
    day_labels: List[str]         # "월", "화", ...


def slot_labels() -> List[str]:
    labels = []
    for i in range(SLOT_COUNT):
        total_min = 9 * 60 + i * 30
        h, m = divmod(total_min, 60)
        labels.append(f"{h:02d}:{m:02d}")
    return labels


# ---------- 라우트 ----------

@app.post("/api/rooms", response_model=RoomResponse)
def create_room(req: CreateRoomRequest):
    room_id = uuid.uuid4().hex[:8]
    with get_db() as conn:
        conn.execute(
            "INSERT INTO rooms (id, name) VALUES (?, ?)", (room_id, req.name)
        )
    return RoomResponse(room_id=room_id, name=req.name)


@app.get("/api/rooms/{room_id}", response_model=RoomResponse)
def get_room(room_id: str):
    with get_db() as conn:
        row = conn.execute(
            "SELECT id, name FROM rooms WHERE id = ?", (room_id,)
        ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="방을 찾을 수 없음")
    return RoomResponse(room_id=row["id"], name=row["name"])


@app.post("/api/rooms/{room_id}/submissions", response_model=SubmitSlotsResponse)
def submit_slots(room_id: str, req: SubmitSlotsRequest):
    with get_db() as conn:
        room = conn.execute(
            "SELECT id FROM rooms WHERE id = ?", (room_id,)
        ).fetchone()
        if not room:
            raise HTTPException(status_code=404, detail="방을 찾을 수 없음")

        slots_json = json.dumps(req.slots)

        if req.submission_id:
            existing = conn.execute(
                "SELECT id FROM submissions WHERE id = ? AND room_id = ?",
                (req.submission_id, room_id),
            ).fetchone()
            if existing:
                conn.execute(
                    "UPDATE submissions SET slots = ? WHERE id = ?",
                    (slots_json, req.submission_id),
                )
                return SubmitSlotsResponse(submission_id=req.submission_id)

        submission_id = uuid.uuid4().hex[:12]
        conn.execute(
            "INSERT INTO submissions (id, room_id, slots) VALUES (?, ?, ?)",
            (submission_id, room_id, slots_json),
        )
    return SubmitSlotsResponse(submission_id=submission_id)


@app.delete("/api/rooms/{room_id}/submissions/{submission_id}")
def delete_submission(room_id: str, submission_id: str):
    with get_db() as conn:
        conn.execute(
            "DELETE FROM submissions WHERE id = ? AND room_id = ?",
            (submission_id, room_id),
        )
    return {"ok": True}


@app.get("/api/rooms/{room_id}/overlap", response_model=OverlapResponse)
def get_overlap(room_id: str):
    with get_db() as conn:
        room = conn.execute(
            "SELECT name FROM rooms WHERE id = ?", (room_id,)
        ).fetchone()
        if not room:
            raise HTTPException(status_code=404, detail="방을 찾을 수 없음")

        rows = conn.execute(
            "SELECT slots FROM submissions WHERE room_id = ?", (room_id,)
        ).fetchall()

    free_counts = [0] * TOTAL_CELLS
    submission_count = len(rows)

    for row in rows:
        slots = json.loads(row["slots"])
        for i in range(TOTAL_CELLS):
            if i < len(slots) and not slots[i]:  # busy=False -> free
                free_counts[i] += 1

    all_free = [
        submission_count > 0 and free_counts[i] == submission_count
        for i in range(TOTAL_CELLS)
    ]

    return OverlapResponse(
        room_name=room["name"],
        submission_count=submission_count,
        free_counts=free_counts,
        all_free=all_free,
        slot_labels=slot_labels(),
        day_labels=DAY_LABELS,
    )


@app.get("/api/health")
def health():
    return {"status": "ok"}
