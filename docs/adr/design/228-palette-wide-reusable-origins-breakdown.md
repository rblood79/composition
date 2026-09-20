# ADR-228 구현 설계: 팔레트 전 항목 reusable origin — Components 페이지 = origin 전집 + 테마 한 세트

정본: [ADR-228](../228-palette-wide-reusable-origins.md)

작성일: 2026-09-21. 코드 사실은 이 날짜의 main (`81d96353f`) 실측이다 — 착수 시 Phase 0 에서 재실측한다.

## 1. 전제 lock-in (사용자 confirm 2026-09-21, AskUserQuestion 3문)

- base / 응용: ADR-148 (reusable entry 등록 + slot 일반화 + propsSchema, Implemented 07-17) 이 base 이고 이 ADR 은 그 등록을 **팔레트의 RAC 컴포넌트 전 항목** 으로 넓히는 응용이다. 148 의 4 결정 (catalog `kind:"reusable"` 단일 등록 · `metadata.propsSchema` · slot vocabulary · placeable 단일성) 은 바꾸지 않는다.
- schema: canonical 타입 변경 0. `type:"ref"` instance · origin 노드 · `metadata.propsSchema` 전부 148 의 모양 그대로. 바뀌는 것은 **catalog entry 의 kind** (primitive → reusable, 동명 primitive 는 `placeable:false` 공존) 와 origin seed 의 **생성 방식** (손 seed → catalog 파생 generic).
- 의존 방향: 148 → 228 한 방향. 227 (다중 테마) 과는 **직교** — 227 은 토큰 값, 228 은 노드 구조. 둘 다 Components 페이지를 표면으로 쓰지만 서로를 선행 조건으로 두지 않는다 (227 Decision 4 는 228 의 결과를 "그 페이지가 테마 표면" 으로 읽기만 한다).
- 사용자 결정 3 (2026-09-21): ① 새 ADR-228 (148 재개 · 227 흡수 기각) ② origin 범위 = RAC 컴포넌트만 (내용/레이아웃 primitive 8 제외) ③ 기존 plain 노드는 공존 — 새 배치만 instance (migration 0).
- fork 아님 · sub-phase 분할 없음 (Phase 4 개). 파일 수 추정 ≤ 20 — 손 seed 58 개를 만들지 않는 것이 이 ADR 의 핵심이라 파일 수가 항목 수에 비례하지 않는다.

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
| F9  | 내용/레이아웃 primitive (origin 제외 후보): Text · Icon · Separator · Skeleton · Image · frame · Section · Slot = 8. 나머지 58 이 RAC 컴포넌트 (catalog binding 보유) — Phase 0 에서 binding 유무로 확정                                                                                          | `paletteItems.ts:186-288` · `catalog/bindings/*`                                                                                                                                                            |
| F10 | 148 Phase 3 판정 잔재: Toast (팔레트 비노출 · imperative) 보류 · IllustratedMessage (escape + flat self-compose) 부적격 — 이 ADR 도 같은 판정 승계 (IllustratedMessage 는 primitive 유지)                                                                                                         | `docs/adr/completed/148-*.md` 진행 로그 Phase 3                                                                                                                                                             |

## 3. 핵심 설계 — origin seed 를 catalog 에서 파생한다 (Decision 2)

손 seed 58 개는 만들지 않는다. leaf RAC 컴포넌트의 origin 은 **노드 하나** 이고 그 모양은 catalog 가 이미 안다:

```ts
// apps/builder/src/builder/components/catalogOrigins.ts (신규)
export function buildCatalogOrigin(entry: ReusableCatalogEntry): CanonicalNode {
  const contract = getPropContract(entry.primitiveType); // D2 — 읽기만
  return {
    id: entry.reusableId, // "component-<type-kebab>"
    type: entry.primitiveType, // origin root = 동명 primitive
    props: defaultPropsFrom(contract), // factory 기본값과 같은 함수
    metadata: {
      systemOwned: true,
      propsSchema: passthroughSchema(contract), // 전 prop passthrough (F6 축)
    },
    children: entry.children ? seedChildren(entry) : undefined, // 손 seed 가 있는 5 + 자식 구조형만
  };
}
```

- `REUSABLE_ORIGIN_ENSURERS` 는 "손 seed 가 있으면 그것, 없으면 `buildCatalogOrigin`" 으로 한 함수 (`ensureCatalogOrigins`) 가 감싼다 — 등록 불변식 테스트 (F4) 는 "entry 마다 ensurer **또는** catalog 파생 가능" 으로 완화.
- `passthroughSchema(contract)` = PropContract 의 편집 가능 prop 전부를 root passthrough 로 선언 — 템플릿 바인딩 (`{label}`) 은 손 seed 에만 있다. Properties 패널은 F6 경로 그대로라 신규 InspectorFieldKind 0.
- **D2 경계**: PropContract 의 kind/값은 읽기만 한다. catalog 파일 변경은 entry 의 `kind`/`placeable` 뿐 (§4 Phase 1).
- 자식 구조가 있는 RAC 컴포넌트 (Dialog · Tabs · Table · Menu · ListBox · GridList · Tree · DisclosureGroup · CardView · Nav · Breadcrumbs · TagGroup · CheckboxGroup · RadioGroup · ToggleButtonGroup · ButtonGroup · Modal · Popover · Form/Toolbar/Card 기존) 은 factory 가 만들던 기본 자식을 origin 자식으로 옮긴다 — factory 의 `createDefaultChildren` 을 seed 가 재사용 (코드 이동, 로직 복제 0).

## 4. Phase 별 작업

