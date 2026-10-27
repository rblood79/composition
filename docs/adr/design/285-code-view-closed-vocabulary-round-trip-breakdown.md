# ADR-285 design breakdown — code view 역변환 (닫힌 어휘 전체)

> 본문: [285-code-view-closed-vocabulary-round-trip.md](../completed/285-code-view-closed-vocabulary-round-trip.md). 착수는 ADR-284 Implemented (G8) 뒤.

## 0. 전제 lock-in (fork 4 질문 — ADR-284 에서 분리)

1. **base / 응용**: ADR-284 가 base (저장 형식 · 계산기 · 생성기 · 자리 역매핑), 이 ADR 은 그 위의 응용 (역문법 · 차이 → 명령). 284 가 선행.
2. **schema 직교성**: 이 ADR 은 저장 스키마를 바꾸지 않는다 (contract 50 그대로). 284 스키마의 소비자일 뿐 specialization 아님.
3. **선행 ADR 전제 reverse 검증**: 284 의 「편집은 1:1 자리만」 (Decision 9 · 연구 §8.5) 은 이 ADR 이 **대체**한다 — 의존 방향 (284 → 285) 은 그대로이고, 284 본문의 그 문구는 G4 에서 「ADR-285 가 넓힘」 으로 고친다. 284 의 다른 전제 (코드 = 레퍼런스 모양 · 자유 코드 아님) 는 유지.
4. **판독 라운드에 미루지 않음**: 위 1 ~ 3 은 사용자 확인 (2026-10-27 AskUserQuestion — 「ADR-284 는 G8 로 닫고 새 ADR」) 으로 확정. 분리 자체가 사용자 지시.

## 1. Phase 0 — inventory · 파서 실측 · RED (G0)

### 1a. 어휘표 — 생성기 emit ↔ 역문법 read ↔ 문서 단위 ↔ 명령 (freeze 는 Phase 0 grep)

출발점 (`packages/shared/src/codeView/generate.ts` 의 emit 지점 — Phase 0 에서 줄 번호와 함께 전수 freeze):

| 어휘 (코드)                                                                 | 생성기                                                                           | 문서 단위                                                               | 명령 (기존)                                                                                                                                                  |
| --------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `import {…} from 'react-aria-components'` · `./data/…`                      | `writeImports`                                                                   | (파생 — 읽지 않음)                                                      | —                                                                                                                                                            |
| `let [x, setX] = useState<T>(v)`                                            | `writeState`                                                                     | page 변수 (이름 · 타입 · 시작값)                                        | `catalogVariableCommands` (add · rename · remove · default)                                                                                                  |
| `let rows = useListData({initialItems, getKey})`                            | `writeCollections` (`list`)                                                      | collection 바인딩 + 규칙이 list 명령 사용                               | (파생 — 규칙에서 결정)                                                                                                                                       |
| `let rows = useAsyncList({load…})` · `url.searchParams.append(k, v)` · 본문 | `writeCollections` (`async`) · `writeRequest` · `writeParam` · `writeSortParams` | endpoint 조회 형식 · 보기 조건 · 정렬                                   | `updateRecord` (endpoint) · 조건 명령                                                                                                                        |
| `useEffect(() => { rows.reload(); }, [deps])`                               | `writeCollections`                                                               | (파생 — 읽지 않음)                                                      | —                                                                                                                                                            |
| `let {contains} = useFilter(…)` · `let collator = useCollator()`            | `writeHooks`                                                                     | (파생)                                                                  | —                                                                                                                                                            |
| `let items = rows.filter(item => A && B && (C \|\| D))`                     | `writeView` 조건 항                                                              | 보기 조건 트리 (필드 · 비교 · 값 · 건너뜀 guard · 적용 flag · 「또는」) | `catalogFilterCommand` · `catalogEditFilterCondition` · `catalogRemoveFilterCondition` · `catalogOrFilterCondition` · `catalogStaticConditionCommand`        |
| `.toSorted((a, b) => collator.compare(…) * dir)`                            | `writeView` 정렬                                                                 | 보기 정렬 (필드 또는 변수)                                              | `catalogSortFollowCommand` · 보기 갱신                                                                                                                       |
| `Map.groupBy(…)` + 집계 · `[{id: 'row-1', count: …}]`                       | `writeGroup` · `aggregateFields`                                                 | 묶기 · 집계 · 파생 보기                                                 | `catalogGroupListCommand` · `catalogGroupColumnsCommand` · `catalogResultCountCommand` · `catalogReferenceCountCommand`                                      |
| `rows.find(r => r.id === item.teamId)?.name`                                | `fieldRead` (참조)                                                               | 참조 필드 경로                                                          | (필드 정의 — 읽기만, 변경은 Data 패널)                                                                                                                       |
| `let {dragAndDropHooks} = useDragAndDrop({…})`                              | `writeDragAndDrop`                                                               | dnd 규칙 (When 5 · Do)                                                  | `catalogInteractionsCommand`                                                                                                                                 |
| `<Tag prop={x} onX={setX} onPress={() => {…}}>…</Tag>`                      | `writeNode`                                                                      | 노드 (종류 · prop · 글자 · 자식) · 규칙                                 | `insertNodes` (origin instance) · `removeTargets` / `removeWithReferrers` · `moveNodes` · prop 쓰기 · `catalogInteractionsCommand` · `catalogBindingCommand` |
| `{item => <Row …>}` · `items={rows}`                                        | `writeNode` (collection)                                                         | 바인딩 · 행 템플릿                                                      | `catalogBindingCommand`                                                                                                                                      |
| `// Not in the request (…)` · `// a variable not on this page: …`           | 주석                                                                             | (읽지 않음)                                                             | —                                                                                                                                                            |

