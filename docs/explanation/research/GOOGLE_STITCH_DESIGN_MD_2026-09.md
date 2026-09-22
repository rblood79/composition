# Google Stitch DESIGN.md — 테마 관리 방식 리서치 (2026-09-22)

> `/deep-research` 하니스 (검색 5 각도 → 출처 21 fetch → 주장 105 추출 → 25 건 3표 반증 검증: 확정 22 · 기각 3 · 종합 11) 결과. 기준일 2026-09-22 — DESIGN.md 스펙은 version `alpha` 라 바뀐다. 질문: Stitch 가 `DESIGN.md` 로 테마/디자인 시스템을 어떻게 관리하는가 (형식 · 생성/적용 · 토큰 · 다중 테마 · 코드/외부 도구 반영 · 타 도구와의 차이). 마지막 절은 composition ADR-227 (`ThemesCollection`) 과의 대조.

## 0. 요약

Google Stitch 의 DESIGN.md 는 2026-03-18 Google 공식 블로그에서 "agent-friendly markdown file" 로 처음 소개됐고, 2026-04-21 에 draft 스펙 (version `alpha`) 이 google-labs-code/design.md (Apache-2.0) 로 오픈소스화된, 코딩 에이전트에게 시각 정체성을 설명하는 도구 간 교환 형식이다. 파일은 두 층 — `---` 로 감싼 YAML front matter (colors · typography · rounded · spacing · components 5개 토큰 그룹, DTCG 의 `{path.to.token}` 참조 문법 차용, 토큰이 normative 값) 와 `##` 8절 고정 순서의 markdown 본문 (사람용 설계 근거) — 으로 구성되며, `name` 과 `colors.primary` 만 사실상 필수다. Stitch 안에서는 프롬프트에서 agent 가 생성 · 기존 URL/이미지에서 추출 · 수동 작성 세 경로로 만들어지고, 사용자가 다듬으면 프로젝트 전체 화면에 재적용되는 living artifact 이자 프로젝트 간 export/import 단위다. 현행 스펙에는 light/dark 나 브랜드 변형을 표현하는 1급 구조가 없어 (공식 예시 3개도 파일당 단일 테마, 상태 변형만 `button-primary-hover` 식 별도 키) 다중 테마는 issue #13 / PR #128 (`themes` · `default-theme` · 토큰별 `{light, dark}` 값, Tailwind v4 `@media`/`[data-theme]` 출력) 으로 제안 단계에 머물러 있다. 생성 코드 반영은 예시 디렉터리의 Tailwind v3 `tailwind.config.js` 와 DTCG `design_tokens.json` 파생, 그리고 스펙이 명시한 tokens.json · Figma variables · Tailwind theme config 상호 변환 전제로 확인되지만, Stitch 내부 코드 생성기가 DESIGN.md 를 어떻게 소비하는지와 MCP/API 경로는 검증된 1차 근거가 없다.

| 축           | Stitch DESIGN.md (alpha, 2026-09)                                                                                                                                  | 확정도 |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------ |
| 정체         | 에이전트용 **교환 형식** (markdown + YAML front matter). Stitch 내부 저장 포맷이 아니라 도구 간 export/import 단위. 스펙·CLI 는 Apache-2.0 오픈소스, 생성기는 아님 | high   |
| 구조         | 두 층 — front matter 토큰 (normative) + `##` 8절 산문 (용도·근거). 필수는 `name` · `colors.primary` 뿐                                                             | high   |
| 토큰         | `colors` · `typography` · `rounded` · `spacing` · `components` — DTCG typed group + `{colors.primary}` 참조. 상태 변형은 `button-primary-hover` 별도 키            | high   |
| 다중 테마    | **없음** (스키마에 themes/modes 키 0). light/dark 는 파일 단위. PR #128 (`themes` · `default-theme` · 토큰별 `{light, dark}`) 미병합                               | high   |
| 생성·적용    | 프로젝트 단위 living artifact — agent 생성 / URL·이미지 추출 / 수동 / 외부 에이전트 추출 → 업로드. 다듬으면 전 화면에 재적용                                       | high   |
| 코드 반영    | 예시에 Tailwind v3 config + DTCG JSON 파생물 · CLI Tailwind v4 exporter. Stitch 내부 생성기의 소비 경로는 **미확정**                                               | medium |
| 외부 도구    | `stitch-skills` skill 이 만드는 DESIGN.md 는 front matter 없는 산문 5절 (스펙과 다른 갈래). MCP 로 읽고 쓴다는 주장은 기각                                         | medium |
| 타 도구 비교 | 코드베이스 파일 · 값+근거 한 파일 · mode 1급 구조 부재 — **검증 안 된 추정**                                                                                       | low    |

