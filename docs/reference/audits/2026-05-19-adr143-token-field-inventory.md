# ADR-143 Phase 0 — Canonical 토큰 필드 정명 inventory

> ADR-143 [breakdown §4 Phase 0](../../adr/design/143-canonical-token-field-realignment-breakdown.md) 산출물.
> Gate G0 — rename 대상 심볼/사용처 baseline 고정 + ThemeStudio 정리 scope 결정.
> 작성: 2026-05-19. 전수 grep 기준 (`packages/` + `apps/builder/src/`).

## 1. rename 대상 baseline — canonical 필드 (ADR-143 실제 scope)

| 심볼                                                                                  | 정의 위치                               | 사용처                                                                      | 건수                |
| ------------------------------------------------------------------------------------- | --------------------------------------- | --------------------------------------------------------------------------- | ------------------- |
| `CompositionDocument.variables` 필드                                                  | `composition-document.types.ts:393`     | `variablesAdapter.ts`(144/200), `canonical/index.ts`(125/126/294)           | doc-comment 포함 13 |
| `VariablesSnapshot` / `VariablesSnapshotEntry`                                        | `composition-document.types.ts:75,91`   | `variablesAdapter.ts`                                                       | 24 (2 파일)         |
| `VariableDefinition`                                                                  | `composition-document.types.ts:128`     | `variablesAdapter.ts`                                                       | 4 (2 파일)          |
| `NumberOrVariable` / `StringOrVariable` / `BooleanOrVariable` / `ColorOrVariable`     | `composition-document.types.ts:107-116` | `composition-document.types.ts:305` (`clip?: BooleanOrVariable`)            | 5 (1 파일)          |
| `VariableRef` (canonical, `{ $var: string }`)                                         | `composition-document.types.ts:102`     | §3 충돌 처리                                                                | —                   |
| `snapshotVariablesFromTokens` / `readCanonicalVariables` / `resolveCanonicalVariable` | `variablesAdapter.ts:69,141,190`        | `canonical/index.ts` re-export, `variables.test.ts` / `integration.test.ts` | ~50 (테스트 다수)   |
| `applyCanonicalThemes`                                                                | `themesAdapter.ts:133`                  | **이름 유지** — `themes` 는 rename 안 함                                    | —                   |

**rename 비대상 파일**: `variablesAdapter.ts` 의 함수 중 `resolveCanonicalVariable` → `resolveCanonicalToken` 등 token 명명 전환. `applyCanonicalThemes` 및 `themesAdapter.ts` 전체는 무변경 (`themes` 는 `.pen` 과 동일하여 정명 유지, breakdown §2-1).

## 2. rename 비대상 — 런타임 `variables` 도메인 (별개 도메인, ADR-143 무관)

ADR-143 이 해소하려는 "이중 의미" 의 다른 한 축. 코드 변경 없음 (breakdown §2-5 — 도메인 경계 주석만).

| 항목                                                                            | 위치                                                              | 도메인                                                |
| ------------------------------------------------------------------------------- | ----------------------------------------------------------------- | ----------------------------------------------------- |
| `Variable` 타입 / `variables` IndexedDB store                                   | `types/builder/data.types.ts`, `useDataStore((s) => s.variables)` | app-logic (`authToken` 등 런타임 상태)                |
| `isVariableRef` / `resolveVariableRef`                                          | `unified.types.ts:119`, `variableResolver.ts`                     | 런타임 variable 바인딩 (`value is string` — `$` 구문) |
| `db.variables.*` (`dashboard/index.tsx`, `dataActions.ts`, `useDataQueries.ts`) | —                                                                 | 런타임 variables store CRUD                           |
| `element.types.ts:122` `VariableRef`                                            | @deprecated 주석 1건만                                            | canonical 참조 언급 (코드 영향 없음)                  |

`canonical/index.ts:294` 의 `snapshotVariablesFromTokens(getVariables())` — `getVariables()` 콜백은 런타임 token map 을 받아 canonical snapshot 으로 변환. 콜백 자체는 런타임 소스, 산출물이 canonical `variables`(→`tokens`) 필드. 이 경계가 §3-4 직렬화 매핑의 한 축.

## 3. `VariableRef` ↔ `TokenRef` 충돌 (breakdown §3-3)

