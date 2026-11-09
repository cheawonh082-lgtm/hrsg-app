# 11. 계산기·체크리스트를 팀 공통 키트로 교체

**목표:** 직접 만든 Mock 계산 로직을 버리고, 팀이 함께 쓰는 키트(`hrsg_calc_kit_team2`)의 계산·체크리스트 함수를 그대로 쓴다.

## 준비물과 위치
```
hrsg-reference-app\
└─ hrsg_calc_kit_team2\      팀에서 받은 키트 폴더를 저장소 루트에 그대로 복사 (내용은 고치지 않는다)
   ├─ README.md, CLAUDE.md   연결표와 작업 규칙 — Claude가 읽고 따른다
   ├─ calc.py, checklist.py  (JS 판 calc.js, checklist.js도 있음)
   ├─ data\calculator.json, data\checklist.json
   └─ test_calc.py, test_checklist.py
```

## 내가 입력한 프롬프트
```
C:\Users\chaewon\hrsg-reference-app\hrsg_calc_kit 폴더 안에 있는 md파일 읽어줘
```
```
C:\Users\chaewon\hrsg-reference-app\hrsg_calc_kit_team2 폴더 제목만 변경했어 안에 내용은 똑같아.
기존 계산기를 대체하는 방향으로 바꿔줘. 키트의 지시대로 모두 수행한 뒤 수정 제안 사항을 알려줘.
```
제안을 보고 결정:
```
연간 운전시간으로 바꿔서 월간 가동시간 입력란을 둬. 키트에 한국어 뿐이라면 영어로 번역은 없애.
키트 md파일 규칙에 따라 공개 여부 결정해. 수정 후 커밋하고 푸시해줘.
```

## 결과 요약
- 백엔드가 키트 `calc.py`·`checklist.py`를 파일 경로로 불러 쓴다(`CALC_KIT_DIR`). 키트 파일은 수정하지 않는다
- 화면 입력 ↔ 키트 입력 변환은 어댑터 하나(`kit_adapter.py`)에서만
- 계산기: 처음 화면 = 키트 예시 운전 상태, 「초기화」 = 설계 상태, 공법은 「순편익 최대」로 표시("추천"이라 쓰지 않음)
- 체크리스트: 키트 49개 항목(필수 16), 진행률·필터·요청 메일 문구도 키트 함수
- 키트 규칙에 따라 계산식은 화면·챗에 공개하지 않고, **DEMO 값 표시(MOCK DATA 배너)는 유지**
- 키트 README의 기대값을 화면에서 확인하는 E2E(`kit-expected.spec.ts`)

## 생성·수정 파일
```
backend\app\kit.py                       키트 모듈 로드
backend\app\calculator\kit_adapter.py    화면 입력 → 키트 입력
backend\app\calculator\kit_calculator.py CalculatorService 구현 (CALC_ENGINE=mock일 때 사용)
backend\app\checklist\service.py         키트 체크리스트 함수 사용
frontend\e2e\kit-expected.spec.ts
```
삭제: 기존 `calculator/mock.py`, `mock_gt_models.json`, 체크리스트 템플릿 yaml 등

## 확인할 것
- 키트 자체 테스트: `python -m unittest discover -s hrsg_calc_kit_team2 -p "test_*.py"` (16개)
- `kit-expected.spec.ts`가 키트 README 기대값과 같은 숫자를 화면에서 확인하는가?
- `CALC_ENGINE=mock`은 이제 "키트 계산기 사용"이라는 뜻이다. `real`은 실제 공식 자리(미구현, 501)
