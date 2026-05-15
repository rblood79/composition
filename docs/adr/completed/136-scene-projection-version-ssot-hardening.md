# ADR-136: Scene Projection Version SSOT Hardening

## Status

Implemented — 2026-05-15

## Context

ADR-135는 Page/Frame projection에서 render-space interaction map, projection metadata, canonical mutation target resolver, Slot descendants roundtrip, bootstrap/lazy-load canonical-only hydrate를 완료했다. 그 결과 `::page-frame::` projected ID가 canonical document, IndexedDB, store mirror hydrate source로 유입되는 주요 경로는 닫혔다.

후속 점검에서 남은 위험은 ADR-135의 미완 구현이 아니라 **projection/version contract가 아직 충분히 엄격하지 않은 상태**다. 현재 `sceneSnapshot -> rendererInput -> StoreRenderBridge` 흐름은 같은 projection을 전달하지만, 그 projection이 바뀌었음을 대표하는 version token과 downstream 소비 규칙이 아직 split-brain을 완전히 불가능하게 만들지는 못한다.

확인된 잔여 원인은 두 가지다.

1. `buildSceneStructureSnapshot()`의 `sceneVersion`이 projection content 전체가 아니라 coarse invalidation input에 가깝다. element/page 개수와 visible page membership이 그대로인 상태에서 ref/frame/projection-relevant content가 바뀌면 같은 projection version이 유지될 수 있다.
2. layout-mode frame root 수집 경로가 `renderNodesMap`에서 body를 찾지 못하면 `sceneNodesMap`으로 fallback할 수 있다. 이 fallback은 downstream이 확정된 render model만 소비한다는 ADR-135의 방향을 약화한다.

### Hard Constraints

1. `projectionVersion`은 render/interaction projection content가 바뀌면 element/page 개수가 그대로여도 반드시 바뀌어야 한다.
2. `rendererInput`, `layout publish`, `StoreRenderBridge`, selection/hit-test/hover/scroll은 같은 projection/version에서 파생된 read model만 소비해야 한다.
3. downstream Skia/render bridge 경로는 `renderNodesMap` 실패 시 `sceneNodesMap`으로 조용히 fallback하면 안 된다.
4. canonical/ref/frame projection은 scene/renderer input boundary에서만 생성하고, downstream은 이미 확정된 render model만 소비한다.
5. pointer hot path는 O(1) map lookup 중심이어야 하며, projection signature 계산이 pointer move/hover 경로로 들어가면 안 된다.
6. projected ID는 계속 canonical document, IndexedDB, history payload, store mirror hydrate source에 저장 금지다.
7. ADR-135의 authenticated browser smoke와 synthetic ID 0건 계약은 유지한다.

### Soft Constraints

- ADR-135를 재개하거나 완료 상태를 되돌리지 않는다. 본 ADR은 ADR-135 이후의 hardening 설계다.
- 큰 ProjectionModel 재작성보다 현재 완료된 projectionVersion 전파 위에 불변식을 강화하는 방식을 우선한다.
- 구현은 테스트 가능한 작은 Phase로 나누고, 성능 회귀가 보이면 signature 범위를 축소 가능한 구조로 둔다.

## Alternatives Considered

### 대안 A: 현재 coarse `sceneVersion` 유지 + 테스트만 보강

- 설명: projectionVersion 전파는 유지하고, 명백한 회귀 fixture만 추가한다. version 계산과 downstream fallback은 그대로 둔다.
- 근거: 코드 변경량이 가장 작고 ADR-135 구현에 대한 추가 위험이 낮다.
- 위험:
  - 기술: **HIGH** — same-count projection content 변경을 version이 대표하지 못하는 구조가 남는다.
  - 성능: **LOW** — 추가 계산이 없다.
  - 유지보수: **HIGH** — projection mismatch가 테스트 fixture 밖에서 재발할 수 있다.
  - 마이그레이션: **LOW** — schema/data 변경이 없다.

### 대안 B: projection content signature로 `sceneVersion` 강화 + downstream fallback 제거

- 설명: `buildSceneStructureSnapshot()`에서 stable projection content signature를 계산해 `sceneVersion` 입력으로 사용한다. `visibleFrameRoots` 등 downstream 수집 경로는 `renderNodesMap`만 소비하게 하고, `sceneNodesMap` fallback을 제거한다.
- 근거: 이미 구현된 projectionVersion propagation을 유지하면서 version 의미와 downstream 소비 규칙만 명확히 고정한다.
- 위험:
  - 기술: **MEDIUM** — signature가 projection-relevant field를 누락하면 false negative가 남을 수 있다.
  - 성능: **MEDIUM** — snapshot rebuild 시 stable serialization 비용이 추가된다.
  - 유지보수: **LOW** — version 의미와 fallback 금지가 테스트/static gate로 고정된다.
  - 마이그레이션: **LOW** — runtime schema와 persisted document 변경이 없다.

