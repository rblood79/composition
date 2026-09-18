/**
 * CSS 값 파서 통합 모듈
 *
 * 분산된 CSS 값 파싱 로직을 하나로 통합하여
 * 일관된 단위 해석과 calc() 지원을 제공한다.
 *
 * 지원 단위: px, %, vh, vw, em, rem, calc(), clamp(), min(), max(), fit-content, min-content, max-content
 *
 * @since 2026-02-16 CSS 엔진 업그레이드
 */

// ============================================
// 타입 정의
// ============================================

/**
 * CSS 값 해석에 필요한 컨텍스트
 *
 * 각 단위의 기준값을 제공한다.
 * 미제공 시 기본값: viewportWidth=1920, viewportHeight=1080, rootFontSize=16
 */
/**
 * CSS 변수 스코프
 *
 * var() 함수 해석에 필요한 변수 이름→값 매핑.
 * 요소의 조상 체인에서 수집된 CSS custom properties.
 */
export interface CSSVariableScope {
  /** 변수 이름(--로 시작) → 값 매핑 */
  variables: Record<string, string>;
  /**
   * W3-7: DOM fallback 활성화 플래그
   *
   * true인 경우, variables 딕셔너리에서 변수를 찾지 못하면
   * document.documentElement의 computed style에서 CSS 변수를 조회한다.
   * 이를 통해 디자인 토큰(color/spacing/typography)이 var()로 참조될 때
   * 정상 해석된다.
   *
   * 기본값: false (기존 동작 유지)
   */
  domFallback?: boolean;
  /**
   * W3-7: 외부 DOM 변수 조회 함수 (DI용)
   *
   * domFallback이 true일 때 사용되는 조회 함수.
   * 기본값: cssVariableReader.resolveVariableFromDOM
   *
   * 테스트 환경에서 mock 함수를 주입할 수 있다.
   */
  domResolver?: (varName: string) => string;
}

export interface CSSValueContext {
  /** em 단위 기준 (부모 font-size, px) */
  parentSize?: number;
  /** % 단위 기준 (부모 content-box 또는 컨테이너 크기, px) */
  containerSize?: number;
  /** vw 기준 (기본 1920) */
  viewportWidth?: number;
  /** vh 기준 (기본 1080) */
  viewportHeight?: number;
  /** rem 기준 (기본 16) */
  rootFontSize?: number;
  /** CSS 변수 스코프 (var() 해석용) */
  variableScope?: CSSVariableScope;
}

/** CSS intrinsic sizing sentinel 값 */
export const FIT_CONTENT = -2;
export const MIN_CONTENT = -3;
export const MAX_CONTENT = -4;

/**
 * W3-7: DOM fallback이 활성화된 CSSVariableScope 생성
 *
 * 요소의 커스텀 프로퍼티(인라인 변수)와 함께
 * document.documentElement의 CSS 변수(디자인 토큰)를 fallback으로 조회한다.
 *
 * @param inlineVariables - 요소 조상 체인에서 수집된 인라인 CSS 변수
 * @param domResolver - 테스트용 DOM 조회 함수 오버라이드
 * @returns DOM fallback이 활성화된 CSSVariableScope
 */
export function createVariableScopeWithDOMFallback(
  inlineVariables: Record<string, string> = {},
  domResolver?: (varName: string) => string,
): CSSVariableScope {
  return {
    variables: { ...inlineVariables },
    domFallback: true,
    ...(domResolver ? { domResolver } : {}),
  };
}

/**
 * border shorthand 파싱 결과
 */
export interface ParsedBorder {
  width: number;
  style: string;
  color: string;
}

// ============================================
// 기본 상수
// ============================================

/** 기본 뷰포트 너비 */
const DEFAULT_VIEWPORT_WIDTH = 1920;
/** 기본 뷰포트 높이 */
const DEFAULT_VIEWPORT_HEIGHT = 1080;

