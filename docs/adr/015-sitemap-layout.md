# Sitemap(Hierarchy) 워크플로우 엣지 추가 계획

> **작성일**: 2026-02-13
> **수정일**: 2026-02-13 (v3 — 미니맵/인터랙션 동일 적용 범위 확정)
> **상태**: 계획 수립 (코드 미생성)
> **관련 브랜치**: `work`
> **검토 기준**: 현재 저장소 코드베이스(`apps/builder` 구조) 기준으로 경로/영향 범위를 재검증

---

## 0-1. 확정 결정 (2026-02-13)

1. hierarchy 엣지의 시각 규칙(색상/토글/레이어)은 본 캔버스와 미니맵에 **동일 적용**한다.
2. hierarchy 엣지가 숨김 상태일 때는 hover/클릭 대상에서도 제외한다(렌더/인터랙션 일치).
3. 워크플로우 토글 UI의 기준 위치는 `Workspace`의 `WorkflowCanvasToggles`로 고정한다.

---

## 0. 아키텍처 결정: 왜 Workflow인가

### 초기 접근 (v1) — `pageLayoutDirection`에 `"sitemap"` 추가

```
PageLayoutDirection = "horizontal" | "vertical" | "zigzag" | "sitemap"
```

### 문제점

| 문제                 | 설명                                                                             |
| -------------------- | -------------------------------------------------------------------------------- |
| **관심사 혼재**      | 3개는 물리적 배치 알고리즘, 1개만 의미적 관계 표현 → 부자연스러운 enum           |
| **상호 배타적 강제** | sitemap 선택 시 horizontal/vertical/zigzag 사용 불가                             |
| **조합 불가**        | "vertical 배치 + 계층 연결선" 등 동시 사용 불가                                  |
| **역할 불일치**      | `pageLayoutDirection`은 "어디에 놓을 것인가", sitemap은 "어떻게 연결되어 있는가" |

### 수정된 접근 (v2) — Workflow Overlay의 새 엣지 타입

```
WorkflowEdge.type (동일 인터페이스):
  navigation        → Link/Button href 기반     (blue-500, 실선)
  event-navigation  → 이벤트 핸들러 기반         (purple-500, 점선)

별도 인터페이스 (독립 렌더 파이프라인):
  DataSourceEdge    → 데이터 바인딩              (green/amber/emerald)
  LayoutGroup       → 레이아웃 그룹              (violet-400, 박스)

추가 (WorkflowEdge.type에 통합):
  hierarchy         → parent_id 기반             (teal-500, 실선) ← NEW
```

> **주의:** `DataSourceEdge`와 `LayoutGroup`은 `WorkflowEdge`와 **별도의 독립 인터페이스**로 구현되어 있다.
> hierarchy는 `WorkflowEdge.type` 유니온에 추가하여, 기존 navigation/event-navigation과 동일한 렌더 파이프라인을 재사용한다.

### 이점

| 이점                 | 설명                                                                                       |
| -------------------- | ------------------------------------------------------------------------------------------ |
| **직교적 조합**      | 어떤 배치 방향에서든 계층 연결선 표시 가능 (horizontal + hierarchy, zigzag + hierarchy 등) |
| **독립 토글**        | 기존 Navigation, Event, DataSource처럼 on/off 가능                                         |
| **기존 패턴 재사용** | 필터링, 하이라이트, 히트테스트, 미니맵 렌더 파이프라인 재사용                              |
| **최소 변경**        | 새 렌더러 불필요, 기존 `renderWorkflowEdges()` 그대로 재사용                               |
| **관심사 분리**      | Layout Direction = 물리적 배치, Workflow = 관계 시각화                                     |

---

## 1. Relume.io 분석

### 1.1 Relume Sitemap 핵심 특징

