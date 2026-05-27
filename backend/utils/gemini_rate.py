"""
Gemini API rate limit guard.
Free tier: 15 requests/minute. This stays safely under that.
"""
import time
from collections import deque
from threading import Lock

_call_times: deque = deque()
_lock = Lock()
RATE_LIMIT = 12  # leave buffer below 15/min free tier limit


def acquire() -> bool:
    """
    Returns True if a Gemini call is allowed right now.
    Returns False if we're approaching the rate limit.
    Thread-safe.
    """
    now = time.monotonic()
    with _lock:
        # Drop timestamps older than 60 seconds
        while _call_times and now - _call_times[0] > 60.0:
            _call_times.popleft()
        if len(_call_times) >= RATE_LIMIT:
            return False
        _call_times.append(now)
        return True


def calls_in_last_minute() -> int:
    now = time.monotonic()
    with _lock:
        return sum(1 for t in _call_times if now - t <= 60.0)
