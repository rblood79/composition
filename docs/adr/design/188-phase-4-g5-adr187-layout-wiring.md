# ADR-188 Phase 4 / G5 — ADR-187 layout lane wiring

검증일: 2026-08-22

## 범위

Phase 4는 Phase 3의 subtree patcher를 ADR-187 presentation runtime의 실제
Skia 소비 경로에 연결한다. 전체 `StoreRenderBridge.resync(true)`나
`buildRenderCommandStream` 재실행을 layout pointer update의 hot path로 사용하지
않으며, allowlist 밖 descriptor는 commit-only로 남긴다.

## Production wiring

- `SkiaEditorPresentationLayoutBridge`가 ADR-187 runtime의 `updated` event를
  구독한다.
- 현재 continuous allowlist는 canonical node의 `position:absolute`이면서
  숫자형 `style.patch.left/top` 또는 `geometry.patch.x/y`만 포함한다.
- `width/height`, `position`, `margin/padding`, 부모·형제 reflow, intrinsic 측정,
  `fixed/sticky`, ref descendant, CSS 문자열 값과 structure descriptor는
  targeted lane으로 승격하지 않고 commit-only로 닫힌다.
- allowlist descriptor는 `createPresentationLayoutPlan` →
  `createPresentationLayoutPublications`를 거쳐 rootKey별 publication을 만들고,
  현재 stream의 parent/clip/z-order/scroll context를 재사용하는
  `buildSubtreeCommandStream`으로 affected subtree만 기록한다.
- patch 성공 시 draw command, bounds, hit bounds와 SpatialIndex point update가
  같은 동기 구간에서 교체된다. `layoutVersion`/global full sync는 증가시키지
  않는다.
- 상단 split Preview의 `CanonicalNodeRenderer`도 같은 absolute 숫자형 allowlist를
  소비하므로 DOM과 Skia가 layout presentation 중 서로 다른 capability를 보지 않는다.

## Revision / terminal handoff

- `baseCanonicalRevision`과 rootKey별 `presentationRevision`을 모두 검사한다.
  stale 또는 canonical mismatch는 적용하지 않는다.
- `cancel`/`no-op`/`failed` terminal event는 canonical shared layout map을 같은
  subtree 경로로 local restore한다.
- `committed` terminal event는 committed document revision을 latch하고,
  `SkiaCanvas`의 canonical Store sync 이후에만 presentation state를 retire한다.

## G5 evidence

다음 focused tests가 통과했다.

```text
pnpm exec vitest run src/builder/presentation/skiaEditorPresentationLayoutBridge.test.ts src/builder/presentation/skiaEditorPresentationBridge.test.ts src/builder/workspace/canvas/skia/subtreeCommandPatch.test.ts --config vitest.config.ts
  Test Files  3 passed
  Tests       20 passed

pnpm exec vitest run src/builder/workspace/canvas/skia/subtreeCommandPatch.static.test.ts src/builder/workspace/canvas/skia/renderCommands.test.ts src/builder/presentation/skiaEditorPresentationLayoutBridge.test.ts --config vitest.config.ts
  Test Files  3 passed
  Tests       23 passed

pnpm run codex:typecheck
  TYPE-CHECK PASS — no new violations (baseline: 43 known errors)
```

회귀 fixture는 다음을 고정한다.

- absolute `left/top`의 draw/hit 동일 revision patch
- size/문자열 값의 commit-only fallback
- cancel terminal 후 canonical 위치 복원
- 기존 paint bridge와 subtree patch negative contract 유지

## 제한과 다음 단계

이번 Phase 4는 layout engine의 일반적인 in-flow reflow를 continuous lane에
추가하지 않는다. G6의 populated Builder split Preview와 120Hz trace에서
DOM/Skia parity 및 p95/p99를 확인하기 전까지는 위 allowlist가 production
경계다.
