# ADR-136 Design Breakdown — Scene Projection Version SSOT Hardening

> 본문: [136-scene-projection-version-ssot-hardening.md](../136-scene-projection-version-ssot-hardening.md). ADR-135 완료 이후 남은 projection version/fallback contract를 좁은 hardening scope로 닫는다.

## 0. Scope

### In scope

- `buildSceneStructureSnapshot()`의 `sceneVersion`을 projection content signature 기반으로 강화
- same-count projection content 변경 회귀 fixture
- `visibleFrameRoots`의 `sceneNodesMap` fallback 제거
- downstream render/bridge/skia utility의 render-map-to-scene-map fallback static gate
- ADR-135 synthetic ID canonical persistence 금지 계약 유지 확인

### Out of scope

- ADR-135 상태 재오픈
- 새 immutable `ProjectionModel` 전체 도입
- canonical document / IndexedDB / export schema 변경
- Page Frame authoring UX 변경
- Preview/Publish renderer 변경

## 1. Current Failure Model

### 1.1 coarse `sceneVersion`

현재 구조에서 `projectionVersion`은 `sceneSnapshot.sceneVersion`에서 출발해 `LayoutPublisherInput`, `SkiaRendererInput`, `SkiaCanvas`, `StoreRenderBridge`로 전달된다. 전달 경로는 단일화됐지만, `sceneVersion` 자체가 projection content 전체를 대표하지 못하면 같은 version으로 다른 render/interaction projection이 흘러갈 수 있다.

위험 사례:

1. element count와 page count는 그대로다.
2. visible page membership도 그대로다.
3. ref/frame/projection-relevant props 또는 parent/layout relation이 바뀐다.
4. `layoutVersion`이 함께 움직이지 않는 경로라면 `sceneVersion`이 그대로 남을 수 있다.
5. layout publish / renderer input / bridge sync가 변경된 projection을 같은 version으로 취급한다.

### 1.2 downstream scene fallback

layout-mode visible frame root 수집은 render model body를 `renderNodesMap`에서 찾아야 한다. 그런데 `renderNodesMap`에 없을 때 `sceneNodesMap`으로 fallback하면, Skia가 실제 그릴 수 있는 확정 render model과 별도 scene inspection map이 섞인다.

위험 사례:

1. renderer input이 body/root를 render map에 만들지 못한다.
2. downstream utility가 scene map fallback으로 root를 찾는다.
3. layout publish 또는 bridge는 root가 있는 것으로 진행한다.
4. 실제 render commands / interaction map은 다른 truth를 보게 된다.

## 2. Target Contract

### 2.1 Projection version contract

`sceneVersion`은 다음 입력을 함께 반영한다.

- layout version
- page positions version
- page id order
- visible content/page position version
- stable projection content signature

projection content signature의 최소 입력:

- node id
- node type
- parent id / parent_id
- page id / page_id
- layout id / layout_id
- ref
- reusable/deleted state
- stable props
- projection metadata

### 2.2 Downstream consumption contract

규칙:

- render/bridge/skia utility는 render tree가 필요할 때 `renderNodesMap` / `childrenMap` 또는 `interactionNodesMap` / `interactionChildrenMap`을 사용한다.
- `sceneNodesMap` / `sceneChildrenByParent`는 diagnostics, layer inspection, canonical scene comparison 용도에 한정한다.
- downstream에서 render root가 없으면 fallback하지 않는다. renderer input 생성 boundary에서 root 누락을 고친다.

## 3. Phase Plan

### Phase 0 — Inventory and failing fixtures

파일:

- `apps/builder/src/builder/workspace/canvas/scene/buildSceneSnapshot.ts`
- `apps/builder/src/builder/workspace/canvas/scene/buildSceneSnapshot.test.ts`
- `apps/builder/src/builder/workspace/canvas/skia/visibleFrameRoots.ts`
- `apps/builder/src/builder/workspace/canvas/skia/visibleFrameRoots.test.ts`

작업:

1. same-count projection content 변경 fixture를 추가한다.
2. `visibleFrameRoots`가 `renderNodesMap` 누락 시 `sceneNodesMap` fallback으로 root를 수집하지 않는 fixture를 추가한다.
3. 두 fixture가 현재 실패하는지 확인한다.

Gate:

- G0-1: same-count content 변경 fixture가 기존 구현에서 실패하거나, 기존 동작의 hole을 재현하는 assertion을 가진다.
- G0-2: scene fallback fixture가 기존 fallback을 명확히 포착한다.

