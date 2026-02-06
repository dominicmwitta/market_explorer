"""Logging configuration for DSE scraper."""

import logging
import os
from datetime import datetime

# Log directory
LOG_DIR = 'logs'

# Create logger
logger = logging.getLogger('dse_scraper')
logger.setLevel(logging.DEBUG)

# Prevent duplicate handlers
if not logger.handlers:
    # Create logs directory if it doesn't exist
    os.makedirs(LOG_DIR, exist_ok=True)

    # File handler - daily log file
    log_filename = os.path.join(LOG_DIR, f'dse_scraper_{datetime.now().strftime("%Y-%m-%d")}.log')
    file_handler = logging.FileHandler(log_filename, encoding='utf-8')
    file_handler.setLevel(logging.DEBUG)

    # Console handler
    console_handler = logging.StreamHandler()
    console_handler.setLevel(logging.INFO)

    # Formatter
    formatter = logging.Formatter(
        '%(asctime)s | %(levelname)-8s | %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    file_handler.setFormatter(formatter)
    console_handler.setFormatter(formatter)

    # Add handlers
    logger.addHandler(file_handler)
    logger.addHandler(console_handler)


def get_logger():
    """Get the DSE scraper logger."""
    return logger
