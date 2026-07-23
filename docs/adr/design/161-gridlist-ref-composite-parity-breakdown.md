# ADR-161 구현 상세 — GridList ref 기반 재사용 composite 전환

> 본 문서는 [ADR-161](../161-gridlist-ref-composite-parity.md) 의 구현 상세(Phase 분해 / 파일 변경 / 체크리스트) 전용. 결정·위험·Gate 는 ADR 본문 참조.

## §0 참조 baseline — ListBox 완성 경로 (복제 대상)

GridList 를 ListBox 와 동형 ref-composite 로 만들기 위한 참조 구현 (전부 기존 코드, 인용):

| 축                 | ListBox (완성)                                                                                                                        | GridList (현재)                                           |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| 컨테이너 origin    | `createListBoxOrigin` (`listBoxTemplateOrigins.ts:179`), `LISTBOX_ORIGIN_ID="component-listbox"`, `slot:[item-default,item-selected]` | **없음**                                                  |
| 등록 Set           | `LISTBOX_SYSTEM_ORIGIN_IDS` 3개 (`:67-70`)                                                                                            | `GRIDLIST_SYSTEM_ORIGIN_IDS` 1개 (item-default 만, `:51`) |
| factory 인스턴스   | `type:"ref", ref:LISTBOX_ORIGIN_ID` (`SelectionComponents.ts:249-250`)                                                                | `type:"GridList"` 직접 props (`:327-338`) standalone      |
| preview projection | `byId.get("component-listbox")?.slot` master 해석 (`preview/App.tsx:263`)                                                             | 없음 (standalone 직접 렌더)                               |
| Skia scene         | `refNode.ref===LISTBOX_ORIGIN_ID` anchor-less master 해석 (`canvasSceneNode.ts:751-752`)                                              | 없음                                                      |
| migration          | `legacyListBoxTemplateMigration.ts` (legacy template → ref)                                                                           | 없음                                                      |

## §1 전제 lock-in (ADR 본문 §Context 대응)

- GridList Skia projection 은 **이미 data-direct 로 작동** (ADR-912 C1, 2026-06-03, 커밋 `2818c6bf0`). row projection 이 `rowProps.children=row.label` 로 데이터 직접 소비 — origin 비의존. 본 전환은 **projection 을 깨지 않고** ref-composite 층을 위에 얹는다.
- item origin(`component-gridlist-item-default`)은 ADR-148 Phase 4 에서 추가됨 — slot 구성/스타일 상속용 optional enhancement.
- **핵심 불변식**: 전환 후에도 GridList 카드 렌더 결과(bg+border+label+description, Skia 카드 76 / DOM 76)는 무변경. ref-composite 는 authoring/reuse 층 추가일 뿐 시각 결과 불변.

## §2 Phase 분해

### Phase 1 — 컨테이너 origin 생성 + 등록 (LOW)

- `gridListTemplateOrigins.ts`: `GRIDLIST_ORIGIN_ID="component-gridlist"` export + `createGridListOrigin()` (ListBox `createListBoxOrigin` 동형):
  ```ts
  { id: GRIDLIST_ORIGIN_ID, type: "GridList", name: "GridList", reusable: true,
    props: { layout: "stack", selectionMode: "single", items: [] },
    slot: [GRIDLIST_ITEM_DEFAULT_ORIGIN_ID],
    metadata: { type: "gridlist-origin", systemOwned: true, componentFamily: "GridList" } }
  ```
- `GRIDLIST_SYSTEM_ORIGIN_IDS` 에 `GRIDLIST_ORIGIN_ID` 추가.
- `ensureGridListTemplateOrigins` 에 컨테이너 origin repair/ensure 라인 추가 (item origin 과 동일 `repairOrigin` 경유).
- Gate: `createInitialProjectDocument.test.ts` 에 `component-gridlist` (slot:[item-default]) 존재 assertion 추가.

### Phase 2 — factory ref 전환 (MED)

