---
name: composition-patterns
description: composition 코드 패턴·규칙 정본 (apps/builder, packages/specs·shared·composition-engine — 레이아웃 엔진/Canvas 렌더링/상태/스타일링/컴포넌트 아키텍처). composition 코드 작성·리뷰·리팩토링·디버깅 또는 빌더 아키텍처 결정 시, 그리고 "코드 패턴"/"규칙 확인"/"컨벤션 체크"/"code patterns" 요청 시 사용.
user-invocable: true
---

# composition Patterns Skill

composition Builder의 코드 패턴, 규칙 및 모범 사례 통합 스킬.

> **상세 규칙은 `.claude/rules/`에 glob-scoped로 자동 로드됩니다.**
> 이 파일은 규칙 인덱스 + 에이전트 프로토콜을 제공합니다.

## 최상위 원칙 — SSOT 체인 3-Domain 분할 (CRITICAL)

모든 코드 작업은 아래 분할을 준수. 정본: [`.claude/rules/ssot-hierarchy.md`](../../rules/ssot-hierarchy.md) / 공식 결정: [ADR-063](../../../docs/adr/completed/063-ssot-chain-charter.md)

| Domain             | 권위                                                   | SSOT 관여                                              |
| ------------------ | ------------------------------------------------------ | ------------------------------------------------------ |
| **D1 DOM/접근성**  | Adobe RAC (절대)                                       | ❌                                                     |
| **D2 Props/API**   | RSP 참조 + custom                                      | ✅ 타입만                                              |
| **D3 시각 스타일** | catalog(`COMPONENT_RULES_TABLE`) + theme/tokens (SSOT) | ✅ 잔존 spec 3개(Frame/Group/Slot) 한정, 그 외 catalog |

- Builder(Skia)와 Preview/Publish(DOM+CSS)는 **D3의 대등 symmetric consumer**
- 대칭 = **시각 결과의 동일성** (구현 방법 자유)
- RAC는 unstyled — 스타일은 composition이 D3에서 결정
- RSP props는 RAC + custom으로 달성 가능한 범위에서 선별 채택
- **2026-07-08**: D3 SSOT는 [ADR-142](../../../docs/adr/completed/142-starter-spec-component-system-cutover.md)(Implemented)로 컴포넌트당 spec 파일에서 catalog + theme/tokens로 전환. [ADR-036](../../../docs/adr/completed/036-spec-first-single-source.md)은 Superseded by ADR-142

## Runtime SSOT — Canonical Document (ADR-116 + ADR-122 Implemented)

ADR-111 (frame schema) / ADR-112 (editing semantics) / ADR-113 (tag→type rename) 반영 후, ADR-116 이 `CompositionDocument` 를 storage SSOT 로 전환했고 (Implemented 2026-05-02), ADR-118/119/120/121 이 legacy mirror persistence 를 제거했으며, ADR-122 가 runtime mirror 제거를 완결했다 (Implemented 2026-05-09). 잔존 boundary helper (`frameMirror`/`exportLegacyDocument` 등) 는 ADR-122 HC.3 allowlist 내 의도된 영역 — 상세: [docs/adr/completed/122-canonical-only-runtime-legacy-mirror-removal.md](../../../docs/adr/completed/122-canonical-only-runtime-legacy-mirror-removal.md).

### 9 ADR 체인 도착지점

**"Pencil 호환 Canonical Document 가 단일 SSOT 로 Builder runtime 전체를 구동, legacy `Element[]` / `order_num` / hybrid mirror 는 cloud / export/import boundary 로만 격리"**

### Runtime layer 규칙 (ADR-122 Implemented — 현행 상태)

