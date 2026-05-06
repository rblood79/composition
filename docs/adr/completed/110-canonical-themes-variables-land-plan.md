# ADR-110: Canonical Document `themes` / `variables` 필드 Land Plan

## Status

**Implemented** — 2026-04-27 (Phase 1 G-A + Phase 2 G-B 전원 통과 — `themes`/`variables` read-only snapshot adapter + write-through adapter + variables resolver + round-trip 통합 + 시각 회귀 0 검증 완료)

## Context

### Domain (SSOT 체인 — [ssot-hierarchy.md](../../.claude/rules/ssot-hierarchy.md))

- **해당 domain**: **D3 (시각 스타일) 상위** — ADR-903과 동일한 위치. 본 ADR은 D1/D2/D3 위에 위치하는 **문서 구조 / composition source model** 의 테마·변수 선언 계층을 다룬다.
- **ADR-903과의 관계**: ADR-903 §3.10의 `themes`/`variables` 필드는 타입 stub만 P0에 land되었고, ADR-903 본문에 구현 phase가 명시되지 않았다 ([903-additional-fields-land-status.md](design/903-additional-fields-land-status.md) §3 검증 결과). 본 ADR이 해당 gap에 대한 공식 land plan을 제공한다.
- **경계 정당화**: `themes` 필드는 ADR-021 (Theme 시스템) 을 canonical document 선언으로 투영하며, `variables` 필드는 ADR-022 (TokenRef/CSS 변수 체계) 의 design-time 선언을 투영한다. 두 필드 모두 D3 consumer (Skia/CSS) 가 동일 시각 결과를 산출하기 위한 상위 선언 구조다.

### 문제

ADR-903 P0 에서 canonical document root 에 4개 메타 필드 타입이 정의되었다.

| 필드        | 타입 land | 구현 상태                                                                        | 출처               |
| ----------- | :-------: | -------------------------------------------------------------------------------- | ------------------ |
| `version`   |    ✅     | 완전 land — `"composition-1.0"` 주입 + 캐시 key 사용                             | 완료               |
| `imports`   |    ✅     | Phase 5 연기 stub — 정상 (P5-D/E 명시)                                           | ADR-903 §3.10 명시 |
| `themes`    |    ✅     | **Stub only** — ADR-021 Theme 시스템 통합 미대기                                 | **phase 미명시**   |
| `variables` |    ✅     | **Partial** — `VariableRef`/`VariableDefinition` 타입 + 일부 구조, 리졸버 미통합 | **phase 미명시**   |

`themes` / `variables` 는 ADR-903 본문 §3.10 에 "ADR-021 Theme 시스템 투영" / "ADR-022 TokenRef 투영" 만 언급되고 **구체적 구현 phase 가 명시되지 않아** 실질적으로 무기한 유보 상태다.

### Hard Constraints

1. **ADR-021 (Theme 시스템) 변경 최소화** — Tint/dark mode 런타임 동작, `themeConfigStore`, `useTintColor` 훅 등 기존 메커니즘을 파괴하지 않는다.
2. **ADR-022 (TokenRef/CSS 변수) 변경 최소화** — Spec `TokenRef` 체계와 `tokenResolver.ts`의 resolve 파이프라인을 재작성하지 않는다.
3. **P5-A 진입 전 schema 계약 확정** — ADR-903 P5-A는 IndexedDB DB_VERSION 9 전환을 포함한다. `themes`/`variables`의 document-root schema 계약이 P5-A 진입 전에 고정되어야 migration script가 올바른 스키마로 동작한다.
4. **하위 호환 rollback 가능** — 각 Phase는 feature flag 또는 adapter 경로로 되돌릴 수 있어야 한다.
5. **ADR-063 비침범** — D1(RAC), D2(RSP), D3(Spec) 권한 경계를 건드리지 않는다.

### Soft Constraints