/**
 * 레이아웃 run 의 vw/vh 기준 viewport (border-box page 크기 = breakpoint).
 *
 * ctx 에 viewportWidth/Height 가 없을 때의 폴백. `calculateFullTreeLayout` 이 run 시작 시
 * `setLayoutViewport` 로 page 크기를 넣고, 엔진에도 같은 값을 `setViewport` 로 넘긴다.
 * **Why**: Preview iframe 은 breakpoint 폭 안에 있어 `50vw` 가 breakpoint 기준으로 풀리는데,
 * Canvas 쪽 TS 선해석 (applyCommonEngineStyle → parseCSSPropWithContext) 과 엔진 모두
 * 상수 1920×1080 을 써 390 breakpoint 에서 195 vs 960 으로 갈렸다 (2026-09-19). parse 호출처
 * 14곳이 viewport 인자를 안 넘기므로 run 단위 폴백 하나로 채운다.
 */
let layoutViewportWidth: number | undefined;
let layoutViewportHeight: number | undefined;

export function setLayoutViewport(
  viewport: { width: number; height: number } | null,
): void {
  layoutViewportWidth = viewport?.width;
  layoutViewportHeight = viewport?.height;
}

export function getLayoutViewport(): { width: number; height: number } {
  return {
    width: layoutViewportWidth ?? DEFAULT_VIEWPORT_WIDTH,
    height: layoutViewportHeight ?? DEFAULT_VIEWPORT_HEIGHT,
  };
}
/** 기본 루트 폰트 크기 */
const DEFAULT_ROOT_FONT_SIZE = 16;

// ============================================
// var() 해석
// ============================================

/** var() 재귀 해석 최대 깊이 (순환 참조 방지) */
const VAR_MAX_DEPTH = 10;

/**
 * CSS var() 함수를 해석하여 실제 값으로 치환
 *
 * var(--name) 또는 var(--name, fallback) 형식을 지원한다.
 * 중첩된 var()도 재귀적으로 해석한다.
 *
 * @param value - var()가 포함된 CSS 값 문자열
 * @param scope - CSS 변수 스코프
 * @param depth - 현재 재귀 깊이 (내부용)
 * @returns var()가 해석된 문자열, 또는 해석 실패 시 원본 반환
 *
 * @example
 * resolveVar('var(--spacing)', { variables: { '--spacing': '16px' } })
 * // '16px'
 *
 * resolveVar('var(--missing, 8px)', { variables: {} })
 * // '8px'
 */
export function resolveVar(
  value: string,
  scope: CSSVariableScope,
  depth: number = 0,
): string {
  // 재귀 깊이 제한
  if (depth >= VAR_MAX_DEPTH) return value;

  // var() 패턴이 없으면 그대로 반환
  if (!value.includes('var(')) return value;

  // 가장 안쪽 var()부터 해석 (중첩 처리)
  return value.replace(
    /var\(([^()]*)\)/g,
    (_match: string, content: string): string => {
      // content: "--name" 또는 "--name, fallback"
      const commaIdx = content.indexOf(',');

      let varName: string;
      let fallbackValue: string | undefined;

      if (commaIdx === -1) {
        varName = content.trim();
      } else {
        varName = content.slice(0, commaIdx).trim();
        fallbackValue = content.slice(commaIdx + 1).trim();
      }

      // 1차: 인메모리 변수 딕셔너리 조회
      const resolved = scope.variables[varName];

      if (resolved !== undefined) {
        // 해석된 값에 var()가 중첩되어 있을 수 있음
        return resolveVar(resolved, scope, depth + 1);
      }

      // 2차: W3-7 DOM fallback 조회 (디자인 토큰 지원)
      if (scope.domFallback) {
        const domResolved = scope.domResolver
          ? scope.domResolver(varName)
          : resolveVariableFromDOMDefault(varName);
        if (domResolved) {
          // DOM에서 조회한 값을 캐시하여 동일 변수 재조회 방지
          scope.variables[varName] = domResolved;
          return resolveVar(domResolved, scope, depth + 1);
        }
      }

      // fallback 값 사용
      if (fallbackValue !== undefined) {
        return resolveVar(fallbackValue, scope, depth + 1);
      }

      // 해석 실패: 원본 유지
      return _match;
    },
  );
}

/**
 * W3-7: DOM에서 CSS 변수를 조회하는 기본 구현
 *
 * cssVariableReader.ts의 resolveVariableFromDOM을 직접 import하면
 * 순환 의존 위험이 있으므로, 동일한 로직을 인라인으로 구현한다.
 * 브라우저 환경이 아니면 빈 문자열을 반환한다.
 */
function resolveVariableFromDOMDefault(varName: string): string {
  if (typeof document === 'undefined') return '';
  try {
    return getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  } catch {
    return '';
  }
}

