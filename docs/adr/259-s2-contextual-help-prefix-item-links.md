# ADR-259: S2 field 도움말 (`contextualHelp`) · 입력 앞 글자 (`prefix`) · 항목 링크 (`href` · `hideLinkOutIcon`)

## Status

Proposed — 2026-10-12

- 사용자 요청: `/create-adr` (2026-10-12) — S2 프로퍼티 정렬 조사 ([S2_PROP_ALIGNMENT_2026-10.md](../explanation/research/S2_PROP_ALIGNMENT_2026-10.md) §6.1) 의 남은 항목 중 「라 — 새 부품이 필요, 별도 ADR 규모」 를 ADR 로 진행.
- 범위를 정한 사용자 답 (2026-10-12, AskUserQuestion): **「하나로 + href 포함」** — `contextualHelp` · `prefix` · 항목 `href` + `hideLinkOutIcon` 을 ADR 하나에 Phase 로 나눈다. 「하나로, href 제외」 · 「둘로 나눔」 은 기각.
- 사용자가 이미 답한 확인 항목: D2 정본 = S2 1.8.0 고정 → design-data → v3 → 확장 (2026-10-09) · 빌더 = RAC 수준 조립, 레퍼런스 노드 트리 (2026-10-07) · overlay 는 「레퍼런스 구조로」 — `DialogTrigger > Button + Popover` (ADR-255) · 기본 UI 원본 (Label · Input · Button) 을 바꾸면 전 컴포넌트가 따라간다 (ADR-253) · Skia 전용 시각 효과 금지 (D3 대칭) · 저장 문서의 prop 전환은 로드 시 1회 (2026-10-10) · Preview 조작 결과는 문서에 쓰지 않는다 (ADR-250).
- **사용자 결정 1 · 2 — 2026-10-12**: (1) 바깥 링크 글리프 = **「S2 처럼 자동으로」** (L1), (2) 도움말 원본 = **「S2 처럼」** — S2 의 `ContextualHelp` 는 field 밖 (제목 옆 등) 에도 두는 공개 컴포넌트라 독립 원본을 팔레트에 둔다. 자리는 S2 / v3 문서가 도움말을 두는 overlay 묶음 (Dialog · Popover · Tooltip 과 같은 곳) — 팔레트 overlay 묶음의 Popover 뒤.
- 리뷰: round 1 (Codex, 2026-10-12 — [reviews/259.md](reviews/259.md)) HIGH 1 · MEDIUM 2 → **2026-10-12 문서 수리** (Decision 1 · 2 · R9 ~ R11 · G2 · G3 보강): r1-h1 도움말 Button 은 field 의 ButtonContext 를 끊는다 (`slot: false` → RAC `slot={null}`, S2 `ContextualHelp.tsx:197-205` — 끊지 않으면 disabled ComboBox 안 도움말이 같이 비활성 · picker 이름 경로를 상속) · r1-m1 도움말 Popover 의 이름 = 제목 Heading (S2 `ContextualHelp.tsx:54-59, 79-87` 처럼 Popover `aria-labelledby` ↔ title id 를 ContextualHelp 안에서 직접 연결 — 일반 Popover 는 그대로) · r1-m2 앞 글자가 있는 상자 Group 은 비대화형 자리의 mouse `pointerdown` · `touchend` 를 input · textarea 포커스로 넘긴다 (S2 `Field.tsx:258-273`). 수리 검증 round 2 전.
- 범위 밖: S2 `LabeledValue` · `RangeSlider` (우리 type 없음 — S2 의 `contextualHelp` 18 type 중 이 둘을 뺀 16) · 항목 `download` · `ping` · `routerOptions` · `referrerPolicy` (조사 §6.1 「제외 권장」) · Breadcrumb · Card · Link 의 링크 (이미 있음) · 링크 검증 (URL 형식 판정 — 지금 `href` 는 어디서도 형식을 보지 않는다, 별도 작업).

## Context

### 도메인

