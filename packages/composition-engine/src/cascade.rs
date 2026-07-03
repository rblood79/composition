//! ADR-916 Phase 2-A — CSS Cascade Resolver (순수 캐스케이드 헬퍼 계층)
//!
//! `apps/builder/.../layout/engines/cssResolver.ts` 의 **자기완결 순수** 계층 이식.
//! 상속 규칙 테이블 / 초기값 맵 / cascade 키워드(inherit/initial/unset/revert) /
//! currentColor 토큰 치환 / font-variant → OpenType feature / 논리→물리 속성 변환.
//! (ADR-916 Phase 2-A `cssResolver.ts` 이관의 첫 착수 단위.)
//!
//! ## 미이식 (다음 단위 / JS 잔류)
//!
//! - `getRootComputedStyle` / `ROOT_COMPUTED_STYLE` — `useThemeConfigStore.getState()`
//!   store 의존. WASM 경계 밖 → JS 가 root computed style 을 계산해 넘긴다.
//! - `resolveFontStretchWidth` — `@composition/specs` `FONT_STRETCH_KEYWORD_MAP`
//!   (ADR-091 spec SSOT) 의존. Rust crate 의 spec 데이터 참조 계약이 아직 없어
//!   이번 단위에서 제외(spec SSOT 이중화 회피). 후속 단위에서 참조 계약 확정 후 이식.
//! - `resolveStyle` 본체 — 위 순수 헬퍼들이 이식된 뒤 조립하는 캐스케이드 진입점.
//!   다음 단위.

use std::collections::BTreeMap;

/// CSS 값 — 문자열 또는 숫자 (JS `string | number | unknown` 대응).
///
/// cssResolver 의 style 값은 string/number 혼합이라 enum 으로 표현. `Other` 는
/// 파싱 대상 아닌 값(객체 등)의 passthrough — JS 의 `typeof value !== "string"` 조기 반환 대응.
#[derive(Debug, Clone, PartialEq)]
pub enum CssValue {
    Str(String),
    Num(f32),
}

impl CssValue {
    /// 문자열이면 `&str`, 아니면 `None` (JS `typeof value === "string"` 가드 대응).
    pub fn as_str(&self) -> Option<&str> {
        match self {
            CssValue::Str(s) => Some(s),
            CssValue::Num(_) => None,
        }
    }
}

impl From<&str> for CssValue {
    fn from(s: &str) -> Self {
        CssValue::Str(s.to_string())
    }
}
impl From<String> for CssValue {
    fn from(s: String) -> Self {
        CssValue::Str(s)
    }
}
impl From<f32> for CssValue {
    fn from(n: f32) -> Self {
        CssValue::Num(n)
    }
}

/// CSS 명세에서 기본 상속되는 속성인지 판정 (cssResolver.ts:34 `INHERITABLE_PROPERTIES`).
pub fn is_inheritable_property(prop: &str) -> bool {
    matches!(
        prop,
        "color"
            | "fontSize"
            | "fontFamily"
            | "fontWeight"
            | "fontStyle"
            | "fontVariant"
            | "fontStretch"
            | "lineHeight"
            | "letterSpacing"
            | "wordSpacing"
            | "textAlign"
            | "textTransform"
            | "textIndent"
            | "visibility"
            | "wordBreak"
            | "overflowWrap"
            | "whiteSpace"
    )
}

