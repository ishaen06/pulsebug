import json
from typing import List, Dict, Any
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

router = APIRouter(tags=["Real-Time WebSockets"])

class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: Dict[str, Any]):
        dead_connections = []
        for connection in self.active_connections:
            try:
                await connection.send_text(json.dumps(message))
            except Exception:
                dead_connections.append(connection)
                
        for dc in dead_connections:
            self.disconnect(dc)

ws_manager = ConnectionManager()

@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await ws_manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            try:
                msg_obj = json.loads(data)
                # Handle client ping or typing broadcast
                if msg_obj.get("type") == "PING":
                    await websocket.send_text(json.dumps({"type": "PONG"}))
                elif msg_obj.get("type") in ["TYPING", "VIEWING_BUG", "USER_ACTIVE"]:
                    await ws_manager.broadcast(msg_obj)
            except Exception:
                pass
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)
