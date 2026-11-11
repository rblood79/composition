# ADR-307 breakdown — 문서 열기 단계별 빌드

> 본문: [307-staged-document-open-page-shells.md](../completed/307-staged-document-open-page-shells.md). 측정 배경: [CANVAS_PERF_SCALING_2026-11](../../explanation/research/CANVAS_PERF_SCALING_2026-11.md) §10. 원자료: `.agent/runs/2026-11-11-canvas-perf-scaling/cold-ab/` (로컬).

## 1. 분리 판정 (fork checkpoint)

이 ADR 은 기존 ADR 의 분리가 아니다 — 조사 문서의 3단계를 새로 여는 것이고, 1 · 2단계는 ADR 없이 끝났다. 네 질문은 해당 없음으로 닫는다.

1. base / 응용: 해당 없음 (선행 ADR 없음). 닿는 계약은 ADR-248 (catalog runtime 의 편집 파이프라인) 이고 그 순서 · 원자성을 그대로 따른다 (HC2).
2. schema: 문서 · 저장 형식 변경 0.
3. 선행 전제: ADR-263 ~ 273 (그리기 층을 화면 넓이에 묶음) 의 결과 위에서, 남은 비례 자리 (열기) 를 다룬다. 의존 방향 반전 없음.
4. 판독에 미룬 전제 없음 — 미확정은 본문 「사용자 결정 4건」 과 G0 로 모았다.

## 2. 용어

- **틀 (shell)**: page root record 하나와 엔진의 frame 크기 잎. 자식 record 없음.
- **채움 (fill)**: 틀 page 의 subtree 를 해석 · 배치 · Canvas 에 반영하는 일. 문서 밖 (revision · History · 저장 무관).
- **채움 단위 (region)**: page root 의 직계 자식 subtree 하나. 문서 노드 수가 상한을 넘으면 그 자식들로 내려간다. 단위 하나 = 해석 + 엔진 반영 + 전달 = 한 task (원자적). 이어 갈 준비물 없음 — 다음 단위는 「문서의 자식 − record 의 자식」.
- **동기 요청**: 그 page 의 남은 단위를 끝까지. page 전환 · 그 page 의 노드 선택 · 명령 대상.
- **비동기 요청**: 큐의 순서만 바꾼다. 화면 진입.
- **idle 채움**: 나머지 page 를 단위마다 양보하며.
- **전부 채워짐**: 종착 상태. 이때부터 root 는 지금과 같다.

## 3. Phase

### Phase 0 — 실측 · 인벤토리 (G0)

코드 변경은 dev 계측뿐.

- 0-1 **틀 열기의 바닥**: dev 스위치로 `pageRoots()` 가 현재 page 만 내게 해 22 · 66 장 · 1x · 4x 열기를 잰다 (production 하니스 빌드). page 수와 무관한 몫이 본문 추정 (≈ 0.6 s / 2.6 s) 과 맞는지, 66 / 22 배율이 1.1 이하로 **될 수 있는지**.
- 0-2 **증분 채움 비용**: 같은 스위치로 연 뒤 page 한 장을 `createPage` 가 쓰는 증분 경로로 넣었을 때의 시간 · 엔진 호출 수를 일괄 빌드의 page 당 비용 (25.5 ms) 과 비교. 1.5배를 넘으면 엔진 subtree 일괄 추가 (`add_subtree`) 를 Phase 1 범위에 넣는다 (R5).
- 0-3 **전체 순회 소비자 인벤토리**: `domInputs` · `canvasInputs` · `recordsOfSource` · `sourceInstances` · `pageRootRecords` · `getGeometry` 를 전체로 읽는 자리 전부 (본문 F8 은 grep 1회 결과 — `apps/builder/src` · `packages/shared/src`). 자리마다 「틀 page 에서 빠져도 되는가 / 채워짐 구독 / 요청 채움」 을 표로.
- 0-4 **내용 높이 page 판정식**: `pageFrameStyle` 이 높이 · 폭을 고정하지 않는 조건 (root 가 `sizing.height` · `visual.height` · `sizing.width` · `visual.width` 를 작성, 그리고 그 값이 내용에 달린 키워드) 을 식으로. page `placement` (자유 배치) 와 horizontal 방향의 `auto` 열도 본다 — 틀의 자리가 내용 없이 정해지는 조건을 닫는다.
- 0-5 **글꼴 경로**: 열기 1회에서 `refreshFonts` 가 몇 번 도는지 (`docCounters.rootReplaced`) · 어떤 face 가 늦게 오는지. 선택지 (a) 문서 entry 에서 글꼴 요청을 미리 읽는다 (record 없이 — `visual.fontFamily` · `fontWeight` · rule 기본값) (b) 도착 시 그 글꼴을 쓰는 글자 leaf 만 다시 측정. 측정 뒤 하나를 고른다.
- 0-6 **실문서 대표성**: 사용자 프로젝트 1개 이상에서 page 수 · page 당 record 수 · 내용 높이 page 수 (읽기만).
- 0-8 **단위 비용 (G0 ⑥ — 리뷰 h1)**: 실제 채움 1회를 잰다. fixture — 보통 page · 1,000 행 바운드 Table · 깊은 중첩 instance · 직계 자식 하나가 page 전체 · 한꺼번에 화면에 들어오는 page 20 장. 값 — 단위 1회 · 동기 요청 (page 한 장의 남은 단위 전부) 의 1x · 4x task 시간, 같은 owner 의 지금 데이터 갱신 task (대조군). 단위 분할을 `flatten` 의 `ownedChildren` 선택으로 표현할 수 있는지 — body 가 layout 정의의 instance (slot 채움) 인 page 포함. 문서 노드 수 상한의 초깃값도 여기서 정한다.
- 0-7 **`ready` 재정의 초안**: 「현재 page 채워짐 + 그 뒤 첫 프레임」 을 페이지가 알리는 표지 (`performance.mark` 또는 dev · 하니스 빌드 전역) 와 「전부 채워짐」 표지. old 빌드에는 두 표지가 같은 시각.

### Phase 1 — root 의 틀 · 채움 (G1)

