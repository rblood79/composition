# ADR-143: Canonical 시각 토큰 필드 정명 + theme/token SSOT 재정렬

## Status

Proposed — 2026-05-19

## Context

ADR-110(Implemented, 2026-04-27)이 `CompositionDocument.themes` / `variables` 를 canonical document root 필드로 land 했다. 당시 `variables` 필드는 ADR-022 의 "Spec TokenRef + 사용자 정의 변수 통합" 명명을 따랐다 — 즉 **시각 design token** 을 담는 필드다.

이후 다음 문제가 드러났다:

1. **이름 이중 의미** — `CompositionDocument.variables`(시각 design token)와 런타임 `variables` IndexedDB store(`Variable` 타입 — `authToken`/`currentUser` 류 앱 런타임 상태)가 같은 단어를 쓴다. 두 개는 서로 다른 도메인(D3 시각 ↔ app-logic)이다.
2. **표준 용어 불일치** — 시각 design value 의 표준 용어는 "design token" 이다. W3C Design Tokens Community Group 의 Design Tokens Format Module 이 2025-10 첫 stable 에 도달했고, React Spectrum(D2)·Style Dictionary·Salesforce·Material 이 모두 "design token" 을 쓴다. composition 자체 코드도 `DesignToken` / `design_tokens` 다. "variables" 는 Figma UI·`.pen` 포맷의 design-tool 관례일 뿐 표준/엔지니어링 용어가 아니다.
3. **dormant 중복 store** — IndexedDB 에 `design_tokens` + `design_themes` objectStore 가 canonical document 의 `themes`/`variables` 필드와 평행하게 존재하나, live CRUD caller 가 0 인 dormant 상태다. 단 이 store 를 다루던 ThemeStudio 코드(`themeStore.ts`/`TokenService.ts`/`DesignToken`/`DesignTheme`)는 dormant 아님 — `themeStore.ts` 는 `BuilderCore.tsx` + `VariableBindingButton.tsx` 에서 live import 중이다. **objectStore 의 dormant 여부와 코드의 live 여부는 분리** 한다.
4. **문서 비대화 위험** — canonical document 가 토큰 전체 세트(프로젝트마다 동일한 spec 기본 토큰 수백 개)를 담으면 비대해진다.

본 ADR 은 ADR-110 의 successor 다. ADR-110 본문 line 90·106 이 후속을 "별도 ADR-110-b" 로 명시 예고했다. ADR-142 는 line 44 에서 _"canonical schema(`CompositionDocument`)는 변경하지 않는다. 본 ADR 범위 밖이다"_ 라고 명시하므로, `CompositionDocument` 필드 rename 의 정당한 home 은 본 ADR 이다.

**Domain (SSOT 체인 — [ssot-hierarchy.md](../../.claude/rules/ssot-hierarchy.md))**: D3(시각 스타일). canonical document 의 `tokens`/`themes` 필드 명명·구조. 런타임 `variables` 분리는 D3 ↔ app-logic 경계 명확화.

**Hard Constraints**:

1. `.pen` 직렬화 호환 — `.pen` 포맷 root 필드는 `variables`. composition 내부 `tokens` ↔ `.pen` `variables` 매핑이 deterministic·round-trip 무손실이어야 한다.
2. ADR-142 계약 — ADR-142 Decision #5 가 시각 SSOT 를 "theme/variables root collection" 으로 참조한다. 본 ADR Implemented 후 wording sync 필요.
3. 문서 크기 — canonical document 에 토큰 전체 세트 복제 금지. 측정 가능: 토큰 미커스터마이즈 프로젝트의 `tokens` 필드 ≤ 5KB.
4. 하위 호환 — 기존 IndexedDB 데이터는 현 개발 단계 정책상 `DB_VERSION` bump 시 migration 코드 없이 drop/recreate 허용(ADR-132 Phase 5 선례).

**Soft Constraints**:

- ADR-110 본문은 Implemented 상태로 보존하고 본 ADR 이 `variables` 필드 결정만 partial supersede 한다.
- dormant ThemeStudio 코드 정리는 사용처 grep 결과에 따라 폐기 또는 재작성.

## Alternatives Considered

### 대안 A: canonical `variables` → `tokens` 정명 + 델타 저장 + store 통합