- **D2 (Props/API)** — S2 1.8.0 의 세 축을 들인다. ① `contextualHelp: ReactNode` (field 16 type — TextField · TextArea · NumberField · ComboBox · Select (S2 Picker) · ColorField · ColorSlider · DateField · DatePicker · DateRangePicker · TimeField · SearchField · CheckboxGroup · RadioGroup · Slider · TagGroup) 와 그 값인 S2 `ContextualHelp` 컴포넌트 (`variant: 'info' | 'help'` 기본 `'help'` · `placement` 기본 `'bottom start'` · `offset` · `crossOffset` · `containerPadding` 기본 8 · `shouldFlip` — S2 `ContextualHelp.tsx:125-180`). ② `prefix: ReactNode` (TextField · TextArea · NumberField · ComboBox · ColorField — 「A non-interactive element that appears before the input」, `TextField.tsx:79-83`). ③ 항목의 `href` · `target` · `rel` (RAC `LinkDOMProps` — ListBoxItem · Tab · Tag · TreeItem · GridListItem · Row · MenuItem; S2 는 ListViewItem · TreeViewItem · Row · Tab · Tag · MenuItem · PickerItem · ComboBoxItem) 와 GridList (S2 ListView) · Menu 의 `hideLinkOutIcon`. ReactNode prop 은 문서에서 **노드** 다 (Card 의 title · description 이 Text 노드인 것과 같은 길 — ADR-256 Phase 10).
- **D3 (시각 스타일)** — 라벨 행 (라벨 글자 + 필수 표시 + 도움말 버튼) · 도움말 버튼 · 도움말 Popover · 입력 상자 안 앞 글자 · 링크 항목의 바깥 링크 글리프. 다섯 모두 Canvas 와 Preview 가 같은 rule 을 읽어야 한다.
- **D1 (DOM/접근성)** — RAC 그대로. 도움말 = RAC `DialogTrigger` + `Button` + `Popover` (S2 `ContextualHelp` 의 구현 — `ContextualHelp.tsx:195-216`, S2 `DialogTrigger` 는 RAC `DialogTrigger` 래퍼). 버튼 이름은 S2 문자열 (`contextualhelp.help` = 「Help」 · `contextualhelp.info` = 「Information」) 이고 `aria-labelledby` = 라벨 id + 도움말 id (`Field.tsx:175-184`). 앞 글자는 input 의 `aria-labelledby` 끝에 붙는다 (`Field.tsx:248-253, 314-320`). 링크 항목은 RAC 가 정한다 — ListBoxItem · Tab · MenuItem 은 `<a>` (`ListBox.mjs:374` · `Tabs.mjs:190` · `Menu.mjs:409`), GridListItem · TreeItem · Tag · Row 는 원래 요소에 `data-href` · `data-target` · `data-rel` (`openLink.mjs:97-108` `useSyntheticLinkProps`).

### 현재 (실측 2026-10-12, main `719b918ee`)

1. **어느 축도 없다** — `packages/shared/src` 에 `contextualHelp` · `ContextualHelp` · `prefix` prop 0건. 항목 binding (ListBoxItem · Tab · Tag · TreeItem · GridListItem · Row) 에 `href` 0건, GridList · Menu 에 `hideLinkOutIcon` 0건 (2026-10-12 accepts probe).
2. **MenuItem 링크는 반쯤 이어져 있다** — DOM 은 `node.props.href` 를 RAC `MenuItem` 에 넘기지만 (`runtime/domBinding.runtime.ts:1821-1824`), MenuItem 은 binding 없는 rule type 이라 accepts 가 `id` 뿐이다 (`document/ruleDefinition.ts:326-330` `ITEM_KEY_TYPES`). `href` 쓰기는 `PROP_NOT_ACCEPTED` (`document/graph.ts:959-970`).
3. **field 구조** (`document/generated/reusableOriginLibrary.ts`):
   - control 상자 `Group` 이 있는 것 — NumberField `Label + Group(Input + Button×2)` (3838-3967) · ComboBox `Label + Group(Input + FieldButton) + Popover` (4739-) · DatePicker · DateRangePicker. 이 넷이 `FIELD_CONTROL_GROUP_HOSTS` (`domain/componentTraits.ts:85-90`) · `CATALOG_WRAPPED_CONTROL_FIELDS` (`runtime/delegatedDom.runtime.ts:576-582`) 이고 Input 의 상자 칠은 Group 이 가진다.
   - 없는 것 — TextField `Label + Input + Description + FieldError` (3711-3774) · TextArea (3776-3836) · ColorField (4105-4159) · SearchField (Group 없음 — ADR-256 G5 예제 5). 상자는 Input 자신이 칠하고, quiet 도 Input rule 의 `&[data-quiet]` 이다 (ADR-253).
   - S2 는 다섯 field 모두 상자 `FieldGroup` (RAC `Group`) 안에 앞 글자 → input 순서로 그린다 (`Field.tsx:255, 290-313`).
