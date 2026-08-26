# ADR-016: Photoshop 벤치마크 기반 UI/UX 적용 계획

> **Superseded — 2026-08-26**. 본 ADR 의 실질 항목은 전부 타 ADR 로 반영됐거나 전제가 소멸했다: Context Menu → [ADR-182](182-builder-context-menu.md), Floating Panel → [ADR-922](922-photoshop-style-panel-layout-coordinator.md) + [ADR-186](186-photoshop-default-zone-panel-placement.md), History UI → [ADR-180](180-history-snapshots.md), Comments/Presence → [ADR-128](128-supabase-backend-decommission.md) (전제 소멸), PixiJS 연동 → [ADR-900](900-unified-skia-rendering-engine.md) (전제 소멸). 유일한 미반영 기능 **Contextual Action Bar** 는 Photoshop Web·Figma 액션바 리서치를 거쳐 [ADR-192](../192-contextual-action-bar.md) 로 재설계한다 (본 ADR §5.1~5.2 의 파일 경로·타입안은 승계하지 않음). WCAG AA 대비 감사는 [ADR-191](191-tailwind-theme-single-source-palette.md) 팔레트 단일 원천 이후 후속 항목. 사용자 결정 (2026-08-26 "016 을 Superseded 로 닫고, Action Bar 는 리서치부터 한 후 ADR 설계").

- 상태: **Superseded** — 2026-08-26 (직전: Proposed, 2026-08-26 전제 재정렬 §0)
- 작성일: 2026-02-15 (v2: 2026-03-03 — 현행 아키텍처 기준 재설계)
- 대상 코드: `apps/builder/src/builder/`
- 참고 자료: `docs/explanation/research/PHOTOSHOP_BENCHMARK.md`

## 0. 전제 재정렬 (2026-08-26)

본 문서는 2026-03-03 코드 기준으로 쓰였고, 이후 5개월간 타 ADR 이 같은 표면을 구현하거나 전제를 없앴다. 항목별 현재 사실과 처리를 아래에 고정한다 — 체크리스트(§8)도 이에 맞춰 갱신했다.

| 항목                    | 원 계획 (§)                                               | 현재 사실 (2026-08-26)                                                                                                                                                                                                                                                | 처리                                                      |
| ----------------------- | --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| Context Menu            | §5.3 `components/ContextMenu/` RAC Menu                   | **ADR-182 Implemented (2026-08-16)** — `components/overlay/contextMenu/{useContextMenu,ContextMenuOverlay,buildContextMenuItems}` + `canvas/contextMenu/` provider, 표면 4종(캔버스 요소/빈 영역/레이어 행/셸)                                                        | **반영 완료 — 범위 제외**                                 |
| 공용 액션 시스템        | §5.1 `builder/actions/{types,elementActions,handlers}`    | ADR-182 가 `canvas/actions/canvasActions.ts` 공유 계층(copy/cut/paste/duplicate/delete/group/ungroup/align/distribute 9종)을 추출                                                                                                                                     | **절반 반영** — 태그별 액션 매핑은 ADR-192 소관           |
| Contextual Action Bar   | §5.2 `workspace/overlay/ContextualActionBar.tsx`          | 코드 0건, 타 ADR 계획 0건                                                                                                                                                                                                                                             | **ADR-192 로 재설계** — §5.2 설계안 미승계                |
| History Panel UI        | §5.4 "258줄 기본 UI" 개선                                 | **ADR-180 Implemented (2026-08-13)** — `HistoryPanel.tsx` 551줄. 재실측(08-26): 아이콘 `ENTRY_TYPE_ICONS` 12종(원 계획 7종 초과) ✅ · redo 구간 `data-future` opacity 0.45 ✅ · 점프 ✅ · Skeleton 은 `historyOperationInProgress`/`restoring` disabled 패턴으로 대체 | **반영 완료 — 범위 제외**                                 |
| AI Variations           | §6.1 `GroqAgentService` + 7 도구 위에 Variations          | **ADR-134** Phase 2 가 Groq 완전 제거 → 전제 충돌. 134 breakdown scope-out 목록에도 없어 소관 미정                                                                                                                                                                    | **보류** — 134 후속 응용으로 이관 여부는 134 착수 시 판정 |
| Comments Panel          | §6.2 Supabase Realtime                                    | **ADR-128** Supabase backend decommission (Implemented 2026-05-12)                                                                                                                                                                                                    | **폐기 — 전제 소멸**                                      |
| Floating Panel          | §6.3 `PanelDisplayMode` 확장 + `ModalPanelContainer` 수정 | **ADR-922 (2026-08-18)** `PanelDisplayMode = "panel" \| "modal" \| "floating"` + **ADR-186 (2026-08-19)** 9-zone placement. `ModalPanelContainer.tsx` 는 현존하지 않음                                                                                                | **반영 완료 — 범위 제외**                                 |
| PixiJS 우클릭 연동      | §4.2/§5.3/§8                                              | **ADR-900** Phase 8-9 로 PixiJS 제거                                                                                                                                                                                                                                  | **폐기**                                                  |
| Presence/커서 공유      | §7.2 Supabase Realtime presence                           | ADR-128 로 전제 소멸                                                                                                                                                                                                                                                  | **폐기**                                                  |
| 디자인 시스템 WCAG 감사 | §7.1                                                      | §7.1 의 `--color-text-*` 토큰은 코드에 없음. ADR-191 이 팔레트 원천을 단일화하기 전엔 Builder DOM(oklch)·Preview(v3 hex) 가 다른 색을 봐 감사 대상이 이동 중                                                                                                          | **ADR-191 후속** — 191 Phase 4 이후 착수                  |

