# ADR-028: Builder CSS 스코프 격리 — `[data-context="builder"]` 단일 선택자 전환

## Status

> **2026-11-10 — 다음 단계: [ADR-305](305-builder-chrome-component-css-separation.md)** — 변수 스코프 (`[data-context="builder"]`) 에 더해 시트 단위로 나눴다: 빌더 문서와 Preview · Publish 문서가 자기 시트만 싣는다.

Phase 0-1 Implemented (2026-03-07)

## Context

### 문제 정의

`builder-system.css`는 Builder UI 영역(header, sidebar, inspector 등)에만 적용되어야 할 CSS 변수를 **6+2개 선택자 나열**로 스코핑하고 있다:

```css
/* 현재: 영역별 선택자 나열 */
.inspector,
.sidebar,
.header,
.footer,
.overlay,
.bg,
.canvas,
body:not([data-preview="true"]) .react-aria-Popover,
body:not([data-preview="true"]) .react-aria-Modal,
.modal-panel { ... }
```

이 패턴에는 세 가지 구조적 결함이 있다:

1. **선택자 수동 관리**: 새 Builder UI 영역(e.g., BottomPanel, CommandPalette)을 추가할 때마다 선택자를 수동으로 추가해야 한다. 누락 시 해당 영역에서 preview-system의 tint 색상이 "새어나온다".

2. **Portal 누수**: React Aria의 Popover/Modal은 `document.body` 직하에 portal 렌더링된다. `body:not([data-preview="true"])` 패턴으로 우회하고 있으나, Builder body에 `data-preview`가 없으므로 **모든** Popover(Preview 포함)가 builder-system 변수를 상속받을 위험이 있다. `.modal-panel` 선택자는 이 누수를 수동으로 막기 위해 추가된 것이다.

3. **Dark mode 선택자 복제**: `[data-builder-theme="dark"]` 접두사와 모든 영역 선택자를 조합하여 dark mode 블록을 작성해야 한다. Light mode 선택자 목록이 변경되면 dark mode 블록도 동일하게 수정해야 하는 이중 유지보수 부담이 존재한다.

### 근본 원인

theme.css가 preview-system.css와 builder-system.css를 **같은 문서(Builder main document)**에 모두 로드한다:

```
theme.css
├── preview-system.css  → :root에 시맨틱 변수 정의 (tint 기반)
├── shared-tokens.css   → 공통 디자인 토큰
└── builder-system.css  → 특정 선택자 범위에서 시맨틱 변수 오버라이드 (gray 기반)
```

Preview iframe은 별도 document이므로 builder-system이 적용되지 않는다. 문제는 **Builder main document 내에서** preview-system의 `:root` 변수가 builder-system 선택자 범위 바깥의 Builder UI에 "새어나오는" 것이다.

현재는 `.inspector, .sidebar, .header, .footer, .overlay, .bg, .canvas`라는 **암묵적 DOM 구조 의존**으로 이를 방어하고 있다. 이것은 "구멍 뚫린 우산" 패턴 — 비가 오는 곳마다 수동으로 패치하는 구조다.

### Hard Constraints

| 제약                              | 설명                                                  |
| --------------------------------- | ----------------------------------------------------- |
| 번들 < 500KB                      | CSS 중복으로 인한 번들 증가 불가                      |
| Preview iframe 격리 유지          | ADR-004 결정 사항                                     |
| ADR-017/018 정합성                | 진행 중인 M3 제거 + utilities 패턴 도입과 충돌 불가   |
| 하위 호환                         | `data-variant`, `data-size` 등 기존 컴포넌트 API 유지 |
| React Aria `.react-aria-*` 클래스 | React Aria가 자동 생성하는 클래스명 변경 불가         |

### 업계 레퍼런스

