# ADR-921: RenderScene·Backend 통합 — CanvasKit 실행 기준과 Rust 다중 백엔드 경계

## Status

Proposed — 2026-08-17

## Context

composition의 현재 렌더링은 역할별로 강점이 분명하다.

- `CompositionDocument`가 저장·편집 SSOT이고, canonical resolver가 reusable/ref/slot과
  projection을 해소한다 ([ADR-116](completed/116-canonical-document-ssot-transition.md),
  [ADR-122](completed/122-canonical-only-runtime-legacy-mirror-removal.md)).
- `packages/composition-engine`의 자체 Rust/WASM 엔진이 flex/grid/block layout을 계산한다
  ([ADR-916](completed/916-unified-rust-engine.md)).
- Builder는 `createSkiaRendererInput()` → `buildSkiaFrameContent()` →
  `RenderCommandStream` → `executeRenderCommands()` → `SkiaRenderer.render()` 경로로
  CanvasKit을 실행한다. command/Picture cache, dual surface, ping-pong snapshot,
  p50/p95/p99 계측, 지연 WASM 폐기까지 production 검증 자산을 갖고 있다
  ([ADR-153](completed/153-render-optimization-measurement-first-adoption.md),
  [ADR-174](completed/174-paragraph-retained-lifetime.md)).

반면 현재 `SceneStructureSnapshot`은 page visibility/projection/version read model이고,
`RenderCommandStream`은 CanvasKit 실행에 결합된 내부 타입이다. **layout-resolved,
renderer-neutral, versioned paint/input scene**과 이를 소비하는 backend contract는 없다.
따라서 native renderer나 read-only SDK를 추가하려면 현행 TypeScript/CanvasKit 경로를
복제하거나, 검증된 경로를 한 번에 Rust로 다시 작성해야 한다.

2026-08-17의 OpenPencil `9c810776` (`v0.8.4`) 코드는 이 구조적 간극에 대한 직접
참조를 제공한다. OpenPencil은 `jian_scene::LayoutScene`을 canonical document와 분리된
paint/input scene으로 두고, `jian_widgets::Painter`를 compatibility alias한 공개
`op_editor_core::render_backend::RenderBackend`를 web의 `CanvasKitBackend`와 native의
`NativeFrameBackend`가 구현한다. 이는 `jian_core::render::RenderBackend`와는 별도
surface다. 그러나 OpenPencil의
canonical model은 `PenDocument`/`EditorState`이고 composition의 component catalog,
CSS Preview/Publish, projected ID, canonical mutation 규칙과 다르다. 코드를 전면 이식하면
두 번째 document SSOT와 대규모 semantics migration을 만든다.

따라서 필요한 결정은 “어느 renderer를 버릴 것인가”가 아니다. **OpenPencil의 derived
scene + shared backend architecture를 목표 구조로 삼되, composition의 현재 CanvasKit
결과를 실행·시각·interaction·성능·수명 검증의 oracle로 유지하면서 도달하는 경계**를
정해야 한다. 조사 근거와 제품 비교는
[PENCIL_ECOSYSTEM_ANALYSIS](../explanation/research/PENCIL_ECOSYSTEM_ANALYSIS.md)에 연결한다.

### 3-Domain 판정

본 ADR은 D3 시각 consumer의 **내부 렌더 아키텍처** 결정이다. D1 DOM/접근성과 D2
Props/API schema를 변경하지 않는다. Preview/Publish는 snapshot을 소비하지 않으며,
동일 canonical fixture의 D1/D2/D3 결과가 유지되는지 확인하는 독립 oracle로만 사용한다.
경계 교차는 Skia 결과가 CSS/DOM 의미를 바꾸지 않았음을 검증하기 위한 것이며 새 SSOT
도입이 아니다.

### Hard Constraints

1. `CompositionDocument`만 persistent/mutation SSOT다. `RenderSceneSnapshot`, OpenPencil
   `PenDocument`, backend state를 DB/history/export authority로 사용할 수 없다.
2. projected `renderId`는 render/hit read model에서만 유효하다. document/history/export의
   projected ID는 항상 0건이어야 하고 mutation은 기존 canonical target resolver를 거친다.
3. 현재 CanvasKit renderer는 신규 경로가 모든 Gate를 통과할 때까지 primary execution
   oracle이다. production 프레임 안에서 실패를 숨기는 node별 silent fallback은 금지한다.
4. renderer-neutral scene에는 CanvasKit/Skia native object, DOM/React/Zustand 참조, 함수,
   canonical mutation command를 넣지 않는다.
