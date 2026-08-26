# ADR-921 Design Breakdown: RenderScene·Backend 통합

> 본문: [921-render-scene-backend-integration.md](../921-render-scene-backend-integration.md)
> 상태: **Proposed — 2026-08-17**

## 1. 결정 경계와 선행 ADR 관계

### 1-1. 2026-08-17 코드 기준선

- composition: `main` = `origin/main`, 작업 트리 clean. 현재 production 경로는
  `CompositionDocument` → canonical projection → 자체 Rust/WASM layout → TypeScript
  command stream → CanvasKit `SkiaRenderer`이다.
- OpenPencil: `9c810776` (`v0.8.4` release manifest). 최신 구조는
  `vendor/jian/crates/jian-scene/src/layout_scene.rs`의 `jian_scene::LayoutScene`을 파생
  paint/input scene으로 둔다. 공통 host surface는
  `crates/op-editor-core/src/render_backend.rs`가 `jian_widgets::Painter`를
  `RenderBackend`로 compatibility re-export한 것이며, web
  `crates/op-host-web/src/canvaskit/backend.rs`의 `CanvasKitBackend`와 native
  `crates/op-host-native/src/backend/frame_backend.rs`의 `NativeFrameBackend`가 각각
  구현한다. `vendor/jian/crates/jian-core/src/render/mod.rs`의 동명 trait은 별도
  surface이므로 본 ADR의 직접 참조로 사용하지 않는다.
- 참조 방식은 **아키텍처 패턴 차용**이다. OpenPencil crate, `PenDocument`,
  `EditorState`, widget code를 composition runtime dependency로 추가하지 않는다.

### 1-2. 선행 결정과의 관계

> **2026-08-26 갱신**: 아래 표에 ADR-187/188/189/190 을 추가했다. §1-1 의 2026-08-17 기준선은 이 네 ADR 로 낡았다 — §6-2 파일 중 `renderCommands.ts` 9 / `SkiaCanvas.tsx` 8 / `rendererInput.ts` 4 / `skiaFramePipeline.ts` 2 / `buildSceneSnapshot.ts` 1 commit 이 이후 변경. **Phase 0 착수 시 기준선을 재freeze** 하고 G0 의 oracle baseline 도 그 시점 코드로 다시 잡는다.

| 선행 ADR                                                                                                                                          | 유지하는 결정                                                                                      | ADR-921이 추가하는 경계                                                                          |
| ------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| [ADR-116](../completed/116-canonical-document-ssot-transition.md), [ADR-122](../completed/122-canonical-only-runtime-legacy-mirror-removal.md)    | `CompositionDocument`가 저장·편집·runtime의 단일 SSOT                                              | `RenderSceneSnapshot`은 저장 금지된 파생 read model로만 존재                                     |
| [ADR-900](../completed/900-unified-skia-rendering-engine.md)                                                                                      | Builder의 CanvasKit/Skia 단일 픽셀 렌더러와 retained/cache 방향                                    | scene과 backend 사이의 명시적, versioned, renderer-neutral 계약                                  |
| [ADR-916](../completed/916-unified-rust-engine.md)                                                                                                | 자체 Rust/WASM layout 엔진, CanvasKit draw 유지, 기존 command/SpatialIndex의 무근거 Rust 이관 제외 | 기존 command 코드를 그대로 Rust로 옮기지 않고, resolved input과 scene output의 batch seam만 정의 |
| [ADR-135](../completed/135-page-frame-projection-interaction-boundary.md), [ADR-136](../completed/136-scene-projection-version-ssot-hardening.md) | render-space interaction, canonical mutation resolver, `sceneVersion`, scene fallback 금지         | snapshot에 render/canonical identity를 함께 운반하되 mutation authority는 부여하지 않음          |
| [ADR-153](../completed/153-render-optimization-measurement-first-adoption.md), [ADR-174](../completed/174-paragraph-retained-lifetime.md)         | command/Picture cache, dual surface, ping-pong snapshot, WASM 지연 폐기·retained 수명              | backend가 자원 lifetime을 소유하고 scene은 native 객체를 보유하지 않는 규칙                      |
| [ADR-117](../117-canvaskit-pathbuilder-upgrade.md)                                                                                                | CanvasKit 버전/API 전환은 별도 Proposed 결정                                                       | backend 계약과 dependency upgrade를 결합하지 않음                                                |
| [ADR-187](../completed/187-editor-presentation-transaction-and-typed-invalidation.md) (2026-08-24) | continuous editor 를 canonical 과 분리된 transaction overlay 로 두고 typed invalidation + targeted Skia patch 로 연결 | snapshot compile 은 transaction overlay 를 입력으로 받는다 — presentation phase 와 renderer contract 를 재결합하지 않음 |
| [ADR-188](../completed/188-targeted-layout-and-skia-subtree-patching.md) (2026-08-22) | Rust subtree-dirty O(1) summary, affected-delta publication, clip-aware Skia subtree draw/hit | `RenderSceneSnapshot` 의 변경 단위는 188 의 affected-delta 와 동일 granularity — 전체 재컴파일 금지 |
| [ADR-189](../completed/189-commit-lane-incremental-record.md) (2026-08-24) | canonical commit 의 whole-tree 재기록을 dirty-root 서브트리 + region-synchronized sparse damage playback 으로 제한 | semantic command trace 는 189 sparse commit lane 의 출력을 받는다 — 189 본문이 명시한 "command stream 계약 교차 → 착수 시 상호 조정" 이 Phase 0 항목 |
| [ADR-190](../completed/190-commit-descriptor-emitter-expansion.md) (2026-08-24) | presentation 터미널 descriptor 하강 → sparse commit lane 진입점 확장 | descriptor emitter 가 compiler 입력 어댑터의 상류 — 별도 emitter 신설 금지 |