// ============================================
// 메인 파서
// ============================================

// ============================================
// env() 해석
// ============================================

/**
 * 캔버스 환경에서 알려진 safe-area-inset 변수 목록
 *
 * 캔버스 환경에서는 safe area가 없으므로 모두 0으로 처리한다.
 */
const KNOWN_ENV_VARS = new Set([
  'safe-area-inset-top',
  'safe-area-inset-bottom',
  'safe-area-inset-left',
  'safe-area-inset-right',
]);

/**
 * CSS env() 함수를 해석하여 px 값으로 반환
 *
 * env(name) 또는 env(name, fallback) 형식을 지원한다.
 * 캔버스 환경에서 safe-area-inset-* 변수는 0으로 처리한다.
 * 알 수 없는 변수는 fallback 값을 사용하거나 0을 반환한다.
 *
 * @param envExpr - env() 전체 문자열 (예: "env(safe-area-inset-top, 20px)")
 * @param ctx - 단위 해석 컨텍스트 (fallback 값 계산용)
 * @returns px 값 또는 undefined
 */
function resolveEnv(envExpr: string, ctx: CSSValueContext): number | undefined {
  // "env(" (4글자) ~ ")" (마지막 1글자) 제거
  const inner = envExpr.slice(4, -1);
  const commaIdx = inner.indexOf(',');

  let varName: string;
  let fallbackExpr: string | undefined;

  if (commaIdx === -1) {
    varName = inner.trim();
  } else {
    varName = inner.slice(0, commaIdx).trim();
    fallbackExpr = inner.slice(commaIdx + 1).trim();
  }

  // 알려진 safe-area-inset-* 변수: 캔버스 환경에서 항상 0
  if (KNOWN_ENV_VARS.has(varName)) {
    return 0;
  }

  // 알 수 없는 변수: fallback 값 사용
  if (fallbackExpr !== undefined) {
    return resolveCSSSizeValue(fallbackExpr, ctx);
  }

  // fallback 없는 알 수 없는 변수: 0 반환
  return 0;
}

// ============================================
// 메인 파서
// ============================================

/**
 * CSS 크기 값을 px 숫자로 해석하는 통합 함수
 *
 * @param value - CSS 값 (number, string, undefined 등)
 * @param ctx - 단위 해석 컨텍스트
 * @param fallback - 해석 실패 시 반환값 (기본 undefined)
 * @returns px 단위 숫자, sentinel 값, 또는 fallback
 *
 * @example
 * resolveCSSSizeValue('100px', {}) // 100
 * resolveCSSSizeValue('50%', { containerSize: 800 }) // 400
 * resolveCSSSizeValue('100vh', { viewportHeight: 1080 }) // 1080
 * resolveCSSSizeValue('2rem', {}) // 32
 * resolveCSSSizeValue('calc(100% - 20px)', { containerSize: 800 }) // 780
 * resolveCSSSizeValue('fit-content', {}) // -2 (FIT_CONTENT sentinel)
 * resolveCSSSizeValue('env(safe-area-inset-top)', {}) // 0
 */
export function resolveCSSSizeValue(
  value: unknown,
  ctx: CSSValueContext = {},
  fallback?: number,
): number | undefined {
  // var() 치환: variableScope가 있고 값에 var()가 포함된 경우
  if (typeof value === 'string' && value.includes('var(') && ctx.variableScope) {
    const resolved = resolveVar(value, ctx.variableScope);
    return resolveCSSSizeValue(resolved, ctx, fallback);
  }

  if (value === undefined || value === null || value === '' || value === 'auto') {
    return fallback;
  }

  // 숫자는 그대로 반환
  if (typeof value === 'number') {
    return value;
  }

  if (typeof value !== 'string') {
    return fallback;
  }

  const trimmed = value.trim();

  // intrinsic sizing 키워드
  if (trimmed === 'fit-content') return FIT_CONTENT;
  if (trimmed === 'min-content') return MIN_CONTENT;
  if (trimmed === 'max-content') return MAX_CONTENT;

  // env() 함수
  if (trimmed.startsWith('env(') && trimmed.endsWith(')')) {
    const result = resolveEnv(trimmed, ctx);
    return result ?? fallback;
  }

  // calc() 표현식
  if (trimmed.startsWith('calc(') && trimmed.endsWith(')')) {
    const expr = trimmed.slice(5, -1);
    const result = resolveCalc(expr, ctx);
    return result ?? fallback;
  }

  // clamp(min, val, max) 함수
  if (trimmed.startsWith('clamp(') && trimmed.endsWith(')')) {
    const result = resolveClamp(trimmed, ctx);
    return result ?? fallback;
  }

  // min(a, b, ...) 함수
  if (trimmed.startsWith('min(') && trimmed.endsWith(')')) {
    const result = resolveCSSMin(trimmed, ctx);
    return result ?? fallback;
  }

  // max(a, b, ...) 함수
  if (trimmed.startsWith('max(') && trimmed.endsWith(')')) {
    const result = resolveCSSMax(trimmed, ctx);
    return result ?? fallback;
  }

  // 단위별 해석
  return resolveUnitValue(trimmed, ctx) ?? fallback;
}

