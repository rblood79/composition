# ADR-911 Phase 3 — Frame Canvas Authoring 시각 path Breakdown

> **상태**: Closed (2026-04-30) — P3-α/β/γ/δ + δ fix #1~#4 + θ + P3-ε/P3-ζ closure 완료. ADR-911 본문 G3/G4/G5 잔여는 별도 진행
> **연결 ADR**: [911](../completed/911-layout-frameset-pencil-redesign.md) Phase 3 sub-phase
> **prerequisite**: 본 sub-phase 가 [ADR-912](../completed/912-editing-semantics-ui-5elements.md) 의 Canvas 시각 마커 land 의 prerequisite
>
> **2026-05-05 rollback / 2026-05-06 follow-up**: 2026-05-03 post-cutover fix 군은 폐기됐다. 2026-05-06 current main follow-up 패치에서 FramesTab/Skia body/Slot refresh projection, shared frame multi-page projection, Slot marker 유지, body auto-selection 을 다시 닫았다. 이 문서의 historical `layout_id` 기반 D1/A 구현 기록은 superseded 되었고, 현행 frame render root 는 active `CompositionDocument` 기반 projection / adapter mirror boundary 를 사용한다.

## 1. 결함 요약

### 사용자 시나리오

1. FramesTab 에서 새 Frame 추가 (Frame 1, Frame 2 등)
2. Inspector 에서 Layout Preset 선택 (예: "수직 2단", "수직 3단")
3. **기대**: Skia 캔버스에 영역 구분 slot 들이 시각화 (header / content / footer 분리선)
4. **실제**: Skia 캔버스에 page (Home) 사각형만 표시. frame body + slot 영역 미렌더

### 측정 evidence (세션 46 Chrome MCP)

```js
// Builder dev runtime store state
pagePositions: { "234dc7c9-...": { x: 0, y: 0 } }   // ← page 1개만, frame 좌표 0건
editingContextId: null                              // ← frame editing context 진입 path 없음
elementsMap: 8 elements                             // page body + Frame 1 body+2 Slots + Frame 2 body+3 Slots
childrenMap.root = [
  "29f8a4b0",  // page body (page=234dc7c9)
  "91c01890",  // Frame 1 body (layout=f49ac75d) — root 자식이지만 viewport 밖
  "77ae39dc",  // Frame 2 body (layout=9c945c91) — 동일
]
```

### Root cause 진단 (3 layer)

| Layer                   | 결함                                                                                                                                             | 영향                                                       |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------- |
| **L1**: 좌표 등록       | `pagePositions` 가 page id 만 key. frame id 의 좌표 등록 path 부재 (`updatePagePosition: (pageId, x, y)`)                                        | frame body 의 viewport 좌표 없음 → 캔버스에 그릴 영역 없음 |
| **L2**: 그룹 계산       | `computeLayoutGroups(pages, layouts, doc)` 가 page-layout 매핑 (그래픽 그룹 라벨링) 만. frame 자체를 별도 캔버스 영역으로 그릴 그룹화 logic 없음 | frame editing 시 별도 영역 계산 안 됨                      |
| **L3**: editing context | `editingContextId` 가 frame 선택 시 frame.id 로 갱신되지 않음. SkiaCanvas 가 frame editing 모드 인지 path 없음                                   | frame editing 진입 시각 표현 불가                          |

### Cutover 의 의미

- ADR-911 cutover commit `7b6f4eb9` (Phase 2 PR-E4) = **`featureFlags` default true flip 만** (4 file / 38/-8 라인, 실 logic 0건)
- 즉 frame canvas authoring 시각 path 는 **dual-mode (legacy/canonical 모두) 시절부터 미구현**
- cutover 가 회귀를 만든 게 아니라 **ADR-911 design 자체의 fundamental 미완성** 노출
- Gate G2 (시각 회귀 0) 충족 불가 → Phase 2 closure 보류

## 2. Sub-phase 분해

| Sub-phase | 작업                                                                                                                                                                                                   | 예상 비용 |   위험   |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :-------: | :------: |
| **P3-α**  | `pagePositions` 확장 또는 신규 `framePositions` map 도입 — frame id → `{x, y, width, height}` 저장 + 갱신 setter                                                                                       |    1d     |   MED    |
| **P3-β**  | `computeLayoutGroups` 확장 — frame 별 캔버스 영역 그룹 추가. selectedReusableFrameId 또는 모든 reusable frame 을 별도 영역으로 계산                                                                    |    1d     |   MED    |
| **P3-γ**  | frame editing indicator 갱신 path — `selectReusableFrame` 이 `useLayoutsStore.selectedReusableFrameId` 갱신 (이미 구현). 캔버스 consumer 가 indicator read 후 P3-δ render 분기                         |   0.5d    |   LOW    |
| **P3-δ**  | Skia render path 통합 — BuilderCanvas 의 page viewport 외에 frame viewport 추가. frame body+slot 들이 frame viewport 안에 그려짐                                                                       |    2d     | **HIGH** |
| **P3-ε**  | hit-test/selection/hover 통합 + Pencil drag semantics 정리 — frame 영역도 사용자 인터랙션 가능. Drag 는 자유 이동이 아니라 위치 소유권에 따라 수동 `x/y` 이동 또는 layout-aware reorder/drop 으로 해석 |   1.5d    |   MED    |
| **P3-ζ**  | Chrome MCP 시각 회귀 검증 + roundtrip — Frame 추가 → Layout preset 적용 → Skia slot 시각화 사용자 시나리오 GREEN                                                                                       |   0.5d    |   LOW    |

