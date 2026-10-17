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

(Phase 0 몫 표 · 5-질문 · go/no-go · 사용자 결정 1 ~ 3 답)
