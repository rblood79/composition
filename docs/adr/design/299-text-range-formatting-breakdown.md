# ADR-299 설계 breakdown — 글자 범위 서식 (run)

> 본문: [../299-text-range-formatting-runs.md](../299-text-range-formatting-runs.md). 이 문서는 구현 상세 (분리 4 질문 · 인벤토리 · 형식 · Phase · 파일 · 게이트 절차) 만 담는다. `docs/adr/evidence/` 는 gitignore 라 실측 결론은 §6 에 둔다.

## 1. 분리 4 질문 lock-in (adr-writing.md §Fork)

| #   | 질문                           | 답                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| --- | ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | base / 응용                    | **299 = base** — 글자 값의 **구간** 축 (문서 형 + 두 consumer + 측정 + 입력). ADR-027 (편집 상자의 전환 무결성) · 205 (글자 축 computed seam) · 298 (값의 토큰 참조) 은 각각 상자 · seam · 값 형의 결정이고 구간을 전제하지 않는다. 027 이 「run 을 담는 ADR 이 선행」 이라 적었으므로 027 의 보류 (리치 텍스트 · 툴바) 가 299 의 응용이다.                                                                                        |
| 2   | schema 직교성                  | 299 는 `AuthoredValue` 에 `RichText` 형 하나 (문서 스키마 변경 · contract 53). 298 은 visual 의 `TokenUse` (이미 있음) 를 **쓰는** 패널 — run 의 mark 값 형이 298 의 값 형을 그대로 쓴다 (specialization 이 아니라 재사용). 205 는 Canvas · DOM 이 읽는 seam (문서 무변경). 027 은 편집 상자 UI. 넷 다 직교.                                                                                                                       |
| 3   | 선행 전제 reverse 검증         | 027 §보류 「canonical 텍스트 prop 이 plain string 이라 데이터 모델 ADR 이 선행돼야」 — 299 가 그 모델이다. grep: `canvasText.ts` 의 커밋 명령 (`setFields` children) · `CatalogTextEditor` 의 previewRecord 는 299 가 그대로 쓴다 (027 의 결정이 299 를 막지 않는다). 298 Decision 「노드 값은 토큰 참조 우선」 — run mark 도 같은 형이라 뒤집히지 않는다. ADR-142 「D3 SSOT = catalog 표」 — run 은 작성 값이라 표를 안 건드린다. |
| 4   | 판독에 전제 검증을 미루지 않음 | 위 1 ~ 3 은 ADR 작성 시점 (2026-11-02) 에 코드 grep 으로 확인. 사용자 confirm = `/create-adr` 입력 (같은 대화에서 「자체 구현밖에 없나」 → 「소스 분석해서 우리 것으로」 → `/create-adr`).                                                                                                                                                                                                                                         |

겹침 표:

| 파일                                                                      | 027 (완료)               | 205 (완료)           | 298 (완료)               | 299                                   |
| ------------------------------------------------------------------------- | ------------------------ | -------------------- | ------------------------ | ------------------------------------- |
| `apps/builder/src/builder/workspace/canvas/catalog/CatalogTextEditor.tsx` | 상자 배치 · 전환         | —                    | —                        | `<textarea>` → PM `EditorView` (lazy) |
| `apps/builder/src/builder/catalogRuntime/canvasText.ts`                   | 커밋 명령                | —                    | —                        | run 값 커밋 (같은 `setFields`)        |
| `packages/shared/src/catalog/document/types.ts`                           | —                        | —                    | `TokenUse` 사용          | `RichText` 형 · contract 53           |
| `packages/shared/src/catalog/runtime/boxModel.ts`                         | —                        | `catalogTextMetrics` | —                        | run 읽기 helper                       |
| `apps/builder/src/builder/catalogRuntime/textMeasure.ts`                  | —                        | seam 소비            | —                        | run 목록 paragraph                    |
| `apps/builder/src/builder/workspace/canvas/skia/nodeRendererText.ts`      | `collapseTextWhiteSpace` | 자간 seam            | —                        | run 마다 `pushStyle` · 구간 장식선    |
| `packages/shared/src/catalog/runtime/domBinding.runtime.ts`               | —                        | inline style         | `var(--catalog-token-*)` | run 마다 `<span>`                     |
| `apps/builder/src/builder/panels/styles/sections/TypographySection.tsx`   | —                        | —                    | 토큰 칩 · preset         | 편집 중 선택 구간 · Mixed             |
| `apps/builder/src/builder/catalogRuntime/codeViewEdit.ts`                 | —                        | —                    | `var()` 양방향           | `<span style>` 투영 · 적용            |

## 2. 인벤토리 (Phase 0 에서 freeze — 아래는 2026-11-02 조사값, 상한)

### 2a. 글자 문자열의 소비자 (run 을 알아야 하는 곳)