**총 예상**: 6.5d ≈ **1주+** HIGH

## 3. 대안 검토

### 대안 A: 본 sub-phase 분해대로 진입 (frame canvas viewport 신규 도입)

- 위험: 기술(M) / 성능(M) / 유지보수(M) / 마이그레이션(L)
- 장점: pencil app 호환 design 정합 (frame 이 1급 캔버스 영역)
- 단점: 1주+ HIGH 작업, BuilderCanvas 광범위 변경

### 대안 B: page.layout_id 기반 inline 시각화 (frame body 를 page 안에 그림)

- 위험: 기술(L) / 성능(L) / 유지보수(M) / 마이그레이션(L)
- 장점: pagePositions 확장 불필요. page → frame 통합 시각 표현
- 단점: 한 page 가 한 frame 만 적용 가능 (현재 model). reusable frame 의 다중 page 사용 시 각 page 마다 동일 frame 시각 반복 — 사용자 인지 저하
- pencil app 의 frame editing semantics 와 정합 안 됨

### 대안 C: page.layout_id 자동 cleanup + 사용자 인지 변경 (frame 자체는 시각화 안 함)

- 위험: 기술(L) / 성능(L) / 유지보수(L) / 마이그레이션(L)
- 장점: 최소 변경. 단순 데이터 정합 fix
- 단점: 사용자가 FramesTab 에서 Frame 추가/편집 시 시각 feedback 0 — UX 손실
- ADR-911 의 핵심 가치 (frame authoring) 자체 포기

### Risk Threshold Check

| 대안 | HIGH+ | 판정                         |
| ---- | :---: | ---------------------------- |
| A    |   0   | 채택 권장 (1주+ 비용 수용)   |
| B    |   0   | 채택 가능, 사용자 인지 단점  |
| C    |   0   | 채택 가능, ADR-911 가치 손실 |

대안 A 채택 권장 — pencil app 호환 design 정합 + 사용자 인지 완성. 단, 본격 land 는 별도 세션 (1주+ HIGH).

## 4. Gate

| Gate     | 시점      | 통과 조건                                                                                                                                                                                                                                  | 실패 시                     |
| -------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------- |
| **G3-α** | P3-α 완료 | (a) `framePositions` 또는 확장된 `pagePositions` 에 frame id 좌표 저장 (b) updatePosition setter 동작 (c) test 5/5 PASS                                                                                                                    | 데이터 모델 재검토          |
| **G3-β** | P3-β 완료 | (a) computeLayoutGroups 가 frame 영역 그룹 반환 (b) 기존 page 그룹화 회귀 0                                                                                                                                                                | layoutGroup 알고리즘 재검토 |
| **G3-γ** | P3-γ 완료 | (a) `selectReusableFrame(frameId)` 후 `selectedReusableFrameId === frameId` (b) `selectReusableFrame(null)` 후 `selectedReusableFrameId === null` (c) `editingContextId` 미충돌 (element-id semantic 보존)                                 |                             |
| **G3-δ** | P3-δ 완료 | (a) Skia 캔버스에 frame body 영역 그려짐 (b) frame body 자식 (slot) 도 영역 안에 그려짐 (c) Chrome MCP screenshot 사용자 시나리오 GREEN                                                                                                    | render 알고리즘 재검토      |
| **G3-ε** | P3-ε 완료 | (a) frame body 클릭 시 selection (b) hover outline 표시 (c) drag semantics 는 Pencil 기준 준수: manual-position node 는 `x/y` 갱신, layout/overview 가 위치를 소유하면 자유 이동 대신 reorder/drop intent 또는 explicit non-draggable 처리 |                             |
| **G3-ζ** | P3 종결   | (a) Chrome MCP 사용자 회귀 시나리오 100% GREEN (b) `mockLargeDataV2` 시각 회귀 0 (c) 기존 page 캔버스 회귀 0                                                                                                                               | 부분 land 후 후속           |

## 4.5. P3-γ 설계 결정 (세션 47, B 채택)

본 sub-phase 의 indicator 필드는 **`editingContextId` (X) → `selectedReusableFrameId` (✓)** 로 정정.

**왜**: `editingContextId` 는 `elements.ts` 정의로 element id 타입. `resolveClickTarget` (`hierarchicalSelection.ts:25`) 가 `parent_id` chain 을 탐색하여 직계 자식 식별 — frameId (legacy layoutId) 직접 대입 시 chain 매칭 실패 → `useCanvasElementSelectionHandlers.ts:187` 의 자동 exit 분기 trigger → 사용자가 첫 클릭만에 frame editing 모드 강제 종료.

**대안**: `selectedReusableFrameId` (`useLayoutsStore`, ADR-903 P3-B 도입) 는 이미 frame editing indicator 로 설계됐고 `selectReusableFrame` 이 갱신 중. 캔버스 read path 만 P3-δ Skia render 통합 시 추가 (dead read 회피).

**대등 분리**: P3-α 의 `framePositions` 별도 map 결정과 동일한 domain 분리 패턴 — `editingContextId` (element 클릭 scope) 와 `selectedReusableFrameId` (frame 편집 indicator) 의 semantic 충돌 회피.

