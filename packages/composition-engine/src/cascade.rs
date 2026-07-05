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

// ============================================
// !important 전처리 + font shorthand 전개 + resolveStyle 조립
// (cssResolver.ts:535 preprocessImportant / :594 expandFontShorthand / :579 resolveStyle)
// ============================================

/// `preprocess_important` 결과 (cssResolver.ts `ImportantSplit`).
#[derive(Debug, Clone, PartialEq)]
pub struct ImportantSplit {
    pub normal: BTreeMap<String, CssValue>,
    pub important: BTreeMap<String, CssValue>,
}

/// 스타일에서 `!important` 선언을 분리 (cssResolver.ts:535 `preprocessImportant`).
///
/// 문자열 값이 `!important` 로 끝나면 접미사를 제거하고 trailing 공백을 잘라 important 로,
/// 그 외(숫자 포함)는 normal 로 분류한다. `typeof value === "string"` 가드 재현 — `Num` 은
/// 항상 normal.
pub fn preprocess_important(style: &BTreeMap<String, CssValue>) -> ImportantSplit {
    let mut normal = BTreeMap::new();
    let mut important = BTreeMap::new();
    for (prop, value) in style {
        match value {
            CssValue::Str(s) if s.ends_with("!important") => {
                let trimmed = s[..s.len() - "!important".len()].trim_end();
                important.insert(prop.clone(), CssValue::Str(trimmed.to_string()));
            }
            _ => {
                normal.insert(prop.clone(), value.clone());
            }
        }
    }
    ImportantSplit { normal, important }
}

/// resolveStyle 내부 `expandFontShorthand` (cssResolver.ts:594).
///
/// `font` shorthand 가 있으면 개별 longhand 로 분해하되, 대상 longhand 가 **이미 있으면
/// 덮어쓰지 않는다**(원본 `expanded[key] === undefined` 가드). `font` 미존재 또는 파싱 실패
/// 시 입력을 그대로 반환.
pub fn expand_font_shorthand(
    src: &BTreeMap<String, CssValue>,
) -> BTreeMap<String, CssValue> {
    let Some(font_val) = src.get("font") else {
        return src.clone();
    };
    let Some(font_str) = font_val.as_str() else {
        return src.clone();
    };
    let Some(parsed) = crate::style::parse_font_shorthand(font_str) else {
        return src.clone();
    };
    let mut expanded = src.clone();
    expanded.remove("font");
    let mut fill = |key: &str, val: Option<String>| {
        if let Some(v) = val {
            expanded
                .entry(key.to_string())
                .or_insert_with(|| CssValue::Str(v));
        }
    };
    fill("fontStyle", parsed.font_style);
    fill("fontWeight", parsed.font_weight);
    fill("fontSize", parsed.font_size);
    fill("lineHeight", parsed.line_height);
    fill("fontFamily", parsed.font_family);
    expanded
}

/// resolveStyle 순회 대상 = INHERITABLE_PROPERTIES (cssResolver.ts:34) 정의 순서.
/// (cascade override 는 prop 독립이라 순서 무관하나 원본 순서를 그대로 재현.)
const INHERITABLE_KEYS: [&str; 17] = [
    "color",
    "fontSize",
    "fontFamily",
    "fontWeight",
    "fontStyle",
    "fontVariant",
    "fontStretch",
    "lineHeight",
    "letterSpacing",
    "wordSpacing",
    "textAlign",
    "textTransform",
    "textIndent",
    "visibility",
    "wordBreak",
    "overflowWrap",
    "whiteSpace",
];

