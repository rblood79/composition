//! ADR-916 Phase 2-A — CSS Display 변환 (순수 display 문자열 계층)
//!
//! `apps/builder/.../layout/engines/displayAdapter.ts` 의 **자기완결 순수**
//! display 문자열 변환 계층 이식. CSS Display Level 3 이원 구조(outer/inner) 파싱 +
//! blockification + inline-level / atomic inline-level 판정. (구 자식 display 분류
//! `classify_child_display` 는 ADR-923 Phase 1 에서 삭제 — inline-flex 를 Block 으로
//! 분류해 line item 판정에 쓸 수 없었다.)
//!
//! Dropflow 원본(`packages/layout-flow/`) 의 검증된 Display 타입 시스템 기반.
//! CSS Display Level 3 two-value display syntax(<https://www.w3.org/TR/css-display-3/>).
//!
//! ## 배선 (ADR-923 Phase 1, 2026-09-01)
//!
//! tree.rs 가 이 모듈을 **소비**한다 — display 이원 계약 (outer → 부모의 line item 판정,
//! inner → 자기 solver):
//!
//! - `tree.rs classify_container_display` → `parse_display(d).inner` (Flex/Grid/그 외 Block).
//! - `tree.rs write_block_item` display code → [`is_atomic_inline_level`] (inline-block ·
//!   inline-flex · inline-grid 가 block 부모의 line item). 순수 `inline`(inner=flow) 은
//!   S4(B 갈래) 까지 block 격상 유지.
//! - `tree.rs solve_node` → 부모가 flex/grid 컨테이너면 [`blockify`] (CSS Display 3 §2.7 —
//!   blockify 는 엔진만 한다; TS 쪽 대응물은 Phase 5 에서 삭제).
//! - `tree.rs node_establishes_bfc` → `inner ∈ {Flex, Grid}`.
//!
//! ## 경계 계약 (ADR-923 Phase 5 cutover, 2026-09-02)
//!
//! TS 는 CSS display 값을 **그대로** 보낸다 — `displayAdapter.ts normalizeCssDisplay` 가
//! 인식 값 8 종 (block · inline · inline-block · flex · inline-flex · grid · inline-grid ·
//! none) 을 손실 없이 운반하고 미인식만 block 으로 접는다 ([`parse_display`] 의 폴백과 같다).
//! 종전 TS IFC 시뮬레이션 (block 부모 + inline-level 자식 → flex row wrap 합성, inline-block
//! 크기 고정 leaf, block 형제 width:100% 보정, TS blockify, inline-flex → flex 정규화) 은 전부
//! 삭제됐고 이 모듈 + `block.rs` line box + `tree.rs` blockify 가 그 자리를 맡는다.
//!
//! ## JS 잔류 (엔진 이관 대상 아님)
//!
//! - 기본 display 해석 `getElementDisplay` → `resolveDefaultDisplay` (`defaultDisplay.ts` —
//!   catalog 파생 → 손 목록 → block). 컴포넌트 tag 도메인 지식이라 TS 에 남는다.
//! - `toEngineDisplay(display, childDisplays)` — `normalizeCssDisplay` 만 감싼 운반 함수.
//!   `childDisplays` 는 HC1 게이트의 관측 인자.

/// 요소의 외부 display 타입 (CSS Display Level 3 outer display).
///
/// `packages/layout-flow/src/types.ts:47` OuterDisplay 대응.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum OuterDisplay {
    /// 부모의 inline formatting context 참여
    Inline,
    /// 부모의 block formatting context 참여
    Block,
    /// 레이아웃에서 제외
    None,
}

/// 요소의 내부 display 타입 (CSS Display Level 3 inner display).
///
/// Dropflow 원본은 flow/flow-root/none (block-only) 만 지원. Taffy adapter 는
/// flex/grid 도 처리하므로 확장. `types.ts:48` InnerDisplay 대응.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum InnerDisplay {
    /// normal flow (BFC 또는 IFC)
    Flow,
    /// 새 BFC 생성 (inline-block, overflow:hidden 등)
    FlowRoot,
    /// flex formatting context
    Flex,
    /// grid formatting context
    Grid,
    /// 레이아웃에서 제외
    None,
}

/// CSS Display Level 3 이원 display 구조 (`{ outer, inner }`).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Display {
    pub outer: OuterDisplay,
    pub inner: InnerDisplay,
}