/// CSS 속성 초기값 조회 (cssResolver.ts:66 `CSS_INITIAL_VALUES`). 미정의 → `None`.
pub fn css_initial_value(prop: &str) -> Option<CssValue> {
    let v: CssValue = match prop {
        // 상속 속성
        "color" => "#000000".into(),
        "fontSize" => 16.0.into(),
        "fontWeight" => "400".into(),
        "fontStyle" => "normal".into(),
        "fontFamily" => "sans-serif".into(),
        "fontVariant" => "normal".into(),
        "fontStretch" => "normal".into(),
        "textAlign" => "start".into(),
        "textDecoration" => "none".into(),
        "textTransform" => "none".into(),
        "letterSpacing" => 0.0.into(),
        "wordSpacing" => 0.0.into(),
        "lineHeight" => "normal".into(),
        "textIndent" => 0.0.into(),
        "visibility" => "visible".into(),
        "whiteSpace" => "normal".into(),
        "wordBreak" => "normal".into(),
        "overflowWrap" => "normal".into(),
        // 비상속 속성
        "backgroundColor" => "transparent".into(),
        "borderColor" => "#000000".into(),
        "borderWidth" => 0.0.into(),
        "borderTopWidth" => 0.0.into(),
        "borderRightWidth" => 0.0.into(),
        "borderBottomWidth" => 0.0.into(),
        "borderLeftWidth" => 0.0.into(),
        "borderRadius" => 0.0.into(),
        "borderStyle" => "none".into(),
        "margin" => 0.0.into(),
        "marginTop" => 0.0.into(),
        "marginRight" => 0.0.into(),
        "marginBottom" => 0.0.into(),
        "marginLeft" => 0.0.into(),
        "padding" => 0.0.into(),
        "paddingTop" => 0.0.into(),
        "paddingRight" => 0.0.into(),
        "paddingBottom" => 0.0.into(),
        "paddingLeft" => 0.0.into(),
        "opacity" => 1.0.into(),
        "display" => "inline".into(),
        "position" => "static".into(),
        "overflow" => "visible".into(),
        "textDecorationColor" => "currentColor".into(),
        "outlineColor" => "invert".into(),
        "zIndex" => "auto".into(),
        _ => return None,
    };
    Some(v)
}

/// OpenType feature 태그 (cssResolver.ts:136 `FontFeatureTag`).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct FontFeatureTag {
    pub name: &'static str,
    pub value: u32,
}

/// `:root` 기본 OpenType features (cssResolver.ts:173 `DEFAULT_FONT_FEATURES`).
///
/// App.css `--default-font-feature-settings: "cv02","cv03","cv04","cv11"`.
/// CanvasKit 은 CSS 상속을 안 하므로 명시 전달 필요.
pub const DEFAULT_FONT_FEATURES: [FontFeatureTag; 4] = [
    FontFeatureTag { name: "cv02", value: 1 },
    FontFeatureTag { name: "cv03", value: 1 },
    FontFeatureTag { name: "cv04", value: 1 },
    FontFeatureTag { name: "cv11", value: 1 },
];

/// font-variant → OpenType feature 매핑 (cssResolver.ts:160 `resolveFontVariantFeatures`).
///
/// `normal` / 빈 문자열 / 미매핑 → 빈 벡터.
pub fn resolve_font_variant_features(font_variant: &str) -> Vec<FontFeatureTag> {
    let lower = font_variant.trim().to_ascii_lowercase();
    match lower.as_str() {
        "normal" | "" => vec![],
        "small-caps" => vec![FontFeatureTag { name: "smcp", value: 1 }],
        "all-small-caps" => vec![
            FontFeatureTag { name: "smcp", value: 1 },
            FontFeatureTag { name: "c2sc", value: 1 },
        ],
        "petite-caps" => vec![FontFeatureTag { name: "pcap", value: 1 }],
        "all-petite-caps" => vec![
            FontFeatureTag { name: "pcap", value: 1 },
            FontFeatureTag { name: "c2pc", value: 1 },
        ],
        "unicase" => vec![FontFeatureTag { name: "unic", value: 1 }],
        "titling-caps" => vec![FontFeatureTag { name: "titl", value: 1 }],
        "oldstyle-nums" => vec![FontFeatureTag { name: "onum", value: 1 }],
        "lining-nums" => vec![FontFeatureTag { name: "lnum", value: 1 }],
        "tabular-nums" => vec![FontFeatureTag { name: "tnum", value: 1 }],
        "proportional-nums" => vec![FontFeatureTag { name: "pnum", value: 1 }],
        _ => vec![],
    }
}

/// currentColor 키워드 치환 (cssResolver.ts:320 `resolveCurrentColor`).
///
/// 값에 `currentColor`(대소문자 무관) 미포함 → 원본. 전체가 currentColor → resolved_color.
/// box-shadow 등 복합 값의 `currentColor` 토큰 각각 치환(단어 경계).
pub fn resolve_current_color(value: &str, resolved_color: &str) -> String {
    let lower = value.to_ascii_lowercase();
    if !lower.contains("currentcolor") {
        return value.to_string();
    }
    if lower == "currentcolor" {
        return resolved_color.to_string();
    }
    // \bcurrentColor\b 단어 경계 치환 (대소문자 무관). CSS 식별자 경계 = 영숫자/'-'/'_'.
    replace_word_ci(value, "currentcolor", resolved_color)
}

