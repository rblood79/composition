# ADR-912 Breakdown: RAC core + Pencil format 백지 직행 컴포넌트 아키텍처 (rebuild)

> 본 문서는 [ADR-912](../912-rac-pencil-rebuild-cutover.md) 의 구현 상세 — 1차 원리 기준선 / 현재 구현 재분류 / 영역별 설계 / HC 1:1 / 구현 순서.
> ADR 본문(Risk-First)에는 결정·대안·위험만 두고, 설계 본문은 이 breakdown 에 분리한다(adr-writing.md 스캐폴딩 규칙).
>
> **상태**: 설계 문서 (코드 변경 아님).

---

## 0. 기준선 — 1차 원리만, 현재 구현 답습 금지 (사용자 framing 2026-06-02)

> 사용자 framing: "참고내용이 또다시 결정에 이전 현재 구현 시스템을 답습하게 하는 것 아닌가." + "현재의 구현 방식을 따르지 않아도 된다 — 문제점을 다시 반복하게 될 수가 있다."

본 ADR 의 기준선은 **1차 원리(RAC core + Pencil format + canonical document schema + theme/tokens)** 뿐이다. ADR-142 가 만든 현재 구현 자산(`buildCatalogShapes`/`componentCatalog`+`cutover`/`resolveComponentVisual`/binding 의 variant·size accepts 구조)은 **자동 재사용(KEEP) 대상이 아니다** — 각각 "1차 원리의 직접 구현인가 vs 전환기 seam 부채인가"로 재판정한다. 메모리 [[project-rac-pencil-redesign-converges-adr142]]: `buildCatalogShapes` 가 spec 읽는 seam / `resolveComponentVisual` seam / variant·size 를 binding accepts 로 두는 것 = **전환기 부채**로 이미 명시됨.

리서치(`docs/explanation/research/PENCIL_ECOSYSTEM_ANALYSIS.md`)는 **schema 외부 검증에만** 인용한다 — openpencil `PenDocument` 의 RefNode/reusable/slot 1:1 정합 = canonical schema 방향이 업계 표준이라는 근거. §6 "ADR-142 구현이 openpencil 과 정확 정합"이라는 구현-레벨 정합 주장은 **인용하지 않는다**(현재 구현 답습 유도 source). fallback 우회(openpencil Paper.js)도 차용 안 함([[feedback-no-fallback-thinking]]).

---

## 목차

