# ADR-915: catalog binding.accepts prop parity 복원 (ADR-912 후속)

## Status

Proposed — 2026-06-25

## Context

ADR-912(spec→catalog cutover, Implemented 2026-06-18)로 컴포넌트 편집 prop 정의가 `packages/specs`(124 spec 파일)에서 `packages/shared/src/catalog/bindings`(115 binding 파일)의 `props.accepts`로 이전됐다. cutover는 **메커니즘 전환**이 목표였고 prop 축소를 의도하지 않았으나, 이전 과정에서 각 컴포넌트의 편집 가능 prop 집합이 **공식(RAC/React Spectrum) 대비 축소**됐다. 사용자 보고: "컴포넌트 프로퍼티 대량 소실".

전수 감사([docs/reference/adr-912-prop-parity-audit.md](../reference/adr-912-prop-parity-audit.md))로 소실이 두 층위임을 확인:

- **층위 A** — field kind 렌더러 누락(`binding`/`items-manager`). 커밋 `1419a5773`/`24f38b75b`로 이미 복원. 정의 11종 ↔ 처리 11종 일치.
- **층위 B** — `accepts` 자체의 prop 누락. field kind 검사로 안 잡힘. 본 ADR 대상.

추가로 **층위 B와 직교하는 중복·불일치 축**도 전수 점검(audit §1.6, 115 binding AST 스캔)으로 확인: 내부 키 중복 0건, `Input.variant` kind 불일치(enum vs variant) 1건, `color`/`step` 의 `accepts` ∩ `UNIVERSAL_STYLE_CONTRACTS` 이중 노출 4건. 누락이 아니라 정정이라 P0 에 흡수(0-6/0-7/0-8).

**비교 기준 교정 (audit §9, 사용자 지적 2026-06-25)**: 위 층위 B 1차 감사(§2~§6)는 **RAC/RSP 공식 prop** 만 비교 기준으로 썼다. 그러나 "레퍼런스엔 없지만 spec 에 있던 custom prop"(`contextualHelp`/`necessityIndicator`/Card `accentColor` 등)은 공식 대조로 검출 자체가 안 됐다. 정확한 기준은 **cutover 로 삭제된 spec 파일**. 삭제된 132 spec 복원 후 `interface {Name}Props` ↔ 현재 `accepts` 전수 diff(5 패밀리 병렬 에이전트, live consumer grep 검증). 핵심 발견:

- **"live consumer 있는데 accepts 누락"**: 렌더러는 이미 `props.{x}` 소비 중인데 편집 UI 만 결손 → 복원 시 즉시 동작. Form submit 계열·`labelAlign`/`necessityIndicator`/`validationBehavior`/`locale`·Dialog `role`·FileTrigger·Image `src`/`alt`/`objectFit`·Card `accentColor` 등 → **P1 로 흡수**.
- **`contextualHelp` 전멸**(12 spec → 0 binding, RSP 표준) + RSP custom 계열 → accepts + 렌더러 wiring 양쪽 필요 → 신규 **P1.5**.
- **노이즈**(폐기 컴포넌트 15종 / children 흡수 / 서브파트 전파 / RAC render-state) → 복원 금지.

본 ADR은 **층위 B 중 P0(정정·중복 포함) + P1(폼 기능 + §9-1 live-consumer 결손) + P1.5(RSP custom)**로 scope를 좁힌다. P2/P3(컬렉션 core, Color 채널, Heading.level, Popover/Tooltip placement 등)은 후속 분리.

**SSOT domain**: D2(Props/API, RSP 참조) 복원 + 일부 D3(시각 옵션). D1(DOM) 무관.

**Hard Constraints**:

1. `accepts`에 prop 추가 = 편집 surface 추가일 뿐, RAC 전달(`toRacProps`) + Skia/CSS/Layout 3경로 소비가 별개로 보장돼야 함 (canonical-rendering 규칙).
2. D2 정책: RSP 미규정 prop 임의 도입 금지(ADR-062 선례). `variant` 문자열 등은 개별 판정.
3. 신규 `InspectorFieldKind` 추가는 scope 확장 — 사용자 surface 필요.

**Soft Constraints**: 좁은 scope 유지(사용자 지정), P0→P1 순서.

## Alternatives Considered

