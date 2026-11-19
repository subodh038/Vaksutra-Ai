"""
api/routes/sessions.py — Session history routes.  [STUB — Phase 3]

Will expose:
  GET    /sessions          list all sessions for the current user
  GET    /sessions/{id}     full detail for one session
  DELETE /sessions/{id}     delete a session
"""

from fastapi import APIRouter

router = APIRouter(prefix="/sessions", tags=["sessions"])


@router.get("/", summary="List coaching sessions")
async def list_sessions() -> dict:
    # TODO Phase 3: query db/repositories/sessions.py
    return {"message": "Session history coming in Phase 3."}


@router.get("/{session_id}", summary="Get one session")
async def get_session(session_id: str) -> dict:
    # TODO Phase 3
    return {"message": f"Session {session_id} — coming in Phase 3."}