| 파일                                                                                          | 변경                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/shared/src/catalog/runtime/compositionRoot.ts`                                      | `loadInitial` 을 「틀 세우기 + 첫 채움 집합」 으로. root 별 채움 상태 (`fillStates`). `fill(rootId, { deadline?, unitLimit?, retryFailed? })` — 한 task: 단위 여러 개의 region 재해석 (`flatten` 의 `include` 선택 → `apply`) 뒤 배치 · 전달 1회, `refreshRows` 와 같은 journaling. `deadline` 없이 부르면 남은 단위를 끝까지 (동기 요청). apply 실패는 journal 원복 + 「채움 실패」 표시 (revision 이 같으면 재시도 없음), 전달 실패는 record 유지 + 오류 모음 (리뷰 m1). `pendingFillRoots()` · `pageOfRoot` · `subscribeFill`. 옵션 `stagedLoad` (기본 꺼짐 — Builder 만 켬) |
| `packages/shared/src/catalog/runtime/persistentLayoutTree.ts`                                 | (0-2 결과: 불필요) subtree 일괄 추가                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `packages/engine/**`                                                                          | (G1 결과: 변경 없음) `add_node` 증분의 grid · 중첩 컨테이너 배치 수리 · subtree 일괄 추가                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `catalogRuntime/__tests__/stagedLoadEquivalence.test.ts` · `stagedLoadFailure.test.ts` (신규) | 채움 순서 3가지 × 단위 크기 2가지 (자리 통째 · 상한 3) × fixture 의 record · geometry 대조 · 실패 경계 2                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |

- 틀 record 는 `flatten` 의 `include` 선택으로 root 만 해석한다 (F5). `collapsedIds` · instance 인 body (page layout — body 가 layout 정의의 instance) 의 접힌 층을 틀에서도 같게 내는지 확인.
- 채움 단위의 `rewrap` · `settleTagRows` · `settleOverlays` 범위를 그 region 으로 한정. 일부만 반영된 부모의 중간 배치는 판정 대상이 아니다 — 마지막 단위 뒤의 결과만 일괄 빌드와 같아야 한다.
- 첫 채움 집합 = 내용 높이 page (0-4) + 호출자가 넘긴 page (세션의 현재 page — workspace 가 root 를 만들기 전에 알 수 있는 값: 저장된 세션 page 또는 첫 page).

### Phase 2 — 스케줄 · 요청 채움 · 채움 중 편집 (G2)

| 파일                                                           | 변경                                                                                                                                                                                                                                                                                                                                                              |
| -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/builder/src/builder/catalogRuntime/workspace.ts`         | 스케줄러 (선례 `skia/nodePictureWarmup.ts` — deadline 을 확인하며 이어 가는 방식. 여기서는 단위 하나가 한 task 이고 단위 사이에만 양보) · `ensurePage(pageId)` (동기 — 남은 단위 전부) · `prioritizePages(pageIds)` (비동기 — 큐 순서만) · session 의 page 전환 · 선택 · `execute` 진입에서 대상 page 확인 · root 교체 때 스케줄 취소 → 새 root                   |
| `compositionRoot.ts` (`plan` · `apply`)                        | 아직 반영하지 않은 region 의 source 를 건드리는 step 은 그 region 만 건너뛴다 (records 없음 — 그 단위가 반영될 때 최신 문서를 읽는다). 같은 page 의 이미 반영된 region 은 지금 경로 그대로 갱신한다 (틀 · 채우는 중인 page 전체를 건너뛰지 않는다 — 본문 R2). 구조 명령이 미반영 region 안으로 노드를 옮기는 경우 (page 간 이동 포함) 는 대상 page 를 먼저 채운다 |
| `catalogRuntime/session.ts`                                    | `identityExists` — 미반영 region 의 identity 는 그 page 의 채움을 요청한 뒤 판정                                                                                                                                                                                                                                                                                  |
| `catalogRuntime/__tests__/stagedLoadInterleave.test.ts` (신규) | 단위 사이에 편집 · undo · redo · 삭제 · 원본 편집 · 데이터 갱신 · breakpoint 전환 · 오류 주입 2종 (엔진 반영 · Canvas 구독자)                                                                                                                                                                                                                                     |

- 화면 진입 판정은 Canvas 가 한다 (Phase 3) — workspace 는 `ensurePage` · `prioritizePages` 와 큐만 가진다. 화면 진입은 `prioritizePages` 다 (동기 아님).

### Phase 3 — Canvas · 글꼴 · root 교체 (G3)

| 파일                                                                               | 변경                                                                                                                                                                                  |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/builder/src/builder/catalogRuntime/canvasBinding.ts` · `canvasScene.ts`      | 틀 root 를 묶는다 (page 배경 · frame). 채움은 그 root 의 subtree 변경으로 들어온다 — 부분 갱신 (`update().rebound`) 으로 받는지 확인하고, 전체 재묶음이 되면 root 단위 splice 를 둔다 |
| `apps/builder/src/builder/workspace/canvas/catalog/CatalogCanvas.tsx`              | 카메라 · page frame 으로 화면에 걸친 틀 page 를 찾아 `prioritizePages` (비동기). 전달 실패 뒤의 재묶음. 틀 page 의 모습 (사용자 결정 1)                                               |
| `apps/builder/src/builder/main/CatalogBuilderCore.tsx` · `fonts/catalogFontUse.ts` | 글꼴 경로 (0-5 의 선택)                                                                                                                                                               |
| `workspace.ts` (`replaceRoot` · `refreshFonts`)                                    | 새 root 도 단계별 — 현재 page 부터                                                                                                                                                    |

### Phase 4 — 전체 순회 소비자 · 하니스 · 측정 (G4 · G5)

| 파일                                                               | 변경                                                                                                                                                                                                     |
| ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0-3 표의 자리들                                                    | 「채워짐」 구독 또는 요청 채움                                                                                                                                                                           |
| `catalogRuntime/__tests__/stagedLoadReaders.static.test.ts` (신규) | record 맵 전체 순회 자리의 허용 목록 (새 자리는 실패)                                                                                                                                                    |
| `apps/builder/scripts/perf-baseline.mjs`                           | `ready` = 현재 page 채워짐 + 첫 프레임 · 「전부 채워짐」 시각 기록 · 채움 중 pan 부류 (`fill-pan`) · 채움 중 축소 (`fill-zoom-out`) · 채움 전 page 전환 (`fill-page-switch`) · `--top-fn` (상위 함수 수) |
| `apps/builder/scripts/perf-ratchet-gate.mjs` 기준                  | 갱신 (같은 커밋)                                                                                                                                                                                         |
| `docs/explanation/research/CANVAS_PERF_SCALING_2026-11.md`         | §11 결과                                                                                                                                                                                                 |

### Phase 5 — live · 종결 (G6)

- 큰 문서 (66 장 fixture + 사용자 프로젝트) 를 dev · 4x 에서 열어: 현재 page 먼저 → 축소하면 채워지는 page → 채우는 중 page 전환 · 편집 · undo → breakpoint 전환 → 새로고침.
- CHANGELOG · README · 본문 `### Live Exercise`.

## 4. 추정 규모

- 소스 ≈ 10 파일 (root · layout tree · workspace · session · binding · scene · Canvas · BuilderCore · 글꼴 · 하니스) + 엔진 0 ~ 2 + 테스트 3 신규. 0-3 인벤토리가 소비자 수를 정한다 — 추정과 1.5배 이상 벌어지면 Phase 0 보강 커밋으로 흡수한다 (새 ADR 사유 아님).

## 5. 열어 둔 질문 (Phase 0 가 닫는다)

- page layout (body 가 layout 정의의 instance) 인 page 의 틀 — 접힌 층을 가진 root record 를 자식 없이 만들 수 있는가.
- fixed · portal · Sheet 처럼 page 층에 그려지는 자손이 있는 page 를 채울 때 Canvas 의 top layer 순서.
- Compare Mode 의 `rootFilter` (현재 page 만) 와 채움 우선순위의 관계 — 같은 집합 개념으로 합칠 수 있는가.
- 데이터 갱신 (`refreshRows`) 의 독자 탐색이 `sourceInstances` 를 읽는다 — 틀 page 의 독자는 채울 때 최신 행을 읽으므로 건너뛰어도 되는지.

## 6. 기록

### Phase 0 — 실측 · 인벤토리 (2026-11-11, main `2ec4e94d4` + 계측 probe)

조건: production 하니스 빌드 (`pnpm perf:build-dist`, `/private/tmp/perf-dist-307p0`) · headless Chrome · `many-pages` 22 · 66 장 (같은 storage state — §10 측정과 같은 문서) · 일괄 (`full`) 과 틀 (`shells`) 을 full → shells → shells → full 로 번갈아 조건마다 6회 · `ready` 중앙값. 계측: root 옵션 `stagedProbe` (하니스 빌드 + `localStorage["composition:adr307-probe"] = "shells"` 일 때만 — 첫 page 는 일괄, 나머지는 root record 만) 와 `probeFill` (깊이 우선 단위 채움 — `refreshRows` 와 같은 journal · apply · deliver). 원자료 · 스크립트: `.agent/runs/20261111-104335-adr-307-adr-307-phase-0-g0/` (로컬).

**0-1 틀 열기 (G0 ①)**

| 문서 · CPU | 일괄 (지금) | 틀 (현재 page 만) | 범위 (일괄 / 틀)              |
| ---------- | ----------: | ----------------: | ----------------------------- |
| 22 장 · 1x |    1,129 ms |            573 ms | 1,123 ~ 1,139 / 560 ~ 583     |
| 22 장 · 4x |    4,326 ms |          2,070 ms | 4,293 ~ 4,376 / 2,054 ~ 2,105 |
| 66 장 · 1x |    2,248 ms |            770 ms | 2,234 ~ 2,275 / 761 ~ 780     |
| 66 장 · 4x |    8,858 ms |          2,741 ms | 8,740 ~ 9,044 / 2,711 ~ 2,815 |

- 틀의 66 / 22 배율 = **1.34 (1x) · 1.32 (4x)** — G0 ① 의 1.1 에 닿지 않는다. 남은 기울기는 page 당 4.5 ms (1x) · 15 ms (4x) 이고 전부 workspace 가 서기 **전** 이다 (`boot.workspace` 표지 22 → 66 장: 431 → 620 ms, 그 뒤 구간은 142 → 150 ms 로 평평). 프로필 (1x, 1회 — 방향만): `storage.load` 54 → 138 ms (`createCatalogGraph` 49 → 122 ms — `validateView` · `validateCatalogEntry` · `ownedRecord`) + IndexedDB 읽기. `loadInitial` 은 83 → 84 ms 로 page 수와 무관해졌다. 즉 「page 수와 무관한 몫」 이라던 것 안에 **문서 읽기 · 검증** 이라는 둘째 비례 자리가 있다 (본문 Decision 의 범위 밖).
- 절대값: 66 장 4x 2.74 s (사용자 결정 2 (a) 의 3.0 s 안 — 여유 0.26 s ≈ 17 장), 1x 0.77 s. 이 기울기면 4x 는 약 83 장, 1x 는 약 560 장에서 3초.
- 틀 단계의 page frame 22 개 자리 = 일괄 빌드 (차이 0) — F4 확인.

**0-2 증분 채움 비용 (R5)** — page 한 장을 한 번에 채움 (66 장 문서, page 65 장 × 2회)

| CPU | root (해석 · 엔진 · 전달) p50 / p95 / 최대 | record 당 | 일괄의 page 당 (열기 기울기 − 문서 읽기) |
| --- | -----------------------------------------: | --------: | ---------------------------------------: |
| 1x  |                      16.3 / 40.4 / 85.8 ms |     68 µs |                                  20.9 ms |
| 4x  |                    65.8 / 136.9 / 286.5 ms |    274 µs |                                  87.7 ms |

- page 당 평균 19.2 ms (1x) · 77.7 ms (4x) — 일괄의 0.9배. 엔진 호출 (65 장): `addNode` 18,402 · `updateChildren` 18,467 · `computeLayout` 115. **1.5배를 넘지 않으므로 엔진 subtree 일괄 추가는 Phase 1 범위에 넣지 않는다.**
- 동치 (R1 선행 확인): 22 장 6,317 record 의 id · 부모 · 자식 순서 · geometry · `derivedProps` · `hidden` 이 일괄 빌드와 **차이 0** — page 통째 · 단위 상한 150 · 40 세 가지 모두. 채운 뒤 Canvas stream 상자 6,317 개도 재묶음 (`rebuild`) 결과와 차이 0. fixture 는 flex · grid · 팔레트 원본 instance (Table · Tabs · Calendar · TagGroup …) 를 담는다. G1 의 fixed · sticky · overlay · 내용 높이 page · 채움 순서 3 가지는 Phase 1 테스트 몫.

**0-8 단위 비용 (G0 ⑥)** — 단위 = 「문서 노드 수 ≤ 상한」 인 owned subtree, 넘으면 그 노드를 틀로 넣고 자식으로 내려감 (66 장, 1회)

| 상한 (문서 노드) | 단위 수 |   1x p50 / p95 / 최대 |     4x p50 / p95 / 최대 | 4x 100 ms 초과 | 전체 root 합 (4x) |
| ---------------: | ------: | --------------------: | ----------------------: | -------------: | ----------------: |
|        page 통째 |      65 | 16.4 / 36.4 / 70.8 ms | 70.3 / 135.3 / 284.6 ms |              5 |             5.2 s |
|              150 |     592 |  1.8 / 14.3 / 23.8 ms |   8.2 / 60.7 / 122.4 ms |              3 |             8.8 s |
|               75 |   1,032 |   1.4 / 7.5 / 19.1 ms |    5.9 / 31.2 / 80.9 ms |              0 |            10.0 s |

- fixture 의 page 는 전부 「직계 자식 하나가 page 전체」 (body > 컬럼 하나) 다 — 직계 자식 단위만으로는 나뉘지 않는다. **단위는 깊이 우선으로 내려가야 한다** (Decision 2 의 「상한을 넘으면 그 자식들로」 가 기본 경로).
- 단위 분할은 resolver 선택으로 표현된다: 부모까지의 조상은 `ownedChildren` 이 다음 hop 만, 부모는 이번 자식만, 틀로 넣는 자식은 `[]` — plain owned 노드 사슬에서 동치 확인 (위). **layout 정의의 instance 인 body 는 실행하지 못했다** (fixture · 사용자 프로필 문서에 0 건) — template 자식도 `include` 검사를 받으므로 (`resolver.ts` template · fillSlot · replace 자식 분기) 표현 가능하다는 것은 코드 판독뿐이다. Phase 1 첫 테스트로 확정하고, 안 되면 그 page 는 한 단위로 채운다.
- 상한이 작을수록 합이 는다 (75 에서 1.9배). 프로필: 단위마다 도는 엔진 `computeLayout` (65 장 합 670 ms / 통째일 때 대비 `apply` 309 → 1,018 ms) 와 `rewrap`. → Phase 1: **한 task 안에서 시간 예산까지 여러 단위를 해석 · 엔진 반영하고 `computeLayout` · `rewrap` · 전달은 task 당 1회**. 상한 초깃값은 75 (4x 최대 81 ms).
- 동기 요청 (page 한 장의 남은 단위 전부) = page 통째 행: 4x p50 70 · p95 135 · 최대 285 ms (record 1,085 개 page).
- 나눌 수 없는 최악 단위 — 1,000 행 바운드 ListBox (record 1,067): 단위 56 ms (1x) · 232 ms (4x), 같은 owner 의 `refreshRows` 38 · 150 ms (대조군 — 단위가 1.5배: 새 노드 `addNode` · 첫 글자 측정). 1,000 행 바운드 **Table 은 fixture 를 만들지 못했다** (binding 만 얹어서는 행이 반복되지 않음 — UNVERIFIED). record 당 274 µs (4x) 로 추정하면 행당 record 5 개에서 약 1.4 s — R6 의 「행 창」 이 필요한 크기다. G4 의 최악 단위 조건 (「그 단위의 task ≤ 같은 owner 의 데이터 갱신 task」) 은 1.5배 차이를 감안해 Phase 4 에서 다시 잰다.
- **새로 찾은 것 — 채움 뒤 Canvas 전체 재묶음**: page 종류 21 개 중 6 개 (66 장에서 18 회) 가 채워질 때 scene 이 전체를 다시 묶는다 (프로필 `canvasScene.rebind`). 비용이 그때까지 채워진 record 수에 비례한다 — 채움 뒤 프레임 4x 198 → 935 ms, 66 장 프레임 합 10.7 s (root 합 5.0 s 의 2배). 이대로면 「전부 채워진 시각」 이 지금 열기의 2.1배 (G5 는 1.5배 이하) 이고 G4 의 long task 0 도 깨진다. 재묶음 사유 (dev 카운터) 확인과 부분 갱신은 Phase 3 의 첫 항목이다 (breakdown Phase 3 표의 「전체 재묶음이 되면 root 단위 splice」 가 현실이 됐다).

**0-3 전체 순회 소비자 (G0 ②)** — 전수 grep + 표본 검증. 손댈 자리 5:

| 자리                                                                                        | 지금                                                                                     | 할 일                     | Phase |
| ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ------------------------- | :---: |
| `compositionRoot.plan` 의 `structureChanged` (page · project entry 변경 · 사이트 locale)    | 모든 root 를 `flatten(rootId)` — page 추가 · 삭제 · 순서 변경 한 번이 문서 전체를 채운다 | 틀 root 는 틀로 다시 해석 |   2   |
| 글꼴 동기 (`CatalogBuilderCore.tsx` — `readFontUse(canvasInputs.values())`)                 | mount · root 교체 · step 에서만 돈다 — 채움은 깨우지 않는다                              | 채움을 구독 (0-5)         |   3   |
| `gridRecordSet` (`CatalogCanvas.tsx`)                                                       | step · root 교체에서만 버린다                                                            | 채움에서도 버린다         |   4   |
| AI `projectElements` (`aiHost.ts`)                                                          | graph 전 page × `domInputs.get`                                                          | 읽기 전에 전부 채운다     |   4   |
| 노드 id 로 선택 (`workspace.itemsOfNode` · `libraryOriginItems`) · session `identityExists` | record 가 없으면 빈 선택 · 선택에서 빠짐                                                 | 그 page 를 먼저 채운다    |   2   |

- 빠져도 되는 자리 (채울 때 최신 문서 · 데이터를 읽는다): `stateReaders` · `dataReaderSources` · `refreshRows` · `refreshState` · `overrideDependents` (§5 넷째 질문의 답 — 건너뛴다) · chrome cache (`catalogSlotMarks` · `catalogRowRemainders` · `catalogBadges` — scene 버전 단위) · `beginMarquee` (틀 page 위에서는 잡는 것이 없다 — 화면에 걸친 page 는 먼저 채운다, G6 에서 확인). page frame 을 읽는 자리 (머리 · camera fit · 스냅 · scrollbar · guide · ruler · page drop) 는 틀의 root record 로 답한다. Preview · Publish 전용 순회는 범위 밖.
- 추정 (§4 「소스 ≈ 10 파일」) 대비 `aiHost.ts` 1 파일 추가 — 1.5배 미만. 전체 표: run 폴더 `artifacts/inventory-0-3.md`.

**0-4 내용 높이 page 판정식 (G0 ③)** — 해석된 page root record 에서 (`pageFrameStyle` 과 같은 입력): 폭 = `sizing.width ?? visual.width`, 높이 = `sizing.height ?? visual.height`. 둘 다 없음 → breakpoint page 크기 (틀 가능) · px 길이 → 그 값 (틀 가능) · 폭의 `%` → viewport 기준 (`viewportPercentWidth` — 틀 가능) · 그 밖 (`auto` · `fit-content` · `min/max-content` · 높이의 `%`) → 내용에 달림, 첫 단계에서 채운다. page `placement` (자유 배치) 와 horizontal 의 `auto` 열은 frame 의 고정 폭으로 정해져 내용과 무관. fixture 22 · 66 장과 사용자 프로필의 프로젝트 2 개 (page 39 장) 에는 해당 page 0 건 — probe 는 「root 가 폭 · 높이를 작성했으면 일괄」 로 더 좁게 판정했다. 내용 높이 page fixture 는 Phase 1 동치 테스트에 둔다.

**0-5 글꼴 경로 (G0 ④)** — 선택: **(a) 문서에서 미리 읽기 + 채움 구독 (안전망)**.

- 열기 1회의 root 교체는 fixture 에서 0 회다 (ready 뒤 long task 0 — 66 장 1x). `composition:fonts-ready` 이벤트 7 회는 글자 측정 캐시 등 다른 발행처의 것이라 교체 수의 지표가 아니다 — G3 는 dev 카운터 `rootReplaced` 로 잰다.
- 교체는 Skia 에 없는 S2 face (family × style, code 서체만 굵기 둘) 나 ja · zh locale subset 이 요청될 때만 일어난다. 한국어는 내장 Pretendard 라 해당 없음.
- face 단위가 family × style 이므로 문서 entry 의 작성 `fontFamily` · `fontStyle` (노드 · breakpoint 층 · run · 테마 기본 서체) 를 root 를 세우기 전에 한 번 읽어 요청하면 늦게 오는 face 가 생기지 않는다. 채움이 글꼴 동기를 깨우게 해 (지금은 mount · root 교체 · step 뿐) 예측에서 빠진 face 는 지금처럼 교체로 받는다. (b) 「그 글꼴의 글자만 다시 측정」 은 record 가 같아도 다시 그려야 하는 통지 경로가 새로 필요해 택하지 않았다.

**0-6 실문서 대표성 (G0 ⑤)** — **확인하지 못했다.** 사용자 Chrome 프로필 (`localhost:5173`) 의 프로젝트는 2 개뿐이고 page 가 비어 있다 (page 당 문서 노드 중앙값 1). 합성 fixture 의 규모 근거는 생성기 머리말의 「07-30 실문서 5,069 요소 · 23 페이지와 같은 급」 뿐이다 — page 당 record 수 · 직계 자식 수 · 내용 높이 page 의 실제 분포는 모른다. 단위 설계는 분포에 기대지 않게 (깊이 우선 · 노드 수 상한) 잡았다.

**0-7 `ready` 재정의 초안** — 페이지가 두 표지를 남긴다: `composition:staged.current-filled` (현재 page 의 마지막 단위 전달 뒤 첫 프레임) · `composition:staged.all-filled` (큐가 빈 뒤 첫 프레임). 하니스 `ready` = 지금 조건 + 첫 표지. old 빌드는 표지가 없으므로 지금의 `ready` 를 두 값으로 쓴다 (일괄 빌드에서는 같은 시각). Phase 4 에서 `perf-baseline.mjs` 에 반영.

**G0 판정** — ② ③ ④ ⑥ 닫힘 (⑥ 의 Table · layout body 는 위에 적은 UNVERIFIED 로 Phase 1 · 4 에 넘김), ⑤ 미확인, **① 미달 (1.34)** → 사용자 판정 (2026-11-11):

1. G0 ① — 범위 유지 · 게이트 수정: G5 상대 게이트 「66 장 ≤ 22 장 × 1.4」. 문서 읽기 · 검증 절감은 후속.
2. 결정 2 = (a): 66 장 · 4x 열기 ≤ 3.0 s 가 G5 게이트.
3. 동기 채움 상한 = 4x 150 ms: page 전환은 화면에 걸친 단위 · 요청 대상을 먼저 동기로, 상한에 닿으면 나머지는 큐 맨 앞 비동기 (본문 Decision 3 수정). 요청 대상 (선택 · 명령 대상의 조상 사슬 + subtree) 은 상한과 무관하게 채운다.
4. 결정 3 = (a): Preview · Publish 제외 — `stagedLoad` 는 Builder workspace 만 켠다.

**Phase 1 ~ 3 에 반영할 것 (Phase 0 에서 정해진 구현 사실)**

- 단위 = 깊이 우선 · 문서 노드 수 상한 (초깃값 75) · 상한을 넘는 plain owned 노드 (template · slot 채움 · binding 없음) 는 틀로 넣고 자식으로 내려간다. 조상 사슬은 `ownedChildren` 이 다음 hop 만 해석한다.
- 한 task = 시간 예산까지 여러 단위 해석 · 엔진 반영 → `computeLayout` · `rewrap` · 전달 1회 (단위마다 배치하지 않는다).
- 동기 요청의 대상 지정: page 전환 = 화면 영역과 겹치는 단위 · 선택 = 그 노드의 조상 사슬 (`ensureNode`).
- `plan` 의 `structureChanged` 는 틀 · 일부 채움 root 를 그 상태로 다시 해석한다 (Phase 2).
- 채움 뒤 Canvas 재묶음 사유 확인 → 부분 갱신 (Phase 3 첫 항목). 글꼴: 문서에서 family · style 을 미리 읽어 요청 + 채움이 글꼴 동기를 깨운다 (Phase 3).
- probe (`CatalogRootOptions.stagedProbe` · `probeFill` · `workspace.probeFillPage` · 하니스 스위치) 는 Phase 1 의 `stagedLoad` 구현이 대체한다 — 그때 삭제.

### Phase 1 — root 의 틀 · 채움 (2026-11-11, G1)

**구현** (`packages/shared/src/catalog/runtime/compositionRoot.ts` — resolver 는 바꾸지 않았다)

- 옵션 `stagedLoad: { firstPage?, unitLimit? }` (기본 꺼짐 — Preview · Publish · 테스트 root 는 지금 그대로). `loadInitial` 은 첫 page 의 root 는 일괄, 나머지는 `flattenShell` 로 틀을 세운다. 틀이 될 수 없는 root (frame 크기가 내용에 달림 — `fixedPageFrame` · template root 를 `replace` 한 instance) 는 일괄.
- **틀 = 「거절하며 기록하는 선택」**: resolver 의 `include` 물음 중 접힌 층 (정의 사슬의 template root — `collapseChain`) 만 받고 나머지는 거절하면서 그 key 를 순서대로 적는다. 거절한 물음이 곧 그 record 의 자식 자리 (채움 후보) 이고, 물음 순서가 일괄 빌드의 자식 순서다. owned 자식 · template 자식 · slot 채움 자식이 같은 방식이라 **layout 정의의 instance 인 body 도 틀이 된다** (G0 ⑥ 의 미확인 해소 — fixture `shelled`: root 의 후보 = layout template 의 자식 → slot 자리 → slot 에 든 page body → body 의 자식).
- **단위** (`fillUnit`): 가장 안쪽 「일부만 채워진 record」 의 다음 후보 하나. 경로의 record 들 (과 접힌 층) · 이번 자리는 받고, 경로 record 들의 다른 후보는 거절한다 — 이미 채운 형제를 다시 해석하지 않는다. 후보가 무거운 plain 노드면 (문서 노드 > 상한 · template 없음 · slot 채움 없음 · binding 없음 — 자식이 하나여도) 그 노드를 틀로 넣고 그 아래 물음을 후보로 적는다. layout 안의 template 자리는 늘 틀 (그 slot 을 채운 것은 page 의 노드라 무게에 안 잡힌다). composite instance · 바운드 owner 는 통째.
- **task** (`fill(rootId, { deadline?, unitLimit?, retryFailed? })`): `deadline()` 이 참이 될 때까지 단위를 해석 · 엔진 반영하고, 배치 (`settleLayout` — `apply` 에서 뽑아낸 `computeLayout` · `rewrap` · tag 줄 · overlay) 와 전달은 task 당 1회. journal 하나가 task 전체를 덮는다 — apply 실패는 record · 엔진 · 채움 상태를 task 이전으로 되돌리고 그 root 를 같은 revision 에서 다시 시도하지 않는다 (`retryFailed` 는 동기 요청용). 전달 실패는 record 를 두고 오류를 돌려준다. `subscribeFill` · `pendingFillRoots` · `pageOfRoot`.
- workspace `fillPage(pageId, options)` 와 하니스 빌드 스위치 (`localStorage["composition:staged-load"] = "on"`) — 스케줄러 · 요청 채움은 Phase 2. Phase 0 probe 는 삭제했다.

**검증**

- `stagedLoadEquivalence.test.ts` 9 건 — fixture 9 page (home · flex (wrap · 깊은 중첩) · grid (팔레트 instance — Card · Tabs · Table · Calendar · Select …) · bound (바운드 ListBox · TagGroup) · positioned (fixed · sticky · overlay — DialogTrigger · MenuTrigger · DatePicker) · wide · months (detach 한 두 달 Calendar — 판독 뒤 추가) · 내용 높이 page · layout instance body) × 채움 순서 3 (문서 순 · 역순 · 가운데부터) × 단위 2 (자리 통째 · 상한 3 — task 마다 단위 하나라 모든 중간 상태가 배치된다): record · geometry · composed part · slot chrome · tag 줄 · sticky constraints · page frame 이 일괄 빌드와 같다. 틀 단계의 page frame = 일괄. `stagedLoadFailure.test.ts` 2 건 — 엔진 오류 (task 원복 · 같은 revision 재시도 없음 · 다른 root 무영향 · 명시 재시도) · Canvas 구독자 오류 (record 유지 · 오류 반환 · 끝 상태 = 일괄).
- 원복 RED (`.agent/runs/…/scripts/red-p1.sh`): task 끝 배치 생략 7 실패 · 하위 틀의 후보 기록 생략 5 · 내용 높이 page 를 틀로 1 · 형제 거절 생략 4. **자식 순서 병합 생략은 통과한다** — 지금은 문서 순서로만 채워 병합이 항등이다. 순서를 건너뛰는 채움 (선택한 노드까지 먼저 — Phase 2 `ensureNode`) 의 테스트가 이 가지를 잡는다.
- 회귀: builder `src/builder/catalogRuntime` 3,424 통과 (실패 3 = `adr298TokenPreview`, HEAD 에서도 실패) · shared 2,455 통과 · type-check 통과.
- 실제 Builder (production 하니스 `/private/tmp/perf-dist-307p1`): 22 장 — 상한 75 · 8 ms 예산 task 로 채운 뒤 record 6,317 의 id · 부모 · 자식 · geometry · `derivedProps` · `hidden` 이 일괄과 차이 0, Canvas stream 상자 = 재묶음 결과 (1,000 행 바운드 ListBox 문서 7,384 · 66 장 18,798 도 차이 0).
- task 비용 (66 장, 상한 75 · 예산 8 ms, 1회): 1x 140 task p50 10.6 · p95 18.2 · 최대 25.1 ms / 4x 340 task p50 17.4 · p95 51.4 · 최대 88.4 ms (100 ms 초과 0). 합 4x 7.5 s — page 통째의 1.45배 (Phase 0 probe 의 단위마다 배치는 1.9배). 동기로 한 장 통째 (상한 75): 4x p50 74 · p95 144 · 최대 376 ms → 동기 요청은 150 ms 상한에서 끊는다 (Phase 2).

**판독 (reviewer 1회, 2026-11-11) — CRITICAL · HIGH · MEDIUM 0, LOW 3 + 미확인 가설 2 → 수리 검증 1회로 닫음**

- 가설 H1 (반복 사본을 만드는 자리를 틀로 넣으면 사본이 빈 채로 남는다) — 반증 fixture (page `months`: detach 한 Calendar · `visibleDuration` 2달, 상한 3) 가 **RED** (둘째 달 `CalendarMonth…#row:month1` 의 자식 0) → 결함으로 승격 · 수리: 틀로 해석한 단위가 그 자리 key 밖의 새 record 를 내면 (월 반복 사본 · `replace` 된 자리의 교체 노드 — 「물음 key = record identity」 전제가 깨지는 두 분기) 그 자리를 통째로 다시 해석한다 (`fillUnit`). 9 건 GREEN. 기본 상한 75 에서 이 길은 layout template 안의 detach 한 Calendar (template 자리는 늘 틀) 로만 닿는다.
- 가설 H2 (`replace` 된 plain template 자리) — 같은 가드가 덮는다. `replace` 를 만드는 명령은 instance swap 하나이고 대상이 composite 자리라 production 경로 없음 → 별도 fixture 없이 LOW deferred.
- L1 (틀 판정이 min · max 축을 안 봄) — `fixedPageFrame` 이 `minWidth` · `minHeight` · `maxWidth` · `maxHeight` 의 내용 키워드도 「틀 불가」 로 본다. L2 (`fill` 의 metrics revision) — 선례 (`refreshState`) 와 같이 `currentMetrics.revision`. L3 (문서 drift) — §3 표 이름 · fixture 수 · Status 줄 반영.

**G1 판정** — 통과. 그리기 명령 자체의 대조는 stream 상자까지 (patched ↔ rebuild) — 명령 단위 대조와 채움 뒤 전체 재묶음은 Phase 3. 열어 둔 질문 (§5) 첫째 (layout body 의 틀) 는 닫혔다.

### Phase 2 — 스케줄 · 요청 채움 · 채움 중 편집 (2026-11-11, G2)

**구현**

- root (`compositionRoot.ts`):
  - 채움 상태 = `{ revision, shells }` — 틀 record 마다 후보 (자식 자리) 와 처리한 자리. 스택을 없애 순서를 건너뛴 틀도 담는다.
  - **편집 step 은 미반영 자리를 채우지 않는다**: staged 가 아닌 해석 (step 의 region · 전체 root, `refreshRows` · `refreshState`) 은 살아 있는 틀이 미뤄 둔 자리 (record 없는 미처리 후보) 를 거절한다 (`heldBack` — `flatten` 안 한 곳). 살아 있음 = record 존재 · 틀 자격 (binding · composite 가 아님) · 부모 틀이 살아 있음. page root 의 틀은 record 가 없어도 살아 있다 (삭제했다 undo 로 돌아온 page 가 틀로 돌아온다).
  - **채움 상태는 문서를 따라간다** (`syncFill`): `fill` 시작 때 revision 이 다르면 살아 있는 틀마다 후보를 다시 열거하고 (부모 먼저), 「이전에 처리했거나 record 가 이미 있는」 자리를 처리로 본다. 미뤄 둔 자리가 어느 틀의 후보에도 없는데 문서에 그대로 있으면 (template 이 그 자리를 다른 컨테이너 아래로 옮김 — template 자리 · slot 안 page 노드는 identity 가 그대로) root 를 통째로 해석한다 (`fillWholeRoot`). root 가 template root 를 `replace` 하게 된 경우도 통째.
  - `fillNode(nodeId)` — owner 사슬의 record id 를 따라 순서를 건너 채우고 대상은 통째 (layout slot 안 노드는 template 자리부터 연다). `fill` 의 `target`.
  - 자식 순서 병합은 후보 순서 + 「후보가 아닌 자식 (월 사본 등) 은 같이 들어온 자식 바로 뒤」.
  - `pendingFillRoots({ failed })` — 같은 revision 에서 실패한 root 는 백그라운드 목록에서 빠진다. `plan` 의 `rootChildren` 은 staged root 에서 root identity 만 해석한다.
- `fillScheduler.ts` (신규) + workspace: 백그라운드 채움 (idle 마다 task 하나, 예산 8 ms, 현재 page → 화면 안 page → page 순서, busy 면 대기), `ensurePage` (page 전환 — 100 ms 벽시계 상한, 나머지는 백그라운드 맨 앞) · `ensureAllPages` · `prioritizePages` · `setFillBusy`, `itemsOfNode` → `fillNode`, session `identityExists` → 그 identity 를 담은 노드 채움, 교체된 root 는 session 의 현재 page 부터, step · root 교체 뒤 재개, dispose 에서 정지.

**검증**

- `stagedLoadInterleave.test.ts` 67 건 — 편집 14 종 (값 · 삽입 · 삭제 · 이동 · page 간 이동 · undo · redo) × 채운 단위 0 · 2 · 9, page 추가 · 삭제 · 순서 · 삭제 후 undo (다른 틀이 채워지지 않음을 단언), layout template 편집 · 중첩 변경, `refreshRows` · `refreshState`, `fillNode` (순서 건너뜀 · layout slot 안 노드), 편집 뒤 엔진 오류: 전부 같은 편집을 한 일괄 빌드와 끝 상태가 같다. `stagedLoadWorkspace.test.ts` 4 건 (백그라운드 채움 · page 전환 · 노드 요청 · 명령의 selectAfter · breakpoint 전환 · dispose) · `fillScheduler.test.ts` 7 건.
- 변이 RED (`scripts/red-p2.sh`): 10 종 중 8 종 실패 — 거절 없음 9 · 재열거 없음 6 · 순서 병합 없음 8 · 실패 root 제외 없음 2 · workspace 연결 4 종 각 1. 통과 2 종은 끝 상태가 같은 가지 (step 이 넣은 record 를 처리로 세기 — 중복 해석만 줄임 · 틀 자격 재확인 — 틀이 도중에 binding 을 얻는 fixture 없음) 라 LOW deferred.
- 회귀: builder `src/builder/catalogRuntime` · `workspace/canvas` 4,605 통과 (실패 3 = `adr298TokenPreview` — 소스 3 파일을 HEAD 판으로 바꿔도 같은 3 건 실패), shared 2,455 통과, type-check 통과.
- 실제 Builder (production 하니스 `/private/tmp/perf-dist-307p2`, 66 장, 1x · 4x): 틀 상태에서 값 편집 · 삭제 · undo · redo (각 +0 record — step 이 채우지 않음) · `itemsOfNode` (+48 record) · `setPage` (4x 95 ms, 그 page 채워짐) · 편집 → 백그라운드 채움 완료 뒤 record 18,782 개의 id · 부모 · 자식 · geometry 가 같은 편집을 한 일괄 빌드와 차이 0, Canvas stream = 재묶음.

**판독 (reviewer 1회) — HIGH 1 · MEDIUM 1 → 수리 검증으로 닫음**

- H1: 미뤄 둔 자리가 template 중첩 변경 (header 를 Group · 새 frame 으로 옮김) 으로 다른 컨테이너 아래로 가면 어느 틀도 다시 묻지 않아 끝내 채워지지 않았다 (record 451 / 452). → `syncFill` 이 그런 자리를 찾으면 root 통째. 재현 9 건 중 5 건 RED → 전부 GREEN.
- M1: 틀이 삭제됐다 undo 로 돌아오면 그 step 이 자식을 통째로 해석하는데, 낡은 미처리 후보가 다음 step 에서 거절돼 `RESOLVED_REGION_MISSING` 으로 step 이 중단됐다. → record 가 있는 자리는 거절하지 않는다. 재현 3 건 RED → GREEN.
- LOW 반영: 단위 0 인 task 는 전달하지 않는다 (metrics 를 덮지 않음) · `fillNode` 는 같은 revision 에서 실패한 root 를 다시 시도하지 않는다. LOW deferred: template 자리 identity 의 요청이 page 통째 · instance N 개 선택의 N 회 요청 · 삭제 확정 page 의 상태 정리 · 빈 slot 으로 옮긴 page 노드 (같은 가드가 덮음 — fixture 없음).

**G2 판정** — 통과. Phase 3 에 넘긴 것: 채움 뒤 Canvas 전체 재묶음 (이 시점 4x 채움 49 s · long task 87 개 최대 913 ms).

### Phase 3 — Canvas · 글꼴 · root 교체 (2026-11-11, G3)

**구현**

- **채움 뒤 전체 재묶음 → page 단위 재기록**: 원인은 `splice-rejected:top-layer` 였다 — fixed 상자 · 열린 overlay 를 담은 region 은 그 상자가 page 층 (page root 의 children 범위 안, `flushFixed`) 에 그려져 subtree splice 가 거부되고 scene 전체를 다시 묶었다 (fixture 의 page 종류 21 중 6). 이제 그 region 의 page root 를 자기 fixed 층과 함께 다시 기록한다 (`applyCommitSubtreeCommandPatch` 의 `pageLayer` · `canvasBinding.update` 의 escalation, drag 층이 떠 있을 때는 종전대로). **일반 편집에도 적용된다** — fixed · overlay 를 담은 region 의 편집이 문서 전체가 아니라 그 page 만 다시 기록한다.
- page 층 상자의 좌표: fixed 상자의 rect 는 직계 부모 기준이라 조상이 움직이면 바뀐다 — rect 가 하나라도 바뀐 갱신은 page 층 상자 (`topLayerElementIds`) 를 다시 비교하고, 바뀐 상자는 다시 기록한다 (판독 H1).
- Canvas (`CatalogCanvas.tsx`): 백그라운드 채움은 첫 프레임 전 · drag 중 · 카메라가 움직인 뒤 200 ms 동안 쉰다 (`setFillBusy`). 화면에 걸친 page 를 중심에 가까운 순으로 먼저 채운다 (`prioritizePages`). 틀 · 채우는 중인 page 에 옅은 표시 (「페이지 불러오는 중…」 — 사용자 결정 1 (b), `renderPageLoadingMarker`, 콘텐츠성 chrome 이라 겹친 page 에 가려진다). 채움의 전달이 실패하면 scene 을 record 에서 다시 묶는다 (`subscribeFillFailure`).
- 글꼴 (0-5 의 (a)): 채우는 동안은 문서 page 노드의 작성 글꼴 (family · style · weight — breakpoint 층 · 글자 run 포함) 을 record 없이 읽어 한 번에 요청하고 (`catalogAuthoredFontRequests`), 채움 뒤 500 ms 에 record 기준으로 다시 동기한다 (rule 이 주는 글꼴이 늦은 page 에서 처음 나오는 경우).
- 교체된 root (breakpoint · 테마 · 글꼴) 도 단계별 — session 의 현재 page 부터 (Phase 2 에서 구현).

**검증**

- `stagedLoadCanvas.test.ts` 2 건 — fixed · sticky · DialogTrigger · MenuTrigger · DatePicker · Select 를 담은 fixture 를 task 마다 `scene.sync()` 하며 채움: 전체 재묶음 0, patched stream (bounds · hit · 명령 type/id/좌표 · top layer 집합) = `scene.rebuild()` = 일괄 빌드의 새 scene. `canvasPageSplice.test.ts` 2 건 — 일반 편집 14 종 (fixed 상자 inset · 크기, 조상 높이 · padding, 구조 삽입, Sheet · Dialog 열고 닫기, fixed ↔ static, undo) 마다 patched = 새 묶음, fixed 바가 조상이 움직여도 제자리. `catalogAuthoredFontRequests.test.ts` 3 건. workspace 전달 실패 1 건.
- 회귀: builder `catalogRuntime` · `workspace/canvas` · `fonts` · `i18n` 4,656 통과 (실패 3 = `adr298TokenPreview`, HEAD 소스로도 같은 실패).
- 실제 Builder (production 하니스, 66 장): 채움 완료 뒤 record 차이 0 · stream = 재묶음. **채움 시간 4x 49 s → 13.2 s (task 예산 8 ms) → 10.3 s (24 ms), long task 87 개 (최대 913 ms) → 27 개 (최대 85 ms)**. 1x 7.9 s → 2.0 s, long task 38 → 0. 스크린샷으로 표시 확인 (`artifacts/p3-shot-1.png` · `-2.png`).
- root 교체 수 (R3): fixture 열기 1회에 0 (지금과 같음 — 추가 face 요청 없음).

**판독 (reviewer 1회) — HIGH 1 → 수리 검증으로 닫음**

- H1: page 재기록이 binding 의 낡은 fixed rect 로 그렸다 — 조상의 padding · 높이 편집 뒤 fixed 바가 조상이 움직인 만큼 밀림 (전에는 전체 재묶음이 rect 를 다시 읽어 가려져 있었다). 재현 2 건 RED → page 층 상자 재비교로 GREEN.
- M1 (가설, LOW deferred): 글꼴 과요청이 root 교체를 반복한다 — `loadSpectrumFontsToSkia` 는 이미 있는 face (`hasFont`) 를 세지 않아 같은 face 로 두 번 교체되지 않는다. 쓰이지 않는 조합의 face 하나가 열기에 교체 1회를 더할 수 있다 (작성 글꼴이 Spectrum family 이고 그 style 을 다른 family 에만 쓴 문서).
- LOW deferred: `placeRegion` 일부 적용 뒤 page 재기록의 옛 위치 damage (overflow visible body 밖 absolute + fixed — 가설) · 작성 글꼴 미리 읽기가 못 읽는 것 (정의 template · patch visual · token — record 기준 동기가 뒤에 잡음) · page 재기록마다 부모 표 전체 재생성 (문서 크기 비례) · 실패한 root 만 남으면 표시 없음.

**G3 판정** — 통과.

**찾은 것 (범위 밖 — 고치지 않음)**: `useViewportSyncStore.cameraGestureActive` 를 세우는 호출이 catalog Canvas 에 없다 (`ViewportControlBridge` 에 `onInteractionStart` · `onInteractionEnd` 를 넘기지 않음) — page 헤더 DOM 층의 「제스처 중 숨김」 게이트 (ADR-221 · 226) 가 동작하지 않는다. 채움의 대기 신호는 카메라 변화 시각으로 따로 잡았다.

### Phase 4 — 전체 순회 소비자 · 하니스 · 측정 · 기본 켬 (2026-11-11, G4 · G5)

**구현**

- **기본 켬** (`CatalogBuilderCore.tsx`): 단계별 열기가 기본이다. `localStorage["composition:staged-load"] = "off"` 면 일괄 빌드 (대조군 · 문제가 생겼을 때 되돌리는 길). 하니스 빌드 전용 측정 스위치 `composition:fill-budget` · `composition:fill-unit`.
- **전체 순회 소비자** (0-3 표의 다섯 자리): Canvas 격자 record 집합 (`gridRecords` — 채움마다 버림) · AI `projectElements` (`workspace.ensureAllPages()` 먼저) · 글꼴 동기 (Phase 3) · 노드 id 선택 (`fillNode`, Phase 2) · `plan` 의 page 구조 변경 (Phase 2). 정적 게이트 `stagedLoadReaders.static.test.ts` — record 맵 (`domInputs` · `canvasInputs`) 전체 순회 자리를 파일별 개수 · 분류 (A 나중에 생긴 record 를 그때 읽음 · B 채움 통지로 다시 읽음 · C 먼저 채움 · P Preview/Publish root) 로 적어 두고, 새 순회는 실패한다.
- **`hasPendingFill`** (`compositionRoot.ts`): 채움 상태가 없으면 Map 크기만 보고, 있으면 `revision:fillEpoch` 로 기억한다 — `workspace.fillPending` 을 프레임마다 읽어도 문서 크기와 무관하다 (전에는 `pendingFillRoots()` 가 매번 틀을 다시 열거).
- **채움 뒤 명령 버퍼 합치기**: page 단위 재기록이 piece-table 명령 버퍼를 조각낸다 (채움 뒤 66 장 1x 68 · 4x 156 조각). 채움이 끝나고 제스처가 없을 때 한 번 한 조각으로 합친다 (`compactCommandStream` — span 의 논리 위치를 읽어 둔 뒤 다시 건다, `scene.compact()`, `CatalogCanvas` 의 `compactAfterSync`). 66 장 · 4x 에서 50 ms task 2 개.
- **node picture warmup hold**: 채우는 동안 idle warmup 을 쉰다 (`setNodePictureWarmupHold`) — 채움과 같은 idle 시간을 나눠 쓰고 있었다.
- **하니스** (`perf-baseline.mjs`): `waitReady` 가 채움이 끝날 때까지 기다린다 (`waitFill`, 기본 — 상호작용 부류가 채움과 섞이지 않게) · `PERF_STAGED_LOAD=off` (대조군) · `summarizeCoverage` 의 `topAll` (production 번들의 함수별 호출 수 — 진단용, ratchet 키 아님). 열기 · 「전부 채워짐」 시각은 performance mark `composition:staged.current-filled` · `composition:staged.all-filled`.
- 계획 (§3) 과 다른 점: `fill-pan` · `fill-zoom-out` · `fill-page-switch` 부류와 `--top-fn` 은 하니스에 넣지 않았다. 표시 간격 · long task 를 재는 wall-clock 측정이라 결정적 카운트 부류가 아니다 — run 스크립트 (`p2.mjs` · `p4pan.mjs`, 하니스의 `waitReady` · 계측 context 를 그대로 씀) 로 쟀다. ratchet 기준 갱신은 아래 「ratchet」 참조.

**측정 조건**: production 하니스 빌드 (`/private/tmp/perf-dist-307p4`, 이 작업 트리), headless Chrome, `many-pages` 22 · 66 장 (record 6,317 · 18,798), 일괄 (스위치 off) ↔ 단계별 교대 3쌍 중앙값. 측정 중 다른 작업 없음. `ready` = 현재 page 채워짐 + 첫 프레임.

**G5 — 열기**

| 문서 · CPU | 일괄 `ready` | 단계별 `ready` | 전부 채워짐 (한도 = 일괄 × 1.5) | long task 최대 | 채움 뒤 stream 차이 |
| ---------- | -----------: | -------------: | ------------------------------: | -------------: | ------------------: |
| 22 장 · 1x |     1,163 ms |         603 ms |                1,310 ms (1,745) |              0 |                   0 |
| 66 장 · 1x |     2,262 ms |         769 ms |                2,621 ms (3,393) |              0 |                   0 |
| 22 장 · 4x |     4,278 ms |       2,133 ms |                5,503 ms (6,417) |          78 ms |                   0 |
| 66 장 · 4x |     8,580 ms |   **2,741 ms** |              11,448 ms (12,870) |          82 ms |                   0 |

- 66 장 ≤ 22 장 × 1.4: 1x **1.28** · 4x **1.29** — 통과. 66 장 · 4x ≤ 3.0 s: **2,741 ms** — 통과 (세 번 2,750 / 2,725 / 2,741). 전부 채워진 시각 ≤ 일괄 × 1.5: 네 조건 모두 통과 (일괄의 1.13 ~ 1.33배).
- 「채움 뒤 stream 차이」 = 채움으로 patch 된 Canvas 상자와 같은 record 를 새로 묶은 상자의 차이 수.

**G5 — 상호작용 일곱 부류의 3배 문서 배율** (`--fixed-inputs --call-counts`, 부류 순서 `pan,zoom,select,edit,page-switch,panel-toggle,drag`, V8 호출 수)

| 부류         |  켬 22 장 |  켬 66 장 |     배율 |  끔 22 장 |  끔 66 장 |     배율 |
| ------------ | --------: | --------: | -------: | --------: | --------: | -------: |
| pan          |    63,715 |    76,376 |     1.20 |    63,536 |    76,225 |     1.20 |
| zoom         |   306,143 |   349,548 |     1.14 |   305,419 |   349,048 |     1.14 |
| select       | 2,476,945 | 2,483,288 |     1.00 | 2,478,254 | 2,481,785 |     1.00 |
| edit         |   336,548 |   371,489 |     1.10 |   336,339 |   370,938 |     1.10 |
| page-switch  |   720,480 |   734,664 |     1.02 |   720,153 |   733,722 |     1.02 |
| panel-toggle |   784,855 |   847,775 |     1.08 |   784,848 |   847,774 |     1.08 |
| drag         | 1,253,008 | 1,702,908 | **1.36** | 1,254,433 | 1,702,477 | **1.36** |

- 켬 = 끔 (차이 0.3 % 이내) — 단계별 열기는 채움이 끝난 뒤의 상호작용 비용을 바꾸지 않는다. Canvas 변경 전인 Phase 2 빌드 (`perf-dist-307p2`, 스위치 off) 도 같은 순서에서 같은 값이다 (drag 1,253,024 → 1,701,984, 1.36).
- **drag 1.36 은 이 변경 전부터 있던 값이다** — 여섯 부류는 1.2 이하. drag 만 따로 재면 66 장 1,271,379 (켬) · 1,271,141 (끔) 로 22 장과 같다: 편집 · page 전환 뒤에 재는 drag 가 66 장에서만 약 43 만 호출 늘어난다 (명령 reader · span 위치 해석 · 버퍼 Proxy 읽기 · 그리기 호출). 연구 문서 §8 의 「drag 1.14」 와는 측정 조건이 다르다. 이 ADR 의 범위가 아니라 고치지 않았다 — **사용자 판정 대상 (미달 축)**.
- 측정 실수 기록: 처음 대조군을 `pan,drag,zoom` 순서로 재서 「켬에서만 drag 1.36」 으로 잘못 읽었다. 부류 순서가 같아야 비교가 된다 (앞 부류가 남긴 상태가 뒤 부류의 호출 수를 바꾼다).

**G4 — 비동기 경로** (66 장 · 4x)

| 항목                     | 값                                                                 |
| ------------------------ | ------------------------------------------------------------------ |
| 채우는 중 pan            | 표시 간격 p50 16.7 · p95 16.8 ms · long task 1 (50 ms)             |
| 채움 뒤 pan (대조)       | p50 16.7 · p95 16.7 ms · long task 0                               |
| 채우는 중 축소 (전 page) | long task 46 개 · 최대 99 ms · 100 ms 초과 0                       |
| 채우는 중 편집 · undo    | 값 편집 10 · 삭제 18 · undo 13 · redo 10 ms, 끝난 뒤 stream 차이 0 |

- pan p95 는 채움 없는 pan 과 같다 (+1 프레임 이내). 100 ms 넘는 long task 0.
- **최악 단위 (나눌 수 없는 owner)**: 1,000 행 바운드 ListBox 가 든 page — 그 단위의 task 가 1x 68 ms · **4x 251 ms**. 같은 owner 의 데이터 갱신 (`refreshRows`) 은 4x 144 ~ 162 ms (Phase 0) 라 게이트 문구 (「그 단위의 task ≤ 같은 owner 를 지금 데이터 갱신하는 task」) 에 **미달**. 1,000 행 Table 은 4x 최대 85 ms (행이 화면 창만큼만 만들어진다). 행 창 (R6) 은 넣지 않았다 — **사용자 판정 대상**.

**G4 — 동기 경로** (66 장, 채움 전)

| 항목                              |    1x |    4x |
| --------------------------------- | ----: | ----: |
| page 전환 (마지막 page — 틀)      | 19 ms | 84 ms |
| 틀 page 의 깊은 노드를 id 로 선택 |  5 ms | 20 ms |

- 150 ms (4x) 이내. `ensurePage` 는 100 ms 에서 끊고 나머지를 백그라운드로 넘긴다 — 이 fixture 의 page 는 그 안에 다 채워졌다 (「page filled」).

**ratchet**: `pnpm gate:perf-ratchet` 는 작업 트리가 아니라 push 대상 commit 을 전용 worktree 에서 잰다 — 미커밋인 이 변경은 재지지 않았다. 그리고 HEAD `2ec4e94d4` 자체가 기준 (`apps/builder/perf/ratchet.json`, 마지막 갱신 2026-11-02) 을 등급 A 178 키에서 넘는다 (이 ADR 과 무관한 그 뒤 커밋들의 몫). 커밋 뒤 재측정과 기준 갱신 (`--update`, 올리는 키는 `--raise` — 사용자 승인) 이 남는다.

**회귀**: `pnpm type-check` 통과 · builder `catalogRuntime` · `workspace/canvas` · `fonts` · `i18n` 4,656 통과 (실패 3 = `adr298TokenPreview`, HEAD 소스로도 같은 실패) · shared 2,455 통과 · `docs:stale-symbols` 통과.

**판독 (reviewer 1회) — HIGH 0 · MEDIUM 2 → 수리**

- M1: Layers 행은 문서로 만들어져 아직 record 가 없는 자리도 보이는데, `selectRecords` 가 record 만 읽어 그 행의 클릭이 버려졌다 (큰 page 로 전환한 직후의 창). 재현 RED → record 가 없는 identity 는 그 자리를 먼저 채운다 (`fillIdentity`).
- M2: 채움의 끝 신호가 「record 전달」 하나라, 전달 없이 끝나면 (마지막 틀 page 삭제 · 마지막 root 실패 · record 0 task) Canvas 의 warmup hold · 버퍼 합치기 · 「전부 채워짐」 mark 가 풀리지 않았다. 재현 RED → workspace 가 `fillPending` 의 끝 전환을 step · task · 노드 요청 뒤에 보고 row listener 에 알린다 (`settleFill`).
- LOW deferred 5 (hover 안내선 memo · 정적 게이트 밖 순회 · Layers 컬렉션 항목 행의 일시 숨음 · ratchet · `ensureAll` 의 오류 전파) — [reviews/307](../reviews/307.md).
- 수리 뒤: `stagedLoadWorkspace` 7 건 (재현 2 포함) · 단계별 열기 묶음 86 통과 · builder 4,686 통과 (실패 3 = 기존) · type-check 통과. 수리가 든 빌드 (`perf-dist-307p4b`) 의 66 장 · 4x 열기 2,813 / 2,809 / 2,797 ms · long task 최대 84 ms · stream 차이 0 (위 표는 수리 전 빌드 — 수리는 task · step 마다 O(1) 확인 하나를 더한다).

**G4 · G5 판정**

| 게이트 항목                                  | 결과                                                                    |
| -------------------------------------------- | ----------------------------------------------------------------------- |
| G5 66 장 ≤ 22 장 × 1.4 (1x · 4x)             | 통과 (1.28 · 1.29)                                                      |
| G5 66 장 · 4x ≤ 3.0 s                        | 통과 (2,741 ms · 수리 뒤 빌드 2,809 ms)                                 |
| G5 전부 채워진 시각 ≤ 일괄 × 1.5             | 통과 (1.13 ~ 1.33배)                                                    |
| G5 일곱 부류 ≤ 1.2 유지                      | 단계별 열기로 달라진 부류 0. **drag 1.36 은 변경 전부터 — 사용자 판정** |
| G5 ratchet 기준 갱신                         | 미실시 — 커밋 뒤 (HEAD 가 이미 기준 초과, `--raise` 는 사용자 승인)     |
| G4 채움 중 pan p95 · 100 ms 초과 long task 0 | 통과 (16.8 ms · 최대 99 ms)                                             |
| G4 최악 단위 ≤ 같은 owner 의 데이터 갱신     | **미달 — 1,000 행 ListBox 4x 251 ms (갱신 144 ~ 162 ms) · 사용자 판정** |
| G4 채움 전 page 전환 ≤ 150 ms (4x)           | 통과 (84 ms)                                                            |

**사용자 판정 (2026-11-11)**: ① 1,000 행 ListBox 채움 단위 (4x 251 ms) — 수용, 행 창은 후속 ② drag 1.36 — 기록만, 원인 분석 · 수리는 별도 작업 ③ ratchet 기준 갱신 — 이 ADR 게이트에서 제외 (기준 재설정은 별도 작업). → **Phase 4 닫힘.**

**후속으로 남긴 것**: 큰 바운드 목록의 행 창 (R6) · 편집 · page 전환 뒤 drag 의 문서 크기 비례 (66 장에서 +43 만 호출) · ratchet 기준 재설정 (HEAD 가 2026-11-02 기준을 등급 A 178 키에서 넘음) · 문서 읽기 · 검증의 page 당 비용 (열기 배율 1.28 의 남은 기울기).

### Phase 5 — live (2026-11-11, 실행자 몫 — 사용자 확인 전)

- 환경: 사용자 Chrome (Chrome MCP), dev 서버 5173 (이 작업 트리), DPR 2, 탭 visible. CPU throttle 은 MCP 로 걸 수 없어 **1x** 다 (4x 값은 위 production 하니스).
- 프로젝트 `perf-s1-live` (32 장 · record 410): 열기 — 현재 page 채워짐 653 ms (record 32 · 틀 31) → 전부 채워짐 1,471 ms, 버퍼 1 조각, 오류 0.
- 채우는 중 조작 (breakpoint 전환으로 root 를 다시 단계별로 세운 직후, 틀 31 장): 틀인 마지막 page 로 전환 → 그 page 채워짐 / 틀 page 의 노드 값 편집 (5 ms, 그 page 는 틀 그대로) → undo (값 원래대로) / 틀 page 의 깊은 노드를 id 로 선택 (1.7 ms, 항목 1) → 채움 끝 (484 ms · 프레임 간격 최대 84 ms) 뒤 patch 된 Canvas 상자 410 = 새로 묶은 상자 410 (차이 0) · 오류 0. 채움 뒤 화면에 page 내용 (차트 · 목록) 이 그려지고 「불러오는 중」 표시가 남지 않는다 (스크린샷).
- 사용자 프로젝트 `aaa` (7 장 · record 27, 읽기만): 단계별로 연 뒤의 record · 부모 · 자식 · geometry 27 줄 = 스위치 off (일괄) 로 연 27 줄 (차이 0). 스위치는 확인 뒤 지웠다.
- 66 장 (사용자 확인 중 `perf-s1-live` 가 66 장 · record 2,116 으로 늘어남, 실제 Chrome dev 1x): 현재 page 채워짐 803 ms → 전부 채워짐 3,693 ms. 채움을 멈추고 (`fillBusy`) 축소한 화면에 틀 65 장의 「Loading page…」 표시가 그려지고, 풀면 2.8 초에 걸쳐 채워진다 (프레임 간격 최대 140 ms · 오류 0). 같은 revision (240) 에서 단계별 = 스위치 off (2,116 줄 차이 0). 처음 대조는 revision 이 236 → 239 로 달라 (다른 탭에서 편집 중) 14 줄이 달랐다 — 같은 revision 으로 다시 재서 0.
- 확인 중 실수: 하니스 handle `canvas.setCamera` 에 `scale` 대신 `zoom` 키를 넘겨 카메라가 NaN 이 되고 그 탭의 화면이 죽었다 (React 「Too many re-renders」). 새로 고침으로 복구, 저장된 값 없음. 제품 경로가 아니라 dev handle 의 인자 실수다.
- 사용자 확인 (2026-11-11): ① 「한번에 뜨지는 않는다」 ② 「zoom, in,out 시 달라지는건 없다」 ③ 「되는듯하다」. ① 의 뜻을 물어 「1번 맞다」 (현재 page 가 바로 뜨고 나머지가 차례로 채워진다) · ② 는 「zoom 은 채우는 순서만 바꾼다」 는 설명 뒤 이의 없음 → **G6 닫힘 · Implemented (2026-11-11).** 본문을 `completed/` 로 옮겼다.

### 후속 점검 (2026-11-11, Implemented 뒤)

종결 정리 (`99f065ef2`) 의 「할 만한 것」 과 Phase 4 의 「후속으로 남긴 것」 을 한 목록으로 둔다.

- [x] **채움 끝 신호를 한 곳으로** (구조 개선 1 + 3) — `44c5161f4`. 스케줄러 host 의 끝 신호를 `filled(report)` 하나로, workspace 의 private `filled()` 가 row listener · 오류 보고 · `fillPending` 변화 통지 · mark 를 처리하고 Canvas 는 `subscribeFill` 하나로 warmup 멈춤 · 버퍼 합치기 · overlay 를 처리한다. 원복 RED 1 · live (66 장, 채움 신호 · 버퍼 57 → 1 조각 · 오류 0).
- [x] **명령 버퍼 이어 붙이기를 splice 경로로** (구조 개선 4) — 수리 없이 닫음. 가설 반증: 같은 일곱 부류 순서에서 drag 직전 버퍼 조각 수가 22 장 · 66 장 모두 3 이다 (하니스 `bufferSegments` 기록, `44c5161f4`).
- [x] **편집 · page 전환 뒤 drag 의 문서 크기 배율** (미달 축 ②) — 원인 분석 완료, 프레임 몫은 수리.
  - page 수에 비례하던 프레임당 루프 (`catalogGuidesByPage` · `unsafeContributorsWithin`) — `2836633ed`. pan 배율 1.20 → 1.08, 나머지 부류 불변.
  - 남은 몫은 프레임 밖이다: drag 중 새 기록이 미리 기록한 화면 밖 그림 411 개를 퇴거시키고, 놓은 뒤 idle warmup 이 404 개를 다시 기록한다. warmup 을 측정 창 밖에서 돌리는 dev 빌드의 drag 배율은 1.10. drag 중 warmup 멈춤은 효과가 없어 되돌렸다 (warmup 은 놓은 뒤에 돈다).
  - 그 몫을 줄이는 길은 캐시 정책 (drag 중 기록이 미리 기록분을 밀어내지 않게 · warmup 이 상한 아래 여유를 남기게) 이고 메모리 예산 판단이 따른다 — 보류. 수치: `docs/explanation/research/CANVAS_PERF_SCALING_2026-11.md` §drag 배율 원인.
- [x] **큰 바운드 목록의 행 창** (R6 · 1,000 행 ListBox 채움 단위 4x 251 ms) — ADR-157 의 「표본 밖 행은 투영하지 않는다」 를 지금 코드에 되살렸다 (사용자 원칙: 바운드 행은 디자인 표본, 실제 대량 데이터는 API 몫 — 속도 우선, 표본 행의 모양 · 상태 · 배치만 정확히).
  - 표본 = 그 목록이 page 에서 보이는 행 + 1 — (page 높이 − 첫 행의 page 안 위치) ÷ 줄 간격 + 1 (grid 는 첫 줄의 행 수를 곱함). page 높이는 page 루트에 작성한 px 높이, 없으면 breakpoint 화면 높이 (사용자 「page마다 높이는 달라질수있다」). 줄 간격 · 첫 행 위치는 배치에서 잰 값을 목록마다 기억한다 (`measureRowSample`). 처음 보는 목록은 가장 작은 행 (20, S2 control XS) 기준 page 전체 높이만큼 만들고 — 보이는 행을 빠뜨리지 않는다 — 다음 task 에서 잰 값으로 다시 만든다 (`resampleRows`, 지우는 행은 page 밖이라 깜빡임 없음). page 높이를 바꾸면 그 page 의 표본 목록을 다시 해석한다.
  - 사용자 확인으로 고친 것 2: ① 처음에는 page 높이 ÷ 20 + 1 로 고정해 행 간격 50 · 41 인 목록이 보이는 행의 2 ~ 2.5배 (44 행) 를 만들었다 (사용자 「화면내에 렌더링되는 표본이 설계보다 더되는듯」) → 잰 줄 간격으로. ② 400 px 아래에서 시작하는 Table 도 같은 수를 만들었다 (사용자 「table시작위치가 400px … 표본행이 더 적게」) → 첫 행 위치를 뺀다.
  - 나머지 영역은 owner 아래 여백으로 비워 둔다 — 줄 간격 × 남은 줄 수. 엔진 입력에만 넣어 DOM 은 그대로다. 영역 높이는 **DOM 이 그리는 행 수 (행 소스의 100 행 창)** 기준이고 「+N more」 라벨만 collection 전체 수다.
  - 측정 중 발견: Canvas · Preview 의 행 소스 (`catalogBoundRows`) 가 이미 100 행 창이라 종전에도 1,000 행이 아니라 100 행이 만들어졌다. 첫 구현은 영역을 전체 수 1,000 으로 잡아 Canvas owner 가 32,010 (DOM 3,210) 이 됐다 → 창 기준으로 수리 (테스트 「창 60 · 전체 200」). 처음 1 행만 만들고 같은 task 의 microtask 에서 다시 만드는 안은 1x 의 가장 긴 task 를 62 → 69 ms 로 늘려 버렸다 (위 방식으로 대체).
  - production A/B (1,000 행 ListBox 22 장, 교대 3쌍 중앙값 — 최종 빌드): 가장 긴 채움 task 4x 249 → **167 ms** · 1x 60 → **45 ms**, 열기 4x 2,128 → 2,058 · 1x 565 → 573 ms, 전부 채움 4x 6,268 → 5,708 · 1x 1,362 → 1,361 ms, record 7,384 → 6,295, 채움 뒤 stream 차이 0 · 오류 0. fixture 의 1,000 행 목록은 page 아래에서 시작해 1 행만 만들고, owner 높이 3,210 = 종전.
  - live (Chrome MCP · dev · `collect` 모바일 page 844, 사용자 프로젝트): Home Table (첫 행 33, 간격 41) 21 행 · 위에 400 px 상자가 있는 Page 2 Table (첫 행 433) 12 행, 두 표 높이 4,100 = 100 행 높이. `perf-s1-live` GridList 100 행: page 높이 1,500 → 다시 해석 · undo → 원래 수. console 오류 0. 「+N more」 영역은 page 밖이라 화면에서 직접 보지 못했다 (Layers 「+N more」 행으로 확인).
  - 채울 단위 탐색 O(N²) (효율 6) 은 이번에 재지 않았다.
- [ ] ratchet 기준 재설정 (HEAD 가 2026-11-02 기준을 등급 A 178 키에서 넘음).
- [ ] 문서 읽기 · 검증의 page 당 비용 (`storage.load` · `createCatalogGraph`, 열기 배율 1.28 의 남은 기울기).
  - 진행: 열기가 문서 graph 를 두 번 만들던 것 (`load` 의 검사용 + 열기용) 을 한 번으로 — `storage.loadGraph`. production A/B (교대 3쌍 중앙값, `ready`): 66 장 4x 2,768 → 2,415 ms (−13 %) · 22 장 4x 2,717 → 2,523 · 66 장 1x 791 → 722 · 22 장 1x 736 → 758 (노이즈). 이 측정에서 종전 66 / 22 배율이 이미 ~1.02 라 배율 개선은 주장하지 않는다 — 항목은 열어 둔다.
  - 진행 2: entry 형식 검사 3 → 1 회 (`createCatalogGraph` 가 검사한 문서는 생성자 · `validateView` 가 다시 보지 않음) · 저장소에서 읽은 entry 는 복제 없이 제자리 freeze (`createCatalogGraph(…, { adopt: true })` — `loadGraph` 만). 호출 수 RED (`storageOpenChecks.test.ts`, entry 6 개 문서): 검사 18 → 6 · entry 복제 6 → 0 (원복 RED 2). production A/B (HEAD 판 ↔ 변경 판 교대 3쌍, 단계별 열기 `ready` 중앙값): 22 장 1x 590 → 577 (노이즈) · 66 장 1x 692 → 637 · 22 장 4x 2,005 → 1,911 · 66 장 4x 2,382 → 2,181 ms (뒤 셋은 범위 안 겹침), 채움 · stream 차이 0 · 오류 0. page 당 기울기 (22 → 66 장) 1x 2.3 → 1.4 ms · 4x 8.6 → 6.1 ms. live (dev, `perf-s1-live` 67 page): 연 entry 1,230 전부 frozen · 편집 → 저장 → undo → 저장 → 새로 고침 뒤 값 유지 · console 오류 0. 남은 기울기 (참조 검사 · IndexedDB `JSON.parse`) 는 C · E 안 — 항목은 열어 둔다.
  - 진행 3: A+B 이후 읽기 비용 분해 및 검증 호출 내부 definition 계약 재사용. 66 장·4x view 검사 132.4→129.5 ms, 전체 열기 개선은 미입증. E 격리 실험은 읽기 107.3→140.0 ms·전체 쓰기 250.6→359.3 ms로 느려 보류. C 검증 유지·D 별도 설계 보류. [측정과 한계](../../explanation/research/CATALOG_DOCUMENT_READ_COST_2026-11.md).
- [ ] Preview · Publish 의 page 범위 (F10 · 사용자 결정 3 (a) — 「제외, 후속」). 지금은 보이는 route 가 하나여도 모든 page 를 펼친다.
- [ ] id 로 읽는 쪽의 채움 누락을 막는 정적 검사 — `stagedLoadReaders.static.test.ts` 는 record 맵 전체 순회만 잡고 id 읽기 (`get` · `recordsOfSource`) 는 통과시킨다. 종결 정리가 「root 가 알아서 채우기」 (구조 개선 2) 대신 권장한 대안.
- [ ] 종결 정리 (`99f065ef2`) 의 브라우저 확인 — 채움 · 「Loading page…」 표시는 `44c5161f4` live 에서 함께 확인됐다. 따로 보지 않은 것: 채움 뒤 노드 id 읽기의 즉시 반환 (`fillNode`) · 문서 서체 조회를 문서가 바뀔 때만 하는 변경.
