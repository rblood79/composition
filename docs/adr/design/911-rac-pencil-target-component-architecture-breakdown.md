# ADR-911 목표 상세 — RAC core + Pencil format 백지 목표 컴포넌트 아키텍처

> 본 문서는 ADR-911 의 **목표 아키텍처 정적 정의** 다. 현재 코드에서 목표로 가는 전환 경로(마이그레이션 / cutover / family 순서 / 레거시 제거)는 본 문서 범위가 아니다 — 그 전환 설계는 [ADR-910](../910-rac-pencil-component-architecture.md)(cutover 실행 설계서)가 담당한다. 본 문서는 "조건(ADR-911 Status/Context/HC/SC)을 만족하는 컴포넌트 시스템이 정적으로 어떤 구조인가"만 1차 원리로 유도한다. `execute-adr` 착수 / phase land / mutation scope 산정에는 사용하지 않으며, ADR-910 실행 중 목표 구조 drift 를 판정하는 reference 로 사용한다.

## 설계 산출물 목차

1. [① 아키텍처 개요](#-아키텍처-개요) — 노드 데이터 + theme rule 위의 단일 공급원
2. [② Component Schema](#-component-schema) — `ComponentNode`(의미 props + `props.style` override)
3. [③ RAC primitive binding](#-rac-primitive-binding) — leaf = `PrimitiveBinding`, 조합 = reusable 문서
4. [④ Generic 렌더 레이어](#-generic-렌더-레이어) — traversal 1 + backend 2(DOM/Skia) + Interactive Projected Tree
5. [⑤ 편집 계약](#-편집-계약) — `resolveEditContract` 단일 진입점 + edit route
6. [⑥ 시각 SSOT](#-시각-ssot) — theme rule base ⊕ node override
7. [⑦ 컴포넌트 예시](#-컴포넌트-예시) — leaf / 조합 / collection
8. [⑧ 핵심 타입](#-핵심-타입)
9. [⑨ 조건 충족 증명 구조](#-조건-충족-증명-구조) — HC 1~7 ↔ 구조 1:1 대응

---

## ① 아키텍처 개요

목표 아키텍처는 **노드 데이터(의미 props + 시각 override) + theme rule** 위에 선다. 컴포넌트별 정의 객체는 존재하지 않는다.

```
                  ┌──────────────────────────────────────────────┐
                  │  Canonical 문서 (노드 트리)                   │
                  │  - 의미값:  node.props (content/variant/size) │
                  │  - 시각 override: node.props.style            │
                  │  - 조합:    reusable 문서 / ref / descendants │
                  └───────────────┬──────────────────────────────┘
                                  │ + theme rule base (컴포넌트 default)
                                  ▼
                  ┌──────────────────────────────────────────────┐
                  │  단일 공급원 — resolveEditContract(node)      │
                  │  base ⊕ override 병합 = 한 노드 + 한 rule     │
                  └───┬──────────┬───────────┬──────────┬─────────┘
            Props view  Style view   DOM/Publish   Skia editor
          (section 필터) (section 필터) toReactStyle  toSkiaStyle
                                                       + Projected Tree
```

**핵심**: 한 노드의 편집 가능한 값은 그 노드 하나에서 나오고(의미 props + `props.style` override), 시각 base 는 theme rule 에서 resolve 된다. 모든 소비처(Properties Panel / Style Panel / DOM / Skia / Publish)가 같은 노드 하나 + 같은 theme rule 을 공급원으로 삼는다. 컴포넌트별로 갈리는 것은 leaf binding 의 `accepts` 와 collection 의 projected tree 유무뿐이다.

---

## ② Component Schema

문서 노드는 의미값과 시각 override 를 보유한다. **base(컴포넌트 default)는 노드에 저장하지 않는다** — theme rule 에서 resolve 한다.

```ts
interface ComponentNode {
  id: string;
  type: string; // leaf primitive type 또는 frame
  props: {
    // 의미값 — content / variant / size / 상태 의도
    [semanticKey: string]: unknown;
    // 시각 override layer — 사용자가 base 를 덮어쓴 키만 담는다
    style?: {
      // 키 존재 = override, 키 부재 = base(theme rule) 따름
      fontSize?: TokenRef | number;
      fill?: TokenRef;
      padding?: SpacingValue;
      gap?: SpacingValue;
      cornerRadius?: number;
      [overrideKey: string]: unknown;
    };
  };
  children?: ComponentNode[];
  // 조합(reusable / ref / descendants / slot) — ③ 참조
  reusable?: boolean; // origin
  ref?: string; // instance → reusable id
  descendants?: Record<string, { props?: Partial<ComponentNode["props"]> }>; // instance override
  slot?: Record<string, string[]>; // 합성 슬롯
}
```

**base/override 2층 의미**:

- base = `resolveComponentRule(type, doc).sizes[size]` 등 theme rule resolve (노드 미저장)
- override = `node.props.style[key]` (키 존재 자체가 override 신호)
- 병합 = `props.style[k] ?? rule.resolve(k)` (override 우선, fallback base)
- reset-to-default = `delete props.style[k]` → base 복귀
- instance override = `descendants[path].props.style` = origin base 위 명시 patch layer

한 노드 안에 base+override 를 같은 키 공간에 섞지 않는다. base/override 분리는 **노드 간**(origin 노드 ↔ ref.descendants)이다.

---

## ③ RAC primitive binding

leaf 컴포넌트 = RAC primitive 1개당 `PrimitiveBinding` 하나(코드). 조합 컴포넌트 = `reusable:true` 노드 문서(데이터).

```ts
interface PrimitiveBinding {
  type: string; // leaf primitive type
  rac: {
    component: string; // react-aria-components export 이름
    states?: string[]; // data-* 상태 vocabulary (hover/pressed/selected/disabled)
    slots?: string[]; // RAC slot 메타
  };
  props: {
    accepts: Record<string, PropContract>; // D2 — 의미 props 계약
  };
}
```

binding 은 시각 / 변형 / 구조 필드를 갖지 않는다 — 시각은 theme rule, 변형은 `data-*`, 구조는 RAC 의 part/slot 메타데이터다. ARIA/키보드/포커스는 RAC 가 100% 소유하고 composition 은 `toRacProps(node)` 투영만 한다.

조합 컴포넌트는 binding 이 없다 — `reusable:true` 노드 문서로 표현되며, 신규 조합 컴포넌트 추가는 코드 변경 0(빌더 저작 후 reusable 승격)이다.

---

## ④ Generic 렌더 레이어

렌더는 (resolved canonical tree + theme)를 소비하는 generic 렌더러 하나다 — traversal 1개 + backend 2개(DOM / Skia).

### 4.1 단일 어댑터

```ts
// DOM/Publish backend
function toReactStyle(node: ComponentNode, doc: Document): React.CSSProperties;
// Skia backend
function toSkiaStyle(node: ComponentNode, doc: Document): Shape[];
```

두 어댑터는 같은 base(theme rule) ⊕ override(`props.style`) 병합값을 읽어 다른 표현(CSSProperties vs Shape)으로 투영하되, 시각 결과는 동일하다. override 우선 병합 · shorthand↔longhand 정규화 · Taffy 좌표 reader · token 해소가 어댑터 한 곳에 수렴한다.

D1 prop 투영은 별도 — `toRacProps(node)` 가 ARIA/키보드/포커스/슬롯을 `react-aria-components` export 에 전달한다.

### 4.2 Interactive Projected Tree (collection 깊은 노드)

빌더 Skia 화면은 미리보기가 아니라 직접 조작 editor 다. collection(ListBox/Table 등) 깊은 노드(row 내부 Text/Icon, Table cell)는 canonical 에 전부 materialize 하지 않되, Skia runtime 에서 hit-test·drill-in·edit-route 가능한 **projected tree**(`template subtree × visible data window`)로 존재한다.

```ts
// render-space 전용 — canonical 문서에 저장되지 않는다
interface ProjectedNodeRef {
  kind: "projected";
  projectionId: string; // render-space id (canonical mutation target 아님)
  ownerNodeId: string; // collection canonical 노드
  templateNodeId: string; // template subtree 안 원본 노드
  itemKey?: string;
  columnKey?: string;
  role: "row" | "cell" | "container" | "text" | "icon";
  editTarget: "template" | "data" | "override";
}
```

**render-space projected id 와 canonical write target 은 분리**한다 — projected id 는 canonical mutation / history / 영속 저장에 유입 금지이며, 편집은 template / data / override route 중 하나로 명시 변환된다. 10,000 row 도 canonical / Skia scene 에 전부 생성하지 않는다(viewport window + overscan).

---

## ⑤ 편집 계약

선택 노드의 편집 가능한 속성 전체는 `resolveEditContract(node)` 하나가 산출한다.

```ts
function resolveEditContract(node: ComponentNode, doc: Document): EditContract;

interface EditContract {
  // 의미 props 계약 ∪ props.style 키 공간 계약 (합집합)
  fields: PropContract[];
}

interface PropContract {
  key: string;
  kind: "enum" | "number" | "token" | "text" | "boolean" | "binding";
  section: "content" | "state" | "transform" | "appearance" | "layout";
  // ...
}
```

Properties Panel(`section ∈ {content, state}`)과 Style Panel(`section ∈ {transform, appearance, layout}`)은 그 결과를 `section` 태그로 필터링한 두 view 다 — 별도 store / 공급처가 없다. `props`(의미)와 `props.style`(시각 override)이 분리 저장돼 있어도 `resolveEditContract` 가 둘을 한 계약 집합으로 합쳐 노출하므로, 한 패널 편집이 다른 패널에 즉시 반영되고 round-trip 무손실이다.

### 5.1 edit route (projected 노드)

projected 노드 편집은 `ProjectedNodeRef.editTarget` 에 따라:

- `template` — collection template subtree 의 원본 노드 편집 (모든 row 에 반영)
- `data` — 해당 data item 값 편집
- `override` — 특정 row 의 instance override

모든 route 는 `projectionId`(render-space)를 canonical write target(`ownerNodeId` + `templateNodeId` + `itemKey`)으로 변환한 뒤에만 mutation 을 발행한다.

---

## ⑥ 시각 SSOT

시각 정본은 theme/tokens 다. 컴포넌트당 `visual` 필드를 두지 않는다.

- **base** = theme rule (`resolveComponentRule(type, doc)` + `resolveToken(ref, doc)`) — 컴포넌트 default 시각(색상/크기/폰트/형태/레이아웃)
- **override** = `node.props.style` — 사용자가 base 를 덮어쓴 키
- DOM 과 Skia 두 backend 가 같은 base ⊕ override 를 읽어 시각 결과의 동일성을 산출한다(D3 symmetric consumer)

theme 는 다축(Accent / Base / Mode)이며 token 값은 theme 조합별로 resolve 된다.

---

## ⑦ 컴포넌트 예시

### leaf — Button

```
PrimitiveBinding {
  type: "Button",
  rac: { component: "Button", states: ["hover","pressed","disabled"] },
  props: { accepts: { children: {kind:"text"}, variant: {kind:"enum"}, size: {kind:"enum"} } }
}
```

노드: `{ type:"Button", props:{ children:"Save", variant:"primary", size:"sm", style:{ fontSize:14 } } }`
→ base(theme rule sm) ⊕ override(`fontSize:14`) → DOM `<Button>` + Skia box+text 동일 시각.

### 조합 — Card (reusable 문서)

코드 정의 없음. `reusable:true` frame 노드 + children(Heading/Body/Button). instance 는 `{ type:"ref", ref:"card-1", descendants:{ ... } }`.

### collection — ListBox

`items` 배열 × template subtree → Interactive Projected Tree(④.2). Skia 가 visible window 의 각 row 를 projected 노드 tree 로 그리고, row 내부 Text/Icon 클릭 → deepest projected 노드 선택 → drill-in / edit route.

---

## ⑧ 핵심 타입

| 타입                                    | 역할                                           | 신규/재사용   |
| --------------------------------------- | ---------------------------------------------- | ------------- |
| `ComponentNode`                         | 문서 노드(의미 props + `props.style` override) | 목표 schema   |
| `PrimitiveBinding`                      | leaf RAC primitive 정의(~35)                   | 목표 schema   |
| `EditContract` / `PropContract`         | 편집 계약(의미 ∪ 시각 키 합집합)               | 목표 schema   |
| `ProjectedNodeRef`                      | collection 깊은 노드 render-space 참조         | 목표 schema   |
| `resolveEditContract`                   | 편집 단일 진입점                               | 목표 resolver |
| `toReactStyle` / `toSkiaStyle`          | base⊕override → DOM/Skia 단일 어댑터           | 목표 resolver |
| `resolveComponentRule` / `resolveToken` | theme rule base resolve                        | 목표 resolver |
| `toRacProps`                            | D1 prop 투영                                   | 목표 resolver |

> 본 표는 목표 아키텍처의 정적 타입 구성이다. 각 타입을 현재 코드에서 어떻게 도입/전환하는가는 본 문서 범위가 아니다(ADR-910 cutover 설계서).

---

## ⑨ 조건 충족 증명 구조

ADR-911 본문 Hard Constraints 1~7 이 본 목표 구조에서 어떻게 충족되는지 1:1 대응:

| HC   | 조건                          | 충족 구조                                                        |
| ---- | ----------------------------- | ---------------------------------------------------------------- |
| HC#1 | 단일 공급원 SSOT              | ② 노드 하나 + theme rule, ⑤ `resolveEditContract` 단일 진입점    |
| HC#2 | 패널 = 단일 공급원 두 view    | ⑤ `section` 필터 두 view(저장 평면화 불필요)                     |
| HC#3 | base / override 2층 schema    | ② `props.style[k] ?? rule.resolve(k)` 병합 + 노드 간 분리        |
| HC#4 | Skia 60fps + 정확한 텍스트    | ④.1 단일 어댑터 + ④.2 projected tree windowing(viewport culling) |
| HC#5 | 조합 컴포넌트 데이터 표현     | ③ reusable 문서(코드 정의 없음)                                  |
| HC#6 | RAC 절대 권위                 | ③ `toRacProps` 투영만, ARIA 수동 작성 0                          |
| HC#7 | Skia projected 하위 노드 접근 | ④.2 Interactive Projected Tree + ⑤.1 edit route                  |