### 대안 C: immutable `ProjectionModel` 객체를 새 SSOT로 도입

- 설명: canonical scene, render tree, interaction map, layout publish input, Skia bridge input이 모두 하나의 immutable `ProjectionModel` 인스턴스를 공유하게 한다. version/hash도 모델 내부에 둔다.
- 근거: 장기적으로 가장 명확한 SSOT이며 projection identity를 타입 수준에서 표현할 수 있다.
- 위험:
  - 기술: **HIGH** — ADR-135 직후 광범위한 renderer/layout/interaction API 변경이 필요하다.
  - 성능: **MEDIUM** — 객체 graph와 memoization 정책을 다시 설계해야 한다.
  - 유지보수: **MEDIUM** — 장기 구조는 좋지만 초기 migration 중 dual path가 생길 수 있다.
  - 마이그레이션: **MEDIUM** — 테스트와 fixture, static gate를 넓게 바꿔야 한다.

### 대안 D: 모든 scene snapshot identity 변화마다 full rebuild 강제

- 설명: projectionVersion mismatch 판정보다 단순하게 scene snapshot identity가 바뀌면 StoreRenderBridge full rebuild를 수행한다.
- 근거: stale registry 위험을 빠르게 줄일 수 있다.
- 위험:
  - 기술: **MEDIUM** — 원인 모델이 아니라 rebuild 정책으로 증상을 덮는다.
  - 성능: **HIGH** — pan/zoom/layout 주변 interaction에서 불필요한 full rebuild가 늘 수 있다.
  - 유지보수: **MEDIUM** — 왜 rebuild됐는지 invalidation reason이 흐려진다.
  - 마이그레이션: **LOW** — API 변경은 작다.

### 대안 E: Identity-as-version — immutable ProjectedSnapshot 으로 boundary 분리

- 설명: 숫자 `sceneVersion` / `projectionVersion` token 자체를 폐기하고, immutable `ProjectedSnapshot` object 의 참조 identity 를 version 으로 사용한다. `sceneNodesMap` / `sceneChildrenByParent` 는 snapshot type 에서 분리해 diagnostic-only 모듈로 옮긴다. `LayoutPublisherInput` / `SkiaRendererInput` / `SkiaCanvas` / `StoreRenderBridge` 는 같은 snapshot 참조를 공유하고, downstream 에서의 render-to-scene fallback 패턴은 컴파일 단에서 차단된다.
- 근거: ADR-135 가 확립한 4 invariant ("projection content 변경 = version 변경" / "consumer 가 같은 truth" / "scene fallback 금지" / "synthetic ID canonical 격리") 중 앞 3 개를 type/identity 수준에 baked 하여 R1 (signature field 누락) · R3 (downstream fallback) · R4 (allowlist 경계) 카테고리를 구조적으로 제거한다. 대안 C 의 전체 ProjectionModel 통합보다 좁지만, renderer input contract 재정의 수준의 변경은 필요하다.
- 위험:
  - 기술: **HIGH** — `LayoutPublisherInput` / `SkiaRendererInput` / `SkiaCanvas` / `StoreRenderBridge` 의 숫자 `projectionVersion` 전제와 관련 static test 가 모두 contract 교체 대상이다. 단순 signature 정밀화가 아니라 renderer input 계약 재정의다.
  - 성능: **MEDIUM** — immutable snapshot emit/memoization 정책을 새로 잡아야 하며, snapshot object churn이 늘 수 있다.
  - 유지보수: **LOW** — Phase 3 static gate 가 compile-time 으로 흡수되어 dead weight 가 되고 R1/R3/R4 가 invariant 가 아닌 type 으로 표현된다.
  - 마이그레이션: **MEDIUM** — canonical schema / persisted document / IndexedDB 는 바꾸지 않지만, diagnostics/layer inspection read path 를 render consumer 타입에서 분리해야 한다.

### Risk Threshold Check

| 대안                                           | 기술 | 성능 | 유지보수 | 마이그레이션 | HIGH+ 개수 |
| ---------------------------------------------- | :--: | :--: | :------: | :----------: | :--------: |
| A: coarse version 유지                         |  H   |  L   |    H     |      L       |     2      |
| B: content signature + fallback 제거           |  M   |  M   |    L     |      L       |     0      |
| C: immutable ProjectionModel 전체 도입         |  H   |  M   |    M     |      M       |     1      |
| D: snapshot identity마다 full rebuild          |  M   |  H   |    M     |      L       |     1      |
| E: Identity-as-version (boundary 만 immutable) |  H   |  M   |    L     |      M       |     1      |