## 1. 확정 사실 (검증 통과 주장, 확정도 순)

### F1 (high) — DESIGN.md 는 도구 간 교환 형식 (오픈소스 draft 스펙, alpha)

DESIGN.md 는 Stitch 내부 전용 저장 포맷이 아니라 도구 간 교환 형식이다 — 2026-03-18 Google 공식 블로그가 'agent-friendly markdown file' 로 소개 (디자인 규칙을 다른 디자인·코딩 도구와 export/import), 2026-04-21 후속 블로그가 draft 스펙을 오픈소스화 (google-labs-code/design.md, Apache-2.0, README 자기 정의 'A format specification for describing a visual identity to coding agents', 저장소 홈페이지 링크 = stitch.withgoogle.com/docs/design-md/specification). 형식 버전은 `alpha` 이며 README 가 변경 예상을 명시한다.

- **근거**: 3월 글 원문 'use the new DESIGN.md — an agent-friendly markdown file — to export or import your design rules to or from other design and coding tools'; 4월 글 원문 'Today, we're open-sourcing the draft specification for DESIGN.md, so it can be used across any single tool or platform' (공식 X 계정 동일 문구); GitHub LICENSE = Apache-2.0, README 'The DESIGN.md format is at version alpha… under active development'. 오픈소스된 것은 스펙·토큰 스키마·CLI 이며 Stitch 의 생성기 자체는 아니다.

- **출처**: <https://blog.google/innovation-and-ai/models-and-research/google-labs/stitch-ai-ui-design/> · <https://blog.google/innovation-and-ai/models-and-research/google-labs/stitch-design-md/> · <https://github.com/google-labs-code/design.md>

- **표결**: [0] 3-0 · [16] 3-0 · [19] 3-0 병합

### F2 (high) — 파일 구조는 두 층 — YAML front matter + markdown 8절

파일 구조는 두 층이다 — 파일 상단 `---` 펜스로 구분된 YAML front matter (기계 판독 토큰, 선택적) 와 `##` 절로 조직된 markdown 본문 (사람 판독 설계 근거). 토큰이 normative 값이고 산문은 적용 맥락일 뿐이다. 본문 절은 Overview(별칭 Brand & Style) → Colors → Typography → Layout(별칭 Layout & Spacing) → Elevation & Depth → Shapes → Components → Do's and Don'ts 순서를 따르되 생략 가능하다 (README 는 must, spec.md 는 should, linter `section-order` 는 warning). 특수 markup 없이 표준 YAML + markdown 만 쓴다.

- **근거**: README 'A DESIGN.md file has two layers: 1. YAML front matter — Machine-readable design tokens, delimited by --- fences… 2. Markdown body — Human-readable design rationale organized into ## sections… The tokens are the normative values'; spec.md 'An optional YAML frontmatter, and a markdown body… The tokens are the normative values; the prose provides context for how to apply them'; Stitch docs overview 페이지 (Chrome 렌더로 판독) 도 같은 두 층 서술. 단, 스키마 관례 (`{path.to.token}` 참조 · 절 순서 · 중복 절 제목 오류) 가 위에 얹힌다.

- **출처**: <https://stitch.withgoogle.com/docs/design-md/overview> · <https://github.com/google-labs-code/design.md> · <https://github.com/google-labs-code/design.md/blob/main/docs/spec.md>

- **표결**: [2] 3-0 · [5] 3-0 · [17] 3-0 · [18] 2-1 병합

### F3 (high) — front matter 토큰 스키마 (alpha) — 필수는 name · colors.primary

