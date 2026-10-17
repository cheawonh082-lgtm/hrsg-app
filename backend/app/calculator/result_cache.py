"""계산 결과 세션 캐시 (PRD §7.1 `GET /api/calc/results/{calcId}`).

챗 카드의 "계산기에서 열기"(A-09)가 같은 calcId로 결과를 복원할 때 사용한다.
프로세스 메모리에만 두며(단일 사용자 PoC), 오래된 항목부터 버린다.
"""

from collections import OrderedDict
from threading import Lock

from app.domain.models.calc import CalcResult


class CalcResultCache:
    def __init__(self, max_size: int = 256):
        self._max_size = max_size
        self._items: OrderedDict[str, CalcResult] = OrderedDict()
        self._lock = Lock()

    def put(self, result: CalcResult) -> None:
        with self._lock:
            self._items[result.meta.calc_id] = result
            self._items.move_to_end(result.meta.calc_id)
            while len(self._items) > self._max_size:
                self._items.popitem(last=False)

    def get(self, calc_id: str) -> CalcResult | None:
        with self._lock:
            result = self._items.get(calc_id)
            if result is not None:
                self._items.move_to_end(calc_id)
            return result
