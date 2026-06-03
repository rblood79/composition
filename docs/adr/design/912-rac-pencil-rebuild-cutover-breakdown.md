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

| 측정                                               | 수치                                                                                                                                          | 위치                                                                                                                   |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `*.spec.ts` (구 정본)                              | 124                                                                                                                                           | `packages/specs/src/components/`                                                                                       |
| `render.shapes()` 실제 call site (test/주석 제외)  | 3 (그리기 1 + 측정 2)                                                                                                                         | `buildSpecNodeData.ts:1180`(그리기) + `specTextStyle.ts:167` + `specTextStyleForOverlay.ts:61`(측정) — 실측 2026-06-03 |
| `*.spec.ts` 내 `shapes:` 정의 선언                 | 123 / 124 spec                                                                                                                                | `packages/specs/src/components/`                                                                                       |
| `*.binding.ts`                                     | 39                                                                                                                                            | `packages/shared/src/catalog/bindings/`                                                                                |
| `cutover`/`skiaLegacy` 필드                        | entry union 전부                                                                                                                              | `types.ts`                                                                                                             |
| 6 레지스트리                                       | Factory creators 60 / rendererMap 95 / getDefaultProps(DEFAULT_PROPS_MAP 96) / BASE_TAG_SPEC_MAP 111 / builder TAG_SPEC_MAP / Component Panel | 다수                                                                                                                   |
| `buildSpecNodeData.ts` 컴포넌트별 if 분기          | 30+ (1416줄 중 ~1100줄)                                                                                                                       | `resolveProgressProps`/`SHELL_ONLY_CONTAINER_TAGS`/`COLUMN_REARRANGE_TAGS` 등                                          |
| `resolveEditContract`/`toReactStyle`/`toSkiaStyle` | 0                                                                                                                                             | 미존재                                                                                                                 |

**근본 진단**: ADR-142 가 catalog/binding 신구조를 _추가_ 했으나 구 정본을 _제거하지 않아_ 신·구 두 정본이 동시에 사는 **dual-SSOT 전환기**. ADR-910 의 cutover 전략(병치 + 게이트)은 이 병치를 _유지_ 하므로 사용자 지시("레거시 남기지 마라")와 충돌, "문제 반복". **그리고 catalog/binding 신구조 자체도 spec 을 읽는 seam(`buildCatalogShapes`)·variant→VisualRule seam(`resolveComponentVisual`)·variant·size 를 accepts 로 두는 전환기 타협을 품고 있어 — 단순 KEEP 이 답습이다.**

---

<a id="영역-경계"></a>

## ② 1차 원리 기준 재분류 — 원리 직결 / seam 부채 / 신규

### 2-1. 1차 원리 직결 (그대로 토대) — RAC + Pencil format + schema + theme

현재 구현 시스템이 아니라 **1차 원리 그 자체**라 유지한다.