/// CSS display 문자열을 [`Display`] 이원 구조로 파싱 (displayAdapter.ts:274 `parseDisplay`).
///
/// 9종 매핑 + 미인식 값은 `{ block, flow }` 폴백 (원본 DEV 경고는 부수효과라 생략).
/// `None`/빈 문자열/공백도 미인식 → block 폴백 (원본 `value?.trim().toLowerCase()` default).
pub fn parse_display(value: Option<&str>) -> Display {
    let key = value.map(|v| v.trim().to_ascii_lowercase());
    match key.as_deref() {
        Some("block") => Display { outer: OuterDisplay::Block, inner: InnerDisplay::Flow },
        Some("inline") => Display { outer: OuterDisplay::Inline, inner: InnerDisplay::Flow },
        Some("inline-block") => {
            Display { outer: OuterDisplay::Inline, inner: InnerDisplay::FlowRoot }
        }
        Some("flow-root") => {
            Display { outer: OuterDisplay::Block, inner: InnerDisplay::FlowRoot }
        }
        Some("flex") => Display { outer: OuterDisplay::Block, inner: InnerDisplay::Flex },
        Some("inline-flex") => {
            Display { outer: OuterDisplay::Inline, inner: InnerDisplay::Flex }
        }
        Some("grid") => Display { outer: OuterDisplay::Block, inner: InnerDisplay::Grid },
        Some("inline-grid") => {
            Display { outer: OuterDisplay::Inline, inner: InnerDisplay::Grid }
        }
        Some("none") => Display { outer: OuterDisplay::None, inner: InnerDisplay::None },
        _ => Display { outer: OuterDisplay::Block, inner: InnerDisplay::Flow },
    }
}

/// [`Display`] 이원 구조를 CSS display 문자열로 역변환 (displayAdapter.ts:310 `displayToString`).
///
/// `parse_display` 의 역함수. 원본 분기 순서 그대로.
pub fn display_to_string(d: Display) -> &'static str {
    if d.outer == OuterDisplay::None {
        return "none";
    }
    match d.inner {
        InnerDisplay::Flex => {
            if d.outer == OuterDisplay::Inline {
                "inline-flex"
            } else {
                "flex"
            }
        }
        InnerDisplay::Grid => {
            if d.outer == OuterDisplay::Inline {
                "inline-grid"
            } else {
                "grid"
            }
        }
        InnerDisplay::FlowRoot => {
            if d.outer == OuterDisplay::Inline {
                "inline-block"
            } else {
                "flow-root"
            }
        }
        // inner === flow (또는 None — outer!=None 이면 도달 안 함, 원본 default 경로)
        _ => {
            if d.outer == OuterDisplay::Inline {
                "inline"
            } else {
                "block"
            }
        }
    }
}

/// CSS Display Level 3 §2.7 Blockification — outer:inline → outer:block, inner 유지
/// (Dropflow `Style.blockify()`). flex/grid 컨테이너의 자식은 solver 진입 시 이 변환을
/// 받는다 (tree.rs `solve_node`, ADR-923 Phase 1). outer:block/none 은 그대로.
pub fn blockify(d: Display) -> Display {
    if d.outer == OuterDisplay::Inline {
        Display { outer: OuterDisplay::Block, inner: d.inner }
    } else {
        d
    }
}

/// 문자열 판 [`blockify`] (TS `blockifyDisplay` 는 ADR-923 Phase 5 에서 삭제 — 엔진 판만 남았다).
///
/// - inline(inline+flow) → block / inline-block(inline+flow-root) → flow-root
/// - inline-flex → flex / inline-grid → grid
/// - outer:block 이면 원본 문자열 그대로 반환.
pub fn blockify_display(display: &str) -> String {
    let parsed = parse_display(Some(display));
    if parsed.outer == OuterDisplay::Inline {
        return display_to_string(blockify(parsed)).to_string();
    }
    display.to_string()
}

/// block 부모의 **line box item** 인가 — CSS 2.1 §9.2.2 atomic inline-level box:
/// outer=inline ∧ inner∈{flow-root, flex, grid} (inline-block · inline-flex · inline-grid).
///
/// 순수 `inline`(inner=flow) 은 **false** — 엔진은 요소 단위 inline 혼합(텍스트 run 과 섞이는
/// IFC) 을 지원하지 않으므로 S4(ADR-923 B 갈래) 까지 block 격상을 유지한다 (breakdown
/// Phase 1 · r2 l4). `none` 도 false (부모가 layout 비참여로 따로 처리).
///
/// tree.rs `write_block_item` 의 display code (1=line item) 가 이 판정을 쓴다 — 이전에는
/// 문자열 `"inline-block"` 만 1 이었다.
pub fn is_atomic_inline_level(d: Display) -> bool {
    d.outer == OuterDisplay::Inline
        && matches!(d.inner, InnerDisplay::FlowRoot | InnerDisplay::Flex | InnerDisplay::Grid)
}

