# ADR-105-a: @sync F3+F5 상수 primitives 이관 — BUTTON_SIZE_CONFIG & DATE_PICKER_INPUT_HEIGHT

## Status

Implemented — 2026-04-21

## Context

### SSOT 체인 domain 판정

**D3 (시각 스타일) 전용 작업**. `BUTTON_SIZE_CONFIG` (버튼 높이/패딩 metric)와 `DATE_PICKER_INPUT_HEIGHT` (DateInput 높이 metric)는 모두 시각 크기 상수이므로 D3 domain. D1 (DOM/접근성) / D2 (Props/API) 침범 없음.

정본: [ssot-hierarchy.md](../../../.claude/rules/ssot-hierarchy.md) / 공식 결정: [ADR-063](063-ssot-chain-charter.md)

### 배경 — ADR-105 Charter F3 슬롯

ADR-105 (@sync 주석 감사 Charter, Proposed 2026-04-21) 가 37건 @sync 주석을 F1~F5로 분류했다. 이 중 **F3 (spec-to-utils 상수 참조, 4건)** 는 가장 위험이 낮고 다른 카테고리의 전제 조건이 된다:

- F3 primitives 이관 완료 → F1의 Button.spec.ts 동기화 @sync 자동 해소 후보
- F3 primitives 이관 완료 → F5의 `utils.ts:1815` @sync 해소

본 ADR은 **F3 4건 + F5 연계 2건 = 6건**을 단일 작업으로 해소한다.

### 실측 — 해소 대상 6건 소비 코드 경로 (#1 반복 패턴 체크)

| ID  | 파일                                                                | 라인 | @sync 원문                                                                    | 현재 상태                                                                          |
| --- | ------------------------------------------------------------------- | ---- | ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| C1  | `packages/specs/src/components/Input.spec.ts`                       | 82   | `@sync BUTTON_SIZE_CONFIG (utils.ts) — Input height = Button height`          | Spec에 sizes 직접 선언. utils.ts와 수동 동기화                                     |
| C2  | `packages/specs/src/components/Select.spec.ts`                      | 296  | `@sync BUTTON_SIZE_CONFIG (utils.ts) — Select trigger height = Button height` | 동일 패턴                                                                          |
| C3  | `packages/specs/src/components/SelectTrigger.spec.ts`               | 94   | `@sync BUTTON_SIZE_CONFIG (utils.ts) — SelectTrigger height = Button height`  | 동일 패턴                                                                          |
| C4  | `packages/specs/src/components/DatePicker.spec.ts`                  | 49   | `@sync DateInput.spec.ts — DateRangePicker.spec.ts에서도 import`              | `DATE_PICKER_INPUT_HEIGHT` 상수가 DatePicker.spec.ts에 정의됨                      |
| C5  | `apps/builder/src/builder/workspace/canvas/layout/engines/utils.ts` | 1815 | `@sync Select.spec.ts / ComboBox.spec.ts sizes`                               | ADR-091 Phase 3에서 `SelectTriggerSpec.sizes.contentHeight` 이관 완료. 주석만 잔존 |
| C6  | `apps/builder/src/builder/workspace/canvas/layout/engines/utils.ts` | 1986 | `DateInput: intrinsic height (@sync DateInput.spec.ts INPUT_HEIGHT)`          | ADR-091 Phase 3에서 `DateInputSpec.sizes.height` 이관 완료. 주석만 잔존            |

**C5/C6 현황**: ADR-091 Phase 3 구현 결과, 해당 코드 경로는 이미 Spec direct read-through로 전환 완료됨. `@sync` 주석이 stale 상태로 잔존.

### 핵심 패턴 분석

**BUTTON_SIZE_CONFIG의 실제 구조** (`apps/builder/src/builder/workspace/canvas/layout/engines/utils.ts:529`):

```typescript
// utils.ts:529
const BUTTON_SIZE_CONFIG = deriveSizeConfig(ButtonSpec.sizes);
```

