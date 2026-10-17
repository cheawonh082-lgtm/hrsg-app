"""검색기 인터페이스와 키워드 구현. 임베딩 검색은 Retriever를 구현해 chat/registry.py에 추가한다."""

import math
import re
from abc import ABC, abstractmethod
from collections import Counter
from dataclasses import dataclass

from app.rag.store import Chunk

_HANGUL_RUN = re.compile(r"[가-힣]+")
_LATIN_WORD = re.compile(r"[a-z][a-z0-9]+")
_STOPWORDS = {"the", "is", "are", "what", "how", "of", "in", "on", "to", "and", "or", "an", "for", "does", "do"}


@dataclass(frozen=True)
class SearchHit:
    chunk: Chunk
    score: float  # 0~1


class Retriever(ABC):
    is_mock: bool = False

    @abstractmethod
    def search(self, query: str, top_k: int = 3, lang: str | None = None) -> list[SearchHit]: ...


def tokenize(text: str) -> list[str]:
    """한글은 2글자 단위(조사가 붙어도 매칭되도록), 영문은 단어 단위."""
    text = text.lower()
    tokens = [w for w in _LATIN_WORD.findall(text) if w not in _STOPWORDS]
    for run in _HANGUL_RUN.findall(text):
        if len(run) == 1:
            tokens.append(run)
        else:
            tokens.extend(run[i : i + 2] for i in range(len(run) - 1))
    return tokens


class KeywordRetriever(Retriever):
    """TF-IDF 코사인 유사도. 외부 의존성 없이 결정적으로 동작한다."""

    def __init__(self, chunks: list[Chunk], is_mock: bool, min_score: float = 0.08):
        self.is_mock = is_mock
        self._chunks = chunks
        self._min_score = min_score
        docs = [Counter(tokenize(f"{c.title} {c.section_title or ''} {c.text}")) for c in chunks]
        df = Counter(t for d in docs for t in d)
        n = len(docs) or 1
        self._idf = {t: math.log((n + 1) / (f + 0.5)) for t, f in df.items()}
        self._vectors = [self._weigh(d) for d in docs]

    def search(self, query: str, top_k: int = 3, lang: str | None = None) -> list[SearchHit]:
        q = self._weigh(Counter(tokenize(query)))
        if not q:
            return []
        hits = []
        for chunk, vec in zip(self._chunks, self._vectors, strict=True):
            if lang and chunk.lang and chunk.lang != lang:
                continue
            score = sum(w * vec.get(t, 0.0) for t, w in q.items())
            if score >= self._min_score:
                hits.append(SearchHit(chunk, round(score, 3)))
        hits.sort(key=lambda h: h.score, reverse=True)
        return hits[:top_k]

    def _weigh(self, counts: Counter) -> dict[str, float]:
        vec = {t: (1 + math.log(c)) * self._idf.get(t, 0.0) for t, c in counts.items()}
        norm = math.sqrt(sum(v * v for v in vec.values()))
        return {t: v / norm for t, v in vec.items() if v} if norm else {}
