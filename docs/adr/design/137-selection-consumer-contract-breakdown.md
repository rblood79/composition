# ADR-137 Design Breakdown — Selection Consumer Contract

> **본 문서는 ADR-137 의 구현 상세** (Phase / 파일 변경표 / 코드 예시 / 검증 절차) 만 보관한다. 결정 / 위험 / Gates 는 [`../137-selection-consumer-contract.md`](../137-selection-consumer-contract.md) 본문 참조.

## 1. ADR fork 관점 점검 (4 질문 lock-in — `.claude/rules/adr-writing.md` §"4 질문 통과 절차")

| 질문                          | 답                                                                                                                                                                                                                                                                                                                   |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. base / 응용 분류           | **base** ADR. 응용 = ADR-137 후속 phase (PageBodyEditor / PageLayoutSelector / PageParentSelector 정정) 또는 향후 별도 응용 ADR (StylesPanel / EventsPanel deferred-chain audit). 본 ADR 의 schema(typed accessor + action contract + 카테고리 분류 규약) 가 응용 ADR 의 prerequisite                                |
| 2. schema 직교성              | Zustand selection state shape 변경 없음. **소비 규약** 만 추가. ADR-040 (Atomic Page Activation), ADR-074 (input pipeline SSOT), ADR-116 / ADR-122 (canonical-only-runtime) 의 selection 정의 그대로 사용 ✓                                                                                                          |
| 3. 선행 ADR 전제 reverse 검증 | ADR-040 의 atomic page activation 패턴 / ADR-074 의 input 측 SSOT / ADR-116/122 canonical mirror — 모두 변경 없이 그대로 사용. reverse 부담 0 ✓                                                                                                                                                                      |
| 4. codex 3차 미루지 말 것     | 핵심 의문 = "type brand + action contract source 표식 + runtime mismatch guard 3-layer 가 모두 필요한가, type brand 만으로 충분한가". Phase 0 inventory 시점에 결정 lock-in. layer 축소는 [feedback-analysis-precision-patterns](../../../.claude/.. "link") 의 §4 "currentPageId 단독 사용 회귀 함정" 으로 차단됨 ✓ |

사용자 explicit confirm 받음 (2026-05-15 본 세션 ADR-137 작성 지시).

## 2. Phase 분해

| Phase       | 목표                                                                 | 작업 단위                                                                                                                     | Gate |
| ----------- | -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ---- |
| **Phase 0** | deferred selection consumer audit lock-in                            | 4 호출처 분류 + 잠재 page-bound editor inventory + scope freeze                                                               | G1   |
| **Phase 1** | Layer A 도입 — typed accessor + DeferredSelectedElement brand        | `stores/index.ts` 신규 immediate accessor + brand type + 기존 deferred 류 cast                                                | G2   |
| **Phase 2** | Layer B 도입 — action contract source 표식 + mismatch guard          | `pageFrameBinding.ts` action 시그니처 + selection / explicit-context 분기 + dev assert                                        | G3   |
| **Phase 3** | Layer C 명문화 — rules / SKILL 갱신                                  | `.claude/rules/state-management.md` §"Selection Consumer Contract" 신설 + `composition-patterns/SKILL.md` CRITICAL 규칙 entry | G4   |
| **Phase 4** | Layer D 검증 인프라 — contract test + (선택) ESLint rule             | `selectionConsumerContract.test.ts` 신설 + page-bound mutation source 표식 누락 시 type error 보강                            | G5   |
| **Phase 5** | 응용 정정 — PageBodyEditor / PageLayoutSelector / PageParentSelector | UI invariant (deferred page_id vs live currentPageId mismatch 시 editor disable) + handler closure 정정                       | G6   |
| **Phase 6** | Implemented 승격 + README / CHANGELOG                                | 재현 시나리오 + projection body 회귀 fixture + Chrome MCP 시각 검증 통과 후                                                   | G7   |

## 3. Phase 0 — Audit Lock-in

### 3-1. deferred selection consumer 4 호출처 분류 (현재 측정값)