4. **라벨 행이 없다** — 라벨은 field 의 직계 Label 노드이고, 필수 표시는 Label 글자 뒤 suffix 다 (DOM `domBinding.runtime.ts:2540-2544` · Canvas `catalogLabelSuffix` `runtime/presence.ts:2409-2430` → `canvasBinding.ts:850`). side label 은 field rule 의 직계 선택자로 2열 grid 를 만든다 — `> .react-aria-Label` 은 1열, 나머지는 2열 (`generated/componentRulesTable.ts:12268-12306` TextField, 형제 field 도 같은 꼴). S2 는 라벨 행 요소 (`FieldLabel` 의 div — `display: inline`) 안에 RAC `Label` + `&nbsp;` + 도움말을 둔다 (`Field.tsx:96-184`).
5. **overlay 재료는 있다** — `DialogTrigger > Button + Popover` (Popover 원본 `reusableOriginLibrary.ts:6580-6650`), Canvas 는 닫힌 Popover 를 그리지 않는다 (`TRIGGER_OVERLAY_CHILDREN` `runtime/presence.ts:59-75`). 레이아웃 frame 은 부품 조회가 건너뛴다 (`PART_FRAME_TYPES` · `catalogPartParent` `presence.ts:210-227`). S2 도움말 Popover 의 slot (Heading · Content · Footer) 중 Content 는 Card · InlineAlert 안, Footer 는 Card 안에만 둘 수 있다 (`componentTraits.ts:114-124` owners).
6. **아이콘은 Lucide** (`packages/rendering/src/icons/lucideIconData.generated.ts`) — 도움말 `circle-question-mark` (:422) · 정보 `info` (:909) · 바깥 링크 `external-link` (:632). S2 의 글리프 (`S2_Icon_HelpCircle` · `InfoCircle` · `ui-icons/LinkOut`) 는 들이지 않는다 — 다른 모든 아이콘과 같은 집합.
7. **Preview 링크 탐색** — `catalogPreviewLinkClick` (`runtime/domView.runtime.ts:86-107`) 이 capture 단계에서 `<a>` 클릭을 받아 내부 경로는 Preview page 이동, 외부는 새 탭, `#` · `_blank` 는 브라우저 그대로. RAC 합성 링크 (GridListItem · TreeItem · Tag · Row) 는 대상 요소 안에 임시 `<a>` 를 붙이고 bubbling click 을 보내 (`openLink.mjs:79-95`) 같은 처리기에 닿는다 — **단 WebKit 은 click 대신 Enter `keydown` 을 보낸다** (`openLink.mjs:55-63`). `RouterProvider` 는 없다.
8. **S2 의 바깥 링크 글리프** — `href` 와 `target="_blank"` 둘 다일 때만 항목 끝에 그린다 (ListView `ListView.tsx:860-861, 987-1003` · Menu `Menu.tsx:828-830, 925-937`), `hideLinkOutIcon` 이 끈다. RAC 는 그리지 않는다.

### 제약

- **Hard**: D3 대칭 — 정지 상태 Canvas ↔ Preview 차이 ADR-248 G3 하니스 기준 (pixelmatch 0.1 ≤ 0.001, raw RGB 카운트 금지). Skia 전용 시각 금지. 접근성 이름은 S2 와 같은 문자열 (도움말 버튼 · 앞 글자를 포함한 input 이름 — 독립 oracle = 설치 S2 를 jsdom 으로 마운트한 출력). pre-push perf ratchet (ADR-246). initial 번들 상한 (Builder ≤ 1,421,000 / Preview ≤ 623,000 B gzip, 만료 2026-10-25).
- **Hard**: 기존 문서 — 이 ADR 은 **기존 원본 템플릿을 바꾸지 않는 길**을 고른다 (아래 Decision). 바꾸지 않으면 `LIBRARY_CONTRACT_VERSION` (41, `document/types.ts:111`) 은 그대로이고 저장 문서 영향 0 이다. 바꿔야 하면 contract 42 + 이전 문서 거부 (ADR-251 · 253 · 256 · 258 의 길) 이고 G0 이 대상 수를 센다.
- **Soft**: 도움말 · 앞 글자는 field 마다 선택 사항이다 — 대부분의 field 에는 없다. 없는 field 의 노드 트리 · 레이아웃 · 칠은 바뀌지 않아야 한다.

### 생성기 질문 (반복 패턴 #2)

`generate-css.ts` 는 part 선택자 (`> .react-aria-Label`) 와 nested 블록을 이미 낸다 — 라벨 행 · 도움말 · 앞 글자 rule 은 새 type 의 rule 과 field rule 의 선택자 추가로 충분하다. 바깥 링크 글리프는 요소가 아니라 binding 이 그리는 `svg` 라 rule 의 part 선택자 (`.link-out`) 로 모양만 낸다.

## Alternatives Considered

### 축 1 — 도움말의 자리

#### 대안 A: prop 문자열 — field 에 `contextualHelpTitle` · `contextualHelpText` 를 두고 binding 이 버튼 · Popover 를 그린다

- 설명: 노드 없이 글자 두 개. DOM 은 S2 처럼 그리고, Canvas 는 라벨 suffix 처럼 아이콘을 붙인다.
- 위험: 기술 LOW / 성능 LOW / 유지보수 **HIGH** (S2 의 `ReactNode` 를 글자 둘로 줄인 확장 prop — D2 위반 · 링크 · 서식 있는 내용 불가 · Button · Popover 원본을 바꿔도 따라가지 않음 — ADR-253 원칙 위반) / 마이그레이션 LOW.

#### 대안 B: Label 노드의 자식 — `Label > ContextualHelp`

- 설명: Label 이 글자 + 도움말을 가진다. DOM 은 `<label>` 밖으로 꺼내 S2 처럼 형제로 그린다.
- 위험: 기술 **HIGH** (Label 은 Canvas 에서 글자 leaf 이고 suffix 로 필수 표시를 붙인다 — `canvasBinding.ts:438-454`. 자식을 가지면 글자 + inline 상자 줄 배치가 필요하고, `<label>` 안의 `<button>` 은 label 이 그 버튼을 이름 대상으로 삼는다 — DOM 을 꺼내 그리면 노드 위치와 DOM 위치가 갈린다) / 성능 LOW / 유지보수 **HIGH** (Label 은 기본 UI 원본 — 모든 field 의 글자 경로가 바뀐다) / 마이그레이션 LOW.

