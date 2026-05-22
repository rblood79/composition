# ADR-908: Fill Spec Schema SSOT 전환

## Status

Implemented — 2026-04-24 (동일 세션 Phase 0 → Phase 4 완결, 9 commits)

## Context

ADR-904와 ADR-905로 저장/런타임 정본은 top-level `fills`로 정리됐고, Preview/Publish는 `fills -> CSS background*` adapter를 통해 소비하도록 수렴했다. 그러나 component spec 계층은 아직 `background`, `backgroundHover`, `backgroundPressed`, `props.style?.backgroundColor` override를 중심으로 유지된다. 즉 runtime/storage SSOT는 `fills`인데, spec default visual contract는 여전히 background token 기반이다.

이 구조는 다음 이중 해석을 남긴다.

1. spec 기본 appearance는 `VariantSpec.background*`와 `IndicatorModeSpec.background`가 정의한다.
2. builder style panel fallback은 `resolveAppearanceSpecPreset()`이 spec `background`를 `backgroundColor`로 변환해 읽는다.
3. runtime 문서 저장/편집은 top-level `fills`를 정본으로 사용한다.

결과적으로 Fill SSOT 체인은 저장/런타임에서는 닫혔지만, spec schema 차원에서는 아직 닫히지 않았다. 이 상태를 유지하면 새 시각 계약이 추가될 때마다 `fills`와 `background token` 두 언어를 동시에 이해해야 하고, consumer마다 background→fill 또는 fill→background 변환 책임이 반복된다.

### SSOT 체인 위치 (ADR-063)

본 ADR은 [ADR-063](063-ssot-chain-charter.md)의 **D3 (시각 스타일)** 마지막 정리 단계다. ADR-904/905가 D3의 저장/런타임 ingress와 consumer contract를 정리했다면, 본 ADR은 D3의 **spec schema 정본**을 fill preset 구조로 올려 spec→builder→preview/publish→skia의 계약을 단일화한다.

### Hard Constraints

1. **token 보존**: spec 계층은 runtime `FillItem` raw shape가 아니라 token/state를 보존할 수 있는 schema여야 한다. `rgba`, `id`, editor 전용 필드는 spec 정본으로 승격하지 않는다.
2. **state parity**: 기존 `background/backgroundHover/backgroundPressed`가 표현하던 상태별 의미를 손실 없이 옮겨야 한다.
3. **incremental migration**: 100+ spec 파일을 한 번에 빅뱅 전환하지 않고, resolver/consumer 공통 seam을 먼저 도입한 뒤 단계적으로 이관 가능해야 한다.
4. **visual regression 0**: 기존 spec이 생성하던 CSS/Panel/Skia 기본 appearance의 computed 결과가 대표 컴포넌트 기준으로 회귀 0이어야 한다.
5. **legacy 제거 가능성**: 최종 단계에서 `VariantSpec` 의 **background 계열 전수** (`background` / `backgroundHover` / `backgroundPressed` / `selectedBackground` / `selectedBackgroundHover` / `selectedBackgroundPressed` / `emphasizedSelectedBackground` / `outlineBackground` / `subtleBackground` / `backgroundAlpha` — `spec.types.ts:740-795`) + `IndicatorModeSpec.background` / `backgroundPressed` (`spec.types.ts:807,811`) + `resolveAppearanceSpecPreset().backgroundColor` 의 legacy 해석 경로를 삭제할 수 있어야 한다.
6. **Generator state selector emit 가능성**: `packages/specs/src/renderers/CSSGenerator.ts` 가 fill preset 소비 시 `[data-hovered]` / `[data-pressed]` / `[data-selected]` / `[data-emphasized][data-selected]` / `[data-fill-style="outline"]` / `[data-fill-style="subtle"]` data attribute selector (React Aria 표준) 를 emit 할 수 있어야 한다. ADR-079/080 의 containerStyles direct-read 패턴을 fill preset 에 확장할 때, 현재 Generator 가 이미 emit 하는 data attribute selector (`CSSGenerator.ts:204,220,228,263,271,282,320,357`) 를 재사용 가능함을 Phase 1 전제로 확증한다.

### Soft Constraints

- Fill schema는 color-only를 우선 다루고, image/mesh 등 runtime 저작 중심 fill은 spec 범위 밖으로 남길 수 있다.
- builder style panel은 사용자 경험상 기존 `backgroundColor` 표시를 유지하되, 내부 해석은 spec fill preset을 우선 사용한다.

## Alternatives Considered

