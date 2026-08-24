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
- `skiaEditorPresentationBridge.test.ts`: 실제 Skia presentation consumer를 통과하는
  explicit `opacity:1 → 0.42` materialization, `presentation` source 보존 및
  canonical `style` effect handoff/volatile release를 검증한다.
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

### Reused populated Builder observation

기존 `127.0.0.1:5173` Vite listener를 재사용해 Compare Mode의 populated Button을
실행했다. explicit `opacity:1`을 `0`으로 조작하는 동안 Preview opacity와
canonical geometry(`x:110, y:70, width:220, height:120`)는 관찰되었고,
console error/warning `0`, action/control RAF `0/0`, legacy write `0`, stale callback
`0`이었다. 다만 같은 구간의 Skia debug node는 geometry만 유지하고
`targetIncrementalPatchCount=0`이었으며, terminal counter도 `0`이었다. canonical
commit 뒤에만 Skia node가 `{source:"style", value:0}`로 재 materialize되었다.
따라서 이 실행은 Preview/runtime 및 geometry 불변의 보조 증거이지, populated
Builder의 Preview↔Skia continuous parity를 통과한 live gate로 판정하지 않는다.

## 남은 게이트

외부 Builder Compare Mode에서 explicit `opacity: 1 → <1` drag의 실제 canvas/DOM
parity, terminal screenshot, console/long-task trace를 추가 확인해야 한다. inherited
opacity와 ref-descendant/state owner는 provenance가 없는 한 계속 fail-closed한다.
