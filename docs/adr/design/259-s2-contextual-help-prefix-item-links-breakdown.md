# ADR-259 breakdown — S2 도움말 · 앞 글자 · 항목 링크

> 본문: [ADR-259](../259-s2-contextual-help-prefix-item-links.md). 이 문서는 Phase · 파일 · 확인 항목만 둔다. 결정 · 대안 · 위험은 본문이 정본이다.

## 1. 범위 고정

- 한 ADR · 네 Phase (사용자 「하나로 + href 포함」, 2026-10-12). Phase 순서는 작은 것부터 — 링크 (기존 부품만) → 앞 글자 (기존 Group 경로) → 도움말 (새 type 2).
- 선행 ADR 의존: ADR-255 (trigger + overlay 노드) · ADR-256 (레퍼런스 노드 트리 · 레이아웃 frame 건너뛰기 · G5) · ADR-253 (기본 원본 · quiet = Input rule) · ADR-257 (항목 전파 `CATALOG_OVERFLOW_MODE_OWNERS`). 방향 반전 없음 — 이 ADR 은 그 결정들의 응용이다.
- 기존 원본 템플릿 변경 0 → contract 41 유지 (본문 Decision 4). 이 전제가 깨지면 Phase 0 에서 멈춘다.

## 2. Phase

### Phase 0 — 인벤토리 · oracle (G0)

- 템플릿 변경 0 확인: 이 ADR 이 손대는 원본 정의 · 템플릿 목록 (새 원본 = ContextualHelp 하나, 새 type = ContextualHelp · FieldLabel) 과 기존 템플릿 diff 0.
- oracle 고정 (`apps/builder/tests/fixtures/adr259-s2-oracle.json`): 설치 `@react-spectrum/s2` 를 jsdom 에 마운트 —
  - `TextField contextualHelp={<ContextualHelp variant>…}` 의 버튼 `aria-label` · `aria-labelledby` (라벨 id + 도움말 id) · 버튼 이름 계산 결과 (variant 2)
  - Popover 의 `role` · `aria-labelledby` (제목 id)
  - `prefix` 다섯 field 의 input `aria-labelledby` · 이름 계산 결과 (글자 · 아이콘)
  - RAC 항목 7 type 의 링크 DOM (`<a href target rel>` / `data-href` · `data-target` · `data-rel`)
- S2 치수 → 우리 토큰 대응표: 라벨 행 (`&nbsp;` 간격 · baseline) · 도움말 버튼 (XS · S, quiet) · Popover (폭 268 · padding 24 · heading-xs · body-sm · Footer margin-top 16) · 앞 글자 (`gray-600` · `text-to-visual` · 아이콘 `1lh`) · 바깥 링크 글리프 (ListView M · Menu S→M … , 자리). 값은 S2 소스 (`ContextualHelp.tsx:36-42` · `Field.tsx:291-311` · `ListView.tsx:807-814` · `Menu.tsx:440-448, 788-793`) 에서 읽는다.
- WebKit 합성 링크 실측 (R3): Preview 에 `data-href` GridListItem 하나 · Enter / 클릭 → iframe URL 변화 여부.

### Phase 1 — 항목 링크 (G1)

- accepts: ListBoxItem · Tab · Tag · TreeItem · GridListItem · Row binding 에 `href` · `target` · `rel` (Link 정의 재사용). MenuItem 은 rule type 이라 `ruleTypeDefinition` 의 item accepts 경로 (`ruleDefinition.ts:326-330` 근처) 에 같은 세 키.
- DOM: 각 항목 binding 이 RAC 에 그대로 (`<a>` · `data-href` 는 RAC 가 만든다). `<a>` 의 기본 링크 칠 중화는 rule 의 항목 선택자에서 (R4).
- `hideLinkOutIcon`: GridList · Menu accepts, 항목 파생 값으로 전파 (`CATALOG_OVERFLOW_MODE_OWNERS` 와 같은 표).
- 바깥 링크 글리프 (사용자 결정 1 = L1, 2026-10-12): GridListItem · MenuItem binding 이 `href && target === "_blank" && !hideLinkOutIcon` 일 때 끝에 `external-link` 아이콘, Canvas 는 resolver 파생 `_linkOut` 을 읽어 같은 자리에 `icon_font` 로 그린다 (필수 표시 suffix 의 「파생 표시」 경로).
- Preview 탐색: `catalogPreviewLinkClick` 유지 · G0 ③ 이 새면 `RouterProvider` 를 Preview · Publish 루트에 (navigate = page 이동).
- Design 패널: 항목에 「Link」 필드 (Link 와 같은 href · target · rel). AI manifest 의 항목 accepts.

