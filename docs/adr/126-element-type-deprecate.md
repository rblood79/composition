# ADR-126: Element 타입 Deprecate — canonical-native consumer 전환 및 boundary 격리

## Status

Accepted — 2026-05-10

**PREREQUISITE (진입 불가 조건)**: ADR-123, ADR-124, ADR-125 세 ADR 모두 `Implemented` 상태여야 이 ADR의 Phase 1 이상 진입이 가능하다. 세 ADR 중 하나라도 `Accepted` 이하이면 이 ADR은 `Proposed` 상태를 유지하고 Phase 0(inventory freeze)만 선행 수행할 수 있다.

## Context

### SSOT 체인 도메인 판정

이 ADR은 D2(Props/API) 내부 데이터 모델에 해당한다. `Element` 인터페이스는 Builder runtime의 internal data shape이며, D1(DOM/접근성)이나 D3(시각 스타일)과 무관하다. Spec 관여 없음.

### 배경 — ADR-122 soft constraint 이행

ADR-122 (Canonical-only runtime 전환)는 `Implemented` 완결 시점에 아래 soft constraint를 명시했다:

> "한 번에 `Element` 타입을 삭제하지 않고, runtime source 제거 → derived view 축소 → compatibility boundary quarantine 순서로 진행한다."

ADR-122 G6 closure 기준으로 Builder runtime hot path에서 mutable legacy mirror를 source로 쓰는 코드는 제거됐다. 그러나 `Element` 인터페이스 자체와 이를 소비하는 파생 view(`canonicalDocumentToElements`, `useCanonicalElements`), store cache(`elementsMap`, `childrenMap`), 그리고 각종 consumer 코드가 production에 잔존한다. ADR-122 residual policy 원문:

> "`UPDATE_ELEMENTS` Preview compatibility receive type, publish/cloud/export/import boundary, and canonical-derived renderer maps remain allowed by bucket."

즉 ADR-122는 "runtime source를 제거"했을 뿐, "Element 타입 자체를 제거"하지는 않았다. 이 ADR은 그 next step이다.

### 의존 ADR 체인

| ADR         | 역할                                                                                                                                                                 | 상태             |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| ADR-116     | `CompositionDocument` storage SSOT 승격                                                                                                                              | Implemented      |
| ADR-118/119 | `children[]` order SSOT, `order_num` 제거                                                                                                                            | Implemented      |
| ADR-120/121 | IndexedDB legacy surface cleanup                                                                                                                                     | Implemented      |
| ADR-122     | runtime mutable legacy mirror 제거                                                                                                                                   | Implemented      |
| **ADR-123** | Cloud document-level row schema 단일화 (Supabase pages/elements row + cloud API surface 정리)                                                                        | **PREREQUISITE** |
| **ADR-124** | Canonical-only history entry schema (legacy snapshot field 제거 + `composition-history` DB v1→v2 migration)                                                          | **PREREQUISITE** |
| **ADR-125** | Render input canonical-native contract (layout engine map shape input 제거 + Preview `UPDATE_ELEMENTS` receive 제거 + element move `order_num` closure ADR-122 HC.5) | **PREREQUISITE** |
| **ADR-126** | Element 타입 boundary 격리 및 production 제거                                                                                                                        | 이 ADR           |

**base/응용 분류**: ADR-126은 ADR-123/124/125의 **응용 ADR**이다. base 세 ADR 이 cloud transport / history persistence / render input contract 의 legacy `Element` 의존을 각각 제거하면, ADR-126은 그 위에서 잔존 `Element` 타입 consumer 를 canonical-native model 로 전환하고 타입 자체를 boundary allowlist 로 격리한다. 역방향(ADR-126이 먼저) 진입 불가 — base 셋이 닫히기 전에는 `Element` 타입 의존 consumer 가 아직 존재하므로 production 0건 달성 불가능.

### 현재 Element 타입 사용 규모 (2026-05-10 기준 seed)

