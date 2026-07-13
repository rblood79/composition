# ADR-105-b Breakdown: @sync F1 spec-to-spec primitives 공유

> **ADR**: [105-b-sync-spec-to-spec-primitives-sharing.md](../completed/105-b-sync-spec-to-spec-primitives-sharing.md)
> **스냅샷 날짜**: 2026-04-21
> **해소 건수**: 10건 (F1 전체)
> **Status**: Implemented — 2026-04-21 (type-check 3/3 PASS, specs 205/205 PASS)

---

## 1. 항목별 처리 매트릭스

| ID  | 파일                  | 라인          | Option                     | Phase | 처리 내용                                                                 |
| --- | --------------------- | ------------- | -------------------------- | ----- | ------------------------------------------------------------------------- |
| S1  | `ComboBox.spec.ts`    | 259           | **A**                      | P1    | @sync 삭제 + FIELD_FAMILY_SIZES 참조 설명 주석                            |
| S2  | `NumberField.spec.ts` | 7 (파일 주석) | **C**                      | P3    | @sync → "구조 유사, 독립 선언 유지" 설명 주석                             |
| S3  | `NumberField.spec.ts` | 389           | **A**                      | P1    | @sync 삭제 + FIELD_FAMILY_SIZES 참조 설명 주석                            |
| S4  | `NumberField.spec.ts` | 439           | **C**                      | P3    | @sync → "composition 구조 유사, disabled 처리 방식 다름" 설명 주석        |
| S5  | `NumberField.spec.ts` | 928           | **C**                      | P3    | @sync → "ComboBox chevron과 동일한 아이콘-전용 렌더링 패턴" 설명 주석     |
| S6  | `NumberField.spec.ts` | 941           | **C**                      | P3    | @sync → 동일 패턴 설명 주석                                               |
| S7  | `SelectIcon.spec.ts`  | 44            | **A**                      | P1    | @sync 삭제 + FIELD_FAMILY_SIZES.iconSize 참조 설명 주석                   |
| S8  | `Tab.spec.ts`         | 63            | **A**                      | P2    | @sync 삭제 + TABS_SIZE_CONFIG 참조 설명 주석                              |
| S9  | `Tabs.spec.ts`        | 140           | **A**(F1) + 105-c 위임(F2) | P2    | Button 계산식 설명 주석 추가. Tabs.css 참조는 105-c 위임 명시             |
| S10 | `TextField.spec.ts`   | 256           | **C**                      | P3    | @sync → "sm~xl은 BUTTON_FAMILY_HEIGHTS 동일. xs:18은 독립 진화" 설명 주석 |

---

## 2. P0: 사전 검증 결과 (착수 전 완료)

### 값 비교표

**Field sizes 그룹** (ComboBox / Select / NumberField):

| size | height | paddingX | paddingY | iconSize |   일치 여부    |
| ---- | ------ | -------- | -------- | -------- | :------------: |
| xs   | 20     | 4        | 1        | 10       | **3파일 동일** |
| sm   | 22     | 8        | 2        | 14       | **3파일 동일** |
| md   | 30     | 12       | 4        | 18       | **3파일 동일** |
| lg   | 42     | 16       | 8        | 22       | **3파일 동일** |
| xl   | 54     | 24       | 12       | 28       | **3파일 동일** |

**SelectIcon.spec.ts sizes.iconSize** (Select.spec.ts 동일 값):
xs:10, sm:14, md:18, lg:22, xl:28 — 완전 일치.

**Tab sizes 그룹** (Tab.spec.ts / Tabs.spec.ts):

| size | height | paddingX | paddingY | 일치 여부 |
| ---- | ------ | -------- | -------- | :-------: |
| sm   | 21     | 8        | 2        | **동일**  |
| md   | 29     | 12       | 4        | **동일**  |
| lg   | 41     | 16       | 8        | **동일**  |

Tab height 공식: `paddingY×2 + lineHeight + borderWidth×1` (단면 하단 border).
xs/xl 없음 (Tabs 컴포넌트는 sm/md/lg 3단계).

