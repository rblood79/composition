# ADR-010: Events Panel Smart Recommendations

## Status

Deprecated — 2026-05-13 (Replaced by [ADR-133](133-events-panel-simplification.md))

### land 영역 (ADR-133 흡수)

- **P0 추천 chips + 빈 상태 가이드** (2026-02-10 land) — `RecommendedEventsSection` / `TemplateSuggestionSection` / 추천 chip 클릭 핸들러 생성. ADR-133 D5 UI 표면 보존
- **P1 추천 액션 chips + 누락 경고 + ActionPicker 추천 배지** (2026-02-10 land) — `RecommendedActionsChips` / `ActionBlock.getMissingRequiredFields` / `action-recommended-badge`. ADR-133 D5 UI 표면 보존

### 미land 영역 (ADR-134 응용 이관)

- **P1.5 UX 폴리싱** — 인라인 액션 추가행 / 경고 즉시 수정 / 최근 사용 액션 / 디테일 미니 추천 바 / 템플릿 후속 추천 / 경량 키보드 단축 / aria-live 접근성
- **P2 AI 생성 + 고급 기능** — 의도 기반 자연어 생성 / 키보드 커맨드 팔레트 / 경량 시뮬레이션 / 개인화 추천 / 미리보기 힌트

## 배경

현재 Events Panel은 헤더의 + 버튼만 제공한다. 사용자들은 기본 이벤트를 보기 위해 팝오버를 열어야 하며, 이는 접근성과 발견성을 낮춘다.

## 목표

- 선택 즉시 해당 컴포넌트의 기본/추천 이벤트를 panel-contents에 노출한다.
- 이벤트 추가 동작은 기존과 동일하게 유지한다(핸들러 생성 + 선택).
- 이벤트 레지스트리/지원 이벤트 정의는 변경하지 않는다.

## 비목표

- 신규 이벤트/액션 타입 추가.
- EventTypePicker 팝오버 UI 전면 재설계.
- 핸들러 디테일 편집 플로우 변경.

## 현재 이벤트 등록/수정 플로우 (as-is)

- 요소 선택 -> 헤더에 + 표시(지원 이벤트 1개면 단일 버튼).
- - 클릭 -> EventTypePicker 팝오버(검색/카테고리/추천).
- 이벤트 선택 -> 핸들러 생성 + 자동 선택.
- 블록 편집(When -> If -> Then/Else)로 수정.
- 액션 추가는 ActionPicker 오버레이에서 선택 후 편집.

## 단점

- 발견성 낮음: 기본 이벤트가 + 뒤에 숨겨짐.
- 단계가 많음: 팝오버를 열어야 시작 가능.
- 컨텍스트 전환: 팝오버/오버레이로 리스트 흐름이 끊김.
- 가이드 부족: 각 이벤트의 일반 사용 시나리오가 즉시 보이지 않음.
- 접근성 저하: 키보드 탐색 시작점이 헤더에 집중됨.
- 개인화 부재: 추천이 프로젝트/사용 패턴을 반영하지 못함.

## 업계 트렌드 리서치 (Webflow / Framer)

### Framer

- AI 생성: 텍스트 기반으로 레이아웃/컴포넌트/번역을 생성하는 AI 플로우 제공. [1]
- CMS 강화: 인라인 편집, SEO, 협업을 강조한 디자인 중심 CMS. [2]
- 폼/데이터 수집: 코드 없이 폼을 생성하고 데이터를 수집. [3]
- 내장 분석: 개인정보 친화적(쿠키 없는) 기본 분석 제공. [4]
- 로컬라이제이션: 언어/지역별 커스터마이징 지원. [5]

### Webflow

- AI 제공: Webflow AI 제품 페이지 운영. [6]
- CMS 중심 확장: 시각적 CMS 구축을 강조. [7]
- 로컬라이제이션: 번역/현지화 도구 페이지 제공. [8]
- 인터랙션/애니메이션: 시각적 애니메이션 제작을 강조. [9]

### 트렌드 요약 (2025)

- AI 기반 생성/보조: 빠른 초기 구성과 의도 기반 생성이 기본값.
- 템플릿/레시피화: “이벤트 + 액션”의 재사용 가능한 패턴 제공.
- 내장 분석/프라이버시: 간단한 인사이트 제공과 개인정보 친화 흐름.
- 다국어/로컬라이제이션: 글로벌 배포를 위한 기본 기능화.
- 인터랙션 중심 UI: 이벤트/상태 변화의 시각적 구성 강화.

## 단계별 개선안

### P0: 추천 이벤트 노출 + 빈 상태 개선 ✅ 구현 완료

핵심 목표: 사용자가 + 버튼 없이도 추천 이벤트를 발견하고 추가할 수 있게 한다.

