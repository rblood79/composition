//! ADR-916 Phase 2-A — Style Resolution (CSS 값 산술 + shorthand 분해 커널)
//!
//! `apps/builder/.../layout/engines/cssValueParser.ts` 의 **순수 산술** 계층을
//! 이식. var()/디자인 토큰 해석은 DOM 의존(`getComputedStyle(documentElement)`)
//! 이라 JS 에 잔류하고, 본 모듈은 **이미 var() 가 치환된 순수 값 문자열** 을 입력
//! 으로 받아 단위 해석 / calc() / clamp() / min() / max() / env() 산술과
//! font/border shorthand 분해를 수행한다.
//! (ADR-916 Phase 2-A 첫 착수 단위 — DOM 변수 해석 JS 잔류 계약.)
//!
//! ## 계약
//!
//! - 입력: 값 문자열 + [`CssValueContext`] (parentSize/containerSize/viewport/
//!   rootFontSize = 전부 사전 계산된 f32 스칼라 — Phase 1 flat f32 센티넬 철학 동일)
//! - 출력: `Option<f32>` (JS `number | undefined` 대응). 해석 불가 = `None`.
//! - intrinsic sizing 키워드는 센티넬 f32 로 반환 ([`FIT_CONTENT`]/[`MIN_CONTENT`]/
//!   [`MAX_CONTENT`]) — Phase 1 block/flex 의 `AUTO=-1.0` 계열과 동일 규약.
//!
//! ## 미이식 (JS 잔류)
//!
//! - `resolveVar` / `createVariableScopeWithDOMFallback` /
//!   `resolveVariableFromDOMDefault` — `getComputedStyle(document.documentElement)`
//!   DOM 조회. WASM 경계 밖. JS 가 선해석해 순수 값으로 만든 뒤 본 모듈 호출.
//! - `resolveVar` / 디자인 토큰 해석 — DOM 의존이라 JS 잔류.

/// CSS intrinsic sizing 센티넬 — `fit-content`
pub const FIT_CONTENT: f32 = -2.0;
/// CSS intrinsic sizing 센티넬 — `min-content`
pub const MIN_CONTENT: f32 = -3.0;
/// CSS intrinsic sizing 센티넬 — `max-content`
pub const MAX_CONTENT: f32 = -4.0;

/// vw 기준 기본값 (cssValueParser.ts:108)
const DEFAULT_VIEWPORT_WIDTH: f32 = 1920.0;
/// vh 기준 기본값 (cssValueParser.ts:110)
const DEFAULT_VIEWPORT_HEIGHT: f32 = 1080.0;
/// rem/기본 font-size 기준 (cssValueParser.ts:112)
const DEFAULT_ROOT_FONT_SIZE: f32 = 16.0;

/// calc() 파서 최대 재귀 깊이 (cssValueParser.ts:647)
const CALC_MAX_DEPTH: u32 = 10;

/// CSS 값 해석 컨텍스트 — 각 단위의 기준값.
///
/// JS `CSSValueContext` 대응. `variableScope` 는 DOM 의존이라 제외 (JS 선처리).
/// `None` 필드는 JS 의 `?? DEFAULT_*` 폴백과 동일하게 기본값으로 대체된다.
#[derive(Debug, Clone, Copy, Default)]
pub struct CssValueContext {
    /// em 단위 기준 (부모 font-size, px)
    pub parent_size: Option<f32>,
    /// % 단위 기준 (부모 content-box 또는 컨테이너 크기, px)
    pub container_size: Option<f32>,
    /// vw 기준 (기본 1920)
    pub viewport_width: Option<f32>,
    /// vh 기준 (기본 1080)
    pub viewport_height: Option<f32>,
    /// rem 기준 (기본 16)
    pub root_font_size: Option<f32>,
}

/// CSS `font` shorthand 파싱 결과 (cssValueParser.ts `ParsedFont` 대응).
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ParsedFont {
    pub font_style: Option<String>,
    pub font_weight: Option<String>,
    pub font_size: Option<String>,
    pub line_height: Option<String>,
    pub font_family: Option<String>,
}

/// CSS `border` shorthand 파싱 결과 (cssValueParser.ts `ParsedBorder` 대응).
#[derive(Debug, Clone, PartialEq)]
pub struct ParsedBorder {
    pub width: f32,
    pub style: String,
    pub color: String,
}

impl CssValueContext {
    #[inline]
    fn root_fs(&self) -> f32 {
        self.root_font_size.unwrap_or(DEFAULT_ROOT_FONT_SIZE)
    }
    #[inline]
    fn parent_fs(&self) -> f32 {
        self.parent_size.unwrap_or(DEFAULT_ROOT_FONT_SIZE)
    }
    #[inline]
    fn vw(&self) -> f32 {
        self.viewport_width.unwrap_or(DEFAULT_VIEWPORT_WIDTH)
    }
    #[inline]
    fn vh(&self) -> f32 {
        self.viewport_height.unwrap_or(DEFAULT_VIEWPORT_HEIGHT)
    }
}