#### 대안 C: field 의 직계 자식 + field rule 이 라벨 행을 만든다

- 설명: `TextField > Label + ContextualHelp + Input …`, field rule 이 grid area 로 Label 과 도움말을 한 줄에 둔다.
- 위험: 기술 MEDIUM / 성능 LOW / 유지보수 **HIGH** (16 field rule 의 top · side 배치를 모두 grid area 로 다시 쓴다 — 도움말이 없는 field 도 레이아웃 경로가 바뀐다, `componentRulesTable.ts:12268-12306` 류 16벌) / 마이그레이션 LOW.

#### 대안 D: 라벨 행 노드 — `FieldLabel > Label + ContextualHelp`, 도움말을 넣을 때만 Label 을 감싼다

- 설명: S2 의 라벨 행 요소 (`Field.tsx:96-117` 의 div) 를 사용자 prop 없는 type `FieldLabel` 로 둔다. 도움말이 없는 field 는 지금 트리 그대로. Design 패널의 「도움말 추가」 가 Label 을 `FieldLabel` 로 감싸고 ContextualHelp 원본 instance 를 Label 뒤에 넣는다 (빼면 풀어 준다 — 한 번의 명령 · undo 한 번). 부품 조회는 `FieldLabel` 을 레이아웃 frame 처럼 건너뛴다 (`PART_FRAME_TYPES` 에 추가) — Label 은 계속 field 의 라벨 (RAC Label context · 필수 표시). side label 은 field rule 의 1열 선택자에 `> .field-label` 을 더한다.
- 근거: S2 구조 그대로 (라벨 행 = 요소 하나), 기존 템플릿 무변경 (contract 유지), 없는 field 무영향. RadioItems (ADR-251) 처럼 role 없는 composition 묶음 노드이고 D1 은 그대로다 (S2 도 같은 div 를 둔다).
- 위험: 기술 MEDIUM (side label 1열 선택자 16벌 · Canvas 의 줄 배치 — baseline 정렬) / 성능 LOW / 유지보수 MEDIUM (field 마다 두 모양 — 감싼 것 · 아닌 것; 부품 조회 · textBinding 이 frame 처럼 건너뛰어야 한다) / 마이그레이션 LOW.

### 축 2 — ContextualHelp 노드의 안

#### 대안 E: S2 API 그대로 — `ContextualHelp > Heading + Content + Footer` (자식 = Popover 내용), 버튼 · Popover 는 type 이 그린다

- 위험: 기술 MEDIUM / 성능 LOW / 유지보수 **HIGH** (버튼 · Popover 를 Canvas 가 owner-drawn 으로 따로 그린다 — Button · Popover 원본의 모양을 복제, ADR-253 원칙 위반 · TreeItem · Disclosure chevron 을 노드로 바꾼 흐름의 역행) / 마이그레이션 LOW.

#### 대안 F: 노드 조립 — `ContextualHelp > Button (quiet · 아이콘만) > Icon + Popover > Heading[slot=title] + Content + Footer`

- 설명: ContextualHelp 는 RAC `DialogTrigger` 로 그리는 trigger type (ADR-255 의 DialogTrigger · TooltipTrigger 와 같은 자리, `TRIGGER_OVERLAY_CHILDREN` 에 `ContextualHelp → Popover`). `variant` 는 Icon 글리프 (`circle-question-mark` · `info`) 와 버튼 이름을 파생하고, `placement` · `offset` · `crossOffset` · `containerPadding` · `shouldFlip` 은 원본이 Popover 노드에 바인딩한다 (`{offset}` — ADR-255 길). 버튼 크기는 field size 에서 (S2: L · XL → S, 그 밖 XS — `Field.tsx:182`). Content · Footer 의 owners 에 Popover 를 더한다.
- 위험: 기술 LOW (모두 있는 부품) / 성능 LOW / 유지보수 LOW / 마이그레이션 LOW.

### 축 3 — 앞 글자의 자리

#### 대안 P1: prop 문자열 `prefix` — binding 이 input 앞에 그린다

- 위험: 기술 MEDIUM / 성능 LOW / 유지보수 **HIGH** (S2 `ReactNode` 를 글자로 줄임 — 아이콘 앞 글자 불가, 상자 없는 TextField 에서는 「상자 안」 자리를 binding 이 따로 만든다) / 마이그레이션 LOW.

#### 대안 P2: 다섯 field 모두 늘 상자 Group — 템플릿을 S2 처럼 바꾼다

- 위험: 기술 MEDIUM / 성능 LOW / 유지보수 MEDIUM / 마이그레이션 **HIGH** (TextField · TextArea · ColorField 템플릿 변경 → contract 42, 이전 문서 전부 거부 · 앞 글자가 없는 field 의 상자 소유가 Input → Group 으로 바뀌어 quiet · invalid · focus 칠 경로가 모두 옮겨 간다 · RAC 레퍼런스 TextField 에는 Group 이 없다 — ADR-256 의 「레퍼런스 구조」 와 어긋남).

#### 대안 P3: 앞 글자 노드 + 넣을 때만 상자 Group — `TextField > Label + Group(Text|Icon[slot=prefix] + Input) …`

- 설명: NumberField · ComboBox 는 이미 Group 이 있으니 Group 맨 앞에 앞 글자 노드 (Text 또는 Icon — S2 `ReactNode`) 를 넣는다. TextField · TextArea · ColorField 는 Design 패널의 「앞 글자 추가」 가 Input 을 Group 으로 감싸고 앞 글자를 넣는다 (빼면 풀어 준다). 감싼 field 는 `FIELD_CONTROL_GROUP_HOSTS` 의 길 (NumberField 와 같은 — Group 이 상자, 안 Input 은 칠 없음) 을 탄다. 앞 글자 모양 (`gray-600` · 끝 여백 `text-to-visual` · 아이콘 `1lh`, `Field.tsx:291-311`) 은 field rule 의 `[slot=prefix]` 블록, input 이름은 S2 처럼 `aria-labelledby` 에 앞 글자 id 를 더한다.
- 위험: 기술 MEDIUM (TextField · TextArea · ColorField 가 두 모양 — Group 있는 쪽의 quiet · invalid · focus 칠) / 성능 LOW / 유지보수 MEDIUM / 마이그레이션 LOW (템플릿 무변경).

#### 대안 P4: SearchField 식 겹침 — 앞 글자를 Input 위 grid 칸에 겹친다

- 위험: 기술 **HIGH** (SearchField 의 글리프는 폭이 고정이라 Input 의 시작 여백을 rule 값으로 줄 수 있었다 — 글자 앞 글자는 폭이 내용에 따라 달라 CSS 로 Input 여백을 맞출 수 없다) / 성능 LOW / 유지보수 MEDIUM / 마이그레이션 LOW.

### 축 4 — 항목 링크의 Preview 탐색

#### 대안 H1: 지금 처리기 유지 — `catalogPreviewLinkClick` 이 `<a>` · 합성 링크의 click 을 받는다

- 위험: 기술 **MEDIUM** (WebKit 은 합성 링크에 click 대신 Enter `keydown` 을 보내 capture click 처리기를 지나친다 → Preview iframe 이 링크로 이동할 수 있다 — `openLink.mjs:55-63`) / 성능 LOW / 유지보수 LOW / 마이그레이션 LOW.

#### 대안 H2: RAC `RouterProvider` — Preview · Publish 루트를 감싸 `navigate` = page 이동

- 설명: RAC 가 같은 출처 · target 없음 링크를 `navigate` 로 보낸다 (`openLink.mjs:23-51`). 외부 · `_blank` 는 여전히 브라우저 → 지금 처리기가 받는다. 두 길이 겹친다.
- 위험: 기술 MEDIUM (내부 경로의 기준 — Preview 는 page 경로, Publish 는 host 경로 · `useHref` 의 base) / 성능 LOW / 유지보수 MEDIUM (탐색 규칙이 두 곳) / 마이그레이션 LOW.

### 축 5 — 바깥 링크 글리프

#### 대안 L1: S2 대로 자동 — `href` + `target="_blank"` 인 GridListItem · MenuItem 끝에 binding 이 그리고 Canvas 도 같은 자리에 그린다 (문서 노드 아님)

- 위험: 기술 MEDIUM (Canvas 에 노드 아닌 글리프 — 필수 표시 suffix 와 같은 「파생 표시」 이나 아이콘 · 항목 끝 자리) / 성능 LOW / 유지보수 MEDIUM / 마이그레이션 LOW.

#### 대안 L2: 작성자가 Icon 노드를 둔다 — 자동 글리프 없음, `hideLinkOutIcon` 은 들이지 않는다

- 위험: 기술 LOW / 성능 LOW / 유지보수 LOW / 마이그레이션 LOW. 다만 S2 동작 (새 탭 링크를 글리프로 알림) 과 S2 prop 하나를 버린다 — D2 순서상 S2 에 있는 prop 을 확장 없이 뺀다.

### Risk Threshold Check

| 대안      | HIGH+                       | 판정                                            |
| --------- | --------------------------- | ----------------------------------------------- |
| A · B · C | 유지보수 HIGH (B 는 기술도) | 기각 — D 가 HIGH 없이 같은 결과                 |
| D         | 없음                        | 채택 후보                                       |
| E         | 유지보수 HIGH               | 기각 — F 가 HIGH 없음                           |
| F         | 없음                        | 채택                                            |
| P1 · P4   | 유지보수 / 기술 HIGH        | 기각                                            |
| P2        | 마이그레이션 HIGH           | 기각 — P3 가 템플릿 무변경으로 같은 결과        |
| P3        | 없음                        | 채택 후보                                       |
| H1 · H2   | 없음 (MEDIUM)               | H1 채택 + G1 의 WebKit 확인 — 새면 H2 를 더한다 |
| L1 · L2   | 없음                        | 사용자 결정 1 (권장 L1)                         |

