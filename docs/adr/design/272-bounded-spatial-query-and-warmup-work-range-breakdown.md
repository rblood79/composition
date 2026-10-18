# ADR-272 design breakdown — 작업 범위 제한 (공간 질의 전략 전환 · 미리 기록 bounded · 큰 항목 버킷)

> 본문: [../272-bounded-spatial-query-and-warmup-work-range.md](../272-bounded-spatial-query-and-warmup-work-range.md). 이 문서가 Phase · 파일 · 검증의 정본이다. 실측 결론은 §기록에. 코드 인용은 HEAD `94c9a0d52`.

## 0. 전제 lock-in (fork 4 질문)

1. **base / 응용**: 기존 ADR 분리가 아니다. 공간 인덱스 (Rust grid — ADR-263 Phase 2 viewport 후보 · hit-test) · ADR-266 결정 2 (idle 미리 기록) · ADR-264/269 (옮기기 · 스크롤의 인덱스 갱신) 가 base 이고, 이 ADR 은 그 질의 · 후보 수집의 **비용 상한**을 바꾸는 응용이다. Pen.dev 비교 확정 4 건의 셋째 — ADR-271 과 `renderCommands.ts` 를 같이 건드리지만 다른 함수 (271 = 요소 판정, 272 = 질의 호출 · 후퇴 사유).
2. **schema**: 문서 · 저장 schema 변경 0. Rust `SpatialIndex` 의 공개 시그니처 불변 (HC6) · dev 전용 `query_stats()` getter 1 개 · 큰 항목 버킷은 내부 필드. 하니스 fixture `many-pages` · 부류 `page-jump` · `counts.render.spatial*` · `warm*`.
3. **선행 전제 reverse 검증**: ADR-263 「viewport 후보는 SpatialIndex, 후보가 절반을 넘으면 선형」 은 유지 — 전환은 그 **앞** (Rust 안) 에서 셀 순회 자체를 피하는 것이고 half rule 은 그대로다. ADR-266 「미리 기록은 ≤ 4,096 · 퇴거 없음 · 넘침은 picture 에 보관」 은 유지 — 바뀌는 것은 후보 **수집 범위와 순서**뿐. ADR-269 의 스크롤 property node 는 인덱스 갱신 수를 이미 줄였고 (`scrollSubtreeVisits`), 이 ADR 은 갱신 1 회의 **셀 수**를 본다 (Phase 3).
4. **판독**: 사용자가 요청할 때 `/review-adr 272`. phase 당 1 + 수리 검증 1.

## 1. Phase 0 — `many-pages` fixture · Rust 카운터 · 몫 표 (G0)

- **fixture** (`perfAppFixture.mjs` 생성기 재사용 · `perf-baseline.mjs` `--fixture-kind many-pages --pages N --grid-gap G`): 사용자 결정 1 (제안 100 · 300 페이지, 간격 기본 · ×4). 부류: `zoom` 을 `--zoom 0.05 · 0.25 · 1` 로, 새 부류 **`page-jump`** (Layers 의 먼 페이지로 점프 → 팬 3 회 — 캐시에 불리), 기존 `pan` · `edit`.
- **Rust 카운터** (`spatial_index.rs`, `cfg` 가 아니라 런타임 필드 — 비용은 정수 증가 4 개): `query_stats { cells_visited, items_visited, results, upsert_cells }` 누적 + `take_query_stats()` 리셋 getter. `wasm-bindings/spatialIndex.ts` 가 dev 에서 읽어 `renderCounters.spatialCellsVisited` · `spatialItemsVisited` · `spatialResults` · `spatialUpsertCells` 로. production 빌드에서는 getter 를 부르지 않는다 (증가 비용만 남음 — HC4 측정에 포함).
- **미리 기록 카운터** (`nodePictureWarmup.ts:153 ~ 178`): `warmCandidatesScanned` (stream 순회로 본 ELEMENT_BEGIN 수) · `warmCandidatesSorted` (정렬 입력 크기) · `warmPassRebuilt` (차례 재구성 수).
- **몫 표**: `many-pages` 줌 0.05 · 0.25 · 1, `page-jump`, `app-pages` 줌 — 다섯 비용 (질의 셀 · 항목 · 후보 수집 · 정렬 · upsert 셀) 의 수와 `--call-counts` 상위 함수에서의 자리.
- **ratchet**: `--add-run 60:many-pages=<a>,<b>` · `--add-keys … --keys render.spatial*,render.warm*`.
- **go/no-go**: 다섯 비용 중 하나라도 프레임 비용 상위에 보이면 그 Phase 부터 (1 = 질의 셀 · 2 = 후보 · 3 = upsert). 전부 1 % 미만이면 사용자 결정 3 (측정 기록 종결). 5-질문 답을 §기록에.

