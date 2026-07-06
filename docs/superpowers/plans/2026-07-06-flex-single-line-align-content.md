# flex.rs 단일 라인 align-content 무효화 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 단일 라인 flex 컨테이너가 align-content stretch 로 라인 cross 를 available_cross 까지 부풀려 컨테이너 height 가 폭발하는 버그(ToggleButtonGroup 397px)를 CSS §8.4 정합으로 근본 수정한다.

**Architecture:** `packages/composition-engine`(Rust→wasm, ADR-916 자체 엔진)의 `flex.rs`에서 두 얽힌 개념을 분리한다 — (A) align-content stretch(라인 부풀리기)는 다중 라인 전용으로 되돌리고, (B) 단일 라인 자식 stretch(align-items:stretch)는 `place_line_cross_axis`가 `available_cross`를 직접 참조해 처리. tree.rs는 변경 없음(컨테이너 크기는 자식 bounding box 로 이미 정확 도출).

**Tech Stack:** Rust, wasm-bindgen, wasm-pack (`pnpm wasm:build:engine`), cargo test.

## Global Constraints

- 응답·주석·커밋 메시지 한국어 (코드/기술 용어 영어 유지).
- 커밋 말미 `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- 수정(설계 2차 정정 반영): `flex.rs` `align_content_offsets`(STRETCH 다중 라인 전용) + `flex_layout` 시그니처(`cross_is_definite: bool` 추가) + 단일 라인 라인 cross 승격 + `flex_layout_single_line` 헬퍼(definite=true) + `tree.rs solve_flex` 호출부(definite 판정 전달). `place_line_cross_axis` 는 **시그니처/로직 무변경**.
- 기존 회귀 테스트 5종(`stretch_still_fills_when_cross_auto` / `align_stretch_fills_cross` / `align_center_cross` / `clamp_respects_max_cross` / `stretch_respects_explicit_cross_size`)은 **변경 없이 최종 통과 유지**가 성공 조건. (Task 2 단독 후 앞 4종 의도적 FAIL → Task 3 복구.)
- 다중 라인(line_count > 1) 경로는 기존 동작 그대로. `cross_is_definite` 는 단일 라인에서만 작동.
- 설계: `docs/superpowers/specs/2026-07-06-flex-single-line-align-content-design.md`.
- 상수: `ALIGN_CONTENT_STRETCH=0`, `ALIGN_CONTENT_START=1`, `ALIGN_STRETCH=0`(align-items), `ALIGN_CENTER`, `DIR_ROW=0`, `DIR_COLUMN=1`, `AUTO`(sentinel). `FLEX_FIELD_COUNT=17`, `OUT_FIELDS=4`. 테스트 헬퍼 `item(w,h)`(grow0/shrink1), `with_flex`, `flatten` 존재. `flex_layout_single_line` 진입점은 `align_content=STRETCH` 고정.

---

## File Structure

- `packages/composition-engine/src/flex.rs` — 수정 대상 (align_content_offsets, flex_layout 시그니처+라인 cross 승격, flex_layout_single_line 헬퍼, 테스트 모듈)
- `packages/composition-engine/src/tree.rs` — solve_flex 호출부 definite 전달 + 통합 테스트 추가

---

### Task 1: 단일 라인 stretch 회귀 테스트 (RED) — 라인 부풀리기 차단

**Files:**

- Test: `packages/composition-engine/src/flex.rs` (`#[cfg(test)] mod tests`, 기존 테스트 뒤에 추가)

**Interfaces:**

- Consumes: `flex_layout(data, avail_main, avail_cross, dir, justify, align_items, align_content, wrap, gap_main, gap_cross) -> Box<[f32]>`. out 레이아웃 `[x,y,w,h, ...]` per node. row 기준 height=`out[i*4+3]`, y=`out[i*4+1]`.
- Produces: 없음 (테스트).

- [ ] **Step 1: 실패 테스트 3종 작성**

`packages/composition-engine/src/flex.rs` 테스트 모듈 끝(`sentinel_main_still_grows_when_available_positive` 다음, 닫는 `}` 앞)에 추가:

```rust
// ── 단일 라인 align-content 무효화 (CSS §8.4) ──

#[test]
fn single_line_align_content_stretch_does_not_expand_line() {
    // row, 자식 1개 height 명시 30, available_cross 764(부모가 준 큰 값),
    // align_items=START(stretch 아님), align_content=stretch(default).
    // CSS §8.4: 단일 라인은 align-content stretch 무효 → 라인/자식 cross 30 유지(764 아님).
    let data = flatten(&[item(50.0, 30.0)]);
    let out = flex_layout(
        &data, 300.0, 764.0, DIR_ROW, JUSTIFY_START, ALIGN_START,
        ALIGN_CONTENT_STRETCH, WRAP_NOWRAP, 0.0, 0.0,
    );
    assert!((out[3] - 30.0).abs() < 0.01, "height={} (expect 30, not stretched)", out[3]);
    assert!((out[1] - 0.0).abs() < 0.01, "y={} (expect 0)", out[1]);
}

#[test]
fn single_line_align_content_center_does_not_offset() {
    // 단일 라인 + align_content=center → center offset 무효(자식 y=0).
    let data = flatten(&[item(50.0, 30.0)]);
    let out = flex_layout(
        &data, 300.0, 764.0, DIR_ROW, JUSTIFY_START, ALIGN_START,
        ALIGN_CONTENT_CENTER, WRAP_NOWRAP, 0.0, 0.0,
    );
    assert!((out[1] - 0.0).abs() < 0.01, "y={} (expect 0, center 무효)", out[1]);
    assert!((out[3] - 30.0).abs() < 0.01, "height={} (expect 30)", out[3]);
}

#[test]
fn single_line_align_items_center_child_stays_at_top() {
    // align_items=center + 자식 height 30 + available_cross 764.
    // 라인 cross = 자식 max = 30 이므로 라인 내 중앙 = 제자리(y=0). ToggleButtonGroup 실제 케이스.
    let data = flatten(&[item(50.0, 30.0)]);
    let out = flex_layout(
        &data, 300.0, 764.0, DIR_ROW, JUSTIFY_START, ALIGN_CENTER,
        ALIGN_CONTENT_STRETCH, WRAP_NOWRAP, 0.0, 0.0,
    );
    assert!((out[3] - 30.0).abs() < 0.01, "height={} (expect 30)", out[3]);
    assert!((out[1] - 0.0).abs() < 0.01, "y={} (expect 0, 라인 cross=30 이므로 제자리)", out[1]);
}
```

- [ ] **Step 2: 실패 확인**

Run: `cargo test -p composition-engine single_line_align 2>&1 | tail -20`
Expected: `single_line_align_content_stretch_does_not_expand_line` 과 `single_line_align_content_center_does_not_offset` FAIL (현재 height=764 또는 y≠0). `single_line_align_items_center_child_stays_at_top` 은 현재 라인이 764 로 부풀려져 자식이 (764-30)/2≈367 로 밀려 FAIL.

- [ ] **Step 3: 커밋 (RED)**

```bash
git add packages/composition-engine/src/flex.rs
git commit -m "$(printf 'test(engine): flex 단일 라인 align-content 무효화 RED 테스트\n\nCSS \xc2\xa78.4 — 단일 라인은 align-content(stretch/center) 무효.\n현재 stretch_extra 가 라인을 available_cross 로 부풀려 FAIL.\n\nCo-Authored-By: Claude Fable 5 <noreply@anthropic.com>')"
```

---

### Task 2: align_content_offsets — 단일 라인 stretch_extra 제거 (부분 GREEN)

**Files:**

- Modify: `packages/composition-engine/src/flex.rs:586-591` (`align_content_offsets` STRETCH 분기)
- Modify: `packages/composition-engine/src/flex.rs:544-545` (`flex_layout` 호출부 — 단일 라인 offset 강제 0)

**Interfaces:**

- Consumes: `align_content_offsets(align_content: u8, cross_free: f32, line_count: usize) -> (f32, f32, f32)` = (start_offset, between_extra, per_line_stretch).
- Produces: 단일 라인에서 (0,0,0) 반환하도록 STRETCH 분기 수정.

- [ ] **Step 1: STRETCH 분기에 line_count 가드**

`align_content_offsets`의 `ALIGN_CONTENT_STRETCH => { ... }` 블록(현재 line 587-591)을 교체:

