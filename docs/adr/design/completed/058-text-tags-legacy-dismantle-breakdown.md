# ADR-058 Breakdown — TEXT_TAGS 예외 경로 해체 구현 상세

> 본 문서는 [ADR-058](../../completed/058-text-tags-legacy-dismantle.md)의 구현 상세를 분리 관리한다.
> ADR 본문은 결정과 위험 평가, 고수준 Gate 테이블만 담고, 각 Phase의 파일 변경·작업 순서·검증 체크리스트·파일 인벤토리는 여기에 둔다.

## 목차

- [Pre-Phase 0 — Preview Element Resolver 일반화](#pre-phase-0--preview-element-resolver-일반화)
- [Pre-Phase 1 — CSS Generator Stabilization](#pre-phase-1--css-generator-stabilization)
- [Phase 1 — Text 마이그레이션 + 5-point patch 제거](#phase-1--text-마이그레이션--5-point-patch-제거)
- [Phase 2 — Heading 마이그레이션 + 인프라 확장](#phase-2--heading-마이그레이션--인프라-확장)
- [Phase 3 — Paragraph/Kbd/Code spec 신설](#phase-3--paragraphkbdcode-spec-신설)
- [Phase 4 — `buildTextNodeData` 완전 폐지](#phase-4--buildtextnodedata-완전-폐지)
- [호환성 유지](#호환성-유지)
- [파일 변경 인벤토리](#파일-변경-인벤토리)
- [검증 프로토콜](#검증-프로토콜)

---

## Pre-Phase 0 — Preview Element Resolver 일반화

### 목적

`apps/builder/src/preview/App.tsx`의 `resolveHtmlTag` switch 기반 매핑을 **spec registry 기반 일반화**로 전환. 이는 근본 해법이며, Phase 1~4 전체의 선결 조건이다.

### 현재 상태 (문제)

**Preview 라우팅 우선순위** (`App.tsx:357~366` `renderElementInternal` 실측):

```typescript
const renderer = rendererMap[el.tag];
if (renderer) {
  return renderer(el, renderContext); // ← 먼저 처리, 여기서 종료
}
// 아래 fallback 경로(resolveHtmlTag 포함)는 renderer 미등록 태그만 도달
```

즉 `rendererMap["Text"]`(= `LayoutRenderers.renderText`)이 살아있는 동안 Text는 **항상 `rendererMap` 경로**로 처리되어 `<p>` 태그를 얻는다. `resolveHtmlTag` fallback은 도달하지 않는다.

**resolveHtmlTag fallback 경로** (`App.tsx:391~467`): switch/case로 Heading, Description, 복합 컴포넌트(DialogFooter/Toast/Popover 등) 등 **일부 태그만 명시적 매핑**하고 나머지는 `default: return tag.toLowerCase();`(L466)로 처리한다.

이 fallback 경로 기준의 매핑 결과(`rendererMap` 미등록 태그에만 유효):

- `Text` → `<text>` ❌ (브라우저 미인식) — `rendererMap["Text"]` 제거 후에만 드러나는 버그
- `Paragraph` → `<paragraph>` ❌ — spec 신설 + rendererMap 미등록 상태에서만 재현
- `Kbd` → `<kbd>` ✅ (우연)
- `Code` → `<code>` ✅ (우연)
- `Heading` → `<h1~h6>` (level prop 기반 동적, switch 내 하드코딩)

즉 `LayoutRenderers.renderText` 제거(Phase 1) 시점에 Text의 fallback 경로 버그가 **실제로 표면화**된다. Pre-Phase 0에서 Preview Resolver를 근본 해법으로 일반화하여 그 시점을 대비한다.

### 실행 순서 제약 (Codex 재검증 2026-04-10)

Pre-Phase 0 시점에는 `rendererMap["Text"]`가 여전히 `LayoutRenderers.renderText`에 바인딩되어 있으므로:

| 검증 대상                                    |     Pre-Phase 0에서 가능?     | 실제 검증 Phase                                    |
| -------------------------------------------- | :---------------------------: | -------------------------------------------------- |
| `getElementForTag` 헬퍼 단위 동작            |        ✅ 유닛 테스트         | Pre-Phase 0                                        |
| `resolveHtmlTag`가 `getElementForTag` 호출   |       ✅ 코드 diff 확인       | Pre-Phase 0                                        |
| 기존 `rendererMap` 경로 무회귀               |    ✅ Preview 실제 렌더링     | Pre-Phase 0                                        |
| Heading/Description 매핑 무회귀              |  ✅ 기존 switch/rendererMap   | Pre-Phase 0                                        |
| 복합 컴포넌트(DialogFooter/Toast 등) 무회귀  |              ✅               | Pre-Phase 0                                        |
| **Text → `<p>` 실제 Preview DOM 매핑**       | ❌ `rendererMap["Text"]` 우선 | **Phase 1** (`LayoutRenderers.renderText` 제거 시) |
| **Paragraph → `<p>` 실제 Preview DOM 매핑**  |         ❌ spec 부재          | **Phase 3** (spec 신설 시)                         |
| **Kbd → `<kbd>`, Code → `<code>` 실제 매핑** |         ❌ spec 부재          | **Phase 3** (spec 신설 시)                         |

Pre-Phase 0 Gate는 **헬퍼 동작 + 기존 경로 무회귀**에 한정한다. 실제 DOM 매핑 검증은 각각 Phase 1과 Phase 3에서 수행한다.

### 해법 — spec registry 기반 일반화

`@composition/specs`에서 `TAG_TO_ELEMENT` 맵(또는 동등한 채널)을 export하고, Preview App이 이를 import하여 `resolveHtmlTag`를 대체한다.

```typescript
// packages/specs/src/runtime/tagToElement.ts (신설)
import { TAG_SPEC_MAP } from "./index";

export function getElementForTag(
  tag: string,
  props?: Record<string, unknown>,
): string {
  const spec = TAG_SPEC_MAP[tag];
  if (!spec) return tag.toLowerCase();

  // 정적 element
  if (typeof spec.element === "string") return spec.element;

  // 동적 element (향후 확장 — Heading level 등)
  if (typeof spec.element === "function") return spec.element(props ?? {});

  return "div";
}
```

> **주의**: `ComponentSpec.element`는 현재 `keyof HTMLElementTagNameMap | "fragment"` 정적 타입(`spec.types.ts:73`). Pre-Phase 0의 범위는 **정적 해석까지**이다. 동적 해석(함수형 element)은 Phase 2의 Heading 인프라 확장에서 다룬다.

`App.tsx`는 `resolveHtmlTag`를 spec registry 조회 + 복합 컴포넌트 특수 케이스 조합으로 재작성:

```typescript
const resolveHtmlTag = (
  tag: string,
  props?: Record<string, unknown>,
): string => {
  // 1. Heading은 level prop 기반 동적 (Pre-Phase 0 시점에는 기존 로직 유지)
  if (tag === "Heading") {
    const level = Number(props?.level) || 3;
    return `h${Math.min(Math.max(level, 1), 6)}`;
  }

  // 2. spec registry 조회 (Text → p, Paragraph → p, Kbd → kbd, Code → code, ...)
  const specElement = getElementForTag(tag, props);
  if (specElement) return specElement;

  // 3. 복합 컴포넌트 특수 매핑 (기존 switch의 잔여 항목)
  switch (tag) {
    case "DialogFooter":
      return "footer";
    case "Toast":
      return "div";
    // ... (spec이 없는 복합 태그만 유지)
  }

  return tag.toLowerCase();
};
```

### 작업 순서

1. **`packages/specs/src/runtime/tagToElement.ts` 신설** (또는 `packages/specs/src/index.ts`에 헬퍼 추가)
   - `getElementForTag(tag, props)` 함수 export
   - `TAG_SPEC_MAP`을 참조하여 `spec.element` 정적 문자열 반환
2. **`packages/specs/src/index.ts`에서 export** — `getElementForTag` 외부 노출
3. **`apps/builder/src/preview/App.tsx` import 추가** — `@composition/specs`에서 `getElementForTag`
4. **`resolveHtmlTag` 재작성**
   - Heading 특수 케이스 유지 (level 기반 동적 — Phase 2에서 spec 레벨로 이동)
   - `getElementForTag(tag, props)` 호출로 spec 기반 매핑 1차 적용
   - 기존 switch의 복합 컴포넌트 특수 매핑은 잔여 케이스만 유지
5. **`getElementForTag` 유닛 동작 검증** — Text/Heading/Description/Button/Badge 등 기존 spec의 `element` 필드 반환 확인 (Preview DOM 실제 매핑은 `rendererMap`이 우선하므로 이 단계에서는 불가능)
6. **기존 `rendererMap` 경로 무회귀 검증** — Heading/Button/Text/Description/InlineAlert 등 모든 `rendererMap` 등록 태그가 이전과 동일한 DOM 생성
7. **기존 `resolveHtmlTag` switch 무회귀 검증** — 복합 컴포넌트(DialogFooter/Toast/Popover/Disclosure/Tab/CalendarGrid/Icon/ColorPicker 등) 매핑 정상 동작

### 검증 체크리스트

**Pre-Phase 0 시점에 검증 가능한 항목**:

- [ ] `getElementForTag("Text", {})` === `"p"` (유닛 테스트 — `Text.spec.ts`의 `element: "p"` 반환)
- [ ] `getElementForTag("Description", {})` === `"p"` (유닛)
- [ ] `getElementForTag("Button", {})` === `ButtonSpec.element` (유닛)
- [ ] `getElementForTag("Heading", {})` === `"h3"` (유닛 — Pre-Phase 0 시점에는 정적 기본값. Phase 2에서 함수형 확장 후 동적으로 전환)
- [ ] `getElementForTag("UnknownTag", {})` === `"unknowntag"` (lowercase fallback)
- [ ] `App.tsx resolveHtmlTag` 구현이 `getElementForTag` 호출 경로로 변경됨 (코드 diff 확인)
- [ ] **기존 `rendererMap` 경로 무회귀** — Preview에서 Text/Heading/Button/Description/InlineAlert 등 `rendererMap` 등록 태그가 Pre-Phase 0 이전과 동일한 DOM 구조 렌더링 (`outerHTML` diff 0건)
- [ ] **기존 `resolveHtmlTag` switch 무회귀** — 복합 컴포넌트(DialogFooter/Toast/Popover/Disclosure/Tab/CalendarGrid/Icon/ColorPicker 등) Preview DOM 매핑 정상
- [ ] `pnpm type-check` 통과 (Preview App이 `@composition/specs` import 후)
- [ ] 순환 의존성 없음 (`@composition/specs`는 `apps/builder`에 의존하지 않음)

**Pre-Phase 0에서 검증 불가능 → 후속 Phase에서 검증**:

- ⏭️ **Text의 실제 Preview DOM `<p>` 매핑** → **Phase 1 검증** (`rendererMap["Text"]` 제거 시 `resolveHtmlTag` fallback 경로가 `getElementForTag("Text")`를 호출하여 `<p>` 반환)
- ⏭️ **Paragraph의 실제 Preview DOM `<p>` 매핑** → **Phase 3 검증** (`Paragraph.spec.ts` 신설 + `TAG_SPEC_MAP` 등록 후)
- ⏭️ **Kbd/Code의 spec registry 기반 `<kbd>`/`<code>` 매핑** (lowercase 우연이 아닌) → **Phase 3 검증** (`Kbd.spec.ts`/`Code.spec.ts` 신설 후)

### 실패 시 대안

- spec registry import가 순환 의존성을 유발하는 경우: `packages/specs`에서 별도 경량 entry(`@composition/specs/runtime`)를 정의하여 순환 회피
- 복합 컴포넌트 매핑이 spec registry로 이전 가능한 경우: 별도 cleanup 작업으로 분리
- `getElementForTag`가 Heading 동적 해석을 지원하지 못하면: Heading은 Preview App에 하드코딩 유지 (Phase 2에서 spec 레벨로 이동)

---

## Pre-Phase 1 — CSS Generator Stabilization

### 목적

`generated/Text.css`의 `undefined` 값 stale 상태 근본 원인 분석 및 수정. Phase 1/2에서 `skipCSSGeneration: true`를 제거할 때 깨끗한 CSS가 생성되도록 선제 수정.

### 가설

CSSGenerator가 `Text.spec.ts`의 `height: 0`, `paddingX: 0`, `paddingY: 0` 같은 **정상 초기값(0)**을 falsy로 오판하여 undefined 출력. CSS에서 0은 정상값이지만 truthy check가 이를 스킵하여 `undefined`가 생성되는 구조.

**의심 패턴**:

```typescript
// Bad (가설)
if (size.height) css.height = `${size.height}px`; // 0 → falsy → skip → undefined

// Good
if (size.height != null) css.height = `${size.height}px`; // 0 → 정상 처리
```

### 작업 순서

1. **원인 특정** — `Text.spec.ts` 사본에 `skipCSSGeneration: false` 임시 설정 → `pnpm build:specs` 실행 → `generated/Text.css` 내용 확인 → undefined 발생 지점 식별
2. **CSSGenerator truthy check 검사** — CSS 생성 로직에서 `if (value)` → `if (value != null)` 치환 필요 지점 전수 조사
3. **수정 적용** — 식별된 모든 truthy check 치환
4. **재검증** — `skipCSSGeneration: false`에서 `generated/Text.css` undefined 0건 확인
5. **복원** — `Text.spec.ts`는 다시 `skipCSSGeneration: true`로 되돌림 (Phase 1에서 정식 제거)

### 검증 체크리스트

- [ ] `generated/Text.css`에 `undefined` 문자열 0건
- [ ] 기존 spec의 CSS 생성물(Button/Badge/Label/Description/InlineAlert 등)과 diff 0건
- [ ] CSSGenerator 단위 테스트 통과
- [ ] `pnpm type-check` 통과

### 실패 시 대안

- 가설이 틀린 경우: 실제 undefined 원인을 별도 분석 후 수정 범위 재정의
- 원인이 CSSGenerator가 아닌 spec 해석 로직에 있는 경우: `packages/specs` 빌드 파이프라인 조사

---

## Phase 1 — Text 마이그레이션 + 5-point patch 제거

### 목적

Text 컴포넌트를 spec 경로로 전환하여 `f140f173`의 5-point patch를 근본 제거. `LayoutRenderers.renderText`를 폐기하고 auto-generated CSS로 대체. Text는 `element: "p"` 정적 + sizes xs~3xl 완비로 **Pre-Phase 0/1 완료 후 전환 가능한 최단 경로**. 이것이 본 ADR의 시험대이자 5-point patch의 직접 해결 지점.

### 전제

- ADR-057 Phase A/B 완료 (specShapeConverter text shape feature parity 확보)
- Pre-Phase 0 완료 (Preview Resolver 일반화 — `Text` → `<p>` 매핑 동작)
- Pre-Phase 1 완료 (CSSGenerator 안정 — `skipCSSGeneration: false` 시 undefined 0건)

### 작업 순서

1. **`Text.spec.ts` `shapes()` 구현**
   - 현재 `shapes: () => []` → 실제 text shape 반환
   - ADR-057에서 이식된 13개 feature 활용
   - size preset (xs~3xl) 매핑 (이미 sizes에 정의됨)
2. **`skipCSSGeneration: true` 제거**
   - `generated/Text.css` 정상 생성 확인 (Pre-Phase 1 수정의 실전 검증 시점)
3. **`LayoutRenderers.renderText` 제거**
   - `packages/shared/src/renderers/LayoutRenderers.tsx:671` 함수 삭제
   - `packages/shared/src/renderers/index.ts`의 Text 바인딩 제거
   - Preview가 Pre-Phase 0의 `getElementForTag` → `<p>` 매핑으로 자동 처리
4. **5-point patch 코드 제거** — 아래 5곳의 `tag === "text"` 분기 삭제
   - `apps/builder/src/builder/workspace/canvas/skia/buildTextNodeData.ts` (Text 관련 분기)
   - `apps/builder/src/builder/workspace/canvas/layout/engines/utils.ts` `calculateContentWidth` (이전 line 1277 근처)
   - `apps/builder/src/builder/workspace/canvas/layout/engines/utils.ts` `calculateContentHeight` (이전 line 2507 근처)
   - `apps/builder/src/builder/workspace/canvas/layout/engines/utils.ts` `enrichWithIntrinsicSize` (이전 line 2929 근처)
   - `LayoutRenderers.renderText` (Phase 1 step 3에서 제거됨)
5. **`getTextPresetFontSize` 분산 호출 소멸 확인**
   - grep으로 `getTextPresetFontSize` 호출처 확인
   - spec source (`Text.spec.ts`의 sizes)가 SSOT가 되었는지 점검
6. **`TEXT_TAGS`에서 `Text` 제거** + `TAG_SPEC_MAP` 등록 또는 `SPEC_PREFERRED_TEXT_TAGS` 이동
7. **인라인 편집 (ADR-027) 동작 재검증** — `data-size` / `data-element-id` 주입 경로가 spec shape 경로로 이동했으므로 TextEditOverlay Gate 필수

### 검증 체크리스트

- [ ] Text size 변경이 CSS/Skia 모두 반영 (5-point patch 없이)
- [ ] 5-point patch 코드 grep 0건 — `tag === "text"` 분기 소멸
- [ ] `LayoutRenderers.renderText` grep 0건
- [ ] `rendererMap["Text"]` 바인딩 제거 확인 (`packages/shared/src/renderers/index.ts`)
- [ ] **Text 렌더링 경로가 `resolveHtmlTag` → `getElementForTag("Text")` → `"p"`로 전환됨** (Pre-Phase 0의 resolver가 실전 검증되는 시점)
- [ ] Preview DOM에서 `<p>` 태그 유지, `outerHTML` diff 0건 (Pre-Phase 0 대비 rendererMap 경로와 fallback 경로 출력 동일)
- [ ] TextEditOverlay의 Text 편집 정상 — Quill 오버레이 위치 ≤0.5px
- [ ] `document.querySelector('[data-element-id="${textId}"]')` outerHTML이 Phase 전후 동일 구조
- [ ] StylesPanel의 Typography 섹션 편집이 Text에 정상 반영 (Button과 동일 경로)
- [ ] 2-pass reflow 무회귀 (긴 텍스트 wrap)

### 구현 단계 잔여 리스크 (Codex 4차 검증 2026-04-10)

문서 수준의 설계 이슈는 해소되었으나, **구현 시점에 반드시 live Preview로 검증**해야 할 지점이 1개 있다:

> **🔴 Critical 구현 검증**: `rendererMap["Text"]` 제거 후 Preview가 **실제로** `getElementForTag("Text")` 경로로 `<p>`를 만드는지 — 단순 grep/outerHTML 비교를 넘어 **live Preview에서 Text element를 삽입하고 DOM tag를 실측 확인**해야 한다.

검증 절차:

1. `rendererMap["Text"]` 바인딩 제거 (`packages/shared/src/renderers/index.ts`)
2. Preview iframe에서 새 Text element 추가 (Builder UI로)
3. Chrome DevTools Inspector에서 `document.querySelector('[data-element-id="<newTextId>"]')` 실행
4. `.tagName` === `"P"` 확인 (lowercase `"text"`로 떨어지면 Pre-Phase 0 resolver 구현 오류)
5. `.outerHTML` 구조가 기존 `renderText` 출력(`<p data-element-id="..." data-size="md" style="...">...</p>`)과 동등한지 확인
6. console 에러 0건 — React가 `<text>` 같은 알 수 없는 태그에 대해 경고하지 않는지

이 검증이 실패하면 **Phase 1 전체 롤백** + Pre-Phase 0의 `App.tsx` `resolveHtmlTag` 재작성 로직 재점검 필요.

### 실패 시 대안

- Pre-Phase 0의 resolver가 Text 매핑 실패: `LayoutRenderers.renderText` 임시 복원 + Pre-Phase 0 재점검
- 5-point patch 일부 복원 (가장 파괴적 분기부터 복원)
- Phase 1 전체 롤백 → Pre-Phase 0/1만 유지
- Phase 1.5 삽입하여 `LayoutRenderers.renderText`를 점진 제거

---

## Phase 2 — Heading 마이그레이션 + 인프라 확장

### 목적

Heading 컴포넌트를 spec 경로로 전환. Heading은 **선행 인프라 확장**이 필요한 복잡 대상:

- `Heading.spec.ts`는 현재 `sizes: { md }` 하나만 정의 → xs~3xl 6개 확장 필요
- `spec.element: "h3"` 정적 하드코딩 → level prop 동적 해석 경로 결정 필요
- 현재 Preview는 `resolveHtmlTag`에서 level prop으로 h1~h6 생성 → spec 레벨로 이동 여부 결정

### 전제

- Phase 1 Gate 통과 (Text 전환 검증 완료)
- Pre-Phase 0의 Preview Resolver 일반화 완료

### Step A — Heading 인프라 확장 (Phase 2 착수 전 선행)

1. **`Heading.spec.ts` sizes 확장**
   - 현재 `sizes: { md: {...} }` → xs/sm/md/lg/xl/2xl/3xl 7개 정의
   - 각 size의 `fontSize`, `lineHeight`를 typography 토큰으로 매핑
   - 패턴: Text.spec.ts의 sizes를 참조
2. **`ComponentSpec.element` 함수형 확장 — 근본 해법 확정**
   - `spec.types.ts`의 `ComponentSpec.element` 타입을 `keyof HTMLElementTagNameMap | "fragment" | ((props: Record<string, unknown>) => string)`으로 확장
   - `Heading.spec.ts`에 `element: (props) => \`h${Math.min(Math.max(Number(props?.level) || 3, 1), 6)}\`` 정의
   - **이유**: spec SSOT 완전 준수 + 향후 동적 element 필요 컴포넌트(조건부 span/div, `as` prop 기반 분기 등) 확장성 확보
   - **Backward compatibility**: 기존 spec 파일들의 `element` 필드는 모두 정적 문자열이므로 타입 확장은 파괴적이지 않음. 정적 string 케이스는 기존 동작 그대로 유지
3. **`getElementForTag` 함수 케이스 분기 추가**
   - `packages/specs/src/runtime/tagToElement.ts`에서 `typeof spec.element === "function"` 분기로 `spec.element(props)` 호출
   - `App.tsx`의 Heading 특수 케이스(`resolveHtmlTag` switch L397~400) 제거 — spec registry가 자동 해석
4. **기존 spec 호환성 검증** — 모든 spec 파일의 `element` 필드 grep하여 정적 문자열 유지 확인 (Button/Badge/Label 등 22개+ spec)

### Step B — Heading spec 경로 전환 (Phase 1과 동일 절차)

5. **`Heading.spec.ts` `shapes()` 구현**
   - 확장된 sizes 활용
   - ADR-057 feature parity 활용
6. **`skipCSSGeneration: true` 제거**
7. **`TEXT_TAGS`에서 `Heading` 제거**
8. **`TAG_SPEC_MAP` 등록** (또는 `SPEC_PREFERRED_TEXT_TAGS` 이동)
9. **Preview Resolver 검증** — `getElementForTag("Heading", { level: N })`가 동적으로 `h${N}` 반환
10. **auto-generated CSS 검증** — `generated/Heading.css` 정상 생성, xs~3xl 전 사이즈 CSS variable 체인

### 검증 체크리스트

- [ ] `Heading.spec.ts` sizes xs/sm/md/lg/xl/2xl/3xl 7개 정의
- [ ] `ComponentSpec.element` 타입이 `string | ((props) => string)`로 확장됨 (`spec.types.ts`)
- [ ] `getElementForTag` 함수 케이스 분기 구현 (`tagToElement.ts`)
- [ ] `App.tsx`의 Heading 특수 케이스 제거 — spec registry 자동 해석
- [ ] Heading level 변경 시 Preview DOM이 `h${level}` 정확 (1~6)
- [ ] Heading size 변경 시 xs~3xl 전 사이즈 ≤1px (CSS/Skia 둘 다)
- [ ] `aria-level` 속성 정상 유지
- [ ] TextEditOverlay의 Heading 편집 정상 — Quill 오버레이 위치 ≤0.5px
- [ ] `outerHTML` diff 0건
- [ ] 기존 spec 파일들의 `element` 필드 호환성 무회귀

### 구현 단계 잔여 리스크 (Codex 4차 검증 2026-04-10)

문서 수준의 설계 이슈는 해소되었으나, **타입/빌드 파급 실측이 필수**인 지점이 1개 있다:

> **🔴 Critical 구현 검증**: `ComponentSpec.element` 타입을 `string | ((props) => string)`로 확장할 때, **22+ 기존 spec 파일의 타입/빌드 파급이 없는지** TypeScript 컴파일러와 빌드 파이프라인 양쪽에서 실측 확인해야 한다.

검증 절차:

1. **`spec.types.ts` 타입 확장**:
   ```typescript
   element: keyof HTMLElementTagNameMap | "fragment" | ((props: Record<string, unknown>) => string);
   ```
2. **TypeScript 전수 검증** — `pnpm type-check` 실행
   - 기존 22+ spec 파일(`Button.spec.ts`/`Badge.spec.ts`/`Label.spec.ts`/`Description.spec.ts`/`InlineAlert.spec.ts`/`TextField.spec.ts` 등 전체)의 `element: "..."` 정적 문자열 리터럴이 union 타입의 첫 번째 옵션에 자동 할당되는지 확인
   - Type narrowing 필요한 지점 grep — `spec.element === "..."` 같은 동등 비교 로직이 있으면 `typeof spec.element === "string" && ...`으로 변경 필요 가능성
3. **빌드 파이프라인 전수 검증** — `pnpm build:specs` + `pnpm build` 실행
   - `packages/specs` 빌드 산출물에서 spec 파일들의 타입 시그니처 변화 없음 확인
   - 번들 사이즈 변화 ±1KB 이내 (함수형 element는 tree-shaking 대상이 아닐 수 있음)
4. **런타임 전수 검증** — `getElementForTag` 분기 처리 실측:

   ```typescript
   // tagToElement.ts 실측 동작 확인
   if (typeof spec.element === "string") return spec.element;
   if (typeof spec.element === "function") return spec.element(props ?? {});
   ```

   - 기존 22+ spec이 여전히 string 분기로 fall through
   - Heading만 function 분기로 처리

5. **Heading level 엣지 케이스**:
   - `level: 0` → `h1` (clamp 1)
   - `level: 7` → `h6` (clamp 6)
   - `level: null`/`undefined` → `h3` (기본값)
   - `level: "3"` (문자열) → `h3` (Number 변환)
   - `level: 1.5` → `h1` (Math.floor 또는 rounding)

이 검증이 실패하면 **Phase 2 전체 롤백** → **옵션 (b) 임시 퇴각**: Preview Resolver에 Heading 특수 케이스 유지, `ComponentSpec.element`는 정적 string 타입 복원.

### 실패 시 대안

- 함수형 타입 확장이 기존 spec 파일 호환성을 예상치 못하게 깨면 Preview Resolver에 Heading 특수 케이스를 임시 유지 (임시 퇴각, 후속 별도 정리)
- `spec.element === "..."` 동등 비교 로직이 다수 발견되면 `typeof` 가드 추가 PR을 Phase 2 선행 작업으로 분리
- sizes 확장 시 typography 토큰 부족하면 ADR-056과 병행 진행
- level 해석 로직에서 회귀 발생 시 Phase 2 롤백, Phase 1만 유지

---

## Phase 3 — Paragraph/Kbd/Code spec 신설

### 목적

현재 spec 부재 상태인 3개 컴포넌트를 Spec-First 패턴으로 신설. Text/Heading에서 검증된 패턴을 복제 적용.

### 전제

- Phase 2 Gate 통과
- ADR-057 feature parity 활용 가능
- Pre-Phase 0의 `getElementForTag`가 신설 spec을 자동 인식

### 작업 순서

1. **`Paragraph.spec.ts` 신설**
   - semantic element: `<p>`
   - default size/variant 정의 (text-base, neutral color)
   - `shapes()`에서 text shape 반환 (Text.spec.ts 참조)
   - `skipCSSGeneration: false` (auto-generated CSS 활성)
2. **`Kbd.spec.ts` 신설**
   - semantic element: `<kbd>`
   - default: monospace font, 작은 size, border/padding으로 키 모양 시각화
   - inline 특화 속성 (`display: inline-block`, `whiteSpace: nowrap` 기본)
3. **`Code.spec.ts` 신설**
   - semantic element: `<code>`
   - default: monospace font, muted 배경, 인라인 코드 스타일
4. **export 등록**
   - `packages/specs/src/components/index.ts` — 3개 spec 바렐 export
   - `packages/specs/src/index.ts` — 3개 spec export
   - `pnpm build:specs` 실행
5. **`TAG_SPEC_MAP` 등록** — `tagSpecMap.ts`의 매핑 추가
6. **`TEXT_TAGS`에서 3개 제거**
7. **`TEXT_LEAF_TAGS` 추가 등록** — `utils.ts:2831`
   - **`kbd`, `code` lowercase 2개만 추가** (paragraph는 이미 등록됨 — 현재 `utils.ts:2831~2837`에 `paragraph` 포함 확인됨)
   - **근거**: CSS 기본 `white-space: normal` → wrap 가능 → 2-pass reflow 대상 (Kbd의 긴 키 조합, Code의 긴 코드 스니펫)
8. **Preview Resolver 자동 매핑 검증** — Pre-Phase 0의 `getElementForTag`가 신설 spec의 `element` 필드를 읽어 `<p>`/`<kbd>`/`<code>` 정확히 반환
9. **factory 라우팅 확인** — 필요 시 추가, 또는 spec 경로로 통합

### 검증 체크리스트

**spec registry 기반 매핑 유닛 검증** (Pre-Phase 0 resolver가 신설 spec을 자동 인식하는지):

- [ ] `getElementForTag("Paragraph", {})` === `"p"` (유닛 — 신설 `Paragraph.spec.ts`의 `element: "p"` 반환)
- [ ] `getElementForTag("Kbd", {})` === `"kbd"` (유닛 — `Kbd.spec.ts`의 `element: "kbd"` 반환)
- [ ] `getElementForTag("Code", {})` === `"code"` (유닛 — `Code.spec.ts`의 `element: "code"` 반환)
- [ ] `TAG_SPEC_MAP`에 3개 신설 spec 등록 확인 (grep)

**Preview DOM 실제 매핑 검증** (Pre-Phase 0 resolver가 실전 동작 확인):

- [ ] Paragraph 렌더링 시 Preview DOM이 `<p>` 태그 (**lowercase 우연이 아니라** `getElementForTag` 경유 spec registry 기반 매핑)
- [ ] Kbd 렌더링 시 Preview DOM이 `<kbd>` 태그 (spec registry 기반)
- [ ] Code 렌더링 시 Preview DOM이 `<code>` 태그 (spec registry 기반)

**렌더링/레이아웃 검증**:

- [ ] 3개 신설 spec의 default size/variant로 Preview 렌더링 정상
- [ ] Canvas Skia 렌더링 정상 (Paragraph는 Text와 유사, Kbd/Code는 monospace 확인)
- [ ] `TEXT_LEAF_TAGS`에 `kbd`, `code` lowercase 추가 확인 (paragraph는 기존 등록 유지)
- [ ] Kbd의 긴 키 조합(`Ctrl+Shift+Alt+F12`) wrap 동작 정상
- [ ] Code의 긴 코드 스니펫 wrap 동작 정상 (inline context에서)
- [ ] Paragraph의 긴 문단 wrap + line-height 정상
- [ ] dark mode 전환 시 Code 배경색 적절히 반영
- [ ] `pnpm build:specs` 성공

### 실패 시 대안

- 개별 spec 점진 보완 (Paragraph만 먼저, Kbd/Code는 후순)
- `getElementForTag` 매핑 실패 시 Pre-Phase 0 구현 재점검
- semantic element 매핑 오류 시 factory에 fallback 추가

---

## Phase 4 — `buildTextNodeData` 완전 폐지

### 목적

`buildTextNodeData` 파일과 관련 분기 코드를 전면 제거하여 spec SSOT를 완전히 복원.

### 전제

- Phase 1~3 모두 Gate 통과
- Text/Heading/Paragraph/Kbd/Code 모두 spec 경로로 전환 완료

### 작업 순서

1. **호출자 grep** — `buildTextNodeData` import/호출 전수 조사
2. **잔존 호출자 마이그레이션** — 발견 시 spec 경로로 전환
3. **`buildTextNodeData.ts` 파일 삭제**
4. **`TEXT_TAGS` 축소**
   - 남은 항목이 `Label`/`FieldError`/`InlineAlert` 등 `SPEC_PREFERRED_TEXT_TAGS` 항목뿐이면 `TEXT_TAGS` 자체 제거 + `SPEC_PREFERRED_TEXT_TAGS`로 대체
   - 또는 `TEXT_TAGS`를 유지하되 주석으로 축소된 범위 명시
5. **`StoreRenderBridge.ts` 분기 정리**
   - `SPEC_PREFERRED_TEXT_TAGS` 분기 로직 단순화
   - "나머지 TEXT_TAGS는 buildTextNodeData" 주석(line 47~49) 제거 또는 업데이트
6. **`getTextPresetFontSize` 헬퍼 제거 검토**
   - 호출자 0건이면 `@composition/specs`에서 export 제거
7. **import 정리** — 사용하지 않는 import 전수 제거

### 검증 체크리스트

- [ ] `buildTextNodeData` grep 0건 (파일, import, 호출 전부)
- [ ] `LayoutRenderers.renderText` grep 0건
- [ ] `getTextPresetFontSize` 잔존 호출 0건 (또는 Phase 4에서 제거 유예 시 사유 명시)
- [ ] 전체 text 컴포넌트(Text/Heading/Paragraph/Kbd/Code/Label/Description/InlineAlert/Button/Badge 등) 시각 회귀 ≤1px
- [ ] `TEXT_LEAF_TAGS`는 유지 확인 (layout 엔진 2-pass reflow에 load-bearing)
- [ ] `pnpm type-check` 통과
- [ ] `pnpm build:specs` 성공
- [ ] dev 실행 시 console error 0건

### 실패 시 대안

- 잔존 호출자 존재 시 재마이그레이션 (Phase 4 연기)
- `TEXT_TAGS` 분기 정리 시 회귀 발생: 분기 정리만 별도 Phase로 지연

---

## Phase 5 — DOM 축 SSOT 완성 (Post-Phase 4 Follow-up)

> **Status: Deferred (2026-04-11)** — 본 Phase는 cost/benefit 비대칭으로 현 시점 착수하지 않는다. ADR-058 §Phase 5 Deferral Rationale 참조. 실질 DOM 변경 0건 + Label 접근성 silent regression 신규 경로 도입 + CLAUDE.md "hypothetical future 설계 금지" 원칙 충돌. 작업 계획은 재개 조건 발생 시 참조용으로 아래에 보존한다.

### 목적

Phase 4까지 Skia/CSS 축은 spec 기반 SSOT가 달성되었으나, **Preview DOM 축**에서 4개 컴포넌트(Label/Description/FieldError/InlineAlert)가 여전히 `rendererMap`의 하드코딩 또는 React Aria 기본값에 의존하며 `spec.element`를 무시한다. 즉 "spec을 바꿔도 DOM은 안 바뀌는" 상태로, 이는 SSOT 정의 위반이다.

Phase 5는 `spec.element`를 rendererMap의 React Aria 컴포넌트에 `elementType` prop으로 주입하여, spec이 실제로 Preview DOM을 **결정**하도록 한다.

### 전제

- Phase 4 완료 (Canvas/Skia 축 SSOT)
- `ComponentSpec.element` 함수형 타입 지원 (Phase 2에서 도입)
- 대상 컴포넌트의 `spec.element`가 실제 렌더 DOM과 이미 일치 상태 (`cd65d597` Description/FieldError 수정)

### 범위

|  #  | 컴포넌트    | 현재 렌더 DOM | spec.element | 경로                                | 변경 내용                                                              |
| :-: | :---------- | :-----------: | :----------: | :---------------------------------- | :--------------------------------------------------------------------- |
|  1  | InlineAlert |    `<div>`    |   `"div"`    | `LayoutRenderers.renderInlineAlert` | 하드코딩 `<div>` → `React.createElement(InlineAlertSpec.element, ...)` |
|  2  | Description |   `<span>`    |   `"span"`   | `FormRenderers.renderDescription`   | `<Description>`에 `elementType={DescriptionSpec.element}` prop 주입    |
|  3  | FieldError  |   `<span>`    |   `"span"`   | `FormRenderers.renderFieldError`    | `<FieldError>`에 `elementType` prop 주입                               |
|  4  | Label       |   `<label>`   |  `"label"`   | `FormRenderers.renderLabel`         | `<Label>`에 `elementType` prop 주입 + **접근성 주석**                  |

실제 DOM 변경은 **0건**. 순수 데이터 흐름 배선 작업이며 `spec.element` 값을 바꾸지 않는 한 시각적 회귀 없음.

### 4축 Risk 평가

| 축                    |    등급    | 근거                                                                                                               |
| :-------------------- | :--------: | :----------------------------------------------------------------------------------------------------------------- |
| 기술 위험             |  **LOW**   | `elementType` prop은 React Aria 공식 수용. 변경 = prop 1개 추가                                                    |
| 성능 위험             |  **LOW**   | 런타임 비용 0                                                                                                      |
| 유지보수 위험         |  **LOW**   | SSOT 도입으로 이중 관리 해소 (실제 감소)                                                                           |
| 마이그레이션 위험     |  **LOW**   | 실질 DOM 변경 0건 — 현재 상태와 동일                                                                               |
| 접근성 위험 (Label만) | **MEDIUM** | 미래 누군가 `LabelSpec.element`를 `"label"` 외 값으로 바꾸면 HTML `<label for="">` 네이티브 연결 silent regression |

### 잠재적 함정

1. **React Aria `<Description>` 컴포넌트의 prop forwarding 실측 필요**
   - 내부가 `<Text slot="description" {...props}>`로 spread인지 사전 확인
   - react-aria-components 1.15.1 `Text.mjs` 소스상 `elementType` default는 `'span'`이며 props로 override 가능. `<Description>` 자체가 forward하는지는 실측 필수
   - 실측 방법: `<Description elementType="p">test</Description>` 삽입 → DOM에 `<p class="react-aria-Description">` 확인

2. **TypeScript 타입 좁히기**
   - `ComponentSpec.element`는 `keyof HTMLElementTagNameMap | "fragment" | ((props) => string)` (Phase 2)
   - React Aria `elementType`은 정적 string만 수용
   - 4개 대상은 모두 정적 string이지만 **`typeof` 가드 필수**:
     ```tsx
     const elType =
       typeof LabelSpec.element === "string" ? LabelSpec.element : "label";
     ```

3. **Label 접근성 사일런트 regression**
   - spec.element 타입이 느슨하여 컴파일 타임 방지 불가
   - 최소 방어: JSDoc `@accessibility` 주석 + eslint-disable 근거 주석
   - 추가 방어 (선택): `ComponentSpec`에 `elementLocked?: boolean` 또는 `accessibilityCritical?: boolean` 필드 도입 (별도 PR)

### 작업 순서

1. **InlineAlert 전환** (5분)
   - `LayoutRenderers.renderInlineAlert`의 `<div>` 리터럴 → `React.createElement(InlineAlertSpec.element, {...})`
   - typeof 가드 적용
2. **Description 전환** (15분)
   - `<Description>` prop forwarding 실측 (canary 테스트)
   - 실측 통과 시 `<Description elementType={...}>` 적용
3. **FieldError 전환** (15분)
   - validation context 구성 (`<TextField isInvalid>`)
   - `<FieldError elementType={...}>` 적용 + 실측
4. **Label 전환** (30분)
   - `LabelSpec.element` JSDoc 접근성 경고 주석 추가
   - `<Label elementType={...}>` 적용
   - 수동 form 연결 테스트 (label 클릭 → input focus 이동)
5. **Live 회귀 검증** (30분)
   - 9개 text 컴포넌트 전부 Preview + Canvas 무변화 확인
   - outerHTML diff 0건
   - 콘솔 에러 0건
6. **type-check + 커밋** (10분)

**총 예상**: 약 2시간

### Gates

| Gate                                    | 시점                | 통과 조건                                                                                          | 실패 시 대안                                                       |
| :-------------------------------------- | :------------------ | :------------------------------------------------------------------------------------------------- | :----------------------------------------------------------------- |
| `<Description>` prop forwarding 검증    | 작업 시작 전 canary | canary 테스트에서 `elementType` prop이 실제 DOM에 반영되는지 확인                                  | React Aria 호출부를 `<Text slot="description">` 직접 사용으로 우회 |
| InlineAlert/Description/FieldError 전환 | 각 커밋             | 전환 후 DOM 무변화, 콘솔 에러 0건                                                                  | 개별 rollback                                                      |
| Label 접근성 보존                       | Label 전환 완료     | `<label>` 태그 유지 확인, `for`/`id` 연결 정상, 클릭 시 input focus                                | Label 전환만 취소, 다른 3개는 유지                                 |
| 전체 회귀                               | Phase 5 완료        | 9/9 text 컴포넌트 무회귀, `pnpm type-check` 통과                                                   | 문제 컴포넌트만 rollback                                           |
| 접근성 장기 보호                        | Phase 5 완료 후     | `LabelSpec.element`에 접근성 경고 주석 존재, 또는 `ComponentSpec.elementLocked` 필드 제안 ADR 작성 | 문서화로만 대체                                                    |

### 검증 체크리스트

- [ ] `<Description elementType="p">test</Description>` canary가 `<p class="react-aria-Description">` 생성
- [ ] `InlineAlert` Preview DOM이 `spec.element` 기반 생성 (현재 `<div>` 유지)
- [ ] `Description` Preview DOM이 `spec.element` 기반 생성 (현재 `<span>` 유지)
- [ ] `FieldError` Preview DOM이 `spec.element` 기반 생성 (validation context에서 `<span>` 유지)
- [ ] `Label` Preview DOM이 `spec.element` 기반 생성 (`<label>` 유지)
- [ ] Label 클릭 → 연결된 input focus 이동 정상
- [ ] 9개 text 컴포넌트 `outerHTML` Phase 5 전후 diff 0건
- [ ] `LabelSpec.element` JSDoc 접근성 경고 주석 존재
- [ ] `pnpm type-check` 통과
- [ ] dev 실행 시 콘솔 에러 0건

### 실패 시 대안

- `<Description>`/`<FieldError>`가 `elementType` forwarding 미지원 시: 해당 컴포넌트만 rollback하고 `spec.element` 주석으로 "rendererMap 하드코딩 구간" 명시
- Label 접근성 검증 실패 시: Label만 기존 하드코딩 유지, 다른 3개는 전환 완료
- TypeScript 타입 충돌 발견 시: `typeof` 가드 대신 명시적 캐스트 + JSDoc 근거 주석

### Phase 5 이후 남은 SSOT 갭

Phase 5 완료 후에도 **G1 (Label CSS 축)** 이 잔존한다. `LabelSpec.skipCSSGeneration: true` 제거를 위해서는:

- `base.css`의 `--label-font-size` CSS 변수 상속 메커니즘 재설계
- 또는 Label spec sizes에 값을 직접 명시하고 compound 부모가 override
- 별도 ADR 또는 Phase 6으로 분리

---

## 호환성 유지

### `TEXT_LEAF_TAGS` (layout 엔진 별도 셋)

- 모든 Phase에서 **유지 + 확장**
- lowercase 태그 기반
- 현재 등록: `text`, `heading`, `description`, `label`, `paragraph` (`utils.ts:2831~2837` 실측)
- Phase 3에서 **추가**: `kbd`, `code` (paragraph는 이미 등록되어 있으므로 재추가 불필요)
- `TaffyFlexEngine` 2-pass reflow 동작에 load-bearing
- **주의**: `TEXT_TAGS`(Skia 라우팅)와 혼동 금지. 두 셋은 서로 다른 목적의 독립 집합

### `SPEC_PREFERRED_TEXT_TAGS`

- Phase 진행 중 **임시 홀딩 구역**으로 활용 가능
- Text를 `TEXT_TAGS`에서 제거한 직후 `TAG_SPEC_MAP` 등록 전 단계에 임시로 거쳐갈 수 있음
- Phase 4 완료 시 최종 범위 재평가

### Preview Element Resolver (Pre-Phase 0 + Phase 2 결과)

- `getElementForTag`가 spec registry 기반으로 동작
- 신설 spec이 자동 인식되므로 Phase 3의 Paragraph/Kbd/Code는 switch 수동 추가 불필요
- Heading은 Phase 2에서 `ComponentSpec.element` 함수형 타입 확장으로 spec.element가 `(props) => h${level}` 반환 → `getElementForTag`가 함수 케이스 분기로 자동 처리. `App.tsx`의 Heading 특수 케이스는 Phase 2 완료 시 제거됨

### Theme/dark mode

- CSS 변수 기반 자동 반영 (Button/Badge 기존 패턴과 동일)
- spec의 `{color.neutral}`, `{color.layer-2}` 등 토큰 체인이 light/dark 자동 전환
- Skia 측은 `themeVersion` + `setDarkMode` 경로로 동기화

### ADR-027 (Inline Text Editing)

- TextEditOverlay는 Preview iframe DOM의 `getBoundingClientRect()`로 오버레이 위치 계산
- Pre-Phase 0의 spec registry 기반 매핑이 DOM 구조 불변을 보장하면 Quill 바인딩 무영향
- Gate 실패 시 Phase 1.5 / Phase 2.5 삽입하여 재배선

---

## 파일 변경 인벤토리

### Pre-Phase 0

| 파일                                                | 변경 내용                                                                |
| --------------------------------------------------- | ------------------------------------------------------------------------ |
| `packages/specs/src/runtime/tagToElement.ts` (신설) | `getElementForTag(tag, props)` 구현                                      |
| `packages/specs/src/index.ts`                       | `getElementForTag` export                                                |
| `apps/builder/src/preview/App.tsx`                  | `resolveHtmlTag` 재작성 — spec registry 조회 + 복합 컴포넌트 잔여 케이스 |
| `apps/builder/package.json` (확인)                  | `@composition/specs` 의존성 이미 존재 여부 확인                          |

### Pre-Phase 1

| 파일                                                   | 변경 내용                         |
| ------------------------------------------------------ | --------------------------------- |
| `packages/specs/src/generators/CSSGenerator.ts` (추정) | truthy check → `!= null` 치환     |
| `packages/specs/src/components/Text.spec.ts` (임시)    | `skipCSSGeneration` 토글 → 재복원 |

### Phase 1 — Text

| 파일                                                                  | 변경 내용                                        |
| --------------------------------------------------------------------- | ------------------------------------------------ |
| `packages/specs/src/components/Text.spec.ts`                          | `shapes()` 구현, `skipCSSGeneration` 제거        |
| `apps/builder/src/builder/workspace/canvas/sprites/tagSpecMap.ts`     | `TEXT_TAGS`에서 `Text` 제거                      |
| `packages/shared/src/renderers/LayoutRenderers.tsx`                   | `renderText` 제거                                |
| `packages/shared/src/renderers/index.ts`                              | Text 바인딩 제거                                 |
| `apps/builder/src/builder/workspace/canvas/layout/engines/utils.ts`   | 5-point patch의 3개 분기 제거 (`tag === "text"`) |
| `apps/builder/src/builder/workspace/canvas/skia/buildTextNodeData.ts` | Text 관련 분기 제거 (Phase 4 전까지 잔존)        |

### Phase 2 — Heading

| 파일                                                              | 변경 내용                                                                                                 |
| ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `packages/specs/src/types/spec.types.ts`                          | `ComponentSpec.element` 타입 확장: `keyof HTMLElementTagNameMap \| "fragment" \| ((props) => string)`     |
| `packages/specs/src/runtime/tagToElement.ts`                      | 함수형 element 케이스 분기 추가 (`typeof spec.element === "function"` → `spec.element(props)`)            |
| `packages/specs/src/components/Heading.spec.ts`                   | sizes xs~3xl 확장 (+6), `element: (props) => h${level}` 함수형, `shapes()` 구현, `skipCSSGeneration` 제거 |
| `apps/builder/src/preview/App.tsx`                                | Heading 특수 케이스(`resolveHtmlTag:397~400`) 제거 — spec registry 자동 해석                              |
| `apps/builder/src/builder/workspace/canvas/sprites/tagSpecMap.ts` | `TEXT_TAGS`에서 `Heading` 제거                                                                            |

### Phase 3 — Paragraph/Kbd/Code

| 파일                                                                | 변경 내용                                                         |
| ------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `packages/specs/src/components/Paragraph.spec.ts` (신설)            | 신규 spec 파일                                                    |
| `packages/specs/src/components/Kbd.spec.ts` (신설)                  | 신규 spec 파일                                                    |
| `packages/specs/src/components/Code.spec.ts` (신설)                 | 신규 spec 파일                                                    |
| `packages/specs/src/components/index.ts`                            | 3개 export                                                        |
| `packages/specs/src/index.ts`                                       | 3개 export                                                        |
| `apps/builder/src/builder/workspace/canvas/sprites/tagSpecMap.ts`   | `TEXT_TAGS`에서 3개 제거, `TAG_SPEC_MAP` 등록                     |
| `apps/builder/src/builder/workspace/canvas/layout/engines/utils.ts` | `TEXT_LEAF_TAGS`에 `kbd`, `code` 2개 추가 (paragraph는 이미 등록) |

### Phase 4

| 파일                                                                  | 변경 내용                         |
| --------------------------------------------------------------------- | --------------------------------- |
| `apps/builder/src/builder/workspace/canvas/skia/buildTextNodeData.ts` | **파일 삭제**                     |
| `apps/builder/src/builder/workspace/canvas/sprites/tagSpecMap.ts`     | `TEXT_TAGS` 축소 또는 제거        |
| `apps/builder/src/builder/workspace/canvas/skia/StoreRenderBridge.ts` | 분기 로직 단순화                  |
| `packages/specs/src/` (조건부)                                        | `getTextPresetFontSize` 제거 검토 |
| 기타 import 정리                                                      | 미사용 import 전수 제거           |

---

## 검증 프로토콜

### 공통 측정 환경

- DPR: 1.0 / 2.0 / 3.0
- 해상도: 1440×900 (builder 표준)
- 폰트 로딩: `document.fonts.ready` 완료 후
- 테마: light / dark 양쪽
- 측정 시점: Phase 각 완료 직후 + 다음 Phase 진입 전

### ≤1px 정합성 측정 (Phase 1/2/3/4 공통)

- **기준**: spec 토큰 source (`typography.text-*`)
- **비교 대상**: Preview iframe CSS 렌더링 ↔ Canvas Skia 렌더링 (두 consumer 대칭 검증)
- **측정 방법**:
  - Width: `getBoundingClientRect().width` vs `paragraph.getLongestLine()`
  - Height: `getBoundingClientRect().height` vs `paragraph.getHeight()`
  - Line count: `Range.getClientRects().length` vs `paragraph.getLineMetrics().length`
- **통과 조건**: 모든 샘플 |diff| ≤ 1.0px, 95% 샘플 |diff| ≤ 0.5px, line count 불일치 0건

### A11y 불변조건 검증

- **ground truth**: `spec.element` + `spec.properties` (Pre-Phase 0 이후 spec이 SSOT)
- **검증 대상**: Preview DOM
- **측정**:
  - `spec.element` (정적) 또는 `spec.element(props)` (동적 — Heading) = Preview DOM `tagName`
  - ARIA role, `aria-label`, `aria-level` 속성 Phase 전후 동일
  - `textContent` (screen reader text) 동일
  - Tab order 변화 없음

### Preview Element Resolver 검증 (단계별)

Preview의 `rendererMap`이 spec registry보다 우선 경로이므로, 각 Phase에서 검증 가능한 범위가 다르다. 아래와 같이 Phase별로 분리한다.

**Pre-Phase 0 — 유닛 동작 + 기존 경로 무회귀**:

- `getElementForTag("Text", {})` === `"p"` (유닛 — 실제 Preview DOM은 `rendererMap["Text"]` 우선으로 검증 불가)
- `getElementForTag("Description", {})` === `"p"` (유닛)
- `getElementForTag("Button", {})` === `ButtonSpec.element` (유닛)
- `getElementForTag("Heading", {})` === `"h3"` (유닛 — Pre-Phase 0 시점 정적 기본값)
- `getElementForTag("UnknownTag", {})` === `"unknowntag"` (lowercase fallback)
- `App.tsx resolveHtmlTag`가 `getElementForTag`를 호출하는지 코드 diff 확인
- **기존 `rendererMap` 경로 Preview DOM 무회귀** — Text/Heading/Button/Description/InlineAlert 등 전부 이전과 동일
- 기존 `resolveHtmlTag` switch 잔여 케이스 (DialogFooter/Toast/Popover 등) Preview DOM 무회귀

**Phase 1 — Text 경로 전환 실전 검증**:

- `rendererMap["Text"]` 바인딩 제거 후 Text 렌더링 시 Preview DOM이 `<p>` 태그
- `getElementForTag("Text", {})` 호출 경로가 실제로 활성화됨 (console log 또는 breakpoint 검증 가능)
- Phase 1 전후 Text `outerHTML` diff 0건 (rendererMap → resolver 경로 전환이 DOM 구조 불변)

**Phase 2 — Heading 함수형 해석 실전 검증**:

- `ComponentSpec.element` 타입 확장 후 `getElementForTag` 함수 케이스 활성화:
  - `getElementForTag("Heading", { level: 1 })` === `"h1"`
  - `getElementForTag("Heading", { level: 3 })` === `"h3"`
  - `getElementForTag("Heading", { level: 6 })` === `"h6"`
  - `getElementForTag("Heading", {})` === `"h3"` (level 미지정 시 기본값)
  - `getElementForTag("Heading", { level: 99 })` === `"h6"` (clamp 검증)
- `App.tsx`의 Heading 특수 케이스(`resolveHtmlTag:397~400`) 제거 후 spec registry 단일 경로 동작
- Phase 2 전후 Heading Preview DOM `outerHTML` diff 0건

**Phase 3 — 신설 spec registry 자동 등록 실전 검증**:

- `getElementForTag("Paragraph", {})` === `"p"` (신설 spec 반영)
- `getElementForTag("Kbd", {})` === `"kbd"` (신설 spec 반영, lowercase 우연이 아닌)
- `getElementForTag("Code", {})` === `"code"` (동일)
- 3개 컴포넌트 Preview DOM 실제 매핑 정상 (`rendererMap` 미등록 → resolver fallback → spec registry)
- 기존 복합 컴포넌트(DialogFooter/Toast/Popover 등) 매핑 무회귀

### TextEditOverlay (ADR-027) 호환 검증

- Text 편집 시 Quill 오버레이 위치 ≤ 0.5px
- Heading 편집 시 Quill 오버레이 위치 ≤ 0.5px
- 편집 모드 진입/종료 시 DOM 구조 변화 없음 (`outerHTML` diff 0건)
- 실패 시 Phase 1.5 / Phase 2.5 삽입하여 재배선

### 회귀 진단 분류 (ADR-057/058 원칙 기반)

| 증상                          | 1차 조사 지점           | 가능한 원인                                         |
| ----------------------------- | ----------------------- | --------------------------------------------------- |
| Preview만 틀림                | CSS consumer 경로       | CSSGenerator, `@layer components` cascade, variable |
| Skia만 틀림                   | Skia consumer 경로      | `specShapeConverter`, `nodeRendererText`            |
| Preview + Skia 동일 방향 오류 | Spec source             | 토큰 값 / `spec.sizes` / `spec.variants` 정의       |
| Preview + Skia 상이 방향 오류 | 양쪽 consumer 독립 오역 | spec 인터페이스 모호성                              |

"Skia가 CSS를 따라가야 한다"는 framing은 금지. 항상 spec source를 1차 조사 지점으로 삼는다.