| #   | 소비자                     | 파일:라인                                                                                                              | 299 에서                                                             |
| --- | -------------------------- | ---------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| 1   | 문서 형 · 검증             | `document/types.ts:249-256` · `validation.ts:865-866`                                                                  | `RichText` 추가 · mark 키 검사 · contract 53                         |
| 2   | 편집 상자                  | `CatalogTextEditor.tsx:66-98 (start.text), 174-192 (preview), 194-221 (save), 364-388 (textarea)`                      | PM view · run ↔ PM 변환                                              |
| 3   | 커밋 명령                  | `canvasText.ts:21-39, 47-65, 73-103`                                                                                   | `catalogTextOf` 가 run 을 돌려준다 · 바운드 글자는 문자열 그대로     |
| 4   | Canvas 글자 노드           | `canvasBinding.ts:465, 525-605`                                                                                        | `text.runs` (mark 만)                                                |
| 5   | Canvas 그리기              | `nodeRendererText.ts:233-250, 426-472, 492-497, 601-631, 731-761`                                                      | run push · 구간 rect 장식선 · 자간 · baseline 보정                   |
| 6   | retained paragraph 키      | `skia/textParagraphKey.ts:9-60`                                                                                        | run 직렬화 포함                                                      |
| 7   | 줄바꿈 힌트 (Canvas 2D)    | `nodeRendererText.ts:636-709` · `utils/canvas2dSegmentCache.ts:906`                                                    | run 마다 `TextMeasureStyle`                                          |
| 8   | 측정                       | `catalogRuntime/textMeasure.ts:33-108, 120-154, 226-270` · `compositionRoot.ts:640-653, 766-890, 1186-1261, 3549-3561` | `CatalogTextMeasure` 입력 = run 목록 · `fontBox` run 마다            |
| 9   | DOM                        | `domBinding.runtime.ts:664-720, 887-993` · `rendering/src/renderers/utils/textSource.ts:137`                           | run 마다 `<span style>` · plain 이어 붙이기                          |
| 10  | 패널                       | `TypographySection.tsx:128-406` · `hooks/useTypographyValues.ts:76-200` · `catalogStylesHost.ts:451-458, 634-635`      | 편집 중 선택 구간 읽기 · 쓰기 · Mixed                                |
| 11  | 코드 보기                  | `codeViewEdit.ts:1419, 2270-2280, 2411`                                                                                | `<span style>` 투영 · 적용                                           |
| 12  | 변수 참조 · 템플릿         | `variableReferences.ts:224, 285, 346` · `resolver.ts:404-406`                                                          | run 마다 수집 · 해석                                                 |
| 13  | 클립보드                   | `catalogRuntime/clipboardText.ts` (entries 통째)                                                                       | 무변경 (run 이 entries 안) · PM clipboard serializer 는 편집 상자 안 |
| 14  | AI · 바인딩이 글자 쓰는 길 | `setFields` children 문자열                                                                                            | 무변경 (문자열 쓰기 = 서식 초기화, 본문 Decision 6)                  |
| 15  | 디버그                     | `skia/textDrawOrigin.ts:117-140 (resolveTextNodeDebug), 149-170, 180 (resolveTextEditBox)`                             | `runs` 노출                                                          |

Phase 0 에서 `grep -rn "props.children\|textOf(\|resolveTextSourceText\|catalogTextOf" packages apps --include=*.ts --include=*.tsx` 로 위 표를 재확인하고 빠진 소비자를 더한다 (예상 밖 소비자 = 이 표 보강, fork 사유 아님 — adr-writing M3).

### 2b. 타입 · 테스트

- 기존 테스트가 글자를 문자열로 가정하는 자리: `nodeRendererText.static.test.ts` · `inlineLineBoxInput.test.ts` · `adr027-text-edit-parity.mjs` (타입 8 × 줌 2 하니스 — run 케이스 추가 후보) · codeView 수용 집합 하니스 (ADR-285).
- parity 하니스 (`apps/builder/tests/parity/`) 에 run fixture 디렉터리 추가.

## 3. 형식 (Decision 1 의 상세)

```ts
// packages/shared/src/catalog/document/types.ts
export interface TextRun {
  readonly text: string; // "" 금지 · `{{ }}` 템플릿 포함 가능 · `\n` 포함 가능
  readonly marks?: TextRunMarks; // 없거나 비어 있지 않음
}
export type TextRunMarks = Readonly<
  Partial<
    Pick<
      VisualValues,
      "fontWeight" | "fontStyle" | "textDecoration" | "color" | "fontSize"
    >
  >
>; // 사용자 결정 1 — 키 집합은 `TEXT_RUN_MARK_KEYS` 상수 하나 (validation · PM schema · 패널 · 코드 보기가 같이 읽는다)
export interface RichText {
  readonly kind: "text";
  readonly runs: readonly TextRun[]; // 길이 ≥ 1
}
export type AuthoredValue =
  | Scalar
  | TokenUse
  | StructuredValue
  | CalendarDuration
  | NumberFormatValue
  | PropWhen
  | PropVar
  | RichText;
```

