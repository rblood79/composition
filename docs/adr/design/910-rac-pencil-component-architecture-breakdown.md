# ADR-910 Breakdown: RAC core + Pencil format 1차 원리 컴포넌트 아키텍처

> 본 문서는 [ADR-910](../910-rac-pencil-component-architecture.md) 의 구현 상세 — 설계 산출물 ①~⑩.
> ADR 본문(Risk-First)에는 결정·대안·위험만 두고, 설계 본문 전체는 이 breakdown 에 분리한다(adr-writing.md 스캐폴딩 규칙).
>
> **1차 원리**: Adobe React Aria Components(RAC) core 방법론(data/render 분리 + 접근성 hooks) + Pencil app/format 방법론(canonical document = 노드 + 보편 속성 + reusable/ref/descendants/slot)에서 컴포넌트 시스템을 백지 재유도한다.
>
> **정본 원칙**:
>
> 1. **컴포넌트 = 노드 데이터 (base/override 2층)** — 노드는 의미값(content/variant/size, `props`)과 사용자 시각 override(fontSize/fill/padding/gap/cornerRadius, `props.style`)를 들고 있다. 시각 base(컴포넌트 default)는 노드가 아니라 theme rule 에서 resolve 한다. `props.style` 은 "제거 대상 중첩 래퍼" 가 아니라 "사용자가 base 를 덮어쓴 키만 담는 override layer" — 키 존재=override, 키 부재=base 따름. base/override 는 노드 간(origin ↔ ref.descendants)으로 분리한다(한 노드 안에 섞지 않음, ADR-907 Layer B 보존). 모든 노드가 같은 보편 속성 키 공간 공유, 컴포넌트별 typed 필드 0 — 값만 다름(CSS 처럼).
> 2. **단일 공급원** — Properties Panel·Style Panel·DOM·Skia·Publish 가 같은 노드 하나를 공급원으로 삼는다. 편집 진입점은 `resolveEditContract(node)` 하나, 패널은 `section` 태그로 필터링한 두 view.
> 3. **generic 렌더** — traversal 1개 + backend 2개(DOM/Skia). base(theme rule) ⊕ override(`props.style`) 병합 시각값을 `toReactStyle(node)`/`toSkiaStyle(node)` 단일 어댑터로 투영.
> 4. **단일 등록** — leaf=PrimitiveBinding(~35), 조합=reusable 노드 문서, 등록=단일 `componentCatalog`.
>
> **ADR-142 와의 관계**: 본 설계는 ADR-142(Accepted 2026-05-30) 와 같은 1차 원리에서 출발하므로 end-state 가 수렴한다. 실행은 ADR-142 cutover 경로와 합류한다.
>
> **상태**: 설계 문서 (코드 변경 아님).

---

## 목차

