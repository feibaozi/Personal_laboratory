import logging
from pathlib import Path

import yaml

from sqlalchemy.orm import Session

from app.models.persona import PersonaBinding

logger = logging.getLogger(__name__)

PERSONAS_PATH = Path(__file__).resolve().parent.parent.parent / "config" / "personas.yaml"


class PersonaManager:
    def __init__(self):
        self.profiles: dict = {}
        self.default_profile: str = "programmer"
        self._load()

    def _load(self):
        if not PERSONAS_PATH.exists():
            logger.warning("personas.yaml not found at %s, using defaults", PERSONAS_PATH)
            self.profiles = {}
            return
        with open(PERSONAS_PATH, "r", encoding="utf-8") as f:
            data = yaml.safe_load(f)
        self.profiles = data.get("profiles", {})
        self.default_profile = data.get("default_profile", "programmer")
        logger.info("Loaded %d persona profiles", len(self.profiles))

    def get_prompt(self, profile_name: str | None = None,
                   summary: str = "", history_text: str = "") -> str:
        name = profile_name or self.default_profile
        profile = self.profiles.get(name, self.profiles.get(self.default_profile, {}))
        prompt = profile.get("system_prompt", "")
        return prompt.format(
            conversation_summary=summary or "（无）",
            recent_messages=history_text or "（无）",
        )

    def get_temperature(self, profile_name: str | None = None) -> float:
        name = profile_name or self.default_profile
        return self.profiles.get(name, {}).get("temperature", 0.8)

    def get_max_tokens(self, profile_name: str | None = None) -> int:
        name = profile_name or self.default_profile
        return self.profiles.get(name, {}).get("max_tokens", 300)

    def get_profile_for_contact(self, contact_name: str,
                                db_session: Session) -> str | None:
        binding = db_session.query(PersonaBinding).filter_by(
            contact_name=contact_name).first()
        return binding.profile_name if binding else None

    def bind_profile(self, contact_name: str, profile_name: str,
                     db_session: Session):
        binding = db_session.query(PersonaBinding).filter_by(
            contact_name=contact_name).first()
        if binding:
            binding.profile_name = profile_name
        else:
            binding = PersonaBinding(contact_name=contact_name,
                                     profile_name=profile_name)
            db_session.add(binding)
        db_session.commit()

    def unbind_profile(self, contact_name: str, db_session: Session):
        db_session.query(PersonaBinding).filter_by(
            contact_name=contact_name).delete()
        db_session.commit()

    def list_profiles(self) -> list[dict]:
        return [
            {"name": k, "display_name": v.get("display_name", k)}
            for k, v in self.profiles.items()
        ]