- 표는 `packages/shared/src/codeView/vocabulary.ts` 한 파일로 — 항목마다 `{ emit: string; read: string; unit: string }` (emit = 생성기 함수 이름 · read = 역문법 함수 이름). 정적 테스트가 생성기 · 역문법 소스에서 그 이름이 다 있는지 대조 (한쪽만 있으면 RED).
- **파생 구문** (import · `useFilter` · `useCollator` · `useEffect(… reload …)` · `let x = y.items` · 주석) 은 **문서 변경 계획에서만** 빠진다 — 검증에서는 빠지지 않는다 (리뷰 round 1 m3). 역문법은 파생 구문도 읽어 소유자 (collection · 변수) 의 canonical AST 와 비교한다: 같거나 (공백 · 주석 · import 순서 무시) 소유자가 삭제되어 함께 사라졌으면 통과, 그 밖의 변경은 `derivedChanged` 거절 (대안: 「되돌리거나, 데이터 원본은 `items={…}` 에서」). 모든 식별자는 알려진 이름이어야 한다 (`unknownReference`). 표의 「(파생 — 읽지 않음)」 은 「(파생 — canonical 대조, 명령 0)」 로 읽는다.
- **anchor 표** (h1): 생성기가 어휘 항목마다 「텍스트 범위 → 문서 id / 주소」 를 `CodeViewResult.anchors` 로 낸다 (지금의 `slots` 를 포함하는 상위 집합 — JSX 요소 (여는 태그 ~ 닫는 태그) · 변수 선언 · `filter` 항 · 정렬 · 규칙 핸들러 · `useAsyncList` 블록 · 파생 구문 (소유자 id)). 같은 순회에서 나오므로 두 번째 모델이 아니다.

### 1b. 파서 · 편집기 실측

- CodeMirror 6 (`codemirror` 메타 + `@codemirror/lang-javascript` jsx · typescript + `@codemirror/autocomplete` · `@codemirror/lint`) lazy chunk gz 실측 (추정 ≈130 KB) · initial 밖 확인 · Builder initial Δ. lezer 가 생성 코드 전부를 오류 0 으로 파싱하는지와 역문법이 필요로 하는 노드 (JSX 속성 · 타입 인자 · 화살표 · 템플릿) 를 CST 에서 읽을 수 있는지 probe — 되면 babel 생략 (R9), 안 되면 둘 유지.

- `@babel/parser` (`plugins: ['jsx', 'typescript']`) 로 golden 5 + 어휘 밖 샘플 10 파싱 → 전부 AST. `acorn` + `acorn-jsx` 로 같은 입력 → `useState<SortDescriptor>()` 에서 SyntaxError (RED 기록 → 사용자 결정 4 의 근거).
- lazy chunk 실측: `import('./inverse/parse')` 가 initial closure 밖 (`adr201-bundle-gate.mjs` 방식 — chunk 이름 기록). Builder initial 착수 값 기록.
- `packages/shared/package.json` 에 `@babel/parser` 선언 (catalog 버전). shared 의 다른 소비자 (Preview · publish) 가 이 모듈을 import 하지 않음 — `previewBuilderAuthoringImport.static` 에 `codeView/inverse/*` 추가.

### 1c. RED 8 (`it.fails` → Phase 뒤 `it`)

`apps/builder/src/preview/catalog/__tests__/adr285CodeViewRoundTrip.test.tsx`:

1. 빈 page 코드에 `<Text>Text</Text>` 한 줄 추가 → Apply → 지금: `outsideSlot` 거절. 기대: Text 노드 1 추가 · history 1.
2. `let [q, setQ] = useState('')` + `<SearchField value={q} onChange={setQ} />` + `filter` 항 `contains(String(item.name), q)` 추가 → 기대: 변수 1 · 노드 1 · 규칙 1 · 조건 1 (「검색 추가」 와 같은 문서 — 단언 `catalogFilterCommand` 결과와 deep-equal, id 제외).
3. 기존 `filter` 에 `&& item.age >= 20` 항 추가 → 조건 1 추가 (`gte` · 고정 값).
4. `<Button>` 줄 삭제 → 노드 + 그 규칙 삭제 · Undo 로 둘 다 복원.
5. 두 Button 의 줄 순서 바꿈 → `moveNodes` (삭제 + 추가 아님 — 스타일 · 규칙 보존).
6. (h1) 빨간 한 줄 `<Text>A</Text>` 안에서 A → B (편집 연산) → 같은 id · 빨강 보존 · history 1. 같은 코드 · 다른 색 Text 둘 중 둘째 줄을 편집기에서 삭제 → 둘째 id 만 삭제 (첫째 · 빨강 보존). 같은 둘을 선택해 한 줄로 붙여넣기 → `ambiguousIdentity` 거절 (문서 그대로). 빨간 A · 파란 B 두 줄을 골라 B · A 순서로 붙여넣기 → `moveNodes` 1 · 파란 B · 빨간 A · 글자 수정 0 (round 3).
7. (h2) 편집 시작 → Canvas 에서 Button 추가 → 원래 초안 Apply → `staleBaseline` · 명령 0 · Button 남음 · 초안 보존.
8. (m3) `useEffect` 본문을 `doSomething()` 으로 + `<Text>` 추가 → 명령 0 · `derivedChanged` 1 줄.

### 1d. probe

- 생성기가 같은 종류 · 같은 글자 요소 둘을 낼 때 (예: Text 「Text」 둘) 짝짓기가 순서로만 갈리는지 — 짝짓기 규칙의 입력.
- `compose` 가 명령 N 개를 history 1 항목으로 묶고 중간 실패 시 전체 롤백하는지 (ADR-248 transaction 계약 재확인).

## 2. Phase 1 — 파서 · 역문법 · 의도 트리 · 왕복 게이트 (G1)