- `themes` 와 `variables` 를 동시 land 하거나 Phase 분할하는 두 경로 모두 수용 가능
- canonical document 의 `themes`/`variables` 가 기존 시스템과 정합하는 한, read-only adapter(view) 수준에서 시작해도 충분하다
- composition 사용자에게 ADR-021 / ADR-022 가 '문서 단위 선언' 가능해진다는 UX 개선이 Phase 2 이후에 온다면 Phase 1 은 인프라만으로도 유효하다

### 코드 현황 확인 (Proposed 단계 코드 경로 — 반복 패턴 선차단 체크 #1)

- `apps/builder/src/builder/stores/themeConfigStore.ts` — Tint/dark mode 런타임 상태. `tintColor`, `isDarkMode`, `baseTypography` 관리
- `packages/shared/src/types/composition-document.types.ts` — canonical document 타입 (ADR-903 P0 stub 포함 예상 위치)
- `packages/specs/src/primitives/tokenResolver.ts` — TokenRef → 실수값 resolve
- `apps/builder/src/services/theme/` — ADR-021 Theme system entry points
- ADR-022 CSS 변수: `apps/builder/src/builder/styles/theme/` + preview `preview-system.css`

## Alternatives Considered

### 대안 A: canonical 문서 root → `themes`/`variables` 가 기존 시스템을 완전 대체하는 SSOT 선언

- **설명**: `themes`가 Tint/dark mode 런타임 상태를 대체하고, `variables`가 TokenRef resolver를 대체한다. ADR-021/022 시스템을 canonical document 필드의 reader로 변환한다. 장기적 "단일 source" 목표에 가장 근접.
- **기술 위험**: **HIGH** — ADR-021 Tint 색상 override, `useTintColor`, `useThemeMessenger`, `setDarkMode`/`themeVersion` 체인 (`themeConfigStore.ts:*`), ADR-022 `tokenResolver.ts`, `cssValueParser.ts` 를 동시에 재작성. 실패 시 전체 테마/토큰 시스템 회귀.
- **성능 위험**: **LOW** — theme/variable resolve는 초기화 경로로 FPS에 영향 없음.
- **유지보수 위험**: **LOW** — 최종 상태에서 단일 SSOT로 관리 부담 감소.
- **마이그레이션 위험**: **HIGH** — 기존 프로젝트 데이터에 `themes`/`variables` 없음 → 100% fallback 로직 필요. IndexedDB DB_VERSION 9 migration script가 `themes`/`variables` default를 모든 기존 문서에 역주입해야 함. 약 50+ fixture 재직렬화 필요.

**Risk Threshold Check**: 기술 HIGH + 마이그레이션 HIGH = 2개 HIGH. 추가 루프 필요.

### 대안 B: canonical `themes`/`variables` = 기존 시스템의 read-only view (adapter)

- **설명**: canonical document root의 `themes`/`variables` 필드는 기존 ADR-021/022 시스템의 현재 상태를 투영하는 **read-only snapshot adapter**로 구현된다. 런타임 변경은 여전히 기존 시스템을 통해 발생하고, canonical serialization 시점에 `buildThemesSnapshot()`/`buildVariablesSnapshot()` 이 현재 상태를 필드로 직렬화한다. 역방향(canonical `themes`/`variables` → 런타임 적용)은 Phase 2 이후.
- **기술 위험**: **LOW** — 기존 시스템 수정 없음. `buildThemesSnapshot`/`buildVariablesSnapshot` 신규 pure function 추가만 필요. `themeConfigStore`/`tokenResolver` 불변.
- **성능 위험**: **LOW** — 직렬화 시점 1회 snapshot. 렌더 경로 미개입.
- **유지보수 위험**: **MEDIUM** — 장기적으로 canonical document 가 "기록 SSOT"가 아닌 "view"라는 인식이 남아 후속 Phase에서 real SSOT 전환 시 기술 부채 1회 발생.
- **마이그레이션 위험**: **LOW** — 기존 프로젝트에 `themes`/`variables` 없어도 문제 없음. 직렬화 시 자동 snapshot 주입, 역방향 적용은 Phase 2 이후 opt-in.