모든 축에 HIGH 없는 대안이 있어 루프 추가 없음.

## Decision

**D + F + P3 + H1 (+ 조건부 H2) + L1 (사용자 결정 1)** 를 채택한다.

1. **도움말** — 새 type `ContextualHelp` (RAC `DialogTrigger` 로 그리는 trigger — `ContextualHelp > Button (quiet, 아이콘만) > Icon + Popover > Heading[slot=title] + Content + Footer`) 와 그 원본. field 에서는 새 type `FieldLabel` (사용자 prop 0 · role 없음) 이 `Label + ContextualHelp` 를 한 줄로 묶는다. 도움말은 S2 처럼 field 밖 (제목 옆 등) 에도 둘 수 있다 — 독립 원본 (팔레트 overlay 묶음, 사용자 결정 2).
   - trigger Button 은 원본이 `slot: false` 로 둔다 → RAC `slot={null}` (`runtime/racSlot.ts:43` `detached`). field 가 주는 ButtonContext (ComboBox picker · disabled · `aria-labelledby`) 가 도움말에 닿지 않는다 — S2 와 같다. 버튼 이름은 S2 처럼 ContextualHelp binding 이 준다: `aria-label` = variant 문자열, field 안이면 `aria-labelledby` = field 라벨 id + 도움말 id (`Field.tsx:175-184`).
   - Popover 의 이름은 제목이다 — ContextualHelp binding 이 안정된 제목 id 를 title slot Heading 에 주고 Popover 의 `aria-labelledby` 로 잇는다 (S2 `ContextualHelpPopover` 의 연결). ContextualHelp 안의 Popover 에만 — 일반 Popover · picker · menu 의 구조는 그대로 (Dialog 를 넣지 않는다).
2. **앞 글자** — Text 또는 Icon 노드 (`slot=prefix`) 를 field 의 상자 Group 맨 앞에. Group 이 없는 TextField · TextArea · ColorField 는 넣을 때 Input 을 Group 으로 감싼다. 앞 글자가 있는 상자 Group 은 S2 `FieldGroup` 처럼 버튼 · 입력이 아닌 자리 (앞 글자 · 안 여백) 의 mouse `pointerdown` · `touchend` 를 그 안 input · textarea 의 포커스로 넘긴다 (`Field.tsx:258-273`, disabled 면 넘기지 않음). 앞 글자 없는 Group · 일반 Group 의 동작은 그대로다 (S2 는 모든 field 상자에 이 동작을 두지만, 기존 NumberField · ComboBox 상자까지 넓히는 것은 이 ADR 의 범위 밖).
3. **항목 링크** — 7 type (ListBoxItem · Tab · Tag · TreeItem · GridListItem · Row · MenuItem) 의 accepts 에 `href` · `target` · `rel` (Link 와 같은 값 — `Link.binding.ts:89-102`), RAC 에 그대로 넘긴다. MenuItem 의 반쯤 이어진 경로를 닫는다. GridList · Menu `hideLinkOutIcon` 은 항목에 전파한다 (`CATALOG_OVERFLOW_MODE_OWNERS` 와 같은 길).
4. **contract** — 기존 원본 템플릿을 바꾸지 않으므로 `LIBRARY_CONTRACT_VERSION` 41 유지 (G0 이 확인 — 템플릿을 건드려야 하는 사실이 나오면 Phase 0 에서 멈추고 보고).
5. **패널 · AI** — Design 패널의 field 에 「도움말」 · 「앞 글자」 추가/제거 명령 (감싸기 · 풀기 한 번 = undo 한 번), 항목에 Link 와 같은 「Link」 필드. AI manifest 에 새 type · prop.

위험 수용 근거: 채택 대안은 모두 HIGH 0 이다. 남는 MEDIUM 은 「field 한 type 의 두 모양」 (감싼 것 · 아닌 것) 인데, 같은 두 모양을 레이아웃 frame (ADR-256 G2) 과 NumberField 의 Group 경로가 이미 production 에서 쓰고 있고, 도움말 · 앞 글자가 없는 field 는 노드 · 칠이 그대로라 기존 문서와 기존 Canvas 경로에 닿지 않는다.

기각 사유: A · P1 은 S2 `ReactNode` 를 글자로 줄인 확장 prop (D2 순서 위반 · 원본 연쇄 끊김). B 는 기본 UI 원본 Label 을 컨테이너로 바꾸고 노드 위치 ≠ DOM 위치. C 는 도움말이 없는 16 field 의 레이아웃까지 다시 쓴다. E 는 Button · Popover 모양을 Canvas 가 복제한다. P2 는 이전 문서 전부 거부 + 앞 글자 없는 field 의 상자 소유 이동. P4 는 가변 폭 앞 글자를 CSS 로 맞출 수 없다. H2 단독은 탐색 규칙을 둘로 나눌 이유가 G1 전에는 없다 (WebKit 결과가 근거가 되면 더한다).