- `packages/shared/src/codeView/inverse/parse.ts` (lazy 진입 — `@babel/parser` import 는 이 파일만) · `grammar.ts` (AST → 의도 트리, 어휘표 read 함수들) · `intent.ts` (의도 트리 타입 = 문서 스키마의 부분집합, id 없음: `{ nodes: IntentNode[]; variables; views; rules; endpoints }`).
- 생성기 쪽: `generate.ts` 가 코드와 함께 **자기 의도 트리** 를 낸다 (`CodeViewResult.intent`) — 왕복 게이트의 기준값. 생성기 내부 상태 (`this.variables` · `this.views` · `this.rules` · 노드 순회) 에서 그대로 투영 — 두 번째 모델이 아니라 같은 순회의 다른 출력.
- 왕복 테스트: 수용 집합 5 (adr284CodeView 의 재현 문서) · golden 5 · 기존 code view 테스트 문서 전부 — `parse(generate(doc).code)` 의 의도 트리 `==` `generate(doc).intent` (deep-equal). 어휘 밖 샘플 10 → 거절 목록 (줄 · 이유 코드).
- 기존 `inverse.ts` (자리 역매핑) 는 Phase 2 끝까지 유지 (자리 강조는 그대로 쓴다). Phase 2 뒤 자리 편집 경로는 새 경로로 통합하고 `codeViewInverse` 의 「자리 밖 거절」 은 제거.

## 3. Phase 2 — 차이 → 명령 → 한 트랜잭션 (G2)

- `apps/builder/src/builder/catalogRuntime/codeViewDiff.ts`: `diffIntent(current, edited, doc) → { commands: CatalogCommand[]; rejected: Rejection[] }`.
  - **identity (h1 — 편집 연산 추적, 줄 LCS 없음)**: `packages/shared/src/codeView/inverse/identity.ts` — 입력은 baseline `anchors` 와 편집기가 준 **anchor 결말** (`AnchorOutcome = kept{from,to} | deleted | replaced{hunk}`) 과 편집본 텍스트. 편집기 (`CodeEditor.tsx`) 는 anchor 를 `StateField<RangeSet<AnchorValue>>` 로 들고 `ChangeSet` 마다 `map` (통째 삭제는 `deleted`, 범위 안 변경은 `kept`, 범위를 덮은 교체 hunk 는 `replaced`). 1차 — `kept` → 같은 id (범위 안 AST 를 baseline AST 와 비교해 글자 · prop · 자식 변경) · `deleted` → 삭제 후보 · anchor 밖 삽입 텍스트 → 추가 후보. 2차 — **정규화 텍스트 짝 (순서 아님 — round 3 h1)**: `replaced` hunk 의 지워진 anchor ↔ hunk 의 새 요소, 그리고 삭제 후보 ↔ 다른 곳의 추가 후보를 **정규화 JSX 텍스트**로 짝 → 같은 id, 자리가 바뀌었으면 `moveNodes`. 같은 텍스트 N:N 은 순서대로 (코드 결과 동일), N≠M 이고 그 모양의 후보 (그 부모의 같은 정규화 모양 요소 전부, `kept` 포함) 의 문서 상태 (`subtree` — 스타일 · 규칙 · 자식 · 참조) 가 다르면 `ambiguousIdentity`. 3차 — hunk 안에 남은 지워진 anchor ↔ 남은 새 요소 **수정 대응**: 그 부모 안에서 종류가 같은 남은 것이 양쪽 다 하나 (1:1) 일 때만 같은 id · 수정. anchor 둘 이상은 문서 상태가 같을 때만 순서대로, 다르면 `ambiguousIdentity`; 새 요소 둘 이상 (1:2 — 한 줄을 두 줄로 교체) 도 `ambiguousIdentity` (round 4 probe `one-old-two-new`). 4차 — 남은 삭제 후보 = 삭제, 남은 추가 후보 = 추가. 어느 단계든 한 요소에 문서 상태가 다른 후보가 둘 이상이면 거절 (수 감소에만 한정하지 않음). 명세 모델 테스트 (`identity.test.ts`): 리뷰 round 2 의 `identity-probe` 두 반례 (한 줄 A→B · 같은 줄 둘째 삭제) 가 편집 연산 입력으로 matched=1 / deleted=둘째 가 됨 + 붙여넣기 반례 (같은 둘 → 한 줄, 스타일 다름) 가 ambiguous + round 3 반례 (빨간 A · 파란 B 두 줄 선택 → B · A 순서 붙여넣기) 가 `moveNodes` 1 · 수정 0 · `[[b,B,blue],[a,A,red]]` (빨간 B 가 아님).
  - 요소: 같은 id 의 범위 안 변화 → 글자 (`setFields` 류 prop 쓰기) · prop 변경 (prop 쓰기 명령 — 바인딩 prop 은 `catalogBindingCommand`) · 자식 (재귀). 추가 → `insertNodes` (origin instance, 팔레트 경로 재사용 · 사용자 결정 1) · 삭제 → `removeWithReferrers` (결정 3) · 이동 → `moveNodes`.
  - 변수: 이름 짝 → 추가 · 삭제 · 시작값 · 타입 (결정 5 — 같은 순서 · 타입 · 시작값이면 rename).
  - 보기: 바인딩된 노드 단위 → 조건 (필드 · 비교 · 변수/값 로 짝) 추가 · 삭제 · 수정 · 「또는」 · 정렬 · 묶기 · 집계 · 공유 (같은 `items={x}` 를 둘이 읽으면 `catalogShareView` / `catalogJoinSharedView`).
  - 규칙: (노드 · When) 짝 → Do 목록 diff (`catalogInteractionsCommand`).
  - API: `useAsyncList` 의 매개변수 · 본문 · 응답 경로 → endpoint `updateRecord` · 조건 명령 (기존 `paramOf` 재사용).