### Phase 2 — 앞 글자 (G2)

- NumberField · ComboBox: Group 맨 앞의 Text · Icon 노드 `slot=prefix`.
- TextField · TextArea · ColorField: 패널 「앞 글자 추가」 = Input 을 Group 으로 감싸고 앞 글자 노드를 넣는 명령 하나 (제거 = 풀기). 감싼 field 는 `FIELD_CONTROL_GROUP_HOSTS` · `CATALOG_WRAPPED_CONTROL_FIELDS` 판정을 「Group 자식이 있으면」 으로 넓힌다 (type 고정 집합 → type + 실제 자식).
- 칠: 상자 · quiet · invalid · focus · disabled 를 Group 쪽에서 (NumberField 와 같은 delegation), 앞 글자 모양은 field rule `[slot=prefix]`.
- 접근성: 앞 글자 노드 id 를 input 의 `aria-labelledby` 끝에 (S2 `Field.tsx:248-253`).
- 포커스 전달 (리뷰 r1-m2): 앞 글자가 있는 상자 Group 의 DOM 이 S2 `FieldGroup` 처럼 `onPointerDown` (mouse) · `onTouchEnd` 에서 대상이 `button,input,textarea,[role="button"]` 밖이면 안 input · textarea 를 focus (`Field.tsx:258-273`). disabled field 는 넘기지 않음. 일반 Group (`components/Group.tsx`) 은 손대지 않는다 — field binding 쪽에서.
- Canvas: Group flex row 그대로 — 새 primitive 없음.

### Phase 3 — 도움말 (G3)

- 새 type `ContextualHelp` (binding · rule · 생성 CSS · `TRIGGER_OVERLAY_CHILDREN` · `componentTraits` · nesting) 와 원본 `component-contextualhelp` (`ContextualHelp > Button > Icon + Popover > Heading[slot=title] + Content + Footer`, Popover 의 위치 prop 바인딩).
- `variant` → Icon 글리프 (`circle-question-mark` · `info`) · 버튼 이름 (S2 문자열) 파생. 버튼 크기 = field size 파생.
- trigger Button 은 원본에서 `slot: false` (리뷰 r1-h1) → RAC `slot={null}` — field ButtonContext 차단. 이름 = `aria-label` (variant 문자열) + field 안이면 `aria-labelledby` = 라벨 id + 도움말 id (S2 `ContextualHelpContext`).
- 제목 연결 (리뷰 r1-m1): ContextualHelp binding 이 안정된 title id 를 만들어 title slot Heading 의 `id` 와 Popover 의 `aria-labelledby` 에 준다 (S2 `ContextualHelpPopover`). 제목 Heading 이 없으면 RAC 기본 (trigger 이름). ContextualHelp 밖 Popover 는 무변경.
- 새 type `FieldLabel` (사용자 prop 0) — 부품 조회 건너뛰기 (`PART_FRAME_TYPES` · `catalogDomPartParent` · DOM watch), field rule 의 side label 1열 선택자에 `> .field-label`, 라벨 행 rule (한 줄 · baseline).
- Content · Footer owners 에 Popover.
- Design 패널 field 「도움말 추가 · 제거」 = Label 감싸기 + 원본 instance 삽입 명령 하나. 사용자 결정 2 = 팔레트 overlay 묶음의 Popover 뒤 (2026-10-12).
- AI manifest: ContextualHelp · FieldLabel 생성 규칙.

### Phase 4 — 마감 (G4)

