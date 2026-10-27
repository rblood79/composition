# ADR-285 design breakdown — code view 역변환 (닫힌 어휘 전체)

> 본문: [285-code-view-closed-vocabulary-round-trip.md](../285-code-view-closed-vocabulary-round-trip.md). 착수는 ADR-284 Implemented (G8) 뒤.

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

(Phase 마다 추가.)
