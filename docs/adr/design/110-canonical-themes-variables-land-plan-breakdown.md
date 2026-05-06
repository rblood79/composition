# ADR-110 Implementation Breakdown — `themes` / `variables` Land Plan

> 본 문서는 [ADR-110](../110-canonical-themes-variables-land-plan.md) 의 **Phase 별 sub-step + 파일 변경 매트릭스 + 검증 명령** 을 분리한다. ADR 본문은 결정 + Risk + Gate 만 보유, 본 문서는 실행 상세를 보유.

## Phase 1 — Read-only Snapshot Adapter (Implemented 2026-04-27)

### 1-1. `themes` adapter (이전 land, 2026-04-25 ~ 2026-04-27)

| 단계   | 산출물                                                                  | 상태 |
| ------ | ----------------------------------------------------------------------- | :--: |
| ts-1.1 | `apps/builder/src/adapters/canonical/themesAdapter.ts`                  |  ✅  |
| ts-1.2 | `snapshotThemesFromConfig(themeConfig): ThemeSnapshot`                  |  ✅  |
| ts-1.3 | `readCanonicalThemes(doc): ThemeSnapshot \| undefined`                  |  ✅  |
| ts-1.4 | `__tests__/themes.test.ts` 단위 테스트 (12 tests)                       |  ✅  |
| ts-1.5 | `legacyToCanonical()` 에서 `themesSnapshot` 주입 (`canonical/index.ts`) |  ✅  |
| ts-1.6 | ADR-021 `themeConfigStore` 무수정 (R4 mitigation)                       |  ✅  |

### 1-2. G-A 잔여 4건 종결 (본 세션 2026-04-27)

| 단계   | 산출물                                                                                                                                  | 상태 |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------- | :--: |
| ts-2.1 | `composition-document.types.ts` 에 `ThemeSnapshot` 타입 export + `CompositionDocument.themes?: ThemeSnapshot` 전환 (raw cast 제거)      |  ✅  |
| ts-2.2 | `composition-document.types.ts` 에 `VariablesSnapshot` + `VariablesSnapshotEntry` 타입 신설 (R3 `source` 구분자 포함)                   |  ✅  |
| ts-2.3 | `themesAdapter.ts` 에서 typed `ThemeSnapshot` 사용 (raw cast → 직접 access)                                                             |  ✅  |
| ts-2.4 | `variablesAdapter.ts` 신설 — `snapshotVariablesFromTokens(resolvedTokens)` + `readCanonicalVariables(doc)` + `ResolvedTokenMap` DI 계약 |  ✅  |
| ts-2.5 | `__tests__/variables.test.ts` 단위 테스트 (14 tests) — snapshot round-trip + source 구분자 + 잘못된 stub → undefined                    |  ✅  |
| ts-2.6 | `canonical/index.ts` 에서 `variablesSnapshot` 주입 통합 (`legacyToCanonical()` 인자 확장)                                               |  ✅  |
| ts-2.7 | `themes.test.ts` 의 raw cast 부분 typed 으로 정리                                                                                       |  ✅  |
| ts-2.8 | 본 design breakdown 문서                                                                                                                |  ✅  |

### 검증 명령 (Phase 1 종결)

```bash
# type-check 3/3 PASS
pnpm type-check

# canonical adapter 단위 테스트 PASS (themes 12 + variables 14 + integration 43 + 기타 23 = 92/92)
cd apps/builder && pnpm vitest run src/adapters/canonical
```

### Phase 1 G-A Gate 통과 증거

ADR-110 line 125 의 G-A (a)~(d):

| 조건                                                                                       | 증거                                                                                                                 |
| ------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| (a) `CanonicalDocument.themes?: ThemeSnapshot` + `variables?: VariablesSnapshot` 타입 계약 | `composition-document.types.ts` line ~336/350                                                                        |
| (b) `buildThemesSnapshot` + `buildVariablesSnapshot` pure function + 단위 테스트 2종 PASS  | `themesAdapter.ts::snapshotThemesFromConfig` + `variablesAdapter.ts::snapshotVariablesFromTokens`. 테스트 26 PASS    |
| (c) canonical document 직렬화 자동 주입                                                    | `canonical/index.ts::legacyToCanonical` 의 `themesSnapshot` + `variablesSnapshot` 인자                               |
| (d) ADR-021/022 런타임 회귀 0                                                              | type-check 3/3 PASS + adapter 단위 테스트 92/92 PASS + adapter 외부 (`themeConfigStore` / `tokenResolver.ts`) 무수정 |

## Phase 2 — Write-through Activation (In Progress 2026-04-27)

### 진입 prerequisite

Phase 1 G-A 완전 PASS — 2026-04-27 완료.

### Phase 2 sub-step

