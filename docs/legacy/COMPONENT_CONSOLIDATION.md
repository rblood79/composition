# Builder 구조 통합 계획

> **폐기 (2026-09-09)**: 2026-02 의 builder 모듈 통합 계획이다. 이후 ADR-912 catalog cutover 와 모노레포 분리로 대상 구조 자체가 바뀌어 인용 경로가 남아 있지 않다. 현행 컴포넌트 정본은 catalog `COMPONENT_RULES_TABLE` — [COMPONENT_SPEC](../reference/components/COMPONENT_SPEC.md). 기록 보존용.

## 개요

현재 builder 내 여러 모듈들이 분산되어 있어 관리 및 사용에 혼란이 발생하고 있습니다.
이 문서는 다음 세 가지 통합 계획을 정의합니다:

| Part | 통합 내용 | 상태 |
|------|----------|------|
| 1 | `components` + `panels/common` → `components` | ✅ 완료 (2025-12-26) |
| 2 | `events` → `panels/events` | ✅ 완료 (2025-12-27) |
| 3 | `constants` → `utils` | ✅ 완료 (2025-12-26) |

---

# Part 1: Components 통합 ✅ 완료

> **완료일**: 2025-12-26
> **상태**: 마이그레이션 완료, 빌드 검증 통과

## 1.1 개요

`src/builder/components`와 `src/builder/panels/common`을 통합하여 공통 컴포넌트를 한 곳에서 관리합니다.

## 1.2 현재 구조 분석

### `src/builder/components/` (7개 파일)

| 파일 | 설명 | 분류 |
|------|------|------|
| `AddPageDialog.tsx` | 페이지 추가 다이얼로그 | Dialog |
| `AddPageDialog.css` | 다이얼로그 스타일 | Dialog |
| `DataTable.tsx` | 데이터 테이블 컴포넌트 | Data |
| `DataTableMetadata.ts` | 데이터 테이블 메타데이터 | Data |
| `ScopedErrorBoundary.tsx` | 에러 바운더리 | Feedback |
| `Toast.tsx` | 토스트 알림 | Feedback |
| `ToastContainer.tsx` | 토스트 컨테이너 | Feedback |
| `styles/Toast.css` | 토스트 스타일 | Feedback |
| `styles/ScopedErrorBoundary.css` | 에러 바운더리 스타일 | Feedback |

### `src/builder/panels/common/` (22개 파일)

| 파일 | 설명 | 분류 |
|------|------|------|
| `PropertyInput.tsx` | 텍스트 입력 프로퍼티 | Property |
| `PropertySelect.tsx` | 선택 프로퍼티 | Property |
| `PropertyCheckbox.tsx` | 체크박스 프로퍼티 | Property |
| `PropertySwitch.tsx` | 스위치 프로퍼티 | Property |
| `PropertySlider.tsx` | 슬라이더 프로퍼티 | Property |
| `PropertyColor.tsx` | 색상 프로퍼티 | Property |
| `PropertyColorPicker.tsx` | 색상 피커 프로퍼티 | Property |
| `PropertyUnitInput.tsx` | 단위 입력 프로퍼티 | Property |
| `PropertySection.tsx` | 프로퍼티 섹션 | Property |
| `PropertyFieldset.tsx` | 프로퍼티 필드셋 | Property |
| `PropertyCustomId.tsx` | 커스텀 ID 프로퍼티 | Property |
| `PropertyDataBinding.tsx` | 데이터 바인딩 프로퍼티 | Property |
| `PropertyDataBinding.css` | 데이터 바인딩 스타일 | Property |
| `PanelHeader.tsx` | 패널 헤더 | Panel |
| `SectionHeader.tsx` | 섹션 헤더 | Panel |
| `EmptyState.tsx` | 빈 상태 표시 | Feedback |
| `LoadingSpinner.tsx` | 로딩 스피너 | Feedback |
| `MultiSelectStatusIndicator.tsx` | 다중 선택 상태 표시 | Selection |
| `BatchPropertyEditor.tsx` | 일괄 프로퍼티 편집 | Selection |
| `SelectionFilter.tsx` | 선택 필터 | Selection |
| `SelectionMemory.tsx` | 선택 메모리 | Selection |
| `SmartSelection.tsx` | 스마트 선택 | Selection |
| `KeyboardShortcutsHelp.tsx` | 키보드 단축키 도움말 | Help |
| `index.ts` | 통합 export | - |
| `index.css` | 공통 스타일 | - |
| `list-group.css` | 리스트 그룹 스타일 | - |

