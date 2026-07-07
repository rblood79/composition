# Text Wrapping & Measurement Patterns (ADR-005)

CSS 텍스트 래핑 속성의 CanvasKit 에뮬레이션 패턴.

## 핵심 구조

### 공유 유틸리티 (textWrapUtils.ts)

`canvaskitTextMeasurer.ts`(높이 측정)와 `nodeRenderers.ts`(렌더링) 양쪽에서 동일한 전처리 함수를 호출하여 **측정-렌더링 경로 일치**를 보장한다.

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

측정기(`canvaskitTextMeasurer`)와 렌더러(`specShapeConverter` + `nodeRenderers`)가 **동일한 fontFamilies 배열**을 사용해야 한다. 불일치 시 동일 텍스트에 대해 다른 intrinsic width가 산출되어 의도치 않은 줄바꿈이 발생한다.

### 측정기 — `buildFontFamilies()` (`canvaskitTextMeasurer.ts`)

```typescript
function buildFontFamilies(fontFamilyCSS: string | undefined): string[] {
  const rawFamilies = (fontFamilyCSS ?? "Pretendard")
    .split(",").map(f => f.trim().replace(/['"]/g, "")).filter(Boolean);
  const resolved = rawFamilies.map(f => skiaFontManager.resolveFamily(f));
  // 중복 제거 + Pretendard fallback 보장
  ...
}
```

### 렌더러 — `specShapeConverter.ts`

```typescript
const fontFamilies = shape.fontFamily
  ? [
      ...shape.fontFamily.split(",").map((f) => f.trim().replace(/['"]/g, "")),
      "Inter",
      "system-ui",
      "sans-serif",
    ]
  : ["Inter", "system-ui", "sans-serif"];
```

### Spec-Driven Text Style — `specTextStyle.ts`

Spec 기반 컴포넌트의 텍스트 폭 측정 시 `extractSpecTextStyle(tag, props)`로 Spec shapes에서 실제 fontSize/fontWeight/fontFamily를 추출. `BUTTON_SIZE_CONFIG` 등 하드코딩 의존 제거.

```typescript
const specStyle = extractSpecTextStyle("button", props);
// specStyle.fontSize = 14 (Spec 정의), specStyle.fontWeight = 500, specStyle.fontFamily = "Pretendard, Inter, ..."
```

### 금지 패턴

- CSS fontFamily 문자열을 CanvasKit `fontFamilies` 배열의 단일 요소로 전달
- 측정기에서 `split(",")[0]`으로 첫 번째 폰트만 추출 (fallback chain 차이 → shaping 결과 차이)
- Spec 컴포넌트에 fontWeight/fontSize 하드코딩 (Spec 변경 시 측정-렌더 불일치)

참조: `docs/bug/skia-button-text-linebreak.md`

## 데이터 흐름

text leaf 포함 전 컴포넌트가 `buildSpecNodeData.ts` 단일 파이프라인으로 Skia 노드를 생성한다 (구 TextSprite/ElementSprite 이원 경로 폐기 — ADR-058 Phase 4 에서 `buildTextNodeData` 도 폐지, text 요소는 catalog/spec shapes 경로로 통합):

```
element.props.style
  → buildSpecNodeData.ts (catalog/spec shapes 구성)
  → specShapesToSkia() (specShapeConverter.ts)
  → "Text style overrides" 블록: specNode.children 의 text 자식에
     Phase A(whiteSpace/wordBreak/overflowWrap/lineHeight/textIndent/clipText)
     + Phase B(textDecoration/textOverflow/wordSpacing/fontVariant/fontStretch/textShadow/verticalAlign) 주입
  → nodeRendererText.ts 렌더
```

**CRITICAL**: spec/catalog shapes는 element style을 자동 상속하지 않으므로, `specNode.children` 순회하여 text 자식에 수동 주입 필수. Tag/Badge 는 기본 `nowrap`, Label-in-nowrap-parent (`isLabelInNowrapParent`) 특수 케이스 유지.

## CSS 상속 연동

- `cssResolver.ts` (layout/engines): `INHERITABLE_PROPERTIES` Set에 `wordBreak`, `overflowWrap`, `whiteSpace` 등록
- `elementUpdate.ts`: `INHERITED_LAYOUT_PROPS_UPDATE`에 동일 3개 속성 등록 — 부모→자식 상속 전파 + layoutVersion 트리거 판정 (3-심볼 체인 정본: `.claude/rules/layout-engine.md`)

## isEllipsis 3중 조건 (CRITICAL)

```typescript
const isEllipsis =
  node.text.textOverflow === "ellipsis" &&
  whiteSpace === "nowrap" &&
  !!node.text.clipText;
```

CSS 전제조건: `text-overflow:ellipsis` + `white-space:nowrap` + `overflow:hidden|clip`

## Inspector Preset UI

`TypographySection.tsx`에서 7가지 프리셋 + Custom 모드 제공:

| 프리셋         | white-space | word-break  | overflow-wrap | text-overflow | overflow |
| -------------- | ----------- | ----------- | ------------- | ------------- | -------- |
| Normal         | —           | —           | —             | —             | —        |
| No Wrap        | `nowrap`    | —           | —             | —             | —        |
| Truncate (...) | `nowrap`    | —           | —             | `ellipsis`    | `hidden` |
| Break Words    | —           | —           | `break-word`  | —             | —        |
| Break All      | —           | `break-all` | —             | —             | —        |
| Keep All (CJK) | —           | `keep-all`  | `break-word`  | —             | —        |
| Preserve       | `pre-wrap`  | —           | —             | —             | —        |

`deriveTextBehaviorPreset()`: 5개 속성 값 → 프리셋 이름 역변환 (Inspector 표시용).

## CanvasKit 큰 width 렌더링 실패 회피

```typescript
// nowrap/pre에서 paragraph.layout(100000) → 텍스트 미렌링
// 해결: maxIntrinsicWidth + 1로 재레이아웃
if (!isEllipsis && (whiteSpace === "nowrap" || whiteSpace === "pre")) {
  const intrinsicWidth = paragraph.getMaxIntrinsicWidth();
  if (intrinsicWidth > 0) {
    paragraph.layout(Math.ceil(intrinsicWidth) + 1);
  }
}
```

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
