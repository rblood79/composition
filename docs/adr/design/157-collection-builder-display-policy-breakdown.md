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

| 축               | 경로                                                                                               | 현행                                                                                                                                                                                                                                                                                                                                                                                          |
| ---------------- | -------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 행 슬라이스 SSOT | `packages/shared/src/collections/resolveCollectionItems.ts`                                        | `COLLECTION_ROW_PROJECTION_WINDOW_LIMIT = 100` (legacy 정적 cap), `DEFAULT_COLLECTION_OVERSCAN = 6`, `window: number \| CollectionWindow` — number 는 `[0, limit)`, rowIndex 는 절대 index 보존                                                                                                                                                                                               |
| A2 window 해석   | `apps/builder/src/builder/workspace/canvas/scene/collectionVirtualization.ts`                      | bounded height + overflow scroll/auto 인 data-bound 소유자만 window 산출. 행 높이는 **측정 resolver**(`resolveListBoxItemRowHeightFromStyle` — template style+description 반영, ADR-150 A2 delivered 기록 `34c56ea70`) 사용. fallback `DEFAULT_LISTBOX_ROW_HEIGHT = resolveListBoxItemMetric(14).itemHeight`. ※ 파일 헤더의 "catalog 균일 proof 단순화" 주석은 stale — Phase 0 에서 주석 정정 |
| scene 투영 3곳   | `apps/builder/src/builder/workspace/canvas/scene/canvasSceneNode.ts`                               | ListBox(~747) / GridList(~1016) / Table(~1245) — window 미제공 시 legacy 정적 cap 투영                                                                                                                                                                                                                                                                                                        |
| layout 높이      | `apps/builder/src/builder/workspace/canvas/layout/engines/utils.ts`                                | `calculateContentHeight` collection 분기 + `resolveListBoxItemRowHeightFromStyle`                                                                                                                                                                                                                                                                                                             |
| hatch 시각 자산  | `apps/builder/src/builder/workspace/canvas/skia/slotMarkerRenderer.ts` (+ `skiaOverlayHelpers.ts`) | slot 영역 사선 hatch — 시각 언어 재사용 원천                                                                                                                                                                                                                                                                                                                                                  |
| 노드 수 관찰 축  | `apps/builder/src/builder/workspace/canvas/BuilderCanvas.tsx` `projectionContentSignature`         | stableSerialize 가 buildScene 비용의 사실상 전부 — 노드 수 = 편집당 비용                                                                                                                                                                                                                                                                                                                      |

Phase 0 완료 조건: 위 6개 경로의 라인/심볼 재확정 + auto-height data-bound 소유자의 현행 layout 높이가 "투영 행 수 기준"인지 "totalRows 기준"인지 실측 (M3 원칙 — gap 발견 시 본 ADR 안 inventory 보강으로 흡수).

**Phase 0 실측 결과 (2026-07-20 착수, M3 inventory 보강):**

1. **stale 주석 정정 완료**: `collectionVirtualization.ts` 헤더 "proof 단순화 — catalog 기본값 균일" → 실제 코드는 `resolveListBoxRowHeight`(line 230-251)가 `resolveListBoxItemRowHeightFromStyle`(측정 resolver, layout 동일 심볼)을 이미 호출. 주석을 실코드 정합으로 교체 (리뷰 MED m1 후속).
2. **scene 투영 (window null = auto-height 소유자)**: `appendListBoxRowProjection`(canvasSceneNode.ts:888-906)은 `windowResolution` null 이면 spacer 미삽입 → 캔버스 높이 = 투영 행 수(`getListBoxProjectionRows` default cap 100) × rowHeight. **rowHeight 자체가 scene 에 없다** (windowResolution 이 rowHeight 공급원인데 null). → Phase 2 는 auto-height 소유자용 rowHeight 를 별도 산출해야 함 (`resolveListBoxRowHeight` 재사용 — collectionVirtualization 의 helper 를 scene 에서 공유).
3. **layout `calculateContentHeight`(§1.55b, utils.ts:2247-2315)**: `props.items` 만 순회 — **dataBinding/collections 미접근** (시그니처에 collections 없음, line 2088-2094). ⇒ static-items 소유자는 전체 items 합산(=totalRows 정확), **순수 dataBinding 소유자는 3-item 기본값 fallback**(line 2256-2263). auto-height data-bound 소유자에서 layout ≠ scene (layout=3 or props.items수 / scene=min(100,total)) — **현행 조용한 mismatch**. Hard Constraint 2(배치 진실성)의 실제 작업 = Phase 3 가 layout 을 totalRows-aware 로 만드는 것.
4. **결론**: 현행 layout 높이 기준 = "props.items 순회(static)" 또는 "3-item fallback(dataBinding)" — **totalRows 도 투영 행 수도 아님**. Phase 3 은 data-bound 소유자에 totalRows 유입 경로 필요 (collections 입력 채널 신설 또는 upstream items 주입 — Phase 3 착수 시 최소 침습 방식 판정, calculateContentHeight 호출부 ~15곳 회귀 주의).

