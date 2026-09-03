# ADR-923 Phase 5 후속 — field 의 description 축 (착수 10)

> 2026-09-04. 사용자 판단: **지원 유지 + parent-owned read-only sub-part 화**. "parent description 은 이미 공개 D2 편집 속성이고 DOM 은 실제로 렌더한다. 반면 Canvas 가시 자식 집합에는 Description 이 없어 현재 비대칭이다."

## 1. 코드 사실 (착수 전 실측)

| 사실                                                                                                      | 경로                                                                       |
| --------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `description` 은 binding 이 공개한 D2 편집 속성 (`kind:"string"`, section content)                        | `packages/shared/src/catalog/bindings/TextField.binding.ts:38`             |
| DOM 은 parent prop 으로 한 줄을 그린다 — `{description && <Text slot="description">{description}</Text>}` | `packages/shared/src/components/TextField.tsx:115` 외 **13 컴포넌트 동형** |
| rendererMap 은 `element.props.description` 을 그대로 넘긴다                                               | `packages/shared/src/renderers/FormRenderers.tsx:169·252·326·413`          |
| 시각은 parent rule 의 `[slot="description"]` delegation 이 정한다 (**12 parent**)                         | catalog `structure.composition.delegation`                                 |
| factory 는 field 에 Description 자식을 만들지 않는다 (Description 자식은 Toast 것뿐)                      | `apps/builder/src/builder/factories/definitions/FormComponents.ts:212`     |
| layout 가시 자식 집합에 Description 이 없다                                                               | `…/layout/engines/implicitStyles.ts` `FIELD_VISIBLE_CHILD_TAGS`            |

즉 **같은 canonical 문서가 DOM 에서만 한 줄 더 높다** — D3 비대칭.

## 2. 측정 — 착수 전 (browser gate 첫 실행)

`apps/builder/tests/parity/adr923FieldDescriptionAxis.browser.test.ts` (신규 4 케이스, 실 번들 CSS + Preview 전역 reset).

| type        | DOM root (desc 없음 → 있음) | DOM desc 상자 | Canvas root | Canvas desc |
| ----------- | --------------------------- | ------------- | ----------- | ----------- |
| TextField   | 56 → **83**                 | 400×21 @y62   | 56 → **56** | **없음**    |
| TextArea    | 96 → **123**                | 400×21 @y102  | 96 → **96** | **없음**    |
| NumberField | 56 → **83**                 | 400×21 @y62   | 56 → **56** | **없음**    |
| DateField   | 56 → **86**                 | 400×24 @y62   | 56 → **56** | **없음**    |
| TimeField   | 56 → **86**                 | 400×24 @y62   | 56 → **56** | **없음**    |

## 3. 그 과정에서 드러난 것 — description 글자 크기가 **상속값으로 떨어져 있었다**

위 표의 DOM 글자 크기는 TextField 14 · **DateField/TimeField 16** 이었다. 카탈로그가 정한 hint 크기 (md = TextField 14 · DateField 12) 와 다르다. 원인:

```css
/* 종전 생성 CSS */
.react-aria-DateField[data-size="md"] .react-aria-FieldError {
  --df-hint-size: var(--text-xs);
}
.react-aria-DateField [slot="description"] {
  font-size: var(--df-hint-size);
} /* ← 미해소 */
```

size 변수를 **선언한 자식이 FieldError 뿐**이라, 그 변수를 읽는 `[slot="description"]` 에서는 `var()` 가 해소되지 않는다 → declaration 이 무효 → font-size 가 **상속값**으로 떨어진다 (base.css 의 `[slot="description"] { font-size: var(--text-xs) }` 도 특이도에서 진다). 12 parent 전부 같은 형태였다.

**수리**: `CSSGenerator` 의 delegation `variables` 를 **parent scope** 로 emit 한다 (`${sel}[data-size="md"] { --df-hint-size: … }`). 가시성만 넓히는 변경이고 (자식은 상속으로 그대로 읽는다), rule 안에서 **다른 childSelector 가 같은 변수명을 선언하는 경우는 0** 이다 (전수 확인 — 변수명이 entry 별 `prefix` 로 갈린다). bridge (generic 이름 재노출) 는 그대로 자식 scope 에 남는다. 생성물 diff 12 파일, 전부 이 selector 이동뿐.