- **편집 세션 (h2)**: `CodeViewEditSession = { projectId; pageId; baselineRevision; baseline: CodeViewResult; draft }` — 「코드 고치기」 진입 때 잡고 패널 state 로 보관 (page 별). diff 입력은 `baseline.intent` ↔ 편집본 (현재 문서가 아님). Apply: lazy parse → 현재 `workspace` 의 pageId · revision 대조 → 다르면 `staleBaseline` 거절 (초안 보존 · 「다시 불러오기」 = baseline 을 현재로 바꾸고 초안과 새 코드를 나란히) → 같으면 dry-run → `compose(…, { expectedRevision: baselineRevision })` — `compositionRoot.ts:1802` 의 「실행 직전 revision 재취득 · 재시도」 경로를 쓰지 않는다 (R8).
- dry-run: 명령 전부를 reader 사본에 적용해 검증 통과를 확인한 뒤 `compose` 로 실행 (R3). 하나라도 거절 → 전체 0.
- 거절 종류 (i18n 키 · 대안 문구) 표: `outsideVocabulary` (「이 식은 조건 비교 표 밖입니다 — 비교 방식 18 가지 중 하나로」) · `unknownTag` (「팔레트에 없는 요소 — 쓸 수 있는 이름: …」) · `unknownVariable` · `unknownField` · `unknownCollection` · `notInCode` (「크기 · 색 · 배치는 Design 패널에서」) · `commandRefused` (문서 검증 메시지) · `derivedChanged` (「이 줄은 문서에서 만들어집니다 — 되돌리거나, 데이터 원본은 `items={…}` 에서」) · `unknownReference` (「없는 이름 — 선언된 변수 · 데이터: …」) · `ambiguousIdentity` (「코드에서 구별되지 않는 요소가 둘 — Layers 에서 지우세요」) · `staleBaseline` (「편집을 시작한 뒤 문서가 바뀌었습니다 — 다시 불러오기」). 빈 대안 금지 정적 테스트.

## 4. Phase 3 — 패널 (G3)

- `apps/builder/src/builder/panels/codeView/CodeEditor.tsx` (새 파일 · lazy — CodeMirror 6 설치 · anchor `StateField` · `javascript({jsx: true, typescript: true})` · 자동완성 소스 (어휘표 + 현재 문서의 변수 · collection · 필드 — `completionSource`) · 스니펫 5 (`snippetCompletion`, 각각 패널 동작 함수의 코드 투영 — 단언: 스니펫으로 만든 문서 == `catalogFilterCommand` 류가 만든 문서, id 제외) · lint 소스 (300 ms debounce dry-run → `Diagnostic[]` = 거절 목록) · Escape 로 포커스를 패널로 · 테마 토큰은 패널 CSS 변수).
- `CatalogCodeViewPanel.tsx`: 「표시된 자리 고치기」 → 「코드 고치기」 (CodeEditor 마운트 · 편집 세션 baseline 잡기) · Apply = parse (lazy) → baseline 대조 → diff → 트랜잭션 → 코드 재생성 · 거절 목록 (줄 · 이유 · 대안) · `staleBaseline` 이면 「다시 불러오기」 버튼 · 자리 강조 유지 · 페이지 전환 때 초안은 page 별 보관 (다른 page 에 적용 0). i18n KO/EN (`codeView.*` 갱신 · 새 키 `codeView.rejectedWith` · 거절 종류 11).
- live (Chrome MCP · 별도 dev 서버): G3 시나리오 4.

## 5. Phase 4 — 번들 · 문서 (G4)

- `adr201-bundle-gate.mjs` 방식 실측 (Builder initial Δ · 파서 chunk 위치 · Preview Δ 0).
- 문서: ADR-284 본문 Decision 9 · 연구 §8.5 「편집의 범위」 · `.claude/rules/state-management.md` (code view 절이 있으면) · README · CHANGELOG · 메모리 `project-code-view-is-rac-reference-code` 문구 정정 (「1:1 자리만」 → 「닫힌 어휘 전체 — ADR-285」).

## 6. 추정 규모

- 새 파일 ~10 (vocabulary · intent · parse · grammar · identity (편집 연산 결말 → 대응) · codeViewDiff · CodeEditor · completion · snippets · 테스트 3) · 수정 ~9 (generate.ts intent · anchors 출력 · inverse.ts 통합 · codeView.ts · 패널 (편집 세션 · 편집기 마운트) · i18n · package.json ×2 · lazy 가드 테스트 · 판정 스크립트 어휘표 읽기). **추정 ~19 파일** — Phase 0 freeze 에서 재산정 (1.5 배 이상이면 inventory 보강 커밋으로 흡수, fork 사유 아님).

## 7. 사용자 결정 5 (본문 표) — 묻는 시점

| #   | 묻는 Phase                       |
| --- | -------------------------------- |
| 1   | Phase 2 (요소 추가 명령 작성 전) |
| 2   | Phase 1 (역문법의 JSX 글자 규칙) |
| 3   | Phase 2 (삭제 명령 선택 전)      |
| 4   | Phase 0 (실측 뒤 · 의존 선언 전) |
| 5   | Phase 2 (변수 diff 작성 전)      |

## 8. 기록

### Phase 0 — 2026-10-27 (G0 닫힘)

**어휘표 freeze** — `generate.ts` (2,164 줄, HEAD `7037d45f5`) 의 emit 지점 (역문법 read 가 짝으로 있어야 하는 것):