- `SelectionComponents.ts` `createGridListDefinition`: `parent.type:"GridList"` → `parent.type:"ref", ref: GRIDLIST_ORIGIN_ID` (ListBox `:249-250` 동형). 기존 inline props(layout/columns/selectionMode/items/style)는 ref override props 로 이전 (instance override 채널).
- **BC 위험**: 기존 프로젝트의 standalone GridList 는 Phase 5 migration 이 담당. 신규 add 는 ref.
- Gate: 팔레트 GridList 추가 → 인스턴스 `type:"ref", ref:"component-gridlist"` 확인 (Chrome MCP store probe).

### Phase 3 — preview projection 배선 (MED) — Implemented 2026-07-23

**채택 방식 — preview + Skia 대칭 배선 (컨테이너 origin slot 소비, canvas-rendering.md symmetric consumer 규칙)**:

- 원안은 preview 단독 배선이었으나, 리터럴 하드코딩은 preview(`App.tsx:321`)와 Skia(`canvasSceneNode.ts:1333`) **양쪽**에 존재했다. 한쪽만 master 해석으로 전환하면 코드 비대칭(값은 동일하나 SSOT 읽는 방식 상이) — canvas-rendering.md D3 symmetric consumer 위반. 두 소비자를 **동일 SSOT(`component-gridlist`.slot[0])를 동일 방식**으로 읽도록 전환.
- **Skia**: `resolveGridListTemplateOriginId(sourceNode, getDocNodes)` 신규 export (`resolveListBoxTemplateOriginId` 대칭, anchor-less). ref → master.slot[0] / origin 자신 → 자신.slot[0] / 안전망 → `component-gridlist-item-default` 상수. `appendGridListRowProjection` 이 리터럴 대신 이 helper 경유.
- **Preview**: `App.tsx` `byId.get("component-gridlist")?.slot[0]` inline 해석(`component-listbox` `:263` 동형) → `compositionOf(gridListOriginId)`.
- 현행 slot[0] == 리터럴이라 **시각 결과 불변**(BC), 컨테이너 origin 이 authoritative 가 되어 향후 variant 확장 대비 + ListBox 대칭 완성.
- **live 검증(2026-07-23)**: ref GridList(`4ecd3ae0`, ref→component-gridlist, grid 3-item) — Skia canvas 카드 렌더(Desert Sunset/Hiking Trail/Mountain Sunrise, bg+border+label+description) ≡ CSS preview 동일 카드. Component 패널 Role=Instance. 콘솔 에러 0. type-check(baseline 61) + canvasSceneNode.test 40건(resolveGridListTemplateOriginId 4 신규) PASS.
- Gate: preview + Skia 에서 ref GridList 카드 렌더 + 크래시 0 (item origin slot 소비). ✅

### Phase 4 — Skia scene projection 배선 (HIGH)

**채택 방식 — 근본 수정(scene type ref→master 해석), per-gate patch 아님 (2026-07-23 사용자 지시)**:

- 원 설계는 `isGridListSceneSource` 에 `refNode.ref===GRIDLIST_ORIGIN_ID` 개별 분기를 ListBox(`:751-752`) 동형으로 복제하는 것이었으나, 근본 원인은 **scene node 생성 시 ref 의 type 이 master 로 해석되지 않는 것**(`toCanvasSceneNode` `type: node.type` → `"ref"` 유지)이다. `isGridListSceneSource` 는 `sourceNode.type==="ref" → false` 로 오히려 ref 를 차단했다.
- **정본 수정**: `visit`(scene node 생성 직후, 단일 지점)에서 `node.type==="ref" && !isPagePlaceholderNode(node)` 이면 `getDocumentNodesById().get(node.ref)?.type` 로 master type 을 해석해 `sceneNode.type` 에 반영. `.ref` 는 identity 로 보존. 이로써 `isGridListSceneSource` line 1(`type==="GridList"`)이 자동 통과 → **모든 collection gate 가 type 으로 일관 통과**(per-gate 중복 불요, ListBox ref 분기는 redundant·무해).
- blast radius 실측: `CanvasSceneNode.type==="ref"` 프로덕션 소비자 0 (외부는 전부 canonical `node.type` 소비). 렌더 경로는 componentName/catalog/projection 기반(ListBox ref 가 `type:"ref"` 로도 정상 렌더된 사실이 방증).
- Gate: `/cross-check` — ref GridList Skia 카드 ≡ DOM 카드 (76 parity), 데이터 소실 0. **live 검증(2026-07-23)**: grid GridList Skia 카드 라벨 정상 렌더 확인. scene 92 + skia 69 + type-check(baseline 61) 무회귀.