> 구현 상세: [259-s2-contextual-help-prefix-item-links-breakdown.md](design/259-s2-contextual-help-prefix-item-links-breakdown.md)

### 사용자 결정 2건 — 2026-10-12 답함

1. **바깥 링크 글리프** — L1 (S2 처럼 자동). `hideLinkOutIcon` 을 들인다.
2. **ContextualHelp 원본** — S2 처럼 독립 원본, 팔레트 overlay 묶음의 Popover 뒤.

## Risks

| ID  | 위험                                                                                                                                                                                                                                                                 | 심각도 | 대응                                                                                          |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----: | --------------------------------------------------------------------------------------------- |
| R1  | side label 의 1열 선택자 (`> .react-aria-Label`) 가 16 field rule 에 있어 `FieldLabel` 로 감싼 라벨이 2열로 떨어진다 (`componentRulesTable.ts:12268-12306` 류) — Canvas 는 직속 part rule 만 읽는다 (메모리 `feedback-rule-descendant-selector-vs-direct-part-rule`) | MEDIUM | G3 — 16 field × top · side 행렬 Canvas = Preview                                              |
| R2  | 앞 글자로 Group 을 감싼 TextField · TextArea · ColorField 의 quiet · invalid · focus · disabled 칠이 Input → Group 으로 옮겨 가야 한다 (ADR-253 quiet = Input rule `&[data-quiet]` · `quietStyles.ts`)                                                               | MEDIUM | G2 — 5 field × (앞 글자 글자 · 아이콘) × (기본 · quiet · invalid · disabled) 행렬             |
| R3  | WebKit 의 합성 링크 Enter `keydown` 이 capture click 처리기를 지나쳐 Preview iframe 이 이동 (`openLink.mjs:55-63` · `domView.runtime.ts:86-107`)                                                                                                                     | MEDIUM | G1 — WebKit 실측, 새면 H2 (`RouterProvider`) 를 같은 Phase 에 더한다                          |
| R4  | `<a>` 로 바뀌는 ListBoxItem · Tab · MenuItem 에 Preview 기본 링크 칠 (밑줄 · 색) 이 새어 Canvas 와 갈린다                                                                                                                                                            | MEDIUM | G1 — 링크 항목 Canvas = Preview                                                               |
| R5  | 노드 아닌 바깥 링크 글리프 (L1) 의 Canvas 자리 · 크기가 DOM 과 갈린다 (S2 ListView 는 trailing grid 칸 · Menu 는 descriptor 칸)                                                                                                                                      | MEDIUM | G1 — 글리프 행렬, 사용자 결정 1 이 L2 면 소멸                                                 |
| R6  | `FieldLabel` 을 부품 조회가 건너뛰지 않으면 Label 이 field 의 라벨이 아니게 된다 — 필수 표시 · RAC Label context · 글자 소유 (`textBinding.ts`) 가 끊긴다 (`presence.ts:210-227` · `delegatedDom.runtime.ts:657-666` · `domBinding.components.tsx:220-240`)          | MEDIUM | G3 — 감싼 field 의 라벨 이름 (`aria-labelledby`) · 필수 표시 · 인라인 편집                    |
| R7  | Content · Footer owners 확대가 Card · InlineAlert 의 가정 (부모 rule 이 배치를 준다) 을 흔든다 (`componentTraits.ts:114-124`)                                                                                                                                        |  LOW   | G3 의 Card · InlineAlert 기존 G3 하니스 재실행                                                |
| R8  | 패널 「추가 · 제거」 명령이 감싸기 · 풀기를 두 transaction 으로 나누면 undo 두 번 · 중간 상태 저장                                                                                                                                                                   |  LOW   | G2 · G3 — 명령 하나 · undo 한 번 · revision +1                                                |
| R9  | 도움말 trigger Button 이 field 의 ButtonContext 를 상속 — disabled ComboBox 안 도움말이 비활성 · picker 이름 경로 상속 (리뷰 r1-h1, `racSlot.ts:43-50, 78-87` · `racSlotScope.tsx:45-49` · RAC `ComboBox.mjs:215-224`)                                               | MEDIUM | Decision 1 `slot: false` · G3 — disabled ComboBox · DatePicker 에서 도움말 열림 + picker 독립 |
| R10 | 도움말 Popover 의 이름이 trigger 의 「Help」 로 떨어진다 — RAC Popover 는 title slot 을 주지 않는다 (리뷰 r1-m1, `domBinding.runtime.ts:685-697, 1769-1780`)                                                                                                         | MEDIUM | Decision 1 제목 id 연결 · G3 — Popover 이름 = 제목, 제목 교체 · 편집 뒤에도                   |
| R11 | 앞 글자를 눌러도 input 포커스가 오지 않는다 (리뷰 r1-m2, `components/Group.tsx:88-102`)                                                                                                                                                                              | MEDIUM | Decision 2 포커스 전달 · G2 — 앞 글자 클릭 · 터치 뒤 activeElement = input, 입력 가능         |