루프 판정: HIGH 0개 대안 B가 존재한다. CRITICAL 위험은 없다. 대안 C는 장기 후보로 유지하되, ADR-135 직후의 hardening 목표에는 과하다. 대안 E는 R1/R3/R4를 구조적으로 제거하는 상위 설계이지만 (a) renderer input contract 재정의로 변경 폭과 회귀 위험이 크고, (b) ADR-135 직후 hardening이 아니라 별도 renderer input contract 재정의 ADR의 식별성을 가진다. 따라서 본 ADR에서는 대안 B를 채택하고 대안 E는 후속 ADR 후보로 보류한다.

## Decision

**대안 B: projection content signature로 `sceneVersion` 강화 + downstream fallback 제거**를 선택한다.

### 선택 근거

1. ADR-135가 이미 만든 `projectionVersion` 전파 구조를 유지하면서 version 의미를 실제 projection content에 맞춘다.
2. `renderNodesMap` 실패를 `sceneNodesMap`으로 보정하는 경로를 제거해 downstream split-brain을 구조적으로 줄인다.
3. persisted document나 canonical schema를 바꾸지 않아 migration 위험이 낮다.
4. targeted unit/static gate로 false negative와 fallback 회귀를 직접 고정할 수 있다.

### 기각 사유

- **대안 A 기각**: version token이 projection content를 대표하지 못하는 근본 원인을 남긴다.
- **대안 C 기각**: 장기적으로는 더 강한 모델이지만 현재 목표 대비 변경 범위와 회귀 위험이 크다.
- **대안 D 기각**: full rebuild로 stale registry 위험은 줄지만 원인 모델을 명확히 하지 못하고 성능 위험이 크다.
- **대안 E 보류**: illegal state 를 더 강하게 차단하는 상위 설계이고 R1/R3/R4 카테고리를 구조적으로 제거하지만, 두 이유로 본 ADR에서는 채택하지 않는다. 첫째, renderer input contract 재정의로 변경 폭과 회귀 위험이 크다. 둘째, 더 중요하게는 ADR-135 직후 projection/version hardening이 아니라 renderer input contract 재정의라는 별도 ADR 식별성을 가진다. 대안 B 구현 후에도 signature 누락이 fixture 밖에서 재발하거나 Phase 3 static gate가 유지보수 부담으로 커지면, 후속 ADR에서 `ProjectedSnapshot` / `DiagnosticSceneSnapshot` 타입 분리를 통한 대안 E 채택을 재검토한다.

### Sub-decisions

- **D1**: `sceneVersion`은 layout/page position version과 함께 stable resolved projection content signature를 입력으로 삼는다.
- **D2**: projection content signature는 raw `input.elements`만 보지 않는다. `buildPageDataMap()` / `pageSnapshots`가 만든 resolved `bodyElement` / `pageElements`를 포함해 최소한 id, type, parent/page/layout id, ref/reusable/deleted state, stable props, projection metadata를 반영한다.
- **D3**: signature 계산은 `buildSceneStructureSnapshot()` 시점에만 수행하고 pointer/hover hot path로 옮기지 않는다.
- **D4**: layout-mode frame root 수집은 `renderNodesMap`만 authoritative source로 사용한다.
- **D5**: `renderNodesMap`에 body/root가 없으면 downstream fallback으로 숨기지 않고 upstream projection/test 실패로 다룬다.
- **D6**: downstream renderer/bridge/Skia utility에서 `sceneNodesMap`을 render fallback으로 쓰는 패턴은 static gate로 금지한다.
- **D7**: ADR-135의 synthetic ID canonical persistence 금지와 refresh mirror synthetic 0건 browser contract는 본 ADR의 regression gate로 계승한다.
- **D8**: projection-relevant field (frame metadata / projection prop / ref state / 신규 canonical schema field 등) 가 추가될 때마다 projection content signature input 목록을 동시에 갱신한다. 누락은 R1 (signature false negative) 재발 trigger 이며, layoutVersion 3-심볼 체인 (`LAYOUT_PROP_KEYS` / `NON_LAYOUT_PROPS_UPDATE` / `INHERITED_LAYOUT_PROPS_UPDATE`) 동시 점검과 같은 contract 로 다룬다. signature input 정의 위치 (`buildSceneStructureSnapshot()` 또는 추출된 `projectionSignature.ts`) 를 SSOT 로 본다.

> 구현 상세: [136-scene-projection-version-ssot-hardening-breakdown.md](../design/136-scene-projection-version-ssot-hardening-breakdown.md)

## Risks

