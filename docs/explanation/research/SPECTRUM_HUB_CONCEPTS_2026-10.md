# Spectrum Hub 개념 정리 (2026-10)

> 출처: spectrum.adobe.com (Spectrum Hub Release 1.0, 2026-09-30 공개) — 2026-10-30 에 sitemap 의 URL 전체를 받아 `.md` 판을 읽었다. 레퍼런스 수집 문서다. composition 설계 제안은 담지 않는다.

## 범위와 방법

- sitemap URL 221 개 중 `/web/*` 컴포넌트 89 개는 제외했다. 컴포넌트 지침 (Anatomy · States · Behaviors · Usage guidelines · Content standards · i18n) 은 Hub 가 fragment 로 불러오는데, 같은 문장이 design-data MCP `design-data-component <id>` 의 `documentBlocks` 에 있다 (button 으로 대조). 로컬 `react-spectrum` skill 의 컴포넌트 문서는 React API 문서라 이 지침과 다르다.
- 나머지 132 개 중 `.md` 가 있는 129 개를 받아 표 테두리를 걷어냈다. `/docs/*` (사이트 저작용 block · pattern 견본) · `/img` · `/mobile` 견본은 Spectrum 개념이 아니라 뺐다.
- 본문이 있는 페이지는 약 50 개 (580KB) 다. 네 묶음 (A~D) 으로 나눠 끝까지 읽고 정리했다. 수치는 원문 grep 으로 표본 대조했다 (header 56px · side nav overlay 768px · radius 4/8/10/16 · border 1/2/4 · shadow opacity · font-size 1.125 scale · background layer 표 · illustration 48/96/160 · selected `gray-800` · 320px · 초당 3회).
- 같은 내용이 design-data MCP `design-data-guideline-list` 58 개 slug 로도 있다 (foundations · content · support). 이 문서는 그 데이터의 읽기용 요약이다.

## 정보 구조에서 알아둘 것

- 정식 경로는 `/getting-started/*` · `/foundations/{behavior,color,typography,layout-and-structure,app-frame,styles,icons-and-illustrations,inclusivity,design-data}/*` · `/content/*` 다.
- 옛 트리 `/foundations/{system,visual-language,composition,content-design,getting-started,support}/*` 는 대부분 제목만 있는 빈 페이지다. 예외: `composition/attention-hierarchy` · `composition/object-styles` · `visual-language/{brand,illustration}` (사내판 — Slack · Workfront 안내가 더 붙음).
- 비어 있는 정식 페이지: `behavior/feedback` · `behavior/interaction` · `inclusivity/{assistive,movement,visual}` · `getting-started/for-designers` · `for-developers`.
- 이미지 alt 에만 있는 값 (hue × 16 단계 hex · gray 대비 차트 · 앱별 브랜드 색 · Express hex) 은 수치 원본이 아니다. 값은 설치된 S2 · design-data 토큰과 대조한다.

## 개념 지도 — 여러 페이지를 가로지르는 축

| 축                  | 정의                                                                                                                                                            | 나오는 곳                                                                                           |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| 원칙 4              | Rational · Human · Focused · Collaborative — voice 는 앞의 셋을 문구에 적용                                                                                     | A §2 · D §1                                                                                         |
| Attention hierarchy | 타이포 위계를 UI 전체로 넓힌 S2 핵심 개념. 페이지당 high attention 은 요소 (그룹) 하나                                                                          | C §1 · A §5 selected · B §10 gradient illustration · C §3 header CTA 1개 · C §4 emphasized 그룹 1개 |
| 강조 수단의 순서    | 배경: spacing < background < emphasized background < gradient · container: spacing < border < background < emphasized (shadow) · 버튼: 회색 < 검정 < accent     | C §3-3 · C §4-2 · C §1-3                                                                            |
| 토큰 3 tier         | Primitive (global) → Semantic → Component-specific, 이름은 broad → specific (meaning · structure · property · 방향 · state · option)                            | A §3                                                                                                |
| Reusable structures | Base · Accessory · Group · List · Container · Banner — 간격 토큰 범주이자 density 적용 단위 (collections = gap, containers = padding)                           | A §3-6 · C §5-4                                                                                     |
| Scale               | 타이포 Major Second 1.125 (`font-size-25` 10px ~ `1500` 73px) · rounding 도 같은 scale · layout spacing 은 geometric (`spacing-25` 1px ~ `1000` 96px)           | B §5 · C §5 · C §6                                                                                  |
| 색                  | Leonardo 생성 (key color + 목표 대비) · gray 25~1000 용도 대역 · background layer (elevated / layer 2 / layer 1 / pasteboard, base = gray-25) · dark theme 하나 | B §1~3                                                                                              |
| 상태                | default → hover → down → keyboard focus 는 색으로, down 은 일부 scale down. disabled · selected · dragged 는 option                                             | A §5                                                                                                |
| 접근성 하한         | 텍스트 4.5:1 · active non-text 3:1 · 색만으로 의미 전달 금지 · 320px · 깜빡임 초당 3회 미만 · forced colors                                                     | B §2 · A §6                                                                                         |
| 문구                | sentence case · 2인칭 · 단순 시제 · 버튼·제목 마침표 없음 · 오류 = 무슨 일 / 원인 / 해결 · 기본 tone Instructive                                                | D 전체                                                                                              |

---

## A. 개요 · 원칙 · design tokens · 동작 · inclusivity · AI 자원

### 0. 빈 페이지 (제목만 있음, 확인 완료)

다음 페이지는 본문 없이 `# 제목` 한 줄만 있습니다.

- `getting-started_for-designers.md` (For designers), `getting-started_for-developers.md` (For developers)
- `foundations_behavior_feedback.md` (Feedback), `foundations_behavior_interaction.md` (Interaction)
- `foundations_inclusivity_assistive.md` (Assistive), `_movement.md` (Movement), `_visual.md` (Visual)
- `foundations_system_elevation.md` · `_layout.md` · `_spacing.md` · `_theming.md` · `_tokens.md`
- `foundations_visual-language_color.md` · `_expression.md` · `_iconography.md`

**주의**: `foundations/system/tokens` 페이지는 비어 있습니다. 토큰 정보는 `foundations/design-data/design-tokens` 한 페이지에만 있습니다.

---

### 1. Hub 구성 · 개요 (index / introduction / whats-new / contact-us)

#### index.md — "Start with Spectrum"

- 정의: "Spectrum is the system behind Adobe experiences, a shared language for turning ideas into products."
- **One system, built for every platform**: Hub는 제품 팀이 쓰는 언어(플랫폼)별로 구역을 나눕니다.
  - **React**와 **Web Components** 구역은 beta로 공개됐습니다.
  - **iOS, Android** 등은 "coming soon"입니다.
- **Build with Spectrum**: 컴포넌트만이 아니라 "foundations, tokens, patterns, and guidance"를 함께 제공합니다. 대상은 Spectrum 컴포넌트를 쓰는 경우와 custom을 만드는 경우 모두입니다.
- **Explore components in context**: 컴포넌트 페이지마다 interactive playground가 있습니다.
  - playground는 "connected to Spectrum's repositories"이며, 실제 컴포넌트 데이터를 문서로 가져옵니다.
  - 예시 블록: `Playground | implementation rsp | component button`
- 링크: 첫 진입점은 `/foundations/attention-hierarchy`, 컴포넌트 목록은 `/web/rsp/components/accordion`입니다.

#### getting-started_introduction.md

- "Spectrum is Adobe's design system": 디자인과 엔지니어링이 공유하는 공통 언어입니다.
- **Spectrum 2**는 "more approachable, expressive, and adaptable"을 지향합니다.
  - 새 foundations 영역: color, typography, layout, icons, states, components.
- 진화 경로: web에서 시작해 native mobile·desktop으로 넓혀 가며, "one connected system"을 목표로 합니다.
- 그림 설명: action button("Edit" + 연필 아이콘)이 디자인 언어 갱신을 거치며 바뀌었습니다.
  - 모서리가 더 둥글어졌습니다.
  - 라벨이 더 굵어졌습니다.
  - 배경이 white에서 grey로 바뀌었습니다.

#### getting-started_whats-new.md

- **Release 1.0 — September 30, 2026**: "A new home for Spectrum".
- Available now:
  - Foundations and content guidance
  - Component design and implementation guidance (React Spectrum과 Spectrum Web Components 자원 포함)
  - Live component playgrounds
  - Support
- What's next: mobile 문서, unified experience guidance, patterns and principles, 새로운 탐색 방식.

#### support_contact-us.md

- 일반 문의·피드백·버그 신고는 `spectrum@adobe.com`으로 보냅니다.
- 메타 태그: Slack, Jira, Figma, CCUE, DXUE, Brand, Icons. 본문은 이메일 안내뿐입니다.

---

### 2. 원칙 (getting-started_principles.md)

원칙은 네 가지입니다: **rational, human, focused, collaborative**. 시각·인터랙션 디자인뿐 아니라 engineering, writing, strategy에도 적용됩니다.

원칙을 쓰는 방식은 세 가지입니다.

1. The ideas on which Spectrum is built
2. The considerations for building products at Adobe
3. The criteria for validating decisions

| 원칙              | 정의 (원문 요지)                                                                                                                                                                                                           |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Rational**      | 실제 상황에 기반합니다. 모든 component·pattern·principle은 환경·애플리케이션·요구 범위를 고려해 만듭니다. "not a rigid set of rules"이며, 경험을 "contextual, cohesive, and performant"하게 만드는 적응 가능한 자원입니다. |
| **Human**         | 사람의 요구를 우선합니다. inclusivity, accessibility, honesty, respect의 높은 기준을 지킵니다. 사용자 기대·플랫폼 요구·제품 비전에 맞게 적응하며, "utility and joy"의 균형을 잡습니다.                                     |
| **Focused**       | "delivers what's needed, when it's needed"입니다. 모든 장식은 목적이 있고 모든 소통 접점은 관련성이 있습니다. 높은 품질 기준과 디테일을 지키며, 기능과 표현의 균형을 맞춥니다.                                             |
| **Collaborative** | "Spectrum belongs to everyone"입니다. 결정은 신중하고 총체적이며 집단적으로 내립니다. "examines from multiple angles, then refines, then repeats. Constantly."                                                             |

---

### 3. Design tokens (foundations_design-data_design-tokens.md)

#### 3-1. 정의와 목적

- 정의: "a methodology for expressing reusable design decisions as structured data".
- 다루는 결정: color, spacing, typography, motion, sizing 등.
- 예: `accent-content-color-default` = "Use this value when text content should be accentuated". 그림 값은 `#3B63FB`입니다.
- 쓰는 이유: alignment, automation, learnability, multi-platform fidelity.

#### 3-2. 토큰 원칙 세 가지

- **Clear**: 범위·목적·의미가 잘 정의된 상태에서 만듭니다.
- **Systematic**: 디자인과 개발 자원을 아우르는 구조화된 체계로 정의하고 관리합니다.
- **Learnable**: 문서·가이드·교육 자원으로 뒷받침합니다.

#### 3-3. 시스템 방침

- **"focuses on reusable decisions"**: 모든 디자인 시나리오를 토큰으로 표현하지 않습니다.
- **"prioritizes semantic design decisions over direct values"**: 구현 세부 대신 의도를 표현합니다.
- 계층 그림(동심 반원): 안쪽부터 Tokens → Platform components → Products.
- 토큰은 시스템의 일부일 뿐입니다. component library, 구현 프레임워크, 문서와 함께 작동합니다.

#### 3-4. 용어

- **Token**: 구조화된 데이터로 표현한 재사용 디자인 결정입니다. name + value로 이루어집니다.
  - JSON 그림에는 `accent-content-color-default`의 schema reference, value `{accent-color-900}`, UUID가 보입니다.
- **Token name**: 디자인 use case의 구조화된 분류입니다. Spectrum의 **token taxonomy**(categories, terminology, ordering)로 만듭니다.
  - 그림 예: `blue-900` = rgb(59, 99, 251), `base-padding-vertical-large` = 10px, `sans-serif-font-family` = "Adobe Clean Spectrum VF".
- **Value**: 최종 값(color, dimension, percentage, duration)이거나, context 의존값(light/dark theme)이거나, 다른 토큰에 대한 alias 참조입니다.

| Token name                 | Value              |
| -------------------------- | ------------------ |
| `blue-900`                 | `rgb(59, 99, 251)` |
| `spacing-100`              | `8px`              |
| `container-padding-medium` | `spacing-300`      |

