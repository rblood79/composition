# ADR-189 구현 상세 — 커밋 레인 record 증분화

> 본 문서는 [ADR-189](../completed/189-commit-lane-incremental-record.md) 의 구현 상세다. 결정
> 근거·대안·위험은 ADR 본문이 정본이고, 여기는 Phase 분해·파일 경계·검증 절차만 둔다.
> 아래의 ‘착수 조건’·‘다음 진입점’ 표현은 각 Phase를 실행하던 당시의 순서를
> 보존한 기록이다. 현재 ADR-189는 Phase 0~~5 / G0~~G5를 모두 종결한 Implemented 상태다.

## 1. 전제 lock-in

- **선행 의존(당시 실행 순서)**: ADR-188 G6 통과 (Phase 5 live parity) 가 본 ADR
  Phase 2+의 착수 전제였다. Phase 0(측정)과 Phase 1(dirty-root 도출)은 ADR-188과
  병행 가능했고, 해당 전제는 현재 충족됐다.
- **base/응용 분류**: ADR-188 의 subtree patch 기계 (span/clip/z-order 4전제,
  원자 교체 patcher) 가 base, 본 ADR 은 그 기계를 canonical commit lane 으로
  일반화하는 응용이다. 의존 방향은 188 → 189 단방향.
- **fallback 방향이 ADR-188 과 반대다**: presentation lane 의 fail-closed 는
  commit-only(아무것도 안 그림) 였지만, commit lane 의 fail-closed 는 **full
  rebuild**(전부 다시 그림) 다. 어느 경로도 stale 화면을 만들지 않는다.

## 2. 현행 commit 경로 (Phase 0 계측 대상)

canonical mutation 1회 → `layoutVersion++` → 다음 프레임에서:

1. `renderCommands.ts::getCachedCommandStream` — `_cacheLayoutVersion` 불일치로
   cache miss → `buildRenderCommandStream()` **full DFS** (N 비례, JS 축 — 프레임의
   2-7%).
2. `SkiaRenderer.ts` content 재기록 — command stream 전량 실행. clean 노드는
   `nodePictureCache.ts::getCachedNodePicture` replay (ADR-153) 로 raw 재기록보다
   싸지만, **replay 호출 수 자체가 N 비례**이고 content surface 는 전면
   재래스터 + `makeImageSnapshot` CoW (flush 축 32-56%).
3. `StoreRenderBridge.ts::resync` / SpatialIndex `batchUpdate` — full snapshot 계약.

실측 배경 (memory `project-render-frame-decomposition-flush-vs-js`, 2026-07-27):
record.content mean 2.05ms (줌 활성 프레임의 ~40%), 대형 1920 페이지 p95 3.6ms —
**가시 요소 수 비례 확인**. flush.content 2.91ms(~56%, max 117.9 스파이크).

## 3. Phase 분해

### Phase 0 — G0: commit 1회 비용 분해 baseline (ADR-188 병행 가능)

- N=50 / 500 / 5,000 문서에서 **단일 요소 편집 commit 1회**의 축별 비용 고정:
  stream rebuild (JS) / content record (replay 포함) / flush+snapshot / SpatialIndex.
  ADR-188 G0 하니스 (`188-phase-0-g0-baseline.md`) 재사용.
- negative contract: 현행 경로가 실제로 full rebuild 인지 counter 로 고정
  (`buildRenderCommandStream` 호출 시 방문 노드 수 = fixture N + visible page
  shell 고정항, 증가량 1/N 단언). fixture의 고정 shell을 N에 숨겨 literal
  `visits === N`으로 보고하지 않는다.
- **판정**: N=5,000 에서 commit 1회 record+stream 축이 frame 예산 (8.33ms) 의
  50% 미만이면 Phase 2·3 의 우선순위를 재평가하고 본 ADR 을 축소 종결할 수 있다
  (측정 우선 — ADR-153 대안 B 와 같은 종결 경로 내장).

#### 실행 기록 — G0 RED (2026-08-23)

- [G0 evidence](189-phase-0-g0-baseline.md)의 Chrome 151 live Builder trace에서
  N=50/500/5,000 fixture를 5회씩 측정했다.