/// CSS `font` shorthand 를 개별 font 속성으로 분해 (cssValueParser.ts `parseFontShorthand`).
///
/// 원본 JS 와 동일하게 style/weight/size/line-height/family 만 추출한다. `font-variant`
/// (`small-caps`) 는 현재 호출부가 소비하지 않으므로 인식만 하고 결과에는 담지 않는다.
pub fn parse_font_shorthand(value: &str) -> Option<ParsedFont> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return None;
    }

    let first_comma_idx = trimmed.find(',');
    let (pre_family_str, remaining_family_str) = match first_comma_idx {
        Some(idx) => (&trimmed[..idx], &trimmed[idx..]),
        None => (trimmed, ""),
    };

    let pre_tokens: Vec<&str> = pre_family_str.split_whitespace().collect();
    let mut result = ParsedFont {
        font_style: None,
        font_weight: None,
        font_size: None,
        line_height: None,
        font_family: None,
    };

    let mut size_token_idx: Option<usize> = None;
    for (i, token) in pre_tokens.iter().enumerate() {
        if let Some(slash_idx) = token.find('/') {
            let size_part = &token[..slash_idx];
            let line_height_part = &token[slash_idx + 1..];
            if is_font_size_token(size_part) {
                result.font_size = Some(size_part.to_string());
                if !line_height_part.is_empty() {
                    result.line_height = Some(line_height_part.to_string());
                }
                size_token_idx = Some(i);
                break;
            }
        } else if is_font_size_token(token)
            && !is_font_style_keyword(token)
            && !is_font_weight_keyword(token)
            && !is_font_variant_keyword(token)
        {
            result.font_size = Some((*token).to_string());
            size_token_idx = Some(i);
            break;
        }
    }

    let pre_pre_end = size_token_idx.unwrap_or(pre_tokens.len());
    for token in &pre_tokens[..pre_pre_end] {
        let lower = token.to_ascii_lowercase();
        if is_font_style_keyword(&lower) && lower != "normal" && result.font_style.is_none() {
            result.font_style = Some(lower);
        } else if result.font_weight.is_none()
            && ((is_font_weight_keyword(&lower) && lower != "normal")
                || is_font_weight_number(&lower))
        {
            result.font_weight = Some(lower);
        }
    }

    if let Some(idx) = size_token_idx {
        if idx + 1 < pre_tokens.len() {
            let family_first_word = pre_tokens[idx + 1..].join(" ");
            result.font_family = Some(if remaining_family_str.is_empty() {
                family_first_word
            } else {
                format!("{family_first_word}{remaining_family_str}")
            });
        } else if !remaining_family_str.is_empty() {
            result.font_family = Some(remaining_family_str[1..].trim().to_string());
        }
    }

    Some(result)
}

/// CSS `border` shorthand 를 width/style/color 로 분해 (cssValueParser.ts `parseBorderShorthand`).
///
/// 원본 JS 와 동일하게 순서 무관 토큰을 훑고, width 는 `parseFloat` 근사값만 사용한다.
/// CSS color 함수 전체 파싱은 하지 않고 첫 비-width/style 토큰을 color 로 둔다.
pub fn parse_border_shorthand(value: &str) -> Option<ParsedBorder> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return None;
    }

    let mut width: Option<f32> = None;
    let mut style: Option<String> = None;
    let mut color: Option<String> = None;

    for part in trimmed.split_whitespace() {
        let lower = part.to_ascii_lowercase();
        if is_border_style_keyword(&lower) {
            style = Some(lower);
            continue;
        }

        if width.is_none() {
            if let Some(num) = parse_leading_f32(part) {
                width = Some(num);
                continue;
            }
        }

        if color.is_none() {
            color = Some(part.to_string());
        }
    }

    Some(ParsedBorder {
        width: width.unwrap_or(0.0),
        style: style.unwrap_or_else(|| "none".to_string()),
        color: color.unwrap_or_else(|| "#000000".to_string()),
    })
}

fn is_font_style_keyword(token: &str) -> bool {
    matches!(token, "italic" | "oblique" | "normal")
}

fn is_font_weight_keyword(token: &str) -> bool {
    matches!(token, "bold" | "bolder" | "lighter" | "normal")
}

fn is_font_variant_keyword(token: &str) -> bool {
    matches!(token, "small-caps" | "normal")
}

fn is_font_weight_number(token: &str) -> bool {
    !token.is_empty()
        && token.as_bytes().iter().all(u8::is_ascii_digit)
        && !token.ends_with("px")
        && !token.ends_with("em")
}