## 1.3 문제점

1. **일관성 부족**: 공통 컴포넌트를 찾을 때 두 곳을 확인해야 함
2. **명확한 기준 부재**: 새 컴포넌트를 어디에 추가해야 하는지 모호함
3. **import 경로 복잡**: 사용처마다 다른 경로로 import
4. **유지보수 어려움**: 관련 컴포넌트가 분산되어 있어 수정 시 누락 가능성

## 1.4 통합 목표

- 모든 builder 공통 컴포넌트를 `src/builder/components/`에서 관리
- 성격에 따라 하위 폴더로 분류하여 가독성 확보
- 통합 `index.ts`를 통한 일관된 import 경로 제공

## 1.5 제안 구조

```
src/builder/components/
├── property/                    # 프로퍼티 편집 컴포넌트
│   ├── PropertyInput.tsx
│   ├── PropertySelect.tsx
│   ├── PropertyCheckbox.tsx
│   ├── PropertySwitch.tsx
│   ├── PropertySlider.tsx
│   ├── PropertyColor.tsx
│   ├── PropertyColorPicker.tsx
│   ├── PropertyUnitInput.tsx
│   ├── PropertySection.tsx
│   ├── PropertyFieldset.tsx
│   ├── PropertyCustomId.tsx
│   ├── PropertyDataBinding.tsx
│   ├── PropertyDataBinding.css
│   └── index.ts
│
├── panel/                       # 패널 관련 컴포넌트
│   ├── PanelHeader.tsx
│   ├── SectionHeader.tsx
│   └── index.ts
│
├── selection/                   # 선택 관련 컴포넌트
│   ├── MultiSelectStatusIndicator.tsx
│   ├── BatchPropertyEditor.tsx
│   ├── SelectionFilter.tsx
│   ├── SelectionMemory.tsx
│   ├── SmartSelection.tsx
│   └── index.ts
│
├── feedback/                    # 피드백/상태 표시 컴포넌트
│   ├── Toast.tsx
│   ├── ToastContainer.tsx
│   ├── Toast.css
│   ├── EmptyState.tsx
│   ├── LoadingSpinner.tsx
│   ├── ScopedErrorBoundary.tsx
│   ├── ScopedErrorBoundary.css
│   └── index.ts
│
├── dialog/                      # 다이얼로그 컴포넌트
│   ├── AddPageDialog.tsx
│   ├── AddPageDialog.css
│   └── index.ts
│
├── data/                        # 데이터 관련 컴포넌트
│   ├── DataTable.tsx
│   ├── DataTableMetadata.ts
│   └── index.ts
│
├── help/                        # 도움말 관련 컴포넌트
│   ├── KeyboardShortcutsHelp.tsx
│   └── index.ts
│
├── styles/                      # 공통 스타일
│   ├── index.css
│   └── list-group.css
│
└── index.ts                     # 통합 export
```

## 1.6 마이그레이션 단계

### Phase 1: 폴더 구조 생성
- [x] `src/builder/components/` 하위에 분류별 폴더 생성
  - `property/`, `panel/`, `selection/`, `feedback/`, `dialog/`, `data/`, `help/`, `styles/`

