# ADR-187 Phase 5 — explicit opacity `1` materialization slice

## 범위

Skia에 opacity effect가 아직 materialize되지 않은 canonical root의 명시적
`style.opacity: 1`만 presentation 중 transient effect로 승격한다. 기존 effect,
ref-descendant, state/disabled effect는 provenance를 보장할 수 없으므로 기존
commit-only 경로에 남긴다.

## 구현 계약

- target resolver는 canonical root와 effect 부재를 확인한 경우에만 owner를 연다.
- 첫 non-`1` preview에서 opacity effect를 생성하고, cancel/restore 시 값과 effect
  slot topology를 함께 복원한다.
- `1 → 1` no-op은 effect를 생성하지 않는다.

## 검증 상태

- `StoreRenderBridge.presentation.test.ts`: transient materialization/restore, state
  slot 보존, source-less legacy fail-closed 및 no-op 회귀 테스트 추가.
- `editorPresentationOpacity.liveHarness.test.ts`: populated Button fixture를
  사용한 deterministic Preview/Skia harness. explicit `opacity:1 → 0.42`에서
  cancel/finish 모두 geometry 불변, Preview/Skia parity, terminal event `1`,
  action/control RAF `0/0`, legacy write `0`, console error `0`, canonical write
  `0/1`(cancel/finish), stale callback `0`을 검증한다.
- disabled/state fixture는 owner gate가 `null`이고 Skia state effect
  `{source:"state", value:0.38}`가 유지되는 것을 검증한다.
- 실행 명령: `cd apps/builder && pnpm exec vitest run
src/builder/presentation/editorPresentationOpacity.liveHarness.test.ts
src/builder/workspace/canvas/skia/StoreRenderBridge.presentation.test.ts`
- `pnpm run codex:typecheck`: baseline 43 known errors 외 신규 오류 없음.
- 실제 Builder live 서버는 현재 sandbox의 `listen EPERM 127.0.0.1:5174`로
  기동할 수 없어 populated browser gate 대신 위 harness를 재현 가능한 증거로
  사용한다. 외부 Builder 실행 환경에서는 기존 Playwright runner로 terminal
  screenshot/console/RAF trace를 추가해야 한다.

## 남은 게이트

외부 Builder Compare Mode에서 explicit `opacity: 1 → <1` drag의 실제 canvas/DOM
parity, terminal screenshot, console/long-task trace를 추가 확인해야 한다. inherited
opacity와 ref-descendant/state owner는 provenance가 없는 한 계속 fail-closed한다.
