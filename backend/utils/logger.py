import logging
import os
import sys

_LOG_LEVEL = logging.DEBUG if os.getenv("AEGIS_ENV", "demo") == "dev" else logging.INFO
_FORMAT = "[%(asctime)s] [%(levelname)s] [%(name)s] %(message)s"
_DATE_FORMAT = "%Y-%m-%dT%H:%M:%S"


def get_logger(name: str) -> logging.Logger:
    """Return a named logger configured for AEGIS standards."""
    logger = logging.getLogger(name)
    if logger.handlers:
        return logger  # already configured

    logger.setLevel(_LOG_LEVEL)
    handler = logging.StreamHandler(sys.stdout)
    handler.setLevel(_LOG_LEVEL)
    formatter = logging.Formatter(_FORMAT, datefmt=_DATE_FORMAT)
    handler.setFormatter(formatter)
    logger.addHandler(handler)
    logger.propagate = False
    return logger
