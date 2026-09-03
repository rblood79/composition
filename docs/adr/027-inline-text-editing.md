# ADR-027: Canvas Inline Text Editing (WebGL 위 텍스트 직접 편집)

## Status

Partial (2026-03-08) — Phase A+B+C 구현 완료 (TextEditOverlay + Quill + 멀티페이지 좌표 보정 + Spec 컴포넌트 텍스트 편집), Phase D (리치 텍스트) 미구현

### Phase C 완료 근거 (2026-03-08)

- TEXT_ELEMENT_TAGS: Button, ToggleButton, Tag, Badge, Link 등 14개 태그 등록 완료
- BuilderCanvas textTags: 동기화 완료 (더블클릭 → startEdit 진입)
- extractFullSpecTextStyle: 14개 Spec 지원, padding/paddingTop/verticalAlign/fontWeight/color 추출
- TextEditOverlay: 전체 요소 bounds + Quill 내부 padding 방식으로 텍스트 영역 정확히 맞춤
- subscribeBounds: 편집 중 크기 변동 시 오버레이 동기화 (fit-content Badge 등)
- `extractSpecTextBounds()` 별도 함수 불필요: padding 기반 접근이 기능적으로 동등하며 클릭 영역이 넓어 UX 우수

## Context

### 문제 정의

composition는 CanvasKit/Skia WASM 기반 캔버스 렌더러를 사용한다. 현재 텍스트 편집은 **우측 속성 패널의 입력 필드**를 통해서만 가능하며, 캔버스에서 텍스트를 직접 편집할 수 없다. 이는 노코드 빌더의 핵심 UX 기대치에 미달한다.

**현재 흐름** (비효율):

```
캔버스에서 텍스트 요소 클릭 → 우측 패널 스크롤 → 속성 입력란 찾기 → 텍스트 수정 → 캔버스 확인
```

**목표 흐름** (직관적):

```
캔버스에서 텍스트 요소 더블클릭 → 즉시 인라인 편집 → Enter/Escape/외부 클릭으로 완료
```

### 업계 레퍼런스

| 도구        | 인라인 편집 방식                                       |
| ----------- | ------------------------------------------------------ |
| **Pencil**  | WebGL 위 DOM contenteditable + Quill, 행렬 포지셔닝    |
| **Figma**   | Canvas 위 contenteditable div, 행렬 기반 CSS transform |
| **Framer**  | Canvas 위 contenteditable, 줌/팬 동기화                |
| **Webflow** | DOM 직접 편집 (Canvas가 DOM 기반)                      |

### Pencil 구현 분석 (참조: `docs/pencil-extracted/`)

Pencil은 다음 패턴으로 구현:

1. **상태 머신**: `EditingTextState` — 편집 중 포인터 이벤트 전부 무시 (DOM 에디터가 처리)
2. **이벤트 브릿지**: `eventEmitter.emit("startTextEdit")` → React 훅 리스닝 → DOM 오버레이 생성
3. **행렬 포지셔닝**: `camera.worldTransform + node.getWorldMatrix()` → CSS `matrix() translate()`
4. **이중 렌더링 방지**: Skia `hideText()` / `showText()` — 편집 중 캔버스 텍스트 숨김
5. **Quill 에디터**: contenteditable + 리치 텍스트 지원
6. **실시간 동기화**: Quill `text-change` → 노드 속성 업데이트 (undo 미기록)
7. **Undo 통합**: 편집 시작 시 스냅샷 → 편집 완료 시 단일 undo 블록 커밋

### Hard Constraints

- CanvasKit/Skia 렌더러 유지 (DOM Canvas가 아님)
- PixiJS EventBoundary 히트 테스트 체계 유지
- 멀티페이지 캔버스 (`pagePositions` 오프셋) 지원 필수
- Zustand 상태 관리 파이프라인 (Memory → Index → History → DB → Preview) 준수
- `layoutVersion` 계약 준수
- Spec 기반 컴포넌트 텍스트 (Button label 등)는 Phase 1 범위 외

## Alternatives Considered

### 대안 A: DOM Overlay + contenteditable div (Pencil/Figma 방식)

- 설명: 캔버스 위에 absolute 포지셔닝된 contenteditable div 오버레이. CSS transform으로 캔버스 좌표계에 매핑. 편집 중 Skia 텍스트 렌더링 숨김.
- 위험:
  - 기술: **M** — Skia ↔ DOM 폰트 렌더링 미세 차이 (텍스트 점프 가능)
  - 성능: **L** — DOM 노드 1개 추가, 영향 미미
  - 유지보수: **L** — 독립적 레이어, 기존 코드 침투 최소
  - 마이그레이션: **L** — 점진 도입 가능 (Text 노드 → Spec 컴포넌트 순)

### 대안 B: CanvasKit 네이티브 IME 통합

- 설명: CanvasKit 내부에서 직접 텍스트 입력 처리. hidden textarea로 IME 이벤트 수신 → Skia paragraph 실시간 재렌더링.
- 위험:
  - 기술: **H** — IME(한글/일본어/중국어) 조합 처리 복잡, 커서/셀렉션 직접 구현 필요
  - 성능: **M** — 매 키스트로크마다 paragraph 재생성 + Skia 렌더
  - 유지보수: **H** — 커서, 셀렉션, 클립보드, 접근성 모두 직접 구현
  - 마이그레이션: **L** — 독립 모듈

### 대안 C: 팝오버 에디터 (캔버스 옆 플로팅 입력)

- 설명: 더블클릭 시 해당 요소 근처에 플로팅 textarea 표시. 캔버스 좌표계와 무관.
- 위험:
  - 기술: **L** — 단순 DOM 포지셔닝
  - 성능: **L** — 최소 오버헤드
  - 유지보수: **L** — 독립적
  - 마이그레이션: **L** — 즉시 도입 가능

## Risk Threshold Check

- 대안 B: HIGH 2개 (기술, 유지보수) → IME + 커서/셀렉션 직접 구현은 브라우저 재구현에 가까움. **기각**
- 대안 C: 모두 LOW지만 **UX 가치가 낮음** — "인라인" 편집이 아닌 별도 입력 → 현재 속성 패널 방식과 본질적 차이 없음. **보류 (fallback)**
- 대안 A: HIGH 없음, M 1개 (폰트 렌더링 차이) → Gate로 관리 가능