### Phase 7 — 프로퍼티 패널 slot authoring parity (MED, 2026-07-23 scope 추가)

> **scope 추가 근거**: 사용자가 GridList 인스턴스 프로퍼티 패널에 slot 표시가 없음을 발견(2026-07-23). 렌더 측(Phase 1/2/4)과 별개인 **authoring 표면** parity gap — slot 편집 UI 가 ListBox 전용으로 구현돼 GridList 로 미이식. breakdown 원안 미포함, 사용자 승인 하 추가.

- **원인**: (a) `slotHostPolicy.ts` 의 `isSlotHostElement`(`:72-78`)가 ListBox host(`type==="listbox"` + reusable/systemOwned)·Frame 타입만 인정 — `isGridListHost` 부재. (b) `GridListItemEditor`(`:36-86`)가 flat-props 편집기(label/value/description/textValue/isDisabled 직접 prop) — ListBox `ListBoxItemEditor` 의 slot 구성 모델(`listBoxItemSlotChildActions`, ADR-147/148) 미적용.
- **작업 (실측 반영)**:
  1. **`slotHostPolicy.ts` 일반화 (실 수정)** — `isGridListHost` + `isGridListPolicyActive` + `isGridListItemTemplateVariant`(`GRIDLIST_ITEM_DEFAULT_ORIGIN_ID` 기반) 추가(ListBox 대칭). `isSlotHostElement`/`isSlotCandidateAllowed` 에 GridList 분기 추가. **이것이 "Slot" 섹션(`FrameSlotSection`, `isSlotHostElement` 게이트) 미표시의 유일 원인**이었다.
  2. ~~`GridListItemEditor` slot-구성 전환~~ **moot(구현 불요)** — per-type 편집기(`ListBoxItemEditor`/`GridListItemEditor`)는 `useEditContract`(ADR-912 단계2, catalog 기반 단일 진입점)로 대체돼 **barrel 외 렌더 참조 0 = dead**. live 실측: ListBoxItem/Default·GridListItem/Default origin 선택 시 **동일 catalog 편집기**(Content: Label + Appearance: Size)를 표시 — item 레벨은 이미 대칭. 편집기 전환 필요 없음.
- **live 검증(2026-07-23)**: slotHostPolicy 수정 후 `component-gridlist`(Origin) 프로퍼티에 **Slot 섹션 표시**(`GridListItem/Default`, 1 recommendation, Disable slot) — ListBox(2 recommendation) 대칭. slotHostPolicy.test 4건(GridList 2 신규) + type-check(baseline) PASS.
- Gate: GridList 인스턴스/origin 선택 → 프로퍼티 패널에 Slot 섹션 표시 (live). ✅

### Phase 5 — 기존 인스턴스 처리 (LOW — 타입 미변환 ListBox-parity) — Implemented 2026-07-23

**채택 방식 — 타입 미변환 origin bootstrap (사용자 결정 2026-07-23, ListBox 선례 동형)**:

- 원안은 standalone `type:"GridList"` → `type:"ref"` **타입 변환** migration(`legacyGridListTemplateMigration.ts` 신규)이었으나, 실행 단계에서 ListBox 선례(`legacyListBoxTemplateMigration.ts`)를 확인한 결과 — **ListBox 는 타입을 변환하지 않는다**. `migrateLegacyListBoxTemplatesToOrigins` 는 in-instance template anchor strip + scroll-style 보강만 하고 `type:"ListBox"` 를 유지하며, standalone 은 `isListBoxSceneSource` line 1(`type==="ListBox"`) type gate 로 렌더한다. 신규 인스턴스만 ref(factory).
- 사용자 결정(AskUserQuestion) — GridList 도 **타입 미변환** ListBox-parity 채택. 타입 변환이 R2(데이터 손실)의 실체였으므로, 미변환으로 R2 HIGH→LOW.
- **GridList 는 anchor-less** (factory children:[]) — strip 대상 anchor 자체가 없다. **scroll-style 보강 미채택** — ListBox `ensureListBoxScrollStyle`(maxHeight:300px/overflow) 는 2026-07-22 ListBox 특정 overflow 버그 수정이지 ref-composite 모델 일부가 아니다. GridList overflow 는 별도 관심사(ADR-161 scope 밖).
- **신규 production 코드 0**: 컨테이너 origin bootstrap 은 `ensureGridListTemplateOrigins`(hydration 3곳 — `createInitialProjectDocument`/`adapters/canonical/index.ts:342`/`usePageManager.ts:394` — Phase 1 에서 `repairOrigin(GRIDLIST_ORIGIN_ID)` 추가) 가 이미 담당. 기존 프로젝트는 hydrate 시 `component-gridlist` origin 을 자동 획득(멱등). standalone 은 `isGridListSceneSource` line 1 type gate 로 렌더(Phase 4 root fix 로 ref 도 동일 gate 통과 — 단일 gate 일관).
- **검증(2026-07-23)**: `gridListTemplateOrigins.test.ts` 컨테이너 origin bootstrap 2건 신규(legacy 문서 → `component-gridlist`(slot→item origin) 추가 + 멱등/사용자편집 보존, 4건 PASS). live — 현 프로젝트 `component-gridlist` origin 존재 probe + ref GridList 카드 렌더(= type gate 통과, skia registry 58 노드). type-check(baseline 61) PASS.
- Gate G2: `ensureGridListTemplateOrigins` legacy 문서 bootstrap(unit) + standalone type gate 렌더(live). ✅

### Phase 6 — 종결 검증 (parity sweep)

- live builder: 신규 add + 기존 migration 양쪽 GridList 카드 렌더 / stack↔grid / selection / 크래시 0.
- `/cross-check` Skia↔DOM 5-레이어.
- README/CHANGELOG/Status 승격.

## §3 파일 변경 요약

| 파일                                             | Phase | 변경                                                                                  |
| ------------------------------------------------ | ----- | ------------------------------------------------------------------------------------- |
| `gridListTemplateOrigins.ts`                     | 1     | 컨테이너 origin + 등록                                                                |
| `dashboard/createInitialProjectDocument.test.ts` | 1     | container origin assertion                                                            |
| `factories/definitions/SelectionComponents.ts`   | 2     | GridList factory ref 전환                                                             |
| `preview/App.tsx`                                | 3     | `component-gridlist`.slot[0] master 해석                                              |
| `canvas/scene/canvasSceneNode.ts`                | 3/4   | `resolveGridListTemplateOriginId`(P3) + ref→master **scene type 근본 해석**(P4 visit) |
| `canvas/scene/canvasSceneNode.test.ts`           | 3     | resolveGridListTemplateOriginId 4 테스트                                              |
| `gridListTemplateOrigins.test.ts`                | 5     | 컨테이너 origin bootstrap 2 테스트 (타입 미변환 — 신규 migration 파일 없음)           |
| `components/slotHostPolicy.ts`                   | 7     | `isGridListHost` + item variant 판정 추가                                             |
| `components/__tests__/slotHostPolicy.test.ts`    | 7     | GridList host/candidate 테스트 2건                                                    |
| `docs/CHANGELOG.md` / `docs/adr/README.md`       | 6     | closure                                                                               |

## §4 검증 게이트 매핑 (ADR Gates 대응)

| Phase | Gate                                                                   | 실패 시                                           |
| ----- | ---------------------------------------------------------------------- | ------------------------------------------------- |
| 1     | container origin 존재 + slot 참조                                      | rollback (item-only 복귀)                         |
| 2     | 신규 add = ref                                                         | standalone 유지 재검토                            |
| 4     | Skia↔DOM parity (cross-check)                                          | Phase 4 debugger 위임, non-isomorphic 충돌 재설계 |
| 3     | preview+Skia 컨테이너 origin slot 소비                                 | 리터럴 fallback 복원                              |
| 5     | origin bootstrap(unit) + standalone type gate 렌더(live) — 타입 미변환 | bootstrap-only 복귀                               |
| 7     | 프로퍼티 패널 slot 섹션 표시 + 편집 반영                               | slotHostPolicy/editor 재검토                      |