잔존 HIGH 위험 없음.

## Gates

| Gate | 시점    | 통과 조건                                                                                                                                                                                                                                                                                                                                                                                                                                                      | 실패 시 대안                                                  |
| ---- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| G0   | Phase 0 | ① 기존 원본 템플릿 변경 0 확인 (contract 41 유지) ② 설치 S2 를 jsdom 에 마운트한 oracle 고정 — 도움말 버튼 이름 · `aria-labelledby` · Popover `role=dialog` · 앞 글자 포함 input 이름 · 링크 항목 DOM (`<a>` / `data-href`) 7 type ③ WebKit 합성 링크 실측 (R3) ④ S2 라벨 행 · 앞 글자 · 바깥 링크 글리프 치수 (S2 rule 값 → 우리 토큰 대응표)                                                                                                                 | ① 이 깨지면 멈추고 사용자 보고 (contract 42 는 결정 지점 ④)   |
| G1   | Phase 1 | 7 type `href` 쓰기 · 읽기 · 저장 · undo · AI · MenuItem 포함 / DOM = G0 oracle / Preview 클릭 · Enter — 내부 경로 page 이동 · 외부 새 탭 · iframe 이동 0 (Chrome · WebKit) / 링크 항목 · 바깥 링크 글리프 Canvas = Preview (pixelmatch 0.1 ≤ 0.001, 라이트 · 다크) / 원복 RED                                                                                                                                                                                  | R3 이 새면 H2 를 더하고 재측정                                |
| G2   | Phase 2 | 5 field × 앞 글자 (글자 · 아이콘) × 상태 4 (기본 · quiet · invalid · disabled) Canvas = Preview / input 접근성 이름 = G0 oracle / 추가 · 제거 = 명령 하나 · undo 한 번 / 앞 글자 없는 field 의 노드 · 칠 무변경 (기존 G3 하니스 재실행) / 앞 글자 · 안 여백 mouse 클릭 · 터치 뒤 `document.activeElement` = input · textarea, 버튼 · disabled 는 넘기지 않음 (S2 `FieldGroup` oracle) / 원복 RED                                                               | 상태 칠이 갈리면 그 상태의 rule 을 Group 쪽으로 옮기고 재측정 |
| G3   | Phase 3 | 16 field × label top · side × size (S · M · L) 의 라벨 행 Canvas = Preview / 닫힌 Popover Canvas 미표시 / 버튼 이름 · `aria-labelledby` = G0 oracle / Preview 에서 열기 · 닫기 (문서 쓰기 0) / 필수 표시 · 라벨 인라인 편집 유지 / Card · InlineAlert G3 재실행 / disabled ComboBox · DatePicker 안 도움말이 열리고 picker 버튼은 그대로 비활성 (trigger `slot={null}`) / 열린 Popover 의 이름 = 제목 Heading 글자 (제목 교체 · 인라인 편집 뒤에도) / 원복 RED | side 가 갈리면 1열 선택자를 field rule 마다 고친다            |
| G4   | Phase 4 | pre-push perf ratchet A 등급 초과 0 · initial 번들 상한 안 · live 하니스 (headed Chrome, Compare Mode · Design 패널 · 새로고침 · undo · page error 0)                                                                                                                                                                                                                                                                                                          | 초과 시 lazy 경계 · 상한 판정은 사용자                        |

측정 조건: G1 ~ G3 의 pixel 비교는 ADR-248 G3 하니스 (같은 rasterizer 아님 — pixelmatch 0.1 정의), oracle 은 설치 S2 · RAC 의 출력 (시스템 자신이 아닌 외부), fixture 는 각 축의 값을 실제로 쓴다 (side label · quiet · 아이콘 앞 글자 · `_blank`).

### Live Exercise

(Implemented 승격 시 기재)

## Consequences

### Positive

- S2 정렬 조사 §6.1 의 「라」 와 「링크」 가 닫힌다 — field 16 의 도움말, 5 의 앞 글자, 항목 7 의 링크.
- MenuItem 링크가 DOM 만 이어져 있고 쓸 수 없던 틈이 닫힌다.
- 도움말 · 앞 글자가 없는 field 와 저장 문서는 그대로다 (contract 유지).
- 도움말 버튼 · Popover · 제목 · 내용이 기본 원본 (Button · Popover · Heading · Content) 의 instance 라 theme 를 바꾸면 같이 바뀐다.

### Negative

- field 한 type 이 두 모양 (도움말 · 앞 글자 유무) 을 가진다 — 패널 명령 · 부품 조회 · side label 선택자가 둘을 다 다뤄야 한다.
- 노드 아닌 글리프 (L1) 가 Canvas 에 하나 더 생긴다 (필수 표시 suffix 다음).
- `FieldLabel` · `ContextualHelp` 두 type 이 늘어난다 (binding · rule · 원본 · 생성 CSS · AI manifest).
