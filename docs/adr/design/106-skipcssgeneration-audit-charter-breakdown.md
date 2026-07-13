# ADR-106 skipCSSGeneration 감사 Charter — 구현 상세 Breakdown

> **연결 ADR**: [106-skipcssgeneration-audit-charter.md](../completed/106-skipcssgeneration-audit-charter.md)
> **스냅샷 기준**: 2026-04-21

---

## 1. 27건 전체 분류 매트릭스

| #   | spec 이름         | 부모 spec (childSpecs)                                          | 수동 CSS 파일                         | spec 토큰 파생                             | 분류     | 후속 슬롯 | 비고                                                                                                                                                                                                   |
| --- | ----------------- | --------------------------------------------------------------- | ------------------------------------- | ------------------------------------------ | -------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | CalendarGrid      | Calendar/DatePicker/RangeCalendar/DateRangePicker (propagation) | 없음                                  | N/A                                        | **G2**   | —         | ADR-083 calendar archetype. `skipCSSGeneration:true` 는 implicitStyles/Skia 전용 (`// ADR-083 Phase 4: skipCSSGeneration:true 이므로 CSS 경로 영향 없음`). CSS 파일 없음 — 해체 불필요                 |
| 2   | CalendarHeader    | 동일 (propagation)                                              | 없음                                  | N/A                                        | **G2**   | —         | 동일. CSS 파일 없음                                                                                                                                                                                    |
| 3   | CardContent       | Card.spec (childSpecs)                                          | 없음                                  | N/A                                        | **G1**   | —         | ADR-092/104 정당화 완료. `CardSpec.childSpecs: [CardHeaderSpec, CardContentSpec, CardFooterSpec]`                                                                                                      |
| 4   | CardFooter        | Card.spec (childSpecs)                                          | 없음                                  | N/A                                        | **G1**   | —         | 동일                                                                                                                                                                                                   |
| 5   | CardHeader        | Card.spec (childSpecs)                                          | 없음                                  | N/A                                        | **G1**   | —         | 동일. `skipCSSGeneration: true` 확인 (CardHeader.spec 파일 내 `true` 선언)                                                                                                                             |
| 6   | CheckboxItems     | CheckboxGroup.spec (childSpecs)                                 | 없음                                  | N/A                                        | **G1**   | —         | ADR-103 정당화 완료. RAC 공식 미존재 composition 고유 D3 layout 중간 컨테이너                                                                                                                          |
| 7   | ColorArea         | 없음 (독립 컴포넌트)                                            | `ColorArea.css` (3 var lines)         | YES (minimal — border-radius, border 토큰) | **G2**   | —         | minimal CSS. spec 토큰 파생 확인. `@layer components` 구조 준수                                                                                                                                        |
| 8   | ColorPicker       | 없음 (독립 컴포넌트)                                            | `ColorPicker.css` (38 var lines)      | **PARTIAL**                                | **G3**   | **106-a** | `--cp-font-size`, `--cp-gap`, `--cp-btn-width/height`, `--cp-dialog-*` 등 독립 CSS 변수 다수. spec sizes 에 해당 값 없음 → spec SSOT 미연결                                                            |
| 9   | ColorSlider       | 없음 (독립 컴포넌트)                                            | `ColorSlider.css` (3 var lines)       | **NO**                                     | **G3**   | **106-a** | 크기/위치 하드코딩 (`height: 24px`, `width: 28px` 등) spec 미선언                                                                                                                                      |
| 10  | ColorSwatchPicker | 없음 (독립 컴포넌트)                                            | `ColorSwatchPicker.css` (2 var lines) | **PARTIAL**                                | **G3**   | **106-a** | `gap: 4px` 하드코딩. spec 토큰 파생 여부 미확인 값 존재                                                                                                                                                |
| 11  | ColorWheel        | 없음 (독립 컴포넌트)                                            | `ColorWheel.css` (2 var lines)        | **NO**                                     | **G3**   | **106-a** | `width/height: 192px` 하드코딩. spec sizes 에 미선언                                                                                                                                                   |
| 12  | DateInput         | TimeField/DateField/DatePicker (propagation)                    | 없음                                  | N/A                                        | **G1**   | —         | DateField/TimeField 내부 입력 영역. spec shapes 경로 전용. CSS 파일 없음                                                                                                                               |
| 13  | DateSegment       | TimeField/DateField (propagation)                               | 없음                                  | N/A                                        | **G1**   | —         | DateInput 내부 세그먼트. CSS 파일 없음                                                                                                                                                                 |
| 14  | Field             | 없음 (독립 컴포넌트)                                            | `Field.css` (5 var lines)             | **PARTIAL**                                | **G4**   | **106-d** | `Field.css` 내용: FieldGroup/DataField 구조 CSS. spec scope 범위 명확화 필요. ADR-059 Field spec delegation 선언 존재 (`composition: { layout: "flex-column" ... }`)                                   |
| 15  | GridList          | 없음 (독립 컴포넌트)                                            | `GridList.css` (41 var lines)         | YES                                        | **G2**   | —         | `GridList.skipCSSGeneration=true` 주석에 "향후 `skipCSSGeneration` 해체 시 자동 연동" 명시. token var 풍부. spec 토큰 파생 준수                                                                        |
| 16  | GridListItem      | GridList.spec (childSpecs)                                      | 없음                                  | N/A                                        | **G1**   | —         | ADR-090 정당화. `GridList.spec.childSpecs: [GridListItemSpec, HeaderSpec]`                                                                                                                             |
| 17  | Group             | 없음 (독립 컴포넌트)                                            | `Group.css` (8 var lines)             | YES                                        | **G2**   | —         | RAC Group minimal CSS. token var 사용 (`--border`, `--fg-disabled`). spec containerStyles 선언 존재                                                                                                    |
| 18  | Header            | ListBox/GridList.spec (childSpecs)                              | 없음                                  | N/A                                        | **G1**   | —         | ADR-099 Phase 3 정당화. `// skipCSSGeneration: true — 독립 CSS 파일 미생성. 부모 ListBox/GridList/Menu Spec 의 childSpecs 경로로 inline emit.`                                                         |
| 19  | Label             | 없음 (독립 컴포넌트)                                            | `Label.css` (7 var lines)             | **PARTIAL**                                | **G3**   | **106-c** | `Label.css` 주석: `skipCSSGeneration: true — base.css의 --label-font-size 변수 상속을 위해 수동 관리`. `--label-font-size` 변수 상속이 spec SSOT 에 미연결 (ADR-086 LABEL_SIZE_STYLE 패턴 재사용 가능) |
| 20  | ListBoxItem       | ListBox.spec (childSpecs)                                       | 없음                                  | N/A                                        | **G1**   | —         | ADR-078 정당화. `ListBoxSpec.childSpecs: [ListBoxItemSpec, HeaderSpec]`. Generator 자식 selector emit 확장으로 inline emit 동작                                                                        |
| 21  | RadioItems        | RadioGroup.spec (childSpecs)                                    | 없음                                  | N/A                                        | **G1**   | —         | ADR-103 정당화 완료. `RadioGroupSpec.childSpecs: [RadioItemsSpec]`                                                                                                                                     |
| 22  | SearchField       | 없음 (독립 컴포넌트)                                            | 없음                                  | N/A                                        | **제외** | —         | **실측: `skipCSSGeneration: false`** (2026-04-21). 이 목록에서 제외 — 실제 대상 26건                                                                                                                   |
| 23  | Table             | 없음 (독립 컴포넌트)                                            | `Table.css` (147 var lines)           | YES                                        | **G2**   | —         | RAC Table 복잡 구조. token var 매우 풍부. spec 토큰 파생 준수                                                                                                                                          |
| 24  | Tag               | TagGroup 내 RAC collection item                                 | 없음 (독립 CSS 없음)                  | N/A                                        | **G4**   | **106-d** | `@sync TagGroup.css` 2건 (ADR-105 F2 연동). Tag spec shapes 색상과 TagGroup.css `.react-aria-Tag` 수동 동기화 주석. ADR-105 F2 체인 완결 후 재평가                                                     |
| 25  | TagGroup          | 없음 (독립 컴포넌트)                                            | `TagGroup.css` (106 var lines)        | YES                                        | **G2**   | 106-b     | ADR-093 TagGroup SSOT. token var 풍부. 단 `@sync Button.css/ButtonSpec.sizes` 4건 잔존 (ADR-105 F4 카테고리). `@sync` 주석 제거로 해소 또는 ADR-105-d 와 공동 처리                                     |
| 26  | TagList           | TagGroup.spec (childSpecs)                                      | 없음                                  | N/A                                        | **G1**   | —         | ADR-093 정당화. `TagGroupSpec.childSpecs: [TagListSpec]`. `// ADR-093: 독립 CSS 파일 emit 중단. 부모 TagGroupSpec.childSpecs 경로로 부모 generated CSS 에만 inline emit.`                              |
| 27  | Tree              | 없음 (독립 컴포넌트)                                            | `Tree.css` (83 var lines)             | YES                                        | **G2**   | —         | RAC Tree 복잡 구조. token var 풍부. spec 토큰 파생 준수                                                                                                                                                |