`BUTTON_SIZE_CONFIG`는 `ButtonSpec.sizes`를 `deriveSizeConfig()`로 변환한 런타임 파생값이다. `Input.spec.ts`/`Select.spec.ts`/`SelectTrigger.spec.ts`가 `@sync`로 경고하는 높이 값은 **ButtonSpec.sizes에서 계산 가능한 값**이다:

```
height = lineHeight + paddingY×2 + borderWidth×2
```

각 Spec 파일은 이미 동일 값을 sizes 필드에 직접 선언하고 있으나, ButtonSpec.sizes와 실질적으로 수동 동기화 상태.

**DATE_PICKER_INPUT_HEIGHT의 실제 구조** (`packages/specs/src/components/DatePicker.spec.ts:50`):

```typescript
/** @sync DateInput.spec.ts — DateRangePicker.spec.ts에서도 import */
export const DATE_PICKER_INPUT_HEIGHT: Record<string, number> = {
  sm: 22,
  md: 30,
  lg: 42,
};
```

이 값은 `DateInputSpec.sizes.height` 와 동일값이다 (ADR-091 Phase 3에서 확인됨). consumer-to-consumer debt이나 현재는 DateInput.spec.ts가 아닌 DatePicker.spec.ts 내부에 중복 선언된 상태.

### Hard Constraints

