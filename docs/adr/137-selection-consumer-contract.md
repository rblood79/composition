# ADR-137: 선택 소비자 계약 — Page-bound Action 의 stale-mismatch 차단

## Status

Proposed — 2026-05-15

## Context

composition Builder 의 Page 선택 → Frame 속성 변경 흐름에서 **선택한 Page 가 아닌 다른 Page 에 frame 이 적용되는 race** 가 누적 재현되고 있다 (사용자 정황: "동일한 오류가 몇번이나 발생되었다"). 코드 추적으로 3 요인 결합을 확인:

1. **Properties 패널이 `useDeferredValue` 기반 selectedElement 사용** — `apps/builder/src/builder/stores/index.ts:304` 의 `useDebouncedSelectedElementData` 가 이름은 debounce 지만 실제 구현은 `useDeferredValue(currentData)`. React scheduler 가 결정하는 비결정적 지연 윈도우 동안 selectedElement 가 이전 page 의 body 로 stale.
2. **PageBodyEditor 가 stale `element.page_id` 를 `currentPageId` 보다 우선 채택** — `editors/PageBodyEditor.tsx:32-42`. `useCanonicalPropertyElement(elementId)` 가 page_id 필터 없이 ID 단독 lookup (`useCanonicalPropertyRead.ts:51-59`).
3. **PageLayoutSelector handler closure 가 commit 시점 currentPageId 재검증 안 함** — `editors/PageLayoutSelector.tsx:56-74`. `applyPageFrameBindingCanonicalPrimary` 는 명시 pageId 인자로 정확 동작 (mutation pipeline 결함 없음), 결함은 caller chain 위쪽의 stale pageId.

본질 영역: **Builder consumer + Zustand selection / currentPageId + page-frame binding caller boundary** 의 상태 동기화 (D3 시각 스타일 단일 영역으로 좁히면 fix scope 도 시각 영역으로 좁아져 stale chain 차단 누락). 이전 fix 시도들이 "element.page_id 가 정본" 이라는 ADR-130 projection body 정합과 충돌하여 단일 경로 fix 가 회귀 유발 → 우회된 채 잔존, 결과적으로 "동일 오류 반복" 정황 누적.

자세한 원인 분석은 `~/.claude/plans/node-skia-page-fuzzy-marble.md` §"Root Cause" 참조.

**Hard Constraints**:

1. Canvas FPS 60fps 유지 — React concurrent priority (`useDeferredValue` 기반 inspector update) 보존. Layer A 변경은 zero-runtime-cost 만 허용.
2. ADR-130 projection body / frame body 흐름 회귀 0 — `element.page_id == null` 케이스가 정상 동작해야 함.
3. ADR-040 (Atomic Page Activation) / ADR-074 (input pipeline SSOT) / ADR-116 / ADR-122 (canonical-only-runtime) 의 selection state 정의 변경 없음.
4. apps/builder type-check baseline **550 유지** (실측 2026-05-15 `apps/builder/.type-errors-baseline.txt`, no new violations).

**Soft Constraints**:

- 4 deferred selection consumer 호출처 (PropertiesPanel:777 / StylesPanel:32,50 / EventsPanel:281) 및 3 page-bound editor (PageBodyEditor / PageLayoutSelector / PageParentSelector) audit
- 신규 page-bound editor 추가 시 type/runtime 강제로 자동 적용
- "동일 오류 반복" 정황 — 사람-리뷰 의존 규칙 명문화만으로는 drift 차단 불가, 강제 메커니즘 필수

## Alternatives Considered

### 대안 A: 임시방편 UI guard 만 (PageBodyEditor stale check + PageLayoutSelector commit-time re-check)

- 설명: PageBodyEditor 의 `targetPageId` 계산에 `element.page_id !== currentPageId` 시 currentPageId 우선 fallback + PageLayoutSelector 의 `handleLayoutChange` 가 commit 직전 store currentPageId 재확인 후 mismatch 시 silently no-op. 2 컴포넌트만 수정.
- 근거: minimal fix 원칙 (Anthropic systematic-debugging Phase 4). 본 plan §"권장 수정 — Defense-in-depth" 의 핵심 1+2 만 적용.
- 위험:
  - 기술: **LOW** — 코드 변경 작음 (2 file, < 30 line)
  - 성능: **LOW** — 함수 1-2회 추가 비교
  - 유지보수: **HIGH** — 신규 page-bound editor (예: PageThemeOverride / PageAccessibilityOverride 등 미래 추가) 가 같은 deferred chain 을 다시 통과해도 guard 의무 없음 → drift 재발. 사용자 정황 "동일 오류 반복" 의 정확한 재현 경로
  - 마이그레이션: **LOW** — 2 file 변경, 즉시 land