| 파일                                                             | 라인 | 분류                  | 비고                                                                   |
| ---------------------------------------------------------------- | ---- | --------------------- | ---------------------------------------------------------------------- |
| `apps/builder/src/builder/panels/properties/PropertiesPanel.tsx` | 777  | **혼재** (A + B)      | page-bound editor (PageBodyEditor 류) + element-bound editor 분기 동시 |
| `apps/builder/src/builder/panels/styles/StylesPanel.tsx`         | 32   | **B** (element-bound) | style mutation chain                                                   |
| `apps/builder/src/builder/panels/styles/StylesPanel.tsx`         | 50   | **B** (element-bound) | style mutation chain (multi-select 분기)                               |
| `apps/builder/src/builder/panels/events/EventsPanel.tsx`         | 281  | **B** (element-bound) | event handler 등록                                                     |

→ PropertiesPanel 만 page-bound mutation 입구를 직접 가짐. StylesPanel / EventsPanel 은 element-bound — 본 ADR 의 1차 응용 범위는 **PropertiesPanel 분기**, 후속 audit 가 StylesPanel / EventsPanel commit race 점검.

### 3-2. page-bound editor inventory (잠재 회귀 후보)

| 파일                             | page-bound? | 현재 상태                                 |
| -------------------------------- | ----------- | ----------------------------------------- |
| `editors/PageBodyEditor.tsx`     | ✅          | targetPageId 계산 결함 (요인 2)           |
| `editors/PageLayoutSelector.tsx` | ✅          | closure-captured pageId (요인 3)          |
| `editors/PageParentSelector.tsx` | ✅          | 동일 패턴 의심 — 본 ADR Phase 5 에서 확정 |

→ scope freeze: 위 3 editor + PropertiesPanel 분기. **신규 page-bound editor 추가 시 Layer A+B 자동 적용** 으로 미래 회귀 차단.

### 3-3. Gate G1

- 위 분류 표 / inventory 가 `breakdown.md` §3 에 lock-in
- scope inflation 1.5x trigger 점검 — 추정 5-7 file 대비 실측 5-7 file 일치, inflation 없음

## 4. Phase 1 — Layer A (Typed Accessor + Opaque Snapshot)

> **Codex round 1 review #1 정정 (2026-05-15)**: 기존 `SelectedElement & { __brand }` intersection brand 디자인은 TypeScript 구조적 타입에서 supertype assign 차단 불가 (branded 타입이 `SelectedElement` 의 subtype 이므로 `f(x: SelectedElement)` 시그니처에 그대로 assign 가능 — type error 보장 불가). **page-bound mutation API 가 `SelectedElement` 를 받지 않고 `ImmediateSelectionSnapshot` opaque 타입만 받는 진입점 분리** 로 정정.

### 4-1. 변경 대상

| 파일                                                                  | 변경                                                                                                                                                                                                                                                                                                                 |
| --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/builder/src/builder/stores/index.ts`                            | 신규 `useImmediateSelectionSnapshot()` accessor — `ImmediateSelectionSnapshot` opaque 타입 반환 / 기존 `useDebouncedSelectedElementData()` return 을 `DeferredSelectedElement` 로 명시 (display 전용 마커) / `useImmediateSelectedElementId()` + `useImmediateCurrentPageId()` 도 즉시 read 용 helper 로 함께 export |
| `apps/builder/src/builder/inspector/types.ts` (or 적절한 type module) | `ImmediateSelectionSnapshot` opaque 타입 + `DeferredSelectedElement` display 마커 타입 export                                                                                                                                                                                                                        |

### 4-2. 코드 예시 (의도 표현, 실제 구현은 phase 진입 시 확정)

```ts
// opaque snapshot — 외부에서 직접 생성 불가, accessor 만 출구
declare const IMMEDIATE_SNAPSHOT_BRAND: unique symbol;
export interface ImmediateSelectionSnapshot {
  readonly [IMMEDIATE_SNAPSHOT_BRAND]: true;
  readonly selectedElementId: string | null;
  readonly currentPageId: string | null;
}

// deferred 결과는 display 전용 표시 — mutation API 가 받지 않음
declare const DEFERRED_BRAND: unique symbol;
export type DeferredSelectedElement = SelectedElement & {
  readonly [DEFERRED_BRAND]: true;
};