## 2. Phase 1 — 질의 전략 전환 (G1 · G3)

- **Rust** (`spatial_index.rs:194 ~ 230` `query_rect_internal`): 셀 수 `(max_cx − min_cx + 1) × (max_cy − min_cy + 1)` 를 먼저 구해 `cells > K × self.bounds.len()` (K 는 `new(cell_size, strategy_ratio)` 인자 — JS 가 B 값을 넘긴다, 기본 1) 이면 **`bounds` 맵 선형 AABB** 로 (dedup 불필요 — 항목당 1 회). 아니면 지금 경로. 두 경로의 포함 규칙 (`aabb_intersects` 의 경계 · 0 크기) 은 같은 함수를 쓴다.
- **JS**: `wasm-bindings/spatialIndex.ts` `initSpatialIndex` 가 비율을 넘김 · dev 플래그 `renderDebug.boundedQueryOff` (비율 = ∞ 로 재초기화 없이 setter).
- **unit (G1)**: Rust property test — 무작위 항목 1,000 (음수 좌표 · 0 크기 · 셀 경계에 걸친 큰 항목 포함) × 질의 200 (작은 · 뷰포트 · 전체 · 빈 영역) 에서 두 전략의 결과 **집합** 동일 · `query_point` 불변. TS unit: 비율 setter 뒤 결과 동일. **원복 RED**: 선형 경로의 `aabb_intersects` 를 `<` 로 바꾸면 경계 케이스가 RED.
- **live (G1)**: `adr272-bounded-query-live.mjs` — bounded ↔ `linearOnly` content 스크린샷 0 px (`many-pages` 줌 0.05 · 0.25 · 점프).
- **ratchet (G3)**: `spatialCellsVisited` (줌 0.05) 상한 ↓ · `spatialResults` 불변 · 줌 1 편집 · hover 이내.

## 3. Phase 2 — 미리 기록 bounded · 카메라 추종 (G2 · G3)