정규형 (`packages/shared/src/catalog/document/textRuns.ts` — 순수 함수, 두 앱 공용):

- `normalizeRichText(value: string | RichText): string | RichText` — 빈 run 제거 · **토큰 맞춤** (경계가 `{{ … }}` · `\{{` 토큰 안에 있으면 토큰 전체를 그 첫 글자의 run 에 — 토큰 정규식은 `state/template.ts` 의 것을 공유) · 이웃 같은 mark 합침 (mark 비교는 키 · 값 deep) · mark 가 전부 없으면 `string`. 순서 고정: 토큰 맞춤 → 합침.
- `richTextPlain(value): string` — run `text` 이어 붙이기 (`resolveTextSourceText` · 변수 참조 · AI 가 쓴다).
- `richTextRuns(value): TextRun[]` — 문자열이면 `[{ text }]`.
- `applyMarks(value, from, to, marks)` · `clearMarks(value, from, to, keys)` — 패널 · 코드 보기가 PM 없이도 쓸 수 있는 구간 쓰기 (offset 은 UTF-16 code unit — PM 과 같음). `from` · `to` 가 토큰 안이면 토큰 밖으로 넓힌 뒤 쓴다 (`widenToTokens(plain, from, to)` — PM plugin 도 이 함수를 쓴다).

검증 (`validation.ts`): `kind === "text"` 이면 `runs` 길이 ≥ 1 · `text` 비어 있지 않음 · `marks` 키 ∈ `TEXT_RUN_MARK_KEYS` · 값은 `visualLiteral` 과 같은 검사 (`TokenUse` 허용) · 값이 정규형과 같다 (`normalizeRichText(v)` deep-equal — 토큰을 가르는 경계 · 빈 run · 합칠 이웃이 있으면 거부). props 자리에서만 허용 (visual · state variable · 조건에는 금지 — `CalendarDuration` 과 같은 자리 제한).

변수 (F12 · F17): `resolveStateTemplateProps` · `collectPropsStateRefs` · `variableReferences.ts` 의 이름 변경은 RichText 를 만나면 run `text` 마다 지금 문자열 함수를 부른다 (토큰이 원자라 run 마다 = 문자열 전체와 같은 결과). 해석 결과는 같은 run 구조에 치환된 `text` — mark 는 그대로.

장식선 (F18 · Decision 2): 실효 run 의 `decoration` 은 두 값 — `own` (run mark ?? 노드 값; DOM 은 span 에 쓰고 바깥 요소엔 안 씀) · `inherited` (조상 container 의 전파 값 — run mark 가 지우지 못함, Canvas 는 합집합으로 그림, DOM 은 조상 요소가 이미 씀). Phase 0 에서 지금 Canvas 가 조상 장식선의 색 · 두께를 어느 상자 값으로 그리는지 확인해 §6.4 에 적는다.

읽기 (`boxModel.ts`): `catalogTextTypography` 는 그대로 노드 값. 새 `catalogTextRuns(node)` 가 `props.children` 의 run 목록 + 노드 값을 합친 **실효 run** (`{ text, font: CatalogTextFont, color, decoration }`) 을 낸다 — Canvas (`canvasBinding`) · DOM (`domBinding`) · 측정 (`compositionRoot.textLeaf`) 셋이 이 하나를 읽는다 (consumer-to-consumer 참조 0).

## 4. 입력 층 (Decision 4 의 상세)

- 패키지 5 (`prosemirror-model` · `state` · `transform` · `view` · `keymap`) 를 `apps/builder` devDependencies 가 아니라 dependencies 에 (런타임 lazy). `pnpm-workspace.yaml` catalog 에 버전 고정.
- `apps/builder/src/builder/workspace/canvas/catalog/textEditor/` (새 디렉터리, chunk 경계):
  - `schema.ts` — `doc(inline*)` · `text` · `hard_break` · marks = `TEXT_RUN_MARK_KEYS` 마다 attrs `{ value }` (값은 visual 형 그대로 — 토큰 참조도 attrs 안).
  - `textRunsBridge.ts` — `toDoc(value: string | RichText): Node` · `fromDoc(doc): string | RichText` (정규형 보장) · 왕복 fixture.
  - `templateTokens.ts` — mark step (`AddMarkStep` · `RemoveMarkStep`) 의 구간을 `widenToTokens` 로 넓히는 `appendTransaction` plugin (토큰은 글자 그대로 — atom 노드 아님).
  - `keymap.ts` — ⌘B · ⌘I · ⌘U (toggleMark) · Enter = `hard_break` · ⌘Enter · Escape 는 커밋 (지금 `onKeyDown` 과 같은 의미).
  - `clipboard.ts` — `clipboardTextSerializer` (plain) · `transformPasted` (우리 mark 만 — 나머지 버림).
  - `EditorField.tsx` — `EditorView` 마운트 · `dispatchTransaction` 마다 `fromDoc` → `previewRecord` (IME 조합 중엔 `view.composing` 이면 보류 — G0 결과로 확정).
