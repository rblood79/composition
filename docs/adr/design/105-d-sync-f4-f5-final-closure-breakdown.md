# ADR-105-d Breakdown: @sync F4/F5 최종 종결 — 구현 상세

> ADR: [105-d-sync-f4-f5-final-closure.md](../completed/105-d-sync-f4-f5-final-closure.md)

## 개요

9건 @sync 주석을 정당화 주석으로 교체. 런타임 코드 변경 없음. 주석 교체만.

## Phase 구분

| Phase | 내용                                | 건수 |
| ----- | ----------------------------------- | :--: |
| 0     | 재grep + 자연 해소 확증             | 9건  |
| 1     | F4 CSS 2건 — 정당화 주석 교체       | 2건  |
| 2     | F5 factory 2건 — D2 경계 정당화     | 2건  |
| 3     | F5 utils/implicitStyles/presets 5건 | 5건  |
| 4     | @sync 잔존 0건 도달 확증            |  -   |

---

## Phase 0: 재grep + 자연 해소 확증

실제 작업 전 9건 모두 현황 재확인:

```bash
# F4 CSS 파일
rg "@sync" packages/shared/src/components/styles/Badge.css
rg "@sync" packages/shared/src/components/styles/ListBox.css

# F5 Builder 파일
rg "@sync" apps/builder/src/builder/workspace/canvas/layout/engines/utils.ts
rg "@sync" apps/builder/src/builder/workspace/canvas/layout/engines/implicitStyles.ts
rg "@sync" apps/builder/src/builder/workspace/canvas/utils/cssComponentPresets.ts
rg "@sync" apps/builder/src/builder/factories/definitions/FormComponents.ts
rg "@sync" apps/builder/src/builder/factories/definitions/DateColorComponents.ts

# 예상 결과: 위 7개 파일에서만 총 9건 (다른 파일 0건)
# 이미 해소된 항목: TagGroup.css (ADR-106-b), Tag.spec.ts (ADR-106-b), ListBoxItem.spec.ts (ADR-105-c)
```

---

## Phase 1: F4 CSS 2건

### F4-1: Badge.css:407

**현재 @sync 원문**:

```css
/* @sync BadgeSpec.sizes — Button과 동일한 height/padding/fontSize, border-radius: radius-full */
```

**처리 Option**: 정당화 주석 교체

**변경 내용**:

```css
/* (ADR-105-d — formerly @sync F4-1 annotation)
 * BadgeSpec.sizes 에서 height/padding/fontSize/border-radius 를 정의하며,
 * 아래 CSS 값은 Spec 에서 자동 생성된 것이 아닌 수동 선언이다.
 * Spec 변경 시 이 블록도 동시 갱신 필요. */
```

**변경 대상**: `packages/shared/src/components/styles/Badge.css:407`

**검증**:

```bash
rg "@sync" packages/shared/src/components/styles/Badge.css  # → 0건
pnpm type-check  # PASS
```

**시각 회귀 기준**: 변경 없음 (주석만 교체)

---

### F4-2: ListBox.css:99

**현재 @sync 원문**:

```css
/* @sync Generator `[data-disabled]` emit opacity:0.38 + cursor:not-allowed.
 * 수동은 text color 38% 추가 — opacity 와 곱해져 약 14% 전송. 디자인 의도. */
```

**처리 Option**: 정당화 주석 교체

**배경**: Generator가 현재 `[data-disabled]` state selector emit을 지원하지 않아 수동 CSS가 유지되고 있음. 이는 의도적 결정이며 `@sync` 경고 마커가 아닌 구조적 한계 설명이 적합.

**변경 내용**:

```css
/* (ADR-105-d — formerly @sync F4-2 annotation)
 * Generator 가 [data-disabled] state selector emit 을 미지원하여 수동 CSS 유지.
 * opacity:0.38 (Generator emit 예정) 와 text color 38% (수동) 가 곱해져 ~14% 투명도.
 * Generator 에 state selector 지원 추가 시 이 수동 CSS 를 제거하고 Spec 로 이관. */
```

