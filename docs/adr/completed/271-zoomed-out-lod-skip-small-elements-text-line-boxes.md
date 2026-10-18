# ADR-271: 축소 개요 LOD — 투영 크기 임계 아래 요소 생략 · 글자를 줄 상자로 (Pen.dev 비교 도입 2/4)

## Status

Implemented — 2026-10-18 (**측정 기록으로 종결** — 사용자 결정 3 「측정 기록 종결」: 글자 줄 상자는 줌 0.1 에서 이득 0 · 줌 taskMs +12 ~ 16 % → Phase 1 · 2 코드를 되돌리고 Phase 0 계측만 남긴다. 아래 Phase 1 · 2 블록). 이전: Accepted — 2026-10-18 (사용자 `/execute-adr 271` — [reviews/271.md](../reviews/271.md) Round 2 pending 0 · CRITICAL/HIGH 0). 이전: Proposed — 2026-10-17 (리뷰 [reviews/271.md](../reviews/271.md) Round 1 — codex, HIGH 2 · MEDIUM 2 → 같은 날 반영: tier → **band 상한 기준 요소 상태** (H1) · 서브트리 unsafe 요약 전파 (H2) · 미리 기록 차례 키에 band (M3) · `harnessArgsFrom` 이 `--zoom` 직렬화 (M4). Round 2 — claude 수리 검증 (같은 날): HIGH 0 · MEDIUM 2 (breakdown Phase 2 에 남은 `fontSize × zoom` 실배율 분기 · 글자 넘침은 기록 때 정해지는데 서브트리 요약의 갱신 지점이 없음) · LOW 1 (「band 전환 때 2 벌 공존」 전제 — 캐시는 id 당 entry 1 개) → 반영, 설계 판독 종결 — pending 0)

> **Phase 0 종결 2026-10-18** (G0 · go — 글자만): 하니스 `zoom-ladder` · dev 카운터 `lodProj*` · `lodText*` (picture 재생 지점의 투영 크기 · 글자 투영 크기 5 구간) · ratchet run `60:app-pages@zoom0.1` · `@zoom0.25` (`runKeyOf` · `harnessArgsFrom` 이 `--zoom` 을 싣는다 — r1 M4). 고정 입력 2 회 같은 값. 몫: **0.5 px 이하 요소 — 합성 0.0 ~ 0.1 % · 사용자 프로젝트 「123」 0 / 1,589 (줌 0.1)** → 생략 레버 몫 0. **2 px 이하 글자 — 합성 32 ~ 37 % · 「123」 97 % (줌 0.1) · 5 % (0.15) · 0 (0.25 이상)** → 글자 레버만 몫이 있다 (줌 ≤ ~0.14). **범위 변경 (사용자 2026-10-18 「생략 빼고 글자만」)**: Phase 1 의 생략 판정 · 서브트리 요약 (r1 H2 · r2 M2) 을 넣지 않는다 — Phase 1 은 배율 · band 전달만, Phase 2 글자 줄 상자. R1 (생략이 넘침을 숨김) 은 대상이 사라져 해당 없음. 상세: breakdown §6 Phase 0.

