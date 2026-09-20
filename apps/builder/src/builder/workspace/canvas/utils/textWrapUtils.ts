/**
 * CSS Text Wrapping Utilities (ADR-008)
 *
 * CanvasKit Paragraph API를 사용하여 CSS word-break / overflow-wrap를 에뮬레이션하는
 * 공유 유틸리티. nodeRendererText 의 needsFallback 분기가 사용.
 *
 * @since 2026-03-02
 */

import type { CanvasKit, ParagraphStyle, FontMgr } from "canvaskit-wasm";

// ============================================
// CanvasKit 단어 폭 측정 헬퍼
// ============================================

/**
 * CanvasKit ParagraphBuilder로 단일 토큰(단어/문자)의 폭을 측정한다.
 *
 * @param ck - CanvasKit 인스턴스
 * @param paraStyle - ParagraphStyle 객체
 * @param fontMgr - FontManager
 * @param token - 측정할 텍스트 토큰
 * @returns 토큰의 intrinsic width (px)
 */
export function measureTokenWidth(
  ck: CanvasKit,
  paraStyle: ParagraphStyle,
  fontMgr: FontMgr,
  token: string,
): number {
  const b = ck.ParagraphBuilder.Make(paraStyle, fontMgr);
  b.addText(token);
  const p = b.build();
  p.layout(1e6);
  const w = p.getMaxIntrinsicWidth();
  p.delete();
  b.delete();
  return w;
}

/**
 * CanvasKit ParagraphBuilder로 스페이스(' ') 한 칸의 폭을 측정한다.
 *
 * 'x x'와 'xx'의 폭 차이로 계산 (단독 공백은 trailing space로 잘릴 수 있음).
 */
export function measureSpaceWidth(
  ck: CanvasKit,
  paraStyle: ParagraphStyle,
  fontMgr: FontMgr,
): number {
  const bs = ck.ParagraphBuilder.Make(paraStyle, fontMgr);
  bs.addText("x x");
  const ps = bs.build();
  ps.layout(1e6);
  const xxSpace = ps.getMaxIntrinsicWidth();
  ps.delete();
  bs.delete();

  const bx = ck.ParagraphBuilder.Make(paraStyle, fontMgr);
  bx.addText("xx");
  const px = bx.build();
  px.layout(1e6);
  const xxNoSpace = px.getMaxIntrinsicWidth();
  px.delete();
  bx.delete();

  return xxSpace - xxNoSpace;
}

// ============================================
// CSS 줄바꿈 에뮬레이션
// ============================================

/**
 * CSS word-break:normal 줄바꿈 시뮬레이션
 *
 * CSS 동작: 단어 경계(공백)에서만 줄바꿈. 긴 단어는 overflow하되 컨테이너 width 유지.
 * CanvasKit 한계: 단일 layout width만 지원 → 긴 단어를 수용하면 모든 줄이 넓어짐.
 *
 * 해결: 단어 폭을 측정하여 CSS 규칙대로 수동 줄바꿈 후, \n 삽입된 텍스트와
 * max(maxWidth, maxWordWidth) 레이아웃 폭을 반환한다.
 * → CanvasKit이 수동 줄바꿈을 유지하면서 긴 단어도 문자 분할 없이 렌더링.
 *
 * @param ck - CanvasKit 인스턴스
 * @param paraStyle - ParagraphStyle 객체
 * @param fontMgr - FontManager
 * @param text - 원본 텍스트
 * @param maxWidth - 컨테이너 최대 너비 (px)
 * @returns 줄바꿈 삽입된 텍스트와 effectiveWidth
 */
