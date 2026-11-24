---
description: Text · Heading 글자 값 (크기 · 굵기 · 행간) 이 어디서 오는가 — 층 순서와 구현 계약 (사용자 결정 2026-11-24)
paths:
  - "packages/shared/src/catalog/**"
  - "packages/shared/src/components/styles/**"
  - "packages/rendering/src/renderers/CSSGenerator.ts"
  - "packages/rendering/scripts/generate-css.ts"
  - "apps/builder/src/builder/catalogRuntime/**"
  - "apps/builder/src/preview/**"
  - "apps/publish/src/styles/**"
---

# Text · Heading 글자 규칙

> 사용자 결정 2026-11-24 (「TEXT size 에 대한 rule 을 정해야한다」 → 「700 으로 규칙 확정」). 판단 기준은 설치된 S2 `Content.tsx` (Text · Heading 의 class = 받은 `styles` 뿐) 와 RAC 의 bare `span` · `h{level}` 이다. 글자 값을 바꾸는 작업은 이 규칙을 먼저 읽고, 이 규칙과 다른 판단이 필요하면 사용자에게 묻는다. **Why**: 정의가 없어 Heading 굵기 · Disclosure 제목 · Text 크기가 작업마다 다르게 판단됐다.

## 1. 층 — 뒤 층이 이긴다

Text · Heading 은 자기 글자 값이 없다. 글자 값은 아래 층에서 온다.

1. **문서 기본** — body 16 · 400 · 행간 1.5 (`installedBaseText`).
2. **브라우저 기본 (UA)** — Text (`span`) = 부모 그대로. Heading (`h1~h6`) = 부모 크기 × level 배수 (h1 2 · h2 1.5 · h3 1.17 · h4 1 · h5 .83 · h6 .67 — `headingFont.ts`), 굵기 bold 700, margin 0. RAC Heading 기본 level 3 — RAC context 가 주는 level 도 따른다 (RAC Dialog 의 `slot="title"` = 2, `headingFont.ts` `catalogHeadingLevel`).
3. **상속** — 크기 · 굵기 · 행간 · 서체는 가장 가까운 조상이 선언한 값 (CSS 상속).
4. **owner** — S2 컴포넌트가 자기 소스에서 안쪽 글자에 글자 값을 줄 때만 (`*Context` · style macro: Table 칸 `controlFont` · InlineAlert 제목 `title-sm` · Breadcrumb 현재 조각 bold …). rule 주석에 S2 파일:줄을 적는다. S2 에 없는 owner 글자 값은 만들지 않는다. S2 글꼴 이름의 굵기 = `title-*` bold 700 · `heading-*` extra-bold 800 · `ui` · `body` normal 400 (설치 S2 `style/dist/spectrum-theme.mjs` fontWeight). 대조 결과 (2026-11-24, 크기 · 굵기): Dialog · AlertDialog · FullscreenDialog 제목 = `title-2xl` 22 · 700 (Heading XXL), IllustratedMessage · InlineAlert 제목 = `title-*` 700, ContextualHelp 제목 = `heading-xs` 18 · 800 (L · template 값), CustomDialog 제목 = owner 값 없음 (RAC Dialog 의 title slot = h2 → 부모 × 1.5), Popover = 글자 값 없음 (S2 `Popover` 는 `div` padding 8 뿐 — 안 제목은 h3 → 페이지 글자 × 1.17), 메뉴 섹션 제목 = `ui` bold 700.
5. **작성값** — Styles 패널에 쓴 값.

## 2. 구현 계약

- **글자를 그리는 요소가 자기 글자 값을 갖는다** — owner 는 글자를 그리는 요소에 값을 준다 (S2 Disclosure 제목 = trigger Button 의 `title-*`). 중간 요소에 `font-size: inherit` 를 걸어 UA 배수를 끊지 않는다.
- **앱 reset 은 h 태그의 font-size · font-weight 를 지우지 않는다** — Publish (`apps/publish/src/styles/index.css`) · Preview (`baseStyles.ts`) 모두 UA 가 바닥. S2 · RAC 에는 그 reset 이 없다.
- **Size 칸 없음** — S2 Text · Heading 에 `size` prop 이 없다. 크기 단계는 owner 가 넣는 내부 값 (`CATALOG_SIZE_PROPAGATION` · `CATALOG_SIZE_STEP` · template) 이고 binding 은 `editorHidden` · 기본값 없음.
- **record = 그려지는 값** — 상태로 바뀌는 글자 값 (Breadcrumb 현재 조각 bold) 도 record 에 싣는다. paint 단계에서만 바꾸지 않는다 (Design 패널이 record 를 읽는다).
- **계산은 한 곳** — Canvas 는 1 ~ 3 층을 `compositionRoot.ts` `inheritedFontOf` (rule `inheritsFont`) 로, 4 층은 size 전파 · part rule 로. DOM 은 record 값을 inline 으로 쓴다. 생성 시트에는 Text · Heading 기본 글자 값을 두지 않는다 (`CSSGenerator` `skipFont`) — `Content.css` 도 글자 값 없음.

## 3. 확인

- 글자 규칙을 바꾸면 `apps/builder/scripts/s2-text-inherit-sweep-live.mjs` 를 돌린다 — 팔레트 전체를 놓고 그려지는 Text · Heading · h 요소의 Canvas record 와 Publish DOM (크기 · 굵기 · 행간 · 상자 높이) 을 대조한다.
- 단위: `apps/builder/src/builder/catalogRuntime/__tests__/s2TextInheritsFont.test.ts`.
