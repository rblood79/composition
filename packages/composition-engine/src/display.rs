//! ADR-916 Phase 2-A — CSS Display 변환 (순수 display 문자열 계층)
//!
//! `apps/builder/.../layout/engines/taffyDisplayAdapter.ts` 의 **자기완결 순수**
//! display 문자열 변환 계층 이식. CSS Display Level 3 이원 구조(outer/inner) 파싱 +
//! blockification + inline-level 판정 + 자식 display 분류. 전부 문자열 in/out.
//! (ADR-916 Phase 2-A `taffyDisplayAdapter.ts` 이관의 첫 착수 단위.)
//!
//! Dropflow 원본(`packages/layout-flow/`) 의 검증된 Display 타입 시스템 기반.
//! CSS Display Level 3 two-value display syntax(<https://www.w3.org/TR/css-display-3/>).
//!
//! ## 미이식 (다음 단위 / JS 잔류)
//!
//! - `getElementDisplay` — `INLINE_BLOCK_TAGS`(utils.ts, 컴포넌트 tag 도메인 지식)
//!   의존. tag 분류 SSOT 이중화 회피 위해 이번 단위 제외 (cascade `resolveFontStretchWidth`
//!   와 동일 패턴 — tag/spec 도메인 데이터 참조 계약 확정 후).
//! - `needsBlockChildFullWidth` / `toTaffyDisplay` 의 childElements 경로 —
//!   `CanvasLayoutNode` 자식 배열 순회 의존. tree.rs(2-B) 노드 계약과 함께 이관.
//! - `VERTICAL_ALIGN_MIDDLE_TAGS` — tag Set (tag 도메인, 위와 동일 사유).

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

/// 자식 요소 display 분류 (Dropflow `classifyChild()` 패턴, 'replaced' 제외).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ChildDisplayClass {
    Block,
    Inline,
    None,
}

/// CSS display 문자열을 [`Display`] 이원 구조로 파싱 (taffyDisplayAdapter.ts:274 `parseDisplay`).
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

/// [`Display`] 이원 구조를 CSS display 문자열로 역변환 (taffyDisplayAdapter.ts:310 `displayToString`).
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

/// 자식 display 분류 (taffyDisplayAdapter.ts:334 `classifyChildDisplay`, Dropflow classifyChild).
///
/// none → None. outer:inline + inner:{flow|flow-root} → Inline (IFC 참여).
/// inline-flex/inline-grid(inner:flex|grid) 는 Block (Taffy native 경로).
pub fn classify_child_display(display: &str) -> ChildDisplayClass {
    let parsed = parse_display(Some(display));
    if parsed.outer == OuterDisplay::None {
        return ChildDisplayClass::None;
    }
    if parsed.outer == OuterDisplay::Inline
        && (parsed.inner == InnerDisplay::Flow || parsed.inner == InnerDisplay::FlowRoot)
    {
        return ChildDisplayClass::Inline;
    }
    ChildDisplayClass::Block
}

/// CSS Display Level 3 Blockification (taffyDisplayAdapter.ts:374 `blockifyDisplay`).
///
/// outer:inline → outer:block 으로만 변환하고 inner 유지 (Dropflow `Style.blockify()`).
/// outer:block 이면 원본 문자열 그대로 반환.
///
/// - inline(inline+flow) → block / inline-block(inline+flow-root) → flow-root
/// - inline-flex → flex / inline-grid → grid
pub fn blockify_display(display: &str) -> String {
    let parsed = parse_display(Some(display));
    if parsed.outer == OuterDisplay::Inline {
        return display_to_string(Display { outer: OuterDisplay::Block, inner: parsed.inner })
            .to_string();
    }
    display.to_string()
}

/// display 값이 inline-level 인지 판별 (taffyDisplayAdapter.ts:418 `isInlineLevel`).
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

    // ---- classify_child_display ----

    #[test]
    fn classify_child() {
        assert_eq!(classify_child_display("none"), ChildDisplayClass::None);
        assert_eq!(classify_child_display("inline"), ChildDisplayClass::Inline);
        assert_eq!(classify_child_display("inline-block"), ChildDisplayClass::Inline);
        assert_eq!(classify_child_display("block"), ChildDisplayClass::Block);
        assert_eq!(classify_child_display("flex"), ChildDisplayClass::Block);
        // inline-flex/inline-grid → block (Taffy native)
        assert_eq!(classify_child_display("inline-flex"), ChildDisplayClass::Block);
        assert_eq!(classify_child_display("inline-grid"), ChildDisplayClass::Block);
    }

    // ---- blockify_display ----

    #[test]
    fn blockify() {
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