### 1-3. 전제·관점 lock-in

| 질문                  | 판정                                                                                                                                                      |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| base / 응용 분류      | ADR-900/916이 현행 실행 기반이고 ADR-921은 이를 잇는 renderer contract 후속이다. 기존 ADR을 분리하거나 역전하는 fork가 아니다.                            |
| schema 직교성         | `CompositionDocument`는 persisted authoring schema, `RenderSceneSnapshot`은 ephemeral derived schema다. 후자는 전자의 specialization이나 대체물이 아니다. |
| 선행 ADR reverse 검증 | ADR-916의 command stream·SpatialIndex 직접 Rust 이관 제외를 유지한다. Rust 후보는 resolved batch seam의 별도 compiler로만 진입한다.                       |
| 사용자 명시 방향      | 2026-08-17 사용자 요청으로 OpenPencil rendering architecture를 목표 구조로, composition CanvasKit을 실행·검증 기준으로 확정했다.                          |

## 2. 목표 아키텍처

```text
CompositionDocument                                      persistent/mutation SSOT
        │
        ├─ canonical resolve + projection (TypeScript)   composition semantics
        │          │
        │          └─ renderId ↔ canonical target map    ADR-135/136 boundary
        │
        ├─ composition-engine Rust/WASM                  geometry/layout authority
        │
        ▼
ResolvedRenderInput                                      renderer-neutral resolved values
        │
        ▼
RenderSceneCompiler                                      TypeScript reference first
        │                                                 Rust batch compiler is conditional
        ▼
RenderSceneSnapshot v1                                   immutable derived read model
        ├─ content scene                                 cacheable
        ├─ hit regions                                   render-space truth
        └─ RenderOverlaySnapshot                         volatile editor chrome, separate
        │
        ▼
RenderScheduler / Presenter                              current SkiaRenderer retained
        │
        ├─ CanvasKitBackend                              current execution + pixel oracle
        ├─ NativeSkiaBackend                             future product checkpoint
        └─ ReadOnlySdkBackend                            future product checkpoint

pointer hit(renderId) → canonical target resolver → runCanonicalMutation → CompositionDocument
```

### 2-1. 소유권

