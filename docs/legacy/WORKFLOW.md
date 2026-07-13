# WebGL Workflow Integration - Analysis & Implementation Plan

> **Status**: Phase 1~4 구현 완료 / 레거시 ReactFlow 코드 제거 완료
>
> **목표**: `@xyflow/react` 기반 별도 화면 전환 → WebGL 캔버스 내 네이티브 CanvasKit 렌더링으로 점진 통합
>
> **Phase 착수 조건** (모두 충족 완료):
>
> - ~~Phase 1: 캔버스 멀티 페이지 렌더링 안정화 + pagePositions 정확도 검증 완료 시~~ ✓
> - ~~Phase 2: Phase 1 엣지 렌더링의 시각적/성능 QA 통과 시~~ ✓
> - ~~Phase 3: Phase 2 기능 동등성 확인 + PixiJS 이벤트 충돌 해결 방안 확정 시~~ ✓
> - ~~Phase 4: Phase 3 인터랙션 안정화 + 사용자 피드백 반영 완료 시~~ ✓

---

## 1. 현재 아키텍처 분석

### 1.1 기존 Workflow 시스템 (`apps/builder/src/workflow/`)

```
workflow/
├── types/index.ts          (262줄)  # ReactFlow 기반 타입 정의
├── store/workflowStore.ts  (694줄)  # Zustand 스토어 + 그래프 빌드 로직
├── components/
│   ├── WorkflowCanvas.tsx  (154줄)  # @xyflow/react 캔버스
│   └── WorkflowToolbar.tsx  (93줄)  # 시각화 토글 툴바
├── nodes/
│   ├── PageNode.tsx         (78줄)  # 페이지 노드 컴포넌트
│   ├── LayoutNode.tsx       (72줄)  # 레이아웃 노드 컴포넌트
│   └── DataSourceNode.tsx   (88줄)  # 데이터 소스 노드 컴포넌트
├── utils/autoLayout.ts      (96줄)  # Dagre 기반 자동 레이아웃
└── styles/workflow.css     (495줄)  # ReactFlow 스타일
                            ─────
                        합계: 1,537줄 + 495줄 CSS
```

#### 외부 의존성

| 패키지           | 버전     | 역할              | 번들 크기 (gzip) |
| ---------------- | -------- | ----------------- | ---------------- |
| `@xyflow/react`  | ^12.10.0 | ReactFlow 캔버스  | ~45KB            |
| `@dagrejs/dagre` | ^1.1.8   | DAG 자동 레이아웃 | ~15KB            |

#### 기존 동작 방식

```
BuilderCore (viewMode === 'workflow')
    ↓ 화면 전환 (WebGL 캔버스 완전 숨김)
BuilderWorkflow (bridge 컴포넌트)
    ├── useWorkflowSync (3개 useEffect로 데이터 동기화)
    │   ├── pages → WorkflowPage[] 변환
    │   ├── layouts → WorkflowLayout[] 변환
    │   └── elements → WorkflowElement[] 변환 (events, dataBinding 추출)
    ├── WorkflowToolbar (6개 토글 버튼)
    └── WorkflowCanvas (@xyflow/react)
        ├── PageNode, LayoutNode, DataSourceNode
        ├── MiniMap, Controls, Background
        └── postMessage('WORKFLOW_SELECT_PAGE') on click
```

#### 문제점

1. **화면 전환 비용**: WebGL 캔버스 언마운트/리마운트 시 Surface 재생성 (~100ms)
2. **중복 렌더링**: 페이지 프레임이 이미 WebGL에서 렌더링되는데 ReactFlow에서 작은 노드로 다시 표현
3. **컨텍스트 단절**: 워크플로우 뷰에서는 실제 페이지 디자인을 볼 수 없음
4. **외부 의존성**: @xyflow/react + dagre 추가 번들 (~60KB gzip)
5. **DOM 기반 렌더링**: ReactFlow는 DOM 노드 기반 → WebGL 대비 성능 한계

---

### 1.2 WebGL 캔버스 시스템

#### 듀얼 캔버스 아키텍처

```
┌─────────────────────────────────────────────┐
│  CanvasKit/Skia Canvas (z-index: 2)         │  ← 시각적 렌더링
│  ┌───────────────────────────────────────┐   │
│  │ Content Layer (cached snapshot)       │   │
│  │  └─ 디자인 노드 (Box, Text, Image)    │   │
│  ├───────────────────────────────────────┤   │
│  │ Overlay Layer                         │   │
│  │  ├─ AI 이펙트 (generating, flash)     │   │
│  │  ├─ 페이지 타이틀                     │   │
│  │  ├─ 워크플로우 엣지 (NEW)             │   │
│  │  └─ 셀렉션 (box, handles, lasso)     │   │
│  └───────────────────────────────────────┘   │
├─────────────────────────────────────────────┤
│  PixiJS Canvas (z-index: 3, alpha=0)        │  ← 이벤트 전용
│  └─ EventBoundary (hitArea, pointer events) │
└─────────────────────────────────────────────┘
```

#### 멀티 페이지 렌더링

```
Scene Graph (Camera 내부):

Camera Container (pan/zoom)
├── Page-1 (x=0, y=0)
│   ├── TitleHitArea
│   ├── BodyLayer (배경/테두리)
│   └── ElementsLayer (자식 요소)
├── Page-2 (x=pageWidth+80, y=0)
│   └── ...
├── Page-3 (x=2*(pageWidth+80), y=0)
│   └── ...
└── SelectionLayer
```

**핵심 사실**: 모든 페이지가 `pagePositions`로 동시 렌더링되며, 각 페이지의 정확한 좌표(x, y, width, height)를 이미 알고 있음.

#### SkiaRenderer 프레임 분류

| 프레임 타입   | 조건                  | 비용     | 설명                       |
| ------------- | --------------------- | -------- | -------------------------- |
| `idle`        | 변경 없음             | ~0.1ms   | 렌더링 스킵                |
| `present`     | overlayVersion만 변경 | ~1-2ms   | snapshot blit + overlay    |
| `camera-only` | 카메라만 변경         | ~1-2ms   | affine transform + overlay |
| `content`     | registryVersion 변경  | ~10-30ms | 콘텐츠 재렌더              |
| `full`        | resize/cleanup        | ~10-30ms | 전체 재구축                |

**워크플로우 오버레이 성능**: 토글 시 `present` 프레임 → ~1-2ms 추가 비용만 발생.

#### Skia 오버레이 렌더러 패턴