fn is_font_size_token(token: &str) -> bool {
    if is_font_weight_number(token) {
        return false;
    }
    token
        .as_bytes()
        .first()
        .is_some_and(|b| b.is_ascii_digit() || *b == b'.')
        || token.ends_with("px")
        || token.ends_with("em")
        || token.ends_with("rem")
        || token.ends_with('%')
        || token.ends_with("vw")
        || token.ends_with("vh")
        || matches!(
            token,
            "xx-small"
                | "x-small"
                | "small"
                | "medium"
                | "large"
                | "x-large"
                | "xx-large"
                | "smaller"
                | "larger"
        )
}

fn is_border_style_keyword(token: &str) -> bool {
    matches!(
        token,
        "none"
            | "hidden"
            | "dotted"
            | "dashed"
            | "solid"
            | "double"
            | "groove"
            | "ridge"
            | "inset"
            | "outset"
    )
}

/// CSS 크기 값을 px 숫자로 해석하는 통합 함수 (cssValueParser.ts:295 `resolveCSSSizeValue`).
///
/// var() 는 JS 가 선처리했다고 가정 — 본 함수는 이미 치환된 순수 값 문자열을 받는다.
/// 빈 문자열 / `auto` → `None` (JS 는 fallback 반환, Rust 는 호출부가 fallback 처리).
///
/// # Examples
/// ```
/// use composition_engine::style::{resolve_css_size_value, CssValueContext};
/// assert_eq!(resolve_css_size_value("100px", &CssValueContext::default()), Some(100.0));
/// let ctx = CssValueContext { container_size: Some(800.0), ..Default::default() };
/// assert_eq!(resolve_css_size_value("50%", &ctx), Some(400.0));
/// ```
pub fn resolve_css_size_value(value: &str, ctx: &CssValueContext) -> Option<f32> {
    let trimmed = value.trim();

    if trimmed.is_empty() || trimmed == "auto" {
        return None;
    }

    // intrinsic sizing 키워드
    match trimmed {
        "fit-content" => return Some(FIT_CONTENT),
        "min-content" => return Some(MIN_CONTENT),
        "max-content" => return Some(MAX_CONTENT),
        _ => {}
    }

    // env() 함수
    if let Some(inner) = strip_fn(trimmed, "env") {
        return resolve_env(inner, ctx);
    }

    // calc() 표현식
    if let Some(inner) = strip_fn(trimmed, "calc") {
        return resolve_calc(inner, ctx);
    }

    // clamp(min, val, max)
    if let Some(inner) = strip_fn(trimmed, "clamp") {
        return resolve_clamp(inner, ctx);
    }

    // min(a, b, ...)
    if let Some(inner) = strip_fn(trimmed, "min") {
        return resolve_css_min(inner, ctx);
    }

    // max(a, b, ...)
    if let Some(inner) = strip_fn(trimmed, "max") {
        return resolve_css_max(inner, ctx);
    }

    resolve_unit_value(trimmed, ctx)
}

/// `name( ... )` 형태면 괄호 안쪽을 반환. prefix 불일치 / 미종결 시 `None`.
fn strip_fn<'a>(s: &'a str, name: &str) -> Option<&'a str> {
    let head = s.strip_prefix(name)?;
    let inner = head.strip_prefix('(')?;
    inner.strip_suffix(')')
}

/// 단위가 포함된 단일 CSS 값 해석 (cssValueParser.ts:366 `resolveUnitValue`).
///
/// rem 은 em 보다 먼저 검사 (`rem` 이 `em` 으로 끝나므로). 원본 검사 순서 그대로 승계.
fn resolve_unit_value(trimmed: &str, ctx: &CssValueContext) -> Option<f32> {
    // px
    if let Some(n) = trimmed.strip_suffix("px").and_then(parse_leading_f32) {
        return Some(n);
    }
    // rem (em 보다 먼저)
    if let Some(n) = trimmed.strip_suffix("rem").and_then(parse_leading_f32) {
        return Some(n * ctx.root_fs());
    }
    // em
    if let Some(n) = trimmed.strip_suffix("em").and_then(parse_leading_f32) {
        return Some(n * ctx.parent_fs());
    }
    // vh
    if let Some(n) = trimmed.strip_suffix("vh").and_then(parse_leading_f32) {
        return Some((n / 100.0) * ctx.vh());
    }
    // vw
    if let Some(n) = trimmed.strip_suffix("vw").and_then(parse_leading_f32) {
        return Some((n / 100.0) * ctx.vw());
    }
    // vmin
    if let Some(n) = trimmed.strip_suffix("vmin").and_then(parse_leading_f32) {
        return Some((n / 100.0) * ctx.vw().min(ctx.vh()));
    }
    // vmax
    if let Some(n) = trimmed.strip_suffix("vmax").and_then(parse_leading_f32) {
        return Some((n / 100.0) * ctx.vw().max(ctx.vh()));
    }
    // in (1in = 96px)
    if let Some(n) = trimmed.strip_suffix("in").and_then(parse_leading_f32) {
        return Some(n * 96.0);
    }
    // cm (1cm = 96/2.54 px)
    if let Some(n) = trimmed.strip_suffix("cm").and_then(parse_leading_f32) {
        return Some(n * (96.0 / 2.54));
    }
    // mm (1mm = 96/25.4 px)
    if let Some(n) = trimmed.strip_suffix("mm").and_then(parse_leading_f32) {
        return Some(n * (96.0 / 25.4));
    }
    // pc (1pc = 16px)
    if let Some(n) = trimmed.strip_suffix("pc").and_then(parse_leading_f32) {
        return Some(n * 16.0);
    }
    // pt (1pt = 96/72 px)
    if let Some(n) = trimmed.strip_suffix("pt").and_then(parse_leading_f32) {
        return Some(n * (96.0 / 72.0));
    }
    // ch (fontSize * 0.5 근사)
    if let Some(n) = trimmed.strip_suffix("ch").and_then(parse_leading_f32) {
        return Some(n * ctx.parent_fs() * 0.5);
    }
    // ex (x-height 근사: fontSize * 0.5)
    if let Some(n) = trimmed.strip_suffix("ex").and_then(parse_leading_f32) {
        return Some(n * ctx.parent_fs() * 0.5);
    }
    // %
    if let Some(n) = trimmed.strip_suffix('%').and_then(parse_leading_f32) {
        // containerSize 미제공 시 해석 불가 (원본: return undefined)
        return ctx.container_size.map(|cs| (n / 100.0) * cs);
    }

    // 단위 없는 숫자 문자열
    parse_leading_f32(trimmed)
}

