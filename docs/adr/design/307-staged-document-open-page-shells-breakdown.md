# ADR-307 breakdown — 문서 열기 단계별 빌드

> 본문: [307-staged-document-open-page-shells.md](../307-staged-document-open-page-shells.md). 측정 배경: [CANVAS_PERF_SCALING_2026-11](../../explanation/research/CANVAS_PERF_SCALING_2026-11.md) §10. 원자료: `.agent/runs/2026-11-11-canvas-perf-scaling/cold-ab/` (로컬).

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

| 파일                                                            | 변경                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/shared/src/catalog/runtime/compositionRoot.ts`        | `loadInitial` 을 「틀 세우기 + 첫 채움 집합」 으로. page 상태 (`filled` 집합). `fillNext(rootId)` — 단위 하나의 region 재해석 (`flatten(rootId, …)` 의 `ownedChildren` 선택 → `apply` → `deliver`, `refreshRows` 와 같은 journaling) · `fillPage(rootId)` — 남은 단위를 끝까지 (동기 요청). apply 실패는 journal 원복 + 「채움 실패」 표시 (revision 이 같으면 재시도 없음), 전달 실패는 record 유지 + 오류 모음 (리뷰 m1). `pagesPending()` · `subscribeFill`. 옵션 `stagedLoad` (기본은 Builder 만 켬) |
| `packages/shared/src/catalog/runtime/persistentLayoutTree.ts`   | (0-2 결과에 따라) subtree 일괄 추가                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `packages/engine/**`                                            | (G1 이 요구하면) `add_node` 증분의 grid · 중첩 컨테이너 배치 수리 · subtree 일괄 추가                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `catalogRuntime/__tests__/stagedLoadEquivalence.test.ts` (신규) | 채움 순서 3가지 × 단위 크기 2가지 (page 통째 · 직계 자식) × fixture 의 record · geometry 대조                                                                                                                                                                                                                                                                                                                                                                                                            |

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