## Decision

**대안 A: DOM Overlay + contenteditable div** 채택

Pencil/Figma와 동일한 업계 검증된 패턴. Skia ↔ DOM 폰트 차이는 Gate G1에서 허용 범위 검증.

### 위험 수용 근거

- **폰트 렌더링 차이 (M)**: CanvasKit Skia paragraph와 브라우저 CSS 사이의 미세한 차이는 편집 시작/종료 시 1~2px 점프로 나타날 수 있음. Pencil/Figma도 동일 현상이 있으며 사용자 수용 범위 내. 줌 레벨이 높을수록 차이 증폭 → G1 Gate에서 200% 줌까지 허용 범위 검증.

## Gates

| Gate | 조건                                                                                  | 검증 시점       |
| ---- | ------------------------------------------------------------------------------------- | --------------- |
| G0   | Text/Heading 요소 더블클릭 → contenteditable 오버레이 정확히 겹침 (100%/150%/200% 줌) | Phase A 완료 시 |
| G1   | Skia 텍스트 숨김 ↔ DOM 텍스트 표시 전환 시 시각적 점프 2px 이내 (100% 줌 기준)        | Phase A 완료 시 |
| G2   | 한글 IME 조합 정상 동작 (macOS, Chrome)                                               | Phase A 완료 시 |
| G3   | 멀티페이지 환경에서 다른 페이지 텍스트 편집 시 좌표 정확                              | Phase B 완료 시 |
| G4   | Spec shapes에서 텍스트 영역 bounds 추출 가능 여부 확인 (Button label 위치/크기)       | Phase C 착수 전 |

## Consequences

### Positive

- 캔버스 위 직접 텍스트 편집 → 노코드 빌더 핵심 UX 달성
- 업계 표준 패턴 (Pencil/Figma) 검증됨 → 구현 리스크 낮음
- 기존 렌더링 파이프라인 변경 최소 (Skia hide/show만 추가)
- 점진적 확장 가능 (Text → Heading → Button label 순)

### Negative

- Skia ↔ DOM 폰트 렌더링 미세 차이 (1~2px 점프 가능)
- 줌/팬 시 DOM 오버레이 재포지셔닝 비용 (requestAnimationFrame 수준)
- Spec 컴포넌트 내부 텍스트 (Button, Badge)의 정확한 bounds 계산 복잡 (Phase C)

---

## Implementation Plan

### Phase A: 기본 인프라 + Text/Heading 편집 (핵심 MVP)

> 범위: Text, Heading 요소의 캔버스 직접 편집

#### A-1. 상태 슬라이스 추가

**파일**: `apps/builder/src/builder/store/slices/textEditingSlice.ts` (신규)

```typescript
interface TextEditingSlice {
  // 상태
  isEditingText: boolean;
  editingElementId: string | null;
  editingOriginalValue: string | null; // undo용 스냅샷

  // 액션
  startTextEditing: (elementId: string) => void;
  finishTextEditing: (newValue: string) => void;
  cancelTextEditing: () => void;
}
```

- `startTextEditing`: `isEditingText=true`, 원본 텍스트 스냅샷 저장
- `finishTextEditing`: 히스토리 기록 → 요소 업데이트 → `isEditingText=false`
- `cancelTextEditing`: 원본 복원 → `isEditingText=false`

#### A-2. 더블클릭 감지 (기존 인프라 활용)

**파일**: `apps/builder/src/builder/workspace/canvas/BuilderCanvas.tsx` (기존)

**기존 `handleElementDoubleClick` (line ~2391) 재사용**:

현재 이미 더블클릭 핸들러가 구현되어 있으며 두 가지 분기로 동작:

1. **텍스트 요소** (`p, h1~h6, span, a, label, button`) → `startEdit(elementId, layoutPosition)` 호출
2. **자식이 있는 컨테이너** → `enterEditingContext(elementId)` 호출 (한 단계 진입)

텍스트 편집은 이미 `useTextEdit()` 훅 (`startEdit`, `completeEdit`, `cancelEdit`)에 연결되어 있으므로, **신규 더블클릭 감지 로직 추가 불필요**. `useTextEdit` 훅과 `TextEditOverlay`의 통합 완성이 핵심.

- 더블클릭 감지: `ElementSprite.tsx`의 `handleContainerPointerDown`에서 300ms 타임스탬프 비교 → `onDoubleClick` 호출 (기존)
- 편집 중 PixiJS 포인터 이벤트 차단 (hitArea 해제 또는 조건부 무시)

#### A-3. DOM Overlay 레이어

**파일**: `apps/builder/src/builder/workspace/canvas/TextEditOverlay.tsx` (신규)

```
<div data-text-edit-overlay class="absolute inset-0 pointer-events-none">
  <div class="fixed" ref={containerRef}>
    <!-- 편집 시에만 생성 -->
    <div
      contenteditable="true"
      style={{
        position: 'absolute',
        transformOrigin: 'top left',
        transform: `matrix(...)`,  // 카메라 + 요소 좌표 합성
        pointerEvents: 'auto',
        // 폰트 스타일 동기화
      }}
    />
  </div>
</div>
```

**포지셔닝 계산**:

```
1. pagePositions[pageId]  → 페이지 오프셋 (x, y)
2. Taffy 레이아웃 결과    → 요소의 페이지 내 위치 (x, y, w, h)
3. Camera transform       → 줌/팬 (scale, translateX, translateY)

→ CSS transform = scale(zoom) translate(pageX + elemX - scrollX, pageY + elemY - scrollY)
→ width/height = elemW * zoom, elemH * zoom (또는 transform에 포함)
```

#### A-4. Skia 텍스트 숨김/복원

**파일**: `apps/builder/src/builder/workspace/canvas/skia/nodeRenderers.ts`

- `renderText()` 진입 시 `editingElementId === elementId`이면 텍스트 렌더링 스킵
- 배경/보더는 유지, **텍스트 드로잉만** 스킵
- **store 접근 방식**: Skia 렌더 루프 내에서 매 프레임 `useStore.getState()` 호출을 피하기 위해, `editingElementId`를 렌더 함수 외부에서 읽어 인자로 전달 (예: `SkiaOverlay`에서 한 번 읽고 `renderTree()`에 전달) 또는 모듈 레벨 플래그로 관리