- **후보 수집** (`nodePictureWarmup.ts:153` `warmupOrder`): 전체 stream 순회 대신 `queryRect(viewport × r)` (r 은 B, 제안 2 — 가로세로 각각) 의 id 에서 `selfSpans.has(id)` · `visible` 인 것만 — **page root (`rootIds`) 는 늘 앞에 싣는다**: 공간 인덱스는 hit bounds 기반이라 page root 가 없을 수 있고 viewport 실행도 그래서 `rootIds` 를 따로 앞에 둔다 (`renderCommands.ts:2360 ~ 2364`). 지금의 stream 순회는 page root self span 을 포함했으므로 빼면 회귀 (바탕 picture 미기록 → 새 page root 첫 재생이 프레임 안 기록). 질의가 없으면 (인덱스 off) 지금 경로로 후퇴 (카운터 `warmCandidatesLinear`).
- **적격성 선별 → 정렬** (r1 M1): 부분 선택 **앞에서** 기록할 수 없는 후보를 뺀다 — 현재 키로 이미 유효한 picture (`hasNodePicture(id, dataRef, begin.width, begin.height)` — `nodePictureCache.ts:283 ~ 295` 의 키 계약 그대로, `cache.has(id)` 아님) · 편집 중 · volatile · span 없음 (`warmNodePicture` 가 `false` 를 돌려주는 조건, `renderCommands.ts:3067 ~ 3076`). `rootIds` 도 같은 선별을 거치고 중복 제거. 그 뒤 **k 개 제한** (k = 남은 자리 — `hasNodePictureWarmRoom` 의 개수 · 바이트 산식, `nodePictureCache.ts:275 ~ 279`) 부분 선택 (nth-element 류 — 선택되지 않은 적격 후보를 **버리지 않고** 뒤에 둔다, 아래 보충용; 크기 k 힙만 두면 보충할 후보가 없다 — r2 L1) — `warmCandidatesSorted ≤ k`. 지금 차례는 warm 항목을 **지나쳐** 다음 cold 를 기록하므로 (`nodePictureWarmup.ts:93 ~ 107`), 선별 없이 자르면 4,095 개 · k = 1 · 최근접 A 가 warm 일 때 B (cold) 가 idle 에 기록되지 않는 회귀 (반례는 reviews/272.md M1). 기록 중 `false` 가 나오면 (경쟁 — 선별 뒤 편집 시작) 그 자리만큼 다음 적격 후보를 보충한다.
- **카메라 추종** (`:140 ~ 147` `isPassDone` · `:59 ~ 69` `requestNodePictureWarmup`): 차례 키에 `cameraCell = floor(center / (viewport 크기 × r))` 를 더한다 — stream · revision 이 같아도 큰 셀이 바뀌면 차례를 다시 세운다 (idle 콜백 안에서, R4). `requestNodePictureWarmup` 호출 지점 (`canvasScene.ts:296`) 은 그대로 (content full 기록 끝) 이고, 팬만으로 full 기록이 없을 때는 renderer 의 카메라 정착 (`debouncedMoveEnd` 류 — `SkiaRenderer.ts:504` 패턴) 에서 1 회 더 부른다.
- **unit (G2)**: 후보 = rootIds ∪ (질의 결과 ∩ picture 가능) — 넓힌 viewport 안 page root 가 늘 포함 · **M1 반례**: 4,095 개 · 최근접 A warm (page root 여도) · B cold → 차례가 B 를 기록하고 자리 1 을 채움 · warm 항목이 선택 한도를 소진하지 않음 · k 상한 · 큰 셀 불변이면 차례 유지 · 바뀌면 재구성 1 · 프레임 (`renderSkia`) 안 `warmNodePictures` 호출 0 · ADR-266 넘침 unit 재실행. 원복 RED: 전체 순회로 되돌리면 `warmCandidatesScanned` 상한 RED · 카메라 키 제거 → 「팬 뒤 새 주변 우선」 RED.
- **ratchet (G3)**: `warmCandidatesScanned` · `Sorted` 상한 ↓ (`app-pages` · `many-pages`) · `pictureWarmRecorded` 는 Phase 0 이내 (기록 수는 그대로 — 준비 비용만 준다).

## 4. Phase 3 — 큰 항목 버킷 (사용자 결정 2 뒤만, G1 · G3)

- **Rust**: `upsert` 가 셀 수 `> M` (B, 제안 64 — 2,048 px × 2,048 px) 인 항목을 셀에 넣지 않고 `large: HashMap<u32, [f32;4]>` 에 둔다. 질의 (양 전략) · `query_point` · `remove` · `clear` 가 버킷을 같이 본다. 크기 변경으로 경계를 넘으면 `upsert` 가 옮긴다 (셀 ↔ 버킷).
- **unit**: 버킷 ↔ 셀 이동 · 제거 뒤 질의 0 · property test 에 큰 항목 비율 20 % 추가. 원복 RED: `remove` 에서 버킷 삭제를 빼면 「삭제 뒤 질의 0」 RED.
- **ratchet**: `spatialUpsertCells` (`app-pages` 줌 — page root 옮기기) 상한 ↓.

## 5. 종결 (G4 · G5)

- G4 production 짝 — `many-pages` 줌 · 점프 · `app-pages` 줌 · 편집 · 중첩 5k 편집 회귀 0. G5 live 사용자 프로젝트. 문서: Status · README · CHANGELOG (사용자-가시: 많은 페이지 문서의 전체 보기 · 먼 페이지 이동) · 메모리.

