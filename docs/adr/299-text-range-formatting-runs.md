# ADR-299: 글자 범위 서식 — 한 글자 노드 안의 구간 서식 (run) 을 문서 · Canvas · 측정 · DOM · 패널 · 코드 보기가 같이 읽고, 입력은 ProseMirror core 가 맡는다

## Status

Proposed — 2026-11-02

- 사용자 요청: `/create-adr 범위 서식` (2026-11-02) — 같은 대화에서 Quill 의존성을 지운 직후 (`0a33873bb`, import 0 이던 패키지).
- 방향을 정한 사용자 원문 (2026-11-02): 「quill의 단점없이 범위 서식 기능을 하려면 자체 구현밖에 없나?」 → 권고 「입력 층은 ProseMirror core, 나머지 다섯 층 (문서 모델 · Canvas · 측정 · Preview/Publish · 패널) 은 어느 라이브러리를 골라도 직접」 → 「각각 라이브러리들 모두 라이센스가 오픈일것인데 소스코드 분석해서 우리것에 맞춰 만들어서 하는것이 낮지않나?」 → 권고 「모델 · 명령 · 렌더 · 측정은 참고해서 우리 것으로, 입력 view (`prosemirror-view`) 는 고치지 않은 의존성으로 두고 변환 층 하나」 → `/create-adr`.
- 사용자가 이미 답한 것: 라이선스는 걸림돌이 아니다 (ProseMirror · Lexical · Slate MIT, Quill BSD-3). 입력 view 를 포크하지 않는 이유 (브라우저별 IME · selection 예외 처리가 upstream 에서 계속 들어와야 한다) 는 대안 E 의 기각 사유로 적었다.
- 선행 ADR 의 기록: [ADR-027](completed/027-inline-text-editing.md) 은 리치 텍스트 (구 D-1) · 툴바 (구 D-3) 를 **보류** 했고 재개 조건을 「canonical 텍스트 모델이 인라인 스타일 run 을 담는 ADR 이 Implemented 된 뒤」 로 적었다 (027 §보류). 이 ADR 이 그 선행 ADR 이다.
- ADR 분리 4 질문 lock-in: breakdown §1 (299 = base — 글자 값의 **구간** 축. 027 은 편집 상자의 전환 무결성, 205 는 글자 축의 computed seam, 298 은 값의 토큰 참조 — 셋 다 직교).
- 리뷰 round 1 ([reviews/299.md](reviews/299.md), 2026-11-02 codex — HIGH 3) 반영: h1 템플릿 토큰 원자 (Decision 1 · 4, F17) · h2 장식선 전파 (Decision 2, F18) · h3 편집 범위 (Decision 4 · 5, F19). Gate G2 · G3 · G4 에 반례 fixture 추가.
- 리뷰 · 착수는 사용자 요청 때 (`review-adr` · `/execute-adr 299`). 아래 「사용자 결정 5건」 은 execute-adr 가 그 Phase 에 닿을 때 묻는다.

> 구현 상세: [design/299-text-range-formatting-breakdown.md](design/299-text-range-formatting-breakdown.md)

## Context

### 도메인

