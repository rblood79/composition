# ADR-187 Phase 5 — border color live parity

## 범위

2026-08-23 세 번째 migration slice로 Style 패널 Appearance의 `borderColor`
paint 편집을 `EditorPresentationTransactionRuntime`의 typed style owner로
연결했다. Border Color picker의 pointer move는 `style.patch` semantic delta와
Skia stroke paint slot만 갱신하고, pointer-up에서 canonical style commit으로
handoff한다. `borderWidth`·`borderRadius`·`borderStyle`처럼 layout 또는 stroke
topology에 영향을 주는 축, `boxShadow`, ref 대상이 없는 노드와 `borderStyle:
none`은 이 slice의 materialization 대상이 아니다.

## 실제 Builder 검증

실제 Builder에서 새 프로젝트를 만들고 `borderColor: #111111`,
`borderWidth: 2px`, `borderStyle: solid`인 Button을 준비한 뒤 상단
`Compare Mode (Preview + Skia)` split에서 Appearance의 Border Color picker를
9-step pointer drag했다.

| 구간               | 관측 결과                                                                                                                                   |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| pointer            | `down=1`, `move=9`, `up=0`(drag 중), terminal 후 `up=1`                                                                                     |
| drag 중 canonical  | canonical style `#111111` 유지, `canonicalWriteCount` 증가 `0`                                                                              |
| drag 중 Skia       | `targetIncrementalPatchCount +6`, `frameApplyCount +6`; `bridgeFullRebuildCount +0`, `layoutPublishCount +0`, `projectionSignatureCount +0` |
| drag 중 Preview    | `previewDeltaMessageCount +6`, `previewFullDocumentMessageCount +0`; Preview computed `borderColor = rgb(209, 209, 209)`                    |
| drag 중 RAF/legacy | action/control RAF `+0/+0`, `legacyWriteCount +0`, stale callback `0`                                                                       |
| terminal 후        | canonical style `#D1D1D1`, Preview computed `rgb(209,209,209)`, canonical write `+1`, full-document message `+1`, `up=1`                    |
| geometry           | Preview `borderWidth = 2px` 유지 — layout publish 없이 paint만 변경                                                                         |
| console            | application error `0`, warning `0`                                                                                                          |

drag 중 store의 canonical style은 시작값을 유지하고, Skia/Preview presentation
overlay만 새 색을 소비했다. terminal에서만 canonical commit이 발생하고
Preview는 새 canonical 값으로 handoff했다. 색상 변경은 stroke의 기존
mutable target slot만 갱신하므로 box geometry와 hit bounds는 변하지 않는다.

## 자동 검증

- focused Vitest: `6 files, 48 tests PASS`
  (`editorPresentationCommitAdapter`, `skiaEditorPresentationBridge`,
  `StoreRenderBridge.presentation`, `CanonicalNodeRenderer.fills`,
  `editorPresentationPhase2.static`, `useFillActions.presentation`)
- `pnpm run codex:typecheck`: `TYPE-CHECK PASS — no new violations` (baseline 43 known)
- `pnpm run codex:format`, `git diff --check`: PASS

## 남은 Phase 5 범위

`boxShadow`, property paint slider, border width/radius와 layout allowlist 확대,
text/resource와 structure는 아직 migration하지 않았다. 이 문서는 Phase 5
전체 완료나 ADR-187 `Implemented` 승격의 근거가 아니다.