## 6. 파일 (예상)

| 영역   | 파일                                                                                                                                                                            | 변경                                                     |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| Rust   | `packages/engine/src/spatial_index.rs` (+ tests)                                                                                                                                | `query_stats` · 전략 전환 · 큰 항목 버킷 · property test |
| wasm   | `apps/builder/src/builder/workspace/canvas/wasm-bindings/spatialIndex.ts` · `engineWasm.ts:63 ~ 87` (raw 계약) · `init.ts:35` · `engine-pkg/` (`pnpm wasm:build:engine` 재생성) | 비율 인자 · stats getter · 플래그 · 호출부 · 산출물      |
| warm   | `skia/nodePictureWarmup.ts` · `skia/nodePictureCache.ts`                                                                                                                        | 질의 기반 후보 · k 제한 선택 · 카메라 셀 키 · 카운터     |
| 실행   | `skia/renderCommands.ts` · `skia/SkiaRenderer.ts` · `catalogRuntime/canvasScene.ts`                                                                                             | 카메라 정착 때 warmup 요청 · 후퇴 사유 카운터            |
| 카운터 | `skia/renderCounters.ts`                                                                                                                                                        | `spatial*` · `warm*`                                     |
| 하니스 | `scripts/perfAppFixture.mjs` · `perf-baseline.mjs` · `adr272-bounded-query-live.mjs` (신규) · `perf/ratchet.json`                                                               | `many-pages` · `page-jump` · run · keys · oracle         |

## 7. 기록

### 7-1. Phase 0 (2026-10-18) — 몫 표 · go/no-go

조건: dev · headless Chrome · DPR 1 · 여백 512 CSS (device 512 px) · `--fixed-inputs` · 부류 `zoom` · `pan` · `page-jump` · `edit`. 사용자 결정 1 = 「100 · 300 × 간격 기본 · ×4」. 시드: 100 페이지 = 노드 14,589 · hit 항목 8,633 · world 1,920 × 115,920 (자동 열 — 시드 줌 1 에서 한 열). 300 페이지 = 노드 43,869 · 항목 25,786.

**계획과 다른 점**: ADR 은 줌 0.05 를 적었지만 빌더 최소 줌이 0.1 이다 (`ViewportController` minZoom · 하니스 `--zoom` 검증 0.1 ~ 5). 0.1 을 전체 보기 최악 경우로 쓴다. G3 의 「줌 0.05」 도 0.1 로 읽는다.

**재현 (등급 A)**: 같은 조건 2 회 (`many-pages` 100 기본 · ×4 간격, `app-pages`) 의 `spatial*` · `translateNodes` · `warmAfter.*` 가 전부 같다.

**단가** (`scripts/adr272-spatial-unit-cost.mjs` — 같은 브라우저 · 같은 engine wasm · 실제 hit bounds 를 새 `SpatialIndex(256)` 에 넣어 잼. CPU 프로필은 engine wasm 함수 이름이 지워져 질의 · upsert 를 가르지 못한다):

| 줌   | 셀 / 질의 | 항목 / 질의 | 결과 / 질의 | µs / 질의 |
| ---- | --------- | ----------- | ----------- | --------- |
| 0.1  | 7,469     | 3,318       | 843         | 90        |
| 0.25 | 1,209     | 1,234       | 291         | 23.5      |
| 1    | 99        | 337         | 62          | 6.5       |

upsert 1 회 0.29 µs (평균 7.7 셀 · 셀당 38 ns). 단가는 페이지 수 · 간격과 무관 (300 페이지 · ×4 도 같은 값 ± 10 %).

**몫 표** (횟수 × 단가 ÷ 부류 main-thread taskMs, 줌 0.1):