#### A-5. 폰트 스타일 동기화

**파일**: TextEditOverlay 내부

- `specTextStyle.ts`의 `extractSpecTextStyle(tag, props)`로 fontSize/fontWeight/fontFamily 추출
- Skia와 동일한 폰트 속성을 CSS로 적용:
  - `font-family`: `buildFontFamilies()` 결과의 CSS 폰트 스택
  - `font-size`, `font-weight`, `line-height`, `letter-spacing`, `text-align`
  - `color`: `resolveToken('{color.neutral}')` → hex

#### A-6. 편집 완료/취소 처리

- **Enter** (단일행) 또는 **외부 클릭**: `finishTextEditing(newValue)` (편집 확정)
- **Escape**: `cancelTextEditing()` (원본 복원)
- **Cmd/Ctrl+Enter** (멀티행): `finishTextEditing(newValue)` (편집 확정)
- **외부 클릭 감지**: `document.addEventListener('mousedown', handler)` — 오버레이 외부이면 finish

#### A-7. Undo/Redo 통합

- `startTextEditing`에서 원본 `textContent` 스냅샷
- 편집 중에는 DOM contenteditable 내부에서만 텍스트 변경 (store 업데이트 없음 → Skia 재렌더 없음)
- `finishTextEditing`에서 변경이 있으면 히스토리 기록 + store 업데이트 (단일 블록)
- `cancelTextEditing`에서 원본 복원 (store 변경 없음)

### Phase B: 줌/팬 동기화 + 멀티페이지

> 범위: 카메라 변환 추적, 페이지 간 텍스트 편집

#### B-1. 카메라 변환 추적

- 줌/팬 변경 시 DOM 오버레이 CSS transform 재계산
- `requestAnimationFrame` 기반 또는 카메라 상태 변경 subscribe

#### B-2. 멀티페이지 좌표 보정

- `pagePositions[pageId]` 오프셋을 포지셔닝 계산에 반영
- 다른 페이지 텍스트 더블클릭 시에도 정확한 좌표

#### B-3. 편집 중 줌/팬 처리

- 편집 중 줌 변경 → DOM 오버레이 실시간 리사이즈
- 편집 중 팬 변경 → DOM 오버레이 실시간 이동
- (선택) 편집 중 줌/팬 비활성화 옵션

### Phase C: Spec 컴포넌트 내부 텍스트

> 범위: Button label, Badge text, Card title 등 Spec 기반 컴포넌트
>
> **선행 조건 (Gate G4)**: Spec shapes에서 텍스트 영역 bounds를 정확히 추출할 수 있는지 사전 검증 필수. 현재 Spec 구조가 텍스트 shape의 상대 위치/크기를 프로그래밍적으로 노출하는지 확인 필요. G4 실패 시 Spec 구조 확장 또는 대안 접근 (하드코딩된 offset 테이블 등) 검토.

#### C-1. Spec 텍스트 bounds 계산

- `extractSpecTextStyle(tag, props)`로 텍스트 영역의 상대 위치/크기 추출
- Spec shapes에서 텍스트 shape의 x/y/width/height 결정
- padding, alignment 고려한 정확한 텍스트 영역 bounds

#### C-2. 컴포넌트별 편집 가능 텍스트 매핑

| 컴포넌트     | 편집 대상 속성                       | 비고                                 |
| ------------ | ------------------------------------ | ------------------------------------ |
| Button       | `label`                              | SELF_PADDING_TAGS, 내부 padding 고려 |
| Badge        | `label`                              | 짧은 텍스트, 크기 자동 조절          |
| Card         | CardHeader > Heading의 `textContent` | 자식 요소 텍스트                     |
| Link         | `label`                              |                                      |
| ToggleButton | `label`                              |                                      |

#### C-3. 편집 시 크기 재계산

- 텍스트 변경 → `layoutVersion + 1` → Taffy 재계산 → DOM 오버레이 크기 업데이트
- fit-content 요소: 텍스트 길이에 따라 요소 크기 변동 → 오버레이도 동기화

### Phase D: 고급 기능 (장기)

#### D-1. 리치 텍스트 지원

- Bold, Italic, 색상 등 인라인 스타일
- Quill 또는 TipTap 같은 리치 텍스트 에디터 도입 검토

#### D-2. 멀티 라인 편집

- 자동 높이 증가
- 줄바꿈 + CSS text wrapping 속성 반영

#### D-3. 텍스트 편집 툴바

- 편집 중 플로팅 미니 툴바 (B/I/U, 정렬, 색상)

---

## 주요 파일 영향 분석

### 신규 파일

| 파일                               | 용도                  |
| ---------------------------------- | --------------------- |
| `store/slices/textEditingSlice.ts` | 텍스트 편집 상태 관리 |
| `canvas/TextEditOverlay.tsx`       | DOM 오버레이 컴포넌트 |

### 수정 파일

| 파일                           | 변경 내용                           | Phase |
| ------------------------------ | ----------------------------------- | ----- |
| `store/useStore.ts`            | textEditingSlice 통합               | A     |
| `canvas/skia/nodeRenderers.ts` | 편집 중 텍스트 렌더링 스킵          | A     |
| `canvas/` 이벤트 핸들러        | 더블클릭 감지 + 편집 중 이벤트 차단 | A     |
| `canvas/BuilderCanvas.tsx`     | TextEditOverlay 마운트              | A     |
| `workspace/canvas/Camera` 관련 | 카메라 변환 subscribe               | B     |

### 미수정 파일 (변경 불필요)

- `specTextStyle.ts` — 이미 fontSize/fontWeight/fontFamily 추출 기능 존재
- `canvaskitTextMeasurer.ts` — 편집 중 측정은 DOM이 처리
- Preview iframe — 편집은 Builder 캔버스 전용, Preview에 영향 없음

---

## 기술 상세

### 좌표 변환 공식