export function cssNormalBreakProcess(
  ck: CanvasKit,
  paraStyle: ParagraphStyle,
  fontMgr: FontMgr,
  text: string,
  maxWidth: number,
): { text: string; effectiveWidth: number } {
  // `\n` 은 hard break (pre 계열 — normal 은 여기 오기 전에 공백으로 접혔다). 조각마다 따로 접고
  //   `\n` 으로 다시 잇는다 (ADR-027 후속 5, 사용자 live 2026-09-20: pre-wrap Text 의 첫 조각이 폭을
  //   넘자 `/\s+/` split 이 `\n` 을 삼켜 Skia 5줄 ↔ 상자·Preview 8줄).
  if (text.includes("\n")) {
    const parts: string[] = [];
    let effectiveWidth = maxWidth;
    for (const segment of text.split("\n")) {
      if (!segment) {
        parts.push("");
        continue;
      }
      const r = cssNormalBreakProcess(
        ck,
        paraStyle,
        fontMgr,
        segment,
        maxWidth,
      );
      parts.push(r.text);
      effectiveWidth = Math.max(effectiveWidth, r.effectiveWidth);
    }
    return { text: parts.join("\n"), effectiveWidth };
  }

  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return { text, effectiveWidth: maxWidth };

  // Early exit: 전체 텍스트의 intrinsic width가 maxWidth 이내이면
  // 수동 줄바꿈 불필요 (개별 단어 합산은 커닝/셰이핑으로 인해 전체보다 넓을 수 있음)
  const fb = ck.ParagraphBuilder.Make(paraStyle, fontMgr);
  fb.addText(text);
  const fp = fb.build();
  fp.layout(1e6);
  const fullIntrinsic = fp.getMaxIntrinsicWidth();
  fp.delete();
  fb.delete();
  if (fullIntrinsic <= maxWidth) {
    return { text, effectiveWidth: maxWidth };
  }

  // 1. 각 단어 폭 측정
  let maxWordWidth = 0;
  const wordWidths: number[] = [];
  for (const word of words) {
    const ww = measureTokenWidth(ck, paraStyle, fontMgr, word);
    wordWidths.push(ww);
    if (ww > maxWordWidth) maxWordWidth = ww;
  }

  // 2. 스페이스 폭 측정
  const spaceWidth = measureSpaceWidth(ck, paraStyle, fontMgr);

  // 3. CSS 줄바꿈 시뮬레이션
  const lines: string[] = [];
  let currentLine = "";
  let currentWidth = 0;

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const ww = wordWidths[i];

    if (currentLine === "") {
      // 줄의 첫 단어: 항상 추가 (overflow 허용)
      currentLine = word;
      currentWidth = ww;
    } else if (currentWidth + spaceWidth + ww <= maxWidth) {
      // 현재 줄에 들어감
      currentLine += " " + word;
      currentWidth += spaceWidth + ww;
    } else {
      // 안 들어감 → 새 줄 시작
      lines.push(currentLine);
      currentLine = word;
      currentWidth = ww;
    }
  }
  if (currentLine) lines.push(currentLine);

  return {
    text: lines.join("\n"),
    effectiveWidth: Math.max(maxWidth, Math.ceil(maxWordWidth)),
  };
}

/**
 * CSS word-break:keep-all 에뮬레이션 — effectiveWidth 계산
 *
 * keep-all: CJK 연속 문자열을 하나의 "단어"로 취급하여
 * 공백에서만 분할한다 (CJK 문자 사이 분할 금지).
 *
 * @param ck - CanvasKit 인스턴스
 * @param paraStyle - ParagraphStyle 객체
 * @param fontMgr - FontManager
 * @param text - 원본 텍스트
 * @param maxWidth - 컨테이너 최대 너비 (px)
 * @param allowOverflowBreak - true면 단어가 maxWidth 초과 시 CanvasKit 기본 분할 허용
 * @returns effectiveWidth (px)
 */
export function computeKeepAllWidth(
  ck: CanvasKit,
  paraStyle: ParagraphStyle,
  fontMgr: FontMgr,
  text: string,
  maxWidth: number,
  allowOverflowBreak: boolean,
): number {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return maxWidth;

  let maxWordWidth = 0;
  for (const word of words) {
    const ww = measureTokenWidth(ck, paraStyle, fontMgr, word);
    if (ww > maxWordWidth) maxWordWidth = ww;
  }

  if (allowOverflowBreak && maxWordWidth > maxWidth) return maxWidth;
  return Math.max(maxWidth, Math.ceil(maxWordWidth));
}

/**
 * CSS overflow-wrap:break-word 전처리
 *
 * maxWidth를 초과하는 단어 앞에 \n을 삽입하여 새 줄로 이동시키고,
 * 내부에 ZWS를 삽입하여 문자 단위 줄바꿈을 허용한다.
 * 이를 통해 CanvasKit이 CSS break-word와 유사하게 렌더링한다.
 *
 * nodeRendererText(렌더링) 가 사용한다.
 *
 * @param ck - CanvasKit 인스턴스
 * @param paraStyle - ParagraphStyle 객체
 * @param fontMgr - FontManager
 * @param text - 원본 텍스트
 * @param maxWidth - 컨테이너 최대 너비 (px)
 * @returns ZWS/\n 전처리된 텍스트
 */
export function preprocessBreakWordText(
  ck: CanvasKit,
  paraStyle: ParagraphStyle,
  fontMgr: FontMgr,
  text: string,
  maxWidth: number,
): string {
  const tokens = text.split(/(\s+)/);
  const result: string[] = [];
  let hasContentBefore = false;

  for (const token of tokens) {
    if (!token) continue;

    if (/^\s+$/.test(token)) {
      result.push(token);
      continue;
    }

    // 단어 폭 측정
    const ww = measureTokenWidth(ck, paraStyle, fontMgr, token);

    if (ww > maxWidth) {
      // maxWidth 초과 단어: 앞에 \n 삽입하여 새 줄로 이동 + ZWS로 문자 분할
      if (hasContentBefore && result.length > 0) {
        const lastIdx = result.length - 1;
        if (/^\s+$/.test(result[lastIdx])) {
          result[lastIdx] = "\n";
        }
      }
      result.push(Array.from(token).join("\u200B"));
    } else {
      result.push(token);
    }

    hasContentBefore = true;
  }

  return result.join("");
}
