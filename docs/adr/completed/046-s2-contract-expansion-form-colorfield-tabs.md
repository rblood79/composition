# ADR-046: S2 계약 확장 — Form, ColorField, Tabs

## Status

Implemented (2026-03-29)

## Context

ADR-045는 자동 생성 기반 Property Editor(ADR-041) 이전에 필요한 전단계로서, **이미 존재하는 제품 계약과 Property Editor surface를 정렬**하는 결정을 다룬다.

하지만 `Form`, `ColorField`, `Tabs`는 ADR-045만으로 해결되지 않는다. 이 세 컴포넌트는 React Spectrum S2 문서에 비해 composition의 제품 계약 자체가 덜 닫혀 있기 때문이다.

현재 상태는 다음과 같다.

- `Form`
  - composition 계약에는 `action`, `method`, `encType`, `target`, `autoFocus`, `restoreFocus`, `validationBehavior` 정도만 있다.
  - S2 문서에는 `labelPosition`, `labelAlign`, `necessityIndicator`, `isEmphasized`, `size` 등 상위 폼 계약이 더 있다.
  - 하지만 현재 preview는 `Form` 전용 renderer 없이 HTML fallback으로 처리되고, child field wrapper들도 parent `Form`의 layout/necessity contract를 자동 상속하지 않는다.
- `ColorField`
  - composition 계약은 `channel`, `colorSpace`, `isRequired` 중심으로 좁다.
  - editor는 이미 `variant`, `size`, `isInvalid`, `necessityIndicator` 같은 필드를 다루고 있어, 오히려 현재 타입보다 앞서 나가 있다.
  - S2 문서에는 `name`, `form`, `autoFocus`, `validationBehavior`, `labelPosition`, `labelAlign`, `necessityIndicator`, `size`가 존재한다.
- `Tabs`
  - composition builder 계약은 사실상 `orientation` 중심이다.
  - S2 문서에는 `density`가 명시돼 있고, shared 타입에도 관련 정의가 일부 존재한다.
  - 즉, builder unified contract가 shared 계약을 충분히 반영하지 못하고 있다.

이 상태에서 ADR-041로 바로 가면, 자동 생성기가 어떤 prop를 기준으로 editor를 만들어야 하는지 불안정하다. 따라서 이 세 컴포넌트에 대해서는 먼저 **제품 계약 확정**이 필요하다.

## Alternatives

### 대안 A: ADR-045 안에 계속 포함

- 설명: `Form`, `ColorField`, `Tabs`의 계약 확장도 ADR-045의 일부로 계속 다룬다.
- 위험:
  - 기술: M
  - 유지보수: H
  - 마이그레이션: M
- 이유:
  - "기존 계약 정렬"과 "새 계약 도입"이 한 문서에 섞인다.
  - ADR-045의 범위가 다시 커지고, 게이트 의미가 흐려진다.

### 대안 B: 계약 확장 ADR로 분리

- 설명: `Form`, `ColorField`, `Tabs`를 별도의 계약 확장 ADR에서 다루고, ADR-045는 기존 계약 정렬에 집중시킨다.
- 위험:
  - 기술: L
  - 유지보수: L
  - 마이그레이션: M
- 이유:
  - 제품 계약 채택과 editor 정렬을 분리할 수 있다.
  - ADR-041의 입력 계약을 명시적으로 준비할 수 있다.

### 대안 C: ADR-041 설계 중에 함께 결정

- 설명: 자동 생성기 설계 과정에서 `Form`, `ColorField`, `Tabs` 계약까지 동시에 결정한다.
- 위험:
  - 기술: H
  - 유지보수: M
  - 마이그레이션: H
- 이유:
  - 생성기 설계와 제품 계약 결정이 결합되면, 어느 쪽 문제인지 분리하기 어렵다.
  - 생성기 설계가 계약 미확정 상태에 묶여 지연된다.

## Risk Threshold Check

- 대안 C는 HIGH 위험이 존재하므로 채택 대상에서 제외한다.
- 대안 A는 문서 범위 혼합으로 유지보수 위험이 높다.
- 대안 B가 가장 작은 단위로 문제를 분리한다.

## Decision

**`Form`, `ColorField`, `Tabs`의 S2 계약 확장은 ADR-045와 분리된 별도 ADR로 다룬다.**

이 ADR의 목적은 세 컴포넌트의 editor UI를 바로 늘리는 것이 아니라, **ADR-041에서 자동 생성 가능한 수준의 제품 계약을 먼저 닫는 것**이다.

결정 원칙은 다음과 같다.