/// 단어 경계 기준 대소문자 무관 치환 — JS `/\bcurrentColor\b/gi` 근사.
///
/// CSS 식별자 문자(영숫자/`-`/`_`)로 둘러싸이지 않은 `needle`(소문자) 매칭만 치환.
fn replace_word_ci(haystack: &str, needle_lower: &str, replacement: &str) -> String {
    let hay_lower = haystack.to_ascii_lowercase();
    let hb = hay_lower.as_bytes();
    let nlen = needle_lower.len();
    let mut out = String::with_capacity(haystack.len());
    let mut i = 0;
    let bytes = haystack.as_bytes();
    while i < bytes.len() {
        if i + nlen <= hb.len() && &hay_lower[i..i + nlen] == needle_lower {
            let before_ok = i == 0 || !is_ident_byte(hb[i - 1]);
            let after_ok = i + nlen >= hb.len() || !is_ident_byte(hb[i + nlen]);
            if before_ok && after_ok {
                out.push_str(replacement);
                i += nlen;
                continue;
            }
        }
        // UTF-8 안전: 현재 문자 전체를 복사
        let ch_len = utf8_char_len(bytes[i]);
        out.push_str(&haystack[i..i + ch_len]);
        i += ch_len;
    }
    out
}

#[inline]
fn is_ident_byte(b: u8) -> bool {
    b.is_ascii_alphanumeric() || b == b'-' || b == b'_'
}

#[inline]
fn utf8_char_len(first: u8) -> usize {
    if first < 0x80 {
        1
    } else if first >> 5 == 0b110 {
        2
    } else if first >> 4 == 0b1110 {
        3
    } else {
        4
    }
}

/// cascade 키워드 해석 결과 (cssResolver.ts:355 `resolveCascadeKeyword`).
#[derive(Debug, Clone, PartialEq)]
pub enum CascadeResult {
    /// `inherit` (또는 상속 속성의 `unset`) — 호출자가 부모 값 유지 (INHERIT_SENTINEL).
    Inherit,
    /// 해석된 값 (initial/revert/unset-initial 또는 키워드 아닌 원본 값).
    Value(CssValue),
}

/// CSS cascade 키워드를 해석 (cssResolver.ts:355 `resolveCascadeKeyword`).
///
/// - `inherit` → `Inherit`
/// - `initial`/`revert` → 초기값(없으면 원본)
/// - `unset` → 상속 속성이면 `Inherit`, 아니면 초기값(없으면 원본)
/// - 그 외/비문자열 → 원본 값
pub fn resolve_cascade_keyword(prop: &str, value: &CssValue) -> CascadeResult {
    let s = match value.as_str() {
        Some(s) => s,
        None => return CascadeResult::Value(value.clone()),
    };
    let lower = s.to_ascii_lowercase();
    match lower.as_str() {
        "inherit" => CascadeResult::Inherit,
        "initial" | "revert" => {
            CascadeResult::Value(css_initial_value(prop).unwrap_or_else(|| value.clone()))
        }
        "unset" => {
            if is_inheritable_property(prop) {
                CascadeResult::Inherit
            } else {
                CascadeResult::Value(css_initial_value(prop).unwrap_or_else(|| value.clone()))
            }
        }
        _ => CascadeResult::Value(value.clone()),
    }
}

/// 논리 속성(camelCase) → 물리 속성 매핑 (cssResolver.ts:400 `LOGICAL_TO_PHYSICAL`, LTR).
fn logical_to_physical(key: &str) -> Option<&'static str> {
    let p = match key {
        "marginInlineStart" => "marginLeft",
        "marginInlineEnd" => "marginRight",
        "marginBlockStart" => "marginTop",
        "marginBlockEnd" => "marginBottom",
        "paddingInlineStart" => "paddingLeft",
        "paddingInlineEnd" => "paddingRight",
        "paddingBlockStart" => "paddingTop",
        "paddingBlockEnd" => "paddingBottom",
        "borderInlineStartWidth" => "borderLeftWidth",
        "borderInlineEndWidth" => "borderRightWidth",
        "borderBlockStartWidth" => "borderTopWidth",
        "borderBlockEndWidth" => "borderBottomWidth",
        "borderInlineStartColor" => "borderLeftColor",
        "borderInlineEndColor" => "borderRightColor",
        "borderBlockStartColor" => "borderTopColor",
        "borderBlockEndColor" => "borderBottomColor",
        "borderInlineStartStyle" => "borderLeftStyle",
        "borderInlineEndStyle" => "borderRightStyle",
        "borderBlockStartStyle" => "borderTopStyle",
        "borderBlockEndStyle" => "borderBottomStyle",
        "insetInlineStart" => "left",
        "insetInlineEnd" => "right",
        "insetBlockStart" => "top",
        "insetBlockEnd" => "bottom",
        "inlineSize" => "width",
        "blockSize" => "height",
        "minInlineSize" => "minWidth",
        "maxInlineSize" => "maxWidth",
        "minBlockSize" => "minHeight",
        "maxBlockSize" => "maxHeight",
        _ => return None,
    };
    Some(p)
}