### 대안 B: Selection Consumer Contract SSOT 격상 (4-layer) — 권장

- 설명: selection consumer 의 카테고리 분류 규약 (A. page-bound mutation / B. element-bound mutation / C. selection display) 자체를 SSOT 로 격상. 4 layer 로 강제:
  - **Layer A** — Typed accessor 분리. **page-bound mutation API 는 `SelectedElement` 를 받지 않고 `ImmediateSelectionSnapshot` opaque 타입만 받음** (TypeScript 구조적 타입에서 intersection brand 는 supertype assign 차단 불가 → opaque snapshot 으로 진입점 자체 분리). deferred 결과는 `DeferredSelectedElement` 로 표시 (display 전용).
  - **Layer B** — Page-bound action contract: 진입점 2 갈래 — (1) `state.applyPageFrameBindingFromSelection(snapshot, frameId)` selection 경로, 내부에서 snapshot.currentPageId 직접 사용, caller stale pageId 진입 불가. (2) `state.applyPageFrameBindingExplicit({ pageId, frameId, contextReason })` projection body / editing context 전용, mismatch 검증 skip. **caller pageId 와 live store mismatch 가 코드 차원에서 불가능**.
  - **Layer C** — Codex/Claude 양쪽 진입점에 규칙 명문화 — `.agents/rules/state-management.md` + `.agents/skills/composition-patterns/SKILL.md` + `.agents/skills/INDEX.md` (Codex 우선 진입점) + `.claude/rules/state-management.md` + `.claude/skills/composition-patterns/SKILL.md` (legacy 참조 병행).
  - **Layer D** — vitest contract test + UI invariant test (PageBodyEditor 가 stale mismatch 상태에서 PageLayoutSelector/PageParentSelector hide/disable) + (선택) ESLint rule.
- 근거: React 18 공식 docs ("useDeferredValue is intended for display, not effectful work"), TypeScript opaque type pattern (Effect TS / branded opaque types — intersection brand 의 supertype assignability 한계 회피), Redux Toolkit thunk pattern (live state 직접 read), 본 코드베이스 ADR-907 (Container style pipeline 4-Layer SSOT 패턴) 과 디자인 언어 정합.
- 위험:
  - 기술: **MEDIUM** — 4 layer 통합 디자인 + opaque snapshot 진입점 분리 학습 비용. 신규 page-bound action 추가 시 2 진입점 분류 의무
  - 성능: **LOW** — typed accessor / action contract / opaque snapshot 모두 zero-runtime-cost. mismatch guard 는 explicit 경로의 dev 모드 console.error 1회 추가
  - 유지보수: **LOW** — drift 차단 메커니즘 다중 layer (opaque snapshot 으로 caller-stale 진입 자체 차단). 신규 editor 추가 시 type/test 자동 강제
  - 마이그레이션: **MEDIUM** — Phase 5 응용 정정 (3 editor) + 후속 StylesPanel / EventsPanel audit (별도 ADR scope)

### 대안 C: page_id SSOT 위치 변경 — element.page_id 강등 + store.currentPageId 단독

- 설명: page identity 의 SSOT 위치 자체를 `store.currentPageId` 단독으로 확정. `element.page_id` 는 reference data 로 강등. projection body 등 explicit context 경로는 `pageContext` prop 으로 명시. ambiguity (element.page_id vs currentPageId 중 어느 것이 정본인가) 자체를 제거.
- 근거: Single Source of Truth principle 의 강한 해석. 일부 SPA 가 page identity 를 router/store 로 단일화하는 패턴 (Next.js usePathname / TanStack Router).
- 위험:
  - 기술: **HIGH** — `element.page_id` 의 모든 consumer (history record / IndexedDB persistence / ADR-130 hydration migration / projection body / canonical document tree) 영향. 15+ file 변경 추정
  - 성능: **MEDIUM** — element 들이 page-derive 시 추가 traversal/lookup
  - 유지보수: **MEDIUM** — ambiguity 제거되지만 explicit pageContext propagation 부담이 모든 page-bound consumer 에 전파
  - 마이그레이션: **HIGH** — ADR-130 projection body 흐름 + IndexedDB hydration migration 회귀 위험. ADR-116/122 canonical mirror 와도 cross-cutting