## 4.6. P3-δ 진입 inventory (세션 47, P3-δ-1)

### Render 경로 chain (Skia frame pipeline)

```
BuilderCanvas.tsx (line 230-381)
   ↓ subscribe pagePositions / pagePositionsVersion / sceneSnapshot
createSkiaRendererInput (rendererInput.ts:76-106)
   ↓ rendererInput { pages, pageSnapshots, pagePositions, pagePositionsVersion, ... }
skiaFramePipeline.ts:229
   ↓ collectVisiblePageRoots(rendererInput)
visiblePageRoots.ts:15
   ↓ for (const page of rendererInput.pages) → bodyElement → rootElementIds
   ↓ bodyPagePositions[bodyElement.id] = pagePositions[page.id]
getCachedCommandStream(rootElementIds, ..., bodyPagePositions, ...)
   ↓ cache key: registryVersion + pagePositionsVersion + sharedLayoutVersion + rootSignature
buildRenderCommandStream → DFS → RenderCommand[] + boundsMap
```

### Root cause 위치 확정

`visiblePageRoots.ts:15` 의 `for (const page of rendererInput.pages)` 만 iterate — frame body element 는 `elementsMap`/`childrenMap.root` 에 존재하지만 **page 가 아니므로 root list 진입 path 0**. 따라서 Skia 가 frame body 를 그리지 않음. 세션 46 evidence (`pagePositions: { page-id: {x:0,y:0} }`, frame 좌표 0건) 와 정확히 일치.

### 변경 surface (5 파일, ~80 line + test)

| 파일                                         | 변경                                                                                                             | 영향 |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ---- |
| `skia/visibleFrameRoots.ts`                  | **신규** — `collectVisibleFrameRoots(rendererInput, framePositions, frameAreas, ...)` (~50 line)                 | NEW  |
| `skia/skiaFramePipeline.ts:229`              | rootElementIds 병합 (page + frame), bodyPagePositions 단일 맵 통합                                               | ~10  |
| `skia/renderCommands.ts:209-243`             | `getCachedCommandStream` cache key 에 `framePositionsVersion` 추가 (4 → 5 키)                                    | ~5   |
| `renderers/rendererInput.ts:76-106`          | input 에 `framePositions`/`framePositionsVersion`/`frameAreas` 통합                                              | ~10  |
| `workspace/canvas/BuilderCanvas.tsx:230-380` | framePositions/Version selector 추가 + `useLayoutsStore` selectedReusableFrameId subscribe (P3-γ B 안 read path) | ~5   |

### 결정 분기 3건

#### D1. frame body element 식별 방법

| 옵션                                                                | 장점                                                                        | 단점                                          | 권고 |
| ------------------------------------------------------------------- | --------------------------------------------------------------------------- | --------------------------------------------- | ---- |
| **A. `el.layout_id === frameId` 매칭** (composition-pre-1.0 legacy) | 이미 ADR-903 P3-E E-6 에서 검증된 패턴. canonical adapter 가 layout_id 보존 | legacy 의존 — Phase 4 legacy 0 시 재작업 가능 | ✓    |
| B. canonical doc 의 reusable FrameNode → metadata.layoutId 매칭     | Phase 4 legacy 0 후에도 유지                                                | 실 elementsMap iteration 필요, 분기 추가      |      |

**A 권고** — P3-δ 단계에서는 이미 검증된 패턴 재사용. Phase 4 legacy 0 진입 시 B 로 마이그레이션 (별도 작업).

#### D2. viewport root collection 함수 — 통합 vs 분리

| 옵션                                           | 장점                                                                                                       | 단점                                                                        | 권고 |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- | ---- |
| A. `collectVisiblePageRoots` 확장 (page+frame) | 단일 함수, caller 1개                                                                                      | 두 domain (page/frame) 단일 함수 안에 mix — P3-α/β 의 domain 분리 패턴 위반 |      |
| **B. 신규 `collectVisibleFrameRoots` 추가**    | P3-α framePositions / P3-β computeFrameAreas / P3-γ selectedReusableFrameId 도입과 일관된 domain 분리 패턴 | caller 가 두 함수 호출 후 결과 병합 (~5 line)                               | ✓    |

**B 권고** — domain 분리 + 본 세션의 일관 패턴 유지.

#### D3. frame body 좌표 lookup 자료구조

| 옵션                                                                         | 장점                                                | 단점                                                          | 권고 |
| ---------------------------------------------------------------------------- | --------------------------------------------------- | ------------------------------------------------------------- | ---- |
| **A. `bodyPagePositions` 단일 맵 통합** (frame body element id → {x,y} 추가) | renderCommands.ts 시그니처 미변경, caller 영향 최소 | 이름이 "PagePositions" 라 frame entry 혼재 시 의미 misleading | ✓    |
| B. `bodyFramePositions` 별도 맵 + `buildRenderCommandStream` 시그니처 확장   | 이름 정합                                           | 시그니처 + caller chain 확장, 복잡도 증가                     |      |

**A 권고** — 단일 맵 + 변수명 `bodyRootPositions` 로 rename 검토 (Phase 4 cleanup 시).

### G3-δ 통과 조건 (재확인)

- (a) Skia 캔버스에 frame body 영역 그려짐 — frame border + 빈 background
- (b) frame body 자식 (slot) 도 영역 안에 그려짐 — childrenMap DFS 정상 동작
- (c) Chrome MCP screenshot 사용자 시나리오 GREEN — Frame 추가 → Layout preset 적용 → slot 영역 시각화