```
// 요소의 스크린 좌표 계산
const pagePos = pagePositions[pageId];          // { x, y }
const elemLayout = layoutMap.get(elementId);     // { x, y, width, height }
const camera = cameraState;                      // { zoom, scrollX, scrollY }

const screenX = (pagePos.x + elemLayout.x - camera.scrollX) * camera.zoom;
const screenY = (pagePos.y + elemLayout.y - camera.scrollY) * camera.zoom;
const screenW = elemLayout.width * camera.zoom;
const screenH = elemLayout.height * camera.zoom;

// CSS 적용
overlay.style.transform = `translate(${screenX}px, ${screenY}px)`;
overlay.style.width = `${screenW}px`;
overlay.style.height = `${screenH}px`;
overlay.style.fontSize = `${fontSize * camera.zoom}px`;
```

### 이벤트 흐름도

```
[더블클릭]
  ↓
ElementSprite.handleContainerPointerDown → 300ms 타임스탬프 비교 → onDoubleClick(elementId)
  ↓
BuilderCanvas.handleElementDoubleClick → resolveClickTarget() → textTags 체크
  ↓ (text/heading 타입)
useTextEdit().startEdit(elementId, layoutPosition)
  ↓
TextEditOverlay 감지 (editState 변경)
  ↓
1. Skia: nodeRenderers에서 해당 요소 텍스트 스킵
2. DOM: contenteditable div 생성 + 포지셔닝 + 포커스
  ↓
[사용자 입력]
  ↓
contenteditable 입력 → DOM 내부에서만 반영 (store 업데이트 안 함)
  ↓ (Skia 텍스트는 숨겨져 있으므로 store 업데이트 불필요 — 불필요한 Skia 재렌더 방지)
[완료 트리거: Enter(단일행) / Cmd+Enter(멀티행) / 외부 클릭]
  ↓
store.finishTextEditing(newValue)
  ↓
1. 히스토리 기록 (원본 → 최종, 단일 블록)
2. 요소 textContent 업데이트 (store.updateElement)
3. DOM 오버레이 제거
4. Skia 텍스트 렌더링 복원 (업데이트된 텍스트로)
5. DB Persist + Preview Sync (백그라운드)
  ↓
[취소 트리거: Escape]
  ↓
store.cancelTextEditing() → 원본 복원, DOM 오버레이 제거, Skia 복원
```

---

## 구현 노트: Phase 0 — Pencil 방식 이벤트 시스템 리팩토링 (Phase A 선행 조건)

### 동기

현재 composition는 PixiJS EventBoundary 기반으로 SelectionBox/TransformHandle/ElementSprite 각각이 `eventMode="static"`으로 이벤트를 처리한다. SelectionBox의 moveArea가 이벤트를 가로채서 더블클릭이 하위 요소에 전달되지 않는 **구조적 문제**가 있다 (아래 "구현 노트: SelectionBox 더블클릭 감지" 참조).

Pencil은 중앙 집중 좌표 기반 히트 테스트로 이 문제가 원천적으로 없다. Phase 0에서 이벤트 시스템을 Pencil 방식으로 리팩토링하여 Phase A의 더블클릭 감지를 안정적으로 동작시킨다.

### Pencil 이벤트 아키텍처 (참조: `docs/pencil-extracted/engine/07_scenegraph.txt`)

```
IdleState.onPointerDown (중앙 핸들러)
  1. doubleClick 체크 (lastClickTime 300ms)
  2. updateIntersection() → nodeUnderCursor + selectionBoundingBoxUnderCursor
  3. 분기:
     - doubleClick → 텍스트 편집 또는 그룹 진입
     - selectionBounds 밖 + 노드 있음 → 선택 + 드래그 준비
     - selectionBounds 밖 + 노드 없음 → lasso
     - selectionBounds 안 → 이동 드래그 준비
```

핵심: **더블클릭 판정이 선택 영역 히트 판정보다 먼저 실행**된다. 선택 영역(guidesGraph)은 시각 전용이며 이벤트를 가로채지 않는다.

### composition 적용 계획

#### 제거 대상

| 대상                                                                        | 현재 역할                                | 제거 이유                             |
| --------------------------------------------------------------------------- | ---------------------------------------- | ------------------------------------- |
| SelectionBox: `moveArea eventMode="static"` + `onPointerDown`               | 선택 영역 내 드래그 시작                 | 중앙 핸들러가 좌표 기반으로 대체      |
| TransformHandle: `eventMode="static"` + `onPointerDown/Over/Out`            | 리사이즈 핸들 인터랙션                   | 중앙 핸들러가 핸들 히트 테스트로 대체 |
| ElementSprite: `eventMode="static"` + `onClick/onDoubleClick/onPointerDown` | 요소 선택/더블클릭                       | 중앙 핸들러가 요소 히트 테스트로 대체 |
| SelectionLayer: `onResizeStart/onMoveStart/onCursorChange` props            | SelectionBox → BuilderCanvas 이벤트 전달 | 중앙 핸들러 직접 호출로 대체          |
| BuilderCanvas: `handleResizeStart/handleMoveStart/handleCursorChange`       | SelectionLayer 경유 이벤트 처리          | 중앙 핸들러에 통합                    |

#### 추가 대상

| 파일                 | 추가 내용                                          | 역할                                                                                               |
| -------------------- | -------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `types.ts`           | `hitTestHandle()`, `hitTestSelectionBounds()` 유틸 | 좌표 기반 핸들/선택 영역 히트 판정                                                                 |
| `BuilderCanvas.tsx`  | DOM `pointerdown` 중앙 핸들러                      | 우선순위 기반 분기: doubleClick (lastClickTime 300ms) → handle → selectionBounds → element → lasso |
| `BuilderCanvas.tsx`  | DOM `pointermove` 커서 변경                        | handle hover 좌표 기반 커서 스타일 결정                                                            |
| `elementRegistry.ts` | `findElementAtPosition()`                          | z-order 역순 bounds 히트 테스트                                                                    |

#### 유지 (변경 없음)

- `useDragInteraction.ts` — `startMove/startResize/startLasso` 그대로 (중앙 핸들러가 호출)
- `selectionRenderer.ts` (Skia) — 시각적 렌더링 그대로 (이벤트 가로채기만 제거)
- SelectionBox imperative handle — 드래그 중 PixiJS position 조작 그대로

### Phase A 변경: Quill 에디터 통합

기존 ADR-027 Phase A의 contenteditable div 대신 Quill 에디터 사용 (Pencil과 동일):

