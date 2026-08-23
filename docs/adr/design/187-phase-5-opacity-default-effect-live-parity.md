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

- `StoreRenderBridge.presentation.test.ts`: transient materialization/restore 및 no-op
  회귀 테스트 추가.
- 관련 presentation/Preview focused gate: 34 files / 225 tests PASS.
- `pnpm run codex:typecheck`: baseline 43 known errors 외 신규 오류 없음.
- 실제 Builder live 검증은 아직 수행하지 않아 이 slice는 Phase 5 종결로 표시하지 않는다.

## 남은 게이트

Builder Compare Mode에서 explicit `opacity: 1 → <1` drag의 Skia/Preview parity,
geometry 불변, terminal canonical handoff와 state-effect fail-closed를 확인해야 한다.
