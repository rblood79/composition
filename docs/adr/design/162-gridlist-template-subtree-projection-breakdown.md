# ADR-162 구현 상세: 데이터 바인딩 GridList 카드 = 항목 origin instance

> 본문: [162-gridlist-template-subtree-projection.md](../162-gridlist-template-subtree-projection.md) · 2026-09-26 재작성 (07-24 판의 composed 모드 설계는 git 이력 `docs/adr/design/162-*` 로 본다)

## 1. 전제 확정 기록 (fork checkpoint 4 질문)

1. **base / 응용**: 본 ADR 은 응용. base = [ADR-234](../completed/234-variant-instances-and-slot-filled-collections.md) (목록 = 항목 origin instance, 데이터 목록은 `items` + 항목 origin 템플릿) · [ADR-159](../completed/159-collection-field-template-binding.md) (`{field}` 보간 · 컬럼 피커) · ADR-239/241 (instance 해석기의 origin 펼침). 07-24 판의 base ADR-148 ("slot = 템플릿 역할 표") 은 ADR-234 가 정적 목록에서 대체했다.
2. **schema 직교성**: 신규 canonical 필드 0. 바인딩 표현은 origin 자식 prop 안의 159 `{field}` 문자열 그대로.
3. **선행 ADR 전제 reverse 검증**: 234 의 경계 (데이터 목록은 `items`) 를 뒤집지 않는다 — 행을 문서에 쓰지 않고 render-space 에서만 펼친다. 159 의 consumer 분리 (Skia = 샘플/데이터 정적 배치, DOM = 실데이터 + RAC 동작) 승계.
4. **사용자 confirm**: 2026-09-26 AskUserQuestion "ADR-162 를 어떻게 처리할까요?" → "본문 재작성 (권장)" — 범위 = 데이터 바인딩 목록의 행 = 항목 origin 가상 instance + `{field}`, 판정 심볼 · 별도 투영 제거, 정적 카드 Canvas live 를 Phase 0 에, 150 A2 의존 유지.

**진입 조건**: ADR-159 P1 · P4 Implemented (해소). Phase 4 (stride) 는 ADR-150 A2 시각 확인 뒤 — README 실행 순서표 "150 A2 확정 후" 유지. Phase 0 ~ 3 은 A2 와 독립.

## 2. 현행 (2026-09-26 실측)

| 층           | 정적 카드 (ADR-234)                                                                                                                      | 데이터 행                                                                                                                                                                                             |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Canvas scene | 일반 visit — 비-reusable GridListItem 의 slot 자식은 접힘 (`canvasSceneNode.ts:3288-3301`), 비-slot 자식은 scene 노드                    | `appendGridListRowProjection` (`canvasSceneNode.ts:1532-1812`) — origin 은 `props.style` (`:1565`) 과 `resolveSlotComposition(children)` (`:1568`) 만 읽고 자식 없는 GridListItem 노드 (`:1754-1775`) |
| Skia         | `gridlist_card` escape — `_hasChildren` 이면 shell 만 (`skiaPrimitives.ts:411-415`), 아니면 `_slots` 로 label · description (`:489-503`) | 같은 escape, 자식 없음 → 항상 flat                                                                                                                                                                    |
| 레이아웃     | §1.55b2 카드 metric 은 자식 있으면 skip (`utils.ts:2955-3030`) → 엔진이 자식으로 잰다                                                    | §1.55b2 공식 · §1.55c 컨테이너 (`utils.ts:3034` 이후)                                                                                                                                                 |
| 가상화       | —                                                                                                                                        | stride `resolveGridListRowStride` (`collectionVirtualization.ts:169-224`) — 공식, origin 은 상수 id (`:183`)                                                                                          |
| DOM          | `renderGridListItem` → 자식 전부 `context.renderElement` (`SelectionRenderers.tsx:1172`)                                                 | Path 1 (`:947-1016`, Field 자식 · 그 외 slot 두 칸) · Path 2 (`:1017-1066`) · 내부 렌더 (`GridList.tsx:421-490`) — label · description 두 칸                                                          |
| Preview 채널 | 해석기가 `master.children` 펼침 (`resolvers/canonical/index.ts:217`)                                                                     | `templateSlotCompositions.gridList` = slot 구성만 (`preview/App.tsx:358-361, 427, 871`)                                                                                                               |
| `{field}`    | —                                                                                                                                        | label · description 만 (Canvas `canvasSceneNode.ts:1580-1594, 1720-1727` · DOM `SelectionRenderers.tsx:79, 933-944`)                                                                                  |
| interaction  | 문서 노드                                                                                                                                | `gridlist-row(s)` owner redirect (`resolveCanvasInteractionTarget.ts:131-158`)                                                                                                                        |

