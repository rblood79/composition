# 자체 엔진 box-sizing 계약 정합 (specified = border-box) 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** composition-engine 이 specified size(width/height/min/max, px·percent)를 border-box 로 해석하게 정합하여 Button 등 padding 보유 요소의 Skia>CSS 발산을 해소한다.

**Architecture:** 변환은 tree.rs 의 specified intake(write_block_item / write_flex_item / 컨테이너 available·좌표) 단일 층에서 수행한다. block.rs / flex.rs / grid.rs 커널의 content 수학은 무변경. JS 는 주석 갱신 외 무변경 (Taffy border-box 계약 복원).

**Tech Stack:** Rust (packages/composition-engine), wasm-pack, Vitest/type-check 는 회귀 확인용.

**설계 문서:** `docs/superpowers/specs/2026-07-06-engine-border-box-contract-design.md`

## Global Constraints

- 커널 파일(block.rs / flex.rs / grid.rs) 수정 금지 — 변환은 tree.rs 에서만.
- specified size = border-box. AUTO / FIT_CONTENT 센티넬(-1/-2)과 측정(content) 경로는 무변경.
- available 음수 센티넬(indefinite, 예: `compute_layout(root, 300, -1)`)은 감산하지 않고 보존.
- git: main 직접 커밋 (`git push origin main`), web PR 금지. `.claude/stats/*` 커밋 제외.
- 커밋 말미: `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`
- 검증 체인 순서: cargo test → `pnpm wasm:build:engine` → `pnpm type-check` → live 검증. test PASS 단독으로 완료 선언 금지 (live behavior 필수).
- CSS 정합 기준값 (Button, catalog): 높이 xs=20 / sm=22 / md=30 / lg=42 / xl=54.

---

### Task 1: specified intake 변환 — write_block_item

**Files:**

- Modify: `packages/composition-engine/src/tree.rs` (write_block_item :1123~, 테스트 :1500~)

**Interfaces:**

- Produces: `fn spec_to_content(v: f32, pad_border: f32) -> f32` — Task 2/3 이 재사용.

- [ ] **Step 1: 기존 content-box 테스트를 border-box 기대값으로 flip (RED)**

`block_child_explicit_width_adds_padding` 테스트를 다음으로 교체:

```rust
    /// block 자식 명시 px width = border-box (전역 * { box-sizing: border-box } 계약).
    /// padding 은 명시 폭 안에 포함된다 — 가산 아님.
    #[test]
    fn block_child_explicit_width_is_border_box() {
        let mut tree = LayoutTree::new();
        // 자식 width 100px + padding 10 좌우(총 20) → border-box 그대로 100.
        let json = r#"[
            {"style":{"width":"100px","height":"30px","paddingLeft":"10px","paddingRight":"10px"},"children":[]},
            {"style":{"display":"block","width":"300px","height":"200px"},"children":[0]}
        ]"#;
        let handles = tree.build_tree_batch(json).unwrap();
        tree.compute_layout(handles[1], 300.0, 200.0);
        let c0 = tree.get_layout(handles[0]);
        assert_eq!(c0.width, 100.0, "specified width = border-box (padding 포함)");
    }

    /// Button md 재현: height 30(= lineHeight 20 + paddingY 4×2 + border 1×2) 명시 →
    /// border-box 그대로 30 (현행 결함: 40 으로 이중 가산).
    #[test]
    fn block_child_explicit_height_is_border_box_button_md() {
        let mut tree = LayoutTree::new();
        let json = r#"[
            {"style":{"width":"100px","height":"30px","paddingTop":"4px","paddingBottom":"4px","borderTop":"1px","borderBottom":"1px"},"children":[]},
            {"style":{"display":"block","width":"300px","height":"200px"},"children":[0]}
        ]"#;
        let handles = tree.build_tree_batch(json).unwrap();
        tree.compute_layout(handles[1], 300.0, 200.0);
        let c0 = tree.get_layout(handles[0]);
        assert_eq!(c0.height, 30.0, "Button md border-box height");
    }
```

- [ ] **Step 2: 실패 확인**