export function useImmediateSelectionSnapshot(): ImmediateSelectionSnapshot {
  return useStore((s) => ({
    [IMMEDIATE_SNAPSHOT_BRAND]: true as const,
    selectedElementId: s.selectedElementId,
    currentPageId: s.currentPageId,
  }));
}

// 기존 deferred accessor — return 을 DeferredSelectedElement 로 표시
export function useDebouncedSelectedElementData(): DeferredSelectedElement | null {
  const currentData = useSelectedElementData();
  return useDeferredValue(currentData) as DeferredSelectedElement | null;
}

// page-bound mutation API 시그니처 — ImmediateSelectionSnapshot 만 받음
//   → SelectedElement / DeferredSelectedElement 직접 전달 시 type error
export function applyPageFrameBindingFromSelection(
  snapshot: ImmediateSelectionSnapshot,
  frameId: string | null,
): Promise<void> {
  // 내부에서 snapshot.currentPageId 직접 사용
  // caller 가 stale pageId 를 전달할 진입점 자체가 없음
}
```

**핵심**: `ImmediateSelectionSnapshot` 는 opaque (외부에서 literal 생성 불가). `useImmediateSelectionSnapshot()` 만 출구. `SelectedElement` 와 구조적으로 비호환 → `f(x: ImmediateSelectionSnapshot)` 시그니처에 `SelectedElement` / `DeferredSelectedElement` 전달 시 **type error 보장**.

### 4-3. Gate G2

- type-check 3/3 PASS
- `DeferredSelectedElement` 가 mutation handler 시그니처에 직접 전달 시 type error 발생 (negative fixture 추가)

## 5. Phase 2 — Layer B (Action Contract Source 표식 + Mismatch Guard)

### 5-1. 변경 대상

| 파일                                                                            | 변경                                                                                                                                                                                                                                                                |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/builder/src/adapters/canonical/pageFrameBinding.ts`                       | `ApplyPageFrameBindingInput` 에 `source: "selection" \| "explicit-context"` 추가 / `applyPageFrameBindingCanonicalPrimary` 내부에 `source === "selection"` 시 `getElementsState().currentPageId === pageId` 일치 검증 + 불일치 시 dev `console.error` + commit 차단 |
| `apps/builder/src/builder/stores/elements.ts` (or 별도 page-bound action slice) | 신규 store action `applyPageFrameBinding({ frameId, source })` 래퍼 — 내부에서 caller pageId 전달 + source 표식                                                                                                                                                     |

### 5-2. 코드 예시 (의도)

```ts
// pageFrameBinding.ts
export interface ApplyPageFrameBindingInput {
  pageId: string;
  frameId: string | null;
  source: "selection" | "explicit-context";
  getElementsState: () => ElementsStateForPageBinding;
  setPages: (pages: Page[]) => void;
}

export async function applyPageFrameBindingCanonicalPrimary(
  input: ApplyPageFrameBindingInput,
): Promise<void> {
  const live = input.getElementsState();
  if (input.source === "selection") {
    if (live.currentPageId == null || live.currentPageId !== input.pageId) {
      if (import.meta.env.DEV) {
        console.error("[applyPageFrameBinding] stale target rejected", {
          caller_pageId: input.pageId,
          live_currentPageId: live.currentPageId,
        });
      }
      return; // commit 차단
    }
  }
  // 기존 mutation 로직 (변경 없음)
  // ...
}
```

### 5-3. Gate G3

- targeted vitest `pageFrameBinding.test.ts` round-trip 통과 (source 표식 포함)
- 신규 fixture: `source: "selection"` + pageId mismatch → commit 차단 + 무 mutation
- `source: "explicit-context"` 경로 → 검증 skip + 정상 commit
- projection body roundtrip 회귀 0

## 6. Phase 3 — Layer C (규칙 명문화)

> **Codex round 1 review #3 정정 (2026-05-15)**: `AGENTS.md:13` 정책 — `.agents/*` 가 Codex 우선 진입점, `.claude/*` 는 legacy reference. Layer C 대상이 `.claude/*` 만이면 Codex 진입점에서 Selection Consumer Contract 미적용 → 재발 차단 빈틈. **`.agents/*` 를 1차 대상, `.claude/*` 를 동등 병행 대상으로 확장**.

