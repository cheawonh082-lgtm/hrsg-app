# 5단계. UI 디자인 개편 (체크리스트 상태 토글 포함)

## 목표(결과)
- 레퍼런스 대시보드 이미지와 같은 배치·스타일
  - PC: 왼쪽 고정 남색 사이드바(하위 메뉴 펼치기) + 상단 바 / 모바일: 상단 바 + 하단 탭바 + 전체 메뉴 드로어
  - 홈 화면(요약 KPI, 세정 공법별 비용 도넛 — 툴팁이 화면 밖으로 잘리지 않게 위치 조정)
  - 계산기 3개 탭: 운전 지표 → HRSG 도식(마우스를 올리면 위험 지표) → 세정 시 회수효과(열회수 효율 추이 그래프) / 손실 비교 / 핵심 성능 지표(KPI 카드)
  - 하위 메뉴·탭의 2-1·2-2·2-3 숫자 라벨 제거
- 체크리스트 상태 선택: 동그라미 체크가 '수령'(해제 = '대기')을 맡으므로 드롭다운을 없애고 **요청함 · 해당 없음** 체크 토글만 둔다.
  둘 중 하나만 켜지고, 켜진 토글을 다시 누르면 '대기'. 모바일에서는 토글이 한 줄을 차지해 가로 넘침 없음.

```
frontend\src\components\layout\ (AppShell, SidebarNav, navItems, TopNav, BottomTabBar)
frontend\src\pages\HomePage.tsx, components\home\, components\calculator\, src\index.css (색 토큰)
frontend\src\components\checklist\ChecklistItem.tsx
```

## 입력한 프롬프트

### 5-1. 레퍼런스 이미지로 개편 (이미지를 채팅에 첨부)
```
다음 UI 이미지의 레퍼런스를 참고해서 웹사이트의 디자인 및 배치구조를 수정해줘
```
```
운전 지표를 2-1에 배치해줘.
운전지표 바로 다음에 HRSG도식화 위 이미지 참고해서 추가해.
2-1에 세정 시 효과를 세정 시 회수효과로 이름변경하고 위 이미지 중 열회수 효율 추이 그래프 이미지로 시각화해서 추가해줘.
2-3에 예상 성능 지표는 위 이미지 중 핵심성능지표를 참고하여 kpi 시각화 추가해줘.
```
```
HRSG구조도 지워줘. HRSG도식에 마우스 가져다대면 위험지표 볼 수 있도록 수정해줘.
홈에 있는 세정 공법별 비용 비교에서 마우스 가져다대면 지표가 뜨는데 화면 떄문에 잘려서 안 보여. 잘리지 않는 위치로 조정되는 기능 추가.
2-3에 예상성능지표 이름을 핵심성능지표로 변경.
위 수정이 끝나고 계산기 소분류 항목에 2-1 2-2 2-3 숫자 라벨링 없애줘. 문자만 보이도록 수정.
```

### 5-2. 체크리스트 상태 토글
```
체크리스트에 대기,요청함, 수령 표시를 다른 버튼과 중복되지 않는 항목들만 체크표시로 고를 수 있도록 디자인 수정해줘.
```

## 사용한 md 파일 위치

| 파일 | 로컬 경로 | GitHub 주소 | 용도 |
|---|---|---|---|
| PRD.md §3.0, §3.4 | `C:\Users\chaewon\hrsg-reference-app\PRD.md` | https://github.com/cheawonh082-lgtm/hrsg-app/blob/main/PRD.md | 공통 레이아웃("레퍼런스 대시보드 배치"), 반응형 명세 |
| CHECKLIST.md (키트) | `C:\Users\chaewon\hrsg-reference-app\hrsg_calc_kit_team2\CHECKLIST.md` | https://github.com/cheawonh082-lgtm/hrsg-app/blob/main/hrsg_calc_kit_team2/CHECKLIST.md | 상태 키(대기·요청함·수령·해당 없음) — 화면 글자가 아니라 영문 키로 저장 |
| (레퍼런스 이미지) | 채팅에 첨부 | — | md 파일 대신 이미지를 입력으로 사용 |

**이 단계 가이드 파일:** `C:\Users\chaewon\hrsg-reference-app\docs\dev-guide\05-ui-design.md` · https://github.com/cheawonh082-lgtm/hrsg-app/blob/main/docs/dev-guide/05-ui-design.md