> **SearchField 주의**: `rg` 실측 결과 `skipCSSGeneration: false` 확인 (ADR-059 이후 해체 완료). 이 목록에 포함된 것은 `rg -l 'skipCSSGeneration: true'` 가 **주석** 행 (`// skipCSSGeneration: true 유지`) 을 matching 했을 가능성. sub-ADR 착수 전 재확인 필수. 실제 대상은 **26건**일 수 있음.

---

## 2. 분류 카운트 요약

| 분류                                 |  건수  | 설명                                                                                                             |
| ------------------------------------ | :----: | ---------------------------------------------------------------------------------------------------------------- |
| G1. childSpecs inline emit (정당)    | **10** | Card 3 + CheckboxItems + RadioItems + ListBoxItem + GridListItem + Header + TagList + DateInput/DateSegment 합산 |
| G2. RAC primitive 수동 재정의 (정당) | **9**  | CalendarGrid/Header + Table + Tree + GridList + Group + ColorArea + TagGroup(+106-b) + DateSegment 제외          |
| G3. 수동 CSS 독립 정의 (debt)        | **5**  | ColorPicker + ColorSlider + ColorSwatchPicker + ColorWheel + Label                                               |
| G4. 추가 조사 필요                   | **2**  | Tag + Field                                                                                                      |
| 제외 (skipCSSGeneration: false)      |   1    | SearchField — 실측 확인                                                                                          |
| **합계 (skipCSSGeneration: true)**   | **26** | SearchField 제외 시                                                                                              |