### Phase 0 — inventory freeze

- F1~F10 재실측. 58 항목을 세 군으로 분류해 표 확정: (a) leaf (자식 0, catalog 파생만) · (b) 자식 구조형 (factory 기본 자식 이동) · (c) 148 판정 잔재 (Toast 보류 · IllustratedMessage 제외). `placeable:false` 로 바꿀 동명 primitive 목록.
- 성능 baseline: 600 요소 문서 (perf-baseline frame lane) 에서 ref 0% vs ref 100% 의 scene build · 선택 · 편집 프레임 — 이 ADR 이 유일하게 새로 만드는 비용.
- **G0**: 표 · 분류 · baseline 일치. 파일 수 20 대비 1.5× 초과 시 M3.

### Phase 1 — catalog 등록 sweep + generic origin (Decision 1·2)

- `componentCatalog.ts`: (a)+(b) 군 `reusableEntry(...)` 추가 + 동명 primitive `panel.placeable:false`. `PALETTE_ORDER` 는 무변경 (placeable 단일성으로 reusable 이 정본).
- `catalogOrigins.ts` 신규 (§3) · `reusableCompositeOrigins.ts` 의 ENSURERS 를 `ensureCatalogOrigins` 로 감싸기 · 등록 불변식 테스트 완화.
- hydration: `mainDocumentNormalization` 이 새 origin 을 Components body 에 멱등 시드 (기존 문서도 열면 origin 이 생긴다 — plain 노드는 그대로).
- **G1**: 팔레트 58 항목 추가 → 전부 `type:"ref"` · origin 이 Components body 에 1개씩 · 새로고침 후 유지 · 기존 fixture 의 plain 노드 렌더/편집 무변화 (원복 RED: entry 1개 primitive 로 되돌리면 plain 노드 생성).

### Phase 2 — instance 편집 · 렌더 대칭 (Decision 3)

- `resolveEditContract`: passthrough 전체 schema 를 읽는 경로 확인 (IconButton 의 variant/size 축 일반화). Properties 패널 필드 목록이 plain 노드일 때와 **같아야** 한다 (사용자가 instance 인지 모르게).
- Skia · DOM: ref 실체화 경로 (F7) 에서 leaf origin (자식 0) 처리 — `_resolvedFrom` 이 root 만 가리키는 경우.
- Styles 패널: instance root 의 `props.style` override 가 origin 위에 덮이는 순서 (148 R3 순서 계약 그대로).
- **G2**: `/cross-check` 팔레트 전수 — ref instance vs 같은 props 의 plain 노드 픽셀 Δ 0 (두 leg). ADR-198 하니스에 "instance arm" 추가.

### Phase 3 — Components 페이지 = origin 전집 + 테마 표면 (Decision 4)

- Components body 의 origin 배치: 카테고리 7 순서 (PALETTE_ORDER) 로 grid 자동 배치 (`pagePositions` 아님 — body 안 flex/grid 레이아웃, 사용자가 옮길 수 있다).
- origin 편집 → instance 전파 (148 기존) · origin 삭제 금지 (systemOwned) · origin 이름은 catalog label.
- 227 이 같이 있으면: 테마 전환 시 이 페이지 전수가 바뀐다 — 227 G5 가 여기서 측정된다.
- **G3**: live — Components 페이지에 origin 58 표시 · origin 의 variant 를 바꾸면 그 컴포넌트의 instance 전부 반영 · Undo · plain 노드는 안 따라옴 (공존 계약 실증).

### Phase 4 — AI · 초기 문서 · 성능 확정

- `compositeCreation` · `builderHost` · `createInitialProjectDocument` 가 `ensureCatalogOrigins` 를 쓰도록 (F5 5곳).
- **G4**: 600 요소 ref 100% 문서 — scene build · 선택 · 편집 p95 가 Phase 0 baseline (ref 0%) 대비 +1 ms 이내 · 문서 크기 증가 = origin 58 노드뿐.

## 5. 파일 경계 (추정 — Phase 0 에서 확정)

| 영역        | 파일                                                                                                                             |     수 |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------- | -----: |
| catalog     | `componentCatalog.ts` (entry 58 + placeable) · `types.ts` (children seed 훅 필드)                                                |      2 |
| origin seed | `catalogOrigins.ts` (신규) · `reusableCompositeOrigins.ts` · `ensureTemplateOrigins.ts` · 자식 구조형 seed 이동 (factory 재사용) |      4 |
| 편집        | `resolveEditContract.ts` · `canonicalRefResolution.ts`                                                                           |      2 |
| 호출처      | F5 5곳                                                                                                                           |      5 |
| 페이지      | `systemComponentsPage.ts` (origin grid 배치)                                                                                     |      1 |
| 테스트      | 등록 불변식 · origin 파생 · 편집 계약 · cross-check instance arm                                                                 |      4 |
| 하니스      | `adr228-origins-live.mjs` · perf arm                                                                                             |      2 |
| **합계**    |                                                                                                                                  | **20** |

## 6. 유보 항목 (재개 조건)

- **기존 plain 노드의 instance 전환**: 사용자 결정 ③ 공존. 재개 = 사용자가 "선택 노드를 instance 로" 액션을 요구할 때 (역변환 규칙 필요 — 자식 있는 노드).
- **내용 primitive 8 의 origin 화**: 사용자 결정 ②. 재개 = Text 스타일 세트 (Framer text styles) 요구 시 — 그건 227 typography 토큰이 먼저 답한다.
- **Toast · IllustratedMessage**: 148 판정 승계. 재개 = Toast 팔레트 노출 제품 결정.
