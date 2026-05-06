# ADR-909: Style SSOT Contract — Store Longhand Policy ↔ Consumer Normalization

## Status

Implemented — 2026-04-24

Phase 1-5 완결 — Track 2 PropertyUnitInput commit 경로 fix + Track 1 sweep (7 spec + 11 utils.ts 분기 + LAYOUT_PROPS) + rules/style-ssot.md 문서화. Chrome MCP 실측으로 padding/gap persist 정상 동작 + 새로고침 후 값 유지 확증. 검증: specs 311/311 + type-check 3/3 PASS.

## Context

composition 의 `element.props.style` 은 Zustand store 에 저장되는 CSS-like object 이며, Style 패널 UI 편집을 시각 출력 (Skia 렌더 + Preview DOM + 레이아웃 엔진) 으로 전달하는 경로의 중심. Inspector 가 2026-04-Session 직전 `distributeShorthand` 정책을 도입하여 shorthand (`gap`, `padding`, `margin`) 를 longhand (`rowGap`/`columnGap`, `paddingTop`/`Right`/`Bottom`/`Left`, `marginTop`/`Right`/`Bottom`/`Left`) 로 자동 분해하여 저장한다. 이 정책은 React inline-style shorthand+longhand 공존 시 rerender 경고 + Taffy `applyCommonTaffyStyle` 순서 (gap → rowGap/columnGap override) 경합을 방지하기 위함.

**증상 관찰 (2026-04-24)**: ListBox gap 편집이 Skia 에 반영되지 않음 → audit 결과 24+ consumer 가 shorthand-only 읽기로 longhand 를 인식 못함:

- 7 spec (`Button.spec.ts:416`, `Meter.spec.ts:478`, `ProgressBar.spec.ts:496`, `Form.spec.ts:362`, `Card.spec.ts:375`, `ColorSwatchPicker.spec.ts:195`, `List.spec.ts:135`)
- 15+ layout utils.ts 분기 (`apps/builder/src/builder/workspace/canvas/layout/engines/utils.ts:1006, 1089, 1177, 1271, 1977, 2041, 2105, 2167, 2540, 2646` 등)
- 1 Inspector UI (`apps/builder/src/builder/panels/styles/sections/LayoutSection.tsx:517-534` 의 `LAYOUT_PROPS` — reset 버튼 gap 편집 미감지)

**SSOT 3-domain 분할**: 본 ADR 은 **D3 (시각 스타일) 내부 consumer 정규화** 문제. store → consumer 경계에서 longhand 정책을 강제하는 contract 를 정의. D1 (DOM/접근성) 및 D2 (Props/API) 는 무관.

**Hard constraints**:

- Store 정책 "longhand only" 유지 (React rerender 경고 + Taffy conflict 회피).
- Builder(Skia) + Preview(DOM+CSS) + Layout 엔진 3 경로 시각 대칭 유지.
- 24+ 기존 증상 전원 해소.
- 재발 방지: 새 spec/utils 분기 추가 시 drift 자동 검출.

**Soft constraints**:

- 30+ 파일 편집 부담.
- Layer D resolver (ADR-907) 재사용 기회.

## Alternatives Considered

### 대안 A: 각론 sweep only

- 설명: 발견된 24+ 증상을 개별 fix. shorthand/longhand 둘 다 읽도록 수정. Primitive 강제 없음. 재발 방지 gate 없음.
- 위험:
  - 기술: LOW — 단순 grep + edit.
  - 성능: LOW — 동작 변경 없음.
  - 유지보수: **HIGH** — 신규 spec/utils 추가 시 같은 실수 반복 가능성 영구.
  - 마이그레이션: LOW — 기존 동작 유지.

### 대안 B: Layer B primitive (`resolveContainerSpacing`) 강제 + sweep

- 설명: ADR-907 의 `resolveContainerSpacing` primitive 를 모든 spec/utils consumer 경유로 강제. 편집 시 sweep + contract test 추가. 재발 방지 gate 로 vitest runtime contract test.
- 위험:
  - 기술: LOW — primitive 이미 존재 (ADR-907 완료), 재사용.
  - 성능: LOW — 추가 overhead 미미 (small object alloc).
  - 유지보수: LOW — SSOT 단일 경로, contract test 가 drift 차단.
  - 마이그레이션: MEDIUM — 30+ 파일 편집, 하지만 시각 결과 불변.

### 대안 C: Branded type `NormalizedStyle`

- 설명: B 에 추가로 TypeScript branded type 도입 — `Record<string, unknown>` 대신 `NormalizedStyle` 타입으로 store value 선언. Consumer 는 reader API 통해서만 접근.
- 위험:
  - 기술: **HIGH** — Type migration 영향 광범위 (Element type 변경 → 모든 spec/renderer 영향). 기존 `any` cast 다수 발견 가능.
  - 성능: LOW.
  - 유지보수: LOW — type 으로 drift 방지.
  - 마이그레이션: **HIGH** — 전체 type 체계 재구성.

### 대안 D: Store policy 반전 (shorthand only)