/// JS `parseFloat` 근사 — 선행 숫자 부분만 파싱 (뒤 비숫자 무시).
///
/// JS `parseFloat("12abc")===12` 를 재현. Rust `str::parse::<f32>()` 는 이 경우
/// `Err` 이므로 선행 숫자 구간을 직접 잘라낸다. 파싱 실패(선행 숫자 없음) → `None`.
fn parse_leading_f32(s: &str) -> Option<f32> {
    let bytes = s.as_bytes();
    let mut i = 0;
    // 부호
    if i < bytes.len() && (bytes[i] == b'-' || bytes[i] == b'+') {
        i += 1;
    }
    let mut saw_digit = false;
    // 정수부
    while i < bytes.len() && bytes[i].is_ascii_digit() {
        i += 1;
        saw_digit = true;
    }
    // 소수부
    if i < bytes.len() && bytes[i] == b'.' {
        i += 1;
        while i < bytes.len() && bytes[i].is_ascii_digit() {
            i += 1;
            saw_digit = true;
        }
    }
    // 지수부 (e/E) — JS parseFloat 지원
    if saw_digit && i < bytes.len() && (bytes[i] == b'e' || bytes[i] == b'E') {
        let mut j = i + 1;
        if j < bytes.len() && (bytes[j] == b'-' || bytes[j] == b'+') {
            j += 1;
        }
        let mut saw_exp_digit = false;
        while j < bytes.len() && bytes[j].is_ascii_digit() {
            j += 1;
            saw_exp_digit = true;
        }
        if saw_exp_digit {
            i = j;
        }
    }
    if !saw_digit {
        return None;
    }
    s[..i].parse::<f32>().ok()
}

/// CSS env() 함수 해석 (cssValueParser.ts:245 `resolveEnv`).
///
/// safe-area-inset-* 는 캔버스 환경에서 항상 0. 알 수 없는 변수는 fallback 또는 0.
/// `inner` = `env(` 와 `)` 를 제거한 안쪽 문자열.
fn resolve_env(inner: &str, ctx: &CssValueContext) -> Option<f32> {
    // cssValueParser.ts:227 KNOWN_ENV_VARS 와 정확히 일치 (safe-area-inset 4종).
    const KNOWN_ENV_VARS: [&str; 4] = [
        "safe-area-inset-top",
        "safe-area-inset-bottom",
        "safe-area-inset-left",
        "safe-area-inset-right",
    ];

    let (var_name, fallback_expr) = match inner.find(',') {
        Some(idx) => (inner[..idx].trim(), Some(inner[idx + 1..].trim())),
        None => (inner.trim(), None),
    };

    if KNOWN_ENV_VARS.contains(&var_name) {
        return Some(0.0);
    }
    match fallback_expr {
        Some(expr) => resolve_css_size_value(expr, ctx),
        None => Some(0.0),
    }
}