| #   | 항목                 | 설명                                                                  | 상태 |
| --- | -------------------- | --------------------------------------------------------------------- | ---- |
| 1   | 추천 이벤트 chips    | panel-contents 상단에 컴포넌트별 추천 이벤트를 quick add chips로 노출 | ✅   |
| 2   | 빈 상태 가이드 개선  | "이벤트 핸들러가 없습니다" 메시지에 추천 이벤트 버튼 포함             | ✅   |
| 3   | 인라인 설명          | 각 추천 chip에 툴팁으로 이벤트 설명/사용 예시 제공                    | ✅   |
| 4   | 등록된 이벤트 필터링 | 이미 등록된 이벤트는 추천 목록에서 제외                               | ✅   |
| 5   | 레시피 템플릿 노출   | 빈 상태에서 컴포넌트별 레시피 템플릿 카드 표시 (P1에서 이동)          | ✅   |

### P1: 추천 액션 + 호환성 배지 + 누락 경고 ✅ 구현 완료

핵심 목표: 이벤트 추가 후 액션 설정까지의 흐름을 단축한다.

| #   | 항목             | 설명                                                                      | 상태 |
| --- | ---------------- | ------------------------------------------------------------------------- | ---- |
| 1   | 추천 액션 노출   | THEN/ELSE 블록에 추천 액션 최대 3개를 chips로 표시 (컨텍스트+체이닝 추천) | ✅   |
| 2   | 레시피 템플릿    | 자주 사용되는 이벤트+액션 조합 제공 (P0에서 구현 완료)                    | ✅   |
| 3   | 액션 호환성 배지 | ActionPickerOverlay에서 추천 액션에 "추천" 배지 표시                      | ✅   |
| 4   | 누락 설정 경고   | 필수 config가 없는 액션에 AlertTriangle 경고 아이콘 + 툴팁 표시           | ✅   |

### P1.5: UX 폴리싱 + 편의성 개선 (제안)

핵심 목표: 현재 P1 흐름을 유지하면서 클릭 수/맥락 전환/설정 누락 복구 시간을 줄인다.

| #   | 항목                 | 설명                                                                             | 효과 | 난이도  | 상태 |
| --- | -------------------- | -------------------------------------------------------------------------------- | ---- | ------- | ---- |
| 1   | 인라인 액션 추가행   | THEN/ELSE 블록 내부에 추천+검색 가능한 quick add row 제공 (오버레이 전환 최소화) | 높음 | 중      | 제안 |
| 2   | 경고 즉시 수정       | ⚠️ 클릭 시 누락 필드로 포커스 이동 + 자동 스크롤 + 기본값 제안                   | 높음 | 낮음    | 제안 |
| 3   | 최근 사용 액션       | 요소/프로젝트 최근 액션 3~5개를 quick chips로 노출                               | 높음 | 낮음~중 | 제안 |
| 4   | 디테일 미니 추천 바  | 핸들러 디테일 화면 상단에 접힘 기본의 compact 추천 바 제공                       | 중간 | 낮음    | 제안 |
| 5   | 템플릿 후속 추천     | 템플릿 적용 직후 다음 액션(예: apiCall -> showToast) 제안                        | 중간 | 중      | 제안 |
| 6   | 경량 키보드 단축     | `A`(액션 추가), `/`(검색), `Cmd/Ctrl+Enter`(적용) 단축 흐름 제공                 | 중간 | 낮음    | 제안 |
| 7   | 접근성 실시간 피드백 | 핸들러/액션 추가 결과를 `aria-live`로 즉시 안내                                  | 중간 | 낮음    | 제안 |

### P2: AI 생성 + 고급 기능

핵심 목표: 고급 사용자를 위한 생산성 도구를 제공한다.

| #   | 항목                 | 설명                                                                    |
| --- | -------------------- | ----------------------------------------------------------------------- |
| 1   | 의도 기반 생성       | 자연어 입력 → 이벤트+액션 초안 자동 생성 (예: "버튼 클릭 시 모달 열기") |
| 2   | 키보드 커맨드 팔레트 | Ctrl/Cmd+K로 이벤트/액션 빠른 탐색                                      |
| 3   | 경량 시뮬레이션      | mock payload로 액션 실행 테스트                                         |
| 4   | 개인화 추천          | 프로젝트 내 사용 빈도 기반 추천 순서 재정렬                             |
| 5   | 미리보기 힌트        | 액션 결과를 캔버스에서 미리보기                                         |

## UX 상태별 화면 구성

### 1. 요소 미선택

```
┌─────────────────────────────────┐
│ ⬜ Events                       │
├─────────────────────────────────┤
│                                 │
│     요소를 선택하세요             │
│                                 │
└─────────────────────────────────┘
```

- 기존 EmptyState 유지
- 추천 이벤트 없음

### 2. 요소 선택 + 핸들러 없음 (P0 핵심)

```
┌─────────────────────────────────┐
│ ⬜ Events                    [+]│
├─────────────────────────────────┤
│ 추천: [onClick] [onPress]       │  ← 추천 chips
├─────────────────────────────────┤
│                                 │
│  ⚡ 이벤트 핸들러가 없습니다      │
│  위의 추천 이벤트를 클릭하거나    │
│  + 버튼으로 추가하세요           │
│                                 │
└─────────────────────────────────┘
```

