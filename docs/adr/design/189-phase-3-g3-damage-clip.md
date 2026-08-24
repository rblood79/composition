# ADR-189 Phase 3 / G3 — content damage clip

## 판정

**G3 통과 — Phase 3 Complete (2026-08-23)**

Phase 2에서 생성된 commit subtree command span을 Skia content surface의 부분
재기록 경계로 연결했다. 성공한 patch는 이전·이후 `hitBounds` 합집합을 damage로
전달하고, 다음 RAF에서 직전 revision과 동기화된 standby surface의 damage 영역만
비운 뒤 SpatialIndex 교차 contributor의 compact command sequence만 재생한다.
snapshot 정책·camera·surface 전제가 맞지 않으면 기존 full rebuild로 fail-safe
수렴한다.

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
  - full render 직후 두 ping-pong surface를 동기화하고, 이후 damage render는 해당
    region만 반대편 surface에 복제한다. commit마다 old snapshot 전면 blit하지 않는다.
  - damage 영역, 실제 duration, sparse command 수, fallback을 development metrics로
    함께 관측한다.
- `renderCommands.ts`
  - SpatialIndex의 damage 교차 후보와 조상 closure만 원 paint order의 balanced
    sequence로 구성한다. 전체 command stream `0..length` 재생은 하지 않는다.
  - 그림자·outline·transform처럼 hit bounds 밖 paint가 가능한 요소가 장면에
    하나라도 있으면 sparse sequence를 만들지 않고 full fallback을 요구한다.

## G3 검증 증적

실제 Builder populated project에서 258개 active node를 생성하고 두 크기의 독립
색상 commit을 실행했다. 각 commit은 canonical terminal → StoreRenderBridge patch →
Skia damage render 순서로 관측했다.

| Fixture   | hitBounds damage | patch visits |   full-build visits | damage area ratio | damage render | fallback |
| --------- | ---------------: | -----------: | ------------------: | ----------------: | ------------: | -------: |
| small-80  |          80 × 80 |            1 | 258 (reload oracle) |         0.0014546 |             1 |        0 |
| large-240 |        150 × 240 |            1 | 258 (reload oracle) |         0.0079577 |             1 |        0 |

큰 damage의 면적은 작은 damage 대비 `5.625×`, 측정된 surface damage ratio는
`5.47×`로 증가했다. 이는 clip 기하가 입력 면적을 따랐다는 증거이며 실제
wall-clock 비용 비례의 증거로 사용하지 않는다. 두 commit 모두
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

Round 2에서 기존 증적이 area ratio를 duration ratio로 대체했다는 결함을 확인했다.
또한 당시 구현이 매 damage마다 old snapshot을 전면 blit하고 전체 command stream을
실행해 G3의 비용 계약을 닫지 못했다. 아래 G5 정정 증적이 이 판정을 대체한다.

## G5 정정 증적 — actual duration + sparse command (2026-08-24)

실제 Chrome Builder에서 같은 Button을 `80 × 40`, `240 × 240`으로 바꿔 각 8회의
색상 commit을 수행했다. 두 fixture 모두 첫 commit 전에 full sync가 실제 region
clip/clear/blit 순서를 1px에서 예열하고 원 snapshot을 즉시 복원한다.

| Fixture     | damage area ratio | samples | duration p50 / p95 | sparse commands | fallback |
| ----------- | ----------------: | ------: | -----------------: | --------------: | -------: |
| `80 × 40`   |      `0.00017149` |       8 |      `0.4 / 0.5ms` |        `11 × 8` |        0 |
| `240 × 240` |      `0.00276234` |       8 |      `0.4 / 0.5ms` |        `11 × 8` |        0 |

damage area ratio는 `16.1×` 증가했지만 이 작은 fixture의 duration은 브라우저 timer
해상도와 고정 GPU 비용이 지배해 선형 증가하지 않았다. 따라서 Gate는 “면적 ratio와
duration ratio가 같음”이 아니라 다음으로 정정한다.

- area와 actual duration을 같은 sample에서 모두 기록한다.
- CPU command dispatch는 full stream 길이가 아니라 SpatialIndex 후보 + 조상 수로
  제한한다. N=50/500/5,000 wide-sibling fixture에서 compact sequence는 매번 조상과
  target만 포함하고 10개 미만 command로 고정됐다.
- GPU 작업은 damage clip/region sync로 제한하고, final correctness는 patch/full pixel
  diff 0으로 판정한다.
- SpatialIndex가 paint contributor를 완전 열거하지 못하는 장면은
  `damageUnsafeElementIds`의 O(1) 장면 gate에서 full rebuild로 수렴한다.
- 예열 전 첫 region clear는 실제 Chrome에서 `31.3ms` cold cost를 보였다. full sync의
  1px region 예열을 추가한 뒤 새 reload의 첫 sample부터 `0.5ms`, 후속 7회
  `0.3~~0.5ms`로 닫혔다. 정적 guard가 전면 snapshot blit 재도입과 예열 제거를 막는다.

이 정정으로 CanvasKit 전면 snapshot 복사와 전체 command dispatch가 모두 제거되어
Phase 3 기각 조건은 발동하지 않는다. 120Hz frame과 DOM↔Skia 대칭은 G4/G5 증적을
함께 적용한다.