1. **BC 영향 0%**: element.tag 변경 없음. Spec 파일 수정은 시각 metric 값 자체를 변경하지 않음
2. **Generator 미개입**: F3/F5 상수 이관은 Generator 확장 없음. CSS 자동 생성 경로에 영향 없음 (#2 반복 패턴 체크)
3. **type-check 3/3 + specs PASS + builder PASS** 의무 유지
4. **utils.ts re-import**: `BUTTON_SIZE_CONFIG`는 utils.ts에서 여전히 사용 중이므로, primitives 이관 후 utils.ts에서 re-import하여 기존 소비처 변경 최소화

### Soft Constraints

- ADR-091 Class C (FONT_STRETCH_KEYWORD_MAP → `packages/specs/src/primitives/font.ts`) 패턴 재사용
- DatePicker.spec.ts의 `DATE_PICKER_INPUT_HEIGHT`는 DateInput.spec.ts export로 대체 가능한지 검토

## Alternatives Considered

### 대안 A: ButtonSpec.sizes → primitives 이관 + Spec 파일 import 전환 (선정)

- 설명: `packages/specs/src/primitives/buttonSizes.ts` 신설. `ButtonSpec.sizes`의 높이 metric (xs~xl height/paddingY/lineHeight) 을 공유 상수로 추출하고, `Input.spec.ts` / `Select.spec.ts` / `SelectTrigger.spec.ts` 가 동일 primitives 상수 import. `BUTTON_SIZE_CONFIG`는 utils.ts에서 primitives를 re-import하여 `deriveSizeConfig()` 적용 유지. `DATE_PICKER_INPUT_HEIGHT`는 `DateInput.spec.ts`의 sizes.height로 대체 또는 primitives 이관. C5/C6 stale `@sync` 주석 삭제.
- 위험:
  - 기술: LOW — ADR-091 Class C 선례 패턴 그대로. primitives/ 경로 기존 관행 확립됨
  - 성능: LOW — import 경로 변경만, 런타임 계산 동일
  - 유지보수: LOW — SSOT 복귀. Spec 파일 간 수동 동기화 의무 제거
  - 마이그레이션: LOW — BC 0%. 저장 데이터 구조 미변경

### 대안 B: spec-to-spec direct import (Spec 파일 간 직접 import)

- 설명: `Input.spec.ts` / `Select.spec.ts` 등이 `ButtonSpec.sizes`를 직접 import하여 높이 계산. `primitives/` 신설 없음. "Spec 파일 간 직접 import는 consumer-to-consumer가 아닌 SSOT 공유"로 해석.
- 위험:
  - 기술: LOW — TypeScript import만. 순환 의존 없음 확인 필요
  - 성능: LOW
  - 유지보수: **MEDIUM** — `Button.spec.ts`의 sizes 구조 변경 시 Input/Select/SelectTrigger 전파. primitives 추상화 없이 컴포넌트 spec 간 강결합. 향후 Button sizes 확장이 다른 컴포넌트에 의도치 않게 전파될 위험
  - 마이그레이션: LOW

### 대안 C: @sync 주석 정당화 + 설명 주석 교체 (이관 없이 해소)

- 설명: Input/Select/SelectTrigger의 sizes는 이미 올바른 값으로 독립 선언되어 있고, Button height를 "따른다"는 것은 설계 의도이지 코드 의존성이 아님. `@sync` 경고 주석을 설명 주석("Button height와 동일한 값 의도")으로 교체하여 경고성 마커를 제거.
- 위험:
  - 기술: LOW — 코드 변경 없음
  - 성능: LOW
  - 유지보수: **MEDIUM** — 실제 drift 방지 메커니즘 없음. Button sizes가 변경될 때 Input/Select/SelectTrigger의 수동 업데이트 의무가 남음. ADR-063 §4.2 "consumer-to-consumer 의존성" 구조는 개선 없이 주석만 교체
  - 마이그레이션: LOW

### Risk Threshold Check

| 대안                           | 기술 | 성능 | 유지보수 | 마이그레이션 | HIGH+ 수 | 판정     |
| ------------------------------ | :--: | :--: | :------: | :----------: | :------: | -------- |
| A: primitives 이관 + re-import |  L   |  L   |    L     |      L       |    0     | **PASS** |
| B: spec-to-spec direct import  |  L   |  L   |    M     |      L       |    0     | PASS     |
| C: 주석 교체 (코드 무변경)     |  L   |  L   |    M     |      L       |    0     | PASS     |

세 대안 모두 HIGH+ 없음. 단, 대안 A가 실제 SSOT 복구 효과 최대. 대안 B는 컴포넌트 spec 간 강결합 유지보수 위험. 대안 C는 drift 방지 없이 주석만 교체.

**반복 패턴 선차단 체크** (adr-writing.md Top 1~4):

- [x] **#1 코드 경로 인용**: Context 표에 6건 grep 가능 파일:라인 명시. `Input.spec.ts:82`, `Select.spec.ts:296`, `SelectTrigger.spec.ts:94`, `DatePicker.spec.ts:49`, `utils.ts:1815`, `utils.ts:1986`
- [x] **#2 Generator 확장 여부**: F3/F5 상수 이관은 Generator 미개입. CSSGenerator 경로에 영향 없음. 명시 완료
- [x] **#3 BC 수식화**: element.tag 변경 없음 → BC 영향 0%. 저장 데이터 구조 미변경
- [x] **#4 Phase 분리 가능성**: 6건이 논리적으로 2그룹 (F3: Input/Select/SelectTrigger / F5: utils.ts stale 주석). 단일 ADR로 처리 가능한 수준 — Phase 2개로 충분

## Decision

**대안 A 채택** (primitives 이관 + re-import 패턴).

선택 근거:

1. **SSOT 실질 복구**: 공유 상수를 `primitives/`에 표면화하면 Button sizes 변경 시 전파 경로가 명확해짐. 단순 주석 교체(대안 C)보다 실질적.
2. **ADR-091 Class C 선례**: `FONT_STRETCH_KEYWORD_MAP → primitives/font.ts` 패턴이 동일 프로젝트에서 검증됨. 관행 일관성.
3. **컴포넌트 spec 간 약결합**: primitives 추상화가 Button spec → Input/Select/SelectTrigger 직접 결합(대안 B)보다 유지보수에 유리.
4. **C5/C6 stale 주석 제거**: ADR-091이 이미 코드를 Spec read-through로 전환했으므로, 잔존 `@sync` 주석 삭제가 본 ADR의 가장 즉각적 효과.

기각 사유:

- **대안 B 기각**: `Input.spec.ts`가 `ButtonSpec.sizes`를 직접 import하면, Button sizes 구조(lineHeight Token, paddingY 등) 변경이 Input spec에 의도치 않게 전파될 수 있음. primitives 추상화가 더 적절한 경계.
- **대안 C 기각**: drift 방지 메커니즘 없이 경고 주석만 제거하면 ADR-063 §4.2 금지 패턴이 소음 없이 코드베이스에 잔존. 실질적 SSOT 복구 없음.

> 구현 상세: [105-a-sync-utils-constants-primitives-breakdown.md](../../adr/design/105-a-sync-utils-constants-primitives-breakdown.md)

## Risks

| ID  | 위험                                                                                                 | 심각도 | 대응                                                                                                                                       |
| --- | ---------------------------------------------------------------------------------------------------- | :----: | ------------------------------------------------------------------------------------------------------------------------------------------ |
| R1  | `primitives/buttonSizes.ts` 신설 시 ButtonSpec.sizes와 값 이중 정의 발생 — spec을 어디서 읽는지 혼란 |  MED   | 명확한 설계: ButtonSpec.sizes는 Spec SSOT, buttonSizes primitives는 Spec에서 파생한 공유 상수. 주석으로 파생 관계 명시                     |
| R2  | `DATE_PICKER_INPUT_HEIGHT`가 `DateInput.spec.ts`의 sizes.height와 값이 실제로 일치하는지 검증 미비   |  MED   | P1 착수 전 `DateInputSpec.sizes` 값과 `DATE_PICKER_INPUT_HEIGHT` 값을 grep으로 교차 검증 필수. 불일치 시 올바른 값 확정 후 primitives 이관 |
| R3  | utils.ts의 `BUTTON_SIZE_CONFIG` 소비처가 primitives re-import 후 동작이 동일한지 검증 필요           |  LOW   | type-check + specs PASS로 검증. `deriveSizeConfig()`는 불변 함수이므로 값 동일성 보장                                                      |
| R4  | C5/C6 @sync 주석 삭제 후 실제로 코드가 Spec read-through인지 재확인 필요                             |  LOW   | `utils.ts:1815`, `utils.ts:1986` 주변 코드 검토 후 삭제. ADR-091 Phase 3 구현 결과 검증됨                                                  |

잔존 HIGH 위험 없음.

## Gates

잔존 HIGH 위험 없음 — Gate 테이블 생략.

검증 기준:

- `rg "@sync BUTTON_SIZE_CONFIG" packages/specs/src/components/` → 0건
- `rg "@sync DateInput.spec.ts" packages/specs/src/components/DatePicker.spec.ts` → 0건
- `rg "@sync.*INPUT_HEIGHT\|@sync.*Select.spec.*utils\|@sync.*ComboBox.spec.*utils" apps/builder/src/builder/workspace/canvas/layout/engines/utils.ts` → 0건
- `pnpm type-check` 3/3 PASS
- `pnpm build:specs` PASS (specs 205/205)
- builder 타입 체크 PASS

## Consequences

### Positive

- **ADR-105 F3 4건 + F5 연계 2건 = 6건 @sync 해소** — consumer-to-consumer debt 6건 제거
- **primitives/ 확장**: `buttonSizes.ts` 추가로 향후 Button 계열 공유 metric의 SSOT 위치 확보
- **stale @sync 주석 제거**: ADR-091이 이미 완료한 Spec read-through 전환의 문서 부채 청산
- **ADR-105 Charter Implemented 전환 조건 충족**: 첫 후속 sub-ADR (105-a) Proposed 발행

### Negative

- **primitives/ 파일 1개 추가**: `buttonSizes.ts` 신설로 primitives 디렉토리 파일 수 증가 (기존 7 → 8개)
- **Button sizes 이중 관리 위험 (단기)**: `ButtonSpec.sizes`와 `primitives/buttonSizes.ts`가 병존하는 과도기 동안 값 일치 여부를 명시적 관리 필요. 장기적으로 ButtonSpec.sizes가 단일 소스 역할 유지

## 참조

- [ADR-105](105-sync-annotation-audit-charter.md) — @sync 감사 Charter (본 ADR의 부모)
- [ADR-091](091-utils-record-dissolution.md) — Class C primitives 이관 패턴 선례 (FONT_STRETCH_KEYWORD_MAP)
- [ADR-063](063-ssot-chain-charter.md) — SSOT 체인 D3 domain 원칙 (consumer-to-consumer 금지)
- [ssot-hierarchy.md](../../../.claude/rules/ssot-hierarchy.md) — §4.2 @sync 금지 패턴 정본