- N=5,000 p95는 stream `6.1ms` + content record `70.2ms` = `75.1ms`로,
  budget 50%(`4.165ms`)를 약 18배 초과했다. flush+snapshot `0.5ms`,
  SpatialIndex `1.8ms`가 뒤따르며 long task 10회가 관측됐다.
- full build count 1, subtree build 0인 음성 계약을 확인했다. 축소 종결 조건은
  불충족하므로 Phase 2/3을 진행한다.

### Phase 1 — G1: commit dirty-root 도출

- 입력: ADR-188 Phase 1 의 targeted layout 결과 (affected id set + promoted
  ancestor). commit 경로에서도 같은 dirty-root 집합을 재사용한다 — 새 diff 계층
  신설 금지.
- layout 결과가 없는 commit (paint-only prop 편집) 은 ADR-187 typed invalidation
  축 — `presentation/invalidation/editorMutationEffectRegistry.ts` (effect 축) +
  `editorPresentationInvalidation.ts` — 으로 dirty-root 를 도출한다.
  (`workspace/canvas/skia/renderInvalidation.ts` 는 ADR-035 의 무효화 **이유
  진단 히스토리**라 도출 채널이 아님 — 리뷰 round 1 정정.)
- 산출: `CommitPatchPlan { rootKey, dirtyRootIds, affectedIds, revision }`.
- 검증: 편집 유형 fixture (위치/크기/텍스트/스타일/자식 추가·제거) 별로
  dirtyRootIds 가 실제 시각 변화 범위를 포함하는지 full rebuild 대조 diff 0.

### Phase 2 — G2: command stream subtree splice 일반화 (ADR-188 G6 통과 후)

- `subtreeCommandPatch.ts` patcher 를 commit lane 에서 호출: dirty root 의
  `SubtreeBuildContext` (ADR-188 Phase 3 산출) 로 해당 서브트리만
  `buildRenderCommandStream(options.subtreeContext)` 재기록 → span splice.
- **가변 길이 splice**: presentation lane 의 "command count 불변" 전제를 commit
  lane 에서는 완화해야 한다 (자식 추가/제거·텍스트 변경은 span 길이가 변한다).
  splice 후 후속 span offset 재계산이 O(N) 이 되지 않도록 span 을 절대 인덱스가
  아닌 (segment, offset) 2계층으로 재표현하거나, offset shift 를 lazy 적용한다 —
  설계 선택은 Phase 2 착수 시 G0 실측으로 판정.
- 실패 조건 (context 부재 / clip·z-order 전제 위반 / 다중 root 간섭) → full
  rebuild fallback + DEV counter.
- static guard: commit 경로에서 `layoutVersion` 전역 bump 로 인한 full stream
  rebuild 호출이 dirty-root 미도출 케이스에만 남는지 counter 단언.

#### 실행 기록 — G2 implementation slice (2026-08-23)

- `renderCommands.ts`의 piece-table command buffer와 cursor span map,
  `subtreeCommandPatch.ts`의 variable-length commit patch,
  `StoreRenderBridge`의 post-commit queue/cache promotion을 구현했다. 기존
  ADR-188 presentation patcher는 fixed-length reject를 유지한다.
- 로컬 fixture에서 replacement span 길이 변화와 후속 sibling span 이동을 확인했고,
  splice write는 replacement span 길이 이하로 고정했다. 관련 35 tests와
  bridge/presentation 11 tests, type-check 신규 위반 0개가 통과했다.
- dashboard 생성 경로의 populated canonical project에서 201개 active node를 seed한
  `fills.replace` commit live trace를 통과했다. `queue/success/fallback=1/1/0`,
  `patchWriteCount=6`, commit 후 full build `0`, subtree visit `1`, command cache miss
  `0`, console error `0`을 확인했다. layout publish 전 대기와 후속 cache promotion도
  함께 검증했다.