#### Pencil `nUt` 클래스 패턴 요약

```
- new Quill(element, { modules: { toolbar: false }, formats: ['text'] })
- node.hideText() / node.showText() — Skia 텍스트 숨김/표시
- CSS transform: matrix() — camera.worldTransform × node.worldMatrix
- text-change 이벤트 → 실시간 노드 업데이트
- Undo: beginUpdate() snapshot → commitBlock({ undo: true }) on destroy
- Enter/Escape → destroy (편집 완료)
- 외부 클릭 → destroy
```

#### composition 적용

| Pencil 개념              | composition 대응                                                                     | 파일          |
| ------------------------ | ------------------------------------------------------------------------------------ | ------------- |
| `nUt` 클래스 (편집 세션) | `QuillTextEditor` 클래스                                                             | 신규          |
| `iUt` 함수 (React 훅)    | `useTextEditor` React hook                                                           | 신규          |
| DOM 컨테이너             | `TextEditOverlay` 컴포넌트 — absolute positioned div, `pointer-events-none` 컨테이너 | 기존 A-3 대체 |
| `node.hideText()`        | Skia `nodeRenderers`에서 `editingElementId` 체크 시 텍스트 숨김                      | 기존 A-4 유지 |
| `canvasStore` 상태       | `editingElementId` / `editingOriginalValue`                                          | 기존 A-1 유지 |

#### contenteditable → Quill 전환 근거

- **일관성**: Pencil과 동일한 에디터 → 역공학 분석 결과를 직접 활용 가능
- **확장성**: Phase D의 리치 텍스트 지원 시 Quill의 Delta 기반 포맷팅 활용 (contenteditable 직접 제어보다 안정적)
- **IME 지원**: Quill이 한글/일본어/중국어 IME 조합을 내부적으로 처리 (contenteditable의 compositionstart/end 직접 관리 불필요)
- **번들 영향**: Quill core ~40KB gzipped — 텍스트 편집 활성화 시 lazy load (`import()`) → 초기 번들 영향 없음

---

## 구현 노트: SelectionBox 더블클릭 감지

### 문제

첫 번째 클릭으로 요소가 선택되면 SelectionBox가 마운트되어 moveArea(투명 히트 영역)가 두 번째 클릭을 가로챈다. 따라서 TextSprite의 자체 더블클릭 감지(`lastPointerDownRef` 300ms 비교)가 작동하지 않는다.

```
1st click → TextSprite pointerDown → 요소 선택 → SelectionBox 마운트 (moveArea 생성)
2nd click → SelectionBox moveArea pointerDown (TextSprite에 도달 못함)
```

### 시도 1: SelectionBox 내부 수동 더블클릭 감지 — 실패

SelectionBox의 `handleMovePointerDown`에서 `lastPointerDownRef`로 300ms 타임스탬프 비교하여 더블클릭 감지 시도.

**실패 원인**: SelectionBox는 요소 선택 후 새로 마운트되므로 `lastPointerDownRef`가 초기값(0)으로 시작. 첫 번째 클릭 타임스탬프를 알 수 없어 `now - 0` = 매우 큰 값 → 더블클릭으로 판정되지 않음.

### 시도 2: `useRef(Date.now())` 초기화 — 실패

SelectionBox 마운트 시점을 첫 번째 클릭 시점의 근사값으로 사용하여 `lastPointerDownRef = Date.now()`로 초기화.

**실패 원인**: SelectionBox 마운트는 `requestAnimationFrame` 지연(selectionBounds 계산)을 거치므로 실제 첫 번째 클릭과의 시간차가 불안정. RAF + React 렌더 사이클(2회 이상) → 타이밍 보장 불가.

### 시도 3: DOM `dblclick` 이벤트 리스너 — 성공

캔버스 컨테이너 div에 브라우저 네이티브 `dblclick` DOM 이벤트 리스너를 등록.

```typescript
// BuilderCanvas.tsx
useEffect(() => {
  const el = containerRef.current;
  if (!el) return;
  const handler = () => {
    const { selectedElementIds } = useStore.getState();
    if (selectedElementIds.length === 1) {
      handleElementDoubleClick(selectedElementIds[0]);
    }
  };
  el.addEventListener("dblclick", handler);
  return () => el.removeEventListener("dblclick", handler);
}, [handleElementDoubleClick]);
```

**성공 이유**: 브라우저가 자체적으로 두 번의 click을 추적하여 `dblclick` 이벤트를 발생시킨다. PixiJS의 이벤트 가로채기(SelectionBox moveArea)와 무관하게, 캔버스 HTML 요소에서 항상 발생한다. SelectionBox 마운트 타이밍, PixiJS 이벤트 전파 등에 영향받지 않음.

**핵심 교훈**: PixiJS 이벤트 시스템 내부에서 더블클릭을 감지하려 하면 레이어 간 이벤트 가로채기 문제가 발생한다. DOM 네이티브 이벤트를 활용하면 이 문제를 완전히 우회할 수 있다.

---

## Pencil 텍스트 편집 구현 분석 (역공학)

> 소스: `docs/pencil-extracted/` — Pencil Desktop v1.1.10 역공학 추출물

### 아키텍처 개요

Pencil의 텍스트 편집은 **상태 머신 + EventEmitter + Quill 에디터 + DOM 오버레이** 패턴으로 구성된다.

```
[더블클릭 감지]
  ↓
SelectionManager.lastClickTime 300ms 비교 (onPointerDown 내부)
  ↓ (더블클릭 확인)
IdleState.onDoubleClick()
  ↓ (text/note/prompt/context 타입이면)
textEditorManager.startTextEditing(node)
  ↓
1. stateManager.transitionTo(EditingTextState)  — 상태 머신 전환
2. eventEmitter.emit("startTextEdit", node)     — React 훅에 알림
  ↓
[EditingTextState]
- onEnter(): isEditingText=true, editingNodeId=node, guidesGraph.clear()
- onPointerDown/Move/Up(): 빈 함수 (모든 포인터 이벤트 무시)
- confirmEdit()/cancelEdit(): finishTextEditingInternal() → IdleState 복귀
```

### 더블클릭 감지 방식