```rust
        ALIGN_CONTENT_STRETCH => {
            if line_count <= 1 {
                // 단일 라인: align-content stretch 무효(CSS §8.4). 라인 부풀리기 없음.
                // 자식 stretch(align-items:stretch)는 place_line_cross_axis 가 available_cross 로 별도 처리.
                (0.0, 0.0, 0.0)
            } else {
                // 여유를 라인마다 균등 분배 (라인 cross 크기 증가)
                let per_line = cross_free / line_count as f32;
                (0.0, 0.0, per_line)
            }
        }
```

- [ ] **Step 2: flex_layout 호출부에 단일 라인 offset 가드**

`flex_layout` 본체의 `align_content_offsets` 호출부(현재 line 544-545)를 교체:

```rust
    let (mut cross_start_offset, mut cross_between_extra, stretch_extra) =
        align_content_offsets(align_content, cross_free, line_count);
    if line_count <= 1 {
        // 단일 라인은 align-content 정렬(center/end/space-*) offset 전체 무효(CSS §8.4).
        cross_start_offset = 0.0;
        cross_between_extra = 0.0;
    }
```

- [ ] **Step 3: 부분 검증 (align_items 미의존 테스트 통과)**

Run: `cargo test -p composition-engine single_line_align_content_stretch_does_not_expand_line single_line_align_content_center_does_not_offset single_line_align_items_center_child_stays_at_top 2>&1 | tail -20`
Expected: 3개 모두 PASS (자식 height 명시 30 이라 stretch 무관, 라인 부풀리기만 제거되면 통과).

- [ ] **Step 4: 기존 stretch 회귀 테스트 확인 — 여기서 깨짐 예상**

Run: `cargo test -p composition-engine stretch_still_fills_when_cross_auto align_stretch_fills_cross 2>&1 | tail -20`
Expected: **FAIL** — `stretch_still_fills_when_cross_auto`(자식 cross auto + align_items STRETCH → 100 기대)가 100→0 으로 깨진다. Task 3 에서 place_line_cross_axis 리팩터로 복구. (`stretch_respects_explicit_cross_size` 는 자식 cross 명시라 영향 없음 → PASS 유지.)

- [ ] **Step 5: 커밋**

```bash
git add packages/composition-engine/src/flex.rs
git commit -m "$(printf 'feat(engine): align_content stretch_extra 를 다중 라인 전용으로\n\n단일 라인 line_count<=1 시 stretch_extra/offset 0 — 라인 부풀리기 제거.\nalign-items stretch 자식 복구는 Task 3(place_line_cross_axis).\n\nCo-Authored-By: Claude Fable 5 <noreply@anthropic.com>')"
```

---

### Task 3: cross_is_definite 인자 도입 — 단일 라인 definite/indefinite 라인 cross 분리 (GREEN 완결)

> **설계 2차 전제 정정 반영**: Task 2 단독 후 `align_center_cross`/`clamp_respects_max_cross`/`stretch_still_fills_when_cross_auto`/`align_stretch_fills_cross` 4개가 FAIL 상태(모든 align-items 정렬이 부풀려진 라인 cross 에 의존했기 때문). 이 Task 가 `cross_is_definite` 로 복구. Task 2/3 는 짝 — Task 2 단독의 FAIL 은 의도된 중간 상태.

**Files:**

- Modify: `packages/composition-engine/src/flex.rs` `flex_layout` 시그니처(pub fn, 현재 486-497 부근) — `cross_is_definite: bool` 인자 추가
- Modify: `packages/composition-engine/src/flex.rs` `flex_layout` 라인 루프(현재 548-572 부근) — 단일 라인+definite 시 `this_line_cross` 를 available_cross 로 승격
- Modify: `packages/composition-engine/src/flex.rs` `flex_layout_single_line` 헬퍼(현재 713-740 부근) — `flex_layout` 호출에 `true` 전달
- Modify: `packages/composition-engine/src/tree.rs` `solve_flex` 의 `flex::flex_layout(...)` 호출(현재 606-617 부근) — definite 판정 전달

**Interfaces:**

- Consumes: `flex_layout(data, avail_main, avail_cross, dir, justify, align_items, align_content, wrap, gap_main, gap_cross)` (현 시그니처).
- Produces: `flex_layout(..., cross_is_definite: bool)` — 마지막 인자 추가. `place_line_cross_axis` 는 **시그니처 무변경**(라인 cross 를 이미 인자로 받음).

