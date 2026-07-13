# ADR-051 구현 설계: Canvas 2D 텍스트 측정 내재화

> ADR: [051-pretext-text-measurement-integration.md](../completed/051-pretext-text-measurement-integration.md)
> 상태: 설계 완료, Phase 0 대기

---

## 아키텍처

```
┌───────────────────────────────────────────────────────────┐
│            canvas2dSegmentCache.ts (신규)                   │
│  OffscreenCanvas.getContext("2d").measureText()             │
│  Map<fontKey, Map<token, width>>                            │
│  Intl.Segmenter 토큰화 + greedy line-breaking              │
│  → CSS Preview와 동일 브라우저 폰트 엔진                    │
└──────────┬────────────────────────────┬───────────────────┘
           │                            │
    ┌──────▼─────────────┐    ┌────────▼──────────────┐
    │  !needsFallback     │    │  needsFallback         │
    │  Canvas 2D 경로     │    │  CanvasKit 기존 경로   │
    │  ~90% 텍스트        │    │  ~10% 텍스트           │
    │                     │    │  (letterSpacing,        │
    │  캐시된 폭 선형주행 │    │   break-all, nowrap,    │
    │  → lineCount, height│    │   pre-wrap)             │
    └──────────┬──────────┘    └─────────────────────────┘
               │
    ┌──────────▼──────────────────────┐
    │  Break Hint Injection            │
    │  lines.join("\n") → CanvasKit    │
    │  CanvasKit = 렌더링 전용         │
    │  HarfBuzz shaping 품질 유지      │
    └──────────────────────────────────┘
```

**측정기 2개 유지** (3개 금지):

- `Canvas2DTextMeasurer` — CanvasKit 초기화 전 fallback (기존)
- `CanvasKitTextMeasurer` — 내부에서 `needsFallback()` 분기, !fallback 시 `canvas2dSegmentCache` 유틸 사용

`isCanvasKitMeasurer()` 보정 로직 변경 불필요.

---

## needsFallback() — CanvasKit fallback 경계

```typescript
function needsFallback(style: TextMeasureStyle): boolean {
  if (style.letterSpacing || style.wordSpacing) return true;
  if (style.whiteSpace && style.whiteSpace !== "normal") return true;
  if (style.wordBreak === "break-all") return true;
  return false;
}
```

| 경로                          | 프리셋      | 측정 엔진 | CSS 정합성 |
| ----------------------------- | ----------- | --------- | ---------- |
| `normal + normal` (~70%)      | Normal      | Canvas 2D | ~98%       |
| `normal + break-word` (~15%)  | Break Words | Canvas 2D | ~98%       |
| `keep-all + break-word` (~5%) | Keep All    | Canvas 2D | ~98%       |
| `break-all` (~5%)             | Break All   | CanvasKit | ~90%       |
| `nowrap/truncate` (~5%)       | No Wrap 등  | CanvasKit | ~90%       |
| `letterSpacing` 사용          | Custom      | CanvasKit | ~90%       |

---

## 신규 모듈: canvas2dSegmentCache.ts

### 1. Intl.Segmenter 기반 토큰화

```typescript
interface Token {
  text: string;
  breakable: boolean; // true: 줄바꿈 가능 단위, false: 공백/구두점
}

const segmenter = new Intl.Segmenter(undefined, { granularity: "word" });

function tokenize(text: string, wordBreak: string): Token[] {
  const segments = [...segmenter.segment(text)];
  const tokens: Token[] = [];
  for (const seg of segments) {
    if (!seg.isWordLike) {
      tokens.push({ text: seg.segment, breakable: false });
    } else if (isCJKSegment(seg.segment) && wordBreak !== "keep-all") {
      // CJK word-break:normal — 각 문자 사이 줄바꿈 허용
      for (const char of seg.segment) {
        tokens.push({ text: char, breakable: true });
      }
    } else {
      tokens.push({ text: seg.segment, breakable: true });
    }
  }
  return tokens;
}

function isCJKSegment(text: string): boolean {
  const cp = text.codePointAt(0) ?? 0;
  return (
    (cp >= 0x4e00 && cp <= 0x9fff) || // CJK Unified
    (cp >= 0x3040 && cp <= 0x309f) || // Hiragana
    (cp >= 0x30a0 && cp <= 0x30ff) || // Katakana
    (cp >= 0xac00 && cp <= 0xd7af) || // Hangul
    (cp >= 0x3400 && cp <= 0x4dbf) || // CJK Extension A
    (cp >= 0x20000 && cp <= 0x2a6df) || // CJK Extension B
    (cp >= 0xff00 && cp <= 0xffef) // Fullwidth
  );
}
```