- `CatalogTextEditor.tsx` 는 `React.lazy(() => import("./textEditor/EditorField"))` 로 그 chunk 를 열고, 로드 전엔 지금 `<textarea>` 를 그대로 보인다 (첫 1회 로드 지연 동안 입력 가능 — 로드 뒤 draft 를 넘긴다).
- 편집 범위 (Decision 4, 리뷰 h3):
  - 표지 `data-text-edit-scope` 를 편집 상자 · `TypographySection` root · 그 절이 여는 팝오버 (PropertyColor · 토큰 picker — portal root) 에 붙인다. 표지 이름은 상수 하나 (`TEXT_EDIT_SCOPE_ATTR`).
  - `CatalogTextEditor` 의 `onBlur={commit}` 을 `focusout` + document `pointerdown` (capture) 판정으로 바꾼다 — 대상 · `relatedTarget` 이 표지 안이면 커밋하지 않는다. 표지 밖 · Escape · ⌘Enter · 선택 변경 · unmount 는 지금처럼 `commit`.
  - blur 동안 선택 구간을 보이게: PM `Decoration.inline` (class `text-edit-held-selection`) — focus 복귀 때 지운다.
  - handle: `EditorField` 가 마운트 때 builder 쪽 registry (`textEditorHandle.ts`, session 은 건드리지 않음 — 등록 · 해제만) 에 `{ marks(): Partial<TextRunMarks> | "mixed" per key, apply(key, value) }` 를 등록. `useTypographyValues` · `catalogStylesHost.updateStyle` 은 `session.textEditing` + handle 이 있으면 handle 로 간다.
- 되돌리기: PM `history` 플러그인 없이 `EditorState` 스택을 우리가 들고 (편집 중 ⌘Z · ⇧⌘Z), 커밋 뒤 ⌘Z 는 History 한 단계 (지금과 같다).
- 바운드 글자 (`start.bound`) · `label` · `value` 키 편집은 plain schema (mark 없음) — 같은 EditorField, marks 비활성.

## 5. Phase

| Phase | 내용                                                                                                                                                                                                                                                                                                                                 | Gate    | 커밋 가능 상태                                       |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------- | ---------------------------------------------------- |
| 0     | 인벤토리 freeze (§2a 재grep) · RED 2 (G0 — PM plain schema 로 한글 조합 Chrome + WebKit · chunk initial 밖) · 번들 기준선 (부모 커밋, worktree frozen lockfile)                                                                                                                                                                      | G0      | 하니스 · 기준선만 (동작 변경 0)                      |
| 1     | 문서 형 `RichText` · 정규형 `textRuns.ts` (토큰 맞춤 · `widenToTokens`) · validation · contract 53 · `catalogTextRuns` · 변수 해석 · 참조 · 이름 변경 run 마다 · `resolveTextSourceText` plain                                                                                                                                       | G3      | 문서가 run 을 담을 수 있다 (그리는 곳 없음 — 호출 0) |
| 2     | 두 consumer + 측정: `canvasBinding` runs · `nodeRendererText` run push + 구간 장식선 · 자간 · baseline · paragraph 키 · 줄바꿈 힌트 · `textMeasure` run paragraph · `compositionRoot` leafBaseline (가장 큰 run) · `domBinding` `<span>` (RichText 면 바깥 요소 장식선 생략 · 모든 run span) · 조상 장식선 합집합 · parity fixture 8 | G2      | run 문서가 두 소비자에서 같게 보인다 (입력 없음)     |
| 3     | 입력 · 패널 · 코드 보기: `textEditor/` chunk (§4) · 편집 범위 표지 · handle · `CatalogTextEditor` 교체 · Typography 편집 중 선택 구간 · Mixed · `codeViewEdit` `<span style>` 투영 · 적용                                                                                                                                            | G4 · G1 | 사용자 결정 1 · 2 · 3 을 여기서 묻는다               |
| 4     | 성능 · live · 문서: ratchet · frame 기준선 · Chrome MCP live (G6) · 규칙 문서 (`canvas-rendering.md` 글자 절 · `state-management.md` 편집 상자 절) · CHANGELOG · README · `### Live Exercise`                                                                                                                                        | G5 · G6 | Implemented                                          |

Phase 1 · 2 는 입력이 없어도 fixture 문서 (seed 로 run 값을 직접 넣는다 — `storage` 경로) 로 검증한다. 사용자 결정 4 (범위 링크) · 5 (번들) 는 닿을 때.

## 6. 실측 기록 (Phase 0 ~ 4 에서 채운다)

### 6.1 G0 — IME 조합 (Phase 0)