/// 요소 스타일을 부모 computed 기반으로 해석 (cssResolver.ts:579 `resolveStyle`).
///
/// 처리 순서: `!important` 분리 → 논리→물리 변환(normal/important 각각) → font shorthand
/// 전개 → 부모 computed 복사 → INHERITABLE 순회(normal cascade) → important override →
/// fontSize em/rem/px 단위 해석.
///
/// **JS 잔류 경계**: `parent_computed` 는 호출자(JS)가 `getRootComputedStyle()` 등으로
/// 만들어 넘긴다(store 의존). em 은 부모 fontSize, rem 은 루트 16 고정(원본 그대로).
pub fn resolve_style(
    style: Option<&BTreeMap<String, CssValue>>,
    parent_computed: &BTreeMap<String, CssValue>,
) -> BTreeMap<String, CssValue> {
    // style 미선언 → 부모 값 전체 상속.
    let Some(style) = style else {
        return parent_computed.clone();
    };

    let split = preprocess_important(style);
    let after_logical_normal = resolve_logical_properties(&split.normal);
    let after_logical_important = resolve_logical_properties(&split.important);
    let effective_normal = expand_font_shorthand(&after_logical_normal);
    let effective_important = expand_font_shorthand(&after_logical_important);

    // 부모 computed 기반으로 시작 (상속 속성 기본값).
    let mut computed = parent_computed.clone();

    // 1단계 normal → 2단계 important 순으로 INHERITABLE 적용.
    for source in [&effective_normal, &effective_important] {
        for prop in INHERITABLE_KEYS {
            let Some(raw) = source.get(prop) else { continue };
            // undefined/null/"" skip 은 Map 부재로 자연 처리, "" 만 명시 skip.
            if matches!(raw, CssValue::Str(s) if s.is_empty()) {
                continue;
            }
            match resolve_cascade_keyword(prop, raw) {
                CascadeResult::Inherit => continue, // 부모 값 유지.
                CascadeResult::Value(v) => {
                    computed.insert(prop.to_string(), v);
                }
            }
        }
    }

    // fontSize 상대 단위 해석 (em: 부모 fontSize / rem: 루트 16 / px: 그대로).
    if let Some(CssValue::Str(fs)) = computed.get("fontSize").cloned() {
        let parent_fs = match parent_computed.get("fontSize") {
            Some(CssValue::Num(n)) => *n,
            _ => 16.0,
        };
        // JS parseFloat 선두 숫자 추출 — style.rs 의 계약 재사용(지수부 포함 단일 정본).
        let pf = crate::style::parse_leading_f32;
        let resolved = if fs.ends_with("em") && !fs.ends_with("rem") {
            pf(&fs).map(|n| n * parent_fs)
        } else if fs.ends_with("rem") {
            pf(&fs).map(|n| n * 16.0)
        } else if fs.ends_with("px") {
            pf(&fs)
        } else {
            // 원본 JS: parseFloat(fs) || parentComputed.fontSize — 0/NaN 모두 falsy → 부모.
            match pf(&fs) {
                Some(n) if n != 0.0 => Some(n),
                _ => Some(parent_fs),
            }
        };
        if let Some(n) = resolved {
            computed.insert("fontSize".to_string(), CssValue::Num(n));
        }
    }

    computed
}

/// currentColor 치환 대상 색상 속성 (cssResolver.ts:124 `COLOR_PROPERTIES`).
fn is_color_property(prop: &str) -> bool {
    matches!(
        prop,
        "borderColor" | "backgroundColor" | "textDecorationColor" | "outlineColor" | "boxShadow"
    )
}