| emit (줄)                                                                                                         | 어휘                                                                                     | 문서 단위 · 명령 (§1a 표와 같음)  |
| ----------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | --------------------------------- |
| `writeImports` 498 · 주석 (`NOT_SENT` 70 · 「a variable not on this page」 1607)                                  | import · 주석                                                                            | 파생 — canonical 대조             |
| `writeState` 527 · `initialValue` 570                                                                             | `let [x, setX] = useState<T>(v)` (rule state `capability:` 포함)                         | 변수 · `catalogVariableCommands`  |
| `writeCollections` 585 · `writeRequest` 726 · `writeParam` 821 · `writeSortParams` 863 · `bodyCondition` 923      | `useListData` · `useAsyncList` · `url.searchParams` · body `where` · `useEffect(reload)` | collection · endpoint · 보기 조건 |
| `run` 286 ~ 295                                                                                                   | `useFilter` · `useCollator` · `useNavigate`                                              | 파생                              |
| `writeView` 995 · `fragmentOfGroup` 1242 · `fragmentOfCondition` 1291 · `skipOf` 1332 · `comparison` 1370         | `filter` 항 (비교 18 · skip · 적용 flag · 「또는」) · `toSorted`                         | 보기 조건 · 정렬                  |
| `writeGroup` 1078 · `aggregateFields` 1103 · `appliedCode` 1134                                                   | `Map.groupBy` · 집계 · 결과 수 행                                                        | 묶기 · 집계 · 파생 보기           |
| `fieldRead` 1204                                                                                                  | 참조 경로 `rows.find(…)?.f`                                                              | 필드 경로 (읽기만)                |
| `writeDragAndDrop` 1456                                                                                           | `useDragAndDrop({…})` 핸들러                                                             | dnd 규칙                          |
| `writeAction` 1586 · `eventValue` 1557                                                                            | Do 16 opcode (setState 4 op · list 12 · toast · navigate · callEndpoint · capability)    | 규칙 Do                           |
| `writeNode` 1844 · `propCode` 2073 · `propWhen` 1434 · `textCode` 2050 · `handlerCode` 2107 · `controlledBy` 1770 | JSX 요소 · prop · 값 조건 · 글자 템플릿 · 핸들러 · controlled 쌍 · `items={…}` 행 템플릿 | 노드 · prop · 규칙 · 바인딩       |

- 표의 각 행은 Phase 1 `vocabulary.ts` 한 항목 (emit 함수 이름 ↔ read 함수 이름) 이 된다.

**파서 · 편집기 실측** (scratchpad esbuild `--minify` + gzip -9):

| 묶음                                                                        | raw     | gz      | golden 5                                                     |
| --------------------------------------------------------------------------- | ------- | ------- | ------------------------------------------------------------ |
| CodeMirror 6 (`basicSetup` · lang-javascript · autocomplete · lint · state) | 505,207 | 168,502 | —                                                            |
| `@lezer/javascript` 1.5.6 (위에 포함)                                       | 129,839 | 46,877  | 5/5 오류 노드 0 · JSX 속성 · `TypeArgList` · 화살표 · 템플릿 |
| `@babel/parser` 7.29.8 (`jsx` · `typescript`)                               | 308,285 | 78,877  | 5/5 · 어휘 밖 샘플 10/10 파싱                                |
| `acorn` 8.18 + `acorn-jsx`                                                  | 255,101 | 72,027  | 4/5 — plants 6:96 `import {…, type Selection}` SyntaxError   |

- 깨진 코드 (`<Text>` 닫힘 없음 · `useState(;`) 는 lezer 가 오류 노드로 표시 (던지지 않음) — 역문법은 오류 노드 = 거절.
- **사용자 결정 4 = lezer 하나** (2026-10-27 질문). 의존: `pnpm-workspace.yaml` catalog 고정 `@codemirror/{autocomplete 6.20.4, commands 6.11.1, lang-javascript 6.2.5, language 6.13.1, lint 6.9.7, search 6.7.2, state 6.7.6, view 6.43.15}` → `apps/builder`, `@lezer/common 1.5.4` · `@lezer/javascript 1.5.6` → `packages/shared`.

**RED** — `apps/builder/src/preview/catalog/__tests__/adr285CodeViewRoundTrip.test.tsx` 11 `it.fails` (① ~ ⑧ — ⑥ 은 h1 4 경우). `it` 로 바꿔 돌린 실패 사유: 전부 `outsideSlot` 거절 (기대 동작 부재 — 하니스 오류 0). 입력은 편집기의 편집 연산 열 (`{from, to, insert}` 순서대로) 이라 Phase 2 는 `applyCode` 의 몸만 새 경로로 바꾼다. ② 는 「검색 추가」 를 실행한 같은 page 의 코드를 그 명령 없는 page 에 통째로 적용 — 왕복 (`code() === searched`) 까지 단언.

**probe**:

- `composeCommands` (`compose.ts:30`) — command 하나가 던지면 plan 전체 중단, 커밋 0 · ops 는 한 transaction = history 한 항목.
- `CatalogCompositionRoot.execute` (`packages/shared/src/catalog/runtime/compositionRoot.ts:1797`) 는 `REVISION_CONFLICT` 에 한 번 재계획한다 — Decision 4 의 「baseline revision 으로 실행 · 재시도 없음」 은 이 경로를 거치지 않는 실행 진입점이 필요 (Phase 2).
- 생성기는 같은 종류 · 같은 글자 요소 둘을 같은 텍스트로 낸다 (`<Text>Text</Text>` ×2) — identity 는 텍스트가 아니라 anchor (§3).
- 팔레트 instance 의 template 자식 · slot 채움은 코드에 나오지 않는다 (`<Button />` · `<ListBox />`) — 코드에 없는 것 = 보존 대상.

**번들 착수 값**: Builder initial JS gzip **1,450,889 B** (101 files, `adr209-bundle-closure.mjs`, HEAD `7037d45f5` + 의존 선언만) — ADR-201 상한 1,390,000 을 이미 넘는다 (282 G4 기록의 「284 이전부터 초과」 와 같은 상태, 이 ADR 의 제품 코드 0). G4 는 Δ (≤ +1,000) 와 chunk 위치로 판정하고 절대 상한 초과는 그대로 보고한다.

**규모 재산정**: 파서가 lezer 하나라 `parse.ts` 는 얇아지고 (`grammar.ts` 가 CST 를 읽음) 파일 수는 §6 추정 ~19 그대로.