Pencil은 **SelectionManager에서 lastClickTime을 중앙 관리**한다 (07_scenegraph.txt:1211-1217):

```javascript
// IdleState.onPointerDown() 내부 (activeTool === "move" 분기)
const now = Date.now();
const isDoubleClick = now - selectionManager.getLastClickTime() < 300;
selectionManager.setLastClickTime(now);
if (isDoubleClick) {
  this.onDoubleClick(); // pointerDownNode를 사용
  return;
}
```

**핵심 차이점 (composition 대비):**

Pencil도 선택 영역 시각화(바운딩 박스, 핸들)가 있지만 이벤트 처리 방식이 근본적으로 다름:

- **Pencil의 선택 영역 렌더링**: `guidesGraph`/`guidesManager`가 PixiJS로 **시각적으로만 렌더링**. 히트 테스팅은 PixiJS EventBoundary가 아닌 **직접 좌표 비교** (`getWorldspaceBounds().containsPoint()`)로 처리. 선택 영역이 포인터 이벤트를 가로채지 않음.
- **Pencil의 이벤트 순서**: `onPointerDown` → (1) 더블클릭 판정(lastClickTime 300ms) → (2) `updateIntersection`(선택 영역 히트 판정) — 더블클릭 체크가 선택 영역 체크**보다 먼저** 실행됨
- **composition의 차이**: SelectionBox moveArea가 PixiJS `eventMode="static"`으로 EventBoundary 히트 테스트를 가로챔 → 두 번째 pointerDown이 하위 TextSprite에 도달 못함
- `lastClickTime`이 `SelectionManager`에 영속 보관 — 상태 전환/컴포넌트 마운트와 무관
- **결론**: composition는 PixiJS EventBoundary 기반이므로 Pencil 방식(직접 좌표 비교) 적용 불가 → **DOM dblclick 이벤트**로 우회

### Quill 에디터 통합 (index.txt:222036-222189)

`nUt` 클래스 — 텍스트 편집 세션 객체:

```
constructor(sceneManager, parentElement, node):
  1. node.hideText()                          — Skia 텍스트 렌더링 숨김
  2. element = document.createElement("div")  — DOM 컨테이너 생성
  3. quill = new Quill(element, { toolbar: false, formats: ["text"] })
  4. originalUndoSnapshot = scenegraph.beginUpdate()  — undo 트랜잭션 시작
  5. snapshot node.textContent                — 원본 스냅샷
  6. quill.setText(originalText)              — 에디터 초기값
  7. quill.setSelection(0, text.length)       — 전체 선택
  8. quill.on("text-change", callback)        — 실시간 노드 업데이트 (undo: false)
  9. keydown: Cmd+Enter/Escape → destroy()
 10. RAF → document.addEventListener("mousedown", clickOutside)
 11. quill.focus()

destroy():
  1. finishTextEditing()                      — 상태 머신 복귀
  2. element 제거
  3. document.removeEventListener("mousedown")
  4. node.showText()                          — Skia 텍스트 렌더링 복원
  5. node.isEmpty() → deleteNode (빈 텍스트면 노드 삭제)
  6. scenegraph.commitBlock(originalUndoSnapshot, { undo: true }) — 단일 undo 블록
```

### DOM 포지셔닝 (행렬 기반)

```javascript
// updateSize() — camera.worldTransform + node.getWorldMatrix() 합성
const matrix = new Matrix();
matrix.append(camera.worldTransform); // 줌/팬 반영
matrix.append(node.getWorldMatrix()); // 노드의 월드 좌표
element.style.transform = `matrix(a,b,c,d,tx,ty) translate(bounds.minX, bounds.minY)`;
quill.root.style.width = `${Math.ceil(bounds.width)}px`;
quill.root.style.height = `${Math.ceil(bounds.height)}px`;
```

**뷰포트 변경 동기화**: `eventEmitter.on("afterUpdate", handleViewportChange)` — 줌/팬 변경마다 `updateSize()` 재호출

### Skia 텍스트 숨김 (hideText/showText)

노드 타입별 구현 (06_node-extensions.txt):

- **TextNode (`Ux`)** — `isTextHidden` 플래그 + `invalidateView()` (렌더 캐시 무효화)
- **StickyNode (`oI`)** — 동일 패턴

```javascript
// TextNode
hideText() { this.isTextHidden = true; this.invalidateView(); }
showText() { this.isTextHidden = false; this.invalidateView(); }
```

렌더 시 `isTextHidden`이면 텍스트 드로잉 스킵, 배경/보더는 유지.

### 폰트 스타일 동기화 (getTextAreaInfo)

`getTextAreaInfo(skiaRenderer)` — DOM 에디터에 적용할 CSS 스타일 추출:

```javascript
return {
  bounds: node.localBounds(), // { minX, minY, width, height }
  style: {
    fontFamily: fontManager
      .getFontList(matchedFont)
      .map((f) => `"${f}"`)
      .join(", "),
    fontSize: `${resolvedFontSize}px`,
    lineHeight:
      lineHeight !== 0
        ? `${Math.round(lineHeight * fontSize) / fontSize}`
        : "normal",
    fontWeight: String(resolvedFontWeight),
    color: getFirstFillColor() ?? "black",
    textAlign: resolvedTextAlign,
    fontStyle: resolvedFontStyle,
    letterSpacing: `${letterSpacing / fontSize}em`,
  },
};
```

**핵심**: `fontManager.matchFont()` → `getFontList()` — Skia FontManager에 등록된 실제 폰트 이름을 CSS fontFamily로 변환. composition의 `buildFontFamilies()` / `resolveFamily()`와 동일 목적.

### Undo 통합 패턴

1. **편집 시작**: `beginUpdate()` → `snapshotProperties(node, ["textContent"])` — 원본 스냅샷
2. **편집 중**: `commitBlock(update, { undo: false })` — 실시간 반영하되 undo 기록 안 함
3. **편집 완료**: `commitBlock(originalSnapshot, { undo: true })` — 원본→최종을 단일 undo 블록으로 커밋
4. **빈 텍스트**: 편집 완료 시 `node.isEmpty()` → `deleteNode` (빈 텍스트 노드 자동 삭제)

### 키보드 단축키