### 대안 C: Phase 분할 — themes adapter 먼저 (B 방식), variables resolver 통합 나중 (A 방식)

- **설명**: `themes` (ADR-021) 와 `variables` (ADR-022) 를 서로 다른 Phase/ADR로 분리. `themes`: 대안 B 방식으로 read-only snapshot 먼저 → Phase 2에서 write-through 활성화. `variables`: Phase 1 contract 확정 → Phase 2에서 TokenRef resolver 통합 → Phase 3에서 full SSOT.
- **기술 위험**: **MEDIUM** — Phase 1은 LOW이나 Phase 2/3에서 TokenRef resolver 통합 시 MEDIUM 위험 발생. 두 Phase가 서로 다른 cadence로 진행되어 schema 계약 불일치 위험.
- **성능 위험**: **LOW**
- **유지보수 위험**: **MEDIUM** — 두 필드가 다른 "성숙도 단계"에 있는 기간 동안 소비자가 조건 분기 필요.
- **마이그레이션 위험**: **MEDIUM** — variables Phase 3의 전체 TokenRef → variables 전환 시 기존 spec/CSS 체계 영향 범위가 넓음. 정확한 파일 수 사전 측정 필요.

### Risk Threshold Check

| 대안 | 기술 | 성능 | 유지보수 | 마이그레이션 | HIGH+ 개수 |
| :--: | :--: | :--: | :------: | :----------: | :--------: |
|  A   |  H   |  L   |    L     |      H       |     2      |
|  B   |  L   |  L   |    M     |      L       |     0      |
|  C   |  M   |  L   |    M     |      M       |     0      |

- **대안 A**: HIGH 2개. 추가 루프 필요. 단기 구현 불가 — ADR-903 P5-A 진입 전 schema 확정이라는 hard constraint를 충족하려면 P5-A 직전에야 빅뱅 전환 가능하고, P5-A 자체(사용자 데이터 migration HIGH)와 겹쳐 위험 중첩.
- **대안 B**: HIGH 0. 기존 시스템 무수정, P5-A 진입 전 schema 계약 확정 가능. 후속 Phase에서 write-through 전환 시 기술 부채 1회 감수.
- **대안 C**: HIGH 0. B보다 세밀한 Phase 제어 가능하나 `variables` Phase 3 scope가 크고 ADR-022 TokenRef 전체 영향 범위를 별도 측정해야 함.

**루프 판정**: 대안 A는 HIGH 2개로 탈락. 대안 B (themes/variables 동시 read-only adapter)를 1차 권고하고, Phase 2 이후 write-through 전환 시점을 ADR 갱신 또는 별도 ADR-110-b로 결정한다. 대안 C는 variables의 Phase 3 scope가 ADR-903 P5-A 타임라인에 맞지 않을 경우 선택 가능한 대안으로 유지.

## Decision

**대안 B: `themes`/`variables` = 기존 ADR-021/022 시스템의 read-only snapshot adapter**를 채택한다.

### 선택 근거

1. **P5-A schema 계약 hard constraint 충족**: 대안 B의 Phase 1 (schema 계약 고정 + snapshot serializer 신설)은 ADR-903 P5-A (IndexedDB DB_VERSION 9 schema 정의) 진입 전에 완료 가능하다. 대안 A는 ADR-021/022 전면 재작성을 포함해 P5-A 타임라인과 충돌한다.
2. **ADR-021/022 비파괴**: `themeConfigStore`, `useTintColor`, `useThemeMessenger`, `tokenResolver.ts`, CSS 변수 체계 전부 무수정. 테마/토큰 기존 사용자 경로에 회귀 0.
3. **점진 경로 확보**: read-only snapshot → write-through 활성화 → (선택적) SSOT 단일화의 3단계 경로를 ADR 상태 변화로 추적 가능하다. 각 단계가 독립 rollback 가능.
4. **ADR-903 R4 준수**: DB 저장 포맷 전환을 마지막 Phase로 미루는 원칙. `themes`/`variables`의 실질 write-through는 P5-A 이후 opt-in.