- full rebuild와의 pixel diff closure harness도 통과했다. 동일 target selection 상태의
  `canvas[data-testid="skia-canvas-unified"]` backing buffer(`1440 × 852`)를 대조해
  `differing pixels=0`, `max/mean channel delta=0`, console error/warning `0/0`을
  확인했다. 따라서 Phase 2 / G2는 **Complete**이며 다음 진입점은 Phase 3 / G3
  damage clip이다. [Phase 2 evidence](189-phase-2-g2-command-splice.md)를 참조한다.

### Phase 3 — G3: content 부분 재기록 (damage clip)

- dirty subtree 의 이전/이후 hitBounds 합집합으로 damage rect 산출 → content
  재기록 시 `canvas.clipRect(damage)` + 비손상 영역은 revision이 동기화된 standby
  surface의 기존 픽셀을 유지한다. 매 commit의 직전 snapshot 전면 blit은 금지한다.
- CoW snapshot 상호작용: 두 surface가 같은 revision을 유지하고 damage region만
  반대 surface에 복제하는지 확인한다. area와 actual duration은 함께 기록하되
  ratio를 서로 대체하지 않는다. 전면 blit이 남으면 이 Phase는 기각하고 Phase 2
  까지로 종결한다 (ADR-153 R7과 동일 축).
- 시각 무결성: full rebuild 대조 pixel diff 0 (스크롤/클립/z-order 경계 fixture).

#### 실행 기록 — G3 Complete (2026-08-23)

- `subtreeCommandPatch`가 current/replacement `hitBoundsMap` 합집합을 산출하고,
  `StoreRenderBridge`가 다중 dirty root damage와 `damageRevision`을 함께 전달한다.
  `SkiaCanvas`는 같은 canonical revision의 visible-content 감지 중복 full
  invalidation을 제거하고, `SkiaRenderer`는 ping-pong standby surface에서 damage
  clip 재기록을 수행한다. 전제 실패는 기존 full rebuild fallback으로 수렴한다.
- populated Builder의 258 active node에서 small-80 / large-240 두 commit을
  실측했다. patch subtree visits는 각각 `1`, full command build는 `0`,
  `damageRender/fallback=1/0`이며 damage ratio는 `0.0014546` / `0.0079577`이다.
  이 값은 clip 기하가 입력 면적을 따랐다는 증거이며 wall-clock 비용 비례의
  대용치가 아니다. actual duration 판정은 Phase 5 / G5에서 정정했다.
- patch 결과와 reload full rebuild의 canvas backing buffer는 `1440 × 852`,
  differing pixels `0`, max/mean channel delta `0`으로 닫혔다. Builder-local
  Vitest 3 files / 21 tests, type-check 신규 위반 0, console error/warning 0/0.
  [Phase 3 evidence](189-phase-3-g3-damage-clip.md)

### Phase 4 — G4: live parity + cross-check — Complete (2026-08-23)

- populated builder 에서 편집 유형별 live exercise (CLAUDE.md §완료 기준).
- `/cross-check` — Builder(Skia) ↔ Preview(DOM) 시각 대칭 (D3 symmetric consumer).
- 120Hz p95 <4ms / p99 <8.33ms (ADR-187/188 계승) + commit 직후 프레임 스파이크
  제거 확인.

실행 증적: [189 Phase 4 G4 live parity](189-phase-4-g4-live-parity.md).
258 active node populated Builder의 Compare Mode split에서 paint 8회는
`patchSuccess/fallback=1/0`, subtree visits `1`, full build `0`, damage
`1/0`을 유지했다. `render.frame` p95/p99는 `1.3/1.3ms`, console
error/warning은 `0/0`이었다. style/layout·structure generic mutation은
full-rebuild fallback으로 수렴했고 frame p95/p99는 `2.2/2.2ms`, `1.7/1.7ms`였다.
CSS DOM target과 Skia hitBounds는 compare pane offset 정규화 후 rect·색상이
일치했으며, G3 backing-buffer pixel oracle은 differing pixels `0`이다.

### Phase 5 — G5: Round 2 corrective closure — Complete (2026-08-24)

- commit patch의 dirty ID 수집에서 전체 `subtreeSpans` map scan을 제거하고 dirty
  command span 내부 `CMD_ELEMENT_BEGIN`만 열거한다.
