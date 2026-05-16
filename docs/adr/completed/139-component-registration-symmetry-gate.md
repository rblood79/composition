# ADR-139: 컴포넌트 등록·대칭 build-time gate

## Status

Implemented — 2026-05-17

- Proposed 2026-05-16 — review-adr round 1 (승인 가능)
- Codex review round 2 (GO-WITH-FIXES) — HIGH 2 + MED 3 + LOW 1 정정 완료
- Accepted 2026-05-16 — 사용자 합의, Phase 0 착수
- Phase 0 완료 2026-05-17 — 레지스트리 inventory + per-registry expected-set 모델
  확정 (Gate G0). 결과: breakdown §2.5
- Phase 1 완료 2026-05-17 — `componentRegistrationContract.test.ts` (8/8 PASS,
  Gate G1) + baseline/exception JSON + 레지스트리 노출 (`ComponentFactory.
getRegisteredTypes` / `DEFAULT_PROPS_MAP` export)
- Phase 2 완료 2026-05-17 — `test:registration-contract` script + `codex:registration`
  게이트 + `codex:preflight` 체인 편입 (Gate G2). 결과: breakdown §4.1
- Phase 3 완료 2026-05-17 — `BASELINE_RATCHET` 도입 (baseline append 시 FAIL /
  감소 시 재측정 FAIL, Gate G3). contract test 10/10 PASS. 결과: breakdown §5.1
- Implemented 2026-05-17 — Phase 0-3 전 Gate(G0~G3) 통과. type-check baseline 547
  유지, 기존 test 회귀 0

## Context

composition 컴포넌트 파이프라인은 한 컴포넌트가 정상 동작하려면 **여러 독립
레지스트리에 각각 등록**되어야 한다. 한 곳이라도 누락되면 해당 경로만 조용히
깨진다:

| 레지스트리                           | 위치                                                              | 누락 시 증상                                      |
| ------------------------------------ | ----------------------------------------------------------------- | ------------------------------------------------- |
| `rendererMap`                        | `packages/shared/src/renderers/index.ts`                          | Preview/Publish 가 generic `<div>` fallback       |
| `BASE_TAG_SPEC_MAP` / `TAG_SPEC_MAP` | `packages/specs/src/runtime/tagToElement.ts`                      | `getSpecForTag()=null` → Skia spec shapes 미진입  |
| `TAG_SPEC_MAP` (builder merged)      | `apps/builder/src/builder/workspace/canvas/sprites/tagSpecMap.ts` | `getSpecForTag()=null` → Skia/Builder 경로 미진입 |
| `COMPLEX_COMPONENT_TAGS`             | `apps/builder/src/builder/factories/constants.ts`                 | factory 복합 컴포넌트 경로 미진입                 |
| `getDefaultProps`                    | `apps/builder/src/types/builder/unified.types.ts`                 | factory 가 `{}` 빈 props 생성                     |
| `ComponentFactory` creators          | `apps/builder/src/builder/factories/ComponentFactory.ts`          | 빌더 생성 자체 불가                               |
| `styles/index.css` `@import`         | `packages/shared/src/components/styles/index.css`                 | generated CSS 번들 미포함 → Preview 스타일 없음   |

> **builder merged `TAG_SPEC_MAP`**: `packages/specs` 정본을 `BUILDER_ALIAS_MAP`(8
> alias)과 병합한 별도 map 이다. `packages/specs` 정본이 맞아도 alias layer 가
> 어긋나면 Skia/Builder 경로만 조용히 깨지므로, gate inventory 에 별도 항목으로
> 포함한다.

이 레지스트리들은 **전부 수동 유지**된다. `canvas-rendering.md §2`에 "Spec 등록
4-point 체크리스트"가 명문화되어 있을 만큼 등록점이 많고, 누락이 일어나기 쉽다.

**Hard constraints (측정 가능)**:

- 검증은 **build/CI 시점**이어야 한다 — runtime dev warning 만으로는 누락이
  병합을 통과한다.
- 기존 누락 (`sweep-2026-05-16.json` 기준 64/119 = 54%) 을 **한 커밋에 모두
  고치지 않고도 도입 가능**해야 한다 (baseline 수용).
- **false positive 0** — 의도적 예외 (CSS 자동생성 전용 컴포넌트, 팔레트 미등재
  의도 등) 를 차단하면 정상 작업이 막힌다.

