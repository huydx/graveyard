"""Generate flashcard + multiple-choice quiz items from a concept."""
import random
from dataclasses import dataclass
from typing import Optional

from backend_py.models import Concept


@dataclass
class QuizItemGen:
    type: str
    prompt: str
    answer: str
    options: Optional[list[str]] = None


def _first_phrase(s: str, max_len: int) -> str:
    s = s.strip()
    return s[:max_len] if len(s) > max_len else s


def _other_titles(exclude: str, concepts: list[Concept], count: int = 3) -> list[str]:
    candidates = [c.title for c in concepts if c.title != exclude and len(c.title) > 2]
    random.shuffle(candidates)
    return candidates[:count]


def generate_items(concept: Concept, all_concepts: list[Concept]) -> tuple[Optional[QuizItemGen], Optional[QuizItemGen]]:
    """Create one flashcard and one multiple-choice item for the concept."""
    answer = concept.detail or concept.summary or concept.title
    if concept.detail and len(answer) > 400:
        answer = answer[:397] + "..."
    flashcard = QuizItemGen(
        type="flashcard",
        prompt="What do you know about: " + concept.title + "?",
        answer=answer,
    )
    phrase = _first_phrase(concept.summary or concept.title, 80)
    mc_prompt = f'Which concept is described by: "{phrase}..."?'
    others = _other_titles(concept.title, all_concepts, 3)
    options = [concept.title] + [t for t in others if t != concept.title][:3]
    random.shuffle(options)
    mc = QuizItemGen(
        type="multiple_choice",
        prompt=mc_prompt,
        answer=concept.title,
        options=options,
    )
    return flashcard, mc
