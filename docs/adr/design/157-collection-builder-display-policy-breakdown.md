# ADR-157 Design Breakdown: Data-bound Collection 빌더 표시 정책

> 본문: [157-collection-builder-display-policy.md](../157-collection-builder-display-policy.md)

## 1. 결정 요약 + 경계 판정 lock-in

- **정책**: A2 가상화 window 미적용 data-bound collection 소유자(auto-height / unbounded)는 **실데이터 앞부분 샘플 N행(기본 10)만 투영**하고, 나머지 데이터 영역은 **계산된 높이의 사선 hatch placeholder + "+N more" 라벨**로 표시한다.
- **경계 판정 (D3 대칭 비대상, 2026-07-20 사용자 대화 확정)**: hatch placeholder 는 콘텐츠 스타일이 아니라 **빌더 저작 보조 시각**(selection outline / hover outline / slot marker hatch 와 동급)이다. D3 대칭("시각 결과의 동일성")은 발행 결과물의 스타일에 적용되며, 빌더 저작 오버레이는 대칭 대상이 아니다 — ADR-150 A1 철회 재판정(빌더=정의·구성 도구, Pencil 동형)과 같은 계열. Preview/Publish 는 실데이터 전체(또는 런타임 스크롤)를 그대로 렌더한다.
- **외부 레퍼런스 실측 (Pencil 1차 소스, 2026-07-20)**:
  - shadcn 샘플: `Data Table` 컴포넌트의 데이터 영역 = 자식 0개 slot frame + **사선 hatch** + fallback 높이(`fit_content(260)`) — 정의 단계는 hatch.
  - heroui 샘플: `tableEx` = Table Row 인스턴스 **7행만** 실노드 배치 + footer "1-3 of **24 rows**" 라벨 — 사용 단계도 대표 샘플만, 전체 데이터를 그리는 선택지 자체가 없음.

## 2. Phase 0 — Inventory (착수 시 실측 확정)

현행 코드 경로 (2026-07-20 grep 실측):

| 축               | 경로                                                                                               | 현행                                                                                                                                                                                                                       |
| ---------------- | -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 행 슬라이스 SSOT | `packages/shared/src/collections/resolveCollectionItems.ts`                                        | `COLLECTION_ROW_PROJECTION_WINDOW_LIMIT = 100` (legacy 정적 cap), `DEFAULT_COLLECTION_OVERSCAN = 6`, `window: number \| CollectionWindow` — number 는 `[0, limit)`, rowIndex 는 절대 index 보존                            |
| A2 window 해석   | `apps/builder/src/builder/workspace/canvas/scene/collectionVirtualization.ts`                      | bounded height + overflow scroll/auto 인 data-bound 소유자만 window 산출. rowHeight 는 catalog 기본값(균일) — proof 단순화(2026-07-19 사용자 승인). `DEFAULT_LISTBOX_ROW_HEIGHT = resolveListBoxItemMetric(14).itemHeight` |
| scene 투영 3곳   | `apps/builder/src/builder/workspace/canvas/scene/canvasSceneNode.ts`                               | ListBox(~747) / GridList(~1016) / Table(~1245) — window 미제공 시 legacy 정적 cap 투영                                                                                                                                     |
| layout 높이      | `apps/builder/src/builder/workspace/canvas/layout/engines/utils.ts`                                | `calculateContentHeight` collection 분기 + `resolveListBoxItemRowHeightFromStyle`                                                                                                                                          |
| hatch 시각 자산  | `apps/builder/src/builder/workspace/canvas/skia/slotMarkerRenderer.ts` (+ `skiaOverlayHelpers.ts`) | slot 영역 사선 hatch — 시각 언어 재사용 원천                                                                                                                                                                               |
| 노드 수 관찰 축  | `apps/builder/src/builder/workspace/canvas/BuilderCanvas.tsx` `projectionContentSignature`         | stableSerialize 가 buildScene 비용의 사실상 전부 — 노드 수 = 편집당 비용                                                                                                                                                   |