Run: `cargo test --manifest-path packages/composition-engine/Cargo.toml block_child_explicit`
Expected: FAIL — `c0.width` 120 (100 기대), `c0.height` 40 (30 기대)

- [ ] **Step 3: 헬퍼 + write_block_item 변환 구현 (GREEN)**

`axis_pad_border` 함수 아래에 헬퍼 추가:

```rust
/// specified size(border-box, 전역 `* { box-sizing: border-box }` 계약) →
/// 커널 content 입력. pad_border 감산, 0 하한 (pad_border 초과 시 content 0 =
/// border-box 가 pad_border 로 floor — CSS 동일).
#[inline]
fn spec_to_content(v: f32, pad_border: f32) -> f32 {
    (v - pad_border).max(0.0)
}
```

`write_block_item` 본문에서 pad_border 를 먼저 계산해 expl/min/max 감산 (기존 슬롯 기록부 교체):

```rust
    let pad_border_v = axis_pad_border(cstyle, ctx, false);
    let pad_border_h = axis_pad_border(cstyle, ctx, true);

    // specified size 는 border-box — 커널은 content 수학이므로 intake 에서 감산.
    // min/max 도 CSS box-sizing 적용 대상 (상수 shift 라 content 단계 clamp 와 등가).
    data[off] = display_code;
    data[off + 1] = expl_w.map(|v| spec_to_content(v, pad_border_h)).unwrap_or(-1.0);
    data[off + 2] = expl_h.map(|v| spec_to_content(v, pad_border_v)).unwrap_or(-1.0);
    data[off + 3] = resolve_dimension(cstyle.margin_top.as_deref(), ctx);
    data[off + 4] = resolve_dimension(cstyle.margin_right.as_deref(), ctx);
    data[off + 5] = resolve_dimension(cstyle.margin_bottom.as_deref(), ctx);
    data[off + 6] = resolve_dimension(cstyle.margin_left.as_deref(), ctx);
    data[off + 7] = 0.0; // bfc_flag — 단위 3-a 미판정(BFC 감지는 상단/후속 단위)
    data[off + 8] = pad_border_v;
    data[off + 9] = pad_border_h;
    data[off + 10] = resolve_dimension_opt(cstyle.min_width.as_deref(), ctx)
        .map(|v| spec_to_content(v, pad_border_h)).unwrap_or(-1.0);
    data[off + 11] = resolve_dimension_opt(cstyle.max_width.as_deref(), ctx)
        .map(|v| spec_to_content(v, pad_border_h)).unwrap_or(-1.0);
    data[off + 12] = resolve_dimension_opt(cstyle.min_height.as_deref(), ctx)
        .map(|v| spec_to_content(v, pad_border_v)).unwrap_or(-1.0);
    data[off + 13] = resolve_dimension_opt(cstyle.max_height.as_deref(), ctx)
        .map(|v| spec_to_content(v, pad_border_v)).unwrap_or(-1.0);
    data[off + 14] = cw; // content_w
    data[off + 15] = ch; // content_h
    data[off + 16] = 0.0; // vertical_align (0=baseline)
    data[off + 17] = 0.0; // baseline
    data[off + 18] = -1.0; // line_height AUTO
```

주의: `resolve_dimension_opt` 는 auto/fit-content 센티넬을 None 으로 걸러내므로 감산은 유효 양수 값에만 적용된다 (센티넬 -1/-2 오염 없음).

- [ ] **Step 4: 통과 확인 + 전체 회귀**

Run: `cargo test --manifest-path packages/composition-engine/Cargo.toml`
Expected: PASS 전체 (padding=0 기존 테스트 불변 — `block_two_children_vertical_stack`, `block_child_auto_width_stretches`, golden/tree_golden 포함)

- [ ] **Step 5: Commit**