**변경 대상**: `packages/shared/src/components/styles/ListBox.css:99-101`

**검증**:

```bash
rg "@sync" packages/shared/src/components/styles/ListBox.css  # → 0건
pnpm type-check  # PASS
```

**시각 회귀 기준**: 변경 없음 (주석만 교체)

---

## Phase 2: F5 Factory 2건 (D2 경계 정당화)

### F5-1: DateColorComponents.ts:123

**현재 @sync 원문**:

```typescript
/**
 * DateRangePicker 복합 컴포넌트 정의 (@sync DatePicker 동일 구조)
 *
 *   DateRangePicker (parent, flex column, gap:8px, width:284px)
 *     ├─ Label         (tag="Label")
 *     ...
 */
```

**처리 Option**: D2 경계 정당화 — `@sync` 키워드 제거 + 구조 서술 유지

**배경**: 이 주석은 CSS/Spec 시각 값 동기화 경고가 아니라 "DateRangePicker DOM 구조가 DatePicker와 동일한 패턴"이라는 D2(Props/API) factory 구조 서술이다. D2 허용 범위.

**변경 내용**:

```typescript
/**
 * DateRangePicker 복합 컴포넌트 정의 (DatePicker 와 동일한 DOM 구조 패턴)
 *
 *   DateRangePicker (parent, flex column, gap:8px, width:284px)
 *     ├─ Label         (tag="Label")
 *     ...
 */
```

**변경 대상**: `apps/builder/src/builder/factories/definitions/DateColorComponents.ts:123`

**검증**:

```bash
rg "@sync" apps/builder/src/builder/factories/definitions/DateColorComponents.ts  # → 0건
pnpm type-check  # PASS
```

**시각 회귀 기준**: 변경 없음 (주석만 교체)

---

### F5-2: FormComponents.ts:416

**현재 @sync 원문**:

```typescript
/**
 * NumberField 복합 컴포넌트 정의
 *
 * CSS DOM 구조 (@sync ComboBox):
 * NumberField (parent, tag="NumberField", display flex column)
 *   ├─ Label (tag="Label", children="Number")
 *   ...
 */
```

**처리 Option**: D2 경계 정당화 — `@sync` 키워드 제거 + 구조 서술 유지

**배경**: "CSS DOM 구조 (@sync ComboBox)"는 "NumberField의 DOM 구조가 ComboBox와 동일한 패턴을 따른다"는 D2 구조 주석이다. CSS 값 동기화 경고가 아님.

**변경 내용**:

```typescript
/**
 * NumberField 복합 컴포넌트 정의
 *
 * DOM 구조 (ComboBox 와 동일한 패턴):
 * NumberField (parent, tag="NumberField", display flex column)
 *   ├─ Label (tag="Label", children="Number")
 *   ...
 */
```

**변경 대상**: `apps/builder/src/builder/factories/definitions/FormComponents.ts:416`

**검증**:

```bash
rg "@sync" apps/builder/src/builder/factories/definitions/FormComponents.ts  # → 0건
pnpm type-check  # PASS
```

**시각 회귀 기준**: 변경 없음 (주석만 교체)

---

## Phase 3: F5 Utils/ImplicitStyles/Presets 5건

### F5-3: cssComponentPresets.ts:708

**현재 @sync 원문**:

```typescript
// @sync ToggleButton.css [data-size] padding 값과 일치해야 함
// Button.css와 동일한 padding/borderRadius 사용
S: { fontSize: 14, paddingY: 4, paddingX: 12, borderRadius: 4 }, // --radius-sm
```

**처리 Option**: 정당화 주석 교체

**배경**: `TOGGLE_BUTTON_FALLBACKS`는 Canvas 레이아웃 fallback 값. ToggleButtonSpec.sizes 선언 존재하지만, fallback 테이블을 Spec read-through로 전환하려면 cssComponentPresets.ts → specs 패키지 의존성 추가 필요 (번들 영향). 현행 유지가 정당.

