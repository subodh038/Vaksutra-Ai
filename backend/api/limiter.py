"""
api/limiter.py — Shared slowapi rate limiter instance.

Kept in a separate module to avoid a circular import between
main.py (which imports the router) and analysis.py (which needs the limiter).

Both main.py and analysis.py import from here.
"""
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
