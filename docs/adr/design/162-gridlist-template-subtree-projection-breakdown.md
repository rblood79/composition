# ADR-162 구현 상세: 데이터 바인딩 GridList 카드 = 항목 origin instance

> 본문: [162-gridlist-template-subtree-projection.md](../162-gridlist-template-subtree-projection.md) · 2026-09-26 재작성 (07-24 판의 composed 모드 설계는 git 이력 `docs/adr/design/162-*` 로 본다)

## 1. 전제 확정 기록 (fork checkpoint 4 질문)

1. **base / 응용**: 본 ADR 은 응용. base = [ADR-234](../completed/234-variant-instances-and-slot-filled-collections.md) (목록 = 항목 origin instance, 데이터 목록은 `items` + 항목 origin 템플릿) · [ADR-159](../completed/159-collection-field-template-binding.md) (`{field}` 보간 · 컬럼 피커) · ADR-239/241 (instance 해석기의 origin 펼침). 07-24 판의 base ADR-148 ("slot = 템플릿 역할 표") 은 ADR-234 가 정적 목록에서 대체했다.
2. **schema 직교성**: 신규 canonical 필드 0. 바인딩 표현은 origin 자식 prop 안의 159 `{field}` 문자열 그대로.
3. **선행 ADR 전제 reverse 검증**: 234 의 경계 (데이터 목록은 `items`) 를 뒤집지 않는다 — 행을 문서에 쓰지 않고 render-space 에서만 펼친다. 159 의 consumer 분리 (Skia = 샘플/데이터 정적 배치, DOM = 실데이터 + RAC 동작) 승계.
4. **사용자 confirm**: (round 2 codex 리뷰 h1 · h2 · m1 반영 2026-09-26 — 균일 stride → 시각 행별 높이, 소유자별 origin 해석 한 곳, Field legacy 고정) 2026-09-26 AskUserQuestion "ADR-162 를 어떻게 처리할까요?" → "본문 재작성 (권장)" — 범위 = 데이터 바인딩 목록의 행 = 항목 origin 가상 instance + `{field}`, 판정 심볼 · 별도 투영 제거, 정적 카드 Canvas live 를 Phase 0 에, 150 A2 의존 유지.

**진입 조건**: ADR-159 P1 · P4 Implemented (해소). Phase 4 (시각 행별 높이) 는 ADR-150 Phase 1 (행 offset 함수 계약 · G1) 뒤 — 2026-09-26 150 본문 재작성으로 "150 A2 시각 확인" 에서 바뀜 (README 실행 순서표 같음). 150 은 리뷰 round 3 → Phase 0 → Phase 1 순서. Phase 0 ~ 3 · 5 · 6 의 `/cross-check` 는 150 과 독립.

## 2. 현행 (2026-09-26 실측)