- [ ] **Step 1: flex_layout 시그니처에 cross_is_definite 추가**

`pub fn flex_layout(...)` 시그니처의 마지막 파라미터 `gap_cross: f32,` 다음에 추가:

```rust
    gap_cross: f32,
    cross_is_definite: bool,
) -> Box<[f32]> {
```

(`#[allow(clippy::too_many_arguments)]` 이 이미 붙어 있어 인자 추가 무경고.)

- [ ] **Step 2: 단일 라인 + definite 시 라인 cross 를 available_cross 로 승격**

`flex_layout` 라인 루프(현재 `for (li, line) in resolved_lines.iter().enumerate()` 블록)에서 `this_line_cross` 계산 직후, `place_line_main_axis` 호출 전에 승격 로직 삽입. 기존:

```rust
    for (li, line) in resolved_lines.iter().enumerate() {
        let mut this_line_cross = line_cross_sizes[li];
        if stretch_extra > 0.0 {
            this_line_cross += stretch_extra;
        }
```

교체:

```rust
    for (li, line) in resolved_lines.iter().enumerate() {
        let mut this_line_cross = line_cross_sizes[li];
        if stretch_extra > 0.0 {
            this_line_cross += stretch_extra;
        }
        // 단일 라인 + definite: 라인 cross = 컨테이너 cross(available_cross).
        // align-items(center/end/stretch/clamp)가 이 공간 안에서 정렬/채움 (CSS: 단일 라인
        //   flex 컨테이너의 라인 cross = 컨테이너 cross). indefinite(height auto)면 자식 max
        //   유지 → 컨테이너가 content 로 축소(ToggleButtonGroup height 30, 397 아님).
        if line_count == 1 && cross_is_definite {
            this_line_cross = this_line_cross.max(available_cross);
        }
```

`place_line_cross_axis` 호출부는 **변경 없음**(기존 `this_line_cross` 인자를 그대로 전달 — 이제 definite 면 available_cross 값).

- [ ] **Step 3: flex_layout_single_line 헬퍼에 definite=true 전달**

`flex_layout_single_line` 이 내부에서 `flex_layout(...)` 을 호출하는 부분(현재 `ALIGN_CONTENT_STRETCH,` `WRAP_NOWRAP,` `gap_main,` `0.0,` 로 끝나는 호출)의 마지막 인자 `0.0,` 다음에 `true` 추가:

```rust
    flex_layout(
        data,
        available_main,
        available_cross,
        direction,
        justify_content,
        align_items,
        ALIGN_CONTENT_STRETCH,
        WRAP_NOWRAP,
        gap_main,
        0.0,
        true, // cross_is_definite — 헬퍼는 available_cross 를 컨테이너 크기로 가정(기존 시맨틱)
    )
```

- [ ] **Step 4: tree.rs solve_flex 호출부에 definite 판정 전달**

`tree.rs` `solve_flex` 의 `let out = flex::flex_layout(...)` 호출(마지막 인자 `gap_cross,`) 다음에 추가:

```rust
        let out = flex::flex_layout(
            &data,
            avail_main,
            avail_cross,
            direction,
            justify,
            align_items,
            align_content,
            wrap,
            gap_main,
            gap_cross,
            if is_row { explicit_h > 0.0 } else { explicit_w > 0.0 },
        );
```

`is_row` 는 `solve_flex` 에 이미 있는 지역변수(`let is_row = direction == flex::DIR_ROW;`). cross=row 면 height, column 면 width 명시 여부가 definite. **부모 stretch 상속(2차 definite)은 이번 범위 밖** — 자기 cross 명시만 판정(설계 §후속 이슈 R3).

- [ ] **Step 5: Task 1 테스트 3개의 flex_layout 호출에 cross_is_definite 인자 추가**

Task 1 이 추가한 3개 테스트(`single_line_align_content_stretch_does_not_expand_line`, `single_line_align_content_center_does_not_offset`, `single_line_align_items_center_child_stays_at_top`)는 `flex_layout` 직접 호출이라 마지막 인자가 빠져 컴파일 에러가 난다. 세 호출 모두 마지막 인자로 `false` 추가(indefinite — available_cross 764 는 부모 공간이고 컨테이너 height auto 시뮬레이션이므로):