/// 요소 전체 스타일(비상속 포함)의 cascade 키워드 + currentColor 전처리
/// (cssResolver.ts:704 `preprocessStyle`).
///
/// `resolve_style` 이 상속 속성만 처리하는 것과 달리, borderColor/backgroundColor 등
/// 비상속 색상 속성의 `currentColor`/`initial`/`unset`/`revert` 를 구체 값으로 변환한다.
///
/// - `initial`/`revert` → 초기값(있으면) + 다음 prop.
/// - `unset` → 상속 속성이면 그대로 두고 넘어감(resolve_style 이 처리), 비상속이면 초기값.
/// - COLOR_PROPERTIES → `resolve_current_color`(computed_color 로 치환).
///
/// 원본을 수정하지 않고 새 map 반환.
pub fn preprocess_style(
    style: &BTreeMap<String, CssValue>,
    computed_color: &str,
) -> BTreeMap<String, CssValue> {
    let mut result = style.clone();

    for (prop, raw) in style {
        // undefined/null/"" skip — Map 부재는 자연 처리, "" 만 명시.
        let s = match raw {
            CssValue::Str(s) if !s.is_empty() => s.as_str(),
            _ => continue, // 숫자/빈 문자열 → 키워드·currentColor 미검사.
        };

        // cascade 키워드 (부모 없는 flat: 비상속은 initial fallback).
        let lower = s.to_ascii_lowercase();
        if lower == "initial" || lower == "revert" {
            if let Some(initial) = css_initial_value(prop) {
                result.insert(prop.clone(), initial);
                continue;
            }
        } else if lower == "unset" {
            if is_inheritable_property(prop) {
                // 상속 속성의 unset 은 resolve_style 이 처리 → 여기선 넘어감.
                continue;
            }
            if let Some(initial) = css_initial_value(prop) {
                result.insert(prop.clone(), initial);
                continue;
            }
        }

        // currentColor 키워드 치환.
        if is_color_property(prop) {
            result.insert(
                prop.clone(),
                CssValue::Str(resolve_current_color(s, computed_color)),
            );
        }
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

    // ---- preprocess_important (cssResolver.ts:535) ----

    #[test]
    fn important_split_separates_bang_important() {
        // 원본 예제: { color: 'red !important', fontSize: '14px' }
        //   → { normal: { fontSize: '14px' }, important: { color: 'red' } }
        let style = m(&[("color", "red !important".into()), ("fontSize", "14px".into())]);
        let split = preprocess_important(&style);
        assert_eq!(split.important.get("color"), Some(&CssValue::Str("red".into())));
        assert!(!split.important.contains_key("fontSize"));
        assert_eq!(split.normal.get("fontSize"), Some(&CssValue::Str("14px".into())));
        assert!(!split.normal.contains_key("color"));
    }

    #[test]
    fn important_split_trims_trailing_space_before_bang() {
        // "red !important" → slice("!important") → "red " → trimEnd → "red"
        let style = m(&[("color", "blue   !important".into())]);
        let split = preprocess_important(&style);
        assert_eq!(split.important.get("color"), Some(&CssValue::Str("blue".into())));
    }

    #[test]
    fn important_split_numeric_value_stays_normal() {
        // Num 은 endsWith 검사 대상 아님 (typeof value === "string" 가드) → normal.
        let style = m(&[("opacity", 0.5.into())]);
        let split = preprocess_important(&style);
        assert_eq!(split.normal.get("opacity"), Some(&CssValue::Num(0.5)));
        assert!(split.important.is_empty());
    }

    // ---- expand_font_shorthand (cssResolver.ts:594) ----

    #[test]
    fn font_shorthand_expands_into_longhand() {
        // resolveStyle 내부 expandFontShorthand: font 존재 시 분해, longhand 이미 있으면 미덮어씀.
        let style = m(&[("font", "italic 700 16px/24px Arial".into())]);
        let out = expand_font_shorthand(&style);
        assert!(!out.contains_key("font"));
        assert_eq!(out.get("fontStyle"), Some(&CssValue::Str("italic".into())));
        assert_eq!(out.get("fontWeight"), Some(&CssValue::Str("700".into())));
        assert_eq!(out.get("fontSize"), Some(&CssValue::Str("16px".into())));
        assert_eq!(out.get("lineHeight"), Some(&CssValue::Str("24px".into())));
        assert_eq!(out.get("fontFamily"), Some(&CssValue::Str("Arial".into())));
    }

    #[test]
    fn font_shorthand_does_not_override_existing_longhand() {
        // 원본: expanded[key] === undefined 일 때만 채움.
        let style = m(&[
            ("font", "italic 700 16px Arial".into()),
            ("fontWeight", "400".into()),
        ]);
        let out = expand_font_shorthand(&style);
        assert_eq!(out.get("fontWeight"), Some(&CssValue::Str("400".into())));
    }

    #[test]
    fn font_shorthand_absent_returns_input_unchanged() {
        let style = m(&[("color", "red".into())]);
        let out = expand_font_shorthand(&style);
        assert_eq!(out.get("color"), Some(&CssValue::Str("red".into())));
        assert!(!out.contains_key("fontSize"));
    }

    // ---- resolve_style 조립 (cssResolver.ts:579) ----

    fn parent() -> BTreeMap<String, CssValue> {
        // ROOT_COMPUTED_STYLE 축약 — resolveStyle 이 만지는 상속 속성만.
        m(&[
            ("color", "#111111".into()),
            ("fontSize", 16.0.into()),
            ("fontWeight", "400".into()),
            ("fontFamily", "sans-serif".into()),
            ("lineHeight", "normal".into()),
            ("textAlign", "start".into()),
        ])
    }

    #[test]
    fn resolve_style_none_inherits_parent() {
        // style 미선언 → 부모 값 전체 상속.
        let out = resolve_style(None, &parent());
        assert_eq!(out.get("color"), Some(&CssValue::Str("#111111".into())));
        assert_eq!(out.get("fontSize"), Some(&CssValue::Num(16.0)));
    }

    #[test]
    fn resolve_style_explicit_value_overrides_parent() {
        let style = m(&[("color", "#ff0000".into())]);
        let out = resolve_style(Some(&style), &parent());
        assert_eq!(out.get("color"), Some(&CssValue::Str("#ff0000".into())));
        // 미선언 상속 속성은 부모 유지.
        assert_eq!(out.get("fontWeight"), Some(&CssValue::Str("400".into())));
    }

    #[test]
    fn resolve_style_inherit_keyword_keeps_parent() {
        let style = m(&[("color", "inherit".into())]);
        let out = resolve_style(Some(&style), &parent());
        assert_eq!(out.get("color"), Some(&CssValue::Str("#111111".into())));
    }

    #[test]
    fn resolve_style_initial_keyword_uses_initial_value() {
        let style = m(&[("color", "initial".into())]);
        let out = resolve_style(Some(&style), &parent());
        // color initial = #000000.
        assert_eq!(out.get("color"), Some(&CssValue::Str("#000000".into())));
    }

    #[test]
    fn resolve_style_unset_inheritable_acts_as_inherit() {
        // color 는 상속 속성 → unset = inherit → 부모 유지.
        let style = m(&[("color", "unset".into())]);
        let out = resolve_style(Some(&style), &parent());
        assert_eq!(out.get("color"), Some(&CssValue::Str("#111111".into())));
    }

    #[test]
    fn resolve_style_important_overrides_normal() {
        // 처리 순서: inline !important > inline normal.
        let style = m(&[
            ("color", "#00ff00".into()),
            ("color2_ignore", "x".into()),
        ]);
        // 같은 prop 두 번은 Map 이라 불가 → important 는 값 접미사로 표현.
        let style2 = m(&[("color", "#0000ff !important".into())]);
        // normal + important 를 같은 style 로: color 는 important 우선.
        let merged = {
            let mut mm = style.clone();
            mm.remove("color2_ignore");
            for (k, v) in style2 {
                mm.insert(k, v);
            }
            mm
        };
        let out = resolve_style(Some(&merged), &parent());
        assert_eq!(out.get("color"), Some(&CssValue::Str("#0000ff".into())));
    }

    #[test]
    fn resolve_style_fontsize_em_relative_to_parent() {
        // 2em × parent 16 = 32.
        let style = m(&[("fontSize", "2em".into())]);
        let out = resolve_style(Some(&style), &parent());
        assert_eq!(out.get("fontSize"), Some(&CssValue::Num(32.0)));
    }

    #[test]
    fn resolve_style_fontsize_rem_relative_to_root_16() {
        // 1.5rem × 16 = 24 (rem 은 루트 16 고정).
        let style = m(&[("fontSize", "1.5rem".into())]);
        let out = resolve_style(Some(&style), &parent());
        assert_eq!(out.get("fontSize"), Some(&CssValue::Num(24.0)));
    }

    #[test]
    fn resolve_style_fontsize_px_parsed() {
        let style = m(&[("fontSize", "20px".into())]);
        let out = resolve_style(Some(&style), &parent());
        assert_eq!(out.get("fontSize"), Some(&CssValue::Num(20.0)));
    }

    #[test]
    fn resolve_style_fontsize_unitless_fallback_to_parent() {
        // "abc" → parseFloat NaN → parentComputed.fontSize (16).
        let style = m(&[("fontSize", "abc".into())]);
        let out = resolve_style(Some(&style), &parent());
        assert_eq!(out.get("fontSize"), Some(&CssValue::Num(16.0)));
    }

    #[test]
    fn resolve_style_fontsize_unitless_zero_is_falsy_fallback() {
        // 원본 JS: parseFloat("0") || parentComputed.fontSize → 0 은 falsy → 부모(16).
        // else 분기(px/em/rem 아닌 unitless)에서 `|| parentComputed.fontSize` falsy 처리.
        let style = m(&[("fontSize", "0".into())]);
        let out = resolve_style(Some(&style), &parent());
        assert_eq!(out.get("fontSize"), Some(&CssValue::Num(16.0)));
    }

    #[test]
    fn resolve_style_fontsize_px_zero_stays_zero() {
        // px 분기는 falsy fallback 없음 — parseFloat("0px")=0 그대로.
        let style = m(&[("fontSize", "0px".into())]);
        let out = resolve_style(Some(&style), &parent());
        assert_eq!(out.get("fontSize"), Some(&CssValue::Num(0.0)));
    }

    #[test]
    fn resolve_style_logical_property_converted_before_cascade() {
        // marginInlineStart 는 상속 속성이 아니므로 resolveStyle 순회엔 안 잡히지만,
        // resolveLogicalProperties 는 항상 먼저 적용됨 → 결과에 marginLeft 로 존재.
        // (단 resolveStyle 은 상속 속성만 computed 에 반영하므로 marginLeft 는
        //  computed(부모 복사)에 없고, 논리 변환 자체 검증은 별도.)
        let style = m(&[("textAlign", "inherit".into())]);
        let out = resolve_style(Some(&style), &parent());
        // textAlign inherit → 부모 start 유지 (logical 무관, cascade 경로 확인).
        assert_eq!(out.get("textAlign"), Some(&CssValue::Str("start".into())));
    }

    #[test]
    fn resolve_style_font_shorthand_feeds_cascade() {
        // font shorthand 분해 → fontWeight/fontSize 가 cascade 순회에 반영.
        let style = m(&[("font", "italic 700 24px Arial".into())]);
        let out = resolve_style(Some(&style), &parent());
        assert_eq!(out.get("fontWeight"), Some(&CssValue::Str("700".into())));
        // fontSize 24px → 숫자 24 로 해석.
        assert_eq!(out.get("fontSize"), Some(&CssValue::Num(24.0)));
        assert_eq!(out.get("fontFamily"), Some(&CssValue::Str("Arial".into())));
    }

    // ---- preprocess_style (cssResolver.ts:704) ----
    // 비상속 속성의 cascade 키워드(initial/revert/unset) + currentColor 전처리.

    #[test]
    fn preprocess_style_currentcolor_replaced_with_computed_color() {
        // borderColor: currentColor → computedColor 로 치환.
        let style = m(&[("borderColor", "currentColor".into())]);
        let out = preprocess_style(&style, "#ff0000");
        assert_eq!(out.get("borderColor"), Some(&CssValue::Str("#ff0000".into())));
    }

    #[test]
    fn preprocess_style_currentcolor_in_boxshadow_compound() {
        // boxShadow 는 COLOR_PROPERTIES → 복합 값 내 currentColor 토큰 치환.
        let style = m(&[("boxShadow", "0 1px 2px currentColor".into())]);
        let out = preprocess_style(&style, "#123456");
        assert_eq!(
            out.get("boxShadow"),
            Some(&CssValue::Str("0 1px 2px #123456".into()))
        );
    }

    #[test]
    fn preprocess_style_non_color_property_untouched() {
        // display 는 COLOR_PROPERTIES 아님 + cascade 키워드 아님 → 그대로.
        let style = m(&[("display", "flex".into())]);
        let out = preprocess_style(&style, "#000000");
        assert_eq!(out.get("display"), Some(&CssValue::Str("flex".into())));
    }

    #[test]
    fn preprocess_style_initial_keyword_uses_initial_value() {
        // 비상속 backgroundColor: initial → CSS_INITIAL_VALUES = transparent.
        let style = m(&[("backgroundColor", "initial".into())]);
        let out = preprocess_style(&style, "#000000");
        assert_eq!(
            out.get("backgroundColor"),
            Some(&CssValue::Str("transparent".into()))
        );
    }

    #[test]
    fn preprocess_style_revert_keyword_uses_initial_value() {
        // revert = initial 동일 처리 (노코드 빌더).
        let style = m(&[("borderColor", "revert".into())]);
        let out = preprocess_style(&style, "#000000");
        // borderColor initial = #000000.
        assert_eq!(out.get("borderColor"), Some(&CssValue::Str("#000000".into())));
    }

    #[test]
    fn preprocess_style_unset_non_inheritable_uses_initial() {
        // backgroundColor 는 비상속 → unset = initial = transparent.
        let style = m(&[("backgroundColor", "unset".into())]);
        let out = preprocess_style(&style, "#000000");
        assert_eq!(
            out.get("backgroundColor"),
            Some(&CssValue::Str("transparent".into()))
        );
    }

    #[test]
    fn preprocess_style_unset_inheritable_is_skipped() {
        // color 는 상속 속성 → unset 은 resolveStyle 이 처리 → 여기선 원본 유지(continue).
        let style = m(&[("color", "unset".into())]);
        let out = preprocess_style(&style, "#000000");
        assert_eq!(out.get("color"), Some(&CssValue::Str("unset".into())));
    }

    #[test]
    fn preprocess_style_empty_and_numeric_values_untouched() {
        // "" skip, 숫자 skip (문자열 아니면 키워드/currentColor 검사 안 함).
        let style = m(&[("borderWidth", 2.0.into()), ("borderColor", "".into())]);
        let out = preprocess_style(&style, "#000000");
        assert_eq!(out.get("borderWidth"), Some(&CssValue::Num(2.0)));
        assert_eq!(out.get("borderColor"), Some(&CssValue::Str("".into())));
    }

    #[test]
    fn preprocess_style_initial_missing_from_map_falls_through_to_color() {
        // outlineColor: initial 은 CSS_INITIAL_VALUES 에 "invert" 로 존재 →
        // initial 분기가 치환하고 continue (currentColor 미검사).
        let style = m(&[("outlineColor", "initial".into())]);
        let out = preprocess_style(&style, "#aabbcc");
        assert_eq!(out.get("outlineColor"), Some(&CssValue::Str("invert".into())));
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
