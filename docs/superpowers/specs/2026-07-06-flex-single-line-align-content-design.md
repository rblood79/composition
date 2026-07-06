# flex.rs 단일 라인 align-content 무효화 — 설계

> 작성일 2026-07-06 · 대상 엔진 `packages/composition-engine` (ADR-916 자체 엔진)
> 관련: 직전 box-sizing 계약 정합 작업(`2026-07-06-engine-border-box-contract-design.md`)의 후속. tree.rs 주석(line 71-77)이 예고한 "flex.rs stretch 수정" 이 본 작업.

## 문제

`flex_layout`(`packages/composition-engine/src/flex.rs`)이 **단일 라인** flex 컨테이너에도 `align-content`(기본값 `stretch`)를 적용한다. `align_content_offsets`의 `ALIGN_CONTENT_STRETCH` 분기가 `stretch_extra = cross_free / line_count` 를 반환하고, 본체에서 이를 라인 cross 크기에 가산한다:

```rust
// flex.rs:544-553 (현재)
let (cross_start_offset, cross_between_extra, stretch_extra) =
    align_content_offsets(align_content, cross_free, line_count);
let mut cross_cursor = cross_start_offset;
for (li, line) in resolved_lines.iter().enumerate() {
    let mut this_line_cross = line_cross_sizes[li];
    if stretch_extra > 0.0 {
        this_line_cross += stretch_extra;   // ← 단일 라인도 available_cross 로 부풀림
    }
    ...
}
```

`cross_free = available_cross - total_line_cross`. 부모가 큰 cross available 을 넘기면(예: body `flex-direction: column`, height 764), 단일 라인 컨테이너의 라인 cross 가 764 근처로 팽창한다. 그 결과 tree.rs `solve_flex`의 `max_bottom`(자식 y+h bounding box)이 커져 컨테이너 height 가 폭발한다.

### 재현 (실측)

ToggleButtonGroup: `containerStyles = { display:flex, alignItems:center, width:fit-content }`, height 미지정(engine auto). body `flex-direction: column` 자식으로 배치 시 브라우저 CSS 는 30px, 자체 엔진 Skia 는 **397px**.

- CSS §8.4 근거: _"If the flex container has only a single line ... this value has no effect."_ 단일 라인 컨테이너는 `align-content`(stretch/center/end/space-\*) **전체가 무시**되고, 컨테이너 cross size = 라인 cross size(자식 max)가 된다.
- `alignItems: center` 가 트리거 조건은 아니다(align-items 는 라인 **내부** 정렬로 별개). 근본 원인은 오직 단일 라인 align-content stretch. alignItems 무관하게 단일 라인 + 큰 available_cross 면 동일 발산.

## 결정

### 착수 중 발견 — align-content ↔ align-items stretch 얽힘 (전제 정정)

원안(`line_count<=1` 시 align-content 전체 무효 → stretch_extra=0)은 이 엔진의 숨은 결합을 놓쳤다. 이 엔진은 **"단일 라인 컨테이너의 라인 cross = available_cross"**(자식 stretch 대상)를 별도 로직 없이 **align-content stretch 의 stretch_extra 로 대신 구현**했다. 즉 `align-items: stretch` + 자식 cross-auto + 컨테이너 height 100 → 자식 100 채움은, 라인이 available_cross 로 부풀려진 뒤(`stretch_extra`) `place_line_cross_axis`의 `ALIGN_STRETCH if cross_is_auto` 가 그 라인 cross 를 채우는 2단 의존이다.

원안대로 stretch_extra=0 이면 라인 cross=0 → 자식 0 → 기존 회귀 방지 테스트 `stretch_still_fills_when_cross_auto`(100 기대)가 **100→0 으로 깨진다**. 이는 CSS 위반(align-items stretch 는 단일 라인에서도 컨테이너 cross 를 채움).

### 착수 중 2차 발견 — available_cross 의미 이중성 (definite vs indefinite)

Task 2(align_content 단일 라인 stretch_extra 제거) 후 예상 못 한 회귀가 드러났다: `align_center_cross`(align-items center, available_cross 100, 자식 20 → y=40 기대)와 `clamp_respects_max_cross` 도 FAIL. 근본 원인 — **이 엔진은 모든 align-items 정렬(center/end/stretch/clamp)이 단일 라인에서 "부풀려진 라인 cross(=available_cross)"에 의존**했다. 라인 부풀리기를 제거하니 그 정렬 기준이 사라졌다.

여기서 `flex_layout` 의 `available_cross` 가 **두 의미를 구분 못 하는 것**이 핵심 전제로 드러났다:

- **(a) definite**: 컨테이너 cross 가 확정(height 명시, 또는 부모 stretch 로 확정). CSS 상 단일 라인 라인 cross = 그 definite cross → align-items center/stretch 가 그 공간을 채움/중앙정렬. `align_center_cross`(y=40) 가 정답.
- **(b) indefinite**: 컨테이너 cross 가 auto(content 기반). CSS 상 단일 라인 라인 cross = 자식 max content → align-items 는 그 안(자식 max)에서 정렬해 자식 제자리. ToggleButtonGroup(height auto, alignItems center) = height 30, 자식 y=0.

tree.rs `solve_flex` 는 이 구분을 안다(`explicit_h > 0.0` = 자기 cross 명시). 하지만 `flex_layout` 은 available_cross 숫자만 받아 모른다. **그래서 (a) definite 100 기준 y=40 과 (b) indefinite 30 이 동시에 맞을 수 없다** — available_cross 를 채우면 ToggleButtonGroup 이 폭발(397/367), 안 채우면 align_center_cross 가 깨진다.

**사용자 결정(2026-07-06): "cross_is_definite 인자 추가"** — `flex_layout` 시그니처에 `cross_is_definite: bool` 을 추가해 두 의미를 분리한다. definite 면 단일 라인 라인 cross = available_cross(align-items 가 채움/정렬), indefinite 면 자식 max(제자리). tree.rs 가 `explicit_h > 0.0`(cross 명시) 여부로 판정해 전달.

### 수정 코드 — 3곳

**(1) `flex_layout` 시그니처 — `cross_is_definite: bool` 추가**

```rust
pub fn flex_layout(
    data: &[f32],
    available_main: f32,
    available_cross: f32,
    direction: u8,
    justify_content: u8,
    align_items: u8,
    align_content: u8,
    wrap: u8,
    gap_main: f32,
    gap_cross: f32,
    cross_is_definite: bool,   // ← 추가. 컨테이너 cross 가 확정(명시/부모 stretch)인가
) -> Box<[f32]>
```

**(2) `align_content_offsets` — stretch_extra 를 다중 라인 전용으로**

`ALIGN_CONTENT_STRETCH` 분기가 `line_count <= 1` 이면 stretch_extra 0 (단일 라인 라인 부풀리기는 align-content 소관 아님 — align-items 가 line cross 로 처리):

```rust
ALIGN_CONTENT_STRETCH => {
    if line_count <= 1 {
        (0.0, 0.0, 0.0)   // 단일 라인 align-content stretch 무효(CSS §8.4)
    } else {
        let per_line = cross_free / line_count as f32;
        (0.0, 0.0, per_line)
    }
}
```

`flex_layout` 본체에서 단일 라인 align-content offset(center/end/space-\*) 도 0 강제:

```rust
let (mut cross_start_offset, mut cross_between_extra, stretch_extra) =
    align_content_offsets(align_content, cross_free, line_count);
if line_count <= 1 {
    cross_start_offset = 0.0;   // 단일 라인 align-content 정렬 무효(CSS §8.4)
    cross_between_extra = 0.0;
}
```

**(3) 단일 라인 line cross 결정 — definite 면 available_cross**

`flex_layout` 라인 루프에서 `place_line_cross_axis` 에 넘길 `this_line_cross` 를 definite 단일 라인일 때 available_cross 로 승격:

```rust
for (li, line) in resolved_lines.iter().enumerate() {
    let mut this_line_cross = line_cross_sizes[li];
    if stretch_extra > 0.0 {
        this_line_cross += stretch_extra;    // 다중 라인 align-content stretch (기존)
    }
    // 단일 라인 + definite: 라인 cross = 컨테이너 cross(available_cross).
    // align-items(center/end/stretch)가 이 공간 안에서 정렬/채움. indefinite 는
    // 자식 max(line_cross_sizes[li]) 유지 → 컨테이너가 content 로 축소(ToggleButtonGroup 30).
    if line_count == 1 && cross_is_definite {
        this_line_cross = this_line_cross.max(available_cross);
    }
    ...
    place_line_cross_axis(&mut out, line, direction, cross_cursor, this_line_cross, align_items);
    ...
}
```

`place_line_cross_axis` 는 **시그니처 변경 없음** — 이미 `line_cross_size` 인자로 라인 cross 를 받아 center/end/stretch/clamp 를 그 기준으로 계산한다. definite 면 그 값이 available_cross 가 되어 기존 정렬 로직이 CSS 대로 동작. `ALIGN_STRETCH if cross_is_auto` 도 그대로 `cross_avail = line_cross_size` 를 채우므로 stretch 100 복구.

**(4) tree.rs `solve_flex` 호출부 — definite 전달**

```rust
let out = flex::flex_layout(
    &data, avail_main, avail_cross, direction, justify, align_items,
    align_content, wrap, gap_main, gap_cross,
    explicit_h > 0.0 && is_row || explicit_w > 0.0 && !is_row,  // cross_is_definite
);
```

row 면 cross=height → `explicit_h > 0.0`, column 이면 cross=width → `explicit_w > 0.0`. **부모 stretch 상속(2차 definite)은 이번 범위 밖** — 자기 cross 명시만 definite 로 판정(ToggleButtonGroup=indefinite, align_center_cross 헬퍼=definite 로 둘 다 정합). 부모 stretch 케이스는 후속.

**하위 호환 진입점 `flex_layout_single_line`**: available_cross 를 컨테이너 크기로 가정하는 헬퍼(기존 8 테스트) → `cross_is_definite = true` 로 호출해 기존 동작 전면 보존.

## 격리 — 건드리지 않는 것

| 경로                                                | 이유                                                                                                                                                                   |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`place_line_cross_axis` 내부 로직/시그니처**      | **변경 없음**. 이미 `line_cross_size` 인자로 라인 cross 를 받아 center/end/stretch/clamp 계산. definite 면 그 값이 available_cross 로 승격돼 기존 정렬 로직이 CSS 대로 |
| **align-items 전부 (indefinite 단일 라인)**         | 라인 cross = 자식 max → center/end/stretch 가 그 안에서 정렬 → 자식 제자리. ToggleButtonGroup(center, height auto) → 자식 y=0, 컨테이너=30                             |
| **align-items 전부 (definite 단일 라인)**           | 라인 cross = available_cross → center(y=40)/stretch(100)/clamp 정상. align_center_cross 헬퍼(definite) 보존                                                            |
| **다중 라인 align-content** (line_count > 1)        | stretch_extra/offset 모두 기존 경로 — wrap 시 라인 간 stretch/center/end/space-\* 정상. `cross_is_definite` 무관                                                       |
| **main-axis** (justify_content)                     | 변경 없음                                                                                                                                                              |
| **box-sizing** (직전 작업, tree.rs spec_to_content) | 무관                                                                                                                                                                   |

## 테스트 (TDD, cargo)

`packages/composition-engine/src/flex.rs` `#[cfg(test)]` 모듈. **핵심 = definite/indefinite 분리 검증**: indefinite 단일 라인은 라인 cross=자식 max(축소), definite 단일 라인은 available_cross(채움).

신규 — **indefinite** (cross_is_definite=false, ToggleButtonGroup 케이스):

1. `single_line_indefinite_align_content_stretch_no_expand` — row, 자식 height **명시 30**, available_cross 764, align_items=START, align_content=stretch, **cross_is_definite=false** → 자식 height 30, y=0. 라인 764 로 안 부풀려짐(397 근원 차단).
2. `single_line_indefinite_align_content_center_no_offset` — 위 + align_content=center → 자식 y=0 (단일 라인 align-content 무효).
3. `single_line_indefinite_align_items_center_child_stays_top` — align_items=**center** + 자식 height 30, available_cross 764, **cross_is_definite=false** → 자식 height 30, **y=0** (라인 cross=자식 30, 중앙=제자리). ToggleButtonGroup 실제 케이스.

신규 — **definite** (cross_is_definite=true):

4. `single_line_definite_align_items_center_uses_available_cross` — align_items=center + 자식 20, available_cross 100, **cross_is_definite=true** → 자식 **y=40** ((100-20)/2). definite 면 available_cross 로 중앙정렬(align_center_cross 헬퍼와 동형, 명시적 definite 확증).

신규 — **다중 라인**:

5. `multi_line_align_content_stretch_still_expands` — wrap 2라인, available_cross 큼, cross_is_definite 무관 → stretch_extra 로 라인 팽창(다중 라인 유지).

기존 회귀 방지 테스트(**변경 후 통과 유지 — 성공 조건**). 모두 `flex_layout_single_line`(→ `cross_is_definite=true`) 또는 definite=true 로 호출되므로 available_cross 를 컨테이너 크기로 취급하는 기존 시맨틱 보존:

- `stretch_still_fills_when_cross_auto` (line ~1064): align_items=STRETCH + cross auto + available_cross 100 → 자식 100. definite 경로가 라인 cross=100 → stretch 채움 → 유지.
- `align_stretch_fills_cross` (line ~820): 동형 유지.
- `align_center_cross` (line ~824): align_items=center + available_cross 100 + 자식 20 → y=40. definite 경로 유지.
- `clamp_respects_max_cross` (line ~836): align_items=STRETCH + max_cross 30 + available_cross 100 → 30 clamp. definite 경로 유지.
- `stretch_respects_explicit_cross_size` (line ~1051): cross 명시 30 → 30 (cross_is_auto=false, stretch 안 함). 무관 유지.

**주의**: 위 5개 기존 테스트는 Task 2 단독 후 FAIL 상태(라인 cross 축소). Task 3(cross_is_definite 도입 + `flex_layout_single_line` 을 definite=true 로) 에서 전부 복구. Task 2/3 는 짝.