| 분류                    | 대상                                                                                                              | 추정 라인 |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------- | --------- |
| derived view 정의       | `canonicalElementsView.ts` (`canonicalDocumentToElements`, `useCanonicalElements`, `useCanonicalSelectedElement`) | ~400      |
| history consumer        | `historyActions.ts`, `canonicalHistoryEvents.ts`                                                                  | ~100      |
| store cache 타입        | `elements.ts`, `unified.types.ts` store state 인터페이스                                                          | ~80       |
| hot path consumer       | `instanceActions.ts`, `canonicalRefResolution.ts`, Skia/scene/inspector/preview 등                                | ~400      |
| utility / helper        | `elementUtils.ts`, `elementHelpers.ts`, `legacyElementSanitizer.ts`                                               | ~200      |
| boundary (cloud/export) | `projectSync.ts`, `export.utils.ts`, `exportLegacyDocument.ts`                                                    | ~150      |

전체 추정: production `Element[]` 타입 참조 ~1,300+ 라인 (test/docs 제외).

### Hard Constraints

1. **60fps 유지**: canonical-native traversal이 render hot path에 추가 deep-traversal을 유발하지 않아야 한다.
2. **type-check 0 error**: 전환 중 타입 오류가 build를 막아서는 안 된다. Phase별 intermediate boundary alias 허용.
3. **test suite PASS**: 각 Phase gate마다 targeted Vitest PASS. 전체 suite 회귀 0.
4. **render parity 0**: Builder↔Preview 시각 결과 동일성 유지. Skia/CSS symmetric consumer 동일 결과.
5. **boundary 유지**: `exportLegacyDocument()`, `UPDATE_ELEMENTS` compat receive, cloud/export/import adapter는 Phase 6 이후에도 잔존 허용. production 0건 목표는 hot path consumer만 해당.

### Soft Constraints

- Phase별 점진 전환. 전체 consumer를 한 번에 변경하지 않는다.
- `Element` 타입은 Phase 6 이후 `@deprecated` JSDoc으로 마킹 후 boundary allowlist 파일로 이동. 타입 삭제는 이 ADR scope 밖 (별도 cleanup ADR).
- ADR-123/124/125 Implemented 이전에는 Phase 0만 수행한다.

## Alternatives Considered

### 대안 A: Element 타입을 파생 view로 영구 유지

- 설명: mutable source write-back은 ADR-122에서 이미 제거됐으므로, 나머지 `Element[]` 파생 view(`canonicalDocumentToElements` 결과)를 runtime에서 계속 읽게 한다. 새 consumer는 canonical-native를 선호하지만 기존 consumer는 강제 전환하지 않는다.
- 근거: 전환 비용이 매우 적고, 기존 consumer가 안정적으로 동작한다.
- 위험:
  - 기술: M — canonical-native model과 Element 파생 view가 계속 coexist → identity mismatch 위험 잠재.
  - 성능: H — `canonicalDocumentToElements()` projection이 render/selection hot path에서 반복 호출될 수 있다. ADR-122 target state 요건("render 직전 full projection 금지")이 지켜지지 않는 경우가 잔존.
  - 유지보수: H — ADR-116/122 SSOT 선언에도 불구하고 runtime model이 여전히 `Element[]` 중심 → 신규 기여자가 어느 path를 사용할지 혼란. canonical-only 판정 기준 부재.
  - 마이그레이션: M — 나중에 consumer별 전환이 다시 필요하다. 비용 후불.

### 대안 B: Element 타입 즉시 전수 제거

- 설명: ADR-126 landing과 동시에 `Element` 인터페이스 및 모든 파생 view를 삭제하고, 모든 consumer를 canonical-native로 전환한다.
- 근거: 최종 상태에 단번에 도달. 중간 상태 부재.
- 위험:
  - 기술: H — ADR-123/124/125 없이 consumer가 의존할 canonical-native model이 아직 없음. 순서 역전 시 build break.
  - 성능: M — 잘못 설계된 canonical-native selector가 render마다 deep traversal 수행 가능.
  - 유지보수: M — 완료 후 단순하지만 cutover 중 rollback이 어렵다.
  - 마이그레이션: H — ~1,300 라인을 동시 변경 → 단일 PR이 거대해지고 review/rollback이 사실상 불가능.