**TextField xs 불일치**:

- TextField.spec.ts xs: height=18
- BUTTON_FAMILY_HEIGHTS xs: 20
- sm~xl: 동일 (22/30/42/54)
- 판정: TextField xs가 독립 진화함 → Option C (설명 주석으로 사실 기록)

**Button.spec.ts sizes.height**: 모두 `0` (런타임 계산). Tab 공식과 Button 공식은 별개.

---

## 3. Phase 구성

### P1: primitives/fieldSizes.ts 신설 (S1, S3, S7)

**파일**: `packages/specs/src/primitives/fieldSizes.ts` (신설)

```typescript
/**
 * Field-family size primitives
 *
 * ComboBox / Select / NumberField 가 동일한 크기 metric 을 사용한다.
 * SelectIcon.iconSize 도 이 값에서 파생된다.
 * SSOT: 세 컴포넌트의 합의된 시각 크기. (ADR-105-b)
 *
 * height = lineHeight + paddingY×2 + borderWidth×2
 * xs: 16 + 1×2 + 1×2 = 20
 * sm: 16 + 2×2 + 1×2 = 22
 * md: 20 + 4×2 + 1×2 = 30
 * lg: 24 + 8×2 + 1×2 = 42
 * xl: 28 + 12×2 + 1×2 = 54
 */
export const FIELD_FAMILY_SIZES: Record<
  string,
  { height: number; paddingX: number; paddingY: number; iconSize: number }
> = {
  xs: { height: 20, paddingX: 4, paddingY: 1, iconSize: 10 },
  sm: { height: 22, paddingX: 8, paddingY: 2, iconSize: 14 },
  md: { height: 30, paddingX: 12, paddingY: 4, iconSize: 18 },
  lg: { height: 42, paddingX: 16, paddingY: 8, iconSize: 22 },
  xl: { height: 54, paddingX: 24, paddingY: 12, iconSize: 28 },
} as const;
```

**primitives/index.ts 추가**:

```typescript
// Field-family size metric (ADR-105-b)
export { FIELD_FAMILY_SIZES } from "./fieldSizes";
```

### P2: primitives/tabSizes.ts 신설 (S8, S9)

**파일**: `packages/specs/src/primitives/tabSizes.ts` (신설)

```typescript
/**
 * Tab-family size primitives
 *
 * Tab.spec.ts 와 Tabs.spec.ts 가 동일한 크기 metric 을 사용한다.
 * SSOT: 두 컴포넌트의 합의된 시각 크기. (ADR-105-b)
 *
 * height 공식 (Button 과 다름 — 단면 하단 border):
 *   height = paddingY×2 + lineHeight + borderWidth×1
 *   sm: 2×2 + 16 + 1 = 21
 *   md: 4×2 + 20 + 1 = 29
 *   lg: 8×2 + 24 + 1 = 41
 *
 * xs/xl 없음 (Tab 컴포넌트는 sm/md/lg 3단계)
 */
export const TABS_SIZE_CONFIG: Record<
  string,
  { height: number; paddingX: number; paddingY: number }
> = {
  sm: { height: 21, paddingX: 8, paddingY: 2 },
  md: { height: 29, paddingX: 12, paddingY: 4 },
  lg: { height: 41, paddingX: 16, paddingY: 8 },
} as const;
```

**primitives/index.ts 추가**:

```typescript
// Tab-family size metric (ADR-105-b)
export { TABS_SIZE_CONFIG } from "./tabSizes";
```

### P3: Spec 파일 @sync 주석 교체 (S1~S10)

각 파일의 `@sync` 마커를 제거하고 설명 주석으로 교체한다. Spec sizes 값 자체는 변경하지 않는다.

**S1 — ComboBox.spec.ts:259**

```typescript
// Before
// @sync Select.spec.ts sizes — CSS height = lineHeight + paddingY×2 + borderWidth×2

// After
// FIELD_FAMILY_SIZES (primitives/fieldSizes.ts) 와 동일 metric. (ADR-105-b)
// height = lineHeight + paddingY×2 + borderWidth×2
```

