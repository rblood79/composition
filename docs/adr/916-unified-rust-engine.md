# ADR-916: 자체 단일 Rust 엔진 통합

## Status

Proposed — 2026-07-03

## Context

**3-Domain 판정**: 본 ADR 은 D3(시각 스타일) consumer 인 Builder(Skia) 렌더 경로의 **내부 구현 계층** 재구축이다. D1(DOM/접근성) / D2(Props/API) 무관. D3 시각 정본 접점은 style resolution 이관(Phase 2-A) 시 **catalog SSOT** (`componentCatalog.ts` + `COMPONENT_RULES_TABLE`, ADR-912/913/914 cutover 완결 — 잔존 spec 은 Frame/Group/Slot 3개 영구 예외) 파생 스타일 값 보존 하나 — /cross-check 로 검증한다. catalog/Generator 확장 없음 (Generator emit 지원 질문 해당 없음).

composition Builder 렌더링 파이프라인은 JS 64,316줄(92%) + Rust 5,633줄(8%) 로 구성된다. Rust 는 외부 라이브러리 Taffy 를 래핑한 layout solve 에 국한되고, 나머지 전 단계(scene graph 동기화 / 스타일 해석 / DFS 오케스트레이션 / 렌더 커맨드 생성 / 텍스트 측정)가 JS main thread 에서 실행된다. 실측 병목 코드 경로:

- `apps/builder/src/builder/workspace/canvas/layout/engines/persistentTaffyTree.ts` (423줄) — dirty 검출을 노드당 JSON.stringify 문자열 비교로 수행
- `apps/builder/src/builder/workspace/canvas/layout/engines/fullTreeLayout.ts` (2,861줄) — 노드당 WASM 경계 ~5회 횡단 (createNode/updateStyle/setChildren/computeLayout/getLayout), 2-pass 보정 최악 3× solve
- `apps/builder/src/builder/workspace/canvas/skia/renderCommands.ts` (1,091줄) — 매 content 프레임 O(N) DFS + z-sort + boundsMap 재생성
- `apps/builder/src/builder/workspace/canvas/skia/buildSpecNodeData.ts` (1,786줄) — 노드당 조상 체인 탐색 O(N×D)
- `apps/builder/src/builder/workspace/canvas/skia/StoreRenderBridge.ts` (743줄) — detectChangedIds O(N) Map 순회
- 텍스트 측정 — 캐시 미스 시 다중 WASM 왕복 + Canvas2D/CanvasKit 이중 측정 경로

프레임 경로에서 WASM 경계를 5회 횡단한다 (스타일 직렬화 / Taffy solve / 레이아웃 역직렬화 / SpatialIndex 쿼리 / CanvasKit draw).

교체 대상 외부 라이브러리 래핑은 **Taffy 가 유일**하다 (serde / wasm-bindgen 은 플랫폼 인프라). **Skia(CanvasKit) 는 유지** — 픽셀 렌더링 엔진 교체는 본 ADR 범위 밖. 자체 구현 Rust 모듈(block_layout 625줄 / grid_layout 279줄 / spatial_index 393줄 / binary_protocol 1,347줄)이 이미 존재하며, Taffy 0.10 기반 신규 엔진(`packages/composition-layout`, 1,660줄)은 `USE_RUST_LAYOUT_ENGINE=false` 뒤에 비활성 상태다. Worker 인프라(`wasm-worker/` 672줄) 역시 `LAYOUT_WORKER=false` 로 비활성.

**Hard Constraints**:

1. Canvas 60fps @ 1000+ 노드 (CLAUDE.md 성능 기준) — 이관 각 단계에서 프레임타임 회귀 금지
2. 초기 번들 < 500KB — WASM lazy-load 경로 유지, 엔진 WASM 증가 gzip +300KB 이내
3. **BC 수식화**: 기존 프로젝트 문서 100% 가 layout 영향권 — dual-run diff ≤ 1px (f32 tolerance) 강제, 시각 diff 0 요구
4. D3 대칭: Builder(Skia) ↔ Preview(DOM+CSS) 시각 결과 동일 — /cross-check 전수 PASS
5. WASM 경계 횡단 프레임 경로 5회 → 2회 (통합 엔진 batch 호출 + CanvasKit draw)

**Soft Constraints**:

- Rust 유지보수 역량 — 코드 리뷰 가능 인력 제한 (버스팩터)
- CSS Flexbox/Grid spec 자체 구현의 검증 비용 — Taffy 가 축적한 WPT-파생 테스트 자산 상실 위험
- 대규모 코드 생성 도구 (Fable 5 등) 활용 시 생성 코드 검증 부담

## Alternatives Considered

### 대안 A: 현상 유지 + JS 측 점진 최적화

