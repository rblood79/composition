# flex.rs 단일 라인 align-content 무효화 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 단일 라인 flex 컨테이너가 align-content stretch 로 라인 cross 를 available_cross 까지 부풀려 컨테이너 height 가 폭발하는 버그(ToggleButtonGroup 397px)를 CSS §8.4 정합으로 근본 수정한다.

**Architecture:** `packages/composition-engine`(Rust→wasm, ADR-916 자체 엔진)의 `flex.rs`에서 두 얽힌 개념을 분리한다 — (A) align-content stretch(라인 부풀리기)는 다중 라인 전용으로 되돌리고, (B) 단일 라인 자식 stretch(align-items:stretch)는 `place_line_cross_axis`가 `available_cross`를 직접 참조해 처리. tree.rs는 변경 없음(컨테이너 크기는 자식 bounding box 로 이미 정확 도출).

**Tech Stack:** Rust, wasm-bindgen, wasm-pack (`pnpm wasm:build:engine`), cargo test.

## Global Constraints

- 응답·주석·커밋 메시지 한국어 (코드/기술 용어 영어 유지).
- 커밋 말미 `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- 수정은 `flex.rs` 2곳(`align_content_offsets` STRETCH 분기 + `place_line_cross_axis` 시그니처/STRETCH 분기)과 호출부. tree.rs 로직 변경 금지.
- 기존 회귀 테스트 3종(`stretch_still_fills_when_cross_auto` / `align_stretch_fills_cross` / `stretch_respects_explicit_cross_size`)은 **변경 없이 통과 유지**가 성공 조건.
- 다중 라인(line_count > 1) 경로는 기존 동작 그대로.
- 설계: `docs/superpowers/specs/2026-07-06-flex-single-line-align-content-design.md`.
- 상수: `ALIGN_CONTENT_STRETCH=0`, `ALIGN_CONTENT_START=1`, `ALIGN_STRETCH=0`(align-items), `DIR_ROW=0`, `DIR_COLUMN=1`, `AUTO`(sentinel). `FLEX_FIELD_COUNT=17`, `OUT_FIELDS=4`. 테스트 헬퍼 `item(w,h)`(grow0/shrink1), `with_flex`, `flatten` 존재. `flex_layout_single_line` 진입점은 `align_content=STRETCH` 고정.

---

## File Structure

- `packages/composition-engine/src/flex.rs` — 수정 대상 (align_content_offsets, place_line_cross_axis, flex_layout 호출부, 테스트 모듈)
- `packages/composition-engine/src/tree.rs` — 통합 테스트만 추가 (로직 무변경)

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

### Task 3: place_line_cross_axis — 단일 라인 자식 stretch = available_cross (GREEN 완결)

**Files:**

- Modify: `packages/composition-engine/src/flex.rs:676-711` (`place_line_cross_axis` 시그니처 + STRETCH 분기)
- Modify: `packages/composition-engine/src/flex.rs:562-569` (`flex_layout` 호출부 — 새 인자 전달)

**Interfaces:**

- Consumes: `FlexItem { cross_is_auto: bool, min_cross, max_cross, margin_cross_start, margin_cross_end, cross_content, pad_border_cross, ... }`. `clamp_size(value, min, max) -> f32`.
- Produces: `place_line_cross_axis(out, line, direction, line_cross_start, line_cross_size, align_items, available_cross: f32, single_line: bool)` — 시그니처에 2개 인자 추가.

- [ ] **Step 1: place_line_cross_axis 시그니처 확장**

함수 시그니처(현재 line 676-683)를 교체:

```rust
fn place_line_cross_axis(
    out: &mut [f32],
    line: &[FlexItem],
    direction: u8,
    line_cross_start: f32,
    line_cross_size: f32,
    align_items: u8,
    available_cross: f32,
    single_line: bool,
) {
```

- [ ] **Step 2: ALIGN_STRETCH 분기에 단일/다중 라인 stretch 대상 분기**

`ALIGN_STRETCH if it.cross_is_auto => { ... }` 블록(현재 line 698-701)을 교체:

```rust
            ALIGN_STRETCH if it.cross_is_auto => {
                // 단일 라인: 컨테이너 cross(available_cross)로 stretch — CSS 상 단일 라인 flex
                //   컨테이너의 라인 cross = 컨테이너 content cross.
                // 다중 라인: 소속 라인 cross(line_cross_size)로 stretch.
                let stretch_target = if single_line { available_cross } else { line_cross_size };
                let target_avail =
                    (stretch_target - it.margin_cross_start - it.margin_cross_end).max(0.0);
                let stretched = clamp_size(target_avail, it.min_cross, it.max_cross);
                (it.margin_cross_start, stretched)
            }
```

- [ ] **Step 3: flex_layout 호출부에 새 인자 전달**

`flex_layout` 라인 루프의 `place_line_cross_axis` 호출부(현재 line 562-569)를 교체:

```rust
        place_line_cross_axis(
            &mut out,
            line,
            direction,
            cross_cursor,
            this_line_cross,
            align_items,
            available_cross,
            line_count == 1,
        );
```

- [ ] **Step 4: 전체 flex 테스트 통과 확인 (GREEN)**

Run: `cargo test -p composition-engine --lib 2>&1 | tail -25`
Expected: 신규 3(Task1) + 기존 stretch 회귀 3종(`stretch_still_fills_when_cross_auto`=100 복구, `align_stretch_fills_cross`=100, `stretch_respects_explicit_cross_size`=30) 포함 전체 PASS. 실패 0.

- [ ] **Step 5: 커밋**

```bash
git add packages/composition-engine/src/flex.rs
git commit -m "$(printf 'feat(engine): place_line_cross_axis 단일 라인 자식 stretch=available_cross\n\nalign-items stretch 자식이 라인 부풀리기(align-content)에 의존하던 결합 제거.\nsingle_line 이면 available_cross, 다중 라인이면 line_cross_size 로 stretch.\nstretch_still_fills_when_cross_auto(100) 회귀 복구.\n\nCo-Authored-By: Claude Fable 5 <noreply@anthropic.com>')"
```

---

### Task 4: 다중 라인 회귀 방지 테스트 (RED→GREEN 즉시)

**Files:**

- Test: `packages/composition-engine/src/flex.rs` (테스트 모듈)

**Interfaces:**

- Consumes: `flex_layout(...)`.
- Produces: 없음.

- [ ] **Step 1: 다중 라인 stretch 유지 테스트 추가**

Task 1 테스트 뒤에 추가:

```rust
#[test]
fn multi_line_align_content_stretch_still_expands() {
    // WRAP + available_main 작아 2라인 강제. available_cross 200, 라인당 자식 height 20.
    // 다중 라인 align-content stretch → 라인들이 cross_free 를 나눠 팽창(단일 라인 무효와 대비).
    let data = flatten(&[item(80.0, 20.0), item(80.0, 20.0)]);
    let out = flex_layout(
        &data, 100.0, 200.0, DIR_ROW, JUSTIFY_START, ALIGN_START,
        ALIGN_CONTENT_STRETCH, WRAP_WRAP, 0.0, 0.0,
    );
    // 2라인: item0 y=0, item1 은 첫 라인이 stretch_extra 로 팽창해 20 보다 큰 y 로 밀림.
    assert!((out[1] - 0.0).abs() < 0.01, "item0 y={} (라인0 시작)", out[1]);
    assert!(out[5] > 20.0 + 0.01, "item1 y={} (라인1 — 라인0 stretch 로 20 초과)", out[5]);
}
```

- [ ] **Step 2: 통과 확인**

Run: `cargo test -p composition-engine multi_line_align_content_stretch_still_expands 2>&1 | tail -10`
Expected: PASS (Task 2/3 수정이 다중 라인 stretch_extra 를 보존하므로).

- [ ] **Step 3: 커밋**

```bash
git add packages/composition-engine/src/flex.rs
git commit -m "$(printf 'test(engine): 다중 라인 align-content stretch 유지 회귀 방지\n\n단일 라인 무효화가 다중 라인 stretch_extra 를 건드리지 않음을 고정.\n\nCo-Authored-By: Claude Fable 5 <noreply@anthropic.com>')"
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
Expected: 신규 5 + 기존 240 전부 PASS, 실패 0. (수치는 실행 시점 기준; 실패 0 이 게이트.)

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

**Spec coverage:**

- 설계 §"수정 코드 — 2곳 분리" → Task 2(align_content_offsets) + Task 3(place_line_cross_axis) ✓
- 설계 §테스트 신규 1~4 → Task 1(1~3) + Task 4(4) ✓
- 설계 §테스트 기존 회귀 3종 유지 → Task 2 Step 4(깨짐 확인) + Task 3 Step 4(복구 확인) ✓
- 설계 §테스트 tree 통합 5 → Task 5 ✓
- 설계 §검증 체인 (cargo/wasm/type-check/live) → Task 6 + live 는 실행 단계 별도(아래) ✓
- 설계 §dual-run 한계 → Task 6 Step 4 golden 재실행 ✓

**Placeholder scan:** 모든 코드 블록 verbatim, TBD/TODO 없음 ✓

**Type consistency:** `place_line_cross_axis` 인자명 `available_cross`/`single_line` 이 Task 3 정의와 호출부 일치. `align_content_offsets` 반환 tuple 3-arity 유지 ✓

**착수 순서 주의:** Task 2 단독 커밋 시점에는 `stretch_still_fills_when_cross_auto` 가 의도적으로 FAIL 상태(Step 4 에 명시). Task 3 커밋으로 GREEN 복구. 리뷰어에게 Task 2/3 는 짝 — Task 2 만 보고 "회귀 유발" 로 판정하지 않도록 브리프에 명시.

## Live 검증 (Task 6 이후, subagent-driven 종료 후 컨트롤러 수행)

cargo/type-check PASS 단독으로 종결 금지(CLAUDE.md). 브라우저 로드 wasm 실측:

1. dev 서버 실행 확인 → ToggleButtonGroup 요소 추가(store 프로그래매틱).
2. 로드된 wasm `LayoutEngine` 로 group 노드 layout height 실측 → **30 확인**(이전 397).
3. Preview iframe DOM 의 `.react-aria-ToggleButtonGroup` height 와 대조(CSS 독립 oracle).
4. 검증용 추가 요소는 사용자 문서에서 정리(삭제 전 원본 여부 확인).