- **D3** (시각 스타일) 안의 결정이다. 지금 노드 하나가 갖는 글자 값 (`fontWeight` · `fontStyle` · `textDecoration` · `color` · `fontSize` …) 에 **구간** 축을 더한다 — 값의 이름 · 형 (리터럴 · `TokenUse`, ADR-298) 은 그대로이고, 구간 값은 두 consumer (Builder Skia · Preview/Publish DOM) 가 같은 문서 값에서 그린다.
- **D1 경계 이동 없음**: RAC `Text` · `Heading` 은 `children: ReactNode` 라 안에 `<span>` 을 두는 것은 RAC 의 계약 안이다 (D1 소비). 구간 `<span>` 은 role · ARIA 가 없다.
- **D2**: 새 prop 0. binding 의 `children: { kind: "string" }` (F1) 은 그대로이고, 바뀌는 것은 그 prop 이 담는 **값의 모양** (문자열 → 문자열 | 구간 목록) 이다 — 그 값은 RAC `Text` · `Heading` 의 `children` (ReactNode) 로 간다.
- **문서 스키마 변경 있음** — `AuthoredValue` 에 구간 글자 형 하나 (아래 Decision 1). `LIBRARY_CONTRACT_VERSION` 52 → 53 (`types.ts:146`). 개발 단계라 **변환 코드 0** — 52 문서는 거부 · 재생성 (ADR-278 h1 과 같은 정책, 메모리 `feedback-no-document-migration-code-dev-stage`).
- **Generator 확장 선언** (adr-writing 선차단 #2): 생성 CSS (`generate-css.ts` · `CSSGenerator.ts`) 는 **바뀌지 않는다**. 구간 값은 작성 값이라 노드 inline 값과 같은 길 (DOM inline style · 토큰은 `var(--catalog-token-*)`, ADR-298) 로 나간다 — rule 은 구간을 모른다.

### 문제

사용자는 글자 노드 하나 안에서 일부만 굵게 · 다른 색 · 다른 크기로 적을 수 없다. 지금은 글자 값이 **노드 단위** 이고 편집 상자는 `<textarea>` 라 한 문장 안 구간은 노드를 쪼개는 수밖에 없는데, 노드를 쪼개면 줄바꿈이 구간 경계에서 끊긴다 (대안 A). ADR-027 이 리치 텍스트를 보류한 이유도 데이터 모델이 plain string 이어서였다.

### 코드 사실 (2026-11-02, main `0a33873bb`)

| #   | 사실                                                                                                                                                                                                                                                                                                                                                                                                   | 근거                                                                                                                                                                               |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F1  | 글자는 `props.children` (Text · Paragraph · Heading — binding `children: { kind: "string" }`) · `label` · `value` 의 **문자열 하나**. 편집 상자는 그 순서로 첫 문자열 키를 고른다. props 는 breakpoint 층이 없다 (`PROPS_NOT_RESPONSIVE`)                                                                                                                                                              | `bindings/Text.binding.ts:31` · `catalogRuntime/canvasText.ts:14, 21-28` · `commands/fields.ts:101-102`                                                                            |
| F2  | prop 값의 형 `AuthoredValue` = `Scalar · TokenUse · StructuredValue (string[] · ItemValue[]) · CalendarDuration · NumberFormatValue · PropWhen · PropVar` — 구간 글자 형은 없다. 검증은 `authoredValue(item, …, structured = props)`                                                                                                                                                                   | `document/types.ts:249-256, 200` · `document/validation.ts:865-866`                                                                                                                |
| F3  | 글자 값은 노드 `visual` 하나 (`VisualField` — `color` · `fontSize` · `lineHeight` · `fontWeight` · `fontFamily` · `fontStyle` · `letterSpacing` · `textAlign` · `textTransform` · `textDecoration` · `whiteSpace` · `wordBreak` …). 읽기는 `catalogTextTypography` (`visual[key] ?? inheritedText[key]`). Button · ToggleButton 은 `CATALOG_TEXT_STYLE_CONTAINERS` 로 Text 자식에 닿는다               | `types.ts:303-363` · `runtime/boxModel.ts:189-222, 281-314` · `runtime/compositionRoot.ts:349`                                                                                     |
| F4  | 편집 상자는 `<textarea>` (Quill 아님 — 옛 오버레이는 ADR-248 Phase 4e-9-1 `988e5177a` 에서 삭제). 입력은 `previewRecord` (문서 · History 쓰기 0), 커밋은 `setFields({ props: { [key]: text } })` 한 명령 (label 「Edit text」) — Escape · ⌘Enter · blur · unmount                                                                                                                                      | `canvas/catalog/CatalogTextEditor.tsx:174-245, 364-388` · `canvasText.ts:47-65`                                                                                                    |
| F5  | 편집 상자는 Skia 가 그리는 모든 글자 설정을 CSS 로 되돌려 같은 모양으로 보인다 (`skiaTextCss`) — 노드 단위 값 하나                                                                                                                                                                                                                                                                                     | `CatalogTextEditor.tsx:321-362, 399-434`                                                                                                                                           |
| F6  | Canvas 글자 노드 (`SkiaNodeData.text`) 는 노드 단위 값뿐 (구간 필드 0). SkParagraph 하나에 `TextStyle` 하나 (`runTextStyle`). **구간 push 는 이미 쓴다** — 합성 small-caps 가 소문자 run 만 축소 TextStyle 로 `pushStyle · addText · pop`                                                                                                                                                              | `canvas/skia/nodeRendererTypes.ts:86-118` · `catalogRuntime/canvasBinding.ts:525-605` · `nodeRendererText.ts:731-761` · `utils/smallCapsSynthesis.ts:68`                           |
| F7  | 장식선 · 자간 · baseline 보정은 SkParagraph 가 아니라 Canvas 가 Chrome 규칙으로 줄마다 직접 그린다 (`drawCssDecorations` · `cssLetterSpacingShift` · `cssBaselineShift`) — 노드의 글꼴 하나로. 구간마다 색 · 두께 · 크기가 다르면 구간 rect 가 필요. retained paragraph 키도 노드 값뿐                                                                                                                 | `nodeRendererText.ts:233-250, 426-472, 492, 497` · `textDecorationGeometry.ts:27-54` · `skia/textParagraphKey.ts:9-60`                                                             |
| F8  | 측정은 `measure(text, font, maxWidth)` — `CatalogTextFont` 하나로 Canvas 와 같은 paragraph 를 지어 max · min · 줄 수 · 높이 (`paragraphMetrics` — `pushStyle` 1 · `addText` 1); `fontBox(font)` 는 한 글꼴의 ascent · descent · x-height. leaf 는 자식 없는 노드만 (`textLeaf`). 엔진 입력은 `contentMinWidth · contentMaxWidth · contentHeight · leafBaseline` 숫자뿐 — **Rust 엔진은 글자를 모른다** | `compositionRoot.ts:640-653, 766-779, 784-890, 1186-1261, 1376, 3549-3561` · `catalogRuntime/textMeasure.ts:33-108, 120, 154`                                                      |
| F9  | DOM 의 Text 는 RAC `Text` (`span.react-aria-Text`) 이고 글자는 `String(node.props.children ?? "")` 하나 — Heading (RAC `Heading`) · Paragraph (`<p>`) · Label · Description 도 같다. 글자 값은 `catalogDomStyle` 이 요소 하나의 inline style 로 쓴다. Publish 는 같은 shared 렌더러. `packages/rendering` 의 `resolveTextSourceText` 도 문자열을 읽는다                                                | `runtime/domBinding.runtime.ts:353-362, 561, 664-720, 887-993` · `apps/publish/src/App.tsx:16-26` · `rendering/src/renderers/utils/textSource.ts:137`                              |
| F10 | Design 패널 Typography 는 첫 선택 노드 하나의 값 (`useTypographyValues` — 키마다 문자열 하나) 을 읽고 `updateStyle(key, value)` 로 선택 전부에 쓴다. 「Mixed」 는 Padding 네 변에만 있다 — 글자 축 · 선택 구간 개념 없음                                                                                                                                                                               | `panels/styles/sections/TypographySection.tsx:128-192, 311-364` · `hooks/useTypographyValues.ts:76` · `catalog/catalogStylesHost.ts:451-458, 634-635` · `PaddingFields.tsx:5, 104` |
| F11 | 코드 보기는 요소의 글자 ↔ `children` (plain · `{{ }}` 템플릿 · 행 필드) 을 양방향으로 투영한다 (ADR-285 · 296)                                                                                                                                                                                                                                                                                         | `catalogRuntime/codeViewEdit.ts:1419, 2270-2280, 2411`                                                                                                                             |
| F12 | 글자 안 `{{ 변수 }}` 템플릿은 문자열을 훑어 변수 참조로 모은다 — 구간 값도 같은 사이트 수집에 들어가야 한다. 편집 상자는 템플릿을 적힌 대로 (`templateProps`) 편집한다                                                                                                                                                                                                                                 | `runtime/variableReferences.ts:224, 285, 346` · `resolution/resolver.ts:404-406` · `canvasText.ts:30-39`                                                                           |
| F13 | History: `patchNodeProp` 은 늘 레이아웃 변경으로 센다 (`PAINT_ONLY_VISUAL_KEYS` 는 visual 만 — `color` · `textDecoration` 포함, `fontWeight` · `fontSize` 는 아님). 구간 값은 `props.children` 안이라 늘 레이아웃 변경                                                                                                                                                                                 | `transactions/transaction.ts:155-174, 227-238`                                                                                                                                     |
| F14 | 번들 HEAD (ADR-298 Phase 5) Builder 1,397,096 · Preview 321,847 B gz — 상한 1,400,000 · 325,000 (만료 2026-11-25). **여유 2,904 · 3,153 B**                                                                                                                                                                                                                                                            | [ADR-201 재승인 절](completed/201-large-file-upload-engine-component-server-contract.md) (2026-11-02)                                                                              |
| F15 | 외부 편집기 (2026-11-02 npm): prosemirror-model 1.25.12 · state 1.4.4 · view 1.42.9 · transform 1.12.4 (전부 MIT) · lexical 0.53.0 (MIT) · slate 0.147.4 (MIT) · quill 2.0.3 (BSD-3). 저장소에 편집기 의존성 0 (CodeMirror 6 은 코드 보기 전용). run · span · mark 데이터 모델은 어느 ADR 에도 없다                                                                                                    | `apps/builder/package.json:21-28` · `docs/adr` grep                                                                                                                                |
| F16 | 글자 세로 자리의 대칭은 2026-11-02 에 맞췄다 — Chrome 줄 상자 baseline 식 · strut · `vertical-align: middle` 을 엔진 입력으로. SkParagraph 는 baseline 을 정수 px 로 반올림 (raster 로 재야 보인다)                                                                                                                                                                                                    | `928c90685` · 메모리 `reference-skparagraph-rounds-baseline-vs-chrome-line-box`                                                                                                    |
| F17 | 템플릿 토큰은 `{{ name(.seg)* }}` (이스케이프 `\{{`) 이고 해석 (`resolveStateTemplate`) · 참조 수집 (`collectStateTemplateRefs`) · 이름 변경 모두 **문자열 하나 안에서** 정규식으로 찾는다 — 서식 경계가 토큰 안에 생기면 세 길 모두 그 토큰을 못 본다 (리뷰 h1 이 공용 resolver 로 실행: 분할 run 은 원문 그대로 · refs `[]`)                                                                         | `state/template.ts:21-22, 66-90` · `state/stateDependencies.ts:20-35` · `runtime/variableReferences.ts:216-224`                                                                    |
| F18 | 장식선은 CSS 에서 상속이 아니라 **전파** 다 — 자손이 `text-decoration: none` 으로 지울 수 없다 ([CSS Text Decoration 3 §2](https://www.w3.org/TR/css-text-decor-3/#line-decoration)). 지금 DOM 은 글자 요소 자신과 글자 축 container (body · frame · Group · Slot · Button · ToggleButton …) 요소에 `textDecoration` 을 쓰고, Canvas 는 그 값을 상속 키처럼 읽는다                                     | `domBinding.runtime.ts:705-706, 2997-3008` · `compositionRoot.ts:334-358`                                                                                                          |
| F19 | 편집 상자는 blur 에 `commit` = `save` + `endTextEdit` 이고 session 은 `textEditing` 을 지운다. Typography 의 Font Size 입력 · 색 팝오버는 편집 상자 밖의 다른 focus 표면 — 지금 길이면 패널을 누르는 순간 편집이 끝난다                                                                                                                                                                                | `CatalogTextEditor.tsx:222-228, 376` · `catalogRuntime/session.ts:238-240` · `TypographySection.tsx:181`                                                                           |

### Hard constraints

- **대칭**: 구간이 섞인 글자의 Canvas ↔ Preview 글리프 자리 차 ≤ 0.5 scene px (Compare Mode, 500% — F16 의 해상도 한계) · 줄바꿈 위치 동일 · 상자 크기 동일 (엔진 입력 = Canvas paragraph 측정). 구간 크기가 다른 줄의 baseline 은 Chrome 줄 상자 규칙 (가장 큰 inline 의 ascent 가 줄 baseline 을 정한다, CSS 2.1 §10.8.1) 을 따른다.
- **번들** (F14): 초기 번들 Δ 는 Builder ≤ +2,900 · Preview ≤ +3,150 B gz 가 아니면 ADR-201 재승인 절 (사용자 승인) 이 필요하다. 편집기 (ProseMirror) 는 글자 편집 진입 때 `import()` — 초기 번들 Δ 0 이 조건 (`adr201-bundle-gate.mjs` 와 같은 판정 — initial closure 에 chunk 없음).
- **성능**: 글자 측정 · Canvas paragraph 는 프레임 경로다. 구간이 **없는** 글자 (문서의 대다수) 는 측정 · 그리기 · 캐시 키가 전환 전과 같은 호출 수 (ratchet `pnpm gate:perf-ratchet`, ADR-246). 구간이 있는 글자는 run 수에 선형.
- **입력**: 한글 IME 조합 중 문서 쓰기 0 · 조합 끝에 글자 하나로 들어온다 · ⌘Z 는 편집 상자 안에서는 편집기의 되돌리기, 커밋 뒤는 History 한 단계 (지금 F4 와 같은 「한 명령」). 대상 브라우저 Chrome + WebKit (메모리 `user-browser-targets-firefox-not-priority`).
- **문서 정책**: contract 53 · 변환 코드 0 · 구간이 없는 글자는 **문자열 그대로** (저장 모양 무변경 — 문서 크기 · 코드 보기 · AI · 클립보드 호환).
- **상태 변경 파이프라인 순서 보존** (`명령 → workspace.execute → … → Autosave → Preview delta`): 편집기의 매 키 입력은 `previewRecord` (문서 쓰기 0), 커밋만 명령 — F4 그대로.

### Soft constraints

- 패널 어휘는 비개발자 (메모리 `user-non-developer-list-first-mental-model`) — 「run」 「mark」 는 코드 이름이고 화면엔 「선택한 글자」.
- 기능 단위는 다섯 표면 동시 (catalog · Canvas · Design/Properties · Interactions · Code — 메모리 `project-feature-unit-spans-catalog-canvas-code-panels`): 코드 보기 투영 · 적용도 이 ADR 안이다. 「필요해지면」 으로 미루지 않는다 (메모리 `feedback-design-whole-scope-upfront-no-deferral`).
- 외부 레퍼런스: Figma 는 글자 노드 하나 안 구간 서식 (`getStyledTextSegments` — fontSize · fontName · fontWeight · textDecoration · textCase · lineHeight · letterSpacing · fills · hyperlink) 이고 패널은 섞이면 「Mixed」. Pencil 은 Quill 로 입력 (ADR-027 §Pencil). ProseMirror 는 Atlassian · NYT · GitLab (Tiptap) 편집기의 입력 층, Lexical 은 Meta 의 편집기.

## Alternatives Considered

### 대안 A: 노드 분할 — 구간마다 Text 노드, 부모가 inline 흐름

- 설명: 문서 모델 무변경. 「굵게」 는 글자를 세 노드 (앞 · 굵은 부분 · 뒤) 로 쪼개 inline 흐름에 세운다.
- 위험: 기술 **HIGH** — 엔진의 inline 흐름은 atomic inline 상자 단위 (`block.rs` line box) 라 구간 **안** 에서 줄바꿈이 안 된다: 「굵은 부분」 이 한 단어가 아니면 줄 끝에서 통째로 다음 줄로 떨어진다 (CSS 의 `<span>` 은 안에서 꺾인다). 성능 L / 유지보수 **HIGH** (편집 · 선택 · 패널이 「한 문장 = 노드 여러 개」 를 매번 합쳐야 함 — 더블클릭 편집 대상이 셋) / 마이그레이션 L.

### 대안 B: 구간 모델 + 자체 입력 (`contenteditable` 직접)

- 설명: Decision 1 의 구간 모델을 문서에 두고, 편집 상자를 `<textarea>` 에서 자체 `contenteditable` 로 바꿔 selection · 조합 · 붙여넣기 · 단축키를 직접 처리.
- 위험: 기술 **HIGH** (한글 IME 조합 · WebKit selection · 붙여넣기 정제 — 브라우저별 예외가 누적되는 층이고 테스트로 잡기 어렵다) / 성능 L / 유지보수 **HIGH** (브라우저 업데이트마다 우리가 고친다) / 마이그레이션 L.

### 대안 C: 구간 모델 + ProseMirror core (model · state · transform · view · keymap) 를 **입력 층으로만**, 편집 진입 때 lazy (채택)

- 설명: 정본은 catalog 문서 (Decision 1). 편집 상자를 열 때 구간 → PM 문서, 키 입력마다 PM 문서 → 구간 → `previewRecord`, 커밋은 `setFields` 한 명령 (F4 그대로). PM schema 는 우리가 허용한 mark 만 선언 (어휘 밖 서식은 들어오지 못한다). 되돌리기는 PM `history` 를 쓰지 않고 편집 중 PM 자체 단계 · 커밋 뒤 History (F4). Canvas 는 계속 Skia 가 그린다 — PM 은 편집 상자 안 DOM 뿐이고 그 CSS 는 F5 의 역변환.
- 위험: 기술 M (변환 층 하나 · 「IME 조합 중 previewRecord 가 상자를 키우는가」 는 Phase 0 RED) / 성능 M (PM 4 패키지 lazy — 초기 Δ 0 조건, 편집 진입 지연은 첫 1회) / 유지보수 L (upstream 이 브라우저 예외를 고친다 · 우리 코드는 schema + 변환) / 마이그레이션 L (의존성 삭제 = 편집 상자만 textarea 로 되돌아감, 문서 무변경).

### 대안 D: Quill · Lexical · Slate 처럼 편집기가 모델을 소유

- 설명: 편집기의 문서 (Quill Delta · Lexical EditorState) 를 글자 노드의 정본으로 저장.
- 위험: 기술 M / 성능 M (Quill 2 · Lexical 은 자기 DOM · CSS 로 그리고 Preview 도 그 렌더러를 실어야 Δ 0 이 아니다) / 유지보수 **HIGH** (문서 정본이 둘 — catalog 값 형 (`TokenUse` · 298 토큰 참조) 과 편집기 형식을 계속 맞춘다 · 코드 보기 · AI · 클립보드가 편집기 형식을 알아야 함) / 마이그레이션 **HIGH** (편집기 교체 = 문서 변환).

### 대안 E: 라이브러리 소스를 포크해 우리 모델에 맞춰 고친다 (사용자 질문)

- 설명: MIT 라이선스라 `prosemirror-view` 등을 가져와 우리 구간 모델을 직접 읽게 고친다.
- 위험: 기술 M / 성능 L / 유지보수 **HIGH** — 입력 view 의 가치는 구조가 아니라 쌓인 브라우저별 예외 처리 (Chrome · Safari · 한글 IME 분기) 이고, 포크하면 upstream 수정이 더는 안 들어온다. 레이아웃 엔진 (Taffy → 자체) 때는 스펙이 고정돼 있어 상류 대조가 가능했지만 (메모리 `project-taffy-upstream-delta-2026-09`), 입력은 스펙이 아니라 브라우저 동작을 따라가야 해 대조 비용이 더 크다. 모델 · 명령 쪽은 어차피 우리가 만든다 (대안 C 와 같음 — 그 부분은 포크가 아니라 참고). / 마이그레이션 M.

### Risk Threshold Check

| 대안 | HIGH+                   | 판정                                    |
| ---- | ----------------------- | --------------------------------------- |
| A    | 기술 · 유지보수         | 기각 — 구간 안 줄바꿈 불가              |
| B    | 기술 · 유지보수         | 기각 — 브라우저 입력 예외를 우리가 진다 |
| C    | 없음                    | **채택**                                |
| D    | 유지보수 · 마이그레이션 | 기각 — 정본 둘                          |
| E    | 유지보수                | 기각 — upstream 수정 단절               |

루프 불필요 (C 에 HIGH 0). 모델 · 명령 · 렌더 · 측정 층은 어느 대안이든 우리 것 — 사용자 질문의 「직접 만들기」 는 그 층에서 그대로 성립하고, 갈리는 것은 입력 view 뿐이다.

## Decision

### Decision 1 — 문서 모델: 글자 값은 문자열 또는 구간 목록, 구간 값은 노드 visual 과 같은 키 · 같은 형

- `AuthoredValue` 에 `RichText` 하나: `{ kind: "text", runs: [{ text, marks? }] }`. `marks` 는 노드 visual 의 글자 키 부분집합 (`fontWeight` · `fontStyle` · `textDecoration` · `color` · `fontSize` — 사용자 결정 1) 이고 값 형은 visual 과 같다 (리터럴 · `TokenUse`, ADR-298). 정규형: 빈 run 없음 · 이웃한 같은 mark 는 합침 · mark 없는 run 만 남으면 **문자열로 되돌린다** — 구간이 없는 글자는 저장 모양 무변경 (hard constraint).
- 구간 값은 노드 값 위에 덮인다 (노드 `fontWeight` 700 + 구간 400 = 그 구간만 400). 노드 값을 지워도 구간 값은 남는다. props 라 breakpoint 층이 없는 것 (F1) 도 그대로다.
- **템플릿 토큰은 원자다** (F12 · F17, 리뷰 h1): `{{ … }}` 토큰 (이스케이프 `\{{` 포함) 은 run 하나 안에 통째로 있고 run 경계는 토큰 안에 올 수 없다. 구간 쓰기 (`applyMarks` · `clearMarks` · PM) 는 구간 끝을 토큰 밖으로 넓힌다 — 토큰 일부를 굵게 = 토큰 전체를 굵게. 편집 중 타이핑으로 경계가 토큰 안에 생기면 정규형이 토큰 전체를 그 토큰 첫 글자의 mark 로 맞춘다. 모든 쓰기 길 (편집 상자 · 패널 · 코드 보기 · AI · seed) 은 정규형을 거치고 `validation.ts` 는 토큰을 가르는 값을 거부한다. 그래서 해석 · 참조 수집 · 이름 변경은 run `text` 마다 지금 함수를 그대로 쓰고 결과가 같은 글자의 문자열 값과 같다 — 치환 값의 길이가 달라도 mark 는 그 run 전체라 값 전체에 걸린다.
- 대상은 글자 노드 자신의 `children` 뿐 (Text · Paragraph · Heading · Link). 부모 prop 에 묶인 글자 (`label` · `title` · `placeholder` — ADR-254 Decision 5) 는 **문자열 그대로** — 그 prop 의 D2 형이 string 이고, Button 의 label 같은 한 단어 글자는 구간 서식의 대상이 아니다 (S2 Button children 도 서식 없는 글자).
- contract 53 · 변환 0 (Context §도메인). `validation.ts` 는 run 의 `marks` 키를 글자 visual 키 집합으로 검사한다 (어휘 밖 키 거부).

### Decision 2 — 두 consumer: Canvas 는 run 마다 `pushStyle`, DOM 은 run 마다 `<span>` inline style

- Canvas: `canvasBinding` 의 글자 노드에 run 목록 (F6 `content` 옆), `nodeRendererText` 가 small-caps 구간 push 와 같은 길로 run 마다 TextStyle 을 민다 (노드 TextStyle 위에 mark 만 덮은 사본). 장식선 · 자간 · baseline 보정 (F7) 은 run 의 글리프 rect (`paragraph.getRectsForRange`) 로 run 의 색 · 두께 · 글꼴로 그린다. retained paragraph 키 (`textParagraphKey`) · 줄바꿈 힌트 (`measureWithCanvas2D` 의 `TextMeasureStyle`) 에 run 이 들어간다.
- DOM: `text` · `heading` · `paragraph` binding 의 글자 (F9) 가 run 마다 `<span style>`. 상속 속성인 mark (굵기 · 기울임 · 색 · 크기) 는 span 에 mark 만 쓴다 (노드 값은 바깥 요소가 이미 갖는다). 토큰 값은 ADR-298 의 `var(--catalog-token-*)`. `<strong>` · `<em>` 을 쓰지 않는다 — 의미 요소를 넣으면 D1 (접근성 의미) 을 시각 축이 바꾸게 된다. Publish 는 같은 shared 렌더러. `resolveTextSourceText` (rendering) 는 run 을 이어 붙인 plain 을 돌려준다.
- **장식선은 span 으로 옮긴다** (F18, 리뷰 h2): 글자가 RichText 이면 바깥 요소는 노드 자신의 `textDecoration` 을 쓰지 않고, mark 없는 run 까지 **모든 run 이 span** 이 되어 각 span 에 실효 장식선 (run mark ?? 노드 값) 을 쓴다 — `none` 구간은 실제로 밑줄이 없고, 밑줄 색은 CSS 규칙대로 그 span 의 color 라 Canvas 의 「run 색으로 그린다」 와 같다. 편집 상자 (F5 역변환) · PM mark 의 DOM 도 같은 규칙. inline-block 으로 감싸 전파를 끊는 방법은 run 안 줄바꿈을 깨므로 쓰지 않는다.
- **조상 장식선은 두 쪽 다 지우지 않는다**: 글자 축 container (F18) 가 쓴 장식선은 CSS 에서 자손이 지울 수 없으므로, Canvas 도 run mark 와 관계없이 모든 run 에 그대로 그리고 run 의 장식선은 그 위에 더한다 (CSS 와 같은 합집합). 조상 장식선의 색 · 두께는 CSS 규칙대로 조상 상자의 값 — 지금 Canvas 가 어느 값으로 그리는지는 Phase 0 인벤토리에서 확인하고 G2 fixture 로 고정한다. 패널의 구간 장식선 값은 노드 · run 값만 바꾼다 (조상 값은 조상에서).
- 생성 CSS 무변경 (Context §Generator).

### Decision 3 — 측정: 글꼴 하나가 아니라 run 목록으로 paragraph 를 지어 재고, 엔진 입력은 그대로 숫자

- `CatalogTextMeasure` 의 입력에 run 목록 (글자가 문자열이면 run 하나) — `paragraphMetrics` 가 Canvas 와 같은 builder 로 짓는다 (측정 · 그리기가 같은 함수 — 지금도 그 원칙). 엔진은 바뀌지 않는다 (F8). `leafBaseline` 은 첫 줄에서 가장 큰 run 의 글꼴 상자 (Chrome 줄 상자 규칙 — hard constraint) 로 계산한다. `fontBox` 는 run 마다 글꼴로 호출. Canvas 2D 폴백 (CanvasKit 준비 전) 은 run 마다 글꼴을 바꿔 잰다.

### Decision 4 — 입력: ProseMirror core 를 편집 진입 때 lazy 로, schema 는 Decision 1 의 mark 만

- 패키지: `prosemirror-model` · `prosemirror-state` · `prosemirror-transform` · `prosemirror-view` · `prosemirror-keymap` (history 는 쓰지 않는다 — 편집 중 되돌리기는 PM 단계를 우리가 들고, 커밋 뒤는 History). schema: `doc(inline*)` = text + `hard_break` (`\n`), marks = 사용자 결정 1 의 축. 어휘 밖 서식 (붙여넣기의 `<h1>` · 표) 은 schema 가 버린다 — 붙여넣기는 **글자만** (mark 도 우리 어휘에 맞는 것만).
- 템플릿 토큰 (Decision 1): PM 문서에서도 글자 그대로 두고 (타이핑으로 만들어지므로 atom 노드가 아니다), plugin 하나가 mark step 의 구간을 토큰 밖으로 넓히고 `fromDoc` 이 정규형으로 토큰을 한 run 에 맞춘다.
- 편집 상자 (`CatalogTextEditor`) 는 상자 배치 · 글자 설정 역변환 (F5) · previewRecord · 커밋 (F4) 을 그대로 두고, `<textarea>` 자리에 PM `EditorView` 를 마운트한다. 변환 층 `textRuns.ts` 하나: run ↔ PM 문서 (양방향, 정규형 유지).
- 단축키: ⌘B · ⌘I · ⌘U (편집 상자 안에서만). 툴바는 두지 않는다 (사용자 결정 2).
- **편집 범위** (F19, 리뷰 h3): 편집 세션은 편집 상자 하나가 아니라 **편집 상자 + Typography 절 + 그 절이 연 팝오버 (색 · 토큰 선택 — portal)** 다. 이 범위 안으로 focus 가 옮겨 가면 커밋하지 않는다 — `EditorView` 는 마운트된 채 PM `EditorState` (selection · storedMarks · draft) 를 그대로 들고, 선택 구간은 focus 가 없어도 보이게 그린다 (브라우저 selection 은 blur 때 사라지므로 PM decoration). 범위 경계는 DOM 표지 하나 (`data-text-edit-scope`) — 편집 상자 · Typography 절 root · 그 절의 팝오버 portal 에 붙이고, `focusout` 의 `relatedTarget` 또는 `pointerdown` 대상이 표지 밖일 때만 커밋한다. 커밋 조건 = 범위 밖으로 나감 · Escape · ⌘Enter · 선택 변경 · unmount (지금 F4 의 「blur」 를 「범위 밖 blur」 로 바꾼 것 — 커밋은 여전히 한 명령). 패널은 편집기가 등록한 handle (읽기 = 선택 구간 marks, 쓰기 = PM transaction) 로만 편집기에 닿는다.
- 편집기 chunk 는 initial closure 밖 (`import()` on `startTextEdit`) — 번들 Gate.

### Decision 5 — 패널: 편집 중이면 선택한 글자, 아니면 노드

- Typography 절 (F10) 은 편집 중 (`session.textEditing` + PM selection) 이면 선택 구간의 값을 읽고 쓴다 — 섞이면 「Mixed」 (Figma). 패널 클릭은 편집 범위 (Decision 4) 안이라 편집을 끝내지 않는다. 쓰기는 편집기 handle 의 PM transaction (`addMark` · `removeMark`) → previewRecord (문서 쓰기 0) → 커밋 때 한 명령. 편집 중이 아니면 지금처럼 노드 값 — 노드 값 변경이 구간 값을 지우지 않는다 (Decision 1). 구간이 있는 노드를 패널이 노드 단위로 읽을 때 섞인 축은 「Mixed」 로 보이고, 쓰면 노드 값 + 구간 값 **전부** 그 값으로 (Figma — 사용자 결정 3).

### Decision 6 — 코드 보기 · 클립보드 · AI

- 코드 보기 (F11): `<Text>` 의 children 에 run 을 `<span style={{…}}>` 로 투영하고, 적용은 그 모양을 다시 run 으로 (닫힌 어휘 — ADR-285 Decision 「편집은 닫힌 어휘 전체」). 어휘 밖 JSX 는 지금처럼 거절.
- 클립보드: catalog 클립보드 (`clipboardText.ts`) 는 entries 통째라 run 이 따라간다. 글자만 복사 (편집 상자 안 ⌘C) 는 plain text + 우리 mark 를 PM clipboard serializer 로 (외부 앱엔 plain).
- AI 패널 · 데이터 바인딩이 글자를 쓰는 길 (`setFields` children 문자열) 은 문자열 그대로 — run 이 있는 글자에 문자열을 쓰면 구간이 사라진다 (바꿔 쓰기 = 서식 초기화). 변수 참조 수집 · 이름 변경 (F12) 은 run 마다 — 토큰이 원자라 결과가 문자열 값과 같다 (Decision 1).

### 기각 사유 요약

- A: 구간 안 줄바꿈 불가 (엔진 inline 은 atomic 상자). B · E: 브라우저 입력 예외 층을 우리가 진다. D: 정본이 둘 — 값 형 (`TokenUse`) · 코드 보기 · 클립보드 · AI 가 편집기 형식을 알아야 하고, Preview 가 편집기 렌더러를 싣는다.

### 위험 수용 근거

C 의 잔존 위험은 변환 층 (run ↔ PM) 과 WebKit IME 의 실측 부재다. 변환 층은 순수 함수라 fixture 로 전수 (정규형 · 되돌림 · `\n` · 빈 문서 · 템플릿) 가 가능하고, IME 는 Phase 0 의 RED 에 넣어 go/no-go 를 먼저 본다 — no-go 면 입력 층만 바꾸면 되고 문서 · 렌더 · 측정은 그대로다.

### 사용자 결정 5건 (execute-adr 가 닿을 때 묻는다)

| #   | 결정                                                                  | 권고                                                                                                                                                                                |
| --- | --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | 구간에 적용할 축                                                      | `fontWeight` · `fontStyle` · `textDecoration` · `color` · `fontSize` 다섯. `fontFamily` · `letterSpacing` 은 Figma 는 되지만 S2 는 글꼴 하나라 제외, `lineHeight` 는 줄 축이라 제외 |
| 2   | 편집 상자 위 툴바                                                     | 없음 — 단축키 3 + Design 패널 (ADR-027 D-3 구 보류와 같은 판단). 툴바는 후속                                                                                                        |
| 3   | 구간이 섞인 노드에 패널이 노드 단위로 쓸 때                           | 노드 + 구간 전부 그 값 (Figma `Mixed` 쓰기)                                                                                                                                         |
| 4   | 범위 링크 (글자 일부가 링크)                                          | 제외 — Link 는 노드 (RAC `Link`) 이고 인터랙션 축이라 별도 ADR                                                                                                                      |
| 5   | 번들 — 동기 경로 Δ 가 여유 (Builder 2,904 · Preview 3,153) 를 넘을 때 | 측정 뒤 ADR-201 재승인 절 (298 과 같은 절차) 또는 DOM run 렌더러 lazy (Preview 는 run 이 있는 문서에서만 `import()`)                                                                |

## Risks

| ID  | 위험                                                                                                                         | 심각도 | 대응                                                                                                                                                            |
| --- | ---------------------------------------------------------------------------------------------------------------------------- | :----: | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | 구간 크기가 섞인 줄의 baseline · 줄 높이가 Canvas ↔ Chrome 에서 갈린다 (SkParagraph 의 정수 반올림 · half-leading 배분, F16) |  HIGH  | G2 — 섞인 크기 fixture 를 raster readPixels 로 대조 (메모리 `reference-skparagraph-rounds-baseline-vs-chrome-line-box` 의 방법) · `leafBaseline` 은 가장 큰 run |
| R2  | 초기 번들 여유가 2,904 · 3,153 B — 동기 경로 (run 형 · DOM span · Canvas push · 측정) 만으로 넘칠 수 있다                    |  HIGH  | G1 — 커밋마다 부모 대비 Δ · PM chunk 는 initial 밖 · 넘치면 사용자 결정 5                                                                                       |
| R3  | 한글 IME 조합 중 previewRecord 가 상자를 키워 (hugging box) 편집기가 밀리거나 조합이 끊긴다 — WebKit 미실측                  |  HIGH  | G0 — Chrome + WebKit (Playwright webkit) 조합 fixture RED 를 Phase 0 에서, 끊기면 조합 중 preview 보류                                                          |
| R4  | 변환 층 (run ↔ PM) 이 정규형을 깨 저장 모양이 흔들린다 (같은 글자가 다른 JSON — 코드 보기 diff · Autosave 잡음)              |  MED   | 정규형 함수 하나 + 왕복 fixture (G3)                                                                                                                            |
| R5  | contract 53 — 52 문서 거부 · 재생성                                                                                          |  MED   | 개발 단계 정책 그대로 (ADR-278 h1) · README 공지                                                                                                                |
| R6  | 글자를 문자열로 쓰는 길 (AI · 바인딩 · 코드 보기 plain) 이 구간을 지운다                                                     |  LOW   | 의도된 동작 (Decision 6) — 코드 보기는 run 투영이라 지우지 않는다                                                                                               |
| R7  | run 이 있는 글자의 측정 · 캐시 키 비용                                                                                       |  LOW   | run 없는 글자는 호출 수 동일 (ratchet) · 있는 글자는 run 선형                                                                                                   |
| R8  | 템플릿 토큰을 가르는 경계가 정규형을 거치지 않는 쓰기 길로 들어와 해석 · 참조 · 이름 변경이 토큰을 잃는다 (F17)              |  MED   | 정규형 하나 + validation 거부 · G3 반례 (`{{ }}` 안 구간 쓰기 · 이름 변경)                                                                                      |
| R9  | 장식선 전파 (F18) 를 한 consumer 만 따라 노드 · 조상 장식선 아래 `none` 구간이 Canvas ↔ DOM 에서 갈린다                      |  MED   | Decision 2 의 span 이전 · 조상 합집합 · G2 fixture 2                                                                                                            |
| R10 | 편집 범위 표지가 빠진 focus 표면 (새 팝오버 · 키보드 Tab 이동) 에서 편집이 조용히 끝나 패널 쓰기가 노드 전체로 간다 (F19)    |  MED   | 표지 한 곳 · G4 실제 클릭 · 키보드 이동 · 원복 RED                                                                                                              |

## Gates

| Gate | 시점    | 통과 조건                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | 실패 시 대안                                                                              |
| ---- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| G0   | Phase 0 | **RED 2** — (a) PM `EditorView` 를 지금 편집 상자 자리에 plain schema 로만 올려 한글 조합 (「한글」 · 「됐다」 · 조합 중 Escape) 이 Chrome + WebKit 에서 끊기지 않고 previewRecord 가 조합을 깨지 않는다 (Playwright chromium · webkit, 조합 이벤트 시퀀스 fixture) (b) 편집기 chunk 가 initial closure 밖 (`adr201-bundle-gate.mjs` 판정). 측정 조건 (visibilityState · 기기) 명시 — measurement-validity §1                                                                                                                                                                                              | (a) 실패 → 조합 중 preview 보류, 그래도 실패면 입력 층 재검토 (대안 B 금지 — 사용자 보고) |
| G1   | 매 커밋 | 번들 Δ (부모 대비, 별도 worktree frozen lockfile — ADR-201 절차): 동기 경로 누적 Builder ≤ +2,900 · Preview ≤ +3,150 B gz, PM chunk initial 밖                                                                                                                                                                                                                                                                                                                                                                                                                                                             | 사용자 결정 5                                                                             |
| G2   | Phase 2 | 대칭: fixture 8 (굵기만 · 색만 · 크기 섞임 1줄 · 크기 섞임 wrap 3줄 · 장식선 구간 · 템플릿 `{{ }}` 구간 · 노드 underline + 구간 `none` 과 다른 색 구간 · 조상 frame underline + 구간 `none` (두 쪽 다 지워지지 않음)) 의 Canvas raster ↔ Preview DOM 글리프 잉크 차 ≤ 0.5 scene px · 줄바꿈 위치 동일 · 엔진 상자 == DOM `getBoundingClientRect` (parity 하니스, 대조 arm = 구간 없는 같은 글자)                                                                                                                                                                                                           | 섞인 크기 baseline 식 수정 · 안 되면 fixture 를 Live Exercise 에 기록 후 사용자 판정      |
| G3   | Phase 1 | 변환 · 정규형: run ↔ PM 왕복 fixture 전수 (정규형 · `\n` · 빈 · 템플릿 · 이웃 합침 · 문자열 되돌림) · 템플릿 반례 — `Hello {{ userName }}!` 에서 `userName` 만 굵게 → 토큰 전체가 한 run · 해석 `Hello guest!` · refs `[userName]` · 변수 이름 변경 반영 (공용 `resolveStateTemplateProps` · `collectPropsStateRefs` 로, 같은 글자의 문자열 값과 결과 동일) · 토큰을 가르는 RichText 는 validation 거부 · 원복 RED (정규형 함수 제거 → 왕복 FAIL · 토큰 넓힘 제거 → 요청한 굵기가 사라짐 — 정규형이 토큰을 첫 글자 `{` 의 mark (굵기 없음) 로 맞추므로 refs 는 남고 서식이 빠진다) · contract 53 거부 unit | 수리                                                                                      |
| G4   | Phase 3 | 패널 · 코드 보기: 편집 중 구간 선택 → Typography 가 그 값 · Mixed · 실제 브라우저에서 Font Size 입력 클릭 · 색 팝오버 · 키보드 focus 이동 → 선택 구간만 바뀐다 (노드 전체 쓰기 0) · 편집 상자로 돌아오면 선택 유지 · 범위 밖 클릭에 커밋 한 명령 (History 1 단계) · 원복 RED (범위 표지 제거 → 패널 클릭이 편집을 끝내 FAIL) · 코드 보기 `<span style>` 왕복 (ADR-285 수용 집합 하니스에 run 케이스 추가)                                                                                                                                                                                                  | 수리                                                                                      |
| G5   | Phase 4 | 성능: ratchet (`gate:perf-ratchet`) 구간 없는 문서 카운트 동일 · `perf:baseline --lane frame --fixed-inputs` 글자 측정 호출 수 동일 · 편집 진입 첫 1회 (chunk 로드) 시간 기록                                                                                                                                                                                                                                                                                                                                                                                                                              | 캐시 키 · 측정 경로 수리                                                                  |
| G6   | Phase 4 | live (Chrome MCP, 별도 dev 서버 5174+): Text 에 「안녕 **세상**」 (굵기 · 색 · 크기) → Canvas · Preview Compare Mode 500% · 한글 조합 · ⌘Z · 코드 보기 · 콘솔 0 → `### Live Exercise`                                                                                                                                                                                                                                                                                                                                                                                                                      | Implemented 보류                                                                          |

### Live Exercise

(Implemented 승격 시 기재)

## Consequences

### Positive

- 글자 노드 하나 안에서 구간 서식 — ADR-027 이 보류한 리치 텍스트의 선행 조건 충족 (툴바는 후속).
- 정본은 catalog 문서 하나 — 값 형 · 토큰 참조 (298) · 코드 보기 · 클립보드가 지금 길 그대로. 편집기 의존성은 입력 상자 안에만 있고 지우면 textarea 로 돌아간다.
- Canvas 의 구간 push 는 F6 의 기존 길이라 렌더러 구조가 안 바뀐다.

### Negative

- 문서 contract 53 — 52 문서 재생성.
- 글자 측정 · Canvas 글자 노드 · DOM 렌더 · 패널 · 코드 보기에 run 분기가 생긴다 (`textMeasure.ts` · `canvasBinding.ts` · `nodeRendererText.ts` · `domBinding.runtime.ts` · `TypographySection.tsx` · `codeViewEdit.ts`).
- 새 의존성 5 (ProseMirror) — lazy 라 초기 번들은 0 이지만 편집 진입 첫 1회 로드.
- 동기 경로 Δ 가 번들 여유를 넘기면 상한 재승인이 또 필요하다 (298 직후).
