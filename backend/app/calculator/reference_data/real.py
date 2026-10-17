from pathlib import Path

from .provider import ReferenceDataProvider


class RealReferenceData(ReferenceDataProvider):
    """실측·설계 데이터 (secrets/ 의존). 데이터 입수 전까지 생성 자체를 막는다 → API 501."""

    def __init__(self, secrets_dir: Path):
        raise NotImplementedError(
            f"실제 레퍼런스 데이터 미입수 ({secrets_dir}). DATA_SOURCE=mock 으로 실행하세요."
        )