### Phase 1 — Stable projection content signature

파일:

- `apps/builder/src/builder/workspace/canvas/scene/buildSceneSnapshot.ts`
- 필요 시 `apps/builder/src/builder/workspace/canvas/scene/sceneSnapshotTypes.ts`

작업:

1. local `stableSerialize()` helper를 추가한다.
2. `createProjectionContentSignature(elements)` helper를 추가한다.
3. `sceneVersion` hash input에 `projectionContentSignature`를 포함한다.
4. signature helper가 너무 커지면 별도 `projectionSignature.ts`로 추출한다.

Gate:

- G1-1: same-count props 변경 시 `sceneVersion` 변경.
- G1-2: same-count parent/layout/ref/projection metadata 변경 시 `sceneVersion` 변경.
- G1-3: pointer/hover path에 signature helper import 없음.

### Phase 2 — Remove render-to-scene fallback

파일:

- `apps/builder/src/builder/workspace/canvas/skia/visibleFrameRoots.ts`
- `apps/builder/src/builder/workspace/canvas/skia/visibleFrameRoots.test.ts`

작업:

1. `rendererInput.renderNodesMap.get(bodyId) ?? rendererInput.sceneNodesMap.get(bodyId)` 패턴을 제거한다.
2. root/body가 render map에 없으면 해당 frame root는 수집하지 않는다.
3. render root 누락이 발견되면 rendererInput 생성 경계의 fixture로 원인을 이동한다.

Gate:

- G2-1: `renderNodesMap` 누락 + `sceneNodesMap` 존재 상황에서 root 수집 0건.
- G2-2: 정상 render map이 있으면 기존 visible frame root 수집 동작 유지.

### Phase 3 — Static contract gate

파일 후보:

- `apps/builder/src/builder/workspace/canvas/renderers/rendererInput.static.test.ts`
- `apps/builder/src/builder/workspace/canvas/skia/StoreRenderBridge.static.test.ts`
- 신규 `apps/builder/src/builder/workspace/canvas/skia/skiaProjectionContract.static.test.ts`

작업:

1. downstream render/bridge/skia utility에서 `renderNodesMap` 실패 후 `sceneNodesMap` fallback하는 패턴을 금지한다.
2. diagnostics/layer inspection 사용은 allowlist로 분리한다.
3. `resolveCanonicalRefTree`가 rendererInput 이후 downstream 경로에서 재도입되지 않는지 기존 static test와 연결한다.

Gate:

- G3-1: fallback 금지 static test PASS.
- G3-2: allowed diagnostics usage는 명시 allowlist로만 PASS.
- G3-3: downstream duplicate projection/resolve 회귀 0건.

### Phase 4 — Verification and docs status

작업:

1. targeted Vitest 실행.
2. `pnpm run codex:typecheck` 실행.
3. `pnpm run codex:preflight` 실행.
4. render behavior 변경이 사용자 플로우에 닿으면 ADR-135 refresh/synthetic browser smoke를 재실행한다.
5. 통과 후 ADR-136을 In Progress 또는 Implemented로 승격할 때 README와 CHANGELOG를 갱신한다.

Gate:

- G4-1: targeted Vitest PASS.
- G4-2: type-check PASS.
- G4-3: preflight PASS.
- G4-4: 필요 시 browser smoke PASS.

## 4. Test Checklist

- `buildSceneSnapshot.test.ts`
  - same-count props 변경
  - same-count parent/layout/ref 변경
  - projection metadata 변경
- `visibleFrameRoots.test.ts`
  - render map only success
  - render map miss + scene map hit does not fallback
- static tests
  - downstream render-to-scene fallback 0건
  - downstream duplicate canonical ref resolve 0건
- inherited ADR-135 smoke
  - refresh 전후 runtime `elementsMap` synthetic 0
  - IndexedDB `documents` synthetic 0

## 5. Completion Criteria

ADR-136은 다음 조건을 모두 만족해야 Implemented로 승격한다.

1. `sceneVersion`이 projection content 변경을 대표한다.
2. downstream render root collection이 `sceneNodesMap` fallback 없이 동작한다.
3. static gate가 fallback/duplicate projection 회귀를 차단한다.
4. targeted Vitest, type-check, preflight가 PASS한다.
5. 사용자 가시 render 흐름이 바뀐 경우 browser smoke가 PASS한다.