| 키                                           | 동작                                           |
| -------------------------------------------- | ---------------------------------------------- |
| **Cmd/Ctrl + Enter**                         | 편집 완료 (`destroy()`)                        |
| **Escape**                                   | 편집 취소 (`destroy()`)                        |
| **Enter** (선택된 텍스트 노드, 편집 모드 밖) | `startTextEditing()` (index.txt:223372-223382) |

### React 훅 연결 (useTextEditor)

```javascript
// iUt 함수 — React 훅 (index.txt:222162-222189)
const containerRef = useRef(null);
const editorRef = useRef(null);

useEffect(() => {
  function startHandler(node) {
    editorRef.current?.destroy();
    editorRef.current = new TextEditor(
      sceneManager,
      containerRef.current,
      node,
    );
  }
  function finishHandler() {
    editorRef.current?.destroy();
  }
  eventEmitter.on("startTextEdit", startHandler);
  eventEmitter.on("finishTextEdit", finishHandler);
  return () => {
    /* cleanup */
  };
}, [sceneManager]);

// DOM 구조
return (
  <div
    data-pencil-canvas-text-editor
    className="absolute inset-0 pointer-events-none"
  >
    <div className="fixed" ref={containerRef} />
  </div>
);
```

### composition 대비 Pencil 차이점 요약

| 항목                 | Pencil                                                                                           | composition (ADR-027)                                               |
| -------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------- |
| **에디터**           | Quill (리치 텍스트 지원)                                                                         | contenteditable div (플레인 텍스트)                                 |
| **더블클릭 감지**    | SelectionManager.lastClickTime 300ms (중앙 관리, 선택 영역 히트 판정보다 먼저 실행)              | DOM `dblclick` 이벤트 (브라우저 네이티브)                           |
| **선택 영역 이벤트** | 시각 전용 렌더링(`guidesGraph`), 히트 테스팅은 직접 좌표 비교(`containsPoint`) — 이벤트 비가로챔 | SelectionBox moveArea가 PixiJS EventBoundary로 포인터 이벤트 가로챔 |
| **상태 머신**        | `EditingTextState` 전용 상태 (포인터 이벤트 전부 무시)                                           | `canvasStore.isEditing` 플래그                                      |
| **이벤트 브릿지**    | EventEmitter (`startTextEdit`/`finishTextEdit`)                                                  | Zustand subscribe (canvasStore)                                     |
| **포지셔닝**         | `camera.worldTransform × node.worldMatrix` → CSS `matrix()`                                      | `getElementBoundsSimple()` → absolute positioning                   |
| **Skia 숨김**        | `node.hideText()` / `showText()` (invalidateView)                                                | `setEditingElementId()` → renderText 스킵                           |
| **Undo**             | beginUpdate → 실시간 반영(undo:false) → commitBlock(undo:true)                                   | DOM 내부만 변경 → finishEdit 시 store 업데이트 (히스토리 자동)      |
| **실시간 동기화**    | Quill text-change → node.textContent 즉시 업데이트                                               | DOM 내부에서만 반영 (store 업데이트 없음)                           |
| **빈 텍스트 처리**   | 편집 완료 시 isEmpty → 노드 자동 삭제                                                            | 미구현                                                              |
| **뷰포트 추적**      | eventEmitter.on("afterUpdate") → updateSize()                                                    | Phase B 범위                                                        |

---

## 참조

- Pencil 구현 분석: `docs/pencil-extracted/` (engine/07, 11, 12, 13, 14, ui/19)
- Pencil vs composition 비교: `docs/legacy/PENCIL_VS_XSTUDIO_UI_UX.md`
- Skia 텍스트 렌더링: `apps/builder/src/builder/workspace/canvas/skia/nodeRenderers.ts`
- Spec 텍스트 스타일: `apps/builder/src/builder/workspace/canvas/skia/specTextStyle.ts`
- 멀티페이지: `docs/MULTIPAGE.md`
- 카메라: `apps/builder/src/builder/workspace/canvas/hooks/useCamera.ts`

---

## 구현 계획: Phase C (2026-03-08)

### 현황 분석

Phase A+B 완료로 기본 인프라가 확립되어 있다:

- `useTextEdit.ts`: TEXT_ELEMENT_TAGS에 Button, Badge, Tag, Link 등록 완료. 단 **ToggleButton 미포함**.
- `specTextStyleForOverlay.ts`: `extractFullSpecTextStyle()` — TEXT_BEARING_SPECS에 Button, Badge, ToggleButton, Link, Checkbox, Radio, Switch, Input 등록 완료. Spec shapes에서 textShape.x/y/fontSize/fontWeight/fontFamily/fill 추출 가능 (Gate G4 통과).
- `BuilderCanvas.tsx`: `handleElementDoubleClick`의 textTags에 Button, Badge, Tag 포함 완료.
- `getTextPropKey()`: 현재 props 기반 키 탐색(value → children → text → label). Button/Badge의 `label` prop은 탐색 체인에 이미 포함.
- `setEditingElementId()`: Skia 텍스트 숨김 처리 존재 (nodeRenderers.ts).
- `getElementBoundsSimple()`: 요소 **전체** container bounds 반환. Spec 컴포넌트의 텍스트 shape 내부 offset(textShape.x/y)은 미반영.

### 변경 파일 목록

| 파일                                           | 구분 | 변경 내용                                                                    |
| ---------------------------------------------- | ---- | ---------------------------------------------------------------------------- |
| `workspace/overlay/useTextEdit.ts`             | 수정 | TEXT_ELEMENT_TAGS에 ToggleButton 추가, Spec 컴포넌트용 bounds 보정 로직      |
| `workspace/overlay/TextEditOverlay.tsx`        | 수정 | Spec 컴포넌트 편집 시 padding/verticalAlign 오프셋 적용, 편집 중 크기 동기화 |
| `workspace/overlay/specTextStyleForOverlay.ts` | 수정 | `extractSpecTextBounds()` 함수 추가 — textShape의 x/y/width/height 반환      |
| `workspace/canvas/BuilderCanvas.tsx`           | 수정 | textTags에 ToggleButton, Link 추가 (더블클릭 대상 확장)                      |

### 구현 순서

#### Step 1: TEXT_ELEMENT_TAGS 및 textTags 확장