- pre-push ratchet · 번들 · live 하니스 (`apps/builder/scripts/adr259-live.mjs`) · CHANGELOG · README · 조사 문서 §6.1 「라」 · 「링크」 갱신 · `ssot-hierarchy.md` D3 sub-part 절에 라벨 행 · 앞 글자 · 도움말 한 줄.

## 3. 확인 항목 요약

| Gate | 핵심                                                                                 |
| ---- | ------------------------------------------------------------------------------------ |
| G0   | 템플릿 변경 0 · S2/RAC oracle · WebKit 합성 링크 · 치수 대응표                       |
| G1   | 링크 7 type 쓰기 · DOM oracle · Preview 탐색 Chrome/WebKit · 글리프 Canvas = Preview |
| G2   | 앞 글자 5 × 2 × 4 Canvas = Preview · input 이름 · 명령 하나 · 없는 field 무변경      |
| G3   | 라벨 행 16 × 2 × 3 Canvas = Preview · 버튼/Popover 접근성 · 필수 표시 · 편집         |
| G4   | ratchet · 번들 · live                                                                |

## 4. Phase 결과

### Phase 0 — 닫힘 (2026-10-13)

- **① 템플릿 변경 0**: 이 ADR 은 기존 원본 정의 · 템플릿을 고치지 않는다 — 새 원본 (`component-contextualhelp`) · 새 type (ContextualHelp · FieldLabel) 추가만. Phase 마다 `git diff 719b918ee -- reusableOriginLibrary.ts` 가 추가 행뿐인지로 확인한다. contract 41 유지.
- **② oracle** — `apps/builder/tests/fixtures/adr259-s2-oracle.json` (생성 · 대조 테스트 `catalogRuntime/__tests__/adr259S2Oracle.test.tsx`, `ADR259_WRITE_ORACLE=1` 로만 다시 쓴다). 설치 `@react-spectrum/s2` 1.8.1 · RAC 를 jsdom 에 마운트한 출력:
  - 도움말 버튼: `aria-label` = `Help` · `Information`, field 안이면 `aria-labelledby` = [라벨, 자기] → 이름 「Name Help」, 단독이면 `aria-labelledby` 없음 → 「Help」. `slot` 없음 (`slot={null}`), `aria-expanded` false → true.
  - 라벨 행: `div > label + span` (span = `&nbsp;` + 도움말).
  - 열린 Popover: `role=dialog`. **이름은 제목이 `slot="title"` Heading 일 때만** (h2, 「Help title」). 기본 slot Heading 은 h3 이고 `aria-labelledby` 가 가리키는 id 가 없어 이름이 빈다 — 우리 원본은 `Heading[slot=title]` (Decision 1) 이라 앞의 경우를 따른다.
  - 앞 글자: 상자 Group 의 첫 자식 (`div`, id 있음), input `aria-labelledby` = [라벨, 앞 글자] → 「Price $」 · 아이콘이면 아이콘 이름 (「Price Search」). **TextArea 는 앞 글자를 그리지만 이름에 넣지 않는다** (S2 `TextAreaInput` 이 InputContext 가 아닌 TextAreaContext 를 읽는다) → 「Price」. S2 의 상자 Group role 은 NumberField 만 `group`, 나머지 `presentation`. 앞 글자 mouse `pointerdown` · `touchend` → input · textarea focus (5 field 모두).
  - 항목 링크: ListBoxItem · Tab · MenuItem = `<a href target rel>`, Tag · TreeItem · GridListItem = `div[data-href data-target data-rel]`, Row = `tr[data-href …]`.
  - 바깥 링크 글리프: ListView · Menu 모두 `href` + `target="_blank"` 일 때만 svg 1, `hideLinkOutIcon` · `href` 만 · 없음 = 0.