| 층            | 정적 카드 (ADR-234)                                                                                                                      | 데이터 행                                                                                                                                                                                                                                        |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Canvas scene  | 일반 visit — 비-reusable GridListItem 의 slot 자식은 접힘 (`canvasSceneNode.ts:3288-3301`), 비-slot 자식은 scene 노드                    | `appendGridListRowProjection` (`canvasSceneNode.ts:1532-1812`) — origin 은 `props.style` (`:1565`) 과 `resolveSlotComposition(children)` (`:1568`) 만 읽고 자식 없는 GridListItem 노드 (`:1754-1775`)                                            |
| Skia          | `gridlist_card` escape — `_hasChildren` 이면 shell 만 (`skiaPrimitives.ts:411-415`), 아니면 `_slots` 로 label · description (`:489-503`) | 같은 escape, 자식 없음 → 항상 flat                                                                                                                                                                                                               |
| 레이아웃      | §1.55b2 카드 metric 은 자식 있으면 skip (`utils.ts:2955-3030`) → 엔진이 자식으로 잰다                                                    | §1.55b2 공식 · §1.55c 컨테이너 (`utils.ts:3034` 이후)                                                                                                                                                                                            |
| 가상화        | —                                                                                                                                        | stride `resolveGridListRowStride` (`collectionVirtualization.ts:169-224`) — 공식, origin 은 상수 id (`:183`)                                                                                                                                     |
| DOM           | `renderGridListItem` → 자식 전부 `context.renderElement` (`SelectionRenderers.tsx:1172`)                                                 | Path 1 (`:947-1016`, Field 자식 · 그 외 slot 두 칸) · Path 2 (`:1017-1066`) · 내부 렌더 (`GridList.tsx:421-490`) — label · description 두 칸                                                                                                     |
| 템플릿 origin | —                                                                                                                                        | Canvas: 소유자 slot[0] / ref master slot[0] (`canvasSceneNode.ts:811-820`) · 가상화: 상수 id (`collectionVirtualization.ts:183`) · Preview: 전역 `component-gridlist` slot[0] 하나 (`preview/App.tsx:349-354`) — **세 곳이 다르다** (round 2 h2) |
| Preview 채널  | 해석기가 `master.children` 펼침 (`resolvers/canonical/index.ts:217`)                                                                     | `templateSlotCompositions.gridList` = slot 구성만 (`preview/App.tsx:358-361, 427, 871`)                                                                                                                                                          |
| `{field}`     | —                                                                                                                                        | label · description 만 (Canvas `canvasSceneNode.ts:1580-1594, 1720-1727` · DOM `SelectionRenderers.tsx:79, 933-944`)                                                                                                                             |
| interaction   | 문서 노드                                                                                                                                | `gridlist-row(s)` owner redirect (`resolveCanvasInteractionTarget.ts:131-158`)                                                                                                                                                                   |

**정적 카드 가설 — G0 로 기각 (2026-09-26, [evidence](../evidence/162-phase0-inventory-g0-live.md))**: 정적 카드는 canonical `type: "ref"` 라 접기 조건 (canonical `node.type === "GridListItem"`) 에 걸리지 않고 해석기가 origin scene 자식을 복제한다 — slot-only 카드도 **항상 펼침** (escape = shell). live 에서 Image 추가 뒤 label · description · Image 모두 그려진다. 가설은 ref 가 아닌 · reusable 이 아닌 카드 (detach · legacy) 에서만 성립 (Image 만 scene 노드, slot 자식 접힘 → label 소실) — Phase 1 수리 대상.

## 3. 접기 규칙

정적 ref 카드 (ADR-234 항목 instance) 는 해석기가 자식을 복제해 **항상 펼침** — 이 규칙 밖이다 (G0). 아래 조건은 **ref 가 아닌 카드 (detach · legacy GridListItem) 와 데이터 행** 이 공유한다.

```
카드 자식이 전부 slot 역할 (getSlotRole(child) != null)
  → 접기: slot 자식은 `_slots` 로, scene 자식 0, escape 가 카드 전체 (현행 — BC)
비-slot 자식이 하나라도 있음 또는 reusable origin
  → 펼침: 자식 전부 scene 노드 (label 은 injectCollectionLabelWeight), escape = shell (현행 origin 경로)
```

- 규칙 위치는 `canvasSceneNode.ts:3292-3301` 의 접기 조건 하나 — 지금은 "slot 자식이면 접는다" 를 자식마다 판단해서, 비-slot 자식이 섞인 detach 카드는 slot 자식만 접히고 escape 는 shell 이라 label 이 사라진다. 카드 단위 판단 (전부 slot 이어야 접기) 으로 바꾼다. 데이터 행 투영도 이 조건을 호출한다 (복사 금지).
- slot-only 에서 정적 ref 카드 (펼침) 와 데이터 행 (escape) 은 경로가 달라도 시각이 같다 — ADR-234 G5 (items → 자식 이관 픽셀 Δ0) 가 선례. G1 이 다시 잰다.
- DOM 도 같은 조건: 접기 = `renderGridListItemSlotContent`, 펼침 = `renderGridListItem` 자식 렌더. 조건 함수는 shared 에 두고 두 leg 가 import.
- **Field 우선 (round 2 m1)**: 템플릿 자식에 `type: "Field"` 가 하나라도 있으면 위 규칙보다 먼저 legacy — DOM Path 1 Field 분기 (`SelectionRenderers.tsx:953-994`) · Canvas 현행 투영 그대로, 펼침 없음. Field 와 비-slot 자식의 병합 규칙은 만들지 않는다 (ADR-147/148 폐기 모델). Field 템플릿 문서가 있으면 Field → Text `{key}` 이관은 별도 결정.