**변경 내용**:

```typescript
// (ADR-105-d — formerly @sync F5-3 annotation)
// ToggleButtonSpec.sizes 에서 동일 값 정의됨 (Button.css padding/borderRadius 동일 패턴).
// Canvas fallback 용 하드코딩 유지 — specs 패키지 import 비용 대비 현재 복제가 정당.
// ToggleButton.css 또는 ToggleButtonSpec.sizes 변경 시 이 테이블도 동시 갱신 필요.
S: { fontSize: 14, paddingY: 4, paddingX: 12, borderRadius: 4 }, // --radius-sm
```

**변경 대상**: `apps/builder/src/builder/workspace/canvas/utils/cssComponentPresets.ts:708`

**검증**:

```bash
rg "@sync" apps/builder/src/builder/workspace/canvas/utils/cssComponentPresets.ts  # → 0건
pnpm type-check  # PASS
```

---

### F5-4: implicitStyles.ts:183

**현재 @sync 원문**:

```typescript
/**
 * ComboBox/Select/SelectTrigger/ComboBoxWrapper 공통 spec padding
 * @sync Select.css / ComboBox.css size variants
 * CSS padding: top right bottom left — right = top (paddingY), left = paddingLeft
 */
const SPEC_PADDING: Record<string, { left: number; right: number; y: number }> = {
  xs: { left: 4, right: 1, y: 1 },
  ...
};
```

**처리 Option**: 정당화 주석 교체

**배경**: `SPEC_PADDING`은 Canvas implicit styles 계산용 로컬 테이블. Select/ComboBoxSpec.sizes 에서 동일 값이 선언되어 있으나, implicitStyles.ts → specs 패키지 import는 레이아웃 엔진 레이어 분리 원칙에 위배될 수 있음. 현행 유지 + 동기화 경고 명시가 정당.

**변경 내용**:

```typescript
/**
 * ComboBox/Select/SelectTrigger/ComboBoxWrapper 공통 spec padding
 * (ADR-105-d — formerly @sync F5-4 annotation)
 * Select.css / ComboBox.css size variants 와 동일 값. SelectSpec.sizes / ComboBoxSpec.sizes 에서
 * SSOT 정의됨. Canvas implicit styles 계산용 로컬 복제 — specs 패키지 import 비용 대비 유지 정당.
 * Spec.sizes padding 변경 시 이 테이블도 동시 갱신 필요.
 * CSS padding: top right bottom left — right = top (paddingY), left = paddingLeft
 */
```

**변경 대상**: `apps/builder/src/builder/workspace/canvas/layout/engines/implicitStyles.ts:183`

**검증**:

```bash
rg "@sync" apps/builder/src/builder/workspace/canvas/layout/engines/implicitStyles.ts  # → 0건
pnpm type-check  # PASS
```

---

### F5-5: utils.ts:1520 (자연 해소 확증)

**현재 @sync 원문**:

```typescript
// @sync ListBoxSpec.sizes.md — paddingY=4(container padding only), gap=2
const paddingY = parseNumericValue(style?.paddingTop ?? style?.padding) ?? 4;
const gap = parseNumericValue(style?.gap) ?? 2;
```

**처리 Option**: 자연 해소 확증 + 설명 주석 교체

**배경**: 코드가 이미 `style?.paddingTop ?? style?.padding` (런타임 style prop 읽기)를 통해 Spec에서 파생된 값을 소비하고 있음. fallback `?? 4`, `?? 2`만 하드코딩으로 잔존하는데, 이는 style이 undefined일 때의 기본값. `@sync` 경고 자체가 이미 의미를 잃었음.

**변경 내용**:

```typescript
// ADR-078 Phase 3: style prop 에서 Spec 파생 paddingY/gap 을 런타임 소비.
// fallback(4, 2)은 style 미설정 시 기본값 — ListBoxSpec.sizes.md 와 동일값.
// (ADR-105-d — F5-5 자연 해소 확증: style prop 소비로 Spec 의존 drift 없음)
const paddingY = parseNumericValue(style?.paddingTop ?? style?.padding) ?? 4;
const gap = parseNumericValue(style?.gap) ?? 2;
```

