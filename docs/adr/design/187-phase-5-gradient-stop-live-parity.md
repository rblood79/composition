# ADR-187 Phase 5 — gradient stop live parity

## 범위

2026-08-23 첫 migration slice로 Style 패널의 단일 enabled
`linear/radial/angular` gradient에서 stop `color`와 `position`을
`EditorPresentationTransactionRuntime`의 동일 owner로 연결했다. `GradientBar`는
자체 `requestAnimationFrame`을 만들지 않고, 상위 adapter가 runtime frame ownership을
갖는다. 다중 fill, image/mesh, geometry, opacity-only 변경은 이 증적의 대상이 아니다.

## 실제 Builder 검증

실제 Builder에서 새 프로젝트를 만들고 gradient Button을 준비한 뒤 상단
`Compare Mode (Preview + Skia)` split을 켜고 Style 패널의 gradient stop을 8-step
pointer drag했다.

| 구간                     | 관측 결과                                                                                                                         |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| pointer                  | `down=1`, `move=9`, `up=1`                                                                                                        |
| drag 중 canonical/legacy | canonical write `2`(fixture baseline 유지), legacy write `0`                                                                      |
| drag 중 Skia             | counter 증가분: `targetIncrementalPatchCount=8`, `bridgeFullRebuildCount=0`, `layoutPublishCount=0`, `projectionSignatureCount=0` |
| drag 중 Preview          | full-document message `1`(fixture baseline), delta message `8`, Preview CSS `linear-gradient(... 28% ...)`                        |
| terminal 후              | stop position `0.282957...`, Preview CSS `28%`, canonical write `3`(finish 1회), delta message `10`, stale callback `0`           |
| console                  | error `0`, warning `0`                                                                                                            |

drag 중 Builder store의 canonical stop 배열은 시작값을 유지하고, Skia/Preview만
presentation overlay를 소비했다. mouseup 뒤 canonical finish와 overlay handoff 후에도
Preview는 `28%`를 유지했다. 이는 기존 store를 매 pointer event마다 재구축하지 않는
것과 terminal exact restore/handoff를 함께 확인한 것이다.

## 자동 검증

- focused Vitest: 4 files, 29 tests PASS
  (`StoreRenderBridge.presentation`, `buildSpecNodeData.presentation`,
  `editorPresentationPhase2.static`, `useFillActions.presentation`)
- `pnpm run codex:typecheck`: `TYPE-CHECK PASS — no new violations` (baseline 43 known)
- `pnpm run codex:format`, `git diff --check`: PASS
- existing Builder N=50/500/5,000 layout regression trace: all Skia/Preview parity
  booleans true, long task `0`; runtime apply p95/p99 `0.259/0.505ms`,
  `0.233/0.274ms`, `0.682/1.001ms`

## 남은 Phase 5 범위

fill opacity-only, border/stroke, shadow, property paint slider, layout allowlist 확대,
text/resource와 structure는 아직 migration하지 않았다. 이 문서는 Phase 5 전체 완료나
ADR-187 `Implemented` 승격의 근거가 아니다.
