"""포화온도 근사 (공개 증기표 값 선형 보간). 핀치/어프로치 Mock 평가용.

정밀 계산이 필요해지면 IAPWS-IF97 라이브러리로 교체한다.
"""

from bisect import bisect_left

ATM_BAR = 1.01325

# (절대압 bar, 포화온도 ℃)
_SAT_TABLE: list[tuple[float, float]] = [
    (1, 99.6), (5, 151.8), (10, 179.9), (20, 212.4), (40, 250.4),
    (60, 275.6), (80, 295.0), (100, 311.0), (120, 324.7), (140, 336.7), (160, 347.4),
]


def saturation_temp_c(pressure_barg: float) -> float:
    p = pressure_barg + ATM_BAR
    pressures = [row[0] for row in _SAT_TABLE]
    if p <= pressures[0]:
        return _SAT_TABLE[0][1]
    if p >= pressures[-1]:
        return _SAT_TABLE[-1][1]
    i = bisect_left(pressures, p)
    (p0, t0), (p1, t1) = _SAT_TABLE[i - 1], _SAT_TABLE[i]
    return t0 + (t1 - t0) * (p - p0) / (p1 - p0)
