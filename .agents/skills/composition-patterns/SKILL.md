---
name: composition-patterns
description: Defines code patterns, rules, and best practices for composition Builder application. Covers layout engine, Canvas rendering, state management, styling, and component architecture. Use when writing, reviewing, refactoring, or debugging any composition code, or when making architectural decisions about the builder.
TRIGGER when: user mentions "코드 패턴", "규칙 확인", "컨벤션 체크", "아키텍처 규칙", "composition 규칙", "패턴 체크", "코드 리뷰 기준", "code patterns", "conventions", "architecture rules", or asks about composition coding standards, Spec rules, rendering conventions, or state management patterns.
user-invocable: true
scope: composition Builder codebase (apps/builder, packages/specs, packages/shared, packages/composition-layout)
---

# composition Patterns Skill

composition 코드 작업의 rule index입니다. 이 파일은 routing용으로만 사용하고,
세부 내용은 필요한 rule/reference를 1~3개만 골라 읽습니다.

## 읽기 전략

1. 변경 파일을 먼저 확인합니다.
2. 관련 macro rule을 `.agents/rules/`에서 엽니다.
3. 구체적 위반 가능성이 있을 때만 이 skill의 `rules/` 또는 `reference/`를
   추가로 엽니다.
4. legacy `.claude/*`는 macro rule이 링크한 상세가 꼭 필요할 때만 확인합니다.

## Macro Rules

| 영역                   | 먼저 볼 파일                                                     | 핵심 확인                                                                      |
| ---------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| State/Zustand          | [state-management](../../rules/state-management.md)              | Memory → Index → History → DB → Preview → Rebalance                            |
| Canonical Format/Order | [canonical format/order](rules/domain-canonical-format-order.md) | `children[]` order SSOT, ref/origin format, page/layout compatibility boundary |
| Canvas/WebGL/Preview   | [canvas-rendering](../../rules/canvas-rendering.md)              | Spec/CSS/Canvas/Preview consumer 동시 확인                                     |
| Layout                 | [layout-engine](../../rules/layout-engine.md)                    | `layoutVersion`, full rebuild, cache invalidation                              |
| CSS/Token              | [css-tokens](../../rules/css-tokens.md)                          | token 우선, hard-coded drift 방지                                              |
| Spec SSOT              | [ssot-hierarchy](../../rules/ssot-hierarchy.md)                  | D1 RAC, D2 RSP/custom, D3 Spec 시각 SSOT                                       |
| ADR/Docs               | [adr-writing](../../rules/adr-writing.md)                        | Risk-First 구조, README/status sync                                            |

## 핵심 불변식

- Element tree 변경은 direct consumer뿐 아니라 selection, history, preview sync,
  layout, persistence consumer를 함께 감사합니다.
- canonical `CompositionDocument.children[]`가 runtime order SSOT입니다.
  `Element.order_num`, `pages.order_num`, `layouts.order_num`은 runtime
  read/write source가 아닙니다. 새 Element, page/layout shell, history,
  IndexedDB, drag/drop payload에 추가하지 않습니다. Supabase compatibility가
  필요한 경우에만 adapter boundary에서 source order로 파생합니다.
- Origin/instance 판단은 `reusable: true`, `type:"ref"`, `ref`,
  `descendants` canonical shape를 우선하고 legacy `componentRole/masterId`는
  adapter mirror로 봅니다.
- Zustand update는 index와 derived map stale 여부를 먼저 확인합니다.
- 렌더링 변경은 `packages/specs`, `packages/shared` CSS/renderer, Builder Canvas
  경로를 한 경로만 고치고 끝내지 않습니다.
- React Aria 접근성/DOM behavior는 임의 재구현보다 공식 primitive와 local wrapper
  패턴을 우선합니다.
- Style은 token과 existing CSS layer를 우선하고, inline hard-code를 늘리지
  않습니다.
- postMessage는 origin 검증과 ready/buffer contract를 유지합니다.
- `any`, `@ts-ignore`, broad cast로 계약 문제를 숨기지 않습니다.

## 상세 Rule Map