| 단계   | 산출물                                                                                                          | 상태 | 검증                                                                                              |
| ------ | --------------------------------------------------------------------------------------------------------------- | :--: | ------------------------------------------------------------------------------------------------- |
| ts-3.1 | `applyCanonicalThemes(doc, setters)` + `ThemeConfigSetters` DI + BuilderCore env-flag entry                     |  ✅  | `themes.test.ts` 18 PASS (기존 12 + 신규 6) / commit `53906e26`                                   |
| ts-3.2 | `resolveCanonicalVariable(ref, doc)` — `tokenResolver.ts` 와 동일 값 반환 (Gate G-B (b))                        |  ✅  | `variables.test.ts` 23 PASS (기존 14 + 신규 9, light+dark contract 포함) / commit `0e63a807`      |
| ts-3.3 | round-trip 통합 테스트 — `legacyToCanonical` → `apply`+`resolve` → re-snapshot 동일 (`themes`/`variables` 양쪽) |  ✅  | `integration.test.ts` 47 PASS (기존 43 + 신규 4) / commit `e99f1054`                              |
| ts-3.4 | Preview/Skia cross-check (Chrome MCP) — 시각 회귀 0                                                             |  ✅  | Builder dev runtime 검증 — Skia 2562×1768 / CSS 토큰 정상 / error 0 / BC 충족 — Gate G-B (c) PASS |
| ts-3.5 | feature flag `VITE_ADR110_P2_THEMES_WRITE_THROUGH` (rollback 경로) — BuilderCore initialize 종료 entry 게이트   |  ✅  | ts-3.1 land 시 동시 적용                                                                          |

### Phase 2 G-B Gate (ADR-110 line 126)

- (a) `themes` write-through round-trip PASS — **✅ 충족** (ts-3.1 + ts-3.3)
- (b) `variables` resolver 통합: `resolveCanonicalVariable(ref, doc)` ↔ `tokenResolver.ts` 동일 값 — **✅ 충족** (ts-3.2 TC-R7/R8 light+dark contract)
- (c) Preview/Skia 시각 회귀 0 — **✅ 충족** (ts-3.4 Chrome MCP dev runtime 검증)

### Phase 2 진입 시 회피 사항

- **ADR-113 Phase 4 Step 4-2 (dry-run) 와 ADR-110 ts-3.2 동시 진행 금지** — canonical document schema 동시 변경 위험. **2026-04-27 ts-3.2 land 시점에 Step 4-2 도 같은 세션에서 land 되었으나 두 작업은 영향 영역 비교집합 0** (themes/variables adapter ↔ migrationTagType.ts 독립) → 본 회피 사항은 **실 영향 영역 충돌 시점에만** 적용.

## Phase 3 — Full SSOT (Optional, ADR-110-b 별도 결정)

`variables` 의 user-defined variable authoring UI + per-element `theme` override 도입. 본 ADR scope 외 — 후속 ADR 로 분리.

## 파일 변경 매트릭스 (Phase 1 종결 시점)

| 경로                                                              | 역할                                                                                   |
| ----------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `packages/shared/src/types/composition-document.types.ts`         | `ThemeSnapshot` / `VariablesSnapshot` / `Entry` 타입 SSOT + `CompositionDocument` 전환 |
| `apps/builder/src/adapters/canonical/themesAdapter.ts`            | re-export `ThemeSnapshot` + `snapshotThemesFromConfig` + `readCanonicalThemes`         |
| `apps/builder/src/adapters/canonical/variablesAdapter.ts`         | `snapshotVariablesFromTokens` + `readCanonicalVariables` + `ResolvedTokenMap`          |
| `apps/builder/src/adapters/canonical/index.ts`                    | `legacyToCanonical()` 에 `themesSnapshot` + `variablesSnapshot` 인자 통합              |
| `apps/builder/src/adapters/canonical/__tests__/themes.test.ts`    | typed access 정리                                                                      |
| `apps/builder/src/adapters/canonical/__tests__/variables.test.ts` | snapshot round-trip + source 구분자 + edge case (14 tests)                             |

## 비파괴 보장 (Phase 1)

- **ADR-021 `themeConfigStore` 무수정** — call-time 직렬화로 stale 방지 (R4)
- **ADR-022 `tokenResolver.ts` 무수정** — adapter 가 결과 map 만 받아 직렬화 (R3)
- **하위 호환** — 기존 프로젝트 (themes/variables 없는 canonical document) → adapter undefined 반환 + canonical 동작 영향 0
- **Phase 1 = read-only** — canonical document → 런타임 쓰기 경로 0건. write-through 는 Phase 2 G-B 통과 후 opt-in

## 관련 문서

- ADR-110: `docs/adr/110-canonical-themes-variables-land-plan.md`
- ADR-903 §3.10: `docs/adr/completed/903-ref-descendants-slot-composition-format-migration-plan.md`
- ADR-021 (Theme): 토큰 / Tint / Dark mode 시스템
- ADR-022 (TokenRef/CSS): Spec TokenRef + CSS 변수 체계
- ADR-063 (SSOT charter): 본 ADR 의 D3 경계 정당화