---

## 3. G1 정당화 근거 상세 — childSpecs inline emit 메커니즘

ADR-094 `expandChildSpecs` 인프라 (`packages/specs/src/runtime/tagToElement.ts:234`) 는 부모 spec 의 `childSpecs` 배열을 순회하여 자식 spec 을 `TAG_SPEC_MAP` 에 자동 등록한다. 이 때 자식 spec 의 `skipCSSGeneration: true` 는 "독립 CSS 파일을 emit 하지 않는다" 는 의미이며, 부모 spec 의 Generator emit 시 `childSpecs` 경로로 inline emit 된다 (ADR-071 Generator `containerStyles` 인프라 확장).

G1 케이스 판정 기준:

1. 해당 spec 이 부모 spec 의 `childSpecs: [...]` 배열에 포함되는가?
2. 부모 spec 의 Generator emit 시 자식 spec CSS 가 inline emit 되는가? (`generated/{ParentName}.css` 에 포함)
3. 독립 CSS 파일 (수동 CSS) 이 없는가?

3가지 조건 모두 충족 시 G1 정당.

---

## 4. G2 정당화 근거 상세 — RAC primitive 수동 재정의

ADR-059 §Tier 3 허용 패턴: **수동 CSS 가 spec 토큰에서 파생된 경우** D3 위반 아님. `var(--token-name)` CSS 변수를 사용하고 하드코딩 수치가 없거나 최소인 경우 G2 정당.

판정 기준:

1. 수동 CSS 파일의 token var 라인 수 vs 하드코딩 값 비율 → token var 가 주류이면 G2
2. `@layer components { ... }` 구조 준수 여부
3. `@sync` 주석 없거나 ADR-105 에서 처리 중인 경우

**CalendarGrid/CalendarHeader 특별 케이스**: CSS 파일 자체가 없고, `skipCSSGeneration: true` 가 "implicitStyles/Skia consumer 전용" 으로 명시된 케이스. D3 위반 없음.

---

## 5. G3 해체 방법론 — 후속 sub-ADR 작업 가이드

### 106-a: Color family 4건 해체 (ColorPicker/Slider/SwatchPicker/Wheel)

**목표**: `--cp-*` 독립 CSS 변수를 spec.sizes 에 선언하고, CSSGenerator 가 emit 하도록 전환.

**절차**:

1. **CSSGenerator 지원 여부 확인**: Color spec 의 `containerStyles` / `sizes` 가 CSSGenerator `emitContainerStyles` + `generateSizeStyles` 경로를 이미 지원하는지 확인
2. **spec.sizes 값 이관**: `ColorPicker.sizes.{sm,md,lg}.btnWidth/btnHeight/gap/dialogPadding` 등 신규 SizeSpec 필드 추가
3. **spec.containerStyles 값 이관**: `--cp-*` → spec containerStyles TokenRef 전환
4. **수동 CSS 해체**: `ColorPicker.css` 독립 값 제거 → CSSGenerator emit 대체
5. **skipCSSGeneration: true → false 전환**
6. **/cross-check**: Preview DOM/CSS ↔ Skia 렌더 결과 동일성 검증

**위험**: SizeSpec 필드 신규 추가 필요 → ADR-088/089 패턴 재사용. CSSGenerator `generateSizeStyles` 확장 필요 가능성.

### 106-c: Label CSS SSOT 복귀

