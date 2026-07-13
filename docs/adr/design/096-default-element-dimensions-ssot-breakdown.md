# ADR-096 구현 상세 — Default Element Dimensions SSOT

> ADR-096 본문: [096-default-element-dimensions-ssot.md](../completed/096-default-element-dimensions-ssot.md)
>
> 본 문서는 ADR-096 Decision (하이브리드 대안 A) 의 실행 상세를 담는다. ADR 본문의 "구현 상세" 링크 대상.

## 실측 데이터

### DEFAULT_ELEMENT_WIDTHS (`utils.ts:461-472`, 8 키)

| 키       | 값 (px) | 분류           | Spec 매핑                      |
| -------- | ------- | -------------- | ------------------------------ |
| input    | 180     | Spec 있음      | `Input` → spec.defaultWidth    |
| select   | 150     | Spec 있음      | `Select` → spec.defaultWidth   |
| textarea | 200     | Spec 있음      | `TextArea` → spec.defaultWidth |
| img      | 150     | HTML primitive | `elementDefaults.width.img`    |
| image    | 280     | Spec 있음      | `Image` → spec.defaultWidth    |
| video    | 300     | HTML primitive | `elementDefaults.width.video`  |
| canvas   | 200     | HTML primitive | `elementDefaults.width.canvas` |
| iframe   | 300     | HTML primitive | `elementDefaults.width.iframe` |

**이관 대상**: Spec 4건 (input/select/textarea/image) + primitives 4건 (img/video/canvas/iframe).

### DEFAULT_ELEMENT_HEIGHTS (`utils.ts:1428-1468`, 30 키)

| 키                                               | 값 (px)           | 분류                       | 이관 대상                             |
| ------------------------------------------------ | ----------------- | -------------------------- | ------------------------------------- |
| button                                           | 36                | Spec 있음                  | `Button.defaultHeight`                |
| select                                           | 36                | Spec 있음                  | `Select.defaultHeight`                |
| textarea                                         | 80                | Spec 있음                  | `TextArea.defaultHeight`              |
| p                                                | 24                | HTML primitive             | `elementDefaults.height.p`            |
| span                                             | 20                | HTML primitive             | `elementDefaults.height.span`         |
| h1~h6                                            | 40/36/32/28/24/20 | HTML primitive             | `elementDefaults.height.h1~h6`        |
| div/section/article/header/footer/nav/aside/main | 0                 | HTML primitive (container) | `elementDefaults.height.div` 등       |
| img                                              | 150               | HTML primitive             | `elementDefaults.height.img`          |
| image                                            | 200               | Spec 있음                  | `Image.defaultHeight`                 |
| video/canvas                                     | 200/150           | HTML primitive             | `elementDefaults.height.video/canvas` |
| ul/ol                                            | 0                 | HTML primitive (container) | `elementDefaults.height.ul/ol`        |
| li                                               | 24                | HTML primitive             | `elementDefaults.height.li`           |
| table                                            | 0                 | HTML primitive             | `elementDefaults.height.table`        |
| tr/td/th                                         | 36                | HTML primitive             | `elementDefaults.height.tr/td/th`     |

**이관 대상**: Spec 4건 (button/select/textarea/image) + primitives 26건 (HTML primitive tags).

### 종합

- **Spec 확장 대상**: 총 **5 spec** (Button / Input / Select / TextArea / Image)
  - Button: width 없음 + height 36
  - Input: width 180 + height Spec.sizes 기반 (유지)
  - Select: width 150 + height 36
  - TextArea: width 200 + height 80
  - Image: width 280 + height 200
- **Primitives 대상**: HTML primitive tag **~26건** (dimensions 축별로 중복 제거 시)

## Phase 구성

### Phase 1 — ComponentSpec Schema 확장 (15분)

**파일**: `packages/specs/src/types/spec.types.ts`

`ComponentSpec` 인터페이스에 optional 필드 추가:

```ts
export interface ComponentSpec<Props = Record<string, unknown>> {
  // ... 기존 필드 ...

  /**
   * ADR-096: 인트린직 폭 기본값 (px).
   *
   * width prop 이 명시되지 않고 `fit-content` 도 확정 불가한 경우의 폴백.
   * `DEFAULT_ELEMENT_WIDTHS` Record 해체 — spec 있는 태그는 본 필드로 이관.
   *
   * - undefined → HTML primitive defaults (`primitives/elementDefaults.ts`) lookup
   *   → 없으면 80 (DEFAULT_WIDTH) 적용
   */
  defaultWidth?: number;

  /**
   * ADR-096: 인트린직 높이 기본값 (px).
   *
   * height prop 이 명시되지 않고 자식/콘텐츠 기반 auto 도 확정 불가한 경우의 폴백.
   *
   * - undefined → HTML primitive defaults (`primitives/elementDefaults.ts`) lookup
   *   → 없으면 estimateTextHeight() 적용
   */
  defaultHeight?: number;
}
```

**검증**: type-check 3/3 PASS 확인.

### Phase 2 — primitives/elementDefaults.ts 신설 (30분)

**신규 파일**: `packages/specs/src/primitives/elementDefaults.ts`

```ts
/**
 * ADR-096: HTML primitive tag 별 기본 치수 (px).
 *
 * `ComponentSpec` 이 없는 generic HTML element 의 intrinsic 폴백 dimensions.
 * Spec 이 있는 태그는 `ComponentSpec.defaultWidth` / `defaultHeight` 를 우선 사용.
 *
 * 소비처: `utils.ts` getIntrinsicWidth / getIntrinsicHeight 폴백 체인.
 */

export const HTML_PRIMITIVE_DEFAULT_WIDTHS: Readonly<Record<string, number>> = {
  img: 150,
  video: 300,
  canvas: 200,
  iframe: 300,
};

export const HTML_PRIMITIVE_DEFAULT_HEIGHTS: Readonly<Record<string, number>> =
  {
    // Text primitives
    p: 24,
    span: 20,
    h1: 40,
    h2: 36,
    h3: 32,
    h4: 28,
    h5: 24,
    h6: 20,
    // Containers (0 = auto, 자식 기반)
    div: 0,
    section: 0,
    article: 0,
    header: 0,
    footer: 0,
    nav: 0,
    aside: 0,
    main: 0,
    // Media
    img: 150,
    video: 200,
    canvas: 150,
    // Lists
    ul: 0,
    ol: 0,
    li: 24,
    // Tables
    table: 0,
    tr: 36,
    td: 36,
    th: 36,
  };
```

**index.ts 재export**: `packages/specs/src/primitives/index.ts` + 패키지 `src/index.ts` 에 re-export 추가 (기존 font/colors/radius 관행과 동일).

**검증**: specs 166/166 PASS.

### Phase 3 — 5 spec 이관 (30분)

각 spec 파일에 `defaultWidth` / `defaultHeight` 필드 추가. **Record 값 1:1 이관 — BC 영향 0**.

| Spec 파일          | defaultWidth |                  defaultHeight |
| ------------------ | -----------: | -----------------------------: |
| `Button.spec.ts`   |     (미설정) |                             36 |
| `Input.spec.ts`    |          180 | (미설정 — `sizes.height` 우선) |
| `Select.spec.ts`   |          150 |                             36 |
| `TextArea.spec.ts` |          200 |                             80 |
| `Image.spec.ts`    |          280 |                            200 |

각 spec 파일 상단 주석에 ADR-096 참조 추가:

```ts
// ADR-096: DEFAULT_ELEMENT_WIDTHS/HEIGHTS Record 해체 —
//   기존 utils.ts:461/1428 Record 값 1:1 이관, BC 영향 0.
```

**검증**: `pnpm build:specs` + specs 166/166 PASS. snapshot 변동 없음 예상 (defaultWidth/Height는 CSS Generator emit 대상 외).

### Phase 4 — 소비처 전환 + Record 2 건 삭제 (30분)

**파일**: `apps/builder/src/builder/workspace/canvas/layout/engines/utils.ts`

#### 4.1 Import 추가