- 설명: `CompositionDocument.variables`(시각) → `tokens` 로 rename. 런타임 `variables` store 는 이름 유지(별개 도메인). `design_tokens`/`design_themes` IndexedDB store 폐기 — 데이터는 canonical document 필드로. 문서는 user-defined + override 델타만 저장하고 spec 기본 토큰은 `primitives/` 런타임 seed.
- 근거: W3C Design Tokens Format Module(2025-10 stable) + React Spectrum(D2) + composition 기존 `DesignToken` 코드 — 3중 정합. `design_tokens`/`design_themes` objectStore 는 live CRUD caller 0(폐기 가능). ThemeStudio 코드 정리는 별개 — Phase 0 inventory 결과에 따라 폐기/재작성/scope 제외 결정.
- 위험:
  - 기술: LOW — 필드 rename + adapter 정명. 신규 메커니즘 없음.
  - 성능: LOW — 델타 저장으로 문서 크기 오히려 감소.
  - 유지보수: LOW — "variables" 이중 의미 해소, 단일 SSOT.
  - 마이그레이션: MEDIUM — `DB_VERSION` bump + `.pen` 직렬화 매핑 1건. 단 dev 단계라 migration 코드 불요.

### 대안 B: 현행 유지 (do nothing)

- 설명: ADR-110 그대로. `variables` 이름·`design_tokens`/`design_themes` store 모두 유지.
- 근거: ADR-110 Implemented, 변경 비용 0.
- 위험:
  - 기술: LOW — 변경 없음.
  - 성능: MEDIUM — store 중복 + 토큰 전체 세트 비대화 위험 미해결.
  - 유지보수: HIGH — "variables" 이중 의미 영구화, dormant store 2개 영구 잔존, ADR-142 Decision #5 모호성 미해결.
  - 마이그레이션: LOW.

### 대안 C: `.pen` 포맷 그대로 — 시각을 `variables` 로 두고 런타임 store 를 rename

- 설명: 시각 필드는 `.pen` 처럼 `variables` 유지. 런타임 `variables` store(`authToken`)를 `state` 등으로 rename.
- 근거: `.pen` 포맷 byte-fidelity.
- 위험:
  - 기술: MEDIUM — 런타임 `variables` 는 사용 중 store → rename 시 코드 파급 광범위.
  - 성능: LOW.
  - 유지보수: MEDIUM — W3C 표준 용어 token + 기존 `DesignToken` 코드와 필드명 영구 불일치.
  - 마이그레이션: MEDIUM — 사용 중 store rename.

### 대안 D: 시각 token 을 canonical document 밖 상위 수준에 배치

- 설명: `themes`/`tokens` 를 문서가 아니라 project/workspace 수준 별도 store 로.
- 근거: 디자인 시스템을 문서보다 상위 개념으로 보는 관점.
- 위험:
  - 기술: MEDIUM — 상위 수준 store 인프라 신설.
  - 성능: LOW.
  - 유지보수: HIGH — canonical document 단일 SSOT 와 평행 SSOT 재생성 → ADR-116/122 가 제거한 mirror-drift 부활.
  - 마이그레이션: MEDIUM.

### Risk Threshold Check

| 대안 | 기술 | 성능 | 유지보수 | 마이그레이션 | HIGH+ 개수 |
| ---- | ---- | ---- | -------- | ------------ | :--------: |
| A    | L    | L    | L        | M            |     0      |
| B    | L    | M    | H        | L            |     1      |
| C    | M    | L    | M        | M            |     0      |
| D    | M    | L    | H        | M            |     1      |

루프 판정: 대안 A 가 HIGH+ 0 으로 최선. CRITICAL 없음 → 추가 대안 루프 불필요.

## Decision

**대안 A: canonical `variables` → `tokens` 정명 + 델타 저장 + store 통합**을 선택한다.

선택 근거:

1. HIGH+ 위험 0. 잔존 위험은 마이그레이션 MEDIUM 1건뿐이고, 현 개발 단계 정책상 `DB_VERSION` bump 시 migration 코드가 불요(ADR-132 Phase 5 선례)하여 수용 가능하다.
2. W3C Design Tokens 표준 + D2(React Spectrum) + 기존 `DesignToken` 코드 — 3중 정합. "variables" 이중 의미가 해소되어 D3 시각 ↔ app-logic 도메인 경계가 명확해진다.
3. 델타 저장 규칙으로 문서 비대화(Hard Constraint 3)를 차단한다.

기각 사유:

- **대안 B 기각**: 유지보수 HIGH — "variables" 이중 의미 + dormant store 2개를 영구화하고 ADR-142 Decision #5 모호성을 미해결로 남긴다.
- **대안 C 기각**: W3C 표준 용어(token) 및 기존 `DesignToken` 코드와 필드명이 영구 불일치한다. 또한 런타임 `variables`(사용 중 store) rename 비용이 대안 A 의 시각 필드 rename 비용보다 크다.
- **대안 D 기각**: canonical document 단일 SSOT 와 평행한 SSOT 를 재생성하여 ADR-116/122 가 9개 ADR 로 제거한 mirror-drift 를 부활시킨다. cross-document 테마 공유는 `.pen` `imports` 가 담당하므로 상위 수준 배치는 불필요하다.

> 구현 상세: [143-canonical-token-field-realignment-breakdown.md](design/143-canonical-token-field-realignment-breakdown.md)

## Risks

| ID  | 위험                                                                                                                                                       | 심각도 | 대응                                                                                                                                                 |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | :----: | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | `.pen` 포맷 필드명(`variables`) ↔ composition 내부 필드명(`tokens`) 불일치 → 직렬화 경계에서 매핑 누락 시 round-trip 손실                                  |  MED   | 직렬화 adapter 단일 진입점 + round-trip 무손실 테스트 (breakdown §3-4)                                                                               |
| R2  | `variables` → `tokens` rename 이 canonical adapter / resolver / consumer 다수에 파급. 누락 시 stale 참조                                                   |  MED   | Phase 0 inventory 전수 grep + grep gate(`CompositionDocument.variables` 잔존 0) + type-check                                                         |
| R3  | 델타 저장 — spec 기본 토큰 seed ↔ user-defined override merge 순서 오류 시 사용자 override 가 기본값에 묻힘                                                |  MED   | `source: "spec-token" \| "user-defined"` 구분자 기반 merge, 순서 테스트 (breakdown §3-2)                                                             |
| R4  | ADR-110(Implemented)의 Gate G-A/G-B 테스트가 `variables` 이름에 의존                                                                                       |  LOW   | ADR-110 canonical adapter 테스트를 `tokens` 정명으로 동시 갱신. ADR-110 본문에 partial supersede 마커                                                |
| R5  | ThemeStudio 코드(`DesignToken`/`themeStore`/`TokenService`) 정리·rename 시 `BuilderCore.tsx`/`VariableBindingButton.tsx` + 타입 5+ 파일 live consumer 파급 |  MED   | Phase 0 inventory 가 ThemeStudio 사용처 전수 grep → 폐기/재작성/scope 제외 결정. 폐기 선택 시 live consumer 재배선 완료를 breakdown G3 통과 조건으로 |

잔존 HIGH 위험 없음.

## Gates

잔존 HIGH 위험 없음 — Gate 테이블 불요. Phase별 통과 조건(G0~G4)은 [breakdown §5](design/143-canonical-token-field-realignment-breakdown.md) 참조.

## Consequences

### Positive

- "variables" 이중 의미 해소 — `tokens`(D3 시각) ↔ `variables`(런타임 앱 상태) 도메인 경계 명확화.
- W3C Design Tokens 표준 + React Spectrum(D2) + 기존 `DesignToken` 코드 3중 정합.
- dormant `design_tokens`/`design_themes` IndexedDB objectStore 2개 제거 (live CRUD caller 0).
- 델타 저장 규칙으로 canonical document 크기 억제 — 토큰 미커스터마이즈 프로젝트 `tokens` ≤ 5KB.
- ADR-142 Decision #5 의 "theme/variables root collection" 모호성 해소 — wording 을 "theme/tokens" 로 sync 가능.

### Negative

- canonical 타입 / adapter / resolver / consumer 에 `variables` → `tokens` rename 파급.
- ThemeStudio 코드(`DesignToken`/`themeStore`/`TokenService`)는 dormant 아님 — 정리 대상에 포함 시 `BuilderCore.tsx`/`VariableBindingButton.tsx` 등 live consumer 재배선 발생. 정리 scope 는 Phase 0 inventory 가 확정 (R5).
- `DB_VERSION` bump — `design_tokens`/`design_themes` store drop.
- `.pen` 직렬화 경계에 `tokens` ↔ `variables` 매핑 1건 추가 (내부 모델명 ≠ wire 포맷명).
- ADR-110 canonical adapter 테스트 동시 갱신 + ADR-142 Decision #5 wording sync 필요.