[Relume](https://www.relume.io/)의 Site Builder는 웹사이트 기획 단계에 특화된 AI 도구로, 사이트맵과 와이어프레임을 생성한다.

**시각적 구조:**

- **Top-Down 트리 구조**: Home 페이지가 최상단, 하위 페이지들이 아래로 분기
- **연결선(Connection Lines)**: 부모-자식 관계를 시각적 선으로 표현
- **계층 단계**:
  - 1단계: Home (루트)
  - 2단계: 주요 네비게이션 페이지 (About, Services, Blog 등)
  - 3단계: 서브 페이지 (각 서비스 상세, 블로그 포스트 등)
  - 유틸리티: Legal, Privacy, 404 등 (별도 섹션)
- **페이지 그룹(Folder)**: 네비게이션 폴더 역할의 빈 부모 페이지 생성 가능
- **색상 코딩**: 섹션별 색상 구분 (CMS, 정적 콘텐츠 등)

**인터랙션:**

- 드래그 앤 드롭으로 페이지 계층 변경
- 페이지 추가/삭제/이름 변경
- 섹션 단위 편집 (각 페이지 내 섹션 구성)
- 스페이스바 + 드래그로 캔버스 패닝

**AI 기능:**

- 프롬프트 기반 자동 사이트맵 생성 (60초 이내)
- 사이트맵 → 와이어프레임 1-click 변환
- 섹션별 AI 카피라이팅
- 기존 사이트 URL로 사이트맵 임포트 (최대 50페이지)

**출력/연동:**

- Figma 내보내기 (레이어/컴포넌트 구조화)
- Webflow 내보내기 (작동하는 인터랙션 포함)
- 1,000+ 컴포넌트 라이브러리

---

## 2. composition vs Relume 세부 비교

### 2.1 기능 비교표

| 항목                    | composition (현재)                    | Relume                             |
| ----------------------- | ------------------------------------- | ---------------------------------- |
| **제품 성격**           | 노코드 웹 빌더 (완성형)               | 기획 도구 (Figma/Webflow 전단계)   |
| **페이지 배치 방향**    | 가로/세로/지그재그 (3종)              | Top-Down 트리 (계층 기반)          |
| **parent_id 지원**      | DB 스키마에 존재 (`Page.parent_id`)   | 핵심 기능 (트리 구조의 근간)       |
| **계층 시각화**         | PagesSection 패널에서 트리 표시       | 캔버스 위에서 트리 시각화 + 연결선 |
| **워크플로우 오버레이** | nav/event/dataSource/layoutGroup      | 없음 (사이트맵 자체가 전부)        |
| **연결선 렌더링**       | Bezier/Orthogonal, 타입별 색상+스타일 | 부모-자식 간 직접 연결선           |
| **페이지 프레임**       | SkiaOverlay (제목+테두리+요소카운트)  | 페이지 카드 (제목+섹션 목록)       |
| **드래그 앤 드롭**      | 페이지 위치 자유 드래그 (usePageDrag) | 계층 변경 드래그                   |
| **AI 연동**             | Groq Agent (요소 CRUD, 7개 도구)      | 프롬프트 기반 사이트맵 자동 생성   |
| **그룹핑**              | Layout Group (layout_id 기반)         | Page Group (폴더 네비게이션)       |
| **미니맵**              | 워크플로우 미니맵 존재                | 없음                               |
| **렌더링**              | CanvasKit/Skia + PixiJS 하이브리드    | 웹 기반 단순 렌더링                |

### 2.2 장단점 비교

#### composition 장점 (Relume 대비)

1. **실제 빌더**: 사이트맵이 곧 실제 디자인 캔버스 — Relume는 기획 도구, composition는 완성형 빌더
2. **자유 배치**: 페이지를 자유 좌표에 배치 가능 (Relume는 고정 트리 구조)
3. **워크플로우 오버레이**: 네비게이션/이벤트 기반 자동 연결선 (실제 코드 기반, 4종 타입)
4. **다중 렌더 엔진**: CanvasKit/Skia + PixiJS 하이브리드 (고성능 60fps)
5. **미니맵**: 대규모 프로젝트 네비게이션
6. **레이아웃 시스템**: Layout/Slot 기반 페이지 합성

#### composition 단점 (Relume 대비)

1. **계층 시각화 부재**: `parent_id`가 있지만 캔버스에서 계층 연결선으로 표현하지 않음
2. **연결선 = 워크플로우만**: 부모-자식 관계의 구조적 연결선이 없음
3. **페이지 추가 시 방향 미반영**: 새 페이지 추가 시 항상 오른쪽 끝에 배치 (방향 설정 무시) — **버그**
4. **사이트맵 뷰 없음**: 전체 사이트 구조를 한눈에 파악하기 어려움
5. **AI 사이트맵 생성 없음**: AI가 개별 요소는 조작하지만 사이트 구조 자동 생성은 미지원

#### Relume 장점

1. **직관적 사이트 구조 파악**: Top-Down 트리로 전체 구조 즉시 이해
2. **AI 사이트맵 자동 생성**: 프롬프트만으로 완전한 사이트 구조 생성
3. **사이트맵 ↔ 와이어프레임 양방향 동기화**: 한쪽 변경이 즉시 반영
4. **색상 코딩**: 시각적 섹션 분류
5. **기존 사이트 임포트**: URL로 기존 사이트 구조 자동 분석

#### Relume 단점

1. **기획 전용**: 실제 빌더가 아님 (Figma/Webflow로 내보내야 함)
2. **고정 레이아웃**: 트리 구조만 지원 (자유 배치 불가)
3. **마케팅 사이트 한정**: SaaS/포트폴리오 등 마케팅 사이트에 최적화
4. **외부 의존**: Figma/Webflow 없이는 완성 불가
5. **미니맵 없음**: 대규모 프로젝트에서 네비게이션 제한

---

## 3. 구현 계획: Hierarchy 워크플로우 엣지

### 3.0 main 코드 대비 사전 검토 결과

> 로컬 저장소에는 `main` 브랜치 ref가 없어서(`git branch --all` 기준 `work`만 존재),
> 현재 코드베이스를 기준으로 계획서의 경로/영향 범위를 정합성 검토했다.

**검토 결과 요약:**

- 워크플로우 토글 UI 위치는 `SettingsPanel`이 아니라 `Workspace` 상단 토글 바(`WorkflowCanvasToggles`)가 기준이다.
- 문서의 경로는 `src/...` 단축 경로가 아니라 `apps/builder/src/builder/...` 실경로로 정리해야 한다.
- `addPage` 방향 미반영 버그는 여전히 존재한다(`usePageManager.ts`에서 신규 페이지를 `maxX, 0`에 고정 배치).
- 워크플로우 엣지 타입은 현재 `navigation | event-navigation`만 지원하며, hierarchy 추가 시 타입/렌더러/필터 전 구간 수정이 필요하다.

### 3.1 개요

기존 워크플로우 오버레이 시스템에 `hierarchy` 엣지 타입을 추가하여, `parent_id` 기반 부모-자식 관계를 캔버스 위에서 시각화한다.

**핵심 원칙:**

- `pageLayoutDirection`은 변경하지 않음 (물리적 배치 전용 유지)
- 워크플로우 오버레이의 5번째 시각화 레이어로 추가
- 기존 navigation/event 엣지와 독립적으로 토글 가능
- 어떤 페이지 배치 방향에서든 동작

### 3.2 시각적 설계

```
  Workflow Overlay 레이어 순서 (하→상):
  ─────────────────────────────────────
  1. Layout Groups        (violet-400, dashed box)
  2. Page Frame Highlight  (semi-transparent)
  3. Hierarchy Edges       (teal-500, solid) ← NEW
  4. Navigation Edges      (blue-500, solid)
  5. Event Edges           (purple-500, dashed)
  6. DataSource Edges      (green/amber/emerald)
```

**Hierarchy 엣지 스타일:**

- **색상**: teal-500 (`#14b8a6`) — 기존 blue/purple/green과 구분
- **선 스타일**: 실선, 1.5px (navigation과 같은 두께)
- **라우팅**: Orthogonal (L-shaped) — 트리 구조에 적합
  - 부모 하단 중앙 → 수직 하강 → 수평 분기 → 수직 하강 → 자식 상단 중앙
- **화살표**: 자식 방향 삼각형 (기존 arrow 재사용)
- **하이라이트**: 포커스 페이지의 직접 자식/부모 엣지 강조 (기존 1-hop/2-hop 재사용)

```
      ┌──────────┐
      │   Home   │
      └────┬─────┘
           │ ← teal-500 실선
     ┌─────┼─────┐
     │     │     │
  ┌──┴──┐ ┌┴──┐ ┌┴────┐
  │About│ │Svc│ │Blog │
  └─────┘ └─┬─┘ └─────┘
            │
         ┌──┴──┐
         │Svc A│
         └─────┘
```

### 3.3 수정 대상 파일 목록

#### Phase 1: 엣지 타입 & 계산 (핵심)

| #   | 파일                                                              | 변경 내용                                                                     |
| --- | ----------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| 1   | `apps/builder/src/builder/workspace/canvas/skia/workflowEdges.ts` | `WorkflowEdge.type`에 `'hierarchy'` 추가, `computeHierarchyEdges()` 함수 신규 |

**현재 `WorkflowEdge` 타입 (workflowEdges.ts):**

```typescript
export interface WorkflowEdge {
  id: string;
  type: "navigation" | "event-navigation"; // ← 'hierarchy' 추가 필요
  sourcePageId: string;
  targetPageId: string;
  sourceElementId?: string;
  label?: string;
}
```

> **참고:** 같은 파일에 `DataSourceEdge`, `LayoutGroup` 인터페이스와
> `computeDataSourceEdges()`, `computeLayoutGroups()` 함수도 존재한다.
> hierarchy는 `WorkflowEdge` 타입을 확장하여 기존 렌더 파이프라인을 재사용한다.

**`computeHierarchyEdges()` 알고리즘:**

```
입력: pages[] (parent_id, id 포함)
출력: WorkflowEdge[] (type: 'hierarchy')

1. pages.filter(p => p.parent_id != null) 순회
2. 각 page에 대해:
   - edge = {
       id: `hierarchy-${page.parent_id}-${page.id}`,
       type: 'hierarchy',
       sourcePageId: page.parent_id,    // 부모
       targetPageId: page.id,           // 자식
       label: undefined                  // 라벨 불필요
     }
3. parent가 pages에 존재하는지 검증 (dangling reference 방지)
4. WorkflowEdge[] 반환
```

#### Phase 2: 스토어 토글

| #   | 파일                                                | 변경 내용                                                 |
| --- | --------------------------------------------------- | --------------------------------------------------------- |
| 2   | `apps/builder/src/builder/stores/canvasSettings.ts` | `showWorkflowHierarchy: boolean` 추가, setter/toggle 추가 |

**기존 패턴 따라 추가:**

```typescript
// canvasSettings.ts 기존 패턴:
showWorkflowNavigation: boolean; // ← 기존
showWorkflowEvents: boolean; // ← 기존
showWorkflowDataSources: boolean; // ← 기존
showWorkflowLayoutGroups: boolean; // ← 기존
showWorkflowHierarchy: boolean; // ← NEW (기본값: true)
```

#### Phase 3: UI 토글

| #   | 파일                                               | 변경 내용                                                           |
| --- | -------------------------------------------------- | ------------------------------------------------------------------- |
| 3   | `apps/builder/src/builder/workspace/Workspace.tsx` | `WorkflowCanvasToggles`에 "Hierarchy" 체크박스 + 레전드 아이콘 추가 |

**현재 구조상 Workflow 토글은 Settings 패널이 아니라 Workspace 오버레이 토글 영역에서 관리한다.**

#### Phase 4: 렌더링 통합

| #   | 파일                                                                 | 변경 내용                                                               |
| --- | -------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| 4   | `apps/builder/src/builder/workspace/canvas/skia/SkiaOverlay.tsx`     | hierarchy 엣지 계산 호출 + 필터링 분기 추가                             |
| 5   | `apps/builder/src/builder/workspace/canvas/skia/workflowRenderer.ts` | `HIERARCHY_COLOR` 상수 추가, 엣지 타입별 색상 분기에 `'hierarchy'` 추가 |
| 6   | `apps/builder/src/builder/workspace/canvas/skia/workflowMinimap.ts`  | hierarchy 색상 추가 + 미니맵 엣지 색상 분기에 `'hierarchy'` 추가        |

**SkiaOverlay 변경 (기존 패턴 따라):**

```
// 기존 패턴 (SkiaOverlay.tsx 내 filteredEdges):
const filteredEdges = workflowEdgesRef.current.filter((e) => {
  if (e.type === 'navigation') return showNav;
  if (e.type === 'event-navigation') return showEvents;
  return false;
});

// 수정:
const filteredEdges = workflowEdgesRef.current.filter((e) => {
  if (e.type === 'navigation') return showNav;
  if (e.type === 'event-navigation') return showEvents;
  if (e.type === 'hierarchy') return showHierarchy;  // ← NEW
  return false;
});
```

> **참고:** `DataSourceEdge`와 `LayoutGroup`은 `WorkflowEdge`와 별도의 인터페이스이므로
> `filteredEdges`에 포함되지 않는다. 이들은 독립적인 렌더 경로(`renderDataSourceEdges`, `renderLayoutGroups`)를 사용한다.

추가 반영:

- `renderWorkflowEdges()`뿐 아니라 `buildEdgeGeometryCache()`와 `renderWorkflowMinimap()`에도 `filteredEdges`를 전달해
  **보이는 엣지와 인터랙션 대상 엣지**를 동일하게 유지한다.

**workflowRenderer 변경:**

```
// 기존 색상 분기 (workflowRenderer.ts):
const isEvent = edge.type === 'event-navigation';
const color = isEvent ? EVENT_NAV_COLOR : NAVIGATION_COLOR;

// 수정:
const color = edge.type === 'hierarchy' ? HIERARCHY_COLOR
            : edge.type === 'event-navigation' ? EVENT_NAV_COLOR
            : NAVIGATION_COLOR;
```

**workflowMinimap 변경:**

```
// 기존: navEdgePaint, eventEdgePaint만 존재 (workflowMinimap.ts)
// 추가: hierarchyEdgePaint (teal-500 색상) Paint 객체 생성 필요
```

#### Phase 5: 히트테스트 & 그래프 유틸

| #   | 파일                                                                   | 변경 내용                                       |
| --- | ---------------------------------------------------------------------- | ----------------------------------------------- |
| 7   | `apps/builder/src/builder/workspace/canvas/skia/workflowHitTest.ts`    | 변경 불필요 (엣지 타입 무관하게 동작)           |
| 8   | `apps/builder/src/builder/workspace/canvas/skia/workflowGraphUtils.ts` | 변경 불필요 (computeConnectedEdges는 타입 무관) |

**기존 히트테스트와 그래프 유틸은 엣지 타입에 무관하게 동작하므로 로직 변경 없음.**
단, hidden 엣지 인터랙션 방지를 위해 SkiaOverlay에서 hit-test 입력 엣지를 필터링한다.

### 3.4 엣지 계산 타이밍

```
기존 워크플로우 엣지 계산 흐름:
  registryVersion 또는 elementsChanged 변경 시
    → computeWorkflowEdges() 호출
    → workflowEdgesRef에 캐싱

hierarchy 엣지 추가 위치:
  pagesChanged 시 (페이지 추가/삭제/parent_id 변경)
    → computeHierarchyEdges() 호출
    → workflowEdgesRef에 합산 (기존 edges + hierarchy edges)
```

실구현 기준 권장 트리거:

- `registryVersion` 또는 `elementsChanged`
- `pages` 참조 변경 또는 `pagesSignature(id,parent_id,slug)` 변경
- `pagePositionsVersion`은 계산 트리거가 아니라 렌더/지오메트리 캐시 무효화 트리거로 분리

### 3.5 고려사항

#### 성능

- hierarchy 엣지 수 = 페이지 수 - 루트 수 (최대 수십 개)
- 기존 navigation 엣지 수 (요소 개수 비례) 보다 훨씬 적음
- 60fps 목표에 영향 없음

#### parent_id 활용 확장

- 현재 `Page.parent_id` 필드가 DB 스키마에 존재하지만 캔버스에서 미활용
- hierarchy 엣지 추가로 `parent_id`의 가치가 크게 증가
- `PagesSection`의 트리 구조(`usePageTreeData.ts`)와 데이터 소스 일치

#### 엣지 중복 처리

- navigation 엣지와 hierarchy 엣지가 같은 페이지 쌍을 가리킬 수 있음
  - 예: Home → About (hierarchy) + Home의 nav 링크 → About (navigation)
- **다른 색상/스타일**이므로 시각적으로 구분됨
- 각각 독립 토글 가능하므로 혼란 없음

#### 레이어 순서

- hierarchy 엣지는 navigation/event 아래에 렌더링 (배경 레이어)
- 구조적 관계는 "맥락", 네비게이션/이벤트는 "동작" → 동작이 위에 표시

#### 미니맵/인터랙션 동일 적용

- 미니맵에서도 hierarchy는 teal-500으로 렌더링하고 토글 상태를 동일 반영
- hierarchy 토글 OFF 시 main canvas 렌더 + 미니맵 렌더 + hover/hit-test에서 모두 제외
- highlight/focus 로직은 visible edges 기준으로 계산

---

## 4. 선택적 확장: 트리 자동 배치 (Auto-Arrange)

워크플로우 hierarchy 엣지와 **별개로**, 트리 구조에 맞게 페이지를 자동 배치하는 기능을 **액션 버튼**으로 제공할 수 있다.

### 4.1 설계

- `pageLayoutDirection` 변경 **아님** — 일회성 배치 액션
- `Workspace` 또는 `PagesSection` 컨텍스트 메뉴에 "Auto-arrange by Hierarchy" 버튼 추가
- 클릭 시 `initializePagePositions`를 트리 알고리즘으로 호출

### 4.2 트리 레이아웃 알고리즘

```
입력: pages[], pageWidth, pageHeight, gap
출력: positions Record<string, {x, y}>

1. 트리 구축
   - roots = pages.filter(p => !p.parent_id).sort(by order_num)
   - childrenMap[parentId] = children.sort(by order_num)

2. 서브트리 너비 계산 (Bottom-Up)
   - subtreeWidth(node):
     - 리프: pageWidth
     - 내부: sum(children subtreeWidth) + (children.length - 1) * horizontalGap
     - return max(pageWidth, 계산 너비)

3. 위치 할당 (Top-Down)
   - assignPositions(node, x, y):
     - positions[node.id] = { x: x + subtreeWidth/2 - pageWidth/2, y }
     - currentX = x
     - for each child:
       - assignPositions(child, currentX, y + pageHeight + verticalGap)
       - currentX += subtreeWidth(child) + horizontalGap

4. 여러 루트가 있으면 순서대로 가로 배치
```

### 4.3 구현 위치

| #   | 파일                                                                                                             | 변경 내용                            |
| --- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| 1   | `apps/builder/src/builder/stores/elements.ts`                                                                    | `autoArrangeByHierarchy()` 액션 추가 |
| 2   | `apps/builder/src/builder/workspace/Workspace.tsx` 또는 `apps/builder/src/builder/panels/navigator/PagesSection.tsx` | "Auto-arrange" 버튼 추가             |

**이 Phase는 hierarchy 엣지 구현 후 별도로 진행 가능.**

---

## 5. Relume에서 적용하면 좋을 추가 기능 (우선순위)

### P1 (필수 — 이번 구현)

| 기능                 | 설명                                       | 구현 위치                            |
| -------------------- | ------------------------------------------ | ------------------------------------ |
| **Hierarchy 엣지**   | parent_id 기반 부모-자식 연결선            | workflowEdges.ts                     |
| **독립 토글**        | Hierarchy 연결선 on/off                    | canvasSettings.ts, Workspace.tsx     |
| **미니맵 동일 적용** | hierarchy 색상/토글을 미니맵에도 동일 반영 | workflowMinimap.ts, SkiaOverlay.tsx  |
| **하이라이트**       | 포커스 페이지의 부모/자식 강조             | 기존 computeConnectedEdges 자동 적용 |

### P2 (권장 — 다음 단계)

| 기능                  | 설명                                         | 비고                         |
| --------------------- | -------------------------------------------- | ---------------------------- |
| **Auto-arrange**      | 트리 구조 기반 자동 배치 버튼                | 일회성 액션 (Section 4 참조) |
| **색상 코딩**         | 페이지/그룹별 색상 태그                      | Relume의 시각적 구분         |
| **addPage 방향 반영** | 새 페이지 추가 시 현재 방향에 맞는 위치 계산 | 기존 버그 수정 포함          |

### P3 (향후 — 차별화)

| 기능                    | 설명                                | 비고                 |
| ----------------------- | ----------------------------------- | -------------------- |
| **AI 사이트맵 생성**    | 프롬프트 기반 페이지 구조 자동 생성 | 기존 Groq Agent 확장 |
| **URL 사이트맵 임포트** | 기존 사이트 URL로 구조 분석         | 크롤링 + AI 분석     |
| **페이지 그룹(Folder)** | 빈 부모 페이지 → 폴더 역할          | parent_id 활용       |
| **Global Section**      | 여러 페이지에 공유되는 전역 섹션    | Layout 시스템 확장   |

---

## 6. 구현 순서 요약

```
Phase 1: Hierarchy 엣지 타입 추가
  ├─ WorkflowEdge.type에 'hierarchy' 추가
  ├─ computeHierarchyEdges() 함수 (parent_id 기반)
  └─ HIERARCHY_COLOR 상수 정의 (teal-500)

Phase 2: 스토어 & UI 토글
  ├─ canvasSettings에 showWorkflowHierarchy 추가
  └─ Workspace WorkflowCanvasToggles에 체크박스 추가

Phase 3: 렌더링 통합
  ├─ SkiaOverlay 엣지 필터링에 hierarchy 분기 추가
  ├─ workflowRenderer 색상 분기에 hierarchy 추가
  ├─ workflowMinimap 색상 분기에 hierarchy 추가
  └─ render/hit-test/minimap에 동일 filteredEdges 전달

Phase 4: 검증 & 엣지 케이스
  ├─ parent_id 없는 페이지 처리 (루트 노드)
  ├─ dangling parent_id 검증 (삭제된 부모 참조)
  ├─ navigation 엣지와 동일 페이지 쌍 중복 시 시각적 구분
  ├─ hierarchy OFF 시 미니맵/hover도 함께 비활성 확인
  └─ 대량 페이지 (50+) 성능 확인

Phase 5: Auto-Arrange (선택적, 별도)
  ├─ autoArrangeByHierarchy() 트리 배치 액션
  └─ UI 버튼 추가
```

---

## 7. 변경 영향 범위 요약

| 파일                                                                   | 변경 수준   | 설명                                                                |
| ---------------------------------------------------------------------- | ----------- | ------------------------------------------------------------------- |
| `apps/builder/src/builder/workspace/canvas/skia/workflowEdges.ts`      | **Low**     | `computeHierarchyEdges()` 함수 1개 추가 (~30줄)                     |
| `apps/builder/src/builder/stores/canvasSettings.ts`                    | **Trivial** | 토글 상태 + setter 추가 (~5줄)                                      |
| `apps/builder/src/builder/workspace/Workspace.tsx`                     | **Trivial** | 체크박스 1개 + 레전드 아이콘 색상 추가 (~8줄)                       |
| `apps/builder/src/builder/workspace/canvas/skia/SkiaOverlay.tsx`       | **Low**     | 계산 트리거 보강 + 필터 분기 + filteredEdges 공유 (~20줄)           |
| `apps/builder/src/builder/workspace/canvas/skia/workflowRenderer.ts`   | **Trivial** | 색상 상수 + 분기 1줄 (~5줄)                                         |
| `apps/builder/src/builder/workspace/canvas/skia/workflowMinimap.ts`    | **Low**     | hierarchy 색상 상수 + `hierarchyEdgePaint` 생성 + 분기 추가 (~12줄) |
| `apps/builder/src/builder/workspace/canvas/skia/workflowHitTest.ts`    | **None**    | 변경 불필요                                                         |
| `apps/builder/src/builder/workspace/canvas/skia/workflowGraphUtils.ts` | **None**    | 변경 불필요                                                         |

**총 변경량: ~90~120줄 (신규 함수 + Paint 객체 생성 포함)**

---

## 8. 발견된 기존 버그

| 위치                                                       | 버그                                                                | 영향                                                |
| ---------------------------------------------------------- | ------------------------------------------------------------------- | --------------------------------------------------- |
| `apps/builder/src/builder/hooks/usePageManager.ts:224-232` | 새 페이지 추가 시 `pageLayoutDirection` 미참조, 항상 `maxX, 0` 배치 | vertical/zigzag 방향에서도 페이지가 오른쪽에 추가됨 |

**현재 코드:**

```typescript
// usePageManager.ts — addPage 내부
const { pagePositions } = useStore.getState();
const currentCanvasWidth = useCanvasSyncStore.getState().canvasSize.width;
let maxX = 0;
for (const pos of Object.values(pagePositions)) {
  const endX = pos.x + currentCanvasWidth + PAGE_STACK_GAP;
  if (endX > maxX) maxX = endX;
}
useStore.getState().updatePagePosition(newPage.id, maxX, 0); // ← 항상 y=0
```

**수정 방향 (P2):**

```typescript
const direction = useStore.getState().pageLayoutDirection;
const { width: canvasW, height: canvasH } =
  useCanvasSyncStore.getState().canvasSize;

if (direction === "vertical") {
  let maxY = 0;
  for (const pos of Object.values(pagePositions)) {
    const endY = pos.y + canvasH + PAGE_STACK_GAP;
    if (endY > maxY) maxY = endY;
  }
  useStore.getState().updatePagePosition(newPage.id, 0, maxY);
} else if (direction === "zigzag") {
  // initializePagePositions의 zigzag 로직 참조
  // pageCount 기반 row/col 계산
} else {
  // horizontal (기존 로직)
  useStore.getState().updatePagePosition(newPage.id, maxX, 0);
}
```

**이 버그는 P2에서 별도 수정 권장.**

---

## 9. 참고 자료

### Relume.io 관련

- [Relume AI Site Builder](https://www.relume.io/)
- [Building a sitemap with AI](https://www.relume.io/resources/docs/building-a-sitemap-with-ai)
- [Sitemap Creation Video](https://www.relume.io/resources/series-videos/sitemap-creation)
- [AI-powered Sitemap Builder](https://www.relume.io/whats-new/june-component-day)
- [Relume AI Tutorial](https://webplacide.com/blog/relume-ai-tutorial-generate-sitemaps-and-wireframes-in-seconds/)

### composition 코드베이스

- **워크플로우 엣지**: `apps/builder/src/builder/workspace/canvas/skia/workflowEdges.ts` — 엣지 타입 정의 & 계산
- **워크플로우 렌더러**: `apps/builder/src/builder/workspace/canvas/skia/workflowRenderer.ts` — 연결선 렌더링
- **워크플로우 미니맵**: `apps/builder/src/builder/workspace/canvas/skia/workflowMinimap.ts` — 미니맵 엣지 렌더링
- **오버레이 통합**: `apps/builder/src/builder/workspace/canvas/skia/SkiaOverlay.tsx` — 토글 필터링 & 렌더 호출
- **히트테스트**: `apps/builder/src/builder/workspace/canvas/skia/workflowHitTest.ts` — 마우스 인터랙션
- **그래프 유틸**: `apps/builder/src/builder/workspace/canvas/skia/workflowGraphUtils.ts` — 연결 분석
- **캔버스 설정**: `apps/builder/src/builder/stores/canvasSettings.ts` — 토글 상태 관리
- **설정 UI(워크플로우 토글)**: `apps/builder/src/builder/workspace/Workspace.tsx` — 워크플로우 토글 UI
- **페이지 트리**: `apps/builder/src/builder/panels/navigator/tree/PageTree/usePageTreeData.ts` — parent_id 기반 트리
- **Page 타입**: `apps/builder/src/types/builder/unified.types.ts` — parent_id 필드 존재
- **레이아웃 알고리즘**: `apps/builder/src/builder/stores/elements.ts` — initializePagePositions
- **페이지 관리**: `apps/builder/src/builder/hooks/usePageManager.ts` — addPage, 위치 계산

---

## 코드 대조 검증 (2026-03-03)

### 검증 범위

실제 파일 경로와 구현 현황을 `Grep/Glob/Read`로 확인한 결과를 기록한다.

### 워크플로우 관련 파일 존재 확인 (✅ 완료)

| 파일                                                                   | 확인 결과 |
| ---------------------------------------------------------------------- | --------- |
| `apps/builder/src/builder/workspace/canvas/skia/workflowEdges.ts`      | ✅ 존재   |
| `apps/builder/src/builder/workspace/canvas/skia/workflowRenderer.ts`   | ✅ 존재   |
| `apps/builder/src/builder/workspace/canvas/skia/workflowMinimap.ts`    | ✅ 존재   |
| `apps/builder/src/builder/workspace/canvas/skia/workflowHitTest.ts`    | ✅ 존재   |
| `apps/builder/src/builder/workspace/canvas/skia/workflowGraphUtils.ts` | ✅ 존재   |
| `apps/builder/src/builder/workspace/canvas/skia/SkiaOverlay.tsx`       | ✅ 존재   |
| `apps/builder/src/builder/stores/canvasSettings.ts`                    | ✅ 존재   |
| `apps/builder/src/builder/workspace/Workspace.tsx`                     | ✅ 존재   |

### WorkflowEdge 타입 현황

현재 `workflowEdges.ts`의 `WorkflowEdge` 타입:

```typescript
export interface WorkflowEdge {
  id: string;
  type: "navigation" | "event-navigation"; // 'hierarchy' 미추가 (문서와 일치)
  sourcePageId: string;
  targetPageId: string;
  sourceElementId?: string;
  label?: string;
}
```

- `DataSourceEdge`, `LayoutGroup` 인터페이스는 별도 독립 인터페이스로 동일 파일에 존재함 (문서 설명과 일치)
- `computeDataSourceEdges()`, `computeLayoutGroups()` 함수도 동일 파일에 존재함

### canvasSettings.ts 현황

현재 `showWorkflowHierarchy` 미추가 상태:

| 기존 토글                  | 현황                                |
| -------------------------- | ----------------------------------- |
| `showWorkflowNavigation`   | ✅ 존재 (기본값: true)              |
| `showWorkflowEvents`       | ✅ 존재 (기본값: true)              |
| `showWorkflowDataSources`  | ✅ 존재 (기본값: true)              |
| `showWorkflowLayoutGroups` | ✅ 존재 (기본값: true)              |
| `workflowStraightEdges`    | ✅ 존재 (기본값: true = orthogonal) |
| `showWorkflowHierarchy`    | ❌ 미추가                           |

### WorkflowCanvasToggles 현황 (Workspace.tsx)

현재 토글 목록 (WorkflowCanvasToggles 컴포넌트):

- ✅ Navigation (blue-500, solid)
- ✅ Events (purple-500, dashed)
- ✅ Data Sources (green-500, dotted)
- ✅ Layout Groups (violet-400, group)
- ✅ Orthogonal 전환 토글
- ❌ Hierarchy 토글 미추가

### workflowRenderer.ts 현황

현재 색상 분기:

```typescript
const isEvent = edge.type === "event-navigation";
const color = isEvent ? EVENT_NAV_COLOR : NAVIGATION_COLOR;
// 'hierarchy' 분기 없음 — 추가 필요
```

- `NAVIGATION_COLOR` = blue-500 (`#3b82f6`)
- `EVENT_NAV_COLOR` = purple-500 (`#a855f7`)
- `HIERARCHY_COLOR` (teal-500 `#14b8a6`) — 미정의

### workflowMinimap.ts 현황

현재 Paint 객체:

- `navEdgePaint` = NAVIGATION_COLOR
- `eventEdgePaint` = EVENT_NAV_COLOR
- `hierarchyEdgePaint` — 미추가

### SkiaOverlay.tsx 현황

현재 filteredEdges 분기:

```typescript
const filteredEdges = workflowEdgesRef.current.filter((e) => {
  if (e.type === "navigation") return showNav;
  if (e.type === "event-navigation") return showEvents;
  return false;
  // 'hierarchy' 분기 없음 — 추가 필요
});
```

### 기존 버그 확인 (usePageManager.ts)

문서 section 8의 버그 (addPage 시 항상 maxX, y=0 배치) 확인됨:

```typescript
// apps/builder/src/builder/hooks/usePageManager.ts (addPage 내부)
let maxX = 0;
for (const pos of Object.values(pagePositions)) {
  const endX = pos.x + currentCanvasWidth + PAGE_STACK_GAP;
  if (endX > maxX) maxX = endX;
}
useStore.getState().updatePagePosition(newPage.id, maxX, 0); // 항상 y=0
```

단, `addPageWithParams`는 `parentId` 파라미터를 지원하며, `initializeProject` 내에서는 `initializePagePositions`가 `pageLayoutDirection`을 인자로 받아 정상 계산함. **버그는 `addPage` (기본 파라미터 없는 버전)에만 해당**.

### parent_id 필드 확인

- `apps/builder/src/builder/hooks/usePageManager.ts` — `parent_id` 필드 포함 (신규 페이지 생성 시 `parent_id: null` 설정)
- `apps/builder/src/builder/panels/navigator/tree/PageTree/usePageTreeData.ts` — ✅ 존재
- `apps/builder/src/builder/stores/elements.ts` — `initializePagePositions` 함수 존재 (✅)

### Phase별 전제 조건 현황

| Phase   | 설명             | 전제 조건 현황                                                                                                      |
| ------- | ---------------- | ------------------------------------------------------------------------------------------------------------------- |
| Phase 1 | 엣지 타입 & 계산 | `workflowEdges.ts` 존재(✅). `WorkflowEdge.type` 유니온에 `'hierarchy'` 추가 및 `computeHierarchyEdges()` 작성 필요 |
| Phase 2 | 스토어 토글      | `canvasSettings.ts`에 기존 패턴 확인(✅). `showWorkflowHierarchy` 추가만 필요                                       |
| Phase 3 | UI 토글          | `WorkflowCanvasToggles` 컴포넌트 구조 확인(✅). Hierarchy 체크박스 1개 추가                                         |
| Phase 4 | 렌더링 통합      | 모든 대상 파일 존재(✅). 색상 분기/Paint 객체 추가 필요                                                             |
| Phase 5 | Auto-Arrange     | 별도 진행 — `initializePagePositions` 로직 참조 필요                                                                |

### Status 판단

**Proposed 유지.** 구현이 전혀 시작되지 않은 상태이며, 모든 전제 조건 파일이 존재한다. 변경량은 문서 추정(~90~120줄)이 실제 코드 구조와 일치한다.
