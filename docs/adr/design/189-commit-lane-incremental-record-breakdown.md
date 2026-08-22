# ADR-189 구현 상세 — 커밋 레인 record 증분화

> 본 문서는 [ADR-189](../189-commit-lane-incremental-record.md) 의 구현 상세다. 결정
> 근거·대안·위험은 ADR 본문이 정본이고, 여기는 Phase 분해·파일 경계·검증 절차만 둔다.

## 1. 전제 lock-in

- **선행 의존**: ADR-188 G6 통과 (Phase 5 live parity) 가 본 ADR Phase 2+ 의 착수
  조건이다. Phase 0(측정) 과 Phase 1(dirty-root 도출) 은 ADR-188 과 병행 가능.
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
  (`buildRenderCommandStream` 호출 시 방문 노드 수 = N 단언).
- **판정**: N=5,000 에서 commit 1회 record+stream 축이 frame 예산 (8.33ms) 의
  50% 미만이면 Phase 2·3 의 우선순위를 재평가하고 본 ADR 을 축소 종결할 수 있다
  (측정 우선 — ADR-153 대안 B 와 같은 종결 경로 내장).

### Phase 1 — G1: commit dirty-root 도출

- 입력: ADR-188 Phase 1 의 targeted layout 결과 (affected id set + promoted
  ancestor). commit 경로에서도 같은 dirty-root 집합을 재사용한다 — 새 diff 계층
  신설 금지.
- layout 결과가 없는 commit (paint-only prop 편집) 은 `renderInvalidation.ts` 의
  typed invalidation 축으로 dirty-root 를 도출한다.
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

### Phase 3 — G3: content 부분 재기록 (damage clip)

- dirty subtree 의 이전/이후 hitBounds 합집합으로 damage rect 산출 → content
  재기록 시 `canvas.clipRect(damage)` + 비손상 영역은 직전 content snapshot blit.
- CoW snapshot 상호작용: 부분 재기록이 `makeImageSnapshot` 비용을 줄이는지
  (damage 면적 비례인지) G3 에서 실측 — CanvasKit 내부 CoW 가 전면 복사로
  남으면 이 Phase 는 기각하고 Phase 2 까지로 종결한다 (ADR-153 R7 과 동일 축).
- 시각 무결성: full rebuild 대조 pixel diff 0 (스크롤/클립/z-order 경계 fixture).

### Phase 4 — G4: live parity + cross-check

- populated builder 에서 편집 유형별 live exercise (CLAUDE.md §완료 기준).
- `/cross-check` — Builder(Skia) ↔ Preview(DOM) 시각 대칭 (D3 symmetric consumer).
- 120Hz p95 <4ms / p99 <8.33ms (ADR-187/188 계승) + commit 직후 프레임 스파이크
  제거 확인.

## 4. 파일 경계

| 파일                                           | Phase | 변경                                            |
| ---------------------------------------------- | :---: | ----------------------------------------------- |
| `apps/builder/.../skia/renderCommands.ts`      |   2   | commit lane splice 진입점, 세그먼트 span 재표현 |
| `apps/builder/.../skia/subtreeCommandPatch.ts` |   2   | 가변 길이 splice + full-rebuild fallback        |
| `apps/builder/.../skia/renderInvalidation.ts`  |   1   | paint-only commit 의 dirty-root 도출            |
| `apps/builder/.../skia/SkiaRenderer.ts`        |   3   | damage clip 부분 재기록 + snapshot 정책         |
| `apps/builder/.../skia/StoreRenderBridge.ts`   |   2   | commit resync 를 patch plan 소비로 전환         |
| `apps/builder/.../skia/nodePictureCache.ts`    |  2·3  | dirty-root 무효화를 plan 기반으로 정렬          |
| `packages/composition-engine` (필요 시)        |   1   | 없음 — ADR-188 Phase 1 산출 재사용이 원칙       |

## 5. 검증 체크리스트 (Phase 공통)

- [ ] full rebuild 대조 diff 0 (stream 구조 + pixel)
- [ ] fallback 경로 counter — 실패 descriptor 가 조용히 stale 로 남지 않음
- [ ] `hitBoundsMap`/SpatialIndex 가 draw 와 같은 revision 원자 교체 (ADR-188 G4 계승)
- [ ] 회귀 벤치: ADR-188 G0 하니스에 commit-lane 시나리오 추가