### Risk Threshold Check

| 대안 | 기술  | 성능 | 유지보수 | 마이그레이션 | HIGH+ 개수 |
| ---- | :---: | :--: | :------: | :----------: | :--------: |
| A    |   L   |  L   |  **H**   |      L       |     1      |
| B    |   M   |  L   |    L     |      M       |   **0**    |
| C    | **H** |  M   |    M     |    **H**     |     2      |

루프 판정: **대안 B 가 HIGH 0 — threshold 통과**. 대안 A 는 유지보수 HIGH (drift 재발, 사용자 정황 직접 재현), 대안 C 는 기술 + 마이그레이션 HIGH (회귀 위험). 추가 대안 도입 불필요 — B 가 race 차단 + 미래 회귀 차단을 동시 달성.

## Decision

**대안 B: Selection Consumer Contract SSOT 격상 (4-layer)** 를 선택한다.

선택 근거:

1. 본 ADR 의 두 가지 목적 (race 차단 + 미래 회귀 차단) 모두 달성. type/runtime/rule 3 강제로 사용자 정황 "동일 오류 반복" 의 재발 경로 차단.
2. 응용 ADR (PageBodyEditor / PageLayoutSelector / PageParentSelector 정정 — 본 ADR Phase 5) 의 prerequisite 가 되어 base/응용 분리 가능. ADR-130 / ADR-040 / ADR-074 / ADR-116 / ADR-122 와 직교 — 선행 ADR 의 전제 reverse 부담 0.
3. 잔존 운영 위험 (Risks 섹션) 이 모두 MED/LOW — Gates 로 통과 조건 관리 가능.

기각 사유:

- **대안 A 기각**: 유지보수 HIGH — 사용자 정황 "동일 오류 반복" 이 정확히 이 패턴의 재현. 신규 page-bound editor 추가 시 guard 누락 강제 메커니즘 부재. 사람-리뷰 의존만으로는 review-fatigue 누적 → 회귀 직결.
- **대안 C 기각**: scope inflation 1.5x 이상 + projection body / IndexedDB hydration migration 회귀 위험 HIGH. ambiguity 자체 제거는 더 큰 reframing → 별도 ADR 후보 (본 ADR 의 후속 작업으로 분리 가능).

> 구현 상세: [137-selection-consumer-contract-breakdown.md](design/137-selection-consumer-contract-breakdown.md)

## Risks

본 ADR 채택 후 이행 중 관리해야 할 잔존 운영 위험:

| ID  | 위험                                                                                                                                                                | 심각도 | 대응                                                                                                                                                                      |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | 신규 page-bound editor 추가 시 진입점 분류 누락 (selection 경로용 `applyPageFrameBindingFromSelection` 대신 explicit API 오용 / 또는 reverse) → mismatch guard 우회 |  MED   | Layer A opaque snapshot 진입점 (type-check) + Layer D contract test 가 자동 감지 (Gate G2/G5). `applyPageFrameBindingExplicit` 의 `contextReason` 인자 누락 시 type error |
| R2  | projection body / explicit-context 케이스 분류 누락 → 정당한 경로가 mismatch guard 로 차단됨                                                                        |  MED   | Phase 5 회귀 fixture + Chrome MCP smoke (Gate G6)                                                                                                                         |
| R3  | StylesPanel / EventsPanel deferred-chain commit race 잔존 (본 ADR 의 1차 응용 scope 밖)                                                                             |  LOW   | 후속 audit ADR 후보. Layer A opaque snapshot 진입점이 부분 차단 — 새 mutation 시그니처 강제                                                                               |
| R4  | opaque snapshot 이 `as` cast 누적 시 mutation API 검증 우회                                                                                                         |  LOW   | Layer D ESLint rule (선택 도입) + contract test 가 `as ImmediateSelectionSnapshot` AST 차단                                                                               |
| R5  | Layer C 규칙 명문화가 LLM agent 의 신규 코드 생성 시 자동 적용 안 됨 (review 의존)                                                                                  |  LOW   | `.agents/skills/composition-patterns/SKILL.md` (Codex 우선) + `.claude/skills/composition-patterns/SKILL.md` (legacy) CRITICAL 규칙 entry — 양쪽 agent prompt 진입점 보장 |

R1+R2 가 동시에 HIGH 로 누적되면 Phase 5 진입 전 stop + Gate G6 재범위.

## Gates