5. layout geometry의 authority는 자체 Rust/WASM `composition-engine` 하나다. backend가
   layout을 다시 계산하거나 backend별 geometry를 저장하지 않는다.
6. 동일 web layout output의 render identity/order/clip/hit semantic diff는 0,
   geometry diff는 `≤ 1e-4 CSS px`여야 한다. 고정 리소스/DPR의 non-text pixel diff는 0이다.
7. 같은 기기·문서·동작 baseline 대비 frame time p50/p95는 `+5%`, p99는 `+10%`를
   넘지 않는다. 120Hz의 p95 `8.33ms`를 목표로 하고 60Hz `16.67ms`는 호환성 최소선이다.
8. high-refresh 관측값을 60으로 clamp하지 않고 sample이 없으면 0/unknown을 유지한다.
9. record 시작부터 flush 완료까지 WASM `.delete()`는 0건이어야 한다. 반복 종료 heap은
   baseline의 `+5%` 또는 `+16MiB` 중 큰 값 이내이고 단조 증가가 없어야 한다.
10. Rust scene compiler가 도입될 경우 content version당 JS↔WASM batch input 1회와 output
    1회만 허용하고 per-node 경계 호출은 0건이어야 한다.
11. Spec/Factory/CSS/Skia/Preview/Publish/Editor mutation cross-check를 모두 통과해야 하며,
    Preview/Publish를 CanvasKit으로 교체하지 않는다.
12. unsupported backend capability는 사전 negotiation에서 실패해야 한다. 조용한 시각
    근사나 DOM/Canvas fallback은 허용하지 않는다.

### Soft Constraints

- 현행 `SkiaRenderer`의 frame scheduling, dual-surface/Picture cache, profiler,
  resource lifetime 자산을 보존한다.
- OpenPencil은 architecture/evidence source로만 사용하고 source dependency를 추가하지 않는다.
- renderer contract를 lowest-common-denominator로 축소하지 않고 capability profile로 차이를
  표현한다.
- Rust/native/SDK는 측정 또는 제품 요구가 생길 때만 확장하고 dormant implementation을
  미리 쌓지 않는다.

## Alternatives Considered

### 대안 A: 현행 TypeScript CanvasKit 파이프라인을 최종 구조로 유지

- 설명: `SceneStructureSnapshot`/`SkiaRendererInput`/`RenderCommandStream`과 CanvasKit
  executor를 계속 단일 web 구현으로 유지하고 native/SDK는 별도 구현한다.
- 근거: 현재 composition 경로는 production 상호작용, cache, profiler, WASM 수명에서 가장
  많은 실증을 보유한다.
- 위험:
  - 기술: **MEDIUM** — web 제품은 안정적이지만 새로운 backend마다 scene/layout/interaction
    의미를 다시 정의해야 한다.
  - 성능: **LOW** — 현재 측정·cache 자산을 그대로 유지한다.
  - 유지보수: **HIGH** — CanvasKit 전용 내부 타입이 architecture contract 역할까지 떠맡아
    native/SDK 도입 시 구현·fixture가 분기한다.
  - 마이그레이션: **LOW** — 즉시 변경이 없다.

### 대안 B: OpenPencil Rust core·scene·host를 전면 이식

- 설명: OpenPencil의 `PenDocument`/`EditorState`, `LayoutScene`, `RenderBackend`, web/native
  host를 composition의 중심 runtime으로 가져오고 현행 renderer를 교체한다.
- 근거: OpenPencil v0.8.4는 같은 Rust scene에서 CanvasKit web과 native Skia backend를
  실행하는 완성된 cross-platform 경계를 실제 코드로 보유한다.
- 위험:
  - 기술: **CRITICAL** — `PenDocument`와 `CompositionDocument`, OpenPencil widget semantics와
    RAC/catalog/CSS semantics가 달라 단일 truth를 보장할 수 없다.
  - 성능: **HIGH** — 검증된 command/Picture/dual-surface 경로를 버리고 대형 문서·projection을
    새 경로에서 다시 최적화해야 한다.
  - 유지보수: **HIGH** — upstream fork와 composition adapter가 동시에 필요하다.
  - 마이그레이션: **CRITICAL** — document, history, selection, interaction, Preview/Publish까지
    big-bang 전환해야 하고 rollback 단위가 없다.

### 대안 C: contract-first hybrid — RenderSceneSnapshot + CanvasKit oracle + 조건부 Rust/backend 확장