/// display 값이 inline-level 인지 판별 (displayAdapter.ts:418 `isInlineLevel`).
///
/// CSS 명세: inline-level box = outer display type 이 inline 인 box.
pub fn is_inline_level(display: &str) -> bool {
    parse_display(Some(display)).outer == OuterDisplay::Inline
}

#[cfg(test)]
mod tests {
    use super::*;

    // ---- parse_display ----

    #[test]
    fn parse_all_known() {
        assert_eq!(
            parse_display(Some("block")),
            Display { outer: OuterDisplay::Block, inner: InnerDisplay::Flow }
        );
        assert_eq!(
            parse_display(Some("inline-block")),
            Display { outer: OuterDisplay::Inline, inner: InnerDisplay::FlowRoot }
        );
        assert_eq!(
            parse_display(Some("inline-flex")),
            Display { outer: OuterDisplay::Inline, inner: InnerDisplay::Flex }
        );
        assert_eq!(
            parse_display(Some("grid")),
            Display { outer: OuterDisplay::Block, inner: InnerDisplay::Grid }
        );
        assert_eq!(
            parse_display(Some("none")),
            Display { outer: OuterDisplay::None, inner: InnerDisplay::None }
        );
    }

    #[test]
    fn parse_trim_and_case_insensitive() {
        assert_eq!(
            parse_display(Some("  FLEX  ")),
            Display { outer: OuterDisplay::Block, inner: InnerDisplay::Flex }
        );
    }

    #[test]
    fn parse_unknown_and_none_fallback_block() {
        let block_flow = Display { outer: OuterDisplay::Block, inner: InnerDisplay::Flow };
        assert_eq!(parse_display(Some("bogus")), block_flow);
        assert_eq!(parse_display(Some("")), block_flow);
        assert_eq!(parse_display(Some("   ")), block_flow);
        assert_eq!(parse_display(None), block_flow);
    }

    // ---- display_to_string (round-trip) ----

    #[test]
    fn display_to_string_roundtrip() {
        for s in [
            "block",
            "inline",
            "inline-block",
            "flow-root",
            "flex",
            "inline-flex",
            "grid",
            "inline-grid",
            "none",
        ] {
            let d = parse_display(Some(s));
            assert_eq!(display_to_string(d), s, "roundtrip failed for {s}");
        }
    }

    // ---- blockify (Display) ----

    #[test]
    fn blockify_keeps_inner_and_forces_outer_block() {
        for (s, inner) in [
            ("inline", InnerDisplay::Flow),
            ("inline-block", InnerDisplay::FlowRoot),
            ("inline-flex", InnerDisplay::Flex),
            ("inline-grid", InnerDisplay::Grid),
        ] {
            let b = blockify(parse_display(Some(s)));
            assert_eq!(b, Display { outer: OuterDisplay::Block, inner }, "{s}");
        }
        for s in ["block", "flow-root", "flex", "grid", "none"] {
            let d = parse_display(Some(s));
            assert_eq!(blockify(d), d, "{s} 는 그대로");
        }
    }

    // ---- is_atomic_inline_level ----

    #[test]
    fn atomic_inline_level_is_inline_outer_with_non_flow_inner() {
        for s in ["inline-block", "inline-flex", "inline-grid"] {
            assert!(is_atomic_inline_level(parse_display(Some(s))), "{s} → line item");
        }
        // 순수 inline 은 S4 까지 block 격상 (false), block-level 전부 false, none false.
        for s in ["inline", "block", "flow-root", "flex", "grid", "none", "bogus"] {
            assert!(!is_atomic_inline_level(parse_display(Some(s))), "{s} → not line item");
        }
        assert!(!is_atomic_inline_level(parse_display(None)));
    }

    // ---- blockify_display ----

    #[test]
    fn blockify_display_strings() {
        assert_eq!(blockify_display("inline"), "block");
        assert_eq!(blockify_display("inline-block"), "flow-root");
        assert_eq!(blockify_display("inline-flex"), "flex");
        assert_eq!(blockify_display("inline-grid"), "grid");
        // outer:block 은 원본 그대로
        assert_eq!(blockify_display("block"), "block");
        assert_eq!(blockify_display("flex"), "flex");
        assert_eq!(blockify_display("grid"), "grid");
        assert_eq!(blockify_display("none"), "none");
    }

    // ---- is_inline_level ----

    #[test]
    fn inline_level() {
        assert!(is_inline_level("inline"));
        assert!(is_inline_level("inline-block"));
        assert!(is_inline_level("inline-flex"));
        assert!(is_inline_level("inline-grid"));
        assert!(!is_inline_level("block"));
        assert!(!is_inline_level("flex"));
        assert!(!is_inline_level("grid"));
        assert!(!is_inline_level("none"));
    }
}