> §4~§9 본문은 2026-03-03 코드 기준 역사적 기록으로 보존 — `SHORTCUT_DEFINITIONS` 는 "85+" 가 아니라 69개(08-26 실측), `ModalPanelContainer.tsx`·PixiJS·Taffy 는 현존하지 않는다. ADR-192 는 이 본문을 승계하지 않고 리서치부터 다시 시작한다.

## 1. 목적

- Photoshop Web의 사용자 편의성 패턴을 composition에 맞게 도입해 학습 부담을 줄이고 작업 속도를 높인다.
- 초기 단계에서는 컨텍스트 인식 도구(Action Bar, Context Menu)를 우선 구현해 체감 효용을 만든다.
- 이미 구현된 시스템(History 점프, AI Agent Loop, 85+ 단축키)을 활용하여 증분 개선한다.

## 2. 로드맵 요약

| Phase  | 목표             | 핵심 산출물                                                 |
| ------ | ---------------- | ----------------------------------------------------------- |
| **P0** | 컨텍스트 인식 UI | 공용 액션 시스템, Action Bar, Context Menu, History UI 개선 |
| **P1** | 생성형 UX 강화   | AI Variations/Preview, Comments Panel, Floating Panel       |
| **P2** | 안정화 & 협업    | 디자인 시스템 조정, Presence/커서 공유                      |

## 3. 성공 지표

- History Panel: 목표 상태 복원까지 평균 클릭 수 30% 감소
- Contextual Action Bar: 패널 이동 없이 주요 편집 수행 비율 50% 이상
- AI Workspace: 프롬프트→적용까지 평균 시간 20% 단축

---

## 4. 아키텍처 개요

### 4.1 레이아웃 구조

```
┌──────────────────────────────────────────────────────────────────┐
│                       BuilderHeader                              │
├────────────────┬─────────────────────────┬───────────────────────┤
│  Sidebar (좌)  │      Workspace (중)     │  Inspector (우)       │
│                │                         │                       │
│ NodesPanel     │  workspace/canvas/      │ PropertiesPanel       │
│ ComponentsPanel│  BuilderCanvas.tsx      │ StylesPanel           │
│ DataTablePanel │  + SkiaRenderer         │ EventsPanel           │
│ ThemePanel     │  + SelectionLayer       │ AIPanel               │
│                │  + TextEditOverlay      │ HistoryPanel          │
│                │  + ContextualActionBar  │                       │
│                │  + ContextMenu          │                       │
├────────────────┴─────────────────────────┴───────────────────────┤
│                  BottomPanel (Monitor)                            │
├──────────────────────────────────────────────────────────────────┤
│              ModalPanelContainer (플로팅 오버레이)                │
└──────────────────────────────────────────────────────────────────┘
```

### 4.2 렌더러 구조