**S3 — NumberField.spec.ts:389**

```typescript
// Before
// @sync ComboBox.spec.ts sizes — 동일한 height/padding/iconSize

// After
// FIELD_FAMILY_SIZES (primitives/fieldSizes.ts) 와 동일 metric. (ADR-105-b)
```

**S7 — SelectIcon.spec.ts:44**

```typescript
// Before
// @sync Select.spec.ts sizes.iconSize — Select/ComboBox 동일 아이콘 크기

// After
// FIELD_FAMILY_SIZES.iconSize (primitives/fieldSizes.ts) 와 동일 metric. (ADR-105-b)
```

**S8 — Tab.spec.ts:63**

```typescript
// Before
// TabsSpec.sizes와 동기화 (@sync Tabs.spec.ts)

// After
// TABS_SIZE_CONFIG (primitives/tabSizes.ts) 와 동일 metric. (ADR-105-b)
// height = paddingY×2 + lineHeight + borderWidth×1 (단면 하단 border)
```

**S9 — Tabs.spec.ts:140** (F1 부분 처리, F2 부분 105-c 위임)

```typescript
// Before
// @sync Button.spec.ts padding/fontSize 패턴 + Tabs.css
// sm: 2*2 + 16(lh) + 1 = 21, md: 4*2 + 20(lh) + 1 = 29, lg: 8*2 + 24(lh) + 1 = 41

// After
// TABS_SIZE_CONFIG (primitives/tabSizes.ts) 와 동일 metric. (ADR-105-b)
// height = paddingY×2 + lineHeight + borderWidth×1 (단면 하단 border — Button과 공식 다름)
// sm: 2*2 + 16(lh) + 1 = 21, md: 4*2 + 20(lh) + 1 = 29, lg: 8*2 + 24(lh) + 1 = 41
// Tabs.css 참조 부분 → 105-c (F2 spec-to-CSS) 에 위임
```

**S10 — TextField.spec.ts:256**

```typescript
// Before
// @sync Button.spec.ts sizes — Input height = Button height

// After
// sm~xl: BUTTON_FAMILY_HEIGHTS (primitives/buttonSizes.ts) 와 동일 metric.
// xs: height=18 — Button xs(20)와 독립 진화. 수정 금지 (BC 위험).
```

**S2 — NumberField.spec.ts:7 (파일 주석)**

```typescript
// Before
// @sync ComboBox.spec.ts — 동일한 컨테이너/버튼 패턴

// After
// ComboBox 와 유사한 컨테이너/버튼 패턴이나 독립 선언 유지.
// sizes metric: FIELD_FAMILY_SIZES (primitives/fieldSizes.ts) 참조.
```

**S4 — NumberField.spec.ts:439**

```typescript
// Before
// @sync ComboBox.spec.ts composition — 동일한 컨테이너/버튼 패턴

// After
// ComboBox composition 과 기본 구조 유사 (flex-column, gap). 독립 선언 유지.
// disabled 처리: ComboBox(.react-aria-Button)와 달리 NumberField(.react-aria-Group) 기준.
```

**S5 — NumberField.spec.ts:928**

```typescript
// Before
// 감소 아이콘 (-) — @sync ComboBox chevron: 배경 없이 아이콘만

// After
// 감소 아이콘 (-) — ComboBox chevron 과 동일한 배경 없이 아이콘만 패턴
```

**S6 — NumberField.spec.ts:941**

```typescript
// Before
// 증가 아이콘 (+) — @sync ComboBox chevron: 배경 없이 아이콘만

// After
// 증가 아이콘 (+) — ComboBox chevron 과 동일한 배경 없이 아이콘만 패턴
```

### P4: 검증

