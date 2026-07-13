# ADR-105 Breakdown: @sync 주석 감사 Charter 전체 매트릭스

> **ADR**: [105-sync-annotation-audit-charter.md](../completed/105-sync-annotation-audit-charter.md)
> **스냅샷 날짜**: 2026-04-21
> **총 건수**: 37건

---

## 1. 전체 매트릭스 (파일:라인 / 주석 원문 / 참조 대상 / 카테고리 / 후속 sub-ADR 할당)

### F1. spec-to-spec 참조 (10건)

Spec 파일이 다른 Spec 파일의 값과 수동으로 맞춰야 한다는 경고 마커.

| #   | 파일                  | 라인 | 주석 원문                                                                           | 참조 대상                            | sub-ADR       |
| --- | --------------------- | ---- | ----------------------------------------------------------------------------------- | ------------------------------------ | ------------- |
| 1   | `ComboBox.spec.ts`    | 259  | `@sync Select.spec.ts sizes — CSS height = lineHeight + paddingY×2 + borderWidth×2` | `Select.spec.ts` sizes               | 105-b         |
| 2   | `NumberField.spec.ts` | 7    | `@sync ComboBox.spec.ts — 동일한 컨테이너/버튼 패턴`                                | `ComboBox.spec.ts` 전체 구조         | 105-b         |
| 3   | `NumberField.spec.ts` | 389  | `@sync ComboBox.spec.ts sizes — 동일한 height/padding/iconSize`                     | `ComboBox.spec.ts` sizes             | 105-b         |
| 4   | `NumberField.spec.ts` | 439  | `@sync ComboBox.spec.ts composition — 동일한 컨테이너/버튼 패턴`                    | `ComboBox.spec.ts` composition       | 105-b         |
| 5   | `NumberField.spec.ts` | 928  | `@sync ComboBox chevron: 배경 없이 아이콘만`                                        | ComboBox 아이콘 패턴                 | 105-b         |
| 6   | `NumberField.spec.ts` | 941  | `@sync ComboBox chevron: 배경 없이 아이콘만`                                        | ComboBox 아이콘 패턴                 | 105-b         |
| 7   | `SelectIcon.spec.ts`  | 44   | `@sync Select.spec.ts sizes.iconSize — Select/ComboBox 동일 아이콘 크기`            | `Select.spec.ts` sizes.iconSize      | 105-b         |
| 8   | `Tab.spec.ts`         | 63   | `TabsSpec.sizes와 동기화 (@sync Tabs.spec.ts)`                                      | `Tabs.spec.ts` sizes                 | 105-b         |
| 9   | `Tabs.spec.ts`        | 140  | `@sync Button.spec.ts padding/fontSize 패턴 + Tabs.css`                             | `Button.spec.ts` + `Tabs.css` (혼합) | 105-b / 105-c |
| 10  | `TextField.spec.ts`   | 256  | `@sync Button.spec.ts sizes — Input height = Button height`                         | `Button.spec.ts` sizes               | 105-b         |

**이관 방법론**:

- **Option A — primitives 추출**: `packages/specs/src/primitives/` 에 `buttonSizes.ts` (또는 `fieldSizes.ts`) 공유 상수를 정의하고, `Select.spec.ts` / `ComboBox.spec.ts` / `NumberField.spec.ts` / `Button.spec.ts` 가 동일 상수를 import.
- **Option B — parent spec 참조**: NumberField가 ComboBox 패턴을 완전히 공유한다면, `ComboBox.spec.ts` 의 sizes 객체를 export 하고 NumberField 가 import 해 재사용. (Spec 파일 간 직접 import는 허용 — consumer-to-consumer는 CSS↔CSS 금지이며 spec-to-spec import 는 중립)
- **Option C — 중복 선언 유지 + @sync 삭제**: 값이 실질적으로 독립적으로 진화할 경우 주석만 제거하고 설명 주석으로 교체.

