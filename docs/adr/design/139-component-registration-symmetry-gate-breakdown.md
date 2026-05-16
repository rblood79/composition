# ADR-139 구현 상세 — 컴포넌트 등록·대칭 build-time gate

> 본 문서는 [ADR-139](../139-component-registration-symmetry-gate.md) 의 구현
> 상세다. ADR 본문은 Context / Alternatives / Decision / Risks / Gates 만 담는다.

## 1. ADR 분리 점검

ADR-139 는 기존 ADR 에서 분리된 것이 아니다. `.claude/rules/ssot-hierarchy.md
§4-1` 이 명시한 미완 과제("build-time 자동화: 미완성. 향후 과제")를 새로
작성한 것이다.

`sweep-2026-05-16.json` 전수 audit 이 식별한 4개 근본 원인 중 T4 에 해당한다:

- T1. 고정-부품 compound 모델 (ProgressBar/Meter/Switcher/Calendar)
- T2. Collection items-SSOT 잔여 (List/Tree/TableView)
- T3. Prop-naming SSOT (showValue/showValueLabel 등)
- **T4. 등록·대칭 build-time gate 부재 ← 본 ADR**

T1~T3 은 T4 와 직교한다 — 각각 별도 ADR/작업으로 다룬다. 본 ADR 은 T4 단독이며
선행 ADR 의 전제를 승계하지 않으므로 ADR 분리 4 질문은 해당 없음.

**선례·인접 인프라**:

- `packages/shared/src/renderers/__tests__/rendererStyleContract.test.ts`
  (ADR-907 Layer C) — 11 렌더러 root style props 를 runtime 검증. 본 gate 가
  동일 패턴을 registration 완결성으로 확장.
- ADR-080/081 — primitives→consumer 3경로 drift 감지 인프라. token _값_ drift
  대상이라 본 ADR 의 _등록_ 완결성과 scope 가 다름 (중복 아님).

## 2. Phase 0 — Inventory

목표: gate 가 검증할 대상을 확정한다.

### 2-1. Canonical 컴포넌트 목록 SSOT 결정

후보:

- (a) `BASE_TAG_SPEC_MAP` keys (`packages/specs`)
- (b) `packages/specs/src/components/*.spec.ts` 파일 목록
- (c) `ComponentTag` union type

Phase 0 산출물: 3 후보 비교 + 단일 SSOT 선정 근거 기록. 잠정 권장 (c) —
타입 차원 SSOT, build 시 enumerate 가능.

### 2-2. 레지스트리 목록·형태 확정

각 레지스트리의 (파일 경로, 자료구조, 키 추출 방법) 표 작성:

| 레지스트리                           | 자료구조   | 키 추출           |
| ------------------------------------ | ---------- | ----------------- |
| `rendererMap`                        | Record     | `Object.keys`     |
| `BASE_TAG_SPEC_MAP` / `TAG_SPEC_MAP` | Map/Record | keys              |
| `COMPLEX_COMPONENT_TAGS`             | Set        | iterate           |
| `getDefaultProps`                    | Record/Map | keys              |
| `ComponentFactory` creators          | Record     | keys              |
| `styles/index.css`                   | CSS 텍스트 | `@import` 줄 파싱 |

### 2-3. 현 64 누락 전수 분류 → baseline 작성

`sweep-2026-05-16.json` 의 등록 누락 issue 를 `(컴포넌트 × 레지스트리)` 쌍으로
정규화 → `componentRegistrationBaseline.json` 생성.

### 2-4. 의도적 예외 식별 → exception map

- `Header` — React renderer 의도적 부재 (CSS 자동생성 전용 설계 가능성, Phase 0
  에서 확정)
- `ColorWheel` 등 — 팔레트 미등재 의도 (복합 factory 자식 전용)
- `Group` — RAC ARIA Group, ADR-130 frame 단일화로 factory create 미등록 의도

각 예외 항목에 사유 1줄 + 근거 ADR/rule 링크 주석 (R2 대응).

**Gate G0**: 4 산출물 (canonical list SSOT 결정 / 레지스트리 표 / baseline /
exception map) 작성 완료.

## 3. Phase 1 — Contract test

`componentRegistrationContract.test.ts` 작성.

- 위치: `packages/shared/src/renderers/__tests__/` (rendererStyleContract 인접)
  vs 신규 cross-package 위치 — Phase 1 에서 cross-package import 가능성 고려해
  결정.
- 매트릭스: canonical list × N 레지스트리. 각 `(컴포넌트, 레지스트리)` 쌍에
  대해 존재 여부 assert.
- 판정: baseline 에 있으면 skip(known debt) / exception 에 있으면 skip(intended)
  / 둘 다 아니면 FAIL.

**Gate G1**: contract test 가 현 코드에서 PASS (baseline + exception 으로 64
누락 수용). 신규 누락을 주입한 negative fixture 가 FAIL 하는지 확인.

## 4. Phase 2 — CI 편입

- `package.json` script 추가 (예: `test:registration-contract`).
- 기존 게이트 (Stop hook type-check / `codex:preflight`) 와 동급으로 편입.

**Gate G2**: CI/preflight 에서 gate 실행 + FAIL 시 차단 확인.

## 5. Phase 3 — Baseline ratchet

- contract test 가 baseline 보다 누락이 적으면 "baseline 갱신 권장" 안내
  (apps/builder type-check baseline 패턴 동일).
- baseline append 차단: 신규 컴포넌트가 baseline 에 추가되려 하면 FAIL.

**Gate G3**: ratchet 동작 확인 — 누락 1건 수정 후 baseline 미갱신 시 안내 출력,
baseline append 시 FAIL.

## 6. 신규 레지스트리 추가 체크리스트 (R3 대응)

새 레지스트리를 파이프라인에 추가할 때:

1. 레지스트리 목록 표(§2-2)에 추가.
2. contract test 매트릭스에 컬럼 추가.
3. baseline 재측정.

## 7. Risks → Gate 매핑

| Risk               | Gate | 통과 조건                                    |
| ------------------ | ---- | -------------------------------------------- |
| R1 (baseline 정체) | G3   | ratchet — append 차단 + 감소 시 갱신 안내    |
| R2 (예외 stale)    | G0   | exception map 항목마다 사유 + 링크 주석 의무 |
| R3 (gate 유지보수) | §6   | 신규 레지스트리 추가 체크리스트              |

## 8. 검증 체크리스트

- [ ] Phase 0-3 각 Gate(G0~G3) 통과
- [ ] `pnpm type-check` PASS
- [ ] 기존 test 회귀 없음
- [ ] README ADR-139 Implemented 갱신 + CHANGELOG `Infrastructure` 항목

Phase 0-3 실행은 사용자 검토 후 단계다 (ADR-133/134 와 동일 — 현재 커밋은 설계
문서만 추가, 코드 변경 없음).