/// CSS 함수 인자를 괄호 깊이 추적하며 쉼표 분리 (cssValueParser.ts:507 `splitCSSFunctionArgs`).
///
/// 중첩 함수(calc 내부 괄호 등)를 올바르게 처리. 각 인자는 trim.
fn split_css_function_args(args_str: &str) -> Vec<&str> {
    let mut args: Vec<&str> = Vec::new();
    let mut depth: i32 = 0;
    let mut start = 0;
    let bytes = args_str.as_bytes();

    for (i, &ch) in bytes.iter().enumerate() {
        match ch {
            b'(' => depth += 1,
            b')' => depth -= 1,
            b',' if depth == 0 => {
                args.push(args_str[start..i].trim());
                start = i + 1;
            }
            _ => {}
        }
    }
    let last = args_str[start..].trim();
    if !last.is_empty() {
        args.push(last);
    }
    args
}

/// CSS clamp(min, val, max) (cssValueParser.ts:552 `resolveClamp`).
///
/// `inner` = clamp 괄호 안쪽. `max(min, min(val, max))`. 인자 3개 아니면 `None`.
fn resolve_clamp(inner: &str, ctx: &CssValueContext) -> Option<f32> {
    let args = split_css_function_args(inner);
    if args.len() != 3 {
        return None;
    }
    let min_val = resolve_css_size_value(args[0], ctx)?;
    let val_val = resolve_css_size_value(args[1], ctx)?;
    let max_val = resolve_css_size_value(args[2], ctx)?;
    Some(min_val.max(val_val.min(max_val)))
}

/// CSS min(a, b, ...) (cssValueParser.ts:583 `resolveCSSMin`).
fn resolve_css_min(inner: &str, ctx: &CssValueContext) -> Option<f32> {
    let args = split_css_function_args(inner);
    if args.is_empty() {
        return None;
    }
    let mut acc = f32::INFINITY;
    for arg in args {
        let v = resolve_css_size_value(arg, ctx)?;
        acc = acc.min(v);
    }
    Some(acc)
}

/// CSS max(a, b, ...) (cssValueParser.ts:613 `resolveCSSMax`).
fn resolve_css_max(inner: &str, ctx: &CssValueContext) -> Option<f32> {
    let args = split_css_function_args(inner);
    if args.is_empty() {
        return None;
    }
    let mut acc = f32::NEG_INFINITY;
    for arg in args {
        let v = resolve_css_size_value(arg, ctx)?;
        acc = acc.max(v);
    }
    Some(acc)
}

// ============================================
// calc() 재귀 하강 파서 (cssValueParser.ts:660)
// ============================================

#[derive(Debug, Clone, Copy, PartialEq)]
enum CalcToken {
    Number(f32),
    /// '+' '-' '*' '/'
    Op(u8),
    LParen,
    RParen,
}

/// calc() 표현식을 px 값으로 계산 (cssValueParser.ts:660 `resolveCalc`).
///
/// 지원 연산 +,-,*,/ / 괄호 중첩(최대 깊이 10). `inner` = calc 괄호 안쪽.
pub fn resolve_calc(inner: &str, ctx: &CssValueContext) -> Option<f32> {
    let tokens = tokenize_calc(inner.trim(), ctx)?;
    if tokens.is_empty() {
        return None;
    }
    let mut parser = CalcParser { tokens, pos: 0 };
    let result = parser.parse_expr(0)?;
    // 모든 토큰 소비 확인 (원본: pos !== tokens.length → undefined)
    if parser.pos != parser.tokens.len() {
        return None;
    }
    Some(result)
}

struct CalcParser {
    tokens: Vec<CalcToken>,
    pos: usize,
}

impl CalcParser {
    #[inline]
    fn peek(&self) -> Option<CalcToken> {
        self.tokens.get(self.pos).copied()
    }
    #[inline]
    fn consume(&mut self) -> Option<CalcToken> {
        let t = self.tokens.get(self.pos).copied();
        if t.is_some() {
            self.pos += 1;
        }
        t
    }

    /// calcExpr → term (('+'/'-') term)*
    fn parse_expr(&mut self, depth: u32) -> Option<f32> {
        if depth > CALC_MAX_DEPTH {
            return None;
        }
        let mut result = self.parse_term(depth)?;
        while let Some(CalcToken::Op(op)) = self.peek() {
            if op != b'+' && op != b'-' {
                break;
            }
            self.consume();
            let right = self.parse_term(depth)?;
            result = if op == b'+' { result + right } else { result - right };
        }
        Some(result)
    }

    /// term → factor (('*'/'/') factor)*
    fn parse_term(&mut self, depth: u32) -> Option<f32> {
        let mut result = self.parse_factor(depth)?;
        while let Some(CalcToken::Op(op)) = self.peek() {
            if op != b'*' && op != b'/' {
                break;
            }
            self.consume();
            let right = self.parse_factor(depth)?;
            if op == b'/' {
                if right == 0.0 {
                    return None; // 0으로 나누기 방지 (원본 동일)
                }
                result /= right;
            } else {
                result *= right;
            }
        }
        Some(result)
    }