```bash
git add packages/composition-engine/src/tree.rs
git commit -m "fix(engine): block specified size 를 border-box 로 해석 — intake 감산 (spec_to_content)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: specified intake 변환 — write_flex_item

**Files:**

- Modify: `packages/composition-engine/src/tree.rs` (write_flex_item :1069~, 테스트)

**Interfaces:**

- Consumes: Task 1 의 `spec_to_content`.

- [ ] **Step 1: flex padding≠0 테스트 신설 (RED)**

tree.rs 테스트 모듈 단위 2(flex) 구역에 추가:

```rust
    /// flex row 자식 명시 width = border-box — padding/border 가산 아님.
    #[test]
    fn flex_child_explicit_width_is_border_box() {
        let mut tree = LayoutTree::new();
        // 자식 width 100px + padding 좌우 10 + border 좌우 1 → border-box 그대로 100.
        let json = r#"[
            {"style":{"width":"100px","height":"30px","paddingLeft":"10px","paddingRight":"10px","borderLeft":"1px","borderRight":"1px"},"children":[]},
            {"style":{"display":"flex","width":"300px","height":"200px"},"children":[0]}
        ]"#;
        let handles = tree.build_tree_batch(json).unwrap();
        tree.compute_layout(handles[1], 300.0, 200.0);
        let c0 = tree.get_layout(handles[0]);
        assert_eq!(c0.width, 100.0, "flex main 축 specified = border-box");
    }

    /// flex column 자식 명시 width(cross 축) = border-box.
    #[test]
    fn flex_column_child_cross_width_is_border_box() {
        let mut tree = LayoutTree::new();
        let json = r#"[
            {"style":{"width":"100px","height":"30px","paddingLeft":"10px","paddingRight":"10px"},"children":[]},
            {"style":{"display":"flex","flexDirection":"column","width":"300px","height":"200px"},"children":[0]}
        ]"#;
        let handles = tree.build_tree_batch(json).unwrap();
        tree.compute_layout(handles[1], 300.0, 200.0);
        let c0 = tree.get_layout(handles[0]);
        assert_eq!(c0.width, 100.0, "flex cross 축 specified = border-box");
    }
```

- [ ] **Step 2: 실패 확인**

Run: `cargo test --manifest-path packages/composition-engine/Cargo.toml flex_child_explicit flex_column_child`
Expected: FAIL — width 122 / 120 (100 기대)

- [ ] **Step 3: write_flex_item 변환 구현 (GREEN)**

`write_flex_item` 에서 pad_border 를 먼저 계산하고 main/cross 축별 감산 (해당 구간 교체):

```rust
    let pad_border_main = axis_pad_border(cstyle, ctx, is_row);
    let pad_border_cross = axis_pad_border(cstyle, ctx, !is_row);

    // specified size 는 border-box — 논리축별 pad_border 감산 (min/max 동일).
    data[off] = -1.0; // flex_basis AUTO (basis:content/px 는 단위 3 이후)
    data[off + 1] = main_size.map(|v| spec_to_content(v, pad_border_main)).unwrap_or(-1.0);
    data[off + 2] = cross_size.map(|v| spec_to_content(v, pad_border_cross)).unwrap_or(-1.0);
    data[off + 3] = resolve_dimension(cstyle.margin_top.as_deref(), ctx);
    data[off + 4] = resolve_dimension(cstyle.margin_right.as_deref(), ctx);
    data[off + 5] = resolve_dimension(cstyle.margin_bottom.as_deref(), ctx);
    data[off + 6] = resolve_dimension(cstyle.margin_left.as_deref(), ctx);
    data[off + 7] = pad_border_main;
    data[off + 8] = pad_border_cross;
    data[off + 9] = resolve_dimension_opt(min_main_str(cstyle, is_row), ctx)
        .map(|v| spec_to_content(v, pad_border_main)).unwrap_or(-1.0);
    data[off + 10] = resolve_dimension_opt(max_main_str(cstyle, is_row), ctx)
        .map(|v| spec_to_content(v, pad_border_main)).unwrap_or(-1.0);
    data[off + 11] = resolve_dimension_opt(min_cross_str(cstyle, is_row), ctx)
        .map(|v| spec_to_content(v, pad_border_cross)).unwrap_or(-1.0);
    data[off + 12] = resolve_dimension_opt(max_cross_str(cstyle, is_row), ctx)
        .map(|v| spec_to_content(v, pad_border_cross)).unwrap_or(-1.0);