**변경 대상**: `apps/builder/src/builder/workspace/canvas/layout/engines/utils.ts:1520`

**검증**:

```bash
# utils.ts 1520 라인 주변 확인
sed -n '1518,1525p' apps/builder/src/builder/workspace/canvas/layout/engines/utils.ts
pnpm type-check  # PASS
```

---

### F5-6: utils.ts:1521

**현재 @sync 원문**:

```typescript
// @sync containerStyles.borderWidth=1
const borderWidth = 1;
```

**처리 Option**: 정당화 주석 교체 (read-through 전환 보류)

**배경**: `ListBoxSpec.containerStyles.borderWidth = 1`이 Spec에서 선언됨. 그러나 단일 상수 1건을 위한 specs 패키지 import 추가는 번들 및 의존성 비용 대비 효익이 낮음. 더 넓은 Canvas-Spec read-through는 별도 ADR 범위.

**변경 내용**:

```typescript
// (ADR-105-d — formerly @sync F5-6 annotation)
// ListBoxSpec.containerStyles.borderWidth = 1 과 동일값.
// Canvas 레이아웃 계산용 로컬 상수 유지 — read-through 전환은 Layout Canvas Spec Consumer ADR 에서 처리.
const borderWidth = 1;
```

**변경 대상**: `apps/builder/src/builder/workspace/canvas/layout/engines/utils.ts:1521`

**검증**:

```bash
sed -n '1519,1530p' apps/builder/src/builder/workspace/canvas/layout/engines/utils.ts
pnpm type-check  # PASS
```

---

### F5-7: utils.ts:1529

**현재 @sync 원문**:

```typescript
// @sync ListBoxSpec.render.shapes entries 루프 — 공식 변경 시 양쪽 동시 갱신.
const entries =
  Array.isArray(rawEntries) && rawEntries.length > 0
    ? rawEntries
    : [
        { id: "item-1", label: "Item 1" },
        { id: "item-2", label: "Item 2" },
        ...
      ];
```

**처리 Option**: 정당화 주석 교체 (알고리즘 동기화 경고 유지)

**배경**: 레이아웃 계산 로직이 ListBoxSpec.render.shapes() entries 루프 구조를 미러링함. 알고리즘 수준의 동기화 경고로, Spec shapes 로직 변경 시 Canvas 레이아웃도 함께 변경해야 한다는 경고는 유효함. 경고 기능만 유지하면서 `@sync` 키워드 제거.

**변경 내용**:

```typescript
// (ADR-105-d — formerly @sync F5-7 annotation)
// ADR-099 Phase 2: entries 순회로 totalItems + sectionCount + nonFirstSection 집계.
// 이 공식은 ListBoxSpec.render.shapes() 의 entries 루프 구조를 미러링함.
// ListBoxSpec.render.shapes() 알고리즘 변경 시 이 레이아웃 계산도 동시 갱신 필요.
const entries =
  Array.isArray(rawEntries) && rawEntries.length > 0
    ? rawEntries
    : [
```

**변경 대상**: `apps/builder/src/builder/workspace/canvas/layout/engines/utils.ts:1529`

**검증**:

```bash
sed -n '1527,1540p' apps/builder/src/builder/workspace/canvas/layout/engines/utils.ts
pnpm type-check  # PASS
```

---

### F5-8: utils.ts:1568

**현재 @sync 원문**:

```typescript
// @sync TagList.spec.ts shapes() 의 wrap 시뮬레이션 — 변경 시 양쪽 동시 갱신.
if (tag1 === "taglist") {
  ...
  const tagHeight = fontSize + chipSize.paddingY * 2;
```

**처리 Option**: 정당화 주석 교체 (wrap 시뮬레이션 알고리즘 동기화 경고 유지)