### Phase 2: 파일 이동
- [x] `panels/common/`의 Property* 컴포넌트들 → `components/property/`
- [x] `panels/common/`의 PanelHeader, SectionHeader → `components/panel/`
- [x] `panels/common/`의 Selection*, Batch*, MultiSelect* → `components/selection/`
- [x] `panels/common/`의 EmptyState, LoadingSpinner → `components/feedback/`
- [x] `panels/common/`의 KeyboardShortcutsHelp → `components/help/`
- [x] 기존 `components/`의 Toast*, ScopedErrorBoundary → `components/feedback/`
- [x] 기존 `components/`의 AddPageDialog → `components/dialog/`
- [x] 기존 `components/`의 DataTable* → `components/data/`
- [x] 스타일 파일들 정리 → `components/styles/` 또는 각 폴더 내

### Phase 3: Export 설정
- [x] 각 하위 폴더에 `index.ts` 생성
- [x] 루트 `components/index.ts`에서 모든 컴포넌트 re-export

### Phase 4: Import 경로 업데이트
- [x] `panels/common`을 import하는 모든 파일 검색
- [x] import 경로를 `builder/components`로 변경

### Phase 5: 정리
- [x] `src/builder/panels/common/` 폴더 삭제
- [x] 빌드 및 테스트 검증

## 1.7 Import 경로 변경 예시

### Before
```typescript
// 분산된 import
import { PropertyInput, PropertySelect } from '../panels/common';
import { Toast } from '../components/Toast';
import { EmptyState } from '../panels/common/EmptyState';
```

### After
```typescript
// 통합된 import
import {
  PropertyInput,
  PropertySelect,
  Toast,
  EmptyState
} from '../components';

// 또는 카테고리별 import
import { PropertyInput, PropertySelect } from '../components/property';
import { Toast, EmptyState } from '../components/feedback';
```

## 1.8 영향 범위 분석

### 예상 수정 파일
- `src/builder/panels/` 하위 패널 컴포넌트들
- `src/builder/canvas/` 일부 컴포넌트
- 기타 builder 내 common 컴포넌트 사용처

### 리스크
- Import 경로 변경으로 인한 빌드 오류 가능성
- 순환 참조 발생 가능성 (의존성 분석 필요)

### 🔍 순환 참조 분석 결과 (2025-12-26)

**분석 결과: 순환 참조 위험 없음 ✓**

```
builder/components → panels/common : 0개 참조
panels/common → builder/components : 0개 참조
```

두 디렉토리 간 상호 의존성이 없어 안전하게 통합 가능합니다.

## 1.9 검증 체크리스트

- [x] TypeScript 빌드 성공
- [ ] 모든 컴포넌트 정상 렌더링 (수동 검증 필요)
- [ ] 기존 기능 동작 확인 (수동 검증 필요)
- [x] 순환 참조 없음 확인

## 1.10 일정

| 단계 | 예상 작업량 |
|------|------------|
| Phase 1 | 폴더 구조 생성 |
| Phase 2 | 파일 이동 |
| Phase 3 | Export 설정 |
| Phase 4 | Import 경로 업데이트 |
| Phase 5 | 정리 및 검증 |

## 1.11 참고사항

- 이 작업은 기능 변경 없이 구조만 개선하는 리팩토링입니다
- 각 Phase 완료 후 빌드 검증을 권장합니다
- Git 커밋은 Phase별로 분리하여 롤백 용이성을 확보합니다

---

# Part 2: Events 통합 ✅ 완료

> **완료일**: 2025-12-27
> **상태**: 마이그레이션 완료, 빌드 검증 통과

## 2.1 개요

`src/builder/events`와 `src/builder/panels/events` 두 디렉토리가 분리되어 있지만,
실제로 `EventsPanel`에서 **양쪽 모두를 import**하여 사용하고 있어 분리의 의미가 없습니다.

`src/builder/events`를 `src/builder/panels/events`로 통합하여 이벤트 시스템을 한 곳에서 관리합니다.

## 2.2 현재 구조 분석 (2025-12-26 업데이트)

### `src/builder/events/` (75개 파일)

**역할**: 이벤트 시스템의 핵심 로직 + Legacy Editor

