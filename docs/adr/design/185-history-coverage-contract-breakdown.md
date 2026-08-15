# ADR-185 Design Breakdown: history coverage 계약

> 본문: [185-history-coverage-contract.md](../completed/185-history-coverage-contract.md)
> 상태: **Implemented 2026-08-15** — Phase 0~2 당일 종결 (G1 26지점 전수 분류 / G2 RED→GREEN+live undo / G3 문서 집행). gap 수리 (G-1 페이지 생성·삭제) 는 비스코프 백로그

## 1. Fork checkpoint 4 질문 lock-in (adr-writing.md — 사용자 confirm 2026-08-15)

| #   | 질문                       | 판정                                                                                                                                                                                                                                                         |
| --- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | base / 응용 분류           | **ADR-184 (순서 러너) = base, 본 ADR = 응용** — 러너의 `history` 스테이지 슬롯을 집행 지점으로 쓰는 확장. 184 Implemented (2026-08-15) 가 선행 완료                                                                                                          |
| 2   | schema 직교성              | 축 직교 — 184 는 "스테이지 실행 **순서**", 본 ADR 은 "history 스테이지 **존재 여부**". 본 ADR 의 시그니처 변경은 184 `CanonicalMutationStages` 의 specialization (optional → required union)                                                                 |
| 3   | 선행 ADR 전제 reverse 검증 | 184 의 "history optional (canonical-only silent edit 신규 경로 수용)" 전제 (184 breakdown §4-2) 를 "명시 opt-out (`{ skip: 사유 }`)" 로 강화 — 수용 자체는 유지하므로 방향 반전 아님. 184 의 "기존 경로 이관 비스코프 / allowlist freeze" 판정은 그대로 승계 |
| 4   | codex 3차 미루지 않기      | scope 질문 (gap 수리 편입 여부) 을 착수 시점 AskUserQuestion 으로 제기 — **사용자 선택: "계약만 — 수리는 별도" (2026-08-15)**                                                                                                                                |

## 2. 목표 형태

ADR-184 러너의 `history` 스테이지를 optional 에서 **명시 필수 union** 으로 강화 — 신규 mutation 경로에서 "조용한 생략" 이 타입상 표현 불가:

```ts
// canonicalMutationRunner.ts — 현행 (184): history?: (result: TResult) => void
type HistoryStage<TResult> =
  | ((result: TResult) => void) // 기록 — 스테이지 함수가 entry 를 남긴다
  | { skip: string }; // 의도적 생략 — 사유 문자열 필수 (빈 문자열 런타임 거부)

interface CanonicalMutationStages<TResult> {
  canonical: () => TResult; // (184 그대로) required
  store?: (result: TResult) => void; // (184 그대로)
  history: HistoryStage<TResult>; // ← optional → required union
  persistOptions?: DocumentPersistOptions; // (184 그대로)
}
```

- 러너 실행부: 함수면 호출, `{ skip }` 이면 no-op (사유는 코드 리뷰 가시성용 — 런타임 소비 없음, 빈 문자열만 throw).
- **기존 경로 (러너 밖 allowlist 15파일) 이관은 비스코프** — ADR-184 판정 승계. 본 ADR 은 위반 누적을 멈추는 것이지 과거 청산이 아니다.
- **gap 수리 비스코프** — 사용자 결정 2026-08-15 ("계약만 — 수리는 별도"). Phase 0 gap 목록이 수리 백로그의 정본.

## 3. Phase 분할

### Phase 0 — history coverage 감사 (freeze) → G1 ✅ Implemented 2026-08-15 (G1 PASS — §4, gap = G-1 단독)

- 대상: ADR-184 Phase 0 인벤토리 (15파일 / 26 호출 지점, 184 breakdown §4) 를 재사용하되 판정 축을 바꾼다 — "순서 정합" 이 아니라 **"history entry 기록 여부"**.
- 방법: 각 mutation 지점에서 `historyManager.addEntry` / `trackCanonical*` 도달 여부 + 도달하지 않는 경우 의도적 생략 사유 존재 여부 (skipHistory caller batch / silent live edit / hydration·bridge·undo 재생 등 비-mutation).
- 분류 3종: **기록함** / **의도적 생략 (사유 명시)** / **gap (사용자-가시 mutation 인데 기록 없음)**.
- 산출물: §4 기록란에 분류표 + gap 목록 freeze. 각 gap 에 사용자-가시 증상 1줄 (예: "페이지 삭제 후 Cmd+Z 무반응").
- 선판정 gap 후보 (본문 Context 실증): 페이지 생성/삭제 (`appendPageShell` elements.ts:1264 / `removePageLocal` elements.ts:1317 — entry 기록 0건, `setCurrentPage` 컨텍스트 전환만 존재).
- 주의: [ADR-127 M3] 추정 vs 실측 gap 은 본 phase 인벤토리로 흡수 — fork 사유 아님.

