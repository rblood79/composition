# ADR-052: S2 Props API 정합성 마이그레이션

## Status

Implemented — 2026-04-05

## Context

React Aria Components는 low-level primitives로서 props가 과다하다 (컴포넌트당 평균 15~30개). Spectrum 2(S2)는 이를 통합·축소하여 개발자 경험을 개선했다. composition Spec의 Props 인터페이스와 프로퍼티 패널 fields는 현재 React Aria Components 기준으로 작성되어 있어, **S2 기준으로 네이밍과 기능 모두** 정렬이 필요하다.

변경 패턴은 3가지로 분류된다:

- **패턴 A — 이름만 변경**: 기능은 동일, S2 네이밍으로 통일
- **패턴 B — 기능 통합**: 여러 개별 props → 하나의 S2 prop으로 합침
- **패턴 C — 기능 변경**: S2에서 의미/타입이 바뀐 prop

별도 분리: TableView의 이벤트 모델 재설계(allowsSorting/allowsResizingColumns)는 단순 rename이 아니라 Column 레벨 이벤트 기반 구조 변경으로, 이 ADR 범위에서 제외한다.

**Hard Constraints**:

1. 변경 대상 prop을 참조하는 모든 코드 경로 동시 수정 필수 — spec, shared 컴포넌트, renderer, factory, preview, implicitStyles, canvas layout utils
2. 기존 Cloud 저장 데이터의 props 호환성 유지 (런타임 normalization 레이어 또는 마이그레이션 스크립트)
3. 타입 체크 (`pnpm type-check`) + 빌드 (`pnpm build`) 통과 필수
4. Dialog factory는 이미 `isDismissible`을 저장하나 spec/shared/renderer는 `isDismissable`을 읽음 — 기존 불일치 normalization 선행 필요

**Soft Constraints**:

- 프로퍼티 패널 field 변경은 사용자 혼란 최소화 필요
- Phase별 점진 적용 가능 (한 번에 전부 할 필요 없음)
- NumberField는 이미 `formatOptions`를 내부 지원 중 — 신규 개발이 아닌 이중 계약 정리

## Alternatives Considered

### 대안 A: 패턴별 Phase 점진 적용 (권장)

- 설명: 패턴 A(이름)→B(통합)→C(기능) 순서로 각 Phase 완료 후 검증. 각 Phase 내에서 전체 코드 경로(spec + shared + renderer + factory + preview + canvas layout) 일괄 변경.
- 근거: S2 마이그레이션 가이드 (adobe/react-spectrum) 권장 패턴. 패턴별로 변경 성격이 다르므로 독립 롤백 가능.
- 위험:
  - 기술: L — 각 Phase 내 변경이 동일 패턴 반복
  - 성능: L — props 수 감소로 오히려 개선
  - 유지보수: L — S2 공식 API 정렬로 장기 유지보수성 향상
  - 마이그레이션: M — Phase 2에서 기존 데이터의 개별 props→formatOptions 변환, Phase 3에서 타입 변경 시 기존 boolean 데이터 호환

### 대안 B: 전체 일괄 적용

- 설명: 모든 패턴을 한 번에 적용. worktree 격리.
- 근거: 단일 커밋. 중간 상태 없음.
- 위험:
  - 기술: M — 변경 범위가 넓어 충돌 가능성
  - 성능: L
  - 유지보수: L
  - 마이그레이션: H — 모든 데이터 변환 동시 처리, 롤백 시 전체 되돌림

### 대안 C: 현상 유지

- 설명: React Aria Components 기준 유지.
- 근거: 안정성 최우선.
- 위험:
  - 기술: L
  - 성능: L
  - 유지보수: H — S2 문서/예제와 composition Spec 간 괴리 증가
  - 마이그레이션: L

### Risk Threshold Check

| 대안 | 기술 | 성능 | 유지보수 | 마이그레이션 | HIGH+ 개수 |
| ---- | ---- | ---- | -------- | ------------ | :--------: |
| A    | L    | L    | L        | M            |     0      |
| B    | M    | L    | L        | H            |     1      |
| C    | L    | L    | H        | L            |     1      |