- 설명: `CompositionDocument`와 TypeScript semantics resolution을 유지하고, 자체 Rust layout
  결과까지 해소된 `ResolvedRenderInput`에서 versioned `RenderSceneSnapshot`을 만든다. 현행
  CanvasKit을 첫 backend이자 oracle로 감싼 뒤, 동일 contract에 Rust compiler/native/read-only
  backend를 조건부로 추가한다.
- 근거: OpenPencil의 derived scene/backend 분리를 차용하면서 composition의 강점인 canonical
  schema, CSS parity, CanvasKit 실행·성능 증거를 모두 보존한다. Flutter/Skia 계열의
  scene→backend 분리와 ADR-916의 layout→CanvasKit draw 분리에도 정합한다.
- 위험:
  - 기술: **MEDIUM** — 기존 scene/input/command 타입 사이에 새 계약을 정확히 삽입해야 한다.
  - 성능: **MEDIUM** — snapshot allocation·serialization을 잘못 설계하면 hot path 비용이
    늘 수 있으나 batch/in-memory contract와 baseline gate로 제한할 수 있다.
  - 유지보수: **MEDIUM** — contract/version/capability 관리 비용이 생기지만 backend별 semantics
    복제를 막는다.
  - 마이그레이션: **MEDIUM** — dual-run/offscreen 비교와 단일 rollout switch로 단계별 rollback이
    가능하다.

### 대안 D: 기존 command·interaction 파이프라인을 즉시 Rust로 전면 이관

- 설명: `renderCommands.ts`, absolute bounds/hit, projection interaction을 Rust/WASM으로 옮기고
  CanvasKit은 얇은 draw host로만 남긴다.
- 근거: 장기적으로 Rust code sharing이 가장 커 보이지만, ADR-916 실측에서 absolute bounds가
  z-order/scroll/drag/page offset이 결합된 command DFS이고 기존 SpatialIndex sync는
  3,000 node 기준 약 0.099ms로 병목이 아님이 확인됐다.
- 위험:
  - 기술: **HIGH** — catalog/spec/projection/interaction 의미를 Rust에 복제하거나 광범위한 payload로
    넘겨야 한다.
  - 성능: **HIGH** — JS command DFS와 Rust bounds/scene DFS가 공존하면 경계 비용과 이중 순회가
    생긴다.
  - 유지보수: **HIGH** — 이관 기간에 TypeScript/Rust 두 구현이 장기 공존한다.
  - 마이그레이션: **HIGH** — 현재 CanvasKit oracle과 결과가 달라질 때 원인 격리가 어렵다.

### Risk Threshold Check

| 대안                     | 기술 | 성능 | 유지보수 | 마이그레이션 | HIGH+ 개수 |
| ------------------------ | :--: | :--: | :------: | :----------: | :--------: |
| A: 현행 web 전용 유지    |  M   |  L   |    H     |      L       |     1      |
| B: OpenPencil 전면 이식  |  C   |  H   |    H     |      C       |     4      |
| C: contract-first hybrid |  M   |  M   |    M     |      M       |     0      |
| D: 즉시 Rust 전면 이관   |  H   |  H   |    H     |      H       |     4      |

루프 판정: 대안 B에 CRITICAL 2건이 있어 근본적으로 다른 대안 C를 추가했다. 대안 A/D는
HIGH가 남고, 대안 C만 HIGH 이상 위험 없이 SSOT 보존·현재 실행 증거·다중 backend 경로를
동시에 만족한다. 추가 루프는 필요하지 않다.

## Decision

**대안 C: contract-first hybrid — RenderSceneSnapshot + CanvasKit oracle + 조건부
Rust/backend 확장**을 선택한다.

선택 근거:

1. `CompositionDocument`와 canonical mutation을 건드리지 않아 두 번째 document SSOT를 만들지
   않는다.
2. 현재 CanvasKit의 pixels뿐 아니라 semantic command, bounds/hit, p50/p95/p99, WASM lifetime을
   oracle로 고정해 architecture 전환이 기능 rewrite로 변질되는 것을 막는다.
3. OpenPencil에서 검증된 “derived scene + shared backend + host 격리”를 차용하되,
   composition 고유 semantics는 `ResolvedRenderInput` 앞에서 한 번만 해소한다.
4. `RenderSceneSnapshot`은 immutable ephemeral read model이고 backend는 canonical/store를 직접
   읽지 않는다. hit 결과의 mutation은 기존 render→canonical resolver를 유지한다.
