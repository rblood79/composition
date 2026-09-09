# Skia Button 텍스트 줄바꿈 버그

> **종결 기록 (2026-09-09 이동)**: 2026-03-05 에 해결 완료된 버그 기록이다 (`docs/bug/` 에서 이동). 버그 병인의 현행 정본은 `.claude/rules/canvas-rendering.md` 다.

## Status: 해결 완료 (2026-03-05)

## 증상

- "Button AAAA CCCD EE" 같은 **공백 포함 텍스트**가 CSS Preview에서는 한 줄인데, Canvas(Skia/WebGL)에서 강제 줄바꿈됨
- "Button AAAA" / "CCCD EE" 로 분리되어 2줄 렌더링
- 공백 없는 텍스트에서는 발생하지 않음

## 근본 원인

레이아웃 측정기(`canvaskitTextMeasurer`)와 Skia 렌더러(`nodeRenderers` + `specShapeConverter`)가 **서로 다른 CanvasKit ParagraphStyle**을 사용하여 동일 텍스트에 대해 다른 intrinsic width를 산출.

### 불일치 3가지 (모두 해결됨)

1. **fontWeight 불일치**: 측정기 기본 400 vs Spec Button 500 → 글리프 폭 차이
2. **fontFamily CSS 체인 미분할**: `specShapeConverter`가 `"Pretendard, Inter, system-ui, ..."` 전체를 단일 배열 요소로 CanvasKit에 전달 → `fontFamilies` 매칭 실패 → fallback 폰트 사용
3. **측정기-렌더러 fontFamilies 배열 불일치**: 측정기 `[resolvedPretendard, "Pretendard"]` (2개) vs 렌더러 `[Pretendard, Inter, system-ui, -apple-system, sans-serif]` (5개+) → CanvasKit text shaping 결과 차이 (142px vs 142.88px)

### 불일치 발생 경로 (수정 전)

```
[Layout Engine — 폭 측정]                [Skia Renderer — 텍스트 렌더링]
calculateContentWidth()                  specShapesToSkia() → nodeRenderers
  → measureTextWidth()                     → paragraph.layout(maxWidth)
  → canvaskitTextMeasurer                  → maxWidth = containerWidth - padding
  → fontFamilies: [resolved, "Pretendard"] → fontFamilies: [全 CSS chain split+resolved]
  → fontWeight: 400 (하드코딩)              → fontWeight: 500 (Spec 값)
  → 결과: 142px → Taffy container = 176px  → text area = 142px < 142.88px → 줄바꿈!
```

## 해결 방법 (근본 수정 3건)

### 1. Spec-Driven Text Style 추출 (`specTextStyle.ts` 신규)

Spec의 `render.shapes()`에서 실제 TextShape의 fontSize/fontWeight/fontFamily를 추출하여 측정에 사용. 기존 `BUTTON_SIZE_CONFIG` 하드코딩 의존 제거.

```typescript
// specTextStyle.ts
export function extractSpecTextStyle(tag, props): SpecTextStyle | null {
  const shapes = spec.render.shapes(props, variant, size, "default");
  const textShape = shapes.find(s => s.type === "text");
  return { fontSize: textShape.fontSize, fontWeight: ..., fontFamily: ... };
}

// utils.ts — 기존 BUTTON_SIZE_CONFIG.fontSize → Spec 추출값 우선
const inlineSpecStyle = extractSpecTextStyle(tag, props);
const fontSize = inlineSpecStyle?.fontSize ?? sizeConfig.fontSize;
const fontWeight = inlineSpecStyle?.fontWeight ?? 400;
const fontFamily = inlineSpecStyle?.fontFamily ?? specFontFamily.sans;
```

### 2. fontFamily CSS 체인 분할 (`specShapeConverter.ts`)

렌더러가 CSS comma-separated fontFamily를 개별 폰트명으로 split하여 CanvasKit에 전달.

```typescript
// 수정 전: ["Pretendard, Inter, system-ui, ...", "Inter", "system-ui", "sans-serif"]
// 수정 후: ["Pretendard", "Inter", "system-ui", "-apple-system", "sans-serif", ...]
const fontFamilies = shape.fontFamily
  ? [
      ...shape.fontFamily.split(",").map((f) => f.trim().replace(/['"]/g, "")),
      "Inter",
      "system-ui",
      "sans-serif",
    ]
  : ["Inter", "system-ui", "sans-serif"];
```