- 추천 이벤트 chips 상단 노출
- EmptyState에 가이드 메시지 추가

### 3. 요소 선택 + 핸들러 있음 (리스트)

```
┌─────────────────────────────────┐
│ ⬜ Events                    [+]│
├─────────────────────────────────┤
│ 추천: [onPress]                 │  ← 미등록 이벤트만
├─────────────────────────────────┤
│ ▸ onClick           2 actions  │
│ ▸ onMouseEnter      1 action   │
└─────────────────────────────────┘
```

- 이미 등록된 이벤트는 추천에서 제외
- 모든 추천 이벤트 등록 시 섹션 숨김

### 4. 핸들러 디테일 화면 (P1 반영)

```
┌─────────────────────────────────┐
│ ← onClick                   [🗑]│
├─────────────────────────────────┤
│ ┌─ WHEN ──────────────────────┐ │
│ │ onClick                     │ │
│ └─────────────────────────────┘ │
│         │                       │
│ ┌─ THEN ────────── 2 actions ┐ │
│ │ 1. 🔗 navigate → /home     │ │
│ │ 2. 💬 showToast → "완료" ⚠️ │ │  ← ⚠️ 누락 경고
│ │ 추천: [setState] [showModal]│ │  ← 추천 액션 chips
│ └─────────────────────────────┘ │
│                                 │
│ ┌─ ActionPicker ──────────────┐ │
│ │ 페이지 이동 (navigate) 추천  │ │  ← "추천" 배지
│ │ 상태 설정 (setState)  추천   │ │
│ │ API 호출 (apiCall)          │ │
│ └─────────────────────────────┘ │
└─────────────────────────────────┘
```

- 추천 이벤트 섹션 숨김 (집중 편집)
- THEN/ELSE 블록에 추천 액션 chips 표시 (이미 추가된 액션 제외, 최대 3개)
- 빈 블록: 추천 chips + "More actions" 버튼
- 액션 있는 블록: 액션 리스트 아래에 추천 chips
- ActionPickerOverlay에서 추천 액션에 "추천" 배지 표시
- 필수 config 누락 액션에 ⚠️ 경고 아이콘 + 툴팁

## 인터랙션 명세

### 추천 이벤트 chip

| 동작        | 결과                                                 |
| ----------- | ---------------------------------------------------- |
| 클릭        | 핸들러 생성 + 자동 선택 (기존 `handleAddEvent` 경로) |
| 호버        | 툴팁 표시 (이벤트 설명 + 사용 예시)                  |
| Tab         | 다음 chip으로 포커스 이동                            |
| Enter/Space | 핸들러 생성                                          |

### 섹션 표시 조건

| 조건                           | 표시 여부            |
| ------------------------------ | -------------------- |
| 추천 이벤트 0개                | 섹션 숨김            |
| 추천 이벤트 > 0개, 모두 등록됨 | 섹션 숨김            |
| 추천 이벤트 > 0개, 일부 미등록 | 미등록 이벤트만 표시 |
| 핸들러 디테일 화면             | 섹션 숨김            |

### P1.5 추가 인터랙션 제안

| 패턴                | 기본 동작                                                      |
| ------------------- | -------------------------------------------------------------- |
| 인라인 액션 추가행  | 추천 액션 chip 클릭 시 즉시 추가, `/` 입력 시 액션 검색 시작   |
| 경고 즉시 수정      | ⚠️ 클릭 시 해당 액션 에디터 열기 + 누락된 첫 필드 포커스       |
| 최근 사용 액션      | 선택 요소와 무관하게 공통 상단에 노출, 현재 핸들러에 즉시 추가 |
| 디테일 미니 추천 바 | 기본 접힘 상태, 펼치면 최대 3개 추천 액션 노출                 |

## 접근성

- 추천 버튼: `aria-label="Add {eventType} event handler"`
- 키보드 탐색: Tab으로 chip 순회, Enter/Space로 활성화
- 포커스 표시: 기존 버튼 포커스 링 스타일 적용
- 스크린 리더: 이벤트 설명을 `aria-describedby`로 연결
- 실시간 안내: 핸들러/액션 추가 및 경고 해소 시 `aria-live="polite"`로 상태 변경 안내

## 구현 상세

### 파일 구조