## 4. 보간 적용 계약

- 순서: ① instance `descendants` 적용 (해석기) → ② 행별 159 보간 (`compileFieldTemplate` 행 루프 밖 1 회 · `interpolateFieldTemplate(compiled, row.item)` 행마다). 토큰 없는 prop 은 compile null → skip.
- 대상 prop = 허용표 하나 (shared 상수 — Canvas 투영 · DOM 렌더 · 패널 공유): Text `children` · Image `src`/`alt` · Button · Badge · Link `children` · Link `href` … (Phase 0 에서 origin 에 둘 수 있는 leaf 전수로 확정).
- label · description 은 기존 경로 (`resolveRowTemplateSource` 우선순위) 를 그대로 쓴다 — 허용표가 이를 포함해도 경로는 하나.

## 5. Phase

### Phase 0 — inventory · G0 (LOW)

- ✅ 2026-09-26 — G0 PASS (가설 기각) · inventory 고정 · Field 쓰기 경로 = AI `create_element` 잠재 1 · 소유자별 origin 저작 경로 있음 (Slot 절). [evidence](../evidence/162-phase0-inventory-g0-live.md)
- G0 live: 정적 GridList 카드 origin 에 Image 추가 → Canvas 카드 확인 (실제 builder, 팔레트 경로, breakpoint 는 헤더 토글).
- 데이터 행 소비처 전수 grep 고정 (투영 · escape · §1.55b2/c · stride · DOM Path 1/2 · `GridList.tsx` 내부 렌더 · Preview 채널 · interaction).
- 허용표 후보: origin 에 들어갈 수 있는 leaf 타입 × string prop 전수.
- 소유자별 origin 이 갈리는 production 경로 확인: GridList slot 에 custom 항목 origin 을 두는 저작 경로 (Slot 절 · 붙여넣기 · import) 가 있는지. 없어도 Phase 1 에서 한 곳으로 모은다 (Canvas 는 이미 소유자별).
- Field 템플릿 문서 수 (seed + 사람이 만든 문서, Field 쓰기 경로 `packages/shared/src/components/metadata.ts:1034` · factories) 집계.

### Phase 1 — 접기 규칙 공용화 (MED)

- ✅ 2026-09-26 — `shouldFoldSlotChildren` (shared, 카드 단위) 를 scene 접기가 호출 · `resolveGridListTemplateOriginId` 를 가상화 stride 가 호출 (상수 제거) · Preview `createGridListTemplateResolver.forOwner` → `renderContext.resolveGridListTemplate` → `CanonicalNodeRenderer` 가 GridList 마다 구성을 바꿔 넘김 (Tabs 형태). 원복 RED 3 (scene 접기 · DOM 소유자 origin · stride 86→60) · canvas unit 245 · shared 146 · parity 78 · live (detach 카드 + 설명 + Image, 하니스 `adr162-p1-detach-card-live.mjs`). 곁가지 발견: detach 뒤 카드 label 이 `{label}` 원문 (범위 밖 — 따로 기록).