/**
 * 단위가 포함된 단일 CSS 값 해석
 *
 * rem은 em보다 먼저 검사해야 한다 ('rem'이 'em'으로 끝나므로).
 */
function resolveUnitValue(
  trimmed: string,
  ctx: CSSValueContext,
): number | undefined {
  // px 단위
  if (trimmed.endsWith('px')) {
    const num = parseFloat(trimmed);
    return isNaN(num) ? undefined : num;
  }

  // rem 단위 (em보다 먼저 검사)
  if (trimmed.endsWith('rem')) {
    const num = parseFloat(trimmed);
    if (isNaN(num)) return undefined;
    const rootFs = ctx.rootFontSize ?? DEFAULT_ROOT_FONT_SIZE;
    return num * rootFs;
  }

  // em 단위
  if (trimmed.endsWith('em')) {
    const num = parseFloat(trimmed);
    if (isNaN(num)) return undefined;
    const parentFs = ctx.parentSize ?? DEFAULT_ROOT_FONT_SIZE;
    return num * parentFs;
  }

  // vh 단위
  if (trimmed.endsWith('vh')) {
    const num = parseFloat(trimmed);
    if (isNaN(num)) return undefined;
    const vh = ctx.viewportHeight ?? layoutViewportHeight ?? DEFAULT_VIEWPORT_HEIGHT;
    return (num / 100) * vh;
  }

  // vw 단위
  if (trimmed.endsWith('vw')) {
    const num = parseFloat(trimmed);
    if (isNaN(num)) return undefined;
    const vw = ctx.viewportWidth ?? layoutViewportWidth ?? DEFAULT_VIEWPORT_WIDTH;
    return (num / 100) * vw;
  }

  // vmin 단위 (vw, vh보다 먼저 검사해야 함 — 'vmin'이 'min'으로 끝나지 않으므로 순서 무관하지만 명시적으로 배치)
  if (trimmed.endsWith('vmin')) {
    const num = parseFloat(trimmed);
    if (isNaN(num)) return undefined;
    const vw = ctx.viewportWidth ?? layoutViewportWidth ?? DEFAULT_VIEWPORT_WIDTH;
    const vh = ctx.viewportHeight ?? layoutViewportHeight ?? DEFAULT_VIEWPORT_HEIGHT;
    return (num / 100) * Math.min(vw, vh);
  }

  // vmax 단위
  if (trimmed.endsWith('vmax')) {
    const num = parseFloat(trimmed);
    if (isNaN(num)) return undefined;
    const vw = ctx.viewportWidth ?? layoutViewportWidth ?? DEFAULT_VIEWPORT_WIDTH;
    const vh = ctx.viewportHeight ?? layoutViewportHeight ?? DEFAULT_VIEWPORT_HEIGHT;
    return (num / 100) * Math.max(vw, vh);
  }

  // in 단위 (1in = 96px)
  if (trimmed.endsWith('in')) {
    const num = parseFloat(trimmed);
    return isNaN(num) ? undefined : num * 96;
  }

  // cm 단위 (1cm = 96/2.54px)
  if (trimmed.endsWith('cm')) {
    const num = parseFloat(trimmed);
    return isNaN(num) ? undefined : num * (96 / 2.54);
  }

  // mm 단위 (1mm = 96/25.4px)
  if (trimmed.endsWith('mm')) {
    const num = parseFloat(trimmed);
    return isNaN(num) ? undefined : num * (96 / 25.4);
  }

  // pc 단위 (1pc = 16px) — pt보다 먼저 검사 ('pc'가 'c'로 끝나므로 순서 무관하지만 명시적 배치)
  if (trimmed.endsWith('pc')) {
    const num = parseFloat(trimmed);
    return isNaN(num) ? undefined : num * 16;
  }

  // pt 단위 (1pt = 96/72px)
  if (trimmed.endsWith('pt')) {
    const num = parseFloat(trimmed);
    return isNaN(num) ? undefined : num * (96 / 72);
  }

  // ch 단위 ('0' 문자 advance width 근사: fontSize * 0.5)
  if (trimmed.endsWith('ch')) {
    const num = parseFloat(trimmed);
    if (isNaN(num)) return undefined;
    const fontSize = ctx.parentSize ?? DEFAULT_ROOT_FONT_SIZE;
    return num * fontSize * 0.5;
  }

  // ex 단위 (x-height 근사: fontSize * 0.5)
  if (trimmed.endsWith('ex')) {
    const num = parseFloat(trimmed);
    if (isNaN(num)) return undefined;
    const fontSize = ctx.parentSize ?? DEFAULT_ROOT_FONT_SIZE;
    return num * fontSize * 0.5;
  }

  // % 단위
  if (trimmed.endsWith('%')) {
    const num = parseFloat(trimmed);
    if (isNaN(num)) return undefined;
    if (ctx.containerSize !== undefined) {
      return (num / 100) * ctx.containerSize;
    }
    // containerSize 미제공 시 해석 불가
    return undefined;
  }

  // 단위 없는 숫자 문자열
  const num = parseFloat(trimmed);
  return isNaN(num) ? undefined : num;
}

