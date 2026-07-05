# tree_golden 독립 oracle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ADR-916 endgame kill criteria ②(독립 oracle 확보)를 닫는다 — Chrome 실측(브라우저 ground truth)을 native cargo golden 상수로 고정해 `tree.rs::compute_layout` 회귀를 Taffy 없이 잡는 독립 oracle을 `packages/composition-engine/tests/tree_golden.rs`에 확보한다.

**Architecture:** dualRunLive의 C-2b fixture N1~N5를 (1) 정적 HTML로 DOM 재구성 → Chrome MCP `getBoundingClientRect` 실측 → root-상대 정규화 → 사람 검토 → float 상수화, (2) 같은 fixture batch JSON을 `LayoutTree::build_tree_batch`에 먹여 `get_layouts_batch` 결과를 root-상대 정규화 후 상수와 대조. golden.rs의 `assert_bounds`/field 가드 패턴을 승계하되 트리 계약(`LayoutTree`)이라 별도 파일로 분리한다.

**Tech Stack:** Rust (composition-engine crate, native cargo test), serde JSON batch 계약, Chrome MCP(추출 1회성).

## Global Constraints

- 대조 tolerance: `TOL = 1.0` px (HC3 (a), golden.rs와 동일). Chrome 추출값은 **float 상수** — 정수 강제 반올림 금지.
- 좌표계: 모든 좌표는 **root-상대** (`x - rootX`, `y - rootY`). Chrome은 viewport 기준, Rust는 root/tree 기준 → root origin을 빼서 정규화.
- box model: `NodeLayout`은 **content-box** (tree.rs:181). C-2b fixture는 border/padding 미사용(width/height/gap/margin만) → 추출 HTML은 `box-sizing: border-box` + border/padding 0으로 content-box=border-box 일치 보장. `* { margin: 0; padding: 0; border: 0; box-sizing: border-box; }` 리셋 필수.
- fixture batch JSON은 `dualRunLive.test.ts`의 N1~N5 `PersistentBatchNode[]`와 **바이트 동일 계약** — 스키마 재작성 금지, 같은 style 키/값 사용(camelCase, `build_tree_batch` 소비).
- 각 EXPECTED 상수 옆에 **id/name 순서 주석**(`// [0] n1-row, [1] n1-c ...`) 필수 — 순서 drift 조기 검출.
- 변조→RED 실증은 **커밋 금지** — 실행 로그/상태 로그에만 남긴다.
- 커밋 메시지 말미: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
- git: `git push origin main` 직접만. web PR / branch 분기 금지.

---

## fixture batch 원본 (dualRunLive.test.ts N1~N5, 그대로 사용)

각 fixture는 post-order `PersistentBatchNode[]`. `build_tree_batch`가 소비하는 JSON은 `[{style, children}, ...]` 형태(elementId 제외). root는 배열 마지막.

### N1 flex-in-flex (root = 배열 index 4, "n1-root")

```
[0] n1-a   : {width:"30px", height:"20px"}                                    children:[]
[1] n1-b   : {width:"40px", height:"20px"}                                    children:[]
[2] n1-row : {display:"flex", flexDirection:"row", alignItems:"flex-start", width:"200px", height:"20px"}  children:[0,1]
[3] n1-c   : {width:"50px", height:"30px"}                                    children:[]
[4] n1-root: {display:"flex", flexDirection:"column", width:"200px", height:"auto"}  children:[2,3]
```

### N2 flex-in-grid (root = index 5, "n2-root")

```
[0] n2-a1    : {width:"40px", height:"15px"}   children:[]
[1] n2-a2    : {width:"40px", height:"25px"}   children:[]
[2] n2-cell-a: {display:"flex", flexDirection:"column", height:"auto"}  children:[0,1]
[3] n2-b1    : {width:"40px", height:"30px"}   children:[]
[4] n2-cell-b: {display:"flex", flexDirection:"column", height:"auto"}  children:[3]
[5] n2-root  : {display:"grid", gridTemplateColumns:["1fr","1fr"], width:"200px", height:"auto"}  children:[2,4]
```

### N3 grid-in-flex (root = index 4, "n3-root")

```
[0] n3-g1  : {height:"40px"}   children:[]
[1] n3-g2  : {height:"40px"}   children:[]
[2] n3-grid: {display:"grid", gridTemplateColumns:["1fr","1fr"], gridTemplateRows:["40px"], width:"200px", height:"40px"}  children:[0,1]
[3] n3-foot: {width:"60px", height:"20px"}   children:[]
[4] n3-root: {display:"flex", flexDirection:"column", width:"200px", height:"auto"}  children:[2,3]
```

