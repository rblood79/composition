---
name: composition-patterns
description: Composition의 catalog runtime 상태, 레이아웃, catalog·Canvas·Preview 계약을 확인할 때 사용.
user-invocable: true
---

# Composition 코드 계약

일반 코딩 절차 대신 현재 변경의 도메인에 해당하는 정본만 읽습니다.
Codex에서는 Claude의 glob 규칙 자동 로드를 전제하지 않습니다.

| 변경 영역                               | 정본                                                                                          |
| --------------------------------------- | --------------------------------------------------------------------------------------------- |
| 시각·DOM·Props 권위                     | [SSOT](../../rules/ssot-hierarchy.md)                                                         |
| catalog runtime·명령·selection·history  | [상태 관리](../../rules/state-management.md)                                                  |
| CanvasKit·Skia 캐시·렌더 루프           | [Canvas](../../rules/canvas-rendering.md)                                                     |
| Rust 엔진·layout invalidation·grid/flex | [레이아웃](../../rules/layout-engine.md)                                                      |
| CSS·token·variant                       | [스타일](../../rules/css-tokens.md)                                                           |
| children·RAC slot·조건부 표시·값 바인딩 | [RAC 조립 계약](rules/domain-rac-composition.md)                                              |
| 트리 구조 변경의 소비자                 | [구조 변경 감사](rules/domain-structure-change-audit.md)                                      |
| 패널 섹션                               | [Section 계약](rules/domain-section-component.md)                                             |
| Preview 동기화                          | [origin](rules/postmessage-origin-verify.md), [ready 버퍼](rules/postmessage-buffer-ready.md) |

핵심 구분: DOM·접근성은 RAC, Props/API는 Spectrum 참조와 custom 계약,
시각은 catalog `COMPONENT_RULES_TABLE` + theme/tokens입니다 (Frame/Group/Slot 포함 —
컴포넌트당 spec 파일은 없습니다, ADR-248). Canvas와 Preview의 시각 결과를 같은 정본에 대조합니다.

## 규칙 색인 (`rules/`)

섹션 접두사와 기본 영향도는 [\_sections.md](rules/_sections.md). 변경 영역에 해당하는 것만 읽습니다.

- **domain** — [async-pipeline](rules/domain-async-pipeline.md) C · [component-lifecycle](rules/domain-component-lifecycle.md) H · [element-hierarchy](rules/domain-element-hierarchy.md) C · [history-integration](rules/domain-history-integration.md) C · [layout-resolution](rules/domain-layout-resolution.md) H · [o1-lookup](rules/domain-o1-lookup.md) C · [rac-composition](rules/domain-rac-composition.md) H · [section-component](rules/domain-section-component.md) H · [structure-change-audit](rules/domain-structure-change-audit.md) C
- **validation** — [error-boundary](rules/validation-error-boundary.md) C · [input-boundary](rules/validation-input-boundary.md) C
- **style** — [css-reuse](rules/style-css-reuse.md) H · [no-inline-tailwind](rules/style-no-inline-tailwind.md) C · [overlay-s2-pattern](rules/style-overlay-s2-pattern.md) H · [react-aria-prefix](rules/style-react-aria-prefix.md) C
- **type** — [explicit-return](rules/type-explicit-return.md) C · [no-any](rules/type-no-any.md) C
- **spec** (catalog shape · 토큰 · 값 동기화) — [build-sync](rules/spec-build-sync.md) C · [container-dimension-injection](rules/spec-container-dimension-injection.md) C · [shape-rendering](rules/spec-shape-rendering.md) H · [single-source-truth](rules/spec-single-source-truth.md) H · [token-usage](rules/spec-token-usage.md) H · [value-sync](rules/spec-value-sync.md) C
- **react-aria** — [hooks-required](rules/react-aria-hooks-required.md) H · [no-manual-aria](rules/react-aria-no-manual-aria.md) H · [stately-hooks](rules/react-aria-stately-hooks.md) H
- **zustand** (남은 UI · 데이터 store 만) — [factory-pattern](rules/zustand-factory-pattern.md) H · [modular-files](rules/zustand-modular-files.md) H
- **postmessage** — [origin-verify](rules/postmessage-origin-verify.md) C · [buffer-ready](rules/postmessage-buffer-ready.md) H
- **inspector** — [history-sync](rules/inspector-history-sync.md) H
- **perf** — [checklist](rules/perf-checklist.md) M · [barrel-imports](rules/perf-barrel-imports.md) M · [dynamic-imports](rules/perf-dynamic-imports.md) M · [map-set-lookups](rules/perf-map-set-lookups.md) M · [promise-all](rules/perf-promise-all.md) M
- **arch** — [reference-impl](rules/arch-reference-impl.md) H

C = CRITICAL · H = HIGH · M = MEDIUM. 구현 레퍼런스는 `reference/` (canvas-details · child-composition ·
component-registry · compositional-architecture · layout-engine · layout-css-parity-ledger · style-panel · text-wrapping).