> **Phase 1 · 2 측정 뒤 되돌림 2026-10-18** (G1 · A/B → 사용자 결정 3 「측정 기록 종결」): 프레임 band (상한 0.125 · 0.16 · 0.2 · 0.25, 히스테리시스 ±5 %) 를 content · damage · idle 미리 기록 · picture 키에 같은 값으로 주고, `fontSize × band 상한 < 2 px` 글자를 줄마다 글자색 상자로 그리는 구현을 마쳤다 (unit 8 · 원복 RED 5/5). G1 live (headless, DPR 1): 줌 0.2 이상 0 px · 0.1 ~ 0.15 차이 픽셀 0.09 ~ 0.38 % (결정 1 제안 오차 안), 알파 0.5 는 회색 작은 글자를 진하게 만든다. **dev A/B (`--zoom 0.1`, LOD 켬 ↔ 끔 교대)**: 줌 taskMs +12 ~ 16 % · content 기록 합 385 / 251 ms — band 경계를 지날 때마다 글자 요소 재기록 (`lodTierChanges` 38 · lod miss 9,369, 끔은 miss 0), `zoom-ladder` +10 ~ 20 %, 빠른 팬은 카운트 · flush 같음 (이득 0). 글리프 래스터는 원래 비용이 작아 줄 상자로 줄일 몫이 없다 (flush 합 같음). → Phase 1 · 2 코드 (`lodBand.ts` · 줄 상자 · picture 키 band · 미리 기록 band · `setLodOff` · `adr271-lod-live.mjs` · 하니스 `--lod-off`) 되돌림. 결정 1 · 2 는 대상이 없어졌다. 남긴 것: Phase 0 dev 카운터 · `zoom-ladder` · ratchet `@zoom` 키와 두 run. 남은 꼬리 = `drawPicture` 재생 수 (대안 C 의 몫 — C 등급, 측정 뒤 별도 ADR). 상세: breakdown §6 Phase 1 · 2.

> **후속 2026-10-18 (ADR-270 ~ 273 보완 ④)**: 위 「남긴 것」 의 Phase 0 dev 카운터 (`countLodShare` · `lodProj*` · `lodText*` · `renderScope.zoom`) 와 unit `adr271LodShare.test.ts` 를 지웠다 — 종결 뒤 읽는 곳이 없다. ratchet 7 run 의 해당 키 94 개도 뺐다 (`ratchet.json` `retired`). `zoom-ladder` · `@zoom` run 은 남는다. 아래 HC3 · 대안 A · G1 의 `setLodOff` 는 되돌린 코드의 기록이다. 상세: breakdown §후속.

- 사용자 요청: `/create-adr 남은 확정 3건 (축소 개요 LOD · 작업 범위 제한 · 메모리 예산)` (2026-10-17) — Pen.dev 1.2.18 ↔ HEAD `94c9a0d52` 비교 분석의 확정 4 건 중 **둘째**. 첫째는 [ADR-270](270-image-load-path-partial-update-off-thread-decode.md) (이미지 로드 경로), 셋째 [ADR-272](272-bounded-spatial-query-and-warmup-work-range.md), 넷째 [ADR-273](273-canvas-memory-budget-overscan-device-px-resource-cache.md). 조건부 4 건 (자산 수요 2단계 · 페이지 합성 캐시 · analytic shadow · 로컬 좌표) 은 다루지 않는다.
- 방향을 정한 사용자 원문 (ADR-270 과 같은 대화): 「pen.dev의 패턴은 … 코드에서부터 근거로 도입하는것이 맞지않나」 · 「반드시 측정이필요한 곳과 아닌곳이 있지않나」. 등급: 「안 보이는 것은 안 그린다」 는 **A** (코드 근거), 임계값 (0.5 px · 2 px) · 히스테리시스 폭 · 허용 오차는 **B** (게이트가 정한다). Pen 의 수치는 참고값이지 목표가 아니다.
- 사용자가 이미 답한 것: 측정은 착수 조건이 아니라 게이트. 「D3 대칭 = 시각 결과 동일」 은 이 ADR 에서 **허용 오차를 사용자 결정으로** 둔다 (아래 결정 1) — 0.5 px 상자도 antialias 로 픽셀에 흔적을 남기므로 0 px 차를 주장할 수 없다.
- 리뷰는 사용자가 요청할 때 `/review-adr 271` → `reviews/271.md`.

## Context

**Domain**: D3 — Builder (Skia) consumer 의 그리기 **실행** 정책. 문서 · catalog · DOM 무관. 대칭은 「같은 배율에서 Preview 도 구분하지 못하는 범위」 로 정의하고 허용 오차를 게이트가 잰다 (HC1). D1 · D2 무관.

### 코드 사실 (HEAD `94c9a0d52`)