### 대안 A: 전수 복원 (P0~P3 일괄)

- 설명: 감사에서 식별된 모든 ❌누락 prop을 한 ADR에서 복원.
- 근거: 감사 문서가 이미 전수 근거 제공 → 한 번에 정합화.
- 위험:
  - 기술: M — formatOptions/channel 등 신규 kind 필요 prop이 섞여 scope 폭증.
  - 성능: L — 편집 surface 추가는 런타임 성능 무관.
  - 유지보수: H — 컬렉션 core/Color/Date를 한 ADR에 묶으면 검증 단위가 비대, live behavior 게이트 부담 누적.
  - 마이그레이션: L — 개발 단계, BC 불필요.

### 대안 B: P0 정정 + P1 폼 결손만 (좁은 ADR)

- 설명: 오류 정정(P0) + 폼으로서 동작에 필수인 prop(P1)만 복원. P2/P3 후속 분리.
- 근거: 사용자 지정 scope. 폼 기능 결손은 "폼으로서 동작 불완전"이라 우선순위 명확. P0는 추가가 아닌 오류 수정이라 독립.
- 위험:
  - 기술: L — value/name/errorMessage 등 단순 string/boolean kind로 표현 가능. formatOptions/granularity 일부만 ⚠️.
  - 성능: L — 동일.
  - 유지보수: L — 검증 단위가 폼 패밀리로 한정 → live behavior 게이트 명확.
  - 마이그레이션: L — 개발 단계.

### 대안 C: 정정(P0)만, 추가(P1) 보류

- 설명: 오류 항목만 수정하고 prop 추가는 전부 후속.
- 근거: 최소 변경.
- 위험:
  - 기술: L.
  - 성능: L.
  - 유지보수: M — "대량 소실" 핵심(폼 prop)이 미해결로 남아 사용자 보고 미충족.
  - 마이그레이션: L.

### Risk Threshold Check

| 대안 | 기술 | 성능 | 유지보수 | 마이그레이션 | HIGH+ 개수 |
| ---- | :--: | :--: | :------: | :----------: | :--------: |
| A    |  M   |  L   |  **H**   |      L       |     1      |
| B    |  L   |  L   |    L     |      L       |     0      |
| C    |  L   |  L   |    M     |      L       |     0      |

루프 판정: 대안 B가 HIGH 0 + 사용자 보고("대량 소실")의 핵심(폼 prop)을 해소. 추가 대안 불요.

## Decision

**대안 B: P0 정정 + P1 폼 기능 결손 복원**을 선택한다.

선택 근거:

1. 사용자 지정 scope와 일치 — 좁게 유지, P0→P1 순서.
2. 검증 단위가 폼 패밀리로 한정돼 live behavior 게이트가 명확.
3. P0는 공식 prop과 불일치를 정정하는 작업이나 **모든 P0 항목이 "안전한 제거"는 아니다** — 일부(Radio `isSelected`, MeterTrack `isIndeterminate`)는 live consumer 가 있어 제거 시 회귀. P0 단위는 "제거"가 아니라 "live consumer 확인 → 대체 설계 있으면 정정, 없으면 보류"(codex 리뷰 2026-06-25 반영).

> **scope split 근거 (adr-writing.md §fork/split confirm)**: P0+P1 로 좁히고 P2/P3 를 후속 분리한 것은 사용자 explicit 지시("ADR-912 후속 prop parity restoration 로 좁히세요", 2026-06-25)에 따른 것이다. claude 임의 fork 아님.

기각 사유:

- **대안 A 기각**: 컬렉션 core/Color/Date/신규 kind를 한 ADR에 묶으면 유지보수 위험 HIGH + scope 폭증. P2/P3는 후속 분리가 검증 단위를 명확히 함.
- **대안 C 기각**: "대량 소실" 핵심인 폼 prop이 미해결로 남아 사용자 보고 미충족.

> 구현 상세: [915-catalog-prop-parity-restoration-breakdown.md](design/915-catalog-prop-parity-restoration-breakdown.md)

## Risks