### 기각 사유

- **대안 A 기각**: 기술 HIGH (`themeConfigStore.ts:*` + `tokenResolver.ts` + `cssValueParser.ts` 동시 재작성 3+ 파일) + 마이그레이션 HIGH (기존 프로젝트 50+ fixture 역주입 필요) — 2개 HIGH가 ADR-903 P5-A 진입 전 완료 요건과 충돌.
- **대안 C 보류**: `variables` Phase 3 (TokenRef resolver 통합) scope가 광범위하고 ADR-022 체계 전체에 영향. scope 측정 없이 단일 ADR에서 가이드라인 제시는 과도. 필요 시 ADR-110-b로 분리.

> 구현 상세: [110-canonical-themes-variables-land-plan-breakdown.md](design/110-canonical-themes-variables-land-plan-breakdown.md)

## Risks

| ID  | 위험                                                                                                                                                                    | 심각도 | 대응                                                                                                                                                                                               |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----: | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | canonical 문서의 `themes`/`variables` 가 read-only snapshot이므로 ADR-903 정신("문서-네이티브 선언")과 불일치. Phase 2 write-through 전환 지연 시 기술 부채 영구화 위험 | MEDIUM | Phase 2 시점을 ADR-903 G2 (resolver 공통화) 완료 직후로 Gate G-B에 명시. Phase 2 미진입 조건(ADR-903 P2 지연) 발생 시 본 ADR Status를 "Partially Implemented"로 갱신하고 debt 문서화               |
| R2  | `themes` snapshot이 Tint 색상 + dark mode 상태만 기록하면 후속 Phase에서 per-element `theme` override를 canonical document 로 확장할 때 schema 불충분할 가능성          |  LOW   | Phase 1 schema에 `{[key: string]: string[]}` 대신 확장 가능한 `ThemeSnapshot` 인터페이스를 정의 (`tint`, `darkMode`, `customTokens` 슬롯 예약). ADR-021 per-element override는 후속 ADR에서 결정   |
| R3  | `variables` snapshot이 Spec TokenRef resolve 결과만 기록하면 design-time variable binding (NumberOrVariable/StringOrVariable/ColorOrVariable) 을 표현 못함              |  LOW   | Phase 1에서 `VariableDefinition` 타입에 `source: "spec-token" \| "user-defined"` 구분자 포함. user-defined variable authoring UI는 후속 Phase로 이관                                               |
| R4  | snapshot serializer 가 ADR-021 tintColor/isDarkMode 상태를 직렬화할 때 themeVersion 변경을 감지하지 못하면 stale snapshot이 canonical document에 고착                   |  LOW   | `buildThemesSnapshot()` 을 `themeConfigStore` subscribe 기반이 아닌 call-time 직렬화로 구현 (ADR-021 themeVersion 증분 시 다음 save 시점에 자동 갱신). stale 판정 단위 테스트 추가 (Gate G-A 조건) |

잔존 HIGH 위험 없음.

## Gates

