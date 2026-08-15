# ADR-184 Design Breakdown: canonical mutation 순서 러너

> 본문: [184-canonical-mutation-runner.md](../completed/184-canonical-mutation-runner.md)
> 상태: **Implemented 2026-08-15** — Phase 0~3 당일 종결 (G1 표현 가능률 100% / G2 파일럿 live 실측 / G3 가드 RED 실측). 기존 경로 이관은 비스코프 유지

## 1. 목표 형태

4단 순서 (canonical → set → `_rebuildIndexes` → persist) 를 **러너가 소유**하고, 신규 mutation 은 스테이지 함수만 제공한다 — 순서 위반이 시그니처상 표현 불가:

```ts
runCanonicalMutation({
  canonical: (/* doc */) => mergeElementsCanonicalPrimary(items),
  store: (prev) => ({ elements: [...prev.elements, ...newItems] }),
  history: () => recordInsertEvent(items),
  // persist 는 러너가 백그라운드 수행 (호출자 선택 아님)
});
```

**기존 경로 이관은 비스코프** — "회귀 위험 대비 이득 작음" 판정 (state-management.md 잔존 표, 2026-07-15) 유지. 본 ADR 은 위반 **누적을 멈추는** 것이지 과거를 청산하는 것이 아니다.

## 2. Phase 분할

### Phase 0 — mutation 경로 인벤토리 (freeze) → G1 ✅ Implemented 2026-08-15 (G1 PASS — §4)

- `canonicalMutations.ts` wrapper 호출부 전수 조사 (15개 비테스트 파일 — `mergeElementsCanonicalPrimary` / `setElementsCanonicalPrimary` / `moveElement*` / `applyElementOrderCanonicalPrimary` 계열):
  - 순서 패턴 분류: **정합** (canonical 1차 — `elementCreation.ts` `createAddElementAction` 기준형) / **역전 잔존** (`instanceActions.ts` `createInstance`·`resetInstanceOverrideField` — set 1차) / **특수** (batch / projection 경유 / history 이벤트 유형별)
  - 각 패턴이 §1 러너 시그니처로 표현 가능한지 판정 — **표현 불가 유형 발견 시 시그니처 확장 또는 scope 재판정** (G1)
- 산출물: 패턴 분류표 + 러너 표현 가능률 (본 문서 §4 에 기록)
- 주의: [ADR-127 M3] 추정 vs 실측 gap 은 본 phase 인벤토리로 흡수 — fork 사유 아님

### Phase 1 — 러너 구현 + 단위 테스트 ✅ Implemented 2026-08-15 (`canonicalMutationRunner.ts` + 단위 8건)

- 위치: `apps/builder/src/adapters/canonical/canonicalMutationRunner.ts` (wrapper 와 같은 adapters 계층 — stores 가 아니라 canonical 인접)
- 순서 강제: canonical → store `set` → `_rebuildIndexes` → history entry → persist(백그라운드)
  - history 위치 **확정 (Phase 0 반영)**: 러너 슬롯은 rebuild 뒤 — 기준형 `addElementsToStore` (canonical → set → rebuild → history → persist) 와 CLAUDE.md 파이프라인 (Memory → Index → History → DB) 정합. prev-상태 캡처가 필요한 history 는 러너 호출 **전** closure 로 캡처 (batch형 관례)
- **부분 실패 semantics 명문화**: 동기 구간 (canonical/set/rebuild) 은 throw 전파 (현행 관례 동일 — 러너가 새 복구 로직을 발명하지 않는다), persist 는 fire-and-forget + 오류 로깅 (현행 `persistActiveCanonicalDocument` 관례)
- 단위 테스트: 스테이지 호출 순서 단언 (spy 순서) + canonical 스테이지 없이 store 스테이지만 넘기는 오용이 타입 에러인지 (required 필드)

### Phase 2 — 파일럿 1경로 적용 → G2 ✅ Implemented 2026-08-15 (addElementsToStore 전환 — G2 live PASS: Select 추가 canonical 85→90/store 77→82 동기 + 새로고침 정합)