```

(슬롯 13~16 은 기존 그대로: content_main / content_cross / flex_grow / flex_shrink)

- [ ] **Step 4: 통과 확인 + 전체 회귀**

Run: `cargo test --manifest-path packages/composition-engine/Cargo.toml`
Expected: PASS 전체

- [ ] **Step 5: Commit**

```bash
git add packages/composition-engine/src/tree.rs
git commit -m "fix(engine): flex specified size 를 border-box 로 해석 — main/cross intake 감산

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: 컨테이너 own padding — 자식 available 감산 + 좌표 offset + percent ctx

> 같은 뿌리의 형제 결함 2건: (a) 컨테이너 explicit 크기가 자식 available 로 그대로 전달 (CSS 는 content box), (b) 자식 좌표가 부모 padding/border offset 없이 content 원점 (Taffy 는 border-box 원점 기준 offset 포함), (c) 자식 percent 해석 ctx 가 부모 available 기준 (CSS 는 부모 content box 기준).

**Files:**

- Modify: `packages/composition-engine/src/tree.rs` (solve_flex :530~, solve_block :629~, solve_grid :706~)

**Interfaces:**

- Produces: `fn pad_border_start(style: &NodeStyle, ctx: &CssValueContext, horizontal: bool) -> f32` — 좌표 offset 용 (padding+border 의 left/top 성분).

- [ ] **Step 1: 부모 padding 테스트 신설 (RED)**

```rust
    /// 부모 padding → 자식 available 은 content 폭, 자식 좌표는 padding 안쪽 원점.
    #[test]
    fn block_parent_padding_shrinks_child_avail_and_offsets_origin() {
        let mut tree = LayoutTree::new();
        // 부모 border-box 300 + padding 20 사방 → content 260.
        // auto 자식 stretch = 260, 좌표 (20, 20).
        let json = r#"[
            {"style":{"height":"30px"},"children":[]},
            {"style":{"display":"block","width":"300px","height":"200px","paddingTop":"20px","paddingRight":"20px","paddingBottom":"20px","paddingLeft":"20px"},"children":[0]}
        ]"#;
        let handles = tree.build_tree_batch(json).unwrap();
        tree.compute_layout(handles[1], 400.0, 400.0);
        let c0 = tree.get_layout(handles[0]);
        assert_eq!(c0.width, 260.0, "auto 자식 stretch = 부모 content 폭");
        assert_eq!(c0.x, 20.0, "부모 padding-left 안쪽 원점");
        assert_eq!(c0.y, 20.0, "부모 padding-top 안쪽 원점");
    }

    /// flex 부모 padding → 동일 (available 감산 + 원점 offset).
    #[test]
    fn flex_parent_padding_shrinks_avail_and_offsets_origin() {
        let mut tree = LayoutTree::new();
        let json = r#"[
            {"style":{"width":"50px","height":"30px"},"children":[]},
            {"style":{"display":"flex","width":"300px","height":"100px","paddingTop":"10px","paddingLeft":"10px","paddingRight":"10px","paddingBottom":"10px","justifyContent":"flex-end"},"children":[0]}
        ]"#;
        let handles = tree.build_tree_batch(json).unwrap();
        tree.compute_layout(handles[1], 400.0, 400.0);
        let c0 = tree.get_layout(handles[0]);
        // main avail = 300-20=280, flex-end → x = 10(offset) + 280-50 = 240.
        assert_eq!(c0.x, 240.0, "flex-end 위치가 content 폭 기준 + padding offset");
        assert_eq!(c0.y, 10.0, "padding-top offset");
    }

    /// grid 부모 padding → 1fr 트랙이 content 폭 기준, 셀 좌표 offset.
    #[test]
    fn grid_parent_padding_shrinks_tracks_and_offsets_cells() {
        let mut tree = LayoutTree::new();
        let json = r#"[
            {"style":{},"children":[]},
            {"style":{},"children":[]},
            {"style":{"display":"grid","width":"220px","height":"100px","gridTemplateColumns":["1fr","1fr"],"gridTemplateRows":["50px"],"paddingTop":"10px","paddingLeft":"10px","paddingRight":"10px","paddingBottom":"10px"},"children":[0,1]}
        ]"#;
        let handles = tree.build_tree_batch(json).unwrap();
        tree.compute_layout(handles[2], 400.0, 400.0);
        let c0 = tree.get_layout(handles[0]);
        let c1 = tree.get_layout(handles[1]);
        assert_eq!(c0.width, 100.0, "1fr = (220-20)/2");
        assert_eq!(c0.x, 10.0, "셀 x = padding-left offset");
        assert_eq!(c1.x, 110.0, "셀2 x = 10 + 100");
        assert_eq!(c0.y, 10.0, "셀 y = padding-top offset");
    }
```