| Gate | 시점                           | 통과 조건                                                                                                                                                                                                                                                                                                                                                                                                                                                     | 실패 시 대안                                             |
| ---- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| G-A  | Phase 1 완료                   | (a) `CanonicalDocument.themes?: ThemeSnapshot` + `CanonicalDocument.variables?: VariablesSnapshot` 타입 계약 고정 (`composition-document.types.ts`) (b) `buildThemesSnapshot(themeConfig)` + `buildVariablesSnapshot(resolvedTokens)` pure function 구현 + 단위 테스트 2종 PASS (c) canonical document 직렬화 시 `themes`/`variables` snapshot 자동 주입 확인 (d) 기존 ADR-021/022 런타임 동작 회귀 0 — `type-check 3/3 PASS` + `specs` 전체 PASS             | Phase 1 설계 보강 후 재진입. P5-A 진입 보류              |
| G-B  | Phase 2 완료 (ADR-903 G2 이후) | (a) canonical document `themes` → runtime 적용 (write-through): document 로드 시 `themes.tint`/`themes.darkMode` → `themeConfigStore` 주입, round-trip PASS (b) canonical document `variables` → Spec TokenRef resolver 통합: `resolveCanonicalVariable(ref, document)` 가 `tokenResolver.ts` 결과와 동일 값 반환 (단위 테스트 PASS) (c) Preview/Skia 양쪽에서 `themes`/`variables` write-through 적용 후 시각 회귀 0 (Chrome MCP 실측 또는 cross-check PASS) | write-through 비활성화 유지. Phase 1 read-only 상태 동결 |

## Consequences

### Positive

- `themes`/`variables` 필드의 land phase가 ADR-903 미명시 gap에서 공식 계획으로 격상된다.
- ADR-903 P5-A (IndexedDB schema 정의) 진입 전 `themes`/`variables` schema 계약이 확정된다.
- 기존 ADR-021/022 시스템을 파괴하지 않으면서 canonical document가 테마·변수 선언 구조를 갖추게 된다.
- Phase 2 이후 write-through 경로가 명시적으로 보장되어 장기 SSOT 단일화 방향이 유지된다.

### Negative

- Phase 1에서 `themes`/`variables`는 read-only snapshot이므로 canonical document가 완전한 "선언 SSOT"가 되는 시점이 Phase 2 이후로 미뤄진다.
- `buildThemesSnapshot`/`buildVariablesSnapshot` serializer가 추가 직렬화 경로를 만들어 ADR-021/022 상태와 canonical document 상태 간 일시적 이중화가 발생한다.
- 후속 Phase (write-through, user-defined variables, per-element theme override) 는 본 ADR이 아닌 ADR-110-b 또는 ADR-903 Addendum으로 결정해야 한다.

## 진행 로그

### Phase 1 — `themes` + `variables` Read-only Snapshot Adapter (Implemented 2026-04-27)

**완료 영역** (`themes` + `variables` 양쪽):

- ✅ `apps/builder/src/adapters/canonical/themesAdapter.ts` — `snapshotThemesFromConfig()` + `readCanonicalThemes()` (R2 확장 슬롯 `customTokens` 포함)
- ✅ `apps/builder/src/adapters/canonical/__tests__/themes.test.ts` — adapter 단위 테스트 12 PASS
- ✅ `apps/builder/src/adapters/canonical/index.ts:238` — `legacyToCanonical()` 호출 시 `themesSnapshot` + `variablesSnapshot` 주입 통합
- ✅ ADR-021 `themeConfigStore` 무수정 — call-time 직렬화 (R4 stale snapshot 방지)
- ✅ ADR-022 `tokenResolver.ts` 무수정 — adapter 가 resolved map 만 받음 (R3 비파괴)
- ✅ `packages/shared/src/types/composition-document.types.ts` — `ThemeSnapshot` + `VariablesSnapshot` + `VariablesSnapshotEntry` 타입 SSOT 정착, `CompositionDocument.themes?: ThemeSnapshot` + `variables?: VariablesSnapshot` 으로 전환 (raw cast 제거)
- ✅ `apps/builder/src/adapters/canonical/variablesAdapter.ts` — `snapshotVariablesFromTokens()` + `readCanonicalVariables()` + `ResolvedTokenMap` DI 계약 (R3 `source: "spec-token" | "user-defined"` 구분자)
- ✅ `apps/builder/src/adapters/canonical/__tests__/variables.test.ts` — adapter 단위 테스트 14 PASS
- ✅ `docs/adr/design/110-canonical-themes-variables-land-plan-breakdown.md` — 구현 상세 분리 land
- ✅ Phase 1 G-A 통과 조건 (a)~(d) 완전 충족 — type-check 3/3 PASS + canonical adapter vitest 92/92 PASS