- §3 조건을 shared 함수로. 정적 카드 경로가 호출. G0 가 가설을 확인했으면 여기서 수리 (펼침 시 slot 자식도 scene 노드).
- unit: slot-only / 혼합 / origin / 자식 0 / Field 포함. G1 (정적 카드 부분).
- **소유자별 origin 해석 한 곳 (round 2 h2)**: `resolveGridListTemplateOriginId` (`canvasSceneNode.ts:811`) 를 shared 로 옮겨 Canvas scene · 가상화 (`collectionVirtualization.ts:183` 상수 제거) · Preview (`App.tsx:349` 전역 해석 제거) 가 호출. Preview 채널은 소유자 id → {slot 구성, 해석된 origin 자식} 맵으로 바꾸고 renderer 는 자기 element id 로 찾는다. G2 (a) — 기본 origin · custom origin 두 소유자 반례, 원복 RED. 지금의 slot 구성 비대칭도 여기서 같이 닫힌다.

### Phase 2 — Canvas 데이터 행 펼침 (HIGH)

- ✅ 2026-09-26 — 펼침 판정 shared `shouldExpandRowTemplate` (Canvas · Preview 공용). 행 노드에 `ref: <항목 origin>` + 행별 `descendants` (허용표 `ROW_TEMPLATE_BINDABLE_PROP_KEYS` prop 의 `{field}` 를 159 compile · 행 item 으로 보간) → 해석기가 정적 카드처럼 origin 자식을 펼친다 (새 해석 코드 없음). 펼친 자식은 `inheritCollectionRowProjectionToSyntheticChildren` 이 행 projection 을 물려준다. 컨테이너 높이: scene 이 owner 에 `_expandedTemplateRows` → §1.55c 공식 · sample 주입을 끄고 `engineOwnsContainerHeight` 로 엔진이 행 묶음을 잰다 (live 에서 공식 164 vs 행 264 넘침 확인 후 수리). 가상화 행 간격은 여전히 공식 (Phase 4).

- `appendGridListRowProjection`: 행 노드를 §3 조건으로 분기. 펼침이면 origin 해석 자식을 행마다 복제 (id `${rowId}::${childId}`), §4 보간. 해석은 기존 해석기 호출 — 새 해석 코드 금지.
- 펼친 자식에 행 projection (`gridlist-row` + rowIndex) 을 물려 owner redirect. 투영 id 문서 유입 negative test.

### Phase 3 — DOM 데이터 행 (HIGH)

- ✅ 2026-09-26 — Preview 해석기 `rowTemplateChildrenForOwner` → `renderContext.resolveGridListRowTemplateChildren` → `CanonicalNodeRenderer` 가 GridList 마다 `renderGridListRowTemplate` (shared `interpolateRowTemplateTree` 로 보간한 origin 자식을 CanonicalNodeRenderer 로) 을 넣고, Path 1 (Field 없음) · Path 2 · `GridList.tsx` 내부 렌더 (dataBinding) 가 두 칸 대신 쓴다. Field 템플릿은 Path 1 Field 분기가 먼저라 legacy 그대로. G2 (b) — `tests/parity/adr162DataRowCardDom.browser.test.ts` DOM oracle = 실제 builder Canvas (live `adr162-p2-data-rows-live.mjs`, static collection dataBinding) ±1: 컨테이너 400×264 · 카드 194×126 · label (17,13,160,24) · 설명 (17,39,160,24) · Image (17,65,48,48). 발견: 정적 `items` 는 ADR-234 이관으로 자식이 되므로 production 데이터 목록 = dataBinding (측정도 그 모양으로). 곁가지: src 없는 Image 는 Canvas 아이콘 / DOM alt 글자 (기존 차이, 범위 밖).

- Path 1/2 · `GridList.tsx` 내부 렌더: §3 조건이 펼침이면 행마다 origin 해석 자식을 `context.renderElement` (보간된 props). RAC `GridListItem` 의 `textValue` = 행 label 유지. 비-slot 자식에 slot 속성 금지 (ADR-238).
- Preview 채널: Phase 1 의 소유자별 맵에서 자기 origin 자식 (펼침일 때만) 을 읽는다 — 전역 단일 채널에 싣지 않는다.
- G2 parity test (`tests/parity/`, 실 브라우저 oracle). G1 (데이터 행 부분).

### Phase 4 — 시각 행별 높이 가상화 (HIGH, ADR-150 Phase 1 뒤)