```
CanvasKit/Skia WASM (메인 렌더러)
├── 디자인 노드 렌더링 (nodeRenderers.ts → TAG_SPEC_MAP 75개 스펙)
├── Selection 오버레이 (SelectionLayer.tsx)
└── AI 시각 피드백 (aiVisualFeedback.ts)

PixiJS 8 (이벤트 전용, alpha=0)
├── EventBoundary 히트 테스트
└── Camera 하위 씬 그래프

Taffy WASM (레이아웃 엔진)
└── Flex / Grid / Block 연산 → DirectContainer 배치
```

### 4.3 핵심 파일 매핑

> 모든 경로는 `apps/builder/src/builder/` 기준

| 영역                   | 파일 경로                                                       |
| ---------------------- | --------------------------------------------------------------- |
| Workspace 컨테이너     | `workspace/Workspace.tsx`                                       |
| Canvas (PixiJS + Skia) | `workspace/canvas/BuilderCanvas.tsx`                            |
| Skia 렌더러            | `workspace/canvas/skia/`                                        |
| 선택 레이어            | `workspace/canvas/selection/SelectionLayer.tsx`                 |
| DOM 오버레이           | `workspace/overlay/TextEditOverlay.tsx`                         |
| 뷰포트                 | `workspace/canvas/viewport/`                                    |
| History 스토어         | `stores/history.ts`, `stores/history/historyActions.ts`         |
| History UI             | `panels/history/HistoryPanel.tsx`                               |
| AI 패널                | `panels/ai/AIPanel.tsx`                                         |
| AI 서비스              | `../../services/ai/GroqAgentService.ts` (7개 도구)              |
| 패널 시스템            | `panels/core/types.ts` (PanelId, PanelConfig, PanelDisplayMode) |
| 모달 패널              | `layout/ModalPanelContainer.tsx`                                |
| 키보드 단축키          | `config/keyboardShortcuts.ts` (85+ 단축키)                      |
| CommandPalette         | `components/overlay/CommandPalette.tsx` (Cmd+K)                 |
| Inspector 액션         | `stores/inspectorActions.ts` (preview 패턴)                     |

### 4.4 기존 시스템 현황

ADR-016 구현 시 활용할 이미 구현된 시스템:

| 시스템             | 현황                                                   | ADR-016 활용                       |
| ------------------ | ------------------------------------------------------ | ---------------------------------- |
| History 점프       | `goToHistoryIndex(idx)` 구현됨 (elements.ts)           | UI 개선에만 집중 (API 신규 불필요) |
| History Entry 타입 | 7종 — add, remove, update, move, batch, group, ungroup | 유형별 아이콘 매핑                 |
| Modal Panel        | `ModalPanelContainer.tsx` — 드래그/리사이즈/z-index    | Floating Panel 확장 기반           |
| AI Agent Loop      | `useAgentLoop.ts` + `GroqAgentService.ts` + 7개 도구   | Variations 추가에 집중             |
| 키보드 단축키      | `SHORTCUT_DEFINITIONS` 85+ 등록, scope 기반 활성화     | Action Bar/Context Menu에서 참조   |
| CommandPalette     | `Cmd+K` 글로벌 검색                                    | 공용 액션 시스템 연동              |
| Inspector Preview  | `prePreviewElement` 스냅샷 패턴 (inspectorActions.ts)  | AI Variations 미리보기에 재활용    |
| Events Panel       | 25개 액션 타입, 추천/배지/경고 (P0+P1 완료)            | Context Menu에서 이벤트 추가 액션  |
| 패널 시스템        | `PanelDisplayMode: 'panel' \| 'modal'`, 15개 PanelId   | Comments 추가, floating 모드 확장  |

---

## 5. Phase 0: 컨텍스트 인식 UI

### 5.1 공용 액션 시스템

**목표**: 요소별 액션을 중앙 정의하여 Action Bar, Context Menu, CommandPalette에서 재사용

```
apps/builder/src/builder/actions/   # 🆕 신규
├── types.ts                        # ContextualAction 인터페이스
├── elementActions.ts               # 요소별 액션 매핑
├── handlers.ts                     # 액션 실행 로직
└── index.ts
```

**타입 정의**:

```typescript
import type { LucideIcon } from "lucide-react";
import type { ShortcutId } from "../config/keyboardShortcuts";

export interface ContextualAction {
  id: string;
  icon: LucideIcon;
  label: string;
  /** 기존 단축키 레지스트리 연동 — 표시용 */
  shortcutId?: ShortcutId;
  /** 액션 실행 */
  handler: (elementId: string) => void;
  /** 조건부 표시 */
  isVisible?: (element: Element) => boolean;
}

export type ElementActionMap = Record<string, ContextualAction[]>;
```

**요소별 액션 매핑**:

| 요소        | 액션                                  |
| ----------- | ------------------------------------- |
| `_common`   | 복사, 삭제, 복제, 그룹                |
| `Button`    | 텍스트 편집, 스타일 변경, 이벤트 추가 |
| `TextField` | 플레이스홀더, 유효성 검사             |
| `Image`     | 이미지 변경, 대체 텍스트, 크기 조정   |
| `Flex`      | 방향 전환, 정렬, 간격 조정            |

**기존 시스템 연동**:

- `handlers.ts`에서 `inspectorActions.ts`의 기존 액션 재사용 (`updateSelectedStyle`, `updateSelectedProperty` 등)
- `shortcutId`로 `keyboardShortcuts.ts`의 `SHORTCUT_DEFINITIONS` 참조 → 단축키 표시 자동 동기화
- CommandPalette에 공용 액션 등록 → `Cmd+K`에서 요소별 액션 검색 가능

---

### 5.2 Contextual Action Bar

**화면 설계**:

```
┌──────────────────────────────────────────┐
│          [선택된 Button 요소]             │
└──────────────────────────────────────────┘
                    ↓ 8px gap
    ┌─────────────────────────────────┐
    │ 텍스트 │ 스타일 │ 이벤트 │ ⋮   │  ← React Aria Toolbar
    └─────────────────────────────────┘
```

**파일 구조**:

```
apps/builder/src/builder/workspace/overlay/
├── TextEditOverlay.tsx              # 기존
├── ContextualActionBar.tsx          # 🆕 DOM 기반 플로팅 바
├── ContextualActionBar.css          # 🆕 스타일
└── index.ts                         # export 추가
```

**통합 포인트**: `workspace/Workspace.tsx` (TextEditOverlay와 동일 레벨)

```typescript
// Skia 캔버스 위에 DOM 오버레이로 렌더링
<div className="workspace-overlay-layer">
  <TextEditOverlay />
  <ContextualActionBar
    elementId={selectedElementId}
    bounds={selectionScreenBounds}
    actions={contextualActions}
  />
</div>
```

**위치 계산**: Selection 씬 좌표 → `worldToScreen()` 변환 (SelectionLayer.tsx에 기존 패턴 존재)

```
screenY = bounds.y * zoom + panOffset.y + bounds.height * zoom + 8
```

**접근성**: React Aria Components `Toolbar` 사용 (키보드 탐색, ARIA role)

---

### 5.3 Context Menu

**화면 설계**:

```
┌─────────────────────────┐
│ 텍스트 편집              │
│ 스타일 변경              │
├─────────────────────────┤
│ 복사          ⌘C        │  ← shortcutId로 자동 매핑
│ 붙여넣기      ⌘V        │
│ 복제          ⌘D        │
├─────────────────────────┤
│ 삭제          ⌫         │
└─────────────────────────┘
```

**파일 구조**:

```
apps/builder/src/builder/components/ContextMenu/   # 🆕 신규
├── index.tsx                # React Aria Menu 기반
├── ContextMenu.css
├── useContextMenu.ts        # 상태 관리 (위치, 표시/숨김)
└── menuItems.ts             # elementActions.ts 재사용
```

**통합**:

- PixiJS `FederatedPointerEvent`에서 `button === 2` (우클릭) 감지
- 이벤트 좌표를 `worldToScreen()` 변환 후 Context Menu에 전달
- React Aria Components `Menu`, `MenuItem`, `Separator` 활용 (접근성)
- `elementActions.ts`의 액션 매핑을 그대로 재사용

---

### 5.4 History Panel UI 개선

> **Note**: `goToHistoryIndex(targetIndex)` API는 이미 구현됨 (elements.ts:187). UI 개선에만 집중.

**현재 상태**: `HistoryPanel.tsx` (258줄) — 기본 UI + goToHistoryIndex + undo/redo 버튼

**개선 항목**:

| 항목      | 현재                           | 개선                                     |
| --------- | ------------------------------ | ---------------------------------------- |
| 아이콘    | 없음                           | entry.type별 아이콘 (7종)                |
| Redo 구분 | 없음                           | currentIndex 이후 항목 `opacity: 0.5`    |
| 점프      | ✅ `goToHistoryIndex()` 구현됨 | (변경 불필요)                            |
| 로딩      | 없음                           | `historyOperationInProgress` 시 Skeleton |

**entry.type → 아이콘 매핑** (lucide-react):

| type      | 아이콘    | 라벨      |
| --------- | --------- | --------- |
| `add`     | `Plus`    | 추가      |
| `remove`  | `Trash2`  | 삭제      |
| `update`  | `Pencil`  | 수정      |
| `move`    | `Move`    | 이동      |
| `batch`   | `Layers`  | 일괄 수정 |
| `group`   | `Group`   | 그룹      |
| `ungroup` | `Ungroup` | 그룹 해제 |

**수정 파일**:

```
apps/builder/src/builder/panels/history/
├── HistoryPanel.tsx          # 아이콘 + redo opacity 추가
└── HistoryPanel.css          # redo 스타일 (.history-item[data-redo] { opacity: 0.5 })
```

---

## 6. Phase 1: 생성형 UX 강화

### 6.1 AI Variations & Preview

**현재 상태**: AIPanel + useAgentLoop + GroqAgentService (Tool Calling + Agent Loop) 구현됨. 단일 결과, 미리보기 없음.

**개선 목표**:

- 프롬프트당 3개 변형 생성
- 변형 미리보기 및 선택 적용
- Quick Actions 버튼 (스타일/레이아웃/텍스트)

**기존 패턴 활용**:

- `inspectorActions.ts`의 `prePreviewElement` 스냅샷 패턴 → AI 변형 미리보기에 적용
- `updateSelectedStylePreview()` → 히스토리/DB 저장 없이 캔버스만 업데이트
- 변형 확정 시 `updateSelectedStyle()` → 히스토리 기록 + DB 저장

**파일 구조**:

```
apps/builder/src/builder/panels/ai/
├── AIPanel.tsx               # 구조 개선
├── components/
│   ├── QuickActions.tsx      # 🆕 빠른 액션 버튼
│   ├── VariationsGrid.tsx    # 🆕 변형 그리드 (3개)
│   └── VariationPreview.tsx  # 🆕 개별 변형 미리보기
└── hooks/
    └── useVariations.ts      # 🆕 변형 생성/관리/적용
```

---

### 6.2 Comments Panel

**파일 구조**:

```
apps/builder/src/builder/panels/comments/   # 🆕 신규
├── CommentsPanel.tsx
├── components/
│   ├── CommentThread.tsx
│   ├── CommentItem.tsx
│   └── CommentInput.tsx
└── hooks/
    └── useComments.ts        # Supabase Realtime
```

**패널 시스템 통합**:

- `PanelId`에 `'comments'` 추가 (`panels/core/types.ts`)
- `PanelConfig` 등록 → 기존 패널 시스템 자동 통합 (사이드바 배치, 모달 전환 등)

**데이터 모델**:

```typescript
interface Comment {
  id: string;
  project_id: string;
  page_id: string;
  element_id: string | null; // 요소 연결 (null = 페이지 레벨)
  author_id: string;
  content: string;
  resolved: boolean;
  parent_id: string | null; // 스레드 (null = 최상위)
  position?: { x: number; y: number }; // 캔버스 위치 (핀)
  created_at: string;
  updated_at: string;
}
```

---

### 6.3 Floating Panel 시스템

**현재 상태**: `PanelDisplayMode: 'panel' | 'modal'` — modal은 `ModalPanelContainer.tsx`에서 드래그/리사이즈/z-index 관리

**개선**: `'floating'` 모드 추가 (modal과 유사하나 backdrop 없음, 고정 가능)

**기존 인프라 활용**:

```typescript
// panels/core/types.ts 확장
export type PanelDisplayMode = "panel" | "modal" | "floating";

// ModalPanelState 확장
export interface ModalPanelState {
  panelId: PanelId;
  mode: "modal" | "floating"; // 🆕 모드 구분
  position: { x: number; y: number };
  size: { width: number; height: number };
  zIndex: number;
  isPinned: boolean; // 🆕 floating 고정 여부
}
```