- 신규 mutation 1건 (다음 기능 작업에서 발생) 또는 최근 추가된 소형 mutation 1건을 러너 경유로 전환
- live builder 실측: 해당 mutation 실행 → 새로고침 → canonical/IndexedDB 정합 확인 (완료 기준 live behavior 게이트)
- 파일럿에서 시그니처 마찰 발견 시 Phase 1 로 1회 회귀 허용 (2회 이상이면 G1 재판정)

### Phase 3 — 러너 우회 차단 정적 가드 → G3 ✅ Implemented 2026-08-15 (RED 실측 PASS + state-management.md 갱신)

- `canonicalMutationRunner.static.test.ts`: 러너/기존-잔존 allowlist **밖** 파일에서 `mergeElementsCanonicalPrimary` 등 wrapper 직호출 발견 시 FAIL
  - allowlist = Phase 0 인벤토리의 기존 경로 고정 목록 — **추가 금지** (신규는 러너 경유가 유일 경로)
  - `historyActions.static.test.ts` 의 source-order 가드는 그대로 존치 (기존 경로 감시 담당 — 계약 불변)
- RED 실측: allowlist 밖 가짜 직호출 파일 주입 → FAIL 확인 → **편집 역적용으로 원복** (`git checkout` 금지 — memory: red-check-revert-via-git-checkout-destroys-parallel-wip)
- `.claude/rules/state-management.md` 갱신: "신규 mutation 은 러너 경유" 절 추가 + 잔존 표에 본 ADR 링크

### 비스코프 (명시)

- 기존 경로 이관 (createInstance / resetInstanceOverrideField 등 allowlist 전체) — 재개 조건: 해당 경로에서 stale-canonical race 가 **재발**했을 때, 그 경로 1건만 러너로 이관 (전면 이관 아님)
- history 시스템 자체의 재설계 (ADR-180 계보) — 러너는 현행 history API 를 스테이지로 감쌀 뿐

## 3. 파일 변경 요약 (Implemented 실측 — 테스트는 디렉터리 `__tests__/` 컨벤션)

| 파일                                                                                   | 변경                                     |
| -------------------------------------------------------------------------------------- | ---------------------------------------- |
| `apps/builder/src/adapters/canonical/canonicalMutationRunner.ts`                       | 신설 — 러너 + semantics                  |
| `apps/builder/src/adapters/canonical/__tests__/canonicalMutationRunner.test.ts`        | 신설 — 순서/타입 단언 (8건)              |
| `apps/builder/src/adapters/canonical/__tests__/canonicalMutationRunner.static.test.ts` | 신설 — 우회 차단 가드 (G3)               |
| `apps/builder/src/builder/factories/utils/elementCreation.ts` (파일럿)                 | `addElementsToStore` 러너 경유 전환      |
| `apps/builder/src/builder/factories/utils/__tests__/elementCreation.indexSync.test.ts` | 수동 순서 단언 → 러너 경유 단언으로 갱신 |
| `apps/builder/src/builder/main/BuilderCore.tsx`                                        | 러너 bridge(rebuildIndexes) DI 등록      |
| `.claude/rules/state-management.md`                                                    | 신규 경로 규칙 + 잔존 표 링크            |

## 4. Phase 0 산출물 기록란 (freeze — 2026-08-15 실측)

### 4-1. 호출부 패턴 분류표 (실호출 15파일 / 호출 지점 26곳)

> `canonicalDocumentSync.ts` 는 주석 언급뿐 (실호출 0) — 계수 제외. wrapper 6종 정의: `canonicalMutations.ts:1841/1854/1868/1895/1942/1992`.

**A. 정합 — canonical 1차 (mutation, 러너 표현 대상)**

| 파일:라인                                                        | 형태                                                                                  |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `factories/utils/elementCreation.ts:138` (기준형)                | ① canonical → ② set → ③ rebuild → ④ history → ⑤ persist(백그라운드)                   |
| `stores/utils/elementCreation.ts:211, 305`                       | canonical → history → set 계열                                                        |
| `stores/utils/elementUpdate.ts:810, 1016` (경유 :126/:132)       | canonical → set                                                                       |
| `stores/utils/elementRemoval.ts:317`                             | canonical → history                                                                   |
| `stores/inspectorActions.ts:745, 988, 1420, 1467`                | canonical → persist                                                                   |
| `stores/elements.ts:1613, 1770` (move형)                         | canonical move → history(trackCanonicalMove) → set(**canonical derive** — patch 아님) |
| `stores/utils/instanceActions.ts:605` (batch형, 2026-07-15 해소) | prev 캡처 → canonical → history(replace event) → set → rebuild                        |

