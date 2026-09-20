# ADR-228 구현 설계: 팔레트 전 항목 reusable origin — Components 페이지 = origin 전집 + 테마 한 세트

정본: [ADR-228](../228-palette-wide-reusable-origins.md)

작성일: 2026-09-21. 코드 사실은 이 날짜의 main (`81d96353f`) 실측이다 — 착수 시 Phase 0 에서 재실측한다.

## 1. 전제 lock-in (사용자 confirm 2026-09-21, AskUserQuestion 3문)

- base / 응용: ADR-148 (reusable entry 등록 + slot 일반화 + propsSchema, Implemented 07-17) 이 base 이고 이 ADR 은 그 등록을 **팔레트의 RAC 컴포넌트 전 항목** 으로 넓히는 응용이다. 148 의 4 결정 (catalog `kind:"reusable"` 단일 등록 · `metadata.propsSchema` · slot vocabulary · placeable 단일성) 은 바꾸지 않는다.
- schema: canonical 타입 변경 0. `type:"ref"` instance · origin 노드 · `metadata.propsSchema` 전부 148 의 모양 그대로. 바뀌는 것은 **catalog entry 의 kind** (primitive → reusable, 동명 primitive 는 `placeable:false` 공존) 와 origin seed 의 **생성 방식** (손 seed → catalog 파생 generic).
- 의존 방향: 148 → 228 한 방향. 227 (다중 테마) 과는 **직교** — 227 은 토큰 값, 228 은 노드 구조. 둘 다 Components 페이지를 표면으로 쓰지만 서로를 선행 조건으로 두지 않는다 (227 Decision 4 는 228 의 결과를 "그 페이지가 테마 표면" 으로 읽기만 한다).
- 사용자 결정 3 (2026-09-21): ① 새 ADR-228 (148 재개 · 227 흡수 기각) ② origin 범위 = RAC 컴포넌트만 (내용/레이아웃 primitive 8 제외) ③ 기존 plain 노드는 공존 — 새 배치만 instance (migration 0).
- fork 아님 · sub-phase 분할 없음 (Phase 0~4). 파일 수 추정 ≤ 20 — 손 seed를 항목별로를 만들지 않는 것이 이 ADR 의 핵심이라 파일 수가 항목 수에 비례하지 않는다.

## 2. Phase 0 코드 사실 표 (2026-09-21 실측, `81d96353f`)

