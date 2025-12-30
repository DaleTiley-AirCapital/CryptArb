from fastapi import APIRouter
from app.arb.fast_loop import fast_arb_loop

router = APIRouter()

@router.get("/status")
async def get_status():
    status = fast_arb_loop.get_status()
    return {
        "status": "ok",
        "bot": status
    }

@router.post("/start")
async def start_bot():
    success = fast_arb_loop.start()
    return {"success": success, "message": "Bot started" if success else "Bot already running"}

@router.post("/stop")
async def stop_bot():
    success = fast_arb_loop.stop()
    return {"success": success, "message": "Bot stopped" if success else "Bot not running"}
