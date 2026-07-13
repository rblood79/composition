# ADR-108 r5 구현 상세 — `containerVariants` consumer 확장 Phase 계획

> 본 문서는 [ADR-108 r5](../completed/108-container-runtime-derived-styles.md) 의 구현 상세 (Phase, 파일 변경표, 체크리스트, 코드 예시) 를 담는다. ADR 본문에는 Context/Alternatives/Decision/Risks/Gates 만 유지.
>
> **r4 → r5 변경 요약** (Codex r4 2 이슈 verified):
>
> 1. **G4/P5 시퀀싱 완화**: 기존 G4 (resolveLabelFlexDir/applySideLabelChildStyles grep == 0) 가 P5 이전에 만족 불가 (TagGroup L541 + TextField/TextArea 통합 분기 L1231 가 P5 대상). G4 → "12 기존 variant 보유 컨테이너 분기 제거" 로 완화 + **G5b 신설** (P5 종료 시 함수 정의 + 호출 site 완전 제거).
> 2. **Registry 카운트 재정정**: packages/specs **99 entries** (95 아님 — SelectTrigger/SelectValue/SelectIcon/DateInput 이미 등록), builder-only **11** + specs-only **2** = 13 차이. 진짜 alias **8** (12 아님), missing spec 3 (동일), stale 후보 2 (동일). 목표: **99 → 102 정본 + 8 alias layer**.
>
> **r3 → r4 변경 요약** (Codex r3 4 이슈 verified): (a) **TextArea** containerVariants 미보유 확증 → P3 → P5 이동 (TagGroup 과 함께 신규 추가 대상). (b) **Select** containerVariants + labelPosition 둘 다 보유 확증 → P3 정식 포함. (c) Builder alias 15 → **12 진짜 alias + 3 정본 spec 누락** (IllustratedMessage / CardView / TableView) 분류 (r5 에서 **8 alias** 로 재정정). (d) P6 follow-up scope **ToggleButton → ToggleButtonGroup** 정정. (e) **TagGroup Preview 수동 CSS 동기화 예외** 명시 (R9 / Decision #10).
>
> **r5.5 구현 결과** (2026-04-23): P0-P5 완료. `TagGroup`/`TextArea` containerVariants 추가, `TagGroup.css` mirror 주석 추가, TextArea generated CSS emit 확인, `resolveLabelFlexDir` / `applySideLabelChildStyles` grep 0. P6 orientation 은 follow-up ADR 로 유지.

## Phase 구성

| Phase  | 목표                                                                                                                                            | 출력                                                                                                                                                                                                                 | 범위                                 | Gate      |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ | --------- |
| **P0** | Registry 통합 — packages/specs 정본화 (**99 → 102**) + builder alias layer (**8**) 분리                                                         | `@composition/specs` 정본 BASE_TAG_SPEC_MAP + `apps/builder/.../sprites/builderAliasMap.ts` (8)                                                                                                                      | Registry layer (102 정본 + 8 alias)  | G0        |
| **P1** | `resolveContainerVariants` helper + selector mini-matcher 신설                                                                                  | `packages/specs/src/renderers/resolveContainerVariants.ts`                                                                                                                                                           | helper + 16 spec selector audit      | G1        |
| **P2** | Canvas implicitStyles 가 helper 소비 — TextField PoC                                                                                            | `implicitStyles.ts` 머지 파이프라인 + 자식 nested 매칭                                                                                                                                                               | TextField 단일 (대표 컨테이너)       | G2        |
| **P3** | Panel useLayoutValues + 12 컨테이너 sweep (Select 포함, TextArea 제외)                                                                          | Panel ctx 확장 + 12 컨테이너 implicitStyles 분기 제거                                                                                                                                                                | 12 컨테이너 + 4 section hook         | G3        |
| **P4** | **(r5 완화)** 12 기존 variant 보유 컨테이너 분기 제거 (TagGroup/TextArea 분기는 P5 대상으로 잔존)                                               | 12 컨테이너 implicitStyles 분기 제거. P5b 완료 후 `resolveLabelFlexDir` / `applySideLabelChildStyles` 는 최종 결과 0                                                                               | implicitStyles.ts 부분 정리          | G4        |
| **P5** | **TagGroup + TextArea** containerVariants 신규 추가 + TagGroup 분기 + TextField/TextArea 통합 분기 + 함수 정의 완전 제거 + 수동 CSS 동기화 정책 | TagGroup.spec.ts / TextArea.spec.ts containerVariants + TagGroup.css mirror 동기화 docstring + L541 TagGroup 분기 + L1231 TextField/TextArea 통합 분기 제거 + 함수 정의 2개 삭제                                     | TagGroup + TextArea + helper cleanup | G5a + G5b |
| P6     | (follow-up ADR) orientation runtime variant 적용 — **ToggleButtonGroup** + Toolbar                                                              | 별도 ADR proposal                                                                                                                                                                                                    | ToggleButtonGroup + Toolbar          | —         |

## 영향 컨테이너 매트릭스 (16 unique — Codex r3 정정)

| 컨테이너                    | containerVariants 보유 | labelPosition |             orientation              | implicitStyles 분기 위치                                        |  Phase   |
| --------------------------- | :--------------------: | :-----------: | :----------------------------------: | --------------------------------------------------------------- | :------: |
| TextField                   |           ✅           |      ✅       |                  —                   | L1240-1242 + applySideLabel L1241                               | P2 (PoC) |
| NumberField                 |           ✅           |      ✅       |                  —                   | L1023-1052 + applySideLabel L1051                               |    P3    |
| SearchField                 |           ✅           |      ✅       |                  —                   | L945 (ComboBox/Select 통합)                                     |    P3    |
| DateField                   |           ✅           |      ✅       |                  —                   | L1299-1300                                                      |    P3    |
| TimeField                   |           ✅           |      ✅       |                  —                   | (sweep)                                                         |    P3    |
| DatePicker                  |           ✅           |      ✅       |                  —                   | L1638-1650 + applySideLabel L1660                               |    P3    |
| DateRangePicker             |           ✅           |      ✅       |                  —                   | (sweep)                                                         |    P3    |
| ColorField                  |           ✅           |      ✅       |                  —                   | (sweep)                                                         |    P3    |
| ComboBox                    |           ✅           |      ✅       |                  —                   | L945 (Select/SearchField 통합)                                  |    P3    |
| **Select**                  |           ✅           |   ✅ (확증)   |                  —                   | L945 (ComboBox/SearchField 통합)                                |    P3    |
| CheckboxGroup               |           ✅           |      ✅       |                  ✅                  | L739-747                                                        |    P3    |
| RadioGroup                  |           ✅           |      ✅       |                  ✅                  | L968-994 + applySideLabel L993                                  |    P3    |
| **TagGroup**                |      ✅ (P5 추가)      |      ✅       |                  —                   | L541-556 → helper 소비 + mirror CSS                             |  **P5**  |
| **TextArea**                |      ✅ (P5 추가)      |      ✅       |                  —                   | TextField/TextArea 통합 helper 경로                             |  **P5**  |
| **ToggleButtonGroup**       |   (P6 진입 전 audit)   |       —       |            ✅ (L25/L165)             | implicitStyles.ts:**669-680** (togglebuttongroup 분기)          |    P6    |
| Toolbar                     |           ✅           |       —       |                  ✅                  | (sweep — orientation 분기)                                      |    P6    |
| ~~ToggleButton~~ (scope 외) |   (parent injection)   |       —       | `_groupPosition.orientation` 만 사용 | scope 외 (`ToggleButton.spec.ts:34`)                            |    —     |
| Form / Meter / ProgressBar  |           ✅           |       —       |                  —                   | (containerVariants 다른 키 — quiet 등)                          | (audit)  |

## P0: Registry 통합 (packages/specs 정본화 + builder alias layer 분리)

### P0-1. 두 BASE_TAG_SPEC_MAP 차이 (Codex r4 카운트 재정정 — 11 builder-only + 2 specs-only)

| 측면                                                         | packages/specs (**99**)                                                       | apps/builder (108)                                                                                                             |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| 정본 spec entries (양쪽 공유)                                | 모든 base spec + SelectTrigger/SelectValue/SelectIcon/DateInput **이미 등록** | 동일                                                                                                                           |
| **(A) 진짜 builder UI alias (8)** — packages/specs 부재      | (없음)                                                                        | ComboBoxWrapper / ComboBoxInput / ComboBoxTrigger / SearchFieldWrapper / SearchInput / SearchIcon / SearchClearButton / TabBar |
| **(B) packages/specs export 인데 runtime registry 누락 (3)** | export 만 있음 (`packages/specs/src/index.ts:575/580/584`)                    | runtime registry 에 등록 — IllustratedMessage / CardView / TableView                                                           |
| **(C) packages/specs 만 보유 (2)**                           | DisclosureHeader / Section                                                    | (없음 — 누락 사유 P0-2 에서 확인)                                                                                              |

### P0-2. 통합 정책 결정 (Codex r4 카운트 재정정)

1. **Source of truth**: `packages/specs/src/runtime/tagToElement.ts:125` 의 `BASE_TAG_SPEC_MAP` 정본 (**99 entries**) 유지.
2. **(B) 정본 spec 누락 등록**: IllustratedMessage / CardView / TableView 3개를 `packages/specs/src/runtime/tagToElement.ts:125` 의 BASE_TAG_SPEC_MAP 에 추가 (**99 → 102 entries**). 이미 `packages/specs/src/index.ts:575/580/584` 에 spec 본체 export 중이므로 import + 등록만 필요.
3. **(A) Builder alias layer 분리 (8)**: `apps/builder/src/builder/workspace/canvas/sprites/builderAliasMap.ts` (신규) 에 진짜 **8 alias** 정의. 각 alias 가 매핑된 정본 spec 문서화:
   - ComboBoxWrapper → SelectTriggerSpec / ComboBoxInput → SelectValueSpec / ComboBoxTrigger → SelectIconSpec
   - SearchFieldWrapper → SelectTriggerSpec / SearchInput → SelectValueSpec / SearchIcon → SelectIconSpec / SearchClearButton → SelectIconSpec
   - TabBar → (정본 spec 매핑 audit 필요 — 실 정의 확인)
4. **현 builder tagSpecMap.ts** (278 줄) 는 builderAliasMap 으로 축소 + `IMAGE_TAGS` (Canvas sprite 전용) 만 잔존.
5. **(C) DisclosureHeader/Section 누락 사유 확인**:
   - `git log -- apps/builder/.../sprites/tagSpecMap.ts | head` 으로 history 확인
   - 의도적 제외 (예: builder UI 미노출, ADR-093 등) 인지, builder 측 stale 인지 판단
   - 의도적이면 builderAliasMap 에 추가하지 않음 (정본 정의는 유지) / stale 이면 builderAliasMap 에 추가 → builder layer 8 또는 10
6. **expandChildSpecs 통합**: `expandChildSpecs` 함수를 packages/specs 로 이동 (이미 BASE_TAG_SPEC_MAP 와 함께 사용). builder alias map 도 동일 함수로 expand.
7. **alias variant 정책 (R2)**: **8 진짜 alias** 들이 `containerVariants` 보유 여부 = 0 확증. 정본 spec 의 variant 를 alias 가 share 하도록 lookup helper 가 alias → 정본 spec 추적.

### P0-3. 8 Consumer Import 경로 갱신

| #   | Consumer                                                        | 현재 import                                           | 신규 import                                                                                                                                                                                                                                                                                                                       |
| --- | --------------------------------------------------------------- | ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `apps/builder/.../skia/StoreRenderBridge.ts`                    | `from "../../sprites/tagSpecMap"`                     | `from "@composition/specs"` + (alias 필요시 builderAliasMap)                                                                                                                                                                                                                                                                      |
| 2   | `apps/builder/.../skia/buildSpecNodeData.ts`                    | `from "../../sprites/tagSpecMap"`                     | `from "@composition/specs"`                                                                                                                                                                                                                                                                                                       |
| 3   | `apps/builder/.../layout/engines/tagSpecLookup.ts`              | (LOWERCASE 정의)                                      | `from "@composition/specs"` + (lowercase 변환은 packages/specs export)                                                                                                                                                                                                                                                            |
| 4   | `apps/builder/.../layout/engines/implicitStyles.ts`             | `from "../../sprites/tagSpecMap"`                     | `from "@composition/specs"`                                                                                                                                                                                                                                                                                                       |
| 5   | `apps/builder/.../layout/engines/fullTreeLayout.ts`             | `resolveContainerStylesFallback` from impl            | `from "./implicitStyles"` **wrapper 경유** (함수 정의는 `@composition/specs` 이관 완료. 단 builder 는 alias 포함 merged map 주입 필요 → implicitStyles.ts:135 wrapper 가 `LOWERCASE_TAG_SPEC_MAP` 주입 후 packages/specs 원함수 호출. 직접 `@composition/specs` import 시 정본 102 only → ComboBoxWrapper 등 alias fallback 공백) |
| 6   | `apps/builder/.../panels/styles/utils/specPresetResolver.ts`    | `from "../../../workspace/canvas/sprites/tagSpecMap"` | `from "@composition/specs"`                                                                                                                                                                                                                                                                                                       |
| 7   | `apps/builder/.../panels/styles/hooks/useLayoutAuxiliary.ts`    | (tagSpecMap import)                                   | `from "@composition/specs"`                                                                                                                                                                                                                                                                                                       |
| 8   | `apps/builder/.../panels/styles/hooks/useTransformAuxiliary.ts` | (tagSpecMap import)                                   | `from "@composition/specs"`                                                                                                                                                                                                                                                                                                       |

### P0-4. 체크리스트

- [ ] **(B)** `packages/specs/src/runtime/tagToElement.ts:125` BASE_TAG_SPEC_MAP 에 IllustratedMessage / CardView / TableView 3개 추가 (**99 → 102 entries**)
- [ ] **(C)** DisclosureHeader / Section 누락 사유 audit (`git log` + ADR 검색) → builderAliasMap 추가 vs 정본 유지 결정
- [ ] **(A)** `apps/builder/.../sprites/builderAliasMap.ts` 신규 — 진짜 **8 alias** 정의 + `@composition/specs` re-export. 각 alias → 정본 spec 매핑 docstring (ComboBoxWrapper → SelectTriggerSpec 등)
- [ ] `apps/builder/.../sprites/tagSpecMap.ts` — `IMAGE_TAGS` 만 잔존, 나머지 삭제 또는 builderAliasMap 으로 이관
- [ ] `expandChildSpecs` packages/specs 이관 + builder alias 도 동일 함수 적용
- [ ] `resolveContainerStylesFallback` 도 packages/specs 이관 (이전 r2 P0 plan 유지)
- [ ] 8 consumer import 경로 갱신
- [ ] alias **8개**의 `containerVariants` 보유 0 확증 (`grep "containerVariants" apps/builder/.../sprites` → 0)
- [ ] `pnpm -F @composition/specs build` PASS (cycle 없음)
- [ ] `pnpm type-check` 전 영역 PASS
- [ ] `tagSpecMap.test.ts` / `resolveContainerStylesFallback.test.ts` / `tokenConsumerDrift.test.ts` PASS
- [ ] Canvas 렌더 spot-check 회귀 0 (Chrome MCP — Button/TagGroup/Tabs/ComboBox/IllustratedMessage 5종)

## P1: `resolveContainerVariants` helper + selector mini-matcher

### P1-1. helper 시그니처

**파일**: `packages/specs/src/renderers/resolveContainerVariants.ts` (신규)

```ts
import type { ComponentSpec, ContainerVariantStyles } from "../types";

export interface ResolvedContainerVariants {
  /** 부모 container 에 적용할 styles (variant 매칭 결과 머지) */
  styles: Record<string, string>;
  /** 자식 element 에 적용할 nested rule 목록 (consumer 가 selector 매칭 후 props 주입) */
  nested: Array<{
    selector: string;
    styles: Record<string, string>;
  }>;
}

export function resolveContainerVariants<P>(
  spec: ComponentSpec<P>,
  props: Readonly<P>,
): ResolvedContainerVariants {
  const variants = spec.composition?.containerVariants;
  if (!variants) return { styles: {}, nested: [] };

  const styles: Record<string, string> = {};
  const nested: Array<{ selector: string; styles: Record<string, string> }> =
    [];

  for (const [dataAttr, valueMap] of Object.entries(variants)) {
    const propKey = dataAttrToCamelCase(dataAttr); // "label-position" → "labelPosition"
    const propValue = String((props as Record<string, unknown>)[propKey] ?? "");
    const variant = valueMap[propValue];
    if (!variant) continue;

    Object.assign(styles, variant.styles ?? {});
    if (variant.nested) {
      for (const n of variant.nested) {
        nested.push({ selector: n.selector, styles: n.styles ?? {} });
      }
    }
  }

  return { styles, nested };
}

function dataAttrToCamelCase(s: string): string {
  return s.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}
```

`@composition/specs` 에서 export.

### P1-2. Selector mini-matcher

**파일**: `packages/specs/src/renderers/matchNestedSelector.ts` (신규)

```ts
/** Canvas element tree 에서 nested.selector 매칭 알고리즘.
 *
 * 지원 selector 문법 (whitelist — P1 audit 결과 기반):
 * - `> .react-aria-X` — 직접 자식 중 tag === "X"
 * - `> :not(.react-aria-X)` — 직접 자식 중 tag !== "X"
 * - `.react-aria-X` — 깊이 무관 tag === "X" (TextField .react-aria-Input 등)
 *
 * 미지원 selector 사용 spec 은 P3 sweep 시 deferred 분류.
 */
export function matchNestedSelector(
  selector: string,
  child: { tag: string },
  isDirectChild: boolean,
): boolean {
  const trimmed = selector.trim();

  // > .react-aria-X
  const directPositive = trimmed.match(/^>\s*\.react-aria-([A-Z][a-zA-Z]+)$/);
  if (directPositive) {
    return isDirectChild && child.tag === directPositive[1];
  }

  // > :not(.react-aria-X)
  const directNegative = trimmed.match(
    /^>\s*:not\(\.react-aria-([A-Z][a-zA-Z]+)\)$/,
  );
  if (directNegative) {
    return isDirectChild && child.tag !== directNegative[1];
  }

  // .react-aria-X (깊이 무관)
  const anyDescendant = trimmed.match(/^\.react-aria-([A-Z][a-zA-Z]+)$/);
  if (anyDescendant) {
    return child.tag === anyDescendant[1];
  }

  // 미지원 selector
  console.warn(`[matchNestedSelector] unsupported selector: ${selector}`);
  return false;
}
```

### P1-3. CSSGenerator 와의 동등성 확증

P1 종료 시 CSSGenerator 의 기존 containerVariants 소비 로직 (`renderers/CSSGenerator.ts:1147`) 가 새 helper 와 동일 결과 산출하는지 확증 (output 비교 unit test).

### P1-4. 16 spec selector audit

- [ ] 16 spec (`grep "containerVariants" packages/specs/src/components/`) 의 모든 `nested[].selector` 추출
- [ ] 각 selector 가 mini-matcher whitelist 에 들어가는지 확인
- [ ] 미지원 selector 사용 spec 목록화 (P3 deferred 분류)

### P1-5. 체크리스트

- [x] `packages/specs/src/renderers/resolveContainerVariants.ts` 신규
- [x] `packages/specs/src/renderers/matchNestedSelector.ts` 신규 (selector whitelist)
- [x] `packages/specs/src/index.ts` export 추가 (`resolveContainerVariants` / `matchNestedSelector` / `isSupportedNestedSelector` + 타입)
- [x] CSSGenerator output 동등성 unit test PASS — `resolveContainerVariants.test.ts` (15 tests pass, CSSGenerator block 부분집합 + 전체 (dataAttr, attrValue) 재생산 확증)
- [x] 16 spec selector audit 결과 문서화 — 아래 P1-6 참조
- [x] `pnpm -F @composition/specs build` + `pnpm -r type-check` PASS (pre-existing specs 에러 6건 잔존 — 본 P1 변경과 무관)

### P1-6. 16 spec nested selector audit 결과 (P1 G1 R1 대응)

**whitelist 통과 (Canvas 레이아웃 주입 대상 — 8 selector, 5 spec):**

| spec                                 | selector                    | 용도                           |
| ------------------------------------ | --------------------------- | ------------------------------ |
| TextField / SearchField / ColorField | `> .react-aria-Label`       | side label grid column 1 배치  |
| TextField / SearchField / ColorField | `> :not(.react-aria-Label)` | side label grid column 2 배치  |
| TextField / ColorField               | `.react-aria-Input`         | 자식 Input 기본 스타일         |
| NumberField                          | `> .react-aria-Label`       | side label grid column 1       |
| NumberField                          | `> :not(.react-aria-Label)` | side label grid column 2       |
| NumberField                          | `.react-aria-Group`         | Group 래퍼 스타일              |
| DateField / TimeField                | `.react-aria-DateInput`     | DateInput 기본 스타일          |
| DatePicker / DateRangePicker         | `.react-aria-Group`         | Group 기본 스타일 (state 이전) |

**deferred — CSS-only (state/attr/pseudo 의존 — Canvas 가 CSS 경로에 위임, 18 selector):**

- `*:where([data-focused])` / `*:where([data-invalid])` — focus/invalid 상태 selector (TextField/ColorField/DateField/TimeField/SearchField)
- `*[data-focus-within]` / `*[data-invalid]` / `*[data-hovered]` / `*[data-pressed]` / `*[data-focus-visible]` — attr 상태 selector (DatePicker/DateRangePicker/ComboBox/Select)
- `*:has([data-focused])` / `*:has([data-invalid])` — `:has()` pseudo (SearchField container)
- `&[data-invalid] .react-aria-Group` / `&[data-invalid] .react-aria-Button` / `.react-aria-Button[data-focused]:not([data-disabled])` / `.react-aria-Button[data-pressed]:not([data-disabled])` — `&` prefix + 복합 chain (NumberField/Select)

**deferred — 비표준 compound class (Canvas 가 자체 매칭 없이 CSS 경로 유지, 6 selector):**

- `.searchfield-container` / `.combobox-container` (SearchField/ComboBox) — SSOT wrapper
- `.radio-items` / `.checkbox-items` (RadioGroup/CheckboxGroup) — items 래퍼
- `.fill` (ProgressBar) — fill 서브 엘리먼트
- `.react-aria-DatePicker-time-field` / `.react-aria-DateRangePicker-{start,end}-time` (DatePicker/DateRangePicker) — dash compound
- `.react-aria-Button .select-chevron` (Select) — descendant chain
- `.react-aria-Popover[data-trigger="..."]` / `.react-aria-Dialog .react-aria-Calendar` (DatePicker/DateRangePicker/ComboBox/Select) — popover/dialog portal (externalStyles 성격 — 본 ADR scope 외)

**결론**: labelPosition="side" 기반 layout 주입에 필요한 모든 selector 가 whitelist 통과. 나머지는 CSSGenerator emit 유지로 시각 정합 보존. P2 TextField PoC 착수 가능.

## P2: Canvas implicitStyles 가 helper 소비 — TextField PoC

### P2-1. implicitStyles 머지 파이프라인 신설

**파일**: `apps/builder/src/builder/workspace/canvas/layout/engines/implicitStyles.ts`

**진입부 추가** (L499 근처, 모든 컨테이너 공통):

```ts
import {
  resolveContainerVariants,
  matchNestedSelector,
  resolveContainerStylesFallback,
} from "@composition/specs";

const spec = LOWERCASE_TAG_SPEC_MAP.get(containerTag);
const variantResolved = spec
  ? resolveContainerVariants(spec, containerEl.props ?? {})
  : { styles: {}, nested: [] };

// 부모 styles 머지: static < variant < user
const parentStyle: Record<string, unknown> = {
  ...resolveContainerStylesFallback(containerTag, rawParentStyle),
  ...variantResolved.styles,
  ...rawParentStyle, // user 명시 최우선
};

// 자식 element props 주입
filteredChildren = children.map((child) => {
  const matchedNested = variantResolved.nested.filter((n) =>
    matchNestedSelector(n.selector, child, true /* isDirectChild */),
  );
  if (matchedNested.length === 0) return child;

  const childStyle = (child.props?.style || {}) as Record<string, unknown>;
  const nestedStyles = Object.assign({}, ...matchedNested.map((m) => m.styles));
  return {
    ...child,
    props: {
      ...child.props,
      style: { ...nestedStyles, ...childStyle }, // user 명시 최우선
    },
  };
});
```

### P2-2. TextField 분기 제거

**변경 전** (L1240-1242):

```ts
const tfLabelPos = containerProps?.labelPosition as string | undefined;
const tfFlexDir = resolveLabelFlexDir(...);
filteredChildren = applySideLabelChildStyles(filteredChildren, tfLabelPos);
```

**변경 후**: 위 파이프라인이 일반 처리 — TextField 전용 분기 삭제.

### P2-3. 체크리스트

- [x] implicitStyles.ts TextField/TextArea 분기에 `resolveContainerVariants` + `matchNestedSelector` 소비 도입 (`implicitStyles.ts:1198-1257`)
- [x] `labelPosition` prop 직접 참조 제거 — side 모드 판정이 `spec.containerVariants["label-position"].side` 데이터 경유
- [x] TextField/TextArea Skia 렌더 top/side 시각 정합 — unit test 5 건 PASS (`textFieldImplicitStyles.test.ts`)
- [x] user-edit override 보존 — `applySideLabelChildStyles` 의 `cs.width ?? ...` 머지 규칙이 variant 주입값보다 user style 우선 (테스트 c 케이스)
- [x] `pnpm -r type-check` PASS + builder 전체 254 tests PASS
- [ ] Chrome MCP 대칭 spot-check — P4 sweep 완료 시 다른 11 컨테이너와 일괄 검증

### P2-4. 구현 세부 (ADR r5.3)

**변경 전 (기존 분기 — r5 이전)**

```ts
const tfLabelPos = containerProps?.labelPosition as string | undefined;
filteredChildren = applySideLabelChildStyles(filteredChildren, tfLabelPos);
const tfFlexDir = resolveLabelFlexDir(tfLabelPos, parentStyle.flexDirection);
effectiveParent = withParentStyle(
  containerEl,
  tfLabelPos === "side"
    ? getSideLabelParentStyle(parentStyle)
    : { ...parentStyle, flexDirection: tfFlexDir, gap: parentStyle.gap ?? 4 },
);
```

**변경 후 (P2 PoC — r5.3)**

```ts
const tfSpec = LOWERCASE_TAG_SPEC_MAP.get(containerTag);
const tfVariant = resolveContainerVariants(tfSpec, containerProps ?? undefined);
const tfSideMode =
  Object.keys(tfVariant.styles).length > 0 || tfVariant.nested.length > 0;

if (tfSideMode) {
  filteredChildren = filteredChildren.map((child) => {
    const matches = tfVariant.nested.some((n) =>
      matchNestedSelector(n.selector, { tag: child.tag ?? "" }, true),
    );
    if (!matches) return child;
    const [adapted] = applySideLabelChildStyles([child], "side");
    return adapted ?? child;
  });
  effectiveParent = withParentStyle(
    containerEl,
    getSideLabelParentStyle(parentStyle),
  );
} else {
  effectiveParent = withParentStyle(containerEl, {
    ...parentStyle,
    flexDirection: "column",
    gap: parentStyle.gap ?? 4,
  });
}
```

**SSOT 효과**:

- `labelPosition` prop 을 직접 읽지 않음 → spec `containerVariants` 데이터가 **Canvas side-mode 스위치** 역할.
- `matchNestedSelector` 가 spec `nested[].selector` 에 매칭된 자식에만 Canvas flex 시뮬레이션 주입 → spec 데이터와 Canvas 주입 child 범위 정합.
- `resolveLabelFlexDir` 호출 2건 → 1건 감소 (TagGroup/NumberField/...만 잔존, P3 sweep 대상).

**제약**: Canvas layout engine 이 `display:grid` / `grid-template-columns` 미지원 — spec CSS 가 grid 로 표현한 side-label 레이아웃은 `getSideLabelParentStyle` + `applySideLabelChildStyles` 의 **Canvas flex 시뮬레이션 어댑터**로 번역. ADR r5 Decision #5 의 "머지 순서: static < variant < user" 는 어댑터 내부에서 `cs.width ?? specValue` 패턴으로 보존.

## P3: Panel + 12 컨테이너 sweep (Codex r3 정정 — Select 포함, TextArea 제외)

### P3-1. Panel useElementStyleContext 확장

**파일**: `apps/builder/src/builder/panels/styles/hooks/useElementStyleContext.ts`

```ts
import { useShallow } from "zustand/react/shallow"; // Zustand v5+ 확증 P3 착수 전 required

export interface ElementStyleContext {
  style: Record<string, unknown> | undefined;
  type: string | undefined;
  size: string | undefined;
  props: Record<string, unknown> | undefined; // 신규
}

// childTags 는 본 ADR r3 에서는 Panel 측 미사용 (helper 가 props 만 받음).
// 단, 미래 확장 여지 — context 에는 props 만 추가.
```

### P3-2. specPresetResolver ctx-aware 전환

**파일**: `apps/builder/src/builder/panels/styles/utils/specPresetResolver.ts`

```ts
import { resolveContainerVariants } from "@composition/specs";

export const resolveLayoutSpecPreset = (type, size, props?) => {
  const base = /* 기존 static tier chain */;
  if (!props || !type) return base;
  const spec = TAG_SPEC_MAP[type]; // P0 이관 후: @composition/specs
  const { styles } = resolveContainerVariants(spec, props);
  return { ...base, ...pickLayoutKeys(styles) };
};
```

`pickLayoutKeys`: variant styles 중 layout-relevant 키 (flexDirection, gap, padding 등) 추출. CSS 키 (kebab) → Panel 키 (camelCase) 변환 포함.

### P3-3. useLayoutValues 호출 변경

```ts
const { style, type, size, props } = useElementStyleContext(id);
const specPreset = useMemo(
  () => resolveLayoutSpecPreset(type, size, props),
  [type, size, props],
);
```

### P3-4. 12 컨테이너 implicitStyles 분기 제거 (TextField PoC 외 11 + Select)

각 PR 당 다음 단계:

1. 해당 컨테이너의 implicitStyles 분기 (`if (containerTag === "X") {...}`) 삭제 — P2 진입부 helper 가 일반 처리
2. `resolveLabelFlexDir` / `applySideLabelChildStyles` 호출 site 1개 감소
3. Chrome MCP `/cross-check` 통과
4. `pnpm type-check` + `pnpm build:specs` PASS

특수 케이스:

- **ComboBox/Select/SearchField 통합 분기 (L945)**: 3 컨테이너 공유 — 1 PR 로 묶어서 제거
- **CheckboxGroup/RadioGroup**: orientation 추가 처리 필요 — `containerVariants` 에 `orientation` variant 가 있는지 audit (P1 결과 참조)

### P3-5. 체크리스트

- [x] useElementStyleContext 확장 (props 필드 추가)
- [x] specPresetResolver ctx-aware
- [x] useLayoutValues 확장 ctx 전달
- [x] Panel 4 section hook (Transform/Appearance/Typography/Layout) 호환 확증 — targeted hook tests PASS
- [x] 12 컨테이너 implicitStyles 분기 전수 제거 (TextField PoC 외 11 + Select 명시 포함, TextArea 는 P5 대상으로 제외)
- [x] `grep -rn "resolveLabelFlexDir" implicitStyles.ts` → P5 완료 후 결과 0
- [x] `grep -rn "applySideLabelChildStyles" implicitStyles.ts` → P5 완료 후 결과 0
- [x] Panel Direction 필드가 12 컨테이너 (Select 포함) 실제 렌더와 일치하도록 variant fallback 경로 고정 — `useLayoutValues` / `useLayoutAuxiliary` tests PASS
- [x] user-edit override 회귀 0

## P4: 12 기존 variant 보유 컨테이너 분기 제거 (Codex r4 — G4 완화)

### P4-1. 분기 제거 대상

P3-4 의 12 컨테이너 분기 제거가 자연스럽게 P4 에 포함됨 (helper 가 implicitStyles 진입부에서 일반 처리). 본 Phase 는 P3 종료 시점의 상태 확정 + 기존 helper 함수 호출 site 부분 제거:

- **P4 시점 계획**: `applySideLabelChildStyles` 호출 4곳 중 P3 sweep 으로 3곳 제거, TextField/TextArea 통합 분기는 P5 대상으로 잔존.
- **P5b 최종 결과**: `resolveLabelFlexDir` / `applySideLabelChildStyles` 함수 정의와 호출 site 모두 제거 완료.

### P4-2. 체크리스트

- [x] P3 sweep 으로 12 컨테이너 분기 제거 완료 확증 (G4)
- [x] `applySideLabelChildStyles` 호출 4 → 0 (P5b 에서 완전 제거)
- [x] `resolveLabelFlexDir` 호출 12 → 0 (P5b 에서 완전 제거)
- [x] `pnpm -F @composition/builder type-check` PASS
- [x] Chrome MCP 12 컨테이너 spot-check 는 targeted Vitest + Panel hook tests 로 대체 기록 (CLI 환경)
- [x] **함수 정의 제거 완료** — `FORM_SIDE_LABEL_WIDTH/GAP` 상수는 공통 side-label content helper에서 계속 사용

## P5: TagGroup + TextArea `containerVariants` 신규 추가 (Codex r3 정정)

### P5-1. TagGroup containerVariants 정의

**파일**: `packages/specs/src/components/TagGroup.spec.ts`

```ts
composition: {
  // 기존 ...
  containerVariants: {
    "label-position": {
      side: {
        styles: {
          "flex-direction": "row",
          "align-items": "flex-start",
        },
      },
      // top (기본) 은 base 에서 column 처리 — 명시 불필요
    },
  },
},
```

### P5-2. TextArea containerVariants 정의

**파일**: `packages/specs/src/components/TextArea.spec.ts`

TextField 의 `containerVariants["label-position"].side` (`TextField.spec.ts:308`) 를 참조하되 selector 의 child class 차이 (`react-aria-Input` → `react-aria-TextArea`) 만 정정:

```ts
composition: {
  // 기존 ...
  containerVariants: {
    "label-position": {
      side: {
        styles: {
          display: "grid",
          "grid-template-columns": "var(--form-label-width, max-content) minmax(0, 1fr)",
          "column-gap": "var(--form-field-gap, var(--spacing-md))",
          "row-gap": "var(--spacing-xs)",
          "align-items": "start",
          width: "100%",
        },
        nested: [
          { selector: "> .react-aria-Label", styles: { "grid-column": "1", "justify-self": "stretch", "text-align": "var(--form-label-align, start)" } },
          { selector: "> :not(.react-aria-Label)", styles: { "grid-column": "2", "min-width": "0" } },
        ],
      },
    },
  },
},
```

### P5-3. TagGroup Preview 수동 CSS 동기화 정책 (R9 대응)

**문제**: TagGroup 은 `skipCSSGeneration: true` (`TagGroup.spec.ts:72`) — CSSGenerator emit 안 함. Preview 는 수동 `packages/shared/src/components/styles/TagGroup.css:9-12` 사용. P5 추가된 spec containerVariants 와 수동 CSS 가 **drift 가능**.

**상태 정리**:

- 이 mirror 는 "ADR-059 별도 해체 트랙이 곧 이어진다"는 의미가 아님
- TagGroup `skipCSSGeneration:true` 는 [ADR-106-b](../completed/106-b-taggroup-css-skipcss-justification.md) 에서 **G2 정당화** 완료
- [ADR-059 completed breakdown](completed/059-composite-field-skip-css-dismantle-breakdown.md) 에서도 **Tier 3 예외**로 확정
- 따라서 ADR-108 완료 조건은 "TagGroup mirror 예외를 명시한 채 consumer 정합을 닫는 것"이며, `skipCSSGeneration` 해체 자체는 ADR-108 성공 조건이 아님

**정책**:

- spec containerVariants 와 수동 CSS 양쪽에 동일 규칙 mirror 정의
- 수정 시 양쪽 동시 갱신 (review 체크리스트)
- spec 측에 docstring 명시: `// MIRROR: TagGroup.css:9-12 — skipCSSGeneration:true 동안 수동 동기화`
- CSS 측에 docstring 명시: `/* MIRROR: TagGroup.spec.ts containerVariants — skipCSSGeneration:true 동안 수동 동기화 */`
- 향후 재검토는 새 ADR 로만 수행한다. 현재 문서 집합에서는 예외 유지가 정본 상태다.
- Canvas/Panel 은 helper 소비 → 정합 보장 (수동 CSS 무관)

### P5-4. TextArea generated CSS 자동 정합

TextArea 는 `skipCSSGeneration: false` (default) — CSSGenerator 가 신규 containerVariants 를 자동 emit. 별도 mirror 정책 불필요.

### P5-5. 체크리스트

- [x] TagGroup.spec.ts `composition.containerVariants` 추가 + MIRROR docstring
- [x] TextArea.spec.ts `composition.containerVariants` 추가
- [x] TagGroup.css 양쪽 mirror docstring 추가
- [x] TagGroup Skia 렌더 `labelPosition="top"/"side"` 정합 — `sideLabelImplicitStyles.test.ts` PASS
- [x] TagGroup Panel Direction 필드 정합 — `resolveContainerVariants.test.ts` + Panel hook tests PASS
- [x] TextArea generated CSS 자동 emit 확증 (`packages/shared/src/components/styles/generated/TextArea.css` 에 `[data-label-position="side"]` 규칙 생성)
- [x] TextArea Skia/Preview/Panel 3축 대칭 — generated CSS + `sideLabelImplicitStyles.test.ts` + Panel hook tests PASS
- [x] `pnpm -F @composition/specs build` PASS + `pnpm -F @composition/builder type-check` PASS

## P6: orientation runtime variant (follow-up ADR — Codex r3 정정)

### P6-1. scope 분리 사유

orientation 은 **ToggleButtonGroup** / Toolbar / CheckboxGroup / RadioGroup 4 spec 영향. CheckboxGroup/RadioGroup 은 본 ADR P3 에서 처리 (labelPosition 동시 처리). 신규 2 (**ToggleButtonGroup**, Toolbar) 는 별도 scope — 별도 ADR 로 분리.

**ToggleButton 은 scope 외**: `_groupPosition.orientation` (parent ToggleButtonGroup 이 자식 ToggleButton 에 주입) 만 사용 — `ToggleButton.spec.ts:34`. orientation 자체 prop 미보유.

### P6-2. 진입 조건

- ADR-108 r5.5 P0-P5 Implemented 완결
- helper (`resolveContainerVariants`) 가 orientation variant 도 일반 처리 가능 확증 (특정 dataAttr 키 하드코드 없음)
- ToggleButtonGroup / Toolbar 에 `containerVariants.orientation` 추가

### P6-3. 후속 ADR scope

- ToggleButtonGroup orientation 분기 제거 (`implicitStyles.ts:669-680`)
- Toolbar orientation 분기 sweep
- containerVariants 에 orientation rule 추가
- helper 호출은 P0-P5 와 동일 메커니즘
- ToggleButton 의 `_groupPosition` parent injection 패턴은 별도 — orientation containerVariants 와 무관 유지

## 전체 검증 매트릭스

| Gate | Phase                                   | 통과 조건                                                                                                                                                                                                     | Chrome MCP |
| ---- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------: |
| G0   | P0                                      | 정본 **99→102** (3 누락 spec 등록) + **8 진짜 alias** layer 분리 + DisclosureHeader/Section audit + 8 consumer 갱신 + type-check 전 영역 PASS                                                                 |    spot    |
| G1   | P1                                      | helper + selector mini-matcher 구현 + 16 spec selector audit + CSSGenerator 동등성 확증                                                                                                                       |     —      |
| G2   | P2                                      | TextField 단일 Skia/Preview/Panel 3축 대칭 + 자식 element props 주입 정합 + user-override 회귀 0                                                                                                              |     ✅     |
| G3   | P3                                      | Panel 4 section hook 호환 + 12 컨테이너 (Select 포함) Panel Direction 정합 + 12 implicitStyles 분기 제거                                                                                                      |     ✅     |
| G4   | P4                                      | **(r5 완화)** 12 기존 variant 보유 컨테이너 분기 제거. P5b 에서 legacy helper 완전 제거로 흡수                                                                                                                |     ✅     |
| G5a  | P5 — TagGroup + TextArea spec 추가 종료 | TagGroup + TextArea containerVariants 추가 + TagGroup spec ↔ `TagGroup.css` mirror docstring + TextArea generated CSS 자동 정합 확증 + 양 컨테이너 Skia 회귀 0                                                |     ✅     |
| G5b  | P5 — 분기 + 함수 정의 완전 제거 종료    | `grep -rn "resolveLabelFlexDir\|applySideLabelChildStyles" apps/builder/src/builder/workspace` → **결과 0** (TagGroup L541 + TextField/TextArea 통합 분기 L1231 제거 + 함수 정의 삭제) — 기존 r4 G4 조건 흡수 |     ✅     |

## 성능 예산

- helper 호출 per-container traversal 1회, < 1ms (Object.entries 순회 + selector regex)
- Selector mini-matcher per-child 1회, regex 매칭 비용 무시 가능
- CSSGenerator 와 동일 데이터 소스 → cache 가능 (P1 helper 에 LRU 적용 검토)

## 롤백 경로

- P0: Registry 통합 → git revert (단일 PR). 8 consumer import 자동 복원. tagSpecMap.ts 원복.
- P1: helper + matcher 신설 → 미사용 시 packages/specs export 만 제거.
- P2: TextField 단일 → implicitStyles 진입부 + TextField 분기 복원.
- P3: 각 컨테이너 개별 revert. Panel 확장은 props 무시 로직으로 무력화.
- P4: 함수 정의 복원 (이전 commit 참조).
- P5: TagGroup + TextArea containerVariants 제거 — TagGroup 은 implicitStyles 분기가 P3 에서 이미 제거 상태이므로 helper 가 빈 결과 반환 → 기존 수동 CSS 가 fallback. TextArea 는 generated CSS 자동 회귀 (CSS file 재생성 필요).
- P6: follow-up ADR scope.
