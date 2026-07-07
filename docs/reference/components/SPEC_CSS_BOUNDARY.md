# Spec과 수동 CSS의 경계

**날짜:** 2026-03-18 (초판)
**대상 독자:** composition 컴포넌트 개발에 처음 합류한 개발자

> ⚠️ **STALE (2026-07-08)** — [ADR-142](../../adr/142-starter-spec-component-system-cutover.md)(Implemented 2026-06-02)로 D3 시각 SSOT가 컴포넌트당 spec 파일에서 **catalog(`COMPONENT_RULES_TABLE`) + theme/tokens root collection**으로 전환됨. 본 문서의 "Spec CSS 자동 생성 52개 / 수동 CSS 43개" 분류 테이블은 spec 시대(2026-03) 기준이며 현재 실체와 다르다 — 잔존 spec은 Frame/Group/Slot 3개 한정, 나머지는 catalog binding 경로. [ADR-036](../../adr/completed/036-spec-first-single-source.md)은 Superseded by ADR-142. 레이아웃 엔진도 "Taffy WASM"에서 자체 Rust 엔진(`packages/composition-engine`, [ADR-916](../../adr/completed/916-unified-rust-engine.md))으로 대체됐다. 개념(Spec="What" 토큰 / 수동 CSS="How" 구조)은 catalog 전환 후에도 구조상 유효하나, 파일 경로·컴포넌트 목록은 재검증 필요.

---

## 개요

composition는 동일한 컴포넌트를 두 가지 방식으로 렌더링한다.

- **Preview / Publish (DOM)**: React Aria 컴포넌트 + CSS 스타일링
- **Builder Canvas (Skia)**: `ComponentSpec.render.shapes()`가 생성한 shapes → CanvasKit 렌더링
- **레이아웃 (Taffy WASM)**: Canvas에서의 위치/크기 계산

이 이중 구조에서 "어떤 컴포넌트의 스타일을 Spec에서 자동 생성하고, 어떤 컴포넌트는 수동 CSS로 관리하는가?"라는 경계가 명확하지 않으면 동기화 실패와 불일치 버그가 발생한다.

이 문서는 그 경계를 정의한다.

---

## 원칙

### Spec이 소유하는 것: "What" (시각 토큰)

Spec의 `variants` / `sizes` / `states`는 컴포넌트의 **시각적 정체성** — 색상, 크기, 상태별 효과 — 을 정의한다. 이 정보는 Skia(Canvas)와 CSS(Preview) 양쪽에서 동일한 결과를 낼 수 있도록 단일 소스로 관리되어야 한다.

Spec에서 자동 생성된 CSS는 이 "What"을 DOM 렌더링 경로에 전달한다.

### 수동 CSS가 소유하는 것: "How" (구조 레이아웃)

슬롯 배치, flex/grid 컨테이너 구조, pseudo-element, 깊은 하위 선택자 등 **컴포넌트의 내부 구조**는 CSS가 담당한다. 이 구조 정보는 Skia 경로와 CSS 경로가 서로 다른 방식으로 해결하므로 — Skia는 Taffy WASM이 레이아웃을 계산하고, DOM은 CSS가 계산한다 — **구조는 Preview ↔ Canvas 간 동등성(parity) 문제가 아니다.**

### 구조에 parity 문제가 없는 이유

```
Store (Zustand)
    ├─→ CSS (DOM 경로)   — Preview가 CSS flex/grid로 직접 해석
    └─→ Taffy WASM       — Canvas가 Taffy로 직접 계산
```

Store의 상태(width, height, padding 등)를 CSS와 Taffy가 **독립적으로** 읽어 각자 처리하므로, 구조 레이아웃을 두 경로가 공유할 이유가 없다. 따라서 구조 CSS는 DOM 경로에서만 필요하고, 수동 관리로 충분하다.

### 예외 — Collection/self-render 컨테이너 (ADR-907)