**Tabs.spec.ts:140 특이사항**: `@sync Button.spec.ts padding/fontSize 패턴 + Tabs.css` 는 F1 + F2 혼합. Tabs.css가 Spec에서 파생되면 F2 자동 해소 → 105-b에서 Button.spec 참조만 처리.

---

### F2. spec-to-CSS 참조 (6건)

Spec 파일이 수동 CSS 파일의 값과 수동으로 맞춰야 한다는 경고.

| #   | 파일                   | 라인 | 주석 원문                                                                                         | 참조 대상                    | sub-ADR |
| --- | ---------------------- | ---- | ------------------------------------------------------------------------------------------------- | ---------------------------- | ------- |
| 11  | `GridListItem.spec.ts` | 107  | `@sync GridList.css .react-aria-GridListItem padding/gap/border-radius (fontSize=14 경로 동기화)` | `GridList.css` item 스타일   | 105-c   |
| 12  | `ListBox.spec.ts`      | 218  | `@sync containerStyles.background = {color.raised}`                                               | containerStyles와의 정합     | 105-c   |
| 13  | `ListBox.spec.ts`      | 238  | `@sync CSS container padding = --spacing-xs = 4 (containerStyles.padding 과 일치)`                | CSS container padding        | 105-c   |
| 14  | `ListBoxItem.spec.ts`  | 132  | `@sync sz.lineHeight = {typography.text-sm--line-height} — fontSize 기반 resolve`                 | typography token 참조        | 105-c   |
| 15  | `SelectValue.spec.ts`  | 47   | `@sync Select.css font-size per size`                                                             | `Select.css` font-size       | 105-c   |
| 16  | `Tag.spec.ts`          | 57   | `@sync TagGroup.css .react-aria-Tag 기본 색상`                                                    | `TagGroup.css` 기본 색상     | 105-c   |
| 17  | `Tag.spec.ts`          | 65   | `@sync TagGroup.css .react-aria-Tag[data-selected]`                                               | `TagGroup.css` selected 색상 | 105-c   |

**이관 방법론**:

- **Generator 확장 우선**: 해당 값이 Spec SSOT에서 자동 파생될 수 있다면 CSSGenerator 확장으로 수동 CSS 제거 → @sync 자동 해소.
- **Generator 미지원 확인**: `Tag.spec.ts` color 참조 (`@sync TagGroup.css`) 는 Generator `[data-selected]` 색상 emit 지원 여부 확인 필요. 지원 시 TagGroup.css 해당 블록 삭제 + @sync 삭제.
- **수동 CSS 정당화**: Generator 확장이 과도한 경우 (1-2건을 위한 대규모 변경), `skipCSSGeneration: true` 정당화 + `@sync` 주석 → 설명 주석으로 교체 (D3 위반 아님 — ADR-059 §Tier 3 허용 패턴).

**ListBox.spec.ts:218,238 특이사항**: ListBox containerStyles.background / padding 이 이미 spec SSOT에 선언되어 있다면 (ADR-076/079 이후), `@sync` 주석은 이미 해소된 상태. 재grep 확인 후 단순 주석 삭제로 처리 가능.

---

### F3. spec-to-utils 상수 참조 (4건)

Spec 파일이 builder의 utils.ts 런타임 상수와 수동으로 맞춰야 한다는 경고.

| #   | 파일                    | 라인 | 주석 원문                                                                     | 참조 대상                       | sub-ADR   |
| --- | ----------------------- | ---- | ----------------------------------------------------------------------------- | ------------------------------- | --------- |
| 18  | `Input.spec.ts`         | 82   | `@sync BUTTON_SIZE_CONFIG (utils.ts) — Input height = Button height`          | `BUTTON_SIZE_CONFIG` (utils.ts) | **105-a** |
| 19  | `Select.spec.ts`        | 296  | `@sync BUTTON_SIZE_CONFIG (utils.ts) — Select trigger height = Button height` | `BUTTON_SIZE_CONFIG` (utils.ts) | **105-a** |
| 20  | `SelectTrigger.spec.ts` | 94   | `@sync BUTTON_SIZE_CONFIG (utils.ts) — SelectTrigger height = Button height`  | `BUTTON_SIZE_CONFIG` (utils.ts) | **105-a** |
| 21  | `DatePicker.spec.ts`    | 49   | `@sync DateInput.spec.ts — DateRangePicker.spec.ts에서도 import`              | `DateInput.spec.ts` 상수        | **105-a** |