### P3-δ 진입 시 작업 비용 재산정

D1=A, D2=B, D3=A 채택 시 **~1d (HIGH 2d 의 lower bound)**. 다음 세션에서 본격 land. 본 세션 P3-δ-1 inventory 는 진입 위험 50% 감소 (변경 surface + 결정 분기 사전 lock-in).

## 4.7. P3-δ fix #3 — frame body fullTreeLayout 발행 path (세션 47 후속, 다음 세션 진입)

### 결함 요약

본 세션 47 의 P3-δ + fix #1+#2 land 후 Chrome MCP 검증 (2026-04-28):

- **frame body 자체는 시각화 ✅** — collectVisibleFrameRoots → rootElementIds 진입 + framePositions 좌표 적용. 큰 사각형 (390×844) 캔버스에 그려짐
- **frame body 자식 (Slot 들) 시각화 ❌** — slot 분리선 / header / content 영역 미표시. screenshot 에 빈 사각형만 보임

### Root cause (systematic-debugging Phase 1-2)

| Layer                                      | 결함                                                                      |
| ------------------------------------------ | ------------------------------------------------------------------------- |
| **`useLayoutPublisher`**                   | `visiblePages.map(...)` 만 처리 — frame body input 0건                    |
| **`buildPixiPageRendererInput`**           | `pageId: page.id` 가 필수 — frame body 는 page 가 아님                    |
| **`publishLayoutMap(layoutMap, page_id)`** | 두번째 인자 = `bodyElement.page_id` — frame body 는 `page_id === null`    |
| **`getCachedPageLayout`**                  | page-centric — bodyElement / pageElements / pageWidth/Height 가 page 기준 |

→ frame body 와 자식 의 fullTreeLayout 호출 path **자체 부재**. layoutMap 에 entry 없음.

→ `visitElement` (`renderCommands.ts:356`) 에서 `layoutMap.get(slotId) === undefined` → `skiaData.width/height` fallback. Slot 의 `skiaData.width = 0` → DFS 진입 하지만 0×0 → 시각적 invisible.

frame body 자체가 보이는 이유 = framePositions 좌표 + skiaData 또는 element.props 의 width/height 가 어떻게든 살아있어서 큰 사각형으로 그려짐. 일관성 없는 동작이지만 root cause 는 자식 layout 미계산.

### 변경 surface (예상 4 파일 + test)

| 파일                                                 | 변경                                                                                            |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `hooks/useLayoutPublisher.ts`                        | 시그니처 확장: `framePages: PageLayoutInput[]` 추가 입력. frame body 도 동일 logic 처리         |
| `renderers/rendererInput.ts`                         | `buildFrameRendererInput(...)` 신규 — frame body 용 PixiPageRendererInput-like 구조 빌드        |
| `BuilderCanvas.tsx`                                  | `frameLayoutPublisherInputs` useMemo + useLayoutPublisher 두번째 인자                           |
| `layout/engines/fullTreeLayout.ts::publishLayoutMap` | 키 정책: `bodyElement.page_id ?? bodyElement.layout_id ?? bodyElement.id` (frame body fallback) |

### 결정 분기 3건 (다음 세션 시작 시 사용자 승인 대기)

#### D4. frame body input 빌드 함수

| 옵션                                                        | 장점                                                 | 단점                                                    | 권고 |
| ----------------------------------------------------------- | ---------------------------------------------------- | ------------------------------------------------------- | ---- |
| **A. `buildFrameRendererInput` 신규 (page-centric 비대칭)** | rendererInput.ts 의 page 함수와 frame 함수 분리 명확 | 두 함수 사이 코드 중복 (~30 line)                       | ✓    |
| B. `buildPixiPageRendererInput` generic 화                  | 단일 함수                                            | page-centric 가정 깨고 generic root 도입 — 변경 범위 큼 |      |

**A 권고** — P3-α/β/γ/δ 의 domain 분리 일관 패턴 유지.

#### D5. publishLayoutMap 키 정책

| 옵션                                                            | 장점                            | 단점                                         | 권고 |
| --------------------------------------------------------------- | ------------------------------- | -------------------------------------------- | ---- |
| **A. fallback chain: `page_id ?? layout_id ?? id`**             | 최소 변경, frame body 매칭 가능 | 키 의미 mixed (page-id/layout-id/element-id) | ✓    |
| B. `publishLayoutMap` 시그니처 확장 — 두번째 인자 명시 root key | 키 명시 명확                    | caller 다수 영향                             |      |

**A 권고** — 즉시 도입 가능. Phase 4 cleanup 시 generic key 마이그레이션 (별도 작업).

#### D6. layoutVersion / dimension key 통합

`useLayoutPublisher` 의 dimensionKey 가 page 만 처리. frame 도 추가 시 `framePositionsVersion` + frame width/height 도 dimensionKey 에 포함 필요.

| 옵션                                         | 장점                | 단점                                        |
| -------------------------------------------- | ------------------- | ------------------------------------------- |
| **A. 단일 dimensionKey 에 frame entry 추가** | 단일 useEffect 유지 | frame width/height 미정 시 처리 (page 동일) |
| B. frame 별도 useEffect                      | scope 분리          | hook count 증가                             |

**A 권고** — 단일 hook flow 유지.

### G3-δ fix #3 통과 조건

