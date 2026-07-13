# ADR-905 Breakdown: Fill 비정형 background payload 정책

## 목표

- generic fill ingress가 지원하는 `background*` payload 범위를 allowlist로 고정한다.
- allowlist 밖 payload는 정책적으로 residual 영역으로 분리한다.
- component-specific `backgroundColor` prop 예외를 generic fill 정책과 분리한다.

## 정책 요약

### Canonicalization allowlist

현재 generic ingress가 `fills`로 canonicalize하는 범위:

1. `backgroundColor`
2. `linear-gradient(...)`
3. `radial-gradient(...)`
4. `conic-gradient(...)`
5. `url(...) + backgroundSize`
6. mesh adapter가 생성한 SVG data URL

### Residual policy

- 위 allowlist 밖의 `backgroundImage`/data URL/CSS shorthand payload는 generic fill canonicalization 대상이 아니다.
- 이 경우 ingress는 payload를 임의 변환하지 않는다.
- 신규 producer는 가능하면 top-level `fills`를 직접 emit해야 한다.

### Exception domain

- `RowEditor`
- `CellEditor`

위 두 경로의 `backgroundColor`는 table row/cell domain prop이며 generic `style.backgroundColor` ingress와 동일 규칙으로 해석하지 않는다.

## Phase Plan

### Phase 0 — Inventory Freeze

- `fillCssIngressParser.ts` 지원 범위를 문서/테스트와 1:1로 맞춘다.
- `fillExternalIngress.ts` / `elementCreation.ts` / `elements.ts` / `useIframeMessenger.ts` ingress seam을 기준선으로 고정한다.

#### Phase 0 완료 메모 — 2026-04-24

- allowlist 6종 parser coverage를 [fillCssIngressParser.test.ts](../../../apps/builder/src/builder/panels/styles/utils/fillCssIngressParser.test.ts)로 고정했다.
- residual policy는 [fillExternalIngress.test.ts](../../../apps/builder/src/builder/panels/styles/utils/fillExternalIngress.test.ts)에서 unsupported `repeating-linear-gradient(...)` pass-through로 고정했다.
- ingress seam baseline은 다음 회귀로 고정했다.
  - `normalizeExternalFillIngressBatch()` — preview-generated batch canonicalization
  - [inspectorFills.test.ts](../../../apps/builder/src/builder/stores/__tests__/inspectorFills.test.ts) — `addElement`, `addComplexElement`, `mergeElements`, `hydrateProjectSnapshot`
  - 실제 seam 코드는 [fillExternalIngress.ts](../../../apps/builder/src/builder/panels/styles/utils/fillExternalIngress.ts), [elementCreation.ts](../../../apps/builder/src/builder/stores/utils/elementCreation.ts), [elements.ts](../../../apps/builder/src/builder/stores/elements.ts), [useIframeMessenger.ts](../../../apps/builder/src/builder/hooks/useIframeMessenger.ts)에 고정한다.

### Phase 1 — Producer Contract 문서화

- Preview-generated batch
- clipboard paste
- Design Kit import
- generic store update ingress

위 producer/sink가 canonical `fills` 또는 allowlist payload만 emit/accept한다는 계약을 문서화한다.

#### Phase 1 완료 메모 — 2026-04-24

| Producer / Sink | 계약 | 실제 seam |
| --- | --- | --- |
| Preview-generated batch | Preview가 생성한 element batch는 merge/DB 저장 전 `normalizeExternalFillIngressBatch()`를 거쳐 canonical `fills` 또는 allowlist payload만 유지한다. | [useIframeMessenger.ts](../../../apps/builder/src/builder/hooks/useIframeMessenger.ts) |
| Clipboard paste | paste/cloned element는 새 id/offset 적용 후 `normalizeExternalFillIngress()`를 거쳐 generic fill ingress 규칙에 맞춘다. | [multiElementCopy.ts](../../../apps/builder/src/builder/utils/multiElementCopy.ts) |
| Design Kit import | master/descendant import payload는 add 직전 `normalizeExternalFillIngress()`를 거쳐 canonical payload로 정리한다. | kitLoader.ts |
| Generic store update ingress | Inspector/store update는 `sanitizeInspectorProps()` / `sanitizePropsPatch()`로 derived `background*` direct patch를 제거한다. 즉 generic update 경로는 canonical `fills`의 파생 필드를 정본으로 받지 않는다. | [inspectorActions.ts](../../../apps/builder/src/builder/stores/inspectorActions.ts), [elementUpdate.ts](../../../apps/builder/src/builder/stores/utils/elementUpdate.ts) |
| Add / merge / snapshot ingress | add/addComplex/merge/hydrate snapshot은 element store 경계에서 `normalizeExternalFillIngress()`를 거쳐 canonical payload만 내부 state에 남긴다. | [elementCreation.ts](../../../apps/builder/src/builder/stores/utils/elementCreation.ts), [elements.ts](../../../apps/builder/src/builder/stores/elements.ts) |