| #   | 사실                                                                                                                                                                                                                                                                           | 경로                                                                                                                 |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| F1  | 배율은 **실행 층 밖**에서 적용된다 — renderer 가 content canvas 에 `scale(zoom, zoom)` 을 건 뒤 명령을 실행한다. `executeRenderCommands` 의 인자에 zoom 이 없다 (dev 디버그 `readCamera` 만). LOD 판정은 실행 옵션으로 zoom 을 받아야 한다                                     | `SkiaRenderer.ts:762` · `renderCommands.ts:2420 ~ 2429` · `:1479`                                                    |
| F2  | 생략은 **viewport 밖** (`cmd.visible` = false → 서브트리 jump) 뿐이다. 투영 크기 기준은 없다 — 0.3 px 로 투영된 요소도 picture 를 재생한다                                                                                                                                     | `renderCommands.ts:2556 ~ 2561`                                                                                      |
| F3  | 요소마다 `drawPicture` 1 회 (`drawSelfSpanViaPicture`). picture 키 = node data identity + width · height — **배율은 키에 없다** (picture 는 해상도 독립). 글자 LOD 처럼 **내용이 다른** 기록은 키에 tier 가 들어가야 하고, 생략은 키 없이 재생 지점에서 끝낼 수 있다           | `renderCommands.ts:2996 ~ 3045` · `nodePictureCache.ts:173`                                                          |
| F4  | 글자는 크기와 무관하게 paragraph 를 그린다 (`drawParagraphBox` → `drawParagraph`). 줄 metrics 는 paragraph 가 이미 갖고 있다 — 줄 상자 대체는 **래스터** (글리프) 비용만 줄이고 paragraph 생성 비용은 그대로 (Pen 도 LOD 분기 전에 정밀 path 를 만든다)                        | `nodeRendererText.ts:419 ~ 448` · `:356 · 379 · 412`                                                                 |
| F5  | 실측 (ratchet A, `60:app-pages` zoom 부류): `nodePicture.hits` **44,909** · `execVisited` 174,183 · `execPictureJumped` 79,892. ADR-266 종결: 줌 뒤 남은 dev 재생 p95 10.6 ~ 11.3 ms ≈ **요소 단위 picture 1,600 개 / 프레임**. 하니스 `--zoom 0.1` = 22 페이지 전부 뷰포트 안 | `apps/builder/perf/ratchet.json` · 메모리 `project-adr266-draw-cache-thrash-closed-2026-10` · `perf-baseline.mjs:25` |
| F6  | 상자 밖으로 칠하는 요소 (그림자 · 글자 넘침) 는 이미 추적된다 — `unsafeContributorsWithin` · `textPaintOverflowIds` · `hasTextPaintOverflow`. 생략 판정이 **상자 크기**만 보면 이들을 잘못 숨긴다                                                                              | `renderCommands.ts:2347 · 2283` · ADR-263 damage 후퇴 규칙                                                           |
| F7  | 선택 · hover overlay · hit-test · 내보내기는 content 와 다른 경로 (overlay 층 · `hitBoundsMap` · export 는 full 기록) — LOD 가 content 실행에만 들어가면 닿지 않는다                                                                                                           | `CatalogCanvas.tsx` overlay · `wasm-bindings/spatialIndex.ts:138`                                                    |
| F8  | Pen 1.2.18: 투영 최대 변 ≈ 0.5 px 미만 생략 · 글자 ≈ 2 px 미만이면 줄별 직사각형 · 편집 · 선택 · export 는 정밀 유지                                                                                                                                                           | 비교 기록 (local-only) — 값은 가져오지 않는다                                                                        |

### 이 ADR 이 다루지 않는 것

- 페이지 · 그룹 단위 합성 캐시 (ADR-266 대안 B) — 줄 상자로 바꿔도 요소마다 `drawPicture` 1 회는 남는다. 그 **호출 수**가 그래도 부담이면 C 등급 측정 뒤 별도 ADR. 이 ADR 은 생략으로 호출 수를, 줄 상자로 래스터를 줄인다.
- paragraph 생성 비용 (F4) — ADR-174 · 266 의 소유 · 미리 기록이 담당.
- Preview (DOM) 의 축소 표시 — 브라우저 몫.

