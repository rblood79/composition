# ADR-170: 엔진 기본 축 전수 정합 격자 — display×size Chrome 오라클 sweep

## Status

Proposed — 2026-07-28

## Context

composition-engine (ADR-916) 의 Chrome/CSS 발산은 **반응형 발견** 사이클로 해소되어 왔다: components 페이지 라이브 증상 → 역추적 → 좁은 parity fixture → 수정. 최근 30일 engine 34 + layout 19 fix 가 이 사이클의 산출이고, 각 수정은 Chrome 오라클 fixture (현재 parity 30파일 / 911 케이스) 로 잠기지만, **발견 자체가 증상 주도라 기본 축 (display × width/height) 의 잔여 발산 규모를 아무도 모른다** — 종결 조건이 없는 반복이다 (사용자 제기 2026-07-28: "step by step 접근은 끝없는 수정의 반복").

여기에 두 번째 축이 겹친다: components 페이지 공통 컴포넌트는 완성형이 아니라 **테스트 수준** (사용자 확인 2026-07-28, memory `project-components-page-origins-are-test-level`) 이라 라이브 증상이 오라클이 못 되고, 매 증상마다 엔진/데이터 귀속 판정 비용이 붙는다. 본 ADR 은 두 축 분리의 **1단계 (엔진 축)** 다 — 2단계 (공통 컴포넌트 완성형 재구축) 는 본 격자의 green 을 전제로 하는 후속 별도 ADR 로 분리한다.

방법의 실증은 이미 있다: `apps/builder/tests/parity/flexSweep.browser.test.ts` 의 1152 조합 격자가 flex 정렬 결함 3계열을 **일괄** 적발했다 (2026-07-27). 반면 그 사각도 실증됐다 — flexSweep 은 컨테이너 main 을 항상 확정으로 줘서 미결정 main 결함을 못 잡았고 (`crossAxisOverflow.browser.test.ts` 의 `INDEFINITE_MAIN_CASES` 가 유일 감시자), 이 사실이 "격자 green = 종결" 과신을 막는 설계 요건이 된다.

**SSOT 3-domain 판정**: 본 ADR 은 D3 (시각 스타일) 의 하부 기반인 **레이아웃 엔진↔Chrome 정합** 영역이다. catalog/spec/Generator 확장 없음, D1(DOM)/D2(Props) 무관. Skia 와 DOM 이 D3 의 대등 consumer 로 같은 시각 결과를 내려면 엔진 배치가 Chrome 과 정합해야 한다는 기존 정책 (memory `project-engine-css-parity-differential-oracle`, ADR-156/164/165/169 계보) 의 연장이다.

**Hard Constraints**:

1. **Chrome = differential oracle** — 격자 기대값은 손으로 쓰지 않고 DOM leg 실측 (`harness.ts` `domLeg`/`diffCase` 재사용). ADR-156 이후 확립된 정책.
2. **기존 회귀 0** — parity 911+ 케이스, cargo 유닛 (344), layout/canonical 유닛 (647) green 유지. 저장 스키마/BC 변경 0% (테스트 + 엔진 내부 수정만).
3. **실행 시간 상한** — 신규 격자 3파일 합산 로컬 단일 실행이 기존 parity 스위트 전체와 동급 (수 분대) 이내. flexSweep 1152 조합이 이미 수용된 규모 클래스.
4. **스위트 상시 green** — 격자 도입 시점의 발산은 known-divergence 스냅샷 (발산 수치 자체를 단언) 으로 잠근다. red 방치 금지 — 수정 wave 가 스냅샷을 parity 단언으로 교체해 가는 형태.

**Soft Constraints**:

- 후속 "공통 컴포넌트 완성형 재구축" ADR 이 본 격자의 green 을 착수 전제로 삼는다.
- 발산 판정 시 CSS 조문 (CSS-SIZING-3 / FLEXBOX-1 / GRID-1) 대조 병기 — Chrome quirk 를 스펙으로 오인 방지 (layout-engine.md 기존 관행).

## Alternatives Considered

### 대안 A: 현행 유지 — 라이브 증상 기반 반응형 수정

- 설명: components 페이지/사용자 보고 증상 → systematic-debugging → 좁은 fixture + 수정. 지난 수개월의 실제 운영 방식.
- 근거: 방식 자체는 검증됨 — 각 수정이 Chrome 실측 fixture 로 잠겨 재발은 없다.
- 위험:
  - 기술: LOW — 절차 확립됨
  - 성능: LOW
  - 유지보수: **HIGH** — 종결 조건 부재. 30일 53 fix 에도 수렴을 증명할 수 없고, 테스트 수준 공통 컴포넌트 위에서 증상 귀속 비용이 매회 발생. 본 ADR 의 동기 그 자체
  - 마이그레이션: LOW

### 대안 B: display×size 결정적 전수 격자 (flexSweep 확장 방식) — 선택

- 설명: 축 배열의 직교곱으로 케이스를 생성해 DOM leg 오라클로 일괄 대조. 발산은 수정 없이 인벤토리로 수집 → 군집화 → 군집별 수정 wave. 격자가 못 여는 축은 사각 목록으로 명시 문서화.
- 근거: 프로젝트 내부 실증 (flexSweep 1152 조합 → 정렬 결함 3계열 일괄 적발). 외부 동형 — Taffy 의 gentest (Chrome WebDriver 로 fixture 자동 생성) / Yoga 의 gentest (Chrome 렌더 기반 golden 생성): 주요 독립 레이아웃 엔진들이 브라우저 오라클 결정적 격자로 conformance 를 잠근다.
- 위험:
  - 기술: MED — 조합 폭발 관리 필요. flexSweep 이 축 분해 (교차축 576 + main 576) 로 이미 해결한 문제 유형
  - 성능: MED — 격자 실행 시간. HC3 상한 + 축 축소 우선 원칙으로 관리
  - 유지보수: LOW — 격자 자체가 영구 회귀 가드
  - 마이그레이션: LOW — 저장 스키마 무변경, 엔진 수정은 군집 단위 격리

### 대안 C: WPT (web-platform-tests) 이식

- 설명: W3C 표준 스위트의 css-flexbox / css-grid / css-sizing 부분을 엔진에 이식.
- 근거: 브라우저 벤더 공용 conformance 스위트 — 커버리지 권위가 가장 높다.
- 위험:
  - 기술: **HIGH** — WPT 는 ref-test/전체 DOM 전제. 엔진의 NodeStyle 부분집합으로의 어댑터가 큰 작업이고, 엔진 미지원 표면 (writing-mode, float, inline flow 등) 이 대량 포함되어 필터링 비용이 격자 작성 비용을 상회
  - 성능: MED — 스위트 규모
  - 유지보수: MED — upstream 추종 부담
  - 마이그레이션: **HIGH** — 기존 `diffCase` 좌표 대조 하니스와 형식 이질 (ref-test 는 시각 비교)

### 대안 D: property-based 무작위 생성 (fuzzing)

- 설명: 무작위 style 조합 생성 + Chrome diff.
- 근거: Taffy 등이 결정적 격자에 fuzz 를 보조로 병용.
- 위험:
  - 기술: MED — 생성기/축소기 (shrinker) 구현
  - 성능: MED
  - 유지보수: **HIGH** — 커버리지 설명력 부재. "어느 축이 닫혔나" 를 증명할 수 없어 본 ADR 의 목적 (종결 증명) 과 불일치. 무작위 케이스는 군집화·재현 비용도 높다
  - 마이그레이션: LOW

### Risk Threshold Check

| 대안 | 기술  | 성능 | 유지보수 | 마이그레이션 | HIGH+ 개수 |
| ---- | ----- | ---- | -------- | ------------ | :--------: |
| A    | L     | L    | **H**    | L            |     1      |
| B    | M     | M    | L        | L            |     0      |
| C    | **H** | M    | M        | **H**        |     2      |
| D    | M     | M    | **H**    | L            |     1      |

루프 판정: 대안 B 가 HIGH 0 — 추가 대안 루프 불요.

## Decision

**대안 B: display×size 결정적 전수 격자**를 선택한다.

선택 근거:

1. **잔존 위험 수용 가능** — 유일한 MED (조합 폭발/실행 시간) 는 flexSweep 이 같은 하니스에서 이미 해결한 문제 유형이고, HC3 상한 + 축 축소 우선 원칙으로 상계된다.
2. **종결 증명이 목적에 정합** — 결정적 격자만이 "이 축 목록은 닫혔다" 를 열거로 증명한다. 반응형 발견 (A) 과 fuzz (D) 는 종결 조건을 만들 수 없다.
3. **발견-수정 분리** 로 도입 위험 격리 — Phase 1 은 엔진 수정 0 (known-divergence 스냅샷으로 green 유지), 수정은 Phase 2 군집 단위 커밋 + 민감도로 격리.

기각 사유:

- **대안 A 기각**: 종결 조건 부재가 본 ADR 의 동기다. 유지 시 테스트 수준 공통 컴포넌트 위 귀속 판정 비용이 계속 발생.
- **대안 C 기각**: 어댑터 + 미지원 표면 필터링 비용이 자체 격자 작성 비용을 상회하고, 하니스 형식이 이질적 (마이그레이션 HIGH 2축).
- **대안 D 기각**: 커버리지 설명력 부재 — 종결 증명 목적과 구조적으로 불일치. 격자 완성 후 보조 수단으로의 재검토는 막지 않는다.

> 구현 상세: [170-engine-basic-axis-conformance-sweep-breakdown.md](design/170-engine-basic-axis-conformance-sweep-breakdown.md) (부분 격자 3종 축 표 / 기존 커버리지 맵 / 사각 목록 / Phase 0~3 / 파일 변경표)

## Risks

| ID  | 위험                                                                                                                                                                                                                                                                                                                    |  심각도  | 대응                                                                                                                                                       |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------: | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | 격자 green 이 "기본 축 종결" 로 과신될 위험 — 격자는 열거한 축만 증명한다. 실증: `flexSweep.browser.test.ts` 는 main 을 항상 확정으로 줘 미결정 main 센티넬 결함 (`tree.rs` `INDEFINITE_AVAIL` 소비 지점) 을 1152 조합 전부 green 으로 통과시켰고, `crossAxisOverflow.browser.test.ts` 의 별도 케이스가 유일 감시자였다 | **HIGH** | 사각 목록을 Phase 0 에 freeze (breakdown §4) 하고 layout-engine.md 에 이관 — "격자가 못 여는 축" 을 문서 정본으로 유지. G1 이 freeze 를 리뷰 게이트로 강제 |
| R2  | 발산 인벤토리가 예상보다 커서 수정 wave 비대 — 군집 수는 Phase 1 실측 전까지 미지                                                                                                                                                                                                                                       |   MED    | 군집당 커밋 1 + 민감도 명시 (phase 분할 원칙). 이연 판정 허용 (사유 필수 — 실사용 0건 등). wave 의 별도 ADR 분리는 하지 않는다 (결정 지점 아님)            |
| R3  | 격자 실행 시간이 상한 초과                                                                                                                                                                                                                                                                                              |   MED    | HC3 상한 계약 + 축 축소가 케이스 삭제보다 우선, 축소 내역은 사각 목록 편입 (침묵 축소 금지)                                                                |
| R4  | Chrome quirk 를 스펙으로 오인해 엔진을 잘못 정렬                                                                                                                                                                                                                                                                        |   LOW    | 군집 보고서에 CSS 조문 대조 병기 (기존 관행)                                                                                                               |
| R5  | known-divergence 스냅샷이 잔존 목록으로 굳어 수정 미착수 방치                                                                                                                                                                                                                                                           |   MED    | G3: 스냅샷 잔여 전건 "명시 이연 + 사유" 상태여야 종결 — 무사유 잔존 불허                                                                                   |

## Gates

| Gate        | 시점                | 통과 조건                                                                                                     | 실패 시 대안                                   |
| ----------- | ------------------- | ------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| G1 (↔R1)    | Phase 0 종료        | 축 배열 + 기존 커버리지 맵 + 사각 목록이 breakdown 에 freeze, 리뷰 통과                                       | 축 재설계 후 재리뷰 — Phase 1 진입 차단        |
| G2          | Phase 1 종료        | 격자 3파일 green (발산은 스냅샷 잠금) + 발산 군집화 보고 + 기존 parity/cargo/layout 회귀 0                    | 하니스/축 결함 수정 후 재실행                  |
| G3 (↔R2/R5) | Phase 2 종료        | 수정 군집 전건 민감도 확인 + 잔여 스냅샷 전건 명시 이연 사유 보유                                             | 무사유 잔존 군집 수정 재개 또는 이연 사유 보강 |
| G4          | Implemented 승격 전 | live 1회 exercise — 신규 빈 페이지에서 기본 축 편집 시나리오 (테스트 수준 공통 컴포넌트를 오라클로 쓰지 않음) | 발견 결함을 군집으로 편입 후 G3 재통과         |

## Consequences

### Positive

- 기본 축 (display × width/height) 발산이 **닫힌 목록**이 된다 — 반응형 발견 사이클이 기본 축에 한해 종료.
- 격자 3파일이 영구 회귀 가드로 남는다 (`apps/builder/tests/parity/basicAxis*.browser.test.ts`).
- 후속 "공통 컴포넌트 완성형 재구축" ADR 의 착수 전제가 성립 — 컴포넌트 재저작 시 우회 스타일 굽기 재발 차단.
- 사각 목록이 layout-engine.md 정본이 되어, 이후 발견되는 결함의 "격자 밖인가" 판정이 즉시 가능.

### Negative

- parity 스위트 실행 시간 증가 (~1,650 케이스 추가 — HC3 상한 내).
- known-divergence 스냅샷 유지 비용 — 이연 군집이 남는 한 스냅샷 수치가 엔진 변경마다 갱신 대상.
- 격자 사각 (텍스트 실측정 / absolute / 중첩 2단+ 등) 은 여전히 반응형 발견에 의존 — 본 ADR 이 제거하는 것은 "기본 축" 의 미지 규모이지 모든 미지가 아니다.