/// 논리 shorthand → [start 물리, end 물리] (cssResolver.ts:445 `LOGICAL_SHORTHAND_TO_PHYSICAL`).
fn logical_shorthand_to_physical(key: &str) -> Option<(&'static str, &'static str)> {
    let p = match key {
        "insetInline" => ("left", "right"),
        "insetBlock" => ("top", "bottom"),
        "marginInline" => ("marginLeft", "marginRight"),
        "marginBlock" => ("marginTop", "marginBottom"),
        "paddingInline" => ("paddingLeft", "paddingRight"),
        "paddingBlock" => ("paddingTop", "paddingBottom"),
        _ => return None,
    };
    Some(p)
}

/// 논리 shorthand key 반복 순서 (cssResolver.ts:445 정의 순서 — 결정성 유지용).
const SHORTHAND_KEYS: [&str; 6] = [
    "insetInline",
    "insetBlock",
    "marginInline",
    "marginBlock",
    "paddingInline",
    "paddingBlock",
];

/// 단일 논리 속성 key 반복 순서 (cssResolver.ts:400 정의 순서).
const LOGICAL_KEYS: [&str; 30] = [
    "marginInlineStart",
    "marginInlineEnd",
    "marginBlockStart",
    "marginBlockEnd",
    "paddingInlineStart",
    "paddingInlineEnd",
    "paddingBlockStart",
    "paddingBlockEnd",
    "borderInlineStartWidth",
    "borderInlineEndWidth",
    "borderBlockStartWidth",
    "borderBlockEndWidth",
    "borderInlineStartColor",
    "borderInlineEndColor",
    "borderBlockStartColor",
    "borderBlockEndColor",
    "borderInlineStartStyle",
    "borderInlineEndStyle",
    "borderBlockStartStyle",
    "borderBlockEndStyle",
    "insetInlineStart",
    "insetInlineEnd",
    "insetBlockStart",
    "insetBlockEnd",
    "inlineSize",
    "blockSize",
    "minInlineSize",
    "maxInlineSize",
    "minBlockSize",
    "maxBlockSize",
];

/// CSS Logical Properties → 물리 속성 변환 (cssResolver.ts:464 `resolveLogicalProperties`, LTR).
///
/// - 물리 속성이 이미 있으면 논리 속성 무시(물리 우선).
/// - shorthand: 공백 2값이면 start/end 각각, 단일값이면 양쪽.
/// - 원본 map 은 수정하지 않고 새 map 반환. 논리 key 없으면 clone 반환.
///
/// `BTreeMap` 사용 — key 순회 결정성(원본 JS 는 삽입 순서 의존이지만 물리 속성 우선
/// 규칙 + shorthand→단일 순서로 결과가 순서 독립. 정의 순서 상수로 원본 반복 순서 재현).
pub fn resolve_logical_properties(
    style: &BTreeMap<String, CssValue>,
) -> BTreeMap<String, CssValue> {
    let has_logical = style
        .keys()
        .any(|k| logical_to_physical(k).is_some() || logical_shorthand_to_physical(k).is_some());
    if !has_logical {
        return style.clone();
    }

    let mut result = style.clone();

    // shorthand 처리 (정의 순서)
    for logical_key in SHORTHAND_KEYS {
        let (phys_start, phys_end) = match logical_shorthand_to_physical(logical_key) {
            Some(p) => p,
            None => continue,
        };
        let raw = match result.remove(logical_key) {
            Some(v) => v,
            None => continue,
        };
        // 공백 구분 두 값 여부 (원본 cssResolver.ts:483 `raw.trim().includes(" ")` — 스페이스 기준)
        if let CssValue::Str(s) = &raw {
            let trimmed = s.trim();
            if trimmed.contains(' ') {
                // 원본 split(/\s+/) — 연속 공백을 하나로 취급
                let mut parts = trimmed.split_whitespace();
                let start_val = parts.next().unwrap_or("").to_string();
                let end_val = parts.next().unwrap_or("").to_string();
                result
                    .entry(phys_start.to_string())
                    .or_insert(CssValue::Str(start_val));
                result
                    .entry(phys_end.to_string())
                    .or_insert(CssValue::Str(end_val));
                continue;
            }
        }
        // 단일 값 → 양쪽
        result
            .entry(phys_start.to_string())
            .or_insert_with(|| raw.clone());
        result.entry(phys_end.to_string()).or_insert(raw);
    }

    // 단일 논리 속성 처리 (정의 순서)
    for logical_key in LOGICAL_KEYS {
        let phys_key = match logical_to_physical(logical_key) {
            Some(p) => p,
            None => continue,
        };
        let raw = match result.remove(logical_key) {
            Some(v) => v,
            None => continue,
        };
        result.entry(phys_key.to_string()).or_insert(raw);
    }

    result
}