tree.rs 통합 테스트:

6. `flex_column_parent_single_line_child_no_height_explosion` — body(column, height 764) > group(row, alignItems center, height 미지정=indefinite) > 버튼(30) → group height = 30 (397 아님). tree.rs 가 `explicit_h>0.0=false` → cross_is_definite=false 전달 확인.

## 검증 체인

1. `cargo test -p composition-engine` — 신규 6 + 기존 240 PASS (기존 stretch/center/clamp 회귀 테스트 5종 포함 유지 확인)
2. `pnpm wasm:build:engine` — wasm 재빌드
3. `pnpm type-check` — 소스 정합
4. **live**: 브라우저 로드 wasm 실측(dual-run diff 0 은 이 케이스를 커버 못 함 — 아래) + Preview 대조. ToggleButtonGroup group height 397 → 30 확인.

### dual-run 한계 명시 (독립 oracle 의무)

기존 dual-run golden(N1~N6)은 **전부 단일 컨테이너**라 부모-큰-available_cross(indefinite) 조건을 표현하지 못한다. 직전 box-sizing 작업에서 학습한 것과 동종 맹점(fixture 가 안 쓰는 입력 차원). 따라서:

- 신규 cargo 테스트가 **cross_is_definite false + available_cross 를 자식 max 보다 크게** 준 케이스를 커버(위 1,2,3)해 indefinite 계약을 고정한다.
- live 는 실제 브라우저 CSS(30px) 대비로 확증 — 자체 엔진 단독이라 A↔B dual-run 무력, CSS 가 독립 oracle.

## 위험

| ID  | 위험                                                            | 심각도 | 대응                                                                                                                                                                                                                                                                                 |
| --- | --------------------------------------------------------------- | :----: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| R1  | `flex_layout` 시그니처 변경(cross_is_definite)이 전 호출부 파급 |  MED   | 호출부 2곳(tree.rs solve_flex + flex_layout_single_line 헬퍼)만. 헬퍼는 definite=true 로 기존 8+ 테스트 전면 보존. tree.rs 는 `explicit_h>0.0`(row)/`explicit_w>0.0`(col) 판정. type-check + 전체 cargo 가 누락 파급 포착                                                            |
| R2  | indefinite 라인 cross 축소가 align-items stretch 자식 0 붕괴    |  MED   | indefinite + align-items stretch + 자식 cross auto 케이스는 라인 cross=자식 content max. 자식 content 가 0 이면 0(CSS 정합 — auto 자식은 content 로 크기). 실무 ToggleButton 은 content 보유. 신규 3 + 기존 stretch 5종이 definite/indefinite 양쪽 고정                              |
| R3  | 부모 stretch 상속(2차 definite) 미구현으로 특정 케이스 발산     |  MED   | 이번 범위=자기 cross 명시만 definite. 부모가 자식 cross 를 stretch 로 확정하는 케이스(예: column 부모의 row 자식 width stretch)는 indefinite 로 취급 → content 축소. ToggleButtonGroup/align_center_cross 는 무해. 후속 ADR 로 부모 stretch definite 확장. **후속 이슈 섹션에 기록** |
| R4  | 기존 dual-run golden 이 이 변경으로 diff 발생                   |  LOW   | golden N1~N6 전부 단일 컨테이너·definite(명시 크기) 형상 → definite=true 경로로 base 동일 결과. 재빌드 후 golden 재실행으로 확증                                                                                                                                                     |

잔존 HIGH 위험 없음.

## 후속 이슈 (이번 범위 밖)

- **부모 stretch 상속 definite (R3)**: 자기 cross 미명시라도 부모가 align-items stretch 로 자식 cross 를 확정하면 CSS 상 definite. 이번엔 `explicit_h/w > 0.0` 자기 명시만 판정 → 그런 자식은 indefinite(content 축소)로 처리. ToggleButtonGroup/현 catalog 컴포넌트 미해당이라 비차단. 필요 시 tree.rs 가 자식에 "definite cross available" 플래그를 전파하는 후속 작업.

## Consequences

### Positive

- 모든 단일 라인 flex 컨테이너(ToggleButtonGroup 외 다수)의 cross size 발산 근본 해소 — CSS §8.4 + definite/indefinite 시맨틱 정합.
- align-content(라인 부풀리기)와 align-items(자식 정렬)의 얽힘을 `cross_is_definite` 로 정리 — 향후 flex cross 로직 확장 시 단일 진입점.
- 엔진 일반 수정이라 컴포넌트별 workaround 불필요.

### Negative

- `flex_layout` 시그니처 변경(cross_is_definite) → 호출부 2곳 동시 갱신 필수(type-check 가 포착).
- 부모 stretch 상속 definite(R3)는 미구현 — 후속 이슈로 이월.