### 2. 세그먼트 폭 캐시

```typescript
const segmentCaches = new Map<string, Map<string, number>>();
let sharedCtx:
  | OffscreenCanvasRenderingContext2D
  | CanvasRenderingContext2D
  | null = null;
let fontsReady = false;

// 초기화
if (typeof document !== "undefined") {
  document.fonts.ready.then(() => {
    fontsReady = true;
  });
  document.fonts.addEventListener("loadingdone", () => {
    segmentCaches.clear(); // 폰트 로드 후 캐시 전체 무효화
  });
}

function getCtx() {
  if (!sharedCtx) {
    if (typeof OffscreenCanvas !== "undefined") {
      sharedCtx = new OffscreenCanvas(1, 1).getContext("2d")!;
    } else {
      sharedCtx = document.createElement("canvas").getContext("2d")!;
    }
  }
  return sharedCtx;
}

export function getOrMeasureWidth(
  token: string,
  fontKey: string,
  fontString: string,
): number {
  // 폰트 미로드 시 캐싱 스킵 (fallback 폰트 결과 캐시 방지)
  if (!fontsReady) {
    const ctx = getCtx();
    ctx.font = fontString;
    return ctx.measureText(token).width;
  }

  let cache = segmentCaches.get(fontKey);
  if (!cache) {
    cache = new Map();
    segmentCaches.set(fontKey, cache);
  }
  const cached = cache.get(token);
  if (cached !== undefined) return cached;

  const ctx = getCtx();
  ctx.font = fontString;
  const width = ctx.measureText(token).width;
  cache.set(token, width);
  return width;
}

export function clearSegmentCaches(): void {
  segmentCaches.clear();
}
```

**fontKey 생성**: 기존 `buildWidthCacheKey()`에서 텍스트 부분을 제외한 스타일 키.

```typescript
export function buildFontKey(style: TextMeasureStyle): string {
  return [
    style.fontSize,
    style.fontFamily,
    style.fontWeight ?? 400,
    style.fontStyle ?? 0,
    style.fontVariant ?? "",
    style.fontStretch ?? "",
  ].join("\0");
}

export function buildFontString(style: TextMeasureStyle): string {
  const fs =
    style.fontStyle === 1 || style.fontStyle === "italic"
      ? "italic "
      : style.fontStyle === 2 || style.fontStyle === "oblique"
        ? "oblique "
        : "";
  return `${fs}${style.fontWeight ?? 400} ${style.fontSize}px ${style.fontFamily}`;
}
```

### 3. Semantic Preprocessing (Tier 3 — Pretext 원리)

토큰화 후 줄바꿈 전, **CSS 렌더링과 동일한 측정 단위**를 만들기 위한 전처리.
Pretext가 line-level verification 없이 99.9% 정합성을 달성한 핵심 전략.

```typescript
/** 행두 금칙 — 줄 시작에 올 수 없는 문자 (CJK 구두점) */
const KINSOKU_HEAD = new Set([
  "、",
  "。",
  "，",
  "．",
  "：",
  "；",
  "！",
  "？",
  "」",
  "』",
  "）",
  "】",
  "〉",
  "》",
  "〕",
  "｝",
  "〙",
  "〛",
  "…",
  "‥",
  "ー",
  "～",
  "っ",
  "ッ",
  "ゃ",
  "ャ",
  "ゅ",
  "ュ",
  "ょ",
  "ョ",
]);

/** 행말 금칙 — 줄 끝에 올 수 없는 문자 */
const KINSOKU_TAIL = new Set([
  "「",
  "『",
  "（",
  "【",
  "〈",
  "《",
  "〔",
  "｛",
  "〘",
  "〚",
]);

/**
 * Semantic Preprocessing — 토큰 병합
 *
 * 1. 구두점 병합: "word" + "," → "word," (커닝 컨텍스트 보존)
 * 2. CJK 금칙 병합: 행두 금칙 문자를 선행 토큰에 병합
 *
 * Pretext 원리: "local semantic preprocessing > clever runtime correction"
 */
export function preprocessTokens(tokens: Token[]): Token[] {
  const result: Token[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    // 구두점/행두 금칙 → 선행 breakable 토큰에 병합
    if (
      !token.breakable &&
      token.text.length === 1 &&
      KINSOKU_HEAD.has(token.text) &&
      result.length > 0
    ) {
      const prev = result[result.length - 1];
      result[result.length - 1] = {
        text: prev.text + token.text,
        breakable: prev.breakable,
      };
      continue;
    }
    // 행말 금칙 → 후속 토큰에 병합 (다음 반복에서 처리)
    if (
      token.breakable &&
      token.text.length === 1 &&
      KINSOKU_TAIL.has(token.text) &&
      i + 1 < tokens.length
    ) {
      tokens[i + 1] = {
        text: token.text + tokens[i + 1].text,
        breakable: tokens[i + 1].breakable,
      };
      continue;
    }
    // 라틴 구두점 병합: non-breakable 단일 문자(".", ",", ";", ":", "!")를
    // 선행 breakable 토큰에 병합
    if (
      !token.breakable &&
      token.text.length === 1 &&
      /[.,;:!?)\]'"]/.test(token.text) &&
      result.length > 0 &&
      result[result.length - 1].breakable
    ) {
      const prev = result[result.length - 1];
      result[result.length - 1] = {
        text: prev.text + token.text,
        breakable: prev.breakable,
      };
      continue;
    }
    result.push(token);
  }
  return result;
}
```