### 대안 A: spec 전용 fill preset schema 도입 + consumer 단계적 전환

- 설명: spec 타입에 token/state 보존용 fill preset schema를 도입하고, builder resolver/CSS generator/spec renderer가 이를 직접 소비하게 전환한다. runtime `FillItem`과는 별도 shape이지만 의미적으로 같은 D3 정본이다.
- 근거:
  - ADR-904/905가 이미 runtime/storage SSOT를 `fills`로 정리했으므로 남은 debt는 spec schema뿐이다.
  - token/state 보존이 필요한 spec 특성상 raw runtime fill shape를 그대로 쓰기보다 spec 전용 preset이 더 적합하다.
- 위험:
  - 기술: **M** — spec 타입, resolver, generator, component spec 전수 수정 필요
  - 성능: **L** — 정적 spec 해석 경로 변경이므로 런타임 비용 증가는 작음
  - 유지보수: **L** — 완료 후 background/fill 이중 언어 제거
  - 마이그레이션: **M** — 점진 이관 기간 동안 dual-read seam 필요

### 대안 B: 현행 유지 (spec은 background token, runtime만 fills)

- 설명: spec 계층은 그대로 두고, builder/panel/preview에서만 background↔fill 변환을 계속 유지한다.
- 근거:
  - 현재 사용자 체감 버그는 제한적이고, 바로 대규모 spec migration을 피할 수 있다.
- 위험:
  - 기술: **H** — D3 SSOT가 schema 레벨에서 영구 미완결 상태로 남음
  - 성능: **L** — 추가 비용은 작음
  - 유지보수: **H** — 신규 시각 계약마다 background/fill 이중 해석 반복
  - 마이그레이션: **M** — 뒤로 미룰수록 전수 이관 비용 상승

### 대안 C: spec에서 runtime `FillItem[]` raw shape를 직접 사용

- 설명: spec도 runtime 문서와 동일한 `FillItem[]` shape를 직접 채택한다.
- 근거:
  - 이론상 schema 단일성은 가장 높다.
- 위험:
  - 기술: **H** — spec token/state 계약과 runtime editor shape가 충돌
  - 성능: **L** — 정적 데이터일 뿐 성능 영향은 작음
  - 유지보수: **M** — runtime/editor field와 spec field의 역할 혼합
  - 마이그레이션: **H** — 기존 token 기반 spec을 raw fill shape로 옮기는 비용 과대

### Risk Threshold Check

| 대안 | 기술 | 성능 | 유지보수 | 마이그레이션 | HIGH+ 개수 |
| ---- | ---- | ---- | -------- | ------------ | :--------: |
| A    | M    | L    | L        | M            |     0      |
| B    | H    | L    | H        | M            |     2      |
| C    | H    | L    | M        | H            |     2      |

루프 판정: 대안 A는 HIGH 위험이 없어 채택 가능하다. 대안 B/C는 구조 debt 고착 또는 schema 부적합 위험이 커서 기각한다.

## Decision

**대안 A: spec 전용 fill preset schema 도입 + consumer 단계적 전환**을 선택한다.

선택 근거:

1. runtime/storage SSOT와 spec schema SSOT를 의미적으로 정렬하면서도, spec의 token/state 계약을 유지할 수 있다.
2. raw runtime `FillItem`을 spec에 주입하지 않아 editor/runtime 전용 필드가 spec 정본을 오염시키지 않는다.
3. resolver/generator seam을 먼저 세우면 100+ component spec을 점진적으로 이관할 수 있다.

기각 사유:

- **대안 B 기각**: 현재 패널 fallback이 존재하더라도 D3 schema 차원의 이중 구조는 계속 남는다.
- **대안 C 기각**: spec은 token/state 중심 정적 계약인데 runtime raw fill shape는 그 목적에 맞지 않는다.

> 구현 상세: [908-fill-spec-schema-ssot-breakdown.md](../design/908-fill-spec-schema-ssot-breakdown.md)

## Risks

| ID  | 위험                                                                                    | 심각도 | 대응                                                                                        |
| --- | --------------------------------------------------------------------------------------- | :----: | ------------------------------------------------------------------------------------------- |
| R1  | spec fill preset이 기존 `backgroundHover/backgroundPressed` 의미를 완전히 대체하지 못함 |  MED   | G1 — state mapping schema와 대표 컴포넌트 parity 테스트 고정                                |
| R2  | builder resolver와 CSS generator가 migration 기간 중 dual-read로 복잡해짐               |  MED   | G2 — 공통 resolver seam 1회 도입 후 component spec 전환은 data-only diff로 제한             |
| R3  | 일부 spec이 color-only를 넘어 image/mesh fill을 요구할 때 schema 범위가 모호해짐        |  MED   | G3 — Phase 0 inventory에서 spec 지원 범위를 color/state 중심으로 고정, 비대상은 명시적 제외 |
| R4  | migration 완료 전 background 기반 preset과 fill preset이 혼재하여 리뷰 기준이 흔들림    |  LOW   | G4 — README/breakdown에 phase별 허용 경계와 grep 종료 조건 명시                             |