| 비용                          | many-pages 100                                 | many-pages 300                       | app-pages (22)                      | 판정                            |
| ----------------------------- | ---------------------------------------------- | ------------------------------------ | ----------------------------------- | ------------------------------- |
| 질의 셀 + 항목 (줌 부류)      | 68 질의 · 128,599 셀 ≤ 6.1 ms / 2,702 ms = **≤ 0.23 %** (×4 간격 89 질의 ≤ 8 ms · 0.28 %) | 같은 68 질의 · 128,599 셀 → **≤ 0.07 %** | 68 질의 · 같은 셀 · ≤ 0.6 % | 1 % 미만 → **Phase 1 no-go**    |
| 질의 (page-jump · pan · edit) | 20 · 4 · 15 질의, 셀 198 · 42 · 132           | 같은 크기                            | 같은 크기                           | 0 %                              |
| 후보 수집 + 정렬 (편집 뒤 1 차례) | 21,746 훑음 · 17,457 정렬 · 9.1 ms / 편집 197 ms = **4.6 %** · **기록 0** | 66,075 · 53,120 · **27.8 ms** / 522 ms = **5.3 %** · 기록 0 | 4,939 · 3,961 · 6 ms · 기록 15 | **Phase 2 go**                   |
| upsert 셀 (줌 부류)           | 3,595,741 셀 × 38 ns ≈ 137 ms = **5.1 %**     | 10,930,147 셀 ≈ 430 ms = 4.9 %      | 716,374 셀 ≈ 27 ms = 2.6 %          | 큰 항목 0 개 → 버킷이 줄일 몫 0 |

- **질의는 문서 크기와 무관하다.** 셀 수는 viewport 넓이 (줌 0.1 = 7,469 셀) 로 정해지고 100 · 300 페이지에서 같다. 줌 0.1 에서 셀 7,469 < 항목 8,633 이라 Phase 1 의 전환 조건 (`cells > K × items`, K = 1) 은 `many-pages` 100 에서 성립조차 하지 않는다 — 성립하는 것은 항목이 적은 문서 (그때는 질의가 원래 싸다).
- **미리 기록 준비는 문서 크기에 비례하고 대부분 헛일이다.** 캐시가 `MAX_WARM_NODE_PICTURES` · 바이트 상한에 차 있으면 (`hasNodePictureWarmRoom()` false) 전량 훑고 정렬한 뒤 1 개도 기록하지 않는다. stream revision 이 바뀔 때마다 (편집마다) 다시 세운다. `warmupOrder` 는 deadline 으로 나뉘지 않아 300 페이지에서 idle 콜백 하나가 27.8 ms 를 막는다 (다음 입력 지연). 카메라만 바뀐 부류 (`zoom` · `pan` · `page-jump`) 뒤에는 차례를 다시 세우지 않는다 (F6 실측 — 셋 다 `warmAfter` 0): 먼 페이지로 점프해도 옛 화면 중심 순서가 남는다.
- **upsert 는 큰 항목 때문이 아니다.** cells-per-item 분포: ≤ 1 셀 2,963 · ≤ 4 4,255 · ≤ 16 1,065 · ≤ 64 350 · **> 64 0** (최대 48). 줌 upsert 는 auto-columns 재배치가 page root 와 **모든 자손**을 옮기는 것 (`translateNodes` 116 만 · 셀 3.1 / 노드) 이다. Phase 3 버킷 (M = 64) 은 대상이 0 이다. 줄이려면 자손 좌표를 page root 기준으로 두는 것 (ADR-264/269 의 조건부 「로컬 좌표」, C 등급) — 이 ADR 밖.
- **줌 비용의 본체는 Rust 가 아니다.** 프로필 상위는 `checkTranslate` 4.8 % · `applyTranslate` 2.2 % (JS 재배치), idle 66.7 %. 줌 표시 간격 p99 52.9 ms (100) · 123.8 ms (300) — HC3 참고 목표 (p99 ≤ 20 ms) 는 이 ADR 의 레버로 닿지 않는다 (사용자 결정 3 은 종결 때).
- **범위 밖 관찰**: `pan` taskMs 가 문서 크기에 비례한다 (721 → 3,198 ms, 질의 셀 42 로 같음). 공간 · 미리 기록 카운트는 같고 `execVisited` (프레임당 page root 수) · GC 횟수 (17 → 36) · 할당 (64 → 107 MB/s) 만 는다. 원인 미확인 — 기록만.