**이관 방법론** (ADR-091 Class C 패턴 적용):

```
현재: utils.ts의 BUTTON_SIZE_CONFIG 가 Button 높이 정의
      → Select.spec.ts / Input.spec.ts / SelectTrigger.spec.ts 가 @sync 경고
목표: BUTTON_SIZE_CONFIG 를 packages/specs/src/primitives/ 로 이관
      → 3개 spec 파일이 동일 primitives 상수 import → @sync 삭제
```

- `BUTTON_SIZE_CONFIG` 의 현재 위치: `apps/builder/src/builder/workspace/canvas/layout/engines/utils.ts`
- 이관 대상: `packages/specs/src/primitives/buttonSizes.ts` (신설) 또는 기존 `primitives/sizes.ts`
- utils.ts 는 이관 후 primitives에서 re-import (BC 0%)
- `DatePicker.spec.ts:49` 는 `DateInput.spec.ts` 의 `INPUT_HEIGHT` 상수 참조 — 동일 패턴으로 primitives 이관 또는 DateInput.spec 에서 export 정리

**BC 영향**: element.tag 변경 없음 → BC 0%.

---

### F4. CSS-to-spec/generator 참조 (4건)

CSS 파일이 Spec 또는 Generator 출력과 수동으로 맞춰야 한다는 경고.

| #   | 파일           | 라인 | 주석 원문                                                                                     | 참조 대상                        | sub-ADR |
| --- | -------------- | ---- | --------------------------------------------------------------------------------------------- | -------------------------------- | ------- |
| 22  | `TagGroup.css` | 148  | `@sync Button.css size variants — padding/fontSize/lineHeight 동일`                           | `Button.css` size variants       | 105-d   |
| 23  | `TagGroup.css` | 150  | `@sync ButtonSpec.sizes — padding 동일`                                                       | `ButtonSpec.sizes`               | 105-d   |
| 24  | `Badge.css`    | 407  | `@sync BadgeSpec.sizes — Button과 동일한 height/padding/fontSize, border-radius: radius-full` | `BadgeSpec.sizes`                | 105-d   |
| 25  | `ListBox.css`  | 99   | `@sync Generator [data-disabled] emit opacity:0.38 + cursor:not-allowed`                      | Generator `[data-disabled]` emit | 105-d   |

**이관 방법론**:

- `TagGroup.css:148,150`: Button.css / ButtonSpec.sizes 동기화 → Tag spec이 Button primitives를 공유하면 CSS도 Spec에서 파생 가능. F3 (105-a) 완결 후 primitives 공유로 자연 해소 여부 확인.
- `Badge.css:407`: BadgeSpec.sizes 이미 Spec SSOT에 있음 → CSSGenerator가 Badge.css 해당 블록을 자동 emit하면 수동 CSS 삭제 + @sync 삭제.
- `ListBox.css:99`: Generator `[data-disabled]` emit과 동일 값이면 CSS 블록 중복 → Generator emit을 신뢰하고 수동 CSS 블록 삭제 + @sync 삭제. 불일치 시 Spec에 StateEffect.disabled 추가.

---

### F5. builder-to-spec/CSS 참조 (9건 + 재평가 1건)

builder 코드가 Spec 파일 또는 CSS 파일의 값과 수동으로 맞춰야 한다는 경고.