| 관심사                                             | 권한 owner                                                          | 금지되는 중복 owner                                 |
| -------------------------------------------------- | ------------------------------------------------------------------- | --------------------------------------------------- |
| 저장·undo·mutation                                 | `CompositionDocument` + canonical mutation runner                   | `RenderSceneSnapshot`, Rust scene compiler, backend |
| component semantics·theme·token·responsive resolve | 현행 TypeScript canonical/catalog/spec resolver                     | backend별 재해석, OpenPencil `PenDocument`          |
| layout geometry                                    | `composition-engine` Rust/WASM                                      | CanvasKit/backend별 layout 재계산                   |
| render projection identity                         | `CanvasSceneNode.projection`, `renderNodesMap`, `sceneVersion` 계보 | projected ID의 DB/history/export 저장               |
| draw-ready scene                                   | `RenderSceneCompiler`의 `RenderSceneSnapshot`                       | backend가 store/canonical tree를 직접 조회          |
| 프레임 scheduling·surface cache                    | 현행 `SkiaRenderer` 계층                                            | scene compiler의 rAF/surface 소유                   |
| GPU/native resource lifetime                       | 각 backend와 scheduler의 resource registry                          | scene payload의 CanvasKit/Skia 객체 보유            |
| hit-test 결과의 mutation 변환                      | 기존 canonical target resolver                                      | backend의 canonical mutation 직접 호출              |

### 2-2. OpenPencil에서 차용하는 것과 차용하지 않는 것

| 구분                                             | 판정        | composition 적용                                                   |
| ------------------------------------------------ | ----------- | ------------------------------------------------------------------ |
| layout-resolved derived scene                    | 차용        | `RenderSceneSnapshot`을 persistent model과 분리                    |
| 공통 backend capability contract                 | 차용        | CanvasKit/native가 같은 semantic op와 capability profile을 구현    |
| web/native host 격리                             | 차용        | CanvasKit 자원과 native 자원을 backend 내부에 격리                 |
| scene 기반 hit-test                              | 조건부 차용 | render-space hit truth만 차용하고 canonical target resolver는 유지 |
| Rust가 editor 전체 state 소유                    | 차용 안 함  | `CompositionDocument`와 Builder state는 현행 SSOT 유지             |
| OpenPencil widget/UI 전체 Rust화                 | 차용 안 함  | React/RAC/DOM 패널 및 Preview/Publish는 유지                       |
| `PenDocument`/`EditorState`/MCP·SDK surface 이식 | 차용 안 함  | 별도 포맷·제품 surface이며 본 렌더 결정과 결합 금지                |

## 3. 계약 설계

### 3-1. `ResolvedRenderInput`

composition 고유 의미를 renderer-neutral 값으로 해소한 compiler 입력이다.

- canonical node 및 projected node의 identity/parent/children order
- 자체 Rust layout이 산출한 local bounds와 layout generation
- catalog/spec/token/theme/responsive를 해소한 fill, stroke, effect, text, image 값
- clip/mask/scroll/transform과 volatility/invalidation 이유
- resource는 byte/object가 아니라 stable resource key와 metadata로 참조
- 함수, React element, DOM node, Zustand/store 참조, CanvasKit native object는 금지

이 계층까지는 TypeScript가 composition semantics를 소유한다. Rust 후보 compiler가
catalog/spec을 다시 읽거나 `implicitStyles.ts`를 복제하지 않는다.

### 3-2. `RenderSceneSnapshot v1`

| 영역          | 필수 필드                                                                                  | 계약                                                                 |
| ------------- | ------------------------------------------------------------------------------------------ | -------------------------------------------------------------------- |
| header        | `schemaVersion`, `documentGeneration`, `projectionVersion`, `layoutVersion`, `contentHash` | major 불일치는 fail-fast, additive minor만 무시 가능                 |
| roots         | ordered `rootRenderIds`                                                                    | paint root 순서가 의미를 가지며 정렬 재해석 금지                     |
| node identity | `renderId`, `canonicalSourceId?`, `parentRenderId?`, `projection?`                         | `renderId`는 ephemeral, `canonicalSourceId`는 mutation target이 아님 |
| geometry      | local/world bounds, transform, paint order, scroll offset                                  | backend가 layout 재계산하지 않음                                     |
| compositing   | clip stack, mask, opacity, blend, effects                                                  | stack begin/end가 균형을 이루고 capability 요구를 명시               |
| primitives    | rect/rrect/path/text/image/gradient 등의 ordered draw ops                                  | CanvasKit 객체 없이 serializable semantic value만 사용               |
| resources     | font/image/path/resource key + generation                                                  | decode/cache/delete는 backend owner                                  |
| hit           | clipped hit bounds, hit role, render-space order                                           | topmost hit 결과는 current CanvasKit과 동일해야 함                   |
| invalidation  | node/content signature, volatile marker, reason                                            | ADR-153 Picture cache와 scheduler가 재사용 가능                      |

