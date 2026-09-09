# Tag 세로 스태킹 버그 (TagGroup flex-row 레이아웃)

> **종결 기록 (2026-09-09 이동)**: 2026-03-06 에 해결 완료된 버그 기록이다 (`docs/bug/` 에서 이동 — 해당 디렉토리는 2026-03 이후 갱신이 없었다). 버그 병인의 현행 정본은 `.claude/rules/` 의 실측 "Why" 기록이다.

> **날짜**: 2026-03-06
> **영향**: Canvas(WebGL) TagGroup 내 Tag 컴포넌트가 가로 대신 세로로 배치
> **상태**: 해결 완료

## 증상

- CSS Preview: TagGroup 내 Tag 1, Tag 2가 가로(flex-row)로 정상 배치
- Canvas(WebGL): Tag들이 세로로 스태킹 (width: 100%로 확장)
- 프로퍼티 패널에서 사이즈(S/M/L) 변경 시 세로 스태킹 재발

## 근본 원인 (4건)

### 1. enrichWithIntrinsicSize가 Tag의 텍스트 기반 폭을 계산하지 않음

`enrichWithIntrinsicSize`에서 `INLINE_BLOCK_TAGS`에 해당하는 Tag가 childElements가 없을 때 `box.contentWidth`(부모 availableWidth 기반)를 사용. 실제로는 텍스트 기반 `calculateContentWidth`를 호출해야 함.

**파일**: `engines/utils.ts` — `enrichWithIntrinsicSize`

```typescript
// Before: box.contentWidth (부모 폭 기반 — 너무 넓음)
const childResolvedWidth = box.contentWidth;

// After: calculateContentWidth (텍스트 기반 fit-content 폭)
const childResolvedWidth =
  childElements && childElements.length > 0
    ? calculateContentWidth(
        element,
        childElements,
        getChildElements,
        _computedStyle,
      )
    : INLINE_BLOCK_TAGS.has(tag) || hasExplicitIntrinsicWidthKeyword
      ? calculateContentWidth(
          element,
          undefined,
          getChildElements,
          _computedStyle,
        )
      : box.contentWidth;
```

### 2. Block-child normalization이 enriched width를 덮어씀

`fullTreeLayout.ts`의 block-child 정규화 로직이 flex-wrap 컨테이너 내 block-level 자식에 `width: 100%`를 주입. 이미 `enrichWithIntrinsicSize`가 계산한 numeric px 폭이 덮어써짐.

**파일**: `fullTreeLayout.ts` — block-child normalization

```typescript
// Before: 무조건 100% 주입
batch[childBatchIdx].style.width = "100%";

// After: 이미 enriched된 numeric/px 폭이 있으면 스킵
const existingW = batch[childBatchIdx].style.width;
if (
  typeof existingW === "number" ||
  (typeof existingW === "string" &&
    existingW !== "auto" &&
    existingW !== "100%")
) {
  continue;
}
batch[childBatchIdx].style.width = "100%";
```

### 3. TagGroup 사이즈 상속이 getChildElements에 전파되지 않음

`getChildElements`는 `elementsMap`에서 원본 Element를 반환. TagGroup의 size prop이 Tag 자식에 상속되지 않아, `calculateContentWidth` 재귀 호출 시 항상 md 기본값으로 계산. L 사이즈 Tag의 실제 폭보다 좁은 TagGroup fit-content 폭이 산출되어 세로 스태킹 발생.

**파일**: `fullTreeLayout.ts` — `effectiveGetChildElements` wrapper

```typescript
// TagGroup/TagList 컨테이너에서 calculateContentWidth 호출 시
// Tag 자식에 부모의 size prop을 주입하는 래퍼
let effectiveGetChildElements = getChildElements;
if (containerTag === "taggroup" || containerTag === "taglist") {
  const tagGroupSize = /* TagGroup의 size prop 조회 */;
  if (tagGroupSize) {
    effectiveGetChildElements = (id: string) => {
      const children = getChildElements(id);
      return children.map((child) => {
        if (child.tag !== "Tag") return child;
        if (child.props?.size) return child; // 개별 size 우선
        return { ...child, props: { ...child.props, size: tagGroupSize } };
      });
    };
  }
}
```

### 4. Taffy f32 vs JS f64 부동소수점 정밀도 차이

Tag border-box 폭이 JS f64로 계산(예: 87.49 + 89.87 + 4 gap = 181.36)되지만, Taffy WASM은 f32로 처리. TagGroup fit-content 폭(181.36)이 f32 truncation 후 자식 합계보다 미세하게 작아져 불필요한 flex-wrap 발생.

**파일**: `engines/utils.ts` — `enrichWithIntrinsicSize`

```typescript
// Math.ceil: Taffy(f32)와 JS(f64) 간 부동소수점 정밀도 차이로
// flex-wrap 컨테이너에서 자식 합계가 부모 폭을 미세하게 초과하여
// 불필요한 wrap이 발생하는 것을 방지
injectedStyle.width = Math.ceil(injectWidth);
```

## 수정 파일

| 파일                | 변경 내용                                                                                          |
| ------------------- | -------------------------------------------------------------------------------------------------- |
| `engines/utils.ts`  | `enrichWithIntrinsicSize` — INLINE_BLOCK_TAGS calculateContentWidth 분기 + Math.ceil               |
| `fullTreeLayout.ts` | block-child normalization guard + TagGroup size 상속(filteredChildren + effectiveGetChildElements) |

## 검증

| 사이즈 | Canvas 크기 | 레이아웃 | CSS 일치 |
| ------ | ----------- | -------- | -------- |
| S (sm) | 115 x 48    | 가로     | O        |
| M (md) | 140 x 55    | 가로     | O        |
| L (lg) | 182 x 67    | 가로     | O        |

## 교훈

1. **INLINE_BLOCK_TAGS의 fit-content 폭 계산**: `box.contentWidth`(availableWidth 기반)가 아닌 `calculateContentWidth`(텍스트 기반)를 사용해야 함
2. **Block-child normalization guard**: enriched width가 있는 요소에 `width: 100%`를 덮어쓰면 안 됨
3. **Parent-delegated props (size 등) 상속**: CSS는 `data-tag-size` 선택자로 자동 상속하지만, Canvas 엔진은 `getChildElements` 래퍼로 명시적 전파 필요
4. **f32/f64 정밀도**: fit-content 컨테이너에서 자식 폭 합산 시 `Math.ceil` 적용으로 WASM 정밀도 차이 방지