**정적 카드 가설 (G0 로 확인)**: 비-slot 자식이 scene 자식이 되면 `_hasChildren` (`buildSpecNodeData.ts:1764-1772`) → escape shell, 그런데 slot 자식은 접혀 있어 label · description 이 아무도 안 그린다. 반증: 정적 카드 origin 에 Image 추가 → Canvas 에 label 이 보이면 가설 기각.

## 3. 접기 규칙 (정적 · 데이터 · origin 공용)

```
카드의 (해석된) 자식이 전부 slot 역할 (getSlotRole(child) != null)
  → 접기: slot 자식은 `_slots` 로, scene 자식 0, escape 가 카드 전체 (현행 — BC)
비-slot 자식이 하나라도 있음 또는 reusable origin
  → 펼침: 자식 전부 scene 노드 (label 은 injectCollectionLabelWeight), escape = shell (현행 origin 경로)
```

- 규칙 위치는 `canvasSceneNode.ts:3288-3301` 의 접기 조건 하나. 데이터 행 투영도 이 조건을 호출한다 (복사 금지).
- DOM 도 같은 조건: 접기 = `renderGridListItemSlotContent`, 펼침 = `renderGridListItem` 자식 렌더. 조건 함수는 shared 에 두고 두 leg 가 import.

## 4. 보간 적용 계약

- 순서: ① instance `descendants` 적용 (해석기) → ② 행별 159 보간 (`compileFieldTemplate` 행 루프 밖 1 회 · `interpolateFieldTemplate(compiled, row.item)` 행마다). 토큰 없는 prop 은 compile null → skip.
- 대상 prop = 허용표 하나 (shared 상수 — Canvas 투영 · DOM 렌더 · 패널 공유): Text `children` · Image `src`/`alt` · Button · Badge · Link `children` · Link `href` … (Phase 0 에서 origin 에 둘 수 있는 leaf 전수로 확정).
- label · description 은 기존 경로 (`resolveRowTemplateSource` 우선순위) 를 그대로 쓴다 — 허용표가 이를 포함해도 경로는 하나.

## 5. Phase

### Phase 0 — inventory · G0 (LOW)

- G0 live: 정적 GridList 카드 origin 에 Image 추가 → Canvas 카드 확인 (실제 builder, 팔레트 경로, breakpoint 는 헤더 토글).
- 데이터 행 소비처 전수 grep 고정 (투영 · escape · §1.55b2/c · stride · DOM Path 1/2 · `GridList.tsx` 내부 렌더 · Preview 채널 · interaction).
- 허용표 후보: origin 에 들어갈 수 있는 leaf 타입 × string prop 전수.
- stride 상수 id (`collectionVirtualization.ts:183`) vs slot[0] 해석 불일치가 production 에서 갈리는지 1 건 확인.

### Phase 1 — 접기 규칙 공용화 (MED)

- §3 조건을 shared 함수로. 정적 카드 경로가 호출. G0 가 가설을 확인했으면 여기서 수리 (펼침 시 slot 자식도 scene 노드).
- unit: slot-only / 혼합 / origin / 자식 0. G1 (정적 카드 부분).

### Phase 2 — Canvas 데이터 행 펼침 (HIGH)