| 폴더 | 파일 수 | 설명 |
|------|---------|------|
| `actions/` | 25개 | 액션 에디터 (Navigate, SetState, ShowModal, APICall 등) |
| `components/` | 5개 | UI 컴포넌트 (ConditionEditor, ComponentSelector 등) — 레거시 ViewMode 관련 파일 제거됨 |
| `execution/` | 3개 | 실행 로직 (eventExecutor, conditionEvaluator, executionLogger) |
| `hooks/` | 6개 | 커스텀 훅 (useVariableSchema, useBlockKeyboard 등) — useEventFlow 제거됨 |
| `state/` | 3개 | 상태 관리 (useActions, useEventHandlers, useEventSelection) |
| `types/` | 4개 | 타입 정의 (eventTypes, eventBlockTypes, templateTypes, index) |
| `utils/` | 5개 | 유틸리티 함수 (normalizeEventTypes, variableParser 등) |
| `pickers/` | 2개 | EventTypePicker, ActionTypePicker |
| `data/` | 4개 | 메타데이터, 카테고리, 템플릿, index |
| 루트 | 7개 | EventEditor, EventList, index.ts/tsx, CSS, IMPLEMENTATION_GUIDE.md |

### `src/builder/panels/events/` (22개 파일)

**역할**: Block-based UI (Phase 5 - 권장)

| 폴더 | 파일 수 | 설명 |
|------|---------|------|
| `blocks/` | 7개 | WhenBlock, IfBlock, ThenElseBlock, ActionBlock, ActionList, BlockConnector, index.ts |
| `editors/` | 7개 | ConditionRow, VariableBindingEditor, ElementPicker, OperatorToggle/Picker, BlockActionEditor, index.ts |
| `preview/` | 4개 | CodePreviewPanel, EventDebugger, EventMinimap, index.ts |
| `hooks/` | 1개 | useBlockKeyboard |
| 루트 | 3개 | EventsPanel.tsx, index.ts, CSS |

## 2.3 문제점: EventsPanel의 의존성

`EventsPanel.tsx`에서 양쪽 디렉토리를 모두 import:

```typescript
// ❌ panels/events/ 에서 import
import { WhenBlock } from "./blocks/WhenBlock";
import { IfBlock } from "./blocks/IfBlock";
import { ThenElseBlock } from "./blocks/ThenElseBlock";
import { BlockActionEditor } from "./editors/BlockActionEditor";

// ❌ events/ 에서 import (상대 경로로 거슬러 올라감)
import { EventTypePicker } from "../../events/pickers/EventTypePicker";
import { useEventHandlers } from "../../events/state/useEventHandlers";
import { useActions } from "../../events/state/useActions";
import { useEventSelection } from "../../events/state/useEventSelection";
import { DebounceThrottleEditor } from "../../events/components/DebounceThrottleEditor";
import { normalizeToInspectorAction } from "../../events/utils/normalizeEventTypes";
```

**결론**: 두 디렉토리가 물리적으로 분리되어 있지만 실제로는 하나의 기능에서 함께 사용됨

## 2.4 통합 목표

- 모든 이벤트 관련 코드를 `src/builder/panels/events/`에서 관리
- `src/builder/events/` 폴더 제거
- import 경로 단순화 및 일관성 확보
- Legacy Editor 코드 정리 (필요시 유지 또는 제거)

## 2.5 제안 구조