- (a) frame body 자식 (Slot) 의 layout 계산 결과가 layoutMap 에 entry 보유 (Chrome MCP `_lastBoundsMap` 에 slot id entry width > 0)
- (b) Skia 캔버스에 slot 분리선 / 영역 시각화 — 수직 2단 preset 의 header / content 분리 명확
- (c) Chrome MCP screenshot 사용자 시나리오 GREEN

### 비용 재산정

D4=A, D5=A, D6=A 채택 시 **~1d HIGH** (당초 P3-δ 본격 land 의 lower bound 와 동일 — fix #1/#2 의 추가 1d MED 가 본 fix 의 prerequisite 였음). 본 fix #3 land 후 G3-δ 전체 충족 → P3-ε / P3-ζ 진입.

## 4.8. P3-δ fix #4 — frame 영역 size 자동 결정 (사용자 회귀 fix)

### 결함 요약

P3-δ fix #2 의 framePositions auto-init 이 `height: pageHeight` 사용 — viewport 크기 (예: 844px iPhone, 1080px desktop) 가 frame 영역에 강제됨. Frame 은 component template (viewport-sized 가 아님) → body content 보다 훨씬 큰 빈 사각형 시각화.

사용자 보고 (2026-04-28): "Frame 추가시 세로 영역이 body 보다 더 크게 생성됨".

### Fix

`BuilderCanvas.tsx` framePositions auto-init useEffect 에 `findFrameBodyDimensions(frameId)` 추가:

1. `el.type === "body"` && `el.layout_id === frameId` 매칭
2. `bodyElement.props.style.width/height` 명시 px 값 우선
3. 없으면 component-sized default (320×200)
4. `page_id === null` 인 canonical reusable frame body 우선 (legacy layout-bound page body 보다 우위)

### Fix 효과

- frame 영역 = body 의 실 의도 size 와 일치 (또는 reasonable default)
- 빈 큰 영역 회귀 0
- 세션 47 commit `e4f24697` (fix #3+#4+B1 묶음)

## 4.9. P3-γ frame visibility policy — B1 filter 에서 multi-frame overview 로 전환

### 결함 요약

초기 판단은 `computeFrameAreas` 가 모든 reusable frame 을 영역으로 반환하면 noise 가 크다는 것이었다. 그래서 2026-04-28 에는 `selectedReusableFrameId` 일치 frame 만 노출하는 B1 을 채택했다.

사용자 보고 (2026-04-28): "1.문제: Frames 가 canvas에 별도로 생성되고 그내부에 slot들이 생성되었다".

2026-04-30 UX 재검토: Frames 탭은 Page 탭처럼 layout 을 추가/비교하는 작업면이므로, 선택된 하나만 같은 위치에 표시하면 추가한 Frame 전체를 한 번에 볼 수 없다. 따라서 B1 은 Frames mode authoring UX 에서는 superseded 되며, Page 추가와 동일하게 reusable frame 전체를 `pageLayoutDirection` 기준으로 배치한다. `selectedReusableFrameId` 는 현재 Node tree/properties 대상 indicator 로만 유지한다.

### Fix

§4.6 의 D2/D3 외 신규 옵션 분기:

| 옵션                                                   | 동작                                                                    | 채택                        |
| ------------------------------------------------------ | ----------------------------------------------------------------------- | --------------------------- |
| B1: `selectedReusableFrameId` 일치 frame 만 노출       | 명시 선택 시에만 별도 영역 노출                                         | superseded (2026-04-30)     |
| **B2R**: Frames mode 에서 모든 reusable frame overview | Page 추가와 동일한 방향(horizontal/vertical/zigzag)으로 모든 Frame 배치 | ✓ (2026-04-30 UX follow-up) |

`computeFrameAreas(doc, framePositions, selectedReusableFrameId)` 는 reusable frame 전체를 반환한다. BuilderCanvas 가 `pageLayoutDirection` 과 `PAGE_STACK_GAP` 으로 Page 와 같은 multi-canvas 배치를 적용한다. canvas 에서 다른 Frame body/child 를 클릭하면 해당 element 의 `layout_id` 를 `selectedReusableFrameId`/editMode layoutId 로 동기화해 Node tree 와 properties panel 이 같은 Frame 을 가리킨다.

Frame canvas 좌상단에는 Page title 과 같은 Pencil-style label 을 렌더한다. 이 label 은 multi-frame overview 식별용 chrome 이며 Page title drag hit-test map 에는 등록하지 않는다.

Frames mode 에서는 Page 탭의 page canvas 가 렌더되지 않으므로, 빈 공간 클릭의 body fallback 도 page 영역 hit-test 를 수행하지 않는다. hidden page 위치가 current page 를 변경하면 frameAreas 의 anchor 가 바뀌어 Frame canvas 가 이동하므로, frame body 영역만 body fallback 대상으로 유지한다.

Tabs 는 `items` 기반 virtual Tab 을 layout pass 중 synthetic element 로 만든다. multi-page / multi-frame publish 에서 synthetic map 을 전역 단일 map 으로 clear 하면 마지막 root 의 virtual Tab 만 남아 다른 Page/Frame 의 Tabs 가 새로고침 또는 탭 전환 후 비정상 렌더링된다. 따라서 layoutMap / filteredChildrenMap 과 같은 `page_id ?? layout_id ?? id` root key 로 synthetic element map 도 저장하고 cache hit 시 함께 재발행한다.

### Fix 효과

- PagesTab 작업 시 frame 영역 0 (page 만 가시)
- FramesTab → 등록된 reusable frame 전체를 Page layout direction 으로 노출
- 각 Frame canvas 좌상단 title 로 현재 overview 의 Frame 식별 가능
- FramesTab 빈 공간 클릭으로 hidden Page 위치가 선택되어 Frame canvas 가 이동하지 않음
- 여러 Page/Frame 에 Tabs 가 있어도 virtual Tab synthetic children 이 마지막 root 기준으로 사라지지 않음
- FramesTab canvas 에서 다른 Frame 을 클릭하면 selected frame indicator 와 Node tree 가 즉시 동기화
- 세션 47 commit `e4f24697` 동일 묶음

## 4.10. P3-θ — Frame Slot Fill Resolution (✅ land 2026-04-28 세션 49)

### 결함 요약 (Chrome MCP evidence 2026-04-28)

P3-δ fix #3+#4+B1 land 후 사용자 시나리오 검증:

- Frame: vertical-3 preset 적용 (slot:header / slot:content / slot:footer + header/footer 에 Text 등록)
- Page: `page.layout_id = frameId` 으로 frame 에 바인딩 ✅
- 사용자 기대 (Page 영역 inline): `상단 (frame default header text) / 가운데 (page slot:content fill) / 하단 (frame default footer text)`

**현재 동작 확증**:

- Page rendering pipeline: `getPageElements(pageIndex, pageId)` 가 `el.page_id === pageId` 인 element 만 반환
- Frame element (body / Slot×3 / Text×2) 는 `page_id === null` → **Page rendering 에서 자동 제외**
- 결과: Page 영역에 frame 의 slot 구조 inline 노출 안 됨 (사용자 기대 미충족)

### Root cause

ADR-903 / ADR-911 의 canonical Ref/descendants resolution **legacy elements 영역 미구현**. canonical adapter 단계에서 Ref 처리는 있지만, **legacy rendering pipeline (`getPageElements` + `buildPageChildrenMap`) 은 page_id 인덱스만 사용** → frame slot subtree 가상 merge 단계 부재.

이는 ADR-911 의 핵심 기능 (pencil component composition) — Phase 3 frame canvas authoring (frame 자체 편집) 의 **상보 작업**:

- P3-α/β/γ/δ + fix #1~#4 = **frame 자체 편집** (separate canvas area)
- **P3-θ (본 sub-phase)** = **frame instance composition** (page 가 frame slot 채우기 + inline 렌더)

### 변경 surface (예상 4 파일 + test)

| 파일                                                 | 변경                                                                                            |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `pageIndex.ts` 또는 `getPageElements` 호출 site      | `page.layout_id` set 시 `el.layout_id === pageLayoutId && el.page_id === null` 도 함께 반환     |
| `buildPageChildrenMap` (`scene/layoutCache.ts`)      | frame body subtree 를 page body 자식으로 가상 merge (parent_id 재매핑 또는 별도 children entry) |
| Slot resolution (신규 또는 기존 layoutResolver 확장) | page element 의 `slot_name` 일치 시 frame 의 Slot 자식 (default content) override               |
| `tests/`                                             | T2 (frame default 노출) + T3 (page slot fill override) roundtrip + 회귀 fixture                 |

### 결정 분기 3건 (다음 세션 사용자 승인 대기)

#### D7. getPageElements 확장 vs 별도 resolver

| 옵션                                               | 장점                                     | 단점                                                   | 권고 |
| -------------------------------------------------- | ---------------------------------------- | ------------------------------------------------------ | ---- |
| **A. `getPageElements` 직접 확장**                 | page rendering pipeline 단일 진입점 유지 | pageIndex 의미 변형 (page_id 인덱스 → page+frame 복합) |      |
| **B. 별도 `resolvePageWithFrame()` resolver 신규** | 기존 pageIndex 의미 보존                 | 호출 site 마다 resolver 적용 필요                      | ✓    |

**B 권고** — pageIndex 의 page_id 의미를 보존하면서, page rendering 진입점에서 명시적 resolver 호출. canonical document 도입 시 `selectCanonicalDocument` 와 정합.

#### D8. Slot 매칭 정책 (legacy slot_name vs canonical descendants[slotPath])

| 옵션                                           | 장점                            | 단점                                            | 권고     |
| ---------------------------------------------- | ------------------------------- | ----------------------------------------------- | -------- |
| **A. legacy `slot_name` 매칭**                 | 기존 element schema 그대로 활용 | canonical Ref/descendants 와 별도 path          | ✓ (P3-θ) |
| B. canonical `descendants[slotPath]` 직접 적용 | 장기 정합                       | legacy element 변환 부담 + Ref 인스턴스 ID 부재 |          |

**A 권고** — P3-θ 는 legacy slot_name 매칭으로 즉시 도입. canonical descendants 전환은 ADR-913 Phase 5-A (`slot_name` cleanup) 와 동기화하여 마이그레이션.

#### D9. 회귀 영향 — 기존 layout-bound page 동작

P3-θ 가 `page.layout_id` set 시 frame element 를 page rendering 에 포함시키므로, **기존 layout-bound page 의 동작이 변경**됨:

- 기존 (P3-θ 전): page 자체 element 만 rendering (frame slot 구조 inline 안 됨)
- 후 (P3-θ 후): page + frame default + slot fill resolution

회귀 위험: 사용자가 layout-bound page 를 만들어도 frame slot 구조가 안 보였던 기존 시나리오가 영향받음.

| 옵션                           | 동작                                                  | 권고               |
| ------------------------------ | ----------------------------------------------------- | ------------------ |
| **A. 무조건 적용**             | 모든 layout-bound page 가 frame slot 구조 inline 노출 | 사용자 의도 정합 ✓ |
| B. feature flag 으로 점진 적용 | rollback 경로 확보                                    | UX 일관성 떨어짐   |

**A 권고** — 사용자 기대가 명확 (slot fill composition). 기존 동작은 미완성 상태였으므로 회귀 의미 약함.

### G3-θ 통과 조건

- (a) Page bound to frame → page 영역 inline 으로 frame default 노출 (T2)
- (b) Page 의 slot_name="content" element → frame 의 content slot 자리 fill (T3)
- (c) Frame 의 default header/footer 는 page slot fill 에 영향받지 않음 (override 분리)
- (d) Chrome MCP screenshot 사용자 시나리오 GREEN
- (e) 회귀 0 — 기존 page rendering (layout 미바인딩) 정상

### 비용

D7=B, D8=A, D9=A 채택 시 **~1.5d MED**. P3-θ 는 P3-δ fix #1~#4 + B1 의 prerequisite 가 아님 — 두 영역 schema 직교, 병렬 진행 가능. 하지만 사용자 시나리오 (frame composition) 의 **마지막 핵심 조각** — Phase 3 종결 직전 land 권장.

### Land 결과 (2026-04-28 세션 49)

- D7=B / D8=A / D9=A 모두 사용자 권고대로 승인 → 즉시 land
- 신규 `apps/builder/src/builder/workspace/canvas/scene/resolvePageWithFrame.ts` — Slot 매칭, hidden default child, parent_id 재매핑, page non-root 보존, deleted 제외
- `buildSceneIndex.buildPageDataMap` 통합 — 기존 page-only 분기 → resolver 호출
- `resolvePageWithFrame.test.ts` 10/10 PASS — T2 / T3 / 회귀 8 fixture (regression fix #1 후 fixture 2 추가)
- 검증: type-check 3/3 PASS / canvas vitest 16/16 파일 199/199 PASS (회귀 0)
- Gate G3-θ a/b/c/e 충족 — (d) Chrome MCP screenshot 은 사용자 dev 환경 검증 후 G3-δ (c) 와 함께 종결 가능

### Regression fix #1 (세션 49 후속) — body 채택 정책 전환

- **회귀**: 초기 land 의 `bodyElement = frameBody` 정책으로 page 영역 투명/내용 사라짐 (사용자 보고)
- **Root cause**: frame body 의 width/height (P3-δ fix #4 default 320×200) 가 page 보다 작음 + page-body 시각 속성 손실 + slot_name 미매칭 element orphan
- **Fix**: `bodyElement = pageBody` 유지 + frame body 의 자식들 (Slot 등) 만 page-body 로 reparent + frame body 자체는 결과 제외 + slot_name 미매칭 page element 는 page-body 자식 그대로 유지 (orphan 방지)
- **정합**: design breakdown §4.10 의 "frame body subtree 를 page body 자식으로 가상 merge" 의 정확한 의도 — frame body **자체** 가 아닌 frame body **의 자식들** 을 reparent

## 4.11. P3-ε Pencil drag semantics clarification (2026-04-30)

### Pencil 기준

`docs/pencil-copy` 기준으로 Pencil 의 drag 는 Frame 전용 특수 기능이 아니라 **document node 의 canvas 직접 조작**이다.

- Canvas 는 drawing / selecting / dragging / resizing / arranging 의 1차 편집면이다.
- `.pen` 의 `x` / `y` 는 inspector geometry 와 canvas transform 에 연결되며, drag 는 local coordinate 를 갱신한다.
- 단, **layout owns position** 인 경우에는 임의 `x` / `y` 이동이 아니라 layout-aware insertion/reorder 로 확정한다.
- Drag 중 즉시 destructive reparent 를 하지 않고, drop 시점에 layout-aware insertion index 로 commit 한다.
- Layer tree drag reorder 는 `children` 순서를 바꾸며 render/layout order 에 반영된다.

### Composition 적용

Frames tab 은 2026-04-30 UX follow-up 으로 Page tab 과 같은 multi-canvas overview 를 채택했다. 따라서 등록된 Frame canvas 의 위치는 사용자 node 좌표가 아니라 overview layout 이 소유한다.

P3-ε 의 drag gate 는 다음처럼 해석한다:

| 대상                                        | 위치 소유권               | 허용 동작                                                                                                           |
| ------------------------------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Frame 내부 일반 child                       | element local geometry    | 기존 canvas drag/resize path 로 `x/y` 또는 style geometry 갱신                                                      |
| `layout: "none"` 또는 manual-position child | element local geometry    | drag 로 local `x/y` 갱신                                                                                            |
| Auto-layout frame child                     | parent layout             | 자유 `x/y` 이동 금지. drop 시 insertion/reorder intent 로 commit                                                    |
| Frames tab overview 의 Frame canvas 자체    | overview layout           | 자유 drag 로 `framePositions.x/y` 저장하지 않음. 필요 시 별도 reorder affordance 또는 explicit non-draggable chrome |
| Layers tree row                             | document `children` order | drag reorder 로 layer/layout order 갱신                                                                             |

### Gate 정정

기존 "drag 가능" 문구는 과도했다. Pencil 호환 gate 는 "항상 frame canvas 를 자유 이동" 이 아니라, **선택/hover/inspector sync 는 필수이고 drag 는 위치 소유권에 따라 수동 위치 이동, reorder/drop intent, 또는 명시적 non-draggable 로 결정**하는 것이다.

따라서 P3-ε closure 에서는 다음을 확인한다:

1. Frame body / Slot / child hit-test 가 실제 rendered bounds 기준으로 동작한다.
2. Frame body 클릭 시 Node tree 와 Properties target 이 같은 frame 으로 동기화된다.
3. Hover outline 과 selection overlay 가 Pencil marker semantics 와 충돌하지 않는다.
4. Overview 가 위치를 소유하는 Frame canvas 는 자유 drag 로 위치가 임의 저장되지 않는다.
5. Manual-position child 의 drag 는 local geometry 를 갱신하고, auto-layout child 의 drag 는 reorder/drop intent 로만 commit 된다.

### Implementation slice #1 (2026-04-30)

- `useElementHoverInteraction` 은 normal child hit-test 가 비었을 때 rendered `frameAreas` 의 topmost frame body 를 hover target 으로 보강한다.
- `selectionHitTest` 의 frame body fallback 도 hover 와 동일하게 `frameAreas` 를 topmost order 로 해석한다.
- `useDragBridge` 는 `position:absolute` child 를 manual-position target 으로 판정해 drag 중에는 visual offset 만 적용하고, drop 시 `style.left/top` 을 delta 만큼 갱신한다. 이 경우 drop indicator / sibling reorder animation 은 비활성화한다.
- 기존 auto-layout child 는 `resolveDropTarget` + `batchUpdateElementOrders` / `moveElementToContainer` 경로를 유지한다. `body` 는 기존 `useCentralCanvasPointerHandlers` gate 로 drag 대상에서 제외한다.
- 사용자 dev 검증: Frame body / Slot 선택 후 Properties/Style 패널의 Transform·Layout 변경이 적용됨을 확인했다. 이는 P3-ε closure 항목 중 Node tree/Properties sync 를 충족한다.
- Verification: `useElementHoverInteraction.test.ts`, `useDragBridge.test.ts`, `selectionHitTest.test.ts` targeted Vitest PASS + builder type-check PASS.

### P3-ζ closure (2026-04-30)

사용자 인증 브라우저에서 `http://localhost:5173/builder/1019ab30-83e3-4987-965f-7aa168219ecc` 기준 회귀 체크를 완료했다.

- Frames 탭 기본 렌더: Frame 여러 개, title, body, slot 표시와 새로고침 후 body/slot 유지 확인
- Pages ↔ Frames 전환: 각 탭의 표시 대상 분리와 frame 적용 상태 유지 확인
- Frame body / Slot interaction: hover, selection, Node tree, Properties/Style 패널 target 동기화 확인
- Transform / Layout 편집: body와 Slot 선택 후 style 변경 적용 및 유지 확인
- Frame 적용 Page: slot 구조 inline 표시, Apply Frame 값과 렌더 일치, Page/body 선택 후 add target 정합 확인
- Shared Frame multi-page: 동일 Frame 을 여러 Page 에 적용해도 Page별 child 가 섞이거나 복제되지 않음 확인
- 복합 컴포넌트 회귀: frame 적용/미적용 Page 의 Tabs 렌더와 새로고침 후 상태 확인
- Drag semantics: overview Frame canvas 임의 이동 없음, auto-layout child 는 reorder/drop 의미 유지, manual-position child 는 local geometry 변경 기준 확인

결론: G3-δ (c), G3-θ (d), G3-ε, G3-ζ 는 본 Phase 3 frame canvas authoring sub-phase 범위에서 closure. ADR-911 전체 잔여는 본문 Gate G3/G4/G5 로 이관한다.

## 5. 비고

- 본 sub-phase 진입 시 **1주+ HIGH 작업**. design 단계가 prerequisite — 단순 fix 불가
- ADR-912 (Editing Semantics UI 5요소) 의 Canvas 시각 마커는 **본 P3 base render 위에 land**. 본 결함이 ADR-912 의 prerequisite
- ADR-911 monitoring 6일 대기 framing 무의미 — Gate G2 가 사용자 회귀 보고로 미충족 확정. monitoring 종결이 시각 회귀를 해소하지 않음
- 본 sub-phase 가 ADR-911 Phase 3 의 신규 영역. 기존 Phase 3 (cascade 재작성) 와 별개로 진행 가능 — 두 영역 schema 직교

## 6. 참조

- [ADR-911 본문](../completed/911-layout-frameset-pencil-redesign.md) (진행 로그 2026-04-28 entry)
- [ADR-911 design breakdown 본체](911-layout-frameset-pencil-redesign-breakdown.md)
- [ADR-911 Closure 체크리스트](911-closure-checklist.md) — 본 P3 land 후 종결 체크
- [ADR-912](../completed/912-editing-semantics-ui-5elements.md) — 시각 마커 (본 P3 prerequisite)
- 세션 46 fix commits — `1f732be3` / `f299d373` (LayerTree/Inspector 정상화, Skia 캔버스는 본 P3 작업 후)