### N4 gap flex column (root = index 3, "n4-root")

```
[0] n4-a   : {width:"100px", height:"30px"}   children:[]
[1] n4-b   : {width:"100px", height:"40px"}   children:[]
[2] n4-c   : {width:"100px", height:"20px"}   children:[]
[3] n4-root: {display:"flex", flexDirection:"column", rowGap:"8px", width:"200px", height:"auto"}  children:[0,1,2]
```

### N5 dimension 혼재 flex row (root = index 2, "n5-root")

```
[0] n5-fixed: {width:"50px", height:"20px"}   children:[]
[1] n5-auto : {width:"70px", height:"20px"}   children:[]
[2] n5-root : {display:"flex", flexDirection:"row", columnGap:"10px", alignItems:"flex-start", width:"200px", height:"20px"}  children:[0,1]
```

> compute_layout 호출: `compute_layout(root_handle, 200.0, -1.0)` (availableWidth=200, height:auto sentinel=-1). NESTED_SPACE와 동일.

---

## Task 1: tree_golden.rs 스캐폴딩 + RED (상수 미확정)

**Files:**

- Create: `packages/composition-engine/tests/tree_golden.rs`
- Test: (자기 자신 — cargo integration test)

**Interfaces:**

- Consumes: `composition_engine::tree::{LayoutTree, NodeStyle}` — `build_tree_batch(&str) -> Result<Vec<usize>, String>`, `compute_layout(root, w, h)`, `get_layouts_batch(&[usize]) -> Vec<f32>`, `get_layout(handle) -> NodeLayout`.
- Produces: `assert_tree_bounds(label, tree, handles, root_handle, expected)` 헬퍼 + 5 `#[test]` 함수 + 5 EXPECTED 상수(초기 `0.` placeholder — RED 유발용).

- [ ] **Step 1: 파일 헤더 + 헬퍼 + N1 테스트 골격 작성 (상수는 placeholder)**

파일 상단 모듈 doc:

```rust
//! ADR-916 endgame kill criteria ② — tree_golden 독립 oracle (native)
//!
//! Chrome 실측(브라우저 ground truth)을 상수로 고정해 tree.rs::compute_layout
//! 트리 배치의 회귀를 Taffy 없이 잡는다. golden.rs(단일 컨테이너 평면 계약)와
//! 달리 LayoutTree/compute_layout/get_layouts_batch 트리 계약을 대조한다.
//!
//! fixture 원본: dualRunLive.test.ts C-2b N1~N5 (실전 대표 중첩/혼합 8형상 중
//! 트리 5종). 좌표는 root-상대 정규화(Chrome=viewport 기준, Rust=tree 기준).
//! box model: NodeLayout=content-box, fixture 는 border/padding 미사용 →
//! 추출 HTML 리셋(margin/padding/border 0 + box-sizing:border-box)으로 일치.

use composition_engine::tree::{LayoutTree, NodeStyle};

/// HC3 (a) 수치 tolerance (px) — golden.rs TOL 과 동일.
const TOL: f32 = 1.0;
```

헬퍼:

```rust
/// batch JSON → 트리 빌드 → compute → root-상대 정규화 flat 반환.
/// handles 순서 = batch 배열 순서(post-order). root 는 handles 마지막.
fn layout_relative(batch_json: &str) -> (Vec<usize>, Vec<f32>) {
    let mut tree = LayoutTree::new();
    let handles = tree.build_tree_batch(batch_json).expect("batch build");
    let root = *handles.last().expect("root handle");
    tree.compute_layout(root, 200.0, -1.0);
    let flat = tree.get_layouts_batch(&handles);
    // root origin 추출(정규화용)
    let root_layout = tree.get_layout(root);
    let (rx, ry) = (root_layout.x, root_layout.y);
    let mut rel = flat.clone();
    let mut i = 0;
    while i < rel.len() {
        rel[i] -= rx; // x
        rel[i + 1] -= ry; // y
        i += 4;
    }
    (handles, rel)
}

/// root-상대 flat 을 4-tuple 단위로 EXPECTED 상수와 대조. |diff| ≤ TOL.
fn assert_tree_bounds(label: &str, actual: &[f32], expected: &[[f32; 4]]) {
    assert_eq!(
        actual.len(),
        expected.len() * 4,
        "{label}: 출력 길이 불일치 (got {} floats, want {} bounds)",
        actual.len(),
        expected.len()
    );
    for (i, want) in expected.iter().enumerate() {
        for (f, &w) in want.iter().enumerate() {
            let g = actual[i * 4 + f];
            let field = ["x", "y", "w", "h"][f];
            assert!(
                (g - w).abs() <= TOL,
                "{label}: node[{i}].{field} = {g} (want {w}, Δ={:.4} > {TOL}px)",
                g - w
            );
        }
    }
}
```