    /// factor → number | '(' calcExpr ')'
    fn parse_factor(&mut self, depth: u32) -> Option<f32> {
        match self.peek()? {
            CalcToken::LParen => {
                self.consume();
                let result = self.parse_expr(depth + 1)?;
                if self.peek() != Some(CalcToken::RParen) {
                    return None;
                }
                self.consume();
                Some(result)
            }
            CalcToken::Number(n) => {
                self.consume();
                Some(n)
            }
            _ => None,
        }
    }
}

/// calc() 표현식을 토큰으로 분리 (cssValueParser.ts:751 `tokenizeCalc`).
///
/// 단위 포함 숫자는 즉시 px 로 변환. 해석 실패 / 알 수 없는 문자 → `None` (원본 `[]`).
fn tokenize_calc(expr: &str, ctx: &CssValueContext) -> Option<Vec<CalcToken>> {
    let bytes = expr.as_bytes();
    let mut tokens: Vec<CalcToken> = Vec::new();
    let mut i = 0;

    while i < bytes.len() {
        let ch = bytes[i];

        // 공백
        if ch == b' ' || ch == b'\t' || ch == b'\n' {
            i += 1;
            continue;
        }
        // 괄호
        if ch == b'(' {
            tokens.push(CalcToken::LParen);
            i += 1;
            continue;
        }
        if ch == b')' {
            tokens.push(CalcToken::RParen);
            i += 1;
            continue;
        }
        // 연산자 +, *, /
        if ch == b'+' || ch == b'*' || ch == b'/' {
            tokens.push(CalcToken::Op(ch));
            i += 1;
            continue;
        }
        // '-' 는 연산자 또는 음수 부호
        if ch == b'-' {
            let prev = tokens.last().copied();
            let is_op = matches!(prev, Some(CalcToken::Number(_)) | Some(CalcToken::RParen));
            if is_op {
                tokens.push(CalcToken::Op(b'-'));
                i += 1;
                continue;
            }
            // 음수 숫자 시작 → 아래 숫자 파싱으로
        }
        // 숫자 + 단위
        if ch == b'-' || ch == b'.' || ch.is_ascii_digit() {
            let start = i;
            if bytes[i] == b'-' {
                i += 1;
            }
            while i < bytes.len() && (bytes[i].is_ascii_digit() || bytes[i] == b'.') {
                i += 1;
            }
            // 단위 (알파벳 소문자)
            while i < bytes.len() && bytes[i].is_ascii_lowercase() {
                i += 1;
            }
            // % 단위
            if i < bytes.len() && bytes[i] == b'%' {
                i += 1;
            }
            let full_value = &expr[start..i];
            match resolve_unit_value(full_value, ctx) {
                Some(v) => tokens.push(CalcToken::Number(v)),
                None => return None, // 해석 실패 → 파싱 중단 (원본 [])
            }
            continue;
        }
        // 알 수 없는 문자 → 실패
        return None;
    }

    Some(tokens)
}

#[cfg(test)]
mod tests {
    use super::*;

    const EPS: f32 = 0.01;

    fn approx(a: Option<f32>, b: f32) -> bool {
        matches!(a, Some(v) if (v - b).abs() < EPS)
    }

    fn ctx() -> CssValueContext {
        CssValueContext::default()
    }

    // ---- 기본 단위 ----

    #[test]
    fn px_value() {
        assert_eq!(resolve_css_size_value("100px", &ctx()), Some(100.0));
        assert_eq!(resolve_css_size_value("0px", &ctx()), Some(0.0));
        assert_eq!(resolve_css_size_value("-12px", &ctx()), Some(-12.0));
        assert_eq!(resolve_css_size_value("12.5px", &ctx()), Some(12.5));
    }

    #[test]
    fn unitless_number() {
        assert_eq!(resolve_css_size_value("42", &ctx()), Some(42.0));
        // 3.25 = PI 무관 소수 (clippy approx_constant 회피)
        assert_eq!(resolve_css_size_value("3.25", &ctx()), Some(3.25));
    }

    #[test]
    fn rem_em_use_font_size() {
        // 기본 rootFs=16, parentFs=16
        assert_eq!(resolve_css_size_value("2rem", &ctx()), Some(32.0));
        assert_eq!(resolve_css_size_value("1.5em", &ctx()), Some(24.0));
        let c = CssValueContext {
            root_font_size: Some(10.0),
            parent_size: Some(20.0),
            ..Default::default()
        };
        assert_eq!(resolve_css_size_value("2rem", &c), Some(20.0));
        assert_eq!(resolve_css_size_value("2em", &c), Some(40.0));
    }

    #[test]
    fn rem_checked_before_em() {
        // "rem" 이 "em" 으로 끝나므로 rem 이 먼저 매칭돼야 함
        let c = CssValueContext {
            root_font_size: Some(10.0),
            parent_size: Some(100.0),
            ..Default::default()
        };
        // rem → rootFs(10)*3 = 30 (em 이면 parentFs(100)*3 = 300)
        assert_eq!(resolve_css_size_value("3rem", &c), Some(30.0));
    }