**Soft constraints (측정 불가)**: gate 자체의 유지보수 부담이 누락 방지 효과보다
작아야 한다.

**현 상태**: `.claude/rules/ssot-hierarchy.md §4-1`이 "build-time 자동화: 미완성.
향후 과제"라고 명시한다. 등록 누락이 **silent** 하게 누적되어 수동 sweep
(`sweep-2026-05-16.json`) 으로만 발견된다.

**3-domain 분류**: 본 ADR 은 D1/D2/D3 어디에도 _content_ 를 추가하지 않는
**infrastructure / enforcement ADR** 이다. D3 대칭(Skia↔CSS consumer parity)과
D2 타입 일관성을 "등록 누락이 build-가시화" 되도록 강제한다. SSOT 체인의
일부가 아니라 SSOT 체인을 **집행**하는 메커니즘이다.

## Alternatives Considered

### 대안 A: 단일 manifest → codegen

- 설명: 하나의 component manifest(SSOT)에서 위 7 레지스트리를 코드 생성. 누락이
  구조적으로 불가능해진다.
- 위험: 기술(M) — codegen 인프라 신규 / 성능(L) / 유지보수(M) — manifest schema
  진화 / 마이그레이션(**H**) — `renderers/index.ts` · `factories/constants.ts` ·
  `tagToElement.ts` · `styles/index.css` 등 기존 레지스트리를 codegen 출력으로
  동시 전환해야 하며, 각 레지스트리의 수동 분기·주석·커스터마이징이 손실된다.
  한 커밋에 적용 불가.

### 대안 B: Contract test (CI gate) + baseline allowlist

- 설명: canonical 컴포넌트 목록을 enumerate → 각 레지스트리 존재 여부를 vitest
  로 assert. 기존 64 누락은 baseline allowlist 로 수용 후 점진 축소 — apps/builder
  `type-check` baseline(550) 과 동일한 점진 도입 방식. 선례:
  `packages/shared/src/renderers/__tests__/rendererStyleContract.test.ts`
  (ADR-907 Layer C) 가 이미 11 렌더러의 root style props 를 runtime 검증한다.
- 위험: 기술(L) — 기존 검증 패턴 / 성능(L) — vitest 1 파일 / 유지보수(M) — gate
  의 레지스트리 목록 + 예외 목록 유지 / 마이그레이션(L) — baseline 으로 즉시
  도입.

### 대안 C: ESLint custom rule

- 설명: static analysis 로 누락 감지.
- 위험: 기술(**H**) — ESLint custom rule 도 파일시스템·타입 정보 접근으로
  cross-file 검사 자체는 가능하나, 레지스트리가 서로 다른 파일·패키지·형태(Set /
  Record / barrel / CSS `@import` / runtime alias)에 흩어져 있어 이를 모두
  포괄하는 rule 구현비가 Vitest contract test 보다 높다 / 성능(L) / 유지보수(M) /
  마이그레이션(L).

### 대안 D: Runtime dev-mode warning

- 설명: dev 모드에서 미등록 레지스트리로 컴포넌트 렌더 시 `console.warn`.
- 위험: 기술(L) / 성능(L) / 유지보수(L) / 마이그레이션(L) — **그러나 "gate"
  목적 미충족**: build/CI 를 막지 못해 누락이 여전히 병합을 통과한다 (감지 O,
  차단 X).

### Risk Threshold Check

| 대안 | HIGH+ 위험               | 판정                                    |
| ---- | ------------------------ | --------------------------------------- |
| A    | 마이그레이션 HIGH        | 단독 도입 불가                          |
| B    | 없음                     | **통과**                                |
| C    | 기술 HIGH                | 이질적 레지스트리 포괄 rule 구현비 과다 |
| D    | 없음 (단 gate 목적 미달) | "gate" 정의 미충족                      |

대안 B 만 HIGH 위험 0 + gate 목적(build 차단)을 충족한다. 루프 불필요.

## Decision

**대안 B — Contract test (CI gate) + baseline allowlist** 를 채택한다.

- **위험 수용 근거**: B 의 잔존 위험은 전부 MED 이하다. 유지보수 MED(gate 의
  레지스트리·예외 목록 유지)는 `rendererStyleContract.test.ts` 가 이미 동급
  부담을 안고 안정 운영 중인 선례로 수용 가능하다. baseline allowlist 는
  apps/builder type-check baseline(550)에서 검증된 점진 도입 방식이다.
