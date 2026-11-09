# 프롬프트 원문: 5단계 — 4주차 체크리스트·연동·반응형 검수

실제로 입력한 프롬프트 그대로다. 아래 줄부터 끝까지 복사해 Claude Code에 붙여 넣는다. 설명: [05-week4-checklist-integration.md](../05-week4-checklist-integration.md)

---

우리는 `PRD.md` 및 이전 주차(1~3주차) 구현 결과를 바탕으로 **4주차 목표인 플랜트 데이터 체크리스트, 화면 간 통합 연동, 반응형 교차 검수 및 최종 통합 테스트**를 진행합니다.

3주차 반영사항(FakeLLM 키워드 규칙, 서버 메모리 캐시 특성, SSE 생략 등)을 그대로 존중하며 작업을 수행해 주세요.

---

### 4주차 구현 요청 사항

#### 1. 플랜트 데이터 요청 체크리스트 화면 구현 (`src/pages/ChecklistPage.tsx`)
- `PRD.md §2.4, §3.3` 명세 반영
- **진행률 바 (`ProgressBar.tsx`)**:
  - 전체 진행률 및 필수(Required) 항목 진행률 분리 표시
  - 카테고리별(가스터빈, 배기가스, 급수/증기 등) 미니 진행률 바 제공
- **체크리스트 섹션 및 항목 (`ChecklistSection.tsx`, `ChecklistItem.tsx`)**:
  - 카테고리별 접기/펼치기
  - 항목별 체크박스, 구분(설계/운전/문서) 태그, 우선순위(필수/권장/선택) 배지, 상태 드롭다운(pending/requested/received/na), 메모 입력란
  - `linkedCalcField` 연동 항목은 "계산기 입력에 사용됨" 툴팁/안내 표시
  - 상태 변경 시 `PATCH /api/checklist/items/{id}` 호출 (낙관적 업데이트 및 localStorage 백업)
- **이메일 텍스트 내보내기 모달 (`EmailExportDialog.tsx`)**:
  - 범위(미완료/전체/필수), 언어(ko/en), 메모 포함 여부 선택
  - 미리보기 텍스트 제공 및 **클립보드 복사** (`navigator.clipboard.writeText`) + 토스트 알림
  - 수신자는 실명/고객사명 대신 별칭만 사용 (보안 정책 준수)
  - 모바일 환경에서는 하단 고정 FAB("이메일 복사") 버튼을 통해 전체 화면 모달 오픈

#### 2. 화면 간 컨텍스트 연동 (Integration)
- **계산기 ➔ 챗 연동**:
  - 계산기 화면 하단 "AI에게 질문하기" 클릭 시, 현재 `calcId`를 state/query param으로 지니고 `/chat`으로 이동
  - 챗 화면 진입 시 "이 계산 결과 해석해줘" 추천 질문 칩 자동 생성
- **챗 ➔ 계산기 연동**:
  - `CalcResultCard` 내 "계산기에서 열기" 버튼 클릭 시 `/calculator?calcId=xxx`로 이동하여 당시 입력값 복원
  - 서버 재시작으로 `calcId`가 캐시에 없을 경우, 기본값 세팅과 함께 안내 문구("이전 계산 정보를 찾을 수 없어 기본값으로 표시합니다") 노출
- **체크리스트 ➔ 계산기 연동**:
  - 핀치/어프로치 '데이터 필요' 링크 클릭 시 체크리스트의 해당 항목 섹션으로 이동 및 하이라이트

#### 3. 반응형 레이아웃 교차 검수 & 레이아웃 깨짐 방지 (`PRD.md §3.4`)
- **360px ~ 1920px 전 구간 가로 스크롤 발생 검수** (`document.documentElement.scrollWidth <= clientWidth`)
- **모바일 뷰포트 대응**:
  - 모바일 체크리스트 하단 sticky FAB 적용
  - 모바일 챗 입력 포커스 시 가상 키보드가 입력창을 가리지 않도록 `visualViewport` 보정 확인
- **다국어(ko/en) & 테마(라이트/다크) 교차 검증**:
  - 영문 가로 길이에 따른 버튼/KPI 넘침 방지
  - 상태 색상(정상/주의/위험) 및 CSS 토큰 일과성 검증

#### 4. 테스트 및 검수
- **백엔드 테스트**:
  - `tests/backend/test_checklist.py`: 체크리스트 API (GET, PATCH, export-email) 단위 테스트
- **프론트엔드 테스트**:
  - Vitest: 체크리스트 진행률 계산 logic 및 이메일 포맷터 테스트
- **Playwright E2E (`frontend/e2e/`)**:
  - `checklist.spec.ts`: 체크리스트 항목 변경, 진행률 업데이트, 이메일 복사 동작 검증
  - `responsive.spec.ts`: 360px, 390px, 768px, 1280px 뷰포트별 가로 스크롤(`scrollWidth`) 검사 및 주요 화면 스크린샷 검증

위 내용들을 구현하고 `npm run dev` 및 전체 테스트(`pytest`, `npm test`, Playwright) 실행 결과를 정리해 주세요.