### 대안 C: consumer 별 점진 canonical-native 전환 + Element 타입 boundary allowlist 격리 (권장)

- 설명: ADR-123/124/125 Implemented 후, hot path consumer를 Phase별로 canonical-native로 전환한다. `Element` 타입은 boundary allowlist 파일(cloud/export/import adapter)로 격리하고 hot path에서 production 0건을 달성한다. 타입 삭제는 별도 cleanup ADR.
- 근거:
  - ADR-122 soft constraint 이행 순서(runtime source 제거 → derived view 축소 → boundary quarantine)와 정합.
  - Phase별 gate로 rollback 지점 확보.
  - 기존 boundary adapter(Supabase, export, import)는 건드리지 않으므로 cloud 호환성 위험 최소.
- 위험:
  - 기술: H — 소비자 전환 규모가 크고 ADR-123/124/125 prerequisite 준비가 필요하다.
  - 성능: M — canonical-native selector/resolver 설계에 따라 성능이 결정되지만 gate로 통제 가능.
  - 유지보수: H — Phase 기간 동안 Element + canonical-native 두 모델이 공존 → 일시적 복잡도 증가.
  - 마이그레이션: M — 점진이므로 Phase별 rollback 가능.

### 대안 D: canonical-native node alias로 Element 점진 deprecate (type alias 경로)

- 설명: `Element`를 `CanonicalElement` 같은 canonical-native type의 type alias로 선언하고, 내부 필드를 canonical model로 점진 miggate. `Element` 식별자 자체는 유지하되 그 shape를 canonical로 교체.
- 근거: consumer 코드 변경 최소화. import 이름 변경 불필요.
- 위험:
  - 기술: H — canonical model shape와 `Element` shape의 필드 불일치(`parent_id` vs tree 기반, `page_id`, `deleted` 등)가 커 type alias 1:1 매핑이 사실상 불가. wrapper shim 필요.
  - 성능: M — shim 레이어 오버헤드 잠재.
  - 유지보수: M — type alias와 실제 shape의 괴리가 커지면 타입 안전성 약화.
  - 마이그레이션: H — 외부에서 `Element`를 사용하는 boundary adapter가 canonical shape를 받으면 cloud/export 계약이 깨진다.

### Risk Threshold Check

| 대안 | 기술 | 성능 | 유지보수 | 마이그레이션 | HIGH+ 개수 |
| ---- | ---- | ---- | -------- | ------------ | :--------: |
| A    | M    | H    | H        | M            |     2      |
| B    | H    | M    | M        | H            |     2      |
| C    | H    | M    | H        | M            |     2      |
| D    | H    | M    | M        | H            |     2      |

루프 판정: 모든 대안에 HIGH가 2개 이상이다. 이 문제는 ADR-122 soft constraint가 예고한 것처럼 복잡도가 내재적이다. 따라서 HIGH 위험이 가장 적은 대안을 선택하는 대신 **위험 수용 근거**와 **Gate 제어**를 강화한다.

- **대안 A 기각**: 성능 H(projection 반복)와 유지보수 H(canonical-only 판정 기준 부재)가 ADR-116/122 SSOT 약속을 무력화한다.
- **대안 B 기각**: 기술 H(prerequisite 미완 시 순서 역전) + 마이그레이션 H(단일 거대 변경)은 rollback 불가 위험이 너무 크다.
- **대안 C 채택**: 세 대안 중 마이그레이션 위험이 M으로 가장 낮고, Phase gate로 기술/유지보수 HIGH를 분할 통제 가능. ADR-123/124/125 prerequisite를 gate로 묶어 순서 강제.
- **대안 D 기각**: 기술 H(shape 불일치로 type alias 불가) + 마이그레이션 H(cloud contract 파괴)가 boundary adapter를 위협한다.

## Decision

**대안 C: consumer 별 점진 canonical-native 전환 + Element 타입 boundary allowlist 격리**를 선택한다.