- **③ WebKit 합성 링크 (R3)** — Playwright WebKit 2336 (macOS, `navigator.platform` MacIntel) 에서 RAC `openLink` 과 같은 이벤트 (임시 `<a>` 에 `keydown` keyIdentifier Enter) 를 보냈다. 처리기 없음: iframe 이 `/about` 으로 이동. **capture `click` 처리기 하나만 있어도 이동 0** — WebKit 의 Enter 활성화가 click 을 다시 보내 지금 `catalogPreviewLinkClick` 이 받는다 (Chromium 은 keydown 경로를 쓰지 않는다). → **R3 새지 않음, H1 단독 채택 (H2 `RouterProvider` 안 더함)**. Phase 1 live 에서 실제 Preview 로 다시 확인한다.
- **④ 치수 대응표** (S2 소스 → 우리 rule 의 자리, 값은 해당 Phase 에서 토큰으로 옮긴다):

| 부위                 | S2 값 (출처)                                                                                         | 우리 자리                                    |
| -------------------- | ---------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| 라벨 행              | `div` `display: inline` · Label 뒤 `&nbsp;` + 도움말 (`Field.tsx:96-184`)                            | FieldLabel rule (한 줄 · baseline)           |
| 도움말 버튼          | ActionButton quiet, field size L · XL → S, 그 밖 XS (`Field.tsx:182`) · 단독 기본 XS                 | Button 원본 (quiet · 아이콘만) + 크기 파생   |
| 도움말 Popover       | 폭 268 · padding 24 · `hideArrow` · offset 8 · containerPadding 8 · `bottom start` (`ContextualHelp.tsx:36-42, 205-214`) | ContextualHelp 원본의 Popover 노드           |
| 제목 · 내용 · 꼬리   | heading-xs · margin-bottom 8 / body-sm / body-sm · margin-top 16 (`ContextualHelp.tsx:44-49, 92-106`) | Heading · Content · Footer rule (Popover 안) |
| 앞 글자              | 색 gray-600 · `flex-shrink: 0` · 끝 여백 text-to-visual (글자 크기의 6/14) · 아이콘 `1lh` (`Field.tsx:291-311`) | field rule `[slot=prefix]` (neutral-subdued) |
| 바깥 링크 글리프     | ListView: trailing 칸, LinkOut M, 앞 여백 text-to-visual (`ListView.tsx:807-814, 987-1003`) · Menu: descriptor 칸, size S→M · M→L · L→XL, 앞 여백 8 (`Menu.tsx:440-448, 788-793, 925-937`) | GridListItem · MenuItem rule `.link-out`     |


### Phase 1 — 닫힘 (2026-10-13)

- **구현**: `document/itemLinks.ts` (7 type · 계약 · `catalogItemLinkOut` · S2 글리프 상자) · 항목 binding 6 + MenuItem rule-only 계약 (`RULE_TYPE_PROP_CONTRACTS` → `ruleTypeDefinition` accepts · `catalogSemanticContracts`) · resolver `applyOwnerHideLinkOut` + compositionRoot 재해석 큐 · `styleFor` 끝 여백 (`catalogLinkOutPaddingRight`) · Canvas `linkOutShapes` (`ruleShapes.ts`) · DOM 글리프 요소 + inline 여백 (`domBinding.runtime.ts`) · TreeItem 링크 (`delegatedDom.runtime.ts`) · Tab · MenuItem rule `&[href]`.
- **설계 판단 (사후 보고)**: 글리프는 문서 노드가 아니라 (L1) 레이아웃 leaf 를 만들지 않고 항목의 끝 여백을 늘린 자리에 그린다 — composed part (`catalogComposedParts`) 는 children 앞에만 두는 계약이고 GridListItem 이 세로 flex 라 흐름 leaf 는 아래로 쌓인다. DOM 글리프는 padding box 기준 absolute, Canvas 아이콘 x 도 padding box 좌표 (변환기가 테두리만큼 민다 — `specShapeConverter.ts` icon_path border-box 보정).
- **G1**: unit `adr259ItemLinks.test.tsx` 11 (7 type DOM = oracle · MenuItem 패널 계약 · 글리프 표시 조건 3 경우 × 2 type = oracle · 글리프 상자). 원복 RED 4/4 (TreeItem 링크 · Canvas 글리프 · resolver 전파 본체 · MenuItem accepts). live `adr259-live.mjs --phase 1` 13/13 · `--dark` 12/12 (WebKit 은 light 만).
- **live 가 잡은 것**: ① MenuItem `<a>` 에 UA 링크 색 (파랑) — rule `&[href]` 에 `color: inherit` · ② Canvas 글리프가 테두리 1 px 만큼 밀림 — 아이콘 x 의 좌표계 (padding box).
- **픽셀 기록**: 글리프 상자 ±4 px 의 pixelmatch 0.1 — Menu 0 (light · dark), GridList 5 px · 2 px / 324 (10 px 획 AA). 중심 · 크기는 Canvas 가 실제로 그린 `icon_path` 와 DOM 상자가 같다. 대조군 (같은 글리프 10 px Icon 노드) 은 Canvas 와 Preview 의 세로 자리가 2 px 갈려 (Icon 노드의 기존 차이, 이 ADR 밖) 대조군 구실을 못 했다 — 기록만.
- **WebKit**: 실제 Preview 에서 `data-href` GridListItem 에 Enter → Preview page 이동 · iframe URL 그대로 (Playwright WebKit 2336, MacIntel).