```
src/builder/panels/events/
├── EventsPanel.tsx                        # 메인 패널 (P0+P1: 추천/템플릿/ActionPicker 배지)
├── EventsPanel.css                        # 스타일 (P0+P1: 추천 chips, 경고, 배지)
├── index.ts                               # 패널 barrel export
├── components/
│   ├── index.ts                           # barrel exports
│   ├── RecommendedEventsSection.tsx       # [P0] 추천 이벤트 chips 컴포넌트
│   ├── TemplateSuggestionSection.tsx      # [P0] 레시피 템플릿 카드 컴포넌트
│   ├── RecommendedActionsChips.tsx        # [P1] THEN/ELSE 블록 내 추천 액션 chips
│   ├── ConditionEditor.tsx                # 조건 편집기
│   ├── DebounceThrottleEditor.tsx         # 디바운스/쓰로틀 설정 편집기
│   ├── ActionDelayEditor.tsx              # 액션 지연 설정 편집기
│   ├── ComponentSelector.tsx              # 컴포넌트 선택기
│   └── ExecutionDebugger.tsx              # 실행 디버거
├── blocks/
│   ├── index.ts
│   ├── WhenBlock.tsx                      # WHEN 이벤트 트리거 블록
│   ├── IfBlock.tsx                        # IF 조건 블록
│   ├── ThenElseBlock.tsx                  # [P1 수정] 추천 액션 chips 통합
│   ├── ActionBlock.tsx                    # [P1 수정] 누락 설정 경고 아이콘 추가
│   ├── ActionList.tsx                     # 액션 목록
│   └── BlockConnector.tsx                 # 블록 간 연결선
├── hooks/
│   ├── index.ts
│   ├── useRecommendedEvents.ts            # [기존] 컴포넌트별 추천 이벤트 훅
│   ├── useApplyTemplate.ts               # [기존] 템플릿 적용 훅 + generateEventHandlerIds
│   ├── useEventSearch.ts                  # 이벤트 검색 훅
│   ├── useBlockKeyboard.ts                # 블록 키보드 단축키 훅
│   ├── useCopyPasteActions.ts             # 액션 복사/붙여넣기 훅
│   └── useVariableSchema.ts               # 변수 스키마 훅
├── state/
│   ├── index.ts
│   ├── useEventHandlers.ts                # 이벤트 핸들러 상태 관리
│   ├── useActions.ts                      # 액션 상태 관리
│   └── useEventSelection.ts               # 이벤트 선택 상태
├── data/
│   ├── index.ts
│   ├── eventCategories.ts                 # [기존] COMPONENT_RECOMMENDED_EVENTS, EVENT_METADATA
│   ├── actionMetadata.ts                  # [기존] ACTION_METADATA, getRecommendedActions()
│   └── eventTemplates.ts                  # [기존] 18개 레시피 템플릿 데이터 (FORM: 4, NAVIGATION: 4, UI: 5, DATA: 5)
├── types/
│   ├── index.ts
│   ├── eventTypes.ts                      # EventType, ActionType, EventHandler 등 타입 정의
│   ├── eventBlockTypes.ts                 # 블록 UI 전용 타입 (BlockEventAction, ConditionGroup 등)
│   └── templateTypes.ts                   # 템플릿 관련 타입
├── editors/
│   ├── index.ts
│   ├── BlockActionEditor.tsx              # 액션 편집기 (블록 기반)
│   ├── ConditionRow.tsx                   # 조건 행 편집기
│   ├── VariableBindingEditor.tsx          # 변수 바인딩 편집기
│   ├── OperatorToggle.tsx                 # 연산자 토글
│   ├── OperatorPicker.tsx                 # 연산자 선택기
│   └── ElementPicker.tsx                  # 요소 선택기
├── actions/
│   ├── index.ts
│   ├── ActionEditor.tsx                   # 액션 에디터 래퍼
│   ├── NavigateActionEditor.tsx           # navigate 액션 에디터
│   ├── SetStateActionEditor.tsx           # setState 액션 에디터
│   ├── APICallActionEditor.tsx            # apiCall 액션 에디터
│   ├── ShowModalActionEditor.tsx          # showModal 액션 에디터
│   ├── HideModalActionEditor.tsx          # hideModal 액션 에디터
│   ├── ShowToastActionEditor.tsx          # showToast 액션 에디터
│   ├── ValidateFormActionEditor.tsx       # validateForm 액션 에디터
│   ├── ResetFormActionEditor.tsx          # resetForm 액션 에디터
│   ├── SubmitFormActionEditor.tsx         # submitForm 액션 에디터
│   ├── ScrollToActionEditor.tsx           # scrollTo 액션 에디터
│   ├── CopyToClipboardActionEditor.tsx    # copyToClipboard 액션 에디터
│   ├── CustomFunctionActionEditor.tsx     # customFunction 액션 에디터
│   ├── SetComponentStateActionEditor.tsx  # setComponentState 액션 에디터
│   ├── TriggerComponentActionEditor.tsx   # triggerComponentAction 액션 에디터
│   ├── UpdateFormFieldActionEditor.tsx    # updateFormField 액션 에디터
│   ├── FilterCollectionActionEditor.tsx   # filterCollection 액션 에디터
│   ├── SelectItemActionEditor.tsx         # selectItem 액션 에디터
│   ├── ClearSelectionActionEditor.tsx     # clearSelection 액션 에디터
│   ├── ToggleVisibilityActionEditor.tsx   # toggleVisibility 액션 에디터
│   ├── LoadDataTableActionEditor.tsx      # loadDataTable 액션 에디터
│   ├── SyncComponentActionEditor.tsx      # syncComponent 액션 에디터
│   ├── SaveToDataTableActionEditor.tsx    # saveToDataTable 액션 에디터
│   └── UpdateStateActionEditor.tsx        # updateState 액션 에디터
├── execution/
│   ├── index.ts
│   ├── conditionEvaluator.ts              # 조건 평가기
│   ├── eventExecutor.ts                   # 이벤트 실행기
│   └── executionLogger.ts                 # 실행 로거
├── utils/
│   ├── index.ts
│   ├── normalizeEventTypes.ts             # 이벤트 타입 정규화 (snake_case → camelCase)
│   ├── actionHelpers.ts                   # 액션 헬퍼 함수
│   ├── variableParser.ts                  # 변수 파서
│   └── bindingValidator.ts               # 바인딩 유효성 검사
├── preview/
│   ├── index.ts
│   ├── EventMinimap.tsx                   # 이벤트 미니맵
│   ├── EventDebugger.tsx                  # 이벤트 디버거
│   └── CodePreviewPanel.tsx               # 코드 미리보기 패널
└── pickers/
    ├── index.ts
    ├── EventTypePicker.tsx                # [기존] 이벤트 선택 팝오버
    └── ActionTypePicker.tsx               # 액션 타입 선택기
```

