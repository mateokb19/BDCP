"""Central timezone utilities — always Colombia (America/Bogota, UTC-5)."""
from datetime import datetime
from zoneinfo import ZoneInfo

BOGOTA = ZoneInfo("America/Bogota")


def now_bogota() -> datetime:
    """Current naive datetime in Bogota local time (for DB storage)."""
    return datetime.now(BOGOTA).replace(tzinfo=None)


def today_bogota():
    """Current date in Bogota local time."""
    return datetime.now(BOGOTA).date()