### 4. Greedy Line-Breaking (Pending Space + lineFitEpsilon)

````typescript
export interface ComputedLines {
  lineCount: number;
  lines: string[][];
  maxLineWidth: number;
}

/**
 * Tier 1: lineFitEpsilon — 서브픽셀 줄 끝 허용 오차
 *
 * Canvas 2D measureText().width와 CSS DOM의 서브픽셀 반올림 차이로
 * 줄바꿈 경계에서 1px 미만 오차가 발생한다.
 * Pretext 검증: Chrome 0.005px, Safari 1/64px ≈ 0.015625px
 */
const LINE_FIT_EPSILON = 0.015;

export function computeLines(
  tokens: Token[],
  widths: number[],
  maxWidth: number,
  overflowWrap: string,
  fontKey: string,
  fontString: string,
): ComputedLines {
  const lines: string[][] = [[]];
  let lineW = 0;
  let maxLineW = 0;
  let pendingSpace = 0; // CSS trailing whitespace = hangable

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    const w = widths[i];

    if (!token.breakable) {
      // 공백 → 보류 (lineW에 즉시 더하지 않음)
      pendingSpace = w;
      lines[lines.length - 1].push(token.text);
      continue;
    }

    if (lineW > 0 && lineW + pendingSpace + w > maxWidth + LINE_FIT_EPSILON) {
      // overflow-wrap: break-word — maxWidth 초과 단어 grapheme 분할
      if (overflowWrap === "break-word" && w > maxWidth) {
        maxLineW = Math.max(maxLineW, lineW);
        lines.push([]);
        lineW = 0;
        pendingSpace = 0;
        const graphemes = Array.from(token.text);
        for (const g of graphemes) {
          const gw = getOrMeasureWidth(g, fontKey, fontString);
          if (lineW > 0 && lineW + gw > maxWidth + LINE_FIT_EPSILON) {
            maxLineW = Math.max(maxLineW, lineW);
            lines.push([]);
            lineW = 0;
          }
          lines[lines.length - 1].push(g);
          lineW += gw;
        }
        continue;
      }
      // 새 줄 → 보류된 공백 폐기 (CSS: trailing space hang)
      maxLineW = Math.max(maxLineW, lineW);
      lines.push([]);
      lineW = w;
      pendingSpace = 0;
    } else {
      // 같은 줄 → 보류된 공백 확정
      lineW += pendingSpace + w;
      pendingSpace = 0;
    }
    lines[lines.length - 1].push(token.text);
  }
  maxLineW = Math.max(maxLineW, lineW);
  return { lineCount: lines.length, lines, maxLineWidth: maxLineW };
}

### 5. Line-level Verification (Tier 2 — Safety Net)

Tier 3(Semantic Preprocessing)가 V1이므로, 놓치는 edge case를 잡는 안전망.
Pretext는 preprocessing 성숙 후 이 단계를 기각했으며, composition도 Tier 3 성숙 시 제거 가능.