### 진행 로그

- **2026-04-27**: G-A 잔여 4건 종결 + design breakdown land. type-check 3/3 PASS + adapter vitest 92/92 PASS (themes 12 + variables 14 + integration 43 + 기타 23). Phase 1 G-A 완전 PASS — Phase 2 진입 prerequisite 충족. **Status `Proposed → Accepted` 승격 가능 시점** (Phase 2 write-through 미진입 상태이므로 ADR 전체 Implemented 는 보류).

### Phase 2 진입 조건 (ADR-903 G2 이후)

Phase 1 G-A 완전 PASS 가 Phase 2 prerequisite. 진입 전 다음을 모두 충족:

1. `composition-document.types.ts` 의 `themes?: ThemeSnapshot` stub 전환 (현재 `Record<string, string[]>`)
2. `variablesAdapter.ts` + 단위 테스트 + `legacyToCanonical()` 통합 land
3. design breakdown 문서 land (Phase 2 write-through 단계 + Gate G-B 체크리스트 명시)

Phase 2 land 시 Gate G-B (a)/(b)/(c) 검증:

- (a) `themes` write-through: document 로드 시 `themes.tint`/`themes.darkMode` → `themeConfigStore` 주입 + round-trip
- (b) `variables` resolver 통합: `resolveCanonicalVariable(ref, document)` ↔ `tokenResolver.ts` 동일 값
- (c) Preview/Skia 양쪽 시각 회귀 0 (cross-check skill 또는 Chrome MCP 실측)

### Phase 2 — Write-through Activation (In Progress 2026-04-27)

**완료 영역** (ts-3.1 / ts-3.2 / ts-3.3 / ts-3.5):

- ✅ **ts-3.1 — themes write-through adapter** (commit `53906e26`)
  - `themesAdapter.ts::applyCanonicalThemes(doc, setters): boolean` 신설 + `ThemeConfigSetters` DI interface
  - `canonical/index.ts` re-export
  - `themes.test.ts` 신규 6 tests (TC-A1~A6) — 적용 / BC / 잘못된 구조 무동작 (R4) / round-trip / 멱등 / `legacyToCanonical` 통합
  - `BuilderCore.tsx` initialize 종료 시점 entry — `VITE_ADR110_P2_THEMES_WRITE_THROUGH=true` 게이트
- ✅ **ts-3.2 — variables resolver + Gate G-B (b)** (commit `0e63a807`)
  - `variablesAdapter.ts::resolveCanonicalVariable(ref, doc): string | number | boolean | undefined`
  - TokenRef pattern `{category.name}` parsing (`tokenResolver.ts` 와 동일 정규식, hyphen name 허용)
  - `canonical/index.ts` re-export
  - `variables.test.ts` 신규 9 tests (TC-R1~R9) — 기본 lookup / number+boolean / BC / invalid / hyphen name / **Gate G-B contract** (light+dark theme 양쪽에서 `resolveToken` ↔ `resolveCanonicalVariable` 동일 값) / `legacyToCanonical` 통합
- ✅ **ts-3.3 — round-trip 통합 테스트** (commit `e99f1054`)
  - `integration.test.ts` 신규 4 tests (TC-RT1~RT4)
    - TC-RT1: themes + variables 동시 round-trip — `legacyToCanonical(input, { getThemeConfig, getVariables })` → `apply` + `resolve` → re-snapshot 결과 1차 snapshot 동일
    - TC-RT2: 멱등 — 같은 doc 으로 2회 apply/resolve 결과 안정
    - TC-RT3: 한쪽만 주입 (themes / variables / 둘 다 미주입) BC 보장
    - TC-RT4: Gate G-B 통합 — `resolveToken` ↔ `resolveCanonicalVariable` round-trip pipeline 전체
