# Pretext upstream 변경 대조 — Canvas 2D 내재화 경로 재점검 (2026-09-03)

> 대상: [chenglou/pretext](https://github.com/chenglou/pretext) v0.0.4 (2026-04-02, [PRETEXT_ANALYSIS.md](PRETEXT_ANALYSIS.md) 분석 시점) → v0.0.8 + main `ac49b09` (2026-06-22). 라이브러리 도입이 아니라 **원리 내재화** 경로 (ADR-051 대안 B) 를 유지한 채, upstream 이 그 사이 고친 규칙 중 우리 구현 `canvas2dSegmentCache.ts` 에 없는 것을 Chrome 실측으로 골라냈다.

## 0. 요약

- **현재 상태**: ADR-051 대안 B 는 `USE_CANVAS2D_MEASURE = true` (`wasm-bindings/featureFlags.ts:35`) 로 **live** 다. 측정 (`canvaskitTextMeasurer.ts:209/295`) 과 Break Hint 주입 (`nodeRendererText.ts:539`) 양쪽이 Canvas 2D 경로를 탄다. 문서 ("Phase 0 대기") 와 메모리는 낡았다 (§6).
- **멈춘 지점** (근거 있는 것만): Phase E 후보 (EngineProfile·이모지 보정) 미구현 · Tier 2 `verifyLines` 잔존 · `needsFallback()` 5종 (letterSpacing / wordSpacing / whiteSpace≠normal / break-all / fontVariant) 은 CanvasKit 유지 · ADR-916 2-E "Rust 이관 제외" · ADR-042 "±2px 텍스트 기인 오차 수용".
- **upstream 변화**: 5 릴리스, 135 커밋. 3 브라우저 7,680 케이스 전부 일치 (`status/dashboard.json`). 변경의 대부분이 **prepare 단계 preprocessing 규칙** (우리 Tier 3 에 해당) 이다.
- **대조 결과**: Chrome 152 (macOS, DPR 2) 오라클로 **결함 9종 확정 + 잠재 1 + 미검증 2**. 우리가 옮긴 upstream 규칙은 4개 (라틴 trailing 구두점 · 행두 금칙 · 행말 금칙 · pending space) 인데 그중 **행말 금칙 규칙은 조건 오류로 한 번도 동작하지 않았다** (§3 G/H).
- **제안**: preprocessing 5건 + computeLines 1건을 1 phase (동작 변경) 로 반영 → 이모지 보정 → letterSpacing 은 선택. 라이브러리 직접 도입·Tier 2 제거·Rust 이관은 그대로 보류 (§5).

## 1. 현황 — 코드 사실

| 사실                                                                                              | 경로                                                    |
| ------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| Canvas 2D 게이트 상시 on                                                                          | `canvas/wasm-bindings/featureFlags.ts:35`               |
| 측정 (`measureWidth` / `measureWrapped`) 가 `!needsFallback` 이면 Canvas 2D                       | `canvas/utils/canvaskitTextMeasurer.ts:209, 295`        |
| 렌더가 `measureWithCanvas2D().hintedText` 를 `\n` hard break 로 CanvasKit 에 강제                 | `canvas/skia/nodeRendererText.ts:539-551`               |
| 파이프라인: tokenize → preprocessTokens → 캐시 → computeLines(ε 0.015) → verifyLines → hintedText | `canvas/utils/canvas2dSegmentCache.ts:585-644`          |
| fallback 5종: letterSpacing · wordSpacing · whiteSpace≠normal · break-all · fontVariant            | 같은 파일 `needsFallback()` (fontVariant 는 ADR-151 B18) |
| 렌더 전 공백 정규화는 `[ \t]+` 만 (`\n` 미정규화), 측정 경로는 정규화 없음                        | `nodeRendererText.ts:164-166`                           |
| 파이프라인 JS 오버헤드 sub-0.01 ms (ADR-916 2-E 벤치)                                             | `canvas/skia/textMeasure.bench.ts` 헤더                 |
| letterSpacing 은 Styles 패널에서 사용자가 설정 가능 → fallback 경로가 production 에 노출됨        | `panels/styles/sections/TypographySection.tsx:276`      |
| 기본 폰트 Pretendard, 체인에 `system-ui` 포함                                                     | `builder/fonts/customFonts.ts:296, 330`                 |

## 2. upstream 변경 이력 (2026-04-02 이후)

| 버전 (날짜)         | 항목                                                                                                                                          | 우리 구현과의 관계                                                 |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| 0.0.5 (04-09)       | `wordBreak: 'keep-all'` 정식 지원 · CJK+숫자 혼합 · keep-all 혼합 스크립트 경계 · 긴 breakable run 선형화 · 반복 구두점 quadratic 제거          | keep-all 혼합 스크립트 **결함** (§3 N/N2)                          |
| 0.0.6 (04-21)       | 수치 `letterSpacing` 지원 (#108, #156) · CJK 뒤 여는 괄호 주석이 줄 끝에 남던 문제 (#148)                                                        | 여는 괄호 **결함** (§3 G/H) · letterSpacing 은 fallback 축소 후보 |
| 0.0.7 (05-10)       | keep-all no-space 혼합 · 비-ASCII no-space 구두점 체인 · 여는 구두점 `¡ ¿ „` (#165) · 숫자 접두/접미 `$ % € + − °` (#105) · soft-hyphen · terminal letter spacing (#171) | `$100` **결함** (§3 A) · 여는 따옴표 **결함** (§3 L/O)             |
| 0.0.8 (06-11)       | 단어 내부 기호 run (`user@host`, `a/b`, `foo_bar`) 은 브라우저처럼 붙여 둠 (#169) · 과장 하이픈 run 의 dash 우선 break (#89)                     | 이메일·경로·URL **결함** (§3 E/F/F2)                               |
| main 06-22          | `PLATFORM_BUGS.md` 신설 — Chrome/Firefox macOS 이모지 canvas 폭 과대 (Chromium #489494015) · `system-ui` 광학 변형 불일치 · Safari ε 1/64 · Safari keep-all 구두점 shim | 이모지 보정 **결함** (§3 emoji) · `system-ui` 경고                 |

측정 모델 자체 (2-phase, SoA, greedy, 세그먼트 캐시) 는 변하지 않았다. `RESEARCH.md` 는 여전히 full-line verification 을 기각 상태로 둔다.

## 3. 대조 결과 — Chrome 152 오라클

**방법**: `example.com` 탭에서 `16px Arial`, 폭 = `measureText(접두어) + 1.5px` 로 div 를 만들고 `Range.getClientRects()` 로 코드포인트별 줄을 추출 (스크립트 §7). 같은 입력을 현재 `tokenize → preprocessTokens → computeLines` 에 fake 등폭 (10px/grapheme) 으로 통과시켜 **break 기회** 를 대조했다. 폭 값이 아니라 "어디서 끊을 수 있는가" 를 보는 것이므로 폰트 무관.

| #   | 입력 (접두어)                            | Chrome                          | 현재 구현                      | 원인                                                      | upstream 규칙                                    | 판정        |
| --- | ---------------------------------------- | ------------------------------- | ------------------------------ | --------------------------------------------------------- | ------------------------------------------------ | ----------- |
| A   | `Price $100 today` (`Price $`)           | `Price` / `$100 today`          | `Price $` / `100 today`        | `$` 가 non-breakable 단독 토큰 → 앞 줄 끝에 남음           | numeric affix PR/PO 병합 (#105)                  | **결함**    |
| C   | `call (주)회사 now` (`call (`)           | `call` / `(주)회사`             | `call (` / `주)회사`           | 라틴 `(` 가 forward-sticky 목록에 없음                     | `kinsokuEnd` 에 `" ( [ { ¡ ¿ “ ‘ « ‹`             | **결함**    |
| E   | `mail support@example.com now`           | `support@example.com` 한 단위   | `support@` / `example.com`     | `@` 뒤 word-like 앞에서 break 허용                         | no-space word chain (#169)                       | **결함**    |
| F   | `see foo_bar/baz_qux here`               | `foo_bar/baz_qux` 한 단위       | `foo_bar/` / `baz_qux`         | 위와 같음 (`/`)                                            | 같음                                             | **결함**    |
| F2  | `go https://example.com/path/to now`     | URL 한 단위                     | `https://example.com/` / …     | 위와 같음                                                  | `mergeUrlRuns`                                   | **결함**    |
| G   | `彼は「こんにちは」…` (`彼は「`)          | `彼は` / `「こん`               | `彼は「` / `こんに`            | `KINSOKU_TAIL` 규칙이 `token.breakable` 조건 — 구두점은 항상 non-breakable 이라 **dead** | forward-sticky carry (역방향 패스)               | **결함**    |
| H   | `漢字（注）です` (`漢字（`)              | `漢字` / `（注）`               | `漢字（` / `注）で`            | 같음 (#148 케이스)                                         | 같음                                             | **결함**    |
| L   | `he said "hello world" ok`               | `he said` / `"hello`            | `he said "` / `hello`          | 여는 따옴표 dangling (곧은·둥근 모두)                      | `kinsokuEnd` 따옴표                              | **결함**    |
| O   | `it's 'quoted' text`                     | `it's` / `'quoted'`             | `it's '` / `quoted'`           | 아포스트로피 forward glue 없음                             | `forwardStickyGlue` `' ’`                        | **결함**    |
| N   | `한글abc123 다음` keep-all (`한글`)       | `한글abc123` 한 단위            | `한글` / `abc123`              | keep-all 이 CJK 분할 억제만 하고 인접 세그먼트 병합 없음    | `mergeKeepAllTextSegments`                       | **결함**    |
| N2  | `価格1200円です` keep-all                | 전체 한 단위                    | `価格` / `1200` / `円`         | 같음                                                       | 같음                                             | **결함**    |
| D   | `Save / Cancel` 폭 99.61, 컨테이너 99.11 | 줄바꿈                          | computeLines 는 "fits" (폭 20% 누락) → Tier 2 가 잡아 줄바꿈 | 연속 non-breakable 토큰이 `pendingSpace` 를 **덮어써** `/` 와 공백 하나가 폭에서 사라짐 | 공백만 hangable, 나머지는 즉시 가산 | **잠재** (Tier 2 가 가림; `maxLineWidth` 는 틀린 채) |
| emoji | `😀` 12/14/16/20/24/28px Arial          | canvas−DOM = +3 / +4 / +4 / +2 / 0 / 0 px | 보정 없음               | Chromium #489494015 가 이 환경에서 재현                    | 폰트당 1회 DOM 보정 (`getEmojiCorrection`)       | **결함** (이모지 포함 텍스트 24px 미만) |
| I / M / M2 / P / Q / R | 한글+라틴 normal · 하이픈 · 전화번호 · `Save /` · `Wait...` · `(note)` | —                | Chrome 과 일치                 | —                                                         | —                                                | 정상        |
| ws  | `a  b\nc` (white-space: normal)          | 공백 1개로 collapse, `\n` 도 공백 | 측정 경로: `"  "` 2칸 폭, `\n` 은 hard break | 측정 경로에 정규화 없음, 렌더는 `[ \t]+` 만                | `normalizeWhitespaceNormal`                      | **미검증** (Preview 의 `\n` 처리 확인 필요) |
| ε   | line-fit epsilon                         | Chrome 0.005 / Safari 1/64      | 고정 0.015                     | Chrome 에서 0.01px 만큼 관대                               | `EngineProfile.lineFitEpsilon`                   | 미검증 (실측 불일치 사례 없음) |

한글 산문·영문 산문·구두점 병합·CJK 문자 분할 등 기존 4 규칙이 맞는 범위는 그대로 맞는다. 결함은 전부 "단위를 어디까지 붙이느냐" 의 Tier 3 층이고, upstream 이 4~6월에 브라우저 sweep 으로 고친 항목과 1:1 로 겹친다.

## 4. Before / After

프로토타입 (`preprocessV2` + `computeLinesV2`) 을 같은 16 케이스에 돌려 Chrome 결과와 전부 일치시켰다 (M2 는 첫 시도에서 upstream 의 `'-' + 숫자` forward 규칙을 잘못 옮겨 틀렸고, 제거 후 일치). 아래는 그 규칙을 현재 코드 구조에 맞춘 형태다.

### 4-1. forward-sticky — 행말 금칙 조건 수정 + 라틴 여는 괄호·따옴표·아포스트로피 (G · H · C · L · O)

**Before** (`canvas2dSegmentCache.ts:180-193`):

```ts
// 행말 금칙: breakable 단일 문자 → 후속 토큰에 병합
if (token.breakable && token.text.length === 1 && KINSOKU_TAIL.has(token.text) && i + 1 < toks.length) {
```

`Intl.Segmenter` 는 괄호·따옴표를 `isWordLike: false` 로 내므로 `tokenize()` 가 만든 토큰에서는 이 분기가 절대 참이 아니다. 단위 테스트 (`canvas2dSegmentCache.test.ts:156`) 는 `breakable: true` fixture 를 손으로 만들어 통과하고 있어 dead 규칙을 가린다.

**After**:

```ts
/** 줄 끝에 남을 수 없는 문자 — 후속 토큰에 병합 (upstream kinsokuEnd + forwardStickyGlue) */
const FORWARD_STICKY = new Set([
  '"', "(", "[", "{", "¡", "¿", "“", "‘", "‚", "„", "«", "‹", "⸘", "'", "’",
  "（", "〔", "〈", "《", "「", "『", "【", "〖", "〘", "〚",
]);

// preprocessTokens 안 — 역방향 패스로 교체 (여러 개 연속 `("` 도 한 번에 carry)
let carry = "";
for (let i = toks.length - 1; i >= 0; i--) {
  const t = toks[i];
  const next = toks[i + 1];
  const isForward =
    !t.breakable && !isWhitespace(t.text) && next && !isWhitespace(next.text) &&
    [...t.text].every((c) => FORWARD_STICKY.has(c) || NUMERIC_PREFIX.test(c));
  if (isForward) { carry = t.text + carry; continue; }
  if (carry) { toks[i + 1].text = carry + toks[i + 1].text; carry = ""; }
}
```

병합된 토큰의 `breakable` 은 후속 토큰 것을 따른다 (`「こん` 은 breakable). 아포스트로피는 `don't` 처럼 단어 내부일 때 `Intl.Segmenter` 가 이미 한 세그먼트로 주므로 이 규칙은 단어 앞 `'quoted'` 에만 닿는다.

### 4-2. numeric affix — `$ € ₩ + −` 앞붙임, `% ° ‰` 뒤붙임 (A · B)

**Before**: `LATIN_TRAILING_PUNCT = /^[.,;:!?)\]'"}’”]$/` 에 `%` 없음, 접두 기호 규칙 없음.

**After**: UAX #14 PR/PO 클래스 일부를 표로 두고 4-1 (접두) · 기존 trailing 병합 (접미) 양쪽에 합류.

```ts
const NUMERIC_PREFIX = /^[$+\\¢£¤¥€₩₹₽−±]$/u;   // PR — 후속 토큰에 병합
const NUMERIC_POSTFIX = /^[%‰°]$/u;             // PO — 선행 토큰에 병합
const LATIN_TRAILING_PUNCT = /^[.,;:!?)\]'"}’”%‰°…]$/u;
```

upstream 은 UAX #14 표 전체 (`lineBreakNumericAffixRanges`, 약 70 코드포인트) 를 쓴다. 우리는 통화·퍼센트·각도만 넣어도 builder 텍스트 범위는 덮인다.

### 4-3. no-space word chain — 이메일 · 경로 · URL · 식별자 (E · F · F2)

**Before**: `support` `@` `example.com` 이 3 토큰, `@` 뒤 word-like 앞에서 break 허용.

**After** (upstream `canJoinNoSpaceWordBoundary` 축약):

```ts
/** ASCII 기호 run — '-' 제외 (하이픈 뒤 break 는 브라우저도 허용, M/M2 케이스) */
const isSymbolRun = (s: string) => /^[!-\/:-@\[-`{-~]+$/.test(s) && !s.includes("-");

// preprocessTokens 마지막 패스: [word][symbol][word] 가 공백 없이 붙어 있으면 한 단위 (CJK 는 제외)
for (const t of toks) {
  const prev = out[out.length - 1];
  const joinable =
    prev && !isWhitespace(prev.text) && !isWhitespace(t.text) &&
    !isCJK(prev.text) && !isCJK(t.text) &&
    ((!t.breakable && isSymbolRun(t.text)) ||                      // word + symbol
     (t.breakable && isSymbolRun(prev.text.at(-1)!) && prev.text.at(-1) !== "-")); // symbol + word
  if (joinable) { prev.text += t.text; prev.breakable ||= t.breakable; continue; }
  out.push(t);
}
```

`overflow-wrap: break-word` 경로는 그대로 grapheme 분할이 열리므로 긴 URL 이 컨테이너를 넘칠 때의 동작은 유지된다 (Chrome 도 `normal` 에서는 넘친다 — F2 오라클).

### 4-4. keep-all — 공백 없이 인접한 CJK 포함 그룹 병합 (N · N2)

**Before** (`tokenize()`): keep-all 은 CJK 세그먼트를 문자로 쪼개지 않을 뿐, `한글` `abc123` 은 별개 breakable 토큰.

**After** (upstream `mergeKeepAllTextSegments`):

```ts
if (wordBreak === "keep-all") {
  // 공백/구두점 경계 없이 이어진 text 토큰 그룹에 CJK 가 하나라도 있으면 한 단위
  for (const t of toks) {
    const prev = out[out.length - 1];
    if (prev && prev.breakable && t.breakable && (isCJK(prev.text) || isCJK(t.text))) { prev.text += t.text; continue; }
    out.push(t);
  }
}
```

upstream 은 여기에 Safari 전용 `breakKeepAllAfterPunctuation` shim 이 붙지만 (WebKit #312099, 수정 upstream 반영 대기) Chrome 기준이면 불필요.

### 4-5. computeLines — 연속 non-breakable 토큰의 폭 누락 (D)

**Before** (`canvas2dSegmentCache.ts:389-394`):

```ts
if (!token.breakable) {
  pendingSpace = w;          // ← 직전 pendingSpace 를 덮어쓴다: "Save" " " "/" " " 에서 "/" 와 공백 하나가 사라짐
  lines[lines.length - 1].push(token.text);
  continue;
}
```

**After**: hangable 은 **공백** 뿐이고 (CSS trailing space hang), 구두점·기호는 즉시 줄 폭에 들어간다.

```ts
if (isWhitespace(token.text)) { pendingSpace += w; lines.at(-1)!.push(token.text); continue; }
if (!token.breakable)         { lineW += pendingSpace + w; pendingSpace = 0; lines.at(-1)!.push(token.text); continue; }
```

4-1~4-3 을 반영하면 non-breakable 단독 토큰 자체가 드물어져 이 분기는 안전망이 되지만, `maxLineWidth` (fit-content 폭) 가 맞아지는 것은 이 수정에서만 온다. 현재는 Tier 2 `verifyLines` 가 줄 수만 구제한다.

### 4-6. 이모지 canvas 폭 보정 (emoji)

**Before**: 없음. `😀` 하나당 Chrome 152 / DPR 2 에서 +3~4px (24px 미만) 과대 → CSS 보다 이른 줄바꿈.

**After** (upstream `getEmojiCorrection`, 폰트당 1회):

```ts
const emojiCorrectionCache = new Map<string, number>();   // fontString → px
function getEmojiCorrection(fontString: string, fontSize: number): number {
  const hit = emojiCorrectionCache.get(fontString); if (hit !== undefined) return hit;
  const ctx = getCtx(); ctx.font = fontString;
  const canvasW = ctx.measureText("\u{1F600}").width;
  let correction = 0;
  if (canvasW > fontSize + 0.5 && typeof document !== "undefined") {
    const span = document.createElement("span");
    span.style.cssText = `font:${fontString};display:inline-block;position:absolute;visibility:hidden`;
    span.textContent = "\u{1F600}"; document.body.appendChild(span);
    const domW = span.getBoundingClientRect().width; span.remove();
    if (canvasW - domW > 0.5) correction = canvasW - domW;
  }
  emojiCorrectionCache.set(fontString, correction); return correction;
}
// measureWithCanvas2D: /\p{Emoji_Presentation}|️/u.test(text) 일 때만 토큰 폭에서 (이모지 grapheme 수 × correction) 차감
```

DOM read 가 폰트당 1회 (`loadingdone` 에서 캐시 clear). 렌더 hot path 밖이라 canvas-rendering.md 의 RAF 규칙과 충돌하지 않는다. `document.fonts` 미로드 상태에서는 측정을 미뤄야 한다 (`getOrMeasureWidth` 의 `fonts.check` 와 같은 조건).

### 4-7. letterSpacing — fallback 축소 (선택)

**Before**: `letterSpacing` 이 0 이 아니면 CanvasKit Paragraph 로 측정 → CSS Preview 와 다른 엔진 (ADR-051 표의 "~90%"). Styles 패널이 노출하는 값이라 production 경로다.

**After**: upstream 0.0.6 방식 — 세그먼트 폭은 그대로 두고 **grapheme 간격 수 × letterSpacing** 을 산술로 가산, 줄 끝 마지막 grapheme 뒤 간격은 Chrome 처럼 paint 폭에 포함 (#171 `getTerminalLetterSpacing`). `Intl.Segmenter({granularity:"grapheme"})` 로 토큰별 grapheme 수를 prepare 시 1회 세어 캐시.

```ts
// computeLines 진입 전
const spacing = style.letterSpacing ?? 0;
const graphemeCounts = spacing ? tokens.map((t) => countGraphemes(t.text)) : null;
// 토큰 폭 = widths[i] + spacing * graphemeCounts[i]  (줄 첫 토큰은 선행 간격 없음)
```

`needsFallback()` 에서 letterSpacing 조건을 지우면 CSS 정합 범위가 늘고 CanvasKit 측정 경로 하나가 준다. `wordSpacing` 은 upstream 도 미지원 — 유지.

### 4-8. EngineProfile epsilon (보류)

현재 0.015 는 Safari 값 (1/64) 에 가깝고 Chrome (0.005) 보다 0.01px 관대하다. 실측 불일치 사례가 없고 upstream `TODO.md` 도 "런타임 보정 가능한가" 를 열린 질문으로 둔다. UA 분기 도입은 근거가 생길 때.

### 4-9. 공백 정규화 (미검증)

`measureWrapped()` 에 들어오는 원문은 정규화되지 않아 `"a  b"` 가 두 칸 폭으로 측정된다. `\n` 은 렌더에서 hard break 로 남는다. Preview 가 Text content 의 `\n` 을 어떻게 내는지 (`<br>` / `pre-line` / collapse) 를 먼저 실측한 뒤 판정. upstream `normalizeWhitespaceNormal` 은 `[ \t\n]+ → " "`.

### 4-10. 적용 요약표 — 파이프라인 단계별 Before / After

| 단계                          | 위치                                  | Before                                                                                   | After                                                                                                                                     |
| ----------------------------- | ------------------------------------- | ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| tokenize                      | `tokenize()`                          | Intl.Segmenter → word-like = breakable, 그 외 non-breakable. CJK 세그먼트는 문자 분할     | 변경 없음 — keep-all 병합은 preprocess 로 이동                                                                                            |
| preprocess ① left-sticky      | `preprocessTokens()` 기존 분기        | 라틴 trailing 구두점 단일 문자 + 행두 금칙 → 선행 토큰 병합                               | `% ‰ °` postfix affix 추가                                                                                                                |
| preprocess ② forward-sticky   | `preprocessTokens()` 역방향 패스      | `KINSOKU_TAIL` 10자, `token.breakable` 조건이라 **dead**                                  | 라틴 `" ( [ {` · 둥근 따옴표 · `¡ ¿` · `' ’` · CJK 여는 괄호 · `$ € ₩ + −` prefix 를 후속 토큰에 carry (연속 `("` 포함)                    |
| preprocess ③ no-space chain   | 신규 패스                             | 없음                                                                                     | 공백 없이 `[word][symbol][word]` 는 한 단위 (`-` · CJK 제외) — 이메일·경로·URL·식별자                                                     |
| preprocess ④ keep-all         | 신규 패스 (`wordBreak === "keep-all"`) | 없음                                                                                     | 공백 경계 없이 이어진 breakable 그룹에 CJK 가 있으면 한 단위                                                                               |
| computeLines                  | `computeLines()` non-breakable 분기   | 모든 non-breakable 토큰이 `pendingSpace = w` (덮어쓰기) — 기호도 공백처럼 hang            | 공백만 `pendingSpace += w` (누적), 구두점·기호는 `lineW` 즉시 가산                                                                          |
| verifyLines (Tier 2)          | `verifyLines()`                       | 줄 수 결함의 실질 구제 수단 (D 케이스)                                                    | 유지 — 잔여 안전망. 1 phase 뒤 miss 0 이면 제거 재검토                                                                                      |
| 이모지 보정                   | 신규 `getEmojiCorrection()`           | 없음 → 이모지당 +3~4px (24px 미만, DPR 2)                                                | 폰트당 1회 DOM span 대조, 이모지 grapheme 수 × 보정 차감 (이모지 포함 텍스트만)                                                             |
| letterSpacing (선택)          | `needsFallback()` + `computeLines()`  | ≠0 이면 CanvasKit 측정 (엔진 불일치)                                                     | grapheme 수 × spacing 산술 가산 + 줄 끝 terminal spacing → fallback 조건 제거                                                              |
| epsilon                       | `LINE_FIT_EPSILON`                    | 0.015 고정                                                                               | 변경 없음 (보류)                                                                                                                          |

### 4-11. 케이스별 결과 — Chrome 오라클 · Before · After (fake 등폭 시뮬레이션, `/` = 줄 경계)

| #   | 입력 (word-break)              | Chrome                            | Before                          | After                             | 적용 규칙        |
| --- | ------------------------------ | --------------------------------- | ------------------------------- | --------------------------------- | ---------------- |
| A   | `Price $100 today`             | Price / $100 today                | Price $ / 100 today             | Price / $100 today                | ② prefix affix   |
| C   | `call (주)회사 now`            | call / (주)회사                   | call ( / 주)회사                | call / (주)회사                   | ② `(`            |
| E   | `mail support@example.com now` | mail / support@example.com        | mail support@ / example.com     | mail / support@example.com        | ③                |
| F   | `see foo_bar/baz_qux here`     | see / foo_bar/baz_qux             | see foo_bar/ / baz_qux          | see / foo_bar/baz_qux             | ③                |
| F2  | `go https://example.com/path/to` | go / https://example.com/path/to | go https://example.com/ / path/to | go / https://example.com/path/to | ③                |
| G   | `彼は「こんにちは」と言った`    | 彼は / 「こん                     | 彼は「 / こんに                 | 彼は / 「こん                     | ② `「`           |
| H   | `漢字（注）です`               | 漢字 / （注） / です              | 漢字（ / 注）で / す            | 漢字 / （注） / です              | ② `（`           |
| L   | `he said "hello world" ok`     | he said / "hello                  | he said " / hello               | he said / "hello                  | ② `"`            |
| O   | `it's 'quoted' text here`      | it's / 'quoted'                   | it's ' / quoted'                | it's / 'quoted'                   | ② `'`            |
| N   | `한글abc123 다음` (keep-all)   | 한글abc123 / 다음                 | 한글 / abc123 / 다음            | 한글abc123 / 다음                 | ④                |
| N2  | `価格1200円です` (keep-all)    | 価格1200円です                    | 価格 / 1200 / 円 / です         | 価格1200円です                    | ④                |
| D   | `Save / Cancel` (컨테이너 = 실폭 − 0.5) | Save / ⏎ Cancel            | fits 로 판정 (폭 누락, Tier 2 가 구제) | Save / ⏎ Cancel (Tier 2 불요)    | computeLines     |
| I · M · M2 · P · Q · R | 한글+라틴 normal · 하이픈 · 전화번호 · `Save /` · `Wait...` · `(note)` | —        | Chrome 과 일치                  | 변화 없음                         | —                |

### 4-12. 시스템 영향

| 항목                      | Before                                             | After                                                                       |
| ------------------------- | -------------------------------------------------- | --------------------------------------------------------------------------- |
| Tier 3 결함 (16 케이스)   | 11 불일치                                          | 16/16 일치 (Chrome 오라클 기준)                                             |
| Skia 렌더 (hintedText)    | 틀린 위치의 `\n` → Skia 만 dangling·분리           | Preview 와 같은 줄 위치                                                     |
| `maxLineWidth` (fit-content 폭) | 연속 기호·공백 누락 → 과소                    | 정확                                                                        |
| Tier 2 의존               | 줄 수 정확성이 `verifyLines` 에 의존               | preprocessing 만으로 정확, Tier 2 는 안전망                                 |
| Canvas 2D 적용 범위       | letterSpacing 텍스트는 CanvasKit                   | (4-7 적용 시) letterSpacing 도 Canvas 2D                                    |
| 이모지 텍스트 (<24px)     | CSS 보다 이른 줄바꿈                               | 폰트당 1회 보정으로 일치                                                     |
| 성능                      | sub-0.01 ms                                        | 선형 패스 3개 추가, 같은 자릿수. 이모지 보정은 폰트당 DOM read 1회           |
| 테스트                    | 손으로 만든 fixture (dead 규칙 가림)               | `tokenize()` 실경로 fixture + Chrome 기대값 16 케이스 고정                  |
| 변경 파일                 | —                                                  | `canvas2dSegmentCache.ts` (상수 표 · `preprocessTokens` · `computeLines` · 이모지) + 테스트. `needsFallback` 은 4-7 시에만 |

## 5. 도입 제안

| 순서 | 내용                                                    | 종류       | 검증                                                                                                                                                                                                                        |
| ---- | ------------------------------------------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | 4-1 · 4-2 · 4-3 · 4-4 · 4-5 (Tier 3 규칙 5 + computeLines 1) | 동작 변경  | 단위 fixture 는 **`tokenize()` 실경로로 생성** (손으로 만든 `breakable:true` 구두점 fixture 금지 — G 의 dead 규칙을 가린 원인). §3 표의 16 케이스를 `canvas2dSegmentCache.test.ts` 에 Chrome 기대값으로 고정. `/cross-check` Text · live 는 빌더 Text 에 A/E/G/L/N 문자열을 넣고 Preview 와 줄 위치 대조 |
| 2    | 4-6 이모지 보정                                         | 동작 변경  | 이모지 포함 Text 14px 에서 Skia↔Preview 줄 수 대조 (DPR 2 헤드 환경에서만 재현 — headless DPR 1 은 무효, `PLATFORM_BUGS.md` "Retina retest")                                                                            |
| 3    | 4-7 letterSpacing                                       | 동작 변경  | letter-spacing 2px Text 의 Skia↔Preview 폭·줄 수 대조                                                                                                                                                                       |
| —    | Tier 2 `verifyLines` 제거                               | 보류       | upstream 은 기각했지만 우리 오버헤드는 sub-0.01ms 로 이득이 없고, D 케이스처럼 안전망이 실제로 동작 중. 1 반영 후 한 phase 지나 miss 0 이면 재검토                                                                          |
| —    | `@chenglou/pretext` 직접 도입                           | 보류       | 여전히 0.0.x, `system-ui` 미지원 (우리 폰트 체인에 포함), hintedText→CanvasKit 결합이 우리 고유. 대안 A 기각 사유 중 "#89/#96/#98 미해결" 은 0.0.7/0.0.8 로 해소됐으나 도입 비용 구조는 그대로                             |
| —    | Rust 이관                                               | 유지 (제외) | ADR-916 2-E 판정 그대로 — 측정은 브라우저 폰트 엔진이어야 CSS 정합                                                                                                                                                          |

1 은 `src` 동작 변경이므로 review-loop-closure.md §3 "동작 변경" 행 (원복 RED 전량 · 관련 스위트 · live 필수 · evidence/README/CHANGELOG). 판독 프롬프트에는 "production 재현 시나리오가 없는 커버리지 지적은 LOW deferred" 문구.

## 6. 문서 drift

- `docs/adr/design/051-canvas2d-text-measurement-breakdown.md` 상태 "설계 완료, Phase 0 대기" — 코드는 2026-04-05 `ed3a67ac3` 부터 live.
- 메모리 `adr051-pretext-integration.md` "상태: Proposed, Phase 0 대기" — 같은 drift (이 문서와 함께 갱신).
- `PRETEXT_ANALYSIS.md` 는 v0.0.4 기준. `measureNaturalWidth` 는 0.0.5 에서 복귀, `inline-flow.ts` 는 `rich-inline.ts` 로 개명, `EngineProfile` 에서 `preferEarlySoftHyphenBreak` 제거·`breakKeepAllAfterPunctuation` 추가.

## 7. 재현 자료

**Chrome 오라클** (아무 https 페이지 콘솔에서):

```js
const font = "16px Arial", cv = document.createElement("canvas").getContext("2d"); cv.font = font;
const M = (s) => cv.measureText(s).width;
function lines(text, width, css = "") {
  const d = Object.assign(document.createElement("div"), { textContent: text });
  d.style.cssText = `position:absolute;font:${font};line-height:24px;width:${width}px;white-space:normal;overflow-wrap:normal;${css}`;
  document.body.appendChild(d);
  const tn = d.firstChild, byTop = new Map(); let i = 0;
  for (const cp of Array.from(text)) {
    const r = document.createRange(); r.setStart(tn, i); r.setEnd(tn, i + cp.length);
    const rs = r.getClientRects(), top = Math.round((rs[rs.length - 1] ?? r.getBoundingClientRect()).top);
    byTop.set(top, (byTop.get(top) ?? "") + cp); i += cp.length;
  }
  d.remove(); return [...byTop.entries()].sort((a, b) => a[0] - b[0]).map((e) => e[1]);
}
lines("Price $100 today", M("Price $") + 1.5);            // → ["Price", " $100", " today"]
lines("한글abc123 다음", M("한글") + 1.5, "word-break:keep-all"); // → ["한글abc123", " 다음"]
```

**현재 구현 시뮬레이션**: `node --experimental-strip-types` 로 `canvas2dSegmentCache.ts` 의 `tokenize / preprocessTokens / computeLines` 를 직접 import 하고 fake 등폭 (10px/grapheme) 을 넣는다 — `import.meta.hot` 과 `document` 가드가 있어 그대로 실행된다. 프로토타입 규칙은 §4 코드 그대로.