### 6-1. 변경 대상

| 파일                                                                         | 변경                                                                                                                     |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `.agents/rules/state-management.md` **(Codex 우선)**                         | §"Selection Consumer Contract (CRITICAL)" 신설 — 3 카테고리 표 + 허용 / 금지 accessor + 신규 mutation 카테고리 분류 의무 |
| `.agents/skills/composition-patterns/SKILL.md` **(Codex 우선)**              | CRITICAL 규칙 entry — Selection consumer 분류 누락 시 즉시 차단                                                          |
| `.agents/skills/INDEX.md` **(Codex 우선)**                                   | Selection Consumer Contract 항목 인덱스 추가 (관련 skill / rule cross-link)                                              |
| `.claude/rules/state-management.md` (legacy 병행)                            | §"Selection Consumer Contract (CRITICAL)" 동등 신설 — 본문은 `.agents/*` 와 동기화                                       |
| `.claude/skills/composition-patterns/SKILL.md` (legacy 병행)                 | CRITICAL 규칙 entry 동등 — 본문은 `.agents/*` 와 동기화                                                                  |
| `.agents/rules/ssot-hierarchy.md` + `.claude/rules/ssot-hierarchy.md` (선택) | D3 운영 규칙 부록으로 "Selection consumer SSOT" 참조 추가                                                                |

### 6-2. Gate G4

- rule entry 통합 review (관점 점검 통과)
- 응용 ADR 작성 시 본 규칙 참조 의무 명시

## 7. Phase 4 — Layer D (검증 인프라)

### 7-1. 변경 대상

| 파일                                                                                              | 변경                                                                                                                                                                                              |
| ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/builder/src/__tests__/selectionConsumerContract.test.ts`                                    | 신규 contract test — page-bound mutation 함수 시그니처가 `ImmediateSelectionSnapshot` opaque 타입만 받음을 AST 로 검증 + `SelectedElement` / `DeferredSelectedElement` 인자 negative fixture 통과 |
| `apps/builder/src/adapters/canonical/__tests__/pageFrameBinding.test.ts`                          | 신규 fixture 추가 — selection 경로 (snapshot 기반 live state 일치) + explicit 경로 (mismatch 검증 skip) + projection body roundtrip 회귀 0                                                        |
| `apps/builder/src/builder/panels/properties/editors/__tests__/PageBodyEditor.uiInvariant.test.ts` | 신규 UI invariant test — PageBodyEditor 가 stale mismatch 상태 (deferred element.page_id ≠ live currentPageId) 에서 PageLayoutSelector / PageParentSelector 를 hide/disable 처리                  |
| (선택) `.eslint-rules/no-immediate-snapshot-cast.js`                                              | `as ImmediateSelectionSnapshot` cast 누적 시 review 차단 — Layer D opaque snapshot 진입점 우회 방지                                                                                               |

### 7-2. Gate G5

- contract test 통과
- `pageFrameBinding.test.ts` 신규 fixture 통과
- type-check 3/3 PASS
- (선택) ESLint rule 통과 — 본 ADR 안 도입 여부는 Phase 4 진입 시 사용자 confirm 후 결정

## 8. Phase 5 — 응용 정정 (PageBodyEditor / PageLayoutSelector / PageParentSelector)

### 8-1. PageBodyEditor

| 파일                         | 변경                                                                                                                                                                                                                                            |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `editors/PageBodyEditor.tsx` | `targetPageId` 계산 정정 — deferred `element.page_id` 와 live `currentPageId` mismatch 시 UI 측 invariant 적용 (`PageLayoutSelector` / `PageParentSelector` disable 또는 hide). projection body 의 `element.page_id == null` 경로는 그대로 유지 |

### 8-2. PageLayoutSelector

| 파일                                                                                                              | 변경                                                                                                                                                                    |
| ----------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `editors/PageLayoutSelector.tsx`                                                                                  | `handleLayoutChange` 가 신규 store action `applyPageFrameBinding({ frameId, source: "selection" })` 호출 — pageId 직접 전달 제거. Layer B mismatch guard 가 commit 차단 |
| 또는 caller 가 pageId 명시 전달이 필요한 case (Frame editing context 진입 시) → `source: "explicit-context"` 사용 |

### 8-3. PageParentSelector

| 파일                             | 변경                                                                  |
| -------------------------------- | --------------------------------------------------------------------- |
| `editors/PageParentSelector.tsx` | 동일 패턴 정정 — handler 가 신규 page-bound action 사용 + source 표식 |

### 8-4. Gate G6

- 재현 시나리오 (Page A → B 즉시 frame 변경) → Page B 만 적용 ✓
- projection body editing context → PageLayoutSelector 정상 동작 ✓ (회귀 0)
- Chrome MCP 시각 검증 — 두 page 동시 보이는 multi-page canvas 에서 Page B body 클릭 → frame 변경 시 Page B 만 갱신

## 9. Phase 6 — Implemented 승격

### 9-1. 작업

| 파일                                                    | 변경                                                                                                                                    |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/adr/137-selection-consumer-contract.md`           | Status `Accepted → Implemented` 승격 + Implementation Notes 추가                                                                        |
| `docs/adr/README.md`                                    | 미구현 → 구현 완료 섹션 이동 + 카운트 +1/-1                                                                                             |
| `docs/CHANGELOG.md`                                     | `### Bug Fixes` + `### Architecture` 엔트리 추가 (사용자-가시 = Page Frame 변경 race 회귀, 아키텍처 = Selection Consumer Contract SSOT) |
| `docs/adr/completed/137-selection-consumer-contract.md` | 본문 archive (ADR closure 5-step 메모리 참조)                                                                                           |

