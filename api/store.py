"""JSON file storage for the demo. Paths resolve from this file so the app runs from any cwd."""
from __future__ import annotations

import copy
import json
import logging
import os
import tempfile
import threading
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = REPO_ROOT / "data"

log = logging.getLogger("fola.store")
LOCK = threading.RLock()

DEFAULTS: dict[str, Any] = {
    "profile": {},
    "transactions": [],
    "rules": [],
    "actions": [],
    "reports": [],
}

# In-memory fallback so the app keeps working if the filesystem is read-only.
_memory: dict[str, Any] = {}


def _path(name: str) -> Path:
    return DATA_DIR / f"{name}.json"


def load(name: str) -> Any:
    with LOCK:
        if name in _memory:
            return copy.deepcopy(_memory[name])
        p = _path(name)
        try:
            with p.open("r", encoding="utf-8") as f:
                return json.load(f)
        except FileNotFoundError:
            return copy.deepcopy(DEFAULTS.get(name))
        except (OSError, json.JSONDecodeError) as e:
            log.warning("could not read %s: %s", p, e)
            return copy.deepcopy(DEFAULTS.get(name))


def save(name: str, value: Any) -> None:
    with LOCK:
        p = _path(name)
        try:
            p.parent.mkdir(parents=True, exist_ok=True)
            fd, tmp = tempfile.mkstemp(dir=str(p.parent), prefix=f".{name}.", suffix=".tmp")
            with os.fdopen(fd, "w", encoding="utf-8") as f:
                json.dump(value, f, indent=2, ensure_ascii=False)
                f.write("\n")
            os.replace(tmp, p)
            _memory.pop(name, None)
        except OSError as e:
            log.warning("could not write %s (%s); keeping it in memory", p, e)
            _memory[name] = copy.deepcopy(value)