```ts
import {
  HTML_PRIMITIVE_DEFAULT_WIDTHS,
  HTML_PRIMITIVE_DEFAULT_HEIGHTS,
} from "@composition/specs";
import { LOWERCASE_TAG_SPEC_MAP } from "./implicitStyles"; // 또는 공통 모듈로 hoist
```

> **주의**: `LOWERCASE_TAG_SPEC_MAP` 이 `implicitStyles.ts` local 인 경우 `engines/tagSpecLookup.ts` 같은 공통 파일로 hoist 하거나, `packages/specs` 에 export 하는 방안 고려. ADR-083 Phase 0 선례 따름.

#### 4.2 getIntrinsicWidth 전환 (`utils.ts:1410` 주변)

```ts
// 5. 태그별 기본 너비
const spec = LOWERCASE_TAG_SPEC_MAP.get(tag);
const specDefault = spec?.defaultWidth;
if (specDefault !== undefined) return specDefault;

const primitiveDefault = HTML_PRIMITIVE_DEFAULT_WIDTHS[tag];
if (primitiveDefault !== undefined) return primitiveDefault;

// 6. 알 수 없는 태그는 기본값 사용
return DEFAULT_WIDTH;
```

#### 4.3 getIntrinsicHeight 전환 (`utils.ts:2635` 주변)

```ts
// 7. 태그별 기본 높이
const spec = LOWERCASE_TAG_SPEC_MAP.get(tag);
const specDefault = spec?.defaultHeight;
if (specDefault !== undefined) return specDefault;

const primitiveDefault = HTML_PRIMITIVE_DEFAULT_HEIGHTS[tag];
if (primitiveDefault !== undefined) return primitiveDefault;

// 8. fallback: text height 추정
const fs = fontSize ?? 16;
return estimateTextHeight(fs, fs * 1.5);
```

#### 4.4 Record 2 건 삭제

- `utils.ts:461-472` `DEFAULT_ELEMENT_WIDTHS` 선언 제거
- `utils.ts:1428-1468` `DEFAULT_ELEMENT_HEIGHTS` 선언 제거

#### 4.5 검증

```bash
pnpm -w type-check         # 3/3 PASS
cd packages/specs && pnpm exec vitest run    # 166/166 PASS
cd apps/builder && pnpm test -- --run        # 227/227 PASS
rg "Record<string, number>" apps/builder/src/builder/workspace/canvas/layout/engines/{utils,cssResolver}.ts
# 예상 결과: 0 건 (ADR-091 G4 완결)
```

## 검증 수치

- Record 카운트: **2 → 0** (R2/R6 완전 해체, ADR-091 G4 100% 달성)
- 신규 Spec 필드: 5 spec × 2 필드 = 최대 10 필드 (optional — 실제로는 6~7 선언)
- 신규 파일: 1 (`primitives/elementDefaults.ts`)
- 수정 파일: 5 spec + 1 utils + 1 spec.types + 2 index

## BC 영향 수식화

- **저장된 프로젝트 데이터 영향**: 0
  - 이유: 저장 데이터는 `width`/`height` 명시 style 을 포함. Default 경로는 style 미지정 + fit-content 불가 시에만 진입.
  - 기존 Record 값을 변경 없이 1:1 이관 → 동일 tag 에 동일 값 반환.
- **재직렬화 필요 파일**: 0
- **Style Panel 영향**: 없음 (editor 는 explicit style 편집, default 는 표시하지 않음)
- **렌더 결과 diff**: 0 (동일 값, 동일 경로)

## Rollback 전략

Phase 4 소비처 전환 후 회귀 발견 시:

1. `utils.ts:1410/2635` 분기를 `const w = DEFAULT_ELEMENT_WIDTHS[tag];` 로 원복
2. Record 2 건 재선언 (단, 이미 삭제 commit 이므로 revert)
3. Spec 필드는 optional 이라 잔존해도 무영향

## 후속 ADR 후보

- ADR-096 Addendum 1 (선택): 저장된 프로젝트의 기존 width/height 가 default 와 일치하는 경우 undefined 로 ellipsize 하는 migration (storage 크기 최적화). Phase 4 완료 후 필요성 판단.
- ADR-097 (별개): Tier 3 `ADR-093-A1` TagList items SSOT 이관.