| Gate | 시점                     | 통과 조건                                                                                                                                                                                                                                                                                                     | 실패 시 대안                                                                                                               |
| ---- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| G1   | Phase 0 audit lock-in    | 4 deferred consumer 호출처 분류 + 3 page-bound editor inventory + scope inflation 1.5x 미달                                                                                                                                                                                                                   | scope inflation 발견 시 사용자 confirm 후 재범위                                                                           |
| G2   | Phase 1 Layer A land     | type-check 3/3 PASS + page-bound mutation API 시그니처가 `ImmediateSelectionSnapshot` opaque 타입만 받음 + `SelectedElement` 또는 `DeferredSelectedElement` 직접 전달 시 type error negative fixture 통과                                                                                                     | opaque snapshot 진입점 분리 보강 (Codex round 1 review #1 정정 — intersection brand 단독으로는 supertype assign 차단 불가) |
| G3   | Phase 2 Layer B land     | `pageFrameBinding.test.ts` 신규 fixture (selection 경로 snapshot live state 일치 + explicit 경로 mismatch skip) 통과 + projection roundtrip 0 회귀                                                                                                                                                            | 진입점 2 갈래 (`FromSelection` / `Explicit`) 분리 보강                                                                     |
| G4   | Phase 3 Layer C land     | `.agents/rules/state-management.md` + `.agents/skills/composition-patterns/SKILL.md` + `.agents/skills/INDEX.md` (Codex 우선) + `.claude/*` 동등 entry 통합 review 통과 + 응용 ADR 참조 의무 명시                                                                                                             | rule 본문 보강 후 재 review                                                                                                |
| G5   | Phase 4 Layer D land     | `selectionConsumerContract.test.ts` 통과 + UI invariant test (PageBodyEditor stale mismatch 시 page-bound editor hide/disable) 통과 + type-check baseline **550 유지** (no new violations)                                                                                                                    | ESLint rule 도입 보류 가능, contract test 만으로 진행                                                                      |
| G6   | Phase 5 응용 정정        | (a) 사용자 재현 시나리오 — stale window 클릭 시 **mutation 0 + dev warn + page-bound editor hide/disable** + (b) deferred update 후 PageBodyEditor B_body 갱신 → 재클릭 시 **Page B 만 정상 적용** + (c) projection body 회귀 0 + Chrome MCP 시각 검증 (Codex round 1 review #2 정정 — 단계별 통과 조건 명시) | Layer B mismatch guard 강화 + UI invariant 추가                                                                            |
| G7   | Phase 6 Implemented 승격 | preflight PASS + authenticated Chrome MCP smoke PASS + 사용자 explicit confirm                                                                                                                                                                                                                                | —                                                                                                                          |

## Consequences

### Positive

- 사용자 정황 "동일 오류 반복" 의 재발 경로 차단 — type-check (Layer A `ImmediateSelectionSnapshot` opaque 진입점) / contract test (Layer D) / runtime guard (Layer B 진입점 2 갈래) 3 강제로 drift 차단력 HIGH
- 신규 page-bound editor 추가 시 자동 적용 — `SelectedElement` / `DeferredSelectedElement` 가 page-bound mutation 시그니처에 진입 불가 (opaque snapshot 만 허용), 진입점 분류 누락 시 type error
- StylesPanel / EventsPanel 의 잠재 commit race 도 Layer A opaque snapshot 으로 부분 차단 (deferred 결과 진입 자체 차단)
- ADR-907 (Container style pipeline 4-Layer) 와 정합 — composition 의 "SSOT contract" 디자인 언어 강화
- 본 ADR 의 카테고리 분류 규약이 후속 audit ADR (StylesPanel / EventsPanel) 의 base 로 재사용

### Negative

- opaque snapshot 진입점 학습 비용 — 신규 page-bound mutation handler 작성 시 `readImmediateSelectionSnapshot()` + `applyPageFrameBindingFromSelection(snapshot, ...)` 패턴 의무. `SelectedElement` / `DeferredSelectedElement` 진입 차단
- 진입점 2 갈래 분류 의무 — 새 page-bound mutation 추가 시 `FromSelection` vs `Explicit` 진입점 선택 강제. explicit 경로 사용 시 `contextReason` 인자 명시 필수. 사람이 분류 누락 시 R1 발현
- StylesPanel / EventsPanel commit race 의 본격 audit 는 본 ADR scope 외 — 후속 ADR 작성 부담 잔존
- Phase 5 응용 정정이 PageParentSelector 의 동일 패턴 fix 까지 포함 → 작업량 +1 file (추정 5-7 file 범위 안)