### 데이터 소스 활용

| 데이터                               | 위치                               | 용도                                   | 사용 단계 |
| ------------------------------------ | ---------------------------------- | -------------------------------------- | --------- |
| `COMPONENT_RECOMMENDED_EVENTS`       | `data/eventCategories.ts:264`      | 컴포넌트별 추천 이벤트 목록            | P0        |
| `EVENT_METADATA`                     | `data/eventCategories.ts:65`       | 이벤트 라벨, 설명, 사용률              | P0        |
| `getRecommendedEvents()`             | `data/eventCategories.ts:320`      | 추천 이벤트 조회 함수                  | P0        |
| `useRecommendedEvents()`             | `hooks/useRecommendedEvents.ts:38` | 추천 이벤트 훅 (메타데이터 포함)       | P0        |
| `isImplementedEventType()`           | `@/types/events/events.types`      | 구현된 이벤트 필터링                   | P0        |
| `getRecommendedTemplates()`          | `data/eventTemplates.ts:571`       | 컴포넌트별 추천 템플릿 조회 (상위 5개) | P0        |
| `generateEventHandlerIds()`          | `hooks/useApplyTemplate.ts:74`     | 템플릿 이벤트 ID 생성                  | P0        |
| `getRecommendedActions()`            | `data/actionMetadata.ts:674`       | 컨텍스트 기반 추천 액션 조회           | P1        |
| `ACTION_METADATA[type].configFields` | `data/actionMetadata.ts:33`        | 액션별 필수/선택 config 필드           | P1        |
| `ACTION_TYPE_LABELS`                 | `types/eventTypes.ts:491`          | 한국어 액션 라벨 (Partial Record)      | P1        |

### 컴포넌트 명세

#### RecommendedEventsSection (P0)

```tsx
interface RecommendedEventsSectionProps {
  componentType: string; // 선택된 컴포넌트 타입
  registeredEvents: EventType[]; // 이미 등록된 이벤트 (필터링용, RegistryEventType으로 처리)
  onAddEvent: (type: EventType) => void;
}
```

- **배치**: `panel-contents` 상단 (핸들러 없음 + 리스트 뷰)
- **숨김**: 핸들러 상세 뷰
- **최대 표시**: 4개 (overflow 시 "+N more", 상수 `MAX_VISIBLE_CHIPS = 4`)
- **스타일**: `.recommended-events-section`, `.recommended-event-chip`
- **구현 위치**: `components/RecommendedEventsSection.tsx` — `useRecommendedEvents()` 훅 사용, 사용률 기준 정렬

#### TemplateSuggestionSection (P0)

```tsx
interface TemplateSuggestionSectionProps {
  componentType: string;
  currentHandlers: EventHandler[];
  onApplyTemplate: (template: EventTemplate) => void;
  maxVisible?: number; // 기본값 3
}
```

- **배치**: 핸들러 없음 상태에서 추천 이벤트 아래
- **동작**: 클릭 시 이벤트+액션 일괄 생성, 기존 핸들러와 이벤트 겹치면 "merge" 배지
- **스타일**: `.template-suggestion-card`, `.template-merge-badge`
- **구현 위치**: `components/TemplateSuggestionSection.tsx` — "Show all (N)" 펼침/접힘 지원
- **템플릿 추천 범위**: `getRecommendedTemplates()` → 컴포넌트 타입 일치 + 사용률 정렬 + 상위 5개 반환

#### RecommendedActionsChips (P1)