### Phase 1 · 2 · 3 — 2026-10-27 (진행 — G1 · G2 핵심 닫힘, G3 일부, G4 열림)

**사용자 결정 1 · 2 · 3 · 5 = 권고안** (같은 날 질문 4 개 한 번에).

**설계 구체화 (통상 구현 판단)**:

- 「의도 트리」 를 별도 모델로 두지 않았다 — 생성기가 문서 단위마다 anchor (텍스트 범위 → id) 를 내고, 차이 계산은 anchor 단위로 바뀐 것만 읽는다. 대신 **재생성 대조** 가 왕복 불변식을 편집마다 집행한다: 계획한 명령을 stage 에 적용 → 그 문서로 코드를 다시 생성 → 편집본의 문장 (순서 무관) · JSX 트리 · 속성 · 글자가 그대로 돌아와야 적용. 돌아오지 않는 줄 = 거절 (`outsideVocabulary` · `notInCode` · `derivedChanged`). 새 요소는 팔레트 기본값이 더해져도 받는다 (결정 1). 파생 줄 (import · hook · effect · collection) 은 편집본에만 있고 baseline 과 같으면 받는다 (소유자를 지운 편집 — 재생성에서 사라짐), 바뀌었으면 `derivedChanged`. import 는 같은 module 의 이름 부분집합이면 받는다 (새 요소의 import 를 손으로 적지 않아도 된다).
- 실행은 `CatalogCompositionRoot.execute(command, { expectedRevision })` — 지정하면 `REVISION_CONFLICT` 에 재계획하지 않는다 (Decision 4). `workspace.execute` 가 같은 옵션을 넘긴다.
- 편집 연산: CodeMirror 의 `ChangeSet` 을 세션 시작부터 compose 해 `iterChanges` 로 baseline 좌표 변경 목록을 낸다. 테스트도 같은 `ChangeSet` 으로 편집 연산 열을 만든다.

**게이트 결과**:

- G1: parser 17 (golden 5 문제 0 · 어휘 밖 10 거절 + 줄 번호 · 깨진 코드) · 어휘표 정적 24 (emit · read 대조, pending 11 고정) · golden 5 왕복 (통째 붙여넣기 → 거절 0 · 명령 0, `adr284CodeView.test.tsx` `roundTrip`). **strict 왕복** (바뀌지 않은 단위도 다시 읽기, `strict: true`) 은 plants · kanban (행 필드 글자) · photos · ios-list (목록 명령 Do · 값 조건 prop) · emoji (정적 조건 항) 에서 거절 — pending 어휘와 같은 목록. strict 를 게이트로 올리는 것은 pending 0 뒤.
- G2: RED 11 GREEN (`adr285CodeViewRoundTrip.test.tsx` — ① Text 추가 · history +1 ② 「검색 추가」 코드 통째 적용 → 변수 1 · SearchField · 규칙 1 · 조건 1 · 코드 동일 ③ `&& item.age >= 20` → gte 조건 ④ Button 삭제 → 규칙 함께 · Undo 1 로 둘 다 ⑤ 잘라 붙이기 → 이동 · 색 보존 ⑥ h1 4 경우 ⑦ Canvas 변경 뒤 → `staleBaseline` ⑧ effect 변경 + Text 추가 → `derivedChanged` 1 · 명령 0) · identity 12 (리뷰 round 2 ~ 4 probe) · catalogRuntime 회귀 297 파일 2,468 PASS.
- G3 (일부): CodeMirror 편집기 · 자동완성 (팔레트 이름 · 변수 · setter · collection · `item.` 필드) · 300 ms 진단 · 거절 목록 (줄 · 이유 · 대안 KO/EN) · 다시 불러오기 · page 별 초안. live 3/5 (5174 새 프로젝트 — Text 추가 · 어휘 밖 거절 · 삭제 + Undo). **남음**: 스니펫 5 (+ 패널 동작과 같은 문서 단언) · live 2 (「검색 추가」 코드 → Preview · 편집 중 Canvas 변경).
- G4 (열림): Builder initial 1,452,177 B — 착수 대비 **+1,288 B** (상한 +1,000 초과). initial 에 실린 것은 i18n 문자열 (거절 이유 · 대안 9 쌍 KO/EN) 과 실행 옵션뿐, `CodeEditor-*.js` (CodeMirror · lezer) 와 패널 chunk (역문법 · 차이) 는 initial 밖. 대안: 거절 문구를 패널 chunk 의 지역 사전으로.

**어휘 pending 11** (`vocabulary.ts` — 편집하면 재생성 대조가 그 줄을 거절, 그대로면 통과): 목록 선택 변수 · 요청 매개변수 · 요청 정렬 · 「또는」 묶음 · `toSorted` · `Map.groupBy` · 결과 수 행 · `useDragAndDrop` · 값 조건 prop · 행 필드 글자 · 목록 명령 · capability · endpoint Do.

### Phase 1 ~ 4 마무리 — 2026-10-27 (G1 · G2 · G3 · G4 닫힘, G5 남음)

**어휘 pending 11 → 0** (`vocabulary.ts` `read` 필수):