| 제품                    | 격리 메커니즘                            | Portal/Overlay         | 비고                             |
| ----------------------- | ---------------------------------------- | ---------------------- | -------------------------------- |
| **Figma**               | WebGL 완전 우회 (C++ 렌더러)             | 완벽 격리              | 캔버스=WebGL, UI=React/CSS       |
| **Canva**               | Shadow DOM (에디터 UI ↔ 사용자 콘텐츠)   | Shadow 내부            | 강력하나 복잡                    |
| **Webflow**             | 역할 기반 (`html.wf-design-mode` 클래스) | 제한적                 | CSS Selector Scoping             |
| **Framer**              | CSS-in-JS (추정) + iframe 프리뷰         | 미공개                 | 공개 정보 제한적                 |
| **GrapesJS**            | CSSOM 파싱 기반 (JS 레벨)                | DOM 내 관리            | 완전 격리 아님, 가벼움           |
| **Builder.io**          | iframe (에디터 ↔ 사이트)                 | iframe 내부            | postMessage 통신                 |
| **Plasmic**             | 컴포넌트 경계 격리, CSS 상속 명시적 차단 | 명시적 선언            | 예측 가능, 통합 복잡             |
| **WordPress Gutenberg** | iframe (6.2+)                            | `enqueue_block_assets` | editorStyle/style 이원 체계      |
| **Storybook**           | Preview iframe                           | 부분적                 | `inline: false`로 story별 iframe |
| **CodeSandbox**         | Preview iframe (완전 분리)               | 완벽 격리              | postMessage 통신                 |

**분석 요약**: 10개 프로젝트의 격리 전략은 세 가지 패턴으로 수렴한다:

| 패턴                     | 사용 프로젝트                                 | 격리 강도 | 복잡도                |
| ------------------------ | --------------------------------------------- | --------- | --------------------- |
| **iframe 격리**          | Builder.io, Gutenberg, Storybook, CodeSandbox | Hard      | 중 (postMessage 필요) |
| **WebGL/Canvas 우회**    | Figma, composition(Skia)                      | 완벽      | 높음 (이미 구현됨)    |
| **CSS Selector Scoping** | Webflow, Plasmic                              | Soft      | 낮음                  |

10개 프로젝트 중 **물리적 CSS 파일 분리를 사용하는 사례는 0건**이다. 모두 런타임 격리(iframe, selector scope, WebGL)를 사용한다.

## Decision

`[data-context="builder"]` 단일 선택자 전환 + ADR-018 utilities 시너지

### 핵심 전략

BuilderViewport(`.app`)에 `data-context="builder"` 속성을 추가하고, builder-system.css의 모든 영역별 선택자를 이 단일 속성 선택자로 교체한다. ADR-018 Phase 2~5 완료에 따라 변수 오버라이드를 점진적으로 축소한다.

ADR-018의 `.button-base`, `.indicator`, `.inset` utilities 패턴이 모든 컴포넌트에 적용되면, 개별 variant/state 색상이 **로컬 변수 1개**(`--button-color`, `--indicator-color`, `--inset-bg`)로 수렴한다. Builder에서는 이 로컬 변수의 기반이 되는 시맨틱 변수(`--highlight-background`, `--field-background` 등) ~10개만 오버라이드하면 모든 hover/pressed/disabled 파생이 `color-mix()`로 자동 계산된다.

**Phase 0** (즉시, ADR-018 무관): `[data-context="builder"]` 전환 — 선택자 나열 제거
**Phase 1** (ADR-018 Phase 2~5 이후): builder-system.css 변수 오버라이드 ~30개 → ~10개로 축소

### 위험 평가

| 축           | 수준 | 근거                                                                           |
| ------------ | :--: | ------------------------------------------------------------------------------ |
| 기술         |  L   | CSS 변수 scoping은 검증된 기술. `UNSAFE_PortalProvider`는 React Aria 공식 제공 |
| 성능         |  L   | CSS 오히려 감소 (선택자 단순화 + 변수 축소)                                    |
| 유지보수     |  L   | 오버라이드 포인트 ~10개로 축소, 단일 선택자, dark mode 선택자 통합             |
| 마이그레이션 |  L   | Phase 0은 독립 작업, Phase 1은 ADR-018에 편승                                  |

### 채택 근거

1. **근본 원인 해결**: 영역별 선택자 나열을 구조적으로 제거. 새 Builder UI 영역 추가 시 CSS 수정 불필요
2. **ADR-018과 자연스러운 시너지**: utilities 패턴 완료 후 변수 오버라이드가 ~30개 → ~10개로 축소
3. **Dark mode 단순화**: `[data-builder-theme="dark"][data-context="builder"]` 단일 조합으로 통합
4. **점진적 마이그레이션**: Phase 0은 ADR-018과 독립적으로 즉시 적용 가능
5. **iframe 격리 활용**: Preview는 이미 iframe 격리(ADR-004). Builder 측 CSS만 scoping하면 충분
6. **업계 표준 정합**: Webflow(`html.wf-design-mode`), Tailwind v4(`[data-theme]`)와 동일한 CSS Selector Scoping 접근