```
src/builder/panels/events/
├── actions/                     # 액션 에디터 (events/actions/ → 이동)
│   ├── ActionEditor.tsx
│   ├── NavigateActionEditor.tsx
│   ├── SetStateActionEditor.tsx
│   ├── ShowModalActionEditor.tsx
│   ├── APICallActionEditor.tsx
│   ├── ... (25개 액션 에디터)
│   └── index.ts
│
├── blocks/                      # 블록 컴포넌트 (기존 유지)
│   ├── WhenBlock.tsx
│   ├── IfBlock.tsx
│   ├── ThenElseBlock.tsx
│   ├── ActionBlock.tsx
│   ├── ActionList.tsx
│   ├── BlockConnector.tsx
│   └── index.ts
│
├── components/                  # UI 컴포넌트 (레거시 ViewMode/visualMode 제거됨)
│   ├── ActionDelayEditor.tsx
│   ├── ComponentSelector.tsx
│   ├── ConditionEditor.tsx
│   ├── DebounceThrottleEditor.tsx
│   ├── ExecutionDebugger.tsx
│   └── index.ts
│
├── editors/                     # 에디터 컴포넌트 (기존 유지)
│   ├── ConditionRow.tsx
│   ├── VariableBindingEditor.tsx
│   ├── ElementPicker.tsx
│   ├── OperatorToggle.tsx
│   ├── OperatorPicker.tsx
│   ├── BlockActionEditor.tsx
│   └── index.ts
│
├── execution/                   # 실행 로직 (events/execution/ → 이동)
│   ├── eventExecutor.ts
│   ├── conditionEvaluator.ts
│   ├── executionLogger.ts
│   └── index.ts
│
├── hooks/                       # 훅 통합 (events/hooks/ + panels/events/hooks/)
│   ├── useEventSearch.ts
│   ├── useVariableSchema.ts
│   ├── useRecommendedEvents.ts
│   ├── useApplyTemplate.ts
│   ├── useCopyPasteActions.ts
│   ├── useBlockKeyboard.ts
│   └── index.ts
│
├── state/                       # 상태 관리 (events/state/ → 이동)
│   ├── useActions.ts
│   ├── useEventHandlers.ts
│   ├── useEventSelection.ts
│   └── index.ts
│
├── pickers/                     # 피커 컴포넌트 (events/pickers/ → 이동)
│   ├── EventTypePicker.tsx
│   ├── ActionTypePicker.tsx
│   └── index.ts
│
├── preview/                     # 프리뷰 컴포넌트 (기존 유지)
│   ├── CodePreviewPanel.tsx
│   ├── EventDebugger.tsx
│   ├── EventMinimap.tsx
│   └── index.ts
│
├── types/                       # 타입 정의 (events/types/ → 이동)
│   ├── eventTypes.ts
│   ├── eventBlockTypes.ts
│   ├── templateTypes.ts
│   └── index.ts
│
├── utils/                       # 유틸리티 (events/utils/ → 이동)
│   ├── normalizeEventTypes.ts
│   ├── variableParser.ts
│   ├── bindingValidator.ts
│   ├── actionHelpers.ts
│   └── index.ts
│
├── data/                        # 메타데이터 (events/data/ → 이동)
│   ├── actionMetadata.ts
│   ├── eventCategories.ts
│   ├── eventTemplates.ts
│   └── index.ts
│
├── EventsPanel.tsx              # 메인 패널 (기존 유지)
├── EventsPanel.css
└── index.ts                     # 통합 export
```

## 2.6 마이그레이션 단계

### Phase 1: 폴더 구조 생성
- [x] `panels/events/` 하위에 새 폴더들 생성
  - `actions/`, `components/`, `execution/`, `state/`, `pickers/`, `types/`, `utils/`, `data/`

### Phase 2: 파일 이동
- [x] `events/actions/*` → `panels/events/actions/`
- [x] `events/components/*` → `panels/events/components/`
- [x] `events/execution/*` → `panels/events/execution/`
- [x] `events/hooks/*` → `panels/events/hooks/` (기존 hooks와 병합)
- [x] `events/state/*` → `panels/events/state/`
- [x] `events/pickers/*` → `panels/events/pickers/`
- [x] `events/types/*` → `panels/events/types/`
- [x] `events/utils/*` → `panels/events/utils/`
- [x] `events/data/*` → `panels/events/data/`
- [x] `events/EventEditor.tsx`, `EventList.tsx` → **삭제** (사용처 없음 확인됨)

### Phase 3: Export 설정
- [x] 각 하위 폴더에 `index.ts` 생성/업데이트
- [x] 루트 `panels/events/index.ts` 통합 export 업데이트

### Phase 4: Import 경로 업데이트
- [x] `events/`를 import하는 모든 파일 검색
- [x] import 경로를 `panels/events/`로 변경