- **Alias**: 최종 값 대신 다른 토큰을 참조하는 토큰입니다. 층마다 맥락을 더하지만 값은 다시 정의하지 않습니다.
  - 표 예: `accent-content-color-default` → `accent-color-900`
  - 그림 체인: `blue-900`(#3B63FB) → `accent-color-900` → `accent-content-color-default`

#### 3-5. 토큰 tier (분류 체계)

원문의 tier는 **Primitive (aka Global) / Semantic / Component-specific** 세 가지입니다. "alias"는 tier가 아니라 참조 방식으로 설명됩니다.

| Tier                       | 정의                                                                                                                                                                                                           | 원문 예시                                                                                                          |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| **Primitive (aka Global)** | 디자인 언어에서 쓸 수 있는 값을 정의합니다. 원시 값이며 용도 정보는 거의 없습니다. 보통 semantic 토큰의 alias를 거쳐 간접적으로 씁니다.                                                                        | `blue-800`, `gray-100`, `corner-radius-75` (그림: `blue-900`, `spacing-400`)                                       |
| **Semantic**               | 결정이 어떻게 쓰이는지 정의합니다. purpose, intent, structure, application을 전달합니다. **Why / Where / How it relates**를 알려 주며, "the primary way consumers interact with Spectrum design tokens"입니다. | `accent-background-color-default`, `negative-content-color-default`, `container-padding-medium`, `group-gap-small` |
| **Component-specific**     | 특정 컴포넌트·구현에 한정된 결정입니다. semantic 우선 방침 때문에 역할이 "much smaller"입니다. Spectrum 안에도, 개별 플랫폼 구현에도 있을 수 있습니다.                                                         | `tooltip-maximum-width`, `divider-thickness-small` (그림: `tab-gap-horizontal-medium`)                             |

`accent-content-color-default` 하나가 쓰이는 곳(그림): radio label, checkbox label, switch label, hyperlink, menu item checkmark.

#### 3-6. 인터페이스 구성 두 축 — Meaning과 Reusable structures

- **Meaning**: status, emphasis, importance, feedback을 전달하는 결정입니다.
  - 예: `accent-background-color-default`, `negative-border-color-default`, `negative-content-color-default`, `positive-background-color-default`
  - 그림 분류: Positive / Negative / Informative
- **Reusable structures**: 컴포넌트가 어떻게 "organized and constructed"되는지 정하는 결정입니다.
  - 예: `container-padding-medium`, `group-gap-small`, `base-padding-vertical-large`, `banner-gap-horizontal`
  - structure는 특정 컴포넌트나 구현 타입이 아닌 추상 패턴입니다. "Where does this design decision apply?"에 답합니다.

| Structure | Description                                            |
| --------- | ------------------------------------------------------ |
| Base      | The primary functional element within a structure      |
| Accessory | A supporting element associated with another structure |
| Group     | A collection of related elements                       |
| List      | A sequence of repeated items                           |
| Container | A structure that organizes content                     |
| Banner    | A structure used for prominent messaging               |

- 그림 예: toast에 `positive-background-color-default`를 쓰고, 여백 토큰 `banner-padding-vertical`, `banner-padding-horizontal`, `banner-padding-horizontal-compact`, `banner-gap-horizontal`을 씁니다.
- **Components as compositions**: 컴포넌트는 reusable structure 여러 개를 조합해 만듭니다.
  - 그림: Base + List item structure → composition → "Menu item" 컴포넌트.
  - 플랫폼 구현은 여기에 플랫폼 고유 요구, 인터랙션, 접근성, 제약을 더합니다.

#### 3-7. 이름 규칙 (Reading token names)

- 왼쪽에서 오른쪽으로 읽으며 **broad → specific** 순서로 맥락이 좁아집니다.
- 원문은 "naming structure"라는 이름의 정식 문법표를 두지 않았습니다. 대신 아래 세 예시로 각 부분의 역할을 설명합니다.

| 토큰                            | 부분별 역할                                                                                                                                                                                             |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `positive-color-600`            | `positive` = what's being communicated, `600` = which option is used                                                                                                                                    |
| `accent-background-color-hover` | `accent` = what's communicated, `background-color` = what it affects, `hover` = when it applies (accent 요소를 hover했을 때의 배경색)                                                                   |
| `base-padding-vertical-small`   | `base` = where it's applied, `padding` = what it affects, `vertical` = how it's applied, `small` = which option is used (base structure에 쓰는 여백. 예: Action button, Text field, List item contents) |

예시에서 뽑은 부분 종류는 다섯 가지입니다.

- 무엇을 전달하는가 (meaning)
- 어디에 적용하는가 (structure)
- 무엇에 영향을 주는가 (property)
- 어떻게 적용하는가 (방향)
- 언제 적용하는가 (state)
- 어떤 option인가 (scale·size)

#### 3-8. Using tokens — Do/Don't (원문 단위)

- **Do — Start with Spectrum components**: 가능하면 플랫폼의 Spectrum 컴포넌트를 먼저 쓰고, 토큰을 직접 다루는 것은 그다음입니다. 컴포넌트가 맞지 않을 때 토큰으로 extend, compose, create합니다.
- **Do — Prioritize semantic tokens**: 툴바 배경에 `background-layer-2-color`를 씁니다.
  **Don't**: 같은 자리에 primitive `gray-25`를 씁니다.
- **Do — Use primitive tokens only when necessary**: 적절한 semantic 결정이 없을 때만 씁니다. 예: Upgrade 버튼에 `static-fuchsia-900`.
- **Do — Use component-specific tokens only for their intended component**: `tab-gap-horizontal-medium`를 원래 컴포넌트에 씁니다.
  **Don't**: 같은 토큰을 카드 두 개 사이 간격에 범용으로 재사용합니다.

#### 3-9. 플랫폼 적응 · 배포

- **Foundational tokens**: Spectrum의 공통 언어입니다. "source of truth across products, platforms, and implementations".
- **Platform tokens**: 특정 플랫폼 구현의 고유 요구를 지원합니다.
- **Shared language, flexible implementation**:
  - 모든 플랫폼이 모든 foundational 토큰을 필요로 하지는 않습니다.
  - sizing, density, theming, 플랫폼 능력 차이 때문에 플랫폼마다 값이 다를 수 있습니다.
  - 그래도 taxonomy, terminology, 디자인 언어는 같습니다.
  - "Design data can be re-shaped to fit platform needs while maintaining system cohesion."
- **배포 형식, 빌드 도구, 버전 번호는 원문에 없습니다.** Resources에는 `https://github.com/adobe/spectrum-design-data` 링크 하나만 있습니다.

---

### 4. Motion (foundations_behavior_motion.md)

- **"Motion in Spectrum 2 is still being developed."** Adobe 내부 working group이 작업 중입니다.
- **duration, easing 값, motion 토큰 이름은 원문에 하나도 없습니다.** 값은 이 문서로 맞출 수 없습니다.

#### 4-1. 개요

- Spectrum 1의 원칙을 이어받습니다: "always purposeful, intuitive, and seamless".
- Spectrum 2에서는 personality를 더할 곳에 주의를 끄는 데도 motion을 씁니다. 어떤 경우든 의미를 더해야 합니다.
- **"motion over large surface areas needs to support browser and system settings for reduced motion."**
- motion은 brand expression이기도 합니다. 어조는 formal/direct부터 lighthearted/subtle까지 걸쳐 있습니다.
- 분류: **directional / interaction / wayfinding**. wayfinding은 아직 개발 중입니다.

#### 4-2. Directional motion

- **Linear**: 앞으로 나아감과 진행을 뜻합니다.
  - 예 1: Progress bar는 determinate 진행을 보여 줍니다.
  - 예 2: "Next" 버튼의 오른쪽 화살표가 hover 때 직선으로 움직입니다. 이 motion 버튼은 **"sparingly, only on the most important action(s) on a page"** 에만 씁니다.
  - custom 애니메이션은 RTL과 문화권별 의미 차이를 고려해야 합니다.
- **Diagonal**: 더 큰 이동이며 disruptive할 수 있습니다. context 전환(외부 view·destination으로 이동)을 강조합니다.
  - 예: 링크의 우상향 화살표가 hover 때 대각선으로 움직입니다. "sparingly, and only to communicate that there will be a switch in context".
- **Clockwise**: 반복되는 대기 상태이며 진행 방향이 분명하지 않습니다. 주로 loading indicator에 씁니다.
  - Progress circle은 indeterminate 진행에 씁니다.

#### 4-3. Interaction motion

- 사용자 동작이 시스템에 등록됐다는 feedback을 줍니다. 유일한 feedback 수단은 아니지만 대상을 dynamic하고 responsive하게 느끼게 합니다.
- microinteraction은 단일 동작(click, tap, swipe)이 trigger하는 반응입니다. Spectrum 2에서는 제품 브랜딩을 드러내는 personality 순간입니다.
- 예: 버튼이 **down state에서 scale down**합니다.

---

### 5. States (foundations_behavior_states.md)

- **"A change in color is the primary way that a state is communicated."**
- 사용자가 일으키는 상태는 색의 표준 진행을 따릅니다: **default → hover → down → keyboard focus**.
- **disabled, selected, dragged** 상태는 스타일이 조금 갱신됐으며, 모두 "component options"입니다.
- 그림: 버튼 네 개가 **default, hover, pending, disabled** 상태를 보여 줍니다. pending은 본문에서 따로 정의하지 않습니다.
- **상태 간 우선순위는 원문에 없습니다.**

| 상태     | 정의 · 시각 표현                                                                                                                                                                                                                                                                                               |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Down     | Spectrum 2에서는 일부 컴포넌트가 색 대신 **크기 변화**로 down을 표현합니다. 눌려 들어가는 느낌을 줍니다.                                                                                                                                                                                                       |
| Disabled | 대체로 Spectrum 1과 같고, 일부 컴포넌트만 바뀌었습니다. 예: text field는 disabled에서도 **outline 스타일을 유지**해 default와 비슷하게 보입니다.                                                                                                                                                               |
| Selected | 기본은 primary 스타일이며 대개 **`gray-800` fill**입니다. 일부는 accent color option이 있습니다. accent는 범위가 좁은 목표(예: dialog)나 페이지의 단일 CTA(예: "Create")에서 강조할 때 씁니다. 같은 비중의 컨트롤 그룹이 많은 곳(예: panel)은 **not emphasized option**이 맞습니다. 참조: Attention hierarchy. |
| Dragged  | 끌고 있는 대상에 주의를 끌기 위한 **고유 drop shadow**를 씁니다. 참조: `/foundations/styles/object-styles/drop-shadow`.                                                                                                                                                                                        |

---

### 6. Inclusive design (foundations_inclusivity_inclusive-design.md)

#### 6-1. Best practices

- **Assume nothing is perfect**
  - context-sensitive help를 제공합니다.
  - 오류를 가능한 한 예방하고, 생기면 강조해 보여 줍니다.
  - 해결 방법을 명확한 메시지로 안내합니다.
- **Make room to adapt**
  - 보고 조작하기에 충분히 큰 target을 둡니다.
  - 모든 객체에 label과 description을 붙입니다.
  - mouse, keyboard, pen, fingertips, voice, accessibility API 등으로 조작할 수 있어야 합니다.
  - 웹은 responsive로 만들고 **"Accommodate web page size down to 320 px."**
- **Give people a choice**
  - 사용자 맞춤을 허용합니다.
  - 시스템 설정(captions, large fonts, high contrast)을 존중합니다.
  - 모든 작업을 keyboard만으로 논리적 순서에 따라 끝낼 수 있어야 합니다.
- **Avoid distractions**
  - 문단 근처에 animation을 두지 않습니다.
  - 불필요한 animation을 끌 수 있게 합니다.
- **Be consistent**
  - 정의된 작업에는 custom 대신 공통 컴포넌트와 패턴을 씁니다.
  - 공통 단축키를 씁니다.
- **Involve marginalized users**
  - 다양한 능력을 가진 사람을 user testing과 co-design에 참여시킵니다.
- **Make documentation a priority**
  - 접근성 기능(단축키, OS 기능 지원)을 문서화하고 help에서 쉽게 찾을 수 있게 합니다.

#### 6-2. Checkpoints (Do/Don't 원문 단위)

- **Structure**
  - Do: list, form, panel 같은 복합 컴포넌트에 논리적 reading order와 tab order를 둡니다. 예: 가입 form의 Name → Email → Password 순서, 각 필드에 helper text.
  - Don't: 순서가 Email → Password → Name이고, label 없이 placeholder만 있는 form.
- **Color**
  - Do: 객체를 색이나 위치만으로 부르지 않고 이름이나 그룹으로 부릅니다. 예: "Select Delete to delete…".
  - Don't: "Click the red button to the right…".
- **High contrast mode in Windows**
  - 모든 Adobe 웹·Windows 앱은 이를 지원해야 합니다.
  - 컴포넌트 문서는 기본 Windows high contrast black theme 기준으로 예시를 보여 줍니다.
  - 그림의 역할 6개: black background, yellow hyperlink, green disabled text, cyan selected text, cyan outline의 white button, white body text.
- **Animation**
  - 화면 일부가 **초당 3회를 넘게 깜빡이면 안 됩니다** (광과민성 발작 예방).
  - 움직이거나 깜빡이는 콘텐츠는 "a couple of seconds"를 넘기지 않습니다.
- **Interactions**
  - form에 "clear"/"reset" action을 피합니다.
  - form을 저장했다가 나중에 다시 올 수 있게 합니다.
  - 링크 앞이나 안에 keyword를 둡니다.
- **Text alternatives**
  - Do: 모든 요소에 텍스트 label을 둡니다. 예외는 맥락이 충분한 경우(예: zoom "100%")입니다.
  - 가능하면 HTML label을, 안 되면 `aria-label` / `aria-labelledby`를 씁니다.
  - 표·목록 안 객체는 주변 구조(table header)로 식별할 수 있어야 합니다.
  - 이미지에는 짧고 의미 있는 대체 텍스트를 붙입니다. 장식용은 WCAG 2.1 Guideline 1.1에 따라 예외입니다.
  - tooltip이나 coach mark처럼 추가 정보가 필요한 객체는 long description을 둡니다.
  - 그림: icon button에 "Settings" tooltip.
  - Don't: label 없는 text field.
- **Fonts and text**
  - Do: Spectrum typography와 color를 씁니다.
  - 한 페이지에 한 column을 쓰고, 폭은 **80자(CJK 40자) 이하**로 합니다.
  - 줄 길이는 **최대 50–75자**입니다.
  - 본문은 왼쪽 정렬입니다 (RTL에서는 UI와 함께 미러링).
  - 한 view 안에서 정렬을 바꾸지 않습니다.
  - 글자 크기, color theme, contrast를 조절할 수 있는 option을 제공합니다.
  - Don't: 양쪽 정렬(justify). text river가 생겨 난독증 독자가 읽기 어렵습니다.
- **Error prevention and correction**
  - Do: 오류가 생기지 않는 흐름을 설계합니다.
  - 오류는 해당 필드에 연결하고, 다른 메시지와 시각적·의미적으로 구분합니다 (icon, color, placement).
  - 충분한 click/touch 영역과 간격을 둡니다.
  - 검색어 철자 오류와 여러 철자를 수용합니다.
  - 그림: 빨간 outline, 필드 안 경고 아이콘, "Enter a valid email address."
  - Don't 그림은 Text alternatives와 같은 이미지(label 없는 필드)를 다시 썼습니다.
- **Keyboard equivalents**
  - Spectrum 컴포넌트에 정의된 built-in keyboard focus state를 씁니다.
  - mobile(iPad Smart Keyboard)을 포함해 keyboard로 모든 동작을 할 수 있어야 합니다.
  - Tab 순서를 정합니다. 그림은 파란 focus outline입니다.

---

### 7. Internationalization (foundations_inclusivity_internationalization.md)

#### 7-1. Text expansion

- 번역문은 원문보다 **최대 300%** 길어질 수 있습니다.
- 근거: IBM Globalization Guidelines, W3 기사.

| Characters | Max. estimated expansion | Likely mapping to       |
| ---------- | ------------------------ | ----------------------- |
| Up to 10   | 300%                     | Buttons, pickers, tabs  |
| 11 to 20   | 200%                     | Labels, input fields    |
| 21 to 30   | 180%                     | Large headers           |
| 31 to 50   | 160%                     | Small headers, tooltips |
| 51 to 70   | 140%                     | Short paragraphs        |
| 70+        | 130%                     | Longer paragraphs       |

- 그림 설명:
  - 버튼 "View"(4자)는 300%입니다.
  - tooltip "Copy link"(9자)는 200%라고 적혀 있습니다.
  - page title "Build your photography skills, fast."(36자)는 300%라고 적혀 있습니다.
  - tooltip과 page title의 그림 설명은 위 표의 해당 구간 값(9자 → 300%, 36자 → 160%)과 맞지 않습니다. 원문 그대로 옮겼습니다.
- Localization-ready design: 길이와 성격이 다른 텍스트를 받아내는 layout을 만듭니다.

#### 7-2. 아이콘 · 은유

- **Correct or incorrect**: 체크와 X는 서양의 긍정 기호입니다. 일본에서는 주로 "틀림"을 뜻하고, 긍정은 "O"로 표시합니다.
- **Artifacts**: 우체통처럼 나라마다 모양이 다른 사물이 있습니다. 북미식 우체통 아이콘은 다른 나라에서 잘 통하지 않습니다.
- **Hands and animals**: 손동작(엄지 업·다운 포함)은 일부 나라에서 불쾌하게 읽힐 수 있습니다. 부엉이는 미국에서 지혜를 뜻하지만 일부 아시아에서는 반대 의미입니다.
- **Embedded text**: 아이콘·일러스트·이미지 안에 텍스트를 넣지 않습니다. 대안으로 실제 텍스트 대신 **선(lines)** 을 씁니다.

#### 7-3. Imagery

- **People and portraits**: 지역에 맞는 복장을 씁니다. 리터칭 관행(중국·한국의 skin smoothing)과 노출 정도도 지역마다 다릅니다. 미국의 인물이 다른 지역에서는 낯설 수 있습니다.
- **Religion and politics**: 종교 상징, 손동작, 정치 이미지를 피합니다. 예: 티베트 승려 사진.
- **Seasonal content**: Thanksgiving은 아시아에서 의미가 없거나 다르게 해석됩니다. 일본의 Valentine's day는 역할이 반대입니다.
- **Traditions and manners**: 예: 태국에서는 발바닥을 보이는 사진이 부적절합니다.

#### 7-4. Colors

- 색의 의미는 문화에 따라 다릅니다.
  - 미국·유럽 금융 UI: green = 좋음, red = 나쁨. 중국·일본은 반대입니다.
  - red: 서양에서는 오류·위험, 동양에서는 행운·행복.
  - white: 서양에서는 순수, 중국에서는 애도.
  - purple: 일본에서는 사치·성공, 이탈리아에서는 불운.
- Best practice:
  - "no color can be assumed to have a consistent meaning across cultures".
  - **색만으로 상태를 표시하지 않고** 텍스트나 다른 시각 단서를 함께 씁니다.

#### 7-5. Typography

- 표준 서체는 **Adobe Clean**이며 폭넓은 언어를 지원합니다.
- **Readability across languages**: 중국어·일본어·태국어는 글자가 복잡하고 대개 약간 더 큽니다.
  - 문단 line-height를 키워 줄 사이 여유를 둡니다.
  - 필요하면 글자 간격도 늘립니다.
  - 그 결과 너비와 높이가 달라집니다.
- **Content volume expectation**: 일본 사용자는 북미보다 더 많은 내용과 세부를 선호합니다. 추가 콘텐츠를 넣을 수 있는 modular design을 권장합니다.
- **Emphasis**: 중국어·한국어·일본어는 oblique 글꼴이 없어 italic에 잘 기대지 않습니다. 대신 emphasis dots 같은 대안을 씁니다.
- **날짜·숫자·통화 형식은 원문에 없습니다.**

---

### 8. Bi-directionality (foundations_inclusivity_bi-directionality.md)

- 대상 언어:
  - LTR: Latin(영어, 프랑스어), Cyrillic(러시아어, 불가리아어), 중국어·일본어.
  - 중국어·일본어는 인쇄물에서는 세로쓰기(top-to-bottom, RTL)를 유지하지만 디지털에서는 주로 LTR입니다.
  - RTL("bi-directional"): Arabic 계열(Arabic, Persian, Urdu), Hebrew 계열(Hebrew, Yiddish).
- **UI mirroring**: 컴포넌트를 인터페이스의 반대편에 배치하는 과정입니다.

#### 8-1. 미러링 규칙 (원문의 Do/Don't 표시 그대로)

| 규칙                                          | 원문 표시 | 내용                                                                                        |
| --------------------------------------------- | --------- | ------------------------------------------------------------------------------------------- |
| Mirror individual components                  | docheck   | 컴포넌트와 그 구성 부품은 미러링의 영향을 받습니다. 컴포넌트별 지침은 각 페이지에 있습니다. |
| Don't mirror components that represent time   | dontcross | 시간을 나타내는 컴포넌트(예: **video player**)는 미러링하지 않습니다.                       |
| Mirror composite images with directional flow | docheck   | 방향성 흐름이나 선형 서사가 있는 합성 이미지는 **전용 bidi 버전**이 필요합니다.             |
| Mirror icons that represent movement          | docheck   | 가로 이동을 나타내는 아이콘(예: **back icon**)은 미러링합니다.                              |
| Don't mirror icons that represent time        | docheck   | 시간 경과 아이콘(예: **clock**)은 미러링하지 않습니다.                                      |
| Don't mirror checkmarks                       | docheck   | 체크마크는 **절대** 미러링하지 않습니다.                                                    |
| Don't mirror slashes                          | docheck   | 슬래시는 **절대** 미러링하지 않습니다.                                                      |

정리하면 이렇습니다.

- **뒤집는 것**: 컴포넌트 배치와 부품, 가로 이동 아이콘, 방향성 합성 이미지, 본문 정렬(Inclusive design 페이지 기준).
- **안 뒤집는 것**: 시간 표현 컴포넌트·아이콘, 체크마크, 슬래시.
- 관련 규칙: Motion 페이지도 custom 애니메이션을 만들 때 RTL을 고려하라고 합니다.

---

### 9. AI 자원 (support_ai-resource-guide.md, intelligence_skills_spectrum-web.md)

- 방침: "coordinating the offerings of our multi-platform system".
- **Cross-platform — Spectrum Design Data**: 공식 데이터셋(design tokens, component schemas, 문서와 usage guidelines)을 AI assistant에 바로 제공합니다. Agent Skill과 MCP server 두 형태로 배포합니다. 문서: `https://opensource.adobe.com/spectrum-design-data/ai/`
  - `@adobe/design-data-skill`: design data CLI를 통해 agent가 토큰·컴포넌트 스키마·시스템 데이터에 접근하게 해 줍니다. npm과 github(`spectrum-design-data/tools/design-data-skill`)가 있습니다.
  - `@adobe/design-data-mcp`: Spectrum design tokens, component schemas, design guidelines와 문서용 MCP server입니다. github: `tools/design-data-mcp`.
- **Web Platform**:
  - React Spectrum: `https://react-spectrum.adobe.com/ai`
  - Spectrum Web Components: Storybook의 "resources-build-with-ai" 문서.
- **Spectrum Web Skill**: 설치 명령은 `npx skills add OneAdobe/spectrum-2-web --skill spectrum-2-web`입니다.
  - **Build**: 관련 컴포넌트, 구현 가이드, 디자인 foundations로 Spectrum web UI를 만듭니다.
  - **Review**: 경험을 평가해 strengths, prioritized issues, recommendations를 구조화해 돌려줍니다.
- 메타 태그: AI tooling, Protopack, Design data, Figma, Claude Enterprise, Prototyping, design-to-code.

---

---

## B. 시각 언어 — 색 · 타이포 · 브랜드 · 아이콘 · 일러스트

**출처 표기 규칙**: 「(이미지 alt)」 가 붙은 값은 본문이 아니라 이미지 설명문에서 가져왔다. 이미지 자체는 내려받은 파일에 없어서 픽셀 값으로 확인하지 못했다.

---

### 0. 같은 페이지의 두 판 비교

| 쌍                                                                                                    | 차이                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ----------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `foundations_color_color.md` ↔ `foundations_color_colors.md`                                          | 본문이 사실상 같다. 차이는 셋뿐이다. 제목이 "Color" 와 "Colors" 로 다르다. `colors` 판에는 `:size-l:` · `:size-s:` 크기 표지가 붙어 있다. `colors` 판 끝에만 Metadata tags 가 있다 (color system, accessibility, WCAG contrast, Leonardo color tool, brand colors, key colors, hue ranges, contrast ratios, two-tone color pairing).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `foundations_brand.md` ↔ `foundations_visual-language_brand.md`                                       | visual-language 판(사내판으로 보인다)에만 있는 것: ① 머리말에 Slack 채널 #spectrum-bulletin · #product-branding 안내 ② App Icons Figma 라이브러리 링크 ③ Android loading screens wiki 링크 ④ "Brand team 이 desktop 용은 ICNS(Mac)·ICO(Windows), web 용은 주로 SVG 로 전달한다" 는 문단과 Brand wiki 링크 ⑤ **"Premium and Generative AI gradients"** 하위 절. 이 절은 Figma 프로토타입 embed 뿐이고 본문이 없다. ⑥ **"Usage guidelines — Request assets from the Brand team"** 절 전체. foundations 판에만 있는 것: Metadata tags.                                                                                                                                                                                                                                                                                         |
| `foundations_icons-and-illustrations_illustration.md` ↔ `foundations_visual-language_illustration.md` | visual-language 판에만 있는 것: ① "Illustration styles" 절의 굵은 글씨 문장 "If you're not sure about which style is appropriate… reach out to the Spectrum Brand team" ② **"Linear illustrations" 절이 똑같은 내용으로 두 번 반복된다** (원문 중복) ③ Color 절의 문장 "Figma library 컴포넌트는 S2 / Variables 토큰을 쓴다" ④ "Don't create your own linear/gradient illustrations" 에 붙은 Workfront 요청 문장 ⑤ Thematic banners 의 Workfront 요청 링크 ⑥ **"Resources and contact information"** 절. 이 절은 Workfront form, Slack #product-branding, 이메일 ad-brand@adobe.com, S2 / Illustrations Figma, A4U(VPN 필요) 를 안내한다. 링크 대상도 다르다. foundations 판은 Hub 내부 경로, visual-language 판은 `s2.spectrum.corp.adobe.com` · `spectrum.corp.adobe.com` 이다. foundations 판에만 Metadata tags 가 있다. |

---

### 1. Color (`foundations_color_color.md` / `colors.md`)

#### 1-1. 핵심 개념·모델

- 색 체계의 적용 범위: 색이 있는 모든 컴포넌트·텍스트·아이콘. 의미가 있는 사용과 없는 사용을 모두 포함한다. data visualization palette 에도 같은 색을 쓴다.
- 원칙 3가지:
  - **Accessible** — 모든 사용자·제품·기기·설정에서 접근 가능한 조합
  - **Scalable** — 색·gray·theme·contrast ratio 의 구조적 관계로 여러 앱·surface·mode 에서 일관되게 동작
  - **Purposeful** — 색은 위계를 만들고, 의미를 알리고, 주의를 이끈다. 불필요한 색은 피한다
- 생성 방식: **Leonardo color tool** 에 key color 로 hue·hue range 를 넣고, 색마다 target contrast ratio 를 함께 넣어 만든다. 각 색의 dark·light variant 를 UI 에 적용한다.
- Key color 원칙:
  - 대부분의 color scale 은 key color 하나로 만든 단일 hue 가 아니다.
  - Leonardo 는 gradient 양 끝에서 black·white 를 섞어 어둡게·밝게 만든다. 그래서 채도를 지키려고 key color 를 일부 추가한다.
  - 어떤 key color 는 밝기와 식별성을 지키거나 인접 색과 헷갈리지 않게 하려고 hue 자체를 옮긴다.
  - scale 이 정해지면 색마다 lightness stop 을 넣어 aliased color 를 얻는다.
- "Application of brand color" 절의 첫 문단은 "What color does" 문단을 그대로 반복한 원문 중복이다. 이어지는 하위 제목 "Brand colors may differ from Spectrum colors" 와 "Key colors (shown in hue)" 아래에는 이미지만 있다.

#### 1-2. 구체 값

| 항목                                  | 값                                                                                                                      | 출처                                                                         |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| hue 목록                              | red, orange, yellow, brown, chartreuse, green, teal, cyan, blue, indigo, purple, magenta, fuchsia, pink, crimson (15행) | 이미지 alt                                                                   |
| 색 단계                               | hue 마다 16열 (light → dark)                                                                                            | 이미지 alt                                                                   |
| index 범위 예시 (blue)                | 100 ~ 1600                                                                                                              | 이미지 alt                                                                   |
| blue 단계의 contrast ratio 범위       | 1.06:1 ~ 19.5:1                                                                                                         | 이미지 alt                                                                   |
| brand key color 예시 앱               | Ai (orange), Sg (green), Ps (blue), Ae (indigo), Xd (magenta), Id (pink/red)                                            | 이미지 alt — 두 번째 alt 에는 "pink/Xd" 로 적혀 있어 앱 표기가 서로 어긋난다 |
| 흰 글자를 올리는 solid 색             | red, brown, olive, green, teal, blue, indigo, purple, magenta, pink, dark gray, gray                                    | 이미지 alt                                                                   |
| 검은 글자를 올리는 solid 색 (본문)    | yellow, orange, chartreuse, celery                                                                                      | 본문                                                                         |
| 검은 글자를 올리는 solid 색 (alt)     | orange, yellow, green, lime                                                                                             | 이미지 alt — 본문과 표기가 다르다                                            |
| Two-tone 배경                         | `<color>-100` (예: magenta-100)                                                                                         | 본문                                                                         |
| Two-tone 아이콘·일러스트, light theme | `<color>-900` (예: magenta-900)                                                                                         | 본문                                                                         |
| Two-tone 아이콘·일러스트, dark theme  | 700 ~ 1200 중 원하는 명도·채도로 선택. 예: yellow-1200, red-700                                                         | 본문                                                                         |
| Programmatic 예시                     | 바른 예 `color: $blue-300;` · 틀린 예 `color: lighten($blue-300, 15%);`                                                 | 이미지 alt                                                                   |

#### 1-3. 규칙 (원문 단위)

- **Color backgrounds**: 색 배경·fill 은 아껴 쓴다. 아래 두 경우만 예외다.
- **Solid color background with black or white**:
  - 텍스트 색과 WCAG contrast 최소치를 지켜야 한다. 대부분의 색에는 흰 텍스트를 올린다.
  - yellow · orange · chartreuse · celery 는 식별성을 지키려고 검은 텍스트를 써야 한다.
  - **완전 불투명**이어야 하고 **static color palette** 에서 참조해야 한다.
  - 색의 의미를 텍스트 라벨로 함께 보여 주지 않으면 쓰지 않는다 (예: "drafts", "reviewed", "new").
  - 여러 색을 쓰는데 텍스트 라벨로 의미를 밝히기 어려우면(data visualization 에서 흔하다) **categorical color palette** 를 쓴다.
- **Two-tone color pairing**:
  - 텍스트 라벨 없이 쓰지 않는다.
  - 이 색들은 **color vision deficiency safe 가 아니다**.
- Usage guidelines:
  - **Don't create your own colors** (Don't): 인터페이스의 모든 부분은 Spectrum 이 정의한 색을 쓴다.
  - **Communicating with color**: 색만으로 소통하지 않는다. 색으로 피드백을 줄 때마다 label 이나 icon 을 함께 둔다.
    - Do 예: 빨간 테두리 + 경고 삼각형 + 오류 메시지
    - Don't 예: 빨간 테두리만
  - **Create hierarchy with background layer colors**: 앱 위계는 background layer 로 만든다. 그래야 dimensionality 와 시각·구조 위계가 light/dark theme 사이에서 맞게 옮겨진다.
  - **Provide sufficient contrast**:
    - text·icon·illustration 에는 알맞은 gray token 과 color token 을 쓴다. 이 토큰들은 지원하는 color theme 마다 background layer 위에서 WCAG 최소치 이상을 보장한다.
    - 더 낮은 index 를 고르거나 다른 배경색을 쓰면 대비가 부족할 수 있다.
    - 확신이 없으면 제품이 지원하는 모든 theme 에서 대비를 확인한다.
  - **Hue and Saturation contrast**:
    - hue 대비가 크고 채도나 명도가 거의 같은 색을 겹치거나 붙여 두지 않는다. chromostereopsis(깊이감·떨림 착시)가 생긴다.
    - 명도가 거의 같으면 일부 사용자에게 구분되지 않는다.
    - 색·이미지 배경 위에는 색 컴포넌트 대신 **static white / static black** 컴포넌트를 쓴다.
  - **Programmatic color changes**: color function 으로 Spectrum 색을 바꾸지 않는다. tint·shade 는 perceptually uniform 하게 설계됐다.
- 원문 결함: "Create hierarchy" 와 "Provide sufficient contrast" 두 예시는 이미지 alt 의 "correct/incorrect" 표기가 그림 내용과 반대로 읽힌다. 예를 들어 "correct" alt 의 그림에 'Fail' 표시가 있다. 그래서 위 규칙은 본문 문장 기준으로 정리했다.

#### 1-4. 테마·접근성

- dark·light variant 가 있다.
- two-tone 에서 light 는 900, dark 는 700~1200 을 쓴다.
- token 은 theme 마다 background layer 위에서 WCAG 최소치를 보장한다.
- CVD(color vision deficiency) 안전성에는 제한이 있다.

---

### 2. Grays (`foundations_color_grays.md`)

#### 2-1. 개념

- S2 gray 는 Spectrum 6.0.0 의 **11색 neutral gray 체계**를 바탕으로 한다. theme 마다 gray 값 11개가 있고, background layer 와 컴포넌트 상태 진행 등에 쓴다.
- 이미지 alt 에는 scale 이 "25 to 1000" 으로 표기돼 있다. 본문의 "11" 과 개별 단계 목록이 어떻게 맞는지는 파일에 없다.
- **gray-25 가 기본 배경색**이다. UI 가 밝아지고 대비가 높아진다.
- **단일 dark theme**: dark color theme(light device mode 에서)과 dark device mode 둘 다 같은 dark theme 하나를 쓴다.

#### 2-2. 값·용도

| gray                 | 용도 (원문)                                                                                       |
| -------------------- | ------------------------------------------------------------------------------------------------- |
| gray-25, -50, -75    | background layer 전용                                                                             |
| gray-100, -200, -300 | 대비가 낮은 컴포넌트 배경 진행 또는 border                                                        |
| gray-800, -900       | 대비가 높은 컴포넌트 배경, 예: text 와 active border. 배경색과 무관하게 컴포넌트가 늘 보이게 한다 |

예시 매핑 (이미지 alt):

- gray-100 · gray-200 = 버튼 배경
- gray-25 · gray-300 = text field 의 배경 · border
- gray-800 · gray-900 = text field 의 진한 border · 값 텍스트
- gray-800 = 진한 버튼 배경

contrast 차트 (이미지 alt): gray-25 기준 대비가 25 단계 1 부터 1000 단계 21 까지. Light theme · Dark theme 각각.

#### 2-3. 접근성 (원문 규칙)

- Adobe 는 WCAG **AA** 준수를 목표로 한다.
  - WCAG 2.2: 작은 텍스트 **4.5:1**. "Spectrum never deviates from this."
  - 활성 non-text 컴포넌트는 인접 색 대비 **3:1** 이상. disabled · decorative · user-set · logotype 은 면제. 대상은 text field · button 같은 UI 컴포넌트와 icon · illustration 같은 graphical object 다.
- 모든 상태의 모든 fill·stroke 가 3:1 이어야 한다는 지침은 없다. "one-size-fits-all" 접근은 무책임하다고 본다. 고대비를 원하는 사용자도 있고, 저대비를 선호하는 사용자(편두통 등)도 있다.
- 그래서 Spectrum 의 기준:
  - 모든 active state 가 어떤 방식으로든 배경 대비 3:1 이상이다 (예: text field 의 active border).
  - 컴포넌트 안의 icon · drag handle · text 는 3:1 또는 4.5:1 을 지킨다.
  - 그 밖의 graphical object 도 3:1 이상이고 텍스트 설명을 함께 둔다.
- 제품은 contrast · coloring · sizing · motion 등을 사용자가 조정할 수 있게 만들어야 한다.

---

### 3. Background layers (`foundations_color_background-layers.md`)

#### 3-1. 개념

- 페이지의 주 맥락에 따라 layer 를 다르게 쓴다.
  - **Editing contexts**: canvas 와 편집 동작이 주목적인 페이지
  - **Browsing contexts**: 콘텐츠 탐색이 주목적인 페이지 (Home, Files)
  - 어느 쪽인지 모르면 Spectrum 디자인 팀에 문의한다.
- 기존 3종(background layer 1, background layer 2, background base)에 **elevated** 가 추가됐다. elevated 는 canvas 위에 떠 있는 콘텐츠의 깊이를 만든다.
- 그림 alt 의 스택 순서 (앞 → 뒤): elevated, layer-2, layer-1, base, pasteboard

#### 3-2. 값 (표 원문 그대로 — 페이지에 같은 표가 두 번 나온다)

| Background layer | Light theme                | Dark theme                 |
| ---------------- | -------------------------- | -------------------------- |
| Elevated         | gray-25 (with drop shadow) | gray-75 (with drop shadow) |
| Layer 2          | gray-25                    | gray-75                    |
| Layer 1          | gray-50                    | gray-50                    |
| Pasteboard       | gray-100                   | gray-25                    |

- 표에 Base 행은 없다. Browsing 절 본문에는 "Spectrum 2 uses gray-25 as the base background color" 라고 적혀 있다.

#### 3-3. 용도 규칙

- **Elevated (highest attention)**: drop shadow 로 깊이감을 만들고, 다른 콘텐츠 위에 놓인 콘텐츠를 보여 준다. 주의를 끌기 때문에 아껴 쓴다.
  - Editing: canvas 위 app frame 요소 — floating toolbar, panel, popover
  - Browsing: menu, tooltip 같은 컴포넌트
- **Layer 2**:
  - Editing: canvas 색이다. professional · lightweight editing 앱의 app frame 에도 써서 주 콘텐츠와 같은 차원에 둔다.
  - Browsing: 관련 콘텐츠를 묶고 주 콘텐츠와 분리한다 (예: app frame 배경).
