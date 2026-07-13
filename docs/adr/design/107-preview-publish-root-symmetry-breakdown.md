# ADR-107 구현 상세 — Preview `:root` + body 대칭 복구 via shared-tokens

> ADR: [107-preview-publish-root-symmetry.md](../completed/107-preview-publish-root-symmetry.md)
>
> 개정 2026-04-22 (1차): Codex 리뷰 반영 — Phase 0 삭제 + Phase 2 에 Preview body 하드코딩 제거 추가 + G2 기준값 일반화.
> 개정 2026-04-22 (2차): Codex 3차 리뷰 반영 — Builder cascade override 사실 서술 정직화 (1st family 동일이나 fallback chain 교체 발생) + Phase 5 Builder 탭 검증 G6 신설 + R6 mitigation 추가.
> 개정 2026-04-22 (3차): Codex 4차 리뷰 반영 — G4 "override 없음" → "최종 computed fontFamily = DEFAULT 체인과 일치" 로 재작성 (generated CSS `Button.css:19 font-family: var(--font-sans)` 등 명시 선언 존재하나 Preview/Publish 에서 `--font-sans` unresolved 로 상속 활성) + SSOT "1곳"→"2곳(CSS+TS)" 문구 일치.

## 사전 확증 (Builder cascade 관계)

기존 "Builder UI 회귀 선제 검증" Phase 0 은 **삭제**. 새 사실관계:

- Builder `:root` font-family 는 `App.css:6` `--font-inter: "Pretendard"` + `App.css:392` `--default-font-family: var(--font-inter), system-ui` + `App.css:400-445` `@layer base { html, :root { font-family: var(--default-font-family, ...) } }` 체인으로 현재 `Pretendard, system-ui` 2-family 해석
- **Cascade layer 순서** (`apps/builder/src/index.css:14`): `@layer dashboard, base, preview-system, components, shared-tokens, builder-system, utilities` — `base < shared-tokens` 이므로 본 ADR 의 shared-tokens `:root` 변경이 `App.css @layer base` 를 **override** 한다
- Builder shared-tokens import 경로: `apps/builder/src/index.css:25 @import "../../../packages/shared/src/components/theme.css"` → `theme.css:26 @import "./styles/theme/shared-tokens.css"` → **Builder 도 shared-tokens 연쇄**
- 따라서 Builder `:root` computed fontFamily 는 본 ADR 변경 후 `DEFAULT_BASE_TYPOGRAPHY` 체인 (8-family) 으로 교체된다. **1st family = Pretendard 동일** + macOS `system-ui` / `-apple-system` 이 동일한 San Francisco 로 resolve → Pretendard `@font-face` 로드 정상 시 visible 차이 0 예상
- Builder Skia D3 consumer 는 `cssResolver.ts:294 getRootComputedStyle()` 가 `themeConfigStore.baseTypography ?? DEFAULT_BASE_TYPOGRAPHY` 를 직접 읽으므로 `App.css :root` cascade 와 무관 → ADR-056 Phase 2 연결로 독립 경로

**결론**: 본 ADR 은 Builder cascade 에 영향 있다 (불개입 아님). 그러나 1st family 동일성으로 visible risk LOW. G6 Gate 로 Builder `:root` 1st family 불변 확증.

## Phase 1: `shared-tokens.css :root` 확장

**파일**: `packages/shared/src/components/styles/theme/shared-tokens.css`

`:root` 블록 (line 7~) 의 기존 변수 정의 앞에 base typography 추가:

```css
@layer shared-tokens {
  :root {
    /* Base Typography — ADR-107 D3 symmetric consumer 대칭 복구
     * `DEFAULT_BASE_TYPOGRAPHY` (apps/builder/src/builder/fonts/customFonts.ts:307) 와 동일 체인
     * 값 변경 시 TS 상수도 함께 수정 필수 (R4 drift 방지) */
    font-family:
      Pretendard,
      -apple-system,
      BlinkMacSystemFont,
      system-ui,
      Roboto,
      "Helvetica Neue",
      "Segoe UI",
      sans-serif;
    line-height: 1.5;

    /* Typography Scale - Tailwind v4 표준 (고정값, AI 생성 불필요) */
    --icon-size: calc(var(--spacing-xl) * 1.125);
    /* Font Sizes */
    --text-2xs: 0.625rem;
    ...
  }
}
```

