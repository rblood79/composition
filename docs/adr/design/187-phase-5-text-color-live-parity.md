# ADR-187 Phase 5 — standalone Text color live parity

## 범위

2026-08-23 Phase 5 잔여 paint slice로 Style 패널 Typography의 standalone
`Text` 요소 `color` picker를 `EditorPresentationTransactionRuntime`의 typed
style owner에 연결했다. 이 slice는 paragraph의 text content·font metrics·layout을
재생성하지 않고, Skia가 materialize한 `presentationTextTargets`의 color slot을
draw pass에서만 바꾼다. Preview는 같은 `style.patch.color`를 semantic delta로
적용한다.

다음 경계는 의도적으로 presentation lane을 선택하지 않는다.

- component/inherited color와 ref descendant color
- font size/weight/line-height/letter-spacing 등 text metrics
- text content, font resource, decoration/structure 변경

Typography owner는 selected canonical node가 정확히 `Text`일 때만 활성화하며,
commit adapter도 `Text` target에 한해 `style.patch.color`를 허용한다. 그 밖의
경로는 기존 canonical commit으로 fail-closed한다.

## 구현 계약

- `specShapeConverter`는 text paragraph의 canonical color와 별도의
  `SkiaPresentationTextTarget` slot을 materialize한다.
- `nodeRendererText`는 presentation color가 canonical color와 다를 때만 pooled
  color-filter layer를 열고, 동일하면 일반 `drawParagraph` 경로를 사용한다. 따라서
  idle text render에는 presentation saveLayer 비용이 추가되지 않는다.
- `StoreRenderBridge.applyPresentationStylePatch`는 text target slot만 갱신하고
  paragraph/geometry 캐시는 유지한다. cancel/terminal restore는 시작 slot을
  exact 복원한다.
- Preview `CanonicalNodeRenderer`는 `color`만 semantic paint patch allowlist에
  추가하고, DOM geometry style은 보존한다.

## 실제 Builder 검증

새 프로젝트에 standalone Text(`220×80`, 시작 color `#112233`)를 만들고 상단
`Compare Mode (Preview + Skia)` split에서 Typography ColorArea를 클릭-드래그했다.

| 구간       | 관측 결과                                                                                                                                                                                             |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 초기 상태  | unified Skia canvas 존재; Preview computed color `rgb(17, 34, 51)`; rect `x=110, y=70, width=220, height=80`                                                                                          |
| drag 중    | canonical style은 `#112233` 유지; Preview color `rgb(45, 121, 196)`으로 즉시 반영; rect 불변; `rawInput +9`, presentation diagnostics `frameApply +8`, target patch `+60`, Preview delta message `+8` |
| scheduling | action/control RAF `0/0`, legacy write `0`, application console error/warning `0/0`                                                                                                                   |
| terminal   | canonical style `color: #2D79C4`로 1회 수렴; Preview computed color `rgb(45, 121, 196)`과 일치; Preview full-document message `+1`; terminal event `+1`                                               |

스크린샷은 `/private/tmp/adr187-phase5-text-color-live.png`에 남겼다. 이 검증은
paint-only color drag에서 paragraph geometry와 canonical 문서가 drag 중 fan-out되지
않고, pointer-up에서만 canonical handoff 되는 것을 확인한다.

## 자동 검증

- focused presentation/Skia/Preview gate: 19 files, 138 tests PASS
- `pnpm run codex:typecheck`: `TYPE-CHECK PASS — no new violations` (baseline 43 known)
- `git diff --check`: Phase 5 문서/코드 반영 후 재실행 예정

## 남은 Phase 5 범위

standalone Text color slice는 완료했다. inherited/component color, text metrics/resource,
structure descriptor와 layout allowlist 확대는 여전히 commit-only이며, opacity/paint
slider 중 다른 대상을 추가 이행하지 않았다. 따라서 이 문서는 ADR-187 전체 Phase 5
또는 `Implemented` 승격의 근거가 아니다.