N1 상수 + 테스트(placeholder 상수 — RED 목적):

```rust
/// N1 flex-in-flex. 순서: [0] n1-a, [1] n1-b, [2] n1-row, [3] n1-c, [4] n1-root.
/// (Chrome 실측 미확정 — placeholder, Task 2 에서 실측값으로 교체)
const N1_EXPECTED: &[[f32; 4]] = &[
    [0., 0., 0., 0.], // [0] n1-a
    [0., 0., 0., 0.], // [1] n1-b
    [0., 0., 0., 0.], // [2] n1-row
    [0., 0., 0., 0.], // [3] n1-c
    [0., 0., 0., 0.], // [4] n1-root
];
const N1_BATCH: &str = r#"[
  {"style":{"width":"30px","height":"20px"},"children":[]},
  {"style":{"width":"40px","height":"20px"},"children":[]},
  {"style":{"display":"flex","flexDirection":"row","alignItems":"flex-start","width":"200px","height":"20px"},"children":[0,1]},
  {"style":{"width":"50px","height":"30px"},"children":[]},
  {"style":{"display":"flex","flexDirection":"column","width":"200px","height":"auto"},"children":[2,3]}
]"#;

#[test]
fn tree_golden_n1_flex_in_flex() {
    let (_h, rel) = layout_relative(N1_BATCH);
    assert_tree_bounds("N1 flex-in-flex", &rel, N1_EXPECTED);
}
```

같은 형식으로 N2~N5 batch/상수/테스트도 작성한다(batch JSON은 위 "fixture batch 원본" 표 그대로, 상수는 placeholder `0.`, 노드 순서 주석 필수).

- [ ] **Step 2: RED 확인**

Run: `cargo test --manifest-path packages/composition-engine/Cargo.toml tree_golden 2>&1 | tail -20`
Expected: FAIL — placeholder 상수(모두 0)와 실제 배치 산출(n1-a width=30 등)이 불일치 → `Δ > 1px` assert. (RED 이유 = 상수 미확정, 함수/계약은 정상.) 만약 `batch build` 또는 컴파일 에러면 계약 불일치이니 먼저 해소.

- [ ] **Step 3: field 가드 추가 + 컴파일 확인**

각 EXPECTED 길이가 fixture 노드 수와 일치하는지 정적 가드:

```rust
#[test]
fn tree_golden_field_contract_guard() {
    assert_eq!(N1_EXPECTED.len(), 5, "N1 노드 5");
    assert_eq!(N2_EXPECTED.len(), 6, "N2 노드 6");
    assert_eq!(N3_EXPECTED.len(), 5, "N3 노드 5");
    assert_eq!(N4_EXPECTED.len(), 4, "N4 노드 4");
    assert_eq!(N5_EXPECTED.len(), 3, "N5 노드 3");
}
```

Run: `cargo test --manifest-path packages/composition-engine/Cargo.toml tree_golden_field_contract_guard`
Expected: PASS(가드는 상수 길이만 검사 → placeholder 여도 통과).

- [ ] **Step 4: 커밋 (RED 스캐폴딩)**

```bash
git add packages/composition-engine/tests/tree_golden.rs
git commit -m "test(adr-916): tree_golden 스캐폴딩 (RED) — C-2b N1~N5 트리 계약 + placeholder 상수

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Chrome 실측 → 상수 확정 (GREEN)

**Files:**

- Modify: `packages/composition-engine/tests/tree_golden.rs` (placeholder 상수 → Chrome 실측값)
- 임시(스크래치패드, 비커밋): `<scratchpad>/tree_golden_fixtures.html`

**Interfaces:**

- Consumes: Task 1의 batch/테스트 골격.
- Produces: N1~N5 EXPECTED 상수 실측값(float).

- [ ] **Step 1: 추출용 정적 HTML 작성 (스크래치패드)**

`<scratchpad>/tree_golden_fixtures.html` — 5 fixture를 `<div>` 트리로 재구성. 리셋 CSS 필수. 각 노드에 `data-eid`. 예(N1):

```html
<!doctype html>
<html>
  <head>
    <style>
      * {
        margin: 0;
        padding: 0;
        border: 0;
        box-sizing: border-box;
      }
    </style>
  </head>
  <body>
    <div
      data-fixture="n1"
      data-eid="n1-root"
      style="display:flex;flex-direction:column;width:200px;height:auto;"
    >
      <div
        data-eid="n1-row"
        style="display:flex;flex-direction:row;align-items:flex-start;width:200px;height:20px;"
      >
        <div data-eid="n1-a" style="width:30px;height:20px;"></div>
        <div data-eid="n1-b" style="width:40px;height:20px;"></div>
      </div>
      <div data-eid="n1-c" style="width:50px;height:30px;"></div>
    </div>
    <!-- N2~N5 동일 방식 -->
  </body>