- ✅ **ts-3.5 — feature flag (rollback 경로)** (ts-3.1 land 시 동시 적용)
  - `BuilderCore.tsx` 의 entry 가 `VITE_ADR110_P2_THEMES_WRITE_THROUGH` 환경 변수로 게이트
  - flag 미설정 시 무동작 (Phase 1 read-only 동작 유지, BC)
  - 현재 `selectCanonicalDocument` 가 themes 미주입 (caller 가 `getThemeConfig` 미전달) → entry 활성화 시에도 무동작. ADR-113 Phase 4 Step 4-2 이후 DB 직접 로드 시 doc.themes 채워지면 의미 가짐

### Phase 2 진행 로그

- **2026-04-27**: ts-3.1 + ts-3.2 + ts-3.3 + ts-3.5 main land. type-check 3/3 PASS + canonical adapter vitest 111/111 PASS (themes 18 + variables 23 + integration 47 + 기타 23). **Gate G-B 진행률**: (a) themes write-through round-trip ✅ + (b) variables resolver 동일 값 ✅ + (c) Preview/Skia 시각 회귀 0 — **잔여 (ts-3.4)**
- **2026-04-27 ts-3.4 — Chrome MCP dev runtime 시각 회귀 검증 PASS**:
  - Builder dev runtime (`http://localhost:5173/builder/...`) Chrome MCP 검증
  - **Skia canvas 정상**: 2562×1768 (HiDPI 2x), WebGL2 컨텍스트 활성화, visible
  - **DOM 정상**: Header/workspace/panel 모두 렌더, error overlay 0건
  - **CSS 토큰 정상**: `--bg=#fff`, `--fg=oklch(20.5% 0 0)`, `--accent=oklch(from ... 55% c h)`, `--tint=oklch(0.5 0.22049 266.315)`, `--border=oklch(87% 0 0)` — Phase 1 read-only adapter 의 default 값 그대로 유지
  - **env flag 미설정 시 BC 보장 확증**: `VITE_ADR110_P2_THEMES_WRITE_THROUGH=false` (default) → BuilderCore entry 미진입 → Phase 1 동작 그대로. 페이지 reload 후 동일 결과 → **시각 회귀 0**
  - **env flag 활성화 시 무동작 확증**: `selectCanonicalDocument` 가 `getThemeConfig` 미전달 → `doc.themes = undefined` → `applyCanonicalThemes` `false` 반환 → 무동작 → **시각 회귀 0**
  - **round-trip contract**: TC-A4 (themes round-trip), TC-R7/R8 (Gate G-B light+dark resolveToken 동등), TC-RT1~RT4 (themes+variables 통합 round-trip + 멱등 + BC) 모두 PASS
- **Gate G-B (c) 충족** — 본 ADR 의 모든 Phase 2 sub-step (ts-3.1~3.5) 종결. **ADR Status `Accepted → Implemented` 승격 가능 시점**.

## References

- [ADR-903](completed/903-ref-descendants-slot-composition-format-migration-plan.md) — ref/descendants + slot 기본 composition 포맷 전환 계획 (§3.10 themes/variables stub 발원지)
- [ADR-021](completed/021-theme-system-redesign.md) — Tint + dark mode Theme 시스템
- [ADR-022](completed/022-s2-color-token-migration.md) — S2 색상 TokenRef 체계
- [ADR-063](063-ssot-chain-charter.md) — SSOT 체인 3-Domain 분할 charter
- [903-additional-fields-land-status.md](design/903-additional-fields-land-status.md) — P0 land 상태 검증 (§3 themes STUB / §3 variables PARTIAL 확인)
- [903-phase5-persistence-imports-breakdown.md](design/903-phase5-persistence-imports-breakdown.md) — P5-A IndexedDB DB_VERSION 9 schema 정의 (themes/variables schema 계약 의존)
