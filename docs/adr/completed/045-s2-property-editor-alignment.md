# ADR-045: S2 Property Editor 프로퍼티 정합성 정렬

## Status

Implemented (2026-03-29, ADR-046에 통합)

## Context

ADR-023과 ADR-030을 통해 S2 컴포넌트와 전용 에디터 기반은 마련되었지만, Property Editor의 프로퍼티 노출 범위가 React Spectrum S2 문서와 현재 composition 계약을 기준으로 일관되지 않다.

이번 문제는 단순히 "에디터에 스위치 몇 개를 더 추가"하는 수준이 아니다. 현재 코드베이스에는 아래 두 종류의 갭이 섞여 있다.

1. 이미 composition 계약에 존재하지만 에디터에서 노출하지 않는 갭
2. S2 문서에는 존재하지만 composition 타입, shared 컴포넌트, renderer, spec, preview 경로에 아직 계약이 없는 갭

이 둘을 구분하지 않으면, Property Editor 작업으로 시작한 변경이 타입 확장, renderer 수정, spec 동기화까지 무의식적으로 번지며 ADR 범위와 리스크가 불명확해진다.

### 코드 대조로 확인된 현재 상태

- 저장소는 루트 `src/` 구조가 아니라 모노레포이며, 실제 에디터 경로는 `apps/builder/src/builder/panels/properties/editors/*` 이다.
- ADR 템플릿은 `Context → Alternatives → Risk per Alternative → Threshold Check → Decision → Gates` 순서를 요구하며, 구현 phase/파일 단위 작업은 별도 설계 문서로 분리하도록 규정한다.
- 현재 `unified.types.ts` 기준으로 일부 S2 props는 이미 계약에 존재한다.
  - 예: `Link.target`, `Link.rel`, `Link.isQuiet`, `Link.staticColor`
  - 예: `Dialog.isDismissable`, `Dialog.role`
  - 예: `ColorField.channel`
- 반대로 아래 항목은 현재 composition 계약에 아직 없다.
  - `Tabs.isQuiet`, `Tabs.isEmphasized`
  - `Tooltip.variant`, `Tooltip.showIcon`
  - `Breadcrumbs.showRoot`, `Breadcrumbs.isMultiline`
  - `Form.labelPosition`, `Form.labelAlign`, `Form.necessityIndicator`, `Form.isEmphasized`, `Form.size`
  - `Popover.crossOffset`, `Popover.shouldFlip`, `Popover.containerPadding`, `Popover.isNonModal`

### S2 문서 대조에서 확인된 핵심 사실

- S2 문서는 `Form`, `ColorField`, `Menu`, `Popover`, `Tabs`, `Link`, `Dialog` 등에 대해 풍부한 prop surface를 제공한다.
- 하지만 그 전체를 이번 ADR 범위에 포함하면 "Property Editor 정렬"이 아니라 "composition 컴포넌트 계약 확장" ADR이 된다.
- 따라서 이번 결정은 S2 문서 전체를 그대로 노출하는 것이 아니라, **현재 composition 계약과 실제 렌더 경로가 지원하는 범위부터 정렬**할지 여부를 다뤄야 한다.
- 이 정렬 작업은 ADR-041의 자동 생성으로 바로 뛰어들기 전에 필요한 전단계다. 자동 생성기는 안정된 제품 계약을 입력으로 삼아야 하므로, 먼저 수동 editor surface와 기존 계약의 불일치를 줄여야 한다.

### 제약

- Property Editor 추가는 타입, spec, renderer, preview 반영 경로와 함께 검증되어야 한다.
- ADR 본문에는 구현 phase, 파일 목록, 수동 점검 시나리오를 넣지 않는다.
- 세부 롤아웃과 컴포넌트별 체크리스트는 별도 breakdown 문서에서 관리한다.

## Alternatives

### 대안 A: S2 문서 기준 전체 prop surface를 한 번에 노출

- 설명: S2 문서에 있는 prop를 기준으로 Property Editor, 타입, shared component, renderer, spec을 한 번에 확장한다.
- 장점:
  - 문서 기준으로 가장 높은 커버리지
  - 한 번의 작업으로 "S2 parity"에 가깝게 접근
- 위험:
  - 기술: H
  - 유지보수: H
  - 마이그레이션: H
- 이유:
  - 현재 계약이 없는 prop까지 동시에 도입해야 하므로 범위가 Property Editor를 넘어선다.
  - 변경 실패 시 editor-preview-spec 불일치가 대량으로 발생할 수 있다.

### 대안 B: 계약 우선 Contract-First 정렬

- 설명: 현재 composition 타입과 shared component, renderer 경로가 이미 수용하거나 짧은 범위에서 동기화 가능한 prop만 우선 Property Editor에 노출한다. 계약이 없는 S2 prop는 별도 후속 작업으로 분리한다.
- 장점:
  - ADR 범위가 명확하다.
  - editor-preview-spec 정합성을 작은 단위로 확보할 수 있다.
  - ADR-041 자동 생성 이전에도 위험이 낮은 정리를 진행할 수 있다.
- 위험:
  - 기술: L
  - 유지보수: L
  - 마이그레이션: M
- 이유:
  - 일부 S2 prop는 즉시 노출되지 않으므로 문서 parity는 단계적으로만 달성된다.
  - 대신 현재 계약을 넘어서는 변경을 의식적으로 분리할 수 있다.

### 대안 C: ADR-041까지 보류

- 설명: Spec-Driven Property Editor 자동 생성(ADR-041) 시점까지 수동 정렬 작업을 미룬다.
- 장점:
  - 중복 수작업 감소 가능
  - 장기적으로는 자동 생성 체계와 일치