## Implementation

### Phase 0: `[data-context="builder"]` 전환 (즉시, ADR-018 무관)

#### 0-1. BuilderViewport에 속성 추가

```tsx
// apps/builder/src/builder/main/BuilderViewport.tsx
export const BuilderViewport: React.FC<BuilderViewportProps> = ({
  children,
  className = "app",
}) => {
  return (
    <div className={className} data-context="builder">
      {children}
    </div>
  );
};
```

#### 0-2. builder-system.css 선택자 교체

```css
/* Before: 10개 선택자 */
.inspector, .sidebar, .header, .footer, .overlay,
.bg, .canvas,
body:not([data-preview="true"]) .react-aria-Popover,
body:not([data-preview="true"]) .react-aria-Modal,
.modal-panel { ... }

/* After: 1개 선택자 */
[data-context="builder"] { ... }
```

#### 0-3. Portal Container 설정

React Aria Popover/Modal이 `[data-context="builder"]` 범위 내에서 렌더링되도록 `UNSAFE_PortalProvider`를 사용한다 (`@react-aria/overlays` v3.31+, 기존 `UNSTABLE_portalContainer`는 deprecated):

```tsx
import { UNSAFE_PortalProvider } from "@react-aria/overlays";

const portalContainerRef = useRef<HTMLDivElement>(null);

<div data-context="builder" className="app">
  <UNSAFE_PortalProvider getContainer={() => portalContainerRef.current}>
    {/* 모든 Popover/Modal이 builder-portal 내에서 렌더링 */}
    {/* ... builder content ... */}
  </UNSAFE_PortalProvider>
  <div ref={portalContainerRef} id="builder-portal" />
</div>;
```

`UNSAFE_PortalProvider`가 안정화되지 않은 경우의 fallback으로, builder-system.css에 `body > .react-aria-Popover` 등 선택자를 유지할 수 있다:

```css
/* Fallback: body 직하 portal에도 builder 변수 적용 */
[data-context="builder"],
body:not([data-preview="true"]) > .react-aria-Popover,
body:not([data-preview="true"]) > .react-aria-Modal {
  /* 기존 변수 동일 */
}
```

#### 0-4. Dark mode 선택자 통합

`data-builder-theme`은 `document.documentElement`(`<html>`)에 설정된다 (`BuilderCore.tsx`의 `applyTheme()`). `[data-context="builder"]`는 `.app` div에 위치하므로 조상-자손 관계가 성립한다:

```
<html data-builder-theme="dark">       ← :root
  <body>
    <div class="app" data-context="builder">  ← BuilderViewport
```

```css
/* Before: 10개 선택자 × [data-builder-theme="dark"] */
[data-builder-theme="dark"] .inspector,
[data-builder-theme="dark"] .sidebar,
[data-builder-theme="dark"] .header,
[data-builder-theme="dark"] .footer,
[data-builder-theme="dark"] .overlay,
[data-builder-theme="dark"] .bg,
[data-builder-theme="dark"] .canvas,
[data-builder-theme="dark"] body:not([data-preview="true"]) .react-aria-Popover,
[data-builder-theme="dark"] body:not([data-preview="true"]) .react-aria-Modal,
[data-builder-theme="dark"] .modal-panel { ... }

/* After: 1개 조합 */
[data-builder-theme="dark"] [data-context="builder"] { ... }
```

#### 0-5. Builder styles ITCSS 넘버링 제거

`apps/builder/src/builder/styles/`의 ITCSS 넘버 접두사(`4-`, `5-`)를 제거한다. Layer 1~3은 이미 삭제/주석 처리되어 실제 import가 없으므로, 2개 레이어만 남은 넘버링은 의미가 없다:

```
Before                        After
styles/                       styles/
├── 4-layout/                 ├── layout/
│   ├── canvas.css            │   ├── canvas.css
│   ├── footer.css            │   ├── footer.css
│   └── header.css            │   └── header.css
├── 5-modules/                ├── modules/
│   ├── element-tree.css      │   ├── element-tree.css
│   ├── error-loading.css     │   ├── error-loading.css
│   ├── panel-container.css   │   ├── panel-container.css
│   └── panel-nav.css         │   └── panel-nav.css
└── index.css                 └── index.css
```

