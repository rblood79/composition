# ADR-187 Phase 5 — Button text-bearing color live parity

## 범위

2026-08-24 standalone Text color 다음 slice로, Button root의 Typography `color`
picker를 typed presentation owner에 연결했다. Button은 자체 Skia node 안에 text
shape와 `presentationTextTargets`를 함께 materialize하므로, root color 변경을
paint-only로 적용할 수 있다.

이번 slice의 명시적 capability는 `Button`과 `Text`다. multi-child inherited subtree,
shell/container, 기타 component root는 descendant projection이 별도 materialize되지
않으므로 canonical/legacy 경로로 fail-closed한다.

## 구현 계약

- `isTextColorPresentationType`가 text-bearing root capability를 단일 allowlist로
  관리한다.
- Typography owner와 canonical commit adapter가 같은 capability를 소비한다.
- `StoreRenderBridge`는 Button root의 text slots만 갱신하며 box geometry, paragraph
  metrics/cache, child topology는 변경하지 않는다.
- Preview는 root `style.patch.color`를 semantic delta로 적용하므로 DOM의 inherited
  text color 결과와 Skia text slots가 같은 target을 소비한다.

## 실제 Builder 검증

새 프로젝트에 Button(`220×120`, 시작 color `#112233`)을 만들고 상단
`Compare Mode (Preview + Skia)` split에서 Typography ColorArea를 클릭-드래그했다.

| 구간       | 관측 결과                                                                                                                                                                                        |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 초기 상태  | unified Skia canvas 존재; Preview computed color `rgb(17, 34, 51)`; rect `x=110, y=70, width=220, height=120`                                                                                    |
| drag 중    | canonical style은 `#112233` 유지; Preview color `rgb(44, 121, 199)`으로 반영; rect 불변; `rawInput +9`, presentation diagnostics `frameApply +8`, target patch `+60`, Preview delta message `+8` |
| scheduling | action/control RAF `0/0`, legacy write `0`, application console error/warning `0/0`                                                                                                              |
| terminal   | canonical style `color: #2C79C7`로 1회 수렴; Preview computed color `rgb(44, 121, 199)`과 일치; Preview full-document message `+1`; terminal event `+1`                                          |

스크린샷은 `/private/tmp/adr187-phase5-button-color-live.png`에 남겼다. 이
검증은 component root의 inherited text color가 drag 중 canonical 문서 fan-out 없이
Skia text slots와 Preview DOM에 즉시 반영되고, pointer-up에서만 canonical handoff
되는 것을 확인한다.

## 자동 검증

- focused presentation/Skia/Preview gate: 19 files, 140 tests PASS
- `pnpm run codex:typecheck`: `TYPE-CHECK PASS — no new violations` (baseline 43 known)
- `git diff --check`: PASS

## 남은 Phase 5 범위

Button/Text root color slice는 완료했다. multi-child inherited subtree와 기타
component root color, 다른 opacity/paint 대상, layout allowlist 확대, text
metrics/resource와 structure는 계속 commit-only이며 ADR-187 전체 Phase 5 또는
`Implemented` 승격의 근거가 아니다.
