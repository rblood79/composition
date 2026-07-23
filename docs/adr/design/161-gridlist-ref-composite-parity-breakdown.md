# ADR-161 구현 상세 — GridList ref 기반 재사용 composite 전환

> 본 문서는 [ADR-161](../161-gridlist-ref-composite-parity.md) 의 구현 상세(Phase 분해 / 파일 변경 / 체크리스트) 전용. 결정·위험·Gate 는 ADR 본문 참조.

## §0 참조 baseline — ListBox 완성 경로 (복제 대상)

GridList 를 ListBox 와 동형 ref-composite 로 만들기 위한 참조 구현 (전부 기존 코드, 인용):

| 축                 | ListBox (완성)                                                                                                                        | GridList (현재)                                           |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| 컨테이너 origin    | `createListBoxOrigin` (`listBoxTemplateOrigins.ts:178`), `LISTBOX_ORIGIN_ID="component-listbox"`, `slot:[item-default,item-selected]` | **없음**                                                  |
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

### Phase 3 — preview projection 배선 (MED)

- `preview/App.tsx`: `component-gridlist` master slot 해석 추가 (`component-listbox` `:263` 동형). ref 인스턴스 → master → slot[0](item origin) → 카드 템플릿.
- resolve 헬퍼 재사용/일반화 검토 (`resolveListBoxTemplateOriginId` 류 → collection 공통).
- Gate: preview 에서 ref GridList 가 카드 렌더 + 크래시 0 (item origin slot 소비).

### Phase 4 — Skia scene projection 배선 (HIGH)

- `canvasSceneNode.ts`: `refNode.ref===GRIDLIST_ORIGIN_ID` anchor-less master 해석 추가 (`LISTBOX_ORIGIN_ID` `:751-752` 동형). **단 GridList 는 ListBox 와 non-isomorphic** (`project-collection-skia-flip-not-listbox-isomorphic`) — `appendGridListRowProjection` 경로가 ListBox 와 다르므로 ref→master 해석이 기존 projection 과 충돌 없는지 정밀 검증.
- `sceneVersion` signature 에 GridList ref/projection 필드 반영 확인 (ADR-136 projection signature).
- Gate: `/cross-check` — ref GridList Skia 카드 ≡ DOM 카드 (76 parity), 데이터 소실 0.

### Phase 5 — 기존 인스턴스 migration (HIGH)

- `legacyGridListTemplateMigration.ts` 신규 (`legacyListBoxTemplateMigration.ts` 동형): 기존 standalone `type:"GridList"` 인스턴스 → `type:"ref", ref:GRIDLIST_ORIGIN_ID` + props 이전. hydration 1회.
- **되돌리기 위험**: migration 오류 시 기존 프로젝트 GridList 데이터 손상. Phase 5 는 idempotent + 원본 props 보존 필수.
- Gate: 기존 프로젝트(standalone GridList 보유) hydrate → ref 전환 + 카드 무손실 + 새로고침 정합.

### Phase 6 — 종결 검증 (parity sweep)

- live builder: 신규 add + 기존 migration 양쪽 GridList 카드 렌더 / stack↔grid / selection / 크래시 0.
- `/cross-check` Skia↔DOM 5-레이어.
- README/CHANGELOG/Status 승격.

## §3 파일 변경 요약

| 파일                                                    | Phase | 변경                       |
| ------------------------------------------------------- | ----- | -------------------------- |
| `gridListTemplateOrigins.ts`                            | 1     | 컨테이너 origin + 등록     |
| `dashboard/createInitialProjectDocument.test.ts`        | 1     | container origin assertion |
| `factories/definitions/SelectionComponents.ts`          | 2     | GridList factory ref 전환  |
| `preview/App.tsx`                                       | 3     | master slot 해석           |
| `canvas/scene/canvasSceneNode.ts`                       | 4     | ref→master anchor-less     |
| `adapters/canonical/legacyGridListTemplateMigration.ts` | 5     | 신규 migration             |
| `docs/CHANGELOG.md` / `docs/adr/README.md`              | 6     | closure                    |

## §4 검증 게이트 매핑 (ADR Gates 대응)

| Phase | Gate                              | 실패 시                                           |
| ----- | --------------------------------- | ------------------------------------------------- |
| 1     | container origin 존재 + slot 참조 | rollback (item-only 복귀)                         |
| 2     | 신규 add = ref                    | standalone 유지 재검토                            |
| 4     | Skia↔DOM parity (cross-check)     | Phase 4 debugger 위임, non-isomorphic 충돌 재설계 |
| 5     | 기존 인스턴스 무손실 migration    | migration 보류, 신규만 ref (양립 기간)            |