```tsx
interface RecommendedActionsChipsProps {
  eventType: string; // 현재 이벤트 타입
  componentType: string; // 대상 컴포넌트 타입
  existingActions: BlockEventAction[]; // 이미 추가된 액션 목록
  onAddAction: (actionType: ActionType) => void;
}
```

- **배치**: ThenElseBlock 내부 (빈 상태: chips + "More actions" / 액션 있음: 리스트 아래) — 두 위치 모두 렌더링됨
- **추천 로직**: `getRecommendedActions({ eventType, componentType })` + 마지막 액션 `previousAction` 체이닝 결과 병합 → 중복 제거 → 기존 타입 제외 → 최대 3개
- **최대 표시**: 3개 (이미 추가된 액션 타입 제외)
- **스타일**: `.recommended-actions-chips`, `.recommended-action-chip` (dashed 테두리)
- **구현 위치**: `components/RecommendedActionsChips.tsx` — `ACTION_CHIP_ICONS` 매핑 포함

#### ActionBlock 경고 (P1)

- **헬퍼**: `getMissingRequiredFields(action)` — `ACTION_METADATA[type].configFields`에서 `required: true`인 필드 중 값이 `undefined | '' | null`인 항목 반환
- **렌더링**: `AlertTriangle` 아이콘 + `TooltipTrigger`로 누락 필드명 표시 (react-aria-components 사용)
- **스타일**: `.action-warning`, `.action-warning-icon`, `.action-warning-tooltip`
- **구현 위치**: `blocks/ActionBlock.tsx` (line 125–132) — `ACTION_METADATA` import 사용

#### ActionPickerOverlay 추천 배지 (P1)

- **로직**: `getRecommendedActions({ eventType, componentType })` 결과를 `Set<string>`으로 변환
- **렌더링**: 추천 액션 항목에 `<span className="action-recommended-badge">추천</span>` 추가
- **스타일**: `.action-recommended-badge` (primary 색상)
- **구현 위치**: `EventsPanel.tsx` 내 `ActionPickerOverlay` 컴포넌트 (line 176–278) — 검색, 카테고리 그룹화(`REGISTRY_ACTION_CATEGORIES`) 포함

### 스타일 가이드

- 모든 스타일은 `EventsPanel.css`에 집중 (개별 CSS 파일 분리 없음)
- 다크 모드: `[data-theme="dark"]` 선택자로 대응
- 클래스명 패턴: `.recommended-*` (P0 이벤트), `.recommended-action-*` (P1 액션), `.action-warning-*` (P1 경고)

## 검증 체크리스트

### P0 검증 (구현 완료)

- [x] Button 선택 시 `onPress`, `onClick` 추천 chip 노출
- [x] TextField 선택 시 `onChange`, `onInput`, `onFocus`, `onBlur` 추천 chip 노출
- [x] 추천 chip 클릭 → 핸들러 생성 및 자동 선택
- [x] 이미 등록된 이벤트는 추천 목록에서 제외
- [x] 모든 추천 이벤트 등록 시 추천 섹션 숨김
- [x] 핸들러 디테일 화면에서 추천 섹션 숨김
- [x] 추천 chip에 마우스 호버 시 툴팁 표시 (이벤트 설명)
- [x] 키보드 탐색: Tab으로 chip 간 이동, Enter/Space로 추가
- [x] 빈 상태에서 레시피 템플릿 카드 표시
- [x] 템플릿 클릭 → 이벤트+액션 일괄 생성 (기존 핸들러 merge 지원)
- [x] 다크 모드 스타일 정상

### P1 검증 (구현 완료)

- [x] onClick 핸들러 상세 → THEN 블록에 `navigate`, `showModal`, `apiCall` chips 표시
- [x] onSubmit 핸들러 상세 → THEN 블록에 `validateForm`, `apiCall`, `showToast` chips 표시
- [x] 추천 액션 chip 클릭 → 액션 추가 + 기본 config 적용
- [x] 이미 navigate 있을 때 → chips에서 navigate 제외
- [x] 마지막 액션이 apiCall일 때 → 체이닝 추천 (setState, showToast, navigate)
- [x] navigate 액션의 path 미입력 → ActionBlock에 ⚠️ 경고 아이콘
- [x] 경고 아이콘 호버 → "필수 설정 누락: Path" 툴팁
- [x] ActionPickerOverlay → 추천 액션에 "추천" 배지 표시
- [x] ELSE 블록에도 추천 chips + 경고 정상 동작
- [x] 다크 모드 스타일 정상
- [x] TypeScript 타입 체크 통과

### P1.5 검증 (미구현)

- [ ] THEN/ELSE 내부 인라인 액션 추가행에서 오버레이 없이 액션 추가 가능
- [ ] ⚠️ 클릭 시 누락 필드 에디터가 열리고 첫 필드에 포커스 이동
- [ ] 최근 사용 액션 3~5개 노출 및 클릭 즉시 추가
- [ ] 디테일 화면의 미니 추천 바가 기본 접힘 상태로 동작
- [ ] 키보드 단축 `A`, `/`, `Cmd/Ctrl+Enter` 정상 동작
- [ ] `aria-live`로 "핸들러 추가됨/액션 추가됨" 음성 안내 확인