header의 `projectionVersion`은 현행 convention(`rendererInput.ts`의
`projectionVersion: sceneSnapshot.sceneVersion`)을 그대로 따른다 — ADR-136 sceneVersion
계보(layoutVersion + pagePositionsVersion + projection content signature 복합)다.
projection-only 카운터로 재정의하지 않는다 (page 이동 무효화가 빠진다).

`SceneStructureSnapshot`은 projection/visibility/version read model이고,
`RenderSceneSnapshot`은 draw-ready scene이다. Phase 1에서 둘을 이름만 바꾸거나 하나로
합치지 않는다. 전자는 후자를 만드는 입력 중 하나로 유지한다.

### 3-3. content와 overlay 분리

- `RenderSceneSnapshot`: document content, cacheable. selection 변화만으로 재생성하지 않는다.
- `RenderOverlaySnapshot`: selection, guides, drag/drop indicator, workflow/AI feedback,
  page title 등 editor-only volatile chrome.
- 두 snapshot은 같은 `projectionVersion`/camera epoch를 참조하지만 별도 hash와
  invalidation을 가진다. volatile overlay 때문에 content Picture가 매 프레임 폐기되면 실패다.

### 3-4. `RenderBackend` semantic contract

| 범주         | 책임                                                                    |
| ------------ | ----------------------------------------------------------------------- |
| lifecycle    | `beginFrame`/`endFrame`, resize, context loss/recovery, dispose         |
| state stack  | save/restore, clip, transform, layer/composite                          |
| primitives   | ordered semantic draw ops 실행                                          |
| resources    | font/image/path decode·cache·generation·명시 폐기                       |
| capabilities | mask, backdrop filter, blend mode, text shaping 등 지원 여부를 명시     |
| diagnostics  | semantic trace, draw/resource count, backend error를 공통 포맷으로 노출 |

지원하지 않는 required capability는 조용히 근사하거나 DOM/Canvas fallback으로 바꾸지
않는다. backend 선택 전에 capability negotiation이 실패해야 한다. read-only SDK의
명시적 degraded profile은 별도 제품 결정과 사용자 가시 표기가 있을 때만 허용한다.

### 3-5. 현행 코드의 목표 역할

| 현재 경로                                                                             | 목표 역할                                                                                               |
| ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `scene/buildSceneSnapshot.ts`                                                         | projection/visibility/version 입력 유지                                                                 |
| `renderers/rendererInput.ts::createSkiaRendererInput`                                 | Phase 2까지 compatibility bridge, 이후 scene compiler input assembler로 축소                            |
| `skia/renderCommands.ts::RenderCommandStream`                                         | CanvasKit oracle semantic trace의 최초 기준. public cross-backend schema로 직접 승격하지 않음           |
| `skia/skiaFramePipeline.ts::buildSkiaFrameContent`                                    | compiler/snapshot과 scheduler 사이 orchestration으로 축소                                               |
| `skia/renderCommands.ts::executeRenderCommands`                                       | 최초 `CanvasKitBackend` executor로 감싼 뒤 direct caller 제거                                           |
| `skia/SkiaRenderer.ts`                                                                | frame classification, dual surface, snapshot blit, flush/disposal을 소유하는 scheduler/presenter로 유지 |
| `interaction/resolveCanvasInteractionTarget.ts` + `resolveCanonicalMutationTarget.ts` | snapshot hit의 render ID를 canonical operation target으로 변환하는 유일한 mutation 경계 유지            |

## 4. 실행·검증 기준

### 4-1. CanvasKit oracle 정의

“현재 CanvasKit renderer”는 단순 스크린샷 하나가 아니라 다음 6개 증거의 묶음이다.

| 증거           | 기준                                                                      |
| -------------- | ------------------------------------------------------------------------- |
| semantic trace | command kind, render ID, parent/order, clip/mask/layer 균형, resource key |
| geometry       | layout bounds, world bounds, clipped hit bounds, paint order              |
| pixels         | 고정 CanvasKit/font/image/DPR 환경의 PNG                                  |
| interaction    | point별 topmost render ID, selectable target, canonical move target       |
| performance    | `render.frame`, scene compile, record, flush, GPU의 p50/p95/p99           |
| lifetime       | WASM heap, resource count, frame 중 `.delete()` 0, teardown 회수          |