### 3. 측정기 fontFamilies 통일 (`canvaskitTextMeasurer.ts`)

측정기도 렌더러와 동일하게 전체 CSS 체인을 split+resolve하여 동일한 fontFamilies 배열 생성.

```typescript
// 수정 전
const fontFamily = skiaFontManager.resolveFamily(
  resolveFontFamily(style.fontFamily),
);
const fontFamilies = [fontFamily, "Pretendard"]; // 2개

// 수정 후 — buildFontFamilies() 공유 헬퍼
function buildFontFamilies(fontFamilyCSS: string | undefined): string[] {
  const rawFamilies = (fontFamilyCSS ?? "Pretendard")
    .split(",")
    .map((f) => f.trim().replace(/['"]/g, ""))
    .filter(Boolean);
  const resolved = rawFamilies.map((f) => skiaFontManager.resolveFamily(f));
  // 중복 제거 + Pretendard fallback 보장
  return [
    ...new Set(resolved),
    ...(resolved.includes("Pretendard") ? [] : ["Pretendard"]),
  ];
}
```

## 보조 수정 (기존 코드에서 추가된 방어 로직)

### Safety Net (`nodeRenderers.ts`)

렌더 시 `maxIntrinsicWidth ≤ effectiveLayoutWidth + dprEpsilon`인데 줄바꿈이 발생하면 `Math.ceil(maxIntrinsic) + 1`로 재레이아웃. 근본 수정 후에는 트리거되지 않지만, edge case 방어용으로 유지.

### Early Exit (`textWrapUtils.ts`)

`cssNormalBreakProcess`에서 전체 텍스트 intrinsic width가 maxWidth 이하면 단어별 분할 없이 즉시 반환. 개별 단어 폭 합산 > 전체 폭 (커닝/셰이핑 차이) 으로 인한 false positive 줄바꿈 방지.

## Sub-pixel Precision 검증

파이프라인 전체에서 소수점이 보존됨을 확인:

| 단계                                                   | 타입         | 소수점 |
| ------------------------------------------------------ | ------------ | ------ |
| `measureTextWidth()` → `getMaxIntrinsicWidth()`        | JS float64   | 보존   |
| `enrichWithIntrinsicSize` → `injectedStyle.width`      | JS number    | 보존   |
| `dim()` → `"176.88px"`                                 | string       | 보존   |
| Taffy Rust `parse_dimension` → `parse::<f32>()`        | f32          | 보존   |
| Taffy `layout.size.width` → `get_layouts_batch()`      | Float32Array | 보존   |
| DirectContainer → `computedContainerSize.width`        | JS number    | 보존   |
| `specShapesToSkia(shapes, skiaTheme, finalWidth, ...)` | JS number    | 보존   |

**`Math.ceil()` 보상 불필요** — 측정기 ↔ 렌더러 fontFamilies 통일만으로 충분.

## 관련 파일

- `canvaskitTextMeasurer.ts` — `buildFontFamilies()`, `measureWidth()`, `measureWrapped()`
- `specTextStyle.ts` (신규) — `extractSpecTextStyle()`, `TEXT_BEARING_SPECS`
- `layout/engines/utils.ts` — `measureTextWidth()`, `calculateContentWidth()`
- `specShapeConverter.ts` — fontFamily split, Spec shapes → SkiaNodeData 변환
- `nodeRenderers.ts` — Safety Net (DPR epsilon 범위 내 줄바꿈 교정)
- `textWrapUtils.ts` — `cssNormalBreakProcess()` early exit
- `fontManager.ts` — `resolveFamily()` 폰트 매칭

## 관련 컴포넌트

Button, ToggleButton, Badge, Link, Checkbox, Radio, Switch, Input — 공백 포함 텍스트를 가진 모든 Spec 기반 컴포넌트

## 교훈

1. **CanvasKit fontFamilies는 개별 폰트명 배열** — CSS comma-separated chain을 그대로 전달하면 매칭 실패
2. **동일 폰트에 대해서도 fallback chain이 다르면 shaping 결과가 다름** — ASCII만 포함해도 0.88px 차이 발생 가능
3. **측정기 ↔ 렌더러 ParagraphStyle 완전 일치가 유일한 근본 해결** — epsilon/buffer/ceil은 증상 회피