| ID  | 위험                                                                                        | 심각도 | 대응                                                                                             |
| --- | ------------------------------------------------------------------------------------------- | :----: | ------------------------------------------------------------------------------------------------ |
| R1  | signature가 projection-relevant field를 누락해 version false negative가 남을 수 있음        |  MED   | same-count props/parent/ref/projection metadata 변경 fixture를 추가하고 누락 field를 gate로 보강 |
| R2  | stable serialization 비용으로 scene snapshot rebuild가 느려질 수 있음                       |  MED   | signature 범위를 render-relevant field로 제한하고, 필요 시 node-level hash helper로 분리         |
| R3  | fallback 제거 후 기존 fixture에서 body/root 누락이 드러날 수 있음                           |  MED   | 누락을 downstream에서 보정하지 않고 rendererInput 생성 경계에서 수정                             |
| R4  | `sceneNodesMap`은 diagnostics/layer inspection에 여전히 필요해 금지 범위가 과도해질 수 있음 |  LOW   | static gate는 downstream render fallback 패턴만 금지하고 inspection 사용은 allowlist             |
| R5  | ADR-135 완료 상태와 혼동되어 기존 구현을 재오픈하는 것처럼 보일 수 있음                     |  LOW   | 본문과 README에 ADR-135 후속 hardening ADR임을 명시                                              |
| R6  | signature/static gate 기반 hardening이 fixture 밖에서 같은 종류의 누락을 반복할 수 있음     |  MED   | G1-1/G1-2/G1-4 fixture를 1차 방어선으로 두고, fixture 밖 재발 시 대안 E 후속 ADR 검토를 trigger  |

## Gates

| Gate | 시점         | 통과 조건                                                                                                                                                                     | 실패 시 대안                                  |
| ---- | ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| G1   | Phase 1 완료 | same-count projection content 변경 시 `sceneVersion`이 변경되는 Vitest PASS                                                                                                   | signature 포함 field 재검토                   |
| G2   | Phase 2 완료 | `collectVisibleFrameRoots()`가 `sceneNodesMap` fallback 없이 `renderNodesMap`만 소비하는 fixture PASS                                                                         | rendererInput root 생성 경계 수정             |
| G3   | Phase 3 완료 | downstream render/bridge/skia utility에 `renderNodesMap.get(...) ?? sceneNodesMap.get(...)`류 fallback 0건. 멀티라인 fallback도 포착하는 regex 또는 AST 기반 static gate 사용 | allowlist와 금지 패턴 재정의                  |
| G4   | Phase 4 완료 | targeted Vitest + `pnpm run codex:typecheck` PASS                                                                                                                             | failing path를 해당 Phase로 되돌려 scope 축소 |
| G5   | 완료 전      | `pnpm run codex:preflight` PASS, 필요 시 ADR-135 refresh/synthetic browser smoke 재실행                                                                                       | Implemented 승격 보류                         |

## Implementation Notes

- Phase 1: `buildSceneStructureSnapshot()`의 `sceneVersion` 입력에 stable resolved projection content signature를 추가했다. signature는 raw scene nodes와 `pageSnapshots`의 resolved `bodyElement` / `pageElements`를 함께 반영한다.
- Phase 2: `collectVisibleFrameRoots()`의 `renderNodesMap -> sceneNodesMap` fallback을 제거했다. frame body가 render model에 없으면 downstream에서 조용히 보정하지 않는다.
- Phase 3: downstream Skia/render utility에서 `renderNodesMap.get(...) ?? sceneNodesMap.get(...)` fallback을 재도입하지 못하도록 static gate를 추가했다. 단일 라인과 멀티라인 패턴을 모두 fixture로 고정한다.
- Phase 4: targeted Vitest, `pnpm run codex:typecheck`, `pnpm run codex:preflight` 통과 후 Implemented로 승격한다.

## Consequences

### Positive

- `projectionVersion`이 실제 render/interaction projection 변경을 더 정확히 대표한다.
- layout publish, renderer input, Skia bridge가 같은 projection/version을 본다는 계약이 강해진다.
- render map 실패를 scene map fallback으로 숨기지 않아 upstream projection 누락을 빨리 발견한다.
- ADR-135 이후 남은 split-brain 재발 가능성을 작은 hardening scope로 줄인다.

### Negative

- scene snapshot rebuild 시 signature 계산 비용이 추가된다.
- signature 대상 field가 늘면 snapshot 테스트 갱신 비용이 생긴다.
- fallback 제거로 기존 fixture나 latent upstream 누락이 테스트 실패로 드러날 수 있다.

### Neutral

- canonical document schema, IndexedDB schema, export/publish payload는 변경하지 않는다.
- ADR-135의 Implemented 상태는 유지한다.
- 장기 `ProjectionModel` 도입 가능성은 막지 않는다.