- command stream에 cursor 기반 `childrenSpans`를 추가하고, SpatialIndex 교차 후보와
  ancestor closure만 original paint order의 balanced sequence로 구성한다. damage
  render는 이 compact sequence만 실행하며 전제 실패는 full rebuild로 수렴한다.
- 그림자·outline·transform 등 hit bounds 밖 paint 가능 요소를 장면 단위
  `damageUnsafeElementIds`로 유지한다. 하나라도 있으면 SpatialIndex 후보를 과신하지
  않고 damage replay를 full rebuild로 fail-safe 전환한다.
- ping-pong surface를 revision 동기 상태로 유지해 damage마다 old snapshot 전면
  blit하지 않는다. damage rect만 clear/repaint/region-sync한다.
- full sync에서 1px region `clip + clear + blit`을 예열한다. 실제 Chrome cold first
  sample `31.3ms`는 예열 뒤 `0.5ms`로 내려갔고 이후 `0.3~~0.5ms`를 유지했다.
- N=50/500/5,000 wide-sibling 테스트는 compact sequence를 조상+target 2개,
  10개 미만 command로 고정했다. 258-node patch/full backing-buffer diff는 0이다.
- 별도 Chrome 프로젝트에서 신규 Button을 실제로 추가하고 Preview DOM과 Skia
  draw/hit-selection을 `80 × 40`, 동일 text/fill로 직접 대조했다.

실행 증적: [189 Phase 5 G5 Round 2 closure](189-phase-5-g5-round2-closure.md).

## 4. 파일 경계

| 파일                                                                         | Phase | 변경                                                          |
| ---------------------------------------------------------------------------- | :---: | ------------------------------------------------------------- |
| `apps/builder/.../skia/renderCommands.ts`                                    |  2·5  | commit splice, cursor span, sparse damage sequence            |
| `apps/builder/.../skia/subtreeCommandPatch.ts`                               |   2   | 가변 길이 splice + full-rebuild fallback                      |
| `apps/builder/.../presentation/invalidation/editorMutationEffectRegistry.ts` |   1   | paint-only commit 의 dirty-root 도출 (ADR-187 effect 축 소비) |
| `apps/builder/.../skia/SkiaRenderer.ts`                                      |  3·5  | damage clip, region-synced surface, duration/command metrics  |
| `apps/builder/.../skia/skiaFramePipeline.ts`                                 |   5   | sparse damage playback를 renderable 계약에 연결               |
| `apps/builder/.../skia/types.ts`                                             |   5   | optional `renderDamageSkia` fail-safe 표면                    |
| `apps/builder/.../skia/StoreRenderBridge.ts`                                 |   2   | commit resync 를 patch plan 소비로 전환                       |
| `apps/builder/.../skia/nodePictureCache.ts`                                  |  2·3  | dirty-root 무효화를 plan 기반으로 정렬                        |
| `packages/composition-engine` (필요 시)                                      |   1   | 없음 — ADR-188 Phase 1 산출 재사용이 원칙                     |

## 5. 검증 체크리스트 (Phase 공통)

- [x] full rebuild 대조 diff 0 (stream 구조 + pixel) — G2/G3 oracle
- [x] fallback 경로 counter — 실패 조건은 full rebuild로 수렴하고 G2 fallback counter로 관측; G4 generic mutation은 descriptor 부재를 명시적으로 full path로 분류
- [x] `hitBoundsMap`/SpatialIndex 가 draw 와 같은 revision 원자 교체 (ADR-188 G4 계승) — G3/G4 live
- [x] 회귀 벤치: ADR-188 G0 하니스에 commit-lane 시나리오 추가 — G0 N-tier + G4 populated live
- [x] Round 2 corrective N-tier: span-map global scan 0 + compact damage command 수 상수 — G5
- [x] hit bounds 밖 paint contributor 장면은 sparse 진입 차단 + full fallback — G5
- [x] 신규 structure affected-output 자체의 Preview DOM↔Skia draw/hit 대조 — G5