- `appendGridListRowProjection`: 행 노드를 §3 조건으로 분기. 펼침이면 origin 해석 자식을 행마다 복제 (id `${rowId}::${childId}`), §4 보간. 해석은 기존 해석기 호출 — 새 해석 코드 금지.
- 펼친 자식에 행 projection (`gridlist-row` + rowIndex) 을 물려 owner redirect. 투영 id 문서 유입 negative test.

### Phase 3 — DOM 데이터 행 (HIGH)

- Path 1/2 · `GridList.tsx` 내부 렌더: §3 조건이 펼침이면 행마다 origin 해석 자식을 `context.renderElement` (보간된 props). RAC `GridListItem` 의 `textValue` = 행 label 유지. 비-slot 자식에 slot 속성 금지 (ADR-238).
- Preview 채널: `templateSlotCompositions.gridList` 옆에 해석된 origin 자식 (펼침일 때만) 을 싣는다.
- G2 parity test (`tests/parity/`, 실 브라우저 oracle). G1 (데이터 행 부분).

### Phase 4 — stride 실측 (HIGH, ADR-150 A2 뒤)

- 접기: 현행 공식 (BC).
- 펼침: stride = 직전 layout 의 window 첫 행 엔진 높이 + rowGap. 캐시 키 = GridList id + origin 해석 결과 revision, 무효화는 기존 layout publish / projectionVersion 신호 (독립 캐시 금지 — ADR-150 R5). 첫 프레임은 공식. §1.55c 컨테이너 높이도 같은 값.
- G3.

### Phase 5 — 패널 컬럼 연결 (MED)

- GridList (데이터 바인딩) Properties 에 "카드 필드" 절: origin 해석 자식 중 허용표 prop 을 나열하고 159 `PropertyFieldTemplateInput` (+ `useOwnerCollectionColumns` 의 소유자 = 선택된 GridList) 을 붙인다. 쓰기 위치 = origin 문서 (모든 instance 공유).
- 신규 입력 컴포넌트 금지 — 159 것을 재사용.

### Phase 6 — cross-check · live · closure (MED)

- `/cross-check` gridlist (접기 · 펼침 각 1). live: 데이터 GridList + origin 에 Image (src `{image}`) · Button → 행별 값 확인 (Canvas). Preview 는 사용자 확인.
- G4 성능 A/B. CHANGELOG · README · ADR Live Exercise.

## 6. 파일 (추정 — Phase 0 에서 고정)

| 영역          | 파일                                                                                                      | Phase     |
| ------------- | --------------------------------------------------------------------------------------------------------- | --------- |
| 접기 조건     | `packages/shared/src/catalog/slotRoles.ts` 인접                                                           | 1         |
| Canvas scene  | `apps/builder/src/builder/workspace/canvas/scene/canvasSceneNode.ts`                                      | 1 · 2     |
| interaction   | `apps/builder/src/builder/workspace/canvas/interaction/resolveCanvasInteractionTarget.ts` (필요 시)       | 2         |
| DOM           | `packages/shared/src/renderers/SelectionRenderers.tsx` · `packages/shared/src/components/GridList.tsx`    | 3         |
| Preview 채널  | `apps/builder/src/preview/App.tsx`                                                                        | 3         |
| stride · 높이 | `apps/builder/src/builder/workspace/canvas/scene/collectionVirtualization.ts` · `layout/engines/utils.ts` | 4         |
| 패널          | `apps/builder/src/builder/panels/properties/…` · `hooks/useOwnerCollectionColumns.ts`                     | 5         |
| 허용표        | `packages/shared/src/collections/` 인접                                                                   | 2 · 3 · 5 |

## 7. 범위 밖

- ListBox 데이터 경로 (같은 규칙 이식 — 후속).
- Menu 정적 경로의 비-slot 자식 제외 (`CollectionRenderers.tsx:1052-1130`) — 별도 판단.
- 행별 가변 높이 · instance 별 매핑 · 인터랙티브 자식의 행 이벤트 (ADR-149 Wave 2 backlog 교차).
- publish leg (README 결정 지점 (1) 그대로 — publish 방침 해제 시).