- 하니스: `apps/builder/tests/text-edit/adr299ImeComposition.browser.test.ts` (vitest project `text-edit` — chromium + webkit instance). 편집 상자 모양 그대로 (absolute · `scale(2)` · `white-space: pre`) 안에 PM plain schema (`doc(inline*)` = text + hard_break) `EditorView`, `dispatchTransaction` 마다 글자를 꺼내 preview (상자 width · height · top 을 글자에 맞춰 바꿈 — hugging box · middle 정렬).
- 측정 조건: headless · DPR 1 · `visibilityState=visible`. **chromium** HeadlessChrome 156.0.8078.4 — CDP `Input.imeSetComposition` · `Input.insertText` (Blink 의 IME 경로). **webkit** Playwright WebKit (Safari 27.2 UA) — IME API 가 없어 브라우저 순서 (compositionstart → 표시 글자 교체 + input `isComposing` → compositionend) 를 **합성**. native macOS 한글 IME 증거가 아니다 (Q5) — native 확인은 G6 live.
- 결과 (2026-11-02, 두 브라우저 각 7): 「한글」 (ㅎ 하 한 · ㄱ 그 글) · 「됐다」 (ㄷ 돠 돼 됐 · ㄷ 다) · 전체 선택 위 조합 (편집 상자는 열 때 전체 선택 → 「한」) · 줄바꿈 뒤 조합 (상자 높이가 자람) · 조합 중 Escape **PASS**. 조합 중 preview 6 회 (전부 `view.composing` 중) — 상자가 자라도 조합이 끊기지 않으므로 **조합 중 preview 보류는 필요 없다** (§4 `EditorField` 의 「G0 결과로 확정」 — 보류하지 않음).
- 조합 중 Escape: PM 이 조합 중 keydown 을 keymap 에 넘기지 않는다 (`inOrNearComposition`) — 커밋 0, 조합 글자 유지 (`가하`). 즉 조합 중 Esc 는 편집을 끝내지 않고 (IME 가 표시 글자를 확정), 다음 Esc 가 커밋한다. 지금 `<textarea>` 는 조합 중 Esc 에 바로 커밋 — 동작 차이로 Phase 3 G4 · G6 에 적는다.
- **대조 arm (하니스 감도)**: 매 입력마다 글자 DOM 노드를 새 노드로 바꾸는 re-render → chromium `글글그ㄱ한한하Hello ㅎ` · webkit `ㄱHello ㅎ` (두 브라우저 다 깨짐을 잡는다). 같은 글자로 PM state 만 다시 만드는 arm 은 DOM 을 건드리지 않아 깨지지 않았다 — 대조로 쓰지 않음.
- **(b) chunk initial 밖**: 299 의 PM import 는 Phase 3 의 `textEditor/` 배선 전에는 0 이라 Phase 0 빌드에서 판정할 대상이 없다 — PM 을 처음 배선하는 커밋의 G1 (`adr209-bundle-closure.mjs` initial closure 에 `prosemirror-*` 파일 0 · `dynamicTargets` 에 편집기 chunk) 에서 판정한다 (같은 검사, 시점만 옮김). **Phase 3 판정 PASS**: ProseMirror 문자열은 dist 의 `EditorField-*.js` 하나에만 있고 (gz 58,213 B) initial 124 파일에 없음, `dynamicTargets` 에 그 chunk.

### 6.2 번들 (매 커밋)

- 기준선 (Phase 0, 2026-11-02): HEAD `75935c07b` — 별도 worktree `.cache/adr299-bundle/wt` (`pnpm install --frozen-lockfile` · 엔진 wasm 은 같은 소스라 복사) · `pnpm -F @composition/builder build` · `adr209-bundle-closure.mjs`. Builder initial JS gz **1,400,437 B** (122 files) · Preview **322,300 B** (17 files). **Builder 는 착수 전 이미 상한 1,400,000 을 437 B 넘었다** (298 측정 1,397,096 이후 다른 커밋 몫) — 299 의 동기 경로 Δ 는 어떤 크기든 상한 초과라 사용자 결정 5 를 Phase 1 착수 때 묻는다. Preview 여유 2,700 B.
- 의존성: `prosemirror-model` 1.25.12 · `state` 1.4.4 · `transform` 1.12.2 · `view` 1.42.6 · `keymap` 1.2.3 (전부 MIT, 배포 2주 이상 된 판 — view 1.42.7 ~ 9 · transform 1.12.3 ~ 4 는 10-22 이후 배포라 제외) · 전이 의존 `orderedmap` 2.1.1 · `w3c-keyname`. `pnpm-workspace.yaml` catalog 고정 · `apps/builder` dependencies.

### 6.3 G2 대칭 fixture 8 (Phase 2)

(fixture · Canvas raster 잉크 top/bottom · DOM `getBoundingClientRect` · 차)

### 6.4 Phase 기록

**Phase 0 (2026-11-02, 동작 변경 0)** — 하니스 · 기준선 · 의존성만.