| Layer                | 현행                                                                  | 금지                                                        |
| -------------------- | --------------------------------------------------------------------- | ----------------------------------------------------------- |
| Mutation             | canonical document patch primary                                      | `setElements(exportLegacyDocument(doc))` mirror write-back  |
| Store read           | canonical selectors / canonical node lookup / resolved canonical tree | mutable `elementsMap`/`childrenMap` authoritative read      |
| Skia                 | canonical scene snapshot 또는 resolved canonical tree input           | render 직전 `canonicalDocumentToElements()` full projection |
| Preview              | `UPDATE_CANONICAL_DOCUMENT` active channel                            | `UPDATE_ELEMENTS` 의존                                      |
| LayerTree/Properties | canonical node/path/alias view model                                  | legacy `Element` shape 를 primary read model                |
| Boundary             | cloud/export/import/publish compat adapter                            | Builder hot path `exportLegacyDocument()` 호출              |

**핵심 불변식 4건** (2026-08-18 `.agents` 사본에서 이관 — 심링크 단일화 시 유일 실질 고유분):

1. **ref/layout_id 직접 read 금지**: Builder runtime/history helper 에서 `RefNode.descendants` / legacy `layout_id` 직접 읽기 금지. ref override traversal 은 `canonicalElementsView` helper boundary, frame ownership lookup 은 `frameMirror` boundary 로 격리.
2. **History full-snapshot prune**: History/Undo 가 full snapshot 으로 canonical document 를 동기화할 때 omitted runtime node 를 `db.documents` 에 남기지 않는다. page/layout shell 과 structural `body` 는 보존하되, incoming snapshot 에 없는 legacy-exportable runtime node 는 full-replace 과정에서 prune.
3. **page-shell bridge 보존**: page-shell bridge 는 새 page/body shell append 를 보존해야 하며, page/origin 삭제 후 stale canonical-derived snapshot 으로 deleted node 를 되살리면 안 된다 (`stores/history/historyActions.ts` page shell bridge 경로).
4. **Preview/Compare Mode 렌더 기준**: Preview/Compare Mode active channel 은 canonical `CompositionDocument` presence 기준으로 렌더. Compare Mode 의 렌더 분기가 canonical sync 를 막거나, Preview 가 legacy `elements[]` length 0 만 보고 빈 화면을 렌더하면 안 된다 (`workspace/Workspace.tsx` Compare Mode).

### Pencil terminology — 단일 표준 (ADR-111)

| 명칭          | 의미                                                  | 위치                                                                 |
| ------------- | ----------------------------------------------------- | -------------------------------------------------------------------- |
| `frame`       | `type: "frame"` 노드 (컨테이너 + 재사용 단위)         | `packages/shared/src/types/composition-document.types.ts::FrameNode` |
| `ref`         | `type: "ref"` 인스턴스 노드                           | 동일::RefNode                                                        |
| `reusable`    | `true` 면 재사용 원본                                 | 동일::CanonicalNode                                                  |
| `slot`        | `false \| string[]` — 추천 reusable component ID 배열 | 동일::FrameNode.slot                                                 |
| `descendants` | override 맵 (3-mode: patch / replacement / children)  | 동일::RefNode.descendants                                            |
| `clip`        | overflow:hidden 매핑                                  | 동일::FrameNode.clip                                                 |

### Composition extension — 직교 layer

Pencil schema 에 없는 Composition 고유 영역 (`x-composition.events` / `actions` / `dataBinding` / `editor`) 은 canonical core 와 직교. ADR-116 §Decision 명시: "Pencil primitive schema 그대로 채택하지 않아야 React Aria/Spectrum + Spec component model 보존".

## 규칙 카테고리

### CRITICAL (즉시 적용 필수)

#### Selection Consumer Contract (ADR-137)

- Page-bound mutation은 deferred inspector selection/display data에서 pageId를
  캡처하지 않는다.
- Selection 경로는 commit 시점 `readImmediateSelectionSnapshot()`으로 만든
  `ImmediateSelectionSnapshot`과 `apply*FromSelection(snapshot, ...)` 진입점을
  사용한다.
- Projection body / frame editing context처럼 명시 page context가 정당한 경로만
  `apply*Explicit({ pageId, contextReason, ... })`를 사용한다.
- Deferred `element.page_id`와 live `currentPageId`가 mismatch인 stale window에서는
  page-bound controls를 hide/disable한다.

#### Domain (domain-\*)

