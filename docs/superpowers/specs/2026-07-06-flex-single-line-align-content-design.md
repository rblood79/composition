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

**사용자 결정(2026-07-06): "place_line_cross 리팩터"** — align-content 와 align-items stretch 를 완전히 독립시킨다. stretch_extra(라인 부풀리기)는 다중 라인 전용으로 되돌리고, 단일 라인 자식 stretch 는 `place_line_cross_axis` 가 `available_cross` 를 직접 참조해 처리.

### 수정 코드 — 2곳 분리

**(1) `align_content_offsets` — stretch_extra 를 다중 라인 전용으로**

`ALIGN_CONTENT_STRETCH` 분기가 `line_count <= 1` 이면 stretch_extra 0:

```rust
ALIGN_CONTENT_STRETCH => {
    if line_count <= 1 {
        // 단일 라인: align-content stretch 무효(CSS §8.4). 라인 부풀리기 없음 —
        // 자식 stretch 는 place_line_cross_axis 가 available_cross 로 별도 처리.
        (0.0, 0.0, 0.0)
    } else {
        let per_line = cross_free / line_count as f32;
        (0.0, 0.0, per_line)
    }
}
```

center/end/space-\* 도 단일 라인 무효(CSS §8.4). `flex_layout` 본체에서 `line_count<=1` 시 `cross_start_offset`/`cross_between_extra` 를 0 으로 강제(진입점 가드 병행):

```rust
let (mut cross_start_offset, mut cross_between_extra, stretch_extra) =
    align_content_offsets(align_content, cross_free, line_count);
if line_count <= 1 {
    // 단일 라인은 align-content 정렬(center/end/space-*) 전체 무효.
    cross_start_offset = 0.0;
    cross_between_extra = 0.0;
}
```

**(2) `place_line_cross_axis` — 단일 라인 자식 stretch 대상 = available_cross**

시그니처에 `available_cross: f32` + `single_line: bool` 인자 추가. `ALIGN_STRETCH if cross_is_auto` 분기가 대상 라인 cross 를 단일/다중으로 분기:

```rust
ALIGN_STRETCH if it.cross_is_auto => {
    // 단일 라인: 컨테이너 cross(available_cross) 로 stretch (CSS: 단일 라인 flex
    //   컨테이너의 라인 cross = 컨테이너 content cross).
    // 다중 라인: 소속 라인 cross(line_cross_size)로 stretch.
    let stretch_target = if single_line { available_cross } else { line_cross_size };
    let target_avail = (stretch_target - it.margin_cross_start - it.margin_cross_end).max(0.0);
    let stretched = clamp_size(target_avail, it.min_cross, it.max_cross);
    (it.margin_cross_start, stretched)
}
```

호출부(`flex_layout` 라인 루프)에서 `available_cross` 와 `line_count == 1` 전달. 다른 분기(CENTER/END/START)는 기존대로 `line_cross_size`/`cross_free` 기반 — 자식 위치만 결정하므로 무영향.

## 격리 — 건드리지 않는 것

| 경로                                                       | 이유                                                                                                                                     |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| **align-items CENTER/END/START** (`place_line_cross_axis`) | 자식을 라인 cross 내에서 정렬(크기 불변). 단일 라인이면 라인 cross=자식 max 라 제자리. ToggleButtonGroup(center) → 자식 y=0, 컨테이너=30 |
| **align-items STRETCH (다중 라인)**                        | `single_line=false` → `line_cross_size` 기준 stretch (기존 동작 유지)                                                                    |
| **다중 라인 align-content** (line_count > 1)               | stretch_extra/offset 모두 기존 경로 — wrap 시 라인 간 stretch/center/end/space-\* 정상                                                   |
| **main-axis** (justify_content)                            | 변경 없음                                                                                                                                |
| **box-sizing** (직전 작업, tree.rs spec_to_content)        | 무관                                                                                                                                     |

## 테스트 (TDD, cargo)

`packages/composition-engine/src/flex.rs` `#[cfg(test)]` 모듈. **핵심 = 두 stretch 를 분리 검증**: (a) 단일 라인 align-content stretch 는 라인을 안 부풀림, (b) 단일 라인 align-items stretch 는 여전히 컨테이너 cross 채움.

신규:

1. `single_line_align_content_stretch_does_not_expand_line` — row, 자식 1개 cross(height) **명시 30**, available_cross 764, align_items=**START**(stretch 아님), align_content=stretch(default) → 자식 height 30 유지, y=0. 라인이 764 로 안 부풀려짐(397 근원 차단). **원안이 통과시키고 새 설계도 통과 — 핵심 회귀 케이스.**
2. `single_line_align_content_center_does_not_offset` — 위 조건 + align_content=center → 자식 y=0 (단일 라인이므로 center offset 무효). available_cross 큼에도 중앙 이동 없음.
3. `single_line_align_items_center_child_stays_at_top` — align_items=**center** + 자식 height 명시 30, available_cross 764 → 자식 height 30, **y=0**(라인 cross=자식 30 이므로 라인 내 중앙=제자리). ToggleButtonGroup 실제 케이스.
4. `multi_line_align_content_stretch_still_expands` — wrap 발생 2라인, available_cross 큼 → 라인들이 stretch_extra 로 팽창(회귀 방지: 다중 라인 유지).

기존 회귀 방지 테스트(**변경 후 여전히 통과해야 함 — 새 설계의 성공 조건**):

- `stretch_still_fills_when_cross_auto` (line 1064): align_items=STRETCH + 자식 cross auto + available_cross 100 → 자식 100. **place_line_cross_axis 리팩터가 single_line 경로에서 available_cross(100)로 stretch 하므로 유지.** 원안(stretch_extra=0)은 이걸 0 으로 깨뜨렸을 것 — 이 테스트가 리팩터 방향의 근거.
- `align_stretch_fills_cross` (line 820): 동형, 유지.
- `stretch_respects_explicit_cross_size` (line 1051): align_items=STRETCH + 자식 cross **명시 30** → 30 유지(stretch 안 함, cross_is_auto=false). single_line 분기와 무관하게 유지.

tree.rs 통합 테스트:

5. `flex_column_parent_single_line_child_no_height_explosion` — body(column, height 764) > group(row, alignItems center, height 미지정) > 버튼(30) → group height = 30 (397 아님).

## 검증 체인

1. `cargo test -p composition-engine` — 신규 5 + 기존 240 PASS (기존 stretch 회귀 테스트 3종 포함 유지 확인)
2. `pnpm wasm:build:engine` — wasm 재빌드
3. `pnpm type-check` — 소스 정합
4. **live**: 브라우저 로드 wasm 실측(dual-run diff 0 은 이 케이스를 커버 못 함 — 아래) + Preview 대조. ToggleButtonGroup group height 397 → 30 확인.

### dual-run 한계 명시 (독립 oracle 의무)

기존 dual-run golden(N1~N6)은 **전부 단일 컨테이너**라 부모-큰-available_cross → 단일 라인 stretch 조건을 표현하지 못한다. 직전 box-sizing 작업에서 학습한 것과 동종 맹점(fixture 가 안 쓰는 입력 차원). 따라서:

- 신규 cargo 테스트가 **available_cross 를 라인 cross 보다 크게** 명시적으로 준 케이스를 커버(위 1,2,4)해 계약을 고정한다.
- live 는 실제 브라우저 CSS(30px) 대비로 확증 — 자체 엔진 단독이라 A↔B dual-run 무력, CSS 가 독립 oracle.

## 위험

| ID  | 위험                                                           | 심각도 | 대응                                                                                                                                                                                                            |
| --- | -------------------------------------------------------------- | :----: | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | `place_line_cross_axis` 시그니처 변경이 다중 라인 stretch 회귀 |  MED   | `single_line` false 경로는 기존 `line_cross_size` 그대로 → 다중 라인 무영향. 기존 회귀 테스트 3종(stretch_still_fills / align_stretch_fills / stretch_respects_explicit) 이 방어. 신규 4 가 다중 라인 유지 확인 |
| R2  | align-items STRETCH 자식 stretch 가 single 경로에서 잘못 계산  |  MED   | 단일 라인 stretch 대상 = `available_cross`(tree.rs 가 자식 content-box available 전달). 기존 `stretch_still_fills_when_cross_auto`(100) 가 정확값 고정. clamp(min/max_cross) 순서 기존 유지                     |
| R3  | 기존 dual-run golden 이 이 변경으로 diff 발생                  |  LOW   | golden N1~N6 전부 단일 컨테이너지만 available_cross 를 라인보다 크게 주는 형상 없음 → base 에서도 stretch_extra 무의미. 재빌드 후 golden 재실행으로 확증                                                        |
| R4  | 단일 라인 판정 경계(0/1 라인)                                  |  LOW   | `line_count <= 1` 이 0 과 1 모두 포함. 0 라인(자식 없음)은 count==0 조기 반환으로 도달 안 함                                                                                                                    |

잔존 HIGH 위험 없음.

## Consequences

### Positive

- 모든 단일 라인 flex 컨테이너(ToggleButtonGroup 외 다수)의 cross size 발산 근본 해소 — CSS §8.4 정합.
- 엔진 일반 수정이라 컴포넌트별 workaround 불필요.

### Negative

- flex.rs 코어 파일 수정(회귀 표면). 테스트로 격리하지만 리뷰 주의 필요.