### Phase 5: 정리
- [x] `src/builder/events/` 폴더 삭제
- [x] 빌드 및 테스트 검증 (TypeScript 빌드 통과)

## 2.7 Import 경로 변경 예시

### Before
```typescript
// EventsPanel.tsx - 분산된 import
import { WhenBlock } from "./blocks/WhenBlock";
import { EventTypePicker } from "../../events/pickers/EventTypePicker";
import { useEventHandlers } from "../../events/state/useEventHandlers";
import { DebounceThrottleEditor } from "../../events/components/DebounceThrottleEditor";
```

### After
```typescript
// EventsPanel.tsx - 통합된 import
import { WhenBlock } from "./blocks";
import { EventTypePicker } from "./pickers";
import { useEventHandlers } from "./state";
import { DebounceThrottleEditor } from "./components";

// 또는 통합 import
import {
  WhenBlock,
  EventTypePicker,
  useEventHandlers,
  DebounceThrottleEditor
} from "./";
```

## 2.8 Legacy Editor 처리 옵션

`events/EventEditor.tsx`와 `EventList.tsx`는 Legacy Editor로 표시되어 있음:

### 🔍 사용처 분석 결과 (2025-12-26)

| 파일 | Import 횟수 | 상태 |
|------|-------------|------|
| `events/EventEditor.tsx` | **0회** | 사용 안 됨 |
| `events/EventList.tsx` | **0회** | 사용 안 됨 |

**결론**: 두 파일 모두 어디서도 import되지 않음

### ~~옵션 A: 보존~~
- ~~`panels/events/legacy/` 폴더에 보관~~
- ~~하위 호환성 유지~~
- ~~점진적 마이그레이션 가능~~

### 옵션 B: 제거 ✅ (권장)
- Block-based Editor로 완전 전환 완료
- 사용처 없음 확인됨
- 마이그레이션 시 `legacy/` 폴더 생성 불필요

## 2.9 영향 범위 분석

### 예상 수정 파일
- `src/builder/panels/events/EventsPanel.tsx`
- `src/builder/events/`를 import하는 모든 파일
- Canvas 또는 Inspector에서 events 관련 import가 있는 경우

### 리스크
- Import 경로 변경으로 인한 빌드 오류 가능성
- ~~Legacy Editor 사용처 누락 가능성~~ → 사용처 없음 확인됨
- 순환 참조 발생 가능성

### 🔍 순환 참조 분석 결과 (2025-12-26)

**분석 결과: 양방향 의존성 존재 (순환 참조!) ⚠️**

#### `panels/events` → `events/` (26+ 참조)
```typescript
// EventsPanel.tsx, blocks/*, editors/*, preview/* 에서 참조
import type { EventHandler } from "../../events/types/eventTypes";
import { EventTypePicker } from "../../events/pickers/EventTypePicker";
import { useEventHandlers } from "../../events/state/useEventHandlers";
import { ActionEditor } from "../../events/actions/ActionEditor";
// ... 외 다수
```

#### `events/` → `panels/events` (12+ 참조)
```typescript
// actions/*.tsx 에서 참조 (9개 파일)
import { ElementPicker } from "../../panels/events/editors/ElementPicker";

// hooks/useVariableSchema.ts, utils/bindingValidator.ts 에서 참조
import type { VariableSchema } from "../../panels/events/editors/VariableBindingEditor";
```

#### 순환 경로 예시
```
panels/events/editors/BlockActionEditor
    → events/actions/ActionEditor
        → panels/events/editors/ElementPicker  ⚠️ 순환!
```

**결론**: 현재 이미 순환 참조가 존재합니다. **통합하면 이 문제가 자연스럽게 해결**됩니다.

## 2.10 검증 체크리스트

- [x] TypeScript 빌드 성공
- [ ] EventsPanel 정상 동작 (수동 검증 필요)
- [ ] 이벤트 추가/수정/삭제 기능 동작 (수동 검증 필요)
- [ ] 액션 에디터들 정상 렌더링 (수동 검증 필요)
- [ ] Block-based UI (WHEN/IF/THEN/ELSE) 정상 동작 (수동 검증 필요)
- [x] 순환 참조 없음 확인 (통합으로 해결됨)