### Hard constraints

- **HC1 허용 오차 안의 대칭**: LOD 경로 ↔ 전체 정밀 경로 (LOD off) 의 content 스크린샷 차가 **사용자 결정 1 의 허용 오차** 안 (기본 제안: 채널당 ≤ 3/255 · 차이 픽셀 비율 ≤ 0.5 %) — 줌 사다리 0.1 · 0.15 · 0.25 · 0.5 · 1 × `app-pages`. **`full` tier 구간** (히스테리시스 상단 위 — 경계 ~ 경계 × (1 + 폭) 은 정의상 아래 tier 가 남는다) 에서는 0 px 차 (LOD 가 닿지 않는다). `zoom-ladder` 의 판정 배율은 경계 구간을 피해 고른다.
- **HC2 정밀 경로 불변**: 선택 · hover · hit-test · 드래그 · 내보내기 · 텍스트 편집 중 노드 · damage 기록은 tier 와 무관하게 지금과 같다 (F7). damage 부분 기록은 content 와 **같은 tier** 로 (안 그러면 damage 영역만 선명해진다). **idle 미리 기록** (`warmNodePicture` — `renderCommands.ts:3061`, 호출 `nodePictureWarmup.ts:100`) 은 실행 옵션 **밖**에서 `recordSelfSpan` 으로 기록하므로 현재 band 를 받아 **같은 키**로 기록하고, band 가 바뀌면 **차례를 다시 세운다** — 완료 판정이 stream · revision 뿐이라 (`nodePictureWarmup.ts:140 ~ 146`) band 만 바꾸면 끝난 차례가 새 band 의 화면 밖 picture 를 만들지 않는다 (r1 M3). 안 하면 프레임 안 cold 기록 (ADR-266 이 없앤 것) 이 재발하고 `pictureWarmRecorded` 는 그대로라 게이트가 못 본다 (R7).
- **HC3 카운트 먼저**: Phase 0 이 `--zoom 0.1` 에서 picture 재생 수 · 글자 draw 수 · `execVisited` 를 등급 A 로 고정하고, 수정과 같은 커밋에서 상한이 내려간다. 새 카운터 `lodSkippedElements` · `lodTextBoxes` · `lodTierChanges`.
- **HC4 비용 이동 금지**: 판정 비용 (투영 크기 계산 · 서브트리 bounds 조회) 이 임계 **위** 배율 (zoom 1 편집 · hover · pan) 의 카운트 · taskMs 를 올리지 않는다. 임계 위에서는 판정이 요소당 곱셈 1 · 비교 1 이어야 한다.
- **HC5 히스테리시스**: tier 경계에서 배율이 ±폭 (B) 안을 오가도 tier 가 바뀌지 않는다 — `lodTierChanges` 가 줌 왕복 fixture 에서 경계 통과 수와 같다 (진동 0).
- **HC6 D3 금지 유지**: Skia 전용 **효과** 도입 0 — 생략 · 단순화만, 새 시각 요소 (예: 축소 시 테두리 강조) 없음. 문서 · 저장 형식 변경 0.

### Soft constraints

- 측정 5-질문: Q1 `app-pages` 합성 — 규모 전용. Q2 불리 = 작은 요소가 많은 페이지 (아이콘 · 배지 · 표 셀) 에서 줌 0.1 과, 임계 바로 위 (tier 전환 직후) 프레임. Q3 HEAD worktree. Q4 zoom 이 실행 옵션으로 실제 전달되는지 unit. Q5 oracle = LOD off 경로 (다른 경로) + Preview 같은 배율 스크린샷 1 건 (외부).
- 「O(1)」 주장 금지. 생략은 요소 수에 비례하는 일을 **보이는 요소 수**로 줄일 뿐이다.

## Alternatives Considered