## 3. Phases

### Phase 1 — 샘플 상수 + remainder 메타 (shared) ✅ Implemented 2026-07-20 (`3656aaef6`)

- `resolveCollectionItems.ts`: `COLLECTION_ROW_PROJECTION_SAMPLE_LIMIT = 10` 도입 + `resolveCollectionRemainder(totalRows, projectedRows, rowHeight) → { hiddenRows, hiddenHeight } | null` helper (rowHeight 는 caller 주입 — Layer D resolver 는 builder/specs 소재).
- **default window 는 legacy cap(100) 유지** — Phase 0 실측(중간 상태 배치 진실성 보존)에 따라 소비처 전환은 Phase 2 로 이연. scene 소비처가 SAMPLE_LIMIT 를 명시 전달하며 hatch 와 함께 land.
- rowIndex 절대 index 계약 · Table header 항상 포함 계약 무변.
- 검증: 신규 6 test + 기존 22 = 28/28 PASS · type-check PASS(Cached 0, no-new). 사용자-가시 동작 변화 0.

### Phase 2 — scene remainder hatch (ListBox 선행 proof) ✅ Implemented 2026-07-21 (`366ee88ab` 배선 + `7fbf31968` R1 정밀화) · Gate G1 충족

- `canvasSceneNode.ts` ListBox 투영: window 미적용 + totalRows > SAMPLE 일 때 remainder 영역 synthetic hatch box(사선 — slotMarkerRenderer 시각 언어) + "+{hiddenRows} more" 라벨 emit. 높이 = hiddenRows × rowHeight(+gap 보정).
- hit-test: hatch box 는 소유 collection 선택으로 위임 (행 선택 아님).
- LayerTree 패널: A2 확정 정책("가상화는 캔버스 draw/hit 전용 — LayerTree 는 window 와 분리") 을 샘플 정책에도 동일 승계 — 패널 표시 범위는 본 ADR 무변.

**배선 방식 (구현 확정)**: A2 `CollectionWindowResolution` 에 `mode:"scroll"|"sample"` 추가. `resolveVirtualizedCollectionWindows` 가 `viewportHeight==null`(auto-height) + data-bound ListBox + totalRows>SAMPLE 에서 sample resolution 산출. scene `appendListBoxRowProjection` 이 sample mode 일 때 trailing 을 빈 spacer 대신 `collection-remainder` hatch 노드로 emit → 컨테이너가 rowsGroup(샘플행 + hatch)에 auto-size. overlay `buildCollectionRemainderTargets` + `renderCollectionRemainderMarker`. 명시 height 소유자(scroll=A2 / non-scroll=고정)는 제외.

**live 검증 (2026-07-20, Chrome-MCP `__composition_SKIA_DEBUG__.getSkiaNode` 직접 조회 — 100행 auto-height ListBox 실주입)**:

- ✅ **핵심 배선 작동 확정**: `projection:listbox-remainder:component-listbox` 노드 Skia 레지스트리 등재(y=580 = row9 끝 직후 정확 배치) · sample 정확히 10행(row0~row9 존재, row10 null, 100행 아님) · 컨테이너 rowsGroup auto-size(h=5080 = 580 + 4500).
- 프로젝트 복원 완료(주입 items 제거, registry 47 원복).

**R1 정밀화 — root-cause 확정 + 해소 (2026-07-21, `7fbf31968`)**: 이전 세션의 "렌더 행=58 vs remainder=50, 12% 부족"을 코드 경로로 근본 규명(브라우저 불요 — 결정론적 계약). 근본 원인: `calculateContentHeight` §1.55b-2(childless ListBoxItem 분기)는 행을 **padding-box**(`resolveListBoxItemRowHeightFromStyle` — window resolver/render.shapes/컨테이너 calc 와 동일한 border 규약, padding 포함·border 제외)로 반환하는데, `enrichWithIntrinsicSize`(utils.ts:4313-4340)가 이를 content-box 로 간주하고 `box.padding`(parseBoxModel = **explicit** padding 만)을 재가산한다(GridListItem 형제 분기는 content-box 라 재가산이 옳음 — 두 분기의 box-model 비대칭).

- **기본 origin 은 R1 미해당(정정)**: `createListBoxItemDefaultOrigin`(listBoxTemplateOrigins.ts:130-149)은 `props.style` 자체가 없다 → 투영 행 style 에 explicit padding 없음 → `box.padding=0` → 재가산 0 → **기본 행은 이미 50/28(정합)**. 즉 fresh 프로젝트 기본 템플릿에서는 R1 이 애초에 발현하지 않는다(이전 세션 프로젝트는 origin 에 explicit padding 이 있어 58 관측 = R1 발현).
- **explicit padding 행에서만 이중 계산**: §1.55b-2 가 이미 그 padding 을 포함하는데 enrich 가 다시 더함 → desc 50→58 / plain 28→36. window resolver remainder stride(50)와 렌더 행(58) 불일치 → 컨테이너 12% 부족(R1).
- **수정**: enrich 에서 childless ListBoxItem 행은 `box.padding` 재가산 skip, border 만 재가산(§1.55b-2 = padding-box = border 제외). childful(reusable origin unfold)은 generic content-box 합산 경로라 제외(§1.55b-2 gating `!(childElements>0)` 동일). 기본 행은 fix 전후 byte-identical(50/28), explicit-padding 행만 58/90→50/66 교정.
- **검증**: `listBoxItemRowEnrichHeight.test.ts` (RED explicit-padding 58/90 → GREEN 50/66, default 50/28 회귀 가드, GridListItem content-box 재가산 유지 대조) + 관련 4 test file 53 PASS + engines dir 191 PASS + type-check no-new(builder cache-miss 실행).
- ✅ **Gate G1(±1px) 충족**: fix 후 렌더 행 = window resolver remainder stride = 50(padding-box) 로 수렴 → 컨테이너 = totalRows × rowHeight, hatch 하단이 마지막 논리 행 끝에 정렬. Hard Constraint 2(배치 진실성)는 auto-height 소유자에서 scene rowsGroup(샘플행 + hatch) auto-size 로 달성(§Phase 0 실측 정합).

**Phase 2 live 검증 요약**: 핵심 배선(remainder 노드 위치·sample 10행·컨테이너 auto-size)은 이전 세션 getSkiaNode 로 확정, R1 정밀화는 결정론적 단위 테스트로 확정(브라우저 불요 — 순수 layout 산술, registration/wiring/schema 무변경). 기본 템플릿 live 동작은 fix 로 무변경(box.padding=0).

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
- **임의 자식 구성 콘텐츠 행 높이 정밀화**: A2 의 측정 resolver 는 template style+description 까지 반영 — 그 밖의 임의 자식 구성 높이가 잔존 한계로, A2 와 동일 후속 트랙에서 함께 정밀화 (R1).
- **비-데이터 collection(자식 직접 구성) 무영향**: totalRows 0 → 투영/hatch 모두 없음 (기존 gating 유지).
