# Changelog — 2026-10 아카이브 (10-03 ~ 10-31)

> `docs/CHANGELOG.md` 에서 옮긴 2026-10-03 ~ 2026-10-31 엔트리 510개. 본문이 아카이빙 기준
> (500KB) 을 넘겨 분리했다 (2026-11-25). **append-only** — 재편집 금지, 내용은 옮긴
> 그대로다. 현재 엔트리는 [CHANGELOG.md](./CHANGELOG.md).

## [ADR-296 Phase 0 ~ 3 — 코드 보기 = 프로젝트 파일 트리 (App · pages · data · api · state)] - 2026-10-31

### Added

- **코드 패널의 파일 목록 · 탭 · 여러 파일 Apply**: 코드 보기가 page 한 파일에서 프로젝트의 가상 파일 트리로 넓어졌다 — `src/App.tsx` · `src/pages/<Page>.tsx` · `src/data/<collection>.ts` · `src/api/<endpoint>.ts` · `src/state/project.ts`. 목록은 이름만 열거하고 파일은 열 때 하나만 만든다. 초안이 있는 파일은 탭 · 목록에 표시되고, **Apply 한 번이 초안 전부를 한 명령 (Undo 1) 으로** 적용한다 — 하나라도 거절이면 아무것도 적용하지 않는다. 정의 파일 (App · data · api · state) 을 먼저 계획하므로 같은 Apply 에서 새로 만든 page · collection · 바꾼 변수 이름을 page 코드가 바로 쓸 수 있다.
- **`App.tsx`** = `createBrowserRouter([{path, element, children}])` (page 추가 · 삭제 · path · 부모 · 이름 · 순서 · layout route) · `<ToastContainer placement>` · `<Theme name>`.
- **page 파일**: body 자신의 prop · 규칙이 있으면 `<Page …>` 래퍼 · `<title>` · `<meta>` (page meta) · `useParams()` · 작성자 `id` · `className` · `aria-label` · `{false && <T/>}` (꺼진 노드).
- **data · api · state 파일**: collection 의 필드 · 설정 · 행 (`updateCollection` · 새 파일은 `addCollection`) · `endpoint({…})` (`setEndpoint`) · 프로젝트 변수 `cart: 0, // persist` (`setProjectVariable` · `renameVariable` · 삭제). page 는 프로젝트 변수를 `let {cart, setCart} = useProjectState();` 로, endpoint 를 `await saveOrder({body})` 로 부른다.

### Fixed

- **코드에 출력만 되고 고치면 거절되던 형태**: 패널이 숨기는 When (hover · press 부수 · focus) · show / hide / toggle (`setTextIsVisible(false)`) · Form submit · reset (`formRef` 선언 없음) · 대상이 instance 안 · 원본 · 다른 page · 「대상 없음」 인 Do (주석으로 나가 편집하면 사라짐) → `capability('hide', {target: '<ref>' | null})` · `keep('do-N')` 로 문서 그대로 보존.
- **같은 When 의 규칙 여러 개가 handler 하나로 합쳐지던 것**: 규칙마다 이름 붙은 함수 (`function onButtonPress() {…}`) — 규칙 경계 · id · 독립 실행이 코드에서도 유지된다 (사용자 결정 7).
- tree `append` · `insert` · `move` 의 부모 key 가 코드에서 빠지던 것 · 한 key `remove` 가 `...key` 로 쓰이던 것 · token prop 이 조용히 빠지던 것 (`token('<name>')`) · CalendarDuration · NumberFormat prop 을 고치면 거절되던 것 · instance 위치 규칙이 instance 요소의 handler 로 잘못 나오던 것.
- 검증: RED 16 (Phase 0) → GREEN 14 (남은 2 = Phase 5 몫) · 어휘표 행마다 read 실증 게이트 · 파일 간 참조 · 원자성 반례 · 원복 RED 2 종 · 번들 Builder initial +102 B / Preview 0 (기준 `44af0b81e`) · live (별도 dev 서버 — App + page 한 Apply → Undo 1 · 새로고침 유지).

## [ADR-294 — 중첩 입력값과 instance별 API 필터 수정] - 2026-10-31

### Fixed

- 중첩 컴포넌트의 입력 variable을 descendant override로 변경해도 Canvas·Preview가 원본 값을 읽던 문제를 수정했다. 기존 resolver의 override 합성 순서를 재사용하고, override에만 저장한 변수 참조도 갱신 의존성에 포함한다.
- API 보기 요청이 instance의 입력값 대신 정의 기본값으로 실행되던 문제를 수정했다. 접힌 중첩 경계를 포함한 실제 instance 경로로 값을 해석하고, 응답 재사용도 해석된 query 값으로 구분한다. 서로 다른 입력으로 같은 collection을 읽는 instance는 기존 10,000행 상한 안에서 전체 행을 로드한 뒤 각자 평가한다. Builder의 새 행이 응답을 교체하면 이전 응답 식별자도 함께 버린다.
  - 검증: 인접 통합 회귀 75개, 핵심 경로 원복 RED 3건, Undo/Redo 및 JSON snapshot 재로드.

## [ADR-295 후속 — S2 와 다르게 남은 고정 치수 (S2 1.8.1 소스 대조)] - 2026-10-31

### Fixed

- **ProgressCircle 선 굵기 · Color 조작기 치수가 S2 와 달랐던 것 (1차)**: 설치된 `@react-spectrum/s2` 1.8.1 소스와 값을 다시 맞췄다.
  - ProgressCircle 선 굵기: 크기 무관 3 → S2 `strokeWidth` S 2 · M 3 · L 4. 터치에서도 그대로다 (S2 `pxToRem` — 지름만 × 1.25). **Why**: rule 에 굵기 칸이 없어 DOM · Canvas 가 기본값 3 을 썼고, DOM 은 svg 를 desktop 좌표계 (viewBox) 로 늘려 터치에서 굵기도 같이 커졌다. 이제 rule `indicator.strokeWidth` 를 두 consumer 가 읽고, DOM svg 는 S2 처럼 `r = calc(50% - 굵기/2)` · `pathLength` 100 으로 그린다.
  - ColorThumb 포커스 크기 20 → 32 (S2 `ColorHandle` `isFocusVisible`, `scaled`).
  - ColorSlider: 가로 폭 192 (전 최대 폭 300) · 세로 높이 192 (전 150) · 트랙 두께 24 (전 20) — 모두 S2 `size()` 라 `scaled`. **Why (세로)**: 조건 규칙 (orientation 변형) 의 `visual` 길이 ref 를 Canvas 가 풀지 못해 높이 0 이 됐다 — 변형 visual 도 토큰 값으로 바꾼다.
  - ColorWheel 기본 지름 180 → 192 · 고리 26 → 24 (S2 inline px — 터치 불변).
  - ColorArea 최소 크기 64 (S2 `minSize`, `scaled`) · ColorSwatch · ColorSwatchPicker 크기 XS 16 추가 (S2 `size` XS).
  - 위치: `componentRulesTable.ts` (ProgressCircle · ColorThumb · ColorSlider · ColorArea · ColorSwatch · ColorSwatchPicker) · `ProgressCircle.tsx` · `skiaPrimitives.ts` (`value_fill_arc`) · `catalog-style.types.ts` · `spec.types.ts` · `resolveCatalogRuleCanvasBox.ts` (ColorWheel) · `ruleDefinition.ts` (변형 visual 토큰).
  - 검증: G4 `d3S2Alignment` (S2 소스 정규식 대조 5 + ColorSwatch XS) · 원복 RED (HEAD rule · 상수 → 6 FAIL) · G2 desktop · touch 263/263 · live 5175 (Canvas 192 · DOM desktop 192 · 터치 240 · ColorWheel 192 그대로 · ProgressCircle 터치 40 / 굵기 3 · 콘솔 0).
- **Tree 펼침 버튼 열 · Table 머리글 · Toast 최대 폭 (2차)**:
  - Tree 펼침 버튼 열 20 → S2 `expandButton` 40 (+ 단계 들여쓰기 16 그대로) — 둘 다 S2 `size()` 라 터치 × 1.25. `Tree.css` 는 desktop 값, catalog DOM 은 펼침 Button inline 에 기기 식, Canvas 는 `catalogScaledPx`.
  - Table 머리글: 밀도를 따라 33 · 41 · 49 → S2 `DEFAULT_HEADER_HEIGHT` 32 고정 (터치 40). **Why**: S2 는 `headingHeight` 를 scale 로만 고르고 density 는 칸 (Cell) 만 바꾸는데, Column 이 Cell 과 같은 density 표를 갖고 있었다. Column 의 density 표를 지우고 위아래 여백 6.5 (= (32 − 줄 18 − 아래 선 1) / 2) · 최소 높이 `scaled(32)`.
  - Toast 최대 폭 336 (S2 `--maxWidth`, `scaled`). S2 의 `min(…, 90vw)` 쪽은 Canvas 에 viewport 축이 없어 싣지 않았다.
  - 위치: `componentRulesTable.ts` (Column · Cell 주석 · Toast) · `presence.ts` (`catalogTreeChevronBox` · `catalogTreeChevronLevel`) · `domBinding.runtime.ts` (`treeChevronSheetBox`) · `Tree.css` (펼침 열 · 끌어 놓기 표시 위치 46).
  - 검증: G4 (Tree 펼침 열 · Toast 최대 폭 · 머리글 = S2 `DEFAULT_HEADER_HEIGHT`) · 원복 RED 8 · G2 desktop · touch 263/263 · live 5175 (펼침 열 desktop 40 · 터치 50, 머리글 Canvas 32 · DOM 32 · 터치 40, 콘솔 0).
- **StatusLight 행 높이가 터치에서 글자 줄과 어긋나던 것 (3차)**: S2 StatusLight 는 높이를 두지 않고 `font: controlFont()` 한 줄이 행을 정한다. rule 의 desktop 행간 리터럴 16 · 18 · 20 · 22 를 지우고 (height 0) controlFont 행간 토큰을 넣었다 — 터치 보기에서 행 18 → 22 (M). **Why**: 높이가 숫자로 박혀 터치 행간 (22) 과 갈렸고, 행간 토큰이 없어 높이를 풀면 Canvas 는 글자 높이 (17) · DOM 은 상속 1.5 배 (21) 로 다시 갈렸다. Canvas 점은 배치된 상자 높이의 가운데 (`_containerHeight`), DOM 라벨은 같은 토큰의 변수.
  - ProgressBar · Meter 최소 폭은 이미 S2 (`{size.bar.min-width}` 48 · 터치 60) 라 그대로. 「기본 폭 208」 은 S2 소스에 없다.
  - 위치: `componentRulesTable.ts` (StatusLight) · `StatusLight.tsx` · `skiaPrimitives.ts` (`status_light`) · `ruleShapes.ts` (`BOX_SIZE_TYPES`).
  - 검증: G4 (height 0 · 행간 토큰 = S2 controlFont 행간) · 원복 RED (rule → 1 FAIL · DOM 행간 없이 → G2 StatusLight 4 × 2 FAIL) · G2 desktop · touch 263/263 · live 5175 (Canvas 18 · DOM desktop 18 · 터치 22, 콘솔 0).
- **Select · ComboBox 목록 항목이 크기와 무관하게 32 였던 것 (4차)**: S2 Picker · ComboBox 는 자기 `size` 를 목록과 항목에 준다 (`InternalPickerContext` → `listbox({size})` · `listboxItem({size})`). Select L 의 항목이 40 이 아니라 32 였다.
  - **Why**: ListBox · ListBoxItem rule 에 M 크기만 있어 (`propChoices.size = ["M"]`) 다른 크기가 버려졌고, Select · ComboBox → ListBox 전파도 없었으며, 사용자 picker 팝오버의 항목 여백이 `--spacing-2xl` (32) 고정이었다.
  - 전파: Select · ComboBox → (Popover 통과) → ListBox → ListBoxItem (ListBoxSection 통과). picker 안 ListBox · 항목의 크기는 picker 소유 (패널에서 편집하지 않음).
  - ListBoxItem 크기 XS · S · L · XL 추가 — S2 `control({wrap, icon})`: 최소 높이 = control 높이 (20 · 24 · 32 · 40 · 48), 위아래 = `(높이 − 줄) / 2`, 좌우 = 높이 × 3/8, 글자 = control 글자. ListBox 크기도 같은 다섯 단 (글자만).
  - 사용자 picker 팝오버 (`[data-catalog-id]`) 안 항목의 최소 높이 · 위아래 여백 = 목록 크기의 control 높이 (머리글이 쓰던 변수를 `--lb-control-h` 로 이름만 바꿔 같이 쓴다). 빌더 자체 picker 는 생성 ListBox 시트를 싣지 않아 그대로다.
  - 위치: `sizePropagation.ts` · `componentRulesTable.ts` (ListBox · ListBoxItem).
  - 검증: `s2PickerItemSize.test.tsx` (Select 5 크기 · ComboBox · 단독 ListBox Canvas 높이 · DOM `data-size`) · G4 (S2 `Picker.tsx` 대조 + 크기별 최소 높이 · 위아래 여백) · 원복 RED 11 · live 5175 (Select L → ListBox `data-size="L"` · 팝오버 항목 4개 높이 40 · 글자 16, 콘솔 0).
- **ColorSwatch 기본 모서리 · ColorSwatchPicker 견본 크기가 S2 와 달랐던 것 (5차)**:
  - ColorSwatch 기본 `rounding`: `full` (원) → S2 기본 `default` (sm 4). `full` 은 그대로 고를 수 있다 (변형 블록 추가). **Why**: 2026-06-22 RAC 레퍼런스의 원형에 맞춘 값이 S2 (`rounding = ctx?.rounding || 'default'`) 와 갈려 있었다.
  - ColorSwatchPicker: 견본이 picker 크기와 무관하게 28 고정 원이었다 → S2 처럼 picker `size` 가 견본 크기 (XS 16 · S 24 · M 32 · L 40, 터치 × 1.25) 이고 견본은 각진 모서리 (S2 picker `rounding = 'none'`). 원본 template 의 견본 28 × 28 작성값을 지우고 `rounding: none` 을 둔다. 사용자 picker 항목의 선택 · focus 링 모서리도 견본 모서리를 따른다 (DOM 상호작용 표시).
  - 위치: `ColorSwatch.binding.ts` · `componentRulesTable.ts` (ColorSwatch) · `sizePropagation.ts` (ColorSwatchPicker → ColorSwatch, 항목 통과) · `reusableOriginLibrary.ts` (picker 견본) · `ColorSwatch.css` · `ColorSwatchPicker.css`.
  - 검증: `s2ColorSwatchRounding.test.tsx` (기본 · 세 값 · picker 네 크기) · `colorSwatchRounding.test.ts` (Skia 칠 모서리 4 · 0 · 9999) · G4 (S2 `ColorSwatch.tsx` · `ColorSwatchPicker.tsx` 대조) · 원복 RED 6 · live 5175 (단독 견본 Canvas · Preview 32 / 모서리 4, picker L 견본 6개 Canvas · Preview 40 × 40 / 모서리 0, 콘솔 0).
  - ~~남은 것: Canvas 는 picker 견본의 색을 칠하지 않는다~~ → 9차에서 닫음.
- **Table 에 drag 열이 없던 것 (6차)**: S2 TableView · RAC 레퍼런스 Table 은 행을 끌 수 있는 표 (`allowsDragging`) 맨 앞에 drag 열을 자동으로 둔다 — 폭 16 (터치 20), 행마다 drag 손잡이 (S2 `DragHandleButton` 10 × 22) 는 그 행에 키보드 focus 가 있을 때만 보인다. 우리 Table 은 이 열이 없어 키보드로 끌 손잡이가 없었다.
  - 판정: Table 의 drag 규칙 (Interactions 의 `onReorder` · `onDragEnd` …) — Preview 가 `dragAndDropHooks` 를 주는 판정을 공용 함수로 옮겨 (`collectionDragState.ts`) Canvas · DOM 이 같은 답을 읽는다. 규칙 적용 판정 (`catalogInteractionAppliesTo`) 도 Preview 의 `recordsOfOwner` 와 한 함수.
  - Canvas: 머리글 행 · 모든 Row 의 트랙 맨 앞 16px + 빈 칸 (문서 노드 아님). DOM: RAC Column (화면 낭독용 이름 「Drag」) + Row 마다 RAC Cell > RAC `Button[slot=drag]` (RAC 가 이름 「Drag Item 1」 · 끌기 동작을 준다). 손잡이 크기는 기기 배율, 칸 좌우 4.
  - 위치: `collectionDragState.ts` (신규) · `effectiveInteractions.ts` · `compositionRoot.ts` (`withTableDrag` · composed part) · `tableTracks.ts` · `domBinding.runtime.ts` (`catalogTableDragPart` · 터치 트랙) · `domBinding.components.tsx` · `catalogPreviewInteractions.ts` · `Table.css`.
  - 검증: `s2TableDragColumn.test.tsx` (규칙 없음 · onReorder · onDragEnd · 제자리 편집으로 열이 빠짐 — Canvas 첫 Column x 0 → 16, DOM drag Column · Cell) · 원복 RED 3 · `adr284Drop` (Preview drag 동작) 통과 · live 5175 (Canvas 첫 Column · Cell x 16 · Preview drag 열 16 / 첫 Column 16 에서 시작 · 키보드 focus 시 손잡이 10 × 22 표시, 콘솔 0).
  - ~~남은 것: 크기 조절 Table 의 RAC 열 폭은 숫자라 터치에서도 16~~ → 7차에서 닫음.
- **크기 조절 Table 의 drag 열이 터치에서 16 이던 것 · Table 에 S2 없는 크기 축 (7차)**:
  - drag 열 폭: RAC 열 폭은 px 숫자라 CSS 기기 식을 받지 못한다 — S2 처럼 JS 로 기기 배율을 읽어 (`useScale()` → `16 : 20`) RAC Column `width` 에 준다. 배율은 문서 root 의 `--catalog-token-size-unit` (테마 시트의 S2 기기 미디어 · Preview 「터치 크기로 미리보기」 와 같은 판정) 이라 생성 CSS 와 갈리지 않는다 (`deviceUnit.runtime.ts` 신규). 크기 조절 Table 은 RAC 가 나머지 열을 줄여 전체 폭을 맞춘다.
  - Table S · M · L 크기 축 삭제: S2 TableView 에는 size 가 없다 (칸 글자 = `controlFont()`, 행 높이 = `density`). Properties 의 Size 행이 사라진다. Table 상자의 한 벌 = 모서리 6 (S2 `borderRadius: '[6px]'`, 전 S 4 · M 8) · 글자는 팔레트 Table 이 쓰던 단. 원본 template 의 `size: "S"` · 수동 `Table.css` 의 `[data-size]` 블록 3 (칸 여백 · 글자는 rule inline 이 이미 이기고 있었다) 삭제.
  - 위치: `deviceUnit.runtime.ts` · `domBinding.runtime.ts` (`CatalogTableDragColumn`) · `Table.binding.ts` · `componentRulesTable.ts` (Table) · `reusableOriginLibrary.ts` · `Table.css`.
  - 검증: `adr257TableOperations.test.tsx` (크기 조절 + drag 규칙 Table — desktop 첫 트랙 16 · 터치 단위 20) · 원복 RED (상수 16 → 터치 FAIL) · `adr277TableOrigin` · `treeTableBindings` (size 없음) · G3 (모서리 6 등재 · 읽는 곳 없던 높이 등재 삭제) · live 5175 (Properties Appearance 에 Size 없음 · Preview Table 모서리 6 / `data-size` 없음 / 칸 14px · Canvas ↔ CSS 같은 모습, 크기 조절 + drag 규칙 Table 의 drag 열 desktop 16 → 터치 보기 20 · 나머지 열 124 → 122~123, 콘솔 0).
- **앱 실행 토스트가 S2 Toast 와 달랐던 것 (8차, 사용자 「Toast - RSC 기준으로 수정해」 → 실행 토스트로 결정)**: 규칙 Do 「toast」 · 실패 안내가 띄우는 Preview · Publish 토스트를 S2 1.8.1 `ToastQueue` + `ToastContainer` 대로 바꿨다. 팔레트에 없는 Toast 노드 type 은 그대로.
  - 전: 옛 `ToastProvider` — `div role="alert"`, variant info · success · warning · error, 연한 배경 + 진한 글자, 기본 5초 자동 닫힘, 오른쪽 위로 밀려 들어옴.
  - 후: RAC toast primitive (`UNSTABLE_ToastRegion` · `ToastList` · `Toast` — region landmark · `alertdialog` · 닫기 버튼 이름) 위에 S2 모양. variant neutral · info (기본) · positive · negative — 진한 색 + 흰 글자 · 아이콘 (neutral 없음) · 닫기 버튼. 최소 높이 56 · 최대 폭 min(336, 90vw) · 닫기 32 (터치 × 1.25) · 여백 12 / 16 · 8 · 모서리 10. timeout 없음 = 닫을 때까지, 지정하면 최소 5초 (S2). 쌓이면 맨 위 하나 + 뒤 두 장의 색 띠, 「모두 표시」 로 펼치고 「모두 지우기」 · 「접기」 (Escape · 바깥 클릭도 접기). 뒤에 쌓인 토스트는 맨 위에 올라온 뒤부터 시간을 잰다 (S2 · RAC 와 같다).
  - Do 「toast」 에 S2 `ToastQueue.<variant>` · `timeout` 입력 (Interactions 패널 Variant · Timeout). 로드 · 제출 실패 안내는 negative.
  - region 모듈은 첫 토스트 때 불러온다 — Preview 초기 JS gzip 319,160 B (상한 320,000, 다른 세션의 미커밋 변경 포함 측정).
  - 넣지 않은 것: S2 의 view transition (밀려 들어오기 · 교차 fade) · action 버튼 (`actionLabel` · `onAction` — 규칙 안에 Do 를 둘 자리가 없다) · 펼친 목록의 focus 가두기 · 스크롤 잠금.
  - 위치: `Toast.tsx` · `ToastRegion.lazy.tsx` (신규) · `ToastContext.ts` · `Toast.css` · `types.ts` (Do variant · timeout) · `validation.ts` · `interactionRule.types.ts` · `dispatcher.ts` · `catalogPreviewInteractions.ts` · `toastBridge.ts` · `domView.runtime.ts` (`catalogToastPlacement`) · `domView.components.tsx` · `CatalogEventRow.tsx` · i18n 2.
  - 검증: `s2RuntimeToast.test.tsx` (Do → 옵션 · 거절 3 · variant 4 색 · 기본 info · timeout 5초 하한 · 쌓임 / 펼침 / 지우기) · `toastPlacement` · `reload` (실패 = negative) · 원복 RED 2 · live 5175 (Button 규칙 3 → Preview 토스트 info 위 · negative · positive 띠, 오른쪽 아래 16, 흰 글자 · 패딩 12/8/12/16 · 모서리 10, 「모두 표시」 → 3 개 · 「모두 지우기」 → 0, 터치 보기 최소 높이 70 · 최대 폭 351 (= 90vw) · 글자 17 · 닫기 40, 맨 위를 닫자 6초 지정 negative 가 6초 뒤 닫힘, Interactions 패널 Variant Negative → Positive 한 step, 콘솔 0).
  - 남은 것 (다른 세션 몫): code view 는 Do 「toast」 를 `toasts.add({title})` 로만 내 variant · timeout 이 코드에 나오지 않는다.
- **Canvas 가 ColorSwatch 색을 칠하지 않던 것 · ColorSwatch · ColorSwatchPicker 가 컴포넌트 패널에 없던 것 (9차)**:
  - Canvas: 견본 상자가 그 색이다 — 자기 `color`, 없으면 ColorSwatchPickerItem 의 `color` (RAC `ColorSwatchContext` — 자기 prop 이 이긴다). 전에는 단독 견본 · picker 견본 모두 rule 의 흰 상자였다 (Preview 는 RAC 가 inline 으로 칠함 — 비대칭). 파생 `_swatchColor` (`#rrggbbaa`) 를 rule 칠이 상자 바탕으로 읽고, 항목 색이 바뀌면 견본이 다시 그려진다 (분리한 picker 의 소유 항목도).
  - 컴포넌트 패널: Forms 의 Color 조작기 (ColorWheel) 뒤에 color swatch · color swatch picker (팔레트 category 가 쓰이지 않는 `color` 였다).
  - 위치: `colorControlParts.ts` (`catalogColorSwatchColor` · 파생 · 항목 → 견본 의존) · `rulePaint.ts` · `componentCatalog.ts` · `paletteItems.ts` · `ColorSwatch.binding.ts` (주석).
  - 검증: `s2ColorSwatchPaint.test.ts` (단독 Canvas = DOM 색 · picker 6 견본 = 항목 색 · 항목 색 편집 · 분리한 picker 편집 · 패널 순서) · `paletteItems` oracle · 원복 RED (칠 제거 → 3 FAIL · 의존 제거 → 분리 picker 1 FAIL) · live 5175 (검색 「swatch」 → Forms 2 항목, picker 삽입 → Canvas 6 색 · 단독 견본 Color Value `#3366ff` → Canvas 파랑, Preview DOM 7 색과 같음 · 모서리 0 / 4, 콘솔 0).
- **Table 선택 checkbox 열이 터치에서도 40 · 크기 조절 Table 에서는 75 이던 것 (10차, 사용자 「Table 선택 열 터치 52 도 S2 식으로」)**: S2 TableView 는 선택 checkbox 열을 `width={scale === 'medium' ? 40 : 52}` 로 둔다 — 터치 값이 40 × 1.25 (50) 가 아닌 S2 리터럴 52 라 기기 배율 식으로는 만들 수 없다.
  - 기기 두 벌 size 토큰 `{size.table.selection-column}` (desktop 40 · 터치 52 — 테마 시트 `--catalog-token-size-table-selection-column`) 추가. 폭을 작성하지 않은 선택 열의 트랙: Canvas 는 토큰 px (40), DOM 은 그 CSS 변수 (파생 `_tableDeviceTracks` — 작성한 px 최소 폭은 `max(…)` 로 그대로 바닥). 작성한 폭이 있으면 작성값.
  - 크기 조절 Table: RAC 열 폭은 px 숫자라 선택 Column 이 폭 없이 RAC 기본 1fr · 최소 75 를 받아 데스크톱에서도 75 였다 (기존 결함). S2 처럼 JS 로 기기 값을 읽어 (`useCatalogDeviceTokenPx` — S2 `useScale()` 대응) RAC Column `width` · `minWidth` 에 준다.
  - 위치: `device.ts` (`S2_TABLE_SELECTION_COLUMN_WIDTH` · `s2SizeTokens`) · `tableTracks.ts` (`deviceTrack` · `catalogTableColumnDeviceTracks` · `catalogTableSelectionColumn` 공개) · `presence.ts` · `compositionRoot.ts` (`withTableDrag` 가 device 목록에도 drag 열) · `domBinding.runtime.ts` (`CatalogTableSelectionColumn`) · `deviceUnit.runtime.ts` · 생성 `theme-seed.generated.css`.
  - 검증: `adr257TableTracks` (Canvas 40px · DOM 변수 · 작성 최소 45 → `max(var, 45px)` · 작성 폭 90 → 변수 없음) · `adr257TableOperations` (크기 조절 + 선택 열 desktop 40 · 터치 52) · `resolveThemeSnapshot` (두 벌 40px · 52px) · G4 (S2 `TableView.tsx` 대조) · 원복 RED 3 (토큰 → 2 FAIL · DOM 변수 → 1 · RAC 폭 → 2) · live 5175 (선택 열 Table — Canvas 40 · Preview 40 → 터치 보기 52 → 되돌림 40, 크기 조절로 바꾼 뒤 RAC 폭 `40px 174px 174px` → 터치 `52px 168px 168px` → 40, 콘솔 오류 0).
  - 남은 것: S2 선택 칸 여백 (시작 16 · 끝 8) 은 이번에 대조하지 않았다.
- **295 후속 남은 다섯 항목 (11차, 사용자 「나머지 다섯 항목 바로 진행해서 완료해라」)** — S2 1.8.1 `Toast.tsx` · `Toast.module.css` · `TableView.tsx` 원본 대조:
  - **code view 의 toast**: 규칙 Do 「toast」 가 variant · timeout 을 RAC 큐 모양 그대로 낸다 — `toasts.add({title: 'Saved', variant: 'positive'}, {timeout: 6000});`, variant 를 쓰면 큐 선언 타입에 `variant?: 'neutral' | 'info' | 'positive' | 'negative'`. 코드에서 두 값을 고치거나 지우면 Do 가 바뀌고, S2 에 없는 variant 는 거절된다.
  - **토스트 애니메이션**: S2 처럼 추가 · 닫기 · 모두 지우기 · 펼침 · 접힘이 view transition 이다 (`document.startViewTransition` + `flushSync`, 종류는 html class — Safari 우회도 S2 와 같다). 새 토스트는 놓인 가장자리에서 미끄러져 들어오고 닫힌 것은 나가며, 펼침 · 접힘은 맨 위 토스트의 내용 · 「모두 표시」 · 닫기가 따로 움직인다. 동작 줄이기 설정이면 교차 fade. 접힌 묶음을 (버튼이 아닌 곳) 누르면 펼친다 · 「모두 표시」 를 누르면 focus 가 토스트로 간다 (S2).
  - **펼친 목록 = 화면 차지**: S2 `useModalOverlay` (스크롤 잠금 · 나머지 페이지를 보조기기에서 숨김 — Chrome 은 `inert`) · `FocusScope contain` (focus 가 목록 밖으로 못 나감). `react-aria` 를 shared 의존성에 추가 (catalog 버전 그대로 — 토스트 모듈은 첫 토스트 때 불러오므로 초기 번들 무관).
  - **Table 칸 여백**: 모든 칸 · 머리글 좌우 8 → S2 16 (`paddingX: 16` — table-edge-to-content, 터치에서 그대로), 선택 checkbox 열의 머리글 · 칸은 시작 16 · 끝 8 (S2 `selectAllCheckboxColumn` · `checkboxCellStyle`). 선택 칸 표지는 파생 `_tableSelectionPart` 하나를 Canvas (`catalogBoxModel`) · DOM 이 읽고, 작성한 오른쪽 여백이 이긴다.
  - **선택 체크박스가 Preview 에 안 보이던 것**: 결함이 아니었다 — 지난 확인에서 부품 없는 맨 Checkbox 노드를 넣은 탓. 팔레트 Checkbox 를 넣고 RAC slot 을 selection 으로 두는 실제 경로는 머리글 · 칸 모두 보인다 (live 확인).
  - 위치: `codeView/generate.ts` · `codeViewEdit.ts` · `codeView/fieldCoverage.ts` · `ToastRegion.lazy.tsx` · `Toast.css` · `packages/shared/package.json` · `pnpm-lock.yaml` · `componentRulesTable.ts` (Cell · Column) · `boxModel.ts` · `presence.ts` · `tableTracks.ts` (의존) · `domBinding.runtime.ts`.
  - 검증: `s2CodeViewToast.test.tsx` (표시 · strict 재읽기 · 편집 · 지우기 · 추가 · 거절) · `s2RuntimeToast.test.tsx` C6 4 (전환 종류 · class 정리 · 스크롤 잠금 · 바깥 숨김 · focus 가두기 · 목록 클릭 펼침 · 동작 줄이기) · `adr257TableTracks` C7 2 (Canvas = DOM 16·16 / 16·8) · G4 (S2 `TableView.tsx` 여백 대조) · 원복 RED 7 · Preview 초기 JS gzip 318,359 B (상한 320,000) · live 5175 (Table 선택 칸 — Canvas · Preview 체크박스 x 16 · 여백 16/8 · 일반 칸 16/16, 토스트 추가 `catalog-toast-add` 전환 + `catalog-toast-slide-in` 애니메이션 실행 · 끝나면 class 제거, 「모두 표시」 → `catalog-toast-expand` · html overflow hidden · 페이지 `inert` · focus 를 바깥으로 옮겨도 region 안 · Escape → `catalog-toast-collapse` · 스크롤 복귀, code view 에 variant · timeout 줄, 콘솔 오류 0).
  - 넣지 않은 것: 토스트 action 버튼 (규칙 안에 Do 를 하나 더 둘 구조가 필요 — 사용자 결정 대기).
- **토스트 action 버튼 = S2 원본대로 (12차, 사용자 「action 버튼도 S2 원본대로 진행해」)** — S2 1.8.1 `ToastOptions` `actionLabel` · `onAction` · `shouldCloseOnAction`:
  - **규칙**: Do 「toast」 에 버튼 글자 · 「누르면 닫기」 · 버튼을 누르면 실행할 Do 목록 (`onAction`) 이 생겼다. 안쪽 Do 는 바깥 규칙의 event 를 그대로 읽는다 (JS closure 처럼). S2 대로 버튼이 있는 토스트는 저절로 닫히지 않아 (WCAG 2.2.1) 버튼 글자와 timeout 을 같이 두면 거절된다.
  - **토스트**: 버튼은 S2 `<Button variant="secondary" fillStyle="outline" staticColor="white">` — 문서 Button 의 생성 시트가 그대로 칠한다 (투명 바탕 · 흰 테두리 · 흰 글자 · pill). 펼침 · 접힘 전환에 버튼도 따로 움직인다 (S2 `toast-action`).
  - **Interactions 패널**: toast Do 에 「버튼 글자」 칸 — 쓰면 timeout 칸이 빠지고 「누르면 닫기」 스위치와 버튼 Do 목록 (같은 편집기를 안쪽에 한 단, When 없음) 이 나온다. 글자를 지우면 버튼과 안쪽 Do 가 같이 빠진다.
  - **code view**: `toasts.add({title, variant, actionLabel: 'Undo', shouldCloseOnAction: true, onAction: () => { … }}, …)` — 안쪽 Do 가 화살표 함수 본문이고, 큐 선언 타입에 `actionLabel?` · `onAction?` · `shouldCloseOnAction?`. 코드에서 안쪽을 고치거나 지우면 Do 가 바뀐다 (문 나누기가 괄호 · 따옴표 안의 `;` 를 건너뛴다).
  - **Do 를 읽는 곳 전부가 안쪽 Do 까지**: 참조 색인 · 문서 검증 · 복사 · 페이지 복제 · 컴포넌트 만들기 · swap · 해제의 주소 재작성 · 변수 이동 · 사용처 세기 · drag 규칙 판정이 공용 함수 (`interactionActions.ts` — `catalogActionsDeep` · `mapCatalogActionsDeep` · `filterCatalogActionsDeep`) 를 거친다 — 안쪽 Do 의 page · 변수 · 대상이 dangling 이 되지 않는다.
  - 위치: `document/types.ts` · `validation.ts` (재귀) · `interactionActions.ts` (새) · `graph.ts` · `clone.ts` · `commands/{components,materialize,swap,project,properties}.ts` · `transaction.ts` · `collectionDragState.ts` · `catalogPreviewInteractions.ts` · `dispatcher.ts` · `interactionRule.types.ts` · `Toast.tsx` · `ToastRegion.lazy.tsx` · `Toast.css` · `codeView/generate.ts` · `codeViewEdit.ts` · `CatalogEventRow.tsx` · `InteractionsPanel.css` · `viewAuthoring.ts` · `dataVariables.ts` · `targetRef.ts` · i18n.
  - 검증: `s2RuntimeToast` (규칙 → 옵션 · 버튼이 안쪽 Do 실행 · 거절 6 — 라벨 없는 onAction · 라벨 + timeout · 안쪽 잘못된 variant · 빈 onAction · 안쪽 없는 page · region 버튼 = Button 시트 + 누르면 실행 · 닫기 · 버튼 있으면 timeout 무시) · `s2CodeViewToast` 3 · `s2ToastActionPanel` · `interactionActions` 3 · 원복 RED 9/9 · live 5175 (Button 규칙에 toast + 「Undo」 + 닫기 + 안쪽 toast Do → code view 줄 · 큐 타입 확인 → Preview 에서 누르면 파란 토스트에 Undo 버튼 (투명 · 흰 테두리 · 32 · pill) → Undo 누르면 원래 토스트 닫히고 안쪽 토스트 표시, 콘솔 오류 0).
  - 패널의 안쪽 capability Do 는 Canvas 에서 대상 고르기 (조준) 를 받지 않는다 — 목록에서 고른다.
- **Toast 가 컴포넌트 패널에 없던 것 (13차, 사용자 「Toast 컴퍼넌트가 현재 컴퍼넌트패널에 없다 · S2 원본대로」)** — 팔레트 Content 의 InlineAlert 뒤 「toast」 = S2 1.8.1 `Toast.tsx` `toastStyle` 한 장:
  - **모양**: variant 진한 색 (neutral = neutral-subdued · info · positive · negative) · 흰 글자 · 테두리 없음 · 모서리 lg · 최소 높이 56 · 최대 폭 336 (터치 × 1.25) · 위아래 여백 12 · 그림자 elevated (`{shadow.md}`). S2 처럼 크기 축이 없다 (옛 S · M · L 과 옅은 바탕 · 테두리는 S2 가 아니었다).
  - **구성**: 원본 `component-toast` = 글자 Text (S2 `font: 'ui'` — Text S) + S2 action Button (`variant="secondary" fillStyle="outline" staticColor="white"`), 둘 사이 24 (S2 `columnGap`). variant 아이콘 (Icon M — neutral 은 없음) 과 닫기 (CloseButton — control M) 는 S2 가 늘 그리는 것이라 Toast 가 자기 여백 안에 그린다: 시작 = 16 + 아이콘 + 8 (neutral 16), 끝 = 8 + 닫기 + 16. 여백은 rem · 버튼과 아이콘은 터치 × 1.25 라 합이 배율 식이 아니어서 기기 두 벌 토큰 `{size.toast.padding-end}` (56 · 64) · `{size.toast.padding-start-icon}` (42 · 46.5) 로 둔다 (선택 열 40 · 52 와 같은 방식).
  - **Preview**: 닫기를 누르면 그 Toast 가 숨는다 (공통 「숨기기」 와 같은 `style.display`). 닫기 버튼 이름 Close · 닫기. 앱이 띄우는 토스트는 그대로 규칙 Do 「toast」 (S2 `ToastQueue`).
  - **같이 고친 것 — Canvas 의 static 색 Button**: `staticColor` white · black Button 을 Canvas 가 variant 의 outline 회색 테두리 · 어두운 글자로 그렸다 (DOM 은 흰색 — `Button.css` `[data-static-color]`). Button 정의에 S2 static 조건 (fill = static 바탕 + 반대 글자, outline = static 글자 · 테두리) 이 빠져 있었다 — Toast 안 action 버튼뿐 아니라 모든 static Button.
  - 위치: `componentRulesTable.ts` (Toast) · `reusableOriginLibrary.ts` (`component-toast`) · `componentCatalog.ts` · `paletteItems.ts` · `Toast.binding.ts` · `device.ts` (`S2_TOAST_EDGE` · 토큰) · `toastChrome.ts` (새) · `presence.ts` (`catalogToastEdges` · `catalogToastText`) · `boxModel.ts` · `compositionRoot.ts` · `delegatedDom.runtime.ts` · `ruleShapes.ts` (`catalogToastChromeShapes`) · `rulePartRules.ts` · `codeCatalogLibrary.ts` (Button static) · 생성 `Toast.css` · `theme-seed.generated.css`.
  - 검증: `s2ToastNode` 7 (패널 순서 · 원본 · 상자 42 / 24 / 56 · neutral 16 → positive 42 · Canvas 글리프 · DOM 아이콘 · 닫기 이름 · Canvas 의 action Button 흰 테두리 · 글자 + 장면의 아이콘 · X) · 원복 RED 8/8 · 번들 Preview 318,917 B (상한 320,000) · Builder 1,387,902 B (1,390,000) · live 5175 (검색 「toast」 → Content 1 → 넣기 → Canvas 306 × 56 파란 Toast + 아이콘 · Action · X, Preview 304.3 × 56 · 여백 12/56/12/42 · 테두리 0 · 간격 24 · 아이콘 중심 (25, 28) · X 중심 (폭 − 24, 28) · 닫기 → 숨김, Neutral → Canvas 아이콘 없이 −26 · Preview 여백 16, Text S 로 바꾼 뒤 Canvas 266 · Preview 264.75 (글자 폭 올림 차이) · 글자 14px 흰색, Canvas static Button 흰 테두리 · 글자 확인, 넣은 노드 삭제, 콘솔 오류 0).
  - 차이로 남은 것: 글자가 여러 줄이면 S2 는 아이콘을 첫 줄 · 닫기를 위쪽에 두지만 여기서는 둘 다 세로 가운데다. Preview 창을 새로 열 때 앞 Preview 창에서 닫은 실행 상태가 이어진 것을 한 번 봤다 (새로고침하면 없어짐 · 문서에는 없음).
- **Library 에 Toast 원본이 없던 것 (14차, 사용자 「toast 컴퍼넌트 origin 이 library 에 없다」)** — Library 페이지는 처음 열 때 문서에 저장되는데 (ADR-282 Phase 3), 그 뒤 팔레트에 들어온 원본의 카드를 더하는 단계가 Local 페이지에만 있었다. 그래서 이미 Library 를 한 번 연 프로젝트에는 Toast (13차) · ColorSwatch · ColorSwatchPicker (C3) 카드가 없었다. 이제 Library 를 열 때 없는 원본의 카드를 팔레트 순서 자리 (앞 원본의 카드 뒤) 에 넣는다 — 히스토리 없는 저장 단계, 옮긴 카드 · 고친 frame 은 그대로.
  - 위치: `componentsPage.ts` (`catalogLibraryPageSync`) · `workspace.ts`.
  - 검증: `libraryPageSync` (Toast 카드 없이 저장된 페이지 → 열면 InlineAlert 뒤에 같은 노드로 복원 · ◆ 가 Toast 원본 · 히스토리 0 · 다시 열면 단계 없음) · 원복 RED 1/1 · live 5175 (adr295-live 의 저장된 Library 70 장 → Navigator Components › Library 열기 → 73 장: Toast 가 InlineAlert 뒤 · ColorSwatch · ColorSwatchPicker 가 ColorWheel 뒤, 히스토리 0, Toast 카드 = ◆ + Variants 4 줄 · ◆ 선택 시 Design 「Toast ORIGIN」, 새로고침 뒤 73 장 유지, 콘솔 오류 0).
- **Library 에서 지운 카드가 다시 들어오던 것 (15차, 사용자 「Library 에서 지운 카드는 다시 넣지 마라」)** — 14차의 동기화는 「카드가 없는 원본」 에 카드를 넣어, 사용자가 지운 카드와 아직 받지 못한 카드를 가르지 못했다. Library 페이지가 카드를 준 원본 목록 `PageEntry.originIds` 를 기록한다 (페이지를 만들 때 · 동기화할 때). 목록에 없는 원본만 카드를 받고, 목록에 있는데 카드가 없으면 사용자가 지운 것이라 그대로 둔다. 목록 없이 저장된 페이지는 빠진 카드를 한 번 받은 뒤 목록을 기록한다.
  - 위치: `document/types.ts` (`PageEntry.originIds`) · `validation.ts` · `codeView/fieldCoverage.ts` (code 에 없는 Builder 기록) · `componentsPage.ts` (`catalogComponentPageCreation` · `catalogLibraryPageSync`).
  - 검증: `libraryPageSync` 4 (새 페이지가 원본 목록 기록 · 목록에 없는 Toast 는 InlineAlert 뒤로 · 목록 없는 옛 페이지는 한 번 받고 기록 · 잠금 풀고 지운 Toast 카드는 다시 열어도 없음 · 단계 없음) · 원복 RED 2종 (기록 무시 → 지운 카드 테스트 실패 · 생성 때 기록 안 함 → 2 실패) · `fieldCoverage` 인벤토리 +1 · live 5175 (목록 없던 Library 를 열자 원본 70 기록 · 히스토리 0 → 잠금 풀고 Toast 카드 선택 → Delete → 72 장 → Local 갔다가 Library · 새로고침 뒤 다시 열어도 72 장, 정리로 기록에서 Toast 를 빼고 다시 열자 InlineAlert 뒤에 복원, 콘솔 오류 0).

## [ADR-295 후속 — S2 고정 치수의 터치 배율 (`scaled`)] - 2026-10-31

### Fixed

- **터치 기기에서 S2 고정 치수가 desktop 값 그대로였던 것 (1차)**: S2 는 sizing 속성의 숫자 (`size()`) 를 `--s2-scale` 로 키운다 (터치 × 1.25). rule 에 새 형 `scaled(n)` 과 기기 단위 토큰 `{size.unit}` (desktop 1px · 터치 1.25px) 을 두고 ColorSwatch 상자 · ColorSwatchPicker swatch · ProgressBar · Meter 막대 두께 · 최대 폭 768 · Toast 최소 높이 56 · ColorArea 192 · StatusLight 점을 그 형으로 바꿨다 — Preview 터치 보기 · 터치 기기에서 swatch 32 → 40 · ColorArea 192 → 240 · 막대 6 → 7.5 · 점 10 → 12.5. Canvas 는 desktop 그대로, 빌더 chrome 은 단위 1px 고정이라 변화 없음.
  - 위치: `ruleLength.ts` (`scaled` · `scaledLengthRef`) · `device.ts` (`{size.unit}`) · `CSSGenerator.ts` (size 블록 높이 · 최소/최대 · 아이콘 · rule CSS 문자열의 길이 ref) · `ruleDefinition.ts` · `rulePartRules.ts` · `codeCatalogLibrary.ts` (토큰 출처 기억) · `deviceTypography.ts` (DOM inline 기기 식) · `StatusLight.tsx` · `builder-catalog-vars.css`.
  - 검증: G4 `d3S2Alignment` (S2 설치본 숫자 = `scaled` ref) · G3 리터럴 목록 정리 · G2 desktop · touch 263/263 · 원복 RED (DOM 길이 ref 변환 제거 → 터치 ProgressBar · Meter 6 FAIL) · live 5175 Compare Mode + 터치 보기.
- **같은 문제 (2차)**: Slider (손잡이 · 막대 · 행 여백 · 누르는 상자 · thick 막대 · precise 손잡이) · ProgressCircle 지름 · ColorThumb 손잡이 · Illustration 그림 · IllustratedMessage 최대 폭 · 격자 간격도 `scaled` 로 — 터치 보기에서 손잡이 20 → 25 · 지름 32 → 40 · ColorThumb 16 → 20 · IllustratedMessage 380 → 475 · 그림 96 → 120. Canvas 상수 (thick 16 · precise 6) 는 `catalogScaledPx`, DOM inline 은 `catalogDeviceScaledCss`, 조건 규칙 (orientation 의 최대 폭) 도 `layoutTokens` 로 길이 출처를 싣는다. DOM 이 SliderThumb visual 을 복사하며 토큰 출처를 잃던 것도 고쳤다. ProgressCircle 의 선 굵기는 터치에서 같이 × 1.25 (S2 는 3 고정 — svg 를 상자에 맞춰 늘린다).
  - 위치: `presence.ts` (`catalogScaledPx`) · `deviceTypography.ts` (`catalogDeviceScaledCss`) · `domBinding.runtime.ts` · `ProgressCircle.tsx` · `colorControlParts.ts` · `types.ts` · `validation.ts` · `resolver.ts` (조건 규칙 `layoutTokens`) · `ruleDefinition.ts` · `codeCatalogLibrary.ts` (glyph).
  - 검증: G4 (Slider · ProgressCircle · ColorThumb · Illustration · IllustratedMessage) · G2 desktop · touch · live 5175 터치 보기.
- **같은 문제 (3차)**: Tree 행 40 (수동 상자 — DOM 은 Tree 항목 inline 의 기기 식, 수동 `Tree.css` 는 desktop 40 그대로) 과 Table 칸 최소 높이 (S2 cell density 표 compact 32 · regular 40 · spacious 48 — 밀도 블록이 `minHeight` 를 받는다) 도 `scaled` — 터치 보기에서 Tree 행 · Table 칸 40 → 50. Table 머리글 (S2 32 고정) 은 desktop 값부터 달라 breakdown 후속으로 남겼다.
  - 검증: G4 (Table density · Tree) · 원복 RED (density 최소 높이를 숫자로 → 터치 Table 3 FAIL) · G2 desktop · touch · live 5175 터치 보기.
  - 위치: `manualBoxRules.ts` · `delegatedDom.runtime.ts` (Tree 행) · `deviceTypography.ts` (`catalogDeviceValueCss`) · `ruleDefinition.ts` (`applyManualBox` 토큰 · density `minHeight`) · `codeCatalogLibrary.ts` · `generate-css.ts` (density `min-height`) · `ruleLength.ts` (density 블록의 형) · `catalog-style.types.ts`.

## [ADR-295 후속 — 글자 단계 · StatusLight 간격 · 필드 버튼 테두리 · TagGroup 측정 사본을 S2 로] - 2026-10-31

### Fixed

- **Breadcrumbs · Table 칸 글자가 S2 보다 한 단계 컸던 것**: Breadcrumbs · Breadcrumb 은 S2 링크 `controlFont()` (S 12 · M 14 · L 16), Table 칸 · 머리글은 S2 cell `controlFont()` 14 · 줄 18 로 바꿨다. 행 높이 32 · 40 · 48 은 여백 7 · 11 · 15 로 그대로 지킨다. 머리글 이름 Text 가 자기 기본 글자 (16) 를 쓰던 것도 칸 글자를 물려받게 했다 (머리글 43 → 41, Canvas · Preview 같음).
- **StatusLight 점 ↔ 글자 간격**: S2 `text-to-visual` (6/14 em, 터치 8/17 em) — M desktop 6 · 터치 보기 8. 원본 template 이 `gap: 8` 을 직접 갖고 있어 rule 값을 덮던 것이 원인이었다 (지난번 「Preview 가 길이 형을 못 읽는다」 는 잘못된 판정).
- **Select · NumberField · ComboBox · DatePicker 의 필드 버튼 테두리**: S2 처럼 없음. Canvas 는 Button rule 의 1px 을 그리고 Preview 는 우연히 0 이었다 — 10-30 의 필드 버튼 모서리 수리가 노드를 새 객체로 감싸면서 prefix 증감 버튼용 identity 판정 (`stepper !== node`) 이 모든 필드 버튼의 inline 테두리를 0 으로 덮었다 (quiet Select 의 밑줄 폭까지). 이제 Button rule 의 field-button 블록 `border-width: 0` 하나를 생성 CSS 와 Canvas 조건 규칙이 같이 읽는다. Pagination 버튼도 같은 블록이라 테두리가 없다.
- **Tab · Tabs 글자가 크기마다 한 단계씩 달랐던 것**: S2 Tabs 는 크기 축 없이 루트 `font: 'ui'` 하나라 S · M · L 모두 14. 빌더 chrome 의 Tabs 는 `builder-catalog-pins.css` 로 295 전 값 고정.
- **Select · ComboBox 팝오버 안 섹션 머리글**: S2 `listboxHeader` — 최소 높이 = picker 크기의 control 높이, 위아래 가운데 여백, 좌우 높이 × 3/8, 글자 ui bold 14, 배경 · 선 없음 (사용자 결정 「팝오버 안만 S2」). 독립 ListBox · GridList 머리글과 빌더 picker 는 그대로.
- **TagGroup maxRows 측정 사본**: 사본의 Tag 가 28 (실제 32) · 간격 4 (실제 8) 로 재어 행당 개수를 많이 셌다 — 사본 Tag 에 S2 control 높이 최소값, 간격은 TagList record 값.
  - 위치: `componentRulesTable.ts` (Breadcrumb · Breadcrumbs · Column · Cell · StatusLight · field-button 블록) · `manualBoxRules.ts` (Column) · `reusableOriginLibrary.ts` (StatusLight template) · `codeCatalogLibrary.ts` · `domBinding.runtime.ts` · `StatusLight.tsx` · `TagGroup.components.tsx` · `delegatedDom.components.tsx`.
  - 검증: G4 `d3S2Alignment` (S2 설치본 대조 4 묶음) · `s2ButtonPill` (Canvas 테두리 0 · Select inline 없음) · `previewCanvasBox` (측정 사본) · 원복 RED (library 변환 · DOM identity · rule 선언 · 사본) · G2 desktop · touch 263/263 · live 5175 Compare Mode + 터치 보기.

## [편집 표시와 Grid 조작의 가시성 일치 — 공통 레이아웃 참여 판정] - 2026-10-31

### Fixed

- **숨긴 요소로 생기는 간격 표시·Grid 선과 잘못된 트랙 내용 삭제**: 레이아웃 입력, 흐름 배치, 간격 핸들, Grid 셀·트랙·교환, 삭제·Hug 계산이 공통 참여 판정을 사용한다. 자신이나 조상이 숨겨진 Grid·간격 표시는 생성하지 않는다. 숨긴 자식의 명시적 Grid line은 트랙 구조 변경에 맞춰 계속 갱신한다.
  - **Why:** 숨긴 자식의 0 크기 상자를 실제 배치 항목에 포함해 가짜 간격을 만들고, A/B/C 중 B를 숨긴 2열 Grid에서 2열 내용 삭제가 C 대신 B를 지웠다. 상위가 숨겨진 Grid도 고정 행 크기로 표시선을 계속 생성했다.
  - 위치: `packages/shared/src/catalog/runtime/layoutParticipation.ts`, Builder `canvasSpacing.ts` · `canvasGesture.ts` · `CatalogGridTrackLayer.tsx` · `catalogStylesHost.ts`.
  - 검증: 실제 레이아웃 엔진의 간격·자신/조상 숨김·트랙 삭제·Hug·숨긴 Grid line 갱신 및 Undo/Redo 회귀 검사.

## [선택 요소 눈금자 범위 표시] - 2026-10-31

### Added

- 눈금자를 켜고 요소를 선택하면 상단에는 좌우 경계 좌표, 왼쪽에는 상하 경계 좌표를 표시한다. 두 좌표 사이에는 선택된 page 헤더와 같은 반투명 배경을 적용하고, 시작·끝에는 더 진한 1px 경계선을 눈금자 내부에 표시한다. 다중 선택·이동·크기 변경·팬·줌을 따라 갱신하며, 캔버스 안내선은 추가하지 않는다.
- 선택한 page의 좌상단을 눈금자 `(0, 0)`으로 사용한다. 페이지를 전환하면 눈금과 선택 요소의 경계 수치가 같은 페이지 기준으로 함께 전환된다.
- 선택이 없는 초기 상태와 선택 해제 후에는 Canvas 전체 폭·높이의 중앙을 `(0, 0)`으로 표시한다. 왼쪽·위쪽은 음수, 오른쪽·아래쪽은 양수이며 Canvas 크기가 바뀌면 중앙 위치도 갱신된다.

## [ADR-295 Implemented — 사용자 컴포넌트 치수를 S2 값으로] - 2026-10-31

### Changed

- **ADR-295 완료**: 사용자 컴포넌트의 radius · 글자 단계 · 행간 · control 높이 · 아이콘 · 여백 · 간격 · 막대 두께가 설치된 Spectrum 2 (S2) 값을 따른다 (토큰 이름 · 패널 라벨 XS ~ XL 은 그대로). 터치 기기 (pointer: coarse) 에서는 S2 처럼 1.25 배 · 글자 기준 17 로 Preview · Publish 가 커지고, Builder 의 「터치 크기로 미리보기」 로 미리 본다. Canvas 는 desktop 값, 빌더 패널 위젯은 이전 크기 그대로다.
  - 검증: Canvas = Preview desktop (TextField 32 · Button padding 16 · 글자 14) · 터치 40 · 20 · 17 · Publish 터치 기기 40 · Radius preset M = 활성 테마 값 (8 → radius xl 테마 16) · 빌더 패널 before/after 차이 0 · 번들 Builder +6,165 · Preview +3,489 B gz (허용치 재승인).
  - 문서: `docs/adr/completed/295-d3-token-values-s2-style-macro-scale.md`

## [ADR-295 Phase 4 — 빌더 패널 입력 높이 · Publish 입력 행간 · Preview 탭의 빌더 값 누수 수정] - 2026-10-31

### Fixed

- **Design 패널의 입력 칸 · 토글이 커지던 문제**: Phase 3a 에서 사용자 컴포넌트에 들어간 S2 최소 높이가 빌더 위젯 (Design 패널 Input · NumberField · ToggleButton) 에도 닿아 State 절 행이 28 → 38 로 커졌다. 빌더에서는 그 최소 높이를 초기값으로 고정한다 — 빌더 패널 스크린샷 before/after 차이 0 (desktop · 터치 기기).
- **Publish 의 입력 칸 높이**: Publish reset 이 입력 칸에 글꼴 전체를 상속시켜 행간이 1.5 로 바뀌어 TextField 가 Preview 보다 3px (터치 3.5px) 컸다. Preview 와 같이 글꼴 이름 · 기능만 상속한다 — Publish Input desktop 32 · 터치 40.
- **헤더 Preview 탭에 빌더 전용 값이 섞이던 문제**: 같은 탭의 `/publish` 경로가 빌더 위젯용 고정값까지 실어, 터치 기기에서 Input 좌우 여백이 S2 값 (15) 대신 12 였다. 빌더 고정값은 `.publish-app` 이 있으면 적용하지 않는다.
  - 위치: `packages/shared/src/components/styles/builder-catalog-pins.css` · `builder-catalog-vars.css` · `apps/publish/src/styles/index.css`

## [Side 라벨 가로 스크롤바 수정 — Canvas overflow tolerance] - 2026-10-31

### Fixed

- **Label Position을 Side로 전환할 때 불필요한 가로 스크롤바가 생기는 문제 수정**:
  - **Why**: 소수점 grid 좌표의 끝점 오차를 실제 overflow로 처리해 0.00002px 차이에도 스크롤바가 생성됐다.
  - 공통 스크롤 범위에 기존 overflow 표시의 0.5px 허용 오차를 적용해 스크롤바와 휠 이동을 함께 정규화한다. 허용 오차를 넘는 실제 overflow는 유지한다.
  - 위치: `apps/builder/src/builder/catalogRuntime/canvasOverflow.ts`

## [Compare Mode 겹침 비교 — CSS / Canvas wipe] - 2026-10-31

### Changed

- **CSS와 Canvas를 같은 위치에 겹쳐 드래그로 비교**: 경계선을 움직여도 페이지 크기·위치·줌은 그대로 유지하고 각 렌더러가 보이는 영역만 바꾼다. 양 끝에서는 한쪽 화면 전체를 볼 수 있으며, 방향키·Home/End 조작과 경계 위치 저장을 지원한다.
- **CSS 영역에서도 같은 휠 이동·줌 지원**: 페이지 내부와 바깥 여백에서 휠로 이동하고, Shift+휠로 가로 이동하며, Cmd/Ctrl+휠로 포인터 위치를 기준으로 확대·축소한다. iframe 입력은 검증된 메시지 경로를 통해 기존 Canvas 카메라 처리에 연결한다.
  - 위치: `apps/builder/src/builder/workspace/Workspace.css`, `canvas/catalog/CatalogPreviewFrame.tsx`, `hooks/useWorkspaceCompareSplit.ts`

## [ADR-295 Phase 3c-3c ③ — MenuItem = S2 menuitem, 「S2 대조 대기」 0] - 2026-10-31

### Changed

- **Menu 크기가 항목까지** 간다 (전: 항목은 늘 M). 항목은 S2 control 형 — 최소 높이 24 · 32 · 40 · 48, 여백 높이 × 3/8, 아이콘 간격 text-to-visual. **항목 글자** = control 글자 (12 · 14 · 16 · 18, medium — 전 16 고정), **설명 글자**는 한 단 아래. 「S2 대조 대기」 3 → 0 (45 자리 모두 S2 로).
  - 위치: `componentRulesTable.ts` (MenuItem), `sizePropagation.ts`, `itemLinks.ts`, `domBinding.runtime.ts`, breakdown §6.11

## [ADR-295 Phase 3c-3c ②c — Slider track 행 · 막대 = S2] - 2026-10-31

### Changed

- **Slider 막대 4px (모든 크기)** 가 **S2 track 행 24 · 32 · 40 · 48** 가운데에 놓인다 (전 막대 = 행 4 · 8 · 12 · 16). Preview 에서는 행 어디를 눌러도 손잡이가 움직인다. thick 막대 (16) 도 같은 행. ColorSlider 는 그대로. 「S2 대조 대기」 5 → 3.
  - 위치: `componentRulesTable.ts` (Slider · SliderTrack), `runtime/presence.ts` · `compositionRoot.ts` · `domBinding.runtime.ts` (thick), `builder-catalog-pins.css`, breakdown §6.11

## [ADR-295 Phase 3c-3c ②c — Tab 높이 · 탭 사이 간격 = S2 density] - 2026-10-31

### Changed

- **Tab 높이 = Tabs density** (compact 32 · regular 48 — 전 크기별 21 · 29 · 41), **Tab 좌우 여백 0**, **TabList 탭 사이 간격** compact 24 · regular 32 (전 0 · 8). Tabs 의 density 가 각 Tab 까지 전해진다 (Canvas · Preview 같은 값). 「S2 대조 대기」 6 → 5.
  - 위치: `componentRulesTable.ts` (Tab · TabList), `sizePropagation.ts`, `rulePartRules.ts`, `outputs/toRacProps.ts`, `Tab.binding.ts`, breakdown §6.11

## [ADR-295 Phase 3c-3c ②b-2 — ColorArea · StatusLight · Tag 간격 = S2] - 2026-10-31

### Changed

- **ColorArea 192 × 192 정사각** (전 폭 100% × 높이 180), **StatusLight 높이** 16 · 18 · 20 · 22 (글자 한 줄 — 전 20 ~ 32), **Tag 사이 간격 8** (전 4 · 4 · 6). 「S2 대조 대기」 11 → 6.
  - 위치: `componentRulesTable.ts`, `components/styles/TagGroup.css`, breakdown §6.11

## [ADR-295 Phase 3c-3c ②b-1 — Tooltip · Menu 묶음 제목 · Breadcrumbs 높이 = S2] - 2026-10-31

### Changed

- **Tooltip**: 최소 높이 24 · 좌우 9 · 위아래 4 · 글자 12 (모든 크기 — S2 Tooltip 에 크기 축이 없다). 터치 보기에서 30 · 11.25 · 6.
- **Menu 묶음 제목 (Header)**: control 높이에 글자를 가운데 (위아래 3 · 7 · 11) · 글자 14 bold.
- **Breadcrumbs**: 높이 24 · 32 · 40 (S2 control 높이, 전 16 · 24 · 24). 「S2 대조 대기」 16 → 11.
  - 위치: `componentRulesTable.ts`, breakdown §6.11

## [ADR-295 Phase 3c-3c ②a — TreeView 행 · Toast · DropZone · Calendar 간격 = S2] - 2026-10-31

### Changed

- **TreeView 행 높이 40** (전 32 — Canvas · Preview 같이), **Toast 최소 높이 56** (전 크기별 고정 40 · 48 · 56), **DropZone 은 내용 높이** (전 고정 80 · 120 · 160), **Calendar 여러 달 사이 간격 24** (전 6). S2 에 크기 축이 없는 값이라 모든 크기에 같다.
- 읽히지 않던 높이 숫자 (Icon · SelectValue · Table · Tree · CalendarHeader 등) 를 S2 값으로 정리. 빌더 위젯의 DropZone 은 295 전 높이 유지. 「S2 대조 대기」 32 → 16.
  - 위치: `componentRulesTable.ts`, `catalog/document/manualBoxRules.ts`, `components/styles/Tree.css`, breakdown §6.11

## [ADR-295 Phase 3c-3c ① — 막대 · 원 · swatch · Slider 손잡이 = S2] - 2026-10-31

### Changed

- **Meter · ProgressBar 막대 두께를 S2 로**: S 4 · M 6 · L 8 · XL 10 (전에는 4 · 8 · 12 · 16).
- **ProgressCircle S 지름 16** (전 24 — Canvas 와 Preview DOM 같이), **ColorSwatch** S 24 · M 32 · L 40 (전 20 · 28 · 36), **Slider 손잡이** 18 · 20 · 22 · 24 (전 14 · 18 · 22 · 26), Slider 값 글자 줄 16 · 18 · 20 · 22.
- **TimeField · ColorField 루트 글자를 S2 field 글자로** (한 단 위였다 — M 16 → 14).
- 빌더 패널 위젯은 같은 시트를 읽어 295 전 값을 고정 시트로 유지한다. 「S2 대조 대기」 45 → 32.
  - 위치: `packages/shared/src/catalog/generated/componentRulesTable.ts`, `components/ProgressCircle.tsx`, `components/styles/builder-catalog-pins.css`, breakdown §6.11

## [Side 라벨의 불필요한 grid 안내선 제거] - 2026-10-31

### Fixed

- CheckboxGroup·RadioGroup·SearchField를 `Label Position: Side`로 선택할 때, 숨겨진 빈 도움말·오류 항목이 grid 행으로 계산되어 선택 영역 아래에 선이 생기던 문제를 수정했다. grid 안내선과 셀 교환 계산은 숨겨진 항목을 제외하며, 내용이 있는 도움말 행은 유지한다.

## [안내선 표시·이동·삭제 개선] - 2026-10-31

### Fixed

- 눈금자에서 새 안내선을 생성하는 드래그 중에도 수치를 표시한다. 페이지 밖에서는 활성 페이지 기준 미리보기 좌표를, 페이지 안에서는 드롭 대상 페이지의 좌표를 표시한다.
- 활성 페이지 안내선의 페이지 밖 연장이 선택 해제 후 사라지던 문제를 수정했다. 페이지 안은 실선, 페이지 밖 캔버스는 점선으로 유지한다.
- 눈금자 배경에 가리던 안내선을 상단 `top: 0`, 왼쪽 `left: 0`까지 이어 표시한다. 눈금자 위 선도 팬·줌·드래그·페이지 전환을 따른다.
- 페이지 밖 점선에도 마우스 판정을 적용해 이동 커서, 재드래그와 개별 우클릭 삭제가 동작한다.
- 눈금자를 가리던 투명한 헤더·레일 여백이 입력을 통과하도록 수정해 상단·왼쪽 눈금자 전체에서 드래그를 시작할 수 있다.

### Added

- 안내선에 hover한 시점부터 페이지 기준 위치값을 해당 눈금자에 같은 붉은 톤으로 표시한다. 드래그·hover·선택 순으로 한 안내선의 수치만 표시한다. 기존 눈금 숫자와 동일한 글꼴·행 높이·3px 여백으로 배치하며 팬·줌·재드래그와 Undo를 따라 갱신한다.
- 안내선 수치 배경은 눈금자 두께 전체를 채우는 투명→흰색→투명 그라데이션으로 표시한다. 숫자를 중심으로 상단은 가로 100px, 왼쪽은 세로 100px 범위에 적용하며, 중앙 50px는 흰색으로 유지하고 양끝 25px씩만 투명하게 전환한다.
- 상단 눈금자 우클릭에 모든 세로 안내선 제거, 왼쪽 눈금자 우클릭에 모든 가로 안내선 제거를 추가했다. 메뉴를 연 활성 페이지·breakpoint에만 적용하며 한 번의 Undo로 복원한다.

## [ADR-295 Phase 3c-3b ③ — field 라벨 간격 = S2, 남은 치수 리터럴 분류] - 2026-10-31

### Changed

- **field 의 라벨 ↔ 입력 간격이 S2 식 (높이 − 행간) / 2 를 따른다** (TextField · TextArea · NumberField · SearchField · Select · ComboBox · DateField · TimeField · DatePicker · DateRangePicker · ColorField — Canvas · Preview · Publish, 빌더 위젯은 그대로). XS 3 · S 4 · M 7 · L 10 · XL 13 (이전 2 · 4 · 6 · 8 · 10, DatePicker 계열 2 · 4 · 4 · 4 · 8). 터치 보기에서 M 9.

### Internal

- rule 치수 리터럴 게이트가 상한 대신 분류를 요구한다 — 값의 형 · 내용 높이 · S2 spacing 단 · control centerPadding 은 자동, 나머지는 「의도적」 13 자리와 「S2 값 대조 대기」 45 자리 (S2 쪽 값과 출처 포함, 줄기만 한다). 읽는 곳 없던 field 루트 · Tabs · AvatarGroup · Pagination 의 높이 리터럴은 0 (내용 높이) 으로 정리.

## [ADR-295 Phase 3c-3b ② — field 버튼 · SearchField 자리 = S2] - 2026-10-31

### Changed

- **ComboBox · DatePicker · DateRangePicker 의 버튼 자리와 SearchField 의 글리프 · 글자 자리가 S2 식을 따른다** (Canvas · Preview · Publish — 빌더 위젯은 그대로).
  - ComboBox 버튼 끝 여백 = 높이 × 3/16 − 2 (M 4 · 터치 5.5), DatePicker 2 · 4 · 6 · 6, DateRangePicker 그룹 시작 = 높이 × 3/8 · 끝 4. 글자와 버튼 사이는 S2 `text-to-control` (M 10, 이전 8).
  - SearchField 글리프는 높이 / 2 안쪽 (M 16, 이전 8), 크기는 글자의 행간 (M 18, 이전 16), 글자 시작 = 높이 / 2 + 행간 + 6/14 em (M 40, 이전 32). 터치 보기에서도 S2 터치 값.
  - **Why:** 이 값들은 상수 (4 · 8 · 12 · 16 · 24 등) 라 S2 와 다르고 터치 크기를 따르지 않았다. 여러 기준을 더한 길이 (`{length.<항>+<항>}`) 와 Preview inline margin 의 기기 식을 새로 넣어 맞췄다.
  - 위치: `packages/rendering/src/renderers/utils/ruleLength.ts`, `packages/shared/src/catalog/generated/componentRulesTable.ts`, `packages/shared/src/catalog/document/rulePartRules.ts` (`layoutRefs`), `packages/shared/src/catalog/resolution/resolver.ts`, `packages/shared/src/catalog/runtime/deviceTypography.ts` (`catalogDeviceLayoutCss`), 빌더 고정 `packages/shared/src/components/styles/builder-catalog-pins.css`.

## [ADR-295 Phase 3c-3b — Badge · Select 트리거 = S2] - 2026-10-31

### Changed

- **Badge 가 S2 Badge 모양이 된다** (Canvas · Preview · Publish): 최소 높이 = control 높이 (S ~ XL 24 · 32 · 40 · 48, 터치 × 1.25), 좌우 여백 = 높이 × 3/8 (9 · 12 · 15 · 18), 모서리 = control 모서리 7 · 8 · 9 · 10 (pill 이 아님), 아이콘-글자 간격 6/14 em (터치 8/17 em). 짧은 글자의 Badge 는 S 22 → 24 처럼 높이가 control 높이로 커진다.
  - **Why:** S2 Badge 는 `control({shape: 'default', wrap, icon})` — 기본 모양의 control 이다. rule 은 pill 모서리와 고정 여백 (4 · 8 · 12 · 16 · 24) 이었다.
- **Select 트리거의 시작 여백이 터치 보기에서도 S2 값이다** (높이 × 3/8 — 터치 M 15). 전에는 desktop 값 (12) 에 고정이었다.
  - 위치: `packages/shared/src/catalog/generated/componentRulesTable.ts` (Badge · Select), `packages/shared/src/catalog/document/rulePartRules.ts` (`calc(<size 변수> * a / b)` 를 Canvas 가 읽는다), 게이트 `apps/builder/src/builder/catalogRuntime/__tests__/d3S2Alignment.static.test.ts`.

## [ADR-295 Phase 3d — spacing 한 표] - 2026-10-31

### Fixed

- **Library 의 Spacing 카드가 패널 spacing preset 과 같은 값을 보인다** — ◆ md 16 → 12, lg 16 · xl 24 · 2xl 32 · 3xl 40 · 4xl 48 (preset M 을 고르면 12 가 들어가는데 카드는 16 이었다).
  - **Why:** spacing 표가 둘 (rendering `{spacing.*}` md 16 · DOM `--spacing-*` md 12) 이었다. 한 표로 묶고 (값은 S2 spacing 단), Canvas 가 delegation 길이를 풀던 손 사본도 그 표에서 파생한다.
  - 위치: `packages/rendering/src/primitives/spacing.ts`, `packages/shared/src/catalog/document/rulePartRules.ts`, 게이트 `apps/builder/src/builder/catalogRuntime/__tests__/d3S2Alignment.static.test.ts` 「spacing 한 표」.

## [ADR-295 Phase 3c-3a — 여백 · 간격 = S2 의 값의 형] - 2026-10-31

### Changed

- **사용자 컴포넌트의 좌우 여백 · 간격이 S2 식을 따른다** (Canvas · Preview · Publish — 빌더 패널 위젯은 그대로).
  - Button 좌우 여백 = 높이 / 2 (S ~ XL 12 · 16 · 20 · 24), ToggleButton · Tag · field 입력 상자 (TextField · ComboBox · NumberField · DateField …) = 높이 × 3/8 (9 · 12 · 15 · 18). Select 트리거의 시작 여백도 높이 × 3/8.
  - 아이콘 ↔ 글자 간격 = 글자 × 6/14 (M 6, 터치 8/17 — M 8), Checkbox · Radio · Switch 라벨 간격 = 글자 × 10/14 (M 10).
  - Checkbox · Radio · DateField 의 글자가 S2 처럼 한 단 아래 (S ~ XL 12 · 14 · 16 · 18).
  - 「터치 크기로 미리보기」 와 터치 기기에서 이 값들이 함께 커진다 (Button M 여백 20 · 간격 8, field 버튼 정사각형 · 위치 포함).
  - **Why:** S2 는 여백을 높이 · 글자의 비율로 정한다 — 고정 px 는 터치에서 따라 커지지 않았고 값도 S2 와 달랐다 (사용자 결정 1 「전부 S2 식으로」).
  - 위치: `packages/rendering/src/renderers/utils/ruleLength.ts` (형 · 길이 ref), `packages/shared/src/catalog/generated/componentRulesTable.ts`, `packages/shared/src/catalog/runtime/deviceTypography.ts` (DOM inline), `packages/shared/src/components/styles/builder-catalog-vars.css` · `builder-catalog-pins.css` (빌더 고정값)

## [눈금자 원점 정렬 — 고정 위치 반복 갱신 제거] - 2026-10-31

### Fixed

- **Show rulers의 시작 위치를 캔버스 (0, 0)으로 정렬**하고 눈금·라벨 계산도 같은 원점을 사용한다.
  - **Why:** 헤더·레일의 끝 좌표를 inset으로 사용해 44px 밀렸고, 카메라 갱신마다 고정 inset과 크기를 다시 대입했다.
  - 위치는 CSS로 고정하고 눈금자 크기는 표시 시 한 번만 설정한다.
  - 위치: `apps/builder/src/builder/workspace/components/RulerOverlay.tsx`, `apps/builder/src/builder/workspace/Workspace.css`

## [ADR-295 Phase 3c-2b · 3d 정리 — toggle 표시 상자 = S2] - 2026-10-30

### Changed

- **Checkbox · Radio · Switch 의 표시 상자가 S2 크기가 된다** — S ~ XL 16 · 20 · 24 · 30 → 14 · 16 · 18 · 20 (터치 기기 · 「터치 크기로 미리보기」 에서 × 1.25). Checkbox 모서리는 S2 처럼 4 · 4 · 5 · 5.
  - Radio 를 고르면 가운데 흰 점이 크기와 상관없이 4 (S2).
  - Switch track 폭은 글자 크기 × 26 / 14 (M 36 → 26), thumb 은 켜면 2 커지고 끝에서 3 떨어진다 (S2).
  - 상자가 글자 줄보다 작아져 행 높이는 글자 줄이 정하고, 상자는 줄 가운데에 선다.
- Meter 도 ProgressBar 처럼 최소 · 최대 폭 48 · 768 을 갖는다 (S2 `bar()`).
- 빌더 패널의 Checkbox · Switch 는 그대로다 (295 전 값).

### Removed

- 화면에 쓰이지 않던 목록 항목 간격 사본 (`collectionItemMetrics` 의 테스트 전용 resolver) 과 옛 Canvas PNG 비교 테스트 (`paletteBaseCanvas`) 를 지웠다 (사용자 승인).

## [ADR-295 Phase 3c-2a — field 버튼 · 메뉴 항목 · 최소 폭 = S2] - 2026-10-30

### Changed

- **ComboBox · DatePicker · DateRangePicker 안 버튼이 S2 크기가 된다** — XS ~ XL 16 · 18 · 22 · 34 · 46 → 14 · 16 · 20 · 24 · 32. 입력칸 끝 공간도 그만큼 줄어든다.
- **목록 항목 (ListBox · Select · ComboBox 의 항목) 이 S2 메뉴 항목 모양** — 테두리 없이 위아래 7, 최소 높이는 control 높이 (터치 기기 · 「터치 크기로 미리보기」 에서 40 · 위아래 9). 설명이 있는 항목은 44 → 50.
- TextField · SearchField 의 최소 폭을 없앴다 (S2 에 없음 — 종전 높이의 1.5 · 3 배). ProgressBar 최소 폭 48 은 터치에서 60.
- 빌더 패널의 TextField · SearchField · ComboBox · DatePicker 는 그대로다 (295 전 값 고정).

## [ADR-295 Phase 3c-1 — 컨트롤 아이콘 = 글자의 행간 · 글자 크기 (S2 1lh · 1em)] - 2026-10-30

### Fixed

- **터치 기기 · 「터치 크기로 미리보기」 에서 컨트롤 안 아이콘이 S2 크기가 된다** — Button · ToggleButton · FileTrigger · SearchField 의 아이콘은 그 크기 글자의 행간 (S2 `1lh`) 이라 터치에서 18 · 22 · 24 · 26 (종전 × 1.25 의 20 · 22.5 · 25 · 27.5). desktop 값은 그대로.

### Changed

- DatePicker · DateRangePicker 달력 아이콘 = 그 크기의 글자 크기 (S2 `1em`) — desktop S ~ XL 16 · 18 · 20 · 22 → 12 · 14 · 16 · 18. 빌더 화면은 그대로다 (295 전 값 고정).

## [ADR-295 Phase 3b — S2 아이콘 단 14 · 16 · 18 · 20 · 22 · 리터럴 ratchet] - 2026-10-30

### Changed

- **컨트롤 안 아이콘과 Icon 컴포넌트가 S2 아이콘 크기를 따른다** (`{size.icon.<S>}` — 터치 기기 · 「터치 크기로 미리보기」 에서 × 1.25)
  - Button · ToggleButton 아이콘 L · XL 24 · 28 → 20 · 22. Select · ComboBox 트리거 L · XL 44 · 54 → S2 높이 40 · 48.
  - Icon 컴포넌트 XS ~ XL 16 · 18 · 24 · 36 · 48 → 14 · 16 · 18 · 20 · 22 (S2 `iconStyle`).
  - chevron · 지우기 같은 자리는 lucide 글리프라 S2 전용 글리프 상자 크기를 옮기지 않고 지금 값을 둔다.
- TagGroup 의 빈 목록 틀 높이 22 · 30 · 42 → Tag 높이 24 · 32 · 40. 빌더 화면은 그대로다 (295 전 값 고정).

### Tests

- rule 치수 리터럴 ratchet (`componentRulesTable.static.test.ts`) — 글자 · 모서리 · 행간 · 최소 높이 · 아이콘의 px 숫자는 사유 표에 있어야 한다.
- S2 대조 (`d3S2Alignment.static.test.ts`) — 토큰 표 · 상수 · 컴포넌트 값을 S2 1.8.1 설치본 추출값과 비교한다.

## [Canvas 부분 갱신 경계 잔상 — device pixel clip] - 2026-10-30

### Fixed

- **속성 편집 후 어두운 배경에 남는 부분 갱신 테두리**
  - 갱신 영역을 device pixel 정수 경계로 바깥 정렬하고 콘텐츠·standby 복사에 AA 없는 clip을 적용한다. contributor 조회도 넓어진 영역을 포함한다.
  - **Why:** 소수점 AA clip에서 clear·재합성을 반복하면 경계의 불투명도가 낮아져 선택 해제 후에도 캐시에서 선이 표시됐다.
  - 위치: `apps/builder/src/builder/workspace/canvas/skia/SkiaRenderer.ts`

### Tests

- 실제 CanvasKit surface에서 DPR 1/2 · zoom 1/1.7 · light/dark · 불투명/반투명 배경의 반복 편집·축소·삭제 결과를 전체 렌더와 픽셀 단위로 비교한다.

## [ADR-295 Phase 3a — S2 행간 식 · 컨트롤 높이 20 · 24 · 32 · 40 · 48] - 2026-10-30

### Changed

- **글자 줄 높이가 S2 식으로** (ADR-295 Phase 3a · 사용자 결정 2): 14px 글자의 줄 20 → 18, 16px 24 → 20, 18px 28 → 22. 사용자 컴포넌트 (Canvas · Preview · Publish) 에만 — 빌더 화면은 그대로.
- **컨트롤 높이가 S2 값으로** (ADR-295 Phase 3a): 입력칸 · 날짜 입력 · Button · ToggleButton · Tag · NumberField 증감 버튼 · 날짜 범위 상자가 XS 20 · S 24 · M 32 · L 40 · XL 48 (종전 20 · 22 · 30 · 42 · 54). 터치 기기 (와 Preview 「터치 크기로 미리보기」) 에서는 S2 처럼 1.25 배 (M 40) 이고, 글자는 높이 가운데에 선다. Canvas 는 늘 데스크톱 값.
  - **Why**: 높이가 「줄 20 + padding 8 + 테두리 2」 의 우연한 합으로 정해져 있어, 줄만 S2 로 바꾸면 증감 버튼 (30 리터럴) 과 입력칸 (28) 이 어긋났다. 높이를 토큰 하나로 묶고 padding 을 그 높이에서 계산한다.
  - 위치: `packages/rendering/src/renderers/utils/controlPadding.ts` · `primitives/device.ts` · `packages/shared/src/catalog/generated/componentRulesTable.ts`
- **Table 행 높이는 S2 그대로 32 · 40 · 48** (compact · regular · spacious): 줄이 20 이 되어 세로 여백 6 · 10 · 14.
- **옛 생성 CSS 파일 2 삭제** (사용자 승인): 생성기가 더 만들지 않는 `generated/Image.css` · `generated/Label.css`.

### Fixed

- **터치 기기에서 DOM 이 일부 크기를 데스크톱 값으로 고정하던 것**: 문서 해석이 숫자로 굳힌 높이 · padding · 증감 버튼 크기 · TextArea 행 높이 · Disclosure 제목 글자 · TagGroup 라벨 줄이 inline px 로 나가 터치 벌이 닿지 않았다 → 토큰에서 온 값은 기기 변수로 (Phase 2 의 「토큰 출처를 기억」 을 높이 · padding 으로 확장).
- **Calendar 월 · 연도 선택 trigger 시작 여백이 Canvas 에서만 12 가 될 뻔한 것**: 「Button 세로 padding × 2」 로 계산하던 값을 사용자 값 8 상수로.

### Tests

- 생성기가 rule 의 숫자 padding 과 S2 식의 desktop 값을 대조 (갈리면 생성 실패) · `builderCatalogVars` 게이트 (c) 가 calc · 행간 비율을 계산값으로 비교 · G2 두 arm 263/263 (터치 알려진 차이 14 → 2). 상세 `docs/adr/design/295-d3-token-values-s2-alignment-breakdown.md` §6.3.

## [ADR-295 Phase 2 — 터치 기기 크기 두 벌 · Preview 「터치 크기로 미리보기」] - 2026-10-30

### Added

- **Preview 「터치 크기로 미리보기」 토글** (ADR-295 Phase 2 · 사용자 결정 4): Compare Mode 헤더의 손 아이콘. 켜면 Preview 가 S2 터치 벌 (scale 1.25 · 글자 기준 17 — Text 14 → 17 · 12 → 15) 로 그린다. 화면 폭 (breakpoint) 과 무관하고, Canvas 는 늘 데스크톱 크기 (사용자 결정 7).
  - 위치: `apps/builder/src/builder/workspace/canvas/stores/compareMode.ts` · `main/BuilderHeader.tsx` · `catalog/CatalogPreviewFrame.tsx` · `preview/catalog/catalogPreviewApp.ts`

### Changed

- **Publish 사이트가 터치 기기 (마우스 없음) 에서 S2 처럼 글자를 키운다** (ADR-295 Phase 2): 조건은 S2 와 같은 `not ((hover: hover) and (pointer: fine))`. 이번 Phase 는 글자 크기만 — 컨트롤 높이 · 행간의 터치 값은 Phase 3 에서 rule 높이와 함께. radius 는 S2 처럼 기기와 무관.
- **생성 CSS 의 사용자 컴포넌트 치수 변수 이름이 `--catalog-token-*` 로** (ADR-295 Decision 9): `var(--radius-md)` → `var(--catalog-token-radius-md)` · `var(--text-sm)` → `var(--catalog-token-text-sm)`. 빌더 화면은 고정값 시트 (`builder-catalog-vars.css`) 를 싣고 변화 없음, Preview · Publish 는 테마 변수 + 첫 프레임용 기본값 (`theme/generated/theme-seed.generated.css`).
- **문서 해석이 글자 크기의 토큰 출처를 기억한다**: Text · Label · Button 글자처럼 해석 단계에서 숫자가 되는 글자도 토큰에서 왔으면 DOM 이 그 토큰의 기기 변수를 쓴다 (rule 의 px 리터럴 · 사용자가 쓴 px 는 고정).
  - **Why**: DOM 이 해석된 숫자를 inline px 로 써서, 터치 벌에서 생성 CSS 요소만 커지고 Text 계열은 14 에 남았다 (G2 하니스 터치 arm 154 건).
  - 위치: `packages/shared/src/catalog/resolution/resolver.ts` (`catalogResolvedTokenRef`) · `catalog/runtime/deviceTypography.ts` · `document/rulePartRules.ts` · `document/manualBoxRules.ts`

### Fixed

- **StatusLight 글자 크기가 rule 토큰을 따르지 않던 것**: DOM 이 px 표 (12 · 14 · 16 · 18) 를 따로 들고 있었다 → rule `fontSize` 토큰 변수.
- **Switch · Checkbox · Radio 의 indicator 상자가 글자 토큰에 묶여 있던 것** (xs ~ xl): 터치에서 DOM 상자만 1.2배가 됐다 → px 고정 (Phase 1 의 2xl ~ 5xl 에 이어).

### Tests

- `builderCatalogVars.static.test.ts` (빌더 고정 시트 커버리지 · 미디어 쿼리 0 · 295 전 기준 JSON 과 계산값 동일 · chrome CSS 의 `--catalog-token-` 0) · ADR-293 게이트의 런타임 허용을 상태 변수 접두로 좁힘 · G2 하니스 (`adr295PaletteSymmetry.browser.test.ts`) 를 desktop · touch 두 arm 게이트로 — 알려진 차이 목록 (295 전부터 24 · 터치만 14, Phase 3 행간 식으로 닫음) 밖 0. 상세 `docs/adr/design/295-d3-token-values-s2-alignment-breakdown.md` §6.2.

## [ADR-295 Phase 1 — 사용자 컴포넌트 radius · 글자 크기를 S2 값으로] - 2026-10-30

### Changed

- 사용자 컴포넌트 (Canvas · Preview · Publish) 의 radius 토큰이 S2 값이 된다: md 6 → 8 · lg 8 → 10 · xl 12 → 16 · 2xl 16 → 24 (xs 2 · sm 4 그대로, 3xl · 4xl 삭제). `{radius.*}` 를 쓰는 ListBox · Menu · GridList · TagGroup · DropZone · Table · Tree 등의 모서리가 커진다. 빌더 chrome (패널 · 헤더) 은 그대로.
- 글자 크기 토큰이 S2 단계 (`round(14 × 1.125^단계)`) 가 된다: text-2xs 10 → 11 · text-2xl 24 → 22 · 3xl 30 → 25 · 4xl 36 → 28 · 5xl 48 → 36 (xs · sm · base · lg · xl 은 S2 와 같아 그대로). XS size 컴포넌트의 글자가 1px 커진다. 제목 묶음 토큰 `text-heading-xs` ~ `3xl` (18 · 20 · 22 · 28 · 36 · 43 · 55) 추가. 행간은 Phase 3 (높이 정렬) 까지 지금 값.
- Design 패널 Radius preset 이 사용자 컴포넌트의 값을 보여 주고 쓴다 (M · 8 · L · 10 · XL · 16 — 종전에는 빌더 화면 값 6 · 8 · 12 를 썼다).

### Fixed

- Preview · Publish 가 테마 글자 변수를 델타일 때만 받던 경로 — 이제 전 키 (정확한 분수 행간) 를 받아 Canvas 와 같은 값.

### Internal

- G1 하니스 `apps/builder/tests/adr248-g3/adr295PaletteSymmetry.browser.test.ts` (팔레트 247 조합 Canvas ↔ DOM 상자 + 스크린샷): 새 비대칭 0. 글자 토큰을 상자 크기로 쓰던 자리 (Calendar · Radio · Switch · Checkbox) 는 이전 px 로 고정. 상세 `docs/adr/design/295-d3-token-values-s2-alignment-breakdown.md` §6.1.

## [ADR-295 Phase 0 — D3 값 정렬: S2 설치본 추출기 · 대조표] - 2026-10-30

### Added

- ADR-295 Accepted · Phase 0 (G0). 사용자-가시 변경 없음 — 값은 Phase 1 부터 바뀐다.
  - S2 1.8.1 값 추출기 `apps/builder/scripts/adr295-s2-token-extract.mjs`: 설치본 style macro 를 실행해 spacing · radius · border · 글자 단계 · 행간 식 · scale · control 크기 · 모서리를 읽고, probe 페이지 (S2 컴포넌트 22 가족) 를 Playwright desktop · touch 에서 잰다. 글자 · 행간 식과 브라우저 computed 78/78 일치. 게이트용 oracle `catalogRuntime/__tests__/fixtures/adr295-s2-oracle.json`.
  - rule 값 재집계 `adr295-rule-literal-inventory.ts` · 빌더가 읽는 생성 시트 33 의 치수 기준 JSON (`adr295-builder-consumed-generated-baseline.json`, Decision 9 게이트 (c) 의 295 전 기준) · `app-pages` 규모 측정 `adr295-fixture-scale.mjs`.
  - radius 한 표 게이트 (`resolveThemeSnapshot.test.ts` 「ADR-295 R9」): 최종 snapshot radius = `RADIUS_BASE_PX` 파생 · seed 와 표가 같아야 한다.
  - 발견: S2 control 모서리 = size 단계 배율 (6 · 7 · 8 · 9 · 10) · field paddingX = 높이 × 3/8 · Button paddingX = 높이 / 2 · rule height 리터럴 389 중 201 은 파생 표지. 대조표: `docs/adr/design/295-d3-token-values-s2-alignment-breakdown.md` §6.0.

## [ADR-294 Implemented — 사용자 컴포넌트가 값을 내보내고 받는다: event · variable property] - 2026-10-30

### Added

- 컴포넌트 원본이 **event property** 로 값을 내보내고 (Interactions Do 「컴포넌트 이벤트 보내기」 — `emit`), 놓인 instance 가 When 「컴포넌트」 그룹의 그 이벤트로 받는다 (받은 값 = 「This event · value」). **variable property** 로 instance 가 값을 넘기면 (직접 입력 또는 page 변수) 원본 안의 글자 · 값 조건 · 데이터 보기 조건 · 규칙 값이 그 instance 의 값을 읽는다. 「버튼 → 팝오버 안 사용자 컴포넌트 (목록 + 검색) → 고른 값을 부모 page 로」 가 패널만으로 된다.
  - Properties: 원본 루트 「+ Event property」 · 「+ Variable property」, instance 의 「Receive in Interactions (N)」 · 「Value from」 · 「In this instance: …」. code view: `<UserPicker onPick={setPicked} team={roleFilter} />` 모양 (콜백 prop · 속성) 왕복.
  - 문서: contract 51 → 52 (옛 개발용 프로젝트는 열리지 않는다 — 변환 없음).
- 번들: Builder initial JS gz +4,387 B (ADR 상한 +2,048 → +4,608 사용자 정정) · Preview +127 B.
- 사용자 확인 2026-10-30 (5176 Preview — 팝오버 picker 선택 → `picked` · 닫힘). 본문 `docs/adr/completed/294-component-event-variable-properties.md`.

## [ADR-290 Implemented — Theme accent 를 목표 대비로: 배경 accent 와 바탕 위 accent 를 따로] - 2026-10-30

### Changed

- dark 모드에서 accent 배경 위 글자 · 아이콘 (Button accent · 선택된 Checkbox · Radio · Switch · ListBox 항목 · Table 행 · 강조 Tag · ToggleButton) 이 흰색이 된다 — 종전 어두운 글자 `#171717` 은 프리셋 10 종 전부 대비 3.29 ~ 3.93 으로 WCAG 4.5 미달이었다 (S2 와 같은 흰 글자). accent 배경 색 자체는 두 모드 모두 그대로.
- 바탕 위에 바로 놓이는 accent (Button outline 글자 · Link · Badge subtle · outline 글자 · 입력 focus · quiet 밑줄 · Card · ColorSwatch · Popover · TagGroup 선택 테두리 · ProgressBar · 강조 Slider 채움 · thumb · TagGroup 「Show all」 · Menu 선택 표시) 가 새 토큰 `accent-content` 를 쓴다 — Tone · 테마 바탕에 대해 글자 4.5 · 선 · 채움 3.0 이 나오도록 명도를 resolver 가 정한다. dark 는 밝아지고, light 는 green · turquoise · Badge subtle 위 글자처럼 미달이던 자리만 한두 단 어두워진다. Link · 입력 hover 는 `accent-content-hover` (바탕과 대비를 한 단 더).
- Theme 에 사용자 hex accent 를 넣으면 그 hex 의 명도에서 시작한다 — 대비를 통과하면 브랜드색 그대로 (종전에는 명도를 55% 로 접어 `#1E3A8A` 도 `#4a6dc1` 로 바뀌었다). 미달이면 가장 가까운 통과 명도로 움직이고, 어떤 명도로도 조건을 다 맞출 수 없으면 글자 대비를 우선하고 경고를 남긴다.
- 색 피커 Theme 팔레트의 accent 사다리에 실제 쓰이는 accent · accent-content 두 칸이 들어가고, Tone 을 바꾸면 다시 계산한다.

### Added

- 색 토큰 `accent-content` · `accent-content-hover` (`{color.accent-content}` → `var(--accent-content)`, forced-colors 에서는 `LinkText`). 규칙: 같은 상태에서 그 면 위에 on-accent 를 얹으면 `accent`, surface 위에 바로 놓이면 `accent-content` — `adr290AccentRoles.static.test.ts` 가 rule 의 accent 참조 48 곳과 바탕 집합을 지킨다.
- 명도 탐색 `accentContrast.ts` (WCAG 2 대비 · `solveLightness`, 새 의존성 0). G3 live: 프리셋 3 · hex 2 · Tone 4 × 모드 14 조합 × 10 값 Preview = resolver 값, Canvas 설치 맵 · Publish · forced-colors 1 회씩.
- 번들: Builder initial +1,253 B · Preview +64 B gz (ADR 게이트 +1 KB 미달 — 사용자 확인과 함께 수용). G5 사용자 확인 2026-10-30 → ADR-290 Implemented (`docs/adr/completed/290-*.md`).

## [ADR-293 Implemented — 테마 색 토큰을 resolver 한 곳에서: Preview · Publish 가 Canvas 와 같은 값] - 2026-10-30

### Changed

- Preview · Publish 의 테마 색 (`{color.X}` 가 읽는 변수 전부) 을 Canvas 와 같은 resolver 객체에서 싣는다 — `preview-system.css` 가 CSS 식으로 따로 계산하던 15 변수를 지웠다 (폴백 없음). 갈리던 값이 같아진다: Button primary hover · pressed (light `#141414` → `#0a0a0a`, dark → Tone 50 — 흰 글자 유지), popover · dropdown 바탕 `raised` (light white → gray-50 · dark neutral-900 → zinc-850), accent pressed (L 50 % → 검정 75 % 혼합), named hue hover · pressed (±1/255), Badge `gray` 는 Tone 과 무관 (Canvas 와 같음).
- negative hover · pressed 를 손값에서 negative 의 검정 85 · 75 % 혼합으로 — 테마에서 negative 색을 바꾸면 Preview 의 hover · pressed 도 따라간다 (종전 Preview 는 바꾼 값이 닿지 않았다).
- 테마 Token override 의 `on-negative` · `elevated` · `disabled` 가 각자 변수를 갖는다 (`--fg-on-negative` · `--bg-elevated` · `--bg-disabled`) — 종전 `on-negative` 를 바꾸면 `white` · 앱 배경 · raised 까지 같이 바뀌었다.
- Builder `/` 랜딩이 builder chrome 팔레트를 쓴다 (`data-context="builder"`) — dark 배경이 파란 accent 에서 builder accent (zinc-200) 로.

### Added

- 색 토큰 `neutral-fill-hover` · `neutral-fill-pressed` — 진한 바탕 `neutral` (Button primary) 의 hover · pressed (S2 한 단, Tone 950 / dark 50). `neutral-hover` · `-pressed` 는 밝은 바탕 `neutral-subtle` 의 것으로 남는다.

### Fixed

- Preview 의 생성 CSS 가 폴백 없이 읽던 hover · pressed 변수 6 (`--accent-hover` · `--neutral-hover` · `--neutral-pressed` · `--negative-hover` · `--purple-hover` · `--purple-pressed`) 이 선언돼 Button hover 가 `.button-base` 폴백 (글자색을 어둡게 한 값) 으로 떨어지지 않는다.
- named hue `-subtle` 테마 override (예 `color.purple-subtle`) 가 Preview Badge 에 닿는다 — 토큰 → CSS 변수 표가 rendering · shared 두 벌이라 이름이 어긋났다 (`--purple-subtle` vs `--hue-purple-subtle`). 표를 하나로 합쳤다.
- `color.neutral` override 뒤 파생이 `neutral-hover` (밝은 바탕 hover) 를 글자색에서 혼합하던 것을 `neutral-fill-*` 로 — 그대로 DOM 에 실렸다면 ToggleButton hover 가 거의 검정이 됐다.
  - 위치: `packages/rendering/src/renderers/utils/tokenResolver.ts` (`colorTokenCssValue`) · `primitives/colors.ts` · `packages/shared/src/catalog/{resolvers/colorTokenToCss,runtime/{resolveThemeSnapshot,themeVarsCss,domView.runtime,neutralToSkiaColors},generated/componentRulesTable}.ts` · `components/styles/theme/preview-system.css` · `apps/builder/src/{App.tsx,hero.css}`
  - 게이트: `generatedCssVarsDeclared.static.test.ts` · `themeCssVarsCoverSkia.static.test.ts` · `apps/builder/tests/parity/themeColorParity.browser.test.ts` (프리셋 10 × Tone 5 × 모드 2 + 델타 — DOM 계산값 = Skia hex). parity · chart · `switchDomPaint` 하니스는 Preview 와 같은 snapshot 설치 (`setupPreviewThemeVars.ts`).
  - 번들: Builder initial −276 B · Preview −467 B gz. G5 사용자 확인 2026-10-30 → ADR-293 Implemented (`docs/adr/completed/293-*.md`).

## [컴포넌트 안 데이터 목록이 instance 에서 행을 그린다] - 2026-10-30

### Fixed

- 데이터를 연결한 목록 (ListBox 등) 을 컴포넌트로 만들거나 컴포넌트 원본 안에 두면, page 의 instance 가 데이터 행 대신 원본의 샘플 항목 (Inbox · Starred · Archive) 을 그리던 결함 — Canvas · Preview 둘 다. 원인 둘: 행 목록을 instance 노드 자신의 연결에서만 읽어 원본 노드의 연결은 읽지 않았고, 원본 노드가 가진 항목 (slot 채움) 을 그리는 경로가 행 반복을 하지 않았다. 이제 원본 노드의 연결을 instance 자리에서 읽고 (보기 조건의 컴포넌트 변수 속성 — `!var` — 은 그 instance 의 값), 첫 항목을 행마다 반복하며 샘플 글자는 버린다. ADR-294 G5 live 중 발견 (ADR-294 이전 `ea13b37c1` 에서도 재현).
  - 위치: `packages/shared/src/catalog/resolution/resolver.ts` (`projectTemplate` — 원본 노드의 binding · 안쪽 owner 의 slot 채움 행 반복 · `sampleOwner`)
  - 게이트: `apps/builder/src/preview/catalog/__tests__/componentBoundRows.test.tsx` (루트 · 자식 · instance 별 보기 3 — 원복 RED 3/3)

## [보기 조건이 element 변수를 읽는다 · 컴포넌트 이벤트 값 고르기] - 2026-10-30

### Fixed

- 데이터 보기 조건 (`name contains {{ query }}` 등) 이 노드가 가진 변수 (element 변수) 를 읽지 못해, 그 변수로 거르는 검색이 동작하지 않던 결함 — 컴포넌트 원본 안 검색은 page 변수에 쓸 수 없어 이 길뿐이었다. **Why**: 보기의 변수 탐색이 page · project 변수만 담았다. 이제 보기 노드의 소유자 사슬의 element 변수를 그 owner 를 그리는 record 아래에서 읽는다 (규칙이 쓰는 자리와 같다 — instance 마다 따로). 연결 key 의 `{{ }}` 해석은 그대로 page · project 만 (ADR-288). ADR-294 G5 live 중 발견 (`ea13b37c1` 에서도 재현).
  - 위치: `packages/shared/src/catalog/runtime/{stateTemplate,compositionRoot}.ts`
  - 게이트: `componentBoundRows.test.tsx` (plain · component 2 — 원복 RED 2/2)
- Interactions 의 값 고르기가 컴포넌트 이벤트 (`When pick` 등) 의 받은 값을 후보로 내지 않던 누락 — 「This event · value」 가 나온다 (ADR-294).
  - 위치: `packages/shared/src/interactions/exposure.ts` (`eventArgsOf`)

## [ADR-294 Phase 4 — 컴포넌트 변수 속성의 값이 원본 안에서 읽힌다] - 2026-10-30

### Added

- 컴포넌트 원본 안에서 변수 속성 (입력 변수) 이 그 instance 가 넘긴 값으로 읽힌다 — 글자의 `{{ role }}`, 값 조건 · 변수 prop, 데이터 보기의 조건 (`!var`), 규칙의 값 (`!var` — 예: 「컴포넌트 이벤트 보내기」 의 보낼 값). 리터럴이면 그 값, 변수를 넘기면 그 변수 (Canvas 는 그 변수의 기본값, Preview 는 지금 값) 이고, 넘긴 변수가 바뀌면 원본 안 글자 · 보기가 다시 그려진다. 같은 컴포넌트의 instance 둘이 서로 다른 값을 넘기면 각자 다르게 보인다.
- Properties 에서 instance 의 변수 속성마다 「값 출처」 (직접 입력 / 같은 타입의 보이는 변수) 와 「지금 이 instance 에서는 …」.
  - 위치: `packages/shared/src/catalog/runtime/{inputVariable,stateTemplate,viewQuery,compositionRoot,catalogPreviewSession}.ts` · `resolution/resolver.ts` · `state/{runtimeState,visibility}.ts` · `apps/builder/src/builder/panels/properties/catalog/CatalogInstancePropertiesSection.tsx`

## [ADR-294 Phase 2 · 3 — 컴포넌트 event · variable property 패널 · code view] - 2026-10-30

### Added

- **Properties** — 컴포넌트 원본 루트를 고르면 「+ 이벤트 속성」 「+ 변수 속성」 이 있다. 이벤트 행은 받는 instance 수를, instance 를 고르면 이벤트마다 「Interactions 에서 받기」 (Interactions 패널을 연다) 를 보여 준다. 변수 속성은 instance 에서 선언 타입의 값을 넣는다 (타입 · 기본값은 원본 루트의 State 절).
- **Interactions** — instance 의 When 에 「컴포넌트」 그룹 (그 컴포넌트의 이벤트, 맨 앞). 원본 안 노드의 Do 에 「컴포넌트 이벤트 보내기」 (이벤트 + 보낼 값). 원본 규칙의 Set state 아래에 「이 컴포넌트를 쓰는 화면에 값을 넘기려면 …」 안내. Set state 는 컴포넌트의 입력 변수를 고르지 않는다 (읽기 전용).
- **code view** — instance 요소에 받는 이벤트가 `onSelect={setPicked}` 로, 변수 속성이 `role="admin"` · `role={roleFilter}` 로 나오고 고치면 문서로 돌아간다. 루트 컴포넌트의 RAC 콜백과 같은 이름 (`onAction` 등) 의 이벤트는 만들 수 없다.
  - 위치: `apps/builder/src/builder/panels/{properties/catalog,interactions}/**` · `catalogRuntime/{componentProperties,interactions,editContract,codeViewEdit}.ts` · `packages/shared/src/codeView/{generate,vocabulary}.ts` · `interactions/exposure.ts`

### Fixed

- 이벤트 · 변수 속성이 있는 컴포넌트의 instance 를 고르면 Properties 가 깨지던 것 (Phase 1 직후 — 대상 노드 없는 property 를 읽음).

## [ADR-294 Phase 0 · 1 — 컴포넌트 event · variable property 문서 · 실행] - 2026-10-30

### Changed

- **contract 52** — 사용자 컴포넌트의 property 종류에 `event` (원본이 값을 내보냄) 와 `variable` (instance 가 값을 넣음) 을 더했다. 51 프로젝트는 열리지 않는다 (마이그레이션 없음 — 사용자 확인 2026-10-30, 새로 만든다). 샘플 프로젝트 파일 3 은 52 로 갱신.

### Added

- 원본 규칙의 Do `emit` (event property 를 내보냄) 과 instance 규칙의 When `property:<key>` (받음, 값은 `!event.value`). Preview 는 누른 record 의 경계를 안쪽부터 찾아 그 instance 의 받는 규칙만 한 번 실행한다 — 같은 컴포넌트 instance 둘 · 컴포넌트 안 컴포넌트 (같은 이름 재발행) · 같은 바깥 컴포넌트 둘 안의 안쪽 instance 를 구별한다. 받는 규칙이 없으면 성공 (`listeners: 0`).
- variable property 의 값: 리터럴 (선언 타입) 또는 그 instance 에서 보이는 같은 타입 변수의 참조 (`!var.<id>`). 원본 안에서는 template 루트의 입력 변수로 읽히고 Set state 로 쓸 수 없다 (`INPUT_VARIABLE_READ_ONLY`). 값의 해석 경로 (보기 · 글자 · 규칙) 는 Phase 4 — 그때까지 입력 변수는 기본값으로 읽힌다.
- property 를 지우면 그 `emit` Do · 받는 규칙 · 입력 변수 · 변수 참조 값이 같은 step 에서 함께 지워진다.
  - 위치: `packages/shared/src/catalog/document/{types,validation,graph,componentEvents,componentProperties}.ts` · `commands/{properties,structure}.ts` · `runtime/{componentBoundaries,catalogPreviewInteractions}.ts` · `interactions/dispatcher.ts`
  - 패널 (Properties · Interactions) 과 code view 는 Phase 2 · 3.

## [Canvas 화면 맞추기 — 고정 여백] - 2026-10-30

### Changed

- `Zoom to fit`의 90% 비율 여백을 고정 여백으로 변경했다. Canvas 메뉴와 가장자리 여유 공간을 확보하도록 너비에서 132px, 높이에서 184px을 뺀 뒤 배율을 계산한다. 중앙 정렬과 기존 10%~500% 배율 제한은 유지한다.
  - 위치: `apps/builder/src/builder/workspace/canvas/viewport/viewportActions.ts`

## [컴포넌트 모서리 값 정리 · 필드 버튼 Preview pill 수리 · ToggleButton 선택 글자] - 2026-10-30

### Changed

- 모서리 (border-radius) 를 사용자 지정 값으로 바꿨다 — Canvas · Preview 같은 값.
  - 필드 입력 상자 (TextField · TextArea · NumberField · ComboBox · Select 트리거 · ColorField · DateField · TimeField · DatePicker · DateRangePicker, Form 안 입력 포함) 와 ToggleButton: S 7 · M 8 · L 9 · XL 10px (XS 는 그대로). NumberField 증감 버튼 · Pagination 버튼도 같은 값.
  - ToggleButtonGroup 상자 자체는 0 (모서리는 안의 ToggleButton).
  - InlineAlert 10px, Dialog · Popover 본체 16px (size 무관), Popover · Menu · Tooltip 컴포넌트의 트리거 버튼 8px.
  - 7 · 9 · 10px 는 theme 토큰에 없어 px 고정이다 — theme radius 스케일이 이 값들에 적용되지 않는다.
  - 위치: `packages/shared/src/catalog/generated/componentRulesTable.ts` · `document/generated/reusableOriginLibrary.ts` · `runtime/presence.ts` (Pagination 을 필드 버튼 소유자로)

### Fixed

- Preview 에서 필드 소유 버튼 (Select 트리거 · NumberField 증감 · Pagination) 이 pill 로 그려지던 문제 — DOM 이 규칙의 pill 값을 inline 으로 써서 `[data-field-button]` 시트를 이겼다 (10-28 pill 도입 뒤). DOM 도 Canvas 와 같은 `catalogDerivedRestVisual` 값을 쓴다 (`domBinding.runtime.ts`).
- Preview 에서 ToggleButton 을 클릭으로 선택하면 글자가 배경색과 같아져 사라지던 문제 — 글자 Text 에 휴지 색이 inline 으로 고정돼 있었다. Icon 과 같이 `color: inherit` (`domBinding.runtime.ts`).
- 수동 `Popover.css` 의 모서리가 생성 CSS 뒤에 로드되어 catalog Popover 값을 덮던 문제 — Builder 자체 popover (`:not([data-catalog-id])`) 로 범위를 좁혔다.
- 숫자 모서리 값이 생성 CSS 에 단위 없이 (`border-radius: 8;`) 나가던 문제 — `px` 를 붙인다 (`CSSGenerator.ts`). Canvas 의 DateInput 상자가 측정 전 자체 표 (4/6/8/10/12) 로 그려지던 경로도 노드 값으로 (`ruleShapes.ts`).

## [lint 오류 75 → 0 — React hooks 규칙 위반의 구조 수정] - 2026-10-30

### Fixed

- **Design 패널 검색 · 필터 컨트롤 절이 hook 을 조건부로 불렀다**: early return 뒤의 `useViewFields` 가 `kind` 가 바뀌면 hook 개수를 바꿔 React 가 "Rendered more hooks" 로 죽을 수 있었다. return 앞으로 옮겼다 (`CatalogFilterSection.tsx`).
- **Effect 절 레이어 제거 · inset 의 편집기 remount 가 ref 카운터였다**: 값이 같으면 다시 그리지 않았다. state 로 바꿨다 (`EffectSection.tsx`).
- **저장값을 draft 로 복사하던 effect 9곳**이 한 render 늦게 따라갔다 (낡은 값 한 프레임): 변수 표 · State 절 이름 · Data 패널 탭 · 열 편집기 (계산 열 · 수식 · 기본값) 는 render 중 조정, Button 대기 표시 · ComboBox 로딩 스피너는 경과 상태에서 계산한다.

### Changed

- **Layers store 수명**: `CatalogLayerTreeStore` 는 생성 때 읽기만 하고 `connect()` 가 문서 구독을 시작 · 반환값이 정지다. 패널은 `useMemo` + effect 로 소유한다 (첫 render 에 행이 있다).
- **ComboBox selection-text · waterfall grid 를 JSX 로**: `comboBoxSelectionText.tsx` · `waterfall.components.tsx` (레이아웃 규칙은 `waterfall.ts` 에 남고 react 를 import 하지 않는다). 드래그 앤 드롭 「최신 핸들러」 ref 제거 — RAC `useDragAndDrop` 이 매 render options 로 hook 을 다시 만든다.
- json-formula ambient 선언은 triple-slash 대신 builder tsconfig `include` (`css-modules.d.ts` 와 같은 방식). 필드 아이콘은 `FieldGlyph` 하나로.
- Live: 2026-10-30 Chrome MCP (5173) — Layers 추가 · 펼침 · 페이지 전환, Users 표 생성 · 열 편집기 계산 열 토글 · 기본값 commit, State 절 변수 이름, 검색 컨트롤 생성 · 선택 전환, Effect 레이어 3 → 2, publish 미리보기 검색 필터 · ComboBox 선택 글자. 콘솔 오류 0.
  - 위치: `packages/shared/src/catalog/runtime/*` · `apps/builder/src/builder/catalogRuntime/layerTree.ts` · `panels/{navigator,properties,styles,datatable,codeView}/**`

## [지연 모듈 로더 공용화 — serializer · formula engine] - 2026-10-29

### Changed

- **serializer와 수식 엔진의 지연 로딩·구독을 공용 helper로 통합**:
  - `createLazyModule`이 단일 로딩 Promise, 동기 snapshot, 완료 알림과 구독 해제를 담당한다. 수식 엔진의 로드 후 즉시 알림과 동적 import 경계를 유지한다.
  - 두 Builder hook은 `useLazyModule`을 사용하며, 필요한 모듈은 effect에서 불러온다.
  - `loadFormulaEngine()`은 호출마다 같은 Promise를 돌려준다 — 행 읽기마다 부르는 경로에서 chunk 로드가 실패해도 처리되지 않은 rejection이 한 번만 난다 (`formula/__tests__/engineLoad.test.ts`).
  - 위치: `packages/shared/src/utils/lazyModule.ts`, `packages/shared/src/hooks/useLazyModule.ts`, `collections/formula/engine.ts`, Builder `formulaEngine.ts` · `viewSerializer.ts`

## [ADR-291 후속 — 필터 패널 판정이 계산 열을 엔진 로드 뒤 다시 읽는다] - 2026-10-29

### Fixed

- 계산 열에 건 검색 · 필터 연결의 상세 (Design 패널 「Search · filter」 의 행별 판정) 가 수식 엔진이 로드되기 전에 그려지면 빈 셀 기준 판정 (「no match · hidden」) 이 그대로 남던 문제를 수정했다. 연결 상세가 엔진 로드를 구독해 로드 뒤 다시 그린다.
  - 위치: `apps/builder/src/builder/panels/properties/catalog/CatalogFilterSection.tsx` (`ConnectionRun`) · 회귀 테스트 `catalogFilterSection.test.tsx` · 규칙 `.claude/rules/state-management.md` (계산 셀 소비처는 엔진 로드 구독)

## [ADR-286 Implemented — 데이터 정의 · 사이트 · 페이지 설정을 catalog 문서로] - 2026-10-29

### Changed

- **ADR-286 Implemented** (G6 — 사용자 「Implemented 로 올리고 커밋 푸시해」): 데이터 표 만들기 · 셀 편집 Undo · 코드 보기 (바인딩된 표가 `./data/roles` 로) · 사이트 제목 · 언어 Undo · 새로고침 뒤 유지를 Builder 에서 확인했다 (Chrome MCP · 별도 dev 서버 5177 · 콘솔 오류 0). Phase 4 번들 초과 (Builder initial +5,977 B gz) 는 2026-10-28 사용자 수용. publish 내보내기 phase 는 열림 항목. 기능 상세는 아래 「ADR-286 Phase 0 ~ 4」 엔트리.
  - 위치: `docs/adr/completed/286-catalog-single-source-data-site-settings.md` (`### Live Exercise`) · `docs/adr/README.md`

## [ADR-289 Implemented — 데이터 격자 행 양식 · 열 편집기 절 넷 · 선택 행 복사 · 내보내기] - 2026-10-29

### Changed

- **ADR-289 Implemented** (G5 사용자 확인 — 「G5 확인, 번들 수용」): 행 양식 (삽입 · 수정) · 타입별 기본값 · 열 편집기 절 넷 · `Insert column…` · 선택 바 복사 ▾ · 내보내기 ▾ 가 사용자 Builder (5173) 에서 확인됐다. Phase 4 번들 초과 (Builder initial +1,891 B gz, 상한 +300) 는 사용자 수용 — 뒤이은 `08d43fb17` i18n 언어별 분리가 initial −86,553 B. 기능 상세는 아래 「ADR-289 Phase 1 ~ 4」 엔트리.
  - 위치: `docs/adr/completed/289-data-grid-row-form-column-editor-selection-actions.md` (`### Live Exercise` — G1 ~ G3 Chrome MCP 5174 + G5 사용자 confirm) · `docs/adr/README.md`

## [ADR-292 잔여 수리 — key-list 배열 전달 · 빈 배열 초기화 · JSON 예약 키 보존] - 2026-10-29

### Fixed

- JSON 배열을 `!var`로 `selectedKeys`·`defaultSelectedKeys`에 연결하면 생성 코드가 배열을 한 번 더 감싸던 문제를 수정했다. 일반 배열은 중복을 보존하고 key-list prop에 그대로 전달한다.
- 시작값 없는 배열의 기존 `Selection` 표현은 유지하되, 코드에서 명시적으로 `useState([])`로 바꾸면 빈 JSON 배열을 저장한다. Undo/Redo도 두 시작값을 구분한다.
- JSON의 `__proto__` 키를 일반 데이터 키로 생성하고 읽는다. 중첩 객체도 키를 보존하며, 해당 시작값이 있는 페이지에서 무관한 코드 편집이 거절되던 문제를 수정했다.

## [ADR-291 Implemented — 계산 필드 · 서버 조회 범위] - 2026-10-29

### Changed

- **ADR-291 Implemented** (사용자 G8 확인): 계산 필드 (열 편집기 「계산 열」 · 격자 · 코드 보기 · Canvas · Preview · 조건 · 묶기 · Chart) 와 서버 조회 범위가 완료됐다. publish 런타임의 상주 Worker (Phase 4) 는 보류 — 계산 셀 캐시로 입력 끊김이 사라져 남은 몫은 데이터를 처음 받을 때의 계산 한 번이다.
- **필터 절의 요청 표시가 serializer 를 필요할 때만 불러온다**: API 표의 「Request sent」 줄은 연결 상세를 열 때 준비된다. Builder 첫 화면 번들 −1.2 KB gzip (이 ADR 전체 +0.6 KB).
  - 위치: `apps/builder/src/builder/panels/properties/catalog/viewSerializer.ts`

## [ADR-291 Phase 5 진행 — 계산 필드 번들 경계 · live 결함 2 수리] - 2026-10-29

### Fixed

- **계산 필드를 조건으로 쓰는 표가 프로젝트를 열 때 비어 보이던 문제**: 수식 엔진이 로드되기 전의 보기 결과(계산 값이 비어 전부 탈락)를 로드 뒤에도 그대로 썼다. 이제 엔진이 로드되면 다시 계산한다 (Canvas · Preview · Publish 공통).
- **필터 패널의 행 판정 (「Row verdicts」)** 이 계산 필드 조건을 계산 전 값으로 판정해 보이는 행을 「hidden」 으로 표시하던 문제.

### Changed

- **계산 필드 코드는 첫 화면 번들에서 빠진다**: 계산 필드가 있는 문서를 처음 읽을 때 수식 엔진과 함께 불러온다. Builder 첫 화면 번들의 계산 필드 몫 +4.2 KB → +1.8 KB (gzip, 착수 대비 — 나머지는 서버 조회 범위 코드).
  - 위치: `packages/shared/src/collections/formula/{engine,compute,computeCells,instance}.ts`

## [ADR-291 Phase 2 — 계산 열 UI · 코드 보기 필드 정의 블록 · G6] - 2026-10-29

### Added

- **열 편집기 「계산 열」** (ADR-291 Decision 8 · 사용자 결정 5 · 7): Type 절의 스위치를 켜면 수식 입력 (열 이름으로 적는다 — 저장은 열 id · 글자는 쌍따옴표) 이 열리고 Type 은 결과 타입 (Number · String · Boolean · Date), 기본값 칸은 사라진다. 틀린 수식 (문법 · 없는 열 · 없는 함수 · 순환 · 타입) 은 입력 아래 빨간 줄로 보이고 저장되지 않는다. 스위치를 끄면 보통 열로 돌아간다. 「Insert column…」 도 같은 스위치로 계산 열을 만든다.
- **데이터 격자의 계산 열**: 읽기 전용 열로 mock 행의 계산 결과를 보이고 머리글은 Σ 아이콘 + 툴팁에 수식, 계산이 실패한 행의 셀은 빈 칸 + 테두리 표지. 수식 엔진은 계산 열이 있는 표에서만 불러온다.
- **코드 보기의 계산 열** (Decision 9): `import JsonFormula from '@adobe/json-formula'` · `let <rows>Fields = {<key>: {type, formula}}` · `let <rows> = <rows>Data.map(item => computed(item, <rows>Fields))` — 수식 문자열을 코드에서 고쳐 Apply 하면 그 열의 수식이 바뀐다 (한 step · Undo 한 번). `type` 변경 · 열 추가 · 삭제는 코드에서 거절 (열 편집기에서).

### Changed

- **계산 열이 있는 보기의 입력 반응** (R6): 계산 셀을 원본 행 · 수식 · 수식이 읽는 변수 값 · 오늘 날짜 기준으로 캐시한다 — 검색어 같은 변수가 바뀌어도 수식은 다시 돌지 않는다. 10,000 행 × 계산 열 5 의 변수 변경 1 회 268 → 5 ms (Chrome 4x CPU throttle), 한 행 편집은 그 행만 다시 계산. `now()` 를 쓰는 수식은 캐시하지 않는다.
  - 위치: `packages/shared/src/collections/formula/compute.ts`

### Fixed

- 프로젝트를 새로 열면 Canvas 의 계산 열이 빈 칸으로 남던 문제 — 수식 엔진이 데이터 패널 상태보다 먼저 로드되면 다시 읽기를 건너뛰었다 (Phase 2 에서 생긴 결함). 계산 열이 있는 표를 문서에서 읽는다.
- Phase 3 가 놓친 테스트 2 (API 보기 `body` 요청의 `total: true` · `suffix` 묶기는 전체 로드 뒤 `complete`) 와 Builder mount 의 rows refresh 정적 게이트 (엔진 로드 뒤 refresh 는 계산 열이 있는 표만).

## [ADR-291 Phase 0 · 1 · 3 — 계산 필드 (json-formula) · 서버 조회 범위 · 조회용 보기의 전체 로드 상한] - 2026-10-29

### Added

- **계산 필드** (ADR-291 Decision 1 ~ 4, 사용자 결정 1 · 7): 표의 열에 `formula` (json-formula 식 — 필드 id 로 저장 · 이름으로 표시, 변수는 `$var_<id>`) 와 결과 타입 `type` (number · string · boolean · date) 을 두면 행을 읽는 단계에서 셀이 계산된다 — 보기의 조건 · 집계 · 정렬 · `{field}` 템플릿 · 보기 없는 바인딩 · 서버가 답한 행 모두 같은 값. 정의 오류 (문법 · 모르는 필드 · 숨긴 함수 `random` 등 4 · 순환 · 결과 타입 · 분류 못 하는 범위) 는 저장이 거절되고, 행 오류 (0 나눗셈 · 타입) 는 그 셀만 `null` + 표지. 날짜는 UTC 일수로 다리를 놓아 `'due' - today()` 가 남은 날이다. 엔진은 식이 있는 문서만 lazy 로드. 열 편집기 · 격자의 계산 열 UI 는 ADR-289 뒤 (Phase 2).
  - 위치: `packages/shared/src/collections/formula/{engine,scope,names,compute,validate,allowed}.ts` · `catalog/document/{types,validation}.ts` · `collections/view/evaluate.ts` · `catalog/runtime/dataBinding.ts`
- **서버 조회 범위** (Decision 5 · 6, 사용자 결정 3 · 6): `body` 형식 요청이 묶기 · 집계 (`group`) · 페이지 (`page`) · 전체 수 (`total: true`) 를 싣고 서버의 묶음 행이 그대로 보기 결과가 된다. `suffix` 형식은 `pageSize` 를 두면 `_page` · `_limit` 로 페이지를 넘기고 `X-Total-Count` 로 전체 수를 읽는다. 계산 필드를 조건 · 정렬 · 묶기 키 · 집계 입력으로 쓰는 보기 (계산 필드를 읽는 계산 필드 포함) 는 서버로 보내지 않고 (`COMPUTED`), `suffix` 의 묶기는 조건만 보내고 (`GROUP`) — 둘 다 전체 행을 **10,000 행까지** 불러와 여기서 돌린다. 넘으면 행 0 + 경고 (조용한 부분 결과 없음). mock 서버 `apps/builder/scripts/mock-query-server.mjs` (body · json-server 두 형식, CLI).
  - 위치: `packages/shared/src/collections/view/serialize.ts` · `collections/executeCollectionEndpoint.ts` · `catalog/runtime/{catalogPreviewSession,viewQuery,dataBinding}.ts` · 패널 문구 `apiQueryWarnGROUP` · `apiQueryWarnCOMPUTED`

### Removed

- **프로젝트 변수의 `transform`** (사용자 결정 2): 임의 JS 문자열 자리 — 실행하는 코드가 없었다. 타입 · 검증 · 복사 · `updateVariable` 분기 삭제.

### Changed

- 「묶기 · 집계는 요청에 싣지 않는다 — 불러온 행으로 계산 (마지막 페이지 전에는 일부)」 문구가 「파라미터로 보낼 수 없다 — 전체 행을 불러와 (10,000 행까지) 여기서 묶는다」 로 (body 형식은 싣는다).
  - 검증: RED 9/9 GREEN (`adr291Red.test.ts` shared · builder) · G1 · G2 (`collections/formula/__tests__/` 36) · G4 세션 3 · G5 mock 서버 동치 4 · shared · builder 전체 PASS · type-check PASS. Phase 0 측정 표 (10만 행 26 ~ 30 ms · 100만 행 ~270 ms · Worker 는 복제가 지배 · 해석기 셀당 0.5 ~ 2 µs) 는 breakdown §1c.

## [ADR-292 리뷰 수리 — 코드 보기의 JSON · date 시작값 · 시각 비교 · date 조건] - 2026-10-29

### Fixed

- **JSON 시작값이 있는 페이지에서 코드 보기 편집이 전부 거절되던 것** (코드 리뷰 HIGH): `useState({count: 1})` 을 읽지 못해 값 수정뿐 아니라 무관한 요소 편집도 「어휘 밖」 이었다. 생성기가 쓰는 객체 · 배열 리터럴을 그대로 읽는다 (`structuredLiteralOf`).
- **JSON 배열 시작값이 `new Set([…])` 으로 나오던 것**: `[1, 1, 2]` 의 중복이 사라졌다. `Set` 은 RAC 선택에 쓰이는 변수 (`string[]` · 이름 붙인 선택 상태 · `!event.keys` 로 쓰이는 변수 · JSON 시작값이 없는 옛 배열) 만, 나머지는 `useState([1, 1, 2])`.
- **`…Z` · 오프셋 date 시작값의 코드가 실행 시 예외를 내던 것**: `parseZonedDateTime` 대신 `parseAbsolute('…', 'UTC')` 로 쓰고 읽는다.
- **시각만 담은 date 값이 같은 값으로 걸러도 탈락하던 것**: 시각끼리는 시각으로 비교한다 (시각 ↔ 날짜는 맞지 않음).
- **date 변수의 속성 조건이 글자로 비교되던 것**: 조건 실행이 변수 타입을 받아 표의 날짜 비교와 같은 답을 낸다 (`2026-10-29T10:30` equals `2026-10-29` → 참).
  - 위치: `packages/shared/src/codeView/{inverse.ts,generate.ts}` · `collections/view/comparison.ts` · `catalog/runtime/stateTemplate.ts` · `apps/builder/src/builder/catalogRuntime/codeViewEdit.ts`
  - 검증: 수리마다 원복 RED · shared 1,907 · builder 3,697 · publish 14 PASS · type-check PASS · live 5174 (코드 보기 세 시작값 적용 · 재생성 · `count` 편집 · `<Button />` 추가 · Preview 버튼 disabled ↔ 대조 값에서 enabled · 콘솔 오류 0)

## [데이터 패널 — API 편집기 · 가져오기 · 표 만들기 칸을 빌더 필드로] - 2026-10-29

### Fixed

- **API 편집기의 칸 · 탭이 다른 패널과 같은 빌더 필드 모양이 된다** (사용자 지시 2026-10-29 「빌더 UI 를 쓰지 않는 곳」 감사 1군): 탭 본문이 `Section` 이 아닌 `div` 라 빌더 필드 CSS (`.section` 범위) 가 닿지 않았고, URL · 헤더 · 쿼리 · 인증 칸이 흰 바탕 · 1px 테두리 · 모서리 4px 의 자체 모양이었다. 탭 본문을 `Section` (Params · 응답 경로 · 조회 · 업로드 · Headers · Body · Auth · Response) 으로, 응답 경로 · 키 이름 · Secret 이름 · 표 이름을 `PropertyInput` 으로, 요청 본문을 `PropertyInput` 여러 줄 모드로, 키 · 값 줄과 조회 형식 표의 칸을 빌더 필드 상자로, Pretty · Raw · Schema 를 `PropertySegment` 로 바꿨다. 요청 바의 URL 칸은 같은 필드 토큰 (회색 바탕 · 안쪽 그림자 · 상자 포커스 링) 이다.
- **API 요청 바의 Method 칸이 줄 전체로 늘어나 URL 칸이 16px 로 눌리던 것**: Method 선택에 폭 규칙이 없어 trigger 가 줄 폭까지 컸다 — 폭 92px 고정.
- **CSV · JSON 가져오기의 Replace · Append 가 빌더 세그먼트가 된다** (같은 감사 1군): 브라우저 기본 라디오 두 개 → `PropertySegment`. 가져오기 미리보기도 `Section` (제목 · 행 수 badge) 이다.
- **표 만들기의 행 수 · 빈 값 비율이 빌더 숫자 필드가 된다** (같은 감사 2군): 절 머리 오른쪽의 기본 `<input type="number">` (행 수) 와 손으로 짠 숫자 칸 (빈 값 %) → `PropertyNumberInput` 한 줄 (상하한 0 ~ 100 · 0 ~ 90 은 필드가 맞춘다). 붙여넣기 · AI 설명 칸은 바탕 없는 textarea 였다 — 빌더 필드 상자 (`PropertyFieldset`) 안으로.
- **칸에 입력한 뒤 다른 탭을 바로 누르면 그 입력이 저장되지 않던 것** (2026-10-29 live 재현 — API 편집기 응답 경로 · 본문 · 인증 · 조회 형식 표): 탭 전환이 React commit 안에서 포커스된 칸을 지우고, 그때 브라우저가 보내는 blur 는 React 가 commit 동안 이벤트 전달을 꺼 두어 (`dispatchEvent` 의 `_enabled` 검사) `onBlur` 가 돌지 않았다. blur 에만 저장하던 `PropertyInput` 과 조회 형식 표의 칸이 이제 편집 중에 사라지면 그때 저장한다 — blur 와 같은 규칙 (바뀐 값만 · 포커스할 때의 선택이 그대로일 때만). `PropertyInput` 을 쓰는 다른 탭 패널 (Design 패널 등) 도 같은 경로다.
  - 위치: `apps/builder/src/builder/panels/datatable/editors/{ApiEndpointEditor.tsx,ApiEndpointEditor.css,QueryFormatSection.tsx,DataTableCreator.tsx,DataTableCreator.css}` · `grid/{ImportPreview.tsx,ImportPreview.css}` · `apps/builder/src/builder/components/property/PropertyInput.components.tsx` (+ `PropertyInput.unmount.test.tsx`) · `src/i18n/messages/{en-US,ko-KR}.ts` (절 제목 4 · `importMode`)

## [데이터 패널 Variables — Tables · APIs 와 같은 목록 열 + 본문] - 2026-10-29

### Changed

- **ADR-292 Implemented** — 아래 변수 편집 두 모양 · `date` 타입 · 공통 열 타입 결정의 기록: [ADR-292](adr/completed/292-variable-editing-two-shapes-date-type-common-field-types.md) (사용자 `/create-adr` 2026-10-29, 구현 `1a6af386e` 뒤 문서화 · 옛 타입 열은 「기존 문서 마이그레이션 필요없다」).
- **Variables 탭에 목록 열이 생겼다** (사용자 지적 2026-10-29 「tables, apis 와는 다르게 variables 는 left-list 구조가 아니다」 → 결정 「변수 묶음 목록」, Figma Variables 어법): 목록 열은 변수 묶음 — Project variables 와 변수가 있는 페이지마다 한 행 (변수 수) — 이고, 행을 고르면 본문에 그 묶음의 변수 표가 열린다. 페이지 묶음은 그 페이지 · 요소 변수 (읽기 전용 · 「소유자에서 편집」) 와 그 페이지의 옛 data store 변수 (「페이지로 이관」). 전에는 표가 전체 폭이고 페이지 · 요소 변수는 「보기: 모든 변수」 선택으로 같은 표에 섞였다 — 그 선택은 목록 열이 대신한다. 변수 추가 + 는 목록 머리 하나 (Tables · APIs 와 같은 자리). ADR-288 G3 「Variables 탭 = 변수 표 전체 폭」 을 바꾼다.
- **변수 표가 데이터 격자 모양 · 조작이 된다** (사용자 2026-10-29 「변수도 data table 로」 → 「격자 모양으로 맞추는 방향」 — 격자 자체 재사용은 ADR-288 R2 대로 하지 않음: 칸 편집기가 행 타입을 따르고 저장이 변수 명령이다): 머리글 · 행 28 px · 칸 테두리 1 px · 포커스 셀의 안쪽 2 px 링 (클릭에도) · 읽기 전용 행의 raised 바탕. 이름 · 시작값 (글자 · 숫자) 칸은 회색 입력 상자가 아니라 셀 글자이고, 클릭 = 포커스, Enter · F2 · 타이핑 · 더블클릭 = 그 자리 편집, Enter 저장 (셀로 돌아감) · Esc 취소 · 칸을 벗어나거나 편집 중 사라지면 저장. 타입 칸도 셀 글자이고 Enter · F2 · 더블클릭이면 셀에 붙은 목록 팝업 (패널 Select 의 팝업 모양) — 전에는 칸 안 Select 버튼이 클릭을 받아 팝업이 바로 열리고 포커스가 셀에서 버튼으로 옮겨 갔다 (사용자 지적 2026-10-29). boolean 시작값은 스위치가 아니라 true · false 선택 — 격자에서는 타입 칸처럼 셀 글자 + Enter · F2 · 더블클릭이면 셀에 붙은 목록, State 절에서는 패널 Select (사용자 2026-10-29 「bool 일경우 true, false 선택」 · 「data 패널에도 동일하게」). JSON 은 셀 안에 평평하게. 타입 목록의 object · array 는 화면에서 **JSON 하나** (string · number · boolean · JSON) — JSON 을 고르면 object 로 저장하고, 저장한 값이 배열이면 array, 객체면 object 로 저장 타입이 같은 step 에 정해진다 (사용자 2026-10-29 「화면에서만 JSON 하나로 보여 주고, 목록 여부는 저장할 때 값으로 정하기」 — Supabase 에도 따로 list 가 없다). 변수 만들기 양식도 JSON 하나. **변수 타입에 `date` 가 생겼다** (사용자 결정 2026-10-29 「4개 type 에 date 하나만」): 값은 ISO 글자 하나이고 모양이 정밀도를 정한다 — `2026-10-29` (날짜) · `2026-10-29T10:00` (날짜+시각) · `10:00` (시각) · `…Z` · `…[Asia/Seoul]` (시간대 instant), 빈 값은 `""`. 판정 · 변환은 설치된 `@internationalized/date` (RAC 의 날짜 라이브러리 — `parseDate` 계열 · `toString()`) 가 맡는다 (shared `state/dateValue.ts`). 타입 변경 때 날짜 글자는 남고 아니면 비운다 · 런타임은 `Date` · RAC 날짜 값을 글자로 받는다 · Calendar 의 포커스 날짜 (RAC `focusedValue`) 를 변수로 이름 붙일 수 있다 · 「변수로 정하기」 비교는 날짜 비교 (이전 · 이후) · 코드 보기는 `useState<DateValue | null>(parseDate('…'))` 로 쓰고 그대로 읽는다 (빈 값 `null`, 시각은 `Time`) · Data 패널 · State 절 · 만들기 양식의 타입 목록에 date (달력 아이콘), 시작값은 브라우저의 날짜 선택기 (사용자 「date 편집일 때 캘린더 오픈」 — 격자에서 Enter · F2 · 더블클릭이면 선택기가 바로 열리고, State 절 행은 선택기 칸; 값 모양에 따라 날짜 · 날짜+시각 · 시각 선택기, 데이터 격자의 date · datetime 셀과 같은 방식) 이고, 격자에서 글자 키로 시작하면 ISO 글자를 직접 쓴다 (다른 정밀도로 바꿀 때 · 틀리면 오류). JSON 시작값 편집은 데이터 격자의 셀 팝오버 편집기 (`PopoverTextEditor` — 제목 · JSON 안내 · 여러 줄 입력 · ⏎ 저장 / ⇧⏎ 줄바꿈 / Esc 취소 · Cancel · Save) 를 그대로 쓴다 (사용자 2026-10-29 「table 의 편집 popover 창 같이 쓰면」): 칸 글자 + Enter · F2 · 더블클릭 · 글자 키로 칸에 붙어 열리고, 틀린 JSON 은 열린 채 빨간 표시, Esc · 바깥 누름은 취소 (격자와 같은 규칙). 격자의 편집기는 `grid/PopoverTextEditor.tsx` (+ `.css`) 로 분리했고 `DataGrid` 는 그것을 감싼다. Design 패널 State 절의 페이지 · 요소 변수도 같은 편집기로 JSON 시작값을 쓴다 (사용자 2026-10-29 「design 패널 state section 에도 적용」) — 행의 시작값 칸이 JSON 글자 (빈 값은 「{ }」) 이고 누르면 칸에 붙어 열린다. **표 열 타입도 변수와 같은 공통 타입이 됐다** (사용자 결정 2026-10-29 「reference 는 표 전용으로 남기고 공통 타입으로 맞춰」): 열 타입 목록은 string · number · boolean · date · JSON · reference 여섯 (전 11종). `datetime` 은 `date` 하나로 (ISO 글자 — 모양이 날짜 · 날짜+시각 · 시각; 셀은 그 모양의 브라우저 선택기로 편집, 느슨한 글자 `Sep 12 2026` 은 날짜로), object · array 는 JSON 하나 (셀은 객체 · 배열 어느 쪽이든), 이메일 · URL · 이미지는 타입이 아니라 `string` 의 **Format** (열 편집기 Type 절의 「Format: Text · Email · URL · Image」 — 입력 키보드 · 이미지 미리보기 · 머리글 아이콘만 다르다, 문서 필드 `format` · DataChange `update_field.patch.format`). 가져오기 추론 · 프리셋 · AI 표 생성 (`format` · 날짜 규칙 `withTime`) 도 같은 타입을 쓴다. 타입을 고르는 목록도 하나다 (사용자 「type 선택하는 popover 창 자체가 다른데」): 열 편집기 · 변수 격자의 타입 칸 · State 절의 타입 아이콘이 모두 같은 패널 Select 목록 — 같은 이름 (String · Number · Boolean · Date · JSON) 과 이름 아래 한 줄 안내, 같은 순서 (표는 Reference 가 하나 더). 기존 문서의 `datetime` · `email` · `url` · `image` 열은 마이그레이션 없이 그대로 남아 String 으로 읽히고, 열 편집기에서 타입을 다시 고르면 새 타입이 된다. 이로써 ADR-288 의 contract 51 (페이지 · 요소 object · array 시작값은 `""` 뿐, 「규칙이 정함」) 은 「`""` 또는 그 타입의 JSON 값」 으로 넓어졌다: 문서 검증 (`DEFAULT_VALUE_TYPE` 은 모양이 다를 때만) · 타입 변경 규칙 (맞는 JSON 값은 남는다) · 코드 보기 (`useState({…})` · `useState([…])` 로 쓰고 읽는다) · 명령 `setJsonDefault` (저장 타입은 값으로 — 배열이면 array) 가 같이 바뀌었다. Persist · Used 열은 64 px (14 px 머리글이 56 에서 잘렸다). 행 끝 칸은 삭제가 유일한 동작인 Data 패널에서 ⋮ 메뉴 대신 투명 삭제 아이콘 버튼 (`ActionIconButton` — 회색 바탕 없음, 사용자 2026-10-29), 소유자로 이동 ↗ 도 같은 버튼 — 사용처가 ⋮ 안에 있는 Design 패널 State 절 (dense) 은 ⋮ 그대로. 격자 모양은 Data 패널 표에만. Design 패널 State 절 (page · 요소 변수) 은 내용은 같고 표가 아니라 **변수마다 패널 행** — `.fieldset-row` 한 줄 `4fr 2fr var(--control-size)` (212 에서 112 · 56 · 28 — 액션 칸은 ID · Route 와 같은 28, 사용자 2026-10-29) = [이름 + 타입][시작값][⋮], 타입은 이름 상자 끝의 패널 Select ▾ 상자 안 타입 아이콘 (string T · number # · boolean · object { } · array 목록 — 격자 머리글과 같은 아이콘, 목록은 아이콘 + 이름) (사용자 2026-10-29 「select 다운버튼 스타일로 아이콘으로」 · 「Data 패널의 Variables 탭은 현재 테이블 스타일 그대로, Design 패널 State 절은 변수마다 패널행」). ⋮ · ↗ 는 7칸 격자의 마지막 액션 칸이고, State 묶음이 필드 하나 폭 (176) 에 묶여 행 액션이 필드 영역 안으로 들어가던 것도 풀었다 (RAC 상태 행 포함).
  - 위치: `apps/builder/src/builder/panels/datatable/components/{VariableGroupList.tsx (새),VariableList.tsx,VariableList.index.test.tsx}` · `apps/builder/src/builder/components/variables/VariableTable.{tsx,css,test.tsx}` · `catalogRuntime/__tests__/phase4ePropertySections.test.tsx` · `DataTablePanel.{tsx,css}` · `DataSurfaceBody.tsx` · `types/editorTypes.ts` (`variables` 모드의 `group`) · `stores/dataTableEditorStore.ts`

## [Builder 번역 — 언어별 chunk 로 분리 · 쓰는 언어 하나만 받는다] - 2026-10-29

### Changed

- **Builder 가 쓰는 언어의 번역만 받는다** (사용자 결정 2026-10-29 「언어별로 분리」): 한국어 · 영어 번역이 한 파일 (`translations.ts`, 7,965줄) 에 있어 어느 언어를 쓰든 두 언어가 초기 번들에 실렸다. 언어마다 모듈 하나 (`i18n/messages/ko-KR.ts` · `en-US.ts`) 로 나누고 `i18n/loadMessages.ts` 가 동적으로 불러온다 — 앱 시작 때 저장된 언어 하나를 받은 뒤 첫 화면을 그리고, 언어를 바꾸면 그 언어를 받은 다음 전환한다. 컴포넌트 목록 검색은 모든 언어의 이름으로 찾으므로 첫 검색 때 나머지 언어를 받는다. 문서의 `lang` · `dir` 은 React Aria `useLocale()` 의 값을 따른다 (자체 설정표의 방향 대신). `translations.ts` 는 두 언어를 함께 보는 테스트 · 도구 전용으로 남고, 앱 코드가 그것이나 언어 모듈을 직접 import 하면 `localeSplit.static.test.ts` 가 막는다.
  - 번들 (Builder initial JS gzip, `7eadcf38b` 대비): 1,460,360 → 1,373,807 B (−86,553). 시작 때 받는 언어 chunk 를 더하면 영어 1,421,662 (−38,698) · 한국어 1,426,708 (−33,652). 언어 chunk 는 영어 47,855 · 한국어 52,901 B.
  - 위치: `apps/builder/src/i18n/{loadMessages.ts,messages/,translations.ts,I18nProvider.tsx,index.ts,localeSplit.static.test.ts}` · `src/main.tsx` · `builder/panels/components/ComponentList.tsx` · `services/agent/executeAgentCommand.ts` · `src/test/i18nPreload.ts`

### Fixed

- **정적 게이트 3건** (ADR-289 커밋 `7eadcf38b` 이 깬 것): 셀 팝오버의 키 안내가 단축키 기호를 직접 적던 것을 `formatShortcut` 으로 (Mac 이 아니면 `Shift+Enter` 처럼 단어), 참조 열 · 정렬 열 조회를 `resolveField` 와 id 인자 `collections.get` 으로 (ADR-152 단일 resolve 게이트).

## [데이터 격자 — 행 선택은 체크박스로만 · 셀 클릭은 그 셀만] - 2026-10-29

### Changed

- **셀을 클릭하면 그 셀만 포커스되고 행은 선택되지 않는다** (Supabase Table Editor 어법, 사용자 결정 2026-10-29): 행 선택은 맨 앞 체크박스 (머리글 체크박스 = 보이는 행 전부) 로만 하고, 다중 선택도 체크박스로만 쌓인다. 선택 후 타이핑 · 더블클릭 → 셀 편집, `Shift+Enter` · ↗ → 행 양식, 선택 바 (복사 · 내보내기 · 삭제) 는 그대로. 전에는 RAC Table 의 `toggle` 선택이라 셀 클릭마다 행 전체가 파랗게 선택되고 클릭이 쌓였다. RAC 1.22 Table 에는 「체크박스로만」 옵션이 없어 (ListBox 의 `itemBehavior` 만) Table 선택을 끄고 (`selectionMode="none"`) 체크박스 열이 자기 상태 (`data-checked`) 를 가진다 — 행의 `aria-selected` 는 더 이상 나오지 않고 체크박스의 상태가 접근성 표면이다.
  - 위치: `apps/builder/src/builder/panels/datatable/grid/DataGrid.components.tsx` · `grid/DataGrid.css` · `grid/gridKeys.ts`

### Fixed

- **셀 포커스 테두리가 클릭에도 · 인라인 편집 중에도 보인다** (사용자 지적 2026-10-29 「permission 열의 셀만 편집 시 포커스가 나타난다」): 전에는 키보드 포커스에만 테두리가 있었고, 인라인 편집기의 흰 바탕이 셀 테두리를 덮어 목록 · 묶음 (팝오버) 열에서만 보였다. 이제 클릭한 셀에도 테두리가 있고 (Supabase 어법) 인라인 입력은 바탕이 투명해 테두리가 그대로 남는다. 숫자 열의 인라인 입력은 오른쪽 정렬이라 편집 들어갈 때 글자가 왼쪽으로 뛰지 않는다. 팝오버 편집 중 셀 글자가 8 px 왼쪽으로 밀리던 것 (편집 중 padding 0 이 팝오버 종류에도 걸림) 은 인라인 편집에만 걸도록 좁혔다.
- **셀 팝오버 편집기 (JSON · 목록 · 긴 값) 에 바탕 · 테두리 · 그림자가 돌아왔다**: 팝오버의 class 가 RAC 기본 `react-aria-Popover` 를 대체해 공용 팝오버 시트가 닿지 않았다 — 열 편집기 팝오버와 같은 class 조합 · 폭 320 · 그림자.
  - 위치: `apps/builder/src/builder/panels/datatable/grid/DataGrid.components.tsx` (`PopoverCellEditor`) · `grid/DataGrid.css`
- **열 머리글 ⌄ 가 열 동작 메뉴가 된다** (사용자 지적 2026-10-29, Supabase 대조 — 「제목 · 타입 · ⌄ 가 모두 같은 팝오버」): ⌄ 는 `오름차순 정렬 · 내림차순 정렬 (· 정렬 해제) │ 이름 복사 · 열 편집 · 열 고정 │ 열 삭제` 메뉴이고, 제목 · 타입 아이콘은 지금처럼 열 편집 팝오버. 정렬은 보기만 바꾼다 (문서 순서 · 행 번호 · 편집 대상 그대로, 빈 칸은 끝, 숫자 인식 비교 — `grid/gridSort.ts`) 그리고 머리글에 방향 표시. 고정한 열은 체크박스 열 다음으로 모여 가로 스크롤 때 왼쪽에 남는다 — RAC `TableLayout` 의 `isStickyColumn` 확장 (체크박스 열도 늘 고정, 본문 · 머리글 묶음은 overflow 를 열어 sticky 기준이 격자 스크롤러가 되게). 정렬 · 고정은 패널 상태라 저장되지 않는다. 열 삭제는 항상 확인창 (쓰이는 곳이 있으면 그 수) 뒤 `remove_field` 한 번.
  - 위치: `apps/builder/src/builder/panels/datatable/grid/DataGrid.components.tsx` (`ColumnHead` · `FrozenTableLayout`) · `grid/gridSort.ts` (새) · `grid/ColumnEditorPopover.tsx` (`ColumnDeleteDialog`) · `grid/DataGrid.css` · `apps/builder/src/i18n/translations.ts`
- **격자의 「Filter rows…」 가 빌더 검색 필드가 된다** (사용자 지적 2026-10-29, Navigator 「Search pages」 대조): 직접 짠 입력 (`filter-input-wrapper` · `filter-input` · `filter-clear-btn` 과 그 CSS) 을 공용 `SearchField` (`appearance="control"`) 로 — 같은 바탕 · 안쪽 그림자 · 포커스 링 · 글자 12 px, 지우기 단추와 Esc 비우기는 RAC SearchField 가 준다. 폭 상한 240 px 는 그대로. 쓰는 곳이 없어진 옛 필터 CSS 는 지웠다.
  - 위치: `apps/builder/src/builder/panels/datatable/grid/DataGrid.components.tsx` · `grid/DataGrid.css` · `editors/DataTableEditor.css`
- **셀을 누른 뒤 빈 곳을 눌러도 셀 선택이 풀리지 않던 것** (사용자 지적 2026-10-29): 행 아래 · 열 오른쪽 빈 곳은 격자 요소 자신 (`tabindex=-1`) 이라 눌러도 포커스가 움직이지 않아, 누른 셀이 포커스와 테두리를 그대로 가졌다. 격자 영역의 빈 곳 (행 아래 · 열 오른쪽 · 툴바 빈 자리) 을 누르면 셀 포커스를 놓는다 (Supabase 어법) — 셀 · 버튼 · 입력 · 대화상자를 누를 때는 그대로. 인라인 편집 중이면 그 blur 로 저장된다 (기존 동작).
  - 위치: `apps/builder/src/builder/panels/datatable/grid/DataGrid.components.tsx` (`handlePointerDown`)
- **머리글이 첫 행을 덮던 것** (사용자 지적 2026-10-29, 열 고정 도입이 낸 회귀): 고정 열 (체크박스 열 포함) 은 RAC 가 `inline-block` 으로 그려 줄의 글자 기준선에 앉았다 — 14 px 글자의 줄 높이 21 px 때문에 머리글 행이 28 → 34 px 로 커져 첫 행 위 6 px 를 덮었고, 본문 행도 내용이 33 px 로 넘쳤다. 행의 칸을 위쪽 정렬 (`vertical-align: top`) 해 머리글 · 행 모두 28 px.
  - 위치: `apps/builder/src/builder/panels/datatable/grid/DataGrid.css`
- **툴바와 격자 사이의 띠를 없앴다** (사용자 지적 2026-10-29): 격자 묶음 (`.datagrid`) 의 `gap` 4 px 가 툴바의 바탕과 표 위 테두리 사이에 패널 바탕 띠를 남겼다 (ADR-212 때부터). gap 을 지우고, 그 사이에 오는 두 줄은 각자 여백을 갖는다 — 필터 중 「N / 전체」 는 툴바 내용과 같은 왼쪽 8 px, 가져오기 미리보기 상자는 좌우 · 아래 8 px.
  - 위치: `apps/builder/src/builder/panels/datatable/grid/DataGrid.css`
- **행 여는 아이콘 = `maximize-2`** (사용자 지시 2026-10-29): 체크박스 옆 ↗ (`square-arrow-out-up-right`) 를 Supabase 의 펼치기 아이콘과 같은 `maximize-2` 로. 체크박스와 아이콘 사이는 셀의 `gap` (`--spacing-xs` 4 px — 체크박스 테두리에서 아이콘까지 보이는 간격 8 px) 이고, 한 번도 적용되지 않던 선택 셀 `padding: 0` · 체크박스 `width: 36px` 규칙은 지웠다 (뒤의 `.datagrid-cell` padding 이 이기고, 36 px 칸은 flex 가 16 으로 줄였다). 머리글의 전체 선택 체크박스는 ↗ 가 없어 가운데로 밀렸던 것 (행보다 11.5 px 오른쪽) 을 행 셀과 같은 배치 + ↗ 자리만큼의 빈 칸으로 맞춰 같은 세로 줄에 둔다.
- **격자 머리글 글자 14 · 열 메뉴 ⌄ 는 늘 보인다** (사용자 지적 2026-10-29): 공용 `Table.css` 가 `.react-aria-TableHeader` 에 16 을 주어 머리글만 본문 (12) 보다 훨씬 컸던 것을 격자 안에서 14 (`--text-sm`) 로. 열 머리글 오른쪽 ⌄ 는 hover 에서만 드러나던 것 (opacity 0) 을 없애 항상 보인다.
  - 위치: `apps/builder/src/builder/panels/datatable/grid/DataGrid.css`
- **셀 팝오버 편집기가 키로도 저장 · 취소하고 그 안내를 보인다** (사용자 지적 2026-10-29, Supabase 대조): 단추 왼쪽에 `⏎ 변경 저장` · `⇧⏎ 줄 바꿈` · `Esc 변경 취소` 키 안내. `Enter` 가 저장 (전에는 `⌘Enter` 만 — 지금도 된다) 하고 `Shift+Enter` 가 줄 바꿈. 형식 안내 (JSON · 날짜) 는 제목 옆으로.
  - 위치: `apps/builder/src/builder/panels/datatable/grid/DataGrid.components.tsx` (`PopoverCellEditor`) · `grid/DataGrid.css` · `apps/builder/src/i18n/translations.ts` (`datatable.gridKeySave/Newline/Cancel`)

## [ADR-289 Phase 1 ~ 4 — 데이터 격자 행 양식 · 열 편집기 절 넷 · Insert column… · 선택 행 복사 · 내보내기] - 2026-10-29

### Added

- **행을 고르면 복사 · 내보내기 · 삭제** (ADR-289 Decision 4, Supabase 선택 바 대조): 격자 위 바가 `복사 ▾` (CSV · JSON 으로 클립보드) · `내보내기 ▾` (선택 행만 CSV · JSON 파일) · `Delete N rows` 로 바뀐다. 선택이 없을 때의 내보내기는 전체 CSV 에 JSON 이 더해졌다. CSV 의 목록 · 묶음 칸은 JSON 글자로 적혀 붙여넣기가 그대로 읽는다 (전에는 배열이 `a,b` 로 이어졌다).
  - 위치: `apps/builder/src/builder/panels/datatable/grid/DataGrid.components.tsx`
- **셀렉트 항목에 설명 둘째 줄** (`PropertySelect.descriptions`): 항목 값마다 설명 한 줄을 주면 라벨 아래 흐린 글자로 보이고, 트리거에는 라벨만 남는다. 열 유형 목록이 첫 소비자.
  - 위치: `apps/builder/src/builder/components/property/PropertySelect.components.tsx` · `PropertySelectGrid.css`
- **열 편집기가 절 넷으로 읽히고, 유형마다 설명 한 줄이 붙는다** (ADR-289 Decision 3, 사용자 결정 3): 머리글 팝오버가 「이름 (필드 키 · 레이블) · 유형 (유형 · 기본값) · 규칙 (필수 · 참조 대상) · 사용처 (사용처 · 삭제)」 로 나뉘고, 유형 목록의 항목마다 「글자 — 이름 · 제목 · 설명」 같은 설명이 둘째 줄에 보인다. 기본값 칸은 유형에 맞는 입력 (켬/끔 · 숫자 · 날짜 · JSON …) 이고 값 그대로 저장한다 — 유형과 맞지 않는 글자는 「기본값이 유형과 맞지 않습니다.」 로 거절. 유형을 바꾸면 기본값을 새 유형으로 다시 읽고, 맞지 않으면 비우고 알린다.
  - 위치: `apps/builder/src/builder/panels/datatable/grid/ColumnEditorPopover.tsx` · `components/property/PropertySelect.components.tsx` (`descriptions`)
- **`Insert ▾ → Insert column…` 으로 열을 한 번에 만든다**: 이름 · 유형 · 기본값 · 필수 · 참조 대상을 정해 「생성」 — 한 번의 변경. 「계속 추가」 를 켜면 팝오버가 비워진 채 남는다. 머리글 끝 `+` 의 인라인 이름 입력 (글자 열 · Enter 연속) 은 빠른 길로 그대로.
  - 위치: `apps/builder/src/builder/panels/datatable/grid/ColumnEditorPopover.tsx` (`ColumnCreatePopover`) · `grid/DataGrid.components.tsx`

- **행 하나를 한 화면에서 넣고 고친다** (ADR-289 Decision 1, Supabase Table Editor 대조 — 사용자 결정 1 · 2 · 4 · 5): `Insert ▾ → Insert row…` 가 격자 오른쪽에 360 px 양식을 연다 — 필수 열 먼저, 아래 「선택 항목 — 비워 두면 기본값」. 입력은 타입별 (글자는 자라는 칸, 숫자 · 날짜 · 날짜시각 · 이미지 미리보기 · JSON · 다른 표 행 고르기 · 켬/끔) 이고 비운 칸은 기본값이 들어간다 (placeholder 가 그 값을 보인다). 필수 칸이 비면 그 칸 아래 오류 + 포커스. 저장은 한 번의 변경 (Undo 한 번). 「계속 추가」 를 켜면 저장 뒤 양식이 비워진 채 남는다. 기존 행은 행에 마우스를 올리면 나오는 ↗ 또는 셀에서 `Shift+Enter` 로 같은 양식 (Update) — 손대지 않은 칸은 그대로, 지운 칸은 빈 값, 바뀐 칸만 한 번에 쓴다. 양식을 연 뒤 다른 곳에서 그 표의 행이 바뀌면 (삭제 · 삽입 · 편집 · 가져오기) 저장을 거절하고 입력을 지킨다. 본문이 680 px 보다 좁으면 양식이 격자 자리를 대신하고 ✕ 로 돌아온다. 저장 안 한 입력이 있을 때 Esc · ✕ 는 확인창.
  - 위치: `apps/builder/src/builder/panels/datatable/grid/{RowForm,FieldValueInput}.tsx` (새) · `grid/{fieldDefault,rowFormValues,rowFormTarget}.ts` (새) · `grid/DataGrid.components.tsx` · `grid/gridKeys.ts` · `grid/DataGrid.css`

### Changed

- **번들** (ADR-289 Phase 4, 착수 HEAD `51fe50daa` 대비): Builder initial JS gzip +1,891 B (상한 +300 초과 — 전부 i18n `locales` chunk 의 새 키 (+1,786) 와 `PropertySelect.descriptions` (+110); 기능 코드는 datatable lazy chunk +4,855 B) · Preview +1 B. 수용 여부는 G5 사용자 판단.

### Fixed

- **열의 기본값이 타입을 지킨다** (ADR-289 Decision 2 — 리뷰 H1): Boolean 열의 기본값 `"true"` (글자) 가 새 행에 글자 그대로 들어가던 것이, 읽는 쪽 하나 (`resolveFieldDefault`) 가 타입이 맞는 값은 그대로 · 글자는 셀 편집과 같은 규칙으로 바꿔 넣는다 (`{ "enabled": true }` · `[1, 2]` · `[]` 도 그대로 — `[object Object]` · `1,2` 아님). 기존 문서는 고치지 않는다.
  - 위치: `apps/builder/src/builder/panels/datatable/grid/fieldDefault.ts`
- **「필수」 가 처음으로 동작한다**: 지금까지 열의 「필수」 스위치는 저장만 되고 어디서도 쓰이지 않았다 — 행 양식이 저장할 최종 값으로 판정한다 (Insert 는 기본값을 채운 뒤, Update 는 그대로 두는 칸의 현재 값까지).

## [ADR-288 Implemented — 데이터 패널 하나로 · G6 사용자 확인 · 팝오버 폭 288] - 2026-10-29

### Fixed

- **표 설정 · 열 편집 팝오버가 설계 폭 288 px 로 열린다** (ADR-288 G6 수정 16, 사용자 5173 서버 실측): 공용 팝오버 규칙의 `max-width: 250px` 가 두 팝오버를 250 으로 깎아 안의 7 칸 격자가 `94 · 94 · 28` 로 좁게 그려졌다. 두 팝오버 규칙에 상한을 같이 두어 288 (`113 · 113 · 28`) 로 열린다.
  - 위치: `apps/builder/src/builder/panels/datatable/components/TableSettingsPopover.css` · `grid/ColumnEditorPopover.css`

### Changed

- **ADR-288 Implemented** (G6 — 사용자 지시로 Chrome MCP 가 5173 에서 수정 7 ~ 15 확인: 행 체크박스 선택 · 일부 선택, `Insert ▾` 메뉴, 목록 행 설정 아이콘 → 표 설정 팝오버, 열 편집기 · Type Select · Styles 팝오버의 테두리 · 그림자 한 곳, 콘솔 오류 0). Preview initial 번들 +402 B gz (Preview 소스 변경 0 · chunk 분리) 는 사용자 수용. 본문은 `docs/adr/completed/288-data-panel-single-surface-column-popover-variable-table.md`.

## [ADR-288 G6 — 격자 선택 체크박스 · Insert 메뉴 · 표 설정은 목록 행 「Edit table…」] - 2026-10-29

### Fixed

- **격자 첫 열 체크박스가 선택 · 일부 선택을 구분해 보인다** (ADR-288 G6 수정 7, 사용자 「checkbox 도 selected, indeterminate 도 정상작동하지 않는다」): 행 하나를 고르면 머리글 체크박스에 대시, 모두 고르면 체크가 그려진다. 전에는 격자가 자체 사각형을 그려 두 상태가 같은 채운 사각형으로 보였다 (선택 상태 자체는 맞았다). 이제 Builder 의 다른 체크박스와 같은 부품이다.
  - 위치: `apps/builder/src/builder/panels/datatable/grid/DataGrid.components.tsx` · `grid/DataGrid.css`

### Changed

- **표 설정 · 열 편집 팝오버가 빌더 패널과 같은 모양이다** (ADR-288 G6 수정 11 · 12, 사용자 「popover 내에 스타일들이 빌더의 디자인패턴 ui 가 전혀 적용이 안 되었다」): 두 팝오버가 Design 패널 절처럼 머리줄 (표 설정 / 열 이름) 과 같은 입력칸 · 스위치 · 셀렉트로 그려진다. 겹쳐 있던 여백 (24 px) 도 하나로 줄었다. 열 편집의 타입은 검색 목록 대신 셀렉트 (트리거에 타입 아이콘) 이고, 필수는 브라우저 체크박스 대신 스위치다. 행 ⋮ · 「Insert ▾」 · 필드 템플릿 · 코드 보기 스니펫 메뉴는 테두리가 팝오버 한 겹이고 그림자가 있다 (전에는 팝오버와 메뉴가 각각 테두리 — 두 겹). 부품 교체 · 상호작용 대상 · 글꼴 목록, Styles 패널의 Fill · 그림자 · 색 · 격자 크기 팝오버, 표 설정 · 열 편집 · 변수 JSON 팝오버도 같은 그림자를 받는다. 표 설정 · 열 편집 · 변수 JSON 은 안쪽의 흰 두 번째 면이 없어졌다.
  - 위치: `apps/builder/src/builder/panels/datatable/components/TableSettingsPopover.tsx` · `grid/ColumnEditorPopover.tsx` · `components/property/{PropertyRowMenu,PropertyFieldTemplateInput}.css` · `panels/codeView/CatalogCodeViewPanel.tsx` · `panels/{properties/catalog/CatalogSwapPicker,interactions/catalog/CatalogTargetPicker,fonts/FontFamilyPicker}.css` · `components/variables/VariableTable.css` · `panels/styles/{components/FillLayerRow,sections/EffectSection,sections/GridSizePicker}.css` · `components/styles/form-controls.css`
- **격자 위 바에 「Insert ▾」 하나** (ADR-288 G6 수정 8, Supabase Table Editor 대조): 행 삽입 · 열 삽입 · CSV 가져오기가 한 메뉴에 있고, 행을 고르면 그 자리가 「Delete N rows」 로 바뀐다. 격자 아래 「Add row」 줄과 바의 「Import」 버튼은 없어졌다 (머리글 끝 + 로 열을 더하는 길은 그대로).
  - 위치: `apps/builder/src/builder/panels/datatable/grid/DataGrid.components.tsx`
- **표 설정은 목록 행의 설정 아이콘** (ADR-288 G6 수정 9 · 10, 사용자 「설정 버튼 제거하고 배치」 · 「edit, delete 버튼을 navigator-pages 처럼 바로」): 행에 마우스를 올리면 Navigator 페이지 행처럼 설정 · 삭제 아이콘이 나오고, 설정이 이름 · Use Table Data · API endpoint · Execution policy (· Interval) 를 행 아래 팝오버 (열 편집기와 같은 모양) 로 연다. 본문 헤더의 톱니 (설정 보기 전환) 는 없어졌고 헤더에는 ✕ 만 남는다. 행 이름 옆의 「6 fields · 5 rows · used by 1」 글자는 빠지고 마우스를 올리면 툴팁으로 보인다.
  - 위치: `apps/builder/src/builder/panels/datatable/components/TableSettingsPopover.tsx` (새) · `components/DataTableList.components.tsx` · `DataSurfaceBody.tsx` · `editors/DataTableEditor.tsx`

## [Button 모서리를 S2 처럼 완전히 둥글게 · Canvas 의 named hue hover · pressed 색] - 2026-10-28

### Changed

- **Button 이 S2 처럼 완전히 둥글다**: S2 `Button` 은 모든 크기에서 pill (`control({shape: 'pill'})`) 이다. Button 규칙의 크기별 모서리를 `{radius.full}` 로 바꿨다. 필드 안 버튼 (Select 트리거 · NumberField 증감 · ComboBox · DatePicker · DateRangePicker · SearchField 버튼) 은 S2 에서 Button 이 아니라 필드 버튼이라 지금 모서리를 유지한다. 모양의 주인은 여전히 Button 규칙이다 (ADR-253). 필드 안 버튼에는 파생 표지 `fieldButton` (버튼 자신의 크기) 이 붙고, Button 규칙의 크기별 표 하나를 DOM 은 `[data-field-button]` 으로, Canvas 는 정의의 조건 규칙으로 읽는다. 작성한 모서리 값은 그대로 이긴다.
  - 위치: `packages/shared/src/catalog/generated/componentRulesTable.ts` (`FIELD_BUTTON_CORNERS`) · `runtime/presence.ts` (`catalogFieldButtonSize`) · `runtime/libraryVisual.ts` (`catalogDerivedRestVisual`) · `document/derivedVariantProps.ts` · 테스트 `apps/builder/src/builder/catalogRuntime/__tests__/s2ButtonPill.test.ts`

### Fixed

- **Canvas 가 named hue 의 hover · pressed 색을 칠한다**: Badge 와 Button (premium · genai) 이 참조하는 chartreuse · celery · seafoam · brown · cinnamon · silver · purple 의 `-hover` · `-pressed` 색이 Preview 에만 있고 Canvas 색 맵에는 없었다. Preview 와 같은 식 (sRGB 에서 검정과 85 % · 75 % 섞기) 으로 Canvas 맵도 채웠다. 그래서 premium · genai Button 의 hover · pressed 표본도 Canvas 에 칠해진다. 토큰 존재 검사의 예외 목록은 비었다.
  - 위치: `packages/rendering/src/primitives/semanticPaletteMap.ts` (`resolveSemanticStateColors`) · `primitives/colors.ts` · 테스트 `packages/shared/src/catalog/__tests__/catalogTokenExists.static.test.ts`

## [Table 「Disallow Empty Selection」] - 2026-10-28

### Added

- **Table 도 마지막 선택을 지울 수 없게 할 수 있다**: S2 TableView 의 `disallowEmptySelection` 을 Table Property 의 Behavior 절에 추가했다. GridList · ListBox · TagGroup · ToggleButtonGroup · Tree 에는 이미 있었고 Table 만 빠져 있었다 (design-data 차이 보고서). 켜면 Preview · 게시 페이지에서 선택된 마지막 행을 다시 눌러도 선택이 남고, 규칙의 「전체 해제」 Do 는 실행되지 않고 이유를 알린다.
  - 위치: `packages/shared/src/catalog/bindings/Table.binding.ts` · 테스트 `apps/builder/src/preview/catalog/__tests__/tableDisallowEmptySelection.test.tsx`

## [ADR-288 Phase 2 ~ 5 — 데이터 패널 하나 · 열 편집은 머리글 팝오버 · 변수는 공용 표] - 2026-10-28

### Changed

- **Data 패널 하나가 데이터 표면이다** (ADR-288 Phase 3, 사용자 2026-10-28 「패널 사이즈를 100% 로」): 처음 열면 작업 영역 전체 폭 (캔버스를 덮는다 — 폭을 줄이면 나란히). 제목 아래 탭은 그대로 Tables · APIs · Variables (사용자 「기존의 탭형태로」) — Tables · APIs 는 왼쪽 목록 (228 px, 오른쪽 가장자리를 끌어 조절 — 폭은 기억된다) + 오른쪽 본문 (표의 격자 · API 양식 · 만들기 양식), Variables 는 변수 표가 전체 폭. 표 목록의 행은 Navigator 의 페이지 · 레이어 행과 같은 한 줄 (아이콘 · 이름 · 「Sample · 6 fields · 5 rows · used by 1」 말줄임, 행을 고르면 바로 격자가 열리고 hover 에 설정 · 삭제 아이콘 (10-29 G6 수정 9 · 10 — 메타 글자는 툴팁으로), 「새 테이블」 은 Tables 헤더의 +). API 목록과 변수 목록도 같은 패턴 (행 선택 = 열기 · 추가는 헤더 +). 「데이터테이블 에디터」 · 「필드」 패널은 없어졌다 — 저장된 레이아웃에 그 id 가 남아 있어도 그대로 열린다. 좁은 폭 (≤ 459 px) 에서는 목록과 본문이 번갈아 보이고 본문 헤더의 ✕ 가 목록으로 돌아간다.
  - 위치: `apps/builder/src/builder/panels/datatable/{DataTablePanel,DataSurfaceBody}.tsx` · `panels/core/{panelConfigs,types}.ts` · `stores/dataTableEditorStore.ts`
- **열 정보는 머리글 팝오버에서 바꾼다** (ADR-288 Phase 4, 사용자 「패널 형태로 수정해야 한다. 불편하다」): 열 이름 · ⌄ 를 누르면 그 열 아래에 이름 · 타입 (검색) · 참조 대상 · 필수 · 라벨 · 기본값 · 사용처 · 삭제가 열리고, 타입 아이콘을 누르면 타입 검색에 바로 포커스. Esc · 바깥 클릭으로 닫힌다. 더블클릭 · F2 의 그 자리 이름 편집은 그대로.
  - 위치: `apps/builder/src/builder/panels/datatable/grid/ColumnEditorPopover.tsx` · `grid/DataGrid.components.tsx`
- **변수는 세 소유자가 같은 표에서** (ADR-288 Phase 2, 사용자 「variables 도 table 형태로」 · 「page 내에서도 동일하게」): Data 패널의 프로젝트 변수와 Design 패널 State 절의 페이지 · 요소 변수가 한 표 (이름 · 타입 · 시작값 · 유지 (프로젝트만) · 사용처 · ⋮) 에서 그 자리에서 편집된다. Data 패널의 「보기」 를 「모든 변수」 로 두면 페이지 · 요소 변수가 읽기 전용 행으로 함께 보이고 「소유자에서 편집」 이 그 요소를 선택해 State 절을 연다. 페이지 · 요소의 Object · Array 시작값은 「규칙이 정함」 (규칙이 채운다), JSON 시작값은 프로젝트 변수만.
  - 위치: `apps/builder/src/builder/components/variables/VariableTable.tsx` · `panels/datatable/components/VariableList.tsx` · `panels/properties/catalog/CatalogStateSection.tsx`

### Removed

- `DataTableEditorPanel` · `DataTableFieldPanel` · `VariableEditor` (사용자 승인 2026-10-28) — 내용은 위 세 부품으로 옮겼다.

### Performance

- 번들: Builder initial JS gzip +556 B (ADR-288 상한 +1,000) · CSS −393 B. Design 패널의 변수 표는 lazy 로 받는다 (RAC Table 을 initial 에 넣으면 +16.9 KB). Preview initial +402 B gz 는 `createLucideIcon` 이 공용 chunk 로 분리된 결과 (Preview 소스 변경 0).

## [ADR-288 Phase 1 — 변수 이름 변경이 참조를 따라간다 · 타입 변경 규칙 하나] - 2026-10-28

### Fixed

- **변수 이름을 바꾸면 그 변수를 읽던 `{{ 이름 }}` 이 같이 바뀐다** (ADR-288 Phase 1): 전에는 변수 entry 의 이름만 바뀌어 Text 에 `{{ 옛이름 }}` 이 그대로 찍혔다. 프로젝트 · 페이지 · 요소 변수 모두, Design 패널 State 절 · Data 패널 · 코드 보기 어디서 바꿔도 한 명령 (`renameVariable`) 이고 Undo 한 번에 돌아온다. 재작성은 그 자리에서 런타임이 이름을 그 변수로 해소할 때만 — 요소의 글자 prop 은 요소 → 조상 → 페이지 → 프로젝트 사슬, `binding.key` 는 페이지 · 프로젝트, API endpoint 의 URL · query · header · body 템플릿은 프로젝트 변수만. `\{{` 리터럴 · `{{ env.x }}` · 변수가 없는 `{{ params.x }}` 는 그대로.
  - 새 이름이 기존 `{{ 이름 }}` 을 가로채게 되면 (예: 프로젝트 `a` 를 읽는 페이지에서 페이지 변수를 `a` 로) 거절하고 안내한다 (`operation.variableNameShadows`); 보이는 범위에 같은 이름이 있으면 `operation.variableNameConflict`. 이름 충돌 검사가 프로젝트 변수까지 본다.
  - 위치: `packages/shared/src/catalog/runtime/variableReferences.ts` · `packages/shared/src/catalog/commands/variables.ts` · `packages/shared/src/state/template.ts` (`rewriteStateTemplateRoots`) · `apps/builder/src/builder/catalogRuntime/{stateVariables,dataVariables,codeView,catalogDataStore,operationNotice}.ts`

### Changed

- **변수 타입 변경 시 시작값 규칙 하나** (ADR-288 결정 1, 사용자 2026-10-28): 새 타입에 맞는 값은 변환해 두고 (`"42"` → `42` · `"true"` → `true`), 안 맞으면 비운다. 전에는 프로젝트 변수는 `"hi"` 가 Number 변수에 남고 페이지 · 요소 변수는 늘 비웠다. 사용처 수도 이름 변경과 같은 판정으로 센다 (interaction + 템플릿).
  - 위치: `packages/shared/src/catalog/runtime/variableTypeChange.ts` · `apps/builder/src/builder/stores/utils/dataChange.ts` (`define_variable`) · `catalogRuntime/stateVariables.ts` (`setType`)

## [ADR-286 사이트 설정을 페이지 `<head>` 에 · 변수 편집기 모양 복구] - 2026-10-28

### Added

- **사이트 설정이 Preview · 게시 페이지에 적용된다**: 보이는 page 의 제목 (없으면 사이트 제목) · 설명 · favicon (밝은 · 어두운) · 사이트 언어 (`<html lang · dir>`) 가 Preview 와 게시 페이지 (Builder 의 Preview 버튼 포함) 의 `<head>` 에 들어간다. 사이트 favicon 이 있는 동안 페이지 자신의 아이콘은 빠졌다가 지우면 돌아온다.
  - 위치: `packages/shared/src/catalog/runtime/documentHead.ts` (`useCatalogDocumentHead`) · `apps/builder/src/preview/PreviewLocale.tsx` · `apps/publish/src/App.tsx`
- **앱 아이콘 · 앱 이름 · 테마 색 (사이트 패널)**: 휴대폰 · 데스크톱의 바로 가기 설치용. `apple-touch-icon` · `theme-color` 를 싣고, 게시 페이지에는 Web App Manifest (아이콘 192 · 512 PNG · standalone · 시작 주소 = 게시 주소) 를 만든다. Builder Preview 와 끌어 놓은 파일은 주소가 탭보다 오래 살지 않아 manifest 를 만들지 않는다.
  - 위치: `apps/builder/src/builder/panels/site/SitePanel.tsx` · `packages/shared/src/catalog/document/{types,validation}.ts` (`appIcon` · `appName` · `themeColor`)

### Fixed

- **Canvas 빈 곳 클릭이 Site 패널을 닫던 결함**: Settings 에서 분리할 때 빠진 유지 목록에 site 를 넣었다.
  - 위치: `apps/builder/src/builder/layout/panelWorkspaceVisibility.ts`
- **변수 편집기 모양 복구**: Data 패널에서 변수를 열면 칸 간격이 없고 라벨이 16px 로 다른 패널과 달랐다. 편집기가 빌려 쓰던 `.basic-editor` · `.field-description` 이 9-12 API 편집기 재작성 (`f9838b34e`) 때 지워졌고, 편집기가 패널 표준 `Section` 밖이라 필드 모양도 걸리지 않았다. 이제 「Variable」 절 안에 그려지고 Object · Array 의 JSON 입력칸에도 「Default Value」 라벨 · 포커스 표시 (`--focus-ring`) · 잘못된 값 테두리가 붙는다.
  - 위치: `apps/builder/src/builder/panels/datatable/editors/VariableEditor.{tsx,css}` · 정적 게이트 `editors/__tests__/variableEditorClasses.static.test.ts`

## [패널 구조 정리 — lazy 패널 선로드 복구 · 명령 실행 단일화] - 2026-10-28

### Fixed

- **화면 밖 패널이 다시 바로 열린다**: History · Settings · Site · Interactions · Theme · Data 패널 chunk 를 부팅 뒤 idle 에 미리 받는다. ADR-248 삭제 3차 (`0b0eaea28`) 가 옛 `usePageManager` 와 함께 호출을 지워, 이 패널들은 첫 열림마다 Suspense 공개 지연 (~300 ms, ADR-242 실측) 을 다시 겪고 있었다.
  - 위치: `apps/builder/src/builder/main/CatalogBuilderCore.tsx` · `panels/core/panelConfigs.ts` (`preloadOffscreenPanels`)
- **패널 편집의 거부 안내 통일**: Properties 의 「변수로 정하기」 · RAC slot · 표시 조건 섹션은 거부 (잠긴 Library 등) 를 안내 대신 일반 오류 toast 로 냈고, Theme · Settings (페이지 그리드 · toast 위치) · Canvas page 위치 편집은 오류를 잡지 않아 이벤트 핸들러 밖으로 던졌다. 모든 패널 명령이 한 runner 를 지난다.
  - 위치: `apps/builder/src/builder/catalogRuntime/commandRunner.ts` (`useCatalogCommandRunner` · `runCatalogCommand` · `runBuiltCatalogCommand` — `panels/navigator/catalog/` 에서 이동) · 정적 게이트 `panels/core/panelCommandRunner.static.test.ts`
- **절 Reset 이 마지막 값으로 되돌린다**: `Section` 의 memo 가 `onReset` 의 유무만 비교해, 같은 children 으로 다시 그릴 때 새 Reset 콜백이 버려지고 옛 클로저가 실행될 수 있었다 (참조 비교로).
  - 위치: `apps/builder/src/builder/components/panel/Section.tsx`

### Changed

- **앱 toast 위치가 Site 패널로**: Preview · Publish 앱의 값이라 Builder 설정 (Settings) 에서 Site 패널의 「App」 절로 옮겼다 (사용자 결정 2026-10-28). 필드 · 동작은 같다. 페이지 레이아웃도 함께 Site 로 옮겼다가, Canvas 의 페이지 배치라 Builder 설정에 두기로 해 같은 날 Settings 의 「Page Layout」 절로 되돌렸다 (사용자 결정) 이때 Page Gap 과 Column Count 를 한 줄에 두었다 (tier 스위치는 아래 줄).
  - 위치: `apps/builder/src/builder/panels/site/SitePageSections.tsx` (+ `useCatalogToastPlacement` 이동) · `panels/settings/SettingsPageLayoutSection.tsx` (+ `useCatalogPageLayout`)
- **아이콘이 빠진 스위치 8곳에 아이콘**: 라벨 위 · 아이콘 + 스위치 형식인데 아이콘이 없던 스위치에 Settings Canvas 절처럼 아이콘을 붙였다 — Interactions 「Show more events」 · 상속 규칙 「Enabled」, Design 패널 Slot 절 「Slot」 · 「Required」, Page 「Hide from search」 · 「Hide from sitemap」 (Site Search 절과 같은 그림), Calendar 「Month and Year Pickers」, 숫자 형식 「Grouping」, Data 패널 API 「Upload live」 (사용자 2026-10-29).
- **색 값 표기를 `#` 없는 대문자로 통일 · Site 이미지 버튼 아이콘 제거 · Search 스위치 아이콘**: Fill 행만 `#123456` 이고 Border · Shadow · Theme color · 피커 HEX 칸은 `123456` 이던 것을 `#` 없는 표기로 맞췄다 (알파가 있으면 8자리 — Border 와 같다). Site 패널 「Choose image…」 앞 이미지 아이콘을 뺐고, Search 절 Search indexing · Sitemap 스위치에 Settings Canvas 절처럼 아이콘을 붙였다 (사용자 2026-10-29).
- **Site 패널 이미지 · 테마 색 필드가 다른 필드와 같은 모양**: Favicon · App icon · Social image (Page social image 포함) 필드는 다른 필드와 같은 28 높이 — 안쪽 견본 20 · 「Choose image…」 는 바탕 없는 글자 버튼 (Styles Fill 행과 같은 어법). Theme color 는 hex 글자 칸 대신 Design 패널의 색 입력 (견본 + 값 · 같은 피커 · 문서 색 팔레트) 이고, 값이 있으면 액션 칸 「−」 로 지운다. 값이 없는 색 입력은 placeholder 색을 흐린 글자로 보인다 — 종전엔 검정 견본이라 설정된 것처럼 보였다 (사용자 2026-10-29). Redirects 의 「Add redirect」 는 절 머리줄 「+」 (다른 절과 같은 투명 아이콘 버튼).
- **7칸 격자 적용 뒤 어긋난 세 곳 수리**: 절에 바로 놓인 한 필드를 액션 칸만큼 줄이는 규칙이 격자로 배치하는 절의 칸까지 줄였다 — Text 탭 Typography 칸이 84 → 48 (색 칸 28 → 0), Layout 절 Padding 줄이 안쪽 3 · 3 · 1 을 176 안에 접어 위 행과 경계가 어긋났다. 두 곳은 그 규칙을 끄고 84 · 84 · 28 로 돌아왔다. Screen 탭 Overrides 머리줄 「+」 는 다른 절 머리줄과 같은 투명 버튼이 됐다.
- **패널 행이 하나의 7칸 격자를 따른다**: Design 패널 Layout 절의 격자 (`1fr 1fr 28` — 28 단위 3 · 3 | 1) 를 모든 패널의 행 기준으로 삼아, 행 모양을 넷 (두 필드 + 액션 · 두 필드 · 한 필드 + 액션 · 한 필드) 으로 맞췄다. 7번째 액션 칸은 버튼이 없어도 비워 둔다 — 앞으로 편의 기능이 들어갈 자리 (사용자 결정 2026-10-28). Settings · Site 의 두 칸 행 (반씩 102 · 102) · Interactions 규칙 행 · State 변수 행 (`2fr 1fr 28`) 이 84 · 84 로, 절에 바로 놓인 한 필드 · 추가 버튼 (Site · Theme · Settings 에서 7칸 전체 212) 이 176 으로 바뀌었다.
  - 위치: `apps/builder/src/builder/components/styles/{panel-system,inspector-layout}.css` · `panels/site/SitePanel.css` · `panels/interactions/InteractionsPanel.css` · `panels/properties/state/StateSection.css`
  - 같은 규칙으로: 그림자 레이어 행은 Fill 행처럼 제거 「−」 가 본문 안, 액션 칸은 inset 토글 하나 — 「INSET · OUTER」 글자 꼬리표는 지웠다 (토글 아이콘이 상태를 보인다). Settings 페이지 레이아웃의 가로 · 세로는 아이콘 (176 칸에서 「Horizontal」 이 잘렸다), Theme 색 견본은 6열 (208) → 5열 (172). Navigator · Components 패널은 격자 예외 (사용자 결정).
  - 위치: `panels/styles/components/BoxShadowLayerRow.tsx` · `panels/styles/sections/EffectSection.css` · `components/property/PropertySizeToggle.tsx` (선택지 `icon`) · `panels/settings/SettingsPageLayoutSection.tsx` · `panels/themes/ThemesPanel.css`
- **Effect 절의 세 효과가 기본 「없음」 · 머리줄 「+」 로 추가**: Opacity · Box Shadows · Filters 는 값이 있을 때만 각자 묶음 (legend + 내용, 패널 표준 fieldset 구조) 으로 보인다. 묶음 순서는 Opacity · Filters (Blur) · Box Shadows. 추가는 절 머리줄 「+」 메뉴 하나 (같은 순서 — Opacity · Blur · Box Shadows · 그림자 프리셋 S/M/L, 컴포넌트 size 와 같은 표기 · 이미 있는 Opacity · Blur 는 비활성), 지우기는 각 행의 「−」. Opacity 행은 [슬라이더 176][− 28] (사용자 결정 2026-10-28).
  - Why: 「Box Shadows」 · 「Filters」 제목이 legend 가 아닌 글자 줄 (+ 그 줄의 추가 버튼) 이었고 절 본문 자체를 격자로 잡아 패널 구조 규칙 (fieldset-legend + 내용 · `.section-content` 1열) 을 벗어났다. 추가 버튼을 묶음 안에 두면 효과가 없을 때 내용 없는 legend 가 남아 머리줄로 옮겼다. Opacity 도 기본 100 % 라 「없음」 과 같아 행을 늘 보일 이유가 없었다.
  - 위치: `apps/builder/src/builder/panels/styles/sections/EffectSection.{tsx,css}` · `components/styles/inspector-layout.css` · `components/property/PropertyRowMenu.tsx` (`quiet` — 머리줄 투명 트리거) · `panels/styles/hooks/useAppearanceValues.ts` (opacity 없음 = `""`)
- **패널 제목 · 아이콘 피커 · 테마 토글이 언어 설정을 따른다**: Components · AI · Interactions 패널 제목이 메뉴 · 레일과 같은 번역 라벨이 됐다 (AI 패널 제목 「AI Assistant」 → 「AI」). 아이콘 피커의 검색 · 개수 문구와 테마 패널의 라이트 · 다크 토글 이름도 번역된다. Site 페이지 레이아웃의 방향 라벨은 Styles 와 같은 「방향」.
  - 위치: `apps/builder/src/builder/panels/{components/ComponentList,ai/AIPanel,interactions/catalog/CatalogInteractionsPanel,icons/IconPickerPopover,themes/ThemesPanel}.tsx` · `src/i18n/translations.ts`
- **Fill 행이 Layout 절과 같은 격자에 선다**: 행 오른쪽 액션 묶음에 눈 · 제거 두 버튼이 있어 열이 `152 · 52` 로 인스펙터 행 템플릿 (`1fr 1fr 28` — Layout 절의 7칸 격자 3 + 3 | 1) 을 벗어났다. 행 안의 opacity scrub 을 지우고 그 자리에 제거 「−」 를 두어, 본문은 두 칸 · 액션 칸은 눈 토글 하나가 됐다 (사용자 결정 2026-10-28). 단색 fill 의 opacity 는 팝오버의 피커 알파로 바꾼다 — 그래디언트 · 이미지 fill 의 레이어 opacity 칸은 이제 없다.
  - 위치: `apps/builder/src/builder/panels/styles/components/FillLayerRow.{tsx,css}`

### Removed

- **Data 패널 헤더의 새로고침 버튼**: ADR-286 로 데이터 정의가 문서에 들어온 뒤 다시 불러올 대상이 없어 눌러도 아무 일도 하지 않았다. 함께 빈 store 액션 `fetchCollections` · `fetchApiEndpoints` · `fetchVariables` 와 패널 공통 props (`isActive` · `side` · `displayMode` · `onClose` — 고정값이라 읽는 패널이 없었다) 를 지웠다.
  - 위치: `apps/builder/src/builder/panels/datatable/DataTablePanel.tsx` · `stores/data.ts` · `panels/core/types.ts` (`PanelProps`)

## [개발용 계측 버튼 제거 — ADR-187 Phase 6 후속 정리] - 2026-10-28

### Removed

- **Builder dev의 숨김 버튼 4개 제거**: `<html>` 바로 아래에 생성하던 성능 계측 제어 버튼을 제거했다. 기존 계측 API와 DOM 이벤트는 유지한다.
  - **Why:** 실제 측정 스크립트는 계측 API를 직접 사용하며 버튼을 호출하는 제품 경로가 없다.
  - 위치: `apps/builder/src/builder/performance/editorPresentationPhase0Metrics.ts`

## [ADR-286 Phase 0 ~ 4 — 데이터 정의 · 사이트 · 페이지 설정을 catalog 문서로] - 2026-10-28

### Added

- **「사이트」 패널**: 사이트 제목 · 설명 · 언어 · favicon (밝은 · 어두운) · 공유 이미지 · 검색 노출 · sitemap · robots · redirect (위가 먼저 — 행 메뉴로 순서 · 301/302 · 제거) · 접근 (누구나 · 비밀번호 · SSO — OIDC/SAML · issuer · metadata URL · client id · 보호할 페이지). 비밀 (비밀번호 · client secret · 인증서) 은 문서에 저장하지 않고 게시 서버 설정에 둔다 — 입력 칸이 없다. 게시 사이트 반영은 다음 phase. 전체 메뉴의 「Site」.
  - 위치: `apps/builder/src/builder/panels/site/` · `packages/shared/src/catalog/commands/project.ts` (`setSiteSettings`) · `catalog/runtime/siteMeta.ts`
- **페이지 「검색 · 공유」**: Navigator 의 page 설정 (Design 패널 page 섹션) 에 페이지 제목 · 설명 · 공유 이미지 · 검색 · sitemap 에서 숨김. 비우면 사이트 값.
  - 위치: `apps/builder/src/builder/panels/properties/catalog/CatalogPageMetaSection.tsx`

### Changed

- **데이터 표 · API endpoint · 프로젝트 변수가 프로젝트 문서 안에**: 정의 (schema · 샘플 행 · 요청 · 시작값) 편집이 문서 명령 한 단계라 Undo · 저장 · 프로젝트 파일 · 코드 보기 · Preview · 게시가 같은 값을 본다. 샘플 행은 표당 1,000 행까지. API 로 받은 행은 문서 밖 (캐시) 그대로.
  - 위치: `packages/shared/src/catalog/document/{types,validation,graph}.ts` · `catalog/commands/data.ts` · `apps/builder/src/builder/catalogRuntime/{catalogDataStore,catalogDataRead}.ts` · `stores/utils/{dataChange,dataActions}.ts`
- **Canvas 가 데이터 편집을 바로 따라온다**: 샘플 행 · 프로젝트 변수 시작값을 바꾸거나 Undo 하면 바운드 목록 · `{{ }}` 글자가 같은 단계에서 다시 그려진다 (store 구독 없이).
  - 위치: `packages/shared/src/catalog/runtime/compositionRoot.ts` (`dataReaderRoots`)
- **page 의 Locale 칸 삭제 → 사이트 언어**: page 루트의 Locale 대신 사이트 「언어」 가 page 의 locale (날짜 · 숫자 형식) 이고 Canvas 도 그 값으로 그린다. frame 의 Locale (부분 덮어쓰기) 은 그대로.
  - 위치: `packages/shared/src/catalog/bindings/Body.binding.ts` · `catalog/runtime/compositionRoot.ts` (`siteLocale`)
- **보호 페이지 삭제**: SSO 보호 목록에 든 page 를 지우면 목록에서도 빠지고 Undo 로 함께 돌아온다.
- **프로젝트 파일**: 데이터는 문서 part 안 (part 5 → 2). contract 51 — 이전 형식의 로컬 프로젝트 · 파일은 열리지 않는다 (개발 단계 정책, 변환 없음).

### Removed

- IndexedDB 데이터 store 3 (`collections` · `api_endpoints` · `variables` — DB_VERSION 26) · 데이터 history recorder (`dataHistory.ts`) · 변수 소유자 이관 (`variableOwnerMigration.ts`) · `endpointTarget.ts` · `importCollectionEnvelope.ts`.

### Known

- 번들: Builder initial gzip +5,977 B (ADR 상한 +1,000 초과 — 사용자 수용) — 모듈 합계는 −1,115 B raw, initial 파일 101 → 117 로 분할된 몫. Preview −85 B.

## [ADR-287 Implemented — Interactions 의 Do 가 컴포넌트마다 레퍼런스 API 대로] - 2026-10-28

### Changed

- **ADR-287 Implemented**: 사용자 Builder 확인 (G5). 본문은 `docs/adr/completed/287-interactions-do-from-reference-api.md` (`### Live Exercise` 5 시나리오).
- **template 부품 전달의 비용**: Do 가 쓴 prop 을 template 부품에 전달하는 경로가, 쓴 key 를 묶는 부품이 template 에 없으면 record 를 걷지 않는다 — 바운드 행이 많은 목록의 선택 변경 · 입력칸의 글자 입력마다 하위 record 전체를 훑던 것 (수신자 조회 3 회로 고정, 항목 수 무관).
  - 위치: `packages/shared/src/catalog/runtime/catalogPreviewInteractions.ts` · 게이트 `apps/builder/src/preview/catalog/__tests__/adr287Reach.test.tsx`

## [ADR-287 Phase 0 ~ 4 — Interactions 의 Do 가 컴포넌트마다 레퍼런스 API 대로] - 2026-10-28

### Added

- **컴포넌트 고유 Do**: Interactions 의 Do 목록이 공통 3 (보이기 · 숨기기 · 전환) 뿐이던 표시 컴포넌트에도 그 컴포넌트의 prop 마다 Do 가 나온다 — Meter · ProgressBar · ProgressCircle 의 「값 설정」 · 「minValue 설정」, Badge 「variant 설정」, ProgressBar 「isIndeterminate 켜기 · 끄기 · 전환」, Button 「children 설정」 등 (유도 1,074). 값 입력은 prop 종류대로 — 숫자 · 글자 · 아이콘 · 선택 목록 (catalog 의 choice). 라벨은 prop 이름을 넣는다 (「minValue 설정」 · 「Set minValue」).
  - 위치: `packages/shared/src/interactions/referenceCapabilities.ts` · `capabilityRegistry.ts` · `apps/builder/src/builder/panels/interactions/{labels.ts,ValueField.tsx,CapabilityPicker.tsx,catalog/CatalogEventRow.tsx}`
- **「변수로 정하기」 number · choice**: Meter `value` 를 숫자 변수에, `variant` 를 글자 변수에 연결할 수 있다. 선택지 밖 값이면 정의 값으로 그리고 경고 1 회.
  - 위치: `apps/builder/src/builder/catalogRuntime/propFollow.ts` · `panels/properties/catalog/CatalogPropFollowSection.tsx` · `packages/shared/src/catalog/document/graph.ts` · `catalog/runtime/compositionRoot.ts`

### Changed

- **template 이 묶은 prop 의 Do 가 부품에 닿는다**: Meter `label` 을 바꾸는 Do 가 Label 부품의 글자를 바꾼다 (Preview 실행 상태 — 문서 · Canvas 무변경). Button · ToggleButton 의 `children` Do 는 `label` 에 쓴다 (글자가 덧붙지 않음).
  - 위치: `packages/shared/src/catalog/runtime/catalogPreviewInteractions.ts`
- **자기 disabled · read-only Do**: 노드 자기 `isDisabled` · `isReadOnly` 의 켜기 · 끄기는 자기 값이 막지 않는다 (조상 frame 의 disabled 는 그대로 막음).
- **코드 보기**: 규칙 Do 가 쓰는 prop 을 RAC 모양 (`let [meterValue, setMeterValue] = useState(40)` · `<Meter value={meterValue}>`) 으로 내고, setter 호출 편집을 그 Do 로 읽는다.
  - 위치: `packages/shared/src/codeView/{generate.ts,vocabulary.ts,types.ts}` · `apps/builder/src/builder/catalogRuntime/codeViewEdit.ts`
- **`selectionMode: none` 목록의 선택 Do**: ListBox · GridList · Table · Menu · TagGroup · CardView 가 선택 모드 없음이면 「항목 선택」 · 「항목 선택 해제」 · 「선택 해제」 를 모두 숨기고 「선택 모드를 켜면 선택 기능이 나옵니다」 를 보인다 (전엔 「항목 선택」 만 숨었다). 실행은 그대로 — 해제 · 전체 해제는 RAC 가 받는 초기화.
  - 위치: `packages/shared/src/interactions/exposure.ts` · `apps/builder/src/builder/panels/interactions/CapabilityPicker.tsx`

## [페이지 헤더 Code 토글] - 2026-10-28

### Added

- **페이지 헤더 Code 버튼**: Canvas 페이지 헤더의 제목 뒤 · × 앞에 Code 토글 — 누르면 그 페이지를 현재 페이지로 하고 「코드」 패널을 열고 닫는다 (전체 메뉴 Code 와 같은 패널 토글). 눌림 상태는 패널 열림을 그대로 따라 전체 메뉴 · 패널 × 로 닫아도 함께 꺼진다. 좁은 헤더 (compact 티어) 에서는 다른 액션처럼 숨는다.
  - 위치: `apps/builder/src/builder/workspace/canvas/overlay/pageHeader/PageHeaderLayer.{components.tsx,runtime.ts,css}` · `workspace/canvas/catalog/CatalogCanvas.tsx`

## [ADR-285 Implemented — 코드 편집이 닫힌 어휘 전체에서 문서로] - 2026-10-27

### Changed

- **ADR-285 Implemented** (G5): 사용자 지시 「ADR-285 G5 부터」 로 G5 의 세 시나리오를 별도 dev 서버 (5174) 에서 Chrome MCP 로 재확인 — `<Text>` 한 줄 추가 → Canvas 에 글자 · 「스니펫 → Add search · company」 가 변수 · 조건 · 규칙을 코드로 넣고 Preview 에서 10 행 → 3 행 · 두 요소 줄 삭제 → Canvas 에서 사라지고 ⌘Z 한 번에 복원 · 콘솔 오류 0 (live 12/12 · 지적 0). 본문을 `docs/adr/completed/` 로 옮기고 README 완료 표 (306) · 권장 착수 순서 표에 반영했다. 후속 ADR-286 (코드의 소스 = 단일 catalog) 의 선행 조건 충족.
  - 위치: `docs/adr/completed/285-code-view-closed-vocabulary-round-trip.md` · `docs/adr/README.md` · `docs/adr/design/285-code-view-closed-vocabulary-round-trip-breakdown.md`

## [ADR-285 Phase 1 ~ 4 마무리 — 코드의 모든 어휘가 문서로 · 스니펫] - 2026-10-27

### Added

- **코드로 고칠 수 있는 범위 = 생성하는 어휘 전체**: 목록의 보기 (조건 · 「또는」 묶음 · 정렬 · 묶기 · 결과 수 · 적용 조건 수 · 합계류), API 목록의 요청 매개변수 (`url.searchParams`), 행 필드를 읽는 글자, 규칙의 목록 명령 (추가 · 수정 · 이동 · 삭제 · 다시 불러오기 …) · endpoint 호출 · 선택 비우기, 값 조건 prop (`isDisabled={count >= 3}`), `useDragAndDrop` 의 drop 규칙, 목록 선택 변수를 코드에서 고치면 같은 명령 한 step 으로 반영된다. 코드에 `<ListBox items={users}>` 를 적으면 새 목록이 데이터에 연결된다.
- **「스니펫」**: 「코드」 패널 편집 중 메뉴 (와 자동완성) 에서 「검색 추가」 · 「라디오로 거르기」 · 「정렬 따라가기」 · 「결과 수 표시」 · 「API 요청 매개변수」 를 고르면, Data 패널의 같은 동작을 지금 초안 위에서 실행한 코드가 다른 줄만 바꿔 들어온다 — 적용하면 패널로 한 것과 같은 문서.

### Fixed

- 코드에서 한 요소의 태그를 다른 태그로 바꿔 적으면 (`<Text>` 줄 → `<ListBox …>`) 같은 요소로 짝지어져 거절되던 것 — 태그가 다르면 지우고 새로 넣는다.
- 여러 명령을 묶은 명령 안에서 프로젝트 기록을 쓴 뒤 라이브러리를 읽으면 던지던 것 (`stageOver` 가 감싼 stage 에 `libraryFor` 위임).

### Changed

- 「코드」 패널을 열면 편집기가 바로 뜬다 (「코드 고치기」 버튼 제거 — 사용자 제안). 아무것도 입력하지 않은 동안은 Canvas · 다른 패널의 변경을 따라 코드가 바뀌고 (스크롤 · 커서 유지), 첫 입력부터 그 시점의 코드를 기준으로 편집이 잡힌다. 「적용」 은 바뀐 것이 있을 때만 켜지고, 「취소」 는 「변경 취소」 (현재 코드로 되돌림) 가 됐다.
- 편집기 안의 ⌘Z · ⌘⇧Z: 입력한 글자의 단계가 있으면 그것을 되돌리고, 없으면 문서의 Undo · Redo (History 와 같은 하나의 기록) 로 가고 편집기가 따라간다. 전에는 편집기 안에서도 ⌘Z 가 늘 문서를 되돌려, 입력 중인 초안이 낡아 적용이 거절됐다.

### Performance

- Builder initial JS gzip Δ +269 B (ADR-285 전체) — 거절 문구는 「코드」 패널 chunk 의 지역 사전, 스니펫의 패널 동작은 registry 로 받아 Data 패널 모듈이 main chunk 에서 쪼개지지 않게 했다.

## [ADR-285 Phase 1 · 2 · 3 — 「코드」 패널에서 코드를 고치면 문서가 바뀐다] - 2026-10-27

### Added

- **「코드」 패널 편집 = CodeMirror 6 편집기** (사용자 보고 「code 에서 edit 시에 오류발생한다」 — 빈 page 에 `<Text>Text</Text>` 를 적으면 「a change outside the marked parts」 로 거절되던 것): 「코드 고치기」 로 편집을 시작하고 Apply 하면 요소 추가 (팔레트와 같은 원본) · 삭제 (읽는 이벤트 · 파생 보기와 함께) · 이동 (잘라 붙이기 · 순서 바꿔 붙여넣기 — 스타일 · 이벤트 보존) · prop · 글자 · 이벤트 (`onX={setX}` · Set state · toast · navigate) · 변수 (`useState` 추가 · 이름 · 시작값 · 삭제) · 목록 보기의 `filter` 항이 문서에 반영된다 (Undo 한 번). 자동완성은 팔레트 이름 · 변수 · setter · 데이터 · 필드만, 받지 못하는 줄은 입력 중 밑줄 + 이유 · 대안.
- **부분 적용 0**: 적용 전에 명령을 미리 실행한 문서의 코드가 편집본을 그대로 돌려주는지 대조한다 — 하나라도 다르면 그 줄 · 이유 · 대안 (KO/EN) 을 보이고 아무것도 바꾸지 않는다. 편집을 시작한 뒤 Canvas 에서 문서가 바뀌면 적용하지 않고 「다시 불러오기」 를 낸다 (초안 보존).
- 아직 코드로 고칠 수 없는 어휘 11 (정렬 · 묶기 · 집계 · 드래그 · 값 조건 prop · 목록 명령 Do …) 은 고치면 거절, 그대로 두면 통과 (`vocabulary.ts` pending).
  - 위치: `packages/shared/src/codeView/{generate,writer,types,vocabulary}.ts` · `codeView/inverse/{parse,identity}.ts` · `apps/builder/src/builder/catalogRuntime/codeViewEdit.ts` · `panels/codeView/{CodeEditor,CatalogCodeViewPanel}.tsx` · `catalog/runtime/compositionRoot.ts` (`execute` 의 `expectedRevision`) · `i18n/translations.ts`

## [ADR-285 Phase 0 — code view 역변환 착수 · 파서 결정] - 2026-10-27

### Changed

- **ADR-285 Accepted · Phase 0 (G0)**: 코드 편집을 닫힌 어휘 전체로 넓히는 작업의 착수 측정. 생성기 emit 지점 전수를 어휘표로 freeze 하고, 파서를 실측해 사용자 결정 4 = **lezer 하나** — CodeMirror 6 이 싣는 `@lezer/javascript` 가 생성 코드 golden 5 를 오류 0 으로 읽어 `@babel/parser` (+78.9 KB gz) 를 더하지 않는다 (acorn 은 `import {type Selection}` 에서 실패). 의존 `@codemirror/*` 8 (Builder) · `@lezer/common` · `@lezer/javascript` (shared) 를 catalog 고정 버전으로 선언 (아직 import 0 — Builder initial 무변경). RED 11 (`adr285CodeViewRoundTrip.test.tsx` — 요소 추가 · 「검색 추가」 코드 · 조건 항 · 삭제 · 순서 · identity 4 · 편집 중 Canvas 변경 · 파생 줄) 이 오늘의 「자리 밖」 거절을 고정.
  - 위치: `pnpm-workspace.yaml` · `apps/builder/package.json` · `packages/shared/package.json` · `apps/builder/src/preview/catalog/__tests__/adr285CodeViewRoundTrip.test.tsx` · `docs/adr/285-*.md` · `docs/adr/design/285-*-breakdown.md`

## [Design 패널 Layout — ProgressBar · Meter · Slider 의 grid 를 grid 로] - 2026-10-27

### Fixed

- **ProgressBar · Meter · Slider 의 Display 가 grid 구조인데 flex column 으로 보이던 것** (사용자 보고):
  - **Why**: 라벨 위치 컨테이너의 Display 토글이 실제 상자가 아니라 prop 고정 규칙 (`labelPosition` top = column · side = row) 을 보였다. 이 셋의 top 은 catalog 에서 grid (`"label value" "bar bar"`) 라 grid 구조가 비활성 flex column 으로 읽혔다.
  - 수정: top 이 grid 인 라벨 위치 컨테이너 (catalog rule 의 기본 `display` 에서 유도) 는 Display 가 grid 를 보이고 두 상태를 grid = top · row = side 로 고른다 (column 은 이 셋에 없어 비활성). Gap 은 grid 칸 (Gap X · Gap Y) 으로 실제 `columnGap` · `rowGap` 을 보이고 (종전 Gap 한 칸은 4 만), Columns · Rows 는 catalog 영역이라 보이기만 한다 (격자 선택기 없음).
  - 위치: `apps/builder/src/builder/panels/styles/{utils/orientationDrivenTags.ts,hooks/useLayoutAuxiliary.ts,hooks/useStyleActions.ts,sections/LayoutSection.tsx}`

## [Interactions 패널 — 「Rule」 을 RAC 어휘 「Event」 로] - 2026-10-27

### Changed

- **Interactions 패널 어휘를 RAC 문서에 맞췄다**: RAC 는 이 축을 `## Events` 절 · 「Handler that is called when…」 으로 부르고, 「rule」 은 Form 검증 규칙 (`validate`) 에만 쓴다. 섹션 제목 Rules → Events (규칙 → 이벤트) · 빈 상태 · 삭제 라벨 · History 라벨 (이벤트 추가 · 편집 · 삭제) · AI 도구 라벨을 같이 바꿨다. code view 의 When 편집이 History 에 원문 「Edit rule」 로 남던 것도 「Edit event」 로 보인다.
- **숨은 이벤트 토글** 「Show all of RAC」 → 「More events / 이벤트 더 보기」 — 구현 이름을 보이지 않고, keyboard 는 켜도 안 열리므로 「all」 도 빼었다.
- **Add event 는 Events 섹션 헤더의 `+`** (State 섹션과 같은 `actions` 슬롯) — 목록 끝 점선 버튼을 없앴다. 제목 옆 개수는 Components 패널과 같은 개수 상자 (`.category-count`, panel-system 으로 올리고 `min-height` 제거).
  - 위치: `panels/interactions/catalog/{CatalogInteractionsPanel,CatalogEventRow}.tsx` (`CatalogRuleRow` 개명) · `TriggerPicker.tsx` · `i18n/{translations,types}.ts` · `catalogRuntime/codeView.ts` · `components/styles/panel-system.css` · `ComponentList.css`

## [ADR-275 · 276 · 278 ~ 283 — Implemented] - 2026-10-27

### Changed

- **사용자 Builder 확인으로 8 개 ADR 종결** (사용자 「adr도 모두 확인은 했다」): 275 Position 절 · 276 Button 글자 = Text 자식 · 278 오버레이 본체 = slot · 279 원본은 Local page · 280 Interactions 등록표 · controlled · 281 Interactions 패널 어휘 · 상속 · Form 목적지 · 282 Library 원본 잠금 해제 · Library · Local page = 문서의 page · 283 capability 대상 참조. 본문은 `docs/adr/completed/` 로 옮겼다.
  - 기록 없이 닫은 것: 282 G4 (Builder initial 번들 상한 초과 — 284 이전부터) · 275 G5 번들 · 276 G4 (ratchet · 번들 · preflight). 각 본문 Live Exercise 에 적었다.

## [Components 탭 (ADR-282 후속) — undo 뒤 프로젝트가 열리지 않던 것] - 2026-10-27

### Fixed

- **Library 를 처음 열기 전에 한 편집을 undo 하면 프로젝트가 다시 열리지 않고 Publish 가 `UNOWNED_ENTRY` 로 실패하던 것**:
  - Library · Local page 는 처음 열 때 History 없이 만들어지는데, 그 전에 기록된 step 의 undo · redo 가 프로젝트 항목 옛 사본을 그대로 다시 써 page 목록 (`componentPageIds`) 을 지웠다. 이제 재생은 그 목록을 지금 값으로 두고, 남아 있는 page 를 목록에서 빼는 step 은 그 자리에서 거부된다 (전에는 바뀐 항목만 검증해 깨진 문서가 저장됐다).
  - 위치: `packages/shared/src/catalog/runtime/controller.ts` · `document/componentPages.ts` (`withCurrentComponentPages`) · `document/graph.ts`

## [데이터 보기 (ADR-284 G8 후속) — 「검색 추가」 컨트롤 전부] - 2026-10-27

### Fixed

- 「검색 추가」 · 「이 컨트롤로 목록 거르기」 의 컨트롤 고르기에 Slider · ComboBox · Switch 등이 없던 것 — 손으로 적은 7 종 (SearchField · Select · RadioGroup · TagGroup · Checkbox · DatePicker · DateRangePicker) 표였다. 이제 상호작용 등록표의 값 상태에서 유도해 22 종을 고른다: 입력 (SearchField · TextField · TextArea · ComboBox 입력) · 하나 선택 (RadioGroup · Select · ComboBox) · 여러 개 선택 (TagGroup · CheckboxGroup · ListBox · GridList) · 켜면 적용 (Checkbox · Switch · ToggleButton) · 숫자 (NumberField · Slider) · 날짜 (DatePicker · DateField · TimeField · Calendar) · 기간 (DateRangePicker · RangeCalendar). 이미 놓은 Tabs · Tree · Table · CardView · ToggleButtonGroup · Menu 도 「이 컨트롤로 목록 거르기」 로 연결된다.
- 숫자 필드로 「검색 추가」 를 하면 글자 검색이 생기던 것 — 이제 NumberField 가 기본이고 비교는 「이상」, 시작값은 필드의 가장 작은 값이라 처음엔 모든 행이 보인다. Slider 는 필드 값 범위를 최소 · 최대로 갖는다.
- 「코드」 패널이 ComboBox · Tabs 의 선택을 `[...keys][0]` 로 적던 것 — 이 둘은 Set 이 아니라 key 하나를 넘긴다. 이제 `setX(keys ?? '')`.
- 「검색 추가」 로 만든 Slider 를 선택하면 Design 패널이 「Too many re-renders」 로 멈추던 것 — 변수를 읽는 값 (`{ kind: "var" }`) 을 숫자로 바꿔 NaN 이 됐고 슬라이더의 값 동기화가 끝나지 않았다. 이제 변수를 따르는 속성은 편집 칸 대신 「변수 X 를 따름」 을 보인다 (Switch · ComboBox 등도 같음 — 편집 칸에 쓰면 필터 연결이 끊겼다).
- 「변수로 정하기」 절이 「검색 추가」 컨트롤의 연결 (Slider value · ComboBox selectedKey · Switch isSelected …) 과 직접 연결한 key 목록 (`selectedKeys`) 을 보여 주지 않던 것 — 쓰는 세 모양 중 변수 값 자체 (`{ kind: "var" }`) 를 읽지 못했다. 이제 목록에 나오고, 변수를 바꿔도 저장 모양이 유지된다 (전에는 숫자 `value` 에 `{{ 이름 }}` 글자를 쓰려다 검증에서 거부됐다).

## [공용 Feature Flags와 구형 Preview 통신 제거] - 2026-10-27

### Removed

- **공용 `utils/featureFlags.ts`와 구형 iframe 통신 경로 제거**:
  - 호출부 없는 debug getter와 WebGL/iframe 전환 분기, 현재 수신자가 없는 테마·데이터 메시지 전송 및 테스트 mock을 삭제했다. 동기화는 기존 catalog 채널을 사용한다.
  - 미사용 `VITE_ENABLE_DEBUG_LOGS`·`VITE_USE_WEBGL_CANVAS` 설정과 타입 선언을 제거했다.
  - **Why**: 디버그 설정은 로그를 제어하지 않았고, 옛 Preview 메시지는 현재 catalog Preview에서 소비하지 않았다.

### Changed

- 사용 중인 Compare Mode 초기값과 CSS 선택 동기화 설정은 각각 store와 Preview 진입점에서 읽는다. 자산 저장 writer 설정은 `builder/config/assetStorage.ts`로 옮겨 이미지·폰트 저장의 기존 동작과 lazy load를 유지한다.

## [Compare Mode — CSS 선택 동기화를 환경변수로 제어] - 2026-10-27

### Changed

- **`VITE_ENABLE_HITAREA_MODE=true`일 때만 CSS Preview 클릭을 Canvas 선택으로 전달**:
  - 기본값 `false`에서는 선택용 클릭 리스너를 등록하지 않아 CSS 조작에 따른 Builder 선택·패널 갱신을 생략한다. 링크 이동과 컴포넌트의 실제 동작은 유지한다.
  - **Why**: 사용되지 않던 환경변수와 달리 Preview 선택 리스너가 항상 등록되어, 동작을 확인하는 클릭도 Canvas 선택을 바꾸고 있었다.
  - 위치: `apps/builder/src/preview/catalog/catalogPreviewApp.ts`

## [데이터 보기 (ADR-284) — Implemented] - 2026-10-27

### Changed

- ADR-284 데이터 보기 (조회 · 필터 · 정렬 · 묶기 · 참조를 변수와 보기로, RAC 코드로 환원되는 저장 형식) 를 **Implemented** 로 — 사용자가 본인 Builder 에서 walkthrough ① 라디오로 거르기 · ⑥ 검색 AND (female OR age < 25) · ⑫ kanban 열 3 + 끌어 옮기기를 직접 확인 (G8). 기능은 Phase 1 ~ 7 엔트리 (아래) 로 이미 실렸고 이 엔트리는 종결 기록이다. 알려진 사용성 메모 (LOW): 글자 타입 필드에서 숫자 비교 (「미만」 등) 가 빠진 이유를 패널이 안내하지 않는다 — 열 타입을 number 로 바꾸면 나온다. 후속: 코드 보기 편집을 닫힌 어휘 전체로 넓히는 ADR-285.

## [데이터 보기 (ADR-284 Phase 7 후속) — 코드 보기가 API 요청을 그대로 보여 줌] - 2026-10-27

### Fixed

- 「코드」 패널이 API 데이터를 고정 주소로 다 불러온 뒤 화면에서 거르는 코드로 보여 주던 것 — 실제로는 조건 · 정렬을 요청에 실어 보낸다. 이제 `url.searchParams` (또는 JSON 본문) 에 조건 · 정렬을 싣고 응답의 목록 · 다음 페이지 경로를 읽으며, 변수가 바뀌면 다시 부르는 (`reload`) 코드로 나온다. 요청에 담지 못하는 조건은 그 줄에 이유를 적는다. 매개변수 (`'gender', …` → `'gender_ne', …`) 를 고치면 조건 비교가 바뀐다
- 「코드」 패널이 정렬 변수를 `{column: 'id', direction: 'ascending'}` 로 시작해 처음부터 id 순으로 정렬하고 API 요청에 `_sort=id` 를 싣던 것 — 실제로는 열을 고르기 전까지 정렬하지 않는다. 이제 `useState<SortDescriptor>()` 로 비어 시작하고, 정렬은 값이 있을 때만 (`if (sortDescriptor) {…}` · `sortDescriptor ? … : 0`)

## [데이터 보기 (ADR-284 Phase 7) — 적용 조건 수 · 공유 보기에 목록 더하기 · 파생 보기 정리] - 2026-10-27

### Added

- **「적용 조건 수 표시」** (목록 「검색 · 필터」): 목록 앞에 지금 적용된 조건 수를 보여 주는 글자 (`조건 {applied}개`) — 빈 검색 · 「전체」 · 꺼진 체크는 세지 않고, 「또는」 으로 묶은 검색은 하나로 센다. API 데이터에서도 일부만 불러왔다고 「+」 를 붙이지 않는다. 코드 보기는 plants 예제의 필터 배지처럼 `[…].filter(Boolean).length`
- 이미 공유된 보기 (결과 수 표시 등이 만든 것) 에 같은 데이터의 다른 목록을 더하는 **「함께 볼 목록」 · 「이 보기 함께 읽기」**
- 판정 스크립트 `--generated <예제>=<파일>` — Builder 의 「코드」 패널에서 복사한 코드를 원본과 대조

### Changed

- 「검색 추가」 의 컨트롤이 필드 타입을 따른다 — boolean 필드는 Checkbox, 날짜는 DatePicker (직접 고르기 전까지)

### Fixed

- 결과 수 · 묶기 · kanban 열의 글자나 목록을 지워도 그 보기가 남아 「N개가 봅니다」 가 부풀고 원본 보기를 지울 수 없던 것 — 마지막으로 읽던 것이 지워지면 함께 지워진다 (Undo 로 함께 돌아옴)
- 「코드」 패널 이름이 영어 화면에서도 「코드」 로 나오던 것

## [데이터 보기 (ADR-284 Phase 6b · 6c) — 코드 보기 · 표시된 자리 고치기 · 필터 컨트롤이 변수를 따라감] - 2026-10-27

### Added

- **「코드」 패널** (ADR-284 Phase 6, 전체 메뉴): 지금 페이지를 React Aria 코드로 보여 준다 — 변수는 `useState`, 필터는 `filter(…)`, 정렬은 `toSorted`, 규칙은 핸들러, 끌어 놓기는 `useDragAndDrop`. 표시된 자리 (변수 이름 · 초기값 · 조건 · 정렬 열 · When) 를 고쳐 「적용」 하면 문서가 바뀌고 (한 번에 Undo), 그 밖을 고치면 줄 번호와 함께 「문서로 환원되지 않는 코드」 로 알리고 아무것도 바꾸지 않는다
- 공식 예제 5 종 (plants · photos · kanban · ios-list · emoji-picker) 을 빌더로 만들었을 때 코드가 원본과 같은 데이터 흐름인지 판정하는 스크립트 (`node scripts/code-view-equivalence.mjs`)
- 필터 조건 상세의 **「필드」** (「또는 조건」 의 사본을 다른 필드로) · 추가 폼의 **「고정 값 (컨트롤 없음)」** (컨트롤 · 변수 없이 늘 거르는 조건)
- 「변수로 정하기」 가 선택 같은 목록 prop (`selectedKeys` …) 도 받는다 — 예: 앨범 Tree 의 선택이 album 변수를 따라감

### Changed

- 「검색 추가」 로 만든 컨트롤이 변수를 따라간다 — 규칙이 변수를 바꾸면 (「필터 지우기」 버튼) 태그 · 체크박스 · 라디오 표시도 같이 바뀐다

### Fixed

- 라디오 필터에서 다른 값을 고른 뒤 「전체」 로 돌아가지 않던 것 (변수를 따라갈 때 항목의 시작 선택이 이겼다)

## [데이터 보기 (ADR-284 Phase 6a) — 변수로 정하는 속성 · 선택 없으면 비활성 · 다른 데이터로 끌어 놓기] - 2026-10-27

### Added

- **Design 「변수로 정하기」** (ADR-284 Phase 6a): 요소의 속성을 변수로 정한다 — 켜고 끄는 속성 (비활성 · 필수 …) 은 「변수가 값 없음 · 같음 · 선택 수 = 0 …」 일 때 켜지고, 글자 속성 (선택 방식 …) 은 변수의 값이 된다. 예: Delete 버튼은 목록에서 고른 것이 없으면 비활성
- 비교에 **「포함하지 않음」 · 「으로 시작하지 않음」 · 「으로 끝나지 않음」**
- Set state 의 **글자 변수 전환** (기본값 ↔ 정한 값 — Edit 버튼으로 선택 방식 none ↔ multiple)
- 목록이 자기 drop 규칙이 바꾸는 다른 데이터의 항목을 받는다 (사진을 앨범 Tree 에 놓아 앨범 바꾸기) — 그 데이터의 목록은 규칙 없이도 끌린다. 하나만 고른 선택은 글자 변수에 그 key 로 들어간다

### Fixed

- 「선택한 항목 지우기」 뒤 목록 선택이 남아 있던 것 (지운 뒤 선택 비움)
- 규칙이 목록 선택을 비워도 (`clearSelection`) 그 선택에 붙인 이름 (상태) 은 예전 값을 갖고 있던 것

## [데이터 보기 (ADR-284 Phase 5) — 목록 항목 끌어 놓기 · kanban 열 이동] - 2026-10-27

### Added

- **목록 항목 끌어 놓기** (ADR-284 Phase 5): ListBox · GridList · Tree · Table 의 Interactions 에 「항목 끌어 놓기」 When 5 — 같은 목록 안 순서 바꾸기 · 다른 목록의 항목을 사이에 · 빈 자리 · 항목 위에 놓기 · 끌기 끝. 값 고르기로 끌어 온 항목 (`keys`) · 놓은 자리 (`target.key`) · 놓은 쪽 (`target.dropPosition`) 을 쓴다. 규칙이 있는 목록만 Preview 에서 끌린다 (같은 데이터의 목록끼리만 받음)
- **「묶기로 열 만들기」 가 drop 규칙까지**: 열마다 「다른 열의 카드를 놓으면 이 열 값으로 바꾸고 놓은 자리로」 · 「빈 열에 놓으면 값만」 · 「같은 열 안 순서」 규칙을 같이 만든다 — 카드를 옮기면 열 머리 개수가 바뀐다
- 「collection 항목 수정」 Do 의 **「쓸 필드」** (한 필드만 바꾸기, 여러 항목이면 각각) · 「항목 앞으로 옮기기」 Do 의 **「놓은 쪽」** (놓은 위치가 앞 · 뒤를 고름)
- AI 규칙 도구가 Do 여러 개 (`actions`) 를 한 규칙으로 만든다

### Fixed

- 묶기 개수 머리 (「묶기로 열 만들기」 · 「묶기로 목록 만들기」) 가 있는 데이터에서 목록 편집 규칙 (수정 · 삭제 · 옮기기) 이 「항목 없음」 으로 실패하던 것
- Interactions 값 칸에 긴 값 이름이 패널 밖으로 넘치던 것

## [데이터 보기 (ADR-284 Phase 4d) — 「모든 값」 묶기 · 성능 · 번들 측정] - 2026-10-27

### Added

- **「묶기로 목록 만들기」 의 「모든 값 (0 개인 값도)」** (ADR-284 Phase 4d): 목록의 조건이 어떤 값을 비워도 그 값이 0 으로 남는다

### Performance

- 데이터 보기 계산: 100 행 · 조건 5 · 변수 변경 p95 0.087 ms (기준 16 ms) · 10,000 행 p95 5 ms · 같은 값 재계산 0.04 ms (memo) — 묶기 · 집계 · 참조 계산은 Preview 첫 로드 밖 (lazy chunk), Preview initial +39 B

## [데이터 보기 (ADR-284 Phase 4c) — 참조 필드: 다른 표의 행을 가리키고 그 값으로 거르기 · 보이기 · 세기] - 2026-10-27

### Added

- **필드 타입 「Reference」** (ADR-284 Phase 4c): Data 패널 필드 편집에서 다른 표와 맞출 필드를 고른다 (예: Users.teamId → Teams.id)
- 목록의 검색 · 묶기 · 정렬에 참조 너머 필드 (`teamId.name`) 를 고를 수 있다 — 가리키는 행이 없는 값은 「없음」 으로 걸러진다
- **「참조 값 표시」**: 목록의 각 행에 가리키는 행의 값 (팀 이름) 을 보인다
- **「참조하는 행 수」**: 각 행을 가리키는 다른 표의 행 수 (사용자별 주문 수) 를 보인다 — 없으면 0
  - 위치: `packages/shared/src/collections/view/evaluate.ts` (`viewFieldOf` 경로) · `catalog/resolution/resolver.ts` (행 필드 key) · `viewAuthoring.ts` · `DataTableFieldPanel.tsx` (`ReferenceTarget`)

### Fixed

- 목록 행 템플릿에 처음 노드를 넣으면 행의 이름 · 설명이 데이터 대신 표본 글자로 굳어 행에서 사라지던 것 (이 동작들이 넣는 Text 기준)
  - **Why**: 첫 삽입이 template 내용을 사본으로 만들며 `{label}` 을 항목 값으로 바꿨다 — 삽입 전 행 필드 자리를 그대로 적어 둔다
- 행에 넣은 Text 가 행 내용 맨 앞에 서서 GridList 행의 이름이 설명 아래로 밀리던 것 — 끝에 붙인다

### Tests

- `reference.test.ts` 4 · `adr284Reference.test.tsx` 2 · 패널 +1 · 데이터 · 갱신 +2 · 원복 RED 10/10

## [데이터 보기 (ADR-284 Phase 4a · 4b) — 결과 수 · 묶기로 목록 · 묶기로 열 (kanban)] - 2026-10-27

### Added

- **「결과 수 표시」** (ADR-284 Phase 4b): 목록의 「검색 · 필터」 에서 한 번 누르면 목록 앞에 결과 수 Text 가 생긴다 — 목록의 조건이 바뀌면 같이 바뀐다
- **「묶기로 목록 만들기」 · 「묶기로 열 만들기」**: 필드를 고르면 값마다 개수가 붙은 ListBox, 또는 값마다 열 (머리 = 값 · 개수, 아래 = 그 값의 행 목록) 을 만든다. 빈 열도 남고 0 을 보인다
  - 목록의 조건은 복사하지 않는다 — 목록의 보기를 이름 있는 보기로 바꾼 뒤 그것을 읽는다 (Undo 한 번에 모두 되돌림)
- 데이터 보기 계산기의 묶기 · 집계 (count · sum · mean · min · max) — 정렬과 그 뒤 보기가 집계 값을 읽는다
  - 위치: `packages/shared/src/collections/view/evaluate.ts` · `apps/builder/src/builder/catalogRuntime/viewAuthoring.ts` · `CatalogFilterSection.tsx` (`DerivedViews`)

### Changed

- API 데이터: 묶기 · 집계는 요청에 싣지 않고 불러온 행으로 계산하며, 마지막 페이지 전이면 「12+」 · 「≈ 4.2」 로 일부임을 보인다. 목록의 결과 수는 서버가 준 전체 수를 쓴다
  - **Why**: 부분 데이터의 집계를 전체 값처럼 보이면 틀린 숫자를 믿게 된다 (ADR-284 Decision 6)

### Tests

- `group.test.ts` 10 · `adr284Derived.test.tsx` 3 · `adr284ApiView` +2 · 패널 +2 · 원복 RED 4a 5/6 · 4b 6/6

## [데이터 보기 (ADR-284 Phase 3e) — 연결 상세가 실행 중인 값과 행마다 걸러진 이유를 보인다] - 2026-10-27

### Added

- **연결 상세의 실행 값** (ADR-284 Phase 3e):
  - Preview 가 실행 중이면 「현재 값 (Preview): …」, 아니면 「실행 전 — 기본값 …」 (기본값을 현재 값처럼 보이지 않음)
  - 로컬 데이터는 행마다 「이 조건: 일치 · 표시」 / 「불일치 · 숨김」 / 「건너뜀」 — 목록을 거르는 계산기와 같은 판정
  - API 데이터는 실제로 보내는 요청 (파라미터 또는 본문) 과 그 형식이 싣지 못하는 조건, 「서버가 돌려주지 않은 행의 제외 이유는 보이지 않습니다」
  - 위치: `apps/builder/src/builder/panels/properties/catalog/CatalogFilterSection.tsx` · `packages/shared/src/catalog/runtime/catalogPreviewSession.ts` (`reportState`) · `CatalogPreviewFrame.tsx` (`CATALOG_STATE_VALUES`) · `workspace.ts` (`previewValues`)

### Documentation

- walkthrough §9.3 의 조용한 실패 10 지점이 각각 어디서 막히는지 표 (`docs/adr/design/284-data-view-filter-sort-group-query-breakdown.md` §10 Phase 3e) · G3 닫힘 (「결과 수 표시」 는 G4)

### Tests

- `adr284Authoring.test.tsx` +1 (Preview 값 보고) · `catalogFilterSection.test.tsx` +3 · 원복 RED 4/4

## [데이터 보기 (ADR-284 Phase 3d) — 공유 보기와 「이 목록에서만」, 아무도 읽지 않는 변수 안내] - 2026-10-27

### Added

- **「이름 붙여 공유」**: 목록의 검색 · 정렬 조건에 이름을 붙여 같은 데이터의 다른 목록도 같은 조건을 읽게 한다
- 공유 보기를 읽는 목록은 「공유 보기 「이름」 — N개가 봅니다. 조건을 바꾸면 모두 바뀝니다」 를 보이고, **「이 목록에서만」** 으로 그 목록만 조건 사본을 가져 따로 바꿀 수 있다 (다른 목록은 그대로)
- 페이지의 컨트롤이 값을 쓰는 변수를 어느 목록도 읽지 않으면 (변수와 규칙만 만든 경우) 「… 를 읽는 목록이 없습니다 — 값을 바꿔도 아무것도 걸러지지 않습니다」 를 보이고, **「이 목록의 조건으로 연결」** 로 그 변수를 읽는 조건만 더한다 (변수 · 규칙을 새로 만들지 않음)

### Fixed

- 공유 보기의 조건을 바꿔도 그 보기를 읽는 목록이 다시 걸러지지 않던 것

### Tests

- `adr284Authoring.test.tsx` +2 · 패널 +1 · 원복 RED 4/4

## [데이터 보기 (ADR-284 Phase 3c) — 「정렬 따라가기」: Table 의 정렬을 다른 목록도 따라간다] - 2026-10-27

### Added

- **「정렬 따라가기」** (데이터 연결 목록 → 「검색 · 필터」 끝 「Follow sort」): Table 에서는 따라갈 목록을, 다른 목록에서는 따를 Table 을 고르면 Table 머리글을 눌러 정렬할 때 그 목록도 같은 순서가 된다 — 정렬 변수 · 머리글 규칙 · 두 목록의 정렬이 한 번에 생기고 Undo 한 번에 사라진다. Table 의 열은 정렬 가능해진다

### Changed

- 정렬 변수로 정렬되는 Table 은 그 변수의 것이다 — 다른 규칙이 변수를 바꿔도 행과 머리글 화살표가 같이 바뀐다. 정렬 변수 없는 Table 의 머리글 정렬은 전과 같다 (그 Table 만 정렬)

### Tests

- `adr284DataView.test.tsx` G0 ② GREEN · `adr284Authoring.test.tsx` +2 · 패널 +1 · 원복 RED 3/4

## [데이터 보기 (ADR-284 Phase 3a · 3b) — 「검색 추가」 한 번으로 목록 거르기] - 2026-10-27

### Added

- **「검색 추가」** (데이터를 연결한 목록 → Design 패널 Collection 절 끝 「검색 · 필터」): 필드와 컨트롤 종류 (입력 · 선택 · 라디오 · 여러 개 선택 · 체크 · 날짜 · 기간) 를 고르고 「생성」 하면 목록 앞에 컨트롤이 놓이고, 그 값으로 목록이 걸러진다 — 변수 · 규칙 (값이 바뀌면 변수에 쓰기) · 목록의 조건이 한 번에 생기고 Undo 한 번에 함께 사라진다
  - 선택 · 라디오 · 태그의 항목은 그 필드의 값에서 채워지고, 선택 · 라디오에는 「전체」 가 처음 선택된 채 붙는다 (「전체」 = 거르지 않음)
  - 비교 기본값: 입력 = 포함 (대소문자 무시) · 선택 · 라디오 = 같음 · 여러 개 = 그 중 하나 · 체크 = 켜면 적용 · 기간 = 사이 (끝 포함)
  - 생성 직후 그 연결의 상세가 열린다 — 비교 · 건너뛰는 값 · 변수 이름 · 값을 쓰는 컨트롤. 비교와 건너뛰는 값은 그 자리에서 고친다
- **「이 컨트롤로 목록 거르기」** (이미 놓인 검색 · 선택 · 체크 · 날짜 컨트롤 → 「Filter」 절): 같은 페이지의 대상 목록과 필드를 고르면 같은 연결을 만든다 — 목록 쪽에서 만든 것과 같은 결과
- 연결 행의 메뉴: 편집 · 「또는 조건 추가」 (조건을 또는 묶음으로) · 「연결 해제」 (조건만 빠지고 컨트롤 · 변수 · 규칙은 남는다)

### Tests

- `preview/catalog/__tests__/adr284Authoring.test.tsx` (생성 · Preview 실제 입력 7) · `panels/properties/catalog/__tests__/catalogFilterSection.test.tsx` (패널 2) · 원복 RED 7/7

## [데이터 보기 (ADR-284 Phase 2) — API 목록: 보기 조건이 요청 파라미터로 가고, 변수가 바뀌면 다시 불러온다] - 2026-10-26

### Added

- **endpoint 「조회 형식」** (Data 패널 → API 편집기 → Params 탭): 없음 (불러온 행에서 거름) · 쿼리 파라미터 (json-server 식 — `gender=male` · `name_like=pa` · `age_gte=20`, 정렬은 `_sort` · `_order`) · 본문 JSON (조건 묶음 전체 `{ where, sort }`)
  - 쿼리 파라미터는 비교 → 파라미터 표로 서버에 맞게 고친다 (`{field}_like` · 빈 칸 = 보내지 않음) · 정렬 파라미터 이름도
  - 이 collection 을 읽는 데이터 보기마다 「조건 전부를 보낸다」 또는 보낼 수 없는 조건 (`or` 묶음 · 표에 없는 비교 · 여러 필드 중 하나 · 참조 너머 필드 · GET 본문) 을 보인다 — 조용히 빠지지 않는다
- **「전체 개수 경로」** (`responseMapping.totalPath`): 응답의 전체 개수 (예: `total` · `meta.total`) — 그 조회의 값일 때만 「총 N 개」 로 쓴다
- **변수가 바뀌면 다시 불러오기**: 보기 조건이나 endpoint 의 `{{ 변수 }}` 가 읽는 변수를 규칙이 바꾸면 그 endpoint 를 다시 부른다 — 검색처럼 글자 조건은 0.3 초 뒤 마지막 글자로 한 번. 새 조회는 앞 요청을 취소하고, 이전 페이지 · 전체 개수를 이어받지 않으며, 늦게 온 앞 응답은 버린다

### Changed

- 서버가 보기를 받아 거른 행은 그대로 보기의 결과다 (클라이언트가 다시 거르지 않는다). 한 endpoint 를 서로 다른 보기 둘이 읽으면 요청에 싣지 않고 각자 불러온 행에서 거른다
- 보기를 목록에 붙이거나 고치면 Preview 가 그 endpoint 를 곧바로 다시 부른다

### Fixed

- **API 편집기 Params 탭이 길면 아래가 잘리고 스크롤되지 않던 것**: 편집기 패널의 `overflow: hidden` · `flex: none` 이 탭 본문에도 걸렸다

### Tests

- `preview/catalog/__tests__/adr284ApiView.test.tsx` (G2 7 — serializer 와 따로 쓴 json-server · body 트리 mock 서버의 응답 = 로컬 계산기) · `collections/view/__tests__/serialize.test.ts` (6) · 편집기 · draft 각 +1 · G0 RED ③ GREEN · 원복 RED 7/7

## [데이터 보기 (ADR-284 Phase 1) — 목록이 변수 조건으로 걸러지고, 규칙 하나가 Do 여러 개를 순서대로 실행] - 2026-10-26

### Added

- **규칙의 Do 목록**: Interactions 패널의 규칙 편집기 끝 「Do 추가」 — 한 When 에 Do 를 여러 개 두고 순서대로 실행한다 (앞 Do 가 실패하면 뒤 Do 는 실행하지 않는다). Do 가 둘 이상이면 「Do 순서」 에서 고르고 지운다. 요약은 「… 외 Do N개」
  - 저장: `InteractionEntry.actions[]` (Do 하나 = 길이 1) — ADR-158 「한 규칙 = 한 Do」 의 후속 (kanban drop 의 `update` + `moveBefore` 실증). 조건부 실행 · 분기는 여전히 없다
- **데이터 보기 (조회 조건)**: 바인딩이 조건 트리 (`and` · `or` · 비교 18 · 건너뛰는 값 · 적용 여부 · 변수 참조 `!var`) 와 정렬을 갖는다 — 목록 자신의 내장 보기 (`binding.view`) 또는 이름 붙인 공유 보기 (`binding.viewId` · `ViewEntry`). mock 데이터도 걸러진다 (전에는 `setFilterText` 가 API 만 다시 불러 mock 목록이 「무반응」 이었다)
  - 계산: 원본 전체에 조건 → 정렬을 적용한 뒤 표시 상한 (100) 을 건다 — 101번째 이후 행만 일치해도 보인다. 글자 비교는 RAC `useFilter` 와 같은 규칙 (대소문자 · 악센트 무시), 날짜는 일 단위
  - 변수가 바뀌면 그 변수를 읽는 목록이 다시 계산된다 (Preview · Publish 실행 값, Canvas 는 기본값)
  - Canvas · Preview · Publish 가 같은 계산기 하나 (`packages/shared/src/collections/view/`) 를 쓴다
  - 저작 UI 는 Phase 3 (「검색 추가」 · 「이 컨트롤로 거르기」) — 지금은 문서 · 명령 층
- 공유 보기 명령 `addView` · `updateView` · `removeView` (읽는 곳이 있으면 거부) · `promoteBindingView` (목록의 내장 보기 → 공유 보기)

### Changed

- **Breaking — library contract 50**: 규칙은 `actions` 목록, 바인딩은 `view` · `viewId` 를 가질 수 있다. contract 49 문서는 열리지 않는다 (변환 없음 — 개발 단계 방침). 샘플 3 파일은 새 형식

### Fixed

- **Do 를 「Show a toast」 로 고르면 오류 토스트 (`…message`)**: 기본 message 가 빈 글자라 문서 검증이 거부했다 — 기본 message 를 채운다. 모든 Do 선택의 기본값이 문서 검증을 통과하는지 테스트로 고정

### Tests

- `collections/view/__tests__/evaluate.test.ts` (계산기 14 — 200 행 표시 상한 반례 포함) · `oneEvaluator.static.test.ts` (계산기 하나) · `document/__tests__/adr284ViewSchema.test.ts` (9) · `preview/catalog/__tests__/adr284DataView.test.tsx` (G0 RED 4 — ① ④ GREEN) · 원복 RED 8/8

## [Interactions — Value 칸 「값 고르기」: 이벤트 인자 · 선택한 항목 · 변수를 골라 담기] - 2026-10-26

### Added

- **Value 칸의 「값 고르기」 (`{ }` 버튼)**: Set state 값 · Capability 값 · API body · 목록 데이터 칸이 같은 선택기를 쓴다. 목록은 그 규칙이 이미 아는 것에서 만든다 — When 의 RAC 인자 (`keys` · `value` · `formData` …), 데이터에 묶인 owner 의 「선택한 항목」 (`useListData.getItem` — 항목 전체 · schema 필드), 닿는 변수. 고른 값은 칩 (`선택한 항목 › name`) 으로 보이고, 변수 type 과 모양이 다르면 그 자리에서 안내한다
  - 저장은 값 전체 참조 — `!event.<인자>[.경로]` · `!item.<key 인자>[.필드]` · `!var.<변수 id>[.경로]` (기존 `!event.<인자>` 를 넓힘, 문서 스키마 변경 없음). 행 전체는 object, multiple 선택은 배열 그대로 들어간다
  - 위치: `packages/shared/src/interactions/valueRef.ts` · `apps/builder/src/builder/panels/interactions/{ValueField.tsx,valueOptions.ts}`
- **page · 요소 변수 type `object` · `array`**: 행 전체 · 선택 목록을 담는다 (기본값 없음 — 규칙이 채운다, `{{ TEMP.name }}` 으로 읽기). 기존 문서는 그대로 열린다

### Fixed

- **Set state 값이 입력한 글자 그대로 저장 · 실행됨**: GridList 선택으로 `selectedKeys.name` 을 적으면 Text 에 그 글자가 나왔다
  - **Why**: Set state 의 값 칸은 리터럴 전용이고 실행 (`dispatcher.ts`) 도 `action.value` 를 해석 없이 썼다 — Capability · body 는 `!event` 를 풀었지만 Set state 만 빠져 있었다. number 변수에 `!event.value` 를 넣으면 문서 검증이 거부하기도 했다
  - 수정: 모든 값 칸이 resolver 하나 (`resolveRuleValue`) 로 읽고, 문서 검증은 참조 값을 실행 때 확인한다

### Tests

- `apps/builder/src/preview/catalog/__tests__/valueRef.test.tsx` (single · name / 행 전체 / multiple · 배열 / 리터럴 유지 — 실행 쪽을 되돌리면 3건 실패) · `panels/interactions/__tests__/valueField.test.tsx`

## [Preview — instance 안쪽 자리의 Ratio 잠금이 Preview 전체를 멈추던 결함] - 2026-10-26

### Fixed

- **Card 의 CardPreview 처럼 rule 이 있는 자리에 Ratio 를 걸면 Preview · Publish 가 그려지지 않음**:
  - `CATALOG_DOM_VISUAL_UNSUPPORTED:…component-card__preview:aspectRatio` 로 렌더가 멈췄다
  - **Why**: rule executor 의 작성 style 반복문이 `aspectRatio` 를 모르는 키로 던졌다 — 같은 함수가 반복문 뒤에서 그 값을 inline `aspect-ratio` 로 쓰고 있었다. rule 이 없는 노드 (frame) 는 다른 경로라 증상이 없었다
  - 수정: 반복문이 `aspectRatio` 를 건너뛴다 (아래의 기존 inline 쓰기가 담당)
  - 위치: `packages/shared/src/catalog/runtime/domBinding.runtime.ts` `authoredStyle`
  - 테스트: `apps/builder/src/preview/catalog/__tests__/authoredAspectRatio.test.tsx`

## [Interactions — RAC 레퍼런스 기준 When · Do 전수 조사와 보완] - 2026-10-26

### Added

- **When (RAC callback) 보완** — 설치 RAC 1.22.1 d.ts 76 type 의 callback 을 등록표와 대조해 빠진 것을 더했다 (S2 1.8.1 이 유지하는 것은 보이게, S2 가 뺀 hover 는 「RAC 전체 보기」 뒤):
  - DropZone `onDropEnter` · `onDropMove` · `onDropActivate` · `onDropExit` (+ hover 숨김) · Menu `onClose` · Form `onInvalid` · TagGroup `onAction` · Checkbox · Switch `onPress`.
  - **항목 노드의 `onAction`** — ListBoxItem · GridListItem · TreeItem · Row · Tag · MenuItem (MenuItem 은 등록표에 처음 들어옴). 항목의 press · hover · focus 는 숨김 그대로.
  - CheckboxGroup · ListBox · Select · ComboBox · DateField · TimeField · DatePicker · DateRangePicker 의 focus (+ keyboard 는 Q3 대로 노출 0).
- **Do (고유 기능) 보완** — controlled prop 대조: Calendar · RangeCalendar `focusDate` (그 날짜의 달로 — `focusedValue` 를 Preview 가 controlled 로 넘긴다) · Tree · DisclosureGroup `collapseItem` · CheckboxGroup `checkItem` · `uncheckItem` · 열림 `toggleOpen` · Disclosure `toggleExpand`.

### Changed

- **Select 의 선택 = RAC 1.22 / S2 Picker 의 `value` · `onChange`** — `selectedKey` · `onSelectionChange` 는 RAC 가 deprecated 로 둔 single 전용 이름이라 숨김으로 남긴다 (그 이름을 쓰는 규칙은 계속 실행). Select 에 `deselectItem` 이 생기고 `selectItem` 은 multiple 에서 더한다. 값 변수 원천도 `value` 로 (옛 `selectedKey` 원천 변수는 관찰이 끊긴다 — 변환 없음).

### Fixed

- `selectionMode: "multiple"` Select 에 건 규칙이 실행되지 않았다 — RAC 가 multiple 에서 `selectedKey` 를 무시하고 `onSelectionChange` 를 부르지 않는다 (`useSelectState.mjs`). `selectItem` 도 닿지 않았다.
- TreeItem 에 건 규칙 handler 가 RAC TreeItem 에 닿지 않았다 — Tree 렌더러가 항목을 직접 그려 `withRuntime` 을 거치지 않았다 (`treeItemElements` 에 `handlersOf` 전달 · Tree 가 항목 record 를 구독).
- Checkbox · Switch 의 hover 규칙이 실행되지 않았다 — RAC 1.22 `CheckboxField` 에는 HoverEvents 가 없고 `*Button` 만 받는다 (그 record 의 hover handler 를 Button 으로).
- Preview · Publish 에서 팔레트 Link (href `#`) 를 누르면 「404 Page not found」 로 바뀌었다 — RAC client 라우팅이 `#` 을 경로로 넘겼다. `#anchor` 는 페이지에 머물고 그 요소로 스크롤한다.

### Tests

- `interactionWhenReach.test.tsx` 196 — 보이는 When 전부 · 숨은 press · hover · focus 전부를 Preview 전 경로에서 실제 RAC 조작으로 실행 (정적 행 누락 게이트 2) + 추가한 Do 9 행. 원복 RED 5/5 (Select · TreeItem · toggle hover · Link `#` · focusDate). live (Chrome MCP 5174 → Publish 탭): Checkbox hover · Node 2 onAction · Select multiple 두 항목 onChange · Link 누름 toast + 페이지 유지, 패널 When 목록 (Checkbox 「On press」 · TreeItem 「On item action」).

## [ADR-283 Phase 0 ~ 4 — Interactions 대상 참조: instance 안쪽 · 누른 자리 기준 실행 · 검색 선택기 · Canvas 지정] - 2026-10-26

### Changed

- **대상 선택기 · Canvas 이름표의 `#` = 요소의 DOM id (Accessibility ID)**: `Save (Button) #button_1` · instance 안쪽 자리는 그 instance 의 id (`OrderCard #ordercard_1 ▸ Save`) — DOM id 로 검색도 된다. DOM id 가 없을 때만 내부 id 끝 4자리 (`· a1b2`)
  - **Why**: `#` 뒤가 레이어 이름 (`Button #Save`) 이거나 내부 id 꼬리여서, Preview 가 그리는 `id=""` 와 다른 값이 CSS `#id` 처럼 보였다 (사용자 지적)
  - 위치: `catalogRuntime/interactions.ts` (`htmlId`) · `panels/interactions/catalog/CatalogTargetPicker.tsx` `catalogTargetLabels` · `catalogRuntime/targetPick.ts`
- **capability 규칙의 대상이 「장소 참조」 가 됐다** (contract 49 — 48 문서는 열리지 않는다, 변환 없음): page 노드 (`{ nodeId }`) 뿐 아니라 instance 안 자리 (`{ address }` — OrderCard 의 Save) · 컴포넌트 원본 안 자리 (`{ local }` — 원본 규칙이 같은 컴포넌트의 형제를) 를 가리킨다. swap · detach 로 자리가 사라진 규칙은 지우지 않고 「대상 없음」 으로 남긴다 (`{ unset: true }` — 패널 「대상 없음 · 다시 지정」, swap 알림 「대상 없음 N」, Publish 경고).
- **대상 칸 = 검색 선택기**: 「이 페이지」 / 「컴포넌트 안」 그룹 · `OrderCard ▸ Save` 경로 라벨 · 이름이 겹치면 짧은 id (instance 자리는 instance 의 id) · 50 개 넘으면 가상화 · 목록 hover ↔ Canvas 강조. 새 대상이 지금 기능을 받지 않으면 행 아래에 「X 는 ‘Disable’ 을 받지 않아 ‘Hide’ 로 바꿨습니다」 (말없는 폴백 제거).
- **Canvas 에서 대상 지정**: 대상 칸 옆 조준 버튼 → 배너 · 이름표 → 클릭 (⌘ 클릭 = 안쪽 요소) = 한 step, Esc = 변경 없음, 선택 · 편집 맥락은 그대로. field 부품 (Input · Label …) 은 그 field 로, overlay 본체 (Modal · Popover · Tooltip) 는 trigger 로 올려 이름표에 두 이름.
- AI 의 `createInteractionRule` 이 instance 안 요소를 대상으로 받는다.

### Fixed

- 원본 규칙 · 데이터 행 template 의 규칙이 **누른 instance · 누른 행**의 대상을 바꾼다 — 전에는 대상의 첫 record (첫 instance · 첫 행) 만 바뀌었다 (`recordsOfSource(targetId)[0]`, G0 RED).

### Tests

- `adr283TargetRef.test.ts` 19 (구현 판독 수리 반례 5 포함) · `adr283Preview.test.tsx` (RAC) · `adr283TargetPicker.test.tsx` 4 · `adr283CanvasPick.test.ts` 4 · 원복 RED 4/4 · live (Chrome MCP 5174 — 선택기 · Canvas 지정 · Esc · ⌘Z · Publish 실행 · swap 「대상 없음」).

## [CardView · GridList waterfall 배치 — Canvas 엔진 masonry 축 + Preview 배치] - 2026-10-26

### Added

- **CardView · GridList `layout: waterfall`** (사용자 요청 「RAC photos · S2 CardView 의 waterfall(masonry) 패턴 누락 — 적용해」):
  - CardView 의 S2 `layout` (grid · waterfall) 을 Design 패널 Appearance 에 다시 들였고 (2026-10-14 「소비자 없음」 으로 지웠던 축 — 옛 문서의 값을 로드 때 지우던 마이그레이션도 뺐다), GridList `layout` 에 Waterfall 을 더했다 (RAC 는 GridList 를 `Virtualizer layout={WaterfallLayout}` 로 감싼다 — D2 출처 `rac`).
  - waterfall 은 열을 grid 트랙 그대로 두고 (CardView 원본 2열 · GridList 2열), 항목을 순서대로 **가장 짧은 열** 아래에 쌓는다 (1px 안 동률은 왼쪽). 컨테이너 높이 = 가장 긴 열.
  - Canvas: 엔진이 `grid-template-rows: masonry` 를 받는다 (`styleOf` 가 보낸다) — `solve_grid_masonry` 가 트랙 pass 두 번 (순환 배치로 열 폭 높이를 잰 뒤, 정한 열에 다시 놓고 열 누적 높이만큼 내림).
  - Preview / publish: 브라우저에 안정된 masonry 트랙이 없어 같은 규칙으로 RAC 항목을 놓는다 — 열 하나 · 1행 · `translate` 로 내림, 행 높이 = 가장 긴 열 (`CatalogWaterfallGrid` — 렌더마다, 그리고 항목 크기가 바뀔 때 (이미지 로드) 다시 배치).
  - 위치: `packages/engine/src/tree.rs` (`solve_grid_masonry` · `masonry_lanes`) · `packages/shared/src/catalog/runtime/{waterfall.ts,compositionRoot.ts,delegatedDom.runtime.ts}` · `packages/shared/src/catalog/bindings/{CardView,GridList}.binding.ts` · `packages/shared/src/catalog/document/s2PropAlignment.ts`

### Tests

- Rust `grid_masonry_rows_*` 2 (가장 짧은 열 · 자기 margin · 열 폭이 다를 때 다시 풀기) · `waterfallLayout.test.ts` (lane 규칙 · CardView · GridList Canvas 배치 · grid 대조 · 새로고침 없이 전환).

## [ADR-282 Phase 0 ~ 3 — Library page 원본 잠금 해제 · 리셋 · Library · Local page = 문서의 page] - 2026-10-24

### Added

- **Library page 의 기본 원본을 잠금 해제해 전체 편집** (사용자 요청 「잠금 ↔ 해제 · 리셋 아이콘, 해제 뒤 origin 수정」 — ADR-282 Accepted):
  - Navigator Components 탭 Library 행 오른쪽에 [리셋] [잠금 `lock` ↔ `lock-open`]. 잠금 아이콘은 **Library 전체**의 편집 모드를 켜고 끈다 (사용자 지시 「Library 전체 해제」 — 선택 불필요). 해제하면 모든 원본이 한 step 에 사본이 되고 (「Unlock library」), 다시 잠그면 편집하지 않은 원본은 라이브러리로 돌아가고 편집한 원본만 남는다 (「Lock library」). 잠긴 동안 사본은 편집되지 않는다 — 시도하면 「Library 가 잠겨 있습니다 — Navigator 의 Library 잠금을 풀면 편집할 수 있습니다」 안내가 뜬다 (console 오류 · 「Canvas 가 이 편집을 그리지 못했습니다」 toast 가 아니라 거부 안내 — 단축키 · 메뉴 · Styles 패널 · Navigator 명령 공통, `operationNotice.ts` `notifyEditRefusal`). ◆ 자체의 복제 · 삭제 · 이동은 「원본 자체는 복제 · 삭제 · 이동할 수 없습니다」 (전에는 목록 항목 템플릿 문구 — Local page 원본도 같다).
  - 해제 · 잠금 뒤 Canvas 에서 ◆ 를 클릭하면 사본 루트가 선택된다 — **Why**: Library page 를 다시 배치할 때 view entry 가 step 밖에서 바뀌어, read model 이 ◆ 칸의 행을 표본 기준으로 들고 있었다 (클릭은 맞는 record 를 찾았지만 선택이 비었다). 다시 배치한 뒤 read model 이 view entry 의 행을 다시 읽는다 (`readModel.ts` `viewEntriesChanged`).
  - 해제한 채 새로고침 · 닫기를 해도 다음에 열 때 Library 는 잠긴 상태이고, 손대지 않은 사본은 그때 라이브러리로 돌아간다 (편집한 사본만 남음). 저장되지만 History 에는 남지 않는다 — runtime 의 새 `load` step (history `skip: "load"`, `controller.ts` · `compositionRoot.ts` `executeOnLoad`). 전에는 사본 85 개가 남아 잠긴 Library 의 카드가 모두 「· unlocked」 였다.
  - 해제한 Menu 카드의 Item ◆ (MenuItem) 가 `{label}` 대신 표본처럼 「Item」 을 그린다 (`{shortcut}` · `{description}` 은 비어 그려지지 않음) — 그 글자는 담는 쪽 (Menu) 의 prop 이라 사본에 값이 없었다. Library page 가 ◆ 표시용 값을 등록하고 (`CatalogGraph.setOriginDisplayBindings`), resolver 는 사본 루트를 직접 그릴 때만 읽는다 (instance 무관).
  - 해제한 원본은 프로젝트가 그 template 의 **사본**을 갖고, 카드의 ◆ 가 사본 루트가 된다 (헤더 「· unlocked」). 자식 추가 · 레이아웃 · fill · breakpoint 까지 Local page 원본처럼 편집되고, 그 원본의 모든 instance — 다른 원본 안의 부품 자리 (Select 의 trigger · Toolbar · NumberField 증감 버튼) 포함 — 가 따른다. instance 마다의 글자 (`{label}`) 는 그대로 instance 값이다.
  - [리셋] 은 확인 대화상자 (원본 수 · instance 수 · 해제 뒤 새 자리에 채운 내용 수) 뒤 프로젝트가 바꾼 원본 전부를 라이브러리 기본으로 되돌린다 (사본 · 기본값 · 상태 스타일까지). 리셋 뒤 Library 는 잠긴다. 해제 · 잠금 · 리셋 모두 한 번의 undo.
  - Design 패널 Component 절: 해제된 ◆ 에 원본 기본값 칸 (label · icon · variant …).
  - 위치: `packages/shared/src/catalog/{document/originFork.ts,commands/originFork.ts,document/graph.ts,transactions/transaction.ts}` · `apps/builder/src/builder/catalogRuntime/{originUnlock.ts,componentsPage.ts,workspace.ts,canvasPick.ts}` · `panels/navigator/catalog/CatalogDefinitionsSection.tsx`

- **Library · Local page = 프로젝트 문서의 page (ADR-282 Phase 3 · 사용자 지시 2026-10-25 「library-body 는 home-body 에 대응」)**:
  - Components 탭에서 Library · Local 을 처음 열 때 그 page 가 프로젝트 문서에 저장된다 (History 에 남지 않음). 그 뒤로는 Pages 탭의 page 처럼 body · 카드 · 제목 · 줄 · ◇ instance 를 고르고 옮기고 지우고 Layout · Style 을 편집한다. Layers 는 page 트리 (body > 카드 > 줄 > ◆ · ◇) 다. body 는 Pages 의 body 처럼 breakpoint 폭 (desktop 1920 · tablet 768 · mobile 390) 이고 높이는 카드만큼 (`100%`), grid 열은 desktop 3 (Library page 는 4 — 사용자 요청 2026-10-25) · tablet 2 · mobile 1 의 같은 비율 (`repeat(n, minmax(0, 1fr))` — body 의 breakpoint 레이어. 카드 내용 · 잠금 해제한 원본 복사본의 폭이 열을 넓히지 않는다, 사용자 요청 2026-10-25) 이며 Library 카드는 grid 열 폭 (`width: 100%` · min · max 크기 auto), Local 카드는 내용 폭이다 (`width: fit-content` — 폭을 채우는 원본 (필드 · 목록) 의 카드는 그 원본 칸 폭을 `minWidth` 로) (사용자 요청 2026-10-25). 카드 제목은 이름만 (`BUTTON` — 앞 번호 없음), 카드는 palette 순서로 body 바로 아래 놓인다 (Column frame 없음). 카드의 줄은 grid 하나 — 컴포넌트 카드는 ◆ · ◇ 캡션 글자 없이 샘플만 놓고 (역할 표시는 Layers 의 ◆ · ◇ · instance 이름, 사용자 요청 2026-10-25 — 캡션 글자 약 300개 · Library page 약 100 KB 감소), theme 카드 (Colors · Typography · Spacing — 맨 앞) 는 값 이름 · 값 캡션을 그대로 둔다. Icons 카드는 뺐다 (사용자 요청 2026-10-25).
  - CardView · Badge · Meter · StatusLight · InlineAlert · Card 카드에 Variants 줄 없음 (사용자 요청 2026-10-25).
  - Library · Local page 노드 (body · 카드 · 줄) 의 page 가 만든 값 (body 의 grid 3열 · gap 16 · padding 16 등) 은 기본값이다 — Styles 의 Reset 이 켜지지 않고, 편집 뒤 Reset 은 그 값으로 되돌린다 (전에는 page 값을 사용자 편집으로 읽어 Reset 이 켜져 있었고, 누르면 grid 가 지워졌다 — 사용자 보고 2026-10-25). Home body 의 기본값이 rule 인 것처럼, 이 page 의 기본값은 page 생성기 (`catalogComponentPageBaseline`) 다.
  - CardView · ListBox · GridList · Tree · Table · CheckboxGroup · RadioGroup · Toolbar · ToggleButtonGroup · ButtonGroup · DisclosureGroup · Nav · Card · Tabs · Breadcrumbs · AvatarGroup · Form · TagGroup · Menu · Tooltip 카드는 원본 ◆ 만 둔다 (slot 을 채운 ◇ instance 없음 — Dialog · Popover · ContextualHelp 와 같음. Item · States 줄은 그대로). Nav · CheckboxGroup · RadioGroup · Pagination · DisclosureGroup · ToggleButtonGroup · Toolbar · ButtonGroup 카드는 Item 줄도 없다 — Link · Checkbox 는 자기 카드가 있고, Radio 원본은 Library page 에 더는 그리지 않는다. Disclosure 카드는 States 줄, Checkbox · Switch 카드는 Emphasized 줄이 없다. Typography 카드의 Sizes 는 grid 2열 대신 세로 flex (크기 샘플 아래 캡션) (사용자 요청 2026-10-25).
  - 컴포넌트 카드에는 Origin 줄 이름 (Text) · Origin 줄 frame 이 없다 — ◆ 원본 (과 slot 을 채운 ◇) 은 카드 제목 바로 아래에 서고, 다른 줄 (Variants · 상태 · Item · Types) 이 그 뒤에 온다 (`graph.setViewChildren` 의 위치 인자, 사용자 요청 2026-10-25 「Origin(Text) · Origin(그룹) 제거」). 폭을 채우는 원본 (필드 · 목록) 은 카드의 최소 폭 (원본 칸 폭) 만큼 그려진다.
  - Dialog · Popover · ContextualHelp 카드는 원본 (◆, 본체 열림) 만 그린다 — 옆의 채운 instance (◇) 없음. Dialog · Popover 의 열린 본체는 trigger 아래에 놓인다 (Body line `column` — 다른 오버레이는 오른쪽 그대로). Dialog 카드의 Body line · Modal · Dialog 는 카드 폭을 채운다 (`width: 100%` — Modal · Dialog 는 page 샘플의 patch 라 원본 · 놓은 instance 는 그대로) (사용자 요청 2026-10-25).
  - Dialog 의 기본 폭 400 → 310 (catalog Dialog rule `width` · 생성 `Dialog.css` — Canvas · Preview 의 모든 Dialog). Library 를 잠금 해제한 mobile 에서 Dialog 원본 복사본 (400) 이 카드 안쪽 폭 (310) 을 넘던 것 (사용자 요청 2026-10-25).
  - Library page 의 ◆ 샘플 크기: ColorSlider 는 width 100% · max-width 없음 (rule 의 300px 대신), DropZone 은 width 100% · height 내용 높이 (size 의 80 · 120 · 160 대신). page 샘플만의 값이고 원본 · instance 는 rule 값 그대로 (사용자 요청 2026-10-25 — 요청의 `maxWidth: auto` 는 CSS 에 없는 값이라 제한 없음 `none` 으로 적용).
  - **GridList = S2 ListView 의 목록 행** (사용자 결정 2026-10-25 「cardview · gridlist 둘 다 비슷한 컴포넌트」 → 「2번으로 진행」 — 카드 모음은 CardView, 목록은 GridList. 10-13 의 RAC 레퍼런스 이미지 카드를 되돌림): 목록은 1px `--border` 상자 · 모서리 8 · 바탕 `--bg` · padding · gap 0, `stack` (기본 — 원본 template 도 stack) 은 전폭 한 열 · `grid` 는 같은 폭 2열. 행은 최소 높이 40 · padding 8 · 12 · 아래 1px 구분선 (선택 중엔 투명), 앞 시각 요소 (Image 32 정사각 · Icon · 선택 Checkbox) 가 두 줄에 걸치고 8 띄어 label 위 · description 아래 (2 간격), hover · 누름 = `--bg-muted`, 선택 = `--accent-subtle`. 카드 그림자 · 선택 링 · 누름 축소 · 사진 200 은 없앴고 원본 항목의 Image 를 뺐다 (S2 ListView 첫 예제처럼 Text + Text[description]). `isQuiet` 는 목록 상자 (테두리 · 바탕 · 모서리) 를 없앤다. 링크 글리프는 행 끝 (카드 아래 padding 이 아니다). Canvas (`manualBoxRules` · GridList · GridListItem rule) 와 Preview (`GridList.css` · 생성 `GridListItem.css`) 를 같이 고쳤다.
  - CardView 원본: 배치를 flex wrap 에서 grid 같은 폭 2열 (`repeat(2, minmax(0, 1fr))`) · 행 `auto` 로, 안의 Card 폭을 200 에서 100% (열 폭) 로 (원본 template — Canvas · Preview 같은 값, 사용자 요청 2026-10-25).
  - Tree 원본 크기 (사용자 요청 2026-10-25): TreeItem 은 width 100% (홀로 그린 항목이 글자 폭이었다), TreeItemContent 는 최소 폭 · 높이 없음 (행 높이 32 는 TreeItem 의 것). Canvas (`manualBoxRules`) 와 Preview (`Tree.css`).
  - ColorField 의 Input 최대 폭 제거 — size 별 9 · 10 · 12 · 14 · 16ch (`--cf-input-max-width` delegation) 이 없어지고 Input 이 field 폭을 채운다. catalog ColorField rule · 생성 `ColorField.css` — Canvas · Preview 의 모든 ColorField (사용자 요청 2026-10-25 「colorfield (origin) - input 의 maxWidth 12 → auto」).
  - FileTrigger 의 S · M · L 크기를 Button 의 S · M · L 과 같게 — 글자 크기 · 줄 높이 · 굵기 500 · 모서리 · 테두리 · padding (S 2/8 · M 4/12 · L 8/16) · 아이콘 16 · 18 · 24 · gap, 고정 높이 없음 (전에는 높이 32 · 40 · 48, 좌우 padding 12 · 24 · 32). catalog FileTrigger rule · 생성 `FileTrigger.css` — Canvas · Preview 의 모든 FileTrigger (사용자 요청 2026-10-25).
  - Card 원본의 Preview · Content · Footer 에 Slot 「+」 항목이 생겼다 (전에는 Slot 절이 비어 있었다) — S2 Card 레퍼런스 (`@react-spectrum/s2` Card.md API) 가 각 부품에 두는 것: Preview 는 Image · Illustration · Badge · Avatar (gallery 예제의 위에 얹는 Badge · Avatar), Content 는 Text (title · description) · Menu (S2 `ActionMenu`) · Icon, Footer 는 StatusLight · Button (`LinkButton` = `href` 를 준 Button). 소유 노드인 Card 부품 (잠금 해제한 Library 원본 복사본 · 소유 Card) 에서 부품 끝에 넣는다. 놓은 Card instance 의 부품은 지금처럼 Slot 채우기 목록을 쓴다 (사용자 요청 2026-10-25). Card 의 Footer 는 template 의 기본 `paddingTop: 8px` 를 뺐다 (사용자 요청 2026-10-25). Card 원본의 Footer slot 에 기본 Button (「Action」, S2 ProductCard 의 Footer Button) 을 넣었다 — 놓은 Card 의 Footer 도 그 Button 을 갖고, 빈 slot 빗금이 없다 (사용자 요청 2026-10-25).
  - Slot 절의 항목 추가는 넣을 수 있는 type 이 2개 이상이면 「Add content」 select 하나다 — 고르면 바로 들어간다 (전에는 type 마다 「+」 줄 — Card Preview 4줄 · ListBox · Menu 의 항목 · Section 등). 1개면 지금처럼 「+」 한 줄 (사용자 요청 2026-10-25).
  - Library page 를 mobile 로 열면 모든 카드가 512 폭으로 늘어나던 것: Chart 카드의 Types 줄 (248px 고정 두 칸) 과 ◆ Chart (320px) 가 한 열을 넓혔다. Types 줄은 `1fr` 두 칸 (차트는 칸 폭), ◆ Chart 는 `width: 100%` (page 의 값 — 원본 · 놓은 instance 는 320 그대로). 컴포넌트 카드의 줄 (상태 · Item · Variants) 은 `auto` 5칸 grid 대신 카드 폭의 flex-wrap 이다 — 좁으면 다음 줄로 넘어간다 (Checkbox · Switch · Tree · ToggleButton · Button · GridList 의 5칸 줄이 mobile 열을 525 까지 넓혔다). theme 카드의 캡션 줄과 Chart Types 줄은 grid 그대로 (사용자 요청 2026-10-25).
  - ◆ 칸은 원본을 참조만 하고 그린다 (`NodeEntry.originOf`) — 잠긴 원본은 표본, 해제한 · Local 원본은 그 template 루트. 잠금 · 해제 · 리셋 · 컴포넌트 생성 · 삭제는 page 를 건드리지 않는다. Local page 는 컴포넌트 생성 · 삭제 · 이름 변경을 따라 카드를 맞춘다.
  - Preview · publish 는 이 page 를 싣지 않는다. 사용자에게 보이는 instance 수 (Component 절 · 확인 대화상자) 는 page 의 ◇ 를 세지 않는다.
  - 대가: 열어 본 프로젝트의 문서가 커진다 — 저장 id 를 짧게 (`project:node:cp-<역할>-<hash>`) 하고 줄 · 칸 · Column frame 을 걷어 Library 464 KB · 1,139 노드 (처음 1 MB · 1,611 노드, 사용자 「Library 가 왜 1mb」). 코드 라이브러리가 바뀌어도 저장된 page 는 그대로다 — 이 변경 전에 저장된 page 도 옛 모양 그대로.
  - 위치: `packages/shared/src/catalog/document/{componentPages.ts,graph.ts}` (`setViewChildren` · `commandReader`) · `transactions/transaction.ts` · `runtime/controller.ts` (`load`) · `apps/builder/src/builder/catalogRuntime/{componentsPage.ts,workspace.ts,previewChannel.ts,layerTree.ts}`

### Changed

- **ToggleButton 기본 Label 「Toggle Button」 → 「Toggle」** (사용자 요청 2026-10-25) — 원본 기본값 (`reusableOriginLibrary.ts`) · 편집 스키마 기본값 · 기본 props 셋 다. Label 을 직접 적지 않은 ToggleButton 은 모두 「Toggle」 로 보인다.
- **문서 계약 48** — override 가 사본 (`templateRootId` · `templateMap`) 을 가질 수 있고 노드가 `displayState` · `originOf` 를, project 가 `componentPageIds` 를 가질 수 있다. contract 47 문서는 열리지 않는다 (변환 없음 — 개발 단계 정책). 저장소 샘플 3 개는 번호만 48.

## [Local page 컴포넌트 slot 삭제 — 채운 instance 가 있으면 거부되던 문제] - 2026-10-24

### Fixed

- **Library 가 잠긴 상태에서도 Library page 가 편집되던 문제** (사용자 보고 2026-10-25 「잠금해제 하지 않아도 수정 가능하다」): 잠금 중에는 원본 표본 (루트 기본값 포함) · 해제 사본 · page 자신의 노드 (body · 카드 · 줄 · ◇) 모두 편집을 거부하고 「The Library is locked」 안내를 띄운다 (`originView.ts` `catalogOriginEditCommand`). 해제하면 전부 편집된다.
- **Library page 의 ◆ 칸을 편집한 프로젝트가 다시 열리지 않던 문제 (`entry.children[0]`)** (ADR-282 Phase 3 · 사용자 보고 2026-10-25): 저장이 바뀐 노드를 view 가 덧붙인 자식 (◆ 표본) 까지 담아 기록했다 — 이제 문서에 저장된 모습 그대로 기록한다 (`controller.ts` → `graph.storedEntry`). 이미 그렇게 저장된 프로젝트는 그대로다.
- **Local page 원본에서 slot 노드를 지우면 `UNOWNED_NODE` 로 삭제가 거부되던 문제** (ADR-282 리뷰 Round 2 가 재현):
  - **Why**: `removeWithReferrers` 는 지워진 자리를 가리키는 instance override 를 걸러 내면서 `replace` 의 대체 노드만 같이 지웠다. `fillSlot` 의 채움 노드는 남아 소유자를 잃었고, transaction 검증이 거부했다 (문서는 보존됨).
  - 수리: 탈락한 `fillSlot` 의 채움 서브트리도 같은 step 에서 지운다. 그 노드가 가진 interaction · 상태 변수도 함께 정리된다. 한 번의 undo 로 slot · 채움 내용 · override 가 모두 돌아온다.
  - 위치: `packages/shared/src/catalog/commands/structure.ts` (`removeWithReferrers`)

## [Layout 이름 변경 — Page 처럼 행 더블클릭] - 2026-10-24

### Added

- **Navigator Layouts 탭의 Layout 이름을 행에서 바꾼다** (사용자 요청 「Layout 은 Page 와 같은 개념」): 행을 더블클릭하면 이름 칸이 열리고, Enter 나 포커스 이동으로 확정, Escape 로 취소한다. 확정은 `renameDefinition` 한 step 이고, History 에는 「레이아웃 이름 변경」으로 남는다. Components 탭의 고정 페이지 두 개는 대상이 아니다.
  - 이름 칸은 Page 행과 같은 부품 (`InlineRenameInput`) 이다.
  - 이름 칸 상태는 행 부품이 갖는다. RAC 컬렉션이 항목이 바뀌기 전까지 행 내용을 다시 그리지 않아서, 섹션 상태로 두면 칸이 열리지 않았다 (live 에서 확인).
  - 위치: `apps/builder/src/builder/panels/navigator/{catalog/CatalogDefinitionsSection.tsx,tree/InlineRenameInput.tsx,tree/PageTree/PageTreeItemContent.tsx}`

## [Layers 선택 깜빡임 · 다른 페이지 요소 선택 한 번에] - 2026-10-24

### Fixed

- **Layers 행을 누르면 새 행이 비었다가 이전 행이 진하게 남고, 그다음 새 행이 선택되던 문제** (사용자 보고 「선택활성화 → 이전활성화 → 선택활성화」):
  - **Why**: 행 바탕에 `transition: background-color 100ms` 가 있었다. 같은 날 선택 색을 `--accent` 채움과 흰 글자로 바꾼 (`b2557f70c`) 뒤로는, 글자색은 바로 바뀌고 바탕만 서서히 바뀌었다. 그래서 그 사이 새 행은 밝은 바탕 위 흰 글자로 비어 보였고, 이전 행만 진하게 남았다. 4x throttle 에서는 이 중간 프레임이 길게 보였다.
  - 수정: 행 바탕 transition 을 없앴다. 이제 선택은 한 프레임에 바뀐다 (화면 녹화 프레임으로 확인).
  - 위치: `apps/builder/src/builder/panels/navigator/NavigatorPanel.css`
- **다른 페이지 요소를 선택하면 페이지 전환과 선택이 따로 반영되던 문제** — 구독자가 「새 페이지 + 선택 없음」 상태를 한 번 거쳤다. 이제 `session.setPage(pageId, selection)` 으로 한 snapshot 에 같이 쓴다 (`04fffe8c6`).
  - 위치: `apps/builder/src/builder/catalogRuntime/{session,workspace}.ts`

## [Tree 자동 체크박스 · State 이름표 · body 높이 기본값 · 실패하던 테스트 23 정리] - 2026-10-24

### Fixed

- **checkbox 방식 Tree 에서 내용 노드 (TreeItemContent) 가 없는 항목에 Preview 만 선택 체크박스를 그리던 문제**:
  - **Why**: 2026-10-23 체크박스 선택 지원 (`51d5ecfc8`) 이 TreeItem 원본에 작성자 `Checkbox[slot=selection]` 노드를 넣으면서 공용 `TreeItemContent` 의 자동 체크박스도 되살렸다. 그래서 노드가 없는 항목은 DOM 에만 체크박스가 생겼고 Canvas 에는 없었다. ADR-256 후속 16 이 지운 비대칭이다.
  - 수정: 자동 체크박스는 공용 `Tree` 의 데이터 행 경로 (작성할 노드가 없는 행) 에서만 켠다 (`autoSelectionCheckbox`).
  - 위치: `packages/shared/src/components/Tree.tsx`
- **State 절의 컴포넌트 상태 이름표가 같은 영어의 다른 한국어와 갈리던 문제** — 상태 이름표를 RAC 레퍼런스의 prop 이름 그대로 보인다 (두 언어 같은 이름, 사용자 「레퍼런스에 나온대로」): `isSelected` · `isExpanded` · `isOpen` · `selectedKeys` · `selectedKey` · `inputValue` · `value` · `expandedKeys` (옛 「선택 여부」 · 「선택한 항목」 · 「선택한 탭」 · 「입력한 텍스트」 · 「현재 값」 · 「펼친 항목」 …). 이름표 대응표 (`SOURCE_LABEL_KEYS`) 와 번역 키 9개는 지웠다. 같은 영어 `Item key` 의 한국어는 RAC `Key` 를 따라 「항목 key」 하나로 맞췄다 (`capabilities.paramItemKey` 「항목 키」 → 「항목 key」).
  - 위치: `apps/builder/src/i18n/translations.ts` · `panels/properties/catalog/CatalogStateSection.tsx`
- **높이를 쓰지 않은 body 의 Styles Height 기본값이 「100%」 로 해석되던 문제** — 2026-10-21 Preview body 의 `height: 100%` (DOM 전용 fallback) 를 패널 기본값 해석이 읽었다. 레이아웃 컨테이너 (body · frame · Slot) 는 containerStyles 의 높이 축을 기본값으로 내지 않는다. 실효값이 있으면 그 값 (실측 844 PX) 이 먼저라 이 화면에서는 차이가 보이지 않는다.
  - 위치: `apps/builder/src/builder/panels/styles/utils/specPresetResolver.ts`

### Changed

- **TreeItem 의 selection Checkbox template 을 원본 정본 파일로 옮겼다** — 빌드 때 끼워 넣던 코드 (`codeCatalogLibrary.ts` `CODE_CATALOG_REUSABLE_TEMPLATES`) 를 지우고 `generated/reusableOriginLibrary.ts` 에 직접 둔다. 라이브러리 revision 은 그대로다.
- **기능 변경 뒤 갱신되지 않은 테스트 23건 정리**:
  - ADR-276 으로 지운 IconButton 원본 → Button 원본 (shared 10건).
  - ADR-277 Table starter 열 (1건) · 계약 번호 47 (1건) · Collection 섹션의 `dataBinding` (1건).
  - Tree selection Checkbox 구조 (builder 6건).
  - 그 밖: Properties 섹션 순서의 `collection` (1건), Disclosure 기본 폭 `100%` (2026-10-19 `affebfb69`, 1건), i18n 표기 · body 높이 (위 Fixed, 2건).
  - 위치: `packages/shared/src/catalog/**/__tests__` · `apps/builder/src/builder/catalogRuntime/__tests__`

## [Preview — collection 다시 읽기가 연결된 endpoint 로] - 2026-10-24

### Fixed

- **이름이 같은 collection 이 있으면 Preview 의 「collection 다시 읽기」 (reload) · 페이지 · 검색 · 정렬 · 경로 읽기가 다른 collection 의 endpoint 를 실행하던 문제**:
  - **Why**: Preview 세션이 collection 이름으로만 endpoint 를 찾아, 같은 이름의 첫 endpoint 가 실행됐다. Builder 도 id 로 연결된 collection 이 지워지면 남은 이름을 보내, 나중에 그 이름을 쓴 다른 collection 이 그 endpoint 로 채워질 수 있었다 (code review 2026-10-24).
  - 수정: Builder 가 endpoint 에 연결 collection id (`targetCollectionId`) 를 같이 싣고, 연결이 끊긴 endpoint 에는 대상을 싣지 않는다. Preview 세션은 id 가 있으면 id 로만, 없을 때만 이름으로 찾는다 (Builder `dataActions` 와 같은 규칙).
  - 위치: `packages/shared/src/catalog/runtime/catalogPreviewSession.ts` (`endpointFilling`) · `apps/builder/src/builder/utils/endpointTarget.ts` · `CatalogPreviewFrame.tsx` (store 를 한 번 읽어 보낸다)

## [Canvas — 드래그 중 slot · 행 나머지 · 배지 표시 위치] - 2026-10-24

### Fixed

- **드래그 중 빈 slot 빗금 · 「+N more」 · 데이터 배지가 끌리거나 비켜나는 요소에서 어긋나던 문제**:
  - **Why**: 렌더러는 단계마다 offset (끌기 · 형제 비킴) 을 부모 위치에 더하고 (`translateStack`) 끌리는 서브트리는 top layer 에서 조상 offset 없이 그린다. 그런데 slot 표시는 가장 가까운 조상의 offset 하나만 받았다. 그래서 비켜나는 컨테이너 안의 비켜나는 자식 아래 빗금이 컨테이너 offset 만큼 어긋났다. 행 나머지와 배지는 드래그 offset 을 아예 받지 않았다. 끌리는 서브트리는 모든 page 위에 그려지는데 표시는 원래 page 의 가림 상자로 잘렸다 (code review 2026-10-24).
  - 수정: `catalogDragPlacement` 가 렌더러와 같은 규칙으로 record 의 그리는 위치를 계산한다 — 조상 offset 을 합치고 top layer root 에서 멈춘다. 같은 프레임의 slot · 행 나머지 · 배지가 이 계산을 공유한다. 끌리는 서브트리의 표시는 가림 상자로 자르지 않는다.
  - 위치: `apps/builder/src/builder/workspace/canvas/catalog/catalogOverlayChrome.ts` · `CatalogCanvas.tsx` · `catalogOverlay.ts`

## [Layers — 선택 행의 1단계 펼침 · 선택 영역 표시] - 2026-10-24

### Changed

- **Navigator Layers 에서 요소 하나를 선택하면 그 요소의 직계 자식이 펼쳐진다** (Framer) — 손자 행은 접힌 채 둔다. Canvas 선택도 같고, 사용자가 접은 행은 다시 선택해도 펼치지 않는다.
- **선택 행과 그 아래 펼쳐진 행이 한 영역으로 표시된다** — 선택 행이 위 모서리, 영역의 마지막 행이 아래 모서리를 갖는다. 선택 행 바탕은 `--accent` 에 글자 · 아이콘 `--bg-overlay`, 아래 행은 바탕만 그 8% (Navigator 의 모든 트리 선택 행에 적용 — 누르는 중에도 유지).

### Fixed

- **선택 표시가 이전 선택 기준으로 남던 Layers 행**:
  - **Why**: 행이 선택 정보를 render 클로저로 받았는데, RAC 는 행 자신의 상태가 바뀔 때까지 그 행의 render 를 재사용한다 — 선택을 옮기면 상태가 안 바뀐 행은 이전 선택의 영역 · 안내선 강조를 그렸다 (새 테스트의 leaf 선택 단언이 원복 시 `tail` 로 RED).
  - 수정: 선택 정보 (`selectedKeys` · 조상 사슬 · 영역 끝 행) 를 context 로 행에 준다.
  - 위치: `apps/builder/src/builder/panels/navigator/catalog/CatalogLayersSection.tsx` (`CatalogLayerRow`)

## [Image — 업로드한 그림의 Preview 주소] - 2026-10-24

### Fixed

- **업로드한 그림을 src 로 쓴 Image 가 Preview · publish 에서 깨지던 문제** — `asset:` 참조를 실행 시점 URL 로 풀어 `img` 에 싣는다 (Avatar 와 같은 `resolveAssetUrl`).
  - **Why:** DOM 은 `props.src` 를 그대로 넘겨 `asset:sha256-…` 문자열이 `img src` 가 됐다 — Canvas 는 이미지 캐시가 같은 참조를 풀어 그려 두 화면이 갈렸다.
  - 위치: `packages/shared/src/catalog/runtime/domBinding.runtime.ts`

## [Layers — 선택으로 펼친 행 유지] - 2026-10-24

### Fixed

- **Canvas 에서 요소를 선택할 때 Navigator Layers 트리가 떨리거나 강조 행이 위아래로 튀던 문제** — 선택으로 펼친 행은 선택이 옮겨가거나 풀려도 펼친 채 둔다 (Figma). 사용자가 접은 행과 Collapse all 은 그대로 접힌다.
  - **Why:** 펼침 상태가 현재 선택의 조상만으로 계산돼 선택이 바뀔 때마다 이전 선택 쪽 행이 접히고 새 선택 쪽 행이 펼쳐졌다 (실측 행 수 11 → 6 → 9). 더블클릭으로 안쪽을 고르면 컨테이너 선택 → 안쪽 선택이 약 30ms 안에 연달아 와 강조 행이 위로 튀었다 돌아왔다.
  - 위치: `apps/builder/src/builder/panels/navigator/catalog/CatalogLayersSection.tsx`

## [Design 패널 — Accessibility 절 · Style 탭 Class 절] - 2026-10-24

### Removed

- **Property 탭 헤더의 Copy properties / Paste properties 버튼 제거** — 컴포넌트별 속성 구성이 다른 Property 탭의 헤더 버튼을 제거한다. 스타일 탭의 Copy styles / Paste styles 버튼은 유지한다.

### Changed

- **Property 탭 Attributes 절 → Accessibility 절 (ID · Aria Label), Class Name 은 Style 탭 Class 절로** — RAC API 표의 묶음을 따른다: `id` · `aria-label` 은 Accessibility, `className` · `style` 은 Styling.
  - **Why:** 한 절에 Accessibility 묶음 (ID · Aria Label) 과 Styling 묶음 (Class Name) 이 섞여 있었다. Aria Label 이 나오는 조건 (RAC 가 이름을 만들지 못할 때만) 은 그대로다.
  - 위치: `apps/builder/src/builder/panels/properties/catalog/CatalogAccessibilitySection.tsx` · `apps/builder/src/builder/panels/styles/catalog/CatalogClassNameSection.tsx`

## [Image — src · alt 속성] - 2026-10-24

### Fixed

- **Image 의 Image URL (`src`) · Alt Text (`alt`) 를 Design 패널에서 편집** — S2 `Image` 의 두 prop. Preview · publish 의 `img` 가 그 값을 싣고 (`src` 없으면 속성 없음 · `alt` 없으면 `""`), Canvas 는 자리표시 배경 위에 그림을 cover 로 그린다.
  - **Why:** Image 는 binding 없는 rule-only type 인데 `RULE_TYPE_PROP_CONTRACTS` 에 항목이 없어 Property 탭에 필드가 없었고, DOM 은 `alt=""` 고정 · Canvas 는 상자만 그렸다.
  - 위치: `packages/shared/src/catalog/document/itemLinks.ts` · `catalog/runtime/domBinding.runtime.ts` · `apps/builder/src/builder/catalogRuntime/ruleShapes.ts`

## [데이터 연결 용어 — Collection 구성과 Table 원본 구분] - 2026-10-24

### Fixed

- **테이블 연결 문구 통일** — Data 패널은 `Tables / 테이블`, 생성 액션은 양쪽 패널 모두 `New table / 새 테이블`로 표시한다. Properties의 `Collection` 섹션은 유지하고, 10종 컴포넌트의 연결 필드 legend와 선택 접근성 이름은 `Data source / 데이터 소스`, placeholder는 `Choose a table… / 테이블 선택…`, 빈 상태는 등록된 테이블 안내로 정리한다.
- **Value field 선택의 열쇠 아이콘 제거** — 테이블 연결 후 `Value field: Auto` 앞에 표시되던 장식 아이콘을 제거한다.

## [컬렉션 데이터 연결 — Item key 는 Form 에만] - 2026-10-24

### Changed

- **바인딩의 「Item key (one item)」 입력을 Form 에만 표시** — ListBox · GridList 등 컬렉션 컴포넌트와 Chart 의 Collection 절에서는 숨긴다.
  - **Why:** `useListData.getItem(key)` (2026-10-22) 는 Form 이 한 항목을 읽어 필드를 채우는 자리인데, 바인딩 UI 가 하나라 모든 컴포넌트에 나왔다. 컬렉션 컴포넌트에 채우면 목록이 그 한 항목만 보인다.
  - 위치: `apps/builder/src/builder/components/property/CollectionBinding.tsx`

## [성능 ratchet — push 자동 실행 끔] - 2026-10-24

### Infrastructure

- **ADR-246 결정적 카운트 ratchet 을 push 에서 기본으로 돌리지 않는다** — 성능 작업 때 `pnpm gate:perf-ratchet` 로 직접 돌리고, push 에서 돌리려면 `PERF_RATCHET=1 git push origin main`.
  - **Why:** push 마다 seed 전체 측정 + 재측정이 작업 시간보다 길었고, 같은 코드에서 63 · 64 로 갈리는 키가 두 번 다 위쪽이면 push 가 막혔다. 게이트가 잡아 고친 것은 호출 수 줄이기 위주로 체감 속도와 거리가 있었다 (사용자 결정 2026-10-24).
  - 위치: `.githooks/pre-push` · `scripts/install-git-hooks.sh` · `CLAUDE.md`

## [컬렉션 데이터 연결 — 모든 컬렉션의 항목 필드 · Icon field 삭제] - 2026-10-24

### Changed

- **항목 필드 절을 모든 바운드 컬렉션에** — ListBox · GridList · TagGroup · Tree · Breadcrumbs · Select · ComboBox 를 데이터에 연결하면 행 template 안의 글자 · 그림 칸 (Text `children` · Icon `iconName` · Image · Avatar `src` …) 에 열을 `{field}` 로 연결하는 절이 나온다. 절 이름은 「Card fields / 카드 필드」 → 「Item fields / 항목 필드」. 부품 안 항목 (TagGroup > TagList > Tag · Select > Popover > ListBox) 도 찾고, 항목의 조작 부품 (Tag 삭제 · Tree 펼침 · 선택 Checkbox) 과 Tree 의 표본 하위 행은 절에 넣지 않는다.
  - **Why:** 렌더 쪽 (resolver 의 행 반복 · `{field}` 보간) 은 이미 모든 컬렉션에 공통인데, 패널만 ADR-162 의 「GridList 먼저」 범위를 ADR-248 Phase 4e-4e-2d-2 에서 그대로 옮겨 GridList 전용이었다. 행 항목 종류도 resolver 와 다른 목록 (ListBoxItem · GridListItem 만) 이라 TagGroup · Tree · Breadcrumbs 는 「항목 원본」 안내도 나오지 않았다.
  - 위치: `apps/builder/src/builder/catalogRuntime/rowTemplate.ts` · `panels/properties/catalog/CatalogRowTemplateSections.tsx`

### Removed

- **바인딩의 Icon field (`fieldMap.icon`)** — 그림 칸은 항목 필드 절에서 연결한다. 연결하지 않은 칸은 지금처럼 `icon` · `avatar` 같은 열 이름 추정으로 채운다. 옛 문서의 `fieldMap.icon` 은 읽지 않는다 (추정으로 돌아간다).
  - **Why:** GridList 카드에는 `{icon}` 을 읽는 자식이 없어 아무 효과가 없었고, 다른 컬렉션에서는 같은 칸을 고르는 길이 두 개 (바인딩 열 역할 · 항목 필드) 가 됐다. RAC 에는 「아이콘 열」 개념이 없다 — 항목 안 Icon 이 행 값을 읽는다.
  - 위치: `apps/builder/src/builder/components/property/PropertyDataBinding.tsx` · `packages/shared/src/collections/resolveCollectionItems.ts`

## [컴포넌트 상태 — 직접 편집과 변경값만 반영] - 2026-10-24

### Changed

- **상위 범위 변수 그룹 명칭 정리** — State 섹션의 `Visible from ancestors` / `조상에서 보이는 상태`를 `Inherited variables` / `상속된 변수`로 변경한다.
- **Component state를 기존 입력칸에서 바로 편집** — 별도 활성화 버튼과 추가 입력창을 제거한다. 포커스 이동·Enter 시 기존 이름과 실제로 다른 값만 등록·변경한다. 우측 제거 버튼은 이름이 바뀌었거나 연결된 변수가 있을 때 활성화되고, 아직 등록하지 않은 편집은 제거 버튼으로 되돌릴 수 있다. 변수를 제거하면 원래 상태 이름으로 돌아온다.
  - 위치: `apps/builder/src/builder/panels/properties/catalog/CatalogStateSection.tsx` · `panels/properties/state/StateSection.css`

## [속성 패널 Select — 다시 그릴 때 항목 렌더 · 번역 생략] - 2026-10-23

### Performance

- **닫힌 PropertySelect 가 같은 옵션으로 다시 그릴 때 항목 목록을 재사용** — RAC Select 는 닫혀 있어도 collection 을 만들려고 모든 ListBoxItem 을 렌더한다. 항목 목록을 옵션 · 번역 함수 기준으로 memo 해 선택이 바뀔 때마다 항목 렌더와 번역을 반복하지 않는다 (frame · page 루트 Locale 37 항목에서 선택마다 ×4~5 → 1회).
  - **Why:** ADR-246 ratchet 이 seed 60 select 의 I18n 호출 증가를 잡았고, 재측정으로 Locale Select 의 반복 번역이 원인임을 확인했다.
  - 위치: `apps/builder/src/builder/components/property/PropertySelect.components.tsx` (`11d4acbb0`)

### Infrastructure

- **ADR-246 ratchet 실행 시간 단축** — seed 를 동시 3개 · 오래 걸리는 seed 먼저 실행하고, 하니스 실패는 seed 별 1회 재시도, 재측정은 상한을 넘은 seed 만 다시 잰다. 상한 47개 raise · zoom 의 양봉 키 10개 A → B 이동 (사용자 승인 · 만료 2027-04-23).
  - 위치: `apps/builder/scripts/perf-ratchet-run.mjs` · `apps/builder/perf/ratchet.json` (`11d4acbb0` · `046d74b04`)

## [State 변수 편집 — 이름과 타입을 합친 단일 행] - 2026-10-23

### Changed

- **Custom variables를 펼침 없이 한 가로 행에서 편집** — Name 입력 오른쪽에 선택된 타입 이름을 표시하고, 누르면 타입 메뉴를 연다. 기본값은 옆 필드에, 삭제는 우측 fieldset-actions에 배치한다. 공통 PropertyInput의 보조 컨트롤 슬롯을 사용한다.
  - 위치: `apps/builder/src/builder/panels/properties/catalog/CatalogStateSection.tsx`

## [State 속성 — 컴포넌트 상태의 사용 목적 안내] - 2026-10-23

### Changed

- **암묵 상태를 컴포넌트 상태로 정리** — 컴포넌트 상태만 legend로 표시하고 개별 상태의 중복 legend는 숨기되 접근 이름을 유지한다. 기존 Property 필드와 같은 fieldset-row와 우측 fieldset-actions에 사용·편집·삭제 버튼을 배치하고, 공통 PropertyInput의 Enter·blur로 등록한다. 다른 곳에서 사용 툴팁과 펼친 영역 안내로 목적을 알린다. 등록 후에는 `{{ 변수명 }}` 참조 방법과 자동 갱신 안내를 제공한다. 명시 상태는 직접 만든 변수로 표시하고, 추가 버튼은 State 헤더의 공통 + 액션으로 제공한다. 접힌 상태에서 추가하면 편집 영역을 펼친다.
  - 위치: `apps/builder/src/builder/panels/properties/catalog/CatalogStateSection.tsx` · `panels/properties/state/StateSection.css` · `i18n/{types,translations}.ts`

## [Slot 속성 — 복원 버튼 스타일 통일] - 2026-10-23

### Fixed

- **Items 옆 Restore 버튼을 공통 SwatchIconButton으로 통일** — 다른 fieldset-actions 버튼과 같은 배경·안쪽 아이콘 영역·그림자·상호작용 스타일을 사용한다.
  - **Why:** Slot 복원만 일반 control-button을 사용해 공통 행 액션 버튼과 시각적으로 달랐다.
  - 위치: `apps/builder/src/builder/panels/properties/catalog/CatalogSlotSection.tsx`

## [컬렉션 연결 — 속성 액션 정리] - 2026-10-23

### Changed

- **연결 해제를 fieldset-actions로 이동** — 데이터 선택 컨트롤 밖의 액션 열에 연결 해제를 배치하고, Collection의 새 테이블 버튼은 섹션 헤더 액션으로 이동한다. 내부의 Open this table · Used by 영역을 제거한다. Canvas의 데이터 이동 기능을 이용한다.
  - 위치: `apps/builder/src/builder/components/property/PropertyDataBinding.tsx` · `PropertyDataBinding.css` · `components/styles/panel-system.css` · `panels/properties/generic/GenericFieldRenderer.tsx`

## [컬렉션 속성 — Collection 섹션 분리] - 2026-10-23

### Changed

- **컬렉션 데이터 바인딩을 Content에서 Collection 섹션으로 이동** — ListBox · GridList · Table · Tree · TagGroup · Menu · Select · ComboBox · Tabs · Breadcrumbs에 적용한다. Label · Description 같은 일반 콘텐츠는 Content에 유지하고, Collection은 Content 다음에 배치한다.
  - 위치: `packages/shared/src/catalog/bindings/*.binding.ts` · `apps/builder/src/builder/panels/properties/generic/GenericFieldRenderer.tsx`

## [컬렉션 빈 상태 — RAC renderEmptyState 를 IllustratedMessage 자식으로] - 2026-10-23

### Added

- **ListBox · GridList · Tree · TagGroup · Menu 가 빈 상태를 기본으로 갖는다** — 팔레트로 놓은 컬렉션에 IllustratedMessage ("No results") 가 이미 들어 있어, 놓고 데이터에 연결하면 끝이다. 그 IllustratedMessage 가 RAC `renderEmptyState` 의 내용이고 (S2 예제 모양, 사용자 결정 2026-10-23 — 원본 컴포넌트에 기본 포함), 항목 · 바운드 행이 0 일 때만 Canvas 와 Preview 둘 다 그리며, 항목이 있으면 둘 다 숨긴다. 지웠으면 Design 패널 Slot 의 넣기 목록에서 다시 넣는다. 이미 놓은 컬렉션에는 생기지 않는다 (옛 문서 변환 없음).
  - Layers 에는 「EmptyState」 로 보이고 (노드 type 은 S2 그대로 IllustratedMessage — 새 컴포넌트 type 없음, 사용자가 이름을 바꾸면 그 이름), 그림은 S2 예제의 FolderOpen (`folder-open`) 이다.
  - 항목 「+」 · Slot 넣기 · 팔레트 넣기는 새 노드를 빈 상태 앞에 둔다 — 빈 상태는 항목 뒤에 남는다 (`catalogAppendIndex`).
  - **Layers 도 Canvas 에 그려진 대로다** — 항목 · 행이 있으면 EmptyState 행이 없고, 데이터가 0행이면 그려지지 않는 항목 틀 대신 EmptyState 하나만 보인다 (`workspace.collectionRowHidden`, 사용자 지적 2026-10-23). 행이 있는 동안 EmptyState 를 고치려면 데이터를 비우거나 항목을 지운다. 바인딩 · 데이터 도착 · 항목 삭제로 판정이 바뀌면 그 step 에서 바로 다시 그린다 (전에는 행 목록이 그대로면 선택할 때까지 옛 트리가 남았다 — `collectionGated`, 사용자 보고 「동기화가 느리다」).
  - **EmptyState 는 컬렉션과 함께만 지워진다** — 선택 후 Delete 키 · Layers 삭제 버튼 (버튼 없음) · 밖으로 끌어 옮기기 모두 거절하고 안내를 띄운다 (`removeTargets` · `moveNodes` 의 `emptyStateCollectionOf`, 사용자 지적 2026-10-23). 컬렉션 안 순서 바꾸기와 컬렉션째 삭제는 된다.
  - 항목을 다 지워 EmptyState 만 남아도 바운드 목록은 원본 항목으로 행을 그린다 (resolver 가 남은 자식이 아니라 남은 항목을 센다 — 전에는 자식이 0일 때만).
  - **항목 없이 데이터를 연결해도 행을 선택할 수 있다** — 자기 항목이 없는 컬렉션 (항목을 다 지우고 EmptyState 만 남은 ListBox · GridList · TagGroup …) 을 연결하면, 같은 step 에 원본의 첫 항목을 자기 노드로 하나 넣어 행 템플릿으로 쓴다 (항목 「+」 와 같은 결과, undo 한 번에 함께 되돌림). 전에는 원본 template 항목으로 행을 그려 Canvas · Layers 어디서도 행이 선택되지 않았다 (`dataBindingCommand.ts` `rowTemplateInsert`, 사용자 보고 2026-10-23). 이미 그 상태로 연결된 컬렉션은 다시 연결하거나 항목 「+」 로 행 템플릿을 넣는다.
  - 중첩 규칙: 컬렉션은 여전히 항목만 받고, IllustratedMessage 하나만 예외다 (`componentTraits` `emptyStateCollection` → `CATALOG_EMPTY_STATE_COLLECTIONS`).
  - 바운드 목록의 첫 로드 중에는 빈 목록에 S2 진행 원을 보인다 (Table 은 전부터 그랬고, 이제 ListBox · GridList · Tree · Menu 도 같다).
  - **Why:** 목록이 비면 아무것도 그리지 않아 「결과 없음」 을 보일 길이 없었다 (`rac-s2-integrations.md` §12 우선순위 1).
  - Builder 자체 목록의 수동 `[data-empty]` 규칙 (가운데 정렬 · 기울임) 은 카탈로그 목록에 적용하지 않는다 — Canvas 에 대응이 없어 두 쪽 배치가 달라진다.
  - 남은 것: TableBody (RAC 가 `td colSpan` 행에 그림) · CardView. Menu 는 연결만 하고 Preview 테스트 · live 는 아직이다.
  - 위치: `packages/shared/src/catalog/document/generated/reusableOriginLibrary.ts` (원본 5종의 `__empty-state`) · `catalog/commands/structure.ts` · `collections.ts` · `packages/shared/src/domain/componentTraits.ts` · `catalog/nesting/nestingRules.ts` · `catalog/runtime/presence.ts` (`catalogCollectionHasItems`) · `catalog/runtime/delegatedDom.runtime.ts` (`catalogEmptyState` · `catalogLoadingEmptyState`) · `delegatedDom.components.tsx` (TagList) · `components/styles/{ListBox,GridList,Tree}.css` · `apps/builder/src/builder/catalogRuntime/slots.ts` · 테스트 `emptyState.test.tsx` (원복 RED) · `adr256SlotInsertOptions.test.ts`

## [Tree — Checkbox 선택 스타일 표시] - 2026-10-23

### Fixed

- **Tree의 Selection Style = Checkbox가 행에 체크박스를 표시** — TreeItem origin에 RAC `Checkbox[slot=selection]`을 제공하고, `selectionMode`가 선택을 허용하며 `selectionStyle`이 `checkbox`일 때 Canvas와 Preview에 표시한다. `highlight` 또는 `none`에서는 숨긴다. Preview 체크박스 클릭은 해당 행을 선택한다.
  - **Why:** `selectionStyle`은 RAC의 선택 동작으로만 변환됐고 TreeItem 행에는 선택 Checkbox 슬롯이 없어 표시가 바뀌지 않았다.
  - 위치: `packages/shared/src/catalog/document/codeCatalogLibrary.ts` · `catalog/runtime/presence.ts` · `catalog/runtime/delegatedDom.runtime.ts` · `components/Tree.tsx` · `components/styles/Tree.css` · 인접 테스트

## [Tree — 평면 collection의 부모 ID 연동] - 2026-10-23

### Added

- **Tree 데이터 연결에 부모 ID 필드 추가** — `id`·`parentId` 행을 가진 일반적인 테이블에서 부모 ID 필드를 선택하면 Canvas와 Preview가 같은 계층을 표시한다. 원본 행 순서를 형제 순서로 사용하며, 기존 하위 항목 배열 연결은 유지한다.
  - Preview의 하위 항목 추가·이동·삭제는 평면 행의 부모 ID를 갱신한다. 존재하지 않는 부모와 순환 관계는 행을 숨기지 않고 최상위에 표시한다.
  - **Why:** 기존 연결은 각 행의 `children` 배열만 읽어, 평면 테이블의 부모 관계가 모두 한 단계로 표시됐다.
  - 위치: `packages/shared/src/collections/resolveCollectionItems.ts` · `catalog/runtime/dataBinding.ts` · `catalogPreviewSession.ts` · `components/Tree.tsx` · `apps/builder/src/builder/components/property/PropertyDataBinding.tsx` · 인접 테스트

## [ComboBox — 입력칸 글자가 선택을 따른다 · API 편집기 Params 빠른 입력 글자 유실] - 2026-10-23

### Fixed

- **Preview · publish 의 ComboBox 입력칸이 선택된 항목의 글자를 보인다** — 목록에서 고르기 · 규칙 (`selectItem`) · load 가 돌려준 선택 (`selectedKeys`) 모두. 전에는 선택은 바뀌어도 입력칸이 그대로 (빈 칸) 였다: running Preview 가 `selectedKey` 와 `inputValue` 를 둘 다 controlled 로 넘기면 RAC 는 글자 동기화를 쓰는 쪽에 맡긴다 (레퍼런스 「Fully controlled」).
  - blur 하면 고친 글자가 선택 항목 글자로 돌아오고, `allowsCustomValue` 면 친 글자가 남는다 (RAC 그대로). 늦게 도착한 항목 (async 목록) 의 글자도 채운다.
  - 항목 action 이 목록을 먼저 닫는 경우 (virtual 클릭 · 항목에 action) 에도 고른 뒤 목록이 다시 열리지 않는다.
- **API endpoint 편집기 Params · Headers 의 이름 · 값 칸에 빠르게 치면 글자가 빠지던 문제** — 앞 글자의 저장이 늦게 돌아오면 편집기가 그 값을 외부 변경으로 보고 입력 중인 칸을 되돌렸다. 이제 자기가 보낸 값이 돌아온 것은 무시하고, 다른 편집 · undo 만 다시 반영한다.
- 위치: `packages/shared/src/catalog/runtime/comboBoxSelectionText.ts` (`CatalogComboBox`) · `delegatedDom.runtime.ts` (`combobox`) · `apps/builder/src/builder/panels/datatable/editors/ApiEndpointEditor.tsx` (`KeyValueEditor`) · 테스트 `comboBoxInputText.test.tsx` · `loadSelection.test.tsx` · `ApiEndpointEditor.test.tsx` (원복 RED)

## [Tree — 행 글자가 항목 이름 · S2 들여쓰기 (단계당 16px)] - 2026-10-23

### Changed

- **바운드 Tree 의 행 글자가 항목의 label (이름 필드)** — TreeItem 원본의 글자가 `"Tree item"` 고정에서 `{label}` 로 (ListBoxItem 과 같은 행 label, 레퍼런스 `<Text>{item.name}</Text>`). 바인딩 없는 Tree 는 starter 의 표본 글자 (Node 1 · Node 2) 그대로, 「+」 로 넣는 항목은 「Item N」.
  - 주의: 오늘 전에 「+」 로 넣어 글자를 고치지 않은 TreeItem 은 `{label}` 로 보인다 (ListBoxItem 과 같은 동작 — 글자를 한 번 쓰면 사라진다).
- **Tree 들여쓰기 = S2 TreeView** — `level-padding` 열 `(level − 1) × 16px` (전에는 4px 를 chevron 20px 상자 안에서 써 DOM 에서는 보이지 않았고, Canvas 는 상자를 4px 넓혀 두 consumer 가 달랐다). DOM `Tree.css` 와 Canvas `catalogTreeChevronLayout` 이 같은 상자 (폭 20 + 들여쓰기, 왼쪽 padding = 들여쓰기).
- 위치: `packages/shared/src/catalog/document/generated/reusableOriginLibrary.ts` (`component-tree-item-default__label`) · `catalog/runtime/presence.ts` (`TREE_LEVEL_PADDING`) · `components/styles/Tree.css` · 테스트 `treeData.test.tsx` · `treeItemChevronNode.test.ts` (원복 RED)

## [Data — 트리 데이터 (`useTreeData`) · 바운드 Tree 가 데이터 행을 반복] - 2026-10-23

### Added

- **바운드 Tree 가 계층 데이터를 단계별로 보인다** — 레퍼런스 `useTreeData` 의 `getChildren`.
  - Properties 데이터 연결에 「하위 항목 필드 (트리)」 (Tree 만) — 항목의 하위 항목 배열이 든 필드 (`fieldMap.children`).
  - 행마다 같은 TreeItem template 을 하위 항목마다 다시 놓는다 (레퍼런스 `<Collection items={item.children}>` 와 같은 render). Canvas · Preview 가 같은 resolver 를 읽는다.
- **트리 편집 Do** — `append` · `insert` · `prepend` 에 「부모 항목 key」 (`parentKey` — `useTreeData.insert(parentKey, index, …)`), `move` 에 「새 부모 항목 key」 (`toParentKey` — `move(key, toParentKey, index)`). 비우면 맨 위. `update` · `remove` · `insertBefore/After` · `moveBefore/After` 의 key 는 트리 어느 단계든 찾는다. 문서: Do 의 선택 칸 추가 (contract 47 그대로).
- 위치: `packages/shared/src/catalog/resolution/resolver.ts` (`nestTreeRows`) · `catalog/runtime/dataBinding.ts` · `catalogPreviewSession.ts` (`replayItemEdits` · `childrenKeyOf`) · `interactions/dispatcher.ts` · `PropertyDataBinding.tsx` · `CatalogRuleRow.tsx` · 테스트 `treeData.test.tsx` (원복 RED)

### Fixed

- **바인딩한 Tree 가 데이터 행을 반복하지 않던 문제** — TreeItem 이 행 반복 항목 (`CATALOG_ROW_ITEM_TYPES`) 에 없어, 바인딩해도 starter 의 표본 항목 (Node 1 · Node 2) 만 보였다.

## [Data — load 가 선택을 정한다 (`useAsyncList` load `selectedKeys`) · endpoint 편집기의 cursor 경로가 저장되지 않던 문제] - 2026-10-23

### Added

- **조회 응답의 선택 key 로 바운드 컴포넌트를 선택** — 레퍼런스 `useAsyncList` 의 `load` 가 `selectedKeys` 를 돌려주는 것과 같다.
  - endpoint 편집기 Params 탭 「선택 key 경로」 (`responseMapping.selectedKeysPath`, 예: `selected` — key 배열 또는 `"all"`).
  - 다시 읽기 · 검색 · 정렬의 key 는 선택을 바꾸고, 더 불러오기의 key 는 기존 선택에 더한다. 응답에 없으면 선택은 그대로.
  - ListBox · GridList · Table · Tree · TagGroup 은 `selectedKeys`, Select · ComboBox 는 첫 key 를 `selectedKey` 로 (단일 선택 목록은 하나만).
  - 위치: `packages/shared/src/collections/executeCollectionEndpoint.ts` · `catalog/runtime/catalogPreviewSession.ts` (`onLoadedSelection`) · `catalogPreviewInteractions.ts` (`selectLoaded`) · `ApiEndpointEditor.tsx` (`ResponsePathRow`) · 테스트 `loadSelection.test.tsx` (원복 RED)

### Fixed

- **endpoint 편집기의 「다음 페이지 cursor 경로」 가 저장되지 않던 문제** — 편집기 저장 (`toEndpointDraft` → `define_endpoint`) 이 `responseMapping` 중 `dataPath` 만 실어, 입력칸은 값을 보여도 store · 내보내기에 닿지 않았다 (이번 세션 1단계에서 넣은 칸). draft 에 `cursorPath` · `selectedKeysPath` 를 싣고 (`""` = 지움, undo 가 되돌림) 적용기가 반영한다.
  - 위치: `packages/shared/src/schemas/dataChange.ts` · `apps/builder/src/builder/stores/utils/dataChange.ts` (`withResponsePaths`) · 테스트 `dataChange.endpoints.test.ts` (원복 RED)

## [Data — Picker · ComboBox 읽는 중 스피너 · 열린 목록 끝 더 불러오기 (S2 `loadingState` · `onLoadMore`)] - 2026-10-23

### Added

- **바운드 Select (S2 Picker) · ComboBox 가 collection 의 읽는 중 상태를 보인다** — S2 설치본과 같은 자리 · 조건:
  - Select: 읽는 동안 (`loading`) 트리거 안 chevron 앞에 스피너, 목록이 열려 있으면 숨김.
  - ComboBox: 읽기 · 검색 (`loading` · `filtering`) 이 500ms 넘게 걸리면 입력 안 버튼 앞에 스피너, 새 입력이 오면 다시 기다린다 (검색은 목록이 열려 있을 때만).
  - 열린 목록의 끝이 보이면 다음 페이지를 읽는다 (`ListBoxLoadMoreItem` — picker 안 ListBox 는 picker 의 바인딩을 따른다).
  - 문서: Select · ComboBox 에 숨김 prop `loadingState` (패널 비노출, contract 47 그대로). Canvas 는 읽지 않으므로 그대로 (설계된 비대칭).
  - 위치: `packages/shared/src/catalog/runtime/pickerSpinner.ts` (`catalogPickerSpinner`) · `domBinding.runtime.ts` · `delegatedDom.runtime.ts` (`boundOwnerOf`) · `resolution/resolver.ts` · 테스트 `pickerLoading.test.tsx` (원복 RED)

### Fixed

- **Preview · publish 에서 ComboBox 목록이 열리지 않던 문제** — ComboBox 안 Popover 는 「아무도 열림을 제어하지 않음」(`catalogOpenOwnerOf` → `null`) 인데 DOM 이 이것을 「trigger 없는 본체」(`undefined`) 와 같이 읽어 Popover 를 `isOpen=false` 로 고정했다 (ADR-280 `ffcbe0590` 부터). 판정을 `=== undefined` 로.
  - 위치: `packages/shared/src/catalog/runtime/domBinding.runtime.ts` · 테스트 `pickerLoading.test.tsx` 「a ComboBox's list opens」 (원복 RED)

## [Interactions — `useListData` 위치 편집 (insert · insertBefore · insertAfter · prepend · move · moveBefore · moveAfter · removeSelectedItems)] - 2026-10-23

### Added

- **Do 「collection 위치에 넣기 · 항목 앞 · 뒤에 넣기 · 맨 앞에 넣기 · 항목 옮기기 · 앞 · 뒤로 옮기기 · 선택 항목 삭제」** — 레퍼런스 `useListData` 메서드 이름 · 인자 순서 그대로: `insert(index, …)` · `insertBefore(key, …)` · `insertAfter(key, …)` · `prepend(…)` · `move(key, toIndex)` · `moveBefore(key, keys)` · `moveAfter(key, keys)` · `removeSelectedItems()`.
  - 값은 `append` 처럼 record (`!event.formData`), 위치 · key 는 리터럴 또는 `!event.<인자>`. 모르는 key · 잘못된 위치는 보고 (조용한 no-op 없음).
  - `removeSelectedItems` 의 선택 = 그 collection 에 묶인 컴포넌트들의 현재 선택.
  - 세션이 `append` · `update` · `remove` 와 같은 편집 기록으로 들고 Builder 항목 위에 다시 적용한다 (H1 — 데이터 · 문서 무변경).
  - 문서: Do 8종 추가 (contract 47 그대로).
  - 위치: `packages/shared/src/interactions/dispatcher.ts` (`dispatchListPosition` · `CatalogListPosition`) · `catalog/runtime/catalogPreviewSession.ts` (`insert` · `move` · `positionIndex`) · `catalogPreviewInteractions.ts` (`selectedKeysOf`) · Interactions 패널 · 테스트 `listDataPositions.test.tsx` (원복 RED)

### Fixed

- **패널 입력이 숫자 0 을 빈 칸으로 보이던 문제** — `PropertyInput` 이 `String(value || "")` 라 0 이 사라졌다 (Do 「항목 옮기기」 의 위치 0 에서 발견). `??` 로 — `null` · `undefined` 만 빈 칸.
  - 위치: `apps/builder/src/builder/components/property/PropertyInput.components.tsx` · 테스트 `PropertyInput.zero.test.tsx` (원복 RED)

## [Data — 목록 끝에서 자동으로 더 불러오기 (`onLoadMore` · `*LoadMoreItem`) · ComboBox 입력이 서버 검색 (`filterText`)] - 2026-10-23

### Added

- **목록 끝 자동 `onLoadMore`** — S2 TableView · ListView · TreeView 처럼 바인딩만 하면 된다: Preview · Publish 에서 페이지를 넘기는 collection (endpoint 에 `cursorPath` 또는 `{{ cursor }}`) 에 묶인 ListBox · GridList · Table · Tree · Menu 의 끝에 RAC `ListBoxLoadMoreItem` · `GridListLoadMoreItem` · `TableLoadMoreItem` · `TreeLoadMoreItem` · `MenuLoadMoreItem` 을 둔다 — 끝이 보이면 다음 페이지를 읽고 (`useAsyncList.loadMore`), 읽는 동안 스피너. cursor 가 없으면 요청 없음, 읽는 중의 `loadMore` 는 무시 (레퍼런스와 같음).
  - 바운드 ListBox · GridList · Tree · Menu 도 `loadingState` 를 받는다 (패널 숨김 prop — S2 이름).
- **ComboBox 입력 = 서버 검색** — 레퍼런스 `<ComboBox items={list.items} inputValue={list.filterText} onInputChange={list.setFilterText}>`. 바운드 collection 의 endpoint 가 `{{ filterText }}` 를 읽으면 입력할 때마다 그 글자로 다시 읽고, 목록은 서버가 준 항목을 그대로 보인다 (`defaultFilter` 끔). endpoint 가 읽지 않으면 지금처럼 목록이 스스로 거른다. Autocomplete 안의 바운드 목록도 같은 연결 (서버 검색이면 `filter` 없음).
- 같은 collection 의 이전 요청 응답이 나중에 오면 버린다 — 마지막 글자 · 마지막 페이지가 이긴다 (레퍼런스는 이전 요청을 abort).
- 위치: `packages/shared/src/catalog/runtime/delegatedDom.runtime.ts` (`catalogLoadMoreItem` · `serverFiltered`) · `domBinding.runtime.ts` (TableBody · Autocomplete) · `catalogPreviewSession.ts` (`pages` · `serverFilterOf` · `loadSequence`) · `catalog/bindings/loadingStateProps.ts` · 테스트 `asyncList.test.tsx` (원복 RED)

## [Data — `useAsyncList` load 인자: 더 불러오기 · 서버 검색 · 서버 정렬 (`cursor` · `filterText` · `sortDescriptor`)] - 2026-10-23

### Added

- **load 인자를 조회 endpoint 템플릿으로** — 레퍼런스 `useAsyncList({ load({signal, cursor, filterText, sortDescriptor}) })` 의 인자 이름 그대로. endpoint 의 경로 · 쿼리에 `{{ cursor }}` · `{{ filterText }}` · `{{ sortDescriptor.column }}` · `{{ sortDescriptor.direction }}` 를 쓰면 Preview · Publish 세션이 그 값으로 읽는다. 아직 없는 값 (첫 페이지 · 검색어 없음) 의 쿼리는 보내지 않는다:
  - **더 불러오기 (`loadMore`)** — endpoint 편집기 Params 탭의 「다음 페이지 cursor 경로」 (`responseMapping.cursorPath`, 예 `next`) 가 응답에서 다음 cursor 를 읽는다. Do 「collection 더 불러오기」 가 다음 페이지를 이어 붙인다 (마지막 페이지면 요청 없음). cursor 가 URL 이면 그대로 읽는다 (레퍼런스의 `fetch(cursor || url)`). 「다시 읽기」 는 처음 페이지부터.
  - **서버 검색 (`setFilterText`)** — Do 「collection 검색어로 다시 읽기」 (값: 리터럴 · `!event.<인자>`). cursor 는 처음부터, S2 `loadingState: "filtering"`.
  - **서버 정렬** — 바운드 Table 의 열 정렬이 endpoint 가 `sortDescriptor` 를 읽으면 서버 정렬로 간다 (column = 열의 필드 key). 클라이언트는 받은 순서를 그대로 둔다.
  - 읽는 중 상태는 S2 `LoadingState` 값 6종 (`loading` · `sorting` · `loadingMore` · `filtering` · `error` · `idle`).
  - 페이지를 넘기는 endpoint (`cursorPath`) 와 템플릿 endpoint 는 세션이 직접 첫 페이지를 읽는다 (cursor 가 세션 것).
  - Builder 실행 (Auto · 시험 실행) 은 load 인자를 빈 값으로 — 그 쿼리를 빼고 첫 페이지를 읽는다.
  - 문서: Do `loadMore` · `setFilterText` (contract 47 그대로, 추가만).
  - 위치: `packages/shared/src/collections/executeCollectionEndpoint.ts` (`loadCollectionEndpoint` · `ENDPOINT_LOAD_ARGUMENTS`) · `catalog/runtime/catalogPreviewSession.ts` (`loadArguments` · `loadMore` · `setFilterText` · `sortCollection` · `serverSort`) · `interactions/dispatcher.ts` · `apps/builder/src/builder/stores/utils/dataActions.ts` · `panels/datatable/editors/ApiEndpointEditor.tsx` (`CursorPathRow`) · 테스트 `asyncList.test.tsx` · `dataActions.executeApi.test.ts` (원복 RED)
- **CRUD 스텁** — `GET /users` 가 `?q=` (이름 · 이메일) · `?sort=&dir=` 를 받고, `?limit=` 이면 `{items, next}` 페이지 (`?page=`).

## [Data — 바인딩된 Table · Skeleton 이 collection 의 읽는 중 상태를 따른다 (`useAsyncList.loadingState`)] - 2026-10-23

### Added

- **읽는 중 상태 (`loadingState`) 자동 연결** — 레퍼런스는 한 list 에서 `items` 와 `loadingState` 를 같이 넘긴다 (`<TableView items={list.items} loadingState={list.loadingState}>` · `<Skeleton isLoading={list.isLoading}>`). 빌더에서는 바인딩이 그 연결이다 — 문서에 새 칸 없음:
  - Preview · Publish 세션이 collection 마다 `loading` · `idle` · `error` 를 들고 (다시 읽기 · 경로 param 조회가 지나는 `reload`), 바인딩된 행 결과에 실어 보낸다.
  - **Table**: S2 TableView 처럼 `loading` 이고 본문이 비었을 때 진행 원 (ProgressCircle, `aria-label` 「Loading…」). 행이 있으면 다시 읽는 동안에도 행을 그대로 둔다 (S2 `TableBody` 와 같음). `loadingState` 는 S2 prop 이름 그대로 Table accepts 에 패널 숨김으로 둔다.
  - **Skeleton**: collection 에 묶을 수 있다 (Data 칸). 묶이면 읽는 동안에만 나타난다 — Detail 처럼 한 건을 읽는 자리.
  - Canvas 는 아무것도 읽지 않아 작성한 값 그대로 (Skeleton `isLoading` 기본 true) — 설계된 비대칭.
  - 위치: `packages/shared/src/catalog/resolution/resolver.ts` (`CatalogLoadingState` · 바운드 Table · Skeleton) · `catalog/runtime/catalogPreviewSession.ts` (`loadingStates` · `boundRows`) · `catalog/runtime/domBinding.runtime.ts` (TableBody `renderEmptyState`) · `catalog/bindings/{Table,Skeleton}.binding.ts` · 테스트 `loadingState.test.tsx` (원복 RED)
- **CRUD 스텁 지연** — `STUB_DELAY_MS=1500 node apps/builder/scripts/crud-endpoint-stub.mjs` 로 응답을 늦춰 읽는 중 상태를 본다.

## [Data — 상세 페이지의 한 건 조회 (endpoint 경로의 `{{ params.id }}` — router loader)] - 2026-10-23

### Added

- **조회 endpoint 의 경로 · query 에 `{{ }}` 템플릿** — 레퍼런스 `useAsyncList({ load })` 의 `load` 가 ``fetch(`/users/${id}`)`` 하는 형태 (일반 웹의 router loader). `GET /users/{{ params.id }}` 처럼 경로 param · 변수를 쓰면 Preview · Publish 세션이 풀어서 요청한다:
  - 템플릿 endpoint 가 채우는 collection (`targetCollection`) 은 보이는 경로가 다른 URL 을 만들 때 한 번 읽는다 (상세 진입 · 다른 id). 같은 URL 은 다시 읽지 않고, 풀리지 않는 페이지 (Home — `:id` 없음 · 빈 값) 에서는 읽지 않는다. 「collection 다시 읽기」 도 풀린 URL 로 읽는다.
  - 서버에 없는 id (404) 는 빈 항목 + `[CatalogPreview]` 경고.
  - 문서 · contract 무변경 (endpoint 는 data store 레코드).
  - 위치: `packages/shared/src/collections/executeCollectionEndpoint.ts` (`EndpointTemplateResolver` · `resolvedEndpointUrl`) · `packages/shared/src/catalog/runtime/catalogPreviewSession.ts` (`loadRouted` · `endpointTemplate`) · 테스트 `loadOne.test.tsx` (원복 RED)

### Changed

- **Builder 의 endpoint 실행은 남은 템플릿을 보내지 않는다** — 시험 실행 params · secret 치환 뒤에도 `{{ … }}` 가 남으면 요청 대신 오류 (실행 기록 실패).
  - **Why**: Builder 에는 경로가 없어 `/users/%7B%7B%20params.id…` 를 그대로 보냈다.
  - 위치: `apps/builder/src/builder/stores/utils/dataActions.ts` · 테스트 `dataActions.executeApi.test.ts` (원복 RED)
- **CRUD 샘플의 상세가 한 건 조회** — collection `UserDetail` + endpoint `getUser` (`GET /users/{{ params.id }}`), Detail frame 은 UserDetail 에 묶임, 수정 뒤 UserDetail · Users 둘 다 reload. 스텁에 `GET /users/:id`. README · `samplesImport` 갱신.

## [샘플 — CRUD 샘플을 목록 · 상세 · reload 방식으로] - 2026-10-23

### Changed

- **`docs/how-to/samples/collection-crud.composition.json`** — 2초 주기 조회 대신 제출마다 「collection 다시 읽기」 (`reload`), 처음 표시는 실행 정책 Auto. 페이지 둘: Home (Table 정렬 · ListBox 항목 = `/detail/{id}` 링크 · 추가 Form · 다시 읽기 버튼) · Detail `/detail/:id` (frame 이 `{{ params.id }}` 항목에 묶임 · 그 값으로 시작하는 수정 Form · 삭제 뒤 Home). README 절차 갱신 · 가져오기 테스트 `samplesImport` 갱신.

## [Interactions — Do 「collection 다시 읽기」 (`reload` — useAsyncList.reload)] - 2026-10-22

### Added

- **Do 「collection 다시 읽기」 (`reload`)** — RAC · S2 레퍼런스 `useAsyncList.reload()`. API 와 연결된 collection 의 조회 endpoint (`targetCollection`) 를 Preview · Publish 가 다시 실행하고 그 항목으로 바꾼다 — 주기 조회 (실행 정책 Interval) 없이 「제출 → endpoint 호출 → 다시 읽기」 가 된다:
  - 같은 이벤트의 진행 중 제출을 기다린 뒤 읽는다 (레퍼런스의 `await fetch; list.reload()` 순서 — 세션 `trackSubmit`).
  - 규칙의 지역 편집 (`append` · `update` · `remove`) 은 지운다 (서버가 정본). Builder 가 다른 항목을 보내면 그쪽이 이긴다.
  - 목업 collection · 채우는 endpoint 가 없는 collection 은 `[interactions]` 경고 + toast.
  - Builder Preview 로 보내는 endpoint 도 파일 내보내기처럼 연결 collection 이름을 싣는다 (`endpointWithTarget`).
  - 문서: `{ opcode: "reload", collectionId }` — contract 47 그대로 (추가만).
  - 위치: `packages/shared/src/catalog/runtime/{catalogPreviewSession.ts,catalogPreviewInteractions.ts,domView.runtime.ts}` · `interactions/dispatcher.ts` · `apps/builder/src/builder/utils/endpointTarget.ts` · 패널 · 테스트 `reload.test.tsx` (원복 RED)

## [Data — 한 항목 바인딩 (`binding.key` — useListData.getItem) · 수정 Form 미리 채우기] - 2026-10-22

### Added

- **한 항목 바인딩 `binding.key`** — RAC · S2 레퍼런스 `useListData.getItem(key)`. Data 칸의 「Item key」 에 리터럴 (`usr_1`) 또는 `{{ }}` 템플릿 (`{{ params.id }}` · `{{ 변수 }}` — 이름 붙인 `selectedKeys` 는 첫 key) 을 쓰면 collection 의 그 항목 하나가 바인딩된다:
  - 컨테이너 (frame · Form) 는 자손의 `{name}` · `{gender}` 가 그 항목 값을 읽는다 — detail 화면을 한 번에 묶는다. frame · Form 에 Data 칸이 생겼다 (`dataBinding` — composition 공통 확장).
  - 목록 컴포넌트 (ListBox · Table …) 는 그 항목만 보인다. key 는 window 밖 항목도 찾고, 없는 key 는 빈 항목.
  - key 가 읽는 변수 · 경로가 바뀌면 그 바인딩만 다시 고른다 (`refreshState` → `refreshRows`). Canvas 는 경로 · 런타임 값이 없어 첫 항목을 표본으로 그린다.
  - 문서: `DataBindingRef.key?: string` — contract 47 그대로 (추가만).
- **수정 Form 미리 채우기** — field 의 `value` 를 행 값 prop 목록 (`ROW_TEMPLATE_BINDABLE_PROP_KEYS`) 에 더해 `value="{email}"` 이면 그 항목 값으로 시작한다 (Preview 는 그 값을 시작값으로 controlled).
  - 위치: `packages/shared/src/catalog/{document/types.ts,document/validation.ts,runtime/dataBinding.ts,runtime/stateTemplate.ts (catalogBindingKey),runtime/compositionRoot.ts,resolution/resolver.ts}` · `collections/rowTemplateBindableProps.ts` · `document/itemLinks.ts` · `bindings/Form.binding.ts` · 패널 `PropertyDataBinding.tsx` · 테스트 `getItem.test.tsx` · `keyedBindingCanvas.test.ts` (원복 RED)

## [Preview — 목록 → 상세: 항목 링크가 Preview 라우터로 · `{{ params.id }}` · `:param` 경로] - 2026-10-22

### Added

- **항목 · 행 · Link 의 `href` 가 Preview · Publish 라우터로 간다** — RAC 레퍼런스의 `RouterProvider` (`navigate` = 세션 `navigateTo`) 를 Preview · Publish 공용 `CatalogPreviewView` 에 둔다. 바운드 목록의 행 템플릿에 `href="/detail/{id}"` 를 쓰면 행마다 `/detail/usr_…` 링크가 되고, 누르면 문서를 다시 읽지 않고 그 페이지로 간다 (`:param` 경로 · 404 페이지 포함).
- **`{{ params.<이름> }}`** — 보이는 경로가 `:param` 경로 (`/detail/:id`) 에 맞으면 그 값 (router 의 `useParams` 이름). 모든 string prop 의 `{{ }}` 템플릿에서 읽고, 경로가 바뀌면 그 이름을 읽는 record 만 다시 푼다. Canvas 는 경로가 없어 원문을 그린다 (`{{ }}` 의 기본값 env 비대칭과 같은 결). 같은 이름의 변수가 있으면 변수가 이긴다.
  - 위치: `packages/shared/src/catalog/runtime/{domView.components.tsx,catalogPreviewSession.ts,stateTemplate.ts,compositionRoot.ts}` · 테스트 `routeParams.test.tsx`

### Fixed

- **페이지 Route 에 `:param` (`/detail/:id`) 을 쓸 수 없던 것** — Preview 라우터는 `:param` 경로를 맞추는데 Page 설정의 Route 검증이 `:` 를 막았다. 세그먼트마다 「영문 · 숫자 · 하이픈」 또는 `:이름`.
  - 위치: `apps/builder/src/builder/catalogRuntime/pageSettings.ts` · 테스트 `phase4ePageSettings.test.ts`
- **바운드 목록의 행 템플릿 항목 prop (URL 등) 을 바꾸면 「CATALOG_STEP_ABORTED: RESOLVED_INSTANCE_MISSING」 으로 편집이 되돌아가던 것**:
  - **Why**: Canvas 증분 갱신 (`planInstances`) 이 고칠 record 의 경로를 `allowed` 에 record id 그대로 넣었는데, 둘째 행부터의 record id 는 행 표시 (`…::item#row:<key>`) 를 달고 resolver 의 `include` 는 위치 (`…::item`) 로 묻는다. 둘째 행 record 를 다시 풀 때 항목 위치가 빠져 record 를 못 찾았다 (첫 행만 통과).
  - 수정: `allowed` 에 행 표시를 뗀 위치를 넣는다 — 행 반복은 resolver 가 한다.
  - 위치: `packages/shared/src/catalog/runtime/compositionRoot.ts` · 테스트 `rowTemplateHref.test.ts` (원복 RED)

## [Interactions — Do 「collection 항목 수정 · 삭제」 (`update` · `remove` — useListData)] - 2026-10-22

### Added

- **Do 「collection 항목 수정」 (`update`) · 「collection 항목 삭제」 (`remove`)** — `append` 와 같은 RAC · S2 레퍼런스 묶음 `useListData.update(key, newValue)` · `remove(...keys)`:
  - 행 동작 (`onAction` · `onRowAction`) 이면 key 가 `!event.key`, 선택 변경 (`onSelectionChange`) 이면 `!event.keys` (선택 집합 · `"all"`), Form 제출이면 값이 `!event.formData` 로 자동으로 잡힌다. key 는 직접 입력도 된다.
  - `update` 는 그 key 의 항목이 값의 schema 필드를 받는다 (key 필드 `id` · `key` · `value` 는 그대로). key 를 비우면 값의 `id` 를 쓴다 — 수정 Form 에 `id` 칸만 두면 된다.
  - 세션이 `append` · `update` · `remove` 를 순서대로 기록하고 Builder 의 항목 위에 다시 적용한다 — Builder 가 데이터를 다시 보내도 유지. 없는 key 는 `[interactions]` 경고로 보고한다.
  - 문서: `{ opcode: "update", collectionId, key?, value? }` · `{ opcode: "remove", collectionId, keys? }` — contract 47 그대로 (추가만).
  - 위치: `catalog/runtime/catalogPreviewSession.ts` (`replayItemEdits`) · `interactions/dispatcher.ts` (`dispatchListData`) · 패널 `CatalogRuleRow.tsx` · `catalogRuntime/interactions.ts` (`catalogListDataEventDefaults`) · 테스트 `updateRemove.test.tsx`

## [Interactions — Do 「collection 에 추가」 (`append`) · 팔레트 Form 이 바로 제출됨] - 2026-10-22

### Added

- **Do 「collection 에 추가」 (`append`)** — ADR-281 사용자 결정 3 의 2차. 이름 · 의미는 RAC · S2 공통 레퍼런스 `useListData.append(...values)` (S2 는 `react-stately/useListData` 를 그대로 다시 내보낸다):
  - Form 을 놓고 Interactions 에서 When 「제출」 → Do 「collection 에 추가」 → collection 을 고르면 끝난다. 값은 Form 이면 `!event.formData` 가 자동으로 잡힌다.
  - 추가한 항목은 **Preview · Publish 실행 중에만** 있다 (레퍼런스의 `useListData` 처럼 클라이언트 상태 — 그 collection 에 바인딩된 Table · ListBox · GridList 가 바로 보여 주고, Builder 가 데이터를 다시 보내도 유지, 새로 열면 사라진다). 작성자의 Data 패널 테이블은 바뀌지 않는다.
  - 항목은 schema 의 필드만 받고 (`number` · `boolean` 필드는 그 값으로), schema 에 `id` 가 있으면 비어 있을 때 만든다 (레퍼런스의 고유 key). record 가 아닌 값 · 없는 collection 은 `[interactions]` 경고로 보고한다.
  - 문서: `InteractionEntry.action { opcode: "append", collectionId, value? }` — contract 47 그대로 (추가만, 47 문서 무변경). 수정 · 삭제는 같은 레퍼런스의 `update(key, newValue)` · `remove(...keys)` 로 잇는다.
  - 위치: `packages/shared/src/catalog/document/{types,validation,library,executionVocabulary}.ts` · `interactions/{dispatcher,interactionRule.types}.ts` · `catalog/runtime/{catalogPreviewInteractions,catalogPreviewSession,domView.runtime}.ts` · 패널 `panels/interactions/catalog/{CatalogRuleRow,CatalogInteractionsPanel}.tsx` · 테스트 `append.test.tsx`

### Fixed

- **팔레트 Form 의 Save 가 제출하지 않던 것 · 칸 값이 제출 본문에 들어가지 않던 것**:
  - **Why**: Form 원본의 버튼 줄은 ButtonGroup 원본 그대로라 Cancel · Save 가 `type="button"` 이었고, Name · Email 칸에 `name` 이 없어 `FormData` 가 비었다. 규칙을 걸어도 Save 로는 아무 일도 일어나지 않았다.
  - 수정: Form 원본 template 이 칸에 `name` (`name` · `email`) 을, 버튼 줄의 Cancel 에 `type: reset` · Save 에 `type: submit` 을 준다 (`descendantPatches`). 시각 값 변경 0. 이미 놓은 Form 의 칸 · 버튼은 놓을 때 문서가 소유한 사본이라 그대로다 — 새로 놓은 Form 부터.
  - 위치: `packages/shared/src/catalog/document/generated/reusableOriginLibrary.ts` · 테스트 `append.test.tsx` (원복 RED)

## [Data — 프로젝트 파일이 collection 의 실행 정책 · endpoint 연결을 옮김 · CRUD 샘플] - 2026-10-22

### Fixed

- **프로젝트 파일을 가져오면 collection 의 실행 정책 (Auto · Interval) 과 「API endpoint」 연결이 사라지던 것**:
  - **Why**: 내보내기는 실행 정책을 싣지만 (`toExportCollection` — 「import 복원용」) 가져오기는 이름 · schema · 행만 `updateCollection` 으로 넣었고, 그 diff 는 실행 정책을 다루지 않는다. endpoint 의 대상 collection (`targetCollectionId`) 은 내보내기 projection (`toRuntimeApiEndpoint`) 에서 빠져 파일에 없었다. 가져온 API collection 은 늘 Manual · 연결 없음이었다.
  - 수정: 내보내기가 endpoint 에 대상 collection 이름 (`targetCollection`) 을 싣고, 가져오기가 그것을 가져온 collection 의 id 로 다시 잇는다. 실행 정책은 편집기와 같은 `set_execution_policy` op 로 넣는다.
  - 위치: `apps/builder/src/builder/{main/useCatalogProjectFiles.tsx,utils/importCollectionEnvelope.ts}` · `packages/shared/src/types/collection.types.ts` · 테스트 `importCollectionEnvelope.test.ts` · `samplesImport.test.ts`

### Added

- **CRUD 샘플 프로젝트 파일** `docs/how-to/samples/collection-crud.composition.json`: collection `Users` 를 Table · GridList · ListBox 가 읽고, Create · Update · Delete Form 이 `callEndpoint` (`!event.formData`) 로 REST 스텁에 쓰고, 목록은 실행 정책 interval 2초로 다시 읽는다. 행 선택은 `!event.key` 로 Update · Delete 의 id 칸을 채우고, 전역 변수 `lastAction` · `opCount` 가 작업마다 바뀌고, 각 Form 은 제출 뒤 자기 `reset` 으로 칸을 비운다. 스텁 `apps/builder/scripts/crud-endpoint-stub.mjs` (`GET · POST · PUT · DELETE /users`). 확인 절차는 `docs/how-to/samples/README.md`.

## [Interactions — 「안쪽 전체 전환」 토글 · Publish 의 색 모드 규칙 · 가져온 프로젝트의 규칙 참조 · 확인용 샘플] - 2026-10-22

### Fixed

- **page 루트 · frame 의 「읽기 전용 전환」 (`toggleReadOnlyAll` · `toggleDisabledAll` · `toggleRequiredAll`) 이 아무것도 바꾸지 않던 것** (ADR-281 G6 확인 중 발견):
  - **Why**: `!self` 토글은 현재값이 boolean 일 때만 뒤집고, 값이 없으면 `style.display` 처럼 `"none"` 을 썼다. 작성하지 않은 page 루트 · frame 의 `isReadOnly` 는 값이 없어 `isReadOnly: "none"` 이 써졌고, 상속 flag (`=== true`) 에 닿지 않았다.
  - 수정: `style.` 이 아닌 prop 의 토글은 boolean 상태로 본다 — 값이 없으면 꺼짐에서 뒤집는다.
  - 위치: `packages/shared/src/interactions/dispatcher.ts` · 테스트 `adr281Inheritance.test.tsx`
- **Publish 에서 「다크 모드로 / 라이트 모드로」 규칙 (page 루트 `colorScheme`) 이 반응하지 않던 것**:
  - **Why**: Builder Preview 는 세션에 `applyTheme` 을 넘기지만 Publish 세션은 넘기지 않고 `App.tsx` 가 한 번만 직접 적용해, `setColorScheme` 이 아무 일도 하지 않았다 (Preview 전용 분기).
  - 수정: Publish 세션도 `applyTheme: applyCatalogPreviewTheme` 을 받는다 (snapshot 때 적용 · 규칙의 색 모드 재적용). `App.tsx` 의 중복 호출 삭제.
  - 위치: `apps/publish/src/{catalogSession.ts,App.tsx}` · 테스트 `bodyDomPresentation.test.tsx`
- **프로젝트 파일을 다른 프로젝트로 가져오면 Form 의 「Call an endpoint」 규칙이 끊기던 것 · 같은 이름 변수의 `setState` 가 끊기던 것**:
  - **Why**: 가져오기는 data part 를 이름으로 맞추는데, endpoint 는 새 id 로 생기고 같은 이름 변수는 이 프로젝트의 id 가 된다. 문서 참조를 다시 잇는 것은 collection 뿐이라 `data:endpoint:` · `data:variable:` 참조가 없는 대상을 가리켰다 (ADR-281 이 문서에 endpoint 참조를 들였다).
  - 수정: `importDataParts` 가 세 종류의 문서 참조 표 (파일 쪽 → 이 프로젝트 쪽) 를 돌려주고, `remapCatalogDataRefs` 가 문서 전체에서 바꾼다.
  - 위치: `apps/builder/src/builder/utils/importCollectionEnvelope.ts` · `packages/shared/src/catalog/runtime/exchange.ts` · 테스트 `importCollectionEnvelope.test.ts` · `phase4eProjectFiles.test.ts` · `samplesImport.test.ts`

### Added

- **확인용 샘플 프로젝트 파일** (`docs/how-to/samples/`): `adr281-g6-check.composition.json` (ADR-281 G6 네 축 — 패널 어휘 · 조상 상속 · instance 규칙 상속 · Form 제출) · `global-variable-crud.composition.json` (전역 변수 읽기 · 쓰기). 헤더 프로젝트 파일 메뉴의 가져오기로 연다. Form 제출을 받는 로컬 스텁 `apps/builder/scripts/adr281-endpoint-stub.mjs`.

## [Data 패널 — 프로젝트를 열 때 Builder 전체가 멈추던 것] - 2026-10-22

### Fixed

- **Data 패널을 열어 둔 채 프로젝트를 열면 「Data usage host is not provided」 로 Builder 화면이 사라지던 것**:
  - **Why**: 패널은 workspace 보다 먼저 마운트된다 (`CatalogBuilderCore` 가 프로젝트가 열리기 전에는 패널을 Data host provider 밖에서 그린다). 다른 catalog 패널 (Design · Interactions · Components · History · Themes) 은 `CatalogWorkspaceGate` 로 기다렸지만 Data 패널 3 개만 빠져 있어, 패널 코드가 먼저 로드되면 `useDataUsageSource` 가 throw 했다 — 경쟁이라 로드 순서에 따라 나거나 안 났다.
  - 수정: `DataTablePanel` · `DataTableEditorPanel` · `DataTableFieldPanel` 을 `CatalogWorkspaceGate` 로 감싼다.
  - 위치: `apps/builder/src/builder/panels/datatable/{DataTablePanel,DataTableEditorPanel,DataTableFieldPanel}.tsx` · 테스트 `DataPanelsWorkspaceGate.test.tsx`

## [ADR-281 Phase 0 ~ 5 — Interactions 응용: 패널 어휘 · 조상 상속 · instance 규칙 상속 · Form 제출 목적지] - 2026-10-22

### Added

- **When 을 RAC 문서 절 (개념) 그룹으로**: 선택 목록에 「Press」 · 「Selection」 · 「Form」 같은 머리글이 붙고, 「Show all of RAC」 스위치가 S2 가 뺀 RAC 이벤트 (누르기 시작 · hover · focus) 를 연다 — keyboard 는 열지 않는다. 지금 RAC 가 받지 않는 것은 목록에서 빠진다 (disabled Button 의 「누를 때」 · readOnly Checkbox 의 「선택 상태가 바뀔 때」 · `selectionMode: none` ListBox 의 「항목 선택」). 이미 그런 규칙은 지우지 않고 행에 「지금 RAC 가 받지 않음 (사유)」 를 표시한다.
- **값 칸 「직접 입력 / 이벤트 인자」**: 규칙 값으로 When 의 인자 (`keys` · `value` · `isOpen` · `formData` …) 를 고른다 — 손으로 `!event.keys` 를 적지 않아도 된다.
- **page 루트 · frame 이 자손에 내려주는 prop**: `isDisabled` · `isReadOnly` · `isRequired` · `locale` (page 루트 · frame), Do 「안쪽 전체 비활성화 / 활성화 / 전환」 · 읽기 전용 · 필수 · 「로캘 설정」 · 「라이트 / 다크 모드로」 (page 루트). RAC `Provider` · `I18nProvider` 로 그리며 Canvas (disabled · readOnly 표시) 와 규칙의 제약 검사가 같은 값을 읽는다.
- **원본 규칙을 instance 에서 끄기 · 바꾸기**: instance 를 고르면 「Inherited from component」 에 원본의 규칙이 보이고 (전에는 실행되는데 보이지 않았다), 「Runs in this instance」 스위치로 끄거나 「Replace in this instance」 로 이 instance 만의 규칙을 둔다. 「원본에 반영」 은 바꾼 규칙을 원본 규칙으로, 「Reset all」 은 끄기 · 바꾸기를 모두 지운다.
- **Form 제출 → API endpoint**: Do 「Call an endpoint」 — Form 의 필드 값 (`!event.formData`, 필드 `name` 기준) 을 JSON 으로 보낸다. 제출마다 요청 하나 (두 Form 이 같은 endpoint 로 보내도 각자), `204` · 빈 응답도 성공, 실패 (`!ok` · 네트워크 · 시간 초과) 는 toast. Preview 도 실제로 보낸다.

### Changed

- library contract 46 → 47 (`DescendantPatchFields.interactions` · `callEndpoint.body`) — 46 으로 저장된 프로젝트는 열리지 않는다 (마이그레이션 없음, 사용자 결정 2026-10-22).

### Fixed

- **Form 이 든 프로젝트의 Preview 버튼 (publish 탭) 이 `INVALID_CATALOG_SNAPSHOT` 으로 열리지 않던 것** (ADR-281 이전부터): 로드 시 S2 전환 (`s2PropAlignment.ts` `migrateWrites`) 이 이미 S2 형식인 값 (TextField `type: "email"` — palette Form 의 email 칸) 도 지웠다 다시 써서, export 한 문서 (graph 의 고정된 record) 를 다시 여는 publish 에서 throw 했다. 같은 값으로 바뀌는 쓰기는 건드리지 않는다.

## [Design 패널 Slot — 그룹의 slot 피커는 그룹 항목만] - 2026-10-22

### Fixed

- **ButtonGroup 의 Slot 피커에 Library 컴포넌트 약 70개가 전부 나오던 것**: 그룹은 받는 자식 표에 자식 목록이 없어 「무엇이든 받는 자리」 로 판정됐다. 이제 그룹 자리 (ButtonGroup · ToggleButtonGroup · AvatarGroup · DisclosureGroup · Nav) 는 그 그룹의 항목 (Button · ToggleButton · Avatar · Disclosure · Link) 만, Local 컴포넌트는 루트가 그 항목인 것만 보여 준다. 고르면 그룹의 「+」 와 같이 항목 원본의 instance 로 들어간다. 받는 자식 판정 (드래그 · 붙여넣기) 은 바꾸지 않았다.

## [ADR-280 Phase 0 ~ 3 — Interactions 가 RAC 에 실제로 닿는다: 등록표 유도 · Preview/Publish controlled · 제약 검사 · Form 제출] - 2026-10-22

### Fixed

- **Interactions 규칙이 고른 대로 동작하지 않던 것** (Preview · Publish): Button → ListBox · GridList 「항목 선택」 이 아무것도 선택하지 않았다 (항목 집계를 RAC `defaultSelectedKeys` 로만 넘겨 규칙 값이 닿지 않음). 다중 선택 목록에서 「항목 선택」 이 기존 선택을 지우고 하나로 바꿨다. `locale` 을 지정한 Calendar · Date 가족과 FileTrigger 는 When 규칙이 실행되지 않았다 (`I18nProvider` · marker 래퍼가 핸들러를 버림). 이제 상태 prop 은 첫 render 부터 controlled 이고 (사용자 조작과 규칙이 같은 runtime 값을 쓴다), 래퍼는 핸들러를 안의 RAC 컴포넌트로 넘긴다.
- **규칙이 RAC 의 제한을 넘던 것**: disabled Checkbox 에 다른 Button 의 「체크」 규칙이 체크를 넣었다. 이제 disabled · readOnly (그룹이 내려주는 것 포함) · 빈 선택 금지 · selectionMode none · 비활성 항목은 규칙이 바꾸지 않고 실패를 알린다.
- **Form 「제출」 · 「초기화」 가 실행되지 않던 것**: 항상 「지원 안 함」 으로 끝났다. 이제 RAC 검증을 거쳐 제출하고 (Form 의 「제출 시」 규칙 실행), 초기화는 필드를 선언값으로 되돌린다. 목적지 (`action`) 가 없는 Form 의 제출은 페이지를 다시 읽지 않는다 — `action` 을 적은 Form 은 그대로 그 주소로 제출된다.
- Menu · Dialog · Tooltip · ContextualHelp 의 열기/닫기는 trigger 노드가 받는다 (본체에 건 규칙도 trigger 로 간다 — RAC 는 본체가 자기 열림 값을 가지면 trigger 의 press 를 무시한다).

### Added

- 규칙으로 바꿀 수 있는 컴포넌트가 늘었다 — Switch · Select (선택 · 열기) · ComboBox (선택 · 입력) · TextField · TextArea · SearchField · NumberField · ColorField · Color 조작기 · ColorSwatchPicker · CheckboxGroup · ToggleButtonGroup · CardView · Table (선택 · 정렬) · Menu (선택) · DisclosureGroup · Date 가족 (값 · 열기) · Calendar · Autocomplete · trigger 4 종 (보류 35 → 0). 새 Do 「항목 선택 해제」 (`deselectItem`). 새 When — MenuTrigger · DialogTrigger · TooltipTrigger · ContextualHelp 의 열림 변경 · 목록의 「항목 실행」 (`onAction`) · Table 의 행 실행 · 정렬 변경 · SearchField 지우기.
- 규칙 값 `!event.<인자>` (실행 층) — 다른 컴포넌트의 callback 인자를 넘긴다 (예: ListBox A 선택 변경 → ListBox B 「항목 선택」 `!event.keys`). 패널에서 고르는 UI 는 ADR B.
- `@react-aria/test-utils` 1.0.0-rc.1 (builder devDependency, 테스트 전용) — 「규칙이 RAC 를 움직였다」 를 RAC 의 tester 로 판정.

### Changed

- 등록표 (`CAPABILITY_REGISTRY` · `IMPLICIT_STATE_SOURCES`) 를 손으로 쓰지 않는다 — RAC 개념 파일 19 (설치 d.ts `satisfies`) 와 컴포넌트 spec (55 type, type 별 이름 실존 컴파일 검사) 에서 유도. 「(재설정)」 표시 (remount) 삭제. 변수로 이름 붙일 수 있는 RAC 상태가 TextField · Select · Table 등으로 늘었다.

## [Components Local page — Layers 를 Library page 와 같은 카드 그룹 구조로] - 2026-10-22

### Changed

- **Local page 의 Layers 가 body → 컴포넌트 카드 → ◆ 원본이다** (사용자 지시 2026-10-22 「Library 와 동일한 통일된 패턴」): Library page 는 카드마다 그룹 행 (카드 선택이 Canvas · Navigator 에서 같이 보인다) 인데 Local page 는 카드를 건너뛰고 ◆ 원본을 body 바로 아래에 나열해, Canvas 에서 카드를 골라도 Navigator 에 대응 행이 없었다. 이제 카드 행 (컴포넌트 이름, 프로젝트 순서) 아래 ◆ 가 있다. 카드 행은 Library 카드처럼 파생 행 (드래그 · 삭제 없음 — 삭제는 카드 머리의 ×), 「No components」 안내 카드는 행이 아니다.
  - 위치: `apps/builder/src/builder/catalogRuntime/componentsPage.ts` `readPageRows`

## [Canvas 드래그 — 빈 slot 표시가 컴포넌트를 따라 움직인다] - 2026-10-22

### Fixed

- **빈 slot 이 있는 컴포넌트를 끌면 slot 사선 표시만 제자리에 남던 것** (사용자 보고 2026-10-22): 드래그 중 요소는 그릴 때 offset 을 더하지만 (문서 · scene 상자는 놓을 때까지 그대로), overlay 의 slot 표시는 scene 상자 위치로 그렸다. 이제 끌리는 record · 비켜나는 형제 아래의 slot 표시는 같은 offset 으로 옮긴다. 드래그가 없으면 계산하지 않는다.
  - 위치: `apps/builder/src/builder/workspace/canvas/catalog/catalogOverlayChrome.ts` `catalogDraggedSlotMarks` · `CatalogCanvas.tsx` overlay `slots`

## [ListBox · Menu 의 받는 자식 — deprecated Section · 목록 직속 Header 제거] - 2026-10-22

### Changed

- **ListBox · Menu 의 Items 에 Section · Header 가 더 나오지 않는다** (사용자 지시 2026-10-22): 받는 자식 표가 2026-09-08 의 범용 `Section` 시절 목록을 남겨 ListBox Items 피커 · 넣기 판정이 `Section` · `Header` 를 받았다. 설치 RAC 1.22.1 의 `Section` 은 @deprecated (ListBoxSection · MenuSection 이 대체) 이고 `Header` 는 섹션의 머리글 (섹션의 자식) 이다. 이제 ListBox = ListBoxItem · ListBoxSection, Menu = MenuItem · SubmenuTrigger · MenuSection · Separator. 라이브러리 템플릿 중 목록 직속 Section · Header 를 쓰는 곳은 없다 (전수 확인).
  - 위치: `packages/shared/src/domain/componentTraits.ts` `ListBox` · `Menu` `children`

## [바인딩된 ListBox — 항목을 모두 지워도 행이 생긴다] - 2026-10-22

### Fixed

- **항목이 없는 ListBox 에 Content → Data collection 을 골라도 행이 생기지 않던 것** (사용자 보고 2026-10-22): 바인딩된 목록은 slot 에 소유한 첫 항목을 행 견본으로 반복하는데, 항목을 모두 지운 빈 slot 에는 견본이 없어 행 0 개였다 (Slot 에서 항목을 하나 넣으면 그제야 생겼다). 이제 빈 slot 은 원본의 첫 항목을 행 견본으로 쓴다 — 항목이 템플릿 자리일 때와 같다. 항목을 넣으면 그 항목이 견본이 된다. Canvas · Preview 가 같은 resolver 를 읽는다.
  - **Why**: 2026-10-14 「slot 내용은 놓는 순간 소유」 뒤 행 반복이 소유 항목만 보게 됐고, 비어 버린 경우의 견본이 없었다.
  - 위치: `packages/shared/src/catalog/resolution/resolver.ts` fill-slot 분기

## [Design 패널 slot 절 — 새 ListBox 항목은 항목 원본의 instance] - 2026-10-22

### Fixed

- **Slot 피커 · 「+」 로 넣은 ListBox 항목이 instance 가 아니던 것** (사용자 보고 2026-10-22 「slot - listboxitem 추가해도 instance 객체가 아니다」): 피커의 Library 선택지와 「+」 의 기본 정의가 팔레트 id — 항목 type 은 원본이 아닌 맨 type (`type-ListBoxItem`) — 라, 형제 항목이 없거나 fill 경로로 넣으면 놓을 때의 항목 (ListBoxItem 원본의 instance) 과 다른 객체가 됐다. 이제 그 자리 템플릿이 담은 항목 원본 (`origin-component-listbox-item-default` …) 을 쓴다 — GridList · Menu · Tree 등 템플릿에 항목을 담은 자리도 같다.
  - **Why**: 「+」 는 형제의 정의를 빌려 instance 가 되는 경우가 많아 드러나지 않았다 (형제가 없을 때 · Slot 피커의 fill 경로에서만).
  - 섹션 (ListBoxSection · GridListSection · MenuSection) 처럼 템플릿 항목도 형제도 없는 자리는 그 컬렉션 원본 (ListBox · GridList · Menu …) 의 템플릿이 쓰는 항목 원본을 따른다 (사용자 보고 2026-10-22 「listboxsection 추가 - slot 에서 listboxitem 추가 — instance 가 아닌 요소」).
  - 새 섹션 (ListBoxSection · GridListSection · MenuSection) 도 섹션 원본의 instance 다 — 원본처럼 header 와 항목을 소유 노드로 갖는다 (사용자 2026-10-22 「섹션도 원본 instance · header 포함」, 전에는 header 없는 맨 type 이었다).
  - 위치: `apps/builder/src/builder/catalogRuntime/slots.ts` `catalogTemplateItemDefinition` · `itemInsert.ts` `definitionFor`

## [Design 패널 slot 절 — Slot 섹션 하나 · 목록과 삭제는 Layers 로 · 컬렉션 「+」 는 slot 내용에] - 2026-10-22

### Changed

- **Slot 섹션이 하나다** (사용자 지적 2026-10-22 「slot section 두개가 중복」 · 「항목 목록, 삭제는 layers 트리와 중복」): 놓은 ListBox 처럼 slot 이면서 항목을 받는 자리에 Slot 섹션이 둘 (slot 채움 목록 + 피커 / 항목 type 마다 「+」) 떴다. 이제 slot 자리는 피커 하나 (legend = slot 이름) + restore 아이콘 + 추천 버튼이고, 피커에서 고른 항목 type 은 옛 「+」 와 같이 만들어진다 (「Item 4」 · menu key · submenu 부품, Library 목록에 없는 ListBoxSection · SubmenuTrigger 도 피커에). 채운 내용의 목록 · 순서 · 삭제는 Layers 트리가 맡는다 (Slot 섹션의 목록 행 · − 제거). slot 이 아닌 자리 (그룹 · TableHeader · TableBody · picker 의 ListBox · Components page 샘플) 는 「+」 섹션 그대로.
  - 위치: `apps/builder/src/builder/panels/properties/catalog/CatalogSlotSection.tsx` · `CatalogPropertiesPanel.components.tsx`

### Fixed

- **놓은 ListBox · GridList 의 「+」 항목이 slot 내용 밖에 붙던 것**: 템플릿 루트가 Items slot 인 컬렉션 instance 에 항목을 넣으면 노드의 children (slot 뒤) 으로 들어가 놓을 때의 항목과 따로 놀았다. 이제 slot 내용에 들어간다.
  - **Why**: 2026-10-14 그룹 (`insertGroupItem`) 에는 루트 slot 경로를 넣었는데 컬렉션 (`insertCollectionItem`) 에는 빠져 있었다.
  - 위치: `packages/shared/src/catalog/commands/collections.ts` `collectionRootSlot`

## [Design 패널 slot 절 — Restore template content 는 놓았을 때의 내용으로] - 2026-10-22

### Fixed

- **Restore template content 가 놓았을 때의 내용으로 돌아가지 않던 것** (사용자 보고 2026-10-22): 팔레트로 놓은 라이브러리 원본 instance (Dialog · Popover · Card · ListBox …) 의 slot 은 놓는 순간 기본 내용을 소유 노드로 갖는데, restore 는 채움과 override 만 지워 템플릿 자리로 떨어졌다 — 패널의 내용 행과 restore 버튼이 사라지고, 내용은 ID · detach 가 없는 템플릿 자리가 됐다. 이제 restore 는 지운 뒤 놓기와 같은 `ownSlotContents` 로 기본 내용을 다시 소유 노드로 만든다 (history 한 step). project 컴포넌트 instance 는 전처럼 컴포넌트의 내용이 보인다.
  - **Why**: 2026-10-14 「slot 내용은 놓는 순간 소유」 결정 때 restore 명령은 옛 동작 (override 제거) 그대로 남았다.
  - 위치: `apps/builder/src/builder/catalogRuntime/slots.ts` `catalogSlotCommands.restore`

## [Design 패널 slot 절 — Fill slot 피커를 패널 필드 어법으로 · restore 는 행 아이콘 액션] - 2026-10-22

### Changed

- **Fill slot · Add content 피커가 패널 필드다** (사용자 지적 2026-10-22 「빌더 디자인 패턴도 맞지 않다」): 트리거는 instance 이름 칩 대신 legend 아래 `Select…` + chevron 필드 (FontFamilyPicker · IconPicker 와 같은 trigger 규칙), 팝오버는 필드 상자의 좌측 · 폭에 맞춰 뜬다 (`useControlPopoverMetrics`). 팝오버 안 검색은 빌더 `SearchField` (`control` — 검색 아이콘 · 지우기 버튼, Command palette · 헤더 메뉴와 같은 것) 이고 목록 행은 패널 Select 목록과 같은 여백 · 포커스 표면이다 — Swap instance · instance 교체 속성 picker 도 같은 검색 · 행을 쓴다. 조합 (`Autocomplete + SearchField + ListBox`) 은 그대로.
- **Restore template content 가 Fill slot 행의 아이콘 버튼이다** — 필드 아래 라벨 버튼 대신 행 오른쪽 액션 칸의 `↺` (instance 교체 속성의 reset 과 같은 `control-button` 아이콘 · 툴팁), 문구는 i18n (`propertiesPanel.slotRestore`).

## [Design 패널 — template 에 묶인 prop 은 instance 값으로 읽는다] - 2026-10-22

### Fixed

- **Layers 에서 Popover (DialogTrigger 안) 를 선택하면 「Too many re-renders」 로 Builder 가 죽던 것** (사용자 보고 2026-10-22): Popover template 노드의 `offset` 등이 instance 에 묶인 `"{offset}"` 문자열이라 패널 숫자 칸이 `Number()` 로 NaN 을 받고, 렌더 중 동기화가 `NaN !== NaN` 으로 끝없이 돌았다. 이제 template 노드의 `{name}` 바인딩 (그 origin 이 받는 이름) 은 패널에서 묶인 instance 의 값 (기본값 · 쓴 값) 으로 읽히고 (`fieldSource` — 글자 `{label}` 과 같은 ADR-254 규칙, 접힌 composite 루트는 그 자리 자신이 묶는다; 받지 않는 이름 = 행 데이터 `{field}` 는 그대로), 숫자 칸은 NaN 을 받아도 한 번만 동기화한다.

## [ADR-279 Phase 0 ~ 3 — Create component 원본은 Local page 로 · 그 자리에는 instance · 이름 대화상자 · 카드 rename · 카드 삭제] - 2026-10-21

### Changed

- **Create component → 정의가 노드를 소유하고 (원본은 Local page 카드의 ◆) page 그 자리에는 instance 가 선다** (Framer Assets 모델 — ADR-260 Decision 2 · 3 · 5 · 6 · 8 · 9 개정, 사용자 결정 2026-10-21). 위치 키 (`position` · inset · self 정렬) 는 base · Tablet · Mobile 층마다 instance 로 옮기고 template 에서 뺀다. Local 카드 안 노드에 Create component (중첩 추출) 를 하면 바깥 instance 의 override · interaction · 상태 참조 주소가 같은 step 에서 새 instance 를 지나도록 재작성된다.
- **Go to component 는 항상 Local page** 로 열고 ◆ 루트를 선택한다. Local page 카드의 ◆ 는 page 노드와 같은 범위로 편집된다 (자식 · 순서 · sizing · breakpoint 층 · fill).
- **Component 절 ORIGIN 「Detach component」 → 「Delete component」** (instance 전부 보통 노드로 + 정의 · template 삭제, 확인 대화상자).
- 문서 contract 45 → **46** — `originRef` 필드 삭제. 옛 프로젝트는 열리지 않는다 (변환 없음 — 개발 단계 정책).
- perf ratchet (ADR-246): `app-pages-images` 3 run 의 graph `getEntry` A 상한 올림 (+44 · +15 · +66 — 정의가 template 을 소유하므로 소유 색인 · 순환 검사가 정의마다 entry 하나를 더 읽는다, 사용자 승인 · 만료 2027-04-22).

### Added

- **Create component 이름 대화상자** (Canvas 메뉴 · 액션 바 · ⌘⌥K · Design 패널) — 기본값은 노드 이름 (없으면 타입), Enter 확정 · Escape 취소.
- **Local page 카드 헤더** — 제목 더블클릭으로 컴포넌트 이름 변경, × 로 컴포넌트 삭제. Design 패널 Component 절 ORIGIN 의 「Component name」 칸.
- **◆ 루트 ⌘D = 새 컴포넌트 「{name} copy」** · ◆ 복사 → page 붙여넣기 = instance.

### Removed

- ADR-260 의 「Restore origin」 · 원본 삭제 때 숨은 template 보관 · clipboard `origins` — 원본은 page 에 없으므로 쓸 곳이 없다.

### Fixed

- **Local page Layers 를 펼친 채 Delete component 하면 `CatalogValidationError DANGLING_CHILD` 로 Navigator 가 죽던 것** (사용자 보고 2026-10-21): Layers 의 카드 행 캐시가 page 가 다시 배치되기 전 step 알림에서 삭제된 ◆ 루트를 다시 읽었다 — 행 캐시는 문서 revision 과 같이 두고, page 재배치 (새 root) 뒤 Layers 를 다시 읽는다 (삭제 · undo 뒤 Layers 가 바로 맞는다).

## [Canvas — top·left 리사이즈 선택박스 좌표 일치] - 2026-10-21

### Fixed

- **top·left 리사이즈의 선택박스가 실제 요소와 일치한다**: 일반 흐름 요소는 width·height만 기록해 부모 레이아웃이 정한 좌상단을 유지하고, live 미리보기는 엔진이 계산한 scene 상자를 사용한다. 기존 absolute 위치 제약은 유지한다.
  - **Why**: 미리보기는 top·left 이동 시 반대쪽 변을 고정했지만, 일반 흐름 요소에는 크기만 기록해 실제 요소와 선택박스가 반대 방향으로 늘어났다.
  - 위치: `apps/builder/src/builder/catalogRuntime/canvasGesture.ts`.
  - 회귀: 8방향 flow 리사이즈의 미리보기·commit·undo와 위치 필드 불변, absolute·ratio top-left의 live 상자·cancel, Grid 스냅.

## [Modal — 자체 padding 제거 (RAC starter)] - 2026-10-22

### Fixed

- **`.react-aria-Modal` 의 `padding: 24px 24px` 를 지웠다**: RAC starter 의 Modal 은 padding 이 없고 본체 여백은 안의 Dialog 가 준다 — 옛 24 는 spec 시대 값의 잔재라 Modal 24 + Dialog 24 로 두 번 들어갔고, Local page 카드가 본체를 열자 Canvas 에서도 드러났다 (사용자 지적). Modal rule size `paddingX` · `paddingY` 0 (Calendar 선례) · 생성 `Modal.css` `padding: 0px 0px`. Canvas 와 Preview 모두 Dialog 가 Modal 모서리에 붙는다 (Local page Modal 높이 230 → 182).
  - 회귀: `adr279OriginOnLocalPage` 「Modal 자체 padding 없음 — Dialog 가 모서리에」 (원복 RED).

## [Local page — 오버레이 컴포넌트의 본체가 Canvas 에 열린다] - 2026-10-22

### Fixed

- **Create component 로 만든 Dialog · Popover · Tooltip · ContextualHelp · Menu 컴포넌트의 본체 (Modal · Popover) 가 Local page 카드에서 상자를 갖는다**: ADR-279 로 원본이 Local page 에 선 뒤에도 Canvas 의 「닫힌 오버레이」 규칙이 그대로 적용돼 본체가 `display: none` (0×0) 이었다 — Design 패널은 template 폭 240 을 보여도 편집할 상자가 없었다. Library page 카드가 patch `open` 으로 본체를 펼치듯, record 의 source 가 project 컴포넌트의 template root 인 trigger 의 본체는 patch 없이 열린다 (`compositionRoot.ts` `originBodyOpen` · `presence.ts` `OPEN_BODY_TRIGGERS`). page 위 instance 와 picker (Select · ComboBox · DatePicker) 의 Popover 는 닫힌 채.
  - 회귀: `adr279OriginOnLocalPage` 「ADR-279 후속」 2 (Dialog · Popover · Menu 본체 상자 > 0 · page instance 닫힘 · Select 닫힘).

## [Canvas — Body 선택 후 컴포넌트 빈 영역 더블클릭] - 2026-10-21

### Fixed

- **Body가 선택된 상태에서도 컴포넌트의 빈 영역을 더블클릭하면 해당 컴포넌트가 선택된다**: 포인터를 누를 때 선택된 조상을 유지한 뒤, 더블클릭 지점에 진입할 child가 없으면 선택도 갱신하지 않아 Body가 계속 선택되어 있었다. 선택된 조상 유지 대상에서 Body를 제외하고, 내부로 진입하지 않는 더블클릭도 현재 클릭 대상을 선택한다. 기존 child 진입과 텍스트 편집 경로를 유지한다.

## [ADR-278 Phase 1 ~ 3 — 오버레이 본체 = slot · Menu Items 에 Local 컴포넌트 · Library page 본체 칸] - 2026-10-21

### Added

- **오버레이 본체가 slot 이다 (library contract 45)**: Dialog `content` · `actions`, Popover · Tooltip `content` (OverlayArrow 뒤 region frame), ContextualHelp `content` · `footer`, Menu `Items`. 놓은 instance 는 본체의 기본 내용 (제목 · 설명 · 항목) 을 자기 노드로 갖고, Design 패널 slot 절 · Layers drop 으로 Local 컴포넌트를 넣으면 Preview 의 Modal · Popover · Tooltip · Menu 가 그 내용을 띄운다. Swap 은 같은 이름 slot 으로 내용을 옮긴다. 옛 contract 44 프로젝트는 거부 (재생성, 변환 없음 — ADR-276 · 277 과 같음).
- **컬렉션 slot 의 채움 목록에 Local 컴포넌트**: Menu `Items` (ListBox · GridList `Items` 도) 의 Fill 목록이 Library 항목 type 뿐 아니라 프로젝트 컴포넌트 중 루트가 그 자리에 설 수 있는 것 (MenuItem 루트) 을 보인다 — frame · Button 루트는 제외 (ADR-278 리뷰 h2).
- **Library page 카드가 오버레이 본체를 펼쳐 보인다**: Dialog · Popover · Tooltip · ContextualHelp · Menu 카드의 Origin 줄에서 ◆ trigger 오른쪽에 본체 (Modal > Dialog 제목 · content · actions · Close / Popover · Tooltip 상자 / Need help? / Menu 목록) 가 선다 — slot 자리는 빗금. Components page 샘플만 display state `open` (patch 필드) 으로 열고 page 캔버스 · 인스턴스 칸은 닫힌 채 (Framer 와 같음). Menu 카드의 Item 줄 = MenuItem 상태 5 (전에는 Item 줄 없음). picker (Select · ComboBox …) 의 Popover 는 그대로 닫힘.
- 테스트: `adr278OverlayBodySlot.test.ts` 12 (선언 · 44 거부 · 기본 내용 소유 · Dialog 채움 → record · Preview · Layers · 저장 · Popover · Tooltip 채움 → Preview · Swap · open patch · 검증 · 채움 목록 3 — Dialog · Menu · ListBox) · `phase4eOriginView` Library page (본체 5 · Menu Item 줄). live 7/7 (ADR-278 본문 Live Exercise).

### Fixed

- **Design 패널 slot 절의 채움 목록 (Fill slot · Add content) 이 Swap 과 같은 검색형 picker 가 됐다**: 추천 · Local · Library 가 각자 머리글 아래 묶이고 (전에는 75 항목 평평한 Select 라 Library 원본과 Local 컴포넌트가 섞여 구분되지 않았다), 목록이 자기 높이 (320px) 안에서 스크롤한다 (전에는 뷰포트보다 길어지면 끝까지 볼 수 없었다). 검색으로 좁힐 수 있다.
- **slot 절 채움 행의 Local instance 라벨**: 컴포넌트 이름 (「Confirm body」) 으로 보인다 — 전에는 루트 type (`frame`).

## [perf ratchet — ADR-277 fixture 재기준 · 레버 3a · 4a 하향 기록] - 2026-10-21

### Changed

- **ratchet 상한 올리기 150건 (사용자 승인 2026-10-21, 만료 2027-04-21)**: app-pages 계열 6 seed (`60:app-pages` · `-images` · `-images-asset` · `@dpr2` · `@zoom0.1` · `60:many-pages100@zoom0.1`) 의 등급 A — ADR-277 이 fixture 의 TableView 를 Table starter (Column ×3 + Row) 로 바꿔 (`bdc6d3980`) 문서가 커졌는데 ADR-277 은 ratchet 을 재지 않았다 (CHANGELOG 「ratchet 미측정」). 같은 코드 2 pass 에서 150 키 전부 같은 값 (`scratchpad/ratchet-overa.json`) — 2a · 3a · 4a 와 무관 (2a push 때 run 과 key 집합 동일). pre-push 는 이 초과로 block 돼 3a · 4a 는 `SKIP_PERF_RATCHET=1` 로 push 했다.
- **하향 40 · 새 지표 23 기록** (`--update`, pass 1): 레버 4a 의 `engine.solveVisits` 등. pass 2 판정 A 초과 0 · B 경고 26 (측정마다 흔들리는 cdp.LayoutCount · v8.fn 류, 차단 아님).

## [Components 팔레트 · Library page — category 재배정 · Parts 구역] - 2026-10-21

### Changed

- **팔레트 category 재배정 (Framer Insert 패널의 「넣으려는 것」 기준)**: Meter → content (ProgressBar 옆, 값 표시 묶음 — forms 의 Slider 뒤에 있었다) · Menu → layout (Nav · Breadcrumbs · Pagination 의 Navigation 묶음 — buttons 에 있었다) · Section → layout (컨테이너 — collections 의 TagGroup 뒤에 있었다) · AvatarGroup 은 catalog 값을 content 로 정정 (팔레트 overlay 가 content, catalog 가 layout 으로 서로 달랐다) · CardView 아이콘은 catalog 를 Grid 로 (LayoutGrid 는 builder ICON_MAP 미등록). `PALETTE_ONLY` overlay 에서 AvatarGroup · CardView · ButtonGroup 삭제 — catalog 에 등록돼 있어 중복이었다 (Image 만 남음). 팔레트 oracle 재캡처.
  - **Why**: 2026-10-21 Library 감사 — 사용자 지적 「각 컴포넌트에 맞지 않는 불필요한 요소가 그룹에」. Framer 는 Media · Forms · Navigation 처럼 사용자가 넣으려는 것으로 묶는다.
- **Library page 의 부품 카드는 「Parts」 구역으로 page 끝에**: Label · Input · DateInput · Description · FieldError · Heading · FieldButton 카드가 page 를 열며 컴포넌트처럼 서 있던 것을 팔레트 컴포넌트 뒤로 옮기고 제목에 「· PART」 를 붙인다 (`catalogBuiltinOrigins` 순서 · `componentsPage.ts` 카드 제목). 카드 자체는 유지 — ◆ 가 그 부품의 프로젝트 기본값 편집 자리 (Label 카드를 고치면 모든 field 의 Label 이 따라온다).
- 테스트: `paletteItems.test.ts` oracle · `phase4eOriginView.test.ts` 「Library page (2026-10-21)」 (Parts 구역 · 제목 · category 5종).

## [Library page — Item 줄 · slot 상자 · FieldButton · ContextualHelp 수리] - 2026-10-21

### Fixed

- **Library page 의 「Item」 줄이 trigger Button 의 5 상태를 그리지 않는다**: Menu · Select · SearchField · Dialog · Popover · ContextualHelp · Tooltip 7 카드가 자기 항목 대신 Button/Disabled/Hover/Pressed/Focus 를 「Item」 으로 반복했다. 항목 원본은 **declared slot 안에 있거나 두 번 이상 들어 있는** 상태 보유 원본만이다 — 루트 아래 한 번뿐인 trigger Button 은 부품이다 (`componentsPage.ts` `originItems`). Pagination · Toolbar · Nav · Tabs · ListBox 의 Item 줄은 그대로.
  - **Why**: Framer component 체계 대조 (2026-10-21 deep research) 뒤 사용자 지적 「각 컴포넌트에 맞지 않는 불필요한 요소」 — 판정이 「깊이 2 안에서 처음 만나는 상태 보유 원본」 이라 trigger 가 먼저 잡혔다.
- **root slot 의 빗금 상자가 항목 하나 크기**: ListBox · GridList · CardView 처럼 루트가 slot 인 원본은 같은 정의의 반복 항목 중 첫 것만 배치하고 나머지는 끈다 (`enabled: false`). GridList · CardView 의 빗금 상자가 세 항목 쌓인 ~500 px 였다. Toolbar 의 Separator 처럼 정의가 다른 내용은 그대로 둔다. 자식 slot (Table 의 Columns · Tabs 의 TabList) 은 변경 없음.
- **FieldButton 카드가 빈 카드가 아니다**: ADR-276 뒤 FieldButton 원본 (Button instance · label 없음) 에 `icon` 이 없어 `{icon}` 이 그대로 남아 아무것도 그리지 않았다. 원본 기본 glyph `chevron-down` — ComboBox · DatePicker instance 는 자기 `icon` 을 그대로 쓴다.
- **ContextualHelp trigger 의 ? 아이콘이 둘이 아니다**: ADR-276 이 Button 원본에 icon slot 자식을 두면서 ContextualHelp trigger 가 갖고 있던 자기 Icon 자식이 남아 resolver 가 두 Icon 에 glyph 를 찍었다. trigger 의 Icon 자식 template 삭제 — Button 원본의 icon slot 이 glyph 를 받는다.
- 테스트: `phase4eOriginView.test.ts` 「Library page (2026-10-21)」 — 원복 RED 4 (Item 규칙 · one-of-each · FieldButton `{icon}` · ContextualHelp Icon 2). 남은 것 (별도): Table 카드의 빈 공간은 Table 원본의 `height: 400` 기본값.

## [레이아웃 엔진 — 노드 제거가 문서 전체를 다시 풀지 않는다] - 2026-10-21

### Performance

- **요소 삭제 · 데이터 연결 · 삽입 undo 가 문서 전체 레이아웃을 다시 계산하지 않는다**: 엔진 `remove_node` (`packages/engine/src/tree.rs`) 가 `last_compute` 를 무조건 비워 다음 `compute_layout` 이 「available 변경」 으로 읽고 `mark_subtree_dirty(root)` — 트리 전체를 dirty 로 풀었다 (ADR-916 단위 4, `4e8ac7cd6`). 이제 root handle 자신을 지울 때만 비운다 — 그 밖의 제거는 부모 `set_children` 의 조상 dirty 전파로 충분하고, 재활용된 handle 의 새 노드는 skip 키 (`last_solved` · `last_avail`) 가 비어 있어 stale skip 이 없다.
  - **Why**: ADR-248 이후 Canvas 성능 조사 레버 4 (`.agent/runs/2026-10-21-canvas-perf-regression/lever4/`) — 22 페이지 · record 10,664 문서에서 「1000 행 연결」 long task 194~~447 ms (사용자 4x) 를 귀속: 행 수 무관 (10 행도 같음), self-time 55~~75 % 가 `computeLayout` (engine wasm), `engine.solveVisits` 46k = 문서 전체 1 pass. Button 1개 삭제도 같았다 (45,860 · 80 ms · 4x 290). 삽입 · 폭 편집은 55~651.
  - 효과 (dev · 같은 문서): 삭제 solve 45,860 → 49 · 80 → 10 ms (4x 286 → 27) · Table 연결 46,165 → 349 · 109 → 46 ms (4x 403 → 183) · GridList 1000 행 연결 46,741 → 651 · 107 → 48 ms (4x 438 → 225). 1x long task 0 (`steps-dev-after.json`). 연결에 남은 몫은 글자 측정 · resolver.
  - 테스트: `remove_node_keeps_clean_sibling_subtrees_skipped` (RED: 형제 서브트리 재 solve) · `remove_root_handle_reuse_recomputes` (root handle 재발급은 종전대로 다시 푼다). cargo test 501 · golden 15 PASS.
  - ratchet: `engine.solveVisits` (edit 류) 가 크게 내려간다 — 하향 기록 (`--update`) 은 app-pages 재기준과 같이.

## [Builder 로드 — mount 의 바인딩 행 중복 해석 제거] - 2026-10-21

### Performance

- **빌더가 열리며 바인딩 컬렉션의 행을 두 번 해석하지 않는다**: `CatalogBuilderCore` 의 mount effect 가 `workspace.refreshRows()` 를 무조건 불러 바인딩 소유자가 있는 page root 를 전부 다시 flatten 했다 — boot 는 `initializeForProject` 를 await 한 **뒤에** root 를 만들므로 root 는 이미 그 행을 가진 상태였다 (재해석 결과 record 7,731 전부 동일). mount 는 root 가 읽은 collections (`rowsSource`) 와 다른 것만 새로 고치고 (`changedCollectionIds`, `catalogRuntime/rowsRefresh.ts`), 이후 변경은 종전대로 data store 구독이 `refreshRows(changed)` 로 보낸다.
  - **Why**: ADR-248 이후 Canvas 성능 조사 레버 3 (`.agent/runs/2026-10-21-canvas-perf-regression/lever3/`) — 22 페이지 · record 10,664 · 바인딩 소유자 9 문서의 로드 long task 643 + 578 ms (사용자 탭) 를 귀속: ② root 생성 626 ms (`loadInitial` — JS 해석 + record 조립 75 %, 엔진 8 %) · ③ 첫 프레임 480 ms (장면 bind 50 % · **`refreshRows()` 중복 26 %** · geometry 13 %). production 도 같은 값이라 제품 몫.
  - 효과 (dev · 1x): ③ 478~~492 → 141~~146 ms · presented 1.74~~1.81 → 1.41~~1.45 s · 로드 뒤 `doc.rootResolverVisits` 7,731 → 0. production · 4x 값은 lever3 README.
  - live: 로드 뒤 바인딩 collection 에 행 1개 삽입 → Canvas rowCount 1000 → 1001 · 「+990 more」 → 「+991」 · 재해석은 그 collection 의 root 만 (811) · undo 로 1000 복귀 (`live-3a.json`).
  - 남은 꼬리 (같은 README): ② `loadInitial` 전 페이지 동기 해석 · ③ 장면 bind 전 record — 화면 안 페이지 먼저 (ADR 규모) · `refreshRows` 자체 (호출 1회 324~370 ms · 4x 1.3 s — page root 전부 재 flatten + 장면 전체 재 bind, 레버 4 후보).
  - 테스트: `rowsRefresh.test.ts` (변경 id 산출 · mount 가 무조건 `refreshRows()` 를 부르지 않는다는 정적 게이트).

## [Canvas pan — overlay chrome 을 scene 버전으로 보관] - 2026-10-21

### Performance

- **pan 중 camera-only 프레임이 record 전체를 다시 훑지 않는다**: overlay 의 slot 표시 (`catalogSlotMarks` — `root.domInputs` 전체 순회 + 조상 오르기 + `graph.getEntry`) · 바인딩 컬렉션의 「+N more」 나머지 (`catalogRowRemainders` — `canvasInputs` 전체 순회) · 페이지 가림 상자 (`catalogOccludingPages`, slot · 나머지 · 배지마다 페이지 O(n)) 를 Canvas 의 scene 버전 (`cellsVersion` — step · 미리보기 · 데이터 행 · 페이지 grid · 다른 root 에서 오른다) 으로 보관한다 (`workspace/canvas/catalog/catalogOverlayChrome.ts`, `CatalogCanvas.tsx` 의 overlay 입력). hover · 선택은 상자를 움직이지 않으므로 overlay 버전이 아니라 scene 버전이 키다.
  - **Why**: ADR-248 이후 Canvas 성능 조사 (2026-10-21, `.agent/runs/2026-10-21-canvas-perf-regression/lever2/`) — 22 페이지 · record 11k 문서의 휠 pan 에서 프레임당 ~~1~~1.5 ms 가 이 세 계산이었다 (app 몫의 절반, `graph.getEntry` 가 app self 1위). 120 Hz 면 busy 12~~18 %, 4x throttle 이면 4~~6 ms/frame 이라 재기록 프레임과 겹치면 예산을 넘겼다. 입력은 scene 이 바뀔 때만 움직인다.
  - 카운트: `render.overlayChromeBuilt` (slot 표시를 만든 횟수) — ratchet 조건 `60:app-pages` zoom · pan · page-switch 153 · 179 · 10 (프레임마다) → 0 · 0 · 0, edit 15 → 15 (step 마다 1). 원복 RED = 보관을 빼면 179 (2회 동일). ratchet 등재 (`--add-keys`) 는 ADR-277 fixture 변경 (TableView → Table) 으로 생긴 기존 A 초과 13건이 막아 `60:app-pages` 재기준 뒤로 미룸.
  - wall-clock 방향 (gridlist-1000 · 데이터 행 포함 · dev · 휠 pan 3 s): main busy 가로 pan 11.7 → 7.7 % (app 4.8 → 1.5) · 4x 24.7 → 15.0 % (app 14.6 → 3.2) · 세로 pan @4x drop 11.9 → 6.2 %. overlay `renderSkia` 포함 시간 130 → 12 ms / 3 s. 재기록 (CanvasKit picture 재생) 은 그대로 — 별도 항목 (ADR-266 대안 B).
  - 테스트: `catalogOverlayChrome.test.ts` (같은 버전 1회 · 버전 변경 재계산 · 가림 identity 별 보관).

## [ADR-277 — Table · TableView 통합 — 표는 하나] - 2026-10-21

> Implemented 2026-10-21 — 사용자 G5 확인 (Chrome `adr277-live`). G4: preflight 전 단계 PASS · initial 번들 Builder −176 · Preview −163 B gzip (상한 안) · ratchet 미측정 (하니스 인증 세션 없음, 삭제뿐이라 카운트 증가 경로 없음). 본문 `docs/adr/completed/277-table-tableview-merge.md`.

### Removed

- **팔레트 「table view」 (TableView type) 삭제** (ADR-277 Phase 1, 사용자 결정 2026-10-21 「Table 로 통합 · starter 넣음 · 첫 연결은 교체」): S2 이름의 둘째 표 type 은 origin 정의 · template · binding · rule (`COMPONENT_RULES_TABLE.TableView`) · 생성 `TableView.css` · DOM 렌더러 (`CatalogTableView`) · 카탈로그 entry · Properties 메타 · i18n 라벨 · 로드 전환 (`s2PropAlignment`) 을 전부 지웠다. `"Table" || "TableView"` 쌍 14 자리 (열 트랙 · 선택 부품 · 정렬 · 리사이즈 · density · overflowMode · 항목 소유 · 중첩 · 필수 부품 · "+" 목록 · 이름 필요 집합) 는 Table 하나. RAC 에는 `Table` 하나, S2 에는 `TableView` 하나뿐이고 이 저장소의 Table 은 이미 S2 TableView 의 prop 축을 다 받고 있었다 (`d2S2Alignment` 가 Table ↔ S2 TableView 로 대조 — 그대로).

### Changed

- **팔레트 「table」 을 놓으면 열 3 (Name · Type · Status) · 행 1 (Item 1 · File · Active) 이 보인다** — 옛 TableView 의 starter 를 Table origin template 이 받았다 (전에는 빈 400 px 상자). 데이터를 묶으면 TableBody 의 정적 행은 투영 행으로 바뀐다 (지금 규칙).
- **첫 Quick Connect 는 열을 schema 로 교체한다**: binding 이 없던 Table 의 첫 연결은 starter 열 (key `name` · `type` · `status` — schema 와 맞지 않아 칸이 빈다) 을 schema 열로 바꾸고, Data 패널이 교체될 열 key 를 실행 전에 안내한다. 이미 묶인 Table 의 재연결은 지금처럼 보존 기본 + 「새 스키마로 컬럼 교체」 스위치. 판정은 Table 의 실제 binding (`target.binding.props`).
- **열 교체 (`replace`) 가 정적 Row 의 Cell 을 새 열 수만큼 다시 만든다** — 전에는 header 만 바꿔 바인딩을 해제하면 Cell 3 ↔ Column N 이 어긋나 RAC 가 던졌다 (ADR-256 Phase 5i G0 ⑨).
- 옛 TableView 의 모습 (fill layer-1 · height auto · 늘 RAC container · radius md) 은 없다 — Table 모양 (fill base · 기본 fixed 400 · 조절 열 있을 때만 container) 하나. 높이는 `heightMode: auto` 로.
- **옛 문서 거부**: `LIBRARY_CONTRACT_VERSION` 43 → 44 — TableView instance · starter 없는 Table 이 든 개발용 프로젝트는 열리지 않는다 (변환 없음, 사용자 지시 2026-10-14). 개발용 프로젝트는 다시 만든다.
- 위치: `catalog/document/generated/reusableOriginLibrary.ts` · `catalog/document/types.ts` · `catalog/bindings/{index.ts, TableView.binding.ts 삭제}` · `catalog/componentCatalog.ts` · `catalog/generated/componentRulesTable.ts` · `components/styles/{index.css, Table.css, generated/TableView.css 삭제}` · `catalog/runtime/{domRegistry.components.tsx, domRegistry.runtime.ts, domBinding.runtime.ts, tableTracks.ts, presence.ts}` · `catalog/commands/collections.ts` · `catalog/document/{s2PropAlignment, sizePropagation, collectionItems, ruleDefinition}.ts` · `domain/componentTraits.ts` · `catalog/nesting/{nestingRules, requiredParts}.ts` · `panels/datatable/{utils/quickConnectPlan.ts, usage/catalogQuickConnectHost.ts, editors/DataTableCreator.tsx}` · `panels/components/paletteItems.ts` · `catalogRuntime/itemInsert.ts` · `panels/properties/ariaLabelNeed.ts` · `factories/constants.ts` · `types/builder/unified.types.ts` · `components/metadata.ts` · `types/composition-vocabulary.ts` · i18n. 테스트: `adr277TableOrigin` 7 (starter · 투영 행 · 첫 연결 교체 · 재연결 보존 · replace 정렬 · 심볼 0 · contract 44) · 영향 37 파일. live (Chrome MCP, `adr277-live`): Canvas = Preview 270 칸 ≤ 0.01 px · 첫 연결 교체 열 18 · 해제 뒤 정적 행 정렬 · 재연결 보존 + 스위치 · quiet · highlight · resizer · 정렬 · 43 문서 거부 · 런타임 오류 0 (ADR-277 `### Live Exercise`).

## [Canvas 중첩 선택 — Ctrl 재선택] - 2026-10-21

### Fixed

- Ctrl/⌘로 중첩 child를 고를 때 이미 선택된 요소의 간격·크기 핸들이 선택을 가로채지 않는다. 이후 같은 child를 일반 클릭하거나 컨텍스트 메뉴를 열어도 상위 요소로 선택이 돌아가지 않는다. Ctrl/⌘를 누른 경우에는 가장 깊은 대상을 사용한다.

## [ADR-276 — Button 글자를 Text 자식으로 · IconButton 통합] - 2026-10-20

### Changed

- **팔레트 Button · ToggleButton 이 옛 IconButton 과 같은 구조 (`Button > Icon{icon} + Text{label}`) 가 됐다** (ADR-276 Phase 1 ~ 3, 사용자 제안 2026-10-20 「button 컴포넌트에 text 를 처음부터 넣으면 해결되지 않나 · IconButton 통합」): 글자는 instance 의 `label` prop (Text 자식에 묶임), 아이콘은 `icon` prop (기본값 없음 — 비우면 글리프가 숨고, Properties Icon 칸의 지우기가 「없음」). `label` 을 비우면 Text 노드가 없어 icon-only Button 이 된다 (`aria-label` 로 이름). 보고된 결함 3건의 원인이 사라진다 — Button 글자가 Layout 정렬 (start · center · end) 을 따르고 (종전 Canvas 가 center 고정 익명 글자로 그렸다), 글자를 바꾼 뒤 아이콘을 넣어도 글자가 둘이 되지 않으며 (자식 노드를 만들고 옮기던 `setIcon` · `clearIcon` 명령 삭제), 아이콘을 지울 수 있다.
  - 중첩 Button 자리 34 (NumberField 증감 · Select trigger · SearchField 지우기 · Calendar picker · ContextualHelp · FieldButton · Toolbar · Pagination `← 1 2 3 →` · ButtonGroup `Cancel · Save` · Menu · Dialog · Popover · Tooltip trigger · ToggleButtonGroup 항목) 는 같은 template 을 받고 자기 글자를 `label` 로 그대로 둔다 (값 변경 0). FieldButton 은 자기 Icon 자식 대신 Button 의 Icon 자리에 `icon` 을 묶는다 (글리프 둘이 되지 않게).
  - IconButton 팔레트 항목 · origin 정의 는 삭제 (S2 에 IconButton 은 없다 — 사용자 결정 ①). Button · ToggleButton 의 Properties 는 Label · Icon + root 계약 (`children` 칸 없음).
  - ToggleButton 의 Text 자식도 버튼의 크기 (part rule) 와 글자색 (선택 · 강조 상태) 을 따른다. Button · ToggleButton 에 쓴 typography (letterSpacing · textAlign · textDecoration) 는 Text 자식에 닿는다 — text-decoration 은 CSS 처럼 자손 글자로 전파되고 버튼 (atomic inline box) 에서 멈춘다.
  - Button 더블클릭은 Text 자식을 편집한다 (편집 상자는 2026-10-20 수정대로 글자 줄 위).
  - **옛 문서 거부**: `LIBRARY_CONTRACT_VERSION` 42 → 43 — 자체 `children` 글자 Button · IconButton instance 가 든 개발용 프로젝트는 열리지 않는다 (변환 없음, 사용자 지시 2026-10-14 「마이그레이션 코드 금지」). 개발용 프로젝트는 다시 만든다.
  - 위치: `catalog/document/generated/reusableOriginLibrary.ts` · `catalog/document/{types,codeCatalogLibrary}.ts` · `catalog/runtime/{compositionRoot,presence,boxModel,libraryVisual,domBinding.runtime}.ts` · `catalogRuntime/{canvasBinding,canvasPick}.ts` · `components/reusablePropsSchemas.ts` · `panels/properties/catalog/CatalogPropertiesPanel.components.tsx` (`buttonChildren.ts` · `CatalogButtonChildFields.tsx` 삭제) · `componentCatalog.ts` · `paletteItems.ts`

## [Canvas 글자 편집 — Button 라벨 자리] - 2026-10-20

### Fixed

- **Button 을 더블클릭하면 편집 상자가 버튼 전체가 아니라 라벨 글자 줄 위에 놓인다** (사용자 보고 2026-10-20 「텍스트 위치에서 편집되지 않고 버튼 영역 전체에서 된다」): 편집 상자는 Skia 가 글자를 그리는 content 상자 — padding 안 · `verticalAlign: middle` 이면 상자 세로 중앙의 글자 줄 · 글자 노드의 정렬 (center) · 글꼴 (크기 · 굵기 · 줄 높이 · 글꼴 이름) — 를 따른다 (`resolveTextEditBox`). 글자 노드가 없으면 종전대로 요소 상자. Skia 가 한 줄로 그리는 nowrap 글자 (Button 라벨) 는 편집 중에도 줄을 바꾸지 않고 (`white-space: pre`) 입력 글자만큼 폭이 늘어난다 — 종전엔 옛 폭에서 줄이 바뀌어 상자 높이가 두 줄로 굳었다. live: Button 68 × 30 의 라벨 42 × 20 위에서 편집 · 입력 중 폭 71 → 107 · 높이 20 유지 · 확정 뒤 Label 반영.
  - 후속 (같은 날, 사용자 보고 「absolute 로 옮기거나 부모 padding 을 바꾸면 편집 위치가 글자와 다르다」): 글자 노드가 요소 루트 자체일 때 (`bindings.text` 는 layout rect 의 x · y 를 담는다) 그 x · y 를 더해 옮긴 거리가 두 번 더해졌다. 루트의 x · y 는 빼고 자손 노드의 요소 안 오프셋만 더한다. live: Left 120 · Top 80 absolute Button 의 라벨 위에서 편집.
  - 편집기 글자색은 Skia 가 그린 글자의 색 (Button · Badge · ToggleButton 의 흰 라벨) — 종전엔 record 의 `color` (상자의 것) 라 검정이었다.
  - 전수 live (2026-10-20, grid 셀에 놓여 (0,0) 이 아닌 자리): Text · Badge · Link · ToggleButton · TextField 의 Label · Checkbox 라벨 · InlineAlert 의 Heading · Description · Tag 글자 · Tab 라벨 — 모두 글자 상자 위. Input placeholder 는 종전대로 인라인 편집 대상이 아니다 (Properties 에서).
  - 후속 2 (같은 날, 사용자 보고 「border box 가 글자 선택 상자보다 넓다 · Enter 줄바꿈 시 버튼 높이가 반영되지 않는다」): 한 줄 글자의 편집 상자는 content 상자 (Badge 의 padding 안 전체) 가 아니라 글자 폭으로 감싸고 정렬 (left · center · right) 자리에 놓는다. Enter 로 넣은 줄바꿈은 확정 때처럼 미리보기에도 white-space 를 올려 (nowrap → pre · normal → pre-wrap) 보내므로 버튼이 입력 중 두 줄로 자라고, 편집 상자는 세로 앵커 (middle) 를 지켜 그 중앙에 머문다. live: Button 68×30 → Enter 뒤 69×50 · 상자 43×40 중앙.
  - 편집 상자의 outline 은 selection box 처럼 화면 1px (`1/zoom`) — 종전엔 scale(zoom) 안의 1px 라 500% 에서 5px 였다 (사용자 보고).
  - 위치: `workspace/canvas/skia/textDrawOrigin.ts` · `workspace/canvas/catalog/CatalogTextEditor.tsx`

## [ADR-275 Phase 7 — Position Fixed 허용] - 2026-10-20

### Added

- **Position 절에서 Fixed 를 고를 수 있다** (ADR-275 Phase 7 — 사용자 결정 6, ADR-267 결정 1 · 2 를 닫음):
  - 기준 화면 (viewport) 은 page body 영역이다 — page 의 원점 + breakpoint 화면 크기 (Desktop 1920 × 1080 · Tablet 768 × 1024 · Mobile 390 × 844). page 가 저작 높이로 화면보다 길어도 스크롤 0 의 화면 하나다 (Preview iframe 과 같다).
  - Fixed 를 누르면 상자가 그 자리 그대로 화면 기준 위치가 된다. pin 상자 · Top · Right · Bottom · Left · Fill 은 Absolute 와 같고, 결과 문장이 「In the screen」 으로 시작한다. Canvas 에서 끌어도 화면 기준으로 저장된다.
  - Canvas 는 fixed 상자를 조상의 잘림 (overflow) · 스크롤 밖에서 그리고, page 를 스크롤해도 화면의 같은 자리에 둔다. Preview 는 CSS `position: fixed` 그대로.
  - 저장은 `layout.position: fixed` + `inset*` (breakpoint 별). contract 42 그대로.
  - 위치: `packages/engine/src/tree.rs` (`place_fixed_boxes`) · `catalog/document/validation.ts` · `catalog/runtime/{compositionRoot,domBinding.runtime,positioning}.ts` · `workspace/canvas/skia/{renderCommands,subtreeTranslate}.ts` · `catalogRuntime/{canvasBinding,position,canvasGesture}.ts` · `panels/styles/sections/TransformSection.tsx`

### Changed

- **Position 절 정리** (ADR-275 사용자 결정 7): Top · Right · Bottom · Left 칸 위 글자를 뺐다 (변은 pin 상자 둘레의 자리로 읽는다). `Center X` · `Center Y` 버튼을 뺐다 — pin 상자의 십자선과 같다. `Fill` 은 절 오른쪽 아이콘 칸 (Size 와 같은 열) 의 버튼이 됐다.
- **Position pin 상자 = Alignment 판 크기** (ADR-275 사용자 결정 8): 4방향 도식은 Layout 의 Alignment 판 (한 열 × 84) 을 넘지 않는다. 칸이 상자를 둘러싸는 배치는 그대로, 좌우 칸이 「auto PX」 를 담도록 도식 줄이 아이콘 칸까지 쓰고 `Fill` 은 모드 줄 오른쪽 아이콘 칸으로 옮겼다.
- **Padding 은 Layout 절 안 · Spacing 절 제거** (ADR-275 사용자 결정 9 · 10, Figma 구성): Wrap · Gap 아래 「↔ 가로 · ↕ 세로 · 펼침」 한 줄, 펼치면 「Left · Top」 / 「Right · Bottom」 두 줄 (두 변이 다르면 펼친 채 시작, 접힌 칸은 Mixed). 패널의 margin 편집 UI 는 없다 — Figma · Framer 처럼. 문서의 margin 값은 그대로 그려지고 Layout 절 reset 이 지운다.
  - 위치: `panels/styles/sections/TransformSection.tsx` · `components/styles/inspector-layout.css`

### Fixed

- **Tablet · Mobile 에서 Absolute 상자의 pin 으로 Left+Right 를 만들면 아무 일도 없고 오류 토스트가 떴다**:
  - **Why**: 늘인 축의 폭을 breakpoint 층에서 `mask` 로 지웠는데, 문서는 크기 칸의 mask 를 받지 않는다 (`SIZING_MASK_FORBIDDEN`).
  - 수리: breakpoint 층은 `null` (auto) 로 쓴다. Desktop 은 종전대로 지운다.
  - 위치: `catalogRuntime/position.ts`

## [ADR-275 Phase 6 — Position Sticky 허용] - 2026-10-20

### Added

- **Position 절에서 Sticky 를 고를 수 있다** (ADR-275 Phase 6 — 사용자 결정 5, ADR-267 결정 1 을 sticky 에 한해 뒤집음):
  - Sticky 를 누르면 상자가 흐름으로 돌아가 스크롤 컨테이너 위쪽 0 에 붙는다. 지난 Absolute 의 위치 값과 가운데 정렬은 지운다.
  - Top · Right · Bottom · Left 칸이 각자 「스크롤할 때 붙는 거리」 다. 빈 칸은 `auto` (그 쪽으로는 붙지 않는다). pin 상자 · Center · Fill 은 쓰지 않는다.
  - 저장은 `layout.position: sticky` + `inset*` (breakpoint 별). contract 는 42 그대로 — 받는 값이 하나 늘었을 뿐 옛 문서는 그대로 열린다.
  - Fixed 는 계속 고를 수 없다 (Canvas 의 viewport 기준을 먼저 정해야 한다 — ADR-267 결정 2).
  - 위치: `packages/shared/src/catalog/document/validation.ts` · `catalog/runtime/domBinding.runtime.ts` · `catalogRuntime/position.ts` · `panels/styles/sections/TransformSection.tsx`

### Fixed

- **Canvas 에서 붙은 sticky 상자가 스크롤된 항목 아래로 숨었다**:
  - **Why**: z-index 없는 sticky 상자를 트리 순서로 그렸다 (CSS 는 positioned layer — 흐름 형제 위). 그리고 상자가 sticky (또는 z-index) 로 바뀌어도 그 상자만 제자리 재기록돼 형제 사이 순서가 그대로였다.
  - 수정: 같은 z 안에서 z-index 없는 sticky 상자를 흐름 형제 뒤에 그린다 · 그리기 층이 바뀐 상자는 장면을 다시 묶는다 (Styles 의 z-index 편집도 함께 바로 반영).
  - 위치: `workspace/canvas/skia/renderCommands.ts` (`sortChildElementsByZIndex`) · `catalogRuntime/canvasBinding.ts` (`paint-order`)
- **Absolute 상자의 고정 변 칸을 비우면 「Selected element not found」 가 떴다** — 쓸 것이 없는 편집은 조용히 넘어간다 (`catalogPositionChangeCommand` → `null`).

## [ADR-275 Phase 4 — Position 절: pin 상자 · 변 옆 칸] - 2026-10-20

### Changed

- **Design 패널 Position 절을 다시 짰다** (ADR-275 — Figma 규칙 + Framer 칸 배치):
  - Relative · Absolute 를 글자 버튼으로 고른다 (Sticky · Fixed 는 보이지만 아직 고를 수 없다).
  - 가운데 pin 상자에서 위 · 오른쪽 · 아래 · 왼쪽 변과 가로 · 세로 가운데를 고른다. 한 축의 양쪽 변을 누르면 늘어나고, 마지막 변은 풀리지 않는다. 바꿔도 상자는 그 자리에 있다.
  - Top · Right · Bottom · Left 칸이 상자의 같은 변 옆에 있다. 고정되지 않은 칸은 점선 `auto` 이고, 값을 넣으면 그 변으로 바뀐다 (반대 변은 풀린다). 단위는 `px` · `%`.
  - Center X · Center Y · Fill 버튼과 지금 위치 기준을 한 줄로 보여 주는 문장.
  - Relative 에서는 Left · Top 이 제자리에서 옮기는 값이고 Right · Bottom 은 쓰지 않는다.
- **가운데 축의 margin 은 잠긴다**: 명령이 그 축 margin 쓰기를 거부한다 (위치는 Position 에서 바꾼다 — Figma · Framer 와 같다. 패널에는 margin 칸이 없다 — 결정 10).
- 위치: `panels/styles/sections/{TransformSection,PositionPinBox,PaddingFields}.tsx` · `components/property/PropertySegment.tsx` · `catalogRuntime/position.ts` · `components/styles/inspector-layout.css`

## [ADR-275 Phase 2 · 3 — 위치를 layout inset 으로 저장 · Canvas 가 제약을 지킨다] - 2026-10-19

### Changed

- **절대 위치가 다른 레이아웃 값과 같은 자리에 저장된다** (ADR-275): `position: absolute` + `left · top · right · bottom` (+ 가운데는 `justify-self` / `align-self: unsafe center`). 그래서 `%` 단위 · 오른쪽 · 아래 기준 · 늘이기 · 가운데 · breakpoint 별 위치가 저장된다 — Styles 의 Left · Top 에 `10%` 를 넣으면 전에는 거부됐다.
- **Canvas 이동이 위치 기준을 지킨다**: 오른쪽 · 아래에 고정한 상자는 끌면 그 변의 값이, 가운데 상자는 가운데에서의 거리가, 양쪽 고정 상자는 두 변이 같이 바뀐다. 크기 조절 · 정렬 · 분배 · Alt 복사 · 붙여넣기도 같다.

### Fixed

- **폭이나 높이가 정해지지 않은 부모 안의 absolute 상자** (in-flow 자식 없음 — 부모 block 이 폭을 채우거나 flex 가 높이를 늘인 경우): 오른쪽 · 가운데 기준이 부모의 실제 크기로 놓인다. 전에는 크기 0 기준이라 Canvas 에서 부모 왼쪽 밖으로 나갔다 (Chrome oracle). 위치: `packages/engine/src/tree.rs`

### Breaking

- 프로젝트 문서 형식 42 — 노드 `placement` 필드가 없어졌다. 41 이전 개발용 프로젝트는 열리지 않는다 (사용자 결정 1, 전환 코드 없음).
- 위치: `packages/shared/src/catalog/{document,runtime,resolution,commands,transactions}` · `apps/builder/src/builder/catalogRuntime/{positionConstraint,position,canvasGesture,shortcuts,styleDirty}.ts` · `panels/styles/catalog/catalogStylesHost.ts`

## [ADR-275 Phase 1 — absolute 자기 정렬 · 키워드 크기] - 2026-10-19

### Fixed

- **양쪽 inset 을 준 absolute 상자가 Canvas 에서도 Chrome 처럼 놓인다** (ADR-275 Phase 1 — Chrome oracle `absoluteSelfAlign` 19 / 19):
  - `justify-self` · `align-self` 를 읽는다. stretch 가 아니면 크기 auto 는 내용 크기 (fit-content) 로 두고 inset 영역 안에 정렬한다. `unsafe center` 는 부모보다 넓어도 가운데, 접두 없는 정렬은 넘치면 부모 안으로 당긴다. 전에는 늘이거나 왼쪽에 붙였다.
  - `width` · `height` 가 `fit-content` · `min-content` · `max-content` 면 양쪽 inset 이 늘이지 않는다 — padding · border 를 준 상자도 border-box 그대로 (88 × 48).
  - 양쪽 `margin: auto` 인데 상자가 부모보다 크면 가로는 왼쪽 inset 에 붙고 세로는 가운데 (Chrome 과 같음). 전에는 가로도 가운데였다.
  - 위치: `packages/engine/src/tree.rs`

## [Chromium 재대조 엔진 격차 5 건 수정] - 2026-10-19

### Fixed

- **Canvas 레이아웃이 Chrome 과 갈리던 5 경우를 맞췄다** (재대조 기록 `CHROMIUM_CANVAS_PARITY_2026-10.md` §7-7, 항목마다 Chrome 비교 테스트):
  - **변별 border 를 가진 글자 줄바꿈 폭** (A-NEW-2): 줄바꿈 다시 재기가 엔진이 실제로 쓴 변별 · snap border 를 뺀다 (`usedBorder`). 전에는 한 변 border 를 무시해 줄 수가 달랐다 (live 내용 폭 162 / 162).
  - **`vw` · `vh` 단위** (A-NEW-1): breakpoint 페이지 크기로 푼다. 전에는 엔진 viewport 가 비어 있었다 (live mobile `50vw` → 195 / 195).
  - **측정용 내부 값이 일반 계산에 섞이던 문제** (C-NEW-1 · 2 · 8 · F10): max-content 측정에서 inline 항목이 한 줄에 서고, `width: 100%` 컨테이너가 측정 중 크기 키워드로 읽히지 않으며, inline-block 글자 leaf 가 shrink-to-fit 폭을 받고, 풀 수 없는 `%` min-height 가 0 이 된다 (live flex row 안 block 의 Button 2 개 한 줄).
  - **양쪽 inset 으로 늘어난 absolute 상자의 일반 자식** (B-NEW-1): 늘어난 크기로 자식을 배치한다 (live `width: 100%` 자식 180 / 180).
  - **flex row 의 고정 폭 컨테이너 항목 최소 크기** (D-NEW-1): ADR-268 의 내용 최소 폭 보정이 px 뿐 아니라 `%` · `vw` · `rem` · `calc()` 폭에도 적용된다. 전에는 `width: 100%` 항목 둘이 200 행에서 내용 150 아래 100 / 100 으로 줄었다 (live Canvas · Preview 150 / 150).
  - 위치: `packages/engine/src/{tree,block,style,wasm}.rs` · `packages/shared/src/catalog/runtime/compositionRoot.ts`

## [Canvas border 폭 device pixel snap] - 2026-10-19

### Fixed

- **Canvas 가 border 폭을 Chrome 처럼 device pixel 로 맞춘다** (Blink `ClampLineWidth` — device px 로 0 < w < 1 은 1, 아니면 floor):
  - 레이아웃: 엔진이 border 를 읽는 모든 곳 (`resolve_border` → `snap_line_width`) 이 builder 창의 `devicePixelRatio` 로 snap 한다. 전에는 hairline 0.5px 를 DPR 1 에서 0.5 로 배치해 ListBox Header 가 Canvas 27 / Preview 28, 섹션마다 1px 씩 어긋났다 (live: 스크롤 0 의 헤더 위치 4.5 · 123.5 · 214.5 → 5 · 125 · 217, Preview 와 같음). DPR 1.25 · 1.5 같은 소수 배율에서는 1px border 도 1 device px 로 줄어든다.
  - 그리기: 박스 stroke (`renderBox`) · 변 border · 항목 구분선 · quiet 밑줄과 글자 · 아이콘 · clip · 스크롤 inset 이 같은 폭을 쓴다 (`snapBorderWidth`).
  - 창이 다른 디스플레이로 옮겨지거나 확대 배율이 바뀌면 새 root 로 다시 배치한다 (`workspace.setDevicePixelRatio`).
  - 위치: `packages/engine/src/{style,tree,wasm}.rs` · `packages/rendering/src/primitives/border.ts` · `catalogRuntime/{canvasBinding,ruleShapes,workspace}.ts` · `workspace/canvas/skia/{nodeRendererBorders,specShapeConverter,specBuildHelpers}.ts` · `CatalogCanvas.tsx` · `CatalogBuilderCore.tsx`

## [Styles · Grid 끌기 미리보기가 놓은 뒤 남는 문제 수정] - 2026-10-19

### Fixed

- **확정 · 취소 뒤 같은 프레임에 예약돼 있던 Styles 미리보기가 다시 걸리지 않는다**:
  - 섹션이 다음 프레임에 미루어 둔 미리보기 (`useOptimizedStyleActions`) 는 그 사이 확정이나 취소가 있었으면 버린다 — host 가 끌기 끝마다 세는 `previewEpoch` 로 판정한다. 전에는 마지막 이동과 놓기가 한 프레임에 오면 놓은 뒤 미리보기가 다시 걸려 Canvas 만 옛 값 (취소한 색 등) 을 보였다.
  - 끌기 도중 섹션이 사라지면 (선택 · 탭 변경) 걸어 둔 미리보기를 해제한다.
- **확정 없이 끝난 끌기의 값이 다음 끌기에 섞이지 않는다**: host 는 Canvas 에 아직 미리보기가 걸린 record 의 기록만 이어받는다 (`root.previewing`). 전에는 같은 색으로 놓은 뒤 undo 하고 Opacity 를 끌면 지난 값이 Canvas 에 다시 나타났다.
- **여러 요소를 고른 미리보기에서 한 요소의 값이 담기지 않아도 나머지 요소는 계속 따라온다** (`continue`).
- **Grid 열 · 행 경계를 빠르게 튕겨도 크기가 확정된다**: 놓을 때 아직 그려지지 않은 상태 대신 끌기가 보여 준 크기를 읽는다. 끌기 중 grid 선택이 풀려도 미리보기를 해제한다. 전에는 한 프레임 안의 튕김이 버려졌다 (live: 150px 열 +40 → 고치기 전 확정 0회, 고친 뒤 1회).
- 위치: `panels/styles/catalog/catalogStylesHost.ts` · `panels/styles/hooks/useOptimizedStyleActions.ts` · `workspace/canvas/catalog/CatalogGridTrackLayer.tsx` · `packages/shared/src/catalog/runtime/compositionRoot.ts` (`previewing`)

## [Switch 누름 중 thumb 돌출 수정] - 2026-10-19

### Fixed

- **선택된 Switch를 누를 때 thumb가 오른쪽 트랙 밖으로 벗어나는 현상 수정**:
  - 눌림의 `scale: 1.2 1`은 유지한다. 이동을 독립 `translate`로 분리하고 선택 시 오른쪽, 해제 시 왼쪽 끝을 확대 기준으로 사용해 트랙 안쪽으로만 늘어나도록 한다.
  - XL thumb를 트랙의 세로 중앙에 정렬해 위아래 간격을 3px로 맞춘다. 기존 block 배치는 위 2px·아래 4px로 1px 위로 치우쳤다.
  - XL 선택 상태의 오른쪽 여백과 해제 상태의 왼쪽 여백도 3px로 맞춘다. XL 이동량을 thumb 너비 24px 대신 트랙 너비·높이 차이 22px로 계산하고 눌림 확대 중에도 끝 여백을 유지한다.
  - 위치: `packages/shared/src/components/styles/Switch.css`

## [DisclosureGroup 기본 너비 — catalog width 100%] - 2026-10-19

### Changed

- **DisclosureGroup 기본 너비를 `100%`로 설정**:
  - catalog 컨테이너 스타일에 너비를 명시해 Canvas와 Preview가 부모 너비를 채우도록 한다.
  - 위치: `packages/shared/src/catalog/generated/componentRulesTable.ts`

## [Disclosure 누름 효과 — scale 제거] - 2026-10-19

### Fixed

- **Disclosure 헤더를 눌러도 크기가 줄어들지 않도록 수정**:
  - **Why**: trigger의 `scale: 0.97`과 공통 Button의 pressed `transform: scale(0.95)`가 함께 적용됐다.
  - catalog의 Disclosure trigger pressed 규칙에서 `scale`과 `transform`을 해제한다.
  - 위치: `packages/shared/src/catalog/generated/componentRulesTable.ts`

## [RAC 상태에 이름 붙이기 — 옛 암묵 상태 복원 · ToggleButton · Disclosure 이벤트 전달 수리] - 2026-10-19

ADR-248 이전 앱과 비교한 7 (암묵 상태) 의 추천안이다 (사용자 2026-10-19 「이 추천대로 진행」). 직접 만드는 변수는 그대로 두고, 컴포넌트가 이미 가진 RAC 상태에 이름만 붙이면 따라가는 변수를 다시 넣는다.

### Added

- **State 섹션의 「Implicit state」**:
  - Tabs 의 `selectedKey`, ListBox · GridList · TagGroup · Tree 의 `selectedKeys`, Tree 의 `expandedKeys`, Switch · Checkbox · ToggleButton 의 `isSelected`, RadioGroup · Slider 의 `value`, Disclosure 의 `isExpanded` 가 줄로 나온다. 이름을 넣고 Enter 를 누르면 그 page 의 변수가 된다 (한 step).
  - 변수는 page 어디서나 `{{ 이름 }}` 으로 읽는다. Preview · publish 에서는 RAC 이벤트 (`onChange` · `onSelectionChange` · `onExpandedChange`) 를 관찰해 값을 따라간다. 제어 prop 은 주입하지 않는다 (D1).
  - 읽기 전용이다. setState 대상 목록에 나오지 않고 type · 기본값 칸이 없다. 기본값은 이름 붙일 때의 컴포넌트 값이고, Builder Canvas 는 이 값을 보인다.
  - 요소를 지우면 그 변수도 지워진다. page 를 복제하면 사본 요소를 관찰한다.
  - **Why**: ADR-248 전환 때 「scalar 변수 3종만」 으로 빠졌다 (breakdown 4e-4c-2d). 그 뒤로 선택 키 · Slider 값은 변수에 담을 수 없었고, 같은 일을 하려면 변수 · interaction 을 8~9단계로 만들어야 했다.
  - 위치: `packages/shared/src/catalog/document/types.ts` (`StateVariableEntry.source`) · `validation.ts` · `graph.ts` · `commands/project.ts` · `runtime/catalogPreviewInteractions.ts` · `runtime/delegatedDom.runtime.ts` (`catalogStateSourceValue`) · `apps/builder/src/builder/catalogRuntime/stateVariables.ts` · `CatalogStateSection.tsx`

### Fixed

- **ToggleButton · Disclosure 에 건 interaction 이 Preview 에서 실행된다**:
  - 두 컴포넌트의 상태 frame 감싸개가 받은 이벤트 handler 를 버려, `onChange` · `onExpandedChange` 규칙이 실행되지 않았다. 감싸개가 handler 를 안쪽 RAC 요소에 넘긴다.
  - **Why**: Preview 는 binding 이 돌려준 맨 바깥 요소에 handler 를 붙인다. ToggleButton (`SelfToggleButton` · `GroupToggleFrame`) 과 Disclosure (`CatalogStateFrame`) 는 맨 바깥이 RAC 요소가 아니었다.
  - 위치: `packages/shared/src/catalog/runtime/stateFrames.runtime.ts` (`catalogForwardHandlers`) · `stateFrames.components.tsx` · `delegatedDom.components.tsx`

## [ADR-248 이전 동작 비교 후속 — Move to slot · 부모 변경 시 Route 갱신] - 2026-10-19

ADR-248 이전 앱과 지금 방식을 비교한 6 (slot 배정) · 8 (page route) 의 추천안이다 (사용자 2026-10-19 「이 추천대로 진행」). slot 배정은 지금의 끌어 넣기를 유지하고 메뉴만 더한다. route 는 저장값을 유지하고, 계층과 어긋나면 갱신을 제안한다.

### Added

- **Canvas 메뉴 「Move to slot ▸」**:
  - layout 을 쓰는 page 의 요소를 우클릭하면, 지금 들어 있는 slot 을 뺀 나머지 slot 이 나온다. 고르면 그 slot 끝으로 옮긴다 (한 step).
  - **Why**: 옛 앱의 요소별 「Target Slot」 셀렉트는 `slot_name` 사본을 따로 저장해 실제 위치와 어긋날 수 있었다. 지금은 위치가 문서 구조라 셀렉트 대신 이동 명령 하나로 같은 일을 한다.
  - 위치: `apps/builder/src/builder/catalogRuntime/pageSettings.ts` (`catalogMoveToSlotItems`) · `canvasMenu.ts`
- **부모를 바꾸면 Route 갱신을 제안한다**:
  - Page 섹션: route 가 부모에서 계산한 경로와 다르면 「Resolved URL」 과 「Update route (incl. children)」 버튼이 나온다. 누르면 그 page 와, 그 route 아래에 있던 하위 page 의 route 가 한 step 에 함께 바뀐다. 다른 page 가 쓰는 route 가 되면 거부하고 이유를 보인다.
  - Pages 트리에서 끌어 부모를 바꾸면 같은 제안이 toast 버튼으로 뜬다.
  - route 는 스스로 바뀌지 않는다. 배포 URL 이 안정적이어야 하고, navigate 링크는 page id 로 이어져 끊기지 않는다.
  - **Why**: 지금은 부모를 바꿔도 route 가 그대로라 계층과 URL 이 조용히 어긋났다. 옛 앱은 URL 을 부모에서 자동 계산했지만, 부모 변경이 URL 을 몰래 바꿔 손으로 쓴 링크를 깨뜨렸다.
  - 위치: `pageSettings.ts` (`catalogResolvedRoute` · `catalogRouteFollowEdit`) · `CatalogPageSection.tsx` · `CatalogPagesSection.tsx`

## [Disclosure 기본 너비 — catalog width 100%] - 2026-10-19

### Changed

- **Disclosure 기본 너비를 `100%`로 설정**:
  - catalog 루트 스타일에 너비를 명시해 Canvas와 Preview가 부모 너비를 채우도록 한다.
  - 위치: `packages/shared/src/catalog/generated/componentRulesTable.ts`

## [ADR-248 이전 동작 복원 — 붙여넣기 · 그룹 · 글자 편집 · Layout 열기 · ID 검사 · History 라벨] - 2026-10-19

ADR-248 이전 앱 (`a32159bc4`) 과 비교해 찾은 기록 없는 회귀 중 사용자가 「이전 동작으로」 고른 6건이다 (2026-10-18). 범위 선택 (marquee) 은 지금 동작을 유지한다.

### Fixed

- **⌘V 가 선택한 요소 안으로 들어간다**:
  - Frame 을 고르고 붙여넣으면 그 안 끝에 들어간다. 받을 수 없는 요소 (Text 등) 를 고르면 그 부모의 선택 바로 뒤에 들어가고, 옮겨졌다는 안내와 되돌리기가 뜬다.
  - **Why**: Canvas 메뉴로 옮길 때 붙여넣기가 「선택의 부모 안, 선택 뒤」 한 가지만 남아 옛 `resolvePasteTargetParentId` (선택 요소 안 → 못 들어가면 가까운 조상) 를 잃었다.
  - 위치: `apps/builder/src/builder/catalogRuntime/canvasMenu.ts` · `shortcuts.ts`
- **⌘G 로 부모가 다른 요소도 묶는다**:
  - 첫 선택 요소의 부모 · 자리에 frame 이 생기고 나머지가 선택 순서대로 옮겨 들어간다. 다른 page 의 요소도 같다.
  - **Why**: `groupNodes` 가 같은 부모만 받아 `GROUP_PARENTS_DIFFER` 로 거부했다. 옛 앱의 Pencil 방식 결정 (`elementGrouping.ts`) 이 빠졌다.
  - 위치: `packages/shared/src/catalog/commands/structure.ts`
- **글자 편집 중 Canvas 가 따라 바뀐다**:
  - 입력하는 동안 내용에 맞춰지는 글자 상자가 커지고 형제가 밀린다. 문서 쓰기와 히스토리는 확정할 때 한 번이고, 바뀐 것 없이 끝내면 원래 글자로 돌아간다.
  - **Why**: 새 편집기가 편집창 높이만 늘리고 레이아웃은 확정 뒤에만 바꿨다. 옛 `silentUpdateTextProp` 의 실시간 반영이 빠졌다. 지금은 Styles 드래그와 같은 `previewRecord` 를 쓰고, 미리보기에 글자 (`props`) 축을 더했다.
  - 위치: `apps/builder/src/builder/workspace/canvas/catalog/CatalogTextEditor.tsx` · `packages/shared/src/catalog/runtime/compositionRoot.ts`
- **Layouts 탭에서 layout 을 열거나 추가하면 그 body 가 선택된다**:
  - Layers 의 Body 행과 Design 패널의 Layout Preset · Slots 가 바로 열린다.
  - **Why**: 정의 편집 화면에 들어가면 선택이 비워지는데, 옛 `LayoutsTab.selectLayoutBody` 가 하던 body 선택이 옮겨지지 않았다. page 쪽 같은 결함은 바로 아래 엔트리에서 고쳤다.
  - 위치: `apps/builder/src/builder/panels/navigator/catalog/CatalogDefinitionsSection.tsx`
- **ID 칸의 형식 검사**:
  - 영문자로 시작하고 영문자 · 숫자 · `-` · `_` 만 받는다. 틀리거나 다른 요소가 쓰는 ID 는 칸 아래에 이유를 보여 주고 저장된 값을 되돌린다 (중복도 toast 가 아니라 칸 아래).
  - **Why**: catalog 이관 뒤에는 중복만 막아 `1abc` · `a.b` 같은 ID 가 저장됐다. 옛 `isValidHtmlId` 가 빠졌다.
  - 함께 고친 것: `PropertyInput` 이 칸 아래 문구 (`afterControl`) 를 입력 상자 안에 넣고 있었다. 이제 `PropertyFieldset` 의 칸 아래 자리에 둔다 (숫자 형식 칸의 오류 문구도 같은 자리로).
  - 위치: `apps/builder/src/builder/panels/properties/catalog/CatalogAttributesSection.tsx` · `catalogRuntime/attributes.ts` · `components/property/PropertyInput.components.tsx`
- **History 라벨 16종 번역**:
  - Swap instance · Push changes · Reset override · Restore origin · 속성 만들기/적용/해제/이름 · Show when · Edit data 등이 영어 원문과 기본 아이콘으로 보이던 것을 고쳤다.
  - 게이트: 모든 명령의 기본 라벨 (`label ?? "…"`) 이 표에 있는지 테스트가 확인한다.
  - 위치: `apps/builder/src/builder/panels/history/catalogHistoryLabels.ts`

## [Pages 에서 page 를 고르면 body 가 선택된다 — Navigator 선택 회귀 수리] - 2026-10-18

### Fixed

- **Navigator Pages 탭에서 page 를 골라도 Layers · Canvas 에 선택이 없던 문제** (사용자 보고):
  - page 를 열면 선택이 비어 Layers 의 Body 행도, Canvas 의 page 프레임 선택 표시도 없었다.
  - **Why**: ADR-248 Phase 4e-4a 로 Pages 를 catalog workspace 로 옮길 때 `openPage` 가 page 열기 (`session.setPage` — 선택을 비운다) 와 화면 이동만 남기고, 옛 `PagesSection` 의 body 선택 (`activatePage(page, body)`) 을 빠뜨렸다.
  - 수정: page 선택 · 추가 · 삭제 뒤 인접 page 열기 · 같은 page 다시 누르기 모두 그 page 의 body 를 선택한다 — Canvas 페이지 헤더 누르기와 같은 선택.
  - 위치: `apps/builder/src/builder/panels/navigator/catalog/CatalogPagesSection.tsx`

## [Page Layout — Horizontal 폭 0 수리 · 페이지 헤더는 활성 페이지만] - 2026-10-18

### Changed

- **페이지 헤더는 활성 페이지 하나에만 보인다** (사용자 지시 「헤더는 선택된 page에서만 헤더를 나타나도록」): 헤더는 화면 높이 36px 고정이라 gap 이 작거나 줌아웃하면 위 페이지에 걸쳤다. 다른 페이지는 Pages 패널 · 페이지 body 클릭으로 고르면 그 페이지의 헤더가 나온다. Components 원본 · 정의 편집 화면의 헤더 (페이지가 아닌 frame) 는 그대로다.

### Fixed

- **Page Layout Horizontal 전환 시 페이지가 세로 선으로 접혀 보이던 문제** (사용자 보고 「Horizontal, vertical 전환시에 정상적으로 나오지않는다」): 페이지 body 의 저작 폭 `100%` 를 Horizontal 격자의 `auto` 열 트랙 기준으로 풀어 폭이 0 이 됐다 (Auto · Vertical 은 고정 폭 트랙이라 정상). 페이지 root 의 `%` 폭은 이제 breakpoint viewport 폭 (Preview iframe 과 같은 기준) 으로 푼다 — Desktop 1920 · Tablet 768 · Mobile 390, `50%` 는 그 절반.

## [확대 · 축소가 페이지 배치를 바꾸지 않는다 — ADR-274 Implemented] - 2026-10-18

### Changed

- **페이지 grid 열 수 Auto = 모니터 폭 · 기준 배율** (ADR-274, 사용자 요청 「확대를 했는데 auto로 인해 배치가 달라져 버린다」): Auto 열 수는 이제 기준 배율 (기본 40 %) 로 줌아웃했을 때 모니터 한 폭에 들어가는 페이지 수다. 현재 줌 · 창 크기 · 패널 열림은 입력이 아니므로, 확대 · 축소 · 휠 줌을 해도 페이지가 제자리에 있다. gap 은 장면 좌표 그대로다. 2560 모니터 · gap 80 · 40 % 이면 Desktop 3 · Tablet 7 · Mobile 13 열이다.
- **Settings 열 수 칸**: 단위 `%` = Auto (값 = 기준 배율, 10 ~ 100 %, 모든 breakpoint 공통), 단위 없음 = Fixed 개수 (1 ~ 24, breakpoint 별 「This breakpoint only」 그대로). `auto` 를 치면 Auto 가 된다. 단위 메뉴로 Auto → Fixed 를 고르면 지금 그려진 열 수로 고정된다.
- 기존 auto 문서는 처음 열 때 배치가 바뀔 수 있다 (모니터 기준으로 다시 정해짐). 이관 코드는 없다 — 배율이 없으면 40 % 다.

### Performance

- 줌 중 페이지 옮기기 · 전체 재기록이 없어졌다. production 짝 (교대 2 쌍): 페이지 100 개 문서 줌 main thread 2,497 → 870 ms · 표시 간격 p99 49.9 → 17.6 ms · long task 4 → 0, 22 페이지 문서 줌 1,009 → 541 ms. breakpoint 전환 · gap 편집 · 페이지 전환 · 편집은 회귀 0.
- breakpoint 전환 · gap · 배율 편집은 한 번의 레이아웃으로 끝난다 (다음 프레임의 열 수 보정 패스 제거).
- 성능 ratchet: 줌 run 의 A 키 49 개를 사용자 승인으로 올렸다 (갱신 사유가 전체 무효화에서 coverage · zoom 갱신으로 옮겨 감 · headless 1440 의 시작 배치 변경). 내려간 261 개는 같이 기록했다.

### Fixed

- 단위 목록에 빈 단위 (`""`) 가 있는 입력에서 단위 없는 값이 첫 단위 (`%`) 로 보이고, 다음 입력이 그 단위로 저장되던 문제 (ADR-274 live 에서 발견 — 현재 그런 칸은 Settings 열 수 하나).

## [ADR-270 ~ 273 보완 — 번들 상한 재승인 · GPU 캐시 재확인 · 측정 정리] - 2026-10-18

### Changed

- **initial 번들 상한 재승인** (ADR-201, 사용자 결정 「실측에 맞춰 낮추고 연장」): Builder ≤ 1,390,000 · Preview ≤ 320,000 B (JS gzip), 만료 2026-11-25. 실측 1,369,697 / 300,677. 판정기 self-test 가 상한 상수에서 값을 끌어오고, 낮춘 상한을 넘으면 막는 경우 2 개를 더했다.
- **GPU 캐시 한도 재확인** (ADR-273 후속, 사용자-가시 변경 없음): DPR 2 · 2560 × 1440 · 이미지 44 장에서 사용 고수위 306.9 MiB (한도 384 MiB 의 80 %) · 90 % 근처 프레임 0 — 한도를 그대로 둔다. 이미지 fixture 5 부류에 한도 근처 프레임 수 · GPU context 생성 · 삭제 수를 ratchet A 키 (0) 로 등록했다.
- **성능 ratchet 정리**: 같은 코드에서 값이 흔들리던 A 키 3 개 (이미지 줌의 `contentSurface.hits` · 줌 부류의 `domMutations.attributes` 2) 를 B 로 옮기고 `regrades` 에 기록했다. `--keys` 에 「접두.*」 가 아닌 패턴을 주면 거부한다 (전에는 글자 그대로 0 키로 들어갔다). ADR-271 의 개발 빌드 전용 투영 크기 분포 카운터와 그 ratchet 키 94 개를 지웠다 (`retired`).
- 문서: ADR-270 · 271 · 272 · 273 본문 · breakdown 을 지금 코드와 맞췄다.

## [작업 범위 제한 종결 — ADR-272 Implemented] - 2026-10-18

### Performance

- **ADR-272 작업 범위 제한 종결** (G0 · G2 ~ G5) — 아래 Phase 0 · 2 를 묶는다. 사용자-가시 변경 없음 (화면 결과 같음).
  - production 짝 (기준 `aaa2625e0` ↔ `90291a18a`, 교대 2 쌍 · 12 run): 페이지 100 개 문서의 줌 · 팬 · 먼 페이지 이동 · 편집, 22 페이지 문서의 줌 · 편집 · 팬 · 페이지 전환, 중첩 5k 편집에서 표시 간격 p99 · long task 회귀 0.
  - live (사용자 프로젝트 22 페이지): 전체 보기 · 먼 페이지 이동 · 팬 · 선택 · 범위 선택 · 드래그 뒤 되돌리기에서 빈 자리 · 늦게 그려지는 요소 0.
  - 페이지 100 개 문서의 줌 표시 간격 p99 는 ~49 ms 로 그대로다 — 줌 비용의 본체는 페이지 배치를 다시 계산해 자손을 옮기는 JS 쪽이라 이 작업의 범위 밖이다 (사용자 결정 「Implemented 로 종결」).
  - 본문: `docs/adr/completed/272-bounded-spatial-query-and-warmup-work-range.md`

## [페이지가 많은 문서에서 편집 뒤 쉬는 시간 작업 축소 — ADR-272 Phase 0 · 2] - 2026-10-18

### Performance

- **ADR-272 작업 범위 제한 — Phase 0 측정 · Phase 2 미리 기록 후보 제한** (사용자-가시 변경 없음 — 화면 결과 같음).
  - Phase 0: 페이지 100 · 300 개 문서 (`many-pages` fixture) 에서 공간 질의 · 미리 기록 준비 · 인덱스 갱신의 몫을 쟀다. 질의는 화면 넓이로 정해져 프레임 비용의 0.3 % 이하라 바꾸지 않았다. 큰 항목 버킷은 대상 (64 셀 넘는 항목) 이 0 개라 생략했다 (사용자 결정).
  - Phase 2: 편집할 때마다 쉬는 시간에 문서 전체 요소를 훑고 정렬하던 미리 기록 준비를, 캐시에 자리가 없으면 건너뛰고 자리가 있으면 화면 주변 후보 중 가까운 것만 정렬한다. 먼 페이지로 옮기면 그 주변부터 다시 기록한다. 페이지 100 개 문서의 편집 뒤 준비 9.1 → 0.1 ms (300 개는 28 ms 가 같이 빠짐), 22 페이지 문서의 정렬 3,961 → 15 개.
  - 처음 줌아웃 때 프레임 안 기록 0 은 그대로다 — 줌아웃은 페이지 배치를 바꾸므로 화면 주변으로 자리를 못 채우면 문서 전체로 보충한다.
  - 하니스: `--fixture-kind many-pages --pages N --grid-gap G` · 부류 `page-jump` · Rust 공간 인덱스 작업량 카운터 (`render.spatial*`) · 미리 기록 준비 카운트 (`counts.warmAfter`) · ratchet run `60:many-pages100@zoom0.1`. ratchet `--update` 가 `@zoom0.1` 처럼 `.` 이 든 run 에서 깨지던 결함을 고쳤다.
  - 본문: `docs/adr/completed/272-bounded-spatial-query-and-warmup-work-range.md`

## [축소 화면 글자 단순화는 넣지 않음 — ADR-271 측정 기록 종결] - 2026-10-18

### Performance

- **ADR-271 축소 개요 LOD — 측정 기록으로 종결** (사용자 결정, 사용자-가시 변경 없음). 크게 축소한 화면 (줌 0.1 근처) 에서 작은 요소를 건너뛰고 작은 글자를 줄 상자로 그리면 빨라지는지 쟀다.
  - 건너뛸 요소: 0.5 px 이하로 그려지는 요소가 합성 문서 0.1 % · 사용자 프로젝트 (22 페이지) 0 개 → 넣지 않음 (사용자 결정).
  - 글자 줄 상자: 구현하고 같은 run 을 켬 · 끔으로 번갈아 쟀다. 래스터 시간은 같고, 배율 띠 경계를 지날 때마다 글자 요소를 다시 기록해 줌 main thread 시간이 +12 ~ 16 % 늘었다. 이득이 없어 코드를 되돌렸다.
  - 남긴 것: 개발 빌드 전용 투영 크기 분포 카운터 · 하니스 부류 `zoom-ladder` · ratchet 줌 run 2 개 (`60:app-pages@zoom0.1` · `@zoom0.25`). 축소 화면의 남은 비용은 요소별 그림 재생 수다.
  - 본문: `docs/adr/completed/271-zoomed-out-lod-skip-small-elements-text-line-boxes.md`

## [고해상도 화면에서 Canvas 화면 버퍼 메모리 축소 — ADR-273 Implemented] - 2026-10-18

### Performance

- **ADR-273 Canvas 메모리 예산 종결** (G0 ~ G5) — 아래 Phase 0 · 1 · 3 과 앞선 Phase 2 (GrContext 소유 · 한도 384 MiB) 를 묶는다.
  - production 짝 (기준 `2a78ca7ad` ↔ `83ed0be8f`, 교대 2 쌍 · 28 run): DPR 1 · 2 의 팬 · 빠른 팬 · 2560 × 1440 · 줌 · 편집 · 중첩 5k 편집에서 표시 간격 p99 · long task 회귀 0. headed DPR 2 팬 (실제 GPU 120Hz · CPU 4×) p99 9.3 ms 양쪽 같음. 대가는 빠른 팬의 main thread 시간 +3 ~ 10 %.
  - 사용자 확인 (DPR 2 · 자기 프로젝트): 빠른 팬 · 줌 · 이미지 페이지에서 끊김 · 가장자리 빈 영역 증가 없음.
  - 본문: `docs/adr/completed/273-canvas-memory-budget-overscan-device-px-resource-cache.md`

## [고해상도 화면에서 Canvas 화면 버퍼 메모리 축소 — ADR-273 Phase 0 · 1 · 3 상세] - 2026-10-18

### Performance

- **Canvas content 여백을 device px 로 자름** (ADR-273 Phase 1, Canvas) — 팬을 그림 복사만으로 처리하려고 화면 밖에 그려 두는 여백이 `512 CSS px × DPR` 이라 DPR 2 화면에서는 가로 · 세로 각 1,024 device px 였다. 이를 `min(512 × DPR, 768)` 로 바꿨다 (사용자 결정). DPR 1 화면은 그대로다.
  - 화면 버퍼 두 장 + 화면의 합 (규격 산식, DPR 2): 1440 × 900 창 164.5 → 132.2 MiB · 2560 × 1440 창 325.8 → 280.5 MiB.
  - 대가: 팬이 여백 밖으로 나갈 때의 다시 그리기가 늘어난다 (headless `app-pages` 960 CSS px 왕복 팬 4 → 9 회). 그 프레임 안에서 다시 그려 화면이 비지는 않고, 1 회 기록 p95 0.7 ~ 2 ms · 표시 간격 p99 · long task 는 그대로였다.
  - 화면 결과: 옛 여백과 0 px (DPR 1 전부 · DPR 2 줌 1 · 2 · 팬 합성). DPR 2 줌 0.3 한 장면에서 글자 한 줄이 1 device px 아래로 그려진다 — 비정수 배율에서 그리기 원점이 바뀐 반올림 차이로, 지금도 팬 위치에 따라 생기는 것과 같은 종류다.
  - Phase 0 측정 도구 (dev): 카운터 `contentRedrawsOutOfPad` · `panFrames` · `panDevice*` · `surfaceBytesMax` · `__composition_RENDER_PATH_DEBUG__.setContentPadDeviceMax(n)` (`Infinity` = 옛 여백) · 하니스 `perf-baseline.mjs --dpr · --viewport WxH · --pan-speed fast · --content-pad-max`. ratchet 새 run `60:app-pages@dpr2` (팬 · 줌 — 옛 여백이면 차단).
- **Canvas 메모리 예산 표 한 곳** (ADR-273 Phase 3, 동작 변경 0) — 여백 · GPU 캐시 한도 · picture 바이트 (64 MiB) · 미리 기록 (4,096) · 이미지 개수 (100) · 바이트 (128 MiB) 상한을 `canvasMemoryBudget.ts` 로 모았다 (값 그대로). dev 에서 `__composition_MEMORY_BUDGET__.holdings()` 가 자원별 지금 보유량을 상한과 나란히 보여 주고, 하니스는 부류마다 `memory` 로 기록한다.
  - 위치: `apps/builder/src/builder/workspace/canvas/skia/{canvasMemoryBudget,canvasMemoryHoldings,nodePictureCache,imageCache,SkiaRenderer,renderCounters}.ts` · 시험 `skia/__tests__/{adr273ContentPad,adr273MemoryBudget}.test.ts` · 하니스 `apps/builder/scripts/{perf-baseline,perf-ratchet-gate,adr273-memory-live}.mjs` · `apps/builder/perf/ratchet.json`

## [이미지가 많은 페이지의 로드 중 끊김 · 편집 유실 제거 — ADR-270 Implemented] - 2026-10-18

### Changed

- **Canvas 이미지 로드 경로** (ADR-270, Canvas — Phase 0 ~ 3a 의 마무리) — 이미지가 도착하면 그 이미지를 쓰는 요소만 다시 그린다 (전에는 장면 전체를 다시 묶어 picture 수천 개를 버렸다). 이미지 도착과 같은 순간의 편집도 사라지지 않는다. 디코딩은 메인 스레드 밖 (Phase 3a). 사용자 프로젝트에서 확인한 것: 10 페이지 · 이미지 66 개가 하나씩 도착해도 다른 요소의 위치 · 선택이 그대로, 편집 중 · 페이지 전환 중 도착, GPU context 가 끊겼다 돌아와도 이미지를 다시 받지 않음, 업로드 이미지 (`asset:`), 되돌리기.
  - 위치: ADR 본문 `docs/adr/completed/270-image-load-path-partial-update-off-thread-decode.md` (`### Live Exercise`) · 하니스 핸들 `__composition_IMAGE_DEBUG__` 는 production 측정 빌드 (`VITE_COMPOSITION_HARNESS=1`) 에도 열린다 (일반 빌드 제외).

## [Canvas 이미지를 브라우저 코덱으로 디코딩 (메인 스레드 밖) — ADR-270 Phase 3a] - 2026-10-18

### Changed

- **Canvas 이미지 디코딩 위치** (ADR-270 Phase 3a, Canvas) — 이미지를 CanvasKit 의 WASM 코덱 (`MakeImageFromEncoded` — 첫 그리기 프레임 안에서 메인 스레드가 디코딩) 대신 브라우저 코덱 `createImageBitmap` (메인 밖 — Preview 의 `<img>` 와 같은 조건) 으로 디코딩하고, GPU 화면에서는 texture-backed 이미지 (`MakeLazyImageFromTextureSource`) 로 그린다. WebGL 이 없는 환경 (SW surface) 은 readback 경로. 화면 결과는 같다 (옛 디코더와 0 px — 반투명 · 2,048² 포함, unpremul 로 고정).
  - GPU context 소실 → 복원 뒤에도 이미지를 다시 받지 않고 그대로 다시 그린다 (texture 를 그리는 context 에 다시 올린다 — 실측 요청 0 · 0 px).
  - 실측: 이미지 22 장 `MakeImageFromEncoded` 22 → 0 · trace 의 `Decode Image` 22 건 전부 worker 스레드 (메인 0). Worker 단계 (3b) 는 생략 (사용자 결정).
  - production 빌드 (G4 — ADR-270 이전 빌드와 교대 2 쌍, headless 60Hz): 이미지 로드 중 화면 표시 간격 p99 33.4 → 16.8 ms (줌 중 100 → 16.8) · 25 ms 를 넘는 프레임 22 → 0 · 줌 중 long task 8 ~ 9 → 0. 이미지 없는 줌 · 편집은 회귀 0. Builder initial 번들 +2,126 B (gzip).
  - dev: `__composition_RENDER_PATH_DEBUG__.setImageDecoderLegacy(true)` (옛 디코더 — 픽셀 대조용) · 카운터 `imageTextureImages` · `imageSwFallbacks` · `imageReadbackBytes`. ratchet: 이미지 run 에 새 A 키 3 · `load-zoom` A 17 키 올리기 (사용자 승인 — 완료가 오는 프레임이 줌 입력에 대해 밀림, 만료 2027-04-18).
  - 위치: `apps/builder/src/builder/workspace/canvas/skia/{imageCache,SkiaRenderer,createSurface,renderCounters}.ts` · 시험 `skia/__tests__/adr270BrowserDecoder.test.ts` · `adr273RendererContext.test.ts` · 하니스 `apps/builder/scripts/adr270-image-decoder-live.mjs` · `apps/builder/perf/ratchet.json`

## [Canvas GL context 를 한 번 만들어 계속 쓴다 · GPU 캐시 한도 384 MiB — ADR-273 Phase 2] - 2026-10-18

### Changed

- **화면 GL context 소유** (ADR-273 Phase 2, Canvas) — 창 크기를 바꿀 때마다 (그리고 GPU context 복원 때) CanvasKit 이 새 GL context · GrDirectContext 를 만들고 옛 것을 지우지 않던 것을, 처음 만든 context 를 계속 쓰고 소실 · 복원 때만 옛 것을 지운 뒤 새로 만들도록 바꿨다. 텍스처 · 글자 atlas 가 창 크기 변경 뒤에도 남는다.
  - GPU resource cache 한도를 코드에 명시: 384 MiB (사용자 결정 — 실측 Skia 기본 256 MiB 에서 고해상도 화면 (DPR 2) 사용 고수위 251 MiB 가 한도의 90 % 를 넘었다).
  - live (DPR 1 · 2): 옛 경로 ↔ 새 경로 같은 장면 0 px (반투명 이미지 · 글자) · 창 크기 6 회 뒤 GL context 1 · `WEBGL_lose_context` 소실 → 복원 뒤 GPU 로 다시 그림. dev: `__composition_RENDER_PATH_DEBUG__.gpuContext()` · `setLegacySurface(true)` (옛 경로).
  - 위치: `apps/builder/src/builder/workspace/canvas/skia/{createSurface,canvasMemoryBudget,SkiaRenderer,renderCounters}.ts` · `workspace/canvas/catalog/CatalogCanvas.tsx` (소실 · 복원 콜백) · 시험 `skia/__tests__/adr273{SurfaceOwner,RendererContext}.test.ts` · 하니스 `apps/builder/scripts/adr273-gpu-context-live.mjs`.

## [이미지 원본 치수와 그릴 bitmap 분리 — ADR-270 Phase 2] - 2026-10-18

### Changed

- **Canvas 이미지 배치의 기준** (ADR-270 Phase 2, 동작 변경 0) — 이미지 node data 가 원본 치수 (`naturalWidth/Height` — object-fit content rect) 와 그릴 bitmap (source rect) 을 따로 든다 (`skImage` → `bitmap` · `src` 로드 전후 보존). Image fill · background-image 행렬도 원본 치수로 계산한 뒤 bitmap 좌표로 옮긴다. 지금은 두 치수가 같아 화면 변화 없음 — 뒤에 축소 디코딩이 들어와도 배치가 흔들리지 않을 자리.
  - 위치: `apps/builder/src/builder/workspace/canvas/skia/{nodeRendererTypes,specShapeConverter,nodeRendererImage,imageCache,renderCommands}.ts` · `panels/styles/utils/fillToSkia.ts` · 시험 `skia/__tests__/adr270NaturalSize.test.ts`

## [이미지가 로드돼도 Canvas 전체를 다시 묶지 않는다 — ADR-270 Phase 1] - 2026-10-18

### Changed

- **이미지 로드 완료 처리** (ADR-270 Phase 1, Canvas) — 이미지 (Fill 의 Image 층 · background-image · Avatar) 한 장이 로드되면 scene 전체를 다시 묶던 것을, 그 이미지를 조회한 요소만 다음 프레임의 증분 갱신 (splice) 으로 다시 그리게 바꿨다. 같은 프레임의 다른 편집은 같은 갱신에서 처리된다 (전에는 재바인드가 그 편집의 patch 를 흡수했다).
  - 실측 (`app-pages-images` 22 페이지 · Image 상자 67 · 22 장): image-loaded 재바인드 22 → 0 · 버린 picture 5,284 → 0 · paragraph 3,924 → 0 (줌 중 25,196 · 18,147 → 0) · full 기록 22 → 2.
  - live: 다시 묶은 oracle 과 0 px · 완료 통지 task 안의 편집 22 회가 남음 · dev 플래그 `__composition_RENDER_PATH_DEBUG__.setImagePartialOff(true)` 가 옛 경로.
  - 위치: `apps/builder/src/builder/workspace/canvas/skia/imageCache.ts` (`readImagesOf` · 콜백 URL) · `catalogRuntime/{canvasBinding,canvasScene}.ts` (`imageOwners` · `seedImageOwners`) · `workspace/canvas/catalog/CatalogCanvas.tsx` · 시험 `catalogRuntime/__tests__/adr270ImageLoadSplice.test.ts` · live `apps/builder/scripts/adr270-image-load-live.mjs`

## [이미지 로드 경로 측정 기준선 — ADR-270 Phase 0] - 2026-10-18

### Added

- **이미지 fixture 와 부류** (ADR-270 Phase 0, 성능 하니스) — `app-pages` 22 페이지의 Image 상자 67 개에 image fill 22 종 (`--fixture-kind app-pages-images` 정적 URL · `app-pages-images-asset` 업로드 `asset:` ref). 완료 순서는 하니스가 정한다 (`page.route` 붙들기 · 한 장씩 풀기). 부류 `load-edit` · `load-same-frame` · `load-zoom`. dev 카운터 6 (`rebindImageLoaded` · 그 사유의 picture · paragraph 해제 · `imageEncodedDecodeCalls` · `imageCompletions` · `imageLoadedPerFrameMax`) — ratchet run `60:app-pages-images` · `60:app-pages-images-asset`.
  - 실측: 이미지 1 장 완료 = scene 재바인드 1 회 — 매번 picture ~240 · paragraph ~178 를 버린다 (줌 중 ~1,145 · ~825). 같은 프레임의 다른 노드 편집 22 회는 patch 0 (재바인드에 흡수).
  - 동작 변경 0 (dev 카운터 · harness 핸들만).
  - 위치: `apps/builder/scripts/{perfImageFixture,perf-baseline}.mjs` · `apps/builder/src/builder/workspace/canvas/skia/{renderCounters,imageCache,useSkiaNode}.ts` · `catalogRuntime/canvasScene.ts` · `canvas/catalog/CatalogCanvas.tsx` · `apps/builder/perf/ratchet.json`

## [Compare Mode Preview 가 Canvas 의 page 자리 · 크기 · zoom 을 따른다] - 2026-10-17

### Changed

- **Compare Mode 의 CSS 쪽 Preview (`#previewFrame`)** — 폭 · 높이가 100% (뒤에 breakpoint 고정값) 였던 것을 Canvas 가 열린 page 를 그리는 page frame 크기 (`root.pageFrameRects` — 내용으로 늘어난 높이 포함) 로 맞추고, Canvas 카메라 (`화면 = page 좌표 × zoom + 카메라 이동`) 를 `translate(…) scale(zoom)` 으로 따라 pane 안의 같은 자리에 놓는다. pan · zoom · page 전환 · breakpoint 전환 · 편집 · 데이터 행 · 드래그 미리보기를 따라가며, pan 은 매 프레임이라 React 재렌더 없이 style 을 직접 쓴다. page frame 이 없는 정의 편집 화면은 breakpoint viewport 를 쓴다.
  - live (Chrome MCP): zoom 35% 에서 Preview 상자 pane 기준 x 254.72 · 너비 672 (=1920×0.35) = Canvas Page 3 와 일치, Tablet 40% 에서 iframe 내부 768×1024.
  - 위치: `apps/builder/src/builder/workspace/canvas/catalog/CatalogPreviewFrame.tsx` · `apps/builder/src/builder/workspace/Workspace.css`

## [viewport 변경 뒤 flex 내용 최소 폭 캐시 갱신 — ADR-268 Phase 1 후속 수리] - 2026-10-17

### Fixed

- **같은 엔진의 viewport를 바꾼 뒤 고정 폭 flex item이 이전 내용 최소 폭에 남는 문제** (ADR-268 Phase 1 후속, 리뷰 LOW):
  - **Why:** `50vw`·`50vh` 자손은 문서 mutation 없이 크기가 바뀌지만 content intrinsic 캐시는 서브트리 세대만 확인했다.
  - 수정: 캐시 키에 viewport 변경 세대를 반영하고 기존 intrinsic 캐시도 함께 무효화한다. 같은 viewport 재설정과 형제 편집의 HIT, ADR-188 `2N` 기준은 유지한다.
  - 위치: `packages/engine/src/tree.rs`

## [요소 스크롤이 소유자 서브트리를 다시 기록하지 않는다 — ADR-269 Implemented] - 2026-10-17

### Performance

- **overflow scroll · auto 상자의 휠 스크롤** (ADR-269 Phase 1) — 스크롤 위치를 그리기 명령 · node data 에 굽지 않고 property node 테이블 (`skia/propertyNodes.ts`) 에 둔다. 스크롤은 테이블 한 칸 + 자손 맵 Δ (옮기기와 같은 기계) 로 끝나고, 소유자 서브트리를 다시 기록하지 않는다. 하니스 `600:scroll-boxes` 휠 188 회: 다시 기록한 명령 **575,844 → 0** · patch 검증 스캔 1,151,688 → 0 · 소유자 picture 무효화 94 → 0. 남는 비용은 자손 수에 비례하는 맵 Δ (`scrollDeltaNodes` 143,820) 다 — 체감 속도 (p99 · drop) 는 종결 때 production 짝으로 잰다.
  - production 짝 (HEAD 빌드 ↔ 수정 빌드, 교대 2 쌍): 요소 스크롤 5k main thread **3,385 · 3,360 → 1,942 · 1,976 ms**, 화면 표시 간격 p99 16.8 · long task 0 (회귀 없음). 실사용 22 페이지 문서의 page body 휠 1 회 재기록 574 → 0. 중첩 5k 편집은 main thread +3 % (387 → 399 ms, 원인 미확정 — 표시 지표는 같음).
  - sticky 머리를 담은 자식 (ListBox 섹션) 은 스크롤 위치에 따라 놓이므로 그 자식만 다시 기록한다.
  - 같은 프레임의 문서 편집과 스크롤은 한 번에 그린다 (`CatalogCanvasUpdate.propertyChanged` · damage 합집합, unsafe 칠이면 full).
  - 위치: `apps/builder/src/builder/workspace/canvas/skia/{propertyNodes,renderCommands,subtreeTranslate,subtreeCommandPatch}.ts` · `apps/builder/src/builder/catalogRuntime/{canvasBinding,canvasScene}.ts`
- **옮기기 검사가 서브트리 명령을 훑지 않는다** (ADR-269 Phase 1) — 기록 때 만든 자식 색인 (`childElementIds`) 으로 판정. `translateCheckCommands` `app-pages` 줌 917,005 → 0 · 편집 9,231 → 0 · 중첩 5k 편집 20,310 → 0 (대신 요소 수만큼 색인을 읽는다 — 223,086).

### Changed

- **`CHILDREN_END` 는 자기 `CHILDREN_BEGIN` 이 연 것만 닫는다** (ADR-269 r1 H1) — 실행기의 열린 프레임 스택 (clip · scroll) 으로 닫고, scrollbar 는 테이블의 현재 위치에서 그린다. 짝이 어긋난 실행은 production 밖에서 멈춘다. `buildBoxNodeData` 의 생산자 없던 scroll 입력과 `SkiaNodeData.scrollOffset` · `scrollbar` 는 삭제했다.
- commit lane patch 의 `scroll-context-changed` 거부를 없앴다 — 스크롤 위치가 저장 문맥에 없으므로 스크롤된 조상 아래 편집도 patch 로 들어간다.

### Added

- **성능 하니스 요소 스크롤 부류** (ADR-269 사용자 결정 2) — `--fixture-kind scroll-boxes` (overflow:auto frame > 카드 · ListBox > 항목) + `--classes scroll` (스크롤 상자를 선택하고 캔버스 위 실제 휠). ratchet run `600:scroll-boxes` 등록. 새 카운터: `scrollRecordCommands` · `scrollRecordCalls` · `rebindSpliceRejected{ClipContext,ScrollContext,Other}` · `translateMapWrites` · `propertyNodeReads` · `scrollDelta{Calls,Nodes,MapWrites,IndexUpserts,Rerecords}`. dev 스위치 `__composition_RENDER_PATH_DEBUG__.setPropertyNodesOff` (옛 길 대조).
  - 위치: `apps/builder/scripts/perf-baseline.mjs` · `apps/builder/perf/ratchet.json` · `apps/builder/scripts/adr269-property-nodes-live.mjs`

### Tests

- 무작위 트리 1,200 스크롤 동치 (명령 불변 · 맵 · SpatialIndex = 처음부터 기록) · 스크롤 + 옮김 · r1 H1 반례 4 (기록 뒤 0 ↔ 150 · 중첩 · thumb · 짝 assert) · r1 H2 반례 7 (실제 `CatalogCanvasScene.sync` — 발행 · 합산 · 편집 동시 · full 우선 · off 스위치 · sticky ListBox). 원복 RED 6/7. live 8/8 (화면 0 px · 맵 · `hitAt` = 재바인드, 스크롤 뒤 클릭 선택).

## [좁은 row 의 고정 폭 Frame 이 Canvas 에서도 글자 폭에서 멈춘다 — ADR-268 Implemented] - 2026-10-17

### Fixed

- **flex row 안 `width` 고정 Frame (자식 보유 컨테이너) 이 Canvas 에서만 내용 폭 아래로 줄어들던 것** (ADR-268 — 정본 F4) — 이제 Canvas 도 Preview (Chrome) 처럼 내용의 min-content 에서 멈추고 부모 밖으로 넘친다. row 200 안 `width: 200` Frame 둘 · 각 내용 150 → Canvas 100/100 이던 것이 150/150. 뒤에 auto 폭 형제가 오는 행 · `flex-basis: 0` (행이 안 줄어도) 도 같다. live: 글자를 「QuarterlyRevenue」 로 바꾼 뒤 Canvas 129.6 / 70.4 = Preview (전에는 Canvas 100 / 100).
  - **Why**: CSS Flexbox §4.5 의 automatic minimum = min(지정 폭, 내용 min-content). 엔진은 지정 폭이 있는 컨테이너 item 의 내용을 재지 않았다 — ADR-204 가 전부 재면 레이아웃 방문 수가 2N → 4N 이 된다고 미뤘다.
  - 이번에는 floor 없이 푼 결과가 지정 폭보다 작은 item 만 재고 (커널 결과 기반 지연 floor), 측정을 서브트리 세대로 캐시해 형제 · 다른 서브트리 편집에서는 다시 재지 않는다. ADR-188 방문 수 `2N` 과 ratchet 상한은 그대로다.
  - Button 은 엔진에서 텍스트 leaf (글자 폭 스칼라) 라 원래 정합이었다 — 바뀌지 않는다.
  - 위치: `packages/engine/src/{tree,flex}.rs`

### Added

- **엔진 결정적 카운트 ratchet** (ADR-268) — `solve_node` 진입 수 · intrinsic 측정 MISS 수를 wasm (`solveVisits()` · `intrinsicMeasureMiss()` · `resetCounters()`) → `window.__composition_ENGINE_COUNTERS__` (dev) → 프레임 하니스 `counts.engine.*` 로 싣고, ratchet 의 등록 seed 5 개 · 17 class 에 0 포함 등급 A 로 등록 (34 키). 엔진 변경이 이 두 값을 +1 만 늘려도 pre-push 가 막는다 (`recorderSha256` 변경 1).
  - 위치: `packages/engine/src/wasm.rs` · `apps/builder/src/builder/workspace/canvas/wasm-bindings/engine.ts` · `apps/builder/scripts/perf-baseline.mjs` · `apps/builder/perf/ratchet.json`

## [ListBox 섹션 헤더가 Canvas 에서도 붙는다 — ADR-267 position sticky Implemented] - 2026-10-17

### Fixed

- **단독 ListBox 를 스크롤하면 Preview 는 섹션 헤더가 위에 붙고 Canvas 는 흘러가던 것** (ADR-267 Phase 1) — 이제 Canvas 도 붙고, Compare Mode 에서 두 화면 위치가 같다 (스크롤 40 · 82 에서 헤더 y 4 · 55.5 · 146.5 / −13.5 · 13.5 · 104.5 일치). 붙은 헤더는 클릭으로 선택되고 선택 오버레이가 그려진 자리에 겹치며, 아래 항목보다 위에 그려진다 (rule 의 `z-index: 2`).
  - **Why**: catalog rule 의 `position: sticky` 가 `typedCanvasBox` · `itemLayout` 에서 떨어졌고 (ListBox 섹션 헤더 값은 nested 블록이라 part rule 에도 닿지 않음), Canvas 보정 코드는 2026-10-02 (ADR-248) 뒤 생산자가 없었다 — 있었어도 자기 스크롤 오프셋 · 부모 border-box · inset 없음을 0 으로 읽어 Blink 와 달랐다.
  - 위치: `packages/shared/src/catalog/document/{ruleDefinition,rulePartRules,validation}.ts` · `packages/shared/src/catalog/runtime/{presence,compositionRoot,persistentLayoutTree}.ts` · `apps/builder/src/builder/catalogRuntime/canvasBinding.ts` · `apps/builder/src/builder/workspace/canvas/skia/renderCommands.ts`

### Added

- **엔진 sticky constraints** (ADR-267) — `LayoutTree::sticky_constraints` (Blink `ComputeStickyPositionConstraints`: 가장 가까운 scroll container — `hidden · scroll · auto`, `clip` 제외 · 기준 영역 = 부모 padding box 또는 scrollable overflow − padding − sticky margin · 4 inset · 양쪽 inset 공간 부족 시 끝 inset 축소). wasm `getStickyConstraints` 로 sticky 노드만 조회 — geometry batch 는 그대로라 sticky 없는 문서는 엔진 호출 0. Canvas 는 owner 의 스크롤로 `resolveStickyOffset` (Blink `ComputeStickyOffset`) 한 delta 를 paint · bounds · hit · 자식 문맥에 같이 쓴다.
  - 위치: `packages/engine/src/{tree,wasm}.rs` · `apps/builder/src/builder/workspace/canvas/layout/stickyResolver.ts`

### Changed

- **검증기 분리** (ADR-267) — 코드 catalog 라이브러리 rule (`layoutValues`) 만 `position: sticky` 를 받고, 노드 저작 (`layoutWrites`) 은 그대로 `static · relative · absolute` (사용자 결정 1 「허용 안 함」 — `fixed` · `sticky` 저작 없음, `LIBRARY_CONTRACT_VERSION` 41 그대로). fixed 는 ADR-164 의도적 미지원 유지.
- **sticky 는 damage-unsafe 가 아니다** (ADR-267 사용자 결정 3 (c)) — bounds 가 그려진 자리가 되어 sparse damage 로 그린다. 서브트리 옮기기는 sticky 의 scroll container 가 같이 옮겨질 때만 한다.

### Performance

- `60:sticky-lists` (단독 ListBox 6 × 섹션 3) 편집: unsafe 로 두면 `contentFullRenders` 0 → 15 · `translateCalls` 60 → 0 이던 것을 결정 3 (c) 로 HEAD 와 같게 (full 0 · translate 60). Builder initial JS gzip +873 B (1,365,666 ≤ 1,421,000) · 엔진 wasm +6,931 B.

### Tests

- Chrome 차등 oracle `apps/builder/tests/parity/stickyPosition.browser.test.ts` (13 fixture — 스크롤 0 · 중간 · 끝 · padding-bottom · margin · inset 없음 · 양쪽 inset · bottom · `auto` > `hidden` · `auto` > `clip` · 높이 없음 · 자손 · 가로) · Rust `sticky_constraints_*` 7 · 끝-끝 전송 `adr267StickyTransport.test.ts` (실제 `buildCodeCatalogLibrary`) · 좌표 계약 `stickyCoordinates.test.ts` (전체 · 서브트리 · self 재빌드) · 검증 unit 3 · 옮기기 unit. 원복 RED 13/13.
- 성능 하니스 `--fixture-kind sticky-lists` 와 ratchet run `60:sticky-lists` (edit · select) 등록.
  - 위치: `apps/builder/scripts/{perf-baseline,perfCatalogFacade}.mjs` · `apps/builder/perf/ratchet.json`

### Documentation

- ADR-267 Implemented (`docs/adr/completed/267-sticky-fixed-position-canvas-engine.md`) · Chromium 대조 정본 X8 sticky `gate-passed` · fixed `unsupported` · `.claude/rules/layout-engine.md` 의 「fixed = absolute 근사」 를 「입력 없음 (in-flow static) · sticky = 엔진 constraints」 로 정정.

## [Canvas 스크롤바가 편집 · 선택마다 깜빡이던 것 · ratchet B 경고 귀속] - 2026-10-17

### Fixed

- **편집 · 선택할 때마다 Canvas 스크롤바가 1 초씩 나타나던 것** — 스크롤바는 페이지 사각형이 바뀔 수 있다는 알림 (문서 step · 선택 변경) 을 받을 때마다 보였다가 사라졌다. 이제 뷰포트가 움직일 때 (pan · zoom · 휠 스크롤 · thumb 조작) 만 보이고, 문서 · 선택 · 크기 변화는 thumb 위치 · 크기만 조용히 맞춘다.
  - **Why**: `catalogScrollbarContent` 가 step · session 변경마다 알리고 `CanvasScrollbar` 가 모든 알림에 `--visible` 을 붙였다 (10-01 `a21b31133` 부터). 600 요소 편집 측정에서 스타일 재계산 5 회가 전부 이 fade-in 이었다 → 0.
  - 위치: `apps/builder/src/builder/workspace/scrollbar/CanvasScrollbar.tsx`

### Tests

- `resolveContainerStylesFallback` 의 ToggleButtonGroup 기대값에 `height: fit-content` — 버튼 루트 높이 계약 (`8253cf055`) 뒤 갱신되지 않았던 것. 스크롤바 보이기 회귀 테스트 `CanvasScrollbar.test.tsx`.
- 성능 ratchet seed 60 의 등급 B 경고 6 건 상한을 올렸다 (사용자 승인 · 만료 2027-04-17) — 커밋별 측정으로 귀속: Design 패널 섹션 (`5b48f3d18` · `a083bf4ab` · `b75eb19cc` · `ef8c9e30d`) · grid 열 · 행 머리 (`b5ae316e6`) · presence helper (`c14e41a84` 외) · ADR-264 옮기기 경로 (`02f6cec67`). 모두 step · 선택당 상수 회 읽기다.
  - 위치: `apps/builder/perf/ratchet.json`
- 성능 하니스는 부류를 시작하기 전에 스크롤바 opacity 전환이 끝날 때까지 기다린다 — 앞 부류 (줌) 가 보인 스크롤바의 fade-out 이 다음 부류 창 안에서 돌아 `app-pages` 편집 스타일 재계산이 4 ↔ 14 로 갈렸다 (→ 0). 600 · nested-flex 편집의 DOM 레이아웃 수 (반복 측정 18 ~ 26 으로 흔들림) 상한도 같이 올렸고, 스크롤바 class 변경이 줄어든 14 건은 상한을 내렸다.
  - 위치: `apps/builder/scripts/perf-baseline.mjs` · `apps/builder/perf/ratchet.json`

## [Size 필드 배치 정리 — Overflow와 Ratio를 한 행으로] - 2026-10-17

### Changed

- **Design 패널 Layout 탭의 Size에서 Overflow를 Ratio 왼쪽에 배치** — Width·Height와 같은 두 열을 사용하고, Ratio 잠금 버튼은 오른쪽 액션 열을 유지한다. Min/Max 펼침 여부와 관계없이 같은 순서로 표시한다.
  - 위치: `apps/builder/src/builder/panels/styles/sections/TransformSection.tsx` · `apps/builder/src/builder/components/styles/inspector-layout.css`

## [Spacing 패널 구조 정리 — Margin/Padding fieldset과 연동 액션] - 2026-10-17

### Changed

- **Design 패널 Layout 탭의 Spacing을 Size의 Ratio 행과 같은 필드·액션 배치로 변경** — 중첩 `transform-row` 안에 `Margin/Padding` legend와 box-model을 가진 fieldset을 두고, 연동 버튼을 오른쪽 `fieldset-actions`로 이동했다. 버튼 상단은 box-model 상단에 맞춘다.
  - 위치: `apps/builder/src/builder/panels/styles/sections/SpacingSection.tsx` · `apps/builder/src/builder/panels/styles/components/BoxModelEditor.tsx` · `apps/builder/src/builder/components/styles/inspector-layout.css`

## [ADR-266 Implemented — 여러 page 문서의 줌 · 편집에서 그린 것을 버리지 않는다] - 2026-10-17

### Changed

- **ADR-266 종결 (Implemented, 측정 기록 종결)** — 22 페이지 문서 줌의 멈춤 (long task) 은 사라졌고 headed 줌은 목표 안이다. headless 줌 (p99 24 ~ 27 ms · drop 1.1 ~ 1.7 %) · 편집 꼬리는 목표 (20 ms · 1 %) 바로 위로 남아 그 사유 (여러 작은 JS 자리 — Rust 경계 · 엔진 아님) 와 함께 기록했다. Canvas Rust 이관 판정 trigger 1 재판정: 이관 근거 없음.
  - 위치: `docs/adr/completed/266-draw-cache-thrash-real-document-zoom-edit.md` · `docs/explanation/research/CANVAS_RUST_DECISION_2026-10.md` §1

### Performance

- **줌으로 page 열 수가 바뀔 때 Canvas 를 통째로 다시 묶던 것** (ADR-266 Phase 1) — page 를 자리만 옮겨야 하는데, Button 라벨처럼 요소 안에 따로 그리는 부분 (요소 id 없는 그리기 묶음) 이 있으면 옮기기가 늘 거절돼 전체를 다시 묶었고 그때 글자 paragraph 와 노드 picture 를 모두 버렸다. 그 묶음을 요소로 보지 않고 owner 와 함께 옮긴다. 합성 시험 문서에는 그런 부분이 없어 지금까지 드러나지 않았다.
  - **Why**: `checkTranslate` 가 서브트리 안 모든 그리기 시작 명령의 id 를 상자 맵에서 찾았고, 내부 그리기 묶음의 id 는 빈 문자열이다.
  - 위치: `apps/builder/src/builder/workspace/canvas/skia/subtreeTranslate.ts`
- **picture 캐시가 한 화면보다 작아 줌마다 다시 그리던 것** (ADR-266 Phase 2, 사용자 결정 — working set 동적 상한) — 상한 1,024 가 22 페이지 문서 한 화면 (3,860 ~ 3,961 요소) 보다 작아 순서대로 그릴 때마다 직전 것을 밀어냈다. 상한이 직전 화면이 쓴 수 × 1.25 를 따르고 (줄이기는 1 초 넘게 작은 화면일 때만, 보유 64 MB 상한), 넘을 때의 퇴거는 한 번의 정렬로 (매번 1,024 개를 훑던 것 — production 편집 프로필 1 위). 3,961 개를 들고 있어도 picture 는 약 1 MB 이고 WASM 힙은 그대로였다.
  - 위치: `apps/builder/src/builder/workspace/canvas/skia/nodePictureCache.ts` · `catalogRuntime/canvasScene.ts`
- **체크 표시 하나 때문에 화면 밖까지 그리던 것** (ADR-266 Phase 3) — 바깥 그림자 · 두꺼운 선처럼 자기 상자 밖으로 칠하는 요소가 문서에 하나라도 있으면, 화면에 걸친 요소만 그리는 경로와 바뀐 영역만 다시 그리는 경로가 모두 꺼졌다 (22 페이지 문서에서는 체크 표시 8 개). 그런 요소는 조상 clip 이 화면 · 바뀐 영역과 겹칠 때 늘 같이 그린다.
  - 위치: `apps/builder/src/builder/workspace/canvas/skia/renderCommands.ts`
- **처음 줌아웃할 때 멈칫하던 것** (ADR-266 Phase 4, 사용자 결정 — idle 미리 기록) — 화면에 처음 들어오는 요소를 그 프레임에서 처음 그려 3 프레임이 50 ~ 67 ms 걸렸다. 쉬는 시간에 화면 밖 요소를 화면 가운데에서 가까운 것부터 미리 그려 둔다 (최대 4,096 개 ≈ 1 MB, 화면 변화 없음). 줌으로 page 를 옮길 때마다 page 배경을 다시 그리던 것도 내용이 같으면 그대로 쓴다. page 옮기기는 옮길 수 있는지 한 번만 검사한다 (전에는 두 번).
  - **Why**: picture 는 위치와 무관한 요소 자기 좌표의 기록이라 미리 그려도 같다. 옮긴 page 는 새 데이터 객체로 다시 등록돼 picture 키가 빗나갔다.
  - 위치: `apps/builder/src/builder/workspace/canvas/skia/{nodePictureWarmup,nodePictureCache,renderCommands,useSkiaNode,subtreeTranslate}.ts` · `catalogRuntime/{canvasScene,canvasBinding}.ts`
- 사이트 · 앱 모양 22 페이지 문서 (`app-pages`) 의 dev 카운트: 줌 — 다시 묶기 50 → 0 · picture 재기록 94,756 → 0 · 글자 paragraph 재생성 70,312 → 0. 편집 — 전체 다시 그리기 9 → 0 (바뀐 영역만 15). 화면은 처음부터 다시 그린 것 (캐시 끔 · 선형 실행) 과 0 px 차 (줌 6 단계 · 편집 · undo). production (교대 2 쌍): 줌 gap p95 204 ~ 225 → 16 ~ 19 ms · drop 24 ~ 26 % → 0.9 ~ 1.7 % · long task 13 ~ 17 → 0 (headless · headed 120Hz).

### Tests

- **그리기 캐시의 사유별 카운터와 실사용 형태 문서 ratchet** (ADR-266 Phase 0, dev 전용) — page grid 옮기기 거절 사유 · 다시 묶기가 버린 picture · paragraph · picture 미스 (처음 · 퇴거 · 다시 묶기 · 무효화) · paragraph 미스 사유 · 화면 경로 후퇴 사유 · 기록당 그린 요소 수. 성능 ratchet 에 run `60:app-pages` 를 더했다. 하니스 `--zoom` 이 지워진 옛 dev 훅 대신 catalog Canvas 의 카메라 핸들을 쓴다 (prod 빌드에서도 동작). live 대조 `adr266-draw-cache-live.mjs`.
- 하니스 `--fixed-inputs` 는 idle 미리 기록을 부류마다 카운트 창 밖에서 끝까지 실행한다 (idle 시각이 카운트를 흔들지 않게). 새 카운터 `translateCheckCommands` · `pictureWarmRecorded`.
  - 위치: `apps/builder/src/builder/workspace/canvas/skia/{renderCounters,nodePictureCache,retainedParagraph,useSkiaNode,sameDrawData}.ts` · `catalogRuntime/{canvasScene,canvasBinding}.ts` · `apps/builder/perf/ratchet.json` · `apps/builder/scripts/{perf-baseline,adr266-draw-cache-live}.mjs`

## [grid 칸 가이드를 grid 안 요소 아래로] - 2026-10-16

### Fixed

- **grid 칸 가이드가 grid 안 요소 위에 그려지던 것** — grid 를 고르거나 · 그 자식을 고르거나 · 자식 크기를 바꿀 때 그리는 칸 선이 grid 에 놓인 요소를 가로질렀다. 칸 선은 overlay 라 장면 위에 그려졌다. 지금은 grid 자식의 보이는 상자를 잘라 내고 그려, 요소가 칸 선 위에 있다 (Figma 와 같다). 투명한 자식 (글자 등) 이 칸을 채우면 그 상자 안의 칸 선도 보이지 않는다.
  - 위치: `apps/builder/src/builder/workspace/canvas/catalog/{catalogOverlay.ts (gridOccludersOf),CatalogCanvas.tsx (childrenOf)}`

## [ADR-265 Implemented — 선택 전환의 문서 층 비용 · 측정 기록 종결] - 2026-10-16

### Performance

- **많은 형제 사이에서 고르기** (ADR-265 Phase 2) — 선택 1 회가 형제 수에 비례하던 문서 층의 일 다섯 가지를 덜어 냈다 (평평 5k 선택 30 회, dev 호출 수 3.45M → 1.22M). 결과는 같다 — 무작위 대조 (행 위치 1,200 step · 메뉴 1,000 선택 · 자동 id 5,000 표).
  - 선택한 요소의 Layers 행 찾기: 행 목록마다 identity 색인을 두고 필요한 만큼만 앞에서부터 채운다. overlay 가 페인트마다 선택을 다시 찾아, 5k 형제 사이 선택 1 회가 형제를 ~13 번 훑었다 (976,175 → 5,001 비교). 앞쪽을 고르면 여전히 앞부분만 읽는다.
  - page 사각형 (`pageFrameRects`): page 마다 member 전체 대신 root 의 record 에서 찾는다.
  - Design 패널 ID 칸의 자동 id: 첫 빈 번호를 문서 revision · 종류마다 한 번만 센다 (`text_1, text_2 …` 를 렌더마다 처음부터 셌다).
  - 메뉴 · 액션 바의 z-order 네 항목: 같은 형제 안 재배치는 위치와 무관하게 허용 · 거절되므로 계획 하나로 판정한다 (항목마다 5k 형제 목록을 복사했다). RAC Table 의 Column 은 위치를 따라 셀을 옮겨 항목마다 계획한다.
  - Layers: 항목 key 함수를 고정하고, 펼친 행 집합은 내용이 같으면 같은 객체로 둔다 (렌더마다 5,000 행을 다시 색인했다).
  - 위치: `apps/builder/src/builder/catalogRuntime/{workspace.ts,attributes.ts,canvasMenu.ts}` · `packages/shared/src/catalog/{runtime/compositionRoot.ts,commands/structure.ts (reorderReadsIndex)}` · `apps/builder/src/builder/panels/{navigator/catalog/CatalogLayersSection.tsx,properties/catalog/CatalogAttributesSection.tsx}`

### Changed

- **ADR-265 측정 기록 종결** (사용자 결정 2 「측정 기록으로 둔다」 · 결정 3 「측정 기록으로 종결」). production 짝 (5k): body 편집 p99 35.5 · 32.6 → 21.8 · 24.2 ms · drop 5.5 · 4.1 → 0 · 1.1 % · 평평 선택 drop 7.0 · 5.9 → 3.7 · 4.3 % (p99 ~29 ms 그대로) · 줌 · drag · 편집 · 600 선택 유지. 닫는 조건 중 중첩 카드 편집 (꼬리 = Canvas binding 의 옮김 · overflow · rect diff) 과 평평 선택 (꼬리 = Layers 행 렌더의 RAC 내부 · React DOM · 메뉴 Group 계획) 은 미달로 기록 — 선택 즉시 패널이 같은 프레임에 갱신되는 동작은 그대로다.

### Tests

- `adr265DocLayerEquivalence.test.ts` 에 행 위치 · 메뉴 z-order 대조, `adr265AutomaticHtmlId.test.ts` (자동 id = 탐색의 답). 레버 변이 4 개 RED. live `apps/builder/scripts/adr265-document-layer-live.mjs` 11/11. ratchet seed 600 하향 4 · 새 A `htmlIdProbes`.

## [ADR-265 Phase 1 — 큰 컨테이너 편집이 문서 크기만큼 일하지 않는다] - 2026-10-16

### Performance

- **body 처럼 자식이 많은 요소의 스타일 · 글자 편집** — 편집 1 회가 자식 수에 비례하던 일 네 가지를 덜어 냈다 (5k 자식 body 편집 15 회 실측). 결과는 같다 — 문서 · 색인 · 무효화 id · Layers 행 목록이 수정 전과 같은지 무작위 1,200 step 으로 확인.
  - 무효화 걸음: commit 뒤 걸음은 시드가 같고 색인이 그대로면 앞 걸음과 같으므로 건너뛴다 (150,060 → 75,030 방문). Preview iframe 의 delta 수신도 같다.
  - `graph.replace`: 자식 목록이 그대로인 entry 의 owner edge 를 열거하지 않는다 — old · new 에 같이 들어가 상쇄되던 것 (150,030 → 30).
  - commit: 이전 record 와 공유하는 (freeze 된) 필드를 다시 복제하지 않는다 — 스타일 편집마다 children 배열을 `structuredClone` 했다 (75,000 → 0).
  - Layers 행 목록 read: 부모의 행 관련 필드 (정의 · children · descendantOverrides) 에만 의존 — 부모의 스타일 편집은 행 목록을 다시 만들지도, 5,000 행을 `JSON.stringify` 로 두 번 비교하지도 않는다 (편집 1 회 1.5 MB → 0).
  - **Why**: 편집 비용의 본체 (commit · transaction · deliver) 는 변경 크기 비례였지만, 그 안의 분기가 바뀐 entry 의 자식 목록 크기 (body 는 문서 전체) 만큼 돌았다. 노드 하나의 폭 편집 (하니스 HC2 시나리오) 은 원래 상수다 — 그 꼬리는 Canvas binding 쪽 (Phase 0).
  - 위치: `packages/shared/src/catalog/{runtime/controller.ts,preview/receiver.ts,document/graph.ts}` · `apps/builder/src/builder/catalogRuntime/readModel.ts`

### Tests

- `adr265DocLayerEquivalence.test.ts` (무작위 1,200 step 동치 — 수정 전 공식 · 새로 만든 graph · 새 read model 이 oracle) · `adr265CommitSharing.test.ts`. 레버 변이 4 개 RED. ratchet `doc.*` 하향 10 · 새 A 2.
- `phase3FrameClipPair` 의 제품 파일 grep 이 모듈 옆 테스트 파일을 제품 reader 로 세던 실패를 고쳤다 (`*.test.ts(x)` 제외).

## [ADR-265 Phase 0 — 문서 층 카운터 · 편집 · 선택의 문서 크기 기울기] - 2026-10-16

### Added

- **문서 층 결정적 카운트** (`counts.doc.*` 35 개 — dev 빌드 전용, 사용자 가시 변경 없음). graph (`collectAffectedIds` 방문 · 서브트리 · `replace` edge) · transaction (staged · 검증 · ops 복제 길이) · runtime step (무효화 id · 저장 JSON 길이) · composition root (resolver · 레이아웃 입력 · 전체 그래프 step · member 복사 · `stateReaders` · `overrideDependents` · deliver) · read model (stale · 재계산 · 비교 직렬화 길이) · workspace (테마 · root 교체 · Components key) · Layers (rebuild · 행 · gated · 이름 재판정) · 선택 형제 비교 · 메뉴 dry-run · 편집 계약 `includes`. 카운터는 `packages/shared/src/catalog/docCounters.ts`, 하니스는 `__composition_DOC_COUNTERS__` 로 읽는다.
- **하니스** (`perf-baseline.mjs`): 부류 `select-spread` — 앞 · 중간 · 끝을 같은 비율로 고르는 결정적 선택열 30 회를 Canvas 클릭 경로 (`selectRecords`) 로 (기존 `select` 는 규모와 무관하게 처음 30 개라 형제 선형 탐색이 상수로 보였다). 옵션 `--edit-target body` (page body 편집 — 서브트리 확장 최대). 커버리지 상위 함수에 위치 (`at` · `url`) 를 붙여 익명 함수를 찾는다 (진단용).
- ratchet: seed 600 · 600:nested-flex 에 `doc.*` A 등록, 600 에 `select-spread` 부류.

### Changed

- `GraphMetrics.transactionEntriesTraversed` 를 배선했다 (stage 의 owner 탐색 + commit 교체 루프가 돈 entry 수 — leaf 편집 1). 0 을 단언하던 테스트 7 곳이 실측값을 단언한다. 아무도 늘리지 않던 `transactionEntryTableClones` 는 지웠다 (transaction 경로에 table 복사 지점이 없다 — 전체 export 감시는 `exportDocument` stub 테스트가 한다).

### 측정 결과 (600 → 5k, 상세 breakdown §1)

- 중첩 카드 폭 편집 (ADR-263 · 264 의 HC2 시나리오): 문서 층 카운트가 상수. 규모와 함께 느는 호출은 Canvas binding (`subtreeTranslate` · overflow clip · rect diff).
- body 편집: 서브트리 확장 18,060 → 150,060 · page 행 read 비교 직렬화 2.7 → 23 MB.
- 선택: 형제 비교 118,175 → 976,175 (overlay 가 페인트마다 위치 조회) · `pageFrameRects` member 탐색 · 자동 HTML id 탐색 · dry-run 안 children filter · Layers RAC `getKey` 가 비례.

## [grid 열 · 행 편집 — 최소 · 최대 크기 · 격자 선택기 · Rows 자동 · Canvas 열 · 행 머리 · 칸 선택 · Figma 동작 정렬] - 2026-10-16

### Changed

- **grid 동작을 Figma 에 맞췄다** (사용자 결정 「Figma 와 동일한 방향」 · 「3~6번은 Figma 에 맞춰」, Figma help 「Use the grid auto layout flow」 · Plugin API 대조).
  - **열 · 행 삭제** (Layout 탭 「−」 · Canvas 열 · 행 머리 Delete) — 그 열 · 행에만 있던 요소도 지운다. 다른 열 · 행에 걸친 요소는 칸 수만 줄고, 뒤에 고정된 요소는 당겨진다. 격자 선택기 · 개수 칸으로 줄일 때는 종전처럼 요소를 가까운 칸으로 옮긴다 (Figma 도 같다).
  - **막힌 칸에 놓기** — 다른 요소의 칸 위에 놓으면 (하나를 끌 때) 그 칸을 차지하고, 막던 요소는 가장 가까운 빈 칸으로 간다. 빈 칸이 없으면 새 행을 만든다 (행 템플릿이 있으면 마지막 행과 같은 행을 덧붙인다). 종전엔 순서만 바꿨다. frame 처럼 자식을 받는 요소 위는 종전대로 그 안으로 들어간다.
  - **Rows 자동** — 행 템플릿이 없는 grid 는 요소가 없는 행을 중간 행까지 같은 step 에서 닫는다 (지우기 · 밖으로 옮기기 · 더 아래 칸에 고정 모두). breakpoint 마다 그 breakpoint 의 값으로 판단한다.
  - **새 grid 기본값** — Display 를 grid 로 바꾸면 열 Fill 2 개 · 행 자동으로 시작한다 (Figma 와 같다 — 사용자 확인).
  - 위치: `apps/builder/src/builder/catalogRuntime/{gridTrackEdit.ts (gridItemsInRemovedTracks),canvasGesture.ts (displace · gridRowsFor),gridAutoRows.ts,workspace.ts}` · `panels/styles/hooks/useStyleActions.ts`

### Added

- **열 · 행 · 칸 선택을 Figma 에 맞췄다** (Figma 실측 · 사용자 「남은 차이 전부 맞춰」).
  - **pill 표시** — grid 를 골라도 pill 은 포인터 아래 열 · 행과 선택한 열 · 행에만 보인다 (위 · 왼쪽 가장자리 띠 포함). 키보드 focus 를 받은 pill 도 보인다.
  - **pill 라벨 = 값** — Fill 은 `fr` 값 (`1fr` · `2fr`), Fixed 는 px (`140px` — 경계를 끄는 동안도), Hug 는 그려진 크기와 함께 (`140 Hug`).
  - **빈 열 · 행을 Hug 로** — 요소가 없는 열 · 행은 CSS `auto` 에서 0 으로 접혀 「0 Hug」 였다. 지금 크기를 최소 크기로 남긴다 (`minmax(150px, auto)` — Layout 탭 「최소 크기」 에 보인다).
  - **Hug 로 바꿀 때 크기 유지** — 열 · 행을 Hug 로 바꾸면 (Canvas 메뉴 · Layout 탭 「열」 · 「행」) 그 열 · 행만 차지하고 크기가 정해지지 않은 (채우던) 요소에 지금 그려진 크기를 고정으로 준다 (템플릿과 한 step). 종전엔 채우던 요소의 내용 폭이 0이라 열이 0으로 접혔다.
  - **칸 가이드는 실선** — grid 를 고르거나 그 자식을 고를 때 · 자식 크기를 바꿀 때 그리던 칸 가이드를 점선에서 실선으로 바꿨다 (Figma — 사용자 지시). 점선은 칸 선택 중 grid 선택선뿐이다.
  - **pill 모양** — 트랙 폭이 아니라 글자 폭 + 좌우 6 으로 트랙 가운데에 놓인다 (행은 세로로 같은 길이). 두께 22px · 글자 12px · 모서리 4 · 가장자리와 간격 8 · 선택 색 (파랑 위 흰 글자) 이 선택 상자 아래 크기 표시 (`420 × 300`) 와 같다 (사용자 지시). 상자 · 칠 · 점선 · 삽입선도 같은 파랑.
  - **선택 표시** — 선택한 열 · 행은 전체를 한 상자 (실선) 로 두르고, 요소가 없는 칸을 칠한다 (요소 칸은 비움).
  - **Design 패널 「격자」 보기** — 열 · 행을 고르면 패널이 열 · 행 목록으로 바뀌고 선택한 줄이 강조된다. 닫기 (X) · Escape · Canvas 누름 · 다른 선택이면 탭으로 돌아간다. 열 · 행 목록은 여기서만 연다 — Layout 탭의 「열」 · 「행」 절은 뺐다 (Figma 와 같이 Canvas 에서 열 · 행을 골라 들어간다, 사용자 지시). 메뉴 · 팝오버 안의 Escape 는 그 메뉴만 닫는다.
  - **칸 선택** — 선택된 grid 의 빈 칸을 누르면 그 칸이 선택된다 (칸은 안쪽만 칠하고 테두리를 다시 그리지 않음 · grid 선택 유지 · grid 선택선만 점선으로 — 모서리 핸들 · 크기 표시는 그대로 · 그 칸의 열 · 행 pill). 그때 붙여넣기는 grid 안 그 칸으로 들어간다 (한 step). Delete 는 종전대로 grid 를 지운다 (Figma 도 같다). 선택 안 된 grid 의 빈 칸을 누르면 grid 만 선택된다.
  - **선택 해제** — 열 · 행 · 칸 선택은 Canvas 의 다른 곳 (grid 빈 곳 · grid 안 요소 · 빈 Canvas) 을 누르거나, Layers 등에서 선택이 바뀌거나, Escape 를 누르면 풀린다 (grid 선택은 유지). 종전엔 같은 grid 를 다시 눌러도 열 선택이 남았다.
  - 위치: `apps/builder/src/builder/stores/gridTrackSelection.ts` · `workspace/canvas/catalog/{CatalogGridTrackLayer.{tsx,css},catalogOverlay.ts (chromeHidden),CatalogCanvas.tsx}` · `catalogRuntime/{gridTrackHeaders.ts (gridHoverTracks · gridEmptyCellAt · gridTrackFill),gridCellPaste.ts,shortcuts.ts}` · `panels/design/DesignPanel.tsx` · `panels/styles/sections/GridTracksSection.tsx`

- **같은 칸 수 요소 자리 바꾸기 (Figma)** — 같은 grid 에서 칸 수가 같은 요소를 둘 이상 고르면 가운데에 분홍 원이 나온다. 원을 다른 선택 요소 위로 끌어 놓으면 두 요소의 자리가 바뀐다 (한 step).
  - 위치: `apps/builder/src/builder/workspace/canvas/catalog/CatalogGridTrackLayer.{tsx,css}`

- **Canvas 위 열 · 행 머리 (Figma grid)** — grid 를 고르면 위 가장자리에 열마다, 왼쪽 가장자리에 행마다 pill 이 나온다. pill 을 누르면 그 열 · 행이 선택되고 (⌘/Ctrl 토글 · ⇧ 범위), 선택한 pill 을 다시 누르면 Fixed · Fill · Hug · 제거 메뉴가 열린다. pill 사이 경계를 끌면 앞 열 · 행이 Fixed 로 크기가 바뀌고 (끄는 동안 미리보기, 놓을 때 한 step), pill 을 끌면 선택한 열 · 행이 옮겨지며 거기 고정된 요소가 따라간다. Delete · Backspace 는 grid 가 아니라 선택한 열 · 행을 지운다 (Layout 탭 「−」 와 같은 명령).
  - 위치: `apps/builder/src/builder/workspace/canvas/catalog/CatalogGridTrackLayer.{tsx,css}` · `apps/builder/src/builder/catalogRuntime/gridTrackHeaders.ts` · `gridTrackEdit.ts` (`gridTrackOrderAfterMove` · `gridLinesAfterTrackMove`) · `canvasGesture.ts` (`gridTracksOfRecord`)
- **열 · 행 최소 · 최대 크기** — Layout 탭 「열」 · 「행」 절의 행 메뉴 (⋮) 에 「최소 크기 추가」 · 「최대 크기 추가」. CSS 가 쓸 수 있는 조합만: Fill + 최소 = `minmax(120px, 1fr)` · Hug + 최소 = `minmax(120px, auto)` · Hug + 최대 = `fit-content(240px)`. Fill 의 최대 · Hug 의 최소와 최대 동시 지정 · Fixed 는 메뉴 항목이 비활성. Canvas 칸 가이드도 최소 · 최대를 따른다.
  - 위치: `apps/builder/src/builder/panels/styles/utils/gridTracks.ts` · `sections/GridTracksSection.tsx` · `catalogRuntime/canvasGridCells.ts`
- **격자 선택기** — Layout 절 Columns · Rows 옆 버튼 → 10 × 10 칸에서 열 × 행을 고른다 (지나가면 범위 표시, 키보드 화살표 · Enter). 줄인 열 · 행의 요소는 가까운 칸으로, 열 · 행 변경과 요소 정리가 한 step.
  - 위치: `apps/builder/src/builder/panels/styles/sections/GridSizePicker.{tsx,css}` · `LayoutSection.tsx`
- **Rows 「자동」** — Rows 칸 목록에 「자동」: 행 템플릿을 비워 행이 요소를 따라 생긴다 (CSS 암묵 행). 고정 위치는 지우지 않는다.

### Changed

- Styles host `applyGridTracks` 가 여러 축의 편집 (`{ axis, template, removed, order? }[]`) 을 한 step 으로 받는다 — 격자 선택기 (열 + 행) · Canvas 열 · 행 이동 (`order`) 이 같은 경로.
  - 위치: `apps/builder/src/builder/panels/styles/{stylesHostContext.ts,catalog/catalogStylesHost.ts}`

### Tests

- `gridTrackHeaders.test.ts` (머리 위치 · 선택 · 삽입 위치 · 경계 크기 · 이동 순서) · `gridTracks.test.ts` 최소 · 최대 3 · `canvasGridCells.test.ts` 최소 · 최대 칸 1 · `gridTrackRemoval.test.ts` 두 축 한 step · 열 이동 시 요소 따라감 (이동 경로를 끄면 RED).
- `gridAutoRows.test.ts` 3 (빈 행 닫기를 끄면 RED) · `phase4eCanvasGesture.test.ts` 막힌 칸 밀어내기 · 새 행 · `gridTrackRemoval.test.ts` 열 삭제 시 요소 삭제 · `gridTrackHeaders.test.ts` 삭제 대상 판정.
- `gridTrackHeaders.test.ts` pill 표시 · 빈 칸 판정 · 선택 칠 · `gridCellPaste.test.ts` (칸 고정을 빼면 RED).
- live: `apps/builder/scripts/grid-cell-selection-live.mjs` 7/7 (포인터 근처 pill · 빈 칸 칠 · 점선 · 「격자」 보기 · 닫기 · 칸 선택 · 칸 붙여넣기 · 칸 선택 중 Delete) · `grid-figma-align-live.mjs` 6/6 (새 grid Fill · 밀어내기 + 새 행 · Rows 자동 · 자리 바꾸기) · `grid-track-headers-live.mjs` 8/8 (선택 해제 포함) · `grid-track-sizes-live.mjs` 13/13 · `canvas-dnd-drop-rules-live.mjs` 7/7 (1 · 1b 를 밀어내기로 갱신) · `grid-cell-placement-live.mjs` 9/9 · `grid-span-fit-live.mjs` 3/3.

## [ADR-264 Implemented — 자리만 옮긴 요소는 다시 그리지 않는다 · 줌에서 page 재구성 없음 (측정 기록 종결)] - 2026-10-16

### Changed

- **Canvas 편집이 바뀐 요소만 다시 기록한다** — 한 요소의 크기가 바뀌면 지금까지는 위로 올라가며 크기가 바뀐 조상 아래 전부 (뒤 형제 · 뒤 section 까지) 를 다시 기록했다. 이제 바뀐 요소만 다시 기록하고, 크기가 바뀐 조상은 자기 명령만, 자리만 옮긴 형제는 좌표 · clip · hit 영역 · SpatialIndex 만 옮긴다. 중첩 flex 5,000 편집 15 회의 교체 명령 178,875 → 1,155. 스크롤 상자의 scrollbar 만 바뀐 경우도 상자 자기 명령만 다시 쓴다.
  - 위치: `apps/builder/src/builder/workspace/canvas/skia/subtreeTranslate.ts` (`translateSubtree` · `placeRegion`) · `renderCommands.ts` (`buildSelfCommandStream` · `childClipRectOf` · `hitBoundsOf` · `writeCommandAt`) · `catalogRuntime/canvasBinding.ts`
- **줌으로 page grid 열 수가 바뀔 때 scene 을 다시 묶지 않는다** — page 내용은 그대로라 page root 만 옮긴다 (page grid gap · 열 편집도 같은 길, frame 크기가 바뀌면 지금처럼 다시 묶는다). 평평 600 줌 재바인드 14 → 0 · node picture miss 1,036 → 14.
  - 위치: `catalogRuntime/canvasBinding.ts` (`movePageRoots`) · `canvasScene.ts` (`pageGridChanged`) · `workspace/canvas/catalog/CatalogCanvas.tsx`
- **측정 기록으로 종결** (사용자 결정). production 빌드 짝 (수정 전 · 후): 평평 5,000 줌 프레임 간격 p99 20.8 · 33.9 → 17.3 · 17.8 ms · 끊김 0 %, 평평 10,000 줌 49.5 → 17.7 ms, 중첩 5,000 drag 메인 스레드 2.1 → 1.4 ~ 1.5 s. 중첩 5,000 편집은 p99 26 ~ 28 → 24 ~ 26 ms · 끊김 2.1 ~ 3.2 → 1.0 ~ 2.1 % 로 목표 (20 ms · 1 %) 미달 — 남은 비용은 Canvas 가 아니라 문서 · 트랜잭션 층.
- perf ratchet 게이트가 fixture 를 run 키로 구분한다 (`600:nested-flex` — 중첩 문서 편집을 pre-push 가 잰다, `--add-run`) · seed 600 에 `zoom` 부류.
  - 위치: `apps/builder/scripts/perf-ratchet-gate.mjs` · `perf-ratchet-run.mjs` · `apps/builder/perf/ratchet.json`

### Tests

- `subtreeTranslate.test.ts` — 무작위 트리 1,200 (옮기기) · 400 (부모가 넘긴 문맥) · 1,000 (`placeRegion`) 이 처음부터 기록한 명령 · span · 맵 · SpatialIndex 와 같다 · 리뷰 반례 3 · 거절 조건. `phase4eCanvasScene.test.ts` page grid 열 수 변경 = 새로 묶은 scene. `perf-ratchet-gate.test.mjs` `--add-run`.
- live: `apps/builder/scripts/adr264-subtree-translate-live.mjs` 13/13 (편집 6 · 줌 5 · page grid 편집 — 재바인드와 픽셀 · 맵 · SpatialIndex 후보 0 차).

## [ADR-263 Implemented — 그리기 명령 패치·실행 비용 축소 종결 (측정 기록)] - 2026-10-16

### Changed

- **ADR-263 을 측정 기록으로 종결했다** (사용자 결정). Phase 1 ~ 5 를 합친 production 빌드 짝 측정 (수정 전 · 후, 교대 2 쌍): 중첩 flex 5,000 줌 프레임 간격 p99 26 ~ 28 → 17.6 ms · 끊김 1.7 ~ 1.9 → 0 %, 중첩 5,000 편집 p99 34 ~ 35 → 24 ~ 26 ms · 끊김 4.3 ~ 5.9 → 1.0 ~ 1.6 %, 평평 5,000 줌 28 ~ 37 → 27 ~ 28 ms, drag 는 그대로. 편집 · 평평 줌은 목표 20 ms 에 못 미쳤고, 남은 비용은 그리기 명령이 아니라 레이아웃 이동 영역이 큰 편집 (다시 끼우는 영역 크기) 과 줌마다 page grid 자동 열 수가 바뀌어 장면을 다시 묶는 것이다.
- 실제 Builder 확인: 편집 유형 22 가지를 새 경로로 그린 화면과 같은 상태를 전체 다시 그린 화면이 픽셀 단위로 같다 (`apps/builder/scripts/adr263-render-path-live.mjs`).
- 위치: `docs/adr/completed/263-render-command-patch-execute-cost.md` · `docs/adr/design/263-render-command-patch-execute-cost-breakdown.md` §기록.

## [ADR-263 Phase 5 — 편집이 바뀌지 않은 요소의 그림을 버리지 않는다] - 2026-10-16

### Changed

- **편집 · drag 로 다시 끼운 영역 안에서 바뀌지 않은 요소의 기록된 그림 (노드 picture) 을 다시 쓰고, 검증은 영역을 한 번만 읽는다.** 종전엔 영역 안 모든 요소의 그림을 버려 다음 프레임에 전부 다시 기록했고, 영역을 네 번 읽었다. 그림 캐시가 이미 요소 데이터 · 크기로 바뀜을 판정하므로, 지운 요소의 그림만 푼다.
- 개발 빌드 측정 (중첩 flex 5,000 drag 189 프레임): 그림 다시 기록 20,845 → 381 · 검증 읽기 7,462,500 → 3,731,250.
- 위치: `apps/builder/src/builder/workspace/canvas/skia/subtreeCommandPatch.ts`. 검증: 새 시험 1 (남는 그림 유지 · 지운 그림 해제 · 한 번 읽기 — 되돌리면 RED) · canvas · catalogRuntime 통과 · type-check · ratchet 원복 RED `block` · live 22 건 0 px 차.

## [ADR-263 Phase 4 — 편집마다 스크롤 상자 전체를 다시 재지 않는다] - 2026-10-16

### Changed

- **scroll/auto 상자 (page body 포함) 안을 편집할 때 스크롤 범위를 바뀐 요소만으로 갱신한다.** 종전엔 편집마다 스크롤 상자의 자손 전체를 훑었다 (page body 가 scroll 이면 페이지 전체). 상자가 내용의 끝 좌표를 들고 있다가 바뀐 서브트리만 다시 재고, 끝이 물러났을 수 있을 때 · 구조나 clip 이 바뀌었을 때만 전체를 다시 잰다. 범위 · 스크롤바는 같다.
- 개발 빌드 측정 (중첩 flex 5,000): 편집 15 회의 범위 계산 방문 392,028 → 106,266, 평평 5,000 편집 75,000 → 30.
- 위치: `apps/builder/src/builder/catalogRuntime/{canvasOverflow.ts,canvasBinding.ts}`. 검증: 새 시험 3 (무작위 2,000 건 · binding 무작위 편집 300 단계가 전체 재계산과 같음 — 규칙을 빼면 RED) · canvas · catalogRuntime 통과 · type-check · ratchet 원복 RED `block` · live (휠 스크롤 → 내용 늘림 → 늘어난 범위까지 스크롤, 화면 0 px 차).

## [ADR-263 Phase 3 — 편집 · drag 가 바뀐 영역만 다시 그린다] - 2026-10-16

### Changed

- **Canvas 편집 · drag 프레임이 바뀐 요소의 이전 · 이후 자리만 다시 그린다.** ADR-248 에서 옛 소스를 지울 때 부분 재기록 연결이 같이 빠져, 값 하나를 바꿔도 화면 전체를 다시 그렸다. 그림자 · outline · transform 처럼 상자 밖으로 그리는 요소가 바뀌기 전이나 후에 있으면, 또는 글자가 상자 밖으로 넘쳤거나 새로 넘치면 전체를 다시 그린다 (잔상 없음). 전체 다시 그리기 요청은 뒤따른 부분 요청에 덮이지 않는다.
- 위치: `apps/builder/src/builder/workspace/canvas/skia/{SkiaRenderer.ts,subtreeCommandPatch.ts,renderCommands.ts,nodeRendererText.ts}` · `apps/builder/src/builder/catalogRuntime/{canvasBinding.ts,canvasScene.ts}` · `apps/builder/src/builder/workspace/canvas/catalog/CatalogCanvas.tsx`. 검증: 새 시험 9 (그림자 제거 · 무효화 순서 — 가드를 빼면 RED) · canvas · catalogRuntime 3,159 통과 (togglebuttongroup 기존 1건) · type-check · ratchet 원복 RED `block` · live 19 건 (편집 유형마다 같은 상태의 전체 다시 그리기와 0 px 차, 가드를 빼면 그림자 잔상 1,450 px · 글자 1,118 px).

## [ADR-263 Phase 2 — 줌 · 화면 갱신이 화면에 걸친 요소만 다시 그린다] - 2026-10-16

### Changed

- **Canvas 를 다시 그릴 때 화면 밖 요소의 그리기 명령을 지나지 않는다.** 줌 · 화면 갱신마다 문서 전체 명령을 처음부터 끝까지 훑으며 화면 밖 서브트리를 명령 하나씩 건너뛰었다. 이제 공간 색인으로 화면에 걸친 요소와 그 조상만 골라 그리고 (노드 picture 재생 유지), 고를 수 없는 장면 (그림자 · outline · transform 같은 상자 밖 paint · drag 중) 은 화면 밖 서브트리를 통째로 건너뛴다. 그려지는 결과는 같다.
- 개발 빌드 측정 (중첩 flex 5,000): 줌 프레임의 명령 방문 930,415 → 38,998 · 재기록 p95 25.9 → 3.0 ms, 평평 5,000 줌 재기록 p95 11.9 → 2.7 ms. production 수치는 ADR-263 종결 측정에서.
- 위치: `apps/builder/src/builder/workspace/canvas/skia/{renderCommands.ts,nodeRendererTree.ts}` · `apps/builder/src/builder/catalogRuntime/canvasScene.ts`. 검증: 새 시험 8 (방문 수 N = 600 / 5,000 같은 상수 · 그리기 순서 = 선형 — 끄면 RED) · canvas · catalogRuntime 3,159 통과 (togglebuttongroup 기존 1건) · type-check · ratchet 원복 RED `block` · live 픽셀 대조 (줌 0.5 · 1 · 2 에서 선형 full 과 0 px 차).

## [ADR-263 Phase 1 — 그리기 명령 읽기가 Proxy 를 지나지 않는다] - 2026-10-16

### Changed

- **Canvas 그리기 명령을 읽을 때 piece-table Proxy 를 거치지 않는다.** 편집 뒤의 명령 버퍼는 segment 목록이라 명령 하나를 읽을 때마다 Proxy trap · 문자열 index 판정 · 이분 탐색을 지났다. 실행 · damage sequence · patch 검증이 지금 segment 범위를 들고 읽는다 (복사 없음). 그리는 결과는 같다.
- 위치: `apps/builder/src/builder/workspace/canvas/skia/{renderCommands.ts,subtreeCommandPatch.ts}` · ratchet `apps/builder/perf/ratchet.json` (`render.*` 11 키 등급 A). 검증: 새 시험 3 (무작위 splice 1,000 건 동일 · Proxy 읽기 0 — 되돌리면 RED) · renderCommands · subtreeCommandPatch 40 통과 · type-check · ratchet 원복 RED (수정 전 읽기 → Proxy 읽기 0 → 2,205 · 22,947 · 25,425, 두 번 다 `block`).

## [ADR-263 Phase 0 — 그리기 명령 층 카운트 · 새 카운트 ratchet 등록] - 2026-10-16

### Added

- **프레임 하니스가 그리기 명령 층을 센다** (`counts.render` — 명령 방문 · 컬링 소비 · picture 재생으로 건너뛴 명령 · piece-table Proxy 읽기 · segment · 스크롤 범위 방문 · patch 검증 순회 · patch 교체). dev 빌드 전용 (`skia/renderCounters.ts`), 같은 조건 2회 같은 값.
- **ratchet `--add-keys`**: 2회 같은 값인 새 카운트를 0 포함 등급 A 상한으로 넣는다 — `--update` 는 새 지표를 B 에 넣고 0 은 빼서 회귀를 막지 못했다. 기존 상한은 바꾸지 않고, recorder 채널을 더한 경우 기존 A 를 넘지 않는 보고로만 해시를 갱신한다 (`--accept-recorder`).
- 측정 결과 (중첩 5k): drag 는 프레임마다 preview → patch ~1만 명령 (검증 4 회 순회) → 전체 재기록 · node picture 153 개 재기록, 전체 재기록 방문의 64 ~ 99 % 가 화면 밖 서브트리를 하나씩 소비. 줌 꼬리는 GPU flush 가 아니라 JS 재기록.
- 위치: `apps/builder/src/builder/workspace/canvas/skia/{renderCounters.ts,renderCommands.ts,subtreeCommandPatch.ts}` · `catalogRuntime/canvasOverflow.ts` · `apps/builder/scripts/{perf-baseline.mjs,perf-ratchet-gate.mjs}`. 검증: ratchet 판정 시험 18 (새 3 — 등록 키 회귀 시 `block`) · 하니스 시험 15 · type-check.

## [grid — 열 · 행을 지우면 거기 고정된 요소가 가까운 칸으로 간다] - 2026-10-16

### Fixed

- **「열」 · 「행」 절의 「−」 나 Layout 의 개수를 줄여 열 · 행을 지우면, 거기 고정돼 있던 요소가 grid 밖으로 밀려나지 않는다** (Figma — 지운 열 · 행의 요소는 가까운 칸으로, 걸친 span 은 줄어든다). 지운 열 · 행 뒤에 고정된 요소는 그 수만큼 당겨지고, 걸쳐 있던 span 은 줄고, 지운 열 · 행에만 있던 요소는 그 축의 고정을 풀어 같은 행 · 열의 빈 칸으로 간다. 템플릿과 요소 쓰기는 한 번의 실행 취소 단위다.
- **Why**: 열 · 행 제거가 템플릿만 바꿔, 지운 열 · 행 뒤에 고정된 요소가 CSS 암묵 칸 (grid 밖) 으로 넘어갔다.
- 위치: `apps/builder/src/builder/catalogRuntime/gridTrackEdit.ts` · `apps/builder/src/builder/panels/styles/{catalog/catalogStylesHost.ts,stylesHostContext.ts,sections/GridTracksSection.tsx,sections/LayoutSection.tsx}`. 검증: 테스트 2 (줄 계산 7 경우 · host 한 단계 + undo — 요소 쓰기를 끄면 RED) · i18n · styles · components · gesture · position 694 통과 · type-check · live `grid-track-sizes-live.mjs` 4c (열 4 에 고정된 C → 열 2 제거 → 열 3, 그 칸 위치 · grid 안).

## [grid — 열 · 행마다 크기를 정한다 (Fixed · Fill · Hug)] - 2026-10-16

### Added

- **grid 를 고르면 Design 패널 Layout 탭에 「열」 · 「행」 절이 생기고, 한 줄에 하나씩 그 열 · 행의 크기를 정한다** (Figma grid 의 track list, 사용자 지시 「열·행별 크기 설정부터 진행해」 · 「열 · 행 section 으로 나누면 되지 않나」). 단위 메뉴로 Fixed (`px`) · Fill (`fr` — grid 크기의 몫, 숫자는 가중치) · Hug (`fit` — 그 열 · 행의 가장 큰 요소) 를 고른다. 줄의 「−」 가 그 열 · 행을 지우고 절 헤더 「+」 가 끝에 Fill 하나를 붙인다. 종전엔 모든 열 · 행이 같은 크기였고, 다르게 하려면 CSS 문자열을 직접 써야 했다.
- Layout 절의 Columns · Rows 개수를 바꾸면 크기를 정한 열 · 행은 그대로 두고, 늘어난 것만 Fill 1 로 붙는다 (종전엔 개수를 바꾸면 템플릿 전체를 같은 크기로 다시 썼다). 목록이 보여 줄 수 없는 템플릿 (`%` · `auto-fill` · 길이 최소의 `minmax` 등) 은 절 안 글자 칸 하나로 남는다.
- 템플릿은 CSS 그대로 쓴다 (`100px minmax(0, 2fr) auto`) — Canvas 엔진 · 칸 가이드 · Preview DOM 이 같은 값을 읽는다. 아직 없음: 최소 · 최대 크기, Canvas 위 열 · 행 편집.
- 위치: `apps/builder/src/builder/panels/styles/{sections/GridTracksSection.tsx,sections/LayoutSection.tsx,utils/gridTracks.ts,StylesPanel.components.tsx,hooks/useSectionCollapse.ts}` · `apps/builder/src/builder/components/styles/inspector-layout.css` · `apps/builder/src/i18n/{labels.ts,translations.ts,sharedActionVocabulary.static.test.ts}`. 검증: gridTracks 테스트 4 (읽기 · 쓰기 · 칸 값 · 개수 변경) · i18n · styles · components 651 통과 (같은 영어 다른 개념 Column · Row · Rows 를 동음이의어로) · type-check · live `grid-track-sizes-live.mjs` 7/7 (새 — 절 2 · 열 1 = 100px · 열 2 = 2fr · 열 3 = Hug → 칸 폭 100 / 250 / 50, 행 1 = 80px → 80 / 220, 열 수 4 → 앞 세 열 유지, 「−」 · 「+」, Preview DOM = Canvas).

## [grid — 크기 핸들을 칸 경계에 놓으면 그 칸까지 차지한다 (Figma)] - 2026-10-16

### Changed

- **grid 안 요소의 크기 핸들을 칸 경계에 붙여 놓으면, 그 경계까지의 칸을 차지하고 (span) 그 방향 크기가 Fill 이 된다** (Figma 와 같음, 사용자 결정 「Figma 방식으로 진행해」 — 같은 날의 「핸들 span 계산은 빼고 요소만 늘어나게」 를 바꿈). 요소는 지금 자리에 고정된다. 경계에 붙지 않은 자리에서 놓거나 ⌘ (snap 끔) 이면 종전처럼 크기만 바뀐다. 칸 크기는 그대로다.
- **Why**: 고정 px 로 남기면 breakpoint 마다 칸 크기가 달라 desktop 의 두 칸 폭 요소가 Mobile 칸을 넘치거나 차지 칸 수가 달라졌다. Fill 은 그 breakpoint 의 칸 크기를 따른다.
- 위치: `apps/builder/src/builder/catalogRuntime/canvasGesture.ts` (`snapResizeToCells` · `cellSpanCommand`) · `apps/builder/src/builder/workspace/canvas/catalog/CatalogCanvas.tsx` (`ownFields`). 검증: 테스트 3 (열 경계 → span 2 · 폭 Fill · 행 경계 → 행 span 2 · 경계 밖 · ⌘ 은 크기만 — 앞 둘 수정 전 RED) · catalogRuntime · canvas catalog · styles 2,706 통과 · type-check · live `grid-cell-placement-live` 9/9 (6 · 7 기대값을 span 으로 바꿈, Preview DOM = Canvas) · `grid-span-fit-live` 3/3 · `canvas-dnd-drop-rules-live` 7/7 · body 2열 grid 에서 핸들로 두 칸 → Mobile 전환 시 폭 1920 → 390 (두 칸 그대로, 넘침 없음).

## [grid — 여러 칸 요소를 끌 때 칸 배경이 끄는 상자를 따른다] - 2026-10-16

### Fixed

- **열 · 행 span 이 2 이상인 요소를 grid 안에서 끌면, 놓일 칸 배경이 끄는 상자 위치를 따라 끝까지 보인다.** 종전엔 1×1 은 잘 됐지만 2×1 · 2×2 는 배경이 빠지거나 한 칸 밀려 보였고, breakpoint 마다 달랐다 (사용자 보고).
- **Why**: 놓을 칸을 포인터가 놓인 칸으로 골랐다. span 요소는 잡은 지점이 요소 왼쪽 위 칸에서 한 칸 이상 떨어져 있어 배경이 밀렸다. 원래 자리 칸 위에서는 「제자리」 로 보고 배경을 숨겼다. 오른쪽 · 아래 끝에서는 다 들어가지 않는 빈 칸이 빠지는 대신 다른 요소의 칸이 늘 후보로 남아, 그 요소 앞뒤 순서 바꾸기 (삽입선) 로 넘어갔다. 칸 크기가 breakpoint 마다 달라 이 어긋남도 달랐다.
- 수정: 빈 칸 (끄는 요소 자신의 칸 포함) 은 「상자 안 잡은 지점이 그 칸 범위에 놓일 자리」 와 포인터의 거리로 고른다. 1칸이면 칸 가운데라서 종전과 같다. 원래 자리는 배경을 보이고 놓아도 문서를 바꾸지 않는다. 다른 요소의 칸은 포인터가 그 위에 있을 때만 순서 바꾸기다.
- 위치: `apps/builder/src/builder/catalogRuntime/canvasGesture.ts` (`gridTarget`). 검증: 테스트 3 (상자 따라가기 · 원래 자리 · 끝 칸 — 수정 전 RED 3/3) · catalogRuntime · canvas catalog 2,279 통과 · type-check · live headed Playwright (4×4 grid 에서 1×1 · 2×1 · 2×2 요소를 대각선으로 41단계 끌기 — 배경 없는 단계 6 · 17 · 21 → 0, 남은 2단계는 포인터가 다른 요소 위인 순서 바꾸기. Mobile breakpoint 에서도 같은 결과).

## [Layout — grid 자식의 칸 수 라벨을 Column span · Row span 으로] - 2026-10-16

### Changed

- **grid 자식의 Layout 칸 수 필드 이름을 「Column span」 · 「Row span」 (한국어 「열 병합」 · 「행 병합」) 으로 바꿨다** (사용자 지시). Figma grid auto layout 과 Framer 의 이름을 따랐다. 「Column span」 은 Table Cell 의 같은 이름 번역 키를 함께 쓴다.
- 위치: `apps/builder/src/builder/panels/styles/sections/LayoutSection.tsx` · `apps/builder/src/i18n/{labels.ts,translations.ts}` · `apps/builder/scripts/grid-cell-placement-live.mjs`. 검증: styles · i18n 테스트 448 통과 · type-check · live `grid-cell-placement-live.mjs` 9/9.

## [grid — breakpoint 를 바꾸면 칸 가이드가 새 breakpoint 크기로 그려진다] - 2026-10-16

### Fixed

- **body (또는 grid 요소) 를 grid 로 둔 채 breakpoint 를 바꾸면, 칸 점선이 이전 breakpoint 크기로 남던 결함을 고쳤다.** 다른 편집을 한 번 해야 바로잡혔다. grid 안 자식을 고를 때 보이는 부모 칸도 같았다 (사용자 보고).
- **Why**: Canvas 는 칸을 문서 step 마다 캐시하는데, breakpoint 전환은 문서 step 이 아니라 root 교체라 캐시가 지워지지 않았다. live 확인 핸들은 캐시를 거치지 않아 이 결함을 잡지 못했다.
- 수정: root 교체 때 칸 캐시를 지우고, live 핸들이 overlay 와 같은 캐시 경유 함수를 읽는다.
- 위치: `apps/builder/src/builder/workspace/canvas/catalog/CatalogCanvas.tsx`. 검증: canvas catalog 테스트 · type-check · live headed Playwright (body 2×2 grid, desktop → Mobile → desktop: 칸 폭 = body 절반 · 자식 = 칸 폭 5/5, 수정 전 3/5 실패 — Mobile 칸 960 = desktop 값).

## [grid 자식을 선택 · 크기 조절해도 부모 grid 칸 가이드가 보인다 — Figma] - 2026-10-16

### Fixed

- **grid 안 요소를 선택하거나 크기 핸들로 끄는 동안에도 부모 grid 의 칸 점선이 보인다** (Figma 와 같음). 종전엔 grid 자신을 선택 · hover 할 때만 칸이 보였고, 자식을 고르거나 그 크기를 끌기 시작하면 사라졌다 (사용자 보고).
- Why: overlay 가 칸을 선택 · hover 된 record 자신에게만 그렸고, drag 중에는 그 단계를 건너뛰고 drag 미리보기만 그렸다 — resize 미리보기에는 칸이 없었다.
- 수정: 선택 record 의 직속 부모도 칸 대상에 넣고 (`parentOf`), resize 미리보기가 부모 grid 의 칸 (`gridGuides`) 을 실어 같은 점선으로 그린다. 손자 선택 · 자식 hover 는 대상 아님.
- 위치: `apps/builder/src/builder/workspace/canvas/catalog/{catalogOverlay.ts,CatalogCanvas.tsx}` · `apps/builder/src/builder/catalogRuntime/canvasGesture.ts`. 검증: 테스트 2 (수정 빼면 RED) · canvas catalog · catalogRuntime 2,270 통과 · type-check · live headed Playwright (3×3 grid — 자식 선택 시 칸 9 · 손자 · grid 밖 형제 선택 시 0 · 자식 모서리 핸들 resize 중 칸 9, 캡처 확인 · 페이지 오류 0).

## [요소가 많은 페이지에서 끌기가 멈추던 것 — 등간격 스냅 탐색] - 2026-10-16

### Fixed

- **같은 열 · 행에 요소가 수백 개 있는 페이지에서 요소를 끌어도 화면이 멈추지 않는다.** 종전엔 평평한 5,000 요소 격자 (같은 열 ≈ 830) 에서 포인터를 움직일 때마다 수백 ms 가 걸렸다 — production 빌드 측정 drag 프레임 간격 p95 750 ms · 50 ms 넘는 작업 188 회 (75 s). 원인: 등간격 스냅의 sequence 탐색이 이웃 쌍마다 다른 이웃을 전부 다시 훑었다 (O(r³)). 이웃을 위치 순으로 정렬하고 접미사마다 끝이 가장 앞인 세 개를 미리 구해, 쌍 사이가 비었는지를 바로 판정한다. 흡착 위치 · 가이드 · 같은 거리일 때 어느 제안이 이기는지는 종전과 같다.
- 위치: `apps/builder/src/builder/workspace/canvas/interaction/snapGuides.ts` (`resolveSequenceSpacing`). 검증: 수정 전 구현을 옮긴 오라클과 무작위 4,000 건 동치 (흡착 사례 1,000 건 이상 · 변이 4 종 — 동률 순서 2 · 쌍 제외 · 오차 경계 — 모두 RED) · 같은 열 2,000 개 판정 2,449 ms → 200 ms 안 (수정 전 RED) · canvas · catalogRuntime 3,139 통과 (togglebuttongroup 기존 1건) · type-check · production 빌드 재측정 평평 5,000 drag p95 750 → 19 ms · 끊김 32.5 → 0.5 % · 50 ms 넘는 작업 0 (중첩 flex 5,000 은 p95 21 그대로) · live `canvas-spacing-snap-live.mjs` 4/4 (새 — B 뒤 같은 간격 자리로 흡착 · 간격 40 가이드 · ⌘ 대조군 283).

## [배포 빌드에서 패널 · 툴바 모양이 무너지던 것 — cascade layer 순서] - 2026-10-16

### Fixed

- **배포된 Builder 에서 패널 dock 의 여백, 상단 툴바 · 패널 rail 버튼의 크기 · 배경 · 둥근 모서리가 dev 와 같게 나온다.** 종전엔 production 빌드에서만 Navigator 가 (36,66) 에 붙고 (dev 48,48), 툴바 버튼이 높이 16 · 배경 없음 · 글자 16px 로 그려졌다. 원인: production 은 공용 CSS chunk (LoadingSpinner · overlay · EmptyState · AIPanel) 를 main CSS 보다 먼저 `<link>` 하는데, 그 chunk 의 `@layer builder-system{…}` · `@layer components{…}` 가 두 레이어를 먼저 등록해 `index.css` 의 순서 선언이 늦었다 — Tailwind 리셋 (`base`) 이 builder 스타일을 이겼다. dev 는 `index.css` 가 먼저라 드러나지 않았다. Builder `index.html` (와 `404.html`) 의 head 맨 앞에 `index.css` 의 순서 선언을 인라인으로 둔다 (목록은 `index.css` 에서 읽는다). preview.html 은 첫 CSS 가 자기 순서를 선언해 영향 없다.
- 위치: `apps/builder/src/cascadeLayerOrder.ts` · `apps/builder/vite.config.ts` (`cascadeLayerOrderPlugin`). 검증: 단위 3 (구현 전 RED) · type-check · live — 같은 시나리오 (새 프로젝트 + Navigator · Design) 에서 dev ↔ production 빌드의 계산 스타일을 요소마다 비교해 수정 전 140 요소 → 수정 후 2 요소 (프로젝트 이름 글자 폭 — 이름에 시각이 들어감), 스크린샷 확인.

## [grid — 여러 행 크기 요소는 행이 모두 grid 안인 칸에만 놓인다] - 2026-10-16

### Fixed

- **두 행 크기 요소를 마지막 행 위로 끌면, 두 행이 모두 grid 안인 자리 (한 행 위) 에 놓인다.** 종전엔 마지막 행에 놓여 둘째 행분이 높이 0 의 암묵 행이 되고 요소가 grid 아래로 넘쳤다 — 그 부분에는 칸도 그려지지 않았다 (사용자 보고 「다시 grid 내에 배치는 되지만 1칸 이상 그려지지 않음」, 실제 Chrome 재현: 2×2 요소를 셋째 행에 → 행 4 높이 0). 빈 칸 판정에서 그려진 행 밖은 비어 있지 않은 것으로 본다 (끝까지 찬 grid 에 붙는 덧붙임 행은 그대로 쓸 수 있다).
- 위치: `apps/builder/src/builder/catalogRuntime/canvasGesture.ts` (`gridTarget` 의 `free`). 검증: 테스트 1 (수정 빼면 RED) · catalogRuntime · workspace 통과 (togglebuttongroup 기존 1건) · type-check · live `grid-span-fit-live.mjs` 3/3 (새 — 모서리 핸들로 240 × 200 snap 뒤 마지막 행 위로: 둘째 · 셋째 행 자리 · grid 300 그대로, 캡처 확인) · `grid-cell-placement-live` 9/9 · `canvas-dnd-drop-rules-live` 7/7.

## [grid 안 요소의 크기 핸들이 칸 경계에 snap 한다] - 2026-10-16

### Added

- **grid 안 요소를 크기 핸들로 늘리고 줄일 때, 움직이는 가장자리가 칸 경계선 (가로 · 세로) 에 붙는다** (임계 = 다른 snap 과 같은 화면 px). 크기만 바뀌고 차지하는 칸 수 (span) 는 그대로다. 비율 잠금 · Snap 설정 끔 · ⌘/Ctrl 은 snap 하지 않는다.
  - **Why**: 사용자 보고 「세로 2칸은 snap 이 안 된다」. 크기 조절에는 snap 이 아예 없었다 — 가로는 옆 요소 가장자리가 마침 칸 경계에 있어 맞아 보였을 뿐이다.
- 위치: `apps/builder/src/builder/catalogRuntime/canvasGesture.ts` (`snapResizeToCells`). 검증: 테스트 1 (아래 가장자리 197 → 200 · 150 은 그대로) · catalogRuntime · workspace · type-check · live `grid-cell-placement-live.mjs` 9/9 (새 7 — 실제 모서리 핸들을 두 행 경계 3px 앞까지: 높이 200 · span 없음 · Preview DOM = Canvas).

## [grid 안 요소를 핸들로 늘리면 요소만 커진다 — span 자동 계산 제거] - 2026-10-16

### Changed

- **grid 안 요소를 크기 핸들로 늘려도 차지하는 칸 수 (span) 를 바꾸지 않는다** — 요소만 커지고 칸 · 형제는 그대로다 (사용자 결정 「핸들 span 계산은 빼고 요소만 늘어나게」). 같은 날 앞 엔트리에서 넣은 「핸들로 두 칸 크기로 늘리면 두 칸 차지」 를 뺐다. 칸 수는 drop (고정 크기 요소) 과 Layout 의 가로 칸 수 · 세로 칸 수로만 바뀐다.
- 위치: `apps/builder/src/builder/catalogRuntime/canvasGesture.ts` (`resizeSpanCommands` 삭제). 검증: 테스트 1 (B 대신 a 를 400 으로: span 없음 · 칸 · 형제 그대로) · catalogRuntime · workspace 통과 · type-check · live `grid-cell-placement-live.mjs` 8/8 (새 6 — 실제 모서리 핸들 drag 로 B 120 → 240: span 없음 · 칸 폭 120 그대로).

## [grid 안 요소를 크게 늘려도 칸 · grid 크기는 그대로 — Figma 기준] - 2026-10-16

### Fixed

- **grid 안 요소의 width · height 를 크게 늘려도 내부 칸이 grid 의 정해 둔 크기를 벗어나지 않는다** — 요소만 커져 칸을 넘친다 (사용자 보고 · Figma 는 요소만 늘어나고 grid 는 그대로).
  - **원인**: Layout 섹션의 Columns · Rows 가 `repeat(n, 1fr)` 를 썼다. CSS 의 단독 `1fr` 은 `minmax(auto, 1fr)` — 최소가 안 요소의 크기라, 요소가 커지면 칸이 따라 커져 격자가 grid 밖으로 나갔다 (Canvas 엔진 · Chrome 모두 같은 결과 — 엔진 결함 아님).
  - 이제 개수 n 은 `repeat(n, minmax(0, 1fr))` (칸이 grid 크기만 나눈다). Display 의 Grid 를 켤 때의 2열도 같다. Canvas 의 칸 윤곽도 `minmax(0, …)` 트랙은 요소 크기로 늘리지 않는다.
  - 이전에 만든 `repeat(n, 1fr)` grid 는 그대로 두고 (옛 문서 전환 코드 없음 — 사용자 지시), Columns · Rows 칸이 그 값을 글자로 보여 준다. 개수를 다시 넣으면 새 형식으로 바뀐다.
- 위치: `apps/builder/src/builder/panels/styles/utils/gridTracks.ts` (새 — `gridTrackTemplate` · `gridTrackCount` · `gridTemplateOf`) · `sections/LayoutSection.tsx` · `hooks/useStyleActions.ts` · `catalogRuntime/canvasGridCells.ts` (`zeroMin`). 검증: Rust `minmax_zero_fr_tracks_keep_the_grid_size` (360 · 3열 · 600×500 아이템 → 120 · 100 유지) · `gridTracks.test.ts` · 칸 윤곽 테스트 1 · builder 5844 통과 (togglebuttongroup 기존 1건) · type-check · live `layout-display-grid-live.mjs` 9/9 (새 2d — 패널로 만든 3×3 grid 의 A 를 600 × 300 으로: 칸 9 · grid 400 × 200 · B 자리 그대로, 캡처로 A 만 grid 밖으로 넘침 확인 · Preview DOM 위치 = Canvas).

## [grid — 두 칸 크기 요소는 칸을 늘리지 않고 두 칸을 차지한다] - 2026-10-16

### Fixed

- **grid 에 두 칸 크기의 요소를 놓거나 그 크기로 늘리면, 칸이 넓어지지 않고 요소가 두 칸을 차지한다** (사용자 지적 — Figma 는 칸을 합치지 않고 요소가 2칸 자리를 차지한다; 지금은 grid 칸이 늘어났다).
  - 놓을 때: 고정 크기 축(px)이 덮는 칸 수만큼 `span n` (`grid-column-end` · `grid-row-end`) 을 저장하고, 놓을 자리 표시도 그 칸들을 합친 넓이다. 그 칸들이 모두 비어 있는 자리만 빈 칸 drop 대상이 된다. 채우기 · 내용 맞춤 축은 칸을 따르므로 1칸. 같은 grid 안에서 옮기면 작성한 span 보다 줄이지 않는다.
  - 핸들로 크기를 바꿀 때: 새 크기가 덮는 칸 수로 span 을 맞춘다 (줄이면 줄어든다). — 같은 날 뺐다 (위 엔트리, 사용자 결정).
  - **엔진**: 여러 트랙을 걸친 아이템의 기여를 시작 트랙 하나에 통째로 넣고 있었다 — `repeat(3, 1fr)` 600 grid 에서 폭 400 · `span 2` 아이템이 첫 열을 400, 나머지를 100 · 100 으로 만들었다 (Chrome 200 · 200 · 200). 정해진 축의 열 · 행 기여를 CSS-GRID-1 §12.5.1 대로 고쳤다 — `fr` 트랙을 지나는 걸친 아이템은 기여하지 않고, 그 밖은 걸친 트랙 + gap 보다 모자란 만큼만 균등 분배 (`spread_spanning_contributions`). 그래서 패널에서 가로 칸 수 2 를 준 넓은 요소도 Canvas 와 Preview 가 같다.
- Layout 섹션의 칸 수 이름을 「열 병합 · 행 병합」 에서 **「가로 칸 수 · 세로 칸 수」 (Span X · Span Y)** 로 바꿨다 — 칸을 합치는 것이 아니라 요소가 차지하는 칸 수다.
- 위치: `packages/engine/src/tree.rs` (`solve_grid` 열 · 행 기여 · `spread_spanning_contributions`) · `apps/builder/src/builder/catalogRuntime/canvasGridCells.ts` (`coveredSpan` · `GridLayout.tracks`) · `canvasGesture.ts` (`itemSpan` · `resizeSpanCommands` · `gridLineCommands` 의 span 쓰기) · `panels/styles/sections/LayoutSection.tsx`. 검증: Rust 457 (새 `spanning_item_does_not_grow_its_start_track` — 수정 빼면 RED) · drop · 크기 조절 새 테스트 2 (span 계산 빼면 각각 RED) · builder 5841 통과 (togglebuttongroup 기존 1건) · parity 811 · type-check · live `grid-cell-placement-live.mjs` 7/7 (새 5 — 폭 240 요소를 밖에서 셋째 행 첫 칸에: 두 칸 자리 표시 · `span 2` · 칸 폭 120 그대로 · Preview DOM = Canvas) · `layout-display-grid-live` 8/8 · `canvas-dnd-drop-rules-live` 7/7 (1b 는 한 칸 크기 S 로 — 폭 300 W 는 이제 180 칸 두 개를 차지해 한 칸짜리 빈 자리에 들어가지 않는다).

## [grid 빈 칸에 놓기 · 칸 병합 — Figma 기준] - 2026-10-16

### Added

- **grid 의 빈 칸 어디에나 놓을 수 있다 — 순서대로가 아니라 칸을 건너뛰어도 그 칸에 남는다.** 끄는 요소를 빈 칸에 놓으면 그 칸 번호를 `gridColumnStart` · `gridRowStart` 로 저장한다 (활성 breakpoint 층). 그 이동 때문에 자리가 밀릴 형제는 지금 칸에 함께 고정해 제자리에 두고, 원래 칸은 빈 채로 남는다 (Figma — grid 자식은 자기 칸을 가진다). 여러 개를 끌면 그 칸부터 읽는 순서로 다음 빈 칸에 차례로, Alt 복제도 같은 칸에 놓인다. 문서 순서 (DOM · Layers) 는 칸의 읽는 순서를 따른다.
- 채워진 칸 위에 놓으면 지금처럼 그 항목 앞 · 뒤에 끼운다 (삽입선) — 고정돼 있던 요소는 고정을 풀고 그 순서로 들어간다. 다른 컨테이너로 옮겨도 고정은 지운다. 자기 칸 위에 놓으면 아무것도 바꾸지 않는다.
- **grid 의 자식을 고르면 Layout 섹션에 열 병합 · 행 병합 칸이 나온다** (같은 날 「가로 칸 수 · 세로 칸 수」 로 이름을 바꿨다 — 위 엔트리) — 차지할 칸 수 (1 – 6 프리셋, n > 1 → `grid-column-end` · `grid-row-end` 의 `span n`, 1 이나 비우면 제거). Canvas 의 칸 표시 · drop 판정도 병합을 읽는다: 여러 칸을 차지하는 요소는 그 칸이 모두 비어 있는 자리에만 놓이고, 놓을 자리의 표시도 그 칸들을 합친 넓이다.
  - **Why**: 빈 칸 drop 은 「마지막 항목 바로 뒤 칸」 만 가능했고 (자동 배치 순서), 칸을 건너뛴 배치와 두 칸 차지를 지정할 방법이 없었다 (사용자 요청). 노드 layout 에는 칸 번호 · 병합 필드가 이미 있고 레이아웃 엔진 · Preview CSS 도 읽었으나, Canvas 의 칸 계산은 항목을 문서 순서로 한 칸씩 채운다고 가정했다.
- 칸 계산은 CSS grid 배치 (row 흐름 · sparse) 를 따른다 — 칸 번호를 가진 항목 먼저, 행만 가진 항목, 나머지는 자동 배치 커서로 (병합 포함). 레이아웃 엔진 배치와 같은지 테스트가 실제 엔진으로 확인한다.
- 위치: `apps/builder/src/builder/catalogRuntime/canvasGridCells.ts` (`gridPlacement` · `gridLayout`) · `canvasGesture.ts` (`gridTarget` · `gridLineCommands` · `copyCommand`) · `panels/styles/sections/LayoutSection.tsx` (`GridSpanField`) · `packages/shared/src/types/responsive.types.ts` (`gridColumnEnd` · `gridRowEnd` → 패널 편집 집합). i18n: 「Row span」 = 행 병합 (열 병합은 기존 키). 검증: 새 테스트 7 (drop 3 — 비순차 빈 칸 · 형제 고정 · 병합 · 복제, 배치 4) · 형제 고정 원복 RED · builder 5839 통과 (togglebuttongroup 1건 기존 실패) · type-check · live `grid-cell-placement-live.mjs` 6/6 (실제 마우스 drag · 패널 입력 · Preview DOM 위치 · 폭 = Canvas) · `canvas-dnd-drop-rules-live` 7/7 · `canvas-dnd-presentation-live` 7/7 · `layout-display-grid-live` 8/8.
- 남은 것: grid 밖으로 끌어낸 요소의 원래 칸 뒤 형제는 지금처럼 당겨진다 (고정은 빈 칸 drop 에서만) · 병합을 Canvas 핸들 drag 로 늘리는 것 (Figma 의 칸 스냅 리사이즈) 은 없다.

## [grid 칸 윤곽이 열 · 행에 고르게 나뉜다 — 빈 행이 위로 쏠리던 것] - 2026-10-15

### Fixed

- **grid 의 칸 윤곽이 열 · 행 트랙에 고르게 나뉜다.** 항목이 없는 행(빈 grid · Rows 템플릿의 빈 행)이 앞 행 높이, 선택 표시에서는 0 으로 잡혀 칸 선이 grid 위쪽에 겹쳐 그려졌다 (사용자 보고). 이제 두 축 모두 CSS 트랙 크기 규칙(흔한 경우)으로 계산한다 — px · % 고정, `fr` 은 남는 공간을 비율로, `auto` 는 가장 큰 항목 + (`fr` 트랙이 없으면) 남는 공간의 같은 몫. 템플릿 밖의 행은 암묵 `auto` 행.
- 칸 윤곽이 선택 · hover 에 매 프레임 비용을 더하지 않는다 — grid 레코드 목록은 문서 단계 · root 변경 때만 (scene 이 이미 읽은 root 로) 모으고, 칸은 scene 이 바뀔 때까지 레코드별로 둔다. 칸이 없는 (grid 가 아닌) 선택 · hover 는 페이지 가림 조회도 하지 않는다. **Why**: 성능 게이트 (ADR-246) 의 select 카운트 `workspace.ts#get root` 가 1797 → 1887 로 올라 push 가 막혔다 — 주 원인은 grid 아닌 선택에도 매 프레임 부른 `occludersOf` (페이지 가림 — root 조회) 였다 (칸 연결을 뺀 HEAD 는 pass · 선택 20회 probe 에서 목록 재수집 1회로 확인). 수정 뒤 1797 (pass).
- 위치: `apps/builder/src/builder/catalogRuntime/canvasGridCells.ts` (`sizeTracks` · `trackKind`) · `workspace/canvas/catalog/CatalogCanvas.tsx` (`cellsVersion` 캐시 · dev handle `canvas.gridCells`). 검증: `canvasGridCells.test.ts` 8 (새 — 빈 3×3 · auto 행 균등) · builder 5832 통과 (togglebuttongroup 1건 기존 실패) · type-check · live `layout-display-grid-live.mjs` 8/8 (새 2c — Rows 3 → 칸 9 · 행 60 · 마지막 행이 grid 아래 끝, 캡처로 3×3 확인) · `canvas-dnd-drop-rules-live.mjs` 7/7.

## [grid 를 선택 · hover 하면 칸 윤곽 — Figma 기준] - 2026-10-15

### Added

- **grid 컨테이너를 선택하거나 마우스를 올리면 모든 칸(빈 칸 포함)의 윤곽을 점선으로 그린다.** 칸은 열 템플릿 트랙과, 늘어난 행 트랙 전체(항목이 행보다 짧아도 행 끝까지 · 마지막 행은 내용 영역 끝까지)다. 행 템플릿(`gridTemplateRows`)에 항목 없는 행이 있으면 그 칸도 그린다. 끄는 동안에는 drop 대상의 칸 표시가 대신한다.
  - **Why**: Figma 는 grid 오토레이아웃 프레임에서 칸 영역을 보여 준다 (사용자 지적 · Figma 선택 화면 캡처에서 행 경계선 확인). drag 중 칸 윤곽도 같은 계산을 써서, 키가 고정된 grid 에서 짧은 항목의 행이 항목 높이로 그려지던 것도 함께 바로잡았다.

### Fixed

- 앞 엔트리 (`9c35d462f`) 에서 돌리지 않은 테스트 2 묶음을 맞췄다 — Layout 의 Block 버튼이 Grid 버튼이 된 것 (`phase4eStylesDirection.test.tsx`) · AI manifest 의 css 목록에 `gridTemplateColumns` · `gridTemplateRows` 가 더해진 것 (패널이 편집하므로 AI 도 같은 키를 쓴다, `adr254HeadingOrigin.test.ts`).
- 위치: `apps/builder/src/builder/catalogRuntime/canvasGridCells.ts` (`rows` · `appendRow` · 행 늘이기) · `canvasGesture.ts` (`gridCellsOfRecord`) · `workspace/canvas/catalog/catalogOverlay.ts` · `CatalogCanvas.tsx`. 검증: builder 5831 통과 (togglebuttongroup 1건 기존 실패) · shared 1713 · type-check · live `layout-display-grid-live.mjs` 7/7 (새 2b — 선택된 3열 grid 의 빈 칸 경계에 점선 화소, 캡처로 3×2 칸 확인) · `canvas-dnd-drop-rules-live.mjs` 7/7.

## [Design 패널 Layout — Display 에 grid 추가 · grid 의 Columns · Rows · Gap X · Gap Y] - 2026-10-15

### Changed

- **Layout 섹션의 「Direction」 이 「Display」 로 바뀌고 버튼이 grid · row · column 세 개가 된다.** 선택을 모두 끄면 block 이다 (block 버튼은 없어졌다). 방향이 속성으로 정해지는 컴포넌트 (ToggleButtonGroup · Toolbar · RadioGroup · CheckboxGroup …) 는 지금처럼 row · column 만 고를 수 있다 — grid 는 비활성, 선택 비움은 무시.
- **grid 를 켜면 display grid + 2열 (`repeat(2, 1fr)`, 열이 이미 있으면 그대로) 로 시작한다.** flex 의 방향 · 정렬 · 줄바꿈 값은 지운다.
- **grid 일 때 Alignment 자리에 Columns · Rows, Wrap 자리에 Gap X, Gap 자리에 Gap Y 가 나온다.** Columns · Rows 는 Gap 과 같은 콤보 (1 – 6 프리셋, 숫자 n → `repeat(n, 1fr)`, 비우면 제거 — Rows 는 `auto`). `200px 1fr` 처럼 개수로 나타낼 수 없는 값은 글자 그대로 보이고 덮어쓰지 않는다. Gap X · Gap Y 는 `columnGap` · `rowGap`. Space 는 grid 에서 지금처럼 비활성 (Masonry 는 엔진 미지원이라 보류 — 사용자 결정).
  - **Why**: 패널에 grid 를 켤 방법이 없었고, grid 요소를 고르면 Alignment · Space · Wrap 이 비활성으로만 보였다 (사용자 지적).
- **Columns · Rows 프리셋 메뉴는 1 … 6 개수 하나씩만 보인다.** 프리셋 메뉴가 「이름 · 값」 (「XS · 4」) 으로 그려 이름이 곧 값인 개수가 「1 · 1」 로 보였다 (사용자 지적) — 이름과 값이 같으면 하나만 (`PropertyUnitInput`, 다른 프리셋 메뉴는 그대로).
- 위치: `apps/builder/src/builder/panels/styles/sections/LayoutSection.tsx` · `hooks/useStyleActions.ts` (`handleFlexDirection` — grid · 빈 선택 = block) · `hooks/useLayoutAuxiliary.ts` (`useFlexDirectionKeys` — grid · 선택 없음) · `hooks/useLayoutValues.ts` · `components/styles/inspector-layout.css` · `i18n` (Display · Columns · Gap X · Gap Y) · `packages/shared/src/types/responsive.types.ts` (grid 트랙 2 키를 패널 편집 집합으로 이동 — breakpoint override 그대로 허용). 검증: panels + components + i18n 1323 통과 (새 3 · 고친 3) · shared types 12 · type-check · live `apps/builder/scripts/layout-display-grid-live.mjs` 5/5 (headed Chrome 실제 패널 클릭 · 입력: Grid → grid · 2열 · 칸 4종 / Columns 3 · Gap X 20 · Gap Y 10 → Canvas 3열 · 열 간격 20 / Preview DOM 자식 위치 = Canvas / Grid 다시 누름 → block).

## [grid 로 끌 때 칸 윤곽 · 빈 칸 채움 — Figma 실측 기준] - 2026-10-15

### Changed

- **grid 컨테이너 위로 끄는 동안 모든 칸(빈 칸 포함)의 윤곽을 그린다.** 칸 크기는 열 템플릿(px · fr · % · `repeat(n, …)`)에서 구하고, 내용 크기 열(`auto` 등)만 그 열 항목의 상자를 쓴다. 행은 그 행 항목들에서, 항목 없는 행은 앞 행의 높이.
- **마지막 항목 뒤로(빈 칸으로) 들어갈 때는 삽입선 대신 들어갈 빈 칸을 채워 보인다.** 포인터가 빈 칸 위에 있으면 그 칸으로 들어간다 (앞쪽의 가까운 항목 사이로 끼지 않는다).
- **채워진 칸 사이는 세로 삽입선** — 같은 행 두 칸 사이 = gap 가운데, 행 시작 = padding 가운데, 행 끝 = 다음 열이 있으면 gap 가운데 · 마지막 열이면 padding 가운데. 앞 · 뒤는 칸이 아니라 항목 자신의 가운데로 가른다.
  - **Why**: grid 는 칸 사이 선만 그려 빈 칸으로 들어갈 때 위치가 보이지 않았고, 빈 칸 위에 놓아도 가장 가까운 항목 사이로 끼었다. Figma (grid auto-layout, padding 40 · 열 gap 30, 실제 마우스) 실측: 끄는 동안 모든 칸 윤곽 · 칸 사이 = gap 가운데 세로선 (칸 높이) · 첫 칸 앞 = padding 가운데 · 마지막 항목 뒤 = 다음 빈 칸 채움.
- 위치: `apps/builder/src/builder/catalogRuntime/canvasGridCells.ts` (새 — 칸 기하, overlay 전용 · 레이아웃 입력 아님) · `canvasGesture.ts` (`gridDrop` · `gridCellsOf` · grid `flowSlot` · grid 삽입선) · `workspace/canvas/catalog/catalogOverlay.ts`. 검증: `canvasGridCells.test.ts` 5 · `phase4eCanvasGesture.test.ts` 27 (새 1) · catalogRuntime + canvas 3122 통과 (togglebuttongroup 1건 기존 실패) · type-check · live `canvas-dnd-drop-rules-live.mjs` 7/7 (새 1b — 빈 칸 위 = 칸 윤곽 4 + 칸 채움 · 선 없음, A 왼쪽 = 선) · `canvas-dnd-presentation-live.mjs` 7/7.

## [삽입선이 drop 대상의 gap · padding 을 따른다 — Figma 실측 기준] - 2026-10-15

### Fixed

- **drop 대상에 gap · padding 이 있으면 삽입선이 그 값을 무시하던 것.** 이제 삽입선은 padding 안쪽(내용 시작)에서 시작하고, 길이는 끄는 요소의 폭(세로 흐름) · 높이(가로 흐름)다. 흐름 방향으로는 첫 자식 앞 = gap 의 절반 위, 자식 사이 = gap 가운데, 마지막 자식 뒤 = gap 의 절반 아래에 그린다. 들어갈 컨테이너의 테두리도 삽입선과 같은 굵기(2px)로 그린다.
  - **Why**: 삽입선이 첫 · 마지막 자식의 가장자리에 붙고 자식 폭만큼만 그려져 padding · gap 이 있는 컨테이너에서 어디로 들어가는지 어긋나 보였다(사용자 지적). 같은 컨테이너 안 재정렬의 형제 비킴도 gap 을 앞 두 자식 사이를 재서 구해, 자식이 하나뿐이면 gap 0 으로 자리를 열었다 — 이제 작성한 gap(축 longhand 우선)을 읽는다. Figma 실측(padding 40 · gap 30 세로 auto-layout, 실제 마우스): 첫 자식 15px 위 · gap 가운데 · 선 시작 = padding 안쪽 · 선 길이 = 끄는 요소 폭.
- 위치: `apps/builder/src/builder/catalogRuntime/canvasGesture.ts` (`insertionLine` · `contentBox` · `flowGap` · `layoutFlow`) · `workspace/canvas/catalog/catalogOverlay.ts`. 검증: `phase4eCanvasGesture.test.ts` 26 (새 1 — padding 40 · gap 30 의 세 자리) · catalogRuntime + canvas 3116 통과 (togglebuttongroup 1건 기존 실패) · type-check · live `canvas-dnd-presentation-live.mjs` 7/7 (padding 24 · gap 20 컨테이너로 끄는 중 선 x = padding 안쪽 · y = D 끝 + 10 · 폭 = 끄는 B 폭).

## [다른 컨테이너로 끌 때 삽입선 · 컨테이너 테두리 — Figma · pen.dev 실측 기준] - 2026-10-15

### Changed

- **다른 컨테이너로 끌면 그 컨테이너의 형제는 비키지 않고, 들어갈 자리에 삽입선을 그리며 컨테이너에 선택색 테두리를 그린다.** 끄는 요소는 반투명(50%)으로 그린다. 원래 컨테이너는 바로 닫힌다.
- **같은 컨테이너 안에서 순서를 바꿀 때는 지금처럼 형제가 비켜 빈 자리를 연다.** 이때는 선 · 테두리 없이 불투명하게 그린다.
- **빈 컨테이너에 놓을 때 삽입선이 padding 안쪽, 내용이 시작하는 자리에 그려진다.** 전에는 테두리 가장자리에 붙었다.
  - **Why**: 다른 컨테이너로 옮길 때도 형제를 비키게 하고 삽입선을 숨겨, 어디로 들어가는지 정확히 보이지 않았다(사용자 지적). Figma · pen.dev 데스크톱/웹에서 실제 마우스로 끌어 확인한 결과 두 도구 모두 같은 컨테이너 안에서만 형제를 비키게 하고, 다른 컨테이너에서는 형제를 그대로 둔 채 삽입선과 컨테이너 테두리로 위치를 보여 준다(Figma 는 끄는 요소도 반투명). Framer 는 같은 컨테이너에서도 형제를 비키게 하지 않는다 — 따르지 않음(사용자 결정).
- 위치: `apps/builder/src/builder/catalogRuntime/canvasGesture.ts` (`reflows` — 자기 흐름일 때만 · `dragPresentation().outside` · preview `container` · 빈 컨테이너 `insertionLine`) · `workspace/canvas/catalog/CatalogCanvas.tsx` (반투명 값) · `catalogOverlay.ts` (컨테이너 테두리) · `workspace/canvas/skia/nodeRendererTree.ts` · `renderCommands.ts` (drag 요소 alpha). 검증: `phase4eCanvasGesture.test.ts` 25 통과 (새 2 — 다른 컨테이너 · 빈 컨테이너) · catalogRuntime + canvas 3115 통과 (togglebuttongroup 1건 기존 실패) · type-check · live `apps/builder/scripts/canvas-dnd-presentation-live.mjs` 6/6 (headed Chrome · 실제 마우스: 다른 컨테이너 drag 중 E 자리 화소 = E 색 · 끄는 B 화소 = 반투명 혼색 · 놓은 뒤 T = [D, B, E]).
  - 측정 함정: OS 커서가 Playwright 창 위에 있으면 스크린샷 순간 그 위치의 `pointermove` 가 끼어들어 drop 이 엉뚱한 곳으로 간다 (live 4/6 → 커서를 창 밖으로 옮긴 뒤 6/6).

## [drag 중 거리 · 중심선 자동 표시 — absolute 거리 · 흐름 중심선] - 2026-10-15

### Added

- **absolute 로 놓이는 요소를 끄는 동안 네 변의 거리를 숫자와 함께 자동으로 그린다** — 각 방향에서 마주 보는 가장 가까운 형제까지, 없으면 부모 가장자리까지. 기존 정렬선 · 중심선 · 등간격 흡착과 함께 보인다. Control drag 로 다른 컨테이너에 absolute 로 넣을 때도 그 컨테이너 기준으로 그린다.
- **흐름(row · column · grid) 요소를 끌 때 끄는 요소의 중심이 놓일 컨테이너의 중심과 맞으면 중심선을 그린다** — 표시만 하고 흡착하지 않는다 (임계 5 화면 px). 형제가 비키며 놓일 자리를 보여 주므로 거리는 그리지 않는다.
  - **Why**: 거리 측정 (⌥ + hover) 과 복제 (⌥ + drag) 가 같은 키라 끄는 중에는 거리를 볼 방법이 없었다 (사용자 지적). 끄는 동안은 키 없이 자동으로 보여 주고, ⌥ 는 정지 상태 측정 · 복제에만 쓴다 (사용자 결정).
- 위치: `apps/builder/src/builder/workspace/canvas/interaction/measureGuides.ts` (`resolveDragDistanceGuides`) · `snapGuides.ts` (`resolveCentreGuides`) · `catalogRuntime/canvasGesture.ts` (`dragGuides` → preview `distances` · `snapGuides`) · `workspace/canvas/catalog/catalogOverlay.ts`. 검증: 단위 `measureGuides.test.ts` +3 · `snapGuides.test.ts` +2 · `phase4eCanvasGesture.test.ts` +2 · type-check · live `apps/builder/scripts/canvas-dnd-guides-live.mjs` 5/5 (headed Chrome · 실제 마우스: absolute drag 중 거리선 · 숫자 4개 (형제 160 · 부모 160 · 71 · 179) · 흐름 drag 중심 일치 시 중심선 · 벗어나면 0 · ⌥ hover 정지 측정 유지).

## [drag 중 실제 요소 표현 · 형제 비킴 (Figma · Pen.dev)] - 2026-10-15

### Changed

- **Canvas 에서 요소를 끄는 동안 테두리 상자 대신 요소 자체가 포인터를 따라 그려진다** — 다른 요소 위 · 부모의 잘림 밖에도 그린다 (맨 위 층). 원래 자리의 선택 상자는 숨고, 끄는 요소에는 선택 테두리가 따라간다. Alt 복제는 원본이 제자리에 남으므로 전처럼 반투명 상자.
- **row · column 흐름 안팎으로 끄면 형제가 비킨다** — 빠진 자리를 메우고 놓일 자리를 연다 (약 120 ms 에 걸쳐 부드럽게). 열린 자리가 위치를 보여 주므로 이때는 삽입선을 그리지 않는다. grid 는 칸 사이 삽입선을 그대로 쓴다. Framer 처럼 원래 자리를 비워 두는 방식은 따르지 않는다 (사용자 결정).
  - **Why**: ADR-248 전환 (2026-10-02) 에서 옛 drag 표현 (끄는 요소 그림 · 형제 보간 · 삽입 표시) 을 지우고 테두리 ghost 로 대체했다. 렌더러의 offset 자리 (`setDragVisualOffset` · `setDragSiblingOffsets`) 는 남아 있었으나 부르는 곳이 없었다.
- 위치: `apps/builder/src/builder/catalogRuntime/canvasGesture.ts` (`dragPresentation` · `layoutFlow`) · `workspace/canvas/catalog/CatalogCanvas.tsx` (drag 시작 · 끝에 맨 위 층 재구성, 프레임마다 offset 반영) · `catalogDragReflow.ts` (보간) · `catalogOverlay.ts`. 검증: `phase4eCanvasGesture.test.ts` 새 3건 (형제 목표 offset · 다른 컨테이너 · Alt · grid) · builder 5810 통과 (togglebuttongroup 1건 기존 실패) · type-check · live `apps/builder/scripts/canvas-dnd-presentation-live.mjs` 3회 연속 4/4 (headed Chrome · 실제 마우스: drag 중 포인터 자리 픽셀 = A 의 빨강 · A 원래 자리 = 올라온 B 의 파랑 · 놓은 뒤 [B, C, A]). 수정 직후 첫 실행 1회에 A 가 엉뚱한 자리에 그려진 적이 있으나 이후 4회 재현되지 않음 (HMR 중이었던 것으로 추정 — 미확정).

## [Canvas drop 규칙 — grid · 크기 · ⌘ · Control (Figma 기준)] - 2026-10-15

### Added

- **Control drag 로 놓은 자리에 absolute 로 두기 (Mac)** — flow 컨테이너 안팎으로 끌다가 Control 을 누르면 놓은 위치를 그 컨테이너 기준 absolute 좌표로 둔다 (컨테이너의 맨 앞 · fill 축은 그려진 px). Figma 의 Ignore auto layout · Framer 의 ⌃ drag 와 같은 키 · 같은 뜻.
- **끄는 객체가 컨테이너보다 크면 그 안에 넣지 않음 · ⌘ (Windows Ctrl) 로 우회** — 어느 한 변이라도 크면 그 컨테이너를 건너 조상에 놓인다 (Figma). 원래 부모 안 순서 바꾸기는 그대로.

### Fixed

- **grid 컨테이너에 놓을 때 위치가 세로 목록처럼 정해지던 문제** — 이제 커서에 가장 가까운 칸 객체 사이 (행 우선 순서) 로 들어가고 삽입선이 칸 사이 세로선으로 그려진다 (Figma). 가로 줄바꿈 flex 도 같다.
  - **Why**: drop 판정이 flex row 만 가로로 보고 grid 는 세로 목록으로 셌다 (ADR-248 전환 때 옛 판정기를 단순 판정으로 바꾸며 생김).
- **absolute 형제가 삽입 위치 · 선을 끌어가던 문제** — absolute 로 놓인 형제는 흐름 순서에 끼지 않는다. 삽입선은 형제 사이 간격의 가운데에 그린다.
- **absolute 자식을 둔 frame · Group 등의 Preview 위치가 Canvas 와 다르던 문제** — DOM 부모에 위치 기준 (`position: relative`) 이 없어 자식이 page body 기준으로 놓였다. 이제 absolute 자식을 둔 구조 컨테이너는 위치 기준이 되고, 자식의 absolute 여부가 바뀌면 부모도 다시 그린다.
  - **Why**: 레이아웃 엔진은 absolute 자식을 늘 부모 기준으로 놓는데 DOM 부모만 위치 기준이 아니었다 (Position 토글로도 재현).
- 위치: `apps/builder/src/builder/catalogRuntime/canvasGesture.ts` (`flowSlot` · `flowEntries` · `documentIndex` · `insertionLine` · 크기 규칙 · `placeAbsoluteCommand`) · `workspace/canvas/catalog/CatalogCanvas.tsx` (⌘ · Control 전달) · `packages/shared/src/catalog/runtime/domBinding.runtime.ts` (`containingBlock`) · `compositionRoot.ts` (부모 알림). 검증: `phase4eCanvasGesture.test.ts` 새 4건 · `absoluteChildContainingBlock.test.tsx` (모두 수정 전 RED) · shared 1713 · builder 5807 통과 (`resolveContainerStylesFallback` togglebuttongroup 1건은 기존 실패) · type-check · live `apps/builder/scripts/canvas-dnd-drop-rules-live.mjs` 6/6 (실제 마우스 · 키: grid [A,C,B] · W→S 거부 · ⌘ 로 들어감 · Control drop placement 70,90 · Compare Mode Preview DOM offset 70,90 = Canvas · 부모 relative).

## [Border 미리보기가 다른 축을 기본값으로 바꾸던 문제] - 2026-10-15

### Fixed

- **Border Color 를 고르는 동안 두께가 얇아지고, Width 를 드래그하는 동안 색이 회색이 되던 문제** — 이제 미리보기 중에도 바꾸지 않은 축 (두께 · 색 · 스타일) 은 현재 값을 유지한다. 손을 놓은 뒤의 값은 전에도 맞았다.
  - **Why**: border 한 축을 쓸 때 비어 있는 축을 기본값 (스타일 solid · 두께 1px · 색 `#d4d4d4`) 으로 채우는 짝 쓰기가, commit 은 노드의 현재 값을 보고 판단했지만 미리보기는 현재 값 없이 판단해 이미 있는 축까지 기본값으로 덮었다.
- 위치: `apps/builder/src/builder/panels/styles/catalog/catalogStylesHost.ts` (`previewStyle` — 쓰기를 record 마다 그 `visual` 로). 검증: `elementlessNodeStyles.test.tsx` (수정 전 RED) · panels · catalogRuntime 3309 통과 · live (Mobile, Menu 의 Button): Width 4 · Color FF0000 뒤 Width 드래그 중 색 `#FF0000` 유지 · ColorArea 드래그 중 두께 11 유지.

## [Tablet · Mobile 에서 Styles 드래그 미리보기가 그려지지 않던 문제] - 2026-10-15

### Fixed

- **breakpoint 를 Tablet · Mobile 로 바꾼 뒤 Design 패널에서 Border width · style · color · Fill 을 바꾸는 동안 Canvas 에 변화가 없고 손을 놓은 뒤에야 반영되던 문제** — 이제 드래그 · 색 선택 중에도 그려진다. 테마를 바꾼 뒤에도 같았다. 모든 요소에 해당 (보고는 Menu 의 Button).
  - **Why**: breakpoint · 테마를 바꾸면 Canvas 가 그리는 root 가 새로 만들어지는데, 미리보기를 듣는 구독 (`subscribePreviews`) 이 처음 root 에 남아 있었다. 미리보기 값은 새 root 의 record 에 들어갔지만 장면을 다시 그리라는 신호가 오지 않았다.
- 위치: `apps/builder/src/builder/workspace/canvas/catalog/CatalogCanvas.tsx` (`subscribeRoot` 콜백에서 미리보기 구독을 새 root 로 옮김). 검증: live Mobile 툴바 — 수정 전 드래그 중 새 root `previewListeners` 0 · Canvas 62×30 그대로 → 수정 후 1 · 드래그 중 84×52 (Menu 의 Button) · 90×52 (단독 Button) · type-check · canvas 스위트 891 통과 (togglebuttongroup 1건은 기존 실패).

## [instance 안 원본 자리의 breakpoint · layout 편집 반영] - 2026-10-15

### Fixed

- **Menu 안 Button 의 Border 를 Tablet · Mobile 에서 바꾸거나 margin 을 주면 반영되지 않던 문제** — 값은 문서 (Menu instance 의 그 자리 patch) 에 저장됐는데 Canvas · Preview 는 그리지 않았다. 이제 그 breakpoint 의 border width · style · color 와 margin 등 layout 이 record 에 실린다. Menu · Select · ComboBox · DatePicker 처럼 원본 안에 다른 원본 (Button · ListBox …) 을 둔 컴포넌트의 그 부품 전부에 해당한다.
  - **Why**: 그 자리는 안쪽 원본 (Button) 의 instance 라 해석한 값을 안쪽 원본의 루트로 넘기는데 (`instanceRoot`), 넘길 visual 키 목록에 breakpoint 층 키가 없었고 layout 은 patch 를 뺀 값을 넘겼다. desktop 의 visual 만 우연히 통과했다.
  - 이미 저장된 값은 별도 처리 없이 다시 보인다 (읽는 쪽만 고침).
- 위치: `packages/shared/src/catalog/resolution/resolver.ts` (중첩 원본 루트로 넘기는 visual 키 · layout). 검증: `elementlessNodeStyles.test.tsx` 2건 (수정 전 RED — mobile border · desktop / tablet margin) · shared 1713 · builder 5801 통과 (`resolveContainerStylesFallback` togglebuttongroup 1건은 수정 전 HEAD 에서도 실패 — 무관) · live: Mobile 툴바에서 Menu 의 Button Width 4 · Dashed · Color FF0000 → record · Preview `border: 4px dashed rgb(255,0,0)`.

## [요소 없는 노드의 Style 탭 — MenuTrigger 등은 안내만] - 2026-10-15

### Fixed

- **Menu 의 Button 을 Canvas 에서 클릭해 Radius · Border 를 바꿔도 반영되지 않던 문제** — 한 번 클릭은 instance 인 MenuTrigger 를 고르는데, MenuTrigger 는 RAC 처럼 자기 요소가 없어 (DOM 은 자식만, Canvas 는 `display: contents`) 그 Style 값이 어디에도 그려지지 않았다. 슬라이더 드래그 중의 미리보기만 보이고 놓으면 사라졌다. 이제 요소가 없는 노드 (MenuTrigger · DialogTrigger · TooltipTrigger · ContextualHelp · Autocomplete) 를 고르면 Design 패널 Layout · Style · Text 탭이 「화면에 상자가 없는 요소입니다 — 안의 요소를 선택해 편집하세요」 안내를 낸다. Screen 탭 (breakpoint 숨김) 은 자식 전체에 효과가 있어 남는다. Button 은 더블클릭 또는 Layers 로 골라 편집한다 (그 편집은 Canvas · Preview 에 반영 — live 확인).
  - **Why**: Design 패널이 노드에 상자가 있는지 보지 않고 모든 노드에 같은 Style 필드를 냈다.
- 위치: `packages/shared/src/catalog/runtime/elementless.ts` (`catalogElementlessType` — rule 루트 `display: contents` 에서 파생) · `apps/builder/src/builder/panels/styles/StylesPanel.components.tsx` (`StylesTabBody`) · i18n `styles.elementless*`. 검증: `elementlessNodeStyles.test.tsx` (수정 전 RED · 원복 RED) · live: Canvas 클릭 → 패널 「MenuTrigger」 Style · Layout 탭 안내, Screen 탭 유지 · 더블클릭 → 「Button」 Radius 14 · Width 3 이 record · Canvas 에 반영.

## [Select · ComboBox 목록 팝오버 padding 제거 — RAC · S2 레퍼런스] - 2026-10-15

### Fixed

- **Select · ComboBox 의 목록 팝오버에 Popover 자체 padding 이 붙던 문제** — Preview · publish 에서 팝오버 padding 16px (size M) 위에 목록 padding 4px 가 더해져 항목이 팝오버 테두리에서 21px 안쪽에 있었다. 이제 팝오버 padding 0 이고 목록 padding 4px 만 안쪽 여백이다.
  - **Why**: 레퍼런스는 picker 팝오버의 padding 을 지운다 — RAC starter `.select-popover[data-trigger='Select']` · `.combobox-popover[data-trigger='ComboBox']` `padding: 0` (Menu · Submenu 도 0), S2 1.8.1 Picker · ComboBox `<Popover padding="none">` (목록 쪽 Virtualizer padding 8). catalog 는 Menu 만 0 이었고 Select · ComboBox 는 Popover 의 size padding 을 그대로 받았다.
  - DatePicker · DateRangePicker 는 그대로다 — RAC 는 기본 Popover padding 8px 을 두고, S2 는 팝오버 padding none 대신 안쪽 상자에 16 / 24 를 준다 (달력 둘레 여백 유지).
  - Builder 자체 picker (패널 드롭다운) 는 같은 생성 sheet 를 싣지만 `data-catalog-id` 가 없어 바뀌지 않는다.
- 위치: `packages/shared/src/catalog/generated/componentRulesTable.ts` (Select · ComboBox `externalStyles` — `.react-aria-Popover[data-trigger=…][data-catalog-id]`) → 생성 `Select.css` · `ComboBox.css`. Canvas 는 닫힌 목록을 그리지 않아 해당 없음. 검증: live Preview 에서 팝오버를 열어 computed padding 16px → 0px, 목록 inset 17 → 1 (테두리 1px) · DatePicker · DateRangePicker 16px 유지.

## [CheckboxGroup 안 Checkbox — Name · Value 복원] - 2026-10-15

### Fixed

- **CheckboxGroup 안 Checkbox 의 Design 패널에 Name · Value 가 없던 문제** — 이제 단독 Checkbox 처럼 Content 절에 두 칸이 있고, 값이 Preview · publish 의 `input` 에 닿는다 (그룹 안에서 쓴 Value 가 폼 제출 값 · 그룹 선택 키, Name 을 비우면 그룹의 Name). Error Message 는 계속 그룹에서 편집한다.
  - **Why**: 2026-10-14 「부모가 정하는 칸」 정리에서 두 칸을 「RAC 가 그룹의 name 을 쓰고 value 는 그룹 키」로 보고 숨겼고, DOM 은 그룹 안에서 value 를 노드 id 로 바꿔 넣고 name 을 버렸다 — 폼 제출 값이 내부 id 였다. 설치 RAC `useCheckboxGroupItem` 은 `name: props.name || group's` 이고 value 는 항목의 것이며, S2 1.8.1 Checkbox 도 둘을 그대로 넘긴다 (그룹 안에서 끄는 것은 `isInvalid` 하나).
  - Value 를 비운 항목은 전처럼 노드 id 가 RAC 키다.
- 위치: `packages/shared/src/catalog/runtime/ownerDecidedProps.ts` (`GROUP_ITEM_PROPS` — Checkbox 는 `errorMessage` 만) · `packages/shared/src/catalog/runtime/delegatedDom.runtime.ts` (`groupItemValue` — 항목 value · 그룹 `defaultValue` 가 같은 키). 검증: `groupCheckboxValueDom.test.ts` · `ownerDecidedProps.test.ts` (수정 전 RED) · live: 패널에 Name · Value 표시, Value 「apple」 입력 → Preview `input` value="apple" · name="fruits" (그룹 Name).

## [Layers — 값이 없는 field 부품 행 제외] - 2026-10-15

### Fixed

- **값이 없는 Description · FieldError 가 Layers 에 0×0 행으로 보이던 문제** — Checkbox 처럼 template 에 Description (`{description}`) · FieldError (`{errorMessage}`) 를 둔 field 는 prop 이 비어 있으면 Canvas · DOM 에 그려지지 않는데도 Layers 에 행이 있었다 (선택하면 X:0 · Y:0 · 0×0). 이제 부모 prop 이 빈 template 부품은 Layers 에 없고, Properties 에 값을 쓰면 그 자리에서 행이 나타난다. 글자가 빈 `presentWhen` 부품 (빈 Label 등) 도 같다.
  - 남기는 것: 상태로 숨은 부품 (메시지는 있고 invalid 가 아닌 FieldError · 닫힌 Popover · 선택 안 된 TabPanel) 과 소유 노드 (Detach 사본 등 — 숨기면 선택 · 삭제 길이 없다).
  - **Why**: Layers 는 template 위치를 전부 나열했고 presence 판정 (`presence.ts`) 을 읽지 않았다.
- 위치: `packages/shared/src/catalog/runtime/presence.ts` (`catalogAbsentByOwnerValue`) · `apps/builder/src/builder/catalogRuntime/layerTree.ts` (`absentByValue` — prop 편집으로 판정이 바뀌면 다시 만든다) · `workspace.ts` (`rowAbsentByValue`). 검증: `layersValueAbsentParts.test.ts` (수정 전 RED) · live Checkbox Description · Error Message 입력 / 지우기에 행 표시가 따라옴.

## [ADR-262 리뷰 Round 3 수리 — 중첩 교체 Reset all · 자식 breakpoint 크기 · 배치 행] - 2026-10-15

### Fixed

- **Reset all changes 뒤에도 안쪽 교체가 남던 문제** — 바깥 instance 를 교체하고 그 안의 instance 도 교체한 뒤 Reset all 하면 바깥만 돌아오고 Canvas · Preview 가 안쪽 교체 값을 계속 보였다. 이제 한 번의 Reset all (한 step) 이 되접으며 드러나는 안쪽 교체까지 되돌린다.
  - **Why**: 시작 시점의 교체 목록만 돌았다 — 바깥을 되접으면 그 교체 노드가 갖던 안쪽 교체가 instance 의 목록으로 옮겨 오는데, 마지막 정리는 교체를 남긴다.
- **자식의 breakpoint 크기 · 배치만 바꾸면 Overrides 목록과 Push · Reset 버튼이 사라지던 문제** — 자식의 tablet `width` · `display` 같은 변경이 이제 `Text.tablet.width` 처럼 행으로 보이고 행마다 Reset 된다. 루트의 breakpoint 크기 · 배치는 놓은 자리라 전처럼 목록 · Reset all 밖이다 (ADR-262 결정 3).
- 위치: `packages/shared/src/catalog/commands/instanceOverrides.ts` (`resetInstance` · `resetOverrideField` `axis`) · `apps/builder/src/builder/panels/properties/catalog/CatalogComponentSection.tsx`. 리뷰: [262 Round 3](adr/reviews/262.md).

## [ADR-262 Implemented — instance override 정리 (원본에 반영 · 전부 되돌리기)] - 2026-10-15

### Changed

- **[ADR-262](adr/completed/262-instance-override-push-and-reset-all.md) Implemented** — 사용자 Builder 확인 「확인했어 Implemented 로 올려」 (G5 — 「Push changes to component」 가 origin 컴포넌트에 반영됨을 직접 확인). Phase 0 ~ 2: Push changes to component · Reset all changes · Overrides 목록 전 종류. 본문은 `docs/adr/completed/` 로 옮겼다.

## [ADR-262 Phase 0 ~ 2 — instance override 정리: 원본에 반영 · 전부 되돌리기] - 2026-10-15

### Added

- **원본에 반영 (Push changes to component)** — Design 패널 Component 절 Overrides 목록 위 버튼 · Canvas 오른쪽 클릭 메뉴. instance 에서 바꾼 값 (루트 props · 스타일 · fills · 상태 · breakpoint 층 · 표시 여부 · 자리별 patch · 숨김 · 사용자 컴포넌트 속성 값) 을 컴포넌트 원본에 쓰고 instance 에서 지운다 — 반영한 instance 는 그대로 보이고, 그 자리를 override 하지 않은 다른 instance 가 같이 바뀐다 (Figma 「Push changes to main component」). 다른 instance 가 1개 이상이면 「N개 instance 영향」 확인 뒤 실행 · 토스트 undo. 중첩 컴포넌트 안 자리는 원본의 중첩 instance 의 override 로 들어간다. slot 내용 · 교체 (ADR-261) · 루트 크기 · 배치는 옮기지 않는다 (사용자 결정 2 · 3). 라이브러리 컴포넌트 instance 는 루트 props · 스타일만 프로젝트 기본값으로 (결정 1).
- **전부 되돌리기 (Reset all changes)** — 같은 두 자리. instance 의 override 를 전부 지워 같은 컴포넌트의 새 instance 처럼 보이게 한다 (교체도 되접음). slot 내용 · 놓은 자리 · 크기 · 배치는 남는다. 확인 없이 토스트 + undo.
- **Overrides 목록이 모든 종류를 보인다** — 숨김 (`Text.Hidden`) · Fill · Fill sizing · 표시 여부 · 상태 (`hover.color`) · breakpoint 층 (`tablet.color`) 행이 루트 · 자리 양쪽에 생기고 각 행의 Reset 이 그 하나만 되돌린다 (Figma 「Figma only lists properties that have changes」).
- 위치: shared `packages/shared/src/catalog/commands/instanceOverrides.ts` (`pushInstanceOverrides` · `resetInstance` · `resetOverrideField`) · Builder `catalogRuntime/componentActions.ts` · `componentConfirm.ts` (`confirmCatalogPush` — 반영의 사전 확인을 원본 편집 감시자의 확인 키에 등록해 두 번 묻지 않는다) · `canvasMenu.ts` · `panels/properties/catalog/CatalogComponentSection.tsx`. 검증: shared 19 (세 원본 모양 × 전수 표 · 리뷰 재현 4 · 원복 RED 4/4 · 무작위 500 단계) · Builder 3 · live `apps/builder/scripts/adr262-override-push-reset-live.mjs` 13/13 (Compare Mode Canvas = Preview). ADR: [262](adr/completed/262-instance-override-push-and-reset-all.md).

## [ADR-261 Implemented — 컴포넌트 API (instance 교체 · slot 추천 · 사용자 컴포넌트 속성)] - 2026-10-15

### Changed

- **[ADR-261](adr/completed/261-component-api-swap-slot-suggestions-properties.md) Implemented** — 사용자 Builder 확인 「직접확인했다」 (G5). Phase 0 ~ 6: instance 안 drop · 붙여넣기 · 순서 부모 수리 · Swap instance · slot 추천 컴포넌트 · 사용자 컴포넌트 속성 (text · boolean · instance 교체). 확인 직전 보고 1 (instance 의 묶인 속성 증분 미반영) 은 아래 항목으로 수리. 남은 별도 결함: Disclosure `size` 가 제목 글자 크기에 증분 반영되지 않음 (원본에서도 재현). 본문은 `docs/adr/completed/` 로 옮겼다.

## [사용자 컴포넌트 instance 의 묶인 속성 즉시 반영] - 2026-10-15

### Fixed

- **Create component 로 만든 컴포넌트 (TextField · Checkbox · Select 등 65 경로) 의 instance 에서 Label · Description · Error Message · Placeholder · 글자 · 아이콘을 바꾸면 Canvas 와 Preview 가 다음 구조 변경 (레이어 추가 · 이동 등) 뒤에야 따라오던 문제** (사용자 보고 「일부는 변경 후 화면의 상태 변경이 일어나야 반영」). 이제 입력 직후 같은 step 에 반영된다. 원본 · Undo 는 그대로.
  - **Why**: 증분 step 이 「이 instance 의 template 이 바뀐 prop 을 묶는가」 를 노드 자신의 정의로만 판정했다 — 사용자 컴포넌트 정의는 `accepts: {}` 라 `{label}` 을 묶는 원본 (라이브러리 composite) 층을 보지 못했다. 이제 record 가 접은 층 (`collapsedSourceIds`) 의 정의 전부로 판정한다.
  - 위치: `packages/shared/src/catalog/runtime/compositionRoot.ts` (`bindingDependents`). 회귀: `apps/builder/src/builder/catalogRuntime/__tests__/adr261Properties.test.ts` (2026-10-15 절, 원복 RED 2/2) · live `apps/builder/scripts/adr261-bound-props-live.mjs` (8/8 — 패널 입력 → Canvas record · Preview DOM 즉시 일치).
  - 같은 probe 에서 남은 별도 결함 1 (instance 와 무관, 원본에서도 재현): Disclosure 의 `size` 를 바꿔도 제목 Text 의 fontSize 가 증분 반영되지 않음 (Heading · Button 을 건너는 part rule 도달 범위). 별도 수리 대상.

## [ADR-261 Phase 5 — instance 교체 속성 (instance swap property)] - 2026-10-15

### Added

- **instance 교체 속성** ([ADR-261](adr/completed/261-component-api-swap-slot-suggestions-properties.md) Phase 5, Figma instance swap property). 사용자 컴포넌트 원본 안의 중첩 instance 레이어 (예: Card 안의 Star 아이콘) 를 고르면 「Component properties」 섹션에 **인스턴스 교체 속성** 버튼이 생긴다. 만든 속성에는 **추천 컴포넌트** (Figma preferred values) 를 붙일 수 있다 — 제한이 아니라 목록 맨 위 안내다. instance 를 고르면 Component 절에 속성 이름과 지금 컴포넌트 칩이 나오고, 누르면 검색 목록이 열린다 (추천 → 같은 종류 → Local · Library, 지금 값은 빠지고 원본의 기본 컴포넌트는 들어간다). 고르면 그 instance 에서만 그 자리가 다른 컴포넌트로 바뀌고 원본은 그대로다. 그 자리에서 바꿔 둔 것 (안쪽 글자 · slot 내용 · 인터랙션 · 조건부 표시의 상태 기준) 은 Swap instance 처럼 **같은 이름 자리**로 옮겨지고, 결과는 알림 「유지 · 버림 · 밖으로」 + Undo 로 보인다. 칩 옆 되돌리기 버튼 (또는 Overrides 목록의 「Icon → Heart」 행) 은 원본 컴포넌트로 되돌린다. 같은 레이어의 표시 속성은 바뀐 컴포넌트에도 적용되고, instance 에서 그 자리를 직접 보이거나 숨긴 값이 먼저다. 원본 안에 놓인 instance 가 그 자리에 자기 값을 둔 경우 바깥 instance 에서 다른 값을 고르는 것은 지원하지 않는다 (알림으로 거부).
  - 값은 instance 의 그 자리 `replace` override 이고 (바뀐 자리 = instance 가 소유한 새 instance 노드), 따로 저장하지 않는다. 그래서 고른 컴포넌트 원본을 고치면 instance 에 반영되고, 복사 · 붙여넣기 · detach · 순환 검사 · Layers · 선택이 기존 경로 그대로다.
  - 위치: `packages/shared/src/catalog/commands/instanceProperty.ts` (`setInstanceProperty` · `resetReplacement` · `instancePropertyValue`) · `commands/{swap,compose,structure,properties}.ts` · `document/{types,validation,graph,componentProperties}.ts` · `resolution/resolver.ts` · `apps/builder/src/builder/catalogRuntime/{componentProperties,editContract,swapInstance}.ts` · `panels/properties/catalog/{CatalogInstancePropertiesSection,CatalogComponentPropertiesSection,CatalogComponentSection,CatalogSwapPicker}.tsx`.

### Fixed

- **원본 레이어를 지우면 그 자리를 바꿔 둔 instance 때문에 삭제가 거부될 수 있던 경로** — 지운 자리의 `replace` override 만 지우고 그 노드를 남겨 소유자 없는 노드가 됐다 (`UNOWNED_NODE`). 이제 지운 자리에 서 있던 노드도 같이 지운다. 추천 컴포넌트를 해체하면 추천 목록에서도 빠진다.
  - **Why**: `removeWithReferrers` 가 주소가 끊긴 override 만 걸러 냈다 — `replace` 의 노드는 그 override 가 유일한 소유 edge 다.
  - 위치: `packages/shared/src/catalog/commands/structure.ts`.

- **Codex 착수 완료 검토 수리** (ADR-261, MEDIUM 4). 교체한 레이어를 detach 하면 표시 속성으로 숨긴 레이어가 다시 보이던 문제 · 원본 레이어와 그 slot 안 레이어에 같은 교체 속성을 걸면 안쪽이 안 바뀌던 문제 (이제 그런 대상은 거부) · 교체 값이 있는 원본 레이어를 원본 밖으로 옮기면 거부되던 문제 (이제 그 레이어에 대한 instance 의 변경이 함께 사라진다 — Figma 와 같음) · Swap instance 에서 이름에 「/」 · 「#」 가 든 레이어가 다른 경로의 변경을 받던 문제.
  - **Why**: materializer 가 교체 노드에 속성 값을 굳히지 않음 · 대상 주소를 첫 상태로만 계산 · 이동 정리가 속성 대상만 봄 · 경로 키를 구분자 그대로 이어 붙임.
  - 위치: `packages/shared/src/catalog/commands/{materialize,structure,swap}.ts` · `document/graph.ts` · `apps/builder/src/builder/catalogRuntime/componentProperties.ts`.

### Tests

- shared `commands/__tests__/instanceProperty.test.ts` 21 · `swap.test.ts` +1 (Codex 재현 4, 원복 RED 4/4) · 이전 기록: `instanceProperty.test.ts` 18 · `randomUndo.test.ts` 에 instance 값 행동 (속성이 없으면 같은 step 에 만듦) · builder `catalogRuntime/__tests__/adr261InstanceProperty.test.ts` 2 · 원복 RED 11/11 + 판독 수리 검증 5/5 (표시 속성 복사 · 직접 표시 우선 · 바깥 값 거부 · 경로 중간 slot 내용) · live `apps/builder/scripts/adr261-instance-property-live.mjs` 15/15 (Compare Mode).

## [ADR-261 Phase 4 — 사용자 컴포넌트 속성 (text · boolean)] - 2026-10-15

### Added

- **컴포넌트 속성** ([ADR-261](adr/completed/261-component-api-swap-slot-suggestions-properties.md) Phase 4, Figma component properties). 사용자 컴포넌트 원본의 레이어를 고르면 Design 패널 「Component properties」 섹션에서 **텍스트 속성** (그 레이어의 글자) · **표시 속성** (그 레이어를 보이기 · 숨기기 — 원본 루트 제외) 을 만들거나 기존 속성을 적용한다. 원본 루트를 고르면 모든 속성이 보이고 이름을 바꾸거나 지운다. instance 를 고르면 Property 탭 Content 맨 앞에 속성 필드가 나온다 — 텍스트는 입력, 표시는 「Show」 칩. 기본값은 원본 레이어의 지금 값이라 원본을 고치면 기본값도 바뀐다. 값은 Canvas 와 Preview 가 같이 그리고, instance 안 그 레이어를 Canvas 에서 더블클릭해 고치면 속성 값이 바뀐다. detach 하면 값이 사본에 남는다. 레이어를 지우거나 원본 밖으로 옮기거나 (원본 안 instance 를) 글자가 없는 컴포넌트로 교체하면 그 속성에서 빠지고, 속성을 지우면 모든 instance 의 값도 지워진다 (한 번의 undo 로 되돌린다).
  - 위치: `packages/shared/src/catalog/document/{types,componentProperties,validation,graph,library}.ts` · `resolution/{resolver,fieldSource}.ts` · `commands/{properties,structure,materialize}.ts` · `runtime/compositionRoot.ts` · `apps/builder/src/builder/catalogRuntime/{componentProperties,editContract}.ts` · `panels/properties/catalog/CatalogComponentPropertiesSection.tsx` · `workspace/canvas/catalog/CatalogTextEditor.tsx`.

### Tests

- shared `commands/__tests__/componentProperties.test.ts` 14 · `randomUndo.test.ts` 에 속성 만들기 · 값 쓰기 · builder `catalogRuntime/__tests__/adr261Properties.test.ts` 4 · 원복 RED 14 · live `apps/builder/scripts/adr261-properties-live.mjs` 14/14 (Compare Mode).

## [ADR-261 Phase 2 · 3 — instance 교체 · slot 추천] - 2026-10-15

### Added

- **Swap instance** ([ADR-261](adr/completed/261-component-api-swap-slot-suggestions-properties.md) Phase 2, Figma 「Swap instance」). instance 를 다른 컴포넌트로 바꾼다 — Design 패널 Component 절의 컴포넌트 이름을 누르거나 Canvas 오른쪽 클릭 「Swap instance」. 목록은 검색되고, 같은 루트 종류 (「관련」) 가 맨 위, 그다음 Local · Library 다 (그 자리에 놓을 수 있는 것만). 노드 id · 위치 · 크기 · 스타일은 그대로이고, instance 에서 바꾼 것 (글자 · 숨김 · slot 내용 · 인터랙션 · 조건부 표시의 상태 기준) 은 새 컴포넌트의 **같은 이름 자리**로 옮겨진다. slot 내용은 같은 이름의 slot 으로. 옮길 자리가 없는 slot 내용은 instance 바로 뒤로 꺼내고 (잃지 않음), 나머지는 지운다. 결과는 알림 「유지 N · 버림 M · 밖으로 K」 + Undo 로 보이고, 한 번의 undo 로 되돌린다. 라이브러리 컴포넌트 (Button ↔ IconButton 등) 도 바꿀 수 있다.
  - 위치: `packages/shared/src/catalog/commands/swap.ts` · `apps/builder/src/builder/catalogRuntime/swapInstance.ts` · `panels/properties/catalog/CatalogSwapPicker.tsx` · `CatalogComponentSection.tsx` · `catalogRuntime/canvasMenu.ts`.
- **slot 추천 컴포넌트** (Phase 3, pen.dev 「suggested slot components」). 컴포넌트 원본의 slot 섹션에서 「추천 추가」 로 그 slot 에 어울리는 컴포넌트를 고른다. instance 의 slot 섹션에는 추천이 버튼으로 맨 위에 나오고, 누르면 그 slot 에 넣는다. 제한이 아니라 안내다 — 다른 것도 그대로 넣을 수 있다. 추천한 컴포넌트를 지우면 추천에서도 빠지고, 다른 프로젝트에 붙여넣으면 그 프로젝트에 없는 추천은 빠진다.
  - 위치: `packages/shared/src/catalog/document/{types,validation,graph}.ts` · `commands/structure.ts` · `apps/builder/src/builder/catalogRuntime/slots.ts` · `panels/properties/catalog/CatalogSlotSection.tsx`.

### Tests

- shared `commands/__tests__/swap.test.ts` 9 (코드 라이브러리 3 포함) · `slotSuggestions.test.ts` 5 · `randomUndo.test.ts` 에 swap · builder `catalogRuntime/__tests__/adr261Swap.test.ts` 4 · live `apps/builder/scripts/adr261-swap-live.mjs` 14/14.

## [ADR-261 Phase 1 — instance 안 drop · 붙여넣기 · 순서가 원본에 쓰지 않는다] - 2026-10-15

### Fixed

- **사용자 컴포넌트 instance 의 slot 안에서 순서를 바꾸거나 붙여넣으면 원본 컴포넌트가 바뀌던 문제** ([ADR-261](adr/completed/261-component-api-swap-slot-suggestions-properties.md) Phase 1). Canvas drop · Alt 복제 drop · 선택 뒤 붙여넣기 (⌘V · 메뉴) · z-order · 화살표 순서 · Layers drop 이 부모를 그려진 자리의 원본 노드로 잡아, instance 의 slot 자식을 화살표로 옮기면 그 자식이 instance 에서 빠져 **원본의 slot 에** 들어가고 (모든 instance 에 퍼짐), ⌘V 사본도 원본에 들어갔다. layout 을 적용한 page 의 내용도 화살표로 옮기면 **layout template 에** 들어갔다 (확인 대화상자도 없이). 이제 instance 안 자리는 그 instance 의 slot 내용 (`fillSlot`) 에 쓰고 원본 · layout 은 바뀌지 않는다.
  - **Why**: ADR-260 Phase 0 의 의심을 live 로 재현 — ArrowDown · ⌘V · layout page ArrowDown 셋 다 원본 · layout template 에 썼다.
  - 원본에서 투영된 레이어는 instance 안에서 옮기지 않는다 (pen.dev 「Layers inherited from an origin cannot be freely reparented」). slot 이 아닌 자리에는 넣지 않고 바깥 부모로 간다 (사용자 결정 2 — 「slot 에만」).

### Added

- **drag · 붙여넣기로 slot 채우기** — instance 의 slot 자리에 Canvas 로 끌어 놓거나 붙여넣으면 그 instance 의 slot 내용이 된다 (pen.dev 「Drag and drop or copy and paste an element into the slot」). 라이브러리 원본의 slot (Card Content 등) 에도 끌어 놓을 수 있다.
  - 위치: `apps/builder/src/builder/catalogRuntime/insertParent.ts` (`catalogInsertParent` · `catalogParentOfNode`) · `canvasGesture.ts` · `canvasMenu.ts` · `shortcuts.ts` · `layerTree.ts`.

### Tests

- `apps/builder/src/builder/catalogRuntime/__tests__/adr261DropParent.test.ts` 9 (원복 RED 전량) · live `apps/builder/scripts/adr261-drop-parent-live.mjs` 5/5.

## [ADR-260 Implemented — Create component 노드가 그 자리에서 ORIGIN] - 2026-10-14

### Changed

- **Create component 뒤 선택한 노드가 그 자리에서 컴포넌트의 원본 (ORIGIN) 이 된다** (pen.dev · Figma 참조 모델 — 사용자 결정 2026-10-14 「선택 노드가 ORIGIN 으로」, [ADR-260](adr/completed/260-component-origin-in-place.md)). 노드를 정의 안으로 옮기고 그 자리에 instance 를 두던 2026-09-30 모델 (ADR-248 판정 ②) 을 뒤집는다. Design 패널 Component 절에 바로 ORIGIN 칩 · Select instances · Detach component 가 나오고 Canvas · Layers 도 ORIGIN 표식이다. instance 는 Components 탭 · 팔레트 · 원본의 복제 (⌘D · 복사-붙여넣기) 로 만든다.
  - **Why**: 사용자 보고 — 「instance 를 create component 하면 detach instance 가 하나 더 생기고, 만든 컴포넌트 표시가 Component 절에 나타나지 않는다」. 원본이 정의 편집 view 에만 있어 생성 직후 패널이 INSTANCE 였다.
  - 문서 모델: `DefinitionEntry.originRef` — `true` = 정의가 page 의 원본 노드를 **참조** (소유하지 않음), `false` = 원본을 지워 정의가 숨은 template 으로 소유, 없음 = 옛 문서 · layout 의 소유 template (그대로 — 전환 코드 0). 그래프 역색인 `definitionOfTemplateRoot` 로 원본 편집이 instance 재검증 · Canvas 갱신 · 확인 대화상자에 닿는다.
  - **Go to component** = 원본이 있는 page 로 가서 원본 선택 (Components 탭의 사용자 컴포넌트 클릭도). 정의 편집 view 는 숨은 template · 옛 문서 · layout 전용.
  - **Detach component** 는 원본을 남긴다 — instance 만 분리되고 노드는 보통 노드로 (Create ↔ Detach component 왕복, ⌘⌥K 토글).
  - **원본 삭제** = Figma 대로 instance 는 남고 정의가 숨은 template 이 된다. instance 의 Component 절 · Canvas 메뉴에 **Restore origin** — 그 instance 바로 뒤에 원본을 되돌린다 (절대 배치면 10 px 옆). 원본 안의 원본은 바깥만 숨고 안쪽은 원본 그대로.
  - 원본의 복제 · 복사-붙여넣기 · page 복제 = 그 정의의 instance (pen.dev). 다른 프로젝트에 붙이면 보통 노드.
- **Create component 로 만든 컴포넌트가 Navigator Components 탭에 「Local」 page 하나로 모인다** (사용자 요청 2026-10-14 「원본 components page 처럼 한 page 에」 — 종전은 컴포넌트마다 탭 항목). 탭에는 「Library」 · 「Local」 두 page 만 있다 (이름에 components 를 되풀이하지 않는다 — Figma Assets 의 Libraries · Local). 「Local」 은 저장하지 않는 파생 page 로, 컴포넌트마다 번호 카드 (제목 + 노드 — 「Origin」 줄 제목 · 이름 글자 없음) 에 **원본 노드 자체** (page 에 있는 그 노드를 그대로 그린다) 만 그린다 (instance 는 두지 않는다 — 사용자 「origin 만 있으면 된다」). 카드의 원본을 Canvas 에서 누르면 그 원본이 선택되고 (ORIGIN 칩), 거기서 고친 값은 원본에 써져 모든 instance 에 퍼진다 (사용자 선택 「실제 원본에 반영」). Layers 는 page 처럼 루트 「body」 (두 page 모두 — Pages · Layouts 와 같게) 아래에 원본 노드를 나열하고, 그 행의 삭제 버튼은 원본을 지운다 — page 에서 지울 때와 같이 instance 는 남아 Restore origin 을 주고 컴포넌트는 목록에서 빠진다 (Figma). 컴포넌트를 만들거나 해체 · 삭제 · 되돌리면 page 를 다시 배치한다. 다른 원본 안에 든 원본은 그 원본의 카드에만 그린다 (한 page 에 같은 노드를 두 번 그리지 않는다).
- **지운 원본도 Local page 에 남는다** (사용자 보고 2026-10-14 — 「page 에서 원본을 삭제하면 Local page 에서도 사라지고, 원본을 찾으려면 instance 의 Go to component 로 Layers 바로 아래 (body 없는 정의 편집 화면) 로 가야 한다」). 원본을 지우면 instance 는 남고 (Restore origin) 정의가 원본을 숨겨 가지는데, 이제 그 원본도 Local page 의 카드 · Layers body 아래에 그대로 나오고 ORIGIN 으로 표시된다 (Component 절 · Layers 점 · Canvas). instance 의 **Go to component** 는 원본이 page 에 있으면 그 page, 지워졌으면 Local page 로 가서 원본을 선택한다 — 컴포넌트의 정의 편집 화면은 더 열리지 않는다 (layout 전용). 지운 원본은 다시 지울 수 없어 Layers 행에 삭제 버튼이 없고, 되돌리기는 Restore origin · 완전히 없애기는 Detach component. Local page 에서 instance 가 있는 원본을 처음 고칠 때도 영향 확인을 묻는다 (전에는 기본 원본 page 처럼 다뤄 묻지 않았다).
  - 위치: `packages/shared/src/catalog/runtime/originViewNode.ts` (`PROJECT_COMPONENTS_VIEW` · `componentsViewRoot`) · `apps/builder/src/builder/catalogRuntime/componentsPage.ts` (`catalogProjectComponentsPageEntries` — 기본 page 와 같은 그리기 도구 `pageKit`) · `workspace.ts` (`openComponentsView`) · `canvasPick.ts` · `panels/navigator/catalog/CatalogDefinitionsSection.tsx`.
  - 위치: `packages/shared/src/catalog/document/{types,validation,graph}.ts` · `commands/{components,structure,project,materialize}.ts` · `document/clone.ts` · `transactions/transaction.ts` · `apps/builder/src/builder/catalogRuntime/{componentActions,componentConfirm,workspace,layerTree,slots,canvasMenu,aiHost,clipboardText}.ts` · `panels/properties/catalog/CatalogComponentSection.tsx`.

### Fixed

- **컴포넌트 안 컴포넌트의 slot 내용 · style 이 instance 에서 빠지던 문제** (ADR-260 Decision 11 — 옛 문서에도 있던 결함). 원본 안 ToggleButtonGroup 의 항목 · Card Content 의 style 처럼 template 노드 자신의 override 가 instance 에 투영되지 않았다. 이제 resolver · Layers 자리 · 패널 값 (`template` 출처) · detach 가 「투영 경로의 owner 들, 바깥부터」 를 읽고 instance 의 같은 자리 override 가 이긴다. 그 slot 내용은 instance 의 template 자리 (`templatePath: [… , T, C]`) 로 고를 수 있다. 위치: `packages/shared/src/catalog/resolution/templateOwners.ts` · `resolver.ts` · `positions.ts` · `fieldSource.ts` · `address.ts` · `commands/materialize.ts`.
- **template 노드가 가진 slot 내용을 detach 하면 `DUPLICATE_OWNERSHIP` 으로 거부되던 문제** — 이제 사본으로 물질화한다.
- **사용자 컴포넌트 instance 의 속성이 그려진 컴포넌트에 반영되지 않던 문제** (사용자 G5 보고 2026-10-14 — RadioGroup 컴포넌트의 instance 에서 Orientation · Size 가 안 바뀜). 문서에는 써졌지만 resolver 가 template 자리에서 라이브러리 원본의 `accepts` (RadioGroup 원본은 label · description · errorMessage 뿐) 로 걸러 버렸고, 그 아래 실제로 그려지는 루트 (RadioGroup) 로 넘기지도 않았다. instance 계약은 원본 schema + 루트 계약 (`instanceContract`) 이라 이제 그대로 넘긴다 — 놓은 노드와 같다. 옛 소유 모양 컴포넌트에도 있던 결함. 위치: `resolver.ts` (template 자리의 instance 값 · 중첩 루트로 넘기는 키).
- **사용자 컴포넌트 instance 에 「+」 (Insert Radio 등) 가 없던 문제** (같은 보고). 그룹의 항목 묶음을 찾는 걷기가 원본의 라이브러리 composite 안으로 들어가지 않아 (`NO_ITEMS_WRAPPER`) 선택지가 숨었다. 이제 instance 가 보여 주는 자리 목록 (`positions.ts`) 으로 묶음 · 루트 slot 을 찾고, 그 자리를 처음 채울 때 라이브러리 기본 항목이 아니라 **원본의 항목** 을 복사한다 (`ensureChildList` — `templateNodeFillAt`). 위치: `commands/collections.ts` `insertGroupItem` · `commands/materialize.ts`.
- **자기 instance 를 slot 내용 (`fillSlot` · `replace`) 으로 원본 안에 넣어도 거부되지 않던 문제** (Decision 12) — 정의 순환 검사가 `children` 만 걸었다. 원본 안쪽 깊이 옮긴 서브트리의 자기 instance 도 거부한다.
- **다른 프로젝트에 붙여넣기가 `DANGLING_DEFINITION` · `DANGLING_TOKEN` 으로 실패하던 문제** (Decision 13). clipboard 가 출처 프로젝트 · 원본 · 정의 snapshot · 사용자 token 을 담는다 — 정의가 없는 instance 는 보통 노드로 물질화, 없는 token 은 이름 · 종류가 같은 대상 token 으로, 없으면 값 고정, 대상이 없는 interaction 은 빼고 붙인다. 옛 clipboard 글은 그대로 붙는다.

### Tests

- shared `document/__tests__/adr260.test.ts` 26 · `commands/__tests__/adr260.test.ts` 15 · 무작위 명령 500 단계 하니스에 원본 삭제 · Restore · instance 넣기 추가. builder `adr260OriginInPlace.test.ts` 5 (RadioGroup 컴포넌트 instance 의 「+ Radio」 · Orientation — 원복 RED 3) · `adr260ClipboardText.test.ts` 2 · 옛 「create → 그 자리 instance」 전제 테스트 20 파일 갱신 (옛 구조가 필요한 곳은 `support/legacyComponent.ts` — create → 복제 → 원본 삭제). 원복 RED 확인 (모델 · 투영 · 명령 · Builder 각 경로).
- live `apps/builder/scripts/adr260-origin-in-place-live.mjs` (headed Chrome, Button · ToggleButtonGroup · Card) 33/33 · page error 0.
- live `apps/builder/scripts/adr260-project-components-page-live.mjs` (headed Chrome — Local page: 탭 항목 「Library」 · 「Local」 · 카드 = 원본만 · Layers 루트 body > 원본 행 · Canvas 클릭 → 원본 선택 · Orientation 편집 → page 원본 · instance 반영 · Layers 삭제 버튼 → 목록에서 빠지고 instance 유지 · 되돌리기 · 새로고침 저장 · 지운 원본이 Local 에 남고 삭제 버튼 없음 · instance 의 Go to component → Local 의 그 원본) 16/16 · page error 0.

## [놓은 instance 의 slot 기본 내용 = 자기 노드] - 2026-10-14

### Changed

- **팔레트 · "+" 로 놓은 원본 instance 는 slot 기본 내용을 처음부터 자기 노드로 가진다** (사용자 결정 「slot 호스트 전부」, 같은 날 「Tabs · Table · Tree · Menu · Select · ComboBox 도 동일하게」). ToggleButtonGroup 의 「Toggle 1 · 2」 는 그룹의 "+" 가 넣은 ToggleButton 과 같다 — Design 패널 Component 절의 detach instance · create component, Attributes 절의 ID, Layers 의 instance 점이 모두 나온다. CheckboxGroup · RadioGroup · ButtonGroup · Toolbar · Card · CardView · Form · DisclosureGroup · Nav · Tabs · Tree · Menu · Select · ComboBox 가 같다. Table 은 원본이 빈 머리글 · 본문이라 처음 항목이 없고 "+" 의 열 · 행이 원래 자기 노드다.
  - **Why**: slot 기본 내용은 instance 의 템플릿 자리 (`descendant`) 로 남아 있다가 첫 구조 편집에서야 소유 노드 (`fillSlot`) 가 됐다 (ADR-248 4b `ensureChildList`). 그래서 같은 그룹 안의 처음 항목과 "+" 항목이 다른 객체였다. 이제 `insertNodes` 와 컬렉션 "+" 가 놓는 순간 같은 materialize 를 한다 (`ownSlotContents`, 놓인 노드 아래로 재귀).
  - ListBox · GridList · TagGroup · Breadcrumbs 의 항목도 소유 노드다 — 처음 항목과 "+" 항목이 같은 ListBoxItem instance (detach · ID). data binding 의 행 반복이 소유 항목도 따른다: 첫 소유 항목이 행 템플릿이고 나머지는 견본 항목이다. 행 템플릿의 글자 그대로인 내용 (「Inbox」) 은 견본이라 행이 읽지 않고, `{field}` 내용만 행 값이 된다 (`resolver.ts` `withoutSampleContent` · `rowTemplate.ts`).
  - 선언된 slot 밖의 항목 목록도 같다: 항목을 담은 자리 (MenuTrigger 의 Menu) 와, 중첩 원본의 slot 을 템플릿이 항목으로 채운 자리 (Select · ComboBox 의 ListBox — `slotFills`). 데이터 binding 한 Select · ComboBox 는 ListBox 의 첫 소유 항목을 행마다 반복한다 (resolver 가 중첩 원본 루트에 행을 넘긴다).
  - 제외 — slot 내용이 instance prop 에 묶인 경우 (AvatarGroup 의 `{label}` Text): 복사본은 prop 을 더는 따르지 않아 템플릿 자리로 둔다.
  - 한 자리의 override 는 하나라서, 소유 목록을 가진 자리 (`fillSlot`) 가 그 자리의 prop · style 쓰기도 함께 담는다 (`DescendantPatchFields` — 문서 스키마 확장, 옛 문서는 그대로 읽힌다).
  - 옛 문서는 바꾸지 않는다 (개발 단계 — 로드 전환 코드 없음).
  - 위치: `packages/shared/src/catalog/commands/materialize.ts` (`ownSlotContents` · `librarySlotAddresses`) · `structure.ts` · `collections.ts` · `document/types.ts` · `document/validation.ts` · `transactions/transaction.ts` · `apps/builder/src/builder/catalogRuntime/componentActions.ts` · `layerTree.ts` · `panels/properties/catalog/CatalogComponentSection.tsx`

### Fixed

- **Create component 뒤 instance 에 detach 가 둘 나오던 문제.** 프로젝트 컴포넌트의 instance 가 Detach instance 와 「Detach component」 (컴포넌트 해체 — 모든 instance 분리) 를 함께 보였다. 해체는 원본의 것이다 — Design 패널 Component 절 · Canvas 메뉴 · ⌘⌥K 모두 원본 (정의 화면의 루트) 에서만 낸다 (사용자 결정 2026-10-14, 09-16 「Create ↔ Detach component」 규칙). 위치: `panels/properties/catalog/CatalogComponentSection.tsx` · `catalogRuntime/canvasMenu.ts` · `shortcuts.ts`.
- **소유 항목을 가진 slot 자리에 style · prop 을 쓰면 명령이 거부되던 문제.** Card 의 Content · Tabs 의 TabList · Menu 처럼 항목이 instance 의 것인 자리에 배경색 하나만 바꿔도, patch 가 그 자리의 항목 목록 (`fillSlot`) 을 덮어 항목이 주인 없는 노드가 됐다 (`UNOWNED_NODE`). "+" 로 항목을 넣은 slot 은 전부터 같았다. 이제 `fillSlot` 이 그 자리의 쓰기를 함께 담고, 쓰기 · "+" · reset 이 서로의 것을 지우지 않는다. 위치: `transactions/transaction.ts` `mergePatch` · `commands/context.ts` `setChildList` · `commands/fields.ts` `resetDescendant` · resolver · fieldSource 등 patch 를 읽는 곳.
- **소유 TreeItem 안 TreeItem 이 선택된 것으로 그려지던 문제.** 놓은 Tree 의 Node 1.1 이 TreeItem 원본의 `selected` 표시 상태를 실제 선택으로 받았다 — 조상 타입을 원본 이름 (「TreeItem/Default」) 으로 읽어 컬렉션 안 항목으로 보지 못했다. 이제 원본 instance 는 루트 타입으로 읽는다 (`resolver.ts` `ancestorTypes`).
- **ToggleButtonGroup "+" 뒤 Design 패널 slot 목록이 그대로이던 문제.** 루트가 항목 slot 인 그룹 (ToggleButtonGroup · ButtonGroup · AvatarGroup · Nav · DisclosureGroup) 의 "+" 가 새 항목을 slot 내용이 아니라 instance 자체 children 끝에 붙였다. 이제 slot 내용에 들어간다. 위치: `packages/shared/src/catalog/commands/collections.ts`.
- **"+" 로 항목을 넣은 ListBox · GridList 에 data binding 을 걸면 행이 사라지던 문제.** 소유 항목 (`fillSlot`) 이면 resolver 가 행을 버렸다. 이제 첫 소유 항목을 행마다 반복한다.
- **소유 컬렉션 항목에 넣은 노드가 index 를 따르지 않던 문제.** "+" 로 넣은 항목에 GridList 선택 Checkbox 를 index 0 으로 넣으면 템플릿 내용 뒤에 섰다. 이제 템플릿 자리 항목처럼 항목의 원본 내용 목록 안 그 자리에 들어간다 (`structure.ts` `itemContentParent`).
- **CardView 안 Card 에 HTML id 가 있으면 Preview 선택이 빠지던 문제.** Card 는 RAC GridListItem 이라 `id` 가 선택 key 인데, 작성자 · 자동 HTML id 가 key 를 바꿔 `isSelected` 가 맞지 않았다 ("+" 로 넣은 Card 도 같았다). 위치: `packages/shared/src/catalog/runtime/domBinding.runtime.ts` `withHtmlId`.

### Tests

- `phase4eComponents.test.ts` (놓은 ToggleButtonGroup 항목 = 소유 ToggleButton instance · detach · undo) — 원복 RED 확인. `adr256CardS2.test.tsx` 선택 — 원복 RED 확인.
- `phase4eComponents.test.ts` 그룹 "+" → slot 목록 3 · ListBox 처음 항목 = "+" 항목 (원복 RED). `phase4eBoundRows.test.tsx` 7 이 소유 항목 경로를 지난다 (resolver 원복 RED 7). `adr256GridListNodeTree` · `adr256ListBoxNodeTree` index 0 (원복 RED 2).
- `phase4eComponents.test.ts` 놓은 Tabs · Tree · Menu · Select · ComboBox 항목 = 소유 instance · ID (원복 RED 4 · 5) / Card Content · TabList · Menu 의 style + 항목 공존 · "+" 뒤 style 유지 · reset 뒤 항목 유지 (`mergePatch` 원복 RED 3 · `setChildList` 원복 RED 2). `phase4eBoundRows.test.tsx` bound Select · ComboBox 행 반복 (수정 전 RED). `adr256TreeNodeTree` · `collectionItemSelection` Tree 선택 (`ancestorTypes` 원복 RED 4).
- `phase4e8Chrome` (instance 의 detach 하나 · 원본의 Detach component) · `phase4eCanvasMenu` · `phase4eShortcuts` — 원복 RED 1 · 2. live `apps/builder/scripts/create-component-live.mjs` (Button · ToggleButton 생성 뒤 instance 버튼 = Go to · Detach instance · Create, 원본 = Select instances · Detach component, 오류 0).
- live: `apps/builder/scripts/slot-owned-collections-live.mjs` 9/9 (Tabs · Tree · Menu · Select · ComboBox 처음 항목 = "+" 항목 Component · ID, Table "+" 열, Card Content · TabList · Menu style 뒤 항목 유지, 오류 0) · `apps/builder/scripts/template-row-instance-live.mjs` 4/4 (놓은 항목 · "+" 항목이 Component · Attributes(ID) · Layers 점까지 같음, Components 페이지 표시) · `slot-owned-hosts-live.mjs` (6 host Compare Mode, 오류 0) · `slot-list-refresh-live.mjs` 4/4 (ToggleButtonGroup · RadioGroup slot 목록 갱신, ListBox 처음 항목 = "+" 항목 패널 · 폭).

## [ToggleButton Icon 색상 상속] - 2026-10-14

### Fixed

- **ToggleButton에 추가한 Icon이 기본적으로 텍스트 색상을 따른다.** 독립 버튼과 ToggleButtonGroup 안의 버튼 모두 선택·강조·Static Color 변경 직후 Icon 색상을 갱신한다.
  - DOM wrapper는 부모 색상을 상속하고 SVG는 `currentColor`를 사용한다. Canvas는 같은 owner의 catalog 상태별 텍스트 색상을 읽는다.
  - Icon에 직접 지정한 색상은 보존한다. 기본값과 같은 색상을 명시해도 상속으로 바꾸지 않으며, Reset하면 부모 색상을 다시 따른다.

## [혼합 버튼 텍스트·상속 Reset·Icon 상자 정합성] - 2026-10-14

### Fixed

- **Button·ToggleButton에 Icon을 추가해도 Label이 Canvas에 남고, 편집한 텍스트 폭과 자식 배치가 즉시 갱신된다.**
  - DOM의 익명 텍스트와 ToggleButtonGroup 내부 span을 레이아웃 부품으로 반영한다. 좁은 폭에서 텍스트 부품을 재측정하고, 넓히면 한 줄로 복원한다.
  - 중첩 flex 최소 폭에 최대 폭이 들어가던 계산과, 재배치한 폭을 flex basis로 다시 사용하던 계산을 수정한다.
- **타이포그래피 값을 Reset하면 부모의 최신 값을 즉시 상속한다.** fontFamily·letterSpacing·fontStyle·textTransform·wordBreak·overflowWrap·textAlign의 Reset/Undo/Redo를 새 문서 로드 결과와 대조한다. Body 등 텍스트를 담는 상자의 상속 속성은 두 소비자에 전달하고, ToggleButton의 네이티브 기본값은 상속 경계로 보존한다.
- **Icon의 DOM 상자를 해석된 glyph 크기에 맞춘다.** XS/S/M/L/XL, 독립 Icon과 버튼 내부 Icon에 공통 적용하며, 직접 지정한 width·height는 보존한다.

## [Select Side 높이·placeholder 정렬] - 2026-10-14

### Fixed

- **Select의 Side Label에서 선택 영역이 버튼 높이를 포함하고, placeholder가 세로 중앙에 놓인다.**
  - Grid의 auto 행 계산에서 intrinsic 높이 자식의 padding·border를 포함해 Label 높이만 남던 문제를 수정한다.
  - Canvas 텍스트가 부모의 line-height를 상속하며, 직접 지정한 값과 편집·Undo도 반영한다.
  - Quiet 모드에서도 버튼 안 아이콘의 상자 높이를 glyph에 맞춰 기본 Icon 높이로 늘어나지 않도록 한다.
  - XS/S/M/L/XL의 Top·Side 전환, 필드 계열 Side 배치와 실제 Builder의 Canvas·CSS 높이를 검증한다.

## [Field Prefix·Content 속성 즉시 반영] - 2026-10-14

### Fixed

- **TextArea의 Prefix를 placeholder의 첫 줄에 정렬하고, Prefix가 있는 Side Label의 Canvas·CSS 위치를 일치시킨다.**
  - 여러 줄 입력의 FieldBox는 위쪽 정렬을 사용한다. Side Label의 첫 줄 정렬 규칙은 입력을 감싼 Prefix Group도 인식한다.
  - Canvas의 글자 그리기 경로에도 Input의 위쪽 여백 0을 전달해 기본 여백이 다시 붙지 않도록 한다.
  - S/M/L/XL 크기와 Top/Side, Rows 변경, Prefix None/Text/Icon 경로를 회귀 검증한다.
- **TextField·TextArea의 Prefix Text 변경 직후 Input이 이동하고, Label·Placeholder 편집이 Canvas와 Preview에 반영된다.**
  - 파생 flex Group을 block으로 판단하던 Canvas 형제 갱신·줄바꿈 범위를 실제 엔진 입력으로 판정한다.
  - 구조 편집으로 독립 노드가 된 Label·Input·Description·FieldError의 Content 편집과 Reset을 실제 부품에도 같은 명령으로 적용한다. 패널은 부품 값을 읽고 직접 편집·Undo를 구독한다.
  - 패널이 이미 판별한 컴포넌트 타입을 재사용해 일반 컴포넌트 선택 시 불필요한 graph 조회를 추가하지 않는다.
  - 같은 Prefix 경로의 NumberField·ComboBox·ColorField와 Undo/Redo·Prefix 제거/교체·문서 재로드도 검증한다.

## [Canvas Button 글자가 변 padding 을 따른다] - 2026-10-14

### Fixed

- **Button 의 padding 을 네 변 모두 4 로 쓰면 Canvas 에서 글자가 버튼 밖으로 나가던 것.** Preview (CSS) 는 정상이었다.
  - **Why:** Canvas 의 Button 글자 그리기가 rule 의 `paddingX` (M 12) 만 읽어, 상자는 변 padding 으로 줄었는데 (100.7px) 글자는 12px 안쪽에서 24px 좁은 폭 (76.7 < 글자 90.7) 으로 놓여 줄이 넘쳤다. 배치 · DOM 이 쓰는 상자 모델 (`catalogBoxModel` — paddingLeft > paddingX > padding) 을 읽도록 고쳤다.
  - 회귀 테스트 `buttonPaddingText.test.tsx` (원복 RED) · live `button-padding-live.mjs` (글자 inset 4 · 폭 92.7 · 양쪽 상자 100.7).
- **같은 패턴 — Text · Label · Heading · Paragraph (Canvas 글자 binding) 도 작성 padding · border 를 무시하고 글자를 상자 모서리 (inset 0) 에 그렸다.** Preview 는 padding 안쪽에 그린다. 이제 상자 모델의 변 padding + border 만큼 들여쓴다 (`textLeafPadding.test.tsx` 5 · live `text-padding-live.mjs`: padding-left 24 + border 2 → 양쪽 글자 inset 26).

## [Button 최소 폭 하한 제거] - 2026-10-14

### Changed

- **Button 의 size 별 `min-width` (XS 45 · S 50 · M 68 · L 95 · XL 122) 를 뺐다** — 짧은 라벨 ("OK") 버튼이 padding + 글자 폭으로 좁아진다 (M: 68 → 45). 설치된 S2 1.8.1 `Button` 에는 min-width 가 없고, 2026-08-20 에 넣은 값은 Spectrum 1 의 "2.25 × height" 였다 (사용자 결정). Canvas 와 Preview 가 같은 rule 을 읽으므로 양쪽이 같이 줄어든다.

## [Button Pending — 대기 중 표시] - 2026-10-14

### Added

- **Button 의 Pending (`isPending`) 이 양쪽에 보인다.** S2 1.8 `Button` 과 같은 모양 — 글자 · 아이콘은 자리를 지킨 채 숨고, 가운데에 끝없는 진행 원 (S2 size S 선 2px · 버튼 size 별 지름 S 14 · M 18 · L 20 · XL 24) 이 버튼 글자색으로 뜬다. Preview 는 S2 처럼 1초 뒤에 (짧은 대기가 깜빡이지 않도록), Canvas 는 저작 화면이라 바로. RAC 는 전처럼 누름을 막고 `data-pending` · `aria-disabled` 를 단다.
  - **Why:** 2026-09-29 부터 미뤄 둔 항목 (ADR-248 완료 후). 그전에는 DOM binding 이 `isPending` 을 넘기지도 않았고, Canvas 는 아무것도 그리지 않았다.
  - 두 consumer 가 `buttonPending.ts` 하나 (지연 · 지름 · 선 · 투명도 · 이름) 를 읽는다. 이름은 S2 `button.pending` ("Pending").
- 단독 ProgressCircle 의 `isIndeterminate` 도 이제 DOM 이 270° 호를 그린다 — Skia `value_fill_arc` 와 같은 호. 전에는 track 만 그려 Canvas 와 갈렸다.

## [D2 — binding prop 을 설치된 S2 1.8.1 과 대조] - 2026-10-14

### Changed

- **Tooltip 의 배치 칸 (Placement · Offset · Cross Offset · Should Flip · Container Padding) 이 TooltipTrigger 로 옮겨 갔다.** S2 `TooltipTrigger` 가 가진 prop 이고, shared `TooltipTrigger` 가 context 로 Tooltip 에 넘긴다 (S2 와 같은 길). Placement 값은 S2 의 `top · bottom · left · right · start · end`. TooltipTrigger 의 Close Delay 는 S2 가 받지 않아 제거.
- **field 12종 (TextField · TextArea · NumberField · SearchField · ColorField · ComboBox · Select · DateField · TimeField · DatePicker · DateRangePicker · Form) 의 Label Align 에서 `center` 를 제거** — S2 `labelAlign` 은 `start · end`. rule 의 `label-align.center` 변형과 생성 CSS 도 함께.
- **TableView 의 Allow Sorting 칸 제거** — S2 는 Column 단위 (`allowsSorting`) 만 있고 DOM 은 표 단위 값을 버리고 있었다.
- 옛 문서의 옮긴 · 지운 값은 그대로 무시된다 (로드 시 전환 없음 — 사용자 지시 2026-10-14).

### Added

- **D2 게이트** `d2S2Alignment.static.test.ts`: 설치된 `@react-spectrum/s2` 의 TypeScript 타입 (상속 RAC prop 포함) 과 binding 147개의 보이는 prop 키 · 선택지 값을 대조한다. S2 에 없는 prop 185개는 `d2Provenance.ts` 에 출처 (`v3` 14 · `rac` 8 · `composition` 나머지 — `dataBinding` · 부품 `size` · Chart · FileUpload …) 와 함께 적었다.
- 규칙 `ssot-hierarchy.md` D2: 설치 버전 1.8.1 로 정정 · 확장 출처는 `d2Provenance.ts`.

## [Buttons 기본 높이 — 부모 flex stretch 방지] - 2026-10-14

### Fixed

- **Button·IconButton·ToggleButton·두 버튼 그룹·Toolbar·Menu trigger가 부모 flex 높이만큼 늘어나지 않고 콘텐츠 높이를 유지한다.**
  - **Why:** 기본 `height: auto`는 가로 flex 부모의 교차축 stretch를 허용했다. 400px Frame 안 IconButton이 Canvas와 CSS 모두 400px로 표시됐다.
  - 루트 높이를 catalog의 `fit-content`로 선언하고 CSS 생성·typed box 변환·ButtonGroup DOM 소비 경로에서 보존한다. 숫자 높이와 Fill 오버라이드는 유지한다.
  - 회귀 검증: Buttons 7종의 row/column·Undo/Redo·문서 재로드, size 변경, 명시적 높이·Fill 및 Compare Mode.

## [Canvas 버튼 기본 너비 — flex column 전환] - 2026-10-14

### Fixed

- **Body를 block에서 flex column으로 바꿔도 Button·IconButton·ToggleButton이 기본 `fit-content` 너비를 유지한다.**
  - **Why:** CSS와 Canvas가 읽는 루트 스타일 복사본이 달라 Canvas 입력에서 기본 너비가 누락됐다.
  - Button·ToggleButton의 루트 스타일 정의를 공유하고 Button도 공용 typed box 변환을 거친다. 기존 문서에 너비를 다시 지정할 필요가 없다.
  - 회귀 검증: 다섯 버튼·그룹의 block → column, Undo/Redo, 문서 재로드, 명시적 너비 우선 적용.

## [Canvas 배치 즉시 반영 — margin·border·Table 열 갱신] - 2026-10-14

### Fixed

- **margin·grid 배치, 한쪽 border, Table/TableView 열 너비 변경이 Canvas에 즉시 반영된다.**
  - **Why:** 일부 typed field만 비교해 border longhand·파생 열 입력을 놓쳤고, 요소 크기가 유지되면 형제 위치 검사도 생략했다.
  - 엔진에 전달된 입력 snapshot 전체를 비교하고, 크기가 같아도 부모·형제 배치 영향을 검사한다. 기존 직렬화 결과를 재사용하므로 텍스트를 다시 측정하지 않는다.
  - 회귀 검증: border·block/flex margin·grid placement·Table/TableView 열 변경과 preview 취소·Undo/Redo, 기존 paint-only·absolute 요소 및 5k 형제 국소 갱신 검사.

## [Body 간격 즉시 반영 — Canvas layout longhand 갱신] - 2026-10-14

### Fixed

- **flex Body의 Design → Layout → Gap 변경이 즉시 표시된다.**
  - **Why:** `rowGap`·`columnGap`은 레이아웃 엔진에 전달됐지만 Canvas 갱신 판정이 box model만 비교해, Body 크기가 그대로일 때 자식 좌표 갱신을 건너뛰었다.
  - record의 `layout` 변경도 비교해 해당 subtree의 기하와 그리기 명령을 갱신한다.
  - 위치: `apps/builder/src/builder/catalogRuntime/canvasBinding.ts`
  - 회귀 검증: 세로·가로 flex Body의 gap preview·commit·Undo/Redo에서 엔진과 Skia 좌표 일치, 기존 증분 갱신·국소 기하 조회 검사.

## [Canvas — 그룹 · 필드의 빈 영역 더블클릭이 label 편집창을 열지 않는다] - 2026-10-14

### Fixed

- **RadioGroup · CheckboxGroup 등 필드의 빈 영역을 더블클릭하면 상자 전체에 label 편집창이 열리던 것.** 들어갈 자식이 없는 곳이면 「클릭한 요소의 글자」를 편집했는데, 그 `label` 은 그룹이 아니라 안쪽 Label 노드가 `{label}` 바인딩으로 그린다. 이제 안쪽 부품이 그리는 글자는 그 부품을 더블클릭해야 편집되고, 빈 영역에서는 아무것도 열리지 않는다. 같은 증상이 있던 필드 · 그룹 19종(TextField · Select · Checkbox · Switch · Slider 등)에 같이 적용된다. 자기 글자를 직접 그리는 Button 은 그대로다 (`catalogHasOwnText` — `textBinding.ts`).
- 검증: `groupTextDoubleClick.test.ts` (원복 시 5 RED) · live `apps/builder/scripts/group-empty-dblclick-live.mjs` (수정 전 편집창 1440×63 재현 → 수정 후 열리지 않음, Label 더블클릭은 Label 상자에서 편집).

## [Design 패널 — 한쪽에만 반영되던 칸을 Canvas · Preview 양쪽에] - 2026-10-14

### Fixed

- **Tabs 의 Size · Density 가 Canvas 의 TabList 에도 반영된다.** Preview 는 Tabs 값을, Canvas 는 TabList 자기 값을 그렸다. 이제 resolver 가 Tabs 값을 TabList 에 싣고 (`CATALOG_SIZE_PROPAGATION.Tabs` · `CATALOG_DENSITY_PROPAGATION_OWNER.TabList`), Tabs 안 TabList 의 Size 칸은 숨기며 「Tabs 에서 편집합니다」 를 표시한다.
- **Breadcrumbs 의 Size 가 crumb 의 구분자 아이콘 크기에 양쪽 같이 반영된다.** crumb 자기 Size 는 Canvas 아이콘만 바꾸고 Preview 는 무시했다 (S2 Breadcrumb 에는 size 가 없다). 이제 Breadcrumbs 값이 crumb 에 전달되고 crumb 의 Size 칸은 숨긴다.
- **Form 의 Size 가 양쪽에 반영된다.** 전에는 DOM 에 `data-size` 가 없었고 Canvas 도 그에 맞춰 M 으로 고정해, 어느 쪽도 바뀌지 않았다.
- **ToggleButtonGroup 의 Emphasized · Disabled 가 Canvas 버튼에도 반영된다.** 그룹이 켜면 버튼도 켜진다 (`CATALOG_GROUP_TURNS_ON`). Disabled 그룹은 Preview 에서 그룹과 버튼이 이중으로 흐려졌다 (0.14). 이제는 버튼만 0.38 로 흐려진다 (S2).
- **GridList 의 Quiet 가 항목에 반영된다.** 전에는 어느 쪽도 항목 모양이 바뀌지 않았다. 이제 항목이 rule 의 quiet variant 를 Canvas · Preview 양쪽에서 쓴다.
- **Link 의 Quiet 가 Canvas 밑줄도 지운다.** Preview 만 밑줄을 지우고 S2 에 없는 투명도 0.72 를 줬다. 이제 S2 대로 쉴 때 밑줄만 없고 hover 하면 생긴다 (값은 Link rule 의 `[data-quiet]` 블록).

### Removed

- **Card 의 Accent Color 칸.** Preview 만 Card 아래 강조색을 바꾸고 Canvas 는 바꾸지 못했다 (S2 Card 에 없는 확장 prop · 「지금은 제거」). 저장된 값은 열 때 지운다. Styles 패널의 조상 accent 조회와 `preview-system.css` 의 `[data-accent]` 규칙도 같이 지웠다.
- 검증: 회귀 테스트 `oneSidedProps.test.ts` (원복 시 RED 확인) · live `apps/builder/scripts/one-sided-props-live.mjs` (Compare Mode, 10 PASS).

## [Design 패널 — 효과 없는 칸 제거 · 부모가 정하는 칸 숨김 · 칩 제목 "Options" 제거] - 2026-10-14

### Removed

- **값을 바꿔도 Canvas · Preview 어느 쪽도 변하지 않던 칸** (사용자 「모든컴퍼넌트와 컴퍼넌트 자식들 전수조사후 불필요하게 등록된 프러퍼티 제거」 · S2 에 있지만 구현이 없는 것은 「지금은 제거」): 원본 151개와 자식 노드를 Builder 에 놓아 Design 패널 칸을 모으고 소비처를 코드로 확인했다.
  - CardView Layout · Density · Selection Style, ColorSwatchPicker Density · Rounding, ToggleButtonGroup Quiet (S2 prop — DOM 이 grid 를 고정했고, density · rounding · quiet 를 읽는 시트 · context 가 없었다), ColorPicker Default Value (자식이 각자 값을 가진 상자).
  - GridListItem · Tag 의 Label — 글자는 안의 Text 노드의 것 (`itemTextChildren`), 칸에는 `{label}` 이 보였다. ListBoxItem · TreeItem 의 같은 칸은 패널에서만 숨긴다 — 달력 월 · 연 목록의 항목 글자 (`{formatted}`) 와 TreeItemContent 없는 옛 행이 아직 읽는다.
  - 저장된 문서의 그 값은 열 때 지운다 (`s2PropAlignment.ts` `UNUSED_PROPS`). 원본 template 의 값도 지웠다.
  - Button Pending 도 효과가 없지만 「ADR-248 끝난 뒤 착수」 결정대로 둔다.

### Changed

- **부모가 정하는 칸은 그 부모 안에서 보이지 않는다** — 노드에 적은 값이 무시되는 자리 (`catalogOwnerDecidedProps` — resolver 의 `CATALOG_SIZE_PROPAGATION` · `CATALOG_TOGGLE_GROUP_OF` · `CATALOG_EMPHASIS_FROM_GROUP` 를 그대로 읽는다). 대신 「{부모} 에서 편집합니다 — {칸}」 안내가 나온다. 혼자 있으면 그대로 보인다.
  - CheckboxGroup 안 Checkbox: Size · Emphasized · Error Message · Name · Value (S2 는 그룹 안 Checkbox 의 invalid 를 끄고 그룹 도움말을 쓴다, RAC 는 그룹의 name 을 쓴다, 그룹 안 값은 노드 id).
  - 부모 size 를 받는 노드의 Size: Radio · ToggleButton · Tag (TagGroup) · ButtonGroup 안 Button · field 안 Button (Select 열기 · NumberField 증감 · picker 버튼) · InlineAlert 제목 등.
  - Select · ComboBox 안 ListBox 의 Selection Mode · Disallow Empty Selection, 그 항목의 Selected (RAC picker 가 선택을 소유). DatePicker 안 달력의 기존 숨김도 같은 함수로 옮겼다.
- **칩 묶음 제목 "Options" 제거** (사용자 「options도 여러 section에 들어있는데 한곳에 통일해야 하지않나?」 → 「섹션 유지, 제목만 정리」): 같은 제목이 Content · Appearance · Behavior 마다 반복됐다 (원본 기준 134곳). 칩은 뜻대로 각 섹션에 두고, 기본 묶음은 제목 없이 섹션 이름이 그룹 이름 (`aria-label`). Show · Fill 제목은 칩 글자가 그 말을 뗀 이름이라 남긴다.

### Fixed

- **CheckboxGroup 의 Required 가 Checkbox 에 닿지 않던 것**: 그룹 안 Checkbox 가 `isRequired=false` 를 넘겨, RAC 의 `isRequired ?? 그룹 값` 에서 그룹 값이 끊겼다. 이제 각 checkbox input 이 required.
- **DateRangePicker 의 Allows Non-Contiguous Ranges 가 달력에 닿지 않던 것**: 안 RangeCalendar 가 `false` 를 넘겨 RAC context 의 picker 값을 덮었다.
- **CardView Variant 가 다시 열면 지워지던 것**: 열 때 마이그레이션이 옛 `default` 만이 아니라 모든 값을 지웠다 — 이제 `default` 만.
- 테스트 `unusedPropRemoval` · `ownerDecidedProps` · `groupRequiredDom` (원복 RED: CardView Variant · 그룹 Required). Live (headed Chrome, 원본 12종): 숨긴 칸이 사라지고 안내가 부모 이름 (TagGroup · Select · CheckboxGroup …) 을 가리키는지, 칩 묶음에 "Options" 제목이 없는지 확인. 조사 결과 중 이번 범위 밖: Canvas · Preview 한쪽에만 반영되는 칸 11개 (Form · Breadcrumb · TabList Size, Link · GridList Quiet 등), D2 출처와 이름이 다른 prop 약 120개 (field 9종 Quiet 등 — 동작하므로 제거하지 않음).

## [그룹 "+" 항목 — Option N 으로 이어 붙인다] - 2026-10-14

### Fixed

- **RadioGroup · CheckboxGroup 의 "+" 가 "Radio" · "Checkbox" 를 넣던 것** (사용자 「radioGroup, CheckboxGroup 기본 값들이 option 1, option 2 .. slot에서 추가시 Radio, Checkbox로 나타난다. Option x 로 통일」): 이제 template 의 항목처럼 다음 번호로 붙는다 — "Option 3", Radio 는 값 `option3`. 번호는 그룹의 항목 수 다음, 이미 쓰인 글자 · 값은 건너뛴다.
  - **Why**: 그룹 항목 "+" (`itemInsert.ts`) 가 원본 기본값 그대로 노드를 만들었다. Radio 원본의 값은 `radio` 라 추가한 Radio 마다 같은 값이 되어, RAC RadioGroup 이 둘을 한 값으로 보고 RadioGroup Value 목록에도 하나만 나왔다. Checkbox 는 그룹 안에서 노드 id 가 RAC 값이라 (`delegatedDom` `checkbox`) 글자만 채운다.
  - 테스트 `groupOptionInsert` (원복 RED 2). Live (headed Chrome): 두 그룹에 "+" 두 번 — Canvas · Preview 모두 Option 1 ~ 4, Radio 값 option1 ~ 4, Preview 에서 Option 3 을 누르면 그것만 선택, 콘솔 오류 0.

## [Design 패널 글자 칸 이름 — D2 정본 (design-data) 의 label] - 2026-10-14

### Changed

- **컴포넌트 자신의 글자 칸 (`children`) 이름을 D2 정본으로 맞췄다** (사용자 「RAC,RSC 레퍼런스에 dom 구조를 확인한다면 더 명확해 지지않나」 → 「진행해」): Button 은 "Text", ToggleButton 은 "Label" 처럼 같은 종류의 글자가 컴포넌트마다 다른 이름이었다. S2 1.8.0 은 `children` 을 "content" 로만 적어 답이 없고, 다음 정본 Spectrum design-data 가 컨트롤 · 항목 · 상태의 글자를 `label` 로 부른다 (button anatomy `label` "Button text" · breadcrumbs 항목 · badge · status light · table column `label`).
  - Text → Label: Button · Breadcrumb · Badge · Column · FileTrigger (FileTrigger 는 design-data 에 없어 그 글자인 Button 을 따른다). 그대로: 글자 요소 (Text · Paragraph · Heading · Label · Description · FieldError · Cell …) 는 Text, 값 부품 (SelectValue · SliderOutput · MeterValue · ProgressBarValue) 은 Value, Header 는 Title (design-data menu `sectionHeader`).
  - prop 이름 · 저장 값 · 렌더는 바뀌지 않는다 — 패널 칸 이름만.
  - 게이트 `propSectionConsistency` 에 칸 이름 표 추가 (원복 RED: Button "Text" 로 되돌리면 실패). Live (headed Chrome): Button · Badge · Breadcrumb · FileTrigger · Column 을 놓고 Design 패널 Content 첫 칸이 "Label" 인지 확인, 콘솔 오류 0.

## [Design 패널 섹션 — prop 의 뜻으로 한 섹션] - 2026-10-13

### Changed

- **같은 prop 이 컴포넌트마다 다른 섹션에 있던 것을 한 규칙으로 맞췄다** (사용자 「선택 값이 radio는 content 에있고, tabs는 behavior에 있고 일관성이 없다」 · 「checkbox 는 또 behavior에 있다」 · 「이렇게 해서는 안된다. 컴퍼넌트별 프러퍼티 section이 일관성이 없다」 · 「checkbox는 error message가 behavior에 있고 다른컴퍼넌트는 error message가 content에 있다」). 규칙 — **Content**: 보여 주는 것과 담는 값 (글자 · 값 · 선택 · 값의 범위와 형식 · Name · Data · 링크), **Appearance**: 모양과 배치, **Behavior**: 반응과 제약 (Disabled · Read Only · Required · Invalid · Auto Focus · Selection Mode · 열림 · 검증 · 트리거 · 제출), **Locale**: 지역 · 달력 설정.
  - Behavior → Content: Error Message (19 컴포넌트 — Label · Description 과 같은 글자), Selected (Checkbox · Switch · ToggleButton · Radio · Tag · Card · 컬렉션 항목), Indeterminate (Checkbox · ProgressBar · ProgressCircle), 날짜 계열 Min · Max Value (NumberField · Slider 와 같이), Dialog Role. Appearance → Content: ColorArea · ColorSlider 의 Color Space · Channel, DatePicker · DateRangePicker 의 Calendar Icon, Field 의 Type. Content → Behavior: 달력의 Page Behavior. Content → Appearance: 달력의 Visible Duration · Weeks in Month, Slider Fill Offset. Content → Locale: NumberField Locale. Tabs Selected Tab 은 Content.
  - 이름만 같고 뜻이 다른 둘은 그대로: Button `type` (submit · reset — Behavior) ↔ 입력 `type` (Content), Form `target` (제출 — Behavior) ↔ 링크 `target` (Content).
  - 게이트 `propSectionConsistency` — 한 prop key 는 모든 컴포넌트에서 한 섹션, 글자 · 값 · 선택 key 는 Content.
- **섹션 안 순서도 한 순서** (사용자 「순서도 맞춰」): 필드는 계약 선언 순서와 kind 묶음 (글자 → 선택 → 숫자) 을 따라 컴포넌트마다 달랐다 — Checkbox 는 Error Message 가 Name 앞 · TextField 는 뒤, 날짜의 Min Value (글자 칸) 와 NumberField 의 Min (숫자 칸) 이 Name 앞뒤로 갈림, 칩 Disabled · Required 순서도 제각각. 이제 prop key 순서 표 하나 (`KEY_ORDER` — `GenericFieldRenderer.tsx`) 가 먼저다: Label · Title · Description · Error Message · Placeholder → Icon → Value · Default · Min · Max · Step → Name → 링크 → 입력 종류 → Variant · Size · 배치 → 선택 · 검증 방식 → 칩 (Selected · Indeterminate … Quiet · Emphasized · Disabled · Read Only · Required · Invalid … Auto Focus 맨 끝). 표에 없는 key 만 그 뒤에 kind 묶음 · 계약 순서.
  - Button 계열의 글자 · Icon 칸 (`CatalogButtonChildFields`) 도 글자 먼저, Icon 다음 (종전 Icon 먼저). IconButton 은 원본의 Icon 필드와 이 칸의 Icon 이 둘 다 나와 Icon 이 두 번 보였다 — 원본에 Icon 필드가 있으면 이 칸을 그리지 않는다.
  - Live: 원본을 다시 전부 놓아 섹션 186개를 뽑고 두 필드의 앞뒤가 컴포넌트끼리 뒤바뀌는 쌍을 셈 — 10 → 0. 테스트 `GenericFieldRenderer.order` (원복 RED 3), builder 5608 통과.
  - Live (headed Chrome): 원본 151개를 차례로 놓고 Design 패널의 섹션별 필드를 뽑아 대조 — 같은 필드 이름이 두 섹션에 나오는 것은 위의 뜻이 다른 둘 (+ 서로 다른 "Show …" 필드) 뿐. Checkbox: Content `Label · Description · Error Message · Name · Value · Selected · Indeterminate`, Behavior `Disabled · Invalid · Read Only · Required · Auto Focus`. shared 1599 · builder 5605 통과.

## [단일 선택 — RadioGroup Value · Tabs 는 한 값만] - 2026-10-13

### Added

- **Tabs 의 Design 패널 Content 에 Selected Tab** (사용자 「tabs컴퍼넌트의 프러퍼티에 Selected Tab을 선택할수있게 하는것이 편할듯한데」 · 「선택 값이 radio는 content 에있고, tabs는 behavior에 있고 일관성이 없다」 — 고른 값은 RadioGroup Value · TextField Value 처럼 Content, 항목의 Selected 는 Behavior): 선택지는 그 Tabs 의 Tab (글자로 표시), 지금 선택된 Tab 을 보여 주고 고르면 그 Tab 의 Selected 를 켠다 (다른 Tab 은 꺼진다). S2 `defaultSelectedKey` 자리지만 Tabs 에 키를 저장하지 않는다 — 원본 Tab 은 `id` 가 없어 키가 record identity (렌더 키 — 문서에 두지 않는다) 라서 (`catalogTabsSelectedTab` · `catalogSingleSelectionCommand`).
  - Live (headed Chrome, Design 패널 클릭): Selected Tab `Tab 1` 눌림 → `Tab 2` 클릭 → Canvas · Preview `[false,true]`, 칩 `Tab 2` 눌림, Tabs 의 키 없음. 콘솔 오류 0. 테스트 `singleSelection` Tabs 칸.

### Fixed

- **RadioGroup 의 Value 를 고를 수 없었다** (사용자 「radioGroup, Tabs 등은 하나의 값만 선택되어야한다. 현재 radioGroup 프러퍼티에 value옵션이 있지만 동작하지않는다」): Value 의 선택지는 자식 Radio 의 value 에서 만드는데, Design 패널이 선택지를 만들 때 노드를 type 만으로 넘겨 (`editContract.ts` `{ type }`) 선택지가 늘 비어 있었다. 이제 패널이 record 트리에서 그룹의 Radio (RadioItems · frame 을 건너 — RAC 그룹 context 와 같이) 의 value 를 읽어 채운다 (`catalogRadioGroupValueOptions` — `catalogRuntime/singleSelection.ts`).
  - **Why**: 선택지 0개라 Value 를 쓸 길이 없었고, 그룹 값보다 Radio 의 Selected 가 먼저라 둘을 따로 쓰면 엇갈렸다.
- **한 값만 고르는 컬렉션 · 그룹에서 여러 항목이 Selected 일 수 있었다**: Tabs · RadioGroup (늘), ToggleButtonGroup · ListBox · GridList · Tree · Table · Menu · TagGroup · CardView (`selectionMode` single) 에서 항목을 Selected 로 켜면 다른 항목의 Selected 가 같은 step 에서 꺼진다 (`catalogSingleSelectionCommand` — Properties 패널 쓰기와 한 transaction). multiple 은 그대로 각자다. RadioGroup 의 Value 와 Radio 의 Selected 는 한 선택으로 서로 따라간다 (Value 를 고르면 그 Radio 가 Selected, Radio 를 Selected 로 켜면 Value 가 그 값, 끄면 Value 가 빈다). Tabs 는 Tab 을 Selected 로 켜면 문서에 남은 Tabs 키 (`defaultSelectedKey` — Selected 보다 앞선다) 를 비운다.
  - Live (headed Chrome, Design 패널 클릭): RadioGroup Value = Option 2 → Canvas Radio `[false,true]` · Preview checked `[false,true]`. Radio 1 의 Selected → Radio `[true,false]` · Value `option1` · Preview `[true,false]`. Tabs 의 Tab 1 → Tab 2 Selected → Canvas · Preview `[false,true]`, Tab 1 의 Selected 꺼짐. 콘솔 오류 0. 테스트 `singleSelection` (선택지 · Value ↔ Radio · Tabs · ListBox single/multiple — 원복 RED 3), builder 5604 통과.

## [컬렉션 항목 Selected — 목록 · 트리 · 표 · 메뉴 · 탭의 선택을 항목에서 고른다] - 2026-10-13

### Added

- **ListBox · GridList · Tree · Table / TableView · Menu · Tabs 의 항목에 Design 패널 `Selected`** (사용자 「static으로 추가된 listboxitem 인경우 상태 선택 selected, default 등을 선택할수있어야하지않나」 → 「권장안 1진행해. listbox만 문제가 아니라 동일한 패턴 이더 있다 모두 수정해」): 정적으로 넣은 항목이 처음부터 선택된 상태인지 고를 자리가 없었다 — ListBox 는 편집 자리가 없는 `selectedKey` 를 읽었고, GridList · Tree · Table · Menu 는 늘 빈 선택으로 시작했고, Tabs 는 첫 활성 탭만 골랐다. 이제 Tag · Card 처럼 항목의 `Selected` (`isSelected` — RAC 항목에는 선택 prop 이 없어 composition 확장, `ITEM_SELECTED_PROP_CONTRACT`) 가 컬렉션의 RAC 선택 초기값이다.
  - **Why**: RAC 에서 선택은 컬렉션의 것 (`defaultSelectedKeys`) 이라 항목 원본을 상태별로 바꿔 끼우는 방식 (pen.dev) 은 Canvas 그림만 바꾸고 DOM 선택과 갈린다. 데이터 바인딩 목록은 행이 template 하나에서 나와 행마다 원본을 바꿀 수도 없다.
  - DOM: 컬렉션이 `Selected` 인 항목의 키를 `defaultSelectedKeys` 로 넘긴다 (`catalogCollectionSelectedKeys` — section · TableBody · 부모 TreeItem 을 건너서, `delegatedDom.runtime.ts`). Tabs 는 문서의 `defaultSelectedKey` → 첫 `Selected` · 활성 탭 → 첫 활성 탭 순. 바뀐 선택은 컬렉션을 다시 만든다 (RAC 는 첫 초기값만 쓴다). Table 행에 RAC 키 (`id` — 작성자 HTML id 가 있으면 그것) 를 준다.
  - Canvas: 같은 판정 (`catalogItemStartsSelected` — `selectionMode` 가 none 이면 선택 없음, RAC 와 같다) 으로 `_isSelected` 를 칠한다 (`presence.ts`). Menu 항목 (MenuSection 안) 과 TableView 의 행도 컬렉션 항목 표에 들어갔다 (`COLLECTION_ITEM_OWNERS`). Table 의 전체 선택 checkbox 는 행이 다 선택되면 체크, 일부면 indeterminate (RAC `useTableSelectAllCheckbox`).
  - Table 행 · Tree 항목의 선택 칠이 rule 에 없어 Canvas 만 비어 있던 것을 맞췄다 — Row `selected` 강조색 + 흰 글자 (`Table.css` 와 같은 값), TreeItem `selected` `accent-subtle` (`Tree.css`). 그전에는 선택 항목을 만들 수 없어 드러나지 않았다.
  - Live (headed Chrome, Compare Mode): ListBox · GridList (multiple) · Tree (single) · Tabs 의 둘째 항목 `Selected` → Canvas `_isSelected` = Preview `aria-selected` (`[false,true,false]` · `[false,true]`), Tree 선택 행 배경 Canvas · Preview 같은 연한 강조색, chevron · 글자색 일치. ListBoxItem 을 고르면 Design 패널에 Selected · Disabled. 콘솔 오류 0. 테스트 `collectionItemSelection` (6 컬렉션 · selectionMode none) · `adr256TableNodeTree` (행 checkbox · 전체 선택 indeterminate · 체크 — Canvas = Preview), shared 1597 · builder 5600 · rendering 1315 통과.

## [Canvas 더블클릭 — 인스턴스 안 묶음으로 들어간다] - 2026-10-13

### Fixed

- **ListBox 항목을 더블클릭하면 항목 글자 편집이 열리고 안의 자식 (Icon · Text) 으로 들어가지 못했다** (사용자 「listboxitem 은 group 의 개념이고 child 가 존재한다 더블클릭으로 child 에 접근해야하는데 더블클릭시에 text edit 가 나타난다」): 편집 맥락 (`editingContext`) 이 문서 노드 id 만 받아, 인스턴스 안의 원본 template 위치 (ListBox 의 항목 · Card 의 Content — 같은 template id 가 모든 인스턴스의 그 자리를 가리킨다) 는 들어갈 수 없었고, 더블클릭이 글자 편집 (항목 자신의 `{label}`) 으로 넘어갔다. 맥락이 그 위치의 record identity 도 받는다 (`catalogContextOf` — `canvasPick.ts`). 클릭 판정 · Escape · Layers 선택 · 범위 선택 (`canvasGesture`) · 단축키 · 맥락 테두리가 같이 읽는다. Card 도 같아져 Content 를 거쳐 제목을 선택한 뒤 더블클릭이 편집한다 (종전: Card 안 두 번째 더블클릭이 바로 제목 편집).
  - Live (Chrome, Compare Mode — 실제 마우스): ListBox 항목 위 클릭 → ListBox 선택, 더블클릭 → 항목 선택, 다시 더블클릭 → 항목 안 label Text 선택 (글자 편집 없음), 다시 더블클릭 → label 글자 편집, Escape 두 번 → ListBox 맥락 · 항목 선택. 콘솔 오류 0. 테스트 `canvasTextEditTarget` (ListBox · Card — 원복 RED 확인), builder 5591 통과.

## [Components 페이지 — 컬렉션 item 원본 칸] - 2026-10-13

### Added

- **Components 페이지의 컬렉션 카드 Item 줄 맨 앞에 item 원본 (◆) 칸** (사용자 「Item 줄 맨 앞에 ◆ 원본 칸 추가해」): ListBoxItem · GridListItem · Tab · TreeItem · Tag · Radio · Breadcrumb 같은 item 원본은 팔레트에 없어 자기 카드가 없고, Item 줄에는 instance (◇) 만 있어 원본을 볼 · 고칠 자리가 없었다. 이제 줄 맨 앞이 그 원본의 편집 sample 이다 — 다른 카드의 ◆ 처럼 props · 기본 스타일 편집이 그 원본의 프로젝트 기본값이 된다 (`componentsPage.ts`, `originSampleId`). 라벨은 옆 instance 처럼 "Item" 으로 채운다. item 원본이 자기 카드를 가진 경우 (ButtonGroup 의 Button · Breadcrumbs 의 Link · CheckboxGroup 의 Checkbox · DisclosureGroup 의 Disclosure · ToggleButtonGroup 의 ToggleButton) 는 그 카드에 ◆ 가 있어 Item 줄에 다시 두지 않는다 — sample 은 페이지에 한 곳만. (Menu · Popover · Dialog · Select 등의 Item 줄은 template 안 첫 상태 원본인 trigger Button 이다 — 종전 그대로, MenuItem 칸은 없다.)
  - Live (Chrome): Components 페이지 ListBox 카드 Item 줄 = `◆ ListBoxItem` · `◇ Selected` · `◇ Default` · `◇ Selected / Disabled` · `/ Hover` · `/ Pressed` · `/ Focus`, ◆ 칸은 선택 모양 (강조색 · 흰 글자 "Item"). 콘솔 오류 0. 테스트 `phase4eOriginView` (◆ 칸 · 편집 = 원본 기본값 · 페이지 노드 중복 0 — 원복 RED 확인).

## [ListBox · GridList — RAC 레퍼런스 테마] - 2026-10-13

### Changed

- **ListBox 가 RAC 레퍼런스 (`react-aria.adobe.com/ListBox` 의 `ListBox.css`) 모양이다** (사용자 「listbox, gridlist 를 RAC, RSC 레퍼런스 테마 기준으로 수정해」):
  - 목록: 0.5px 테두리 (새 토큰 `{border.width.hairline}` · `--border-width-hairline`) · 모서리 12 (`--radius-xl`) · padding 4 · gap 없음. 테두리와 항목 사이 4 는 목록의 padding 이다 — 레퍼런스는 항목 margin (좌우 4 · 첫 항목 위 · 끝 항목 아래 4) 으로 주지만 항목 margin 은 두지 않는다 (사용자 「margin은 없애고 react-aria-ListBox 에 padding으로」). 그래서 section 안 항목은 header · section 끝에 붙는다. 크기 (폭 · 높이) 는 레퍼런스의 250 · 100–300 고정값을 따르지 않는다 — 2026-07-29 사용자 결정대로 작성자가 정한다.
  - 항목: margin 없음, 최소 높이 32, 모서리 8, 끝 항목을 뺀 항목 아래 0.5px 구분선 (좌우 12 안쪽). hover 칠 없음 · 누름은 연한 칠 · **선택은 강조색 배경 + 흰 글자** (종전 `--accent-subtle`). 선택 체크 글리프는 그리지 않는다 (레퍼런스대로 강조 배경만).
  - **다중 선택에서 붙어 있는 선택 항목끼리 맞닿은 쪽 모서리는 각지다** (사용자 「인접한 두개를 선택시 border radius 가 인접한부분은 제외된다」) — 위 항목은 아래 두 모서리, 아래 항목은 위 두 모서리. 사이 구분선은 흰 30%.
  - label 은 항목 글자 (14 · 굵기 500 · 항목 색 — 선택 시 흰색), description 은 12 · 항목 색 (종전 muted). section header 는 한 줄 전체 · 12 · 600 · padding 4 16 · overlay 바탕 · 위아래 0.5px 선. section 사이 여백 (종전 12) 은 없다.
  - DOM: 생성 CSS (`generated/ListBox.css`) 의 단독 목록 선택자 (`.react-aria-ListBox:not(.react-aria-Popover *)` — rule 의 `rootSelectors`) 가 수동 `ListBox.css` 위에 얹힌다. 수동 시트는 Builder 자체 목록 (`builder-components.css`) 과 같이 쓰여 손대지 않았다. DOM ListBoxItem 에 `data-variant="default"` 를 달아 rule 의 상태 블록 (누름 · 선택 칠) 이 닿는다. ListBoxItem 원본의 옛 선택 배경 (`stateRules.selected` `--accent-subtle`) 삭제.
  - Canvas: 목록 padding 은 rule `containerStyles` 를 그대로 읽고, 항목의 `flex-shrink: 0` 은 같은 rule 선택자에서 읽는다 (`catalogListItemFlexShrink` → resolver `_itemShrink` · `_lastItem`). Skia `listbox_item` 이 구분선을 그린다. 항목 안 Text 가 항목 색을 받는다 (`MANUAL_ITEM_LABEL_COLORS.ListBoxItem`). section 안 항목도 같은 부품 규칙 (`manualBoxRules` `ListBoxSection`).
- **Select · ComboBox 의 팝오버 목록이 레퍼런스 `.dropdown-listbox` · `.dropdown-item` 이다**: 목록은 팝오버 바탕 그대로 (테두리 없음, padding 4 — 항목 margin 없음), 항목은 왼쪽 24 를 체크 자리로 비우고 (padding `(32 − 1lh) / 2` 12 · 24) 굵기 500, 선택 표시는 16 lucide 체크 (왼쪽 4 · 항목 글자색 — 종전 강조색 `✓` 글자), 키보드 포커스 항목은 강조색 + 흰 글자 (종전 연한 회색), 누름은 연한 칠, 선택 배경 · hover 칠 없음. section header 는 왼쪽 28.
  - ListBox rule 의 `&:is(.react-aria-Popover *)` 블록 (생성 CSS). 수동 `ListBox.css` 의 팝오버 규칙은 Builder 자체 picker (패널 Select — `data-catalog-id` 없는 팝오버) 로 좁혔다 — Builder 화면은 그대로다. 열린 picker 는 Canvas 가 그리지 않는다 (DOM 만).
- **GridList 가 RAC 레퍼런스 (`react-aria.adobe.com/GridList` 의 `GridList.css`) 이미지 카드다** (사용자 「이미지 카드로」 — 레퍼런스 예제는 전부 사진 카드):
  - 원본 항목이 `GridListItem > Image + Text + Text[slot=description]` 이다 (Image 노드 추가 — 행 템플릿에서 행마다 사진 `src` · `alt` 를 채울 수 있다). 사진은 카드 폭 · 높이 200, 비어 있으면 Image 원본의 회색 자리 표시.
  - 카드: overlay 바탕 · 한 겹 그림자 (`0 2px 8px rgb(0 0 0 / 0.15)`) · 테두리 없음 · 모서리 8 · 아래 padding 16 · 최대 폭 250, 글자는 좌우 16 안쪽 (label 14 · 500, description 12 — 둘 다 카드 글자색, 종전 muted), 사진과 글자 사이 16 · 글자 사이 8. 선택은 카드 안쪽 2px 링 (글자색 + 안쪽 흰 70% 선 — 종전 강조색 2px 테두리), 누르면 0.98 로 줄어든다. hover 칠 없음. 선택 체크박스 (`Checkbox[slot=selection]`) 는 사진 위 16 안쪽.
  - 목록: padding 8 · 카드 사이 16 · 모서리 8, `grid` 는 `repeat(auto-fit, minmax(100px, 200px))` 가운데 정렬 (종전 고정 2열 — `columns` 기본값 삭제), `stack` 은 가운데 한 열 (카드 상한 250 — 사진이 없는 카드도 사진 카드 폭으로). section 은 같은 격자에 header (16 · 500 · overlay · hairline 테두리 · 모서리 8) 를 한 줄 전체로.
  - DOM: 수동 `GridList.css` 를 레퍼런스대로 다시 썼다 (Builder 의 GridList 는 자기 class — `list-group` — 라 닿지 않는다). 카드 바탕 · 그림자 · gap 은 GridListItem rule (생성 CSS · Canvas 같이). Canvas: `manualBoxRules` GridList · GridListItem 이 같은 값, 그림자는 rule 의 `boxShadow` 를 Canvas 도 그린다.
  - S2 ListView prop (`isQuiet` · `selectionStyle` · `overflowMode` · `hideLinkOutIcon`) 은 그대로다.

### Fixed

- **GridList 카드의 링크 글리프가 카드 아래 padding 안, 글자 끝 (오른쪽 16) 에 놓인다** (사용자 「GridList 링크 글리프 자리 수정해」): 새 탭으로 여는 링크 항목 (`href` + `target="_blank"`) 의 글리프가 종전에는 행 목록처럼 카드 오른쪽 padding 을 글리프 + 간격 (16) 만큼 늘리고 세로 가운데 (사진 옆) 에 놓여 사진이 카드보다 16 좁았다. 카드 (`catalogLinkOutCardEndInset` — GridListItem) 는 padding 을 늘리지 않고 글리프를 아래 padding 16 의 가운데 · 끝에서 16 에 둔다 — 사진 위는 Canvas 가 자식 (Image) 아래에 칠해 가려지므로 쓰지 않는다. 레이아웃 (`styleFor`) · Canvas 글리프 (`ruleShapes`) · DOM 글리프 (`domBinding`) 가 같은 값을 읽는다 (`adr259ItemLinks` — 원복 RED 확인). MenuItem 은 그대로 끝 padding.
  - Live (Chrome, Compare Mode): 첫 카드에 새 탭 링크 — 카드 200 × 276 · 사진 200 (종전 184), 글리프 10 × 10 at (174, 263) Canvas = Preview, Canvas 부품 12 = Preview. 콘솔 오류 0.
- **엔진: auto 폭 상자의 좌우 margin 이 자식 배치 폭에서 빠지지 않았다** (CSS 2 §10.3.3): 부모가 넘긴 available (부모 content 폭) 에서 padding · border 만 빼 자식을 놓아, `margin: 0 4px` 상자 안의 `width: 100%` 자식이 상자보다 8 넓었다 (ListBox 항목 label — Canvas 1873 / Preview 1865). block · flex · grid 컨테이너 모두 자기 inline margin 을 뺀다 (`tree.rs` `auto_content_avail_w`, Rust `stretched_column_flex_item_with_margins_lays_children_in_its_content_box` — 원복 RED 확인). 엔진 parity (Chrome 대조) 811 통과.

- Live (Chrome, Compare Mode): ListBox (항목 3 + section 1) — Canvas 부품 18 = Preview (차이 0). padding 전환 뒤 기본 ListBox — 목록 padding 4 · 항목 margin 0, 항목 (4.5, 4.5 / 50.5 / 96.5) · 1911 × 46 이 Canvas = Preview (전과 같은 자리), Select 팝오버 목록 padding 4 · 항목 margin 0 · 32 높이. Preview 에서 다중 선택으로 위 두 항목을 누르면 강조색 · 흰 글자 · 모서리 `8 8 0 0` / `0 0 8 8` · 사이 선 흰 30%. GridList `grid` — 카드 200 × 280 셋 가운데 · `stack` — 250 × 276 한 열, 둘 다 Canvas 부품 12 = Preview, 카드를 누르면 링. Select · ComboBox 를 열면 항목 32 · padding 6 12 6 24 · 굵기 500, 고른 항목에 체크 16 (왼쪽 4), 화살표로 옮긴 항목 강조색 · 흰 글자. 콘솔 오류 0.
- ADR-248 G3 palette 비교의 ListBox · GridList 항목은 이 변경으로 옛 캡처와 달라 실패한다 (의도). 같은 하니스의 InlineAlert · Card · Menu · SearchField · TableView · Dialog · Popover · Tooltip 8 항목도 실패 중 — 이번 변경 밖.

## [Calendar · RangeCalendar — size 삭제 · 폭에 반응하는 크기] - 2026-10-13

### Removed (Breaking)

- **Calendar · RangeCalendar 의 `size` prop** (사용자 「size 삭제하고 레퍼런스처럼 폭에 반응하는 크기까지」): RAC 1.22 · S2 1.8 Calendar 에 size 가 없고 (design-data `calendar` · v3 도 없음), 우리 S · M · L 은 composition 확장이었다. 부품 (CalendarMonth · CalendarHeader · CalendarHeading · CalendarGrid) 의 숨은 size 도 삭제. 옛 문서의 size 는 로드할 때 한 번 지워진다 (`s2PropAlignment`). DatePicker · DateRangePicker 안 달력도 picker 의 size 를 받지 않는다 (picker 의 size 는 field 의 것).

### Changed

- **달력이 폭에 반응한다**: 폭을 정하지 않은 달력은 한 달 238 (셀 30 + td padding 2×2, 7칸) 이고 부모가 좁으면 같이 준다. 달력에 폭을 주면 (Styles width) 한 달이 그 폭을 채우고 — 넓게도 좁게도 (사용자 「캘린더 크기를 변경해도 캘린더 폭은 고정이다」) — 날짜 셀은 `폭 / 7 − 4` 다 (RAC starter 의 `calc(100cqw / 7 - gap)` — S2 의 셀 상한 32 는 두지 않았다). 요일 행 · header (nav 30 정사각형 · 제목 `--text-sm`) 높이는 고정.
  - DOM: `CalendarCommon.css` `.month { width: 238px; flex: 1 1 auto; max-width: 100%; min-width: 0; container-type: inline-size }` · 셀 `calc(100cqw / 7 - 4px)`. `Calendar.css` · `RangeCalendar.css` 의 size 블록 삭제.
  - Canvas: CalendarMonth 같은 상자 (`manualBoxRules`), grid 높이는 배치된 폭에서 다시 잰다 (`rewrap` — `catalogCalendarGridSize(columns, rows, emptyRows, width)`), Skia grid 는 상자 폭으로 셀을 그린다 (`BOX_SIZE_TYPES` CalendarGrid).
- **Month and Year Pickers** (같은 날 이어진 작업): picker 의 Select 는 기본 M Select 다 (origin template 의 `size: "S"` 삭제 — Canvas 22 / Preview 30 높이 차이 해소). 폭은 RAC 레퍼런스 방식 (header `gap: 4` · nav `flex-shrink: 0` · 두 Select 가 남은 폭을 똑같이 — `flex 1 1 0%` · DOM `contain: inline-size`), nav 버튼은 정사각형 30 (사용자 「높이가 30 이면 넓이도 30」). picker trigger 시작 padding 8 (사용자 「left padding 을 8 로」 — `PART_RULE_PASS_HOSTS` 로 picker 를 건너 trigger 에).
- **Select trigger 의 끝 padding = Button 의 위아래 padding** (사용자 「M 8 → 4」 · 「S · L 도 같은 식으로」): `--select-btn-pad-end` S 4 → 2 · M 8 → 4 · L 12 → 8 (XS · XL 그대로). 모든 Select.

### Fixed

- **엔진: column flex 안 `width: fit-content` 상자의 `%` max-width** (Chrome oracle): column 부모가 fit-content 자식에게 indefinite 폭을 내려 `max-width: 100%` 가 풀리지 않았고, 부모 커널이 상자만 clamp 해 자식은 clamp 이전 폭에 놓였다 (부모 175 > 내용 238 → 상자 175 / 자식 238, Chrome 175 / 175). intrinsic 키워드 폭도 명시 폭처럼 definite available 을 받는다 (`tree.rs` `child_cross_solve`, Rust `fit_content_box_with_percent_max_width_lays_children_at_the_clamped_width`).

- Live (Chrome, Compare Mode): Calendar · RangeCalendar 기본 238 × 236 · 폭 175 프레임 175 × 191 (셀 21) · 140 프레임 140 × 178 (셀 16) · 400 프레임 238 · 달력 폭 180 → 셀 22 · 400 → 400 × 352 (셀 53) · 600 → 셀 82 — 전부 Canvas 부품 9 = Preview (차이 0), `data-size` 없음. DatePicker (size L) 를 열면 달력 238 · 셀 30 · `data-size` 없음. 콘솔 오류 0.

## [RangeCalendar — 기간 표시를 S2 형태로] - 2026-10-13

### Changed

- **RangeCalendar 의 기간 표시** (S2 1.8.0 `Calendar.tsx` — `cellInnerStyles` · `selectionBackgroundStyles` · `selectionBorderStyles`): 시작 · 종료일이 반원 캡에서 **꽉 찬 원**으로 바뀌고, 기간 뒤로 **테두리 있는 연한 띠**가 날짜 사이를 메운다. 띠는 기간의 시작 · 끝, 주의 첫 · 끝 날, 달의 첫 · 끝 날에서 둥글게 끝나고, 중간 날짜는 원 없이 보통 글자색이다. 하루만 고른 기간은 원 하나다.
  - 띠는 td 의 `::before` 로 옮겨 셀의 원 (배경 · press scale) 과 다른 층에 그린다 (`RangeCalendar.css`). invalid 기간은 띠 `--negative-subtle` · 원 `--negative`.
  - Canvas 는 달력 선택을 그리지 않아 (Preview 실행 상태) 변화가 없다. DateRangePicker 안 달력도 같은 시트를 쓴다.
  - Live: Preview 에서 8 → 20 · 12월 28일 → 1월 3일 선택 — 원 · 띠 · 주 끝 (토 · 일) · 달 끝 (12/31 · 1/1) 둥글기 확인, Canvas 부품 9 = Preview.

## [Calendar — selectionMode] - 2026-10-13

### Added

- **Calendar `selectionMode` 추가** (RAC 1.22.1 · S2 1.8.0 — `useCalendarState` `selectionMode?: 'single' | 'multiple'`, 기본 `single`): Design 패널의 Selection Mode 가 Single · Multiple 을 고른다. Multiple 이면 Preview 에서 누른 날짜가 하나씩 선택에 더해지고, 다시 누르면 빠진다.
  - DatePicker 안 Calendar 는 picker 가 날짜 하나를 고르므로 노드의 값을 쓰지 않고 패널에서도 감춘다 (`CATALOG_PICKER_CALENDAR_PROPS`). RangeCalendar 는 RAC · S2 모두 이 prop 이 없다.
  - S2 정렬 조사가 이 prop 을 「RangeCalendar 가 맡음」 으로 잘못 분류했던 것을 고쳤다 — 범위 선택과 여러 날짜 선택은 다른 동작이다 (같음 535 → 536).

## [Calendar · RangeCalendar — 레퍼런스대로 border · padding · 배경 없음] - 2026-10-13

### Changed

- **Calendar · RangeCalendar 의 바깥 상자에서 border · padding · 배경을 지웠다**: RAC starter 의 `.react-aria-Calendar` 와 S2 `Calendar.tsx` `calendarStyles` 둘 다 border · padding · 배경 (hover · pressed 배경 포함) 이 없다. 달력은 놓인 바탕 위에 그대로 그려진다. 달력은 이제 내용 (월 묶음) 크기 그대로다 (M: 256 → 238 px 폭).
  - DatePicker · DateRangePicker 안 달력의 여백은 S2 처럼 Popover 의 padding 이 준다 (S2 `CalendarPopover` 의 padding 16 · 24, 우리 Popover rule M 16px).
  - rule (`componentRulesTable.ts`) 의 `colors.border` · 레이아웃 `borderWidth` 를 지우고 size 별 padding 을 0 으로 했다. 생성 CSS 는 `border: none` · `padding: 0`.
  - Canvas 의 `calendar_grid` primitive 가 rule 에 없는 border 를 기본값 (`{color.border}` 1px) 으로 그리던 것도 지웠다 — 이제 rule 이나 문서가 border 색을 줄 때만 그린다.
  - 배경은 rule 의 fill (base · hover · pressed) 을 transparent 로 — 생성 CSS `background: transparent`, Canvas 도 칠하지 않는다.
  - 확인: 실제 빌더 Compare Mode 에서 Calendar · RangeCalendar 의 Preview 배경 transparent (rest · hovered · pressed) · border 0 · padding 0, Canvas 상자 폭 = Preview 폭 (238), 부품 9개 Canvas = Preview (±1.5).

## [S2 TextField — type 값] - 2026-10-13

### Breaking Changes

- **TextField `type` 에서 `number` 삭제** (S2 1.8.0 — `@react-types/shared` `type?: 'text' | 'search' | 'url' | 'tel' | 'email' | 'password'`): Design 패널의 Input Type 이 Text · Email · Password · Search · Tel · URL 을 고른다.
  - **Why**: S2 는 숫자 입력을 NumberField 에 맡긴다 — 브라우저 `<input type="number">` 는 지역 숫자 표기 · 형식 (통화 · 퍼센트) · 증감 동작이 브라우저마다 다르다. 숫자 입력은 NumberField 를 쓴다.
  - 옛 문서의 `type: "number"` 는 로드할 때 한 번 지워진다 (기본 `text`, `s2PropAlignment.ts`). 다른 값은 그대로다. 단독 Input 의 `type` (RAC `Input`) 은 그대로 `number` 를 받는다.
  - S2 정렬 조사 5.1 의 남은 값 차이에서 빠졌다 (같음 534 → 535).

## [S2 Form — method 값] - 2026-10-13

### Added

- **Form `method` 에 `dialog` 추가** (S2 1.8.0 — `@react-types/shared` DOMProps `method: 'get' | 'post' | 'dialog'`): Design 패널의 Method 가 GET · POST · Dialog 를 고른다. Preview 는 값을 RAC `Form` 에 그대로 넘긴다 (`dialog` 는 안 `<dialog>` 를 닫는 HTML form method).
  - S2 정렬 조사 5.1 의 남은 값 차이에서 빠졌다 (같음 533 → 534).

## [S2 InlineAlert — fillStyle 값 이름 · variant 아이콘] - 2026-10-13

### Breaking Changes

- **InlineAlert `fillStyle` 값이 S2 이름으로 바뀜** (S2 1.8.0): `outline` → `border` · `subtle` → `subtleFill` · `bold` → `boldFill`. 기본값은 `border` 다.
  - 옛 문서의 값은 로드할 때 한 번 새 이름으로 바뀐다 (`s2PropAlignment.ts`). 화면은 그대로다.
  - **Why**: 2026-10-10 에 house 이름 (outline · subtle · bold) 으로 들였는데, D2 정본 (S2 1.8.0) 이름과 달랐다 (S2 정렬 조사 5.1 의 남은 값 차이).
  - 값 → 칠 (fill) 은 rule 의 `fillStyleValues` 하나가 잇고, Canvas paint (`resolveCatalogPaint`) 와 생성 CSS (`[data-fill-style]` 선택자) 가 같이 읽는다. Button (`fill` · `outline`) · Badge 는 그대로다.

### Added

- **InlineAlert 의 variant 아이콘** (S2 `InlineAlert.tsx`): informative · positive · notice · negative 가 오른쪽 위에 아이콘을 그린다. neutral 은 그리지 않는다.
  - 아이콘은 S2 의 InfoCircle · CheckmarkCircle · AlertDiamond · AlertTriangle 에 대응하는 Lucide `info` · `circle-check` · `octagon-alert` · `triangle-alert` 이다. Lucide 에 마름모 경고 아이콘이 없어서 notice 는 팔각형으로 대신했다.
  - 이름은 S2 문자열이다 (정보 · 성공 · 경고 · 오류 / Information · Success · Warning · Error, `role="img"`).
  - 색은 S2 `--iconPrimary` 를 따른다.
    - border: variant 색.
    - subtleFill: variant 색, 단 notice 는 negative 색.
    - boldFill: 흰색, 단 notice 는 검정.
  - 아이콘은 S2 처럼 InlineAlert 가 직접 그린다 (자식 노드가 아니다). 위치는 상자 오른쪽 위다 — S2 는 `float: inline-end` 인데 엔진에 float 가 없어 고정 위치로 대신했다.
  - 제목은 아이콘 크기만큼 끝 여백을 두고 그 앞에서 줄을 바꾼다. 이 값은 rule 의 `variant` 블록이 주고, 부모 rule 은 배치만 한다는 ADR-253 원칙에 맞춘 것이다.
  - 위치:
    - `packages/shared/src/catalog/document/inlineAlertIcon.ts`
    - `components/InlineAlertIcon.tsx`
    - `runtime/domBinding.runtime.ts`
    - `apps/builder/src/builder/catalogRuntime/ruleShapes.ts`
    - `generated/componentRulesTable.ts`
    - `document/rulePartRules.ts`

### Fixed

- **child 배치만 하는 container variant 가 상자의 variant · size 칠을 지움** (생성 CSS · Canvas 공통): rule 의 `containerVariants` 가 있으면 생성기와 Canvas 가 모두 「composition 이 상자를 소유한다」 로 보고, variant 색 블록 · size padding · 테두리를 건너뛰었다.
  - 이제는 root 에 `styles` 를 주는 블록이 있을 때만 상자를 소유한다고 본다 (AvatarGroup 은 그대로).
  - 두 consumer 는 같은 판정 함수를 읽는다 (`catalogCompositionOwnsContainerBox` · `CSSGenerator.ts` `containerVariantsStyleRoot`).
  - **Why**: Canvas 가 InlineAlert 테두리 1 px 를 레이아웃에서 빼 높이가 2 px 달랐다 (live 에서 발견, 출시 전 수리).

### Tests

- `inlineAlertIcon.test.tsx` 8: 4 variant 의 Canvas · DOM 아이콘 자리 · 이름 · 색, neutral 없음, variant 편집 · undo, 생성 CSS. `inlineAlertFillStyle.test.tsx` 7 (옛 값 로드 전환 포함). 원복 RED 14/14.
- live (실제 Builder, 라이트 · 다크): Design 패널 Fill Style · undo · 저장 · 다시 열기 · 15 상자 Canvas = Preview 칠 · 12 아이콘 Canvas = Preview (중심 · 크기 ±1 · 색), 각 37/37. 긴 제목도 아이콘 앞에서 줄을 바꾼다 (Canvas = Preview ±1).

## [S2 도움말 · 앞 글자 · 항목 링크 완료 — ADR-259 Implemented] - 2026-10-13

### Changed

- **ADR-259 Implemented** (Phase 0 ~ 4): S2 field 도움말 (`contextualHelp`, 16 field) · 입력 앞 글자 (`prefix`, 5 field) · 항목 링크 (`href` · `target` · `rel`, 7 type + `hideLinkOutIcon`). 각 Phase 의 사용자-가시 변경은 아래 Phase 1 · 2 · 3 엔트리에 있다.
  - 마감 확인 (G4):
    - perf ratchet A 등급 초과 0.
    - initial 번들 상한 안 (ADR-259 전 대비 Builder JS gzip +6,614 B · Preview +1,442 B).
    - live 하니스 재실행 13/13 · 51/51 · 106/106.
  - 본문: `docs/adr/completed/259-s2-contextual-help-prefix-item-links.md` (Live Exercise 절).

### Documentation

- `docs/explanation/research/S2_PROP_ALIGNMENT_2026-10.md` §6.1 — 「라」 (`contextualHelp` · `prefix` · `hideLinkOutIcon`) 와 「링크」 를 도입 완료로 갱신.
- `.claude/rules/ssot-hierarchy.md` D3 sub-part — 「라벨 행 · 앞 글자 · 도움말」 한 줄 (FieldLabel 별칭 · ContextualHelp 노드 트리 · 앞 글자 Group 상자).

## [S2 field 도움말 — ADR-259 Phase 3] - 2026-10-13

### Added

- **field 도움말 `contextualHelp`** (ADR-259 Phase 3 — S2 1.8.0 TextField · TextArea · NumberField · ComboBox · Select · ColorField · ColorSlider · DateField · DatePicker · DateRangePicker · TimeField · SearchField · CheckboxGroup · RadioGroup · Slider · TagGroup): Design 패널 Content 의 **Contextual Help** 에서 None · Help · Info 를 고른다.
  - 고르면 field 라벨 옆에 도움말 버튼 (`?` · `i` 글리프) 이 붙고, 누르면 제목 · 설명 · 링크가 든 Popover 가 열린다.
  - 넣기 · 바꾸기 · 빼기는 각각 undo 한 번이다.
  - 버튼 크기는 field 크기를 따른다 (S · M 20 px, L · XL 24 px).
  - 접근성 (S2 그대로):
    - 버튼 이름은 「라벨 + 도움말」 이다 (예: 「Price 도움말」, info 는 「정보」).
    - 열린 Popover 는 제목 Heading 이 이름인 dialog 다.
    - 비활성 field 안에서도 도움말은 열린다.
  - 새 type 둘:
    - **ContextualHelp** — 팔레트 overlay 묶음의 Popover 뒤. field 밖 (제목 옆 등) 에도 둘 수 있다. 원본은 `ContextualHelp > Button > Icon + Popover > Heading + Content + Footer` 이고, Popover 의 위치 prop 은 ContextualHelp 의 prop 이다.
    - **FieldLabel** — Label 과 도움말을 한 줄로 묶는 라벨 행. 도움말을 넣을 때만 생긴다. field 레이아웃 (위 · 옆 라벨) 에서 Label 의 자리를 그대로 이어받는다.
  - 배치된 field 에 도움말을 넣으면, Phase 2 와 같이 field 의 자식이 소유 사본이 된다 (사용자 결정 2026-10-13).
  - 위치:
    - `apps/builder/src/builder/catalogRuntime/contextualHelpCommand.ts`
    - `panels/properties/catalog/CatalogContextualHelpField.tsx`
    - `packages/shared/src/components/{ContextualHelp,FieldLabel}.tsx`
    - `packages/shared/src/catalog/document/{contextualHelp,rulePartRules,sizePropagation}.ts`
    - `resolution/resolver.ts`
    - `runtime/{presence,domBinding.runtime,compositionRoot}.ts`
    - `generated/componentRulesTable.ts`
    - `packages/rendering/src/renderers/CSSGenerator.ts` (`partAliases` · `align-self`)

### Fixed

- **도움말만 지운 라벨 행에서 다시 넣으면 행이 겹침** (판독 MEDIUM-1, 출시 전 수리): Layers 에서 도움말 노드만 지운 뒤 Help 를 고르면 라벨 행이 2단이 되고, 그 뒤로는 패널로 뺄 수 없었다. 이제는 남은 행에 다시 넣고, None 을 고르면 남은 행을 푼다.
  - **Why**: 명령이 「행은 있고 도움말은 없는」 상태를 「도움말 없음」 과 같게 읽었다.

### Tests

- `adr259ContextualHelp.test.tsx` 48 — 16 field 의 넣기 · 빼기, DOM = S2 oracle (이름 · labelledby · slot), undo 한 번, 열린 Popover 이름, 비활성 ComboBox, 4 size 버튼, 위 · 옆 라벨 자리, 필수 표시, ColorSlider · TagGroup 이름. 원복 RED 18/18.
- live `adr259-live.mjs --phase 3` 106/106 · 다크 106/106 — Design 패널 · undo / redo · 저장 · 다시 열기 · Preview 버튼 이름 · 열기 / Escape (문서 무변경) · 16 field × 위 / 옆 × S · M · L 에서 Canvas = Preview (자리 ±1 · 칠 ≤ 0.001).

## [S2 입력 앞 글자 — ADR-259 Phase 2] - 2026-10-13

### Added

- **field 앞 글자 `prefix`** (ADR-259 Phase 2 — S2 1.8.0 TextField · TextArea · NumberField · ComboBox · ColorField): Design 패널 Content 의 **Prefix** (None · Text · Icon) 가 입력 앞에 Text (`$`) 또는 Icon (`search`) 노드를 넣고 뺀다 — 넣기 · 바꾸기 · 빼기 각 한 번이 undo 한 번. Text 면 **Prefix Text**, Icon 이면 **Prefix Icon** 으로 그 노드를 바로 고친다.
  - 앞 글자가 든 control Group 이 상자가 된다 (S2 `FieldGroup`): Input rule 의 상자 · quiet · invalid · focus 를 Group 이 그리고 (DOM 은 Input sheet 의 `FieldBox` 별칭, Canvas 는 같은 rule 을 Group 상자에서 실행), 안 Input 은 자기 상자를 내려놓는다. 상자 높이 · 시작 여백은 앞 글자 없을 때와 같다. NumberField 증감 버튼은 상자 안에서 테두리를 내리고, ComboBox 버튼은 같은 자리에 남는다.
  - 앞 글자는 S2 처럼 흐린 색 (`--fg-muted`) · 아이콘은 글자 줄 높이 정사각 · input 이름 끝에 붙는다 (「Price $」 — TextArea 는 S2 처럼 붙지 않는다) · 앞 글자를 누르면 input 에 포커스.
  - TextField · TextArea · ColorField 는 상자 Group 이 없어 Input 을 Group 으로 감싼다 (빼면 푼다). 배치된 field 는 이때 자식이 소유 사본이 되어 field 의 Label · Description · Placeholder prop 이 사본에 더 닿지 않는다 (사용자 결정 2026-10-13 「5종 모두 진행 (사본 감수)」 — NumberField · ComboBox 는 Input 의 Placeholder 만).
  - 위치: `apps/builder/src/builder/catalogRuntime/fieldPrefixCommand.ts` · `panels/properties/catalog/CatalogFieldPrefixField.tsx` · `packages/shared/src/catalog/runtime/fieldPrefix.ts` · `compositionRoot.ts` · `domBinding.runtime.ts` · `presence.ts` · `document/rulePartRules.ts` · `generated/componentRulesTable.ts` (Input `classAliases` · field 앞 글자 선택자) · `apps/builder/src/builder/catalogRuntime/canvasBinding.ts`

### Fixed

- **invalid field 상자 테두리가 Canvas 에서 회색** (앞 글자와 무관하게 모든 field): Preview 는 RAC `data-invalid` 로 빨간 테두리인데 Canvas 는 quiet field 만 invalid 를 받았다. 모든 field 상자 (Input · DateInput · 앞 글자 Group) 가 field 의 invalid 를 받고, Canvas 가 rule 의 `&[data-invalid]` 테두리 색을 읽는다 (`quietStyles.ts` `catalogInvalidBorderColor` · `ruleShapes.ts`).
- **Button 원본 instance 의 소유 자식이 Button 크기를 못 받음**: NumberField Group 에 노드를 넣어 자식이 사본이 되면 증감 Icon 이 18 → 24 px 로 커졌다 — resolver 가 instance 소유자의 part rule 을 그 루트 type (Button) 의 것으로 읽는다.
  - **Why**: 사본 Button 은 원본 instance 라 정의에 part rule 이 없었고, `when: size` 판정도 instance 가 쓴 값만 보았다.

### Tests

- `adr259FieldPrefix.test.tsx` 39 — 5 field × text/icon DOM = S2 oracle (이름 · 첫 자식 · 포커스 전달) · undo 한 번 · 빼면 원래 모습 · 5 × 4 상태 Canvas 상자 칠 · 크기 · 부품 자리 · 색 · 아이콘 크기 Canvas = DOM · field 상태 편집 반영. 원복 RED 18/18.
- live `adr259-live.mjs --phase 2` 51/51 · 다크 51/51: Design 패널 Prefix · Prefix Text · undo · 저장 · 다시 열기 · Preview 이름 · 포커스 전달 · 19 상자 × text/icon Canvas = Preview (상자 칠 ≤ 0.001 · 부품 자리 ±1) · None 으로 풀기.

## [S2 항목 링크 — ADR-259 Phase 1] - 2026-10-13

### Added

- **목록 항목 링크 7 type** (ADR-259 Phase 1 — S2 1.8.0 · RAC `LinkDOMProps`):
  - ListBoxItem · Tab · Tag · TreeItem · GridListItem · Row · MenuItem 이 `href` · `target` · `rel` 을 받는다 (Link 와 같은 편집 계약 — Design 패널 Content 의 URL · Target · Rel). RAC 가 그대로 그린다: ListBoxItem · Tab · MenuItem 은 `<a>`, 나머지는 자기 요소에 `data-href` (설치 RAC 를 마운트한 oracle 과 같은 DOM).
  - MenuItem 은 binding 없는 rule type 이라 DOM 만 `href` 를 넘기고 쓸 수 없던 틈이 닫혔다 — rule-only type 의 계약 표 `RULE_TYPE_PROP_CONTRACTS` (definition accepts · Design 패널이 같이 읽는다).
  - 위치: `packages/shared/src/catalog/document/itemLinks.ts` · `bindings/{ListBoxItem,Tab,Tag,TreeItem,GridListItem,Row}.binding.ts` · `document/ruleDefinition.ts` · `runtime/domBinding.runtime.ts` · `runtime/delegatedDom.runtime.ts` (TreeItem) · `apps/builder/src/builder/catalogRuntime/editContract.ts`
- **S2 바깥 링크 글리프 · `hideLinkOutIcon`** (사용자 결정 1 「S2 처럼 자동으로」): GridListItem · MenuItem 이 `href` + `target="_blank"` 이면 끝에 바깥 링크 글리프 (Lucide `external-link`, S2 크기 — ListView 10 px · Menu S 10 / M 12 / L · XL 14). GridList · Menu 의 `hideLinkOutIcon` 이 끈다 (resolver 가 항목에 전파). 항목의 끝 여백이 글리프 + 간격만큼 늘고 (레이아웃 입력 · DOM 이 같은 함수), 글리프는 그 여백 자리에 Canvas · Preview 가 같은 상자로 그린다.

### Fixed

- **링크 Tab · MenuItem 의 브라우저 링크 칠** (R4): RAC `<a>` 가 된 Tab · MenuItem 에 밑줄 · 링크 색이 새지 않게 rule 의 `&[href]` (생성 CSS) 가 지운다 — MenuItem 은 Menu 글자색을 이어받는다. ListBoxItem 은 기존 `ListBox.css` `&[href]`.
  - **Why**: MenuItem 루트에 작성자 색이 없어 `<a>` 의 UA 링크 색 (파랑) 이 바깥 링크 글리프에 그대로 칠해졌다 (live 에서 발견).

### Tests

- `adr259S2Oracle.test.tsx` — 설치 S2 1.8.1 · RAC 를 jsdom 에 마운트한 출력 고정 (`apps/builder/tests/fixtures/adr259-s2-oracle.json`): 도움말 버튼 · Popover 이름, 앞 글자 input 이름 · 포커스 전달, 항목 링크 DOM, 바깥 링크 글리프 표시 조건.
- `adr259ItemLinks.test.tsx` 11 — 7 type DOM = oracle · MenuItem 패널 계약 · 글리프 표시 조건 (S2 oracle 대조) · 글리프 상자 (레이아웃 여백 · Canvas shape · DOM 상자). 원복 RED 4/4.
- live `apps/builder/scripts/adr259-live.mjs --phase 1` (headed Chrome · Compare Mode) 13/13 · 다크 12/12: Design 패널 URL 쓰기 · undo/redo · 저장 · 다시 열기 · Preview DOM · 글리프 중심 · 크기 Canvas = Preview · 내부 링크 → Preview page (frame 이동 0) · `_blank` → 새 탭 · WebKit Enter (RAC 합성 링크 keydown 경로) → Preview page.

## [에이전트 운영 기록·낡은 진입점 정리] - 2026-10-13

### Changed

- Codex hooks는 등록된 보호 파일 검사·자동 포맷과 공용 JSON adapter만 유지한다. 미등록 lifecycle·상태줄·사용량 진입점, 빈 통계 파일, 중복 `.agent/skills` 별칭을 제거했다.
- 공용 규칙·스킬의 DOM·패널·구독 경로를 현재 분리된 모듈로 갱신했다. 삭제된 Preview registry·Error Boundary 안내와 렌더 분기 멤버 스냅샷을 현재 코드의 계약·소유 위치로 대체했다.
- **Why**: 미등록 hook과 지난 작업의 시작·차단 상태가 현재 실행 경로·작업 상태처럼 읽힐 수 있었다. 오래된 종료·대체 기록은 정리하고, 문서가 참조하는 증거와 미해결 후속 항목은 유지한다.

### Tests

- Hook audit은 등록된 handler의 공용 adapter 의존성과 미등록 hook 재유입을 검사한다. 끊어진 adapter·미등록 파일의 거부 fixture, 기존 hook·workflow·스킬·카탈로그 게이트로 검증한다.

## [S2 정렬 — 레퍼런스에 없는 variant 삭제] - 2026-10-12

### Removed

- **S2 · RAC · v3 어디에도 없는 `variant` 축 21 type** (사용자 결정 2026-10-12 「어디에도 없다면 지워」 — 조사 §4.2 F):
  - 대상: ProgressBar (+ 부품 ProgressBarFill · ProgressBarTrack) · Table · Separator · Calendar · RangeCalendar · CalendarGrid · ListBox · GridList · DisclosureGroup · Toolbar · FileTrigger · Skeleton · Pagination · Nav · ColorSwatchPicker · Section · ColorPicker · Chart · Tabs. v3 ProgressBar 의 `variant` 는 `overBackground` 하나라 S2 `staticColor` 가 그 자리다.
  - Design 패널에 Variant 가 없고, rule 은 기본 변형만 남는다 — 모든 인스턴스가 이미 칠하던 값이라 기본 인스턴스의 Preview · Canvas 는 그대로다 (Preview 계산 스타일 변경 전후 비교 · live 로 확인).
  - 사라진 시각: Separator dashed · dotted · 색 변형 (수동 `Separator.css` · Skia 분기 포함), Section 배경 tint · outlined, ProgressBar neutral, Chart quiet, Table bordered, 그 밖 accent.
  - 옛 문서: 이 type 들의 `variant` 는 로드 시 1회 지운다 (`migrateCatalogEntriesS2` — 노드 · 원본 template 위치 · 정의 기본값). 원본 template 7곳의 `variant` 쓰기와 Chart 생성 기본값도 뺐다. contract 는 올리지 않는다 (올리면 옛 문서를 거부한다).
  - Section 은 DOM 이 `data-variant` 를 더 쓰지 않아 생성 CSS 의 투명이 `[data-variant]` 블록에만 있던 것이 드러났다 — rule 의 기본 변형을 `{color.transparent}` 로 바꿔 base 블록이 투명을 싣는다 (Canvas 도 투명 그대로). ListBox 는 공용 컴포넌트 기본값 "primary" 가 옛 시트를 켜지 않게 `default` 를 넘긴다.
  - 위치: `packages/shared/src/catalog/bindings/*` · `generated/componentRulesTable.ts` · `document/s2PropAlignment.ts` · `document/generated/reusableOriginLibrary.ts` · `components/styles/Separator.css` · `packages/rendering/src/renderers/skiaPrimitives.ts` · `packages/rendering/src/chart/authoring.ts`

### Tests

- `s2VariantRemoval.test.ts` 5 — 21 type accepts 없음 · rule 기본 변형만 · 원본 template 쓰기 0 · 쓰기 거부 (revision 무변경) · 로드 전환 (노드 · template 위치 patch · 정의 기본값) · 옛 문서가 열림. 원복 RED: 전환 행을 빼면 FAIL 2. 바뀐 계약 테스트 갱신 (toRacProps `data-variant` 없음 · paint shadow 8,136 → 6,912 = 변형 34 × 36 · origin view 의 Chart Variants 행 없음 · Meter track 로 owner variant 검사).
- live `s2-variant-removal-live.mjs` 11/11 — Separator · Section · Toolbar · ProgressBar 의 Design 에 Variant 없음 (Button 은 있음), Section 투명 · ProgressBar accent fill (Preview = Canvas), 저장된 entry 에 옛 variant 를 써 넣고 reload → 문서가 열리고 variant 가 지워지며 같은 칠, 오류 0. shared 1,564 · builder 5,451 · rendering 1,313 · type-check.

## [S2 formatOptions — 숫자 서식 객체 값] - 2026-10-12

### Added

- **NumberField · Meter · ProgressBar · Slider 가 S2 · RAC `formatOptions` 를 받는다** (사용자 결정 2026-10-12 「S2 · RAC 가 객체면 객체 값 타입을 새로 만들어」):
  - **Why**: S2 1.8.0 · RAC 의 `formatOptions` 는 `Intl.NumberFormatOptions` 객체인데 문서 값 타입에 객체가 없어 보류였다 (조사 §6.1).
  - 새 문서 값 타입 `numberFormat` — 키는 네 consumer 가 같게 다루는 것만: `style` (decimal · percent · currency · unit) · `currency` · `currencyDisplay` · `currencySign` · `unit` · `unitDisplay` · 정수 · 소수 자릿수 · `useGrouping` · `signDisplay`. NumberField 가 자기 글자를 다시 읽으므로 (RAC `NumberParser`) notation · 유효 자릿수 · 반올림은 받지 않는다. currency style 은 ISO 코드가, unit style 은 Intl 이 받는 단위가 있어야 하고 다른 style 의 키는 같이 둘 수 없다. 비우면 RAC 기본 (Meter · ProgressBar 는 범위의 퍼센트, 나머지는 locale 의 십진수).
  - DOM 은 RAC 에 그대로 넘기고, Canvas 는 RAC 와 같은 `NumberFormatter` 로 같은 글자를 쓴다 (Meter · ProgressBar 의 percent style 은 범위 비율을, 그 밖은 값을 서식). 문서 검증기 · 라이브러리 · AI 수정 검증이 같은 판정 (`catalogNumberFormatFits`) 을 쓴다.
  - Design 패널 「Format」: Default · Decimal · Percent · Currency · Unit 과 그 style 의 키 · 자릿수 · 부호 · 자릿수 구분을 한 객체로 한 번에 쓴다. 받지 않는 통화 코드 · 단위는 쓰지 않고 알린다.
  - 위치: `packages/shared/src/catalog/document/numberFormatValue.ts` · `bindings/numberFormatProps.ts` · `runtime/valueBindings.ts` · `runtime/presence.ts` · `runtime/delegatedDom.runtime.ts` · `apps/builder/src/builder/panels/properties/generic/NumberFormatField.tsx`

### Tests

- `s2FormatOptions.test.tsx` 8 — 값 판정 · 네 type 의 accepts · 잘못된 모양 거부 (revision · history · 저장 대기열 무변경) · 서식 7종마다 Meter · ProgressBar · Slider · NumberField 의 Preview 글자 = Canvas 글자 = 설치된 RAC 의 출력. 원복 RED: Canvas 글자 (`valueBindings` · `presence`) · DOM 전달 (`delegatedDom`) 을 각각 되돌리면 FAIL 4 · 1 · 4.
- live `s2-format-options-live.mjs` 11/11 — Meter Format → Currency 「$75.00」 · 코드 eur → 「€75.00」 · 잘못된 코드 경고 · Max Fraction Digits 0 「€75」 · Default 「75%」 (Preview = Canvas record = Skia 글자), NumberField percent 「25%」, Slider unit 「50 km」, reload 유지 · 오류 0. NumberField 원본은 `step 1 · max 100` 이라 percent 에서 0.25 가 RAC 규칙대로 0 으로 맞춰진다 — percent 는 step 을 같이 바꿔야 한다.

## [전체 lint 정합성 — React consumer lifecycle] - 2026-10-12

### Fixed

- **렌더와 commit 사이의 입력·이벤트 상태 분리**:
  - **Why**: 렌더 중 ref 갱신과 props를 복사하는 effect가 입력 초안·페이지 헤더·이벤트 콜백의 상태 소유권을 섞었다. 조건부 `useMemo`는 TagGroup 분기가 바뀔 때 Hook 순서도 바꿨다.
  - 입력과 헤더의 렌더 스냅샷은 state로 관리하고, 네이티브 이벤트 콜백은 commit에서 연결한다. Preview Toast는 연결 해제 시 이전 consumer를 정리한다.
  - 위치: `apps/builder/src/builder/components/property`, `apps/builder/src/builder/workspace/canvas/overlay/pageHeader`, `packages/shared/src/catalog/runtime/toastBridge.ts`, `packages/shared/src/components/TagGroup.components.tsx`
- **파일 유입과 lazy 모듈 로드의 소유권 고정**:
  - 동시에 들어온 파일은 모듈을 한 번만 로드한다. 로드 실패는 unavailable snapshot으로 알리고, 막힌 endpoint의 대기 파일은 비워 다음 endpoint로 유출되지 않게 한다.
  - 위치: `packages/shared/src/components/fileUploadResources.ts`

### Changed

- Fast Refresh의 컴포넌트 모듈에서 일반 함수·상수·Context를 분리하고 기존 공개 export와 import 경로를 재수출 모듈로 보존했다.
- 분리된 FileUploadActive 모듈도 lazy 번들 검사에 포함하고, catalog React 함수 호출 지표는 기존 ratchet 상한과 같은 이름으로 비교한다.
- TanStack Table은 상태별 table instance를 만들고, 가상화 행과 전체 높이는 외부 virtualizer의 불변 snapshot을 구독한다. 미사용 코드·불필요한 초기 할당·누락된 Hook 의존성·옛 문서 타입 의존을 제거했다.

### Tests

- 전체 lint와 TypeScript 검사, 컴포넌트·Builder 회귀 검사 및 실제 Builder 입력·Undo·Preview 동기화·저장 후 재로드를 확인한다. 파일 유입 중복·실패·폐기와 이전 Canvas·Toast consumer 해제에는 인접 회귀 테스트를 추가했다.

## [Properties 값을 초기값으로 되돌리면 재정의가 사라짐] - 2026-10-12

### Fixed

- **값을 바꿨다가 처음 값으로 되돌려도 Component 섹션의 Overrides 에 그 항목과 Reset 이 남던 문제**:
  - **Why**: Properties 커밋 (`catalogSemanticPatchCommand`) 이 새 값을 지금 보이는 값과만 비교해, 처음 값으로 되돌려도 「내 값 = 처음 값」 을 문서에 썼다. Overrides 목록은 문서에 내 값이 있는지로 만들어져 행이 남았다.
  - 수정: 새 값이 내 값 없이 보일 값 (상속값, 없으면 contract 기본값 — 필드의 `baseValue` 와 같은 식) 과 같으면 내 값을 지운다 (`catalogPropBaseValue`). 여러 요소를 함께 고칠 때는 모든 대상의 기본값이 같을 때만 지운다.
  - 위치: `apps/builder/src/builder/catalogRuntime/editContract.ts`

### Tests

- 원본 상속값 (`variant`) · contract 기본값 (`isDisabled`) · 상속 없는 Text `children` 을 바꿨다 되돌리면 내 값이 사라진다 — `phase4eProperties.test.ts` (수정 전 코드 RED: `label` 외에 `variant` · `isDisabled` 가 남음). catalogRuntime · properties 2,102 · type-check.
- live (실제 Builder, Button): Disabled 켬 → Overrides `isDisabled` → 끔 → 없음 · Variant Primary → Accent → Primary · Size M → L → M 도 같고, undo 하면 다시 생긴다 · page error 0.

## [TagGroup 접기 확인 — 편집마다 문서 전체를 훑지 않음] - 2026-10-12

### Performance

- **TagGroup Max Rows 접기가 TagList 만 읽는다**:
  - **Why**: Canvas 접기 (`settleTagRows`, 2026-10-09 `c14e41a84`) 가 레이아웃 계산마다 문서의 모든 요소를 훑으며 type 을 확인했다 — TagGroup 이 없는 문서에서도 편집 비용이 문서 크기에 비례했다 (ratchet `seeds.60.edit` 경고 `typeOf` 1,053 → 2,620 의 992 회).
  - 수정: TagList 요소 index 를 요소를 넣고 · 바꾸고 · 지울 때 같이 갱신하고 (실패한 step 은 다른 상태와 함께 되돌린다) 접기는 그것만 읽는다.
  - 측정: 60 요소 편집 20회 `typeOf` 2,620 → 1,628 (2회 같은 값). 상한 1,053 대비 남은 증가는 편집한 요소 하나당 새 presence 함수 몫이라 문서 크기와 무관하다.
  - 위치: `packages/shared/src/catalog/runtime/compositionRoot.ts` (`tagLists` · `trackTagList`)

### Tests

- 요소 5 → 40 개 문서에서 편집 한 번의 `typeOf` 수가 같아야 한다 (수정 전 코드 RED 1,523 → 1,558) · undo · redo 로 TagGroup 이 빠졌다 돌아와도 접힘 복원 — `tagGroupMaxRowsCanvas.test.ts`. live `tag-group-maxrows-live.mjs` 7/7 (Max Rows 0 ~ 3 · Design 패널 · reload, Canvas = Preview) · builder 5,443 · shared 1,580 · type-check.

## [Vitest 5 · axe-core 업데이트] - 2026-10-12

### Changed

- Vitest, browser runner, Playwright provider, V8 coverage provider를 5.0.3으로 맞췄다. Vitest 5가 바꾼 plugin 이름 때문에 `vite-plugin-wasm`의 Node 감지가 빠지는 문제는 테스트 설정의 호환 marker로 보완했다.
- Builder 접근성 검사기는 axe-core 4.10.3에서 4.14.0으로 갱신했다.

### Verified

- Builder 단위 테스트 5,441개와 browser parity 811개, shared 1,580개, rendering 1,313개 및 publish·sample-data·upload 전체 테스트가 통과했다. 전체 type-check와 Builder production build도 통과했다.
- rendering coverage의 테스트 1,313개는 통과했다. branch coverage는 Vitest 5에서 79.36%로 기존 80% 기준에 못 미쳤지만, 같은 소스의 Vitest 4 결과도 79.27%였으므로 이번 업데이트로 생긴 하락은 아니다.
- 실제 Builder 문서에서 axe 4.14.0으로 검사해 critical violation 0, page error 0을 확인했다.

## [S2 · React Aria patch 업데이트] - 2026-10-12

### Changed

- `@react-spectrum/s2` 1.8.1, React Aria 3.53.1, React Aria Components 1.22.1로 갱신했다. ColorArea focus 접근성 patch를 3.53.1에 이식했고, RAC slot provider·state key 실행 표는 내용 변화 없이 1.22.1 버전으로 다시 만들었다.
- 검증: shared 1,580 · Builder 5,441 테스트, 전체 type-check, production build 통과. 실제 Builder의 ColorArea/ColorSlider/ColorWheel 팔레트 추가·Canvas/Preview·끌기·편집·Undo/Redo·새로고침·다크 테마 17/17, page error 0.

## [Builder 호환 의존성 · React/RAC · 시각 라이브러리 업데이트] - 2026-10-12

### Changed

- Builder runtime·개발 도구를 현재 호환 버전으로 갱신했다: React/React DOM 19.3, React Aria 3.53, React Aria Components 1.22, react-stately 3.51, React Router 8.4, Vite 8.3.4, Playwright 1.64, Three 0.186, Lucide React 1.55와 인접 패키지. React DOM의 DevTools getter 보호와 React Aria ColorArea focus 접근성 patch는 새 배포본에도 이식했다.
- RAC 1.22 실행 결과로 slot provider·state key 표를 다시 만들었다. 계약 내용은 1.21과 같고 버전만 바뀌었다. Meter가 더는 무효한 `progressbar` boolean DOM 속성을 내보내지 않으며 `role="meter"` 접근성 계약은 그대로다. Lucide 생성 데이터는 1.55 아이콘 집합으로 갱신했다.

### Verified

- shared 1,580 · rendering 1,313 · Builder 5,441 테스트, 전체 type-check, Builder production build, preflight 통과. 실제 Builder에서 ColorArea/ColorSlider/ColorWheel 팔레트 추가·Canvas/Preview·끌기·편집·Undo/Redo·새로고침·다크 테마를 17/17 확인했고 page error는 0이었다.

## [ColorWheel 크기 조절 — 상자와 고리가 같이] - 2026-10-12

### Fixed

- **ColorWheel 의 width · height 를 바꿔도 고리 (ColorWheelTrack) 가 그대로였던 결함** (ADR-258 후속): 지름은 S2 `size` 하나에서 나오는데 Styles 의 width · height 와 Canvas 크기 조절 핸들은 상자 크기만 바꿨다. 이제 그 편집이 `size` 를 쓴다 — 상자 · 고리 · thumb 반지름이 Canvas 와 Preview 에서 같이 바뀐다 (두 변이 다르면 큰 쪽, 비우면 기본 지름, Fill 은 거부). S2 처럼 상자는 늘 지름의 정사각형이라, 전에 넣어 둔 상자 크기는 쓰지 않는다. Styles 의 width · height 칸은 지름을 보여 준다 (ADR-257 Column 폭과 같은 길).
  - 시험: `adr258ColorWheelResize.test.tsx` 3 (Styles · Size 섹션 · Canvas 핸들 · 옛 상자 크기), 원복 RED 4. live — 팔레트로 넣은 ColorWheel 의 핸들 드래그 → 240 · Styles width 300 · undo, Canvas · Preview 상자와 고리 같음.

## [ADR-258 Implemented — Color 조작기 팔레트 · live 검증] - 2026-10-12

### Added

- **팔레트 Forms 에 color area · color slider · color wheel** (ADR-258 Phase 3, 사용자 결정 3 「ColorField 뒤」): 클릭하면 레퍼런스 노드 트리 원본 (thumb · track 부품 포함) 이 들어간다. Components page 에도 ColorField 뒤에 세 원본이 보인다.
- **ColorSlider 의 Label 필드** (Design 패널 Content): S2 `label` — 비우면 RAC 가 채널 이름을 쓴다 (Phase 2 에서 빠졌던 패널 필드).

### Verified

- G3 live 하니스 (`apps/builder/scripts/adr258-color-controls-live.mjs`) 17/17 — 패널 기본값 편집이 새로고침 없이 Canvas · Preview 에 같이 · undo · redo · 새로고침 유지 · Preview 끌기는 문서 revision 불변 · 끌기 중 · 뒤 label · orientation · disabled 편집에 끌기 값 유지 · 기본값 편집 · undo · redo 와 무채색 hue 편집은 Preview 를 문서 값에서 다시 시작 · 채널 / 축 한 번 선택에 색 공간 동반 · `red` 거부 · 다크 테마 thumb 고리 · page error 0.
- G5 — Color 조작기 10개 문서의 셰이더 생성 수 (`adr258-shader-count-live.mjs`): 정지 0 · 값 편집 1회에 그 상자 하나 · 카메라 이동 0. initial 번들 gzip Builder +5,957 B · Preview +1,424 B (상한 안).

## [ADR-258 Phase 2 — Color 조작기 Canvas 그라데이션 · thumb · 노드 트리] - 2026-10-12

### Added

- **Canvas 가 ColorArea · ColorSlider · ColorWheel 을 Preview 와 같게 그린다** (ADR-258 Phase 2): ColorArea 의 색 영역 (rgb 세 층 `screen` · hsl/hsb 두 층), ColorSlider 의 채널 막대, ColorWheel 의 색상 고리, 그리고 값 자리의 thumb (표시색 · 고리 · 그림자). 전에는 흰 상자 (ColorWheel 은 속이 찬 원판) 였다. 값 · 채널 · 색 공간 · disabled 를 바꾸면 새로고침 없이 따라온다.
  - Skia 그라데이션이 CSS 처럼 premultiplied 로 보간한다 (투명 stop 이 섞인 hsl/hsb 층) · 고리 clip · 층 blend.
  - 시험: G2 live pixelmatch — 16 fixture × 라이트 · 다크 32/32 (차이 0 ~ 0.002 %), premul 원복 RED.
- **레퍼런스 노드 트리**: `ColorArea > ColorThumb`, `ColorSlider > Label + SliderOutput + SliderTrack > ColorThumb`, `ColorWheel > ColorWheelTrack + ColorThumb` (새 type ColorThumb · ColorWheelTrack, 원본 3). ColorSlider 의 Label 은 비워 두면 RAC 처럼 채널 이름, SliderOutput 은 채널 값이다. AI 가 넣는 Color 조작기도 이 원본이다.

### Changed

- **library contract 40 → 41** — 부품 노드 없는 ColorArea · ColorSlider · ColorWheel 문서는 열지 않는다 (사용자 결정 1 — 저장소 · 로컬 프로젝트에 해당 노드 0).
- **thumb · track 의 모양이 catalog rule 로** — 값은 옛 수동 CSS 그대로 (16px · 테두리 4px · 그림자 · focus 20px · track 20px · 세로 150 × 20 · disabled 회색). Preview 는 생성 CSS 4 (ColorArea · ColorSlider · ColorWheel · ColorThumb) 를 읽고, 옛 수동 sheet 는 Builder 패널의 색 고르기 UI 전용으로 남는다.

## [ADR-258 Phase 0 · 1 — Color 조작기 색 축 prop · 색 값 검사] - 2026-10-12

### Added

- **ColorArea · ColorSlider · ColorWheel 의 S2/RAC 색 축 prop** (ADR-258 Phase 1): ColorArea `colorSpace` · `xChannel` · `yChannel` · `xName` · `yName` · `defaultValue`, ColorSlider `channel` (기본 `hue`) · `colorSpace` · `defaultValue` (기본 `hsl(0, 100%, 50%)`), ColorWheel `defaultValue`. 이름 · 값 · 기본값은 S2 1.8.0 = RAC 1.21.0 그대로. Canvas 그라데이션 · thumb 는 Phase 2 (지금 Canvas 는 상자).
- **색 값은 RAC 가 읽는 구문만** (`racColor`): `#rrggbb` · `#rgb(a)` · 쉼표 `rgb()` · `hsl()` · `hsb()` (+ alpha). `red` · `rgb(255 0 0)` · `oklch()` 는 Design 패널이 field 오류로 막고 (명령 없음), AI 도구 · 문서 검증기도 거부한다.
- **색 공간 · 채널을 한 번에 맞춤**: 공간에 없는 채널을 고르면 공간이 같이 바뀐다 (hsl · hue ColorSlider 에서 Red → rgb) — Design 패널 · AI 수정 · AI 생성이 같은 규칙 (`normalizeColorControlPatch`) 으로 한 step, undo 한 번에 둘 다 돌아간다. 값만 바꿔 공간이 바뀌면 이전 공간을 같이 적어 보기가 그대로다.

### Fixed

- **ColorSlider 하나가 Preview 화면 전체를 비움**:
  - **Why**: RAC ColorSlider 는 `value` · `defaultValue` 없이 던지는데 (`useColorSliderState requires a value or defaultValue`), binding 에 값 prop 이 없어 Preview 루트가 내려갔다 — 같은 페이지의 다른 요소도 사라졌다.
  - 수정: binding 기본값 + DOM 이 Canvas 와 같은 폴백 props (`catalogColorControlProps` — 빈 값 · 손상 값은 기본값, 공간 밖 채널은 그 공간의 채널) 를 RAC 에 넘긴다. Preview 의 Color 조작기 key 는 문서 기본값의 원래 공간 · 채널 수치라 기본값 편집 · undo 가 Preview 를 다시 시작한다 (Decision 7).
  - 시험: G1 — 설치 RAC oracle 444 행 (그라데이션 · thumb · ColorSlider 글자 en-US/ko-KR) 문자열 일치 · 색 구문 표 · 정규화 전수 (결과를 RAC 에 넣어 던지지 않음) · key · host 통합 5 (패널 · AI 수정 · AI 생성 · 검증기 거부 시 revision 불변). 원복 RED 7. live — Preview 세 요소 그려짐 · `red` 입력 거부 · 채널 Red 한 번 선택 = 공간 rgb 동반 · undo 한 번 · page error 0.

## [Toast · ColorPicker — Canvas 와 Preview 상자 맞춤] - 2026-10-12

### Fixed

- **Toast 노드가 Preview 에서 글자 높이로만 그려짐** (Canvas 48 · Preview 24, 테두리 · 바탕 없음):
  - **Why**: 문서의 Toast 노드를 그리는 DOM (`delegatedDom.tsx` `toast`) 에 rule class 가 없었고, catalog 가 만든 `generated/Toast.css` 는 어디서도 싣지 않았다. 생성 CSS 로드 인벤토리는 이 파일을 「수동 Toast.css 가 같은 class 담당」 으로 판정했지만, 수동 sheet 는 `854dbf2a0` 부터 런타임 `ToastRegion` 안만 담당한다.
  - 수정: DOM 이 `react-aria-Toast` class 와 `data-size` · `data-variant` 를 싣고 (`chrome()`), Preview 번들 (`styles/index.css`) 이 생성 sheet 를 싣는다. 같은 class 를 쓰는 런타임 toast 에 새는 상자 값 (세로 줄 · 높이 · 테두리 · border-box · 글자 크기) 은 수동 `Toast.css` 런타임 블록이 종전 값으로 되돌린다 — 생성 sheet 를 끈 상태와 계산값 9개가 같다 (live).
- **ColorPicker 둘레에 Canvas 만 1px 테두리 · 바탕**:
  - **Why**: RAC ColorPicker 는 자기 요소가 없고 (자식에게 색 context 만 준다) DOM shell 도 상자를 그리지 않는데, rule 의 variant 칠 (바탕 · 테두리) 을 Canvas 만 그렸다.
  - 수정: ColorPicker rule 의 세 variant 칠을 투명으로 (`componentRulesTable.ts`). variant 이름은 남긴다 (S2 · RAC 에 없는 `variant` 의 존폐는 별도 결정).
  - 시험: `toastColorPickerShell.test.tsx` 2 (원복 RED 각 1) · live — 빈 Toast Canvas = Preview 1920 × 48 · ColorPicker 상자 같음 · 테두리 · 바탕 0.

## [ADR-257 Implemented — Table 열 트랙] - 2026-10-12

### Changed

- **ADR-257 Implemented** (사용자 「1번으로 진행해」): Phase 0 ~ 5 · 후속 (GridList · Badge `overflowMode`) 완료. Column 의 S2 폭 prop 이 열 트랙을 정하고 머리글 행 · 모든 Row 가 같은 grid 트랙을 쓴다. 남았던 G6 총비용 A/B — 전환 전 (`be0de3795`) ↔ ADR-257 (`104d935a9`) 를 각 worktree 에서 바운드 Table (투영 14행) 로 교대 측정: 스크롤 · 칸 편집은 노이즈 안, 열 폭 편집은 commit · layout 시간이 같고 화면 반영 총시간만 약 +6 ms (모든 행의 칸이 실제로 움직여 Canvas 가 더 그린다 — 전환 전에는 머리글 칸만 바뀌어 열이 어긋났다). 사용자 수용. 초기 번들 gzip JS Builder 1,236,984 · Preview 273,120 (상한 안). 본문을 `docs/adr/completed/` 로 옮기고 `### Live Exercise` 를 적었다.

## [ADR-256 Implemented — RAC 수준의 조립] - 2026-10-12

### Changed

- **ADR-256 Implemented** (사용자 「Implemented 로 올려」 — G5 의 사용자 확인): Phase 1 ~ 11 완료. 노드 트리를 RAC 부품 그대로 그리고, 넣는 자리를 레퍼런스 (react-aria.adobe.com · S2) 에서 가져온다. G5 레퍼런스 예제 15개 중 13 은 구조 통과 + Canvas = Preview, 2 는 정해진 글자 span 차이만 (Column 글자 — 10-09 결정 · S2 Button). 본문을 `docs/adr/completed/` 로 옮기고 `### Live Exercise` 를 적었다.

### Fixed

- `6b6f7c175` 에서 잘린 ADR-256 본문 (Status 아래 Context ~ Consequences) 을 `324d21603` 본문에서 복원했다 — Status 블록을 넣는 스크립트가 블록 뒤를 붙이지 않았다.

## [ADR-256 Phase 11 — G5 남은 차이 레퍼런스대로] - 2026-10-12

### Breaking Changes

- **library contract 40**: SearchField 원본에 control `Group` 이 없다 (`SearchField > Label + Icon + Input + Button + Description + FieldError`). contract 39 문서는 거부된다 (전환 없음).

### Changed

사용자 지시 「레퍼런스에 맞게 고쳐」 (2026-10-12) — G5 판정 대기였던 차이를 레퍼런스 구조로 맞췄다.

- **trigger 감싸는 요소 제거** (예제 2 · 9): DialogTrigger · MenuTrigger · TooltipTrigger 는 RAC 처럼 요소가 없다. trigger 는 Button 자신이다. Canvas 는 rule 의 `display: contents` 로 자식을 부모 흐름에 세운다 (Autocomplete 와 같은 길). 생성 CSS 3개는 더 만들지 않는다. Styles 패널의 「부모 배치」 는 `display: contents` 부모를 건너뛴다 (CSS 와 같음). 위치: `packages/shared/src/components/{DialogTrigger,MenuTrigger,TooltipTrigger}.tsx` · `componentRulesTable.ts` · `apps/builder/src/builder/panels/styles/catalog/catalogStylesHost.ts`
- **SearchField 의 control Group 제거** (예제 5): 레퍼런스 grid 를 따른다. 열은 `0px 1fr auto` 이다. 글리프는 빈 첫 열에서 Input 앞쪽 위에 놓이고, 지우기 버튼은 Input 끝 위에 놓인다. 행은 자동 배치라 Label · 설명이 비면 행과 간격이 없다. side 라벨은 `auto 0px 1fr auto` 이다. Canvas 의 Input · 글리프 · 지우기 버튼 위치는 전과 같다 (크기 4종 · side · 설명 · 오류 실측 대조). 크기 블록의 `column-gap` 을 Canvas 도 읽는다. 위치: `componentRulesTable.ts` (SearchField) · `reusableOriginLibrary.ts` · `rulePartRules.ts` · `presence.ts` · `domBinding.tsx` · `resolveCatalogRuleCanvasBox.ts`
- **Checkbox 아이콘** (예제 7 · 10 · 11): 레퍼런스처럼 표시 상자가 선택 여부와 상관없이 늘 `svg` 를 가진다. 선택되지 않았을 때는 `Checkbox.css` 가 숨긴다 (화면 변화 0). 위치: `components/Checkbox.tsx` (`CheckboxIndicatorBox`) · `components/styles/Checkbox.css`
- **S2 Card · Image** (예제 13): `@react-spectrum/s2` 1.8.0 을 테스트 전용 devDependency 로 설치하고 S2 Card 를 실제로 마운트해 기준값으로 썼다 (손으로 쓴 트리 대체). 그 결과에 맞춘 것:
  - Card 루트의 `aria-disabled="false"` 제거
  - CardPreview = `div[slot=preview] > div`
  - Footer = `footer` 요소
  - Image = 상자 안 `img alt=""` (S2 Image) — S2 Card 의 CardPreview 안에서만 (아래 판정 2건)
  - 위치: `components/Card.tsx` · `delegatedDom.tsx` (`cardpreview` · `footer`) · `domBinding.tsx`
- **ProgressBar indeterminate** (예제 14): 레퍼런스처럼 채움 상자를 움직이지 않는다. 채움은 트랙 전체이고, 움직임은 칠 (불투명도) 만 바뀐다. Canvas 도 같은 상자를 그린다 (전에는 Canvas 40–60% 고정 · DOM 120px 이동). 위치: `componentRulesTable.ts` (ProgressBar `indeterminate`) · `presence.ts` (`catalogProgressFillLayout`)

사용자 지시 「둘 다 레퍼런스대로 고쳐」 (2026-10-12) — 판정 대기 2건:

- **Table 정렬 표시** (예제 11): 정렬 가능한 열 (`allowsSorting`) 의 정렬 표시가 레퍼런스의 `span.sort-indicator` 다. 이름 바로 뒤에 늘 있고, 정렬 전에는 보이지 않되 자리는 남는다. 오름차순이면 위 chevron, 그 밖에는 아래 chevron (16px, 좌우 2px). 정렬 가능한 열은 레퍼런스 `.column-header` 처럼 가로 줄이고 이름이 나머지 폭을 쓴다. Canvas 는 정렬 상태가 없어 표시를 그리지 않고 그 자리만 비운다. 전에는 S2 처럼 정렬됐을 때만 글자 앞에 화살표를 그렸다 (ADR-257 Phase 4). 위치: `tableOperationsDom.tsx` (`CatalogSortIndicator`) · `domBinding.tsx` · `presence.ts` (`catalogColumnSortNameGroup`) · `compositionRoot.ts` · `componentRulesTable.ts` (Column `allows-sorting`) · `Table.css`
- **Image** (예제 10): S2 Card 의 CardPreview 밖에서는 RAC 예제처럼 맨 `img` 하나가 Image 상자다. CardPreview 안에서는 S2 Image (상자 안 `img`) 그대로. 위치: `domBinding.tsx` (`imageInS2CardPreview`)

### Tests

- `adr255OverlayTrigger` (trigger 요소 없음) · `toggleIndicatorNode` (아이콘 svg) · `adr256ProgressNodeTree` (indeterminate 상자) · `adr256CardS2` (S2 실물 마운트와 DOM 구조 같음 · S2 는 테스트 밖 import 0) · `adr253FieldPartsDom` · `fieldSideLabelFit` · side 라벨 계약 3종 (SearchField grid). 수정 전 RED 또는 원복 RED 확인.
- 검증: type-check · shared 1579 · builder 5402 · rendering 1313 · parity 811.
- live: G5 예제 15개를 다시 실행했다 (오류 0, 다시 열기 정상).
  - 구조 통과 + Canvas = Preview: 예제 1 · 2 · 3 · 4 · 5 · 7 · 8 · 9 · 12 · 14 · 15. 예제 6 은 스크립트가 일부러 넣는 글자만 다르다.
  - 정해진 차이로 접으면 통과: 예제 11 (Column 글자 span) · 13 (S2 Button 글자 span).
  - 판정 2건 수리 뒤 다시 실행: 예제 10 은 접기 없이 구조 통과 + Canvas = Preview. 예제 11 정렬 가능 열은 글자 span 만 접으면 통과하고 Canvas 어긋남 0. Preview 에서 Price 를 누르면 표시가 열 끝에서 나타나고 방향대로 바뀐다. 예제 13 은 S2 Button 글자 span 만 남는다.
- `adr256G5SortImage` (정렬 표시 위치 · Canvas 자리 · Image `img`, 고치기 전으로 되돌리면 4건 모두 실패) · `adr257TableOperations` 정렬 시험을 레퍼런스 동작으로 갱신.

## [ADR-256 Phase 11 후속 — G5 예제 결함 8–13] - 2026-10-12

### Fixed

- **Detach 한 Slider 의 SliderOutput 이 thumb 와 끊김** (G5 예제 12 — 결함 8):
  - **Why**: Detach 하면 Label 에 자동 HTML id 가 붙는다. RAC 는 그 id 로 label · output `for` 는 바꾸지만, thumb input 은 처음 마운트할 때의 id 를 유지한다 (`useId`). 그래서 `for` 가 없는 id 를 가리켰다.
  - 수정: Slider 의 Label 에는 HTML id 를 싣지 않는다 (Select 트리거와 같은 예외). 위치: `packages/shared/src/catalog/runtime/domBinding.tsx` (`withHtmlId`)
- **DialogTrigger 안 제목 없는 Dialog 의 이름이 「Dialog」 로 고정됨** (G5 예제 4 — 결함 9):
  - **Why**: RAC 는 이 경우 트리거 버튼으로 이름을 붙이는데 (`aria-labelledby`), 우리 대체 이름 `aria-label` 이 그것을 덮었다.
  - 수정: Modal · Popover 를 거쳐 DialogTrigger 안에 있으면 대체 이름을 넣지 않는다. 같은 패턴으로, Autocomplete 안 Menu 의 대체 이름 「Menu」 도 RAC 이름 (「제안」) 을 덮어서 함께 고쳤다. 위치: `domBinding.tsx` (`inDialogTrigger`) · `delegatedDom.tsx` (menu)
- **Preview 실행 중 Tab 등 항목의 id 를 바꾸면 RAC 오류** (G5 예제 8 — 결함 10): 「Cannot change the id of an item」
  - **Why**: 항목의 RAC id 가 바뀌어도 React 요소 key 는 그대로였다.
  - 수정: 항목 id 가 key 에 들어가 바뀌면 다시 마운트한다 (collection 항목 · MenuItem · delegated 항목 · TreeItem). 위치: `domBinding.tsx` · `delegatedDom.tsx` (`marker`)
- **Detach 한 Select 의 값 글자가 Canvas 에서 트리거를 채우지 않음** (G5 예제 3 — 결함 11):
  - **Why**: Select rule 의 「Button 을 거친 SelectValue」 part rule 이 type 정의 (`type-Button`) 를 가리키는데, Detach 한 트리거는 Button 원본의 instance (`origin-component-button`) 라 매칭되지 않았다.
  - 수정: `via` 를 원본이 가리키는 type 정의로도 맞춘다. 위치: `packages/shared/src/catalog/resolution/resolver.ts`
- **Select 의 선택 값 글자에 `slot="label"` 이 빠짐** (G5 예제 3 — 결함 12):
  - **Why**: RAC SelectValue 는 Text context 를 비우고, 그 안의 RAC Text 는 `slot` 을 그대로 쓴다. 우리 Text 는 그 경우 slot 을 버렸다.
  - 수정: Text provider 가 없을 때도 작성한 slot 을 싣는다. 위치: `domBinding.tsx` (text)
- **section 사이 간격 12px 이 Preview 에만 있음** (G5 예제 1 — 결함 13):
  - **Why**: 값이 수동 `ListBox.css` 에만 있어 Canvas 가 읽지 못했다.
  - 수정: ListBox rule 의 `staticSelectors` (`> .react-aria-ListBoxSection:not(:first-child)`) 로 옮겼다. 생성 `ListBox.css` 가 싣고, Canvas 는 resolver 파생값 `_siblingMarginTop` 으로 같은 값을 읽는다. Builder 화면 번들은 생성 CSS 를 싣지 않아, 같은 규칙을 `builder-listbox-section.css` 로 같은 자리에 두었다 (Builder 화면 변화 0). 위치: `componentRulesTable.ts` · `rulePartRules.ts` (`catalogNotFirstChildMarginTop`) · `presence.ts` · `compositionRoot.ts`

### Tests

- `adr256Phase7Review` (Slider output `for`) · `adr254ContainerOrigins` (트리거 안 Dialog) · `adr256MenuTrigger` (Autocomplete 안 Menu 이름) · `adr256TabsNodeTree` (마운트된 Tabs 의 Tab id 변경) · `adr256FollowupsSelect` (Detach 한 Select 값 폭 · SelectValue slot) · `phase4eItemInsert` (section 간격 Canvas). 각 수정을 되돌리면 실패하는 것을 확인했다 (7/7).
- live: G5 예제 15개를 모두 재실행했다. 예제 1 · 3 · 4 · 8 · 12 · 15 는 구조 통과, Canvas = Preview. 예제 6 의 교체 절차는 7번 수정 뒤 처음 끝까지 실행되어 스크립트를 고쳤다 (넣은 뒤 record id 다시 찾기).

## [Calendar 「Month and Year Pickers」 스위치 — Properties 한 번에] - 2026-10-11

### Added

- **Calendar · RangeCalendar Properties 의 「Month and Year Pickers」 스위치** (Content 섹션):
  - 켜면 헤더의 CalendarHeading 자리에 CalendarMonthPicker · CalendarYearPicker 가 들어간다. 순서는 레퍼런스 (react-aria.adobe.com Calendar 「Month and year pickers」) 와 같은 `Button[previous] + 월 + 연도 + Button[next]` 이다. 끄면 heading 이 돌아온다. 어느 쪽이든 history 한 단계이고, 선택은 Calendar 에 남는다.
  - 켠 동안 같은 자리에서 **Month Format** (RAC `format`) · **Visible Years** (RAC `visibleYears`) 를 편집한다. 값은 picker 노드에 저장된다.
  - **Why**: slot 「Add content」 로 picker 를 하나씩 넣는 것은 레퍼런스가 코드로 조립하는 방식이라 빌더에서는 불편했다 (사용자 지적 2026-10-11).
  - 스위치 값은 헤더의 자식 구성이며 prop 이 아니다 (D2 신규 prop 0). 끈 picker 는 `enabled: false` 로 남아 다시 켜면 format · visibleYears 가 그대로다.
  - 위치: `apps/builder/src/builder/catalogRuntime/calendarHeader.ts` · `panels/properties/catalog/CatalogCalendarHeaderField.tsx`
- **월 · 연도 picker 가 Calendar 의 locale 순서로 보인다** (composition 확장 — RAC 는 작성 순서 그대로 그린다):
  - ko · ja · zh 는 「2026년 ▾ 10월 ▾」, en · de 는 「Oct ▾ 2026 ▾」. Calendar 의 Locale 을 바꾸면 순서가 따라 바뀐다. 문서의 자식 순서 (Layers) 는 그대로다.
  - **Why**: 처음에는 레퍼런스 예제처럼 월 · 연도 순서로 고정돼 있어 한국어에서 「10월 2026년」 으로 보였다 (사용자 지적 2026-10-12).
  - Canvas (엔진 자식 순서) 와 DOM (렌더 순서) 이 같은 파생값 `_childOrder` 를 읽는다. 판정은 locale 의 연-월 패턴 (`Intl.DateTimeFormat` `formatToParts`) 이다.
  - 위치: `packages/shared/src/catalog/runtime/calendarModel.ts` (`catalogCalendarYearFirst` · `catalogCalendarHeaderOrder`) · `presence.ts` · `compositionRoot.ts` `childOrder` · `domBinding.tsx` `renderNode`
- 검증: `adr256CalendarHeaderMode.test.tsx` 6 (Calendar · RangeCalendar × instance · 문서 노드, 패널 필드, locale 순서 Canvas · DOM — 파생값을 끄면 실패하는 것 확인) · live headed Chrome 7/7 (스위치 클릭 · Month Format Long · Visible Years 5 → Preview 연도 5개 · 끄기 · undo 한 단계 · 오류 0) · live locale 5/5 (ko: Canvas · Preview 「2026년 · 10월」, en-US: 「Oct · 2026」).

## [ADR-256 Phase 11 — 제한 표 삭제 · G5 예제 결함 수리] - 2026-10-12

### Breaking Changes

- **library contract 39**: ListBox · GridList section 원본의 항목이 고정 `id` (`item-1` · `item-2`) 를 갖지 않는다. contract 38 문서는 거부된다 (전환 없음).

### Changed

- **미전환 family 제한 표 삭제** (ADR-256 Phase 11): 마지막 5행을 지웠다. ColorSwatchPicker · TableView 는 RAC collection (항목만 받음), Pagination · Toast · ColorPicker 는 자유 내용을 받는다. Toast 안 Toast 는 계속 막는다. 위치: `packages/shared/src/catalog/nesting/nestingRules.ts` · `packages/shared/src/domain/componentTraits.ts`
- **엔진 — `position: static` 부모의 absolute 자식** (ADR-164 재개): 부모가 `static` 을 명시하면 가장 가까운 positioned 조상이 containing block 이다 (CSS 2 §10.1). catalog 는 positioned 부품 상자 (SliderTrack 등) 안에서 부품을 감싼 layout frame 에만 `static` 을 싣는다. 위치 미지정 부모 (노드 `placement`) 는 종전대로 부모 기준. 위치: `packages/engine/src/tree.rs` (`place_static_descendant_absolutes`) · `packages/shared/src/catalog/runtime/presence.ts` (`catalogStaticPartFrame`)

### Fixed

- **Tabs 「+」 로 Tab 을 넣으면 모든 TabPanel 이 사라짐** (G5 예제 8):
  - **Why**: 짝짓기가 키 있는 panel 이 하나라도 있으면 순서 짝을 통째로 껐는데, 「+」 는 새 짝에만 키를 준다.
  - 수정: 키 있는 panel 은 키로, 키 없는 panel 은 남은 Tab 과 순서로 짝짓는다. 위치: `packages/shared/src/catalog/runtime/presence.ts` (`catalogTabsSelection`)
- **같은 목록의 section 들이 Preview 에서 마지막 section 의 항목을 보여 줌** (G5 예제 1):
  - **Why**: section 원본 항목의 고정 `id` 가 section 마다 같아 RAC 키가 겹쳤다.
  - 수정: 원본에서 고정 `id` 를 지웠다 (키 = 노드 id). 위치: `packages/shared/src/catalog/document/generated/reusableOriginLibrary.ts`
- **Calendar 날짜 칸 · 요일 칸 · DateSegment 에 넣은 내용이 Preview 에 안 나옴** (G5 예제 15):
  - **Why**: grid 가 자식 element 의 type 으로 template 을 찾았는데 자식은 모두 `CatalogDomNode` 로 감싸져 있어 늘 못 찾고 RAC 기본 칸을 그렸다. 닿고 나니 두 가지가 더 드러났다 — 칸에 상자 기본값 `display: flex` 가 inline 으로 실려 요일 `th` 가 table cell 이 아니었고 (grid 높이 380 / Canvas 200), 칸 안 `{formattedDate}` 바인딩이 값 키 표에 없어 글자 그대로 나왔다.
  - 수정: template 을 노드의 binding 으로 찾고, 반복 칸은 작성한 display 만 싣고, CalendarCell 의 `formattedDate` 를 값 키에 넣었다. 위치: `packages/shared/src/catalog/runtime/domBinding.tsx` (`repeatTemplatePart` · `REPEAT_TEMPLATE_BINDINGS`) · `valueBindings.ts`
- **SliderFill 을 frame 으로 감싸면 Canvas 에서 채움이 0×0** (G5 예제 12):
  - **Why**: 엔진이 containing block 을 직계 부모 (높이 0 인 frame) 로 고정했다. 또 Canvas 만 fill 에 `top: 0` 을 줘서 (RAC 는 `top` 없음 — static 위치) frame 안에서 4px 어긋났다.
  - 수정: 위 엔진 변경 + fill 의 `insetTop` 제거. 위치: `presence.ts` (`catalogSliderFillLayout`)
- **instance 안 ListBox (Select 의) 에 넣은 Section 에 항목을 넣을 수 없음** (G5 예제 3):
  - **Why**: 조상 type 을 따라갈 때 fillSlot 에 놓인 노드는 owner instance 로 바로 건너뛰어 template 조상 (ListBox · Popover) 이 빠졌다.
  - 수정: fillSlot 위치의 template 경로를 거쳐 올라간다. 위치: `packages/shared/src/catalog/commands/context.ts` (`nodeAncestorTypes`)
- **Dialog 원본의 Close 버튼 · footer 를 숨길 수 없음** (G5 예제 9):
  - **Why**: template 위치를 숨길 때 안에 Button 이 있으면 DialogTrigger 가 trigger 를 여전히 갖는지 보지 않고 거부했다.
  - 수정: 숨긴 뒤 owner 가 같은 종류 부품을 아직 보이는지 본다. overlay · 목록 부품 (Modal · Popover · Dialog · Tooltip · ListBox) 안의 Button 은 trigger 로 세지 않는다. 위치: `packages/shared/src/catalog/commands/structure.ts` (`assertTemplatePartsKept` · `showsPart` · `partSearchStop`)
- **instance 의 NumberField Group 등 `{key}` 바인딩이 있는 template 위치에 자식을 넣을 수 없음** (G5 예제 7):
  - **Why**: 처음 자식을 넣으면 그 위치의 template 자식이 문서 노드로 복사되는데, 복사본이 `{placeholder}` 같은 바인딩을 따라갈 수 없어 `POSITION_HAS_TEMPLATE_BINDING` 으로 막아 두었다.
  - 수정 (사용자 결정 2026-10-12 「A — 값 고정」): Detach 처럼 복사 순간 instance 의 현재 값을 복사본에 넣는다. 이후 instance 의 그 prop 을 바꿔도 복사본은 따라오지 않는다 (예: Group 에 자식을 넣은 뒤 NumberField 의 placeholder 를 바꿔도 Input 은 이전 값). 위치: `packages/shared/src/catalog/commands/materialize.ts` (`instanceBindings` — Detach 도 같은 함수)

### Tests

- `phase4eItemInsert` (Tabs 짝 · section 키 · Select 안 Section · NumberField Group 값 고정) · `structure` (picker 값 고정) · `adr256CalendarNodeTree` (반복 칸 · display · formattedDate · DateSegment) · `adr256RequiredParts` (Dialog) · `adr256Phase7Review` (frame 안 fill) · Rust `absolute_child_of_static_parent_*` 3. 원복 RED 9/9. live: fix-live (5 · 6 · 7 — 7 은 다시 열어 Preview input placeholder 「Amount」 유지 · Group 안 Text) · G5 예제 15개 재실행 (예제 1 · 15 구조 통과, 12 Canvas = Preview) · 결함 5 · 6 직접 실행 (`apps/builder/scripts/adr256-g5/fix-live.mjs`).

## [Calendar Month · Year picker 넣기 · prop] - 2026-10-11

### Added

- **CalendarMonthPicker `format`** (RAC — Numeric · 2-Digit · Long · Short · Narrow, 미설정 = Short): 달 목록 글자 형식. Canvas 트리거 글자와 Preview 가 같은 값을 읽는다.
- **CalendarYearPicker `visibleYears`** (RAC — 기본 20): 연도 목록 개수.
- **Design 패널 「Add content」 목록**: slot 을 선언하지 않은 자리 (instance 안 부품 · 문서에 직접 있는 노드 — 예: CalendarHeader) 에도 넣기 목록이 나온다. Calendar · RangeCalendar 안에서는 CalendarHeading · CalendarMonthPicker · CalendarYearPicker 가 목록 맨 앞이다.

### Fixed

- **CalendarHeader 의 넣기 목록에서 picker 를 찾을 수 없음**:
  - **Why**: 헤더 부품이 일반 항목 70여 개 뒤 맨 끝에 있어 목록을 스크롤해도 마우스로 닿지 않았다.
  - 수정: 헤더 부품을 목록 맨 앞에 둔다. 위치: `apps/builder/src/builder/catalogRuntime/slots.ts` (`catalogSlotInsertOptions`)
- **picker `format` 변경 뒤 Canvas 트리거 글자가 그대로**:
  - **Why**: 글자는 picker 의 prop 으로 SelectValue 를 칠하는데, SelectValue 자신의 record 는 바뀌지 않아 다시 그리지 않았다.
  - 수정: picker → 하위 SelectValue 를 dirty 확장 대상에 넣었다. 위치: `packages/shared/src/catalog/runtime/presence.ts` (`derivedDependents`)
- **Calendar `weeksInMonth` 가 미설정인데 1 로 표시** (커밋 324d21603 에 포함):
  - **Why**: 슬라이더가 값이 없을 때 min (1) 을 그렸다. 레퍼런스에는 초기값이 없다.
  - 수정: 스텝퍼로 바꿨다. 위치: `apps/builder/src/builder/panels/properties/generic/fieldEditor.ts`

### Tests

- `adr256CalendarNodeTree.test.tsx` (picker prop 이 RAC · Canvas 에 닿음) · `phase4ePropertySections.test.tsx` (instance 부품 · 문서 노드 두 경우의 넣기 목록 순서와 넣기). live: headed Chrome 에서 마우스 클릭으로 두 picker 넣기 · Format · Visible Years 5 → Preview 연도 5개.

## [ADR-256 Phase 10 — S2 Card · CardView · 그룹] - 2026-10-11

### Added

- **Card 의 Content 에 자유 내용** (S2 Card): 놓은 Card 의 Content 에 Button 등 다른 요소를 넣을 수 있다 (Design 패널 slot 넣기 목록 — 전에는 제목 · 설명이 Card prop 에 묶여 비어 있었다). 넣으면 제목 · 설명 뒤에 온다.
- **CardView 선택** (S2 CardView = RAC GridList): `selectionMode` 가 있으면 Card 의 `isSelected` 가 처음 선택이 되고 (Canvas · Preview 같음), Preview 에서 카드를 누르면 RAC 가 선택한다. 카드는 RAC 행 (`role=row`) 이고 이름은 제목 글자다.
- **ButtonGroup · AvatarGroup 에 자유 내용**: Button · Avatar 밖의 요소 (예: Text) 도 넣을 수 있다 — Preview 가 자식을 순서대로 다 그린다. 같은 그룹 안에 같은 그룹은 넣지 않는다.

### Changed

- **Card 의 구조가 S2 와 같다**: `Card > CardPreview + Content (Text[slot=title] + Text[slot=description]) + Footer`. 제목 · 설명은 Content 안 Text 노드의 글자이고 (캔버스 더블클릭 · Text 선택으로 편집), 모양은 S2 Card 의 값이다 — 크기별 제목 12 / 12 / 14 / 16 / 18 (bold) · 설명 11 / 11 / 12 / 14 / 16 · 사이 간격 4 / 4 / 6 / 6 / 8 (XS ~ XL). 제목과 설명 사이가 좁아졌다 (M: 12 → 6).
- **InlineAlert = Heading + Content** (S2): 설명이 `Content` 안에 있다 — 화면은 같다.
- **Card 부품 type 이 S2 이름**: CardContent · CardFooter → `Content` · `Footer` (Card · InlineAlert 공용 — 배치는 부모 rule 이 준다).

### Removed

- **Card 의 `title` · `description` prop** (Design 패널 Title · Description 칸): S2 Card 에 없다 — 사용자 결정 2026-10-11 「S2 그대로」.
- **CardHeader type**: S2 Card 에 없다.
- **공용 `Card` 컴포넌트의 옛 prop 경로** (`@composition/shared/components` — `title` · `description` · `heading` · `footer` · `asset` · `preview` · `isSelectable` · `isLoading` 등을 스스로 그리던 부분, 사용자 승인 2026-10-11): Card 는 자식 노드만 그린다.

### BREAKING

- **문서 contract 38**: 이전 contract 의 프로젝트는 열리지 않는다 (ADR-256 사용자 결정 — 변환 없음).
  - 위치: `packages/shared/src/catalog/document/generated/reusableOriginLibrary.ts` (Card · InlineAlert template) · `catalog/generated/componentRulesTable.ts` (Card `staticSelectors` · `sizeSelectors`) · `catalog/runtime/delegatedDom.tsx` (Card 의 S2 `TextContext` · CardView = RAC GridList) · `catalog/runtime/racSlot.ts` (`S2_SLOT_PROVIDERS`).
  - 검증: G2 `adr256CardS2.test.tsx` 10 · G3 Card · InlineAlert · CardView PASS · live `adr256-p10a-live.mjs` 9/9 · `adr256-p10b-live.mjs` 6/6.

## [ADR-256 Phase 9 — Calendar 노드 트리 · 표시 기간] - 2026-10-11

### Added

- **Calendar · RangeCalendar `visibleDuration`** (S2 / RAC): 한 번에 보이는 기간 — 수량 + Days / Weeks / Months (Design 패널 Property 탭 「Visible Duration」). 일 · 주 보기는 한 묶음에 그 날짜 범위 (제목 = 날짜 범위), 달 보기는 달마다 묶음 하나 (넘김 버튼은 첫 묶음 왼쪽 · 끝 묶음 오른쪽).
- **Calendar · RangeCalendar `weeksInMonth`**: 달 grid 의 주 행 수 (1 ~ 6, 비우면 그 달에 필요한 만큼).
- **달 · 해 picker** (RAC `CalendarMonthPicker` · `CalendarYearPicker`): 달력 header 에 넣으면 제목 대신 달 · 해 Select 로 넘긴다 — Design "+" 의 header 넣기 목록.
- **반복 template 노드**: 날짜 칸 (`CalendarCell`) · 요일 칸 (`CalendarHeaderCell`) · 날짜 조각 (`DateSegment`) 은 노드 하나를 RAC 가 날짜 · 요일 · 조각마다 그린다 (Preview). 칸 안에 노드를 더하면 Preview 의 모든 칸에 나온다.

### Changed

- **Calendar · RangeCalendar 의 구조가 레퍼런스 예제와 같다**: `Calendar > 달 묶음 (CalendarMonth) > header (이전 Button · CalendarHeading · 다음 Button) + CalendarGrid`. 넘김 버튼 · 제목 · grid 를 Layers 에서 고르고 Styles 로 바꿀 수 있다 (Canvas · Preview 같은 상자).
- **DatePicker · DateRangePicker 안 Calendar**: 첫 요일 · 최소 / 최대 날짜 · 넘김 방식은 picker 의 것 — 안 Calendar 의 Design 패널은 그 prop 을 보이지 않고 안내한다.
- **월요일 시작 + 6주처럼 달 밖 날만 있는 주 행**은 Canvas 에서도 접힌다 (Preview 와 같은 높이).

### Removed

- **공용 `Calendar` · `RangeCalendar` 컴포넌트** (`@composition/shared/components`) 와 Skia `inline_icon_text` primitive · CalendarHeader rule 의 chevron 아이콘 항목: Phase 9 부터 Calendar 는 노드 트리로 그려져 쓰이지 않았다.
- **`maxVisibleMonths`** (Calendar · RangeCalendar · DatePicker · DateRangePicker): Calendar 의 값은 열 때 `visibleDuration` 의 달 수로 바뀐다. picker 의 값은 버린다 (보이는 달 수는 안 Calendar 의 `visibleDuration`).

### BREAKING

- **문서 contract 37**: 이전 contract 의 프로젝트는 열리지 않는다 (ADR-256 사용자 결정 — 변환 없음).
  - 위치: `packages/shared/src/catalog/runtime/calendarModel.ts` (Canvas 의 날짜 계산 — RAC 와 같은 `@internationalized/date` 호출) · `catalog/document/valueType.ts` (`calendarDuration`) · `resolution/resolver.ts` (달 묶음 반복) · `runtime/domBinding.tsx` · `delegatedDom.tsx` (Preview = RAC 직접).
  - 검증: G2 레퍼런스 starter 구조 비교 · G3 Calendar 계열 PASS · live `adr256-p9-live.mjs` 12/12.

## [ADR-258 설계 수리 — 채널 보존 key와 AI 정규화 경로] - 2026-10-11

### Documentation

- **ADR-258 Phase 1~3 계획 보완**: Preview 기본값 key를 원래 색 공간·채널·alpha tuple로 정하고, 패널·AI 수정·AI 생성의 정규화 호출 지점과 실제 catalog host 통합 검증을 명시했다.
  - **Why:** hexa는 무채색 hue를 잃어 기본값 편집을 놓치며, AI는 패널 wrapper를 경유하지 않고 생성 props도 별도 경로로 쓴다.
  - 위치: `docs/adr/258-color-controls-canvas-gradient.md`, `docs/adr/design/258-color-controls-canvas-gradient-breakdown.md`, `docs/adr/reviews/258.md`.
  - 설계 문서 수리만 반영했다. 제품 구현·ADR 상태 승격·새 리뷰 round 없음; 실제 AI 호출과 브라우저 gate는 구현 시 검증한다.

## [S2 ColorSwatch colorName] - 2026-10-11

### Added

- **ColorSwatch `colorName`** (S2 1.8.0 / RAC): 견본의 접근성 이름 (예: "Pantone 7621 C") — 비우면 RAC 가 색 값으로 설명한다. Design 패널 Property 탭 「Color Name」. 화면 (Canvas · Preview) 은 바뀌지 않는다.

## [ADR-257 후속 — GridList · Badge overflowMode] - 2026-10-10

### Added

- **GridList `overflowMode`** (S2 ListView, 기본 truncate): 항목의 label · description 이 한 줄에 말줄임으로 잘린다. Wrap 이면 카드 폭에서 줄을 바꾸고 카드가 자란다 (Canvas · Preview 같은 높이). Design 패널 Property 탭 「Overflow」.
- **Badge `overflowMode`** (S2, 기본 wrap): Truncate 면 한 줄 말줄임.

### Changed

- **Badge 글자가 기본으로 줄을 바꾼다** (S2 기본 wrap): 종전에는 Canvas · Preview 모두 한 줄 고정이었다. 폭을 지정했거나 좁은 자리의 긴 Badge 는 여러 줄이 되고, 줄은 가운데 정렬이다 (S2 는 시작 정렬 — Canvas 의 box 글자 계약에 맞춤). 한 줄로 두려면 Overflow 를 Truncate 로.

## [ADR-257 Phase 5 — TableView 를 S2 처럼 RAC Table 위로] - 2026-10-10

### Changed

- **Preview 의 TableView 가 RAC Table 이다** (S2 1.8.0 `TableView.tsx` 구조 — RAC `ResizableTableContainer` > RAC `Table`): 종전에는 role 만 붙인 div 라 행 선택이 되지 않았다. 이제 Table 과 같이 RAC 의 선택 · `selectionStyle` · Column 정렬 · 열 크기 조절이 동작한다. 칸 모양은 Canvas 와 같은 부품 값을 읽는다.

### Fixed

- 크기 조절 열이 있는 Table · TableView 에서 Builder 의 열 폭 편집이 새로고침 전까지 Preview 에 반영되지 않던 문제.

## [ADR-257 Phase 4 — Table Preview 정렬 · 열 크기 조절] - 2026-10-10

### Added

- **Column `allowsSorting` · `allowsResizing`** (S2 1.8.0, ADR-257 Phase 4 — 사용자 결정 4 · 5): Design 패널 칩 「Allow Sorting」 · 「Allow Resizing」.
  - 정렬: Preview 에서 머리글을 누르면 행이 오름차순 · 내림차순으로 바뀌고 (`aria-sort`, S2 정렬 아이콘), Canvas 와 문서는 작성한 순서 그대로다 — Preview 실행 상태. 작성한 행은 그 열 칸 글자 (숫자 인식), 데이터에 묶인 표는 전체 행을 값으로 정렬한 뒤 높이만큼 보인다.
  - 크기 조절: 크기 조절 열이 있는 표는 Preview 에서 RAC `ResizableTableContainer` 안에 있고, 열 끝 손잡이 (hover 때 보임) 를 끌면 머리글과 모든 칸이 같이 움직인다. 끝난 폭은 Preview 실행 상태 — 새로고침하면 문서 폭.
- 범위 밖: TableView 의 두 조작 — TableView 는 RAC 에 없는 S2 컴포넌트이고 S2 는 RAC `Table` 위에 만드는데, 우리 Preview 는 composition div 로 그린다.

## [ADR-257 Phase 3 — Table 칸 값 · 표 단위 값] - 2026-10-10

### Added

- **Cell · Column `align` · Cell `showDivider` · Table · TableView `overflowMode` · `selectionStyle`** (S2 1.8.0, ADR-257 Phase 3 — 사용자 결정 6 · 7 「S2 대로」):
  - `align` (start · center · end): 그 칸 자신의 정렬. Column 의 값은 머리글 칸에만 적용되고 같은 열 Cell 로 물려주지 않는다 (S2).
  - `showDivider`: 칸 끝 쪽 1px 구분선 (테두리 색). Design 패널 Show 칩 「Divider」.
  - `overflowMode` (기본 truncate): 모든 칸 글자가 한 줄 + 말줄임. wrap 이면 열 폭에서 줄바꿈되고 행이 글자를 따라 자란다 (Canvas · Preview 같은 높이).
  - `selectionStyle` (기본 checkbox): highlight 면 행을 눌러 선택을 바꾸고 (RAC `selectionBehavior="replace"`), 선택 checkbox 열이 Canvas · Preview · 열 트랙에서 빠지며, 선택 행은 S2 highlight 모양 (accent 10% 바탕 + 이어진 선택 묶음 둘레 테두리).
  - 위치: `packages/shared/src/catalog/bindings/{Column,Cell,Table,TableView}.binding.ts` · `generated/componentRulesTable.ts` (Column · Cell `containerVariants`) · `runtime/tableTracks.ts` · `components/styles/Table.css`
- 확인: live — truncate 한 줄 41 = 41 · wrap 직후 행 137 = 137 (Canvas · Preview) · align · Divider 칩 · highlight 에서 마우스 누름이 한 행만 선택 · 오류 0 (`apps/builder/scripts/table-column-tracks-live.mjs` 전체 14/14).

### Fixed

- **palette Table 의 `density` 가 칸에 닿지 않던 문제**: Table 의 density 를 바꿔도 Column · Cell 의 세로 여백이 그대로였다.
  - **Why**: palette Table 의 Column · Cell 은 원본 template 노드로 해석되는데, 그 경로가 Table 값 전파를 부르지 않았다. `overflowMode` 를 같은 경로로 전달하면서 함께 고쳤다.
  - 위치: `packages/shared/src/catalog/resolution/resolver.ts`
- **Canvas · Preview 의 TableView 칸 넘침이 달랐던 것**: Canvas 는 한 줄 · 말줄임, Preview TableView 는 줄바꿈이었다 — 이제 둘 다 `overflowMode` 를 따른다.

### Changed

- **Badge 의 S2 기본 줄바꿈 · GridList `overflowMode` 는 이번에 넣지 않았다** — Canvas 그리기 경로가 Table 과 달라 (Badge 는 rule 도형, GridList 는 항목 안 Text) 다음 Phase 로 미뤘다.

## [ADR-257 Phase 2 — Table Cell colSpan] - 2026-10-10

### Added

- **Cell `colSpan`** (S2 1.8.0 / RAC): 칸이 행 grid 트랙 k 개를 차지한다 (Canvas · DOM 같은 값, RAC 가 `aria-colspan`). Design 패널 Column span 을 늘리면 오른쪽 칸을 흡수하고 (합이 맞지 않으면 거부) 줄이면 빈 칸이 생긴다 — 행은 늘 열 수만큼의 칸을 갖는다 (RAC 는 다르면 throw). 걸친 열을 지우면 span 이 하나 준다. 걸친 열의 숨김 · 순서 변경은 거부한다.
- 확인: live — span 2 칸이 Canvas · Preview 모두 두 열의 시작 · 끝과 같음, `aria-colspan="2"`, 걸친 열 삭제 뒤 모든 행 정렬 · 오류 0 (`apps/builder/scripts/table-column-tracks-live.mjs` G2 3/3).

### Fixed

- span 이 줄어든 행을 Preview 의 RAC 가 옛 열 index 로 세어 throw 하던 문제 — span 구성이 바뀐 행은 다시 만든다.

## [ADR-257 Phase 1 — Table 열 트랙] - 2026-10-10

### Breaking Changes

- **Table · TableView 의 열 배치가 「칸마다 flex: 1」 에서 「행마다 같은 grid 트랙」 으로** (ADR-257 대안 C2): 머리글 행과 모든 Row 가 각자 grid 이고 트랙 목록은 Table 하나가 Column 들의 폭에서 만든다 (`tableTracks.ts`). Column 하나의 폭을 바꾸면 그 열 전체 (머리글 칸 · 모든 Cell) 가 같이 바뀐다 — 종전에는 머리글 칸만 바뀌어 열이 어긋났다. 칸 padding 과 무관하게 fr 비율이 RAC/S2 의미대로다.
- **폭을 안 적은 열은 S2/RAC 기본 `1fr` · 최소 75px** (사용자 결정 1): 바운드 Table 의 옛 기본 150px 고정 · 정적 행의 최소 0 이 바뀐다. 좁은 표 (폭 < 75 × 열 수) 는 가로로 넘친다 (RAC 와 같음). 저장된 문서 중 해당 표 0 (Phase 0 집계).
- **Column · Cell 의 Styles 폭**: 표 안 Column 의 Styles Width · Min · Max 편집은 Column 의 `width` · `minWidth` · `maxWidth` prop 으로 간다 (사용자 결정 2). 옛 문서의 Column Styles 폭은 로드 시 1회 그 prop 으로 옮기고 Cell 의 Styles 폭은 지운다 (칸은 열의 grid 칸).
- TableView 의 긴 무공백 글자 칸이 더는 열을 넓히지 않는다 (트랙 최소가 고정 값).

### Added

- **Column `width` · `defaultWidth` · `minWidth` · `maxWidth`** (S2 1.8.0 `ColumnSize` · `ColumnStaticSize`): 숫자 px · `"Nfr"` · `"N%"` (min/max 는 fr 없음). 문서는 숫자만 둔다 — 숫자 문자열은 검증기가 거부하고 로드 시 숫자로 바꾼다 (S2 타입은 허용하나 RAC 정적 폭 파서가 throw). Design 패널 Property 탭에 Width · Min width · Max width 칸.
- 트랙으로 표현 못 하는 조합 (`Nfr` + `maxWidth`, px 폭 + `%` min/max, `%` 폭 + px max) 은 값은 저장하고 적용하지 않으며 Design 패널이 그 칸 아래에 「적용되지 않음」 을 보인다 (사용자 결정 3 (a)).
- 선택 checkbox 열 (`Checkbox[slot=selection]` 이 든 Column) 은 폭을 안 적으면 S2 의 고정 40px.
- 확인: RAC `calculateColumnSizes` 를 독립 oracle 로 12 입력 (기본 · fr 비율 · `%` 하한 225/75 · 75 하한 고정 · 5열 넘침 · `%` · 선택 열 …) 에서 엔진 폭 ≤ 1 px · 엔진 회귀 `tree.rs` `adr257_*` 4 (padding 무관 · span · 증분 트랙 교체 · 열 추가) · live — 120 · 1fr · 2fr 에서 머리글 · 모든 Cell 의 x · 폭이 Canvas 와 Preview 에서 같음, Design 패널 Width 160 입력 직후 (새로고침 없이) 열 전체가 따라옴, undo, TableView, 새로고침 뒤 유지, 오류 0 (`apps/builder/scripts/table-column-tracks-live.mjs` 6/6).

## [S2 값 정렬 — Meter · InlineAlert · Tooltip · CardView] - 2026-10-10

### Breaking Changes

- **Meter `variant` 값 `warning` → `notice`, `critical` → `negative`** (S2 1.8.0 — Meter · MeterFill · MeterTrack · MeterValue rule 과 생성 CSS, `MeterVariant` 타입). 색은 종전 그대로 (옛 키가 이미 notice · negative 토큰을 쓰고 있었다 — 이름만 v3 잔재). 옛 문서는 로드 시 1회 전환.
- **InlineAlert `variant` 값 `info` → `informative`** (S2 1.8.0 — 기본값 포함). 로드 시 1회 전환.
- **Tooltip `variant` 집합 `neutral · info · positive · negative` → `neutral · informative · negative`** (design-data Tooltip — S2 코드에는 Tooltip variant 가 없어 design-data 가 정본, D2 순서). `positive` 는 삭제 — 옛 값은 로드 시 기본 (neutral) 으로.
- **CardView `variant` 집합 `default` → `primary · secondary · tertiary · quiet`** (S2 1.8.0, 기본 primary): CardView 의 variant 는 안의 Card 들이 입는다 (S2 `ctx = {size, variant}` — resolver `applyOwnerVariant`, 자기 값을 적은 Card 가 이김 + 재해석 큐). 옛 `default` 는 로드 시 삭제.

### Added

- 확인: live — Meter Notice · Negative 에서 Preview `--fill-color` 와 Canvas MeterFill Skia 칠이 같이 바뀜 (주황 · 빨강), InlineAlert 기본 informative (record + `data-variant`), CardView Quiet 에서 안의 Card 3개가 재해석되어 record · Preview 모두 quiet, 오류 0 (`apps/builder/scripts/s2-value-alignment-live.mjs` 5/5 — Tooltip 집합은 닫힌 overlay 라 live 표면이 없어 rule · 계약 테스트가 고정).

## [S2 강조 축 전환 3 — Tree isEmphasized · TableView isQuiet] - 2026-10-10

### Breaking Changes

- **Tree `variant` (default · accent) 제거 → `isEmphasized`** (design-data Tree view — S2 TreeView 에 없는 축은 design-data 가 정본, D2 순서): rule 의 accent 변형은 emphasized 로 개명되어 내부 운반 값으로 남는다. 옛 `accent` 는 로드 시 1회 전환으로 `isEmphasized: true`.
- **TableView `variant` (default · quiet) 제거 → `isQuiet`** (S2 1.8.0 — 2026-06-15 「isQuiet → variant:quiet 흡수」 의 역전환): quiet 시각 (transparent + 테두리 없음) 은 그대로, 공개 축만 S2 boolean 으로. 옛 `quiet` 는 로드 시 1회 전환으로 `isQuiet: true`.

### Added

- 확인: live — Tree Emphasized 토글: 파생 emphasized 변형이 record 에 (Canvas rule paint — DOM Tree 시트는 종전부터 variant 시각이 없음, 기존 상태 유지); TableView Quiet 토글: 파생 quiet 변형이 record 와 Preview `data-variant` 에, 오류 0 (`apps/builder/scripts/s2-tree-tableview-live.mjs` 5/5).

## [S2 강조 축 전환 2 — 그룹 · Radio · Form] - 2026-10-10

### Breaking Changes

- **CheckboxGroup · RadioGroup `variant` (default · accent) 제거 → `isEmphasized`**: 그룹 값이 안의 모든 Checkbox · Radio 에 닿는다 (S2 1.8.0 CheckboxContext — 그룹 값이 toggle 자신의 것을 **이긴다**, resolver `applyOwnerEmphasis` + 재해석 큐). 옛 `accent` 는 로드 시 1회 전환으로 `isEmphasized: true`.
- **Radio `variant` (accent · neutral · negative) 제거**: S2 Radio 의 강조는 그룹의 context 전용 값 — per-Radio 색 축이 없다. 옛 값은 로드 시 삭제.
- **Form `variant` (default · outlined) 제거 → `isEmphasized`**: S2 Form context — `isEmphasized` 를 받는 자식 field (Checkbox · Switch · 그룹 · Slider · TagGroup) 중 자기 값을 안 적은 것에 채워진다 (`CATALOG_FORM_CONTEXT_KEYS`). outlined 는 S2 에 없어 삭제 (테두리는 Styles 로 작성).

### Changed

- **Radio 기본 선택 고리 accent → 중립** (S2 1.8.0 — 기본 Radio 는 gray-800, `isEmphasized` 그룹만 accent). **Why**: 종전엔 변형과 무관하게 항상 accent 고리 (`Radio.css --radio-color`) 라 S2 의 기본 · 강조 구분이 없었다 — Checkbox · Switch 의 기본 (중립) 과도 어긋났다. rule 의 default 변형 · 시트 기본을 중립으로 맞추고 `[data-emphasized]` 에서만 accent.

### Added

- 확인: live — RadioGroup Emphasized 토글: 안의 Radio 2개가 재해석되어 파생 emphasized + Preview `data-emphasized`; CheckboxGroup: `--selected-color` #171717 → accent (computed); Form Emphasized: 자기 값 없는 안의 Checkbox 에 채움, 오류 0 (`apps/builder/scripts/s2-emphasis-groups-live.mjs` 6/6).

## [S2 강조 축 전환 1 — Checkbox · Switch isEmphasized + 로드 시 1회 전환] - 2026-10-10

### Breaking Changes

- **Checkbox · Switch `variant` (default · emphasized) 제거 → `isEmphasized` boolean** (S2 1.8.0 — 조사 §4.2 B). 저장된 옛 문서는 **로드 시 1회 전환** (사용자 결정 2026-10-10): `variant: "emphasized"` → `isEmphasized: true`, 그 밖의 variant write 는 삭제 — `createCatalogGraph` 가 적용하므로 Builder 로드 · import · publish · preview snapshot 이 한 길로 지난다 (`packages/shared/src/catalog/document/s2PropAlignment.ts`).

### Added

- **Checkbox · Switch `isEmphasized`**: 선택 표시 (indicator · track) 가 accent 가 된다. rule 의 emphasized 변형은 그대로 두고 resolver 가 내부 `variant` 를 파생한다 (`CATALOG_BOOLEAN_VARIANTS` — binding 의 variant 는 `editorHidden` 운반 값). Canvas (rule paint) · DOM (`data-emphasized` 수동 시트) 코드가 종전 record 를 그대로 읽는다.
- **stale 변형 폴백**: rule 에 더 없는 variant 값을 가진 옛 record 는 기본 변형으로 그린다 (`resolveCatalogVariantName` — 아무것도 안 그리는 공백 방지).
- 확인: live — 팔레트 Checkbox · Switch: Emphasized 토글에서 Preview indicator 색 neutral→accent (computed), Canvas indicator Skia fill neutral→accent, 파생 variant emphasized; `variant: "emphasized"` 로 저장한 문서가 reload 에서 1회 전환 (`isEmphasized: true` + variant write 소거), 오류 0 (`apps/builder/scripts/s2-emphasis-toggle-live.mjs` 7/7).

## [S2 Table isQuiet — 바깥 틀 제거] - 2026-10-10

### Added

- **Table `isQuiet`** (S2 1.8.0 TableView): 바깥 틀이 없다 — 배경 transparent (rule `fill.quiet`), 테두리 색 지움 + 모서리 직각 (rule top-level `containerVariants.quiet` — Canvas 는 rule 집행기의 containerVariantPaint 가 border-color · border-radius 를 읽고, DOM 은 `Table.css` 의 `[data-quiet]` 블록 + 테이블 요소의 inline radius 교정). 테두리는 색만 지워 1px border-box 기하를 유지한다 (S2 는 width 0 — 우리 `catalogTableHeight` 가 테두리를 기하에 더해 폭을 지우면 양 consumer 높이가 달라진다).
  - containerVariantPaint 에 색 whitelist (border-color · background · color — 쓴 그대로 paint 로) 추가.
- 확인: live — Quiet 토글에서 Preview computed border · radius · 배경과 Canvas Skia box radius · fill alpha 가 같이 꺼짐 (`apps/builder/scripts/s2-density-live.mjs` 4/4 — density 3종과 같은 실행), 오류 0.

## [S2 Table density — Column · Cell 전파] - 2026-10-10

### Added

- **Table `density`** (S2 1.8.0 TableView — compact · regular · spacious): Design 패널의 Density. 값은 Table 의 prop 하나이고 그 안의 모든 Column · Cell 로 전파된다 (resolver `applyOwnerDensity` — 새 `CATALOG_DENSITY_PROPAGATION_OWNER` 표). Column · Cell 의 기존 densities 채널 (paddingY 4 · 8 · 12) 이 적용돼 행 높이가 32 · 40 · 48 이 된다. prop 변경은 재해석 큐로 그 부품들을 다시 해석한다 (size 전파 동형).
  - Column · Cell binding 의 density 는 내부 운반 값 (`editorHidden`) — 패널 미노출.
  - **Card 의 density 는 보류**: Card S2 재편 (CardHeader 제거, 사용자 결정 2026-09-29 — ADR-248 뒤 별도 ADR) 에 묶여 있어 그 작업과 함께 간다 — Card 는 양 consumer 의 padding 채널이 재편 대상이라 지금 얹으면 한쪽 (Canvas) 만 움직인다 (live 실측).
- 확인: live — 노드 트리 Table (2열 1행): Density Regular → Compact → Spacious 에서 Preview 행 높이 40 → 32 → 48, Canvas 의 Column · Cell record padding 8 → 4 → 12, 오류 0 (`apps/builder/scripts/s2-density-live.mjs` 3/3).

## [S2 Slider trackStyle · thumbStyle · fillOffset] - 2026-10-10

### Added

- **Slider `trackStyle`** (S2 1.8.0 `thin` · `thick`): Thick 는 16px 바 + S2 sm 모서리 (4px — S2 trackStyling). 트랙 노드가 파생 `trackStyle` 로 받는다 — Canvas 는 `styleOf` 높이 + SliderTrack rule 의 top-level `containerVariants` radius (`rulePaint` 소비 채널), DOM 은 트랙 inline (`CATALOG_SLIDER_THICK_TRACK` 한 값). Thin (기본) 은 지금까지의 per-size 바 (S 4 · M 8 · L 12 · XL 16).
- **Slider `thumbStyle`** (S2 `default` · `precise`): Precise 는 좁은 막대 썸 (폭 6 · 높이 size+2 — S2 thumb). 썸 배치 (`catalogSliderThumbLayout`) 와 DOM 썸 inline 이 같은 값.
- **Slider `fillOffset`** (S2 number): 채움이 이 값에서 시작한다 — DOM 은 RAC `SliderFill` 의 `offset` prop (파생 `_fillOffset`), Canvas 는 `catalogSliderFillLayout` 이 같은 식 (범위로 clamp, 값과의 사이 구간).
- 확인: live — 팔레트 Slider 400px: 기본 8px 바 → Thick 16px + 4px 모서리 (Preview computed = Canvas geometry · Skia radius), Precise 6×20 썸 (양 consumer), Value 30 + Fill Offset 50 → 채움 30%→50% (양 consumer 비율 동일), 오류 0 (`apps/builder/scripts/slider-s2-styles-live.mjs` 6/6).

## [S2 InlineAlert fillStyle — Border · Subtle Fill · Bold Fill] - 2026-10-10

### Added

- **InlineAlert `fillStyle`** (S2 1.8.0 `border` · `subtleFill` · `boldFill` — house 값 `outline` · `subtle` · `bold`, 라벨은 S2 이름): Border (기본 — S2 자체 기본): 바탕 배경 + variant 색 테두리 · Subtle Fill: variant subtle 배경, 테두리 없음 · Bold Fill: variant 본색 배경 (neutral 은 S2 대로 neutral-subdued), 제목 · 설명 글자가 흰색 (notice 는 검정).
  - 칠은 rule variants 의 fill 3축 (ADR-908 스키마 그대로 — 생성 CSS `[data-fill-style]` 블록 + Canvas `resolveCatalogPaint`). bold 의 제목 · 설명 글자색은 파생 `color` 로 양 consumer 에 닿는다 (`presence.ts` `catalogInlineAlertBoldText` → `derivedProps.color`; 작성한 색이 이김).
  - 원본 라이브러리: definition accepts · defaults 와 template root 에 `fillStyle: "outline"` (publish 등 schema 없는 consumer 의 기본값).

### Changed

- **InlineAlert 기본 외형**: 종전 subtle 배경 + variant 색 테두리 → 바탕 배경 + variant 색 테두리 (S2 'border'). 종전 모양은 Subtle Fill + 색 테두리 조합이 S2 에 없어 S2 축으로 정렬 — 종전 배경은 Subtle Fill 로 고를 수 있다.
- 확인: live — 팔레트 추가 → 기본 Border (Preview bg 흰색 + 파랑 테두리 = Canvas fill), Subtle Fill (연파랑 + 테두리 없음), Bold Fill (본색 + Heading 흰 글자 — Preview computed = Canvas text color), 오류 0 (`apps/builder/scripts/inline-alert-fillstyle-live.mjs` 5/5, 스크린샷 확인).

## [S2 Skeleton isLoading · DropZone isFilled · replaceMessage] - 2026-10-10

### Added

- **Skeleton `isLoading`** (S2 1.8.0, 기본 true): 로딩이 끝나면 (false) placeholder 가 양 consumer 에서 사라진다 — 판정은 `presence.ts` `catalogSkeletonIdle` 하나 (Canvas `catalogHiddenAtRest` · DOM `renderNode`). 상태 변수에 묶으면 로딩 UI 를 만들 수 있다.
- **DropZone `isFilled` · `replaceMessage`** (S2 1.8.0): 채워진 영역 위로 끌 때 교체 배너. 배너는 `isFilled` 일 때 DOM 에 상주하고 (`DropZone.tsx`, 기본 문구 "Drop file to replace"), rule `rootSelectors` 의 `[data-drop-target] .dropzone-replace` 생성 블록이 끄는 동안만 보인다 — Canvas 는 끄는 중 상태를 그리지 않는다.

### Fixed

- **자기 prop 으로 숨는 노드가 prop 토글 때 남음**: 값 편집 재계획이 `presentWhen` · `showWhen` 보유 노드만 presence 를 다시 판정했다 — Skeleton 의 isLoading 토글이 반영되지 않음. 갱신된 record 는 항상 자기 presence 를 다시 판정한다 (`compositionRoot.ts`).
- 확인: live — Skeleton 추가 → Loading 토글 (Preview 요소 제거 + Canvas hidden), DropZone → Filled + "Drop to swap" → 배너 rest 에 display none → dragenter/dragover 시뮬레이션에서 flex + 문구, 오류 0 (`apps/builder/scripts/s2-skeleton-dropzone-live.mjs` 7/7).

## [S2 boolean 시각 — NumberField hideStepper · ToggleButtonGroup isJustified · Link isStandalone] - 2026-10-10

### Added

- **NumberField `hideStepper`** (S2 1.8.0): 증감 버튼을 없앤다. 템플릿의 slot `increment` · `decrement` Button 이 양 consumer 에서 숨는다 — 판정은 `presence.ts` `catalogStepperHidden` 하나 (Canvas `catalogHiddenAtRest` · DOM `renderNode`).
- **ToggleButtonGroup `isJustified`** (S2 1.8.0): 버튼들이 그룹 폭을 같은 몫으로 나눈다 (S2 ActionButton `flexGrow 1 · flexBasis 0`). DOM 은 `[data-justified]` 시트 (`ToggleButtonGroup.css`), Canvas 는 각 버튼의 파생 `_justified` 를 엔진 flex 값으로 (`presence.ts` · `styleOf`).
- **Link `isStandalone`** (S2 1.8.0): 문단 밖 단독 링크 = medium weight (500). DOM 은 `data-standalone` + `Link.css`, Canvas 는 rule top-level `containerVariants.standalone` 을 rule 집행기와 글자 측정이 같이 읽는다. 밑줄 축은 우리 Link 가 rest 에서 이미 없어 바뀌지 않는다.

### Fixed

- **owner prop 으로 숨는 부품이 prop 토글 때 Canvas 에 남음**: 파생 의존 재계획이 `presentWhen` 이 있는 노드만 hidden 을 다시 판정했다 — hideStepper 토글 후 Preview 는 버튼이 사라지는데 Canvas record 는 hidden=false (live 실측). 재계획되는 의존 노드는 항상 hidden 을 다시 판정한다 (`compositionRoot.ts` withHidden).
  - **Why**: hidden 재판정이 자기 입력 변경 경로에만 있었고, owner 프로프 기반 숨김 축 (showValueLabel 등) 은 DOM 쪽 자체 술어로만 가려져 있었다.
- 확인: live — NumberField 추가 → Hide Stepper 토글 (Preview 버튼 0 · Canvas hidden) · TBG 600px → Justified (양 consumer 296/296) · Link → Standalone (양 consumer 400→500), 오류 0 (`apps/builder/scripts/s2-boolean-visual-live.mjs` 8/8).

## [S2 색 geometry — ColorSwatch rounding · ColorWheel size] - 2026-10-10

### Added

- **ColorSwatch `rounding`** (S2 1.8.0 — `default` · `none` · `full`): Design 패널의 Rounding. 모서리를 S2 값대로 — Default 는 4px (S2 sm), None 은 직각, Full 은 지금까지의 원 (기본값 — S2 자체 기본은 default). DOM 은 `data-rounding` 시트 블록, Canvas 는 rule 의 top-level `containerVariants.rounding` 을 rule 집행기가 읽는다 (`rulePaint.ts` containerVariantPaint — 새 소비 채널).
  - 변형을 `structure.composition` 에 두면 `catalogSizeAxisSkip` 의 ownsContainerBox 가 뒤집혀 per-size height 공급이 끊긴다 (live 실측 2×2 swatch) — top-level + 수동 시트 조합 (CheckboxGroup 선례).
  - 위치: `packages/shared/src/catalog/bindings/ColorSwatch.binding.ts` · `packages/shared/src/catalog/outputs/toRacProps.ts` (`data-rounding`) · `packages/shared/src/catalog/runtime/rulePaint.ts` · `packages/shared/src/components/styles/ColorSwatch.css`
- **ColorWheel `size`** (S2 1.8.0 — 바깥 지름 px, 175 floor): Design 패널의 Size. 기본 180 (종전 Canvas M 상자 — S2 자체 기본은 192). Canvas 상자와 DOM 상자가 같은 정사각이 되고, catalog DOM 경로가 RAC 필수 radii (`outerRadius` · `innerRadius`) 를 처음으로 넘긴다 (종전엔 없어서 RAC 가 0 크기 track 을 그렸다).
  - 위치: `packages/shared/src/catalog/bindings/ColorWheel.binding.ts` · `packages/shared/src/catalog/resolvers/resolveCatalogRuleCanvasBox.ts` (`catalogColorWheelDiameter`) · `packages/shared/src/catalog/runtime/{compositionRoot.ts,domBinding.tsx}`

### Fixed

- **ColorSwatch 가 Canvas 에서 2px 세로줄**: 수동 시트의 고정 `width: 28px` 는 DOM 에만 닿고 Canvas 는 폭 공급이 없었다 (S · L 은 DOM 도 직사각). swatch 는 정사각 (S2 size × size) — DOM 은 `aspect-ratio: 1`, Canvas 는 `styleOf` 가 rule height 를 폭으로 같이 공급.
  - **Why**: color 계열 box-only cutover (2026-06-11) 때 수동 CSS 폭이 한쪽 consumer 에만 남았다.
- 확인: live — swatch 기본 28×28 원 (양 consumer), Rounding None → 0 · Default → 4px (DOM computed · Skia box radius 동일), wheel 기본 180 → Size 240 → 240 · 100 → 175 (양 consumer 동일), 오류 0 (`apps/builder/scripts/color-geometry-live.mjs` 9/9).

## [S2 토스트 위치 — 프로젝트 설정 toastPlacement] - 2026-10-10

### Added

- **프로젝트의 토스트 위치** (S2 1.8.0 `ToastContainer` `placement` — `top` · `top end` · `bottom` · `bottom end`, 앱에 영역 하나): Settings 패널의 App 절에 Toast Placement (위쪽 · 아래쪽) · Toast Align (가운데 · 끝). 값은 프로젝트 문서의 `toastPlacement` 하나 (S2 값 그대로) 이고, Preview 와 Publish 의 토스트 영역이 그 자리에 선다. 한 번 바꿀 때마다 히스토리 한 단계.
  - 사용자 결정: S2 의 ToastContainer 에 해당하는 노드가 없어 프로젝트 설정에 둔다 (Toast 노드는 페이지 안의 상자라 대상이 아님).
  - 기본값은 지금까지의 자리인 아래쪽 끝 (S2 자체 기본은 아래쪽 가운데).
  - 패널은 두 토글로 나눴다 — 네 이름이 패널 한 줄에 들어가지 않고, S2 Toast 도 안에서 placement + align 으로 나눠 읽는다.
  - 위치: `packages/shared/src/catalog/document/{types,validation}.ts` (`toastPlacement` · `INVALID_TOAST_PLACEMENT`) · `packages/shared/src/catalog/commands/project.ts` (`setToastPlacement`) · `packages/shared/src/catalog/runtime/domView.tsx` (`CatalogToastProvider`) · `apps/builder/src/builder/panels/settings/{SettingsPanel.tsx,useCatalogToastPlacement.ts}` · `apps/builder/src/preview/catalog/catalogPreviewApp.tsx` · `apps/publish/src/App.tsx`
- 확인: live — Button 의 press 규칙이 토스트를 띄우는 문서에서 Settings 기본 Bottom · End, 토스트가 Preview 창의 아래쪽 끝 · Top/Center → 위쪽 가운데 · Top/End → 위쪽 끝 · Bottom/Center → 아래쪽 가운데 (창 가장자리 기준 1px 안), 되돌리기 → 아래쪽 끝, 오류 0 (`apps/builder/scripts/toast-placement-live.mjs` 7/7).

## [S2 메뉴 위치 — Select · ComboBox · MenuTrigger direction · align · menuWidth] - 2026-10-10

### Added

- **Select · ComboBox · MenuTrigger 의 `direction` · `align`, Select · ComboBox 의 `menuWidth`** (S2 1.8.0 Picker · ComboBox · MenuTrigger — 조사 문서 「overlay 위치」): Design 패널의 Direction · Align · Menu Width. Preview 의 메뉴가 이 값대로 열린다.
  - placement = S2 와 같이 `${direction} ${align}` (기본 bottom · start — RAC 의 `bottom start` 그대로). MenuTrigger 의 옆 방향 (left · right · start · end) 은 align start → top, end → bottom.
  - Menu Width (px): Select 는 메뉴 폭 (trigger 폭이 최소값, quiet 이면 적용 안 함 — S2), ComboBox 는 `--trigger-width` (폭과 최소값). Select 메뉴에서는 Popover 시트의 크기별 최대 폭 (M 250) 을 풀어 S2 처럼 화면 폭까지 둔다.
  - Popover 노드에 직접 고른 placement · 폭이 있으면 그것이 이긴다.
  - Canvas 는 닫힌 메뉴를 그리지 않아 바뀌는 그림이 없다.
  - 위치: `packages/shared/src/catalog/bindings/{Select,ComboBox,MenuTrigger}.binding.ts` · `packages/shared/src/catalog/runtime/domBinding.tsx` (`catalogS2OverlayPlacement`) · `packages/shared/src/components/MenuTrigger.tsx`
- 확인: live — 세 컴포넌트를 팔레트에서 추가해 Design 패널에 Direction · Align (· Menu Width) 표시, 기본은 trigger 아래 시작 끝 · trigger 폭, Direction Top · Align End · Menu Width 320 → trigger 위 · 끝 맞춤 · 320 폭 (Select · ComboBox), Menu Direction End · Align End → 오른쪽 · 아래 끝 맞춤, Canvas 의 닫힌 메뉴 숨김 유지, 오류 0 (`apps/builder/scripts/overlay-position-live.mjs` 13/13).

## [field side 라벨 — S2 grid, 글자 폭 라벨 열] - 2026-10-10

### Fixed

- **field · picker 의 Label Position Side 라벨이 글자 폭이 아니라 176px 고정 열이었다** (사용자 「text, number, search, date, time, color, date picker, date range 모든 field · picker … label width 가 fit content 로 지정되지 않았다 — slider 와 같은 패턴」): TextField · TextArea · NumberField · SearchField · ColorField · DateField · TimeField · DatePicker · DateRangePicker · Select · ComboBox · CheckboxGroup · RadioGroup.
  - **Why**: side 배치가 flex-row + 라벨 `width: var(--form-label-width, 11rem)` 이라 Form 밖에서도 176px 였고, 도움말 · 오류 문구의 들여쓰기도 그 176 에 기대고 있었다.
  - 수정: S2 `field()` 처럼 side 는 grid (`auto minmax(0, 1fr)`) — 라벨은 1열 (글자 폭), 입력칸 · 도움말 · 오류 문구는 2열 (도움말이 입력칸 아래 같은 x). 크기별 `--*-side-gap` 들여쓰기 변수는 지웠다.
  - side Form 안에서는 종전처럼 라벨 열이 176px 로 맞는다 (`--form-label-width` — 상속이라 깊이와 무관, 가장 가까운 Form). Canvas 는 Form → field → Label 규칙 (`formFieldLabelPartRules`) 을 가장 가까운 Form 에서 읽는다 — 종전엔 Form 원본 instance 에 넣은 field 가 Form type 의 규칙을 못 찾았다 (`ruleDefinitionOf`).
- **side 라벨의 세로 위치** (사용자 「RSC 에는 가운데 정렬이다」): 한 줄 입력칸 field 는 입력칸 행의 가운데 (S2 baseline 과 같은 줄 — 엔진에 grid baseline 이 없어 `align-self: center`), TextArea 는 위 + 첫 줄 높이 여백 (사용자 「Text Area 는 상단 위치해야 하지만 여백은 가져야 한다」 — 크기별 `--tf-side-label-offset` S 3 · M 5 · L 9 · XL 13), CheckboxGroup · RadioGroup 은 첫 항목 줄 (위).
- **TextArea placeholder · 글자가 Canvas 에서 상자 가운데였다** (사용자 「textarea placeholder 텍스트가 상단이 아니라 가운데 — css 와 비교」): `<textarea>` 는 위 padding 에서 시작한다. 옛 Skia 투영이 주던 `verticalAlign: "top"` 을 catalog 경로가 잃었다 — TextArea 의 Input part rule 이 다시 준다.
  - 위치: `packages/shared/src/catalog/generated/componentRulesTable.ts` (field 13종 side 블록 · 최상위 거울) · `packages/shared/src/catalog/document/rulePartRules.ts` · `packages/shared/src/catalog/resolution/resolver.ts` · `packages/shared/src/catalog/runtime/{rulePaint,compositionRoot}.ts`
- 확인: live — 13종 각각 Label Position Side + Description → 라벨 = 글자 폭 (< 176), 세로 위치 (가운데 · TextArea 첫 줄 · 그룹 위), 입력칸 x · 폭, 도움말 x · y 가 Canvas = Preview, side Form 안 field 라벨 176 (Canvas = Preview), 오류 0 (`apps/builder/scripts/field-side-label-live.mjs` 15/15). TextArea placeholder 는 스크린샷으로 Canvas · Preview 모두 위쪽.

## [S2 ColorField placeholder] - 2026-10-10

### Added

- **ColorField `placeholder`** (S2 1.8.0 `Pick<InputProps, 'placeholder'>`, 기본값 없음 — 조사 문서 6.1 다): Design 패널의 Placeholder. 원본 ColorField 가 이 값을 Input 에 묶는다 (`{placeholder}` — TextField · NumberField 와 같음). Canvas 와 Preview 가 같은 글자를 그린다.
  - 위치: `packages/shared/src/catalog/bindings/ColorField.binding.ts` · `packages/shared/src/catalog/document/generated/reusableOriginLibrary.ts` (component-colorfield)

### Changed

- **새 ColorField 의 입력칸에 `#000000` 이 보이지 않는다**: 전에는 Input 에 고정 placeholder `#000000` 이 있어 작성자가 바꿀 수 없었다. S2 처럼 기본값이 없다.
- 확인: live — 새 ColorField 는 Canvas · Preview 모두 빈칸 (입력칸 높이 30 = 30), Placeholder `#FF0000` → 둘 다 표시, 지우면 둘 다 빈칸, 오류 0 (`apps/builder/scripts/colorfield-placeholder-live.mjs` 4/4).

## [S2 ProgressCircle staticColor — S2 값으로] - 2026-10-10

### Changed

- **ProgressCircle `staticColor` 가 S2 1.8.0 과 같은 색으로 그려진다** (사용자 「ProgressCircle 도 S2와 동일하게」 — S2 `ProgressCircle` `track` · `fill`): track 은 static 색 25% → **17%** (`transparent-overlay-300`), 진행 호는 불투명 → **94%** (`-900`). Meter · ProgressBar 와 같은 값이다.
  - Preview 는 `ProgressCircle.tsx` 의 SVG stroke, Canvas 는 `value_fill_arc` 의 호 `strokeAlpha` — 같은 상수. 작성한 색이 있으면 그 색이 이긴다.
  - 위치: `packages/shared/src/components/ProgressCircle.tsx` · `packages/rendering/src/renderers/skiaPrimitives.ts` (`value_fill_arc`)
- 확인: live — Design 패널 Black → Preview track `rgba(0, 0, 0, 0.17)` · 호 `rgba(0, 0, 0, 0.94)`, Canvas 화면 픽셀에도 0.94 검정 (≈15) 과 0.17 track (≈212) 이 생기고 순검정은 없다 (Preview 와 같음), White → Preview 흰색 0.17 · 0.94, Auto → 테마색 (`apps/builder/scripts/progress-circle-static-live.mjs` 4/4).

## [S2 Slider · TagGroup labelAlign] - 2026-10-10

### Added

- **Slider · TagGroup `labelAlign`** (S2 1.8.0 — start · end, 조사 문서 6.1 다): side 라벨 열 안에서 라벨 글자 정렬. Label Position 이 Side 일 때 Design 패널에 나온다. Form 의 Label Align 도 받는다 (`formContext.ts`).
  - Preview 는 `data-label-align` 와 rule 의 `label-align` 블록 (`--form-label-align`), Canvas 는 같은 블록을 Label part rule 로 읽는다.
  - 위치: `packages/shared/src/catalog/bindings/{Slider,TagGroup}.binding.ts` · `packages/shared/src/catalog/generated/componentRulesTable.ts` (Slider · TagGroup) · `packages/shared/src/catalog/runtime/delegatedDom.tsx` · `packages/shared/src/components/styles/TagGroup.css`

### Changed

- **side TagGroup 의 Tag 목록은 남은 폭을 채운다** (S2 side field 의 입력 영역 `1fr`).
- side 라벨 폭은 글자 폭이다 (S2 side 라벨 열 `auto` — Meter · ProgressBar 와 같음). 처음 커밋 (`67c048b10`) 은 Slider · TagGroup side 라벨을 field 라벨 열 176px 로 바꿨는데, 사용자 확인 「slider 는 label width 가 fit content 가 정상 적용되지 않고있다」 로 같은 날 되돌렸다. 글자 폭 라벨이라 Label Align 은 Form 등에서 라벨이 넓어질 때 보인다.
- 확인: live — Slider · TagGroup 각각 Label Position Side → 라벨 = 글자 폭 (Slider 36.4 · TagGroup 66.8, Canvas = Preview), track · Tag 목록이 나머지 (1834.9 · 1849, Canvas = Preview), Label Align (Start · End) 표시, End → Preview `data-label-align` · Canvas text-align end (`apps/builder/scripts/slider-tag-label-align-live.mjs` 5/5).

## [S2 Meter · ProgressBar staticColor — S2 값으로] - 2026-10-10

### Changed

- **Meter · ProgressBar `staticColor` 가 S2 1.8.0 과 같은 색으로 그려진다** (사용자 「Static Color 일 때 S2와 동일하게」 — S2 `bar-utils.ts` · `fieldLabel`):
  - track: static 색 25% → **17%** (`transparent-overlay-300`).
  - 채움: 불투명 → **94%** (`transparent-overlay-900`).
  - 라벨 · 값 글자: 테마색 그대로였다 → **static 색** (`transparent-overlay-1000`). 작성한 글자색은 그대로 이긴다.
  - Preview 는 수동 `ProgressBar.css` (`--fill-color` · `--track-color` · Meter `.bar` · `:is(.react-aria-Label, .value)`), Canvas 는 rule variant 의 새 채널 `staticAlpha` (track 0.17 · fill 0.94 — `resolveCatalogPaint` 가 static 칠의 투명도로 쓴다) 와 라벨 · 값 노드가 받는 owner 의 `staticColor` (`presence.ts` `catalogProgressStaticText`, 라벨 글자색은 `compositionRoot.ts` `derivedOf`).
  - 위치: `packages/shared/src/types/catalog-style.types.ts` · `packages/shared/src/catalog/resolvers/resolveCatalogPaint.ts` · `packages/shared/src/catalog/generated/componentRulesTable.ts` (ProgressBarTrack · ProgressBarFill · MeterTrack · MeterFill) · `packages/shared/src/catalog/runtime/{presence.ts,compositionRoot.ts}` · `packages/shared/src/components/styles/ProgressBar.css`
- 확인: live — Meter · ProgressBar 각각 Design 패널 White · Black → Preview track `rgba(…, 0.17)` · 채움 `rgba(…, 0.94)` · 라벨 · 값 흰색 / 검정, Canvas track · 채움 · 라벨 · 값도 같은 색, Auto → 둘 다 테마색으로 복귀, 높이 Canvas = Preview (`apps/builder/scripts/meter-static-color-live.mjs` 7/7).

## [S2 Meter staticColor] - 2026-10-10

### Added

- **Meter `staticColor`** (S2 1.8.0 Meter — 조사 문서 목록 D 의 마지막 항목):
  - auto · white · black. 유색 배경 위에서 채움을 흰색 · 검정으로, track 을 그 색의 25% 로 칠한다 (S2 `fillStyles` `isStaticColor` — variant 색은 읽지 않는다). ProgressBar `staticColor` 와 같은 스킴이다.
  - Preview 는 Meter 의 `data-static-color` 와 수동 `ProgressBar.css` (`--fill-color` · `.bar` 배경), Canvas 는 MeterTrack · MeterFill 이 Meter 의 값을 받아 (`presence.ts`) `resolveCatalogPaint` 가 칠한다 — MeterTrack variant 에 value-fill track 표시 (`fillBar`) 를 넣었다.
  - 위치: `packages/shared/src/catalog/bindings/Meter.binding.ts` · `packages/shared/src/catalog/generated/componentRulesTable.ts` (MeterTrack) · `packages/shared/src/catalog/runtime/delegatedDom.tsx` · `packages/shared/src/components/styles/ProgressBar.css`
- 확인: live — Design 패널 Static Color White → Preview 채움 흰색 · track `rgba(255, 255, 255, 0.25)` · Canvas track · fill 흰색, Black → 검정, Auto → variant 색으로 복귀, 높이 Canvas = Preview 32 (`apps/builder/scripts/meter-static-color-live.mjs` 4/4).

## [S2 Disclosure — 위아래 테두리 · isQuiet · density] - 2026-10-10

### Added

- **Disclosure `isQuiet` · `density`** (S2 1.8.0 Disclosure — 사용자 결정 「S2 처럼 기본 Disclosure 에 위아래 테두리를 넣고, isQuiet 로 없애게」):
  - `isQuiet`: 위아래 테두리를 없애고 제목 버튼 모서리를 둥글게 한다 (S2 `borderRadius.isQuiet`).
  - `density`: 제목 버튼 높이 — compact · regular · spacious (S2 `minHeight`: S 18 · 24 · 32, M 24 · 32 · 40, L 32 · 40 · 48). `min-height` 와 한 줄을 가운데에 두는 세로 padding 으로 그린다.
  - Preview 는 Disclosure 의 `data-quiet` · `data-density` · `data-in-group` 와 생성 CSS (`containerVariants` · `rootSelectors`), Canvas 는 같은 rule 선언을 읽는다 — 테두리는 `catalogDisclosureBorders` (엔진의 위아래 border · 상자의 변별 stroke), 제목 버튼은 part rule (정적 trigger 선택자가 size 별 루트 변수를 읽고, density · quiet 블록이 trigger 를 고른다).
  - 위치: `packages/shared/src/catalog/bindings/Disclosure.binding.ts` · `packages/shared/src/catalog/generated/componentRulesTable.ts` (Disclosure) · `packages/shared/src/catalog/runtime/{disclosureBorders.ts,compositionRoot.ts,presence.ts,delegatedDom.tsx}` · `packages/shared/src/catalog/document/{rulePartRules.ts,codeCatalogLibrary.ts}` · `apps/builder/src/builder/catalogRuntime/canvasBinding.ts`

### Changed

- **Disclosure 의 기본 모양** (S2): 위아래 1px 테두리 (`var(--border)`) 가 생기고, DisclosureGroup 안에서는 마지막 항목만 아래 테두리를 남긴다 (S2 `isInGroup` · `:last-child`). 루트 모서리와 제목 버튼 모서리는 각지고 (전: 6px), 제목 버튼 높이가 S2 regular 값이 된다 (S 34 → 24 · M 36 → 32 · L 38.9 → 40).
- 확인: live — 기본 위아래 1px · 각진 버튼, Quiet → 테두리 없음 · 둥근 버튼 · 2px 낮아짐, Density compact · regular · spacious → 버튼 24 · 32 · 40, Size S · L · M → min-height 24 · 40 · 32 와 padding 3 · 8 · 6, 팔레트 DisclosureGroup → 마지막 항목만 아래 테두리 — 매 단계 Canvas = Preview (`apps/builder/scripts/disclosure-s2-live.mjs` 11/11).

## [S2 시각 축 — Slider · TagGroup isEmphasized, Avatar isOverBackground] - 2026-10-10

### Added

- **Slider `isEmphasized`** (S2 1.8.0 — 조사 문서 목록 D):
  - 채워진 트랙과 thumb 가 기본은 neutral, 강조면 accent 다 (S2 `gray-700` · `accent-900`, 우리 Checkbox · Switch 선택 색과 같은 짝).
  - Preview 는 Slider 의 `data-emphasized` 와 SliderFill 의 `data-variant` (`SliderFill.css` · 생성기 slider archetype 의 thumb), Canvas 는 SliderFill · SliderThumb rule 의 `emphasized` variant (Slider 에서 파생 — `presence.ts`).
  - 위치: `packages/shared/src/catalog/bindings/Slider.binding.ts` · `packages/shared/src/catalog/generated/componentRulesTable.ts` (SliderFill · SliderThumb) · `packages/rendering/src/renderers/CSSGenerator.ts` · `packages/shared/src/catalog/runtime/{presence.ts,domBinding.tsx}`
- **TagGroup `isEmphasized`**: 선택된 Tag 가 기본은 neutral (글자 흰색), 강조면 accent 다 (S2 `TagGroupContext`). Preview 는 TagGroup 의 `data-emphasized` (`TagGroup.css`), Canvas 는 Tag rule 의 `selectedEmphasized` (Tag 의 `_emphasized` — `rulePaint.ts` 가 `selected` 대신 고른다).
  - 위치: `packages/shared/src/catalog/bindings/TagGroup.binding.ts` · `packages/shared/src/components/styles/TagGroup.css` · `packages/shared/src/catalog/runtime/{rulePaint.ts,presence.ts,delegatedDom.tsx}`
- **Avatar `isOverBackground`**: 원 바깥에 배경색 1px 외곽선 (64px 초과 2px — S2 `imageStyles`). Preview 는 `Avatar.tsx` 의 `outline`, Canvas 는 `avatar` primitive 가 원 바깥에 같은 링을 그린다. 팔레트 AvatarGroup 의 아바타 3개는 켜져 있다 (S2 AvatarGroup 이 안의 Avatar 에 주는 값).
  - 위치: `packages/shared/src/catalog/bindings/Avatar.binding.ts` · `packages/shared/src/components/Avatar.tsx` · `packages/rendering/src/renderers/skiaPrimitives.ts` (`avatar`) · `packages/shared/src/catalog/document/generated/reusableOriginLibrary.ts`

### Changed

- **Slider 의 채움 · thumb, 선택된 Tag 의 기본 색이 accent → neutral**: S2 에서 accent 는 강조 (`isEmphasized`) 일 때의 색이다. 기존 Slider · TagGroup 은 Emphasized 를 켜야 전과 같은 파란색이 된다.
- 확인: live — Slider 기본 채움 · thumb `rgb(23,23,23)` = Preview, Emphasized → `rgb(54,96,240)` = Preview / TagGroup 선택 Tag 기본 23 = Preview, Emphasized → accent = Preview / Avatar Over Background → Canvas 링 1px 흰색 = Preview `outline 1px solid` 흰색 (전에는 없음) / 팔레트 AvatarGroup 아바타 3개 모두 링 (`apps/builder/scripts/s2-emphasis-live.mjs` 7/7).

## [NumberField 빈 값 — 값이 없으면 빈칸과 placeholder (S2)] - 2026-10-10

### Changed

- **새 NumberField 가 「0」 대신 빈칸으로 시작한다** (S2 1.8.0 NumberField — 값이 없으면 빈 입력칸):
  - 전에는 Preview 가 값이 없어도 RAC 를 0 으로 시작했고 (`Number(props.value || 0)`), Canvas 는 원본 Input 에 고정된 placeholder `"0"` 을 그렸다. 이제 Value 가 비어 있으면 양쪽 모두 빈칸이고, 지우면 다시 빈칸이 된다.
  - 값이 있으면 양쪽이 RAC 가 처음 보이는 글자를 그린다 — 범위 · step 에 맞춘 값 (`useNumberFieldState` 의 snap — 원본 범위 0–100 이면 150 → 100) 을 locale 숫자 형식으로 (1234.5 → `1,234.5`). 전에는 Canvas 가 값을 그리지 않았다 (늘 `"0"`).
  - 위치: `packages/shared/src/catalog/runtime/delegatedDom.tsx` (`numberfield`) · `packages/shared/src/catalog/runtime/presence.ts` (`catalogNumberFieldValue` · `catalogNumberFieldText` — Input 의 파생 글자)

### Added

- **NumberField `placeholder`** (S2 `Pick<InputProps, 'placeholder'>`, 기본값 없음): 원본 `component-numberfield` 가 받아 Input 에 묶는다 (`{placeholder}` — TextField 와 같은 방식). 값이 비어 있는 동안 양쪽에 보인다.
  - 확인: live — 팔레트 NumberField 가 Canvas · Preview 모두 빈칸 (입력칸 높이 30 = 30), Placeholder `Amount` → 양쪽 `Amount`, Value 42 → 양쪽 `42`, 150 → 양쪽 `100`, Value 지움 → 양쪽 빈칸 + `Amount` (`apps/builder/scripts/numberfield-empty-live.mjs` 6/6). 소수 step · 천 단위 형식은 `numberFieldEmptyValue.test.tsx`.
  - 위치: `packages/shared/src/catalog/bindings/NumberField.binding.ts` · `packages/shared/src/catalog/document/generated/reusableOriginLibrary.ts`

## [Form context — Form 의 값이 안의 field 에 닿게] - 2026-10-10

### Fixed

- **Form 의 Label Position · Label Align · Necessity Indicator 가 안의 field 에 닿지 않던 문제** (Canvas · Preview 둘 다):
  - Form 을 Side 로 바꿔도 안의 TextField 는 양쪽 다 top 이었다.
  - **Why**: field 원본이 자기 `labelPosition: "top"` 을 갖고 있어 DOM 의 Form 상속 (`inheritedForm` — 값이 없을 때만) 이 늘 가려졌고, Canvas 에는 Form 값을 읽는 길이 아예 없었다 (necessityIndicator 만 예외).
  - 수정: S2 `useFormProps` 와 같이 — field 가 **작성하지 않은** 키만 가장 가까운 Form 값으로 채운다. resolver (`applyFormContext`) 가 하므로 Canvas 와 DOM 이 같은 record 를 읽고, Form 을 고치면 안의 field 가 다시 해석된다. CheckboxGroup → Checkbox 상태와 같은 「위 노드의 값이 아래에 닿는」 축이다.
  - Design 패널도 그 값의 출처를 「form」 으로 읽는다 (`fieldSource` — resolver 와 같은 순서: 작성값 · 상태 > Form > template · 기본값).
  - 위치: `packages/shared/src/catalog/document/formContext.ts` (키 · field 목록) · `packages/shared/src/catalog/resolution/{resolver.ts,fieldSource.ts}` · `packages/shared/src/catalog/runtime/compositionRoot.ts`

### Added

- **Form `isRequired` · `isDisabled`** (S2 1.8.0 Form context): 안의 field 가 자기 값이 없으면 받는다. Form 상자 자신은 흐려지지 않는다 — Form rule 의 쓰이지 않던 disabled 투명도 (Canvas 만 칠해 field 와 두 번 흐려졌을 값) 를 지웠다.
  - 확인: live — 팔레트 Form (TextField 2개) 에서 Label Position Side → 두 field 모두 라벨 열 176 = Preview 176 (전 top), Label Align End → 라벨 글자 끝 정렬 (양쪽), Disabled → Preview input disabled · field 투명도 0.38 = Canvas 0.38 · Form 상자 1 = 1, 끄면 원래대로 (`apps/builder/scripts/form-context-live.mjs` 6/6). field 자기 값이 이기는 것 · Required 전달 · Design 패널 출처는 `formContext.test.ts`.
  - 위치: `packages/shared/src/catalog/bindings/Form.binding.ts` · `packages/shared/src/catalog/generated/componentRulesTable.ts` (Form `states`)

## [S2 전용 prop 2순위 — Separator staticColor] - 2026-10-09

### Added

- **Separator `staticColor` (auto · white · black)** — S2 1.8.0 Divider (조사 문서 4.2 목록 D):
  - 유색 배경 위에서 선을 흰색 · 검은색으로 그린다. 값은 S2 `transparent-white-200` · `transparent-black-200` 의 투명도 0.14, size L 은 `-800` 의 0.85. 작성한 선색 (Styles) 이 이기고, 테두리로 그리는 dashed · dotted 는 S2 에 없어 그대로 둔다.
  - Preview 는 `data-static-color` → `Separator.css`, Canvas 는 `divider` primitive 가 같은 값을 그린다.
  - 확인: live — Static Color Black → Preview 선 `rgba(0, 0, 0, 0.14)` (전 `rgb(229, 229, 229)`), 높이 2 = 2, Size L → `rgba(0, 0, 0, 0.85)` · 높이 4 = 4, White → `rgba(255, 255, 255, 0.85)` (`apps/builder/scripts/separator-static-color-live.mjs` 4/4). Canvas 의 칠은 `separatorStaticColor.test.ts` 가 실제 Canvas node 의 색 (흰 · 검정, 0.14 · 0.85) 으로 확인한다.
  - 위치: `packages/shared/src/catalog/bindings/Separator.binding.ts` · `packages/shared/src/components/styles/Separator.css` · `packages/rendering/src/renderers/skiaPrimitives.ts` (`divider`)

## [S2 전용 prop 2순위 — Switch · TagGroup 상태 축] - 2026-10-09

### Added

- **Switch `isRequired` · `isInvalid`** (S2 1.8.0 · RAC `SwitchField`):
  - Design 패널 State 에 Required · Invalid. Invalid 면 Error Message 가 Preview · Canvas 에 함께 보이고 (template 의 FieldError), Required 면 Preview input 이 `required` 다. S2 처럼 트랙 모양은 바꾸지 않는다.
  - **Why**: Switch 는 Error Message 를 받는데 Invalid 를 받지 않아, 문구를 적어도 어디에도 보이지 않았다.
  - 확인: live — Error Message 만 적으면 양쪽 다 숨김, Invalid → Preview `data-invalid` · 문구 「Turn it on」 · Canvas 오류 높이 16 = Preview 16 · 트랙 그대로, Required → Preview input `required` (`apps/builder/scripts/switch-invalid-required-live.mjs` 4/4).
  - 위치: `packages/shared/src/catalog/bindings/Switch.binding.ts` · `packages/shared/src/catalog/runtime/delegatedDom.tsx`
- **TagGroup `isInvalid` · Error Message 패널 항목** (S2 1.8.0 TagGroup `HelpText`):
  - Design 패널 State 에 Error Message · Invalid. 오류 문구는 Invalid 일 때만 보인다.

### Changed

- **TagGroup 오류 문구는 Invalid 일 때만** — 종전에는 문구가 있으면 늘 보였다 (S2 는 invalid 일 때만 보인다). RAC TagGroup 에는 검증이 없어 Canvas 와 Preview 가 같은 판정 (`catalogFieldHintShown`) 을 읽는다.
  - 확인: live — Error Message 「Too many」 만 적으면 양쪽 숨김, Invalid → Preview 문구 · Canvas 높이 16 = 16, 다시 끄면 양쪽 숨김 (`apps/builder/scripts/taggroup-invalid-live.mjs` 4/4).
  - 위치: `packages/shared/src/catalog/bindings/TagGroup.binding.ts` · `packages/shared/src/catalog/runtime/{presence.ts,domBinding.tsx}`

## [S2 전용 prop 2순위 — 그룹 labelAlign · side 라벨 정렬 수정] - 2026-10-09

### Added

- **CheckboxGroup · RadioGroup `labelAlign` (start · end, 기본 start)** — 사용자 「6.1 분류 고치고 ②로 넘어가」 (조사 문서 `S2_PROP_ALIGNMENT_2026-10.md` 6.1 「다」 의 작은 축):
  - Label Position 이 Side 일 때 Design 패널 Appearance 에 Label Align 이 보인다. 값은 S2 1.8.0 `Alignment` 그대로 start · end (다른 field 는 종전대로 center 도 있다).
  - 그룹 rule 의 `label-align` 블록이 `--form-label-align` 을 정하고, Preview 는 그룹 요소의 `data-label-align`, Canvas 는 같은 블록을 Label part rule 로 읽는다.
  - 위치: `packages/shared/src/catalog/bindings/{CheckboxGroup,RadioGroup}.binding.ts` · `packages/shared/src/catalog/generated/componentRulesTable.ts` · `packages/shared/src/catalog/runtime/delegatedDom.tsx`

### Fixed

- **side 라벨의 Label Align 이 Preview 에서 글자를 옮기지 못하던 문제** (TextField 등 side 라벨 열을 쓰는 field 13종):
  - Label Align 을 End 로 바꾸면 Canvas 는 라벨 글자를 열 끝에 그리는데 Preview 글자는 열 시작에 남았다.
  - **Why**: Label 은 `inline-flex` (Label rule · `Label.css`) 라 글자가 익명 flex item 이 되고, `text-align` 은 그 item 을 옮기지 않는다. side 라벨 블록은 `text-align` 만 선언했다.
  - 수정: side 라벨 블록에 `justify-content: var(--form-label-align, start)` 를 같이 선언한다.
  - 확인: live — CheckboxGroup · RadioGroup · TextField 각각 Side → Label Align End: Preview 글자 오른쪽 끝 = 라벨 상자 오른쪽 끝 (수정 전 CheckboxGroup 106.7 vs 176), Canvas Label `textAlign` end, 라벨 폭 176 = 176, 오류 0 (`apps/builder/scripts/group-label-align-live.mjs` 7/7).
  - 위치: `packages/shared/src/catalog/generated/componentRulesTable.ts` (side 라벨 블록 13곳) · `packages/shared/src/components/styles/generated/*.css`

## [S2 전용 prop 1순위 — RAC 가 동작을 주는 prop] - 2026-10-09

### Added

- **Heading `level` (1–6, 기본 3)** — 사용자 「①부터 진행해」 (조사 문서 `S2_PROP_ALIGNMENT_2026-10.md` 6.1 「나」 묶음):
  - Design 패널 Content 에 Level (슬라이더 + 값 칸). Preview 는 RAC `Heading` 에 넘겨 `<h1>`~`<h6>` 를 그린다. 지정하지 않으면 지금처럼 `h3`.
  - **Why**: S2 1.8.0 Heading 은 `level` 로 문서 구조 (제목 단계) 를 정하는데, 우리 Heading 은 이 prop 을 받지 않아 Dialog · Disclosure · Card 제목이 늘 `h3` 이었다.
  - 글자 크기는 `size` 가 정한다 (S2 와 같음) — level 을 바꿔도 Canvas 상자는 그대로다.
  - 확인: live — Disclosure 제목 Heading 에서 Level 3 표시 → 2 로 바꾸면 Preview `h2`, Canvas 높이 36 = Preview 36 그대로, undo 로 `h3` (`apps/builder/scripts/heading-level-live.mjs` 5/5).
  - 위치: `packages/shared/src/catalog/bindings/Heading.binding.ts` · `packages/shared/src/catalog/document/codeCatalogLibrary.ts` (`textDefinition` 이 Heading 의 `level` 을 받는다) · `packages/shared/src/catalog/runtime/domBinding.tsx`
- **`firstDayOfWeek` — Calendar · RangeCalendar · DatePicker · DateRangePicker**:
  - Design 패널 Locale 에 First Day of Week (Locale default · Sunday ~ Saturday). Preview 는 RAC 에 넘기고, picker 의 값은 RAC 가 picker 안 달력에 준다.
  - Canvas 달력 격자도 같은 요일부터 그린다 — 요일 머리 · 날짜 칸 · 줄 수 (`_weekStart`, 일요일 = 0). 지정하지 않으면 locale 의 첫 요일 (RAC 와 같은 `@internationalized/date` 계산).
  - **Why**: S2 의 네 컴포넌트가 받는 prop 인데 우리는 받지 않았다. Canvas 격자는 요일 시작을 일요일로 고정해, 월요일로 시작하는 locale (de-DE 등) 에서는 이미 Preview 와 달랐다 — 같은 계산으로 함께 맞췄다.
  - 확인: live — Calendar 를 Wednesday 로 바꾸면 Preview 머리 「수 목 금 토 일 월 화」, Canvas `_weekStart` 3, 격자 높이 200 = Preview 표 200. DatePicker 를 Friday 로 바꾸고 Preview 에서 열면 「금」 부터 (`apps/builder/scripts/first-day-of-week-live.mjs` 4/4, 브라우저 locale ko-KR).
  - 위치: `packages/shared/src/catalog/bindings/dateLocaleProps.ts` · `packages/shared/src/catalog/bindings/{Calendar,RangeCalendar,DatePicker,DateRangePicker}.binding.ts` · `packages/shared/src/catalog/runtime/{delegatedDom.tsx,presence.ts,compositionRoot.ts}` · `packages/shared/src/catalog/resolvers/resolveCatalogRuleCanvasBox.ts` (`catalogWeekStart`) · `packages/rendering/src/renderers/skiaPrimitives.ts` (`calendar_month_grid`)
- **DatePicker `hourCycle` · DatePicker · DateRangePicker `placeholderValue`** — DateField 와 같은 계약:
  - Hour Cycle (12 · 24, 시간 granularity 에서만 보임) 과 Placeholder Value (ISO 날짜 — 빈 picker 의 달력이 열리는 달) 를 Design 패널에서 고친다. DateRangePicker 는 Hour Cycle 이 이미 있었다.
  - Canvas 의 DateInput 세그먼트는 이미 picker 의 `hourCycle` 을 읽었다 — DOM 만 넘기지 않았다.

- **SearchField `type`** (search · text · url · tel · email · password, 기본 search):
  - RAC SearchField 가 input 에 넘긴다. password 면 값이 가려진다 — Preview 의 input 점, Canvas 는 Input 글자를 같은 수의 `•` 로 그린다.
- **Row `isDisabled`** (Table 의 행):
  - RAC 의 비활성 행 (`data-disabled`). 모양은 Row rule 의 disabled opacity 0.38 — Canvas 는 rule 을, DOM 은 `Table.css` 를 읽는다.
  - `Table.css` 의 비활성 행은 opacity 0.38 에 글자색 38% 를 더해 글자가 두 번 흐려졌다 (약 14%). 글자색 줄을 빼 다른 컴포넌트의 disabled 와 같게 했다.
- 확인: live — SearchField Input Type Email → Preview input `type="email"`, Value 「secret」 + Password → Preview password input · Canvas 「••••••」, Table 행 Disabled → Preview `data-disabled` · opacity 0.38 = Canvas 0.38 (`apps/builder/scripts/searchfield-type-row-disabled-live.mjs` 5/5).
- 위치: `packages/shared/src/catalog/bindings/{SearchField,Row}.binding.ts` · `packages/shared/src/catalog/generated/componentRulesTable.ts` (Row `structure.states.disabled`) · `packages/shared/src/catalog/runtime/{delegatedDom.tsx,presence.ts}` · `packages/shared/src/components/styles/Table.css`
- **이번에 넣지 않은 것 — Calendar `selectionAlignment`**: 여러 달 표시에서만 의미가 있어, ADR-256 Phase 9 (`visibleDuration` · `CalendarMonth` 반복) 와 함께 다룬다. `firstDayOfWeek` 는 Phase 9 설계의 계약 (picker 소유 · 미설정 = locale) 과 같게 넣었고, picker 안 Calendar 를 고를 때 그 값을 picker 소유로 안내하는 일은 Phase 9 에 남는다.

### Fixed

- **날짜만 적은 Placeholder Value + 시간 granularity 에서 Preview 가 통째로 비던 문제** (DateField · DatePicker · DateRangePicker):
  - **Why**: RAC 는 시간 granularity 에 날짜만 있는 값을 받으면 `Invalid granularity minute for value 2030-03-15` 를 던진다. 문서는 Placeholder Value 를 `2030-03-15` 로 저장하고 DOM 은 그대로 `CalendarDate` 로 넘겼다.
  - 수정: 시간 granularity 면 그 날 자정 (`toCalendarDateTime`) 으로 넘긴다.
  - 확인: live — DatePicker Granularity Minute · Hour Cycle 24 → Canvas = Preview 세그먼트 「연도.월.일.––:––」, 12 → 둘 다 「오전」, Placeholder Value 2030-03-15 → 열린 달력 「2030년 3월」, 오류 0 (`apps/builder/scripts/picker-time-props-live.mjs` 4/4). 수정 전에는 같은 단계에서 Preview 가 비었다.
  - 위치: `packages/shared/src/catalog/bindings/{DatePicker,DateRangePicker}.binding.ts` · `packages/shared/src/catalog/runtime/delegatedDom.tsx` (`placeholderDate`)

- **TextField · SearchField · NumberField 의 Value 편집이 열린 Preview 에 닿지 않던 문제**:
  - Design 패널에서 Value 를 바꾸면 Canvas 는 바로 바뀌는데 Preview input 은 다시 열 때까지 그대로였다.
  - **Why**: DOM 은 Value 를 RAC 의 `defaultValue` (실행 상태의 초기값) 로 넘긴다. 이미 그려진 input 은 초기값이 바뀌어도 따라가지 않는다.
  - 수정: field 요소의 key 에 그 값을 넣어 문서가 값을 바꾸면 다시 시작한다 — Slider 가 이미 쓰는 방식 (`nodeTreeField`).
  - 확인: live — SearchField Value 「secret」 이 열린 Preview input 에 바로 들어간다 (수정 전 빈 값).
  - 위치: `packages/shared/src/catalog/runtime/delegatedDom.tsx`

## [size 이름 S2 정렬 — XS · S · M · L · XL] - 2026-10-09

### Breaking Changes

- **size 값 이름이 S2 표기로 바뀌었다 — library contract 36**:
  - 바뀐 이름: `xs` · `sm` · `md` · `lg` · `xl` → `XS` · `S` · `M` · `L` · `XL`. 글자 type (Heading · Paragraph · Text) 의 `2xl` · `3xl` 은 S2 Heading 처럼 `XXL` · `XXXL` 이다.
  - contract 35 로 저장한 프로젝트는 열리지 않는다 (지난 contract 변경과 같은 방침 — 거부하고 다시 매핑하지 않는다).
  - 사용자 지시: 「size 는 S2기준에 XS추가해서 XS/S/M/L/XL 로 맞춰 진행해」 · 범위 질문에 「표기만 변경」.

### Changed

- **표기만 바꿨다** — 각 type 이 받는 size 범위 (5단계 30 · S~~XL 25 · S~~L 34 · M 하나 9) 와 시각 값은 그대로다:
  - **Why**: D2 정본이 S2 1.8.0 이다 (2026-10-09 결정). S2 의 size 값은 `S` · `M` · `L` · `XL` (일부 `XS`) 인데 우리는 Tailwind 식 소문자 (`sm` · `md`) 를 썼고, Breadcrumbs 만 이미 `S` · `M` · `L` 이라 한 프로젝트 안에서도 두 표기가 섞여 있었다.
  - 바꾼 곳: rule 의 size 키 · `defaultSize`, binding 기본값, 원본 library 의 size, size 전파 단계표 (`CATALOG_SIZE_STEP`), DOM `data-size` · `data-tag-size` · `data-checkbox-size` · `data-radio-size` 와 생성 CSS 선택자, Canvas · shared 컴포넌트의 size 표, Design 패널의 Size 버튼 값.
  - 토큰 이름 (`--spacing-sm` · `--radius-md` · `--text-xl` …) 은 size 가 아니므로 그대로다. DateRangePicker Group 의 모서리는 size 이름을 토큰 이름으로 쓰던 것을 rule delegation 변수 (`--drp-group-radius`) 를 읽도록 바꿨다.
  - 확인: live — 새 Button 의 size `M`, Design Size 필드 `XS · S · M · L · XL`, L 을 고르면 Canvas · Preview 모두 42px · `data-size="L"`, TextField `XL` · Text `XXL` (24px) 도 Canvas 높이 = Preview 높이 (`apps/builder/scripts/size-s2-names-live.mjs` 6/6).
  - 위치: `packages/shared/src/catalog/generated/componentRulesTable.ts` · `packages/shared/src/catalog/bindings/*.binding.ts` · `packages/shared/src/catalog/document/{generated/reusableOriginLibrary,sizePropagation,manualBoxRules,types}.ts` · `packages/shared/src/components/styles/**` · `packages/rendering/src/{primitives,renderers}/**`

## [Checkbox · Switch emphasized — Preview 가 variant 를 읽는다] - 2026-10-09

### Fixed

- **강조 (emphasized) Checkbox · Switch 가 Preview 에서 중립색이던 문제** (사용자 「Checkbox · Switch variant ↔ isEmphasized 진행해」):
  - Variant 를 Emphasized 로 두고 선택하면 Canvas 는 accent 로 칠하는데 Preview 는 검정 (중립) 이었다.
  - **Why**: 둘은 `variant` (default · emphasized) 를 받고 Canvas 는 rule 의 emphasized variant 로 칠하지만, DOM 은 받지 않는 `isEmphasized` 로 `data-emphasized` (sheet 의 accent 선택색) 를 정했다.
  - 수정: DOM 의 `data-emphasized` = `variant === "emphasized"`.
  - 확인: live — Checkbox · Switch 선택 + emphasized 의 Canvas indicator 칠 = Preview indicator = accent, default 는 양쪽 모두 중립 (`apps/builder/scripts/toggle-emphasized-live.mjs` 5/5).
  - 위치: `packages/shared/src/catalog/runtime/delegatedDom.tsx` (`checkbox` · `switch`)

## [Nav 이름 — aria-label prop 을 읽는다] - 2026-10-09

### Fixed

- **Nav 의 `aria-label` 이 Preview `<nav>` 에 닿지 않던 문제** (사용자 「Nav aria-label vs label 진행해」):
  - Nav 는 `aria-label` 을 받지만 (HTML · RSP 에 `label` 은 없다) DOM 은 아무도 쓰지 않는 `label` 을 읽어, AI · 가져오기가 넣은 `aria-label` 이 무시되고 늘 "Navigation" 이었다.
  - **Why**: binding accepts (`aria-label`) 와 renderer 의 읽는 키 (`label`) 가 달랐다.
  - 수정: `<nav>` 이름 = `aria-label` prop, 없으면 "Navigation". Properties 의 Attributes 절 (metadata `ariaLabel`, 전 요소 공통) 은 종전대로 둘보다 이긴다.
  - 확인: live — 기본 `Navigation`, `aria-label` "Main" → Preview `<nav aria-label="Main">` (`apps/builder/scripts/nav-aria-label-live.mjs` 3/3).
  - 위치: `packages/shared/src/catalog/runtime/delegatedDom.tsx` (`nav`)

## [Card href — S2 링크 Card (RAC Link)] - 2026-10-09

### Added

- **Card 의 Link · Target** (사용자 「Card href 진행해」):
  - 놓은 Card 의 Properties 에 Link (`href`) · Target 이 생겼다. 값이 있으면 Preview · publish 의 Card 가 RAC `Link` (`a.react-aria-Card`) 로 그려진다 — S2 standalone Card 와 같다 (`@react-spectrum/s2/src/Card.tsx`). 비우면 다시 `div`.
  - 링크 Card 도 글자 모양은 그대로다 (S2 `textDecoration: 'none'` — Card rule `rootSelectors["&"]`). Canvas 는 링크 칠이 없어 바뀌지 않는다.
  - **Why**: Card type 은 `href` · `target` 을 받았지만 원본의 편집 계약에 없어 놓은 Card 에서 고칠 수 없었고, DOM 도 그 값을 넘기지 않았다. 옛 `<a>` 경로는 `role="link"` · `tabIndex` 를 손으로 붙였다 (RAC Link 로 교체).
  - 확인: 실제 Builder Compare Mode 에서 href · target 설정 → `a.react-aria-Card` · 밑줄 없음 · 색 같음 · Canvas 상자 = Preview 상자, 비우면 `div` (`apps/builder/scripts/card-href-live.mjs` 6/6).
  - S2 와 같이 링크 Card 안의 버튼 등 상호작용 요소는 막지 않는다 (S2 문서 주의 사항 — "the card must not contain interactive elements").
  - 위치: `packages/shared/src/components/Card.tsx` · `packages/shared/src/catalog/runtime/delegatedDom.tsx` · `packages/shared/src/catalog/generated/componentRulesTable.ts` · `apps/builder/src/builder/components/reusablePropsSchemas.ts`

## [AvatarGroup 라벨 노드 — S2 label = Text 노드 · contract 35] - 2026-10-09

### Breaking Changes

- **library contract 34 → 35** — AvatarGroup type 의 `label` prop 이 사라지고 원본의 Text 자식 노드가 된다. 이전 contract 의 문서는 열지 않는다 (종전 규약).

### Changed

- **AvatarGroup 의 라벨이 보인다** (사용자 「AvatarGroup label 노드 전환 진행해」):
  - 원본 `component-avatargroup` = `AvatarGroup > Avatar × 3 + Text {label}` (`@react-spectrum/s2/src/AvatarGroup.tsx` — 아바타 뒤 `span`, `marginStart: 8`). 원본의 `label` (Properties 의 Label) 이 그 Text 의 글자다.
  - 라벨 글자 크기는 그룹 size 를 따른다: xs 14 · sm 16 · md 18 · lg 20 · xl 24px (S2 `ui` · `ui-lg` · `ui-xl` · `ui-3xl` 22 → Text xl 20, 48 은 S2 에 없어 2xl).
  - Preview 의 그룹은 `role="group"` 이고 라벨 글자가 그 이름이다 (S2 `useLabel`).
  - **Why**: `label` 이 type prop 이라 Canvas · Preview 어디에도 그려지지 않았다.
  - 확인: 실제 Builder Compare Mode 에서 size 5단계의 Canvas 상자 (그룹 · 아바타 3 · 라벨) = Preview 상자, 라벨 글자 크기 같음, `label` 편집이 양쪽 · 그룹 이름에 반영 (`apps/builder/scripts/avatar-group-label-live.mjs` 7/7).
  - 위치: `packages/shared/src/catalog/{document/generated/reusableOriginLibrary.ts,bindings/AvatarGroup.binding.ts,document/sizePropagation.ts,runtime/delegatedDom.tsx}` · `apps/builder/src/builder/components/reusablePropsSchemas.ts`

### Fixed

- **AvatarGroup 아바타 겹침 = S2** (사용자 「첫 아바타 margin 이랑 겹침 폭도 S2 에 맞춰」):
  - 첫 아바타가 그룹 왼쪽 끝에 붙고, 다음 아바타는 아바타 크기의 1/4 만큼 겹친다 (xs 6 · sm 7 · md 8 · lg 10 · xl 12px). 나중에 넣은 아바타도 같다.
  - **Why**: template 의 아바타마다 `marginLeft: -8px` 이 박혀 있어 첫 아바타가 그룹 밖으로 8px 나갔고, 겹침이 size 와 무관하게 8px 이었다 (S2 `marginStart: calc(var(--size) / -4)`, `:first-child: 0`).
  - 수정: AvatarGroup rule 의 size 블록이 아바타에 `-size/4` 를, 그룹에 같은 시작 padding 을 준다 — 첫 아바타의 margin 0 과 같은 상자 (Canvas part rule 은 형제 위치를 보지 않는다).
  - 확인: live size 5단계 — 첫 아바타 x 0 · 겹침 1/4 · Canvas 상자 = Preview 상자.
  - 위치: `packages/shared/src/catalog/generated/componentRulesTable.ts` (AvatarGroup `composition.containerVariants.size`) · `document/rulePartRules.ts` (`TYPE_CONTAINER_VARIANT_AXES.AvatarGroup`)

## [ToggleButtonGroup staticColor 의 Canvas 반영 — 자식 ToggleButton 파생 값] - 2026-10-09

### Fixed

- **ToggleButtonGroup 의 `staticColor` 가 Canvas 에 보이지 않던 문제** (사용자 「canvas 에 반영되게 수정해」):
  - 그룹에 White · Black 을 주면 Preview 의 버튼은 흑백 스킴으로 바뀌는데 Canvas 의 버튼은 기본 칠 그대로였다.
  - **Why**: S2 ActionButtonGroup 의 `staticColor` 는 그룹의 칠이 아니라 자식 버튼에게 가는 값이다. DOM 은 `ToggleButtonGroupStaticColorContext` 로 자식의 `data-static-color` 를 정했지만, Canvas 는 버튼 자신의 `staticColor` 만 읽었다.
  - 수정: 그룹 안 ToggleButton 이 그룹 값을 파생 값으로 받는다 (버튼 자신의 값이 `auto` 가 아니면 버튼 값 — DOM 과 같은 우선순위). 그룹을 편집하면 그 버튼들이 다시 계산된다.
  - 확인: 실제 Builder Compare Mode 에서 White · Black 의 Canvas 버튼 칠 · 테두리 · 글자색 = Preview 계산값, Auto 로 되돌리면 원래 칠 (`apps/builder/scripts/toggle-group-static-color-live.mjs` 4/4).
  - 위치: `packages/shared/src/catalog/runtime/presence.ts` (`ownDerivedProps` · `derivedDependents`)

## [Calendar 표시 기간·월/연도 picker 계획 — ADR-256 Phase 9] - 2026-10-09

### Documentation

- 사용자 지시로 Calendar · RangeCalendar 의 Month and year pickers 와 `visibleDuration` 수량 + Day · Week · Month Select 조합을 [Phase 9 계획](adr/design/256-rac-composition-level-breakdown.md#3-1-phase-9-추가-계약-2026-10-09-사용자-지시)에 포함했다. 월 전용 `maxVisibleMonths` 계약 전환, Canvas · Preview 정합, pagination 및 저장 후 재열기를 완료 기준에 명시했다. 제품 구현·Gate 통과·ADR 상태 승격은 포함하지 않는다.

- Codex Round 22 m1 을 반영해 전용 `calendar-duration` 타입·Inspector kind·accepts/default 생성·문서/graph/library 검증을 선행 작업으로 추가했다. 단위 하나·양의 안전 정수 검증과 원자적 편집, undo/redo·저장/로드 보존을 완료 기준에 포함했다. 설계 누락 수리이며 제품 구현은 별도다.

- Round 24 리뷰를 반영해 Phase 9 설계를 보완했다: DatePicker · DateRangePicker 의 `maxVisibleMonths` 삭제와 안 Calendar 의 prop 소유 (`firstDayOfWeek` · `pageBehavior` = picker, `visibleDuration` · `weeksInMonth` = Calendar) · 여러 달 = `CalendarMonth` 한 달 블록 반복 (레퍼런스 starter 구조) · 레퍼런스 Display options 의 `firstDayOfWeek` · `weeksInMonth` 추가 · Preview 실행 중 보기 전환은 범위 밖 (Properties 작성만). 설계 수리이며 제품 구현은 별도다.

## [IllustratedMessage S2 노드 트리 — 그림 · 제목 · 설명 노드 · orientation · contract 34] - 2026-10-09

### Breaking Changes

- **library contract 33 → 34** — IllustratedMessage 의 `heading` · `description` prop 이 사라지고 원본의 자식 노드가 된다. 이전 contract 의 문서는 열지 않는다 (종전 규약).

### Changed

- **IllustratedMessage = S2 구조** (사용자 「제목 · 설명 노드 전환」 → 「레퍼런스에 맞게」 → 「(a) 로 진행해, orientation 도 같이 넣어」):
  - 원본 `component-illustratedmessage` = `IllustratedMessage > Illustration + Heading {title} + Description {description}` (`@react-spectrum/s2/src/IllustratedMessage.tsx` 의 `Illustration + Heading + Content`). palette 는 이 원본을 넣는다.
  - 회색 placeholder 상자 · ○ · padding 을 지웠다 — S2 에 없다. 그림은 새 `Illustration` type (Icon 계열 svg, 크기 48 / 96 / 160 — S2 `illustrationStyles`).
  - size 는 S2 context 대로 자식에 간다: 그림 96 · 96 · 160, 제목 16 · 20 · 24px (S2 16 · 20 · 22), 설명 12 · 14 · 14px (`CATALOG_SIZE_STEP`).
  - **`orientation`** (S2 prop) 추가 — vertical: 가운데 열 · 그림 아래 12 (L 8) · 제목 아래 4 · 최대 폭 380. horizontal: grid 2열, 그림이 두 줄을 차지하고 간격 12 · 최대 폭 528. Styles 의 Direction 토글이 이 값을 쓴다.
  - **Why**: 제목 · 설명이 prop 글자라 Heading · Description 원본을 바꿔도 따라오지 않았고, 레퍼런스에 없는 placeholder 상자를 그렸다.
  - Preview 는 생성 CSS (`IllustratedMessage.css` — 이제 로드) 가 배치하고, Canvas 는 같은 rule 의 `orientation` 블록을 part rule 로 읽는다 (`rulePartRules.ts` — type 별 container variant 축 · `grid-row` · `grid-column` · `grid-template-*` · `row-gap` · `column-gap` 해석 추가).
  - 위치: `packages/shared/src/catalog/{bindings/IllustratedMessage.binding.ts,bindings/Illustration.binding.ts,generated/componentRulesTable.ts,document/generated/reusableOriginLibrary.ts,document/rulePartRules.ts,document/sizePropagation.ts}`

### Fixed

- **엔진: 높이 미정 grid 에서 여러 행을 걸친 아이템이 행마다 통째로 기여하던 것** — `1fr 1fr` 두 행을 걸친 96 그림이 컨테이너를 196 으로 만들었다 (Chrome 96 = 46 + 4 + 46).
  - **Why**: 행 기여가 시작 행 하나에만 들어가 fr 크기가 아이템 전체였다. §12.7.1 (fr 을 지나면 `(기여 − 고정 트랙 − gap) ÷ Σfr`) · §12.5.1 (fr 이 없으면 모자란 만큼 균등 분배 — `auto auto` 50 / 42) 로 고쳤다.
  - 위치: `packages/engine/src/tree.rs` `grow_tracks_for_spanning_items`

### Tests

- `illustratedMessageNodeTree.test.tsx` 8 (구현 전 RED 6 · orientation 축 원복 시 RED 6) · Rust `grid_spanning_item_rows_indefinite_height` (RED 196) · `previewCanvasBox.test.tsx` Illustration DOM 상자 높이
- G3: 옛 palette 행 (단독 type) 을 원본 instance 로 잰다 + 새 부품 3종 `decided` 승인 (`illustrated-message-s2-parts`)
- live `apps/builder/scripts/illustrated-message-live.mjs` 8/8 — vertical · horizontal × sm · md · lg 에서 Canvas 상자 = Preview 상자 (루트 + 부품 3, 차이 0) · 원본 title · description 편집이 두 화면에 반영 · 오류 0
- engine 445 · shared 1589 · builder 5008 · rendering 1337 · publish 11 · type-check · G3 79 · parity 811

## [IllustratedMessage 가운데 정렬 — Preview 를 Canvas · S2 와 같게] - 2026-10-09

### Fixed

- **Preview 의 IllustratedMessage 가 그림 · 제목 · 설명을 왼쪽에 붙이던 것** — Canvas 와 S2 는 가운데 정렬이다.
  - **Why**: catalog rule `structure.containerStyles.alignItems` 가 `flex-start` 였고, Preview 만 그 값을 읽었다. Canvas primitive 는 이 값을 받지 않아 기본값 center 로 그렸다.
  - 수정: rule 을 `center` 로 바꾸고 생성 CSS 를 다시 만들었다 (`generate:css`).
  - 위치: `packages/shared/src/catalog/generated/componentRulesTable.ts` · `packages/shared/src/components/styles/generated/IllustratedMessage.css`
- 회귀: `previewCanvasBox.test.tsx` +1 (구현 전 RED) · live `preview-canvas-box-live.mjs` 9/9 (Preview 자식 3개의 가운데 오프셋 0 · 상자 7종 Canvas = Preview · 오류 0) · builder 5001 · shared 1588 · rendering 1337 · G3 79 · parity 811

## [Canvas ↔ Preview 상자 크기 — StatusLight 폭 · IllustratedMessage 높이] - 2026-10-09

### Fixed

- **StatusLight 의 Preview 상자가 부모 폭 전체를 차지하던 것** (Canvas 75 / Preview 1920) — Preview 컴포넌트가 `display: flex` 를 박아 넣었다. rule 의 `inline-flex` 로 맞췄다 (Canvas 와 같이 점 + 글자 폭).
- **IllustratedMessage 가 Canvas 에서 padding 높이만 갖던 것** (md 48 / Preview 240) — 2026-10-05 옛 TS 레이아웃을 지우면서 그림 · 제목 · 설명 열의 높이 측정이 catalog 레이아웃 (`styleOf`) 으로 옮겨지지 않았다. Preview 컴포넌트와 같은 metric (`resolveIllustratedMessageMetric`) 의 content 높이를 엔진에 준다.
- 확인 (사용자 「의심된 Preview class · data-size 누락 먼저 확인하고 수정」): ButtonGroup · AvatarGroup · CardView · Avatar · ProgressCircle 등의 Preview 루트에 `react-aria-<Type>` class · `data-size` 가 없지만, 그 생성 CSS 는 Preview 문서에 실려 있지 않고 (stylesheet 규칙 0) renderer 가 상자를 inline 으로 준다 — class 를 붙여도 계산된 스타일 변화 0, 상자 크기 Canvas = Preview. 결함 아님.
- 위치: `packages/shared/src/components/StatusLight.tsx` · `packages/shared/src/catalog/runtime/compositionRoot.ts`
- 회귀: `previewCanvasBox.test.tsx` 4 (구현 전 RED 4) · live `apps/builder/scripts/preview-canvas-box-live.mjs` 8/8 (7종 Canvas 상자 = Preview 상자 ±1px · class 추가 시 변화 0 · 오류 0) · builder 5000 · shared 1588 · rendering 1337 · G3 79 · parity 811

## [binding 주석 정리 — 지워진 renderer · factory · spec 인용 제거] - 2026-10-09

### Changed

- 속성 감사 (사용자 「5번 주석 정리」): binding 88개의 주석이 지워진 renderer (`renderTableView` 등) · factory (`LayoutComponents.ts` 등) · spec 파일 · 옛 파이프라인 (`buildSpecNodeData` · `append*RowProjection` · `KNOWN_HTML` …) 을 지금 쓰이는 것처럼 인용하던 343곳을 지금의 소비자 (`delegatedDom.tsx` · `domBinding.tsx` `ruleDom` · catalog rule · `presence.ts` · origin template 노드) 로 고치거나 지웠다. 동작 변경 없음 (주석 아닌 줄 0).
- 재발 게이트: `bindings/__tests__/staleCommentSymbols.static.test.ts` — binding 주석이 그 이름들을 다시 인용하면 실패한다 (정리 전 RED 88 → 143 GREEN).

## [노드가 대신하거나 아무도 읽지 않던 prop 삭제 · contract 33] - 2026-10-09

### Removed

- 속성 감사 (사용자 「2번 삭제」) — Design 패널에 있었지만 지금은 노드가 그 일을 하거나 Canvas · Preview 어느 쪽도 읽지 않던 prop 을 지웠다.
  - 노드가 대신: Breadcrumbs `items` · Tabs `Show Indicator` (Tab 의 SelectionIndicator 노드) · Pagination `Total Pages` · `Current Page` (Button 노드) · Tag `Allows Removing` (TagGroup 의 것 — `Button[slot=remove]`) · DatePicker · DateRangePicker `Show Calendar Icon` (Button 노드) · InlineAlert `Heading` · `Description` (Heading · Description 노드) · Card `Footer` (CardFooter) · Toast `Default Title` · `Default Description` · FileUpload 의 파일 옵션 (자식 FileTrigger 의 것) · Input 의 값 · 상태 (field 가 준다) · CardView `Gap` (Styles 의 Gap).
  - 아무도 읽지 않음: Tab `Title` · Menu `Disabled` · SelectValue · DatePicker · DateRangePicker `Placeholder` (RAC · S2 에 없다) · Card `Orientation` · `Selectable` · Toast `Default Timeout` · ColorPicker `Label` · `Disabled` · ColorSwatchPicker `Color Space` · `Columns` · ColorSlider `Label` · DateInput `Variant` · CalendarHeader `Locale` · `Calendar System` · `Month/Year` (Calendar 의 값) · CalendarGrid `Locale` · `Calendar System` · 선택지가 하나뿐인 `Variant` / `Size` (Icon · IllustratedMessage · Modal · SliderTrack · ProgressBarValue).
  - owner 가 값을 주는 부품 prop 은 지우지 않고 패널에서 숨겼다 (`editorHidden` — 크기 전파 · 파생 값 경로는 그대로): ProgressBar · Meter 의 Fill · Track `Variant` · `Size`, CalendarHeader · CalendarGrid `Size`, CalendarGrid 의 날짜 배치 값, TagList · SliderTrack · DateInput `Size`.
  - 같이 지운 읽기 코드: Toast `data-timeout` · Form 의 `autoFocus` · `restoreFocus` (2026-09-10 에 accepts 에서 지운 값) · 피커의 `catalogPickerOfButton`.
  - library contract 32 → 33 — 이전 contract 의 문서는 열지 않는다 (종전 규약).
- 회귀: `deadSurfaceRemoval.test.ts` (원복 RED 62) · 고정해 둔 테스트 9개 갱신 · live `apps/builder/scripts/property-removal-live.mjs` 7/7 (Tabs · Pagination · DatePicker · ProgressBar Fill · CalendarHeader · FileUpload 선택 → 지운 항목 없음 + 남은 항목 보임 · Preview 의 Tab 막대 1 · 페이지 버튼 5 · 달력 버튼 1 · 달 제목) · builder 4996 · shared 1445 · rendering 1337 · publish 11 · G3 79 · parity 811

## [Design 패널 값이 Preview 에 닿지 않던 prop 연결 — ButtonGroup Disabled · FileTrigger 형식 · GridList 선택 방식 · InlineAlert role] - 2026-10-09

### Fixed

- 속성 감사 (사용자 「다른 프로퍼티도 레퍼런스와 맞지 않거나 레거시 옵션들이 남아 있는지 검증」 → 「1번 결함 수리」) 에서 찾은, 레퍼런스에 있고 패널에서 바꿀 수 있지만 Preview 에 전달되지 않던 값.
  - **ButtonGroup 의 Disabled 가 안의 Button 을 전부 끈다** (S2 「all the Buttons are disabled」) — Canvas 도 흐리게 그린다. 종전에는 아무 곳도 읽지 않았다. Button 은 가장 가까운 ButtonGroup 의 값을 파생 값으로 받고 (`presence.ts` `catalogButtonGroupOf`), Canvas 흐림은 파생 값이 켜는 조건 rule 을 읽는다 (`libraryVisual.ts` `catalogDerivedConditionalVisual` — resolver 는 작성된 props 로만 조건 rule 을 평가한다).
  - **FileTrigger 의 Accepted File Types** 가 file input 의 `accept` 가 된다 (쉼표로 나눈 목록 → RAC `acceptedFileTypes`). 종전에는 형식 제한이 적용되지 않았다.
  - **GridList 의 Selection Style · Disallow Empty Selection** 이 RAC 에 닿는다 (종전: 늘 toggle).
  - **FileUpload 의 Retry Delays · ColorField 의 Wheel Disabled** 가 업로드 · RAC ColorField 에 닿는다.
  - **InlineAlert 가 `role="alert"` · `aria-live="polite"`** 를 갖는다 (S2 InlineAlert 와 같다) — binding 의 `staticAttrs` 를 아무도 읽지 않았다 (`domBinding.tsx` ruleDom).
  - 위치: `packages/shared/src/catalog/runtime/{delegatedDom.tsx,domBinding.tsx,presence.ts,libraryVisual.ts}` · `apps/builder/src/builder/catalogRuntime/canvasBinding.ts`
- 회귀: `propertyWiring.test.tsx` 6 (구현 전 RED 7 · Canvas 흐림 원복 RED) · `adr254ContainerParts` 의 InlineAlert DOM 기대값에 role 추가 · live `apps/builder/scripts/property-wiring-live.mjs` 5/5 (ButtonGroup Design 패널 Disabled → Canvas · Preview 의 Button 전부 disabled · FileTrigger accept · GridList 두 번 누름 checkbox 2 / highlight 1 · InlineAlert role) · builder 4997 · shared 1383 · G3 79 · parity 811

## [컬렉션 항목 = slot 과 data binding 만 — 옛 items 목록 삭제 · contract 32] - 2026-10-09

### Removed

- **TagGroup · ListBox · GridList · Menu · Select · ComboBox 의 Design 패널에서 옛 항목 목록 ("Add Tag" · "Add Option" · "Add ListBoxItem" … 과 Total 개수) 을 지웠다** — 항목은 Slot 의 "+" (항목 노드 — RAC 정적 collection) 또는 Data binding (collection 행 + 항목 노드 template — RAC 동적 collection) 으로만 넣는다 (사용자 「slot 방식과 data binding 방식만 사용하는것이 레퍼런스에 맞는 방법이지 않나」 → 「진행해」).
  - **Why**: react-aria.adobe.com/collections 는 정적 (JSX 자식) · 동적 (`items` + 그리는 함수) 두 가지만 정의한다. 옛 목록은 `props.items` 인라인 배열이었고, ADR-256 노드 트리 전환 뒤 Canvas · Preview 어느 쪽도 읽지 않아 눌러도 화면이 바뀌지 않았다.
  - library contract 31 → 32 — 이전 contract 의 문서는 열지 않는다 (종전 규약).
  - Chart 의 Sample Rows · Series · Reference Lines 편집기는 차트 데이터라 그대로 둔다.
  - 위치: `packages/shared/src/catalog/bindings/{TagGroup,ListBox,GridList,Menu,Select,ComboBox}.binding.ts` · `packages/shared/src/catalog/document/types.ts`
- 회귀: `deadSurfaceRemoval.test.ts` (원복 RED 7) · `collectionBindings.test.ts` · `phase4ePropertySections.test.tsx` · live `apps/builder/scripts/collection-items-source-live.mjs` 8/8 (6종 선택 → 항목 목록 없음 · "+" 로 항목 노드 하나씩 Canvas · Preview · 노드 자리에 Data · Chart Sample Rows 유지) · G3 79 · parity 811

## [Tabs · TagGroup · Table 자신의 "+" 로 항목 추가 · Preview maxRows 재측정] - 2026-10-09

### Fixed

- **Table · TableView 를 선택해도 "+" (Insert Column · Insert Row) 가 나온다** — 열은 TableHeader 에, 행은 TableBody 에 추가된다 (사용자 「Table 도 같은 방식으로 맞춰」). 종전에는 TableHeader · TableBody 를 선택해야만 있었다.
- **Tabs · TagGroup 을 선택해도 Design 패널 Slot 섹션에 "+" (Insert Tab · Insert Tag) 가 나온다** — 누르면 TabList · TagList 에 추가된다 (Tab 은 TabPanel 과 함께). 종전에는 안쪽 TabList · TagList 를 선택해야만 "+" 가 있었다 (CheckboxGroup · RadioGroup · Select · ComboBox 는 컴포넌트에서 바로 추가).
  - **Why**: 목록 노드가 따로 있는 컬렉션은 "+" 를 목록에만 붙였다. 컴포넌트가 안쪽 목록으로 전달하는 표 (`PICKER_LIST`) 에 Tabs → TabList · TagGroup → TagList 를 더했다. 목록 자신의 "+" 는 그대로.
  - 위치: `apps/builder/src/builder/catalogRuntime/itemInsert.ts`
- **열린 Preview 에서 Tag 를 추가하면 maxRows 를 다시 센다** (종전: 한 줄에 다 들어가도 새 Tag 가 "Show all (5)" 뒤에 숨었다 — Canvas 는 5개).
  - **Why**: `useTagMaxRows` 가 처음 · maxRows 변경 · 크기 변경 때만 측정했다. 측정 거울의 chip (글자) 이 바뀌면 다시 잰다 (`itemsKey`) — 추가 · 삭제 · 글자 변경.
  - 위치: `packages/shared/src/components/TagGroup.tsx` · `packages/shared/src/catalog/runtime/delegatedDom.tsx`
- 회귀: `ownerItemInsert.test.ts` 4 · `adr256TagGroupAuthoredTree.test.tsx` +1 (원복 RED 3) · live `apps/builder/scripts/owner-item-insert-live.mjs` 4/4 (Tabs · TagGroup 선택 → "+" → Canvas · Preview 하나씩 늘고 Show all 없음 · Table 선택 → Insert Column · Insert Row → 열 · 행 하나씩) · G3 63 PASS + 1 UNVERIFIED · parity 811

## [TagGroup Max Rows — Canvas 도 접고 Show all (N) 을 그린다] - 2026-10-09

### Fixed

- **TagGroup 의 Max Rows 가 Canvas 에서도 동작한다** — 지정한 행을 넘는 Tag 는 그리지 않고 "Show all (N)" 상자를 accent 글자로 그린다 (종전: Preview 만 접고 Canvas 는 Tag 를 전부 그려, 폭 140 · Max Rows 1 에서 높이 156 ↔ Preview 88).
  - **Why**: 옛 TS 레이아웃 (`fullTreeLayout` Step 4.5b, 2026-09-21) 이 하던 Canvas 접힘이 2026-10-05 옛 파이프라인 삭제 때 catalog runtime 으로 옮겨지지 않았다. 이제 `compositionRoot` 가 배치 뒤 Tag 를 전부 펼친 배치에서 행을 세고 (Preview 의 `useTagMaxRows` 와 같은 규칙), 넘친 Tag 를 흐름에서 빼고 Show all 상자 (Tag 의 padding · 글자 크기) 를 TagList 끝에 세워 다시 배치한다. Canvas 는 그 상자를 칠하고, 접힘이 바뀌면 다시 바인딩한다. 폭 · Max Rows 변경과 드래그 미리보기에도 따른다. 접힌 Tag 는 Canvas 에 없으니 Layers 로 고른다.
  - 위치: `packages/shared/src/catalog/runtime/compositionRoot.ts` (`settleTagRows` · `tagShowAllInputs` · `tagRowCollapsed`) · `apps/builder/src/builder/catalogRuntime/canvasBinding.ts`
- 회귀: `tagGroupMaxRowsCanvas.test.ts` 4 (원복 RED 3) · live `apps/builder/scripts/tag-group-maxrows-live.mjs` 7/7 (폭 140 · Max Rows 1 · 2 · 3 · 0 에서 Canvas = Preview — 보이는 Tag 수 · Show all · 높이 88 / 122 / 156 · Design 패널 Max Rows · 새로고침) · G3 63 PASS + 1 UNVERIFIED · parity 811

## [Tag · Tab 글자와 Tag X 가 Preview 의 선택을 따른다] - 2026-10-09

### Fixed

- **Preview 에서 Tag 를 눌러 선택 · 해제하면 글자와 지우기 X 도 chip 색을 따른다** (종전: Behavior 의 Selected 로 선택해 둔 Tag 를 Preview 에서 해제해도 글자가 흰색으로 남고, Preview 에서 누른 Tag 는 accent 배경에 어두운 글자 — 두 선택이 다르게 보였다). Tab 글자도 같다.
  - **Why**: Canvas 가 칠하는 item 글자색 (`derivedOf` — 작성된 선택 기준) 이 DOM 에도 inline 으로 나가, 시트의 `color: inherit` 를 덮었다. Preview 의 선택은 RAC 실행 상태라 그 색은 작성 시점에 고정됐다. Disclosure 제목 · Select 값처럼 작성한 색이 없으면 DOM 은 inline 색을 싣지 않는다. 지우기 버튼은 `.button-base` 가 `--button-text` 로 칠하므로 그 값을 `currentColor` (Tag 색) 로 둔다.
  - 위치: `packages/shared/src/catalog/runtime/domBinding.tsx` · `packages/shared/src/components/styles/TagGroup.css`
- 회귀: `tagGroupSelection.test.tsx` 5 (원복 RED 2) · live `apps/builder/scripts/tag-group-selection-live.mjs` 6/6 (작성 선택 Tag 해제 · 다른 Tag 선택 → 각 글자 · X 가 chip 색) · Tabs Preview 클릭 확인 · G3 63 PASS + 1 UNVERIFIED · parity 811

## [Tag 선택 = TagGroup 의 선택 — Tag variant 삭제 (레퍼런스) · contract 31] - 2026-10-09

### Breaking Changes

- **Tag 의 `variant` (Default / Selected) 를 지웠다** — RAC · S2 Tag 에는 variant 가 없다 (설치 RAC 1.21.0 `TagProps` · react-spectrum.adobe.com · Spectrum design-data `tag`). 선택된 Tag 는 TagGroup 의 선택이다 (사용자 결정 「선택으로 대체」). library contract 30 → 31 — 이전 contract 의 문서는 열지 않는다 (종전 규약 그대로, 다시 매핑하지 않는다).

### Changed

- **Tag 의 Design 패널: Variant 대신 Behavior 의 Selected** — 켜면 TagGroup 이 그 Tag 의 key 를 RAC 의 `defaultSelectedKeys` 로 넘긴다 (ToggleButtonGroup · ListBox 항목과 같은 선택 축 `isSelected`). Canvas 도 같은 판정으로 rule 의 selected 칠을 그린다. TagGroup 의 `selectionMode` 가 none 이면 RAC 처럼 둘 다 선택을 그리지 않는다. 열린 Preview 는 Selected · selectionMode 변경을 바로 따른다.
  - 위치: `packages/shared/src/catalog/bindings/Tag.binding.ts` · `runtime/delegatedDom.runtime.ts` (`taggroup` — `tagGroupTags` · 구독) · `runtime/presence.ts` (`catalogCollectionItemSelected`) · `document/types.ts` (contract 31)
  - 같은 날 앞 커밋 (`343034efe` — `TagGroup.css` 가 `data-variant="selected"` 를 칠함) 은 되돌렸다.
- 회귀: `tagGroupSelection.test.tsx` 4 (원복 RED 3) · live `apps/builder/scripts/tag-group-selection-live.mjs` 5/5 (Design 패널 Selected 클릭 → Canvas · Preview 선택 chip · selectionMode none → 둘 다 해제 · 새로고침 뒤 유지) · G3 63 PASS + 1 UNVERIFIED · parity 811

## [그룹 size 가 그룹 안 모든 항목에 · 같은 종류 toggle 중첩 금지 — ADR-256 Round 21 범위 밖 2건] - 2026-10-09

### Fixed

- **CheckboxGroup · RadioGroup · ToggleButtonGroup 의 size 가 Group · frame 으로 감싼 항목에도 적용된다** (종전: 감싼 항목만 md 로 돌아감 — Canvas · Preview 둘 다).
  - **Why**: 부모 size 를 받는 자식을 바로 아래 자식만으로 판정했다 (field 의 control Group 만 예외). 이제 Group · frame 을 건너 owner 를 찾는다 (`CATALOG_SIZE_PASS_THROUGH`), 그룹 size 를 나중에 바꿔도 감싼 항목까지 다시 계산한다.
  - 위치: `packages/shared/src/catalog/document/sizePropagation.ts` · `resolution/resolver.ts` (`applyOwnerSize`) · `runtime/compositionRoot.ts`
- **팔레트로 그룹에 바로 넣은 Checkbox · Radio 도 그룹 size 를 따른다** (종전: 그룹을 선택하고 추가하면 항목 상자 (CheckboxItems · RadioItems) 가 아니라 그룹 바로 아래에 들어가, 그룹이 lg 여도 기본 md 로 그려졌다).
  - **Why**: 그룹 size 가 항목 상자를 거쳐서만 항목에 닿았다. 이제 toggle 은 가장 가까운 같은 종류 그룹에서 size 를 받는다 — 그룹 값과 같은 판정 (`CATALOG_TOGGLE_GROUP_OF`). 그룹 size 를 바꾸면 그룹 안 toggle 전부를 다시 계산한다.
- **Checkbox · Radio · Switch · Tag 안에 같은 Checkbox · Radio · Switch · Tag 를 넣을 수 없다** (button 안 button 과 같다 — 사용자 결정). 팔레트로 항목을 선택한 채 같은 항목을 추가하면 그 항목 밖 (그룹 안) 에 들어간다. 그룹 (CheckboxGroup · RadioGroup · ToggleButtonGroup · TagList · ButtonGroup · AvatarGroup) 에는 항목을 그대로 넣는다.
  - 위치: `packages/shared/src/catalog/nesting/nestingRules.ts` (`NO_SELF_NESTING_TYPES`)
- 회귀: `adr256GroupFollowups.test.tsx` 20 (원복 RED 6) · live `apps/builder/scripts/adr256-round21-group-live.mjs` 9/9 · G3 63 PASS + 1 UNVERIFIED · parity 811

## [ADR-256 Codex Round 21 — Group 으로 감싼 Label 이 TagGroup 의 이름] - 2026-10-09

### Fixed

- **TagGroup 의 Label 을 Group 으로 감싸도 목록 이름은 그 Label 이다** (종전: 화면엔 Label 글자가 보이는데 목록 이름은 `label` 값 — `aria-label` 로 강제, `aria-labelledby` 없음).
  - **Why**: Label 이 있는지 직계 자식만 봤다. RAC `Group` 은 Label context 를 지우지 않아 RAC 는 Group 안 Label 로 이름을 붙인다. 이제 Group · frame 을 건너 글자 있는 Label 을 찾는다 (detach 뒤 `label` 값이 비어 있어도 Label 글자가 이름).
  - 위치: `packages/shared/src/catalog/runtime/delegatedDom.tsx` (`tagGroupLabelled`)
- 회귀: `adr256TagGroupAuthoredTree.test.tsx` 7 (원복 RED 1) · live `apps/builder/scripts/adr256-round20-live.mjs` 12/12

## [ADR-256 Codex Round 20 — TagGroup 노드 트리 · Group 으로 감싼 그룹 항목 · TagGroup 선택] - 2026-10-09

### Fixed

- **TagGroup 이 작성한 노드 구조대로 그려진다** — 지운 Label 이 Preview 에 다시 생기지 않고 (저장 · 새로고침 뒤도), Label 을 목록 뒤로 옮기면 Preview 도 뒤에 그리며, TagGroup 안에 자유 Text 를 넣을 수 있다 (종전: 넣기 거부 `NESTING_NOT_ALLOWED`).
  - **Why**: TagGroup 만 공용 합성 컴포넌트가 Label · Description · 정적 Tag 를 prop 에서 골라 정해진 순서로 다시 조립하고 있었다 (ADR-256 Phase 5d 는 지우기 버튼만 노드로 바꿨다). 이제 RAC `TagGroup` 이 자식을 순서대로 그리고, TagList 노드가 chip 상자 (`div.tag-list-wrapper`) 를 맡는다. 보이는 Label 이 없으면 목록 이름은 `label` 값 (없으면 "Tag group").
  - `maxRows` 접기 (Show all) 는 그대로 — 접기 상태를 TagGroup 이 들어, RAC 가 collection 을 만드는 숨은 사본도 같은 값을 본다 (수리 중 live 에서 찾은 결함: 사본이 측정하지 않아 모든 Tag 가 보였다).
  - 빈 label 의 TagGroup 은 Canvas 에도 Label 상자가 없다 (원본 Label 에 `presentWhen: nonEmptyText` — TextField 등과 같다).
  - 위치: `packages/shared/src/catalog/runtime/delegatedDom.tsx` (`taggroup` · `taglist`) · `components/TagGroup.tsx` (`useTagMaxRows` · `TagMaxRowsMirror`) · `nesting/nestingRules.ts` (제한 행 삭제) · `styles/TagGroup.css` (높이 규칙 삭제)
- **TagGroup 의 Single · Multiple 선택이 Preview 에서 동작한다** (종전: 눌러도 선택 0 — `selectedKeys: []` 고정).
- **CheckboxGroup · RadioGroup · ToggleButtonGroup 의 항목을 RAC Group 으로 감싸도 그룹 항목으로 남는다** — 선택 · 그룹의 disabled 등이 Canvas · Preview 에 그대로 (종전: Canvas 는 선택, Preview 는 미선택). 열린 Preview 에서 감싼 항목의 선택을 바꿔도 따라온다.
  - **Why**: RAC 의 그룹 context 는 그룹 아래 어디든 닿는데, DOM · Canvas 는 그룹 소속을 직계 부모 (frame 만 건넘) 로 판정했다. 판정을 "가장 가까운 같은 종류의 그룹 조상" 하나 (`presence.ts` `catalogToggleGroupOf` · `catalogToggleGroupItems`) 로 모았다.
- 회귀: `adr256TagGroupAuthoredTree.test.tsx` 6 · `adr256GroupWrappedToggles.test.tsx` 6 (원복 RED 11) · live `apps/builder/scripts/adr256-round20-live.mjs` 11/11 · G3 63 PASS + 1 UNVERIFIED · parity 811

## [Select id 변경 — 열린 Preview 의 trigger 가 새 id 를 바로 따른다] - 2026-10-09

### Fixed

- **Design 패널에서 Select 의 ID 를 바꾸면 열린 Preview 의 trigger 버튼 id 가 바로 바뀐다** (종전: Preview 를 다시 열 때까지 처음 id 그대로 · ID 를 지워도 trigger Button 자신의 id 로 돌아가지 않음 — ADR-256 후속 5 에서 남긴 차이).
  - **Why**: RAC `useLabel` 이 field id 를 `useId(props.id)` 의 state 로 들고 있어, 처음 mount 때의 값을 계속 쓴다. 작성자 id 가 바뀌면 그 RAC 요소를 key 로 다시 mount 한다 (id 를 편집할 때만 — 평소 렌더에는 영향 없음).
  - 위치: `packages/shared/src/catalog/runtime/domBinding.tsx` (`withHtmlId`)
- 회귀: `apps/builder/src/builder/catalogRuntime/__tests__/adr256FollowupsSelect.test.tsx` (detach 뒤 id 지움 → Button id · 새 id → trigger — 원복 RED) · live `apps/builder/scripts/select-id-change-live.mjs` 5/5 (Design 패널 ID 칸에 직접 입력 — `animal` → `pet` → detach 뒤 `species` → 지움 = `button_1`, 오류 0)

## [Radio 선택 indicator — Canvas 가 Preview 와 같은 두꺼운 링 · 흰 가운데로] - 2026-10-09

### Fixed

- **선택된 Radio 의 indicator 가 Canvas 에서도 Preview 와 같다** — 선택 색의 두꺼운 링 (sm 5 · md 6 · lg 7 · xl 8px) 안쪽이 흰색 (종전 Canvas: 2px 링 + 흰 틈 + 가운데 지름 8 의 accent 점 — 색이 거꾸로).
  - **Why**: `Radio.css` 는 `[data-selected] .indicator` 의 테두리를 두껍게 하고 바탕 `--color-white` 를 가운데로 남긴다. rule 의 `size.indicator.dotSize` 는 그 흰 가운데의 지름 (`boxSize − 2 × 선택 테두리`) 인데, Canvas `radio` primitive 는 이 값을 선택 색으로 채운 점의 지름으로 썼다. 이제 선택 테두리 색 원 (지름 boxSize) 위에 흰 원 (지름 dotSize) 을 그린다. 미선택 모양은 그대로.
  - 위치: `packages/rendering/src/renderers/skiaPrimitives.ts` (`radio`)
- 회귀: `packages/rendering/src/renderers/__tests__/buildCatalogShapes.selection.test.ts` (variant 4 × size 4 선택 모양 — 원복 RED 16) · live `apps/builder/scripts/radio-selected-live.mjs` (실제 Options「Selected」칩, Canvas Skia 데이터 ↔ Preview `.indicator` computed 4/4).

## [Design 패널 표시값 — 선택 record 의 실효값을 보인다 (부모 part rule · size 전파)] - 2026-10-09

### Fixed

- **Checkbox · Radio · Switch 안의 Button 부품 (CheckboxButton · RadioButton · SwitchButton) 을 고르면 Layout 탭이 실제 배치 (Row · 가운데 정렬 · Gap 8 / 10) 를 보인다** (종전: Block · Gap 0).
  - **Why**: 패널이 작성값이 없을 때의 기본값을 노드 **자기 type 의 rule** 로 다시 계산했다 (`specPresetResolver`). 이 부품들은 자기 rule 이 없고 배치는 부모 Checkbox rule 의 `.react-aria-CheckboxButton` 블록이 part rule 로 record 에 준다 — Canvas · DOM 은 그 record 를 읽는데 패널만 다른 계산을 했다. 이제 패널은 작성값 → **그려진 record 의 실효 view** (`catalogEffectiveStyle` — Canvas 레이아웃 입력 · DOM 이 쓰는 같은 상자 모델 `catalogBoxModel` + layout longhand + typography) → 패널 기본 순서로 읽는다. dirty · reset 은 그대로 작성값 기준.
  - 같은 원인으로 고쳐진 것: **size xl Checkbox 의 Label** 이 Text 탭에 18px · 줄 높이 28px (종전 Label rule 의 md 14px · 20px) · **TextField · Select 루트의 Padding 0** (종전 자식 Input 의 size padding 12 를 루트 값처럼 표시) · 정렬 토글이 실효 display 가 `inline-flex` 인 부품에 `display: flex` 를 쓰지 않는다 (block 부모에서 줄이 떨어지던 것).
  - record 에 없는 채널만 자기 type rule 을 뒤에 둔다 — Popover · Modal 의 `box-shadow` 처럼 생성 CSS class 로만 DOM 에 닿는 containerStyles (Appearance · Text · Size 키). Layout 키는 record 만 읽는다. Alignment 비활성 (catalog 기본이 grid) 와 Bold 해제 기준선은 표시 값이 아닌 편집 조건이라 자기 rule 판정을 유지한다.
  - 위치: `apps/builder/src/builder/catalogRuntime/effectiveStyle.ts` (새 adapter) · `panels/styles/catalog/catalogStylesHost.ts` (`effective`) · `panels/styles/hooks/{useLayoutValues,useLayoutAuxiliary,useStyleActions,useTypographyValues,useAppearanceValues,useTransformValues,useTransformAuxiliary}.ts`
- **여러 요소를 함께 골라 정렬 · Direction · Space · Wrap 을 누르면 요소마다 `display` 를 정한다** — `inline-flex` 인 요소 (Button · CheckboxButton) 는 그대로 두고 나머지는 `flex` 가 된다.
  - **Why**: 판정을 첫 선택 하나로 해 모든 선택에 같은 쓰기를 냈다. CheckboxButton 을 먼저 고르면 함께 고른 Frame 이 `display: block; flexDirection: row` 로 남아 자식이 가로로 서지 않았다 (Codex 판독 2026-10-09). 이제 host 의 `updateFlexStyles` 가 대상마다 작성값 → record 실효 display 로 판정하고 한 단계로 쓴다.
  - 위치: `panels/styles/catalog/catalogStylesHost.ts` (`updateFlexStyles`) · `panels/styles/hooks/useStyleActions.ts`
- 회귀: `apps/builder/src/builder/panels/styles/__tests__/effectiveStyleValues.test.tsx` (CheckboxButton · RadioButton · SwitchButton · TextField · Select · Slider rowGap · Button 불변 · xl Label · 정렬 토글 display 미기록 — 원복 RED 7/7 · 다중 선택 대상별 display — 원복 RED 1/1) · live `apps/builder/scripts/design-panel-effective-live.mjs` (실제 Builder 패널 입력값 · 다중 선택 Direction 5/5).

## [Checkbox 선택 · indeterminate · indicator 모서리 — Canvas 와 Preview 가 Properties Options 를 따른다] - 2026-10-09

### Fixed

- **팔레트 Checkbox 의 Options「Selected」를 끄고 켜면 Canvas 와 Preview 가 따라간다** (종전: Canvas 는 늘 체크, Preview 는 처음 값 그대로).
  - **Why (Canvas)**: 원본 루트의 표시 상태 (`displayState: selected`) 가 칠 상태를 계속 selected 로 강제했고, 증분 record 갱신도 옛 record 의 표시 상태를 들고 있었다. 이제 인스턴스가 그 상태의 prop (`isSelected`) 을 반대로 작성하면 그 자리의 표시 상태가 끝나고, 증분 갱신이 새 해석의 표시 상태를 읽는다.
  - **Why (Preview)**: DOM binding 이 선택을 RAC `defaultSelected` (uncontrolled) 로만 넘겨, 마운트된 Preview 가 이후 편집을 무시했다. 작성 기본값이 바뀌면 다시 그린다 (Tabs 의 default key 와 같은 방식 — Preview 클릭 토글은 그대로).
  - 위치: `packages/shared/src/catalog/resolution/resolver.ts` · `packages/shared/src/catalog/runtime/compositionRoot.ts` · `packages/shared/src/catalog/runtime/delegatedDom.tsx`
- **Indeterminate 를 켜면 Preview 에 가로선이 보이고, Canvas 는 채운 상자에 가로선을 그린다** (선택이 꺼져 있어도).
  - **Why**: `Checkbox.css` 의 `[data-indeterminate] svg { stroke: none; fill }` 이 선으로 그리는 lucide `Minus` 를 지웠다 (Builder UI 의 Checkbox 도 같은 시트). Canvas 는 indeterminate 를 선택 칠로 보지 않아 선택이 꺼진 상자에 흰 선을 흰 바탕에 그렸다 — DOM 시트처럼 `[data-selected], [data-indeterminate]` 를 같은 칠로 본다.
  - 위치: `packages/shared/src/components/styles/Checkbox.css` · `packages/shared/src/catalog/runtime/rulePaint.ts`
- **Canvas 의 checkbox 상자 모서리가 Preview 와 같다** (4px — 종전 Canvas 0).
  - **Why**: `checkbox` primitive 가 toggle root 의 `borderRadius` (size `{radius.none}`) 를 상자에 써서 rule 의 `size.indicator.boxRadius` 를 덮었다. DOM 은 root 모서리를 root 요소에 건다.
  - 위치: `packages/rendering/src/renderers/skiaPrimitives.ts`
- **Canvas 의 체크 · 가로선이 Preview 의 lucide 아이콘과 같은 모양 · 굵기다** (md: 선 2.67px · round cap — 종전 Canvas 는 상자 비율 0.2/0.4/0.8 의 임의 꺾은선 · 2.5px 고정이라 세로로 길고 얇았다).
  - **Why**: DOM 은 lucide `Check` (`M20 6 9 17l-5-5`) · `Minus` (`M5 12h14`) 를 viewBox 24 · stroke 4 로 `.checkbox` content box (border 안쪽 `boxSize − 4` 정사각형) 에 그린다. Canvas primitive 는 그 path 와 상관없는 비율을 하드코딩했다. 이제 같은 path 를 같은 영역 (border 만큼 안쪽, 배율 `(boxSize − 2·border)/24`) 에 굵기 `4 × 배율` · round cap 으로 그린다.
  - 위치: `packages/rendering/src/renderers/skiaPrimitives.ts` (`checkbox`)
- **Options「Invalid」가 Canvas 에 보인다** — 상자 테두리 negative, 선택 · indeterminate 상자는 바탕도 negative (체크는 흰색).
  - **Why**: Canvas `checkbox` primitive 가 `isInvalid` 를 읽지 않았다 (invalid 모양은 `Checkbox.css` `[data-invalid] .checkbox` 에만 있었다).
  - 위치: `packages/rendering/src/renderers/skiaPrimitives.ts` (`checkbox`)
- 회귀: `apps/builder/src/builder/catalogRuntime/__tests__/toggleIndicatorNode.test.ts` (Canvas 상태 3 · 모서리 · 크기별 glyph 4 · invalid · 마운트된 DOM · 시트) · live `apps/builder/scripts/checkbox-state-radius-live.mjs` (실제 Options 칩 클릭, Canvas Skia 데이터 ↔ Preview computed style · svg 실측 frame 의 glyph 좌표 · invalid 색).

## [ADR-256 후속 4 · 6 — Menu 를 MenuTrigger > Button + Popover > Menu 로 · 하위 메뉴 넣기] - 2026-10-09

### Changed

- **팔레트 Menu 가 레퍼런스 구조 `MenuTrigger > Button + Popover > Menu` 로 바뀌었다** (ADR-256 후속 4, library contract 30): trigger 는 Button 노드라 글자 · 모양을 Button 처럼 편집하고, Menu 노드는 어디에 있든 RAC `Menu` (목록) 다. 놓은 Menu 의 Properties 에서 Size · Selection Mode 를 바꾸면 안쪽 Menu 에 닿는다.
  - **Why**: Menu 노드 하나가 trigger 버튼과 닫힌 목록을 함께 맡아 (Preview 는 공용 `MenuButton`, Canvas 는 Menu rule 의 버튼 모양), Autocomplete 안에 열린 목록으로 둘 수 없었다.
  - contract 29 문서는 열리지 않는다 (옛 contract 와 같은 정책).
  - 위치: `catalog/document/generated/reusableOriginLibrary.ts` · `bindings/MenuTrigger.binding.ts` · `components/MenuTrigger.tsx` · `catalog/runtime/delegatedDom.tsx` (`menu`) · `presence.ts` · `componentRulesTable.ts` (Menu = 목록 · MenuTrigger)

### Added

- **Autocomplete 안 Menu** (G0 예제 4): Canvas · Preview 모두 열린 목록이고 입력값이 항목을 거른다.
- **Design "+" 로 하위 메뉴 넣기** (ADR-256 후속 6): Menu 의 항목 목록에 SubmenuTrigger 가 있다 — `SubmenuTrigger > MenuItem + Popover > Menu > MenuItem` 을 한 번에 넣고, Preview 에서 그 항목이 하위 메뉴를 연다.

### Fixed

- **Menu 의 "+" 로 넣은 MenuItem 이 실패하지 않고, 이름만 보인다**: MenuItem 이 RAC key (`id`) 를 받지 못해 넣기가 거부됐고, 채우지 않은 `{shortcut}` 자리표시 글자가 그대로 보였다. MenuItem 의 작성자 HTML id 도 더는 RAC key 를 덮지 않는다.
  - 위치: `domain/componentTraits.ts` (MenuItem = static collection item) · Builder `catalogRuntime/itemInsert.ts`
- **MenuItem 안에 MenuItem 을 넣는 옛 "+" 를 지웠다** (하위 메뉴가 아니다 — 하위 메뉴는 SubmenuTrigger). 위치: `catalog/commands/collections.ts`

## [ADR-256 후속 3 · 5 · 7 — Select 다중 선택 · detach 뒤 Preview 오류 · 선택 상태 원본] - 2026-10-09

### Fixed

- **Select 의 Selection Mode `Multiple` 이 Preview 에 반영된다**: 여러 옵션을 고를 수 있고 trigger 가 고른 것을 나열한다.
  - **Why**: DOM binding 이 `selectionMode` 를 RAC `Select` 에 넘기지 않았다 (Properties 에는 있었다).
  - 위치: `packages/shared/src/catalog/runtime/delegatedDom.tsx`
- **Preview 를 연 채 Select 를 detach 해도 Preview 에 오류가 쌓이지 않는다** (React `Maximum update depth exceeded` 가 초당 수십 건).
  - **Why**: RAC 는 Select 의 `id` 를 trigger 의 id 로 쓴다. detach 로 trigger Button 이 작성자 노드가 되며 자기 HTML id 를 받아 한 요소에 id 둘이 겹쳤고, RAC 의 id 병합이 둘 사이를 계속 오갔다. 이제 Select 에 id 가 있으면 그것이 trigger 의 id 다.
  - 위치: `packages/shared/src/catalog/runtime/domBinding.tsx` (`withHtmlId`)
- **선택 상태로 보이는 기본 원본 (팔레트 Checkbox · Switch · ToggleButton · Tree 항목) 을 detach 할 수 있다** — 보이던 선택 그대로 (`isSelected: true`) 남는다.
  - **Why**: 원본 루트의 표시 상태 (`displayState: selected`) 를 소유 노드가 담을 곳이 없어 detach 가 거부됐다. 이제 그 상태가 뜻하는 prop 으로 옮긴다.
  - 위치: `packages/shared/src/catalog/commands/materialize.ts`
- **CheckboxGroup · RadioGroup · ToggleButtonGroup 안 항목이 Canvas 에서 전부 선택으로 그려지지 않는다**: 그룹의 값을 따른다 (기본 = 선택 없음, Canvas · Preview · Properties 같음). 선택이 없는 RadioGroup 의 Radio 가 Tab 순서에 들어간다.
  - **Why**: 항목 원본의 선택 표시 상태를 collection 항목은 무시했지만 그룹 항목은 강제했다 (Canvas 는 RadioGroup 항목 전부, Preview 는 첫 Radio 만 선택). 값 없는 RadioGroup 은 RAC 에 `""` 를 넘겨 모든 Radio 가 Tab 에서 빠졌다 (전에는 강제 선택에 가려졌다).
  - 위치: `packages/shared/src/catalog/document/collectionItems.ts` (`isInOwnGroup`) · `catalog/resolution/resolver.ts` · `fieldSource.ts` · `catalog/runtime/delegatedDom.tsx`

## [Codex 검증 하니스 보완 — 범위 선택 · 최신 증거 · 비수정 preflight] - 2026-10-09

### Infrastructure

- **현행 catalog 경로에 맞춘 검증 선택**: shared 컴포넌트의 시각·브라우저 검사, shared 원본의 등록 검사, ADR-248 G3 전용 browser config를 선택한다. 스킬·하니스 변경에는 해당 Node 회귀와 스킬 검증을 연결했다. 위치: `scripts/agent/work.sh`, `scripts/codex/skills-gate.sh`
- **검증 증거의 최신성 확인**: 최신 결과가 PASS이고 기록한 HEAD·범위·파일 내용이 현재와 같을 때만 live/cross-check 증거를 재사용한다. **Why:** 이후 FAIL이나 소스 변경에도 과거 PASS가 통과 근거로 남던 조건을 제거했다. 위치: `scripts/agent/evidence-state.mjs`, `scripts/agent/run-ledger.sh`
- **포맷 검사와 수정 분리**: preflight는 `codex:format:check`를 사용한다. 명시적 포맷과 hook은 `.prettierignore`를 공유해 typed 원본과 생성 CSS의 전체 재포맷을 피한다. snapshot은 현행 권한 계약과 관련 지침 링크만 안내한다.

## [ADR-256 후속 — 착수 중 남긴 Canvas · Preview 차이 12건] - 2026-10-09

### Fixed

- **날짜**: DateRangePicker 시작 칸 폭이 Canvas 와 Preview 에서 같다 (ko-KR 날짜 조각의 끝 공백) · 열린 DatePicker · DateRangePicker 달력에 이중 틀이 없다 · 기간 구분자는 화면 읽기에서 빠진다 (`aria-hidden`)
- **진행 막대 · Slider**: Canvas 의 ProgressBar · Meter track · fill 모서리가 Preview 와 같다 · ProgressBar `staticColor` 를 Canvas 도 칠한다 · Slider 값이 `step` 에 맞춰진다 (Canvas · Preview) · **Slider 값을 바꾸면 Canvas 의 채움 · thumb 가 바로 따라온다** (전에는 다시 열어야 했다)
- **ColorSwatchPicker**: Canvas 에서 1px 테두리 · 바탕을 그리지 않는다 (Preview 와 같은 자리)
- **Tree · Table**: 펼친 하위 Tree 항목이 Canvas 에서 부모 행 아래에 놓인다 · 노드 Table 에 header 바탕과 행 구분선이 생긴다 (Canvas · Preview) · checkbox 방식 Tree 의 내용 노드 없는 항목에 자동 체크박스가 붙지 않는다
- **편집**: 인스턴스 안 노드를 Canvas 에서 선택해 Delete 로 지울 수 있다 · ToggleButtonGroup 안 ToggleButton 을 Preview 에서 누르면 조건부 노드가 따라온다 · detach 가 중첩 instance 를 거친 상태 주체 참조를 유지한다
- 위치: `catalog/runtime/compositionRoot.ts` · `presence.ts` · `delegatedDom.tsx` · `domBinding.tsx` · `catalog/document/manualBoxRules.ts` · `stateOwnerRefs.ts` · `commands/materialize.ts` · `componentRulesTable.ts` · `components/Tree.tsx` · Builder `catalogRuntime/canvasMenu.ts`

## [ADR-256 Phase 8 후속 — Tree chevron 회전 · DisclosureGroup 빈 frame] - 2026-10-09

### Fixed

- **Tree 항목의 chevron Icon 을 다른 glyph 로 바꾸면 Preview 에서도 돌지 않는다** (펼침 회전은 `chevron-right` 만 — Canvas 와 같음, Disclosure 와 같은 규칙). 위치: `components/styles/Tree.css`
- **DisclosureGroup 안 빈 frame 에 나중에 넣은 Disclosure 도 그룹 펼침을 따른다**. 위치: `catalog/runtime/presence.ts` (`catalogGroupDisclosures`)

## [ADR-256 Phase 8 판독 수리 — Disclosure 그룹 소속 · frame 안 Heading · trigger 속성 · chevron 회전] - 2026-10-08

### Fixed

- **DisclosureGroup 안에서 다른 요소 (frame · Card) 아래에 둔 Disclosure 가 그룹을 따른다**: Preview 에서 접힌 채 눌러도 열리지 않던 문제 — 이제 Canvas · Preview 모두 그룹의 펼침 (`allowsMultipleExpanded`) 을 따른다 (RAC 그룹 context 와 같이 깊이 무관). 위치: `catalog/runtime/presence.ts` (`catalogDisclosureGroupOf` · `catalogGroupDisclosures`) · `catalog/runtime/delegatedDom.tsx`
- **Disclosure 의 Heading 을 frame 으로 감싸도 trigger 모양 · chevron 회전이 남는다** (Canvas trigger 의 투명 바탕 · 여백 · 글자 크기, Preview 의 펼침 회전). 위치: `catalog/resolution/resolver.ts` · `componentRulesTable.ts` (회전 = trigger 의 `aria-expanded`)
- **Disclosure trigger 에 쓴 `isDisabled` · 글자가 Preview 에 반영된다**. 위치: `catalog/runtime/domBinding.tsx`
- **trigger 의 Icon 을 다른 glyph 로 바꾸면 Preview 에서도 돌지 않는다** (chevron-right 만 돈다 — Canvas 와 같음). 위치: `catalog/runtime/domBinding.tsx` (Icon `data-icon`) · `componentRulesTable.ts`

## [ADR-256 Phase 8e — 쓰이지 않게 된 Disclosure · 화살표 코드 삭제] - 2026-10-08

### Removed

- **옛 Disclosure type 3종 · 공용 Disclosure 컴포넌트 · Skia 화살표 primitive 삭제** (ADR-256 Phase 8e — 사용자 승인): `DisclosureHeader` · `DisclosureChevron` · `DisclosureContent` (8c 부터 Heading · Button · Icon · DisclosurePanel 노드), `packages/shared` 의 `Disclosure` · `DisclosureGroup` export (8c · 8d 부터 RAC 를 직접 그린다), `popover_arrow` · `tooltip_arrow` primitive (8a 부터 OverlayArrow 노드). 화면 변화 0. 위치: `catalog/bindings/` · `components/index.ts` · `components/list.ts` · `rendering/src/renderers/skiaPrimitives.ts`

## [ADR-256 Phase 8d — DisclosureGroup 이 자유 내용을 받는다] - 2026-10-08

### Changed

- **DisclosureGroup 안에 Disclosure 밖의 노드도 넣을 수 있다** (ADR-256 Phase 8d — RAC DisclosureGroup 은 children 을 그대로 그린다): 넣은 노드는 Canvas · Preview 양쪽에 그 자리에 보이고, 펼침 (`allowsMultipleExpanded`) 은 RAC 가 Disclosure 들 사이에서 정한다. 위치: `catalog/nesting/nestingRules.ts` (미전환 제한 행 삭제) · `catalog/runtime/delegatedDom.tsx` (`disclosuregroup` = RAC DisclosureGroup)

## [ADR-256 Phase 8c — Disclosure 를 노드 트리로 · trigger = RAC Button · 펼침 패널 = DisclosurePanel] - 2026-10-08

### Changed

- **Disclosure 가 레퍼런스 구조를 따른다** (ADR-256 Phase 8c — react-aria.adobe.com Disclosure):
  - 원본 = `Disclosure > Heading > Button[slot=trigger] > (chevron Icon + 제목 Text) + DisclosurePanel > 내용 Text` — Preview 는 RAC Disclosure 가 자식 노드를 순서대로 그린다 (전에는 공용 Disclosure 컴포넌트가 제목만 받아 trigger · chevron · 패널을 스스로 만들었다)
  - chevron 은 trigger 안 Icon 노드 — 지우거나 바꿀 수 있고, 펼치면 Preview 는 90° 돌고 Canvas 는 아래쪽 glyph 를 그린다. Canvas chevron 색이 trigger 글자색 (Preview 와 같음 — 전에는 Canvas 만 흐린 회색)
  - 접은 Disclosure 에서 Canvas 가 숨기는 것은 DisclosurePanel 뿐이다 (그 밖에 둔 노드는 RAC 처럼 보인다)
  - Disclosure size 가 trigger · 패널 글자에 그대로 닿는다 (Canvas · Preview)
  - 저장 형식 contract 29 — 옛 개발용 프로젝트는 열리지 않는다
  - 위치: `catalog/runtime/delegatedDom.tsx` (`disclosure`) · `catalog/runtime/domBinding.tsx` (`disclosurepanel` · Heading 자식 · trigger Button) · `catalog/runtime/presence.ts` · `catalog/document/rulePartRules.ts` · `catalog/resolution/resolver.ts` (Disclosure 의 Heading 을 건너는 part rule) · `componentRulesTable.ts` (Disclosure sheet) · `catalog/bindings/DisclosurePanel.binding.ts`

## [ADR-256 Phase 8b — Dialog 가 Modal 노드 안에서 열린다] - 2026-10-08

### Changed

- **Dialog 가 레퍼런스 구조를 따른다** (ADR-256 Phase 8b — react-aria.adobe.com Modal 예제):
  - 원본 = `DialogTrigger > Button + Modal > Dialog` — Preview 는 RAC Modal (RAC 가 ModalOverlay 를 만든다) 안에 Dialog 를 그린다. 전에는 Dialog 컴포넌트가 노드에 없는 Modal 을 스스로 만들었다
  - 밖을 눌러 닫기 (`Dismissable`) 는 Modal 의 속성이다 (RAC `isDismissable` — Dialog 의 같은 속성은 없어졌다)
  - Canvas 는 전처럼 trigger 버튼만 그린다 (닫힌 overlay)
  - 저장 형식 contract 28 — 옛 개발용 프로젝트는 열리지 않는다
  - 위치: `catalog/document/generated/reusableOriginLibrary.ts` (`component-dialog__modal`) · `catalog/bindings/{Dialog,Modal}.binding.ts` · `components/Modal.tsx` (안의 Dialog 는 자기 overlay 를 만들지 않음) · `components/Dialog.tsx`

## [ADR-256 Phase 8a — Popover · Tooltip 의 화살표 = OverlayArrow 노드] - 2026-10-08

### Changed

- **Popover · Tooltip 의 화살표가 노드다** (ADR-256 Phase 8a — react-aria.adobe.com Popover · Tooltip 예제의 `OverlayArrow`):
  - 원본 = `Popover > OverlayArrow + Heading + Description` · `Tooltip > OverlayArrow + Description` — Preview 는 RAC `OverlayArrow` (레퍼런스 starter 의 svg — Popover 12 · Tooltip 8) 를 그 자리에 그리고, RAC 가 trigger 기준으로 놓는다
  - 화살표를 빼려면 그 노드를 지운다 — Popover 의 `Hide Arrow` 속성은 없어졌다 (picker 4종의 Popover 도 노드가 없어 화살표 없음, 전과 같음)
  - 메뉴 하위 메뉴 (SubmenuTrigger) 의 Popover 는 이제 Preview 에 화살표가 없다 (레퍼런스와 같음 — 전에는 공용 Popover 가 그렸다)
  - Canvas 는 열린 overlay 를 그리지 않으므로 화살표 상자도 없다 (화면 변화 0). 그려지지 않던 Skia 화살표 primitive 연결을 뗐다
  - 저장 형식 contract 27 — 옛 개발용 프로젝트는 열리지 않는다
  - 위치: `catalog/bindings/OverlayArrow.binding.ts` · `catalog/runtime/domBinding.tsx` (`overlayarrow` · overlay 의 자기 화살표 끔) · `catalog/runtime/presence.ts` · `components/Tooltip.tsx` (`hideArrow`) · `catalog/document/generated/reusableOriginLibrary.ts` (`component-popover` · `component-tooltip`)

## [문서·메모리 낡은 심볼 정리 — `pnpm docs:stale-symbols` 게이트 · ADR-248 이전 문서 38개 legacy 이동] - 2026-10-08

### Tests

- **낡은 코드 심볼 게이트 신설** — `pnpm docs:stale-symbols` (`scripts/check-stale-doc-symbols.py`):
  - `.claude/rules` · skill · agent · `CLAUDE.md` 가 소스 (apps · packages · scripts) 에 없는 식별자를 **현재 것처럼** 인용하면 exit 1. `--docs` · `--memory` · `--all` 은 보고만 (`/wiki-lint` 가 `--memory` 를 호출)
  - 판정 문맥 = 줄 + 직전 줄 + 표 머리행 + 가까운 제목 + 날짜 — 「옛 · 삭제 · 기록 당시 · 정정」 표지가 있으면 이력 인용으로 통과. 파일 끝 정정 노트가 같은 이름을 이력으로 표시해도 통과
  - **Why**: 삭제 · 개명 커밋 (ADR-248 Phase 4e `0b0eaea28` · 옛 TS 레이아웃 파이프라인 `78469745d` 등) 이 소스만 지우고 규칙 · skill · 메모리의 이름은 두고 가서, `/review` 체크리스트 (`contracts.md`) 가 삭제된 `readImmediateSelectionSnapshot` 경로로 판정하는 등 drift 가 쌓였다. 전수 스캔 결과 `.claude` 285 파일 · `docs/` 1,699 파일 · 메모리 304 파일에서 현재 것처럼 인용된 낡은 이름이 각각 53 · 63 · 121 이었다 — 세 영역 모두 0 으로 정리

### Documentation

- **`/review` 체크리스트를 catalog runtime 기준으로 개정** — `.claude/skills/review/references/contracts.md`:
  - 옛 Zustand store · spec 경로 항목 삭제 → 명령 파이프라인 (`workspace.execute`) · history 의도 · 부품 소유 술어 · typed field · 레이아웃 증분 경로로 재작성
  - 마켓플레이스 `code-review` 플러그인의 git 이력 관점과 `pr-review-toolkit` 의 silent-failure 관점을 프로젝트 함정 기록 (fallback = 기본값이면 끊긴 채널이 무증상 등) 에 맞춰 두 절로 추가
- **규칙 · skill 문서의 낡은 이름 교체** — `ssot-hierarchy.md` (`SELF_COMPOSED_CONTAINER_CHILD_TYPES` → `ListBoxItem.owners` 계약 · `catalogQuietOwnerPaint` → `catalogQuietStyles`) · `component-registry.md` · `domain-structure-change-audit.md` (`CATALOG_DOM_CHILD_OWNING_BINDINGS` → `catalogDomRendersNode` · `ownsChild`) · `canvas-details.md` (`parseLineHeight` → `visual.lineHeight` 비율 + `resolveLineHeightValue`) · `compositional-architecture.md` (`catalogIndicatorInset` → `catalogToggleIndicatorBox`) · `canvas-interaction.md` hover 행 · `arch-reference-impl.md` 참조
- **ADR-248 이전 구조 문서 38개를 `docs/legacy/` 로 이동** (`docs/reference` · `features/completed` · `explanation/architecture` · `how-to` · `migrations` — 낡은 이름 비율 ≥ 30% 또는 전면 구식):
  - `STRUCTURE_STORE` · `CANVAS_INTERACTIONS` · `DRAG_DROP_DESIGN` · `SAVESERVICE` · `COMPONENT_SPEC` (제목은 「현행」이나 publish 자체 registry · `TAG_SPEC_MAP` 기준) · `KEYBOARD_SHORTCUTS` · `MULTIPAGE` · `MULTI_SELECT` · `INDEXDB` (현행 스키마는 `storage.ts` 의 heads · entries) 등. 각 파일 Legacy 배너 · 상대 링크 재계산 · `docs/README` 현행 목록 정리 · `legacy/README` 사유 표
  - ADR-912 prop parity 감사는 `docs/reference/audits/2026-06-25-…` 로 (외부 RAC/RSP prop 이름이라 감사 기록 폴더)
  - 남긴 `CSS_SUPPORT_MATRIX.md` (M-4 해소 표기) · `COLOR_PICKER.md` (옛 `borderUtils` 기록 표기) 는 줄 단위 정정
- **메모리 정리** (`/wiki-lint`) — 80 파일에 삭제 커밋 · 현재 거처를 적은 정정 노트, `MEMORY.md` 의 「투영은 `propagationRegistry` 하나」 hook 정정 (10-05 삭제 → resolver `catalogDerivedProps`), 같은 결함 (`|| "기본"` 이 빈 값과 부재를 합침) 을 두 번 기록한 r17 · r18 메모리 통합

### Infrastructure

- `CLAUDE.md` 명령 블록에 `pnpm docs:stale-symbols` 등재 · `/wiki-lint` 실행 절에 `--memory` 호출 추가. Codex 플러그인 1.0.4 → 1.0.6 · Codex CLI 0.160.1 → 0.161.0

## [ADR-256 Phase 7 판독 수리 — 값 바인딩 편집 · frame 안 Slider 부품 · 늘어난 absolute 상자] - 2026-10-09

### Fixed

- **detach 한 ProgressBar · Meter · Slider 의 값 글자를 바꾸면 Canvas 와 Preview 가 그 글자를 그린다** — 전에는 Preview 가 계속 값 (30%) 을 그리고, 값을 바꾸면 Canvas 도 되돌아갔다. 부품에 새로 쓴 `{valueText}` 도 이제 값을 읽는다. 위치: `catalog/runtime/compositionRoot.ts`
- **값을 바인딩한 Label 이 값이 돌아오면 Canvas 에 다시 보인다** (indeterminate 를 끈 뒤) · **프로젝트 변수로 쓴 `valueLabel` 이 바뀌면 Canvas 값 글자가 따라온다**
- **SliderFill · SliderTrack 을 frame 으로 감싸도 Canvas 의 채움 · thumb 이 값 자리에 놓인다** — 전에는 채움 높이 0 · 트랙 전체. 위치: `catalog/runtime/presence.ts`
- **레이아웃 엔진: 양쪽 inset 으로 늘어난 absolute 상자 안 absolute 자식의 `%` 크기** — 늘어난 상자 기준으로 놓는다 (전에는 0). 레퍼런스 Slider 예제의 `.track { position: absolute }` 조립이 Canvas 에서 맞는다. 위치: `packages/engine/src/tree.rs`

## [ADR-256 Phase 7d — Meter track 색 정리 · 쓰지 않는 코드 삭제] - 2026-10-09

### Fixed

- **Meter 의 track 이 Preview 에서 Canvas 와 같은 회색이다** — 전에는 Preview 가 연한 accent (유색 테마에서 푸름), Canvas 가 회색이었다. 회색이 정본 (사용자 판정). 위치: `catalog/generated/componentRulesTable.ts` (Meter `.bar`)

### Removed

- 공용 `components/Meter.tsx` (Preview 가 RAC Meter 를 직접 그린다) 와 Canvas primitive `value_fill_bar` · `slider_fill_bar` (채움은 노드) — 사용자 승인

## [ADR-256 Phase 7c — Slider 를 노드 트리로 · 채움 = RAC SliderFill · 값 글자 = RAC 의 값] - 2026-10-09

### Changed

- **Slider 가 레퍼런스 구조를 따른다** (ADR-256 Phase 7c — react-aria.adobe.com Slider 예제):
  - 원본 = `Slider > Label + SliderOutput + SliderTrack > SliderFill + SliderThumb` — Preview 는 RAC Slider 가 자식 노드를 순서대로 그린다 (작성자가 넣은 노드도 그 자리에)
  - 채움은 새 노드 `SliderFill` (RAC SliderFill — RAC 가 값으로 자리를 정한다), thumb 은 자기 노드가 그린다 (원 + 2px 링). track 은 자기 상자가 막대 (둥근 끝)
  - 값 글자 (SliderOutput) 는 RAC 가 쓰는 값 — Canvas 에서도 실제 값 (전에는 고정 글자 「50」). 작성자가 글자를 넣으면 그 글자
  - 문서에서 값을 바꾸면 열린 Preview 도 그 값으로 다시 시작한다 (전에는 다시 열 때까지 옛 값)
  - `showValueLabel` 을 끄면 Canvas 에서도 값 글자가 사라진다
  - 보이는 label 이 없으면 Preview 의 Slider 에 이름 (`aria-label` 「Slider」)
  - Chart 의 창 트랙 (공용 Slider) 도 같은 채움 요소 (RAC SliderFill) 를 쓴다
  - 저장 형식 contract 26 — 옛 개발용 프로젝트는 열리지 않는다
  - 위치: `catalog/runtime/delegatedDom.tsx` (`slider`) · `catalog/runtime/domBinding.tsx` · `catalog/runtime/presence.ts` (`catalogSliderFillLayout`) · `catalog/runtime/valueBindings.ts` (SliderOutput 글자) · `packages/rendering` (slider archetype CSS · `slider_thumb`) · `components/Slider.tsx` · `catalog/document/generated/reusableOriginLibrary.ts` (`component-slider`)

## [ADR-256 Phase 7b — Meter 를 노드 트리로 · 값 글자 · 채움 폭 = RAC 의 값] - 2026-10-09

### Changed

- **Meter 가 ProgressBar 와 같은 구조를 따른다** (ADR-256 Phase 7b):
  - 원본 = `Meter > Label + 값 글자 + track > fill` — Preview 는 RAC Meter 가 자식 노드를 순서대로 그린다
  - 값 글자 · 채움 폭은 RAC Meter 의 `valueText` · `percentage` 에 묶인다 — Canvas 에서도 실제 값 (전에는 고정 글자 「75%」), 최솟값 · 최댓값이 있으면 범위 안의 자리로
  - 채움은 track 안의 노드 (`MeterFill`) — 칠은 Meter 의 variant 4색
  - 보이는 label 이 없으면 Preview 의 Meter 에 이름 (`aria-label` 「Meter」) 이 붙는다
  - 저장 형식 contract 25 — 옛 개발용 프로젝트는 열리지 않는다
  - 위치: `catalog/runtime/delegatedDom.tsx` (`meter`) · `catalog/runtime/domBinding.tsx` · `catalog/runtime/presence.ts` · `catalog/document/generated/reusableOriginLibrary.ts` (`component-meter`)

## [ADR-256 Phase 7a — ProgressBar 를 노드 트리로 · 값 글자 · 채움 폭 = RAC 의 값] - 2026-10-09

### Changed

- **ProgressBar 가 레퍼런스 구조를 따른다** (ADR-256 Phase 7a — react-aria.adobe.com ProgressBar 예제):
  - 원본 = `ProgressBar > Label + 값 글자 + track > fill` — Preview 는 RAC ProgressBar 가 자식 노드를 순서대로 그린다 (작성자가 넣은 노드도 그 자리에)
  - 값 글자는 RAC 의 `valueText` (`{valueText}`), 채움 폭은 RAC 의 `percentage` (`width: {percentage}%`) 에 묶인다 — Canvas 는 같은 계산으로 ProgressBar 의 값에서 읽고, Preview 는 RAC 의 값을 읽는다. 값을 바꾸면 둘 다 바로 따라온다
  - 값 글자가 실제 값을 보인다 — 전에는 원본의 고정 글자 「50%」 였다 (Canvas). 최솟값 · 최댓값이 0 · 100 이 아니면 RAC 처럼 범위 안의 자리로 백분율을 낸다 (전 Preview 는 값을 그대로 백분율로 썼다). `valueLabel` 이 있으면 그 글자
  - 채움은 track 안의 노드 (`ProgressBarFill`) — 칠은 ProgressBar 의 variant 색
  - indeterminate 이면 값 글자가 없다 (RAC) — 전 Preview 는 값을 보였다
  - `showValueLabel` 을 끄면 Canvas 에서도 값 글자가 사라진다 (전에는 Preview 만)
  - 보이는 label 이 없으면 Preview 의 ProgressBar 에 이름 (`aria-label` 「Progress」) 이 붙는다
  - 저장 형식 contract 24 — 옛 개발용 프로젝트는 열리지 않는다 (ADR-256 Decision 10)
  - 위치: `catalog/runtime/valueBindings.ts` (새) · `catalog/runtime/delegatedDom.tsx` (`progressbar`) · `catalog/runtime/domBinding.tsx` · `catalog/runtime/presence.ts` · `catalog/runtime/compositionRoot.ts` · `catalog/generated/racStateKeys.ts` (`RAC_VALUE_KEYS`) · `catalog/document/generated/reusableOriginLibrary.ts` (`component-progressbar`)

## [ADR-256 Phase 6 판독 수리 — picker 부품을 frame 으로 감싸거나 Popover 위치를 바꿀 때] - 2026-10-08

### Fixed

- **picker 부품 편집 4건** (ADR-256 Phase 6 판독 Round 14):
  - DatePicker · DateRangePicker 의 달력을 frame 으로 감싸면 picker 의 개월 수 · 크기 · 읽기 전용을 잃던 것 — frame 을 건너 picker 를 찾는다
  - field 의 입력 상자 Group (NumberField · SearchField · ComboBox · DatePicker · DateRangePicker) 안의 `showWhen` 노드가 Group 의 RAC 상태 (focus 등) 를 받지 못하고, Group 에 작성한 `role` 이 Preview 에 없던 것
  - Select · ComboBox 의 Popover 를 frame 으로 감싸면 닫힌 Popover 가 Canvas 에 그려지던 것 (Preview 는 닫힘)
  - picker 의 Popover 에 작성한 위치 (`placement` — 예 `top`) 가 무시되고 늘 아래로 열리던 것. 기본값 (`bottom`) 이면 지금처럼 picker 자리 (`bottom start`)
  - 위치: `catalog/runtime/delegatedDom.tsx` (`pickerHost`) · `catalog/runtime/domBinding.tsx` (`nodeTreeControlGroup` · `ruleDom`) · `catalog/runtime/presence.ts` (`catalogHiddenAtRest`)

## [ADR-256 Phase 6h — Table 열 이름이 RAC Group 안에] - 2026-10-08

### Changed

- **Table 의 Column 이 레퍼런스 구조를 따른다** (ADR-256 Phase 6h — react-aria.adobe.com Table 의 starter Column `Group[role=presentation].column-name`):
  - Insert Column 이 넣는 Column 은 `Column > Group[role=presentation] > Text` 다
  - 열 이름은 지금처럼 Column 의 「Text」 (`children`) 로 바꾼다 — 안쪽 Text 가 그 값에 묶여 있다. 데이터 연결 열의 label 도 같은 값을 읽는다
  - 이름은 굵게 (600) — Canvas · Preview 같은 값
  - TableView 는 바뀌지 않는다 (자기 격자 — 열은 글자를 가진 Column 그대로)
  - 저장 형식 contract 23 — 옛 개발용 프로젝트는 열리지 않는다 (ADR-256 Decision 10)
  - 위치: `catalog/document/generated/reusableOriginLibrary.ts` (`component-table-column` · `component-tableview`) · `catalog/document/types.ts` (`LIBRARY_CONTRACT_VERSION`)

## [ADR-256 Phase 6g — Autocomplete 컴포넌트 · 레이아웃 엔진의 display: contents] - 2026-10-08

### Added

- **Autocomplete** (ADR-256 Phase 6g — react-aria.adobe.com Autocomplete 의 "ListBox example"):
  - 팔레트 forms 의 `autocomplete` 가 `Autocomplete > SearchField + ListBox` 를 놓는다. Preview 에서 검색어를 입력하면 목록이 걸러지고 (레퍼런스의 `useFilter({sensitivity: "base"}).contains` — 대소문자 무시), 첫 일치 항목이 가상 focus 를 받는다 (입력에 focus 를 둔 채 화살표로 이동)
  - Autocomplete 자체는 요소가 없다 (RAC 그대로) — SearchField 와 ListBox 가 부모의 흐름에 바로 선다. 안에 다른 노드 (wrapper · 글자) 를 넣을 수 있다 (자유 내용)
  - prop: `defaultInputValue` · `disableAutoFocusFirst` · `disableVirtualFocus` (RAC `AutocompleteProps`)
  - 위치: `catalog/bindings/Autocomplete.binding.ts` · `catalog/runtime/domBinding.tsx` (`CatalogAutocomplete`) · `document/generated/reusableOriginLibrary.ts` (`component-autocomplete`) · `generated/componentRulesTable.ts`
- **레이아웃 엔진이 `display: contents` 를 지원한다** (CSS-DISPLAY-3 §2.5):
  - contents 노드는 상자를 만들지 않고 그 자식이 부모의 자식 자리에 선다 (부모의 flex 방향 · gap · blockify 를 그대로 받는다). contents 노드의 보고 상자는 자식들의 합집합 (선택 · 오버레이용) 이고, 자식 좌표는 그 상자 기준이라 Canvas 는 바꿀 것이 없다
  - **Why**: 요소가 없는 RAC 부품 (Autocomplete) 을 Canvas 가 상자로 그리면 부모가 가로 흐름이거나 gap 이 있을 때 Preview 와 자리가 달라진다. TS 보정 대신 엔진에 CSS 의미를 구현했다 (레이아웃 규칙 「새 CSS gap 은 엔진 구현이 기본 경로」)
  - 위치: `packages/engine/src/tree.rs` (`box_children` · `settle_contents_children` · `layout_parent`) · `catalog/document/validation.ts` (display 값 `contents` 허용)

## [ADR-256 Phase 6f — picker 항목의 선택 표시를 작성자 노드로 바꿀 수 있다] - 2026-10-08

### Changed

- **Select · ComboBox 의 항목에 작성자가 넣은 선택 표시 노드가 RAC 의 선택을 따른다** (ADR-256 Phase 6f):
  - 기본은 그대로 — 열린 목록에서 고른 항목 왼쪽에 sheet 의 ✓ 글리프
  - 항목 안에 `Show when: isSelected` 노드 (레퍼런스 DropdownItem 의 `isSelected && <Check />` — 예: check Icon) 를 넣으면 그 노드가 Preview 에서 고른 항목에만 보이고, 그 항목의 글리프는 비킨다 (둘이 겹치지 않는다). 아이콘 노드는 글리프 자리 (왼쪽 여백, 세로 가운데) 에 놓인다
  - **Why**: 옛 Preview 의 ListBoxItem 은 RAC 의 선택 상태를 자식에게 넘기지 않아 `isSelected` 조건 노드가 문서 값 (늘 거짓) 으로만 판정됐다 — Menu 항목 (Phase 5g) 과 같은 길로 맞췄다
  - 원본 · 저장 형식 변경 없음 (contract 22 그대로)
  - 위치: `catalog/runtime/domBinding.tsx` (`STATE_FRAME_ITEMS` · `hasSelectionMark`) · `components/styles/ListBox.css`

### Fixed

- **항목에 노드를 넣은 인스턴스를 지우면 Canvas 장면 조립이 실패하던 결함**:
  - 항목 안에 노드를 넣은 Select (등 원본 instance) 를 지우면 Canvas 장면 조립이 `CATALOG_CANVAS_CHILD_REQUIRED` 로 실패했다 (콘솔 오류)
  - **Why**: 지우기 빠른 경로가 지운 문서 노드의 record 만 지우고, 원본 template 이 준 내부 record (Label · Button · ListBox · 항목 …) 는 Canvas · DOM 입력에 남겼다. 평소에는 화면에 닿지 않는 고아 record 라 보이지 않았지만, 작성자가 넣은 노드는 지워져 남은 항목이 없는 자식을 가리켰다
  - 수정: 지운 record 아래의 record 전체를 함께 지운다 (일반 경로와 같은 결과)
  - 위치: `catalog/runtime/compositionRoot.ts` (`planOwnedRemovalOrOrder`)

## [ADR-256 Phase 6e — DatePicker · DateRangePicker 를 노드 트리로 그린다] - 2026-10-09

### Changed

- **DatePicker · DateRangePicker 원본 = react-aria.adobe.com 의 구조** — `DatePicker > Label + Group(DateInput + Button) + Description + FieldError + Popover > Calendar` (DateRangePicker 는 DateInput 쌍 + `RangeCalendar`). 달력은 picker 바로 아래가 아니라 **Popover 노드** 안에 있다 (레퍼런스대로 `hideArrow`, Dialog 없이 — Popover 가 dialog 다). 닫힌 달력은 종전대로 Canvas 에 그리지 않는다
- **DateRangePicker 의 달력이 RangeCalendar 다** — 옛 원본은 Calendar 노드를 두었지만 Preview 는 그 노드를 무시하고 공용 컴포넌트가 자기 RangeCalendar 를 그렸다. 이제 문서의 RangeCalendar 노드가 그대로 열린다
- **Preview 가 picker 의 자식을 순서대로 RAC DatePicker · DateRangePicker 안에서 그린다** — 옛 공용 컴포넌트가 정해진 부품만 받아 조립하던 것을 걷었다. 입력 상자는 Group 노드 자신의 RAC `Group` 이고, RAC 가 그 Group 을 달력의 기준으로 삼아 Popover 를 상자의 시작 가장자리 아래에 연다. 달력 노드는 RAC 의 달력 context (값 · 포커스 · 상태 · `pageBehavior`) 를 받고, picker 의 크기와 `maxVisibleMonths` 로 그려진다. 작성자가 picker 안에 넣은 자유 자식도 제자리에 그려진다
- label 이 없는 picker 에 이름이 생긴다 (`aria-label` — 옛 Preview 는 이름이 없었다) · quiet picker 의 루트에 다른 field 와 같은 `data-quiet` · Label · 도움말 자리에 `presentWhen`
- 시간 granularity 의 picker 가 열린 달력 아래에 따로 붙이던 TimeField 는 레퍼런스에 없어 그리지 않는다 (시간은 입력 상자의 시 · 분 조각으로 고친다. 필요하면 작성자가 Popover 안에 TimeField 노드를 넣는다)
- 저장 형식 contract 22 — 옛 개발용 프로젝트는 열리지 않는다 (ADR-256 Decision 10)
- 위치: `catalog/document/generated/reusableOriginLibrary.ts` · `catalog/runtime/{delegatedDom,domBinding,domRegistry,presence,renderFacetDeclaration}.ts(x)` · `catalog/nesting/nestingRules.ts`

### Removed

- `domBinding` 의 「공용 컴포넌트에 부품을 props 로 넘기는」 경로 (`CATALOG_DOM_CHILD_OWNING_BINDINGS` · 부품 요소 묶음) — 마지막 사용처였던 두 picker 가 노드 트리로 그린다
- **공용 `DatePicker` · `DateRangePicker` 컴포넌트** (`components/DatePicker.tsx` · `DateRangePicker.tsx` · `styles/DatePickerCommon.css`) — catalog 경로에서 쓰이지 않게 됐다 (사용자 승인). `domRegistry` 등록 · `components/{index,list}` export 와 두 컴포넌트만 남았던 glyph 크기 시험 (`triggerIconGlyphSize.test.tsx`) 도 걷었다

## [ADR-256 Phase 6d — ComboBox 를 노드 트리로 그린다] - 2026-10-09

### Changed

- **ComboBox 원본 = react-aria.adobe.com 의 구조** — `ComboBox > Label + Group(Input + Button) + Description + FieldError + Popover > ListBox`. 목록은 ComboBox 바로 아래가 아니라 **Popover 노드** 안에 있다 (레퍼런스대로 `hideArrow`). 닫힌 목록은 종전대로 Canvas 에 그리지 않는다
- **Preview 가 ComboBox 의 자식을 순서대로 RAC ComboBox 안에서 그린다** — 옛 공용 `ComboBox` 컴포넌트가 정해진 부품만 받아 조립하던 것을 걷었다. 입력 상자는 Group 노드 자신의 요소 (RAC `Group` · `.combobox-container`) 이고, RAC 가 그 Group 을 목록의 기준으로 삼아 Popover 를 상자의 시작 가장자리 아래 · 상자 폭으로 연다. 작성자가 ComboBox 안에 넣은 자유 자식도 제자리에 그려진다
- **ComboBox 의 `allowsCustomValue` · `menuTrigger` · `isQuiet` 가 Preview 에 닿는다** — 옛 공용 binding 은 이 셋을 넘기지 않아 Properties 에서 바꿔도 Preview 동작이 그대로였다 (원본 기본값 `allowsCustomValue: true`)
- ComboBox 의 「+」 (항목 넣기) 는 Popover 안 ListBox 에 넣는다 · 항목은 ListBox 안에서만 받는다 · Label · 도움말 자리에 다른 field 와 같은 `presentWhen`
- 저장 형식 contract 21 — 옛 개발용 프로젝트는 열리지 않는다 (ADR-256 Decision 10)
- 위치: `catalog/document/generated/reusableOriginLibrary.ts` · `catalog/runtime/{delegatedDom,domBinding,presence,renderFacetDeclaration}.ts(x)` · `catalog/nesting/{nestingRules,requiredParts}.ts` · `domain/componentTraits.ts` · `catalogRuntime/itemInsert.ts`

### Removed

- **공용 `ComboBox` 컴포넌트** (`components/ComboBox.tsx` · `ComboBoxItem`) — catalog 경로에서 쓰이지 않게 됐다 (사용자 승인). `domRegistry` 등록과 `components/{index,list}` export 도 걷었다
- **`components/listBoxItemSlotContent.tsx`** (+ 시험 `selectPopoverItemSlots`) — 옛 공용 Select · ComboBox 의 항목 행 조립 helper. 두 picker 의 항목은 이제 ListBoxItem 노드가 그린다 (사용자 승인)

## [ADR-256 Phase 6 정리 — SelectTrigger type · 공용 Select 컴포넌트 삭제] - 2026-10-09

### Removed

- **`SelectTrigger` type** (binding · rule · 문서 정의 · 수동 part rule · 중첩 · traits · 어휘 type · 기본 props · Canvas binding) — field 의 입력 상자는 ADR-256 Phase 6b 부터 RAC `Group` 노드라 쓰는 원본이 없었다 (사용자 승인)
- **공용 `Select` 컴포넌트** (`components/Select.tsx`) — Select 는 Phase 6c 부터 노드 트리로 그린다 (사용자 승인). 그것을 쓰던 공용 데이터 `Table` 의 행 수 선택은 RAC `Select` 를 레퍼런스대로 직접 조립한다 (`Button > SelectValue` · `Popover > ListBox`)
- 위치: `catalog/bindings` · `catalog/generated/componentRulesTable.ts` · `catalog/document/{codeCatalogLibrary,manualBoxRules}.ts` · `catalog/nesting/nestingRules.ts` · `domain/componentTraits.ts` · `types/composition-vocabulary.ts` · `catalog/runtime/{domRegistry,renderFacetDeclaration}.ts(x)` · `components/{index,list,Table}.ts(x)` · `builder/catalogRuntime/{canvasBinding,ruleShapes}.ts` · `types/builder/unified.types.ts`

### Tests

- parity `adr248CatalogRealDom` 의 낡은 기대값 3건 (Select trigger 소유 · ComboBox 상자 테두리 위치 · 비활성 Group 흐림 0.38) 을 6a · 6b · 6c 동작에 맞췄다 — 그 sub-phase 에서 이 browser 파일을 돌리지 않아 남아 있던 것

## [ADR-256 Phase 6c — Select 를 노드 트리로 그린다] - 2026-10-09

### Changed

- **Select 원본 = react-aria.adobe.com 의 구조** — `Select > Label + Button(SelectValue + Icon) + Description + FieldError + Popover > ListBox`. 목록은 Select 바로 아래가 아니라 **Popover 노드** 안에 있다 (레퍼런스대로 `hideArrow`). Layers 에 Popover 가 보이고, 닫힌 목록은 종전대로 Canvas 에 그리지 않는다
- **Preview 가 Select 의 자식을 순서대로 RAC Select 안에서 그린다** — 옛 공용 `Select` 컴포넌트가 정해진 부품만 받아 조립하던 것을 걷었다. 작성자가 Select 안에 넣은 아이콘 · frame 같은 자유 자식도 제자리에 그려진다 (다른 field 와 같이). Popover 는 RAC Select 가 주는 자리 (트리거 Button 의 시작 가장자리 아래 · 트리거 폭 이상) 에 열린다. 옛 공용 컴포넌트는 Select 전체 폭에 맞춰 붙였다
- Select 의 「+」 (항목 넣기) 는 Popover 안 ListBox 에 넣는다 · 데이터에 묶인 Select 의 행 템플릿도 Popover 안 첫 항목
- 항목 (`ListBoxItem` · `ListBoxSection`) 은 ListBox 안에서만 받는다 — Select 바로 아래 항목은 RAC 가 collection 으로 그리지 않는다. Popover 밖에 둔 ListBox 는 RAC 가 Select context 로 그리므로 Canvas 도 그린다
- Label · 도움말 자리에 다른 field 와 같은 `presentWhen` (빈 글자면 없음)
- 저장 형식 contract 20 — 옛 개발용 프로젝트는 열리지 않는다 (ADR-256 Decision 10)
- 위치: `catalog/document/generated/reusableOriginLibrary.ts` · `catalog/runtime/{delegatedDom,domBinding,presence}.ts(x)` · `catalog/nesting/{nestingRules,requiredParts}.ts` · `domain/componentTraits.ts` · `catalogRuntime/{itemInsert,rowTemplate}.ts`

## [ADR-256 Phase 6b — 입력 상자 = RAC Group 노드] - 2026-10-09

### Changed

- **NumberField · SearchField · ComboBox · DatePicker · DateRangePicker 의 입력 상자는 RAC `Group` 노드** (react-aria.adobe.com 의 `NumberField > Group > Button + Input + Button` · `DatePicker > Group > DateInput + Button`) — 옛 자체 type `SelectTrigger` 를 대신한다. 상자의 모양 · 배치는 종전대로 field rule 이 주고 (DateRangePicker 는 Group 이 상자를 칠한다), field 의 크기는 Group 을 건너 안의 Input · Button · DateInput 에 닿는다. Canvas 화면은 바뀌지 않는다
- **SearchField 의 상자도 Preview 에서 RAC `Group`** (`div.react-aria-Group.searchfield-container[role=group]`) — RAC SearchField 가 비활성 · 오류 상태를 그 Group 에 넘긴다 (Tailwind starter 의 `FieldGroup` 과 같은 조립)
- 저장 형식 contract 19 — 옛 개발용 프로젝트는 열리지 않는다 (ADR-256 Decision 10)
- 위치: `catalog/document/generated/reusableOriginLibrary.ts` · `domain/componentTraits.ts` (`FIELD_CONTROL_GROUP_HOSTS`) · `catalog/runtime/{delegatedDom,domBinding,presence,compositionRoot}.ts(x)` · `catalog/resolution/resolver.ts` · `catalog/document/{rulePartRules,sizePropagation}.ts` · `catalog/nesting/nestingRules.ts` · `catalog/resolvers/resolveDelegatedChildFontSize.ts` · `catalogRuntime/componentsPage.ts`

## [ADR-256 Phase 6a — RAC Group 이 문서 노드 type] - 2026-10-09

### Added

- **RAC `Group` 을 문서에 둘 수 있다** (react-aria.adobe.com 의 `Group` — 관련 컨트롤을 묶는 `div[role=group]`) — 붙여넣기 · AI 넣기로 놓인 Group 은 Preview 에서 RAC `Group` 으로 그려지고, Design 패널에서 role (group · region · presentation) · 비활성 · 오류 · 읽기 전용을 고른다. 비활성 같은 상태는 RAC 가 Group 에 주고 안의 `showWhen` 노드가 읽는다. 자기 칠은 없다. 팔레트와 「묶기」 는 종전대로 frame 을 만든다 (레이아웃 묶음은 frame — ADR-130). 다음 단계 (6b) 에서 입력 상자 (NumberField · ComboBox · DatePicker 의 `SelectTrigger`) 가 이 Group 이 된다

### Fixed

- Preview 의 Group 이 비활성일 때만 흐려지던 것 (Canvas 는 흐리지 않음) · 늘 `aria-orientation="vertical"` 을 달던 것 (RAC Group 엔 없음) — 옛 layout group 용 수동 CSS (builder 점선 · 이름 badge · 흐림) 를 걷었다
- 위치: `catalog/bindings/Group.binding.ts` · `catalog/componentCatalog.ts` · `catalog/document/codeCatalogLibrary.ts` · `catalog/runtime/domBinding.tsx` · `components/styles/Group.css`

## [ADR-256 Phase 5 판독 수리 (Round 12) — Table · Tree · 하위 메뉴가 깨지는 편집 5건] - 2026-10-09

### Fixed

- **재사용 행 (컴포넌트로 만든 Row) 이 있는 표** — 그 행의 칸은 컴포넌트 쪽에 있어 표 검사가 칸 0개로 읽었다: 열을 넣으면 **모든 행에** 칸이 안 붙고, 열을 지우면 그 행의 칸이 남아 Preview 표가 멈췄다. 이제 그 행의 칸도 세고, 새 열은 그 행에도 칸을 붙이고, 열을 지우면 그 행의 칸을 그 표에서 숨긴다. 그 행의 칸 단독 삭제는 거부, 그 행이 있는 표의 열 순서 바꾸기는 거부 (컴포넌트의 칸 순서는 다른 표와 같이 쓰므로)
- **칸 하나 숨기기 (반응형 표시 · 레이어 눈) 가 표를 멈추던 것** — 숨기기도 표 검사를 거친다 (breakpoint 마다). 칸 하나만 숨기면 거부, **열을 숨기면 각 행의 그 칸도 같이 숨고 다시 보이면 같이 보인다**. 숨긴 열이 있는 표에 행을 넣으면 그 자리 칸도 숨긴 채로 만든다
- **첫 열을 행 이름 열에서 빼면 (`isRowHeader` 끔) 표가 멈추던 것** — 다음 열이 행 이름을 맡는다. 띄워 둔 Preview 에서 첫 열을 지우거나 다른 열의 `isRowHeader` 를 바꿔도 행 이름 열이 따라간다 (다른 열이 다시 그려지지 않아 행 이름 열이 없어지던 것)
- **Tree 의 chevron 버튼을 frame 으로 묶으면** Canvas 에서 잎 항목의 glyph 가 보이고 버튼이 Button 기본 크기 (50) 가 되던 것 — chevron 판정 · 모양이 frame 을 건넌다 (RAC context 와 `Tree.css` 자손 선택자처럼)
- **하위 메뉴 (`SubmenuTrigger`) 의 Popover 를 항목보다 앞에 두면 메뉴 전체가 열리지 않던 것** — Preview 는 항목 · Popover 를 RAC 가 읽는 순서로 넘긴다. Popover 를 아직 넣지 않은 하위 메뉴는 항목만 보통 항목으로 그린다 (전에는 항목이 사라졌다)
- **컴포넌트 행이 있는 표에서 열을 지운 뒤의 편집** (Round 13) — 열 삭제가 그 행의 칸을 숨김으로 남겨, 이어서 열을 넣거나 옮기거나 행을 넣으면 표가 다시 멈추거나 값이 다른 열 아래로 갔다. 이제 열 삭제 · 열 이동은 그 행의 칸을 행의 자기 칸으로 꺼내 실제로 지우고 옮긴다. Design 「Insert Row」 는 컴포넌트 행 옆에서도 보통 행을 만든다 (전에는 컴포넌트의 칸까지 붙어 칸이 남았다)
- 위치: `catalog/commands/{collections,structure,fields}.ts` (`tableAlignedIn` · `tableHidingTargets` · `partChildren` · `dropTableColumnTemplateCells`) · `catalogRuntime/itemInsert.ts` · `catalog/runtime/domBinding.tsx` (`columnIsRowHeader` · 열 형제 구독 · `submenuTriggerChildren`) · `catalog/runtime/presence.ts` · `catalog/resolution/resolver.ts`

## [ADR-256 Phase 5i-3 — Table 의 행은 열마다 칸 하나] - 2026-10-09

### Changed

- **열을 지우면 각 행의 그 자리 칸도 함께 지워진다** (한 번의 실행 · 한 번에 되돌림) — 열을 넣으면 각 행에 칸이 생기는 것과 짝이다. **열을 같은 표 안에서 옮기면 각 행의 칸도 같이 옮겨진다** (RAC 는 칸을 순서로 열과 짝짓는다 — 옛 동작은 열 이름만 옮겨 데이터가 다른 열 아래로 갔다)
- **표의 행이 열 수와 다른 칸을 갖게 되는 편집은 거부한다** — 칸 하나만 지우기 · 행에 칸 더하기 · 칸을 다른 행으로 옮기기 · 붙여넣기. 안내: 「표의 행은 열마다 칸이 하나씩 있어야 합니다」. RAC Table 은 칸 수가 다르면 그리지 못하고 멈춘다 (Preview 오류)
- 위치: `catalog/commands/structure.ts` (`assertTablesAligned` · 열 삭제 연쇄 · 열 이동) · `catalog/commands/collections.ts` (`tableAlignmentIn` · `tableColumnCells` · `tableColumnOrder`) · `catalogRuntime/operationNotice.ts`

## [ADR-256 Phase 5i-2 — Table 의 선택 열 = Checkbox[selection] 노드] - 2026-10-09

### Changed

- **Table 의 선택 열은 작성자가 넣는 노드** (react-aria.adobe.com Table 의 선택 열) — 열 (Column) 안의 `Checkbox[slot=selection]` 은 「모두 선택」, 각 행의 칸 (Cell) 안의 `Checkbox[slot=selection]` 은 그 행의 선택이다. 팔레트 Checkbox 를 열 · 칸에 넣고 Design 의 slot 에서 `selection` 을 고른다. Preview 는 RAC 가 잇는다 — 행 체크박스는 그 행의 이름으로 불리고 누르면 그 행이 선택되며, 「모두 선택」 은 모든 행을 고른다. 선택 열은 행 이름 열이 되지 않는다 (지정 없으면 체크박스 없는 첫 열)
- **Canvas 도 같은 상태로 그린다** — 행 체크박스는 행의 선택을, 「모두 선택」 은 Table 이 다중 선택이고 행이 있을 때만 쓸 수 있게 (RAC 와 같은 조건) 그린다. Table 의 선택 모드를 바꾸면 바로 따라간다. 칸 안 체크박스 자리는 Canvas · Preview 같음 (오차 0)
- 위치: `catalog/runtime/presence.ts` (`catalogTableSelectAllCheckboxes` · 선택 체크박스 판정) · `catalog/document/collectionItems.ts` (Row) · `catalog/runtime/domBinding.tsx` (`columnIsRowHeader`) · `components/styles/Table.css`

## [ADR-256 Phase 5i-1 — Table 이 노드 트리를 그린다] - 2026-10-09

### Fixed

- **Preview 의 Table 이 항상 비어 있던 것** — Preview 는 Table 을 shared 데이터 표 (가상 스크롤) 로 그렸는데, 그 표는 Column · Row · Cell 노드도 데이터 바인딩도 받지 않아 열 · 행을 넣어도 빈 격자 (`aria-rowcount 0`) 였다. 이제 react-aria.adobe.com Table 처럼 RAC `Table > TableHeader > Column` · `TableBody > Row > Cell` 을 노드에서 그린다 — 열 이름 · 행 · 칸 글자가 Preview 에 나오고, Canvas 는 같은 자리에 그린다 (Canvas↔Preview 오차 0). 데이터 바인딩 Table 은 데이터 행 (Canvas 와 같은 투영 행) 을 그린다
- **Table 에 행을 넣을 수 없던 것** — Design 의 「Insert Row」 가 TableView 에만 있었다. 이제 Table 의 body 도 행 (열 수만큼 칸) 을 받는다. 데이터 바인딩 Table 은 행이 데이터의 것이라 받지 않는다

### Changed

- **Column 의 `isRowHeader` (행 이름 열)** — RAC · RSP 의 prop. 그 열의 칸이 행의 이름이 된다. 지정한 열이 없으면 첫 열이 행 이름이다 (RAC 는 행 이름 열이 없으면 동작하지 않는다)
- **고정 높이 (`heightMode` fixed · `height`)** 는 노드 표에도 그대로 — 높이는 테두리 안쪽, 넘치면 스크롤
- 위치: `catalog/runtime/domRegistry.tsx` (`CatalogTable` · RAC 표 부품) · `domBinding.tsx` (`columnIsRowHeader`) · `catalog/commands/collections.ts` (`TABLE_OWNERS`) · `components/styles/Table.css` (`[data-node-table]`) · `catalog/bindings/Column.binding.ts`

## [ADR-256 Phase 5h-2 — Tree 선택 체크박스 = Checkbox[selection] 노드 · Preview 선택] - 2026-10-09

### Fixed

- **Preview 의 Tree 에서 항목을 선택할 수 없던 것** — DOM renderer 가 선택을 빈 값으로 고정 (`selectedKeys: []`) 해 행 · 체크박스를 눌러도 선택이 바뀌지 않았다. 이제 GridList 처럼 Preview 실행 상태로 선택된다 (문서에 쓰지 않음)
- **Tree 의 「선택 표시 방식」 (`selectionStyle`) 이 Preview 에 닿지 않던 것** — renderer 가 값을 넘기지 않아 checkbox 를 골라도 항상 highlight 동작 (행 누르기가 선택을 바꿈) 이었다. 이제 checkbox 는 행 누르기가 선택을 더하고 빼며 (RAC `toggle`), highlight 는 바꾼다 (`replace`)

### Changed

- **Tree 항목의 선택 체크박스 = 작성자의 `Checkbox[slot=selection]` 노드** (react-aria.adobe.com Tree 의 `<Checkbox slot="selection" />`) — 항목의 `TreeItemContent` 안에 넣고 Design 의 slot 에서 `selection` 을 고른다. RAC 가 항목의 선택 · 이름에 잇는다 (체크박스를 누르면 그 행이 선택된다). 항목이 스스로 체크박스를 붙이지 않는다. Canvas 는 같은 자리에 그리고 항목이 선택될 수 없으면 (Tree 의 선택 모드 none) 비활성으로 그린다 — Tree 를 고치면 바로 따라간다
- 위치: `catalog/runtime/presence.ts` (`catalogSelectionCheckboxes` — 행 내용 안까지) · `catalog/runtime/delegatedDom.tsx` `tree`

## [ADR-256 Phase 5h-1 — Tree 항목 = TreeItemContent 층 · chevron 은 Button[slot=chevron]] - 2026-10-09

### Changed

- **Tree 항목의 노드 구조가 react-aria.adobe.com Tree 와 같아졌다** — `TreeItem > TreeItemContent > Button[slot=chevron] > Icon + 글자`, 하위 항목은 `TreeItemContent` 다음에 둔다. 새 요소 `TreeItemContent` (항목의 행 내용 — RAC `TreeItemContent`, 자기 DOM 요소 없음) 는 자유 내용을 받는다. chevron 은 RAC 가 항목의 펼치기 버튼 속성 (이름 「펼치기 · 접기」 · 탭 순서 제외) 을 주는 일반 Button 노드이고, 그 안의 Icon 이 glyph 다 — 작성자가 지우거나 바꿀 수 있다. 종전의 `TreeItemChevron` 노드와 shared Tree 가 붙이던 chevron · 정보 버튼은 이 구조에서 쓰지 않는다
- **Preview 의 chevron 버튼은 레퍼런스처럼 RAC Button 그대로** — `Tree.css` 가 모양을 정한다 (채운 버튼 칠 `.button-base` · Button 상자 값 inline 없음). glyph 는 행 글자색을 따르므로 선택 · 비활성 행에서 함께 바뀐다
- **Canvas 는 같은 자리에 같은 모양으로** — 버튼 상자 · 글자 위치는 종전과 같다 (Canvas↔Preview 오차 0). 하위 항목이 없는 항목의 glyph 는 숨고 (`visibility: hidden`), 펼친 항목의 glyph 는 돌아간 모양 (`chevron-down`) 으로 그린다. glyph 색은 항목 글자색 (Preview 와 같음 — 종전 Canvas 는 옅은 회색)
- 위치: `catalog/bindings/TreeItemContent.binding.ts` · `catalog/runtime/presence.ts` (`catalogTreeChevronButtonItem` · `catalogTreeChevronGlyphItem`) · `catalog/document/manualBoxRules.ts` TreeItem · `catalog/runtime/delegatedDom.tsx` `treeItemElements` · `domBinding.tsx` (`treeitemcontent` · chevron Button) · `components/styles/Tree.css`
- **저장 형식 contract 18**

## [ADR-256 Phase 5g-2 — Menu 의 하위 메뉴 = SubmenuTrigger 노드] - 2026-10-09

### Added

- **새 요소 `SubmenuTrigger` (하위 메뉴)** — react-aria.adobe.com Menu 예제의 `SubmenuTrigger > MenuItem + Popover > Menu`. Menu (또는 MenuSection) 안에 두고, 첫 자식 MenuItem 이 하위 메뉴를 여는 항목, 둘째 자식 Popover 안의 Menu 가 하위 메뉴다. Preview 는 RAC `SubmenuTrigger` 로 그린다 — 항목을 누르거나 오른쪽 화살표로 열고, RAC 가 하위 메뉴를 그 항목 이름으로 부르며 항목 오른쪽 (`end top`) 에 놓는다. Canvas 는 종전처럼 Menu 의 버튼만 그린다 (하위 메뉴는 닫힌 팝오버 안)

### Changed

- **Menu 항목 원본에 하위 메뉴 표시 (chevron) 노드** — 「하위 메뉴가 있을 때만」 (`showWhen hasSubmenu`) 보이는 오른쪽 화살표 아이콘. 하위 메뉴가 없는 항목에는 보이지 않는다 (기본 Menu 화면 변화 없음)
- **Popover 안의 Menu 가 하위 메뉴일 때는 RAC Menu 만 그린다** (트리거 버튼 없이) · 하위 메뉴 Popover 는 Popover 의 기본 자리 (`bottom`) 가 아니라 RAC 가 정하는 자리를 쓴다
- 위치: `catalog/bindings/SubmenuTrigger.binding.ts` · `domain/componentTraits.ts` · `catalog/runtime/delegatedDom.tsx` `menu` · `domBinding.tsx` `submenutrigger`
- **저장 형식 contract 17**

## [ADR-256 Phase 5g-1 — Menu 항목의 단축키 = Keyboard 노드 · 선택 표시 노드] - 2026-10-09

### Added

- **새 요소 `Keyboard` (키보드 단축키)** — 팔레트 content 에서 꺼내 Menu 항목 안에 넣는다 (react-aria.adobe.com Menu 예제: `MenuItem > Text[label] + Text[description] + Keyboard`). Preview 는 RAC `Keyboard` (`<kbd>`) 로 그리고, Menu 항목 안에서는 RAC 가 그 단축키로 항목을 설명한다 (`aria-describedby`). 모양은 레퍼런스 `Menu.css` 의 `kbd` — 한 단계 작은 글자 · 옅은 배경 · 테두리 · 작은 모서리 (`COMPONENT_RULES_TABLE.Keyboard`)

### Changed

- **Menu 항목 원본의 단축키는 Keyboard 노드** — 종전 `Text[slot=shortcut]` 은 RAC 가 주지 않는 slot 이름이라 항목과 이어지지 않는 글자였다. 단축키 글자가 비면 그리지 않는다 (`presentWhen`). 기본 Menu 의 항목은 단축키를 끈 채라 화면 변화 없음
- **Menu 항목 안 요소가 항목의 상태를 읽는다** (`showWhen` — 레퍼런스의 선택 Check / Dot): 항목 안에 아이콘을 넣고 「선택됐을 때만」 으로 두면 RAC 의 선택 상태로 보이고 숨는다. 그런 항목에서는 Menu 시트의 선택 글리프 (✓ / ●) 가 비킨다 — 두 표시가 겹치지 않는다. 표시 노드가 없는 항목은 종전 글리프 그대로
- 위치: `catalog/bindings/Keyboard.binding.ts` · `catalog/runtime/domRegistry.tsx` · `domBinding.tsx` `STATE_FRAME_ITEMS` · `hasSelectionMark` · `components/styles/Menu.css`
- **저장 형식 contract 16**

## [ADR-256 Phase 5f — GridList 항목의 선택 체크박스 노드] - 2026-10-09

### Changed

- **GridList 항목의 선택 체크박스는 작성자가 넣는 `Checkbox slot="selection"` 노드** (ADR-256 Phase 5f — react-aria.adobe.com GridList 예제)
  - Preview 의 항목은 더 이상 다중 선택일 때 체크박스를 스스로 붙이지 않는다. 항목 안에 Checkbox 를 넣고 Design 의 slot 을 `selection` 으로 고르면, RAC 가 그 체크박스를 항목 선택에 잇는다 (누르면 행 선택 · 이름은 행).
  - Canvas 도 같은 노드를 그린다 — 선택 상태는 항목의 것을 따르고, 선택하지 않는 목록 (`selectionMode` none) 에서는 비활성으로 그린다.
  - 위치: `catalog/runtime/delegatedDom.tsx` `checkbox` · `catalog/runtime/racSlotScope.tsx` · `presence.ts` `catalogSelectionCheckboxItem` · `components/GridList.tsx`
- **Checkbox 가 `slot` 을 받는다**, Checkbox 의 빈 글자는 그리지 않는다 (`presentWhen`) — 레퍼런스의 `<Checkbox slot="selection" />` 에는 글자가 없다
- **GridList 행의 접근 이름은 항목의 글자 Text** (`textValue`)
- **저장 형식 contract 15**

### Fixed

- **instance 안 collection 항목 (GridList · ListBox · Menu · Tag 항목 …) 에 요소를 넣으면 항목 내용이 사라지던 것**
  - 항목 type 이 원본 이름으로 바뀌고 Preview 는 항목을 그리지 않았다.
  - **Why**: 넣기가 항목 위치 자체를 자식 목록으로 채워, resolver 가 항목이 접혀 들어가는 원본 root (와 그 label · description) 를 통째로 바꿔 끼웠다. 이제 항목 위치의 자식 목록은 그 root 의 자식이다 — 넣을 때 root 의 template 자식을 위치의 값으로 꺼내고 (`commands/context.ts` `listParent` · `materialize.ts` `positionBindings`), 새 요소는 그 사이 원하는 자리에 놓인다

## [ADR-256 Phase 5e-2 — Tabs 안 자유 내용] - 2026-10-09

### Changed

- **Tabs 가 자식을 순서대로 그린다** (ADR-256 Phase 5e — react-aria.adobe.com Tabs 예제): Tabs · TabPanels 안에 아무 요소나 넣을 수 있고 (TabList 를 frame 으로 감싸 옆에 버튼 두기 — 예제 8), Preview 는 레퍼런스 구조 (`TabPanels` 요소 포함) 로 그린다. TabList 의 접근 이름은 그 노드의 `aria-label`. 위치: `catalog/runtime/delegatedDom.tsx` `tabs` · `tablist` · `tabpanels` · `tabpanel`

### Fixed

- **Tabs 안 TabList 를 frame 으로 묶기 (Group) 가 거부되던 것**
  - **Why**: Group 명령이 새 frame 을 부모에 놓기 전에 자식 중첩을 검사해, TabList 가 조상 Tabs 를 찾지 못했다
- **분리 (detach) 한 Tabs 의 Preview 에 패널이 안 나오던 것**
  - **Why**: Builder 가 붙이는 자동 HTML id 가 RAC 의 항목 키 (`id`) 를 바꿔 Tab 과 TabPanel 의 짝이 어긋났다. collection 항목 · TabPanel 은 RAC 가 요소 id 를 직접 쓰므로 키를 그대로 둔다
- **분리한 Tabs 에서 두 Tab 모두 선택 막대가 보이던 것 (Canvas)** — 선택 판정이 Tabs 의 선택보다 원본에서 따라온 Selected 상태를 먼저 읽었다

## [ADR-256 Phase 5e-1 — Tab 선택 막대 = SelectionIndicator 노드] - 2026-10-09

### Changed

- **선택된 Tab 의 막대가 Tab 원본의 `SelectionIndicator` 노드** (ADR-256 Phase 5e — react-aria.adobe.com Tabs 예제): RAC 가 선택된 Tab 에만 두고 선택이 바뀌면 옮긴다. Canvas 도 같은 노드를 선택된 Tab 에만 그린다 (세로 목록은 오른쪽 가장자리). 막대는 노드라 고르거나 지울 수 있다. 위치: Tab 원본 template · `catalog/bindings/SelectionIndicator.binding.ts` · `manualBoxRules.ts` Tab
- **Tab 글자 Text 의 slot 이름 `label` 을 없앴다** — Tab 은 Text slot 을 주지 않는다
- **저장 형식 contract 14**

### Fixed

- **sm · lg Tab 의 Canvas 선택 막대 두께** — Canvas 는 2 · 4px, Preview 는 3px 이었다. 둘 다 3px (`TabsIndicator.css`)

### Removed

- Tab 의 Canvas `tab_indicator` primitive (노드가 대신한다)

## [ADR-256 Phase 5d — TagGroup 지우기 버튼 · 설명 · 오류 노드] - 2026-10-09

### Changed

- **TagGroup 의 각 Tag 에 지우기 버튼 노드** (ADR-256 Phase 5d — react-aria.adobe.com TagGroup 예제): `allowsRemoving` 을 켜면 Tag 마다 `Button[slot=remove]` (x 아이콘) 가 Canvas · Preview 에 같은 자리로 생긴다. 버튼은 Tag 원본의 노드라 모양을 고칠 수 있고, Preview 에서 누르면 그 tag 가 실행 중 목록에서 빠진다 (문서는 그대로). 위치: Tag 원본 template · `catalog/runtime/domBinding.tsx` (Tag state frame) · `components/TagGroup.tsx`
- **TagGroup 의 설명 · 오류 글자가 부품 노드** — Description · FieldError 원본 instance, 글자가 있을 때만 있다. 오류는 레퍼런스처럼 `Text[slot=errorMessage]`
- **Tag 글자 Text 의 slot 이름 `label` 을 없앴다** — 레퍼런스의 Tag 는 그냥 글자. Tag 의 접근 이름은 그 글자 (`aria-label`)
- **저장 형식 contract 13**

### Fixed

- **`allowsRemoving` 을 켜도 지우기 X 가 Canvas · Preview 어디에도 없던 것**
  - **Why**: Canvas 는 Tag rule `trailingIcon` 이 Tag 자신의 `allowsRemoving` prop 을 읽었는데 catalog 문서의 Tag 는 그 값을 갖지 않았고, Preview 는 RAC TagGroup 에 `onRemove` 를 넘기지 않아 RAC 가 버튼을 숨겼다
  - 수리: 버튼을 노드로 두고 Tag 의 상태 (TagGroup 값) 로 보인다 · Preview 는 작성 tag 의 `onRemove` 를 실행 상태로 가진다

## [ADR-256 Phase 5c — ListBox · GridList · Menu 항목의 빈 설명] - 2026-10-09

### Changed

- **항목 설명을 비우면 설명 자리가 없어진다** (ADR-256 Decision 7): ListBox · GridList · Menu 항목의 description 글자가 비면 Canvas · Preview 둘 다 그 자리를 그리지 않는다 (전에는 빈 줄을 남겼다). ListBox 구조는 레퍼런스 예제 1 과 같음을 고정했다
- **저장 형식 contract 12**

## [ADR-256 Phase 5b — ColorSwatchPicker 항목 층] - 2026-10-09

### Changed

- **ColorSwatchPicker 는 `ColorSwatchPickerItem (색) > ColorSwatch`** (ADR-256 — react-aria.adobe.com ColorSwatchPicker 예제): 항목이 노드가 되고 그 색이 안의 ColorSwatch 에 RAC 로 전달된다. 항목 안에 다른 요소를 넣을 수 있고, 「+」 는 쓰지 않은 색의 항목을 swatch 와 함께 만든다. 위치: `catalog/runtime/delegatedDom.tsx` `colorswatchpicker` · `colorswatchpickeritem`
- **저장 형식 contract 11**

### Fixed

- **Preview 의 ColorSwatch 테두리가 빠지던 것** — 원본의 `borderWidth: "1px"` 를 숫자로 읽어 NaN 이었다 (Canvas 는 그렸다)

## [ADR-256 Phase 5a — Breadcrumbs 를 레퍼런스 구조로] - 2026-10-09

### Changed

- **Breadcrumb 은 `Breadcrumb > Link + 구분 Icon`** (ADR-256 — react-aria.adobe.com Breadcrumbs 예제): crumb 의 글자가 RAC `Link` 노드가 되고 (주소는 crumb 의 `href`), 구분 Icon 은 현재 crumb 이 아닐 때만 보인다 (Show when `not isCurrent`). crumb 안에 아이콘 같은 자유 자식을 넣을 수 있다. 화면은 그대로다 (Canvas 는 변경 전과 픽셀이 같다). 조건 없이 직접 넣은 구분 Icon 은 마지막 crumb 에서도 보인다 (조건으로 정한다). 위치: `catalog/runtime/delegatedDom.tsx` `breadcrumb`
- **저장 형식 contract 10**: 옛 contract 문서는 열지 않는다 (ADR-256 Decision 10)

## [ADR-256 Phase 4 — 상태별 표시 (Show when)] - 2026-10-08

### Added

- **노드의 표시 조건 「Show when」** (ADR-256 Decision 7 — react-aria.adobe.com 예제의 render props 조건부 표시): Design 패널에서 노드가 어느 상태에서 보이는지 정한다 — 조건 3개까지, 각 조건은 조상 부품이 주는 상태 키 (`isSelected` · `isIndeterminate` · `isExpanded` · `isDisabled` · `isInvalid` · `isPressed` … 15개) 의 참 / 거짓, 그 상태를 읽을 부품은 가장 가까운 것 또는 특정 조상. 예: Checkbox 버튼 안 체크 Icon = `isSelected` 이고 `isIndeterminate` 아님, 가로선 Icon = `isIndeterminate`. Preview 는 RAC 의 실제 상태 (클릭 · 키보드) 로, Canvas 는 그 부품의 값 (props · 상태 칸) 으로 판정한다. 위치: `catalog/runtime/presence.ts` `catalogShowWhenHolds` · `stateFrames.tsx`, `panels/properties/catalog/CatalogShowWhenSection.tsx`
- 특정 조상을 가리키는 조건은 그 연결을 끊는 편집 (밖으로 옮기기 · 붙여넣기 · 주인 ungroup) 을 막는다. 복제 · 붙여넣기 사본은 사본 안의 부품을 가리키고, detach 는 원본 위치를 새 노드로 바꾼다

## [ADR-256 Phase 3 판독 수리 — toggle 안의 layout frame] - 2026-10-08

### Fixed

- **toggle 안에 넣은 frame 이 toggle 을 깨던 것** (ADR-256 Phase 3 판독 Round 8): Checkbox · Switch · Radio 버튼 안의 indicator 를 frame 으로 감싸면 Preview 가 indicator 를 그리지 않고 Canvas 는 0×0 으로 그렸다 · 버튼을 frame 으로 감싸면 Canvas 가 indicator 칠의 주인을 frame 으로 잡았다 · 버튼 글자를 frame 으로 감싸면 글자가 RAC `Label` 로 돌아가 그룹 이름의 id 를 가져갔다 (단독 Checkbox 는 label 안 label) · 그룹 항목을 frame 으로 감싸면 그 항목이 처음 선택값에서 빠졌다. 이제 frame 은 레퍼런스의 `div` 처럼 지나간다. 위치: `catalog/runtime/delegatedDom.tsx` `toggleButton` · `groupItems`, `domBinding.tsx`, `canvasBinding.ts` `ownerDrawnPart`, `resolver.ts` `applyTypedRules`

## [ADR-256 Phase 3c — 그룹 · ToggleButtonGroup 이 자식을 순서대로] - 2026-10-08

### Changed

- **CheckboxGroup · RadioGroup 은 RAC `CheckboxGroup` / `RadioGroup` 안에 자식 노드를 순서대로 그린다** (ADR-256 Decision 2 · 3 — react-aria.adobe.com CheckboxGroup · RadioGroup 예제): Label · 항목 묶음 (`div.checkbox-items` / `div.radio-items` — 이제 묶음 노드 자신의 요소) · Description · FieldError 와 작성자가 넣은 자유 자식. ToggleButtonGroup 도 자식을 순서대로 그린다. 세 그룹 모두 다른 요소를 넣을 수 있다 (전에는 중첩 규칙이 막았다 — Preview 가 그리지 않아서). 화면은 그대로다 (Canvas 는 변경 전과 픽셀이 같다). 위치: `catalog/runtime/delegatedDom.tsx` `checkboxgroup` · `radiogroup` · `checkboxitems` · `radioitems` · `togglebuttongroup`
- **저장 형식 contract 9**: 옛 contract 문서는 열지 않는다 (ADR-256 Decision 10)

### Fixed

- **label 이 빈 CheckboxGroup · RadioGroup 의 Canvas 가 빈 Label 자리를 그리던 것**: Preview 는 그리지 않았다 — 이제 같다 (`presentWhen`, Description 도 같음)

## [ADR-256 Phase 3b — Switch · Radio 를 레퍼런스 구조로] - 2026-10-08

### Changed

- **Switch 는 `SwitchField > SwitchButton (track + 글자) + Description + FieldError`, Radio 는 `RadioField > RadioButton (고리 + 글자) + Description`** (ADR-256 Decision 3 — react-aria.adobe.com Switch · RadioGroup 예제): Preview 는 자식 노드를 순서대로 그린다 — 종전 Switch 는 자식 노드를 그리지 않고 글자만 썼고, Radio 의 고리는 `::before` 였다 (이제 `div.indicator` 요소). Layers 에 `SwitchButton` · `RadioButton` 이 보이고 그 안에 자유 자식을 넣을 수 있다 (버튼은 지울 수 없다). 화면은 그대로다 (Canvas 는 변경 전과 픽셀이 같다). Switch · Radio 에 Description, Switch 에 Error Message 가 생겼다. 위치: `catalog/runtime/delegatedDom.tsx` `switch` · `radio` · `toggleButton`, `components/styles/Radio.css`

### Fixed

- **RadioGroup 항목 글자가 그룹 이름의 id 를 같이 갖던 것**: Checkbox (3a) 와 같은 수리 — 이제 그룹 Label 하나만 그 id 를 갖는다

## [ADR-256 Phase 3a — Checkbox 를 레퍼런스 구조로] - 2026-10-08

### Changed

- **Checkbox 는 `CheckboxField > CheckboxButton (indicator + 글자) + Description + FieldError`** (ADR-256 Decision 3 — react-aria.adobe.com Checkbox 예제): Preview 는 RAC `CheckboxField` (`div`) 안에 누르는 자리 `CheckboxButton` (`label`) 을 그리고, 그 안에 indicator 와 글자를 자식 순서대로 그린다. Layers 에 `CheckboxButton` 이 보이고, 그 안에 아이콘 같은 자유 자식을 넣을 수 있다 (버튼은 지울 수 없다 — RAC 가 필요로 하는 부품). 화면은 그대로다 (Canvas 는 변경 전과 픽셀이 같다). 위치: `catalog/runtime/delegatedDom.tsx` `checkbox` · `checkboxbutton`, `componentRulesTable.ts` Checkbox
- **Checkbox 에 Description · Error Message**: Properties 에서 도움말과 오류 문구를 쓸 수 있다 — 도움말은 비어 있으면 없고, 오류 문구는 Invalid 일 때 보인다 (Canvas · Preview 같음)

### Fixed

- **CheckboxGroup 항목 글자가 그룹 이름의 id 를 같이 갖던 것**: 항목 글자가 RAC `Label` 로 그려져 그룹의 label context (id) 를 받았다 — 그룹의 `aria-labelledby` 가 같은 id 의 요소 셋을 가리켰다. 이제 그룹 Label 하나만 그 id 를 갖는다
- **단독 Checkbox 의 글자가 `label` 안의 `label` 이던 것**: 이제 버튼 안의 `span` 이다

## [ADR-256 Phase 2 — field 가 노드 트리를 그린다] - 2026-10-08

### Changed

- **field 7종 (TextField · TextArea · NumberField · SearchField · ColorField · DateField · TimeField) 이 노드 트리를 그린다** (ADR-256 Decision 2): Preview 는 RAC field 안에 자식 노드를 순서대로 그린다 — Label · Input · Description · FieldError 와 작성자가 넣은 자유 자식 (아이콘 등, 레퍼런스의 field 안 아이콘). 이제 field 에 다른 요소를 넣을 수 있다 (전에는 중첩 규칙이 막았다 — Preview 가 그리지 않아서). 기존 DOM 구조는 그대로다. 위치: `catalog/runtime/delegatedDom.tsx` `nodeTreeField`
- **빈 label · description 의 부품은 없다 — 값 조건 `presentWhen`** (Decision 7): field 의 Label · Description 은 최종 글자가 빈 문자열일 때만 없다 (`0` · `false` · 공백은 남는다). Canvas 도 이제 빈 label 의 Label 자리를 그리지 않는다 (Preview 와 같다). 바인딩만으로는 노드가 사라지지 않는다 — FieldError 는 빈 문구여도 RAC 의 검증 메시지를 보인다. 위치: `catalog/runtime/presence.ts` `catalogAbsentByValue`
- **저장 형식 contract 8**: 옛 contract 문서는 열지 않는다 (ADR-256 Decision 10)

### Removed

- **shared field 컴포넌트 6개** (`TextField` · `TextArea` · `NumberField` · `SearchField` · `DateField` · `TimeField` — `@composition/shared` components export): Preview 가 field 를 노드 트리로 그리면서 쓰는 곳이 없어졌다. Builder UI 의 입력은 RAC 를 직접 쓴다. `ColorField` 는 `ColorPicker` 가 써서 남는다

### Fixed (2026-10-08 Phase 2 판독 수리)

- **field 안에 Frame 을 넣고 부품을 옮기면 입력이 망가지던 것**: DateField · TimeField 의 날짜 칸이 사라지고, TextArea 가 한 줄 입력이 되고, NumberField · SearchField 의 입력 상자를 Frame 에 넣으면 Preview 가 오류로 멈췄다. 이제 Frame 은 부품과 field 사이를 끊지 않는다 — Preview 는 같은 RAC 입력을, Canvas 는 같은 값 (날짜 형식 · quiet · 필수 표시) 을 그린다. 위치: `catalog/runtime/presence.ts` `catalogPartParent`
- **label 을 바꿔도 Canvas 의 Label 이 숨김 그대로이던 것**: 비어 있던 label 을 채워도 Canvas 는 Label 을 숨겼고, 비우면 빈 자리가 남았다 (프로젝트 변수로 바뀌는 label 도). 이제 값이 바뀔 때마다 Preview 와 같이 따라간다. 위치: `catalog/runtime/compositionRoot.ts`
- **Description 에 직접 쓴 글자가 Canvas 에 안 보이던 것**: field 의 description 값이 비어 있으면 Description 노드에 글자를 써도 Canvas 가 숨겼다 (Preview 는 보였다). 위치: `catalog/runtime/presence.ts` `catalogFieldHintShown`

## [ADR-256 Phase 1 — 넣을 수 있는가를 하나로 판정] - 2026-10-07

### Changed

- **컴포넌트가 동작하는 데 필요한 부품은 지우거나 밖으로 옮길 수 없다** (ADR-256 Decision 5 — 설치 RAC 에서 빠지면 역할이 사라지는 부품): Select 의 Button · ListBox, ComboBox 의 Input, field 의 Input · DateInput, Slider 의 SliderTrack · SliderThumb, Calendar 의 CalendarGrid, Disclosure 의 header, Tabs 의 TabList, TagGroup 의 TagList, DialogTrigger · TooltipTrigger 의 trigger 와 overlay, Table 의 TableHeader. 그 부품을 감싼 Frame 삭제도 거부하고, 소유자 안에서의 재배치 · 소유자 통째 삭제 · 옆에 같은 type 이 하나 더 있을 때 (교체 중) 는 허용한다. 거부하면 「컴포넌트가 동작하는 데 필요한 부품」 안내가 뜬다. Properties 「RAC slot」 은 필수 부품에 Detach 를 내지 않는다. 위치: `catalog/nesting/requiredParts.ts` · `commands/structure.ts`

- **이름 붙은 자리 (RAC `slot`) 가 RAC 에 닿는다** (ADR-256 Decision 4): Text 는 이제 Preview 에서 RAC `Text` 로 그려진다 — ListBoxItem 의 label Text 가 option 의 이름 (`aria-labelledby`) 이 되고 description 이 설명이 된다 (전에는 plain span 이라 option 의 label id 가 없는 요소를 가리켰다). Text · Description · Heading · Button 은 렌더 시점의 RAC context 로 slot 을 판정한다 — 제공자의 이름이면 그대로, 미지정이면 RAC 기본 slot, 일반 context 면 그대로, 제공자에 없는 이름 (MenuItem 의 `shortcut` · Tag 의 `label`) 은 RAC 가 throw 하는 대신 연결 없이 그린다. 위치: `catalog/runtime/racSlot.ts` · `domBinding.tsx` `RacSlotScope`
- **Properties 의 「RAC slot」 섹션**: Text · Heading · Button · DateInput 을 선택하면 가장 가까운 제공자의 slot 이름 · Default · Detach (`slot={null}`) 를 고른다. 제공자에 없는 이름은 「Not connected」. 제공자 표는 설치 RAC 를 마운트한 결과에서 생성한다 (`generated/racSlotProviders.ts` — `adr256-gen-rac-slots.mjs`, drift 게이트 테스트). 문서의 slot 값 타입 `slot` 이 미지정 · 이름 · 명시 해제 (`false`) 를 구분한다

- **Properties 의 Slot 「Fill slot」 목록이 자리의 children 종류를 따른다** (ADR-256 Decision 4): 항목만 받는 자리 (RAC collection — TabList · TagList · TableHeader · ListBox …) 는 그 항목만 (Tabs › TabList = `Tab`), 자유 내용 자리 (Toolbar · Form · Dialog …) 는 기본 원본 (Button · Heading · Checkbox …) · Text · Icon · Image · Separator · Frame · 프로젝트 컴포넌트를 보인다. 목록의 모든 항목은 실제 넣기와 같은 중첩 검사를 통과한 것만이다 — 전에는 모든 slot 에 같은 5종을 보였고 Tabs · Table · CheckboxGroup · RadioGroup · TagGroup 은 그 5종을 하나도 받지 않았다. 위치: `catalogRuntime/slots.ts` `catalogSlotInsertOptions`
- **원본 루트에 걸린 slot 을 instance 에서 채운다** (ListBox · GridList · Toolbar · Form · AvatarGroup · Breadcrumbs · Nav · DisclosureGroup · CardView · ToggleButtonGroup · ButtonGroup · Tree): 놓은 instance 를 선택하면 Slot 섹션이 나온다 (`catalogSlotTarget`)
- **중첩 판정**: 타입 특성 표의 `children` 열은 RAC 가 항목만 받는 부품의 항목 목록이 됐다 (설치 RAC 1.21.0 을 마운트해 확인 — ADR-256 G0). 우리 Preview renderer 가 아직 노드 순서대로 그리지 못하는 부품의 제한은 `UNCONVERTED_FAMILY_LIMITS` (옛 `SELF_COMPOSED_CONTAINER_CHILD_TYPES`) 로 옮겼다 — family 가 전환되면 행을 지운다. ListBoxSection · MenuSection · GridListSection 에는 이제 레이아웃 래퍼를 넣을 수 없다 (RAC 가 버린다). instance 자리 검증 (`fillSlot`) 도 같은 판정 — 자식을 받는 부품이면 채울 수 있다

### Fixed (2026-10-08 Phase 1 판독 수리)

- **Preview 의 Text · Heading · Description · Button 이 상태 값 (hover 색 등) 을 가지면 자기 폭 · 글꼴 크기를 잃던 것**: RAC slot 판정 scope 가 상태 변수만으로 요소의 style 을 덮어썼다. 이제 둘이 합쳐진다. 위치: `domBinding.tsx` `overScopeProps`
- **필수 부품 거부가 빠지던 경로**: detach 한 Slider 의 SliderThumb (track 안) 삭제, ComboBox 의 control wrapper 숨김, 필수 부품을 같은 type 의 다른 컴포넌트로 옮기기, 같은 부품 둘을 한 번에 삭제, 필수 부품 자체의 Ungroup, 속성 붙여넣기로 필수 trigger 에 `slot = false` 쓰기, 사용자 컴포넌트로 만든 ComboBox 의 control wrapper 숨김. 판정을 명령 결과 (소유자가 명령 뒤에도 그 부품을 갖는가 — instance 는 아직 보이는 template 부품까지 센다) 로 바꿨다. Select 에 더 넣은 Button 을 다른 Select 로 옮기는 것처럼 원래 부품이 남는 편집은 허용한다. 위치: `commands/structure.ts` · `commands/fields.ts`

## [Disclosure header — chevron 과 제목을 노드로] - 2026-10-07

### Changed

- **Disclosure 의 header 가 chevron · 제목을 자식 노드로 갖는다** (Checkbox · Switch 의 indicator, TreeItem 의 chevron 과 같은 방식 — react-aria.adobe.com Disclosure 의 trigger `<ChevronRight />` · `<span>{children}</span>`): template 은 `DisclosureHeader > DisclosureChevron + Text({title})`. Layers 에 두 노드가 보이고, chevron 은 삭제할 수 없다 (부모가 그리는 part). chevron 의 모양은 DisclosureHeader rule 의 `leadingIcon` 이 정본이고, Preview 는 제목 Text 를 trigger 안의 `span.react-aria-Text` 로 그린다. 위치: `reusableOriginLibrary.ts` · `bindings/DisclosureChevron.binding.ts` · `rulePartRules.ts` · `delegatedDom.tsx`

### Fixed

- **Canvas 의 Disclosure chevron · 제목이 DOM 보다 22px 오른쪽에 그려지던 것**: header 의 chevron 자리 inset (34) 과 rule 의 leading icon 밀기가 겹쳐 chevron 중심 43 · 제목 56 이었다 (DOM 21 · 34). 이제 chevron 상자 x 12 · 18×18, 제목 x 34 로 DOM 과 같다. 노드가 없는 옛 header 도 같은 자리에 그린다.
- **Canvas 의 Disclosure chevron 이 펼침과 상관없이 → 방향이던 것**: header 가 Disclosure (DisclosureGroup 안이면 그룹의 펼침 값) 의 펼침 상태를 파생 값으로 받아 DOM 처럼 돌아간다. 위치: `catalog/runtime/presence.ts`
- **DisclosureGroup 의 섹션 제목**: template 이 섹션 제목을 header 의 글자에 덮어써 Preview 는 「Section Title」 을 보였다. 이제 각 Disclosure 의 `title` 이 「Section 1」 · 「Section 2」 다.

## [날짜 field · ColorField 레퍼런스 정렬] - 2026-10-07

### Added

- **날짜 계열 6종의 `locale` · `calendarSystem` 선택** (react-aria.adobe.com Calendar 「International calendars」): Calendar · RangeCalendar · DateField · DatePicker · DateRangePicker 에 Locale (React Aria 번역 언어 36개 + 「Browser default」) 과 Calendar (gregory · buddhist · japanese 등 13 + 「Locale default」), TimeField 에 Locale. 비우면 브라우저 locale. 위치: `packages/shared/src/catalog/bindings/dateLocaleProps.ts`

### Breaking Changes

- **DateRangePicker 의 `isQuiet` prop 제거** — S2 DateRangePicker 에는 없다 (react-spectrum.adobe.com 레퍼런스). Properties 에서 사라지고 rule 의 quiet 선언 · Canvas 처리도 걷어냈다. Select 의 `isQuiet` (S2 Picker 에 있음) 은 그대로다.

### Changed

- **ColorField 기본 배치 = 세로** (RSP · RAC 레퍼런스): 라벨 위 · 입력칸 · 도움말 아래 (TextField 와 같은 field 배치). 2026-06-23 의 가로 배치 (Label · hex 입력 · ColorSwatch 한 줄) 는 지금 template 에 ColorSwatch 가 없어 근거가 없다. Canvas · Preview 모두. 위치: `componentRulesTable.ts` ColorField `layout` · `generated/ColorField.css`

### Fixed

- **Calendar 의 locale 이 세 군데에서 달랐던 것** — 달력 칸 (Canvas) 은 한국식, 년월 제목은 미국식, Preview 는 미국식 요일:
  - **Why**: Calendar 원본이 `locale` 기본값 `ko-KR` 을 template 의 CalendarGrid 부품에만 묶었고, 제목 · Preview (RAC Calendar 루트) 는 브라우저 locale 을 썼다. 이제 값은 Calendar 루트 하나 (template `{locale}` · `{calendarSystem}`) 이고, Canvas 의 제목과 달력 칸이 그 값을 (없으면 브라우저 locale) 파생으로 받는다. DateField 계열의 Canvas 조각도 달력 체계를 따른다.
  - 위치: `reusableOriginLibrary.ts` (Calendar · RangeCalendar) · `catalog/runtime/presence.ts` · `compositionRoot.ts` · `delegatedDom.tsx`

- **DateField · TimeField 가 Preview 에서만 오늘 날짜 · 09:00 을 보이던 것** — 값이 없으면 빈 조각 (「연도. 월. 일.」 · 「––:––」) 이다 (RAC · RSP 레퍼런스, Canvas 와 같다).
  - **Why**: DOM binding 이 값 없는 field 에 오늘 · 09:00 을 `defaultValue` 로 넣었다.
  - 위치: `packages/shared/src/catalog/runtime/delegatedDom.tsx`

## [field 부품 — Canvas 와 Preview 가 같게 (ADR-253 후속)] - 2026-10-07

### Fixed

- **Select 의 placeholder 글자색** (ADR-253 Phase 3 (4d) 에서 찾음):
  - Canvas 가 placeholder 를 trigger 글자색 (`fg`) 으로 그렸다. Preview 는 Select sheet 의 `[data-placeholder]` (`fg-muted` × 0.6) 로 그린다.
  - **Why**: Canvas 는 선택을 그리지 않아 (선택은 Preview 의 실행 상태 — Select 는 selected key 를 받지 않는다) 값이 늘 placeholder 인데, 그 상태의 칠을 읽지 않았다. 이제 같은 선언을 SelectValue 의 Canvas 색으로 읽는다 (DOM 은 그대로 sheet — 고른 항목은 trigger 색). 문서가 값에 쓴 색은 양쪽에서 그 위다.
  - 위치: `packages/shared/src/catalog/document/rulePartRules.ts` `catalogSelectPlaceholderColor` · `catalog/runtime/compositionRoot.ts`

- **Preview 의 날짜 · 시간 형식이 브라우저 locale 을 따른다** (ADR-253 Phase 3 (4e) 에서 찾음):
  - locale 을 정하지 않은 날짜 field 를 Canvas 는 브라우저 locale (예: ko-KR 「연도. 월. 일.」) 로, Preview 는 Builder UI 언어 설정 (기본 en-US 「mm/dd/yyyy」) 으로 그렸다.
  - **Why**: Preview 가 문서 전체를 Builder UI 언어의 `I18nProvider` 로 감쌌다. 배포 페이지는 provider 없이 방문자 브라우저 locale (RAC 기본) 로 그린다. 이제 Preview 도 RAC 기본 locale (브라우저 · `languagechange` 추종) 을 쓰고 `<html lang>` 도 그것이다.
  - 위치: `apps/builder/src/preview/PreviewLocale.tsx`

- **필수 표시 (`necessityIndicator`) 를 field 하나의 규칙으로 — Canvas · Preview 같게** (ADR-253 Phase 3 (1) 에서 찾음):
  - field 의 자기 값, 없으면 가장 가까운 Form 의 값, 없으면 icon (`*`) — RSP 와 같다. 전에는 DOM 의 Select · ComboBox · DatePicker · DateRangePicker 가 자기 값과 Form 을 무시하고 늘 `*` 였고, 두 그룹은 Form 을 무시했고, Canvas 는 두 picker 에 표시가 없었다.
  - **Why**: field 마다 DOM 의 방식 (`form` · `own` · `required`) 이 달랐고 Canvas 는 다른 목록을 썼다. 또 binding 기본값 `icon` 이 모든 field 의 해석 값에 실려 Form 의 값은 어느 field 에도 닿지 않았다. 목록 · 규칙을 `presence.ts` 하나에 두고 두 consumer 가 읽으며, field type 정의는 그 기본값을 싣지 않는다 (Properties 패널은 값이 없을 때 그대로 `Icon` 을 보인다).
  - 위치: `packages/shared/src/catalog/runtime/presence.ts` `CATALOG_LABEL_NODE_FIELDS` · `catalogFieldNecessityIndicator` · `delegatedDom.tsx` · `document/ruleDefinition.ts`

- **Select · DateRangePicker 의 `isQuiet`** (RSP Picker `isQuiet` — ADR-253 Phase 3 끝에서 찾음):
  - 두 field 는 quiet 을 켜도 Canvas · Preview 모두 그대로였다. 이제 상자 (Select 의 trigger · DateRangePicker 의 Group) 가 칠 없음 · 각진 모서리 · 밑줄로 바뀐다.
  - **Why**: 상자가 Input · DateInput 이 아니라 field rule 의 `quiet.true.nested` 가 그리는데, DOM 은 root 에 `data-quiet` 가 실리지 않았고 (Select 는 prop 을 넘기지 않음 · DateRangePicker 는 컴포넌트가 지움), Select trigger 는 `.button-base` 칠 (뒤 layer) 이 quiet 선언을 이겼고, Canvas 는 그 선언을 읽지 않았다. 상자에 `_quietOwner` 파생 값을 주고 Canvas 가 같은 선언을 그리며 (`catalogQuietOwnerPaint`), quiet trigger 는 `.button-base` 를 끈다.
  - 위치: `packages/shared/src/catalog/runtime/{presence,quietStyles,domBinding}.ts(x)` · `components/{Button,DateRangePicker}.tsx` · `apps/builder/src/builder/catalogRuntime/canvasBinding.ts`

### Changed

- **ColorField · CheckboxGroup · RadioGroup 의 side 라벨 = 라벨 열** (RSP `labelPosition="side"` 레퍼런스):
  - side 에서 라벨이 글자 폭이고 도움말 · 오류 문구가 내용 오른쪽 같은 줄에 붙었다. 이제 TextField 등과 같이 라벨이 176px (`--form-label-width`) 열, 내용이 그 옆을 채우고, 도움말 · 오류 문구는 아래 줄에 내용과 같은 x 로 들여쓴다. Canvas · Preview 모두.
  - **Why**: 2026-08-21 에 두 그룹은 옛 Skia 가 폭을 강제하지 않는다는 이유로, ColorField 는 Skia side 처리가 없다는 이유로 라벨 열에서 빠졌다. 지금은 Canvas 가 같은 rule 을 읽으므로 그 근거가 없고, 레퍼런스의 side 라벨은 field 종류와 무관하게 열이다. 두 그룹은 `labelAlign` 을 받지 않는다 (정렬 계약은 받는 field 만).
  - 위치: `packages/shared/src/catalog/generated/componentRulesTable.ts` (세 rule 의 `label-position.side` · `--*-side-gap`) · `rulePartRules.ts` (그룹의 항목 묶음 노드가 라벨 옆 내용)

## [대형 선택의 Layers 위치 조회 — 형제 목록 반복 검색 제거] - 2026-10-07

### Performance

- **Canvas 다중 선택에서 같은 형제 목록을 한 번의 선택 처리 안에서 재사용**:
  - **Why**: `selectRecords`가 항목마다 `positionOfRecord`의 같은 형제 목록을 처음부터 검색했다. 기존 read model 배열별로 필요한 구간까지만 읽어 임시 검색표를 만들며, 단일 선택·부모 경로·선택 validation·history·저장은 기존 계약을 유지한다.
  - 5천 형제 회귀 조건의 row identity 읽기: 12,507,500회 → 40,000회 이하. 별도 production CPU profile의 `selectRecords` 평균은 58.41ms → 3.32ms (각 3회, CPU 1배).
  - 앞선 session 중복 검사 수정을 포함한 before/after production 빌드, Chrome headed 1440×900·DPR 1, 실제 키보드 입력 30회 × 3쌍 비교: 5천 선택 Event Timing p95의 반복 중앙값은 CPU 1배 408ms → 328ms, CPU 4배 1,472ms → 1,184ms. 두 CPU 조건 모두 세 쌍에서 감소했다. 600개·CPU 1배는 쌍별 증감 방향이 달라 개선을 확정하지 않는다.
  - 재측정 720회는 선택·문서·durable revision 불일치 0. 최초 비교의 선택 불일치 1건은 원인 미확인으로 남기며, 실패 시 상태·transaction stack을 보존하도록 기존 harness를 보완했다. 전체 정합성 종결은 보류한다.
  - 위치: `apps/builder/src/builder/catalogRuntime/workspace.ts`

### Tests

- **선택 범위·대상·검색량 회귀 고정**: 5천 형제 중 2개/전체 선택, 모든 catalog origin과 자손의 row 대상, 선택 순서·중복·없는 identity, Undo 후 재조회, 서로 다른 바인딩 행 identity의 공통 template target을 검증한다.
  - 위치: `phase4eWorkspace.test.tsx`, `phase4eLayersBoundRows.test.ts`

## [대형 선택 중복 검사 — 호출 내 반복 검색 제거] - 2026-10-07

### Performance

- **선택 교체 시 identity·target 중복 검사를 한 번의 순회로 처리** (ADR-248 Phase 4c session):
  - **Why**: 항목마다 `findIndex`로 앞선 선택을 다시 검색했다. 호출 수명 안의 `Map`/`Set`으로 첫 항목과 순서를 유지하며 기존 `targetKey`를 재사용한다.
  - 5천 선택 회귀 조건의 identity 읽기: 변경 전 25,010,000회 → 변경 후 30,000회 이하. 별도 production CPU profile의 `CatalogSession.select` 평균은 37.69ms → 0.59ms (각 3회).
  - 동일 production fixture·Chrome headed·1440×900·DPR 1에서 실제 키보드 입력을 조건별 30회 × 3쌍 비교했다. 5천 선택의 Event Timing p95 중앙값은 CPU 4배에서 1,624ms → 1,496ms (세 쌍 모두 감소), CPU 1배에서는 424ms → 424ms로 p95 개선 미입증. profile 시간과 입력 지연은 별도 지표다.
  - 위치: `apps/builder/src/builder/catalogRuntime/session.ts`; 기존 `perf:adr248-followup`에 선택 입력의 별도 CPU profile과 실패 transaction 진단을 보완했다.

### Tests

- **선택 identity·target 계약과 반복 검색 회귀 고정**:
  - 첫 항목·순서, 서로 다른 identity/target 조합, 변경 없는 snapshot·알림, additive toggle 및 문서 revision 보존을 확인한다.
  - 위치: `apps/builder/src/builder/catalogRuntime/__tests__/phase4cSession.test.ts`

## [Preview 증분 갱신 — 한 번에 생겼다 지워진 노드] - 2026-10-07

### Fixed

- **한 프레임 안에서 만들어졌다 지워진 노드가 Preview 갱신을 거부시키던 것** (ADR-248 Preview payload — ADR-253 Phase 4 에서 찾음):
  - **Why**: Builder 는 프레임마다 바뀐 id 를 모아 「있으면 put · 없으면 remove」 로 보낸다. 그 사이에 생겼다 지워진 노드 (예: redo 직후 undo) 도 remove 로 나가는데, Preview 복제본은 그 id 를 가진 적이 없어 delta 전체를 `ENTRY_NOT_FOUND` 로 거부하고 문서 전체를 다시 받았다 (콘솔 `payload rejected` 한 줄). remove 는 「그 revision 에 없다」 는 뜻이므로 복제본에 없는 id 는 건너뛴다.
  - 위치: `packages/shared/src/catalog/preview/receiver.ts`

## [Popover · Tooltip 이 Preview 에서 동작 — ADR-255 · 범위 밖 수리 2건] - 2026-10-07

### Changed

- **팔레트 Popover · Tooltip = trigger 조합** (ADR-255): Popover 는 `DialogTrigger > Button + Popover`, Tooltip 은 `TooltipTrigger > Button + Tooltip` (react-aria 레퍼런스 구조). 놓으면 Builder 와 Preview 모두 버튼이 보이고, Preview 에서 누르면 Popover 가, 키보드 focus · hover 로 Tooltip 이 열린다 (전에는 Canvas 에만 열린 카드가 있고 Preview 에는 아무것도 없었다). 놓은 Popover · Tooltip 의 Properties 에서 placement · offset · size 등 overlay 의 prop 을 그대로 고친다. 저장 형식 contract 7 (앞 버전 문서는 열리지 않는다).

### Added

- **TooltipTrigger** 컴포넌트 타입 (RAC TooltipTrigger — Tooltip 원본의 루트, 팔레트에는 없다).

### Fixed

- **Card 제목 · 설명을 Canvas 더블클릭으로 고칠 수 있다** — 더블클릭이 CardHeader 에서 멈추던 것을, 더 들어갈 수 없는 자리에서는 포인터 아래 글자를 편집하도록 (글자는 Card 의 `title` · `description` 에 쓴다).
- quiet field 밑줄 폭을 border 기하 helper 로 읽어 ADR-219 정적 게이트를 복구했다 (값 변화 0).
- **Canvas 글자 더블클릭 편집 영역이 두 줄 높이로 열리던 것** — 이제 글자 상자 높이 그대로 열리고, 줄을 넣으면 따라 커진다.
  - **Why**: 편집 `<textarea>` 가 높이를 `minHeight` 로만 받아 브라우저 기본 `rows=2` 가 높이를 정했다 (한 줄 상자 18px 에 36px). 줄을 더해도 커지지 않았다.
  - 위치: `apps/builder/src/builder/workspace/canvas/catalog/CatalogTextEditor.tsx`

## [ADR-254 Implemented — 바탕의 부품 사슬] - 2026-10-07

### Changed

- **ADR-254 종결**: Dialog · Popover · Card · InlineAlert · Tooltip 의 제목 · 설명이 Heading · Description 원본의 instance 다 (공용 바탕 원본은 두지 않는다). G4 는 실행자 live 로 확인 — 원본 편집이 Canvas 9 자리와 Preview 의 열린 Dialog · Card · InlineAlert 에 같이 닿는다 (live 5/5 · 3/3 · 4/4). 기록: [ADR-254](adr/completed/254-base-part-chain.md#live-exercise).

## [바탕의 부품 사슬 — ADR-254 Phase 1 · 2] - 2026-10-07

### Added

- **Heading 부품 원본**: Components page 의 Heading 원본을 고치면 AI 가 넣은 Heading 과 Dialog · Popover · Card · InlineAlert 의 제목이 Builder 와 Preview 에서 같이 바뀐다. Description 원본도 이제 다섯 컨테이너 (Tooltip 포함) 의 설명에 닿는다. AI 의 Heading 생성은 원본의 instance 를 만들고 `size` 선택지는 그대로다.

### Changed

- **InlineAlert 의 제목 · 설명은 Heading · Description rule 로 그린다** — InlineAlert 의 size 가 제목 (같은 단계) · 설명 (한 단계 위) 으로 전달된다. 글자 크기는 그대로 (14/16/18 · 12/14/16), 제목 굵기 700 → 600, 줄 높이는 각 rule 값 (제목 md 1.4 → 1.5 · 설명 1.5 → 1.429).
- **Dialog 의 접근성 이름 = 제목**: 제목이 RAC `Heading slot="title"` 이 되어 Dialog 가 `aria-labelledby` 로 제목을 가리킨다 (제목 요소는 RAC 가 정하는 `h2`). 제목이 없는 Dialog 만 이름 「Dialog」.

### Fixed

- **부모 prop 에 묶인 글자를 Canvas 에서 고친 뒤 부모 prop 이 먹지 않던 문제**: TextField 의 Label · InlineAlert · Card 의 제목처럼 template 이 부모 prop (`label` · `title` · `description`) 에 묶은 글자는 더블클릭 편집이 그 prop 에 쓴다 (자식에 남아 있던 글자는 같은 단계에서 지운다). Properties 는 그 자리를 부모 소유로 안내한다.
- **Preview 의 Card 설명이 노드 style 을 받지 않던 문제**: Canvas 와 같은 색 (`#49454f`) 과 글꼴이 Preview 에도 inline 으로 실린다.

## [대형 선택 Action Bar 준비 비용 축소] - 2026-10-07

### Performance

- Action Bar에서 표시하지 않는 삭제 명령의 사전 계획을 생략한다. overflow·context menu의 삭제 명령과 validation·history·저장 경로는 유지한다. 전역 cache나 transaction 변경은 없다.
- 기존 `perf:adr248-followup`에 선택적 명령별 계측·실제 키보드 입력·다른 부모 이동·다중 삭제·overflow/Compare 검증을 추가했다. 동일 dev fixture의 교대 A/B 3쌍(각 규모·조작·arm 9표본)에서 5,000개 모델 준비 p50은 295.5 → 188.0ms, 실제 ⌘A 입력부터 2-rAF까지는 518.0 → 410.6ms였다. 숨은 삭제 계획은 1 → 0회이며 geometry는 1회/5,000개로 동일하다. 600개 입력 지연 개선과 production p95 개선은 주장하지 않는다.
- 실제 Builder의 5,000개 정렬·overflow 삭제·Undo/Redo·저장·reload와 Canvas/Preview geometry(최대 차이 0px)를 확인했다. 구조 명령 자체는 변경하지 않았고 기존 ratchet 상한도 유지한다.

## [기본 UI 원본 상태·quiet 수리 — ADR-253 G1·G3] - 2026-10-07

### Fixed

- **원본 상태 스타일이 입력칸과 다른 DOM 부품에도 전파됨**
  - Button 한정 경로를 공용 채널로 바꾸고, 기본값과 같은 명시 상태색도 유지한다. 선택·hover 조합과 disabled도 같은 경로를 따른다.
- **quiet field의 Canvas와 Preview 모양을 일치시킴**
  - TextArea·ComboBox·DatePicker를 포함한 9종이 Input·DateInput의 같은 rule에서 투명 배경과 밑줄을 가져온다. hover·focus·invalid 색과 quiet 해제도 대조한다.

### Tests

- 원본 상태 전파·동등색·quiet 회귀 RED를 고정하고, 실제 Builder/Preview 상태 하니스와 Canvas shape 비교를 보강했다. 근거: `docs/adr/reviews/253.md`의 Round 3 수리.

## [Compare Mode 높이 동기화 — Preview breakpoint viewport] - 2026-10-07

### Fixed

- **Compare Mode Preview의 폭·높이를 Canvas breakpoint viewport에 맞춤**
  - Desktop 1920×1080, Tablet 768×1024, Mobile 390×844를 함께 적용하고, 패널이 작으면 두 축 모두 스크롤한다.
  - **Why:** 폭만 inline으로 적용하고 높이는 `height: 100%`로 패널 크기를 따라 iframe의 세로 viewport가 Canvas와 달랐다.
  - 위치: `apps/builder/src/builder/workspace/canvas/catalog/CatalogPreviewFrame.tsx`, `apps/builder/src/builder/workspace/Workspace.css`.

## [옛 Preview 렌더러 삭제 — `packages/shared/src/renderers`] - 2026-10-07

### Removed

- ADR-248 전환 전의 Preview 렌더러 (`packages/shared/src/renderers`, 32 파일 · 11,278 줄) 와 그것만 읽던 테스트 2개 · 옛 DOM 기준선 스크립트 · `@composition/shared/renderers` export 와 vite · vitest alias 4곳. Preview · publish 는 ADR-248 뒤로 catalog DOM binding (`catalog/runtime/{domBinding,delegatedDom}.tsx`) 만 쓴다. 사용자 가시 변화 0 (실제 Builder 에서 TableView · Tabs · ListBox · TagGroup · Tree · FileUpload · DatePicker 확인 · initial 번들 같음).

### Technical

- 옛 렌더러에서 아직 읽히던 `TABLEVIEW_CHILD_STYLE` (TableView 자식의 시각 계약) 은 `catalog/runtime/tableViewChildStyle.ts` 로 옮겼다.

## [기본 UI 원본의 재사용 — 원본의 상태별 값이 Preview 의 Button 에 닿는다 (ADR-253 Implemented)] - 2026-10-07

### Fixed

- Button 원본에 쓴 상태별 값 (hover · pressed · disabled · focus 표시) 이 Preview 의 Button 에 닿는다. 전에는 Components page 의 상태 칸만 바뀌고, Preview 에서 실제로 hover 한 Button 은 기본 hover 색 그대로였다. 놓은 Button 과 다른 컴포넌트 안의 Button (Toolbar · NumberField 의 증감 · Select 의 trigger …) 모두 같다. 상태별 값을 쓰는 패널은 아직 없다 (명령으로만 쓴다).

### Changed

- ADR-253 종결: Components page 에서 Label · Input · Button 원본을 고치면 그 원본을 쓰는 field · 그룹 · Toolbar 의 부품이 Builder 와 Preview 에서 같이 바뀐다 (실제 Builder 에서 확인 — Label 6곳 · 입력칸 4곳 · Button 8곳). Checkbox · Radio · Switch 의 글자는 Label 원본을 따르지 않는다 (Label 원본의 instance 가 아니다).
- Dialog · Popover 의 공용 바탕 원본 (바탕 사슬) 은 미뤘다 — 지금 구조에서는 노드를 늘리지 않고 만들 수 없다.

### Removed

- 쓰지 않는 `SelectTrigger` 의 `accent` · `negative` variant 와 읽는 곳이 없는 `STATIC_LIST_FAMILY_BY_OWNER` 표.

### Technical

- resolver 결과와 consumer record 가 상태별 값을 갖는다 (`stateVisual` — 상태 규칙이 쓰는 키만). DOM 의 Button 은 그 값을 RAC 의 render state 함수 style 로 낸다 (쉬는 style 위에 그 상태 동안만).

## [Select · ComboBox 의 항목이 ListBox 안에 있다 — Preview 에서 열린다 (ADR-253 Phase 4)] - 2026-10-07

### Fixed

- Preview 에서 Select · ComboBox 가 열린다. 전에는 선택 목록에 항목이 없어 눌러도 열리지 않았다. 목록의 항목은 Builder 문서의 항목 그대로다 — 항목을 추가 · 삭제하거나 글자를 바꾸면 Preview 의 목록도 같이 바뀐다.
- ComboBox 에 글자를 치면 항목이 걸러지고, 고른 항목의 글자가 입력값이 된다.

### Changed

- Select · ComboBox 의 항목은 그 안의 ListBox (ListBox 원본의 instance) 에 들어 있다. Layers 에서 항목은 ListBox 아래에 보인다.
- ListBox 원본의 스타일을 고치면 단독 ListBox 와 함께 Select · ComboBox 의 선택 목록도 바뀐다.
- Select · ComboBox 를 고른 채 누르는 항목 「+」 는 그 ListBox 에 항목을 더한다 (ListBox 를 골라도 같다).
- 저장 형식: library contract 5. 앞 버전으로 저장한 프로젝트는 열리지 않는다 (변환 없음 — 개발 단계 정책).

### Technical

- library template 노드가 slot 채움을 적는다 (`LibraryTemplateNode.slotFills`). 합성 원본을 instance 로 쓰는 자리가 자기 자식을 그 원본 template 의 slot 자리에 세운다 — instance 의 `fillSlot` 과 같은 뜻이고, instance 가 그 자리를 채우면 그것이 대신한다. 바탕 사슬 (Phase 5) 이 같은 표현을 쓴다.

## [Page 기본 테두리 — Builder 전용 오버레이] - 2026-10-07

### Added

- **Builder의 Page 기본 테두리를 화면 기준 1px, `var(--border-hover)`로 표시**
  - Builder 테마를 따르며 hover·선택 시 해당 테두리로 전환한다.
  - 기본·hover·선택 테두리는 편집기 오버레이로만 표시하며 문서 Border, Preview, publish 결과에 포함하지 않는다.
  - 위치: `apps/builder/src/builder/workspace/canvas/catalog/catalogOverlay.ts`, `CatalogCanvas.tsx`

### Performance

- Page 기본 테두리용 Paint를 Canvas 수명 동안 재사용하고, 프레임마다 root를 추가 조회하지 않도록 해 오버레이의 반복 작업을 줄였다.
- Page 겹침 판정은 이미 알고 있는 Page root의 그리기 순서를 사용해 불필요한 부모 조회를 생략한다.

## [Canvas hover 가이드 — 1px 두께 통일] - 2026-10-07

### Changed

- **Page와 요소의 hover 가이드 두께를 화면 기준 2px에서 1px로 변경**
  - 선택 박스와 같은 두께를 사용하고 확대·축소 시에도 1px을 유지한다.
  - 위치: `apps/builder/src/builder/workspace/canvas/skia/hoverRenderer.ts`

## [quiet field 의 밑줄을 입력칸 원본이 그린다 (ADR-253 Phase 3 완료)] - 2026-10-07

### Changed

- field 의 Quiet (`isQuiet`) 모양 — 배경 없음 · 밑줄 · 각진 모서리 — 을 입력 상자 부품 (Input · DateInput) 이 자기 상태로 그린다. 8 field 가 따로 적던 선언이 한 정의가 됐다.
- Preview 에서 Quiet 인 TextArea · ComboBox · DatePicker 가 밑줄 모양이 된다 (전에는 켜도 상자 그대로였다).
- Quiet 인 입력칸에 마우스를 올리면 밑줄 색이 진해진다 (전에는 TextField · ColorField 에서 변화가 없었다).
- Styles 패널에서 Select 의 값 (선택된 글자) 을 고르면 그 노드를 그대로 편집한다 (전에는 「Select 에서 편집」 안내). 글자 내용은 계속 Select 의 Placeholder 가 정한다.

### Known issues

- Builder Canvas 는 field 의 Quiet 모양을 그리지 않는다 (Preview 만 밑줄). 이전부터 있던 차이이고 이번에 대상 field 가 늘었다.
- Select · DateRangePicker 의 Quiet 는 Builder 와 Preview 어디에도 반영되지 않는다.

### Performance

- Phase 3 전체 (부품이 원본 instance) 의 비용: field 100개 격자에서 편집 한 번의 그리기 준비 (`record.content`) 4.1 → 4.6 ms (p50, 전환 전후 교대 3쌍). 프레임 간격은 같다. initial 번들은 줄었다 — Builder JS −1,879 B · CSS −2,545 B, Preview JS −3,121 B · CSS −3,100 B (gzip).

### Tests

- `adr253FieldPartsDom.test.ts` 316건 (+10) · 정적 `adr253PartShapeOwner.static.test.ts` 9건 (+1) · 원복 RED 10종.
- live `adr253-p3-quiet-live.mjs` 7/7: 9 field 의 Quiet 쉬는 상태 · hover · focus · invalid · 끄기 (Preview computed style, main 빌드와 대조). 시각 하니스 69/70 (남은 1건 CardView — 무관).
- 성능 하니스에 field 격자 fixture (`perf-baseline.mjs --fixture-kind fields`).

## [날짜 field 의 입력 상자가 DateInput 원본을 따른다 (ADR-253 Phase 3 — 날짜 4종)] - 2026-10-07

### Added

- Components page 에 DateInput 원본 카드가 있다 (날짜 field 의 입력 상자). 이 원본을 고치면 DateField · TimeField · DatePicker · DateRangePicker 의 입력 상자가 Builder 와 Preview 에서 같이 바뀐다.

### Changed

- DateField · TimeField · DatePicker 의 입력 상자는 DateInput 원본의 instance 다. 모서리가 크기를 따르고, hover 는 테두리색만 · focus 는 outline + 테두리색으로 표시한다 (입력칸과 같다 — 전에는 배경도 바뀌었다). DateField 의 빈 조각은 italic 이 아니다.
- DatePicker · DateRangePicker 의 달력 버튼은 FieldButton 원본의 instance 다 — md 18 → 22px · 옅은 강조색 배경. DatePicker 의 상자는 DateInput 이 그린다 (전에는 Group).
- DateRangePicker 의 start · end 가 각각 DateInput 노드다 (전에는 한 노드가 쌍을 대신했다). 구분자는 옅은 글자색이고 좌우 여백 4px 을 갖는다.
- picker popup 의 시간 입력칸이 DateInput 상자 모양이 된다 (전에는 꾸밈 없는 글자).
- `showCalendarIcon` 을 끄면 Builder 에서도 달력 버튼이 사라진다 (전에는 Preview 만).

### Fixed

- Preview 에서 disabled 인 DatePicker · DateRangePicker 의 control 이 겹쳐 흐려지던 문제 (field 0.38 × Group 0.38).
- DateRangePicker 의 Group 모서리가 Builder 와 Preview 에서 달랐던 문제 (Preview 6px 고정 ↔ Builder 크기 단계).

### Tests

- `adr253FieldPartsDom.test.ts` 306건 (+1): 날짜 4종의 부품이 원본 instance · Canvas 상자 · DOM (RAC DateInput · slot) · 달력 버튼 presence · 원본 전파. 구조 대조의 날짜를 고정했다. 원복 RED 11종.
- live `adr253-p3-control-live.mjs` 13/13 (날짜 4종 · locale en-US): 부품 상자 · 모서리 · 색이 Canvas 와 Preview 에서 같다 · hover · focus · popup 열기/닫기 · disabled · 원본 편집 · undo. 시각 하니스 69/70 (남은 1건 CardView — 무관).

## [Select 의 trigger 가 Button 원본을 따른다 (ADR-253 Phase 3 — Select)] - 2026-10-07

### Changed

- Select 의 trigger 는 Button 원본 (secondary) 의 instance 다. Components page 에서 Button 원본을 고치면 Select 의 trigger 가 Builder 와 Preview 에서 같이 바뀐다. hover · pressed · focus 표시는 Button 의 것이다 (전에는 테두리색 · accent outline).
- trigger 의 glyph 는 상자 없는 아이콘이다 (전에는 배경 · 그림자가 있는 chevron 상자). 끝 쪽 padding 이 md 4 → 8px, 모서리는 크기를 따른다.
- Select 의 `placeholder` · `iconName` 이 값 글자 · glyph 에 template 자리표시로 내려간다.

### Fixed

- Preview 에서 disabled 인 Select 의 trigger 가 겹쳐 흐려지던 문제 (field 0.38 × trigger 0.38).

### Tests

- `adr253FieldPartsDom.test.ts` 305건 (+1): Select 의 trigger 가 Button instance · 자식 [SelectValue · Icon] · Canvas 상자 · placeholder / iconName 전달 · DOM (RAC trigger · SelectValue) · 원본 전파. 원복 RED 9종.
- live `adr253-p3-control-live.mjs` 13/13 (Select + SearchField + ComboBox + NumberField): 부품 상자 · 모서리 · 색이 Canvas 와 Preview 에서 같다 (5 크기 · side) · hover · disabled · placeholder · 원본 편집 · undo. Builder 화면 자체의 Select 는 전환 전 빌드와 차이 0 (패널 308건 · 주입 14,800건). 시각 하니스 69/70 (남은 1건 CardView — 무관).

## [SearchField 의 입력칸 · 지우기 버튼이 Input · Button 원본을 따른다 (ADR-253 Phase 3 — SearchField)] - 2026-10-06

### Changed

- SearchField 의 control 은 검색 glyph · Input 원본의 instance · Button 원본의 instance (지우기 버튼) 다. 상자를 입력칸이 그리고 (전에는 container) 알약 모양이다. 지우기 버튼은 입력칸 끝 안쪽의 16px 원 (옅은 글자색 배경 · 흰 glyph) 이다 — 전에는 18px · 그림자가 있는 네모.
- SearchField 의 `placeholder` 가 입력칸에 template 자리표시로 내려간다.
- Builder 가 SearchField 의 값을 입력칸에 그린다 (전에는 값이 있으면 입력칸이 비어 보였다).

### Fixed

- Preview 에서 disabled 인 SearchField 의 control 이 겹쳐 흐려지던 문제 (field 0.38 × container 0.38).
- Builder 에서 입력칸의 글자가 문서가 쓴 좌우 padding 을 따르지 않던 문제 (ComboBox 의 글자가 버튼 밑으로 들어갈 수 있었다).
- template 이 쓴 CSS 변수 색 중 token 과 이름이 다른 것 (`var(--fg-muted)`) 을 Builder 가 풀지 못하던 문제.

### Tests

- `adr253FieldPartsDom.test.ts` 304건 (+1): SearchField 의 container 안이 glyph · 원본 instance · Canvas 상자와 글자 위치 · 지우기 버튼 presence · 값 파생 · placeholder 전달 · 원본 전파. 원복 RED 9종.
- live `adr253-p3-control-live.mjs` 12/12 (SearchField + ComboBox + NumberField): 부품 상자 · 모서리 · 색이 Canvas 와 Preview 에서 같다 (4 크기 · side) · 지우기 (hover · 누르기 · 다시 입력) · focus · disabled · 빈 값 · 원본 편집 · undo. 시각 하니스 69/70 (남은 1건 CardView — 무관).

## [ComboBox 의 입력칸 · 버튼이 Input · FieldButton 원본을 따른다 (ADR-253 Phase 3 — ComboBox)] - 2026-10-06

### Added

- Components page 에 FieldButton 원본 카드가 있다 (field 안 버튼 — Button 원본의 instance 에 모양을 얹은 원본). 이 원본을 고치면 ComboBox 의 버튼이 Builder 와 Preview 에서 같이 바뀐다 (DatePicker 2종은 다음 단계). Button 원본을 고친 값도 FieldButton 에 닿는다.

### Changed

- ComboBox 의 control 은 Input 원본의 instance 와 FieldButton 원본의 instance 다. 상자를 입력칸이 그리고 (전에는 container), 버튼은 입력칸 끝 안쪽의 정사각형이다 — md 18 → 22px · 옅은 강조색 배경 · 그림자 없음 · 모서리 4px. 상자의 모서리는 크기를 따른다.
- ComboBox 의 `placeholder` · `iconName` 이 입력칸 · 버튼 glyph 에 template 자리표시로 내려간다.
- Components page 에서 원본의 Button 색 (배경 · 테두리색 · 글자색) 을 고치면 Preview 의 hover · pressed 색도 그 색에서 나온다 (전에는 고친 색이 상태 색을 덮었다).

### Fixed

- Preview 에서 disabled 인 ComboBox 의 control 이 겹쳐 흐려지던 문제 (field 0.38 × container 0.38).

### Tests

- `adr253FieldPartsDom.test.ts` 303건 (+1): ComboBox 의 container 안이 원본 instance · Canvas 상자 · placeholder / iconName 전달 · 버튼 색이 sheet 변수 · 원본 전파 (FieldButton · Button). 원복 RED 6종.
- live `adr253-p3-control-live.mjs` 11/11 (ComboBox + NumberField): 부품 상자 · 모서리 · 색이 Canvas 와 Preview 에서 같다 (5 크기 · side) · hover · focus · disabled · 원본 편집 · undo. Builder 화면 자체의 숫자 · 단위 입력칸 157건은 전환 전 빌드와 차이 0. 시각 하니스 69/70 (남은 1건 CardView — 무관).

## [NumberField 의 입력칸 · 증감 버튼이 Input · Button 원본을 따른다 (ADR-253 Phase 3 — NumberField)] - 2026-10-06

### Changed

- NumberField 의 control 은 Input 원본의 instance 하나와 Button 원본 (secondary) 의 instance 둘이다. Components page 에서 Input · Button 원본을 고치면 NumberField 의 입력칸 · 증감 버튼이 Builder 와 Preview 에서 같이 바뀐다. 둘의 스타일은 그 자리에서 직접 고칠 수 있다.
- NumberField 의 모양이 바뀐다: 상자를 입력칸이 그리고 (전에는 Group), 증감 버튼은 control 높이의 정사각형 Button 이다 (md 18 → 30px · 테두리 1px · 이웃과 1px 겹침, glyph 16 → 18px). 입력칸의 왼쪽 모서리는 크기를 따르고 버튼 쪽은 각지다. focus 표시는 입력칸 자신이 그린다.
- Preview 의 NumberField 입력칸에 placeholder (`0`) 가 나온다 (Builder 는 이미 그렸다).

### Fixed

- Preview 의 Button 이 hover · pressed 에서 색이 바뀌지 않던 문제 (page 에 놓은 Button 포함). 쉬는 색을 inline 으로 내서 stylesheet 의 상태 색을 덮고 있었다 — 문서가 쓴 색 (원본 편집 · 자기 값) 과 disabled 일 때만 inline 으로 낸다.
- Preview 에서 disabled 인 NumberField 의 control 이 겹쳐 흐려지던 문제 (field 0.38 × Group 0.38). Builder 처럼 한 번만 흐려진다.
- Builder 와 Preview 의 증감 glyph 크기 · 위치가 달랐던 문제 (Builder 18px · Preview 16px, x 21px). 같은 Icon 노드를 그린다.
- Icon 만 가진 Button 의 내용이 Builder 에서 왼쪽에 붙던 문제 (Preview 는 가운데) · Button 안 Icon 의 Preview 상자 높이가 glyph 와 무관하게 24px 이던 문제.
- 모서리별 radius 를 준 요소가 Preview 에서 다시 그려질 때 전체 radius 로 덮이던 문제.

### Tests

- `adr253FieldPartsDom.test.ts` 302건 (+2): NumberField 의 Group 안이 원본 instance · Canvas 상자 · 증감 버튼의 disabled (값 한계 · disabled field) · 원본 전파 · Button 의 inline 색 규칙. DOM 구조 대조는 전환 전 빌드 기준 (Button 노드의 표지 · glyph 마크업 · 입력칸 placeholder 는 명시한 차이). 원복 RED 11종.
- live `adr253-p3-control-live.mjs` 10/10: 부품의 상자 · 모서리 · 테두리 · 배경이 Canvas 와 Preview 에서 같다 (5 크기 · side) · 증감 클릭 · 값 한계 / disabled field / readOnly · hover · focus · 원본 편집 → 증감 버튼 · 입력칸 · undo. Builder 화면 자체의 숫자 입력칸 8개는 전환 전 빌드와 차이 0.
- 시각 하니스 70건 중 69 통과 — NumberField 2건 (전환 전부터 실패) 이 통과한다. 남은 1건은 CardView (무관).

## [Input 원본 하나가 입력칸의 모양을 정한다 (ADR-253 Phase 3 — Input)] - 2026-10-06

### Added

- Components page 에 Input 원본 카드가 있다. 이 원본을 고치면 TextField · TextArea · ColorField 의 입력칸이 Builder 와 Preview 에서 같이 바뀐다 (ComboBox · NumberField · SearchField 는 다음 단계).
- field 안 입력칸의 스타일은 그 입력칸에서 직접 고친다 (Styles 패널). placeholder · type 은 계속 field 가 정한다.

### Changed

- 입력칸의 모양 (padding · 글꼴 · 테두리 · 모서리 · hover / focus / invalid) 은 Input 자신의 rule 이 field 의 size 로 정한다. 부모 rule 과 수동 CSS (`base.css`) 에 흩어져 있던 정의가 하나가 된다.
- 입력칸의 모서리가 크기를 따른다: xs 2 · sm 4 · md 6 · lg 8 · xl 12px (전에는 전 크기 6px — Button 과 같은 단계가 된다).
- ColorField 의 입력칸이 TextField 와 같은 모양이다: 모서리 4 → 6px (md), hover · focus · invalid 표시가 생긴다. Preview 에도 placeholder (`#000000`) 가 나온다 (Builder 는 이미 그렸다).

### Fixed

- Preview 에서 disabled 인 TextField · TextArea 의 입력칸이 겹쳐 흐려지던 문제 (field 0.38 × 입력칸 0.38 × 글자 38%). Builder 처럼 한 번만 흐려진다.
- placeholder 와 값이 모두 없는 입력칸이 Builder 에서 납작하게 (10px) 그려지던 문제. Preview 처럼 한 줄 높이를 갖는다.

### Tests

- `adr253FieldPartsDom.test.ts` 300건 (+5): 세 field 의 입력칸이 Input 원본의 instance · DOM 요소가 그 노드 · field size → 입력칸 · 원본 전파 2회 · TextArea rows · 빈 입력칸 높이. DOM 구조 대조는 전환 전 빌드 기준 (입력칸의 `data-size` 와 ColorField 의 placeholder 는 명시한 차이). 원복 RED 6종.
- live `adr253-p3-input-live.mjs` 10/10: 입력칸의 상자 · 글꼴 · 모서리가 Canvas 와 Preview 에서 같다 (md · xl · sm · side) · Preview 의 hover / focus / invalid / disabled · 원본 편집 → 세 field · undo. 전환 전 빌드와 Preview computed style 대조 — 차이는 위 Changed · Fixed 항목뿐. Builder 화면 자체의 입력칸 (세 화면 상태) 은 전후 차이 0.

## [도움말 · 오류 문구가 부품 원본의 instance — Builder 도 그린다 (ADR-253 Phase 3 — FieldError · Description)] - 2026-10-06

### Added

- Components page 에 Description · FieldError 원본 카드가 있다. 이 원본을 고치면 field · 그룹 13종 (TextField · TextArea · NumberField · SearchField · ColorField · Select · ComboBox · DateField · TimeField · DatePicker · DateRangePicker · CheckboxGroup · RadioGroup) 의 도움말 · 오류 문구가 Builder 와 Preview 에서 같이 바뀐다.
- **Builder 가 도움말과 오류 문구를 그린다.** 지금까지 Canvas 는 field 의 `description` · `errorMessage` 를 그리지 않았다 (Preview 만). 도움말은 `description` 이 있을 때, 오류 문구는 invalid 이고 문구가 있을 때 보인다. side 라벨에서는 입력칸 아래로 들여쓴다.
- Preview 의 Select · ComboBox 가 `description` · `errorMessage` 를, CheckboxGroup · RadioGroup 이 `description` 을 보여 준다 (지금까지 속성 패널에서 적어도 Preview 에 나오지 않았다).

### Fixed

- Preview 에서 field 의 자체 validation 오류가 보이지 않던 문제. required · email · pattern 을 어긴 값을 넣고 벗어나면 오류 문구가 나오고, 고치면 사라진다 (전에는 작성한 `errorMessage` 만 보였다).

### Changed

- 도움말 · 오류 문구의 글자 크기는 부품 자신의 rule 이 field 의 size 로 정한다 (xs 10 · sm · md 12 · lg 14 · xl 16px — 본문보다 한 단계 작게). 부모마다 다르던 값이 하나가 된다: TextField · TextArea 는 md 14 → 12 · lg 16 → 14 · xl 18 → 16px, ColorField · Select 의 sm 은 10 → 12px, DatePicker · DateRangePicker 의 xl 은 14 → 16px.
- field 안 도움말 · 오류 문구의 스타일은 그 부품에서 직접 고친다 (Styles 패널). 글자는 계속 field 의 `description` · `errorMessage` 가 정한다.

### Tests

- `adr253FieldPartsDom.test.ts` 295건: DOM 구조 대조 (전환 전 빌드 기준 — 달라지는 6 조합은 「전에는 Preview 가 안 그리던 문구」 로 명시) · 13 부모의 도움말 · 오류 문구 노드 (표시 조건 · size · 원본 전파 · DOM) · side 들여쓰기. 원복 RED 5종.
- live `adr253-p3-live.mjs` 9/9: 13 부모의 도움말 · 오류 문구가 Canvas 와 Preview 에서 같은 위치 · 크기 (top · side · xl) · email 필드에 틀린 값 → 오류 표시 → 고치면 해제 (전환 전 빌드는 같은 순서에서 표시 없음).

## [Label 원본 하나가 전 field · 그룹의 Label 을 정한다 (ADR-253 Phase 3 — Label)] - 2026-10-06

### Changed

- field · 그룹 17종 (TextField · TextArea · NumberField · SearchField · ColorField · Select · ComboBox · DateField · TimeField · DatePicker · DateRangePicker · CheckboxGroup · RadioGroup · Meter · ProgressBar · Slider · TagGroup) 의 Label 이 Label 원본의 instance 다. Components page 에서 Label 원본을 고치면 전부가 Builder 와 Preview 에서 같이 바뀐다.
- Label 의 글자 크기 · 줄 높이 · 굵기는 Label 자신의 rule 이 정한다 (field 의 size 를 따른다). 부모 rule 은 Label 의 모양을 선언하지 않는다.
- **Label 굵기 600 → 500** (전 Label — react-aria.adobe.com 레퍼런스의 기본값). md 밖 크기에서 Label 줄 높이가 token 값이 된다 (xs · sm 16 · lg 24 · xl 28px).
- field 안 Label 의 스타일은 그 Label 에서 직접 고친다 (Styles 패널). 글자는 계속 field 의 `label` 이 정한다.
- **기존 프로젝트는 열리지 않는다** (library contract 4 — 변환 없음, 개발 단계 결정).

### Tests

- `adr253FieldPartsDom.test.ts` 272건: 17 부모 × 13 조합의 Preview DOM 구조가 전환 전 빌드와 같다 (`fixtures/adr253-field-dom.json`) · Label 요소 = Label 노드 · size 전달 · 원본 전파 (두 번째 편집 포함) · 자기 스타일. 원복 RED 4종.
- `adr253PartShapeOwner.static.test.ts`: 부모 rule 에 Label 모양 선언 0 (원복 RED).
- live `adr253-p3-live.mjs` 5/5 (실제 Builder + Compare Mode Preview): 팔레트로 놓은 17종의 Label 이 Canvas 와 Preview 에서 같은 글꼴 · 상자 (md · xl), 원본 편집 → 전부 반영, undo.

## [Label 원본 — TextField 의 Label 이 그 instance (ADR-253 Phase 2)] - 2026-10-06

### Added

- Components page 맨 앞에 Label 원본 카드가 있다. 이 원본의 스타일 (색 · 굵기 · 글자 크기) 을 고치면 TextField 의 Label 이 Builder 와 Preview 에서 같이 바뀐다.

### Changed

- TextField 의 Label 은 Label 원본의 instance 다. Preview 는 그 Label 노드를 직접 그린다 (문서 구조 · 접근성 연결은 전과 같다).
- **기존 프로젝트는 열리지 않는다** (library contract 3 — 변환 없음, 개발 단계 결정).

### Fixed

- 원본을 두 번째로 고칠 때 다른 컴포넌트 안에 있는 instance (Toolbar 안 Button 등) 가 옛 값으로 남던 문제.

### Tests

- `adr253LabelOrigin.test.ts` 16건 (DOM 구조 대조 11가지 포함) · `adr253OriginOverrideChannel.test.ts` 5건. shared 1,492 · builder 4,151 통과. 실제 Builder + Preview 6/6 (`apps/builder/scripts/adr253-p2-live.mjs`).

## [원본 스타일 편집이 instance 에 닿는다 — ADR-253 Phase 1] - 2026-10-06

### Fixed

- Components page 에서 원본의 스타일 (배경 · padding 등) 을 고치면 그 원본의 모든 instance 가 따라온다 — page 에 놓은 것과 다른 컴포넌트 안에 있는 것 (Toolbar · ButtonGroup · Pagination 안 Button 등) 모두, Builder 와 Preview 에서 같이. 지금까지는 Components page 의 sample 만 바뀌었다.
- 값 순서: 컴포넌트 자신의 값 → 부모가 주는 값 → 원본에 쓴 값 → 그 자리에 따로 적힌 값 → instance 에 직접 쓴 값. instance 에 직접 쓴 값은 그대로 남는다.
- 원본의 상태별 값 (hover 등) 도 같은 길로 내려간다 (Components page 의 상태 칸에 보인다). Preview 의 실제 hover 에는 아직 반영되지 않는다 — 상태별 값을 쓰는 편집 화면도 아직 없다.

### Tests

- `adr253OriginOverrideChannel.test.ts` 4건 (팔레트 원본의 실제 instance). 원복 RED 4종. shared 1,492 · builder 4,134 통과. 실제 Builder + Preview: Button 원본 편집 → page 의 Button 과 Toolbar 안 Button 3개가 Canvas · Preview 에서 같이 바뀌고 undo 로 복귀 (`apps/builder/scripts/adr253-p1-live.mjs`), 수정을 되돌린 빌드에서는 그대로. 콘솔 오류 0.

## [Card 원본의 slot 선언] - 2026-10-06

### Changed

- Card 의 네 영역이 slot 이다: Preview · Header · Content · Footer (pen.dev 의 Card master — header · content · actions — 와 같은 구조). Components page 의 Card 원본 (◆) 은 네 영역을 빗금으로, 옆 instance (◇) 는 채운 모습으로 보여 준다.
- Card 는 Footer 를 비워 둔 채 만들어지므로, page 에 놓은 Card 와 CardView 의 Card 마다 Footer 자리 (높이 8) 에 빈 slot 빗금이 보인다. Footer 에 요소를 넣으면 사라진다.

### Tests

- `phase4eOriginView.test.ts` (Card 원본의 mark 4개 · 옆 instance 와 page 에 놓은 Card 는 Footer 하나). Footer 선언 원복 RED. shared 1,492 · builder 4,130 통과. 실제 Builder: Components page 의 Card 카드 확인, 콘솔 오류 0.

## [Components page — Chart 카드에 종류별 instance (Types 줄)] - 2026-10-06

### Added

- Chart 카드에 Types 줄: Area · Bar · Line · Pie · Radar · Radial · Scatter 를 한 칸씩, 한 줄에 둘씩 그린다. 각 칸은 팔레트가 그 종류를 만들 때 쓰는 props 그대로의 Chart instance 다 (팔레트의 생성 변형을 원본에 실어 읽는다 — `catalogBuiltinOrigins` 의 `kinds`). 팔레트 항목이 여럿인 원본이 생기면 같은 줄이 자동으로 생긴다.

### Tests

- `phase4eOriginView.test.ts` (Chart 카드 줄 = Origin · Variants · Types, 7종의 이름 · `chartType` · 폭 248). Types 줄 원복 RED. 실제 Builder: Chart 카드에 7종이 각자 모양으로 그려지는 것 확인, 콘솔 오류 0.

## [Components page — 컴포넌트 카드의 Sizes 줄 제거] - 2026-10-06

### Changed

- 컴포넌트 카드에서 Sizes 줄 (size 마다 instance 하나씩) 을 없앴다 — 카드에서 차지하는 비중이 너무 컸다. 카드의 줄은 Origin (◆ + ◇) → Item → (Variants · States) 다. page 높이가 줄어 전체 맞춤 확대율이 10% → 19% (2400 폭 창) 로 커진다. 테마 카드 (Typography · Spacing) 의 Sizes 줄은 그대로다.

### Tests

- `phase4eOriginView.test.ts` (Button 카드 줄에 Sizes 없음 · 카드의 어느 instance 도 size 를 지정하지 않음 · IconButton instance 30개). size 에 따른 그리기 검증 (ProgressCircle 지름 · trigger glyph · group 구성원 size 전파) 은 page 에 놓은 instance 로 옮겼다. 열 균형 검증은 한계를 gap (24) 포함으로 바로잡았다. 실제 Builder: Components page 에 size instance 0개 · page 높이 4,991 · 콘솔 오류 0.

## [Components page — 원본은 slot 을, instance 는 완성 모습을 (pen.dev 구조) · Parts 줄 제거] - 2026-10-06

### Changed

- **Origin 줄이 pen.dev 디자인 시스템 페이지의 구조를 따른다**: 원본 (◆) 은 선언된 slot 을 비운 채 빗금으로 보여 주고, 그 옆의 instance (◇) 가 slot 을 채운 완성 모습을 보여 준다 — page 에서 실제로 쓰는 것은 instance 다. 별도 Slots 줄은 Origin 줄에 흡수돼 없어졌다. 원본의 slot 내용은 배치만 하고 그리지 않으므로 slot 은 내용이 차지하는 크기 그대로다. 원본이 비워 둔 slot (Table 의 Columns · Rows) 은 자기 상자 (높이 40) 를 갖고 옆의 instance 는 두지 않는다. 표시만 바꾼 것이고 문서 데이터 · 팔레트 동작은 그대로다.
- 카드의 Parts 줄 (원본을 한 번 더 그리고 구성 요소마다 테두리를 친 줄) 을 없앴다. collection 은 Item 줄과 내용이 겹쳤다. 줄 이름 「Item states」 는 「Item」 으로 바꿨다.
- 카드의 줄 순서: Origin (◆ + ◇) → Item → (Variants · States) → Sizes. Layers 의 카드 그룹에서 「<이름> / Parts」 · 「<이름> / Slots」 행이 사라지고 「<이름> / Instance」 행이 생긴다.
- 항목이 없는 조합 컴포넌트 (TextField 의 Label · Input · FieldError 등) 는 구성 요소를 따로 보여 주는 줄이 없다 — Origin 이 그 모습이다.
- 원본에 hover 해도 그려지지 않는 slot 내용의 안내선은 나오지 않는다.

### Tests

- `phase4eOriginView.test.ts` (GridList 의 Origin 줄 = ◆ · ◇ 두 칸, Tabs 원본의 두 slot 빗금 · instance 무표시, ListBox 원본 내용 opacity 0 · instance 는 그대로, ToggleButtonGroup 등 4종의 원본 크기 = instance 크기, Table 원본 slot 높이 40 이상, 카드 · Layers 에 Parts · Slots 없음). 원본 slot 숨김 · 옆 instance · 그리지 않는 내용의 빈 slot 판정 각각 원복 RED. 실제 Builder: ToggleButtonGroup · Tabs · Table 카드 확인, 콘솔 오류 0.

## [Components page 의 Slots 줄 — slot 상자가 내용 크기를 따른다] - 2026-10-06

### Fixed

- Slots 줄의 빈 slot 상자가 160×40 고정이던 것: ToggleButtonGroup 은 버튼 높이가 30 인데 slot 은 40 으로 그려졌고, 다른 컴포넌트도 같았다. 이제 slot 이 담는 내용을 끄지 않고 배치만 한 채 그리지 않는다 (opacity 0) — slot 은 채운 원본과 같은 크기로 빗금 표시된다. 원본이 비워 둔 slot (Table 의 Columns · Rows) 만 자기 상자 (160×40) 를 유지한다.
- Slots instance 에 hover 해도 그려지지 않는 내용의 안내선은 나오지 않는다.

### Tests

- `phase4eOriginView.test.ts` (ToggleButtonGroup · ButtonGroup · Toolbar · ListBox 의 Slots instance 크기 = 채운 원본 크기, 내용 opacity 0, 빗금 표시 유지). 내용 끄기 · Slots 판정 각각 원복 RED. 실제 Builder: ToggleButtonGroup · Breadcrumbs · Tabs · RadioGroup 카드의 Slots 줄이 원본 내용과 같은 크기로 빗금 표시, 콘솔 오류 0.

## [루트가 collection 인 기본 원본의 slot 선언] - 2026-10-06

### Changed

- **루트가 곧 항목 자리인 원본 12종도 slot 이다**: ListBox · GridList · Tree (Items), Breadcrumbs (Items), Nav (Links), Toolbar (Actions), ButtonGroup · ToggleButtonGroup (Buttons), AvatarGroup (Avatars), DisclosureGroup (Sections), CardView (Cards), Form (Fields). 항목을 모두 지우면 Canvas 가 빈 자리를 빗금으로 표시한다. Components page 의 해당 카드에 Slots 줄 (비운 instance · 빗금) 이 생긴다.
- page 에 놓은 instance 의 Layers 이름은 그대로다 (ListBox 는 「ListBox」 — slot 이름으로 바뀌지 않는다). Menu · Select · ComboBox (항목이 popover 안) · Pagination 은 대상이 아니다.

### Fixed

- 기본 원본 instance 의 slot 표시: instance 노드 자신에게 slot 이 없으면 template 루트의 선언을 읽는다 (루트 slot 이 표시되지 않던 것).
- slot 빗금이 축소할수록 커지던 것: 상자가 있는 slot 에도 화면 48px 띠를 적용해, 확대율이 낮아지면 (창 크기를 줄여 page 가 다시 맞춰질 때 포함) 빗금이 상자 밖으로 자라 아래 줄을 덮었다. 이제 상자가 있는 slot 은 그 상자만 칠하고, 높이 0 인 slot 의 띠만 남기되 장면 기준 48px 을 넘지 않는다.

### Tests

- `phase4eOriginView.test.ts` (ListBox 의 Slots instance = 비운 루트 빗금 · 채운 Origin 무표시 · ButtonGroup 의 빈 루트 상자 160×40 이상). 루트 slot 선언 · instance record slot 읽기 · 루트 slot 상자 각각 원복 RED. 실제 Builder: Toolbar · GridList 카드의 Slots 줄 빗금, page 에 놓은 ListBox · Toolbar · ButtonGroup 의 Layers 이름 유지, 콘솔 오류 0. slot 띠 높이 (`catalogSlotBand`) 원복 RED (확대율 10% 에서 480 ≠ 40), 실제 Builder Components page 27% · 12% · 창 1200 폭에서 빗금이 상자 안에 머무는 것 확인.

## [기본 원본의 slot 선언 · Components page 의 Slots 줄 (pen.dev 디자인 시스템 페이지 참고)] - 2026-10-06

### Changed

- **collection 호스트가 slot 이다**: 기본 원본 template 의 항목 자리 9곳 — Tabs 의 TabList (Tabs) · TabPanels (Panels), Table · TableView 의 TableHeader (Columns) · TableBody (Rows), TagGroup 의 TagList (Tags), RadioGroup · CheckboxGroup 의 항목 묶음 (Options) — 에 slot 을 선언한다. 비어 있으면 Canvas 가 빗금으로 표시하고 (page 의 Table 원본은 열 · 행이 없어 빗금), Layers 행에 slot 표시가 붙는다. 채워진 slot 은 표시하지 않는다.
- **Components page 의 Slots 줄**: slot 을 가진 원본은 Origin (채워진 모습) 옆에 slot 을 비운 instance 를 둔다 — pen.dev 의 디자인 시스템 페이지가 Table · Tabs · Dropdown 의 master 를 빈 슬롯 (빗금) 으로 두고 채운 instance 를 옆에 두는 방식. 비운 slot 은 자기 상자 (폭 100% 또는 160 · 최소 높이 40) 를 가져 빗금이 보인다. 캡션은 slot 이름.
- Components page 의 slot 표시: 원본 sample 아래는 origin 색, instance 아래는 instance 색.

### Tests

- `phase4eOriginView.test.ts` (Tabs 의 Slots instance 2 slot 빗금 · 채워진 Origin 무표시 · Table 원본의 빈 Columns · Rows 빗금 · 캡션). library slot 선언 · record slot 읽기 · 채워진 slot 무표시 · slot 상자 각각 원복 RED.

## [CardView · Chart 기본 원본에 내용] - 2026-10-06

### Changed

- **CardView**: 안의 Card 3개가 모든 부분을 끈 빈 상자 (200×160) 였다. 이제 Card 원본의 기본 내용 (미리보기 · 제목 · 설명) 을 그대로 보이는 Card instance 3개 (폭 200). 기존 프로젝트의 CardView 도 같이 바뀐다.
- **Chart**: 기본 원본에 데이터가 없어 "No data" 였다. 팔레트의 Bar Chart 와 같은 샘플 행 (Mon~Thu × 시리즈 A · B) 을 둔다.
- Table 은 그대로 둔다 — 열은 데이터 연결 (Quick Connect) 이 만들고 행은 프로젝트 데이터 표에서 오는 구조라 library 원본에 담을 값이 없다 (열을 미리 넣으면 데이터 연결 · 열 추가 명령과 충돌: 관련 테스트 5건).

## [컴포넌트 그리기 결함 일괄 수정 · Components page 구성 표시 개편] - 2026-10-06

### Fixed

- **ProgressCircle 높이 0**: Canvas 에서 ProgressCircle 상자의 높이가 0 이라 아래 요소와 겹쳤다. `progress` 계열 규칙이 size 의 높이 (막대의 track 행) 를 빼는데 원형도 같은 계열이었다. DOM 과 같이 지름 정사각형 (sm 24 · md 32 · lg 64) 으로 놓는다. 위치: `packages/shared/src/catalog/document/ruleDefinition.ts`.
- **trigger 아이콘이 size 를 따르지 않음 (Select · ComboBox · DatePicker · DateRangePicker)**: 상자만 size 를 따르고 glyph 는 18 고정이라 XS 에서는 넘치고 LG · XL 에서는 작았다. DOM 은 owner 의 size 로 svg 크기를 정한다 (`resolveTriggerIconSize`, 14 / 16 / 18 / 22 / 28) — Canvas 도 같은 값을 읽는다. NumberField 의 − / + 는 자기 눈금 (`--nf-btn-icon-size`, 10 / 12 / 16 / 18 / 22). 위치: `packages/shared/src/catalog/document/rulePartRules.ts`.
- **Calendar · RangeCalendar 의 SM · LG 에서 날짜 grid 가 상자와 어긋남**: 상자는 달력의 size 로 잡히는데 header · grid 는 md 로 그려져 SM 은 넘치고 LG 는 남았다. 달력의 size 가 header · grid 에 전달된다.
- **StatusLight 가 옆 요소와 겹침**: 폭을 글자만으로 재어 점 (dot) 과 간격만큼 모자랐다. 점 지름을 rule (`indicator.dotSize`, 8 / 10 / 12 / 14) 로 옮겨 DOM · Skia · 폭 계산이 같은 값을 읽는다 — Canvas 의 점이 size 와 무관하게 10 이던 것도 같이 고쳐진다.
- **ProgressBar track 색**: track 이 회색 (neutral-subtle) 으로 그려졌고 Accent · Neutral variant 에서는 track 이 아예 없었다. DOM 과 같이 default · accent 는 accent-subtle / accent, neutral 은 neutral-subtle / neutral-subdued.
- **FileTrigger 가 글자 없는 빈 버튼**: 기본 원본에 label 이 없었다. 기본값 "Select files".

### Changed

- **AvatarGroup · ButtonGroup 의 size 가 안의 Avatar · Button 에 전달된다** (S2 방식 — RadioGroup · TagGroup 과 같은 경로, Canvas · Preview 공통). 그룹 size 를 바꾸면 안의 요소 크기가 따라간다. 요소에 따로 준 size 는 그룹 값이 덮는다.
- **Components page 의 Parts 줄**: 부품을 하나씩 떼어 그리던 방식 (owner 가 주는 크기 · 글자 · 자리를 잃어 깨져 보임) 대신, 원본을 한 번 더 그리고 그 안의 각 부품 영역을 테두리로 표시한다. 줄 아래에 부품 이름을 적는다 (◇ = 다른 원본의 instance).
- Components page: 카드에 마우스를 올려도 안의 모든 요소에 점선이 그려지지 않는다 (카드는 묶음일 뿐). 폭을 채우지 않는 컴포넌트 (Pagination · AvatarGroup · RadioGroup 등) 는 고정 폭 칸 대신 자기 폭으로 놓여 옆 칸을 덮지 않는다. DisclosureGroup 의 Item states 에 헤더가 나온다. Typography 의 `text-md` 표기 「16px / -px」 → 「16px」.

### Tests

- `phase4eOriginView.test.ts` (원형 높이 · owner size glyph · 그룹 / 달력 size 전달 · track variant · 부품 영역 표시) · `phase3Presence.test.ts` (StatusLight 폭 · 달력 size 편집 시 자식 재해석). 수정 9건 각각 원복 시 RED 확인.
- 실제 Builder: Components page 전체 (60 카드) 를 100% 로 나눠 찍어 수정 전후 대조, page 에 놓은 ProgressCircle · StatusLight · ProgressBar · FileTrigger · DatePicker 를 Preview DOM 수치와 대조 (32×32 · dot 10 + 간격 8 · track accent-subtle · "Select files" · 아이콘 18). 콘솔 오류 0.

## [ADR-244 Implemented — 프로젝트 목록에서 캔버스 자산 미리 받기 (Phase 2 · 3)] - 2026-10-06

### Changed

- **프로젝트를 여는 시간 단축 (느린 망 · 첫 방문)**: dashboard 가 한가할 때와 프로젝트 카드에 마우스를 올리거나 포커스 · 누르기 시작할 때, 빌더가 부팅에 쓰는 CanvasKit wasm · 레이아웃 엔진 wasm · 내장 폰트 (Pretendard · Inter TTF) 를 미리 받아 브라우저 캐시에 둔다. 10 Mbps / 100 ms 에서 dashboard 에 머문 뒤 프로젝트를 열면 첫 캔버스까지 p95 **6.5 초 → 1.1 초** (Chromium · WebKit). 바로 누르거나 주소창으로 들어가는 경우는 그대로 (±2 %).
- 받는 중에 들어가도 같은 파일을 두 번 받지 않는다 — 부팅 로더가 자기 파일의 받기만 기다린다 (상한 10 초). 브라우저 저장소 (IndexedDB) 에 이미 있는 폰트는 받지 않는다. 데이터 절약 모드 · 보이지 않는 탭에서는 받지 않고, 실패하면 조용히 넘어간다 (빌더는 언제나 직접 받는다).
- Builder initial JS gzip +1,068 B (미리 받기 상태 · dashboard 계기). 받기 코드는 별도 lazy chunk.
- ADR-244 Implemented (Phase 0 ~ 3): 실제 GitHub Pages 에서 dashboard 에 머문 뒤 프로젝트를 열면 부팅이 wasm 을 캐시에서 읽어 (전송 0) press → 첫 캔버스 343 ms. ADR-244 전체 Builder initial +1,299 B 는 HC1 (Δ ≤ 0) 을 넘지만 사용자 판정으로 수용 (운영 상한 1,421,000 안). Service Worker precache 는 보류 (ADR 본문 Decision 4 의 재개 조건).

### Tests

- `warmupRegistry.test.ts` · `canvasWarmup.test.ts` · `canvasWarmupTrigger.test.ts` · 정적 가드 `canvasWarmup.static.test.ts` (미리 받기 chunk 런타임 import 0 — 원복 RED 확인).
- 진입 지연 하니스 `--warmup on,off` (같은 빌드 대조군) · 실패 주입 `apps/builder/scripts/adr244-warmup-faults.mjs` (받기 끊김 · 404 · chunk 404 → Chromium · WebKit 부팅 6/6).

## [ADR-244 Phase 1 — CanvasKit wasm 해시 경로 · 재배포 뒤 옛 탭 자동 복구] - 2026-10-06

### Fixed

- **재배포 뒤 열려 있던 탭이 프로젝트를 열지 못함**: GitHub Pages 배포는 이전 파일을 지운다. 재배포 전에 dashboard 를 열어 둔 탭이 프로젝트를 누르면 옛 부팅 chunk 가 404 로 실패하고 "CanvasKit 이 초기화되지 않았습니다" 화면에서 멈췄다. 이제 부팅이 workspace 를 열기 전에 실패하면 서버의 `version.json` buildId 를 읽어 이 번들과 다를 때 **새로고침 한 번**으로 새 빌드를 받는다 (편집 전이라 잃는 것이 없다). 같은 buildId 로는 다시 새로고침하지 않는다 — 새 빌드 자체가 깨져 있으면 한 번 뒤 실패 화면 (`staleDeployRecovery.ts`).
- **재배포 뒤 새 탭이 옛 CanvasKit wasm 과 섞임**: CanvasKit glue 는 해시 chunk 인데 wasm 은 고정 경로 (`wasm/canvaskit.wasm`) 라, canvaskit-wasm 을 올린 배포 뒤 10 분 (Pages `max-age=600`) 안에 연 탭은 새 glue + HTTP 캐시의 옛 wasm 으로 부팅이 실패할 수 있었다. wasm 을 빌드 산출물 (`assets/canvaskit-<hash>.wasm`, `?url` import) 로 옮겨 glue 와 같은 빌드의 쌍으로만 쓰인다.
- **부팅 실패 화면이 원인을 숨김**: `initAllWasm` 이 오류를 삼켜 실패 화면에는 뒤따르는 "초기화되지 않았습니다" 만 보였다. 원래 오류 (예: wasm 404) 를 전달한다.

### Changed

- `pnpm install` 의 postinstall 이 `canvaskit.wasm` 을 `apps/builder/public/wasm/` 로 복사하지 않는다 (`scripts/prepare-wasm.mjs` · `prepare:wasm` 스크립트 · `.gitignore` 의 `apps/builder/public/wasm/` 삭제 — 사용자 승인 2026-10-06). 빌드는 dist 루트에 `version.json` 을 낸다.

### Tests

- `staleDeployRecovery.test.ts` (buildId 다름 → 1 회 · 같음 · 반복 · probe 실패 · dev · storage 불가) · `initAllWasmRethrow.test.ts` (원복 RED 확인).
- 재배포 모사 `apps/builder/scripts/adr244-redeploy-sim.mjs` — Chromium · WebKit 에서 새 탭 N+1 쌍만 요청 · 옛 탭 새로고침 1 회 뒤 부팅 · 깨진 배포 1 회 뒤 실패 화면. D 이전 빌드는 새 탭 · 옛 탭 모두 실패 (원복 RED).

## [Canvas 의 Menu 가 점으로 그려지던 문제] - 2026-10-06

### Fixed

- **Menu 가 Canvas 에서 2×2 점으로 그려졌다** (page 에 놓은 Menu · Components page 의 Menu 카드 모두): 이제 Preview 와 같은 트리거 버튼으로 그려진다 — label ("Menu") 과 Button 의 크기 (md 68×30).
  - **Why** — 세 곳이 겹쳤다. ① 트리거 상자의 padding: Menu rule 의 `sizes` 에 `paddingY` 가 없었고, size 축 padding 이 목록 panel 의 `structure.containerStyles.padding` 선언 때문에 통째로 건너뛰어졌다 (`resolveCatalogRuleCanvasBox` — 생성 CSS 의 skip 규칙을 그대로 따랐는데, 그 선언은 Canvas 가 그리지 않는 popover 목록의 것이다). ② 글자 폭: 레이아웃이 자식이 있는 노드의 자기 글자를 재지 않는데, Menu 의 자식 (MenuItem) 은 Canvas 에서 숨는다 (`compositionRoot.textLeaf`). ③ 글자 칠: 같은 이유로 label 을 그리지 않았다 (`rulePaint` 의 `_hasChildren`).
  - 수정: Menu `sizes` 에 Button 과 같은 `paddingY` 추가 (생성 Menu.css 무변 — `validate:sync` 통과) · top-level 상자가 있는 rule 은 size 축 padding 을 적용 · Menu 는 자식이 있어도 자기 label 을 재고 그린다 · 트리거의 `minWidth` · `fontWeight` 는 Button rule 에서 읽는다 (`ruleDefinition.triggerSize` — DOM 트리거가 공용 Button 이다).
  - Components page 의 Menu 카드에 Variants 줄이 다시 나온다 (variant 가 트리거 버튼의 칠이다).

## [dark mode 에서 Tab · Tag label 글자가 안 보이던 문제] - 2026-10-06

### Fixed

- **Canvas 의 Tab · Tag label 이 dark mode 에서도 light 색으로 그려졌다**: 선택된 Tab 의 글자가 어두운 바탕 위에 거의 검정 (`#171717`) 으로, 선택 안 된 Tab 은 어두운 회색으로 그려져 읽히지 않았다. 이제 label 이 item 의 색을 현재 색 mode 로 읽는다 (선택 `#f5f5f5` · 미선택 `#a1a1a1`).
  - **Why**: label Text 는 부모 item 의 색을 물려받는데 (`.react-aria-Tab .react-aria-Text { color: inherit }`), 그 색을 계산하는 `CatalogCompositionRoot.derivedOf` 가 `catalogRuleTextColor` 에 색 mode 를 넘기지 않아 token 을 항상 light 로 풀었다. item 자신의 칠 (`canvasBinding`) 은 mode 를 넘기고 있었다.
  - 회귀 테스트: `phase3Presence.test.ts` (dark root 의 Tab label 색).

## [Navigator Components 탭 — 기본 컴포넌트를 Components page 하나로] - 2026-10-05

### Changed

- **Components 탭이 기본 컴포넌트를 page 하나로 보인다** (사용자 지시 2026-10-05, 샘플 `docs/design/components.PNG`): 종전에는 기본 원본 56개가 목록으로 나열되고 하나를 고르면 그 원본 표본 하나만 그렸다. 이제 목록 맨 위의 「기본 컴포넌트」 page 를 열면 Canvas 가 전 기본 원본을 번호 붙은 카드로 그린다 (6열, 열 높이는 카드의 실제 높이로 맞춘다).
  - 카드 하나 = 원본 하나, 세 구역이다. **Origin** — 원본 표본 (◆). **Parts** — 원본을 구성 부품으로 분해한 것 (TextField → Label · Input · FieldError, Toolbar → ◇ Button ×3 · Separator; 자식이 없는 Button 은 없음). **Instances** (◇) — 상태 변형이 있는 원본은 variant 마다 한 줄 (Accent · Primary …) 에 Default · Disabled · Hover · Pressed · Focus, 상태가 없으면 variant 를 나란히, size 가 있으면 「Sizes」 줄.
  - collection (ListBox · GridList · Menu · Tree · Tabs · TagGroup · Breadcrumbs) 카드는 자기 variant 줄 대신 **Item states** 줄을 보인다 — item 원본과 그 상태 변형 (Selected · Default · Disabled · Hover · Pressed · Focus) 을 따로 그린 instance. collection 의 variant (default · accent) 는 collection 자신의 hover 칠만 바꿔 쉬는 상태에서는 원본과 구분되지 않고, 상태 변형은 item 원본에 있기 때문이다.
  - Layers 는 **컴포넌트별 그룹** 으로 보인다: page 아래에 테마 구역 4개와 컴포넌트 그룹 (카드 frame) 이 번호 순으로 오고, 그룹을 펼치면 그 안에 원본 행 (◆), 분해한 부품 행, instance 행 (◇) 이 나란히 놓인다 (ProgressBar 그룹 → ◆ ProgressBar · Label · ProgressBarValue · ProgressBarTrack · ◇ Default …). 열 · 줄 · 칸 frame 은 행으로 나오지 않는다. Canvas 클릭은 표본 (원본 · 부품 · instance · 테마 값) 을 바로 고르고, 카드의 빈 곳을 누르면 그 그룹이 선택된다.
  - 편집 범위는 그대로다 — 편집되는 것은 Origin 표본의 props · 기본 스타일뿐이고 프로젝트 기본값 (override) 으로 쓰인다. instance · 부품 · page 의 틀은 편집되지 않는다. 인스턴스의 「컴포넌트로 이동」 은 이 page 를 열고 그 원본을 선택한다.
  - 기본 원본 template 에는 slot 선언이 없어 (전수 확인 0건) slot 대신 구성 부품을 분해로 보인다 (사용자 결정).
  - 카드 앞에 **테마 구역 01~04** 가 온다 — Colors · Typography · Icons · Spacing. 구성은 컴포넌트 카드와 같다: 기준 값이 Origin (◆ — `accent` · `neutral` · `base`, `text-base`, Icon, `md`), 거기서 나온 값이 Instances (◇ — `accent` 의 hover · pressed · subtle, 크기 단계, 아이콘 21종, 간격 단계). 테마 값의 ◆/◇ 는 읽기 위한 묶음이고 문서의 원본 · instance 관계는 아니다. 값은 theme token 표에서 프로젝트의 테마 · 색 mode 로 읽고, 테마가 바뀌면 열린 page 가 다시 읽는다. 컴포넌트 카드 번호는 05 부터다. page · 카드 바탕색도 token 이라 dark mode 를 따른다.
  - 다듬기 (2026-10-06): 분해한 부품 표본이 `{label}` 같은 자리표시 글자 대신 원본의 값으로 그려진다 (TextField 의 Label → "Text Field", ListBox 의 item → "Inbox"). 인스턴스의 「컴포넌트로 이동」 은 Canvas 를 그 컴포넌트 카드에 맞춘다. page 의 노드는 크기를 바꿀 수 없으므로 선택해도 resize 손잡이가 나오지 않는다.
  - page 는 저장 · export · 색인에 들어가지 않는 파생 화면이다 (`catalogRuntime/componentsPage.ts` · `originView.ts`, shared `runtime/originViewNode.ts` 의 `COMPONENTS_VIEW`).

## [입력 유실·경합·자원 정리 등 16건 수리 — 미열람 범위 감사 LOW] - 2026-10-05

### Fixed

- **편집이 밖에서 끝나면 입력이 사라짐**:
  - Canvas 텍스트 편집이 blur 없이 끝나면 (선택 전환 · reconcile) 입력한 글이 저장되지 않았다. 편집기가 사라질 때 바뀐 글을 한 단계로 저장한다. 카메라를 따라가는 구독도 프레임마다 다시 붙이지 않는다 (`CatalogTextEditor.tsx`).
  - 페이지 이름을 고치던 헤더가 화면 밖으로 나가 목록에서 빠지면 입력한 이름이 버려졌다 (`PageHeaderLayer.tsx`).
  - 테이블 설정이 열린 채 이름 · 간격이 밖에서 바뀌면 (undo · 목록 rename) 칸이 옛 값을 보이고, blur 가 그 옛 값을 다시 썼다 (`DataTableEditor.tsx`).
  - **Why**: 입력값을 blur 이벤트에서만 읽었다. 요소가 DOM 에서 빠지면 blur 가 오지 않는다.
- **액션 바**:
  - page 에 붙은 바의 손잡이를 눌렀다 떼기만 해도 바가 화면 좌상단 (0, 0) 으로 갔다. 수동 style 에서 자동 style 로 돌아올 때 React 가 지운 transform 을 page anchor 로 다시 얹는다 (`useActionBarPlacement.ts`).
  - 토스트가 뜬 뒤 나타나거나 다시 생긴 바의 위치 변화를 재지 않아 토스트가 바를 덮었다 (`useActionBarClearance.ts`).
- **경합 · 재시도**:
  - snapshot 을 동시에 만들면 하나가 목록에서 사라지고 user 상한 (10) 을 넘었다. 만들기를 직렬화하고, 목록 읽기가 한 번 실패하면 다음 호출이 다시 읽는다 (`snapshots.ts`).
  - 엔진 WASM 로드가 한 번 실패하면 프로젝트를 다시 열어도 다시 로드하지 않았다 (`engineWasm.ts` · `init.ts`).
  - AI 계획 중 멈춤을 눌러도 계획 요청이 계속됐고, 끝나면 실행 단계가 캔버스를 바꿨다. stop 이 planner · verifier 요청도 끊는다 (`orchestrator.ts`).
- **값 해석**:
  - cURL 붙여넣기: `-u` 에 한글 계정이 있으면 예외가 났다 (UTF-8 base64). `--data-urlencode` 는 curl 처럼 값을 퍼센트 인코딩한다 (`curlCommand.ts`).
  - Effect 의 filter 에 `drop-shadow(… rgb(…))` 가 있으면 blur 를 바꿀 때 괄호가 하나 사라졌다 (`filterValue.ts`).
  - border shorthand 에서 색이 width 앞에 오면 (`rgb(0 0 0) 2px solid`) width 를 0 으로 읽었다 (`cssValueParser.ts`).
  - AI 폐쇄망 배지가 `10.example.com` 같은 도메인도 사설망으로 표시했다. HC13 판정 (`isLocalEndpoint`) 을 그대로 쓴다.
- **기타**:
  - 폰트 여러 개를 올릴 때 하나가 읽기 실패하면 나머지도 등록되지 않았다.
  - Chart 예산 문구 · 행 상한이 size 와 상관없이 md 기준이었다.
  - 컴포넌트 override 목록에서 이름이 같은 위치 둘의 행 key 가 겹쳤다.
  - 첫 화면 particle 이펙트를 바꿀 때마다 WebGL context 와 bloom pass 의 render target 이 남았다 (`canvasUtils.releaseWebGL`). 누른 채 떠나거나 다시 누르면 회오리 interval 이 남았다 (`App.tsx`).

### Tests

- 원복 대조군: 수정한 소스 24개를 HEAD 로 되돌리면 새 테스트 30건과, 기대값을 curl 의 실제 결과 (`a%20b`) 로 바꾼 기존 테스트 1건이 RED 였다.
- 검증: type-check 6/6, builder 593 파일 4098 PASS.
- 실제 Builder 에서 대조군과 함께 확인했다:
  - 액션 바 손잡이 무이동 클릭: 수정 전 `(634, 855)` → `(0, 0)` · 수정 후 `(634, 855)` 유지
  - 텍스트 입력 뒤 편집을 밖에서 종료: 수정 전 "Before" (입력 유실) · 수정 후 입력한 글 저장
- 범위 밖으로 둔 것:
  - assetGc memory root: 탭 두 개를 7일 넘게 함께 열어 둘 때만 생긴다. LOW deferred 로 둔다.
  - PanelHeader Escape: 반증된 건이라 수정하지 않았다.

## [편집 덮어쓰기·입력 중 저장·secret 노출 등 22건 수리 — 미열람 범위 감사 MEDIUM] - 2026-10-05

### Fixed

- **여러 쓰기를 한 step 으로 묶을 때 앞 쓰기가 사라짐**:
  - 형제 둘 이상을 함께 Absolute 로 바꾸면 순서가 틀어졌다 (`[A,B,C]` → `[A,C,B]`).
  - tablet 에서 높이가 Fill 인 요소에 Ratio 잠금을 걸면 비율이 저장되지 않았다.
  - **Why**: 명령들을 모두 편집 전 상태로 계획했다. 노드 전체를 다시 쓰는 쓰기 (부모 children · breakpoint fill) 가 앞 쓰기를 덮었다.
  - 수정: `composeCommands` 로 각 명령이 앞 명령의 결과 위에서 계획된다 (`position.ts` · `sizing.ts`).
- **Canvas**:
  - inset box-shadow 의 blur ImageFilter 를 그릴 때마다 해제하지 않아 WASM 메모리가 늘었다 (`nodeRendererBorders.ts`).
  - 간격 인라인 입력에서 화살표를 한 번 누르면 바로 저장되고 입력창이 닫혔다 (RAC NumberField 는 화살표 증감에도 onChange 를 부른다). 이제 화살표로 올리는 동안 열려 있고 Enter · blur 에서 한 번 저장한다.
- **Styles 패널**:
  - fill 이 없는 요소에서 opacity 를 바꾸면 Canvas 미리보기만 남고 저장되지 않았다. 색처럼 실제 fill 로 승격한다.
  - Spacing 입력칸에 포커스했다 나가기만 해도 catalog 기본값이 사용자 값으로 저장됐다. 바뀐 값만 쓴다.
  - padding 을 link 상태로 고치면 되돌리기가 4단계로 쌓였다. 한 step 으로 쓴다.
  - 여러 요소를 선택하고 fill 을 고치면 첫 요소의 fill 이 나머지를 통째로 덮었다. 각 요소의 layer 에 같은 변경 (같은 위치의 필드 · 추가 · 삭제 · 순서) 을 옮긴다 (`fillEdit.ts`).
  - Text 탭 Wrap 프리셋이 Size 절에서 정한 overflow 를 지웠다. Truncate 만 overflow 를 쓰고, Truncate 를 풀 때만 그 overflow 를 푼다.
- **Data 패널**:
  - 「기존 테이블에 잇기」 로 저장하면 매번 새 id 로 보내 항상 실패했다. 이을 테이블을 고르게 했다.
  - Auth 탭이 API Key 이름을 바꾸거나 해제해도 이전 헤더 · 쿼리를 남겨 함께 전송했다. 사용자가 정한 이름도 프리셋 항목으로 판정 · 교체한다.
  - Auth 탭을 다시 열고 Secret name 칸에 포커스했다 나가기만 해도 헤더가 다른 secret 을 가리켰다. 저장된 vault 이름을 읽어 오고 바뀐 값만 쓴다.
  - object · array 변수의 기본값을 입력하는 도중에 값이 `[]` 로 바뀌었다. blur 에서 JSON 이 맞을 때만 저장한다.
  - 필드 타입 변경 확인창을 Esc · 바깥 클릭으로 닫아도 타입이 바뀌었다 (붙여넣기 열 추가 확인창도 같았다). `ConfirmDialog` 에 `onDismiss` 를 두었다.
  - 필터를 켠 채 여러 줄을 붙여넣으면 숨겨진 행을 덮어썼다. 보이는 행 순서를 따른다.
  - 문자열 id 테이블에서 행을 지운 뒤 추가하면 새 행 id 가 기존 행과 겹쳤다.
- **AI**:
  - API 실패 응답 본문을 2KB 로 자른 뒤 secret 을 가려, 경계에 걸린 토큰 앞부분이 provider 로 나갔다. 가린 뒤 자르고, 닫는 따옴표 없이 끝나는 값도 가린다.
  - 중단한 턴이 늦게 끝나면서 그 뒤에 시작한 턴의 실행 상태를 꺼, 새 턴을 멈출 수 없고 다음 제출이 버려졌다.
- **기타**:
  - 패널 레이아웃을 작은 창에서 v4 로 옮긴 뒤 큰 창으로 열면 저장된 레이아웃이 지워질 수 있었다. committed 상태는 다시 마이그레이션해 비교하지 않고, v1 파서가 번호 있는 레코드를 받지 않는다.
  - 폴더를 처음 연결할 때 충돌 · 오류가 나도 헤더에 「동기화됨」 이 보였다. 연결 상태를 항상 mount 된 hook 이 들고 있다가 버튼에 넘긴다.
  - 열린 Preview 가 새로 올리거나 지운 폰트를 반영하지 않았다. storage 이벤트로 레지스트리를 다시 읽는다 (`preview/customFontStyle.ts`).
  - 슬라이더 값 칸에서 Escape 를 눌러도 값이 저장됐고 Enter 는 두 번 저장됐다.

### Tests

- 수정 전 RED 를 22건 모두 확인했다. 대부분은 단위 테스트이고, Preview 폰트 · 레이아웃 복구 · 폴더 연결은 가설을 반증 테스트로 확인했다.
- 검증: type-check 6/6, builder 4068 PASS.
- 실제 Builder 에서 대조군과 함께 확인했다:
  - 형제 둘 동시 Absolute 의 children 순서: 수정 전 `a,c,b` → 수정 후 `c,a,b`
  - Compare Mode Preview iframe 의 `@font-face`: 수정 전 폰트 등록 뒤에도 빈 문자열 → 수정 후 새 family 가 들어감
- 감사 MEDIUM 23건 중 PanelHeader 이름 바꾸기 Escape 는 실제 Chrome 에서 반증됐다 (Escape 뒤 이름 그대로). 그래서 수정하지 않고 LOW deferred 로 둔다.

## [linear gradient 길이·API 고치기 전 URL 요청 수리 — 미열람 범위 감사 HIGH 2건] - 2026-10-05

### Fixed

- **Canvas linear gradient 가 Preview 와 다름**: 정사각형이 아닌 상자에서 Canvas 의 linear gradient 가 Preview 보다 길게 펼쳐져 일부 구간만 보였다. 예: 200×40 의 세로 gradient 는 거의 단색 회색 띠였다.
  - **Why**: gradient 선 길이를 상자의 긴 변으로 고정했다. CSS 는 `|W·sinθ| + |H·cosθ|` 다.
  - 수정: CSS gradient line 공식으로 끝점을 정한다 (`fillToSkia.ts`).
- **API 편집기가 고치기 전 URL 로 요청**: URL 을 고치고 바로 Send 나 Enter 를 누르면 요청이 고치기 전 URL 로 나갔다.
  - **Why**: 데이터 변경은 IndexedDB 쓰기가 끝난 뒤에 store 에 반영되는데, 실행이 저장을 기다리지 않았다.
  - 수정: 대기 중인 저장이 끝난 뒤 실행한다. blur 로 이미 저장한 URL 을 Send 가 한 번 더 저장하던 중복도 없앴다.

### Tests

- 수정 전 RED 5건 (gradient 끝점 3 · Enter 순서 1 · 중복 저장 1) 을 추가했다.
- 검증: type-check 6/6, builder 4037 PASS.
- 실제 Builder 에서 대조군과 함께 확인했다:
  - 200×40 frame 의 0deg 검정 → 흰색 gradient: 진한 픽셀이 수정 전 0 → 수정 후 501 이다. Compare Mode 에서 CSS · Canvas 둘 다 높이 전체에 걸친다.
  - endpoint URL 을 `/old-path` 에서 `/new-path` 로 고치고 Enter: 수정 전에는 `/old-path` 로 요청, 수정 후에는 `/new-path` 로 요청.

## [이미지 캐시 성장·프로젝트 전환 경합 등 12건 수리 — 감사 LOW] - 2026-10-05

### Fixed

- **이미지 메모리 무한 증가**: 이미지 캐시가 상한 없이 커졌다.
  - **Why**: `releaseSkImage` 호출처가 0 이라 refCount 퇴거가 일어나지 않았다.
  - 수정: full rebind 마다 epoch 를 올리고, 두 번의 bind 동안 조회되지 않은 이미지를 퇴거 후보로 둔다 (`imageCache.ts` `beginImageEpoch`).
- **프로젝트 전환 경합**: A 를 여는 중 B 로 옮기면 늦게 끝난 A 의 collections · variables 가 B 의 data store 를 덮을 수 있었다.
  - 취소된 실행이 page source 를 등록한 채 남거나, dispose 된 workspace 를 열기도 했다.
  - 수정: fetch · hydrate 를 현재 프로젝트일 때만 반영하고, open effect 가 등록 · 확정 전에 취소를 확인한다.
- **DB 초기화 실패 고착**: DB open 이 한 번 실패하면 새로고침 전까지 데이터 저장 · 삭제가 전부 실패했다.
  - 수정: 실패한 초기화 promise 를 버리고 다음 호출이 다시 연다.
- **다른 탭 폰트 미반영**: 다른 탭이 폰트를 바꾸면 Preview 에만 반영되고 Canvas 에는 빠졌다.
  - 수정: 같은 탭 변경과 같은 `composition:custom-fonts-updated` 를 낸다.
- **⌘⌥ 단축키 미동작**: ⌘⌥K · ⌘⌥X · ⌘⌥C · ⌘⌥V (속성 · 스타일 복사 / 붙여넣기) 가 macOS 키보드에서 실행되지 않았다.
  - **Why**: ⌥ 가 `key` 를 옵션 문자로 바꾼다.
  - 수정: 물리 키 `code` 로 비교한다.
- **프로젝트 삭제 고아 기록**: 프로젝트를 지워도 API 응답 캐시 행과 폴더 연결 기록이 남았다.
- **AI 탭 값 불일치**: AI 의 `data.openEndpoint` 탭 값이 실제 API 편집기 탭과 달랐다 (없는 `basic` · `run`, 고를 수 없던 `params` · `auth`).
  - 수정: 탭 목록 하나를 둘이 같이 읽는다.
- **패널 최대 폭 고정**: 같은 세션의 두 번째 프로젝트 진입에서 stage 크기 관찰이 떨어진 노드에 붙어, 패널 최대 폭이 창 크기를 따라가지 않았다.
- **API 결과 반영 시 편집 되돌림**: API 실행 결과를 붙일 때 실행 중 끝난 데이터 편집을 옛 Map 으로 되돌렸다.
- **컴포넌트 편집 Cancel 미완료**: 확인 대화상자가 열린 동안 데이터 편집이 끼면 Cancel 이 그 아래 템플릿 편집을 되돌리지 못했다.
- **Skia 정리 결함**: text-shadow · presentation 색 경로의 ColorFilter 핸들이 draw 마다 남았고, resize 실패 뒤 dispose 가 이미 지운 surface 를 다시 delete 할 수 있었다.

### Tests

- 수정 전 RED 12건을 추가했다. ⌥ 키 이벤트를 흉내 내던 테스트 헬퍼 2곳에 실제 이벤트처럼 `code` 를 넣었다.
- 검증: type-check 6/6, builder 4031 PASS.
- 실제 Builder 에서 확인:
  - 이미지 Avatar 가 breakpoint 전환 4회 (full rebind) 뒤에도 그대로 그려짐 (빨강 792 → 792 px)
  - A → B → A 빠른 전환 뒤 data store 가 A 의 collection 만 가짐
- 나머지는 unit · 정적 게이트로만 확인했다.

## [데이터 쓰기 유실·언어 전환 재오픈 등 9건 수리 — 감사 MEDIUM] - 2026-10-05

### Fixed

- **데이터 편집 유실**: 겹친 데이터 쓰기 (DataGrid 연속 셀 커밋 · AI 제안 · 데이터 undo) 에서 뒤 쓰기가 앞 편집을 메모리와 IndexedDB 에서 지웠다.
  - **Why**: `applyDataChange` 가 await 전에 읽은 값으로 await 뒤에 Map 전체를 덮어썼다.
  - 수정: 호출을 한 줄로 세운다 (`stores/utils/dataChange.ts`).
- **언어 전환 시 프로젝트 재오픈**: 언어를 바꾸면 프로젝트를 다시 열어 undo 기록 · 현재 페이지 · 선택이 사라졌다.
  - **Why**: open effect 가 `t` 에 의존했다.
  - 수정: 실패 문구는 최신 `t` 를 ref 로 읽는다 (`main/CatalogBuilderCore.tsx`).
- **Interactions 패널 Backspace 삭제**: 패널에 포커스가 있을 때 Backspace · Delete · ⌘C · ⌘V 가 캔버스 선택 요소를 지우거나 붙여 넣었다.
  - **Why**: 옛 `createScopedHandler` 분기를 catalog 전환에서 잃었다.
  - 수정: 같은 분기를 되살렸다. 메뉴는 넘긴 scope 로 실행한다.
- **휠 직후 pan 드래그 멈춤**: 휠 직후 시작한 pan 드래그가 약 150ms 뒤 pointermove 마다 오류를 내며 멈췄다.
  - **Why**: 휠 종료 타이머가 드래그 세션을 끝냈다.
  - 수정: 휠 종료는 휠 세션만 끝내고, 드래그는 시작할 때 휠 타이머를 정리한다.
- **줌 입력 되돌림**: 줌 입력란에서 ↑/↓ 로 바꾼 값이 Enter · blur 때 원래 값으로 돌아갔다.
- **패널 크기 줄어듦**: 창을 키운 뒤 늘린 패널이 저장 때 첫 진입 때의 창 크기로 줄었다.
  - 수정: store 의 정규화 기준 surface · registry 를 runtime 과 함께 갱신한다.
- **원격 도메인의 로컬 판정**: `10.example.com` 같은 원격 도메인을 사설망으로 판정해, 브라우저 직접 호출 차단 (HC13) 이 풀리고 API 키가 함께 나갔다.
  - 수정: 사설 대역은 IPv4 리터럴만 허용한다.
- **AI 스트림 오류 무시**: 스트림 중간 provider 오류 (Anthropic `error` 이벤트 · OpenAI 호환 `data: {error}`) 가 빈 정상 완료로 보고됐다.
  - 수정: 오류로 던지고, 이벤트를 이미 낸 뒤의 429 는 재시도하지 않는다 (중복 delta 방지).
- **텍스트 clip 누락**: retained paragraph 를 다시 쓰는 경로에서 `clipText` clip 이 빠져, 고정 높이 텍스트가 Canvas 에서 상자 밖으로 넘쳤다.

### Tests

- 수정 전 RED 9건 + 재시도 1건을 추가했다.
- 검증: type-check 6/6, builder 4018 PASS.
- 실제 Builder 에서 확인:
  - 줌 ↑×5 → Enter (68 → 73% 유지)
  - Interactions 패널 포커스에서 Backspace · Delete (Button 유지)
  - en-US → ko-KR 전환 (같은 workspace)
  - 휠 직후 중클릭 드래그 (오류 0 · 카메라 150px 이동)
  - 겹친 셀 편집 둘 (메모리 · IndexedDB 모두 `A`, `B`)
- 패널 크기 · 텍스트 clip · AI 2건은 unit · 정적 게이트로만 확인했다.

## [편집값 되돌림·페이지 배치 겹침·이미지 미표시 수리 — 감사 HIGH 3건] - 2026-10-05

### Fixed

- Property 입력 (`PropertyInput` · `PropertySelect` · `PropertySwitch` · `PropertyUnitInput` · `PropertyColor`) 이 값이 같은 렌더에서 첫 렌더의 콜백을 계속 불러, 인터랙션 규칙·Chart 시리즈 이름·기준선 라벨 편집이 직전 편집을 되돌리고 다중 선택 Properties 가 옛 선택에 쓰던 문제. memo 비교는 그대로 두고 바깥 래퍼 (`withLatestCallbacks`) 가 최신 콜백을 잇는다.
- desktop 이 아닌 breakpoint 에서 페이지를 드롭하면 tier override 로 고정된 칸을 비어 있다고 보고 두 페이지를 같은 칸에 겹치거나, 교환 상대의 desktop 배치까지 지우던 문제. 칸 점유·격자·교환을 활성 tier 해석값으로 판정하고, 흐름 복귀는 그 tier 에만 쓴다. desktop 쓰기도 다른 tier override 를 남긴다.
- 캐시에 없는 이미지 (Avatar `src` · 이미지 fill · 이미지 mask) 가 로드된 뒤에도 Canvas 에 placeholder 로 남던 문제. 로드 완료 구독이 ADR-248 Phase 4e-9-1 에서 옛 Canvas 와 함께 사라져 있었다 — CatalogCanvas 가 구독해 다음 프레임에 scene 을 다시 bind 한다.

### Tests

- 수정 전 RED: 컨트롤 4종 최신 콜백 · tablet override 칸 교환 · desktop 고정 보존 · 이미지 구독 정적 게이트. type-check 6/6, builder 4002 PASS. 실제 Builder 에서 다중 선택 Variant 변경 (두 Button 모두 반영), tablet 같은 칸 두 번 드롭 (교환 · desktop 배치 무변경), 새 이미지 Avatar 표시 (수정본 빨강 792 px · rebind 를 끈 대조군 0 px) 를 확인했다.

## [canonical·잔존 spec 레거시 정리 — ADR-248 후속] - 2026-10-05

### Changed

- IndexedDB `composition` DB 를 v25 로 올렸다. 구 canonical 문서 store 4개 (`documents` · `document_heads` · `document_parts` · `documents_backup`) 는 더 만들지 않고 기존 DB 의 것은 업그레이드 때 지운다 (구 포맷은 이미 열지 않는다). `order_num` 정리 이관 코드도 제거했다.
- 자산 GC root 와 폴더 연결 eviction 이 구 문서 store · 구 history DB 를 읽지 않는다. eviction 은 catalog 문서를 아직 담지 않아 비우기가 일어나지 않는 기존 동작을 유지한다 (사용자 선택).
- AI 읽기 모델이 구 `Element` 대신 전용 `AiElementRow` 를 쓰고 `aiToolReadModel.ts` 로 이름을 바꿨다. AI 도구의 `canonical` 인자 이름은 도구 계약이라 유지한다.

### Removed

- production import 0 인 catalog runtime 재수출 shim 12 · `SortIcon` · `creationStyleDefaults` · `migrateSelectComboBoxItems` 래퍼 · `migrateProjectInlineAssets` · phase0 계측의 canonical/legacy write 카운터 · 구 store 를 흉내 내던 테스트 helper.
- 지워진 canonical 모듈이나 `packages/specs/src` 를 import 해 실행할 수 없던 스크립트 13개와 깨진 `test:coverage` 스크립트. agent·hook 스크립트의 `packages/specs` 경로는 `packages/rendering` 으로 옮겼다.

### Tests

- v24 → v25 업그레이드 (구 store 삭제 · 다른 store 보존) unit 을 추가했다. type-check 6/6, shared 1492 · rendering 1379 · builder 3991 PASS (기존 실패 1 — `adr923DefaultContractRenderers` 의 Menu 3행, HEAD 동일), `gate:catalog-runtime` PASS. 실제 Builder 에서 v24 DB → v25 업그레이드, AI 읽기 · `get_editor_state`, GC root 수집, reload 를 확인했다.

## [큰 문서 구조 변경·다중 선택 액션 바 비용 축소 — ADR-248 후속] - 2026-10-05

### Performance

- Canvas 구조 갱신 내 geometry 중복 조회를 제거하고, 액션 바 정렬·분배 명령의 geometry 준비를 공유하며 선택별 선형 검색을 Map 조회로 바꿨다. 5k에서 구조 이동/삭제 조회는 약 절반, 액션 바 조회는 8회→1회다.
- 교대 3쌍에서 5k 액션 바 taskMs 중앙값 528.19→291.92ms. 구조 조작은 호출 감소만 확인했으며 전체 시간의 체감 개선은 미확인이다. [측정 조건·근거·한계](adr/design/248-performance-followup.md).

### Tests

- 수정 전 실패하는 geometry 상한, 이동·삭제·Undo 및 flex/grid fresh layout/Canvas 비교, 정렬 명령 동등성·resize 갱신을 검증했다. 실제 Builder 5k 액션 바 정렬·Undo·저장·reload 성공. 전용 `pnpm perf:adr248-followup` ratchet을 추가했다.

## [Switch Canvas·Preview 색상 정합 수리 — ADR-248] - 2026-10-05

### Fixed

- Switch 비활성 색 덮어쓰기를 제거해 catalog opacity를 양쪽에서 한 번 적용한다. 공용 테마가 계산한 accent-subtle과 dark border-hover를 Preview/Publish CSS에도 전달해 같은 토큰의 색이 달라지던 문제를 수리했다. 명시 테마 토큰의 우선순위는 유지한다.

### Tests

- DOM 색상 16/16, 실제 Builder track L3 6/6, G3 state 75/75·child 보충 33/33·Icon 보충 7/7 PASS, 원본 base/axis FAIL 0. 기존 G4/G5와 현재 번들·G6를 종합해 기술 완료로 판정했다. 사용자 커밋·push 지시에 따라 최종 수리와 함께 ADR-248을 Implemented로 승격하고 completed 보관·인덱스 집계를 동기화했다. [종합 근거](adr/design/248-final-closure.md).

## [Switch indicator 이동의 G3 비교 수리 — ADR-248] - 2026-10-05

### Fixed

- G3에서 구 Switch track과 새 indicator 노드의 paint 대응 관계를 복원했다. 부모 원점에서 padding 안쪽으로 이동한 4px를 색상 결함으로 오판하던 6건을 해결했다. 없는 구 노드와 실제 root path도 구분한다.

### Tests

- State 75/75 및 child 보충 33/33 PASS. 이동 보정 paint 차이 0, 색상 결함 주입 시 6/6 FAIL. 실제 Builder의 indicator 상자 6/6 delta 0. 제품 renderer·CSS·예산 변경 없이 하니스를 수리했다. [근거·DOM paint 검증 한계](adr/design/248-switch-l3-repair.md).

## [Menu section 렌더 수리와 G3 재검증 — ADR-248] - 2026-10-05

### Fixed

- Menu primitive 기본 variant를 catalog의 `primary`와 맞춰 Canvas 트리거가 투명해지던 문제를 수정했다. Menu에 static section/item 자식을 전달하고 MenuItem을 RAC 항목으로 연결해 열린 메뉴에 항목이 나타나도록 했다.

### Tests

- GridListSection·ListBoxSection 차이를 보충 fixture에 한정해 분류하고 Menu 트리거 상자·열림/닫힘 검사를 추가했다. child 보충 33/33 PASS, Menu 구/신 L3 different 0. 기존 미검증·보충 검증 대응과 실제 Builder 확인을 [종결 기록](adr/design/248-g3-section-closure.md)에 정리했다.
- 전체 state 재검증에서 시작 HEAD에도 존재하는 Switch L3 실패 6건을 확인해 ADR은 Accepted 유지한다. 과거 PASS·UNVERIFIED·NOT_RUN 기록을 소급 변경하지 않았다.

## [Icon 내부 정렬 회귀 수리와 G3 보충 검증 — ADR-248] - 2026-10-04

### Fixed

- 크기를 늘린 Icon에서 Canvas만 glyph를 가로 중앙에 그리던 오류를 수정했다. catalog box model의 정렬·방향·padding·border를 사용하며 DOM의 SVG와 위치를 맞춘다. 220×130 상자에서 98px 차이 → 0px, 실제 Builder 캡처와 하니스 픽셀 차이 0.

### Tests

- G3에 내부 glyph 위치·FAIL exit·선택 case 범위·보충 oracle hash 검사를 추가했다. 구 앱을 동결 HEAD에서 복원해 고정 Icon 7건과 child 33장면을 재측정했다. Icon 7/7, child 30/33 PASS; 남은 3건과 계약 밖 입력 7건은 [근거](adr/evidence/248-g3-remaining.md)에 분리했다. 원래 G0 집계와 승인 예외 목록은 유지한다.
- 10월 5일 완료한 [G5 후속 재측정](adr/evidence/248-g5-followup.md): production A/B p95 36/36, retained heap 9/9, 저장 byte 5/5, 정적 initial bundle 2/2 PASS. 기존 상한을 유지하며 Preview 실제 부팅 JS 636,473B와 구조 편집의 잔여 비용은 별도 기록했다.

## [Publish catalog 전환과 구 문서·native spec 제거 — ADR-248 후속] - 2026-10-04

### Breaking Changes

- **Publish 입력을 catalog JSON/v2 ZIP·디렉터리로 전환했다.** 구 canonical 파일은 명시적으로 거부하며 변환 adapter는 제공하지 않는다. `CompositionDocument` 관련 구 public 타입·resolver·export와 `@composition/specs` 소스를 제거했다.

### Changed

- Preview와 Publish의 DOM·상태·테마·파일 실행 코드를 shared catalog runtime으로 추출했다. Builder Publish 버튼이 자산을 포함한 새 파일을 독립 Publish 탭에 전달한다.
- Frame/Group/Slot CSS 입력을 catalog로 통합하고 CSS 생성기를 rendering으로 옮겼다. `build:specs`·`dev:specs`는 기존 명령 호환용 이름으로 유지한다.
- 파일 교체는 검증 완료 후 적용하고 이전 자산·interaction runtime을 해제한다. hash 경로·브라우저 뒤로 가기와 responsive breakpoint를 연결했다.

### Fixed

- Publish/Preview에서 Body의 잘못된 CSS class와 Frame `backgroundColor` 처리 오류로 발생하던 스타일 누락·렌더 실패를 수정했다.

### Tests

- 파일·자산 hash 검증, shared runtime, CSS 생성, Builder 인접/전체 테스트와 production module 경계를 검증했다. 실제 Builder→Publish 및 Compare Mode, 독립 Publish 업로드·이동·390px 화면 확인은 [근거](adr/evidence/248-publish-followup.md)에 기록했다. 기존 G3 공백은 유지한다.

## [Compare Mode CSS 쪽 desktop breakpoint 폭 — Canvas 페이지 폭과 같게] - 2026-10-04

### Fixed

- **Compare Mode 의 CSS (Preview) 쪽이 desktop 에서도 breakpoint 폭 (1920) 으로 렌더된다.** tablet 768 ·
  mobile 390 은 이미 breakpoint 폭이었지만 desktop 만 pane 폭 (실측 834) 을 채워, Canvas 의 1920 페이지와 다른
  폭에서 레이아웃됐다 (필드 폭 834 vs 1920). 이제 세 breakpoint 모두 `CANVAS_VIEWPORT` 폭이고, pane 이 더 좁으면
  스크롤한다.
  - **Why**: 옛 compare iframe 의 「desktop 은 pane 을 채운다」 규칙을 그대로 옮겼다 — Canvas 는 desktop 을 1920
    프레임으로 그리므로 두 쪽의 breakpoint 기준이 갈렸다.
  - 위치: `apps/builder/src/builder/workspace/canvas/catalog/CatalogPreviewFrame.tsx` · `workspace/Workspace.css`

검증: 새 unit (`catalogPreviewFrame.test.tsx` — 수정 전 RED `100%`), builder 3988 · type-check PASS. live: 사용자
프로젝트를 Compare Mode 로 열어 desktop · tablet · mobile 전환 — CSS 프레임 · 필드 폭 1920 · 768 · 390 = Canvas
필드 폭 (수정 전 desktop 834 vs 1920). breakpoint 별 저작 값 (Width override · tablet 숨김 · 배경 · 글자 크기) 은
수정 전에도 CSS 쪽에 반영됨을 같이 확인했다.

## [TreeItem chevron 을 문서 노드로 — Layers 가 DOM 행 구조와 같게] - 2026-10-04

### Changed

- **TreeItem 의 펼침 chevron 버튼이 Layers 에 노드로 보인다.** template 의 첫 자식 `TreeItemChevron`
  (사용자 지시 「1안」 — 바로 아래 toggle indicator 노드와 같은 방식). 트리 = `TreeItem > TreeItemChevron · Text ·
(자식 TreeItem)`, DOM 의 행 (`Button[slot="chevron"]` · 내용) 과 같다.
  - 값은 그대로다: 상자 = `Tree.css` 버튼 (20px + 깊이 들여쓰기, 종전 노드 없는 레이아웃 part 와 같은 값),
    아이콘 = TreeItem rule 의 `leadingIcon` (이름 · 색 · 펼침 회전) 과 `size.iconSize` 를 chevron 노드 상자에서
    실행. 노드에 사용자 prop 없음, 자기 rule · 생성 CSS 0. DOM 출력 변경 0 (Tree 가 흡수).
  - Design 패널은 chevron 을 선택하면 부모 TreeItem 에서 편집하라고 안내하고, chevron 위치는 지울 수 없다.
  - 부모가 그리는 part 노드 판정을 하나로 합쳤다: `TOGGLE_INDICATOR_OWNERS` → `OWNER_DRAWN_PART_OWNERS`,
    삭제 거부 코드 `TOGGLE_INDICATOR_NOT_REMOVABLE` → `OWNER_DRAWN_PART_NOT_REMOVABLE`.
  - 이번 변경 전에 detach 된 (owned) TreeItem 과 type 정의로 만든 TreeItem 은 chevron 자식이 없다 — 종전처럼
    노드 없는 레이아웃 part 와 TreeItem 자신의 `leading_icon` 으로 그린다 (겹침 없음).

### Fixed

- **Canvas 의 Tree chevron 아이콘이 DOM 버튼 가운데에 놓인다.** 종전 Canvas 는 행의 `paddingX + iconSize / 2`
  (x 16) 에 그렸고 DOM 버튼은 svg 를 가운데 정렬한다 (x 18). 이제 chevron 노드 상자 가운데에 그린다.
  - **Why**: 아이콘 위치를 버튼 상자가 아니라 행 padding 에서 셈했다.
- **높이를 정한 Tree 에서 chevron 버튼 상자가 DOM 과 같다.** `Tree.css` 버튼의 `height: 100%` 는 행 높이가
  정해지면 내용 상자 (24) 를 채운다 — 종전 16 고정. 높이 미지정이면 그대로 svg 높이 16.
  - **Why**: 버튼 상자가 노드가 아니라 비교 대상이 아니었고, 노드가 되며 G3 Canvas ↔ DOM 다리가 처음 쟀다.
  - 위치: `packages/shared/src/catalog/bindings/TreeItemChevron.binding.ts` · `reusableOriginLibrary.ts` ·
    `apps/builder/src/builder/catalogRuntime/` `presence.ts` (`catalogTreeChevronLayout`) · `canvasBinding.ts`
    (`ownerDrawnPartNodeData`) · `ruleShapes.ts` (`catalogLeadingIconPartNodeData`) · `delegatedDom.tsx`

검증: builder 3987 · shared 1605 · parity 803 테스트 · type-check PASS · 새 회귀 테스트
(`treeItemChevronNode.test.ts`, 6) 가 상자 · 레이아웃 part 대체 · TreeItem 아이콘 억제 · DOM 흡수 · 펼침 다시 그리기 ·
가운데 정렬 · 삭제 차단 각각의 원복에 RED. G3 하니스 52 (propAxis 에 Tree 추가 — Canvas ↔ 실제 DOM 0 px; palette
하니스의 Tree 높이 130 에서 버튼 높이 24 를 잡아 `height: 100%` 로 수정), 64 타입 판정 main 과 같음.
live (headed Chrome, 실제 Builder): 팔레트 Tree → Layers 의 chevron 행 선택 → rect · owner 안내 · Canvas 그림
(자식 있는 행만 chevron) 확인, 페이지 오류 0. Preview 는 사용자 확인 항목.

## [Checkbox · Radio · Switch indicator 를 문서 노드로 — Layers 가 DOM 행 구조와 같게] - 2026-10-04

### Changed

- **Checkbox · Radio · Switch 의 indicator 상자 (체크 상자 · 원 · track) 가 Layers 에 노드로 보인다.**
  template 의 첫 자식 `CheckboxIndicator` · `RadioIndicator` · `SwitchIndicator` (사용자 지시 「1안」 —
  RadioItems · CheckboxItems 선례). 트리 = `Checkbox > CheckboxIndicator · Label`, DOM 의 행 (indicator 요소 ·
  label) 과 같다.
  - 값은 그대로 부모 toggle rule 이 정본이다: 크기 = `size.indicator` partRule, 칠 = 부모 rule primitive 를
    indicator 노드의 상자에서 실행 (부모의 선택 · 표시 상태 · variant · 작성 칠). 노드에 사용자 prop 없음,
    자기 rule · 생성 CSS 0.
  - DOM 출력 변경 0 — RAC toggle 이 indicator 요소를 직접 그리고 노드는 흡수된다. Properties · Styles 는
    indicator 를 선택하면 부모 toggle 에서 편집하라고 안내한다 (sub-part owner 판정). indicator 위치는
    지울 (숨길) 수 없다 — Layers 휴지통 없음, `removeTargets` 가 `TOGGLE_INDICATOR_NOT_REMOVABLE` 로 거부
    (DOM 은 항상 그리므로 숨기면 Canvas 만 바뀐다).
  - 저장 포맷 호환: 새 template id 를 더했을 뿐이라 library contract 는 그대로다 (instance 는 template 에서
    indicator 를 받는다). 이번 변경 전에 detach 된 (owned) toggle 노드는 indicator 자식이 없다 — Canvas 는
    indicator 를 예전처럼 toggle 이 그리지만 Label 들여쓰기가 없어 둘이 겹친다 (DOM 은 그대로). 다시 넣으면 된다.

### Fixed

- **Canvas 의 toggle 행 높이가 DOM 과 같다.** indicator 가 label 보다 큰 크기 (단독 Checkbox xl, Switch sm ·
  xl) 에서 Canvas 는 indicator 를 부모 왼쪽 위에 겹쳐 그려 행이 낮았고 (Checkbox xl 28 vs DOM 30, Switch sm
  24 vs 26 · xl 36 vs 38), Switch track 은 padding 위 (y 0) 에 그려졌다 (DOM y 4). 이제 indicator 가 flex 행의
  노드라 `align-items: center` 로 DOM 과 같은 자리에 놓인다.
  - 위치: `packages/shared/src/catalog/bindings/*Indicator.binding.ts` · `rulePartRules.ts`
    (`toggleIndicatorPartRules`) · `reusableOriginLibrary.ts` · `apps/builder/src/builder/catalogRuntime/`
    `canvasBinding.ts` (`toggleIndicatorNodeData`) · `domBinding.tsx` · `delegatedDom.tsx`

검증: builder 3981 · shared 1605 · parity 803 테스트 · type-check PASS · 새 회귀 테스트
(`toggleIndicatorNode.test.ts`) 가 partRule · 부모 primitive 억제 · DOM 흡수 판정 · 삭제 차단 각각의 원복에 RED. G3 하니스
43 → 50 (propAxis 에 Checkbox · Switch size 4 종 추가 — Canvas ↔ 실제 DOM 0 px), 64 타입 판정 변화 0.
live (headed Chrome, 실제 Builder): 팔레트 Checkbox · Switch · RadioGroup → Layers 의 indicator 행 선택 →
rect · owner 안내 확인, Canvas 그림 확인, 페이지 오류 0. Preview 는 사용자 확인 항목.

## [DateField Canvas 입력 상자 · placeholder 기울임 — 레이아웃 높이 · catalog 모서리] - 2026-10-04

### Fixed

- **Canvas 의 DateField 입력 상자가 레이아웃 높이와 catalog 모서리로 그려진다.** 단독 DateInput 의 상자를
  크기별 고정 표 (높이 md 30 · lg 42 …, 모서리 8 · 10 · 12) 로 그리고 글자는 레이아웃 rect 기준 세로
  중앙이라, lg · xl 에서 글자가 상자 아래로 넘쳤고 모서리도 DOM (`var(--border-radius)` = 6px, 모든
  크기) 과 달랐다. 이제 상자 = 노드 rect 높이 + 노드의 해석된 radius · borderWidth.
- **DateField 의 빈 날짜 칸이 DOM 처럼 기울임체다.** DateField 만 `.react-aria-DateSegment[data-placeholder]`
  에 `font-style: italic` 을 둔다 — Canvas 는 이 값을 읽지 않았고, 텍스트 shape 의 `fontStyle` 도 Skia 변환에서
  버려졌다. 이제 owner placeholder paint 의 font style 을 칸 폭 측정과 그리기 둘 다 읽는다.
  - **Why**: 단독 field 의 상자 · 칸 글꼴이 레이아웃 · catalog 가 아닌 primitive 고정값에서 왔다 (D3 대칭).
  - 위치: `packages/rendering/src/renderers/skiaPrimitives.ts` (`datefield_segments`) ·
    `apps/builder/src/builder/catalogRuntime/ruleShapes.ts` (`catalogDateInputPaintProps`) ·
    `compositionRoot.ts` (`segmentRuns`) · `rulePartRules.ts` · `skia/specShapeConverter.ts` (fontStyle)

검증: builder 3962 · rendering 1281 · shared 1605 테스트 · type-check PASS · 회귀 테스트 primitive 원복 시 RED.
headless Chrome ko-KR 에서 DateField sm · md · lg · xl 상자 · 모서리 · 기울임 확인.
알려진 공백 (field 가족 공통, 이번 범위 밖): Canvas catalog 경로에 quiet · invalid 처리가 없다.

## [TimeField Canvas 시간 segment 를 RAC 와 같게 — hourCycle · 오전/오후] - 2026-10-04

### Fixed

- **Canvas 의 TimeField 가 DOM 과 같은 시간 segment 를 그린다.** 세 가지가 달랐다:
  - Hour Cycle (typed enum 문자열 `"24"`) 을 숫자만 읽어 버렸다 — DOM 렌더러는 `Number()` 로 RAC 에
    넘겨 24시간제 (`––:––`) 인데 Canvas 는 locale 기본 (ko-KR 12시간제) 로 `오전 ––:––` 을 그렸다. 이제
    `racFieldHourCycle` 하나로 같은 값을 읽는다 (미지정 TimeField 는 컴포넌트 기본 24).
  - 날짜+시간을 포맷한 뒤 첫 시간 칸부터 잘라 ko-KR 처럼 오전/오후가 앞에 오는 locale 에서 그 칸이 빠졌다
    — RAC 처럼 시간 필드만 포맷한다 (`maxGranularity: "hour"`).
  - placeholder 시각이 정오라 `PM` · `오후` 였다 — RAC placeholder 는 자정이라 `AM` · `오전`
    (시간 granularity 의 DateField · DatePicker 도 같이).
  - **Why**: Canvas segment 행이 RAC `useTimeFieldState` · `createPlaceholderDate` · DOM 렌더러의
    hourCycle 해석과 다른 입력으로 만들어졌다 (D3 대칭).
  - 위치: `packages/shared/src/catalog/document/dateSegments.ts` (`racDateSegmentParts` ·
    `racFieldHourCycle`) · `apps/builder/src/builder/catalogRuntime/compositionRoot.ts` · `presence.ts`

검증: builder 3961 · shared 1605 · rendering 1281 테스트 · type-check PASS · 회귀 테스트가 세 결함 각각의
원복에 RED. headless Chrome ko-KR 에서 TimeField `––:––` · DateField `연도. 월. 일.` 확인 (12시간제는 unit).

## [날짜 입력 placeholder 를 RAC segment 로 — Canvas DateInput segment run] - 2026-10-04

### Fixed

- **Canvas 의 DateField · TimeField · DatePicker · DateRangePicker placeholder 가 RAC 와 같은 segment 로
  보인다.** 종전 Canvas 는 근사 문자열 (`MM / DD / YYYY`, ko 는 `YYYY / MM / DD`) 하나를 한 색으로 그렸고,
  DOM (RAC) 은 locale 의 segment (`mm/dd/yyyy` · `연도. 월. 일.`) 를 칸마다 그린다 — 이제 Canvas 도
  레이아웃이 재던 RAC segment 행을 칸 위치 그대로 그린다: 편집 칸은 좌우 segment padding 만큼 들여 owner
  rule 의 `.react-aria-DateSegment[data-placeholder]` 색 · 투명도 (`var(--fg-muted)` · 0.6) 로, literal 은
  field 색으로. Range 는 시작 · `–` · 끝 행, TimeField 는 `––:––`.
  - **Why**: 레이아웃은 이미 `racDateSegmentParts` 로 상자 폭을 쟀는데 그리는 쪽만 옛 근사 placeholder 를
    써서 글자 · 순서 · 색이 DOM 과 달랐다 (D3 대칭).
  - 위치: `apps/builder/src/builder/catalogRuntime/compositionRoot.ts` (`segmentRuns` · `dateSegmentPaint`) ·
    `packages/shared/src/catalog/document/rulePartRules.ts` (`catalogDateSegmentPlaceholderPaint`) ·
    `packages/rendering/src/renderers/skiaPrimitives.ts` (`datefield_segments`)

검증: builder 3961 · rendering 1281 · shared 1605 테스트 · type-check PASS · 회귀 테스트 primitive 원복 시 RED.
headless Chrome 에서 ko-KR 새 프로젝트에 DatePicker · DateRangePicker · DateField · TimeField 를 추가해
segment 글자 · 색 · 위치 확인. Preview 대조는 하지 않았다 (사용자 확인 대상).

## [DatePicker · DateRangePicker Canvas 렌더 복구 — 이중 상자 · 아이콘 · 기간 표시] - 2026-10-04

### Fixed

- **Canvas 에서 DatePicker · DateRangePicker 가 상자를 두 겹으로 그리고, 아이콘이 calendar 대신
  chevron 으로, DateRangePicker 가 기간 대신 날짜 하나만 보이던 문제를 고쳤다.** ADR-248 옛 Skia
  빌더 삭제 (`5382d1da0`) 때 부모 → 자식 주입 둘 (`resolveDateInputParent` · `resolveIconDelegation`)
  이 catalog 경로로 옮겨지지 않았다 — DateInput 은 부모 종류를 몰라 단독 DateField 처럼 자기 상자를
  그렸고 (Range 쌍 · TimeField 시간 segment · granularity · locale 도 빠짐), SelectIcon 은 부모
  `iconName` 대신 자기 기본값 `chevron-down` 을 그렸다.
  - 이제 owner 파생 값 (`catalogDerivedProps`) 이 DateInput 에 `_parentTag` · granularity · hourCycle ·
    locale (레이아웃 측정과 같은 해석) 을, SelectTrigger 안 SelectIcon 에 owner `iconName` 을 준다.
    owner prop 을 바꾸면 증분 경로로 같이 갱신된다.
  - **Why**: DOM 은 picker 가 DateInput segment 와 아이콘을 자기 props 로 그린다 (self-compose) —
    Canvas 도 같은 owner 값을 읽어야 시각이 같다 (D3 대칭).
  - 위치: `apps/builder/src/builder/catalogRuntime/presence.ts` (`fieldSubpartProps`) ·
    `canvasBinding.ts` (glyph)

검증: builder unit 561 파일 · type-check PASS · 회귀 테스트 (`phase3Presence.test.ts`) 수정 전 RED.
headless Chrome 에서 새 프로젝트에 DatePicker · DateRangePicker · DateField · TimeField · ComboBox ·
Select 를 팔레트로 추가 → picker 상자 하나 + calendar 아이콘, Range `… – …` 쌍, TimeField `HH : MM`,
ComboBox · Select 무변화 확인. Preview 대조는 하지 않았다 (사용자 확인 대상).

## [Chart 팔레트 추가 거부 수정 — 초기 너비를 sizing 으로] - 2026-10-04

### Fixed

- **Components 패널의 Chart 7종 (Area · Bar · Line · Pie · Radar · Radial · Scatter) 이 추가되지 않던
  문제를 고쳤다.** 팔레트 항목의 초기 props 에 옛 요소 모델의 `style: { width: 320 }` 이 남아 있었고,
  `catalogCreationProps` 가 초기 props 키를 accepts 확인 없이 통과시켜 객체 값 `props.style` 이 문서
  검증 (`entry.props.style.value.width`) 에 걸렸다 — ADR-248 catalog 문서 전환 뒤 클릭마다 오류
  toast 만 뜨고 Canvas 에 아무것도 생기지 않았다. 초기 `style` 은 이제 props 가 아니라
  `catalogStyleWrites` 로 노드의 typed field 에 들어간다 (Chart 는 `sizing.width = 320`).
  - **Why**: catalog 문서의 prop 값은 scalar · 배열 · token 참조만 허용한다 — CSS 묶음 `style` 은
    Styles 패널과 같은 typed field (`visual` · `layout` · `sizing`) 가 정본이다.
  - 위치: `apps/builder/src/builder/catalogRuntime/paletteInsert.ts` (`catalogCreationStyle`)
- 팔레트 전 항목 테스트가 명령을 만들기만 하고 commit 검증을 거치지 않아 이 거부를 놓쳤다 — 이제 각 항목을
  실제로 실행한다 (`phase4ePalette.test.ts`, 수정 전 코드에서 Chart 7종 RED).

검증: catalogRuntime · palette 506 테스트 · type-check PASS. headed Chrome 에서 새 프로젝트에 Bar ·
Line · Pie Chart 를 팔레트 클릭으로 추가 → 오류 0, 각 320×240, Canvas 에 막대 · 선 · 원 그래프와 범례
표시 확인.

## [ADR-248 review round 3 — Builder specs 의존 제거 · AI 생성 계약 전환] - 2026-10-04

### Fixed

- AI 생성 manifest와 component catalog가 catalog library/definition의 실제 생성 계약을 읽는다.
  합성 CanonicalNode와 구 edit/style resolver 호출을 제거했고, IconButton·InlineAlert의 원본
  속성을 안내·검증한다. template에서 소비되는 label/icon도 AI 읽기 검증에 보존해 정상 생성·수정을
  실패로 보고하던 문제를 고쳤다.

### Changed

- 공용 텍스트·token·shape·chart·아이콘·CSS generator 구현을 `@composition/rendering`으로
  이전했다. Builder/shared의 specs 패키지 의존과 native spec registry 진입점을 제거했다.
  legacy specs는 Publish 후속 및 기존 생성 스크립트의 호환 경계로 남는다.
- `gate:catalog-runtime`은 Builder/shared의 specs 의존과 production chunk의 구 spec·편집
  resolver 잔존을 검사한다. 공용 패키지 테스트와 생성 경로, harness 범위 판정도 이전했다.

검증: rendering 1,281 · legacy specs 112 · shared 1,605 · Builder 3,958 테스트 PASS,
production 경계·build:specs·preflight PASS. 실제 Builder에서 AI 생성·속성 수정·Undo/Redo·저장 후
새로고침 복원과 Canvas 표시 확인. 상세와 미검증 범위는 [ADR-248 수리 기록](adr/reviews/248.md).
Publish 후속과 기존 G3 미검증은 유지하며 ADR Implemented 승격은 하지 않았다.

## [옛 TS 레이아웃 파이프라인 삭제 — fullTreeLayout · parity pipeline leg] - 2026-10-05

### Removed

- **production 에서 닿지 않던 옛 TS 레이아웃 파이프라인을 지웠다** (사용자 판정 2026-10-05). ADR-248 Phase 4 뒤 Canvas 레이아웃은 `catalogRuntime/compositionRoot.ts` 의 `styleOf` → `PersistentLayoutTree` 하나로 돌고, `fullTreeLayout.ts` (`calculateFullTreeLayout`) 와 그것만 쓰던 전처리 — DFS enrichment (`enrichWithIntrinsicSize` · `calculateContentWidth/Height`) · `applyImplicitStyles` 컴포넌트 주입 · `propagationRegistry` / `propagationEngine` · display/flex/block style 어댑터 · 2-pass 폭 교정 · grid full rebuild 판정 · `readOnlySubpart` · `specTextStyle` · `textRenderStyle` · 상태 변형 레이어 · `systemComponentsPage` · `editorPresentationLayoutLane` 등 — 은 parity 하니스와 테스트만 부르고 있었다. 소스 25 · 테스트 95 파일, 약 37,500줄.
- 살아 있는 모듈 안에서 이 경로만 쓰던 export 도 지웠다: `engines/utils.ts` 6,537 → 약 470줄 (텍스트 측정만), `implicitStyles.ts` 3,963 → 약 220줄 (container fallback · overflow · box-shadow 해석), `cssValueParser.ts` 의 레이아웃 viewport 변수, `PersistentLayoutTree` 의 targeted compute · 조회 메서드, `layoutTypes.ts` 의 측정 스칼라 키 표, builder 래퍼 `resolveSkiaRule` · `resolveSkiaCatalogRenderInput` · `ruleSizeToSizeSpec`.
- parity 하니스의 pipeline leg (`pipelineLeg` · `runPipelineParityCase`) 와 그 케이스를 지웠다. 남은 parity 는 DOM ↔ 엔진 (엔진 CSS 정합) 과 `adr248Catalog*` (catalog root ↔ catalog DOM) 다.

### Internal

- 규칙 문서를 지금 경로로 고쳤다: `.claude/rules/layout-engine.md` (옛 파이프라인 절 → 삭제 기록, 배치 직렬화 계약을 `styleOf` / `px()` 기준으로, 금지 패턴 정리) · `canvas-rendering.md` (Size Delegation = `CATALOG_SIZE_PROPAGATION`, 측정 font = `textLeaf`) · `ssot-hierarchy.md` (sub-part 판정 = `catalogSubpartOwnerType`) · `style-ssot.md`, skill `spec-value-sync` (레이아웃 파생 상수 `BUTTON_SIZE_CONFIG` 삭제 반영) 과 reference 6개 · cross-check 체크리스트. 삭제된 코드만 설명하던 skill reference `layout-details.md` 는 지웠다. `docs/reference/CSS_SUPPORT_MATRIX.md` 는 「구현 위치」 열이 옛 경로 기준임을 머리말에 적었다.
- 코드 주석 중 삭제된 모듈에 지금도 의존한다고 적힌 곳을 고쳤다 (builder · shared · specs · 엔진 `tree.rs`).

동작 변경 없음 — 삭제한 코드는 production 진입점 (`main.tsx` · `preview/index.tsx`) 에서 import 로 닿지 않았다.

## [겹친 페이지의 활성 페이지 최상단 복구 · Chart 예산 안내 · DOM 간격 shorthand 정리 — ADR-248 이후 잔여] - 2026-10-04

### Fixed

- **겹친 페이지에서 활성 페이지가 다시 맨 위에 그려진다.** catalog Canvas 는 페이지를 문서 순서로만 그려, 페이지 헤더는 활성 페이지가 위인데 본문은 뒤 페이지에 가려졌다 (Home 이 활성이어도 Home 내용이 겹친 Page 2 아래로 숨음). 이제 활성 페이지 root 를 마지막에 그리고, 클릭 판정도 같은 순서를 따른다. 아래 페이지의 슬롯 해치 · 행 생략 표시 · hover 외곽선은 위 페이지가 덮는 부분에서 잘리고, 가려진 데이터 바인딩 배지는 그리지도 누르지도 않는다 (2026-08-11 · 08-12 규칙 복구).
- **Chart 속성 패널의 표시 예산 안내 (「Showing 34 / 40 — window」 · 「all shown (n)」) 가 다시 나온다.** 크기를 옛 layout map 에서 읽어 catalog 경로에서는 늘 비어 있었다 — 이제 composition root 기하를 읽는다.
- **Preview DOM 이 간격 · 여백 shorthand 를 longhand 로 낸다.** authored `gap` 과 행 · 열 간격이 함께 있으면 인라인에 `gap` 과 `row-gap` 이 같이 실렸고, `paddingTop` 과 `padding` 이 함께 있으면 키 순서에 따라 DOM 은 `padding` 이, Canvas 는 변 값이 이겨 두 화면이 갈렸다. 이제 상자 모델과 같은 우선순위 (전체 → 축 → 변) 로 longhand 만 쓴다.
- Components 패널 검색 결과 없음 화면이 섹션 흉내 마크업 대신 빈 상태 하나로 나온다.

### Internal

- `local/no-zustand-grouped-selectors` · `no-zustand-use-shallow` 가 ADR-248 로 사라진 `useStore` 이름만 잡아 지금 store 에 동작하지 않았다 — `create(...)` 로 만든 hook 이름을 모아 판정한다. 넓힌 규칙이 잡은 미사용 그룹 selector `useDataTableEditorActions` 를 지웠다.
- `.section` 직접 마크업 금지 정적 가드 (`sectionMarkup.static.test.ts`) 추가.

위치: `catalogRuntime/{canvasScene.ts,domBinding.tsx}` · `workspace/canvas/catalog/{CatalogCanvas.tsx,catalogOverlay.ts,catalogChrome.ts,catalogBadges.ts}` · `panels/styles/hooks/useLayoutValue.ts` · `panels/properties/ChartBudgetControls.tsx` · `panels/components/ComponentList.tsx` · `apps/builder/eslint-local-rules/index.js`. live: `apps/builder/scripts/stale-findings-live.mjs` (겹친 페이지 · hover 가림 · Chart 예산 — occluder 를 끈 RED 대조 포함).

## [Properties · Styles 패널을 Design 패널 하나로 통합 — ADR-252 Implemented] - 2026-10-04

### Changed

- **오른쪽 레일의 Properties · Styles 버튼이 Design 하나가 된다.** Design 패널은 탭 `Property | Layout | Style | Text | Screen` 을 갖는다 — Property 탭이 종전 Properties 본문, 나머지 넷이 종전 Styles 그룹이다. 본문은 옮기기만 했다 (탭별 다중 선택 대상 · sub-part 안내 · 빈 선택 안내 그대로). 탭 줄은 선택이 없어도 남고, 안내는 탭 본문만 바꾼다. 속성과 스타일을 동시에 볼 수는 없다 (사용자 결정 2026-09-29).
- **⌥5 = Design 토글, ⌥6 = Design 을 Layout 탭으로 열기** (이미 Layout 탭으로 열려 있으면 닫는다). 페이지 설정 · 변수 owner 이동은 Design 을 Property 탭으로 연다.
- **⌘⌥C / ⌘⌥V 는 보이는 탭을 따른다** — Property 탭은 속성, 나머지 탭은 스타일. 종전에는 포커스된 패널로 갈렸다. 메뉴 · 명령 팔레트에서 지금 탭의 반대쪽 복사 명령은 실행 불가로 보인다. ⌥⇧S (focus mode) · ⌥⇧E (전체 섹션) 는 스타일 탭에서만 동작한다.
- **Styles 의 Modified 탭 (수정된 스타일 목록 · 전체 되돌리기) 을 뺐다** (사용자 판정 2026-10-04). 수정된 그룹은 탭의 점으로, 되돌리기는 섹션마다의 reset 으로 한다. 패널 최소 폭은 233 px 그대로 (탭 5개 — ko · en 라벨 잘림 없음).
- **저장된 Styles 패널 배치는 사라진다.** 패널 id 는 `properties` 그대로라 Design 은 종전 Properties 자리 · 크기 · 열림을 이어받고, `styles` row 는 레이아웃을 열 때 빠진다 (오류 없음).

사용자 확인 (2026-10-04). 위치: `apps/builder/src/builder/panels/design/{DesignPanel.tsx,designPanelView.ts}` · `panels/properties/catalog/CatalogPropertiesPanel.tsx` · `panels/styles/{StylesPanel.tsx,components/StylesPanelTabs.tsx,catalog/CatalogStylesPanel.tsx}` · `panels/core/panelConfigs.ts` · `config/keyboardShortcuts.ts` · `components/styles/panel-system.css` · 하니스 `apps/builder/scripts/railButton.mjs` (레일 버튼을 순서 대신 이름으로 — 65 스크립트).

## [편집 영향 범위의 증분 소비 보완 — ADR-248 paint/structure delta] - 2026-10-03

### Performance

- 색 등 paint-only transaction은 실제 box·합성 layout part가 바뀌지 않으면 layout compute·text rewrap을 생략한다. 크기·presence·flex 영향 전파는 유지한다.
- 일반 컨테이너의 같은 부모 안 순서 변경·삭제는 살아 있는 형제들을 다시 resolve/materialize하지 않고 부모 record만 재계획한다. 삽입·재부모화는 영향 부모 subtree를 resolve하고 달라진 record만 갱신한다. Canvas는 추가·삭제·순서 변경을 commit subtree splice로 반영하고 무관한 scene의 등록·구독·command span을 보존한다. Slot 구조·page root/외곽 geometry 변화의 fallback은 유지한다.
- 실제 Builder 5k 확인: 텍스트 색 편집의 WASM compute 0회, 순서 변경·삭제의 resolver/layout 입력 방문 각각 1개, Canvas 신규 구독 0개 (삭제 복구는 신규 1개). 저장·새로고침 후 5,001개 입력 복원, Preview 색 반영, console/page 오류 0. 구조 변경에는 형제 ID 목록·geometry·영향 subtree command 처리 비용이 남으므로 전체 O(k)를 주장하지 않는다.

### Tests

- paint-only Undo/Redo, 5k 순서 변경·삭제·복구, 무관한 1k branch 보존, 재부모화의 fresh resolution/command 동등성, 구조 layout 실패 원자성, 고정 inner box 안의 삭제 후 scroll ancestor 갱신 회귀를 고정했다.

## [RadioGroup · CheckboxGroup 항목 묶음을 문서 노드로 복원 (RadioItems · CheckboxItems) — ADR-251 Implemented] - 2026-10-03

### Changed

- **RadioGroup · CheckboxGroup 의 항목이 묶음 노드 (RadioItems · CheckboxItems) 안에 들어간다** (사용자 결정 2026-09-29 · 10-03, TagGroup > TagList 와 같은 모양). Layers 가 화면의 상자 구조와 같아져 `Label · RadioItems > Radio ×N` 으로 보이고, 묶음 행을 선택할 수 있다. 묶음의 방향 · gap 은 그룹 rule 의 `orientation` 블록 하나가 정본이다 (값 변경 0 — size 4 × orientation 2 × label position 2 의 배치가 옛 구조와 같다).
- **Styles 의 Direction 이 두 축으로 갈린다.** 그룹을 선택하면 Label 배치 (`labelPosition`), 묶음을 선택하면 항목 배치 (그룹의 `orientation`) 를 쓴다 — 쓰기는 그룹에 한 단계로 들어간다.
- **「+」 는 그룹 · 묶음 어느 쪽에서도 묶음 안에 항목을 넣는다.** Radio 는 겹치지 않는 `value` 를 받고, 선택된 항목을 넣으면 형제 선택이 풀리고 그룹 `value` 가 따라온다 (instance 의 template 항목은 instance 의 노드로 옮겨진다).
- **Breaking — library contract version 2.** 묶음 노드가 생기면서 template 위치 id 가 바뀌어 (`component-radiogroup__2` 가 첫 Radio → 묶음) contract 1 로 저장된 개발용 프로젝트는 열리지 않는다 (`UNSUPPORTED_LIBRARY_CONTRACT` / `UNSUPPORTED_PROJECT_FORMAT`, 변환 없음 — 보존 대상 0).

### Fixed

- **그룹 DOM 이 항목을 `div.radio-items` 로 두 번 감싸던 것.** Builder 렌더러와 shared 컴포넌트가 각자 감쌌다. 이제 shared `RadioGroup` · `CheckboxGroup` 의 상자 하나만 남는다 (생성 CSS · `apps/publish` 변경 0).

사용자 Preview 확인 (2026-10-03). 위치: `packages/shared/src/catalog/document/generated/reusableOriginLibrary.ts` (template) · `packages/shared/src/catalog/bindings/{RadioItems,CheckboxItems}.binding.ts` · `packages/shared/src/catalog/document/{rulePartRules.ts,manualBoxRules.ts,sizePropagation.ts,types.ts}` · `packages/shared/src/catalog/commands/collections.ts` (`insertGroupItem`) · `apps/builder/src/builder/catalogRuntime/{delegatedDom.tsx,presence.ts,itemInsert.ts,canvasBinding.ts}` · `apps/builder/src/builder/panels/styles/{catalog/catalogStylesHost.ts,utils/orientationDrivenTags.ts}`.

## [Preview 의 펼침 조작은 Preview 실행 상태 (Tree 펼침 복원) — ADR-250 Implemented] - 2026-10-03

### Fixed

- **Compare Mode 의 Preview 에서 Tree 항목이 펼쳐지지 않던 것.** 펼침 값을 문서 값에 묶어 두고 변경 처리기를 두지 않아 chevron 을 눌러도 아무것도 바뀌지 않았다. 이제 Preview 안에서 펼치고 접힌다.
- **DisclosureGroup 안 Disclosure 가 Properties 의 Expanded 변경을 Preview 에 반영하지 않던 것.** 그룹이 자식의 변경에 다시 그려지지 않았다.
- **인터랙션 규칙의 Tree 「펼치기」 가 Preview 에서 동작하지 않던 것.** 규칙이 넘기는 항목 key 하나를 Tree 가 읽지 못했다.

### Changed

- **Preview 에서 펼치고 접은 상태는 문서에 남지 않는다** (사용자 판정 2026-10-03, ADR-250 대안 B). 구 앱은 Preview 클릭을 문서에 다시 써 undo 기록 · 저장이 생겼는데, 새 Preview 는 그 값을 Preview 실행 상태로 둔다 — 인터랙션 규칙의 펼치기 · 접기와 같은 값이다. Canvas 는 문서에 선언된 값을 그리며, 문서에 남기려면 Properties 의 「Expanded」 를 쓴다. Builder 가 선언값을 바꾸면 Preview 가 그 값으로 돌아간다. 사용자 Compare Mode 확인 (2026-10-03). 위치: `apps/builder/src/preview/catalog/catalogPreviewInteractions.ts` (`setRuntimeProps`) · `apps/builder/src/builder/catalogRuntime/delegatedDom.tsx` (Tree · Disclosure · DisclosureGroup).

## [구 앱 대비 누락 동작 복원 (Pages 카메라 이동 · Border companion · Preview breakpoint · 복제 오프셋 · 거부 안내 · padding 연결 · 텍스트 줄바꿈 · 선택 상자 끌기 · 시스템 clipboard · 커스텀 폰트 · DPI · Layers drag 라벨 · Tab 순환 · Preview 라우팅 · Preview 클릭 선택 · Preview FileUpload endpoint) — ADR-248 Phase 4e 후속] - 2026-10-03

### Fixed

- **Compare Mode 의 Preview 에서 FileUpload 가 endpoint 를 찾지 못하던 것.** 구 Preview 는 Data 패널의 API endpoint 를 받아 FileUpload · API 바인딩이 읽게 했는데, 새 Preview 채널은 collection 과 변수만 보내 실제 전송 (`uploadDryRun` 끔) 이 늘 `E_NO_ENDPOINT` 였다. endpoint 를 runtime 투영 (`toRuntimeApiEndpoint` — 서버 비밀 매핑 없음, 비밀이 필요한 헤더는 `{{secret.NAME}}` 참조뿐이라 Preview 는 그 헤더를 보내지 않고 `E_UNAUTHORIZED`) 으로 같이 보내고 Preview 가 `CollectionDataContext` 로 넘긴다 (사용자 결정 2026-10-03).
- **Compare Mode 에서 Preview 의 요소를 클릭하면 Canvas 에서 선택되던 것** (⌘ · Ctrl 클릭은 선택에 넣고 빼기) 이 돌아왔다.
- **Preview 라우팅.** `/users/:id` 같은 `:param` 경로가 다시 맞고 (고정 경로 우선 · `?query` 무시), 맞는 page 가 없는 링크 · navigate 는 프로젝트의 `/404` page 로, 없으면 내장 「404 Page not found」 화면으로 간다 (전에는 조용히 무시). 새 모델의 Route 는 전체 경로라 상위 page 접두어 합성은 없다.
- Layers 를 끌 때 레이어 이름 · 「레이어 N개」 미리보기, 여러 개 선택에서 Tab · ⇧Tab 으로 주 요소 순환.
- 창을 픽셀 밀도가 다른 모니터로 옮기면 창 크기를 바꾸기 전까지 Canvas 가 흐리던 것 — 밀도 변화에 backing store 를 다시 맞춘다.
- **세션 중 올리거나 지운 커스텀 폰트가 새로고침 전까지 Canvas 에 반영되지 않던 것.** 폰트 목록이 바뀌면 Skia 폰트를 맞추고 글자를 다시 재서 그린다.
- **요소 복사 · 붙여넣기가 같은 창 안에서만 되던 것.** 구 앱처럼 복사가 시스템 clipboard 에도 실려 다른 탭 · 다른 프로젝트 · 새로고침 뒤에도 붙여넣을 수 있다. 그 사이 다른 글을 복사했으면 아무것도 붙지 않고 (구 규칙), clipboard 권한이 없으면 창 안의 복사본을 쓴다.
- **여러 개를 선택한 뒤 그 사이 빈 공간을 잡아 끌면 선택이 풀리고 marquee 가 시작되던 것.** 구 앱처럼 선택 상자 안의 빈 공간 (page 바탕 포함) 을 누르면 선택 전체가 끌린다. 상자 밖은 그대로 marquee.
- **텍스트 편집 중 Enter 로 넣은 줄바꿈이 저장은 되지만 Canvas 에서 접혀 보이던 것.** 구 앱처럼 줄바꿈이 있는 텍스트를 저장할 때 white-space 를 `pre-wrap` (`nowrap` 이면 `pre`) 으로 같이 올린다. Canvas 의 글자 상자 측정도 CSS white-space 를 따른다 — `normal` 은 줄바꿈을 공백으로 접고, `pre` 계열은 줄마다 상자가 커진다 (그림은 이미 그렇게 그리고 있었다).
- **Canvas 의 padding 핸들이 Styles 의 「변 연결」 토글을 무시하던 것.** 연결이 켜져 있으면 어느 변을 끌어도 4변이 같이 바뀐다 (인라인 입력도 같음). Styles 패널이 drag 중 값을 따라 보여 주고 편집 중인 변을 강조하던 것도 돌아왔다.
- **삭제 · 잘라내기 · 복제 · 그룹 · 그룹 해제가 거부될 때 아무 안내가 없던 것.** 구 앱처럼 이유를 toast 로 알린다 (page body · 부모가 다른 그룹 · 인스턴스 그룹 해제 · 중첩 규칙). 팔레트 삽입이 선택한 요소 대신 상위로 들어가면 「…에 놓였습니다」 안내와 되돌리기 버튼이 뜨고, 어디에도 못 들어가면 원문 코드 대신 중첩 규칙 안내가 뜬다.
- **복제 (⌘D) · 붙여넣기한 absolute 요소가 원본 바로 위에 겹쳐 놓이던 것.** 구 앱처럼 +10 px 어긋나게 놓고, 우클릭 「여기에 붙여넣기」 는 포인터 위치에 놓는다 (여러 개면 첫 요소가 포인터, 나머지는 간격 유지). 흐름 안 요소는 그대로.
- **Compare Mode 의 Preview 가 breakpoint 를 따르지 않던 것.** 구 앱은 Preview 창을 tablet 768 · mobile 390 폭으로 두고 반응형 재정의를 `@media` 로 적용했는데, 새 Preview 는 늘 desktop 으로 풀어 tablet · mobile 층이 보이지 않았다. 편집기의 breakpoint 가 Preview 에 전달되어 그 층으로 다시 풀고, Preview 창도 그 폭이 된다 (가운데 정렬 · pane 이 좁으면 스크롤).
- **Styles Border 에서 폭이나 색 하나만 바꾸면 테두리가 안 보이거나 Canvas 가 page 를 못 그리던 것.** 구 앱은 테두리 축 하나를 처음 쓸 때 나머지 (폭 1 · solid · 색 #d4d4d4) 를 같이 기록했는데, 전환 때 빠졌다 — 색만 고르면 아무것도 안 보이고, 폭만 올리면 Canvas 가 「could not draw this edit」 와 함께 page 를 비웠다. Styles 패널 · AI 도구의 스타일 쓰기가 노드의 현재 값에 없는 테두리 축을 같이 쓴다 (`none` 과 제거는 제외, 변별 폭은 shorthand 를 더하지 않음). 위치: `apps/builder/src/builder/catalogRuntime/styleFields.ts`.
- **Navigator Pages 트리에서 page 를 고르면 카메라가 그 page 로 한 번에 건너뛰던 것.** 구 앱은 현재 배율 그대로 page frame 을 화면 가운데로 300 ms ease-out 으로 옮겼는데, Phase 4e 전환 때 목표 위치 계산만 옮기고 애니메이션이 빠졌다. 애니메이션을 복원했다 — "programmatic" viewport session 으로 돌아 wheel · drag 를 시작하면 그 자리에서 멈춘다. 위치: `apps/builder/src/builder/workspace/canvas/viewport/animatePan.ts`. live (dev, 새 프로젝트 2 page): 수정 전 y −697 → 86 한 프레임, 수정 후 34 프레임에 걸쳐 감속 이동.

## [Catch-up 2026-09-30 ~ 2026-10-03] - 2026-10-03

ADR-248 Phase 4 (4a~~4e) — Builder 를 통합 catalog 문서 모델로 전환. 4a~~4d 는 제품에 연결하지 않은 새 runtime 보강이고, 사용자-가시 변경은 4e 병합 하나에 모인다. 근거: [ADR-248](adr/completed/248-unified-catalog-document.md) · [breakdown §5.1](adr/design/248-unified-catalog-document-breakdown.md) · [G5 근거](adr/design/248-phase4-g5-evidence.md).

### Breaking Changes

- **구 형식 프로젝트는 열리지 않는다.** 대시보드 목록에는 보이지만 열기는 이유와 함께 거부한다 (`UNSUPPORTED_PROJECT_FORMAT`). 구 JSON · 프로젝트 파일 가져오기도 같다. 구 데이터 변환·호환 adapter 는 만들지 않는다 (보존할 프로젝트 0 전제, 사용자 확인 2026-09-28).
- **헤더 Preview (publish 진입점) 는 명시 실패 안내를 띄운다.** `apps/publish` 가 아직 구 형식을 읽으므로 새 문서를 넘기지 않는다 — Publish 전환은 후속.

### Changed

- **ADR-248 Phase 4e — Builder 전체가 catalog workspace 위에서 동작한다.** 문서 = 코드 catalog 라이브러리 참조 + 프로젝트 override · 사용자 definition 의 typed graph, 사용자 조작 1개 = transaction 1개 = history 1개. Canvas (선택 · drag · resize · spacing · marquee · 인라인 편집 · context menu · 스냅 · 가이드 · 스크롤바) · Navigator (Layers · Pages · Components · Layouts) · Properties · Styles · Themes · Interactions · Data · History · 단축키 · AI 도구 · 파일 가져오기/내보내기 · 폴더 연결 · Preview 수신기가 같은 명령·읽기 계층을 쓴다.
- **저장은 새 IDB namespace + v2 프로젝트 파일 (ADR-235 컨테이너 + catalog 문서 part).** 자동 저장은 현재 revision 이 durable commit 된 뒤에만 「저장됨」, 실패는 failed, 다른 탭이 먼저 저장하면 conflict 로 중지한다.
- **컴포넌트 · 레이아웃 원본 편집 view.** 원본으로 이동 · 레이아웃 편집 · 완료, 기본 원본은 루트만 편집, 원본 편집 · 분리 · 해체 확인 대화상자. layout 적용 = page body 가 인스턴스, content 역할 slot 과 slot 역할 표시.
- **Layers 는 고른 탭의 내용만, 다중 선택 도구는 하단 Contextual Action Bar** (사용자 결정 2026-10-01).

### Added

- 요소를 만들 때 ID 자동 부여 (옛 customId 규칙) · 비운 ID 칸 placeholder = 실제 자동값.
- 바인딩된 목록 (ListBox · GridList · Table · TagGroup · Breadcrumbs · Chart) 의 데이터 행을 Canvas · Layers 가 같은 행으로 표시 (sample 10 · 「+N more」), Properties 항목 「+」.
- History 사용자 스냅샷 (복원 직전 자동 스냅샷) · 다국어 label · 비우기 확인, breakpoint · Canvas 카메라를 새로고침 · 다시 열기 뒤에도 유지, 색 · Styles 드래그 중 Canvas 미리보기, resize · spacing 드래그 중 실시간 reflow.

### Fixed

- **ADR-248 G3 live 에서 찾은 컴포넌트 시각 결함** — FileUpload (FileTrigger 상자 · DropZone 내용 · 엔진 column floor) · DateRangePicker xs 끝 입력 폭 · field 트리거 · Calendar nav 버튼 min-width 68 · 그룹 size 가 항목에 전달되지 않던 것 (ToggleButtonGroup · RadioGroup · CheckboxGroup · Slider track · TagGroup) · NumberField 트리거 size 별 높이 · Table 손 CSS 가 독립 Pagination 을 줄바꿈 · Tree chevron 축소 · 독립 Tag · GridListItem slot · Calendar 월 격자가 2026-09 로 고정되던 것 · labelPosition `side`. 결과: live G3 FAIL 0 · Preview 결함 추종 0.
- 팔레트 요소 (composite instance) 에 준 fill · layout 이 Canvas · DOM 에 닿지 않던 것.
- 브라우저 리사이즈 때 Canvas 가 비어 보이던 깜빡임 · AI 반영 확인의 padding/margin shorthand 거짓 실패.

### Performance

- **G5 (구 `2a5c97099` production 대조, CPU 4x · 5k 요소)**: 개별 편집 p95 540 → 42 ms · 저장 650 → 43 ms · 불러오기 3,778 → 1,805 ms, paired p95 36/36 · retained heap 새/구 0.56~0.89배 · 5k 문서 2,306,943 B. leaf 편집의 줄바꿈 후보 · Canvas geometry 비교를 영향 집합으로 좁힘 (명령 68.5 → 7.6 ms).
- initial bundle (gzip): Builder 1,413,531 → 1,228,752 B · Preview 624,427 → 394,104 B. Preview 부팅 시 받는 JS 645,249 B 는 기록값 — 사용자 판정 (a) 2026-10-03 으로 ADR-201 정의 (정적 initial) 기준 PASS, 상한 변경 없음.

### Removed

- 구 canonical 문서 · store · scene · renderer 경로 (삭제 1~~3차, 사용자 승인 목록 — breakdown 4e-9-1 · 4e-9-3~~8 · 4e-13-3). Builder import graph 의 구 모듈 진입 0 (G6).
- IDB `events` · `actions` mirror store (DB `composition` v24, data 세 store · asset 은 유지).

### Infrastructure

- pre-push · CI 의 옛 렌더 경로 시각 파리티 단계 제거. `perf/ratchet.json` 을 새 앱 기준으로 재기록 (구 기준은 삭제된 모듈 이름이라 비교 불가). perf 하니스는 `VITE_COMPOSITION_HARNESS=1` build 의 catalog 핸들로 동작 (일반 build bundle 동일).