| 자산                                                                                                                              | 위치                                                           | 1차 원리                                                                                                                          |
| --------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `react-aria-components` (npm)                                                                                                     | (외부)                                                         | RAC core — D1 절대 권위 (HC#6)                                                                                                    |
| canonical document schema (`RefNode`/`reusable`/`slot`/`descendants`/flat node)                                                   | `composition-document.types.ts` (ADR-116/122/130)              | Pencil format — 컴포넌트=데이터 (HC#5). openpencil 1:1 정합(schema 외부 검증)                                                     |
| theme/tokens (OKLCH relative-color, light/dark/다축)                                                                              | `tokens` root collection (ADR-110/143)                         | D3 시각 SSOT base 층 (HC#3)                                                                                                       |
| `componentRulesTable.ts` (theme rule base 정본)                                                                                   | `packages/shared/src/catalog/generated/componentRulesTable.ts` | theme rule base 의 **직접 정본** (②-6-A 손 편집). starter CSS + `design.md` 는 토큰 팔레트 audit (variant→token 매핑 없음 — 실측) |
| `resolveToken` (token 값 해소)                                                                                                    | `tokenResolver.ts`                                             | token → 값 해소 — 원리 직결 (단일 어댑터 내부 호출)                                                                               |
| Components system page (`page-components`, reusable origin 저장 위치)                                                             | `builder/pages/systemComponentsPage.ts` + `isRuntimePageNode`  | Pencil "컴포넌트=데이터" 의 저장 위치 (ADR-146, 사용자 확인 2026-06-02). 갈아엎기 아님, 조합 family 로 확장                       |
| ADR-135/136 Render-Space Interaction Boundary (`renderNodesMap`/`interactionNodesMap`/`isRenderProjectionId`/projected id 비영속) | `workspace/canvas/scene/` + `projection/`                      | projected tree 토대 (HC#7). collection 으로 일반화                                                                                |
| hit-test 파이프라인 (`hitTestPoint`/`pickTopmostHitElementId` depth+z-index)                                                      | `renderers/renderCommands.ts` + `selectionHitTest.ts`          | deep hit-test 토대 — 원리 무관 인프라                                                                                             |

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

| 대상                                                                       | 위치                                                                                                          | 근거                                                                                                                                                                              |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `*.spec.ts` 124개 + `render.shapes()` active 59                            | `packages/specs/src/components/`                                                                              | 컴포넌트당 코드 정의 = HC#5 위반. theme rule 이 시각 흡수 — **단, 삭제 전 theme rule source 를 ②-6 대로 `componentRulesTable.ts` 직접 SSOT 로 먼저 전환** (선행 의존)             |
| `generate-rules.ts`(spec→table) + `pnpm generate:rules` step               | `packages/specs/scripts/generate-rules.ts` + `package.json:34,40`                                             | spec→rule 변환기. ②-6-A 대로 **table 을 직접 정본 승격(1회 생성 결과 freeze)** → 1A 에서 build chain `generate:rules` step 제거, `generate-rules.ts` 파일은 단계 5 에서 물리 삭제 |
| `cutover.ts` 게이트 전체                                                   | `catalog/cutover.ts` + `componentCatalog.ts:435-460`                                                          | 게이트 = 두 경로 병치 증거                                                                                                                                                        |
| `buildCatalogShapesOrPrimitive` 병치 dispatch                              | `buildSpecNodeData.ts`                                                                                        | generic↔legacy 게이트                                                                                                                                                             |
| 6 레지스트리 중 5개                                                        | Factory 60 / rendererMap 95 / getDefaultProps(DEFAULT_PROPS_MAP 96) / TAG_SPEC_MAP(BASE_TAG_SPEC_MAP 111) 2종 | 단일 등록 collapse                                                                                                                                                                |
| `CanonicalNodeRenderer` legacy `rendererMap` 위임                          | `CanonicalNodeRenderer.tsx:216-228`                                                                           | generic 경로만                                                                                                                                                                    |
| 패널 `getEditor`/`registry.ts`/`GenericPropertyEditor`/per-type pre-editor | `inspector/editors/`                                                                                          | 컴포넌트별 동적 에디터 분기                                                                                                                                                       |
| `StylesPanel` 4 하드코딩 섹션                                              | `StylesPanel.tsx:37-46`                                                                                       | section 필터로 대체                                                                                                                                                               |
| (금지) Paper.js boolean ops 류 fallback 우회                               | —                                                                                                             | `feedback-no-fallback-thinking`                                                                                                                                                   |

### 2-4. 신규 도입 (NEW) — 1차 원리의 직접 구현

> **land 상태 (2026-06-03 실측 — review-adr round 7)**: 아래 "신규" 중 6개가 이미 land 됨. `ComponentNode` schema / `resolveMergedStyle`(`1762d7653`) / `toReactStyle`(`1762d7653`) / `toSkiaStyle`(`7022b8d84`) / `resolveEditContract`(`5d402d804`) / `racStateAttrs`(`5eebef96a`) **= 완료**. `collectionProjector`(generic) = **미land**(ListBox 인라인 `appendListBoxRowProjection` 만 — 단계 4 일반화 대상). `resolveCollectionWriteTarget` = **land**(`d5da74c72`, ListBox 경로 / family generic discriminator 는 단계 4 확장). 즉 본 표는 "남은 신규" 가 아니라 "1차 원리 신규 산출물 명세" — 진행은 ⑦ 구현 순서 참조.

| 신규                                                                                     | 역할                                                                                                                                                                                  | HC         |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| `ComponentNode` schema 확정 (props.style = override-only, props.variant/size = 의미값)   | 의미 props + 시각 override layer                                                                                                                                                      | HC#1, HC#3 |
| `resolveMergedStyle(node, doc)`                                                          | 두 backend 공유 병합 코어 `style[k] ?? resolveComponentRule(...).resolve(k)`. spec 미경유                                                                                             | HC#3       |
| `toReactStyle(node, doc)`                                                                | merged style → `React.CSSProperties` (DOM). 보편 속성 직접                                                                                                                            | HC#3       |
| `toSkiaStyle(node, theme)` (shared/outputs — `@composition/specs` `resolveToken` import) | merged style **map** 산출(Shape[] 아님): shared `resolveMergedStyle` base⊕override ⊕ token 해소. `buildCatalogShapes`(KEEP generic 생성기)가 이 map 소비 — 산재 13키 ad-hoc 병합 수렴 | HC#3, HC#4 |
| `resolveEditContract(node, doc)`                                                         | accepts(D1 투영) ∪ 의미 props(variant/size) ∪ 보편 시각 속성. origin 태그                                                                                                             | HC#1, HC#2 |
| `racStateAttrs(node, interaction)`                                                       | RAC `data-*` → state derive                                                                                                                                                           | HC#6       |
| generic `collectionProjector`                                                            | template subtree × visible window → projected cell tree                                                                                                                               | HC#4, HC#7 |
| `resolveCollectionWriteTarget(projectionId)`                                             | projected id → template/data/override 3-route                                                                                                                                         | HC#7       |
| 단일 등록 entry (cutover/skiaLegacy 없는 catalog)                                        | leaf=RAC 투영 / 조합=reusable ref / native=frame                                                                                                                                      | HC#5       |

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

**현 6 registry 파생 상태 실측 (2026-06-02 선제 grep — collapse 작업량 정밀화)**: "단일 source 파생"이 현재 어디까지 성립하고 어디가 작업 대상인지 구분한다.

| #   | registry                                                                                      | 현 파생 상태                                                                                                                                                                                                                     | collapse 작업                                                                                                                                               |
| --- | --------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Component Panel (`ComponentList.tsx:70-145`)                                                  | ❌ **정적 하드코딩 배열** (`contentComp`/`layoutComp`/`buttonsComp`/`formsComp`/`collectionsComp`/`dateTimeComp`/`overlaysComp`). `label`(i18n)·`icon`·`category`·`layoutOnly` palette 전용 메타 보유 — catalog 비파생 평행 list | **entry 에 `panel:{ label, icon, category, layoutOnly? }` 필드 추가 → ComponentList 가 catalog 파생으로 전환** (palette 메타가 entry 로 흡수돼야 파생 성립) |
| 2   | builder `TAG_SPEC_MAP` (`tagSpecMap.ts:31`)                                                   | ⚠️ `{...BUILDER_ALIAS_MAP, ...BASE_TAG_SPEC_MAP}` — BASE 는 이미 파생, ALIAS(ComboBoxWrapper 등 RAC 외 D3 고유 wrapper)는 별도                                                                                                   | BASE 파생부는 catalog 흡수. ALIAS 는 leaf entry(composition 고유 D3 element)로 정규 등록 — 별도 map 제거                                                    |
| 3   | `BASE_TAG_SPEC_MAP`(111) / `rendererMap`(95) / `DEFAULT_PROPS_MAP`(96) / Factory creators(60) | 4 registry 가 spec/수동 list 병치                                                                                                                                                                                                | catalog entry 파생 view 로 collapse (③ schema + ②-6 theme rule)                                                                                             |

**작업 결론**: #1(ComponentList 정적 배열 → catalog 파생) 과 #2 ALIAS 정규화가 6중복 소멸의 **필수 선행 작업**이다 — 이 둘을 하지 않으면 "단일 source 파생"이 성립하지 않는다(평행 list 잔존). 즉 collapse 는 자동 성립이 아니라 #1·#2 전환을 포함한다.

**drift 구조적 불가능 증명 (위 #1·#2 전환 완료 후 성립)**: 6 소비처가 모두 `lookupEntry(type)`(palette 메타 포함) + `resolveComponentRule(type)` + `resolveEditContract(node)` 단일 source 에서 파생하면, 한 컴포넌트의 정의가 두 곳에 따로 존재하지 않는다 → "한쪽만 갱신해서 어긋나는" drift 가 발생할 평행 위치가 없다. ADR-139 게이트(6중복 강제 동기화)는 **불필요해져 졸업**되고 "entry universe = 렌더·Inspector·palette 가 모두 같은 entry set 을 소비"라는 단일 `entryUniverseContract.test.ts` 로 대체(누락 자체가 컴파일·런타임에 불가능하면 게이트도 최소). **단 #1·#2 전환 land 전까지는 ADR-139 게이트 유효 유지**(Verification 6 참조).

> 경계 원칙: collapse 후 렌더 dispatch 는 `(entry.kind, source.kind)` 2축만 가른다. **type 이름 분기 코드 0**.

### 2-6. theme rule base 층 source 전환 — spec 삭제의 선행 의존 (사용자 방향 2026-06-02, codex 결함 2 재정정)

> **결함**: ②-3 은 `*.spec.ts` 124 삭제를 말하지만, 현재 base 층(`COMPONENT_RULES_TABLE`)은 `generate-rules.ts` 가 124 spec 의 variants/sizes/fill 을 build-time 변환해 생성한다(`generate-rules.ts:4` 주석 "spec 은 본 생성기의 build-time source 로만 잔류" + `package.json:34,40` `build:specs`→`generate:rules`). spec 을 그냥 삭제하면 변환기 입력이 사라져 **base 층(HC#3 의 base)이 통째로 정의되지 않는다** → base/override 2층 schema 의 base 가 붕괴.

> **DOM/Skia 비대칭 — 1A 진입 실측 (2026-06-02)**: 1A 코드 진입에서 두 backend 의 시각 적용 메커니즘이 **비대칭**임을 실측했다. DOM(`CanonicalNodeRenderer.tsx:234-256`)은 `react-aria-{Type}` className + `data-variant`/`data-size`/`data-fill-style` 속성 + **build-time generated CSS**(`CSSGenerator.ts:232` `variantToVisual(spec.variants)`)로 색/size 를 적용하고 인라인 `style` 은 user override 전용이다 — 런타임 색 병합 안 함. Skia(`resolveSkiaVisualRule.ts` → `buildCatalogShapes.ts:86-117`)는 **런타임**에 theme rule TokenRef 를 직접 그린다. 따라서 "단일 공급원 = 같은 런타임 inline object" 가 아니라 **"같은 generated source 파생"** 이다(출력 형태는 backend 별). DOM=generated CSS / Skia=runtime rule 이 **같은 generated source** 에서 나오면 시각 대칭이 코드로 보장된다(ADR-063 D3 "대칭 = 시각 결과 동일성").

**결정 (사용자 방향 2026-06-02, 1A 진입 실측으로 ②-6-A 재채택)**: theme rule base 의 정본을 **`componentRulesTable.ts` 자체로 직접 승격**한다 (생성기 폐기, 손 편집 가능 정본). `generate-rules.ts` 가 1회 생성한 결과를 freeze 하고, 이후 그 파일을 직접 편집한다.

> **재채택 근거 (실측 2026-06-02)**: 직전 ②-6-D(starter→table 생성기) 결정은 "variant→token 매핑을 starter CSS + design structured source 에서 generate" 를 전제했으나, 1A 진입 실측에서 **그 매핑이 두 source 어디에도 없음**이 드러났다. starter `Button.css` 는 단색 버튼(variant 개념 없음)만, `design.md` 는 starter→composition 토큰 번역표(`--text-color`→`--fg` 수준)만 담는다. Button 의 accent/primary/secondary/negative/premium/genai variant 별 fill/text/border TokenRef 와 xs~xl size 별 시각값은 **현재 유일하게 `Button.spec.ts` → `generate-rules.ts` → `componentRulesTable.ts`** 에만 존재한다. 따라서 starter→table generate 는 입력 부재로 불가 — table 을 직접 정본으로 승격하는 것이 실측 정합이다.

```
정본:  packages/shared/src/catalog/generated/componentRulesTable.ts
            │ (헤더 "AUTO-GENERATED" 제거 → 손 편집 정본. generate-rules 1회 생성 결과 freeze)
            ▼
소비자: DOM/Preview/Publish → react-aria-{Type} + data-* + generated CSS (RAC 정통)
            │   generate-css(build script)가 같은 table 의 variant 색상 주입 (②-6-A swap)
       Skia                 → 같은 componentRulesTable runtime resolve (이미 spec-free)
       Properties/Style     → 같은 rule 에서 baseValue read, props.style override 만 저장
audit:  packages/design.md + starter/*.css → 정본 아님, 토큰 팔레트 human audit (variant→token 매핑 없음)
```

| 항목                    | 현재 (전환기)                                                      | ADR-912 (직행)                                                          |
| ----------------------- | ------------------------------------------------------------------ | ----------------------------------------------------------------------- |
| base 층 정본            | `*.spec.ts` 124 → generate-rules → table                           | **`componentRulesTable.ts` 직접 정본** (손 편집, 생성기 폐기)           |
| 생성기                  | `generate-rules.ts` (spec→table)                                   | **폐기** — 1회 생성 결과 freeze, build chain `generate:rules` step 제거 |
| DOM variant 색상 source | `CSSGenerator.ts:232` `variantToVisual(spec.variants)` (spec 직독) | **generate-css 가 같은 table 주입** (Skia 와 same-source)               |
| `design.md` 위상        | human audit (starter 측은 css-tokens.md 가 정본)                   | 무변경 — 토큰 팔레트 audit (variant→token 매핑은 table 정본)            |
| `resolveComponentRule`  | 이 테이블 read                                                     | 위치·시그니처 무변경, 정본 테이블 read                                  |

**왜 componentRulesTable 직접 정본인가** (대안 비교):

- 대안 ②-6-A (componentRulesTable 직접 SSOT, **재채택**): table 을 손 편집 정본으로 승격. "149KB 손 저작 비현실적" 기각 사유는 _새로 손으로 쓰는 게 아니라 generate-rules 가 1회 생성한 결과를 freeze 후 직접 편집_ 이므로 해소 — 저작 부담 0(이미 생성됨), 유지는 정본 직접 편집(spec 경유 제거로 오히려 단순). variant→token 매핑이 starter/design.md 에 부재(실측)하므로 유일하게 가능한 경로.
- 대안 ②-6-D (starter inventory → structured generated source, **기각**): variant→token 매핑이 starter CSS·design.md 어디에도 없음(실측) → starter→table generate 입력 부재로 불가. 직전 채택을 1A 진입 실측으로 재정정.
- 대안 ②-6-B (per-component rule 파일 N개): 컴포넌트당 파일 1개 유지 → 사실상 spec 리네이밍, HC#5("컴포넌트당 정의 파일 폐기")와 충돌. 기각.
- 대안 ②-6-C (generate-rules 유지 + spec 축소): spec 완전 삭제 아님 → "레거시 남기지 마라" 부분 충돌. 기각.

> **"호출부 불변" 문구 정정 (②-6-A 하 실측)**: 직전 §2-6 / line 162 의 "`variantToVisual` 의 source 만 swap → CSSGenerator 호출부 불변" 은 ②-6-D 전제 문구다. ②-6-A(table 직접 정본) 하에서는 **CSSGenerator 호출부 변경 불가피** — `CSSGenerator.ts:229-232` 가 `spec.variants` 객체를 순회하는데, table 파생으로 바꾸려면 순회 source(`spec.variants`→주입된 `rule.variants`) + 변환 함수(`variantToVisual`→rule 동형 변환) + `generateCSS` 시그니처(variant source 주입)가 함께 바뀐다. 패키지 경계(`specs ← shared` — specs 가 shared table import 불가)상 `variantToVisual` 내부 swap 은 불가능하므로, **build script(`generate-css.ts`)가 shared table 을 읽어 `ComponentVisualRule` 형태로 주입**하는 것이 유일한 경계-정합 경로다.

**삭제·전환 순서 (선행 의존, base 단절 0 구간)**: (1) `componentRulesTable.ts` 헤더를 정본 표시로 교체 + build chain `pnpm generate:rules` step 제거 (생성 결과 freeze) → (2) `generate-css`(build script)가 같은 table 의 variant 색상을 주입하도록 DOM 경로 swap (CSSGenerator `generateCSS` optional source 파라미터, 색상 채널 한정) → (3) parity test 방향 반전(table 정본 ← spec 추종 검증) + `resolveComponentVisual`/`variantToVisual` test fixture 격하 → (4) [단계 5] `*.spec.ts` 124 + `render.shapes()` + `resolveComponentVisual`(seam) + `generate-rules.ts` 물리 삭제. base 층(table)이 한 순간도 정의되지 않는 구간 없음(이미 생성된 table 을 freeze 로 시작).

> **scope 경계 (1A-(a) = variant 색상 채널 한정)**: 1A-(a) 는 variant 색상만 DOM/Skia same-source 로 만든다. size 시각값 + 구조 CSS(`spec.archetype`/`spec.containerStyles`/`spec.composition`)는 단계 5. 근거 — `ComponentRule`(table)은 `variants`/`sizes`/`textDecoration` 만 담고, CSSGenerator 가 읽는 archetype/containerStyles/composition 은 table 에 없다(table 을 spec 수준으로 확장 = 단계 5 본체). 1A 후 `generate-css` 는 색상=table + 구조/size=spec 이중 입력(transitional, 단계 5 까지).

**보존 구조**: ADR-907 Layer B(spacing) / 908 fill / 909 longhand 의 시각 값은 생성된 테이블의 필드(`sizes`/`variants.fill`/spacing)로 직접 표현된다 — fill/spacing/longhand override layer 는 유지.

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

### 3-3. 단일 어댑터 — base 는 같은 generated rule, 출력은 backend 별 (DOM=CSS / Skia=runtime)

**핵심 (1A 실측 정합)**: DOM 과 Skia 는 base 시각 적용 **메커니즘이 다르다**(DOM=build-time generated CSS+data-attr / Skia=runtime rule resolve). "단일 진실"은 **같은 런타임 inline object** 가 아니라 **둘 다 같은 정본 table(②-6-A `componentRulesTable.ts`)의 같은 theme rule 을 base 로 쓴다**는 것이다. `resolveMergedStyle` 은 이 공통 base 위에 `props.style` override 를 얹는 병합 코어이고, 각 backend 어댑터는 그 결과를 자기 출력 형태로 투영한다.

> **1A-(c) 진입 실측 정정 (2026-06-03)**: 1A-(c) 코드 매핑에서 본 절의 직전 슈도코드가 실측과 어긋남이 드러났다. (1) `toSkiaStyle` 의 **패키지 위치**가 미명시였다. **의존 그래프 실측**: `shared → specs` (shared `package.json` 이 `@composition/specs` 의존, specs 는 shared 의존 0 — specs 가 더 하위 레이어). 따라서 `resolveToken`(`packages/specs/src/renderers/utils/tokenResolver.ts`, specs)과 분리 코어 `resolveMergedStyle`(`packages/shared/src/catalog/resolvers/`, shared)을 **둘 다 접근 가능한 곳은 shared** 다 (shared 가 specs 를 import 가능). `toSkiaStyle` 을 specs 에 두면 resolveMergedStyle(shared) 재사용 불가(역방향). 따라서 `toSkiaStyle` 은 **shared 측**(`packages/shared/src/catalog/outputs/toSkiaStyle.ts`, `toReactStyle` 과 같은 폴더)에 두고 shared-local `resolveMergedStyle` 재사용 + `@composition/specs` 의 `resolveToken` import. (2) `buildCatalogShapes` 는 "제거할 seam" 이 **아니다** — ADR-142 가 land 한 **generic box+text 시각 생성기(spec-free, 컴포넌트 식별 분기 0)** 로 §2-2 KEEP 자산이다(`buildCatalogShapes.ts:38-217`). 실제로 buildCatalogShapes 는 **이미** `props.style` 13키(backgroundColor/borderColor/borderRadius/borderWidth/color/fontSize/fontFamily/fontWeight/padding/paddingLeft/paddingRight/paddingX/textAlign)를 base(`visual`/`size`) 위에 `style?.X ?? base` 패턴으로 인라인 병합 중이다 — 즉 **"Skia override 상실 seam" 은 존재하지 않는다**. (3) 따라서 `toSkiaStyle` 의 1차 책임은 "Shape[] 통째 생성으로 buildCatalogShapes 를 대체" 가 **아니라**, **산재된 13키 `style?.X ?? base` ad-hoc 병합을 단일 코어(`resolveMergedStyle`)로 수렴 + token 해소 단일 진입점화** 다. 출력은 token-해소된 **merged style map**(Shape[] 아님) — 그 map 을 `buildCatalogShapes`/`skiaPrimitives` 가 소비(13키 ad-hoc 읽기 → 단일 map 소비로 정리).

```ts
// ★ base = 같은 generated theme rule, override = props.style. 두 backend 가 같은 base source.
//   resolveMergedStyle 위치: packages/shared/src/catalog/resolvers/resolveMergedStyle.ts (1A-(b) land)
resolveMergedStyle(node, doc):
  rule = resolveComponentRule(node.type, doc)            // 정본 table (②-6-A componentRulesTable.ts), shared 자급
  base = (size != null ? rule.sizes[size] : undefined)   // ComponentRuleSize (TokenRef 미해소 통과 — 1A-(b) scope)
  override = node.props.style ?? {}                      // override-only (키 존재 = override)
  return { base, override }                              // 분리만. token 해소·merge 는 backend 어댑터 책임

// DOM: base 색/size 는 generated CSS + data-attr 가 담당(런타임 인라인 색 주입 아님).
//      toReactStyle 은 props.style override 만 React.CSSProperties 로 — RAC 정통 + override layer.
//      위치: packages/shared/src/catalog/outputs/toReactStyle.ts (1A-(b) land)
toReactStyle(node) = resolveMergedStyle(node).override   // override-only, token 해소 불요(generated CSS 가 base)

// Skia: 런타임에 같은 generated rule base ⊕ override 를 token-해소된 merged map 으로 산출.
//       위치: packages/shared/src/catalog/outputs/toSkiaStyle.ts (1A-(c) 신규, shared 측 — toReactStyle 과 같은 폴더)
//       shared 가 specs 를 import(shared→specs) → resolveMergedStyle(shared 내부) + resolveToken(@composition/specs) 둘 다 접근
//   ★ merged map 범위 (1A scope): base = ComponentRuleSize (size 시각값 — fontSize/borderRadius/
//     borderWidth/height/lineHeight/iconSize) + override = props.style. **variant 색상은 제외** —
//     색은 1A-(a) 에서 DOM=generated CSS / Skia=runtime `visual`(caller resolveComponentRule 주입)
//     이 same-source 로 처리 완료(resolveMergedStyle.base 에 미포함, MergedStyle 주석). 색의 단일
//     어댑터 흡수는 단계 5(VisualRule seam 제거)에서.
toSkiaStyle(node, theme):
  { base, override } = resolveMergedStyle(node)          // ★ shared 단일 코어 재사용 (병합 로직 복제 0)
  merged = { ...base, ...override }                      // override ?? base (override 키가 base 덮음)
  return mapValues(merged, v => isTokenRef(v) ? resolveToken(v, theme) : v)   // token 해소 단일 진입점
// buildCatalogShapes / skiaPrimitives 는 이 merged map 을 소비 — 산재 13키 ad-hoc `style?.X ?? base` 읽기 수렴
// (색상은 buildCatalogShapes 가 visual 에서 계속 읽음 — 단계 5 전까지 색/구조는 transitional 이중 입력)
```

책임 수렴: base 분리/override/token 해소가 **shared `catalog` 단일 위치 집중** — 분리 코어 `resolveMergedStyle`(shared/resolvers) + backend 어댑터 `toReactStyle`/`toSkiaStyle`(shared/outputs) 모두 shared. `toSkiaStyle` 만 `@composition/specs` 의 `resolveToken` 을 추가 import(shared→specs 의존 정합). `buildCatalogShapes`(specs) 13키 `style?.X ?? base` ad-hoc 병합과 `applyInlineBorderOverlay`(`buildSpecNodeData.ts:1155`) 사후 border 우회로는 merged map 소비로 흡수 수렴(buildCatalogShapes **삭제 아님 — 입력을 merged map 으로 정리**). `resolveComponentVisual` VisualRule seam 은 단계 5 에서 제거(1A-(c) 범위 밖). **시각 대칭 보장 = DOM generated CSS 와 Skia runtime rule 이 같은 generated source 파생**(`/cross-check` G-adapter 가 이를 검증 — "같은 inline object" 아님).

> `toRacProps`(D1 ARIA 투영)는 `toReactStyle`(D3 override)과 별도 채널 — RAC 절대 권위(HC#6). DOM base 시각은 generated CSS/data-attr 채널(또 별도).

---

<a id="영역-b"></a>

## ④ 영역 B — Collection Interactive Projected Tree (HC#4/#7)

> **진행 상태 (2026-06-03)**: 단계 4 를 발효 난이도별로 묶음 분리 실행(사용자 결정). **묶음 1 — 비-data-bound 4종 발효 완료(`0e9c501d4`)**: Select/ComboBox(trigger-overlay) + Tabs/TagGroup(factory-child)는 row 순회가 render.shapes 에 없어 **C1 generic projector 불필요**, C2(4-2.5)+C3(4-2.6)만으로 발효 안전. skiaLegacy 제거 → buildCatalogShapes 경로. 검증: vitest 회귀 0(+7)·drift 102/102·generated CSS diff 0·live console 0. **묶음 2 — GridList C1 발효 완료(`b958cc006`/`f984f6462`/`3d933df54`/`2818c6bf0`)**: data-bound row 순회를 projected GridListItem tree 로 전환(C1 4-2). step0 공통 모델 추출 → step1 GridListItem.spec.render.shapes 카드 렌더 이전(ListBoxItem 동형) → step2 projection metadata union(gridlist-row/rows + 단일 진입점 helper `isCollectionRowProjectionKind`) → step3-5 appendGridListRowProjection + GridList.render.shapes shell-only + skiaLegacy 제거. **origin 인프라 불필요**(verify CRITICAL #1 실측 정정 — originStyle `?? {}` graceful + GridList factory children:[], origin = optional enhancement). **projected node 렌더 경로 = Item spec.render.shapes**(GridListItem catalog 미등록 → buildCatalogShapes 아님, verify dataLossRisks 경로 정정). 검증: vitest 회귀 0(+3)·canvasSceneNode 16 test(GridList projection + window 100)·live builder GridList 카드(bg+border+label+description) 정상 렌더+데이터 소실 0+console 0. **묶음 3 — Table 2D C1 발효 완료(`3efce7a0d`/`5bde0cbd8`/`d7cfd470c`)**: data-bound 2D grid(columns×rows)를 projected RowsGroup→Row[i]→Cell[i][j] tree 로 전환(사용자 결정 "행 단위 셀 노드", 2026-06-03). step T0 collectionRowProjectionModel 2D 확장(TableColumnDef/TableProjectionRow/getTableProjectionRows, flat 모델과 직교) → T1 TableCell.spec(TableRow bg/divider + TableCell text-only, Table.spec.childSpecs 등록 → TAG_SPEC_MAP 자동 확장) → T2 projection metadata union(table-rows/row/cell + isCollectionCellProjectionKind + columnId write-target route) → T3 appendTableRowProjection(window 100) + Table.render.shapes shell-only + skiaLegacy 제거 + **C2 정렬**(Table.css bg `--bg-raised`→`--bg`, rule fill `{color.base}` 정합 — 발효 전부터 존재하던 drift 해소, 발효 자체는 Skia-neutral). **TableCell/TableRow catalog 미등록 → spec.render.shapes 경로**(GridListItem 동형). Table factory 의 빈 TableHeader/TableBody(spec 없음 → Skia 미렌더)는 suppression 불필요. 검증: type-check 0 new(baseline 110)·specs 544·builder 36 failed(baseline 동일, 회귀 0)/1688 passed(+8)·canvasSceneNode 18 test(Table projection 2 + window/header)·registration contract 10/10·generated CSS diff 0·**live builder 2D 테이블(header fw600 + data fw400 + 컬럼 배치 + 행 구분선) 정상 렌더 + cell 클릭→owner Table 선택 + console 0**. **묶음 4 — Menu 발효 완료(2026-06-04, skiaLegacy 제거 단순 1줄)**: 직전 "popup↔trigger 본질 미확정" 보류 framing 정정 — 사용자 정정("skia Menu = trigger Button 동일") + RAC 공식(MenuTrigger>Button+Popover>Menu, 초기 화면 = trigger Button, popup 리스트는 Popover 안 숨김). Skia 정적 캔버스는 popover 미개방 → trigger Button 만 그리면 Preview 초기와 일치. **설계 가정(아래 4-2.5/4-2.6 표의 "Menu.css trigger 버튼 정렬" + `triggerText:true` 예외) 실측 정정**: ① Menu.css 의 popup CSS(`.react-aria-Menu` `--bg-raised`/max-height)는 Popover 전용 → 발효 무관(수정 불필요, generated CSS diff 0). ② Menu 는 `SYNTHETIC_CHILD_PROP_MERGE_TAGS` 비멤버(items SSOT, factory children:[]) → C3 차단이 애초에 미적용 → buildCatalogShapes 가 text "Menu" 자연 렌더(`triggerText:true` 별도 메타 불필요). ③ rule fill base `{color.neutral}` == Button → drift test 116 passed(Menu cutoverType 추가, spec↔table 일치). ④ 유일 차이 text align(legacy left → catalog center)은 Button center 정합(정렬 정정, render.shapes 미수정 — drift test 대상 아님). 검증: drift 116 / type-check 0 new / specs 544 / builder 회귀 0(+7, 1695 passed) / registration 10/10 / generated CSS diff 0 / **live builder: Menu = 62×30 trigger 버튼(popup 아님) = Button 동일 위치·크기·색, Button text 선명(Menu 동일 경로) + console 0**. → **단계 4 = collection 7종 전부 발효 완료**.
>
> **단계 4 = 3계약 묶음 (2026-06-03 재설계)**. collection family 의 Skia generic 발효(skiaLegacy 제거)는 ListBox 만 안전했고, 나머지 6 collection(Menu/Select/ComboBox/Tabs/TagGroup/GridList)+Table 은 발효 시 전부 시각 변화가 났다(kill criteria 미통과 — `feedback-proof-gate-seam-removal-kill-criteria`). 단순 skiaLegacy 제거로는 대칭이 깨지므로, 단계 4 는 다음 **3계약을 한 묶음**으로 발효한다.
>
> | #   | 계약                                                                              | 절          | 해결 대상                                                                 |
> | --- | --------------------------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------- |
> | C1  | **generic collectionProjector** (template subtree × window → projected cell tree) | 4-2 / 4-2.7 | data row 순회(ListBox/GridList/Table) — Skia generic text 렌더 + deep hit |
> | C2  | **rule fill 정렬** (컨테이너 bg/border ↔ Preview CSS 대칭)                        | 4-2.5       | TagGroup 불투명 배경 추가 / Tabs border / Menu text align                 |
> | C3  | **children·text 중복 방지** (컨테이너 shell-only 강제, 내용은 자식/projector)     | 4-2.6       | Select/ComboBox text 중복 / SYNTHETIC 컨테이너 dual-paint                 |
>
> **발효 안전 3조건(재사용 판정 규칙)** = (1) legacy render.shapes 결과 ≡ 발효 후 buildCatalogShapes 결과(rule fill base ↔ legacy shell fill 일치) AND (2) trigger/text 를 buildCatalogShapes 가 그리는데 자식 element 도 같은 시각 안 그림(중복 회피) AND (3) items 순회가 render.shapes 안에 없음. **ListBox 만 셋 다 충족**(발효 완료, `ListBox.binding.ts`). 단계 4 의 C2(조건 1)+C3(조건 2)+C1(조건 3)이 나머지 family 에 셋을 동시 성립시킨다.

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

### 4-2.5. C2 — rule fill 정렬 (컨테이너 bg/border ↔ Preview CSS 대칭, D3)

발효 후 컨테이너 노드는 `buildCatalogShapes` 가 rule fill base + border(`buildCatalogShapes.ts:106,116,153`)로 shell 을 그린다. 이 shell 이 **Preview DOM 의 컨테이너 CSS 와 시각 일치**(D3 대칭)해야 발효가 안전하다. 컴포넌트별 rule(`componentRulesTable.ts`) ↔ Preview CSS 실측 대조 결과, 일부 type 의 rule 이 어긋나 있다.

> **정정 방식 = `componentRulesTable.ts` 직접 정본 편집** (②-6-A 정합, breakdown line 165 + `componentRulesTable.ts:5` 헤더 정본 승격). ADR-912 는 이미 generated table 을 손 편집 정본으로 승격(generate-rules freeze)했으므로, 여기서 "정렬"은 **그 정본 table 의 해당 entry 를 직접 수정**하는 것이다. spec/generate-rules 재도입 아님(전환기 부채로 폐기 방향). `resolveMergedStyle`(영역 A) 가 같은 table 을 읽으므로 정본 1곳 수정으로 DOM/Skia 양쪽 자동 정렬.

| type     | rule fill base (현재)           | rule border (현재) | Preview 컨테이너 CSS                                             | 판정               | 조치                                                                                                                                                                                            |
| -------- | ------------------------------- | ------------------ | ---------------------------------------------------------------- | ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Menu     | `{color.neutral}`(=`--fg` 버튼) | `{color.neutral}`  | `.react-aria-Menu` bg `--bg-raised` + border `--border`(popover) | **불일치(이중성)** | **trigger 버튼으로 확정**(사용자 2026-06-03) — rule(버튼) 정본, generated `Menu.css` 를 trigger 버튼 시각으로 정렬. C3 text "Menu" 유지(`triggerText:true`)                                     |
| Select   | `variants:{}` (빈값)            | —                  | 컨테이너 자신 투명, `.react-aria-Button`(trigger)가 bg/border    | 정렬(의도)         | 유지 — 컨테이너 transparent, 자식 trigger 가 bg/border 담당                                                                                                                                     |
| ComboBox | `variants:{}` (빈값)            | —                  | 컨테이너 자신 투명, `.combobox-container`(자식)가 bg/border      | 정렬(의도)         | 유지 — Select 동일                                                                                                                                                                              |
| Tabs     | `{color.transparent}`           | `{color.border}`   | `.react-aria-Tabs` 배경 없음, indicator `::before` 선만          | **불일치**         | **rule `colors.border` 제거** — buildCatalogShapes 가 `{color.border}` 를 컨테이너 박스 border 로 그려 legacy `[]` 와 불일치(kill: "Tabs border 추가"). Tab indicator 선은 컨테이너 border 아님 |
| TagGroup | `{color.layer-2}` (**불투명**)  | `{color.border}`   | `.react-aria-TagGroup` **transparent**, Tag 자식만 bg            | **불일치**         | **rule fill base → `{color.transparent}` + `colors.border` 제거**                                                                                                                               |
| GridList | `{color.transparent}`           | 없음               | `.react-aria-GridList` `background: transparent`                 | 정렬               | 유지 (data row 는 C1 projector)                                                                                                                                                                 |
| Table    | `{color.base}`(=`--bg`)         | `{color.border}`   | `.react-aria-Table` bg `--bg-raised` + border `--border`         | **확인 필요**      | `{color.base}`(`--bg`) ↔ `--bg-raised` 토큰 동등성 미확정 — 단계 4 실행 시 `/cross-check` 로 확정(Menu 와 동일 토큰 mismatch 패턴 주의)                                                         |

- **핵심 불변**: 컨테이너 rule fill ⊕ border = Preview 컨테이너 CSS. data row/item 의 bg/border 는 **rule 이 아니라 C1 projector(row template)가 그린다** — 컨테이너 rule 에 item 색을 섞지 않는다.
- Select/ComboBox 의 `variants:{}` 는 결함이 아니라 **의도**(컨테이너 투명, 시각은 자식 trigger 가 담당). 발효 시 컨테이너 shell 이 빈 box 가 되는 것이 Preview 대칭.
- **C2 source 정정 = 최소 3건**: Tabs(`colors.border` 제거) + TagGroup(fill base→transparent + border 제거) + Menu(generated `Menu.css` 를 trigger 버튼 rule 에 정렬). Table 은 토큰 동등성 확정 후 결정.
- **토큰 mismatch 주의(Menu/Table 교훈)**: rule TokenRef 가 Preview CSS 변수와 **다른 시맨틱 카테고리**(예: `{color.neutral}`=`--fg` 텍스트 ↔ `--bg-raised` 배경)를 가리키면 "둘 다 값이 있다"만으로 정렬로 판정하면 안 된다. css-tokens.md 매핑 표로 TokenRef→CSS 변수 동등성을 확인한 뒤 판정.

### 4-2.6. C3 — children·text 중복 방지 (컨테이너 shell-only 강제)

발효 후 `buildCatalogShapes` 의 text 분기(`buildCatalogShapes.ts:118-121,169-214`)는 `props.children || props.text || props.label` 이 truthy 이고 `_hasChildren` 이 false 면 text shape 를 그린다. SYNTHETIC 컨테이너는 `_hasChildren` 주입이 차단(`buildSpecNodeData.ts:1110-1115`)되므로 false → **컨테이너가 value/label text 를 그리는 동시에 자식 trigger element(SelectValue/ComboBoxInput 등)도 같은 text 를 그려 중복**된다. ListBox 가 중복을 회피한 방식은 "컨테이너가 children/text/label props 를 안 가져 buildCatalogShapes text 분기 자체가 비활성"(`ListBox.binding.ts` — items prop 만, Skia 미사용)이다. 이를 family 무관 단일 계약으로 일반화한다.

**계약**: collection 컨테이너는 **shell(bg+border)만** 그린다. value/label/icon 등 내용 text 는 **자식 element(trigger 류) 또는 C1 projector(data row)** 가 단독 담당한다. 컨테이너 shape 생성기는 text 를 그리지 않는다.

**메커니즘 (영역 A 단일 어댑터 정합)**: 컴포넌트별 if 분기(no-classification 원칙) 없이, `toSkiaStyle`(영역 A) 가 노드의 catalog entry 가 collection 이면 text 입력을 비활성한 propsView 로 `buildCatalogShapes` 를 호출한다.

```
toSkiaStyle(node, doc):
  entry = getCatalogEntry(node.type)
  propsView = isCollection(entry)
    ? { ...node.props, children: undefined, text: undefined, label: undefined }   // shell-only: text 입력 차단
    : node.props
  return buildCatalogShapes(resolveMergedStyle(node,doc) 의 visual, propsView, ...)
```

- `isCollection(entry)` = catalog entry 의 binding source 가 collection(items/dataBinding 기반) 또는 `entry.kind` collection 판정. type-name 비교 0(영역 A 의 `(entry.kind, source.kind)` 2축 분기 재사용).
- buildCatalogShapes 자체는 **변경 0** — text 입력이 undefined 면 `:171 if(text)` 가 false 라 자연히 shell-only. line 169 `_hasChildren` early return 과 직교(둘 중 하나만 성립해도 shell-only).
- **5-type 적용 결과**:
  - Menu: 컨테이너 text "Menu" 는 **trigger 의도된 label**(사용자 2026-06-03 trigger 버튼 확정) — collection 이지만 trigger-bearing. Menu 는 자식 trigger element 가 없으므로(factory `children:[]`) 컨테이너 text 를 **유지**해야 한다(소실 시 빈 버튼). → `isCollection` 에서 **Menu 는 trigger-bearing 예외**(`triggerText:true`, text 유지). align 은 legacy(left) ↔ buildCatalogShapes(hasVisibleBg→center, `:194`) 차이 → buildCatalogShapes 의 align 을 trigger 버튼 시각(left)으로 맞출지 `/cross-check` 로 확정(C2 Menu generated CSS 정렬과 동반). 4-2.6 의 text 차단은 **자식 trigger 가 별도로 text 를 그리는 type**(Select/ComboBox)에만 적용.
  - Select/ComboBox: 자식 SelectValue/ComboBoxInput 이 value text 담당 → 컨테이너 text 차단(중복 제거).
  - Tabs: 컨테이너 text 없음(legacy `[]`) → text 차단해도 변화 0. **단 C2 로 `colors.border` 제거 필수**(미제거 시 컨테이너 박스 border 추가). 정정 후 shell = transparent + border 없음.
  - TagGroup: 컨테이너 text 없음(legacy `[]`) → text 차단해도 변화 0. **C2 로 fill base→transparent + border 제거**. 정정 후 shell = transparent.
  - GridList/Table: data row 는 C1 projector → 컨테이너 text 차단 + shell 만.

> **trigger-bearing vs data-bound 구분**: 컨테이너 자신이 trigger label 을 그려야 하는 type(Menu) vs 자식/projector 가 내용을 그리는 type(Select/ComboBox/GridList/Table)의 구분은 **binding 메타 1개**(`triggerText: boolean` 또는 source.kind)로 표현 — 컴포넌트별 분기 아님. Menu 는 `triggerText:true`, 나머지 collection 은 false.

### 4-2.7. C1 projector 적용 범위 (3부류 — data-bound / factory-child / trigger-overlay)

generic collectionProjector(4-2)는 **data row 를 items 배열에서 순회**하는 type 에만 적용한다. collection 범주 안에서도 projection family 를 선별한다(synthesize Area 3 실측).

| 부류                             | type                       | 근거                                                                                                 | C1 projector |
| -------------------------------- | -------------------------- | ---------------------------------------------------------------------------------------------------- | :----------: |
| **(I) data-bound row 순회**      | ListBox / GridList / Table | items/rows 데이터 → 행별 independent cell tree. ListBox=발효 완료(ADR-146), GridList/Table=동형 확장 |   **필요**   |
| **(II) factory-child element**   | Tabs / TagGroup            | TabPanel/Tag 가 이미 independent canonical 자식 element(data-bound 아님) → row 순회 미성립           |    불필요    |
| **(III) trigger + overlay 원자** | Menu / Select / ComboBox   | trigger(컨테이너 shell+label) + popup(원자적 dropdown). 내용은 popup render content, row 전개 아님   |    불필요    |

- (II)/(III) 는 C1 projector 대상 아님 — C2(rule fill 정렬) + C3(text 중복 방지)만으로 발효 안전.
- **ListBox proof → 동형 확장**: 단계 4 C1 의 1차 발효 대상은 **ListBox 재검증(완료 상태) + GridList**. GridList 는 `appendListBoxRowProjection`(canvasSceneNode.ts:460-566)을 `CollectionProjectorConfig`(family 추상화: collectionType/rowElementType/windowLimit/templateAnchorDetector/rowPropsBuilder/projectionIdPrefix)로 일반화한 뒤 `projection:gridlist-row:` prefix 로 등록. `resolveCollectionWriteTarget`(3-route) + `renderProjectionIds`(prefix 일반화)는 union 확장만으로 자동 지원(meta.kind discriminator).
- **Table 2D 발효 완료(2026-06-03)**: row + column cell grid 를 2-tier projection(RowsGroup→Row[i]→Cell[i][j])으로 전개. row 1단(ListBox/GridList) 대비 cell 차원 추가 — `appendTableRowProjection`(canvasSceneNode)이 header 1행 + data N행(window 100) × column 셀을 emit. TableRow=bg(striped/selected)+divider self-render, TableCell=text-only(header fw600/data fw400), 배치는 Taffy flex(row=column flex, cell=고정 폭). cell 은 `columnId` 차원의 `table-cell` kind(`isCollectionCellProjectionKind` 단일 진입점)로 `resolveCollectionWriteTarget` content route 에 columnId 부착. 사용자 결정 "행 단위 셀 노드" — cell 단위 hit-test(deepest pick)+columnId 편집 + window 가상화로 노드 수 제어(100행 cap). column culling(가로 viewport 밖 컬럼 제외)은 현 미적용(균일 폭 가정) — 가변 폭/대량 컬럼 시 후행.

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

| HC                           | 충족 구조                                                                                                                                             | proof Gate        |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| HC#1 단일 공급원             | ②③ `ComponentNode` + `resolveMergedStyle`(theme rule 직접) + 6 레지스트리→단일, type-name 분기 0                                                      | G-slice           |
| HC#2 패널 두 view            | ⑤ `resolveEditContract` 단일 + section 필터                                                                                                           | G-slice           |
| HC#3 base/override 2층       | ③ `resolveMergedStyle` `??`(VisualRule seam 없음), reset=delete                                                                                       | G-adapter         |
| HC#4 Skia 성능               | ④ window(하드 100 제거) + cell generic + sceneVersion cache                                                                                           | G-projected       |
| HC#5 조합=데이터             | ② 조합(composite)→Components page reusable 문서 / leaf(~39 binding)→entry 1개, `resolveReusable` 재귀                                                 | reusable fixture  |
| HC#6 RAC 절대권위            | ③ `toRacProps` D1 채널 + ⑤ `racStateAttrs` data-\* 미러                                                                                               | G-state           |
| HC#7 projected tree          | ④ template subtree 행마다 cell + deep hit + 3-route + boundary guard                                                                                  | G-projected       |
| HC#1/#3 collection 시각 대칭 | ④ C2 rule fill 정렬(컨테이너 bg/border ↔ Preview CSS, source 정정) + C3 shell-only(text 중복 방지, `toSkiaStyle` collection 차단) — 컴포넌트별 분기 0 | G-collection-flip |

---

<a id="영역-순서"></a>

## ⑦ 구현 순서 (proof surface 단계 축소)

> sketch. 실제 phase 분해 + sub-group 결정은 사용자 confirm 후 (adr-writing.md fork checkpoint / M4).
>
> **진행 상태 (2026-06-03 실측 — review-adr round 7)**: 아래 단계는 일부 미래시제로 서술돼 있으나 실제 land 진행은 다음과 같다 (본문 §Status 진행 주석과 동일).
>
> | 단계                         | 상태                                                                                                                                   | 커밋                                                                                                    |
> | ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
> | 1 (공통 기반 1A/1B/1C)       | ✅ **완료**                                                                                                                            | `53f59930f`(1A-a) `1762d7653`(1A-b) `7022b8d84`(1A-c) `5d402d804`(1A-4) `b94fff418`(1B) `d7be36b53`(1C) |
> | 2 (편집 계약 발효)           | ✅ **완료**                                                                                                                            | `5b89e707e` (`getEditor`→`resolveEditContract`)                                                         |
> | 3 (Skia state)               | ✅ **완료** (disabled 실효, hover/pressed threading 후속)                                                                              | `5eebef96a` (`racStateAttrs`)                                                                           |
> | 4 (collection 발효 C1/C2/C3) | ✅ **완료** — collection 7종 전부(ListBox proof + 비-data-bound 4종 + GridList C1 + Table 2D C1 + Menu)                                | `d5da74c72`/`173765201`/`831079766`/`0e9c501d4`/`2818c6bf0`/`d7cfd470c`/`595805242`                     |
> | 5 (구 정본 제거)             | ◐ **부분** — (1b) 잔여 5 skiaLegacy escape 해소(skiaLegacy 0건, calendar_grid/datefield_trigger/tooltip_arrow). 본체(일괄 삭제) 미착수 | (1b) 본 작업                                                                                            |
>
> 따라서 아래 1A "1차 kill 판단" / "단계 1 전체 통과해야 단계 2 진입" 류 미래시제는 단계 1~3 한정으로는 **이미 통과·진행**된 상태의 사후 기록으로 읽는다. 미완은 단계 4(collection 전체)/5.

1. **공통 기반 (family 무관) + Button slice 첫 증명** — 3 sub-step 으로 분해, **early-kill 시점은 1A 직후(7~10h)**. (전체 단계 1 예상 20~28h, 보수적 3일 / 복잡도 터지면 4일)
   - **1A — common spine (7~10h)**: `ComponentNode` schema + `resolveMergedStyle`(theme rule 직접) + `toReactStyle`(override 전용) + `toSkiaStyle`(보편속성 직접) + `resolveEditContract`(variant·size 의미 props 분리) — Button proof 최소.
     - 권장 sub-순서 (R-2 격리, DOM-first):
       - **(a) base source 정본 승격 (②-6-A)**: `componentRulesTable.ts` 헤더 "AUTO-GENERATED" → 정본 표시 교체 + build chain `pnpm generate:rules` step 제거(생성 결과 freeze) + DOM source swap(`generate-css` build script 가 같은 table 의 variant 색상 주입 — `generateCSS` optional source 파라미터, 색상 채널 한정) + parity test 방향 반전 + `resolveComponentVisual`/`variantToVisual` test fixture 격하. DOM 은 generated CSS(table 파생) + `data-variant`/`data-size`, Skia 는 같은 table rule runtime resolve(이미 spec-free). **DOM generated CSS 와 Skia runtime rule 이 같은 table 파생인지** grep 으로 먼저 확인(같은 inline object 아님). Button entry self-contained 확인됨(`componentRulesTable.ts:600-730`, cross-reference 0).
       - **(b) merge 코어 + DOM override**: `resolveMergedStyle`(base=generated rule ⊕ override=props.style) + `toReactStyle`(override 전용) → DOM Button `size` 편집 동일 확인.
       - **(c) Skia 어댑터**: `toSkiaStyle`(같은 rule base ⊕ override runtime) 추가 → `/cross-check` DOM=Skia. DOM 먼저 닫고 Skia 붙이면 R-2(Skia 대칭) 깨지는 지점 격리.
     - **🔴 1차 kill 판단 (1A 끝, 7~10h)** — ②-6-A(table 직접 정본) 하 재해석: Button 하나에서 (1) 손 편집 정본 table 의 Button entry 가 self-contained(확인됨)하고 CSSGenerator 가 table 을 깨끗하게 Button CSS 로 변환하는가(생성기 폐기 → 측정점이 "생성기 출력"에서 "table 변환 명료성"으로 이동), (2) DOM generated CSS 와 Skia runtime rule 이 **같은 table 파생**인가(둘 다 `COMPONENT_RULES_TABLE` 파생이면 정의상 same-source — 사용자 결정 핵심 이득, drift guardrail[parity 반전] 해소 전제), (3) `resolveMergedStyle`/`toSkiaStyle`/`resolveEditContract` 가 spec seam 호출 필요한가 — **1A-(a) 에선 셋 다 미존재(0) → "해당 없음(미진입)"**, 1A-(b)/(c) 의 평가 대상(trivially-pass 로 세지 않음) — 하나라도 막히면 → 1B/1C 로 가지 말고 **③ 영역 A + ②-6 source 설계 재보정**. 20~28h 끝이 아니라 여기서 1차 판단 — 깨끗하지 않은 spine 위에 1B(5 consumer wiring) + 1C(검증)를 쌓는 헛수고 차단. R-1 전역 회귀 방지. **Button proof 신뢰 반경 ≠ 변경 반경**: table 통째 정본화로 129 entry 동시 정본 — 1차 kill 통과 = "Button OK" 이지 "table 전체 OK" 아님(나머지 128 entry 미검증, generate-rules 안전망 상실은 사용자 결정의 구조적 비용).
   - **1B — Button 5 consumer wiring (5~8h)**: DOM / Skia / Properties Panel / Style Panel / Publish 가 1A spine(같은 노드 + theme rule + style source)을 소비하도록 wiring. _(1A kill gate 통과 후에만 진입)_
   - **1C — fallback 차단 + G-slice/G-adapter 검증 (4~6h)**: Button 경로 legacy seam(`resolveComponentVisual` / `render.shapes()` / buildCatalogShapes spec 읽기) **실제 제거** + `/cross-check` 5곳 대칭 + reset round-trip. **성공 = seam 제거하고도 작동** ("작동하지만 fallback 유지" = 실패, dual-SSOT 재현). **2차 kill**: 여기서 대칭/제거 미달이면 어댑터 책임 분해 재설계.
   - **버퍼/재작업 (4~8h)**: R-2 Skia 대칭 디버깅(CanvasKit↔Canvas 2D sub-pixel) 등.

2. **편집 계약 발효**: `useEditContract` + 패널 section 필터 + generic field renderer. `getEditor`/4 섹션 삭제. _(단계 1 전체 통과 후에만 진입)_
3. **Skia state**: `racStateAttrs` + interaction threading + scene invalidation. → **G-state**.
4. **collection 발효 (3계약 묶음 — C1/C2/C3, ④ 영역 B)**: 6 collection + Table 의 Skia generic 발효는 단순 skiaLegacy 제거가 아니라 3계약 동시 성립이 필요(④ 4-1 표).
   - **C2 rule fill 정렬 (4-2.5)**: `componentRulesTable.ts` 직접 정본 편집(②-6-A) — source 정정 **최소 3건**: Tabs(`colors.border` 제거) + TagGroup(fill base `{color.layer-2}`→`{color.transparent}` + border 제거) + Menu(generated `Menu.css` 를 trigger 버튼 rule 에 정렬, 사용자 trigger 확정). Select/ComboBox/GridList 은 이미 정렬(유지), Table 은 `{color.base}`↔`--bg-raised` 토큰 동등성 확정 후 결정. → 컨테이너 shell ↔ Preview CSS 대칭.
   - **C3 children·text 중복 방지 (4-2.6)**: `toSkiaStyle`(영역 A)가 collection entry 면 children/text/label 입력 차단 propsView 로 `buildCatalogShapes` 호출(컴포넌트별 분기 0). Menu 만 `triggerText:true` 예외(컨테이너 label 유지 + align 보정). → Select/ComboBox text 중복 제거.
   - **C1 generic collectionProjector (4-2/4-2.7)**: `isRenderProjectionId` 일반화 → `CollectionProjectorConfig`(family 추상화) → window → `resolveCollectionWriteTarget` 3-route + negative fixture. 적용 범위 = data-bound (I) ListBox(proof 완료) + GridList. (II) Tabs/TagGroup, (III) Menu/Select/ComboBox 는 C2+C3 만으로 발효(projector 불필요).
   - → **G-collection-flip**(6 collection+Table `/cross-check` DOM=Skia 대칭) + **G-projected** + **G-boundary**.
5. **구 정본 + 전체 seam 제거**: 124 spec(123 `shapes:` 정의) + 3 `render.shapes()` call site(그리기 1 + 측정 2) + cutover/skiaLegacy + `buildCatalogShapes`/`resolveComponentVisual` seam(전 family) + 5 레지스트리 + buildSpecNodeData 30+ 분기 삭제. 조합 family Components page reusable 저작(Table 2D column culling 분기).

   > **선행 의존 — 단계 5 진입 차단 조건 (실측 2026-06-03, 단계 4 종료 후 측정 · 2026-06-04 (1b) 해소 반영).** plan 작성 시점 추정("render.shapes 일괄 삭제")은 `render.shapes` 가 **단일 역할(Skia 그리기)** 이라는 가정이었으나, 실측은 **3개 SSOT 역할 겸직**이라 현 상태에서 안전 제거 가능한 spec 교집합이 거의 비어있다. 세 의존이 각각 해소돼야 단계 5 본체(일괄 삭제) 진입 가능. **(1a)/(1b) 는 해소 완료**(아래 표 ✅), 잔여 = (2) replace-primitive 측정 전환 + (3) Layer D 정리:
   >
   > | 의존                                                             | 실측                                                                                                                                                                                                                                                                                                                                             | 차단 이유                                                                                                                         | 해소 선행                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
   > | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
   > | **(1a) Skia 그리기 — collection 7**                              | 현재 `componentCatalog.ts` `{ skiaLegacy: true }` 호출 **12개**(실측 2026-06-03) 중 collection 7 (Menu/Select/ComboBox/Tabs/TagGroup/GridList[④ `:219-254`] + Table[⑤ `:286`]). `isCatalogSkiaCutover = cutover==="catalog" && !skiaLegacy` (`componentCatalog.ts:467`) → `buildSpecNodeData.ts:1180` 에서 `spec.render.shapes(...)` 로만 그려짐 | render.shapes 제거 시 collection Skia 렌더 붕괴 (발효 시 5-type 시각 변화 — 4-1 표)                                               | **본 ADR 단계 4 (C1/C2/C3, ④ 영역 B)** 가 해소 — generic projector(ListBox proof→GridList/Table) + rule fill 정렬(Tabs/TagGroup/Menu) + shell-only(Select/ComboBox text 중복). 단계 4 발효 후 collection 7 의 skiaLegacy 제거 → 단계 5 의 `render.shapes` 제거 대상에서 collection 은 이미 빠짐. (메모리 [[project-collection-skia-flip-not-listbox-isomorphic]] + [[project-adr142-family1-flipped]] "Skia 잔여 → ADR-146 + ADR-912 단계 4")                                                                                                                                                                   |
   > | **(1b) Skia 그리기 — 잔여 5 skiaLegacy** ✅ **해소(2026-06-04)** | 나머지 `{ skiaLegacy: true }` 5 entry — **Tooltip 1**(⑥ overlays) + **date 4**(⑦ Calendar/RangeCalendar/DatePicker/DateRangePicker). skiaPrimitive escape 로 이전 → skiaLegacy 제거 → **skiaLegacy 0건 도달**.                                                                                                                                   | (해소됨) render.shapes 제거 시 Tooltip/date Skia 렌더 붕괴 — escape 로 해소                                                       | **신규 escape 2종 land**: `calendar_grid`(replace — 6주×7일 grid 1:1 이식, Calendar+RangeCalendar 공유, `_hasChildren` 시 shell) + `datefield_trigger`(replace — input box+text+calendar icon, `buildDatePickerShapes` 재사용, DatePicker 200/DateRangePicker 320). Tooltip = bg+text generic + 기존 `tooltip_arrow`(append). **node-type별 primitive**(컴포넌트별 if 아님, skiaPrimitives.ts:7-13 정본). escape parity test 15/15(skiaPrimitives.date.test.ts — byte-exact). 위치: `packages/specs/src/renderers/skiaPrimitives.ts` + 5 binding `skiaPrimitive` 키 + componentCatalog 5 entry skiaLegacy 제거. |
   > | **(2) 텍스트 측정 — 29 TEXT_BEARING_SPECS**                      | `extractSpecTextStyle`(`specTextStyle.ts:167`) + `specTextStyleForOverlay.ts:61` 이 button/badge/checkbox/radio/switch/input/text/heading/paragraph/code/kbd 등 29 type 의 fontSize/lineHeight 를 `spec.render.shapes(props, size, "default")` 로 측정. generic 발효된 leaf 도 측정은 render.shapes 의존                                         | render.shapes 제거 시 텍스트 줄바꿈 위치 어긋남 (canvas-rendering.md §3 "텍스트 측정 동기화" / [[feedback-text-layout-breakage]]) | `extractSpecTextStyle` 를 `buildCatalogShapes`(merged map) 기반 측정으로 전환 — canvas-rendering.md §3 동기화 영역, 회귀 위험 HIGH                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
   > | **(3) layout 높이 공식**                                         | `utils.ts` 가 ListBox/Table 등의 row height 를 `render.shapes` 와 "동일 resolver/공식" 공유 (ADR-907 Layer D, `utils.ts:1522/1595/1612`)                                                                                                                                                                                                         | render.shapes 제거 시 layout 높이 산출 공식 SSOT 단절                                                                             | Layer D resolver 가 `render.shapes` 대신 generic spacing primitive 만 참조하도록 정리 (대부분 이미 `resolveContainerSpacing` 경유 — 잔여 분기만)                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
   >
   > **cutover/skiaLegacy union 제거 차단 — 해소(2026-06-04)**: `skiaLegacy?` 필드는 (1a)collection 7(단계 4) + (1b)잔여 5(Tooltip + date 4, 본 작업) 발효로 **사용처 0건** 도달 → `skiaLegacy?` 필드 자체 제거 가능(현재 helper 정의 + getCatalogSkiaCutoverTypes 필터에만 잔존, 안전망으로 유지). `CutoverState = "legacy"|"cutting-over"|"catalog"` 의 `"legacy"`/`"cutting-over"` 분기도 모든 entry 가 `cutover:"catalog"` 이라 dead — union 단순화는 단계 5 본체에서 spec/측정 경로와 함께 정리(표면 정리, 회귀 무관).
   >
   > **결론 (2026-06-04 갱신)**: 단계 5(render.shapes 일괄 제거) 본체 진입 선행 4 의존 중 **(1a) collection 발효 + (1b) 잔여 5 skiaPrimitive escape = 해소 완료** → Skia 그리기 의존(skiaLegacy 0건) 전부 닫힘. **잔여 = (2) replace-primitive 텍스트 측정 generic 전환**(date/Tooltip 은 TEXT_BEARING 비멤버라 무관, checkbox/radio/switch replace 류만 — 측정은 spec.render.shapes 유지가 정합, fontWeight drift 회피) **+ (3) Layer D 정리**(대부분 `resolveContainerSpacing` 경유, 잔여 분기만). collection 7 의 Skia 그리기 의존은 ADR-920(Superseded by ADR-910, 비착수)이 아니라 **본 ADR 단계 4 가 직접 해소**, (1b) 는 **본 ADR 단계 5 첫 작업 단위가 직접 해소**(사용자 결정 2026-06-04 "단계 5 첫 작업 단위 = 1b escape"). 단계 1~4 + (1b) 성과 유지. 본체 일괄 삭제는 (2)/(3) 통과 + 별도 사용자 승인 후. [[feedback-no-fallback-thinking]] (skiaLegacy 는 fallback 아닌 미발효 정상 경로 — 이제 0건) + [[feedback-proof-gate-seam-removal-kill-criteria]] (generic 발효 검증 후 seam 제거) 정합.

**단계 게이트 원칙**: (1) **1A 직후(7~10h) 1차 kill** — Button spine 이 지저분하거나 seam 호출 필요 시 1B/1C 진입 금지, 설계 재보정. (2) **1C 후 2차 kill** — seam 제거+대칭 미달 시 어댑터 재설계. (3) 단계 1 전체 통과해야 단계 2~5(family 전면 확장) 진입. Button 경로 seam 은 1C 에서 제거(proof), 나머지 family seam 은 단계 5 일괄 제거 — 회귀 표면이 단계별로 닫힌다. "작동하지만 fallback 유지" 상태로 다음 단계 진입 금지(dual-SSOT 재현). [[feedback-proof-gate-seam-removal-kill-criteria]]

---

<a id="영역-파일"></a>

## ⑧ 핵심 파일

| 영역                    | 파일                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| schema/어댑터           | `packages/shared/src/catalog/types.ts` (cutover/skiaLegacy 제거 + ComponentNode + variant·size accepts 분리 + PropContract.section 확장 + **entry `panel:{ label, icon, category, layoutOnly? }` 필드 추가**, ②-5 #1), 신규 `resolvers/resolveMergedStyle.ts`(theme rule 직접)/`outputs/toReactStyle.ts`/`toSkiaStyle.ts`(보편속성 직접)                                                                                                                                                                                                                                                                                                                                          |
| seam 제거               | `renderers/buildCatalogShapes.ts`(spec seam — toSkiaStyle 로 대체), `renderers/utils/resolveComponentVisual.ts`(VisualRule seam — theme rule 직접으로 대체)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 등록                    | `componentCatalog.ts`(6 레지스트리 collapse, cutover/skiaLegacy 제거), `cutover.ts` 삭제, **`panels/components/ComponentList.tsx:70-145` 정적 배열 → catalog 파생 전환**(②-5 #1), **`sprites/builderAliasMap.ts` ALIAS(ComboBoxWrapper 등 D3 고유) → leaf entry 정규 등록**(②-5 #2)                                                                                                                                                                                                                                                                                                                                                                                               |
| base 층                 | `resolvers/resolveComponentRule.ts`(위치·시그니처 무변경, 정본 테이블 read) + `catalog/generated/componentRulesTable.ts`(②-6-A: **직접 정본 승격** — 헤더 "AUTO-GENERATED"→정본 표시, 손 편집). DOM swap: `renderers/CSSGenerator.ts`(`generateCSS` optional variant source 파라미터) + `scripts/generate-css.ts`(shared table import 주입) + `scripts/validate-sync.ts`(동일 주입). audit: `packages/design.md` + `react-aria-starter/src/*.css`(토큰 팔레트, variant→token 매핑 없음 — 무변경). 삭제(단계 5): `generate-rules.ts`. 제거: `package.json:34` build chain `pnpm generate:rules` step                                                                               |
| 렌더 dispatch           | `apps/builder/.../skia/buildSpecNodeData.ts`(generic, 30+ 분기 제거), `preview/components/CanonicalNodeRenderer.tsx`(legacy rendererMap 제거)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| projected tree          | 신규 `projection/collectionProjector.ts`, `scene/canvasSceneNode.ts`(union 확장 + `appendListBoxRowProjection`→`CollectionProjectorConfig` 일반화), `rendererInput.ts`(windowed 주입), `projection/renderProjectionIds.ts`(prefix 일반화), `projection/resolveCollectionWriteTarget.ts`(meta.kind generic discriminator), `components/listbox/listBoxRowProjectionModel.ts`(→ `collectionProjectionModel` 일반화), `listBoxTemplateOrigins.ts`(family 무관 일반화)                                                                                                                                                                                                                |
| collection 발효 (C2/C3) | **C2 rule fill** (`componentRulesTable.ts` 직접 정본 편집, ②-6-A — generated table 직접 수정 아닌 정본 승격된 table 수정): Tabs `colors.border` 제거 + TagGroup fill base `{color.layer-2}`→`{color.transparent}` + border 제거 + Menu generated `Menu.css` trigger 버튼 rule 정렬(`packages/shared/src/components/styles/generated/Menu.css`) ⇒ `resolveMergedStyle` 가 DOM/Skia 양쪽 대칭 자동. **C3 shell-only**: `outputs/toSkiaStyle.ts`(collection entry → children/text/label 입력 차단 propsView) + `catalog/types.ts` binding 메타 `triggerText?:boolean`(Menu=true 예외). `buildCatalogShapes.ts` 자체 무변경(text 입력 undefined → `:171 if(text)` false → shell-only) |
| 편집 계약               | 신규 `resolvers/resolveEditContract.ts`, `panels/properties/generic/` field renderer, `StylesPanel.tsx`/`PropertiesPanel.tsx`(section 필터), `getEditor`/`registry.ts` 삭제                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Skia state              | 신규 `specs/utils/racStateAttrs.ts`, `hooks/useElementHoverInteraction.ts`(state derive), `StoreRenderBridge.ts`(interaction 주입)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |

---

## 검증 (Verification — 코드 단계)

1. **G-slice**: Button `size="md"→"sm"` → DOM/Skia/Properties/Style/Publish 5곳 `fontSize:14` 동일 + `/cross-check`. **성공 = (a) Button 경로 legacy seam(resolveComponentVisual/render.shapes/buildCatalogShapes·CSSGenerator spec 읽기) 제거하고도 5곳 작동 + (b) DOM generated CSS 와 Skia runtime rule 이 같은 정본 table(②-6-A `componentRulesTable.ts`) 파생**. "작동하지만 seam(spec) fallback 유지" = 실패. **kill: 깨끗하게 안 나오면 단계 2~5 진입 금지, ③ 영역 A + ②-6 source 설계 재보정**.
2. **G-adapter**: `resolveMergedStyle`(spec/VisualRule seam 미경유) reset round-trip + DOM/Skia 대칭. **성공 = fallback 0 + 같은 source**(applyInlineBorderOverlay 류 사후 우회 없이, DOM=generated CSS·Skia=runtime rule 이 같은 generated source 파생 — "같은 inline object" 아님). **kill: text 측정/spacing/fill 이 같은 source 로 DOM/Skia 대칭 안 나오면 어댑터/source 책임 분해 재설계**(전면 확장 금지).
3. **G-projected**: 10k row 노드 ≤ window+overscan, deep hit/drill-in, refresh 후 `projection:` 0건.
4. **G-state**: selection family Builder Skia hover/pressed/selected = Preview DOM `data-*` parity.
5. **G-collection-flip** (단계 4 C1/C2/C3): 6 collection(Menu/Select/ComboBox/Tabs/TagGroup/GridList)+Table skiaLegacy 제거 후 각 컨테이너 Builder Skia 렌더 = Preview DOM `/cross-check` 대칭. **성공 = (a) 컨테이너 shell(bg+border) 이 Preview 컨테이너 CSS 와 일치(C2) + (b) value/label text 가 컨테이너·자식 중복 없이 1회만 그려짐(C3) + (c) data row(ListBox/GridList) 가 projected cell 로 deep hit 가능(C1)**. **kill: 발효 후 시각 변화(text 소실/중복, 배경/border 추가)가 남으면 해당 type 의 C2 source 정정 또는 C3 차단 누락 — 단계 5 진입 금지**. 직전 실측 5-type 차이(Menu align / Select·ComboBox 중복 / Tabs border / TagGroup 배경+border)가 0 으로 닫혀야 통과.
6. `pnpm type-check` + `pnpm run codex:preflight`.
7. **등록 게이트 교체** (②-5 졸업, codex review 2026-06-02 결함 4 정정): ADR-139 의 `componentRegistrationContract.test.ts`(spec/TAG_SPEC_MAP/rendererMap/getDefaultProps 6중복 병치 검증)는 6중복 소멸 시점에 **삭제**된다 — 단일 등록 collapse 후엔 검증할 평행 병치가 없어 이 테스트는 의미가 사라진다. 대신 신규 `entryUniverseContract.test.ts`(렌더·Inspector·palette 가 모두 같은 entry set = `componentCatalog` 을 소비하는지 검증)로 대체. **타이밍**: 6중복 소멸(②-5 collapse + 5 레지스트리 제거) land 까지는 기존 `componentRegistrationContract.test.ts` 가 유효(점진 제거 중 누락 방지), collapse 완료 커밋에서 졸업·교체. 즉 본 ADR land 과정 중에는 기존 게이트 통과 필수, land 완료 후에 졸업.