## Decision

**대안 A: 패턴별 Phase 점진 적용**을 선택한다.

선택 근거:

1. HIGH+ 위험 0건으로 가장 안전
2. 패턴별로 변경 성격이 다르므로 독립 배포·롤백 가능
3. Phase 1(이름)은 즉시 실행 가능, Phase 2~3은 별도 세션으로 분리 가능

기각 사유:

- **대안 B 기각**: 마이그레이션 HIGH 위험. 일괄 실패 시 전체 롤백 필요.
- **대안 C 기각**: 유지보수 HIGH 위험. S2 괴리가 지속 증가하여 장기 비용 발생.

범위 제외:

- **TableView allowsSorting/allowsResizingColumns**: 이벤트 모델 재설계(Column 레벨 + 핸들러 패턴)가 필요하여 별도 작업 단위로 분리. 현재 shared Table은 이미 `enableResize`/`enableResizing`을 Column 레벨로 구현 중이므로, Spec↔shared 정합성은 별도 ADR에서 다룬다.

> 구현 상세: [052-s2-props-api-breakdown.md](../design/052-s2-props-api-breakdown.md)

## Gates

| Gate         | 시점       | 통과 조건                                                                                                                                                              | 실패 시 대안                            |
| ------------ | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| Phase 1 완료 | 즉시       | type-check + build 통과. spec/shared/renderer/factory/preview 전체 경로에서 이름 변경 확인                                                                             | 개별 prop 롤백                          |
| Phase 2 완료 | Phase 1 후 | 개별 props 제거, formatOptions 단일 prop으로 통합. 기존 데이터 런타임 normalization 동작                                                                               | 런타임 fallback으로 개별 prop 지원 유지 |
| Phase 3 완료 | Phase 2 후 | Meter/PB: `showValue`→`showValueLabel` 리네이밍 + `valueLabel` 추가. Slider: `showValue` 제거(SliderOutput 항상 표시). autoCorrect enum 전환. 6개+ 참조 경로 동작 확인 | Phase 2까지만 유지                      |

## Consequences

### Positive

- Spec Props가 S2 공식 API와 네이밍·기능 모두 정렬 → 문서 참조 용이
- Meter/ProgressBar에 S2 `valueLabel` + `showValueLabel` 추가 → S2 API 완전 일치
- NumberField 이중 계약(개별 props + formatOptions) 정리 → 단일 소스
- 총 props 변동: Phase 1(-0) + Phase 2(-7) + Phase 3(Meter/PB: -1 showValue +2 valueLabel/showValueLabel = +1, Slider: -1 showValue, autoCorrect 타입만) = **순 -7 props**
- 새 S2 컴포넌트 추가 시 API 일관성 보장

### Negative

- Phase 1 이름 변경도 spec뿐 아니라 shared/renderer/factory/preview/canvas 전체 경로 변경 필요
- Phase 2 formatOptions 통합 시 기존 저장 데이터 런타임 normalization 레이어 필요
- Phase 3 Slider `showValue` 제거 시 기존 showValue=false 데이터는 값이 항상 보이게 됨 (S2 동작)
- Phase 3 Meter/PB `valueLabel: string`은 S2의 `ReactNode` 타입 축소 (빌더 제약)

### S2 Divergence (의도적 차이, 명시 기록)

| prop                    | S2 타입                    | composition 타입       | 사유                           |
| ----------------------- | -------------------------- | ---------------------- | ------------------------------ |
| Meter/PB `valueLabel`   | `ReactNode`                | `string`               | 빌더에서 JSX 입력 불가         |
| TextField `autoCorrect` | `string`                   | `"on" \| "off"`        | 유효 값만 허용하는 유니온 축소 |
| Slider 값 표시          | SliderOutput 자식 컴포넌트 | SliderOutput 자식 유무 | 동일 (Composition 패턴)        |
