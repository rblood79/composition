# ADR-916 tree golden 독립 oracle 확보 — Chrome 실측 gentest 설계

## 작성일

2026-07-06

## 배경 / 목적

ADR-916 (unified custom Rust layout engine, `packages/composition-engine` crate) 의 endgame (Taffy 완전 제거) kill criteria 4개 중 **② 독립 oracle 확보** 를 닫는 작업이다.

**왜 필요한가 — 순환 oracle 문제**:

- 현재 실전-트리 검증은 `apps/builder/src/builder/workspace/canvas/layout/engines/dualRunLive.test.ts` 뿐이다.
- 그런데 그 비교 기준 (oracle) 이 **제거 대상인 Taffy 자체** → 순환. Taffy 를 빼는 순간 실전 트리 회귀를 잡을 독립 기준이 사라진다.

**사용자가 선택한 경로**: **Chrome 실측 gentest** (ADR-916 breakdown 원안 §105) — 브라우저 렌더를 제3의 독립 권위 (ground truth) 로 삼는다. Taffy 도 아니고 자체 엔진도 아닌 외부 기준.

**고정 형태**: **native cargo golden 상수 고정** — Chrome 실측값을 사람 검토 후 `tests/tree_golden.rs` 상수로 박는다. CI 에서 브라우저 불필요.

## 설계 A: 추출 절차 (Chrome 실측 → 상수)

### 대상 fixture

`dualRunLive.test.ts` 의 C-2b 5 fixture N1~N5 (`PersistentBatchNode[]`):

| Fixture | 구성                                   | root      |
| ------- | -------------------------------------- | --------- |
| N1      | flex-in-flex (Card 헤더/바디)          | `n1-root` |
| N2      | flex-in-grid (그리드 셀 내 스택)       | `n2-root` |
| N3      | grid-in-flex (섹션 내 데이터 그리드)   | `n3-root` |
| N4      | gap flex column (rowGap 8)             | `n4-root` |
| N5      | dimension 혼재 flex row (columnGap 10) | `n5-root` |

### 절차

1. **DOM 재구성**: 각 fixture 의 node style 을 그대로 `<div>` 트리 인라인 CSS 로 변환 (스크래치패드 정적 HTML). 각 노드에 `data-eid="n1-row"` 를 부여하여 elementId 매핑을 보존한다. root 컨테이너는 fixture 의 `availableWidth=200` 으로 고정, height 는 auto 그대로.
2. **실측**: Chrome MCP 로 HTML 로드 → javascript_tool 로 각 `[data-eid]` 의 `getBoundingClientRect` 추출. 좌표는 **root 기준 상대** (`rect.x - rootX`, `rect.y - rootY`) 로 정규화한다. **Why**: fixture batch 가 root-local 좌표계인데, Chrome `getBoundingClientRect` 는 viewport/page 기준이므로 root origin 을 빼야 scroll/page 위치에 비민감해진다.
3. **box-sizing 명시 고정**: 추출 HTML 의 box-sizing/margin 기본값이 fixture batch 계약과 일치해야 tree.rs 대조가 가능하다 → 추출 시점에 명시적으로 고정한다.
4. **사람 검토**: 추출값을 표로 제시 → 사용자가 "브라우저 정본" 을 확인한다.
5. **상수화**: 검토를 통과한 값을 `tree_golden.rs` 상수로 박는다.

## 설계 B: golden 대조 구조 (native cargo test)

### 파일 분리

파일: `packages/composition-engine/tests/tree_golden.rs` (**신규**).

기존 `golden.rs` 와 분리하는 이유: `golden.rs` 는 단일 컨테이너 평면 f32 계약 (`flex_layout` / `grid_layout` / `block_layout` 직접 호출) 이고, 이번 작업은 `LayoutTree` / `compute_layout` / `get_layouts_batch` **트리 계약** 이다. 섞으면 oracle 의 의미가 흐려진다 → 별도 파일로 분리.

### 구조 (기존 `golden.rs::assert_bounds` 패턴 승계)

1. **입력**: 각 fixture 를 `LayoutTree` 로 빌드 — `create_node(NodeStyle)` × N + `set_children` + `compute_layout(root, 200, -1)`. dualRunLive 의 `PersistentBatchNode` batch 를 tree.rs `NodeStyle` 계약으로 옮긴다 (camelCase 스키마는 이미 정합).
2. **대조**: `get_layouts_batch` 의 flat `[x,y,w,h,...]` 를 root-상대 좌표로 정규화 (root x/y 를 빼서) → `N1_EXPECTED` 상수와 `assert_bounds` 대조. tolerance `TOL=1.0` px (HC3 (a)).
3. **Chrome 추출값은 float 상수 + TOL=1.0** — 정수 강제 반올림 금지 (사용자 보강). 예:

   ```rust
   const N1_EXPECTED: &[[f32; 4]] = &[[0., 0., 200., 20.], /* ... */];
   ```

4. **id/name 순서 주석**: `EXPECTED.len() == NODE_COUNT * 4` 정적 가드뿐 아니라, 각 상수 옆에 id/name 순서 주석 (예: `// [0] n1-row, [1] n1-c`) 을 남겨 순서 drift 를 빨리 잡는다 (사용자 보강).
5. **field 가드**: `golden.rs` 의 `golden_field_contract_guard` 패턴으로 상수 길이 정적 가드.

### 테스트 케이스 (5개)

`tree_golden_n1_flex_in_flex` ~ `tree_golden_n5_mixed_dimension`.

### TDD 순서

1. `tree_golden.rs` 먼저 작성 (추출 상수 미확정 → **RED**)
2. Chrome 실측으로 상수 채움
3. **GREEN**

## 검증 게이트

| Gate          | 통과 조건                                                                                                                                             |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| cargo test    | `cargo test --manifest-path packages/composition-engine/Cargo.toml` — tree_golden 5 케이스 신규 PASS + 기존 테스트 무회귀                             |
| clippy        | `cargo clippy --tests` 0 (native + wasm32)                                                                                                            |
| 변조→RED 실증 | 상수 1개를 일부러 변조 → RED 확인 (oracle 이 실제 회귀를 잡는지 증명) → 되돌림. **단 변조는 커밋 금지, 실행 로그/상태 로그에만 남긴다** (사용자 지시) |

## 범위 명확화 (중요)

이 작업은 endgame kill criteria **② 하나만** 닫는다.

- ① (안정화 기간) · ④ (Implemented 승격) 는 여전히 미충족 → endgame (Taffy 물리 삭제) 은 이 작업 후에도 **보류**.
- 이 세션은 **oracle 자산 확보** 이지 Taffy 제거가 아니다.
- `dualRunLive.test.ts` 의 Taffy leg 는 유지한다 (안전망).

## 관련 문서

- ADR-916 및 design breakdown (원안 §105 Chrome 실측 gentest 경로)
- `packages/composition-engine/tests/golden.rs` — 기존 단일 컨테이너 평면 golden (assert_bounds / field 가드 패턴 승계 원본)
- `apps/builder/src/builder/workspace/canvas/layout/engines/dualRunLive.test.ts` — C-2b fixture N1~N5 원본 + Taffy leg 안전망