- **[domain-element-hierarchy](rules/domain-element-hierarchy.md)** - Element 계층 구조
- **[domain-o1-lookup](rules/domain-o1-lookup.md)** - O(1) 인덱스 기반 검색
- **[domain-history-integration](rules/domain-history-integration.md)** - 히스토리 기록 필수
- **[domain-async-pipeline](rules/domain-async-pipeline.md)** - 비동기 파이프라인 순서
- **[domain-layout-resolution](rules/domain-layout-resolution.md)** - Page/Layout 합성
- **[domain-component-lifecycle](rules/domain-component-lifecycle.md)** - 컴포넌트 생명주기
- **[domain-structure-change-audit](rules/domain-structure-change-audit.md)** - Element 트리 변경 시 소비자 감사
- **[domain-section-component](rules/domain-section-component.md)** - 패널 섹션은 `Section` 컴포넌트 사용

#### Zustand / Validation / Styling / TypeScript

- **[zustand-childrenmap-staleness](rules/zustand-childrenmap-staleness.md)** - childrenMap stale → elementsMap 최신 조회
- **[validation-input-boundary](rules/validation-input-boundary.md)** / **[validation-error-boundary](rules/validation-error-boundary.md)**
- **[style-no-inline-tailwind](rules/style-no-inline-tailwind.md)** / **[style-tv-variants](rules/style-tv-variants.md)** / **[style-react-aria-prefix](rules/style-react-aria-prefix.md)** / **[style-overlay-s2-pattern](rules/style-overlay-s2-pattern.md)**
- **style-action-icon-button** (인라인 규칙 — 별도 rules/ 파일 없음) — `ActionIconButton` 사용 (`.button-base` 우회, tooltip 내장)
- **[type-no-any](rules/type-no-any.md)** / **[type-explicit-return](rules/type-explicit-return.md)**

#### PIXI / Security / Spec

- ~~`pixi-*` 규칙들 (8 파일)~~ — **ADR-100 으로 OBSOLETE**: PixiJS 제거됨, historical reference 만
- **[postmessage-origin-verify](rules/postmessage-origin-verify.md)** - origin 검증 필수
- **[spec-build-sync](rules/spec-build-sync.md)** / **[spec-value-sync](rules/spec-value-sync.md)**

> **layoutVersion, order_num, WASM 초기화, display 전환, Field Component, Spec↔CSS 경계** 등의 상세 CRITICAL 규칙은 `.claude/rules/` (canvas-rendering.md, layout-engine.md, state-management.md)에 자동 로드됩니다.

### HIGH (강력 권장)

- **[arch-reference-impl](rules/arch-reference-impl.md)** / **[spec-single-source-truth](rules/spec-single-source-truth.md)** / **[spec-shape-rendering](rules/spec-shape-rendering.md)** / **[spec-token-usage](rules/spec-token-usage.md)**
- **spec-text-style** (인라인 규칙 — 별도 rules/ 파일 없음) — `extractSpecTextStyle()` 사용 (`apps/builder/src/builder/workspace/canvas/utils/specTextStyle.ts`), fontSize/fontWeight 하드코딩 금지
- **[spec-container-dimension-injection](rules/spec-container-dimension-injection.md)** — `_containerWidth`/`_containerHeight` props 주입
- **[style-css-reuse](rules/style-css-reuse.md)** / **[react-aria-hooks-required](rules/react-aria-hooks-required.md)** / **[react-aria-no-manual-aria](rules/react-aria-no-manual-aria.md)** / **[react-aria-stately-hooks](rules/react-aria-stately-hooks.md)**
- **[supabase-no-direct-calls](rules/supabase-no-direct-calls.md)** / **[supabase-service-modules](rules/supabase-service-modules.md)** / **[supabase-rls-required](rules/supabase-rls-required.md)**
- **[zustand-factory-pattern](rules/zustand-factory-pattern.md)** / **[zustand-modular-files](rules/zustand-modular-files.md)**
- **[postmessage-buffer-ready](rules/postmessage-buffer-ready.md)** / **[inspector-inline-styles](rules/inspector-inline-styles.md)** / **[inspector-history-sync](rules/inspector-history-sync.md)**