- 설명: `distributeShorthand` 제거. Store 는 shorthand 우선 저장. Consumer 도 shorthand 읽기 유지.
- 위험:
  - 기술: MEDIUM — React rerender 경고 재발 가능. Taffy shorthand→longhand 변환 경합 재발.
  - 성능: LOW.
  - 유지보수: MEDIUM — 원래 문제가 재발.
  - 마이그레이션: **HIGH** — 기존 저장 데이터 (longhand 포함) migration 필요.

### Risk Threshold Check

| 대안 | 기술  | 성능 | 유지보수 | 마이그 | HIGH+ 합 | 판정                    |
| :--: | :---: | :--: | :------: | :----: | :------: | :---------------------- |
|  A   |   L   |  L   |  **H**   |   L    |  1 HIGH  | 재발 방지 미해결 — 기각 |
|  B   |   L   |  L   |    L     |   M    |  0 HIGH  | 수용                    |
|  C   | **H** |  L   |    L     | **H**  |  2 HIGH  | 과도 — follow-up 대기   |
|  D   |   M   |  L   |    M     | **H**  |  1 HIGH  | 원 문제 재발 — 기각     |

루프 판정: B 는 HIGH 0 → 수용. C 는 type migration HIGH 와 기술 위험 HIGH 가 동시 발생하므로 현재는 과도. B 완료 후 follow-up ADR 로 C 검토 가능.

## Decision

**대안 B 선택**: Layer B `resolveContainerSpacing` primitive 강제 + sweep + contract test + docs.

**위험 수용 근거**: 마이그레이션 MEDIUM 은 30+ 파일 1일 작업이고 시각 결과 불변이므로 수용 가능. 기존 ADR-907 Layer B/D 인프라 재사용으로 새 기술 도입 없음. Contract test 가 재발 방지 gate 역할.

**기각된 대안의 기각 사유**:

- **A 기각**: 재발 방지 gate 없이 sweep 만 하면 신규 drift 자동 검출 불가. L3-L4 근본원인 미해소.
- **C 기각**: branded type 은 근본적이지만 현재 codebase 의 `any`/unknown 사용 빈도상 전면 type migration 리스크 과도. B 완료 후 debt audit → 별도 ADR (예: ADR-110+) 로 검토.
- **D 기각**: 정책 반전 시 React rerender + Taffy conflict 원래 문제 재발. 해결책이 아닌 롤백.

> 구현 상세: [909-style-ssot-contract-breakdown.md](../design/909-style-ssot-contract-breakdown.md)

## Risks

| ID  | 위험                                                                                                                                                 | 심각도 | 대응                                                                                                               |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | :----: | ------------------------------------------------------------------------------------------------------------------ |
| R1  | 7 spec + 15+ utils 분기 sweep 시 시각 regression 누출 가능                                                                                           |  MED   | Contract test + Chrome MCP cross-check. Phase B 전 Phase C contract test 선행 (TDD 역전)                           |
| R2  | `resolveContainerSpacing` 의 `paddingTop` undefined fallback(=0) 이 기존 shorthand-only 동작과 시맨틱 diff — 특정 spec 의 기본값 공급 누락 시 0 반영 |  MED   | sweep 시 각 spec 의 기본값을 resolver defaults 로 명시 전달. 자동 테스트로 확증                                    |
| R3  | Layout utils 15+ 분기는 tag-specific context 가 달라 공통 resolver 적용 어려울 수 있음                                                               |  MED   | 분기별로 `resolveContainerSpacing` vs 인라인 longhand-aware lookup 선택 권한 부여. Contract test 로 결과 동등 확증 |
| R4  | Contract test 가 모든 consumer 를 자동으로 포착하지 못하면 신규 drift 재발                                                                           |  LOW   | rules/style-ssot.md 에 "신규 spec/utils 추가 시 체크리스트" 명시 + (선택) ESLint rule follow-up                    |

"잔존 HIGH 위험 없음"

## Gates

잔존 HIGH 위험 없음 — Gate 테이블 불필요.

보강 의도로 아래를 자가 진행 조건으로 유지:

| Gate                      | 시점       | 통과 조건                                      | 실패 시 대안          |
| ------------------------- | ---------- | ---------------------------------------------- | --------------------- |
| G1 Contract test PASS     | Phase C 후 | 24+ 증상 전원 longhand 편집 반영 확증          | 개별 spec 재수정      |
| G2 기존 test regression 0 | Phase B 후 | specs + shared + builder test suite 전원 PASS  | 원인 식별 후 개별 fix |
| G3 Chrome MCP 시각 검증   | Phase B 후 | Builder Skia + Preview DOM 편집 즉시 반영 실측 | 시각 diff 원인 격리   |

## Consequences

### Positive

- 24+ 증상 전원 해소. 사용자 편집이 Skia/Preview 양쪽에 일관 반영.
- 재발 방지 gate 로 신규 spec/utils 추가 시 drift 자동 검출.
- ADR-907 Layer B/D 인프라 활용도 증가. SSOT 체계 강화.
- rules/style-ssot.md 로 정책이 문서화되어 L3 근본원인 (프로세스 부재) 해소.

### Negative

- 30+ 파일 편집 작업 부담 (1일 예상).
- Contract test 초기 작성 비용 (~100 LOC).
- follow-up 여지: branded type (대안 C) 은 별도 ADR 검토 필요 — 완전한 L2 (구조) 해결은 미완.
