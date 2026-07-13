# ADR-105-a Breakdown: @sync F3+F5 상수 primitives 이관

> **ADR**: [105-a-sync-utils-constants-primitives.md](../completed/105-a-sync-utils-constants-primitives.md)
> **스냅샷 날짜**: 2026-04-21
> **해소 건수**: 6건 (F3 4건 + F5 stale 주석 2건)

---

## 1. 해소 대상 상세

### F3 — spec-to-utils 상수 참조 (4건, C1~C4)

| ID  | 파일                    | 라인 | @sync 원문                                                                    | 현재 sizes 값 요약                            |
| --- | ----------------------- | ---- | ----------------------------------------------------------------------------- | --------------------------------------------- |
| C1  | `Input.spec.ts`         | 82   | `@sync BUTTON_SIZE_CONFIG (utils.ts) — Input height = Button height`          | xs:20 sm:22 md:30 lg:42 xl:54                 |
| C2  | `Select.spec.ts`        | 296  | `@sync BUTTON_SIZE_CONFIG (utils.ts) — Select trigger height = Button height` | xs:20 sm:22 md:30 lg:42 xl:54                 |
| C3  | `SelectTrigger.spec.ts` | 94   | `@sync BUTTON_SIZE_CONFIG (utils.ts) — SelectTrigger height = Button height`  | xs:20 sm:22 md:30 lg:42 xl:54                 |
| C4  | `DatePicker.spec.ts`    | 49   | `@sync DateInput.spec.ts — DateRangePicker.spec.ts에서도 import`              | `DATE_PICKER_INPUT_HEIGHT`: sm:22 md:30 lg:42 |

### F5 연계 — stale @sync 주석 (2건, C5~C6)

ADR-091 Phase 3에서 코드는 이미 Spec read-through로 전환 완료. 주석만 잔존.

| ID  | 파일       | 라인 | @sync 원문                                                           | 실제 코드 상태                                                 |
| --- | ---------- | ---- | -------------------------------------------------------------------- | -------------------------------------------------------------- |
| C5  | `utils.ts` | 1815 | `@sync Select.spec.ts / ComboBox.spec.ts sizes`                      | `SelectTriggerSpec.sizes[parentSize]?.contentHeight` 직접 참조 |
| C6  | `utils.ts` | 1986 | `DateInput: intrinsic height (@sync DateInput.spec.ts INPUT_HEIGHT)` | `DateInputSpec.sizes[sizeName]?.height` 직접 참조              |

---

## 2. Phase 구성

### P0: 사전 검증 (착수 전 필수)

1. `DateInputSpec.sizes` 높이 값과 `DATE_PICKER_INPUT_HEIGHT` 값 교차 검증

   ```bash
   grep -n "height\|sizes" packages/specs/src/components/DateInput.spec.ts | head -30
   # 확인: sm:22, md:30, lg:42 일치 여부
   ```

2. `ButtonSpec.sizes`의 높이 계산식 검증

   ```bash
   # utils.ts:529 BUTTON_SIZE_CONFIG 정의 확인
   # Input.spec.ts:82 하단의 높이 계산 주석과 대조
   # xs: 16 + 1×2 + 1×2 = 20, sm: 16 + 2×2 + 1×2 = 22, md: 20 + 4×2 + 1×2 = 30
   # lg: 24 + 8×2 + 1×2 = 42, xl: 28 + 12×2 + 1×2 = 54
   ```

3. C5/C6 utils.ts 코드 직접 확인 — ADR-091 전환 완료 재검증

   ```bash
   grep -n "SelectTriggerSpec\|DateInputSpec" apps/builder/src/builder/workspace/canvas/layout/engines/utils.ts | head -10
   ```

### P1: primitives/buttonSizes.ts 신설

**파일**: `packages/specs/src/primitives/buttonSizes.ts` (신설)

목적: Input/Select/SelectTrigger spec이 Button height metric을 공유할 수 있는 SSOT primitives 상수.

```typescript
/**
 * Button-family height primitives
 *
 * Input / Select / SelectTrigger 가 Button 과 동일한 높이 metric 을 사용한다.
 * SSOT: ButtonSpec.sizes 에서 파생. (ADR-105-a, ADR-091 Class C 패턴)
 *
 * height = lineHeight + paddingY×2 + borderWidth×2
 * xs: 16 + 1×2 + 1×2 = 20
 * sm: 16 + 2×2 + 1×2 = 22
 * md: 20 + 4×2 + 1×2 = 30
 * lg: 24 + 8×2 + 1×2 = 42
 * xl: 28 + 12×2 + 1×2 = 54
 */
export const BUTTON_FAMILY_HEIGHTS: Record<string, number> = {
  xs: 20,
  sm: 22,
  md: 30,
  lg: 42,
  xl: 54,
} as const;
```

**primitives/index.ts 에 추가**:

```typescript
// Button-family height metric (ADR-105-a)
export { BUTTON_FAMILY_HEIGHTS } from "./buttonSizes";
```

### P2: DatePicker.spec.ts @sync 해소

**선택지 평가** (P0에서 `DateInputSpec.sizes.height` 값 일치 확인 후 결정):

**Option P2-A** (권장 — 값 일치 확인된 경우): `DATE_PICKER_INPUT_HEIGHT` 를 `primitives/fieldSizes.ts` 또는 기존 `buttonSizes.ts`에 통합 후 DatePicker.spec.ts, DateRangePicker.spec.ts가 primitives에서 import.