### MEDIUM

- **[perf-checklist](rules/perf-checklist.md)** / **[perf-map-set-lookups](rules/perf-map-set-lookups.md)** / **[test-stories-required](rules/test-stories-required.md)**

## 상세 레퍼런스

| 도메인                     | 파일                                                                                                                            |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Layout Engine              | [reference/layout-engine.md](reference/layout-engine.md)                                                                        |
| Layout Engine 구현 상세    | [reference/layout-details.md](reference/layout-details.md)                                                                      |
| Layout CSS 정합 실측 기록  | [reference/layout-css-parity-ledger.md](reference/layout-css-parity-ledger.md)                                                  |
| Canvas 렌더링 구현 상세    | [reference/canvas-details.md](reference/canvas-details.md)                                                                      |
| State 관리 구현 상세       | [reference/state-details.md](reference/state-details.md)                                                                        |
| Compositional Architecture | [reference/compositional-architecture.md](reference/compositional-architecture.md)                                              |
| Child Composition & Spec   | [reference/child-composition.md](reference/child-composition.md)                                                                |
| Text Wrapping              | [reference/text-wrapping.md](reference/text-wrapping.md)                                                                        |
| Style Panel                | [reference/style-panel.md](reference/style-panel.md)                                                                            |
| Component Registry         | [reference/component-registry.md](reference/component-registry.md)                                                              |
| ADR 리뷰 저장소 (Layer 0)  | [docs/adr/reviews/](../../../docs/adr/reviews/) — `review-adr` Phase 4.5 자동 영속화                                            |
| 렌더링 아키텍처 결정       | [ADR-900](../../../docs/adr/completed/900-unified-skia-rendering-engine.md) — PixiJS 제거, 대안/결정/Gate                       |
| 렌더링 구현 상세           | [ADR-900 breakdown](../../../docs/adr/design/900-unified-skia-engine-breakdown.md) — SceneGraph, Rust Layout, CSS3 렌더링 Phase |
| 컴포넌트 스펙 (잔존 3개)   | [COMPONENT_SPEC.md](../../../docs/COMPONENT_SPEC.md) — 일반 컴포넌트는 catalog                                                  |
| CSS 상세                   | [CSS_ARCHITECTURE.md](../../../docs/features/completed/CSS_ARCHITECTURE.md) — ITCSS + tv()                                      |
| Spec↔CSS 경계              | [SPEC_CSS_BOUNDARY.md](../../../docs/reference/components/SPEC_CSS_BOUNDARY.md) — Leaf vs Container 분류표 (잔존 spec 3개 한정) |

## 서브에이전트 위임 가이드라인

### 수정 금지 패턴 (Protected Patterns)

```
1. _hasChildren 패턴 (삭제/이동/조건 변경 금지)
2. SHELL_ONLY_CONTAINER_TAGS / SYNTHETIC_CHILD_PROP_MERGE_TAGS 관련 로직 (ADR-072)
3. buildSpecNodeData.ts의 _hasChildren 3-branch 주입 로직
4. rearrangeShapesForColumn 가드 (specBuildHelpers.ts / buildSpecNodeData.ts)
5. TAG_SPEC_MAP 등록 로직
```

### 위임 템플릿

```markdown
## 작업 범위

[구체적 수정 내용만 기술]

## 수정 대상 파일

[파일 목록]

## 수정 패턴

[Before → After 예시 코드]

## 수정 금지

- \_hasChildren, COMPLEX_COMPONENT_TAGS, shapes early return, 요청 범위 외 리팩토링
```

## 공통 세션 프로토콜

### 세션 시작

1. agent dispatch 시 자동 로드: `.claude/agents/<자신>.md` (subagent 정의, 공식) + 본 SKILL.md (Skill 호출 시)
2. 인수인계 정보는 공식 auto memory (~/.claude/projects/<slug>/memory/MEMORY.md §최근 세션 인수인계 + project-\*.md) 참조 — `.claude/progress.md` / `next-session-prompt.md` 컨벤션은 폐기됨 (2026-05-09), `session-*.md` 파일 컨벤션도 실사용 0건으로 폐기 (2026-08-18)
3. 중복 작업 방지, 막힌 지점 이어가기

