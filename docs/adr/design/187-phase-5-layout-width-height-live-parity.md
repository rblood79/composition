# ADR-187 Phase 5 — targeted layout spacing slice

## 범위

`position: absolute`인 leaf node와 targeted engine이 있는 in-flow node의 명시적
non-negative `px` `width`/`height`에 더해, non-grid flow의 numeric `padding`
longhand/shorthand와 `gap`/`rowGap`/`columnGap`을 targeted layout publication에
연결한다. absolute subtree size, `%`, `auto`, intrinsic, fixed/sticky, grid spacing은
여전히 commit-only로 fail-closed한다.

## 구현 계약

- TransformSection의 Width/Height 입력은 owner가 열릴 때만 typed layout runtime을
  사용하고, unsupported 값은 기존 canonical 경로로 fallback한다.
- Skia layout bridge와 Preview layout resolver가 같은 numeric allowlist와 leaf gate를
  사용한다. in-flow width/height는 persistent tree의 affected ancestry targeted
  compute 결과를 사용한다. padding/gap은 같은 seam에서 used-size와 sibling 좌표를
  함께 계산하며, persistent grid track cache가 필요한 grid는 reject한다.
- LayoutSection의 Gap/단일 Padding/4-way Padding 입력도 같은 owner를 사용한다.
- targeted command/hit bounds만 갱신하며 global `layoutVersion` bump/full rebuild를
  호출하지 않는다.

## 검증 상태

- layout pilot/bridge/targeted engine/commit/Preview focused gate: PASS.
- `pnpm run codex:typecheck`: baseline 43 known errors 외 신규 오류 없음.
- Builder 상단 Preview 분할 모드에서 absolute leaf Button을 대상으로 Width/Height를
  `200×120`에서 `240×130`으로 변경했고, Preview DOM computed style/rect가
  `240×130px`, `position:absolute`로 수렴했다. Preview iframe은 `390×844`, Skia
  unified canvas는 `671.5×940`으로 동시에 표시됐다.
- 이번 실측은 Preview geometry와 분할 surface 존재를 증명하지만 Skia 내부 픽셀
  bounds/terminal handoff까지 독립적으로 읽는 계측은 아직 없다.
- 2026-08-24 실행 중인 Builder의 `Compare Mode`에서 `Badge` spacing spot-check도
  수행했다. `padding: 12px 24px → 20px`, `gap: 8px → 24px`가 Preview computed
  style에 반영됐고 rect는 `102.109375 × 52px → 94.109375 × 68px`로 변했다.
  수정 전 재현되던 shorthand/longhand React 경고는 normalization 적용 후
  `console.error`/`console.warn = 0/0`으로 사라졌으며, Undo 후 원래 geometry와
  style로 복귀했다. 이 결과는 단일 `Badge`의 실제 Preview spot-check이며,
  generic non-grid flex sibling의 Skia `bounds`/`hitBounds` parity 증거는 아니다.

## 남은 게이트

Builder Compare Mode에서 absolute leaf Width/Height drag 중 Skia 내부 bounds,
비영향 node identity, terminal canonical handoff와 unsupported parent fallback을
추가 계측해야 한다. non-grid flow의 width/height/padding/gap 측정 절차는
[Phase 5 flow live parity harness](187-phase-5-layout-flow-live-parity.md)에
고정했다.

## 잔여 범위 blocker와 재개 조건

현재 layout consumer의 정량 경계는 다음과 같다.

| 범위                         | 현재 consumer                                           |                               필요한 affected 결과 | 현재 blocker                                                       | 재개 조건                                                                                                      |
| ---------------------------- | ------------------------------------------------------- | -------------------------------------------------: | ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| absolute leaf `width/height` | `SkiaEditorPresentationLayoutBridge` 직접 subtree patch |                     `1` target, engine compute `0` | Skia 내부 bounds/terminal 증거 미확보                              | Compare Mode에서 target draw/hit bounds와 Preview rect가 함께 수렴하고 비영향 bounds reference가 유지됨을 확인 |
| in-flow `width/height`       | `computePresentationLayoutTargeted` + bridge            |             parent + sibling + descendant `N >= 2` | populated Builder에서 parent promotion/DOM·Skia live parity 미계측 | Compare Mode에서 같은 `N`개 bounds/hit-bounds와 terminal handoff를 확인                                        |
| `padding`                    | `computePresentationLayoutTargeted` + bridge            | parent content box + affected descendants `N >= 2` | grid track cache가 필요한 target/ancestry는 reject                 | non-grid flow의 Builder live draw/hit/Preview parity와 terminal handoff 확인                                   |
| `gap`                        | `computePresentationLayoutTargeted` + bridge            |            flex parent + in-flow siblings `N >= 2` | grid 및 persistent cache가 필요한 구조는 reject                    | flex sibling 결과와 children-map/hit-test parity를 atomic하게 검증                                             |

코드 경로와 회귀 테스트는 위 최소 범위를 닫았지만, populated Builder에서의
padding/gap 실측은 아직 남아 있다. 다음 승격 전에는 non-grid flex fixture에서
affected draw/hit bounds, 비영향 node identity, Preview rect, terminal canonical
handoff를 같은 gesture로 확인해야 한다. 전역 `layoutVersion++` 또는 full rebuild
fallback은 재개 조건이 아니다.