#[cfg(test)]
mod tests {
    use super::*;

    fn m(pairs: &[(&str, CssValue)]) -> BTreeMap<String, CssValue> {
        pairs.iter().map(|(k, v)| (k.to_string(), v.clone())).collect()
    }

    // ---- inheritable / initial ----

    #[test]
    fn inheritable_properties() {
        assert!(is_inheritable_property("color"));
        assert!(is_inheritable_property("fontSize"));
        assert!(is_inheritable_property("whiteSpace"));
        assert!(!is_inheritable_property("margin"));
        assert!(!is_inheritable_property("backgroundColor"));
        assert!(!is_inheritable_property("unknownProp"));
    }

    #[test]
    fn initial_values() {
        assert_eq!(css_initial_value("color"), Some(CssValue::Str("#000000".into())));
        assert_eq!(css_initial_value("fontSize"), Some(CssValue::Num(16.0)));
        assert_eq!(css_initial_value("opacity"), Some(CssValue::Num(1.0)));
        assert_eq!(css_initial_value("display"), Some(CssValue::Str("inline".into())));
        assert_eq!(css_initial_value("zIndex"), Some(CssValue::Str("auto".into())));
        assert_eq!(css_initial_value("nonexistent"), None);
    }

    // ---- font-variant features ----

    #[test]
    fn font_variant_features() {
        assert_eq!(resolve_font_variant_features("normal"), vec![]);
        assert_eq!(resolve_font_variant_features(""), vec![]);
        assert_eq!(resolve_font_variant_features("unknown"), vec![]);
        assert_eq!(
            resolve_font_variant_features("small-caps"),
            vec![FontFeatureTag { name: "smcp", value: 1 }]
        );
        assert_eq!(
            resolve_font_variant_features("ALL-SMALL-CAPS"), // 대소문자 무관
            vec![
                FontFeatureTag { name: "smcp", value: 1 },
                FontFeatureTag { name: "c2sc", value: 1 },
            ]
        );
        assert_eq!(
            resolve_font_variant_features("  tabular-nums  "), // trim
            vec![FontFeatureTag { name: "tnum", value: 1 }]
        );
    }

    #[test]
    fn default_font_features_present() {
        assert_eq!(DEFAULT_FONT_FEATURES.len(), 4);
        assert_eq!(DEFAULT_FONT_FEATURES[0].name, "cv02");
    }

    // ---- currentColor ----

    #[test]
    fn current_color_whole_value() {
        assert_eq!(resolve_current_color("currentColor", "#f00"), "#f00");
        assert_eq!(resolve_current_color("CURRENTCOLOR", "#f00"), "#f00"); // 대소문자 무관
    }

    #[test]
    fn current_color_no_match_passthrough() {
        assert_eq!(resolve_current_color("#123456", "#f00"), "#123456");
        assert_eq!(resolve_current_color("red", "#f00"), "red");
    }

    #[test]
    fn current_color_token_in_compound() {
        // box-shadow 등 복합 값의 토큰 치환
        assert_eq!(
            resolve_current_color("0 0 4px currentColor", "#f00"),
            "0 0 4px #f00"
        );
        assert_eq!(
            resolve_current_color("1px solid currentColor", "rgb(1,2,3)"),
            "1px solid rgb(1,2,3)"
        );
    }

