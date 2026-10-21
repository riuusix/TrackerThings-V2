"""Vercel Serverless entrypoint specifically for /api/python requests."""
import sys
from pathlib import Path

# Add api directory to sys.path
CURRENT_DIR = Path(__file__).resolve().parent
PARENT_DIR = CURRENT_DIR.parent
if str(PARENT_DIR) not in sys.path:
    sys.path.insert(0, str(PARENT_DIR))

from api.index import app

# Export ASGI app for @vercel/python
__all__ = ["app"]