- [ ] **Step 2: 실패 확인**

Run: `cargo test --manifest-path packages/composition-engine/Cargo.toml parent_padding grid_parent_padding`
Expected: FAIL — c0.width 300 (260 기대) / offset 0 (20 기대) 등

- [ ] **Step 3: 좌표 offset 헬퍼 추가**

`axis_pad_border` 아래에:

```rust
/// 좌표 offset 용 — padding+border 의 시작 성분 (horizontal → left, 아니면 top).
/// 자식 좌표는 부모 border-box 원점 기준이므로 content 원점으로 밀어야 한다
/// (Taffy layout location 과 동일 계약).
fn pad_border_start(style: &NodeStyle, ctx: &CssValueContext, horizontal: bool) -> f32 {
    let (p, b) = if horizontal {
        (style.padding_left.as_deref(), style.border_left.as_deref())
    } else {
        (style.padding_top.as_deref(), style.border_top.as_deref())
    };
    resolve_dimension(p, ctx) + resolve_dimension(b, ctx)
}
```

- [ ] **Step 4: solve_block 변환 (GREEN 1/3)**

solve_block 서두(:638-642)를 교체:

```rust
        let parent_ctx = self.ctx_for(avail_w);
        let style = self.get(handle).map(|n| n.style.clone()).unwrap_or_default();
        // 컨테이너 자신의 pad_border (% 는 부모 available 기준 — CSS containing block).
        let own_pb_h = axis_pad_border(&style, &parent_ctx, true);
        let own_pb_v = axis_pad_border(&style, &parent_ctx, false);
        let off_x = pad_border_start(&style, &parent_ctx, true);
        let off_y = pad_border_start(&style, &parent_ctx, false);

        // 자식 available = 컨테이너 content box. explicit(border-box) 이면 감산,
        // auto stretch 이면 상속 available(border-box) 에서 감산.
        // 음수 available 은 indefinite 센티넬 — 감산 없이 보존.
        let child_avail_w = if explicit_w > 0.0 {
            spec_to_content(explicit_w, own_pb_h)
        } else if avail_w >= 0.0 {
            (avail_w - own_pb_h).max(0.0)
        } else {
            avail_w
        };
        let child_avail_h = if explicit_h > 0.0 {
            spec_to_content(explicit_h, own_pb_v)
        } else if avail_h >= 0.0 {
            (avail_h - own_pb_v).max(0.0)
        } else {
            avail_h
        };
        // 자식 write / gap 해석 ctx 는 content 폭 기준 (자식 % 의 containing block).
        let ctx = self.ctx_for(child_avail_w);
```

자식 위치 반영 루프(:666-674)에서 bounding box 는 offset 전 값, 저장은 offset 후:

```rust
        for (i, &c) in children.iter().enumerate() {
            let off = i * 4;
            let (x, y, w, h) = (out[off], out[off + 1], out[off + 2], out[off + 3]);
            max_right = max_right.max(x + w);
            max_bottom = max_bottom.max(y + h);
            if let Some(n) = self.get_mut(c) {
                n.layout = NodeLayout { x: x + off_x, y: y + off_y, width: w, height: h };
            }
        }
```