### P2 검증 (미구현)

- [ ] 자연어 입력 → 이벤트+액션 초안 생성
- [ ] Ctrl/Cmd+K → 커맨드 팔레트 열림
- [ ] 시뮬레이션 실행 → 콘솔에 mock 결과 출력
- [ ] 사용 빈도 기반 추천 순서 변경 확인

## 결정 사항

### 핸들러 디테일 화면에서 추천 노출 여부

**결정: 숨김**

- 이유: 디테일 화면은 집중 편집 모드이므로 추천 UI가 혼란을 줄 수 있음
- 대안: THEN 블록 내 "추천 액션" chips는 P1에서 별도 구현

### 추천 액션/레시피 노출 위치 (P1)

**결정: THEN 블록 상단 + 별도 레시피 섹션**

- THEN 블록: 이벤트별 추천 액션 2~3개를 chips로 표시
- 레시피 섹션: 핸들러 리스트 화면에 "Quick Start" 섹션으로 템플릿 제공

### P1.5 구현 우선순위

**결정: 1 -> 2 -> 3 순으로 진행**

- 1순위: 경고 즉시 수정 (복구 시간 단축 효과가 가장 큼)
- 2순위: 인라인 액션 추가행 (맥락 전환 감소)
- 3순위: 최근 사용 액션 (반복 작업 속도 개선)

### AI 의도 입력 UX 위치 (P2)

**결정: panel-contents 상단 (검색바 형태)**

- 이유: 헤더는 공간이 제한적이고, 검색과 유사한 UX가 자연스러움
- 형태: 플레이스홀더 "무엇을 하고 싶으세요?" + Enter로 생성

## 성공 지표 (P1.5/P2 공통)

- 첫 핸들러 생성까지 평균 시간(ms)
- 핸들러 1개 + 액션 1개 완료까지 평균 클릭 수
- 필수 설정 누락 상태에서 편집 이탈한 비율

## 구현 이력

### P0 (2025-02-10)

**변경 파일 5개:**
| 파일 | 작업 |
|------|------|
| `components/RecommendedEventsSection.tsx` | 신규 — 추천 이벤트 chips (useRecommendedEvents 기반, 최대 4개, 툴팁) |
| `components/TemplateSuggestionSection.tsx` | 신규 — 레시피 템플릿 카드 (getRecommendedTemplates 기반, 최대 3개 표시, merge 배지) |
| `components/index.ts` | 수정 — barrel export 추가 |
| `EventsPanel.tsx` | 수정 — 3가지 상태별 추천 노출 + handleApplyTemplate 콜백 |
| `EventsPanel.css` | 수정 — 추천 chips/템플릿 카드 스타일 (~120줄 추가) |

**핵심 구현 사항:**

- `handleApplyTemplate`: 템플릿 이벤트를 순회하며 기존 핸들러 merge 또는 신규 생성
- 빈 상태: 추천 chips + 템플릿 + EmptyState (안내 문구 변경)
- 리스트 뷰: 추천 chips + 핸들러 목록
- 디테일 뷰: 추천 숨김 (집중 편집)

### P1 (2025-02-10)

**변경 파일 6개:**
| 파일 | 작업 |
|------|------|
| `components/RecommendedActionsChips.tsx` | 신규 — THEN/ELSE 블록 내 추천 액션 chips (컨텍스트+체이닝 추천, 최대 3개) |
| `blocks/ThenElseBlock.tsx` | 수정 — eventType/componentType/onQuickAddAction props 추가, 추천 chips 렌더링 |
| `blocks/ActionBlock.tsx` | 수정 — getMissingRequiredFields 헬퍼 + AlertTriangle 경고 아이콘/툴팁 |
| `EventsPanel.tsx` | 수정 — ThenElseBlock에 새 props 전달 + ActionPickerOverlay에 추천 배지 |
| `EventsPanel.css` | 수정 — 추천 액션/경고/배지 스타일 (~90줄 추가) |
| `components/index.ts` | 수정 — RecommendedActionsChips export 추가 |

**핵심 구현 사항:**

- 추천 액션 로직: `getRecommendedActions({ eventType, componentType })` + 마지막 액션 `previousAction` 체이닝 결과 병합
- 누락 경고: `ACTION_METADATA[type].configFields`에서 `required: true`인 필드의 값이 비어있으면 amber 경고
- ActionPicker 배지: 추천 액션 Set 생성 → 해당 액션 항목에 "추천" 배지 렌더링
- ThenElseBlock 빈 상태: "No actions" + 추천 chips + "More actions" 버튼

## 코드 대조 검증 (2026-03-03)

### 검증 결과 요약