### Phase 2 — 닫힘 (2026-10-13)

- **Phase 0 inventory 보강 (사후 보고)**: 설계는 「NumberField · ComboBox 는 Group 이 상자를 칠한다」 를 전제했지만 ADR-253 이후 상자는 Input 원본이 칠한다 (Group 은 배치만). → 앞 글자가 든 Group 이 상자가 된다 (S2 `FieldGroup`): DOM 은 Input rule sheet 를 `classAliases: ["FieldBox"]` 로 받고, Canvas 는 그 Group 상자에서 Input rule 을 실행한다. 안 Input 은 자기 상자를 내려놓는다. 다섯 field 공통 (`runtime/fieldPrefix.ts`).
- **사용자 결정 3 (2026-10-13) 「5종 모두 진행 (사본 감수)」**: 배치된 field 는 원본 instance 라 Input 을 Group 으로 감싸면 field 루트의 template 자식이 소유 사본이 된다 (`ensureChildList`). 그 뒤 field 의 `label` · `description` · `placeholder` 는 사본 Label · Input 에 닿지 않는다 (NumberField · ComboBox 는 Group 자식만 — Input 의 `placeholder`, 2026-10-12 결정 「A」 와 같은 길).
- **구현**: 명령 `catalogRuntime/fieldPrefixCommand.ts` (없음 · Text `$` · Icon `search` — 넣기 · 바꾸기 · 빼기가 각 한 step, TextField · TextArea · ColorField 는 감싸기 · 풀기) · Design 패널 `CatalogFieldPrefixField` (Prefix 선택 + Prefix Text / Prefix Icon — 앞 글자 노드에 쓴다) · 상자 (`catalogFieldBoxStyle` — Input 상자 높이로 고정 · 시작 여백 · 끝 여백은 Input 의 것, ComboBox 는 버튼 겹침 4 px 를 상자 끝 여백으로 `buttonOverlayInset`) · NumberField 증감 버튼은 상자 안에서 테두리 · 모서리를 내리고 상자 안 높이 (`catalogFieldBoxStepperNode` — Canvas · DOM 같은 record) · 앞 글자 part rule (`fieldPrefixPartRules` — S2 `gray-600` = `--fg-muted` · 아이콘 = 글자 줄 높이 정사각 `1lh`) · TextArea 상자 안 `<textarea>` 높이 = rows 상자 − 세로 여백 · 앞 글자 요소에 `slot="prefix"` + id (input `aria-labelledby` 끝, TextArea 제외) · 포커스 전달 (mouse `pointerdown` · `touchend`).
- **같이 고친 것 (live 가 잡음)**: ① **invalid field 상자가 Canvas 에서 회색** (앞 글자 없는 field 도 — 기존 비대칭): `_fieldInvalid` 를 quiet 일 때만 실었다 → 모든 field 상자 (Input · DateInput · 앞 글자 Group) 에 싣고 (`presence.ts` `fieldOfBox`), Canvas 가 rule 의 `&[data-invalid]` 테두리 색을 읽는다 (`quietStyles.ts` `catalogInvalidBorderColor` → `ruleShapes.ts` `invalidBorder`). ② **사본화 뒤 NumberField 증감 Icon 18 → 24 px**: Button 원본 instance 의 소유 자식이 Button rule 의 part rule (`iconSize`) 을 못 받았다 → resolver 가 instance 소유자를 그 루트 type 의 정의 + 기본값으로 읽는다. ③ quiet 파서가 넓힌 focus 선택자 (`:not([data-focused], [data-focus-within])`) 를 거부 → `:is` · `:not` 목록 지원. ④ 앞 글자를 빼도 Input · 증감 버튼이 상자 모드 layout 을 유지 → 구조 변경 계획이 「상자 부품 여부가 바뀐 record」 도 다시 계획. ⑤ ColorField 입력칸 `max-width: 12ch` 가 DOM 상자 안 Input 에만 걸림 → 상자 안 Input 은 `max-width: none` (Canvas 는 원래 안 걸림).
- **G2**: unit `adr259FieldPrefix.test.tsx` 39 (5 field × text/icon DOM = oracle — 이름 · 첫 자식 · 포커스 전달 · undo 한 번 · 빼면 원래 모습 · 5 × 4 상태 Canvas 상자 칠 · 크기 · 부품 자리 · 앞 글자 색 · 아이콘 크기 Canvas = DOM · 상태 편집 반영). 원복 RED 18/18. live `adr259-live.mjs --phase 2` 51/51 · `--dark` 51/51 — Design 패널 Prefix → Text · Prefix Text → € · undo 2 (글자 · 앞 글자 각 한 step) · 저장 · 다시 열기 · Preview 이름 (「Price €」 · TextArea 「Price」) · mouse 누름 → input focus · 19 상자 × text/icon Canvas = Preview · None 으로 풀기.
- **픽셀 판정**: 상자 칠 (테두리 · 바탕 · 모서리) = 앞 글자 · input 상자를 가린 pixelmatch 0.1 ≤ 0.001, 부품 자리 = Canvas `getGeometry` 와 DOM rect ±1. 글자 자체는 두 rasterizer 의 몫 — 대조군 (앞 글자 없는 field) 의 Input 상자도 TextField 0.022 · ComboBox 0.045 (placeholder 색 · AA, 이 ADR 밖), NumberField · ColorField 0. 아이콘 앞 글자 NumberField 상자는 가리지 않아도 0 px.
- **기록 (이 ADR 밖)**: G3 `paletteBaseCanvas.browser.test.ts` 는 ADR-248 G0 에 얼린 옛 캡처와 그 뒤 ADR-256 구조 변경 (Card · Dialog · Menu · Popover · SearchField · TableView · Tooltip) 의 차이 7건으로 실패한다 — resolver 변경을 되돌려도 같은 7건 (반증 1). parity 811 · G3 `propAxisCanvasDom` 60 · `switchDomPaint` 16 통과.
- **AI manifest**: 새 type · prop 0 — 앞 글자는 기존 Text · Icon 의 `slot` 값이라 manifest (catalog accepts 파생) 변경 없음.
- **판독 (reviewer, 2026-10-13)**: CRITICAL 0 · HIGH 0 · MEDIUM 0 — undo/redo 왕복 · prefix 뒤 size 변경 순서 무관 (geometry · visual 같음) 프로브 확인. LOW deferred: ① `catalogFieldPrefix` 가 template 위치의 prefix 를 못 읽는다 (재현 경로 없음 — 아래 ③ 에 막힘) ② `invalidBorder` 가 작성자 일반 `borderColor` 를 보지 않는다 (quiet 경로와 같음, 미확인) ③ prefix 에 `showWhen` 을 걸면 상자 style 이 남을 수 있다 (S2 prefix 는 정적, 미확인) ④ 패널이 step 구독 (집계 값). **이 ADR 밖 기존 결함**: `createComponent` 가 template 루트의 `fillSlot` override 를 버린다 (NumberField Group 에 노드를 넣고 component 로 만들면 그 노드가 사라짐 — prefix 도 같은 길) — 별도 작업.
