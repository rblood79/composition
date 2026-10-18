# ADR-272: 작업 범위 제한 — 공간 질의의 셀 상한 전략 전환 · 사전 기록 후보 bounded · 카메라 추종 (Pen.dev 비교 도입 3/4)

## Status

Accepted — 2026-10-18 (사용자 `/execute-adr 272` · 리뷰 [reviews/272.md](reviews/272.md) Round 2 pending 0 · CRITICAL/HIGH 0). 사용자 결정 1 (2026-10-18): **「100 · 300 × 간격 기본 · ×4」** — ratchet run 은 100, 300 은 몫 표 · 상한 확인용.

> **Phase 0 종결 (2026-10-18)** — 몫 표 ([breakdown §7-1](design/272-bounded-spatial-query-and-warmup-work-range-breakdown.md#7-1-phase-0-2026-10-18--몫-표--gono-go)). 질의 셀 + 항목 ≤ 0.3 % (문서 크기와 무관 — viewport 넓이로 정해진다) → **Phase 1 no-go**. 편집 뒤 미리 기록 준비 4.6 ~ 5.3 % · 캐시가 차 있으면 기록 0 (전량 훑고 정렬만) → **Phase 2 go**. 64 셀 넘는 항목 0 (최대 48) — 사용자 결정 2 (2026-10-18): **「생략」** (줌 upsert 는 자손 옮기기 몫 — 「로컬 좌표」 후보). 빌더 최소 줌이 0.1 이라 0.05 대신 0.1 을 잰다. ratchet run `60:many-pages100@zoom0.1` (`counts.warmAfter` 포함).

> **Phase 2 종결 (2026-10-18)** — [breakdown §7-2](design/272-bounded-spatial-query-and-warmup-work-range-breakdown.md). 미리 기록 자리 0 이면 차례 생략 · 후보 = page root ∪ 공간 질의 (최소 줌 culling × 2) · 기록 가능한 후보 중 가까운 k (남은 자리) 개만 정렬 · 카메라 칸 키. 사각형이 자리를 못 채우면 전체 순회로 보충 (줌아웃 auto-columns 재배치 — 사각형만이면 `app-pages` 줌 프레임 기록 0 → 380). many-pages 100 편집 뒤 준비 21,746 훑음 · 17,457 정렬 · 9.1 ms → 0 · 0 · 0.1 ms, `app-pages` 정렬 3,961 → 15. ratchet 하향 · A 초과 0. 남은 것: G4 (production 짝) · G5 (live).

Proposed — 2026-10-17 (리뷰 [reviews/272.md](reviews/272.md) Round 1 — codex, MEDIUM 1 → 같은 날 반영: 미리 기록 후보의 k 제한 앞에 적격성 선별 (유효 picture · 편집 · volatile 제외, `rootIds` 포함) · `false` 시 보충. Round 2 — claude 수리 검증 (같은 날): HIGH 0 · LOW 1 (부분 선택이 나머지 후보를 보존해야 보충이 성립) → 반영, 설계 판독 종결 — pending 0)

- 사용자 요청: `/create-adr 남은 확정 3건 (축소 개요 LOD · 작업 범위 제한 · 메모리 예산)` (2026-10-17) — Pen.dev 1.2.18 ↔ HEAD `94c9a0d52` 비교 분석의 확정 4 건 중 **셋째**. 첫째 [ADR-270](completed/270-image-load-path-partial-update-off-thread-decode.md) · 둘째 [ADR-271](completed/271-zoomed-out-lod-skip-small-elements-text-line-boxes.md) · 넷째 [ADR-273](completed/273-canvas-memory-budget-overscan-device-px-resource-cache.md). 조건부 「로컬 좌표 · 지연 합성」 (ADR-269 후속) 은 이 ADR 뒤에도 자손 맵 갱신이 지배적일 때 별도 ADR — 여기서 다루지 않는다.
- 방향을 정한 사용자 원문: 「pen.dev의 패턴은 … 코드에서부터 근거로 도입하는것이 맞지않나」 · 「반드시 측정이필요한 곳과 아닌곳이 있지않나」. 등급: 「두 전략의 결과 집합이 같으면 싼 쪽을 고른다」 · 「idle 시간에 묶이는 기록의 후보를 전부 정렬하는 것은 낭비」 는 **A**, 전환점 셀 수 · 후보 반경 · 큐 크기는 **B**. 비교 분석도 이 항목을 「코드에서 도출되는 확장성 위험이며 실측 회귀 아님」 으로 적었다 — 그래서 Phase 0 은 **많은 페이지 fixture** 로 비용이 어디서 나는지 먼저 가른다 (레버 선택은 카운트가 한다).
- 사용자가 이미 답한 것: 측정은 게이트. Pen 의 처리도 전부 화면 내 요소 수에 비례하지는 않는다 — 가져오는 것은 **「수요에 따라 자원 작업 범위를 제한하는 원칙」** 뿐.
- 리뷰는 사용자가 요청할 때 `/review-adr 272` → `reviews/272.md`.

## Context

**Domain**: D3 — Builder (Skia) consumer 의 내부 자료구조 (공간 인덱스 · idle 미리 기록). 시각 결과 · 문서 · DOM 무관. D1 · D2 무관.

### 코드 사실 (HEAD `94c9a0d52`)

| #   | 사실                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | 경로                                                                                                                    |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| F1  | 공간 인덱스는 **256 단위 균일 grid** (Rust). `query_rect_internal` 은 질의 사각형이 덮는 **모든 셀 좌표**를 이중 루프로 순회한다 — 빈 셀도 `HashMap` 조회 1 회. 비용 ≈ 셀 수 + 셀 안 항목 방문 + `HashSet` dedup + AABB                                                                                                                                                                                                                                                                                        | `packages/engine/src/spatial_index.rs:48 ~ 51` · `:194 ~ 230`                                                           |
| F2  | 호출자: viewport 실행 (`queryRect` on culling bounds) · damage 실행 (damage rect) · hit-test (`hitTestPoint` → `query_point` — 셀 1 개, 문제 없음). 「후보 + unsafe 가 절반을 넘으면 선형」 판정 (`viewportFallbackHalfRule`) 은 **질의 뒤**라 셀 순회 비용은 이미 낸 뒤다                                                                                                                                                                                                                                     | `renderCommands.ts:2273` · `:2352 ~ 2359` · `wasm-bindings/spatialIndex.ts:107 · 123 · 138`                             |
| F3  | 질의 면적은 **world 좌표**이고 viewport 질의의 cullingBounds 는 overscan 여백을 더한 사각형이다 (`padScene = padCss / zoom`, DPR 1 에서 padCss 512). 1440 × 900 CSS 에서 줌 0.1 → (1440 + 1024) / 0.1 × (900 + 1024) / 0.1 world ≈ 97 × 76 ≈ **7,400 셀**, 줌 1 → 10 × 8 = 80 셀 — 화면 픽셀이 같아도 셀 순회 ~90 배. **의존**: 셀 수는 여백 값에 걸려 있다 — ADR-273 Phase 1 이 DPR 2 여백을 바꾸면 이 ADR 의 `spatialCellsVisited` 기준값이 같이 움직인다 (273 커밋이 272 ratchet 을 사유 적고 재측정 — HC2) | `SkiaRenderer.ts:858 ~ 866` (padScene) · `:698 ~ 705` · ADR-273 Phase 1                                                 |
| F4  | 갱신도 셀 수에 비례한다 — `upsert` 는 옛 셀 전부에서 지우고 새 셀 전부에 넣는다 (`:59 ~ 86`, `:160 ~ 163`). page root (1440 × 수천 px) 하나가 수백 셀. 줌의 page grid 옮기기는 **자손 전부** `updateElement` — `app-pages` 줌 `translateNodes` **222,268** (ratchet A)                                                                                                                                                                                                                                         | `spatial_index.rs:59 ~ 86` · `subtreeTranslate.ts:265 · 640` · `subtreeCommandPatch.ts:475 ~ 482` · `perf/ratchet.json` |
| F5  | idle 미리 기록: `warmupOrder` 가 **전체 Command Stream** 을 훑어 (보이는 서브트리만, 안 보이는 건 jump) 후보를 모으고 **전부 거리 정렬** (`ids.sort`) 한 뒤 기록마다 idle 잔여 시간을 본다 — 기록 개수 (`MAX_WARM_NODE_PICTURES` 4,096) 는 제한돼 있지만 **후보 준비 비용은 제한이 없다**                                                                                                                                                                                                                      | `nodePictureWarmup.ts:153 ~ 178` · `:74 ~ 109` · `nodePictureCache.ts:92 · 275`                                         |
| F6  | 차례 완료 판정은 `stream + presentationRevision` — 카메라만 움직이면 (팬 · 줌) 끝난 차례를 다시 세우지 않아 **새 화면 주변**이 먼저 기록되지 않는다. 호출은 content full 기록 끝 (`canvasScene.ts:296`) 에서만                                                                                                                                                                                                                                                                                                 | `nodePictureWarmup.ts:140 ~ 147` · `canvasScene.ts:296`                                                                 |
| F7  | Rust 질의의 **셀 방문 수 · 항목 방문 수**는 JS 에서 보이지 않는다 — 카운터가 없다. ratchet 에 있는 것은 후퇴 사유 (`viewportFallback*` 전부 0) 와 `viewportSequences` 뿐                                                                                                                                                                                                                                                                                                                                       | `spatial_index.rs` (카운터 없음) · `perf/ratchet.json` `60:app-pages.zoom.A.render.viewport*`                           |
| F8  | 하니스 fixture 는 최대 22 페이지 (`app-pages`) — 「많은 페이지 · 넓은 배치 · 먼 페이지 이동」 fixture 가 없다. 비교 분석의 1,000 화면 가정은 **미측정**                                                                                                                                                                                                                                                                                                                                                        | `perf-baseline.mjs` fixture 목록 (`:205` · `:499 ~ 664`)                                                                |
| F9  | Pen 1.2.18: top-level 순회 · transform 무효화의 자손 전파가 있다 — 화면 내 요소 수에만 비례하지 않는다. 가져올 것은 수요 기반 범위 제한의 원칙                                                                                                                                                                                                                                                                                                                                                                 | 비교 기록 (local-only)                                                                                                  |

### 이 ADR 이 다루지 않는 것

- 절대 좌표 맵 (`boundsMap` · `hitBoundsMap`) 을 로컬 좌표 + 변환 합성으로 바꾸는 것 (ADR-264 대안 B · ADR-269 「다루지 않는 것」 그대로) — 이 ADR 뒤에도 F4 의 자손 맵 갱신이 지배적이면 별도 ADR (조건부 4 건의 넷째).
- 공간 인덱스 자료구조 교체 (R-tree · BVH) — Phase 0 카운트가 「셀 수」 가 아니라 「항목 방문」 이 지배적이라고 보일 때만 (대안 B).
- Rust ↔ JS 경계 비용 · 엔진 이관 — `CANVAS_RUST_DECISION_2026-10.md` 의 trigger 미충족 그대로.

### Hard constraints

- **HC1 결과 집합 동일**: 전략 전환 뒤 `queryRect` 의 결과 (id 집합 — 순서 무관) 와 hit-test 결과가 전환 전과 같다 (Rust unit — 무작위 1,000 질의 양 전략 대조). 미리 기록은 **무엇을** 기록하느냐가 바뀔 뿐 기록 내용 (picture) 은 같다.
- **HC2 카운트 먼저**: Phase 0 이 Rust 질의의 `cellsVisited` · `itemsVisited` · `results` 와 미리 기록의 `warmCandidatesScanned` · `warmCandidatesSorted` 를 등급 A 로 고정 (새 fixture `many-pages`), 수정과 같은 커밋에서 상한 ↓. 레버 선택은 이 몫 표로. 기준값에 **여백 값 (device px) 과 DPR** 을 함께 적는다 — ADR-273 Phase 1 뒤에는 그 커밋이 사유 (`--update` 메시지에 273 Phase 1) 와 함께 재측정한다 (F3 의존).
- **HC3 wall-clock 방향만**: production 짝에서 `many-pages` 줌 · 먼 페이지 이동 · `app-pages` 줌 · 편집 회귀 0.
- **HC4 비용 이동 금지**: 전략 전환의 판정 (셀 수 산식 1 회) 과 bounded 후보 수집이 줌 1 편집 · hover · pan 의 카운트를 올리지 않는다. 미리 기록의 카메라 추종이 **프레임 안**에 들어오지 않는다 (idle 에서만).
- **HC5 D3 대칭 · 문서 형식 변경 0**: 픽셀 · 히트 · 맵 불변 (HC1). Skia 전용 시각 효과 0.
- **HC6 wasm 표면 한정**: 질의 · hit-test 의 반환 형식 · 결과 집합 불변 (전략은 Rust 안에서 고른다). wasm-bindgen 표면 추가는 **세 가지로 한정** — 전환 비율 (생성자 인자 또는 setter, 지금 `new(cell_size)` `spatial_index.rs:48` · JS `initSpatialIndex()` `spatialIndex.ts:29` 가 인자 없음) · `take_query_stats()` dev getter · Phase 3 의 큰 항목 임계 (같은 setter). `pnpm wasm:build:engine` 산출물 재생성과 `init.ts:35` 호출부 변경이 Phase 1 커밋에 포함된다.

### Soft constraints

- 측정 5-질문: Q1 `many-pages` 는 `app-pages` 생성기로 페이지 수 · grid 간격만 키운 합성물 — **규모 전용**. Q2 불리 = 줌 0.05 (전체 보기) · 먼 페이지로 점프 (`page-switch` 뒤 팬) · 줌 중 편집. Q3 HEAD worktree. Q4 Rust 카운터가 실제 질의 경로에 꽂혔는지 (viewport · damage 둘 다). Q5 oracle = 선형 (`renderDebug.linearOnly`) 실행과 결과 집합 · 픽셀 비교 (다른 경로).
- 「O(1)」 주장 금지 — 전략 전환은 min(셀 수, 항목 수) 로 상한을 바꿀 뿐이다.

## Alternatives Considered

### 대안 A: 단계적 — 카운트 → 질의 전략 전환 (셀 상한) → 미리 기록 bounded · 카메라 추종 → 큰 항목 버킷 (채택)

- 설명: Phase 0 이 Rust 에 dev 카운터 (`query_stats`) 를 두고 `many-pages` fixture (100 · 300 페이지, grid 간격 2 종) 로 셀 방문 · 항목 방문 · 후보 수집 · 정렬의 몫을 잰다. Phase 1 — `query_rect_internal` 이 **셀 수 > K × 등록 항목 수** (B, 제안 K = 1) 면 셀 순회 대신 `bounds` 맵 선형 AABB (결과 동일, 비용 = 항목 수) 로 — 판정은 나눗셈 1 회. Phase 2 — 미리 기록 후보를 **viewport 를 반경 r (B, 제안 viewport × 2) 로 넓힌 사각형의 공간 질의**로 모으고 (전체 stream 순회 제거), 정렬은 **k 개 제한 우선순위 큐** (B, k = 남은 warm 자리), 차례 키에 **카메라 셀** (viewport 중심을 큰 셀로 양자화) 을 넣어 팬 · 줌 뒤 idle 에 새 주변부터. Phase 3 (Phase 0 이 F4 의 큰 항목 upsert 를 지목할 때만) — M 셀 (B) 넘게 덮는 항목은 셀에 넣지 않고 **큰 항목 버킷**에 두고 질의가 선형으로 덧붙인다 (page root 옮기기의 upsert 비용 = 셀 수 → 1).
- 위험: 기술 **L** (Rust 함수 안의 분기 · JS 큐) / 성능 **L** (전환은 상한을 min 으로) / 유지보수 **M** (질의 경로 2 · 큰 항목 버킷은 질의 · 제거 · 갱신 세 곳) / 마이그레이션 **L** (플래그 off = 지금).

### 대안 B: 자료구조 교체 — R-tree / BVH (Rust)

- 위험: 기술 **M** / 성능 M (갱신이 잦은 편집 · 드래그에서 재균형) / 유지보수 **H** (새 자료구조 + 갱신 경로 전부) / 마이그레이션 M.
- 기각 (여기서는): Phase 0 이 「셀 수」 가 아니라 「항목 방문 · dedup」 을 지목하면 그때 별도 ADR. 균일 grid + 전략 전환 + 큰 항목 버킷은 표준 처방이고 갱신 비용이 작다.

### 대안 C: 셀 크기를 배율에 맞춰 재구축

- 위험: 기술 L / 성능 **H** (줌 칸마다 전체 재삽입 — F4 의 upsert 가 전 요소로) / 유지보수 M / 마이그레이션 L.
- 기각: 줌 중 비용을 줄이려다 줌 자체에 전체 재구축을 넣는다.

### 대안 D: 2 단계 질의 — page root coarse → page 내부 인덱스

- 설명: page root bounds 로 먼저 거르고 page 마다 인덱스.
- 위험: 기술 M / 성능 L / 유지보수 **H** (인덱스가 page 수만큼 · page 간 이동 · 옮기기 · 삭제 전파) / 마이그레이션 M.
- 기각 (여기서는): 대안 A 의 큰 항목 버킷 + 전략 전환이 같은 상한을 더 작은 변경으로 준다. Phase 0 이 page 수 자체가 지배 변수라고 보이면 (A 의 Phase 3 뒤에도) 재검토.

### Risk Threshold Check

| 대안 | HIGH+      | 판정                                   |
| ---- | ---------- | -------------------------------------- |
| A    | 없음       | 채택                                   |
| B    | 유지보수 H | 기각 — Phase 0 결과에 따라 별도 ADR    |
| C    | 성능 H     | 기각 — 줌에 재구축                     |
| D    | 유지보수 H | 기각 — A 가 더 작은 변경으로 같은 상한 |

루프 불필요.

## Decision

**대안 A.** 위험 수용 근거: Phase 1 은 Rust 함수 한 곳의 분기 (결과 집합 동일 — HC1 unit), Phase 2 는 JS idle 경로만, Phase 3 은 Phase 0 카운트가 지목할 때만. 세 Phase 모두 플래그 (`renderDebug.boundedQueryOff` · `warmupBoundedOff`) 가 롤백이고 선형 실행 (`linearOnly`) 이 oracle 이다.

기각 사유 요약: B 는 Phase 0 결과 대기, C 는 줌에 재구축, D 는 더 큰 변경으로 같은 상한.

**사용자 결정 N 건**:

1. **`many-pages` fixture 규모** — 페이지 수 (제안 100 · 300) 와 grid 간격 (기본 · ×4). 1,000 은 하니스 시드 시간이 길어 제외를 제안.
2. **Phase 3 진입** — Phase 0 의 upsert 셀 방문 몫이 질의 몫보다 클 때만. 작으면 생략.
3. **종결 미달** — HC3 참고 목표 (`many-pages` 줌 표시 간격 p99 ≤ 20 ms) 미달 시 측정 기록 종결 또는 대안 B · D 로 (별도 ADR).

> 구현 상세: [272-bounded-spatial-query-and-warmup-work-range-breakdown.md](design/272-bounded-spatial-query-and-warmup-work-range-breakdown.md)

## Risks

| ID  | 위험                                                                                                                                          | 심각도 | 대응                                                                                                                                                 |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------- | :----: | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | 전략 전환의 두 경로가 다른 결과 (경계 포함 규칙 · 음수 좌표 floor · 0 크기 항목) 를 내 viewport 실행이 요소를 빠뜨림 (빈 자리) 또는 중복 실행 |  HIGH  | HC1 Rust property unit (무작위 1,000 · 경계 · 음수 · 0 크기) + G1 픽셀 oracle (bounded ↔ `linearOnly`). 거부 시 선형 후퇴 사유 카운터                |
| R2  | 큰 항목 버킷 (Phase 3) 이 제거 · 갱신 경로에서 누락 → 삭제된 page root 가 질의에 남음                                                         |  HIGH  | 버킷은 `upsert` · `remove` · `clear` 세 함수만이 만진다 (Rust 안) — unit: 버킷 ↔ 셀 이동 (크기 변경) · 제거 뒤 질의 0. Phase 3 은 사용자 결정 2 뒤만 |
| R3  | bounded 미리 기록이 화면 **밖**의 글자 넘침 표시를 세워 편집이 full 로 가는 ADR-266 함정 재발                                                 |  MED   | ADR-266 의 처방 (넘침은 picture 에 보관, 첫 재생에 반영) 그대로 — 후보 수집만 바뀐다. unit 재실행                                                    |
| R4  | 카메라 추종이 팬 · 줌 중 매 프레임 idle 차례를 다시 세워 준비 비용이 늘어남 (HC4)                                                             |  MED   | 차례 키 = 카메라 **큰 셀** (양자화) — 셀을 넘을 때만 재구성. idle 콜백 안에서만                                                                      |
| R5  | `many-pages` 합성물의 분포 (페이지 간 간격 · 요소 밀도) 로 B 값을 정해 실문서에서 전환점이 맞지 않음                                          |  MED   | B 값은 산식 (셀 수 vs 항목 수 비율) 이지 절대값이 아니다 (Q1). 사용자 프로젝트 「123」 (22 페이지) 에서 G5 로 확인                                   |

## Gates

| Gate | 시점        | 통과 조건                                                                                                                                                                                                                                                                                                                           | 실패 시 대안                                                                       |
| ---- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| G0   | Phase 0 끝  | Rust `query_stats` (cells · items · results · upsertCells) 가 dev getter 로 하니스 `counts.render.spatial*` 에 실리고, `many-pages` (사용자 결정 1) `zoom` (0.05 · 0.25 · 1) · `page-jump` · `pan` 부류와 `app-pages` 가 2 회 같은 값 · `warmCandidatesScanned` · `Sorted` 포함. 몫 표 (질의 셀 / 항목 / 후보 수집 / 정렬 / upsert) | 몫이 전부 작으면 (세 항목 모두 프레임 비용의 1 % 미만) 측정 기록으로 종결 (결정 3) |
| G1   | Phase 1 · 3 | **HC1** Rust property unit 1,000 + 경계 케이스 · live (headed) bounded ↔ `linearOnly` 픽셀 0 px · `many-pages` 줌 0.05 ~ 1 · 먼 페이지 점프                                                                                                                                                                                         | 차가 나는 케이스는 전환 조건에서 제외 (후퇴 사유 카운터) · R1 수리                 |
| G2   | Phase 2     | unit: 후보 = 넓힌 viewport 질의 결과 ∩ picture 가능 요소 · 큐 크기 = 남은 warm 자리 · 카메라 큰 셀이 바뀔 때만 차례 재구성 · 프레임 안 호출 0 · ADR-266 넘침 unit 재통과. **원복 RED**: 전체 순회로 되돌리면 `warmCandidatesScanned` 상한 RED · 카메라 키 제거 → 「팬 뒤 새 주변 우선」 unit RED                                    | GREEN 반증은 테스트 수정                                                           |
| G3   | Phase 1 ~ 3 | **HC2 · HC4** ratchet 같은 커밋: `spatialCellsVisited` (줌 0.05) · `warmCandidatesScanned` · `Sorted` 상한 ↓ · 줌 1 편집 · hover · pan 이내 · 결과 수 (`spatialResults`) 불변. 원복 RED = block                                                                                                                                     | HC4 위반이면 판정 비용 수리 뒤 재측정                                              |
| G4   | 종결 전     | **HC3** production 짝: `many-pages` 줌 · 점프 · `app-pages` 줌 · 편집 · 중첩 5k 편집 회귀 0, `many-pages` 줌 taskMs 방향 기록                                                                                                                                                                                                       | 회귀면 플래그 off + 원인 카운터 → 결정 3                                           |
| G5   | Implemented | live (Chrome MCP / 사용자 confirm): 사용자 프로젝트 전체 보기 → 먼 페이지로 점프 → 팬 → 편집 · 선택 (hit) · marquee · 드래그 — 빈 자리 · 늦게 그려지는 요소 0                                                                                                                                                                       | 결함은 `/fix`                                                                      |

### Live Exercise

(Implemented 승격 시 기재)

## Consequences

### Positive

- 공간 질의 비용 상한이 「셀 수」 에서 「min(셀 수, 항목 수)」 로 — 넓은 배치 · 깊은 줌아웃에서 질의가 world 면적에 묶이지 않는다.
- idle 미리 기록의 준비 비용이 화면 주변에 비례하고, 카메라가 움직이면 새 주변이 먼저 기록된다.
- 이미지 (ADR-270) · LOD (ADR-271) 처럼 「많은 페이지」 가 처음으로 하니스에 들어간다 (F8 해소).

### Negative

- Rust 질의 경로가 둘 (전략 전환) — 결과 동일 unit 이 계약을 지켜야 한다.
- 큰 항목 버킷 (Phase 3) 은 질의마다 선형 덧붙임이 늘 든다 (버킷 크기 ≈ page root 수).
- 카메라 추종은 idle 차례를 더 자주 세운다 (큰 셀 단위) — R4.
