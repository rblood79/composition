# ADR-910 Breakdown: RAC core + Pencil format 1차 원리 컴포넌트 아키텍처

> 본 문서는 [ADR-910](../910-rac-pencil-component-architecture.md) 의 구현 상세 — 설계 산출물 ①~⑩.
> ADR 본문(Risk-First)에는 결정·대안·위험만 두고, 설계 본문 전체는 이 breakdown 에 분리한다(adr-writing.md 스캐폴딩 규칙).
>
> **생성 방식**: RAC core 개발 방법론(data/render 분리 + 접근성 hooks) + Pencil app/format 방법론(canonical document = 보편 속성 + reusable/ref/descendants/slot)을 1차 원리로 백지 재유도 → 영역별 병렬 설계 → **적대적 정합 검증**(RAC/Pencil/코드베이스 grep 대조) → 정정 합성. 7 영역 전부 검증 후 정정됨(major-issues 3 / minor-issues 4). 검증이 잡아낸 핵심 정정: Pencil 노드 실측 8종(11종 아님), `ResolvedNode` 에 computed 필드 없음(resolve 는 ref→descendants→slot 까지), `resolveToken` 현재 light/dark binary(다축 best-match 는 신규), Stroke wire 형태 `{align,fill,thickness}`, SSOT 보장 근거 = "단일 노드 computed" 가 아니라 "두 backend 가 동일 `componentRulesTable` + 동일 `resolveToken` 호출".
>
> **ADR-142 와의 관계**: 본 설계는 ADR-142(Accepted 2026-05-30) 를 supersede 하지 않는다. 같은 1차 원리에서 출발하므로 **end-state 가 수렴**하며, 본 문서는 그 목표 상태를 외부 방법론 언어로 재서술한 독립 설계다. ADR-142 HC#4(canonical schema 불변)를 준수 — 기존 `CanonicalNode.type=ComponentTag` + `props` bag 모델 위에서 설계한다.
>
> **상태**: 설계 문서 (코드 변경 아님). 실행은 ADR-142 cutover 경로와 합류.

---

## 목차

- [① 전체 아키텍처 개요 + ② Format Schema (SSOT 구조)](#영역-1)
- [③ RAC → Internal Format 변환 레이어](#영역-3)
- [④ Skia Rendering Layer (Virtualization + Culling + Text)](#영역-4)
- [⑤ Style & Properties Panel 연동](#영역-5)
- [⑥ Publishing / Preview 데이터 흐름](#영역-6)
- [⑦ 대표 컴포넌트 Format 예시](#영역-7)
- [⑧ TypeScript 타입 정의](#영역-8)
- [⑨ 장단점 및 트레이드오프 + ⑩ 구현 우선순위 / Roadmap](#영역-9-10)

---

<a id="영역-1"></a>

# ① 전체 아키텍처 개요 + ② Format Schema (SSOT 구조) — 정정본

> 본 설계는 composition 내부 누적 부채(현행 `*.spec.ts`, family cutover 절차, 전환기 adapter)를 출발점으로 삼지 않는다. 두 외부 검증 자산 — **Adobe React Aria Components(RAC)의 data/render 분리 + 접근성 hooks 아키텍처** 와 **Pencil canonical document format(보편 속성 + reusable/ref/descendants/slot)** — 을 1차 원리로 백지 재유도한 결과를 ADR-142 end-state 언어로 재서술한다.
>
> **정정 핵심 (적대적 검증 5건 전수 수용)**: 실제 `composition-vocabulary.ts:16-18` / `composition-document.types.ts:302-380` / `canonical-resolver.types.ts:107-118` / `tokenResolver.ts:21` / `catalog/types.ts:175-202` 및 `ADR-142 HC#4`(142-...-cutover.md:46)를 코드로 재확인한 결과, 원설계의 (1) "8 primitive node 를 core discriminator 로" (2) "~40 typed 보편 필드 베이스" (3) "ResolvedNode.computed 가 박힌 단일 노드를 4 backend 가 소비" (4) "`$--accent` 다축 best-match resolveToken 을 composition 채택 함수로" (5) "ComponentCatalogEntry 에 cutover 누락" 다섯 항목이 모두 실제 schema/정책과 충돌했다. **5건 전부 검증자 지적이 정확하며 1차자료 오독이 아니다** — 아래에서 전부 정정했다. ADR-142 는 HC#4 로 canonical schema 를 명시적 범위 밖으로 못박았으므로(`CanonicalNode.type=ComponentTag` + `props` bag 유지), 본 설계의 도착점은 **기존 canonical schema 와 동일 구조**다. Pencil/RAC 1차 원리에서 출발하되 schema 를 변경하지 않는다.

---

## ① 전체 아키텍처 개요

### 1.1 핵심 명제 (한 문장)

> **컴포넌트는 코드 정의 파일이 아니다.** leaf 컴포넌트는 RAC primitive 1개당 1개의 `PrimitiveBinding`(코드, 약 35개)이고, 조합 컴포넌트는 `reusable: true` 노드 문서(데이터)다. **단일 SSOT 공급처 = `CompositionDocument`(canonical document) + 그것이 참조하는 build-time 불변 테이블(`componentRulesTable` / `componentCatalog`)** 이며, 모든 consumer(DOM 렌더 / Skia 렌더 / Properties Panel / Publishing)는 이 한 공급처에서 같은 값을 받는다.

이 명제는 두 외부 원리의 합류점이다:

- **Pencil 원리**: 87개 컴포넌트가 코드 0줄로 노드 type + 보편 속성집합만으로 표현된다. 컴포넌트별 type 이 없다 → 컴포넌트별 정의 파일이 불필요하다는 실증.
- **RAC 원리**: RAC primitive 는 unstyled accessible shell 이고, 시각은 100% CSS 토큰(`data-variant`/`data-pressed`)이 결정한다. 즉 "코드"가 책임지는 것은 D1(접근성/DOM 구조)뿐이고, D3(시각)는 데이터(token)다 → leaf 코드는 얇은 binding 이면 충분하다는 실증.

두 원리를 합치면: **코드는 leaf D1 binding(~35개) 만 갖고, 조합과 시각은 전부 데이터다.**

> **정정 ①-a (검증 지적 2 수용 — ADR-142 HC#4 수렴)**: 원설계는 명제 안에서 schema 변경 여지를 남겼으나, ADR-142 HC#4 가 "canonical schema(`CompositionDocument`, `CanonicalNode.props`, reusable/ref/descendants/slot)는 변경하지 않는다. 본 ADR 범위 밖이다"(142-...-cutover.md:46)로 못박았다. 따라서 본 설계의 SSOT 공급처는 **기존 schema 그대로** — UI 트리는 `CanonicalNode.type=ComponentTag` 노드이고, 시각 차원(`size`/`variant`/`fill`)은 `CanonicalNode.props` 에 담긴다. "8 primitive node 로 트리를 재구성한다"는 별도 ADR scope(HC#4 명시적 제외 영역)이며 본 설계에서 제거한다.

### 1.2 두 철학이 만나는 지점

```
RAC 철학                              Pencil 철학                         합류점 (composition)
─────────────────────────────────    ──────────────────────────────    ──────────────────────────────
data/render 분리                   ↔  canonical document = 데이터       문서가 SSOT, 렌더는 순수 함수
  <Collection items={...}>            { children:[...], reusable, ref }    document → resolve → render
접근성 hooks (useButton 등)        ↔  type:"ref" 합성 / slot 채우기     leaf=RAC(D1), 조합=ref 문서
  RAC primitive = D1 권위             보편 속성 = props bag                leaf binding(코드) ↔ reusable(데이터)
시각 = CSS 토큰 (data-*)           ↔  variables = 다축 theme 토큰 배열   D3 = token SSOT (양 backend 공유)
  var(--accent), data-variant         "$--accent" 참조 (wire) + theme 축    componentRulesTable + resolveToken
```

**가장 중요한 합류**: RAC 의 "시각은 `data-variant` + CSS"와 Pencil 의 "시각은 `$--token` + theme 축"은 같은 것의 두 표현이다. composition 은 이 둘을 **하나의 D3 token 공급처**로 통합한다 — DOM backend 는 `data-*` + CSS 변수로, Skia backend 는 같은 token 을 직접 resolve 해서 그린다. 다만 **두 backend 가 같은 token 을 보장받는 메커니즘은 "단일 ResolvedNode 에 박힌 computed 값"이 아니라 "두 backend 가 동일 `componentRulesTable` + 동일 `resolveToken` 을 호출"한다는 점**이다(정정 ①-c 참조).

### 1.3 데이터 흐름 다이어그램 (ASCII) — 정정본

> **정정 ①-c (검증 지적 3 수용 — resolve 단계 ①~③ 한정 + 시각/토큰을 backend-entry 공통 단계로 분리)**: 실제 `resolveCanonicalDocument`(apps/builder/src/resolvers/canonical/index.ts:8-9, 58-63)의 처리 순서는 주석에 박제된 대로 **`ref resolve → descendants apply → slot contract validate → resolved tree`** 까지다. 실제 `ResolvedNode`(canonical-resolver.types.ts:107-118)는 `CanonicalNode` + `_resolvedFrom` + `_overrides` + children 뿐 — `computed`/`dataAttributes`/`variantState` 필드가 **없다**. prop default 병합·token resolve·시각 산출(fontSize 계산)은 resolve 하류의 **각 backend 진입 직전 공통 단계**다: Skia 는 builder 가 `resolveSkiaVisualRule(type, variant)` → `resolveComponentRule`(build-time `componentRulesTable`) 로 `ComponentVisualRule` 을 얻어 `buildCatalogShapes(visual, props, size, ...)` 에 주입(buildCatalogShapes.ts:38, resolveSkiaVisualRule.ts:50-55). 토큰은 이 시점에 `{color.X}` 문자열로 남아 하류 `specShapesToSkia` 단계에서 `resolveToken` 으로 해소된다. 따라서 SSOT 보장 근거를 "computed 박힌 단일 ResolvedNode"에서 "두 backend 가 동일 `componentRulesTable` + 동일 `resolveToken` 호출"로 재서술한다.

```
                          ┌──────────────────────────────────────────────────────────────┐
                          │                      SSOT 단일 공급처                          │
                          │                                                                │
                          │   CompositionDocument (canonical, IndexedDB primary)           │
                          │   ├─ children: CanonicalNode[]   ← UI 트리 (데이터)            │
                          │   │    ├─ { type:"Button", props:{ size, variant, ... } }      │
                          │   │    │       (type=ComponentTag, 시각 차원은 props 에)        │
                          │   │    ├─ { type:"ref", ref, descendants } (instance)          │
                          │   │    └─ { type:"frame", reusable:true } (origin = 조합)       │
                          │   ├─ themes / tokens (TokensTable)  ← "$var" 참조 대상          │
                          │   ├─ events / actions               ← behavior root collection  │
                          │   └─ imports                        ← 외부 reusable 참조        │
                          │                                                                │
                          │   + build-time 불변 동반 테이블 (문서에 저장 안 함)            │
                          │   ├─ componentCatalog : type → {kind, family, cutover,          │
                          │   │                       binding|reusableId, panel} (단일 등록)│
                          │   └─ componentRulesTable : type → ComponentRule (D3 시각 SSOT)  │
                          │       (packages/specs generated/componentRulesTable.ts)         │
                          └───────────────────────────────┬──────────────────────────────┘
                                                          │
                                                          ▼
        ┌──────────────────────────────────────────────────────────────────────────────────┐
        │            RESOLVE 레이어 (순수 함수, backend 무관) — resolveCanonicalDocument      │
        │            처리 순서 = HC#3 박제: ref → descendants → slot                          │
        │                                                                                    │
        │   ① ref resolve   : {type:"ref"} → origin reusable subtree 복제                    │
        │   ② descendants   : 3-mode override 적용 (속성 patch / 노드 교체 / children 교체)  │
        │   ③ slot validate : slot host contract 검증 + descendants children 주입            │
        │                                                                                    │
        │   ⇒ ResolvedNode[] = CanonicalNode + _resolvedFrom + _overrides + children          │
        │      (computed / dataAttributes / variantState 필드 없음 — token 미해소 상태)       │
        └───────────┬───────────────────┬───────────────────┬──────────────────┬───────────┘
                    │                   │                   │                  │
                    ▼                   ▼                   ▼                  ▼
        ┌───────────────────┐ ┌───────────────────┐ ┌────────────────┐ ┌────────────────────┐
        │  DOM 렌더 backend  │ │  Skia 렌더 backend │ │ Properties Panel│ │   Publishing        │
        │ (Preview/Publish)  │ │ (Builder 화면)     │ │  (Inspector)    │ │  (정적 export)      │
        │                    │ │                    │ │                 │ │                    │
        │  ④ rule 해소:       │ │  ④ rule 해소:       │ │  binding.accepts│ │  DOM backend 재사용 │
        │   CSSGenerator 가   │ │   resolveSkia       │ │  | reusable     │ │   → resolved tree   │
        │   componentRules    │ │   VisualRule(type,  │ │  propsSchema    │ │   → HTML/CSS 직렬화  │
        │   Table 소비        │ │   variant) →        │ │  → PropContract │ │                    │
        │  ⑤ token 해소:      │ │   ComponentVisual   │ │  → 편집 필드    │ │  같은 componentRules│
        │   data-* + CSS var  │ │   Rule              │ │  (computed 아님) │ │  Table + resolveToken│
        │   (resolveToken     │ │  → buildCatalog     │ │                 │ │  → SSOT 동일 값     │
        │    빌드시 emit)     │ │   Shapes(visual,..) │ │                 │ │                    │
        │                    │ │  ⑤ specShapesToSkia │ │                 │ │                    │
        │                    │ │   에서 resolveToken  │ │                 │ │                    │
        │                    │ │  + Viewport Culling  │ │                 │ │                    │
        │                    │ │  + Virtualization    │ │                 │ │                    │
        └───────────────────┘ └───────────────────┘ └────────────────┘ └────────────────────┘
              │                       │                      │                    │
              └───────────────────────┴──────────────────────┴────────────────────┘
                                          ▲
                                          │ (편집 write-back)
                          Inspector 편집 / Skia drag → CompositionDocument mutation
                          → resolve 재실행 → 4 consumer 가 동일 rule 테이블/토큰 재호출
                          → 즉시 동일 반영 (SSOT 단일 반영)
```

**다이어그램이 증명하는 SSOT 4원칙 (정정본)**: `button.size="sm"` 으로 노드 `props.size` 를 바꾸면 → resolve 레이어는 ref/descendants/slot 만 처리해 `ResolvedNode`(props 그대로) 를 산출하고 → **각 backend 가 진입 직전에 동일 `componentRulesTable["Button"].sizes.sm.fontSize = 14` 를 읽어** DOM(CSSGenerator `[data-size=sm]{font-size:14px}`) / Skia(`resolveSkiaVisualRule`→`buildCatalogShapes`→`specShapesToSkia` 의 `paragraph.fontSize=14`) / Panel(size 필드 "sm" 표시) / Publishing(DOM backend 재사용으로 `font-size:14px` 직렬화) 이 **동일 값**으로 반영된다. 시각 대칭의 보장점은 "단일 노드에 14 가 박혀 있어서"가 아니라 **"두 렌더 backend 가 같은 rule 테이블 심볼과 같은 `resolveToken` 을 호출해서"**다. rule 테이블의 `sm.fontSize` 또는 노드 `props.size` 를 바꾸면 모든 곳이 한 번에 바뀐다.

> **검증 필요 (명시적 변경 표기)**: 만약 향후 "resolve 단계에서 computed/dataAttributes 를 한 번 계산해 모든 backend 에 공유"하는 모델을 도입하려면, 그것은 `ResolvedNode` 에 신규 필드를 추가하는 **schema 변경**이다. 현재 코드(canonical-resolver.types.ts:107-118)에는 없으므로 본 설계는 도입하지 않는다. 두 backend 의 token 호출 일관성은 build-time `componentRulesTable` 단일 생성 + `resolveToken` 단일 구현으로 이미 보장된다.

### 1.4 레이어 책임 분리 (3-Domain 정합)

| 레이어 | 책임 | SSOT/권위 | 외부 원리 근거 |
| --- | --- | --- | --- |
| **Document layer** | UI 트리 + 조합 + 데이터 | `CompositionDocument`(canonical), `type=ComponentTag` + `props` | Pencil — document = 데이터, 컴포넌트별 정의 파일 없음 |
| **D1 접근성·상호작용** | DOM 구조 / ARIA / 키보드 / 포커스 | RAC primitive (절대) | RAC — unstyled accessible shell, leaf binding 이 흡수 |
| **D2 Props/API** | 편집 가능 prop 계약 | `PropContract`(binding.accepts / reusable propsSchema) | RAC props + RSP 참조, generic Inspector 가 소비 |
| **D3 시각** | 색·크기·폰트·형태 | `tokens` + `componentRulesTable`(양 backend 공유) | RAC(CSS token) + Pencil(다축 variables) 합류 |
| **Render backend** | 픽셀 산출 (순수 함수) | resolve 결과 소비자(대칭) — 각자 rule/token 재호출 | RAC(data/render 분리) + Pencil(노드 그림) |

핵심: **레이어 간 경계 교차 금지.** Document/D2/D3 는 데이터(문서 + 불변 테이블), D1 은 RAC 코드(leaf binding), render backend 는 순수 함수. 이 분리가 "컴포넌트별 정의 파일 0개"를 가능하게 한다 — 컴포넌트는 어느 레이어에도 "자기 파일"을 갖지 않고, 각 레이어의 일반 메커니즘에 데이터로 참여할 뿐이다.

### 1.5 leaf vs 조합 — 코드/데이터 경계

```
leaf 컴포넌트 (코드, ~35개)                    조합 컴포넌트 (데이터, N개)
────────────────────────────                  ──────────────────────────
PrimitiveBinding                              reusable: true 노드 문서
 = RAC primitive(D1) 1:1 매핑                  = type=ComponentTag 노드 + ref + slot 조합
 예: Button / TextField / Checkbox             예: "Button/Destructive" / "Card" / "Login Form"
 source: {kind:"rac", component:"Button"}       { type:"frame", reusable:true, children:[...] }
 binding.props.accepts: D2 편집 계약            reusable propsSchema(x-composition): D2 편집 계약
                                               instance: { type:"ref", ref:"<id>", descendants }
RAC 로 환원 불가한 leaf만 internal source        조합은 코드 0줄 — 데이터로만 정의/편집/배포
 예: Icon (Lucide SVG, kind:"internal")
```

**RAC 원리에서 leaf 경계 유도**: RAC 가 제공하는 unstyled primitive 목록(Button/TextField/Select/...)이 곧 leaf 목록이다. RAC 가 D1 을 책임지므로 composition 은 그 위에 prop 투영(`binding.props.toRacProps`)만 얹는다. RAC primitive 가 없는 leaf(아이콘 등)만 `internal` source 로 탈출구를 둔다.

**Pencil 원리에서 조합 경계 유도**: Pencil 의 `reusable:true` 노드가 곧 "컴포넌트 정의"이고 `{type:"ref"}` 가 곧 "인스턴스"다. composition 은 이 메커니즘을 그대로 채택해 조합 컴포넌트를 코드가 아닌 데이터로 정의한다. "아이콘이 붙은 Button"은 leaf Button 을 확장하는 코드가 아니라, Button leaf + Icon leaf 를 children 으로 갖는 reusable 노드 문서다.

---

## ② Format Schema (SSOT 구조)

### 2.1 설계 1차 원리 — "모든 노드가 같은 props bag 을 공유"

> **정정 ②.1 (검증 지적 1 수용 — type 값 공간 = ComponentTag, pencil primitive 는 adapter 흡수)**: 원설계의 "노드 type = 8 primitive(frame/text/icon_font/...) + ref" 는 실제 `composition-vocabulary.ts:14-21` 정책을 정확히 반대로 뒤집은 것이었다. 실제 정책(ADR-903 §type vocabulary policy): `CanonicalNode.type` 의 값 공간은 **`ComponentTag` = composition Component 118개 + pencil 공용 구조 3개(`ref`|`frame`|`group`) = 121 literal** 이고, pencil primitive 10종(`rectangle`/`ellipse`/`line`/`polygon`/`path`/`text`/`note`/`prompt`/`context`/`icon_font`)은 **"import/export adapter 경유만 등장, 값 공간에서 제외"**(vocabulary.ts:17-18)다. 즉 Pencil 의 primitive node 는 'composition 이 채택한 type 값 공간'이 아니라 '**import/export adapter 가 `frame` + `props` 로 흡수하는 외부 표현**'이다.

Pencil format 실측(`docs/migrations/shadcn-design-system.json`, 87 컴포넌트)에서 확인한 핵심: **모든 노드가 같은 보편 속성집합을 공유한다(CSS 처럼 — 값만 다름). 컴포넌트별 분기가 데이터에 0건이다.** composition 은 이 1차 원리를 **type 값 공간이 아니라 props payload 차원에서** 충족한다:

```typescript
// ── 노드 type 값 공간 (실제 정본 — composition-vocabulary.ts) ──────────
// 정책: ComponentTag = composition Component 118 + pencil 구조 3 = 121 literal.
//   pencil primitive 10종은 import/export adapter 경유만 — 값 공간 제외.
export type ComponentTag =
  // composition Component (118, capitalized)
  | "Button" | "TextField" | "Card" | "Checkbox" | "ListBox" | "Select"
  | "ComboBox" | "Table" | "Tree" | /* ... 118개 ... */ "ToggleButton"
  // pencil 공용 구조 타입 (3, lowercase)
  | "ref"      // instance (origin 참조)
  | "frame"    // canonical layout container (ADR-130)
  | "group";   // RAC ARIA Group (D1 semantic)

// CanonicalNode.type 은 이 ComponentTag 단일 값 공간만 쓴다.
// Pencil import: rectangle/ellipse/text/icon_font/... → adapter 가 frame|Image|Icon 등
//   ComponentTag 노드 + props 로 흡수. export: 역방향. (값 공간 교차 0)
```

이것이 schema 의 제1 결정이다: **컴포넌트별 schema 분기를 절대 만들지 않는다. 컴포넌트별 typed 필드가 0이며, 모든 노드가 같은 `props: Record<string, unknown>` bag 을 공유한다(아래 2.2).** "모든 노드가 같은 보편 속성집합"이라는 Pencil 원리는 **type 을 8 primitive 로 줄이는 방식이 아니라, 컴포넌트별 typed 필드를 두지 않고 단일 props bag 으로 흡수하는 방식**으로 충족된다. 두 길은 결과가 같다(컴포넌트별 분기 0) — 그리고 후자만 ADR-142 HC#4(schema 불변) 와 실제 vocabulary 정책을 동시에 만족한다.

### 2.2 보편 속성 = `CanonicalNode.props` 자유 payload (typed 필드 아님)

> **정정 ②.2 (검증 지적 1 수용 — ~40 typed 필드 베이스 제거, props bag 으로 재서술)**: 원설계의 "`CanonicalNode` 베이스가 `x/y/width/height/fill/stroke/layout/gap/fontSize/...` 약 40개 typed 보편 필드를 갖는다"는 실제 schema(`composition-document.types.ts:302-380`)와 정면 충돌하는 신규 schema 였다. 실제 `CanonicalNode` 에는 그런 기하/시각/레이아웃 typed 필드가 **하나도 없다** — 그 값들은 전부 `props: Record<string, unknown>`(line 336) 과 `props.style` 에 담긴다. Pencil 의 "보편 속성집합" 원리는 **typed 필드 집합이 아니라 '컴포넌트별 typed 필드 0 + 단일 자유 payload 공유'**로 충족된다. 아래는 실제 schema 정본을 그대로 채택한 것이다.

```typescript
/**
 * `CanonicalNode` — composition canonical tree 의 모든 노드 베이스 (실제 schema 정본).
 *
 * Pencil "보편 속성집합" 원리 충족 방식: 컴포넌트별 typed 필드 0건. 모든 노드가
 * 같은 props bag(+ props.style)을 공유 — frame/Button/text 가 전부 같은 키 공간을 쓴다.
 * 기하/시각/레이아웃(x/y/width/fill/gap/fontSize 등)은 typed 필드가 아니라 props/props.style payload.
 *
 * 컴포넌트별 schema 분기 금지 — 분기는 type discriminant 의 좁은 추가 필드(FrameNode.clip 등)만.
 */
export interface CanonicalNode {
  /** 노드 고유 식별자. slash("/") 금지 — descendants key path 구분자와 충돌. */
  id: string;

  /** 노드 타입 discriminator. 값 공간 = ComponentTag (121 literal). */
  type: ComponentTag;

  /** 사용자 표시 이름 (모든 노드 — Pencil name 보편). reusable 전용 componentName 을 확장 통합. */
  name?: string;

  /**
   * **component props payload (canonical SSOT — ADR-116 G1 §2.1)**.
   *
   * Button/TextField/Section 등 component semantics 의 최종 저장 위치.
   * 보편 속성(x/y/width/height/fill/stroke/gap/padding/alignItems/fontSize/content/...)은
   * 전부 여기(또는 props.style) 에 담긴다 — Pencil 보편집합과 1:1, 단 typed 필드가 아닌 payload.
   *
   * 저장 가능: serializable JSON (string/number/boolean/null/object/array).
   * 저장 금지: function callback / React element / events·actions·dataBinding (x-composition 분리).
   */
  props?: Record<string, unknown>;

  /** Extensibility hook — adapter/roundtrip metadata. props extraction source 로 사용 금지. */
  metadata?: { type: string; [k: string]: unknown };

  /** true 이면 재사용 원본(origin). 인스턴스는 type:"ref" 로 참조. */
  reusable?: boolean;

  /** 자식 노드 배열. */
  children?: CanonicalNode[];

  /**
   * slot 선언 — pencil.dev 공식: false | string[].
   * - false: slot 비활성화
   * - string[]: 이 slot 에 삽입 가능한 reusable component ID 배열(추천 목록)
   * frame 외 frame-호환 shell(CardContent 등)에도 보존, 비-shell 은 resolver 가 무시.
   */
  slot?: false | string[];

  /** 노드별 theme override (ADR-021). 예: { mode:"dark", tint:"blue" }. */
  theme?: { mode?: string; tint?: string; [axis: string]: string | undefined };
}

// type 별 좁은 추가 필드 (보편 props bag + 최소 specialization — 실제 schema)
export interface FrameNode extends CanonicalNode {
  type: "frame";
  clip?: boolean;          // overflow:hidden (실제 schema 1차 필드)
  placeholder?: boolean;   // 빈 frame UI hint (slot 미충족 시)
}
export interface RefNode extends CanonicalNode {
  type: "ref";
  ref: string;             // origin reusable id (또는 "importKey:nodeId")
  descendants?: Record<string, DescendantOverride>;
}
```

> **근거 정합 확인**: Pencil 실측 빈도순 속성(`type/id/name/width/fill/x/y/stroke/children/height/reusable/alignItems/gap/content/fontFamily/fontSize/...`)은 본 schema 에서 **`props` payload 의 키**로 1:1 대응한다 — `node.props.width`, `node.props.fill`, `node.props.style.gap` 등. 실제 `CanonicalNode` 에 typed 필드로 올라온 것은 식별/트리/합성(`id/type/name/props/metadata/reusable/children/slot/theme`)뿐이고, 시각·기하·레이아웃은 전부 payload 다. 이로써 (1) Pencil "보편 속성 = 컴포넌트별 분기 0" 원리와 (2) 실제 schema(props bag) 가 **동시에 만족**된다.

### 2.3 토큰 SSOT — 3-layer 분리 (Pencil wire ↔ canonical ↔ spec 시각)

> **정정 ②.3 (검증 지적 4 수용 — `$--` 다축 best-match resolveToken 을 composition 채택 함수로 제시한 오류 정정. 3-layer 분리)**: 원설계는 Pencil wire 포맷(`$--accent` + 다축 value[] + best-match)을 composition 런타임 token 함수로 그대로 제시해 두 layer 를 혼동시켰다. 실제로는 **세 layer 가 다른 표기/시그니처**를 쓴다. 다축 best-match 는 현 composition `resolveToken` 에 **없으며**(현재 light/dark binary), 그것을 도입하려면 신규 변경이다 — '검증 필요'가 아니라 '명시적 변경'으로 표기한다. ADR-143 은 `variables → tokens` 정명만 했고 다축 resolve 는 도입하지 않았다.

토큰은 다음 3-layer 로 분리된다. 한 layer 의 표기를 다른 layer 의 함수에 넘기면 안 된다.

```typescript
// ── (1) Pencil wire layer — import/export adapter 경계에서만 존재 ──────
// 실측: variables 의 토큰값이 theme 축 조합별 배열. fill 에서 "$--accent" 로 참조.
//   "--accent": { type:"color", value:[ {value:"#f5f5f5"},
//       {theme:{Mode:"Dark"}, value:"#262626"}, {theme:{Base:"Slate",Mode:"Dark"}, ...} ] }
// 이 구조와 "$--" 구문, 다축 value[] 는 **Pencil wire 포맷**이지 composition 런타임이 아니다.
interface PencilTokenValueEntry { theme?: Record<string, string>; value: string | number | boolean; }
interface PencilTokenDefinition { type: "color" | "number" | "string" | "boolean"; value: PencilTokenValueEntry[]; }
type PencilTokenRef = `$${string}`;   // "$--accent" — wire 표기. import adapter 가 (2)로 변환.

// ── (2) canonical 내부 layer — 실제 schema (composition-document.types.ts) ─
// 토큰 정의는 단일 value (다축 배열 아님). 참조는 { $var: string } 객체.
export interface TokenDefinition {
  type: "color" | "number" | "string" | "boolean";
  value: string | number | boolean;   // ← 단일 값. Pencil 다축 array 와 다름.
}
export type TokensTable = Record<string, TokenDefinition>;   // CompositionDocument.tokens
export interface CanonicalTokenRef { $var: string }          // 예: { $var: "primary" } — fill 등에서 참조
//   (ADR-143 §3-3: 참조 구문 $var 는 유지, 타입명만 CanonicalTokenRef 로 정명)

// ── (3) spec 시각 토큰 layer — render backend 가 실제 색을 산출 ──────────
// 실제 resolveToken (packages/specs/src/renderers/utils/tokenResolver.ts:21):
//   brace 구문 { color.accent } + theme = "light" | "dark" binary.
export function resolveToken(
  ref: TokenRef,                         // 예: "{color.accent}" — brace 구문
  theme: "light" | "dark" = "light",     // ← binary. 다축 ActiveThemeSelection 아님.
): string | number {
  const match = ref.match(/^\{(\w+)\.(.+)\}$/);   // ^\{(\w+)\.(.+)\}$
  if (!match) return ref;
  const [, category, name] = match;
  switch (category) {
    case "color": return theme === "dark" ? darkColors[name] : lightColors[name];
    case "spacing": return spacing[name];
    case "typography": return typography[name];
    case "radius": return radius[name];
    case "shadow": return shadows[name];
    default: return ref;
  }
}
```

**layer 간 변환 책임**: (1)→(2) 는 **import adapter** 가 한다 — `$--accent` wire 참조와 다축 value[] 를 canonical `{ $var }` + `TokensTable`(현재 단일 value) 로 정규화. (2)→(3) 은 render backend 가 한다 — canonical 토큰을 spec `{color.X}` brace 구문으로 매핑해 `resolveToken(ref, theme)` 호출. **D3 시각 SSOT 의 binary theme(light/dark)이 현재 정본**이다.

> **명시적 변경 표기 (검증 필요 아님)**: 만약 Pencil 의 다축 theme(`Mode × Base × Accent` 조합별 값 + best-match)를 composition 런타임이 그대로 보존하려면, 그것은 `resolveToken` 시그니처를 `(ref, active: ActiveThemeSelection)` 로 바꾸고 `TokenDefinition.value` 를 다축 배열로 확장하는 **신규 작업**이다. 현재 코드(tokenResolver.ts:21)는 light/dark binary 이고, ADR-143 도 다축 resolve 를 도입하지 않았다. 본 설계는 다축 best-match 를 **별도 후속 변경으로 분리**하고, 현재는 binary 를 정본으로 적는다. (best-match 알고리즘 — 명시 축 일치 수 최대, 불일치 축 1개면 탈락 — 은 그 후속 변경의 설계 후보로 기록만 한다.)

#### `button.size="sm" → fontSize:14` 데이터 경로 (SSOT 4원칙 실증, 정정본)

```
[공급처]  CompositionDocument
          ├─ children: [{ type:"Button", props:{ size:"sm", variant:"primary" } }]   ← 노드 props
          └─ (동반, build-time) componentRulesTable["Button"].sizes.sm.fontSize = 14   ← D3 규칙
                            │
                            ▼  resolveCanonicalDocument (ref/descendants/slot 만)
[resolve] ResolvedNode {
            type:"Button",
            props:{ size:"sm", variant:"primary" },     ← props 그대로. computed 박지 않음.
            _resolvedFrom?, _overrides?
          }
                ┌───────────────┬───────────────────┬──────────────────┐
                ▼               ▼                   ▼                  ▼
[DOM]    CSSGenerator     [Skia]              [Panel]            [Publish]
          componentRules   resolveSkiaVisual    size 필드 = "sm"   DOM backend 재사용
          Table 소비        Rule("Button",        (props.size 표시)  → componentRulesTable
          → [data-size=sm]  "primary") →                            동일 소비
          {font-size:14px}  buildCatalogShapes  (computed 아닌
          (resolveToken     → specShapesToSkia    props 표시)
           빌드시 emit)      → paragraph.fontSize
                              = 14 (resolveToken)
                └───────────────┴───────────────────┴──────────────────┘
            모두 fontSize=14 — 단일 공급처(componentRulesTable + resolveToken), 즉시 동일 반영
```

공급처(rule 테이블 `sm.fontSize` 또는 노드 `props.size`)를 바꾸면 resolve 가 ref/descendants/slot 만 재실행하고, 각 backend 가 같은 rule 테이블·토큰을 재호출해 4 consumer 가 동일하게 갱신된다. **SSOT 보장점은 "단일 노드 computed"가 아니라 "단일 rule 테이블 + 단일 resolveToken"**이다.

### 2.4 reusable / ref / descendants / slot 스키마

Pencil 실측 메커니즘을 1:1 채택. 4개가 조합 컴포넌트 시스템 전부다(코드 0줄). 실제 schema(`composition-document.types.ts:230-380`)와 동일 구조다.

#### (a) reusable (origin = 조합 컴포넌트 정의)

```typescript
// reusable:true 노드 = 컴포넌트 정의. 코드 정의 파일 없음 — 데이터가 곧 정의.
// 시각 속성(layout/gap/padding/fill 등)은 props/props.style payload 에 담긴다.
const buttonDestructive: FrameNode = {
  id: "YKnjc",
  type: "frame",
  name: "Button/Destructive",
  reusable: true,                 // ← origin marker
  props: {
    style: {
      display: "flex", flexDirection: "row",
      columnGap: 8, rowGap: 8,
      paddingTop: 8, paddingRight: 16, paddingBottom: 8, paddingLeft: 16,
      borderRadius: 6,
      alignItems: "center", justifyContent: "center",
    },
    fill: { $var: "destructive" },   // 토큰 참조 (canonical CanonicalTokenRef)
  },
  children: [
    { id: "lbl", type: "Label", props: { children: "Delete", fill: { $var: "destructive-foreground" } } },
  ],
};
```

#### (b) ref (instance)

```typescript
// 실측: { id, ref:"<reusableId>", type:"ref", ... } — origin 을 참조하는 가벼운 노드.
const instance: RefNode = {
  id: "sODDz",
  type: "ref",
  ref: "YKnjc",                   // origin reusable id (또는 "importKey:nodeId")
  props: { style: { left: 0, top: 0 } },   // 위치 등도 props.style payload
};
```

#### (c) descendants (3-mode path-based override) — 실제 union 정본

```typescript
/**
 * descendants override — RefNode 가 origin 의 특정 자식을 path(slash 구분 key)로 가리켜 override.
 * 3-mode 상호배제 union (composition-document.types.ts:241-285).
 * resolver mode 판정: type 존재 → (B) / children 존재+type 없음 → (C) / 둘 다 없음 → (A).
 *   복수 조건 충족 시 resolver error (silent merge 금지).
 */
export type DescendantPatchMode = {           // (A) 속성 patch — id/type/children 전부 없음
  id?: never; type?: never; children?: never;
  [key: string]: unknown;
};
export type DescendantReplaceMode = CanonicalNode;   // (B) 노드 교체 — type 존재
export type DescendantChildrenMode = {        // (C) children 교체 — children 만 (slot fill)
  id?: never; type?: never; children: CanonicalNode[];
};
export type DescendantOverride =
  | DescendantReplaceMode
  | DescendantChildrenMode
  | DescendantPatchMode;

// 실측 예 (Destructive 변형의 chevron/text 색을 destructive 토큰으로 patch — mode A):
const destructiveInstance: RefNode = {
  id: "K53jF", type: "ref", ref: "<origin>",
  descendants: {
    "DeaWZ": { stroke: { fill: { $var: "destructive" }, thickness: 1.5 } },  // mode A (속성 patch)
    "W4UBy": { fill: { $var: "destructive" } },                              // mode A
    "h6oCR": { enabled: false },                                             // mode A (disable 특수)
  },
};
```

> **TypeScript intersection brand 함정 회피 (메모리 feedback-typescript-intersection-brand-trap)**: 위 3-mode union 은 `id?:never`/`type?:never` 구조적 배제로 컴파일 레벨에서 갈리지만, 직렬화된 JSON 에서 mode 판별은 **런타임 검사**(`"type" in o ? B : "children" in o ? C : A`)로 한다. 타입 brand 만으로 mode 분기를 강제하지 말 것 — resolver(`resolveCanonicalDescendantOverride`)는 런타임 discriminant 로 분기한다.

#### (d) slot (채울 자리)

```typescript
// 실측: { type:"frame", slot:["id1","id2","id3"] } — 삽입 가능한 reusable id 추천 목록.
// instance 가 descendants[slotPath].children 로 실제 내용을 채운다 (mode C).
const cardWithSlot: FrameNode = {
  id: "card-content", type: "frame",
  slot: ["24cM4", "jBcUh", "qCCo8"],   // 이 slot 에 넣을 수 있는 reusable 후보
  placeholder: true,                    // 비었을 때 placeholder UI
};
const cardInstance: RefNode = {
  id: "i1", type: "ref", ref: "<card-origin>",
  descendants: {
    "card-content": { children: [ /* 실제 내용 노드들 */ ] },  // mode C = slot fill
  },
};
```

### 2.5 PropContract 공유 — 조합(D2) ↔ leaf(D2)

조합 컴포넌트의 reusable propsSchema 와 leaf 의 `binding.props.accepts` 가 **같은 `PropContract` 타입**을 공유한다. generic Inspector 가 둘을 구분 없이 소비 → "스타일 패널이 모든 컴포넌트에 균일 적용".

```typescript
// 단일 prop 편집 계약 (leaf accepts 와 reusable propsSchema 공유) — catalog/types.ts 정본
export interface PropContract {
  kind: InspectorFieldKind;       // boolean|enum|string|string-array|number|icon|variant|size|fillStyle|binding
  label?: string;
  default?: unknown;
  section?: "content" | "appearance" | "state" | "locale" | (string & {});
  options?: Array<{ value: string; label: string }>;   // enum 전용 (variant/size 는 options 없음)
  min?: number; max?: number; step?: number;            // number 전용
  visibleWhen?: VisibilityCondition;                    // 조건부 가시성
}
export type PropsSchema = Record<string, PropContract>;

// generic Inspector (backend 무관) — ResolvedNode + componentCatalog 만 소비, 컴포넌트별 SectionDef 분기 0
export function buildInspectorFields(
  node: ResolvedNode,
  catalog: ComponentCatalog,
): InspectorFieldGroup[] {
  const entry = catalog[node.type];
  const schema: PropsSchema =
    entry.kind === "primitive" ? entry.binding.props.accepts
    : entry.kind === "reusable" ? resolveReusablePropsSchema(entry.reusableId)
    : {};                                  // native 는 빈 schema
  return groupBySection(schema);           // section 태그로 그룹핑
}
```

> **근거 (RAC)**: RAC props 는 D2 surface(variant/isDisabled/...). leaf `binding.props.accepts` 가 그 surface 를 PropContract 로 선언. **근거 (Pencil)**: 조합 컴포넌트도 편집 prop 을 노출해야 하므로 composition 이 `x-composition.propsSchema`(또는 reusable 노드 metadata)로 보강. 둘이 같은 타입이라 Inspector 가 단일 경로로 처리.

### 2.6 ComponentCatalog — 단일 등록 레지스트리 (6 레지스트리 대체) — cutover 포함 정정본

> **정정 ②.6 (검증 지적 5 수용 — `cutover: CutoverState` 필수 추가 + native 비대칭 + skiaLegacy 의미)**: 원설계 코드 블록은 `cutover` 를 누락했다. 실제 `ComponentCatalogEntry`(catalog/types.ts:175-202)의 primitive/reusable variant 는 `cutover: CutoverState('legacy'|'cutting-over'|'catalog')` 를 **필수**로 포함한다 — family 단위 atomic cutover 의 SSOT 축(types.ts:19, 31-35)이다. native variant 는 cutover 가 **없다**(metadata-only, `isCatalogCutover` 파생에서 제외, types.ts:200). 또 검증 지적 1 정정에 맞춰 `type` 도 `string`(런타임은 `ComponentTag` 값)로 두되, "8 primitive 와 RAC leaf 가 공존하는 hybrid" 라는 원설계 §2.6 단서는 **제거**한다 — type 값 공간은 `ComponentTag` 단일이고, 8 primitive 별 type 은 존재하지 않는다(정정 ②.1).

```typescript
// family / cutover 상태 (catalog/types.ts 정본)
export type ComponentFamily =
  | "primitives" | "fields" | "selection" | "collections"
  | "tree-table" | "overlays" | "date-color" | "composition-native";
/** cutover 진행 상태. 한 family 의 모든 entry 가 함께 legacy → cutting-over → catalog 를 거친다. */
export type CutoverState = "legacy" | "cutting-over" | "catalog";

// 컴포넌트 type → 단일 등록. legacy 6 레지스트리(spec/TAG_SPEC_MAP/specRegistry/
// factory/panel/renderer)를 이 하나로 대체. 등록 = catalog entry 추가뿐.
export type ComponentCatalogEntry =
  | { kind: "primitive";          // leaf RAC primitive (코드). binding 으로 정의.
      type: string;               // 런타임 값은 ComponentTag (예: "Button")
      family: ComponentFamily;
      cutover: CutoverState;       // ← 필수. family atomic cutover SSOT 축.
      binding: PrimitiveBinding;
      panel: PanelMeta;
      /** true 면 cutover 됐어도 Skia 만 legacy render.shapes 유지(DOM/Inspector 는 catalog). collection 용. */
      skiaLegacy?: boolean; }
  | { kind: "reusable";           // 조합 컴포넌트 (데이터). reusableId 가 canonical reusable 문서 참조 — 코드 0줄.
      type: string;
      family: ComponentFamily;
      cutover: CutoverState;       // ← 필수.
      reusableId: string;
      panel: PanelMeta;
      skiaLegacy?: boolean; }
  | { kind: "native";             // composition-native(frame/Slot/MaskedFrame). 이미 canonical-native 렌더.
      type: string;
      family: ComponentFamily;
      /** cutover 개념 없음(metadata-only) — isCatalogCutover/isCatalogSkiaCutover 파생에서 제외. */
      panel: PanelMeta; };
export type ComponentCatalog = Record<string, ComponentCatalogEntry>;
```

이 구조가 1.5 의 "leaf=코드 / 조합=데이터" 경계를 코드로 못박는다. `primitive` 는 `binding`(코드), `reusable` 은 `reusableId`(canonical 데이터 참조), `native` 는 metadata-only 다. render backend 는 `entry.kind` 로 dispatch 한다. **`cutover` 는 family 단위 atomic 전환의 SSOT 축**이라 단순 메타가 아니라 등록 모델의 핵심 필드다 — `isCatalogCutover(type)` 게이트가 catalog 경로 dispatch 여부를 결정하고, native 는 이 게이트에서 제외된다.

- **skiaLegacy 의미 (1줄)**: cutover 됐어도 Skia 렌더만 legacy `render.shapes` 를 유지한다 — collection(ListBox/Select/Table 등)은 items 배열을 순회해 multi-item 리스트를 그리는데 Skia generic 렌더러(`buildCatalogShapes` box+text)가 아직 못 그리기 때문. DOM(RAC items 자동 합성)/Inspector 는 catalog generic, Skia 만 부분 cutover.

### 2.7 CompositionDocument root — SSOT 컨테이너 (실제 schema 정본)

```typescript
export interface CompositionDocument {
  version: string;                          // 네임스페이스 고정
  children: CanonicalNode[];                // UI 트리 (type=ComponentTag 노드, props bag)

  // D3 시각 SSOT
  tokens?: TokensTable;                     // { $var } 참조 대상 (단일 value, ADR-143 정명)
  themes?: ThemeSnapshot;                   // 활성 theme (ADR-021/110) — 현재 mode/tint 중심
  componentRules?: ComponentRulesTable;     // 문서별 시각 규칙 override (기본은 build-time componentRulesTable)

  // 외부 참조
  imports?: Record<string, string>;         // "importKey" → 외부 canonical/.pen 경로

  // behavior root collection (ADR-131)
  events?: SerializedEvent[];
  actions?: SerializedAction[];

  _meta?: { schemaVersion?: "canonical-primary-1.0" };
}
```

여기서 모든 consumer 가 출발한다. UI 트리(`children`, `type=ComponentTag` + `props`) + 시각(`tokens`/`themes`/`componentRules`) + 동반 불변 테이블(`componentCatalog`/build-time `componentRulesTable`)이 SSOT 전부이며, **컴포넌트별 정의 파일은 어디에도 없다.** 이 root 구조는 ADR-142 HC#4(schema 불변)와 완전 정합한다.

---

## 핵심 결정 ↔ 외부 원리 유도 요약 (정정본)

| 결정 | 유도 원리 | 실측 근거 | 정정 |
| --- | --- | --- | --- |
| 노드 type = `ComponentTag`(121 literal). pencil primitive 는 adapter 흡수 | Pencil(보편) + composition vocabulary 정책 | vocabulary.ts:16-18 (primitive 제외 명문) | ②.1 — 8 primitive discriminator 제거 |
| 보편 속성 = `props` bag(컴포넌트별 typed 필드 0) | Pencil | document.types.ts:336 (props bag), typed 필드 0 | ②.2 — ~40 typed 필드 제거 |
| 조합 = reusable 노드 데이터, leaf = RAC binding 코드 | Pencil(reusable/ref) + RAC(unstyled primitive) | reusable/ref 메커니즘 + binding | 유지 |
| descendants 3-mode override (런타임 판별) | Pencil | document.types.ts:241-285 | 유지 + brand 함정 명시 |
| slot = 채울 자리 + mode C children 교체 | Pencil | slot:[ids] + descendants children | 유지 |
| 토큰 3-layer: wire(`$--`,다축) ↔ canonical(`{$var}`,단일) ↔ spec(`{color.X}`,light/dark) | Pencil + RAC + composition 실제 | tokenResolver.ts:21 (binary), document.types.ts:198/224 | ②.3 — 다축 best-match 는 별도 변경으로 분리 |
| SSOT 보장 = 두 backend 가 동일 `componentRulesTable` + `resolveToken` 호출 | RAC(data/render 분리) | resolver index.ts:8-9, resolveSkiaVisualRule.ts:50, buildCatalogShapes.ts:38 | ①-c — ResolvedNode.computed 모델 제거 |
| componentCatalog 단일 등록 + `cutover`/skiaLegacy/native 비대칭 | 양 원리 통합 + ADR-142 cutover | catalog/types.ts:175-202 | ②.6 — cutover 필수 추가 |
| resolve 레이어 = ref→descendants→slot (순수 함수, token 미해소) | RAC(data/render 분리) | resolver index.ts:8-9, resolver.types.ts:107-118 | ①-c — ④⑤ 를 backend-entry 로 이동 |

---

<a id="영역-3"></a>

## ③ RAC → Internal Format 변환 레이어 — 설계와 변환 로직 (정정판)

> 1차 원리 출발점: (a) RAC = "unstyled accessible primitive + composeRenderProps + slot + Collection" 아키텍처, (b) Pencil canonical document = "11 primitive node + 보편 속성 + reusable/ref/descendants/slot 메커니즘". 두 자산이 **같은 분리선**(접근성/구조 = 코드, 시각/변형/조합 = 데이터)을 긋는다는 것을 발견하고, 그 분리선 위에 변환 레이어를 세운다. 결론은 ADR-142 end-state(코드 정의 = leaf primitive binding ~35~40개, 조합 = canonical reusable 문서)와 수렴한다.
>
> **정정 요지 (적대적 검증 반영)**: 본 판은 4개 지적을 모두 수용했다. 네 지적은 1차자료 오독이 아니라 실측과의 불일치를 정확히 짚었으므로 원설계를 고친다. (1) 텍스트 override 를 `descendants[path].props.children` (PatchMode) 으로 정정 — 원설계의 `{ children: "Save" }` 는 타입상 invalid. (2) "4곳 SSOT 동일" 을 **현재 달성된 구조적 보장**이 아니라 **목표 end-state** 로 명시하고, 현재는 4곳이 같은 spec 에서 build-time 파생되어 값만 동일한 전환기임을 단계 구분. (3) `resolveSkiaFill` 입력을 whole `ComponentRule` 이 아니라 단일 variant projection(`ComponentVisualRule`)으로 정정 — variant 선택 책임을 caller(builder)로 환원, 패키지 경계(specs←shared) 반영. (4) `racStateAttrs` + `computeSkiaStateAttrs` 를 **미구현 목표 메커니즘**으로 명시하고, 현재 Skia state 가 `default`/`disabled` 만 derive 함을 밝히며 기존 `ComponentState` enum 과의 관계를 1줄 정리해 평행 state 모델 2개 잔존을 방지.

---

### 0. 핵심 발견 — RAC와 Pencil이 같은 선을 긋는다

RAC와 Pencil을 1차 원리로 나란히 놓으면, 두 시스템 모두 동일한 두 영역을 **다른 매체로** 분리한다.

| 영역 | RAC의 언어 | Pencil의 언어 | composition 귀결 |
| --- | --- | --- | --- |
| 접근성·DOM 구조·키보드·포커스 | `<RACButton>` unstyled primitive + render-prop state | (없음 — Pencil은 시각 도구라 D1 부재) | **코드** = `PrimitiveBinding` (RAC 권위) |
| 시각(색/크기/형태) | `data-variant`/`data-pressed` → CSS 토큰 | `variables` 다축 토큰 + `fill: "$--accent"` | **데이터** = theme/tokens + `ComponentRule` |
| 변형 상태 표현 | `composeRenderProps`의 `{isPressed,...}` | (정적 — 인터랙션 없음) | **자동 계산** = data-* (DOM은 RAC 자동, Skia는 목표 generic 렌더러) |
| 조합·합성 | `<Select>` = Button+Popover+ListBox JSX 합성 | `reusable` frame + `ref` 인스턴스 + `descendants` override | **데이터** = canonical reusable 문서 |
| 컬렉션 | `<Collection items={} >{fn}</Collection>` | reusable item template + 데이터 배열 | **데이터** = collections root + item reusable |

이 표가 변환 레이어의 전체 골격이다. **RAC가 코드로 표현한 것을 Pencil이 데이터로 표현한 것에 대응시키는 작업**이 곧 변환이다. 두 방향이 나온다.

- **방향 A (leaf 선언적 변환)**: RAC primitive 1개(`Button.tsx` + `Button.css`) → `PrimitiveBinding` 1개. 손으로 ~35~40개 작성. 코드 → 선언 데이터로의 **일회성 추출**.
- **방향 B (조합 저작 변환)**: RAC 합성 컴포넌트(`Select.tsx` JSX 트리) → canonical reusable 문서. Builder 안에서 frame 트리로 **저작 후 reusable 승격**. 자동 코드→데이터 변환이 아님(§6에서 "왜 자동 파이프라인이 아닌가"를 명확히 한다).

#### 0-bis. 전환기 / 목표 end-state 구분 (정정 #2 — 본 영역 전반의 전제)

본 설계는 ADR-142 의 **목표 end-state** 를 RAC/Pencil 1차 원리 언어로 재서술한다. 따라서 아래 표기 규칙을 둔다. 현행 코드의 전환기 상태와 목표 상태를 혼동하면 "구조적 보장(현재)" 으로 오독되므로, 각 메커니즘에 상태 태그를 명시한다.

| 태그 | 의미 | 본 영역 해당 메커니즘 |
| --- | --- | --- |
| **[실측]** | 현행 main 코드에 정착, grep 가능 | `toRacProps` 단일 투영기 / `PrimitiveBinding` 타입 / `buildCatalogShapes(visual)` 시그니처 / `descendants` 3-mode / Skia 색상의 rule-table swap |
| **[전환기]** | 일부만 swap, 나머지는 spec 파생 | 4곳 SSOT 동일성 (build-time 파생이라 값은 동일하나 runtime 단일 공급처는 미수렴) / `resolveComponentVisual` A-stage adapter (아직 `spec.variants` 읽음) / sizes 축 (아직 `spec.sizes`) |
| **[목표]** | ADR-142 end-state, 미구현 forward 설계 | `racStateAttrs` SSOT + `computeSkiaStateAttrs` / Skia hover/pressed hit-test wiring / sizes 축의 ComponentRule swap / CSSGenerator 의 rule-table 전환 |

**핵심 정정**: SSOT 원칙 1(button.size="sm"→fontSize:14 가 4곳 동일)은 **현재 build-time 파생으로 값이 동일**하고, **runtime 단일 공급처(ComponentRule) 수렴은 목표**다. 본문은 이 둘을 §7/§8 에서 단계로 분리해 서술한다.

---

### 1. 변환 레이어 아키텍처 — 3 모듈 + 1 단일 투영기

변환 레이어는 4개 부분으로 구성된다. 실측 코드(`packages/shared/src/catalog/`)에 이미 정착한 SSOT 타입(`PrimitiveBinding`, `PropContract`, `toRacProps`)을 정합 유지하면서, 그 위에 "변환"이라는 관점을 명시적으로 부여한다.

```
packages/shared/src/catalog/
├── types.ts                      # [실측] PrimitiveBinding / PropContract / PrimitiveSource (SSOT)
├── bindings/*.binding.ts         # [실측] 방향 A 산출물 — leaf binding 50+ 파일 (손으로 작성)
├── outputs/
│   ├── toRacProps.ts             # [실측] ★ 유일한 props 투영기 (canonical props → RAC props + data-*)
│   ├── racStateAttrs.ts          # [목표] ★ render-prop state → data-* 매핑 SSOT (신규 — DOM·Skia 공유)
│   └── inspectorFields.ts        # [실측] accepts → Inspector 필드 (방향 A의 D2 소비처, 본 영역 밖)
├── conversion/                   # [목표/문서] ★ 신규 — 변환 레이어 명시 모듈
│   ├── racCssTokenMap.ts         #   방향 A: starter .css var(--*) → ComponentRule 토큰 추출 규칙 (build-time)
│   ├── slotProjection.ts         #   방향 B: RAC slot → canonical slot/descendants 표현
│   └── compositionToReusable.ts  #   방향 B: Builder frame 트리 → reusable 문서 승격 (저작 산출)
└── componentCatalog.ts           # [실측] 단일 등록 SSOT (binding | reusableId | native)
```

핵심 설계 원칙 4가지:

1. **단일 투영기 불변식 [실측]**: canonical props → RAC props 변환은 `toRacProps()` **하나뿐**이다. 컴포넌트별 변환 함수를 만들지 않는다(컴포넌트당 코드 0줄 원칙). 컴포넌트마다 다른 것은 데이터(`binding.props.accepts`)일 뿐, 변환 로직은 공유된다. 실측 `toRacProps.ts`가 이미 이 형태다.
2. **시각·변형 필드 부재 [실측]**: `PrimitiveBinding`에는 색/크기 값이 없다(`types.ts` 주석: "시각/변형/구조 필드 없음 — 시각은 theme/tokens, 변형은 `data-*`"). `variant: { kind:"variant", default:"primary" }`처럼 **차원만** 선언하고, 값 집합과 색은 `ComponentRule`(theme/tokens)이 소유한다. 이것이 SSOT 원칙 1의 **데이터 구조적 근거**다(runtime 단일 공급처 수렴은 §7 단계 참조).
3. **state는 변환 산출물이 아니라 런타임 파생 [목표]**: `isPressed` 같은 인터랙션 상태는 binding에 저장되지 않는다. DOM은 RAC가 자동으로 `data-pressed`를 emit하고, **Skia는 목표상 generic 렌더러가 hit-test 결과로 같은 `data-pressed`를 계산**한다(현재 미wiring — §3). 변환 레이어는 "어떤 state가 어떤 data-*로 가는가"라는 **매핑 규칙만** 제공한다.
4. **조합은 변환하지 않고 저작한다 [실측 방향성]**: 방향 B는 RAC `Select.tsx`를 파싱해 자동 생성하지 않는다. Builder 안에서 frame+ref로 조립하고 reusable로 승격한다. "깨진 spec 참조 금지" 제약(코드가 데이터를 못 따라가는 drift 차단)의 직접 귀결이다.

---

### 2. 방향 A — leaf RAC primitive → PrimitiveBinding

#### 2.1 변환 대상과 출처

RAC starter `Button.tsx`를 1차 원리로 읽으면 4개 정보가 들어 있다.

```tsx
// packages/react-aria-starter/src/Button.tsx (실측)
export function Button(props: ButtonProps) {
  return (
    <RACButton {...props} className="react-aria-Button button-base"
               data-variant={props.variant || 'primary'}>     // ← (3) variant → data-*
      {composeRenderProps(props.children, (children, {isPending}) => (  // ← (2) render-prop state
        <>{!isPending && children}{isPending && <ProgressCircle .../>}</>
      ))}
    </RACButton>
  );
}
```

여기서 추출하는 4가지:

| 추출 항목 | starter 출처 | binding 필드 |
| --- | --- | --- |
| (1) D1 primitive 식별 | `RACButton` import | `source: { kind:"rac", component:"Button" }` |
| (2) render-prop state | `composeRenderProps(_, {isPending})` | `rac.states` / `rac.renderProps` |
| (3) 시각 변형 차원 | `data-variant={...}` | `accepts.variant: { kind:"variant" }` |
| (4) D2 편집 surface | `ButtonProps extends RACButtonProps` | `accepts` 나머지(type/isDisabled/...) |

#### 2.2 변환 로직 (의사코드 — 손 작업 가이드)

자동 코드 생성이 아니라 **작성자를 위한 결정 트리**다. RAC 컴포넌트 1개를 binding으로 옮길 때 따르는 절차.

```ts
// conversion/leafBindingAuthoring.md 의 결정 절차를 TS 의사코드로
function authorLeafBinding(racComponentName: string): PrimitiveBinding {
  // 1. source — RAC controller가 있으면 rac, 없으면 internal(SVG 아이콘 등)
  const source: PrimitiveSource = hasRacController(racComponentName)
    ? { kind: "rac", package: "react-aria-components",
        importPath: "react-aria-components", component: racComponentName }
    : { kind: "internal", renderer: lowerCase(racComponentName) };

  // 2. rac 메타 — RAC 문서/소스의 render-prop state를 그대로 옮김 (rac source 전용)
  //    states ⊇ renderProps, dataAttributes = state를 kebab-case data-*로 (§3 규칙)
  const racMeta = source.kind === "rac" ? extractRacMeta(racComponentName) : undefined;

  // 3. accepts — 3 갈래로 분류
  const accepts: Record<string, PropContract> = {};
  for (const prop of d2EditableProps(racComponentName)) {
    if (isVisualDimension(prop))        // variant/size/fillStyle → kind 전용, options 없음
      accepts[prop] = { kind: visualKind(prop), section: "appearance", default: themeDefault(prop) };
    else if (isFixedEnum(prop))          // type="button"|"submit" → kind:"enum" + options
      accepts[prop] = { kind: "enum", section: "state", options: enumOptions(prop), default: ... };
    else                                 // boolean/string/number/binding
      accepts[prop] = { kind: contractKind(prop), section: sectionOf(prop) };
  }

  // 4. toRacProps는 항상 "default" — 컴포넌트별 변환기 없음 (단일 투영기 원칙)
  // 5. skiaPrimitive — box+text로 못 그리는 indicator/arc/track만 (대부분 생략)
  const skiaPrimitive = isNonDomTrivial(racComponentName) ? skiaDrawKey(racComponentName) : undefined;

  return { source, rac: racMeta, props: { accepts, toRacProps: "default" }, skiaPrimitive };
}
```

**왜 손 작업인가**: RAC props surface는 컴포넌트마다 의미가 다르고(예: Checkbox의 `isIndeterminate` vs Button의 `isPending`), 어떤 prop을 D2 편집 surface로 노출하고 어떤 것을 drop할지는 제품 결정이다. 코드 파싱으로 자동화하면 "모든 RAC prop을 노출"하게 되어 Inspector가 오염된다. ~35~40개는 일회성 손 작업이 정확도·유지보수 양면에서 우월하다(실측 `bindings/` 50+ 파일이 이미 이 방식).

#### 2.3 단일 투영기 `toRacProps` — 실측 + 검증

`toRacProps`는 canonical 노드의 `props`를 `accepts` 계약으로 필터링해 RAC primitive에 스프레드할 props로 만든다. 핵심은 **visual-enum 라우팅**이다. **중요(정정 #1 관련)**: 컴포넌트 텍스트는 Pencil 의 top-level `content`/`children` 이 아니라 **composition canonical 의 `node.props.children`** 에 저장된다(실측 `toRacProps.test.ts`: Button 노드 `props.children: "OK"` → 결과 `children: "OK"`). 이 props 저장 컨벤션은 §6.2 override 표현의 전제다.

```ts
// outputs/toRacProps.ts (실측 — 본 영역의 단일 투영기)
const DATA_ATTR_KINDS = new Set(["variant", "size", "fillStyle"]);

export function toRacProps(node: CanonicalNode | ResolvedNode, binding: PrimitiveBinding) {
  const out: Record<string, unknown> = {};
  for (const [key, contract] of Object.entries(binding.props.accepts)) {
    // node.props 에서 읽음 — 텍스트(children)도 props.children 경로
    const hasValue = node.props != null && Object.prototype.hasOwnProperty.call(node.props, key);
    const value = hasValue ? node.props[key] : contract.default;
    if (value === undefined) continue;

    if (DATA_ATTR_KINDS.has(contract.kind))
      out[`data-${toDataAttrName(key)}`] = String(value);  // variant → data-variant, fillStyle → data-fill-style
    else
      out[key] = value;                                     // children/type/isDisabled → RAC prop 그대로
  }
  return out;
}
```

투영 결과 예시(Button 노드 `props: { children:"Save", variant:"secondary", size:"sm", type:"submit", isDisabled:true }`):

```ts
// DOM 경로 — RAC <Button> 에 스프레드
{ children:"Save", "data-variant":"secondary", "data-size":"sm", type:"submit", isDisabled:true }
//          ^^^^^^^^ RAC가 className="react-aria-Button"에 data-* 부착 → theme CSS [data-variant="secondary"] 매칭
```

**투영기 식별자 "default" / named의 설계 [실측+예약]**: `toRacProps`는 `binding.props.toRacProps: string`을 식별자로 받는다. 현재 모든 binding이 `"default"`다. named 투영기는 **RAC prop 이름이 canonical과 다른 극소수 케이스**를 위한 탈출구로 예약한다 — 예: canonical `value`를 RAC `defaultValue`로 보내야 하는 uncontrolled 입력. 이때만 `toRacProps: "fieldUncontrolled"` 같은 named 투영기를 등록한다. **default를 벗어나면 컴포넌트별 코드가 생기므로, named는 "RAC API 비대칭이 데이터로 흡수 불가능할 때"로 엄격히 한정**한다. variant/size는 named로 처리하지 않는다(이미 data-* 규칙이 흡수).

```ts
// outputs/toRacProps.ts 확장 — projector registry (현재는 default 1개)
type RacPropProjector = (node, binding) => Record<string, unknown>;
const PROJECTORS: Record<string, RacPropProjector> = {
  default: defaultProjector,   // 위 구현
  // fieldUncontrolled: (node, b) => { const p = defaultProjector(node, b);
  //   if ("value" in p) { p.defaultValue = p.value; delete p.value; } return p; },  // 예약
};
export function projectRacProps(node, binding) {
  return (PROJECTORS[binding.props.toRacProps] ?? PROJECTORS.default)(node, binding);
}
```

#### 2.4 starter .css 토큰 → theme/tokens SSOT 변환 규칙

RAC starter `Button.css`는 `var(--radius)`/`var(--spacing-8)`/`var(--font-size)`/`[data-variant=...]`로 시각을 정의한다. 이것은 **D3 참조이지 runtime import가 아니다**(starter는 vendored snapshot). 변환 규칙은 "starter CSS의 토큰 참조를 composition의 `ComponentRule` 테이블 + theme tokens로 옮기는 것"이다.

```
starter Button.css                         →  composition SSOT (ComponentRule)
─────────────────────────────────────────     ────────────────────────────────────
border-radius: var(--radius)               →  ComponentRule.sizes[size].borderRadius = "{radius.md}"
font: var(--font-size-sm)                  →  ComponentRule.sizes.sm.fontSize = 14   (SSOT 원칙 1 — §7 단계)
height: var(--spacing-8)                   →  ComponentRule.sizes[size].height
[data-variant="secondary"] { background: var(--gray-100) }
                                           →  ComponentRule.variants.secondary.fill.default.base = "{color.neutral-subtle}"
[data-variant="secondary"][data-pressed]   →  ComponentRule.variants.secondary.fill.default.pressed = "{color.neutral-pressed}"
```

실측 `ComponentRule`(`composition-document.types.ts` + `catalog/generated/componentRulesTable.ts`)이 정확히 이 형태다 — `variants[v].fill.default.{base,hover,pressed,...}` + `sizes[s].{fontSize,height,borderRadius,...}`. **다만 현재 이 테이블은 `generate-rules.ts`(`packages/specs/scripts/`)가 spec 에서 build-time 복제한 것** [전환기] — §7 에서 단계를 구분한다. 변환 규칙의 의사코드:

```ts
// conversion/racCssTokenMap.ts — starter CSS 토큰 → ComponentRule (build-time, 일회성)
//   주의: 이것은 "참조 추출"이지 자동 파서가 아님. starter CSS를 읽고 손으로 ComponentRule을 채우되,
//         아래 매핑 표가 var(--*) ↔ TokenRef 대응의 SSOT 역할을 한다.
const RAC_CSS_VAR_TO_TOKEN: Record<string, string> = {
  "--radius":      "{radius.md}",
  "--radius-sm":   "{radius.sm}",
  "--font-size":   "{font.size.md}",
  "--font-size-sm":"{font.size.sm}",
  "--gray-100":    "{color.neutral-subtle}",
  "--tint-600":    "{color.accent}",
  // ... starter theme.css의 oklch 스케일 ↔ composition 시맨틱 토큰 대응
};
// data-variant/data-pressed 셀렉터 → fill state 슬롯 매핑
const SELECTOR_TO_FILL_STATE = {
  "[data-pressed]": "pressed", "[data-hovered]": "hover",
  "[data-selected]": "selected", /* ... */
};
```

이 변환의 **검증 필요** 항목: starter `theme.css`는 oklch relative-color 스케일(`--gray-100` ~ `--gray-1600`)을 쓰고, composition은 시맨틱 토큰(`{color.neutral-subtle}` 등, css-tokens.md S2 체계)을 쓴다. **두 스케일의 정확한 색상 대응표는 디자인 결정이 필요**하다(자동 유도 불가). 본 변환 레이어는 대응표의 **구조(var→TokenRef 매핑 테이블)**를 제공하고, 값은 디자인 SSOT가 채운다.

---

### 3. render-prop state → data-* attribute 매핑 (DOM·Skia 대칭의 목표 메커니즘)

> **상태 명시 (정정 #4)**: 본 §3 은 **[목표] 미구현 forward 설계**다. 현재 main 코드의 Skia state 산출은 `default`/`disabled` **2개만** derive한다(실측 `buildSpecNodeData.ts:1055-1058` — `componentState`가 `isDisabled || disabled` 일 때 `"disabled"`, 그 외 `"default"`; line 1146 주석: "현재 componentState는 'default' | 'disabled'만 가능"). hover/pressed 를 hit-test 로 계산하는 `SkiaHitState` wiring 은 이 경로에 **없다**. 아래 `racStateAttrs` SSOT + `computeSkiaStateAttrs` 는 ADR-142 end-state 에서 그 빈틈을 메우는 제안이며, 현존 메커니즘이 아니다.

이 메커니즘이 도입되면 변환 레이어에서 **DOM·Skia 대칭의 핵심 단일 다리**가 된다. RAC `composeRenderProps`의 render state `{isHovered,isPressed,isSelected,isPending,isFocusVisible,...}`를 `data-hovered`/`data-pressed`/... 로 매핑하는 규칙을 SSOT로 둔다.

#### 3.0 기존 `ComponentState` enum 과의 관계 (정정 #4 — 평행 모델 2개 잔존 방지)

현행 코드에는 이미 `ComponentState` enum(`default | hover | pressed | focused | focusVisible | disabled`)이 존재하나, Skia 경로는 그중 `default`/`disabled` 만 채운다. `racStateAttrs` 도입 시 **두 모델을 평행 유지하지 않는다**. 관계를 1줄로 고정한다:

> **`ComponentState` enum 은 `racStateAttrs` 의 boolean 집합에서 파생되는 derived 표현으로 격하한다**(대체가 아니라 **매핑 보강 후 단일 source 화**). 즉 `data-*` boolean 집합이 source 이고, `ComponentState` 는 그 집합을 우선순위(`disabled > pressed > hover > focusVisible > default`)로 접은 편의 enum 이다. 새 state 축은 `racStateAttrs` 에만 추가하고, enum 은 파생 규칙만 확장한다. 두 곳에 state 정의를 중복 보관하지 않는다.

```ts
// outputs/racStateAttrs.ts 가 source, ComponentState 는 derived
export function collapseToComponentState(attrs: Record<string, boolean>): ComponentState {
  if (attrs["data-disabled"]) return "disabled";
  if (attrs["data-pressed"]) return "pressed";
  if (attrs["data-hovered"]) return "hover";
  if (attrs["data-focus-visible"]) return "focusVisible";
  return "default";
}
```

#### 3.1 매핑 규칙 SSOT [목표]

```ts
// outputs/racStateAttrs.ts (신규 — 변환 레이어의 핵심 SSOT, 미구현)
//
// 1차 원리: RAC는 render-prop state를 동시에 data-* 속성으로도 DOM에 emit한다
//   (예: isPressed=true → <button data-pressed>). 이 변환 규칙은 RAC의 내부 규약이며,
//   camelCase render-prop명 → kebab-case data-* 의 결정적(deterministic) 함수다.
//
// 규칙: isXxx → data-xxx (is 접두 제거 + camelCase→kebab)
//   isHovered → data-hovered, isFocusVisible → data-focus-visible, isIndeterminate → data-indeterminate

export function renderStateToDataAttr(stateKey: string): string {
  const stripped = stateKey.replace(/^is/, "");                  // isFocusVisible → FocusVisible
  const kebab = stripped.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();  // → focus-visible
  return `data-${kebab}`;                                        // → data-focus-visible
}

/** 인터랙션으로 런타임 계산되는 state (binding.rac.states 중 pointer/focus 파생) */
export const INTERACTION_STATES = ["isHovered", "isPressed", "isFocused", "isFocusVisible"] as const;
/** 노드 props로 결정되는 state (값이 canonical props에 저장됨) */
export const PROP_DRIVEN_STATES  = ["isSelected", "isDisabled", "isIndeterminate", "isInvalid", "isPending"] as const;
```

#### 3.2 두 소비처 — 같은 규칙, 다른 매체

**DOM 경로 (RAC 자동) [실측 동작]**: 변환 코드가 아무것도 안 한다. `toRacProps`가 `isSelected`/`isDisabled` 같은 prop-driven state를 RAC prop으로 통과시키면, RAC가 내부적으로 render state를 계산하고 `data-selected`/`data-disabled`를 DOM에 부착한다. interaction state(hover/press)는 RAC가 pointer 이벤트로 자동 계산. **DOM은 RAC에 위임 — 변환 레이어 무개입**. 이 경로는 이미 동작한다.

**Skia 경로 (generic 렌더러가 계산) [목표 — 현재 미wiring]**: Skia는 DOM이 없으므로 RAC의 자동 emit이 없다. 목표상 generic 렌더러가 **같은 매핑 규칙으로 state를 계산**해야 한다. **현재는 prop-driven 의 `disabled` 만 처리하고 interaction(hover/pressed) hit-test 연결이 없다**(위 §3 상태 명시). 도입 형태:

```ts
// [목표] Skia generic 렌더러 (buildCatalogShapes 인접) — DOM과 동일 시각을 내는 핵심
// 현재 미구현: hit(SkiaHitState) wiring 이 buildSpecNodeData 경로에 추가되어야 함.
function computeSkiaStateAttrs(node: CanonicalNode, hit: SkiaHitState): Record<string, boolean> {
  const attrs: Record<string, boolean> = {};
  // (1) prop-driven: canonical props에서 직접 — DOM의 RAC와 동일 source. (현재도 disabled 는 derive)
  for (const s of PROP_DRIVEN_STATES)
    if (node.props?.[s]) attrs[renderStateToDataAttr(s)] = true;   // data-selected / data-disabled 등
  // (2) interaction: Skia hit-test 결과로 계산 — DOM의 pointer 이벤트와 동일 의미. (현재 미wiring)
  if (hit.hovered) attrs["data-hovered"] = true;
  if (hit.pressed) attrs["data-pressed"] = true;
  if (hit.focusVisible) attrs["data-focus-visible"] = true;
  return attrs;
}
```

#### 3.3 state → fill 선택은 caller(builder)가 수행, 렌더러는 단일 variant projection 만 받는다 (정정 #3)

> **정정 #3 핵심**: 원설계는 `resolveSkiaFill(rule: ComponentRule, variant, fillStyle, attrs)` 로 렌더러 내부에서 `rule.variants[variant].fill` 를 인덱싱했다. 이는 실측 책임 경계와 어긋난다. 실측 `buildCatalogShapes` 는 **whole `ComponentRule` 이 아니라, 단일 variant 가 이미 평탄화된 `ComponentVisualRule`(`visual` — fill + text/border 계열)을 받는다**(시그니처: `buildCatalogShapes(visual: ComponentVisualRule | undefined, props, sizeSpec, state)`). **variant 이름 선택은 상류(builder `buildSpecNodeData` → `resolveSkiaVisualRule` → `ruleVariantToVisual`)에서 일어나고, 렌더러는 variant 이름을 모른다.** 또한 패키지 경계상 specs 의 렌더러는 shared 의 rule 테이블을 import 못 한다 — 그래서 builder 가 `resolveComponentRule(type)` 로 rule 을 얻어 variant 를 골라 `ComponentVisualRule` 로 평탄화한 뒤 렌더러에 주입한다(실측 `resolveSkiaVisualRule.ts`).

정정된 책임 경계:

```ts
// ── caller (builder) 측: variant 이름 해소 + 단일 variant projection 생성 ──
// 실측 경로: buildSpecNodeData → resolveSkiaVisualRule(type, variantName) → ruleVariantToVisual(variant)
//   resolveComponentRule(type)  // shared/catalog 의 build-time rule 테이블 (specs 는 import 불가)
//   rule.variants[variantName ?? rule.defaultVariant] → ComponentRuleVariant
//   → ruleVariantToVisual(v): ComponentVisualRule   // fill + text/border 평탄화
function resolveSkiaVisualRule(type: string, variantName?: string): ComponentVisualRule | undefined {
  const rule = resolveComponentRule(type);
  if (!rule) return undefined;
  const v = rule.variants[variantName ?? rule.defaultVariant];
  if (!v) return undefined;       // variant 없는 컨테이너 shell → undefined
  return ruleVariantToVisual(v);  // ← 단일 variant projection
}

// ── 렌더러 (specs/buildCatalogShapes) 측: 이미 평탄화된 visual 만 받음, variant 이름 모름 ──
// resolveSkiaFill 의 입력은 ComponentVisualRule (단일 variant), whole ComponentRule 아님.
function resolveSkiaFill(
  visual: ComponentVisualRule | undefined,   // ← 단일 variant projection (NOT ComponentRule)
  fillStyle: string,
  attrs: Record<string, boolean>,
): string | undefined {
  const fill = visual?.fill;
  const stateTokens = fillStyle === "outline" ? { ...fill?.default, ...fill?.outline }
                    : fillStyle === "subtle"  ? { ...fill?.default, ...fill?.subtle }
                    : fill?.default;
  if (attrs["data-pressed"]  && stateTokens?.pressed)  return stateTokens.pressed;   // CSS [data-pressed] 등가
  if (attrs["data-hovered"]  && stateTokens?.hover)    return stateTokens.hover;     // CSS [data-hovered] 등가
  if (attrs["data-selected"] && stateTokens?.selected) return stateTokens.selected;
  return stateTokens?.base;   // fallback (hover/pressed optional — ADR-908 규약)
}
```

**대칭 보장의 논리 (책임 경계 정정 반영)**: DOM의 `[data-pressed] { background: var(--neutral-pressed) }`와 Skia의 `resolveSkiaFill(visual, fillStyle, {data-pressed:true}) → "{color.neutral-pressed}"`는 **같은 variant 의 같은 fill state 셀(`fill.default.pressed`)을 읽는다**. 차이는 *언제 variant 가 선택되느냐* 다 — DOM 은 RAC 가 `data-variant` 를 CSS 셀렉터로 매칭(런타임), Skia 는 builder 가 variant 이름을 해소해 평탄화(렌더 전). 두 경로 모두 같은 셀에 도달하므로 시각 결과가 동일하다(ssot-hierarchy.md D3 대칭 = 시각 결과 동일성). variant 선택 seam 을 렌더러 밖에 둔 것이 패키지 경계(specs←shared)와 정합한다.

---

### 4. slot 합성 — RAC slot → canonical 표현

RAC slot은 두 종류로 1차 원리가 다르다. 변환도 두 갈래다.

#### 4.1 RAC 내부 slot (`slot="selection"`, `slot="label"`, `slot="drag"`)

이것은 RAC가 **컴포넌트 내부에서 자식의 역할을 식별**하는 라벨이다(예: GridListItem 안의 `<Checkbox slot="selection">`). RAC primitive가 자동으로 처리하므로, **leaf binding은 이 slot을 데이터로 표현하지 않는다** — RAC 합성 wrapper가 자체적으로 emit한다. `PrimitiveBinding.rac.slots`에 **메타데이터로만 기록**(렌더러가 참조하지 않고 문서화·검증용).

```ts
// Checkbox binding의 rac.slots는 [] — Checkbox 자체는 slot consumer가 아님 (실측)
// 반면 collection item이 selection checkbox를 가질 때, 그 slot="selection"은
// composition wrapper(ListBox.tsx)가 RAC 합성 시 직접 부여 — canonical 데이터에 없음.
```

**왜 데이터화하지 않는가**: `slot="selection"`은 D1(접근성/구조) 영역이다. RAC가 selection checkbox에 올바른 ARIA를 부여하는 메커니즘이라 composition이 데이터로 재현하면 D1 침범(ssot-hierarchy.md 금지)이다. RAC wrapper에 위임한다.

#### 4.2 Pencil slot (`{ type:"frame", slot:["id1","id2"] }`) — 조합의 빈 자리

이것은 RAC slot과 **이름만 같고 1차 원리가 다르다**. Pencil의 `slot`은 "reusable 컴포넌트의 채울 수 있는 자리"다(예: Card의 header/content/footer slot). canonical `CanonicalNode.slot: false | string[]`이 실측으로 이 의미다 — `string[]`은 이 자리에 삽입 가능한 reusable component ID 추천 목록.

slot **채우기**는 `RefNode.descendants[slotPath].children`(DescendantChildrenMode)로 표현된다. **이 경우만 `children: CanonicalNode[]`(노드 배열) 모드를 쓴다** — 텍스트 교체와 구별되는 지점이다(§6.2 정정 참조).

```ts
// conversion/slotProjection.ts — slot 선언과 채우기의 canonical 표현
//
// (a) reusable 원본의 slot 자리 선언
const cardWithSlots: FrameNode = {
  type: "frame", id: "card-origin", reusable: true, name: "Card",
  children: [
    { type: "frame", id: "card-header", slot: ["badge-kit", "icon-kit"] },  // 채울 수 있는 자리
    { type: "frame", id: "card-body",   slot: false },                       // slot 비활성(고정)
  ],
};

// (b) 인스턴스가 slot을 채움 — descendants children-replacement 모드 (실측 3-mode 중 C)
const cardInstance: RefNode = {
  type: "ref", id: "card-1", ref: "card-origin",
  descendants: {
    "card-header": {                          // path = slot 노드 id (slash 구분 경로)
      // type 없음 + children(CanonicalNode[]) 있음 → DescendantChildrenMode
      children: [
        { type: "ref", id: "h-badge", ref: "badge-origin" },  // slot에 reusable 인스턴스 삽입
      ],
    },
  },
};
```

**검증 필요**: Pencil `slot:["id1","id2"]`의 `string[]`이 "추천 목록"인지 "허용 제약"인지는 실측 JSON만으로 확정 불가(타입 주석은 "삽입 가능한 reusable ID 배열"). composition에서 이를 강제 제약으로 쓸지 추천 힌트로 쓸지는 Builder UX 결정 — 본 변환 레이어는 데이터 구조(`slot` 필드 보존)만 정의한다.

---

### 5. collection data binding — RAC Collection → canonical(데이터+템플릿)

RAC Collection 1차 원리: `<Collection items={array}>{(item) => <Row .../>}</Collection>` — **데이터 배열 + 렌더 함수**의 분리. composition은 이 분리를 그대로 canonical로 옮긴다.

| RAC Collection 요소 | canonical 표현 |
| --- | --- |
| `items={array}` (데이터) | `collections` root collection (ADR-132) — `dataBinding`/`datatableId` 참조 |
| `{(item) => <Row>}` (렌더 함수) | item template = reusable 문서 (1개 row의 frame 트리) |
| `useAsyncList` (무한 로드) | `collections.runtimeData` sink + `executeApiEndpoint` (ADR-132 실측) |
| `useTableOptions()` (selection/drag) | item template 안의 `slot="selection"` checkbox (RAC wrapper 자동) |

```ts
// collection 컴포넌트의 binding은 dataBinding만 받음 (items는 데이터, 렌더는 wrapper) — 실측 ListBox.binding.ts
export const listBoxBinding: PrimitiveBinding = {
  source: { kind: "internal", renderer: "listbox" },   // composition wrapper가 useCollectionData로 채움
  props: { accepts: {
    dataBinding: { kind: "binding", label: "Data", section: "content" },  // ← collections root 참조
    variant: { kind:"variant", ... }, size: { kind:"size", ... },
    selectionMode: { kind:"enum", options:[none/single/multiple], ... },
  }, toRacProps: "default" },
};
```

변환 흐름(DOM 경로, 실측 `INTERNAL_RENDERERS`):

```ts
// CanonicalNodeRenderer — internal renderer로 dispatch
const INTERNAL_RENDERERS = { listbox: ListBox, table: Table, /* ... */ };  // 실측
// composition wrapper(ListBox.tsx)가:
//   1. toRacProps로 dataBinding 받음
//   2. useCollectionData({ dataBinding }) → items 배열 (ADR-132 단일 진입점)
//   3. <RACListBox items={items}>{(item) => <ListBoxItem .../>}</RACListBox> 자체 합성
//   → 자식 canonical 재귀 불필요 (wrapper가 items로 렌더)
```

**Skia 경로의 현실(검증 필요·미완) [전환기/목표]**: collection은 `skiaLegacy: true`(실측). Skia generic 렌더러가 items 배열 순회 multi-item 렌더를 **아직 못 그린다**. 따라서 Skia만 legacy `render.shapes` fallback이고, DOM/Inspector는 catalog generic. items generic 메커니즘 + Viewport Culling/Virtualization(SSOT 원칙 2)은 **전 family cutover 후 일괄 과제**다 — 본 변환 레이어가 데이터 구조(dataBinding + item reusable template)를 확정해두면, Skia generic이 그 위에서 "보이는 viewport의 item만 item-template을 인스턴스화"하는 형태로 구현된다(별도 영역). 현재 Skia 에는 frame culling(`visibleFrameRoots`/`visiblePageRoots`)만 존재하고 collection item culling 은 미도입.

---

### 6. 방향 B — 조합 컴포넌트 변환: "저작"이지 "자동 변환"이 아니다

#### 6.1 왜 자동 파이프라인이 아닌가 (핵심 결정)

RAC `Select.tsx`는 JSX 합성이다:

```tsx
// packages/react-aria-starter/src/Select.tsx (실측)
<AriaSelect {...props}>
  {label && <Label>{label}</Label>}
  <Button><SelectValue /><ChevronDown /></Button>
  <Popover hideArrow><SelectListBox items={items}>{children}</SelectListBox></Popover>
</AriaSelect>
```

이 JSX를 **파싱해 canonical reusable 문서로 자동 생성하지 않는다**. 두 가지 1차 원리 이유:

1. **`<AriaSelect>`는 RAC controller다** — `Select`/`Popover`/`SelectValue`는 state machine(열림/선택/포커스)을 가진 D1 primitive다. canonical frame 트리로 자동 분해하면 이 controller가 사라진다. Select는 **leaf-like internal binding**으로 유지하고(실측 `selectBinding`, `source: internal/select`), composition wrapper가 RAC controller를 합성한다. 즉 Select는 "조합처럼 보이지만 D1 controller라 leaf로 취급".
2. **진짜 조합(Card, 아이콘 붙은 Button)은 Builder 안에서 저작** — 이들은 controller 없는 순수 레이아웃 합성이다. 사용자가 Builder에서 frame+ref로 조립하고 reusable로 승격한다. 코드 파싱 자동 변환은 "깨진 spec 참조"(코드 정의가 데이터를 못 따라가는 drift)를 만든다. **저작 산출물 = 데이터**이므로 drift가 구조적으로 불가능하다.

| 조합 유형 | 예 | 변환 방식 | binding/문서 |
| --- | --- | --- | --- |
| D1 controller 합성 | Select, ComboBox, DatePicker | leaf-like binding (internal) | `selectBinding` (wrapper가 RAC 합성) |
| 순수 레이아웃 합성 | Card, IconButton, Stat | Builder 저작 → reusable 승격 | canonical reusable 문서 |

#### 6.2 Builder 저작 → reusable 승격 (방향 B 변환 로직)

```ts
// conversion/compositionToReusable.ts — Builder frame 트리 → reusable 문서 승격
//
// 입력: 사용자가 Builder에서 조립한 frame 서브트리 (IconButton = frame[icon + Button])
// 출력: reusable:true 원본 + 팔레트 등록용 ComponentCatalogEntry(kind:"reusable")

function promoteToReusable(authored: CanonicalNode, meta: { type: string; family: ComponentFamily; panel: PanelMeta }) {
  // 1. 원본 노드에 reusable:true 부여 (Pencil reusable frame = 컴포넌트 정의)
  const origin: FrameNode = { ...authored, reusable: true, id: meta.type + "-origin" } as FrameNode;

  // 2. 편집 가능한 prop을 propsSchema로 추출 (어떤 자식 속성을 인스턴스가 override할지)
  //    예: IconButton의 "label"은 내부 Button 의 props.children, "icon"은 내부 icon node의 iconFontName
  const propsSchema: PropsSchema = derivePropsSchemaFromAuthoring(authored);
  origin.metadata = { ...origin.metadata, "x-composition": { propsSchema } };

  // 3. 팔레트 등록 — 코드 정의 0줄, reusableId 참조만 (실측 ComponentCatalogEntry kind:"reusable")
  const entry: ComponentCatalogEntry = {
    kind: "reusable", type: meta.type, family: meta.family,
    cutover: "catalog", reusableId: origin.id, panel: meta.panel,
  };
  return { origin, entry };
}
```

인스턴스 생성 = `RefNode` + `descendants` override. **3-mode 의 올바른 사용 (정정 #1 — 원설계 오류 수정)**:

> **정정 #1 핵심**: 원설계는 텍스트 교체를 `"ib-label": { children: "Save" }` 로 쓰고 이를 "(C) children replacement 모드"라 라벨했다. 두 가지로 invalid 하다. (1) `DescendantChildrenMode.children` 은 `CanonicalNode[]`(노드 배열)이므로 문자열 `"Save"` 할당은 **타입 오류**. (2) `DescendantPatchMode` 는 `children?: never` 라 `children` 키 자체가 금지 → `"Save"` 는 3-mode 어디에도 valid 하지 않다. 게다가 composition canonical 은 컴포넌트 텍스트를 top-level `children` 이 아니라 **`node.props.children`** 에 저장한다(실측 `toRacProps.test.ts`: Button `props.children:"OK"`). 원설계는 Pencil 의 top-level `content`/`children` 컨벤션을 composition 의 props 저장과 혼동했다.
>
> **정정**: 텍스트 override 는 **DescendantPatchMode(A 속성 patch)** 로 표현한다 — `"ib-label": { props: { children: "Save" } }`. PatchMode 는 `[key: string]: unknown` 이라 `props` 키를 허용하고, resolver 가 patch 를 원본 위에 merge 하면 내부 텍스트 노드의 `props.children` 이 교체된다. `children: CanonicalNode[]`(mode C)는 **slot 채우기/노드 자식 교체일 때만** 쓴다(§4.2).

```ts
// IconButton 인스턴스 — propsSchema의 label/icon을 descendants patch로 override (정정판)
const iconBtnInstance: RefNode = {
  type: "ref", id: "ib-1", ref: "IconButton-origin",
  descendants: {
    // (A) 속성 patch — 텍스트는 내부 노드의 props.children 경로로 교체 (children 키 금지)
    "ib-label": { props: { children: "Save" } },

    // (A) 속성 patch — 아이콘·색 교체. iconFontName/fill 이 top-level 보편속성인지
    //     props 경로인지는 노드 schema 에 따름:
    //     - Pencil 보편속성(iconFontName/fill)은 top-level 가능 → { iconFontName: "save", fill: "$--accent" }
    //     - composition props 경로면 → { props: { iconFontName: "save", fill: "$--accent" } }
    //     (검증 필요: IconNode schema 에서 iconFontName/fill 의 top-level vs props 위치 확정)
    "ib-icon":  { iconFontName: "save", fill: "$--accent" },

    // (A) 속성 patch — 숨김. Pencil 은 top-level `enabled` 를 쓰나, composition CanonicalNode schema 에는
    //     top-level `enabled` 필드가 정의돼 있지 않다(실측: composition-document.types.ts 에 enabled 없음;
    //     enabled 소비처는 events/eventHandlers + fillAdapter.fill.enabled 로 별개 맥락).
    //     → PatchMode 의 [key: string]: unknown 으로 통과는 되나 canonical resolver 의 정식 소비처 미정.
    //     숨김을 composition 에서 어떻게 표현할지는 검증 필요(예: props.isHidden 신설 vs visibleWhen vs
    //     enabled 필드 schema 도입). 현 단계는 "Pencil 실증 모드를 그대로 옮기되 소비처 확정 필요"로 둔다.
    "ib-badge": { enabled: false },   // ← 검증 필요 (top-level enabled 소비처 미정)
  },
};
```

이 3-mode(속성 patch / node replacement / children replacement)는 **실측 Pencil JSON의 chevron 교체 + `enabled:false` 사례와 데이터 모델 차원에서 1:1 일치**한다 — 변환 레이어가 Pencil format을 정통으로 따른다는 증거. 다만 **`enabled` 의 composition 소비처는 검증 필요**(위 주석)로, "Pencil 데이터 모델 정통성"과 "composition resolver 소비 정착"을 구분해 둔다.

#### 6.3 Select 변환 예시 (D1 controller — leaf-like)

```ts
// Select는 자동 분해하지 않고 internal binding 유지 (실측 selectBinding)
//   RAC <AriaSelect> controller를 composition Select.tsx wrapper가 합성:
//   toRacProps(node, selectBinding) → { "data-size":"md", isDisabled, ... + dataBinding 통과 }
//   → Select wrapper가 useCollectionData(dataBinding)로 options 채우고
//     <AriaSelect><Button><SelectValue/></Button><Popover><ListBox items={...}/></Popover></AriaSelect> 합성
//   canonical에는 Select 노드 1개 + dataBinding만 — Button/Popover/ListBox 서브트리는 데이터에 없음(wrapper 소유)
```

**왜 Select 서브트리를 데이터화하지 않는가**: Button/Popover/ListBox는 RAC가 `<AriaSelect>` context로 묶는 controller 파트다. 데이터로 분해하면 열림/선택 state 연결이 끊긴다(D1 침범). Select는 "조합 형태의 leaf" — binding 1개로 충분하고, 합성은 wrapper에 위임한다.

---

### 7. 변환 레이어 전체 데이터 흐름 — SSOT 4곳 동일성: 현재(전환기) vs 목표(수렴) 구분 (정정 #2)

> **정정 #2 핵심**: 원설계는 이 흐름도와 §8 을 "4곳이 모두 같은 ComponentRule 을 소비 → 4곳 동일 (구조적 보장)"로, **현재 달성된 메커니즘**처럼 서술했다. 실측은 다르다. (1) CSSGenerator(DOM/Preview consumer)는 `variantToVisual(variantSpec)` + `spec.sizes` 를 직접 읽는다 — ComponentRule 테이블 미참조(`CSSGenerator.ts:232,447`). (2) Skia sizes 는 `spec.sizes[size]` 에서 온다(`buildSpecNodeData.ts:847`) — ComponentRule.sizes 미경유. (3) Skia **색상만** rule-table 로 swap 됐고(`resolveSkiaVisualRule` → `resolveComponentRule`), 그조차 A-stage adapter `resolveComponentVisual` 는 여전히 `spec.variants` 를 읽는다(`resolveComponentVisual.ts:9` 주석). `COMPONENT_RULES_TABLE` 은 `generate-rules.ts` 가 spec 에서 **build-time 복제**한 것이라 값은 동일하지만 **runtime 단일 소비처는 아직 아니다**(전환기).
>
> 사용자 제약상 end-state 서술은 허용되나, "구조적 보장(현재)" 단정은 추정이 된다. 따라서 두 단계로 분리한다.

**현재 (전환기) — 4곳이 같은 spec 에서 build-time 파생되어 값만 동일**

```
                                   spec.*.spec.ts  (현 SSOT 출처)
                                         │
              ┌──────────────────┬───────┴────────┬─────────────────────┐
              │                  │                │                     │
   build-time│ 복제          직접 읽음        직접 읽음            직접 읽음(색만 swap)
   generate-rules.ts            │                │                     │
              ▼                  ▼                ▼                     ▼
   ComponentRule 테이블   CSSGenerator       Inspector(accepts)   Skia buildSpecNodeData
   (shared/catalog/        variantToVisual    + spec.sizes 옵션    sizes: spec.sizes[size]
    generated)             (spec.variants)                         색상: resolveSkiaVisualRule
              │                + spec.sizes                          → resolveComponentRule(색만)
              └────────── Skia 색상만 이 테이블 소비 ──────────────────┘
   ⇒ 값은 동일(같은 spec 파생). 단일 runtime 공급처 아님 — spec 변경 시 build:specs + generate-rules 재실행 필요.
```

**목표 (end-state) — runtime 단일 공급처(ComponentRule) 수렴**

```
                          ComponentRule 테이블 (theme/tokens 기반 단일 runtime SSOT)
                                         │
              ┌──────────────────┬───────┴────────┬─────────────────────┐
              ▼                  ▼                ▼                     ▼
       Publishing/Preview   Style/Props Panel   Skia 색상            Skia sizes
       CSSGenerator가        accepts → 필드,     resolveSkiaVisualRule  ruleSizeToSizeSpec
       rule-table 소비       옵션값 = rule.sizes  (이미 도달)           (sizes swap 후 도달)
              └──────── 모두 같은 ComponentRule 셀을 runtime 에 읽음 ──────────┘
   ⇒ ComponentRule.sizes.sm.fontSize=14 값이 바뀌면 4곳이 그 하나를 읽어 즉시 동일 반영.
```

**전환기 → 목표 도달에 남은 swap (ADR-142 breakdown 정합)**:
1. **sizes 축 swap**: Skia(`buildSpecNodeData:847`)와 CSSGenerator(`:447`)의 `spec.sizes` 직접 읽기를 `resolveComponentRule(type).sizes` 로 전환.
2. **CSSGenerator rule-table 전환**: `variantToVisual(variantSpec)` 의 source 를 `spec.variants` → rule 테이블로 swap (`variantToVisual` 어댑터 내부만 교체, 호출부 불변 — 실측 주석의 B 단계 계획).
3. **A-stage adapter spec 격리**: `resolveComponentVisual` 내부 data-source 를 `spec.variants` → rule 테이블로 swap (B swap).

이 세 swap 완료 전까지 §7/§8 의 "4곳 동일"은 **build-time 파생에 의한 값 동일**이고, 완료 후 **runtime 단일 공급처 수렴**이 된다.

---

### 8. RAC 1차 원리 근거 명시 (요약) + 상태 태그

| 변환 결정 | RAC 1차 원리 근거 | 상태 |
| --- | --- | --- |
| `accepts`에 시각 값 없음, 차원만 | RAC = unstyled primitive. 시각은 consumer(theme CSS)가 `data-*`로 — composition은 그 자리에 ComponentRule | [실측] |
| `variant/size/fillStyle` → `data-*` | starter `Button.tsx`의 `data-variant={...}` 패턴 그대로 | [실측] |
| state → data-* 매핑 SSOT (`racStateAttrs`) | `composeRenderProps`의 render state가 RAC 내부에서 동시에 data-*로 emit됨 — 그 규약을 Skia가 재현 | [목표 — Skia hover/pressed 미wiring] |
| `ComponentState` enum = data-* 집합의 derived | 두 평행 모델 잔존 방지: boolean 집합이 source, enum 은 접은 표현 | [목표 — §3.0] |
| variant 선택은 caller(builder), 렌더러는 단일 projection | 패키지 경계(specs←shared): specs 렌더러는 rule 테이블 import 불가 → builder 가 `ComponentVisualRule` 주입 | [실측 — `buildCatalogShapes(visual)`] |
| Select = leaf-like binding | `<AriaSelect>`가 controller context — 데이터 분해 시 state 연결 끊김 | [실측] |
| collection = dataBinding + 템플릿 | RAC `<Collection items={} >{fn}</Collection>`의 데이터·렌더 분리 그대로 | [실측 DOM / 목표 Skia] |
| slot 두 종류 분리 | RAC 내부 slot(D1, wrapper 위임) ≠ Pencil slot(채울 자리, descendants children: CanonicalNode[]) | [실측] |
| 텍스트 override = `descendants[path].props.children` (PatchMode) | composition 은 텍스트를 `node.props.children` 에 저장; PatchMode 는 children 키 금지 | [실측 — 정정 #1] |
| 조합은 저작이지 파싱 아님 | RAC JSX는 controller 합성 — 자동 변환 시 D1 침범 + drift. Pencil reusable/ref/descendants가 데이터 저작 메커니즘 제공 | [실측 방향성] |
| 4곳 SSOT 동일 = 현재 build-time 파생 / 목표 runtime 수렴 | 단일 공급처 수렴은 sizes swap + CSSGenerator rule 전환 + A-stage 격리 완료 후 | [전환기→목표 — 정정 #2] |

---

<a id="영역-4"></a>

# ④ Skia Rendering Layer — Generic Renderer · Viewport Culling · Collection Virtualization · Text Rendering (정정판)

> 본 설계는 두 외부 검증 자산(RAC Collections/Virtualizer 1차 원리 + Pencil canonical document 모델)에서 출발해, canonical resolved tree + theme 를 소비하는 **component-agnostic Skia 렌더 파이프라인**을 재유도한다. 결론은 ADR-142 end-state(11 primitive node + 보편 속성 + generic 렌더러)와 수렴하며, 누적 부채(현행 family cutover 절차 등)는 출발점으로 삼지 않는다.
>
> **정정 요약(적대 검증 6건 전수 수용)**: 초판은 (1) `skiaPrimitive` 를 직접 CanvasKit draw 함수로, (2) Pencil flat 노드 필드를 composition `ResolvedNode` top-level 로, (3) `node.type` 을 Pencil 11 primitive 로, (4) collection scroll 을 `layoutVersion` 으로, (5) `dataBinding` 을 `node.props` 로, (6) Taffy window detach 를 무검증 추정으로 잘못 서술했다. 본 정정판은 실측 코드(`skiaPrimitives.ts:35/308`, `composition-document.types.ts:302/331`, `canonical-resolver.types.ts:107`, `renderCommands.ts:976`, `buildSpecNodeData.ts:771/787`, `skiaFramePipeline.ts:358`, `resolvers/canonical/index.ts:58`)와 1:1 정합하도록 전면 재작성했다.

---

## 0. 1차 원리 — 왜 Skia 가 "데이터 분기" 렌더러여야 하는가

### 0-1. Pencil 모델의 함의: "노드 type 은 11종, 컴포넌트 type 은 0종"

실측한 `shadcn-design-system.json` 의 87개 컴포넌트는 **단 11종 primitive node**(`frame / text / ref / icon_font / path / ellipse / rectangle / line / image / color / shadow`)로 구성된다. Button 도 Card 도 Table 도 Pencil 데이터 안에서는 별도 type 이 없다 — 모두 `frame` + 자식 노드 + 보편 속성 값(fill/fontSize/...)의 조합이다. 이것이 ADR-142 end-state 의 1차 원리다.

> **렌더러는 "컴포넌트가 무엇인가"를 식별 분기로 처리하지 않는다.** 렌더러는 "이 노드가 어떤 시각 데이터(box/text/arc/glyph)를 가지는가"만 보고 그린다.

### 0-2. 그러나 composition 의 현재 저장 모델은 Pencil flat 이 아니다 (검증자 지적 2·3 수용)

**중요한 전제 정정**: composition canonical 의 `CanonicalNode.type` 은 Pencil 11 primitive 가 아니라 `ComponentTag`(`composition-vocabulary.ts:22` — 118 컴포넌트 literal + `frame`/`ref`/`text` 3 구조 type = 121 literal)다. 그리고 시각/기하 값은 **top-level 필드가 아니라 `props` / `props.style` 안에** 저장된다(`composition-document.types.ts:336` — `props?: Record<string, unknown>`).

`resolveCanonicalDocument`(`resolvers/canonical/index.ts:58`)은 `type === "ref"` 인 instance 만 master+descendants 로 펼칠 뿐(`index.ts:81`), `Button` 을 Pencil primitive 로 **분해하지 않는다**. resolve 후에도 `Button` 노드의 `type` 은 여전히 `"Button"` 이다.

따라서 "렌더러가 `resolvePrimitiveType(node.type)` switch 만으로 컴포넌트를 모른 채 그린다"는 초판 주장은 **현 스키마에서 성립 불가**다. 두 가지 갈림길:

| 경로 | 전제 | 본 레이어 책임 |
| --- | --- | --- |
| **(a) tag-keyed 데이터 분기** (정본 채택) | `node.type=ComponentTag` 유지. 렌더러가 `getPrimitiveBinding(type)` 으로 tag 를 키 삼아 **시각 데이터**(skiaPrimitive 유무 / rule 테이블)를 조회 | 본 레이어 안 |
| **(b) ComponentTag → 11 primitive 분해 pass** (ADR-142 궁극 end-state) | resolver/import 단이 `Button` 을 `frame+text` 로 펼친 뒤 공급 | **본 레이어 밖 의존 전제** — 검증 필요 |

> **정정 핵심**: ADR-142 가 요구하는 "11 primitive 직접 렌더"는 **(b) 분해 책임이 resolver/import 단에 선행 도입돼야** 본 레이어가 순수 primitive switch 가 된다. 그 분해는 본 레이어 밖이며 현재 미구현이다(검증 필요 §8-Q1). **현 구현 정본은 (a)** 다 — 이미 `buildCatalogShapesOrPrimitive`(`buildSpecNodeData.ts:771`)가 `getPrimitiveBinding(type)` 의 tag-keyed 분기로 동작 중이며, 이는 "컴포넌트 식별 if 분기"(N++ 복제)가 **아니라** "tag→데이터 테이블 조회"(O(1) 데이터 lookup)다. tag-keyed 데이터 분기와 컴포넌트별 `if (type==="Button")` 분기는 본질이 다르다 — 전자는 등록표 조회, 후자는 코드 복제.

### 0-3. RAC 모델의 함의: "데이터/렌더 분리 + Layout 추상으로 viewport culling"

RAC Collections 는 `items` 배열 + 렌더 함수를 내부 `Node` tree 로 변환하고, `Virtualizer` + `ListLayout/GridLayout/TableLayout` 이 **보이는 영역의 Node 만 layout + mount** 한다.

> **Layout(좌표 계산)과 Render(그리기)는 분리 가능하다.** Layout 이 모든 item 좌표/크기를 (전체 측정 없이) 추정·확정하면, Render 는 viewport ∩ item-bounds 교집합만 그린다.

현행 코드에 이미 page/frame 단위 culling(`collectVisiblePageRoots` / `collectVisibleFrameRoots` + `executeRenderCommands` AABB cull)이 있으므로, 본 설계는 그 위에 **collection item 단위 virtualization** 을 2단계 culling 으로 얹는다.

### 0-4. 두 모델의 융합 — 본 레이어의 정본 명제

```
canonical document
        │
        ▼  resolveCanonicalDocument (resolvers/canonical/index.ts)
           — type:"ref" instance 만 master+descendants 로 펼침
           — ComponentTag 노드는 type 보존, 값은 props/props.style 안
ResolvedNode tree  (type=ComponentTag, props.style=시각/기하)
        │
        ▼  [tag-keyed 데이터 분기 — getPrimitiveBinding(type)]
           skiaPrimitive 있음 → Shape[] 생성기(skiaPrimitives.ts) → specShapesToSkia
           skiaPrimitive 없음/null → buildCatalogShapes (보편 box+text) → specShapesToSkia
        │
        ▼  SkiaNodeData (box | text | line | icon_path | image, arc=box+arc 데이터)
        │
        ▼  [2-stage culling: (a) page/frame  (b) collection item window]
        │
        ▼  [executeRenderCommands CMD_DRAW: box/text/line/icon_path/image/partial_border]
화면 (60fps, DOM CanonicalNodeRenderer 와 시각 대칭)
```

SSOT 충족: 같은 resolved node 의 시각 데이터가 Skia(rule 테이블 경유)와 DOM(`CanonicalNodeRenderer`)에 동일 공급된다. theme token 값이 바뀌면 양쪽 즉시 동일 반영(둘 다 같은 source 를 다시 읽음).

---

## 1. Skia 렌더 파이프라인 다이어그램 (실측 정합)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ A. INPUT (frame-level, 이미 존재)                                             │
│   renderNodesMap · childrenMap · layoutMap · pagePositions/framePositions      │
│   registryVersion · pagePositionsVersion · framePositionsVersion · layoutVersion│
│   useScrollState.scrollVersion (별도 counter — 아래 §3-5)                      │
│   + theme (resolved token 표) · collections.runtimeData (행 데이터)            │
└───────────────────────────────┬───────────────────────────────────────────────┘
                                │
                  ┌─────────────┴──────────────┐
                  ▼                            ▼
┌──────────────────────────┐   ┌──────────────────────────────────────┐
│ B1. ROOT COLLECTION       │   │ B2. NODE→Shape[]→SkiaNodeData          │
│  collectVisiblePageRoots  │   │  buildCatalogShapesOrPrimitive(type):  │
│  collectVisibleFrameRoots │   │   getPrimitiveBinding(type).skiaPrimitive│
│  → rootElementIds[]       │   │    있음 → drawPrimitive(ctx): Shape[]|null│
│                          │   │    null/없음 → buildCatalogShapes:Shape[]│
│                          │   │   → specShapesToSkia(shapes,theme,...)  │
│                          │   │     → SkiaNodeData(box/text/line/        │
│                          │   │        icon_path, arc=box+arc 데이터)    │
└──────────────────────────┘   └──────────────────┬───────────────────────┘
                  │                               ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ C. COMMAND STREAM BUILD (DFS pre-order — visitElement)                        │
│   ELEMENT_BEGIN → CMD_DRAW → CHILDREN_BEGIN → (recurse) →                     │
│                  CHILDREN_END → ELEMENT_END  (flat RenderCommand[])           │
│   ★ NEW: detectCollectionViewport(node) → visitCollectionWindow(...)          │
│         (보이는 item window 만 visitElement, spacer 는 translate 로 흡수)      │
│   출력: { commands: RenderCommand[], boundsMap }                              │
│   ★ 4-key cache: registryVersion+pagePosVersion+framePosVersion+layoutVersion │
│     (scrollVersion 은 본 cache 에 미포함 — §3-5 에서 명시적으로 다룸)          │
└───────────────────────────────┬───────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ D. EXECUTE (선형 for — executeRenderCommands)                                 │
│   cullingBounds(scene 좌표) = viewport / zoom                                  │
│   ELEMENT_BEGIN: AABB cull → skipDepth=1; translate·save·clip·blend·effects   │
│   CMD_DRAW switch: box / text / image / line / icon_path / partial_border      │
│   CHILDREN_BEGIN/END: clipRect · scrollOffset translate · scrollbar           │
│   ELEMENT_END: restore                                                         │
└───────────────────────────────┬───────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ E. PRESENT (SkiaRenderer — snapshot + camera blit)                            │
│   contentCanvas: scale(zoom) + full redraw (dirty 시)                          │
│   mainCanvas: camera-only delta 는 snapshot blit (zoomRatio/tx/ty + cubic)     │
└─────────────────────────────────────────────────────────────────────────────┘
```

핵심 설계 결정 3가지:
- **C 단계 collection 분기**: build 시점에 보이는 item window 만 `visitElement` → command 개수 자체를 줄인다.
- **D 단계 AABB cull**: command 가 생성됐어도 viewport 밖이면 skip — non-collection 요소의 1차 방어선(현행 유지).
- **E 단계 snapshot blit**: pan/zoom-only 는 재-build 없이 blit. collection scroll 은 layout window 가 바뀌므로 별도 처리(§3-5).

---

## 2. (4-1) Generic 렌더 모델 — tag-keyed 데이터 분기

### 2-1. 정본 dispatch — `buildCatalogShapesOrPrimitive` (실측 그대로)

초판의 `buildSkiaNodeData` + `resolvePrimitiveType` switch 는 **미존재 함수**였다. 실측 정본은 `buildSpecNodeData.ts:771` 의 `buildCatalogShapesOrPrimitive` 이며, 이미 ADR-142 G2(b) 로 spec-free(rule 테이블 주입) 상태다. 본 설계는 이를 **그대로 채택**하고, 구조를 명시한다.

```ts
// 실측: apps/builder/src/builder/workspace/canvas/skia/buildSpecNodeData.ts:771
// 변경 없음 — ADR-142 G2(b) 로 이미 spec-free. 본 설계의 정본 dispatch.
import {
  buildCatalogShapes,
  getSkiaPrimitive, // @composition/specs — skiaPrimitives.ts:317
} from "@composition/specs";
import {
  getPrimitiveBinding, // @composition/shared — catalog/bindings/index.ts:141
} from "@composition/shared";
import type { Shape, SizeSpec, ComponentState } from "@composition/specs";

function buildCatalogShapesOrPrimitive(
  type: string,                 // ComponentTag (검증자 지적 3 수용 — primitive kind 아님)
  specProps: Record<string, unknown>,
  sizeSpec: SizeSpec,
  componentState: ComponentState,
): Shape[] {
  // (1) variant 색상은 rule 테이블에서 해소 — spec 미참조 (ADR-142 G2(b))
  const rule = resolveSkiaRule(type);
  const variantName =
    (specProps.variant as string | undefined) ?? rule?.defaultVariant;
  const visual = resolveSkiaVisualRule(type, variantName); // ComponentVisualRule | undefined
  const textDecoration = rule?.textDecoration;

  // (2) tag → skiaPrimitive 키 조회 (데이터 lookup, 컴포넌트 식별 if 아님)
  const skiaPrimitiveKey = getPrimitiveBinding(type)?.skiaPrimitive;
  const drawPrimitive = getSkiaPrimitive(skiaPrimitiveKey);
  if (drawPrimitive) {
    const primitiveShapes = drawPrimitive({
      props: specProps,
      size: sizeSpec,
      visual,
      style: specProps.style as Record<string, unknown> | undefined,
    });
    // ★ null = primitive 미적용(예: Badge non-dot, props.isDot===false)
    //   → 보편 box+text fallback (검증자 지적 1 수용 — fallback 의미 명시)
    if (primitiveShapes) return primitiveShapes;
  }

  // (3) skiaPrimitive 없음 또는 null → 모든 frame 공유 보편 box+text 시각
  return buildCatalogShapes(visual, specProps, sizeSpec, componentState, textDecoration);
}
```

> **검증자 지적 1·3 수용 핵심**:
> - `resolvePrimitiveType` (미존재) → 실측 `getPrimitiveBinding(type)` 사용.
> - dispatch 는 `node.type=ComponentTag` 를 키로 한 **데이터 조회**다. 118 ComponentTag 를 `default` 로 흘리는 switch(초판)는 컴포넌트별 시각(arc/indicator)을 소실시키므로 채택하지 않는다.
> - `drawPrimitive` 가 `null` 반환 = primitive 미적용 → buildCatalogShapes 보편 fallback. 이 fallback 의미가 정본 분기의 핵심이다(예: Badge 가 dot 모드가 아니면 text badge 로 fallback).

### 2-2. `SkiaPrimitiveDrawFn` 은 직접 CanvasKit draw 가 아니라 **Shape[] 생성기** (검증자 지적 1 수용)

초판의 가장 큰 본질 결함 정정. 실측 시그니처(`skiaPrimitives.ts:35`)는:

```ts
// 실측: packages/specs/src/renderers/skiaPrimitives.ts:35
export type SkiaPrimitiveDrawFn = (ctx: {
  props: Record<string, unknown>;
  size: SizeSpec;
  visual: ComponentVisualRule | undefined; // ADR-142 B2 — caller 가 rule 에서 해소해 주입
  style: Record<string, unknown> | undefined;
}) => Shape[] | null; // ★ Shape descriptor 배열 또는 null — 직접 draw 아님
```

`(ck, canvas, bounds, props, theme) => void` 직접 CanvasKit draw 시그니처는 **코드에 존재하지 않는다**. 생성된 `Shape[]` 는 `specShapesToSkia(shapes, theme, w, h, id)`(`specShapeConverter.ts:37 import`)를 거쳐 **기존 `SkiaNodeData` type**(box/line/icon_path 등)으로 변환되고, **기존 CMD_DRAW case** 가 그린다.

**실측 레지스트리(`skiaPrimitives.ts:308`)**:

```ts
// 실측 — arc/track/selectionIndicator/colorWheel 는 키로 존재하지 않음
export const SKIA_PRIMITIVES: Readonly<Record<string, SkiaPrimitiveDrawFn>> = {
  icon_font: iconFont,       // Lucide glyph → Shape{type:"icon_font"}
  dot,                       // props.isDot 일 때만 → Shape{type:"circle"}, 아니면 null
  divider,                   // Separator 선 → Shape{type:"box"}
  checkbox,                  // indicator box + check → Shape[]
  radio,                     // indicator circle → Shape[]
  switch_toggle: switchToggle,// track + thumb → Shape[]
};
export function getSkiaPrimitive(key: string | undefined): SkiaPrimitiveDrawFn | undefined {
  return key ? SKIA_PRIMITIVES[key] : undefined;
}
```

각 primitive 가 만드는 것은 **Shape descriptor** 이며, 예컨대 `checkbox` 는:

```ts
// 실측 패턴 — skiaPrimitives.ts:113. checked 시각 = 보편 상태축에서 선택만.
const checkbox: SkiaPrimitiveDrawFn = ({ props, size, visual, style }) => {
  const boxSize = size.indicator?.boxSize ?? 20;
  const isChecked = props.isSelected === true;
  // 보편 상태축: checked → fill.default.selected / selectedBorder
  //             미선택 → fill.default.base / border  (컴포넌트-특화 *_COLORS 상수 제거)
  const bgColor =
    (style?.backgroundColor as string | undefined) ??
    (isChecked ? visual?.fill?.default.selected : visual?.fill?.default.base) ??
    ("{color.base}" as TokenRef);
  const borderColor =
    (style?.borderColor as string | undefined) ??
    (isChecked ? visual?.selectedBorder : visual?.border) ??
    ("{color.border}" as TokenRef);
  const shapes: Shape[] = [ /* box + (checked ? check path) */ ];
  return shapes; // Shape descriptor — specShapesToSkia 가 SkiaNodeData 로 변환
};
```

> **정정 결론**: `case "custom"` / `customDraw` / `SkiaNodeData "custom"` type 신설은 **존재하지 않는 평행 렌더 경로의 발명**이었으므로 전면 삭제한다. primitive 출력은 `specShapesToSkia` 를 거쳐 **기존 `SkiaNodeData`(box/line/icon_path/circle)** 로 흡수되고, **기존 CMD_DRAW switch**(box/text/image/line/icon_path/partial_border — `renderCommands.ts:976`)가 그린다. 새 case 0개.

### 2-3. arc 는 별도 type 이 아니라 `type:"box"` + `arc` 데이터 (검증자 지적 1 수용)

ProgressBar/Meter 의 호(arc)는 별도 `"arc"` SkiaNodeData type 이 아니다. `specShapeConverter.ts:364` 가 `case "arc"` 를 **`type:"box"` + `arc` 데이터로 변환**한다(`canvas-rendering.md §7` "type:arc 별도 사용 금지" 규칙과 정합):

```ts
// 실측: specShapeConverter.ts:364
case "arc": {
  const arcStrokeColor = colorValueToFloat32(shape.stroke, theme);
  const arcDiameter = shape.radius * 2 + shape.strokeWidth;
  // ★ 별도 "arc" type 은 renderNodeInternal switch 도달 문제로 미사용 → box 로 변환
  const arcNode: SkiaNodeData = {
    type: "box",
    x: shape.x - shape.radius - shape.strokeWidth / 2,
    y: shape.y - shape.radius - shape.strokeWidth / 2,
    width: arcDiameter,
    height: arcDiameter,
    visible: true,
    box: { fillColor: TRANSPARENT, borderRadius: 0 },
    arc: { cx: shape.radius + shape.strokeWidth / 2, /* ...angle, sweep, strokeColor */ },
  };
  // renderBox 가 node.arc 를 감지하여 호를 그림 (트랙도 arc 360°)
}
```

따라서 "arc 를 SKIA_PRIMITIVE_REGISTRY 의 별도 draw module 로" 라는 초판 서술은 폐기한다. arc 가 필요한 컴포넌트(ProgressBar/Meter)는 spec shapes 가 `type:"arc"` Shape 를 emit 하고, converter 가 box+arc 로 흡수한다. arc 는 **렌더러 레지스트리 항목이 아니라 Shape→SkiaNode 변환 규칙**이다.

### 2-4. 보편 box+text — `buildCatalogShapes` 는 컴포넌트 식별 분기 0

모든 frame 의 시각 = `bg roundRect + border + (내부 text)` = CSS box model 과 1:1 대응. `buildCatalogShapes(visual, specProps, sizeSpec, componentState, textDecoration)` 는 `node.type` 을 읽지 않는다 — 시각 차이는 전부 `visual`(rule 테이블에서 해소된 색)/`specProps.style`/`specProps.children` 값 차이로 흡수된다. 이는 `feedback-container-generic-box-no-classification` 메모리(2026-05-31)의 정본 방향과 일치한다.

`visual: ComponentVisualRule` 의 fillStyle × state 2축은 모든 frame 이 가질 수 있는 보편 상태축(CSS `data-*` 와 동형)이며, **theme/rule 테이블이 값을 공급하고 Skia 는 state 로 칸을 선택만** 한다:

```
DOM:  [data-state="hover"] { background: var(--accent-hover) }  ← 브라우저가 선택
Skia: visual.fill.default.hover ?? visual.fill.default.base     ← 런타임 state 로 직접 선택
      (state = hover hit-test 결과, §2-5 에서 런타임 주입)
```

두 경로가 동일 token 표를 읽으므로 시각 대칭이 보장된다.

### 2-5. `state` / `scrollOffset` 은 canonical 노드 필드가 아니라 **런타임 주입** (검증자 지적 2 수용)

초판은 `node.state` / `node.scrollOffset` 을 resolved node 필드로 읽었으나, 실측상 둘 다 **canonical 노드 필드가 아니다**:

| 값 | 출처 | 주입 방식 |
| --- | --- | --- |
| `state`(default/hover/pressed/selected) | builder 런타임 hit-test 결과 | `componentState` 파라미터로 `buildCatalogShapesOrPrimitive` 에 전달(`buildSpecNodeData.ts:775`). resolved node 가 아니라 ElementSprite/StoreRenderBridge 런타임 상태에서 산출 |
| `scrollOffset` | `useScrollState` store(런타임) | `SkiaNodeData.scrollOffset` 은 런타임 필드. canonical 에 없음 → resolved node 에서 읽으면 항상 undefined. CHILDREN_BEGIN command 에 store scroll 상태를 조회해 주입 |

> **정정**: 모든 "상호작용 상태"(state/scrollOffset)는 **resolved tree 가 아니라 builder 런타임 store** 에서 별도 조회해 command/shape 생성 시점에 주입한다. resolved node 는 "문서 상태"(props/style)만 공급한다. 이 분리가 ADR-135/136 의 ID 공간 분리(canonical document vs render-space interaction)와 정합한다.

### 2-6. 시각/기하 값 읽기 — 모두 `props` / `props.style` 경유 (검증자 지적 2 수용)

초판은 `node.fill` / `node.cornerRadius` / `node.content` / `node.x/y/width/height` 를 top-level 로 읽었으나, `CanonicalNode`(`composition-document.types.ts:336`)는 이들을 top-level 로 갖지 않는다. composition 저장 모델에서 시각/기하는 `props` 와 `props.style` 안에 있다. Pencil flat 노드와 composition 저장 모델의 **필드 위치 차이는 '검증 필요'가 아니라 명시적 매핑으로 해소**한다:

| Pencil flat 필드 (원본 데이터) | composition 저장 위치 (실측) | 읽기 패턴 |
| --- | --- | --- |
| `node.fill` | rule 테이블 해소 결과 `visual.fill` + `props.style.backgroundColor` override | `style.backgroundColor ?? visual.fill.default[state]` |
| `node.stroke` | `visual.border` + `props.style.borderColor` | `style.borderColor ?? visual.border` |
| `node.cornerRadius` | `props.style.borderRadius` | `parsePxValue(style.borderRadius, 0)` |
| `node.content` | `props.children` / `props.text` / `props.label` | `props.children ?? props.text` |
| `node.x/y/width/height` | layoutMap(Taffy 결과) | `layoutMap.get(id)` (resolved node 가 아닌 layout 결과) |
| `node.fontFamily/fontSize/fontWeight/lineHeight` | `props.style.font*` | `style.fontSize` 등 (§4) |
| `node.textAlign/textAlignVertical` | `props.style.textAlign` / `props.style.verticalAlign` | (§4) |
| `node.clip` | `props.style.overflow === "hidden"` | clipChildren 판정 |
| `node.enabled` | `props.isDisabled` 의 역(또는 항상 visible) | visible 판정 |
| `node.scrollOffset` | **런타임 store** (canonical 아님) | `useScrollState.getState()` (§2-5) |

따라서 보편 box 시각 데이터 추출은 다음과 같다(실측 위치 정합):

```ts
// 보편 box 시각 — 모든 값을 props / props.style / rule 테이블에서.
// (buildCatalogShapes 내부 패턴의 명시화 — node top-level 필드 접근 0)
function extractBoxVisual(
  specProps: Record<string, unknown>,
  visual: ComponentVisualRule | undefined,
  state: ComponentState,
): BoxVisual {
  const style = (specProps.style ?? {}) as Record<string, unknown>;
  return {
    borderRadius: parsePxValue(style.borderRadius, 0),       // node.cornerRadius 아님
    borderWidth: parseBorderWidth(style.borderWidth, visual?.border ? 1 : 0),
    bgColor:
      (style.backgroundColor as string | undefined) ??
      visual?.fill?.default[state] ??                         // node.fill 아님 — rule 테이블
      visual?.fill?.default.base,
    borderColor: (style.borderColor as string | undefined) ?? visual?.border,
    clipChildren: style.overflow === "hidden" || style.overflowY === "hidden",
  };
}
```

### 2-7. import 경로 정정 (검증자 지적 2 수용)

초판의 `import type { ResolvedNode } from "../../../../adapters/canonical/resolveCanonicalDocument"` 는 허위 경로다. 실측:

```ts
// 타입 — packages/shared (canonical-resolver.types.ts:107)
import type { ResolvedNode } from "@composition/shared";
// ResolvedNode extends CanonicalNode { _resolvedFrom?, _overrides?, children?: ResolvedNode[] }
// — Pencil flat 필드 추가 없음

// 함수 — apps/builder/src/resolvers/canonical (adapters/ 아님, index.ts:58)
import { resolveCanonicalDocument } from "../../../../resolvers/canonical";
```

(`adapters/canonical/` 디렉토리는 존재하나 거기엔 `frameElementLoader`/`themesAdapter`/`instanceResolver` 등 boundary helper 가 있고, `resolveCanonicalDocument` 단일 진입점은 `resolvers/canonical/index.ts` 다.)

---

## 3. (4-2) Virtualization + Viewport Culling — 핵심 성능

### 3-1. 2단계 culling 구조

```
Stage (a) page/frame culling   — 이미 존재. 보이지 않는 page/frame body 는 root 진입조차 안 함.
   collectVisiblePageRoots / collectVisibleFrameRoots → rootElementIds[]

Stage (b) collection item virtualization  — 신규. collection viewport 내부에서
   visible window 의 item 만 visitElement (command 생성).

안전망: executeRenderCommands per-command AABB cull (현행 유지) — stage (a)/(b)
   가 놓친 viewport-밖 요소를 D 단계에서 skip. collection 외 일반 요소의 1차 방어선.
```

stage (b) 가 핵심이다: collection 이 5,000행이어도 command stream 에 ~30행 + spacer translate 만 생성한다. stage (a)/안전망만으로는 5,000개 ELEMENT_BEGIN command 가 생성되어 빌드 비용 O(행수)가 발생하므로 부족하다.

### 3-2. collection viewport 식별 — `dataBinding` 은 `x-composition` extension 경유 (검증자 지적 5 수용)

초판은 `node.props.dataBinding` / `node.props.datatableId` 로 판정했으나, `dataBinding` 은 `CanonicalNode.props` 가 **아니라** `x-composition` extension 으로 분리 저장된다(`composition-document.types.ts:331` — "events/actions/dataBinding 은 x-composition extension 으로 분리"). `node.props.dataBinding` 접근은 항상 undefined 다.

실제 위치: `datatableId`/`dataBinding` 은 `useCollectionData({ datatableId | dataBinding })`(`collection.types.ts:82-90` `UseCollectionDataOptions`)의 binding scope 이며, ADR-132 collections root collection 에 binding reference 가 있다. canonical 노드에서는 `x-composition.dataBinding`(또는 export adapter 가 생성하는 `Element.dataBinding`)으로 읽어야 한다.

```ts
// collection virtualization 대상 식별 — node.type 분기 아님. 보편 속성 + extension 기반.
import type { ResolvedNode } from "@composition/shared";

interface CollectionViewport {
  scrollAxis: "vertical" | "horizontal";
  scrollOffset: number;            // 런타임 store 에서 (§2-5)
  itemSource: "static" | "data";
  estimatedItemSize: number;
  totalItemCount: number;
}

function detectCollectionViewport(
  node: ResolvedNode,
  rowCount: number,
  scrollOffset: number,            // ★ 런타임 주입 (resolved node 필드 아님)
): CollectionViewport | undefined {
  const style = (node.props?.style ?? {}) as Record<string, unknown>;
  const overflowY = style.overflowY as string | undefined;
  const overflowX = style.overflowX as string | undefined;
  const overflows =
    overflowY === "auto" || overflowY === "scroll" ||
    overflowX === "auto" || overflowX === "scroll";

  // ★ dataBinding 은 x-composition extension 또는 collection binding scope 경유 (검증자 5)
  //   node.props.dataBinding 직접 접근 금지 — 항상 undefined.
  const ext = (node as { "x-composition"?: { dataBinding?: unknown } })["x-composition"];
  const dataBound =
    ext?.dataBinding != null ||
    readCollectionBindingRef(node.id) != null; // collections root collection 조회

  if (!overflows && !dataBound) return undefined;
  if (!dataBound && rowCount < VIRTUALIZE_THRESHOLD) return undefined;

  return {
    scrollAxis: overflowX ? "horizontal" : "vertical",
    scrollOffset,
    itemSource: dataBound ? "data" : "static",
    estimatedItemSize:
      (node.props?.estimatedRowHeight as number | undefined) ?? DEFAULT_ROW_HEIGHT,
    totalItemCount: rowCount,
  };
}

const VIRTUALIZE_THRESHOLD = 50; // 검증 필요(§8-Q3): Chrome MCP 프로파일로 튜닝
const DEFAULT_ROW_HEIGHT = 36;
```

> **검증 필요(§8-Q4)**: `readCollectionBindingRef(node.id)` — ADR-132 collections root collection 에서 노드별 binding reference 를 읽는 실제 진입점을 확정해야 한다(`useCollectionData` 가 hook 기반이라 Skia build 경로에서 직접 호출 불가 → store snapshot 조회 형태로 재유도 필요). 이는 §8-Q4 검증 항목이다.

### 3-3. visible window 계산 + virtual scroll spacer (좌표 translate 흡수)

RAC `ListLayout` 의 1차 원리(item 높이 누적 → viewport 교집합)를 Skia 좌표계로 재현한다.

```ts
interface VirtualWindow {
  startIndex: number;
  endIndex: number;     // exclusive
  leadingSpacer: number; // window 위쪽 누적 높이
  trailingSpacer: number;
}
const OVERSCAN = 4;

function computeVirtualWindow(
  viewport: CollectionViewport,
  viewportSize: number,
  measuredSizes: Float64Array, // measuredSizes[i]===0 → estimatedItemSize
): VirtualWindow {
  const { scrollOffset, totalItemCount, estimatedItemSize } = viewport;
  let acc = 0, startIndex = 0;
  for (; startIndex < totalItemCount; startIndex++) {
    const h = measuredSizes[startIndex] || estimatedItemSize;
    if (acc + h > scrollOffset) break;
    acc += h;
  }
  let visibleAcc = 0, endIndex = startIndex;
  const viewportEnd = viewportSize + OVERSCAN * estimatedItemSize;
  for (; endIndex < totalItemCount && visibleAcc < viewportEnd; endIndex++) {
    visibleAcc += measuredSizes[endIndex] || estimatedItemSize;
  }
  const s = Math.max(0, startIndex - OVERSCAN);
  const e = Math.min(totalItemCount, endIndex + OVERSCAN);
  let lead = 0; for (let i = 0; i < s; i++) lead += measuredSizes[i] || estimatedItemSize;
  let trail = 0; for (let i = e; i < totalItemCount; i++) trail += measuredSizes[i] || estimatedItemSize;
  return { startIndex: s, endIndex: e, leadingSpacer: lead, trailingSpacer: trail };
}
```

`visitElement` 의 collection 분기는 이 window 만 순회하고, **spacer 는 빈 command 가 아니라 scrollOffset translate 로 흡수**한다(현행 scroll 처리 모델과 동일 메커니즘 — execute 단 translate):

```ts
function visitCollectionWindow(
  node: ResolvedNode,
  viewport: CollectionViewport,
  absX: number, absY: number,
  commands: RenderCommand[],
  boundsMap: Map<string, BoundingBox>,
  ctx: VisitContext,
): void {
  const measured =
    ctx.measuredRowSizes.get(node.id) ?? new Float64Array(viewport.totalItemCount);
  const layout = ctx.layoutMap.get(node.id);
  const window = computeVirtualWindow(viewport, layout?.height ?? 0, measured);

  commands.push({
    type: CMD_CHILDREN_BEGIN,
    clipChildren: true,
    width: layout?.width ?? 0,
    height: layout?.height ?? 0,
    // ★ scroll translate 에 leadingSpacer 흡수 — window item 로컬 y 는 0 기준
    scrollOffset: { scrollTop: viewport.scrollOffset - window.leadingSpacer, scrollLeft: 0 },
  });

  let itemY = window.leadingSpacer;
  for (let i = window.startIndex; i < window.endIndex; i++) {
    const itemNode = resolveCollectionItem(node, i, ctx); // static child 또는 data row
    const itemHeight = measured[i] || viewport.estimatedItemSize;
    visitElement(
      itemNode.id,
      absX, absY - viewport.scrollOffset + itemY,
      commands, boundsMap, ctx.childrenMap, ctx.layoutMap,
      0, 0, node.id, ctx.options,
    );
    itemY += itemHeight;
  }

  commands.push({
    type: CMD_CHILDREN_END,
    clipChildren: true,
    hasScrollOffset: true,
    scrollbar: node.props?.scrollbar as unknown,
    scrollbarNode: buildScrollbarNode(node, window, viewport), // thumb 은 totalItemCount 기반
  });
}
```

핵심: 5,000행 중 leadingSpacer=180,000px 여도 command 0개(translate 로 흡수). scrollbar thumb 크기/위치는 totalItemCount 기반 별도 계산(visible window 와 무관).

### 3-4. Taffy layout 과의 연계 — "window layout only" 는 **무검증 추정이 아니라 게이트 검증 항목** (검증자 지적 6 수용)

두 전략:

| 전략 | 설명 | 적용 |
| --- | --- | --- |
| **A. 전체 layout → draw culling** | Taffy 가 전 행 layout, draw 만 window | item 수 적고 균일(static, ≤수백) |
| **B. window layout only** | 보이는 window 만 Taffy layout, 나머지는 추정 spacer | item 수 많음(data-bound) ★ 목표 |

전략 B 가 60fps 의 핵심이지만, 초판은 "collection item 은 flex/block 이라 증분 가능할 것으로 추정"으로 **무검증 HIGH 리스크를 추정으로만 남겼다**. `layout-engine.md` 의 `PersistentTaffyTree` 규칙은:

- **신규 grid container 추가 → full rebuild 강제**(`!prevJson && curDisplay==="grid"`).
- **기존 grid container 의 padding/gap/gridTemplate 14-key 변경 → full rebuild 강제**.
- 비-grid(flex/block)는 `updateStyleRaw` 증분 유지.

`retainOnly` 류 대량 detach/attach 가 **매 scroll 프레임** 발생하면 증분 경로(`updateNodeStyle`+`markDirty`+`computeLayout`)를 벗어나 full rebuild 를 유발할 수 있고, **Table 같은 grid-기반 collection** 은 flex/block 가정이 깨진다.

> **정정: 전략 B 를 1차 채택하되, 다음을 open question 이 아니라 설계 전제 검증 게이트(§8-Q5/Q6)로 승격한다.**

```ts
// window layout only — 전제: 매-프레임 window mutation 이 full-rebuild 를 유발하지 않을 것.
//   ★ 이 전제는 §8-Q5 게이트로 실측 검증 후에만 production 적용.
function layoutCollectionWindow(
  node: ResolvedNode,
  window: VirtualWindow,
  taffy: PersistentTaffyTree,
  ctx: VisitContext,
): void {
  const displayKind = readDisplayKind(node); // "flex" | "block" | "grid"

  // ★ 검증자 6 수용: grid collection(Table)은 전략 A 로 분기 — grid full-rebuild 규칙 회피.
  if (displayKind === "grid") {
    // Table 등 grid-기반 collection 은 window detach/attach 가 grid track 캐시
    // invalidation 과 충돌(매 프레임 full rebuild). → 전략 A(전체 layout, draw culling)
    // 또는 grid 전용 row-level 가상화(별도 검증 §8-Q6).
    layoutFullThenDrawCull(node, taffy, ctx);
    return;
  }

  // flex/block collection 만 window-only Taffy mutation (증분 경로 유지 가정 — §8-Q5 검증).
  const liveIds = new Set<string>();
  let y = window.leadingSpacer;
  for (let i = window.startIndex; i < window.endIndex; i++) {
    const item = resolveCollectionItem(node, i, ctx);
    liveIds.add(item.id);
    const h = taffy.computeItemLayout(item.id, ctx.layoutMap.get(node.id)?.width ?? 0);
    recordMeasuredSize(ctx, node.id, i, h);
    y += h;
  }
  taffy.retainOnly(node.id, liveIds); // ★ 이 detach 가 full-rebuild 유발 안 함을 §8-Q5 로 확증
}
```

> **검증 게이트(§8-Q5, HIGH)**: `retainOnly`(window 밖 item detach)가 flex/block collection 에서 `PersistentTaffyTree` full-rebuild 를 유발하지 않는지 — 매 scroll 프레임 detach/attach 시 `updateNodeStyle`+`markDirty`+`computeLayout` 증분 경로를 유지하는지 실측. 유발 시 전략 B 는 60fps 불가 → fallback 으로 "window 고정 풀(pool) 재사용"(node 재생성 대신 좌표만 갱신) 검토.
>
> **검증 게이트(§8-Q6, HIGH)**: Table(grid) collection 의 measured-size 누적 보정이 grid track 캐시 invalidation 과 충돌하지 않는지. 충돌 시 grid collection 은 전략 A(전체 grid layout 1회 + draw window) 로 제한.

가변 높이 자기-보정: 첫 프레임 `estimatedItemSize` 추정 → 스크롤하며 실제 layout 높이를 `measuredRowSizes` 누적 → spacer 정확도 점진 상승(RAC `ListLayout` measured size cache 동형). 단, 위 게이트 통과가 전제다.

### 3-5. zoom/pan/scroll 의 counter 분리 — scroll 은 `layoutVersion` 흡수가 아님 (검증자 지적 4 수용)

초판은 "scroll → layoutVersion bump → command stream 재-build" 로 서술했으나, 이는 기존 두 counter 를 혼동한 것이다. **실측**:

- scroll 은 `layoutVersion` 이 아니라 **별도 `useScrollState.scrollVersion`**(`skiaFramePipeline.ts:358`, `skiaTreeBuilder.ts:296`)으로 추적된다.
- command stream cache 4-key(`registryVersion + pagePositionsVersion + framePositionsVersion + sharedLayoutVersion` — `renderCommands.ts:222`)에는 **`scrollVersion` 이 포함되지 않는다**.
- 현재 scroll 은 **재-build 없이 execute 단 scrollOffset translate** 로 처리된다(`canvas-rendering.md §8` — "registryVersion/pagePosVersion 만으로는 스크롤 변경 미감지", `scrollVersion` 은 selection boundsMap 캐시 무효화용).

기존 scroll 모델(translate, no rebuild)은 **고정된 자식 집합**을 전제한다. 그러나 virtualization 은 scroll 마다 **window item 집합 자체가 바뀌므로**(detach/attach + command 재생성) command stream 재-build 가 불가피하다. 따라서:

> **정정: virtualization 이 도입하는 새 결합을 정직하게 기술한다.** virtualized collection 의 scroll 은 더 이상 순수 translate 가 아니라 window rebuild 가 필요하다. 전역 `layoutVersion` bump 는 모든 page 의 command stream 을 매 scroll 프레임 무효화하므로(다중 page 동시 존재 시 전 page rebuild 비용) **부적절**하다. 정본은 **scrollVersion 을 command stream cache 의 5번째 key 로 편입**하고, virtualization 이 적용된 collection 에 한해 window rebuild 를 트리거한다.

```ts
// ★ 정본 — scroll counter 분리 + cache 5-key 편입 (검증자 4 수용)
function onCollectionScroll(collectionId: string, newScrollTop: number): void {
  setScrollOffset(collectionId, newScrollTop); // useScrollState store mutation
  bumpScrollVersion();                          // useScrollState.scrollVersion++
  // ★ layoutVersion 은 건드리지 않음 — 전역 무효화 회피(다중 page rebuild 방지)
  // ★ pan/zoom counter 도 건드리지 않음 — SkiaRenderer 가 scroll 을 blit 으로 오인 방지
}

// command stream cache 를 4-key → 5-key 로 확장 (renderCommands.ts cache 시그니처)
interface CommandStreamCacheKey {
  registryVersion: number;
  pagePositionsVersion: number;
  framePositionsVersion: number;
  sharedLayoutVersion: number;
  scrollVersion: number; // ★ 신규 5번째 key — virtualized collection window rebuild 트리거
}
```

**대안 비교(정직한 trade-off)**:

| 방안 | 비용 | 결론 |
| --- | --- | --- |
| (A) scroll→layoutVersion bump | 전역 무효화 — 모든 page command stream 매 scroll 재-build. 다중 page 시 과대 | ❌ 기각(초판 오류) |
| (B) scrollVersion 을 cache 5번째 key 편입 | virtualized collection 만 window rebuild. window 가 O(visible)이라 rebuild 저렴 | ✅ 정본 채택 |
| (C) collection-local rebuild key | collection 단위 부분 재-build. 가장 정밀하나 cache 구조 대수술 | 향후 최적화(§8-Q7) |

> **non-virtualized scroll 은 현행 유지**: window 변경이 없는 작은 collection(< VIRTUALIZE_THRESHOLD)은 기존 translate-only scroll(재-build 없음)을 그대로 쓴다. scrollVersion 5번째 key 는 **virtualized collection 이 존재할 때만** rebuild 를 유발하도록, build 함수가 virtualized collection 유무를 cache 무효화 조건에 반영한다(scrollVersion 변경 + virtualized collection 존재 → rebuild; 그 외 scrollVersion 변경 → translate-only, no rebuild).

### 3-6. zoom/pan 과 culling 좌표 변환

`SkiaRenderer` 실측: `cullingBounds` 는 **scene 좌표**(CSS px / zoom)로 계산되고 contentCanvas 가 `scale(zoom)` 적용. collection virtualization 의 모든 좌표 계산을 scene 좌표계에서 수행하면 zoom 과 자동 정합한다.

| 변경 | scene 좌표 영향 | command 재-build | present |
| --- | --- | --- | --- |
| **pan** | cullingBounds 평행이동 | 불필요 | snapshot blit (tx/ty) |
| **zoom** | cullingBounds 확대/축소 | 불필요(coverage 내) | snapshot blit (zoomRatio) + cubic |
| **collection scroll (non-virtual)** | clip 내부 translate | 불필요 | execute 단 translate (현행) |
| **collection scroll (virtual)** | window item 집합 변경 | **필요** (scrollVersion 5-key) | full redraw |

핵심: virtualized collection scroll 을 pan 으로 착각해 blit 하면 window 가 어긋난다. scroll 은 명시적으로 scrollVersion 을 bump 해 (virtualized 일 때) 재-build 경로로 보낸다.

---

## 4. (4-3) Text Rendering — Pencil App 수준 정확도

### 4-1. 현행 자산이 이미 정본 — 데이터 소스만 generic 화

`nodeRendererText.ts` + `canvaskitTextMeasurer.ts` 는 이미 Pencil 수준 정확도 인프라를 갖췄다. 바뀌는 것은 **데이터 소스(spec → resolved node 의 props/style)** 뿐이며, CanvasKit Paragraph 처리 로직은 그대로 재사용한다. 보존 제약(실측):

| 제약 | 위치(실측) | Why |
| --- | --- | --- |
| `fontFamilies` = `split(",")` → `resolveFamily()` 매핑 | measurer + renderer 동일 배열 | shaping 폭 일치 |
| `heightMultiplier = lineHeight/fontSize` + `halfLeading: true` | renderText | CSS line-height 상하 균등 분배 |
| `strutStyle.forceStrutHeight: true`(heightMultiplier>0) | renderText + measurer | 양쪽 동일 줄 높이 강제 |
| `getLongestLine()`=콘텐츠 폭 / `getMaxIntrinsicWidth()`=max-content | measurer | `getMaxWidth()` 금지 |
| 단일줄 오발 wrap 시 `getMaxIntrinsicWidth()+1` 재layout | renderText | Canvas2D↔CanvasKit sub-pixel 차 |
| 큰 width(≥100000) → `maxIntrinsic+1` 재layout | renderText | CanvasKit 큰 width 텍스트 미표시 |
| WASM Paragraph 캐싱 금지, `{width,height}`만 LRU | measurer | 메모리 누수 |

### 4-2. resolved node → SkiaNodeData.text (값은 모두 `props`/`props.style` 경유, 검증자 지적 2 수용)

초판은 `node.fontFamily`/`node.fontSize`/`node.content` 를 top-level 로 읽었으나, composition 저장 모델은 이들을 `props.style`(font) 와 `props.children`(content)에 둔다:

```ts
import type { ResolvedNode } from "@composition/shared";

function buildTextNodeData(
  node: ResolvedNode,
  layout: LayoutBox,                // Taffy 결과 (x/y/w/h 는 node top-level 아님)
  visual: ComponentVisualRule | undefined,
  state: ComponentState,
): SkiaNodeData {
  const props = node.props ?? {};
  const style = (props.style ?? {}) as Record<string, unknown>;

  const fontSize = resolveSpecFontSize(style.fontSize as string | number | undefined, 16);
  // ★ lineHeight 함정: "20px" 문자열(절대) vs 숫자(배율) 구분. DFS injection 은 항상 "20px".
  const lineHeightPx = resolveLineHeight(style.lineHeight, fontSize);
  const fontFamilyRaw = (style.fontFamily as string | undefined) ?? "Pretendard";
  const content =
    (props.children as string | undefined) ??
    (props.text as string | undefined) ??
    (props.label as string | undefined) ??
    "";

  return {
    type: "text",
    x: layout.x, y: layout.y, width: layout.width, height: layout.height, // layoutMap 에서
    visible: props.isDisabled !== true,
    text: {
      content,
      fontFamilies: fontFamilyRaw.split(",").map((f) => f.trim().replace(/['"]/g, "")),
      fontSize,
      fontWeight: typeof style.fontWeight === "number" ? (style.fontWeight as number) : 400,
      lineHeight: lineHeightPx,
      color:
        (style.color as string | undefined) ??
        visual?.text ??                       // node.fill 아님 — rule 테이블 text 색
        "{color.neutral}",
      maxWidth: layout.width,                 // wrap 폭 = Taffy 결과 width
      align: mapTextAlign(style.textAlign as string | undefined),
      verticalAlign: (style.verticalAlign as string | undefined) ?? "top",
      whiteSpace: (style.whiteSpace as string | undefined) ?? "normal",
      wordBreak: (style.wordBreak as string | undefined) ?? "normal",
      overflowWrap: (style.overflowWrap as string | undefined) ?? "normal",
      paddingLeft: parsePxValue(style.paddingLeft ?? style.padding, 0),
      paddingTop: parsePxValue(style.paddingTop ?? style.padding, 0),
      paddingBottom: parsePxValue(style.paddingBottom ?? style.padding, 0),
    },
  };
}
```

이 출력 shape 는 현행 `renderText(ck, canvas, node, fontMgr)` 가 **그대로** 소비한다 — 렌더 로직 변경 0.

### 4-3. DOM ↔ Skia 텍스트 시각 대칭 — Canvas2D Break Hint Injection

대칭 = "시각 결과의 동일성"(`ssot-hierarchy.md` D3). 측정 엔진 차이(CanvasKit HarfBuzz vs 브라우저)에서 줄바꿈 위치가 어긋날 수 있다. 현행 ADR-051 해법 정본화:

```ts
// 줄바꿈 위치 일치 보장 — 측정(Canvas2D, 브라우저 엔진과 동일)이 정한 wrap 을
// \n 으로 삽입 → CanvasKit 렌더가 강제 → DOM 브라우저 줄바꿈과 ~99% 일치 (renderText 실측).
if (USE_CANVAS2D_MEASURE && !needsFallback(c2dStyle)) {
  const c2dResult = measureWithCanvas2D(processedText, c2dStyle, layoutMaxWidth);
  renderableText = c2dResult.hintedText;
  effectiveLayoutWidth = Math.max(layoutMaxWidth, Math.ceil(c2dResult.width) + 1);
}
```

| 대칭 위협 | 해법(실측) |
| --- | --- |
| 줄바꿈 위치 어긋남 | Canvas2D Break Hint Injection |
| 줄 높이 어긋남 | `halfLeading: true` + `forceStrutHeight` 양쪽 동일 |
| 수직 중앙 어긋남 | 단일줄=글리프 baseline, 다줄=`getHeight()` 기반 |
| sub-pixel 폭 차로 1줄→2줄 오발 | `getMaxIntrinsicWidth()+1` 재layout |
| `lineHeight` 숫자/문자열 혼동 | px 문자열로 정규화 후 `heightMultiplier` 계산 |

### 4-4. collection 안 수천 텍스트 — 측정 캐싱 + 가상화 결합

5,000행 × 셀당 텍스트 → 수만 측정이 text 렌더 성능 급소다. 두 캐시가 가상화와 결합:

```
가상화(§3): 측정/렌더 대상을 visible window(~30행 × N셀)로 축소.
측정 캐시(measurer LRU): 같은 (text, style) 1회만 측정. 스크롤 재진입 시 캐시 히트.
Paragraph 캐시(renderText LRU): 같은 key Paragraph 객체 재사용(window 내 반복 라벨 공유).
```

```ts
function measureRowHeight(
  collectionId: string, rowIndex: number,
  cells: ResolvedNode[], rowWidth: number, ctx: VisitContext,
): number {
  const cached = ctx.measuredRowSizes.get(collectionId)?.[rowIndex];
  if (cached && cached > 0) return cached; // 이미 layout 됨 → 재측정 0

  let maxCellHeight = 0;
  for (const cell of cells) {
    const content =
      (cell.props?.children as string | undefined) ??
      (cell.props?.text as string | undefined);
    if (!content) continue;
    const r = textMeasurer.measureWrapped(content, cellStyle(cell), cellWidth(cell, rowWidth));
    maxCellHeight = Math.max(maxCellHeight, r.height); // measurer 내부 LRU
  }
  const h = maxCellHeight + rowPadding(collectionId);
  recordMeasuredSize(ctx, collectionId, rowIndex, h);
  return h;
}
```

캐시 크기: `MAX_MEASURE_CACHE_SIZE=1000`(measurer 실측), `getMaxParagraphCacheSize()`(renderText). 가상화로 동시 활성 텍스트가 window 크기로 제한되므로 LRU 1000 이면 일반 collection 에 충분(window ~30행 × N셀 << 1000).

> **검증 필요(§8-Q8)**: wide table(50+ 컬럼) × 가변 텍스트 시 1프레임 측정량이 1000 entry 초과 → thrashing 가능. collection 활성 시 캐시 동적 확대 검토.

---

## 5. 통합 — command stream cache 5-key 와 virtualization signature

§3-5 의 정정에 따라 command stream cache 는 **5-key**(`registryVersion + pagePositionsVersion + framePositionsVersion + sharedLayoutVersion + scrollVersion`)로 확장된다. scrollVersion 변경은 **virtualized collection 이 존재할 때만** window rebuild 를 유발하고, 그 외(non-virtual collection)는 현행 translate-only scroll 을 유지한다.

`sceneVersion` signature(ADR-136 — `canvas-rendering.md §9` "projection-relevant field 추가 시 signature input 동시 갱신")에 collection 관련 field 를 추가한다. ADR-136 의 `layoutVersion` 3-심볼 체인과 동급 보수 의무:

```ts
// buildSceneStructureSnapshot signature 확장 — collection state 동시 갱신(ADR-136 정합)
function collectionSignatureInput(node: ResolvedNode, scrollOffset: number): string {
  const v = detectCollectionViewport(node, rowCountOf(node), scrollOffset);
  if (!v) return "";
  return [
    node.id,
    v.scrollOffset,            // 런타임 store 값
    v.totalItemCount,
    v.estimatedItemSize,
    measuredSizeVersion(node.id), // 측정 누적 버전 — 가변 높이 보정 반영
  ].join(":");
}
```

> 누락 시 same-count phantom change 미감지(signature false negative — `canvas-rendering.md §9`). 신규 collection projection field 추가 시 본 input 목록 동시 갱신.

---

## 6. 금지 패턴 (정본 — 위반 시 N++ 복제 / 평행 경로 발명 / 대칭 파괴)

- ❌ 렌더 dispatch 에 컴포넌트 식별 분기(`if (type==="Button") / if (isDot 인라인) / if (divider 인라인)`). tag-keyed 데이터 조회(`getPrimitiveBinding(type)`)만 허용. (검증자 3)
- ❌ `SkiaPrimitiveDrawFn` 을 `(ck, canvas, ...) => void` 직접 draw 로 서술. **`(ctx) => Shape[] | null` Shape 생성기**다. 출력은 `specShapesToSkia` 거쳐 기존 SkiaNodeData 로 흡수. (검증자 1)
- ❌ `CMD_DRAW` 에 `case "custom"` / `customDraw` / `SkiaNodeData "custom"` type 신설. 기존 case(box/text/image/line/icon_path/partial_border)만 존재 — 새 case 0. (검증자 1)
- ❌ arc 를 별도 SKIA_PRIMITIVE 항목 또는 별도 SkiaNodeData type 으로. **`type:"box"` + `arc` 데이터**로 변환(`specShapeConverter.ts:364`). (검증자 1)
- ❌ 시각/기하 값을 `node.fill`/`node.cornerRadius`/`node.x/y` top-level 로 읽기. 모두 `props`/`props.style`/rule 테이블/layoutMap 경유. (검증자 2)
- ❌ `state`/`scrollOffset` 을 resolved node 필드로 읽기. **런타임 store**(componentState 파라미터 / useScrollState)에서 주입. (검증자 2)
- ❌ `node.props.dataBinding` 직접 접근. `x-composition.dataBinding` extension 또는 collection binding scope 경유. (검증자 5)
- ❌ `resolveComponentBinding` / `resolvePrimitiveType`(미존재) 호출. 실측 `getPrimitiveBinding(type)` / `getSkiaPrimitive(key)`. (검증자 3·5)
- ❌ import 경로 `adapters/canonical/resolveCanonicalDocument`. 타입은 `@composition/shared`, 함수는 `apps/builder/src/resolvers/canonical`. (검증자 2)
- ❌ collection scroll 을 `layoutVersion` bump 로 흡수. scroll 은 **별도 `scrollVersion`** — cache 5번째 key 편입, virtualized collection 만 window rebuild. (검증자 4)
- ❌ grid collection(Table)에 window detach(전략 B) 무검증 적용. grid full-rebuild 규칙과 충돌 — §8-Q6 게이트 통과 전 전략 A. (검증자 6)
- ❌ collection 전체 행을 Taffy 등록 후 draw culling 만(전략 A)을 data-bound 수천 행 flex/block 에 적용. window layout only(B, §8-Q5 통과 후).
- ❌ spacer 를 빈 command 로 생성. 좌표 translate 로 흡수.
- ❌ WASM Paragraph 객체 캐싱. `{width,height}` 결과만 LRU.
- ❌ `getMaxWidth()` 로 콘텐츠 폭. `getLongestLine()`.
- ❌ `lineHeight` 숫자 전달(배율 오해석). px 문자열 정규화.
- ❌ 측정기/렌더러 다른 `fontFamilies` 배열. 양쪽 `split(",")` → `resolveFamily()` 동일.
- ❌ layout 경로에 Canvas2D↔CanvasKit 보정(+2/+4px). 렌더 단 `getMaxIntrinsicWidth()+1`만.
- ❌ `sceneVersion` signature 에 collection scroll/count/measuredSize field 누락(phantom change 미감지).

---

## 7. RAC/CanvasKit/Pencil 1차 원리 근거 요약

| 설계 결정 | 1차 원리 근거 | 실측 정합 |
| --- | --- | --- |
| tag-keyed 데이터 분기(컴포넌트 식별 if 아님) | Pencil 87 컴포넌트=11 node. CSS box model 동형. 단 composition 은 ComponentTag 유지 → getPrimitiveBinding 데이터 조회 | `buildSpecNodeData.ts:771/787` |
| skiaPrimitive = Shape[] 생성기 | spec-free rule 주입(ADR-142 B2) — Shape descriptor → specShapesToSkia → 기존 SkiaNodeData | `skiaPrimitives.ts:35/308` |
| arc=box+arc 데이터 | renderNodeInternal switch 도달 회피 | `specShapeConverter.ts:364`, `canvas-rendering.md §7` |
| 시각/기하=props/style | composition canonical 저장 모델 | `composition-document.types.ts:336` |
| state/scrollOffset=런타임 주입 | ADR-135/136 render-space vs canonical document 분리 | `composition-document.types.ts:331` |
| 2단계 culling | RAC Virtualizer = 보이는 Node 만 layout+mount | `collectVisibleFrameRoots` 존재 |
| window layout only(B, 게이트) | RAC ListLayout. 단 grid full-rebuild 규칙 충돌 검증 필요 | `layout-engine.md` PersistentTaffyTree |
| 가변 높이 + measured cache | RAC ListLayout measured size cache | — |
| scrollVersion 5-key 편입 | scroll 은 layoutVersion 아님 — 전역 무효화 회피 | `skiaFramePipeline.ts:358`, `canvas-rendering.md §8` |
| Canvas2D Break Hint Injection | CanvasKit HarfBuzz ≠ 브라우저 shaping | ADR-051 |
| Paragraph 결과만 캐싱 | WASM Paragraph = native 메모리 누수 | measurer LRU |

---

## 8. 검증 필요 항목 (open question — '검증 필요'를 넘어 게이트 승격분 포함)

| ID | 항목 | 심각도 | 게이트 |
| --- | --- | :---: | --- |
| Q1 | ADR-142 궁극 end-state(11 primitive 직접 렌더)는 ComponentTag→primitive 분해 pass 가 resolver/import 단에 선행 도입돼야 가능. 그 분해는 **본 레이어 밖** — 현재 미구현. 현 정본은 tag-keyed (a) 경로 | HIGH | 분해 pass 도입 ADR 별도 필요 시 명시 |
| Q3 | `VIRTUALIZE_THRESHOLD=50` / `DEFAULT_ROW_HEIGHT=36` 출발 추정치 | MED | Chrome MCP 프로파일로 60fps 유지 동시 draw item 수 측정 |
| Q4 | `readCollectionBindingRef(node.id)` — ADR-132 collections root collection 에서 Skia build 경로(non-hook)가 binding reference 읽는 실제 진입점 확정 | HIGH | store snapshot 조회 형태 재유도 |
| Q5 | `retainOnly`(window detach)가 flex/block collection 에서 PersistentTaffyTree full-rebuild 미유발 — 매 scroll 프레임 증분 경로 유지 | **HIGH** | 실측 게이트. 유발 시 node pool 재사용 fallback |
| Q6 | Table(grid) collection measured-size 누적이 grid track 캐시 invalidation 과 충돌 안 함 | **HIGH** | 충돌 시 grid 는 전략 A 제한 |
| Q7 | collection-local rebuild key(방안 C) — scrollVersion 5-key 대비 정밀 부분 재-build. cache 구조 대수술 필요 | LOW | 향후 최적화 |
| Q8 | wide table(50+ 컬럼) 1프레임 측정량 > LRU 1000 thrashing | MED | collection 활성 시 캐시 동적 확대 |

---

<a id="영역-5"></a>

# ⑤ Style & Properties Panel 연동 — generic Inspector 아키텍처 (정정판)

> **정정 요약 (검증자 4 지적 전수 반영)**: ① size→fontSize 단일공급처 수렴은 색상(variant/fill)만 실현·size 차원은 아직 미배선임을 명시 + 별도 작업으로 surface, ② propsSchema 저장 위치를 `metadata`(봉인 영역) 에서 정식 `x-composition` extension 으로 정정 + 기존 `PropsSchema` 타입 재사용 명시, ③ 모든 `inspectorActions.ts` 경로를 `apps/builder/src/builder/stores/inspectorActions.ts`(`utils/` 하위 아님) 로 정정, ④ instance nested override 가 현재 canonical `RefNode.descendants` 직접이 아니라 component-instance mirror(`COMPONENT_OVERRIDES_MIRROR_FIELD`) 경유 과도기임을 명시 + canonical-direct 를 목표 상태로 분리.

## 0. 1차 원리에서 다시 세운 전제

기존 composition 은 컴포넌트당 `spec.properties.sections: SectionDef[]` + `SpecField` 분기 + `editors/*Editor.tsx` 30+ 개로 패널을 구성한다. 이 구조는 "새 컴포넌트 = 새 패널 정의 파일"을 강제한다 — 컴포넌트 N 개에 패널 코드 N 벌.

두 외부 자산은 다른 결론을 준다.

**RAC 원리**: RAC 컴포넌트는 패널/Inspector 개념이 없다. RAC 는 D1(접근성 DOM) + render-prop state 만 책임지고, 편집 UI 는 RAC 바깥의 일이다. 따라서 "편집 필드"는 RAC 가 노출하는 props surface(= D2)의 함수이지 컴포넌트별 수작업이 아니다. `<Button>` 이 받는 props 는 `variant`/`size`/`isDisabled`/`onPress` 이고, 이 집합 자체가 "편집 가능한 것"의 SSOT 다.

**Pencil 원리**: Pencil canonical document 는 모든 노드가 같은 보편 속성 집합(`type/width/fill/x/y/...`)을 갖는다. CSS 가 모든 요소에 같은 속성 vocabulary 를 적용하듯, 편집 UI 도 "노드 type 별 if 분기"가 아니라 "이 노드가 어떤 속성을 갖는가"의 generic 매핑이다. reusable(컴포넌트 origin)은 노출 prop 을 선언하고, instance(`ref`)는 `descendants` path override 로 편집한다 — 편집 메커니즘이 데이터에 직접 들어있다.

→ **결론(ADR-142 end-state 와 수렴)**: Inspector field 생성기는 컴포넌트당 코드가 아니라, 선택 노드의 `PropContract` 집합(leaf=`binding.props.accepts`, 조합=reusable 의 `propsSchema`) + theme 를 입력받는 **단일 generic renderer**. 이는 이미 `buildInspectorFields`(packages/shared/src/catalog/outputs/inspectorFields.ts) + `CatalogInspectorFields`(apps/builder/.../generic/CatalogInspectorFields.tsx)로 D2 영역에 실재한다. 본 설계는 (a) 이 구조를 1차 원리 언어로 재서술하고, (b) 아직 generic 화되지 않은 부분(D3 Style Panel 의 보편 속성, instance root override, theme 기반 variant/size 값, derivedUpdateFn 흡수)을 동일 원리로 확장한다.

---

## 1. 네 개의 도메인 축과 단일 SSOT 매핑

편집 패널은 한 덩어리가 아니라 **두 패널 × 두 D-domain** 이다. 혼동을 막기 위해 먼저 축을 고정한다.

| 패널 | 도메인 | SSOT 공급처 | 편집 대상 | 저장 위치 |
| --- | --- | --- | --- | --- |
| **Properties Panel** | D2 (Props/API) | `PropContract` 집합 (leaf=`accepts`, 조합=`propsSchema`) | `variant`/`size`/`isDisabled`/`label`/`children` 등 컴포넌트 의미 props | `CanonicalNode.props` |
| **Style Panel** | D3 (시각) | theme tokens + 보편 속성 vocabulary | `x`/`y`/`width`/`height`/`fill`/`stroke`/`cornerRadius`/`padding`/`gap`/`layout` | `CanonicalNode.props.style` (longhand) + 보편 layout 필드 |

핵심 불변식 4 개(사용자 요청):

1. **단일 공급처 (현 수렴도 정직 진술 — 검증자 지적 ① 반영)**: 목표는 `button.size="sm" → fontSize:14` 가 DOM/Skia/Panel/Publish 4 곳 동일. **그러나 현 코드의 수렴도는 차원별로 다르다**:
   - **색상(variant/fill) 차원 — 수렴 실현**: `resolveComponentRule(type, doc)`(packages/shared/src/catalog/resolvers/resolveComponentRule.ts:23, `doc?` 파라미터 line 25 지원) 으로 variant 색상이 단일 read 로 수렴됐다. `doc.componentRules?.[type] ?? COMPONENT_RULES_TABLE[type]` 우선순위로 문서 override 도 처리.
   - **size→fontSize 차원 — 아직 미수렴(검증 필요)**: Skia 경로는 `buildSpecNodeData.ts:847` 이 `const sizeSpec = spec.sizes[size] ?? spec.sizes[spec.defaultSize]` 로 **legacy ComponentSpec(`spec.sizes`)에서** 읽고, DOM 경로는 `CanonicalNodeRenderer.tsx:243-245` 가 `data-size` 속성 → generated CSS(`[data-size="sm"]{font-size}`) 로 받는다. 둘 다 `resolveComponentRule().sizes` 를 **경유하지 않는다**. `COMPONENT_RULES_TABLE` 이 spec 에서 build-생성되므로 값은 우연히 일치하지만, "단일 read 로의 수렴"은 미배선이다.
   - **추가 gap**: `resolveSkiaVisualRule.ts:54` 와 `resolveSkiaRule.ts` 는 `resolveComponentRule(type)` 를 **doc 인자 없이** 호출 → `doc.componentRules` 문서 override 가 Skia 경로에 도달하지 못한다(색상 차원조차 문서 override 는 Skia 미반영).
   - **정정된 불변식 진술**: "변환 테이블은 `ComponentRuleSize`(composition-document.types.ts:153)로 명명돼 있으며 색상 차원은 `resolveComponentRule` 단일 read 로 수렴됐다. size→fontSize 단일 read 수렴 + doc override 의 Skia 도달은 §1.1 의 별도 배선 작업으로 surface."
2. **편집 → 즉시 4 consumer**: 편집 commit 은 canonical mutation 한 번 → 동일 derived snapshot 을 4 consumer 가 구독.
3. **컴포넌트당 분기 0**: `PropertiesPanel.tsx` 의 `switch(type)` / `editors/*Editor.tsx` dispatch 제거 → generic renderer 1 개.
4. **TypeScript 실무 수준**: 아래 §3~§6 코드.

### 1.1 size→fontSize 단일 read 수렴 — 별도 배선 작업 (surface, 검증자 지적 ① 반영)

현 분리 상태를 목표 수렴 상태로 옮기는 작업을 본 설계의 후속 배선 항목으로 명시한다. 두 변경:

```ts
// (1) resolveSkiaVisualRule / resolveSkiaRule 에 doc 전달 — doc.componentRules 의 Skia 도달.
//     현행: resolveComponentRule(type)            (resolveSkiaVisualRule.ts:54, doc 누락)
//     목표: resolveComponentRule(type, doc)
export function resolveSkiaVisualRule(
  type: string,
  variantName: string | undefined,
  doc?: CompositionDocument | null,          // ← 신규 파라미터
): ComponentVisualRule | undefined {
  const rule = resolveComponentRule(type, doc); // ← doc 전달
  // ... 이하 동일
}

// (2) buildSpecNodeData:847 의 size 차원 read 를 resolveComponentRule().sizes 로 전환.
//     현행: const sizeSpec = spec.sizes[size] ?? spec.sizes[spec.defaultSize];
//     목표: const rule = resolveComponentRule(type, doc);
//           const ruleSize = rule?.sizes[size] ?? rule?.sizes[rule.defaultSize ?? ""];
//           const sizeSpec = ruleSize ? ruleSizeToSizeSpec(ruleSize) : spec.sizes[size];
//           // (ruleSizeToSizeSpec 는 resolveSkiaVisualRule.ts 에 이미 존재)
```

> **검증 필요**: 이 전환은 `spec.sizes` 와 `COMPONENT_RULES_TABLE[type].sizes` 의 키/값 1:1 정합을 전제한다. `ComponentRuleSize` 는 `number|string` 투영(ruleSizeToSizeSpec)이라 `SizeSpec` 의 모든 필드(gap/paddingX/lineHeight 등)를 cover 하는지 build-time 검증이 선행돼야 한다. DOM 경로의 generated CSS `[data-size]` selector 도 같은 테이블 파생인지 별도 확인. 본 작업은 **현 설계의 헤드라인 예시(size→fontSize 4곳 동일)를 실제로 단일 read 로 만드는 별도 배선** 이며, 현재는 "같은 spec 파생이라 값만 우연히 일치"하는 상태다.

---

## 2. 편집 데이터 흐름 다이어그램 (편집 → SSOT → 4 consumer)

```
                          ┌─────────────────────────────────────────────┐
                          │  CompositionDocument (canonical, primary SSOT)│
                          │  ├─ children: CanonicalNode[]                  │
                          │  │    └─ node.props  (D2 props + props.style)  │
                          │  ├─ componentRules  (D3 variant 색상; size 차원 │
                          │  │                    은 아직 미수렴 §1.1)      │
                          │  ├─ tokens          (D3 색 토큰: "$--accent")  │
                          │  └─ reusable 노드 x-composition.propsSchema     │
                          │       (조합 편집 계약 — metadata 아님 §6-3)     │
                          └───────────────▲──────────────┬────────────────┘
                                          │ mutation     │ read (derive)
                  ┌───────────────────────┘              │
                  │                                       │
   ┌──────────────┴───────────────┐         ┌────────────▼──────────────────┐
   │  Inspector (편집 입력)         │         │  resolveCanonicalDocument()    │
   │  ┌─────────────────────────┐ │         │  → ResolvedNode tree           │
   │  │ resolveEditContract(node)│ │         │   (ref 펼침 + descendants merge│
   │  │  → PropContract[]        │ │         │    + token resolve)            │
   │  └───────────┬─────────────┘ │         └──┬───────────┬────────────┬───┘
   │  buildInspectorFields()      │            │           │            │
   │  + InspectorFieldTheme       │            ▼           ▼            ▼
   │  ┌───────────▼─────────────┐ │      ① DOM         ② Skia       ③ Publish
   │  │ CatalogInspectorFields  │ │     Canonical-     buildSpec-     (publish app:
   │  │  (kind별 control)       │ │     NodeRenderer    NodeData →      동일 resolve
   │  └───────────┬─────────────┘ │     (data-size →    buildCatalog-   → DOM)
   │              │ onUpdate(patch)│     CSS / 색상은    Shapes; size 는
   └──────────────┼───────────────┘     resolveComp.)   spec.sizes §1.1
                  │
                  ▼
   updateSelectedProperty/Properties (D2)         ④ Panel 자신 (편집값 재표시)
   updateSelectedStyle (D3, longhand 분배)          = currentProps 재구독
                  │
                  ▼
   updateAndSave(id, patch) ──► mergeXxxIntoCanonicalDocument (canonical 1차)
                            ──► set({elements}) (legacy array derive)
                            ──► _rebuildIndexes (canonical 기반)
                            ──► persistActiveCanonicalDocument (IndexedDB, bg)
```

**불변식 4가 보장되는 지점**: 편집은 canonical `node.props` 만 mutate. 4 consumer 는 같은 canonical → resolve 파이프라인을 구독하므로 mutation 직후 동일 값(색상 차원). size 차원은 §1.1 배선 전까지 "같은 spec 파생" 으로만 일치. Panel(④)도 별도 store 가 아니라 같은 canonical 에서 `currentProps` 를 재구독 → 자기 편집이 바로 반영(round-trip 무손실).

---

## 3. resolveEditContract — 노드 → PropContract 집합 (단일 진입점)

Inspector 가 "이 노드는 어떤 필드를 편집하나"를 얻는 **유일한 함수**. leaf/조합/native 를 한 곳에서 판정해 컴포넌트당 분기를 흡수한다. 이것이 현행 `GenericPropertyEditor` 의 `getPrimitiveBinding(type)` 직접 호출(분산)을 대체하는 신규 seam.

```ts
// packages/shared/src/catalog/resolvers/resolveEditContract.ts
import type {
  CanonicalNode,
  CompositionDocument,
  CompositionExtensionNode,
} from "../../types/composition-document.types";
import type { PropsSchema } from "../types"; // ← 기존 타입 재사용 (catalog/types.ts:147)
import { getCatalogEntry } from "../componentCatalog";
import { getPrimitiveBinding } from "../bindings";

/** Inspector 가 편집할 PropContract 집합 + 출처 메타. 컴포넌트당 분기 대체 SSOT. */
export interface EditContract {
  /** key → PropContract. buildInspectorFields 입력. (= PropsSchema, catalog/types.ts:147) */
  contracts: PropsSchema;
  /**
   * 편집 대상의 D2 종류.
   * - "primitive": leaf RAC. contracts = binding.props.accepts.
   * - "instance": ref 노드. contracts = 참조 reusable 의 propsSchema (root props override).
   * - "native": frame/Slot 등. contracts = 보편 layout 계약(아래 NATIVE_PROP_CONTRACTS).
   */
  source: "primitive" | "instance" | "native";
  /** instance 일 때 참조 reusable 노드 id (descendants 경로 편집용). */
  refId?: string;
}

/**
 * 단일 노드의 편집 계약 해석.
 * - leaf primitive: catalog binding.props.accepts.
 * - ref(instance): reusable 노드의 propsSchema (없으면 빈 계약 → instance 는 자식 override 만).
 * - native(frame 등): 보편 layout 계약.
 */
export function resolveEditContract(
  node: CanonicalNode,
  doc: CompositionDocument | null | undefined,
): EditContract {
  // (1) instance — type:"ref" → 참조 reusable 의 propsSchema 가 D2 source.
  if (node.type === "ref") {
    const refId = (node as { ref?: string }).ref;
    const reusable = refId ? findReusableNode(doc, refId) : undefined;
    const schema = reusable ? readPropsSchema(reusable) : {};
    return { contracts: schema, source: "instance", refId };
  }

  // (2) leaf primitive — catalog binding.props.accepts.
  const binding = getPrimitiveBinding(node.type);
  if (binding) {
    return { contracts: binding.props.accepts, source: "primitive" };
  }

  // (3) native — frame/Slot/MaskedFrame. RAC binding 도 reusable 도 아님.
  //     D2 props 는 거의 없고 D3 보편 속성(Style Panel)이 주 편집 대상.
  return { contracts: NATIVE_PROP_CONTRACTS[node.type] ?? {}, source: "native" };
}

/**
 * reusable 노드가 노출한 propsSchema.
 *
 * 검증자 지적 ② 반영 — 저장 위치는 metadata 가 아니라 `x-composition` extension.
 * composition-document.types.ts:30,344 가 metadata 를 'adapter/debug, props
 * extraction 금지'로 봉인했으므로, store consumer(Inspector)는 metadata 에서
 * 추출하면 안 된다. 대신 ADR-116 §3 정식 extension namespace
 * (`CompositionExtensionNode["x-composition"]`, line 639) 의 propsSchema 필드를 읽는다.
 */
function readPropsSchema(node: CanonicalNode): PropsSchema {
  const ext = (node as CompositionExtensionNode)["x-composition"];
  return ext?.propsSchema ?? {};
  // ※ CompositionExtension 에 propsSchema 필드 추가는 schema 확장 (§6-3 검증 필요).
}

function findReusableNode(
  doc: CompositionDocument | null | undefined,
  refId: string,
): CanonicalNode | undefined {
  if (!doc) return undefined;
  // local id 우선. import 참조 "<importKey>:<nodeId>" 분해는 §6 검증 필요 영역.
  const stack = [...doc.children];
  while (stack.length) {
    const n = stack.pop()!;
    if (n.id === refId && n.reusable) return n;
    if (n.children) stack.push(...n.children);
  }
  return undefined;
}

/** native frame 의 최소 D2 계약 (대부분 D3 보편 속성으로 편집). */
const NATIVE_PROP_CONTRACTS: Record<string, PropsSchema> = {
  frame: {
    clip: { kind: "boolean", label: "Clip", section: "appearance" },
  },
};
```

**왜 단일 함수인가**: `GenericPropertyEditor` 는 현재 leaf 만 `getPrimitiveBinding` 으로 분기하고 instance/native 는 legacy editors 로 빠진다. `resolveEditContract` 로 모으면 Inspector 진입점이 `const { contracts } = resolveEditContract(node, doc)` 한 줄 — instance/native 도 동일 generic renderer 를 탄다(컴포넌트당 분기 0).

---

## 4. theme 기반 variant/size 값 집합 — InspectorFieldTheme 의 목표 구현

`PropContract.kind="variant"|"size"` 는 `options` 를 두지 않는다(types.ts:140 주석). 선택 가능 값은 **컴포넌트당 enum 이 아니라 theme 규칙** 에서 읽는다. 현행 `GenericPropertyEditor` 의 `specInspectorTheme` 은 전환기 어댑터로 `spec.variants/sizes` keys 를 읽지만, 목표는 `ComponentRule`(= theme 가 build 한 D3 규칙) keys 다 — spec 참조 0.

```ts
// apps/builder/src/builder/panels/properties/generic/componentRuleTheme.ts
import {
  resolveComponentRule,
  type InspectorFieldTheme,
  type InspectorFieldOption,
} from "@composition/shared";
import type { CompositionDocument } from "@composition/shared";
import { inferLabel } from "./inferLabel";

const SIZE_LABELS: Record<string, string> = {
  xs: "XS", sm: "SM", md: "MD", lg: "LG", xl: "XL",
};

/**
 * 목표 theme adapter — variant/size 값 집합을 ComponentRule 에서 읽는다.
 * spec 참조 0. doc.componentRules override 우선, build-time COMPONENT_RULES_TABLE fallback
 * (resolveComponentRule 내부 처리, doc? 파라미터 line 25).
 *
 * 핵심: 선택 가능 variant/size 는 "컴포넌트가 정의"하는 게 아니라 "theme 규칙이 정의"한다.
 * 같은 Button 이 theme A 에선 {primary,secondary}, theme B 에선 {primary,secondary,ghost}.
 *
 * 주의(§1.1): variant 값 집합은 ComponentRule.variants 로 수렴됐으나, size→fontSize
 * 변환 자체의 Skia/DOM 소비는 아직 미수렴. 본 theme 는 "선택 가능 값 목록" 생성만
 * 담당하며, 그 값으로의 변환 read 경로 수렴은 §1.1 별도 작업.
 */
export function createComponentRuleTheme(
  doc: CompositionDocument | null | undefined,
): InspectorFieldTheme {
  return {
    resolveDimensionOptions(componentType, _propKey, kind): InspectorFieldOption[] {
      const rule = resolveComponentRule(componentType, doc);
      if (!rule) return [];
      if (kind === "variant") {
        return Object.keys(rule.variants).map((value) => ({
          value,
          label: inferLabel(value),
        }));
      }
      return Object.keys(rule.sizes).map((value) => ({
        value,
        label: SIZE_LABELS[value] ?? value.toUpperCase(),
      }));
    },
  };
}
```

이로써 `Button.binding.ts` 의 `variant: { kind:"variant" }` 는 **options 를 선언하지 않아도** Inspector 에서 theme 가 제공한 `[primary, secondary, ...]` 드롭다운으로 렌더된다. theme 가 바뀌면 같은 binding 이 다른 값 집합을 노출 — 컴포넌트 코드 변경 0. (현행 `specInspectorTheme` 을 이 함수로 교체하면 spec 의존 제거.)

---

## 5. 필드 그룹핑 — section 은 컴포넌트 섹션 목록이 아니라 PropContract 태그

`buildInspectorFields`(inspectorFields.ts)가 이미 핵심 메커니즘을 구현한다. 1차 원리 재서술:

- 그룹은 `spec.properties.sections: SectionDef[]`(컴포넌트가 선언한 섹션 목록)가 아니라, 각 `PropContract.section` 태그(`"content"|"appearance"|"state"|"locale"`)로 **자동 집계** 된다.
- 순서는 `PropContract` 의 삽입 순서(first-appearance) 보존 — `Object.entries(accepts)` 순회 순서. Button binding 이 `children(content) → variant(appearance) → ... → isPending(state)` 순으로 선언하면 그룹도 그 순서.
- 컴포넌트가 섹션을 "정의"하지 않는다. 섹션은 그 컴포넌트가 가진 prop 들의 section 태그 합집합의 부산물.

```ts
// 의미상: 컴포넌트당 SectionDef[] 없이, prop 태그가 그룹을 만든다.
// buildInspectorFields("Button", buttonBinding.props.accepts, theme) →
// [
//   { section: "content",    fields: [{key:"children", kind:"string"}] },
//   { section: "appearance", fields: [{key:"variant", kind:"variant", options:[...theme]},
//                                     {key:"size", kind:"size", options:[...theme]},
//                                     {key:"fillStyle", kind:"fillStyle", options:[fill,outline]}] },
//   { section: "state",      fields: [{key:"type",...},{key:"isPending",...},{key:"isDisabled",...}] },
// ]
```

native frame 은 `clip(appearance)` 만 → `appearance` 그룹 하나. TextField 는 `label/description/placeholder/type(content) + size/labelPosition/isQuiet(appearance) + isRequired/.../isInvalid(state)`. **세 컴포넌트가 같은 코드 경로** 로 서로 다른 그룹 구조를 자동 생성 — 이것이 "스타일 패널이 모든 컴포넌트에 균일 적용"의 실체.

`Locale` 그룹: DateField/Calendar 류의 `firstDayOfWeek`/`hourCycle` 같은 prop 에 `section:"locale"` 태그만 붙이면 자동으로 Locale 그룹이 생긴다 — 컴포넌트당 Locale 섹션 코드 없음.

---

## 6. instance(ref) 편집 — root props override + descendants 3-mode

가장 까다로운 영역. instance 는 두 층위로 편집된다.

### 6-1. 두 층위 + 현 저장 메커니즘 (검증자 지적 ④ 반영)

1. **root props override**: instance 자체의 props(예: ToggleButton instance 의 `isSelected`, Button instance 의 `variant`). 편집 대상 계약 = 참조 reusable 의 `propsSchema`(§3 `resolveEditContract` source="instance"). **목표** 저장 위치 = `RefNode.props`, resolver 가 reusable base props 위에 merge. **현 상태**: root props override + propsSchema 조회는 미구현(검증 필요 영역) — 본 설계가 채우는 부분.
2. **nested(자식) override**: instance 내부 특정 자식 노드의 속성 변경. **목표** 저장 위치 = `RefNode.descendants[path]` 의 3-mode(A 속성 patch / B 노드 교체 / C children 교체, composition-document.types.ts:283 `DescendantOverride`). **현 상태(정정)**: `buildInstanceDescendantPatches`(inspectorActions.ts:240)는 canonical `RefNode.descendants` 를 **직접 쓰지 않고** legacy component-instance mirror 를 경유한다 — `getComponentDescendantsMirror(element)`(line 246) 로 현재 mirror 를 읽어 `COMPONENT_OVERRIDES_MIRROR_FIELD` 에 patch 를 쌓는다. 진입 판정 `isInspectorInstanceElement`(line 224-226)도 `isComponentInstanceMirrorElement(element) || isCanonicalRefElement(element)` 로 **mirror element 와 canonical ref 둘 다 수용하는 과도기** 상태다.

> **정정된 진술**: nested override 도 root override 와 마찬가지로 **현재 canonical-direct 가 아니다**. 둘 다 component-instance mirror(`COMPONENT_OVERRIDES_MIRROR_FIELD`, getComponentDescendantsMirror) 경유 과도기다. `RefNode.descendants` 직접 write(canonical-direct)로의 전환은 **ADR-122 잔존 mirror 해체 후속 작업** 이며, 본 설계에서는 목표 상태로 분리 표기한다.

### 6-2. generic Inspector 가 두 층위를 모두 흡수하는 구조

```ts
// apps/builder/src/builder/panels/properties/generic/InstancePropertyEditor.tsx
import { memo, useMemo } from "react";
import {
  resolveEditContract,
  type CompositionDocument,
  type InspectorFieldTheme,
  type CanonicalNode,
} from "@composition/shared";
import { CatalogInspectorFields } from "./CatalogInspectorFields";

interface InstancePropertyEditorProps {
  /** RefNode (type:"ref"). */
  instanceNode: CanonicalNode;
  doc: CompositionDocument | null;
  theme: InspectorFieldTheme;
  /**
   * root props override commit.
   * 목표: RefNode.props patch. 현 과도기: instance 가 mirror element 면
   * COMPONENT_OVERRIDES_MIRROR_FIELD 경유 (§6-1) — caller(updateSelectedProperty)가
   * isComponentInstanceMirrorElement 분기로 처리.
   */
  onUpdateRootProps: (patch: Record<string, unknown>) => void;
}

/**
 * instance(ref) 편집기 — leaf 와 **동일한 CatalogInspectorFields** 를 재사용.
 * 차이는 단 하나: 계약 source 가 leaf.accepts 대신 참조 reusable 의 propsSchema.
 * → 컴포넌트당 instance editor 분기 없음. (자식 override 는 트리에서 자식 선택 시
 *   자식 노드 자체의 resolveEditContract 가 처리 — descendant path 매핑은 mutation 층.)
 */
export const InstancePropertyEditor = memo(function InstancePropertyEditor({
  instanceNode,
  doc,
  theme,
  onUpdateRootProps,
}: InstancePropertyEditorProps) {
  const { contracts } = useMemo(
    () => resolveEditContract(instanceNode, doc),
    [instanceNode, doc],
  );

  // instance root props = reusable base props 위 override. 표시값은 현재 RefNode.props.
  const currentProps = (instanceNode.props ?? {}) as Record<string, unknown>;

  return (
    <CatalogInspectorFields
      componentType={instanceNode.type} // "ref" — theme 는 ref 자체엔 variant 없음
      contracts={contracts}             // ← propsSchema (reusable 이 노출한 편집 prop)
      theme={theme}
      currentProps={currentProps}
      onUpdate={onUpdateRootProps}      // ← RefNode.props patch (또는 과도기 mirror)
    />
  );
});
```

**핵심**: instance 편집기가 leaf 편집기와 **같은 `CatalogInspectorFields` 를 재사용** 한다. 차이는 `contracts` 의 출처(accepts vs propsSchema)와 commit 대상(`node.props` vs `RefNode.props`/과도기 mirror)뿐. 컴포넌트당 instance 패널 0.

### 6-3. propsSchema 저장 위치 (검증자 지적 ② 반영 — metadata 폐기, x-composition extension)

reusable origin frame 이 "이 컴포넌트의 사용자가 편집할 수 있는 prop"을 선언하는 곳. **정정**: `metadata.propsSchema` 안은 폐기한다. `composition-document.types.ts:30,344` 가 `metadata` 를 'adapter/debug metadata, props extraction source 로 사용 금지' 로 봉인했고, Inspector 는 store consumer 이므로 metadata 추출은 이 봉인 위반이다. 대신 ADR-116 §3 정식 `x-composition` extension namespace(`CompositionExtensionNode["x-composition"]`, line 639)에 둔다. 그리고 `PropsSchema` 타입은 **신규 도입이 아니라 이미 존재**(catalog/types.ts:147, `PropContract` 주석 line 126 이 "reusable 의 propsSchema" 를 명시)하므로 그대로 재사용한다.

```ts
// reusable origin 노드 예시 (canonical) — x-composition extension 경유
const cardOrigin: CompositionExtensionNode = {
  id: "card-origin",
  type: "frame",
  reusable: true,
  // ❌ metadata.propsSchema 금지 (composition-document.types.ts:30,344 봉인 위반)
  // ✅ 정식 extension namespace (ADR-116 §3, line 639)
  "x-composition": {
    // PropsSchema = Record<string, PropContract> (catalog/types.ts:147 재사용)
    propsSchema: {
      title:   { kind: "string",  label: "Title",   section: "content" },
      variant: { kind: "variant", label: "Variant", section: "appearance" },
      // title 변경 → 내부 text 자식의 content 로 derive (§7 derivedUpdate).
    },
  },
  children: [/* text, body slot, ... */],
};
```

> **검증 필요 (선행 의존)**: `CompositionExtension` 타입(composition-document.types.ts)에 `propsSchema?: PropsSchema` 필드를 추가하는 schema 확장이 선행돼야 한다. 현재 `x-composition` extension 의 정의된 필드는 `events`/`actions`/`dataBinding` 등(line 26)이며 propsSchema 는 포함돼 있지 않다. 따라서 (a) `CompositionExtension` 에 `propsSchema` 필드 추가 ADR/schema 변경, 또는 (b) reusable 노드의 1급 schema 필드(`CanonicalNode.propsSchema`) 신설 중 택일이 선행 과제다. **`metadata.propsSchema` 안은 prohibition 위반이므로 폐기** — 이 prohibition 을 완화하려면 별도 ADR 이 선행돼야 하며, 본 설계는 extension/1급필드 경로를 권장한다.

### 6-4. origin 변경 전파 (override 안 한 속성이 모든 ref 로)

resolver(`resolveCanonicalDocument`)가 ref 를 펼칠 때:

```
ResolvedRef = mergeDeep(reusableBaseSubtree, RefNode.props)   // root props override
then for each path in RefNode.descendants:
    apply 3-mode override at path                              // nested override
```

→ instance 가 override **하지 않은** prop 은 항상 reusable base 에서 온다. origin 의 `variant` 를 바꾸면 root override 안 한 모든 ref 가 즉시 새 variant 로 resolve(다음 derive cycle). 이는 데이터 구조 자체의 성질이라 별도 전파 코드가 필요 없다 — resolver 가 매번 base 를 다시 읽으므로.

> **과도기 주의**: 위 resolve 모델은 **canonical-direct 목표 상태** 기준이다. 현재는 nested override 가 mirror(`COMPONENT_OVERRIDES_MIRROR_FIELD`) 경유라(§6-1), resolver 가 mirror → descendants 변환을 거친다. cross-check: §6-2 InstancePropertyEditor 는 `RefNode.props` 만 표시하므로 override 안 한 prop 은 빈칸/placeholder 로 보이고 base 값은 resolver 가 채움 — Panel 표시와 실제 resolve 값 분리. 이 placeholder 표시 정책은 검증 필요.

---

## 7. derivedUpdateFn — 한 prop 변경이 복수 prop 갱신을 generic 이 흡수

legacy spec 의 `derivedUpdateFn`(19건, types.ts:118 주석)은 "한 필드 변경 시 다른 필드 동시 갱신"(예: `variant` 변경 시 `size` 보정, `min` 변경 시 `value` clamp). generic Inspector 는 컴포넌트당 함수를 둘 수 없으므로 **선언적 derive table** 로 흡수한다.

```ts
// packages/shared/src/catalog/resolvers/deriveProps.ts
/**
 * 한 prop 변경 → 복수 prop patch. 컴포넌트당 derivedUpdateFn(임의 함수) 대신
 * **순수 declarative rule**. generic Inspector 가 commit 직전 적용.
 *
 * 제약: 순수 함수 (현재 patch + 현재 props → 추가 patch). side-effect 금지.
 * 19 legacy derivedUpdateFn 중 순수 변환만 흡수 — 비순수는 검증 후 재설계 (검증 필요).
 */
export interface DeriveRule {
  /** 이 prop 이 바뀌면 트리거. */
  when: string;
  /** (changedValue, allProps) → 동반 patch. */
  derive(value: unknown, props: Record<string, unknown>): Record<string, unknown>;
}

/** 컴포넌트 type → derive rule 집합. binding.props 에 인라인 선언도 가능. */
export const DERIVE_RULES: Record<string, DeriveRule[]> = {
  NumberField: [
    {
      when: "min",
      derive: (min, props) => {
        const value = props.value;
        if (typeof value === "number" && typeof min === "number" && value < min) {
          return { value: min }; // value clamp
        }
        return {};
      },
    },
    {
      when: "max",
      derive: (max, props) => {
        const value = props.value;
        if (typeof value === "number" && typeof max === "number" && value > max) {
          return { value: max };
        }
        return {};
      },
    },
  ],
  Slider: [/* min/max clamp 동형 */],
};

/** generic Inspector commit 직전: 사용자 patch + derive patch 병합. */
export function applyDerives(
  componentType: string,
  patch: Record<string, unknown>,
  currentProps: Record<string, unknown>,
): Record<string, unknown> {
  const rules = DERIVE_RULES[componentType];
  if (!rules) return patch;

  let merged = { ...patch };
  const next = { ...currentProps, ...patch };
  for (const [key, value] of Object.entries(patch)) {
    for (const rule of rules) {
      if (rule.when === key) {
        merged = { ...merged, ...rule.derive(value, next) };
      }
    }
  }
  return merged;
}
```

`CatalogInspectorFields.onUpdate` 가 mutation 호출 전 `applyDerives(type, patch, currentProps)` 를 한 번 통과 → 컴포넌트당 함수 없이 derive 흡수. 순수 변환이 아닌 derive(예: 외부 데이터 fetch)는 generic 흡수 불가 — 그런 케이스는 19건 inventory 전수 후 재설계(검증 필요, open question).

---

## 8. Style Panel(D3) — 보편 속성 + token 참조 + shorthand→longhand 계승

### 8-1. 보편 속성도 PropContract 로 통합 (목표)

Pencil 원리상 `x/y/width/height/fill/stroke/cornerRadius/padding/gap/layout` 은 모든 노드 공통이므로 **컴포넌트당이 아니라 노드 type-class 당** 계약이다. 두 계약 집합으로 충분:

```ts
// packages/shared/src/catalog/styleContracts.ts
import type { PropContract } from "./types";

/** 모든 노드 공통 — transform/geometry. (Pencil 보편 속성) */
export const UNIVERSAL_GEOMETRY_CONTRACTS: Record<string, PropContract> = {
  x:            { kind: "number", label: "X",      section: "transform" },
  y:            { kind: "number", label: "Y",      section: "transform" },
  width:        { kind: "string", label: "Width",  section: "transform" }, // "fill"/"hug"/number
  height:       { kind: "string", label: "Height", section: "transform" },
  rotation:     { kind: "number", label: "Rotate", section: "transform", min: -360, max: 360 },
  fill:         { kind: "string", label: "Fill",   section: "appearance" }, // token ref "$--accent" 또는 값
  stroke:       { kind: "string", label: "Stroke", section: "appearance" },
  cornerRadius: { kind: "number", label: "Radius", section: "appearance", min: 0 },
};

/** layout 가능 노드(frame/auto-layout)만 — flex 계약. */
export const LAYOUT_CONTRACTS: Record<string, PropContract> = {
  layout:         { kind: "enum",   label: "Layout", section: "layout",
                    options: [{ value: "vertical", label: "Vertical" },
                              { value: "horizontal", label: "Horizontal" },
                              { value: "none", label: "None" }] },
  gap:            { kind: "number", label: "Gap",     section: "layout", min: 0 },
  padding:        { kind: "number", label: "Padding", section: "layout", min: 0 },
  alignItems:     { kind: "enum",   label: "Align",   section: "layout", options: [/* start/center/end/stretch */] },
  justifyContent: { kind: "enum",   label: "Justify", section: "layout", options: [/* ... */] },
};
```

이렇게 하면 Style Panel 도 `buildInspectorFields(type, mergedStyleContracts, theme)` 로 generic 화 가능 — 현행 `styles/sections/*.tsx`(LayoutSection/AppearanceSection/...)의 수동 섹션을 동일 generic renderer 로 수렴. **단 이는 ADR-142 현행 코드에 아직 없는 확장** (open question): 현재 Style Panel 은 여전히 수동 섹션 + `element.props.style` 경로를 쓴다. 본 설계는 목표 방향만 제시하고, D3 generic 화는 별도 작업.

### 8-2. shorthand → longhand 분배 정책 계승 (필수)

`.claude/rules/style-ssot.md` + `inspectorActions.ts:75 distributeShorthand`(경로: `apps/builder/src/builder/stores/inspectorActions.ts`, utils/ 하위 아님 — 검증자 지적 ③ 반영)를 **그대로 계승**. store 는 longhand 만 저장:

```
gap     → rowGap, columnGap
padding → paddingTop, paddingRight, paddingBottom, paddingLeft
margin  → marginTop, marginRight, marginBottom, marginLeft
```

generic Style 편집 commit 도 같은 `updateSelectedStyle`(`apps/builder/src/builder/stores/inspectorActions.ts:668`)을 거쳐 `distributeShorthand` 를 통과. **Why**: React inline shorthand+longhand 공존 시 rerender 경고 + Taffy `applyCommonTaffyStyle` 순서 경합(layout-engine.md). Pencil canonical 은 `padding` 을 단일 값/배열로 갖지만, composition store 직렬화 경계에서 longhand 로 분배 — Pencil 포맷 read-through 시 adapter 가 분해(검증 필요: Pencil→canonical 경계의 padding 분배 위치).

### 8-3. token 참조 vs 직접값

fill/stroke 편집은 두 입력 모드:
- **token 참조**: `"$--accent"` (Pencil format) 또는 `{ $var: "primary" }`(canonical `CanonicalTokenRef`). resolver 가 `resolveCanonicalToken(ref, doc)`(composition-document.types.ts:93)로 실값 + dark mode 반전 처리.
- **직접값**: `"#f5f5f5"`.

```ts
// fill PropContract 의 control 은 token picker + raw color 두 모드.
// 저장: token 모드 → "$--accent" 문자열, raw 모드 → "#hex".
// kind:"string" 이지만 control 이 PropertyColor (token-aware) 로 분기 — §9 control map.
```

### 8-4. PropertyUnitInput commit 정책 계승 (필수)

`PropertyUnitInput.tsx:116` 의 `lastSavedValueRef` 단독 기준 commit + focus 중 effect skip 을 **그대로 유지**. **Why**(style-ssot.md): preview 경로가 `elementsMap` 을 mutate 하면서 value prop 이 편집값으로 미리 바뀌어도 commit 이 skip 되지 않게. 이 정책은 generic 화와 직교 — generic renderer 가 `PropertyUnitInput` 을 쓰는 한 자동 계승. (commit 경로 `updateSelectedStyle` 도 `apps/builder/src/builder/stores/inspectorActions.ts` 직속 — 검증자 지적 ③ 반영.)

```ts
// 계승 불변식 (PropertyUnitInput.tsx:122-138 + handleInputBlur):
// 1. commit 조건: newValue !== lastSavedValueRef.current (value prop diff 금지)
// 2. effect reset: document.activeElement === inputElementRef.current 면 skip
// 3. 요소 전환 감지: focusedElementIdRef !== currentSelectedId 면 blur commit skip
```

---

## 9. kind → control primitive 매핑 (generic field renderer 본체)

`CatalogInspectorFields` 의 `CatalogField` 가 이미 9 kind 를 매핑한다. 정합 확인 + token-aware 확장:

| `InspectorFieldKind` | control primitive | 출력 변환 |
| --- | --- | --- |
| `string` | `PropertyInput` | `"" → undefined` |
| `string-array` | `PropertyInput`(comma split) | `split(",").trim().filter` |
| `number` | `PropertyNumberInput` (또는 `PropertyUnitInput` for px) | numeric |
| `boolean` | `PropertySwitch` | bool |
| `enum` | `PropertySelect` (contract.options) | string |
| `variant` | `PropertySelect` (**theme.options**) | string → `data-variant` (toRacProps) |
| `size` | `PropertySizeToggle` (**theme.options**) | string → `data-size` |
| `fillStyle` | `PropertySelect` (고정 options) | string → `data-fill-style` |
| `icon` | `PropertyIconPicker` | name string |
| `binding` | (collections family) `PropertyBindingPicker` | datatableId/dataBinding |

**token-aware 확장**(D3): `fill`/`stroke` 같은 색 PropContract 는 `kind:"string"` 이지만 control 을 `PropertyColor`(token picker + hex)로 분기. PropContract 에 `control?: "color" | "unit"` 힌트 추가 또는 key 기반 매핑(`fill`/`stroke`/`color` → PropertyColor)으로 흡수:

```ts
// CatalogField switch 확장 (token-aware control 분기)
function resolveControl(field: InspectorField): ControlKind {
  if (field.kind === "string" && COLOR_KEYS.has(field.key)) return "color"; // fill/stroke
  if (field.kind === "number" && UNIT_KEYS.has(field.key)) return "unit";   // width/padding px
  return field.kind;
}
const COLOR_KEYS = new Set(["fill", "stroke", "color", "background"]);
const UNIT_KEYS  = new Set(["width", "height", "padding", "gap", "x", "y"]);
```

---

## 10. 시나리오 1 — leaf Button `size="md"→"sm"` 편집 (현 수렴도 정직 진술)

```
1. 사용자가 Properties Panel 에서 Button 선택.
   → resolveEditContract(buttonNode, doc) = { contracts: buttonBinding.props.accepts, source:"primitive" }
   → buildInspectorFields("Button", accepts, componentRuleTheme(doc))
     = [{content:[children]}, {appearance:[variant,size,fillStyle]}, {state:[type,isPending,isDisabled]}]
   → size 필드 options = theme.resolveDimensionOptions("Button","size","size")
     = Object.keys(resolveComponentRule("Button",doc).sizes) = [xs,sm,md,lg,xl]
   → PropertySizeToggle 렌더, 현재값 "md".

2. 사용자가 "sm" 선택 → CatalogField.onUpdate({ size: "sm" })
   → applyDerives("Button", {size:"sm"}, currentProps) = {size:"sm"} (Button derive 없음)
   → onUpdate({size:"sm"}) → updateSelectedProperty("size","sm")

3. updateSelectedProperty (apps/builder/src/builder/stores/inspectorActions.ts:890):
   → updateAndSave(buttonNode.id, sanitizeInspectorProps({size:"sm"}))
   → mergeXxxIntoCanonicalDocument: node.props.size = "sm" (canonical 1차)
   → set({elements}) → _rebuildIndexes (canonical 기반) → persist (IndexedDB bg)

4. 4 consumer 반영 (다음 derive cycle) — ※ size→fontSize 는 현재 단일 read 미수렴 (§1.1):
   ① DOM(CanonicalNodeRenderer.tsx:243-245): data-size="sm" → generated CSS
      [data-size="sm"]{font-size:14px}.  resolveComponentRule 미경유.
   ② Skia(buildSpecNodeData.ts:847): const sizeSpec = spec.sizes["sm"] → fontSize 14.
      legacy spec.sizes 경로. resolveComponentRule().sizes 미경유.
   ③ Publish: 동일 resolveCanonicalDocument → DOM (data-size="sm") → 동일 generated CSS.
   ④ Panel: currentProps 재구독 → size 토글 "sm" 표시.
   → 네 곳 모두 fontSize 14. 단 이는 "DOM CSS / Skia spec.sizes 가 같은 build-time
     COMPONENT_RULES_TABLE 파생이라 값이 우연히 일치" 이며, resolveComponentRule().sizes
     단일 read 로의 수렴은 §1.1 별도 배선 전까지 미실현 (검증 필요).
     (참고: 색상(variant) 차원은 resolveComponentRule 경유 수렴됐으나, resolveSkiaVisualRule
      의 doc 미전달로 doc.componentRules 문서 override 는 Skia 미반영 — §1.1.)
```

---

## 11. 시나리오 2 — instance(ref) root override + nested override (현 mirror 과도기 명시)

```
reusable "card-origin" (x-composition.propsSchema:{title,variant}), children:[text#title, frame#body(slot)]
instance refNode = { type:"ref", ref:"card-origin", props:{}, descendants:{} }

A) root props override — instance 의 variant 만 변경:
   1. Panel: resolveEditContract(refNode, doc) = { contracts: readPropsSchema(cardOrigin),
        source:"instance", refId:"card-origin" }
      (readPropsSchema 는 x-composition.propsSchema 읽음 — metadata 아님, §6-3)
      → InstancePropertyEditor → CatalogInspectorFields(contracts={title,variant})
   2. variant "default"→"destructive" 선택 → onUpdateRootProps({variant:"destructive"})
   3. commit:
      - 목표(canonical-direct): RefNode.props.variant = "destructive"
      - 현 과도기: instance 가 mirror element 면 updateSelectedProperty 의
        isComponentInstanceMirrorElement 분기로 COMPONENT_OVERRIDES_MIRROR_FIELD 경유.
        ※ root props override + propsSchema 조회 자체는 현재 미구현 (검증 필요, 본 설계가 채움).
   4. resolve: mergeDeep(cardOriginSubtree, refNode.props) → variant override 적용.
      origin 의 다른 prop(title 등)은 override 안 했으므로 base 유지.

B) nested override — instance 내부 title text 만 변경 (자식 선택):
   1. 트리에서 instance 의 자식 text#title 선택 (synthetic id "refNodeId/title").
   2. 편집 commit → updateSelectedPropertiesWithChildren
      (apps/builder/src/builder/stores/inspectorActions.ts:904)
      → isInspectorInstanceElement(refNode)=true
         (mirror element OR canonical ref 둘 다 수용 — line 224-226 과도기)
      → buildInstanceDescendantPatches (line 240):
         - current = getComponentDescendantsMirror(element) (line 246, mirror 읽기)
         - getSyntheticDescendantPath("refNodeId","refNodeId/title")="title"
         - next["title"] = mergePropsWithStyleDeep(prev, {content:"Custom"})  [3-mode A 속성 patch]
      ※ 정정: 이 write 는 canonical RefNode.descendants 직접이 아니라
        COMPONENT_OVERRIDES_MIRROR_FIELD(legacy mirror) 경유. RefNode.descendants
        직접 write 로의 전환은 ADR-122 잔존 mirror 해체 후속 (목표 상태).
   3. commit → mirror payload (목표: RefNode.descendants["title"] = {content:"Custom"}).
   4. resolve: base subtree 펼친 뒤 path "title" 에 patch 적용 (현재 mirror→descendants 변환 경유).

C) origin 변경 전파:
   origin 의 text#title fontSize 변경 → refNode 들이 path "title" override 안 했으면
   모두 새 fontSize 로 resolve (resolver 가 매번 base 재읽기). 전파 코드 0.
```

---

## 12. 컴포넌트당 분기 제거 결산 (before → after)

| 영역 | before (컴포넌트당) | after (generic 단일) |
| --- | --- | --- |
| 편집 계약 | `spec.properties.sections` 124벌 | `resolveEditContract` 1개 → `accepts`/`propsSchema` |
| 필드 그룹 | `SectionDef[]` 수작업 | `PropContract.section` 태그 자동 집계 |
| variant/size 값 | 컴포넌트 enum | `ComponentRule` keys (theme) — 색상 수렴됨, size read 경로 §1.1 |
| 필드 렌더 | `SpecField` + `*Editor.tsx` 30+ | `CatalogInspectorFields` 1개 |
| instance 편집 | mirror metadata 분기 | 같은 `CatalogInspectorFields`(contracts=propsSchema), commit 은 과도기 mirror→목표 RefNode |
| derived 갱신 | `derivedUpdateFn` 19 임의 함수 | `DERIVE_RULES` declarative table |
| Style(D3) | `styles/sections/*` 수동 | `UNIVERSAL_GEOMETRY_CONTRACTS`+generic (목표) |
| commit/longhand | (공통) | `distributeShorthand` + `lastSavedValueRef` 계승 |

남는 컴포넌트당 코드는 **데이터**(reusable propsSchema 선언, ComponentRule 테이블)뿐 — 코드 분기 0. ADR-142 end-state("컴포넌트당 정의 파일 폐기")와 수렴.

> **수렴 잔여(정직 진술)**: (a) size→fontSize 단일 read 수렴(§1.1), (b) propsSchema schema 필드 확장(§6-3), (c) instance root override 구현 + mirror→canonical-direct 전환(§6, ADR-122 후속), (d) Style Panel D3 generic 화(§8-1) 는 **목표 상태이며 현 코드 미실현**. 색상(variant/fill) 수렴 + leaf generic Inspector(buildInspectorFields/CatalogInspectorFields) 는 실재한다.

---

<a id="영역-6"></a>

## ⑥ Publishing / Preview 데이터 흐름 — RAC runtime + Pencil canonical resolve 1차 원리 재유도 (정정판)

> **정정 요지**: 적대적 검증자의 6개 지적을 코드베이스 실측으로 전수 확인한 결과 **6건 모두 정당**했다. 핵심 오류는 (1) 존재하지 않는 `@composition/resolvers` 패키지를 import 가능한 것처럼 전제, (2) canonical schema 에 없는 `doc.collections` / `c.source` 필드 참조, (3) `TokensSnapshot` 이 Pencil 다축 배열을 보존한다는 잘못된 가정, (4) D3 시각 SSOT 를 legacy `CSSGenerator(spec→CSS)` 로 서술(ADR-142 end-state 는 `componentRules` 테이블), (5) `collectRuntimeElements` 가 descendants 3-mode 를 잃는다는 부정확한 함의, (6) SSR import 그래프 위험을 open question 으로 격하. 아래는 이 6건을 반영해 재유도한 완결 설계다. 실측 근거를 각 정정 지점에 인용한다.

---

### 0. 출발점 재설정 + 미선언 prerequisite 노출 (정정 1·6)

composition 내부 누적 부채(`*.spec.ts` 소비, `deriveProjectRenderModelFromDocument` 의 flat `Element[]` 파생, `generateStaticHtml` 안 vanilla resolve 재구현)를 출발점으로 삼지 않는다. 두 외부 검증 자산의 본연 구조에서 다시 시작한다.

**Pencil canonical document 의 1차 원리** (실측 `docs/migrations/shadcn-design-system.json`): 문서는 11종 primitive 노드와 보편 속성 집합만으로 87 컴포넌트를 표현한다. 컴포넌트화는 데이터 메커니즘이다 — `reusable:true frame`(origin), `{type:"ref", ref}`(instance), `descendants[path]`(override 3-mode), `slot[]`(채울 자리). 따라서 "렌더 가능한 상태"란 **ref/descendants/slot 이 전부 해소된 평탄한 노드 트리**다. 이 해소(resolve)를 한 곳에서만 수행하는 것이 SSOT 의 1차 조건이다.

**RAC 의 1차 원리** (실측 `packages/react-aria-starter/src`): RAC primitive 는 unstyled — D1(접근성/키보드/포커스/선택)을 runtime 으로 실행하고, D3(시각)은 전부 CSS 토큰(`var(--radius)`, `data-variant`)으로 분리된다. Collection 은 `items` 배열 + 렌더 함수 → 내부 Node tree, `Virtualizer`/`ListLayout`/`TableLayout` 으로 viewport culling.

이 둘을 합치면 Publishing/Preview 의 본질이 도출된다: **canonical 문서를 resolve 하여 평탄 트리를 만들고, 각 노드를 RAC primitive 에 mount 하여 D1 을 RAC 가 실행하게 하고, D3 는 theme CSS 토큰이 입힌다.** Skia(빌더 화면)는 동일 resolved 트리를 Canvas geometry 로 그린다.

#### 0.1 미선언 prerequisite — Phase 0: render core 의 `@composition/render` 패키지 추출 (정정 1·6)

**원설계의 치명적 전제 오류**: §2.4/§3.2/§7 이 `import { resolveCanonicalDocument } from "@composition/resolvers"` 및 "Publish 도 같은 함수/렌더러 재사용"을 마치 이미 가능한 것처럼 서술했으나, **실측 결과 이는 현 package boundary 에서 불가능**하다.

실측 (검증 완료):

| 자산 | 실제 위치 | boundary |
| --- | --- | --- |
| `resolveCanonicalDocument` | `apps/builder/src/resolvers/canonical/index.ts:58` | **apps/builder 내부** |
| `getSharedResolverCache` | `apps/builder/src/resolvers/canonical/cache.ts:234` | apps/builder 내부 |
| `getSharedImportRegistry` / `ImportResolverContext` | `apps/builder/src/resolvers/canonical/importRegistry.ts:314` | apps/builder 내부 |
| `CanonicalNodeRenderer` | `apps/builder/src/preview/components/CanonicalNodeRenderer.tsx` | apps/builder 내부 |
| `storeBridge` (extractCanonicalPropsFromResolved 등) | `apps/builder/src/resolvers/canonical/storeBridge.ts` | apps/builder 내부 |
| `frameMirror` (getFrameElementMirrorId 등) | `apps/builder/src/adapters/canonical/frameMirror` | apps/builder 내부 |

- workspace 패키지는 실측 **5개**: `composition-layout / config / react-aria-starter(설치 그래프 제외) / shared / specs`. `@composition/resolvers` 는 **존재하지 않는다**.
- `apps/publish/package.json` 은 `@composition/shared` 에만 의존하고 **apps/builder 를 import 하지 않는다** (grep 0건 — CSS 주석 1건 제외). 따라서 publish 가 builder 내부의 resolve 함수/렌더러를 import 하는 것은 **현 boundary 에서 컴파일 불가**.
- `CanonicalNodeRenderer` 는 `../../resolvers/canonical/storeBridge` 와 `../../adapters/canonical/frameMirror`(둘 다 apps/builder 내부)를 import 한다 (실측 import 53·56-59행).

**따라서 "같은 resolve 함수/렌더러 재사용"은 import 경로상 자동으로 성립하지 않으며, 이를 가능케 하려면 boundary 이동이 미선언 prerequisite 다.** 이를 **Phase 0** 으로 명시 박제한다:

> **Phase 0 (선행 필수)**: `resolveCanonicalDocument` + `cache(getSharedResolverCache)` + `importRegistry(getSharedImportRegistry / ImportResolverContext)` + `storeBridge` 의 순수 부분 + `CanonicalNodeRenderer` 의 **순수 DOM 렌더 코어**를 `@composition/render` 신규 패키지(또는 `packages/shared/src/render/*`)로 추출한다. 이때 apps/builder 내부 의존(`storeBridge` 의 store read, `frameMirror` 의 builder-specific mirror)을 **props 주입형 adapter 로 외부화**한다 — render core 는 builder store 를 모르고, builder/publish 가 각자 adapter 를 주입한다.

Phase 0 의 boundary 정리는 **선택이 아니라 §2.4/§3.2 전체의 컴파일 전제**다. 이것 없이는 이후 모든 "재사용" 서술이 무효다.

#### 0.2 import 그래프 정적 검사 gate — open question → Risk HIGH 승격 (정정 6)

원설계는 "CanonicalNodeRenderer 가 Skia/CanvasKit WASM 을 transitive import 하지 않는지 검증 필요"를 단순 open question 으로 표기했다. 실측 결과 이는 **HIGH 위험**이다:

- `CanonicalNodeRenderer` 는 `@composition/shared/components/*` 20여 개(Table/Tree/Calendar/DatePicker/Select 등)와 builder 내부 `storeBridge`·`frameMirror` 를 import 한다 (실측 import 21-59행).
- `renderToString`(SSR)은 Node 환경이다 — 이들 의존 중 하나라도 module top-level 에서 CanvasKit WASM 초기화나 builder store 접근을 실행하면 **SSG 빌드 자체가 깨진다** (`canvaskit-large-width` / `wasm-init` 메모리 패턴: `await mod.default()` 누락 시 TypeError).
- 부분 완화 근거(실측): `packages/shared/src/components/Table.tsx` 는 직접적 `canvaskit`/`skia` import 0건 — shared component 본체는 DOM-pure 일 가능성. 위험은 `storeBridge`/`frameMirror`(builder 내부) 경유에 집중. 이것이 Phase 0 의 "render core 와 builder adapter 분리"가 위험을 직접 겨냥하는 이유다.

→ **Risk R1 (HIGH)** 로 승격하고, Phase 0 에서 render core 분리 + SSR 진입 전 **import 그래프 정적 검사 gate** 를 §7 에 추가한다. 현재 madge/dependency-cruiser 가 프로젝트에 미설치(실측 grep 0건)이므로, 본 gate 는 둘 중 하나의 **신규 도입을 포함**한다. gate 조건: `@composition/render` 진입점에서 `canvaskit` · `apps/builder/**/canvas/skia/**` · builder store 심볼 **0건**.

---

### 1. 전체 데이터 흐름 다이어그램 (Phase 0 추출 후 기준)

```
                          ┌─────────────────────────────────────────────┐
                          │   CompositionDocument  (단일 SSOT, ADR-116)  │
                          │   children[] · imports · themes · tokens     │
                          │   componentRules? · _meta                    │
                          │   reusable origin / ref instance /           │
                          │   descendants[path] / slot[]                 │
                          └───────────────────┬─────────────────────────┘
                                              │
       ┌──────────────────────────────────────┼──────────────────────────────┐
       │  @composition/render (Phase 0 추출)   │  store CollectionsMap snapshot │
       │  resolveCanonicalDocument(doc,cache,  │  (canonical schema 외부 주입)  │
       │    imports) → ResolvedNode[]          │  §5: 데이터 source 별도 경로    │
       └──────────────────────────────────────┘                              │
                  │                            │                              │
        ┌─────────┼────────────────────────────┼──────────────────────┐      │
        ▼         ▼                            ▼                       ▼      ▼
 ┌────────────┐ ┌─────────────────┐   ┌─────────────────┐   ┌──────────────────┐
 │ BUILDER    │ │ PREVIEW iframe  │   │ PUBLISH 배포     │   │ Style/Props Panel │
 │ Skia geom. │ │ DOM+RAC+theme   │   │ DOM+RAC+theme    │   │ componentRules    │
 │ Culling/   │ │ +data-canon-id  │   │ (마커 없음, SSG) │   │ size/variant read │
 │ Virtual.   │ │ builder adapter │   │ publish adapter  │   │                   │
 └────────────┘ └─────────────────┘   └──────────────────┘   └──────────────────┘
   D3 direct      D3 direct              D3 indirect            D3 read
   componentRules componentRules→CSS     componentRules→CSS     componentRules
   →Skia metric   (build-time gen)       (build-time gen)       직접 read
```

핵심 불변식: **세 렌더 consumer + Panel 이 같은 `resolveCanonicalDocument`(Phase 0 추출본) 출력 `ResolvedNode[]` 과 같은 `componentRules` 테이블에서 출발**한다. 이 등식이 깨지는 경로(`generateStaticHtml` inline resolve, `deriveProjectRenderModelFromDocument` flat 파생의 렌더 source 형식 불일치)가 SSOT 위반이며 본 설계의 정정 대상이다.

---

### 2. resolve → render 파이프라인 (정본)

#### 2.1 resolve 계약 — 단일 진입점

resolve 실행 순서는 ADR-903 Hard Constraint #3 으로 박제되어 있고 실제 구현(`apps/builder/src/resolvers/canonical/index.ts:58`, Phase 0 후 `@composition/render`)이 이를 따른다:

```
ref resolve → descendants apply → slot contract validate → resolved tree
```

```typescript
// @composition/render/types.ts (Phase 0 추출 — 실측 시그니처 정합)
export type ResolveFn = (
  doc: CompositionDocument,
  cache?: ResolverCache,          // Preview/Skia/Publish 공유 singleton
  imports?: ImportResolverContext, // <importKey>:<nodeId> 외부 문서 동기 조회
) => ResolvedNode[];

export interface ResolvedNode extends CanonicalNode {
  _resolvedFrom?: string;   // origin reusable id (UI 마커/cache 키 추적)
  _overrides?: string[];    // override 된 필드 경로 (Properties 패널 dot 마커)
  children?: ResolvedNode[];
}
```

이 출력은 모든 ref 가 master 로 펼쳐지고, descendants 3-mode 가 적용되고, slot 이 채워진 **평탄 트리**다. broken ref 는 `console.warn` 1회 후 **원본 ref 노드를 그대로 통과**(현행 `_resolveRefNodeUncached` line 133-139)시켜 빈 화면 대신 최소 노드를 유지한다 — fallback 사고가 아니라 데이터 결손의 정직한 표현이다.

#### 2.2 공유 cache — 대칭의 물리적 근거

`selectResolvedTree`(storeBridge.ts:93)는 기본값으로 `getSharedResolverCache()` singleton(cache.ts:234)을 주입한다. Phase 0 추출 후, 같은 singleton 을 세 consumer 가 공유하므로 한 ref instance 가 Preview 에서 resolve 되어 cache 에 들어가면 Skia 가 동일 subtree 를 hit 한다. invalidation 단위는 ref root subtree(`invalidateSubtree(rootRefId)`). cache 키 4-tuple:

```typescript
type ResolverCacheKey = readonly [
  docVersion: string,             // doc.version (+ imports fingerprint)
  rootRefId: string,
  descendantsFingerprint: string, // computeDescendantsFingerprint(ref.descendants)
  slotBindingFingerprint: string, // computeSlotBindingFingerprint(slot children)
];
```

성능 계약(`RESOLVER_PERFORMANCE_CONTRACT`): 1000-node tree cold P50 5ms / hot P50 0.5ms. resolve 가 frame budget(16.6ms)의 3% 미만이어야 List/Table 의 Skia culling 이 의미를 가진다.

#### 2.3 Preview 렌더 — RAC primitive mount

`CanonicalNodeRenderer`(Phase 0 후 render core)가 `ResolvedNode` 를 받아 DOM 으로 렌더한다. ADR-142 cutover primitive 는 per-component `rendererMap` 대신 generic 경로를 탄다:

```typescript
function renderResolvedNode(
  node: ResolvedNode,
  ctx: RenderContext,
  cutoverPrimitives: ReadonlySet<string>,
): React.ReactElement | null {
  const type = resolveNodeTag(node); // _tag → metadata.originalTag → node.type

  // ── ADR-142 catalog generic 경로 (cutover 된 primitive) ──────────────
  if (cutoverPrimitives.has(type)) {
    const binding = getPrimitiveBinding(type);
    if (binding) {
      const Primitive: React.ElementType | undefined =
        binding.source.kind === "rac"
          ? (RAC as Record<string, React.ElementType | undefined>)[binding.source.component]
          : INTERNAL_RENDERERS[binding.source.renderer];
      if (Primitive) {
        const { children: racChildren, ...racRest } = toRacProps(node, binding);
        const childNodes = node.children ?? [];
        return (
          <Primitive
            key={node.id}
            data-canonical-id={ctx.emitEditMarkers ? node.id : undefined} // Preview만
            {...racRest}
          >
            {childNodes.length > 0
              ? childNodes.map((c) => renderResolvedNode(c, ctx, cutoverPrimitives))
              : (racChildren as React.ReactNode)}
          </Primitive>
        );
      }
    }
  }
  // ── legacy rendererMap fallback (미-cutover, 회귀 0) ────────────────
  // ...
}
```

`toRacProps`(실측 `packages/shared/src/catalog/outputs/toRacProps.ts`)의 핵심 규칙:
- `binding.props.accepts` 선언 prop 만 투영, 미선언 drop.
- `variant`/`size`/`fillStyle`(visual-enum kind) → RAC props 가 아니라 `data-{kebab(key)}` 속성으로 라우팅. 예: `fillStyle` → `data-fill-style`. RAC 가 unstyled 이므로 theme/component CSS 의 `[data-variant]` 셀렉터가 시각을 입힌다.
- variant/size 는 default 있으면 항상 emit — 셀렉터 매칭 보장.

#### 2.4 Publish 렌더 — flat 파생 경로의 정밀한 divergence 진단 (정정 1·5)

**원설계의 부정확한 함의 정정**: 원설계 §2.4 는 Publish flat-Element 경로가 "ref/descendants/slot 의 일부만 derive 단계에서 푼다"고 서술했으나, **실측 결과 이는 부정확**하다.

`deriveProjectRenderModelFromDocument`(export.utils.ts:694) → `collectRuntimeElements`(:469) → `applyDescendantOverride`(:444) 는 **descendants 3-mode 를 전부 적용**한다 (실측 확인):

```typescript
// export.utils.ts:444 — 3-mode 전부 처리 (실측)
function applyDescendantOverride(node, override) {
  if (!override) return node;
  const type = override.type;
  if (typeof type === "string" && type.length > 0) {        // mode 1: 노드 교체
    return isCanonicalNode(override) ? override : node;
  }
  const children = override.children;
  const props = mergePropsWithStyleDeep(node.props ?? {},   // mode 3: prop patch
                  getDescendantPatchProps(override));
  return { ...node, props,
    ...(Array.isArray(children)                              // mode 2: children 교체
      ? { children: children.filter(isCanonicalNode) } : {}) };
}
```

따라서 이 경로의 실제 divergence 는 "3-mode 손실"이 **아니라**, **`ResolvedNode` 트리가 아닌 평탄 `Element[]` 로 flatten 하여 렌더 source 형식이 Preview 와 다르다**는 점이다. Publish 앱은 이 `Element[]` 를 별도 `PageRenderer`/`ElementRenderer` 로 소비한다 — 같은 데이터를 다른 코드 경로로 그리므로 시각 drift 표면이 존재한다.

→ **정정된 통합 목표**: 두 flat 경로(`deriveProjectRenderModelFromDocument` 파생 / `generateStaticHtml` inline script)를 **동일 `resolveCanonicalDocument`(Phase 0 render core) + 동일 `CanonicalNodeRenderer`** 로 수렴시킨다. flat `Element[]` 형식을 렌더 source 에서 제거하고 `ResolvedNode[]` 트리로 통일한다.

```typescript
// apps/publish/src/renderer/CanonicalPageRenderer.tsx
// — Phase 0 추출 후 @composition/render 를 import (현재 import 불가, Phase 0 prerequisite)
import {
  resolveCanonicalDocument,
  getSharedResolverCache,
  getSharedImportRegistry,
  CanonicalNodeRenderer,
} from "@composition/render"; // ← Phase 0 완료 후에만 유효

export function CanonicalPageRenderer({
  doc, pageId, mode,
}: { doc: CompositionDocument; pageId: string; mode: RenderMode }) {
  const cache = getSharedResolverCache();
  const imports = getSharedImportRegistry();
  const resolved = useMemo(
    () => resolveCanonicalDocument(doc, cache, imports),
    [doc, cache, imports],
  );
  const pageRoot = useMemo(() => findPageRoot(resolved, pageId), [resolved, pageId]);
  if (!pageRoot) return null;

  const ctx = useRenderContext(mode); // emitEditMarkers, builder/publish adapter 주입
  return (
    <>
      {(pageRoot.children ?? []).map((child) => (
        <CanonicalNodeRenderer
          key={child.id}
          node={child}
          renderContext={ctx}
          cutoverPrimitives={CUTOVER_PRIMITIVES}
        />
      ))}
    </>
  );
}
```

Preview/Publish 차이는 `mode` 한 플래그로 좁힌다:

| 축 | Preview (`mode:"preview"`) | Publish (`mode:"publish"`) |
| --- | --- | --- |
| 편집 마커 | `data-canonical-id` emit | emit 안 함 |
| hydration | iframe 즉시 mount, postMessage store sync | SSG HTML + 클라이언트 hydrate |
| 라우팅 | builder canvas 가상 라우터 | 실 URL 라우팅 |
| 데이터 | builder store collections 미러(§5) | 정적 snapshot 또는 런타임 API(§5) |
| 이벤트 | 편집용 no-op / 미리보기 | events/actions root collection 실행 |
| **adapter** | **builder adapter 주입(storeBridge/frameMirror)** | **publish adapter 주입(builder 의존 0)** |

마지막 행이 Phase 0 의 핵심 산출이다: render core 는 builder store 를 모르고, builder/publish 가 각자 adapter 를 `renderContext` 로 주입한다.

---

### 3. 정적 publishing 산출물 생성 경로 (정정 5)

#### 3.1 문제 — `generateStaticHtml` 의 vanilla resolve 가 유일한 broken 경로

원설계는 broken 경로를 §2.4(Publish flat)와 §3(inline script)에 걸쳐 약간 뭉뚱그렸다. **정밀화**: §2.4 의 `collectRuntimeElements` 는 3-mode 를 처리하므로 broken 이 아니다(형식만 다름). descendants/slot 을 **실제로 전부 잃는** broken 경로는 `generateStaticHtml`(export.utils.ts:982)의 inline `resolveNode`(line 1100) **하나뿐**이다:

```javascript
// export.utils.ts:1100 — HTML 문자열 안 embedded <script> (실측: broken)
function resolveNode(node) {
  if (!node.ref) return node;
  const master = findNodeById(compositionDocument.children || [], node.ref);
  if (!master) return node;
  return {
    ...master, ...node, type: master.type,
    props: { ...(master.props || {}), ...(node.props || {}) },
    children: node.children || master.children,
  };
}
```

이 inline resolve 는 **ref master 단순 머지만** 수행 — `descendants` 3-mode 미적용, `slot[]` 미지원. Preview/Skia 와 시각·접근성이 갈라지는 가장 큰 위험 지점이다. SSOT 위반의 핵심 정정 대상.

#### 3.2 정본 — SSG 빌드 타임 resolve, Phase 0 render core 사용

정적 산출물도 **빌드 타임에 `resolveCanonicalDocument`(Phase 0 추출본)를 실행**하여 평탄 트리를 만들고, 그 트리를 `CanonicalNodeRenderer` 로 React SSR(`renderToString`)한다. resolve 코드를 string 안에서 재구현하지 않는다.

```typescript
// @composition/render/publishing/buildStaticSite.tsx (Phase 0 후)
import { renderToString } from "react-dom/server";
import {
  resolveCanonicalDocument, getSharedResolverCache, getSharedImportRegistry,
} from "@composition/render";

export interface StaticSiteOutput {
  pages: Array<{ slug: string; html: string }>;
  themeCss: string;           // §4 (Pencil variables 원형 입력)
  componentCss: string;       // §6 componentRules → build-time 생성 CSS (D3)
  fontFaceCss: string;
  collectionData: Record<string, unknown[]>; // §5 정적 snapshot
}

export function buildStaticSite(
  doc: CompositionDocument,
  opts: {
    resolveImports?: ImportResolverContext;
    collectionsSnapshot: CollectionsMap;       // ← §5: store snapshot 외부 주입
    pencilVariables?: PencilVariablesWire;     // ← §4: 다축 토큰 원형 (검증 필요)
  },
): StaticSiteOutput {
  const cache = getSharedResolverCache();
  const imports = opts.resolveImports ?? getSharedImportRegistry();

  // 1) 빌드 타임 resolve — Preview/Skia 와 동일 함수, 동일 출력
  const resolved = resolveCanonicalDocument(doc, cache, imports);

  // 2) 페이지 단위 SSR — CanonicalNodeRenderer 재사용
  const pages = collectPageRoots(resolved).map((pageRoot, i) => {
    const html = renderToString(
      <CollectionDataProvider value={staticCollectionProvider(opts.collectionsSnapshot)}>
        <CanonicalPageRenderer doc={doc} pageId={pageRoot.id} mode="publish" />
      </CollectionDataProvider>,
    );
    return { slug: makeSlug(i, pageRoot), html };
  });

  return {
    pages,
    themeCss: buildThemeCss(opts.pencilVariables, doc), // §4
    componentCss: buildComponentCss(doc),               // §6 componentRules
    fontFaceCss: buildRegistryFontFaceCss(loadFontRegistry()),
    collectionData: snapshotStaticCollections(doc, opts.collectionsSnapshot), // §5
  };
}
```

산출 HTML shell:

```html
<!DOCTYPE html>
<html lang="ko" data-mode="light" data-base="neutral" data-accent="blue">
<head>
  <meta charset="UTF-8" />
  <style id="theme">{themeCss}</style>          <!-- §4 다축 토큰 -->
  <style id="components">{componentCss}</style> <!-- §6 componentRules → CSS -->
  <style id="fonts">{fontFaceCss}</style>
</head>
<body>
  <nav class="publish-nav">...</nav>
  <main id="app">{page.html}</main>             <!-- SSR resolved 트리 -->
  <script type="application/json" id="collection-data">{collectionData}</script>
  <script type="module" src="/hydrate.js"></script> <!-- RAC 상호작용 hydrate -->
</body>
</html>
```

`hydrate.js` 가 `react-aria-components` + `@composition/shared/components/*` + Phase 0 `CanonicalNodeRenderer` 를 import 하여 SSR HTML 에 `hydrateRoot` 한다. RAC 가 클라이언트에서 키보드/포커스/선택을 활성화한다. 정적 HTML 이 first paint, hydrate 가 상호작용 — fallback 이 아니라 SSG 정상 동작.

**SSR 진입 전 import 그래프 gate (정정 6 — Risk R1)**: `renderToString` 은 Node 환경 — Phase 0 render core 가 `canvaskit`/builder Skia/builder store 를 transitive import 하면 빌드가 깨진다. §7 의 정적 검사 gate(madge/dependency-cruiser 신규 도입)가 `@composition/render` 진입점에서 canvaskit·apps/builder skia 심볼 0건을 강제한다. (실측: shared component 본체 Table.tsx 는 Skia import 0건 — 위험은 builder adapter 경유에 집중, Phase 0 가 직접 겨냥.)

---

### 4. theme 다축(Accent/Base/Mode) → CSS 변환 메커니즘 (정정 3)

#### 4.1 Pencil variables 의 1차 원리 — `TokensSnapshot` 과의 구분 (정정 3 핵심)

**원설계의 schema 오독 정정**: 원설계 §4.2 `buildThemeCss(doc.tokens)` 가 `doc.tokens` 를 순회하며 `axisEntries(spec)` 로 축 조합 배열을 푼다고 가정했다. **실측 결과 이는 틀렸다**:

실측 `TokensSnapshotEntry`(composition-document.types.ts:79):
```typescript
export interface TokensSnapshotEntry {
  type: "color" | "number" | "string" | "boolean";
  value: string | number | boolean;   // ← 단일 scalar (다축 배열 아님)
  source: "spec-token" | "user-defined";
}
export type TokensSnapshot = Record<string, TokensSnapshotEntry>;
```

`ThemeSnapshot`(:55)은 축 상태를 **현재 단일 선택**(tint/darkMode/neutral/radiusScale)으로 carry 한다. 즉 **canonical `doc.tokens` 는 snapshot 시점에 단일 theme state 로 이미 flatten 되어 있고, Pencil 의 (Accent×Base×Mode) 조합 배열을 보존하지 않는다.**

또한 `tokens` 필드 주석은 **"ADR-143: `variables` → `tokens` 정명(.pen wire 는 variables 유지, 직렬화 경계에서 매핑)"** — 즉 단순 rename 이지 "변수와 토큰을 도메인으로 분리"한 것이 **아니다** (원설계 §4.2 괄호 주석 정정).

→ **정정된 입력 구분**:

| 입력 | 구조 | 출처 | buildThemeCss 역할 |
| --- | --- | --- | --- |
| Pencil `variables`(wire) | `value: [{theme:{Mode:"Dark"}, value}, ...]` **다축 배열** | `.pen` import / ThemeStudio store | **다축 CSS 셀렉터 적층 생성** |
| canonical `doc.tokens`(TokensSnapshot) | `value: scalar` **단일 state** | ADR-110/021 snapshot adapter | 현재 active state 의 `:root` 기본값 |

따라서 **다축 CSS 적층 생성의 입력은 `doc.tokens` 가 아니라 Pencil `variables` 원형(또는 ThemeStudio store 의 축조합 데이터)이다.** `buildStaticSite` 가 이를 `pencilVariables` 인자로 별도 주입한다(§3.2 코드).

#### 4.2 정본 — Pencil variables 다축 배열 → CSS specificity 적층

```typescript
// @composition/render/publishing/themeCss.ts
// 입력: Pencil variables 원형 (다축 배열), NOT TokensSnapshot
interface PencilVariableEntry {
  type: "color" | "number" | "string";
  value: Array<{ theme?: Record<string, string>; value: string }>;
}
type PencilVariablesWire = Record<string, PencilVariableEntry>;

export function buildThemeCss(
  variables: PencilVariablesWire | undefined,
  doc: CompositionDocument, // doc.tokens 는 fallback(단일 state) 용도로만
): string {
  const blocks: string[] = [];

  if (variables) {
    // 1) default 블록 — 축 미지정 entry (:root)
    const rootDecls: string[] = [];
    for (const [name, spec] of Object.entries(variables)) {
      const def = spec.value.find((v) => !v.theme);
      if (def) rootDecls.push(`  ${cssVarName(name)}: ${def.value};`);
    }
    blocks.push(`:root {\n${rootDecls.join("\n")}\n}`);

    // 2) 축 조합별 override 블록 — specificity 적층
    for (const [name, spec] of Object.entries(variables)) {
      for (const entry of spec.value) {
        if (!entry.theme) continue;                 // 축 지정된 value 만
        const selector = axisSelector(entry.theme); // {Mode:"Dark"} → selector
        blocks.push(`${selector} {\n  ${cssVarName(name)}: ${entry.value};\n}`);
      }
    }
  } else {
    // fallback: canonical doc.tokens(단일 state) → :root 만 (다축 미보존)
    const tokens = doc.tokens ?? {};
    const decls = Object.entries(tokens)
      .map(([n, e]) => `  ${cssVarName(n)}: ${String(e.value)};`).join("\n");
    blocks.push(`:root {\n${decls}\n}`);
  }
  return blocks.join("\n\n");
}

// { Mode:"Dark", Accent:"Blue" } → ':root[data-mode="dark"][data-accent="blue"]'
function axisSelector(theme: Record<string, string>): string {
  const attrs = Object.entries(theme)
    .map(([axis, val]) => `[data-${axis.toLowerCase()}="${val.toLowerCase()}"]`)
    .join("");
  return `:root${attrs}`;
}

function cssVarName(token: string): string {
  return token.startsWith("--") ? token : `--${token.replace(/^\$/, "").replace(/\./g, "-")}`;
}
```

생성 결과:
```css
:root { --accent: #f5f5f5; }
:root[data-mode="dark"]                     { --accent: #262626; }
:root[data-accent="blue"]                   { --accent: #3b82f6; }
:root[data-accent="blue"][data-mode="dark"] { --accent: #1e40af; }
```

#### 4.3 런타임 theme 전환

root `data-*` 1개만 바꾸면 끝 — RAC starter `--tint` 단일 변수 전환 패턴의 다축 확장:
```typescript
function setTheme(axis: "mode" | "accent" | "base", value: string) {
  document.documentElement.dataset[axis] = value.toLowerCase();
  // CSS 셀렉터 즉시 재매칭 → 모든 var(--accent) 소비처 동시 갱신. reflow만, JS 재계산 없음.
}
```
fill 참조 `$--accent` → `var(--accent)` 치환은 resolve 또는 `toRacProps`/style 변환에서 수행.

#### 4.4 Skia 대칭 + 검증 항목 (정정 3)

Skia 는 CSS var 를 모르므로 축 조합으로 **resolved 색상값**을 직접 받는다. 핵심 불변식: **CSS 셀렉터가 고른 값 = Skia lookup 이 고른 값** (ADR-143 Gate G-B: `resolveCanonicalToken(ref, doc)` === `resolveToken(ref, theme)`).

**검증 필요 항목 (정정 3 으로 신규 추가)**:
- `TokensSnapshot` 이 단일 state 로 flatten 됨이 확인됐으므로, **다축 전환을 publishing 에서 지원하려면 Pencil variables 원형(또는 ThemeStudio store 축조합)을 별도 입력으로 보존·주입해야 한다**. canonical document 만으로는 다축 재현 불가 — `buildStaticSite` 가 `pencilVariables` 를 받는 이유.
- canonical 다축 Accent/Base 가 Skia 경로에 완전 배선됐는지: 현행 `generateThemeCSS` 는 tint/neutral/radius 3축만 처리. 다축 확장은 검증 필요.

---

### 5. collection 데이터 → publishing 분기 (정정 2 — schema 오류 전면 수정)

#### 5.1 `useCollectionData` 단일 진입점 계승 (ADR-132)

RAC collection 컴포넌트(Table/ListBox/GridList/ComboBox/Select/Tree/Breadcrumbs)의 items read 는 `useCollectionData({ dataBinding | datatableId })` **단일 경유**(실측 `packages/shared/src/hooks/useCollectionData.tsx`). 내부 `useAsyncList.load` 가 source 분기를 흡수한다. 이 구조를 Preview/Publish 가 계승한다.

#### 5.2 데이터 source 분기 — collection entry 가 아니라 binding/endpoint 기준 (정정 2 핵심)

**원설계의 schema 오류 전면 정정**: 원설계 §5.2 `snapshotStaticCollections` 가 `for (const c of doc.collections ?? [])` 를 순회하며 `c.source === "api"`, `c.name`, `c.useMockData` 를 읽었다. **실측 결과 3중 오류**:

1. **`CompositionDocument` 에 `collections` 필드가 없다** (실측: top-level = version/themes/tokens/componentRules/imports/_meta/children. `doc.collections` grep 0건). ADR-132 의 `data_tables → collections` rename 은 **store/runtime 레벨 `CollectionsMap`** 이며 canonical document top-level field 로 직렬화되지 않았다.
2. **`DataTableDefinition`(collection.types.ts:32)에 `source` 필드가 없다** — 필드는 `id/name/schema/mockData/runtimeData/useMockData` 뿐.
3. **`source: 'dataTable'|'api'|'variable'|'route'` 는 `PropertyDataBinding`(collection.types.ts:209)** 즉 **"UI 노드 prop 이 가진 바인딩"** 에 있다. collection/data-table entry 가 아니다.

→ 원 코드는 존재하지 않는 필드를 참조해 **컴파일·런타임 모두 실패**한다.

**정정된 source 분기 정의**:
- 데이터 source 판정 기준 = (a) 각 UI 노드의 `PropertyDataBinding.source`, 또는 (b) `ApiEndpointDefinition` 존재 여부. **collection entry 의 source 가 아니다.**
- 정적 박제 대상 = "api endpoint 를 쓰는 바인딩이 아닌, dataTable/static 노드가 참조하는 `DataTableDefinition`".
- canonical schema 에 `doc.collections` 가 없으므로, **store `CollectionsMap` snapshot 을 publishing 입력으로 별도 주입**한다 (§3.2 의 `opts.collectionsSnapshot`).

```typescript
// @composition/render/publishing/collectionSnapshot.ts (정정)
// 입력: store CollectionsMap snapshot (canonical schema 외부 — 별도 주입)
//       + 각 UI 노드의 PropertyDataBinding (api 여부 판정)

export function snapshotStaticCollections(
  doc: CompositionDocument,
  collections: CollectionsMap,   // ← store snapshot, NOT doc.collections
): Record<string, Record<string, unknown>[]> {
  // 1) 문서 내 모든 PropertyDataBinding 수집 → api endpoint 바인딩의 target id 집합
  const apiBoundTargets = collectApiBoundCollectionIds(doc); // binding.source==="api"

  // 2) DataTableDefinition 중 api 바인딩 대상이 아닌 것만 정적 박제
  const out: Record<string, Record<string, unknown>[]> = {};
  for (const [id, def] of Object.entries(collections)) {
    if (apiBoundTargets.has(id)) continue;           // api → 런타임 fetch (제외)
    out[id] = def.useMockData ? (def.mockData ?? []) : (def.runtimeData ?? def.mockData ?? []);
  }
  return out;
}

// 문서 노드 트리를 순회하며 PropertyDataBinding.source==="api" 인 바인딩의 target collection id 수집
function collectApiBoundCollectionIds(doc: CompositionDocument): Set<string> {
  const ids = new Set<string>();
  const visit = (node: CanonicalNode): void => {
    const binding = extractDataBinding(node.props); // PropertyDataBinding | undefined
    if (binding?.source === "api" && binding.targetCollectionId) {
      ids.add(binding.targetCollectionId);
    }
    (node.children ?? []).forEach(visit);
  };
  (doc.children ?? []).forEach(visit);
  return ids;
}

// SSR/hydrate 시 정적 provider — useCollectionData 의 service 자리에 주입
function staticCollectionProvider(collections: CollectionsMap): CollectionDataServices {
  // snapshot 은 buildStaticSite 단계에서 이미 계산됨 — 여기서는 collections 직접 참조
  return {
    dataTableService: {
      getDataTables: () => Object.values(collections),
      getDataTableState: (id) => ({
        status: "loaded",
        data: collections[id]?.useMockData
          ? (collections[id]?.mockData ?? [])
          : (collections[id]?.runtimeData ?? []),
        error: null,
      }),
    },
    apiEndpointService: runtimeApiEndpointService, // api binding 은 클라이언트 런타임 실행
    isCanvasContext: false,
  };
}
```

> **검증 필요 (open question 4 를 본문 코드와 일치)**: `PropertyDataBinding` 의 `targetCollectionId`(또는 동등 target 필드)의 정확한 이름과, api binding 이 어느 collection id 를 가리키는지의 정확한 경로는 `collection.types.ts:207-` 및 `useCollectionData.tsx` 실측으로 재확인 필요. 본 설계는 "source 판정 = binding/endpoint 기준, collection entry 아님" 의 **구조**를 확정하되, 필드명 매핑은 검증 항목으로 명시한다. 핵심은 `doc.collections`·`c.source` 가 존재하지 않으므로 **store CollectionsMap 을 별도 입력으로 주입**한다는 점이다.

#### 5.3 정적 vs 런타임 분기 표 (정정 반영)

| binding source (PropertyDataBinding) | Preview | Publish (정본) |
| --- | --- | --- |
| `dataTable`(mock/runtime) / `static` | builder store `CollectionsMap` read | **빌드 타임 snapshot** → `<script id="collection-data">` 박제, hydrate 시 provider 주입 |
| `api`(`useAsyncList`) | builder proxy/endpoint 실행 | **런타임 fetch** — endpoint 메타만 산출물 포함, 클라이언트가 호출 |

fallback 사고 회피: API 실패 시 빈 화면 대신 fallbackData/에러 표시는 컴포넌트 책임(`useCollectionData` 처리), 정상 동작 보장은 endpoint 메타의 정확한 산출에 둔다.

---

### 6. SSOT 일관성 증명 — button.size="sm" → fontSize:14, componentRules 가 D3 공급처 (정정 4)

**원설계의 D3 공급처 오류 정정**: 원설계 §6 은 size→fontSize 의 D3 공급처를 "CSSGenerator 가 spec 에서 생성한 `[data-size=sm]{font-size:14px}`" 로 제시했다. **실측 결과 이는 legacy 경로**이며 ADR-142 end-state 와 부분 충돌한다:

- ADR-142 의 D3 시각 SSOT 는 `componentRules?: ComponentRulesTable`(composition-document.types.ts:502, G2(b) B)이며, **124 spec 의 variants/sizes/fill 을 build-time 생성한 `packages/shared/src/catalog/generated/componentRulesTable.ts`(실측 존재)를 generic 렌더러가 소비**하는 방향이다.
- 실측 `ComponentRule` 구조: `{ defaultVariant?, defaultSize?, variants: Record<string, ComponentRuleVariant>, sizes: Record<string, ComponentRuleSize>, textDecoration? }`. `ComponentRuleSize.fontSize/lineHeight/borderRadius/...` 가 size→시각 매핑의 SSOT. (layout padding/gap 은 제외 — `element.props.style` 경로 유지, ADR-907 Layer B 보존.)
- 사용자 제약("현행 spec.ts 답습 금지")상 `spec→CSS` 생성을 SSOT 증명의 핵심 매체로 고정하면 ADR-142 수렴 목표와 어긋난다.

→ **정정**: size→fontSize 의 D3 공급처를 **`componentRules` 테이블(및 그로부터 build-time 생성된 CSS + Skia metric)** 로 재서술. `CSSGenerator` 는 `componentRules → CSS` 변환의 **한 출력 경로로 격하**하고, Skia metric 과 동일하게 `componentRules` 단일 테이블에서 파생됨을 불변식에 명시한다.

```
CompositionDocument.children[버튼].props.size = "sm"   ← 단일 SSOT (인스턴스)
        │
        ▼  resolveCanonicalDocument (Phase 0 추출, 동일 함수, 동일 cache)
ResolvedNode { type:"Button", props:{ size:"sm", ... } }
        │
        │   ┌──── componentRules["Button"].sizes["sm"].fontSize = 14 ────┐  ← D3 SSOT
        │   │            (generated/componentRulesTable.ts)              │
   ┌────┼───┴──────────────┬──────────────────────┬──────────────────────┘
   ▼    ▼                  ▼                       ▼
[Skia] [Preview DOM]    [Publish DOM]          [Style Panel]
componentRules          componentRules          componentRules["Button"]
→ Skia metric           → build-time CSS        .sizes["sm"].fontSize
size=sm→fontSize:14      [data-size="sm"]        → 14 read
   │      data-size="sm"   {font-size:14px}          │
   └─Canvas └─DOM computed └─DOM computed (SSR)       └─Panel 표시 "14"
     :14      :14px           :14px
```

불변식 (정정): **네 경로가 모두 `size:"sm"` resolved 값 + `componentRules` 테이블이라는 동일 source 에서 출발**한다. `componentRules["Button"].sizes["sm"].fontSize` 를 14→13 으로 바꾸면(또는 generate-rules.ts 가 spec 재생성) **네 곳이 동시에** 갱신된다. 동시성을 깨는 유일한 경로는 어떤 consumer 가 resolve/componentRules 를 우회하여 값을 자체 계산하는 것 — 그것이 §3 의 inline resolve 와 §2.4 의 flat-Element 파생이었고, 본 설계가 둘 다 정본 resolve + componentRules 경로로 수렴시킨다.

build-time gate (정정 — componentRules 기준으로 교정):
- **resolve 동일성 gate**: 동일 doc 에 Preview/Publish 가 호출한 `resolveCanonicalDocument` 출력 deep-equal.
- **theme 토큰 양측 동일성**: `resolveCanonicalToken(ref, doc) === resolveToken(ref, theme)` (ADR-143 Gate G-B).
- **size→fontSize 대칭 (정정)**: 각 size 에 대해 **(componentRules 파생 CSS px) === (componentRules 파생 Skia metric px) === (Panel componentRules read px)**. 원설계의 "CSSGenerator 출력 px === Skia spec metric px" 를 "componentRules 파생 CSS px === componentRules 파생 Skia metric px" 로 교정. ADR-139 `componentRegistrationContract.test.ts` 패턴(불변식 A/B + baseline ratchet)과 동형.

---

### 7. 핵심 산출물 요약 (구현 순서 — Phase 0 선행 박제)

0. **Phase 0 (선행 필수, 정정 1·6)**: `resolveCanonicalDocument` + `cache` + `importRegistry` + `storeBridge` 순수부 + `CanonicalNodeRenderer` 순수 DOM 렌더 코어를 `@composition/render` 신규 패키지(또는 `packages/shared/src/render/*`)로 추출. builder 내부 의존(store read / `frameMirror`)을 props 주입형 adapter 로 외부화. **import 그래프 정적 검사 도구(madge/dependency-cruiser) 신규 도입** + `@composition/render` 진입점 canvaskit·builder skia 심볼 0건 gate. **이 단계 없이는 1~5 의 "재사용" 서술이 컴파일 불가.**
1. **Publish 앱 resolve 통합**: `apps/publish/src/App.tsx` 의 `deriveProjectRenderModelFromDocument` flat-Element 경로 → `resolveCanonicalDocument` + `CanonicalPageRenderer(mode:"publish")`. flat `Element[]` 렌더 source 제거, `ResolvedNode[]` 트리 통일. (정정 5: 3-mode 손실이 아니라 source 형식 통일이 목표.)
2. **`generateStaticHtml` 정정 (정정 5)**: inline vanilla `resolveNode`(export.utils.ts:1100, ref 단순 머지만 — 유일한 broken 경로) 제거 → 빌드 타임 `resolveCanonicalDocument` + `renderToString(CanonicalPageRenderer)`. descendants 3-mode + slot 확보.
3. **theme 다축 CSS (정정 3)**: 입력을 `doc.tokens`(TokensSnapshot, 단일 state)가 아니라 **Pencil `variables` 원형(다축 배열)** 으로 명확히 구분. `buildThemeCss(pencilVariables, doc)` 가 축 조합 셀렉터 적층 생성. canonical tokens 는 fallback(`:root` 단일 state)만. `$--token` → `var(--token)` 치환.
4. **collection 분기 (정정 2)**: `doc.collections`·`c.source` 참조 제거. source 판정 = `PropertyDataBinding.source` / endpoint 존재 여부. store `CollectionsMap` snapshot 을 publishing 입력으로 별도 주입(`buildStaticSite` 의 `collectionsSnapshot`). 정적 박제 = api 바인딩 대상이 아닌 `DataTableDefinition`.
5. **SSOT gate (정정 4)**: resolve 동일성 + theme 토큰 양측 동일 + **componentRules 파생 size→fontSize 대칭**(CSSGenerator 가 아니라 componentRules 기준) build-time 테스트.

이 여섯이 "같은 canonical 문서 + componentRules 테이블 → Skia(빌더)와 Preview/Publish(DOM)에서 동일 시각" 을 데이터 구조·코드 공유·boundary 정합 세 측면에서 보장한다 — RAC(D1 접근성 runtime) + Pencil(canonical resolve) 1차 원리에서 재유도한 결과가 ADR-142 end-state(componentRules SSOT + generic 렌더러)와 수렴한다.

---

### Risks (정정으로 신설/승격)

| ID | 위험 | 심각도 | 대응 |
| --- | --- | :---: | --- |
| R1 | Phase 0 render core 가 builder Skia/store 를 transitive import → SSR(`renderToString`) 빌드 파손 (정정 6, open question→승격) | **HIGH** | Phase 0 에서 render core ↔ builder adapter 분리 + madge/dependency-cruiser 신규 도입 + canvaskit·builder skia 심볼 0건 gate (§7-0) |
| R2 | `@composition/render` 패키지 추출이 미완인 채 §2.4/§3.2 의 "재사용" 코드가 import 불가 (정정 1) | **HIGH** | Phase 0 를 1~5 의 hard prerequisite 로 박제. Phase 0 미완 시 후속 phase 진입 차단 |
| R3 | Pencil 다축 토큰이 canonical `TokensSnapshot`(단일 state)에 보존 안 됨 → publishing 다축 전환 불가 (정정 3) | MED | `pencilVariables`(또는 ThemeStudio store 축조합) 를 `buildStaticSite` 입력으로 별도 주입. canonical tokens 는 단일 state fallback |
| R4 | `PropertyDataBinding` 의 api target 필드명 미확정 → §5.2 코드 컴파일 위험 (정정 2 잔존) | MED | `collection.types.ts:207-` + `useCollectionData.tsx` 실측으로 필드명 확정 (검증 항목). 구조(binding 기준 판정)는 확정, 매핑만 미확정 |
| R5 | componentRules Phase 1 은 build-time 상수 fallback(`doc.componentRules` undefined) — 문서별 override(Phase 2)는 미배선 | LOW | §6 증명은 build-time `componentRulesTable.ts` 상수 기준. 문서 override 는 ADR-142 Phase 2 후속 |

### 검증 필요 (open questions)

1. **(정정 2)** `PropertyDataBinding` 의 api endpoint target collection id 필드의 정확한 이름 — `collection.types.ts:207-` 및 `useCollectionData.tsx` 실측 재확인. §5.2 의 `targetCollectionId`/`extractDataBinding` 는 구조 placeholder.
2. **(정정 3)** ThemeStudio store(또는 다른 경로)가 Pencil `variables` 다축 배열을 런타임에 보존하는가, 아니면 `.pen` import 시점에만 존재하고 이후 `TokensSnapshot` 으로 flatten 되는가 — publishing 다축 지원 가능 범위 결정.
3. **(정정 3)** canonical 다축 Accent/Base 가 Skia 경로(`generateThemeCSS` tint/neutral/radius 3축)에 완전 배선됐는지.
4. **(정정 6)** Phase 0 추출 시 `@composition/shared/components/*` 20여 개 중 SSR-unsafe(top-level WASM/store 접근) 컴포넌트 식별 — Table.tsx 는 Skia import 0건 확인됨, 나머지 19개 실측 필요.
5. **(정정 1)** Phase 0 추출 대상에 `frameMirror`(builder-specific) 를 어느 범위까지 adapter 로 외부화할지 — preview/publish 가 frame mirror id 를 필요로 하는지 여부.

---

<a id="영역-7"></a>

## ⑦ 대표 컴포넌트 Format 예시 — Button / Checkbox / ListBox / Table / Select (정정판)

> **정정 요약 (적대적 검증 반영, 2026-06-01)**: 본 절은 코드베이스 실측으로 6개 항목을 정정했다. 모든 정정은 grep 으로 확인한 실존 심볼/토큰값에 근거한다.
> - §1: SSOT "한 줄 증명" 의 구체 숫자를 실측 토큰값으로 교체 — `size=sm → 14` 는 **거짓** (실측: Button `sm=text-xs=12`, `md=text-sm=14`). 헤드라인을 `size=md → 14` 로 정정.
> - §1: 가짜 helper `resolveFontSize(...)` / `resolveToken(ref, doc.tokens)` 삭제 → 실존 경로 `buildCatalogShapes → resolveSpecFontSize → resolveToken(ref, theme)` 로 교체. **`doc.tokens` 가 fontSize 공급처라는 서술은 오류** — fontSize 토큰의 module-level SSOT 는 `packages/specs/src/primitives/typography.ts`.
> - §1: "4 소비처가 같은 함수 1개" 단정 완화 — Skia 는 `resolveComponentRule`(generated table), CSS(`CSSGenerator`)는 아직 `spec.sizes`/`spec.variants` 직접 소비. **두 공급처는 build-time 생성으로 값이 일치하나 동일 런타임 함수는 아님** (rule-table 단일화는 ADR-142 진행 중).
> - §3: Checkbox `default` variant 의 selected 색은 **`{color.neutral}`** (실측). `{color.accent}` 는 **`emphasized`** variant 의 selected 색. accent 예시는 variant 를 명시해 사용.
> - §2.6/§7: IconButton reusable 등록 블록은 **현재 미등록** (실측: `componentCatalog.ts` 에 `kind:"reusable"` 등록 0건, 주석만 존재). 가정법으로 명시.
> - §4.4: `useCollectionData` 는 다중 입력(`dataBinding`|`datatableId`), ADR-132 read 경유이나 **`isCanvasContext` 분기 + "Phase 3 통합 예정" 으로 완전 단일화 미완**. DOM virtualization 은 **RAC `<Virtualizer>` 명시 wrapping 시** culling — starter `ListBox.tsx` 에 Virtualizer wrapper 없음 (자동 아님). Skia culling 은 설계 제안(미구현)임을 유지.

---

### 0. 출발점: 두 외부 자산이 강제하는 분류 규칙

ADR-142 의 end-state 를 RAC + Pencil 1차 원리로 재유도하면, 모든 컴포넌트는 **단 두 가지 모양**으로만 표현된다. 누적 부채(`*.spec.ts`)나 전환기 어댑터가 아니라, 두 외부 검증 자산이 직접 이 분류를 만들어낸다.

| 외부 원리 | 도출되는 규칙 |
| --- | --- |
| **Pencil format**: 노드 type 은 11종 primitive 뿐, 컴포넌트별 type 없음. `reusable:true frame`=정의, `{type:"ref"}`=인스턴스 | "조합 컴포넌트"는 코드가 아니라 **데이터(reusable frame 문서)**. 따로 정의 객체를 둘 이유가 없다 |
| **RAC**: unstyled primitive 1개당 1개의 D1 권위 컨트롤러(state hook + DOM 구조 + ARIA). 시각은 100% CSS 토큰 + `data-*` | leaf 컴포넌트는 **RAC primitive 1개 = `PrimitiveBinding` 1개**. 시각/변형 필드를 binding 에 넣지 않는다 |
| **RAC Collections**: `<Collection items={...}>{renderFn}</Collection>` — 데이터와 렌더 함수 분리, 내부 Node tree 가 키보드/선택/접근성 담당 | "collection 컴포넌트"는 **leaf binding(`source:"internal"` wrapper) + 외부 데이터(`collections` root)**. items 는 props 가 아니라 데이터 바인딩 |

이로부터 **3분류**가 나온다 (catalog `ComponentCatalogEntry`):

- **leaf primitive** (`kind:"primitive"`, `binding`): RAC primitive 1:1 — Button, Checkbox
- **collection primitive** (`kind:"primitive"`, `source.kind:"internal"` wrapper + `dataBinding`): RAC Collection 합성을 wrapper 가 담당 — ListBox, Table, Select
- **reusable 조합 문서** (`kind:"reusable"`, `reusableId`): 코드 정의 0줄, canonical reusable frame — "아이콘이 붙은 Button" 이 여기 해당 (**현재 catalog 미등록 — §2.6 참조**)

핵심: **Button/Checkbox/ListBox/Table/Select 5개는 전부 leaf 또는 collection-leaf 다. 조합 reusable 문서가 되는 것은 "사용자가 합성한 결과물"**(아이콘 Button, 카드, 폼 블록)이다. 이 글은 그 경계를 각 컴포넌트에서 실증한다.

---

### 1. SSOT 한 줄 증명 — `size="md" → fontSize:14` (정정: sm 아님)

5개 모두 같은 SSOT 사슬을 탄다. 하지만 **검증 결과 두 공급처가 build-time 으로 분리**되어 있다 — 이를 정확히 서술한다.

#### 1.1 실측 토큰 사슬 (Button 기준)

```ts
// 공급처 A (Skia): packages/shared/src/catalog/generated/componentRulesTable.ts (build-time 생성)
//   COMPONENT_RULES_TABLE["Button"].sizes.md.fontSize === "{typography.text-sm}"   ← md (sm 아님)
//   COMPONENT_RULES_TABLE["Button"].sizes.sm.fontSize === "{typography.text-xs}"   ← sm 은 12
//
// 공급처 B (fontSize 토큰값 SSOT): packages/specs/src/primitives/typography.ts (module-level)
//   typography["text-xs"]  === 12
//   typography["text-sm"]  === 14
//   typography["text-base"]=== 16
//   → resolveToken("{typography.text-sm}") === 14   (theme 축은 색상만 light/dark 분기, fontSize 는 무관)
```

→ 따라서 정확한 한 줄 증명은 **`Button.size="md" → sizes.md.fontSize = {typography.text-sm} → 14`** 다. `size="sm"` 이면 `{typography.text-xs}` → **12**. (검증자 지적 1 수용: 임의의 `size=sm→14` 가정은 실측과 불일치.)

#### 1.2 실측 해소 경로 (가짜 helper 삭제)

코드베이스에 `resolveFontSize(type, size, doc)` 같은 helper 는 **존재하지 않는다.** Skia 실측 경로는 다음 3 심볼이다:

```ts
// (실측) Skia fontSize 해소 — apps/builder/.../skia/resolveSkiaVisualRule.ts + packages/specs buildCatalogShapes
import { resolveSkiaRule } from "@/builder/workspace/canvas/skia/resolveSkiaVisualRule";
//   resolveSkiaRule("Button") === COMPONENT_RULES_TABLE["Button"]   (generated table 조회)

// packages/specs/src/renderers/buildCatalogShapes.ts (line 168) — 실제 fontSize 산출:
const fontSize = resolveSpecFontSize(
  (style?.fontSize as string | number | undefined) ?? size.fontSize, // size = rule.sizes["md"]
  16,                                                                 // fallback (raw 미해소 시)
);
// resolveSpecFontSize 내부 (packages/specs/.../utils/resolveSpecFontSize.ts):
//   if (typeof raw === "number") return raw;
//   if (raw 가 "{...}" TokenRef) return resolveToken(raw);   // ← resolveToken(ref, theme="light")
//   return fallback;
```

`resolveToken` 의 **실측 시그니처**는 `resolveToken(ref: TokenRef, theme: "light" | "dark" = "light")` 이며, 두 번째 인자는 **`doc.tokens` 가 아니라 theme 선택자**다 (실측: `tokenResolver.ts:21`). fontSize/색상 값의 공급은 `doc.tokens` 가 아니라 **module-level 로 import 된 `typography`/`colors` primitives** 에서 일어난다. `theme` 인자는 color 카테고리에서만 `darkColors`/`lightColors` 를 가른다 — typography 는 theme 무관. (검증자 지적 2 수용: `doc.tokens` 공급처 서술 삭제.)

#### 1.3 공급처 2개의 정확한 관계 (4 소비처 "같은 함수 1개" 단정 완화)

| 소비처 | fontSize/색상 공급처 | 진입점 |
| --- | --- | --- |
| **Skia Rendering** | `COMPONENT_RULES_TABLE` (generated) | `resolveSkiaRule` → `buildCatalogShapes` → `resolveSpecFontSize` → `resolveToken` |
| **Publishing/Preview DOM** | **`spec.*` 직접** (`spec.sizes`/`spec.variants`) | `CSSGenerator.ts` (line 447 `Object.entries(spec.sizes)`, line 226-229 `spec.variants` 어댑터 seam) |
| **Style/Properties Panel** | `resolveComponentRule` (rule table) + binding `accepts` | `buildInspectorFields` |
| **Layout (Taffy/측정)** | 위 둘과 동일 토큰 | `canvaskitTextMeasurer` / `calculateContentHeight` |

→ **검증 필요 / 정확한 현 상태**: Skia 와 Panel 은 `resolveComponentRule`(generated table)을 소비하지만, **CSS(`CSSGenerator`)는 아직 `spec.sizes`/`spec.variants` 를 직접 소비**한다. 두 공급처(generated table ↔ spec)는 **build-time 생성으로 값이 일치**하나 **동일 런타임 함수를 경유하지는 않는다.** rule-table 로의 CSS 소비 단일화는 **ADR-142 G2(b) 진행 중**(variant 어댑터 seam 수렴 단계, 실측: `CSSGenerator.ts:23` "spec.variants 직접 접근을 본 seam 으로 수렴"). (검증자 지적 3 수용: "4 소비처 같은 함수 1개" 단정 완화.)

SSOT 의 실질은 유지된다: 공급처 토큰 `{typography.text-sm}` 의 값이 바뀌면 build 재생성 + typography.ts 한 곳 수정으로 4곳 동일 반영되고, **컴포넌트당 fontSize 를 적어두는 곳이 어디에도 없다**(generated table + typography 토큰 단 둘). 다만 "런타임 단일 함수" 가 아니라 **"build-time 정합된 두 공급처"** 가 정확한 표현이다.

---

### 2. Button — 가장 단순한 leaf primitive

#### 2.1 분류: **leaf primitive**

근거: RAC `<Button>` 은 단일 컨트롤러(`useButton` + `<button>` DOM + press/focus state). 시각(variant/size/fillStyle)은 D3 → `data-*` 라우팅 + theme CSS/Skia. 자식 텍스트 1개 외 구조 합성 없음. RAC starter 원본도 단순 래퍼다:

```tsx
// packages/react-aria-starter/src/Button.tsx (실측)
export function Button(props: ButtonProps) {
  return (
    <RACButton {...props} className="react-aria-Button button-base"
               data-variant={props.variant || 'primary'}>
      {composeRenderProps(props.children, (children, {isPending}) =>
        <>{!isPending && children}{isPending && <ProgressCircle isIndeterminate />}</>
      )}
    </RACButton>
  );
}
```

→ `variant` 가 `data-variant` 로 라우팅되는 것을 RAC 원본이 직접 보여준다. 우리 format 은 이 패턴을 generic 화한다 (모든 leaf 의 `variant`/`size`/`fillStyle` 이 같은 규칙으로 `data-*` 행).

#### 2.2 PrimitiveBinding 전체 (실측 `Button.binding.ts`)

```ts
// packages/shared/src/catalog/bindings/Button.binding.ts
export const buttonBinding: PrimitiveBinding = {
  source: {
    kind: "rac",
    package: "react-aria-components",
    importPath: "react-aria-components",
    component: "Button",                       // 렌더러가 RAC["Button"] 조회
  },
  rac: {                                        // D1 메타 (인스펙터/검증용, 렌더 분기 아님)
    primitive: "Button",
    parts: ["button"],
    slots: [],
    states: ["isHovered","isPressed","isFocused","isFocusVisible","isDisabled","isPending"],
    renderProps: ["isHovered","isPressed","isFocused","isFocusVisible","isDisabled","isPending"],
    dataAttributes: ["data-hovered","data-pressed","data-focused",
                     "data-focus-visible","data-disabled","data-pending"],
  },
  props: {
    accepts: {                                  // = D2 편집 SSOT (Panel 노출 필드)
      children:  { kind: "string",    label: "Text",       section: "content" },
      variant:   { kind: "variant",   label: "Variant",    section: "appearance", default: "primary" },
      size:      { kind: "size",      label: "Size",       section: "appearance", default: "md" },
      fillStyle: { kind: "fillStyle", label: "Fill Style", section: "appearance", default: "fill",
                   options: [{value:"fill",label:"Fill"},{value:"outline",label:"Outline"}] },
      type:      { kind: "enum",      label: "Type",       section: "state", default: "button",
                   options:[{value:"button",label:"Button"},{value:"submit",label:"Submit"},{value:"reset",label:"Reset"}] },
      isPending:  { kind: "boolean",  label: "Pending",  section: "state" },
      isDisabled: { kind: "boolean",  label: "Disabled", section: "state" },
    },
    toRacProps: "default",                      // outputs/toRacProps.ts::toRacProps
  },
  // skiaPrimitive 없음 → buildCatalogShapes(보편 box+text)가 그린다
};
```

여기 **색상/픽셀이 전혀 없다.** `variant:"primary"` 의 실제 색은 binding 이 아니라 rule 테이블에 있다 (실측: `COMPONENT_RULES_TABLE["Button"].variants.primary.fill.default.base === "{color.neutral}"`, `colors.text === "{color.base}"`). `variant:"accent"` 의 색은 `variants.accent.fill.default.base === "{color.accent}"` / `colors.text === "{color.on-accent}"`. 이것이 "binding 은 D2(편집 surface)만, D3(시각)는 rule 테이블" 분리.

#### 2.3 canonical props → RAC props 투영 + `data-*` 라우팅 (실측 `toRacProps.ts`)

canonical 노드:
```jsonc
{ "id":"btn1", "type":"Button",
  "props": { "children":"저장", "variant":"accent", "size":"sm", "fillStyle":"fill" } }
```

`toRacProps(node, buttonBinding)` 변환 규칙 (실측 `outputs/toRacProps.ts`):
- `accepts` 에 선언된 prop 만 통과 (event handler 등 drop)
- `kind ∈ {variant,size,fillStyle}` → **RAC props 가 아니라 `data-{kebab(key)}`** 로 라우팅 (실측: `DATA_ROUTED_KINDS = ["variant","size","fillStyle"]`, `toDataAttrName` camelCase→kebab)
- 미지정 + `default` 있으면 default emit (theme `[data-variant=...]` 매칭 보장)

```ts
// 결과 (Record<string,unknown>)
{
  children: "저장",            // 일반 prop → RAC 로 직행
  "data-variant": "accent",    // visual-enum → data-*
  "data-size": "sm",
  "data-fill-style": "fill",   // camelCase→kebab (fillStyle→fill-style)
  // type/isPending/isDisabled 은 노드가 생략 → default 만 emit (type:"button")
  "type": "button",
}
```

#### 2.4 DOM ↔ Skia 가 같은 시각을 내는 경로

```tsx
// (DOM) preview — generic 렌더러가 RAC primitive 에 투영 props 스프레드
import * as RAC from "react-aria-components";
const Comp = RAC[buttonBinding.source.component];        // RAC.Button
<Comp {...toRacProps(node, buttonBinding)} />            // <button data-variant="accent" data-size="sm" ...>
// → theme CSS: [data-variant="accent"]{ background:var(--accent); color:var(--fg-on-accent) }
//             [data-size="sm"]{ font-size:12px; ... }   ← sm 은 text-xs=12 (md 면 14)
```

```ts
// (Skia) buildCatalogShapes — 같은 rule 테이블에서 visual 해소 (실측 dispatch)
const rule    = resolveSkiaRule("Button");                       // = COMPONENT_RULES_TABLE.Button
const visual  = resolveSkiaVisualRule("Button", "accent");       // variants.accent 투영
const shapes  = buildCatalogShapes(visual, specProps, rule.sizes.sm, "default");
// shapes:
//  [{ id:"bg", type:"roundRect", radius:{radius.sm}, fill:"{color.accent}", fillAlpha:1 },
//   { type:"border", target:"bg", color:"{color.accent}", ... },
//   { type:"text", text:"저장", fontSize:12, fill:"{color.on-accent}", align:"center", baseline:"middle" }]
//   ↑ sm → fontSize 12 (text-xs). md 면 14 (text-sm).
```

대칭의 본질: **DOM 의 `background:var(--accent)` 와 Skia 의 `fill:"{color.accent}"` 가 같은 토큰**(`{color.accent}`→`--accent`)을 가리킨다. fontSize 도 양쪽 같은 size rule(`sm→{typography.text-xs}=12`). "구현 방법"(CSS box vs roundRect shape)은 다르되 **시각 결과 동일**. (단, §1.3 대로 DOM 의 토큰값은 build-time 으로 정합된 `spec.sizes` 에서, Skia 는 generated table 에서 온다 — 값은 같으나 런타임 경로는 다름.)

#### 2.5 Properties Panel 노출 필드 (실측 `buildInspectorFields`)

`buildInspectorFields("Button", buttonBinding.props.accepts, theme)` → section 별 그룹 (삽입 순서 보존):

| section | 필드 (kind) | 옵션 source |
| --- | --- | --- |
| content | Text (string) | — |
| appearance | Variant (variant) / Size (size) / Fill Style (fillStyle) | variant·size → `theme.resolveDimensionOptions("Button", key)` (rule.variants/sizes keys) · fillStyle → `contract.options` 고정 |
| state | Type (enum) / Pending (boolean) / Disabled (boolean) | enum → `contract.options` |

컴포넌트당 `SectionDef`/`SpecField` 분기 0 — generic Inspector 가 `accepts` 만으로 패널을 그린다.

#### 2.6 "아이콘 붙은 Button" = reusable 조합 문서 (코드 정의 0, **현재 catalog 미등록**)

leaf Button 의 `accepts` 에는 `iconName` 이 **없다.** Pencil format 실측(`docs/migrations/shadcn-design-system.json` 의 `Button/Secondary` reusable, id `e8v1X`)이 모델을 보여준다 — 아이콘 Button 은 **reusable frame**:

```jsonc
// reusable frame = 컴포넌트 "정의" (코드 아님, 데이터). [shadcn json 실측 — composition 미등록]
{
  "id":"e8v1X", "type":"frame", "reusable":true, "name":"Button/Secondary",
  "layout":"horizontal",            // RAC 가 아니라 frame auto-layout (flex)
  "alignItems":"center", "justifyContent":"center", "gap":6, "padding":[8,16],
  "fill":"$--secondary", "cornerRadius":6,
  "children":[
    { "id":"soROh", "type":"frame", "width":20, "height":20, "layout":"none",
      "children":[
        { "id":"SlKX1", "type":"icon_font", "iconFontFamily":"lucide",
          "iconFontName":"plus", "width":16, "height":16, "fill":"$--secondary-foreground" } ] },
    { "id":"Tr3Fv", "type":"text", "content":"Button", "fontSize":14, "fontWeight":"500",
      "fill":"$--secondary-foreground", "textAlign":"center" }
  ]
}
```

catalog 등록 — **검증 결과 현재 미등록 (가정법으로만 제시)**:

```ts
// ⚠️ 현재 composition catalog 에는 reusable entry 0건 (실측: componentCatalog.ts 에
//   'kind: "reusable"' 은 파일 헤더 주석 1곳에만 등장, 실제 등록 0 — "family ① 없음").
//   reusableId "e8v1X" 는 shadcn json 의 노드 id 이지 composition 에 등록된 id 가 아니다.
//   아래는 "reusable frame 으로 표현한다면 이런 모양" 이라는 *모델 제시* — 등록된 사실 아님.
const HYPOTHETICAL_ICON_BUTTON_ENTRY = {
  kind: "reusable", type: "IconButton", family: "primitives", cutover: "catalog",
  reusableId: "<canonical reusable frame id — 미발급>",
  panel: { category:"buttons", label:"icon button", icon:"Plus", placeable:true },
} as const;
```

만약 등록된다면, 인스턴스는 `{type:"ref", ref:"<reusableId>", x, y}` 한 노드. 텍스트/아이콘만 바꾸려면 `descendants` patch:
```jsonc
{ "id":"i7","type":"ref","ref":"<reusableId>","x":40,"y":80,
  "descendants": { "Tr3Fv": { "content":"삭제" }, "SlKX1": { "iconFontName":"trash" } } }
```

→ **모델상 분류는 분명하다**: leaf Button(RAC `<button>`, binding) ↔ 아이콘 Button(frame+icon_font+text, reusable 데이터). "아이콘을 Button binding 에 번들" 하면 N++ 복제(모든 RAC primitive 가 자기 아이콘 필드를 갖게 됨)라서 금지된다. (검증자 지적 5 수용: 미등록 사실을 가정법으로 명시.)

---

### 3. Checkbox — indicator 가 있는 leaf primitive (`skiaPrimitive`)

#### 3.1 분류: **leaf primitive (단, indicator 는 box+text 로 표현 불가)**

근거: RAC `<Checkbox>` 1:1 컨트롤러. 하지만 시각에 **체크 SVG indicator** 가 있다 — `roundRect + checkmark line` 은 보편 box+text 가 아니다. 그래서 `skiaPrimitive:"checkbox"` draw module 로 분리한다 (실측: `Checkbox.binding.ts:61`). label 은 자식 Label Element(canonical children)가 담당. RAC 원본의 `{isIndeterminate}` render-prop 이 핵심:

```tsx
// packages/react-aria-starter/src/Checkbox.tsx (실측)
<AriaCheckbox {...props}>
  {({ isIndeterminate }) => (<>
    <div className="indicator">
      <svg viewBox="0 0 18 18" aria-hidden>
        {isIndeterminate ? <rect x={1} y={7.5} width={16} height={3} />
                         : <polyline points="2 9 7 14 16 4" />}
      </svg>
    </div>
    {children}
  </>)}
</AriaCheckbox>
```

→ DOM 은 RAC render-prop 이 `isIndeterminate` 분기를 자동 처리. Skia 는 같은 분기를 `skiaPrimitive` draw fn 안에서 재현한다 (대칭).

#### 3.2 PrimitiveBinding 전체 (실측 `Checkbox.binding.ts`)

```ts
export const checkboxBinding: PrimitiveBinding = {
  source: { kind: "rac", package: "react-aria-components",
            importPath: "react-aria-components", component: "Checkbox" },
  rac: {
    primitive: "Checkbox",
    parts: ["checkbox","indicator","label"],
    slots: [],
    states: ["isSelected","isIndeterminate","isDisabled","isInvalid"],
    renderProps: ["isSelected","isIndeterminate","isDisabled","isInvalid"],
    dataAttributes: ["data-selected","data-indeterminate","data-disabled","data-invalid"],
  },
  props: {
    accepts: {
      children:        { kind:"string",  label:"Label",         section:"content" },
      variant:         { kind:"variant", label:"Variant",       section:"appearance", default:"default" },
      size:            { kind:"size",    label:"Size",          section:"appearance", default:"md" },
      isSelected:      { kind:"boolean", label:"Selected",      section:"state" },
      isIndeterminate: { kind:"boolean", label:"Indeterminate", section:"state" },
      isDisabled:      { kind:"boolean", label:"Disabled",      section:"state" },
      isInvalid:       { kind:"boolean", label:"Invalid",       section:"state" },
    },
    toRacProps: "default",
  },
  skiaPrimitive: "checkbox",   // ← box+checkmark 는 box+text 가 아니므로 draw module 로 분리
};
```

#### 3.3 props → RAC props 투영

```jsonc
{ "id":"cb1","type":"Checkbox","props":{ "children":"동의","size":"md","isSelected":true } }
```
```ts
toRacProps(node, checkboxBinding) === {
  children:"동의",
  "data-size":"md",
  "data-variant":"default",   // 생략됐으나 default emit
  isSelected:true,            // boolean kind → RAC prop 직행 (data-* 아님, RAC 가 data-selected 자동 emit)
}
```
주의: `isSelected` 는 `kind:"boolean"` 이라 **RAC prop 으로 직행**한다. RAC `<Checkbox isSelected>` 가 내부적으로 `data-selected` 를 DOM 에 emit (D1 권위). 우리는 `data-selected` 를 수동 작성하지 않는다 — RAC 가 한다.

#### 3.4 DOM ↔ Skia 같은 시각 (variant 명시)

검증 결과 **Checkbox `default` variant 의 selected 색은 `{color.neutral}`** 이다 (실측: `COMPONENT_RULES_TABLE["Checkbox"].variants.default.fill.default.selected === "{color.neutral}"`, `colors.selectedBorder === "{color.neutral}"`). `{color.accent}` 는 **`emphasized` variant** 의 selected 색이다 (`variants.emphasized.fill.default.selected === "{color.accent}"`). 그래서 accent 강조 예시는 **`variant:"emphasized"`** 를 명시해 든다. (검증자 지적 4 수용.)

```tsx
// (DOM) variant="emphasized" 노드 — RAC 가 indicator SVG + data-selected 자동. theme CSS 가 색:
//   [data-variant="emphasized"][data-selected] .indicator { background:var(--accent); border-color:var(--accent) }
//   .indicator svg { stroke:var(--fg-on-accent) }  ← checkmark
<RAC.Checkbox {...toRacProps(emphasizedSelectedNode, checkboxBinding)}>{/* RAC render-prop SVG */}</RAC.Checkbox>
```

```ts
// (Skia) skiaPrimitive "checkbox" draw fn (실측 skiaPrimitives.ts::checkbox)
const visual = resolveSkiaVisualRule("Checkbox", "emphasized");  // variants.emphasized
const shapes = SKIA_PRIMITIVES.checkbox({ props:{isSelected:true}, size: rule.sizes.md, visual, style });
// isSelected=true →
//  [{ id:"box", type:"roundRect", width:20, height:20, radius:4, fill: visual.fill.default.selected },  // {color.accent} (emphasized)
//   { type:"border", target:"box", color: visual.selectedBorder },                                      // {color.accent} (emphasized)
//   { type:"line", x1..y2, stroke:"{color.white}", strokeWidth:2.5 },   // checkmark ＼
//   { type:"line", x1..y2, stroke:"{color.white}", strokeWidth:2.5 }]   // checkmark ／
// isIndeterminate=true → 가로 line 1개 (RAC 의 <rect> 와 동형 시각)
//
// 비교: variant="default" 였다면 selected fill = {color.neutral}, selectedBorder = {color.neutral}.
```

대칭: emphasized variant 기준 DOM `.indicator background:var(--accent)` ↔ Skia `box.fill:{color.accent}` (둘 다 selected 시 같은 토큰). default variant 였다면 양쪽 모두 `{color.neutral}`. checkmark 의 `stroke:var(--fg-on-accent)`/`{color.white}` 도 같은 의미. label "동의" 는 canonical 자식 Label Element 가 양쪽에서 별도 렌더(중복 방지 — checkbox draw fn 은 label 을 안 그린다).

#### 3.5 Panel 노출 필드

| section | 필드 |
| --- | --- |
| content | Label (string) |
| appearance | Variant (variant) / Size (size) |
| state | Selected / Indeterminate / Disabled / Invalid (boolean ×4) |

#### 3.6 theme token 소비 (정정: md→16)

검증 결과 **Checkbox `sizes.md.fontSize === "{typography.text-base}"` → 16** 이다 (실측). label fontSize 매핑은: `sm → {typography.text-sm} = 14`, `md → {typography.text-base} = 16`, `lg → {typography.text-lg} = 18`. (검증자 지적 1·4 수용: `size=md → text-sm → 14` 는 거짓.) indicator 픽셀(`boxSize`)은 size rule 의 indicator 메타가 담당. variant 색은 §3.4 대로 default=`{color.neutral}` / emphasized=`{color.accent}`.

---

### 4. ListBox(List) — collection primitive (virtualization 대상)

#### 4.1 분류: **collection primitive (`source.kind:"internal"` wrapper + 외부 데이터)**

근거: RAC Collections 원리 — items 데이터 + 렌더 함수 분리. items 는 props 가 아니라 **`collections` root** (`useCollectionData`, ADR-132)에서 온다. RAC raw 가 아니라 composition wrapper 가 D1 담당. starter 원본의 `isSelected→<Check/>` template 이 정본:

```tsx
// RAC starter 패턴 (실측 ListBox.tsx — DropdownItem)
export function DropdownItem(props: ListBoxItemProps) {
  return (
    <ListBoxItem {...props} className="dropdown-item">
      {composeRenderProps(props.children, (children,{isSelected}) => (<>
        {isSelected && <Check />}
        {typeof children === 'string' ? <Text slot="label">{children}</Text> : children}
      </>))}
    </ListBoxItem>
  );
}
```

→ `isSelected→<Check/>` render-prop 이 RAC 원본 그대로. 우리 wrapper 가 이 template 을 내장한다. (단 starter `ListBox` export 는 `<AriaListBox>` 단순 래퍼이고 **Virtualizer wrapper 가 없다** — §4.4 참조.)

#### 4.2 PrimitiveBinding (실측 `ListBox.binding.ts`) — `source.kind:"internal"`

```ts
export const listBoxBinding: PrimitiveBinding = {
  source: { kind: "internal", renderer: "listbox" },   // RAC raw 우회 — wrapper 가 합성
  props: {
    accepts: {
      dataBinding: { kind:"binding", label:"Data", section:"content" },  // ← collections root 참조
      variant:     { kind:"variant", label:"Variant", section:"appearance", default:"default" },
      size:        { kind:"size",    label:"Size",    section:"appearance", default:"md" },
      selectionMode: { kind:"enum", label:"Selection Mode", section:"state", default:"single",
        options:[{value:"none",label:"None"},{value:"single",label:"Single"},{value:"multiple",label:"Multiple"}] },
      isDisabled:  { kind:"boolean", label:"Disabled", section:"state" },
    },
    toRacProps: "default",
  },
  // items 순회 렌더 → Skia generic(box+text 단일) 미지원 → catalog 에서 skiaLegacy:true (family ④)
};
```

핵심: `dataBinding` 은 `kind:"binding"` — **items 배열을 binding 이 들고 있지 않다.** 노드 props 의 `dataBinding` 이 `collections[id]` 를 가리키고, wrapper 가 `useCollectionData` 로 read.

#### 4.3 canonical 노드 + 데이터 + props 투영

```jsonc
// UI 노드 (얇다 — items 없음)
{ "id":"lb1","type":"ListBox",
  "props":{ "dataBinding":"users","size":"md","selectionMode":"single" } }

// collections root (별도 SSOT, ADR-132)
"collections": { "users": { "source":"static",
  "items":[ {"id":"u1","name":"김"}, {"id":"u2","name":"이"}, /* ...10000 rows */ ] } }
```
```ts
// 투영: dataBinding/selectionMode/isDisabled → RAC props 직행, size/variant → data-*
toRacProps(node, listBoxBinding) === {
  // dataBinding 은 wrapper 가 useCollectionData 입력으로만 사용 (RAC ListBox 직접 prop 아님)
  selectionMode:"single",
  "data-size":"md", "data-variant":"default",
}
```

#### 4.4 DOM ↔ Skia + **virtualization** (정정: 단일화 미완 + Virtualizer 명시 필요)

```tsx
// (DOM) internal wrapper — useCollectionData 로 items 채우고 RAC Collection 합성
function ListBoxRenderer({ node }) {
  // useCollectionData: dataBinding | datatableId 등 다중 입력. ADR-132 read 경유이나
  //   내부적으로 isCanvasContext 분기(canvasDataTables ↔ builderDataTables) + "Phase 3 통합 예정"
  //   주석(실측 line 200) → 완전 단일 진입점은 미완. 결과는 { data, loading, error, ... }.
  const { data: items } = useCollectionData({ dataBinding: node.props.dataBinding, componentName: "ListBox" });

  // ⚠️ DOM viewport culling 은 자동이 아니다 — RAC <Virtualizer> 명시 wrapping 필요.
  //   starter ListBox.tsx 는 <AriaListBox> 단순 래퍼라 Virtualizer 가 없다(실측). culling 을
  //   원하면 아래처럼 <Virtualizer layout={...}> 로 감싸야 한다. (현 wrapper 적용 여부: 검증 필요)
  return (
    <Virtualizer layout={new ListLayout({ rowHeight: 32 })}>
      <RAC.ListBox {...toRacProps(node, listBoxBinding)} items={items}>
        {(item) => (
          <RAC.ListBoxItem id={item.id} textValue={item.name}>
            {({isSelected}) => <>{isSelected && <Check/>}<Text slot="label">{item.name}</Text></>}
          </RAC.ListBoxItem>
        )}
      </RAC.ListBox>
    </Virtualizer>
  );
  // Virtualizer + ListLayout 가 있을 때만 viewport 밖 item DOM 미생성.
}
```

```ts
// (Skia) 현재 skiaLegacy:true → legacy render.shapes 가 items 순회 렌더 (실측 catalog family ④ 주석)
//   "Skia generic 렌더러가 items 배열 순회 multi-item 렌더를 아직 못 그린다 (전 family 후 일괄)"
//
// 목표 Skia 경로 (items generic 메커니즘) — 본 설계 영역의 핵심 *제안* (미구현):
//   collection 을 "item 마다 1 Skia child node" 로 풀면 generic box+text 가 재사용된다.
//   각 visible item = canonical 자식 element 처럼 buildCatalogShapes(itemVisual, itemProps, size) 1회.
//   여기에 Viewport Culling 을 얹는다:
function buildListBoxSkiaNodes(node, items, viewport, rowHeight, selectedId) {  // 제안
  const firstVisible = Math.floor(viewport.top / rowHeight);
  const lastVisible  = Math.ceil(viewport.bottom / rowHeight);
  const nodes: SkiaNodeData[] = [];
  for (let i = firstVisible; i <= lastVisible && i < items.length; i++) {  // ← 보이는 영역만
    const item = items[i];
    const itemVisual = resolveSkiaVisualRule("ListBoxItem", "default");
    const shapes = buildCatalogShapes(itemVisual,
      { children: item.name, isSelected: item.id === selectedId },          // selected→fill.selected
      rule.sizes.md, "default");
    nodes.push({ y: i * rowHeight, height: rowHeight, shapes });            // 절대 y 배치
  }
  return nodes;   // 10000 rows → Skia 는 viewport 분량(~20개)만 실체화 → 60fps (제안 목표)
}
```

대칭(목표): DOM `<Virtualizer>` culling ↔ Skia firstVisible/lastVisible culling. 둘 다 "보이는 item 만 실체화". selected item 의 Check 아이콘(DOM `<Check/>`) ↔ Skia `isSelected→buildCatalogShapes 가 fill.selected + (별도 icon_font 자식)`. 이것이 §원칙 2 "List/Table/Grid 반복 컬렉션은 Viewport Culling + Virtualization" 의 양쪽 구현 방향이다. (검증자 지적 6 수용: DOM culling 은 Virtualizer 명시 wrapping 시 + wrapper 적용 검증 필요, Skia culling 은 제안 표기 유지, useCollectionData 다중 입력/Phase3 미완 명시.)

#### 4.5 Panel 노출 필드

| section | 필드 |
| --- | --- |
| content | Data (binding) — collections 선택 드롭다운 |
| appearance | Variant / Size |
| state | Selection Mode (enum) / Disabled (boolean) |

#### 4.6 theme token 소비

`size="md"` → item fontSize 는 `ListBoxItem`/`ListBox` 의 size rule (rule table 의 해당 `sizes.md.fontSize` TokenRef) 를 따른다. rowHeight = `rule.sizes.md.height`. 모든 item 이 같은 size rule 공유. (구체 토큰값은 컴포넌트별 rule 테이블 grep 으로 확정 — Button/Checkbox 처럼 단정하지 않음.)

---

### 5. Table — 가장 복잡한 collection (2D, virtualization)

#### 5.1 분류: **collection primitive (`internal` wrapper, 2D)**

근거: RAC Table = `TableHeader`/`Column`/`Row`/`Cell` + `<Collection items={columns}>` 합성. `useTableOptions()` 가 selection/drag 컬럼 자동 삽입. rows 데이터는 `collections` root. RAC 원본(실측 Table.tsx)이 2D 합성의 정본:

```tsx
// 실측 — selectionBehavior:"toggle" → Checkbox slot="selection" 자동 컬럼
export function TableHeader({columns, children, ...p}) {
  let {selectionBehavior, selectionMode, allowsDragging} = useTableOptions();
  return (
    <AriaTableHeader {...p}>
      {allowsDragging && <AriaColumn width={20} />}
      {selectionBehavior === 'toggle' &&
        <AriaColumn width={32}>{selectionMode==='multiple' && <Checkbox slot="selection"/>}</AriaColumn>}
      <Collection items={columns}>{children}</Collection>
    </AriaTableHeader>
  );
}
export function Row({columns, children, ...p}) {
  let {selectionBehavior, allowsDragging} = useTableOptions();
  return (<AriaRow {...p}>
    {allowsDragging && <Cell><Button slot="drag"><GripVertical/></Button></Cell>}
    {selectionBehavior === 'toggle' && <Cell><Checkbox slot="selection"/></Cell>}
    <Collection items={columns}>{children}</Collection>
  </AriaRow>);
}
```

→ `slot="selection"`/`slot="drag"` 가 RAC 의 D1 slot 메커니즘. 우리는 이걸 재작성하지 않고 wrapper 로 감싼다.

#### 5.2 PrimitiveBinding (실측 `Table.binding.ts`)

```ts
export const tableBinding: PrimitiveBinding = {
  source: { kind: "internal", renderer: "table" },   // RAC Table 2D 합성을 wrapper 가 담당
  props: {
    accepts: {
      dataBinding: { kind:"binding", label:"Data", section:"content" },  // rows
      variant:     { kind:"variant", label:"Variant", section:"appearance", default:"default" },
      size:        { kind:"size",    label:"Size",    section:"appearance", default:"md" },
      selectionMode: { kind:"enum", label:"Selection Mode", section:"state", default:"none",
        options:[{value:"none",label:"None"},{value:"single",label:"Single"},{value:"multiple",label:"Multiple"}] },
    },
    toRacProps: "default",
  },
  // 2D table 렌더 → Skia generic 미지원 → catalog skiaLegacy:true (family ⑤ tree-table)
};
```

`columns` 는 `accepts` 에 없다 — columns 도 `dataBinding`(`collections[id].columns`) 의 일부거나 columnMapping 데이터. "데이터-시각 결합형" 이므로 binding 에 컬럼 픽셀을 안 둔다.

#### 5.3 canonical 노드 + 데이터

```jsonc
{ "id":"tb1","type":"Table",
  "props":{ "dataBinding":"orders","size":"md","selectionMode":"multiple" } }

"collections":{ "orders":{ "source":"api", "endpoint":"orders-list",
  "columns":[ {"id":"name","label":"이름","width":200},
              {"id":"amount","label":"금액","width":120,"align":"end"} ],
  "runtimeData":[ /* useAsyncList 로 무한 로드된 rows */ ] } }
```
```ts
toRacProps(node, tableBinding) === {
  selectionMode:"multiple",
  "data-size":"md", "data-variant":"default",
}
```

#### 5.4 DOM ↔ Skia + virtualization

```tsx
// (DOM) internal wrapper — RAC Table 합성, columns/rows 데이터 주입
function TableRenderer({ node }) {
  // useCollectionData 다중 입력(dataBinding|datatableId), isCanvasContext 분기(Phase 3 통합 진행 중).
  const { data: rows, schema } = useCollectionData({ dataBinding: node.props.dataBinding, componentName: "Table" });
  const columns = node.props.columns ?? schema; // columns 는 데이터/스키마에서
  return (
    <Virtualizer layout={new TableLayout({ rowHeight: 36 })}>  {/* culling 은 Virtualizer 명시 시 */}
      <RAC.Table {...toRacProps(node, tableBinding)} selectionMode={node.props.selectionMode}>
        <RAC.TableHeader columns={columns}>
          {(col) => <RAC.Column id={col.id} width={col.width} isRowHeader={col.id==='name'}>{col.label}</RAC.Column>}
        </RAC.TableHeader>
        <RAC.TableBody items={rows}>
          {(row) => (
            <RAC.Row columns={columns}>
              {(col) => <RAC.Cell>{row[col.id]}</RAC.Cell>}
            </RAC.Row>
          )}
        </RAC.TableBody>
      </RAC.Table>
    </Virtualizer>
  );
  // selectionMode="multiple" → useTableOptions 가 Checkbox slot="selection" 컬럼 자동
  // Virtualizer + TableLayout 가 있을 때만 viewport 밖 Row DOM 미생성 (자동 아님).
}
```

```ts
// (Skia) 목표 *제안* (미구현) — 2D culling. row(수직) × column(수평) 둘 다 viewport 교차분만 cell shape.
function buildTableSkiaNodes(node, rows, columns, viewport, rowH) {  // 제안
  const colX = cumulativeX(columns);                      // 각 col 좌표 누적
  const firstRow = Math.floor(viewport.top / rowH), lastRow = Math.ceil(viewport.bottom / rowH);
  const visCols = columns.filter((c,i) => colX[i+1] > viewport.left && colX[i] < viewport.right);  // 수평 culling
  const nodes: SkiaNodeData[] = [];
  for (let r = firstRow; r <= lastRow && r < rows.length; r++) {       // 수직 culling
    for (const col of visCols) {
      const cellVisual = resolveSkiaVisualRule("Cell", "default");
      const shapes = buildCatalogShapes(cellVisual,
        { children: String(rows[r][col.id]), style:{ textAlign: col.align ?? "left" } },
        rule.sizes.md, "default");
      nodes.push({ x: colX[col.index], y: r * rowH, width: col.width, height: rowH, shapes });
    }
  }
  return nodes;   // 10000행 × 20열 = 200k cell → 보이는 ~20행 × ~8열 = 160 cell 만 → 60fps (제안 목표)
}
```

대칭(목표): DOM RAC TableLayout virtualization(Virtualizer 명시 시) ↔ Skia 2D culling(row + column). header 의 selection Checkbox(DOM `<Checkbox slot="selection"/>`) ↔ Skia `skiaPrimitive:"checkbox"` 재사용(§3 의 draw module). column header 텍스트(`col.label`) ↔ Skia cell text. **Table 은 `skiaLegacy:true` (실측 family ⑤)** — DOM/Inspector 는 catalog generic, Skia 만 legacy render.shapes(props.rows/columns 2D grid 직접 계산). 위 `buildTableSkiaNodes` 가 그 잔존을 해소할 generic backend 제안(R4 HIGH, Skia generic backend 선행 필요).

#### 5.5 Panel 노출 필드

| section | 필드 |
| --- | --- |
| content | Data (binding) |
| appearance | Variant / Size |
| state | Selection Mode (enum) |

columns/정렬/너비는 데이터(`collections[id].columns`) 편집 UI(DataTablePanel)에서 — Properties Panel 의 generic 필드가 아니라 데이터 편집기. selectionBehavior/allowsDragging 는 `selectionMode` enum + 별도 boolean 으로 확장 가능.

#### 5.6 theme token 소비

`size="md"` → cell fontSize 는 Table size rule 의 `sizes.md.fontSize` TokenRef, rowHeight `rule.sizes.md.height`. (Layer B/ADR-907 에 따라 root container spacing 은 `element.props.style` 경로, cell-level `size.paddingX` 는 유지.) 구체 토큰값은 Table rule 테이블 grep 으로 확정.

---

### 6. Dropdown(Select) — 합성 collection (Button + Popover + ListBox)

#### 6.1 분류: **collection primitive (`internal` wrapper — 다중 RAC 합성)**

근거: RAC Select = `Label + Button(SelectValue+Chevron) + Popover + ListBox` 합성. overlay(Popover) 처리 포함. RAC 원본(실측 Select.tsx)이 합성 구조의 정본:

```tsx
// 실측 — Select 내부에 Button/SelectValue/Popover/ListBox 합성
<AriaSelect {...props}>
  {label && <Label>{label}</Label>}
  <Button><SelectValue /><ChevronDown /></Button>     {/* 닫힌 상태 trigger */}
  {description && <Description>{description}</Description>}
  <FieldError>{errorMessage}</FieldError>
  <Popover hideArrow className="select-popover">       {/* overlay */}
    <SelectListBox items={items}>{children}</SelectListBox>  {/* DropdownListBox */}
  </Popover>
</AriaSelect>
```

→ `<SelectValue/>` 가 선택값 표시, `<Popover>` 가 overlay, 내부 `<ListBox>` 가 §4 의 collection. **Select 는 4개 RAC primitive 의 합성** 이지만, 사용자에게는 1개 컴포넌트. binding 의 `internal` wrapper 가 이 합성을 캡슐화.

#### 6.2 PrimitiveBinding (실측 `Select.binding.ts`)

```ts
export const selectBinding: PrimitiveBinding = {
  source: { kind: "internal", renderer: "select" },   // Button+Popover+ListBox 합성 wrapper
  props: {
    accepts: {
      dataBinding: { kind:"binding", label:"Data",        section:"content" },  // 옵션 items
      label:       { kind:"string",  label:"Label",       section:"content" },
      description: { kind:"string",  label:"Description", section:"content" },
      placeholder: { kind:"string",  label:"Placeholder", section:"content" },
      size:        { kind:"size",    label:"Size",        section:"appearance", default:"md" },
      selectionMode: { kind:"enum", label:"Selection Mode", section:"state", default:"single",
        options:[{value:"single",label:"Single"},{value:"multiple",label:"Multiple"}] },
      isDisabled:  { kind:"boolean", label:"Disabled", section:"state" },
    },
    toRacProps: "default",
  },
};
```

`variant` 가 없는 것에 주목 — Select 의 시각 변형은 내부 trigger Button 의 variant 로 흡수되거나 size 만. items 는 `dataBinding`.

#### 6.3 canonical 합성 구조 표현

Select 의 합성은 **wrapper 코드** 안에 있고 canonical 에는 얇은 1 노드로 표현된다 (Pencil format 의 reusable 과 달리, Select 는 RAC 합성이라 leaf 처럼 1 노드):

```jsonc
{ "id":"sel1","type":"Select",
  "props":{ "dataBinding":"countries","label":"국가","placeholder":"선택...",
            "size":"md","selectionMode":"single" } }

"collections":{ "countries":{ "source":"static",
  "items":[ {"id":"kr","name":"한국"}, {"id":"jp","name":"일본"} ] } }
```
```ts
toRacProps(node, selectBinding) === {
  label:"국가", placeholder:"선택...",
  selectionMode:"single",
  "data-size":"md",
  // dataBinding 은 wrapper 가 useCollectionData 입력으로만 사용
}
```

(만약 사용자가 Select 전체를 reusable 로 묶고 싶다면 — §2.6 처럼 reusable frame 으로 승격 가능. 단 현재 catalog 에 reusable entry 0건 — 미등록.)

#### 6.4 DOM ↔ Skia + overlay 처리

```tsx
// (DOM) internal "select" wrapper — RAC 합성 재현 + useCollectionData
function SelectRenderer({ node }) {
  const { data: items } = useCollectionData({ dataBinding: node.props.dataBinding, componentName: "Select" });
  const p = toRacProps(node, selectBinding);
  return (
    <RAC.Select {...p} selectionMode={node.props.selectionMode}>
      {node.props.label && <RAC.Label>{node.props.label}</RAC.Label>}
      <RAC.Button><RAC.SelectValue>{node.props.placeholder}</RAC.SelectValue><ChevronDown/></RAC.Button>
      <RAC.Popover className="select-popover">
        <RAC.ListBox items={items}>
          {(item) => <RAC.ListBoxItem id={item.id}>{item.name}</RAC.ListBoxItem>}
        </RAC.ListBox>
      </RAC.Popover>
    </RAC.Select>
  );
}
```

```ts
// (Skia) — 빌더 캔버스에서는 "닫힌 trigger" 만 그린다 (Popover overlay 는 portal, 캔버스 밖)
//   trigger = Button(SelectValue text + Chevron icon). 둘 다 buildCatalogShapes / skiaPrimitive 재사용:
const triggerVisual = resolveSkiaVisualRule("Select", "default");
const triggerShapes = buildCatalogShapes(triggerVisual,
  { children: selectedLabel ?? node.props.placeholder, style:{ textAlign:"left" } },
  rule.sizes.md, "default");
// + chevron: SKIA_PRIMITIVES.icon_font({ props:{iconName:"chevron-down"}, size, visual, style })
//
// 현재 skiaLegacy:true (실측 family ④) — DOM/Inspector 는 catalog generic, Skia 만 legacy render.shapes.
// 열린 Popover ListBox 는 §4 의 ListBox virtualization *제안* 경로 재사용 (overlay 는 Taffy 제외, Preview Popover).
```

대칭: DOM 닫힌 trigger(`<Button><SelectValue/><ChevronDown/></Button>`) ↔ Skia trigger box+text+chevron icon. 열린 옵션 리스트는 §4 ListBox 와 동일 경로(따라서 virtualization 제안도 그대로 상속). overlay 는 canvas-rendering.md §6 규칙대로 "Popover 자식은 Taffy 레이아웃 제외, Preview Popover 표시".

#### 6.5 Panel 노출 필드

| section | 필드 |
| --- | --- |
| content | Data (binding) / Label (string) / Description (string) / Placeholder (string) |
| appearance | Size (size) |
| state | Selection Mode (enum) / Disabled (boolean) |

#### 6.6 theme token 소비

`size="md"` → trigger fontSize 는 Select size rule 의 `sizes.md.fontSize`, chevron iconSize `rule.sizes.md.iconSize`. 옵션 item 도 같은 size rule. trigger ↔ 옵션 ↔ Skia ↔ DOM 모두 동일 size rule 공유 (구체값은 Select rule 테이블 grep 으로 확정).

---

### 7. 5개 종합 — 분류 매트릭스 + 대칭 요약 (정정판)

| 컴포넌트 | 분류 | source | skiaPrimitive | dataBinding | Skia 현 상태 (실측) | 합성 |
| --- | --- | --- | --- | --- | --- | --- |
| **Button** | leaf | `rac` Button | 없음(box+text) | 없음 | catalog generic | 단일 — 아이콘 붙으면 reusable frame(현 미등록)으로 분리 |
| **Checkbox** | leaf | `rac` Checkbox | `"checkbox"` | 없음 | catalog (draw module) | indicator=skiaPrimitive, label=자식 Element |
| **ListBox** | collection | `internal` listbox | 없음(items 순회) | `users` | skiaLegacy(family ④, 목표: item→node culling 제안) | wrapper 가 RAC Collection 합성 |
| **Table** | collection 2D | `internal` table | 없음(2D grid) | `orders` | skiaLegacy(family ⑤, 목표: 2D cell culling 제안) | Header/Column/Row/Cell + slot selection/drag |
| **Select** | collection 합성 | `internal` select | 없음 | `countries` | skiaLegacy(family ④) | Button+Popover+ListBox 4개 RAC 합성 |

**한 줄 SSOT 증명 (정정 — 실측 토큰값)**:
- **Button**: `size="md" → rule.sizes.md.fontSize = {typography.text-sm} → 14` (sm 이면 `{typography.text-xs}` → **12**).
- **Checkbox**: `size="md" → rule.sizes.md.fontSize = {typography.text-base} → 16` (sm 이면 `text-sm` → 14).
- 공통 메커니즘: `props.size → resolveComponentRule(type).sizes[size].fontSize → resolveToken(ref, theme) → 숫자`. 단 **소비처별 공급 경로 분리**: Skia/Panel 은 `resolveComponentRule`(generated table), CSS(`CSSGenerator`)는 `spec.sizes`/`spec.variants` 직접 — **build-time 정합으로 값은 같으나 동일 런타임 함수는 아님**(rule-table 단일화 ADR-142 진행 중). fontSize 토큰값 SSOT 는 `packages/specs/src/primitives/typography.ts`(module-level). **어느 컴포넌트도 자기만의 fontSize 를 코드에 적어두지 않는다.**

**RAC 접근성 철학 + Pencil format 철학 융합점**: D1(접근성 DOM/ARIA/키보드/slot)은 RAC primitive 가 100% 소유(우리는 `toRacProps` 로 투영만, ARIA 수동 작성 0). D3(시각)은 Pencil 의 "보편 속성 + 토큰 참조" 모델대로 rule 테이블 + tokens 에서 generic 해소. 조합은 Pencil 의 "reusable frame + ref + descendants" 데이터 메커니즘(§2.6 — 단 현재 catalog 미등록, 모델만 제시). 두 철학이 **D1=RAC / D3=Pencil-tokens / 조합=Pencil-data** 로 직교 분할된다.

**정정 후 핵심 정직성 추가**: (1) fontSize 숫자는 모두 실측 rule 테이블 grep 으로 확정 — 임의 가정 금지. (2) `resolveFontSize`/`doc.tokens` 같은 가짜 심볼 0개. (3) "단일 런타임 함수" 단정 → "build-time 정합된 두 공급처(generated table ↔ spec)" 로 완화. (4) Checkbox accent 예시는 `emphasized` variant 명시. (5) IconButton reusable 은 미등록 가정법. (6) DOM virtualization 은 RAC `<Virtualizer>` 명시 wrapping 필요(자동 아님) + `useCollectionData` 다중 입력/Phase3 통합 미완. Skia virtualization 은 미구현 제안.

---

<a id="영역-8"></a>

## ⑧ TypeScript 타입 정의 — RAC + Pencil 1차 원리 재유도 (정정판)

> **정정 요약**: 적대적 검증자의 12개 지적을 실측 재검증한 결과, **모두 정당한 지적으로 수용**한다. 일부는 검증자보다 더 정밀하게 정정한다(특히 #1). 본 정정판은 `docs/migrations/shadcn-design-system.json` 전수 walk + 현행 코드 grep 증거에 근거하며, 추측으로 채운 수치(`11 primitive`)와 현행과 정반대였던 wire 형태(stroke/padding/token), 평행 SSOT 재선언(Shape `kind`)을 제거한다.

---

### 0. 설계 출발점 — 두 외부 자산에서 백지 재유도

기존 `*.spec.ts`(컴포넌트당 정의 객체)와 cutover 전환기 어댑터를 출발점으로 삼지 않는다. **두 검증 자산**의 1차 원리만 사용한다.

| 출처 | 1차 원리 | 본 설계에 미치는 영향 |
| --- | --- | --- |
| **Pencil canonical format** (`docs/migrations/shadcn-design-system.json` **전수 walk 실측**, 87 컴포넌트) | **트리 노드 type 은 실측 8종 + 스펙상 확장 후보 3종** + 모든 노드가 같은 보편 속성 집합 + 컴포넌트화는 `reusable`/`ref`/`descendants` 데이터로 표현 | 그룹 A 노드 타입 전체 |
| **RAC starter** (`packages/react-aria-starter/src` 실측) | render-prop state 합성 + 시각 100% CSS 토큰(`data-*` 변형) + Collection 의 data/render 분리(`items` + 렌더 함수 → Node tree) | 그룹 B · D |

#### 0.1 — 노드 type 실측 정정 (검증자 #1 수용 + 정밀화)

원설계가 prose 로 선언한 "11 primitive(frame/text/ref/icon_font/path/ellipse/rectangle/line/image/color/shadow)" 수치는 **사용자 제약 prose 를 그대로 옮긴 것이며 실측 1차 원리가 아니었다**(추측 금지 위반). 전수 walk 로 트리 위치(`children[]` / `descendants` replace / 컴포넌트 root)와 속성 위치(`fill` / `effect` 객체)를 구분 집계한 결과:

```
TREE NODES (children / descendants / root 위치):
  frame 115 · text 63 · ref 57 · icon_font 24 · path 8 · ellipse 3 · rectangle 1 · line 1
  → 실측 트리 노드 type = 8종

PROPERTY-CONTEXT (트리 노드 아님):
  fill: { type:"color", ... }   7건  → Fill 객체 변형
  fill: { type:"image", url, ... } 1건 → Fill 객체 변형
  effect: { type:"shadow", ... } 13건 → effect 디스크립터
```

**결론 (검증자 #1 보다 정밀)**:
- **`CanonicalNode` discriminated union 멤버 = 실측 8종**: `FrameNode | TextNode | IconNode | PathNode | EllipseNode | RectangleNode | LineNode | RefNode`. `ImageNode` 를 1급 노드로 승격하지 않는다 — 실측상 `image` 는 0건 노드이고 100% `fill` 객체 변형이다.
- `color` / `image` 는 **Fill 객체 변형**(`{ type:"color", color, enabled }` / `{ type:"image", url, mode, enabled }`)으로 `Fill` union 에 흡수한다.
- `shadow` 는 **effect 디스크립터**(`{ type:"shadow", blur, color, offset:{x,y}, shadowType:"outer", spread? }`)로 `Effect` 타입에 흡수한다.
- 분류 기준 일관성 확보: **트리 위치에 출현하면 노드, 속성 위치에만 출현하면 속성 타입.** 원설계는 image 만 노드로, shadow/color 는 속성으로 처리해 기준이 갈렸다 — 본 정정은 셋 다 속성으로 통일.
- `'11종'` 수치를 본문 전체에서 제거하고 **"실측 8 트리 노드 + 스펙상 확장 후보 3(image/color/shadow — 단 본 데이터셋에선 전부 속성으로만 출현)"** 으로 정정한다. image/color/shadow 를 향후 1급 노드로 올린다면 별도 **검증 필요**(현 데이터셋에 노드 출현 0건).

이 두 원리에서 독립 유도해도 결론은 ADR-142(Accepted 2026-05-30)의 end-state 와 수렴한다. ADR-142 를 supersede 하지 않고 그 목표 상태를 외부 방법론 언어로 재서술한다.

**현행 코드베이스와의 핵심 정합/개선점**:

1. **명명 정합**: `CompositionDocument` / `CanonicalNode` / `RefNode` / `FrameNode` / `DescendantOverride` / `ResolvedNode` / `PrimitiveBinding` / `ComponentCatalogEntry` / `ComponentFamily` / `PropContract` / `InspectorFieldKind` 등 기존 식별자를 그대로 유지한다. import 경계가 깨지지 않는다.
2. **개선점 (1차 원리 정제)**: 현행 `CanonicalNode.type` 은 121-literal `ComponentTag` flat 문자열 + 시각/구조 props 를 `props?: Record<string, unknown>` generic bag 에 넣는다. Pencil 1차 원리는 8 트리 primitive discriminated union + 보편 속성을 노드 1급 필드로 둔다. 본 설계는 후자로 재유도하되 — **시각 variant 색상은 1급 `fill` 필드가 아니라 여전히 `ComponentRulesTable`(variant×state SSOT) 경유**(§A.0, 검증자 #7) — 두 모델의 마이그레이션 경로(§A.7)를 방향 명시(brand 가 아닌 schema-version discriminant)로 제시한다.

---

### A. Canonical Document 노드 (Pencil 1차 원리)

`packages/shared/src/types/canonical-node.types.ts` — 보편 속성(`BaseNode`) + 8 트리 primitive discriminated union.

#### A.0 — `fill` 1급 필드 ↔ `ComponentRulesTable` 경계 (검증자 #7 수용)

원설계가 시각 색상을 `BaseNode.fill` 1급 필드로 올린 것은, 현행 generic 렌더러(`buildCatalogShapes` → `resolveSkiaVisualRule`)가 `props.variant` 를 키로 `COMPONENT_RULES_TABLE[type].variants[variant]` 에서 **variant×state(hover/pressed/selected) 색상**을 lookup 하는 D3 SSOT 와 **이원화**된다. fill 을 노드에 직접 박으면 variant 기반 상태 색상 SSOT 가 우회되어 평행 SSOT 가 발생한다.

**경계 규칙 (정정)**:

| 노드 성격 | 색상 출처 | 근거 |
| --- | --- | --- |
| **leaf primitive (variant 보유: Button/Badge/ToggleButton 등)** | `props.variant` + `props.size` 키 → **`ComponentRulesTable` 경유** (현행 `resolveSkiaVisualRule` 유지) | variant×state 색상 SSOT 단일 진입점 보존 |
| **무-variant 시각 노드 (frame/rectangle/ellipse/line — 사용자가 직접 칠한 배경/도형)** | `BaseNode.fill` 1급 필드 직접 | Pencil 실측 `fill:"$--accent"` 가 정확히 이 케이스 |

즉 `BaseNode.fill` 은 **"이 노드 자체에 사용자가 부여한 직접 색"** 만 담고, **컴포넌트 variant 가 결정하는 상태별 색**은 `ComponentRulesTable` 이 단일 권위를 유지한다. generic 렌더러는 `entry.kind === "primitive" && binding 이 variant prop 노출` 이면 rules table 경유, 그 외 노드는 `fill` 직접 — 이 분기를 렌더러에 명시한다(아래 `FILL_SOURCE` 주석).

```ts
/**
 * @fileoverview Canonical Node Types — Pencil format 1차 원리 재유도.
 *
 * Pencil 실측(shadcn-design-system.json, 87 컴포넌트, 전수 walk): **트리 노드 type 은
 * 8종**(frame/text/ref/icon_font/path/ellipse/rectangle/line)이고, 모든 노드가
 * **같은 보편 속성 집합**(CSS 처럼)을 공유하며 값만 다르다. color/image/shadow 는
 * 트리 노드가 아니라 fill/effect 속성 객체로만 출현(노드 출현 0건).
 *
 * 코드베이스 정합: 식별자(CanonicalNode/FrameNode/RefNode/CompositionDocument/
 * DescendantOverride)는 현행 composition-document.types.ts 와 동일하게 유지한다.
 *
 * 개선점(1차 원리 정제): 현행은 `type: ComponentTag`(121-literal) + 시각/레이아웃을
 * `props: Record<string, unknown>` generic bag 에 넣는다. Pencil 원리는 8 primitive
 * union + 보편 속성 1급 필드. 단, **variant 색상은 1급 fill 이 아니라
 * ComponentRulesTable 경유**(§A.0). 마이그레이션 schema-version discriminant 는 §A.7.
 */

// ── 토큰 참조 primitive — 3-layer 명시 (검증자 #9 수용) ───────────────────

/**
 * Pencil **wire** 토큰 참조 — 실측: fill 값이 `"$--accent"` 문자열($-- prefix).
 *
 * **토큰 참조는 현행 코드에 3-layer 가 공존한다(grep 확인):**
 *   1. pencil wire        : `"$--accent"`  (TokenRefString, 본 타입 — .pen 직렬화 경계)
 *   2. canonical 내부      : `{ $var: "accent" }`  (현행 CanonicalTokenRef, 6건 실사용)
 *   3. spec build-time     : `"{color.accent}"`  (brace — resolveCanonicalToken 의
 *                            TOKEN_REF_PATTERN /^\{(\w+)\.(.+)\}$/ 가 받는 형식)
 *
 * 원설계는 (1)↔(2) 2-layer 매핑만 가정했으나 실측은 3-layer. 변환 책임은 §C.0.
 * **주의**: 현행 resolveCanonicalToken 은 (3) brace 형만 받는다 — 본 TokenRefString($--)
 * 와 직접 연결되지 않는다. 연결 모듈은 §C.0 의 normalizeTokenRef 가 담당(신규).
 */
export type TokenRefString = `$--${string}`;

/**
 * 색상 fill — 직접 hex/rgb 문자열 | 토큰 참조 | 그라디언트 | Pencil fill 객체 변형.
 * color/image 는 **노드가 아니라 fill 객체 변형**(검증자 #1 정밀화).
 */
export type Fill =
  | string // hex/rgb 직접
  | TokenRefString // "$--accent"
  | LinearGradient
  | RadialGradient
  | ColorFill // Pencil { type:"color", ... } 실측 7건
  | ImageFill; // Pencil { type:"image", ... } 실측 1건

/** Pencil fill 객체(색) — 실측: { type:"color", color:"$--white", enabled:false }. */
export interface ColorFill {
  type: "color";
  color: string | TokenRefString;
  enabled?: boolean;
}
/** Pencil fill 객체(이미지) — 실측: { type:"image", url:"", mode:"fill", enabled:true }. */
export interface ImageFill {
  type: "image";
  url: string;
  mode?: "fill" | "fit" | "tile" | "stretch";
  enabled?: boolean;
}

/**
 * stroke(테두리) — **Pencil 실측 wire 정합** (검증자 #2 수용).
 * 실측: { align:"inside", fill:"$--sidebar-border", thickness:{right:1} }
 *    또는 { align:"inside", thickness:1 }
 *
 * 원설계의 { color, width, style, sides } 는 실측과 정반대였다:
 *   - 색상 키 color → **fill**(Fill 타입)
 *   - 두께 키 width → **thickness**(number | 부분 객체)
 *   - **align** 필드 실측 존재(원설계 누락)
 *   - style(dashed/dotted) / sides(boolean per-side) 는 실측 근거 0건 → 검증 필요로 격리
 */
export interface Stroke {
  /** 실측 100% "inside". center/outside 는 스펙 추정 — 검증 필요. */
  align?: "inside" | "center" | "outside";
  fill?: Fill;
  /** 균일 두께(number) 또는 변별 두께(부분 객체, 실측 {right:1}). */
  thickness?: number | { top?: number; right?: number; bottom?: number; left?: number };
  /** ⚠ 검증 필요 — 실측 근거 0건. Pencil 스펙 확인 후 채택. 미검증 시 미사용. */
  style?: "solid" | "dashed" | "dotted";
}

/** 선형 그라디언트 — RAC/CSS `linear-gradient` 정합. */
export interface LinearGradient {
  kind: "linear";
  angle: number; // deg, 0=→
  stops: Array<{ offset: number; color: string | TokenRefString }>;
}
/** 방사형 그라디언트. */
export interface RadialGradient {
  kind: "radial";
  stops: Array<{ offset: number; color: string | TokenRefString }>;
}

/**
 * effect(그림자 등) — **Pencil 실측 wire 정합** (검증자 #1 정밀화).
 * 실측: { type:"shadow", blur:1.75, color:"#0000000d", offset:{x:0,y:1},
 *        shadowType:"outer", spread:-1 }
 * effect 는 트리 노드가 아니라 `effect` 키 배열의 디스크립터.
 * 원설계 Shadow.offsetX/offsetY → 실측은 offset:{x,y}. shadowType "drop/inner"
 * → 실측 "outer"(+ 추정 "inner").
 */
export interface ShadowEffect {
  type: "shadow";
  color: string | TokenRefString;
  /** 실측 wire: { x, y }. */
  offset: { x: number; y: number };
  blur: number;
  spread?: number;
  /** 실측 "outer". "inner" 는 스펙 추정 — 검증 필요. */
  shadowType?: "outer" | "inner";
}
export type Effect = ShadowEffect; // blur/기타 effect 는 확장 후보

// ── 치수 union — Pencil "fill_container"/"hug"/숫자 정합 ───────────────────

/**
 * 치수 값 — Pencil 실측: width 가 `"fill_container"`(56) | `"fill_container(480)"`(max
 * 동반, 실측 다수) | `"fill_container(0)"`(1건, max=0 특수값) | 숫자 | `"hug"`.
 *
 * **fill_container(0) 특수값 (검증자 #3 수용)**: 실측 1건. `${number}` 가 0 을 허용하므로
 * 타입은 OK 이나 **의미가 미검증**이다. 후보 해석: (a) max=0=상한 없음(=fill_container
 * 동일) (b) min=0 의도 (c) Pencil 내부 특수값. → **검증 필요**: parsePadding/parseDimension
 * 경계에서 0 을 어떻게 정규화하는지 Pencil 스펙/현행 파서 확인 후 확정.
 */
export type Dimension =
  | number
  | "hug"
  | "fill_container"
  | `fill_container(${number})`; // 괄호 안 = max 상한 (단 0 의미 검증 필요)

// ── 레이아웃 — Pencil layout("vertical"/"horizontal"/"none") 정합 ─────────

export type LayoutMode = "vertical" | "horizontal" | "none";
export type AlignItems = "start" | "center" | "end" | "stretch" | "baseline";
export type JustifyContent =
  | "start" | "center" | "end"
  | "space-between" | "space-around" | "space-evenly";

/**
 * padding — **Pencil 실측 분포 정합** (검증자 #3 수용).
 * 실측: scalar 23건 / **2-element 25건(최다)** / 4-element 2건.
 * 2-element = [vertical, horizontal] CSS shorthand 형(예: [8,16]/[8,24]).
 *
 * 원설계 union(number | [n,n,n,n])은 **dominant 케이스(2-element)를 컴파일 에러**로
 * 만들었다. CSS padding 규칙과 동형으로 2-element 를 추가한다.
 * wire → 4-way 정규화는 현행 parsePadding4Way 경계에서 수행(§A.0 주석).
 */
export type Padding =
  | number // 균일
  | [vertical: number, horizontal: number] // 실측 최다 — CSS [v,h] shorthand
  | [top: number, right: number, bottom: number, left: number];

// ── BaseNode — 모든 트리 primitive 가 공유하는 보편 속성 ──────────────────

/**
 * 모든 노드의 보편 속성(Pencil 1차 원리: "모든 노드가 같은 속성 집합, 값만 다름").
 *
 * Pencil 실측 빈도순: type/id/name/width/fill/x/y/stroke/children/height/
 * reusable/alignItems/gap/content/...  — 시각/레이아웃이 노드 1급 필드.
 *
 * 코드베이스 개선점: 현행 CanonicalNode 의 `props: Record<string, unknown>`
 * generic bag 중 **시각/레이아웃**만 1급 필드로 승격. **variant 색상은 1급 fill 이
 * 아니라 ComponentRulesTable 경유**(§A.0 — D3 SSOT 이원화 차단). `props` bag 은
 * RAC behavior(D2) + variant/size 키(rules table lookup용)를 계속 보관.
 */
export interface BaseNode {
  /** 노드 고유 id. slash(`/`) 금지 — descendants key path 구분자와 충돌(현행 정합). */
  id: string;
  /** 사용자 표시 이름(현행 CanonicalNode.name 과 동일). */
  name?: string;

  // ── 위치/크기 (layout:"none" 부모에서 x/y 사용) ──
  x?: number;
  y?: number;
  width?: Dimension;
  height?: Dimension;
  rotation?: number; // deg (Pencil 실측 rotation)
  opacity?: number; // 0-1

  // ── 시각 (D3) ── 단, variant 색상은 §A.0 경계에 따라 ComponentRulesTable 우선
  /**
   * 노드 자체에 사용자가 부여한 **직접 색**(무-variant frame/rectangle/ellipse/line).
   * variant 보유 leaf primitive 의 상태별 색은 이 필드가 아니라 ComponentRulesTable.
   */
  fill?: Fill;
  stroke?: Stroke;
  cornerRadius?: number | [number, number, number, number];
  /** Pencil `effect` 배열 정합(shadow 등). 노드 아닌 디스크립터. */
  effect?: Effect[];
  blur?: number;
  clip?: boolean; // overflow:hidden 정합

  // ── auto-layout (컨테이너) ──
  layout?: LayoutMode;
  gap?: number;
  padding?: Padding;
  alignItems?: AlignItems;
  justifyContent?: JustifyContent;

  /**
   * RAC behavior / D2 props + variant/size 키 보관소.
   * Pencil 보편 속성으로 표현 안 되는 컴포넌트 동작(isDisabled, selectionMode,
   * onPress→event id 등) **및 variant/size**(ComponentRulesTable lookup 키)를 직렬화.
   *
   * 타입을 unknown → JsonValue 로 좁히는 것은 **현행 props payload 전수 호환 검증
   * 필요**(검증자 #7). 현행은 Record<string, unknown> 이며 일부 nested object 허용.
   * function/React element 는 §G1 boundary 로 이미 금지되나, 좁힘이 BC 인지
   * (기존 직렬화 payload 에 JsonValue 비호환 값 존재 여부) grep 검증 후 확정.
   */
  props?: Record<string, JsonValue>;

  /** 엔티티 레벨 theme override(현행 CanonicalNode.theme 정합). */
  theme?: { mode?: string; tint?: string; base?: string };
}

/** 직렬화 가능 JSON 값 — function/React element 저장 금지(현행 §G1 boundary 정합). */
export type JsonValue =
  | string | number | boolean | null
  | JsonValue[]
  | { [k: string]: JsonValue };
```

#### A.2 — 8 트리 primitive discriminated union

```ts
/**
 * frame — auto-layout 컨테이너(Pencil 최빈 노드, 실측 115). reusable:true 면 정의.
 * 코드베이스 정합: 현행 FrameNode(type:"frame", clip/placeholder) 확장.
 * ADR-130: canonical layout container(ARIA role 없음, D3 전용).
 */
export interface FrameNode extends BaseNode {
  type: "frame";
  children?: CanonicalNode[];
  /** true = 재사용 원본(컴포넌트 정의). 인스턴스는 RefNode 로 참조. */
  reusable?: boolean;
  /** slot 선언 — Pencil 실측: `string[]`(채울 수 있는 reusable id 목록). */
  slot?: string[];
  /** 빈 slot UI hint(현행 FrameNode.placeholder 정합). */
  placeholder?: boolean;
}

/**
 * text — Pencil 실측 키: content/fontFamily/fontSize/fontWeight/lineHeight + fill.
 * RAC 정합: 텍스트 노드는 RAC `Text`/`Label` 의 D3 시각 표현(접근성은 D1 RAC).
 */
export interface TextNode extends BaseNode {
  type: "text";
  content: string; // Pencil `content`
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: number | string;
  lineHeight?: number | string;
  letterSpacing?: number;
  textAlign?: "left" | "center" | "right" | "justify";
  textAlignVertical?: "top" | "middle" | "bottom"; // Pencil 정합
  textGrowth?: "fixed" | "auto-height" | "auto-width"; // Pencil 정합
  textDecoration?: "none" | "underline" | "line-through";
  textTransform?: "none" | "uppercase" | "lowercase" | "capitalize";
  maxLines?: number;
}

/**
 * icon_font — **크기 모델 box 단일** (검증자 #6 수용).
 * Pencil 실측 24건 전부 width/height(box)로 크기 결정, fontSize 사용 0건.
 * 현행 IconFontShape(Skia)는 fontSize 만 받고 width/height 가 없다(중심 x/y + fontSize).
 *
 * 정정: 본 노드는 **box(width/height) 단일 채택**. generic 렌더러가 Skia 로 내보낼 때
 * box → 렌더 size 변환 = `Math.min(width, height)`(아래 ICON_SIZE 규칙). 현행
 * getIconData(size) 호출의 size 인자 출처를 box 로 못박는다.
 * fontSize 는 실측 0건 → legacy 호환용 optional, 신규 미사용(강등).
 */
export interface IconNode extends BaseNode {
  type: "icon_font";
  iconFontFamily?: string; // Pencil `iconFontFamily` (기본 'lucide')
  iconFontName: string; // Pencil `iconFontName` (현행 IconFontShape.iconName 매핑)
  /** @deprecated 실측 0건. box(width/height) 사용. legacy 호환용만. */
  fontSize?: number;
  strokeWidth?: number;
}
/**
 * ICON_SIZE 규칙(generic 렌더러용): box → Skia getIconData size.
 *   size = node.width != null && node.height != null
 *        ? Math.min(toPx(node.width), toPx(node.height))
 *        : (node.fontSize ?? 16); // legacy fallback
 * 현행 IconFontShape.fontSize 에 이 size 를 주입한다.
 */

/** path — SVG path 데이터(geometry). Pencil `path` + `geometry` 정합. */
export interface PathNode extends BaseNode {
  type: "path";
  geometry: string; // SVG path `d` 또는 Pencil geometry
  strokeCap?: "butt" | "round" | "square";
}

/** ellipse — 타원/원(width=height 면 원). 코드베이스 정합: Skia CircleShape 일반화. */
export interface EllipseNode extends BaseNode {
  type: "ellipse";
}

/** rectangle — 순수 사각형(frame 과 달리 children 없음, leaf 시각 노드). */
export interface RectangleNode extends BaseNode {
  type: "rectangle";
}

/**
 * line — 선분. Pencil `line` + 코드베이스 LineShape 정합.
 * 좌표는 BaseNode x/y/width/height bounding box 로 표현.
 */
export interface LineNode extends BaseNode {
  type: "line";
  strokeCap?: "butt" | "round" | "square";
  strokeDasharray?: number[];
}

/**
 * ref — 인스턴스(Pencil 실측: { type:"ref", ref, x, y }, 57건). reusable 원본 참조 +
 * descendants path-based override. 코드베이스 정합: 현행 RefNode 동일.
 */
export interface RefNode extends BaseNode {
  type: "ref";
  /** 원본 reusable 노드 id. import 참조는 `"<importKey>:<nodeId>"`(현행 정합). */
  ref: string;
  /** path 기반 override 맵(현행 DescendantOverride 3-mode 정합). */
  descendants?: Record<string, DescendantOverride>;
}

// ── image/color/shadow 는 노드 아님 (검증자 #1 정밀화) ────────────────────
// image  → Fill 의 ImageFill 변형(§A 상단)
// color  → Fill 의 ColorFill 변형(§A 상단)
// shadow → Effect 의 ShadowEffect(§A 상단)
// 향후 1급 노드 승격 시 본 데이터셋엔 노드 출현 0건이므로 별도 검증 필요.
```

#### A.3 — DescendantOverride 3-mode (검증자 #12 수용)

Pencil 실측 3-mode(속성 patch / 노드 교체 / children 교체)를 현행 구조와 정합 유지하되, **patch 모드를 임의 string key 가 아니라 보편 속성(BaseNode 키)만 허용**하도록 정제한다. 단, 현행 `[key:string]: unknown` 에서 좁히는 것이 BC 인지 명시한다.

```ts
/**
 * descendants 값 — 3-mode union(현행 composition-document.types.ts 정합).
 * resolver 판정: type 존재 → (B) 노드 교체 / children 존재+type 없음 →
 * (C) children 교체 / 둘 다 없음 → (A) 속성 patch. 복수 충족 시 resolver error.
 */
export type DescendantOverride =
  | DescendantReplaceMode
  | DescendantChildrenMode
  | DescendantPatchMode;

/** (B) 노드 교체 — type 존재 → 서브트리 전체 교체. */
export type DescendantReplaceMode = CanonicalNode;

/** (C) children 교체 — children 만 존재, type 없음(slot 채우기). */
export type DescendantChildrenMode = {
  id?: never;
  type?: never;
  children: CanonicalNode[];
};

/**
 * (A) 속성 patch — **보편 속성(BaseNode 키)만 허용** (검증자 #12 수용).
 *
 * 원설계는 [key:string]: JsonValue|undefined 로 임의 key 를 허용했으나, BaseNode 가
 * 시각/레이아웃을 강타입 1급 필드로 올렸으므로 patch 도 BaseNode 키만 허용해야 일관.
 * 실측 patch 값: { fill:"$--destructive" }(JsonValue OK), { enabled:false },
 * stroke patch { thickness:{right:1} }(Stroke 부분 — Partial<BaseNode> 로 커버).
 *
 * id/type/children 은 patch 불가(교체 모드와 구분). never 로 구조적 배제.
 *
 * **BC 주의**: 현행은 `[key:string]: unknown`(composition-document.types.ts:245).
 * Partial<BaseNode> 로 좁히면 기존 직렬화된 patch 에 BaseNode 외 key 가 있을 경우
 * **breaking** 가능 → 좁힘 전 기존 patch payload key 전수 grep 검증 필요(=breaking 여부).
 */
export type DescendantPatchMode = Partial<
  Omit<BaseNode, "id" | "children">
> & {
  id?: never;
  type?: never; // BaseNode 엔 type 없음(각 노드가 추가) — patch 에서도 금지 명시
  children?: never;
};

// ── 최상위 union (8 트리 멤버) ────────────────────────────────────────────

/** 8 트리 primitive discriminated union — Pencil 1차 원리(실측). */
export type CanonicalNode =
  | FrameNode
  | TextNode
  | IconNode
  | PathNode
  | EllipseNode
  | RectangleNode
  | LineNode
  | RefNode;
```

#### A.4 — type guard 헬퍼 (실무 dispatch 용)

```ts
export const isFrameNode = (n: CanonicalNode): n is FrameNode => n.type === "frame";
export const isTextNode = (n: CanonicalNode): n is TextNode => n.type === "text";
export const isIconNode = (n: CanonicalNode): n is IconNode => n.type === "icon_font";
export const isRefNode = (n: CanonicalNode): n is RefNode => n.type === "ref";

/** ref 가 인스턴스(원본 아님)인지. reusable:true frame = 정의, ref = 사용. */
export const isReusableOrigin = (n: CanonicalNode): n is FrameNode =>
  isFrameNode(n) && n.reusable === true;

/** 컨테이너(children 보유 가능 노드)인지 — frame 만 children 가짐. */
export const isContainerNode = (n: CanonicalNode): n is FrameNode => isFrameNode(n);
```

#### A.5 — CompositionDocument root (현행 정합)

```ts
import type { ThemeAxes, TokenTable } from "./theme.types"; // §C
import type { SerializedEvent, SerializedAction } from "./behavior.types";

/**
 * CompositionDocument — canonical document root.
 * 코드베이스 정합: 현행 composition-document.types.ts 의 CompositionDocument 와
 * 필드명 동일(version/themes/tokens/children/events/actions/imports).
 *
 * 개선점: 현행 themes 는 ADR-021 단축 snapshot. Pencil 실측은 **다축 themes**
 * (Accent/Base/Mode) + 축조합별 토큰 배열. 본 설계 themes=ThemeAxes(§C),
 * tokens=TokenTable. 단 **다축 런타임 resolve 는 현행 부재 → 신규 도입**(§C.0).
 */
export interface CompositionDocument {
  version: string; // "composition-1.0" (현행 HC#10)
  themes?: ThemeAxes; // 다축 — Pencil { Accent, Base, Mode }
  tokens?: TokenTable; // 축조합 배열 — ADR-143 `tokens` 정명
  imports?: Record<string, string>;
  children: CanonicalNode[];
  events?: SerializedEvent[]; // ADR-131
  actions?: SerializedAction[]; // ADR-131
  _meta?: { schemaVersion?: "canonical-primary-1.0" };
}
```

#### A.6 — 컴포넌트화 메커니즘 정리표 (데이터에 직접 존재)

```ts
/**
 * Pencil 1차 원리: 컴포넌트화 메커니즘이 별도 코드가 아니라 데이터에 있다.
 *   reusable:true frame          → origin(컴포넌트 정의)
 *   { type:"ref", ref:"<id>" }   → instance (실측 57건)
 *   descendants["<path>"]        → path-based override(3-mode)
 *   { type:"frame", slot:[...] } → 채울 자리(slot fill)
 * 이 표는 컴파일 타입이 아니라 불변식 주석. resolver(§D)가 이 규칙을 집행한다.
 */
```

#### A.7 — 마이그레이션 schema-version discriminant (검증자 #8 수용)

원설계의 intersection brand(`string & { __legacyTag }`)는 **프로젝트 메모리 `feedback-typescript-intersection-brand-trap` 함정**에 해당한다 — branded 가 `string` 의 subtype 이라 일반 `string` 시그니처에 그대로 흘러들어 차단 보장 불가. 또한 BaseNode 1급 필드 모델(width 가 1급)과 121-literal+props bag 모델(width 가 props 안)은 **같은 노드가 양쪽 표현 불가**라 변환이 단순 brand 가 아니라 전체 노드 재구조화다. brand 만으로 "공존" 표현은 변환 비용을 숨겼다.

**정정 1 — 차단 메커니즘**: intersection brand 대신 **discriminated `schema` 필드**로 차단.
**정정 2 — 방향**: "공존"이 아니라 **one-way read 변환(legacy → primitive) + write 는 primitive 만**.
**정정 3 — BC 수식화 (adr-writing 반복패턴 #3 의무)**: brand 경로 ROI 를 정직하게 미산출로 표기하고, 산출에 필요한 grep 항목을 명시한다(아래 BC_SCOPE).

```ts
/**
 * StoredNode — read 시점 schema 버전 discriminated union(과도기).
 *
 * 검증 필요(BC 규모 미수식): brand 경로 채택 전 다음 실측 필수(adr-writing #3):
 *   BC_SCOPE = {
 *     legacyNodeCount: grep IndexedDB/elementsMap 의 121-literal ComponentTag 노드 수,
 *     avgReserializePerDoc: 문서당 평균 재직렬화 노드 수,
 *     affectedUserPct: 기존 프로젝트 중 legacy 노드 보유 비율,
 *   }
 * 이 수치 산출 후 one-way read 변환 ROI 재판정. 미산출 상태로 brand 경로 확정 금지.
 */
export type StoredNode =
  | (CanonicalNode & { schema?: "primitive" }) // 신규 write(default)
  | LegacyComponentNode; // 과도기 read-only

/**
 * 과도기 legacy 노드 — 현행 CanonicalNode(ComponentTag) 형태. read adapter 가
 * **one-way(legacy → primitive)** 변환. write 경로는 primitive 만 출력.
 * discriminant 는 `schema:"legacy"`(intersection brand 아님 — 함정 회피).
 */
export interface LegacyComponentNode {
  schema: "legacy"; // discriminator (string subtype brand 금지)
  id: string;
  type: string; // 121-literal ComponentTag (brand 없음 — schema 필드가 구분 담당)
  props?: Record<string, JsonValue>;
  children?: StoredNode[];
  reusable?: boolean;
}

/** read adapter 시그니처 — legacy → primitive 단방향. write 는 primitive 직접. */
export type MigrateReadFn = (stored: StoredNode) => CanonicalNode;
```

---

### B. PrimitiveBinding + Catalog (현행 정합 유지 + CutoverState 직교 분리)

`packages/shared/src/catalog/types.ts` — 현행 식별자 100% 유지. **`CutoverState`(렌더 경로 cutover 축)와 `StoredNode.schema`(노드 schema 버전 축)를 직교 축으로 분리**(검증자 #11).

```ts
/**
 * @fileoverview Catalog Types — RAC 1차 원리 + 현행 types.ts 정합.
 *
 * RAC 1차 원리: leaf primitive 1개당 binding 1개. 시각은 theme/tokens + variant 색상은
 * ComponentRulesTable(§A.0), 변형은 data-*(render-prop state). 조합 컴포넌트는 코드
 * 정의가 아니라 canonical reusable 문서(§A). 6 레지스트리가 단일 ComponentCatalogEntry 로
 * 수렴(현행 ADR-142 정합).
 */

export type ComponentFamily =
  | "primitives" | "fields" | "selection" | "collections"
  | "tree-table" | "overlays" | "date-color" | "composition-native";

/**
 * cutover 상태 — 현행 동일. **렌더 경로 전환 추적 축**(legacy render.shapes →
 * catalog generic). StoredNode.schema(노드 버전 축)와 **직교**(검증자 #11):
 *   - CutoverState : "이 family 의 Skia 렌더가 catalog 경로로 넘어갔나"
 *   - StoredNode.schema : "이 노드가 121-literal 인가 8-primitive 인가"
 * 두 축은 독립적으로 진행/제거된다 — 원설계의 "A.7 brand 제거와 동기화" 가정은 철회.
 *
 * **CutoverState 제거 선결조건(원거리 end-state)** — 현행 실측 1/8 flip
 * (메모리 project-adr142-family1-flipped):
 *   (1) 8 family 전부 cutover==="catalog"
 *   (2) 모든 entry.skiaLegacy 제거(0건)
 *   (3) legacy 복제 render.shapes/CSS 물리 삭제(전 family 후 일괄)
 * 위 3조건 전 제거 금지. 현행은 primitives family 1개만 flip 완료.
 */
export type CutoverState = "legacy" | "cutting-over" | "catalog";

export type PrimitiveSource =
  | { kind: "rac"; package: "react-aria-components"; importPath: string; component: string }
  | { kind: "internal"; renderer: string };

/**
 * leaf primitive 1개당 1개(현행 동일, ~35개). 시각/변형/구조 필드 없음 —
 * 시각은 theme/tokens, variant 색상은 ComponentRulesTable, 변형은 data-*.
 */
export interface PrimitiveBinding {
  source: PrimitiveSource;
  rac?: {
    primitive: string;
    parts: string[];
    slots: string[];
    states: string[];
    renderProps: string[];
    dataAttributes: string[];
  };
  props: {
    accepts: PropsSchema; // canonical props = D2 편집 SSOT(현행)
    toRacProps: string; // canonical → RAC props 투영기 식별자(현행)
  };
  skiaPrimitive?: string;
}

export type InspectorFieldKind =
  | "boolean" | "enum" | "string" | "string-array" | "number"
  | "icon" | "variant" | "size" | "fillStyle" | "binding";

export interface VisibilityCondition {
  key?: string;
  equals?: string | number | boolean;
  oneOf?: Array<string | number | boolean>;
  truthy?: boolean;
}

export interface PropContract {
  kind: InspectorFieldKind;
  label?: string;
  default?: JsonValue;
  section?: "content" | "appearance" | "state" | "locale" | (string & {});
  options?: Array<{ value: string; label: string }>;
  min?: number;
  max?: number;
  step?: number;
  visibleWhen?: VisibilityCondition;
}

export type PropsSchema = Record<string, PropContract>;

export interface PanelMeta {
  category: string;
  label: string;
  icon: string;
  placeable: boolean;
}

export type ComponentCatalogEntry =
  | {
      kind: "primitive";
      type: string;
      family: ComponentFamily;
      cutover: CutoverState; // 렌더 경로 축(StoredNode.schema 와 직교)
      binding: PrimitiveBinding;
      panel: PanelMeta;
      skiaLegacy?: boolean;
    }
  | {
      kind: "reusable";
      type: string;
      family: ComponentFamily;
      cutover: CutoverState;
      reusableId: string; // canonical reusable frame id
      panel: PanelMeta;
      skiaLegacy?: boolean;
    }
  | {
      kind: "native";
      type: string;
      family: ComponentFamily;
      panel: PanelMeta;
    };

export type ComponentCatalog = Record<string, ComponentCatalogEntry>;
```

---

### C. Theme / Tokens (다축 — Pencil 1차 원리, **신규 도입** 명시)

`packages/shared/src/types/theme.types.ts` — Pencil 실측 다축 구조를 1차 채택. **다축 best-match resolve 는 현행에 부재하므로 신규 도입**으로 정직하게 격상한다(검증자 #5).

#### C.0 — 현행 single-value baked ↔ 다축 런타임 (검증자 #5 수용)

원설계가 "현행 `resolveCanonicalToken(ref, document)` 진입점이 본 규칙 구현"이라 한 것은 **거짓**이었다. 현행 실측:

```ts
// apps/builder/src/adapters/canonical/variablesAdapter.ts:186
const TOKEN_REF_PATTERN = /^\{(\w+)\.(.+)\}$/;            // brace 형만 받음
export function resolveCanonicalToken(ref, doc) {
  const m = ref.match(TOKEN_REF_PATTERN);
  return doc.tokens?.[`${cat}.${name}`]?.value;           // 단일 스칼라
}
```

즉 현행은 (a) **brace 형만** 받음(`$--` prefix 아님) (b) **ActiveTheme 런타임 인자 없음** (c) **단일값** 반환 (d) theme 가 **doc 빌드 시점에 baked**("theme 전환 시 새 doc 빌드 필요"). 설계의 다축 `TokenDefinition.value: TokenValueEntry[]` + `active` 인자 + 축 일치 수 비교는 **현행에 0% 존재**.

**정정**:
1. 다축 best-match resolve 를 **"신규 도입(현행 single-value baked 모델 대체)"** 로 정직하게 표기. `resolveCanonicalToken` 이 "본 규칙 구현"이라는 문장 삭제.
2. **dark mode 자동 반전 회귀 위험 명시**: 현행 dark mode 반전이 doc 빌드 시 baked 라면, 다축 런타임 모델로 바꿀 때 **빌드타임 반전 로직이 무력화**된다 → 회귀. 다축 모델은 dark mode 를 `Mode:"Dark"` 축 좌표로 표현하므로, 빌드타임 반전을 **런타임 best-match 로 이전**해야 하며 이 이전이 누락되면 dark mode 색상 회귀. → 마이그레이션 시 빌드타임 반전 entry 를 `{ theme:{Mode:"Dark"}, value }` 로 옮기는 변환 필수(검증 필요).
3. **ref 형식 layer 분리를 시그니처에 반영**: `ResolveTokenFn` 은 wire(`$--`)와 spec(brace) 양쪽을 받도록 `normalizeTokenRef` 로 정규화 후 처리.

```ts
import type { TokenRefString } from "./canonical-node.types";

/**
 * @fileoverview Theme / Token Types — Pencil 다축 1차 원리. **다축 런타임 resolve 는
 * 현행 부재 → 신규 도입**(§C.0). 현행 resolveCanonicalToken 은 single-value baked.
 *
 * Pencil 실측(shadcn-design-system.json):
 *   themes: { Accent:[8], Base:[5], Mode:[Light,Dark] }
 *   variables["--accent"]: { type:"color", value:[
 *     { value:"#f5f5f5" },                        // 기본(축 미지정)
 *     { theme:{ Mode:"Dark" }, value:"#262626" }, // Dark 축
 *   ]}
 */

export type ThemeAxes = Record<string, string[]>; // Pencil `themes`
export type ThemeSelector = Record<string, string>; // token value 의 `theme`(부분)
export type ActiveTheme = Record<string, string>; // 런타임 활성 좌표(모든 축 1개씩)

/** 토큰 1개의 단일 축조합 값(Pencil token value 배열 요소). */
export interface TokenValueEntry {
  /** 적용 theme 좌표(부분). 미지정 = 기본값. best-match: ActiveTheme 와 일치 축 최다. */
  theme?: ThemeSelector;
  value: string | number | boolean;
}

/**
 * 토큰 정의 — Pencil `variables["--x"]`. 축조합별 value 배열.
 * **신규**: 현행 TokenDefinition(단일 value)을 다축 배열로 확장.
 * 단일값 토큰은 `value:[{ value }]` 로 표현 — 하위 호환.
 */
export interface TokenDefinition {
  type: "color" | "number" | "string" | "boolean";
  value: TokenValueEntry[]; // 최소 1개(기본값)
  source?: "spec-token" | "user-defined"; // 현행 TokensSnapshotEntry.source 정합
}

export type TokenTable = Record<string, TokenDefinition>;

/**
 * 3-layer 토큰 참조 정규화 — wire($--) / spec(brace {cat.name}) → 토큰 키.
 * **신규**: 현행 resolveCanonicalToken 은 brace 만 받으므로(§C.0), 본 함수가
 * $-- prefix 형까지 흡수하는 단일 진입점.
 *   "$--accent"        → "--accent"  (또는 "accent")
 *   "{color.accent}"   → "color.accent"
 *   { $var:"accent" }  → "accent"
 * 책임 모듈: variablesAdapter(현행 resolveCanonicalToken 인접)에 추가.
 * **검증 필요**: tokens 테이블 키 컨벤션이 "--accent" 인지 "color.accent" 인지 통일 후
 * 정규화 출력 형 확정(현행은 "color.accent" brace 키, Pencil wire 는 "--accent").
 */
export type NormalizeTokenRefFn = (
  ref: TokenRefString | string | { $var: string },
) => string;

/**
 * 토큰 best-match resolve — **신규 도입**(현행 single-value baked 대체).
 * ActiveTheme 좌표에서 가장 specific 한 entry 선택:
 *   entry.theme 가 ActiveTheme 의 subset 이면 후보 → 일치 축 수 최대 채택 → 없으면 기본값.
 *
 * **회귀 주의(§C.0-2)**: 현행 dark mode 빌드타임 반전을 본 런타임 모델로 이전해야 함.
 * ref 는 normalizeTokenRef 로 정규화된 후 들어온다(wire/spec 양쪽 흡수).
 */
export type ResolveTokenFn = (
  refKey: string, // normalizeTokenRef 출력
  tokens: TokenTable,
  active: ActiveTheme,
) => string | number | boolean | undefined;
```

---

### D. Resolve / Render (RAC Collection + dual backend)

`packages/shared/src/types/render.types.ts` — resolve 출력 트리 + DOM/Skia 공통 RenderBackend + RAC Collection data. **Shape 는 신규 재선언하지 않고 현행 specs Shape 를 직접 소비**(검증자 #4), **VirtualizationWindow 는 Skia 전용 + scrollOffset 동기화 계약 포함**(검증자 #10).

#### D.0 — Shape: 현행 specs union 직접 소비 (검증자 #4 수용)

원설계의 `kind:'box'|'text'|'icon'` 재선언은 현행 `Shape`(discriminant `type`, 12 멤버, `IconFontShape.type:"icon_font"`)와 **구조적 호환 불가**(같은 객체가 양쪽 타입 동시 만족 못 함)였고, "subset brand"와 "재선언"/"그대로 소비"는 상호 모순이었다(subset 이면 재선언 불가). 이는 **Shape 타입의 평행 SSOT 재도입**(SSOT 위반)이다.

**정정**: 신규 Shape 를 선언하지 않는다. `import type { Shape } from "@composition/specs"` 로 **실제 소비**한다. generic 렌더러가 8 primitive 를 `rect`/`roundRect`/`text`/`icon_font`/`line`/`circle`(ellipse) 등 **현행 discriminant `type` 그대로** 산출한다. "subset brand" 표현 제거 — generic 렌더러가 **현행 Shape union 의 부분집합을 산출한다**고만 서술한다.

```ts
/**
 * @fileoverview Resolve / Render Types — RAC Collection 1차 원리 + dual backend.
 *
 * RAC 1차 원리: Collection 은 data(items)와 render(렌더 함수) 분리. Virtualizer +
 * ListLayout/GridLayout/TableLayout 로 viewport culling.
 *
 * Shape 는 **현행 specs/types/shape.types.ts Shape union 을 직접 소비**(재선언 금지,
 * 평행 SSOT 회피 — §D.0). generic 렌더러는 그 union 의 부분집합(rect/roundRect/text/
 * icon_font/line/circle)을 산출한다.
 */

import type { CanonicalNode, JsonValue } from "./canonical-node.types";
import type { ActiveTheme, TokenTable } from "./theme.types";
// Skia backend 출력 = 현행 Shape union 직접 소비 (재선언 금지)
import type { Shape } from "@composition/specs";

export type { Shape }; // re-export only — 신규 정의 없음

// ── ResolvedNode — resolve 출력(현행 정합) ────────────────────────────────

export type ResolvedNode = CanonicalNode & {
  _resolvedFrom?: string; // resolve 에 사용된 ref id(UI 마커)
  _overrides?: string[]; // override 된 필드 경로(Properties dot 마커)
  children?: ResolvedNode[];
};

/**
 * resolve 함수 — ref 해석 + descendants apply + slot 검증 → resolved tree.
 * 현행 ResolveFn 동일 + active theme 좌표 인자(토큰 resolve 일관 처리, §C.0 신규).
 */
export type ResolveFn = (
  doc: { children: CanonicalNode[]; tokens?: TokenTable },
  active: ActiveTheme,
  cache?: ResolverCache,
) => ResolvedNode[];

// ── ResolverCache — subtree 캐시(현행 정합) ───────────────────────────────

export type ResolverCacheKey = readonly [
  docVersion: string,
  rootRefId: string,
  descendantsFingerprint: string,
  slotBindingFingerprint: string,
];

export interface ResolverCache {
  get(key: ResolverCacheKey): ResolvedNode | undefined;
  set(key: ResolverCacheKey, tree: ResolvedNode): void;
  invalidateSubtree(rootRefId: string): void;
  invalidateAll(): void;
  stats(): { hits: number; misses: number; size: number };
}

// ── RenderBackend — DOM/Skia 공통(대칭 consumer) ─────────────────────────

/**
 * DOM/Skia 공통 render backend — D3 symmetric consumer 계약.
 * 코드베이스 정합: DOM = CanonicalNodeRenderer(ResolvedNode → React.ReactNode),
 * Skia = renderCommands.visitElement(ResolvedNode → Shape[]).
 *
 * **2 consumer 시그니처 확인(검증자 #10)**: 두 실제 진입점이 본 추상과 맞는지 —
 * CanonicalNodeRenderer 는 컴포넌트(props 받아 JSX), visitElement 는 명령 stream 에
 * push 하는 부수효과형이라 순수 반환형 추상과 다를 수 있음 → 어댑터 박막 필요할 수
 * 있음(검증 필요). 본 인터페이스는 **개념 계약**이며 실제 wiring 은 어댑터로.
 */
export interface RenderBackend<TOutput> {
  renderNode(node: ResolvedNode, ctx: RenderContext): TOutput;
  renderChildren(nodes: ResolvedNode[], ctx: RenderContext): TOutput[];
}

/**
 * 렌더 컨텍스트 — active theme + 토큰 + viewport.
 * **virtualization 책임 분리(검증자 #10)**: VirtualizationWindow 는 **Skia backend
 * 전용**. DOM backend 는 RAC Virtualizer 가 자체 culling 하므로 window 를 **무시**한다
 * (이중 virtualization 충돌 차단). 이 계약을 RenderContext 에 박는다.
 */
export interface RenderContext {
  active: ActiveTheme;
  tokens: TokenTable;
  viewport?: ViewportRect; // Skia culling. DOM backend 는 무시.
  /** Skia backend 전용. DOM backend 는 항상 무시(RAC Virtualizer 위임). */
  virtualization?: VirtualizationWindow;
  /** 현재 스크롤 오프셋 — boundsMap 절대좌표 ↔ 렌더 translate 동기화용(§D.1). */
  scrollOffset?: { x: number; y: number };
}

export interface ViewportRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

// ── Collection 데이터 (RAC items/async/virtualization) ────────────────────

/**
 * Collection 데이터 source — RAC 1차 원리: data(items)/render 분리.
 * 현행 useCollectionData({ datatableId | dataBinding }) 단일 read 진입점(ADR-132).
 * source="api" 는 useAsyncList.load → runtimeData sink(useState 보관 금지).
 */
export type CollectionSource<T> =
  | { kind: "static"; items: T[] }
  | { kind: "datatable"; datatableId: string }
  | { kind: "binding"; dataBinding: DataBindingRef }
  | { kind: "async"; load: AsyncListLoad<T> };

export interface DataBindingRef {
  type: "collection" | "value" | "field";
  source: string;
  config?: Record<string, JsonValue>;
}

export type AsyncListLoad<T> = (args: {
  signal: AbortSignal;
  cursor?: string;
  filterText?: string;
}) => Promise<{ items: T[]; cursor?: string }>;

/**
 * virtualization window — **Skia backend 전용**(검증자 #10 수용).
 * Skia 최적화 1차 원리: List/Table/Grid 반복 컬렉션은 보이는 영역만 렌더.
 *
 * **신규 — frame culling 위 확장, 미검증**: 현행 Skia 는 frame/page root 단위 culling
 * (visiblePageRoots/visibleFrameRoots)만 존재. item-level virtualization 미구현.
 *
 * **scrollOffset/boundsMap 동기화 계약(§D.1 — canvas-rendering.md §8)**: visibleRange
 * 만큼만 renderItem 호출 시, boundsMap(절대좌표)과 부모 scrollOffset 차감이 깨지면
 * hover outline 이 스크롤 전 위치에 고정되는 알려진 버그 재발. 본 window 적용 시
 * RenderContext.scrollOffset 과 buildTreeBoundsMap/renderCommands scrollVersion 동기화
 * 필수.
 */
export interface VirtualizationWindow {
  totalCount: number;
  visibleRange: [start: number, end: number]; // viewport + overscan
  itemSize: number | ((index: number) => number);
  overscan: number;
}

export type CollectionItemRenderer<T> = (item: T, index: number) => CanonicalNode;

export interface ResolvedCollection<T> {
  source: CollectionSource<T>;
  items: T[];
  /** Skia 만 소비. DOM(RAC Virtualizer)은 무시. */
  window: VirtualizationWindow;
  renderItem: CollectionItemRenderer<T>;
}
```

#### D.1 — item-level virtualization scrollOffset 동기화 계약 (검증자 #10 수용)

```ts
/**
 * Skia item-level virtualization 시 좌표 동기화 불변식(canvas-rendering.md §8):
 *
 *  1. buildTreeBoundsMap: traverse 시 부모 scrollOffset 을 자식 좌표에서 차감.
 *  2. renderCommands.visitElement: 자식 boundsMap 좌표에 부모 scrollOffset 차감
 *     (boundsMap 절대좌표 ↔ canvas.translate 동기화).
 *  3. scrollState.scrollVersion: 스크롤 변경 시 getCachedTreeBoundsMap 캐시 무효화.
 *
 * VirtualizationWindow.visibleRange 가 바뀌면(스크롤) scrollVersion++ 로
 * boundsMap 캐시 무효화 → renderItem(visibleRange) 재호출 → 좌표 재계산.
 * 이 3-심볼 동기화가 누락되면 hover outline 고정 버그 재발. 본 계약을 Skia
 * collection 렌더러에 박는다(DOM 은 §D RenderContext 무시 규약으로 무관).
 */
```

---

### E. 파일 구성 요약 + 검증 필요 항목

| 그룹 | 파일 | 핵심 export | 현행 정합/개선 |
| --- | --- | --- | --- |
| A | `packages/shared/src/types/canonical-node.types.ts` | `CanonicalNode`(**8 union**), `BaseNode`, `FrameNode`/`TextNode`/`IconNode`/`RefNode`/..., `Fill`(+ColorFill/ImageFill), `Stroke`(align/fill/thickness), `Effect`(ShadowEffect), `Padding`(2/4-elem), `DescendantOverride`(patch=Partial<BaseNode>), `StoredNode`(schema discriminant), `CompositionDocument`, type guards | 식별자 정합, **type 121-literal → 8-primitive 정제**, **wire 형태 실측 정합** |
| B | `packages/shared/src/catalog/types.ts` | `PrimitiveBinding`, `ComponentCatalogEntry`, `ComponentFamily`, `PropContract`, `InspectorFieldKind`, `PropsSchema`, `PanelMeta`, `CutoverState`(StoredNode.schema 와 직교) | 현행 100% 유지 + RAC 원리 + cutover 직교 분리 |
| C | `packages/shared/src/types/theme.types.ts` | `ThemeAxes`, `TokenDefinition`(다축), `TokenTable`, `ActiveTheme`, `NormalizeTokenRefFn`, `ResolveTokenFn` | **다축 best-match = 신규 도입**(현행 single-value baked 대체) |
| D | `packages/shared/src/types/render.types.ts` | `ResolvedNode`, `ResolverCache`, `RenderBackend`, `Shape`(**specs 직접 소비 re-export**), `CollectionSource`, `VirtualizationWindow`(Skia 전용), `ResolvedCollection`, `RenderContext`(scrollOffset) | `ResolvedNode`/`ResolverCache` 현행 정합 + Shape 평행 SSOT 제거 + virtualization 책임 분리 |

**컴파일 가능성**: 그룹 간 `import type` 으로만 의존(A←C, D←A·C·specs Shape). 순환 의존 없음. `TokenRefString` template literal, `DescendantPatchMode` 의 `Partial<Omit<...>> & {never}` 구조적 배제, discriminated union narrowing, `StoredNode.schema` discriminant 모두 TS 5 표준 기능.

**검증 필요 항목 집약** (정정으로 새로 노출된 것 포함):
1. `image`/`color`/`shadow` 를 향후 1급 노드로 승격 시 — 본 데이터셋 노드 출현 0건(§0.1).
2. `Stroke.style`(dashed/dotted), `Stroke.align` center/outside, `Effect.shadowType:"inner"` — 실측 근거 0건(§A 상단).
3. `Dimension` `fill_container(0)` max=0 의미 — 현행 파서/Pencil 스펙 확인(§A Dimension).
4. `BaseNode.props: JsonValue` 좁힘이 현행 `Record<string,unknown>` payload 전수 호환인지 grep(§A BaseNode).
5. `DescendantPatchMode` Partial<BaseNode> 좁힘이 기존 직렬화 patch key 와 BC 인지 grep(§A.3).
6. `IconNode` box → Skia getIconData size 변환(`Math.min(w,h)`) 렌더러 구현(§A.2).
7. `BaseNode.fill` ↔ `ComponentRulesTable` 경계 분기를 generic 렌더러에 구현(§A.0).
8. `StoredNode` legacy→primitive one-way 변환 ROI — BC_SCOPE(legacyNodeCount/avgReserialize/affectedUserPct) 실측 수식화(§A.7, adr-writing #3).
9. 다축 런타임 resolve 도입 시 **dark mode 빌드타임 반전 → 런타임 best-match 이전** 회귀(§C.0-2).
10. 3-layer 토큰 ref 정규화 출력 키 컨벤션(`--accent` vs `color.accent`) 통일(§C.0).
11. `RenderBackend` 추상이 실제 2 consumer(CanonicalNodeRenderer 컴포넌트형 / visitElement 부수효과형) 시그니처와 맞는지 — 어댑터 박막 필요 여부(§D).
12. Skia item-level virtualization scrollOffset/scrollVersion 3-심볼 동기화 구현(§D.1).
13. `CutoverState` 제거 선결 3조건(8 family catalog + skiaLegacy 0 + legacy render.shapes 삭제) — 현행 1/8 flip(§B).

이 정정 설계의 결론(8 트리 primitive + 보편 속성 + theme/token SSOT + dual backend + reusable/ref/descendants 컴포넌트화)은 ADR-142 end-state 와 수렴하며, ADR-142 를 supersede 하지 않는다. 원설계 대비 변경은 **실측·현행 grep 증거 기반의 사실 정정**이며 1차 원리(외부 자산 백지 재유도)를 더 충실히 따른다.

---

<a id="영역-9-10"></a>

# ⑨ 장단점 및 트레이드오프 + ⑩ 구현 우선순위 / Roadmap

> 본 영역은 ①~⑧ 통합 설계(canonical 문서 SSOT + RAC binding + generic 렌더러)를 근거로 한다. 모든 판단은 ADR-142(Accepted 2026-05-30) HC#1~11 + 실측 코드(`packages/shared/src/catalog/`, `packages/specs/src/renderers/buildCatalogShapes.ts`, `apps/builder/.../skia/resolveSkiaVisualRule.ts`, `buildSpecNodeData.ts`, breakdown §4~5)와 대조 검증했다. **현재 진행 상태**: family ①~⑧ 가 이미 DOM cutover 완료, G2(a)/(b) Skia-rewrite 진행 중(`resolveComponentVisual` 어댑터 seam → variant 색상 spec→rule swap → Tree Skia generic flip). 따라서 본 roadmap 은 백지 계획이 아니라 **이미 도달한 지점에서 남은 경로를 1차 원리로 재서술**한 것이다. 각 항목에 `[실측]` / `[전환기]` / `[목표]` 상태 태그를 붙여 현재와 미래를 분리한다.

---

## ⑨ 장단점 및 트레이드오프 분석

### ⑨.1 장점 — 4축

#### (A) SSOT 축 — "진짜 하나"의 구조적 근거

| 장점 | 1차 원리 근거 | 실측 검증 |
| --- | --- | --- |
| **컴포넌트별 정의 파일 0개** | Pencil: 87 컴포넌트가 코드 0줄(노드 type + 보편 속성). 컴포넌트별 type 없음 → 컴포넌트별 파일 불필요 | leaf = `bindings/*.binding.ts` 41개(`Button`~`Tree`), 조합 = `catalog/library/` reusable 문서. `*.spec.ts` 124개는 legacy boundary 격리 대상(HC#2) |
| **6 레지스트리 → 1 레지스트리** | RAC: data/render 분리 → 등록은 데이터 1건이면 충분 | `componentCatalog.ts` 단일 등록. ADR-139 `componentRegistrationContract.test.ts` 가 불변식 A/B + family atomicity 를 build-time 강제 — 누락 시 test FAIL, baseline 우회 불가 |
| **단일 props 투영기** | RAC: `composeRenderProps` 단일 규약 | `outputs/toRacProps.ts` 1개가 모든 컴포넌트 처리. 컴포넌트별 변환기 0. variant/size/fillStyle → `data-*` 라우팅이 흡수 |
| **편집·렌더 대칭 (목표)** | RAC `data-variant` + Pencil `$--token` 합류 → D3 단일 token 공급처 | `componentRulesTable` + `resolveToken` 을 양 backend 공유. `button.size="sm"→fontSize:14` 가 DOM/Skia/Panel/Publish 동일 |

> **SSOT 보장점 정밀화 (①-c 정정 반영)**: 4곳 동일성의 보장 근거는 "단일 노드에 14 가 박혀서"가 아니라 **"두 backend 가 동일 `componentRulesTable` 심볼 + 동일 `resolveToken` 구현을 호출해서"**다. `ResolvedNode`(`canonical-resolver.types.ts:107-118`)에는 `computed`/`dataAttributes` 필드가 없고, resolve 는 ref→descendants→slot 만 처리한다. token 해소는 backend 진입 직전 단계다. 이 구분이 중요한 이유: SSOT 깨짐의 진짜 위험 지점이 "노드 computed 누락"이 아니라 **"한 backend 가 다른 rule 테이블/다른 resolveToken 을 호출"**임을 정확히 지목하기 때문(⑨.3 R-S1 참조).

#### (B) 유지보수 축 — drift 의 구조적 차단

```
legacy 모델 (다중 정본)                         document 모델 (단일 정본)
─────────────────────────────                  ─────────────────────────
Button 시각 1곳 수정                            componentRulesTable["Button"] 1곳 수정
 → Spec / CSS / Skia render.shapes / factory     → DOM(CSSGenerator) + Skia(buildCatalogShapes)
   / panel / rendererMap 6곳 각각 수정             가 같은 rule 재호출 → 자동 동기
 → 한 곳 누락 시 Builder↔Preview drift           → 누락할 "다른 곳"이 없음 (구조적 부재)
파생(ToggleButton←Button) 따로 수정              파생 = reusable 문서가 Button leaf 를
                                                  children 으로 참조 → base 수정 자동 전파
```

ADR-142 Context 가 명시한 두 전파 깨짐(① 렌더 타깃 간 drift / ② 파생·재사용 간 drift)이 **양쪽 다 구조적으로 차단**된다. ① 은 단일 rule 테이블, ② 는 reusable 참조 메커니즘(`type:"ref"` + `descendants`)이 해결한다. 이것이 대안 E 가 유지보수 위험 LOW 인 유일한 대안인 이유(Risk Threshold Check: A/C=H, B/D=H+H, E=L).

#### (C) 성능 축 — 런타임 정의 수 감소 + 단일 경로

| 장점 | 근거 | 정량 |
| --- | --- | --- |
| 런타임 컴포넌트 정의 124 → ~35 binding | leaf 만 코드, 조합은 데이터(lazy) | spec 모듈 124개 import → binding 35개. 번들 < 500KB 기준에 우호 |
| 렌더 경로 단일화 | traversal 1개, backend 2개(DOM/Skia) | per-component `rendererMap` dispatch 제거 → branch prediction 단순화 |
| Skia 60fps + 엔터프라이즈 타깃 | generic 렌더러가 viewport culling/virtualization 을 **한 곳**에 구현 | 컴포넌트별 culling 중복 불필요. 단 **현재 culling 은 background grid 만 존재**(`gridRenderer.ts`), 노드/컬렉션 culling 은 net-new([목표], ⑩.4) |

> **성능 장점의 정직한 한계**: "런타임 정의 감소"는 측정된 회귀 개선이 아니라 **구조적 우호 조건**이다. 60fps 는 최저선(엔터프라이즈 타깃)이고, generic 렌더러의 text 측정(`canvaskitTextMeasurer` LRU)·특수 shape·spacing/fill resolver 재현 부담(⑨.2 T-3)이 오히려 per-component 최적화보다 무거울 수 있다. 실측 게이트(⑩) 없이 성능 우위를 단정하지 않는다.

#### (D) 접근성 축 — RAC 절대 권위 보존

| 장점 | 1차 원리 근거 |
| --- | --- |
| D1(ARIA/키보드/포커스)을 RAC 가 100% 소유 | RAC = unstyled accessible primitive. composition 은 prop 투영만 — ARIA 수동 작성 0 |
| leaf binding 이 D1 을 코드로 격리 | `binding.source.kind:"rac"` → `react-aria-components` runtime import. Skia 가 DOM 파싱 안 함(HC#9), DOM backend 는 RAC 가 직접 실행 |
| 접근성 회귀 = RAC 버전 회귀로 좁혀짐 | composition 코드가 ARIA 를 안 만드므로 접근성 버그 표면이 RAC upstream 으로 국한 |

> **접근성의 비대칭 주의**: DOM backend 는 RAC 가 실제 ARIA DOM 을 emit 하므로 접근성이 보장되지만, **Skia backend 는 시각만 그린다 — 접근성 트리가 없다**. 이는 의도된 분리(Builder 화면 = 시각 편집, Preview/Publish = 실제 접근성 DOM)이고 ssot-hierarchy.md D3 대칭("시각 결과 동일")에 정합하나, "Skia 도 접근 가능"이라는 오해를 막기 위해 명시한다.

### ⑨.2 트레이드오프 / 위험 — 정직한 취약점

| ID | 트레이드오프 | 심각도 | 깨지기 쉬운 지점 | 1차 원리 / 실측 근거 |
| --- | --- | :--: | --- | --- |
| **T-1** | generic 렌더러 공통 기반의 무게 — family 격리 안 됨 | HIGH | 공통 기반(resolve/generic DOM/generic Skia/Inspector/theme resolve) 1개 버그가 **모든 family 동시 회귀**. legacy 모델은 컴포넌트별 격리였음 | HC#10 이 cutover 는 family atomic 이지만, **공통 기반 자체는 family-무관 단일 코드**. breakdown Phase 0~5 가 전부 공통 기반인 이유 |
| **T-2** | 조합 컴포넌트 수작업 저작 | MEDIUM | reusable 문서를 Builder 안에서 손으로 조립 → 저작 누락/오류가 데이터에 직접. 자동 변환 금지(HC#6) | "깨진 spec 참조 금지"(HC#6, 사용자 제약 2026-05-19)의 직접 대가. Pencil 도 사람이 저작 — 자동화 불가가 원리 |
| **T-3** | Skia generic 이 `render.shapes` 재현 부담 | HIGH | text 측정 64 spec + 특수 shape 38 + ADR-907 spacing 4 + ADR-908 fill 30 resolver 를 generic Skia 가 재현해야 함 | **breakdown 2026-05-30 recalibration 이 명시**: 작업 #5 scope 가 추정보다 큼 → ADR R4 를 HIGH 승격, G2 를 2단계(DOM-first/Skia-rewrite)로 분해 |
| **T-4** | collection virtualization ↔ Taffy layout 연계 복잡도 | HIGH | viewport culling + virtualization 이 Taffy 레이아웃 결과(x/y/w/h)에 의존. 보이는 item 만 렌더하면서 전체 content height 는 알아야 스크롤바 정확 | SSOT 원칙 2. **현재 노드 culling 0**(background grid 만). collection 은 `skiaLegacy:true` 로 Skia 만 legacy fallback 중 |
| **T-5** | RAC 버전 의존 | MEDIUM | RAC breaking change → `toRacProps` 투영 + `binding.rac.states` 가 일괄 영향. 단 단일 wrapper surface(`shared/components`)로 국한(HC#7) | 대안 D(직접 import) 기각 사유의 이면 — wrapper 가 충격 흡수하지만 wrapper 자체가 RAC 결합점 |
| **T-6** | theme 다축 resolve 비용 + 현재 binary 한계 | MEDIUM | Pencil 다축(`Mode×Base×Accent` best-match)을 채택하면 resolve 비용 증가. **현재 `resolveToken` 은 light/dark binary**(`tokenResolver.ts:21`) — 다축은 미도입 신규 작업 | ②.3 정정: 다축 best-match 는 `[목표]` 별도 변경. binary 가 현재 정본 |
| **T-7** | Skia state 모델 미완 | HIGH | `racStateAttrs`/`computeSkiaStateAttrs` 가 `[목표]` 미구현. **현재 Skia 는 `default`/`disabled` 2개만 derive**(`buildSpecNodeData.ts:1146`) — hover/pressed hit-test wiring 없음 | ③ §3 정정. DOM 은 RAC 자동 emit 으로 이미 동작, Skia 만 미완 → 현재 Builder 화면에서 hover/pressed 시각 부재 |
| **T-8** | descendants 3-mode 런타임 판별 취약 | MEDIUM | TypeScript intersection brand 만으로 mode 강제 불가(메모리 함정). 직렬화 JSON 에서 `"type" in o ? B : "children" in o ? C : A` 런타임 검사 의존 | ②.4 정정 + `feedback-typescript-intersection-brand-trap`. resolver 가 런타임 discriminant 로 분기해야 안전 |

#### T-3/T-4 의 깨짐 시나리오 (가장 취약)

```
T-3 Skia render.shapes 재현 부담 — 구체 깨짐 경로:
  ADR-908 fill resolver (30개) : variant × fillStyle × state 2축을 buildCatalogShapes 가 재현
    → 현재 resolveSkiaFill(visual, fillStyle, attrs) 가 fill.default.{base,hover,pressed} 읽음 [실측]
    → 그러나 hover/pressed attrs 가 안 옴 (T-7) → base 만 그려짐 → DOM 과 hover 시각 비대칭
  ADR-907 spacing resolver (4개) : resolveContainerSpacing 을 buildCatalogShapes + calculateContentHeight 가 공유
    → Layer D 동일 resolver 심볼 호출 의무. generic 화 시 이 공유가 깨지면 Preview/Layout drift 재발

T-4 collection virtualization ↔ Taffy — 구체 깨짐 경로:
  보이는 item 만 렌더 → Taffy 는 전체 트리 레이아웃 계산 필요 (content height/스크롤바)
    → 부분 레이아웃 + 부분 렌더의 좌표 동기화 (scrollOffset 차감, canvas-rendering.md §8)
    → buildTreeBoundsMap / renderCommands 양쪽에 scrollOffset 차감 + scrollVersion 캐시 무효화 필요
  → 이 연계는 현재 0건 구현. SSOT 원칙 2 의 "엔터프라이즈 타깃"이 가장 미검증
```

### ⑨.3 SSOT 일관성의 잔존 위험 (R-S 시리즈)

ADR-142 의 핵심 약속(SSOT 4원칙)이 깨질 수 있는 정밀 지점. ⑨.1(A) 정밀화의 연장.

| ID | 위험 | 깨짐 메커니즘 | 차단 게이트 |
| --- | --- | --- | --- |
| **R-S1** | 두 backend 가 다른 rule 테이블/resolveToken 호출 | DOM=CSSGenerator(현재 spec 파생), Skia=resolveSkiaVisualRule(rule 테이블). **transition 중 둘이 다른 source 면 값 drift** | `/cross-check` family 마다 + `generate-rules.ts` 가 spec→rule build-time 복제로 값 동일 보장(전환기) |
| **R-S2** | sizes 축이 아직 spec.sizes (color 만 rule swap) | `resolveComponentVisual` 어댑터가 색상은 rule, sizes 는 아직 `spec.sizes`(`551a66c45` A-stage seam) | `[전환기]` 명시. sizes 축 rule swap 은 `[목표]` G2 후속 |
| **R-S3** | CSSGenerator 가 아직 spec 소비 | DOM backend 의 CSS 가 rule 테이블 전환 미완 → SSOT 단일 공급처 runtime 수렴 미달 | `[목표]` CSSGenerator rule 전환. 현재는 build-time 파생으로 값만 동일 |

> **정직한 결론 (R-S 시리즈)**: SSOT 원칙 1(4곳 fontSize:14 동일)은 **현재 build-time 파생으로 값이 동일**하고, **runtime 단일 공급처(rule 테이블) 수렴은 진행 중**이다. "이미 SSOT 가 하나"라고 단정하면 오독이다 — `generate-rules.ts` 가 spec 에서 rule 을 복제하는 동안은 spec 이 여전히 상류 source 다. 진정한 단일화는 spec 모듈 격리(legacy boundary) + CSSGenerator/sizes 축 rule 전환 완료 시점이다.

### ⑨.4 대안 대비 1차 원리 우위 (왜 다른 길이 더 나쁜가)

| 대안 | 1차 원리 결함 | 실측 기각 근거 |
| --- | --- | --- |
| **컴포넌트당 spec 확장 (대안 B)** | `render.shapes()` 는 시각을 **직접 그리는 함수** — RAC 의 parts/slots/render-prop state/collection children 구조를 표현 불가. `ReactRenderer` 는 className/dataAttr/style 만 산출 | RAC 원리(data/render 분리)와 정면 충돌. Builder↔Preview drift 가 구조적으로 반복(ADR-142 Context ①) |
| **컴포넌트당 contract 객체 (대안 C)** | 4 output 중 3개(`toGeneratedCss`/`toSkiaVisualModel`/`toInspectorFields`)는 **(문서 노드 + theme)의 함수**이지 컴포넌트당 계약의 산물이 아님. 컴포넌트당 두면 124×3 변환기 손유지 | canonical 문서와 평행한 **두 번째 SSOT** → upstream(starter)·downstream(canonical) 양쪽 drift. 직전 개정안(2026-05-18)이 이것이었고 사용자 기각 |
| **RAC 직접 import (대안 D)** | props mapping / canonical 정규화 / `toRacProps` 투영의 **단일 위치 소멸** → 57+ 파일 분산 | RAC 버전 업데이트가 제품 코드 곳곳 직접 타격. Inspector/Skia 연결점 분산 — Pencil 의 "데이터 1곳" 원리 위반 |

**1차 원리 핵심**: Pencil 은 "컴포넌트 = 데이터", RAC 는 "시각·조합 = 데이터(token/composition)". 두 원리 모두 **컴포넌트별 코드를 거부**한다. 대안 B/C 는 컴포넌트별 코드(spec/contract)를 유지하므로 두 원리 양쪽과 어긋난다. 대안 D 는 데이터 단일화(Pencil)를 버린다. 대안 E 만 두 원리에 동시 정합한다.

### ⑨.5 검증 안 된 가정 (정직한 미검증 목록)

| 가정 | 미검증 이유 | 확인 방법 |
| --- | --- | --- |
| generic Skia 가 124 render.shapes 의 시각을 **전부** 재현 가능 | text 측정/특수 shape/spacing·fill resolver re-home 이 G2(b) 진행 중 — 완료 안 됨 | family 마다 `/cross-check` 시각 대칭 통과 |
| collection virtualization 이 60fps 유지 | 노드 culling 0건, Taffy 연계 미구현 | List/Table 1000+ row fixture FPS 측정 |
| Pencil 다축 theme 를 composition 이 보존할 필요 있는가 | 현재 binary 로 충분한지 디자인 결정 미정 | 다축 요구 컴포넌트 실재 확인 후 결정 |
| 조합 컴포넌트 수작업 저작이 124개 spec 보다 빠른가 | Phase 2 저작 미완 | family 별 reusable 저작 실측 시간 |
| `racStateAttrs` SSOT 가 ComponentState enum 을 깨끗이 흡수 | `[목표]` 미구현, 평행 모델 2개 위험 | enum → derived 격하 후 회귀 0 확인 |

---

## ⑩ 구현 우선순위 및 단계별 Roadmap

> **현재 위치 (실측, 2026-05-31)**: family ①~⑧ DOM cutover 완료. G2(a)/(b) Skia-rewrite 진행 중(`resolveComponentVisual` 어댑터 → variant 색상 spec→rule swap → Tree Skia generic flip). 따라서 roadmap 은 **남은 경로**다. breakdown Phase 0~6 구조를 따르되, 이미 land 된 부분은 `[done]`, 진행 중은 `[진행]`, 미착수는 `[남음]` 으로 표기한다.

### ⑩.1 공통 기반이 family cutover 보다 선행해야 하는 이유 (1차 원리)

```
왜 공통 기반 먼저?
─────────────────
generic 렌더러 = family-무관 단일 코드 (T-1). family A 를 cutover 하려면 그 family 가
소비할 공통 기반(resolve + generic DOM + generic Skia + Inspector + theme resolve)이
먼저 존재해야 한다. 공통 기반 없이 family 를 전환하면 = 컴포넌트별 코드 부활 = 대안 C 회귀.

반대 순서(family 먼저)의 실패 경로:
  family A cutover → 공통 기반 부재 → family A 전용 렌더 코드 작성 → family B 도 전용 코드
  → 컴포넌트당 코드 N개 = 두 번째 SSOT = 대안 C = ADR-142 기각 대상
```

breakdown 이 Phase 0~5(공통 기반) 를 Phase 6(family 반복) 앞에 둔 이유가 정확히 이것이다. **공통 기반은 "한 번 짓고 모든 family 가 공유"하는 자산**이라 front-load + 단일 Gate(G1/G2)로 관리한다.

### ⑩.2 단계별 Roadmap — 산출물 / 게이트 / 위험

| 단계 | 산출물 | 검증 게이트 | 위험 | 상태 |
| --- | --- | --- | --- | --- |
| **Phase 0 — Freeze + Inventory** | 컴포넌트→family 배정 SSOT, FieldDef 11종→PropContract 매핑, Skia scope 실측 | inventory freeze, R9 잔여 식별 | LOW (단 freeze 부실 시 후속 scope inflation — recalibration 3회 발생) | `[done]` |
| **Phase 1 — 공통 기반 핵심** | `PrimitiveBinding` + generic 렌더러 + Preview resolved-tree 소비 | G1 (resolve 정확성, `resolver.test.ts` 26/26) | HIGH→완화 (resolver/`CanonicalNodeRenderer` 가 ADR-116/903 으로 이미 구현) | `[done]` (대부분 ADR-116/903 흡수, 잔여=`CanonicalNodeRenderer` catalog primitive generic 렌더) |
| **Phase 2 — Reusable 저작 + catalog** | 조합 컴포넌트 seed reusable 문서(`catalog/library/`), `componentCatalog.ts` | catalog 무결성 + family atomicity test | MEDIUM (수작업 저작 T-2) | `[진행]` |
| **Phase 3 — wrapper surface + legacy boundary** | `shared/components` RAC wrapper, `legacy/` 격리 | import surface allowlist (HC#7) | MEDIUM | `[진행]` |
| **Phase 4 — Panel + Factory 배선** | Panel/Factory 가 catalog 소비 | G3 불변식 C/D/E(ADR-139 contract test) | LOW (build-time 강제) | `[done]` (registration contract land) |
| **Phase 5 — CSS/Skia generic 정합** | generic CSS + Skia draw | G5 `/cross-check` (family 마다) | HIGH (T-3 Skia 재현) | `[진행]` (G2(b)) |
| **Phase 6 — Family atomic cutover** | family 순서대로 4경로 동시 전환 | G4/G5/G6 family 반복, G7 최종 | family 별 상이 | `[진행]` (DOM ①~⑧ done, Skia 진행) |

### ⑩.3 Skia generic 2단계 (DOM-first → Skia-rewrite) 의 위치 — 핵심 분해

breakdown 2026-05-30 recalibration 이 명시한 G2 2단계 분해가 roadmap 의 가장 중요한 구조다.

```
G2(a) DOM-first  [done/진행]                    G2(b) Skia-rewrite  [진행 — 최대 무게]
──────────────────────────────                  ──────────────────────────────────────
작업 #1·#3·#4·#7·#9 (F1~F4 + Inspector)         작업 #5 (buildSpecNodeData 재작성)
resolveCanonicalDocument / CanonicalNodeRenderer  + ADR-907 spacing resolver re-home
기존 자산 활용 → 저위험                            + ADR-908 fill resolver re-home (30개)
DOM backend = RAC 가 실제 실행                     + text 측정 64 spec 재현
                                                  + skiaPrimitive (arc/track/indicator)
                                                  → G2 최대 무게, HIGH (T-3)

  (b) 통과 전까지: Preview canonical 기본 ON(ADR-116) + Skia legacy fallback 유지
                  → primary 렌더 경로 회귀 차단
```

**실측 진행 (커밋 증거)**:
- `551a66c45` G2(b) A: `resolveComponentVisual` 어댑터 seam — spec.variants 직접 접근 수렴 (색상 축)
- `251594132` G2(b) B1: `buildCatalogShapes` variant 색상 spec→rule swap
- `e43f4dbf0` Inc1-B2: skiaPrimitive draw fn spec-free → variant→ComponentVisualRule
- `475c20987` G2(a): Tree Skia generic 발효 — skiaLegacy 해제

**collection virtualization 의 위치 (T-4)**: breakdown §3 이 "items generic 메커니즘 + Viewport Culling/Virtualization 은 **전 family cutover 후 일괄 과제**"로 못박는다. 즉 **G2(b) 다음, 전 family catalog 도달 후**다. 이유: collection(`skiaLegacy:true`)은 Skia 만 legacy fallback 으로 두고, DOM/Inspector 는 먼저 catalog 화. virtualization 은 가장 복잡(Taffy 연계)하므로 마지막 vertical slice 로 분리.

### ⑩.4 family 순서 + 난이도 (breakdown §5 SSOT)

| 순서 | Family | 난이도 | 1차 원리 난이도 근거 | DOM cutover | Skia |
| --- | --- | :--: | --- | :--: | :--: |
| 1 | primitives/actions | LOW | golden path 파일럿. binding + generic 패턴 확립. RAC Button = 가장 단순 D1 | `[done]` | `[진행]` |
| 2 | fields | LOW-MED | canonical props 검증. TextField 류 입력 prop 투영 | `[done]` | `[남음]` |
| 3 | selection | MED | state/data-attribute parity. Slider track = `skiaPrimitive`. **T-7 state 모델 미완이 여기서 표면화** | `[done]` | `[진행]` (indicator skiaPrimitive 분리, `078781ebd`) |
| 4 | collections | MED-HIGH | collections 데이터 binding(ADR-132). items 순회 = **T-4 virtualization 진입점** | `[done]` (`83e499475` Skia 게이트 채널 분리) | `[남음]` (skiaLegacy) |
| 5 | Tree·Table | HIGH | RAC primitive binding + collections 데이터. 수동 우회 금지(HC#11). 가장 깊은 트리 | `[done]` (`f4633a6d0`) | `[진행]` (Tree Skia generic `475c20987`) |
| 6 | overlays | MED | portal/overlay structural CSS escape hatch. Skia 는 overlay 시각만 | `[done]` (`8cd22fa5c`) | `[남음]` |
| 7 | date-color | MED | Calendar/ColorPicker = 절대좌표 텍스트 + arc. `[78912511c]` date DOM-only, color 제외 | `[done]` (date) | `[남음]` (color 보류) |
| 8 | composition-native | — | frame/Slot = 이미 canonical-native. metadata-only 등록 | `[done]` (`a670f5cd3`) | `[done]` |

> **난이도 1차 원리**: family 순서는 **D1 복잡도 오름차순**이다. primitives(단일 노드) → fields(입력 상태) → selection(indicator state) → collections(items 순회) → Tree·Table(중첩 트리). RAC 의 D1 책임이 깊어질수록 binding 의 state/slot 표현이 복잡해진다. golden path(primitives)에서 패턴을 확립하고 점증.

### ⑩.5 가장 빠른 SSOT 일관성 증명 — 검증 가능한 최소 vertical slice

```
최소 vertical slice = primitives/actions family 의 Button 1개를 4 consumer 전부 통과
───────────────────────────────────────────────────────────────────────────────
[입력]  CompositionDocument.children: [{ type:"Button", props:{ size:"sm", variant:"primary", children:"Save" } }]
        componentRulesTable["Button"].sizes.sm.fontSize = 14

[검증]  ┌─ DOM    : CanonicalNodeRenderer → toRacProps → <RACButton data-size=sm> → [data-size=sm]{font-size:14px}
        ├─ Skia   : resolveSkiaVisualRule("Button","primary") → buildCatalogShapes → paragraph.fontSize=14
        ├─ Panel  : buildInspectorFields(node) → size 필드 "sm" 표시
        └─ Publish: DOM backend 재사용 → font-size:14px 직렬화

[증명]  componentRulesTable["Button"].sizes.sm.fontSize 를 14→16 으로 바꾸면
        → 4 consumer 전부 16 으로 즉시 동일 반영 (단일 공급처 mutation → 4곳 동기)
        → /cross-check 시각 대칭 PASS = SSOT 4원칙 1회 실증
```

**왜 Button 인가 (1차 원리)**:
1. **D1 최단** — RAC Button 은 단일 노드, render-prop state(`isPending`) 1개. binding 작성이 가장 단순.
2. **4 consumer 전부 관통** — variant(data-*) + size(fontSize) + children(text) 가 DOM/Skia/Panel/Publish 모든 경로를 한 번에 exercise. SSOT 4원칙의 최소 완전 커버.
3. **이미 G2(b) 진입** — `buildCatalogShapes` variant 색상 spec→rule swap(`251594132`)이 Button 을 포함. 추가 비용 최소로 증명 가능.
4. **live behavior 게이트 충족** — CLAUDE.md "완료 기준"이 요구하는 "실제 builder 에서 1회 exercise"를 Button mutation → 4곳 동기로 직접 시연. test PASS 단독 종결 금지 조항 충족.

> **검증 우선순위 결론**: Button vertical slice(이미 진행 중) → primitives family Skia G2(b) 완결 → `/cross-check` 시각 대칭 PASS 가 **SSOT 일관성을 가장 빨리 증명하는 경로**다. 이것이 통과하면 generic 렌더러 공통 기반(T-1)이 검증되고, 나머지 family 는 같은 패턴의 반복이 된다. 반대로 이 slice 가 깨지면 공통 기반 설계 자체를 재검토해야 하므로, **최소 slice 통과 = 전체 아키텍처 risk gate**다.

### ⑩.6 잔여 HIGH 위험 → Gate 매핑 (관리 가능성)

| HIGH 위험 | 단계 | Gate | 실패 시 대안 |
| --- | --- | --- | --- |
| T-1 generic 공통 기반 무게 | Phase 1 | G1 + Button vertical slice(⑩.5) | slice 깨지면 공통 기반 재설계, family 진행 중단 |
| T-3 Skia render.shapes 재현 | Phase 5 / G2(b) | G5 `/cross-check` family 마다 | family 별 `skiaLegacy:true` 격리, 다음 family 진행 |
| T-4 collection virtualization | 전 family 후 | List/Table FPS fixture | virtualization 보류, collection Skia legacy 유지 |
| T-7 Skia state 모델 미완 | selection family | data-attribute parity test | `racStateAttrs` 도입 + ComponentState enum derived 격하 |

**관리 가능성 결론**: 모든 HIGH 위험이 **family 단위 격리 가능**(HC#10)하다. 한 family 가 Skia 재현 실패해도 `cutover:"legacy"` 유지로 그 family 만 격리, 다른 family 진행을 막지 않는다. 이것이 대안 E 의 HIGH(기술)가 "gate 로 막을 수 있는 1회성"인 이유 — 회복 불가능한 반복 유지보수 HIGH(대안 A/C)와 질적으로 다르다.

---