**기존 API 재활용**:

- `openPanelAsModal()` → `openPanelAsFloating()` 유사 로직 추가
- `updateModalPanelPosition()`, `updateModalPanelSize()` — 그대로 재사용
- `focusModalPanel()` — z-index 관리 그대로 재사용
- `ModalPanelContainer.tsx` — backdrop 조건부 렌더링 (`mode === 'floating'` 시 backdrop 없음)

---

## 7. Phase 2: 안정화 & 협업

### 7.1 디자인 시스템 조정

**아이콘**: lucide-react 유지 (Spectrum 2 스타일은 참고만)

```css
/* 아이콘 일관성 가이드 */
.builder-icon {
  --icon-stroke-width: 1.5; /* lucide 기본값 유지 */
  --icon-size-sm: 14px;
  --icon-size-md: 16px;
}
```

**색상 대비** (WCAG AA 기준):

```css
:root {
  --color-text-primary: oklch(20% 0 0);
  --color-text-secondary: oklch(40% 0 0);
  --color-text-disabled: oklch(60% 0 0);
}
```

### 7.2 Presence/커서 공유

- Supabase Realtime `presence` 채널 사용
- 캔버스 커서 위치: 씬 좌표(Camera-local)로 전송, 수신 측에서 `worldToScreen()` 역변환
- DOM 오버레이로 타 사용자 커서 + 이름 라벨 표시
- 선택 중인 요소 표시 (테두리 색상으로 구분)

---

## 8. 구현 체크리스트

### Phase 0

- [ ] 공용 액션 시스템 — **절반 반영 (ADR-182 `canvas/actions/canvasActions.ts` 8종)**. 잔여 = Action Bar 용 태그별 액션 매핑
  - [x] 공유 액션 계층 (ADR-182, 2026-08-16)
  - [ ] 요소 태그별 액션 매핑 (Action Bar 착수 시)
- [ ] `workspace/overlay/ContextualActionBar.tsx` — React Aria Toolbar
- [x] Context Menu — **ADR-182 Implemented 2026-08-16** (`components/overlay/contextMenu/*`)
- [ ] `Workspace.tsx` 통합 — Context Menu 는 182 로 마운트 완료, Action Bar 만 잔여
- ~~PixiJS 우클릭 이벤트 → Context Menu 연동~~ — 폐기 (ADR-900 PixiJS 제거, 182 는 Skia hit-test `resolveClickTarget` 공유)
- [ ] History Panel 아이콘 + redo opacity 스타일 — **ADR-180 (2026-08-13) 이후 재실측 필요** (`HistoryPanel.tsx` 551줄)
- [ ] 기존 85+ 단축키와 충돌 검증
- [ ] 테스트 통과

### Phase 1

- [ ] AI Variations — **보류** (Groq 전제가 ADR-134 Phase 2 와 충돌, 134 후속 판정)
- ~~Comments Panel + PanelId 등록 + Supabase Realtime~~ — 폐기 (ADR-128 Supabase decommission)
- [x] Floating Panel — **ADR-922 (2026-08-18) + ADR-186 (2026-08-19)** 로 반영 (`PanelDisplayMode "floating"`)

### Phase 2

- [ ] 색상 대비 WCAG AA 감사
- ~~Presence 프로토타입 (Supabase Realtime presence)~~ — 폐기 (ADR-128)

---

## 9. 리스크/검증 포인트

| 리스크                          | 대응                                                      |
| ------------------------------- | --------------------------------------------------------- |
| Action Bar 위치 계산 (줌/팬)    | SelectionLayer의 기존 worldToScreen() 패턴 재사용         |
| Action Bar 60fps 유지           | DOM 오버레이 → RAF throttle, transform 기반 위치 업데이트 |
| Context Menu + 기존 단축키 충돌 | shortcutId 기반 매핑으로 단일 소스 보장                   |
| Floating Panel 상태 영속        | localStorage + panelLayout 스토어 (기존 modal 패턴 확장)  |
| AI Variations 응답 지연         | prePreviewElement 스냅샷 → Undo 정확성 보장               |
| Presence 네트워크 지연          | 커서 보간 (lerp) + 500ms 이상 무응답 시 페이드아웃        |