| #   | 사실                                                                                                                                                                                                                                                                                              | 경로:라인                                                                                                                                                                                                   |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F1  | 팔레트 `PALETTE_ORDER` = 66 항목 (category 7). 그중 reusable entry 는 **5** (Toolbar · Form · IconButton · InlineAlert · Card), 나머지 61 은 primitive 로 직접 노드가 된다                                                                                                                        | `apps/builder/src/builder/panels/components/paletteItems.ts:186-288` · `packages/shared/src/catalog/componentCatalog.ts:1177-1210`                                                                          |
| F2  | 팔레트 추가 경로: `getReusableCompositeOriginId(type)` 가 있으면 `type:"ref", ref: originId` + `COMPONENT_MASTER_ID_MIRROR_FIELD` 만 만든다 (자식은 origin 이 보유) — 없으면 factory 로 plain 노드                                                                                                | `apps/builder/src/builder/hooks/useElementCreator.ts:242-263`                                                                                                                                               |
| F3  | reusable 등록 = catalog `reusableEntry(type, family, reusableId, panel)` (kind `reusable` · `cutover:"catalog"` · `panel.placeable:true`) + 동명 primitive 는 `placeable:false` (placeable 단일성 HC#3). 인덱스 2원화 `CATALOG_BY_TYPE` / `REUSABLE_BY_TYPE`                                      | `componentCatalog.ts:62-76` · `catalog/types.ts:236`                                                                                                                                                        |
| F4  | origin seed = 컴포넌트당 손 모듈 (`ensure*TemplateOrigins`, 136~278 줄) → `REUSABLE_ORIGIN_ENSURERS[reusableId]` 매핑. `componentRegistrationContract.test.ts:289` 가 entry ↔ ensurer 누락을 강제. 공통 경로 `ensureTemplateOrigins(document, originIds, repair)` 가 Components body 에 멱등 시드 | `apps/builder/src/builder/components/reusableCompositeOrigins.ts:40-50` · `ensureTemplateOrigins.ts:54-75` · `iconbutton/iconButtonTemplateOrigins.ts` (242)                                                |
| F5  | ensurer 호출처 = 초기 문서 생성 · main document 정규화 (hydration) · 팔레트 추가 · AI compositeCreation · builderHost — 5곳                                                                                                                                                                       | `dashboard/createInitialProjectDocument.ts` · `adapters/canonical/mainDocumentNormalization.ts` · `useElementCreator.ts` · `services/ai/tools/compositeCreation.ts` · `services/ai/compiler/builderHost.ts` |
| F6  | instance 편집 계약 = origin root `metadata.propsSchema` → `resolveEditContract` 가 generic 필드로 소비 · 편집은 instance root props override · 템플릿 바인딩 `{label}` 은 `canonicalRefResolution.ts` propsSchema gate 가 치환 · **passthrough** 축 (variant/size) 은 origin root 가 직접 소비    | `iconButtonTemplateOrigins.ts:16-34` · `catalog/resolvers/resolveEditContract.ts:320` · `catalog/templateBinding.ts` (`readPropsSchema`)                                                                    |
| F7  | 렌더: Skia `canvasSceneNode.ts:1144` · DOM `CanonicalNodeRenderer` 모두 `resolveCanonicalRefTree` 로 origin 서브트리를 실체화 (`_resolvedFrom`) — ref 는 이미 두 leg 공통 경로                                                                                                                    | `workspace/canvas/scene/canvasSceneNode.ts:1144` · `packages/shared/src/renderers/*`                                                                                                                        |
| F8  | Components 페이지 = 시스템 페이지 `page-components` (`pageRole:"components"`, `/__components`, runtime audience 제외, body `overflow:auto`) — origin 보관 + 사용자 reusable origin 저작 자리                                                                                                      | `apps/builder/src/builder/pages/systemComponentsPage.ts` · `packages/shared/src/utils/export.utils.ts:224-236`                                                                                              |
| F9  | PALETTE_ORDER 66 type − 내용/레이아웃 primitive 8 − IllustratedMessage 1 = eligible 57 type. Toast는 PALETTE_ORDER 밖이다. creationVariants로 펼친 UI 항목 수와 type 수는 별도다 (리뷰 재실측 HEAD a7c85b70f)                                                                                     | `paletteItems.ts:190-277,304-313` · `componentCatalog.ts:457-462`                                                                                                                                           |
| F10 | 148 Phase 3 판정 잔재: Toast (팔레트 비노출 · imperative) 보류 · IllustratedMessage (escape + flat self-compose) 부적격 — 이 ADR 도 같은 판정 승계 (IllustratedMessage 는 primitive 유지)                                                                                                         | `docs/adr/completed/148-*.md` 진행 로그 Phase 3                                                                                                                                                             |

## 3. origin 기본값과 instance 생성값의 소유권

2026-09-21 리뷰 수리 기준 HEAD `a7c85b70f`.

### 3.1 origin seed — 현행 factory의 기본값 합성을 재사용 (M2)

PropContract는 편집 계약의 source이며 factory 초기값 전체는 아니다. `types/builder/defaultPropsDerivation.ts`는 catalog defaults + FACTORY_LOCAL_DEFAULTS를 합친다. Button의 "Button", Badge의 "Badge", Link의 href 등은 후자에서 온다. origin seed는 기존 `getDefaultProps(type)` 및 생성 기본 style 합성 경로를 재사용한다. `defaultPropsFrom(contract)`라는 별도 기본값 함수를 만들지 않는다.

```ts
// 개념 코드 — entry→primitiveType 매핑은 Phase 0에서 확정한다.
// leaf seed의 기본값은 기존 palette 생성 합성과 같은 함수에서 온다.
const props = composeCreationProps(
  primitiveType,
  getDefaultProps(primitiveType),
  undefined, // 생성 진입점 initialProps는 origin에 넣지 않는다
);
const origin = {
  id: reusableId,
  type: primitiveType,
  reusable: true,
  name: catalogLabel,
  props,
  metadata: {
    systemOwned: true,
    propsSchema: passthroughSchema(primitiveContract),
  },
};
```

기존 reusable 5종의 특수 구조/템플릿은 손 ensurer를 유지한다. 나머지는 generic seed로 만들되, 기존 동일 origin id가 있으면 재사용하고 사용자 props/children/responsive/name/배치를 보존한다. schema 진화는 코드 정본으로 보강한다.

자식 구조형은 factory의 **root props와 children definition 모두** 재사용한다. 현재 예시는 `createSelectDefinition(context)`, `createComboBoxDefinition(context)` (`factories/definitions/SelectionComponents.ts`)이며 범용 `createDefaultChildren` 함수가 이미 있다고 가정하지 않는다. Phase 0에서 타입별 순수 definition 경계, context 의존과 ID 생성 위치를 기록하고 공통 seed adapter에서 canonical origin subtree로 변환한다. DB/store mutation을 일으키는 factory 실행을 hydration에서 호출하지 않는다. origin root·descendant id는 최초 생성 뒤 안정적으로 유지하고 재hydration 시 새로 발급하지 않는다.

passthrough schema는 PropContract를 복제하고 기존 resolveEditContract 경로로 소비한다. schema 추가가 기존 row-data `{label}` 치환 범위에 영향을 주는 자식 구조형은 instance별 다른 행 데이터로 확인한다. D2 kind/값은 바꾸지 않는다.

### 3.2 생성 진입점의 initialProps — instance override (H1)

현행 `useElementCreator.ts:242-275` ref 분기는 props={}만 넣는다. Chart의 `componentCatalog.ts:457-462` creationVariants와 `paletteItems.ts:304-313` 전달값을 보존하도록 이 분기를 수정해야 한다.

- reusable entry의 panel 메타에 기존 creationVariants를 그대로 보존한다. type=Chart 하나와 여러 paletteId의 관계를 유지하며 PALETTE_ORDER를 늘리지 않는다.
- origin은 공통 factory 기본값을 소유하고, instance는 선택한 생성 진입점/호출자가 **명시한 initialProps만** override로 소유한다. 현재 origin과 값이 같더라도 명시한 chartType은 보존한다.
- origin 기본 props 전체를 ref에 복사하지 않는다. unmodified size/variant 등은 origin 변경을 따라야 한다. style patch도 origin style과 기존 deep-merge 계약을 유지한다.
- 팔레트·AI의 compositeCreation/builderHost 중 직접 initialProps를 받는 경로가 같은 생성 patch 함수를 사용한다. initialProps 미지정 시 props={}로 상속한다.
- 재사용할 기존 parent routing/nesting preflight도 ref 전환으로 우회하지 않도록 생성 경로 inventory에 포함한다. 컴포넌트 생성 자체의 공통 유효성 계약은 유지한다.

### 3.3 대상 집합과 문서 증가량 (M3)

Phase 0이 아래 집합/수를 JSON 또는 표로 freeze하고 이후 gate가 이를 읽는다.

| 지표           | 정의와 현재 확인값                                                                                    |
| -------------- | ----------------------------------------------------------------------------------------------------- |
| P              | PALETTE_ORDER의 고유 type 집합, 현재 66                                                               |
| X              | Text/Icon/Separator/Skeleton/Image/frame/Section/Slot + IllustratedMessage, 현재 9. Toast는 P 밖      |
| E              | P − X, 현재 57 eligible type. binding 유무는 등록 매핑 검증이지 X를 덮는 자동 선정 기준이 아님        |
| V              | E의 creationVariants를 펼친 palette entry 집합. 각 entry→type→originId→initialProps를 기록            |
| R              | E에 대응하는 고유 origin root id 집합. 현재 type별 하나 정책상 57 예상, alias/collision은 G0에서 해결 |
| 신규 root      | 문서별 R − 기존 origin id 집합. 기존 reusable 5와 template origin을 빼므로 고정 57이 아님             |
| 노드·byte 증가 | 신규 root와 모든 descendants, 필요한 페이지 shell, schema 보강을 포함한 실제 직렬화 전후 차이         |

E 밖의 사용자 origin과 collection item template origin도 Components 페이지에 남는다. 따라서 페이지 전체 노드 수를 57로 제한하지 않는다. 새 reusable 등록 수는 기존 5가 E에 포함되면 52이며, 신규 origin root 수와 같다고 가정하지 않는다. 기존 plain 노드가 재작성되지 않았음을 별도로 비교한다.

## 4. Phase 별 작업

### Phase 0 — inventory freeze

- F1~F10, §3의 P/X/E/V/R와 entry→ensurer 또는 generic seed 매핑, factory definition/default 합성/initialProps caller를 확정한다.
- E를 leaf/자식 구조형/기존 특수 reusable로 나누고 excluded X는 별도 표로 둔다. origin id 충돌과 기존 template origin 재사용 규칙을 명시한다.
- 동일 seed 600요소 ref 0% baseline, 예상 origin root/descendant/byte 증가량, 변경 파일 수 확정.
- **G0**: 명시 제외 정책과 E 일치, V 전수 매핑·파일/소비자 inventory 완결. 초기 20파일 추정은 확정 inventory로 대체하며 누락은 같은 ADR 안에서 보강한다.

### Phase 1 — 등록 · seed · 생성 경로

- reusableEntry 등록 및 동명 primitive placeable:false. 기존 panel 메타와 creationVariants 보존, PALETTE_ORDER 무변경.
- ensureCatalogOrigins는 기존 손 ensurer 또는 §3.1 generic seed를 호출한다. 등록 불변식은 각 E에 실제 seed 가능한 경로가 있는지 강제하며 단순 방어적 skip을 합격으로 보지 않는다.
- useElementCreator 및 AI 생성 ingress에 §3.2 initialProps patch를 연결한다.
- mainDocumentNormalization은 기존 origin을 보존하면서 누락분만 생성한다.
- **G1**: V 전수 추가→예상 type/ref/명시 initialProps, origin R 존재, factory 초기 유효 props/subtree 동치, reload 멱등, 기존 plain 무변화. entry 1개 원복 RED.

### Phase 2 — 실제 편집 · 렌더 대칭

- resolveEditContract의 필드뿐 아니라 편집 쓰기·Styles override/상속·reset을 확인한다.
- **G2**: V 전수 ref vs 같은 유효 props의 plain Skia/DOM 픽셀 Δ0. Button/Badge/Link/ToggleButton 기본 내용, 자식 구조형 기본 트리, Chart 모든 생성 진입점의 chartType 및 preset 보존.
- Chart 각각 생성→props 저장→reload→origin 공통 size/variant 변경→Undo/Redo를 live로 확인한다. 명시 chartType은 유지되고 비override 필드는 origin을 따른다. initialProps 없는 instance도 확인한다.
- 자식 구조형의 행 데이터/구조 편집·drag·복제는 대표 경로별 실제 사용자 동작으로 검증한다. 필드 목록 정적 일치만으로 편집 동등성을 선언하지 않는다.

### Phase 3 — Components 페이지

- origin R을 카테고리 순 grid로 배치한다. 사용자/기존 template origin과 사용자 배치는 보존하며 전체 children 수=57을 요구하지 않는다.
- systemOwned root 삭제 금지, origin 편집→instance 전파, 이름/이동 가능. 227이 있으면 해당 전집으로 227 G5 실행.
- **G3**: R 전수 표시, origin 변경/Undo 전파, plain 공존, 기존 origin 사용자 편집과 위치의 hydration 보존.

### Phase 4 — AI · 초기 문서 · 비용

- AI/팔레트/초기 생성/hydration이 같은 ensurer를 사용하고 직접 생성 initialProps도 같은 patch를 통과한다.
- **G4**: 600요소 ref 100% scene build·선택·편집 p95 ≤ ref 0% baseline +1ms. 문서별 신규 root/descendants/schema/page shell의 Δnode 및 Δbyte를 G0 예상값과 대조, 재hydration 추가 Δ0. plain 본문 재직렬화 변화 0. AI initialProps와 origin 상속 확인.

## 5. 파일 경계 (Phase 0 확정)

| 영역      | 경로·책임                                                                                                               |
| --------- | ----------------------------------------------------------------------------------------------------------------------- |
| catalog   | componentCatalog.ts entry/placeable 및 panel creationVariants 보존. binding kind/값 무변경                              |
| seed      | catalogOrigins.ts 신규, reusableCompositeOrigins, ensureTemplateOrigins, factory definition/default 합성 재사용 adapter |
| 생성      | useElementCreator, compositeCreation, builderHost, 공통 initialProps patch 및 parent preflight                          |
| hydration | createInitialProjectDocument, mainDocumentNormalization, 기존 origin 보존                                               |
| 편집      | resolveEditContract, canonicalRefResolution 소비 확인/필요 수리                                                         |
| 페이지    | systemComponentsPage origin 배치                                                                                        |
| 검증      | registration, factory seed 동치, Chart variant 생성/persist/상속, instance 편집/cross-check, live/perf                  |

새 catalog children seed 훅을 당연시하지 않는다. 현재 factory definition 재사용으로 해결하며 필요 파일 수는 Phase 0에서 중복 제거해 확정한다.

## 6. 유보 항목

- 기존 plain의 instance 전환: 사용자 요청 시 별도 액션과 자식 역변환 규칙을 정한다.
- 내용/레이아웃 primitive 8종의 origin화: 이번 범위 밖. typography는 우선 227에서 다룬다.
- Toast·IllustratedMessage: 기존 제외 정책 유지. 포함하려면 제품 범위 재결정이 필요하다.

## 7. 리뷰 수리 상태

2026-09-21 round 1 H1/M2/M3를 §3~~5와 본문 Gates에 반영했다. 설계 수리 완료, Proposed 유지. 구현 G0~~G4는 UNVERIFIED다.
