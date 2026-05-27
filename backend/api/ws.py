"""WebSocket manager for real-time physician dashboard escalation alerts."""
import json
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

router = APIRouter()
_connected: set[WebSocket] = set()


@router.websocket("/ws/dashboard")
async def dashboard_ws(websocket: WebSocket):
    await websocket.accept()
    _connected.add(websocket)
    try:
        while True:
            await websocket.receive_text()  # keep-alive ping
    except WebSocketDisconnect:
        _connected.discard(websocket)


async def broadcast_escalation(patient_id: str, brief: dict):
    """Push escalation alert to all connected physician dashboards."""
    msg = json.dumps({"type": "escalation", "patient_id": patient_id, "brief": brief})
    dead: set[WebSocket] = set()
    for ws in _connected:
        try:
            await ws.send_text(msg)
        except Exception:
            dead.add(ws)
    _connected -= dead