새 경로가 실패했을 때 구 경로가 프레임 안에서 조용히 대신 그리는 fallback은 금지한다.
dual-run은 dev/test의 비교 도구이고, production rollout은 한 프레임에 한 경로만 실행한다.

### 4-2. fixture matrix

| 축          | 최소 fixture                                                                      |
| ----------- | --------------------------------------------------------------------------------- |
| 구조        | Frame/Group/Slot, reusable/ref/descendants, Page Frame projection, 다중 page      |
| layout      | flex/grid/block, intrinsic text, absolute/sticky/scroll, responsive 3 breakpoint  |
| paint       | 다중 fill, stroke, radius, gradient, image, text, custom/variable font            |
| compositing | nested clip, zero-size clip, mask alpha/luminance, opacity, blend, shadow/blur    |
| projection  | collection row/cell/spacer, projected Slot, same-count content change             |
| interaction | overlapping z-order, clipped hit, drag visual offset, selection/context menu/drop |
| scale       | 1K/5K synthetic + 실제 다중 페이지 문서 사본, 저줌 전 페이지 노출                 |

### 4-3. 수치 게이트

| 축                | 통과 조건                                                                                                                                     |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| identity/order    | render ID set, parent, root/child/paint order, clip stack, topmost hit **exact diff 0**                                                       |
| geometry          | 같은 layout output을 소비하는 web 경로는 abs diff `≤ 1e-4 CSS px`; Rust compiler dual-run도 같은 기준. layout 알고리즘 변경은 본 ADR에서 금지 |
| pixels            | 고정 리소스·DPR fixture에서 non-text changed pixel 0. text AA는 사전 고정한 mask 바깥 changed pixel 0; broad tolerance로 결함을 숨기지 않음   |
| canonical safety  | persisted document/history/export의 projected ID 0, backend의 canonical mutation 호출 0                                                       |
| frame performance | 같은 기기/문서/동작에서 p50·p95 `+5%` 이내, p99 `+10%` 이내. 120Hz 환경 p95 `≤ 8.33ms` 목표, 60Hz p95 `≤ 16.67ms`는 호환성 최소선             |
| cadence           | high-refresh 값을 60으로 clamp하지 않고, sample 0개는 0/unknown 유지                                                                          |
| WASM boundary     | Rust compiler 사용 시 content version당 batch input 1회 + output 1회, per-node JS↔WASM 호출 0                                                 |
| lifetime          | record~flush 사이 WASM `.delete()` 0. warm-up 후 반복 종료 heap이 baseline의 `+5%` 또는 `+16MiB` 중 큰 값 이내이고 단조 증가 없음             |
| Preview/Publish   | 동일 canonical fixture의 D1/D2 의미와 D3 토큰·layout 값이 현재 DOM/CSS 결과와 무회귀                                                          |

## 5. Phase 분할

### Phase 0 — inventory와 oracle baseline freeze → G0

- current pipeline의 실제 owner/caller를 `CompositionDocument`부터 CanvasKit flush까지
  다시 기록한다. 문서의 추정 파일 수를 실행 범위로 사용하지 않는다.
- §4-2 fixture에 semantic trace/PNG/hit/perf/memory baseline을 남긴다.
- 기존 `SceneStructureSnapshot`, `SkiaRendererInput`, `RenderCommandStream`의 중복 필드와
  direct store read를 분류한다.
- 산출: evidence manifest, fixture checksum, 측정 기기/DPR/font/CanvasKit version.

### Phase 1 — renderer-neutral contract + TypeScript reference compiler → G1

- React/DOM/CanvasKit/Zustand에 의존하지 않는 `packages/render-scene` package를 만든다.
- `ResolvedRenderInput`, `RenderSceneSnapshot v1`, `RenderOverlaySnapshot`,
  backend capability와 semantic trace 타입을 둔다.
- TypeScript reference compiler는 현행 layout/projection/resolved visual 값을 소비한다.
- conformance fixture는 JSON으로 저장하되 runtime은 불필요한 JSON stringify를 강제하지
  않는다. binary protocol은 boundary 비용이 측정되기 전 도입하지 않는다.
- 이 phase는 production renderer를 바꾸지 않는다.

### Phase 2 — CanvasKit adapter dual-run과 offscreen parity → G2/G3