- 접기: 현행 공식 · 균일 stride (BC).
- 펼침 (round 2 h1 — 균일 stride 폐기):
  - 시각 행 높이 = 그 시각 행 카드들의 최대 높이 (DOM grid `align-items: stretch` 와 같음). 카드 높이는 행 데이터 (`{title}` 길이) 에 따라 다르다.
  - 실체화된 행 (window 안) 은 엔진 실측을 캐시 — 키 = 소유자 id + origin 해석 revision + 열 수 · 카드 폭 + 행 key. 무효화는 기존 layout publish / projectionVersion 신호 (독립 캐시 금지 — ADR-150 R5). 열 수 · 폭이 바뀌면 (breakpoint) 캐시 전체 무효.
  - 아직 안 본 행 = 추정 (템플릿 공식 — 현행 stride 값).
  - offset · window index · spacer · maxScrollTop 은 **ADR-150 Phase 1 의 행 offset 함수** 가 시각 행 높이 목록으로 산출한다 (누적합 + 이분 탐색 — 150 이 계약 · unit 소유). 본 Phase 는 그 함수에 목록 (실측 · 추정) 을 공급하고, 실측 교체 시 목록을 갱신한다. 착수 때 150 반영 상태를 재실측 (150 R6).
  - scroll anchoring: 추정 → 실측 교체로 화면 위쪽 합이 바뀌면 scrollTop 을 그 차이만큼 보정해 화면 첫 행의 화면 y 를 고정.
  - 끝 고정 (round 3 h1): scrollTop 이 maxScrollTop 에 있으면 (thumb 을 끝으로 끈 경우 포함) 기준을 마지막 행으로 바꾼다 — 실측 교체 뒤 scrollTop = 새 총합 − viewport 로 다시 맞춰 마지막 시각 행이 아래 끝에 붙어 있게 한다. 중간 미방문 행은 추정으로 남아도 끝 도달은 보장된다.
  - 총 높이 정확도 계약: 모든 시각 행이 측정됐을 때만 총 높이 = DOM `scrollHeight`. 그 전에는 Σ실측 + Σ추정 (오차 = 미측정 행의 실제 − 추정 합) — 게이트가 아니라 기록 대상 (G3 b · c).
  - 진동 차단: 한 행은 캐시 키가 같으면 한 번만 잰다 — 같은 스크롤 위치의 연속 build 는 같은 window · offset.
  - §1.55c 컨테이너 높이 = 같은 누적합 (가상화 없는 크기면 전부 실측).
- G3 (반례 입력: 2 열 · 1 행 짧은 / 2 행 3 줄 `{title}` 교대 · 200 행).
- 실패 시 대안 (G3): 비-slot 템플릿 카드 높이 고정 (템플릿 높이 + 줄 수 제한 — Skia paragraph maxLines · CSS line-clamp 두 leg) 또는 가상화 끄기.

### Phase 5 — 패널 컬럼 연결 (MED)

- GridList (데이터 바인딩) Properties 에 "카드 필드" 절: origin 해석 자식 중 허용표 prop 을 나열하고 159 `PropertyFieldTemplateInput` (+ `useOwnerCollectionColumns` 의 소유자 = 선택된 GridList) 을 붙인다. 쓰기 위치 = origin 문서 (모든 instance 공유).
- 신규 입력 컴포넌트 금지 — 159 것을 재사용.
- ✅ 2026-09-26 — `GridListCardFieldsSection` (Properties, `ItemSlotRolesSection` 뒤): 선택이 데이터 GridList (dataBinding 보유 — ref 는 origin type) 일 때만 선다. 목록은 순수 판정 `readGridListCardFields` — origin 해석은 Canvas scene · 가상화와 같은 `resolveGridListTemplateOriginId` (scene 모듈을 패널에 싣지 않도록 의존 0 모듈 `components/gridlist/gridListTemplateOriginId.ts` 로 옮기고 scene 은 re-export), 키는 shared `rowTemplateBindableKeysFor` (허용표 안 타입별 키 — Image `src` 처럼 값이 아직 없는 prop 도 연결 대상, 표에 없는 타입은 이미 string 값인 허용표 키만). 컬럼 = `fieldsFromOwner(선택된 GridList)`, 입력 = 159 `PropertyFieldTemplateInput`, 쓰기 = `updateElementProps(origin 자손 id)` (origin 영향 확인은 기존 게이트). 원복 RED 2 (쓰기 대상을 owner 로 · origin 을 기본 상수로) · unit 1017 + shared 104 · live (`adr162-p5-card-fields-live.mjs` — 절에 Label · Description children · Image src · alt, 설명을 `{tag}` 로 바꾸자 Canvas 행이 TAG-1 · 2 · 3, page error 0).

