# ADR-188 Phase 3 / G3·G4 — Skia subtree command·hit patch

## 범위

Phase 3은 ADR-187 presentation publication을 아직 production layout lane에 연결하지
않고, 다음 Phase에서 사용할 Skia 소비자 계약과 원자 patch primitive를 고정한다.

- `renderCommands.ts`의 단일 DFS에서 `subtreeSpans`, 조상 `clipContext`,
  `zOrderKey`, `scrollContextKey`, top-layer/fixed 집합을 함께 기록한다.
- `subtreeCommandPatch.ts`는 고정 길이 subtree만 in-place 교체한다. 검증 전에는
  command/map/index를 변경하지 않으며, 전제가 하나라도 깨지면 `reason`을 반환한다.
- draw command, `boundsMap`, `hitBoundsMap`, `selfSpans`, subtree metadata와
  SpatialIndex delta를 같은 동기 구간에서 교체하고 마지막에 revision을 갱신한다.

## Fail-closed 계약

다음 조건은 모두 patch 거부다.

1. presentation revision 역행 또는 canonical base revision 불일치
2. root/nested span 누락·범위 오류·span command context 불완전
3. command 수 또는 subtree node set 변경
4. drag/fixed top-layer 재배치
5. patch root 조상 clip context 변경
6. patch root의 ancestor scroll/sticky context 변경
7. z-order key 변경
8. replacement bounds 누락

clip으로 완전히 제외된 자식은 이전 `hitBoundsMap` entry와 SpatialIndex 항목을 먼저
제거한 뒤 새 hit entry를 쓴다. subtree 밖의 command와 map value identity는 건드리지
않는다.

## 검증

- focused Vitest 3 files / 31 tests PASS
  - leaf와 nested subtree의 draw/bounds/hit 교체
  - clipped child ghost-hit 제거
  - scroll/sticky context 보존 및 context 변경 거부
  - z-order, command count, top-layer, span context negative fixture
  - stale presentation/base revision 거부
  - static guard: full command rebuild, `batchUpdate`, `splice` 경로 0
- `pnpm run codex:typecheck` PASS — 기존 baseline 43건 외 신규 오류 0
- `git diff --check` PASS
- 기존 populated Builder smoke (`adr187-presentation-baseline.mjs`, N=50) PASS:
  `bridgeFullRebuildCount=0`, `previewFullDocumentMessageCount=0`, long task 0.
  fixture의 lowercase `<box>` 경고 1건은 기존 known warning이며 Phase 3 변경으로
  발생한 오류가 아니다.

## Cross-check 판정

이번 Phase는 catalog/spec, factory, CSS, Preview DOM을 변경하지 않고 Skia command
stream의 내부 metadata와 patch primitive만 추가했다. 따라서 CSS↔Skia 5-layer
대칭 검증 대상 컴포넌트는 0건이며, 다음 Phase에서 실제 layout publication을 Skia
frame/hit consumer에 연결할 때 populated Builder split Preview 검증을 수행한다.

## 경계

`StoreRenderBridge`/`SkiaCanvas`의 targeted publication subscription과 descriptor
allowlist는 Phase 4 범위다. Phase 3은 호출자가 없는 상태에서 full rebuild를 우회하는
새 production fallback을 만들지 않으며, 이 primitive를 continuous 경로의 성공 증거로
간주하지 않는다.