- **Layer 1**: professional editing 앱에서 깊이 구분이 더 필요할 때 app frame 색으로 쓴다.
- **Pasteboard**: 전용 layer 다. 위에 컴포넌트를 직접 올리지 않는다. 예외는 artboard 하나이고, artboard 는 흰 배경을 쓴다. 다른 컴포넌트는 layer 1 · layer 2 · elevated 위에 둔다.
- **Base**: gray-25. 주 콘텐츠에 주의를 모으고, 배경과 콘텐츠 대비를 높이며, 선명한 색을 위한 빈 캔버스가 된다. elevated 가 아닌 컨테이너를 drop shadow 로 강조하려면 "container emphasis" 를 참조한다 (그 페이지 내용은 이 파일에 없다).
- Professional application 예: artboard 와 app frame 모두 layer 2, floating toolbar 는 elevated.
- 원문 결함: Browsing 절에서 "Layer 2" 와 "Base" 하위 절의 이미지 alt 라벨('base' / 'layer 2')이 제목과 엇갈려 있다.

---

### 4. Typography overview (`foundations_typography_overview.md`)

- **Adobe Clean Spectrum**: Spectrum 기본 font family. Adobe 사내 서체 Adobe Clean 을 바탕으로 한다. Adobe Clean 패밀리에는 장문 읽기 · 코드 · 다국어용 등 10개가 넘는 typeface 가 있다.
- **Adobe Clean Spectrum VF**: web · iOS · Android 등의 기본 typeface. variable font 이므로 파일 하나로 weight · width 범위를 지원한다.
- 이미지 alt 에서 읽은 사양:
  - 스타일 탭: Default, Italic, Condensed, Origin
  - weight: Light ~ Black
  - italic 기울기: 12도
  - 24 styles, 각 804 glyphs, 형식 OTF/TTF
  - 지원 문자: Latin, Cyrillic, CJK, Greek, Thai, Arabic, Hebrew, Devanagari
  - 기능: diacritics, standard ligatures (ff, ft), tabular figures
- VF 의 이점 2가지:
  - ① **baseline metric 이 갱신돼** icon · component · avatar 같은 UI 요소와 정렬이 좋아졌다.
  - ② 앞으로의 조정을 지원한다. 지금은 기본 weight · width 를 권장한다. 예로 "dark mode 에서는 약간 얇은 weight 가 가독성을 높일 수 있다" 고 적혀 있다.

---

### 5. Typography system (`foundations_typography_typography-system.md`)

#### 5-1. 위계·weight

- 위계는 font size · weight · color 로 표현한다. attention hierarchy 개념과 연결된다.
  - 크고 굵고 진한 글자 = 넓은 개념 (need-to-know)
  - 작고 가볍고 옅은 글자 = 구체 정보 (nice-to-know)
- Font weight 분류 (이미지 alt):
  - **Black** = 제한적 사용만
  - **ExtraBold · Bold · Medium · Regular** = S2 에서 사용
  - **Semi Light · Light** = Spectrum 미사용

| Weight    | 규칙 (원문)                                                                                                                                                                                      |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| ExtraBold | 대부분의 경우 가장 무거운 weight. Bold 를 쓰는 Title 과 대비가 생긴다. Black 은 제품 브랜딩용으로 제한 허용한다 (예: Adobe Express 의 heading). Black 은 **heading type style 에만, 18 px 이상** |
| Bold      | 페이지·컨테이너의 주 초점을 강조. regular body 와 짝지어 위계를 만든다. 본문 안에서 UI 요소 이름을 가리킬 때 쓴다. Title, file name, user name, **button label**                                 |
| Medium    | Spectrum icon 의 **1.5 px stroke** 와 시각 균형이 필요한 컴포넌트. action button, badge, tag 의 label                                                                                            |
| Regular   | 컴포넌트와 body 의 기본 weight. 사용자가 입력하는·편집 가능한·긴 콘텐츠 (text field, text area)                                                                                                  |

#### 5-2. 텍스트 서식

| 서식      | 규칙                                                                                              |
| --------- | ------------------------------------------------------------------------------------------------- |
| Bold      | 위 Bold 와 같은 설명                                                                              |
| Underline | text link 에만 쓴다 (link 스타일에 따라 hover 또는 기본 상태). **강조 수단으로 절대 쓰지 않는다** |
| Strong    | 문장 일부의 중요성을 표시. 더 무거운 weight 로 렌더. 의미 서식                                    |
| Emphasis  | 문장 일부 강조. italic 으로 렌더 (CJK 는 더 무거운 weight)                                        |

#### 5-3. Font size — Major Second scale (비율 **1.125**)

- base 는 `font-size-100` 이다. 한 단계마다 1.125 를 곱하거나 나누고, 가장 가까운 정수로 반올림한다.
- custom text 나 기존 style 을 고칠 때도 이 목록의 크기를 써야 한다.
- Adobe Clean 은 system font 와 1:1 이 아니다. SF Pro · Segoe UI · Roboto 등보다 대체로 한 사이즈 작다.

| Token            | Value |
| ---------------- | ----- |
| `font-size-25`   | 10 px |
| `font-size-50`   | 11 px |
| `font-size-75`   | 12 px |
| `font-size-100`  | 14 px |
| `font-size-200`  | 16 px |
| `font-size-300`  | 18 px |
| `font-size-400`  | 20 px |
| `font-size-500`  | 22 px |
| `font-size-600`  | 25 px |
| `font-size-700`  | 28 px |
| `font-size-800`  | 32 px |
| `font-size-900`  | 36 px |
| `font-size-1000` | 40 px |
| `font-size-1100` | 45 px |
| `font-size-1200` | 51 px |
| `font-size-1300` | 58 px |
| `font-size-1400` | 65 px |
| `font-size-1500` | 73 px |

#### 5-4. Line height

- **Web**:
  - font size 마다 기본 line height 가 있다. 작은 크기에서 약 130%, 큰 크기에서 115% 로 점점 줄고, 짝수 정수 px 로 반올림한다. 반 픽셀 렌더를 피하려는 것이다.
  - Body · Code 는 1.5×.
  - CJK 는 1.7× 배수를 쓴다.

| Line height | Used for                          | Token                     | Value                                        | CJK value |
| ----------- | --------------------------------- | ------------------------- | -------------------------------------------- | --------- |
| Default     | Heading, Title, Detail, Component | `line-height-font-size-#` | ~115–130% (varies by size, even values only) | 150%      |
| Spacious    | Body, Code                        | `line-height-200`         | 150%                                         | 170%      |

- **iOS**: line height 는 auto 또는 normal 을 권장한다 (Apple 기본 text metric).
- **Android**: line height 는 sp 단위다. Figma 에서는 같은 값의 px 로 표기한다.

#### 5-5. Type styles

- 7종: **Heading, Title, Body, Detail, Component, Code, Monospace numbers**. t-shirt size 로 나뉘고 font family · size · line height · weight · color 를 포함한다.
- 한 제품이 모든 크기를 쓸 필요는 없다.
- 출발점: 각 style 에서 같은 t-shirt size 를 고른다. 예: Heading M + Title M + Body M + Medium 컴포넌트.
- font size 와 color 지침을 지키면 custom 이 허용된다.
- 아래 표의 Font size · Line height 칸 숫자는 원문 그대로 token 단계 번호다 (예: 1500 = `font-size-1500`).

**Heading** (가장 크고 굵다. 메인 페이지 제목처럼 가장 넓은 개념에만)

| Web style     | Font size | Line height | Weight    | Letter spacing |
| ------------- | --------- | ----------- | --------- | -------------- |
| Heading XXXXL | 1500      | 1500        | ExtraBold | None           |
| Heading XXXL  | 1300      | 1300        | ExtraBold | None           |
| Heading XXL   | 1100      | 1100        | ExtraBold | None           |
| Heading XL    | 900       | 900         | ExtraBold | None           |
| Heading L     | 700       | 700         | ExtraBold | None           |
| Heading M     | 500       | 500         | ExtraBold | None           |
| Heading S     | 400       | 400         | ExtraBold | None           |
| Heading XS    | 300       | 300         | ExtraBold | None           |

- iOS: Heading XL / L / M = 900 / 700 / 500, line height Auto, ExtraBold, letter spacing 칸에 900 / 700 / 500 으로 표기
- Android: Heading XL / L / M = 900 / 700 / 500, line height 동일 값, **Bold**, None

**Title** (need-to-know 개념. 주로 Bold. file name, card, user name, panel)

| Web style  | Font size | Line height | Weight | Letter spacing |
| ---------- | --------- | ----------- | ------ | -------------- |
| Title XXXL | 600       | 600         | Bold   | None           |
| Title XXL  | 500       | 500         | Bold   | None           |
| Title XL   | 400       | 400         | Bold   | None           |
| Title L    | 300       | 300         | Bold   | None           |
| Title M    | 200       | 200         | Bold   | None           |
| Title S    | 100       | 100         | Bold   | None           |
| Title XS   | 75        | 75          | Bold   | None           |

- iOS: Title XL / L / M = 400 / 300 / 200, Auto, Bold, letter spacing 칸에 400 / 300 / 200
- Android: Title XL / L / M = 400 / 300 / 200, Auto, **SemiBold**, letter spacing None / 0.0075 em / 0.015 em

**Body** (여러 줄 장문)

| Web style | Font size | Line height | Weight  | Letter spacing |
| --------- | --------- | ----------- | ------- | -------------- |
| Body XXXL | 600       | 150%        | Regular | None           |
| Body XXL  | 500       | 150%        | Regular | None           |
| Body XL   | 400       | 150%        | Regular | None           |
| Body L    | 300       | 150%        | Regular | None           |
| Body M    | 200       | 150%        | Regular | None           |
| Body S    | 100       | 150%        | Regular | None           |
| Body XS   | 75        | 150%        | Regular | None           |
| Body XXS  | 50        | 150%        | Regular | None           |

- iOS: Body L ~ XXS = 300 / 200 / 100 / 75 / 50, Auto, Regular, letter spacing 칸이 size 와 같은 숫자
- Android: Body L ~ XXS 마다 Regular 판과 **Emphasized**(SemiBold) 판이 있다. line height = size token. letter spacing L 0.0075 em · M 0.015 em · S 0.0225 em · XS 0.03 em · XXS 0.03 em

**Detail**

- body 보다 더 구체적인 보조 정보다.
- icon 과 함께 쓰면 1.5 px stroke 와 균형을 맞추려고 보통 **Medium** 이다.
- **`detail-color` (gray-600)** 로 덜 드러나게 한다.
- 예: card 의 "3 hr 10 min • Learning Path" = Detail M (이미지 alt).

**Component**

- UI 컴포넌트 안 텍스트용. 여러 weight 가 있다.
  - Button = bold
  - Action button = medium
  - Text field = regular
- **Web 전용**이다. iOS · Android 는 Title · Body · Monospace number 중 같은 weight · size 를 쓴다.
- 예 (alt): Component XL Bold, Component L Medium, Component M Regular, toast 본문 Component M Regular + 버튼 Component M Bold.

**Code**: 기본 글꼴은 **Source Code Pro**. Web 전용. 예: Code M.

**Monospace numbers**: timestamp · counter · 조정 값용. **iOS · Android 전용 type style** 이다. 예: Monospace number XXS.

**Body · Component · Detail 비교**:

- Detail 의 차이점은 기본 weight(Medium), 더 작은 크기, letter spacing, 마케팅 맥락의 all-caps, 더 옅은 gray 다.
- Detail 은 per-font-size line height 를 쓰고, Body 는 1.5× 를 쓴다.
- Component 와 Detail 이 헷갈리면 더 적응력이 높은 **Component 를 쓴다**.

#### 5-6. Fallback · Non-Latin · 플랫폼

| Typeface                | Web (priority 순)                                                                          | iOS             | Android                              |
| ----------------------- | ------------------------------------------------------------------------------------------ | --------------- | ------------------------------------ |
| Adobe Clean Spectrum VF | Adobe Clean, Source Sans Pro, San Francisco, Roboto, Segoe UI, Trebuchet MS, Lucida Grande | System defaults | System defaults (may vary by device) |

- Non-Latin: web 은 전용 글꼴을 쓴다 (예: CJK 는 **Adobe Clean Han**). iOS · Android 는 앱 크기를 줄이려고 system font 를 쓴다. metric 이 달라질 수 있으므로 현지화 화면의 정렬·간격을 확인한다.
- 플랫폼 접근성: iOS 는 **Dynamic Type** 지원, Android 는 **sp 기반 font scaling**.

---

### 6. Applying the type system (`foundations_typography_applying-the-type-system.md`)

#### 6-1. 조합 예시

- **Card**: ① Title S (카드 제목) ② Body XS (설명, **gray-700** 으로 보조 정보 구분)
- **Page section**: ① Title M (eyebrow) ② Heading XXL ③ Body M ④ Body S ⑤ Component M (button group)
- **Mobile browsing**: ① Heading L ② Title L ③ Body XS ④ Body S ⑤ Monospace number / Body XXS. 이 절의 이미지는 alt 가 비어 있다.

#### 6-2. Usage guidelines (원문 규칙)

| 규칙                                    | Do/Don't                         | 내용                                                                                                                                                                                                                                                                       |
| --------------------------------------- | -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| All-caps                                | Don't                            | UI 컴포넌트 안에서는 접근성 요구를 지원하지 못해 권장하지 않는다. 장문이 주인 경우(blog, 마케팅 사이트)에는 단어나 짧은 구절에 아껴서 전략적으로 허용한다                                                                                                                  |
| Use Spectrum font sizes                 | Don't 17 px / Do `font-size-200` | 정의된 font size 중에서 고른다. 고유 크기는 위계와 균형을 깬다                                                                                                                                                                                                             |
| Respect capitalization rules            | Do                               | 모든 UX 콘텐츠는 **sentence case**                                                                                                                                                                                                                                         |
| Use tabular numbers for numerical data  | Do                               | 컴포넌트 안 숫자는 tabular · lining figures. 표의 숫자는 **오른쪽 정렬**. 표 · timestamp · bar loader 에 적용. Adobe Clean 은 Figma Monospace uppercase 옵션 · Illustrator OpenType 패널 · **CSS font feature settings** 로 지원. iOS · Android 는 Monospace numbers style |
| Don't let paragraph widths get too thin | Don't                            | 이상적 폭은 약 **70자**. 최소 **50 ~ 120자** 범위를 지킨다                                                                                                                                                                                                                 |
| Keep content short                      | Do                               | 문단을 간결하게. 인지 장애 사용자 고려                                                                                                                                                                                                                                     |
| Don't fully-justify text                | Don't                            | 양쪽 정렬 금지 (갇힌 공백이 생겨 인지 장애·dyslexia 사용자가 읽기 어렵다). 문단의 right alignment(left rag)도 권장하지 않는다                                                                                                                                              |

---

### 7. Brand (`foundations_brand.md` / `visual-language_brand.md`)

#### 7-1. 개념

- in-app UI 관점의 브랜드 지침이다. 원문에 "아직 진행 중" 이라고 적혀 있다.
- 브랜드 자산:
  - **Product logos · app icons · lockups**: 배경이 어두워도 product logo 나 tile 색은 바뀌지 않는다. one-color product logo 는 workflow icon 용이다.
  - **Loading screens**: desktop splash · mobile loading · web loader.
    - desktop splash 는 커뮤니티 아트워크를 쓰고 최소 연 1회 갱신한다.
    - 로딩이 **2초를 넘거나** 즉시 열리지 않는 desktop 제품은 splash 가 필수다.
    - mobile 은 OS 관례를 따른다.
  - **File type · folder illustrations**:
    - desktop product folder icon 은 브랜드 색을 쓴다. web · mobile folder 는 Spectrum 색을 쓴다.
    - Primary file type(PSD, AEP 등 제품 전용 형식)은 항상 브랜드 색이다.
    - Secondary file type 은 Spectrum 1 색 기반 중립 팔레트다.

#### 7-2. Color

- Spectrum 6.0.0 은 브랜드 색을 충분히 반영하지 못했다. S2 는 색을 옮겨 브랜드 색을 더 잘 반영한다 (Colors 페이지 brand 절로 연결).
- in-product illustration · splash 이미지 밖의 브랜드 색은 S2 색과 조금 다를 수 있다.
- Adobe primary brand palette 는 red, black, grey, white 이고, 여기에 extended palette 가 더해진다. graphics · diagram · icon · illustration · background 의 출발점이다.

| 영역                    | 원문                                                                                                                                    |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| 앱 색 매핑 (이미지 alt) | Ai (Orange), Ps (Cyan), Dn (Celery), Ae (Indigo), Xd (Fuchsia), Id (Magenta). hex 는 이미지 안에만 있다                                 |
| Creative Cloud          | Adobe red + 제품 전용 6색. 각 색에 light · dark 값이 있다                                                                               |
| Document Cloud          | Spectrum 에 맞춘다. 주 제품색 3 + Adobe red, 보조 6색                                                                                   |
| Experience Cloud        | Spectrum 에 맞춘다. foundational 앱 = cool 색, functional 앱 = warm 색 (alt: Insights, Content, Data, Setup / Marketing, Ads, Commerce) |
| Adobe Express           | 3색. Indigo = fill accent · 주요 metaphor 강조. Spectrum gray = 주 stroke 색. alt hex: **#DEDEF9, #5C5CE0, #242424**                    |

#### 7-3. Gradients

- S2 의 큰 특징이자 UI 에서 브랜드가 드러나는 방식이다.
- 항상 의도와 전략적 의미를 갖고 배치한다. **주 콘텐츠를 방해하면 안 된다.**
- 시스템을 만들고, 제품 브랜드를 내세우고, 시각 위계를 돕는 특정 영역에만 쓴다.
- 색은 제품 브랜드 팔레트에 직접 묶인다.
- (visual-language 판만) "Premium and Generative AI gradients" — Figma embed 뿐, 본문 없음.

#### 7-4. 규칙 (visual-language 판만)

- **Request assets from the Brand team**: illustration · color · gradient · logo 등을 직접 만들지 않는다. 새 S2 자산은 Brand team 에 요청한다.

#### 7-5. 테마

- 로고·tile 색은 dark 배경에서도 그대로다. 그 외 테마 언급은 없다.

---

### 8. Icon fundamentals (`foundations_icons-and-illustrations_icon-fundamentals.md`)

#### 8-1. 개념

- S2 icon 의 성격: crisp, modern, clean. 더 둥근 모서리와 motion 으로 개성을 더했다.
- 브랜드 표현이 필요한 곳(onboarding, 마케팅, Learn)에서는 더 playful 한 metaphor 를 쓴다.
- 주요 변화:
  - **filled → outline** 스타일 전환
  - 의미 있는 metaphor 를 일관되게 쓰는 것을 우선한다. 주제는 "icons signal familiarity".
- 개발 배경:
  - iOS · Android icon 체계와 어울리게 통합 icon 언어를 만들었다.
  - Acrobat Modern Viewer · Adobe Express 의 outline icon 실험 결과를 반영했다.
  - 대부분 monochrome 이라 badge 에 색 강조를 줄 수 있다.
- 형태 원칙:
  - metaphor 는 clear · functional · additive. 정보가 많은 icon 은 작은 크기에서 읽히지 않는다.
  - 형태는 미리 정한 **key shapes** 에서 출발한다 (square → document, circle → compass, rectangle → folder; alt).
  - literal / abstract metaphor 를 모두 쓴다 (house = Home, 사각형 묶음 = Group; alt).
  - 플랫폼 표준 icon 은 플랫폼별로 따른다 (Share 는 iOS 와 Android 가 다르다; alt).

#### 8-2. 값

| 항목       | 값                                                                                                                                                                               |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Stroke     | **1.5 px**. 픽셀 단위 안을 **4 subdivision** 으로 나눠 균형 있게 렌더. pixel-perfect snapping 은 버렸다 (고해상도 우선)                                                          |
| Canvas     | S2 = **20 px canvas, 1.5 px stroke** (2023)                                                                                                                                      |
| 이력 (alt) | 2018 Spectrum: 18 px, 1 또는 2 px stroke · 2020 Express: 18 px, 2 px · 2020 DC Modern: 18 px, 1.5 px · 2023 S2: 20 px, 1.5 px                                                    |
| Appearance | outline · 대부분 monochrome. 개념을 분명히 해야 하면 fill + stroke (즐겨찾기 별점, 3rd-party logo). 방향 전환 · 배제 · 전환 · 속도를 나타내면 duotone (flip horizontal/vertical) |

---

### 9. Using icons (`foundations_icons-and-illustrations_using-icons.md`)

#### 9-1. 종류

- **Workflow icons**: 객체를 탐색·조작하는 metaphor. 플랫폼마다 크기·스타일이 일정하다. 위계와 맥락을 위해 scale 을 섞는 것은 흔하다.
- **UI icons**: arrow · cross · chevron · asterisk · drag handle · checkmark 등 컴포넌트의 원자 부품. metaphor 가 아니라 상호작용을 표시한다. 크기가 다양하다.
- **Badges**: status badge(presence, validity, completeness 등)와 premium badge(유료 기능).
- **Cursors · HUD**: S2 icon 과 같은 look & feel.

#### 9-2. 값

| 플랫폼      | 크기                                 | Canvas | Icon   |
| ----------- | ------------------------------------ | ------ | ------ |
| Desktop/Web | primary                              | 20 px  | ~18 px |
| Desktop/Web | secondary (layers panel, list, card) | 16 px  | ~14 px |
| Mobile      | primary                              | 24 px  | ~22 px |
| Mobile      | secondary                            | 20 px  | ~18 px |

- stroke 는 하나뿐이다: **1.5 px**. 20 px 로 그린 것을 24 px 로 키우면 **1.64 px**. 플랫폼마다 다시 그리지 않는다.
- **T-shirt sizes**: 컴포넌트 크기에 따라 workflow icon 이 조금씩 커지고 작아진다 (M 의 20 px icon 은 L 에서 조금 크고 S 에서 조금 작다). UI icon 은 자기 크기 범위를 쓴다.
- **Corner radius**: 각진 icon 은 모두 **1.5 px rounding**. 안쪽 모서리도 살짝 둥글다. stroke 끝은 rounded cap. metaphor 가 뾰족함을 요구하면 radius 를 줄일 수 있다.
- **Placement**:
  - 주 형태는 중앙에 둔다.
  - modifier 는 주로 오른쪽 아래.
  - notification dot 은 오른쪽 위 (주로 코드로 추가).
- **Safe area** (alt):
  - Desktop: 32 px canvas, 20 px icon, 4 px rounding area, 20 px 안에 1 px safe area
  - Mobile: 40 px canvas, 24 px icon, 5 px rounding area, 1 px safe area
- **Text · icon 정렬**:
  - medium 컴포넌트에서 text box 를 1 px 위로, icon box 를 1 px 아래로 옮겨 Adobe Clean Medium 과 균형을 맞춘다.
  - alt 수치: 전체 높이 32, cap height 11, baseline 12, text box 15, icon frame 20, padding 6~9 px.
  - 다른 예 (alt): quiet action button 은 16 px icon, label 은 Adobe Clean regular 14.
- **Naming**:
  - Prefix `S2`
  - Type: Icon / Ani-Icon / Ani-Illu / Illu / Cur / Mock-Icon
  - name 은 PascalCase
  - canvas size 는 @1x px
  - State: `_N` normal · `_S` selected, Dark UI theme 은 `D` 를 덧붙인다
  - filetype suffix (SVG, PDF)
  - 예 (alt): S2 · Icon · TextAlignLeft · 20 · N + D · SVG, 구분자는 underscore

#### 9-3. 새 SVG 구조

- SVG 안의 **요소별로** named **CSS variable** 로 색을 넣는다. 그래서 상태(hover, selected)와 UI 밝기·theme 에 따라 자동 tinting 된다.
- 이를 위한 Spectrum token 이 생길 예정이다.
- CSS variable 을 못 쓰는 환경에서는 transparency 로 primary 색의 tint 를 만든다 (최소한 gray tone 은 쓸 수 있다).
- 이점:
  - SVG 하나가 모든 theme 의 모든 상태를 맡는다
  - 파일이 작다
  - 색 변경을 쉽게 반영한다
  - app 전용 accent 색을 넣을 수 있다
- 예 (alt): primary · red 두 동적 색과 항상 흰색인 exclamation.

#### 9-4. Usage guidelines

- **Don't resize icons**: stroke · size · canvas 가 세트로 맞춰져 있다. 크기를 바꾸면 일관성이 깨진다.
- **Don't create your own icons**: width · size · shape · stroke 두께 · 색을 바꾸지 않는다.
- **Semantic colors**: 의미 색과 시각적으로 맞는 metaphor 를 고른다. Success · Alert · Information · Caution 은 해당 색을 쓴다 (예: in-line alert).
  - Do 예 (alt): green check, red warning triangle, blue info circle, orange caution diamond
  - Don't 예 (alt): red check, yellow triangle, green X, gray exclamation
- **Meeting contrast requirements**:
  - S2 색 + S2 icon 이면 **WCAG non-text 3:1** 을 만족한다.
  - 벗어나면 직접 대비를 확인한다.
  - light · dark theme 모두에서 subtle fill 로 가독성을 지킨다.
  - 조합 3가지: subtle fill 배경 + dark icon / bold fill 배경 + light icon / 배경 + tinted icon. 각각 대비가 부족한 Don't 예시가 짝으로 있다.

---

### 10. Illustration (두 판 공통 본문 기준)

#### 10-1. 개념

- S2 illustration 은 전면 재작업됐다.
- 목적: 전문 도구와 소비자 앱 사이의 간극을 잇는다. approachability, 더 분명한 attention hierarchy, 제품 브랜딩과의 연결.
- **SVG native export** 를 전제로 만들었다.
- 스타일 2가지:
  - **linear** — monochromatic
  - **gradient** — color, S2 신규, Spectrum 1 filled 스타일을 대체