| ID  | 위험                                                                                                                                                                                                              |  심각도  | 대응                                                                                                                            |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------: | ------------------------------------------------------------------------------------------------------------------------------- |
| R1  | `accepts` 추가했으나 `toRacProps`/Skia 미소비 → 편집해도 시각 무반응                                                                                                                                              |   MED    | breakdown §3 3경로 점검 + live behavior 게이트(Chrome MCP 1회 exercise)                                                         |
| R2  | `formatOptions`/날짜 `minValue·maxValue`가 단순 kind로 표현 불가 → 신규 kind 필요                                                                                                                                 |   MED    | P1-c/P1-f kind 표현 가능성 선검증, 불가 시 사용자 surface(scope 확장 차단)                                                      |
| R3  | `variant` 문자열 → `isEmphasized` 정렬이 D3 시각 variant를 깨뜨릴 수 있음                                                                                                                                         |   MED    | P0-5 개별 사용자 확인 후 진행, D3 정당 시 보류                                                                                  |
| R4  | P0 항목(Radio `isSelected`, MeterTrack `isIndeterminate`)을 "공식에 없으니 제거"로 처리하면 **live consumer 회귀** (FormRenderers `defaultSelected` / skiaPrimitives indeterminate 막대)                          | **HIGH** | P0 단위를 "제거"가 아닌 "live consumer 확인 후 분기"로 고정(G1). dead 아님이 확인됐으므로 기본은 보류, 대체 설계 있을 때만 정정 |
| R5  | 0-7(`color`/`step` 이중 노출 dedup)은 `resolveEditContract` 의 **전 컴포넌트 공통 경로** 변경 → dedup 규칙이 의도치 않은 필드 누락 유발 가능(다른 binding 의 정당한 accepts 키가 universal 과 우연히 겹쳐 제외됨) |   MED    | accepts ∩ universal 충돌 키를 **현재 4건으로 고정 확인 후** dedup 적용. dead 아님이라 정정은 선택적 — 보류 가능. 정정 시 G4     |

R4 가 잔존 HIGH 위험 — Gate G1 이 1:1 관리(아래). R5(MED)는 G4.

## Gates

| Gate | 시점                      | 통과 조건                                                                                                                                                                                                                                                        | 실패 시 대안                                                                           |
| ---- | ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| G1   | P0 각 항목 (R4 관리)      | Skia/CSS/renderer 소비 grep → **dead 확정된 항목만 제거**. live consumer 있는 항목(Radio `isSelected`/MeterTrack `isIndeterminate` 확인됨)은 제거 금지, 대체 설계 없으면 보류                                                                                    | dead 미확정 시 제거 보류 (기본값 = 보류)                                               |
| G2   | P1 각 그룹                | type-check PASS + Inspector 표시 + 편집 시 store 반영 + Preview 동작 변화 1회 확인                                                                                                                                                                               | 미반영 시 3경로 재점검                                                                 |
| G3   | formatOptions (object 값) | 기존 InspectorFieldKind 로 표현 가능 (object editor 없음 확인됨). accepts-only 변경만으로 RAC 전달되는가 — string JSON 은 parse/validation/toRacProps 부재 시 runtime 무시 위험                                                                                  | 표현 불가 또는 runtime work 필요 시 사용자 surface (accepts-only 범위 초과 → 별도 ADR) |
| G4   | 0-7 dedup (R5 관리)       | accepts ∩ `UNIVERSAL_STYLE_CONTRACTS` 충돌 키가 현재 4건(`color`×2, `step`×2)으로 고정 확인. dedup 후 ColorSwatch/TailSwatch/NumberField/Slider 패널에서 동명 필드 **2개→1개** + 그 외 binding 필드 수 불변(Chrome MCP 또는 resolveEditContract 스냅샷 1회 확인) | 다른 binding 필드 누락 발생 시 dedup 롤백 → 보류(dead 아님이라 보류 정당)              |

## Consequences

### Positive

- 폼 컴포넌트가 빌더에서 "폼으로서" 동작(프리필/제출 식별/검증 메시지) — `*.binding.ts` accepts 확장.
- 공식(RAC/RSP) prop과 정합 회복 — D2 참조 정렬.
- P0 오류(InlineAlert variant 등) 정정.

### Negative

- `accepts` 확장으로 Inspector 패널 필드 수 증가 — section 그룹핑으로 완화.
- P2/P3 미복원 — 후속 ADR 필요(컬렉션 core, Color 채널, Heading.level).