- Domain: [canonical format/order](rules/domain-canonical-format-order.md),
  [element hierarchy](rules/domain-element-hierarchy.md),
  [O(1) lookup](rules/domain-o1-lookup.md),
  [history](rules/domain-history-integration.md),
  [async pipeline](rules/domain-async-pipeline.md),
  [layout resolution](rules/domain-layout-resolution.md),
  [delta messaging](rules/domain-delta-messaging.md),
  [component lifecycle](rules/domain-component-lifecycle.md),
  [structure audit](rules/domain-structure-change-audit.md),
  [panel section](rules/domain-section-component.md)
- Zustand: [childrenMap staleness](rules/zustand-childrenmap-staleness.md),
  [factory pattern](rules/zustand-factory-pattern.md),
  [modular files](rules/zustand-modular-files.md)
- Spec: [build sync](rules/spec-build-sync.md),
  [value sync](rules/spec-value-sync.md),
  [SSOT](rules/spec-single-source-truth.md),
  [shape rendering](rules/spec-shape-rendering.md),
  [token usage](rules/spec-token-usage.md),
  [container dimensions](rules/spec-container-dimension-injection.md)
- Styling: [no inline tailwind](rules/style-no-inline-tailwind.md),
  [tv variants](rules/style-tv-variants.md),
  [React Aria prefix](rules/style-react-aria-prefix.md),
  [overlay S2](rules/style-overlay-s2-pattern.md),
  [CSS reuse](rules/style-css-reuse.md)
- React Aria: [hooks required](rules/react-aria-hooks-required.md),
  [no manual aria](rules/react-aria-no-manual-aria.md),
  [stately hooks](rules/react-aria-stately-hooks.md)
- PIXI/Canvas: [no xy props](rules/pixi-no-xy-props.md),
  [hybrid layout](rules/pixi-hybrid-layout-engine.md),
  [hit rect](rules/pixi-container-hit-rect.md),
  [border box](rules/pixi-border-box-model.md),
  [text isLeaf](rules/pixi-text-isleaf.md),
  [absolute hitarea](rules/pixi-hitarea-absolute.md),
  [viewport culling](rules/pixi-viewport-culling.md),
  [no flex height](rules/pixi-no-flex-height.md)
- Inspector/Preview: [inline styles](rules/inspector-inline-styles.md),
  [history sync](rules/inspector-history-sync.md),
  [postMessage origin](rules/postmessage-origin-verify.md),
  [buffer ready](rules/postmessage-buffer-ready.md)
- Quality: [input boundary](rules/validation-input-boundary.md),
  [error boundary](rules/validation-error-boundary.md),
  [no any](rules/type-no-any.md),
  [explicit return](rules/type-explicit-return.md),
  [tests/stories](rules/test-stories-required.md),
  [perf checklist](rules/perf-checklist.md),
  [map/set lookups](rules/perf-map-set-lookups.md)

## Reference Map

| 도메인                     | 파일                                                                               |
| -------------------------- | ---------------------------------------------------------------------------------- |
| Layout Engine              | [reference/layout-engine.md](reference/layout-engine.md)                           |
| Compositional Architecture | [reference/compositional-architecture.md](reference/compositional-architecture.md) |
| Child Composition & Spec   | [reference/child-composition.md](reference/child-composition.md)                   |
| Text Wrapping              | [reference/text-wrapping.md](reference/text-wrapping.md)                           |
| Style Panel                | [reference/style-panel.md](reference/style-panel.md)                               |
| Component Registry         | [reference/component-registry.md](reference/component-registry.md)                 |

## 병렬/위임 경계

- 사용자가 병렬/서브에이전트를 명시한 경우에만 위임합니다.
- 위임 시 파일/모듈 ownership을 분리하고, 서로의 변경을 revert하지 말라고
  명시합니다.
- 구현 위임은 disjoint write set으로 나눕니다.

## 검증

- 기본 완료 gate: `pnpm run codex:preflight`
- Spec/CSS 영향: `pnpm run build:specs` 필요 여부 확인
- Canvas/Preview 시각 영향: `cross-check` 또는 브라우저/Playwright 검증
- 문서-only 변경이면 type-check를 생략할 수 있지만, 생략 이유를 결과에 남깁니다.

## 발동 제외

- 단순 README/문서 오타, Git commit/push만 요청, 일반 React/TypeScript 질문,
  repository 설정만 바꾸는 작업에는 기본적으로 이 skill을 열지 않습니다.