- 위험:
  - 기술: M
  - 유지보수: M
  - 마이그레이션: L
- 이유:
  - 이미 존재하는 editor gap이 계속 남는다.
  - 현재 사용자/개발자가 겪는 prop 노출 불일치를 해소하지 못한다.

## Risk Threshold Check

- 모든 대안에 HIGH 이상 위험이 존재하지는 않는다.
- 대안 A는 범위가 넓어 HIGH 위험이 다수 존재하므로, 이를 회피하는 축소 대안이 필요하다.
- 대안 B는 잔존 위험이 관리 가능하며, 현재 저장소 규칙과 가장 잘 맞는다.

## Decision

**대안 B, Contract-First 정렬을 채택한다.**

이번 ADR의 범위는 다음으로 제한한다.

1. 현재 composition 계약에 이미 존재하거나, 같은 변경 세트 안에서 타입/spec/renderer 동기화가 명확히 가능한 prop만 Property Editor에 노출한다.
2. S2 문서에는 존재하지만 현재 composition 계약에 없는 prop는 "계약 확장 후보"로 분리하고, 별도 ADR 또는 후속 breakdown에서 다룬다.
3. Property Editor 변경은 단독 UI 작업으로 취급하지 않고, editor → unified types/spec → renderer/preview 반영을 하나의 계약 정렬 작업으로 본다.

즉, 이 ADR은 "S2 문서 전체 복제"가 아니라 "현재 제품 계약과 어긋난 editor surface를 정렬하는 결정"이다.

## Gates

| Gate | 조건                                                                                                                                       | 목적                         |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------- |
| G1   | 추가하려는 prop가 `unified.types.ts`, shared component API, renderer 전달 경로 중 최소 2개 이상에서 확인되거나, 같은 PR에서 함께 보강된다. | UI-only 가짜 지원 방지       |
| G2   | 새 editor prop는 preview 또는 publish 중 실제 렌더 경로 한 곳 이상에서 값 반영이 확인된다.                                                 | editor-preview 불일치 방지   |
| G3   | 각 변경 묶음은 `pnpm run type-check`, `pnpm run lint`를 통과한다. 타입/린트 실패 상태로 병합하지 않는다.                                   | 저장소 기본 품질 게이트 준수 |
| G4   | 계약이 없는 S2 prop를 도입하는 경우, 해당 항목은 이 ADR의 직접 범위에서 제외하고 별도 계약 확장 항목으로 명시한다.                         | 범위 팽창 방지               |
| G5   | 세부 작업 순서, 파일 목록, 수동 QA 체크리스트는 ADR 본문이 아니라 breakdown 문서에서 관리한다.                                             | ADR 형식 준수                |

잔존 HIGH 위험 없음. 다만 계약이 없는 prop를 무리하게 이번 범위에 포함시키는 순간 위험 등급이 즉시 상승하므로, G4를 강제한다.

## Consequences

### Positive

- Property Editor 정렬 작업의 범위가 명확해진다.
- S2 문서 기반 검토와 현재 제품 계약 검토를 분리해서 다룰 수 있다.
- 에디터에만 prop를 추가하고 실제 렌더링이 따라오지 않는 회귀를 줄인다.
- ADR-041 자동 생성 이전에도 위험이 낮은 계약 정렬을 진행할 수 있다.
- ADR-041 이전에 필요한 선행 순서가 명확해진다. 즉, `기존 계약 정렬 → 계약 확장 결정 → 자동 생성 전환`의 흐름을 문서 수준에서 고정할 수 있다.

### Negative

- S2 문서의 모든 prop가 즉시 노출되지는 않는다.
- 일부 컴포넌트는 "에디터 정렬"이 아니라 별도 "계약 확장" 작업으로 다시 쪼개야 한다.
- 문서 parity보다 제품 계약 안정성을 우선하므로, 단기적으로는 완성도가 보수적으로 보일 수 있다.

## References

- [ADR-023](023-s2-component-variant-props.md): Variant props의 S2 전환
- [ADR-030](030-s2-spectrum-only-components.md): S2 전용 컴포넌트 도입
- [ADR-041](041-spec-driven-property-editor.md): Property Editor 자동 생성 후속
- [ADR-045 Breakdown](/Users/admin/work/composition/docs/adr/design/adr-045-s2-property-editor-alignment-breakdown.md): 컴포넌트별 실행 메모와 계약 확장 후보
- [React Spectrum S2 Dialog](/Users/admin/work/composition/.agents/skills/react-spectrum-s2/references/components/Dialog.md)
- [React Spectrum S2 Form](/Users/admin/work/composition/.agents/skills/react-spectrum-s2/references/components/Form.md)
- [React Spectrum S2 ColorField](/Users/admin/work/composition/.agents/skills/react-spectrum-s2/references/components/ColorField.md)
- [React Spectrum S2 Link](/Users/admin/work/composition/.agents/skills/react-spectrum-s2/references/components/Link.md)
- [React Spectrum S2 Menu](/Users/admin/work/composition/.agents/skills/react-spectrum-s2/references/components/Menu.md)
- [React Spectrum S2 Tabs](/Users/admin/work/composition/.agents/skills/react-spectrum-s2/references/components/Tabs.md)
- [React Spectrum S2 Popover](/Users/admin/work/composition/.agents/skills/react-spectrum-s2/references/components/Popover.md)
- [React Spectrum S2 Tooltip](/Users/admin/work/composition/.agents/skills/react-spectrum-s2/references/components/Tooltip.md)
- [React Spectrum S2 Breadcrumbs](/Users/admin/work/composition/.agents/skills/react-spectrum-s2/references/components/Breadcrumbs.md)