front matter 토큰 스키마 (alpha): 최상위 키 `version`(선택) · `name` · `description`(선택) · `omitted`(선택, 2026-07-27 PR #155 로 추가) · `colors` (map<string, Color> — hex 뿐 아니라 rgb()/oklch()/named 등 모든 CSS 색) · `typography` (역할 키 아래 fontFamily/fontSize/fontWeight/lineHeight/letterSpacing + 선택 fontFeature/fontVariation) · `rounded` (map<string, Dimension>) · `spacing` (Dimension | number) · `components` (컴포넌트별 속성 맵, 값은 리터럴 또는 참조). 필수는 `name` 과 `colors.primary` 뿐 (후자는 linter `missing-primary` warning — 없으면 agent 가 자동 생성). Design Token JSON spec (designtokens.org 2025.10) 의 typed group 개념과 `{path.to.token}` 참조 문법을 채택하며, 상태 변형은 `button-primary` / `button-primary-hover` / `button-primary-active` 처럼 별도 키로 두고 agent 가 종합한다. 공식 최소 예시 (DevFocus Dark) 는 name · colors(primary/secondary/surface/on-surface/error) · typography(body-md) · rounded(md: 8px) 만 담는다.

- **근거**: spec.md 39~~60행 스키마 블록; 12~~15행 'inspired by the Design Token JSON spec… typed token groups (colors, typography, spacing) and the {path.to.token} reference syntax… easily converted from or to tokens.json, Figma variables, and Tailwind theme configs'; §Components Variants 단락 'button-primary, button-primary-hover, button-primary-active. The agent will consider all variants'; README Token Types 표 `{colors.primary}`; Stitch docs Example 절 'name: DevFocus Dark / colors: primary #2665fd …'. 'Material 어법' 은 검증자 해석이며 문서는 Material 이라는 단어를 쓰지 않는다.

- **출처**: <https://github.com/google-labs-code/design.md/blob/main/docs/spec.md> · <https://github.com/google-labs-code/design.md> · <https://stitch.withgoogle.com/docs/design-md/overview>

- **표결**: [3] 3-0 · [6] 3-0 · [10] 3-0 · [18] 2-1 병합

### F4 (high) — 공식 예시 3개 — MD3 색 역할 47 키 · Tailwind v3/DTCG 파생물

공식 예시 3개 (examples/atmospheric-glass · paws-and-paths · totality-festival, 커밋 f1cd0927 2026-04-10) 는 모두 front matter 최상위 키 `name · colors · typography · rounded · spacing · components` 동일 집합을 쓰고, `colors` 는 Material Design 3 색 역할 어휘 47개 키 (surface / surface-container-{lowest…highest} / on-surface / primary / on-primary / primary-container / primary-fixed(-dim) / secondary·tertiary 동일 8종 / error / outline / inverse-* / surface-tint / background / surface-variant) 를 hex 문자열로 채운다. `components` 는 `{colors.primary}` · `{rounded.xl}` · `{spacing.glass-padding}` · `{typography.label-sm}` 같은 참조로 alias 하고 hover 는 `button-primary-hover` 별도 키다. 각 예시 디렉터리에는 DESIGN.md 에서 파생한 Tailwind v3 `tailwind.config.js` (`darkMode: 'class'` 보일러플레이트만, dark 토큰 없음) 와 DTCG 형식 `design_tokens.json` (`$type: color, $value: {colorSpace: srgb, components, hex}`) 이 동봉된다.

- **근거**: raw 3개 파일 파싱: 세 파일 colors 키 47개 완전 동일 (차집합 0), 값 전부 #rrggbb; 커밋 메시지 'paws-and-paths: … (light theme, Plus Jakarta Sans) · totality-festival: … (dark cosmic theme…) · Each example includes: DESIGN.md · tailwind.config.js: Tailwind CSS v3 theme config derived from the design tokens · design_tokens.json: DTCG-compliant JSON'; atmospheric-glass components 블록 'button-primary: backgroundColor: {colors.primary} … button-primary-hover: backgroundColor: {colors.primary-fixed-dim}'. MD3 47키 + hex 는 형식의 요구가 아니라 예시 파일의 사실 (스키마는 임의 토큰 이름 허용).

- **출처**: <https://github.com/google-labs-code/design.md/blob/main/examples/atmospheric-glass/DESIGN.md> · <https://github.com/google-labs-code/design.md>

- **표결**: [8] 3-0 · [9] 3-0 · [10] 3-0 · [11] 3-0 병합

### F5 (high) — 현행 스펙에 light/dark · 브랜드 변형 1급 구조 없음

현행 alpha 스펙에는 light/dark 모드나 브랜드 변형을 한 파일 안에서 표현하는 1급 구조가 없다 — 스키마에 themes/modes/color-scheme 류 키가 없고 spec.md 를 dark/mode/scheme/theme 로 grep 해도 0건 (theme 는 'Tailwind theme configs' 1건뿐). 변형 축은 컴포넌트 상태 (hover/active/pressed) 뿐이며, 공식 예시도 파일당 단일 테마 (paws-and-paths = light, totality-festival · atmospheric-glass = dark) 라 light/dark 는 파일 단위로 갈린다. 다중 테마는 issue #13 'Support for different modes/themes?' (2026-04-21 개설, open, maintainer davideast 가 2026-05-01 `modes`/`extends` 안에 긍정) 와 PR #128 (mvanhorn, 2026-06-26, 2026-09-22 기준 open · 미병합) 으로 제안 단계다.

- **근거**: spec.md Variants 단락 'A component may have a variant for different UI states such as active, hover, pressed… The agent will consider all variants'; 세 예시 surface 값 #f9f9ff (밝음) vs #121318 / #0b1326 (어두움); PR 목록에서 mode/theme 관련 병합 PR 0건 (병합된 것은 export/format 수정 #151 #122 #109 #103 #64 #45 #5 #4 #3 #1). '파일 단위로 갈린다' 는 명문 규칙이 아니라 예시 + 스키마 부재에서 끌어낸 추론이다.

- **출처**: <https://github.com/google-labs-code/design.md/blob/main/docs/spec.md> · <https://github.com/google-labs-code/design.md/blob/main/examples/atmospheric-glass/DESIGN.md> · <https://github.com/google-labs-code/design.md/pull/128>

- **표결**: [7] 3-0 · [11] 3-0 · [12] 3-0 병합

### F6 (high) — 제안 중인 다중 테마 문법 — PR #128 (미병합)

제안 중인 다중 테마 문법 (PR #128, 미병합): front matter 에 `themes` (문자열 배열) 와 `default-theme` 키를 추가하고 토큰 값을 mode 키 객체로 둔다 — `colors.surface: { light: '#ffffff', dark: '#111111' }` (rounded/spacing 도 동일, mode 값 안에서 `{colors.brand}` 참조 허용, 테마별로 참조 해석). 동봉된 Tailwind v4 exporter 는 기본 테마를 `@theme {…}` 와 `:root {…}` 로, dark 는 `@media (prefers-color-scheme: dark) { :root:not([data-theme]) {…} }` 와 `[data-theme=dark] {…}` 두 곳으로, 그 외 alternate mode 는 `[data-theme=<mode>]` 만 출력한다.

- **근거**: PR diff (1,135행, packages/cli/src/linter/ 9파일): spec-config.ts `THEME_MODE_KEYS = ['themes', 'default-theme']`; parser/handler.test.ts YAML 'themes: - light - dark / default-theme: light / colors: surface: light: #ffffff dark: #111111'; model/handler.test.ts 'resolves references against each theme mode'; tailwind/v4/serialize.ts `serializeModeOverrides` 가 @media 블록은 `mode === 'dark'` 일 때만 push. PR 설명의 'maintainer-endorsed' 는 저자 자기 서술로 독립 검증 안 됨. main 브랜치에는 themes/default-theme 0건.

- **출처**: <https://github.com/google-labs-code/design.md/pull/128>

- **표결**: [12] 3-0 · [13] 3-0 · [14] 3-0 병합

### F7 (high) — Stitch 안에서의 생성·적용 — 프로젝트 단위 living artifact

Stitch 안에서 DESIGN.md 는 프로젝트 단위 산출물이며 세 경로로 만들어진다 — (1) 프롬프트 (vibe) 에서 agent 가 colors/typography/spacing/component styles 를 생성해 DESIGN.md 로 요약, (2) 기존 브랜드 URL 또는 이미지에서 palette·typography·style 패턴 추출 (Import from website 대화상자), (3) 수동 작성. 생성 후 사용자가 다듬으면 화면에 재적용되는 living artifact 로 프로젝트 전체 화면이 같은 시각 규칙을 따르고, 프로젝트 간 export/import 로 재사용된다. 별도 문서 페이지 (docs/design-md/get-instructions) 가 4번째 경로 — 외부 코딩 에이전트 (Gemini/Claude Code/Cursor/Antigravity) + Stitch Design Skills 로 기존 코드베이스에서 DESIGN.md 를 추출해 Stitch 에 업로드 — 를 기술한다. 3월 블로그는 URL 추출과 DESIGN.md import 를 병렬 경로로만 제시하고 스키마·다중 테마는 다루지 않는다.

- **근거**: overview 페이지 (BETA, 빌드 boq_pitchfork-nemo-ui_20260921.01, Chrome 렌더 판독) 'How they're created' 절 3소절 'Let the agent generate it / Derive from branding / Write it by hand'; 'DESIGN.md is a living artifact, not a static config file… The agent generates it, you refine it, and it's re-applied to screens as you iterate'; 'every screen it generates follows the same visual rules'; 4월 블로그 'export or import your design rules from project to project, so you don't have to reinvent the wheel'. 제3자 가이드의 UI 경로 (Settings → Design System → Import/Export) 와 hands-on 리뷰의 'Import from website still buggy' (2026-03-20) 는 미검증 2차 서술. Stitch 앱 UI 에는 Theme | DESIGN.md 탭이 별도로 존재한다 (스크린샷).

- **출처**: <https://stitch.withgoogle.com/docs/design-md/overview> · <https://blog.google/innovation-and-ai/models-and-research/google-labs/stitch-design-md/> · <https://blog.google/innovation-and-ai/models-and-research/google-labs/stitch-ai-ui-design/>

- **표결**: [1] 3-0 · [4] 3-0 · [20] 3-0 병합

### F8 (high) — 색의 용도 산문 + WCAG 검증은 linter/agent 몫

DESIGN.md 는 색상의 값만이 아니라 용도/의도를 기술하도록 설계됐고, 이를 근거로 AI agent 가 WCAG 접근성 규칙에 대해 색 선택을 검증할 수 있다. 용도 기술은 front matter 토큰 필드가 아니라 markdown 본문 산문 (예: 'Primary (#1A1C1E): Deep ink for headlines and core text') 에 실리며, 검증 주체는 Stitch 가 아니라 스펙 저장소의 linter (`contrast-ratio` 규칙: components 의 backgroundColor/textColor 쌍을 WCAG AA 4.5:1 로 검사) 와 agent 다.

- **근거**: 블로그 'Instead of guessing intent, AI agents can know exactly what a color is for, and can validate their choices against WCAG accessibility rules'; linter 출력 예 'contrast ratio 15.42:1 — passes WCAG AA'. 블로그는 'agents can validate' 로 능력을 말할 뿐 Stitch 자동 검증을 주장하지 않는다.

- **출처**: <https://blog.google/innovation-and-ai/models-and-research/google-labs/stitch-design-md/> · <https://github.com/google-labs-code/design.md>

- **표결**: [21] 3-0

### F9 (medium) — 외부 agent 도구의 DESIGN.md 는 두 갈래 (산문 vs front matter)

외부 agent 도구가 읽고 쓰는 DESIGN.md 는 두 갈래가 공존한다 — google-labs-code/stitch-skills 의 `stitch-utilities/skills/design-md` skill 이 만드는 것은 YAML front matter 없는 순수 산문 문서 (`# Design System: [Project Title]` + `**Project ID:**` 헤더, 5절: 1. Visual Theme & Atmosphere · 2. Color Palette & Roles · 3. Typography Rules · 4. Component Stylings · 5. Layout Principles, 'natural language exclusively' 지침) 인 반면, 자매 skill `stitch-design/skills/extract-design-md` 는 같은 5절 위에 YAML front matter (`name` + Material 식 `colors` 역할 맵) 를 MUST 로 요구하고 `taste-design` 은 6. Motion & Interaction · 7. Anti-Patterns 절을 더한다. 즉 skills 층의 DESIGN.md 는 스펙 저장소의 정형 스키마와 완전히 같지 않다.

- **근거**: SKILL.md (172행, 저장소 main 최종 갱신 2026-05-10) 'Output Format (DESIGN.md Structure)' 코드 블록이 인용과 글자 단위 일치; Output Guidelines 'Use descriptive design terminology and natural language exclusively · Generate a clean Markdown file'; `manage-design-system` SKILL.md 가 design-md skill 구조를 참조. 표결 2-1 이며 관련 세부 주장 (Tailwind 클래스 → 물리 서술 번역 규칙) 은 1-2 로 기각됐으므로 세부 표기 규칙은 미확정.

- **출처**: <https://github.com/google-labs-code/stitch-skills/blob/main/plugins/stitch-utilities/skills/design-md/SKILL.md>

- **표결**: [15] 2-1

### F10 (medium) — 생성 코드 반영 — 변환 전제는 확정, Stitch 내부 소비 경로는 미확정

생성 코드 반영: 스펙은 토큰이 tokens.json · Figma variables · Tailwind theme config 로 '쉽게 변환' 된다고 전제하고, 공식 예시는 DESIGN.md → Tailwind v3 config + DTCG JSON 파생물을 실제로 동봉하며, CLI 에 Tailwind v4 exporter (`@theme`) 가 있다 (PR #128 이 그 exporter 를 확장). 그러나 Stitch 제품 안에서 화면 HTML/Tailwind 생성기가 DESIGN.md 토큰을 어떤 경로로 소비하는지, Figma export 에 토큰이 어떻게 실리는지에 대한 1차 근거는 검증 통과 주장에 없다.

- **근거**: spec.md 'easily converted from or to tokens.json, Figma variables, and Tailwind theme configs' (원문은 'easily converted' — 상호 변환 보장까지는 아님); 예시 README 'Tailwind CSS v3 theme configuration derived from the design tokens'; PR diff 경로 packages/cli/src/linter/tailwind/v4/serialize.ts. Stitch 내부 소비 경로는 overview 페이지의 'every screen it generates follows the same visual rules' 산문 수준.

- **출처**: <https://github.com/google-labs-code/design.md/blob/main/docs/spec.md> · <https://github.com/google-labs-code/design.md/blob/main/examples/atmospheric-glass/DESIGN.md> · <https://github.com/google-labs-code/design.md/pull/128>

- **표결**: [6] 3-0 · [11] 3-0 · [14] 3-0 부분 병합

### F11 (low) — Figma/Framer/Webflow 와의 차이 — 검증 안 된 추정

(검증되지 않은 추정) Figma Variables · Framer Styles · Webflow Variables 와의 차이는 세 축으로 요약된다 — (a) 저장 위치: 도구 내부 DB 가 아니라 코드베이스에 두는 파일 (context file) 이라 어느 agent 든 읽는다, (b) 정본 형태: 값 (YAML 토큰) 과 근거 (산문) 를 한 파일에 두고 산문을 agent 가 읽도록 설계, (c) 모드 축: Figma Variables 의 mode 같은 1급 다중 테마 구조가 현행 alpha 에 없고 PR 단계다. 이 비교 자체는 이번 검증 라운드의 주장에 포함되지 않았다.

- **근거**: 근거로 삼을 수 있는 검증 사실은 스펙의 Figma variables 변환 전제와 '두 층 · 파일 · agent 용' 정의뿐이며, Figma/Framer/Webflow 쪽 기능 서술은 이번 라운드에서 출처 확인이 없었다. 리서치 보고에는 추정으로 구분해 실어야 한다.

- **출처**: <https://github.com/google-labs-code/design.md/blob/main/docs/spec.md> · <https://blog.google/innovation-and-ai/models-and-research/google-labs/stitch-design-md/>

- **표결**: 검증 주장 없음 — 종합자 추정

## 2. 기각된 주장 (3표 반증 — 인용 금지)

| 주장                                                                                                                                                                                                                                                                                                                                                                                                     | 표결 | 출처                                                                                                             |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ---------------------------------------------------------------------------------------------------------------- |
| 토큰 표기 규칙: 색상은 서술적 이름 + 괄호 안 hex + 기능 역할 3요소로 적고, border-radius 같은 기하 값은 Tailwind 클래스를 물리적 서술로 번역한다 (rounded-full → Pill-shaped, rounded-lg → Subtly rounded corners, rounded-none → Sharp, squared-off edges). 기술 용어를 번역 없이 쓰는 것은 명시적 금지 항목이다.                                                                                       | 1-2  | <https://github.com/google-labs-code/stitch-skills/blob/main/plugins/stitch-utilities/skills/design-md/SKILL.md> |
| DESIGN.md 는 Stitch 가 직접 읽는 설정 파일이 아니라 Stitch 에 새 화면을 프롬프트할 때 참조하는 'source of truth' 로 설계됐고, Stitch 는 디자인을 hex 값이 뒷받침하는 'Visual Descriptions' 으로 해석한다는 전제에 기반한다 — 즉 프로젝트 단위로 기존 화면들의 디자인 언어를 역추출해 후속 프롬프트에 정렬시키는 용도다.                                                                                  | 0-3  | <https://github.com/google-labs-code/stitch-skills/blob/main/plugins/stitch-utilities/skills/design-md/SKILL.md> |
| 외부 도구 (agent) 는 Stitch MCP Server 의 list_projects / list_screens / get_screen / get_project 도구로 화면의 htmlCode.downloadUrl · screenshot.downloadUrl 과 프로젝트의 designTheme 객체 (color mode · fonts · roundness · custom colors) 를 읽어 DESIGN.md 를 합성한다 — 즉 Stitch 내부 테마 정본은 project 의 designTheme 이고, DESIGN.md 는 그것과 생성 HTML/Tailwind 를 파싱해 만든 파생 문서다. | 0-3  | <https://github.com/google-labs-code/stitch-skills/blob/main/plugins/stitch-utilities/skills/design-md/SKILL.md> |

## 3. 유보·주의 (caveats)

(1) 스펙은 version `alpha` 로 README 가 변경을 예고하며, spec.md 최종 변경은 2026-07-27, 저장소 최근 push 2026-09-14 — 본 보고는 2026-09-22 기준이다. (2) stitch.withgoogle.com 문서 페이지는 클라이언트 렌더 (cross-origin iframe) 라 curl/WebFetch 로는 본문을 못 읽고 Chrome 렌더 스크린샷으로 판독했다; Stitch 앱 UI 경로 (Settings → Design System → Import/Export) 는 제3자 가이드 서술뿐이다. (3) 다중 테마 관련 문법은 전부 미병합 PR #128 의 내용이며 정식 스펙이 아니다; PR 설명의 'maintainer-endorsed' 는 독립 검증되지 않았다. (4) MCP/Stitch API 로 DESIGN.md 를 읽고 쓰는 방식 (list_projects/get_screen/designTheme 객체 등) 주장은 0-3 으로 기각됐으므로 외부 도구 경로는 stitch-skills 의 skill 문서에서 확인된 범위 (코딩 에이전트 + Stitch Design Skills 로 추출 후 업로드) 까지만 사실이다. (5) skills 층 DESIGN.md 의 세부 표기 규칙 (Tailwind 클래스 → 물리 서술 번역) 주장은 1-2 로 기각됐다. (6) 타 도구 (Figma/Framer/Webflow) 비교는 검증 주장에 없어 종합자 추정으로만 실었다. (7) 'Material 어법' 은 검증자 해석이며 스펙·문서는 Material 이라는 단어를 쓰지 않는다. (8) 3월·4월 Google 블로그는 마케팅 성격이나 날짜·저장소·라이선스 사실은 독립 확인됐다.

## 4. 열린 질문

- Stitch 제품 내부의 테마 정본은 무엇인가 — 프로젝트의 designTheme 객체 (color mode · fonts · roundness) 와 DESIGN.md 중 어느 쪽이 원본이고 어느 쪽이 파생인가 (관련 주장은 기각돼 미확정).
- Stitch 의 화면 HTML/Tailwind 생성기와 Figma export 가 DESIGN.md 의 front matter 토큰을 실제로 어떤 경로로 읽어 반영하는가 — 산문 (markdown 본문) 만 프롬프트 문맥으로 쓰는지, 토큰을 CSS 변수/Tailwind config 로 직접 변환하는지.
- PR #128 (themes / default-theme / 토큰별 mode 값) 이 언제 어떤 형태로 병합되는가, 그리고 병합 전 Stitch 사용자는 light/dark 를 별도 DESIGN.md 파일 두 개로 관리하는 것이 공식 권장인가.
- stitch-skills 의 순수 산문 DESIGN.md (design-md skill) 와 스펙 저장소의 YAML front matter 형식 사이의 정합은 어떻게 유지되는가 — Stitch 의 Upload/Import 가 front matter 없는 파일도 같은 방식으로 받아들이는가.

## 5. composition (ADR-227) 과의 대조

| 축           | Stitch DESIGN.md                                               | composition ADR-227 (`ThemesCollection`)                                                        | 판정                                         |
| ------------ | -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | -------------------------------------------- |
| 정본 위치    | 코드베이스의 파일 (agent 가 읽는 context file)                 | 문서 (`CompositionDocument.themes`) — IndexedDB · export JSON                                   | 다름 — 우리는 문서 소유, Stitch 는 파일 교환 |
| 다중 테마    | 없음 (파일당 1, PR #128 제안)                                  | `{ active, items, order }` — 항목 = preset 4 값 + 델타 tokens, 활성 전환 1회 설치               | **우리가 앞서 있음**                         |
| light/dark   | 파일 단위 (PR #128 은 토큰별 `{light, dark}`)                  | preset `darkMode` 하나 · 이중 델타는 유보 (breakdown §6)                                        | 같은 미결 — PR #128 문법이 재개 시 참고      |
| 토큰 참조    | `{colors.primary}` (DTCG)                                      | `{color.accent}` TokenRef (D3 rule ↔ token 분리)                                                | 동형 — 어댑터가 얇다                         |
| 색 역할 어휘 | 예시는 MD3 47 역할 (surface-container-* · primary-fixed-dim …) | semantic 토큰 (`{color.accent}` · `-subtle` · `-hover` 파생 · status 4 · named hue)             | 매핑 표가 어댑터의 본체                      |
| 상태 변형    | `button-primary-hover` 별도 키 (agent 가 종합)                 | rule 이 hover/pressed 를 `color-mix` 파생 + 테마 명시 슬롯 (ADR-227 P2) · 상태 origin (ADR-230) | 우리 쪽이 구조적                             |
| 용도 산문    | 본문 산문이 색의 **용도** 를 적고 agent/linter 가 WCAG 검증    | 없음 — 토큰은 값만                                                                              | 차용 후보 (AI 패널 문맥)                     |
| border 폭    | 스키마에 없음 (`components` 안 리터럴)                         | `{border.width.none\|thin\|thick}` 테마 축 (P3)                                                 | 우리 쪽이 있음                               |
| size/density | `spacing` 토큰 (값만)                                          | 테마 축 아님 (유보) — catalog sizes                                                             | 둘 다 테마 밖                                |

**차용 후보 (제안 아님 — 기록만)**: (1) 토큰 옆 용도 산문 — Themes 패널 토큰 재정의에 `description` 한 줄, AI 패널이 읽는 맥락. (2) DESIGN.md import/export 어댑터 — front matter `colors`(MD3 역할) → semantic 토큰 매핑 표 + `typography`/`rounded` → `baseTypography`/`radiusScale` 델타; 산문 절은 무시. (3) PR #128 의 토큰별 `{light, dark}` 는 §6 "light/dark 이중 델타" 재개 시 문법 참고. 셋 다 새 ADR 이 필요하며 ADR-227 범위 밖.

## 6. 출처

| 출처                                                                                                                                   | 품질      | 검색 각도                                |
| -------------------------------------------------------------------------------------------------------------------------------------- | --------- | ---------------------------------------- |
| <https://blog.google/innovation-and-ai/models-and-research/google-labs/stitch-ai-ui-design/>                                           | primary   | 공식 발표·문서 (1차 출처·시점)           |
| <https://stitch.withgoogle.com/docs/design-md/overview>                                                                                | primary   | 공식 발표·문서 (1차 출처·시점)           |
| <https://github.com/google-labs-code/design.md/blob/main/docs/spec.md>                                                                 | primary   | 파일 형식·스키마·토큰 표기 (실사용 예시) |
| <https://github.com/google-labs-code/design.md/blob/main/examples/atmospheric-glass/DESIGN.md>                                         | primary   | 파일 형식·스키마·토큰 표기 (실사용 예시) |
| <https://github.com/google-labs-code/design.md/pull/128>                                                                               | primary   | 파일 형식·스키마·토큰 표기 (실사용 예시) |
| <https://github.com/google-labs-code/stitch-skills/blob/main/plugins/stitch-utilities/skills/design-md/SKILL.md>                       | primary   | 파일 형식·스키마·토큰 표기 (실사용 예시) |
| <https://github.com/google-labs-code/design.md>                                                                                        | primary   | Stitch 내부 워크플로·코드 export 반영    |
| <https://blog.google/innovation-and-ai/models-and-research/google-labs/stitch-design-md/>                                              | primary   | Stitch 내부 워크플로·코드 export 반영    |
| <https://dev.to/shanmukhavenkatasai/stop-letting-ai-ruin-your-ui-how-to-master-google-stitch-designmd-14p9>                            | blog      | Stitch 내부 워크플로·코드 export 반영    |
| <https://raw.githubusercontent.com/google-labs-code/stitch-skills/main/plugins/stitch-design/skills/manage-design-system/SKILL.md>     | primary   | MCP·API·agent skills 통합 (개발자 관점)  |
| <https://github.com/google-labs-code/stitch-skills>                                                                                    | primary   | MCP·API·agent skills 통합 (개발자 관점)  |
| <https://github.com/google-labs-code/stitch-skills/tree/main/plugins/stitch-utilities/skills/design-md>                                | primary   | MCP·API·agent skills 통합 (개발자 관점)  |
| <https://github.com/gemini-cli-extensions/stitch>                                                                                      | primary   | MCP·API·agent skills 통합 (개발자 관점)  |
| <https://codelabs.developers.google.com/design-to-code-with-antigravity-stitch>                                                        | primary   | MCP·API·agent skills 통합 (개발자 관점)  |
| <https://sotaaz.com/post/stitch-mcp-api-en>                                                                                            | blog      | MCP·API·agent skills 통합 (개발자 관점)  |
| <https://www.atlassian.com/blog/how-we-build/atlassians-design-md-is-here-what-we-learned-testing-portable-design-context-in-practice> | secondary | 경쟁 도구 비교·한계 (비판적 관점)        |
| <https://designmd.app/blog/design-tokens-vs-design-md/>                                                                                | blog      | 경쟁 도구 비교·한계 (비판적 관점)        |
| <https://www.designwhine.com/what-the-hell-is-google-stitchs-design-md/>                                                               | blog      | 경쟁 도구 비교·한계 (비판적 관점)        |
| <https://andoor.co/en/blog/stitch-design-is-weak/>                                                                                     | blog      | 경쟁 도구 비교·한계 (비판적 관점)        |
| <https://www.nxcode.io/resources/news/google-stitch-vs-figma-ai-design-comparison-2026>                                                | blog      | 경쟁 도구 비교·한계 (비판적 관점)        |
| <https://www.figma.com/resource-library/design-tokens/>                                                                                | primary   | 경쟁 도구 비교·한계 (비판적 관점)        |

통계: 각도 5 · fetch 21 · 주장 105 → 검증 25 (확정 22 · 기각 3) → 종합 11 · agent 호출 103.
