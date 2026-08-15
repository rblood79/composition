# ADR-184 Design Breakdown: canonical mutation 순서 러너

> 본문: [184-canonical-mutation-runner.md](../184-canonical-mutation-runner.md)
> 상태: Proposed — Phase 계획 초안 (리뷰 전)

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

### Phase 0 — mutation 경로 인벤토리 (freeze) → G1

- `canonicalMutations.ts` wrapper 호출부 전수 조사 (15개 비테스트 파일 — `mergeElementsCanonicalPrimary` / `setElementsCanonicalPrimary` / `moveElement*` / `applyElementOrderCanonicalPrimary` 계열):
  - 순서 패턴 분류: **정합** (canonical 1차 — `elementCreation.ts` `createAddElementAction` 기준형) / **역전 잔존** (`instanceActions.ts` `createInstance`·`resetInstanceOverrideField` — set 1차) / **특수** (batch / projection 경유 / history 이벤트 유형별)
  - 각 패턴이 §1 러너 시그니처로 표현 가능한지 판정 — **표현 불가 유형 발견 시 시그니처 확장 또는 scope 재판정** (G1)
- 산출물: 패턴 분류표 + 러너 표현 가능률 (본 문서 §4 에 기록)
- 주의: [ADR-127 M3] 추정 vs 실측 gap 은 본 phase 인벤토리로 흡수 — fork 사유 아님

### Phase 1 — 러너 구현 + 단위 테스트

- 위치: `apps/builder/src/adapters/canonical/canonicalMutationRunner.ts` (wrapper 와 같은 adapters 계층 — stores 가 아니라 canonical 인접)
- 순서 강제: canonical → store `set` → `_rebuildIndexes` → history entry → persist(백그라운드)
  - history 위치 주의: 현행 정합 패턴은 경로별로 history 시점이 다르다 (elementCreation 은 action 내, instance snapshot batch 는 canonical sync 후 entry) — Phase 0 분류를 반영해 스테이지 순서를 확정하고, 본 breakdown 갱신
- **부분 실패 semantics 명문화**: 동기 구간 (canonical/set/rebuild) 은 throw 전파 (현행 관례 동일 — 러너가 새 복구 로직을 발명하지 않는다), persist 는 fire-and-forget + 오류 로깅 (현행 `persistActiveCanonicalDocument` 관례)
- 단위 테스트: 스테이지 호출 순서 단언 (spy 순서) + canonical 스테이지 없이 store 스테이지만 넘기는 오용이 타입 에러인지 (required 필드)

### Phase 2 — 파일럿 1경로 적용 → G2

- 신규 mutation 1건 (다음 기능 작업에서 발생) 또는 최근 추가된 소형 mutation 1건을 러너 경유로 전환
- live builder 실측: 해당 mutation 실행 → 새로고침 → canonical/IndexedDB 정합 확인 (완료 기준 live behavior 게이트)
- 파일럿에서 시그니처 마찰 발견 시 Phase 1 로 1회 회귀 허용 (2회 이상이면 G1 재판정)

### Phase 3 — 러너 우회 차단 정적 가드 → G3

- `canonicalMutationRunner.static.test.ts`: 러너/기존-잔존 allowlist **밖** 파일에서 `mergeElementsCanonicalPrimary` 등 wrapper 직호출 발견 시 FAIL
  - allowlist = Phase 0 인벤토리의 기존 경로 고정 목록 — **추가 금지** (신규는 러너 경유가 유일 경로)
  - `historyActions.static.test.ts` 의 source-order 가드는 그대로 존치 (기존 경로 감시 담당 — 계약 불변)
- RED 실측: allowlist 밖 가짜 직호출 파일 주입 → FAIL 확인 → **편집 역적용으로 원복** (`git checkout` 금지 — memory: red-check-revert-via-git-checkout-destroys-parallel-wip)
- `.claude/rules/state-management.md` 갱신: "신규 mutation 은 러너 경유" 절 추가 + 잔존 표에 본 ADR 링크

### 비스코프 (명시)

- 기존 경로 이관 (createInstance / resetInstanceOverrideField 등 allowlist 전체) — 재개 조건: 해당 경로에서 stale-canonical race 가 **재발**했을 때, 그 경로 1건만 러너로 이관 (전면 이관 아님)
- history 시스템 자체의 재설계 (ADR-180 계보) — 러너는 현행 history API 를 스테이지로 감쌀 뿐

## 3. 파일 변경 요약 (추정 — Phase 0 에서 실측 보정)

| 파일                                                                         | 변경                          |
| ---------------------------------------------------------------------------- | ----------------------------- |
| `apps/builder/src/adapters/canonical/canonicalMutationRunner.ts`             | 신설 — 러너 + semantics       |
| `apps/builder/src/adapters/canonical/canonicalMutationRunner.test.ts`        | 신설 — 순서/타입 단언         |
| `apps/builder/src/adapters/canonical/canonicalMutationRunner.static.test.ts` | 신설 — 우회 차단 가드         |
| 파일럿 mutation 1개 파일                                                     | 러너 경유 전환                |
| `.claude/rules/state-management.md`                                          | 신규 경로 규칙 + 잔존 표 링크 |

## 4. Phase 0 산출물 기록란

- [ ] 호출부 패턴 분류표 (정합 / 역전 잔존 / 특수):
- [ ] 러너 표현 가능률 + 표현 불가 유형:
- [ ] allowlist 고정 목록:
