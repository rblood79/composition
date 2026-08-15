# ADR-183: 레이아웃 explain 디버그 채널 — 엔진 판정 트레이스

## Status

Proposed — 2026-08-15

## Context

레이아웃/렌더 결함의 진단 지배 비용은 **"엔진이 무엇을 했나" 역추적**이다. 최근 30일 fix 집계가 engine 34 · skia 33건이고, 공통 진단 경로는 `증상 → Chrome 실측 fixture → 엔진 값 대조 → 코드 역추적(어느 clamp/floor/stretch/캐시가 발화했나 추측 + printf + 재빌드 반복) → root cause`. 엔진은 판정 정보(used-size clamp 발화, §4.5 automatic minimum floor, stretch↔shrink-to-fit 갈래, 증분 skip HIT/MISS, 측정 캐시 세대)를 solve 시점에 전부 갖고 있으나 **기록 없이 소멸**시킨다. 그 결과 같은 오진이 반복되어 `.claude/rules/layout-engine.md` 에 "~로 진단 금지" 패턴이 문서 층으로만 축적됐다 (예: "새로고침하면 정상 = store 문제로 진단 금지" / "자라는 형제를 컴포넌트 결함으로 진단 금지" — 코드-사이트 주석 3곳은 `f5ec7bd0a` 로 선반영).

**외부 선례**: 브라우저 벤더가 정확히 이 채널을 제품화했다 — Chrome DevTools Layout 패널 / Firefox Flexbox·Grid Inspector 는 레이아웃 판정 근거를 노드 단위로 노출한다. x-algorithm(2026-08 공개) 의 Under the Hood 도 같은 구조 — 시스템 판정의 근거를 판정 대상 단위로 노출하는 투명성 계층.

**Domain**: D1/D2/D3 어디에도 속하지 않는 builder-system 디버그 계층 (ADR-163 과 같은 위상). 단 엔진(Rust)↔TS 경계에 걸치므로 `layout-engine.md` §"TS 잔존 계약" 정합이 필수 — 트레이스는 엔진 판정의 **기록**이지 TS 재계산이 아니다. Spec/Generator 확장 없음 (선차단 #2 해당 없음).

**Hard Constraints**:

1. **off 시 성능 회귀 ≤ 2%** — `benches/flex_shrink.rs`(`grow_nowrap_1000` 등 3종) + `benches/tree_solve.rs` 동일 머신 A/B 기준. 근거: `last_avail` 키 추가(2026-07-28) 때 +8% 가 "잘못 skip 되던 재계산의 정당 비용"으로 수용된 전례가 있으나, 트레이스 게이트는 **순수 오버헤드**라 그 예산이 없다
2. 60Hz floor / frame time p95 (CLAUDE.md 성능 기준) — 일반 경로(게이트 off)에서 사용자-체감 변화 0
3. **배치 프로토콜 계약 불변** — `build_tree_batch` / binary_protocol / `NodeStyle` 스키마 무변경. 트레이스는 별도 조회 API
4. TS 잔존 계약 준수 — 측정 oracle 은 TS(`enrichWithIntrinsicSize` 스칼라), 알고리즘·판정은 엔진. TS 층 공급값은 판독 헬퍼가 `[TS]` 로 병기할 뿐 엔진 트레이스에 섞지 않는다

**Soft Constraints**:

- 계측 지점이 엔진 전역에 흩어지므로 유지 부담 — 이벤트 목록은 오진 이력에서 역산한 최소 집합으로 freeze (Phase 0)
- 하위 호환 이슈 없음: canonical 스키마·저장 데이터 무변경, 사용자 영향 0% (선차단 #3 — BC 훼손 없음)

## Alternatives Considered

### 대안 A: hot path 상시 기록 (게이트 없음)

- 설명: 매 solve 에서 무조건 트레이스를 축적하고, 판독만 디버그 시 수행.
- 근거: 구현 최단순 (게이트 분기 자체가 없음).
- 위험:
  - 기술: L — 단순
  - 성능: **C** — solve 호출마다 Vec push + 문자열/enum 구성. 5k 요소 문서에서 편집당 solve 2회(1-pass + Step 4.5) × 노드 수의 상시 할당. HC1 위반 확정적
  - 유지보수: M — 이벤트 목록 유지
  - 마이그레이션: L — 끄면 됨 (그러나 끄는 순간 대안 C 가 됨)

### 대안 B: cargo feature 분리 빌드 (디버그 WASM 별도 아티팩트)

- 설명: `--features layout-trace` 로 계측 코드를 컴파일 타임 분리. 릴리스 WASM 은 계측 0, dev 는 디버그 WASM 로드.
- 근거: Rust 생태 표준 관례 (tracing crate 의 feature 게이트, Servo/Blink 의 디버그 빌드 분리).
- 위험:
  - 기술: M — WASM 로딩 분기 (init.ts 가 아티팩트 2종 선택) + pkg 산출물 2벌
  - 성능: L — 릴리스 경로 오버헤드 문자 그대로 0
  - 유지보수: **H** — 빌드 매트릭스 2배 (build:specs 류 파이프라인/CI/캐시), feature 조합 rot (계측 코드가 기본 빌드에서 컴파일되지 않아 조용히 깨짐), dev↔release 동작 이원화
  - 마이그레이션: M — 빌드 파이프라인 변경 되돌림 비용

### 대안 C: 런타임 게이트 + 노드별 트레이스 (선택)

- 설명: `LayoutTree` 에 `Option<TraceSink>` — enable 시에만 sink 할당·기록, off 시 판정 지점당 `Option` 분기 1회. WASM API 로 enable/조회. 라이브 빌더의 **현재 캐시 상태 그대로** 기록된다.
- 근거: Chrome DevTools 가 같은 형태 (릴리스 바이너리에 런타임 계측 게이트 내장 — 별도 브라우저 빌드를 요구하지 않는다). tracing crate 의 runtime subscriber 게이트와 동형.
- 위험:
  - 기술: M — 계측 지점 삽입이 엔진 4파일에 분산, 측정 패스(센티넬) 이벤트 오염 방지 필요
  - 성능: M — off 분기 비용은 branch-predictor 친화적이나 **측정 전 단정 불가** → G1 게이트
  - 유지보수: M — 이벤트 목록 최소화로 흡수
  - 마이그레이션: L — 게이트 삭제로 무흔적 제거 가능

### 대안 D: 사후 replay (문제 노드 서브트리를 트레이스 모드로 재-solve)

- 설명: 평상시 기록 0. 문제 발생 시 해당 서브트리를 트레이스 켜고 다시 solve 해 판정을 얻는다.
- 근거: rr/시간여행 디버깅 계열 관례 — 비용을 사후로 이연.
- 위험:
  - 기술: **H** — **증분 캐시 상태 의존 결함이 재현되지 않는다**. fresh re-solve 는 skip 게이트(`last_solved`/`last_avail`, tree.rs:968)·측정 캐시(`mutation_gen`)를 타지 않으므로, "새로고침하면 정상" 서명을 가진 캐시 계열 — 최근 재발 최다 축 (§증분 skip 2건, 측정 캐시 1건, 재부모화 1건) — 이 정확히 사각이 된다. explain 채널이 가장 필요한 결함군을 못 본다
  - 성능: L — 평상시 0
  - 유지보수: M — replay 진입로(상태 스냅샷) 유지
  - 마이그레이션: L

### Risk Threshold Check

| 대안 | 기술 | 성능 | 유지보수 | 마이그레이션 | HIGH+ 개수 |
| ---- | :--: | :--: | :------: | :----------: | :--------: |
| A    |  L   |  C   |    M     |      L       | 1 (C 포함) |
| B    |  M   |  L   |    H     |      M       |     1      |
| C    |  M   |  M   |    M     |      L       |     0      |
| D    |  H   |  L   |    M     |      L       |     1      |

루프 판정: HIGH 0 인 대안 C 존재 — 추가 대안 루프 불요.

## Decision

**대안 C: 런타임 게이트 + 노드별 트레이스**를 선택한다.

선택 근거:

1. **캐시 상태 커버가 채널의 존재 이유**: 오진 반복 최다 축(증분 skip/측정 캐시/재부모화)은 라이브 캐시 상태에서만 드러난다. 라이브 상태 그대로 기록하는 방식만 이 축을 본다 (D 의 구조적 사각)
2. 잔존 위험이 전부 측정·격리 가능: off-비용은 G1 벤치가 수치로 판정하고, 실패 시 대안 B 로 후퇴하는 경로가 열려 있다 (계측 지점 코드는 그대로 재사용 — feature attribute 만 씌우면 됨)
3. 단일 아티팩트 유지 — 빌드 파이프라인 무변경 (B 의 유지보수 HIGH 회피)

기각 사유:

- **대안 A 기각**: off 개념이 없어 HC1 위반 확정. 상시 할당은 5k 문서 편집 경로(205ms/편집 실측 병력)에 순수 가산
- **대안 B 기각**: 아티팩트 2벌의 유지보수 HIGH — dev 전용 채널을 위해 빌드 매트릭스를 상시 2배로 유지하는 교환이 성립하지 않음. 단 **G1 실패 시 후퇴처**로 보존
- **대안 D 기각**: 캐시 계열 결함 사각 (기술 HIGH). explain 이 가장 자주 쓰일 결함군이 정확히 재현 불가 영역

> 구현 상세: [183-layout-explain-channel-breakdown.md](design/183-layout-explain-channel-breakdown.md)

## Risks

| ID  | 위험                                                                                        | 심각도 | 대응                                                                                            |
| --- | ------------------------------------------------------------------------------------------- | :----: | ----------------------------------------------------------------------------------------------- |
| R1  | off 게이트 분기가 solve hot path 에 상주 — 누적 오버헤드가 측정 전 미지                     |  HIGH  | G1 벤치 게이트 (≤2%). 실패 시 대안 B(compile-time feature) 후퇴 — 계측 코드 재사용              |
| R2  | 이벤트 목록 유지 부담 — 엔진 수정 시 트레이스 항목 stale/누락으로 explain 이 거짓 안심 제공 |  MED   | Phase 0 에서 오진 이력 역산 최소 집합 freeze + 대표 판정 3종 스모크 테스트 (이벤트 부재 시 RED) |
| R3  | 트레이스 메모리 — 노드 수 × 이벤트 수 (WASM 힙)                                             |  MED   | enable 시에만 할당 + 노드당 이벤트 상한. off 시 0                                               |
| R4  | 트레이스를 정합 oracle 로 오인 — 엔진 자기 보고를 CSS 정답으로 읽는 오용                    |  LOW   | 판독 헬퍼 출력 첫 줄에 "oracle 은 Chrome parity" 명시                                           |
| R5  | 측정 패스(센티넬 available) 이벤트가 본 solve 판정과 섞여 판독 오도                         |  MED   | 측정 구간 이벤트 별도 태그/버킷 (breakdown Phase 1)                                             |

## Gates

| Gate | 시점         | 통과 조건                                                                                                     | 실패 시 대안                                     |
| ---- | ------------ | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| G1   | Phase 1 종료 | off 상태 A/B 벤치 (`flex_shrink.rs` 3종 + `tree_solve.rs`) 회귀 ≤ 2%                                          | compile-time feature 로 격하 (대안 B 후퇴)       |
| G2   | Phase 3 종료 | live builder 실노드 1개 `window.__layoutExplain` 실측 (완료 기준 live behavior 게이트)                        | 배선 결함 수리 전 Implemented 승격 금지          |
| G3   | Phase 3 종료 | `layout-engine.md` 오진 대표 3건 (캐시-새로고침 / 형제 성장 / 미결정 main) 이 트레이스 출력으로 판별됨을 확인 | 이벤트 목록 보강 (Phase 0 freeze 개정) 후 재확인 |

## Consequences

### Positive

- engine/skia fix (30일 67건 규모) 의 역추적 단계가 "추측 + printf + 재빌드" 에서 "트레이스 판독 1회" 로 단축 — `/fix` 파이프라인 root-cause 확정 가속
- `.claude/rules/layout-engine.md` 의 "진단 금지" 목록이 문서 방어에서 **실행 시점 판별**로 이동 — 규칙 미로드 세션/외부 도구도 같은 판별을 얻음
- fixture 작성 위치 선정이 역추적 완료 후 → 트레이스가 지목한 지점으로 앞당겨짐
- 향후 사용자용 "왜 이 크기인가" 패널 승격의 기반 (별도 ADR — 본 ADR 은 내부 채널까지)

### Negative

- 엔진 4파일 (tree.rs / flex.rs / grid 경로 / lib.rs) 에 계측 지점 상주 — 알고리즘 수정 시 트레이스 항목 동반 갱신 의무 (R2)
- off 분기 비용 ≤2% 를 상시 지불 (G1 통과 전제)
- WASM API 2종 + TS 판독 헬퍼의 표면 증가