1. S2 문서에 있다고 해서 자동 채택하지 않는다.
2. builder unified types, shared component API, renderer/preview 경로에 반영 가능한 계약만 채택한다.
3. `ColorField`처럼 현재 editor가 타입보다 앞서 있는 경우, editor를 기준으로 삼지 않고 문서와 제품 계약을 다시 맞춘다.
4. `Tabs`는 `density`처럼 shared 계약에 이미 흔적이 있는 항목부터 우선 정리한다.
5. `Form`의 상위 계약은 자식 필드 전반에 영향을 주므로, 개별 field prop와 분리해서 다룬다.
6. `Form`의 `labelPosition`, `necessityIndicator`는 preview/canvas 양쪽의 parent → child 전파 규칙이 구현된 뒤 채택한다.
7. `Form.labelAlign`은 shared CSS, preview renderer, canvas layout/spec 경로가 모두 닫힌 뒤 채택한다.

### Decision Snapshot

- 채택
  - `Tabs.density`
  - `ColorField.variant`
  - `ColorField.size`
  - `ColorField.isInvalid`
  - `ColorField.autoFocus`
  - `ColorField.name`
  - `ColorField.form`
  - `ColorField.validationBehavior`
  - `ColorField.necessityIndicator`
  - `ColorField.labelPosition`
  - `ColorField.labelAlign`
  - `ColorField.channel`
  - `ColorField.colorSpace`
  - `Form.labelPosition`
  - `Form.labelAlign`
  - `Form.necessityIndicator`
- 채택 (ADR-045 잔여 통합, 2026-03-29)
  - `Tooltip.containerPadding`
  - `Tooltip.crossOffset`
  - `Tooltip.shouldFlip`
  - `Popover.crossOffset`
  - `Popover.shouldFlip`
  - `Popover.containerPadding`
  - `Breadcrumbs.size` (E2E 완성)
  - `Menu.align`
  - `Menu.direction`
  - `Menu.shouldFlip`
- 보류
  - `Form.size`
  - `Form.isEmphasized`

## Gates

| Gate | 조건                                                                                                            | 목적                         |
| ---- | --------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| G1   | 채택 대상 prop는 S2 문서 근거와 현재 코드 경로(builder/shared/renderer) 중 최소 2개 이상의 근거를 가진다.       | 문서-코드 괴리 방지          |
| G2   | 채택한 prop는 `unified.types.ts`와 shared component API에 동시에 반영 가능해야 한다.                            | 자동 생성 입력 계약 확보     |
| G3   | `ColorField`는 현재 editor에만 존재하는 필드를 그대로 승격하지 않고, 타입/renderer 반영 가능성을 먼저 검증한다. | editor-driven 계약 오염 방지 |
| G4   | `Form`의 상위 계약은 자식 필드 전파 규칙과 함께 정의하거나, 전파 규칙이 없다면 채택을 보류한다.                 | 부분 구현 방지               |
| G5   | `Tabs`의 새 계약은 `density`처럼 실질 렌더링 의미가 있는 항목만 우선 채택한다.                                  | 과도한 surface 확장 방지     |

## Consequences

### Positive

- ADR-045와 ADR-046의 역할이 분리된다.
- ADR-041 이전에 어떤 계약을 먼저 확정해야 하는지 명확해진다.
- `ColorField`처럼 editor가 타입보다 앞서 있는 상태를 정리할 수 있다.
- 자동 생성기가 불안정한 임시 surface 대신 확정된 계약을 입력으로 받을 수 있다.
- `Form.labelPosition`, `Form.necessityIndicator`는 parent `Form` fallback 규칙이 닫힌 뒤 계약으로 승격할 수 있다.
- `ADR-046` 자체가 이제 구현 기준과 함께 닫혀, ADR-041 입력 계약으로 직접 참조할 수 있다.

### Negative

- 자동 생성 전환까지 한 단계 문서 작업이 더 필요하다.
- 일부 prop는 S2 문서에 있어도 제품 계약으로 채택되지 않을 수 있다.
- 실제 구현 착수 전 계약 검토 비용이 늘어난다.
- `ColorField.labelAlign`까지 포함해도, 나머지 보류 항목 때문에 S2 문서와 완전한 parity는 아직 아니다.
- `Form.size`는 현재 composition의 field size 축(`xs/sm/md/lg/xl`)과 S2 `Form` size 축(`S/M/L/XL`)이 맞지 않아 계속 보류된다.
- `Form.isEmphasized`는 현재 composition field 계열의 공통 시각 계약이 아니므로 계속 보류된다.

## References

- [ADR-045](045-s2-property-editor-alignment.md): 기존 계약과 editor surface 정렬
- [ADR-041](041-spec-driven-property-editor.md): 자동 생성 기반 Property Editor
- [ADR-046 Breakdown](../design/adr-046-s2-contract-expansion-form-colorfield-tabs-breakdown.md)
- [React Spectrum S2 Form](/Users/admin/work/composition/.agents/skills/react-spectrum-s2/references/components/Form.md)
- [React Spectrum S2 ColorField](/Users/admin/work/composition/.agents/skills/react-spectrum-s2/references/components/ColorField.md)
- [React Spectrum S2 Tabs](/Users/admin/work/composition/.agents/skills/react-spectrum-s2/references/components/Tabs.md)