```typescript
/**
 * computeLines 결과를 full-line 측정으로 검증하고 보정한다.
 *
 * 비용: +14% overhead (줄 수만큼 추가 measureText 호출)
 * 효과: Pretendard 기준 95.8% → 99.3% 줄바꿈 정합성
 */
export function verifyLines(
  lines: string[][],
  maxWidth: number,
  fontString: string,
): string[][] {
  const ctx = getCtx();
  ctx.font = fontString;
  const verified: string[][] = [];
  let carry: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const lineTokens = [...carry, ...lines[i]];
    carry = [];
    const lineText = lineTokens.join("");
    const actualW = ctx.measureText(lineText).width;

    if (actualW <= maxWidth + LINE_FIT_EPSILON || lineTokens.length <= 1) {
      // 여유 있으면 다음 줄 첫 토큰 당겨오기 시도
      if (i + 1 < lines.length && lines[i + 1].length > 0) {
        const tryText = lineText + lines[i + 1][0];
        if (ctx.measureText(tryText).width <= maxWidth + LINE_FIT_EPSILON) {
          lineTokens.push(lines[i + 1][0]);
          lines[i + 1] = lines[i + 1].slice(1);
        }
      }
      verified.push(lineTokens);
    } else {
      // Overflow → 마지막 토큰을 다음 줄로 이동
      let fit = lineTokens.length;
      while (fit > 1) {
        fit--;
        const testText = lineTokens.slice(0, fit).join("");
        if (ctx.measureText(testText).width <= maxWidth + LINE_FIT_EPSILON)
          break;
      }
      verified.push(lineTokens.slice(0, fit));
      carry = lineTokens.slice(fit);
    }
  }
  if (carry.length > 0) verified.push(carry);
  return verified;
}
````

### 6. 통합 파이프라인

```
tokenize(text, wordBreak)           // Intl.Segmenter + CJK 분할
  → preprocessTokens(tokens)        // Tier 3: 구두점 병합, 금칙처리
  → getOrMeasureWidth(token, ...)   // 세그먼트 캐시
  → computeLines(tokens, widths, maxWidth + ε, ...)  // Tier 1: lineFitEpsilon
  → verifyLines(lines, maxWidth, fontString)          // Tier 2: Safety Net
  → buildHintedText(verifiedLines)  // Break Hint Injection