- 인벤토리 재grep (`props.children` · `catalogTextOf(` · `resolveTextSourceText` · `catalogTextKey(` — 테스트 제외): 41 파일. §2a 15 행 밖의 것은 대부분 다른 type 의 `children` (Cell · Column · StatusLight · Tree · 컬렉션 항목 · picker) 이라 run 대상이 아니다. **대상 글자 (Text · Paragraph · Heading · Link 의 `children`) 를 문자열로 읽는 추가 소비자**: `rendering/renderers/skiaPrimitives.ts` · `buildCatalogShapes.ts` · `resolution/resolver.ts` (템플릿 · 행 필드) · `outputs/editFields.ts` · `catalogRuntime/componentsPage.ts` · `singleSelection.ts` · `utils/element.utils.ts` · `components/Link.tsx`. 이것들이 객체를 `String()` 하면 `[object Object]` 가 된다 → Phase 1 은 **resolver 가 record 의 `props.children` 에 plain 을 두고 run 은 record 의 별도 필드** 로 싣는다 (run 을 모르는 소비자는 그대로 plain 문자열을 읽는다 — 소비자를 하나씩 고치지 않는다). run 을 읽는 곳은 §3 의 `catalogTextRuns` 하나를 거친다.
- (Phase 2 정정 — 아래 「CSS 는 조상 상자의 color」 는 틀렸다: frame 은 DOM 에 장식선을 쓰지 않고 글자 요소가 inline 으로 받는다. Phase 2 기록 참조.) 조상 장식선의 Canvas 색 · 두께 (Decision 2 의 Phase 0 확인): Canvas 글자 노드는 장식선을 flag 만 싣고 (`canvasBinding.ts` `bindings.text` → `parseTextDecoration`, `decorationColor` 없음) 선 색 = 글자 노드 자신의 `color`, 두께 = 글자 노드 자신의 글꼴 (`nodeRendererText.ts` `drawCssDecorations`). 조상 (`inheritedText.textDecoration`, `compositionRoot.ts:344`) 값도 같은 flag 로 들어온다. CSS 는 조상 장식선을 **조상 상자의 color · 글꼴** 로 그린다 → 글자가 자기 색을 가진 경우 지금도 (299 이전) 색이 갈린다. Phase 2 G2 fixture 8 이 이 차이를 고정한다 (조상 장식선 = 조상 색).
- G0 (a) PASS (§6.1) · 기준선 (§6.2) · 의존성 5.

**Phase 1 (2026-11-02, G3)** — 문서가 run 을 담는다 (그리는 곳은 Phase 2).

- 파일: `document/{types,textRuns,valueType,validation,graph}.ts` · `resolution/resolver.ts` (`resolvedRichText` — mark 토큰 → 값 + `RESOLVED_TOKEN_REFS` · `AUTHORED_TOKEN_REFS` 를 marks 객체에 / `bindRowValue` run 마다) · `runtime/compositionRoot.ts` (`withState` → `withTextRuns`, `sameRecord` 가 `textRuns` 를 mark · token ref 로 비교) · `rendering/.../textSource.ts` (`textFromValue` 가 RichText 를 plain 으로) · `catalogRuntime/canvasText.ts` (`catalogTextOf` plain — Phase 3 까지).
- §3 대비 바뀐 것: 토큰 원자는 상태 템플릿 (`{{ }}` · `\{{`) 에 **행 필드 `{ … }` 도** 더했다 (행 템플릿 `compileFieldTemplate` 도 문자열 하나 안에서 토큰을 찾는다 — 같은 실패 형태). graph 의 host 판정은 정의 이름 첫 마디 (`found.name.split("/")[0]` — colorError 와 같은 판정).
- `catalogStateProps` · `collectPropsStateRefs` · `variableReferences` 의 `stringLeaves` 는 이미 깊이 6 까지 중첩 문자열을 훑어 run `text` 에 닿는다 — 새 코드 0 으로 해석 · 참조 · 이름 변경이 동작 (G3 가 고정).
- 검사: G3 `adr299TextRuns.test.ts` 14 · `adr299TextRunsRecord.test.ts` 3 · 원복 RED 2 (bash + 백업 복원 + cmp) · type-check PASS · rendering 1,274 PASS. shared · builder 실패 (1 · 15) 는 HEAD 에서 같은 테스트가 같은 수로 실패 — `designDataSurfaceGaps` Toast · `labelKeyCatalog` · `chromeIsland` · `catalogHistoryLabels` · `adr253FieldPartsDom` 2 · `adr256CalendarHeaderMode` · `elementlessNodeStyles` · `interactionWhenReach` 4 · Button padding 4 (299 이전 다른 세션 몫, 범위 밖).
- 번들 (G1): HEAD + Phase 0 · 1 = Builder 1,401,901 (+1,464) · Preview 322,340 (+40). PM 은 dist 에 없음 (import 0).

**Phase 2 (2026-11-02, G2)** — 두 consumer + 측정.