(컨테이너 최종 크기 로직 :677-678 은 무변경 — explicit=border-box 그대로, auto=자식 bounding box=content 반환으로 부모 커널이 pad_border 가산.)

- [ ] **Step 5: solve_flex 동일 변환 (GREEN 2/3)**

solve_flex 의 `child_avail_w/h` (:556-557) 를 Step 4 와 동일 패턴으로 교체 (style 은 이미 :540 에서 clone 됨 — own_pb/off 계산은 `parent_ctx = self.ctx_for(avail_w)` 기준, 이후 `let ctx = self.ctx_for(child_avail_w)` 로 gap/write_flex_item ctx 대체). 자식 위치 반영 루프(:597-605)도 Step 4 와 동일하게 max 는 offset 전, 저장은 `x + off_x / y + off_y`.

- [ ] **Step 6: solve_grid 동일 변환 (GREEN 3/3)**

solve_grid 에서:

```rust
        let parent_ctx = self.ctx_for(avail_w);
        let own_pb_h = axis_pad_border(&style, &parent_ctx, true);
        let own_pb_v = axis_pad_border(&style, &parent_ctx, false);
        let off_x = pad_border_start(&style, &parent_ctx, true);
        let off_y = pad_border_start(&style, &parent_ctx, false);

        // 트랙 available = content box (explicit=border-box 감산 / 상속도 감산).
        let container_w = if explicit_w > 0.0 {
            spec_to_content(explicit_w, own_pb_h)
        } else if avail_w >= 0.0 {
            (avail_w - own_pb_h).max(0.0)
        } else {
            avail_w
        };
        let container_h = if explicit_h > 0.0 {
            spec_to_content(explicit_h, own_pb_v)
        } else if avail_h >= 0.0 {
            (avail_h - own_pb_v).max(0.0)
        } else {
            avail_h
        };
        let ctx_w = self.ctx_for(container_w);
```

- implicit auto row 자식 solve(:744)의 available 을 `container_w / container_h` 로 교체.
- 셀 반영 루프(:775-786): max 는 offset 전 좌표 기준, `n.layout` 저장 시 `x + off_x / y + off_y`, `solve_node(c, w, h)` 는 그대로 (셀 크기 available).
- 컨테이너 최종 크기(:789-790)는 무변경 (explicit=border-box / auto=셀 bounding box).

- [ ] **Step 7: 통과 확인 + 전체 회귀**

Run: `cargo test --manifest-path packages/composition-engine/Cargo.toml`
Expected: PASS 전체 (padding=0 기존 테스트·golden 불변)

- [ ] **Step 8: Commit**

```bash
git add packages/composition-engine/src/tree.rs
git commit -m "fix(engine): 컨테이너 padding 을 자식 available/좌표/percent ctx 에 반영 — content box 계약

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: percent border-box + 계약 주석 명문화 + padding≠0 golden

**Files:**

- Modify: `packages/composition-engine/src/tree.rs` (주석 + 테스트)
- Modify: `packages/composition-engine/tests/tree_golden.rs` (padding≠0 케이스 1건)

- [ ] **Step 1: percent+padding 테스트 신설 (RED — Task 1~3 반영 후에도 미커버 조합)**

```rust
    /// percent specified 도 border-box — 해석 후 pad_border 감산 경로 공유.
    #[test]
    fn block_child_percent_width_is_border_box() {
        let mut tree = LayoutTree::new();
        // 부모 content 400 (padding 0), 자식 width 50% + padding 10 좌우
        // → border-box = 200 (현행 결함: 220).
        let json = r#"[
            {"style":{"width":"50%","height":"30px","paddingLeft":"10px","paddingRight":"10px"},"children":[]},
            {"style":{"display":"block","width":"400px","height":"200px"},"children":[0]}
        ]"#;
        let handles = tree.build_tree_batch(json).unwrap();
        tree.compute_layout(handles[1], 400.0, 200.0);
        let c0 = tree.get_layout(handles[0]);
        assert_eq!(c0.width, 200.0, "50% of content 400 = border-box 200");
    }
