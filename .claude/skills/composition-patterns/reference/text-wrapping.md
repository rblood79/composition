# Text Wrapping & Measurement Patterns (ADR-005)

CSS 텍스트 래핑 속성의 CanvasKit 에뮬레이션 패턴.

## 핵심 구조

### 공유 유틸리티 (textWrapUtils.ts)

위치: `apps/builder/src/builder/workspace/canvas/utils/textWrapUtils.ts`. `nodeRendererText.ts` 의 `needsFallback` 분기 (Canvas 2D 가 표현 못 하는 letterSpacing · wordSpacing · white-space≠normal · break-all) 가 CanvasKit Paragraph 를 만들 때 호출한다.

측정 기준 두 가지를 구분한다:

- **레이아웃 측정**: `catalogTextMeasure` (`catalogRuntime/textMeasure.ts`) — CanvasKit 준비 후엔 Canvas 가 그릴 paragraph 로 잰다 (Pretendard cv11 같은 기본 font feature 반영). 준비 전엔 Canvas 2D fallback.
- **페인트 줄바꿈 hint**: `nodeRendererText.ts` — Canvas 2D 가 정한 줄바꿈을 `\n` 으로 넣어 CanvasKit 에 강제 (ADR-051). 두 기준이 달라 줄 수가 갈리면 여기부터 본다.

| 함수                        | 용도                                                                           |
| --------------------------- | ------------------------------------------------------------------------------ |
| `cssNormalBreakProcess()`   | `word-break:normal` + `overflow-wrap:normal` — 수동 `\n` 삽입 + effectiveWidth |
| `computeKeepAllWidth()`     | `word-break:keep-all` — CJK 연속 문자열을 단어로 보호                          |
| `preprocessBreakWordText()` | `overflow-wrap:break-word` — maxWidth 초과 단어에 ZWS+`\n` 삽입                |
| `measureTokenWidth()`       | CanvasKit으로 단일 토큰 폭 측정                                                |
| `measureSpaceWidth()`       | 스페이스 폭 측정 ('x x' vs 'xx' 차이)                                          |

### 에뮬레이션 조합 테이블

| word-break | overflow-wrap       | 처리 방식                                              |
| ---------- | ------------------- | ------------------------------------------------------ |
| normal     | normal              | `cssNormalBreakProcess()` → `\n` 삽입 + effectiveWidth |
| normal     | break-word/anywhere | `preprocessBreakWordText()` → ZWS+`\n` 삽입            |
| break-all  | (any)               | `Array.from(text).join('\u200B')` — 전체 ZWS 삽입      |
| keep-all   | normal              | `computeKeepAllWidth(allowOverflowBreak=false)`        |
| keep-all   | break-word          | `computeKeepAllWidth(allowOverflowBreak=true)`         |

## SkiaNodeData.text 텍스트 래핑 필드

`SkiaNodeData` (`apps/builder/src/builder/workspace/canvas/skia/nodeRendererTypes.ts`) 의 `text` 필드에 인라인 타입으로 정의 (별도 named 타입 없음):

```typescript
// SkiaNodeData["text"] 중 래핑 관련 필드
whiteSpace?: "normal" | "nowrap" | "pre" | "pre-wrap" | "pre-line";
wordBreak?: "normal" | "break-all" | "keep-all";
overflowWrap?: "normal" | "break-word" | "anywhere";
textOverflow?: "ellipsis" | "clip";
clipText?: boolean; // overflow:hidden|clip → canvas.clipRect()
```

## fontFamilies 정합성 (CRITICAL)

Paragraph 를 만드는 두 렌더 경로 (`nodeRendererText` · `specShapeConverter`) 와 Canvas 2D 측정 font 문자열이 **동일한 fontFamilies 체인**을 사용해야 한다. 불일치 시 동일 텍스트에 대해 다른 intrinsic width가 산출되어 의도치 않은 줄바꿈이 발생한다.

### 렌더러 — `nodeRendererText.ts`

`node.text.fontFamilies` 를 `skiaFontManager.resolveFamily` 로 매핑한 `resolvedFamilies` 를 Paragraph 와 Canvas 2D 측정 (`fontFamily: fontFamilies.join(", ")`) 양쪽에 같이 넘긴다. 텍스트 binding 의 `fontFamilies` 는 `catalogFontFamilies` (`catalogRuntime/boxModel.ts`) — generic family 를 빼고 Pretendard 를 덧붙인다.

### 렌더러 — `specShapeConverter.ts`

```typescript
const fontFamilies = shape.fontFamily
  ? [
      ...shape.fontFamily.split(",").map((f) => f.trim().replace(/['"]/g, "")),
      ...CANVAS_FONT_FALLBACK_FAMILIES, // [DEFAULT_FONT_FAMILY, "system-ui", "sans-serif"] — fonts/customFonts.ts
    ]
  : [...CANVAS_FONT_FALLBACK_FAMILIES];
```

### Spec-Driven Text Style — `specTextStyle.ts`

**parity 하니스 전용** (importer 는 `engines/utils.ts` · `fullTreeLayout.ts`). Spec 기반 컴포넌트의 텍스트 폭 측정 시 `extractSpecTextStyle(tag, props)`로 Spec shapes에서 실제 fontSize/fontWeight/fontFamily를 추출. `BUTTON_SIZE_CONFIG` 등 하드코딩 의존 제거.

```typescript
const specStyle = extractSpecTextStyle("button", props);
// specStyle.fontSize = 14 (Spec 정의), specStyle.fontWeight = 500, specStyle.fontFamily = "Pretendard, Inter, ..."
```