## 2.11 참고사항

- 이 작업은 기능 변경 없이 구조만 개선하는 리팩토링입니다
- Legacy Editor (`EventEditor.tsx`, `EventList.tsx`)는 사용처 없음 확인되어 삭제 예정
- 각 Phase 완료 후 빌드 검증을 권장합니다
- Git 커밋은 Phase별로 분리하여 롤백 용이성을 확보합니다

---

# Part 3: Constants → Utils 통합 ✅ 완료

> **완료일**: 2025-12-26
> **상태**: 마이그레이션 완료, 빌드 검증 통과

## 3.1 개요

`src/builder/constants` 폴더에 파일이 하나만 있어 별도 폴더 유지가 비효율적입니다.
`src/builder/utils`로 통합하여 구조를 단순화합니다.

## 3.2 현재 구조

### `src/builder/constants/` (1개 파일)

| 파일 | 설명 |
|------|------|
| `timing.ts` | 성능 최적화 타이밍 상수 (INSPECTOR_DEBOUNCE, INPUT_DEBOUNCE, DRAG_THROTTLE 등) |

### `src/builder/utils/` (15개 파일)

| 파일 | 설명 |
|------|------|
| `idGeneration.ts` | ID 생성 유틸리티 |
| `idValidation.ts` | ID 유효성 검사 |
| `componentUtils.ts` | 컴포넌트 유틸리티 |
| `componentMap.ts` | 컴포넌트 맵 |
| `treeUtils.ts` | 트리 유틸리티 |
| `HierarchyManager.ts` | 계층 관리자 |
| `selectionMemory.ts` | 선택 메모리 |
| `smartSelection.ts` | 스마트 선택 |
| `multiElementCopy.ts` | 다중 요소 복사 |
| `canvasDeltaMessenger.ts` | 캔버스 델타 메신저 |
| `QueryPersister.ts` | 쿼리 퍼시스터 |
| `LRUPageCache.ts` | LRU 페이지 캐시 |
| `RequestManager.ts` | 요청 관리자 |
| `scheduleTask.ts` | 태스크 스케줄러 |
| `performanceMonitor.ts` | 성능 모니터 |

## 3.3 문제점

1. **불필요한 폴더 분리**: 파일 1개를 위한 별도 폴더
2. **import 경로 복잡**: `../constants/timing` vs `../utils/timing`
3. **관련 기능 분산**: `timing.ts`는 `performanceMonitor.ts`, `scheduleTask.ts`와 관련됨

## 3.4 통합 목표

- `src/builder/constants/timing.ts` → `src/builder/utils/timing.ts`
- `src/builder/constants/` 폴더 제거
- 관련 상수들을 utils 내에서 관리

## 3.5 마이그레이션 단계

### Phase 1: 파일 이동
- [x] `constants/timing.ts` → `utils/timing.ts`

### Phase 2: Import 경로 업데이트
- [x] `constants/timing`을 import하는 모든 파일 검색
- [x] import 경로를 `utils/timing`으로 변경
  - `apps/builder/src/builder/workspace/canvas/selection/SelectionLayer.tsx`
  - `apps/builder/src/builder/workspace/canvas/selection/useDragInteraction.ts`

### Phase 3: 정리
- [x] `src/builder/constants/` 폴더 삭제
- [x] 빌드 및 테스트 검증 (TypeScript 빌드 통과)

## 3.6 Import 경로 변경 예시

### Before
```typescript
import { TIMING } from '../constants/timing';
```

### After
```typescript
import { TIMING } from '../utils/timing';
```

## 3.7 검증 체크리스트

- [x] TypeScript 빌드 성공
- [x] TIMING 상수 사용처 정상 동작
- [x] 순환 참조 없음 확인

## 3.8 참고사항

- 작업량이 적어 단일 커밋으로 처리 가능
- 향후 상수가 추가되면 `utils/constants/` 서브폴더 고려