- 현행 command stream 실행을 `CanvasKitBackend` adapter 뒤로 감싼다.
- test/dev에서 legacy oracle과 snapshot path를 같은 입력으로 실행해 semantic/pixel/hit
  diff를 낸다. 두 결과를 동시에 사용자 canvas에 합성하지 않는다.
- `SkiaRenderer`의 dual-surface, ping-pong, Picture cache, profiler, deferred disposal은
  그대로 유지한다.
- projection ID와 canonical target resolver의 negative fixture를 함께 통과해야 한다.

### Phase 3 — production cutover와 input/overlay 경계 폐쇄 → G4/G5/G6

- rollout flag로 한 경로만 선택해 snapshot → CanvasKit backend를 production path로 전환한다.
- backend의 store/canonical direct read를 0으로 만들고, hit/overlay 입력을 명시적 snapshot으로
  수렴시킨다.
- Spec/Factory/CSS/Skia/Preview/Publish/Editor cross-check와 scale 성능·수명 측정을 수행한다.
- 두 연속 release candidate에서 parity error 0일 때만 direct legacy execution path를 제거한다.

### Phase R — Rust `RenderSceneCompiler` dual-run (조건부, 별도 착수 승인)

다음 중 하나가 실측으로 성립할 때만 시작한다.

1. scene compile p95가 interaction frame budget의 20%를 넘는다.
2. native product 또는 worker/off-main-thread 요구가 승인된다.
3. public read-only SDK가 같은 compiler를 필요로 한다.

Rust는 `ResolvedRenderInput` batch만 받아 `RenderSceneSnapshot` 동형 결과를 반환한다.
catalog/spec/implicit style을 Rust에 복제하지 않으며, Phase 1 JSON conformance fixture와
TypeScript compiler를 oracle로 dual-run한다. 위 trigger가 없으면 미도입이 정상 종결이다.

### Phase N/SDK — native backend·read-only SDK (별도 ADR 필수)

backend seam이 존재한다는 이유만으로 제품 surface를 출시하지 않는다. native window/input,
font/image packaging, accessibility, file security, SDK versioning/API/size budget은 별도 결정이다.

## 6. 파일 경계

### 6-1. 예상 신규 파일

| 경로                                                                    | 역할                                     |
| ----------------------------------------------------------------------- | ---------------------------------------- |
| `packages/render-scene/src/schema.ts`                                   | `ResolvedRenderInput` / snapshot v1 타입 |
| `packages/render-scene/src/backend.ts`                                  | semantic backend/capability 계약         |
| `packages/render-scene/src/semanticTrace.ts`                            | backend-neutral diff trace               |
| `packages/render-scene/src/conformance.ts`                              | schema/version/invariant validator       |
| `apps/builder/src/builder/workspace/canvas/scene/compileRenderScene.ts` | TypeScript reference compiler            |
| `apps/builder/src/builder/workspace/canvas/skia/CanvasKitBackend.ts`    | 현행 executor adapter                    |
| `apps/builder/src/builder/workspace/canvas/skia/renderSceneOracle.ts`   | legacy↔snapshot semantic/pixel/hit 비교  |

### 6-2. 예상 변경 파일

> 2026-08-17 기준 추정 — 187~190 이후 대량 변경됐으므로 Phase 0 재실측 대상 (§1-2 갱신 참조).

| 경로                                                         | 변경 방향                                                         |
| ------------------------------------------------------------ | ----------------------------------------------------------------- |
| `scene/sceneSnapshotTypes.ts`, `scene/buildSceneSnapshot.ts` | 기존 projection/version 책임 유지, compiler 입력 연결             |
| `renderers/rendererInput.ts`                                 | compatibility bridge에서 resolved input assembler로 축소          |
| `skia/renderCommands.ts`                                     | semantic trace 노출 + direct CanvasKit 실행을 backend 내부로 이동 |
| `skia/skiaFramePipeline.ts`                                  | snapshot compile/cache와 scheduler orchestration                  |
| `skia/SkiaCanvas.tsx`                                        | rollout 선택, evidence hook, backend lifecycle 주입               |
| `skia/SkiaRenderer.ts`                                       | scheduler/presenter 유지, backend 호출 경계만 명시                |
| interaction resolver/tests                                   | render ID→canonical target negative gate 유지·확장                |

### 6-3. 조건부 Rust 파일