- 파일: shared `runtime/textRunStyles.ts` (run 실효 스타일 — 측정 · Canvas · DOM 공용 읽기) · `runtime/textRunsDom.ts` (span) · `runtime/compositionRoot.ts` (`CatalogTextMeasure` 4번째 인자 run 폰트 · `textLeaf.runs` · `leafBaseline` = strut 과 run 줄 상자 baseline 의 최댓값) · `runtime/domBinding.runtime.ts` (text · heading · paragraph · 범용 Link span, 요소의 장식선 규칙) · builder `catalogRuntime/textMeasure.ts` (run 마다 `pushStyle`, `pre` 줄은 `sliceTextRuns`) · `textMeasureCache.ts` (키) · `canvasBinding.ts` (`canvasTextRuns` · rule 글자 `withRuleTextRuns`) · `skia/nodeRendererTypes.ts` (`SkiaTextRun` · `ancestorDecoration`) · `skia/nodeRendererText.ts` (run push · 강제 strut 해제 · 힌트 없음 · 측정 폭 · `drawRunDecorations`) · `skia/textParagraphKey.ts` · `utils/textRunAlign.ts` (`alignTextRuns` — 공백 접기 · `\n` · ZWSP 힌트를 지나 run 구간 이동).
- §3 · Decision 2 대비 바뀐 것: (1) **조상 장식선 = 물려받은 장식선** — DOM 실측 (G2 fixture 8 의 첫 실행 FAIL: run arm DOM 에 밑줄 0) 으로 frame 은 `text-decoration` 을 쓰지 않고 `inheritedText.textDecoration` 이 글자 요소 inline 으로 간다. 그래서 「조상 상자의 색 · 두께」 가 아니라 글자 요소의 색 · 크기이고, 노드에 자기 장식선이 있으면 (요소에 쓰지 않으니) 물려받은 선은 DOM 어디에도 없다 — Canvas 도 그때 그리지 않는다. 처음 넣은 frame 색 읽기 (`ancestorDecorationOf`) 는 지웠다. (2) Link 는 Canvas 에서 rule primitive (`buildCatalogShapes`) 가 그린다 — rule 글자 node 에 run 을 붙이고 rule 밑줄 (클래스 CSS — span 이 못 지움) 을 run 아래 선으로. 작성한 `none` 은 요소에 남겨 rule 밑줄을 끈다 (DOM · Canvas 같음).
- 검사: `adr299TextRunsRecord.test.tsx` 7 (record 3 + 정렬 · DOM span · Canvas run · plain 무변경) · **G2 `tests/adr248-g3/adr299RichTextParity.browser.test.ts` 8 fixture** (`vitest.adr248-g3.browser.config.ts` — Chrome channel) · 원복 RED 4 · type-check · shared · builder · rendering · parity 회귀 (실패는 HEAD 와 같은 테스트 · 같은 수).

| fixture | 대조 arm 차 (device px @500%) | run arm 차 | run 색 잉크 차 | 줄 (Canvas / DOM) | 엔진 ↔ DOM 상자 |
| --- | --- | --- | --- | --- | --- |
| weight | 2 | 2 | — | 1 / 1 | 0 |
| color | 2 | 2 | 2 | 1 / 1 | 0 |
| size-1-line (32 px run) | 2 | 1 | 1 | 1 / 1 | 0 (h 48) |
| size-wrap (26 px run, 폭 260) | 2 | 2 | 1 | 4 / 4 | 0 (h 132) |
| decoration-run | 2 | 2 | 2 | 1 / 1 | 0 |
| template `{{ who }}` | 2 | 3 | 3 | 1 / 1 | 0 |
| node underline + run none | 2 | 2 | 2 (+ run 아래 잉크) | 1 / 1 | 0 |
| ancestor underline + run none | 2 | 2 | 2 (+ run 아래 잉크) | 1 / 1 | 0 |

- 원복 RED: A run 글자 크기 무시 → size 2 FAIL · B strut 강제 → size 2 FAIL · C run 장식선 off → 장식선 3 FAIL · D 요소가 자기 장식선 유지 (DOM) → node underline 1 FAIL (처음엔 GREEN — 잉크 전체 상자로는 가운데 단어 밑줄을 못 봐 「run 열 범위 안 최저 잉크」 를 더했다).
- 알려진 한계 (LOW deferred): `leafBaseline` 은 첫 줄이 아니라 모든 run 의 baseline 최댓값 (큰 run 이 둘째 줄 이후에만 있으면 inline 형제 정렬이 아래로 — 재현 fixture 없음) · CanvasKit 준비 전 Canvas 2D 측정은 run 폰트를 보지 않는다 (폰트 로드 뒤 다시 잰다) · 물려받은 장식선을 준 조상의 색이 바뀌어도 그 선은 글자 색이라 영향 없음.
- 번들 (G1): Phase 2 Δ Builder +1,946 (1,401,901 → 1,403,847) · Preview +1 (322,340 → 322,341). 누적 Builder +3,410 · Preview +41.

**Phase 3 (2026-11-02, G4 · G1)** — 입력 · 패널 · 코드 보기.