**Option P2-B** (값 불일치 또는 xl 범위 차이 시): `DATE_PICKER_INPUT_HEIGHT`를 `DateInput.spec.ts`의 `sizes.height`에서 직접 export하도록 전환. DatePicker.spec.ts가 DateInput.spec.ts에서 import (spec-to-spec 직접 import는 허용 패턴).

**Option P2-C** (최소 변경): `@sync` 주석을 설명 주석으로 교체. `DATE_PICKER_INPUT_HEIGHT`가 `DateInput.spec.ts`의 `InputSpec.sizes.height`와 동일임을 주석에 명시.

### P3: Spec 파일 @sync 주석 제거 (C1~C3)

`Input.spec.ts:82`, `Select.spec.ts:296`, `SelectTrigger.spec.ts:94` 의 `@sync BUTTON_SIZE_CONFIG` 주석을 제거하고 primitives 참조 설명 주석으로 교체:

```typescript
// BUTTON_FAMILY_HEIGHTS (primitives/buttonSizes.ts) 와 동일 metric.
// height = lineHeight + paddingY×2 + borderWidth×2
```

> **주의**: spec 파일의 sizes 값 자체는 변경하지 않음. 주석 교체만.

### P4: utils.ts stale @sync 주석 제거 (C5~C6)

`utils.ts:1815` 와 `utils.ts:1986` 의 `@sync` 주석 삭제.

```typescript
// Before (utils.ts:1815)
// @sync Select.spec.ts / ComboBox.spec.ts sizes
// content-box = border-box - paddingY*2 - borderWidth*2
// ADR-091 Phase 3: TRIGGER_CONTENT_HEIGHTS Record → SelectTriggerSpec.sizes.contentHeight.
return SelectTriggerSpec.sizes[parentSize]?.contentHeight ?? 20;

// After
// content-box = border-box - paddingY*2 - borderWidth*2
// ADR-091 Phase 3: SelectTriggerSpec.sizes.contentHeight 직접 참조.
return SelectTriggerSpec.sizes[parentSize]?.contentHeight ?? 20;
```

```typescript
// Before (utils.ts:1986)
// DateInput: intrinsic height (@sync DateInput.spec.ts INPUT_HEIGHT)
// ADR-091 Phase 3: inputHeights Record → DateInputSpec.sizes.height 직접 참조.

// After
// DateInput: intrinsic height — DateInputSpec.sizes.height 직접 참조 (ADR-091 Phase 3).
```

### P5: 검증

```bash
# @sync 주석 잔존 확인
rg "@sync BUTTON_SIZE_CONFIG" packages/specs/src/components/
# → 0건

rg "@sync DateInput.spec.ts" packages/specs/src/components/DatePicker.spec.ts
# → 0건

rg "@sync.*INPUT_HEIGHT|@sync.*Select.spec.*utils|@sync.*ComboBox.spec.*utils" \
  apps/builder/src/builder/workspace/canvas/layout/engines/utils.ts
# → 0건

# 빌드 검증
pnpm type-check           # 3/3 PASS
pnpm build:specs          # specs PASS
```

---

## 3. 파일 변경 목록

| 파일                                                                | 변경 종류                  | 내용                                        |
| ------------------------------------------------------------------- | -------------------------- | ------------------------------------------- |
| `packages/specs/src/primitives/buttonSizes.ts`                      | **신설**                   | `BUTTON_FAMILY_HEIGHTS` 상수 정의           |
| `packages/specs/src/primitives/index.ts`                            | 추가 (1줄)                 | `BUTTON_FAMILY_HEIGHTS` re-export           |
| `packages/specs/src/components/Input.spec.ts`                       | 주석 교체 (1줄)            | `@sync BUTTON_SIZE_CONFIG` → 설명 주석      |
| `packages/specs/src/components/Select.spec.ts`                      | 주석 교체 (1줄)            | `@sync BUTTON_SIZE_CONFIG` → 설명 주석      |
| `packages/specs/src/components/SelectTrigger.spec.ts`               | 주석 교체 (1줄)            | `@sync BUTTON_SIZE_CONFIG` → 설명 주석      |
| `packages/specs/src/components/DatePicker.spec.ts`                  | 주석 교체 또는 import 전환 | P2 옵션에 따라 결정 (P0 검증 후)            |
| `apps/builder/src/builder/workspace/canvas/layout/engines/utils.ts` | 주석 삭제 (2줄)            | `utils.ts:1815`, `utils.ts:1986` stale 주석 |

---

## 4. 자연 해소 후보 확인 체크리스트

P0에서 아래 항목을 재검증하여 이미 해소된 경우 해당 Phase 스킵:

- [x] C5 (`utils.ts:1815`): `SelectTriggerSpec.sizes[parentSize]?.contentHeight` 코드 확인 → 주석만 삭제
- [x] C6 (`utils.ts:1986`): `DateInputSpec.sizes[sizeName]?.height` 코드 확인 → 주석만 삭제
- [x] C4 (`DatePicker.spec.ts:49`): 값 범위 불일치(xs/xl 없음) → P2-C 선택, 설명 주석 교체

---

## 5. 예상 소요

- P0 사전 검증: ~10분 (grep 3회)
- P1 primitives 신설: ~15분
- P2 DatePicker.spec.ts 처리: ~10분 (P2-C의 경우 5분)
- P3 spec 파일 주석 교체: ~10분 (3파일)
- P4 utils.ts 주석 삭제: ~5분
- P5 검증: ~10분
- **합계: ~60분 (1세션 내 완결 목표)**