- canonical `VariableRef` (`composition-document.types.ts:102`, `{ $var: string }`) — rename 대상.
- spec `TokenRef` (`packages/specs/src/types/token.types.ts:14`, `` `{${string}}` `` brace 구문) — 별개, build-time.
- 단순 `VariableRef → TokenRef` rename 시 spec `TokenRef` 와 **타입명 충돌**.
- breakdown §3-3 권고 = **(b) `CanonicalTokenRef`** ($var 구문 유지) — Phase 1 확정.

## 4. objectStore 폐기 — 사용자 결정 (2026-05-19)

ADR-143 본문 Context item 3 은 `design_tokens`/`design_themes` objectStore 를 "live CRUD caller 0" 으로 전제했다. Phase 0 전수 grep 실측:

| objectStore     | adapter accessor                           | grep 상 호출 코드                                                                                                          |
| --------------- | ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| `design_tokens` | `adapter.ts` `tokens = { ... }` (~514-600) | `TokenService.ts` 8 (`getByTheme`/`insert`/`getById`/`update`/`delete`), `dashboard/index.tsx` 2 (`getByProject`/`delete`) |
| `design_themes` | `adapter.ts` `themes = { ... }` (604-665)  | `ThemeService.ts` 2 (`getActiveTheme`/`insert`), `dashboard/index.tsx` 2 (`getByProject`/`delete`), adapter 내부 2         |

**사용자 결정**: "IndexedDB 에 등록만 되어 있지 미사용이다 — 계획대로 진행." → 위 호출 코드는 trigger 하는 활성 UI 경로가 없는 dormant 경로로 판정. breakdown Phase 4 (objectStore 폐기 + `DB_VERSION` bump) 를 계획대로 진행한다.

**Phase 4 처리 방침**:

- `adapter.ts` 의 `design_tokens`/`design_themes` objectStore 생성 (~220-252) + `tokens`/`themes` accessor CRUD 블록 제거. `DB_VERSION` bump. `clear()` 의 store 목록 (`adapter.ts:1078-1079`) 에서 제거.
- accessor 제거로 깨지는 caller (`TokenService.ts` / `ThemeService.ts` / `dashboard/index.tsx`) 의 `db.designTokens.*` / `db.themes.*` 호출 코드를 동반 정리 — type-check 0 회귀 보장.

## 5. ThemeStudio 코드 — Phase 4 정리 scope

breakdown §2-4 의 3 옵션 (폐기 / 재작성 / scope 제외) 중, 사용자 "미사용" 판정에 따라 **objectStore CRUD 경로 정리** 방향:

| 코드                                              | 위치                             | Phase 4 처리                                                                                                |
| ------------------------------------------------- | -------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `TokenService.ts`                                 | `services/theme/`                | `db.designTokens.*` 의존 — objectStore 폐기와 동반 정리                                                     |
| `ThemeService.ts`                                 | `services/theme/`                | `db.themes.*` 의존 — 동반 정리                                                                              |
| `themeStore.ts`                                   | `stores/`                        | `TokenService` 경유 — caller (`BuilderCore.tsx`/`VariableBindingButton.tsx`) 파급 확인 후 Phase 4 정밀 판정 |
| `useTokens.ts`                                    | `hooks/theme/`                   | `TokenService` + `tokenParser` 경유 — 동일                                                                  |
| `DesignToken`/`DesignTheme`/`DesignVariable` 타입 | `types/theme/` 외 19 파일 import | objectStore 데이터 형상 타입 — 폐기 잔여 의존만 정리, 광범위 rename 은 ADR-143 scope 아님                   |

`themeStore` / `useTokens` 의 in-memory 상태 관리부는 objectStore 폐기와 직접 무관 — Phase 4 진입 시 caller 파급 grep 후 정밀 판정 (제거 vs 잔존). ADR-143 scope 는 objectStore 의존 제거까지이며, ThemeStudio UI 시스템 전면 재설계는 본 ADR 범위 밖.

## 6. Gate G0 충족

- [x] rename 대상 심볼 7종 + 사용처 파일 baseline 고정 (§1).
- [x] 런타임 `variables` 도메인 분리 확정 (§2) — rename 비대상.
- [x] `VariableRef` ↔ `TokenRef` 충돌 후보 확정 — Phase 1 (b) `CanonicalTokenRef` (§3).
- [x] `design_tokens`/`design_themes` objectStore 폐기 + ThemeStudio 정리 scope 결정 (§4, §5) — 사용자 confirm.

→ Phase 1 진입 가능.