```rust
    // 각 테스트의 flex_layout(...) 호출 끝을 다음처럼:
    //   ..., ALIGN_CONTENT_STRETCH, WRAP_NOWRAP, 0.0, 0.0, false,
    // (single_line_align_content_center_does_not_offset 는 ALIGN_CONTENT_CENTER 로 시작)
```

세 테스트의 기대값(자식 height 30, y=0)은 indefinite 경로에서 그대로 성립(라인 cross=자식 30, 부풀리기 없음).

- [ ] **Step 6: 전체 flex 테스트 통과 확인 (GREEN)**

Run: `cargo test -p composition-engine --lib 2>&1 | tail -30`
Expected: Task 1 신규 3개(indefinite, false 인자) + 기존 회귀 5종(`stretch_still_fills_when_cross_auto`=100 복구, `align_stretch_fills_cross`=100, `align_center_cross`=y40 복구, `clamp_respects_max_cross`=30 복구, `stretch_respects_explicit_cross_size`=30) 포함 전체 PASS. **실패 0** 이 게이트. (`flex_layout_single_line` 헬퍼 경유 기존 테스트는 definite=true 라 available_cross 기준 유지.)

- [ ] **Step 7: 커밋**

```bash
git add packages/composition-engine/src/flex.rs packages/composition-engine/src/tree.rs
git commit -m "$(printf 'feat(engine): flex cross_is_definite 도입 — 단일 라인 라인 cross 이중성 분리\n\ndefinite(cross 명시)면 단일 라인 라인 cross=available_cross(align-items 채움/정렬),\nindefinite(auto)면 자식 max(제자리). ToggleButtonGroup(indefinite) height 30 /\nalign_center_cross(definite) y40 둘 다 CSS 정합. place_line_cross_axis 무변경.\ntree.rs 가 explicit_h/w>0.0 판정 전달. flex_layout_single_line=definite.\nTask 2 후 FAIL 하던 회귀 5종 복구.\n\nCo-Authored-By: Claude Fable 5 <noreply@anthropic.com>')"
```

---

### Task 4: 다중 라인 회귀 방지 테스트 (RED→GREEN 즉시)

**Files:**

- Test: `packages/composition-engine/src/flex.rs` (테스트 모듈)

**Interfaces:**

- Consumes: `flex_layout(...)`.
- Produces: 없음.

- [ ] **Step 1: 다중 라인 + definite 명시 테스트 2개 추가**

Task 1 테스트 뒤에 추가. `flex_layout` 직접 호출은 이제 마지막 인자로 `cross_is_definite` 필요:

```rust
#[test]
fn multi_line_align_content_stretch_still_expands() {
    // WRAP + available_main 작아 2라인 강제. available_cross 200, 라인당 자식 height 20.
    // 다중 라인 align-content stretch → 라인들이 cross_free 를 나눠 팽창(단일 라인 무효와 대비).
    let data = flatten(&[item(80.0, 20.0), item(80.0, 20.0)]);
    let out = flex_layout(
        &data, 100.0, 200.0, DIR_ROW, JUSTIFY_START, ALIGN_START,
        ALIGN_CONTENT_STRETCH, WRAP_WRAP, 0.0, 0.0, true,
    );
    // 2라인: item0 y=0, item1 은 첫 라인이 stretch_extra 로 팽창해 20 보다 큰 y 로 밀림.
    assert!((out[1] - 0.0).abs() < 0.01, "item0 y={} (라인0 시작)", out[1]);
    assert!(out[5] > 20.0 + 0.01, "item1 y={} (라인1 — 라인0 stretch 로 20 초과)", out[5]);
}

#[test]
fn single_line_definite_align_items_center_uses_available_cross() {
    // definite(cross_is_definite=true) + align_items=center + available_cross 100 + 자식 20
    //   → 자식 y=40 ((100-20)/2). definite 면 라인 cross=available_cross 로 중앙정렬.
    // indefinite 였다면 라인 cross=자식 20 → y=0 (single_line_indefinite_* 테스트가 대비).
    let data = flatten(&[item(50.0, 20.0)]);
    let out = flex_layout(
        &data, 300.0, 100.0, DIR_ROW, JUSTIFY_START, ALIGN_CENTER,
        ALIGN_CONTENT_STRETCH, WRAP_NOWRAP, 0.0, 0.0, true,
    );
    assert!((out[1] - 40.0).abs() < 0.01, "y={} (expect 40, definite 중앙정렬)", out[1]);
}
```