Phase 0 완료 조건: 위 6개 경로의 라인/심볼 재확정 + auto-height data-bound 소유자의 현행 layout 높이가 "투영 행 수 기준"인지 "totalRows 기준"인지 실측 (M3 원칙 — gap 발견 시 본 ADR 안 inventory 보강으로 흡수).

## 3. Phases

### Phase 1 — 샘플 상수 + remainder 메타 (shared)

- `resolveCollectionItems.ts`: `COLLECTION_ROW_PROJECTION_SAMPLE_LIMIT = 10` 도입, legacy `WINDOW_LIMIT(100)` 소비처를 샘플 상수로 대체. 슬라이스 결과에 `remainder: { hiddenRows: number; hiddenHeight: number } | null` 메타 동반 (rowHeight 는 caller 주입).
- rowIndex 절대 index 계약 · Table header 항상 포함 계약 무변.

### Phase 2 — scene remainder hatch (ListBox 선행 proof)

- `canvasSceneNode.ts` ListBox 투영: window 미적용 + totalRows > SAMPLE 일 때 remainder 영역 synthetic hatch box(사선 — slotMarkerRenderer 시각 언어) + "+{hiddenRows} more" 라벨 emit. 높이 = hiddenRows × rowHeight(+gap 보정).
- hit-test: hatch box 는 소유 collection 선택으로 위임 (행 선택 아님).

### Phase 3 — layout 배치 진실성 (Layer D)

- `calculateContentHeight` collection 분기가 auto-height data-bound 소유자에서 **totalRows 전체 높이**(샘플 + remainder)를 반환하도록 확정 — scene hatch 높이 계산과 **동일 rowHeight resolver 심볼** 공유 (ADR-907 Layer D 계약).
- 시그니처/캐시: 행 수 변화가 layout 캐시 키에 반영되는지 확인 (기존 items 경로 유지 — 신규 키 없음 예상).

### Phase 4 — GridList / Table 확산

- GridList(행=grid row 묶음, `resolveGridListSpacingMetric`) / Table(data 행만, header 제외) 에 동일 정책 확산. A2 확산 계보(ListBox→GridList/Table)와 동일 순서.

### Phase 5 — 검증 + 측정

- `/cross-check`: 샘플 행 스타일(catalog + Selected origin override, ADR-146~148 배선) 대칭 확인 — hatch 는 대칭 비대상 명시.
- live(Chrome MCP, visible 탭): 100+ 행 collection 에서 샘플 10행 + hatch + 라벨, auto-height 소유자의 아래 형제 위치가 Preview 와 일치.
- 성능: 동일 문서에서 scene 노드 수 before/after 실측 기록 (기대: 행 100 소유자당 ~90 노드 감소).

## 4. 테스트

- `packages/shared/src/collections/__tests__/resolveCollectionItems.test.ts`: 샘플 limit + remainder 메타 케이스 추가.
- `canvasSceneNode.test.ts`: hatch 노드 emit 조건(window 미적용 · totalRows>N) / 미발생 조건(A2 window 소유자 · totalRows≤N · 비-데이터 collection).
- layout spacing 테스트(`listBoxSpacingHeight` 계열): totalRows 높이 계약.

## 5. 확정 사항 / 후속

- **N=10 (상수)**: Pencil heroui 샘플 7행 + A2 overscan 6 관행 범위. 사용자 설정화는 후속 (수요 발생 시).
- **per-template 커스텀 행 높이 정밀화**: A2 proof 단순화(catalog 균일 rowHeight)와 동일 한계 공유 — 동일 후속 트랙에서 함께 정밀화 (R1).
- **비-데이터 collection(자식 직접 구성) 무영향**: totalRows 0 → 투영/hatch 모두 없음 (기존 gating 유지).
