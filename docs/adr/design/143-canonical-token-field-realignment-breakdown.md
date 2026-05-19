# ADR-143 구현 상세 — Canonical 시각 토큰 필드 정명 + theme/token SSOT 재정렬

> 본 문서는 ADR-143 의 **구현 상세**다. 결정/대안/위험/Gate 는 [ADR-143 본문](../completed/143-canonical-token-field-realignment.md) 참조.

## 1. Scope + ADR 관계

- **ADR-110 successor**: ADR-110(Implemented, `completed/`)이 `CompositionDocument.themes`/`variables` 를 land 했다. ADR-110 본문 line 90·106 이 후속을 "별도 ADR-110-b" 로 예고했다. ADR-110 본문은 Implemented 그대로 두고, 본 ADR 이 `variables` 필드 결정을 **partial supersede** 한다.
- **ADR-142 와의 경계**: ADR-142 line 44 가 _"canonical schema(`CompositionDocument` …)는 변경하지 않는다. 본 ADR 범위 밖이다"_ 라고 명시한다. 따라서 canonical schema 변경(필드 rename)의 정당한 home 은 본 ADR 이다. ADR-142 Decision #5 의 wording sync 는 본 ADR Implemented 이후 Phase 6 에서 수행한다.
- **Domain**: D3(시각 스타일) — canonical document 의 `tokens`/`themes` 필드 명명·구조. 런타임 `variables` 분리는 D3 ↔ app-logic 경계 명확화.

## 2. 변경 대상

### 2-1. canonical 타입 (`packages/shared/src/types/composition-document.types.ts`)

- `CompositionDocument.variables` → `tokens`
- `VariablesSnapshot` / `VariablesSnapshotEntry` → `TokensSnapshot` / `TokensSnapshotEntry`
- `VariableDefinition` → `TokenDefinition` — 단 이 타입은 doc-comment 상 "D2 props 참조용으로 유지(하위 호환)"(`composition-document.types.ts:389`)다. D3 `Token` 명명 이동이 정합인지 또는 rename 대상에서 제외할지 Phase 0 inventory 에서 확정.
- `NumberOrVariable` / `StringOrVariable` / `BooleanOrVariable` / `ColorOrVariable` → `…OrToken`
- `VariableRef` — §3-3 충돌 처리
- `themes` / `ThemeSnapshot` — **이름 유지** (.pen `themes` 와 동일)

### 2-2. canonical adapter / resolver (`apps/builder`)

- ADR-110 변수 land 함수 (실제 심볼 — `apps/builder/src/adapters/canonical/variablesAdapter.ts`): `snapshotVariablesFromTokens()` / `readCanonicalVariables()` / `resolveCanonicalVariable()` → token 명명으로 rename (예: `resolveCanonicalVariable` → `resolveCanonicalToken`). `applyCanonicalThemes` 는 이름 유지. 정확한 rename 대상·신규명은 Phase 0 inventory 의 `variablesAdapter.ts` 전수 grep 으로 확정 — `buildVariablesSnapshot` 같은 미존재 심볼 가정 금지.
- 직렬화 경계: `.pen` export/import 시 `tokens` ↔ `.pen` `variables` 매핑 (§3-4).

### 2-3. IndexedDB (`apps/builder/src/lib/db/indexedDB/adapter.ts`)

- `design_tokens` / `design_themes` objectStore 폐기. `DB_VERSION` bump.
- ADR-132 Phase 5 선례 — 현 개발 단계 정책상 migration 코드 없이 store drop/recreate 허용.
- adapter 의 `design_tokens`/`design_themes` CRUD 메서드 제거.

### 2-4. ThemeStudio 코드 (사용처 미확정 — Phase 0 inventory 대상)

- `stores/themeStore.ts`, `services/theme/TokenService.ts`, `utils/theme/tokenParser.ts`, `types/theme/index.ts`(`DesignToken`/`DesignTheme`/`DesignVariable`).
- **dormant 아님** — `themeStore.ts` 는 `BuilderCore.tsx`(`useUnifiedThemeStore`) + `VariableBindingButton.tsx`(`useTokens`) 에서 live import, `DesignToken` 타입은 `store.types.ts`/`figma.types.ts`/`generation.types.ts`/`unified.types.ts` 등에서 import 중. (dormant 인 것은 `design_tokens`/`design_themes` **objectStore** — live CRUD caller 0.)
- Phase 0 inventory 가 ThemeStudio 사용처를 전수 grep → **폐기 / 재작성 / 본 ADR scope 제외** 중 하나로 결정. 폐기를 기본값으로 가정하지 않는다 (R5).

### 2-5. 런타임 `variables` (분리 명시)

- `types/builder/data.types.ts` 의 `Variable`, `variables` objectStore — **코드 변경 없음**. 도메인 경계 주석 + 본 ADR 참조만 추가.

## 3. 핵심 규약

### 3-1. 정명 매핑

| 현행                                 | 변경 후                      | 비고                     |
| ------------------------------------ | ---------------------------- | ------------------------ |
| `CompositionDocument.variables`      | `CompositionDocument.tokens` | D3 시각 design token     |
| `VariablesSnapshot(Entry)`           | `TokensSnapshot(Entry)`      |                          |
| `VariableDefinition`                 | `TokenDefinition`            |                          |
| `…OrVariable` 4종                    | `…OrToken`                   |                          |
| `CompositionDocument.themes`         | (유지)                       | .pen `themes` 동일       |
| `variables` objectStore (`Variable`) | (유지)                       | 런타임 앱 상태 — D3 아님 |