collection 계열 (`Breadcrumbs, ComboBox, GridList, ListBox, Menu, Select, Tabs, TagGroup, Table, Toolbar, Tree`) 은 `element.props.style` 의 **padding/gap/borderWidth/fontSize** 를 Preview DOM / Skia `render.shapes()` / Layout `calculateContentHeight()` **3경로 모두** 에 동일하게 반영해야 한다 (structure 가 아니라 spacing SSOT). 이는 parity 가 아니라 **동일 값 소비**의 문제이므로 4-layer SSOT (Layer A parser / Layer B `resolveContainerSpacing` / Layer C renderer root style 계약 / Layer D spec metric SSOT) 로 통합 관리한다. 상세: [ADR-907](../../adr/completed/907-collection-container-style-pipeline.md) + `.claude/rules/canvas-rendering.md` §2.6.

---

## 분류 기준

### Spec CSS 자동 생성 대상 (Leaf 컴포넌트)

아래 조건을 모두 충족하는 컴포넌트:

- 자체 시각적 표현이 있다 (색상, 크기, 상태 변화)
- Preview ↔ Canvas 간 시각 토큰의 동등성이 필요하다
- Archetype 기반 base styles로 구조가 표현된다
- `Spec.render.shapes()`가 Skia 렌더링과 CSS 생성 양쪽에 사용된다

### 수동 CSS 대상 (`skipCSSGeneration: true`)

아래 조건 중 하나라도 해당하는 컴포넌트:

- 내부 slot 구조 (`.items`, `[slot="..."]`)가 필요하다
- 깊은 하위 선택자 (`.parent .child`)가 구조를 정의한다
- pseudo-element (`::before`, `::after`)로 시각 요소를 만든다
- 투명 컨테이너 — 자신은 보이지 않고 children의 레이아웃만 담당한다
- `Spec.render.shapes()`가 Skia 전용이며, DOM 경로는 수동 CSS가 담당한다

---

## 분류 테이블

### Spec CSS 자동 생성 — 52개 컴포넌트

| Archetype          | 컴포넌트                                                                                                                                                                                   | 목적                                           |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------- |
| `button`           | Button, ToggleButton, Link, FileTrigger, SelectTrigger, SelectBoxItem                                                                                                                      | 클릭 가능한 요소                               |
| `simple`           | Badge, Tag, Avatar, Icon, Separator, Skeleton, Breadcrumbs, ColorSwatch, Description, FieldError, StatusLight, Image, MaskedFrame, DateSegment, SelectValue, SelectIcon, DropZone, Tooltip | 표시 전용                                      |
| `toggle-indicator` | Checkbox, Radio, Switch                                                                                                                                                                    | 토글 입력 (indicator는 수동 CSS)               |
| `input-base`       | Input, TextArea                                                                                                                                                                            | 텍스트 입력                                    |
| `progress`         | ProgressCircle, MeterTrack, MeterValue, ProgressBarTrack, ProgressBarValue                                                                                                                 | 진행 표시 (자식 컴포넌트)                      |
| `calendar`         | Calendar                                                                                                                                                                                   | 달력 (CalendarGrid/Header는 skipCSSGeneration) |
| `collection`       | Menu                                                                                                                                                                                       | 컬렉션 목록                                    |
| `overlay`          | Dialog, Popover, Toast                                                                                                                                                                     | 오버레이                                       |
| `alert`            | InlineAlert, IllustratedMessage                                                                                                                                                            | 알림/메시지                                    |
| 미지정 (`default`) | AvatarGroup, ButtonGroup, CardView, SelectBoxGroup, TableView, List, Nav, ScrollBox, Section, Switcher                                                                                     | 서브/유틸리티                                  |

### 수동 CSS (`skipCSSGeneration: true`) — 43개 컴포넌트

| 유형            | 컴포넌트                                                                | 비고                                                                                                            |
| --------------- | ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| 부모 변수 상속  | Label                                                                   | `--label-font-size` 부모 CSS 변수 상속, generated CSS 간섭                                                      |
| Calendar 자식   | CalendarGrid, CalendarHeader                                            | Compositional 자식 — CalendarCommon.css/Calendar.css(수동)가 담당, generated CSS의 `display:grid`+`border` 방해 |
| 그룹 컨테이너   | CheckboxGroup, RadioGroup, TagGroup, ToggleButtonGroup, DisclosureGroup |                                                                                                                 |
| 합성 입력       | TextField, NumberField, SearchField, DateField, TimeField, ColorField   |                                                                                                                 |
| 합성 선택기     | Select, ComboBox, DatePicker, DateRangePicker, ColorPicker              |                                                                                                                 |
| Color 인터랙션  | ColorArea, ColorSlider, ColorWheel, ColorSwatchPicker                   |                                                                                                                 |
| 구조 컨테이너   | Card, Panel, Form, Disclosure, Group, Slot, Toolbar, Pagination         |                                                                                                                 |
| 진행 표시       | ProgressBar, Meter                                                      |                                                                                                                 |
| 복합 탐색       | Tabs, GridList, Table, Tree                                             |                                                                                                                 |
| 컬렉션 컨테이너 | ListBox                                                                 | Composition 패턴 전환 — 수동 CSS가 ListBoxItem 카드 스타일 담당                                                 |
| 슬라이더        | Slider, SliderTrack, SliderThumb, SliderOutput                          | 수동 `Slider.css`가 전담; SliderTrack이 thumb 시각을 shapes로 렌더링, SliderThumb은 히트 영역 전용              |