### Phase 6 — cross-check · live · closure (MED)

- `/cross-check` gridlist (접기 · 펼침 각 1). live: 데이터 GridList + origin 에 Image (src `{image}`) · Button → 행별 값 확인 (Canvas). Preview 는 사용자 확인.
- G4 성능 A/B. CHANGELOG · README · ADR Live Exercise.
- ◐ 2026-09-26 — `/cross-check` 2 arm (Phase 4 와 독립인 부분 선행): 같은 데이터 GridList (static collection dataBinding 3 행 · 폭 400) 를 실제 builder 에서 origin 에 Image 넣기 전 (접기) · 뒤 (펼침) 로 잼 (`adr162-crosscheck-live.mjs`, page error 0) — 접기 컨테이너 400×164 · 카드 194×76 · 둘째 시각 행 y 88 / 펼침 400×264 · 194×126 · 138 · label (17,13) · 설명 (17,39) · Image (17,65,48,48) (P3 live 값과 같음). DOM oracle `tests/parity/adr162DataRowCardDom.browser.test.ts` 3 case 가 두 arm 모두 ±1 통과. 접은 카드 안 글자 위치는 escape 가 그려 layout map 에 없어 상자 · 글자 내용만 대조 (픽셀 위치 미측정). G4 · Live Exercise · closure 는 Phase 4 뒤.

## 6. 파일 (추정 — Phase 0 에서 고정)

| 영역                    | 파일                                                                                                                                  | Phase     |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| 접기 조건 · origin 해석 | `packages/shared/src/catalog/slotRoles.ts` 인접 (접기 조건) · shared 로 옮긴 `resolveGridListTemplateOriginId`                        | 1         |
| Canvas scene            | `apps/builder/src/builder/workspace/canvas/scene/canvasSceneNode.ts`                                                                  | 1 · 2     |
| interaction             | `apps/builder/src/builder/workspace/canvas/interaction/resolveCanvasInteractionTarget.ts` (필요 시)                                   | 2         |
| DOM                     | `packages/shared/src/renderers/SelectionRenderers.tsx` · `packages/shared/src/components/GridList.tsx`                                | 3         |
| Preview 채널            | `apps/builder/src/preview/App.tsx` (소유자별 맵)                                                                                      | 1 · 3     |
| 가상화 · 높이           | `apps/builder/src/builder/workspace/canvas/scene/collectionVirtualization.ts` (상수 origin 제거 · 누적합) · `layout/engines/utils.ts` | 1 · 4     |
| 패널                    | `apps/builder/src/builder/panels/properties/…` · `hooks/useOwnerCollectionColumns.ts`                                                 | 5         |
| 허용표                  | `packages/shared/src/collections/` 인접                                                                                               | 2 · 3 · 5 |

## 7. 범위 밖

- ListBox 데이터 경로 (같은 규칙 이식 — 후속).
- Menu 정적 경로의 비-slot 자식 제외 (`CollectionRenderers.tsx:1052-1130`) — 별도 판단.
- 행별 가변 높이 · instance 별 매핑 · 인터랙티브 자식의 행 이벤트 (ADR-149 Wave 2 backlog 교차).
- publish leg (README 결정 지점 (1) 그대로 — publish 방침 해제 시).