- [ ] **Step 2: 통과 확인**

Run: `cargo test -p composition-engine multi_line_align_content_stretch_still_expands single_line_definite_align_items_center_uses_available_cross 2>&1 | tail -10`
Expected: 둘 다 PASS (Task 3 이 다중 라인 stretch_extra 보존 + definite 라인 cross 승격).

- [ ] **Step 3: 커밋**

```bash
git add packages/composition-engine/src/flex.rs
git commit -m "$(printf 'test(engine): 다중 라인 stretch 유지 + definite 단일 라인 중앙정렬 회귀 방지\n\n다중 라인 stretch_extra 보존 + definite 단일 라인이 available_cross 로\n중앙정렬(y40)함을 고정. indefinite(y0)와 대비.\n\nCo-Authored-By: Claude Fable 5 <noreply@anthropic.com>')"
```

---

### Task 5: tree.rs 통합 테스트 — column 부모 단일 라인 자식 height 무폭발

**Files:**

- Test: `packages/composition-engine/src/tree.rs` (`#[cfg(test)] mod tests`)

**Interfaces:**

- Consumes: `LayoutTree::new()`, `build_tree_batch(&str) -> Result<Vec<usize>, String>`(post-order flat `[{style, children:[idx]}]`, camelCase, 크기 문자열 `"30px"`), `compute_layout(root, w, h)`, `get(handle) -> Option<&Node>` with `.layout.{x,y,width,height}`.
- Produces: 없음.

- [ ] **Step 1: 통합 테스트 추가**

`tree.rs` 테스트 모듈 끝(`build_parse_error` 다음, 닫는 `}` 앞)에 추가:

```rust
    #[test]
    fn flex_column_parent_single_line_child_no_height_explosion() {
        // body(flex column, height 764) > group(flex row, alignItems center, height 미지정)
        //   > 버튼(width 60, height 30).
        // 버그: group 이 align-content stretch 로 764 근처까지 팽창(ToggleButtonGroup 397).
        // 기대: group height = 자식 30.
        let mut tree = LayoutTree::new();
        // post-order: [버튼(0), group(1, children[0]), body(2, children[1])]
        let json = r#"[
            {"style":{"width":"60px","height":"30px"},"children":[]},
            {"style":{"display":"flex","flexDirection":"row","alignItems":"center"},"children":[0]},
            {"style":{"display":"flex","flexDirection":"column","height":"764px"},"children":[1]}
        ]"#;
        let handles = tree.build_tree_batch(json).unwrap();
        let body = handles[2];
        let group = handles[1];
        tree.compute_layout(body, 1200.0, 764.0);
        let gh = tree.get(group).unwrap().layout.height;
        assert!((gh - 30.0).abs() < 0.5, "group height={} (expect 30, not ~764/397)", gh);
    }
```

- [ ] **Step 2: 통과 확인**

Run: `cargo test -p composition-engine flex_column_parent_single_line_child_no_height_explosion 2>&1 | tail -12`
Expected: PASS (group height ≈ 30).

- [ ] **Step 3: 커밋**

```bash
git add packages/composition-engine/src/tree.rs
git commit -m "$(printf 'test(engine): tree 통합 — column 부모 단일 라인 자식 height 무폭발\n\nToggleButtonGroup 397 회귀를 tree solve 수준에서 고정(group height=30).\n\nCo-Authored-By: Claude Fable 5 <noreply@anthropic.com>')"
```

---

### Task 6: 전체 cargo suite + wasm 재빌드 + type-check

**Files:**

- Build: `packages/composition-engine` → wasm 산출물 (git 미추적, `pnpm wasm:build:engine`)

**Interfaces:**

- Consumes: 앞 Task 들의 flex.rs/tree.rs 변경.
- Produces: 재빌드된 wasm 모듈 (`apps/builder/src/builder/workspace/canvas/wasm-bindings/composition-engine-pkg/`).

- [ ] **Step 1: 전체 cargo 테스트**