    #[test]
    fn viewport_units() {
        let c = CssValueContext {
            viewport_width: Some(1000.0),
            viewport_height: Some(500.0),
            ..Default::default()
        };
        assert_eq!(resolve_css_size_value("50vw", &c), Some(500.0));
        assert_eq!(resolve_css_size_value("10vh", &c), Some(50.0));
        assert_eq!(resolve_css_size_value("100vmin", &c), Some(500.0)); // min(1000,500)
        assert_eq!(resolve_css_size_value("100vmax", &c), Some(1000.0)); // max(1000,500)
    }

    #[test]
    fn physical_units() {
        assert!(approx(resolve_css_size_value("1in", &ctx()), 96.0));
        assert!(approx(resolve_css_size_value("2.54cm", &ctx()), 96.0));
        assert!(approx(resolve_css_size_value("25.4mm", &ctx()), 96.0));
        assert!(approx(resolve_css_size_value("1pc", &ctx()), 16.0));
        assert!(approx(resolve_css_size_value("72pt", &ctx()), 96.0));
    }

    #[test]
    fn ch_ex_half_font_size() {
        let c = CssValueContext { parent_size: Some(20.0), ..Default::default() };
        assert_eq!(resolve_css_size_value("2ch", &c), Some(20.0)); // 2*20*0.5
        assert_eq!(resolve_css_size_value("2ex", &c), Some(20.0));
    }

    #[test]
    fn percent_needs_container() {
        let c = CssValueContext { container_size: Some(800.0), ..Default::default() };
        assert_eq!(resolve_css_size_value("50%", &c), Some(400.0));
        // container 미제공 → 해석 불가
        assert_eq!(resolve_css_size_value("50%", &ctx()), None);
    }

    // ---- 키워드 / 빈값 ----

    #[test]
    fn intrinsic_keywords() {
        assert_eq!(resolve_css_size_value("fit-content", &ctx()), Some(FIT_CONTENT));
        assert_eq!(resolve_css_size_value("min-content", &ctx()), Some(MIN_CONTENT));
        assert_eq!(resolve_css_size_value("max-content", &ctx()), Some(MAX_CONTENT));
    }

    #[test]
    fn empty_and_auto_none() {
        assert_eq!(resolve_css_size_value("", &ctx()), None);
        assert_eq!(resolve_css_size_value("   ", &ctx()), None);
        assert_eq!(resolve_css_size_value("auto", &ctx()), None);
    }

    #[test]
    fn garbage_none() {
        assert_eq!(resolve_css_size_value("abc", &ctx()), None);
        assert_eq!(resolve_css_size_value("px", &ctx()), None);
    }

    // ---- env() ----

    #[test]
    fn env_safe_area_zero() {
        assert_eq!(resolve_css_size_value("env(safe-area-inset-top)", &ctx()), Some(0.0));
        // fallback 이 있어도 known var 이면 0
        assert_eq!(
            resolve_css_size_value("env(safe-area-inset-bottom, 20px)", &ctx()),
            Some(0.0)
        );
    }

    #[test]
    fn env_unknown_uses_fallback() {
        assert_eq!(resolve_css_size_value("env(foo, 12px)", &ctx()), Some(12.0));
        // fallback 없는 unknown → 0
        assert_eq!(resolve_css_size_value("env(foo)", &ctx()), Some(0.0));
    }

    // ---- clamp / min / max ----

    #[test]
    fn clamp_basic() {
        let c = CssValueContext { container_size: Some(1000.0), ..Default::default() };
        // clamp(100px, 50%, 500px) → 50%=500 → clamp = 500
        assert_eq!(resolve_css_size_value("clamp(100px, 50%, 500px)", &c), Some(500.0));
        // clamp(100px, 10%, 500px) → 10%=100 → max(100, min(100,500))=100
        assert_eq!(resolve_css_size_value("clamp(100px, 10%, 500px)", &c), Some(100.0));
        // clamp(100px, 90%, 500px) → 90%=900 → min(900,500)=500 → max(100,500)=500
        assert_eq!(resolve_css_size_value("clamp(100px, 90%, 500px)", &c), Some(500.0));
    }

    #[test]
    fn clamp_wrong_arity_none() {
        assert_eq!(resolve_css_size_value("clamp(100px, 200px)", &ctx()), None);
    }

    #[test]
    fn css_min_max() {
        let c = CssValueContext { container_size: Some(1000.0), ..Default::default() };
        assert_eq!(resolve_css_size_value("min(100px, 50%)", &c), Some(100.0)); // min(100,500)
        assert_eq!(resolve_css_size_value("max(100px, 50%)", &c), Some(500.0)); // max(100,500)
        assert_eq!(resolve_css_size_value("min(300px, 200px, 400px)", &ctx()), Some(200.0));
    }

