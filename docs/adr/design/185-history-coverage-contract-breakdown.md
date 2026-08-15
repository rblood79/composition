# ADR-185 Design Breakdown: history coverage 계약

> 본문: [185-history-coverage-contract.md](../185-history-coverage-contract.md)
> 상태: Proposed — 2026-08-15

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

### Phase 0 — history coverage 감사 (freeze) → G1

- 대상: ADR-184 Phase 0 인벤토리 (15파일 / 26 호출 지점, 184 breakdown §4) 를 재사용하되 판정 축을 바꾼다 — "순서 정합" 이 아니라 **"history entry 기록 여부"**.
- 방법: 각 mutation 지점에서 `historyManager.addEntry` / `trackCanonical*` 도달 여부 + 도달하지 않는 경우 의도적 생략 사유 존재 여부 (skipHistory caller batch / silent live edit / hydration·bridge·undo 재생 등 비-mutation).
- 분류 3종: **기록함** / **의도적 생략 (사유 명시)** / **gap (사용자-가시 mutation 인데 기록 없음)**.
- 산출물: §4 기록란에 분류표 + gap 목록 freeze. 각 gap 에 사용자-가시 증상 1줄 (예: "페이지 삭제 후 Cmd+Z 무반응").
- 선판정 gap 후보 (본문 Context 실증): 페이지 생성/삭제 (`appendPageShell` elements.ts:1264 / `removePageLocal` elements.ts:1317 — entry 기록 0건, `setCurrentPage` 컨텍스트 전환만 존재).
- 주의: [ADR-127 M3] 추정 vs 실측 gap 은 본 phase 인벤토리로 흡수 — fork 사유 아님.

### Phase 1 — 러너 history 스테이지 필수화 + 단위 테스트 → G2

- `canonicalMutationRunner.ts`: §2 목표 형태 반영 — `HistoryStage` union + required. 실행부는 `typeof stages.history === "function"` 분기 + `{ skip: "" }` throw.
- 기존 호출부 영향: 파일럿 1곳 (`factories/utils/elementCreation.ts:153` — history 함수 이미 제공) 은 **무변경 컴파일 통과** 확인 (BC 0%).
- 단위 테스트 (`canonicalMutationRunner.test.ts` 추가):
  - `{ skip: "사유" }` 형태에서 history no-op + 나머지 스테이지 순서 불변
  - `{ skip: "" }` throw
  - `@ts-expect-error` — `history` 생략이 타입 에러 (canonical required 가드와 동형)
  - 기존 8건 PASS 유지
- live behavior: 파일럿 경로 1회 exercise — 복합 컴포넌트 추가 → Cmd+Z 제거 확인 (기존 동작 불변).

### Phase 2 — 규칙 문서 집행 + gap 목록 정본화 → G3

- `.claude/rules/state-management.md` §"신규 mutation 은 러너 경유" 절에 history 계약 1문단 추가: "history 스테이지는 필수 — 기록하지 않으면 `{ skip: 사유 }` 명시" + 본 ADR / gap 목록 링크.
- 신규 정적 가드 **신설 없음** — 신규 파일의 러너 경유는 ADR-184 `canonicalMutationRunner.static.test.ts` 가 이미 강제하고, 러너 진입 후의 기록 여부는 Phase 1 타입이 집행한다 (RED 대체 = `@ts-expect-error` 테스트).
- CHANGELOG: 계약 도입 (Architecture) + gap 목록 중 미수리 건 가시화 (Known — 페이지 생성/삭제 undo 불가).

### 비스코프 (명시)

- **gap 수리 전부** (페이지 생성/삭제 undo 포함) — 사용자 결정 2026-08-15. 재개: gap 목록 기반 별도 작업 (페이지 undo 는 body+서브트리+pagePositions+활성 전환이 얽혀 별도 설계 검토 대상).
- 기존 allowlist 15파일 경로의 러너 이관 — ADR-184 판정 승계 (재개 조건 동일: 해당 경로 race 재발 시 그 경로 1건만).
- history entry 스키마 / undo·redo 재생 경로 변경 — ADR-177/180/181 계보 무변경.

## 4. Phase 0 산출물 기록란 (freeze — 실행 시 기록)

### 4-1. coverage 분류표

_(Phase 0 실행 시 기록 — 26 지점 × 분류 3종)_

### 4-2. gap 목록 (수리 백로그 정본)

| #            | 경로                                                     | 사용자-가시 증상                 | 상태               |
| ------------ | -------------------------------------------------------- | -------------------------------- | ------------------ |
| G-1 (선판정) | 페이지 생성/삭제 (`appendPageShell` / `removePageLocal`) | 페이지 추가·삭제 후 Cmd+Z 무반응 | 미수리 (별도 작업) |

_(Phase 0 전수 감사에서 추가 발견 시 이어서 기록)_

## 5. 파일 변경 요약 (예상)

| 파일                                                                            | 변경                                                           |
| ------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| `apps/builder/src/adapters/canonical/canonicalMutationRunner.ts`                | `HistoryStage` union + `history` required + 빈 skip 사유 throw |
| `apps/builder/src/adapters/canonical/__tests__/canonicalMutationRunner.test.ts` | skip 형태 / 빈 사유 throw / `@ts-expect-error` 생략 불가 추가  |
| `apps/builder/src/builder/factories/utils/elementCreation.ts`                   | 무변경 (컴파일 통과 확인만)                                    |
| `.claude/rules/state-management.md`                                             | history 계약 1문단 + gap 목록 링크                             |
| `docs/adr/design/185-history-coverage-contract-breakdown.md` §4                 | Phase 0 산출물 기록                                            |
| `docs/CHANGELOG.md`                                                             | 계약 도입 + Known gap 가시화                                   |