5. `SkiaRenderer`는 renderer가 아니라 scheduler/presenter 역할로 보존한다. dual surface,
   snapshot blit, Picture cache, context recovery, profiler, deferred disposal을 재사용한다.
6. Rust scene compiler와 native/SDK는 contract의 소비 후보이지 자동 구현 범위가 아니다.
   측정 또는 제품 요구가 없으면 미도입이 정상이며, 제품화는 별도 ADR을 요구한다.

기각 사유:

- **대안 A 기각**: 현재 web 완성도는 보존하지만 renderer-neutral scene 부재를 해결하지 못해
  backend/SDK마다 semantics와 검증 인프라를 복제한다.
- **대안 B 기각**: OpenPencil의 architecture와 product model을 구분하지 않은 전면 이식이며,
  CRITICAL인 dual SSOT와 big-bang migration을 만든다.
- **대안 D 기각**: ADR-916에서 병목·분리 가능성이 반증된 기존 command/SpatialIndex 경로를
  Rust로 옮기는 작업이다. contract seam을 먼저 만들지 않아 검증 가능한 중간 상태도 없다.

> 구현 상세: [921-render-scene-backend-integration-breakdown.md](design/921-render-scene-backend-integration-breakdown.md)

## Risks

| ID  | 위험                                                                                                                                                                                                                                                                                                              |  심각도  | 대응                                                                                             |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------: | ------------------------------------------------------------------------------------------------ |
| R1  | `SceneStructureSnapshot`·`SkiaRendererInput`·신규 snapshot이 서로 다른 scene truth가 될 수 있다. 코드 경로: `scene/buildSceneSnapshot.ts::buildSceneStructureSnapshot`, `renderers/rendererInput.ts::createSkiaRendererInput`, `skia/skiaFramePipeline.ts::buildSkiaFrameContent`                                 | **HIGH** | authority 표 + immutable version/hash invariant + G1 contract test + G6 direct-read/static gate  |
| R2  | projected render ID가 snapshot을 통해 canonical mutation/persistence로 누출될 수 있다. 코드 경로: `scene/canvasSceneNode.ts::CanvasSceneNode.projection`, `interaction/resolveCanvasInteractionTarget.ts`, `interaction/resolveCanonicalMutationTarget.ts`, `canonicalMutations.ts::moveElementToCanonicalTarget` | **HIGH** | render/canonical ID 타입 분리 + persisted/history/export negative fixture + G3                   |
| R3  | adapter 전환 중 clip/mask/text/image/paint order 또는 topmost hit가 현재 CanvasKit과 달라질 수 있다. 코드 경로: `renderCommands.ts::buildRenderCommandStream`, `renderCommands.ts::executeRenderCommands`, `SkiaRenderer.ts::render`                                                                              | **HIGH** | semantic/pixel/hit oracle dual-run + fixed resource fixture + G2                                 |
| R4  | backend resource owner 이동 중 SkPicture/Paragraph/Image/Surface의 조기 폐기나 누수가 재발할 수 있다. 코드 경로: `nodePictureCache.ts`, `deferredDisposal.ts`, `SkiaRenderer.ts::disposeContentSurface`, `disposable.ts::destroyAllSkiaCaches`                                                                    | **HIGH** | scene의 native object 보유 금지 + record~flush delete 0 + heap/resource cycle + G4               |
| R5  | snapshot compile·diff·serialization이 interaction frame에 추가되어 native refresh cadence를 훼손할 수 있다. 코드 경로: `SkiaCanvas.tsx::renderFrame`, `skiaFramePipeline.ts::buildSkiaFrameContent`, `utils/gpuProfilerCore.ts`                                                                                   | **HIGH** | production dual execution 금지 + in-memory batch + p50/p95/p99/120Hz gate G4                     |
| R6  | TypeScript reference compiler와 조건부 Rust compiler의 schema/version 해석이 drift할 수 있다                                                                                                                                                                                                                      |  MEDIUM  | versioned schema + JSON conformance vectors + exact semantic dual-run. Rust trigger 전 구현 금지 |
| R7  | Skia snapshot만 바뀌어 CSS Preview/Publish와 D3 결과가 갈라질 수 있다. 코드 경로: `packages/specs/src/renderers/CSSGenerator.ts`, `preview/components/CanonicalNodeRenderer.tsx`, `publish/renderer/ElementRenderer.tsx`, `skia/buildSpecNodeData.ts`                                                             | **HIGH** | Spec/Factory/CSS/Skia/Preview/Publish/Editor 7-layer cross-check + G5                            |
| R8  | native/read-only backend가 미지원 capability를 조용히 근사해 파일마다 결과가 달라질 수 있다                                                                                                                                                                                                                       |  MEDIUM  | required capability negotiation fail-fast + degraded profile 제품 표기/별도 ADR + G6/G-N         |