**B. 역전 잔존 — set 1차 (allowlist 고정, 이관 비스코프)**

| 파일:라인                                                          | 형태                                     |
| ------------------------------------------------------------------ | ---------------------------------------- |
| `stores/utils/instanceActions.ts:703` (createInstance)             | set → sync → history → rebuild → persist |
| `stores/utils/instanceActions.ts:983` (resetInstanceOverrideField) | set → sync → rebuild → persist           |

**C. 특수 — mutation 아님 (러너 대상 아님, allowlist 고정)**

| 파일:라인                                            | 성격                                                                                       |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `overlay/useTextEdit.ts:174`                         | canonical-only silent edit (history 없음 의도적)                                           |
| `hooks/useIframeMessenger.ts:219`                    | preview 생성 요소 수신 → canonical hydrate                                                 |
| `main/BuilderCore.tsx:253`                           | page shell bridge 구독 (store→canonical derive + 자동 persist)                             |
| `panels/nodes/FramesTab/FramesTab.tsx:178, 250, 412` | DB → canonical 보강 hydration                                                              |
| `panels/nodes/PagesSection.tsx:292`                  | 페이지 삭제 후 canonical 정렬 + persist queue                                              |
| `LayoutPresetSelector/usePresetApply.ts:216`         | preset slot 제거 canonical set + persist                                                   |
| `stores/history/historyActions.ts:103`               | undo/redo 재생 (구 IndexedDB v1 entry 전용 분기)                                           |
| `canvas/hooks/useDragBridge.ts:536, 910, 969`        | history transaction 이 **최외곽** (runInTransaction 내 canonical move → rebuild → persist) |

### 4-2. 러너 표현 가능률 + 표현 불가 유형

- **신규 mutation 에 나타날 패턴 = A형 (표준/move/batch) → 100% 표현 가능**. 스테이지 순서는 기준형과 CLAUDE.md 파이프라인 (Memory → Index → History → DB) 정합: **canonical → set → `_rebuildIndexes` → history → persist(백그라운드)**. move형의 "set = canonical derive" 는 store 스테이지가 partial 반환 함수라 표현 가능. prev 캡처 (batch형) 는 러너 호출 전 closure 로 해결.
- **시그니처**: `canonical` **required** / `store`·`history` optional (canonical-only silent edit 신규 경로 수용) / persist 는 러너 소유 (호출자 선택 아님).
- **표현 불가 유형 = 없음**. C형 (hydration/bridge/undo-replay) 은 mutation 이 아니라 **러너 대상 자체가 아님** — 기존 파일 allowlist 로 고정하고, 신규 비-mutation 흐름이 wrapper 직호출 시 가드 FAIL = 리뷰 신호 (R4 대응 그대로: "추가 시도 자체가 리뷰 대상").
- **G1 판정: PASS** — scope 재판정 불요.

### 4-3. allowlist 고정 목록 (15파일 — 추가 금지)

```
builder/factories/utils/elementCreation.ts
builder/hooks/useIframeMessenger.ts
builder/main/BuilderCore.tsx
builder/panels/nodes/FramesTab/FramesTab.tsx
builder/panels/nodes/PagesSection.tsx
builder/panels/properties/editors/LayoutPresetSelector/usePresetApply.ts
builder/stores/elements.ts
builder/stores/history/historyActions.ts
builder/stores/inspectorActions.ts
builder/stores/utils/elementCreation.ts
builder/stores/utils/elementRemoval.ts
builder/stores/utils/elementUpdate.ts
builder/stores/utils/instanceActions.ts
builder/workspace/canvas/hooks/useDragBridge.ts
builder/workspace/overlay/useTextEdit.ts
```
