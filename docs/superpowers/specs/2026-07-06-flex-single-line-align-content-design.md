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

**수정 위치**: `flex_layout` 진입점(align-content 계산 직전). 사용자 결정 = "flex_layout 진입점 가드".
**무효화 범위**: `line_count <= 1` 이면 align-content 값 전체(center/end/stretch/space-\*)를 START 로 강제. 사용자 결정 = "align-content 전체 무효 (CSS 명세)". CSS §8.4 는 단일 라인에서 align-content 를 통째로 무시하므로 stretch 뿐 아니라 center/end 도 무효(자식 정렬은 align-items 담당).

### 수정 코드

`align_content_offsets` 호출 직전, `line_count` 확정 후:

```rust
// CSS §8.4: 단일 라인 flex 컨테이너는 align-content 를 적용하지 않는다.
// (다중 라인에서만 라인 간 stretch/정렬 유효). 미적용 시 부모가 준 큰 available_cross 로
// 라인이 stretch 되어 컨테이너 cross size 폭발(ToggleButtonGroup height 397 회귀).
// stretch 뿐 아니라 center/end/space-* 전체 무효 — 자식 정렬은 align-items 담당.
let effective_align_content = if line_count <= 1 {
    ALIGN_CONTENT_START
} else {
    align_content
};

let (cross_start_offset, cross_between_extra, stretch_extra) =
    align_content_offsets(effective_align_content, cross_free, line_count);
```

`ALIGN_CONTENT_START` 는 `align_content_offsets`에서 `_ => (0.0, 0.0, 0.0)` 로 매핑되어 offset 0 / between 0 / stretch_extra 0 — 라인 크기·위치 불변. `line_count == 0` 조기 반환은 `align_content_offsets` 내부에 이미 존재(중복 무해).

## 격리 — 건드리지 않는 것

| 경로                                                                                       | 이유                                                                                                                                                            |
| ------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **align-items** (`place_line_cross_axis`, `ALIGN_CENTER`/`ALIGN_STRETCH if cross_is_auto`) | 자식을 **라인 내부** cross 로 정렬/stretch. line_count 무관, 본 수정과 직교. `alignItems:center` 는 여전히 자식을 라인(=자식 max=30) 내 중앙 배치 → 자식 제자리 |
| **다중 라인 align-content** (line_count > 1)                                               | `effective_align_content = align_content` 유지 — wrap 발생 시 라인 간 stretch/center/end/space-\* 정상                                                          |
| **main-axis** (justify_content)                                                            | 변경 없음                                                                                                                                                       |
| **box-sizing** (직전 작업, tree.rs spec_to_content)                                        | 무관                                                                                                                                                            |

## 테스트 (TDD, cargo)

`packages/composition-engine/src/flex.rs` `#[cfg(test)]` 모듈:

1. `single_line_align_content_stretch_does_not_expand` — row, 자식 1개 cross(height) 30, available_cross 764, align_content=stretch(default) → 컨테이너/라인 cross = 30 (397 아님). 자식 y=0.
2. `single_line_align_content_center_does_not_offset` — 위 조건 + align_content=center → 자식 y=0 (단일 라인이므로 center 무효). available_cross 큼에도 중앙 이동 없음.
3. `single_line_align_items_center_centers_child_in_line` — align_items=center + 자식 height 30 → 라인 cross=30 이므로 자식 y=0(라인 내 중앙=제자리). align-items 는 살아있음 확인.
4. `multi_line_align_content_stretch_still_expands` — wrap 발생 2라인, available_cross 큼 → 라인들이 stretch 로 팽창(회귀 방지: 다중 라인 유지).

tree.rs 통합 테스트(`tree.rs` 또는 별도):

5. `flex_column_parent_single_line_child_no_height_explosion` — body(column, height 764) > group(row, alignItems center, height 미지정) > 버튼(30) → group height = 30.

## 검증 체인

1. `cargo test -p composition-engine` — 신규 5 + 기존 240 PASS
2. `pnpm wasm:build:engine` — wasm 재빌드
3. `pnpm type-check` — 소스 정합
4. **live**: 브라우저 로드 wasm 실측(dual-run diff 0 은 이 케이스를 커버 못 함 — 아래) + Preview 대조. ToggleButtonGroup group height 397 → 30 확인.

### dual-run 한계 명시 (독립 oracle 의무)

기존 dual-run golden(N1~N6)은 **전부 단일 컨테이너**라 부모-큰-available_cross → 단일 라인 stretch 조건을 표현하지 못한다. 직전 box-sizing 작업에서 학습한 것과 동종 맹점(fixture 가 안 쓰는 입력 차원). 따라서:

- 신규 cargo 테스트가 **available_cross 를 라인 cross 보다 크게** 명시적으로 준 케이스를 커버(위 1,2,4)해 계약을 고정한다.
- live 는 실제 브라우저 CSS(30px) 대비로 확증 — 자체 엔진 단독이라 A↔B dual-run 무력, CSS 가 독립 oracle.

## 위험

| ID  | 위험                                                | 심각도 | 대응                                                                                                                                                                             |
| --- | --------------------------------------------------- | :----: | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | flex.rs 코어 수정이 다중 라인/align-items 회귀 유발 |  MED   | 변경을 `line_count<=1` 가드 1곳에 격리. 다중 라인/align-items 경로는 조건 미충족으로 무영향. 테스트 3,4 가 회귀 방지                                                             |
| R2  | 기존 dual-run golden 이 이 변경으로 diff 발생       |  LOW   | golden N1~N6 전부 단일 컨테이너·단일 라인이지만 available_cross 를 라인보다 크게 주지 않는 형상 → stretch_extra 는 base 에서도 0 이거나 무의미. 재빌드 후 golden 재실행으로 확증 |
| R3  | 단일 라인 판정 경계(0/1 라인)                       |  LOW   | `line_count <= 1` 이 0 과 1 모두 포함. 0 라인(자식 없음)은 count==0 조기 반환으로 도달 안 함                                                                                     |

잔존 HIGH 위험 없음.

## Consequences

### Positive

- 모든 단일 라인 flex 컨테이너(ToggleButtonGroup 외 다수)의 cross size 발산 근본 해소 — CSS §8.4 정합.
- 엔진 일반 수정이라 컴포넌트별 workaround 불필요.

### Negative

- flex.rs 코어 파일 수정(회귀 표면). 테스트로 격리하지만 리뷰 주의 필요.