| 형태                                                  | 읽는 곳                          | 문서                                                                                                               |
| ----------------------------------------------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `let {selectedKeys: x, setSelectedKeys: setX} = list` | `planSelections`                 | 그 목록 `selectedKeys` 의 이름 붙은 변수 (`source`)                                                                |
| `url.searchParams.append(…)` · `set(_sort …)`         | `requestOf` (`codeViewViews.ts`) | served 보기의 조건 · 정렬 (접미 표 역변환 · guard → skip / enabled · `between` 두 줄 · 날짜 필드는 after / before) |
| `(a \|\| b)` 묶음                                     | `itemOf`                         | 「또는」 그룹 — 같은 비교 · 다른 필드면 여러 필드 조건 (생성 코드가 같다)                                          |
| `.toSorted(…)`                                        | `specOf`                         | 상수 필드 정렬 · 정렬 변수 (`<v>Dir` 줄과 짝)                                                                      |
| `Map.groupBy` 세 문장                                 | `groupedOf`                      | `groupBy` · `emptyGroups: "all"` · 집계                                                                            |
| `[{id: 'row-1', …}]`                                  | `aggregateOf`                    | count · applied · sum · mean · min · max                                                                           |
| `useDragAndDrop({…})`                                 | `planDragAndDrop`                | 각 `on…(e) { … }` = 그 목록의 drop 규칙 (Do 는 `dosOf`, 이벤트 필드 `e.…`)                                         |
| `prop={x === … && …}`                                 | `whenOf`                         | `PropWhen` (selection `size` · exists · notExists 포함)                                                            |
| `${rows.find(row => row.id === k)?.f ?? ''}`          | `textValue` + `planCodeViews`    | 글자 `{f}` + 그 요소의 key 바인딩 (보기 · key)                                                                     |
| 목록 명령 · capability · fetch                        | `dosOf` · `capabilityOf`         | list Do · 이름 붙은 상태 setter → capability · `callEndpoint` · reset · 글자 toggle                                |

**설계 구체화 (통상 구현 판단)**: 보기 문장은 이름으로 소유자를 정한다 — baseline 의 이름이면 그 소유자, 새 이름이면 「목록 하나만 `items` 로 읽음 · 행 원본 · 집계 · 묶기 없음 · 다른 보기 · 행 읽기가 읽지 않음」 일 때 그 목록의 내장 보기, 아니면 새 공유 보기 (이름 = 코드 이름). baseline 과 같은 문장은 다시 읽지 않는다 (strict 제외). 변수 시작값 비교에서 선택 (`array` · `string[]`) · 구조 변수의 빈 시작 (`""` · `null`) 은 같은 것으로 본다 (코드가 구별하지 않음).

**스니펫 5** (`codeViewSnippets.ts`): 패널 동작 함수 (`catalogFilterCommand` · `catalogSortFollowCommand` · `catalogResultCountCommand`) 를 초안 계획 위 stage 에서 실행 → 생성 코드 → 편집기가 줄 LCS 로 다른 줄만 쓴다 (`codeEditorLineChanges`). 동작은 `codeViewActions.ts` registry 로 받는다 (아래 G4).

**게이트 결과**: strict 왕복 golden 5 (거절 0 · 실행 뒤 코드 동일) · 붙여넣기 6 (검색 · 라디오 · 정렬 · 결과 수 · API 매개변수 · 또는 — 코드 · id 를 뺀 문서 모양 동일 · history +1 · Undo 1) · 스니펫 5 (스니펫 코드 == 패널 동작 문서) · 편집 3 (값 조건 prop · 상수 정렬 · `items={users}` 새 목록) · identity 13 · line diff 11 · 회귀 shared catalog · codeView 1,115 + builder catalogRuntime · preview catalog · codeView 3,003 PASS.

**live 에서 찾은 결함 2 (수리 · 원복 RED)**: ① `<Text>` 줄을 `<ListBox …>` 로 바꾼 편집 — CodeMirror 의 최소 변경이 `<` · `>` 를 남겨 Text anchor 가 `kept`, 짝지은 id 의 type 이 달라 `notInCode` 거절. kept 짝도 태그가 같아야 한다 (`identity.ts` — 원복 시 identity 테스트 RED). ② 공용 `stageOver` 가 stage 를 감쌀 때 `libraryFor` 를 주지 않아, 중첩 명령이 project record 를 쓴 뒤 library 를 읽으면 `libraryFor is not a function` (스니펫 「결과 수 표시」 · 「검색 추가」 RED) — 아래 graph 의 `libraryFor` 로 위임.

**G4 번들**: 착수 1,450,889 → **1,451,158 B (Δ +269, 101 files)**. 측정 경로: 거절 문구 i18n (Δ +1,288) → 패널 chunk 지역 사전 (Δ +62) → 스니펫이 `viewAuthoring` 을 정적 import (Δ +2,588, 106 files — main −14.5 KB · 공유 chunk `viewAuthoring` +16.4 KB · 아이콘 chunk 분리) → `import()` (Δ +2,995, 108 files — 같은 분할) → registry 역전 (Δ +269). Preview 코드 변경 0.

**사후 보고 (scope)**: 추정 ~19 파일 → 실측 누적 ~38 (Phase 0 ~ 3 커밋 28 + 이번 새 파일 `codeViewViews.ts` · `codeViewSnippets.ts` · `codeViewActions.ts` · `codeViewMessages.ts` · 테스트 2 + 공용 `compose.ts` · `identity.ts` 수리) — 1.5 배 초과, inventory 보강으로 흡수 (fork 사유 아님).

**남음**: G5 — 사용자 Builder 확인 (사용자 사례 `<Text>` 추가 · 「검색 추가」 를 코드로 · 요소 삭제) → Implemented.

### 후속 — 2026-10-27 바로 편집 화면 (사용자 제안)