- [① 전체 아키텍처 개요 + ② Format Schema (base/override 2층 SSOT 구조)](#영역-1)
- [③ RAC → Internal Format 변환 레이어](#영역-3)
- [④ Skia Rendering Layer (Virtualization + Culling + Text)](#영역-4)
- [⑤ Style & Properties Panel 연동](#영역-5)
- [⑥ Publishing / Preview 데이터 흐름](#영역-6)
- [⑦ 대표 컴포넌트 Format 예시](#영역-7)
- [⑧ TypeScript 타입 정의](#영역-8)
- [⑨ 장단점 및 트레이드오프 + ⑩ 구현 우선순위 / Roadmap](#영역-9-10)
- ⑪ ADR-920 흡수 경계 (흡수 vs bridge 위임)

---

<a id="영역-1"></a>

# ① 전체 아키텍처 개요

composition 의 컴포넌트 시스템은 **노드 데이터(의미 props + 시각 override) + theme rule** 위에 선다. 노드는 의미값(`props`)과 사용자 시각 override(`props.style`)를 들고 있고, 시각 base 는 theme rule 에서 resolve 된다. 모든 소비처(Properties Panel·Style Panel·DOM·Skia·Publish)가 그 노드 하나 + 같은 theme rule 을 읽는다(`resolveEditContract` 가 의미·시각 계약을 합집합 view 로 노출). 컴포넌트별 정의 객체는 존재하지 않는다 — 코드 정의는 leaf RAC primitive 약 35개의 `PrimitiveBinding` 뿐이고, 조합 컴포넌트는 `reusable: true` 노드 문서(데이터)다.

## 4 축 구성

```
┌──────────────────────────────────────────────────────────────┐
│  D2 binding / propsSchema     componentCatalog (단일 등록)       │
│  D3 theme (ComponentRule)         │                            │
│       │                           ▼                            │
│  ┌────┴───────── CanonicalNode (평면) ──────────┐              │
│  │  id / type / name                            │              │
│  │  content / variant / size / fillStyle  (의미)  │              │
│  │  fontSize / fill / padding / gap / x / y …(시각)│            │
│  │  reusable / children / slot / ref / descendants│            │
│  └──────────────────────────────────────────────┘              │
│       │                                                        │
│  resolveEditContract(node)        generic traversal (1개)       │
│       │                              │                         │
│   ┌───┴────┐                  ┌──────┴───────┐                 │
│   │Props   │ Style            │ toReactStyle  │ toSkiaStyle    │
│   │Panel   │ Panel            │   → DOM        │   → Skia        │
│   │(section 태그 필터 2 view) │   → Publish    │                 │
│   └────────┘                  └───────────────┘                 │
│                          RAC: toRacProps(node) (ARIA/키보드 투영) │
└──────────────────────────────────────────────────────────────┘
```

## 단일 componentCatalog — 6 레지스트리 대체

컴포넌트 등록은 `packages/shared/src/catalog/componentCatalog.ts` 의 `componentCatalog: readonly ComponentCatalogEntry[]` 단일 배열 하나다. 과거 분리돼 있던 6개 레지스트리(Component Panel / Factory / rendererMap / getDefaultProps / BASE_TAG_SPEC_MAP / builder TAG_SPEC_MAP)는 entry 하나로 수렴한다.

| entry kind  | 정의                                                                                                 | 시각                  | 등록 항목                       |
| ----------- | ---------------------------------------------------------------------------------------------------- | --------------------- | ------------------------------- |
| `primitive` | leaf RAC/internal primitive — `binding: PrimitiveBinding`                                            | theme `ComponentRule` | Button / TextField / ListBox 등 |
| `reusable`  | 조합 컴포넌트 — `reusableId` → canonical reusable 문서                                               | theme + 문서 tree     | composite (코드 정의 없음)      |
| `native`    | composition-native(frame/Slot/MaskedFrame) — RAC binding·reusable 문서 모두 없는 canonical 일급 노드 | theme                 | frame 등 (metadata-only)        |

접근 진입점은 `getCatalogEntry(type)` / `getCatalogCutoverTypes()` / `getCatalogSkiaCutoverTypes()` 셋이며, family(`ComponentFamily` 8종) 단위로 atomic 하게 등록 상태(`CutoverState`)를 갖는다. 같은 family 안에서 `legacy` 와 `catalog` 가 혼재하지 않는다(불변식 D). cutover 게이트(`cutover.ts::isCatalogCutover` / `isCatalogSkiaCutover`)는 `cutover === "catalog"` entry 에서 파생되는 단일 SSOT 다.

## generic 렌더러 — traversal 1 + backend 2

렌더는 노드 tree 를 도는 traversal 1개에 backend 2개(DOM/Skia)다. 컴포넌트별 렌더 함수는 없다. traversal 은 base(theme rule) ⊕ override(`props.style`)를 병합한 resolved 시각값을 단일 어댑터로 backend 별 표현에 투영한다.

- **DOM/Publish**: `toReactStyle(node)` 가 base⊕override 병합 시각값을 `React.CSSProperties` 로 투영. RAC primitive 는 `toRacProps(node)` 로 D1 props(ARIA/키보드/포커스/슬롯) 를 투영해 `react-aria-components` export 에 전달.
- **Skia**: `toSkiaStyle(node)` → `buildCatalogShapes(visual, props, size, state, textDecoration)` 가 generic box + text 를 그린다. `buildCatalogShapes` 는 `node.type` 을 식별하지 않는다 — 모든 컴포넌트가 같은 box+text 골격을 공유하고 시각 차이는 값(`visual.fill` / `size.fontSize` / `size.borderRadius`)으로만 흡수된다. 출력은 `RenderCommand[]` flat stream(`ELEMENT_START` … `CHILDREN` … `ELEMENT_END`)이고, frame culling(`visiblePageRoots` / `visibleFrameRoots`)과 `nodeRendererText`(CanvasKit Paragraph)가 traversal 안에서 작동한다.

shorthand↔longhand 정규화, Taffy reader, token 해소는 모두 이 두 어댑터 한 곳에 수렴한다 — 컴포넌트 코드에 흩어지지 않는다.

## 3-Domain 배치

| Domain             | 권위                                       | 노드에서의 위치                                                                           |
| ------------------ | ------------------------------------------ | ----------------------------------------------------------------------------------------- |
| **D1 DOM/접근성**  | RAC 절대                                   | `toRacProps(node)` 투영만. composition 은 ARIA/키보드/포커스를 소유하지 않음              |
| **D2 Props/API**   | binding `accepts` + reusable `propsSchema` | 노드의 의미 키(content/variant/size/fillStyle …)가 편집 대상. `PropContract` 가 편집 계약 |
| **D3 시각 스타일** | theme(`ComponentRule`) + canonical tree    | 노드의 시각 키(fontSize/fill/padding …) + theme 다축 해소                                 |

D3 의 두 consumer(DOM/CSS 와 Skia)는 대등하다. 같은 노드와 같은 theme rule 에서 동일 시각 결과를 산출하는지가 정합성 기준이며, 그리는 방법(border-radius vs arc)은 자유다.

---

## ② Format Schema (base/override 2층 SSOT 구조)

### CanonicalNode — 의미 props + 시각 override layer

노드는 의미값과 **사용자 시각 override** 를 들고 있다. 의미값(`content`/`variant`/`size`)은 `props` 에, 사용자가 base 를 덮어쓴 시각값(`fontSize`/`fill`/`padding`/`gap`/`cornerRadius` …)은 `props.style`(override layer)에 있다. **시각 base(컴포넌트 default)는 노드에 저장하지 않는다** — theme rule(`resolveComponentRule(type, doc).sizes[size]` 등)에서 resolve 된다. 노드는 그 base 위에 얹은 override 만 들고 있다.

`props.style` 은 "제거 대상 중첩 래퍼" 가 아니라 **"사용자가 base 를 덮어쓴 키만 담는 override layer"** 다. 키 존재 자체가 override 신호이고, 키 부재 = base 따름. 이 분리가 reset-to-default(`delete props.style[k]`), size 변경 시 override 유지(키 존재), `/cross-check` 시각 대칭(base⊕override 를 두 backend 가 같은 어댑터로 병합)을 정의한다(ADR-907 Layer B / 909 longhand 정책 정합).

**Pencil 동형의 정확한 의미**: 한 노드 내부의 키 나열은 평면이되(`{ type, content, variant, props.style }`), base/override 는 **노드 간**으로 분리한다 — origin 노드(base) ↔ ref.descendants(override). 한 노드 안에 base+override 를 같은 키 공간에 섞지 않는다.

```ts
import type { ComponentTag } from "./composition-vocabulary";

/** 노드 — 의미값(props) + 사용자 시각 override(props.style). base 는 theme rule 에서 resolve. */
export interface CanonicalNode {
  // ── 식별 ──
  id: string; // slash(/) 금지 — descendants path 구분자와 충돌
  type: ComponentTag; // 8 primitive type + RAC leaf type (121 literal)
  name?: string;

  // ── 의미값 (D2 — binding.accepts / propsSchema 가 노출) ──
  props?: {
    content?: string; // text content / label
    variant?: string; // theme ComponentRule.variants 의 key (enum 아님)
    size?: string; // theme ComponentRule.sizes 의 key (enum 아님)
    fillStyle?: string; // "fill" | "outline" | "subtle"
    // … binding.accepts 가 노출하는 그 외 의미 키
    // ── 시각 override layer (D3 — 사용자가 base 를 덮어쓴 키만) ──
    style?: {
      x?: number;
      y?: number;
      width?: number | string;
      height?: number | string;
      layout?: string; // flex / grid / block
      alignItems?: string;
      justifyContent?: string;
      // padding/gap 은 longhand 저장(ADR-909) — paddingTop/Right/Bottom/Left, rowGap/columnGap
      paddingTop?: number | string;
      paddingRight?: number | string;
      paddingBottom?: number | string;
      paddingLeft?: number | string;
      rowGap?: number | string;
      columnGap?: number | string;
      fontSize?: number | string;
      fill?: string; // 배경/색 토큰 (TokenRef)
      cornerRadius?: number | string;
      // … 모든 노드가 같은 키 공간 공유 (컴포넌트별 typed 필드 0)
      // 키가 없으면 base(theme rule) 따름. 있으면 override.
      [k: string]: unknown;
    };
  };

  // ── 구조 / 컴포넌트화 ──
  reusable?: boolean; // true → 재사용 원본(origin)
  children?: CanonicalNode[];
  slot?: false | string[]; // fill 가능한 reusable id 목록
  theme?: { mode?: string; tint?: string; [k: string]: string | undefined };
}
```

`frame` 노드는 `clip` / `placeholder` 두 키를 추가로 갖는다.

```ts
export interface FrameNode extends CanonicalNode {
  type: "frame";
  clip?: BooleanOrToken; // children 경계 clipping
  placeholder?: boolean; // 빈 frame UI hint
}
```

인스턴스 노드는 `ref` 로 원본을 가리키고 `descendants` 로 자식을 오버라이드한다.

```ts
export interface RefNode extends CanonicalNode {
  type: "ref";
  ref: string; // origin reusable 노드 id
  descendants?: Record<string, DescendantOverride>;
}
```

### 컴포넌트화 3-mode (Pencil 동형)

| mode     | 표현                                 | 의미        |
| -------- | ------------------------------------ | ----------- |
| origin   | `reusable: true` frame               | 재사용 원본 |
| instance | `{ type: "ref", ref }`               | 원본 참조   |
| override | `descendants: { "<idPath>": { … } }` | 자식 패치   |
| fill     | `slot: [ids]`                        | slot 채우기 |

`descendants` 값은 3-mode union(`DescendantOverride`)이다 — (A) 속성 patch(id/type/children 없음 → 속성만 merge), (B) node replacement(`type` 존재 → 서브트리 교체), (C) children replacement(`children` 존재 + type 없음 → 배열 교체, `enabled: false` 포함). key 는 slash(`/`) 로 경로를 구분하는 stable id path(예: `"ok-button/label"`)다.

### theme 다축 — variant/size 선택지의 출처

`variant` / `size` 는 컴포넌트에 고정된 enum 이 아니라 theme 규칙의 key 다. `resolveComponentRule(type, doc)` 가 노드 type 의 `ComponentRule` 을 해소한다(문서 override `doc.componentRules` 우선, build-time 기본 `COMPONENT_RULES_TABLE` fallback).

```ts
export interface ComponentRuleSize {
  fontSize?: number | string; // TokenRef("{radius.md}") / "auto" / 숫자 혼재
  lineHeight?: number | string;
  borderRadius?: number | string;
  borderWidth?: number | string;
  height?: number | string;
  iconSize?: number | string;
}

export interface ComponentRule {
  defaultVariant?: string;
  defaultSize?: string;
  variants: Record<string, ComponentRuleVariant>; // 선택지 = 이 keys
  sizes: Record<string, ComponentRuleSize>; // 선택지 = 이 keys
  textDecoration?: string;
}
```

선택 가능한 variant/size 값 집합은 `Object.keys(rule.variants)` / `Object.keys(rule.sizes)` 로 읽는다 — `PropContract` 의 `kind: "variant"` / `"size"` 는 `options` 를 두지 않는다. 색/크기/형태 토큰은 모두 TokenRef 문자열이며, runtime 에서 `resolveToken` 이 Pencil 다축(Accent×Base×Mode) best-match 로 실수 값으로 해소한다(dark mode 자동 반전 포함).

### 편집 계약 — resolveEditContract(node) 단일 진입점

Properties Panel 과 Style Panel 은 별도 store/공급처를 두지 않는다. 둘 다 `resolveEditContract(node)` 하나로 같은 노드를 읽고, `PropContract.section` 태그로 필터링한 두 view 일 뿐이다.

```ts
export interface PropContract {
  kind: InspectorFieldKind; // boolean | enum | string | string-array
  //   | number | icon | variant | size | fillStyle | binding
  label?: string;
  default?: unknown;
  section?: "content" | "appearance" | "state" | "locale" | (string & {});
  options?: Array<{ value: string; label: string }>; // enum 전용
  min?: number;
  max?: number;
  step?: number;
  visibleWhen?: VisibilityCondition;
}
```

primitive 의 `binding.props.accepts` 와 reusable 의 `propsSchema` 가 같은 `PropContract` 타입을 공유한다 — Properties view(`section: "content" | "state" | "locale"` …)와 Style view(`section: "appearance"`)는 같은 계약을 태그로 갈라 보여줄 뿐이다.

### 데이터 경로 — `button.size = "sm"` → `fontSize: 14` (base) / override 분리

노드 하나 + theme rule 이 단일 공급원이므로 한 값이 5곳에서 동일하게 흐른다. base(rule)와 override(`props.style`)가 분리돼 있고, 어댑터가 `override ?? base` 로 병합한다.

```
노드:        { type:"Button", props:{ size:"sm" } }    // size = 의미값(props)
                                                        // props.style.fontSize 없음 → base 따름
theme:       resolveComponentRule("Button", doc)
               → rule.sizes["sm"].fontSize = 14         // ← base (노드에 안 박힘)
─────────────────────────────────────────────────────────────
① Props Panel : resolveEditContract(node)
                  size 필드 선택지 = Object.keys(rule.sizes) = ["sm","md","lg"]
② Style Panel : 같은 노드, section:"appearance" 태그 view
                  fontSize 표시 = props.style.fontSize ?? rule.sizes["sm"].fontSize = 14
③ DOM/Publish : toReactStyle(node) → { fontSize: 14px }  (base⊕override 병합; RAC 는 toRacProps)
④ Skia        : toSkiaStyle(node) → buildCatalogShapes(visual, props, size={fontSize:14}, …)
                  → nodeRendererText 가 14px Paragraph
⑤ Publish     : ③ 과 동일 어댑터 (toReactStyle) — 별도 경로 없음
─────────────────────────────────────────────────────────────
사용자가 fontSize=16 override:
   props.style.fontSize = 16  → ③④ 모두 16 (override 우선). size 를 md 로 바꿔도 16 유지(키 존재).
   reset → delete props.style.fontSize → 다시 base(rule) 따름.
```

`size` 는 의미값으로 노드에 저장되고, base `fontSize:14` 는 theme rule 에서 1회 해소된다. 사용자 override 는 `props.style.fontSize` 에만 쌓여 base 와 물리 분리되므로, theme 교체·size 변경·reset 이 모두 정의된 채로 5 소비처에 동일하게 반영된다.

<a id="영역-3"></a>

## ③ RAC → Internal Format 변환 레이어

이 레이어는 react-aria-components(RAC) leaf primitive 를 composition 의 노드 데이터에 잇는 유일한 변환 경계다. 노드는 의미값(`children`/`variant`/`size`/`iconName`, `props`)과 사용자 시각 override(`fontSize`/`fill`/`padding`/`cornerRadius`, `props.style`)를 들고 있고, 시각 base 는 theme rule 에서 resolve 된다. RAC 는 ARIA·키보드·포커스를 100% 소유하고(D1), composition 은 그 노드를 RAC props 로 투영(`toRacProps`)하기만 한다. variant·size·fillStyle 같은 시각 차원은 RAC props 가 아니라 `data-*` 속성으로 라우팅되어 theme 가 D3 로 적용한다. 조합 컴포넌트(아이콘이 붙은 Button 등)는 코드 변환이 0이며 reusable 노드 문서로 저작한다.

### 1. 변환 경계의 위치 — generic 렌더러 안의 단일 분기

leaf primitive 의 DOM 투영은 per-component 렌더러를 거치지 않는다. generic traversal(`CanonicalNodeRenderer`)이 catalog entry 의 `binding.source.kind` 로만 분기해 RAC export 또는 internal 렌더러를 직접 호출한다.

```typescript
// apps/builder/src/preview/components/CanonicalNodeRenderer.tsx
import * as RAC from "react-aria-components";
import { getPrimitiveBinding, toRacProps } from "@composition/shared";

const binding = getPrimitiveBinding(type); // ComponentCatalogEntry.binding
const PrimitiveComponent: React.ElementType | undefined =
  binding.source.kind === "rac"
    ? (RAC as Record<string, React.ElementType>)[binding.source.component]
    : INTERNAL_RENDERERS[binding.source.renderer];

const { children: racChildren, ...racRest } = toRacProps(node, binding);
const childNodes = node.children ?? [];

return (
  <PrimitiveComponent {...markerProps} {...racRest}>
    {childNodes.length > 0
      ? childNodes.map((child) => <CanonicalNodeRenderer node={child} ... />)
      : (racChildren as React.ReactNode)}
  </PrimitiveComponent>
);
```

`source.kind` 는 두 값만 가진다.

- `"rac"`: react-aria-components 의 leaf primitive. `binding.source.component`(예: `"Button"`)로 `RAC[component]` 를 조회. RAC 가 D1 의 절대 권위.
- `"internal"`: RAC 으로 환원 불가능한 leaf 또는 자체 collection 합성 wrapper. `binding.source.renderer`(예: `"icon"`, `"table"`)로 `INTERNAL_RENDERERS[renderer]` 를 조회. Icon(Lucide SVG)·Badge(styled box+text)가 leaf 탈출구이고, collection wrapper(ListBox/Select/Table 등)는 `useCollectionData(dataBinding → items)`로 데이터를 채워 RAC collection + Item 을 자체 합성한다.

이 분기 하나가 leaf 전체의 변환 경계다. 컴포넌트별 변환 코드는 없다.

### 2. binding.props.accepts — 노드 의미 props ↔ RAC props 계약

각 PrimitiveBinding 은 `props.accepts: Record<string, PropContract>` 로 자신이 받는 canonical prop 집합을 선언한다. 이것이 그 primitive 의 D2 편집 SSOT 이자 RAC 투영 화이트리스트다. `accepts` 에 없는 키(event handler 등)는 투영에서 drop 된다.

```typescript
// packages/shared/src/catalog/bindings/Button.binding.ts
export const buttonBinding: PrimitiveBinding = {
  source: { kind: "rac", package: "react-aria-components",
            importPath: "react-aria-components", component: "Button" },
  rac: {
    primitive: "Button",
    parts: ["button"],
    slots: [],
    states: ["isHovered", "isPressed", "isFocused", "isFocusVisible",
             "isDisabled", "isPending"],
    renderProps: ["isHovered", "isPressed", "isFocused", "isFocusVisible",
                  "isDisabled", "isPending"],
    dataAttributes: ["data-hovered", "data-pressed", "data-focused",
                     "data-focus-visible", "data-disabled", "data-pending"],
  },
  props: {
    accepts: {
      children: { kind: "string", label: "Text", section: "content" },
      variant:  { kind: "variant", label: "Variant", section: "appearance", default: "primary" },
      size:     { kind: "size", label: "Size", section: "appearance", default: "md" },
      fillStyle:{ kind: "fillStyle", label: "Fill Style", section: "appearance", default: "fill" },
      type:     { kind: "enum", section: "state", default: "button", options: [...] },
      isPending:{ kind: "boolean", label: "Pending", section: "state" },
      isDisabled:{ kind: "boolean", label: "Disabled", section: "state" },
    },
    toRacProps: "default",
  },
};
```

PropContract 의 `kind` 는 9종(`boolean`/`enum`/`string`/`number`/`icon`/`variant`/`size`/`fillStyle`/`binding`)이고, `section` 태그(`content`/`appearance`/`state`/`locale`)는 Properties Panel·Style Panel 두 view 가 같은 노드를 section 으로 필터링하는 근거다. `variant`·`size` kind 는 `options` 를 두지 않는다 — 선택 가능 값은 컴포넌트 enum 이 아니라 theme 의 ComponentRule keys(`[data-variant=...]`/`[data-size=...]` 매칭 집합)에서 읽는다.

RAC Button 의 D2 surface 는 `accepts` 로 한정된다. 아이콘이 붙은 Button 은 leaf 가 아니라 reusable 조합 문서이므로(§5·§7), Button binding 의 `accepts` 에 아이콘 합성 필드는 들어가지 않는다. leaf 의 `accepts` 는 그 primitive 가 직접 받는 prop 만 담는다.

### 3. toRacProps — 유일한 투영기

`toRacProps(node, binding)` 가 노드의 의미 `props` 를 `accepts` 계약으로 필터링해 RAC primitive 에 스프레드할 객체를 만든다(시각 override `props.style` 는 D3 어댑터로 분기, RAC props 아님). 컴포넌트별 변환기가 없고 `binding.props.toRacProps: "default"` 식별자가 이 단일 함수를 가리킨다.

```typescript
// packages/shared/src/catalog/outputs/toRacProps.ts
const DATA_ATTR_KINDS: ReadonlySet<string> = new Set([
  "variant",
  "size",
  "fillStyle",
]);

function toDataAttrName(key: string): string {
  return key.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
}

export function toRacProps(
  node: CanonicalNode | ResolvedNode,
  binding: PrimitiveBinding,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const props = node.props;

  for (const [key, contract] of Object.entries(binding.props.accepts)) {
    const hasValue =
      props != null && Object.prototype.hasOwnProperty.call(props, key);
    const value = hasValue ? props[key] : contract.default;
    if (value === undefined) continue;

    if (DATA_ATTR_KINDS.has(contract.kind)) {
      out[`data-${toDataAttrName(key)}`] = String(value); // 시각 차원 → data-*
    } else {
      out[key] = value; // RAC props 통과
    }
  }
  return out;
}
```

투영 규칙은 세 가지다.

- **화이트리스트**: `accepts` 에 선언된 prop 만 통과. 미선언 prop drop.
- **visual-enum 라우팅**: `variant`/`size`/`fillStyle` kind 는 RAC props 가 아니라 `data-{kebab(key)}` 속성으로 라우팅. `fillStyle` → `data-fill-style`. RAC primitive 는 unstyled 이고 theme CSS `[data-fill-style="outline"]` 가 시각을 적용(D3). Skia 는 같은 노드에서 `fill.outline`/`subtle` 을 소비.
- **default emit**: 노드가 prop 을 생략하고 계약에 `default` 가 있으면 default 적용. variant/size 는 theme 의 `[data-variant=...]` 매칭을 위해 항상 emit 되어야 하므로 default 가 특히 중요하다.

`children` 만 분리해서 RAC element 의 자식 자리로 흘려보내고(노드에 canonical children 이 없을 때), 나머지(`racRest`)는 RAC props 로 스프레드한다(§1).

### 4. binding.rac.states — render-prop state → data-\* attr

RAC 의 상호작용 상태(`isHovered`/`isSelected`/`isDisabled` 등)는 composition 이 만들지 않는다. RAC 가 render-prop 으로 노출하는 boolean state 를 그대로 받아 시각만 입힌다. `binding.rac` 가 그 메타데이터 계약을 선언한다.

```typescript
// packages/shared/src/catalog/bindings/Checkbox.binding.ts
rac: {
  primitive: "Checkbox",
  parts: ["checkbox", "indicator", "label"],
  slots: [],
  states:        ["isSelected", "isIndeterminate", "isDisabled", "isInvalid"],
  renderProps:   ["isSelected", "isIndeterminate", "isDisabled", "isInvalid"],
  dataAttributes:["data-selected", "data-indeterminate", "data-disabled", "data-invalid"],
},
```

`states`/`renderProps` 는 RAC 가 composeRenderProps 콜백에 넘기는 boolean 키 집합이고, `dataAttributes` 는 RAC 가 같은 상태를 DOM 에 반영하는 `data-*` 이름이다. theme CSS 가 `[data-selected]`/`[data-pressed]` selector 로 시각을 적용하므로(D3), composition 은 별도 상태 머신 없이 RAC 가 emit 하는 attr 위에 토큰만 얹는다.

DOM 경로에서는 RAC primitive 가 자식을 `composeRenderProps` 로 받을 때 이 state 를 콜백 인자로 흘린다. composition 의 generic 렌더러는 RAC primitive 를 그대로 렌더하므로 `composeRenderProps` wiring 은 RAC 내부에서 일어나고, composition 은 `racRest` 스프레드 + theme `data-*` selector 로 결과를 받는다. Skia 경로에서는 같은 boolean state 가 노드의 상태값으로 읽혀 `resolveSkiaVisualRule` 가 `fill.hover`/`fill.selected` 를 골라 `buildCatalogShapes` 출력에 합성한다 — 두 backend 가 같은 노드의 state 와 같은 theme 규칙(state 별 base) 위에 노드 override 를 얹어 투영하므로 시각이 대칭한다.

### 5. slot 합성 — collection·part 의 D1 은 RAC 소유

RAC 컴포넌트는 part·slot 으로 내부 구조를 합성한다(Checkbox = `["checkbox","indicator","label"]`, slot="selection" 등). composition 은 이 합성을 재작성하지 않는다.

- **leaf primitive**: indicator/label 같은 part 는 RAC 가 합성한다. Checkbox indicator(box + checkmark)는 DOM 에서 RAC 가 그리고, Skia 에서는 box+text 로 표현 불가한 비-DOM-trivial primitive 이므로 `skiaPrimitive: "checkbox"` draw module 이 그린다. label 은 자식 노드(canonical children)가 담당한다.
- **collection wrapper**: ListBox/Select/Table 등은 `source.kind: "internal"` 의 wrapper 가 `useCollectionData(dataBinding → items)` 로 items 를 채우고 RAC `<Collection items>` + 렌더함수로 Node tree 를 합성한다. cutover DOM 경로가 `toRacProps` 로 `dataBinding` 등 wrapper props 만 통과시키면 wrapper 가 items 를 렌더하므로 generic 렌더러는 자식 재귀를 하지 않는다. `useTableOptions`·`slot="selection"` 같은 RAC collection 계약은 모두 wrapper 안에서 RAC 가 처리한다.

slot fill(`{slot:[ids]}`)은 변환 레이어가 아니라 reusable 문서 resolver 의 영역이다 — RAC slot 과 별개로, reusable origin 의 slot host children 을 instance 가 채우는 데이터 메커니즘이다.

### 6. internal source — RAC 환원 불가 leaf

Icon 은 RAC primitive 가 아니라 composition 내부 Lucide SVG 렌더러다. `source.kind: "internal"` 이 D1 의 탈출구이고, `rac` 메타데이터는 생략한다(RAC part/slot/state 개념이 없으므로).

```typescript
// packages/shared/src/catalog/bindings/Icon.binding.ts
export const iconBinding: PrimitiveBinding = {
  source: { kind: "internal", renderer: "icon" },
  props: {
    accepts: {
      iconName: { kind: "icon", label: "Icon", section: "content" },
      variant: { kind: "variant", section: "appearance", default: "default" },
      size: { kind: "size", section: "appearance", default: "md" },
      strokeWidth: {
        kind: "number",
        section: "appearance",
        default: 2,
        min: 0.5,
        max: 4,
        step: 0.5,
      },
    },
    toRacProps: "default",
  },
  skiaPrimitive: "icon_font", // Lucide glyph — box+text 아님
};
```

`toRacProps` 는 internal source 에도 동일하게 동작한다 — `iconName`/`strokeWidth` 는 props 로, `variant`/`size` 는 `data-*` 로 라우팅. DOM 은 `INTERNAL_RENDERERS["icon"]`(Lucide `<svg>`), Skia 는 `skiaPrimitive: "icon_font"` draw module(CanvasKit Path)이 같은 노드 값을 투영한다.

### 7. 조합 컴포넌트 — reusable 노드 문서 저작 (자동 변환 0)

IconButton 같은 조합은 코드 변환이 없다. reusable:true frame(origin)을 저작하고, 사용처는 `{type:"ref", ref}`(instance) + `descendants:{nodeId:{override}}` 로 origin 을 instance 화한다. 변환 레이어는 leaf 만 다루고, 조합은 resolver 가 origin → instance 트리를 펼친 뒤 그 leaf 들이 §1~§6 의 변환을 받는다.

IconButton 예시: origin 은 Button leaf + Icon leaf 자식을 가진 reusable frame 이다. 사용처는 그 origin 을 ref 로 가리키고, descendants override 로 instance 별 차이만 patch 한다.

```typescript
// descendants 3-mode (apps/builder/src/resolvers/canonical/index.ts)
// mode A — 속성 patch: instance 가 origin base 위에 의미값/시각 override 만 덮어씀
//          (시각 override 는 props.style 키로 — origin 의 base 와 노드 간 분리)
{ "icon": { props: { iconName: "Trash", variant: "danger" } } }

// mode B — 노드 교체: type 존재 → 서브트리 완전 교체
{ "icon": { type: "ref", ref: "spinner-master" } }

// mode C — children 교체: children 존재 + type 없음 → children 배열 교체
{ "label-host": { children: [ { type: "text", props: { children: "Delete" } } ] } }
```

resolver 의 `applyOverrideToNode` 가 3-mode discriminator 다 — `type`+`children` 동시 존재는 silent merge 금지 위반으로 throw. mode A 는 속성 patch(의미값은 `props`, 시각값은 `props.style` override layer 에 patch), mode B 는 노드 교체, mode C 는 enabled:false 를 포함한 children 교체다. **이 descendants override 가 base/override 노드 간 분리의 구현이다** — origin 노드가 base 를, instance 의 `descendants[path]` 가 override 를 들고 있어 한 노드 안에 base+override 를 섞지 않는다. instance 노드는 origin 과 같은 보편 속성 키 공간을 공유하고 override 는 그 키에 patch 한다.

조합 컴포넌트의 SSOT 는 reusable 문서 데이터 그 자체다. 조합의 D1 은 그 안의 leaf 들이 각자 RAC/internal 로 투영되며 자동으로 성립하고, 조합 자체의 구조·합성은 canonical reusable 노드 문서가 정의한다.

### 8. 단일 등록 — componentCatalog

변환 레이어가 소비하는 binding 은 단일 `componentCatalog` 에서 온다. `getCatalogEntry(type)` 가 `ComponentCatalogEntry` 를, `getPrimitiveBinding(type)` 가 그 `binding` 을 반환한다. entry kind 는 셋이다.

- `kind: "primitive"` — leaf RAC/internal primitive(`binding` 보유).
- `kind: "reusable"` — 조합 컴포넌트(`reusableId` → canonical reusable 문서, 코드 정의 없음).
- `kind: "native"` — composition-native(frame/Slot). RAC primitive 도 reusable 문서도 아닌 canonical 일급 노드. cutover 개념이 없고 변환 레이어를 거치지 않는다.

`family`(8 family) + `cutover`(`legacy`/`cutting-over`/`catalog`)가 atomic cutover 축이다. `getCatalogCutoverTypes`/`getCatalogSkiaCutoverTypes` 가 catalog generic 경로로 전환된 type 집합을 파생하고, generic 렌더러는 그 집합에 든 type 만 §1 의 RAC 투영 분기로 렌더한다. family 단위로 DOM·Skia·Inspector 가 함께 generic 경로로 전환한다.

### 9. 대칭 계약

변환 레이어의 단일 공급원 원칙은 두 backend 의 대칭으로 검증된다. DOM 은 `toRacProps(node, binding)` → RAC primitive + theme `data-*` CSS, Skia 는 같은 노드 → `resolveSkiaVisualRule` → `buildCatalogShapes`(box+text) + `specShapesToSkia`. 둘 다 같은 노드의 같은 의미값/시각 override 와 같은 theme(ComponentRule) base 를 읽어 병합 투영하므로, RAC 가 D1 을 소유하면서도 두 화면의 시각 결과가 동일하다. variant/size 선택지가 theme keys 에서 오고 fillStyle 이 `data-*`/`fill` 양쪽에서 같은 토큰을 가리키는 것이 이 대칭의 핵심이다.

<a id="영역-4"></a>

# ④ Skia Rendering Layer

Skia 백엔드는 D3(시각 스타일)의 두 대등 consumer 중 하나다. Preview/Publish 의 DOM+CSS 와 같은 노드 하나 + 같은 theme rule 을 공급원으로 삼아 시각 결과의 동일성을 산출한다. 한쪽이 기준이고 다른 쪽이 따라가는 관계가 아니라, 두 backend 가 `generic 렌더러 traversal` 1개를 공유하고 base(theme rule) ⊕ override(`props.style`) 병합 시각값을 각자의 어댑터(`toReactStyle` / `toSkiaStyle`)로 투영한다. 본 영역은 Skia 측 어댑터와 그리기 파이프라인을 규정한다.

## 4.1 단일 traversal · 2 backend

노드 트리는 backend 와 무관한 단일 traversal 로 순회한다. 순회 결과는 flat `RenderCommand[]` 스트림이며, 이 스트림을 CanvasKit draw call 로 실행하는 것이 Skia backend, React element 로 실행하는 것이 DOM backend 다. traversal 은 노드 type 별 분기를 두지 않는다 — 모든 노드(frame/text/ref/leaf RAC)가 같은 보편 속성 키 공간을 공유하므로, traversal 은 \"노드를 base⊕override 병합 시각값으로 그린다\"는 단일 규칙만 안다.

```ts
// RenderCommand: backend 중립 flat stream (depth 정보는 BEGIN/END 쌍으로 인코딩)
type RenderCommand =
  | {
      type: typeof CMD_ELEMENT_BEGIN;
      node: SkiaNodeData; /* base⊕override 시각값 투영 */
    }
  | { type: typeof CMD_CHILDREN_BEGIN }
  | { type: typeof CMD_CHILDREN_END }
  | { type: typeof CMD_ELEMENT_END };

interface RenderCommandStream {
  commands: RenderCommand[];
}
```

`buildRenderCommandStream(...)` 가 트리를 1회 순회하며 `commands: RenderCommand[]` 를 채우고, `executeRenderCommands(...)` 가 이 배열을 선형 `for` 루프로 실행해 CanvasKit draw call 을 발행한다. `CMD_ELEMENT_BEGIN` 에서 clip/mask/translate 를 push, `CMD_CHILDREN_BEGIN`/`CMD_CHILDREN_END` 로 자식 구간을 감싸고, `CMD_ELEMENT_END` 에서 pop 후 합성하는 stack discipline 으로 트리 깊이를 표현한다. 재귀 호출 없이 flat 배열을 도는 구조라 GC 압력과 호출 깊이가 일정하다 — 60fps 의 토대.

## 4.2 toSkiaStyle(node) — 단일 어댑터

> **신규 도입 심볼** (Proposed): `toSkiaStyle` / `toReactStyle`(§③) / `resolveEditContract`(§"편집 계약")는 본 ADR 이 도입할 신규 심볼이다(현재 코드 0건). theme rule base resolve 는 이미 실재하는 `resolveComponentRule` / `resolveToken`, Skia box+text 그리기는 실재하는 `buildCatalogShapes`, D1 prop 투영은 실재하는 `toRacProps` 를 재사용·확장한다 — 어댑터는 이들 위에 base⊕override 병합 한 겹을 더한 얇은 신규 layer 다.

`toSkiaStyle(node)` 는 base(theme rule) ⊕ override(`node.props.style` 의 `fill` / `cornerRadius` / `borderWidth` / `padding` / `gap` / `fontSize`)를 병합한 resolved 시각값을 Skia `Shape[]` 로 투영하는 단일 어댑터다. override 우선 병합(`props.style[k] ?? rule.resolve(k)`), shorthand↔longhand 정규화, Taffy 결과 좌표 reader, token 해소가 모두 이 한 곳에 수렴한다. DOM backend 의 `toReactStyle(node)` 와 대칭 — 같은 base⊕override 를 읽어 다른 표현(Shape vs CSSProperties)으로 내보내되, 시각 결과는 동일하다.

override reader 는 store longhand 정책을 따른다(`props.style.rowGap ?? props.style.columnGap ?? props.style.gap`, `props.style.paddingTop ?? props.style.padding`, ADR-909). px 파싱은 `parsePxValue` / `parseBorderWidth` 단일 진입점만 사용하고 `parseFloat(String(x))` ad-hoc 파싱을 두지 않는다 — DOM/Skia/Layout 세 경로가 같은 reader 를 거쳐야 drift 가 없다.

```ts
// toSkiaStyle: base(rule) ⊕ override(props.style) → Shape[] (단일 어댑터, type 분기 없음)
function toSkiaStyle(
  node: ResolvedNode,
  rule: ComponentRule,
  size: ComponentRuleSize,
): Shape[] {
  const ov = node.props?.style ?? {}; // 사용자 override layer (키 있으면 base 덮어씀)
  const borderRadius = parsePxValue(
    ov.cornerRadius ?? size.borderRadius,
    size.borderRadius,
  );
  const borderWidth = parseBorderWidth(ov.borderWidth ?? size.borderWidth, 1);
  // fill / padding / gap / fontSize 모두 override(props.style) 우선, 없으면 rule base
  // token 은 resolveToken 다축 best-match 로 해소
  // 출력 Shape[] 는 specShapesToSkia 가 CanvasKit Paint 로 변환
}
```

## 4.3 buildCatalogShapes — generic box+text

`buildCatalogShapes(visual, props, size, state, textDecoration)` 는 component-agnostic 생성기다. `node.type` 을 읽지 않고, 모든 frame 이 공유하는 보편 box+text 시각(배경 roundRect + border + text)만 generic 처리한다. 컴포넌트별 시각 차이는 값(base⊕override)의 차이로 흡수되며, `if (isDot)` / `if (divider)` / `if (iconName)` 같은 컴포넌트 식별 분기를 이 함수에 두지 않는다. 분기를 인라인하면 컴포넌트 N개가 N개의 if 로 복제되기 때문이다.

```ts
export function buildCatalogShapes(
  visual: ComponentVisualRule | undefined, // theme(ComponentRule) 투영 — variant 색상 규칙
  props: Record<string, unknown>,
  size: SizeSpec, // theme sizes[size]: fontSize/height/borderRadius
  state: ComponentState = \"default\",
  textDecoration?: string, // underline 등 D3 text-decoration 메타
): Shape[];
```

- **데이터 소스**: base 시각값 — variant 색상은 `ComponentVisualRule`(theme `resolveComponentRule(type, doc).variants[v]` 투영), 크기는 `sizes[size]`. 사용자 override 는 `node.props.style`(`props.style.fill` / `props.style.cornerRadius`)에서 와 base 를 덮어쓴다. spec runtime 을 참조하지 않는다. 패키지 경계상(`specs ← shared ← builder`) shapes 생성기는 theme 테이블을 직접 import 하지 못하므로 builder 가 `visual` / `size`(base) + 노드 override 를 해소해 주입한다.
- **보편 상태축**: `fill` / `outline` / `subtle` 은 fillStyle 축(`props.fillStyle`), `selected` / `emphasizedSelected` 는 selection 축(`props.isSelected` / `props.isEmphasized`), `hover` / `pressed` 는 interaction 축(`state`)이다. 세 축은 모든 frame 이 가질 수 있는 보편 상태축이며 CSS `data-*` 와 동형이다. 따라서 fill 색 결정에 쓰되 컴포넌트 식별로 쓰지 않는다.

```ts
// 보편 상태축 합성 (컴포넌트 식별 아님)
const fillStates = isOutline ? fill?.outline : isSubtle ? fill?.subtle : fill?.default;
const stateBg = isSelected
  ? isEmphasized
    ? (fill?.default.emphasizedSelected ?? fill?.default.selected)
    : fill?.default.selected
  : state === \"hover\"
    ? (fillStates?.hover ?? fillStates?.base)
    : state === \"pressed\"
      ? (fillStates?.pressed ?? fillStates?.base)
      : fillStates?.base;
const bgColor = (node.backgroundColor as string) ?? resolveToken(stateBg);
```

## 4.4 SkiaPrimitiveDrawFn — Shape[] 생성기

box+text 로 표현되지 않는 도형(원/선/아이콘/arc/track)은 `buildCatalogShapes` 가 아니라 `SkiaPrimitiveDrawFn` draw module 이 담당한다. dispatch 는 `PrimitiveBinding.skiaPrimitive` 키로 갈린다 — 컴포넌트는 binding 에서 이 키 중 하나를 가리킬 뿐, 함수 안에 컴포넌트 식별 분기가 없다. primitive 종류는 유한(원/선/아이콘/arc/...)하므로 키 추가는 컴포넌트 N++ 가 아니다.

`SkiaPrimitiveDrawFn` 은 직접 CanvasKit draw call 을 발행하지 않는다. `Shape[]` descriptor 만 생성하고, 그리기는 `specShapesToSkia` 단일 경로가 수행한다. draw call 발행과 도형 기술을 분리해 Skia 그리기 진입점을 단일화한 것이다.

```ts
export type SkiaPrimitiveDrawFn = (ctx: {
  props: Record<string, unknown>;
  size: SizeSpec;
  visual: ComponentVisualRule | undefined; // builder 가 rule 테이블에서 해소해 주입
  style: Record<string, unknown> | undefined; // 노드 의미 props + props.style override 런타임 전달
}) => Shape[] | null; // null = \"이 props 에 내 primitive 미적용\" → box+text fallback
```

`null` 반환은 컴포넌트 식별이 아니라 primitive 자체의 적용 조건이다. 예를 들어 `dot` primitive 는 `props.isDot` 일 때만 circle `Shape[]` 를 내고, 아니면 `null` 을 반환해 caller 가 보편 box+text 로 fallback 한다 — \"dot primitive 는 isDot 일 때 그린다\"이지 \"Badge 라는 컴포넌트를 식별한다\"가 아니다.

selected/checked 같은 시각도 보편 상태축 `visual.fill.default.selected` / `visual.selectedBorder` / `visual.border` 에서 읽는다. 컴포넌트-특화 상수 맵(checkbox 전용 색 상수 등)을 두지 않는다.

### arc = type:\"box\" + arc 데이터

원호(Meter/ProgressBar track/indicator)는 별도 `type:\"arc\"` 를 두지 않는다. `type:\"box\"` Shape 에 `arc` 데이터를 실어 표현한다. track 도 360° arc 로 그린다.

```ts
const trackShape: Shape = {
  type: \"box\",
  arc: { startAngle: 0, sweepAngle: 360, strokeWidth }, // arc 데이터
};
```

**Why**: 별도 arc type 은 HMR 경계에서 재마운트 이슈가 있고, `renderSolidBorder` 의 inset 처리가 circle+stroke 와 arc 에서 달라 track/indicator 사이 1px drift 가 난다. box+arc 데이터로 통일하면 같은 inset 규칙을 공유한다.

## 4.5 state · scrollOffset 런타임 주입

`buildCatalogShapes` / `SkiaPrimitiveDrawFn` 은 순수하다 — `state`(default/hover/pressed) 와 `scrollOffset` 을 인자로 받을 뿐, store 를 직접 구독하지 않는다. 런타임 값은 traversal 시점에 주입된다. 이로써 같은 노드 평면 데이터가 입력이면 같은 `Shape[]` 가 출력되어, 캐싱과 cross-check 비교가 결정적이다.

- **state**: hover/pressed/selected 는 interaction 결과로 traversal 진입 직전에 결정해 `buildCatalogShapes(..., state)` 로 전달.
- **scrollOffset**: `{ scrollTop, scrollLeft }` 를 `SkiaNodeData.scrollOffset` 에 실어 BEGIN 시점에 적용. sticky 자식은 부모 scrollOffset 기준으로 역보정한다.

## 4.6 Viewport Culling

화면 밖 노드는 그리지 않는다. culling roots 수집은 두 sibling 함수로 분리된다.

- `collectVisiblePageRoots(...)`: 뷰포트와 교차하는 page body root 집합.
- `collectVisibleFrameRoots(...)`: 뷰포트와 교차하는 frame body root 집합(`collectVisiblePageRoots` 와 동일 출력 shape — `frame body element id → { x, y }`).

`skiaFramePipeline` 이 두 root 집합만 traversal 대상으로 넘긴다. 보이지 않는 page/frame 의 하위 트리는 command stream 에 진입조차 하지 않으므로, 문서 규모와 무관하게 draw call 수가 뷰포트 내용에 비례한다.

selection bounds 맵은 `getCachedTreeBoundsMap(...)` 으로 캐싱하되, `registryVersion` + `pagePositionsVersion` + `scrollVersion` 을 캐시 시그니처로 둔다. `scrollVersion` 누락 시 스크롤 후 hover outline 이 스크롤 전 위치에 고정되므로 세 카운터를 모두 시그니처에 포함한다.

```ts
const scrollVersion = useScrollState.getState().scrollVersion;
const treeBoundsMap = getCachedTreeBoundsMap(
  tree,
  registryVersion,
  pagePosVersion,
  scrollVersion,
);
```

## 4.7 Collection Virtualization

Table/ListBox/GridList 같은 collection frame 은 보이는 row 만 그린다. RAC 의 data/render 분리(`useAsyncList` / `<Collection items>`)가 produce 한 항목 중 뷰포트와 교차하는 row 만 traversal 대상으로 만든다.

- **보이는 row 만**: scrollOffset 과 row height 로 visible window 를 계산해 그 범위의 row node 만 command stream 에 emit.
- **content height 동기화**: 화면에 그리는 row 는 일부지만, scroll 영역의 content height 는 전체 항목 기준이어야 한다. virtualization 이 줄인 것은 draw call 이지 논리적 content box 가 아니다 — `calculateContentHeight()` 는 전체 항목 기준 높이를 반환하고, 같은 spacing resolver(`resolveContainerSpacing`)를 `buildCatalogShapes` 와 공유해 Layout/DOM/Skia 세 경로가 같은 높이를 본다.
- **scrollOffset 차감**: row 의 절대 좌표에서 부모 collection 의 scrollOffset 을 차감해 viewport-local 좌표로 그린다. traversal 의 `CMD_ELEMENT_BEGIN` translate 와 boundsMap 좌표가 같은 차감을 적용해야 hover/selection outline 이 스크롤된 row 와 정렬된다.

#### `slice(0, N)` 은 culling 이 아니다 (정밀화)

현재 Skia ListBox row projection 의 source 는 `slice(0, windowLimit)`(기본 limit 100, `listBoxRowProjectionModel.ts`)이고 Table Skia 는 `rows` 전체를 순회한다. 이는 **고정 cap 일 뿐 viewport culling 이 아니다** — 101 번째 row 부터는 화면에 있어도 누락되고, 100 row 가 전부 화면 밖이어도 100개를 materialize 한다. 진정한 windowing 은 cap 이 아니라 **scrollOffset + measured row size 로 계산한 [startIndex, endIndex] + overscan** 이다.

```ts
interface CollectionWindow {
  startIndex: number;
  endIndex: number; // scrollOffset + viewport height / estimatedSize 로 산출 (cap 아님)
  overscanStart: number; // 스크롤 방향 버퍼 (깜빡임 방지)
  overscanEnd: number;
  totalCount: number; // content height 는 이 값 기준 (draw 가 줄어도 논리 box 불변)
  estimatedSize: number; // 미측정 row 의 추정 높이
}
```

- **draw tree 와 hit tree 가 같은 window 를 공유**: 보이는 것만 그리되, hit-test 노드 집합도 같은 [startIndex, endIndex]+overscan 으로 제한. 둘이 어긋나면 화면에 없는 row 가 hit 되거나 보이는 row 가 hit 안 됨.
- **sticky header 는 별도 layer**: body row window 와 독립. Table 은 row window + column culling(2D).
- G7 의 List/Table 1000+ row FPS fixture 는 `draw/hit 노드 수 ≤ viewport window + overscan` 을 통과 조건으로 둔다(`slice` cap 통과 금지).

#### template subtree 기반 row height (정밀화)

row height 는 `items` 가 아니라 **template subtree 의 layout 계산**에서 나온다. ListBoxItem 이 `icon + label + description` 처럼 중첩 frame 을 가지면, row 높이는 그 template tree 의 padding/gap/fontSize/lineHeight 를 Taffy 로 계산한 intrinsic size 다 — row 마다 근사값으로 대체하지 않는다. 깊은 template 일수록 근사 오차가 누적되므로, **template 1회 layout → 모든 visible row 가 같은 height 재사용**(데이터만 다른 row 는 같은 template metric)이 정합과 성능을 동시에 지키는 지점이다. 이 template layout 결과는 `TemplateLayoutCacheKey`(templateHash + size + variant + width + themeKey)로 캐싱하되, 캐시는 기존 layout publish / projection version 신호에 연결되어야 stale 렌더를 만들지 않는다(Risks **T-TPL**, Gate G7).

## 4.8 Text Rendering

텍스트는 CanvasKit `Paragraph` API 로 그리며, Pencil 수준(다국어 줄바꿈/strut/half-leading)을 목표로 한다. 측정과 렌더는 같은 `ParagraphStyle` / `fontFamilies` 배열을 공유한다 — 측정기와 렌더러가 다른 폰트 체인을 쓰면 줄바꿈 위치가 어긋난다.

- `heightMultiplier > 0` 일 때 `halfLeading: true` + `forceStrutHeight: true` 를 측정/렌더 양쪽에 동일 적용. **Why**: CSS line-height 의 상하 균등 분배 재현.
- 콘텐츠 폭은 `getLongestLine()`, max-content 은 `getMaxIntrinsicWidth()`. `getMaxWidth()` 는 쓰지 않는다.
- `Paragraph` WASM 객체는 캐싱하지 않고(메모리 누수) 결과값 `{ width, height }` 만 LRU 캐싱.
- Layout 경로에는 Canvas 2D↔CanvasKit sub-pixel 보정(`+2/+4px`)을 넣지 않는다. 단일줄 텍스트가 CanvasKit 측정 차이로 오발 줄바꿈되면 렌더 단(`nodeRendererText`)에서 `getMaxIntrinsicWidth() + 1` 로 1회 재layout 하는 자체 측정 기반 교정만 적용한다.

폰트 색/크기/decoration 도 base⊕override 로 읽는다. `props.style.color ?? visual.text`, `props.style.fontSize ?? sizes[size].fontSize`, `textDecoration`(underline 등)은 `buildCatalogShapes` 인자로 받아 적용한다 — override(`props.style`)가 있으면 우선, 없으면 theme rule base.

## 4.9 specShapesToSkia — 단일 그리기 진입점

`buildCatalogShapes` 와 모든 `SkiaPrimitiveDrawFn` 의 출력 `Shape[]` 는 `specShapesToSkia(shapes, skiaTheme, ...)` 단일 경로로 CanvasKit Paint/Path draw call 이 된다. dark mode 적용은 `skiaTheme` 인자로 전달하며 하드코딩 `\"light\"` 를 두지 않는다. Shape 생성기를 어떻게 늘리든 실제 그리기 코드는 이 한 곳에 수렴하므로, 새 primitive 추가가 그리기 경로를 분기시키지 않는다.

## 4.10 종합 — 데이터 흐름

```
노드 (의미값 props + 시각 override props.style) + theme rule base
  → traversal 1개 (type 분기 없음)
    → toSkiaStyle(node, rule, size) / buildCatalogShapes(visual,size,state) / SkiaPrimitiveDrawFn
      → Shape[] (arc=box+arc 데이터, state/scrollOffset 런타임 주입)
        → specShapesToSkia(shapes, skiaTheme)  ← 단일 그리기 진입점
          → RenderCommand[] flat stream (ELEMENT_BEGIN..CHILDREN_BEGIN..CHILDREN_END..ELEMENT_END)
            → executeRenderCommands (선형 for, culling+virtualization 적용)
              → CanvasKit draw call  (60fps)
```

DOM backend 는 같은 traversal 출력을 `toReactStyle(node)` 로 받아 React element 로 실행한다. 두 backend 가 같은 노드 base⊕override 를 공급원으로 삼고 같은 reader/spacing resolver 를 거치므로, Builder Skia 와 Preview/Publish DOM 의 시각 결과가 동일하다.

## 4.11 RAC 시각 재현 범위 — 원본 RAC → SSOT → Skia 정합성 계층

원본 RAC 시각(vendored starter CSS)은 `packages/design.md`(starter CSS token/패턴을 중복제거해 정규화한 reference baseline)를 선행 입력으로 거쳐 SSOT(theme `ComponentRule` + `props.style` override)로 추출되고, Skia generic 렌더(`buildCatalogShapes`)로 투영된다. 입력 체인: `react-aria-starter/src` CSS → `design.md` 정규화 reference → theme/tokens SSOT → Skia/DOM generic. `design.md` 는 저작 입력이지 런타임 계약이 아니며(런타임 시각 SSOT 는 theme/tokens root collection), 컴포넌트별 design.md 추가는 금지(중복 SSOT)다. 이 경로에서 **모든 RAC 시각이 동일 정합으로 재현되는 것은 아니다** — 시각 속성은 재현 난이도별로 4계층으로 나뉘고, generic 정합이 닿는 영역과 컴포넌트별 수작업 합성에 맡기는 영역, 정적 Skia 특성상 재현하지 않는 영역의 경계가 다르다. 본 절은 그 경계를 명시한다(설계 한계의 정직한 기록 — "RAC 시각 100% Skia 재현"은 본 설계의 목표가 아니다).

**실측 근거**: 원본 RAC CSS 시각 속성 전수 집계(`packages/react-aria-starter/**/*.css`), SSOT 추출 범위(`ComponentRuleSize` 6필드 + `ComponentRuleVariantColors` 11색상축), Skia generic 출력(`buildCatalogShapes` = `border` + `text` 2 shape), 수작업 합성(`skiaPrimitives.ts` 의 `overlay_backdrop` / `popover_shadow` / `popover_arrow` draw module).

| 계층                  | 원본 RAC 시각 (빈도)                                                      | SSOT 추출                                                              | Skia 재현                                                       |       정합성        |
| --------------------- | ------------------------------------------------------------------------- | ---------------------------------------------------------------------- | --------------------------------------------------------------- | :-----------------: |
| **① box 골격**        | border-radius · height · padding · gap · border · font-size · font-weight | `ComponentRuleSize` + `props.style` override                           | `buildCatalogShapes` roundRect + border + text                  |      **~90%**       |
| **② 색상**            | color · background · border-color                                         | `ComponentRuleVariantColors`(fill×state) + ADR-908 `resolveFillTokens` | fillStyle × selection × interaction 축 합성                     |      **~85%**       |
| **③ 레이아웃 (flex)** | display · flex-direction · align-items · justify-content                  | `props.style` longhand(ADR-909)                                        | Taffy 결과 좌표 reader (generic)                                |      **~70%**       |
| **④ 상태 시각**       | outline(focus) · scale(pressed) · transition · cursor                     | hover/pressed = fill 만, focus-ring 부분                               | default/hover/pressed 만, **hit-test wiring 없음(T-7)**         |      **~40%**       |
| **⑤ 고급 시각**       | box-shadow · transform · opacity · z-index                                | SSOT 미추출                                                            | 컴포넌트별 `skiaPrimitive` 수작업 합성(overlay shadow/arrow 등) | **컴포넌트별 ~60%** |
| **⑥ 애니메이션**      | transition · transform · scale(0.95)                                      | 미추출                                                                 | 정적 렌더 — 미재현                                              |   **~0%** (의도)    |

### generic 정합 vs 수작업 합성의 경계 (결정적)

Skia generic(`buildCatalogShapes`)이 그리는 것은 **① box + 텍스트 골격뿐**(실측: `type:"border"` + `type:"text"` 2종). 따라서:

- **box+text 로 환원되는 시각(①②③, 약 70%)** → generic 단일 함수로 **높은 정합**. Button / TextField / Badge 류가 여기 해당하며, 같은 노드 base⊕override 와 같은 theme rule 을 DOM/Skia 가 공유해 시각 대칭이 성립한다.
- **box+text 로 환원 안 되는 시각(④⑤, 약 30%)**:
  - **shadow / arrow / backdrop** → `skiaPrimitives.ts` 의 컴포넌트별 수작업 draw module(`skiaPrimitive` 배열 + `getSkiaPrimitiveMode` replace/prepend/append)로 box+text 출력에 합성. 이는 generic 정합이 아니라 **의도적으로 남긴 per-component escape hatch** 다(④4.4 / 7-5 Select 예시).
  - **focus outline / pressed scale / `:has(>svg:only-child)` 구조 셀렉터(아이콘 전용 → 원형)** → SSOT 에 추출되지 않으며 generic 으로 재현되지 않는다.
- **transition / transform 애니메이션(⑥)** → Skia 가 정적 프레임을 그리므로 원리적으로 미재현. 빌더 캔버스는 정적 미리보기이므로 이는 **scope 밖(의도된 비목표)** 이지 결함이 아니다.

### 위험 연계

- 계층 ④(상태 시각)의 미흡은 본 ADR Risks **T-7(HIGH)** 로 등록돼 있다 — "현재 `default`/`disabled` 2개만 derive, hover/pressed hit-test wiring 없음 → Builder 화면 hover/pressed 시각 부재". `racStateAttrs` 도입 + `ComponentState` enum derived 가 대응.
- 계층 ①②(box+색상)의 정합은 Gate **G2**(base⊕override backend 어댑터 + `/cross-check` 시각 대칭)가 검증한다.
- 계층 ⑤(고급 시각)의 컴포넌트별 합성은 generic 단일 정합 대상이 아니므로, family fixture 의 `/cross-check`(G5)가 합성 결과의 시각 대칭만 확인한다.

**한 줄 요약**: 정적 골격(box/text/색상/레이아웃)은 generic 단일 경로로 **70~90% 정합**, 상태 인터랙션(T-7)과 shadow류 고급 시각은 정합이 낮거나 컴포넌트별 수작업, transition/transform 애니메이션은 정적 Skia 특성상 미재현이다. 본 설계의 정합 목표는 **box+text 로 환원 가능한 시각 영역에 한정**한다.

## 4.12 Interactive Projected Tree — collection 깊은 노드의 Skia 편집 surface

> **흡수 출처 + 정정**: ADR-920(Codex 독립 설계)의 핵심 가치. 910 의 ④.7 virtualization 은 "보이는 row 만 그린다"까지였고 collection 깊은 노드(row 내부 Text/Icon, Table cell)를 **클릭·드릴인·편집 가능한 노드**로 만드는 모델이 없었다. 910 의 이전 개정안은 collection 을 `skiaLegacy:true`(legacy flattened-shape row)로 cutover 하고 projected tree 를 후순위로 미뤘으나, **이는 사용자 요구(Skia 화면 = 직접 조작 editor)를 충족하지 못해 폐기됐다.** 본 절(projected tree)이 collection 의 **정상 도달 상태**이며, `skiaLegacy` 는 ADR-142 전환기 출발 상태일 뿐이다 — collection family cutover 가 본 절을 구현하는 것이 `cutover:"catalog"` 의 조건이다(projected-first, ⑩ roadmap).

빌더의 Skia 화면은 단순 미리보기가 아니라 **직접 조작 가능한 editor surface** 다. 사용자는 ListBox row 안의 Text 를 클릭해 선택하고, 더블클릭으로 drill-in 하거나 텍스트를 편집할 수 있어야 한다. 그러나 1,000/10,000 row 의 모든 하위 노드를 canonical 문서에 materialize 하면 document/history/IndexedDB/Skia scene 이 폭증한다(920 대안 B = CRITICAL). 해법은 **canonical 저장 노드와 projected 렌더/hit 노드를 분리**하는 것이다.

### projected node 모델

```ts
// render-space 전용 — canonical 문서에 저장되지 않는다
interface ProjectedNodeRef {
  kind: "projected";
  projectionId: string; // render-space id (canonical mutation target 아님)
  ownerNodeId: string; // collection canonical 노드 (ListBox/Table)
  templateNodeId: string; // template subtree 안의 원본 노드 (label/description/cell)
  itemKey?: string; // 어느 data item 의 투영인가
  columnKey?: string; // Table cell 의 column
  canonicalPath: string; // template subtree 안 경로
  role: "row" | "cell" | "container" | "text" | "icon" | "pseudo-part";
  editTarget: "template" | "data" | "override" | "origin" | "instance";
}

interface ProjectedTreeNode {
  ref: ProjectedNodeRef;
  bounds: Rect; // viewport-local (scrollOffset 차감 적용)
  children: ProjectedTreeNode[]; // 깊은 하위 노드 (flattened 아님)
  // 그리기는 buildCatalogShapes / SkiaPrimitiveDrawFn 그대로 재사용
}
```

projected tree 는 **`template subtree × visible data window`** 의 곱이다. template 1개를 visible window 의 각 data item 에 투영해 row 를 만들되, 각 row 는 flattened shape 가 아니라 **하위 Text/Icon/Cell 을 children 으로 가진 tree** 다. ④.7 의 window(`CollectionWindow`)가 어느 item 을 투영할지 결정하고, ④.11 의 generic 렌더(`buildCatalogShapes`)가 각 projected 노드를 그린다 — projected tree 는 새 그리기 경로가 아니라 **기존 generic 렌더의 입력 트리를 collection 에 대해 확장**한 것이다.

### hit-test · drill-in

```ts
interface SkiaSelection {
  kind: "canonical" | "projected";
  nodeId?: string; // canonical 선택
  projected?: ProjectedNodeRef; // projected 선택
  drillStack: string[]; // drill-in 경로 (Esc/breadcrumb 으로 pop)
}
```

| Gesture          | Target                    | Result                           |
| ---------------- | ------------------------- | -------------------------------- |
| click            | collection 배경           | canonical collection 선택        |
| click            | projected row             | row projection 선택              |
| click            | projected child Text/Icon | **deepest projected child 선택** |
| double-click     | projected row             | row subtree drill-in             |
| double-click     | bound projected Text      | data edit route(§5.11)           |
| Esc / breadcrumb | —                         | drill stack pop                  |

hit-test 노드 집합은 draw tree 와 **같은 window** 만 가진다(④.7). 화면 밖 row 의 하위 노드는 hit tree 에 진입조차 안 한다 — 10k row 에서도 hit 노드 수가 viewport window + overscan 에 비례(Gate G9).

### render-space id ↔ canonical write target 분리 (CRITICAL)

`projectionId` 는 **render-space 전용**이다. canonical mutation / history payload / IndexedDB 에 저장하면 데이터 corruption 이다 — 이는 **새 규칙이 아니라 ADR-135/136(`.claude/rules/canvas-rendering.md §9`) Render-Space Interaction Boundary 의 collection 적용**이다. projected 노드 편집은 §5.11 의 edit route 를 거쳐 canonical write target(template / data / item override / origin / instance)으로 명시 변환되며, projected id 가 canonical API 에 직접 유입되면 negative fixture 가 FAIL 한다(Gate G8). refresh 후 `elementsMap` 에 synthetic projectionId 는 0건이어야 한다.

> 본 절의 위험: **T-PROJECT**(projected/canonical boundary 위반 → corruption, Gate G8) + **T-DEEP**(깊은 노드 편집 UX 미달, Gate G9). ⑨.2 위험표 참조.

<a id="영역-5"></a>

# ⑤ Style & Properties Panel 연동 — 단일 공급원 generic Inspector

## 0. 1차 원리

Pencil canonical document 에서 **origin 노드 하나**(reusable frame)는 그 컴포넌트의 base 시각값을 담는다. 의미값(`content`/`variant`)과 시각값(`fontSize`/`fill`/`padding`/`gap`/`cornerRadius`)이 origin 노드 안에서는 평면으로 나란히 있다 — 단, 이것은 **base**(reusable 원본의 default)다. **사용자 override 는 같은 노드에 섞지 않고**, instance(`ref` 노드)의 `descendants[path]` 에 별도로 patch 된다(Pencil 노드 간 base/override 분리).

```jsonc
// origin 노드 = base (Pencil 실측, shadcn-design-system.json)
{ "type": "text", "content": "Button", "fontSize": 14, "fontWeight": "500",
  "fill": "$--secondary-foreground", "textAlign": "center" }
{ "type": "frame", "reusable": true, "name": "Button/Secondary",
  "fill": "$--secondary", "cornerRadius": 6, "padding": [8,16], "gap": 6,
  "alignItems": "center", "justifyContent": "center" }

// instance override 는 descendants 에 별도 (base 와 같은 노드에 안 섞음)
{ "type": "ref", "ref": "Button/Secondary",
  "descendants": { "label": { "props": { "style": { "fontSize": 16 } } } } }
```

composition 의 leaf 컴포넌트(Button 등)도 같은 구조로 내린다 — base 시각값은 theme rule(`resolveComponentRule(type, doc).sizes[size]`)에서 resolve 하고(노드에 안 박힘), 사용자 override 만 `node.props.style` 에 담는다. RAC 도 같은 결론을 준다 — RAC 컴포넌트는 Inspector 개념이 없다. 편집 가능한 것은 그 컴포넌트가 노출하는 prop surface(`variant`/`size`/`isDisabled`/`onPress`) + 시각 override(`props.style`)이고, 그 집합 자체가 "편집 대상" 의 SSOT 다.

→ **편집 패널은 컴포넌트당 코드가 아니다.** Inspector 는 선택 노드의 편집 계약 하나(의미 props ∪ 시각 override 키 공간)를 입력받아 필드를 그리는 **단일 generic renderer** 다. Properties Panel 과 Style Panel 은 그 하나의 계약을 `section` 태그로 필터링한 **두 view** 일 뿐이다.

---

## 1. 단일 공급원 + 두 view

### 1.1 공급원은 하나, view 는 둘

선택 노드의 편집 가능한 속성 전체는 `resolveEditContract(node)` 하나가 산출한다. Properties Panel 과 Style Panel 은 그 결과를 `section` 태그로 필터링한 두 화면이다.

```
                resolveEditContract(node, doc)
                = binding.accepts(의미 props) ∪ 보편 시각 속성(props.style 키 공간: geometry/layout/fill)
                = 단일 PropContract 집합               ← 공급원 하나 (저장 분리, 계약 합집합)
                          │
              buildInspectorFields(집합, theme)
                          │  (section 태그로 자동 그룹핑)
                          │  표시값 = props.style[k] ?? theme rule base[k]
          ┌───────────────┴────────────────┐
          ▼                                 ▼
  Properties Panel view              Style Panel view
  section ∈ {content, state}         section ∈ {transform, appearance, layout}
  variant / size / isDisabled        x / y / width / fill / stroke
  / label / children                 / cornerRadius / padding / gap / layout
  (편집 → node.props)                (편집 → node.props.style override)
```

한 패널에서 편집하든 다른 패널에서 편집하든 같은 노드를 mutate 하므로, 자기 편집이 다른 패널에 즉시 반영되고 round-trip 무손실이 구조적으로 보장된다. 두 패널이 "달라질" 물리적 경로가 없다.

### 1.2 도메인 분할(ADR-063)과의 관계 — 권위와 공급원은 직교

D1/D2/D3 분할은 **"각 값의 권위가 누구인가"** 를 정한다(D1 RAC 접근성 / D2 RSP props / D3 theme 시각). 이것은 **"편집 공급처를 몇 개 둘 것인가"** 와 직교한다.

- **권위는 보존**: `content`(D2) 와 `fontSize`(D3) 가 같은 노드에 속해도, 각 값의 권위는 자기 도메인에 있다. D1(ARIA/키보드/포커스)은 RAC 가 생성하므로 애초에 패널 편집 대상이 아니다.
- **공급원은 단일**: 편집 진입점은 노드 하나의 편집 계약. 도메인은 각 PropContract 의 `section` 태그로 표현되고, 패널은 그 태그로 필터링한 view 다.

즉 단일 공급원은 도메인 분할을 무효화하지 않는다 — 도메인을 태그로 흡수할 뿐이다. 또한 단일 공급원은 **저장 평면화를 요구하지 않는다** — 의미값(`props`)과 시각 override(`props.style`)가 분리 저장돼 있어도 `resolveEditContract` 가 한 계약 집합으로 합쳐 노출한다.

### 1.3 저장 = 의미 props + 시각 override layer

노드는 의미값을 `props` 에, 사용자 시각 override 를 `props.style`(override layer)에 갖는다. 시각 base 는 노드가 아니라 theme rule 에서 resolve 된다. `props.style` 키 존재=override, 키 부재=base 따름. 모든 노드(frame/text/ref/leaf RAC)가 같은 보편 시각 키 공간을 공유하고 컴포넌트별 typed 필드는 0이다 — 값만 다르다(CSS 처럼).

| 패널 view  | section                         | 편집 대상 키 (저장 위치)                                                                                                                          |
| ---------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Properties | content / state                 | `content` / `variant` / `size` / `isDisabled` / `isRequired` / `label` (→ `node.props`)                                                           |
| Style      | transform / appearance / layout | `x` / `y` / `width` / `height` / `fill` / `stroke` / `cornerRadius` / `padding` / `gap` / `layout` / `alignItems` (→ `node.props.style` override) |

Properties 편집은 `node.props` 의미 키를, Style 편집은 `node.props.style` override 키를 갱신한다(키가 생기면 base 를 덮어쓰고, reset 시 `delete` 로 base 복귀). 렌더 backend 는 base(theme rule) ⊕ override(`props.style`) 병합 시각값을 DOM(`toReactStyle(node)` → React `CSSProperties`) 또는 Skia(`toSkiaStyle(node)` → shape)로 단일 어댑터를 통해 투영한다. override 우선 병합, shorthand(`padding`)↔longhand 분배, Taffy 레이아웃 reader, token 참조 해소가 이 어댑터 한 곳에 모인다.

---

## 2. 편집 데이터 흐름 — 편집 → 단일 공급원 → 5 consumer

```
                          ┌─────────────────────────────────────────────┐
                          │  CanonicalNode (단일 공급원)                  │
                          │  props:  { content, variant, size, ... }      │
                          │  props.style: { fill, padding, ... } override │
                          │  theme rule (base — resolveComponentRule)     │
                          │  document.tokens   (theme 다축 색 토큰)       │
                          │  reusable 노드 propsSchema (조합 편집 계약)    │
                          └───────────────▲──────────────┬────────────────┘
                                          │ mutation     │ read (derive)
                  ┌───────────────────────┘              │
                  │                                       │
   ┌──────────────┴───────────────┐         ┌────────────▼──────────────────┐
   │  Inspector (편집 입력)         │         │  resolveCanonicalDocument()    │
   │  resolveEditContract(node,doc) │         │  → ResolvedNode tree           │
   │  → PropContract 집합 하나       │         │   (ref 펼침 + descendants merge)│
   │  buildInspectorFields(_, theme)│         └──┬─────────┬─────────┬────────┘
   │  ┌─ Properties view (content/state)         │         │         │
   │  └─ Style view (transform/appearance/layout)│         ▼         ▼
   │              │ onUpdate(patch)               ▼      ② Skia    ③ Publish
   └──────────────┼───────────────┐           ① DOM    toSkiaStyle  (DOM backend
                  │               │           toReact-  (node)        재사용)
                  ▼               │           Style(node)
   updateNode(id, patch)          └──► ④ Properties view  ⑤ Style view
                  │                     (같은 노드 재구독 — 자기 편집 즉시 반영)
                  ▼
   mergeIntoCanonicalDocument (canonical 1차)
   → _rebuildIndexes → persist (IndexedDB, bg)
```

5 consumer(DOM / Skia / Publish / Properties view / Style view)가 같은 노드 + 같은 theme rule 을 구독한다. 편집은 의미값(`props`) 또는 override(`props.style`) 키를 mutate → mutation 직후 5곳 동일. 시각 대칭의 보장점은 "노드에 박힌 computed" 가 아니라 **"두 backend 가 같은 노드 override + 같은 theme rule base 를 같은 어댑터로 병합(`override ?? base`)"** 이다.

---

## 3. resolveEditContract — 노드 → PropContract 집합 (단일 진입점)

Inspector 가 "이 노드는 어떤 필드를 편집하나" 를 얻는 **유일한 함수**. leaf/조합/native 를 한 곳에서 판정하고, 보편 속성을 합집합으로 병합해 단일 집합을 낸다. 컴포넌트당 분기 0.

```ts
// packages/shared/src/catalog/resolvers/resolveEditContract.ts
import type {
  CanonicalNode,
  CompositionDocument,
} from "../../types/composition-document.types";
import type { PropsSchema } from "../types";
import { getPrimitiveBinding } from "../bindings";
import {
  UNIVERSAL_GEOMETRY_CONTRACTS,
  LAYOUT_CONTRACTS,
} from "../styleContracts";

export interface EditContract {
  /** key → PropContract. buildInspectorFields 입력. 의미 props + 보편 속성 합집합. */
  contracts: PropsSchema;
  /** "primitive" | "instance" | "native". 편집 메커니즘 분기용 메타(필드 생성과 무관). */
  source: "primitive" | "instance" | "native";
  /** instance 일 때 참조 reusable 노드 id. */
  refId?: string;
}

/** 보편 속성(모든 노드 공통) — 단일 공급원에 항상 병합된다. */
function universalContracts(node: CanonicalNode): PropsSchema {
  const geo = { ...UNIVERSAL_GEOMETRY_CONTRACTS };
  // layout 가능 노드(frame/auto-layout)만 flex 계약 추가.
  if (canHaveLayout(node)) return { ...geo, ...LAYOUT_CONTRACTS };
  return geo;
}

export function resolveEditContract(
  node: CanonicalNode,
  doc: CompositionDocument | null | undefined,
): EditContract {
  const universal = universalContracts(node);

  // (1) instance — type:"ref" → 참조 reusable 의 propsSchema 가 의미 props source.
  if (node.type === "ref") {
    const refId = (node as { ref?: string }).ref;
    const reusable = refId ? findReusableNode(doc, refId) : undefined;
    const semantic = reusable ? readPropsSchema(reusable) : {};
    return {
      contracts: { ...semantic, ...universal },
      source: "instance",
      refId,
    };
  }

  // (2) leaf primitive — catalog binding.accepts.
  const binding = getPrimitiveBinding(node.type);
  if (binding) {
    return {
      contracts: { ...binding.props.accepts, ...universal },
      source: "primitive",
    };
  }

  // (3) native — frame/Slot. 의미 props 거의 없음, 보편 속성이 주 편집 대상.
  return {
    contracts: { ...NATIVE_PROP_CONTRACTS[node.type], ...universal },
    source: "native",
  };
}
```

`contracts` 는 의미 props 와 보편 속성을 합친 **단일 집합**이다. Properties view 와 Style view 는 이 하나를 `section` 태그로 나눠 그린다 — Style 전용 진입점이 따로 없다.

---

## 4. theme 기반 variant/size 값 집합

`PropContract.kind="variant"|"size"` 는 `options` 를 두지 않는다. 선택 가능 값은 **컴포넌트당 enum 이 아니라 theme 규칙** 에서 읽는다.

```ts
// variant/size 선택지를 theme(ComponentRule) 에서 — spec 참조 0.
export function createComponentRuleTheme(
  doc: CompositionDocument | null | undefined,
): InspectorFieldTheme {
  return {
    resolveDimensionOptions(
      componentType,
      _propKey,
      kind,
    ): InspectorFieldOption[] {
      const rule = resolveComponentRule(componentType, doc);
      if (!rule) return [];
      const keys =
        kind === "variant"
          ? Object.keys(rule.variants)
          : Object.keys(rule.sizes);
      return keys.map((value) => ({ value, label: inferLabel(value) }));
    },
  };
}
```

같은 Button binding 이 theme A 에선 `{primary, secondary}`, theme B 에선 `{primary, secondary, ghost}` 드롭다운으로 렌더된다 — 컴포넌트 코드 변경 0.

---

## 5. 필드 그룹핑 — section 은 PropContract 태그의 부산물

그룹은 컴포넌트가 선언한 섹션 목록이 아니라, 각 `PropContract.section` 태그로 **자동 집계** 된다. 두 패널이 같은 집합을 다른 section 부분으로 필터링한다.

```ts
// buildInspectorFields("Button", contracts, theme) →
// [
//   { section: "content",    fields: [{key:"content"}] },
//   { section: "appearance", fields: [{key:"variant",options:[...theme]},
//                                     {key:"size",options:[...theme]},
//                                     {key:"fill"},{key:"cornerRadius"}] },
//   { section: "state",      fields: [{key:"isDisabled"},{key:"isPending"}] },
//   { section: "transform",  fields: [{key:"x"},{key:"y"},{key:"width"},{key:"height"}] },
//   { section: "layout",     fields: [{key:"layout"},{key:"gap"},{key:"padding"},{key:"alignItems"}] },
// ]
//
// Properties view = content + state.   Style view = transform + appearance + layout.
```

`Button`, `TextField`, native `frame` 이 **같은 코드 경로** 로 서로 다른 그룹 구조를 자동 생성한다 — 컴포넌트당 SectionDef/Editor 파일 0.

---

## 6. instance(ref) 편집 — root override + descendants

instance 는 두 층위로 편집된다. 둘 다 같은 generic renderer 를 탄다.

1. **root props override**: instance 자체의 의미 props(예: Button instance 의 `variant`). 편집 계약 = 참조 reusable 의 `propsSchema`(§3 source="instance"). 저장 = `RefNode` 의 root override, resolver 가 reusable base 위에 merge.
2. **nested override**: instance 내부 자식 노드의 속성 변경. 저장 = `RefNode.descendants[path]` 3-mode(A 속성 patch / B 노드 교체 / C children 교체).

```ts
// instance 도 보편 속성 + (있으면) reusable propsSchema 로 같은 단일 집합을 받는다.
const { contracts, source, refId } = resolveEditContract(refNode, doc);
// source==="instance": onUpdate 가 root override 또는 descendants[path] patch 로 분기.
// 필드 생성은 leaf 와 100% 동일 — buildInspectorFields(contracts, theme).
```

자식 노드를 선택하면 그 자식이 다시 `resolveEditContract` 의 입력이 되어 같은 패널로 편집된다 — instance 내부도 일반 노드와 같은 단일 공급원 흐름.

---

## 7. derivedUpdateFn — 한 prop 변경이 복수 prop 갱신

일부 편집은 한 필드 변경이 다른 필드를 파생 갱신한다(예: layout `vertical`→`horizontal` 전환 시 gap 축 재배치). 이것도 컴포넌트당 코드가 아니라 binding 의 선언적 `derives` 로 generic 이 흡수한다.

```ts
// onUpdate 직전 applyDerives 가 binding.derives 를 적용 — 의미값(props)/override(props.style) 키 갱신.
const patch = applyDerives(node.type, rawPatch, node);
updateNode(node.id, patch); // 단일 공급원(노드) mutate
```

---

## 8. kind → control primitive 매핑

| `InspectorFieldKind`   | control primitive                               | 비고                    |
| ---------------------- | ----------------------------------------------- | ----------------------- |
| `string`               | `PropertyInput`                                 | `content`/`label`       |
| `number`               | `PropertyNumberInput` / `PropertyUnitInput`(px) | `x`/`padding`/`gap`     |
| `boolean`              | `PropertySwitch`                                | `isDisabled`            |
| `enum`                 | `PropertySelect`(contract.options)              | `type`/`layout`         |
| `variant`              | `PropertySelect`(**theme.options**)             | theme 규칙              |
| `size`                 | `PropertySizeToggle`(**theme.options**)         | theme 규칙              |
| `fillStyle`            | `PropertySelect`(고정)                          | fill/outline            |
| color(`fill`/`stroke`) | `PropertyColor`(token picker + hex)             | `$--accent` 또는 `#hex` |
| `icon`                 | `PropertyIconPicker`                            | icon name               |
| `binding`              | `PropertyBindingPicker`                         | collections             |

`fill`/`stroke` 같은 색 필드는 token 참조(`"$--accent"`) 와 직접값(`"#f5f5f5"`) 두 입력 모드를 갖고, `resolveToken(ref, doc)` 으로 실값 + 다축(Accent/Base/Mode) best-match 가 해소된다.

---

## 9. 시나리오 — Button `size="md"→"sm"` 편집

```
1. Properties Panel 에서 Button 노드 선택.
   resolveEditContract(node, doc)
     = { contracts: { ...buttonBinding.accepts, ...universal }, source: "primitive" }
   buildInspectorFields(contracts, componentRuleTheme(doc))
     → content:[content] / appearance:[variant,size,fill,cornerRadius] / state:[isDisabled,...]
       + transform/layout (Style view 쪽)
   size 필드 options = Object.keys(resolveComponentRule("Button",doc).sizes) = [xs,sm,md,lg,xl]
   현재값 "md".

2. "sm" 선택 → onUpdate({ size: "sm" }) → updateNode(id, { props: { size: "sm" } })
   → mergeIntoCanonicalDocument (의미값 props.size="sm" 갱신, 단일 공급원)

3. 5 consumer 가 같은 노드 + theme rule 을 재구독 → 즉시 동일 반영:
   ① DOM:        toReactStyle(node) + data-size="sm" → CSS [data-size=sm]{font-size:14px}
   ② Skia:       toSkiaStyle(node) → props.style.fontSize ?? rule.sizes.sm.fontSize = 14
                 → CanvasKit paragraph.fontSize = 14
   ③ Publish:    DOM backend 재사용 → font-size:14px
   ④ Properties: size 필드 "sm" 표시 (같은 노드 재구독)
   ⑤ Style:      transform/layout view 동일 노드 재구독, fontSize 표시 = base 14 (override 없음)
   → 5곳 모두 fontSize=14. 공급원(노드 size + theme rule base)을 바꾸면 5곳 한 번에 바뀐다.

   [override 케이스] 사용자가 Style Panel 에서 fontSize=16 직접 입력:
     → updateNode(id, { props: { style: { fontSize: 16 } } })  (override layer)
     → ①②③ 모두 16 (props.style.fontSize 우선). size 를 md 로 바꿔도 16 유지(override 키 존재).
     → reset 클릭 → delete props.style.fontSize → 다시 base(rule.sizes[size].fontSize) 따름.
```

---

## 10. Inspector 정본 — 컴포넌트당 분기 0

| 축              | 정본                                                             |
| --------------- | ---------------------------------------------------------------- |
| 편집 진입점     | `resolveEditContract(node)` 하나                                 |
| 패널 공급원     | 단일 PropContract 집합의 두 view (`section` 필터)                |
| 섹션 정의       | `PropContract.section` 태그 자동 집계                            |
| variant/size 값 | theme(`ComponentRule`) keys                                      |
| 저장            | 의미값 `props` + 사용자 override `props.style` (base=theme rule) |
| base/override   | base=theme rule, override=`props.style` 키 (노드 간 분리)        |
| 컴포넌트당 코드 | 0                                                                |

## 11. Projected child 편집 route — collection 깊은 노드의 write 변환 (ADR-920 흡수)

§4.12 의 projected 노드는 **저장 노드가 아니므로 직접 편집할 수 없다.** projected 노드 편집은 어느 canonical write target 으로 갈지 명시 변환된다. 기존 §6(instance ref root override + descendants)이 **저장된 instance** 를 다뤘다면, 본 절은 **projected(render-space) 노드 편집**을 canonical write 로 라우팅하는 계약이다.

```ts
type EditRoute =
  // 기존 910 §6 영역 — 저장 노드 대상
  | { kind: "origin"; originNodeId: string; patch: Patch } // reusable origin (+ impact 확인)
  | { kind: "instance"; refNodeId: string; patch: Patch } // ref descendants[path] override
  // ADR-920 흡수 — projected(render-space) 노드 대상
  | { kind: "template"; nodeId: string; patch: Patch } // template subtree 편집 → 모든 visible row 반영
  | {
      kind: "data";
      ownerNodeId: string;
      itemKey: string;
      field: string;
      value: unknown;
    } // 텍스트 내용
  | {
      kind: "override";
      ownerNodeId: string;
      itemKey: string;
      templateNodeId: string;
      patch: Patch;
    }; // 이 row 만
```

### 기본 write policy

| 편집 행위                                   | route              | 효과                                                      |
| ------------------------------------------- | ------------------ | --------------------------------------------------------- |
| projected Text 내용 편집 (더블클릭)         | **data**           | data item 의 field 갱신 — 모든 consumer 가 같은 data 소비 |
| projected child 의 style/layout 편집        | **template**(기본) | template subtree 편집 → visible row 전체 반영             |
| 특정 row 만 시각 변경 ("Override this row") | **override**       | 해당 item projection 에만 patch (item override)           |
| ref instance 선택 후 편집                   | **instance**       | §6 descendants[path] (변경 없음)                          |
| reusable origin 편집                        | **origin**         | §6 origin + impacted instance 확인 (변경 없음)            |

style edit 의 **기본값이 template route** 인 것이 핵심이다 — collection 편집의 자연스러운 mental model 은 "이 컬렉션의 모든 행을 이렇게"이고, "이 행만"은 명시적 override 선택이다. 이는 920 의 write policy 를 910 의 base/override 2층 schema(HC#3)에 정합시킨 것이다: template = base layer 편집, override = 특정 projection 의 override layer 편집.

### render-space id 분리 유지

모든 route 는 `ProjectedNodeRef.projectionId`(render-space) 를 `ownerNodeId` + `templateNodeId` + `itemKey`(canonical-space)로 변환한 뒤에만 mutation 을 발행한다. projectionId 가 mutation payload 에 그대로 실리면 Gate G8 negative fixture FAIL. 이 변환은 ADR-135/136 의 `resolveCanonicalMoveTarget` 패턴과 동형이며, page frame Slot 편집은 그 자체가 ADR-135/136 관할이므로 본 절은 collection projected 노드에 한정한다.

<a id="영역-6"></a>

## ⑥ Publishing / Preview 데이터 흐름

Preview(빌더 내부 iframe)와 Publish(배포 앱)는 **같은 canonical 문서에서, 같은 resolve 함수로, 같은 DOM backend** 를 거친다. 두 surface 의 차이는 진입점(문서 출처)과 런타임 권한(편집 vs 읽기 전용)뿐이며, "노드 → 화면" 변환 경로는 단일이다. 이 단일성이 시각 대칭의 정의다.

```
CompositionDocument
   │  resolveCanonicalDocument(doc, cache, imports)
   ▼
ResolvedNode[]                 ← ref 펼침 + descendants merge + slot 채움 1회
   │  CanonicalNodeRenderer (generic traversal)
   │     ├─ toRacProps(node, binding)      → RAC 권한 투영 (ARIA/키보드/포커스)
   │     └─ toReactStyle(node)             → React CSSProperties (base⊕override 시각 투영)
   ▼
DOM (RAC primitive + CSS 토큰)
   │  Preview: iframe / Publish: 동일 backend 재사용
   ▼
화면
```

### ⑥.1 canonical resolve — 단일 진입점

`resolveCanonicalDocument(doc, cache?, imports?)` 가 문서 top-level children 을 `ResolvedNode[]` 로 펼친다. 처리 순서는 고정이다.

```ts
// apps/builder/src/resolvers/canonical/index.ts
export function resolveCanonicalDocument(
  doc: CompositionDocument,
  cache?: ResolverCache,
  imports?: ImportResolverContext,
): ResolvedNode[] {
  return doc.children.map((node) => resolveNode(node, doc, cache, imports));
}
```

처리 순서 (`ref resolve → descendants apply → slot contract validate → resolved tree`):

1. **ref resolve** — `{ type: "ref", ref }` 노드는 `findReusableMaster(doc, ref, imports)` 로 reusable origin 노드(`reusable: true`)를 찾아 `resolveCanonicalRefProps(master, refNode)` 로 master 의 base(의미값+시각 override)와 instance 의 root override 를 머지한다. master 의 type 으로 노드를 "열어주고"(`resolvedBase.type = master.type`), 원본 추적용 `_resolvedFrom: refNode.ref` 를 주입한다.
2. **descendants apply** — `refNode.descendants[nodeId]` 의 3-mode override 를 master subtree 에 적용한다. 속성 patch(의미값은 `props`, 시각값은 `props.style` override layer 부분 덮어쓰기) / 노드 교체(`{ type: "ref", ref }` 로 자식을 다른 reusable 로 swap) / `enabled: false`(렌더 제외). override 된 키 경로 목록은 `_overrides: ["props.style.fill", "props.content"]` 로 주입되어, Properties Panel 의 "원본과 다름" 마커에 그대로 쓰인다 — 이 마커가 곧 base/override 분리의 가시화다.
3. **slot contract validate** — slot host 노드의 `{ slot: [ids] }` 가 채운 자식 배열을 `isSlotCandidateAllowed` 로 검증한 뒤 resolved 자식으로 통과시킨다.
4. **resolved tree** — 위 결과를 `ResolvedNode` 트리로 산출. `ResolvedNode` 는 `CanonicalNode` 를 상속하고 `_resolvedFrom` / `_overrides` 두 메타 필드만 추가하며, 둘 다 `_` prefix 라 직렬화 시 strip 된다. resolve 출력도 입력과 같은 형상(의미값 `props` + 시각 override `props.style`)을 유지한다 — resolve 는 base⊕override 를 합성하되 저장 구조(`props`/`props.style` 분리)를 평면으로 뭉개지 않는다.

resolve 출력 노드는 입력과 같은 형상을 유지한다. `content`/`variant`/`size` 같은 의미값은 `props` 에, `fill`/`fontSize`/`padding`/`gap`/`cornerRadius` 같은 사용자 시각 override 는 `props.style` 에 있으며, 시각 base 는 theme rule 에서 resolve 된다 — resolve 는 base⊕override 를 어댑터 단에서 병합하고 저장 구조를 평면으로 뭉개지 않는다.

#### 공유 캐시 — Preview·Skia 동일 인스턴스

`ResolverCache` 는 Preview iframe 과 Skia sprite 가 **동일 인스턴스를 공유**한다. 한 입력 조합에서 같은 resolved subtree 가 나오는 것을 캐시가 보장하므로, 두 backend 가 서로 다른 resolve 결과를 받을 수 없다.

```ts
// 캐시 키 = 4-tuple (canonical-resolver.types.ts)
type ResolverCacheKey = readonly [
  docVersion: string,
  rootRefId: string,
  descendantsFingerprint: string, // computeDescendantsFingerprint(ref.descendants)
  slotBindingFingerprint: string, // computeSlotBindingFingerprint(slotChildren)
];
```

무효화 단위는 ref root 기준 subtree 다. descendants override 한 경로만 바뀌면 `invalidateSubtree(rootRefId)` 로 해당 instance 의 resolved subtree 만 dirty 처리하고 형제 ref instance 는 cache hit 을 유지한다. 조상 ref 로의 전파는 (a) 자식 ref 가 다른 reusable 로 교체 (b) slot children 배열 구조 변경 두 경우뿐이며, 속성/override patch 는 subtree 내부에만 머문다. 문서 교체나 `docVersion` 변경 시 `invalidateAll()`.

#### import 그래프 resolve

외부 canonical 문서 참조는 `<importKey>:<nodeId>` ref id 로 표현된다. `parseCompositionImportReference(refId)` 가 `{ importKey, nodeId }` 로 분해하고, `ImportResolverContext.resolveImportDocument(importKey, source)` 가 이미 로드된 외부 문서를 동기 반환한다. core resolver 는 fetch/prefetch 를 하지 않고 컨텍스트가 넘긴 loaded 문서만 소비한다 — 외부 문서 로드 정책은 runtime adapter 책임이다. import key 는 `/^[A-Za-z][A-Za-z0-9_-]*$/` 패턴이고 reserved key 를 배제한다(`assertCompositionImportKey`).

### ⑥.2 Preview — generic traversal + 단일 어댑터 투영

`CanonicalNodeRenderer` 가 `ResolvedNode` 트리를 받아 generic 으로 순회한다. 컴포넌트별 분기 없이 노드 type 에 대응하는 단일 catalog 경로로 렌더한다.

```ts
// apps/builder/src/preview/components/CanonicalNodeRenderer.tsx (catalog 경로)
const binding = getPrimitiveBinding(type);
const PrimitiveComponent =
  binding.source.kind === "rac"
    ? (RAC as Record<string, React.ElementType>)[binding.source.component]
    : INTERNAL_RENDERERS[binding.source.renderer];

const { children: racChildren, ...racRest } = toRacProps(node, binding);
return (
  <PrimitiveComponent
    key={node.id}
    data-canonical-id={node.id}
    data-element-id={node.id}
    {...racRest}
    style={toReactStyle(node)}
  >
    {node.children?.map((child) => (
      <CanonicalNodeRenderer key={child.id} node={child} ... />
    ))}
  </PrimitiveComponent>
);
```

투영은 두 어댑터로 직교 분리된다.

- **`toRacProps(node, binding)` — RAC 권한 투영 (D1)**. 노드의 의미값(`content`/`variant`/`size`/`isSelected` 등)과 `PrimitiveBinding.props.accepts` 계약을 RAC primitive props 로 변환한다. ARIA/키보드/포커스/collection 동작은 RAC 가 100% 소유하고, composition 은 enum 변형을 `data-*` attribute 로만 흘려보낸다. RAC primitive 는 `binding.source.kind` 로 분기한다 — `rac` 는 `RAC[component]`, `internal` 은 `INTERNAL_RENDERERS[renderer]`(Icon=Lucide SVG, collection wrapper 등 RAC 으로 환원 불가능한 leaf).
- **`toReactStyle(node)` — 시각 투영 (D3)**. base(theme rule) ⊕ override(`node.props.style`)를 병합한 resolved 시각값을 `React.CSSProperties` 로 변환하는 단일 어댑터다. override 우선 병합(`props.style[k] ?? rule.resolve(k)`), shorthand↔longhand 분배(`gap`→`rowGap`/`columnGap`, `padding`→`padding{Top,Right,Bottom,Left}`), `resolveToken` 토큰 해소, fill→background 변환(`fillsToCssBackgroundStyle`)이 이 한 곳에 수렴한다. Properties Panel·Style Panel·DOM·Skia 가 다른 어댑터를 쓰지 않으므로, 같은 노드는 어디서 읽어도 같은 시각으로 투영된다.

```ts
// toReactStyle — base(theme rule) ⊕ override(props.style) → React CSSProperties (단일 어댑터)
export function toReactStyle(
  node: ResolvedNode,
  rule: ComponentRule,
  size: ComponentRuleSize,
): React.CSSProperties {
  const ov = node.props?.style ?? {}; // 사용자 override layer (키 있으면 base 덮어씀)
  return {
    // override(props.style) 우선, 없으면 theme rule base
    ...fillsToCssBackgroundStyle(ov.fill ?? rule.variant.fill.base),
    fontSize: resolveToken(ov.fontSize ?? size.fontSize),
    paddingTop: resolveToken(ov.paddingTop ?? size.paddingY), // longhand(ADR-909) 우선
    paddingRight: resolveToken(ov.paddingRight ?? size.paddingX),
    paddingBottom: resolveToken(ov.paddingBottom ?? size.paddingY),
    paddingLeft: resolveToken(ov.paddingLeft ?? size.paddingX),
    rowGap: resolveToken(ov.rowGap ?? ov.gap ?? size.gap),
    columnGap: resolveToken(ov.columnGap ?? ov.gap ?? size.gap),
    borderRadius: resolveToken(ov.cornerRadius ?? size.borderRadius),
  };
}
```

`resolveToken` 은 Pencil 다축(Accent×Base×Mode) best-match 로 토큰을 해소한다. base 시각값(`size.fontSize` 등)은 `resolveComponentRule(type, doc)` 가 build-time 생성 `COMPONENT_RULES_TABLE` 에서 조회한 rule 에서 오고, 사용자 override(`props.style`)가 있으면 그 키만 base 를 덮어쓴다 — 키가 없으면 base 따름, reset 시 `delete props.style[k]` 로 base 복귀. `variant`/`size` 선택지는 컴포넌트 enum 이 아니라 그 rule 의 `{ variants, sizes }` keys 다.

#### cutover 집합

generic catalog 경로의 적용 범위는 `cutoverPrimitives` 집합으로 제어된다. App.tsx 가 `getCatalogCutoverTypes()` 로 catalog 상태(`"catalog"`)인 type 집합을 만들어 renderer 에 전달하고, family 단위 atomic cutover 가 type 을 catalog 로 옮기면 해당 노드는 자동으로 generic 경로로 렌더된다.

### ⑥.3 Publish — 동일 DOM backend 재사용

Publish 앱은 Preview 와 같은 `resolveCanonicalDocument` → `CanonicalNodeRenderer` 흐름을 재사용한다. 차이는 세 가지뿐이다.

1. **문서 출처** — Preview 는 빌더 store 가 hydrate 한 활성 canonical 문서를, Publish 는 배포된 정적 문서(`loadProjectFromUrl` / `loadProjectFromFile`)를 입력으로 받는다. 어느 쪽이든 `CompositionDocument` 형상이라 resolve 입력이 동일하다.
2. **런타임 권한** — Publish 는 읽기 전용이므로 `_overrides` dot 마커·`data-canonical-id` 같은 편집 보조 메타를 소비하지 않는다(직렬화 단계에서 `_` prefix 필드 strip).
3. **데이터/이벤트 활성** — Publish 는 `useCollectionData({ datatableId | dataBinding })` 로 실데이터를 채우고(collection wrapper 의 `useAsyncList` 경유), 이벤트 핸들러를 실제 실행한다.

이벤트/액션은 `x-composition` extension 으로 분리된 root collection 이다. UI 노드의 `props.<eventName>`(예: `props.onPress`)가 `CompositionDocument.events[]` 의 `SerializedEvent.id` 를 string 으로 참조하고, runtime 이 `target === nodeId` 인 entries 를 filter 한 뒤 `actionRef` 로 `CompositionDocument.actions[]` 의 chain head action 으로 진입한다(`SerializedAction.next[]` 로 chain 구성). function callback / React runtime 객체는 직렬화하지 않으며, 모든 동작은 stable id 참조 그래프로만 표현된다.

```ts
interface SerializedEvent {
  id: string; // props.<eventName> 참조 대상
  type: "event";
  kind: string; // "onPress" / "onSelectionChange" / "onChange"
  target: string; // event 발생 대상 UI node id
  actionRef?: string; // chain head action id (actions[].id)
}
```

### ⑥.4 SSR / import 그래프 경계

배포 산출물의 import 경계는 단방향이다.

- **core resolver 는 순수 함수** — `resolveCanonicalDocument` 와 두 어댑터(`toRacProps` / `toReactStyle`)는 `CompositionDocument` / `ResolvedNode` / `PrimitiveBinding` 타입과 `COMPONENT_RULES_TABLE`(build-time 생성)만 import 한다. store / fetch / DOM API 의존이 없어 서버에서 그대로 실행 가능하다.
- **외부 문서 로드는 adapter 경계 바깥** — import ref(`<importKey>:<nodeId>`) 의 외부 문서 fetch/prefetch 는 `ImportResolverContext` 를 주입하는 runtime adapter 가 담당하고, resolver 는 loaded 문서만 동기 소비한다. 이로써 SSR 단계에서 외부 문서를 미리 로드해 컨텍스트로 넘기면 resolve 가 비동기 없이 완결된다.
- **DOM backend 단일** — Preview 와 Publish 가 같은 `CanonicalNodeRenderer` 를 공유하므로 서버 렌더(`renderToString`)와 클라이언트 hydrate 가 동일 트리를 산출한다. RAC primitive 의 ARIA 마크업이 서버/클라이언트에서 동형이라 hydration mismatch 가 발생하지 않는다.

패키지 의존 방향은 `specs ← shared ← builder/publish` 를 따른다. 시각 투영 어댑터·catalog 타입·resolver core 는 `shared` 에 두고, Preview/Publish 의 surface 별 wiring(문서 출처·런타임 권한)만 각 app 에 둔다.

<a id="영역-7"></a>

## ⑦ 대표 컴포넌트 Format 예시 — Button / Checkbox / ListBox / Table / Select

이 영역은 다섯 대표 컴포넌트가 노드 데이터(의미 props + 시각 override) + binding 위에서 **어떻게 동일한 메커니즘으로 표현되는가**를 보인다. 다섯 컴포넌트는 leaf 와 reusable, single 과 collection, inline 과 overlay 를 모두 가로지르지만 — 데이터 형상(의미 `props` + override `props.style`, base=theme rule), 편집 진입점(`resolveEditContract`), 렌더 어댑터(`toReactStyle`/`toSkiaStyle`)는 전부 같다. 컴포넌트별로 갈리는 것은 **값과 binding 한 줄**뿐이다.

### 공통 토대 — 모든 예시가 같은 형상 위에 선다

세 가지를 먼저 고정한다. 이후 다섯 예시는 이 토대 위에서 **값만 다르게** 채워진다.

**(1) 노드 — 의미 props + 시각 override layer.** 노드는 의미값(`content`/`variant`/`size`/`fillStyle`)을 `props` 에, 사용자 시각 override(`fontSize`/`fill`/`padding`/`gap`/`cornerRadius`)를 `props.style` 에 갖는다. 시각 base 는 노드가 아니라 theme rule 에서 resolve 된다 — `props.style` 키 존재=override, 부재=base 따름.

```ts
// 모든 type 이 같은 보편 속성 키 공간을 공유 (CSS 처럼 — 값만 다름)
interface CanonicalNode {
  id: string;
  type: string; // "Button" | "Checkbox" | "ListBox" | ... (frame/text/ref/leaf 모두 동형)
  props: {
    // 의미값 (variant/size/content …) + 시각 override layer (style)
    style?: Record<string, unknown>; // 사용자가 base 를 덮어쓴 시각 키만. base 는 theme rule.
    [k: string]: unknown;
  };
  children?: string[];
}
```

**(2) 단일 공급원 — 두 view 는 같은 노드를 필터링한 것.** Properties Panel 과 Style Panel 은 별도 store/공급처가 없다. 둘 다 같은 노드 하나를 공급원으로 `resolveEditContract(node)` 단일 진입점에서 편집 필드를 얻고, `PropContract.section` 태그로 필터링한 두 view 일 뿐이다.

```ts
// resolveEditContract — leaf 면 binding.accepts, reusable 이면 propsSchema.
// buildInspectorFields 가 section 태그로 묶어 두 view 로 필터링.
function resolveEditContract(
  node: CanonicalNode,
): Record<string, PropContract> {
  const entry = getCatalogEntry(node.type);
  return entry.kind === "primitive"
    ? entry.binding.props.accepts // leaf
    : reusablePropsSchema(entry.reusableId); // reusable 문서의 x-composition.propsSchema
}
```

`buildInspectorFields(type, contracts, theme)` 는 `section` 키(`content`/`appearance`/`state`/`locale`)로 그룹을 first-appearance 순서로 묶는다. Properties Panel = `content`+`state`+`locale` 그룹, Style Panel = `appearance` 그룹. 같은 `contracts` 객체에서 갈라진 두 필터일 뿐 공급처가 둘이 아니다.

**(3) 렌더 — generic traversal 1개 + backend 2개.** generic 렌더러가 노드 트리를 traversal 하면서 각 노드의 base(theme rule) ⊕ override(`props.style`) 병합 시각값을 단일 어댑터로 backend 형식에 투영한다. DOM 은 `toReactStyle(node)`, Skia 는 `toSkiaStyle(node)`. override 우선 병합, shorthand↔longhand 정규화, Taffy reader, token 해소(`resolveToken` Pencil 다축 best-match)가 전부 이 어댑터 한 곳에 수렴한다.

```ts
function toReactStyle(node: CanonicalNode): React.CSSProperties {
  /* 평면 → CSS, token 해소 */
}
function toSkiaStyle(node: CanonicalNode): SkiaStyle {
  /* 평면 → Skia paint, 같은 token 해소 */
}
```

variant/size 같은 시각 차원의 선택지는 컴포넌트 enum 하드코딩이 아니라 `resolveComponentRule(type, doc)` 이 돌려주는 `ComponentRule.variants`/`sizes` 의 keys 다 — theme 가 값 집합의 공급원이다.

---

### 7-1. Button — leaf binding (아이콘 조합 = reusable frame)

#### (a) leaf binding

Button 은 RAC `<Button>` 위에 얹힌 leaf 다. `accepts` 는 RAC Button 의 D2 surface 로만 한정된다 — 의미값 `children`, 시각 차원 `variant`/`size`/`fillStyle`, RAC 상태 `type`/`isPending`/`isDisabled`.

```ts
export const buttonBinding: PrimitiveBinding = {
  source: {
    kind: "rac",
    package: "react-aria-components",
    importPath: "react-aria-components",
    component: "Button",
  },
  props: {
    accepts: {
      children: { kind: "string", label: "Text", section: "content" },
      variant: {
        kind: "variant",
        label: "Variant",
        section: "appearance",
        default: "primary",
      },
      size: {
        kind: "size",
        label: "Size",
        section: "appearance",
        default: "md",
      },
      fillStyle: {
        kind: "fillStyle",
        label: "Fill Style",
        section: "appearance",
        default: "fill",
        options: [
          { value: "fill", label: "Fill" },
          { value: "outline", label: "Outline" },
        ],
      },
      type: {
        kind: "enum",
        label: "Type",
        section: "state",
        default: "button",
        options: [
          { value: "button", label: "Button" },
          { value: "submit", label: "Submit" },
          { value: "reset", label: "Reset" },
        ],
      },
      isPending: { kind: "boolean", label: "Pending", section: "state" },
      isDisabled: { kind: "boolean", label: "Disabled", section: "state" },
    },
    toRacProps: "default",
  },
};
```

`variant`/`size` 는 `options` 가 없다 — 선택지는 `resolveComponentRule("Button", doc).variants`/`sizes` 의 keys 에서 온다.

**아이콘이 붙은 Button = reusable frame.** "아이콘 + 텍스트" 같은 조합은 leaf binding 에 `iconName`/`iconPosition` 을 묶지 않는다. 조합은 데이터다 — reusable:true frame 노드 문서로, Button leaf 노드와 Icon leaf 노드를 children 으로 합성한 평면 트리다.

```ts
// reusable frame (origin) — 코드 정의 없음, canonical 문서
const iconButtonReusable = {
  type: "frame",
  reusable: true,
  props: { display: "flex", gap: 8, alignItems: "center", padding: 12 }, // props.style override 키 (base=theme rule)
  children: ["icon-node", "button-text-node"],
};
// 배치 시 instance = { type: "ref", ref: "icon-button-reusable" }, descendants 로 override
```

componentCatalog 등록: `{ kind: "primitive", type: "Button", family: "primitives", binding: buttonBinding }`. 아이콘 조합은 별도 catalog entry 없이 reusable 문서 id 로 팔레트에 노출된다.

#### (b) Properties Panel + Style Panel 노출 필드 (단일 공급원의 두 view)

| 필드                                       | kind               | section    | view           | 값 공급                                                                                   |
| ------------------------------------------ | ------------------ | ---------- | -------------- | ----------------------------------------------------------------------------------------- |
| `children`                                 | string             | content    | **Properties** | node.props.style override 키                                                              |
| `type`                                     | enum               | state      | **Properties** | contract.options                                                                          |
| `isPending`                                | boolean            | state      | **Properties** | node.props 의미 키                                                                        |
| `isDisabled`                               | boolean            | state      | **Properties** | `node.props` 의미 키                                                                      |
| `variant`                                  | variant            | appearance | **Style**      | `resolveComponentRule("Button").variants` keys                                            |
| `size`                                     | size               | appearance | **Style**      | `resolveComponentRule("Button").sizes` keys                                               |
| `fillStyle`                                | fillStyle          | appearance | **Style**      | contract.options (fill/outline)                                                           |
| `fontSize`/`fill`/`padding`/`cornerRadius` | (시각 override 키) | appearance | **Style**      | `node.props.style` override (base=theme rule) — `toReactStyle`/`toSkiaStyle` 가 병합 투영 |

두 view 모두 같은 노드(`props` + `props.style`) 와 같은 `resolveEditContract` 결과를 읽는다. `appearance` 태그만 Style Panel 로, 나머지는 Properties Panel 로 필터링된다. Style 표시값은 `props.style[k] ?? rule base[k]` (override 우선).

#### (c) Skia 렌더

generic 렌더러가 Button 노드를 traversal 할 때, 그 type 을 읽지 않는다. `buildCatalogShapes(visual, props, size, state, textDecoration)` 가 보편 box+text(bg roundRect + border + text)를 그린다 — 색/크기/형태는 caller(builder)가 `resolveComponentRule("Button", doc)` 에서 해소해 주입한 `ComponentVisualRule`(`fill`/`text`/`border` 등) + `ComponentRuleSize` 에서 읽는다.

```ts
// builder dispatch — Skia 측 색상 source 단일 진입점
const rule = resolveComponentRule(node.type, doc); // "Button" 식별 분기 아님
const visual = resolveSkiaVisualRule(
  node.type,
  node.props.variant as string | undefined,
);
const shapes = buildCatalogShapes(
  visual,
  node.props,
  rule.sizes[size],
  state,
  rule.textDecoration,
);
```

`fillStyle: "outline"` 이면 `buildCatalogShapes` 가 `fill.outline` subset(base 미정의 시 `{color.transparent}`) + `outlineText`/`outlineBorder` 를 소비한다 — DOM 의 `[data-fill-style="outline"]` theme CSS 와 같은 시각 결과. 아이콘 조합 reusable frame 은 frame 노드(box shell)로 그려지고 child Icon 노드는 `skiaPrimitive: "icon_font"` draw module 이 Lucide glyph 단일 shape 로, child text 노드는 `nodeRendererText`(CanvasKit Paragraph)가 그린다. flat RenderCommand 스트림(`ELEMENT_START` … `CHILDREN` … `ELEMENT_END`)으로 합성된다.

---

### 7-2. Checkbox — leaf binding (indicator slot)

#### (a) leaf binding

RAC `<Checkbox>` 가 indicator + label slot 을 합성한다(D1). leaf binding 은 의미값 `children`(label) + 시각 차원 + RAC selection 상태만 받는다.

```ts
export const checkboxBinding: PrimitiveBinding = {
  source: {
    kind: "rac",
    package: "react-aria-components",
    importPath: "react-aria-components",
    component: "Checkbox",
  },
  rac: {
    primitive: "Checkbox",
    parts: ["checkbox", "indicator", "label"],
    slots: [],
    states: ["isSelected", "isIndeterminate", "isDisabled", "isInvalid"],
    dataAttributes: [
      "data-selected",
      "data-indeterminate",
      "data-disabled",
      "data-invalid",
    ],
  },
  props: {
    accepts: {
      children: { kind: "string", label: "Label", section: "content" },
      variant: {
        kind: "variant",
        label: "Variant",
        section: "appearance",
        default: "default",
      },
      size: {
        kind: "size",
        label: "Size",
        section: "appearance",
        default: "md",
      },
      isSelected: { kind: "boolean", label: "Selected", section: "state" },
      isIndeterminate: {
        kind: "boolean",
        label: "Indeterminate",
        section: "state",
      },
      isDisabled: { kind: "boolean", label: "Disabled", section: "state" },
      isInvalid: { kind: "boolean", label: "Invalid", section: "state" },
    },
    toRacProps: "default",
  },
  skiaPrimitive: "checkbox", // box + checkmark indicator — box+text 로 표현 불가
};
```

RAC 의 indicator/label slot 은 RAC 가 100% 소유한다(D1). composition 은 `toRacProps(node, binding)` 로 노드 평면 props 를 RAC props 로 투영만 한다 — `isSelected`/`isIndeterminate` 는 RAC props 로, `variant`/`size` 는 `data-variant`/`data-size` 속성으로 라우팅된다(theme 가 `data-*` 로 시각 적용).

#### (b) Properties Panel + Style Panel 노출 필드

| 필드                                   | kind               | section    | view                            |
| -------------------------------------- | ------------------ | ---------- | ------------------------------- |
| `children` (label)                     | string             | content    | **Properties**                  |
| `isSelected`                           | boolean            | state      | **Properties**                  |
| `isIndeterminate`                      | boolean            | state      | **Properties**                  |
| `isDisabled` / `isInvalid`             | boolean            | state      | **Properties**                  |
| `variant`                              | variant            | appearance | **Style** (theme variants keys) |
| `size`                                 | size               | appearance | **Style** (theme sizes keys)    |
| `fill`/`cornerRadius` (indicator 시각) | (시각 override 키) | appearance | **Style**                       |

#### (c) Skia 렌더

indicator(box + checkmark)는 box+text 로 표현 불가능한 비-DOM-trivial primitive 다. dispatch 가 `binding.skiaPrimitive` 유무로 갈려 `buildCatalogShapes` 대신 `skiaPrimitives.ts` 의 `"checkbox"` draw module 이 box + checkmark 를 그린다. 색은 `resolveComponentRule("Checkbox")` 의 fill/selected 토큰을 `resolveToken` 으로 해소(dark mode 자동 반전 보존). label 은 자식 text 노드가 `nodeRendererText` 로 그린다. RAC 의 `slot="selection"` / `data-selected` render-prop state 는 DOM 측 시각 전환을, Skia 측은 `props.isSelected === true` 분기가 같은 selected 색을 emit 해 두 backend 시각 결과가 일치한다.

---

### 7-3. ListBox — collection (RAC data/render + virtualization)

#### (a) leaf binding

collection 은 RAC raw 가 아니라 composition wrapper 가 D1 을 담당한다(`source.kind: "internal"`). wrapper 가 `useCollectionData({ dataBinding })` 로 items 를 채우고 RAC `<ListBox>` + `<Collection items>` 렌더 함수로 Node tree 를 합성한다 — RAC data/render 분리.

```ts
export const listBoxBinding: PrimitiveBinding = {
  source: { kind: "internal", renderer: "listbox" },
  props: {
    accepts: {
      dataBinding: { kind: "binding", label: "Data", section: "content" },
      variant: {
        kind: "variant",
        label: "Variant",
        section: "appearance",
        default: "default",
      },
      size: {
        kind: "size",
        label: "Size",
        section: "appearance",
        default: "md",
      },
      selectionMode: {
        kind: "enum",
        label: "Selection Mode",
        section: "state",
        default: "single",
        options: [
          { value: "none", label: "None" },
          { value: "single", label: "Single" },
          { value: "multiple", label: "Multiple" },
        ],
      },
      isDisabled: { kind: "boolean", label: "Disabled", section: "state" },
    },
    toRacProps: "default",
  },
};
```

items 는 canonical children 트리가 아니라 collections root(`useCollectionData`)가 소유한다 — `kind: "binding"` 으로 데이터 결합만 가리킨다. RAC `<ListBox>` 가 `<Collection items={list.items}>{(item) => <ListBoxItem/>}</Collection>` 로 Node tree 와 virtualization 을 자동 합성한다. item 별 selected 시각은 RAC `composeRenderProps`/`{isSelected}` render-prop state + `slot="selection"` 가 담당하고, composition 은 theme CSS 토큰으로만 색을 입힌다.

#### (b) Properties Panel + Style Panel 노출 필드

| 필드                                   | kind               | section    | view                                   |
| -------------------------------------- | ------------------ | ---------- | -------------------------------------- |
| `dataBinding`                          | binding            | content    | **Properties** (collections root 결합) |
| `selectionMode`                        | enum               | state      | **Properties**                         |
| `isDisabled`                           | boolean            | state      | **Properties**                         |
| `variant`                              | variant            | appearance | **Style**                              |
| `size`                                 | size               | appearance | **Style**                              |
| `gap`/`padding`/`fill` (컨테이너 시각) | (시각 override 키) | appearance | **Style**                              |

#### (c) Skia 렌더 — projected tree 가 도달 상태 (skiaLegacy 는 전환기일 뿐)

**ADR-142 전환기 현재 상태(2026-06-01)**: ListBox catalog entry 에 `skiaLegacy: true` 가 있어 DOM(Preview)/Inspector 는 catalog generic(wrapper + `useCollectionData`)이고, Skia 만 legacy `render.shapes` 로 items 배열을 순회해 flattened row shape 를 그린다(row 하위 Text/Icon 이 독립 노드가 아님). 이 상태에서는 row 내부 Text 를 클릭·편집할 수 없다.

**본 ADR 의 도달 상태(`cutover:"catalog"`) = Interactive Projected Tree(§4.12)**: ListBox cutover 는 `skiaLegacy` 제거를 포함한다 — Skia 가 `template subtree × visible window` 를 projected tree 로 materialize 하고, generic 렌더(`buildCatalogShapes`)가 각 projected 노드를 그린다. row 내부 Text/Icon 이 hit-test/drill-in/edit-route(§5.11) 가능해진다. **legacy `render.shapes` flattened row 는 도달 상태가 아니다** — ListBox 가 이미 Pencil format(ref/reusable/origin/instance, ADR-147)을 적극 도입한 케이스이므로 projected tree 가 그 모델의 자연 귀결이다. windowing 은 ④.7(`slice(0,N)` cap 아님), 정합 검증은 G5/G8/G9/G-parity.

---

### 7-4. Table — collection (RAC 2D data/render + virtualization)

#### (a) leaf binding

Table 도 composition wrapper(`internal` source)가 `useCollectionData({ dataBinding })` 로 rows 를, columns 매핑으로 열을 채우고 RAC `<Table>` + `TableHeader`/`Column`/`Row`/`Cell` 2D 합성을 만든다. `useTableOptions` 가 정렬/selection 동작을 담당한다(D1, RAC 소유).

```ts
export const tableBinding: PrimitiveBinding = {
  source: { kind: "internal", renderer: "table" },
  props: {
    accepts: {
      dataBinding: { kind: "binding", label: "Data", section: "content" },
      variant: {
        kind: "variant",
        label: "Variant",
        section: "appearance",
        default: "default",
      },
      size: {
        kind: "size",
        label: "Size",
        section: "appearance",
        default: "md",
      },
      selectionMode: {
        kind: "enum",
        label: "Selection Mode",
        section: "state",
        default: "none",
        options: [
          { value: "none", label: "None" },
          { value: "single", label: "Single" },
          { value: "multiple", label: "Multiple" },
        ],
      },
    },
    toRacProps: "default",
  },
};
```

rows 는 `dataBinding`(collections root), columns 는 columnMapping 데이터다 — 둘 다 `kind: "binding"` 으로 표현되어 generic Inspector 가 동일 메커니즘으로 편집 필드를 생성한다. 2D collection 의 row virtualization 과 selection 키보드 동작은 RAC `<Table>` 이 100% 담당한다.

#### (b) Properties Panel + Style Panel 노출 필드

| 필드                                      | kind               | section    | view           |
| ----------------------------------------- | ------------------ | ---------- | -------------- |
| `dataBinding` (rows)                      | binding            | content    | **Properties** |
| `selectionMode`                           | enum               | state      | **Properties** |
| `variant`                                 | variant            | appearance | **Style**      |
| `size`                                    | size               | appearance | **Style**      |
| `padding`/`gap`/`fill` (셀/컨테이너 시각) | (시각 override 키) | appearance | **Style**      |

#### (c) Skia 렌더 — legacy → projected tree 전환 (ADR-920 흡수)

**ADR-142 전환기 현재 상태(도달 상태 아님)**: Table 은 `skiaLegacy: true` — DOM/Inspector 는 catalog generic, Skia 는 legacy `render.shapes` 가 props.rows/columns 2D row/cell 격자를 직접 cell shape 로 그린다(데이터-시각 결합형, row 하위 노드 독립 아님). 컨테이너 frame 은 `buildCatalogShapes` box shell, 셀 텍스트는 `nodeRendererText`. frame culling(`collectVisibleFrameRoots` / `visiblePageRoots`)이 viewport 밖 frame 을 배제해 60fps 유지. **이 단계는 cell 내부 편집·drill-in 미지원 — 본 ADR 의 cutover 도달 상태가 아니다**(아래 전환 단계 = projected tree 가 도달 상태).

**전환 단계(§4.12 적용)**: legacy `rows.forEach × columns.forEach` shape loop 는 **row/column culling + cell/text projected tree** 로 대체된다. row window(vertical) + column culling(horizontal)으로 보이는 cell 만 projected 노드로 만들고, cell 안 Text 는 deepest projected child 로 hit-test 가능해진다(클릭 → cell Text 선택, 더블클릭 → data edit). Table 은 2D culling + cell hit-test 라 ListBox 보다 proof 난도가 높으므로 **ListBox projected tree(G9) 통과 후**에 착수한다(roadmap ⑩).

#### (d) Table parity matrix — 기능 동등 검증 (G-parity 흡수)

Table 의 legacy → projected 전환은 **시각 정합(G5)만으로 전환 금지** — 기존 Table 이 제공하던 기능이 전환 후에도 동등해야 한다(본문 T-PARITY/G-parity). 각 기능은 supported/deferred 를 명시 fixture 로 고정한다:

| 기능                     | 전환 후 요구                                                       | 판정        |
| ------------------------ | ------------------------------------------------------------------ | ----------- |
| column mapping           | columnMapping 데이터 → projected cell 열 정렬                      | supported   |
| column groups            | 다단 헤더 → sticky header layer 분리                               | supported   |
| sorting                  | RAC `useTableOptions` 정렬(D1 소유) → projected row 순서 반영      | supported   |
| column resizing          | 열 폭 변경 → template layout cache 무효화 + re-window              | supported   |
| pagination / infinite    | `useCollectionData` + `useAsyncList`(ADR-132 관할) → window 재계산 | supported   |
| height mode (auto/fixed) | row height = template subtree 계산(④.7)                            | supported   |
| API data mapping         | endpoint → collections runtimeData(ADR-132) → rows                 | bridge 참조 |

이 matrix 통과는 G-parity 의 collection 검증 항목이다 — "기존 Table 동작이 projected tree 전환 후 회귀 0"이 cutover 전환 조건이다.

---

### 7-5. Select — overlay (RAC trigger + Popover + ListBox)

#### (a) leaf binding

Select 는 composition wrapper(`internal` source)가 `useCollectionData({ dataBinding })` 로 options 를 채우고 RAC `<Select>` + `Label`/`Button`(trigger) + `Popover` + `ListBox` 를 합성한다. overlay(Popover) 의 포커스 트랩/배치/키보드 동작은 RAC 가 소유한다.

```ts
export const selectBinding: PrimitiveBinding = {
  source: { kind: "internal", renderer: "select" },
  props: {
    accepts: {
      dataBinding: { kind: "binding", label: "Data", section: "content" },
      label: { kind: "string", label: "Label", section: "content" },
      description: { kind: "string", label: "Description", section: "content" },
      placeholder: { kind: "string", label: "Placeholder", section: "content" },
      size: {
        kind: "size",
        label: "Size",
        section: "appearance",
        default: "md",
      },
      selectionMode: {
        kind: "enum",
        label: "Selection Mode",
        section: "state",
        default: "single",
        options: [
          { value: "single", label: "Single" },
          { value: "multiple", label: "Multiple" },
        ],
      },
      isDisabled: { kind: "boolean", label: "Disabled", section: "state" },
    },
    toRacProps: "default",
  },
};
```

trigger 의 시각 override 키(`fontSize`/`fill`/`padding`)는 `node.props.style` 에 있고, base 는 theme rule 에서 와서 `toReactStyle`/`toSkiaStyle` 가 `override ?? base` 로 병합 투영한다. overlay Popover 의 그림자/arrow 같은 비-DOM-trivial 시각은 `skiaPrimitive` 배열(예: `["popover_shadow", "popover_arrow"]`)로 `getSkiaPrimitiveMode`(replace/prepend/append)가 box+text 출력에 합성한다.

#### (b) Properties Panel + Style Panel 노출 필드

| 필드                                                      | kind               | section    | view           |
| --------------------------------------------------------- | ------------------ | ---------- | -------------- |
| `dataBinding` (options)                                   | binding            | content    | **Properties** |
| `label` / `description` / `placeholder`                   | string             | content    | **Properties** |
| `selectionMode`                                           | enum               | state      | **Properties** |
| `isDisabled`                                              | boolean            | state      | **Properties** |
| `size`                                                    | size               | appearance | **Style**      |
| `fontSize`/`fill`/`padding`/`cornerRadius` (trigger 시각) | (시각 override 키) | appearance | **Style**      |

#### (c) Skia 렌더

closed 상태에서 trigger 는 `buildCatalogShapes` box+text(label + 선택값 + chevron child Icon)로 그려진다. open 상태에서 Popover overlay 는 frame box shell + `skiaPrimitive` shadow/arrow draw module 합성으로, 내부 ListBox option row 들은 collection legacy fallback 이 그린다. Popover 자식은 frame culling 에서 별도 root 로 취급되어 viewport 내일 때만 RenderCommand 스트림에 진입한다. trigger 의 selected/disabled 색은 `resolveComponentRule("Select")` 토큰을 `resolveToken` Pencil 다축(Accent×Base×Mode) best-match 로 해소해 DOM theme CSS 와 동일한 시각 결과를 낸다.

---

### 요약 — 다섯 컴포넌트, 한 메커니즘

| 컴포넌트 | source   | 조합                           | items               | overlay | Skia 경로                                       |
| -------- | -------- | ------------------------------ | ------------------- | ------- | ----------------------------------------------- |
| Button   | rac      | leaf (아이콘 = reusable frame) | —                   | —       | `buildCatalogShapes` box+text                   |
| Checkbox | rac      | leaf (indicator slot)          | —                   | —       | `skiaPrimitive: "checkbox"` + child label text  |
| ListBox  | internal | collection                     | `useCollectionData` | —       | **projected tree**(§4.12, 도달 상태)            |
| Table    | internal | collection (2D)                | `useCollectionData` | —       | **projected tree**(§4.12, 2D culling)           |
| Select   | internal | overlay 합성                   | `useCollectionData` | Popover | box+text trigger + `skiaPrimitive` shadow/arrow |

다섯 모두 노드 하나(의미 `props` + 시각 override `props.style`) + theme rule base 를 공급원으로, `resolveEditContract` 단일 편집 진입점에서 `section` 태그로 두 view 를 필터링하고, `toReactStyle`/`toSkiaStyle` 단일 어댑터로 base⊕override 를 두 backend 에 병합 투영한다. 컴포넌트별로 갈리는 것은 binding 의 `accepts` 한 줄과 `source.kind`, `skiaPrimitive` 유무, 그리고 collection 의 projected tree(§4.12) 여부뿐이다 — 시각 base 는 theme/tokens(`resolveComponentRule` + `resolveToken`)가, ARIA/키보드/포커스는 RAC 가 소유하고, composition 은 `toRacProps` 투영만 한다. (도달 상태에서 `skiaLegacy` 는 0건 — ADR-142 전환기 플래그일 뿐 목표 모델 아님)

<a id="영역-8"></a>

<a id="영역-9-10"></a>

## ⑧ TypeScript 타입 정의

본 영역의 타입은 모두 **노드 = 의미 props + 시각 override layer(`props.style`), base=theme rule** 이라는 1차 원리 위에 선다. 노드는 의미값(`content` / `variant` / `size`)을 `props` 에, 사용자 시각 override(`fontSize` / `fill` / `padding` / `gap` / `cornerRadius`)를 `props.style` 에 가진다. 시각 base 는 노드가 아니라 theme rule 에서 resolve 된다. frame / text / ref / leaf RAC 모든 노드가 같은 보편 시각 키 공간을 공유하고, 컴포넌트별 typed 필드는 0이며 값만 다르다 (CSS 가 모든 element 에 같은 property 집합을 허용하고 값만 다른 것과 동형). base/override 는 노드 간(origin ↔ ref.descendants)으로 분리한다(한 노드 안에 안 섞음, ADR-907 Layer B 보존).

### 8.1 노드 — `CanonicalNode` (의미 props + 시각 override layer)

노드의 의미값은 `props` 에, 사용자 시각 override 는 `props.style`(override layer)에 산다. `props.style` 키 존재=override(base 덮어씀), 키 부재=base(theme rule) 따름. 이 분리가 reset-to-default(`delete props.style[k]`)와 size 변경 시 override 유지를 정의한다.

```ts
import type { ComponentTag } from "./composition-vocabulary";

export interface CanonicalNode {
  /** 노드 고유 id. slash(`/`) 금지 — descendants path 구분자와 충돌. */
  id: string;

  /** 노드 type discriminator (ComponentTag 121-literal). frame/text/ref + leaf RAC. */
  type: ComponentTag;

  name?: string;

  /**
   * 의미값(content/variant/size …) + 시각 override layer(style).
   * 예: { content: "Save", variant: "accent", size: "sm",
   *       style: { fontSize: 16 } }   ← style.fontSize 는 사용자 override (base 14 를 덮어씀)
   * style 키가 없는 시각 속성은 theme rule base 를 따른다. 컴포넌트별 typed 필드 없음.
   */
  props?: {
    /** 사용자 시각 override layer. 키 있으면 base 덮어씀, 없으면 theme rule base. */
    style?: Record<string, unknown>;
    [k: string]: unknown;
  };

  /** true 면 reusable origin(조합 컴포넌트 정의)로 승격. instance 는 type:"ref". */
  reusable?: boolean;

  children?: CanonicalNode[];

  /** slot 선언 — false(비활성) | string[](삽입 추천 reusable id 목록). */
  slot?: false | string[];

  /** 노드별 theme override (Pencil 다축). 예: { mode:"dark", tint:"blue" }. */
  theme?: { mode?: string; tint?: string; [k: string]: string | undefined };

  metadata?: { type: string; [k: string]: unknown };
}
```

`FrameNode` 와 `RefNode` 는 `CanonicalNode` 를 확장하되 **새 속성 모델을 도입하지 않는다**. frame 은 컨테이너 의미 필드 2종(`clip` / `placeholder`)을, ref 는 인스턴스 참조 2종(`ref` / `descendants`)을 더할 뿐, 의미값은 `props`, 사용자 시각 override 는 `props.style` 에 남는다(base 는 theme rule).

```ts
export interface FrameNode extends CanonicalNode {
  type: "frame";
  clip?: boolean; // overflow:hidden 의미값
  placeholder?: boolean; // 빈 frame UI hint
}

export interface RefNode extends CanonicalNode {
  type: "ref";
  /** reusable origin id. local id 또는 "<importKey>:<nodeId>". */
  ref: string;
  /** descendants[path] 오버라이드 맵 — path 는 slash 구분. */
  descendants?: Record<string, DescendantOverride>;
}
```

`descendants` 는 Pencil 3-mode 와 1:1 정합한다. 속성 patch(의미값은 `props`, 시각값은 `props.style` override 일부만 덮어쓰기) / 노드 교체(type 존재) / children 교체(children 존재 + type 없음) 세 모드가 상호 배제로 판별된다. 이 descendants 가 origin base 위 override 를 노드 간 분리로 담는다.

```ts
export type DescendantReplaceMode = CanonicalNode; // (B) 노드 교체 — type 필수
export type DescendantChildrenMode = {
  id?: never;
  type?: never;
  children: CanonicalNode[];
}; // (C)
export type DescendantPatchMode = {
  id?: never;
  type?: never;
  children?: never;
} & Partial<CanonicalNode>; // (A) 속성 patch — 의미값 props, 시각값 props.style override

export type DescendantOverride =
  | DescendantReplaceMode
  | DescendantChildrenMode
  | DescendantPatchMode;
```

> 속성 patch 모드(A)가 base/override 노드 간 분리를 그대로 구현한다 — origin 노드가 base 를 들고, instance override 는 `descendants["label"] = { props: { style: { fontSize: 16 } } }` 처럼 `props.style` override layer 키만 적는다. base(theme rule 또는 origin)와 override(`props.style`)가 물리 분리돼 있어 reset(`delete`)·size 변경 시 override 유지가 정의된다 — 한 노드 안에 base+override 를 같은 키 공간에 섞지 않는다(ADR-907 Layer B 정합).

### 8.2 leaf 정의 — `PrimitiveBinding`

leaf RAC primitive 는 약 35개의 `PrimitiveBinding` 으로 정의한다. 컴포넌트당 정의 객체는 존재하지 않는다. binding 은 시각 / 변형 / 구조 필드를 갖지 않는다 — 시각은 theme/tokens, 변형은 `data-*`, 구조는 RAC 의 part/slot 메타데이터다.

```ts
export type PrimitiveSource =
  | {
      kind: "rac";
      package: "react-aria-components";
      importPath: string;
      component: string;
    }
  | { kind: "internal"; renderer: string }; // RAC 환원 불가 leaf (예: Icon = Lucide SVG)

export interface PrimitiveBinding {
  source: PrimitiveSource;
  /** rac source 전용 part/slot/state 메타. internal source(Icon)는 생략. */
  rac?: {
    primitive: string;
    parts: string[];
    slots: string[];
    states: string[];
    renderProps: string[];
    dataAttributes: string[];
  };
  props: {
    /** primitive 가 받는 canonical props = leaf D2 편집 SSOT. */
    accepts: Record<string, PropContract>;
    /** canonical props → RAC props 투영기 식별자 (outputs/toRacProps.ts). */
    toRacProps: string;
  };
  /** 비-DOM-trivial primitive(arc/track/indicator/overlay)의 Skia draw module 키. */
  skiaPrimitive?: string | string[];
}
```

### 8.3 편집 계약 — `PropContract` 와 `EditContract`

`PropContract` 는 canonical prop 1개당 Inspector 필드 1개의 kind 다. leaf 의 `accepts` 와 reusable 의 `propsSchema` 가 같은 타입을 공유하므로, 조합 D2 와 leaf D2 가 단일 편집 어휘로 수렴한다.

```ts
export type InspectorFieldKind =
  | "boolean"
  | "enum"
  | "string"
  | "string-array"
  | "number"
  | "icon"
  | "variant"
  | "size"
  | "fillStyle"
  | "binding";

export interface PropContract {
  kind: InspectorFieldKind;
  label?: string;
  default?: unknown;
  /** 필드 그룹 태그 — Properties view ↔ Style view 필터 축. */
  section?: "content" | "appearance" | "state" | "locale" | (string & {});
  /** enum 전용 고정 옵션. variant/size 는 options 없음 — theme 규칙 키에서 읽음. */
  options?: Array<{ value: string; label: string }>;
  min?: number;
  max?: number;
  step?: number;
  visibleWhen?: VisibilityCondition;
}

export type PropsSchema = Record<string, PropContract>;
```

편집 진입점은 `resolveEditContract(node)` 하나다. 패널은 별도 store/공급처를 두지 않고, 이 contract 를 `section` 태그로 필터링한 두 view 로만 갈린다 (Properties = content/state/locale, Style = appearance). 같은 노드 하나가 두 view 의 단일 공급원이다.

```ts
/** 노드 평면 props 위에 얹는 편집 필드 묶음. section 태그가 view 필터 축. */
export interface EditContract {
  type: ComponentTag;
  /** key → PropContract. leaf=binding.props.accepts, reusable=propsSchema 평면 병합. */
  fields: Record<string, PropContract>;
  /** section → 해당 section 의 prop key 목록 (generic Inspector 가 이 순서로 렌더). */
  sections: Record<string, string[]>;
}

/** 노드 하나(의미 props + props.style override)로부터 편집 계약을 도출하는 단일 진입점. 패널은 이 결과만 소비. */
export function resolveEditContract(node: CanonicalNode): EditContract;
```

### 8.4 등록 — `ComponentCatalogEntry`

컴포넌트 등록은 단일 `componentCatalog` 다. 6개 레지스트리(spec / TAG_SPEC_MAP / specRegistry / factory / panel / renderer)는 entry 하나로 대체된다. leaf 는 `binding`, 조합은 `reusableId`(canonical reusable 문서), native(frame/Slot)는 둘 다 없다.

```ts
export type ComponentFamily =
  | "primitives"
  | "fields"
  | "selection"
  | "collections"
  | "tree-table"
  | "overlays"
  | "date-color"
  | "composition-native";

export type CutoverState = "legacy" | "cutting-over" | "catalog";

export type ComponentCatalogEntry =
  | {
      kind: "primitive";
      type: string;
      family: ComponentFamily;
      cutover: CutoverState;
      binding: PrimitiveBinding;
      panel: PanelMeta;
      skiaLegacy?: boolean; // ADR-142 전환기 플래그 — 본 ADR 도달 상태에서 collection 은 projected tree(§4.12)로 0건
    }
  | {
      kind: "reusable";
      type: string;
      family: ComponentFamily;
      cutover: CutoverState;
      reusableId: string;
      panel: PanelMeta;
      skiaLegacy?: boolean; // 동일 — 도달 상태에서 제거
    }
  | { kind: "native"; type: string; family: ComponentFamily; panel: PanelMeta };

export function getCatalogEntry(
  type: string,
): ComponentCatalogEntry | undefined;
export function getCatalogCutoverTypes(): ReadonlySet<string>; // cutover==="catalog"
export function getCatalogSkiaCutoverTypes(): ReadonlySet<string>; // catalog && !skiaLegacy — 도달 상태에서 catalog 전체와 일치(skiaLegacy 0건)
```

> **skiaLegacy 의 위상**: `skiaLegacy` 필드는 ADR-142 가 도입한 **전환기 기제**(collection/Table 이 Skia 만 legacy `render.shapes` 유지)다. 본 ADR 의 도달 상태에서 collection 은 projected tree(§4.12)로 Skia 까지 catalog 전환하므로 `skiaLegacy` 는 **0건**이 된다 — 타입 필드는 전환 기간 호환을 위해 보존하되, 최종 cleanup(Phase 10)에서 플래그 자체를 제거한다. collection 의 정상 도달 상태는 `skiaLegacy:true` 가 아니라 projected tree 다(projected-first 원칙).

`getCatalogCutoverTypes` / `getCatalogSkiaCutoverTypes` 가 family 단위 atomic cutover 게이트의 파생 함수다. `kind:"native"` 는 cutover 개념이 없어(이미 canonical-native 렌더) 게이트에서 제외된다.

### 8.5 시각 규칙 — `ComponentRule`

시각값은 theme(`ComponentRule`)이 소유한다. variant / size 선택지는 컴포넌트 enum 이 아니라 theme 규칙의 키 집합이다 (`PropContract` 의 `kind:"variant"`/`"size"` 가 `options` 를 두지 않는 이유). `resolveComponentRule(type, doc)` 는 문서 override 우선, build-time 생성 테이블 fallback 으로 규칙을 해소한다.

```ts
export interface ComponentRuleFillState {
  base: string;
  hover?: string;
  pressed?: string;
  selected?: string;
  selectedHover?: string;
  selectedPressed?: string;
  emphasizedSelected?: string;
}
export interface ComponentRuleFill {
  default: ComponentRuleFillState;
  outline?: Partial<ComponentRuleFillState>;
  subtle?: Partial<ComponentRuleFillState>;
  alpha?: number;
}
export interface ComponentRuleVariant {
  fill: ComponentRuleFill;
  colors?: ComponentRuleVariantColors;
}
export interface ComponentRuleSize {
  fontSize?: number | string;
  lineHeight?: number | string;
  borderRadius?: number | string;
  borderWidth?: number | string;
  height?: number | string;
  iconSize?: number | string;
}

export interface ComponentRule {
  defaultVariant?: string;
  defaultSize?: string;
  variants: Record<string, ComponentRuleVariant>; // 키 = variant 선택지
  sizes: Record<string, ComponentRuleSize>; // 키 = size 선택지
  textDecoration?: string;
}
export type ComponentRulesTable = Record<string, ComponentRule>;

export function resolveComponentRule(
  type: string,
  doc?: CompositionDocument | null,
): ComponentRule | undefined;
```

`ComponentRuleSize` 의 토큰 문자열(`{radius.md}`)은 runtime 에서 `resolveToken` 이 다축(Accent × Base × Mode) best-match 로 실수 값화한다 — dark mode 자동 반전 포함.

### 8.6 평면 backend 어댑터 — `toReactStyle` / `toSkiaStyle`

generic 렌더러 traversal 1개가 backend 2개(DOM / Skia)로 갈린다. base(theme rule) ⊕ override(`props.style`) 병합 시각값을 단일 어댑터 한 쌍이 backend 표현으로 투영한다. override 우선 병합, shorthand↔longhand 정규화, Taffy reader, token 해소가 **어댑터 한 곳** 에 수렴한다. 컴포넌트별 분기는 어댑터에 없다 — 노드 override + rule base 만 읽는다.

```ts
import type { ComponentState } from "@composition/specs";

/** 어댑터 입력 컨텍스트 — 노드 + theme rule + 현재 state + token 해소기. */
export interface StyleAdapterContext {
  node: CanonicalNode;
  rule?: ComponentRule; // resolveComponentRule(node.type, doc)
  state?: ComponentState; // caller(builder)가 결정한 단일 state
  resolveToken: (ref: string) => string | number; // 다축 best-match 해소
}

/** DOM backend 투영 — 평면 props → React.CSSProperties (longhand 정규화 포함). */
export function toReactStyle(ctx: StyleAdapterContext): React.CSSProperties;

/** Skia backend 투영 — 평면 props → buildCatalogShapes 입력(visual rule + props + size). */
export function toSkiaStyle(ctx: StyleAdapterContext): {
  props: Record<string, unknown>;
  size: ComponentRuleSize;
  textDecoration?: string;
};
```

Skia 측은 `toSkiaStyle` 출력이 generic `buildCatalogShapes(visual, props, size, state, textDecoration)` 로 흘러간다. `buildCatalogShapes` 는 node.type 을 읽지 않고 box+text 만 그린다 — 컴포넌트 차이는 평면 props 값 차이로 흡수된다. RAC 권위 영역은 별도 투영기 `toRacProps(node, binding)` 가 담당하며, ARIA/키보드/포커스 props 만 RAC component 로 넘긴다.

```ts
/** D1 투영 — canonical 평면 props → RAC component props (composition 은 투영만, RAC 가 권위). */
export function toRacProps(
  node: CanonicalNode,
  binding: PrimitiveBinding,
): Record<string, unknown>;
```

---

## ⑨ 장단점 및 트레이드오프

### 9.1 단일 공급원(base⊕override)의 장점

**drift 의 구조적 소멸.** 노드 하나(의미 `props` + 시각 override `props.style`) + theme rule base 가 Properties Panel / Style Panel / DOM / Skia / Publish 의 공통 공급원이다. 각 소비처가 같은 노드 override + 같은 rule base 를 같은 어댑터로 병합(`override ?? base`)하므로, 한 소비처가 다른 표현을 갖는 drift 가 발생할 자리 자체가 없다. override 우선 병합·shorthand↔longhand·Taffy reader·token 해소가 `toReactStyle`/`toSkiaStyle` 어댑터 한 곳에 수렴하여, 정합성 버그의 발생 표면이 5경로에서 1어댑터로 줄어든다. 또한 base(theme rule)/override(`props.style`) 물리 분리로 reset-to-default·size 변경 시 override 유지가 정의된 채 보존된다(ADR-907 Layer B 정합).

**정의 124 → 35.** 컴포넌트당 정의 객체(`ComponentSpec` + factory + panel def + renderer 분기)가 사라진다. 코드 정의는 leaf `PrimitiveBinding` 약 35개뿐이고, 조합 컴포넌트는 `reusable:true` 노드 문서(데이터)다. 신규 조합 컴포넌트 추가가 코드 변경 0 — Builder 에서 저작 후 reusable 승격이다.

**패널 단일.** Properties view 와 Style view 가 별도 store/공급처를 두지 않는다. `resolveEditContract(node)` 결과를 `section` 태그로 필터링한 두 view 일 뿐이다. 패널 상태 동기화 코드, 패널 간 stale 경합이 제거된다.

**RAC 권위 보존.** ARIA/키보드/포커스는 RAC 가 100% 소유하고 composition 은 `toRacProps` 투영만 한다. 접근성 회귀가 composition 코드 변경과 분리되어, 시각 작업이 D1 을 건드리지 않는다.

### 9.2 위험과 대응

| ID              | 위험                                                                                                                                                                                                                                           |  심각도  | 대응                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------: | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **T-1**         | generic 공통기반(traversal 1개 + 어댑터 한 쌍 + `resolveEditContract`)이 모든 컴포넌트의 공유 무게중심 — 여기 결함은 전 family 동시 회귀                                                                                                       |   HIGH   | Button vertical slice(G1)로 공통기반을 단일 컴포넌트에서 완성·검증 후에만 family cutover 시작. 공통기반 변경은 항상 G1 회귀 fixture 통과를 전제                                                                                                                                                                                                                                                                                          |
| **T-2**         | 조합 컴포넌트 수작업 저작(자동 변환 금지, HC#5) — 구버전 spec 에서 자동 변환하지 않고 starter + 디자인 의도로부터 새로 저작                                                                                                                    |   MED    | Builder 안에서 저작 후 reusable 승격, family 단위 분할. (별개의 타입-안전 위험: `props`/`props.style` 자유 payload(`Record<string, unknown>`)의 잘못된 키는 `PropContract.kind` 런타임 편집 게이트 + 어댑터 silent passthrough 금지 + G1 fixture 전수 DOM↔Skia 대칭으로 차단)                                                                                                                                                            |
| **T-ADAPT/T-3** | base(theme rule) ⊕ override(`props.style`) 병합 + shorthand↔longhand·Taffy reader·token 해소가 backend 어댑터 한 곳에 집중 — 어댑터 버그가 양 backend 동시 오염                                                                                |   HIGH   | DOM↔Skia 시각 대칭을 `/cross-check`로 family 단위 검증. 어댑터는 token 해소를 `resolveToken` 다축 해소기에 위임(어댑터 내부 token 분기 금지)하여 책임 표면 축소. reset-to-default(`delete props.style[k]` → base 복귀) round-trip 을 fixture 로 고정                                                                                                                                                                                     |
| **T-4**         | collection(ListBox/Select/Table 등)은 items 배열 순회로 multi-item 리스트를 그림 — projected tree windowing(④.7) ↔ Taffy layout 연계 복잡도                                                                                                    |   HIGH   | collection family cutover 가 **projected tree(§4.12) 구현을 포함**(projected-first) — Skia 도 generic 렌더로 catalog 전환, legacy render.shapes 경유 아님. List/Table 1000+ row FPS fixture. 실패 시 해당 family `cutover:"cutting-over"` 보류(skiaLegacy 영구 유지 금지 — ADR-142 전환기 출발 상태일 뿐)                                                                                                                                |
| **T-PARITY**    | 기능 퇴보 — family cutover 가 시각 정합(G2/G5)은 통과해도 기존 컴포넌트의 편집 UX·동작·옵션을 누락하면 "기존 대비 기능 저하"로 폐기. 과거 재설계 폐기의 직접 원인(설계 무결 + 정합성 20% 미만 + 기능 퇴보)                                     | **HIGH** | Gate G-parity. family cutover 시 기존 프로젝트 무손실 마이그레이션(ADR-147 HC#4 패턴) + 기존 편집/동작 parity 검증. collection 은 ListBox/Table 의 row 편집·selection·정렬·columnMapping/groups/sorting/resizing/pagination/heightMode 회귀 0(7-4 d parity matrix). 정합성만으로 cutover 전환 금지 — 실패 시 family `cutover:"legacy"` 유지                                                                                              |
| **T-7**         | Skia state 모델 미완 — 현재 `default`/`disabled` 2개만 derive, hover/pressed hit-test wiring 없음 → Builder 화면 hover/pressed 시각 부재. (state 가 caller 결정 단일 값이라 DOM 의 `:hover`/`data-*` 자동 state 와 매체가 다른 점이 근본 원인) | **HIGH** | Gate G-state. selection family cutover 마다 `racStateAttrs`(RAC `data-*` 상태 → Skia state) wiring + `ComponentState` enum 으로부터 base⊕override 시각 분기, hover/pressed/selected data-attribute parity 를 Preview DOM 과 동일하게 `/cross-check`. `buildCatalogShapes(visual, props, size, state)` 의 `state` 인자가 단일 진입점, DOM 은 `data-*`(`toRacProps`)로 CSS 에 위임. 상태 시각 미달 family 는 `cutover:"cutting-over"` 보류 |
| **T-PROJECT**   | (ADR-920 흡수) projected tree(§4.12) 의 render-space `projectionId` 가 canonical mutation/history/IndexedDB 에 유입되면 데이터 corruption — selection/hover/edit/mutation 4 경로마다 guard 필요                                                |   HIGH   | Gate G8 negative fixture(projected id → canonical API 직접 유입 시 FAIL) + refresh 후 `elementsMap` synthetic projectionId 0건. ADR-135/136 Render-Space Interaction Boundary 의 collection 적용 — §5.11 edit route 가 canonical write target 으로 명시 변환. 실패 시 해당 collection family `cutover:"cutting-over"` 보류(전환 금지)                                                                                                    |
| **T-DEEP**      | (ADR-920 흡수) collection 깊은 노드(row 내부 Text/Icon, Table cell) 편집 UX 미달 — flattened row 만 선택 가능하면 920 핵심 사용자 요구(Skia editor surface drill-in) 미충족이자 기능 미달                                                      |   HIGH   | Gate G9 — Skia row 내부 Text/Icon 클릭 → deepest 선택, 더블클릭 → drill-in/data edit, style edit → template route(§5.11). 10k row 에서 draw/hit 노드 ≤ window+overscan(④.7). 실패 시 flat row selection 만 + phase hold                                                                                                                                                                                                                  |
| **T-TPL**       | (ADR-920 흡수) template subtree layout cache(④.7) ↔ 기존 layout publish/projection version 연계 — 별도 cache 가 stale Skia/Layer Tree 유발 가능                                                                                                |   MED    | `TemplateLayoutCacheKey`(templateHash+size+variant+width+themeKey) 무효화를 기존 layout publish/projectionVersion/synthetic element invalidation 신호에 연결(독립 cache 금지). T-4 collection virtualization 의 인접 정밀화 — Gate G7 에 흡수                                                                                                                                                                                            |
| **T-5**         | RAC 버전 의존 — breaking change 가 `toRacProps` + `binding.rac.states` 일괄 영향                                                                                                                                                               |   MED    | 단일 wrapper surface(`shared/components`)로 충격 국한. RAC 버전 업데이트는 wrapper + binding 한 곳에서 흡수                                                                                                                                                                                                                                                                                                                              |
| **T-6**         | theme 다축 resolve 비용 — 현재 `resolveToken` 은 light/dark binary(`tokenResolver.ts:21`), Pencil 다축(Accent/Base/Mode)은 신규                                                                                                                |   MED    | 다축 best-match resolver 도입. 다축 요구 컴포넌트 실재 확인 후 도입(현 light/dark binary 위에 점진 확장)                                                                                                                                                                                                                                                                                                                                 |

### 9.3 family 격리

cutover 는 family 단위 atomic 이다. 한 family 의 모든 entry 가 `legacy → cutting-over → catalog` 를 함께 거치며, 같은 family 안에서 legacy 와 catalog 가 혼재하지 않는다(`CutoverState` 불변식). 따라서 위험의 폭발 반경이 family 하나로 제한된다 — 한 family cutover 중 회귀가 나도 다른 family 는 legacy 렌더 경로로 영향받지 않는다. `getCatalogCutoverTypes` / `getCatalogSkiaCutoverTypes` 가 이 격리를 게이트로 강제한다.

---

## ⑩ 구현 우선순위 및 Roadmap

전체 순서는 **공통기반 선행 → family 단위 atomic cutover(8 family) → final** 이다. 공통기반이 모든 family 의 공유 무게중심(T-1)이므로, 단일 컴포넌트에서 완성·검증한 뒤에만 family 확장으로 넘어간다.

> **projected-first 원칙 (skiaLegacy 는 최종안이 아니다)**: collection/tree-table family 의 **정상 도달 상태(cutover === "catalog")는 Interactive Projected Tree(§4.12)** 다 — legacy `render.shapes` 경유 fallback 이 아니다. `skiaLegacy:true` 는 **ADR-142 전환기의 현재 코드 상태**(2026-06-01 기준 collection 18 type 이 Skia 만 legacy 유지)일 뿐, 본 ADR 의 목표 모델이 아니다. 사용자 요구(Skia 화면 = 직접 조작 editor, row 내부 Text/Icon 클릭·드릴인·편집)는 projected tree 로만 충족되며 legacy flattened-shape row 로는 미충족이다. 따라서 collection family cutover 는 **projected tree 구현을 cutover 조건으로 포함**하고, 실패 시 대안은 `skiaLegacy 영구 유지`가 아니라 **해당 family cutover 미전환(보류) — `cutover:"cutting-over"` 정체** 다. 본 ADR 완결 시 `skiaLegacy` 메커니즘은 collection 에서 0건이어야 한다(legacy render.shapes 경로 물리 제거).

### Phase 0 — 공통기반 (generic 렌더러 + base⊕override 어댑터 + resolveEditContract)

- generic 렌더러 traversal 1개 + backend 2개(DOM `toReactStyle` / Skia `toSkiaStyle`) 구현. 어댑터는 base(theme rule) ⊕ override(`props.style`)를 `override ?? base` 로 병합.
- `resolveEditContract(node)` 단일 편집 진입점(의미 props ∪ `props.style` 키 계약 합집합) + Properties/Style 두 view 의 `section` 필터.
- `resolveComponentRule(type, doc)`(base) + `resolveToken` 다축 해소 배선.
- 이 단계는 컴포넌트를 cutover 하지 않는다 — 메커니즘만 도입한다.

### G1 — Button vertical slice (게이트)

Button 단일 컴포넌트로 base⊕override 전 경로를 실증한다. 이 슬라이스가 통과하지 못하면 어떤 family cutover 도 시작하지 않는다.

- `Button.binding` 의 `accepts` 의미 키(content/variant/size) + `props.style` override 키(fontSize/fill/...) → `toRacProps`(D1) + `toReactStyle`(DOM) + `toSkiaStyle`→`buildCatalogShapes`(Skia) 전 경로 통과.
- Properties view ↔ Style view 가 같은 Button 노드 하나(+ theme rule base)를 공급원으로 편집.
- override round-trip: size="md"→"sm" 후 base fontSize 14 가 5곳 동일 / fontSize=16 override 후 size 변경에도 16 유지 / reset 후 base 복귀.
- DOM↔Skia 시각 대칭 `/cross-check` PASS + Chrome MCP live 1회 exercise.
- 회귀 fixture 고정 — 이후 공통기반 변경은 항상 이 fixture 통과 전제.

### Phase 1~8 — family 단위 atomic cutover (8 family)

family 순서는 위험 낮은 순으로 진행한다. 각 family 는 `legacy → cutting-over → catalog` 를 atomic 으로 거친다.

1. **primitives** — Button/Icon/Separator/Link/ToggleButton/ToggleButtonGroup/Toolbar/Badge. box+text generic 으로 완전 표현, skiaLegacy 불필요.
2. **fields** — TextField/NumberField/SearchField/DateField/TimeField/ColorField. RAC field controller + props.style override 시각.
3. **selection** — Checkbox/Radio/Switch/CheckboxGroup/RadioGroup. indicator 는 `skiaPrimitive`.
4. **collections** — ListBox/GridList/ComboBox/Select/Menu/TagGroup. **projected-first cutover** — cutover 도달 상태 = Interactive Projected Tree(§4.12)이며 Skia 도 catalog 전환(legacy render.shapes 경유 아님). row 내부 Text/Icon 이 hit-test/drill-in/edit-route 가능. (ADR-142 전환기 현재 `skiaLegacy:true` 상태 → 본 family cutover 가 projected tree 로 그것을 대체)
5. **tree-table** — Tree/Table. **projected-first cutover** — Table 은 2D row/column culling + cell projected tree(7-4). collections family projected tree(G9) 통과 후 착수. (전환기 현재 `skiaLegacy:true` → projected tree 로 대체)
6. **overlays** — Popover/Dialog/Modal/Tooltip. bg/border 는 generic box, shadow/backdrop/arrow 는 `skiaPrimitive` 합성(`getSkiaPrimitiveMode`).
7. **date-color** — Calendar/RangeCalendar/DatePicker/DateRangePicker/ColorPicker/Slider. 복합 leaf — `skiaPrimitive` draw module.
8. **composition-native** — frame/Slot/MaskedFrame. cutover 개념 없음(metadata-only) — 이미 canonical-native 렌더, 팔레트/factory metadata 통합만.

각 family cutover 마다: type-check + family `/cross-check` 대칭 PASS + cutover 게이트(`getCatalogCutoverTypes` family 전수 포함) + live 1회 exercise.

### collections / tree-table family 의 cutover 정의 — Interactive Projected Tree (ADR-920 흡수, projected-first)

> 이전 개정안은 collection 을 `skiaLegacy:true` 로 cutover 한 뒤 projected tree 를 "전 family 후 Phase 9 일괄"로 후순위 분리했다. **이는 사용자 요구(Skia 직접 조작 editor)를 미루는 모델이라 폐기한다.** collection/tree-table family 의 cutover(Phase 1~8 의 4·5번)는 **그 자체로 Interactive Projected Tree 구현을 포함**한다 — 별도 후순위 단계가 아니라 해당 family 의 `cutover:"catalog"` 도달 조건이다.

collection family cutover 가 충족해야 할 projected tree 구성:

- **windowing(④.7 정밀화)**: `slice(0, N)` cap 제거 → scrollOffset + measured row size 기반 `CollectionWindow`([startIndex,endIndex]+overscan). draw tree 와 hit tree 가 같은 window 공유.
- **projected tree(§4.12)**: visible window 의 각 item 을 template subtree × data 로 투영해 row 내부 Text/Icon/Cell 을 children 가진 projected tree 로 materialize. `ProjectedNodeRef`(render-space id, canonical 미저장). **Skia 도 catalog 전환** — legacy `render.shapes` flattened row 가 아니라 generic 렌더(`buildCatalogShapes`)가 projected 노드를 그린다.
- **hit-test/drill-in(§4.12)**: click → deepest projected child, double-click → drill-in/data edit. drill stack(Esc/breadcrumb pop).
- **edit route(§5.11)**: projected 노드 편집 → template/data/override route 명시 변환. render-space id ↔ canonical write target 분리(Gate G8).
- **Table 2D(7-4)**: collections family projected tree(G9) 통과 후 row/column culling + cell projected tree 로 확장. parity matrix(7-4 d) = G-parity collection 검증.
- **gate**: G5(시각 정합) + G8(projected/canonical boundary) + G9(interactive projected tree) + G-parity collection + G7(template layout cache ↔ layout publish, T-TPL) 통과 시 해당 family `cutover:"catalog"`. **legacy `render.shapes` 경로 물리 제거** — `skiaLegacy` 플래그가 collection 에서 0건. 미통과 시 `cutover:"cutting-over"` 정체(legacy 영구 유지 아님).

> **bridge 참조**: 본 단계의 data 결과 read(`useCollectionData`)는 ADR-132, behavior(onSelectionChange/onAction)는 ADR-131, page frame Slot projection 은 ADR-135/136 관할이다. 910 은 그 결과를 generic 렌더러/edit route 에 연결만 하고 해당 위험·Gate 는 보유하지 않는다(§"ADR-920 흡수 경계" 참조).

### Phase 10 — final

- 8 family 전수 `cutover === "catalog"`. **collection/tree-table 도 projected tree 로 Skia catalog 전환 — `skiaLegacy` 플래그 0건, legacy `render.shapes` 경로 물리 제거.**
- `getCatalogSkiaCutoverTypes()`(= catalog && !skiaLegacy)가 전 type 을 포함 — Skia 부분 전환(skiaLegacy 제외) 상태가 해소됨. ADR-142 전환기 기제(`skiaLegacy` 플래그 자체)도 제거.
- 6 레지스트리(spec/TAG_SPEC_MAP/specRegistry/factory/panel/renderer) 물리 제거 — `componentCatalog` 단일 등록만 잔존.
- 컴포넌트당 정의 파일(`ComponentSpec`) 폐기, 시각은 theme/tokens(`generated/componentRulesTable.ts` 의 `COMPONENT_RULES_TABLE`)·조합은 reusable 노드 문서로 완전 수렴.

---

## ⑪ ADR-920 흡수 경계 — 무엇을 흡수하고 무엇을 위임하는가

ADR-920(RAC Format Interactive Projected Tree, Codex 독립 설계)은 본 ADR 과 **같은 외부 입력**(`react-aria-starter` + Pencil `shadcn-design-system.json`)에서 출발한 수렴 설계다. 두 설계의 base/override 원리는 동일하다(910 HC#3 ≡ 920 HC#5). 사용자 결정에 따라 910 을 상위 아키텍처로 두고 920 의 가치를 흡수했으며, 920 은 본 ADR 로 supersede 된다.

### 흡수(910 본질 영역) — 920 이 채운 910 미설계 영역

| 920 축                                                                      | 910 흡수 위치                                |
| --------------------------------------------------------------------------- | -------------------------------------------- |
| Interactive Projected Tree (hit-test/drill-in)                              | §4.12 신설                                   |
| windowing 정밀화 (`slice(0,N)`≠culling, template-tree row height)           | §4.7 정밀화                                  |
| edit-route registry (template/data/override)                                | §5.11 신설                                   |
| Table 2D parity matrix                                                      | §7-4 (c)(d)                                  |
| capability **개념** (component별 layout/style 중복 금지, shared size scale) | 기존 §② `ComponentRule`/theme rule 로 단일화 |

> **capability 흡수는 개념만**: 920 의 `FormatCapabilityRegistry` 를 **새 레지스트리로 도입하지 않는다.** "property 의미·Panel section·Skia 지원·layout 분류를 한 곳에 선언"은 910 의 theme rule 테이블(`generated/componentRulesTable.ts` 의 `COMPONENT_RULES_TABLE`) + `PropContract` + ADR-909 longhand 정책에 이미 정합한다. 별도 레지스트리는 canonical 문서와 평행한 **두 번째 SSOT** 가 되어 910 대안 C 기각 사유(drift 재발)를 재현하므로 금지한다.

### schema / registry 단일화 — 병렬 schema 금지 (충돌 제거)

920 의 schema/registry 타입은 910 의 단일 schema/registry 로 **흡수·통합**된다. 두 설계의 타입을 **병렬로 두지 않는다** — `CanonicalNode`/`FormatNode`, `PrimitiveBinding`/`RacFormatDefinition` 을 동시에 살려 두면 같은 노드·같은 leaf 정의가 두 schema 로 갈라져 정합 비용이 재발하기 때문이다(910 대안 C 기각 사유 = 두 번째 SSOT). 따라서 920 타입은 910 의 대응 타입으로 **수렴(별칭이 아니라 흡수)** 하며, 본 ADR 어디에도 920 schema 타입을 정의·import 하지 않는다.

| 920 schema/registry 타입           | 910 단일 타입 (정본)                                                              | 통합 방식                                                                                                                                                                                                                                |
| ---------------------------------- | --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `FormatNode` / `FrameFormatNode`   | **`CanonicalNode`** (§② — 의미 props + `props.style` override layer)              | 동일 역할(문서 노드). 910 `CanonicalNode` 로 단일화 — `FormatNode` 별도 정의 없음. frame 은 `type:"frame"` canonical 노드(ADR-130) 로 이미 표현                                                                                          |
| `RacFormatDefinition`              | **`PrimitiveBinding`** (§③ — `rac` + `props.accepts` + `internal`)                | 동일 역할(leaf 의 RAC prop/state/slot vocabulary + part binding). 910 `PrimitiveBinding` 으로 단일화 — `RacFormatDefinition` 별도 registry 없음                                                                                          |
| `FormatCapabilityRegistry`         | **`ComponentRule`/`COMPONENT_RULES_TABLE` + `PropContract`** (§②.8.5 / §⑤)        | 개념만 흡수(위 단락). property 의미·Panel section·Skia 지원·layout 분류 = theme rule(`generated/componentRulesTable.ts` 의 `COMPONENT_RULES_TABLE`) + `PropContract.section` + ADR-909 longhand 정책. 별도 capability registry 도입 금지 |
| `ResolvedFormatRuntime` / resolver | **`resolveEditContract` + `toReactStyle`/`toSkiaStyle` + `resolveComponentRule`** | resolver 함수 군으로 분해 흡수 — 단일 "format runtime" 객체를 두지 않고 910 의 기존 단일 진입점 함수들이 동일 역할 수행                                                                                                                  |
| `ProjectedNodeRef` (render-space)  | **`ProjectedNodeRef`** (§4.12 — 910 이 흡수해 신설)                               | 920 고유 기여. 910 §4.12 로 그대로 흡수(render-space 전용, canonical 미저장). 이것만 920 → 910 신규 타입 — canonical schema 와 직교(병렬 SSOT 아님)                                                                                      |
| `componentCatalog` / 6 registry    | **`componentCatalog`** (§②.8.4 — 단일 등록)                                       | 양 설계 동명·동개념. 6 레지스트리(spec/TAG_SPEC_MAP/specRegistry/factory/panel/renderer) → 단일 `ComponentCatalogEntry` 로 대체                                                                                                          |

**검증 불변식**: 910 본문·breakdown 에 `FormatNode`·`RacFormatDefinition` 정의/import 0건(흡수 매핑 인용 제외). `ProjectedNodeRef` 만 920 에서 신규 흡수되며, 이는 canonical schema 와 직교하는 render-space 전용 타입이라 두 번째 SSOT 가 아니다(ADR-135/136 Render-Space Boundary 정합).

### 위임(bridge 참조만) — 이미 다른 ADR 이 관할(Implemented)

다음 3축은 920 이 재기술했으나 **이미 land 된 ADR 이 관할**한다. 910 은 generic 렌더러/edit route 가 그 결과에 연결되는 **bridge 참조 1줄만** 두고, 해당 위험·Gate 는 **910 Risks/Gates 에 추가하지 않는다**(관할 중복 방지).

| 920 축                                                       | 관할 ADR                                                                                                      | 910 의 연결점                                                                                                        |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| behavior bridge (onPress/onSelectionChange → events/actions) | **ADR-131** (root collection, `props.onPress:"ev1"` string id)                                                | `toRacProps` 가 callback string id 투영 (⑥.3). 이벤트 실행은 ADR-131 관할                                            |
| page frame Slot projection (render id ↔ canonical write)     | **ADR-135/136** (Render-Space Boundary, `resolveCanonicalMoveTarget`, `.claude/rules/canvas-rendering.md §9`) | §4.12/§5.11 의 render-space id 분리가 ADR-135/136 패턴 동형. page frame 자체는 ADR-135/136                           |
| data SSOT bridge (collection binding-ref)                    | **ADR-132** (`useCollectionData` 단일 경유) + ADR-131 Phase 8 (`collections` 데이터 SSOT)                     | collection rows read 가 `useCollectionData({ datatableId \| dataBinding })`. node-local data 금지는 ADR-131/132 강제 |

### 920 의 두 구조 결함을 흡수 시 차단

1. **920 엔 별도 Risks 섹션이 없다**(adr-writing.md 위반 — Gates 14개를 바로 나열). 910 은 정상 Risks 섹션을 보유하므로, 흡수한 위험을 920 Gate 평면 복사가 아니라 **T-PROJECT/T-DEEP/T-TPL 로 Risks 표에 등록 후 G8/G9 와 1:1 연결**했다. 920 G6~G14 대부분은 bridge 영역(④⑤⑥)이라 910 Gate 로 들이지 않았다.
2. **920 엔 T-PARITY 류 기능 퇴보 방어가 없다**(Button→ListBox→Table proof 만). 흡수한 collection/Table 도 910 의 **G-parity 적용 대상**에 포함했다(7-4 d parity matrix = G-parity collection 검증). "정합성 통과 ≠ 기능 동등"이 cutover 전환 조건이다.