- 설명: Taffy 유지, JS 병목 지점만 개별 최적화 (JSON.stringify → 해시, memoization 확대)
- 근거: 최소 변경 원칙, 회귀 위험 0
- 위험:
  - 기술: L — 검증된 경로 유지
  - 성능: **H** — 노드당 ~5회 WASM 경계 횡단은 JS 최적화로 구조적으로 해소 불가
  - 유지보수: M — 이중 Rust crate (0.9/0.10) + 외부 라이브러리 버전 종속 지속
  - 마이그레이션: L — 변경 없음

### 대안 B: Taffy 유지 통합 (Quick Win 만)

- 설명: `USE_RUST_LAYOUT_ENGINE=true` + `LAYOUT_WORKER=true` 활성화로 종료. Taffy 0.10 단일화, 파이프라인은 JS 유지
- 근거: 인프라가 이미 구현되어 있음 (composition-layout 1,660줄 + wasm-worker 672줄) — 코드 변경 최소로 JSON dirty 검출 제거 + main thread 해방
- 위험:
  - 기술: L — flag 전환 + 기구현 코드
  - 성능: M — scene/commands/style/text 병목 잔존, 경계 횡단 5회 유지
  - 유지보수: M — Taffy 외부 종속 영구화 (버전 업그레이드마다 layout 결과 변동 리스크 반복 — 0.9→0.10 도 결과 차이 존재)
  - 마이그레이션: L — flag revert 가능

### 대안 C: 일괄 전면 재작성 (big-bang)

- 설명: 단일 composition-engine crate 를 한 번에 작성, 완성 시점에 일괄 전환
- 근거: Figma (C++ 자체 엔진 → WASM, JS 는 UI shell) 업계 전례 — 최종 아키텍처 형태 자체는 검증된 방향
- 위험:
  - 기술: **C** — CSS Flexbox/Grid spec 전체를 중간 검증 지점 없이 일괄 구현 (Taffy 가 수년 축적한 spec compliance 를 단일 사이클에 재구현)
  - 성능: L — 최종 형태는 개선
  - 유지보수: H — 거대 단일 diff, 리뷰 불가
  - 마이그레이션: **C** — 전환 실패 시 전면 롤백, 회귀 원인 국소화 불가

### 대안 D: 단계적 단일 엔진 통합 (Phase 0→1→2, 게이트 기반)

- 설명: Phase 0 (기존 인프라 flag 활성화 = 대안 B 내용 흡수) → Phase 1 (Taffy 제거 — flex.rs 자체 구현 + dual-run 게이트) → Phase 2 (파이프라인 5개 모듈 순차 이관, 모듈별 게이트). 각 단계 독립 검증 + fallback flag 유지
- 근거: Taffy 자체가 Chrome 실측 기반 gentest fixture 로 spec 준수를 검증 — 동일 방법론 포팅 가능. Yoga(Meta) 의 flexbox subset 구현이 spec 불일치 장기 부채가 된 전례 → full spec + Chrome 실측 fixture 방식 채택. Flutter Web CanvasKit renderer (엔진 WASM + CanvasKit draw 분리) 와 동일 구조
- 위험:
  - 기술: **H** — flex.rs 자체 구현. 단 dual-run + WPT-파생 fixture 로 구간별 검증
  - 성능: L — 각 Phase 벤치 게이트
  - 유지보수: M — 이관 기간 JS/Rust 이중 경로 공존
  - 마이그레이션: M — 모듈별 fallback flag, 단계별 롤백 가능

### Risk Threshold Check

| 대안 | 기술 | 성능 | 유지보수 | 마이그레이션 | HIGH+ 개수 |
| ---- | ---- | ---- | -------- | ------------ | :--------: |
| A    | L    | H    | M        | L            |     1      |
| B    | L    | M    | M        | L            |     0      |
| C    | C    | L    | H        | C            |  3 (C×2)   |
| D    | H    | L    | M        | M            |     1      |

루프 판정: C 에 CRITICAL 2건 → 근본적으로 다른 접근 필요 → 대안 D (단계적 + 게이트) 추가로 해소. D 의 잔존 HIGH 1건 (기술 — flex 자체 구현) 은 G2 dual-run 게이트로 관리하며 수용. B 는 HIGH 0 이지만 본 ADR 의 목표 (외부 라이브러리 래핑 제거 + 단일 엔진) 를 달성하지 못함.

## Decision

**대안 D: 단계적 단일 엔진 통합**을 선택한다.

선택 근거:

1. **위험 수용 근거**: 유일한 HIGH (flex.rs 자체 구현) 는 Taffy 와의 dual-run 비교 + Chrome 실측 fixture 로 이관 전 구간에서 검증된다. Taffy fallback flag 가 G2 통과까지 유지되므로 실패 시 손실은 신규 코드 폐기로 한정
2. Phase 0 은 이미 구현된 인프라의 flag 전환만으로 JSON dirty 검출 제거 + main thread 해방을 즉시 획득 — 후속 Phase 의 성능 기준선 측정 확보
3. 최종 상태 (JS ~15,000줄 UI 바인딩 + 단일 WASM batch API + CanvasKit draw) 는 Figma / Flutter Web 에서 검증된 아키텍처