## Gates

| Gate                    | 시점    | 통과 조건                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | 실패 시 대안                      |
| ----------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| G1: Schema Freeze       | Phase 1 | spec fill preset 타입이 token/state parity 요구를 충족하고 대표 컴포넌트 5종 parity 테스트가 통과한다                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | schema 필드 재설계 후 재시도      |
| G2: Resolver Converge   | Phase 2 | builder/spec resolver가 spec fill preset direct-read를 지원하고 background direct-read fallback은 migration seam으로만 남는다                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | resolver seam 재분리              |
| G3: Component Migration | Phase 3 | 우선순위 component spec군이 fill preset으로 이관되고 CSS/Panel/Skia cross-check 회귀 0이다                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | pilot 범위 축소 후 재이행         |
| G4: Legacy Removal      | Phase 4 | `rg "variantSpec\\.(background\|backgroundHover\|backgroundPressed\|selectedBackground\|selectedBackgroundHover\|selectedBackgroundPressed\|emphasizedSelectedBackground\|outlineBackground\|subtleBackground\|backgroundAlpha)" packages/specs/src apps/builder/src` = 0 (full object access) + `rg "\\bvariant\\.(background\|backgroundHover\|backgroundPressed\|selectedBackground\|outlineBackground\|subtleBackground\|backgroundAlpha)" packages/specs/src apps/builder/src` = 0 (short alias — stateEffect.ts / validate-specs.ts 커버) + `rg "im\\.(background\|backgroundPressed)" packages/specs/src` = 0 (IndicatorModeSpec alias) + `rg "backgroundHover\|backgroundPressed" packages/specs/src/types` = 0 (type 정의 삭제) + `specPresetResolver.ts` / `useAppearanceValues.ts` / `CSSGenerator.ts` / `ReactRenderer.ts` / `variantColors.ts` / `stateEffect.ts` / `validate-specs.ts` 7 소비자 경로에서 background→fill bridge 삭제 완료 | legacy bridge를 한 릴리스 더 유지 |

## Consequences

### Positive

- D3 시각 스타일 SSOT가 spec schema까지 닫힌다.
- builder/panel/preview/publish/skia가 background token과 fill schema를 이중 해석할 필요가 줄어든다.
- 새 컴포넌트 spec은 처음부터 fill preset 언어 하나만 사용하면 된다.

### Negative

- spec 타입과 component spec 전수 수정 비용이 크다.
- migration 기간에는 resolver/generator에 일시적인 dual-read bridge가 필요하다.
- color-only와 비-color fill의 spec 범위를 어디까지 열지 초기 설계에서 명확히 잘라야 한다.

## References

- [docs/adr/904-fill-ssot-preview-publish-adapter.md](904-fill-ssot-preview-publish-adapter.md)
- [docs/adr/905-fill-noncanonical-background-payload-policy.md](905-fill-noncanonical-background-payload-policy.md)
- [packages/specs/src/types/spec.types.ts](../../../packages/specs/src/types/spec.types.ts)
- [packages/specs/src/renderers/CSSGenerator.ts](../../../packages/specs/src/renderers/CSSGenerator.ts)
- [packages/specs/src/renderers/ReactRenderer.ts](../../../packages/specs/src/renderers/ReactRenderer.ts)
- [packages/specs/src/renderers/utils/variantColors.ts](../../../packages/specs/src/renderers/utils/variantColors.ts)
- [packages/specs/src/utils/stateEffect.ts](../../../packages/specs/src/utils/stateEffect.ts)
- [packages/specs/scripts/validate-specs.ts](../../../packages/specs/scripts/validate-specs.ts)
- [apps/builder/src/builder/panels/styles/utils/specPresetResolver.ts](../../../apps/builder/src/builder/panels/styles/utils/specPresetResolver.ts)
- [apps/builder/src/builder/panels/styles/hooks/useAppearanceValues.ts](../../../apps/builder/src/builder/panels/styles/hooks/useAppearanceValues.ts)