수리 후 DOM: TextField/TextArea md **14** (21px 줄) · NumberField/DateField/TimeField md **12** (18px 줄) — FieldError 와 같은 값·같은 원천.

## 4. Canvas — 합성 노드 (문서 migration 없음)

canonical 에 자식이 없고 parent `description` 이 텍스트 SSOT 이므로, layout 이 `${parentId}__syndesc` 합성 노드를 만든다 (Checkbox/Radio/Switch 의 synthetic Label 선례 — `registerSyntheticElement` → `StoreRenderBridge`/`skiaFramePipeline` 이 이미 렌더한다). **옛 문서도 그대로 같아진다.**

- 조건: parent rule 이 `[slot="description"]` delegation 을 갖고 (`hasDelegatedChild`) `props.description` 이 비어 있지 않을 때만.
- 글자 크기: `resolveDelegatedChildFontSize(parent, DESCRIPTION_CHILD_SELECTOR, size)` — DOM 과 **같은 항목**.
- 줄 높이: `resolveInheritedLineHeight(fs)` (root 상속 1.5) — 활성 bundle 에 `[slot="description"]` 줄 높이 규칙이 없다 (FieldError 와 같은 실측 근거).
- 위치: DOM 순서대로 컨트롤 뒤 · FieldError 앞.

resolver 확장 1건: entry 자신에 `variables` 가 없고 bridge 가 **다른 entry 가 선언한** 변수를 읽는 경우 (description 이 FieldError 의 hint 변수를 읽는 형태) 같은 rule (및 DOM root alias — TextArea) 안에서 선언 entry 를 찾아간다. 생성 CSS 가 parent scope 로 emit 하는 것과 같은 해소 규칙이다.

소유권: `DELEGATED_SUBPART_CHILD_TOKENS` 에 `Description: ['[slot="description"]']` 추가 — 이 토큰을 delegation 에 가진 parent 는 field 12 종뿐이라 Card · collection item 의 Description (delegation 없음) 은 영향 0.

## 5. 결과 — 다섯 field 가 상자·위치·높이까지 일치

| type        | DOM root / desc / y | Canvas root / desc / y |
| ----------- | ------------------- | ---------------------- |
| TextField   | 83 / 21 / 62        | 83 / 21 / 62           |
| TextArea    | 123 / 21 / 102      | 123 / 21 / 102         |
| NumberField | 80 / 18 / 62        | 80 / 18 / 62           |
| DateField   | 80 / 18 / 62        | 80 / 18 / 62           |
| TimeField   | 80 / 18 / 62        | 80 / 18 / 62           |

## 6. 원복 RED

| 원복                                          | 결과                                                                              |
| --------------------------------------------- | --------------------------------------------------------------------------------- |
| (a) 합성 노드 생성 제거                       | `TextField Canvas description 상자: expected null not to be null`                 |
| (b) delegation 변수를 다시 자식 scope 로 emit | `NumberField description Δh (canvas 18 vs dom 21)` — DOM 이 상속값으로 되돌아간다 |

대조군도 게이트에 있다: `description` 이 없으면 Canvas 도 줄을 만들지 않고 root 높이가 DOM 과 같다.

## 7. Live

빌더 Home 페이지 TextField 에 `description: "Helper text"` — Canvas rect **342×56 → 342×83**, 합성 노드 342×21 @y62 (게이트 수치와 동일). 캔버스 확대: 입력 상자 아래에 muted "Helper text" 가 그려진다. 이후 prop 제거로 원복.

## 8. 검증

- 신규 게이트 4 PASS · browser parity **1094** PASS (기존 2 실패: `catalogComponentBox` GridListItem · Tooltip)
- specs 880 · shared 972 · builder unit 5223 PASS (기존 실패 4건은 본 변경과 무관 — `canvasStore.static` · `styleReadCanonical.static` · 두 grep gate)
- `pnpm type-check` PASS

## 9. 잔여 (기록)

- description 을 그리는 나머지 8 컴포넌트 (CheckboxGroup · RadioGroup · ColorField · SearchField · Select · ComboBox · DatePicker · DateRangePicker · TagGroup · DropZone) 도 같은 합성 경로를 타지만 (조건이 delegation 보유 + prop 존재라 type 목록이 아니다) 게이트는 field 5 만 잰다 — 나머지는 팔레트 트리 구성이 달라 별도 케이스.