**위험 수용 근거**:

- 기술 H (소비자 전환 규모): ADR-123/124/125의 canonical-native model/resolver/store가 구축된 후에야 Phase 1 진입을 허용하는 Gate G0을 통해 순서를 강제한다. prerequisite 미완 시 이 ADR은 Phase 0에서 정지한다.
- 유지보수 H (두 모델 공존 기간): Phase 1~5 동안 `Element`는 점진 deprecate 상태로 마킹되며, 각 Phase gate에서 consumer 감소를 수치로 검증한다. 공존 기간의 상한을 base ADR들의 Implemented 이후 90일로 설정한다.

**base ADR prerequisite 본문 명시 위치**: Status 섹션 첫 문단 + Context §의존 ADR 체인 테이블.

> 구현 상세: [126-element-type-deprecate-breakdown.md](design/126-element-type-deprecate-breakdown.md)

## Risks

| ID  | 위험                                                                                       | 심각도 | 대응                                                                                         |
| --- | ------------------------------------------------------------------------------------------ | :----: | -------------------------------------------------------------------------------------------- |
| R1  | ADR-123/124/125 prerequisite 미완 상태에서 Phase 1 진입                                    |  HIGH  | G0 gate가 prerequisite status를 검증. 미완 시 Phase 0에서 hard stop                          |
| R2  | canonical-native selector가 render 매 frame마다 deep traversal 수행 → 60fps 하락           |  HIGH  | Phase 1 gate에서 selector 설계 검토 및 FPS 측정 필수. 문제 시 Phase 1 rollback               |
| R3  | 전환 중 Element + canonical-native 두 모델 공존으로 consumer 혼란                          |  HIGH  | Phase별 `@deprecated` JSDoc 마킹 + `eslint-plugin-deprecation` 경고로 신규 추가 차단         |
| R4  | boundary adapter(cloud/export/import)가 canonical-native shape를 받아 계약 파괴            |  MED   | boundary allowlist 파일 분리 (G4 gate). allowlist 외 `Element[]` 생성은 CI grep gate로 차단  |
| R5  | history/undo에서 Element diff 기반 logic이 canonical patch를 놓쳐 undo 회귀                |  MED   | Phase 4 gate에서 canonical history event contract 검증 + undo/redo targeted Vitest           |
| R6  | test suite의 `Element[]` fixture가 canonical-native 전환 후 silent inflation (0 test 통과) |  MED   | 각 Phase Vitest에서 expected vs actual count 비교. `canonicalElementsView.test.ts` 명시 포함 |

## Gates

| Gate                            | 시점         | 통과 조건                                                                                                                                                                                                                                                           | 실패 시 대안                                            |
| ------------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| G0: prerequisite lock           | Phase 0 종료 | ADR-123, ADR-124, ADR-125 모두 `Implemented`. inventory bucket 분류 완료 (derived view / store cache / hot path consumer / boundary)                                                                                                                                | Phase 1 진입 금지. prerequisite ADR 완결 후 재진입      |
| G1: canonical-native model 검증 | Phase 1 종료 | canonical-native node/path/alias model이 `Element` 없이 Skia/layout/Preview hot path를 커버. type-check 0 error                                                                                                                                                     | Phase 1 rollback, model 재설계                          |
| G2: hot path consumer 전환      | Phase 2 종료 | Skia/layout/Preview/Properties/LayerTree에서 `Element` 타입 import 0건 (boundary/test 제외). 60fps 실측 PASS. **deprecation lint gate**: `Element` 타입에 `@deprecated` 마킹 + `eslint-plugin-deprecation` 활성화 후 신규 production import 시 lint error 발생 검증 | consumer별 temporary read-only adapter로 격리 후 재시도 |
| G3: store cache 전환            | Phase 3 종료 | `elementsMap`/`childrenMap` store state에서 `Element` key/value 타입 참조 0건 또는 canonical-derived readonly snapshot으로 전환됨                                                                                                                                   | ADR-125 결과물과 재정렬                                 |
| G4: boundary allowlist 격리     | Phase 4 종료 | `exportLegacyDocument()` + `Element[]` 생성이 허용 경로(projectSync/cloud/export/import/publish) 외 production 0건. CI grep gate PASS                                                                                                                               | allowlist 보강 후 재시도                                |
| G5: derived view 제거           | Phase 5 종료 | `canonicalDocumentToElements()`, `useCanonicalElements()`, `useCanonicalSelectedElement()` 호출이 non-boundary production 0건                                                                                                                                       | derived view → canonical-native 재전환                  |
| G6: final verification          | Phase 6 종료 | type-check 0 error, targeted Vitest PASS, 60fps 실측 PASS, browser smoke (create/edit/delete/undo/redo/refresh) 회귀 0, `Element[]` production grep gate 기준치 이하                                                                                                | 실패 bucket을 residual 기록 후 phase 재실행             |