</html>
```

각 fixture root를 세로로 분리 배치(서로 간섭 없게 `<hr>` 또는 큰 margin은 리셋과 충돌하니 별도 wrapper `<div style="margin-bottom:100px">` 대신 각 fixture를 개별 섹션으로).

> 주의: N2/N3 grid 중첩 — grid root의 셀 좌표가 브라우저와 tree.rs에서 같은 원점을 쓰는지가 신뢰도 핵심. 추출 시 grid root의 rect를 origin으로 명확히 잡을 것.

- [ ] **Step 2: Chrome MCP로 실측 추출**

Chrome MCP navigate로 `file://<scratchpad>/tree_golden_fixtures.html` 로드 → javascript_tool:

```js
const groups = {};
for (const el of document.querySelectorAll("[data-eid]")) {
  const eid = el.getAttribute("data-eid");
  const fx = el.closest("[data-fixture]").getAttribute("data-fixture");
  (groups[fx] ??= []).push([eid, el.getBoundingClientRect()]);
}
// 각 fixture 별 root origin 빼서 root-상대 출력 (batch post-order 순서로 정렬)
const order = {
  n1: ["n1-a", "n1-b", "n1-row", "n1-c", "n1-root"],
  n2: ["n2-a1", "n2-a2", "n2-cell-a", "n2-b1", "n2-cell-b", "n2-root"],
  n3: ["n3-g1", "n3-g2", "n3-grid", "n3-foot", "n3-root"],
  n4: ["n4-a", "n4-b", "n4-c", "n4-root"],
  n5: ["n5-fixed", "n5-auto", "n5-root"],
};
const out = {};
for (const [fx, list] of Object.entries(groups)) {
  const map = Object.fromEntries(list);
  const rootEid = fx + "-root";
  const r = map[rootEid];
  out[fx] = order[fx].map((eid) => {
    const b = map[eid];
    return [
      +(b.x - r.x).toFixed(2),
      +(b.y - r.y).toFixed(2),
      +b.width.toFixed(2),
      +b.height.toFixed(2),
    ];
  });
}
JSON.stringify(out, null, 2);
```

- [ ] **Step 3: 사람 검토**

추출값을 표로 제시 → 사용자에게 "이 값이 브라우저 정본" 확인 요청. **사용자 confirm 전 상수화 금지.** (특히 N2/N3 grid 셀 좌표가 예상과 맞는지 육안 대조.)

- [ ] **Step 4: 상수화**

검토 통과값을 각 `Nx_EXPECTED` placeholder에 대입(float, 순서 주석 유지). 예:

```rust
const N1_EXPECTED: &[[f32; 4]] = &[
    [0., 0., 30., 20.],  // [0] n1-a
    [30., 0., 40., 20.], // [1] n1-b
    [0., 0., 200., 20.], // [2] n1-row
    [0., 20., 50., 30.], // [3] n1-c
    [0., 0., 200., 50.], // [4] n1-root
];
```

(위 값은 예시 — 실제는 Step 2 추출값.)

- [ ] **Step 5: GREEN 확인**

Run: `cargo test --manifest-path packages/composition-engine/Cargo.toml tree_golden 2>&1 | tail -20`
Expected: PASS — 5 tree_golden + field_contract_guard 전부. FAIL 시 어느 노드/필드가 갈리는지(tree.rs vs 브라우저) 보고 — 이는 자체 엔진의 실제 발산이므로 Taffy 대조(dualRunLive)와 교차 확인.

- [ ] **Step 6: 커밋 (GREEN)**