- 파일: `workspace/canvas/catalog/textEditor/{textRunsBridge.ts,EditorField.tsx,EditorField.css}` (§4 의 `schema` · `templateTokens` · `keymap` · `clipboard` 는 파일을 나누지 않고 두 파일에 — 토큰 넓힘은 plugin 이 아니라 mark 를 쓰는 길 (`setMark` · 토글 · handle) 이 `widenToTokens` 를 지난다: mark step 을 만드는 길이 이 셋뿐이라 plugin 이 필요 없고, 타이핑 경계는 `fromDoc` 의 정규형이 맞춘다) · `catalogRuntime/textEditorHandle.ts` (handle registry · 편집 범위 판정 `isInTextEditScope`) · `CatalogTextEditor.tsx` (lazy · `Suspense` 의 fallback = textarea · `editorLoaded` 뒤 textarea blur 는 커밋 아님) · `canvasText.ts` (`catalogTextValueOf` · `catalogTextCommand` RichText 비교) · `compositionRoot.ts` (`previewRecord` 가 draft RichText 를 plain + `textRuns` 로) · `panels/styles/sections/TypographySection.tsx` (편집 중 선택 구간 · 「Mixed」) · `catalogStylesHost.ts` (`useTextRunAxes` · 결정 3) · `stylesHostContext.ts` · `codeView/generate.ts` (`childrenCode`) · `codeView/inverse/parse.ts` (글자 안 `span` 은 자식이 아니라 글자 — lezer 의 소문자 태그는 `JSXBuiltin`) · `codeViewEdit.ts` (`childrenValue`) · `panels/properties/catalog/catalogFieldValueSource.ts` (plain).
- §4 대비 바뀐 것: 편집 범위 표지는 Typography 절에 wrapper 를 두지 않고 Section 의 `data-section-id="typography"` 를 읽는다 — 절의 grid CSS 가 `> *` 자식 규칙이라 wrapper 가 배치를 바꾼다. 범위에는 overlay (`.react-aria-Popover` · `[role=listbox]` · `[role=dialog]` · top layer) 도 든다 — 다른 표면의 overlay 는 범위 밖 press 가 먼저 커밋한 뒤에만 열린다. 밖 press 는 pointerdown + focusout 두 번이라 커밋을 한 번으로 막는다 (`ended`).
- 기존 테스트: textarea 를 읽던 편집 상자 테스트 2 파일은 편집기 chunk 를 대기로 고정 (`vi.mock(..., () => new Promise(() => {}))`) — 로드 전 textarea 경로를 그대로 검증, PM 경로는 browser 테스트.
- 검사: G4 `tests/text-edit/adr299EditorField.browser.test.tsx` Chrome · WebKit 각 8 = 16 (열림 · ⌘B/I/U · 토큰 넓힘 · Enter + ⌘Z · Typography press 유지 + 선택 유지 표시 + handle 쓰기 · 밖 press 한 번 커밋 · Tab 밖 커밋 · plain 필드) · 원복 RED 2 × 두 브라우저 · `adr299CodeView.test.tsx` 4 · 결정 3 host 테스트 1 · type-check · builder 회귀 (실패 = HEAD 같은 15 + 부하 flake 1 `phase4eG5LeafScope` — 단독 3회 PASS).
- 번들 (G1): Builder +1,961 (1,403,847 → 1,405,808) · Preview 0. 편집기 chunk gz 58,213 B (initial 밖).
- 알려진 한계 (LOW deferred): 편집 상자 DOM 은 노드 자신의 장식선을 상자에 쓰고 run 마크 `none` 을 PM span 에 쓰므로 편집 중에만 `none` 구간 아래 밑줄이 보일 수 있다 (커밋 뒤 Canvas · Preview 는 맞음) · 패널 색 칸은 PropertyColor 가 hex 로 보내 Theme 스와치도 리터럴로 저장 (노드 색과 같은 기존 동작 — 299 고유 아님) · 「Mixed」 라벨은 i18n 표 밖 (영문).

**Phase 4 (2026-11-02) — G6 live · G5 대기**

- live: ADR 본문 `### Live Exercise` 표 11 행. 결함 2 수리 — (1) ⌘Z 뒤 옛 run 이 남음: `compositionRoot.ts` 증분 rebuild 의 「before 에서 버릴 필드」 에 `textRuns` (회귀 `adr299TextRunsRecord` 「a text written back to a string drops its runs」, 원복 RED 1) (2) Properties 글자 칸 `[object Object]`: `catalogFieldValueSource` plain. 패널 「Mixed」 표시 2 (Font Size 0 → 빈 값 + placeholder Mixed · Italic 은 mixed 면 꺼짐).
- G5: `pnpm gate:perf-ratchet` 는 측정 대상이 커밋된 HEAD (dirty 트리면 HEAD 를 worktree 에서 잰다 — 메모리 `reference-perf-ratchet-dirty-tree-measures-head-worktree`) 라 커밋 요청 뒤. 구간 없는 글자의 경로 변경은 `node.text.runs` · `node.textRuns` 유무 검사뿐 (측정 · 그리기 호출 수 무변경이 설계) — 수치는 미측정.
- native macOS 한글 IME: 사용자 확인 대기.