### Phase 1 — 러너 history 스테이지 필수화 + 단위 테스트 → G2 ✅ Implemented 2026-08-15 (RED 4 failed 실측 → GREEN 347 PASS + type-check 0 + live undo exercise)

- `canonicalMutationRunner.ts`: §2 목표 형태 반영 — `HistoryStage` union + required. 실행부는 `typeof stages.history === "function"` 분기 + `{ skip: "" }` throw.
- 기존 호출부 영향: **비테스트** 호출부는 파일럿 1곳 (`factories/utils/elementCreation.ts:153` — history 함수 이미 제공) 뿐이라 **무변경 컴파일 통과** (BC 0% 는 비테스트 소스 기준). 단, **기존 러너 단위 테스트 8건 중 history 생략 형태 케이스** (`canonicalMutationRunner.test.ts:100-105` optional-stages / `:128-131` persistOptions / `:144` persist 실패 등 4곳+) 는 required 전환 시 컴파일 실패 → `history: { skip: "runner-test" }` 추가 수정 후 PASS (리뷰 round 1 정정 — "무수정 PASS" 아님).
- 단위 테스트 (`canonicalMutationRunner.test.ts` 추가):
  - `{ skip: "사유" }` 형태에서 history no-op + 나머지 스테이지 순서 불변
  - `{ skip: "" }` throw
  - `@ts-expect-error` — `history` 생략이 타입 에러 (canonical required 가드와 동형)
  - 기존 8건 PASS (history 생략형 케이스는 위 skip 반영 후)
- live behavior: 파일럿 경로 1회 exercise — 복합 컴포넌트 추가 → Cmd+Z 제거 확인 (기존 동작 불변).

### Phase 2 — 규칙 문서 집행 + gap 목록 정본화 → G3 ✅ Implemented 2026-08-15 (state-management.md 계약 문단 + iframe ingress skip 사유 주석 + CHANGELOG)

- `.claude/rules/state-management.md` §"신규 mutation 은 러너 경유" 절에 history 계약 1문단 추가: "history 스테이지는 필수 — 기록하지 않으면 `{ skip: 사유 }` 명시" + 본 ADR / gap 목록 링크.
- 신규 정적 가드 **신설 없음** — 신규 파일의 러너 경유는 ADR-184 `canonicalMutationRunner.static.test.ts` 가 이미 강제하고, 러너 진입 후의 기록 여부는 Phase 1 타입이 집행한다 (RED 대체 = `@ts-expect-error` 테스트).
- CHANGELOG: 계약 도입 (Architecture) + gap 목록 중 미수리 건 가시화 (Known — 페이지 생성/삭제 undo 불가).

### 비스코프 (명시)

- **gap 수리 전부** (페이지 생성/삭제 undo 포함) — 사용자 결정 2026-08-15. 재개: gap 목록 기반 별도 작업 (페이지 undo 는 body+서브트리+pagePositions+활성 전환이 얽혀 별도 설계 검토 대상).
- 기존 allowlist 15파일 경로의 러너 이관 — ADR-184 판정 승계 (재개 조건 동일: 해당 경로 race 재발 시 그 경로 1건만).
- history entry 스키마 / undo·redo 재생 경로 변경 — ADR-177/180/181 계보 무변경.

## 4. Phase 0 산출물 (freeze — 2026-08-15 실측)

### 4-1. coverage 분류표 (ADR-184 인벤토리 26 지점 전수 — G1 PASS)

**기록함 (15 지점)**:

| 지점                                                                    | 기록 근거                                                                                                            |
| ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `factories/utils/elementCreation.ts:138` (러너 파일럿)                  | history 스테이지 canonical insert event (`fbedcfcaa`)                                                                |
| `stores/utils/elementCreation.ts:211, 305`                              | `addEntry` (+`skipHistory` caller-batch 옵션)                                                                        |
| `stores/utils/elementUpdate.ts:810` (batch props)                       | `addEntry` :833 (단건 update :277 / replace :586)                                                                    |
| `stores/utils/elementUpdate.ts:1016` (batch elements)                   | `addEntry` :1047 (move events)                                                                                       |
| `stores/utils/elementRemoval.ts:317`                                    | `addEntry` (+`skipHistory` :260 — migration 경로)                                                                    |
| `stores/inspectorActions.ts:745` (`updateAndSave` helper)               | `addEntry` :675 (prev 캡처 :634-636)                                                                                 |
| `stores/elements.ts:1613, 1770` (move형)                                | `trackCanonicalMove` (+주석 :1621 — 과거 gap 사후 수리)                                                              |
| `stores/utils/instanceActions.ts:605` (batch)                           | replace event entry                                                                                                  |
| `stores/utils/instanceActions.ts:703` (createInstance)                  | history 단계 포함 (184 표)                                                                                           |
| `stores/utils/instanceActions.ts:983` (resetInstanceOverrideField 내부) | **`addEntry` :950** (replace events — 감사 중 "기록 없음" 오판 정정: 함수 시작 :879, 983 은 addEntry 이후 꼬리 구간) |
| `LayoutPresetSelector/usePresetApply.ts:216`                            | `runInTransaction` :448 최외곽 병합 (removeElements entry)                                                           |
| `canvas/hooks/useDragBridge.ts:536, 910, 969`                           | history transaction 최외곽                                                                                           |

**의도적 생략 (5 지점 — 사유 존재)**:

| 지점                                                          | 사유                                                                                                                                                     |
| ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `stores/inspectorActions.ts:988` (updateSelectedStylePreview) | preview transient — commit 이 `updateAndSave` 로 기록                                                                                                    |
| `stores/inspectorActions.ts:1420, 1467` (Fills preview 2종)   | 동일 preview 패턴                                                                                                                                        |
| `overlay/useTextEdit.ts:174`                                  | silent live edit — commit 시 `updateElementProps` 가 기록 (:390 주석)                                                                                    |
| `hooks/useIframeMessenger.ts:219` (flush)                     | **경계 사례** — preview 런타임 생성 요소 ingress (builder 사용자 편집 아님). 단 코드 주석에 생략 사유 미기재 — Phase 2 에서 skip 사유 주석 1줄 보강 대상 |

**비-mutation (5 지점 — 러너/계약 대상 아님)**:

`main/BuilderCore.tsx:253` (bridge 구독) / `panels/nodes/FramesTab.tsx:178, 250, 412` (hydration) / `stores/history/historyActions.ts:103` (undo·redo 재생)

**gap 소속 (1 지점 + wrapper 미경유 표면 2)**:

`panels/nodes/PagesSection.tsx:292` (페이지 삭제 후처리 — 삭제 자체가 미기록) + wrapper 미경유 mutation 표면 `appendPageShell` (`usePageManager.ts:247, 301` 경유) / `removePageLocal` (`PagesSection.tsx:241` 경유) → G-1

### 4-2. gap 목록 (수리 백로그 정본 — freeze)

| #   | 경로                                                                                                                                                                                                              | 사용자-가시 증상                                                                              | 상태                                        |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------- |
| G-1 | 페이지 생성/삭제 (`stores/elements.ts:1264` `appendPageShell` / `:1317` `removePageLocal` — entry 0건, `setCurrentPage` 컨텍스트 전환만. 호출자 `usePageManager.ts:247,301` / `PagesSection.tsx:241` 도 기록 0건) | 페이지 추가·삭제 후 Cmd+Z 무반응 (삭제된 페이지의 body+요소 서브트리+pagePositions 복원 불가) | 미수리 (별도 작업 — 사용자 결정 2026-08-15) |

전수 감사 결과 추가 gap 없음 — G-2 후보였던 `resetInstanceOverrideField` 는 `addEntry` :950 실측으로 기각 (§4-1).

## 5. 파일 변경 요약 (예상)

| 파일                                                                            | 변경                                                                                                         |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `apps/builder/src/adapters/canonical/canonicalMutationRunner.ts`                | `HistoryStage` union + `history` required + 빈 skip 사유 throw                                               |
| `apps/builder/src/adapters/canonical/__tests__/canonicalMutationRunner.test.ts` | skip 형태 / 빈 사유 throw / `@ts-expect-error` 생략 불가 추가 + 기존 history 생략형 케이스 4곳+ 에 skip 반영 |
| `apps/builder/src/builder/factories/utils/elementCreation.ts`                   | 무변경 (컴파일 통과 확인만)                                                                                  |
| `.claude/rules/state-management.md`                                             | history 계약 1문단 + gap 목록 링크                                                                           |
| `docs/adr/design/185-history-coverage-contract-breakdown.md` §4                 | Phase 0 산출물 기록                                                                                          |
| `docs/CHANGELOG.md`                                                             | 계약 도입 + Known gap 가시화                                                                                 |