### 금지 패턴

- CSS fontFamily 문자열을 CanvasKit `fontFamilies` 배열의 단일 요소로 전달
- 측정기에서 `split(",")[0]`으로 첫 번째 폰트만 추출 (fallback chain 차이 → shaping 결과 차이)
- Spec 컴포넌트에 fontWeight/fontSize 하드코딩 (Spec 변경 시 측정-렌더 불일치)

## 데이터 흐름 (catalog Canvas — 2026-10-04 개정)

옛 `buildSpecNodeData.ts` 의 "Text style overrides" 블록 (Phase A/B 수동 주입 · `isLabelInNowrapParent`) 은 ADR-248 Phase 4 에서 삭제됐다. 현행:

```
NodeEntry.visual (whiteSpace / wordBreak / overflowWrap / textOverflow …)
  → compositionRoot: 텍스트 leaf 는 CATALOG_INHERITED_TEXT_KEYS 를 가장 가까운 선언 조상에서 받는다 (CSS 상속)
  → canvasBinding.ts 텍스트 binding 이 SkiaNodeData.text 의 whiteSpace / wordBreak / overflowWrap /
     textOverflow / clipText 를 직접 채운다
     (CATALOG_NOWRAP_TEXT_BINDINGS — button · label · cell · column · selectvalue 는 nowrap)
  → nodeRendererText.ts 렌더
```

- rule-backed 노드 (`ruleNodeData`) 에 위 텍스트 키를 쓰면 `CATALOG_CANVAS_VISUAL_UNSUPPORTED` 로 throw — rule 실행기가 아직 칠하지 않는 키를 조용히 버리지 않는다 (`canvasBinding.ts` `RULE_UNPAINTED_TEXT_KEYS`).
- Tag / Badge / Cell / Column 기본 nowrap 은 `ruleShapes.ts` `catalogRuleShapes` 가 text shape 에 넣는다.

## CSS 상속 · 재계산 연동

- 세 키 (`whiteSpace` · `wordBreak` · `overflowWrap`) 는 `PAINT_ONLY_VISUAL_KEYS` (`packages/shared/src/catalog/transactions/transaction.ts`) 에 **없다** → transaction 이 layout 영향으로 판정해 재계산된다.
- 상속받는 자손은 composition root 의 `textInheritors` / `textKeysChanged` 가 같은 step 에 재계획한다.
- 옛 `elementUpdate.ts` `INHERITED_LAYOUT_PROPS_UPDATE` · `LAYOUT_STYLE_KEYS` 체인은 삭제됐다. `cssResolver.ts` `INHERITABLE_PROPERTIES` 는 parity 하니스 경로다.

## isEllipsis 3중 조건 (CRITICAL)

```typescript
const isEllipsis =
  node.text.textOverflow === "ellipsis" &&
  whiteSpace === "nowrap" &&
  !!node.text.clipText;
```

CSS 전제조건: `text-overflow:ellipsis` + `white-space:nowrap` + `overflow:hidden|clip`

## Inspector Preset UI

`TypographySection.tsx` 에서 7가지 프리셋 + `Custom…` 제공:

| 프리셋         | white-space | word-break  | overflow-wrap | text-overflow | overflow |
| -------------- | ----------- | ----------- | ------------- | ------------- | -------- |
| Normal         | —           | —           | —             | —             | —        |
| No Wrap        | `nowrap`    | —           | —             | —             | —        |
| Truncate (...) | `nowrap`    | —           | —             | `ellipsis`    | `hidden` |
| Break Words    | —           | —           | `break-word`  | —             | —        |
| Break All      | —           | `break-all` | —             | —             | —        |
| Keep All (CJK) | —           | `keep-all`  | `break-word`  | —             | —        |
| Auto           | `pre-wrap`  | —           | —             | —             | —        |

Auto (pre-wrap) 는 새 Text 의 기본이다 (줄바꿈 보존 · 폭에서 접힘, Figma 규약 — 종전 이름 "Preserve").

`deriveTextBehaviorPreset()` (`panels/styles/hooks/useTypographyValues.ts`): 5개 속성 값 → 프리셋 이름 역변환 (표시용).

## CanvasKit 큰 width 렌더링 실패 회피

```typescript
// nowrap/pre 의 layoutMaxWidth(100000+) 로 paragraph.layout → 텍스트 미렌더
// 해결: maxIntrinsicWidth + 1 로 재레이아웃 (nodeRendererText.ts)
if (layoutMaxWidth >= 100000 && !isEllipsis) {
  const maxIntrinsic = paragraph.getMaxIntrinsicWidth();
  effectiveLayoutWidth = Math.ceil(maxIntrinsic) + 1;
  paragraph.layout(effectiveLayoutWidth);
}
```

ellipsis 는 예외 — 이미 maxWidth 로 layout 했고 (maxLines 1 + ellipsis) intrinsic 폭으로 다시 layout 하면 "…" 이 사라진다 (2026-09-20).

## clipText 클리핑 패턴

```typescript
const shouldClip = node.text.clipText && !isEllipsis;
if (shouldClip) {
  canvas.save();
  canvas.clipRect(
    ck.XYWHRect(0, 0, node.width, node.height),
    ck.ClipOp.Intersect,
    true,
  );
}
canvas.drawParagraph(paragraph, x, y);
if (shouldClip) canvas.restore();
```

ellipsis 경로는 CanvasKit의 `maxLines:1 + ellipsis:'…'`로 자체 처리되므로 clip 불필요.
