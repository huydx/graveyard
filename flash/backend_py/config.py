"""Application settings from environment."""
import os
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class Settings:
    """Immutable config loaded from env."""

    data_dir: str
    openai_api_key: str
    openai_summarize_model: str

    @classmethod
    def from_env(cls) -> "Settings":
        return cls(
            data_dir=os.environ.get("FLASH_DATA_DIR", "./data"),
            openai_api_key=os.environ.get("OPENAI_API_KEY", ""),
            openai_summarize_model=os.environ.get("OPENAI_SUMMARIZE_MODEL", "gpt-4o-mini"),
        )


def get_settings() -> Settings:
    return Settings.from_env()