### 9-2. Gate G7

- type-check 3/3 PASS + **baseline 550 유지 (실측 2026-05-15 `apps/builder/.type-errors-baseline.txt`, no new violations)**
- targeted vitest (contract test + pageFrameBinding round-trip + UI invariant + 회귀 fixture) PASS
- `pnpm run codex:preflight` PASS
- authenticated Chrome MCP smoke (재현 시나리오 + projection body 회귀) PASS
- 사용자 explicit confirm — "Implemented 승격 가능" 명시

## 10. 검증 절차 — 사용자 재현 시나리오 (Layer B + Phase 5 land 후)

1. 프로젝트에 Page A / Page B 2 개 생성. 각각 Frame X / Frame Y 적용 상태.
2. Node panel 에서 Page A 선택 — Properties 패널에 PageBodyEditor + PageLayoutSelector 표시.
3. 같은 panel 에서 Page B 즉시 클릭 — `currentPageId = B` 전환.
4. Properties 패널이 deferred selection 으로 인해 잠깐 PageBodyEditor (A_body) 를 보여주는 윈도우 내에 "Apply Frame" 선택 → Frame Z.
5. **기대 (수정 후)**: Layer B mismatch guard 가 `source: "selection"` 경로의 pageId(A) ≠ currentPageId(B) 감지 → commit 차단. dev console 에 stale target rejected 출력. Page A / Page B 모두 frame 변경 없음.
6. deferred update 가 commit 되어 PageBodyEditor 가 B_body 로 갱신된 후 사용자가 다시 "Apply Frame Z" 선택 → Page B 에 정상 적용.

projection body 회귀 체크:

1. Frame editing context 진입 — projection body 선택.
2. PageLayoutSelector 가 표시되더라도 `source: "explicit-context"` 경로로 호출되어 mismatch 검증 skip → 정상 동작.

## 11. 잠재 후속 작업 (본 ADR scope 밖)

- **StylesPanel / EventsPanel deferred-chain audit** — 본 ADR 의 Layer A brand 와 contract test 가 자동으로 회귀 차단하지만, 상세 분류는 별도 audit ADR 후보 (현 scope 미달)
- **page_id SSOT 위치 변경** (대안 C) — element.page_id 강등 + projection explicit context — 더 큰 reframing, 별도 ADR 후보
- **신규 page-bound editor 추가 워크플로** — `composition-patterns/SKILL.md` 의 신규 editor 추가 체크리스트에 "Selection Consumer Contract 분류 의무" 추가 (Phase 3 에서 land)