**5-질문 답**:

- Q1 대표성: `many-pages` 는 `app-pages` 생성기로 페이지 수 · 간격만 키운 규모 전용 합성물이다. 결론 (질의 몫 · 큰 항목 0) 은 분포 (페이지당 22 종 화면) 에 걸려 있다 — 사용자 프로젝트에서 G5 로 확인한다.
- Q2 불리 경우: 줌 0.1 (최소) · 먼 페이지 점프 (가장 먼 frame 으로 카메라 이동 뒤 팬 3) · 300 페이지 · 간격 ×4 를 다 쟀다.
- Q3 측정 대상: 작업 트리 dev 서버 (5173) · engine wasm 은 `pnpm wasm:build:engine` 로 같은 소스에서 빌드.
- Q4 계측이 실제 경로에 꽂혔는가: Rust 카운터는 `query_rect_internal` (viewport · damage · hit 사각형 질의 공통) · `upsert` · `remove_from_cells` 안에 있다. `page-jump` 에서 질의 20 · 결과 424, `edit` 에서 upsert 셀 2,738 이 잡혀 두 경로 모두 실렸다.
- Q5 oracle: 단가는 앱 인덱스와 별개인 새 인덱스로 같은 hit bounds 를 잰 값이다 (다른 경로). 몫은 「횟수 (등급 A) × 단가」 이고 단가는 wall-clock 이라 방향 · 크기 판단에만 쓴다.

**go/no-go**: Phase 1 **no-go** (질의 몫 ≤ 0.3 % — 1 % 미만, 전환 조건도 성립하지 않음). Phase 2 **go** (편집 뒤 준비 4.6 ~ 5.3 % · 기록 0 · 문서 크기 비례). Phase 3 은 사용자 결정 2 — 글자 조건 (upsert 몫 > 질의 몫) 은 성립하지만 버킷 대상이 0 개다.

**ratchet**: run `60:many-pages100@zoom0.1` (부류 `zoom` · `pan` · `page-jump` · `edit`). `warmAfter.*` 를 `counts.warmAfter` 로 옮겨 ratchet 이 본다 (시간은 `warmAfterMs` — 판정 밖).

### 7-2. Phase 2 (2026-10-18) — 미리 기록 bounded · 카메라 추종

구현 (`skia/nodePictureWarmup.ts` · `renderCommands.ts` `isNodePictureWarmable` · `nodePictureCache.ts` `getNodePictureWarmRoom` · `SkiaRenderer.ts` 배율 전달 · `canvasScene.ts` `rootIds` 전달):

- **자리 0 → 차례 생략**: 남은 자리 (`MAX_WARM_NODE_PICTURES − 캐시 수`, 바이트 자리 없으면 0) 가 0 이면 후보를 모으지 않는다.
- **후보** = page root ∪ 공간 질의 결과 (self span · 안 보이는 조상 없음). 그 뒤 기록할 수 있는 것만 남기고 (`isNodePictureWarmable` — `warmNodePicture` 가 기록 없이 `false` 를 낼 조건과 같은 함수) 가까운 k 개 (k = 남은 자리) 만 quickselect 뒤 정렬, 나머지는 정렬 없이 뒤에 둔다 (기록이 `false` 면 보충 — r1 M1 · r2 L1).
- **카메라 칸**: 차례 키 = stream · revision · 화면 가운데를 (후보 사각형 ÷ 4) 칸으로 양자화한 값. 팬 · 줌 뒤 정착 full 기록 (`scheduleCleanupRender` — 이미 있는 경로) 이 `requestNodePictureWarmup` 을 부르므로 새 호출 지점은 없다.
- 롤백 `renderDebug.warmupBoundedOff` · 후퇴 카운터 `warmCandidatesLinear`.

**계획과 다른 점 (추정 vs 실측)**:

1. **반경 r**: ADR 의 제안 「viewport × 2」 대신 **최소 줌 (0.1) 의 culling 넓이 × 2** (`warmupRect` — culling 넓이가 배율에 반비례하므로 배율 · 문서 크기와 무관한 world 넓이). 「viewport × 2」 는 줌 1 → 0.1 에서 넓이가 100 배라 ADR-266 의 「처음 줌아웃 프레임은 재생만」 을 깬다.
2. **전체 순회 보충**: 사각형만으로는 `app-pages` 줌 부류의 줌 프레임 안 기록이 0 → 380 (A 초과 — `contentRecordedElements` · `pictureColdFirst` · 글자 224). 원인은 줌아웃의 auto-columns 재배치 — 지금 배치에서 먼 페이지가 화면에 온다 (picture 는 위치 무관이라 미리 기록이 그것을 덮는다). 그래서 **사각형 안 기록 가능 후보 < 남은 자리면 stream 전체로 보충**하고, 질의 결과 수가 이미 자리보다 적으면 사각형 선별을 건너뛴다 (두 번 훑지 않음). 줌아웃 보장은 자리가 있는 동안 전체 순회가 지킨다 — bounded 의 이득은 「자리 0」 과 「사각형이 자리를 채움」 경우에 있다.
3. **stats getter 를 스칼라로** (`take_query_stat(i)`): 배열 반환이 glue 의 `getDataViewMemory0` 을 불러 `60` page-switch 함수 호출 수 ratchet A 를 올렸다 (180 → 184 — 하니스 snapshot · reset 의 호출).
4. **ratchet 도구 결함**: `--update` · `--raise` 가 경로를 `.` 으로 잘라 `@zoom0.1` seed 에서 깨졌다 (ADR-271 run 부터 잠복). `parseRatchetPath` — 가장 긴 seed 키 접두.

**결과** (dev · `--fixed-inputs`, 편집 뒤 미리 기록 한 차례 `warmAfter`):

| fixture             | 훑음            | 정렬           | 기록      | 시간          |
| ------------------- | --------------- | -------------- | --------- | ------------- |
| many-pages 100      | 21,746 → **0**  | 17,457 → **0** | 0 → 0     | 9.1 → 0.1 ms  |
| app-pages (22)      | 4,939 → 6,425   | 3,961 → **15** | 15 → 15   | 6.2 → 4.8 ms  |

- `app-pages` 의 훑은 수 증가: 질의 결과 (~1,486) ≥ 자리라 사각형을 선별했고, 기록 가능한 것이 자리보다 적어 전체로 보충했다 (대부분 이미 유효). 시간은 정렬 축소로 준다.
- 300 페이지도 캐시가 차 있어 자리 0 (Phase 0 의 27.8 ms 가 같은 경로로 생략).
- ratchet (A 초과 0, 8 run): 하향 `60:many-pages100@zoom0.1.edit` `warmAfter.warmCandidatesScanned` 21,746 → 0 · `Sorted` 17,457 → 0. `60:app-pages` 에 `warmAfter.*` · `render.spatial*` · `render.warm*` A 등록 (2 회 같은 값). 기록 수 (`pictureWarmRecorded`) 는 Phase 0 이내 (15 · 0).
- 흔들림 (이 변경과 무관 — DOM 을 만지지 않는다): `zoom` 부류 `domMutations.attributes` ±4 (`60:app-pages` 4,711 ↔ 4,715 · `600` 2,811 ↔ 2,815), `60:app-pages-images` load-zoom `contentSurface.hits` 66 ~ 68 (miss 와 합은 같음 — 이미지 로드 시각). 게이트의 재실행 (HC2) 이 「측정 불가」 로 가른다. B 경고 `60` drag `v8.app` +8 % (경고만).
- unit 19 (`nodePictureWarmup.test.ts`) · 원복 RED 6: 전체 순회 · 카메라 키 제거 · 적격성 선별 제거 · 자리 0 생략 제거 · 보충 제거 · 질의 수 생략 제거 → 각각 RED. ratchet 도구 unit 1 · 원복 RED 2 (`.` 분할 · 가장 짧은 접두).