```bash
git add packages/composition-engine/tests/tree_golden.rs
git commit -m "test(adr-916): tree_golden Chrome 실측 상수 확정 (GREEN) — endgame criteria ② 독립 oracle

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: 검증 게이트 + 변조→RED 실증

**Files:** (코드 변경 없음 — 검증만)

- [ ] **Step 1: 전체 cargo test 무회귀**

Run: `cargo test --manifest-path packages/composition-engine/Cargo.toml 2>&1 | tail -15`
Expected: lib + golden 15 + tree_golden 5 + field_guard + doc-test 전부 PASS, ignored 0.

- [ ] **Step 2: clippy 0 (native + wasm32)**

Run:

```bash
cargo clippy --manifest-path packages/composition-engine/Cargo.toml --tests 2>&1 | tail -5
cargo clippy --manifest-path packages/composition-engine/Cargo.toml --target wasm32-unknown-unknown 2>&1 | tail -5
```

Expected: 둘 다 `warning` 0, `error` 0.

- [ ] **Step 3: 변조→RED 실증 (커밋 금지)**

N1_EXPECTED의 한 값을 일부러 틀리게(예: `[30.,0.,40.,20.]` → `[35.,0.,40.,20.]`) 편집 → `cargo test tree_golden_n1_flex_in_flex` 실행 → **FAIL 확인**(oracle이 5px 발산을 잡음). 실행 로그/상태 로그에 "변조 X → RED 확인, 되돌림" 기록. **즉시 되돌림.** git diff로 tree_golden.rs 무변경 확인:

```bash
git diff --stat packages/composition-engine/tests/tree_golden.rs
```

Expected: 출력 없음(변조가 남지 않음).

- [ ] **Step 4: 커밋 없음 (Task 3은 검증만)**

Task 3은 코드 산출이 없으므로 커밋하지 않는다. 상태 로그에 검증 결과(cargo/clippy/변조→RED) 기록.

---

## Task 4: 문서 반영 (criteria ② 충족 기록)

**Files:**

- Modify: `docs/adr/design/916-unified-rust-engine-breakdown.md` (§1-F kill criteria ② → ✅ 충족)
- Modify: `docs/adr/916-unified-rust-engine.md` (status log entry 추가)

**Interfaces:**

- Consumes: Task 1~3의 land 결과(tree_golden 5 PASS, 변조→RED 실증).
- Produces: kill criteria 충족 카운트 1/4 → 2/4 갱신.

- [ ] **Step 1: breakdown §1-F kill criteria 표 갱신**

② 행을 "미충족" → "✅ 충족 2026-07-06" 로. tree_golden 5 케이스 + Chrome 실측 상수 + 변조→RED 실증 명시. dualRunLive Taffy leg는 안전망으로 유지 명시. 충족 카운트 1/4 → 2/4.

- [ ] **Step 2: ADR 본문 status log entry 추가**

`## Context` 앞에 land entry:

- 착수 경위(사용자 "dualRunLive/independent oracle 안정화 먼저" 지시 → Chrome 실측 gentest 선택 → native golden 고정 선택)
- 실측 방법(C-2b fixture DOM 재구성 → getBoundingClientRect root-상대 → 사람 검토 → float 상수)
- 검증(cargo tree_golden 5 PASS + 무회귀 + clippy 0 + 변조→RED 실증)
- 범위 명확화(criteria ② 하나만, ①④ 미충족이라 Taffy 물리 삭제 여전히 보류, 현재 2/4)

- [ ] **Step 3: 커밋 + push**

```bash
git add docs/adr/design/916-unified-rust-engine-breakdown.md docs/adr/916-unified-rust-engine.md
git commit -m "docs(adr-916): endgame criteria ② 충족 — tree_golden 독립 oracle 확보 (1/4→2/4)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
git push origin main
```

---

## Self-Review 결과

- **Spec coverage**: 설계 A(추출 절차) → Task 2, 설계 B(대조 구조) → Task 1, 검증 게이트(cargo/clippy/변조→RED) → Task 3, 범위 명확화 → Task 4. 전 항목 태스크 매핑됨.
- **Placeholder scan**: Task 1의 `0.` 상수는 의도된 RED 유발 placeholder(Task 2에서 실측 교체) — 계획상 명시됨, 계획 자체의 placeholder 아님. batch JSON/헬퍼/검증 커맨드 모두 완전.
- **Type consistency**: `build_tree_batch(&str)->Result<Vec<usize>,String>` / `compute_layout(root,200.0,-1.0)` / `get_layouts_batch(&[usize])->Vec<f32>` / `get_layout(h)->NodeLayout` — tree.rs 실제 시그니처와 일치(grep 확인). `assert_tree_bounds`/`layout_relative`/`TOL` 이름 전 태스크 일관.