선정 대안은 설계 시점 4축 HIGH가 없지만, 이행 중 R1~R5/R7의 운영 위험은 blocking Gate로
관리한다.

## Gates

| Gate | 시점                        | 통과 조건                                                                                                                                                     | 실패 시 대안                                                 |
| ---- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| G0   | Phase 0 종료                | §fixture matrix의 current CanvasKit semantic/geometry/pixel/hit/perf/lifetime baseline과 checksum, CanvasKit/font/image/DPR/기기 조건 freeze                  | 구현 착수 보류, inventory/baseline 보강                      |
| G1   | contract/reference compiler | renderer-neutral payload의 native object·DOM·React·store/function 0, deterministic hash, stack/order invariant, 같은 입력 exact snapshot fixture PASS (R1)    | contract 축소·재설계, production 배선 금지                   |
| G2   | CanvasKit adapter dual-run  | identity/order/clip/hit semantic diff 0, geometry `≤1e-4 CSS px`, 고정 fixture non-text pixel diff 0, 승인 mask 밖 text diff 0 (R3)                           | current `executeRenderCommands` 유지, 신규 adapter rollback  |
| G3   | interaction/persistence     | point fixture topmost render ID·selectable target·canonical move target exact, document/history/export projected ID 0, backend canonical mutation 호출 0 (R2) | resolver 경계 수정, rollout 금지                             |
| G4   | scale/performance/lifetime  | 1K/5K/실문서에서 p50/p95 `+5%`·p99 `+10%` 이내, 120Hz cadence 보존, frame 중 `.delete()` 0, heap 상한·teardown 회수 통과 (R4/R5)                              | snapshot allocation/compile 범위 축소 또는 current path 유지 |
| G5   | cross-check                 | Spec/Factory/CSS/Skia/Preview/Publish/Editor 7-layer fixture PASS, Preview/Publish D1/D2/D3 결과 무회귀 (R7)                                                  | 해당 semantic resolver를 기존 SSOT로 환원, cutover 보류      |
| G6   | production cutover          | 단일 rollout path, backend direct store/canonical read 0, unsupported capability fail-fast, 두 연속 release candidate parity error 0 (R1/R8)                  | rollout flag로 current CanvasKit oracle 복귀                 |
| G-R  | Rust compiler 조건부 착수   | scene compile p95가 frame budget 20% 초과 또는 native/SDK 요구 승인 + batch 왕복 2회/per-node 0 + TypeScript exact conformance                                | Rust 미도입 종결, TypeScript compiler 유지                   |
| G-N  | native/SDK 제품화 전        | font/image packaging, input/accessibility, security, API/version/size budget을 별도 ADR에서 승인                                                              | backend prototype 비공개 유지                                |

## Consequences

### Positive

- current CanvasKit의 검증된 렌더 품질·interaction·cache·lifetime을 잃지 않고 renderer
  architecture를 플랫폼 중립 경계로 정리한다.
- backend가 canonical/store를 직접 읽지 않아 SSOT와 rendering side effect 경계가 명확해진다.
- scene semantic trace를 공통 oracle로 사용해 pixel diff만으로 찾기 어려운 paint order,
  clip/mask, hit-test 회귀를 조기에 검출한다.
- Rust/native/read-only SDK가 필요해질 때 document/core 전면 이식 없이 같은 scene contract에서
  시작할 수 있다.
- OpenPencil의 cross-platform 장점을 차용하면서 composition의 CSS Preview/Publish와 component
  catalog 강점을 보존한다.

### Negative

- `RenderSceneSnapshot` schema/version/capability와 conformance fixture를 지속 관리해야 한다.
- Phase 1~3 동안 기존 scene/input/command 타입과 신규 contract가 일시적으로 공존한다.
- oracle baseline 생성과 semantic/pixel/hit/perf/lifetime dual-run에 상당한 테스트·evidence 비용이
  든다.
- native/SDK가 실제로 필요하지 않으면 다중 backend의 제품 이점은 당장 나타나지 않는다.
- Rust compiler를 조건부로 도입하더라도 composition-specific semantics는 TypeScript resolved input
  경계에 남으므로 OpenPencil처럼 editor 전체가 단일 Rust core가 되는 구조는 아니다.