- gradient 의 형태 4종은 S2 원칙에 대응한다:
  - diamond(Spectrum 로고) = Rational
  - radial gradient = Human
  - 날카로운 linear gradient 원 = Focused
  - 이어진 두 원 = Collaborative
- 일부는 아직 탐색 중이다 (animation 포함).

#### 10-2. S1 → S2 변화와 값

| 항목                    | 값                                                                                                                                                                                               |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| linear 색               | **gray 800** (S1 은 gray 500). icon · text 와 같다. 배경과 무관하게 보이게 하려는 것                                                                                                             |
| light UI gray 800 (alt) | **#292929**                                                                                                                                                                                      |
| dark UI gray 800 (alt)  | **#DBDBDB**                                                                                                                                                                                      |
| 크기                    | **S 48×48 · M 96×96 · L 160×160 px**. spacing token 과 맞춘다. S · M 이 가장 흔하고, 대부분은 **M** 을 권장                                                                                      |
| 형태                    | 더 둥글고 친근한 형태, 덜 복잡한 구성. icon metaphor 와 형태가 가깝다                                                                                                                            |
| linear naming           | prefix `S2` · type `lin` · name camelCase · size @1x px · suffix (SVG, PNG)                                                                                                                      |
| gradient naming         | prefix `S2` · type `fill` · name camelCase · **category** (`allproduct1, allproduct2, 3D, DC, drawing, DVA, express, EC, photo, print`) · size · suffix                                          |
| gradient 색             | Spectrum 6.0.0 색 체계 기반, 제품 범주에 묶인다. 여러 제품 · 제품 무관 surface 용 gradient 2개 (Adobe red 포함 swatch). 예: blue = 사진 · 디지털 이미징 (Ps, Lr, Fresco), green = 3D (Substance) |
| 토큰                    | 생산용 SVG(A4U)에 token 을 심어 UI 밝기 · theme 에 따라 자동 전환된다 (icon SVG 구조와 같다). visual-language 판: Figma 는 S2 / Variables token                                                  |

#### 10-3. Usage guidelines (원문 규칙)

- **attention hierarchy**:
  - linear = 낮은 주의. 한 화면에 여러 번 써도 된다.
  - gradient = 높은 주의. **페이지당 높은 주의 요소(또는 그룹)는 하나만**.
- **오류 · 위급 메시지에는 linear 만**. gradient 색은 semantic color 로 오해될 수 있고, 밝은 tone 이 상황과 맞지 않는다.
- **여러 개를 함께 보여 줄 때는 linear** (예: 카드 모음).
- **Don't resize**: stroke 와 corner radius 는 정해진 canvas 크기에 맞춰져 있다.
- **Don't create your own linear illustrations** — 직접 만들거나 고치지 않는다.
- **Don't recolor**: 항상 gray 800. semantic color(red, orange, green, blue)는 의미를 강화하는 경우에 한해 case-by-case 로 쓴다 (예: success checkmark 에 green).
- **gradient 는 신중하게**: 주의를 끌고 즐거운 순간을 만드는 곳에 전략적으로.
- **한 view 에 gradient illustration 은 하나만**. upload, 프로젝트 시작, comment 같은 가치 높은 행동에 쓴다.
- **오류 · 위급 메시지에 gradient 를 쓰지 않는다**. 오류 메시지에 green 이 섞이면 혼란스럽다. gradient 는 긍정적 행동을 강조할 때 쓴다.
- **Don't create your own gradient illustrations**.
- **제품 범주에 맞는 색을 쓴다** (Substance 3D → green). 다른 범주 색은 쓰지 않는다.
- category gradient 를 semantic color(error red / warning yellow / success green)로 쓰지 않는다.
- **레이아웃에서 테스트한다**. 너무 시끄러우면 linear 로 바꾼다.
- 3rd-party 자산을 쓰지 않는다.
- **Thematic banners**: linear 의 형태 · metaphor 에 gradient 색을 더한 별도 스타일이다. attention 이 높으므로 신기능 발표 같은 긍정적이고 영향이 큰 순간에 아껴 쓴다. Brand team 이 case-by-case 로 만들고, asset library 는 없다.

#### 10-4. 테마·접근성

- linear 는 gray 800 token 으로 light/dark 가 자동 전환된다.
- illustrated message 예시는 light · dark 두 UI 로 제시된다 (alt).

---

---

## C. 구성 — attention hierarchy · app frame · 간격 · container · object styles

**공통 주의 두 가지**

- 이미지 alt 텍스트에만 있는 정보는 "(이미지 alt)"로 표시했습니다.
- `![][image0]`처럼 alt가 빈 이미지는 내용을 알 수 없어 "본문 없음"으로 적었습니다.

---

### 1. Attention hierarchy (두 경로판)

#### 1-1. 핵심 개념

- **출발점**: "Design systems are ultimately communication systems." UI 커뮤니케이션은 사용자가 무엇을 알아야 하고 왜 중요한지 바로 이해하게 해야 합니다. 무엇보다 "respectful of user attention" 이어야 합니다.
- **정의**: Spectrum 2 의 core concept 입니다. Spectrum 에 원래 있던 생각인데, S2 에서 가정을 검증하는 수단으로 공식화됐습니다.
  - 뿌리는 typographic hierarchy 입니다 (scale·size·text pairing 으로 넓고 중요한 정보와 세부·부가 정보를 구분하는 방식).
  - 이 방식을 텍스트 밖의 "all the ways that UI communicates" 로 넓힌 것입니다.
- **signal-to-noise 관점**
  - High attention 요소는 primary area of focus 이고, timely 하고 high-signal 인 의미를 전합니다.
  - Low attention 요소는 배경에 섞이고, utilitarian 하고 lower-priority 인 의미를 전합니다.
  - object styles·component options·typography 가 모두 각기 다른 수준의 attention 을 끕니다.

#### 1-2. 원문 규칙

- "High attention elements should be used sparingly and selectively." 너무 많으면 경험이 "noisy and unfocused" 해집니다.
- high-contrast colors 와 elevation 은 둘 다 특정 의미를 전하고 강조를 더하므로 "used very thoughtfully" 해야 합니다.
- "As a general rule, only one element or group of elements should have high attention on a page."

#### 1-3. high / medium / low 분류와 예시

본문 텍스트는 high 와 low 두 단계만 정의합니다. medium 은 이미지 alt 에만 나옵니다.

| 단계                   | 예시                                                                         | 출처                     |
| ---------------------- | ---------------------------------------------------------------------------- | ------------------------ |
| Low                    | 회색 버튼 "Cancel", 배경에 섞임                                              | composition판 이미지 alt |
| Medium                 | 검정 버튼 "Edit" + 연필 아이콘, "noticeable but not very attention-grabbing" | composition판 이미지 alt |
| High                   | accent blue 버튼 "Publish" + 종이비행기 아이콘, 배경에서 두드러짐            | composition판 이미지 alt |
| Low → High (shadow)    | No drop shadow = low, significant drop shadow = high                         | composition판 이미지 alt |
| Low → High (elevation) | 빈 카드 4개, 오른쪽으로 갈수록 drop shadow 가 깊어짐                         | foundations판 이미지 alt |
| Low → High (pill)      | 연한 회색 → 진회색/검정 → solid blue                                         | foundations판 이미지 alt |

다른 페이지에 나오는 attention 관련 규칙은 3-3 (배경 scale), 4-2 (container styles), 6-1 (Full rounding) 에 정리했습니다.

#### 1-4. Do / Don't

**foundations판** (vertical sidebar 예시)

- :docheck: "The plus button is the most timely and high impact action to take in this example."
- :dontcross: "Selected state of items in the navigation is competing with the plus button." (이미지 alt: blue accent 가 여러 요소에 남용됨)