## Consequences

### Positive

- Builder runtime이 완전한 canonical-native model로 구동된다. ADR-116/122 SSOT 약속이 타입 레벨까지 닫힘.
- `Element` 파생 view의 반복 projection이 hot path에서 사라져 mutation/selection/render 경로가 단순화된다.
- 신규 기여자가 어느 model을 쓸지 선택할 필요가 없다. canonical-native 단일 경로.
- 향후 Supabase physical schema drop ADR이 이 ADR 완결 이후 범위를 좁혀 착수 가능해진다.

### Negative

- Phase 1~5 동안 Element + canonical-native 두 모델 공존 → 일시적 코드베이스 복잡도 증가.
- ADR-123/124/125 prerequisite 완결까지 이 ADR이 대기 상태로 유지된다 (Proposed lock).
- boundary adapter(cloud/export/import)는 `Element[]` 생성 경로를 계속 유지해야 하므로 boundary 내부 복잡도는 줄지 않는다.
- `Element` 타입 완전 삭제는 이 ADR scope 밖. 별도 cleanup ADR이 필요하다.

## 반복 패턴 선차단 체크리스트 (adr-writing.md §"반복 패턴 선차단" 4 항목 selfcheck)

- [x] **HIGH+ 위험 코드 경로 3곳 이상 구체 인용**: HIGH 2개 (R1 기술 / R2 유지보수). 코드 경로 인용 — `Element` 타입 grep ~1,300 line hit (production), `apps/builder/src/builder/stores/canonical/canonicalElementsView.ts:234` (`canonicalDocumentToElements` 정의) + `:352` (`useCanonicalElements`) + `:390` (`useCanonicalSelectedElement`) + `apps/builder/src/builder/stores/history/canonicalHistoryEvents.ts:227` (history undo result), `useCanonicalElements()` production 14 line hit (call site ~12), store cache `elementsMap`/`childrenMap` 전체. R3 (신규 `Element` 추가) → G2 deprecation lint gate (`@deprecated` + `eslint-plugin-deprecation`).
- [x] **Spec/Generator 확장 ADR 여부**: 본 ADR 은 type deprecate, Spec/Generator 확장 아님. N/A.
- [x] **BC 훼손 수식화**: 외부 cloud/export/import boundary 호환성 = 100% 유지 (`Element[]` 생성 경로 boundary allowlist 잔존). 내부 production consumer = 100% canonical-native 전환 (boundary 외 `Element` import 0건 lint gate). 사용자 영향: 0 (render parity / behavior 변경 없음, type-level deprecate 만).
- [x] **HIGH+ Phase 분리 가능 여부 검토**: HIGH 2 누적이지만 base 3 prerequisite (ADR-123/124/125) 분리로 위험 누적 시점 차단. Phase 0 (G0 prerequisite lock) → Phase 1 (canonical-native model 검증) → Phase 2-5 (consumer 별 점진 전환) 분할로 단일 phase HIGH 누적 회피. 별도 ADR 분리는 base 3개 (123/124/125) 가 이미 분리 완료. 본 ADR 자체 추가 분리는 응용 ADR 의 unity 깨짐.