### 대안 A: 재생 지점 판정 (생략은 키 없이, 글자 tier 는 키에) — 단계적 (채택)

- 설명: `RenderCommandExecutionOptions` 에 `lod: { zoom, band }` 를 더한다. **band** = 이산 배율 띠 (B, 제안 `[0.1, 0.2)` · `[0.2, 0.4)` · `[0.4, 0.8)` · `[0.8, ∞) = full`, 경계에 히스테리시스 ±폭) — renderer 가 프레임당 1 회 정해 content · damage · idle 미리 기록에 같은 값을 넘긴다. **요소의 LOD 상태는 band 의 상한 배율로 정한다** (r1 H1 — 같은 띠 안에서 배율이 움직여도 상태가 바뀌지 않아 picture 키가 완성된다): (a) **생략**: 투영 최대 변 = `max(width, height) × zoom` (실제 배율) < T_skip (B, 제안 0.5 px) 이고 stream 이 build · splice 때 요약해 둔 **서브트리 요약** (`lodSubtreeUnsafe` = 자손 중 하나라도 `damageUnsafeElementIds` · `textPaintOverflowIds` · 글자 범위 미확정 — damage 경로가 요소마다 검사하는 것과 같은 조건, `subtreeCommandPatch.ts:593 ~ 601` · 서브트리 hit bounds 합집합) 이 「안전 + 합집합 투영 < T_skip」 이면 서브트리 jump (F2 와 같은 자리) — picture 조회 없음, 키 없음. `boundsMap` 은 레이아웃 상자이고 `getSubtreeDamageBounds` 는 hit 합집합이라 paint 범위가 아니다 (r1 H2) — 요약 플래그가 보수적으로 막는다. 글자 넘침은 **기록 때** 정해지므로 (`textPaintOverflowIds` 는 기록 끝 · 미리 기록 반영에서 갱신 — `renderCommands.ts:2956 · 2398`) 요약은 「미확정 글자 수 · 넘침 글자 수」 를 들고 있다가 그 두 지점에서 owner 의 조상 체인을 갱신한다 — 갱신 없이는 글자를 가진 서브트리가 영원히 미확정이라 생략 0 (r2 M2). (b) **글자**: `fontSize × bandUpper` < T_text (B, 제안 2 px) 이면 `renderText` 가 paragraph 의 줄 metrics 로 줄 상자 (글자색 · 줄 높이 × 폭, 알파 = 밀도 근사 B) — picture 키 = (dataRef, w, h, **band**) 이되 그 band 에서 줄 상자가 되는 글자가 하나라도 있는 요소만 band 를 키에 넣고 나머지는 `full` 로 정규화 (키 분기 0). band 전환 때 **미리 기록 차례 재시작** (pass 키에 band — r1 M3). 옛 band 의 entry 는 해제하지 않는다 — 캐시는 요소 id 당 entry 1 개라 band 가 다르면 miss 이고 다음 기록이 그 자리를 교체한다 (`nodePictureCache.ts:191 · 207`, r2 L3). 편집 중 노드 · drag 서브트리 · export 는 `band = full` 고정.
- 위험: 기술 **L** / 성능 **L** (판정은 곱셈 1 · 비교 1, unsafe 집합은 이미 있다) / 유지보수 **M** (tier 가 picture 키 · renderText · damage 세 곳에 들어간다) / 마이그레이션 **L** (플래그 off = 지금).

### 대안 B: 기록 시 판정 — picture 키에 zoom 연속값

- 설명: picture 를 배율별로 기록 (키에 zoom).
- 위험: 기술 L / 성능 **H** (줌 한 칸마다 전부 miss — ADR-266 이 막 없앤 thrash 재발) / 유지보수 M / 마이그레이션 L.
- 기각: ADR-266 의 결론 (줌 중 재기록 0) 과 정면 충돌. tier 는 2 단계 이산값이어야 한다 (대안 A 의 b).

### 대안 C: 페이지 · 그룹 합성 캐시 (ADR-266 대안 B)