```

Run: `cargo test --manifest-path packages/composition-engine/Cargo.toml percent_width_is_border_box`
Expected: **PASS 즉시 가능** — percent 는 resolve_dimension_opt 에서 px 로 해석된 뒤 Task 1 감산 경로를 타므로 이미 커버. 즉시 PASS 면 그대로 확증 테스트로 유지 (RED 불필요 — 계약 고정 목적). FAIL 이면 해석 지점 추적 후 수정.

- [ ] **Step 2: tree_golden.rs 에 padding≠0 케이스 추가**

기존 tree_golden 케이스(N1~N5)의 작성 형식을 그대로 따라, CSS border-box 산술로 손계산한 기대값 1건 추가 (파일의 기존 헬퍼/스타일 형식 확인 후 동일 형식 사용):

```rust
/// N6 (border-box 계약): padded flex row — CSS 산술 기대값.
/// 컨테이너 300×100 padding 10 → content 280×80.
/// 자식 A width 100(border-box, padding 8) / 자식 B auto(content 50 측정 대체 explicit 50).
/// 기대: A=(10,10,100,h), B=(110,10,50,h) — gap 0.
#[test]
fn n6_padded_flex_row_border_box() {
    // (tree_golden.rs 의 기존 build/assert 헬퍼 형식에 맞춰 작성 —
    //  스타일 JSON 은 위 tree.rs 단위 테스트와 동일 camelCase 키)
}
```

- [ ] **Step 3: 계약 주석 명문화**

- `resolve_self_size` doc 주석에 추가: `/// 반환값은 border-box (specified 그대로) — leaf 최종 layout 크기.`
- `solve_node` 의 증분 skip 주석(:489-492) 갱신: "저장된 layout.width/height 는 explicit 노드면 border-box, auto 노드면 content 크기 (부모 커널이 pad*border 를 가산해 border-box 도출). 부모 write*\*\_item 의 content 슬롯은 auto fallback 에서만 소비되므로 explicit 노드의 border-box 반환은 무해."
- `write_block_item` / `write_flex_item` doc 주석에 "specified size = border-box, intake 에서 spec_to_content 감산" 1줄.

- [ ] **Step 4: 전체 테스트 + Commit**

Run: `cargo test --manifest-path packages/composition-engine/Cargo.toml`
Expected: PASS 전체