Phase 1의 producer contract는 다음 문장으로 요약한다.

- 신규 producer는 가능하면 top-level `fills`를 직접 emit해야 한다.
- `style.backgroundColor/backgroundImage/backgroundSize`를 emit하는 경우에도 allowlist 6종만 generic fill ingress의 canonicalization 대상으로 인정한다.
- allowlist 밖 payload는 generic fill 정본으로 승격되지 않으며 residual policy 영역에 남긴다.

### Phase 2 — Exception Split

- row/cell 같은 component-specific background prop 경로를 별도 domain으로 문서화한다.
- generic fill 정책 문서에서 해당 예외를 명시적으로 제외한다.

#### Phase 2 완료 메모 — 2026-04-24

`RowEditor`와 `CellEditor`는 generic fill ingress와 다른 domain prop을 편집한다.

| Exception path | 계약 | 실제 seam |
| --- | --- | --- |
| Row backgroundColor | `RowEditor`는 `style.backgroundColor`가 아니라 row element의 top-level `props.backgroundColor`를 수정한다. 따라서 generic fill canonicalization allowlist/residual policy의 대상이 아니다. | [RowEditor.tsx](../../../apps/builder/src/builder/panels/properties/editors/RowEditor.tsx) |
| Cell backgroundColor | `CellEditor`도 `style.backgroundColor`가 아니라 cell element의 top-level `props.backgroundColor`를 수정한다. table row/cell appearance domain으로 분리 유지한다. | [CellEditor.tsx](../../../apps/builder/src/builder/panels/properties/editors/CellEditor.tsx) |

Phase 2의 예외 분리 규칙은 다음과 같다.

- `RowEditor` / `CellEditor`의 `backgroundColor`는 table domain prop이다.
- 이 값은 generic `style.backgroundColor` ingress와 동일 규칙으로 canonicalize하거나 차단하지 않는다.
- generic fill 정책의 allowlist/residual policy는 `props.style.background*` 경로에만 적용한다.

### Phase 3 — Guard Follow-up

- 필요 시 allowlist 밖 payload에 대한 warning 또는 telemetry를 검토한다.
- 단, 본 ADR 자체는 정책 결정이므로 즉시 runtime guard 추가를 필수로 요구하지 않는다.

#### Phase 3 완료 메모 — 2026-04-24

- 현재 코드에는 noncanonical `background*` payload 전용 warning/telemetry/guard가 없다.
- Phase 3 결정은 **즉시 guard 추가 없음**이다.
- unsupported payload는 allowlist 밖 residual policy로 남기고, generic fill canonicalization 정본으로 승격하지 않는 무표식 pass-through를 현행 정책으로 확정한다.
- warning/telemetry는 후속 ADR 또는 addendum 후보로만 유지한다.

## 파일 영향 초안

- ADR 본문
  - `docs/adr/905-fill-noncanonical-background-payload-policy.md`
- 구현 기준 문서
  - `docs/adr/design/905-fill-noncanonical-background-payload-policy-breakdown.md`
- 참조 코드
  - `apps/builder/src/builder/panels/styles/utils/fillCssIngressParser.ts`
  - `apps/builder/src/builder/panels/styles/utils/fillExternalIngress.ts`
  - `apps/builder/src/builder/stores/utils/elementCreation.ts`
  - `apps/builder/src/builder/stores/elements.ts`
  - `apps/builder/src/builder/hooks/useIframeMessenger.ts`

## 검증 체크리스트

- [x] allowlist 6종이 문서와 테스트에서 동일하게 유지된다.
- [x] allowlist 밖 payload가 generic fill canonicalization의 정본으로 승격되지 않는다.
- [x] row/cell background prop 예외가 generic fill 정책과 분리되어 문서화된다.
- [x] 신규 producer 가이드를 README/후속 ADR/리뷰 기준 중 최소 한 곳에 남긴다.
- [x] Phase 3 운영 정책이 `무표식 pass-through residual policy`로 고정된다.

## 오픈 이슈

1. Preview/Publish adapter output cache 정책을 이 ADR에서 다룰지 별도 성능 ADR로 분리할지.
2. 저장 시 파생 `background*` persistence 완전 제거를 별도 ADR로 언제 분리할지.
3. warning/telemetry가 실제로 필요한지 추후 운영 데이터로 재평가할지.