| 경로                                              | 조건                                          |
| ------------------------------------------------- | --------------------------------------------- |
| `packages/composition-engine/src/render_scene.rs` | Phase R trigger + 사용자 착수 승인 후에만     |
| `packages/composition-engine/src/wasm.rs`         | scene batch API 1쌍만 추가, per-node API 금지 |
| native host crate/package                         | Phase N 별도 ADR 승인 후에만                  |

## 7. Cross-check 매트릭스

문서 생성 시점에는 runtime 코드가 바뀌지 않으므로 아래는 구현 phase의 blocking gate다.

| 레이어           | 현재 권한/경로                                                       | ADR-921 검증 항목                                                          | 판정  |
| ---------------- | -------------------------------------------------------------------- | -------------------------------------------------------------------------- | ----- |
| Spec             | `packages/specs/src/components/*`, `CSSGenerator.ts`                 | snapshot compiler가 spec을 새 SSOT로 복제하지 않고 현행 resolved 값을 소비 | 보존  |
| Factory          | `apps/builder/src/builder/factories/*`                               | 생성 기본 props/children이 canonical→scene에서 누락되지 않음               | G5    |
| CSS Renderer     | shared component CSS + `CSSGenerator` 산출                           | token/variant/size/layout 값이 DOM 기준과 무회귀                           | G5    |
| Skia Renderer    | `renderCommands.ts`, `skiaFramePipeline.ts`, `SkiaRenderer.ts`       | semantic/pixel/hit/perf/lifetime oracle 통과                               | G2/G4 |
| Preview Renderer | `preview/App.tsx`, `CanonicalNodeRenderer.tsx`, shared `rendererMap` | canonical DOM D1/D2/D3 결과 무변, snapshot 의존 추가 0                     | G5    |
| Publish Renderer | `publish/App.tsx`, `ElementRenderer.tsx`, `PageRenderer.tsx`         | canonical child order/responsive/body style/interaction 무변               | G5    |
| Editor/mutation  | interaction resolvers, canonical mutation runner, Properties         | render-space hit 후 canonical target만 commit, projected ID persist 0      | G3/G5 |

## 8. Rollback과 종료 조건

### 8-1. Rollback

- Phase 1은 additive package라 production 영향 없이 제거 가능하다.
- Phase 2/3은 단일 rollout flag가 **프레임 전체 경로**를 선택한다. node별·기능별 silent
  fallback은 금지한다. flag 정의처는 `wasm-bindings/featureFlags.ts` registry 하나다
  (canvas-rendering.md §10 — registry 밖 게이트 상수 신설 금지, 계약 테스트 기계 집행).
- Gate 실패 시 flag를 current CanvasKit oracle path로 되돌리고, 신규 snapshot/backend
  path의 evidence만 보존한다.
- canonical schema/DB/history migration이 없으므로 rollback에 project data migration은 없다.

### 8-2. ADR Implemented 종료 조건

다음을 모두 만족하면 web architecture 결정은 Implemented로 승격할 수 있다.

1. Phase 0~3과 G0~G6 통과.
2. production CanvasKit이 `RenderSceneSnapshot`/backend 경계를 통해 실행.
3. backend의 store/canonical direct read 0, projected ID persistence 0.
4. direct legacy execution path 제거 또는 명시된 단기 rollback 경로 하나만 남음.
5. 두 연속 release candidate에서 parity error 0과 성능·수명 게이트 통과.

Phase R/N/SDK는 조건부 확장이라 ADR-921의 Implemented 승격 필수 조건이 아니다. 다만
각 확장은 같은 conformance gate를 통과해야 하며 제품화는 별도 ADR로 결정한다.

## 9. 비스코프

- OpenPencil `PenDocument`/`EditorState`/widget/MCP/CLI/codegen/협업 계층 이식
- `CompositionDocument` schema, persistence, history, canonical mutation 계약 변경
- Preview/Publish를 CanvasKit/native renderer로 교체
- Builder 전체 React UI를 Rust widget으로 교체
- layout 알고리즘 변경 또는 ADR-916에서 제외한 `implicitStyles`의 Rust 복제
- CanvasKit 0.42.x/PathBuilder 업그레이드 ([ADR-117](../117-canvaskit-pathbuilder-upgrade.md))
- WebGPU, binary protocol, native app, public SDK를 evidence 없이 선구현