- [① 진단 확정 (실측)](#영역-진단)
- [② 1차 원리 기준 재분류 — 원리 직결 / seam 부채 / 신규](#영역-경계)
- [③ 영역 A — Component Schema + generic 렌더러 + 단일 어댑터](#영역-a)
- [④ 영역 B — Collection Interactive Projected Tree](#영역-b)
- [⑤ 영역 C — 편집 계약 + 패널 + Skia state](#영역-c)
- [⑥ HC ↔ 구조 1:1 증명](#영역-hc)
- [⑦ 구현 순서 (proof surface 단계 축소)](#영역-순서)
- [⑧ 핵심 파일](#영역-파일)

---

<a id="영역-진단"></a>

## ① 진단 확정 (실측)

| 측정                                                | 수치                                                                                                                                          | 위치                                                                          |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `*.spec.ts` (구 정본)                               | 124                                                                                                                                           | `packages/specs/src/components/`                                              |
| `render.shapes()` active 호출 (test/spec 정의 제외) | 59                                                                                                                                            | dispatch `buildSpecNodeData.ts:1116` + active 경로                            |
| `*.binding.ts`                                      | 39                                                                                                                                            | `packages/shared/src/catalog/bindings/`                                       |
| `cutover`/`skiaLegacy` 필드                         | entry union 전부                                                                                                                              | `types.ts`                                                                    |
| 6 레지스트리                                        | Factory creators 60 / rendererMap 95 / getDefaultProps(DEFAULT_PROPS_MAP 96) / BASE_TAG_SPEC_MAP 111 / builder TAG_SPEC_MAP / Component Panel | 다수                                                                          |
| `buildSpecNodeData.ts` 컴포넌트별 if 분기           | 30+ (1416줄 중 ~1100줄)                                                                                                                       | `resolveProgressProps`/`SHELL_ONLY_CONTAINER_TAGS`/`COLUMN_REARRANGE_TAGS` 등 |
| `resolveEditContract`/`toReactStyle`/`toSkiaStyle`  | 0                                                                                                                                             | 미존재                                                                        |

**근본 진단**: ADR-142 가 catalog/binding 신구조를 _추가_ 했으나 구 정본을 _제거하지 않아_ 신·구 두 정본이 동시에 사는 **dual-SSOT 전환기**. ADR-910 의 cutover 전략(병치 + 게이트)은 이 병치를 _유지_ 하므로 사용자 지시("레거시 남기지 마라")와 충돌, "문제 반복". **그리고 catalog/binding 신구조 자체도 spec 을 읽는 seam(`buildCatalogShapes`)·variant→VisualRule seam(`resolveComponentVisual`)·variant·size 를 accepts 로 두는 전환기 타협을 품고 있어 — 단순 KEEP 이 답습이다.**

---

<a id="영역-경계"></a>

## ② 1차 원리 기준 재분류 — 원리 직결 / seam 부채 / 신규

### 2-1. 1차 원리 직결 (그대로 토대) — RAC + Pencil format + schema + theme

현재 구현 시스템이 아니라 **1차 원리 그 자체**라 유지한다.

| 자산                                                                                                                              | 위치                                                          | 1차 원리                                                                                                    |
| --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `react-aria-components` (npm)                                                                                                     | (외부)                                                        | RAC core — D1 절대 권위 (HC#6)                                                                              |
| canonical document schema (`RefNode`/`reusable`/`slot`/`descendants`/flat node)                                                   | `composition-document.types.ts` (ADR-116/122/130)             | Pencil format — 컴포넌트=데이터 (HC#5). openpencil 1:1 정합(schema 외부 검증)                               |
| theme/tokens (OKLCH relative-color, light/dark/다축)                                                                              | `tokens` root collection (ADR-110/143)                        | D3 시각 SSOT base 층 (HC#3)                                                                                 |
| `resolveToken` (token 값 해소)                                                                                                    | `tokenResolver.ts`                                            | token → 값 해소 — 원리 직결 (단일 어댑터 내부 호출)                                                         |
| Components system page (`page-components`, reusable origin 저장 위치)                                                             | `builder/pages/systemComponentsPage.ts` + `isRuntimePageNode` | Pencil "컴포넌트=데이터" 의 저장 위치 (ADR-146, 사용자 확인 2026-06-02). 갈아엎기 아님, 조합 family 로 확장 |
| ADR-135/136 Render-Space Interaction Boundary (`renderNodesMap`/`interactionNodesMap`/`isRenderProjectionId`/projected id 비영속) | `workspace/canvas/scene/` + `projection/`                     | projected tree 토대 (HC#7). collection 으로 일반화                                                          |
| hit-test 파이프라인 (`hitTestPoint`/`pickTopmostHitElementId` depth+z-index)                                                      | `renderers/renderCommands.ts` + `selectionHitTest.ts`         | deep hit-test 토대 — 원리 무관 인프라                                                                       |

### 2-2. 전환기 seam 부채 (재설계 — 단순 KEEP 금지)

ADR-142 가 점진 전환을 위해 만든 seam·타협. **현재 구현 방식 답습 = 문제 반복**이므로 1차 원리로 재설계한다.

| 부채                                                               | 위치                                        | 부채 성격                                                               | 재설계 방향                                                                                                                            |
| ------------------------------------------------------------------ | ------------------------------------------- | ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `buildCatalogShapes` 가 spec/VisualRule 읽는 seam                  | `renderers/buildCatalogShapes.ts`           | spec 시각을 generic box+text 로 환원하는 전환기 어댑터 — spec 의존 잔존 | `toSkiaStyle` 이 **노드 보편 속성(merged style) 직접 → Skia shape**. spec 미경유. box+text 는 보편 속성의 결과이지 spec 함수 출력 아님 |
| `resolveComponentVisual` (variant → ComponentVisualRule 매핑) seam | `renderers/utils/resolveComponentVisual.ts` | variant 를 컴포넌트별 VisualRule 로 매핑하는 중간 seam                  | theme rule(`resolveComponentRule`)이 variant→시각값을 직접 resolve. 중간 VisualRule 객체 제거                                          |
| `binding.props.accepts` 에 variant·size 를 둔 구조                 | `bindings/*.binding.ts` + `types.ts`        | variant·size 가 D2 의미값인데 accepts(편집 prop)에 섞여 전환기 평면화   | variant·size 는 `node.props`(의미값), 시각은 theme rule resolve. accepts 는 RAC D1 투영 prop 만                                        |
| `componentCatalog` 의 `cutover: CutoverState` / `skiaLegacy` 필드  | `componentCatalog.ts` + `cutover.ts`        | 점진 전환 상태 구조물                                                   | 제거 — 백지엔 "전환 중" 상태 없음. 등록은 family 무관 단일 entry(원리: leaf binding / reusable ref / native)                           |
| `PrimitiveBinding` 39개 현 구조                                    | `bindings/*.binding.ts`                     | RAC 투영 골격은 원리지만 variant·size accepts 혼입은 부채               | RAC 투영부(`toRacProps` 식별자 + rac parts/slots/states)만 1차 원리로 유지, variant·size accepts 분리                                  |
| `buildSpecNodeData` 컴포넌트별 분기 30+                            | `buildSpecNodeData.ts` ~1100줄              | 컴포넌트 식별 분기 = no-classification 위반                             | generic traversal — `(entry.kind, source.kind)` 2축만, type 이름 0                                                                     |

### 2-3. 제거 (DELETE) — 구 정본 + 점진 전환 구조물

| 대상                                                                       | 위치                                                                                                          | 근거                                                                                                                                                                  |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `*.spec.ts` 124개 + `render.shapes()` active 59                            | `packages/specs/src/components/`                                                                              | 컴포넌트당 코드 정의 = HC#5 위반. theme rule 이 시각 흡수 — **단, 삭제 전 theme rule source 를 ②-6 대로 `componentRulesTable.ts` 직접 SSOT 로 먼저 전환** (선행 의존) |
| `generate-rules.ts` 변환기 + `pnpm generate:rules` step                    | `packages/specs/scripts/generate-rules.ts` + `package.json:34,40`                                             | spec→rule 변환기. spec 삭제 시 입력 소멸 → ②-6 으로 source 자체를 직접 SSOT 로 승격하므로 변환기 자체 제거                                                            |
| `cutover.ts` 게이트 전체                                                   | `catalog/cutover.ts` + `componentCatalog.ts:435-460`                                                          | 게이트 = 두 경로 병치 증거                                                                                                                                            |
| `buildCatalogShapesOrPrimitive` 병치 dispatch                              | `buildSpecNodeData.ts`                                                                                        | generic↔legacy 게이트                                                                                                                                                 |
| 6 레지스트리 중 5개                                                        | Factory 60 / rendererMap 95 / getDefaultProps(DEFAULT_PROPS_MAP 96) / TAG_SPEC_MAP(BASE_TAG_SPEC_MAP 111) 2종 | 단일 등록 collapse                                                                                                                                                    |
| `CanonicalNodeRenderer` legacy `rendererMap` 위임                          | `CanonicalNodeRenderer.tsx:216-228`                                                                           | generic 경로만                                                                                                                                                        |
| 패널 `getEditor`/`registry.ts`/`GenericPropertyEditor`/per-type pre-editor | `inspector/editors/`                                                                                          | 컴포넌트별 동적 에디터 분기                                                                                                                                           |
| `StylesPanel` 4 하드코딩 섹션                                              | `StylesPanel.tsx:37-46`                                                                                       | section 필터로 대체                                                                                                                                                   |
| (금지) Paper.js boolean ops 류 fallback 우회                               | —                                                                                                             | `feedback-no-fallback-thinking`                                                                                                                                       |

### 2-4. 신규 도입 (NEW) — 1차 원리의 직접 구현

| 신규                                                                                   | 역할                                                                                                         | HC         |
| -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ---------- |
| `ComponentNode` schema 확정 (props.style = override-only, props.variant/size = 의미값) | 의미 props + 시각 override layer                                                                             | HC#1, HC#3 |
| `resolveMergedStyle(node, doc)`                                                        | 두 backend 공유 병합 코어 `style[k] ?? resolveComponentRule(...).resolve(k)`. spec 미경유                    | HC#3       |
| `toReactStyle(node, doc)`                                                              | merged style → `React.CSSProperties` (DOM). 보편 속성 직접                                                   | HC#3       |
| `toSkiaStyle(node, doc)`                                                               | merged style → `Shape[]` (보편 속성 → box+text+비-box primitive 직접). spec/`buildCatalogShapes` seam 미경유 | HC#3, HC#4 |
| `resolveEditContract(node, doc)`                                                       | accepts(D1 투영) ∪ 의미 props(variant/size) ∪ 보편 시각 속성. origin 태그                                    | HC#1, HC#2 |
| `racStateAttrs(node, interaction)`                                                     | RAC `data-*` → state derive                                                                                  | HC#6       |
| generic `collectionProjector`                                                          | template subtree × visible window → projected cell tree                                                      | HC#4, HC#7 |
| `resolveCollectionWriteTarget(projectionId)`                                           | projected id → template/data/override 3-route                                                                | HC#7       |
| 단일 등록 entry (cutover/skiaLegacy 없는 catalog)                                      | leaf=RAC 투영 / 조합=reusable ref / native=frame                                                             | HC#5       |

### 2-5. 6 레지스트리 → 단일 등록 collapse — "1 컴포넌트 = 1 등록" (사용자 1순위 목표)

> **사용자 명시 (2026-06-02)**: "기존 시스템에 컴포넌트 등록 시 6중복 — 새 컴포넌트마다 6개 registry 동시 등록 → 누락/drift 반복되는 문제는 해소되길 바란다." 이것이 ADR-912 의 **가장 사용자-가시적 1순위 성공 기준**이다.

**현재 (6중복 등록)** — 새 컴포넌트 1개 추가 시 6곳에 손으로 등록, 어긋나면 등록 누락 + CSS/Skia drift:

| #   | registry                              | 위치                                | entry 수 |
| --- | ------------------------------------- | ----------------------------------- | -------- |
| 1   | ComponentFactory `creators`           | `ComponentFactory.ts:103`           | 60       |
| 2   | `rendererMap`                         | `shared/renderers/index.ts:19`      | 95       |
| 3   | `DEFAULT_PROPS_MAP` (getDefaultProps) | `unified.types.ts:2278`             | 96       |
| 4   | `BASE_TAG_SPEC_MAP`                   | `specs/runtime/tagToElement.ts:136` | 111      |
| 5   | builder `TAG_SPEC_MAP`                | `sprites/tagSpecMap.ts`             | (merged) |
| 6   | Component Panel list                  | panel                               | -        |

> ADR-139 의 `componentRegistrationContract.test.ts` 는 이 6중복을 **강제 동기화**(누락 시 FAIL)하는 보조 게이트다 — 6중복 _자체_ 는 못 없앤다. ADR-912 는 6중복을 소멸시켜 **이 게이트를 졸업**시킨다.

**ADR-912 (단일 등록 = 1곳)** — 6 registry 가 단일 entry 의 **파생 view** 가 된다. 새 컴포넌트 추가 = entry 1개(leaf) 또는 reusable 문서 1개(조합):

```
                              ┌─ 1. palette        ← entry.panel
                              ├─ 2. factory default ← entry.accepts default / reusable 문서
   단일 등록 entry  ──derive──┼─ 3. DOM 렌더        ← entry.source.kind + toReactStyle
   (catalog, 1곳)             ├─ 4. Skia 렌더       ← entry.source.kind + toSkiaStyle
                              ├─ 5. type 해석        ← entry.type (BASE/builder TAG_SPEC_MAP 흡수)
                              └─ 6. Inspector       ← resolveEditContract(node) (entry + theme rule)
```

- **6 소비처가 손 등록이 아니라 단일 entry 에서 파생** → 등록할 "다른 곳"이 구조적으로 0 → 누락/drift 불가능.
- 조합 컴포넌트 = **Components page body 의 reusable origin 문서**(데이터, 코드 0). 새 조합 추가 = 빌더 저작 → reusable 승격, entry 코드 변경도 0. content page 노드는 `{type:"ref", ref:<originId>}`.
- leaf 추가 = entry 1개(RAC 투영 + 보편속성). entry 분기 축 = leaf / reusable / native 3종(원리)뿐. `cutover`/`skiaLegacy`(전환 상태) 없음.
- origin 저장/추출(`withOriginsInComponentsBody`/`collectOrigins`/`stripOrigins`)은 ListBox 전용 → family 무관 일반화.

**drift 구조적 불가능 증명**: 6 소비처가 모두 `lookupEntry(type)` + `resolveComponentRule(type)` + `resolveEditContract(node)` 단일 source 에서 파생하므로, 한 컴포넌트의 정의가 두 곳에 따로 존재하지 않는다 → "한쪽만 갱신해서 어긋나는" drift 가 발생할 평행 위치가 없다. ADR-139 게이트(6중복 강제 동기화)는 **불필요해져 제거**(졸업)된다 — 대신 "entry universe = 렌더·Inspector·palette 가 모두 같은 entry set 을 소비"라는 단일 contract test 로 대체(누락 자체가 컴파일·런타임에 불가능하면 게이트도 최소).

> 경계 원칙: collapse 후 렌더 dispatch 는 `(entry.kind, source.kind)` 2축만 가른다. **type 이름 분기 코드 0**.

### 2-6. theme rule base 층 source 전환 — spec 삭제의 선행 의존 (codex review 2026-06-02 결함 2)

> **결함**: ②-3 은 `*.spec.ts` 124 삭제를 말하지만, 현재 base 층(`COMPONENT_RULES_TABLE`)은 `generate-rules.ts` 가 124 spec 의 variants/sizes/fill 을 build-time 변환해 생성한다(`generate-rules.ts:4` 주석 "spec 은 본 생성기의 build-time source 로만 잔류" + `package.json:34,40` `build:specs`→`generate:rules`). spec 을 그냥 삭제하면 변환기 입력이 사라져 **base 층(HC#3 의 base)이 통째로 정의되지 않는다** → base/override 2층 schema 의 base 가 붕괴.

**결정 (사용자 confirm 2026-06-02)**: theme rule base 를 **`componentRulesTable.ts` 직접 SSOT** 로 둔다.

| 항목                   | 현재 (전환기)                                            | ADR-912 (직행)                                                         |
| ---------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------- |
| base 층 source         | `*.spec.ts` 124 (variants/sizes/fill)                    | **`componentRulesTable.ts` 1차 SSOT** (사람 저작/편집)                 |
| 생성 단계              | `generate-rules.ts` 변환 (`pnpm generate:rules`)         | **없음** (변환기·step 삭제)                                            |
| 생성물 위치            | `shared/catalog/generated/componentRulesTable.ts` (자동) | `shared/catalog/componentRulesTable.ts` (`generated/` 접두 제거, 수동) |
| `resolveComponentRule` | 이 테이블 read                                           | 위치·시그니처 무변경, 이 테이블 read                                   |

**왜 직접 SSOT 인가** (대안 비교):

- 대안 ②-6-A (componentRulesTable 직접 SSOT, **채택**): 중간 변환 0, base 층이 단일 파일에 직접 존재 → "갈아엎기 + 레거시 미보존" 정합. spec 124 + 변환기 동시 삭제.
- 대안 ②-6-B (per-component rule 파일 N개): 컴포넌트당 파일 1개 유지 → 사실상 spec 리네이밍, HC#5("컴포넌트당 정의 파일 폐기")와 충돌. 기각.
- 대안 ②-6-C (generate-rules 유지 + spec 축소): spec 완전 삭제 아님 → "레거시 남기지 마라" 부분 충돌. 기각.

**삭제 순서 (선행 의존)**: ②-3 의 spec 124 삭제는 **②-6 의 직접 SSOT 전환 완료 후** 수행한다. 순서 — (1) `generated/componentRulesTable.ts` 현 생성 결과를 `catalog/componentRulesTable.ts` 로 동결(snapshot)·승격 → (2) `resolveComponentRule` import 경로 갱신 → (3) `generate-rules.ts` + `pnpm generate:rules` step 삭제 → (4) `*.spec.ts` 124 + `render.shapes()` 삭제. base 층이 한 순간도 정의되지 않는 구간이 없도록 한다.

**보존 구조**: ADR-907 Layer B(spacing) / 908 fill / 909 longhand 의 시각 값은 이 테이블의 필드(`sizes`/`variants.fill`/spacing)로 직접 표현된다 — fill/spacing/longhand override layer 는 유지.

---

<a id="영역-a"></a>

## ③ 영역 A — Component Schema + generic 렌더러 + 단일 어댑터 (HC#1/#3/#5)

### 3-1. Component Schema (`ComponentNode`)

```ts
interface ComponentNode {
  id: string; type: string;
  props: {
    variant?: string; size?: string;         // 의미값 (D2) — accepts 가 아니라 props 의미층
    [semanticKey: string]: unknown;
    style?: Partial<StyleOverride>;          // 시각 override 층 (D3) — base 절대 없음
  };
  children?: ComponentNode[];
  reusable?: boolean;                         // origin (Components page body, HC#5)
  ref?: string;                              // instance → reusable origin id
  descendants?: Record<NodePath, { props?: Partial<...> }>;  // instance override (노드 간 분리)
  slot?: Record<SlotName, NodeId[]>;
}
```

병합 의미 (HC#3):

```
base(k)     = resolveComponentRule(type, doc).variants[variant].* / .sizes[size].*   // theme rule 직접, VisualRule seam 없음
override(k)  = node.props.style[k]                                                   // 키 존재 = override
merged(k)    = override(k) ?? base(k)
reset(k)     = delete node.props.style[k]
instance(k)  = descendants[path].props.style[k]  over  origin base
```

변경 본질 = (1) default 를 노드에서 빼서 theme rule 로, (2) variant·size 를 accepts 가 아니라 의미 props 로, (3) 시각 resolve 를 `resolveComponentVisual` VisualRule seam 없이 theme rule 직접.

### 3-2. generic traversal — 분기는 `(entry.kind, source.kind)` 2축뿐

```
renderNode(node, doc, backend):       // backend ∈ {DOM, Skia}
  entry = lookupEntry(node.type)
  switch (entry.kind, entry.source.kind):
    (leaf, "rac"):
        DOM  → <RAC[component] {...toRacProps(node)} style={toReactStyle(node,doc)}> children </RAC>
        Skia → skiaNode(toSkiaStyle(node,doc), children)
    (leaf, "internal"):                         // Icon 등
        DOM  → <INTERNAL[renderer] {...toRacProps} style={toReactStyle}/>
        Skia → skiaNode(toSkiaStyle, ...)
    (reusable, _):                              // 조합 = 데이터
        resolved = resolveReusable(node.ref, node.descendants, doc)   // ref → Components page origin + override
        return renderNode(resolved, doc, backend)
    (native, _) | default:                      // frame/Slot
        DOM  → <div style={toReactStyle}> children </div>
        Skia → skiaNode(toSkiaStyle, children)
  if isCollection(entry): return renderProjected(node, window, doc, backend)   // 영역 B
```

### 3-3. 단일 어댑터 — 보편 속성 직접, spec/VisualRule seam 미경유

```ts
// ★ 두 backend 가 같은 출력을 읽음 = 시각 대칭 단일 진실 (HC#3, R-2). spec 미경유.
resolveMergedStyle(node, doc):
  rule = resolveComponentRule(node.type, doc)            // theme rule 직접 (VisualRule seam 없음)
  base = rule.resolve({ variant: node.props.variant, size: node.props.size })   // variant·size → 시각값 직접
  override = node.props.style ?? {}                      // override-only
  return mergeByKey(override, base, (k,v) => resolveToken(v, doc))   // override ?? base

toReactStyle(node, doc) = cssPropsFrom(resolveMergedStyle(node, doc))

toSkiaStyle(node, doc):
  m = resolveMergedStyle(node, doc)
  // 보편 속성 → Skia shape 직접: box(fill/border/radius) + text(font/color) + 비-box primitive(arc/track/indicator)
  // spec.render.shapes / buildCatalogShapes(spec 읽는 seam) 미경유 — m 의 보편 속성만으로 합성
  return composeSkiaShapes(m)   // node type 별 비-box 분기(ellipse/line/icon/arc)만, 컴포넌트별 분기 0
```

책임 수렴: base 해소(theme rule 직접)/override 병합/token 해소/spacing·padding/shorthand↔longhand 가 `resolveMergedStyle` 한 곳. `applyInlineBorderOverlay` 같은 사후 override 우회로는 `override.borderColor ?? base` 로 흡수 소멸. `resolveComponentVisual` VisualRule seam·`buildCatalogShapes` spec seam 제거. `/cross-check`(G-adapter)는 `resolveMergedStyle` 한 곳 검증.

> `toRacProps`(D1 ARIA 투영)는 `toReactStyle`(D3 스타일)과 별도 채널 — RAC 절대 권위(HC#6).

---

<a id="영역-b"></a>

## ④ 영역 B — Collection Interactive Projected Tree (HC#4/#7)

### 4-1. canonical 저장 vs projected (비영속)

```
canonical (CompositionDocument / IndexedDB / history)
  collection node (ListBox/Table/Menu/...)        ← 저장
    ├─ dataBinding / props.items (data ref)        ← 저장 (값 아닌 참조)
    └─ template subtree (Components page reusable origin)  ← 저장 (1벌): Icon{icon}/Text{label}/Text{description}

render-space (renderNodesMap / interactionNodesMap, 비영속)
  collection node
    └─ RowsGroup → Row[i] → cell(Icon/Text/Text)   ← window 내 행만, template subtree 를 행마다 전개
```

현 코드와 결정적 차이: **template subtree 를 행마다 projected sub-node 로 전개** (현재는 suppress + `render.shapes` 단일 leaf → deep hit 불가).

### 4-2. generic projector (ListBox 인라인 → family 무관, render-space build 시점 주입)

```
projectCollection(src, out):       // out = {renderNodesMap, interactionChildrenMap} render-space ONLY
  emit group (collection-rows)
  for row in src.rows[window.start:window.end]:        // 4-4 window
    emit row (collection-row, editTarget:"data")
    for tnode in walkTemplate(src.templateRoot):        // ★ HC#7: 행마다 cell 전개
      emit cell (parentId=rowId, props=bindTemplateData(tnode,row),
                 projection:{kind:"collection-cell", templateNodeId, role, editTarget})
```

`bindTemplateData` 는 영역 A 단일 어댑터(`toSkiaStyle`/보편속성)와 같은 resolver 호출 — cell leaf 는 generic 경로로 그려짐(spec seam 미경유). text Skia 정상 렌더 → `skiaLegacy` 폐기.

projectionId 규약: `projection:<family>:<ownerId>:{rows|row:<itemKey>|cell:<itemKey>:<templateNodeId>}`. `isRenderProjectionId` 를 `projection:` prefix 단일 판정 일반화 (ListBox 전용 prefix 폐기).

ADR-135/136 일반화 매핑:
| ADR-135/136 (page-frame) | ADR-912 (collection) | 형태 |
| --- | --- | --- |
| renderNodesMap/interactionNodesMap | projected row/cell 여기만 주입 | 재사용(원리) |
| projected ID `::page-frame::` | `projection:<family>:...` prefix | 일반화 |
| `CanvasProjectionMetadata.page-frame-element` | `.collection-cell` variant 추가 | union 확장 |
| `resolveCanvasInteractionTarget` slot-guard | collection-cell → drill-in | 함수 확장 |
| `resolveCanonicalMoveTarget` | collection cell → template/data/override route | 함수 확장 |

### 4-3. deep hit-test + drill-in + edit route (HC#7)

cell 가 `renderNodesMap` 에 parent-chain 으로 있으면 `pickTopmostHitElementId`(depth) 가 deepest 자동 선택 — 신규 hit 알고리즘 0.

```
single: collection-cell → select-projected(projectionId 비영속, canonicalOwnerId panel anchor)
        collection-row → select(ownerNodeId)
double + collection-cell: editTarget=="data" → edit-data / "template" → edit-template / "override" → edit-override
```

3-route 변환 (`resolveCollectionWriteTarget`, mutation 전 필수):

- **style edit** → `template` route (origin 노드, 모든 행 반영)
- **content edit** → `data` route (collections/binding, 구조 불변)
- **per-row override** → `override` route (`RefNode.descendants[itemKey/templateNodeId]`, ADR-135 D5)

### 4-4. virtualization (HC#4, 하드 100 제거)

```
computeCollectionWindow({ ownerLayout, viewportScene, rowOffsets(prefix-sum), totalRows, overscan }):
  start = clamp(lowerBound(rowOffsets, viewportScene.top - ownerLayout.y) - overscan, 0, totalRows)
  end   = clamp(upperBound(rowOffsets, viewportScene.bottom - ownerLayout.y) + overscan, 0, totalRows)
```

projector 는 `rows.slice(start,end)` 만 전개. projected 노드 수 = (end-start)×(1+templateNodeCount) ≤ (window+2·overscan)×templateSize, totalRows 무관(O(window)).

template layout cache: `sceneVersion` 키 → style edit(template route) → `projectionContentSignature` 변경 → 자동 stale (독립 cache 금지, ADR-136). signature input 에 `{ownerId, windowStart/End, dataLength, dataVersion}` 보강. viewport=viewportVersion / scene 재빌드=sceneVersion 분리 → pointer hot path full-rebuild 회피(60fps).

### 4-5. canonical boundary guard (HC#7)

1. `assertCanonicalMoveTarget` 가 `isRenderProjectionId`(prefix 일반화)로 reject.
2. `resolveCollectionWriteTarget` 유일 mutation entry, 반환 canonical target 만 API 전달. projectionId 출력 없음.
3. selection 은 `canonicalOwnerId` 영속 (projectionId 비영속, ADR-135 D3).
4. projected 노드는 `sceneNodesMap` 미진입. `renderNodesMap.get ?? sceneNodesMap.get` fallback 금지(canvas-rendering.md §9).

negative fixture: projected cell id → mutation API throw / template-edit 후 doc 에 `projection:` 0건 / 10k row 노드 ≤ window+overscan / refresh 후 IndexedDB `projection:` 0건.

---

<a id="영역-c"></a>

## ⑤ 영역 C — 편집 계약 + 패널 + Skia state (HC#1/#2/#6)

### 5-1. `resolveEditContract(node, doc)` 단일 진입점 (HC#2)

`shared/catalog/resolvers/resolveEditContract.ts` (specs 미import).

```ts
interface ResolvedField { key: string; kind: InspectorFieldKind; section: Section;
  origin: "semantic" | "style"; isOverridden: boolean; baseValue: unknown; currentValue: unknown; ... }
interface EditContract { type: string; fields: ResolvedField[]; instancePath?: string; }

resolveEditContract(node, doc):
  # (A) semantic → Properties view: D1 투영 prop(accepts) ∪ 의미 props(variant/size — accepts 아님)
  for [k,c] of semanticContracts(node): push({...c, key:k, origin:"semantic",
      isOverridden: hasOwn(props,k), currentValue: props[k] ?? c.default })
  # (B) universal visual → Style view: 모든 노드 공유 보편 시각 키 공간(컴포넌트 분기 0)
  for [k,c] of UNIVERSAL_STYLE_CONTRACTS: push({...c, key:k, origin:"style",
      isOverridden: hasOwn(style,k), baseValue: resolveStyleBase(k, rule, props),
      currentValue: style[k] ?? base })
  return { type, fields, instancePath: resolveInstancePath(node) }
```

`UNIVERSAL_STYLE_CONTRACTS` = section-tagged 단일 표 (transform/appearance/layout/typography). variant·size 는 (A) semantic, 시각 base 는 theme rule resolve(VisualRule seam 없음). round-trip 무손실 = `origin` discriminant write 라우팅. style-ssot.md 보존: longhand 우선 읽기, dirty/reset 키는 contract 키 파생.

### 5-2. 패널 = section 필터 두 view (HC#2)

```
PropertiesPanel: GenericFieldRenderer(fields.filter(section ∈ {content,state,locale}))
StylesPanel:     GenericFieldRenderer(fields.filter(section ∈ {transform,appearance,layout,typography}))
```

`getEditor`/4 하드코딩 섹션 삭제. `PropContract.section` union 에 `transform|layout|typography` 추가.

### 5-3. generic field renderer

`switch(field.kind)` 9종 dispatch, 컴포넌트 분기 0. `onUpdate` 가 `field.origin` 라우팅(semantic→props / style→props.style+distributeShorthand). style-origin number 는 `PropertyUnitInput`(lastSavedValueRef commit + focus-skip).

### 5-4. Skia state 모델 (HC#6)

`racStateAttrs(node, interaction)`:

```
disabled if props.isDisabled / pressed if interaction.pressedId===id / selected if props.isSelected
  / hover if interaction.hoveredId===id || hoveredLeafIds.includes(id) / focusVisible if focusedId===id / default
```

`interaction` = `hoverStateRef` + 신규 `pressedRef`/`focusedRef`, traversal 진입 직전 주입. state → `resolveMergedStyle` 의 `rule.resolve({...,state})` 분기. DOM parity = 두 backend 가 같은 theme rule[state] base ⊕ override. `overlayVersionRef` bump → scene invalidation(60fps). projected 노드는 `projectionId` 키 per-row state.

### 5-5. base/override 편집 동작 (HC#3)

reset=`delete props.style[k]`(longhand 그룹). size 변경 → baseValue 재resolve, override 무변(별도 키 공간). instance override = `descendants[path]` 라우팅, reset 은 path 제거 → origin base.

---

<a id="영역-hc"></a>

## ⑥ HC ↔ 구조 1:1 증명

| HC                     | 충족 구조                                                                                        | proof Gate       |
| ---------------------- | ------------------------------------------------------------------------------------------------ | ---------------- |
| HC#1 단일 공급원       | ②③ `ComponentNode` + `resolveMergedStyle`(theme rule 직접) + 6 레지스트리→단일, type-name 분기 0 | G-slice          |
| HC#2 패널 두 view      | ⑤ `resolveEditContract` 단일 + section 필터                                                      | G-slice          |
| HC#3 base/override 2층 | ③ `resolveMergedStyle` `??`(VisualRule seam 없음), reset=delete                                  | G-adapter        |
| HC#4 Skia 성능         | ④ window(하드 100 제거) + cell generic + sceneVersion cache                                      | G-projected      |
| HC#5 조합=데이터       | ② 60 factory creator→Components page reusable 문서, `resolveReusable` 재귀                       | reusable fixture |
| HC#6 RAC 절대권위      | ③ `toRacProps` D1 채널 + ⑤ `racStateAttrs` data-\* 미러                                          | G-state          |
| HC#7 projected tree    | ④ template subtree 행마다 cell + deep hit + 3-route + boundary guard                             | G-projected      |

---

<a id="영역-순서"></a>

## ⑦ 구현 순서 (proof surface 단계 축소)

> sketch. 실제 phase 분해 + sub-group 결정은 사용자 confirm 후 (adr-writing.md fork checkpoint / M4).

1. **공통 기반 (family 무관)**: `ComponentNode` schema + `resolveMergedStyle`(theme rule 직접, VisualRule seam 제거)/`toReactStyle`/`toSkiaStyle`(보편속성 직접, buildCatalogShapes spec seam 제거) + `resolveEditContract`(variant·size 의미 props 분리) + generic traversal. → **G-slice(Button)** + **G-adapter**.
2. **편집 계약 발효**: `useEditContract` + 패널 section 필터 + generic field renderer. `getEditor`/4 섹션 삭제.
3. **Skia state**: `racStateAttrs` + interaction threading + scene invalidation. → **G-state**.
4. **collection projected tree**: `isRenderProjectionId` 일반화 → generic `collectionProjector`(ListBox proof) → window → `resolveCollectionWriteTarget` 3-route + negative fixture. → **G-projected** + **G-boundary**.
5. **구 정본 + seam 부채 제거**: 124 spec + 59 render.shapes active 호출 + cutover/skiaLegacy + `buildCatalogShapes`/`resolveComponentVisual` seam + 5 레지스트리 + buildSpecNodeData 30+ 분기 삭제. 조합 family Components page reusable 저작(Table 2D column culling 분기).

단계 1 을 Button vertical slice 로 증명하고 구 정본·seam 제거(단계 5)를 generic 발효 검증 후로 미루면 회귀 표면이 단계별로 닫힌다.

---

<a id="영역-파일"></a>

## ⑧ 핵심 파일

| 영역           | 파일                                                                                                                                                                                                                                                                                                           |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| schema/어댑터  | `packages/shared/src/catalog/types.ts` (cutover/skiaLegacy 제거 + ComponentNode + variant·size accepts 분리 + PropContract.section 확장), 신규 `resolvers/resolveMergedStyle.ts`(theme rule 직접)/`outputs/toReactStyle.ts`/`toSkiaStyle.ts`(보편속성 직접)                                                    |
| seam 제거      | `renderers/buildCatalogShapes.ts`(spec seam — toSkiaStyle 로 대체), `renderers/utils/resolveComponentVisual.ts`(VisualRule seam — theme rule 직접으로 대체)                                                                                                                                                    |
| 등록           | `componentCatalog.ts`(6 레지스트리 collapse, cutover/skiaLegacy 제거), `cutover.ts` 삭제                                                                                                                                                                                                                       |
| base 층        | `resolvers/resolveComponentRule.ts`(위치 무변경, 테이블 read) + `catalog/componentRulesTable.ts`(②-6: 생성물→사람 저작 1차 SSOT 승격, `generated/` 접두 제거, variant·size → 시각값 직접 resolve). 삭제: `specs/scripts/generate-rules.ts` + `pnpm generate:rules`                                             |
| 렌더 dispatch  | `apps/builder/.../skia/buildSpecNodeData.ts`(generic, 30+ 분기 제거), `preview/components/CanonicalNodeRenderer.tsx`(legacy rendererMap 제거)                                                                                                                                                                  |
| projected tree | 신규 `projection/collectionProjector.ts`, `scene/canvasSceneNode.ts`(union 확장), `rendererInput.ts`(windowed 주입), `projection/renderProjectionIds.ts`(prefix 일반화), 신규 `interaction/resolveCollectionWriteTarget.ts`, `pages/systemComponentsPage.ts` + `listBoxTemplateOrigins.ts`(family 무관 일반화) |
| 편집 계약      | 신규 `resolvers/resolveEditContract.ts`, `panels/properties/generic/` field renderer, `StylesPanel.tsx`/`PropertiesPanel.tsx`(section 필터), `getEditor`/`registry.ts` 삭제                                                                                                                                    |
| Skia state     | 신규 `specs/utils/racStateAttrs.ts`, `hooks/useElementHoverInteraction.ts`(state derive), `StoreRenderBridge.ts`(interaction 주입)                                                                                                                                                                             |

---

## 검증 (Verification — 코드 단계)

1. **G-slice**: Button `size="md"→"sm"` → DOM/Skia/Properties/Style/Publish 5곳 `fontSize:14` 동일 + `/cross-check`.
2. **G-adapter**: `resolveMergedStyle`(spec/VisualRule seam 미경유) reset round-trip + DOM/Skia 대칭.
3. **G-projected**: 10k row 노드 ≤ window+overscan, deep hit/drill-in, refresh 후 `projection:` 0건.
4. **G-state**: selection family Builder Skia hover/pressed/selected = Preview DOM `data-*` parity.
5. `pnpm type-check` + `pnpm run codex:preflight`.
6. **등록 게이트 교체** (②-5 졸업, codex review 2026-06-02 결함 4 정정): ADR-139 의 `componentRegistrationContract.test.ts`(spec/TAG_SPEC_MAP/rendererMap/getDefaultProps 6중복 병치 검증)는 6중복 소멸 시점에 **삭제**된다 — 단일 등록 collapse 후엔 검증할 평행 병치가 없어 이 테스트는 의미가 사라진다. 대신 신규 `entryUniverseContract.test.ts`(렌더·Inspector·palette 가 모두 같은 entry set = `componentCatalog` 을 소비하는지 검증)로 대체. **타이밍**: 6중복 소멸(②-5 collapse + 5 레지스트리 제거) land 까지는 기존 `componentRegistrationContract.test.ts` 가 유효(점진 제거 중 누락 방지), collapse 완료 커밋에서 졸업·교체. 즉 본 ADR land 과정 중에는 기존 게이트 통과 필수, land 완료 후에 졸업.