- `index.css`의 import 경로를 `./layout/`, `./modules/`로 변경
- 주석의 ITCSS 레이어 번호 참조 정리

### Phase 1: ADR-018 완료 후 변수 축소

ADR-018 Phase 2~5가 완료되면 모든 컴포넌트가 `.button-base`/`.indicator`/`.inset` utilities를 사용한다. 이때 builder-system.css를 다음과 같이 축소한다:

```css
@layer builder-system {
  [data-context="builder"] {
    /* 기반 시맨틱 변수만 오버라이드 (~10개) */
    --background-color: var(--gray-0);
    --text-color: var(--gray-750);
    --text-color-disabled: var(--gray-400);
    --text-color-placeholder: var(--gray-500);
    --border-color: var(--gray-300);
    --highlight-background: var(--gray-900);
    --highlight-foreground: var(--gray-0);
    --field-background: var(--gray-0);
    --button-background: var(--gray-50);
    --focus-ring-color: var(--blue-300);
    --invalid-color: var(--red-500);

    /* utilities의 color-mix()가 hover/pressed/disabled를 자동 파생 */
  }
}
```

현재 ~30개 변수 오버라이드가 ~10개로 축소된다. `color-mix()` 기반 파생이 hover/pressed를 자동 계산하므로 `--button-background-hover`, `--highlight-background-pressed` 등 파생 변수가 불필요해진다.

### Publish 앱 영향

Publish 앱에는 `[data-context="builder"]` 속성이 존재하지 않으므로 builder-system.css의 모든 규칙이 **자동 비활성화**된다. 추가 작업 불필요.

현재 Publish 앱은 `packages/shared/src/components/index.css` → `styles/index.css` → `theme.css`를 통해 builder-system.css를 로드하지만, `[data-context="builder"]` 선택자가 매칭되는 요소가 없으므로 dead CSS다. builder-system.css는 ~186줄(~4KB)이므로 번들 영향 미미.

> **향후 최적화**: Publish 번들에서 builder-system.css를 완전히 제거하려면, `theme.css`에서 `@import "./styles/theme/builder-system.css"`를 builder 전용 엔트리로 분리하면 된다. 현재는 dead CSS ~4KB이므로 우선순위 낮음.

### 최종 아키텍처

```
                    ┌────────────────────────────────┐
                    │   packages/shared/styles/       │
                    │   ~80 component CSS files       │
                    │   + utilities.css (ADR-018)     │
                    │   → 시맨틱 변수 기반, 단일 소스  │
                    └──────┬──────────┬───────────────┘
                           │          │
              ┌────────────┘          └────────────┐
              │                                    │
    ┌─────────▼───────────────┐      ┌─────────────▼──────────┐
    │  Builder (main doc)      │      │  Preview (iframe doc)   │
    │  [data-context="builder"]│      │  data-preview="true"    │
    │  ↓                       │      │  ↓                      │
    │  builder-system.css      │      │  preview-system.css     │
    │  (~10 variable override) │      │  (tint + dark mode)     │
    │  자동 파생 by utilities  │      │  사용자 커스터마이징     │
    └──────────────────────────┘      └─────────────────────────┘

    ┌──────────────────────────┐
    │  Publish (app)            │
    │  No [data-context]        │
    │  → builder-system 비활성  │
    │  → preview-system 활성    │
    └──────────────────────────┘
```

## Gates

| Gate | 시점         | 통과 조건                                                                           | 실패 시 대안                                                                   |
| ---- | ------------ | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| G0   | Phase 0-2 후 | Builder UI 모든 영역(inspector, sidebar, header, modal, popover)에서 시각 변화 없음 | 누락 영역에 `[data-context="builder"]` 범위 확인, 필요 시 추가 선택자 보완     |
| G1   | Phase 0-3 후 | Popover/Modal portal이 Builder 테마(gray)를 올바르게 적용. Preview tint 색상 미유입 | `UNSAFE_PortalProvider` 대신 `body:not([data-preview]) >` fallback 선택자 유지 |
| G2   | Phase 0-4 후 | Builder dark mode 전체 영역 정상 동작                                               | Dark mode 선택자에 기존 영역 선택자 복원                                       |
| G3   | Phase 1 후   | ADR-018 utilities 기반 hover/pressed 파생이 Builder gray 테마에서 정확한 색상 출력  | 해당 변수 오버라이드 복원                                                      |