---

## 구현 세부사항

### `skipCSSGeneration` 플래그

```typescript
// packages/specs/src/types/spec.types.ts
export interface ComponentSpec<Props = Record<string, unknown>> {
  /**
   * CSS 자동 생성 건너뛰기
   *
   * Container/Composite 컴포넌트는 구조 레이아웃을 수동 CSS가 담당하고,
   * Spec은 Skia 렌더링(render.shapes)용으로만 사용된다.
   * true 시 CSSGenerator가 이 Spec의 CSS 파일을 생성하지 않음.
   */
  skipCSSGeneration?: boolean;
  // ...
}
```

```typescript
// packages/specs/src/renderers/CSSGenerator.ts
export function generateCSS<Props>(spec: ComponentSpec<Props>): string | null {
  if (spec.skipCSSGeneration) return null;
  // ...
}
```

```typescript
// packages/specs/scripts/generate-css.ts
// generateCSS()가 null을 반환하면 파일 생성을 건너뜀
```

### 파일 위치

| 유형                      | 경로                                                    |
| ------------------------- | ------------------------------------------------------- |
| 자동 생성 CSS             | `packages/shared/src/components/styles/generated/*.css` |
| 수동 CSS                  | `packages/shared/src/components/styles/*.css`           |
| CSS import 오케스트레이션 | `packages/shared/src/components/styles/index.css`       |

`index.css`에서 자동 생성 CSS는 `@import "./generated/Component.css"`, 수동 CSS는 `@import "./Component.css"` 형태로 가져온다.

### `@layer components` 래핑 (CRITICAL)

`CSSGenerator.ts`는 generated CSS를 `@layer components { ... }`로 감싸서 출력한다.

```css
/* AUTO-GENERATED from ButtonSpec */
@layer components {
  .react-aria-Button { ... }
}
```

**이유:** 수동 CSS(`Select.css`, `ComboBox.css` 등)는 `@layer components` 안에서 `.react-aria-Select .react-aria-Button` 같은 nested selector로 generated CSS의 스타일을 override한다. generated CSS가 unlayered이면, CSS cascade 규칙에 의해 **unlayered가 항상 layered를 이기므로** specificity와 무관하게 수동 CSS의 override가 실패한다.

같은 `@layer components` 안에 있으면 정상적인 specificity 규칙이 적용된다:

- `.react-aria-Select .react-aria-Button` (0,2,0) > `.react-aria-Button` (0,1,0) ✅

### 수동 CSS에서 generated CSS override 패턴

Container/Composite 컴포넌트의 수동 CSS가 자식의 generated CSS를 override해야 하는 경우:

```css
/* Select.css — 같은 @layer components 안에서 specificity로 override */
.react-aria-Select {
  .react-aria-Button {
    padding: var(--select-btn-padding); /* generated Button padding override */
  }
}

/* ComboBox.css — chevron Button은 padding/border 불필요 */
.react-aria-ComboBox {
  .react-aria-Button {
    padding: 0;
    border-width: 0;
  }
}
```

### 빌드 명령

```bash
pnpm build:specs     # Spec에서 generated/ CSS 자동 생성
pnpm validate:sync   # Spec ↔ Generated CSS 동기화 검증 (0 errors 필수)
```

---

## Archetype 기준 base styles

`CSSGenerator.ts`의 `ARCHETYPE_BASE_STYLES` 상수가 각 archetype의 기본 CSS 구조를 정의한다.