```bash
# F1 @sync 잔존 확인
rg "@sync Select.spec.ts sizes" packages/specs/src/components/ComboBox.spec.ts
# → 0건

rg "@sync ComboBox.spec.ts sizes" packages/specs/src/components/NumberField.spec.ts
# → 0건

rg "@sync Select.spec.ts sizes.iconSize" packages/specs/src/components/SelectIcon.spec.ts
# → 0건

rg "@sync Tabs.spec.ts" packages/specs/src/components/Tab.spec.ts
# → 0건

rg "@sync Button.spec.ts sizes" packages/specs/src/components/TextField.spec.ts
# → 0건

# 빌드 검증
pnpm type-check           # 3/3 PASS
pnpm build:specs          # specs PASS
```

---

## 4. 파일 변경 목록

| 파일                                                | 변경 종류       | 내용                                               |
| --------------------------------------------------- | --------------- | -------------------------------------------------- |
| `packages/specs/src/primitives/fieldSizes.ts`       | **신설**        | `FIELD_FAMILY_SIZES` 상수 정의                     |
| `packages/specs/src/primitives/tabSizes.ts`         | **신설**        | `TABS_SIZE_CONFIG` 상수 정의                       |
| `packages/specs/src/primitives/index.ts`            | 추가 (2줄)      | `FIELD_FAMILY_SIZES`, `TABS_SIZE_CONFIG` re-export |
| `packages/specs/src/components/ComboBox.spec.ts`    | 주석 교체 (1줄) | S1: @sync → FIELD_FAMILY_SIZES 설명                |
| `packages/specs/src/components/NumberField.spec.ts` | 주석 교체 (5줄) | S2/S3/S4/S5/S6: @sync → 설명 주석                  |
| `packages/specs/src/components/SelectIcon.spec.ts`  | 주석 교체 (1줄) | S7: @sync → FIELD_FAMILY_SIZES 설명                |
| `packages/specs/src/components/Tab.spec.ts`         | 주석 교체 (1줄) | S8: @sync → TABS_SIZE_CONFIG 설명                  |
| `packages/specs/src/components/Tabs.spec.ts`        | 주석 교체 (1줄) | S9: @sync → TABS_SIZE_CONFIG + 105-c 위임 명시     |
| `packages/specs/src/components/TextField.spec.ts`   | 주석 교체 (1줄) | S10: @sync → xs 독립 진화 설명                     |

---

## 5. 자연 해소 후보 확인

S9 Tabs.spec.ts:140의 `+ Tabs.css` 부분은 F2(spec-to-CSS) 카테고리. Tabs.css는 `packages/shared/src/components/styles/generated/Tabs.css` — CSSGenerator 자동 생성 파일이므로 F2 처리 대상. 105-c 착수 시 재검토.

---

## 6. 신설 primitives 설계 결정 사항

| 항목                      | 결정                                    | 근거                                                                              |
| ------------------------- | --------------------------------------- | --------------------------------------------------------------------------------- |
| `fieldSizes.ts` 범위      | height + paddingX + paddingY + iconSize | 3파일이 공유하는 4개 필드만. fontSize/borderRadius는 각 파일 독립 (TokenRef 사용) |
| `tabSizes.ts` 범위        | height + paddingX + paddingY            | Tab/Tabs가 공유하는 3개 필드만. fontSize는 TokenRef, fontWeight는 Tab 전용        |
| `FIELD_FAMILY_SIZES` 타입 | `Record<string, {...}>`                 | 사이즈 키 확장성 보장 (buttonSizes.ts 패턴 동일)                                  |
| `TABS_SIZE_CONFIG` 이름   | Config suffix                           | ADR-105-a BUTTON_FAMILY_HEIGHTS와 구별. Tab-specific임을 명시                     |
| TextField xs 처리         | 주석 기록 + 값 유지                     | xs:18은 독립 진화 사실. 값 수정 시 CSS/Skia BC 위험 존재                          |

---

## 7. 예상 소요

- P0 사전 검증: 완료 (착수 전 실측)
- P1 fieldSizes.ts 신설: ~15분
- P2 tabSizes.ts 신설: ~10분
- P3 @sync 주석 교체 (10건): ~20분 (9파일)
- P4 검증: ~10분
- **합계: ~55분 (1세션 내 완결 목표)**