기각 사유:

- **대안 A 기각**: 노드당 ~5회 WASM 경계 횡단은 JS 측 최적화로 구조적으로 해소 불가 — 성능 HIGH 잔존
- **대안 B 기각**: Taffy 외부 종속 영구화 — 본 ADR 의 문제 정의 (외부 라이브러리 래핑 제거) 자체를 미해결. 단, B 의 실행 내용은 D 의 Phase 0 으로 흡수됨
- **대안 C 기각**: CRITICAL 2건 (중간 검증 지점 없는 spec 전체 구현 + 전면 롤백 리스크). 동일 목적지를 D 가 게이트 기반으로 도달

> 구현 상세: [916-unified-rust-engine-breakdown.md](design/916-unified-rust-engine-breakdown.md)

## Risks

| ID  | 위험                                                                | 심각도 | 대응                                                                                         |
| --- | ------------------------------------------------------------------- | :----: | -------------------------------------------------------------------------------------------- |
| R1  | flex.rs 자체 구현의 CSS spec 결함 (Taffy WPT-파생 테스트 자산 상실) |  HIGH  | G2 dual-run diff + Chrome gentest 방식 fixture 포팅. 통과 전 Taffy fallback 유지             |
| R2  | 이관 기간 JS/Rust 이중 경로 drift (동일 로직 양측 수정 누락)        |  MED   | 모듈별 cutover 완료 시 JS 경로 즉시 삭제 (dormant 병행 금지)                                 |
| R3  | Rust 유지보수 버스팩터                                              |  MED   | 모듈 경계 = CSS spec 章 단위 유지, gentest fixture 가 회귀 안전망                            |
| R4  | 대규모 생성 코드 (Fable 5 활용) 검증 부담                           |  MED   | 모듈당 fixture-first: fixture 작성 → 생성 → dual-run — 생성 코드는 fixture 통과로만 수용     |
| R5  | WASM 번들 증가                                                      |  MED   | G4 사이즈 게이트 (gzip +300KB 이내), wasm-opt + 모듈 분리 로딩 대비                          |
| R6  | text.rs 이관이 Layout=Canvas2D=CSS 정합 원칙 파괴                   |  MED   | canvas-rendering.md §3 규칙 승계 — Paragraph 객체 캐싱 금지, 결과값만 LRU. /cross-check 필수 |
| R7  | Taffy 0.9→0.10 전환 (Phase 0-A) 자체의 layout 결과 변동             |  MED   | G1 회귀 fixture 전수 — flag 전환이라도 dual-run 검증                                         |

## Gates

| Gate | 시점                    | 통과 조건                                                               | 실패 시 대안                                       |
| ---- | ----------------------- | ----------------------------------------------------------------------- | -------------------------------------------------- |
| G1   | Phase 0 flag 전환 직후  | 회귀 fixture 전수 PASS + 1000노드 60fps 유지                            | flag revert (즉시 롤백)                            |
| G2   | Phase 1 flex.rs 완성 시 | dual-run diff ≤ 1px (전 fixture) + Chrome 실측 fixture PASS             | Taffy fallback 유지, flex.rs 반복 수정 (제거 보류) |
| G3   | Phase 2 각 모듈 cutover | /cross-check PASS + 1000노드 프레임타임 개선 실측 + type-check          | 해당 모듈 JS 경로 유지 (모듈 단위 보류)            |
| G4   | 각 Phase 빌드           | WASM gzip +300KB 이내                                                   | wasm-opt 재조정 / 모듈 분리 로딩                   |
| G5   | Phase 2 착수 전         | 사용자 scope confirm (5 모듈 분할 — M4 의무) + Phase 1 실측 기반 재판정 | Phase 2 를 후속 ADR 로 분리                        |

## Consequences

### Positive

- WASM 경계 횡단 프레임 경로 5회 → 2회 — 직렬화 / GC 압력 구조적 제거
- JSON.stringify dirty 검출 / O(N) 변경 감지 / O(N×D) 조상 탐색 → 해시 · bitfield · 1-pass 로 대체
- 외부 라이브러리(Taffy) 버전 종속 제거 — layout 동작이 자체 fixture 로 고정, 업그레이드 리스크 소멸
- JS 렌더 파이프라인 ~64K줄 → ~15K줄 (UI 바인딩) — canvas 모듈 인지 부하 감소
- 텍스트 측정 이중 경로 (Canvas2D / CanvasKit) 불일치 문제의 구조적 해소 기반

### Negative

- flex/grid/block spec 유지 책임이 composition 으로 이전 — CSS spec 갱신 추적 의무 발생
- 이관 기간 (Phase 1~2) fallback flag 분기 유지 비용
- Rust 코드량 5,633줄 → ~12,000줄+ 추정 — 리뷰 가능 인력 제약
- 회귀 fixture / dual-run 하네스 / 벤치 하네스 신규 구축 비용 (Phase 0 선행 투자)