**배경**: Canvas 레이아웃이 TagList.spec.ts shapes()의 wrap 시뮬레이션(availableWidth 기반 행 시뮬레이션)을 복제. Spec shapes 로직 변경 시 Canvas도 함께 변경해야 하는 알고리즘 수준의 동기화 경고. 경고 기능 유지.

**변경 내용**:

```typescript
// (ADR-105-d — formerly @sync F5-8 annotation)
// TagList.spec.ts shapes() 의 wrap 시뮬레이션(availableWidth 기반 행 계산) 을 미러링.
// TAG_CHIP_SIZES 상수는 ADR-105-a 에서 primitives 로 이관 완료.
// TagList.spec.ts shapes() wrap 알고리즘 변경 시 이 레이아웃 계산도 동시 갱신 필요.
if (tag1 === "taglist") {
```

**변경 대상**: `apps/builder/src/builder/workspace/canvas/layout/engines/utils.ts:1568`

**검증**:

```bash
sed -n '1566,1580p' apps/builder/src/builder/workspace/canvas/layout/engines/utils.ts
pnpm type-check  # PASS
```

---

## Phase 4: @sync 잔존 0건 도달 확증

모든 Phase 완료 후 최종 검증:

```bash
# F4/F5 전체 파일 @sync 잔존 확인
rg "@sync" packages/shared/src/components/styles/Badge.css
rg "@sync" packages/shared/src/components/styles/ListBox.css
rg "@sync" apps/builder/src/builder/workspace/canvas/layout/engines/utils.ts
rg "@sync" apps/builder/src/builder/workspace/canvas/layout/engines/implicitStyles.ts
rg "@sync" apps/builder/src/builder/workspace/canvas/utils/cssComponentPresets.ts
rg "@sync" apps/builder/src/builder/factories/definitions/FormComponents.ts
rg "@sync" apps/builder/src/builder/factories/definitions/DateColorComponents.ts
# 예상: 모두 0건

# F 카테고리 전체 @sync 잔존 확인 (specs 포함)
rg "@sync" packages/specs/src --include="*.ts"
rg "@sync" packages/shared/src --include="*.css"
rg "@sync" apps/builder/src --include="*.ts"
# 예상: ListBoxItem.spec.ts:136 의 ADR-105-c 해소 확증 주석만 잔존 (이미 @sync 키워드 아님)

# 최종 type-check
pnpm type-check  # 3/3 PASS

# Spec 빌드 확인
pnpm build:specs  # 205/205 PASS
```

## 회귀 체크 포인트

| 항목                                 | 확인 방법                                   | 기준                      |
| ------------------------------------ | ------------------------------------------- | ------------------------- |
| Badge 시각 변경 없음                 | Builder + Preview Badge 컴포넌트 렌더 확인  | 변경 없음                 |
| ListBox disabled 스타일 유지         | ListBox [data-disabled] item 렌더 확인      | opacity ~14% 유지         |
| ToggleButton Canvas 레이아웃 유지    | ToggleButton S/M/L size Canvas 렌더 확인    | padding/borderRadius 동일 |
| Select/ComboBox implicit styles 유지 | ComboBox xs/sm/md/lg/xl padding Canvas 확인 | 변경 없음                 |
| ListBox Canvas 높이 계산 유지        | ListBox items 개수 변화 시 Canvas 높이 확인 | 변경 없음                 |
| TagList wrap 시뮬레이션 유지         | TagList 많은 items wrap 시 Canvas 높이 확인 | 변경 없음                 |

## 작업 순서 가이드

1. Phase 0 재grep 실행 → 9건 모두 현행 위치 확인
2. Phase 1 F4-1 Badge.css → F4-2 ListBox.css 순서로 주석 교체
3. Phase 2 F5-1 DateColorComponents.ts → F5-2 FormComponents.ts 순서
4. Phase 3 F5-3~F5-8 순서로 처리 (utils.ts 4건은 순서대로: 1520→1521→1529→1568)
5. Phase 4 최종 확증 실행
6. ADR-105-d Status → Implemented 갱신 + docs/adr/README.md 테이블 갱신