```typescript
// 모든 Skia 렌더러의 공통 패턴
export function renderXxx(
  ck: CanvasKit, // CanvasKit 인스턴스
  canvas: Canvas, // 렌더링 대상 캔버스
  data: DataType, // 렌더링 데이터
  zoom: number, // 줌 레벨 (screen-space invariant 계산용)
  fontMgr?: FontMgr, // 텍스트 렌더링용 폰트 매니저
): void {
  const scope = new SkiaDisposable(); // 리소스 자동 정리
  try {
    const sw = N / zoom; // 화면상 N px 유지
    // ... CanvasKit 렌더링 ...
  } finally {
    scope.dispose(); // GPU 리소스 해제
  }
}
```

---

## 2. 통합 설계

### 2.1 목표 아키텍처

```
BuilderCore
├── BuilderHeader
│   └── GitBranch 토글 버튼 → showWorkflowOverlay 토글 (서브 토글은 캔버스 상단으로 통합)
└── Workspace (WebGL Canvas - 항상 표시)
    ├── WorkflowCanvasToggles (캔버스 상단, 레전드 아이콘 통합)
    │   └── Checkbox × 4 (엣지 스타일 아이콘 + Navigation, Events, Data Sources, Layout Groups)
    ├── BuilderCanvas (PixiJS 씬 그래프)
    │   └── 모든 페이지 동시 렌더링 (pagePositions)
    └── SkiaOverlay
        └── Overlay Layer
            ├── AI 이펙트
            ├── 페이지 타이틀 + 요소 수 뱃지 ("24 elements")
            ├── 워크플로우 엣지 (navigation, event)
            ├── 데이터 바인딩 엣지, 레이아웃 그룹
            ├── 인터랙티브 호버/클릭
            ├── 미니맵
            └── 셀렉션 오버레이
```

### 2.2 레이어 렌더링 순서

```
renderer.setOverlayNode({
  renderSkia(canvas, bounds) {
    // 1. AI 이펙트 (가장 아래)
    renderGeneratingEffects(...)
    renderFlashes(...)

    // 2. 페이지 타이틀
    renderPageTitle(...)

    // 3. 워크플로우 엣지 (Phase 1~2)
    if (showWorkflowOverlay) {
      renderWorkflowEdges(...)          // Phase 1: navigation + event
      renderDataBindingEdges(...)       // Phase 2: data source 연결
      renderLayoutGroupOverlay(...)     // Phase 2: 레이아웃 그룹 표시
    }

    // 4. 셀렉션 오버레이 (가장 위)
    renderSelectionBox(...)
    renderTransformHandles(...)
  }
})
```

---

## 3. 구현 계획

### Phase 1: 기본 엣지 오버레이 (구현 완료 ✓)

**범위**: Navigation + Event-navigation 엣지를 CanvasKit으로 렌더링

#### 구현 파일

| 파일                                                                 | 변경 | 역할                                                              |
| -------------------------------------------------------------------- | ---- | ----------------------------------------------------------------- |
| `apps/builder/src/builder/workspace/canvas/skia/workflowEdges.ts`    | 신규 | Element에서 페이지 간 연결 추출                                   |
| `apps/builder/src/builder/workspace/canvas/skia/workflowRenderer.ts` | 신규 | Bezier 커브 + 화살표 CanvasKit 렌더링                             |
| `apps/builder/src/builder/workspace/canvas/skia/SkiaOverlay.tsx`     | 수정 | 워크플로우 렌더링 파이프라인 통합                                 |
| `apps/builder/src/builder/stores/canvasSettings.ts`                  | 수정 | `showWorkflowOverlay` 및 세부 토글 상태 추가                      |
| `apps/builder/src/builder/main/BuilderHeader.tsx`                    | 수정 | GitBranch 버튼 → 오버레이 토글 (서브 토글 Popover 제거됨)         |
| `apps/builder/src/builder/main/BuilderCore.tsx`                      | 수정 | `viewMode` 전환 제거 후 캔버스 상시 표시 (서브 토글 props 제거됨) |

#### 목표 데이터 흐름

```
Store (pages, elements)
    ↓ registryVersion 변경 감지
computeWorkflowEdges(pages, elements)
    ├── extractNavigationLinks(): Link/a/Button href → slug 매칭
    └── extractEventNavigations(): event.actions[].navigate → slug 매칭
    ↓
WorkflowEdge[] (캐시됨, workflowEdgesRef)
    ↓ showWorkflowOverlay === true
renderWorkflowEdges(ck, canvas, edges, pageFrameMap, zoom)
    ├── computeEndpoints(): 최단 경로 앵커 (상/하/좌/우)
    ├── cubicTo(): Bezier 커브
    ├── drawArrowHead(): 방향 화살표
    └── drawText(): 레이블 (선택적)
```

#### 목표 엣지 스타일

