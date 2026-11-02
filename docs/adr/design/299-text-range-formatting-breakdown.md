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

(Chrome · WebKit 버전 · 조합 시퀀스 · 결과)

### 6.2 번들 (매 커밋)

(부모 커밋 · Builder · Preview · Δ · PM chunk 파일명과 initial closure 판정)

### 6.3 G2 대칭 fixture 8 (Phase 2)

(fixture · Canvas raster 잉크 top/bottom · DOM `getBoundingClientRect` · 차)

### 6.4 Phase 기록

(Phase 마다 커밋 · 원복 RED · 사후 보고 항목)
