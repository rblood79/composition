# ADR-187 Phase 5 — single-fill opacity live parity

## 범위

2026-08-23 두 번째 migration slice로 Style 패널의 단일 enabled
`color/linear/radial/angular` fill opacity를 `EditorPresentationTransactionRuntime`의
기존 paint owner로 연결했다. Fill detail popover의 opacity `ScrubInput`은 pointer move마다
typed `fills.replace` presentation patch만 publish하고, pointer-up에서 canonical commit으로
handoff한다. 다중 fill, image/mesh fill, gradient geometry와 border/shadow는 이 증적의
대상이 아니다.

## 실제 Builder 검증

실제 Builder에서 새 프로젝트를 만들고 gradient Button을 준비한 뒤 상단
`Compare Mode (Preview + Skia)` split을 켜고 Fill detail popover의 opacity scrub을
100%에서 55%까지 pointer drag했다.

| 구간                     | 관측 결과                                                                                                                         |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| pointer                  | `down=1`, `move=9`, `up=1`                                                                                                        |
| drag 중 canonical/legacy | canonical opacity `1` 유지, legacy write 증가 `0`                                                                                 |
| drag 중 Skia             | counter 증가분: `targetIncrementalPatchCount=8`, `bridgeFullRebuildCount=0`, `layoutPublishCount=0`, `projectionSignatureCount=0` |
| drag 중 Preview          | full-document message 증가 `0`, delta message `8`, Preview gradient stop alpha `0.55`                                             |
| drag 중 RAF              | action/control RAF callback 증가 `0`                                                                                              |
| terminal 후              | canonical opacity `0.55`, Preview gradient stop alpha `0.55`, canonical write `1회`, stale callback `0`                           |
| console                  | error `0`, warning `0`                                                                                                            |

`previewOpacity` CSS property는 `1`로 남지만, fill opacity가 gradient stop alpha로
합성되므로 실제 Preview paint 결과는 `rgba(..., 0.55)`로 Skia와 대칭이다. pointer-lock을
사용할 수 없는 Builder 문서/iframe에서는 `requestPointerLock()` rejection을 dx scrub
경로로 흡수해 `WrongDocumentError`가 surface되지 않는다.

## 자동 검증

- focused Vitest: 4 files, 31 tests PASS
  (`StoreRenderBridge.presentation`, `buildSpecNodeData.presentation`,
  `editorPresentationPhase2.static`, `useFillActions.presentation`)
- `pnpm run codex:typecheck`: `TYPE-CHECK PASS — no new violations` (baseline 43 known)
- `pnpm run codex:format`, `git diff --check`: PASS

## 남은 Phase 5 범위

border/stroke, shadow, property paint slider, layout allowlist 확대, text/resource와
structure는 아직 migration하지 않았다. 이 문서는 Phase 5 전체 완료나 ADR-187
`Implemented` 승격의 근거가 아니다.