| 타입               | 색상                 | 스타일            | 레이블      |
| ------------------ | -------------------- | ----------------- | ----------- |
| `navigation`       | blue-500 (#3b82f6)   | Solid, 2px        | "Link"      |
| `event-navigation` | purple-500 (#a855f7) | Dashed [6,4], 2px | 이벤트 타입 |

#### 목표 앵커 포인트 계산

```
페이지 A가 페이지 B의 왼쪽에 있을 때:
  A의 오른쪽 중앙 → B의 왼쪽 중앙

페이지 A가 페이지 B의 위에 있을 때:
  A의 하단 중앙 → B의 상단 중앙

→ Math.abs(dx) > Math.abs(dy) 판별로 수평/수직 자동 결정
```

#### 목표 성능 특성

- **엣지 계산**: O(pages × elements) — registryVersion 변경 시에만 실행
- **렌더링**: O(edges) — overlay layer의 일부, `present` 프레임 타입
- **메모리**: workflowEdgesRef에 캐시, 매 프레임 재계산하지 않음
- **프레임 비용**: 토글 변경 시 ~1-2ms (present 프레임)

---

### Phase 2: 데이터 바인딩 & 레이아웃 (구현 완료 ✓)

**범위**: Data Source 연결, Layout 그룹 시각화

#### 2.1 데이터 바인딩 엣지

기존 `workflowStore.ts`의 `extractDataSources()` 로직을 재사용하여:

```typescript
// workflowEdges.ts 확장
export interface DataSourceEdge {
  dataSourceId: string;
  dataSourceName: string;
  sourceType: "dataTable" | "api" | "supabase" | "mock";
  targetPageIds: string[];
}

export function computeDataSourceEdges(
  elements: Element[],
  pages: Page[],
): DataSourceEdge[];
```

**렌더링 스타일**:
| 타입 | 색상 | 스타일 |
|------|------|--------|
| `dataTable` | green-500 (#22c55e) | Dotted [3,3] |
| `api` | amber-500 (#f59e0b) | Dotted [3,3] |
| `supabase` | emerald-500 (#10b981) | Dotted [3,3] |
| `mock` | gray-400 (#9ca3af) | Dotted [3,3] |

**Data Source 노드 렌더링**:

- 페이지 프레임 상단에 작은 아이콘+레이블로 데이터 소스 표시
- 해당 페이지까지 dotted 커브로 연결

#### 2.2 레이아웃 그룹 시각화

같은 Layout을 사용하는 페이지들을 시각적으로 그룹화:

```typescript
// workflowRenderer.ts 확장
export function renderLayoutGroups(
  ck: CanvasKit,
  canvas: Canvas,
  layoutGroups: Map<string, string[]>, // layoutId → pageIds
  pageFrameMap: Map<string, PageFrame>,
  zoom: number,
): void;
```

**렌더링**:

- 같은 Layout을 사용하는 페이지들 주위에 둥근 점선 사각형
- 상단에 Layout 이름 레이블
- 반투명 배경 (secondary color, opacity 0.05)

#### 2.3 토글 컨트롤

```typescript
// canvasSettings.ts 확장
interface SettingsState {
  showWorkflowOverlay: boolean;
  // Phase 2 추가
  showWorkflowNavigation: boolean; // navigation 엣지
  showWorkflowEvents: boolean; // event-navigation 엣지
  showWorkflowDataSources: boolean; // data source 연결
  showWorkflowLayoutGroups: boolean; // layout 그룹
}
```

**UI**: Workspace 캔버스 상단에 `WorkflowCanvasToggles` 컴포넌트 단일 진입점 (오버레이 활성 시 표시, 레전드 아이콘 통합)

- 위치: `apps/builder/src/builder/workspace/Workspace.tsx`
- React-Aria Checkbox × 4 (엣지 스타일 아이콘 + Navigation, Events, Data Sources, Layout Groups)
- 스타일: `apps/builder/src/builder/workspace/Workspace.css` (`.workflow-canvas-toggles`)
- `BuilderHeader`의 중복 서브 토글 Popover(ChevronDown + Dialog) 제거됨 — `WorkflowSubToggles` 인터페이스 및 관련 props 삭제

---

### Phase 3: 인터랙티브 기능 (구현 완료 ✓)

**범위**: 호버, 클릭, 하이라이트 상호작용

#### 3.1 엣지 호버 하이라이트

```
PixiJS 이벤트 레이어에서 마우스 위치 감지
    ↓
Scene-local 좌표로 변환
    ↓
각 엣지의 Bezier 커브와 거리 계산 (point-to-curve distance)
    ↓
가장 가까운 엣지 하이라이트 (strokeWidth 증가 + opacity 증가)
    ↓
연결된 source/target 페이지 프레임 하이라이트 (직각 테두리 + 반투명 배경)
```

**구현 방향**:

- PixiJS의 `pointermove` 이벤트에서 좌표 추출
- 엣지 히트 테스트: Bezier 커브의 sample points와 마우스 거리 비교
- 히트 거리 임계값: `10 / zoom` (screen-space 10px)

#### 3.2 페이지 클릭 네비게이션

현재 `WORKFLOW_SELECT_PAGE` postMessage를 대체:

```typescript
// 워크플로우 오버레이 활성 상태에서 페이지 프레임 클릭 시
// → 해당 페이지로 포커스 이동 (camera pan + zoom)
// → currentPageId 설정 (좌측 Pages 트리 선택 동기화)
// → 연결된 엣지 하이라이트
```

**양방향 동기화**:

- **캔버스 → 트리**: 워크플로우 오버레이에서 페이지 클릭 시 `setCurrentPageId()` 호출 → 좌측 Pages 트리 선택 상태 동기화
- **트리 → 캔버스**: 좌측 Pages 트리에서 페이지 선택 시 `panToPage()` 호출 → 카메라가 해당 페이지 중앙으로 300ms ease-out 애니메이션 이동
- **`panToPage()`**: React 훅 비의존 순수 함수로 추출 (`viewport/panToPage.ts`), store 직접 접근으로 트리/캔버스 양쪽에서 재사용

**애니메이션 최적화**:

- `handlePageSelect` 호출 순서: `panToPage()` → `setCurrentPageId()` → `fetchElements()` (RAF 스케줄을 상태 업데이트보다 먼저 등록하여 첫 프레임 지연 방지)
- `fetchElements()` 내부의 중복 `setCurrentPageId()` 호출 제거 — 모든 호출 경로에서 외부에서 이미 처리

#### 3.3 연결 경로 하이라이트

특정 페이지 선택 시 연결 경로를 시각적으로 강조:

```
Page A 선택
    ↓
A → B (navigation)     → 밝은 파란색, 굵은 선
A → C (event)          → 밝은 보라색, 굵은 선
B → D (navigation)     → 연한 파란색 (2차 연결)
나머지 엣지             → 매우 연하게 (opacity 0.15)
연결된 페이지 프레임     → 직각 테두리 + 반투명 배경 (페이지 프레임과 형태 일치)
```

---

### Phase 4: 고급 UI 기능 (구현 완료 ✓)

**범위**: 미니맵, 페이지 타이틀 요소 수 뱃지, 토글+레전드 통합

#### 4.1 워크플로우 미니맵

```
┌─────────────┐
│ ■ ■ ■ ■     │  ← 페이지 프레임 축소 표시
│  ╲╱ ╲╱      │  ← 엣지 연결
│ ■ ■ ■       │
│   [카메라]    │  ← 현재 뷰포트 영역
└─────────────┘
```

- SkiaOverlay의 별도 렌더 패스로 구현
- 화면 우하단에 고정 위치 (screen-space), 여백 16px (right/bottom 동일)
- 미니맵 클릭으로 카메라 이동
- **자동 표시/숨김**: 캔버스 이동(pan/zoom) 시에만 표시, 1.5초 비활동 후 자동 숨김 (CanvasScrollbar와 동일 패턴)
- **동적 크기**: 캔버스 크기의 10% 비례 (width: 80~200px, height: 60~140px clamp)
- inspector 패널 열림 시 패널 너비만큼 좌측으로 위치 보정

#### 4.2 토글 + 레전드 통합

기존 좌하단 `WorkflowLegend` 패널을 제거하고, 상단 `WorkflowCanvasToggles` 체크박스에 엣지 스타일 아이콘을 통합:

```
[✓ ━━━ Navigation] [✓ ┅┅┅ Events] [✓ ··· Data Sources] [✓ ┌┄┐ Layout Groups] | [✓ Straight]
```

- 각 체크박스 레이블 앞에 해당 엣지 스타일의 SVG 아이콘 표시
- 토글 ON/OFF와 범례가 한 곳에서 해결
- 아이콘+텍스트를 `<span className="workflow-toggle-label">` (inline-flex, align-items: center)로 감싸 세로 중앙 정렬
- `.workflow-toggle-label svg { width: auto; height: auto }` — shared Checkbox의 `.sm svg` 크기 override 방지
- **Straight 토글**: 구분자(`workflow-toggle-divider`) 뒤에 배치, 엣지를 Bezier 곡선 ↔ 직선으로 전환
  - `workflowStraightEdges` store 상태 (기본값: false = Bezier)
  - 렌더링: `path.cubicTo()` ↔ `path.lineTo()` 조건부 분기
  - 히트 테스트: Bezier 20-point 샘플링 ↔ 직선 2-point (기존 `pointToBezierDistance` 재사용)
  - 화살표 각도: 끝 제어점 기준 ↔ 직선 방향 기준
  - 미니맵은 항상 직선 (`drawLine`) — 토글 영향 없음

#### 4.3 페이지 타이틀 요소 수 뱃지

기존 `WorkflowPageSummary` 우상단 패널은 캔버스 오버레이와 정보가 중복되어 제거.
요소 수만 페이지 타이틀 옆에 뱃지로 표시:

```
Home Page  24 elements
```

- `renderPageTitle()`에서 타이틀 텍스트 오른쪽에 렌더링
- 폰트: Pretendard Normal 10px, slate-400 (#94a3b8), opacity 0.6
- 타이틀과 뱃지 사이 간격: 6px
- 줌 불변: 기존 타이틀과 동일하게 `canvas.scale(1/zoom)` 적용

---

## 4. 마이그레이션 전략

### 4.1 단계적 접근

```
현재(ReactFlow)                  Phase 1                        Phase 2~4
┌─────────────────┐    ┌─────────────────────────┐    ┌──────────────────────┐
│ workflow 화면 전환 │    │ 기본 엣지 오버레이       │    │ 데이터/인터랙션/UI    │
│ BuilderWorkflow  │ → │ navigation edge         │ → │ data/layout edges     │
│ @xyflow/react    │    │ event edge              │    │ hover/click/minimap   │
│ 별도 카메라        │    │ 오버레이 토글            │    │ legend/summary panel  │
└─────────────────┘    └─────────────────────────┘    └──────────────────────┘

완료 후 목표 상태
┌─────────────────┐    ┌─────────────────────────┐    ┌──────────────────────┐
│ 기본 엣지        │    │ 데이터+레이아웃 연결     │    │ 인터랙션+고급 UI     │
│ navigation edge  │ → │ data source edges       │ → │ hover highlight      │
│ event edge       │    │ layout group overlay    │    │ click navigation     │
│ 토글 버튼        │    │ 캔버스 상단 토글+레전드  │    │ minimap, 요소수 뱃지 │
└─────────────────┘    └─────────────────────────┘    └──────────────────────┘
```

### 4.2 기존 Workflow 코드 처리 (완료)

| 대상                                                | 상태      | 비고                                                       |
| --------------------------------------------------- | --------- | ---------------------------------------------------------- |
| `apps/builder/src/workflow/` 전체 디렉토리          | 삭제 완료 | 14개 파일 (types, store, components, nodes, utils, styles) |
| `apps/builder/src/builder/main/BuilderWorkflow.tsx` | 삭제 완료 | bridge 컴포넌트                                            |
| `BuilderCore.tsx` viewMode 전환                     | 제거 완료 | 캔버스 항상 표시                                           |
| `canvasSettings.ts` viewMode 상태                   | 제거 완료 | `showWorkflowOverlay` 토글로 대체                          |
| `@dagrejs/dagre` 의존성                             | 제거 완료 | DAG 자동 레이아웃 불필요                                   |
| `@xyflow/react` 의존성                              | 제거 완료 | events 패널 데드 코드 정리 시 함께 제거                    |

### 4.3 제거된 파일 목록

```
apps/builder/src/workflow/           # 전체 디렉토리 (삭제 완료)
├── types/index.ts
├── store/workflowStore.ts
├── store/index.ts
├── components/WorkflowCanvas.tsx
├── components/WorkflowToolbar.tsx
├── components/index.ts
├── nodes/PageNode.tsx
├── nodes/LayoutNode.tsx
├── nodes/DataSourceNode.tsx
├── nodes/index.ts
├── utils/autoLayout.ts
├── utils/index.ts
└── styles/workflow.css

apps/builder/src/builder/main/BuilderWorkflow.tsx  # bridge 컴포넌트 (삭제 완료)
```

**실제 절감**:

- 코드: ~2,000줄 삭제
- CSS: ~500줄 삭제
- 번들: `@dagrejs/dagre` 제거로 ~15KB gzip 감소

---

## 5. 기술 상세

### 5.1 워크플로우 엣지 계산 (`workflowEdges.ts`)

#### Navigation Link 감지

```typescript
// Element의 props에서 내부 링크 추출
// 대상 태그: Link, a, Button (case-insensitive)
// 대상 속성: href, to, path, url, link.href
// 필터: http로 시작하면 외부 링크 → 스킵
//       #으로 시작하면 앵커 → 스킵

const href =
  props.href || props.to || props.path || props.url || props.link?.href;
if (
  isNavigableTag &&
  href &&
  !href.startsWith("http") &&
  !href.startsWith("#")
) {
  const cleanHref = normalizeSlug(href);
  const targetPageId = slugMap.get(cleanHref);
  if (targetPageId && targetPageId !== pageId) links.push(targetPageId);
}
```

#### Event Navigate 감지

```typescript
// Element의 events[].actions[].type === 'navigate' 탐지
// 경로 추출: config.path/href/to/url 또는 value.path/href/to/url
// 두 가지 형식 지원:
//   1. Block Editor: action.config.path
//   2. Legacy: action.value.path

for (const action of event.actions) {
  if (action.type !== 'navigate' || action.enabled === false) continue;
  const path = action.config?.path || action.value?.path || ...;
  // slug 정규화 후 pageId 매칭
}
```

#### Slug 정규화

```typescript
// "/home?q=1#section" → "home"
// "/about/"          → "about"
// "contact"          → "contact"
function normalizeSlug(slug?: string | null): string {
  if (!slug) return "";
  return slug.split(/[?#]/)[0].replace(/^\/+/, "").replace(/\/+$/, "");
}
```

### 5.2 CanvasKit 렌더링 (`workflowRenderer.ts`)

#### Bezier 커브 계산

```
Source Page             Target Page
┌──────┐               ┌──────┐
│      │→ sx,sy ~~~→ ~~~→ ex,ey │
│      │    ╲         ╱   │      │
│      │     CP1    CP2   │      │
└──────┘               └──────┘

Control Point 계산 (수평 연결 시):
  cpx1 = sx + dist * 0.4    (source에서 40% 거리)
  cpy1 = sy                  (수평 유지)
  cpx2 = ex - dist * 0.4    (target에서 40% 거리)
  cpy2 = ey                  (수평 유지)

Canvas API:
  path.moveTo(sx, sy)
  path.cubicTo(cpx1, cpy1, cpx2, cpy2, ex, ey)
```

#### 화살표 머리

```
    ex, ey (끝점)
      ╱╲
     ╱  ╲
    ╱    ╲      angle = atan2(ey - cpy2, ex - cpx2)
   ╱──────╲     size = ARROW_SIZE / zoom (screen-space 8px)
  P1      P2

  P1 = (ex + size*cos(angle + 0.8π), ey + size*sin(angle + 0.8π))
  P2 = (ex + size*cos(angle - 0.8π), ey + size*sin(angle - 0.8π))
```

#### Screen-Space Invariant

```typescript
// 모든 크기를 zoom으로 나누어 화면상 일정 크기 유지
const sw = EDGE_STROKE_WIDTH / zoom; // 2px → 항상 화면상 2px
const arrowSize = ARROW_SIZE / zoom; // 8px → 항상 화면상 8px
const fontSize = LABEL_FONT_SIZE / zoom; // 10px → 항상 화면상 10px
const dashLen = 6 / zoom; // dash 패턴도 일정
```

### 5.3 SkiaOverlay 통합

#### 변경 감지 흐름

```
매 프레임 (renderFrame ticker, priority -50):
    ↓
showWorkflowOverlay 토글 감지
    → overlayVersionRef++ (present 프레임 트리거)
    ↓
registryVersion 변경 감지 (요소 추가/삭제/수정)
    → computeWorkflowEdges() 재실행
    → workflowEdgesRef.current 갱신
    → overlayVersionRef++ (present 프레임 트리거)
    ↓
SkiaRenderer.classifyFrame():
    overlayVersion만 변경 → 'present' (1-2ms)
    registryVersion 변경 → 'content' (10-30ms, 콘텐츠 + 오버레이)
```

#### 캐시 전략

```typescript
// 매 프레임 재계산하지 않음
const workflowEdgesRef = useRef<WorkflowEdge[]>([]);
const workflowEdgesVersionRef = useRef(-1); // registryVersion 기반 캐시 키

// registryVersion이 변경될 때만 재계산
if (showWorkflow && registryVersion !== workflowEdgesVersionRef.current) {
  workflowEdgesRef.current = computeWorkflowEdges(allPages, allElements);
  workflowEdgesVersionRef.current = registryVersion;
}
```

---

## 6. 비교 분석

### 6.1 기존 vs 목표 아키텍처

| 항목              | 기존 (@xyflow/react)        | 목표 (CanvasKit 오버레이) |
| ----------------- | --------------------------- | ------------------------- |
| **렌더링 엔진**   | DOM (React 노드)            | WebGL (CanvasKit)         |
| **전환 방식**     | 화면 전환 (언마운트/마운트) | 오버레이 토글 (즉시)      |
| **페이지 표시**   | 작은 노드 아이콘            | 실제 디자인 + 연결선      |
| **카메라**        | 별도 ReactFlow 카메라       | 기존 WebGL 카메라 공유    |
| **번들 크기**     | +~60KB (xyflow + dagre)     | +~500줄 (~3KB)            |
| **프레임 비용**   | N/A (DOM)                   | ~1-2ms (present 프레임)   |
| **데이터 동기화** | 3개 useEffect 브리지        | 직접 store 접근           |

### 6.2 성능 비교 (추정치, 벤치마크 미실시)

> **주의**: 아래 수치는 CanvasKit 오버레이 패턴(aiEffects, selectionRenderer)의 실측 데이터를 기반으로 한 추정값입니다.
> Phase 1 구현 후 실측 벤치마크로 검증이 필요합니다.

| 시나리오  | 기존                                   | 새 (추정)                 | 검증 방법                 |
| --------- | -------------------------------------- | ------------------------- | ------------------------- |
| 토글 ON   | ~200ms (DOM 마운트 + ReactFlow 초기화) | ~1ms (overlayVersion++)   | `performance.mark()` 측정 |
| 토글 OFF  | ~100ms (DOM 언마운트)                  | ~0.1ms (idle 프레임)      | 프레임 분류 로그 확인     |
| Pan/Zoom  | ReactFlow 자체 처리                    | 기존 카메라 그대로        | FPS 모니터링              |
| 요소 변경 | useEffect 동기화 대기                  | 즉시 registryVersion 감지 | 이벤트 타임스탬프 비교    |

---

## 7. 리스크 분석

### 7.1 기술 리스크

| ID  | 리스크                                                                                                           | 영향 | 발생 확률 | 완화 방안                                                                                                  |
| --- | ---------------------------------------------------------------------------------------------------------------- | ---- | --------- | ---------------------------------------------------------------------------------------------------------- |
| R1  | **CanvasKit 폰트 로딩 지연** — 폰트 매니저(FontMgr) 초기화 전 레이블 렌더링 시도 시 빈 텍스트 또는 크래시        | 높음 | 중간      | 폰트 로딩 완료까지 레이블 렌더링 스킵, `fontMgr` null 체크 가드 추가                                       |
| R2  | **대규모 엣지 렌더링 성능** — 페이지 50+, 엣지 200+ 시 present 프레임이 1-2ms 초과 가능                          | 중간 | 낮음      | 뷰포트 밖 엣지 frustum culling, 줌 레벨별 LOD(Level of Detail) 적용                                        |
| R3  | **PixiJS 이벤트 충돌 (Phase 3)** — 워크플로우 엣지 클릭 vs 요소 선택 클릭이 같은 PixiJS EventBoundary에서 경합   | 높음 | 높음      | 워크플로우 오버레이 활성 시 이벤트 모드 분리: `workflowHitTest` 우선 → miss 시 기존 요소 선택으로 fallback |
| R4  | **Bezier 히트 테스트 정밀도 vs 성능 (Phase 3)** — sample point 수가 적으면 miss, 많으면 매 프레임 계산 비용 증가 | 중간 | 중간      | 엣지당 20개 sample point로 시작, 프로파일링 후 조정. 공간 분할(grid hash)로 O(n) → O(1) 근사               |
| R5  | **GPU 리소스 누수** — CanvasKit Paint/Path 객체의 `delete()` 누락 시 메모리 증가                                 | 높음 | 중간      | 기존 `SkiaDisposable` 패턴 준수, `finally` 블록에서 반드시 `scope.dispose()` 호출                          |
| R6  | **기존 ReactFlow 코드와의 공존 기간** — Phase 1~2 동안 두 시스템이 동시에 존재하여 유지보수 부담 증가            | 낮음 | 확실      | Phase별 제거 기준을 명확히 하고, 기존 코드는 수정하지 않고 freeze 상태 유지                                |

### 7.2 Phase 간 의존성 리스크

```
Phase 1 (기본 엣지)
    ↓ 실패 시: 기존 ReactFlow fallback 유지, 영향 없음
Phase 2 (데이터/레이아웃)
    ↓ 실패 시: Phase 1만 운영, 데이터 바인딩은 기존 방식 유지
Phase 3 (인터랙티브) ← R3, R4 집중 발생 구간
    ↓ 실패 시: Phase 2까지만 운영 (오버레이는 읽기 전용)
Phase 4 (고급 UI)
    ↓ 실패 시: Phase 3까지만 운영, 미니맵/레전드 미제공
```

**핵심**: Phase 3이 가장 리스크가 높은 구간. PixiJS 이벤트 시스템과의 통합이 기술적 난이도가 가장 높으므로, Phase 3 착수 전에 이벤트 분리 방안의 PoC(Proof of Concept)를 먼저 진행할 것을 권장.

### 7.3 완화되는 리스크

| 항목             | 설명                                                                                |
| ---------------- | ----------------------------------------------------------------------------------- |
| 단계적 rollback  | 각 Phase가 독립적이므로 실패 시 이전 Phase로 fallback 가능                          |
| 기존 패턴 재사용 | `selectionRenderer.ts`, `aiEffects.ts`의 검증된 CanvasKit 렌더링 패턴을 그대로 사용 |
| 오버레이 격리    | 워크플로우 렌더링이 content layer에 영향을 주지 않음 (overlay layer 한정)           |

---

## 8. 테스트 전략

### 8.1 테스트 레벨별 계획

#### Unit Tests

| 대상                                 | 테스트 항목                                                                          | 도구   |
| ------------------------------------ | ------------------------------------------------------------------------------------ | ------ |
| `computeWorkflowEdges()`             | navigation link 추출 정확도, event-navigation 추출, 외부 링크 필터링, 앵커 링크 스킵 | Vitest |
| `normalizeSlug()`                    | 쿼리 파라미터 제거, 슬래시 정규화, null/undefined 처리                               | Vitest |
| `computeEndpoints()`                 | 수평/수직 방향 판별, 앵커 포인트 좌표 계산                                           | Vitest |
| `computeDataSourceEdges()` (Phase 2) | 데이터 소스 타입별 추출, 중복 제거                                                   | Vitest |

```typescript
// 예시: workflowEdges.test.ts
describe("computeWorkflowEdges", () => {
  it('Link href="/about"을 navigation 엣지로 추출한다', () => {
    const pages = [mockPage("home", "/home"), mockPage("about", "/about")];
    const elements = [
      mockElement("home", { tag: "Link", props: { href: "/about" } }),
    ];
    const edges = computeWorkflowEdges(pages, elements);
    expect(edges).toEqual([
      { type: "navigation", sourcePageId: "home", targetPageId: "about" },
    ]);
  });

  it("http로 시작하는 외부 링크는 무시한다", () => {
    const elements = [
      mockElement("home", { tag: "a", props: { href: "https://google.com" } }),
    ];
    const edges = computeWorkflowEdges(pages, elements);
    expect(edges).toHaveLength(0);
  });

  it("event navigate action에서 경로를 추출한다", () => {
    const elements = [
      mockElement("home", {
        events: [
          { actions: [{ type: "navigate", config: { path: "/contact" } }] },
        ],
      }),
    ];
    const edges = computeWorkflowEdges(pages, elements);
    expect(edges[0].type).toBe("event-navigation");
  });
});
```

#### Integration Tests

| 대상          | 테스트 항목                                              | 도구                       |
| ------------- | -------------------------------------------------------- | -------------------------- |
| 오버레이 토글 | `showWorkflowOverlay` 토글 시 `overlayVersion` 증가 확인 | Vitest + store mock        |
| 캐시 무효화   | `registryVersion` 변경 → 엣지 재계산 트리거 확인         | Vitest + store mock        |
| 프레임 분류   | 오버레이만 변경 시 `present` 프레임 타입 반환 확인       | Vitest + SkiaRenderer mock |

#### Visual Regression Tests

| 대상          | 테스트 항목                                                            | 도구                       |
| ------------- | ---------------------------------------------------------------------- | -------------------------- |
| 엣지 렌더링   | 2~3개 페이지 간 navigation 엣지가 올바른 위치에 그려지는지 스냅샷 비교 | Playwright + 스크린샷 비교 |
| 화살표 방향   | 수평/수직 연결 시 화살표 방향이 올바른지 확인                          | Playwright                 |
| 줌 불변성     | 줌 50%, 100%, 200%에서 선 두께/화살표 크기가 화면상 일정한지 확인      | Playwright                 |
| 스타일 일관성 | navigation(실선 파란색) vs event(점선 보라색) 구분 확인                | Playwright                 |

#### Performance Tests

| 대상           | 측정 항목                                              | 기준값     | 도구                               |
| -------------- | ------------------------------------------------------ | ---------- | ---------------------------------- |
| 토글 ON 지연   | `showWorkflowOverlay` 토글 → 다음 프레임 완료까지      | < 5ms      | `performance.mark/measure`         |
| 엣지 계산 시간 | `computeWorkflowEdges()` 실행 시간 (50페이지, 200엣지) | < 10ms     | `performance.now()`                |
| 프레임 드롭    | 워크플로우 오버레이 ON 상태에서 pan/zoom 시 FPS        | 60fps 유지 | `requestAnimationFrame` FPS 카운터 |
| 메모리         | 오버레이 ON/OFF 반복 100회 후 힙 크기 변화             | 증가 < 1MB | Chrome DevTools Heap Snapshot      |

### 8.2 Phase별 테스트 범위

| Phase                  | Unit                                                        | Integration                           | Visual                             | Performance              |
| ---------------------- | ----------------------------------------------------------- | ------------------------------------- | ---------------------------------- | ------------------------ |
| **1: 기본 엣지**       | `computeWorkflowEdges`, `normalizeSlug`, `computeEndpoints` | 토글 + 캐시                           | 엣지 스냅샷 (2~3 케이스)           | 토글 지연, FPS           |
| **2: 데이터/레이아웃** | `computeDataSourceEdges`, 레이아웃 그룹 계산                | 세부 토글 조합                        | 데이터 엣지 + 레이아웃 그룹 스냅샷 | 엣지 50+ 렌더링          |
| **3: 인터랙티브**      | Bezier 히트 테스트, 이벤트 모드 분리                        | 클릭 → 카메라 이동, 호버 → 하이라이트 | 하이라이트 스냅샷                  | 히트 테스트 < 1ms/프레임 |
| **4: 고급 UI**         | 미니맵 좌표 변환, 레전드 필터                               | 미니맵 클릭 → 카메라 동기화           | 미니맵 + 레전드 스냅샷             | 미니맵 렌더링 < 2ms      |

### 8.3 테스트 인프라

```
tests/
├── unit/
│   └── workflow/
│       ├── workflowEdges.test.ts      # 엣지 계산 로직
│       ├── normalizeSlug.test.ts      # slug 정규화
│       └── computeEndpoints.test.ts   # 앵커 포인트 계산
├── integration/
│   └── workflow/
│       ├── overlayToggle.test.ts      # 오버레이 토글 + 프레임 분류
│       └── cacheInvalidation.test.ts  # 캐시 무효화
└── e2e/
    └── workflow/
        ├── edgeRendering.spec.ts      # 시각적 회귀 (Playwright)
        └── performance.spec.ts        # 성능 벤치마크
```

---

## 9. 참조

### 관련 ADR

- [ADR-003: Canvas Rendering](../adr/completed/003-canvas-rendering.md) - CanvasKit/Skia 선택 이유
- [ADR-001: State Management](../adr/completed/001-state-management.md) - Zustand 슬라이스 패턴

### 관련 파일

#### 기존 인프라

- `apps/builder/src/builder/workspace/canvas/skia/SkiaOverlay.tsx` — 오버레이 파이프라인
- `apps/builder/src/builder/workspace/canvas/skia/SkiaRenderer.ts` — 프레임 분류/캐싱
- `apps/builder/src/builder/workspace/canvas/skia/selectionRenderer.ts` — 렌더러 패턴 참조
- `apps/builder/src/builder/workspace/canvas/skia/aiEffects.ts` — 렌더러 패턴 참조
- `apps/builder/src/builder/stores/canvasSettings.ts` — 워크플로우 오버레이 상태

#### CanvasKit 워크플로우 구현 파일

- `apps/builder/src/builder/workspace/canvas/skia/workflowEdges.ts` — 엣지 계산 (Phase 1)
- `apps/builder/src/builder/workspace/canvas/skia/workflowRenderer.ts` — 엣지 렌더링 (Phase 1~2)
- `apps/builder/src/builder/workspace/canvas/skia/workflowHitTest.ts` — 엣지/노드 히트 테스트 (Phase 3)
- `apps/builder/src/builder/workspace/canvas/skia/workflowGraphUtils.ts` — 그래프 유틸리티 (Phase 1~2)
- `apps/builder/src/builder/workspace/canvas/skia/workflowMinimap.ts` — 미니맵 렌더링 + 동적 크기 상수 (Phase 4)
- `apps/builder/src/builder/workspace/canvas/hooks/useWorkflowInteraction.ts` — 인터랙션 훅 (Phase 3)
- `apps/builder/src/builder/workspace/canvas/viewport/panToPage.ts` — 페이지 중앙 카메라 이동 유틸 (Phase 3, 트리/캔버스 양쪽 재사용)
- ~~`apps/builder/src/builder/workspace/components/WorkflowLegend.tsx`~~ — 삭제됨 (레전드 아이콘을 `WorkflowCanvasToggles`에 통합)
- ~~`apps/builder/src/builder/workspace/components/WorkflowPageSummary.tsx`~~ — 삭제됨 (요소 수 뱃지로 대체, `selectionRenderer.ts`의 `renderPageTitle`에 통합)

---

## 10. 업데이트 내역

### 2025-02-11: Orthogonal Edge 고도화 (@xyflow/react 대비 개선)

#### 비교 분석 결과

@xyflow/react의 step/smoothstep 엣지와 비교하여 기능 동등성을 확보.

| 기능                       | @xyflow/react             | composition                                 | 상태      |
| -------------------------- | ------------------------- | ------------------------------------------- | --------- |
| 꺾임점 위치 (stepPosition) | 고정 비율 0~1 (기본 0.5)  | 동적 갭 중앙 (`computeOrthogonalTurnPoint`) | **우위**  |
| 라우팅 방향 자동 판별      | Handle position 수동 지정 | 페이지 프레임 센터 기반 자동                | 동등      |
| 중간 노드 충돌 회피        | 미지원 (알려진 한계)      | 미지원                                      | 동일 한계 |
| 둥근 모서리 (borderRadius) | smoothstep 기본 5px       | `arcToTangent` 8px                          | **동등**  |
| 실시간 업데이트            | 노드 이동 시 재계산       | 페이지 드래그 시 재계산                     | 동등      |
| 호버/클릭 인터랙션         | DOM 이벤트                | Bezier 샘플링 히트테스트                    | 동등      |

#### 변경 사항

**1. SmoothStep 둥근 모서리** (`workflowRenderer.ts`)

Orthogonal 엣지의 꺾임점에 `path.arcToTangent()`를 적용하여 부드러운 직각 전환.

```
변경 전 (step):       변경 후 (smoothstep):
    │                     │
    └────              ╰────
```

- 상수: `ORTHO_BORDER_RADIUS = 8` (screen px)
- 반지름은 `Math.min(8/zoom, 수평거리/2, 수직거리/2)`로 clamp하여 좁은 간격에서도 안전
- 수평/수직 양방향 모두 적용
- 히트테스트 변경 불필요 (8px radius < hit threshold)

**2. 소스 엔드포인트 도트** (`workflowRenderer.ts`)

엣지 시작점에 지름 6px 원 마커 추가 (다른 workflow 라이브러리의 소스 표시 관례).

- 스타일: white fill (#ffffff) + edge color stroke (1.2px)
- `canvas.drawCircle(sx, sy, 3 / zoom, ...)` — fill/stroke 분리 렌더링
- zoom-invariant (screen-space 6px 고정)

**3. 엣지 stroke width 조정** (`workflowRenderer.ts`)

시각적 경량화를 위해 기본 선 두께를 축소.

| 상태        | 변경 전 | 변경 후 |
| ----------- | ------- | ------- |
| 기본        | 2px     | **1px** |
| 마우스오버  | 4px     | **2px** |
| 직접 연결   | 3px     | **2px** |
| 간접 연결   | 2px     | **1px** |
| 비관련 엣지 | 2px     | **1px** |

#### 변경 파일

| 파일                  | 변경 내용                                                                          |
| --------------------- | ---------------------------------------------------------------------------------- |
| `workflowRenderer.ts` | `EDGE_STROKE_WIDTH` 2→1, hover/direct 4/3→2/2, `arcToTangent` 삽입, 소스 도트 추가 |
| `workflowHitTest.ts`  | 변경 없음 (직선 근사 유지)                                                         |

**4. 미니맵 viewport 가시성 개선** (`workflowMinimap.ts`)

기존 미니맵은 현재 보고 있는 영역(viewport)을 반투명 파란색 fill(opacity 0.15)로 표시하여
줌 변경 시 viewport 크기 변화를 인지하기 어려웠음.

- 변경 전: viewport 영역에 반투명 파란색 fill → 거의 보이지 않음
- 변경 후: viewport **바깥 영역을 dim mask**(opacity 0.45)로 어둡게 처리
- 4개의 직사각형(상/하/좌/우)으로 viewport 외부를 커버
- viewport 테두리(blue, 1.5px)는 유지
- 줌인 시 밝은 영역이 축소, 줌아웃 시 확대 → 현재 뷰 위치를 직관적으로 파악 가능

| 파일                 | 변경 내용                                          |
| -------------------- | -------------------------------------------------- |
| `workflowMinimap.ts` | viewport fill 제거 → dim mask 4-rect 방식으로 교체 |

### 2025-02-11: 워크플로우 오버레이 FPS 최적화

#### 문제

워크플로우 오버레이 토글 ON 시 idle FPS가 ~50 → ~40으로 하락하고, 캔버스 이동 시 추가 하락.

#### 원인 분석

| 원인                                        | 영향도   | 설명                                                          |
| ------------------------------------------- | -------- | ------------------------------------------------------------- |
| `buildEdgeGeometryCache()` 매 프레임 실행   | **높음** | Bezier 샘플링 O(E×20) + ElementBounds Map 재할당              |
| Paint/Path GPU 객체 매 프레임 생성/해제     | **중간** | 엣지당 4~5개 Paint → ~150개+/프레임                           |
| pointermove 상시 RAF 스케줄                 | **중간** | subpixel jitter → `hitTestEdges()` 매 프레임 호출 → idle 불가 |
| `syncPixiVisibility` 매 프레임 alpha 재설정 | **낮음** | 이미 0인데 매 프레임 setter 호출                              |

#### 최적화 내용

**1. `buildEdgeGeometryCache` 버전 기반 캐싱** (`SkiaOverlay.tsx`)

`workflowEdgesVersion:pagePosVersion:straightEdges` 복합 키로 캐시 무효화 판단.
키가 동일하면 재계산 스킵 → 매 프레임 O(E×20) → 변경 시에만 실행.

```typescript
const cacheKey = `${workflowEdgesVersionRef.current}:${pagePosVersion}:${workflowStraightEdges}`;
if (cacheKey !== edgeGeometryCacheKeyRef.current) {
  edgeGeometryCacheRef.current = buildEdgeGeometryCache(...);
  edgeGeometryCacheKeyRef.current = cacheKey;
}
```

**2. 공유 Paint 객체 루프 밖 생성** (`workflowRenderer.ts`)

엣지 루프 안에서 매번 `new ck.Paint()`를 호출하던 것을 루프 밖으로 이동.
속성(color, strokeWidth, pathEffect)만 업데이트하여 재사용.

| 렌더러                  | 변경 전 (Paint/프레임) | 변경 후        |
| ----------------------- | ---------------------- | -------------- |
| `renderWorkflowEdges`   | 4E+1E (~100개, E=20)   | **5개** (고정) |
| `renderDataSourceEdges` | 3D+D (~16개, D=4)      | **4개** (고정) |

**3. pointermove 좌표 변화 체크** (`useWorkflowInteraction.ts`)

`lastMouseRef`로 이전 좌표 저장, `e.clientX === last.x && e.clientY === last.y`이면 즉시 return.
OS 수준 subpixel jitter에 의한 불필요한 RAF 스케줄 차단 → idle 프레임 분류 복원.

**4. `syncPixiVisibility` 중복 설정 방지** (`SkiaOverlay.tsx`)

`cameraContainer.alpha !== 0` 가드 추가 → 이미 0이면 매 프레임 setter 스킵.

#### 변경 파일

| 파일                        | 변경 내용                                                                            |
| --------------------------- | ------------------------------------------------------------------------------------ |
| `SkiaOverlay.tsx`           | `edgeGeometryCacheKeyRef` 추가, 버전 기반 캐싱 로직, `syncPixiVisibility` alpha 가드 |
| `workflowRenderer.ts`       | `renderWorkflowEdges` / `renderDataSourceEdges` Paint 공유 패턴 적용                 |
| `useWorkflowInteraction.ts` | `lastMouseRef` 추가, pointermove 좌표 변화 체크                                      |

### 2025-02-11: 엣지 기본 모드 변경

- `workflowStraightEdges` 기본값을 `false`(Bezier 곡선) → `true`(직각 orthogonal)로 변경
- 파일: `canvasSettings.ts`