**목표**: `--label-font-size` 변수 상속 → spec SSOT 연결.

**절차**:

1. `Label.css` 주석 원인 파악: `base.css의 --label-font-size 변수 상속을 위해 수동 관리` — 이 변수가 어디서 오는지 추적
2. ADR-086 `LABEL_SIZE_STYLE` 패턴 확인: LabelSpec.sizes 에 이미 fontSize/lineHeight 선언 여부
3. CSSGenerator 가 `LabelSpec.sizes` 기반 `font-size` emit 이 가능한지 확인
4. 가능 시: `LabelSpec.skipCSSGeneration: true → false` + `Label.css` 독립 선언 해체

---

## 6. G4 추가 조사 가이드

### Tag spec 조사 포인트

```bash
# Tag spec @sync 주석 위치
grep -n '@sync' packages/specs/src/components/Tag.spec.ts
# → 57, 65행: @sync TagGroup.css .react-aria-Tag 기본/selected 색상

# TagGroup.css 해당 selector
grep -n '\.react-aria-Tag' packages/shared/src/components/styles/TagGroup.css
```

판정: Tag spec shapes 색상(`{color.layer-1}` 등)이 TagGroup.css `.react-aria-Tag` 값과 일치하는가?

- 일치 + spec 토큰 파생 → G2 정당 + `@sync` 주석 제거 (ADR-105 F2 체인 협력)
- 불일치 → G3 debt — Tag spec shapes 가 TagGroup.css 를 구동해야 함

### Field spec 조사 포인트

```bash
# Field.css 내용 확인
cat packages/shared/src/components/styles/Field.css
# Field spec delegation 선언
grep -n 'composition\|delegation' packages/specs/src/components/Field.spec.ts
```

판정: `Field.css` 의 FieldGroup/DataField CSS 가 `FieldSpec.composition` 에서 파생될 수 있는가?

- 파생 가능 → G2 정당화 문서 작성 + spec delegation 완성
- 파생 불가 → G3 debt — spec SSOT 신설 필요

---

## 7. Step F/G 위임 케이스 명시

ADR-103 (CheckboxItems/RadioItems 정당화 — Step F) 및 ADR-104 (Card 계열 정당화 — Step G) 는 이미 **Implemented** 상태이므로 해당 케이스 (G1 분류 확정) 는 본 Charter scope 에서 추가 작업 없음:

| spec          | 완료 ADR             | 분류    |
| ------------- | -------------------- | ------- |
| CheckboxItems | ADR-103 (098-e 슬롯) | G1 확정 |
| RadioItems    | ADR-103 (098-e 슬롯) | G1 확정 |
| CardHeader    | ADR-104 (098-f 슬롯) | G1 확정 |
| CardContent   | ADR-104 (098-f 슬롯) | G1 확정 |
| CardFooter    | ADR-104 (098-f 슬롯) | G1 확정 |

---

## 8. ADR-105 @sync 체인 연계 매핑

G3/G4 케이스 중 `@sync` 주석이 동반된 케이스는 ADR-105 카테고리와 중복 scope 가 발생할 수 있다:

| ADR-106 케이스       | @sync 위치             | ADR-105 카테고리           | 조율 방법                                               |
| -------------------- | ---------------------- | -------------------------- | ------------------------------------------------------- |
| Tag (G4)             | `Tag.spec.ts:57,65`    | F2 (spec-to-CSS)           | ADR-105 105-c 완결 후 ADR-106 G4 재평가                 |
| TagGroup (G2, 106-b) | `TagGroup.css:148,150` | F4 (CSS-to-spec/generator) | ADR-105 105-d 완결 후 ADR-106 106-b 병행 또는 통합 처리 |

우선권 원칙: **`@sync` 주석 해소는 ADR-105 에 우선권**. ADR-106 sub-ADR 은 ADR-105 해당 슬롯 완결 후 `skipCSSGeneration` 전환 여부만 판정.

---

## 9. 검증 체크리스트 (후속 sub-ADR 공통)

각 sub-ADR 완결 시:

- [ ] `skipCSSGeneration: true → false` 전환 spec 에 대해 `pnpm build:specs` PASS
- [ ] `rg 'skipCSSGeneration: true' packages/specs/src/components/{TargetSpec}.spec.ts` = 0건
- [ ] `packages/shared/src/components/styles/generated/` 에 해당 CSS emit 확인
- [ ] `/cross-check` 또는 `parallel-verify` 로 Preview DOM/CSS ↔ Skia 시각 결과 동일성 확인
- [ ] type-check 3/3 + specs PASS + builder PASS
- [ ] 삭제된 수동 CSS 파일에 의존하는 `@import` 제거 여부 확인 (`packages/shared/src/components/styles/index.css`)