| #   | 파일                     | 라인 | 주석 원문                                                                    | 참조 대상                        | sub-ADR        |
| --- | ------------------------ | ---- | ---------------------------------------------------------------------------- | -------------------------------- | -------------- |
| 26  | `DateColorComponents.ts` | 123  | `@sync DatePicker 동일 구조`                                                 | DatePicker factory 구조          | 105-d (재평가) |
| 27  | `FormComponents.ts`      | 416  | `@sync ComboBox CSS DOM 구조`                                                | ComboBox CSS / DOM 구조          | 105-d (재평가) |
| 28  | `implicitStyles.ts`      | 183  | `@sync Select.css / ComboBox.css size variants`                              | Select/ComboBox CSS 크기         | 105-d          |
| 29  | `utils.ts`               | 1520 | `@sync ListBoxSpec.sizes.md — paddingY=4(container padding only), gap=2`     | `ListBoxSpec.sizes.md`           | 105-d          |
| 30  | `utils.ts`               | 1521 | `@sync containerStyles.borderWidth=1`                                        | ListBox containerStyles          | 105-d          |
| 31  | `utils.ts`               | 1529 | `@sync ListBoxSpec.render.shapes entries 루프 — 공식 변경 시 양쪽 동시 갱신` | `ListBoxSpec.render.shapes`      | 105-d          |
| 32  | `utils.ts`               | 1568 | `@sync TagList.spec.ts shapes() 의 wrap 시뮬레이션 — 변경 시 양쪽 동시 갱신` | `TagList.spec.ts` shapes         | 105-d          |
| 33  | `utils.ts`               | 1815 | `@sync Select.spec.ts / ComboBox.spec.ts sizes`                              | Select/ComboBox sizes            | 105-d          |
| 34  | `utils.ts`               | 1986 | `DateInput: intrinsic height (@sync DateInput.spec.ts INPUT_HEIGHT)`         | `DateInput.spec.ts` INPUT_HEIGHT | **105-a**      |
| 35  | `cssComponentPresets.ts` | 708  | `@sync ToggleButton.css [data-size] padding 값과 일치해야 함`                | `ToggleButton.css` padding       | 105-d          |

**재평가 항목** (26, 27):

- `DateColorComponents.ts:123` 와 `FormComponents.ts:416` 은 factory 구조 서술 주석으로 D2 경계에 해당할 수 있음. 내용 검토 후 정당화 주석으로 교체 가능.

**이관 방법론**:

- `utils.ts:1520,1521,1529` (ListBoxSpec 참조): utils.ts 가 `getSpec("ListBox")` 로 Spec 직접 read-through 하도록 전환 (ADR-079/080 패턴). `@sync` 주석 삭제.
- `utils.ts:1568` (TagList.spec 참조): TagList wrap 시뮬레이션 로직을 Spec read-through 로 전환.
- `utils.ts:1815` (Select/ComboBox sizes): F3 (105-a) 에서 primitives 이관 완결 후 utils.ts 가 primitives 에서 read → @sync 삭제.
- `utils.ts:1986` (DateInput INPUT_HEIGHT): F3 105-a 슬롯에 포함 — 동일 primitives 이관 패턴.
- `implicitStyles.ts:183` (Select.css/ComboBox.css): CSS 값이 Spec에서 파생되면 implicitStyles 도 Spec read-through 전환.
- `cssComponentPresets.ts:708` (ToggleButton.css): CSS 값이 Spec에서 파생되면 presets 도 Spec read-through 전환.

---

## 2. Step F/G 위임 @sync 식별

ADR-103 (Step F — CheckboxItems/RadioItems) 및 ADR-104 (Step G — Card 계열) 진행 중. 아래 항목은 해당 ADR 완결 후 재평가:

| #   | 파일                         | 라인                          | Step        | 이유                              |
| --- | ---------------------------- | ----------------------------- | ----------- | --------------------------------- |
| 26  | `DateColorComponents.ts:123` | `@sync DatePicker 동일 구조`  | F (factory) | factory 구조 변경 가능성          |
| 27  | `FormComponents.ts:416`      | `@sync ComboBox CSS DOM 구조` | F (factory) | ComboBox factory 구조 변경 가능성 |

나머지 35건은 Step F/G와 독립적으로 처리 가능.

---

## 3. 카테고리별 이관 방법론 상세

### F3 우선 착수 이유 (105-a)

F3는 다른 카테고리의 전제 조건이 된다:

- `BUTTON_SIZE_CONFIG` 가 primitives 로 이관되면 → F1의 Button.spec.ts 동기화 @sync 자동 해소 후보
- `BUTTON_SIZE_CONFIG` 가 primitives 로 이관되면 → F5의 `utils.ts:1815` (Select/ComboBox sizes) @sync 해소 후보
- `DateInput.spec.ts INPUT_HEIGHT` 가 primitives 이관되면 → F5의 `utils.ts:1986` @sync 해소

F3 (4건) + F5 연계 (3건) = 최소 7건이 105-a 한 번으로 해소 가능.

### Generator 지원 여부 선행 확인 체크리스트 (F2)

105-c 착수 전 반드시 확인:

- [ ] `Tag.spec.ts` 색상 TokenRef가 `StateEffect` 에 선언되어 있는가? → Generator `[data-selected]` emit 가능 여부
- [ ] `GridListItem.spec.ts:107` padding/gap/borderRadius 가 Spec sizes 에 있는가? → 이미 ADR-090 에서 완결 (GridListItem.spec 신설)
- [ ] `SelectValue.spec.ts:47` font-size 가 Select.spec sizes 에서 파생 가능한가? → CSSGenerator SelectValue child selector emit 필요 여부
- [ ] `ListBox.spec.ts:218,238` containerStyles 값이 이미 Spec SSOT에 선언되어 있는가? → 단순 주석 삭제 가능 여부

### Spec read-through 전환 패턴 (F5)

```typescript
// 이전 (utils.ts)
// @sync ListBoxSpec.sizes.md — paddingY=4, gap=2
const LISTBOX_PADDING_Y = 4;
const LISTBOX_GAP = 2;

// 이후 (utils.ts)
import { getSpec } from "../../specs/tagSpecLookup";
const listboxSpec = getSpec("ListBox");
const LISTBOX_PADDING_Y = resolveToken(listboxSpec?.sizes?.md?.paddingY) ?? 4;
const LISTBOX_GAP = resolveToken(listboxSpec?.sizes?.md?.gap) ?? 2;
// @sync 주석 삭제
```

---

## 4. 자연 해소 후보 확인 체크리스트

아래 항목은 이전 ADR에서 이미 해소됐을 가능성이 높음. 105-c/d 착수 전 재grep 확인:

| #   | 파일:라인             | 이전 ADR                                           | 확인 방법                                        |
| --- | --------------------- | -------------------------------------------------- | ------------------------------------------------ |
| 12  | `ListBox.spec.ts:218` | ADR-076/079 (ListBox containerStyles SSOT)         | `rg "color.raised" ListBox.spec.ts` 값 일치 확인 |
| 13  | `ListBox.spec.ts:238` | ADR-076/080 (containerStyles padding read-through) | `rg "spacing.xs" ListBox.spec.ts`                |
| 29  | `utils.ts:1520`       | ADR-076 (ListBoxSpec.sizes.md)                     | utils.ts 해당 라인 실제 하드코딩 여부            |
| 30  | `utils.ts:1521`       | ADR-079 (containerStyles.borderWidth)              | utils.ts 해당 라인 실제 하드코딩 여부            |

---

## 5. 후속 sub-ADR 발행 순서 (권장)

```
105-a (F3 + F5 연계): BUTTON_SIZE_CONFIG / DateInput.INPUT_HEIGHT primitives 이관
  → 완결 후 ↓
105-b (F1): spec-to-spec primitives 공유 (NumberField/ComboBox 5건 등)
  → 병렬 가능 ↓
105-c (F2): spec-to-CSS Generator 확장 또는 정당화 (GridListItem/Tag/SelectValue 등)
  → 105-a/b 완결 후 ↓
105-d (F4 + F5 잔존): CSS-to-spec 해소 + builder read-through 전환 (TagGroup.css/Badge.css/utils.ts 잔존)
```

예상 세션 수: 105-a (1세션), 105-b/c (각 1~2세션), 105-d (1~2세션) = 총 4~7 세션.