Run: `cargo test -p composition-engine 2>&1 | tail -15`
Expected: 신규 6(Task1 indefinite 3 + Task4 다중/definite 2 + Task5 tree 1) + 기존 240 전부 PASS, 실패 0. (수치는 실행 시점 기준; 실패 0 이 게이트.)

- [ ] **Step 2: wasm 재빌드**

Run: `pnpm wasm:build:engine 2>&1 | tail -15`
Expected: wasm-pack 빌드 성공, 산출물 갱신.

- [ ] **Step 3: type-check**

Run: `pnpm type-check 2>&1 | tail -15`
Expected: 소스 전용 baseline 대비 신규 위반 0. (flex.rs 수정은 wasm 경계 안이라 TS 영향 없음 — 회귀 없음 확인용.)

- [ ] **Step 4: dual-run golden 재실행 (회귀 확인)**

Run: `cargo test -p composition-engine golden 2>&1 | tail -12` 및 관련 dualRun 테스트가 있으면 함께.
Expected: 기존 golden PASS 유지 (N1~N6 단일 컨테이너, 이 변경 무영향).

- [ ] **Step 5: 커밋 (빌드 산출물은 git 미추적 → 커밋할 소스 없으면 skip)**

wasm 산출물은 `.gitignore` 로 미추적. 소스 변경이 앞 Task 에서 이미 커밋됐으면 이 Task 는 검증 전용 — 새 커밋 없음. type-check/빌드 결과만 보고.

---

## Self-Review

**Spec coverage (설계 2차 정정 반영):**

- 설계 §"수정 코드 — 3곳(+tree.rs)" → Task 2(align_content_offsets STRETCH) + Task 3(flex_layout 시그니처+라인 cross 승격+헬퍼+tree.rs) ✓
- 설계 §테스트 신규 indefinite 1~3 → Task 1(3개, Task 3 Step 5 에서 false 인자 부여) ✓
- 설계 §테스트 신규 definite 4 → Task 4 `single_line_definite_align_items_center_uses_available_cross` ✓
- 설계 §테스트 다중 라인 5 → Task 4 `multi_line_align_content_stretch_still_expands` ✓
- 설계 §테스트 기존 회귀 5종 유지 → Task 2 Step 4(4종 깨짐 확인) + Task 3 Step 6(복구 확인) ✓
- 설계 §테스트 tree 통합 6 → Task 5 ✓
- 설계 §검증 체인 (cargo/wasm/type-check/live) → Task 6 + live 는 실행 단계 별도(아래) ✓
- 설계 §dual-run 한계 → Task 6 Step 4 golden 재실행 ✓

**Placeholder scan:** 모든 코드 블록 verbatim, TBD/TODO 없음 ✓

**Type consistency:** `flex_layout` 마지막 인자 `cross_is_definite: bool` 이 Task 3 시그니처 정의 + 호출부 3곳(tree.rs solve_flex, flex_layout_single_line 헬퍼, Task 1/4 테스트) 전부 일치. `place_line_cross_axis` 시그니처 무변경. `align_content_offsets` 반환 tuple 3-arity 유지 ✓

**착수 순서 주의:** Task 2 단독 커밋 시점에는 회귀 4종(`stretch_still_fills_when_cross_auto` / `align_stretch_fills_cross` / `align_center_cross` / `clamp_respects_max_cross`)이 의도적으로 FAIL 상태(Task 2 Step 4 명시). Task 3(cross_is_definite) 커밋으로 GREEN 복구. 리뷰어에게 Task 2/3 는 짝 — Task 2 만 보고 "회귀 유발" 로 판정하지 않도록 브리프에 명시.

## Live 검증 (Task 6 이후, subagent-driven 종료 후 컨트롤러 수행)

cargo/type-check PASS 단독으로 종결 금지(CLAUDE.md). 브라우저 로드 wasm 실측:

1. dev 서버 실행 확인 → ToggleButtonGroup 요소 추가(store 프로그래매틱).
2. 로드된 wasm `LayoutEngine` 로 group 노드 layout height 실측 → **30 확인**(이전 397).
3. Preview iframe DOM 의 `.react-aria-ToggleButtonGroup` height 와 대조(CSS 독립 oracle).
4. 검증용 추가 요소는 사용자 문서에서 정리(삭제 전 원본 여부 확인).