| Archetype          | Base Styles 요약                                                                                               |
| ------------------ | -------------------------------------------------------------------------------------------------------------- |
| `simple`           | `inline-flex`, `align-items: center`, `box-sizing: border-box`                                                 |
| `button`           | `inline-flex`, `center`, `cursor: pointer`, `user-select: none`, `transition`, `font-family`                   |
| `input-base`       | `flex`, `align-items: center`, `box-sizing: border-box`, `font-family`                                         |
| `toggle-indicator` | `inline-flex`, `align-items: center`, `cursor: pointer`, `user-select: none`                                   |
| `progress`         | `grid`, `grid-template-areas: "label value" "track track"` — Label/Value/Track 영역 정의                       |
| `slider`           | `grid`, `box-sizing: border-box`                                                                               |
| `tabs-indicator`   | `flex`, `position: relative`                                                                                   |
| `collection`       | `flex`, `flex-direction: column`                                                                               |
| `overlay`          | `position: fixed`                                                                                              |
| `calendar`         | `grid`, `box-sizing: border-box`                                                                               |
| `alert`            | `flex`, `flex-direction: column`, `align-items: flex-start`, `width: 100%`, `font-family`                      |
| 미지정 (`DEFAULT`) | `button`과 동일 — `inline-flex`, `center`, `cursor: pointer`, `user-select: none`, `transition`, `font-family` |

---

## toggle-indicator의 특수한 경계

Checkbox, Radio, Switch의 `toggle-indicator` archetype은 경계가 미묘하다.

### Spec이 정의하는 것

`VariantSpec`/`SizeSpec`의 `border`와 `borderRadius`는 **라벨 영역**을 기술한다. Spec에서 자동 생성되는 CSS는 라벨의 색상, 크기, 상태별 효과를 포함한다.

### 수동 CSS가 정의하는 것

indicator 자체의 시각적 속성 — 체크박스의 테두리/모서리, 라디오 버튼의 원형 테두리, 스위치 thumb의 위치 — 은 수동 CSS의 `::before` pseudo-element로 렌더링된다.

관련 상수들이 별도로 관리된다:

- `RADIO_RING_BORDER`, `RADIO_SELECTED_COLORS`, `RADIO_DIMENSIONS`
- `CHECKBOX_BOX_BORDER`, `CHECKBOX_CHECKED_COLORS`, `CHECKBOX_BOX_SIZES`

따라서 자동 생성 CSS에는 라벨에 대한 `border`/`border-radius`가 `none`으로 설정된다. indicator의 border는 `::before` pseudo-element CSS에서 별도 관리한다.

---

## 새 컴포넌트 추가 시 결정 흐름

```
새 컴포넌트를 추가할 때
    │
    ├─ 자체 시각적 표현이 있는가?
    │   └─ 아니오: 투명 컨테이너 → skipCSSGeneration: true + 수동 CSS
    │
    ├─ 내부에 slot이나 깊은 하위 선택자가 필요한가?
    │   └─ 예: skipCSSGeneration: true + 수동 CSS
    │
    ├─ ::before/::after로 시각 요소를 만드는가?
    │   └─ 예 (단순 장식 제외): skipCSSGeneration: true + 수동 CSS
    │
    └─ 위 모두 아님 → Spec CSS 자동 생성
           └─ archetype 지정 필수
              (simple / button / input-base / toggle-indicator /
               progress / slider / tabs-indicator / collection /
               overlay / calendar / alert)
```

---

## 관련 문서

- [ADR-036: Spec-First Single Source](../../adr/completed/036-spec-first-single-source.md) — CSS 자동 생성 아키텍처 결정 배경
- [CSS_ARCHITECTURE.md](./CSS_ARCHITECTURE.md) — ITCSS 레이어 구조
- `packages/specs/src/types/spec.types.ts` — `ComponentSpec` 인터페이스 (`skipCSSGeneration`, `archetype`)
- `packages/specs/src/renderers/CSSGenerator.ts` — CSS 생성기 구현
- `packages/specs/scripts/generate-css.ts` — 빌드 스크립트
- `packages/shared/src/components/styles/index.css` — CSS import 오케스트레이션
- `packages/shared/src/components/styles/generated/` — 자동 생성 CSS 출력 디렉토리