- 위험: 기술 **M** / 성능 **M** (묶음 생성 · 무효화 비용, 편집 많은 문서 역효과) / 유지보수 **H** / 마이그레이션 M.
- 기각 (여기서는): C 등급 — 대안 A 뒤에도 `drawPicture` 호출 수가 지배적일 때 측정 뒤 별도 ADR.

### 대안 D: 축소 시 content 를 저해상도 surface 에 그려 확대 표시 (해상도 LOD)

- 위험: 기술 L / 성능 M / 유지보수 L / 마이그레이션 L — **시각 H**: 전 화면이 흐려진다 (사용자 가시 · D3).
- 기각: 요소별이 아니라 화면 전체 품질을 깎는다. ADR-273 의 메모리 축에도 맞지 않는다.

### Risk Threshold Check

| 대안 | HIGH+      | 판정                     |
| ---- | ---------- | ------------------------ |
| A    | 없음       | 채택                     |
| B    | 성능 H     | 기각 — thrash 재발       |
| C    | 유지보수 H | 기각 — C 등급, 측정 뒤   |
| D    | 시각 H     | 기각 — 전 화면 품질 저하 |

루프 불필요.

## Decision

**대안 A.** 위험 수용 근거: 바뀌는 것은 content 실행의 판정 두 줄과 글자 그리기의 분기 하나, picture 키의 tier 하나다. 임계 위 배율에서는 지금과 같은 경로이며 (HC4), 플래그 (`__composition_RENDER_PATH_DEBUG__.setLodOff`) 가 live oracle 이자 롤백이다. 허용 오차는 **사용자 결정 1** 로 둔다 — 0 px 를 주장하지 않는다.

기각 사유 요약: B 는 thrash 재발, C 는 C 등급 (측정 뒤), D 는 화면 전체 품질 저하.

**사용자 결정 N 건**:

1. **허용 오차** — HC1 의 채널당 delta · 차이 픽셀 비율 · 적용 배율 상한 (제안: ≤ 3/255 · ≤ 0.5 % · tier 가 바뀌는 배율은 0.5 이하에서만). Preview 와 같은 배율 스크린샷 1 건을 판단 자료로 함께 보인다.
2. **줄 상자의 모양** — 글자색 단색 (알파 = 밀도 근사 B) vs 줄 높이의 절반 두께. 기본은 단색 · 줄 높이 × 0.6 (Pen 은 줄별 직사각형).
3. **종결 미달** — HC3 목표 (`--zoom 0.1` picture 재생 ↓ 30 % 이상 — 참고) 미달 시 측정 기록 종결 또는 대안 C 로.

> 구현 상세: [271-zoomed-out-lod-skip-small-elements-text-line-boxes-breakdown.md](../design/271-zoomed-out-lod-skip-small-elements-text-line-boxes-breakdown.md)

## Risks