**composition판** (product canvas 예시, Do/Don't 마커 없이 문장으로 서술)

- 정답 예: "The 'Share' button is the most timely and high-impact action…" 이유는 캔버스에서 만들기를 끝낸 다음 단계가 공유이기 때문입니다. Share 만 blue 이고 나머지는 black·grey 입니다.
- 오답 예: "The 'Share' button is competing with the selected states of items in the navigation." navigation 항목은 wayfinding·context 에 여전히 중요하지만 공유만큼 timely 하지 않습니다. 이 예에서는 action button 2개가 함께 blue 입니다.

#### 1-5. 두 경로판의 차이

| 항목          | `foundations_attention-hierarchy.md`                                                             | `foundations_composition_attention-hierarchy.md`         |
| ------------- | ------------------------------------------------------------------------------------------------ | -------------------------------------------------------- |
| 머리          | hero 이미지 있음, 절 제목 `## :size-l: Attention hierarchy`                                      | `## **About this concept**`, 용어를 굵게 표시, hero 없음 |
| 본문 텍스트   | 같음                                                                                             | 같음                                                     |
| 예시 이미지   | pill 3개, 카드 4개 (그림 설명만)                                                                 | Cancel / Edit / Publish 버튼, shadow 없음 vs significant |
| Example       | vertical sidebar 의 plus button                                                                  | product canvas 의 Share button, 이유 문장이 더 김        |
| Do/Don't 마커 | `:docheck:` / `:dontcross:` 있음                                                                 | 없음 (문장으로만)                                        |
| Metadata tags | 있음 (attention hierarchy, high attention, low attention, UI communication, elevation, contrast) | 없음                                                     |

---

### 2. App frame — Overview

#### 2-1. 핵심 개념

- **정의**: "The app frame is the core navigation direction for Spectrum 2." 제품별로 맞춰 쓸 수 있는 flexible framework 이면서, 제품 사이에 shared·predictable 한 경험을 줍니다.
- **원칙 3가지**
  - **Flexible and adaptable**: "opinionated without being restrictive"
  - **Cohesive and predictable**: 브랜드를 강화하고, 여러 앱을 오가는 사용자를 돕습니다.
  - **Embodies Spectrum 2**: WCAG 준수, globalization 지원
- **범위**
  - 공통 경험 두 가지, **browsing** 과 **editing** 단계로 설계합니다.
  - 현재 정의된 것은 주로 browsing context 입니다.
  - 정의하는 것은 broad information architecture (객체 범주와 그 범주가 들어갈 위치) 까지입니다. 범주 안의 구체 객체 위치·순서는 정의하지 않습니다.

#### 2-2. Browsing context 의 의미

| context  | 원문 정의                                                                            |
| -------- | ------------------------------------------------------------------------------------ |
| Browsing | "workflows that draw attention to the content as the primary focus". 예: Home, Files |
| Editing  | "the workflow draws attention to the canvas as the primary focus". 아직 상세 정의 중 |

- 두 context 는 일부 겹칩니다.
- 상세 정의는 background-layers 페이지로 링크만 걸려 있고, 이번 대상 파일에는 없습니다.

#### 2-3. Zones (browsing context)

Zones 는 특정 액션 종류가 들어갈 일반 영역이며, 컴포넌트에 묶이지 않습니다.

| Zone                      | 내용                                                                                                                                           |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| A. Navigation zone        | primary navigation. 제품 사이에 highly predictable 해야 함. header·side navigation, content area 안의 side navigation·tabs (secondary) 로 표현 |
| B. Global action zone     | view actions (layout·zoom), supplemental features (AI Assistants). header 에 둘 수도, 전용 side rail 에 둘 수도 있음. 단일 시각 표현은 없음    |
| C. Contextual action zone | 페이지 콘텐츠에 걸린 transient action (예: action bar)                                                                                         |

#### 2-4. Anatomy (browsing context)

| 부품                         | 필수 여부                | 역할                                                                                                                                                |
| ---------------------------- | ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| A. App frame header          | Navigation, **required** | product brand, global actions, universal nav. top-level navigation 과 큰 fly-out 가능. side nav 가 있으면 header 는 app-wide action (예: search) 용 |
| B. App frame side navigation | Navigation, optional     | home·files·learn·dashboards 같은 제품 기능의 주요 범주. 라벨 표시·최소화 동작이 있음. marketing 페이지 분류에는 쓰지 않음                           |
| C. Content area              | **Required**             | 여러 layout 을 지원하는 modular space. 안에 무엇을 넣을지는 app frame 이 정하지 않음                                                                |

- 이 anatomy 용어는 내부 정렬용이며 end user 에게 쓰는 말이 아닙니다.
- gradient 는 content area 의 배경에만 씁니다. header 와 navigation 영역에는 쓰지 않습니다.

#### 2-5. Side navigation state control

- variant 는 **hamburger** 와 **panel** 두 가지이고, 동시에 쓰지 않습니다.
- icon-only button 이며, panel 폭을 펼치거나 접어 라벨을 보이거나 숨깁니다.
- accessible name: 펼칠 때 "Show menu labels", 접을 때 "Hide menu labels"
- **Hamburger**: header 에 있음. panel 을 완전히 펼치거나 접고, 또는 부분적으로 접습니다.
- **Panel**: hover 시 동작을 미리 보여주는 animated preview 가 나옵니다. side navigation 맨 아래에 놓입니다.

#### 2-6. Top App Bar (TAB)

- 9-grid app switcher 의 최신 형태입니다. 켜면 header 위에 나타납니다.
- screen reader 순서: alert banner → TAB → header
- 지원 제품: Adobe Home, Firefly, Express, Photoshop, Lightroom, Acrobat
- **TAB 제품**: 데스크톱은 panel icon 이 side nav 하단에 있습니다. 모바일은 hamburger 와 product switcher 가 header 에 있습니다.
- **Non-TAB 제품** (Digital Experience, Unified Shell): 항상 hamburger 입니다.

#### 2-7. 용어 · 콘텐츠 규칙

**용어 정의**

- **Panel, Rail**: 한쪽에 고정된, 보이는 경계가 있는 영역입니다. container 의 일종이고 "panel" 이 권장 표현입니다.
- **Content area**: 여러 layout 을 지원하고 담는 내용이 유연한 영역입니다.
- **Well**: 사용자가 편집할 수 없는 콘텐츠를 담는 container 이며, "lower-attention, supplementary information" 을 전합니다. 사용자 대상 용어로는 권장하지 않습니다.

**Do / Don't**

| 규칙                                                                                      | Do                                    | Don't                                                            |
| ----------------------------------------------------------------------------------------- | ------------------------------------- | ---------------------------------------------------------------- |
| 위치·모양이 아닌 기능으로 서술                                                            | "Approvals", "Colors"                 | "Approvals rail", "Colors panel"                                 |
| panel·rail 을 사용자 대상 용어로 쓰지 않음 (panel 은 다른 표현이 없을 때만, rail 은 금지) | "Show more options"                   | "Hide navigation rail"                                           |
| 열기·닫기는 "Show / Hide"                                                                 | "Show menu labels", "Hide navigation" | "Expand menu labels", "Minimize navigation", "Collapse side bar" |
| sentence case                                                                             | "All templates"                       | "All Templates", "ALL TEMPLATES"                                 |

---

### 3. App frame — Header · Side nav · Content area

#### 3-1. Header (browsing context)

- 모든 app frame layout 에서 **required** 이며, 모든 Adobe 제품에서 표준화해야 합니다.
- **Anatomy**
  - A. TAB switcher
  - B. Product lock-up: Brand 팀 제공 그대로 사용. small breakpoint 에서는 제품명을 숨길 수 있음
  - C. Navigation: side nav 가 없을 때만 header 에 둠
  - D. Search: 선택 사항이며, 쓰면 center aligned. 공간이 없으면 minimized search button
  - E. Universal nav
  - F. Side navigation state control: 모바일 breakpoint 와 Unified Shell 에서 hamburger

**Component options — App frame header**

| Property                      | Value               | Default | Description                                               |
| ----------------------------- | ------------------- | ------- | --------------------------------------------------------- |
| hasSideNavigationStateControl | boolean             | false   | side nav 를 drag 할 수 있으면 접근성을 위해 필수          |
| hasNavigationItems            | boolean             | false   | side nav 가 있으면 header 에 navigation item 을 두지 않음 |
| hasSearch                     | boolean             | false   | -                                                         |
| searchStyle                   | default / minimized | default | 공간이 부족하면 minimized                                 |
| hasSkipToMainContentButton    | boolean             | false   | keyboard focus 때만 보이며 focus order 맨 앞              |

**Component options — Header navigation item**

| Property   | Value   | Default | Description                                                      |
| ---------- | ------- | ------- | ---------------------------------------------------------------- |
| hasIcon    | boolean | false   | -                                                                |
| icon       | icon    | -       | -                                                                |
| label      | text    | -       | 필수, accessible name 으로도 씀                                  |
| isSelected | boolean | false   | 선택 항목은 inverted 스타일                                      |
| isDisabled | boolean | false   | 항목별 disable 가능                                              |
| hasPopover | boolean | false   | 클릭하면 선택 대신 하위 navigation popover 를 띄움, chevron 표시 |

- 원문 설명 절에는 `showIcon` 이라는 이름이 쓰여 표의 `hasIcon` 과 다릅니다.
- `icon` 설명은 원문에 "label 텍스트"로 잘못 들어가 있습니다.

**Side navigation state control**: `label` (text), 기본값 "Show menu labels / Hide menu labels". 라벨은 accessible name 과 같아야 합니다.

**States**

| 대상            | 지원                                                     | 미지원                             |
| --------------- | -------------------------------------------------------- | ---------------------------------- |
| Header          | Default                                                  | 나머지 전부                        |
| Header nav item | Default, Hover, Down, Keyboard focus, Disabled, Selected | Dragged, Error                     |
| State control   | Default, Hover, Down, Keyboard focus                     | Disabled, Selected, Dragged, Error |

**Usage**

- CTA 는 하나만 둡니다 (universal nav 의 login/logout 버튼 제외). 이유: 여러 CTA 가 경쟁하면 "dilute the ability for a focused attention hierarchy".
- Do: "Get desktop app" 버튼 1개 + icon-only 버튼
- Don't: "Get desktop app" 과 "Join the Discord" 두 버튼

**Keyboard**

- Tab: header 로 focus 진입·이탈
- Arrow: navigation item 사이 이동
- Space/Enter: 항목 선택. content area 의 view 가 바뀌고 focus 는 header 항목에 남음

**Cursor**: Product icon·name 은 링크라 Pointer, 나머지는 Arrow 입니다.

**치수**: editing context 노트에 "The height of the header should be the same as in the browsing context (**56 px**)" 라고 적혀 있습니다. 이번 파일에서 header 높이가 나오는 곳은 여기뿐입니다.

#### 3-2. Side nav (browsing context)

- 항상 header 와 함께 쓰고, header 를 대신하지 않습니다. marketing 페이지 분류에는 쓰지 않습니다.
- **Anatomy**
  - A. side navigation items: 시각·동작 스타일은 S2 app frame 전용이라 다른 곳에 재사용하지 않습니다. 표준 S2 side navigation 과 달리 collapsible 합니다. 스타일은 icon-only 와 mixed (1단계만 아이콘, 2·3단계는 아이콘 없음) 두 가지뿐입니다.
  - B. Create button: 선택 사항이며, 쓰면 맨 위에 둡니다. app frame 밖에서는 쓰지 않습니다.
  - C. state control: panel icon 이 하단에 있습니다 (TAB 제품).

**Component options — Side navigation panel**

| Property               | Value          | Default   | Description                                                                                              |
| ---------------------- | -------------- | --------- | -------------------------------------------------------------------------------------------------------- |
| minimized              | boolean        | false     | 최소화할 수 있으면 state control 필수                                                                    |
| minimizedStyle         | partial / full | partial   | partial = icon-only, full = 숨김. expanded+partial 또는 expanded+full 만 가능 (세 상태를 모두 쓰지 않음) |
| hasCreateButton        | boolean        | false     | app frame 전용 button instance                                                                           |
| isResizable            | boolean        | false     | 사용자 생성 콘텐츠가 있을 때 주로 유용                                                                   |
| dragToMinimize         | boolean        | false     | -                                                                                                        |
| minWidth (expanded)    | number         | **160px** | drag to collapse 가 켜져 있으면 이 폭에서 최소화                                                         |
| defaultWdth (expanded) | auto / number  | auto      | 가장 긴 문자열에 맞춰 자동 조정 (번역 대응). 원문 표기 오타 "Wdth"                                       |

**Component options — Side navigation item**

| Property        | Value                       | Default   | Description                                                        |
| --------------- | --------------------------- | --------- | ------------------------------------------------------------------ |
| icon            | icon                        | -         | 1단계에서 필수                                                     |
| label           | text                        | -         | 필수, accessible name                                              |
| hideLabel       | boolean                     | false     | 숨기면 hover tooltip 으로 표시. panel 최소화 동작이 이 값보다 우선 |
| labelTruncation | one line / two lines / none | two lines | 기본적으로 truncation 이 필요할 만큼 긴 라벨은 피함                |
| isSelected      | boolean                     | false     | inverted 스타일                                                    |
| isDisabled      | boolean                     | false     | -                                                                  |

- 선택 시 left visual bar 가 **gray-800** 이 되고, 텍스트가 bold, 색은 **content-neutral** 이 됩니다.

**States**

| 대상          | 지원                                                     |
| ------------- | -------------------------------------------------------- |
| Panel         | Default, Keyboard focus, Dragged                         |
| Item          | Default, Hover, Down, Keyboard focus, Disabled, Selected |
| State control | Default, Hover, Down, Keyboard focus, Selected           |

**Behaviors · 치수**

- **Mobile overlay**: 작은 breakpoint 에서는 overlay variant 를 쓰고 header 의 hamburger 로 엽니다. "**768 px** is the recommended breakpoint to begin displaying the overlay designs". 단, 실제 breakpoint 는 제품팀이 정합니다.
- **End section divider**: 하단 divider 가 overflow 항목과 end section 을 state control 과 나눕니다. 높이가 줄면 end section 항목이 start section 뒤에 붙어 함께 스크롤됩니다.
- **Minimum width** (단계 수에 따라)

| levels   | min width |
| -------- | --------- |
| 1 level  | 160 px    |
| 2 level  | 200 px    |
| 3 levels | 240 px    |

**Usage**

- **Do**
  - 사용자 생성 콘텐츠가 있으면 resize 를 지원합니다.
  - drag resize 를 켰다면 대체 수단 (state control) 과 키보드를 지원하고, 사용자가 고른 폭을 보존합니다.
  - 기본 폭을 가장 긴 문자열에 맞춥니다.
- **Don't**
  - 라벨이 3단어를 넘는 것 (1~2단어, 최대 3단어)
  - 줄바꿈 (불가피하면 Globalization 엔지니어가 수동 처리)
  - navigation 을 side nav 와 header 양쪽에 두는 것
- 여러 상태를 지원하면 expanded 를 기본으로 하고, 사용자 선택을 페이지·세션 사이에 보존합니다.
- 1단계 아이콘은 필수입니다. 하위 단계는 아이콘이 없어도 됩니다.

**Keyboard**

- Panel: Tab 은 drag area 로 focus, Arrow 는 크기를 조금씩 조정
- Navigation: Tab 은 진입·이탈, Arrow 는 항목 이동, Space/Enter 는 선택 (focus 유지)

**Editing context 노트**: 같은 자리의 toolbar 는 페이지 이동이 아니라 도구 선택용이라 side nav 동작을 따를 필요가 없습니다.

#### 3-3. Content area (browsing context)

- 페이지의 primary focus 이며 "should draw the most attention". 들어갈 콘텐츠는 정의하지 않습니다.
- multi-layout section 은 서로 의미상 관련 없는 콘텐츠를 나눌 때 씁니다.

| Layout              | 용도 · 규칙                                                                                                                                               |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Single section      | 모든 콘텐츠가 한 목적으로 묶일 때. full-width divider 또는 proximity·spacing 으로 나눔. spacing 만으로 경계가 불분명할 때 divider 사용                    |
| Horizontal sections | top section 은 별도 affordance (최소화 등) 가 있는 영역. "welcome" 콘텐츠 위, recent files 아래                                                           |
| Vertical sections   | 의미상 관련 없고 한쪽을 최소화할 수 있을 때 (onboarding, AI assistant)                                                                                    |
| Grid                | 관련 없는 여러 그룹, 사용자 맞춤 페이지. 작은 breakpoint 에서 reflow·hide·combine 할 방법을 정함. 중요한 정보를 위에 두고 나머지는 progressive disclosure |

**Horizontal sections 규칙**

- Do: 페이지가 한 단위로 스크롤
- Don't: 여러 영역이 각각 스크롤
- Do: top section 은 high-attention marketing message 나 quick action 용이며 스크롤하지 않습니다. infinite scroll 과 긴 콘텐츠는 bottom section 에 둡니다.

**Gradient**

- content area 배경에만 쓰고, 색은 product brand palette 에 묶입니다.
- Brand 팀이 준 것을 그대로 쓰고 수정하지 않습니다 (Don't: 직접 만든 orange+green 혼합).
- 원칙: "less is more"
- Do: 한 영역에만 사용 / Don't: 여러 content area 에 사용
- Do: content area 배경 / Don't: header·navigation 배경

**배경의 attention scale (low → high, 이미지 alt)**

| 순위        | 스타일                |
| ----------- | --------------------- |
| 1 (lowest)  | spacing               |
| 2           | background            |
| 3           | emphasized background |
| 4 (highest) | gradient background   |

**치수**: content area 의 여백·padding 값은 이번 파일에 없습니다. containers 페이지 (4-3) 에 app frame 의 main content area 가 "unique container style … subtle drop shadow" 라는 서술만 있고 수치는 없습니다.

#### 3-4. Creating bluelines

- **정의**: 파일에 "bluelines" 의 사전식 정의 문장은 없습니다. 노트에 따르면 bluelines 의 요구 사항은 accessible names, landmark regions, heading annotations, keyboard annotations 로 구성됩니다. 이것들은 맥락과 콘텐츠에 따라 달라지므로, 이 페이지는 출발점일 뿐 포괄적이지 않습니다. 즉 설계 시안 위에 접근성 주석을 다는 산출물로 서술돼 있습니다.

**만드는 방법 (원문 절 순서)**

1. **Accessible names**: 보이는 텍스트 라벨이 없는 컨트롤에는 반드시 정의합니다.
   - A. state control: 기본 "Show menu labels" / "Hide menu labels", 제품팀이 구체화
   - B. product lock-up: 보이는 텍스트 라벨이 있으면 지정 불필요, 그래픽은 무시됨
   - C. side nav labels: tooltip 라벨과 expanded 라벨이 accessible name 과 같아야 함, 추가 주석 불필요
   - D. Adobe-wide actions: universal nav 가이드를 따름
2. **Landmark regions**: 예시는 Navigation (Global), Banner, Navigation (Side), Region (이미지 alt).
   - navigation 이 2개 이상이면 각각 accessible name 이 필요합니다.
   - Region 은 항상 콘텐츠 기반 이름이 필요합니다.
   - AI assistant 처럼 main content 를 보조하지만 따로 떨어진 영역은 complementary landmark 로 둡니다.
3. **Heading annotations**: `<h1>` 은 하나이며 main landmark 에 둡니다. 제목 역할 텍스트는 `<h1>`~`<h6>` 으로 표시합니다. 예 (이미지 alt): H1 Welcome to Photoshop, H2 Start something new, H3 cards, H4 side nav 의 Favorites.
4. **Keyboard focus order**: 예시는 1 = side nav show/hide, 22 = recent files 필터 (이미지 alt).

**Usage (모두 Do)**

- side nav 폭에 keyboard focus 를 주고 좌우 화살표로 크기를 조정할 수 있게 합니다.
- header 에 "Skip to main content" 버튼을 둡니다.
- F6 region 이동을 지원합니다. 조건 4가지:
  1. focus indicator 가 보임
  2. HTML landmark 순서를 따름
  3. main navigation·toolbars·contextual toolbars·canvas 에 도달 가능
  4. 각 region 에 accessible name 이 있음
- 모바일 tray 의 focus 순서: Create → items → close. esc 로도 닫힙니다.

---

### 4. Layout and structure — Containers

#### 4-1. 핵심 개념

- "Containers separate concepts with distinct purposes." 관련 개념을 구분된 영역으로 묶습니다.
- card 는 container 의 속성을 이어받지만 distinct object (개별 asset·product) 하나만 나타냅니다. 여러 개념을 담은 marketing 블록은 container 이지만 card 가 아닙니다.
- container 사이 구분은 배경색 대비나 spacing 같은 뚜렷한 시각 변화로 합니다.
- 모든 container 가 styles·padding·emphasis 규칙을 공유합니다.
- 예: card 와 select box 는 container style 을 공유하고 둘 다 emphasized 입니다. card 에만 t-shirt size 와 layout 옵션이 있습니다.

#### 4-2. Container styles (원문 번호 순)

| #   | Style            | 내용                                                                                             |
| --- | ---------------- | ------------------------------------------------------------------------------------------------ |
| 1   | Background color | 기본값. 배경색 변화로 구분 (background layers 참조)                                              |
| 2   | Emphasized       | drop shadow 로 강조 (예: 관련 card 묶음). sparingly 사용                                         |
| 3   | Border           | background color 의 대안. **fill 없이** 사용. panel 같은 큰 구획에는 vertical full-width divider |
| 4   | Spacing          | "the container style with the least emphasis". 보이는 경계 없이 spacing 으로 분리                |

#### 4-3. Padding

- 내부 padding 은 component size·density·platform scale 에 따라 달라집니다.
- spacing 값 자체는 Spectrum 1 과 같습니다.

| Spacing token | Value | Example usage                                                      |
| ------------- | ----- | ------------------------------------------------------------------ |
| `spacing-100` | 8 px  | Extra-small cards                                                  |
| `spacing-200` | 12 px | High density panels, small cards                                   |
| `spacing-300` | 16 px | Medium density panels, medium cards                                |
| `spacing-400` | 24 px | Low density panels, large cards, mobile standard and alert dialogs |
| `spacing-500` | 32 px | Desktop standard and alert dialogs                                 |
| `spacing-600` | 40 px | Takeover dialog                                                    |

- 예: medium card 는 `spacing-300` (16px) padding 을 씁니다.

#### 4-4. Emphasis

- emphasized container 는 drop shadow 를 가지며, main content 를 강조할 때 씁니다.
- 한 그룹의 container 는 같은 intent 여야 합니다. 페이지에서 emphasized 그룹은 대개 하나입니다 ("not every element on a page _should_ have a drop shadow").
- 예: emphasized container + badge 를 회색 fill container 들과 대비합니다.
- **상태**
  - 1\. Emphasized default
  - 2\. Emphasized hover: 컨테이너 전체가 interactive 일 때 조금 더 두드러진 shadow
  - 3\. Dragged: 훨씬 두드러진 shadow
- 해당 이미지 2개는 alt 가 비어 본문 없음입니다.

#### 4-5. App frame 과의 관계

- main content area 는 app frame 에서만 쓰는 고유 container style 입니다.
- navigation 과 구분하는 subtle drop shadow 가 있습니다. 수치는 없습니다.

---

### 5. Spacing

#### 5-1. Overview 두 판의 차이

- `spacing_overview.md` 와 `spacing_spacing-overview.md` 는 본문이 거의 같습니다.
- **차이**
  - 첫 원칙 이름: overview 는 **Relational**, spacing-overview 는 **Rational**
  - spacing-overview 는 이미지 alt 가 모두 비어 있음
  - spacing-overview 에만 "Spacing communicates three things:" 제목이 있음
  - spacing-overview 에 "layout.." 오타
  - overview 에만 Metadata tags 와 `:size-*` 표기가 있음

#### 5-2. 핵심 개념

- "Spacing communicates structure and relationships."
- **원칙 3가지**
  - Relational / Rational: proximity 가 소속을 전함
  - Proportional: 요소마다 성장 속도가 달라 scale 을 따로 둠
  - Perceptual: 시각 지각에 기반
- **spacing 이 전하는 것**
  - Relationships: 가까우면 연관, 멀면 독립
  - Boundaries: 그룹 안의 일정한 proximity 는 동등한 관계를 뜻함
  - Structure: 공간 분포가 조직을 보여줌
  - 셋은 서로 연동됩니다.
- negative space 가 적으면 clutter 와 cognitive load 가 늘고, 많으면 calm·focused 한 경험이 됩니다.
- **두 트랙**
  - Layout spacing: 컴포넌트 위 수준 (컴포넌트·pattern·region 사이)
  - Component spacing: 컴포넌트 내부
  - 두 트랙은 다른 속도로 scale 됩니다.

#### 5-3. Layout spacing

- global token 이며 geometric progression 을 따릅니다. 값은 2, 4, 8, 16 같은 익숙한 수로 반올림됩니다.
- 인접 값 사이의 지각 차이가 일정합니다.
- 작은 값은 관계를 조이고, 큰 값은 독립성을 키웁니다. 실제 관계에 맞춰 고릅니다.
- **"Why not a fixed grid?"**: linear progression (8·16·24·32) 의 한계는 두 가지입니다.
  1. spacing 이 주변 요소와 함께 커져야 합니다.
  2. 큰 값에서 차이가 사라집니다 (4→8 은 100% 증가, 72→80 은 11% 증가, 이미지 alt).
- 예시 이미지 alt: GenStudio 의 가로 밴드 `spacing-100`, `spacing-250`. `spacing-250` 은 아래 token 표에 없는 이름입니다.

**Tokens (원문 그대로)**

| Token        | Value |
| ------------ | ----- |
| spacing-25   | 1px   |
| spacing-50   | 2px   |
| spacing-75   | 4px   |
| spacing-85   | 6px   |
| spacing-100  | 8px   |
| spacing-200  | 12px  |
| spacing-300  | 16px  |
| spacing-350  | 20px  |
| spacing-400  | 24px  |
| spacing-500  | 32px  |
| spacing-600  | 40px  |
| spacing-700  | 48px  |
| spacing-750  | 56px  |
| spacing-800  | 64px  |
| spacing-900  | 80px  |
| spacing-1000 | 96px  |

#### 5-4. Component spacing

- 컴포넌트 내부 관계이며 모든 size·density 에서 맞아야 합니다.
- 자체 geometric scale 을 따르고, type scale 과 component size 를 맞추느라 값이 덜 둥글 수 있습니다.
- **Structural templates**: 컴포넌트를 구조 유형으로 나누고, 유형마다 semantic token 범주가 있습니다.
  - list 처럼 동작하면 list-level token
  - container 처럼 동작하면 container-level token
  - 단일 interactive 요소 중심이면 base-level token
  - 결합도 가능합니다 (list item = base + group).
- **원문 token 예**: `base-gap-large` (코드 표기). 이미지 alt·라벨에는 "Base gap medium", "List gap medium", "Table item padding compact/regular/spacious", "Banner padding horizontal(/compact)" 가 나옵니다.
- "A hardcoded `8px` is just a number." token 을 쓰지 않으면 향후 시스템 개선을 받지 못합니다.
- **Density**
  - size tier 와 별개입니다. compact 는 각 token 을 한 단계 내리고, spacious 는 한 단계 올립니다 (regular `spacing-200` → compact `spacing-100` / spacious `spacing-300`).
  - compact/regular/spacious 라벨은 density 설정과 1:1 로 대응하기도 하고, 특정 맥락 안의 선택 범위를 뜻하기도 합니다.
  - density 를 지원하는 것은 **collections 와 containers 뿐**입니다. button·text field 같은 basic component 는 지원하지 않습니다.
  - Collections (list·group·table): 대부분 item 사이 gap 만 바뀝니다.
  - Containers (card·toolbar): 세로·가로 padding 이 모두 바뀝니다.
- 전체 token reference 는 "in the future" 라고만 되어 있어 값 표가 없습니다. S2 / Variables Figma library 에 있다고 적혀 있습니다.

---

### 6. Object styles

#### 6-1. Overview 와 composition판

- **Overview**: Object styles 는 의도를 전하거나 interaction 의 단서를 주는 shape·effect 이며, rounding·border width·drop shadow 로 이루어집니다. color 와 결합합니다.
  - search·text field·combo box 는 텍스트 입력 스타일을 공유합니다. search 는 global scope 라 **full rounding** 으로 강조·구분합니다.
  - action button·picker·in-field button 은 fill color 로 selection 을 나타냅니다.
  - checkbox·radio·switch 는 binary selection 스타일을 공유합니다.
- **composition판** (`foundations_composition_object-styles.md`)
  - S2 rounding 은 S1 보다 더 뚜렷하고 유연합니다.
  - 기존 default·small·full 에 **10 px** 와 **16 px** 를 더했고, 이 둘은 "only used for containers" 입니다.
  - 단계별 값: Default 8 px (most components, extra-small/small cards), Small 4 px (checkbox, in-field button), Full ("used for emphasis, draws attention, and is used sparingly", Button, avatar)
  - "Desktop and mobile scales share the same base rounding."
- **두 판의 차이**
  - foundations rounding 페이지는 Large·Extra-large 에 이름과 용도 (cards·panels·toolbars, dialogs) 를 붙였습니다.
  - composition판은 10/16 px 를 "containers 전용" 으로만 적었습니다.
  - Full 의 예가 foundations 에서는 FAB 와 search 까지 늘었습니다.

#### 6-2. Rounding

- **원칙**
  - **No sharp corners**: 예외는 정밀도가 중요한 경우뿐입니다 (slider·progress bar 의 fill).
  - **Visually balanced corners**: 중첩 시 radius 를 사이 간격에 비례해 조정합니다 (concentric).
- **Rounding system**

| #   | 단계             | 용도                                                             |
| --- | ---------------- | ---------------------------------------------------------------- |
| 1   | Small            | checkbox, in-field button                                        |
| 2   | Medium (default) | 대부분 컴포넌트, extra-small·small cards                         |
| 3   | Large            | medium·large cards, panels, action boxes, select boxes, toolbars |
| 4   | Extra-large      | Dialogs                                                          |
| 5   | Full             | Button, avatar, floating action button, search                   |

- **Component size 별 scale**: Major Second logarithmic scale 이며 type system 과 같은 scale 입니다. 표시값은 base 값이고 컴포넌트마다 다를 수 있습니다. 이미지 alt 의 크기별 radius: **7 (7.111px), 8px, 9px, 10 (10.125px)**
- **Nested corners**
  - Focus ring 공식: **\<outer radius> - \<gap> = \<inner radius>**
  - 중첩 컴포넌트: 작은 객체는 작은 radius, 큰 객체는 큰 radius (예: field = medium, chevron button = small)
- **적용**: custom container 에서는 공식의 수치 정밀도보다 visual harmony 를 우선합니다. 작은 radius 를 큰 radius 안에 두고, gap 은 Spacing 시스템으로 만듭니다.
  - 예 (이미지 alt): 이미지 tile 은 extra-large / medium, selection toolbar 는 large, spacing 은 12px / 6px
  - 썸네일은 gap 이 커서 optical 로 조정했고, action bar 는 gap 이 작아 공식대로 적용했습니다.
- **iOS**: continuous corner (RoundedCornerStyle) 와 ConcentricRectangle 을 씁니다.

**Tokens** (web 에서만 제공)

| Style       | Token                               | Value |
| ----------- | ----------------------------------- | ----- |
| Small       | `corner-radius-small-default`       | 4 px  |
| Medium      | `corner-radius-medium-default`      | 8 px  |
| Large       | `corner-radius-large-default`       | 10 px |
| Extra-large | `corner-radius-extra-large-default` | 16 px |
| Full        | 토큰 없음, height ÷ 2 공식으로 계산 | --    |

#### 6-3. Border width

- **원칙**
  - **Borders when necessary only**: border 는 negative space 를 어지럽힙니다. 가능하면 negative space 와 section title 로 구분합니다. border 가 필요한 예는 action button group 사이 divider, panel·card 경계입니다.
  - **Consistent border widths**: 단일 border width 를 쓰고, 두께는 focus·selection 처럼 의미 있는 변화에만 바꿉니다. 시각적 흥미나 hierarchy 를 위해 바꾸지 않습니다.
- **System** (in-product UI 에서는 2종)
  - Medium 2 px: 대부분의 기본값. border 옵션이 있는 컴포넌트와 keyboard focus ring 에 씁니다.
  - Small 1 px: accordion·table 같은 고밀도 컴포넌트·pattern
- **적용**
  - divider end cap: container 양 끝까지 닿으면 square, 양 끝에 gap 이 있으면 fully rounded
  - header 에서 global action 과 현재 view 용 action 그룹을 divider 로 나눕니다.

**Tokens** (web)

| Style  | Token              | Value |
| ------ | ------------------ | ----- |
| Small  | `border-width-100` | 1 px  |
| Medium | `border-width-200` | 2 px  |
| Large  | `border-width-400` | 4 px  |

본문은 "two border widths" 라고 하지만 token 표에는 Large 4 px 까지 3단계가 있습니다. Large 의 용도 설명은 파일에 없습니다.

#### 6-4. Drop shadow

- **원칙**
  - Create elevation: 다른 콘텐츠 위에 있음을 표시
  - Support emphasis: sparingly 사용
- **System**

| #   | Style               | 용도                                                                           |
| --- | ------------------- | ------------------------------------------------------------------------------ |
| 1   | Emphasized, default | 페이지 안의 container 강조                                                     |
| 2   | Emphasized, hover   | 컨테이너 전체가 interactive 일 때 hover (예: select box)                       |
| 3   | Elevated            | 콘텐츠 위에 뜨는 container (menu, tooltip)                                     |
| 4   | Dragged             | container 는 기본적으로 shadow 가 없음. drag 시 적용 (default·emphasized 모두) |

- **구성**: 3 layer 입니다.
  - Key: 배경 대비 가장자리
  - Transition: key 와 ambient 사이를 부드럽게
  - Ambient: 전체 깊이와 총 크기
- **Dark theme**: opacity 가 light 의 3배입니다. popover 처럼 위에 뜨는 컴포넌트는 dark theme 에서 border 를 추가합니다.
- **Overlay**: dialog 뒤에 overlay 가 있으면 추가 shadow 가 필요 없습니다.

**Shadow styles** (web, composite token 1개 = 3 layer. X·Spread 는 모두 0)

| Shadow style        | Token                        | Key (Y / Blur) | Transition (Y / Blur) | Ambient (Y / Blur) |
| ------------------- | ---------------------------- | -------------- | --------------------- | ------------------ |
| Emphasized, default | drop-shadow-emphasized       | 0 / 1          | 1 / 4                 | 2 / 8              |
| Emphasized, hover   | drop-shadow-emphasized-hover | 0 / 2          | 2 / 6                 | 4 / 12             |
| Elevated            | drop-shadow-elevated         | 0 / 2          | 2 / 6                 | 4 / 12             |
| Dragged             | drop-shadow-dragged          | 0 / 6          | 6 / 8                 | 12 / 16            |

**Shadow colors** (base 는 #000000)

| Shadow color            | Token                                    | Light | Dark |
| ----------------------- | ---------------------------------------- | ----- | ---- |
| Emphasized (Key)        | `drop-shadow-emphasized-key-color`       | 8%    | 24%  |
| Emphasized, hover (Key) | `drop-shadow-emphasized-hover-key-color` | 12%   | 36%  |
| Elevated (Key)          | `drop-shadow-elevated-key-color`         | 12%   | 36%  |
| Dragged (Key)           | `drop-shadow-dragged-key-color`          | 16%   | 48%  |
| All styles (Ambient)    | `drop-shadow-ambient-color`              | 8%    | 24%  |
| All styles (Transition) | `drop-shadow-transition-color`           | 4%    | 12%  |

- Emphasized-hover 와 Elevated 는 offset·blur·key 색이 모두 같고, 용도만 다릅니다.

---

---

## D. 콘텐츠 — voice and tone · 문법 · word list · 오류 · onboarding · 포용 문구

---

### 1. Voice and tone (`content_voice-and-tone.md`, 3.8KB — 짧은 페이지)

#### 핵심 개념

- **한 가지 voice, 상황에 따라 바뀌는 tone**: "We speak with one voice and vary our tone depending on situational context."
- **Voice 원칙 3가지** (design principles 를 문구에도 적용):

| 원칙         | 정의                              | 규칙                                                                                                     |
| ------------ | --------------------------------- | -------------------------------------------------------------------------------------------------------- |
| **Rational** | Clear and understandable          | 문법·표기 결정은 연구에 근거하고 테스트를 거친다. 지나치게 주관적이거나 웃기거나 유행을 타는 말은 피한다 |
| **Human**    | Friendly, honest, and responsible | 읽기 쉽고 공감되도록 문장 형태·구조를 바꿔 가며 쓴다. 사용자의 감정을 인정하고 고려한다                  |
| **Focused**  | Concise and simple                | 필요한 것만 쓰고 장식은 뺀다. 새 개념을 만들지 않고, 꼭 필요할 때만 이름을 붙인다                        |

- **Tone** = voice(제품의 personality)를 표현하는 여러 방식. 상대와 상황(슬픔·기쁨·좌절)에 따라 달라진다. 좋은 경험을 만들기도 하고, 나쁜 경험에서는 분위기를 풀어 주기도 한다.
- **Tone Spectrum**: motivational → helpful → instructive → reassuring → supportive 로 이어지는 축. 각 지점이 딱 갈라지지 않아서 두 지점 사이에 있을 수도 있다.

#### Tone guide (빈도 포함)

| Tone         | Attitude                  | 예시                                                                                                                 | Frequency    |
| ------------ | ------------------------- | -------------------------------------------------------------------------------------------------------------------- | ------------ |
| Motivational | Positive and encouraging  | "We're looking out for you and cheering you on. You've got this!"                                                    | Rarely       |
| Helpful      | Polite and respectful     | "We know you're busy, so we'll make this brief."                                                                     | Occasionally |
| Instructive  | Neutral and direct        | "Here is the information you need."                                                                                  | **Often**    |
| Reassuring   | Professional and reliable | "We know you're worried about this issue, and we're here to help."                                                   | Occasionally |
| Supportive   | Concerned and empathetic  | "Something bad has happened and we understand how you feel. We want to inform, guide, and support you through this." | Rarely       |

정리하면 기본 tone 은 **Instructive(중립·직접)** 이고, 양 끝(Motivational·Supportive)은 드물게만 씁니다.

---

### 2. Grammar and mechanics (`content_grammar-and-mechanics.md`, 55KB)

**전제**: 기준 언어는 U.S. English 입니다. 컴포넌트 수준 가이드가 있으면 그것을 따르고, locale 표준에 맞춰 국제화합니다. 기본 스타일은 **AP style** 이며, 이 페이지에 적힌 것만 예외입니다.

#### 2.1 능동태와 수동태

- 대부분 **능동태**를 쓰고, 수동태는 아껴 씁니다. 수동태는 말투를 누그러뜨리거나 거리를 둘 때 씁니다(예: 계정 비활성화 알림).
- 능동태 — Do: "Jess Williams resolved your comment." / Don't: "Your comment was resolved by Jess Williams."
- 수동태가 맞는 경우(능동태가 너무 거칠 때) — Do: "Your payment was declined." / Don't: "We declined your payment."
- 초점을 대상이나 사용자가 할 수 있는 행동으로 옮겨 수동태를 피하기 — Do: "Something went wrong." "No search results." / Don't: "An error was made." "We couldn't find any search results."

#### 2.2 축약형 (Contractions)

- 대화체로 들리도록 축약형을 씁니다. 흔한 예: What's, We'll, You'll, You're, You've, We're, They're, Doesn't, Didn't, Isn't, Aren't, Can't.
  - Do: "If you can't." "You aren't connected." "This app isn't available."
  - Don't: "If you cannot." "You are not connected." "This app is not available."
- 주의 사항:
  - 명사에 is/does/has/was 를 축약하지 않습니다(소유격처럼 보임). Don't: "Your document's ready to view."
  - 드물거나 옛날식 축약(would've, tweren't)은 쓰지 않습니다.
  - 구어체 축약(ain't, y'all, yinz)은 쓰지 않습니다. Don't: "Ya'lls account has been disabled."
  - 한 문장에 축약형이 너무 많으면 읽기 어렵습니다.
  - **법률·결제·계정 보안 문구에서는 축약형을 피합니다.** 민감한 정보에는 캐주얼한 말투가 맞지 않습니다.

#### 2.3 시제 (Verb tenses)

- **단순 시제**(past / present / future)를 씁니다. 완료형과 진행형은 피합니다.
- 단순 미래는 "지금 일어나는 즉시 처리의 결과"나 "실제 미래의 일"에 씁니다.
- 예시:
  - Past — "You updated this app to version 13.1." / "You entered an incorrect password."
    (✗ "You're updating…", "You've entered…")
  - Present — "Here are all of the spaces you can access." / "You can't undo this action."
    (✗ "…you've accessed.", "You're not undoing this action.")
  - Future — "If you turn off snapping, you won't be able to use the relative spacing feature." / "Your credit card will be charged at the end of your trial."
    (✗ "won't be using", "will have been charged")
- 이유: 단어가 적다, 훑어 읽기 쉽다, 미국 거주자의 20% 이상이 집에서 영어 외 언어를 쓴다(U.S. Census), 현재형이 readability 점수를 올린다.
- **단순 시제가 아닌 표지**: 동사 앞에 was/wasn't, were/weren't, has/hasn't, have/haven't, is/isn't, are/aren't, be 가 오거나 동사가 "-ing" 로 끝나면 단순 시제가 아닙니다.

#### 2.4 대소문자 (Capitalization)

- **Sentence case** 를 제목·UI 요소(tooltip, tab, menu item 포함) 전부에 씁니다.
  - 구·제목·UI 참조의 첫 단어만 대문자로 씁니다(예: **Adjust borders** tool).
  - 고유명사·브랜드 용어는 항상 대문자로 씁니다(Adobe Help Center).
  - 약어는 대문자로 씁니다(XD, AEM).
  - Do: "Edit your contact information" / Don't: "Edit Your Contact Information"
  - Do: "select the **Brush** tool" / Don't: "**Brush Tool**"
- **Title case** 는 공식 개체(제목·이름)를 가리킨다는 것을 분명히 할 때만 씁니다. 남용하면 없는 격식을 암시해 사용자에게 스트레스를 줍니다.
- **All caps** 는 아껴 씁니다. 허용되는 경우는 두 번째 언급부터의 약어(Adobe Experience Manager (AEM))와 파일 확장자(TIF, ZIP, PSD) 뿐입니다. **강조에는 절대 쓰지 않습니다.** Don't: "Aem…", "ALWAYS save your psd file".
- **Branded terms** 는 title case 로 씁니다. 원문 목록: Creative Cloud, Photoshop, Lightroom, Illustrator, Premiere Pro, XD, Adobe Stock, Document Cloud, Fill & Sign, Magic Heal, Adobe Sensei, Experience Cloud, Advertising Cloud, Analytics, Audience Manager, Campaign, Experience Manager, Commerce Cloud, Marketo Engage, Adobe Acrobat, Adobe Sign.

#### 2.5 대명사 (Pronouns)

- 원칙: 누가 일을 일으키는지보다 **무슨 일이 일어나는지**를 말합니다. 사용자의 입장에서 말하지 않고 사용자에게 말합니다.
- **2인칭**(you, your, you're)이 기본입니다. Do: "You can export your data here." "Your profile." / Don't: "I can export my data here." "My profile."
- **1인칭**(me, I, my)은 세 경우에만 씁니다.
  1. 사용자가 인터페이스에 응답하거나 직접 받은 질문에 답할 때
  2. 추가 배려나 프라이버시 표시가 필요할 때
  3. 법적으로 1인칭 동의가 필요할 때 ("I agree to these terms and conditions")
  - Do: "Yes, I agree to these terms of service." / Don't: "You agree to these terms of service."
- **we/us = Adobe** 는 드물게만 씁니다. 심각한 오류의 "We're sorry", 피드백 요청의 "Help us improve this feature" 정도입니다.
- **Singular they**: he/she, (s)he 는 쓰지 않습니다. they / them / their / theirs / themselves / themself 를 씁니다. Do: "Assign them a role." "Read what they wrote." / Don't: "Assign him/her a role."

#### 2.6 구두점 (Punctuation)

**공통**: 코드·수식·단축키·파일 이름처럼 정해진 관례가 있는 곳은 그 관례를 따릅니다. 기호로 단어를 대신하지 않고("&" 대신 "and", "@" 대신 "at"), 디자인 요소나 장식으로 쓰지 않습니다. 코드는 Code typography 로 구분합니다.

| 기호            | 규칙                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Do / Don't                                                                                   |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Ampersand &     | UI 문구에서 쓰지 않고 "and" 로 풀어 씁니다. 이유: 비원어민 이해, 번역 용이, 인지 부담 감소, 접속사(가장 덜 중요한 부분)로 시선이 쏠림, 글자보다 커서 산만함                                                                                                                                                                                                                                                                                                                       | ✓ "Digital video and audio" ✗ "Digital video & audio"                                        |
| Apostrophe '    | 따옴표 대신 쓰지 않습니다. s 로 끝나지 않으면 's, s 로 끝나는 복수 명사는 ' 만 붙입니다. 나머지는 AP style 을 따릅니다                                                                                                                                                                                                                                                                                                                                                            | ✓ Creative Cloud's "All Apps" plan, plans' pricing ✗ 'All Apps'                              |
| Asterisk *      | 필수 필드 표시는 * 또는 "(required)" 로 합니다. **선택 항목 표시에는 쓰지 않습니다.** 라벨 문자열에 * 글자를 넣지 말고 Spectrum 컴포넌트에 내장된 asterisk icon 을 씁니다. 괄호나 tooltip 으로 충분하면 본문·라벨에 쓰지 않습니다(각주 * 금지)                                                                                                                                                                                                                                    | ✗ "Address 2 (optional)" 에 *                                                                |
| At sign @       | "at" 대신 쓰지 않습니다                                                                                                                                                                                                                                                                                                                                                                                                                                                           | ✗ "Adobe MAX is @ the…"                                                                      |
| Brackets [] {}  | UI 문구와 문장에서 쓰지 않고 괄호 ( ) 를 씁니다                                                                                                                                                                                                                                                                                                                                                                                                                                   | ✓ "Downloading… (1 of 2)" ✗ "[1 of 2]"                                                       |
| Colon :         | 먼저 문장을 나누어 보고, 그래도 안 되면 colon 을 씁니다. 목록·단계 도입에 쓰며 목록은 새 줄에 둡니다. 큰 headline 이나 마케팅 성격 문구에도 씁니다. **폼 필드 라벨 끝에는 쓰지 않습니다**(컴포넌트가 이미 관계를 보여 줌)                                                                                                                                                                                                                                                         | ✓ "To merge PDF documents:" ✗ "Name:"                                                        |
| Comma ,         | serial(Oxford) comma 를 씁니다. 쉼표가 많으면 마침표나 em dash 로 나눕니다                                                                                                                                                                                                                                                                                                                                                                                                        | ✓ "JPEG, PNG, or GIF" ✗ "JPEG, PNG or GIF"                                                   |
| Ellipsis …      | 좁은 공간의 잘림 표시와 진행 중 상태(대기·로딩, 예: "Signing out…")에 씁니다. **버튼에는 대체로 쓰지 않습니다.** 예외는 버튼이 전혀 다른 복잡한 뷰로 이동시킬 때(dialog → settings panel)입니다. **Picker 의 prompt text 끝에는 붙입니다**("Select category…"). OS 기본 메뉴는 OS 지침을, Spectrum Menu 는 Menu 가이드를 따릅니다. 본문에서 이름이 …으로 끝나는 UI 요소를 가리킬 때는 …을 뺍니다("Use **Find** to search…"). More 메뉴는 문자열 … 이 아니라 _more_ icon 을 씁니다 | ✗ "More actions…" 버튼, "Go to website…" heading                                             |
| Emoji           | 인터페이스 문구에서 전혀 쓰지 않습니다(부적절한 tone, 현지화 어려움, 가독성 저하). 단수·복수 모두 "emoji" 입니다                                                                                                                                                                                                                                                                                                                                                                  | ✓ "Welcome to Creative Cloud, Marisa — we're glad you're here."                              |
| Equals =        | "equals", "meaning", "means", "is" 대신 쓰지 않습니다                                                                                                                                                                                                                                                                                                                                                                                                                             |                                                                                              |
| Exclamation !   | 쓰지 않습니다(현지화 어렵고 남용되기 쉬움)                                                                                                                                                                                                                                                                                                                                                                                                                                        | ✗ "Welcome…, Marisa! We're glad you're here!"                                                |
| > <             | 탐색(breadcrumbs)에는 컴포넌트 내장 chevron icon 을 씁니다. 흐름 단계는 목록으로 보여 줍니다. 단어 대신이나 장식으로 쓰지 않습니다                                                                                                                                                                                                                                                                                                                                                | ✗ "Go to File > choose Save as > rename", "Learn more >"                                     |
| Em dash —       | 별개이지만 관련된 생각을 구분합니다. **앞뒤에 공백**을 둡니다                                                                                                                                                                                                                                                                                                                                                                                                                     | ✓ "Never miss a comment — turn on notifications in Acrobat."                                 |
| En dash –       | 숫자 범위와 기간에 **공백 없이** 씁니다. "from"/"between" 과 함께 쓰지 않습니다. 표의 null·불가·해당 없음 값 표시에 씁니다                                                                                                                                                                                                                                                                                                                                                        | ✓ "Repeat steps 1–4", "between 03/01/2020 and 03/31/2020" ✗ "1 - 4", "03/01/2020-03/31/2020" |
| Hyphen -        | 단어 사이에 공백 없이 씁니다                                                                                                                                                                                                                                                                                                                                                                                                                                                      | ✓ "auto-update" ✗ "auto - update"                                                            |
| Minus −         | "minus/without/less/negative" 대신 쓰지 않습니다                                                                                                                                                                                                                                                                                                                                                                                                                                  |                                                                                              |
| Parentheses ( ) | 보충 맥락에 씁니다. **단순 tooltip 에는 쓰지 않고**, rich tooltip 에서는 단축키 표시에 써도 됩니다. brackets 로 대체하지 않습니다                                                                                                                                                                                                                                                                                                                                                 | ✓ "Clone Stamp tool (shortcut, S)", "Command-C (Mac) / Control-C (Windows)"                  |
| Period .        | 완전한 문장이면 마침표를 찍고, 짧은 구(단독이든 toast·alert banner 안이든)에는 찍지 않습니다. 목록 항목에는 대부분 찍지 않지만, 한 항목이라도 완전한 문장이면 모든 항목에 찍습니다. **header 와 button 에는 찍지 않습니다**                                                                                                                                                                                                                                                       | ✓ "Legal name / Mailing address / Birthdate"                                                 |
| Plus +          | "and", bullet, 장식, "더 있음" 표시로 쓰지 않습니다                                                                                                                                                                                                                                                                                                                                                                                                                               |                                                                                              |
| Question mark ? | **제목에 쓸 수 있는 유일한 구두점**입니다. 수사 의문문은 피합니다                                                                                                                                                                                                                                                                                                                                                                                                                 | ✓ "What are your skillsets?" ✗ "What can't you do with Creative Cloud?"                      |
| Quotation " "   | 인용과 파일·asset 이름에만 씁니다. 코드가 아니면 항상 smart(curly) quotes 를 씁니다(straight quote 는 prime 기호와 혼동됨). **UI 요소 지칭에는 따옴표 대신 bold** 를 씁니다                                                                                                                                                                                                                                                                                                       | ✓ "Select the **Lasso** tool" ✗ 'Select the "Lasso tool"'                                    |
| Semicolon ;     | 쓰지 않습니다. 마침표나 쉼표, 가끔 em dash 를 씁니다(격식적·학술적이고 이해도를 떨어뜨림)                                                                                                                                                                                                                                                                                                                                                                                         |                                                                                              |
| Slash / \       | backslash 는 쓰지 않습니다. 단어·생각을 / 로 잇지 말고 "and"/"or" 를 씁니다. **"and/or" 금지**                                                                                                                                                                                                                                                                                                                                                                                    | ✗ "guidances/frameworks"                                                                     |
| Vertical bar \| | 본문에서 쓰지 않습니다. 웹페이지 title 태그와 footer 외에는 쓰지 않습니다. 쓸 때는 텍스트 문자가 아닌 icon 을 쓰고, JAWS 에서 이름을 "Pause" 로 바꿉니다                                                                                                                                                                                                                                                                                                                          | ✗ "Learn more \| Download XD"                                                                |

#### 2.7 약어 (Abbreviations)

- 경험 전체에서 일관되게 씁니다. **string description 과 alt text 에는 약어 대신 전체 단어**를 씁니다(현지화와 screen reader 때문).
- **Amounts**: K / M / B 는 대문자로, 마침표 없이, 숫자와 단위 사이에 공백을 둡니다 → "71 M records found".
- **Measurements**: 완전한 문장에서는 단위를 풀어 씁니다(2 points, 2 pixels, 2 megabytes). 약어로 쓸 때는 공백을 둡니다(2 pt, 2 MB, 2 min, 2 hr).
- **Months**: Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec (마침표 없음).
- **Days**: Sun Mon Tue Wed Thu Fri Sat (마침표 없음).
- **Time**: sec / min / hr 를 단수형으로, 마침표·쉼표 없이, 숫자와 공백을 두고 씁니다 → "1 hr 21 min". am/pm 은 소문자로, 앞에 공백 없이 씁니다. 24시간제(17:15)에서는 쓰지 않습니다.

#### 2.8 숫자 (Numbers)

- **Currency**: 격식이 필요하거나 값이 동적이라 센트가 나올 수 있으면 $1.00, 캐주얼·중립 tone 이거나 공간이 좁고 반올림이 가능하면 $1 을 씁니다. 통화를 구분해야 하면 국제 약어를 씁니다("$100 USD equals $138.21 SGD"). Don't: "$150 in US dollars", "$10.00 a month".
- **Large numbers**: 세 자리마다 쉼표를 찍습니다(1,000 / 1,000,000). 크고 딱 떨어지는 수는 단어로 씁니다(4 thousand, 81 million, 2.5 billion).
- **Numerals**: 본문에서 zero~~nine 은 단어로, 10 이상은 숫자로 씁니다. 시각·연속·범위·timestamp 는 0~~9 도 숫자로 씁니다. 숫자는 강조 효과가 있습니다: "Read all eight comments" 는 댓글이 있다는 사실, "Read all 8 comments" 는 개수에 초점이 갑니다. 통화나 시간과 다른 수가 함께 나오면 다른 수를 단어로 써서 통화·시간을 돋보이게 합니다. Do: "1–10 possible results", "Sign up for two months and save 20%" / Don't: "One to 10…", "Sign up for 2 months and save $20…".
- **Percentages**: "percent" 대신 % 기호를 씁니다.

#### 2.9 날짜와 시간

- **Dates**: Full 은 "Monday, August 21, 2017 at 3:07pm", Compact 는 "Mon, Aug 21, 2017, 3:07pm" 입니다. 유럽·영국식은 "Monday, 21 August at 15:07" / "Mon, 21 Aug, 15:07" 입니다. U.S. 숫자형은 MM/DD/YYYY 로 2자리 0 채움(02/24/2000) — 표·목록 비교가 쉬워집니다. (원문 본문은 "MM-DD-YYYY" 라고 쓰고 예시는 슬래시를 씀 — 원문 결함.) 현지화 전문가와 협의합니다.
- **Time**:
  - 정각에 :00 을 쓰지 않습니다.
  - 범위는 en dash 를 공백 없이 쓰고, 앞뒤 am/pm 이 같으면 앞쪽 am/pm 을 생략합니다 → "1:30–2pm".
  - 24시간제에는 am/pm 을 붙이지 않습니다.
  - ✓ "12:45pm", "1pm", "17:16" ✗ "12:45 PM", "1:00pm", "from 1:30pm to 2pm", "17:16pm".
- **Relative time**: 단위 임계에 도달하면 큰 단위를 씁니다 → 1 hour(60 minutes 아님), 1 day(24 hours 아님), 1 month(30 days 아님), 1 year(365 days 아님).
- **Elapsed time 단계**: Just now → 1 minute ago → X minutes ago → 1 hour ago → X hours ago → 1 day ago → X days ago → 1 month ago → X months ago → 1 year ago → X years ago. ✗ "60 minutes ago", "1 days ago", "3y ago". (✓ 예시 이미지에 "3 yrs ago" 가 있음.)
- **Remaining time**: "X hours/minutes/seconds remaining". 추정치이면 앞에 "About" 을 붙입니다. ✓ "About 1 hour remaining", "2 hrs remaining" ✗ "About 60 minutes remaining", "1 minutes remaining", "2h remaining".
- **Timestamps**: 정밀도가 필요하면 HH:MM:SS 로 씁니다("01:12:34.55"). 1시간 미만 영상은 시를 생략합니다("12:51"). ✗ "1hr 12 min 34.55sec".
- **Time zones**: 가능하면 사용자 시간대로 동적 변환합니다. 절대 시간대는 Pacific Time 같은 일반 명칭을 쓰고 UTC 공식은 쓰지 않습니다. 공간이 좁으면 PST/EST 를 쓰되 현지화팀에 맥락을 줍니다. 상대 표현은 "in your time zone" 으로 씁니다. ✓ "Yesterday at 4:58pm Eastern" ✗ "UTC-5".

#### 2.10 목록 (Lists)

- 비중이 같은 2개 이상 개념은 bulleted list, 순서가 있는 단계는 numbered list 로 씁니다.
- 도입구에 colon 을 붙이고, 각 항목이 그 도입구와 이어지게 씁니다. ✓ "You can choose: small, medium, large." ✗ "Choose one. Small, medium, large."
- 병렬 구조로 씁니다. 각 항목 첫 글자는 대문자로, 종결 구두점은 완전한 문장일 때만 붙입니다. 행동 목록은 모두 동사로 시작하고, 명사 목록은 모두 명사로 씁니다. ✗ "It's happening in: Cities in Indiana, Illinois, and in Ohio, too."
- 각 항목은 sentence case 로 씁니다. ✓ "Vanilla bean, Mint chocolate chip, Mocha" ✗ "Vanilla Bean, mint chocolate chip".

원문 결함: At sign 예시 alt 에 "at" 이 "and" 로 잘못 적혀 있습니다.

---

### 3. In-product word list (`content_in-product-word-list.md`, 39KB)

**사용법**: 어휘를 일관되게 쓰면 신뢰가 쌓입니다. 대소문자는 Grammar and mechanics 를 따르고, 브랜드 용어는 Adobe Brand Guidelines 를 따릅니다. 목록은 계속 갱신되며 완전하지 않습니다.

**Status 4종**: **Preferred** / **Use with caution** / **Avoid** / **Required**

원문 항목 전부(중복 항목 `start` ×2, `update` ×2 포함)를 범주별로 묶었습니다.

#### 3.1 동작·CTA 동사

| 용어                      | Status           | 쓸 것 / 피할 것 · 이유                                                                                                                                                                                                                                               |
| ------------------------- | ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| add                       | Use with caution | CC 에서는 이미 있는 asset 을 브라우저·뷰로 가져오는 동작이고, Experience Cloud 에서는 이미지 전용입니다. 예: "Add PNG", "Add images, fonts, styles, and more to a library…". **사람을 문서에 초대하는 동작에는 쓰지 않습니다**                                       |
| begin                     | Preferred        | 설명문용입니다. CTA 에는 _start_ 를 씁니다                                                                                                                                                                                                                           |
| start (1)                 | Preferred        | CTA 에서 _begin_ 보다 우선합니다. 변형("Start tour")도 됩니다                                                                                                                                                                                                        |
| start (2)                 | Preferred        | 기기·프로세스·워크플로를 시작하는 동작에 씁니다                                                                                                                                                                                                                      |
| close                     | Preferred        | 닫기 동작의 포괄 용어이며 OS 패턴도 가리킵니다. 가능하면 _publish/export/delete_ 같은 워크플로 동사를 _close/finish/OK_ 보다 우선합니다                                                                                                                              |
| continue / cancel         | Preferred        | 앞으로 가는 길이 하나뿐이고 건너뛰기·뒤로 가기가 없는 워크플로의 쌍 동작입니다                                                                                                                                                                                       |
| dismiss                   | Avoid            | 확인·완료 의미로 쓰지 않고 _OK_ 를 씁니다. "다시는 보지 않겠다" 수준의 hard dismiss 에서만 예외로 허용하며, 가능하면 icon-only close(cross icon)를 씁니다                                                                                                            |
| done                      | Use with caution | 닫기 CTA 에는 _close/finish_ 를 우선합니다(형용사보다 동사). _finish/close/OK_ 가 어색할 때 modal·dialog·overlay 의 단독 버튼에 씁니다. 종결감을 줍니다                                                                                                              |
| finish                    | Preferred        | 사용자가 시작한 프로세스·흐름의 완료를 headline·본문·metadata 에 씁니다. 상호작용 학습의 마지막 단계에 쓸 수 있고, 자동으로 뜨는 것에는 쓰지 않습니다                                                                                                                |
| OK                        | Preferred        | 부정적 영향이 없는 확인의 primary action 입니다. 어떤 요소에서든 **모두 대문자 OK** 로 씁니다(Ok/ok/Okay/okay ✗). 결제·동의 흐름에서는 피하고, 무엇에 동의하는지 구체적인 동사로 씁니다                                                                              |
| got it                    | Avoid            | 지나치게 구어체이므로 _OK_ 를 씁니다                                                                                                                                                                                                                                 |
| skip                      | Preferred        | coach mark series 같은 단계형 흐름의 CTA 로 씁니다                                                                                                                                                                                                                   |
| submit                    | Preferred        | 폼 데이터 전송 동작입니다. 피드백 공유 CTA 도 _Share_ 가 아니라 _Submit_ 입니다                                                                                                                                                                                      |
| next / back               | Preferred        | 앞뒤로 오가는 워크플로(투어·작업)에 씁니다                                                                                                                                                                                                                           |
| next / previous           | Preferred        | 페이지네이션(검색 결과 페이지)에 씁니다                                                                                                                                                                                                                              |
| open                      | Preferred        | 파일·앱·서비스·그 일부를 여는 동작입니다("Open a new window")                                                                                                                                                                                                        |
| open in                   | Preferred        | _edit in / view in / comment in_ 보다 우선합니다(이후 동작을 추측하지 않음). 앱 맥락이 같으면 "Open in {surface} app"("Open in desktop app"), 앱이 바뀌면 "Open in {appName} {surface}"("Open in Illustrator desktop") 로 씁니다. 이후 동작은 보조 문구로 설명합니다 |
| edit in                   | Avoid            | _open in_ 을 참조합니다                                                                                                                                                                                                                                              |
| send to                   | Avoid            | _open a copy_ / _open a copy in_ 을 씁니다                                                                                                                                                                                                                           |
| launch                    | Avoid            | 앱·서비스·새 창에는 _open_ 을 씁니다                                                                                                                                                                                                                                 |
| quit                      | Avoid            | 플랫폼 종속입니다(macOS quit, Windows exit/close). 특히 CTA 로 쓰지 않습니다. macOS 동작을 일반적으로 가리킬 때만 씁니다                                                                                                                                             |
| relaunch                  | Avoid            | 하드웨어·프로세스·앱·서비스 모두 _restart_ 를 씁니다                                                                                                                                                                                                                 |
| restart                   | Preferred        | 앱·서비스·기기·프로세스·워크플로를 다시 시작하는 동작입니다                                                                                                                                                                                                          |
| refresh                   | Preferred        | 화면 갱신·문제 해결 동작입니다("Refresh this page and contact support if the issue persists")                                                                                                                                                                        |
| reload                    | Use with caution | 대부분 _Refresh this page_, _Restart the app_ 으로 대체합니다                                                                                                                                                                                                        |
| load                      | Use with caution | "Loading…", "Loading {appName}…", "Can't load page" 같은 메시지에 씁니다. 동작에는 _open_ 을 씁니다                                                                                                                                                                  |
| load more                 | Use with caution | _generate more_ 를 참조합니다                                                                                                                                                                                                                                        |
| enable / disable          | Avoid            | 불필요하게 기술적입니다. _turn on / turn off_ 를 씁니다                                                                                                                                                                                                              |
| turn on / turn off        | Preferred        | 기능·모드의 활성·비활성 동작입니다                                                                                                                                                                                                                                   |
| switch on / switch off    | Use with caution | _turn on/off_ 를 우선합니다. switch 컴포넌트를 직접 가리킬 때만 씁니다. "switch between modes" 는 괜찮습니다                                                                                                                                                         |
| toggle                    | Avoid            | 동사·명사 모두 jargon 입니다. UI 요소를 언급하지 말고 기능을 말합니다. _turn on / turn off_ 를 참조합니다                                                                                                                                                            |
| lock / unlock             | Preferred        | lock 은 현재 상태로 고정해 선택·변경을 막고, unlock 은 선택·편집을 허용합니다. 보통 padlock icon 으로 표현합니다                                                                                                                                                     |
| run                       | Use with caution | 기계·시스템이 주체일 때 씁니다(run a report/script/simulation)                                                                                                                                                                                                       |
| export                    | Preferred        | 다른 형식으로 저장할 때 씁니다. 그대로 다른 앱에서 열면 _open in_ 입니다                                                                                                                                                                                             |
| import                    | Use with caution | CC 에서는 다른 형식으로 변환해 엽니다. 비디오 제품에서는 add·place 를 포함해 링크로 ingest 합니다. Experience Cloud 에서는 데이터 소스 추가입니다. 예: "Go to **File** > **Import** to open a Sketch file in XD."                                                    |
| embed                     | Preferred        | 원본과 연결이 끊긴 정적 사본을 대상 파일에 저장합니다. 예: "Place as embedded"                                                                                                                                                                                       |
| link                      | Preferred        | 원본 참조로 배치하며, 양쪽 변경이 자동 반영됩니다. 예: "**File** > **Place** > **Linked object**"                                                                                                                                                                    |
| place                     | Preferred        | 원본 콘텐츠를 대상 파일로 가져옵니다. linked 또는 embedded 로 배치합니다                                                                                                                                                                                             |
| download                  | Preferred        | 안내 문구는 OS 어휘를 따릅니다. 서버 → 기기 전송에만 씁니다. 설치·업데이트 흐름에서는 단계를 명시합니다                                                                                                                                                              |
| install                   | Preferred        | 안내 문구는 OS 어휘를 따릅니다. 기기에 소프트웨어를 추가해 쓸 수 있게 하는 과정입니다. 스토어·웹으로 이동시키면 **Install** CTA 를 쓰지 않습니다                                                                                                                     |
| update (1)                | Preferred        | upgrade 와 달리 보통 결제가 없습니다("Update your browser")                                                                                                                                                                                                          |
| update (2)                | Preferred        | 동사는 새 버전으로 교체하는 행위, 명사는 교체 버전입니다. 스토어·웹으로 이동시키면 **Update** CTA 를 쓰지 않습니다                                                                                                                                                   |
| update later              | Use with caution | 업데이트 연기 또는 조건부 자동 업데이트 CTA 입니다                                                                                                                                                                                                                   |
| update now                | Use with caution | 나중에/지금 중 선택할 수 있을 때만 씁니다                                                                                                                                                                                                                            |
| upgrade                   | Preferred        | 보통 결제가 필요합니다("Upgrade your plan")                                                                                                                                                                                                                          |
| view                      | Preferred        | 포용성을 위해 _see_ 보다 우선합니다("View all results")                                                                                                                                                                                                              |
| see                       | Avoid            | _view_ 를 씁니다("See all results" ✗)                                                                                                                                                                                                                                |
| create                    | Use with caution | 설명문에만 씁니다. 생성형 AI 의 UI 동작으로 쓰지 않습니다(_generate_)                                                                                                                                                                                                |
| recommend, recommendation | Preferred        | **사람이** 주체일 때 씁니다("We recommend backing up your work before sharing")                                                                                                                                                                                      |
| suggest, suggestion       | Preferred        | **AI·기술이** 주체일 때 씁니다                                                                                                                                                                                                                                       |
| please                    | Preferred        | 안내 문구와, 큰 노력·시간이 드는 행동을 요청하는 오류 메시지에 씁니다("Please provide feedback", "Please reload the page")                                                                                                                                           |
| sorry                     | Use with caution | 큰 중단·불편(기기 재시작, 저장한 작업 손실)이 생긴 오류에서만 씁니다                                                                                                                                                                                                 |

#### 3.2 상호작용(제스처) 지시

| 용어           | Status           | 쓸 것 / 피할 것 · 이유                                                                                                      |
| -------------- | ---------------- | --------------------------------------------------------------------------------------------------------------------------- |
| select         | Preferred        | click/tap 대신 씁니다. 기기에 구애받지 않고, 보조기술 사용자에게도 맞고, 디자인이 바뀌어도(클릭 → 슬라이더) 그대로 통합니다 |
| click          | Avoid            | CTA 와 알맞은 컴포넌트로 상호작용을 암시합니다. 결과를 가리킬 때는 CTA 와 같은 단어를 씁니다                                |
| tap            | Use with caution | click 과 같습니다. 태블릿에서 점을 찍는 것처럼 기기 특성상 피할 수 없을 때만 씁니다                                         |
| drag and drop  | Use with caution | OS 와 같은 단어를 씁니다                                                                                                    |
| long press     | Use with caution | OS 와 같은 단어를 씁니다                                                                                                    |
| pinch          | Use with caution | OS 와 같은 단어를 씁니다                                                                                                    |
| press          | Use with caution | OS 와 같은 단어를 씁니다                                                                                                    |
| scroll         | Use with caution | OS 와 같은 단어를 씁니다                                                                                                    |
| swipe          | Avoid            | OS 와 같은 단어를 씁니다. 모바일 OS 의 직관적 동작에만 맡기면 문구에 쓸 일이 없습니다                                       |
| touch and hold | Avoid            | OS 와 같은 단어를 씁니다                                                                                                    |

#### 3.3 UI 요소 지칭

| 용어          | Status           | 쓸 것 / 피할 것 · 이유                                                                                                                          |
| ------------- | ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| affordance    | Avoid            | 내부 jargon(feature/control)입니다. 컴포넌트의 용도(동작)를 말합니다                                                                            |
| button        | Preferred        | 버튼 이름보다 동작(undo, edit)을 말합니다. 직접 가리킬 때는 이름만 대문자·bold 로 쓰고 "button" 은 그대로 둡니다(**Undo** button)               |
| **More** menu | Preferred        | … 메뉴를 직접 가리키는 것을 피합니다. 필요하면 **More** 는 대문자·bold, menu 는 소문자·non-bold 로 씁니다                                       |
| panel         | Use with caution | 꼭 필요할 때만 UI 이름을 언급하고, 상호작용이 아니라 동작을 말합니다. 고정 위치에 여러 도구를 모은 접을 수 있는 탐색 요소에만 "panel" 을 씁니다 |
| rail          | Avoid            | 내부 jargon 입니다. 모양이 아니라 그 안의 기능·동작을 말합니다                                                                                  |
| tab           | Preferred        | 탭 이름은 UI 표기 그대로 bold 로 쓰고, "tab" 은 소문자·non-bold 로 씁니다(**Learn** tab)                                                        |
| tool          | Preferred        | 도구 이름은 UI 표기 그대로 bold 로 쓰고, "tool" 은 소문자로 씁니다(**Pen** tool)                                                                |
| surface       | Avoid            | 내부 용어(Adobe.com, CC desktop, mobile, web 같은 제공 틀)입니다                                                                                |

#### 3.4 앱·파일·상태 명사

| 용어                               | Status           | 쓸 것 / 피할 것 · 이유                                                                                                                                                                                             |
| ---------------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| app                                | Preferred        | _application_ 보다 짧고 데스크톱·모바일 모두에 통합니다                                                                                                                                                            |
| application                        | Use with caution | _app_ 을 우선합니다                                                                                                                                                                                                |
| program                            | Avoid            | _app_ 을 씁니다                                                                                                                                                                                                    |
| product                            | Use with caution | 내부 jargon 입니다. 자체 완결된 경험을 뜻할 때만 아껴 쓰고, 판매 단위 개념은 _app_ 으로 씁니다                                                                                                                     |
| software                           | Use with caution | app/service/product 로 부족할 때만 씁니다                                                                                                                                                                          |
| solution                           | Use with caution | jargon 입니다. 안 맞는 사람이 스스로를 "problem" 으로 느낄 수 있습니다. _solve / help solve / helps (someone) do (something)_ 같은 동사구를 씁니다                                                                 |
| platform                           | Use with caution | 기반 인프라 개념(system 과 구분)이며 맥락 의존적입니다(UXP, 기기, OS, Adobe Experience Platform)                                                                                                                   |
| service                            | Preferred        | "Adobe 가 제공하는 무언가"(plugins, cloud storage, search, help)입니다                                                                                                                                             |
| feature                            | Use with caution | 결과 지향의 단일 기능입니다. "제품 전부" 의 뜻으로 쓰지 않습니다                                                                                                                                                   |
| asset                              | Use with caution | 모호한 일반어입니다. 가능하면 video, illustration 처럼 구체적으로 쓰고, 안 되면 asset 을 씁니다                                                                                                                    |
| document                           | Preferred        | DC 에서는 모든 형식의 파일이고, CC 에서는 로컬은 _file_ 로 써서 cloud documents 와 구분합니다                                                                                                                      |
| cloud documents                    | Preferred        | 브랜드가 아닌 기능 이름이라 소문자로 씁니다(컴포넌트 표기 규칙은 따름). XD·Photoshop 에만 붙이고 Creative Cloud 에는 붙이지 않습니다. cloud docs / documents 로 줄이지 않습니다(모바일 공간 제약 예외는 추후 안내) |
| cloud docs                         | Avoid            | 내부 jargon 입니다(모바일 공간 제약 예외는 추후 안내)                                                                                                                                                              |
| file name                          | Preferred        | 두 단어로 씁니다. filename 은 시스템의 기술적 이름(확장자 포함)입니다                                                                                                                                              |
| file type                          | Preferred        | 두 단어로 씁니다. 글자 수 제약이 없으면 약어로 줄이지 않습니다                                                                                                                                                     |
| JPEG                               | Preferred        | JPG 가 아니라 JPEG 로 씁니다                                                                                                                                                                                       |
| name                               | Preferred        | 필드 라벨에 씁니다. _title_ 을 name 의 뜻으로 쓰지 않습니다                                                                                                                                                        |
| title                              | Avoid            | 필드 라벨에서는 _name_ 을 씁니다                                                                                                                                                                                   |
| template                           | Preferred        | "starter file" 같은 jargon 대신 씁니다                                                                                                                                                                             |
| plugin                             | Preferred        | 한 단어, 하이픈 없이 씁니다(plug-in ✗)                                                                                                                                                                             |
| OS                                 | Preferred        | operating system 의 약어입니다. 풀어 써도 됩니다                                                                                                                                                                   |
| wifi                               | Preferred        | 모두 소문자, 하이픈·공백 없이 씁니다                                                                                                                                                                               |
| settings                           | Preferred        | 메뉴 이름에 종류를 밝힙니다(App settings, Account settings)                                                                                                                                                        |
| preferences                        | Use with caution | settings 의 하위 개념입니다. preferences 를 "setting" 한다고 하지 않고 customize/choose/select 라고 씁니다                                                                                                         |
| entitlement                        | Use with caution | 내부 jargon 입니다(entitlement-aware 포함)                                                                                                                                                                         |
| latest version / older version     | Preferred        | 앱 버전에 씁니다                                                                                                                                                                                                   |
| current version / previous version | Avoid            | 위 표현을 씁니다                                                                                                                                                                                                   |
| space                              | Preferred        | 로컬 기기의 여유 공간입니다("You don't have enough space on your computer…")                                                                                                                                       |
| storage                            | Preferred        | 클라우드 용량입니다("Your Creative Cloud storage is full")                                                                                                                                                         |
| in the cloud                       | Preferred        | on the cloud ✗. "with the cloud" 는 "software with cloud services" 형태만 허용합니다                                                                                                                               |
| on the cloud                       | Avoid            | in the cloud, to/from the cloud 를 씁니다                                                                                                                                                                          |
| to / from the cloud                | Preferred        | to the cloud 로 업로드, from the cloud 로 다운로드합니다                                                                                                                                                           |
| available / not available          | Preferred        | **일시적으로** 쓸 수 없을 때(점검 등) 씁니다                                                                                                                                                                       |
| supported / not supported          | Preferred        | **영구적으로** 쓸 수 없을 때(구버전·비인가) _not supported / no longer supported_ 를 씁니다                                                                                                                        |
| recalled · rescinded · revoked     | Avoid            | 부정적이고 꾸짖는 느낌을 줍니다. not supported / not available 을 쓰고, 원인 대신 해결로 안내합니다                                                                                                                |
| fail, failure                      | Use with caution | 모호하고 부정적인 기술어입니다. 구체적으로 쓸 수 있으면 오류 메시지에서 피합니다                                                                                                                                   |
| success, successful, successfully  | Avoid            | 대부분 군더더기입니다. "Your password was reset" ✓ / "…has been reset successfully" ✗                                                                                                                              |

#### 3.5 학습 콘텐츠

| 용어     | Status           | 쓸 것 / 피할 것 · 이유                                                      |
| -------- | ---------------- | --------------------------------------------------------------------------- |
| tutorial | Preferred        | 단일 또는 2개 이상 시리즈에 씁니다                                          |
| series   | Preferred        | tutorial 목록입니다. _playlist_ 보다 우선합니다                             |
| playlist | Use with caution | _series_ 를 씁니다("Select the second tutorial in the series")              |
| course   | Use with caution | tutorial / tutorials / tutorial series 를 씁니다                            |
| lesson   | Avoid            | Learn 팀이 쓰지 않는 단어입니다                                             |
| video    | Use with caution | tutorial 의 가벼운 대체어로 아껴 씁니다. 미디어 종류를 말할 때는 우선합니다 |

#### 3.6 가격·체험

| 용어       | Status           | 쓸 것 / 피할 것 · 이유                                                                                                                                                                                |
| ---------- | ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| free       | Use with caution | 무료이고 카드·구독이 필요 없을 때만 씁니다. 체험은 _free trial_ 입니다                                                                                                                                |
| free trial | Preferred        | 결제 체험의 **법적 필수** 용어이며 무결제 체험에도 우선합니다. 결제 체험의 첫 CTA 는 "Start free trial" / "Free trial" / "Start free trial to subscribe" / "Agree and start free trial" 중 하나입니다 |
| freemium   | Avoid            | 내부 jargon 입니다. 첫 CTA 는 "Start for free" / "Download for free" / "Start now" / "Download" / "Get started" 중 하나이고, 무결제 기능은 "free to try" / "free to edit" 로 씁니다                   |
| trial      | Avoid            | _free trial_ 을 참조합니다                                                                                                                                                                            |

#### 3.7 생성형 AI

| 용어                        | Status           | 쓸 것 / 피할 것 · 이유                                                                                                                                         |
| --------------------------- | ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| generate                    | Required         | 생성형 AI 의 UI 동작입니다. 첫 실행, 프롬프트 수정, 변형 교체(옛 _refresh_)에 씁니다                                                                           |
| generate again              | Required         | 흔하지 않습니다. 단일 변형을 교체하는데 generate 만으로 불분명할 때 씁니다(Premiere Pro generative extend). 다수 변형은 generate more 입니다                   |
| generate more               | Required         | 변형이 쌓이는 경우 _load more_ 대신 씁니다                                                                                                                     |
| generate similar            | Required         | _show similar_ 대신 씁니다                                                                                                                                     |
| regenerate                  | Avoid            | 위 generate 계열을 씁니다                                                                                                                                      |
| show similar                | Use with caution | _generate similar_ 를 참조합니다                                                                                                                               |
| generations                 | Use with caution | 산출 행위를 뜻하는 명사입니다("This feature uses 100 credits per generation.", "Each generation outputs 4 images.")                                            |
| generative AI               | Required         | GenerativeAI / GenAI / Gen AI 같은 줄임은 쓰지 않습니다                                                                                                        |
| gen tech                    | Avoid            | 생성형 AI 를 가리키는 데 쓰지 않습니다                                                                                                                         |
| generative credits          | Preferred        | 맥락이 분명하면 두 번째 언급부터 _credits_ 로 줄여도 됩니다                                                                                                    |
| credits                     | Use with caution | _generative credits_ 를 참조합니다                                                                                                                             |
| custom models               | Required         | 고유 스타일로 학습한 모델입니다. title case 로 쓰지 않습니다(브랜드 아님)                                                                                      |
| variations                  | Required         | 생성 결과물의 라벨입니다("Your prompt will generate four variations"). _results_ 는 피합니다                                                                   |
| results                     | Use with caution | 생성물 라벨로 쓰지 않습니다. tooltip 의 효과 설명("for a desired result")에는 괜찮습니다                                                                       |
| reference X                 | Required         | 생성에 쓰는 참조 요소입니다("reference image")                                                                                                                 |
| prompt                      | Use with caution | Content Strategy·Brand·Legal 승인 뒤 일관되게 씁니다. 장차 _input_ 같은 말로 바뀔 수 있습니다                                                                  |
| one-of-a-kind X / unique X  | Avoid            | 생성물이 100% 고유하다고 보장할 수 없습니다                                                                                                                    |
| intelligent · magic · smart | Avoid            | UI 요소 이름에 쓰지 않습니다                                                                                                                                   |
| User Guidelines             | Required         | Adobe Generative AI User Guidelines 는 첫 언급과 두 번째 언급 모두 title case 로 씁니다. GenAI User Guidelines / GenAI Terms / terms 같은 줄임은 쓰지 않습니다 |
| watermark, watermarking     | Preferred        | 명사는 덧씌운 로고·텍스트·서명이고, 동사는 작가 식별·저작권 보호·무단 사용 방지·마케팅 용도입니다                                                              |

#### 3.8 포용성·기타

| 용어         | Status           | 쓸 것 / 피할 것 · 이유                                                                                                                                                               |
| ------------ | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| blacklist    | Avoid            | 인종차별에 뿌리가 있습니다. (Action)(object) 형식을 씁니다: "Blocked users", "Prohibited IP addresses"                                                                               |
| whitelist    | Avoid            | 같은 이유입니다. "Shared domains", "Approved users", "Targeted sites"                                                                                                                |
| master       | Avoid            | 편견에 뿌리가 있습니다. _primary / main / source_(main track, source graphic)를 쓰고, 계층은 primary / secondary / tertiary 로 씁니다(master/slave ✗)                                |
| redline      | Avoid            | 인종차별에 뿌리가 있습니다. _specifications / specs_ 를 씁니다                                                                                                                       |
| stuff        | Avoid            | 미국 중심 구어이고 현지화가 어렵습니다. 대상을 직접 씁니다("files", "your stuff" ✗)                                                                                                  |
| auto / auto- | Use with caution | 기능명·라벨은 형용사형(Auto tag, Auto crop, Auto save)으로 쓰고 Brand 팀 승인이 필요합니다. 일반 지칭은 결합형(auto-tag, auto-save), 동작 설명은 automatic / automatically 로 씁니다 |

---

### 4. Writing for errors (`content_writing-for-errors.md`, 30KB)

#### 4.1 정의

- 원문 인용: "An error occurs when users expect one thing to happen, but either something else — or nothing — happens."
- 오류 메시지는 사용자에게 **what happened**, **the cause of the error**, **what (if anything) they can do to resolve it** 을 알리려고 보여 줍니다.
- 기술 수준과 관계없이 최종 사용자를 위해 써야 합니다.

#### 4.2 오류 메시지 설계 기초 (content 와 design 은 분리할 수 없음)

1. **Avoid showing a message whenever possible** — "The best error message is no error happening at all."
   - in-line validation, 시각 단서, disabled state 로 오류 자체를 막습니다. 검색에서는 여러 철자를 수용합니다.
   - 다음 단계를 쓸 수 없으면 disabled state 로 알립니다.
   - Do: Description(required) 이 비어 있으면 Cancel/Submit 이 disabled.
   - Don't: 활성 Submit 을 누르면 "Enter your description." 오류 — "Don't create unnecessary error messages as a workaround to unintuitive design."
2. **Have the system automatically resolve errors** — 오류 메시지는 최후 수단입니다.
   - Do: Opacity 에 101% 를 넣으면 시스템이 100% 로 되돌립니다.
   - Don't: "Enter a valid percentage." 를 보여 줍니다.
3. **Choose the message first, then the component** — 복잡한 메시지는 toast 에 너무 길고, 짧은 메시지는 alert dialog 에 과합니다. 낮은 신호의 오류는 경험 전체를 막는 dialog 를 쓸 만하지 않고, 높은 우선순위 오류는 몇 초 뒤 사라지는 toast 에 두지 않습니다.
   - Do (alert dialog): 제목 "Unable to share", 설명 "An error occurred while sharing your project. Please verify the email address and try again.", 버튼 "OK".
   - Don't: 같은 문구를 toast 에 넣습니다.

#### 4.3 Anatomy of an error message (3부 구조)

- **What happened** / **The underlying cause (if possible)** / **How to fix it**
- 모든 메시지가 이 구조를 따르지는 않습니다. 대상과 상황에 따라 원인은 생략할 수 있습니다.
- 원문 도해 예시:
  - 제목(what happened): "Your file could not be saved."
  - 원인: "There was an error in connecting to the server, so this file was not saved to your cloud documents."
  - 해결: "Please wait a few seconds and try saving the file again. If the problem continues, let us know."

각 부분의 규칙과 예시:

- **What happened**: 메시지 첫 부분이고, 가능하면 headline 입니다. 일반적인 결과를 plain language 로, 사용자에게 의미하는 바 중심으로 씁니다.
  - ✓ "Your files didn't sync."
  - ✗ "FORBIDDEN This operation has failed to execute."
- **The underlying cause**: 공간이 있으면 도움이 되지만 선택 사항입니다. 이해를 돕기도 하고, 유용한 정보를 가리기도 합니다.
  - ✓ "We're unable to install or update {appName} due to insufficient disk space. (Error code: 189)"
  - ✓ "The installer can't download {appName} because Adobe's servers aren't reachable. Check the Adobe status page for an outage and retry the installation later. (Error code: 206)"
  - ✗ 같은 문구에 "This may be due to user error, employee error, or something else." 를 덧붙임
- **How to fix it**: 사용자가 할 수 있는 일을 말하고, 할 일이 없으면 제품이 무엇을 하고 있는지 설명합니다. 단순하고 실행 가능하게 씁니다. "Try again"·"Go back" 버튼이나 단계별 해결을 오류 상태 안에 둡니다. 도움말 링크는 그 오류에 특화된 문서일 때만 둡니다. "Contact your IT administrator for details." 같은 포괄 해결은 피합니다.
  - ✗ "Upload your files one more time." (✓ 예시는 이미지에 alt 가 없음)

#### 4.4 Be empathetic to users, not the system

- **Center the language around user goals, not system constraints**
  - ✓ "Accept the End User License Agreement terms."
  - ✗ "There was a RAISE without a handler."
- **Use plain language, and avoid jargon** — 기술 용어는 jargon 과 다르므로 대상이 익숙하고 관련이 있으면 써도 됩니다.
  - ✓ "Due to a connection error, some results may be unavailable."
  - ✗ "Due to a server-side connectivity failure, some results may be unavailable."
- **Don't blame the user, even if the error is their fault**
  - ✓ "Your computer appears to be offline. Connect to the internet and try again. (Error code: 206)"
  - ✗ "You went offline. Connect to the internet and try again. (Error code: 206)"
- **Include error codes only if useful and relevant** — **오류 코드는 메시지 끝에** 둡니다.
  - ✓ "This profile is currently unavailable. Try reloading the page. (Error code: 10213)" (기술지원 문의 참조용)

#### 4.5 Be as useful as possible

- **사용자가 할 수 있는 일에 초점을 맞춘 긍정 표현** — 문제, 할 수 없는 것, 잘못한 것에 초점을 두지 않습니다.
  - ✓ "Enter your system administrator password to continue. Check for an OS prompt and follow the instructions."
  - ✓ "The installer shut down unexpectedly. Please select Retry to restart the process. (Error code: 305)"
  - ✗ 같은 문구에서 해결 안내를 뺀 것
- **경우마다 구체적인 오류 상태** — 포괄 메시지는 장황하고 인지 부담이 큽니다. 구체적 메시지는 분석·예방 인사이트도 줍니다.
  - ✓ "Your wifi connection is unstable and affecting download speed. Try switching to an ethernet cable."
  - ✗ "There's an issue wrong with your internet connection. It could be your wifi, router, modem, or ethernet cable."
- **오류는 구체적으로, 언어는 일반적으로** — 파일명·사용자명·폴더명은 UI 다른 곳에서 알 수 있으니 넣지 않습니다(현지화, 문구 변형 수 감소).
  - ✓ "Your document could not be saved. Please try again."
  - ✗ "Your document "Final-proposal-May-Monthly-Meeting.indd" could not be saved to the library "May Proposals""

#### 4.6 메시지 작성: voice · tone

- Voice 는 Rational / Human / Focused 그대로입니다.
- 오류용 tone 3종:

| Tone            | When to use                                                | Example                                                                                                                                                                                                                                           |
| --------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Instructive** | 양이 적고 결과가 가벼운 오류. 오류 상태만 알리면 될 때     | _"Unable to load this page."_                                                                                                                                                                                                                     |
| **Reassuring**  | 사소한 오류. 사용자가 걱정할 때 도움이 있다고 알림         | _"Our servers timed out and we couldn't save your file. Please try again, and if the problem persists, contact your IT administrator."_                                                                                                           |
| **Supportive**  | 나쁜 일이 생긴 큰 오류. 사용자의 동요를 인정하고 안내·지원 | _"We're sorry, but we couldn't renew your subscription because your credit card has expired. You still have 90 days to recover your files and apps by renewing your subscription with an active card. Contact us if we can help you get set up!"_ |

- **Don't apologize unless it's warranted** — "sorry" 는 데이터 손실이 있거나 큰 조치가 필요한 심각한 오류에만 씁니다.
  - ✓ "We couldn't post your comment. Try again"
  - ✗ "Oops! So sorry, but we couldn't post your comment. Try again"
- **Use passive voice sparingly** — 기본은 능동태이고, 사용자의 행동이나 무행동이 원인일 때 수동태로 누그러뜨립니다.
  - ✓ "We couldn't save your changes. Please try again." / "Your credit card could not be charged. Please add an active card to continue your subscription."
  - ✗ "Your changes could not be saved. Please try again." / "You didn't add a new card after your current card expired, so if you want to continue your subscription, add it now."
- **"we" 와 "you" 로 책임 주체를 밝히기** — 평소에는 "we" 를 피하지만, 오류에서는 "어디서 잘못됐나 / 누가 고쳐야 하나" 를 분명히 해 줍니다.
  - ✓ "Something went wrong and we couldn't generate your report. Please try again in a few minutes."
  - ✗ "Experience Cloud encountered an error and this report couldn't be generated. The user can try again in a few minutes."

#### 4.7 컴포넌트 선택 프레임워크

**원칙**: 메시지를 먼저 쓰고 컴포넌트를 고릅니다. 어떤 행동이 오류를 일으키는지, UI 상 공간적 관련성, 직전 사용자 행동을 고려합니다. **컴포넌트당 오류 메시지는 1개**로 합니다(toast 는 시점·심각도에 따라 쌓임).

평가 축 3개:

- **Consequence**: Low = 쉽게 해결됨 / High = 고위험·파괴적
- **Complication**: Low = 지금 영향 외에 설명할 게 거의 없음 / High = 상황이 길고 구체적임
- **Action**: Low = 할 수 있는 게 없거나 "try again" 정도 / High = 설정 변경·앱 재시작 등 능동적 해결이 필요함

| 컴포넌트          | Consequence | Complication | Action | 용도·예시                                                                                                                                                                                                                                                                                                                                                  |
| ----------------- | ----------- | ------------ | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Alert dialog**  | High        | High         | High   | task-level 오류. 결과가 크고 복잡하며 시급하고 조치가 필요해 진행을 막는 오류. 매우 방해가 되니 의식적으로 씁니다. 예: 잘못된 이메일로 파일 공유 불가 / 계정이 침해되어 로그인 불가 / bulk upload CSV 형식 오류로 처리 불가. 문구: "Unable to share" + "An error occurred while sharing your project. Please verify the email address and try again." + OK |
| **Alert banner**  | Low         | Low          | High   | system-level, 긴급하고 신호가 높은 메시지. 빨강(negative)·회색(neutral) variant. 방금 한 행동과 직접 관계없지만 주의가 필요한 경우. 연결 오류에 적합. 문구: "connection interrupted"                                                                                                                                                                       |
| **Help text**     | Low         | Low          | High   | 입력과 연결된 in-line 오류. 무엇을, 어떻게 입력·선택할지, 형식 예시와 요구사항. 여러 개는 in-line alert 로 모을 수 있습니다. 문구: "Enter your credit card number." / "Create a password with at least 8 characters."                                                                                                                                      |
| **In-line alert** | Any         | High         | High   | 뷰 안 객체와 연결된 non-modal 메시지. 폼 검증에서 여러 필드 피드백을 하나로 모읍니다. 빨강(negative)·주황(notice) variant. dialog 는 과하지만 진행하려면 보여야 할 때. 문구: "Unable to process payment" + "There was an error processing your payment. Please check that your credit card information is correct, then try again."                        |
| **Toast**         | Low         | Low          | Low    | 짧고 일시적이며 응답이 필요 없는 메시지. 빨강(negative) variant. 맥락적이거나 사용자 행동이 일으킨 오류(항목 이동, canvas 동작). 가능하면 in-line action 을 붙입니다. 문구: "Unable to delete file."                                                                                                                                                       |

---

### 5. Writing for onboarding (`content_writing-for-onboarding.md`, 26KB)

#### 5.1 개념

- Onboarding 은 "new user experience" 이면서, 숙련자에게 새 제품·기능·요소를 소개하는 과정이고, 지속적 사용자 교육도 포함합니다. 무언가를 가르칠 때마다 onboarding 입니다.
- 성장과 유지의 가장 큰 요인입니다. 초기 사용자와 달리 이후의 다른 동기를 가진 사용자에게 관심을 유지시키는 수단입니다. "onboarding is how a promised user experience bridges what is actually delivered."
- 목표는 "a-ha" moment(제품이 자기에게 맞고 가치를 얻는다고 깨닫는 순간)입니다.

#### 5.2 학습·실행 경험 작성 원칙 6가지

1. **Reflect what your users already know** — 초보인지 숙련자인지, 한 번에 얼마나 감당할 수 있는지.
2. **Remember why your users are there** — 같은 Photoshop 이라도 디자인 목적과 사진 목적은 여정이 다릅니다.
3. **Sequence topics** — 논리적 순서로 배치합니다. 나누거나 줄이기 쉬워지고, 선수 지식을 명시합니다.
4. **Focus each tutorial on one tool or technique** — 방법이 여럿이면 tutorial 당 하나만 다룹니다.
5. **Don't overload your users with steps** — **tutorial·product tour 는 10단계 미만**으로 하고, 더 필요하면 단위를 나눕니다.
6. **Set accurate expectations** — 첫 단계에서 배울 것, **단계 수, 소요 시간, 실제 산출물**을 밝힙니다.

#### 5.3 학습을 소개하고 장려하는 문구

- **Use lightweight language for learning**
  - 무거운 말(피함): _learning, course, class, training, lesson, teaching, instruction, education, homework, exercise_
  - 가벼운 말(씀): _tutorial, try it out, explore, practice, do {something}, guided, guidance, session, video, developing skills, going deeper, show how, walk through, grow/develop skills_
  - ✓ "Try editing your clips" / "This session shows you how to start editing videos." / [Take in-app tutorial]
  - ✗ "Learn After Effects with our free course" / [Open in browser]
- **Use jargon with caution**
  - 제품이나 업계와 무관한 jargon 은 피합니다(관련 있으면 가르치되 이미 안다고 가정하지 않음). buzzword 를 피하고 새 jargon 을 만들지 않습니다.
  - **한 문장에 jargon 1개**만 씁니다.
  - **Explain, then name** — 첫 언급에서 정의하고 나서 이름을 줍니다.
  - ✓ "Our collection of videos and in-app tutorials, called Learn, is for all experience levels."
  - ✗ "Let's develop your skills. Start learning today." / "…revisit completed courses."
- **Avoid directly referring to the interface** — 접근성·확장성·향후 변경에 불리합니다. _tab, panel, menu, page, section_ 을 붙이지 않고 "Learn" 을 단독 고유명사로 씁니다("Go to Learn", "find it in Learn", "Learn has more tutorials"). 번역팀에는 UI 맥락을 제공합니다.
  - ✓ "Want more tutorials?" / "Find our collection of free tutorials in Learn." / [Go to Learn]
  - ✗ "…in the Learn tab." / [Open Learn tab]
- **Frame educational content as personalized and specific** — 포괄어 _collection, complete set, playlist, all tutorials_ 를 피하고, 덧붙이는 말 _this tutorial and others, this and many more videos, this and other subjects, advanced, beginner_ 로 개인화를 암시합니다. 관련 내용을 먼저 내세우고 그다음에 "더 있다" 고 말합니다.
  - ✓ "Today's practice: titles and graphics" / "Try this hands-on tutorial and many more in Learn."
- **Set positive expectations** — "Open in browser" 는 의욕을 떨어뜨립니다(연구 결과). _open in browser, view on the web, view online_ 을 피하고 _go to, play video, check it out, find out more, back to Learn, back to in-app tutorials, all tutorials on {subject}_ 를 씁니다. "go to" 는 현재 경험을 떠난다는 것을 암시합니다. 완료 뒤에는 홈이나 시리즈의 다음 tutorial 로 가는 동작을 우선합니다.
  - ✓ "Looking for more on color?" / [Go to color tutorials]
- **Prioritize in-app learning** — 홈 화면에서 제품 밖으로 내보내는 경험을 피합니다. _in-app, inside the app, in-app tutorial, alongside your work in the app, right here, without leaving the app_ 을 씁니다.
  - ✓ "Start with the shape tools" / "This session gives instructions alongside your work in the app."
  - ✗ "First up: Using the shape tools" / "This speedy series teaches you…" / [Make an icon] — in-app 임을 숨김

#### 5.4 Onboarding 기법 11가지

| 기법              | 정의                                                                                              | 용도                                                                               | 원문 예시                                                                                                                                                                                                                                                                                                                                |
| ----------------- | ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Banner            | 최상위 추천. 범위가 정해진 실행 가능 콘텐츠로, 안내·마케팅 혼합 문구. 왜 탐색할지와 기대치를 설명 | 확인되었거나 가설인 a-ha moment 로 유도                                            | "Try editing your clips" / "Introducing Adobe Fresco" + [Learn more]                                                                                                                                                                                                                                                                     |
| Card              | 현재 뷰와 관련된 콘텐츠로 유도. banner 보다 위계가 낮음                                           | 부가 경험 홍보                                                                     | "Get started with Illustrator… 10 tutorials. 170 minutes." / "How to use · Brush tool · tutorial completed"                                                                                                                                                                                                                              |
| Coach mark        | UI 상호작용을 유도하는 임시 메시지. 연결하면 tour·tutorial 이 됨                                  | 새롭거나 낯선 경험, 다른 위치 안내                                                 | "Everything's in one spot" (1 of 4) [Next] / "Pan camera" (4 of 8) [Skip tour][Next]                                                                                                                                                                                                                                                     |
| **Empty state**   | 뷰에 무언가를 추가하는 방법을 설명. 한 번도 추가하지 않았거나 전부 삭제했을 때 보임               | 객체·데이터 추가 방법을 상기시키고, 더 자세한 onboarding 을 반복                   | "Work smarter with Creative Cloud Libraries" / "Share, reuse, and manage everything you need for a project. Group together images, colors, fonts, and more." + 링크 "Learn more about libraries" + [Create new library][Follow public libraries] / "Drag and drop your file" / "Select a file from your computer or search Adobe stock." |
| Modal             | informational modal(짧은 문구와 이미지 1~2개)과 rich modal(carousel·video·GIF)                    | 앞쪽은 긍정적이고 작은 변화(기능 재설계), 뒤쪽은 추천 콘텐츠 모음·심화·선택적 이점 | "What's new" (Photoshop CC 6 topics) [Next]                                                                                                                                                                                                                                                                                              |
| Tooltip           | hover·focus 시 특정 컴포넌트의 맥락 도움말. text-only 또는 rich                                   | UI 상호작용으로 발견을 장려. 다른 기법이 안 맞을 때의 가벼운 대안                  | "Create new folder", "List view"                                                                                                                                                                                                                                                                                                         |
| Tour              | UI 를 소개하는 tutorial(coach mark series 나 video)                                               | **어디에 있는지**를 보여 줌. **어떻게 하는지**는 다른 기법으로                     | "Apps" (Step 2 of 6) [Skip tour][Next]                                                                                                                                                                                                                                                                                                   |
| Triggered element | 행동에 반응해 나타나는 콘텐츠(toast 등). **닫은 뒤 어디서 다시 찾는지 설명해야 함**               | 반복 행동이나 기능 사용 빈도에 반응                                                | "Saved to Tips Guide" [View][close] / "Copied to clipboard"                                                                                                                                                                                                                                                                              |
| Tutorial          | 특정 주제·도구·기법의 실용 정보(글·영상)                                                          | 위치에 익숙해진 뒤 특정 결과에 도달하도록                                          | "Get started with Photoshop" 10 chapters + 각 분 단위 시간                                                                                                                                                                                                                                                                               |
| Video demo        | 사람이 작업을 완료하는 모습                                                                       | 워크플로·제품 경험으로 영감을 줌                                                   | Lightroom mobile "Overview and key features"                                                                                                                                                                                                                                                                                             |

원문 결함: Modal 설명에 "informational model" 오타가 있습니다.

---

### 6. Inclusive UX writing (`…_inclusive-ux-writing.md`, 5.8KB — 개관 페이지)

- 포용성을 우선하지 않으면 생기는 영향:
  - **Business**: 연결되는 사람이 줄고, 비포용 제품이 회사의 평판에 반영됨
  - **Brand value**: 투자가 부족했던 공동체 출신 후보 채용이 줄고, 고정관념·편견이 재생산됨
- **"Inclusive UX writing is accessible, but the reverse isn't always true."** 접근성은 포용성의 하위 분야입니다.
- UX 콘텐츠의 범위: 보이는 텍스트(라벨·버튼·링크·폼), 보이지 않는 설명(아이콘 버튼 alt text, 이미지, 워크플로, tutorial 형식), 그 밖에 제품 안에서 읽히는 모든 것. 모두 descriptive 하고 meaningful 해야 합니다.

| Preferred                                 | Avoid                                                 | Why                                                                       |
| ----------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------- |
| People                                    | Customers                                             | 결제하지 않은 사용자도 포함합니다. 결제·구독 맥락이면 customers 도 됩니다 |
| You (사용자 자신에 대해 말할 때)          | Users                                                 | 읽는 사람을 포함합니다. 역할 맥락(권한 관리 admin)이면 user 도 됩니다     |
| "Adobe Dimension helps you create in 3D." | "…is for graphic designers looking to get a 3D edge." | 사용 이유를 넓게 포함합니다                                               |
| View, Show, Go to all                     | See all                                               | 모두가 "보는" 것은 아니고, 동작 단어가 의미가 더 풍부합니다               |
| Play video                                | Watch video                                           | 모두가 "시청" 하는 것은 아닙니다                                          |
| Last updated: 2 days ago                  | Updated • 2d ago                                      | 기호·약어는 screen reader 가 읽으면 의미를 흐립니다                       |
| Update your information (step 1 of 3)     | Confirm your information                              | 단계형 흐름에서 구체적으로 안내하고 소요를 알립니다                       |

- 하위 가이드 3개(about people / readability / visuals)와 참고 자료(WCAG, WAI-ARIA, Material Accessibility Writing, Microsoft Accessibility, NCDJ, Conscious Style Guide, City of Oakland Style Guide 등)를 나열합니다.

---

### 7. Writing for readability (`…_writing-for-readability.md`, 7.3KB)

- **6th-grade reading level**(Flesch-Kincaid)으로 씁니다. 짧은 문장, 부사·형용사 회피, 단순 시제, 능동태. 도구는 Hemingway app 과 Readable 입니다.
- 비교 예시:
  - ✓ "We exported the file. Now you can open it in Illustrator."
  - ✗ "This file has been exported successfully to be opened in one of our other awesome products, Adobe Illustrator."
  - 근거: 4·7단어 2문장 vs 18단어 1문장 / 단순 과거 vs 과거완료 / 능동 vs 수동 / "successfully" 불필요 부사 / "awesome" 불필요 형용사 / **FK grade 4.8 vs 13.1**
- **읽기 시간 추정 수치**: screen reader 사용자는 **초당 25음절**을 듣고, 6학년 수준 독자는 **초당 3단어**를 읽습니다.
- **Choose words consciously**: Buy(Purchase ✗), Help(Assist ✗), About(Approximately ✗), Like(Such as ✗).
- **Write universally**:
  - 친구와 대화하듯 씁니다. 내부·기업 언어와 jargon 은 피하고, 써야 하면 첫 언급에서 in-line 으로 맥락을 줍니다.
  - 관용구(특히 비원어민을 비하한 기원의 "long time no see")를 피합니다.
  - 기호·emoji 에 기대지 않습니다(문화 의존, 번역 불가).
  - 표: Creative Cloud Files(CC Files ✗) / "XD cloud documents, a new way to collaborate on any device"("Introducing XD cloud docs!" ✗) / "Please accept the Terms of Service before continuing."("There was a RAISE without a handler." ✗)
- **Avoid colloquial language and slang**(ageism 방지): Select any that apply("Choose whatever blows your hair back" ✗), Agree to terms and conditions("It be like that sometimes" ✗), Learn more("Get the deetz" ✗).
- **Organize your writing for comprehension**:
  - Layout: 본문은 왼쪽 정렬(RTL 에서는 반전). 양쪽 정렬은 text river 를 만들어 난독증 독자에게 어렵습니다. 한 뷰에서 정렬을 섞지 않습니다. **한 줄 최대 50–75자**, 페이지당 1단.
  - Grammar and mechanics: sentence case, 약어 외 all caps 금지, hashtag 는 camel case(#CamelCase)로 screen reader 파싱을 돕습니다.
  - Interactions: 폼에서 **"clear"·"reset" 동작을 피합니다**(실수로 작업을 지울 수 있음). 폼을 저장했다가 돌아올 수 있게 합니다. 링크 앞이나 안에 키워드를 둡니다.
  - Localization: 브랜드·기술 용어는 먼저 설명하고 씁니다. 드문 약어는 첫 사용 때 전체 용어 뒤에 괄호로 약어를 씁니다(HTML `<abbr>`/`<acronym>`). 동음이의어는 피하거나 맥락으로 분명히 합니다.

---

### 8. Writing about people (`…_writing-about-people.md`, 18.7KB)

#### 8.1 Best practices 4개

- **Use neutral, precise, relevant descriptions** — 관련 있고 중요할 때만 개인 특성을 넣습니다. 쓴 뒤 누구를 중심에 두었는지, 누구를 빠뜨렸는지 돌아봅니다.
- **Choose words carefully and understand historical significance** — 소외 공동체의 용어를 차용하지 않습니다. 이 가이드는 "underrepresented groups" 라고 씁니다.
- **Be clear and avoid stereotypes** — proxy 질문·진술을 경계합니다. 예: "just buy more storage" 는 경제 수준을 가정하는 proxy 이고, "view additional storage options" 는 그렇지 않습니다. 동등한 입장에서 말하고, 최악의 해석을 고려합니다.
- **Account for machine learning and AI** — 데이터 수집은 먼저 필요성을 따지고, 필요하면 이유를 알립니다. common·custom 응답, 자기 정체화, 다중 선택, **응답 거부(opt out)** 를 허용합니다. AI 는 주어진 데이터로만 배워 편향을 이어받습니다.

#### 8.2 장애

- person-first("people who use assistive technology")와 identity-first("deaf people") 중 어느 쪽도 일괄 정답이 아니므로 **당사자에게 묻습니다**. "differently abled" 같은 완곡어와 "the disabled", "the blind" 같은 명사화를 피합니다.
- Disabled person / person with disabilities (Differently abled, the disabled ✗) · Blind person / person who is blind (The blind ✗)
- 장애 비하에 뿌리를 둔 말을 피하고, "suffering", "victim" 으로 묘사하지 않습니다:
  - Ridiculous / unpredictable (Crazy ✗)
  - Inconsiderate (Tone-deaf ✗)
  - Incompetent / bad (Dumb / lame ✗)
  - "Keyanna has autism." ("suffering from autism" ✗)
  - **Placeholder** variable (**Dummy** variable ✗)
  - "Amir uses a wheelchair." ("confined to a wheelchair" ✗)
- 고정관념 피하기:
  - ✓ "This tutorial teaches cropping and usually takes 5 minutes." ✗ "Follow this fast, easy tutorial."
  - ✓ "This feature works best when you zoom out to 75%." ✗ "This feature isn't for the vision-impaired."
- 건강 관련 은유 피하기:
  - **Unavailable / locked / turned off / deactivated** (Grayed out ✗)
  - **Coherence** check (Sanity check ✗)
  - **Organize(d)** (OCD ✗)
- ML·AI: 메타데이터에 주의합니다. 아이 사진에 "crazy", "weird" 태그를 달지 않습니다.

#### 8.3 인종과 계층

- persona 에서 출신국·인종은 일반화하지 않도록 구체적으로 씁니다. 인종은 전기·역사적 사건 콘텐츠에서만 관련이 있습니다. 대소문자는 AP 를 따릅니다(국적·민족·인종(white 제외)·부족은 대문자).
- whitelist / blacklist / master / slave 를 쓰지 않습니다. "dark pattern" 같은 인종적 가치 부여 용어를 쓰지 않습니다. "dark mode", "light theme", "black screen" 은 색·밝기를 가리키므로 계속 써도 됩니다.
  - (Result in past participle form)(object): **Shared domains, approved people, targeted sites** (Whitelist ✗). 코드 구문은 **Allowlist**
  - 같은 형식, 코드 구문은 **Blocklist** (Blacklist ✗)
  - **Legacy** (Grandfather clause ✗)
  - **Futile undertaking / a project destined to fail** (Death march ✗)
  - **Primary / main / source** ("main track") ("Master" descriptors ✗)
  - **Primary/secondary** (Master/slave ✗)
- 관용구는 기원을 확인한 뒤 씁니다. 철자·발음 변형은 억양 비하가 될 수 있습니다. 우편번호로 인종·소득을 추정하는 proxy 를 경계합니다.
- Plain language: Welcome back (Long time no see ✗) · 2-step process (Wax on, wax off ✗) · **Sorry, something went wrong** (No can do ✗)
- 다양한 사람을 전형으로 보여 줍니다:
  - Dark brown / beige / tan / peach (색 swatch 의 Skin / flesh / nude ✗)
  - Critics (Peanut gallery ✗)
  - 다양한 이름 예시 Ayesha, Ibrahim, Vignesh, Quynh (John, Bill, Karen, Amy 만 ✗)
- 업계 jargon 대체:
  - Native to the operating system / built-in feature (Native ✗)
  - Meeting (Pow wow / circle the wagons ✗)
  - Vision statement / strategic statement / value proposition (Zen statement / Zen garden ✗)
  - Role model / kindred spirit (Spirit animal ✗)
  - Guide (Sherpa ✗)
  - Authority / expert (Guru / ninja ✗)

#### 8.4 성별과 성적 지향

- 대명사를 모르면 they 를 씁니다(구문은 복수형). 성별에 뿌리를 둔 역할어를 피합니다.
  - ✓ "They can fill out this form." ✗ "He/she can…"
  - Server(Waitress ✗), Businessperson(Businessman ✗), Flight attendant(Stewardess ✗), They(He/she, (S)he ✗), A group of people / women(Guys / girls / ladies ✗), Parents(Moms ✗)
- 성별·성적 지향 기술어는 명사가 아니라 수식어로 씁니다. 대명사는 선호가 아닙니다.
  - Transgender / trans people (transgendered, transgenders, the transgendered, transexuals ✗)
  - Trans women (Trans-women ✗) · A transgender man (A transman ✗)
  - "Alejandra, a lesbian woman" · "Jing, a non-binary person" · "Saadi is cis" (CIS ✗)
  - "What are your pronouns?" (preferred pronouns ✗) · "Jamal's pronouns are he/him/his." ("prefers" ✗)
  - Wholehearted / impassioned (Hysterical ✗)
- **Be specific and kind** — sex(male/female)와 gender(man/woman)를 구분합니다. 성별 수집이 정말 필요한지 따지고, 필요하면 custom 응답·자기 정체화·다중 선택·opt-out 을 허용합니다. proxy 질문(자전거 사이즈가 필요한데 성별을 묻기)은 하지 않습니다.
  - ✓ 옵션: Man, Woman, Prefer not to answer, Prefer to self-describe
  - ✗ 옵션: Male, Female, Other
  - **Prefer to self-describe / Prefer to not respond** (Other ✗)
- AI·ML 로 이미지·텍스트에서 성별을 추측하지 않습니다(WHO 가 2018년 6월 트랜스젠더를 정신질환 분류에서 제외했지만 ML 은 편향을 이어받을 수 있음).

원문 결함: 장애 절의 Do/Don't 이미지 alt 가 "Placeholder variable" / "Dummy variable" 로, 본문 원칙과 맞지 않는 표 항목이 들어가 있습니다.

---

### 9. Writing with visuals (`…_writing-with-visuals.md`, 16.3KB)

#### 9.1 원칙

- 시각 요소가 없다고 생각하고 씁니다. 이미지를 개념 전달의 유일한 수단으로 쓰지 않습니다. 무엇을 전형으로 보여 주는지 주의합니다("experts" 이미지가 백인만인지 등).

#### 9.2 정보 조직 방식

- **공간이 아니라 시간순**("before/after" vs "above/below")으로 조직합니다. screen reader·확대기 사용자와 방향어가 어려운 학습장애 사용자에게 도움이 됩니다.
- **Modular content**: 레이아웃이나 순서를 바꿔도 정보와 구조를 잃지 않게 씁니다.
  - ✓ "This article describes linking in more detail." ✗ "Click here to learn more about linking."
  - ✓ "Learn how to crop images / Take this hands-on tutorial now. [Start]"
  - ✗ "Ready to learn? / Or are you ready to dig in? How about both? [Start tutorial / Go back]"
  - ✓ "Update your information (step 1 of 3)" ✗ "Confirm your information"

#### 9.3 방향어 피하기

- First(Above ✗) · Next(Below ✗) · In the menu bar(On the left ✗) · Finally(At the bottom ✗)
- 원문 결함: Don't 이미지 alt 도 "An example of correct usage. On the left." 로 표기되어 있습니다.

#### 9.4 오류 예방

- 예측 가능하고 일관되게 씁니다. 화면이 기대대로 보이고 동작하게 하고, 내비게이션과 컴포넌트 식별을 제품 전반에서 일관되게 유지합니다. 폼은 라벨과 안내를 충분히 둡니다. **오류는 아이콘·색만으로 알리지 말고 텍스트로 설명합니다.**
- ✓ Password help text "Password must be at least 8 characters."

#### 9.5 Avoid naming things / Describe what's happening

- 새 이름 하나는 새 개념 하나이고 인지 부담을 늘립니다. 불가피하면 일관되게, 제품 사이에서 같거나 예측 가능하게 이름 짓고, 정의한 뒤 언급합니다.
- coach mark 와 단계형 흐름에는 상황을 설명하는 제목을 달고 같은 상황 안에서 일관되게 유지합니다. 시간 기반 미디어에는 transcript, closed caption, 단계별 글 가이드를 대안으로 둡니다.

#### 9.6 Write about actions and their effects

- 컨트롤이 어떻게 생겼는지가 아니라 무엇을 하는지 씁니다. 컨트롤 종류는 코드로 따로 전달되니 목적을 담은 이름을 붙입니다. 물리적 조작법은 쓰지 않습니다.
  - ✓ coach mark "You can make changes to your post at any time with the Edit tool." ✗ "Click to edit."
- 대응표:
  - Enter email (Type email address ✗)
  - Save (The "Save" button ✗)
  - Zoom in (Pinch the trackpad ✗)
  - Cancel (Close ✗)
  - On/off (Switch/toggle, activate ✗)
  - Menu (Side drawer ✗)
  - Edit (The pencil icon ✗)
  - Select, go to (Click, tap ✗)

#### 9.7 색·아이콘에만 의존하지 않기

- 정보, 동작, 응답 요청, 요소 구분에 단어를 더합니다. 링크 텍스트만 읽어도 목적이 분명해야 합니다("click here", "link" 금지 — screen reader 가 구분하지 못함).
  - ✓ Password 오류 상태 + "Create a password with at least 8 characters." ✗ 빨간 테두리와 아이콘만
- 시각 요소에만 의존하지 않기: Secure site (🔒 ✗) · Saved to the cloud (☁️ ✗) · "The number you entered isn't in our system." (❌ ✗) · The **Go** button (The green button ✗)

#### 9.8 Alt text

- alt text 는 보조기술 사용자뿐 아니라 모두에게 이해를 돕습니다(예: 검색 아이콘 alt "Search Adobe.com"). icon-only 버튼도 텍스트로 목적을 전달해야 하므로 엔지니어와 alt, hint, trait 을 협의합니다.
- 예시:
  - ✓ "Chicago Bulls player Michael Jordan making his first of 38 points against the Utah Jazz…" ✗ "Basketball player making a basket at an arena"
  - ✓ "Animation showing how to use the touch shortcut. Take the tutorial for more info." ✗ 과도한 묘사
- **필요 판정**:
  - 앞뒤 텍스트가 충분히 설명하면 불필요합니다(중복).
  - 독자적으로 정보를 전달하거나 현지화할 글자가 든 이미지에는 필요합니다.
  - 순수 장식에는 대개 불필요합니다.
- **작성 팁 6개**:
  - Be additive — 동반 텍스트를 반복하지 않습니다.
  - Use active voice.
  - Use consistent tone and terminology — 다른 곳에서 소개하지 않은 jargon 은 쓰지 않습니다.
  - Consider localization.
  - **Avoid writing "image of"** — 차트·다이어그램은 "chart of", "diagram of", "data visualization of" 로 씁니다.
  - Use proper grammar and mechanics — **대문자로 시작하고 마침표로 끝냅니다**(문장이 아니어도). 날짜·시간·단위 약어는 풀어 씁니다.
- **유형별 지침**:
  - Photographs and stock images: 전화로 설명하듯 무엇인지만 말합니다.
  - Images that show or function as UI: UI 의 모든 부분과 용도를 screen reader 읽기 순서대로 씁니다. 이미지가 UI 로 작동하면 모양이 아니라 동사로 씁니다("Send message", "paper airplane in motion" ✗).
  - Usage notes and guidelines 이미지: 적용 예와 비적용 예를 설명하고, 이미지 안 텍스트를 포함합니다.

---

### 원문 사이의 긴장

- `close`: word list 에서는 닫기 동작의 포괄 용어로 Preferred 이지만, writing-with-visuals 표에서는 "Cancel ✓ / Close ✗" 입니다. 맥락에 따라 판단해야 합니다.
- `sorry`: word list 는 큰 중단 때만 허용하지만, writing-about-people 은 "Sorry, something went wrong" 을 "No can do" 의 대체어로 제시합니다.
- 날짜: 본문은 "MM-DD-YYYY" 라고 쓰지만 예시는 "02/24/2000" 처럼 슬래시를 씁니다.