- 사용자: 「edit code 를 매번 누르기보다 바로 편집 화면이 나오는 것이 어떨」 → 「코드 고치기」 버튼을 없애고 패널이 편집기를 바로 띄운다. 세션 baseline 은 첫 입력 때 잡힌다 (Decision 4 문구 갱신). 입력 전에는 패널의 현재 코드가 baseline 이고, 문서가 바뀌면 `CodeEditor` 가 새 코드를 다른 줄만 써 넣는다 (`rebase` annotation — `onChange` 없음 · undo 항목 없음 · 편집 연산은 새 baseline 부터 다시 셈). 입력이 baseline 과 같아지면 초안을 버리고 다시 문서를 따라간다. 「변경 취소」 · 「다시 불러오기」 는 편집기를 현재 코드로 다시 연다.
- 게이트: `panels/codeView/__tests__/codeEditorRebase.test.tsx` 2 (새 baseline = 편집 아님 · 다음 편집은 새 baseline 기준 — `rebase` 건너뛰기를 지우면 RED) · type-check · 관련 builder 스위트 PASS · live 8 (ADR Live Exercise 표).
- Undo · Redo (사용자 질문 「undo redo history 가 단일 소스로 동기화 되는지」): 문서의 기록은 workspace history 하나 — 적용 = 1 step, Canvas · History 패널 · 편집기 모두 그 기록을 따른다. 편집기의 CodeMirror history 는 **입력 중 초안의 글자 단계만** 가진다 (ADR-212 의 격자 셀 초안과 같은 구분). 결함: 전역 Undo 단축키가 `allowInInput` + capture 라 편집기 안의 ⌘Z 가 CodeMirror 에 닿지 않고 문서를 되돌렸다 (초안이 낡아 적용 거절). 수리: 편집기 host 가 자기 입력 단계가 있을 때만 `data-shortcut-local="undo" · "redo"` 를 단다 (`undoDepth` · `redoDepth`) — 없으면 문서 Undo 로 가고 편집기가 따라간다. 새 baseline 을 쓸 때 CodeMirror history 를 비운다 (`Compartment` 재구성 — 지난 baseline 의 단계가 남지 않게). 게이트: `codeEditorRebase.test.tsx` 3 번째 (호출을 지우면 RED) · live 9.
- 코드의 출처 (사용자 원칙 2026-10-27 「빌더의 모든 코드의 소스는 단일 catalog 로 집중되어야 한다」): 지금 코드 보기는 catalog 문서 (페이지 · 요소 · 상태 변수 · 규칙 · 보기 · 테마) 와 data store + IndexedDB (데이터 표 스키마 · mock 행 · API endpoint · 프로젝트 변수 — `stores/data.ts`) 두 곳을 읽는다. 같은 날 사용자 결정: **정의만 catalog 로** (API 실행 결과 `runtimeData` 는 캐시 유지) · **ADR-285 먼저 닫고 이관은 새 ADR** (사용자 `/create-adr`). 2026-05 의 「collections 를 문서 root 로 올릴 의미 없음」 (ADR-131 · 132) 은 이 결정으로 바뀐다. 이 ADR 의 범위는 그대로 — `catalogCodeViewData` 가 이관 뒤 catalog reader 로 바뀌는 일은 새 ADR 에 포함.
- 사이트 설정 (사용자 지적 2026-10-27 「framer 의 경우 사이트 전체의 설정 부분이 있다 — 우리는 그 부분을 놓치고 있다」): 지금 `ProjectEntry` 는 이름 · 페이지 배치 · toast 위치, `PageEntry` 는 route · name 뿐이고 publish 의 `<title>` 은 고정 문자열이다. 같은 날 결정: 위 catalog 이관 ADR 에 **포함** — 사이트 기본값 (favicon 밝은 · 어두운 · 제목 · 설명 · 소셜 이미지 · 언어) · 페이지별 덮어쓰기 (제목 · 설명 · 소셜 이미지 · 검색 숨김) · 검색 · 호스팅 (색인 허용 · sitemap · robots · redirect) · **SSO** — 같은 날 결정 「둘 다」: 사이트 방문자 로그인 (SAML · OIDC · 보호할 페이지 — 공유 비밀번호 보호도 같은 자리) 은 이 이관 ADR 에, 빌더 팀 로그인 (Framer Enterprise 방식) 은 계정 · 인증 영역이라 별도 ADR. custom code (임의 스크립트) 는 제외.

### G5 — 2026-10-27 (닫힘 · Implemented)

- 사용자 지시 「ADR-285 G5 부터」. G5 의 세 시나리오를 Chrome MCP 로 별도 dev 서버 5174 「adr285-live」 에서 돌렸다 (본문 Live Exercise 10 ~ 12): ① `<Text>Hello G5</Text>` 추가 → 적용 → Canvas · `Text` import ② 「스니펫 → Add search · Users · company」 → 변수 · 조건 · 규칙이 코드로 → 적용 (4 변경) → Preview `tech` 10 → 3 행 ③ 두 요소 줄 삭제 → 적용 → ⌘Z 한 번 복원. 콘솔 오류 0 · 지적 0.
- 관찰 (결함 아님): 요소 줄만 지우면 그 요소와 규칙만 지워지고, 지우지 않은 변수 · 조건 줄은 문서에 남는다 — 편집한 만큼만 적용 (Decision 2). 편집기의 JSX 자동 닫힘 태그가 손으로 `</Text>` 까지 치면 한 번 더 들어간다 — 진단이 바로 보여 지우면 된다 (LOW, 편집기 기본 동작).
- 종결: Implemented — 본문 `git mv` → `completed/` · README (공지 · 열려 있는 것 · 순서 표 · 완료 표 306 · 열림 2 · 합계 308) · CHANGELOG · 메모리 `project-code-view-structural-edit-closed-vocabulary`. 후속 ADR-286 선행 충족.

### 후속 — 2026-10-28 ADR-287 어휘표 1 행

- `vocabulary.ts` 에 「규칙 Do 의 암묵 상태」 행 추가 (form `let [nodeProp, setNodeProp] = useState(v) · <Tag prop={nodeProp}> · setNodeProp(…)` · emit `writeState` · read `capabilityAt` · unit 「rule Do (a reference API prop)」). 변수가 이름 붙이지 않은 prop 에 규칙 Do 가 쓰면 생성기가 RAC 의 controlled 모양을 내고 (시작값 = 작성 값), 역변환이 setter 호출을 그 노드의 Do 로 읽는다 (`CodeViewSymbols.states`). 상세: [ADR-287 breakdown §8 Phase 3](287-interactions-do-from-reference-api-breakdown.md).