**대상**: `useTextEdit.ts`, `BuilderCanvas.tsx`

1. `useTextEdit.ts`의 `TEXT_ELEMENT_TAGS`에 `"ToggleButton"` 추가 (Link는 이미 존재)
2. `BuilderCanvas.tsx`의 `handleElementDoubleClick` 내부 `textTags` Set에 `"ToggleButton"`, `"Link"` 추가 (Link = `"a"` 소문자는 이미 존재하나 PascalCase `"Link"` 확인 필요)

검증: ToggleButton/Link 더블클릭 → useTextEdit.startEdit 호출 확인

#### Step 2: Spec 텍스트 bounds 추출 함수 추가

**대상**: `specTextStyleForOverlay.ts`

`extractSpecTextBounds(tag, props)` 함수 신규 추가:

```
- Spec shapes에서 textShape 탐색
- boxShape(컨테이너)와 textShape의 상대 위치 계산
- 반환: { offsetX, offsetY, textWidth, textHeight } | null
  - offsetX = textShape.x (= paddingLeft)
  - offsetY = textShape.y (= paddingTop)
  - textWidth = boxShape.width - textShape.x * 2 (좌우 대칭 가정)
  - textHeight = textShape.lineHeight * textShape.fontSize (또는 boxShape 기준)
```

이미 `extractFullSpecTextStyle()`에서 textShape.x/y를 padding으로 추출하고 있으므로, bounds 계산은 이 데이터의 재활용이다.

#### Step 3: TextEditOverlay Spec bounds 보정

**대상**: `TextEditOverlay.tsx`

현재 오버레이 위치는 `getElementBoundsSimple()` 전체 bounds 기준이다. Spec 컴포넌트 편집 시:

1. `extractSpecTextBounds()`로 내부 텍스트 영역 offset 조회
2. 오버레이 position에 offsetX/offsetY 가산, 크기를 textWidth/textHeight로 축소
3. `verticalAlign: "center"` (Button 등 수직 중앙 정렬)일 때 Y 보정:
   - `offsetY = (containerHeight - textHeight) / 2`

이 보정으로 오버레이가 Button 내부의 텍스트 영역에 정확히 겹친다.

#### Step 4: getTextPropKey 확장 (필요 시)

**대상**: `useTextEdit.ts`

현재 `getTextPropKey()`는 props 키 탐색 순서가 `value → children → text → label`이다.

- Button: `label` prop 사용 → 탐색 체인에 포함 (OK)
- Badge: `label` 또는 `children` → 포함 (OK)
- ToggleButton: `label` prop → 포함 (OK)
- Link: `children` 또는 `label` → 포함 (OK)

**추가 필요 없음** (기존 탐색 체인이 모든 대상 컴포넌트를 커버). 만약 특정 태그에서 우선순위 역전이 발견되면 tag별 명시적 매핑 테이블로 전환.

#### Step 5: 편집 완료 시 크기 재계산

**대상**: `useTextEdit.ts`의 `completeEdit`

현재 `silentUpdateTextProp()`이 `layoutVersion + 1`을 증가시키므로, 편집 중 실시간 레이아웃 갱신은 이미 동작한다.

추가 확인 사항:

- fit-content 요소(Badge 등): 텍스트 변경 → layoutVersion 증가 → Taffy 재계산 → 요소 크기 변동 → 오버레이 크기도 동기화 필요
- `TextEditOverlay`에서 `subscribeBounds()` 또는 `layoutVersion` 구독을 통해 편집 중 오버레이 크기를 업데이트하는 로직 확인/추가

### Gate 검증 항목

| Gate | 검증 내용                                                 | 통과 조건                                                                 |
| ---- | --------------------------------------------------------- | ------------------------------------------------------------------------- |
| G4-1 | ToggleButton 더블클릭 → 텍스트 편집 모드 진입             | 인라인 오버레이 표시, 기존 텍스트 값 로드                                 |
| G4-2 | Button label 편집 시 오버레이가 텍스트 영역에 정확히 겹침 | 오버레이 위치가 Button 내부 텍스트 shape bounds와 2px 이내 일치 (100% 줌) |
| G4-3 | Badge 편집 후 fit-content 크기 변동                       | 텍스트 길이 변경 → Badge 크기 재계산 → 오버레이 크기 동기화               |
| G4-4 | 편집 완료 시 히스토리 기록                                | Undo → 원본 텍스트 복원, Redo → 편집 텍스트 복원                          |
| G4-5 | Spec 컴포넌트 텍스트 숨김                                 | 편집 중 Skia에서 텍스트 shape만 숨김, 배경/보더는 유지                    |

### 예상 위험 및 대응

| 위험                           | 등급  | 설명                                                                                                                     | 대응                                                                                                                                                  |
| ------------------------------ | ----- | ------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Spec textShape bounds 정확도   | **M** | textShape.x/y가 실제 렌더링 위치와 미세 차이 가능 (Spec shapes의 좌표가 Skia paragraph 배치와 1:1 대응하지 않을 수 있음) | `extractSpecTextBounds()`의 offset에 보정 상수(fudge factor) 적용. Gate G4-2에서 검증 후 조정.                                                        |
| fit-content 실시간 동기화      | **L** | 편집 중 텍스트 변경 → 요소 크기 변동 → 오버레이 위치/크기 재계산 타이밍 지연                                             | `silentUpdateTextProp`이 이미 layoutVersion 증가. `subscribeBounds` 콜백에서 오버레이 위치 업데이트.                                                  |
| Skia 텍스트 부분 숨김          | **L** | `setEditingElementId()`가 요소 전체 텍스트를 숨기므로, 복수 textShape가 있는 Spec(현재 없음)에서 의도치 않은 숨김 가능   | 현재 대상 컴포넌트(Button, Badge, ToggleButton, Link)는 모두 단일 textShape. 복수 textShape 컴포넌트 추가 시 shape-level 숨김으로 확장.               |
| ToggleButton pressed 상태 편집 | **L** | ToggleButton이 pressed 상태일 때 텍스트 색상이 다를 수 있음                                                              | `extractFullSpecTextStyle()`이 이미 variant/state 기반 shapes 생성. pressed 상태의 색상을 `"default"` 대신 현재 상태 전달로 확장 가능 (Phase C 이후). |
