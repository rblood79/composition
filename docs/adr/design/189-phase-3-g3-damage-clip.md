# ADR-189 Phase 3 / G3 — content damage clip

## 판정

**G3 통과 — Phase 3 Complete (2026-08-23)**

Phase 2에서 생성된 commit subtree command span을 Skia content surface의 부분
재기록 경계로 연결했다. 성공한 patch는 이전·이후 `hitBounds` 합집합을 damage로
전달하고, 다음 RAF에서 ping-pong standby surface에 직전 snapshot을 blit한 뒤
damage rect만 clip하여 재기록한다. snapshot 정책·camera·surface 전제가 맞지 않으면
기존 full rebuild로 fail-safe 수렴한다.

## 구현 범위

- `subtreeCommandPatch.ts`
  - current/replacement subtree의 `hitBoundsMap` 합집합을 계산한다.
  - fixed presentation patch와 variable-length commit patch 모두 같은 damage 계약을
    반환한다.
- `StoreRenderBridge.ts`
  - 여러 dirty root의 damage를 union하고 `damageRevision`과 함께 `onDidSync` 및
    renderer-input effect에 전달한다.
  - commit lane patch 실패 시 기존 full rebuild fallback을 유지한다.
- `SkiaCanvas.tsx`
  - 같은 canonical document revision의 `visibleContentVersion` 감지가 damage를
    중복 full invalidation으로 승격하지 않도록 revision latch를 둔다.
  - 다른 revision, page-position 변경, surface 전제 이탈은 full invalidation을
    유지한다.
- `SkiaRenderer.ts`
  - ping-pong standby surface에 old snapshot을 복사하고 scene damage만 clip한다.
  - damage 영역과 fallback/render 비용을 development metrics로 관측한다.

## G3 검증 증적

실제 Builder populated project에서 258개 active node를 생성하고 두 크기의 독립
색상 commit을 실행했다. 각 commit은 canonical terminal → StoreRenderBridge patch →
Skia damage render 순서로 관측했다.

| Fixture   | hitBounds damage | patch visits |   full-build visits | damage area ratio | damage render | fallback |
| --------- | ---------------: | -----------: | ------------------: | ----------------: | ------------: | -------: |
| small-80  |          80 × 80 |            1 | 258 (reload oracle) |         0.0014546 |             1 |        0 |
| large-240 |        150 × 240 |            1 | 258 (reload oracle) |         0.0079577 |             1 |        0 |

큰 damage의 면적은 작은 damage 대비 `5.625×`, 측정된 surface damage ratio는
`5.47×`로 같은 방향의 면적 비례를 확인했다. 두 commit 모두
`contentSurface.missReasons.damage=1`이었고 full invalidation으로 승격되지 않았다.
`patchSuccess/fallback=1/0`, subtree build visits `1`, command stream full build `0`
을 유지했다.

## Pixel / 회귀 검증

- patch 후 canvas backing buffer와 reload full rebuild buffer를 같은 viewport와
  selection 상태에서 비교했다.
- `1440 × 852`, differing pixels `0`, max/mean channel delta `0`.
- console error/warning `0/0`.
- Builder-local Vitest: 3 files / 21 tests PASS.
- `apps/builder` type-check: baseline 43 known errors, 신규 위반 0.

## 판정 근거와 잔존 범위

CanvasKit snapshot 비용이 전면 복사로 고정되는 실패는 이번 fixture에서 관측되지
않았으므로 Phase 3 기각 조건을 발동하지 않는다. 120Hz p95/p99와 편집 유형별
Builder↔Preview 대칭은 Phase 4 / G4의 별도 live gate로 남긴다.