### 세션 종료

1. 발견사항은 공식 auto memory (`~/.claude/projects/<slug>/memory/feedback-*.md` 또는 `project-*.md`) 에 기록
2. 인수인계는 공식 auto memory (memory/project-\*.md + MEMORY.md §최근 세션 인수인계 인덱스 1줄) 에 기록 — `.claude/progress.md` / `session-*.md` 신규 생성 금지
3. 빌드 통과, 커밋 가능한 상태 보장

### 에러 복구

- 같은 에러 3회 반복 금지 → 2회 실패 후 전략 전환
- `any`/`@ts-ignore` 우회 금지
- 불확실 시 질문, 해결 불가 시 에스컬레이션

### 출력 크기 제한

- 반환은 1,000~2,000 토큰 이내 구조화된 요약
- 상세 → 파일 저장 후 경로만 반환

## ADR

- **[ADR-001](../../../docs/adr/completed/001-state-management.md)** Zustand | **[ADR-002](../../../docs/adr/completed/002-styling-approach.md)** ITCSS+tv() | **[ADR-003](../../../docs/adr/completed/003-canvas-rendering.md)** Canvas
- **[ADR-004](../../../docs/adr/completed/004-preview-isolation.md)** iframe | **[ADR-005](../../../docs/adr/completed/005-css-text-wrapping.md)** Text Wrap | **[ADR-008](../../../docs/adr/completed/008-layout-engine.md)** Taffy (레이아웃 엔진은 이후 [ADR-916](../../../docs/adr/completed/916-unified-rust-engine.md) 자체 Rust 엔진 `packages/composition-engine` 으로 대체)
- **[Component Spec](../../../docs/COMPONENT_SPEC.md)** 단일 소스 아키텍처 (spec 시대 기록, DEPRECATED — 현재 D3 SSOT는 [ADR-142](../../../docs/adr/completed/142-starter-spec-component-system-cutover.md) catalog `COMPONENT_RULES_TABLE`)

## 규칙 효과 측정

규칙의 실제 효과를 추적하여 컨텍스트 예산을 최적화합니다.

### 측정 템플릿

리뷰어 에이전트가 공식 auto memory `feedback-review-recurring-patterns.md` 에 추가 기록 (또는 신규 `feedback-*.md` 작성):

| 규칙     | 위반 수 | False Positive | 실효성          | 비고 |
| -------- | ------- | -------------- | --------------- | ---- |
| (규칙명) | N       | N              | HIGH/MEDIUM/LOW |      |

### 정리 기준

- **위반 0 + 3개월 이상**: Claude가 내재화했을 가능성 → 제거 후보 (컨텍스트 절약)
- **False Positive > 50%**: 규칙 조건이 너무 넓음 → 조건 좁히기
- **위반 빈번 + 실효성 LOW**: 규칙이 모호함 → Why 보강 또는 코드 레벨 방지로 전환

## Evals

### Positive (발동해야 하는 경우)

- "캔버스에서 텍스트가 잘려요" → ✅ 캔버스 렌더링 규칙 참조 필요
- "Zustand store에 슬라이스 추가하려면?" → ✅ 상태 관리 규칙 참조
- "이 코드가 composition 컨벤션에 맞나?" → ✅ 규칙 인덱스 조회
- "Spec 파일 새로 만들 때 주의사항?" → ✅ Spec 빌드/등록 규칙

### Negative (발동하면 안 되는 경우)

- "README 업데이트해줘" → ❌ 문서 작업, 코드 패턴 무관
- "git commit 해줘" → ❌ Git 작업
- "이 React 훅 설명해줘" (일반 React) → ❌ composition 특화 아님
- "TypeScript 타입 추론 원리가 뭐야?" → ❌ 일반 TS 지식