| ID  | 위험                                                                                                                                                                                                      | 심각도 | 대응                                                                                                                                                                                                                                                                                                      |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----: | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | 작은 부모 아래 큰 overflow 자식 · 그림자 · 두꺼운 선을 생략이 함께 숨김 (F6) — `boundsMap` 은 레이아웃 상자, `getSubtreeDamageBounds` 는 hit 합집합이라 paint 범위가 아니고 unsafe 는 요소 단위다 (r1 H2) |  HIGH  | 생략 판정은 **서브트리 요약** (build · splice 때 자손의 unsafe · 글자 넘침 · 범위 미확정을 조상까지 전파, 넘침이 기록 때 확정되면 조상 체인 갱신 — r2 M2) + hit 합집합 투영 — 요약이 「안전」 일 때만. G1 배치에 「3 px 부모 + 40 px 그림자 자식」 · 「그림자만 보이는 요소」 를 넣고 `full` 구간 0 px 차 |
| R2  | damage 부분 기록과 content 가 다른 tier 로 그려져 영역만 선명 · 흐림                                                                                                                                      |  HIGH  | tier 는 renderer 가 프레임당 1 회 정해 두 경로에 같은 값 (HC2). G2 unit: damage 뒤 픽셀 = full 재기록 픽셀 (같은 tier)                                                                                                                                                                                    |
| R3  | 경계 배율에서 tier 진동 → 줌 중 깜빡임                                                                                                                                                                    |  MED   | 히스테리시스 (HC5) + 줌 왕복 fixture 카운트                                                                                                                                                                                                                                                               |
| R4  | 줄 상자 알파가 실제 글리프 밀도와 달라 축소 화면의 명암이 바뀜 (사용자 가시)                                                                                                                              |  MED   | 사용자 결정 2 · HC1 오차 안에서 B 값 조정 · Preview 같은 배율 비교                                                                                                                                                                                                                                        |
| R5  | 내보내기 · 썸네일 · Compare Mode 가 LOD tier 로 그려짐                                                                                                                                                    |  MED   | export · drag 서브트리 · 편집 중 노드는 `tier = full` 고정 (HC2). unit 으로 export 경로의 옵션 확인                                                                                                                                                                                                       |
| R7  | idle 미리 기록이 tier 를 모르고 full 로 기록 → textbox 조회 miss · 자리만 차지 (HC2)                                                                                                                      |  MED   | `nodePictureWarmup` 의 source 에 renderer 의 현재 band 보관 · pass 키에 band · `warmNodePicture(…, band)` (`hasNodePicture` 도 band 비교) · G2 unit                                                                                                                                                       |
| R8  | tier 를 카메라 한 값으로 두면 같은 tier 안에서 `fontSize × zoom` 분기가 바뀌어 hit 가 옛 표현을 재생 (2 px 이상 글자가 상자로 남음) (r1 H1)                                                               |  HIGH  | 요소 상태 = **band 상한**으로 이산화 (대안 A) — content · damage · 미리 기록이 같은 band 입력. G2 unit: 같은 band 안 두 배율에서 hit 유지 · 경계 통과에서만 재기록                                                                                                                                        |
| R6  | 판정 비용이 임계 위 배율에 남음 (HC4)                                                                                                                                                                     |  LOW   | 임계 위에서는 `zoom ≥ Z_full` 한 번 비교로 LOD 분기 전체 건너뜀                                                                                                                                                                                                                                           |

## Gates

| Gate | 시점        | 통과 조건                                                                                                                                                                                                                                                                                                                                          | 실패 시 대안                                                                   |
| ---- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| G0   | Phase 0 끝  | `app-pages` `--zoom 0.1` · `0.25` 와 줌 왕복 부류 (`zoom-ladder`) 가 하니스에 있고 `--fixed-inputs --call-counts` 2 회 같은 값: picture 재생 (`nodePicture.hits`) · 글자 draw 수 · `execVisited` · 투영 크기 분포 (요소 수 by 0.5 · 1 · 2 · 4 px 구간)                                                                                             | 분포에서 임계 아래 요소가 전체의 5 % 미만이면 생략의 몫이 없다 → 사용자 결정 3 |
| G1   | Phase 1 · 2 | **HC1** live (headed Playwright): LOD ↔ `setLodOff` content 스크린샷 — 사다리 5 배율 × `app-pages` + R1 배치 2 — 사용자 결정 1 오차 안, 임계 위 0 px. Preview 같은 배율 1 건 첨부                                                                                                                                                                  | 오차 초과 배율은 그 tier 를 끈다 (B 값 상향) — 전부 초과면 사용자 결정 3       |
| G2   | Phase 1     | **HC2 · R2** unit: tier 가 content · damage 에 같은 값 · export · drag · 편집 중 노드 `full` · 히스테리시스 진동 0 · `full` tier 구간에서 `lodSkippedElements` 0 · 미리 기록이 현재 tier 키로 기록 (textbox 구간에서 warm 뒤 content 조회 hit). **원복 RED**: paint bounds 대신 상자 크기로 바꾸면 R1 배치 unit RED · tier 공유를 떼면 R2 unit RED | GREEN 반증은 테스트 수정                                                       |
| G3   | Phase 1 · 2 | **HC3 · HC4** ratchet 같은 커밋: `--zoom 0.1` picture 재생 · 글자 draw 상한 ↓ · zoom 1 편집 · hover · pan 카운트 Phase 0 이내 · `lodTierChanges` = 경계 통과 수. 원복 RED = ratchet block                                                                                                                                                          | HC4 위반이면 임계 위 조기 탈출 (R6) 수리 뒤 재측정                             |
| G4   | 종결 전     | production 짝 (교대 2 쌍): `app-pages` 줌 (기본 · `--zoom 0.1` · ladder) 표시 간격 p99 · long task · taskMs 회귀 0, 줌아웃 taskMs 는 방향 기록                                                                                                                                                                                                     | 회귀면 플래그 off + 원인 카운터 → 사용자 결정 3                                |
| G5   | Implemented | live (Chrome MCP / 사용자 confirm): 사용자 프로젝트 22 페이지 전체 보기 (줌 ≤ 0.15) → 줌인 → 편집 → 선택 · hover · Compare Mode · export 1 회 — 축소 화면 명암이 Preview 와 다르지 않다는 사용자 판정                                                                                                                                              | 「다르다」 면 사용자 결정 1 · 2 재조정                                         |