    #[test]
    fn current_color_word_boundary() {
        // "currentColorish" 같은 부분 매칭은 치환 안 됨 (단어 경계)
        assert_eq!(
            resolve_current_color("mycurrentColorx", "#f00"),
            "mycurrentColorx"
        );
    }

    // ---- cascade keyword ----

    #[test]
    fn cascade_inherit() {
        assert_eq!(
            resolve_cascade_keyword("color", &"inherit".into()),
            CascadeResult::Inherit
        );
        assert_eq!(
            resolve_cascade_keyword("color", &"INHERIT".into()),
            CascadeResult::Inherit
        );
    }

    #[test]
    fn cascade_initial_revert() {
        assert_eq!(
            resolve_cascade_keyword("color", &"initial".into()),
            CascadeResult::Value(CssValue::Str("#000000".into()))
        );
        assert_eq!(
            resolve_cascade_keyword("fontSize", &"revert".into()),
            CascadeResult::Value(CssValue::Num(16.0))
        );
        // 초기값 없는 속성 → 원본 값 유지
        assert_eq!(
            resolve_cascade_keyword("customProp", &"initial".into()),
            CascadeResult::Value(CssValue::Str("initial".into()))
        );
    }

    #[test]
    fn cascade_unset() {
        // 상속 속성 → inherit
        assert_eq!(
            resolve_cascade_keyword("color", &"unset".into()),
            CascadeResult::Inherit
        );
        // 비상속 속성 → initial
        assert_eq!(
            resolve_cascade_keyword("margin", &"unset".into()),
            CascadeResult::Value(CssValue::Num(0.0))
        );
    }

    #[test]
    fn cascade_non_keyword_passthrough() {
        assert_eq!(
            resolve_cascade_keyword("color", &"#abcdef".into()),
            CascadeResult::Value(CssValue::Str("#abcdef".into()))
        );
        // 숫자 값 passthrough
        assert_eq!(
            resolve_cascade_keyword("fontSize", &CssValue::Num(20.0)),
            CascadeResult::Value(CssValue::Num(20.0))
        );
    }

    // ---- logical properties ----

    #[test]
    fn logical_no_logical_key_passthrough() {
        let style = m(&[("marginLeft", 10.0.into()), ("color", "#f00".into())]);
        assert_eq!(resolve_logical_properties(&style), style);
    }

    #[test]
    fn logical_single_property() {
        let style = m(&[("marginInlineStart", 8.0.into())]);
        let out = resolve_logical_properties(&style);
        assert_eq!(out.get("marginLeft"), Some(&CssValue::Num(8.0)));
        assert!(!out.contains_key("marginInlineStart"));
    }

    #[test]
    fn logical_physical_wins() {
        // 물리 속성이 이미 있으면 논리 속성 무시
        let style = m(&[
            ("marginInlineStart", 8.0.into()),
            ("marginLeft", 20.0.into()),
        ]);
        let out = resolve_logical_properties(&style);
        assert_eq!(out.get("marginLeft"), Some(&CssValue::Num(20.0)));
        assert!(!out.contains_key("marginInlineStart"));
    }

    #[test]
    fn logical_shorthand_single_value() {
        let style = m(&[("marginInline", 5.0.into())]);
        let out = resolve_logical_properties(&style);
        assert_eq!(out.get("marginLeft"), Some(&CssValue::Num(5.0)));
        assert_eq!(out.get("marginRight"), Some(&CssValue::Num(5.0)));
        assert!(!out.contains_key("marginInline"));
    }

    #[test]
    fn logical_shorthand_two_values() {
        let style = m(&[("paddingBlock", "10px 20px".into())]);
        let out = resolve_logical_properties(&style);
        assert_eq!(out.get("paddingTop"), Some(&CssValue::Str("10px".into())));
        assert_eq!(out.get("paddingBottom"), Some(&CssValue::Str("20px".into())));
    }

    #[test]
    fn logical_inset_and_size() {
        let style = m(&[
            ("insetInlineStart", "4px".into()),
            ("inlineSize", "100px".into()),
        ]);
        let out = resolve_logical_properties(&style);
        assert_eq!(out.get("left"), Some(&CssValue::Str("4px".into())));
        assert_eq!(out.get("width"), Some(&CssValue::Str("100px".into())));
    }
}