```

Tier 3가 성숙하면 (테스트 커버리지 충분, Pretext 수준) `verifyLines()` 호출을 제거.

```typescript
export function buildHintedText(lines: string[][]): string {
  return lines.map((line) => line.join("")).join("\n");
}
```

---

## 수정 파일 상세

### Phase A: 측정 경로 교체

**`textMeasure.ts`**:

- `TextMeasureStyle`에 `whiteSpace?` 추가
- `Canvas2DTextMeasurer.measureWrapped()` 내부에서 `canvas2dSegmentCache` 유틸 사용으로 확장

**`canvaskitTextMeasurer.ts`**:

```typescript
// measureWrapped() 내부 분기 — 3-Tier 파이프라인 적용
measureWrapped(text, style, maxWidth) {
  if (!needsFallback(style)) {
    const rawTokens = tokenize(text, style.wordBreak ?? "normal");
    const tokens = preprocessTokens(rawTokens);          // Tier 3
    const fontKey = buildFontKey(style);
    const fontString = buildFontString(style);
    const widths = tokens.map((t) => getOrMeasureWidth(t.text, fontKey, fontString));
    const { lines, maxLineWidth } = computeLines(        // Tier 1 (epsilon)
      tokens, widths, maxWidth,
      style.overflowWrap ?? "normal", fontKey, fontString,
    );
    const verified = verifyLines(lines, maxWidth, fontString); // Tier 2 (safety net)
    const lineHeight = style.lineHeight ?? style.fontSize * 1.2;
    return {
      width: maxLineWidth,
      height: verified.length * Math.max(lineHeight, style.fontSize * 1.2),
    };
  }
  // 기존 CanvasKit Paragraph 경로 (변경 없음)
  ...
}
```

**`textWrapUtils.ts`**:

- `cssNormalBreakProcess()` 내부의 단어 측정을 `getOrMeasureWidth()` 호출로 교체
- `measureTokenWidth()`, `measureSpaceWidth()`를 Canvas 2D 캐시 경유로 변경

### Phase B: Step 4.5 가속

**`engines/utils.ts`** (`enrichWithIntrinsicSize`):

- `needsFallback()` false 시 `computeLines()` 직접 호출
- 캐시된 세그먼트 폭 재사용 → WASM 호출 0

**`fullTreeLayout.ts`** (Step 4.5):

- width 변경 시 `computeLines(tokens, cachedWidths, newMaxWidth)` 재호출
- 토큰화 + 폭 측정은 1차 패스에서 완료 → 2차 패스는 순수 산술만

### Phase C: Break Hint Injection

**`nodeRendererText.ts`** (L296-370):

```typescript
if (!needsFallback(style)) {
  const rawTokens = tokenize(processedText, wordBreak);
  const tokens = preprocessTokens(rawTokens); // Tier 3
  const fontKey = buildFontKey(textStyle);
  const fontString = buildFontString(textStyle);
  const widths = tokens.map((t) =>
    getOrMeasureWidth(t.text, fontKey, fontString),
  );
  const { lines } = computeLines(
    // Tier 1
    tokens,
    widths,
    layoutMaxWidth,
    overflowWrap,
    fontKey,
    fontString,
  );
  const verified = verifyLines(lines, layoutMaxWidth, fontString); // Tier 2
  const hintedText = buildHintedText(verified);

  // hintedText를 processedText로 사용 → 기존 캐시 키에 자연 반영
  processedText = hintedText;
  effectiveLayoutWidth = layoutMaxWidth;
  // 기존 word-break 분기 스킵 → Break Hint가 줄바꿈을 결정
} else {
  // 기존 CanvasKit 경로 (변경 없음)
}
```

기존 `cssNormalBreakProcess()`도 동일한 `\n` hard break 메커니즘 사용 (검증된 패턴).

Paragraph 캐시 키(L114-136)의 `processedText` 필드에 `hintedText`가 자연스럽게 반영됨.

---

## Phase 구성

| Phase | 내용                                                                  | 기간  | 배포 플래그                | 되돌림                    |
| ----- | --------------------------------------------------------------------- | :---: | -------------------------- | ------------------------- |
| **0** | Canvas 2D vs CSS 정합도 벤치마크 (100+ 텍스트)                        |  1일  | —                          | 데이터만                  |
| **A** | `canvas2dSegmentCache` + `needsFallback` 분기 → `measureWrapped` 교체 | 2~3일 | `USE_CANVAS2D_MEASURE`     | 플래그 off                |
| **B** | Step 4.5 re-enrich 가속 (캐시된 폭으로 `computeLines` 직접 호출)      | 1~2일 | Phase A 플래그 공유        | Phase A 원복 시 동시 원복 |
| **C** | `nodeRendererText.ts` Break Hint Injection                            | 2~3일 | `USE_CANVAS2D_BREAK_HINTS` | 플래그 off                |

---

## 검증 기준

### Phase 0 Go/No-Go

- [ ] Canvas 2D `measureText()` vs CSS DOM width ≤ 1px (라틴 50 + CJK 30 + 혼합 20문장)
- [ ] `Intl.Segmenter` CJK 분할 vs CSS 줄바꿈 일치 (한중일 50문장)
- [ ] Canvas 2D + WebGL(CanvasKit) 공존 확인 (별도 canvas element)
- [ ] 세그먼트 캐시 500 토큰 warm 후 `computeLines()` ≤ 0.1ms
- [ ] Break Hint `\n` 삽입 후 CanvasKit `drawParagraph()` 정상 렌더링

### Phase A 완료

- [ ] `USE_CANVAS2D_MEASURE` 플래그 on/off A/B 비교
- [ ] 기존 프로젝트 시각 회귀 0건 (스크린샷 diff)
- [ ] 500 텍스트 리사이즈 벤치마크 (목표: Phase 0 실측 기반)

### Phase C 완료

- [ ] CSS Preview vs Canvas 스크린샷 diff (100개 텍스트)
- [ ] 렌더 CPU 15% 이상 악화 시 플래그 비활성화

---

## 리스크 상세

| Risk                           | 심각도 | 내용                                                             | 완화                                                          |
| ------------------------------ | ------ | ---------------------------------------------------------------- | ------------------------------------------------------------- |
| Canvas 2D vs CSS 서브픽셀 차이 | LOW    | Pretendard: avg 0.004px, max 0.008px (Phase 0 실측)              | **Tier 1 lineFitEpsilon (0.015px)** 으로 줄바꿈 경계 흡수     |
| CJK `Intl.Segmenter` 정확도    | MEDIUM | 한국어 형태소 경계 vs CSS 줄바꿈 위치 차이                       | **Tier 2 verifyLines()** 로 full-line 검증 후 보정            |
| 커닝 컨텍스트 변화             | LOW    | macOS Core Text: 토큰 합산 = 전체 측정 (Phase 0 실측 kernDiff=0) | **해결됨** — 커닝이 토큰 경계를 넘지 않음                     |
| 구두점 줄바꿈 위치 불일치      | MEDIUM | "word" + "." 분리 측정 시 CSS와 다른 줄바꿈 결정                 | **Tier 3 preprocessTokens()** 로 구두점 병합                  |
| CJK 금칙처리 미비              | MEDIUM | 행두/행말 금칙 문자가 잘못된 위치에 배치                         | **Tier 3 KINSOKU_HEAD/TAIL** 테이블로 사전 병합               |
| Generic font name 불일치       | LOW    | `system-ui` CJK fallback chain 차이 (max 1.6px)                  | Pretendard 기본 폰트에서는 0px 차이, system-ui 사용 시만 해당 |
| Break Hint 후 multi-line 보정  | MEDIUM | `\n` 삽입 후 `getMaxIntrinsicWidth()` 동작 변경                  | Phase C에서 E2E 비교 테스트                                   |
| 폰트 미로드 상태 캐싱          | HIGH   | fallback 폰트로 측정 → 잘못된 캐시                               | `document.fonts.ready` 체크 + 캐시 클리어                     |
| 세그먼트 캐시 메모리           | LOW    | 폰트 10 × 토큰 500 = 5,000 entries ~640KB                        | 상한 설정 또는 LRU                                            |

---

## 기대 효과

| 측면                     | 현재 (CanvasKit) | 적용 후 (Phase 0 실측 기반)            |
| ------------------------ | ---------------- | -------------------------------------- |
| CSS↔Canvas width 정합성  | ~90%             | **avg 0.004px** (Pretendard, Phase 0)  |
| CSS↔Canvas 줄바꿈 정합성 | ~90%             | **~99.3%** (Tier 1+2+3, Pretendard)    |
| 리사이즈 (500 텍스트)    | ~85ms            | ~5ms (추정, 캐시 warm 시 0.006ms/text) |
| Step 4.5 re-enrich       | ~65ms            | ~1ms (추정)                            |
| 외부 의존                | —                | 0                                      |
| 번들 추가                | —                | ~3KB (금칙 테이블 포함)                |
| 코드 레퍼런스            | —                | Pretext 소스 5개 파일                  |

### 3-Tier 정밀도 전략 기여도 (Phase 0 실측)

| Tier | 전략                       | 줄바꿈 정합성 | 비용        | 비고                              |
| ---- | -------------------------- | :-----------: | ----------- | --------------------------------- |
| —    | Basic (토큰 합산만)        |     95.8%     | 기준        |                                   |
| 1    | + lineFitEpsilon (0.015px) |     ~97%      | 0           | 서브픽셀 경계 흡수                |
| 3    | + Semantic Preprocessing   |     ~98%      | 0 (prepare) | 구두점 병합, CJK 금칙 (근본 해결) |
| 2    | + Line-level Verification  |   **99.3%**   | +14%        | Safety net (Tier 3 성숙 시 제거)  |

---

## Pretext 레퍼런스 매핑

| Pretext 원리                         | composition 적용                                | 파일                    |
| ------------------------------------ | ----------------------------------------------- | ----------------------- |
| 2-Phase 분리 (prepare/layout)        | 세그먼트 캐시 warm / computeLines 재호출        | canvas2dSegmentCache.ts |
| SoA (Structure of Arrays)            | `Map<fontKey, Map<token, width>>`               | canvas2dSegmentCache.ts |
| Lazy computation (graphemeWidths)    | break-word 시에만 grapheme 분할                 | computeLines()          |
| Greedy line-breaking                 | Pending Space 패턴 + 선형 주행                  | computeLines()          |
| **lineFitEpsilon (브라우저 허용치)** | **Tier 1: LINE_FIT_EPSILON = 0.015**            | computeLines()          |
| **Semantic Preprocessing**           | **Tier 3: preprocessTokens() 구두점/금칙 병합** | canvas2dSegmentCache.ts |
| **Line verification (기각됨)**       | **Tier 2: verifyLines() safety net (V1 한정)**  | canvas2dSegmentCache.ts |
| Kinsoku (일본어 금칙)                | **Tier 3에 포함: KINSOKU_HEAD/TAIL 테이블**     | canvas2dSegmentCache.ts |
| EngineProfile (브라우저 shim)        | 미구현 (Phase E 후보)                           | —                       |
| 이모지 보정                          | 미구현 (Phase E 후보)                           | —                       |