```bash
git add packages/composition-engine/src/tree.rs packages/composition-engine/tests/tree_golden.rs
git commit -m "test(engine): percent border-box 확증 + padded golden N6 + box-sizing 계약 주석 명문화

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: wasm rebuild + JS 주석 갱신 + type-check

**Files:**

- Modify: `apps/builder/src/builder/workspace/canvas/layout/engines/utils.ts` (:4044-4048, :4688 근처 주석만)
- Regenerate: `apps/builder/src/builder/workspace/canvas/wasm-bindings/composition-engine-pkg/` (wasm-pack 산출물)

- [ ] **Step 1: utils.ts stale 주석 갱신 (코드 무변경)**

:4044-4048 을 다음으로 교체:

```typescript
// 항상 border-box 값을 주입:
// 웹 CSS의 * { box-sizing: border-box } 동작과 일치
// content 크기 + padding + border = border-box 크기
// composition-engine: specified size 를 border-box 로 해석 (tree.rs specified
// intake 에서 content 변환) → 변환 불필요. (구 Taffy 0.9 도 동일 계약이었음)
```

:4688 근처 applyCommonTaffyStyle 의 "Taffy 0.9는 style.size를 border-box로 처리" 주석도 동일 취지로 갱신 (해당 라인 실측 후 같은 형식).

- [ ] **Step 2: wasm rebuild + 산출물 신선도 확인**

```bash
pnpm wasm:build:engine
# stale binary 함정 (feedback-cargo-stale-binary-mtime): 산출물 mtime 이 지금인지 확인
ls -la apps/builder/src/builder/workspace/canvas/wasm-bindings/composition-engine-pkg/*.wasm
```

Expected: `.wasm` mtime = 현재 시각

- [ ] **Step 3: type-check + JS 회귀**

```bash
pnpm type-check
```

Expected: PASS (JS 코드 무변경 — 주석만)

- [ ] **Step 4: Commit**

```bash
git add apps/builder/src/builder/workspace/canvas/layout/engines/utils.ts apps/builder/src/builder/workspace/canvas/wasm-bindings/composition-engine-pkg
git commit -m "chore(engine): wasm rebuild (border-box 계약) + utils.ts 계약 주석 갱신

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: live 검증 + CHANGELOG + push

> test/type-check PASS 단독 종결 금지 — 실제 builder 에서 exercise (CLAUDE.md CRITICAL).

**Files:**

- Modify: `docs/CHANGELOG.md`

- [ ] **Step 1: dev 서버 재시작 후 live 검증**

Chrome MCP (또는 사용자 confirm)로:

1. Button 5개(size xs~xl) 추가 → **Preview DOM**: `getComputedStyle(button).height` = 20/22/30/42/54 확인.
2. **Skia**: 동일 Button 의 캔버스 렌더 높이가 Preview 와 육안/실측 일치 (이전 세션의 스크린샷 타임아웃 시 사용자 육안 confirm 으로 대체).
3. padding 보유 컨테이너 1건 (예: Card 또는 padding 20 준 Frame + 자식): 자식이 padding 안쪽에 배치되는지 (offset 수정 확인).
4. 패널에서 임의 요소에 명시 width 200px 설정 → Skia 와 Preview 폭 동일 확인 (user-explicit px 경로).
5. 검증용 임시 요소 전부 삭제 (사용자 문서 정리 의무).

- [ ] **Step 2: CHANGELOG 반영 (사용자-가시 버그 수정 트리거)**

`docs/CHANGELOG.md` 최상단에:

```markdown
## [자체 엔진 box-sizing 계약 정합 — specified size border-box] - 2026-07-06

### Bug Fixes

- **Button 등 padding 보유 요소가 Skia 에서 CSS 보다 크게 렌더** (ADR-916 후속):
  - 자체 Rust 엔진(composition-engine)이 specified width/height 를 content-box 로 해석 + padding/border 재가산 — enrich 가 주입하는 border-box 값과 이중 가산 (md Button: 높이 30→40, 폭 +26)
  - **Why**: 앱 세계 전체(Preview `* { box-sizing: border-box }`, store, Taffy 0.9 계약)는 border-box 인데 신규 엔진 커널만 CSS 기본값(content-box)으로 작성됨. dual-run fixture 가 전부 padding=0 이라 미검출
  - 수정: tree.rs specified intake 에서 border-box→content 변환 (커널 무변경). 부모 padding 의 자식 available 감산·좌표 offset·percent ctx 도 동일 뿌리로 함께 정합
  - 위치: `packages/composition-engine/src/tree.rs`
```

- [ ] **Step 3: 최종 커밋 + push**

```bash
git add docs/CHANGELOG.md
git commit -m "docs(changelog): 자체 엔진 border-box 계약 정합 — Skia>CSS 발산 수정 반영

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
git push origin main
```

- [ ] **Step 4: 완료 보고**

무엇을 실제 exercise 했는지 명시 (test 개수 나열 금지): Button xs~xl DOM/Skia 대조 결과, padded 컨테이너 offset 확인, user-explicit width 확인.

---

## Self-Review 결과

- Spec coverage: 설계 §4.2 표의 4 지점(write_block_item/flex/resolve_self_size/grid) 전부 Task 1~3 매핑. §6 검증 6항목 → Task 1~6 매핑. 설계에 없던 (b) 좌표 offset / (c) percent ctx 는 같은 뿌리 형제 결함으로 Task 3 에 명시 (design doc 대비 범위 추가 — 사용자에게 보고됨).
- Placeholder: Task 4 Step 2 의 N6 은 tree_golden.rs 기존 헬퍼 형식 실측 후 작성 (파일 형식 미확인 상태라 형식만 위임) — 값 산술은 완결 명시.
- Type consistency: `spec_to_content` / `pad_border_start` 시그니처 Task 1/3 정의와 Task 2/3 사용 일치.