잔존 HIGH 위험 없음.

## Consequences

### Positive

1. **선택자 관리 제거**: 10개 선택자 → 1개. 새 Builder UI 영역 추가 시 CSS 수정 불필요
2. **Dark mode 선택자 통합**: 10개 조합 → 1개 조합. 이중 유지보수 부담 해소
3. **ADR-018 시너지**: 변수 오버라이드 ~30개 → ~10개로 축소 가능
4. **Publish 앱 자동 정리**: `[data-context="builder"]` 부재 시 builder-system 자동 비활성
5. **Portal 누수 구조적 해결**: `body:not([data-preview])` 패턴 대신 명시적 portal container
6. **`!important` 불필요**: Variable Scope가 정확해지면 강제 오버라이드 불필요 (builder-system에 현재 `!important` 0건이나, 향후 추가 방지)

### Negative

1. **Portal container 설정 필요**: React Aria `UNSAFE_PortalProvider` 활용 또는 fallback 선택자 유지. `UNSAFE_` 접두사는 API 안정화 전 단계를 의미하므로, 메이저 버전 업그레이드 시 API 변경 가능성이 있다. Fallback 선택자(`body:not([data-preview]) > .react-aria-Popover` 등)를 Phase 0-3에 병행 유지하고, React Aria의 stable PortalProvider 출시 후 fallback을 제거한다
2. **Phase 1(변수 축소)은 ADR-018 완료 의존**: Phase 2~5 미완료 시 변수 축소 불가. 단, Phase 0만으로도 핵심 문제(선택자 나열) 해결
3. **`[data-context="builder"]`가 CSS 변수 상속의 경계**: 이 속성 바깥에서 Builder 컴포넌트를 렌더링하면 preview-system 변수가 적용됨. 실제로는 모든 Builder UI가 `BuilderViewport` (`BuilderCore.tsx`의 유일한 사용처) 하위에서 렌더링되므로 이론적 위험에 가깝다. 단, 향후 Builder 외부에서 공유 컴포넌트를 렌더링하는 케이스가 생기면 이 제약을 인지해야 한다

### 향후 전환: CSS `@scope`

CSS `@scope`가 2026.01 Baseline Newly Available에 진입했다 (Chrome 120+, Safari 18+, Firefox 146+, Edge 120+). Phase 1 이후 `[data-context]` 속성 선택자를 `@scope` 규칙으로 전환할 수 있다:

```css
/* 현재 (Phase 0~1) */
[data-context="builder"] {
  --highlight-background: var(--gray-900);
}

/* 향후 (@scope 전환) */
@scope ([data-context="builder"]) {
  :scope {
    --highlight-background: var(--gray-900);
  }
}

/* "donut scope" — builder 범위 내, preview 영역 제외 */
@scope ([data-context="builder"]) to (.preview-area) {
  .button {
    background: var(--highlight-background);
  }
}
```

`@scope`의 추가 이점:

- **Donut scope**: `to` 절로 내부 특정 영역을 범위에서 제외. 중첩된 preview 영역 등을 선택자 없이 자동 제외 가능
- **Proximity 우선순위**: 동일 specificity에서 가장 가까운 scope의 규칙이 자동 승리. 중첩 테마(Builder 내 다크/라이트 영역)에서 유용

현 시점에서는 `[data-context]` 속성 선택자만으로 충분하며, `@scope`는 선택적 개선이다. 기존 `@layer` 체계(cascade 순서 제어)와 `@scope`(DOM 범위 제어)는 상호 보완적으로 조합 가능하다.

## References

### Internal

- ADR-004: Preview iframe 격리
- ADR-017: CSS Override SSOT (M3 토큰 제거)
- ADR-018: Component CSS Restructure (utilities 패턴)
- ADR-021: Dark Mode
- ADR-022: S2 Color Token 체계

### External

- React Aria: [UNSAFE_PortalProvider](https://react-aria.adobe.com/PortalProvider) (`@react-aria/overlays` v3.31+)
- Tailwind CSS v4: [Multi-Theme with data-attributes](https://tailwindcss.com/blog/tailwindcss-v4)
- MDN: [CSS @scope](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@scope) (2026.01 Baseline Newly Available)
- MDN: [CSS Cascade Layers](https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Styling_basics/Cascade_layers)
- CSS @scope Explainer: [OddBird](https://css.oddbird.net/scope/explainer/)