실제 코드(`apps/builder/src/builder/panels/events/`)와 본 문서를 대조한 결과:

#### P0: 기본 이벤트 패널 — 구현 확인

- `components/RecommendedEventsSection.tsx` 존재, `MAX_VISIBLE_CHIPS = 4` 상수 사용
- `components/TemplateSuggestionSection.tsx` 존재, "Show all / Show less" 펼침 지원
- `hooks/useRecommendedEvents.ts` 존재, `useRecommendedEvents` / `useEventMetadata` / `useIsEventRecommended` 세 훅 내보냄
- `hooks/useApplyTemplate.ts` 존재, `generateEventHandlerIds()` 함수 exported
- `EventsPanel.tsx` — 핸들러 없음/목록/상세 3가지 뷰 분기 정상
- `data/eventTemplates.ts` — 18개 템플릿 (FORM: 4개, NAVIGATION: 4개, UI: 5개, DATA: 5개) ← 문서에 기재된 "19개"는 오류, 실제 **18개**

#### P1: 추천 액션 + 호환성 배지 + 누락 경고 — 구현 확인

- `components/RecommendedActionsChips.tsx` 존재 — 빈 블록/액션 있는 블록 양쪽 모두에 렌더링
- `blocks/ThenElseBlock.tsx` — `eventType`, `componentType`, `onQuickAddAction` props 통합 확인
- `blocks/ActionBlock.tsx` — `getMissingRequiredFields()` + `AlertTriangle` + `TooltipTrigger` 구현 확인
- `EventsPanel.tsx` 내 `ActionPickerOverlay` — `recommendedActionSet` Set + `action-recommended-badge` 렌더링 확인

#### P1.5 / P2 — 미구현 확인

- 인라인 액션 추가행, 경고 즉시 수정, 최근 사용 액션, aria-live 등 미구현
- AI 생성 기능 미구현

### 파일 경로 수정 사항

| 수정 전                       | 수정 후                       | 비고                                   |
| ----------------------------- | ----------------------------- | -------------------------------------- |
| `data/eventCategories.ts:257` | `data/eventCategories.ts:264` | COMPONENT_RECOMMENDED_EVENTS 실제 위치 |
| `data/eventCategories.ts:58`  | `data/eventCategories.ts:65`  | EVENT_METADATA 실제 위치               |
| `data/eventCategories.ts:313` | `data/eventCategories.ts:320` | getRecommendedEvents() 실제 위치       |
| `data/actionMetadata.ts:651`  | `data/actionMetadata.ts:674`  | getRecommendedActions() 실제 위치      |
| 템플릿 19개                   | 템플릿 18개                   | createTemplate() 호출 수 기준          |
| P0 변경 파일 6개              | P0 변경 파일 5개              | 실제 기재된 항목 수                    |

### 실제 구현 타입 수 (2026-03-03 기준)

**ActionType (types/eventTypes.ts)**

- 총 24개: navigate, scrollTo, setState, updateState, apiCall, showModal, hideModal, showToast, toggleVisibility, validateForm, resetForm, submitForm, setComponentState, triggerComponentAction, updateFormField, filterCollection, selectItem, clearSelection, loadDataTable, syncComponent, saveToDataTable, setVariable, copyToClipboard, customFunction

**EventType (types/eventTypes.ts)**

- 총 20개: onClick, onDoubleClick, onMouseEnter, onMouseLeave, onMouseDown, onMouseUp, onChange, onInput, onSubmit, onFocus, onBlur, onKeyDown, onKeyUp, onKeyPress, onPress, onSelectionChange, onAction, onOpenChange, onScroll, onResize, onLoad

### 미문서화 서브 디렉터리

본 검증에서 확인된 문서에 누락된 하위 폴더들:

- `state/` — useEventHandlers, useActions, useEventSelection
- `editors/` — BlockActionEditor, ConditionRow, VariableBindingEditor 등
- `actions/` — 액션 타입별 전용 에디터 (NavigateActionEditor 등 24개)
- `execution/` — conditionEvaluator, eventExecutor, executionLogger
- `utils/` — normalizeEventTypes, actionHelpers, variableParser, bindingValidator
- `preview/` — EventMinimap, EventDebugger, CodePreviewPanel (미래 기능용 준비)
- `types/` — eventTypes, eventBlockTypes, templateTypes

## 출처

1. https://www.framer.com/ai/ (Framer AI 설명)
2. https://www.framer.com/cms/ (Framer CMS 설명)
3. https://www.framer.com/forms/ (Framer Forms 설명)
4. https://www.framer.com/analytics/ (Framer Analytics 설명)
5. https://www.framer.com/localization/ (Framer Localization 설명)
6. https://webflow.com/ai (Webflow AI 페이지)
7. https://webflow.com/cms (Webflow CMS 페이지)
8. https://webflow.com/feature/localization (Webflow Localization 페이지)
9. https://webflow.com/interactions-animations (Webflow Interactions 페이지)