    #[test]
    fn nested_function_args() {
        // min() 내부 calc — split 이 괄호 깊이를 추적해야 정상 분리
        let c = CssValueContext { container_size: Some(1000.0), ..Default::default() };
        // min(calc(50% - 100px), 500px) → 400, 500 → 400
        assert_eq!(
            resolve_css_size_value("min(calc(50% - 100px), 500px)", &c),
            Some(400.0)
        );
    }

    // ---- calc() ----

    #[test]
    fn calc_add_sub() {
        assert_eq!(resolve_calc("100px + 20px", &ctx()), Some(120.0));
        assert_eq!(resolve_calc("100px - 30px", &ctx()), Some(70.0));
    }

    #[test]
    fn calc_mul_div_precedence() {
        // + 보다 * 우선
        assert_eq!(resolve_calc("10px + 2 * 3px", &ctx()), Some(16.0));
        assert_eq!(resolve_calc("100px / 4", &ctx()), Some(25.0));
    }

    #[test]
    fn calc_parens() {
        assert_eq!(resolve_calc("(10px + 2px) * 3", &ctx()), Some(36.0));
    }

    #[test]
    fn calc_percent() {
        let c = CssValueContext { container_size: Some(800.0), ..Default::default() };
        // calc(50% - 10px) → 400 - 10 = 390
        assert_eq!(resolve_css_size_value("calc(50% - 10px)", &c), Some(390.0));
    }

    #[test]
    fn calc_negative_number() {
        // 선행 음수 부호는 연산자가 아니라 음수 리터럴
        assert_eq!(resolve_calc("-10px + 30px", &ctx()), Some(20.0));
    }

    #[test]
    fn calc_div_by_zero_none() {
        assert_eq!(resolve_calc("100px / 0", &ctx()), None);
    }

    #[test]
    fn calc_incomplete_none() {
        assert_eq!(resolve_calc("100px +", &ctx()), None);
        assert_eq!(resolve_calc("(100px", &ctx()), None);
    }

    #[test]
    fn calc_garbage_none() {
        assert_eq!(resolve_calc("100px @ 20px", &ctx()), None);
    }

    // ---- parse_leading_f32 (JS parseFloat 근사) ----

    #[test]
    fn parse_leading_trailing_garbage() {
        // JS parseFloat("12abc")===12 — 단위 파서 경로가 아닌 순수 숫자 접미
        assert_eq!(parse_leading_f32("12abc"), Some(12.0));
        assert_eq!(parse_leading_f32("3.5xyz"), Some(3.5));
        assert_eq!(parse_leading_f32("abc"), None);
        assert_eq!(parse_leading_f32("1e2"), Some(100.0));
    }

    // ---- font shorthand ----

    #[test]
    fn font_shorthand_extracts_style_weight_size_line_height_and_family() {
        assert_eq!(
            parse_font_shorthand("italic 700 16px/24px Inter, sans-serif"),
            Some(ParsedFont {
                font_style: Some("italic".to_string()),
                font_weight: Some("700".to_string()),
                font_size: Some("16px".to_string()),
                line_height: Some("24px".to_string()),
                font_family: Some("Inter, sans-serif".to_string()),
            })
        );
    }

    #[test]
    fn font_shorthand_ignores_normal_and_preserves_quoted_family() {
        assert_eq!(
            parse_font_shorthand("normal bold 1.5rem \"Inter Tight\""),
            Some(ParsedFont {
                font_style: None,
                font_weight: Some("bold".to_string()),
                font_size: Some("1.5rem".to_string()),
                line_height: None,
                font_family: Some("\"Inter Tight\"".to_string()),
            })
        );
    }

    #[test]
    fn font_shorthand_empty_is_none() {
        assert_eq!(parse_font_shorthand(""), None);
        assert_eq!(parse_font_shorthand("   "), None);
    }

    // ---- border shorthand ----

    #[test]
    fn border_shorthand_extracts_width_style_and_color_order_independent() {
        assert_eq!(
            parse_border_shorthand("solid 2px red"),
            Some(ParsedBorder {
                width: 2.0,
                style: "solid".to_string(),
                color: "red".to_string(),
            })
        );
    }

    #[test]
    fn border_shorthand_uses_js_defaults_and_parse_float_width() {
        assert_eq!(
            parse_border_shorthand("#ccc"),
            Some(ParsedBorder {
                width: 0.0,
                style: "none".to_string(),
                color: "#ccc".to_string(),
            })
        );
        assert_eq!(
            parse_border_shorthand("1.5rem dashed #f00"),
            Some(ParsedBorder {
                width: 1.5,
                style: "dashed".to_string(),
                color: "#f00".to_string(),
            })
        );
    }

    #[test]
    fn border_shorthand_empty_is_none() {
        assert_eq!(parse_border_shorthand(""), None);
        assert_eq!(parse_border_shorthand("  "), None);
    }
}