- **기각 사유**:
  - A: 마이그레이션 HIGH — 기존 레지스트리를 codegen 출력으로 동시 전환하는
    것은 한 커밋에 적용 불가하고, 기존 수동 커스터마이징을 잃는다. 단 codegen
    은 gate 안정화 + baseline 0 도달 후 누락을 *원천 차단*하는 수단으로 후속
    ADR 후보로 남긴다 (Consequences 참조).
  - C: ESLint 도 cross-file 검사 자체는 가능하나, 이질적 형태(Set / Record /
    barrel / CSS `@import` / runtime alias)를 모두 포괄하는 custom rule 구현비가
    Vitest contract test 보다 높다.
  - D: build/CI 를 차단하지 못해 누락이 병합을 통과 — "gate" 정의 미충족.

**BC 영향**: gate 는 검증 코드만 추가하며 런타임 동작·schema·prop 을 변경하지
않는다. 기존 프로젝트 호환성 훼손 0.

> 구현 상세: [139-component-registration-symmetry-gate-breakdown.md](../design/139-component-registration-symmetry-gate-breakdown.md)

## Risks

| ID  | 위험                                                                                                                                             | 심각도 | 대응                                                                                                                                                       |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------ | :----: | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | baseline allowlist 가 영구 정체 — 64 누락이 줄지 않고 gate 가 "현상 동결" 도구로 전락 (apps/builder type-check baseline 550 이 장기 정체된 전례) |  MED   | gate 에 **baseline append 금지 + 감소-전용(ratchet)** 규칙 적용. 신규 컴포넌트는 baseline 진입 불가 — 반드시 전 레지스트리 등록 후 병합.                   |
| R2  | 의도적 예외 목록(CSS 자동생성 전용 / 팔레트 미등재 의도)이 stale 화 — 실제 버그인데 예외로 가려짐                                                |  MED   | 예외 항목마다 **사유 1줄 + 근거 ADR/rule 링크 주석 의무**. exception map 과 baseline allowlist 를 물리적으로 분리(예외 = 영구 정당, baseline = 일시 debt). |
| R3  | 신규 레지스트리 추가 시 gate 의 레지스트리 목록을 동시 갱신해야 함 (gate 자체 유지보수)                                                          |  LOW   | breakdown 에 "신규 레지스트리 추가 체크리스트" 명시 — `layoutVersion` 3-심볼 체인 보수 의무와 동급으로 취급.                                               |

잔존 HIGH 위험 없음.

## Gates

잔존 HIGH 위험 없음 — adr-writing.md 상 HIGH 위험 부재 시 Gate 테이블은 생략
가능하다. R1/R2(MED) 대응은 Risks 표에 명시했다.

다만 본 ADR 은 **검증 인프라 도입** 자체가 목적이므로, 구현 전 차단 조건을
design breakdown 의 **Phase Gate G0~G3** 로 관리한다:

- **G0** — Phase 0 inventory 4 산출물(canonical list SSOT / 레지스트리 표 /
  baseline / exception map) 완료
- **G1** — contract test 가 현 코드 PASS + negative fixture FAIL
- **G2** — CI/preflight 편입 + FAIL 시 병합 차단 확인
- **G3** — baseline ratchet 동작(감소 시 FAIL / append 시 FAIL) 확인

## Consequences

### Positive

- 등록 누락이 build/CI-가시화 → 신규 컴포넌트가 silent 하게 레지스트리를
  빠뜨릴 수 없다 (`sweep-2026-05-16` 류 수동 sweep 의존 종료).
- baseline 숫자(64→0 목표)가 측정 가능한 debt 카운터가 된다 — 후속 T1/T2/T3
  작업 진행 시 자연 감소를 추적 가능.
- `rendererStyleContract.test.ts` 선례를 일관 확장 — root style props 검증에
  이어 registration 완결성까지 contract 화.
- gate 안정화 + baseline 0 도달 후, 대안 A(codegen)로 누락 원천 차단을 후속
  ADR 로 검토할 토대가 마련된다.

### Negative

- gate 유지보수 부담 — 레지스트리 목록 + 예외 목록 (R2/R3).
- CI 시간 +α — vitest 1 파일 추가, 무시 가능 수준.
- baseline 정체 위험(R1) — ratchet 규칙으로 관리하나 규율 의존이 남는다.