`font-size` 는 shared-tokens 제외 — Builder `App.css:441` "font-size: 16px (browser default) - DO NOT set to --text-sm or rem values will be incorrect" 원칙 준수 (Builder 는 본 변경에 간접 노출).

## Phase 2: Preview `injectBaseStyles` 개편 + body 하드코딩 제거

### 파일 1: `apps/builder/src/preview/index.tsx:28-69`

**Before**:

```typescript
const injectBaseStyles = () => {
  if (document.getElementById("canvas-base-styles")) return;
  const style = document.createElement("style");
  style.id = "canvas-base-styles";
  style.textContent = `
    /* ── CSS Reset ── */
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; width: 100%; height: 100%; }
    p { margin: 0; }
    h1, h2, h3, h4, h5, h6 { margin: 0; padding: 0; }
    button, input, select, textarea { font-family: inherit; font-feature-settings: inherit; }

    /* ── Body 기본 스타일 (React 루트이자 body element) ── */
    body {
      font-family: "Pretendard", "Inter Variable", monospace, system-ui, sans-serif;
      font-feature-settings: "cv02", "cv03", "cv04", "cv11";
      line-height: 1.5;
      color: var(--fg, #1a1a1a);
      background: var(--bg, #ffffff);
    }
    ...
  `;
};
```

**After**:

```typescript
const injectBaseStyles = () => {
  if (document.getElementById("canvas-base-styles")) return;
  const style = document.createElement("style");
  style.id = "canvas-base-styles";
  style.textContent = `
    /* ── CSS Reset ── */
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; width: 100%; height: 100%; }
    p { margin: 0; }
    h1, h2, h3, h4, h5, h6 { margin: 0; padding: 0; }
    button, input, select, textarea { font-family: inherit; font-feature-settings: inherit; }

    /* ── :root (ADR-107 — font-family/line-height 는 shared-tokens 상속, font-size 만 명시) ── */
    :root {
      font-size: 16px;
    }

    /* ── Body (ADR-107 — font-family/line-height 제거 → :root 상속) ── */
    body {
      font-feature-settings: "cv02", "cv03", "cv04", "cv11";
      color: var(--fg, #1a1a1a);
      background: var(--bg, #ffffff);
    }
    ...
  `;
};
```

**변경 요점**:

- `:root { font-size: 16px }` 추가 — shared-tokens 가 font-size 는 미공급하므로 Preview 에서 명시
- body 의 `font-family` / `line-height` **삭제** → shared-tokens `:root` 체인 상속
- body `font-feature-settings` / `color` / `background` **유지** (Pretendard cv 변형 보존, R5 대응)

### 파일 2: `apps/builder/src/preview/messaging/messageHandler.ts:420-430`

**Before**:

```typescript
private handleThemeBaseTypography(data: ThemeBaseTypographyMessage): void {
  const { fontFamily, fontSize, lineHeight } = data.payload;
  document.body.style.fontFamily = fontFamily;
  document.body.style.fontSize = `${fontSize}px`;
  document.body.style.lineHeight = String(lineHeight);
}
```

**After**:

```typescript
/**
 * ADR-056 Phase 3 + ADR-107: Base Typography 를 :root + body 동시 적용.
 * - :root level: D3 symmetric consumer 대칭 (ADR-107)
 * - body level: ADR-056 Phase 3 경로 보존 (런타임 동적 변경)
 */
private handleThemeBaseTypography(data: ThemeBaseTypographyMessage): void {
  const { fontFamily, fontSize, lineHeight } = data.payload;

  // :root (ADR-107)
  document.documentElement.style.fontFamily = fontFamily;
  document.documentElement.style.fontSize = `${fontSize}px`;
  document.documentElement.style.lineHeight = String(lineHeight);

  // body (ADR-056)
  document.body.style.fontFamily = fontFamily;
  document.body.style.fontSize = `${fontSize}px`;
  document.body.style.lineHeight = String(lineHeight);
}
```

## Phase 3: Publish `index.css :root` 중복 보존 (명시적 no-op)

`apps/publish/src/styles/index.css:72-87 :root` 의 font-family / font-size / line-height 는 변경하지 않음.

- unlayered CSS 는 layered CSS 보다 specificity 우선 → Publish 독립 cascade 유지
- shared-tokens 값과 동일 → BC 0
- 제거 여부는 Gate 통과 후 별도 Addendum / 후속 ADR 에서 결정

## Phase 4: 기준선 재검증 (G1 Gate)

```bash
pnpm -w type-check                              # 3/3 FULL TURBO 기대
cd packages/specs && pnpm exec vitest run       # 205/205 (세션 17 기준)
cd apps/builder && pnpm test -- --run           # 247/247 (세션 17 기준)
cd packages/shared && pnpm test -- --run        # 52/52 (세션 17 기준)
```

합격 조건: 명령 실행 후 회귀 0 (실패 테스트 수 불변 또는 감소). 숫자는 HEAD 에 따라 변동 가능 — 비교 기준은 **Phase 1 착수 직전 실측값**.

## Phase 5: Chrome MCP 3 레벨 × 3 탭 검증

`feedback-chrome-mcp-patterns.md` §1-10 재사용. 측정 레벨을 `documentElement` + `body` + 내부 텍스트 노드 3 단계로 확장.

### Preview iframe (G2 / G3 / G4)

```javascript
// Preview 토글 버튼 클릭 → iframe mount
const previewBtn = [...document.querySelectorAll("button[aria-label]")].find(
  (b) => b.getAttribute("aria-label") === "Preview",
);
previewBtn.click();
await new Promise((r) => setTimeout(r, 1500));

const iframe = document.querySelector("iframe");
const doc = iframe.contentDocument;
const win = iframe.contentWindow;

// G2: :root
const rootCS = win.getComputedStyle(doc.documentElement);
// 기대:
// - fontFamily 첫 family = "Pretendard"
// - 체인 순서 = DEFAULT_BASE_TYPOGRAPHY 와 동일
// - fontSize = "16px"
// - lineHeight = "24px"

// G3: body (상속 확인)
const bodyCS = win.getComputedStyle(doc.body);
// 기대:
// - fontFamily = rootCS.fontFamily (inherit)
// - lineHeight = rootCS.lineHeight (inherit)
// - fontFeatureSettings = '"cv02", "cv03", "cv04", "cv11"'

// G4: 내부 임의 컴포넌트 텍스트 노드 — 최종 computed 일치 확인
// (주의: generated CSS 는 `font-family: var(--font-sans)` 등 명시 선언 존재.
//  Preview/Publish 에선 `--font-sans` 미정의 [App.css:9 Builder 전용] →
//  CSS `var()` unresolved → declaration 무효 → 부모 상속 활성)
const textNode =
  doc.querySelector(".react-aria-Button") ||
  doc.querySelector("[data-element-id]");
const textCS = textNode ? win.getComputedStyle(textNode) : null;
// 기대: textCS.fontFamily === DEFAULT 체인 (`--font-sans` 미정의로 상속 경유)
// Publish 동일 위치 computed 와 비교 → 일치 확인
```

### Publish 탭 (G5)

```javascript
// Publish 탭 (자동 spawn) 로 전환 후
const rootCS = getComputedStyle(document.documentElement);
// 기대: ADR-056 Addendum 세션 16 baseline 과 동일 (BC 0 확증)
//   fontFamily = "Pretendard, -apple-system, \"system-ui\", system-ui, Roboto, ..."
//   fontSize = "16px"
//   lineHeight = "24px"
```

### Builder 탭 (G6 — 1st family 불변 + visible 회귀 없음)

```javascript
// Builder 탭 전환 후
const rootCS = getComputedStyle(document.documentElement);

// G6 조건 1: 1st family 불변
const firstFamily = rootCS.fontFamily.split(",")[0].trim().replace(/["']/g, "");
// 기대: firstFamily === "Pretendard"

// G6 조건 2: fallback chain 교체 수용 (cascade 의도)
// 변경 전 기대: "Pretendard, system-ui" (App.css @layer base)
// 변경 후 기대: "Pretendard, -apple-system, BlinkMacSystemFont, system-ui, Roboto, \"Helvetica Neue\", \"Segoe UI\", sans-serif"
//   (shared-tokens @layer shared-tokens 승리)
// 양쪽 모두 1st family = Pretendard 이며 macOS 2nd family 가 SF 로 동등 resolve

// G6 조건 3: 주요 Builder 패널 screenshot 시각 회귀 없음
// - Header / LayerTree / Inspector / Workspace 4개 패널 screenshot
// - 변경 전/후 diff 에서 텍스트 렌더 차이 없음 확인
```

**G6 실패 시**: Builder 전용 override 추가 (`apps/builder/src/index.css` 에 `@layer builder-system { :root { font-family: var(--default-font-family, ui-sans-serif, ...) } }` 또는 unlayered `:root { font-family: ... }` 로 Builder 원래 체인 복귀). R6 fallback.

## 파일 변경표

| 파일                                                            | 변경                                                                                          | LOC     |
| --------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | ------- |
| `packages/shared/src/components/styles/theme/shared-tokens.css` | `:root` font-family + line-height 추가                                                        | +13     |
| `apps/builder/src/preview/index.tsx`                            | `injectBaseStyles()` `:root { font-size: 16px }` 추가 + body `font-family`/`line-height` 제거 | +4 / -2 |
| `apps/builder/src/preview/messaging/messageHandler.ts`          | `handleThemeBaseTypography` documentElement.style 주입 추가                                   | +4      |
| `docs/adr/107-preview-publish-root-symmetry.md`                 | 신규 ADR (개정판)                                                                             | ~180    |
| `docs/adr/design/107-preview-publish-root-symmetry-breakdown.md`    | 신규 breakdown (개정판)                                                                       | ~230    |
| `docs/adr/README.md`                                            | Proposed 항목 추가, 미구현 9→10, 합계 108→109 (이미 적용됨)                                   | +1, ±2  |

## 체크리스트

- [ ] Phase 1: `shared-tokens.css :root` 에 `DEFAULT_BASE_TYPOGRAPHY` 와 동일 font-family + line-height 추가
- [ ] Phase 2.1: Preview `injectBaseStyles()` 에 `:root { font-size: 16px }` 추가
- [ ] Phase 2.2: Preview `injectBaseStyles()` body 의 `font-family` / `line-height` 제거 — `font-feature-settings` / `color` / `background` **유지** (R5 — 실수 금지)
- [ ] Phase 2.3: `handleThemeBaseTypography` 에 `document.documentElement.style.fontFamily/fontSize/lineHeight` 주입 추가 (body 경로는 기존 유지)
- [ ] `DEFAULT_BASE_TYPOGRAPHY` TS 상수 값 변동 없음 확인 (R4 drift 체크 — shared-tokens CSS 와 동일 유지)
- [ ] Phase 4: 기준선 4건 PASS (G1)
- [ ] Phase 5: Chrome MCP Preview `:root` 체인 = DEFAULT (G2)
- [ ] Phase 5: Chrome MCP Preview `body` 상속 확인 + `font-feature-settings` 유지 (G3)
- [ ] Phase 5: Chrome MCP Preview/Publish 내부 텍스트 노드 **최종 computed fontFamily = DEFAULT 체인** (G4 — generated CSS `var(--font-sans)` unresolved 로 상속 활성 확인)
- [ ] Phase 5: Chrome MCP Publish `:root` 변동 없음 (G5)
- [ ] Phase 5: Chrome MCP Builder `:root` 1st family = Pretendard 유지 + 주요 패널 screenshot 시각 회귀 없음 (G6 — cascade override 수용, 1st family 불변)
- [ ] ADR-107 Status Proposed → Implemented 전환 (전원 Gate 통과 시)
- [ ] README.md 완료 91→92 / 미구현 10→9 / 합계 109 유지 (Implemented 전환 시)