### Live Exercise

- **2026-10-18 Phase 0 — 사용자 프로젝트 「123」 (22 페이지, Chrome MCP · DPR 2 · visible)**: 줌 0.1 · 0.15 · 0.25 · 0.5 · 1 에서 `forceFull` 1 회씩 투영 크기 분포를 읽었다 — 줌 0.1 재생 1,589 · 0.5 px 이하 요소 0 · 2 px 이하 글자 1,171 / 1,204. 측정 뒤 원래 카메라로 복원, 콘솔 오류 0.
- **2026-10-18 Phase 1 · 2 (되돌린 구현) — headless Playwright (`adr271-lod-live.mjs`, DPR 1, `app-pages`)**: 줌 사다리 7 배율에서 LOD ↔ `setLodOff` content 스크린샷 비교 — 0.2 이상 0 px (4/4) · 0.1 ~ 0.15 차이 0.09 ~ 0.38 % · 알파 · 높이 후보 4 개 비교. 같은 형태의 dev A/B (`perf-baseline` 교대 3 쌍 + 팬 2 쌍) 가 결정 3 의 근거.
- **최종 상태 (Phase 0 계측만, 동작 변경 0)**: 되돌린 뒤 type-check 0 · canvas · catalogRuntime 412 파일 3,312 PASS · ratchet `60:app-pages@zoom0.1` · `@zoom0.25` 재등록 (아래 breakdown).

## Consequences

### Positive

- 축소 개요에서 요소 단위 picture 재생과 글리프 래스터가 **보이는 것**에 비례한다 — ADR-266 이 남긴 꼬리 (재생 1,600 개 / 프레임) 의 첫 번째 레버.
- 임계 위 배율은 경로가 같다 — 편집 화면 비용 불변.

### Negative

- 축소 화면이 정밀 렌더와 **허용 오차 안에서** 다르다 (사용자 결정 1) — 처음으로 Builder 가 의도적으로 근사를 그린다.
- picture 키에 band 가 들어간다 — 캐시는 요소 id 당 entry 1 개 (`nodePictureCache.ts:191` 조회 · `:207` 저장은 교체) 라 band 가 다른 entry 는 miss 이고 다음 기록이 교체한다 (2 벌 공존 · 퇴거 없음 — r2 L3). band 경계를 지나는 프레임에 화면 안 글자 요소가 1 회 재기록되고, 화면 밖은 재시작된 미리 기록 차례가 채운다 (HC2).
- tier 를 content · damage · 글자 · export · idle 미리 기록 다섯 곳이 같이 읽어야 한다 — 어긋나면 R2 · R7.