// ============================================
// CSS 함수 인자 분리 유틸리티
// ============================================

/**
 * CSS 함수의 인자를 괄호 깊이를 추적하며 쉼표로 분리
 *
 * 중첩된 함수 호출(예: calc() 내부의 괄호)을 올바르게 처리한다.
 *
 * @param argsStr - 괄호 안쪽 인자 문자열 (예: "100px, 50%, 500px")
 * @returns 분리된 인자 배열 (각 인자는 trim 됨)
 *
 * @example
 * splitCSSFunctionArgs('100px, 50%, 500px')
 * // ['100px', '50%', '500px']
 *
 * splitCSSFunctionArgs('100px, calc(50% - 10px), 500px')
 * // ['100px', 'calc(50% - 10px)', '500px']
 */
function splitCSSFunctionArgs(argsStr: string): string[] {
  const args: string[] = [];
  let depth = 0;
  let current = '';

  for (let i = 0; i < argsStr.length; i++) {
    const ch = argsStr[i];

    if (ch === '(') {
      depth++;
      current += ch;
    } else if (ch === ')') {
      depth--;
      current += ch;
    } else if (ch === ',' && depth === 0) {
      args.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }

  // 마지막 인자
  const last = current.trim();
  if (last.length > 0) {
    args.push(last);
  }

  return args;
}

// ============================================
// clamp() / min() / max() 함수
// ============================================

/**
 * CSS clamp(min, val, max) 함수를 해석
 *
 * clamp(min, val, max) → Math.max(min, Math.min(val, max))
 * 각 인자는 resolveCSSSizeValue()로 재귀 해석된다.
 *
 * @param expr - 전체 clamp() 문자열 (예: "clamp(100px, 50%, 500px)")
 * @param ctx - 단위 해석 컨텍스트
 * @returns 계산된 px 값 또는 undefined
 */
function resolveClamp(
  expr: string,
  ctx: CSSValueContext,
): number | undefined {
  // "clamp(" (6글자) ~ ")" (마지막 1글자) 제거
  const inner = expr.slice(6, -1);
  const args = splitCSSFunctionArgs(inner);

  if (args.length !== 3) return undefined;

  const minVal = resolveCSSSizeValue(args[0], ctx);
  const valVal = resolveCSSSizeValue(args[1], ctx);
  const maxVal = resolveCSSSizeValue(args[2], ctx);

  if (minVal === undefined || valVal === undefined || maxVal === undefined) {
    return undefined;
  }

  return Math.max(minVal, Math.min(valVal, maxVal));
}

/**
 * CSS min(a, b, ...) 함수를 해석
 *
 * min(a, b, ...) → Math.min(resolve(a), resolve(b), ...)
 * 각 인자는 resolveCSSSizeValue()로 재귀 해석된다.
 *
 * @param expr - 전체 min() 문자열 (예: "min(100px, 50%)")
 * @param ctx - 단위 해석 컨텍스트
 * @returns 계산된 px 값 또는 undefined
 */
function resolveCSSMin(
  expr: string,
  ctx: CSSValueContext,
): number | undefined {
  // "min(" (4글자) ~ ")" (마지막 1글자) 제거
  const inner = expr.slice(4, -1);
  const args = splitCSSFunctionArgs(inner);

  if (args.length < 1) return undefined;

  const resolved: number[] = [];
  for (const arg of args) {
    const val = resolveCSSSizeValue(arg, ctx);
    if (val === undefined) return undefined;
    resolved.push(val);
  }

  return Math.min(...resolved);
}

/**
 * CSS max(a, b, ...) 함수를 해석
 *
 * max(a, b, ...) → Math.max(resolve(a), resolve(b), ...)
 * 각 인자는 resolveCSSSizeValue()로 재귀 해석된다.
 *
 * @param expr - 전체 max() 문자열 (예: "max(100px, 50%)")
 * @param ctx - 단위 해석 컨텍스트
 * @returns 계산된 px 값 또는 undefined
 */
function resolveCSSMax(
  expr: string,
  ctx: CSSValueContext,
): number | undefined {
  // "max(" (4글자) ~ ")" (마지막 1글자) 제거
  const inner = expr.slice(4, -1);
  const args = splitCSSFunctionArgs(inner);

  if (args.length < 1) return undefined;

  const resolved: number[] = [];
  for (const arg of args) {
    const val = resolveCSSSizeValue(arg, ctx);
    if (val === undefined) return undefined;
    resolved.push(val);
  }

  return Math.max(...resolved);
}

// ============================================
// calc() 재귀 하강 파서
// ============================================

/** calc 토큰 타입 */
type CalcTokenType = 'number' | 'operator' | 'lparen' | 'rparen';

interface CalcToken {
  type: CalcTokenType;
  value: string;
  numericValue?: number;
}

/** calc() 파서 최대 재귀 깊이 */
const CALC_MAX_DEPTH = 10;

/**
 * calc() 표현식을 파싱하여 px 값으로 계산
 *
 * 지원 연산: +, -, *, /
 * 지원 단위: px, %, vh, vw, em, rem
 * 괄호 중첩 지원 (최대 깊이 10)
 *
 * @param expr - calc() 내부 표현식 문자열
 * @param ctx - 단위 해석 컨텍스트
 * @returns 계산된 px 값 또는 undefined
 */
export function resolveCalc(
  expr: string,
  ctx: CSSValueContext = {},
): number | undefined {
  const tokens = tokenizeCalc(expr.trim(), ctx);
  if (tokens.length === 0) return undefined;

  let pos = 0;

  function peek(): CalcToken | undefined {
    return tokens[pos];
  }

  function consume(): CalcToken | undefined {
    return tokens[pos++];
  }

  // calcExpr → term (('+'/'-') term)*
  function parseCalcExpr(depth: number): number | undefined {
    if (depth > CALC_MAX_DEPTH) return undefined;

    let result = parseTerm(depth);
    if (result === undefined) return undefined;

    while (peek()?.type === 'operator' && (peek()?.value === '+' || peek()?.value === '-')) {
      const op = consume()!.value;
      const right = parseTerm(depth);
      if (right === undefined) return undefined;
      result = op === '+' ? result + right : result - right;
    }

    return result;
  }

  // term → factor (('*'/'/') factor)*
  function parseTerm(depth: number): number | undefined {
    let result = parseFactor(depth);
    if (result === undefined) return undefined;

    while (peek()?.type === 'operator' && (peek()?.value === '*' || peek()?.value === '/')) {
      const op = consume()!.value;
      const right = parseFactor(depth);
      if (right === undefined) return undefined;
      if (op === '/') {
        if (right === 0) return undefined; // 0으로 나누기 방지
        result = result / right;
      } else {
        result = result * right;
      }
    }

    return result;
  }

  // factor → number_with_unit | '(' calcExpr ')'
  function parseFactor(depth: number): number | undefined {
    const token = peek();
    if (!token) return undefined;

    // 괄호
    if (token.type === 'lparen') {
      consume();
      const result = parseCalcExpr(depth + 1);
      if (result === undefined) return undefined;
      if (peek()?.type !== 'rparen') return undefined;
      consume();
      return result;
    }

    // 숫자 (단위 포함, 이미 px로 변환됨)
    if (token.type === 'number') {
      consume();
      return token.numericValue;
    }

    return undefined;
  }

  const result = parseCalcExpr(0);

  // 모든 토큰이 소비되었는지 확인
  if (pos !== tokens.length) return undefined;

  return result;
}

/**
 * calc() 표현식을 토큰으로 분리
 *
 * 단위가 포함된 숫자는 즉시 px 값으로 변환한다.
 */
function tokenizeCalc(expr: string, ctx: CSSValueContext): CalcToken[] {
  const tokens: CalcToken[] = [];
  let i = 0;

  while (i < expr.length) {
    const ch = expr[i];

    // 공백 건너뛰기
    if (ch === ' ' || ch === '\t' || ch === '\n') {
      i++;
      continue;
    }

    // 괄호
    if (ch === '(') {
      tokens.push({ type: 'lparen', value: '(' });
      i++;
      continue;
    }
    if (ch === ')') {
      tokens.push({ type: 'rparen', value: ')' });
      i++;
      continue;
    }

    // 연산자 (+, *, /)
    if (ch === '+' || ch === '*' || ch === '/') {
      tokens.push({ type: 'operator', value: ch });
      i++;
      continue;
    }

    // '-'는 연산자 또는 음수 부호
    if (ch === '-') {
      const prev = tokens[tokens.length - 1];
      if (prev && (prev.type === 'number' || prev.type === 'rparen')) {
        tokens.push({ type: 'operator', value: '-' });
        i++;
        continue;
      }
      // 음수 숫자의 시작 — 아래 숫자 파싱으로 진행
    }

    // 숫자 + 단위 파싱
    if (ch === '-' || ch === '.' || (ch >= '0' && ch <= '9')) {
      let numStr = '';
      // 부호
      if (expr[i] === '-') {
        numStr += '-';
        i++;
      }
      // 정수/소수부
      while (i < expr.length && ((expr[i] >= '0' && expr[i] <= '9') || expr[i] === '.')) {
        numStr += expr[i];
        i++;
      }
      // 단위부 (알파벳)
      let unit = '';
      while (i < expr.length && expr[i] >= 'a' && expr[i] <= 'z') {
        unit += expr[i];
        i++;
      }
      // % 단위
      if (i < expr.length && expr[i] === '%') {
        unit = '%';
        i++;
      }

      const fullValue = numStr + unit;
      const resolved = resolveUnitValue(fullValue, ctx);
      if (resolved !== undefined) {
        tokens.push({ type: 'number', value: fullValue, numericValue: resolved });
      } else {
        // 해석 실패 시 빈 배열 반환으로 파싱 중단
        return [];
      }
      continue;
    }

    // 알 수 없는 문자 → 파싱 실패
    return [];
  }

  return tokens;
}

// ============================================
// font shorthand 파서
// ============================================

export interface ParsedFont {
  fontStyle?: string;
  fontWeight?: string;
  fontSize?: string;
  lineHeight?: string;
  fontFamily?: string;
}

const FONT_STYLES = new Set(['italic', 'oblique', 'normal']);
const FONT_WEIGHTS = new Set(['bold', 'bolder', 'lighter', 'normal']);
const FONT_VARIANTS = new Set(['small-caps', 'normal']);

function isFontWeightNumber(token: string): boolean {
  return /^\d+$/.test(token) && !token.endsWith('px') && !token.endsWith('em');
}

function isFontSizeToken(token: string): boolean {
  if (isFontWeightNumber(token)) return false;
  return (
    /^[\d.]/.test(token) ||
    token.endsWith('px') ||
    token.endsWith('em') ||
    token.endsWith('rem') ||
    token.endsWith('%') ||
    token.endsWith('vw') ||
    token.endsWith('vh') ||
    ['xx-small', 'x-small', 'small', 'medium', 'large', 'x-large', 'xx-large', 'smaller', 'larger'].includes(token)
  );
}

export function parseFontShorthand(value: unknown): ParsedFont | undefined {
  if (typeof value !== 'string' || !value.trim()) {
    return undefined;
  }

  const trimmed = value.trim();

  const firstCommaIdx = trimmed.indexOf(',');

  let preFamilyStr: string;
  let remainingFamilyStr: string;

  if (firstCommaIdx === -1) {
    preFamilyStr = trimmed;
    remainingFamilyStr = '';
  } else {
    preFamilyStr = trimmed.slice(0, firstCommaIdx);
    remainingFamilyStr = trimmed.slice(firstCommaIdx);
  }

  const preTokens = preFamilyStr.trim().split(/\s+/);

  const result: ParsedFont = {};

  let sizeTokenIdx = -1;
  for (let i = 0; i < preTokens.length; i++) {
    const token = preTokens[i];
    const slashIdx = token.indexOf('/');

    if (slashIdx !== -1) {
      const sizePart = token.slice(0, slashIdx);
      const lineHeightPart = token.slice(slashIdx + 1);
      if (isFontSizeToken(sizePart)) {
        result.fontSize = sizePart;
        if (lineHeightPart) result.lineHeight = lineHeightPart;
        sizeTokenIdx = i;
        break;
      }
    } else if (
      isFontSizeToken(token) &&
      !FONT_STYLES.has(token) &&
      !FONT_WEIGHTS.has(token) &&
      !FONT_VARIANTS.has(token)
    ) {
      result.fontSize = token;
      sizeTokenIdx = i;
      break;
    }
  }

  const prePreTokens = sizeTokenIdx >= 0 ? preTokens.slice(0, sizeTokenIdx) : preTokens;
  for (const token of prePreTokens) {
    const lower = token.toLowerCase();
    if (FONT_STYLES.has(lower) && lower !== 'normal' && result.fontStyle === undefined) {
      result.fontStyle = lower;
    } else if (FONT_WEIGHTS.has(lower) && lower !== 'normal' && result.fontWeight === undefined) {
      result.fontWeight = lower;
    } else if (isFontWeightNumber(lower) && result.fontWeight === undefined) {
      result.fontWeight = lower;
    }
  }

  if (sizeTokenIdx >= 0 && sizeTokenIdx + 1 < preTokens.length) {
    const familyFirstWord = preTokens.slice(sizeTokenIdx + 1).join(' ');
    result.fontFamily = remainingFamilyStr
      ? familyFirstWord + remainingFamilyStr
      : familyFirstWord;
  } else if (remainingFamilyStr && sizeTokenIdx >= 0) {
    result.fontFamily = remainingFamilyStr.slice(1).trim();
  }

  return result;
}

// ============================================
// border shorthand 파서
// ============================================

/** border-style 키워드 목록 */
const BORDER_STYLES = new Set([
  'none', 'hidden', 'dotted', 'dashed', 'solid',
  'double', 'groove', 'ridge', 'inset', 'outset',
]);

/**
 * CSS border shorthand 파싱
 *
 * CSS border shorthand는 순서 무관하게 width, style, color를 지정할 수 있다.
 *
 * @param value - border shorthand 값 (예: "1px solid #ccc")
 * @returns 파싱된 border 객체 또는 undefined
 *
 * @example
 * parseBorderShorthand("1px solid #ccc")
 * // { width: 1, style: 'solid', color: '#ccc' }
 *
 * parseBorderShorthand("solid 2px red")
 * // { width: 2, style: 'solid', color: 'red' }
 */
export function parseBorderShorthand(value: unknown): ParsedBorder | undefined {
  if (typeof value !== 'string' || !value.trim()) {
    return undefined;
  }

  const parts = value.trim().split(/\s+/);

  let width: number | undefined;
  let style: string | undefined;
  let color: string | undefined;

  for (const part of parts) {
    // border-style 키워드 확인
    if (BORDER_STYLES.has(part.toLowerCase())) {
      style = part.toLowerCase();
      continue;
    }

    // 숫자 + 단위 (width)
    const num = parseFloat(part);
    if (!isNaN(num) && width === undefined) {
      width = num;
      continue;
    }

    // 나머지는 color로 취급
    if (color === undefined) {
      color = part;
    }
  }

  return {
    width: width ?? 0,
    style: style ?? 'none',
    color: color ?? '#000000',
  };
}
