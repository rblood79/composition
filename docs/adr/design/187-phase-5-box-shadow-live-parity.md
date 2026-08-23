# ADR-187 Phase 5 — box-shadow live parity

## 범위

2026-08-23 네 번째 migration slice로 Appearance의 `boxShadow` paint 값을
`EditorPresentationTransactionRuntime`의 typed style owner에 연결했다. 기존
`node.effects`의 `drop-shadow` object를 `presentationShadowTargets`로
materialize하고, shadow의 offset·blur·spread·color만 mutable slot에서 갱신한다.

다음 조건은 presentation lane을 선택하지 않는다.

- shadow layer 수가 달라지는 변경(예: 1-layer → 3-layer preset)
- `inset` ↔ outer 전환
- `none`으로 제거되거나 parser가 해석하지 못하는 값

이 조건들은 command/effect topology를 바꾸므로 기존 canonical commit 경로로
fail-closed한다. 따라서 command stream의 `effectLayerCount`를 stale 상태로
두지 않는다. `boxShadow` select의 discrete finish는 canonical handoff 후 기존
commit lane의 fallback을 사용하며, continuous shadow field가 추가될 때 같은
owner가 frame publish를 담당할 수 있다.

## 실제 Builder 검증

실제 Builder에서 3-layer `md` shadow가 있는 Button을 준비한 뒤 상단
`Compare Mode (Preview + Skia)` split에서 Box Shadow를 `lg`로 변경했다.

| 구간         | 관측 결과                                                                                                                   |
| ------------ | --------------------------------------------------------------------------------------------------------------------------- |
| Skia/Preview | unified Skia canvas 존재, Preview computed `box-shadow`가 `lg` 3-layer로 수렴                                               |
| geometry     | Preview rect `x=110, y=70, width=220, height=120` 유지                                                                      |
| presentation | `targetIncrementalPatchCount +60`, Preview delta `+2`, action/control RAF `+0/+0`, legacy write `+0`                        |
| terminal     | canonical style `lg` 문자열, canonical write `+1`, Preview full-document message `+1`                                       |
| commit lane  | queue `+1`, current paint commit plan fallback `+1`, full rebuild `+1` — discrete canonical handoff의 기존 commit-only 경계 |
| console      | application error `0`, warning `0` (GPU driver `ReadPixels` 경고는 기존 측정 필터와 동일하게 제외)                          |

첫 번째 1-layer → 3-layer 시도는 typed target이 거부하고 legacy canonical
경로로 수렴했다. 이는 topology 변경을 presentation lane에 억지로 넣지 않는
fail-closed 계약의 live 확인이다. `presentationShadowTargets` object identity,
숫자/색상 patch와 exact restore는 focused Vitest로 고정했다.

## 자동 검증

- focused Vitest: 관련 5 files, 12 selected tests PASS; shadow effect/build,
  StoreRenderBridge slot/restore/topology guard, canonical commit, Preview semantic
  delta, static wiring guard 포함
- `pnpm run codex:typecheck`: `TYPE-CHECK PASS — no new violations` (baseline 43 known)
- `git diff --check`: PASS

## 남은 Phase 5 범위

이 slice는 box-shadow paint materialization과 topology fail-closed만 완료했다.
현재 Appearance shadow control은 discrete select라 terminal canonical handoff가
발생하며, continuous offset/blur/spread/color editor의 G7 drag gate는 아직
남아 있다. opacity/paint slider, layout allowlist 확대, text/resource와
structure는 migration하지 않았으므로 ADR-187 전체 Phase 5 또는 `Implemented`
승격의 근거가 아니다.