### 3-2. 토큰 델타 저장 규칙

- `TokensSnapshotEntry.source: "spec-token" | "user-defined"` — ADR-110 R3 으로 이미 존재하는 구분자 재사용.
- `CompositionDocument.tokens` 는 **`source: "user-defined"` 항목 + spec-token override 델타만** 저장.
- spec 기본 토큰(미override `spec-token`)은 `packages/specs/src/primitives/` 에서 **런타임 seed** — 문서에 저장하지 않음.
- merge 순서: `primitives/` seed → 문서 `tokens` 델타 override.
- 측정 기준: 토큰 미커스터마이즈 프로젝트의 `tokens` 필드 ≤ 5KB.

### 3-3. `VariableRef` ↔ `TokenRef` 충돌 (Phase 1 sub-decision)

- 기존 spec `TokenRef` = `` `{${string}}` `` brace 구문 (`packages/specs/src/types/token.types.ts:14`).
- canonical `VariableRef` = `{ $var: string }` 객체/`$` 구문.
- `VariableRef` → `TokenRef` 단순 rename 은 spec `TokenRef` 와 **타입명 충돌**.
- 후보: (a) `DocTokenRef`, (b) `CanonicalTokenRef` (구문은 `$var` 유지), (c) 두 참조 구문 통합.
- 본 ADR 권고 = **(b)** — 최소 변경. spec `TokenRef`(build-time) ↔ canonical 참조(runtime)는 다른 layer 라 구문 통합은 본 ADR scope 밖. Phase 1 에서 확정.

### 3-4. `.pen` 직렬화 매핑

- export: `CompositionDocument.tokens` → `.pen` `variables` 필드 / `themes` → `themes`.
- import: 역방향.
- 런타임 `variables`(앱 상태) → `.pen` `x-composition` 확장.
- 단일 adapter 함수 경유. round-trip 무손실 테스트 필수.

## 4. Phase

| Phase | 작업                                                                                                                                                                                                                                                                                                                                    | 산출물                        |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| 0     | inventory — `variables`/`VariablesSnapshot`/`VariableRef`/`VariableDefinition` 참조 + `design_tokens`/`design_themes` objectStore CRUD 사용처 + ThemeStudio 코드(`themeStore.ts`/`TokenService.ts`/`tokenParser.ts`/`types/theme`/`DesignToken`) live consumer 전수 grep. baseline 고정 + ThemeStudio 정리 scope(폐기/재작성/제외) 결정 | inventory 문서                |
| 1     | canonical 타입 정명 (§2-1) + §3-3 충돌 결정                                                                                                                                                                                                                                                                                             | composition-document.types.ts |
| 2     | adapter/resolver 정명 (§2-2) + `.pen` 직렬화 매핑 (§3-4)                                                                                                                                                                                                                                                                                | canonical adapter             |
| 3     | 토큰 델타 저장 규칙 구현 (§3-2)                                                                                                                                                                                                                                                                                                         | buildTokensSnapshot + merge   |
| 4     | IndexedDB objectStore 폐기 + ThemeStudio 코드 Phase 0 결정 반영 (§2-3, §2-4)                                                                                                                                                                                                                                                            | adapter.ts DB_VERSION bump    |
| 5     | 런타임 `variables` 도메인 경계 주석 (§2-5)                                                                                                                                                                                                                                                                                              | data.types.ts 주석            |
| 6     | ADR-142 Decision #5 wording sync + ADR-110 partial supersede 마커 + README/CHANGELOG                                                                                                                                                                                                                                                    | 문서 정합                     |

## 5. Phase별 Gate

| Gate | 시점      | 통과 조건                                                                                                                                                                                                |
| ---- | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| G0   | Phase 0   | inventory baseline 고정 — rename 대상 심볼 수 + 사용처 파일 수 확정                                                                                                                                      |
| G1   | Phase 1-3 | `CompositionDocument.variables`/`VariablesSnapshot` 잔존 0 (grep). type-check 3/3. canonical adapter vitest PASS (ADR-110 테스트 갱신 포함)                                                              |
| G2   | Phase 3   | 미커스터마이즈 프로젝트 `tokens` 필드 ≤ 5KB 실측. spec-token seed ↔ user-defined override merge 테스트 PASS                                                                                              |
| G3   | Phase 4   | `design_tokens`/`design_themes` objectStore 제거 + adapter CRUD 메서드 사용처 0. ThemeStudio 코드는 Phase 0 결정대로 처리(폐기 선택 시 live consumer 재배선 완료). DB_VERSION bump 후 신규 프로젝트 정상 |
| G4   | Phase 6   | `.pen` round-trip 무손실 테스트 PASS. ADR-142 Decision #5 wording = `theme/tokens`. ADR-110 partial supersede 마커                                                                                       |

## 6. 검증

- `pnpm type-check` 3/3 PASS
- canonical adapter vitest — ADR-110 의 `themes`/`variables` 테스트를 `tokens` 정명으로 갱신 후 전수 PASS
- `.pen` export → import round-trip 무손실
- grep gate: `CompositionDocument.variables`, `VariablesSnapshot`, `design_tokens` objectStore 참조 잔존 0
- 문서 크기: 토큰 미커스터마이즈 프로젝트 `tokens` 필드 ≤ 5KB 실측
