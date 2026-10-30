# 코드 편집기 전체 범위 설계 — 패널 없이 코드만으로 모든 기능 저작 (2026-10-30)

> 상태: **설계 초안 (ADR 입력)**. 사용자 지시 2026-10-30 「code editor 기능 가능한 부분 최대한 확장 가능 하게 설계 시작해. 인터렉션 없이 스크립트 만으로 이벤트나 모든 기능들을 가능한 code editor에서 할수있게 확장 설계해」. ADR 작성은 사용자 `/create-adr` (CLAUDE.md §작업 워크플로) — 이 문서는 그 입력이다. 순서는 사용자 결정 10-27 「코드 편집 범위 확장은 ADR-286 뒤 한 번에」 를 따른다 (286 Implemented 10-29).
>
> 선행: [ADR-285](../../adr/completed/285-code-view-closed-vocabulary-round-trip.md) (닫힌 어휘 왕복) · [ADR-286](../../adr/completed/286-catalog-single-source-data-site-settings.md) (코드의 소스 = 단일 catalog) · [ADR-287](../../adr/completed/287-interactions-do-from-reference-api.md) (Do = 레퍼런스 API) · [ADR-283](../../adr/completed/283-interaction-capability-target-ref-picker.md) (대상 참조) · [ADR-281](../../adr/completed/281-interactions-panel-vocabulary-inheritance-form-destination.md) (상속) · [ADR-291](../../adr/completed/291-data-query-vocabulary-computed-fields.md) (계산 필드).

## 0. 지시의 뜻 — 무엇을 넓히고 무엇은 그대로인가

**넓히는 것**: 코드 편집기의 범위를 「page 하나의 데이터 층 · 규칙」 에서 **프로젝트 문서 전체** 로. 패널 (Interactions · Design · Data · Site · Components · Layers) 로 할 수 있는 모든 저작을 코드에서도 같은 문서 명령으로 할 수 있어야 한다. 「인터렉션 없이」 = Interactions 패널을 열지 않고 이벤트 · 동작을 전부 코드로 적을 수 있다는 뜻으로 읽는다 (패널을 없애는 것이 아니다 — 두 길이 같은 문서를 쓴다).

**그대로인 것** (사용자 결정 10-26 · 10-27, 원칙 10-26):

- 코드 = **레퍼런스 모양의 RAC 코드**. 전용 DSL 아님.
- **닫힌 어휘**. 임의 JS (함수 정의 · 계산식 · 새 hook · 외부 import) 는 줄을 짚어 거절. 문서에 스크립트 문자열을 저장하지 않고 실행하지 않는다 (`eval` · `new Function` 0). 「스크립트까지 동일하게」 는 생성기가 내는 어휘 전부를 고치고 더하고 지울 수 있다는 뜻이다 (메모리 `project-code-view-structural-edit-closed-vocabulary`).
- **정본 = 문서**. 코드는 문서의 투영이고, Apply = 차이 → 기존 명령 한 step (Undo 한 번 · 저장 · Preview 파이프라인 그대로).
- 「불가 → 스크립트 escape」 금지 — 코드로 못 적는 기능은 escape 가 아니라 **어휘에 채워야 할 결함**이다 (원칙 `project-builder-purpose-labor-cost-consistency`).

그래서 이 설계의 실제 일은 두 가지다. ① 생성기 · 역변환이 덮는 문서 범위를 전체로 넓히기 (투영 문제) ② 문서 자체에 표현이 없는 저작 (규칙의 조건 · 분기 · 응답 처리) 을 문서 스키마에 넣기 (모델 문제 — 코드와 패널이 같이 쓴다).

### SSOT 도메인

- D1: JSX 요소 · 이벤트 이름은 설치된 RAC 이름 그대로 (생성기가 이미 그렇다). DOM · ARIA 를 코드가 지정하지 않는다.
- D2: prop 이름 · 값 = binding `accepts` (S2 정본 순서). 코드에 적은 prop 이 `accepts` 밖이면 거절.
- D3: 스타일 값의 정본은 계속 catalog 문서 (`NodeEntry.visual` · `layout` · `sizing` · `fills` · `responsive` · `stateRules`) + theme/tokens. **`styles.css` 는 그 투영**이고 독립 정의가 아니다 — 편집은 문서 명령으로 돌아가므로 「수동 CSS 가 SSOT 에서 파생 아님」 (ssot-hierarchy §6) 에 해당하지 않는다. 컴포넌트 기본 rule (`COMPONENT_RULES_TABLE`) 은 사용자 문서가 아니라 코드에서 읽기 전용.
- 경계 이동 없음.

## 1. 현재 실측 (main `2cbb83de9`, 2026-10-30)

### 1a. 범위

- 생성기 입력은 `pageId` 하나 (`packages/shared/src/codeView/types.ts:57-62`), 출력은 `export default function <Page>()` 한 파일 (`generate.ts:281-385`). 패널도 page 세션 (`panels/codeView/CatalogCodeViewPanel.tsx:88-121`).
- 문서 entry 14 종 (`catalog/document/types.ts:144-158`) 중 코드에 나오는 것: page 아래 node 트리 · stateVariable · interaction · view · collection / endpoint 일부 · 계산 필드. 어휘표 25 행 전부 page 범위 (`codeView/vocabulary.ts:18-165`).
- 생성기 머리말 「styles are not code」 (`generate.ts:19`). 스타일 류 편집은 `notInCode` 「크기 · 색 · 배치는 Design 패널에서」 (`panels/codeView/codeViewMessages.ts:41-45`).

### 1b. 코드에 없는 문서 영역 (투영 gap)

| 영역                                                                                          | 문서 위치                              | 지금                                                                                                    | 레퍼런스 앱의 모양 (근거)                                                                                                                                           |
| --------------------------------------------------------------------------------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 라우팅 (route · 중첩 parentId)                                                                | `types.ts:910-924`                     | `navigate('/route')` 안에서만                                                                           | `createBrowserRouter([{path, element, children}])` — 이미 `useNavigate` import (`generate.ts:601`)                                                                  |
| 동적 매개변수 `{{ params.id }}`                                                               | `DataBindingRef.key`                   | `${params.id}` 를 쓰지만 `params` 선언 없음 (`generate.ts:2345-2366`)                                   | `let params = useParams();`                                                                                                                                         |
| page meta (title · description · social · hidden)                                             | `types.ts:811-816`                     | 없음                                                                                                    | React 19 `<title>` · `<meta>` JSX                                                                                                                                   |
| 사이트 설정 (제목 · lang · favicon · 검색 · redirect · 방문자 접근)                           | `types.ts:775-809`                     | 없음                                                                                                    | `index.html` · `robots.txt` · `sitemap.xml` · 호스트 redirect                                                                                                       |
| 프로젝트 · toast 배치 · 테마 선택                                                             | `types.ts:735-768`                     | `toasts` 큐만 파생 줄 (`generate.ts:362-367`)                                                           | `App.tsx` 루트 (`<RouterProvider>` · `<ToastRegion placement>`)                                                                                                     |
| D3 스타일 (visual 22 · layout ~35 · sizing · fills · responsive · stateRules · themeOverride) | `types.ts:299-418, 826-909`            | 없음                                                                                                    | fixture 세 방식 — CSS 파일 + `className` (`photos-App.tsx.txt:6`, `emoji-picker.tsx.txt:13`) · tailwind (plants · kanban) · `style={{…}}` (`photos-App.tsx.txt:51`) |
| metadata (htmlId · className · aria-label)                                                    | `types.ts:1134-1140`                   | 없음 — `className=` 을 적으면 일반 prop 계획 (`codeViewEdit.ts:1072`)                                   | `className` · `id` · `aria-label`                                                                                                                                   |
| 컴포넌트 원본 · Local override · instance override · slot                                     | `types.ts:925-996, 534-575, 1084-1093` | **instance 가 root 타입으로 나온다** (`<Group>` — `catalog/commands/context.ts:98-120`) · template 없음 | 별도 파일 `export function Sidebar({…}: SidebarProps)` (`photos-Sidebar.tsx.txt:24`) · `children` · 이름 붙은 ReactNode prop                                        |
| 프로젝트 변수                                                                                 | `types.ts:1390-1398`                   | 없음 — Do 는 주석 `// (a variable not on this page: …)` (`generate.ts:1855`)                            | `createContext` + Provider · 또는 store 모듈                                                                                                                        |
| collection 스키마 · mock 행                                                                   | `types.ts:1323-1361`                   | `import users from './data/users'` 만 — 파일 내용 없음, 편집 = `derivedChanged`                         | `data/plants.ts` = 타입 + 행 배열 (`plants-plants.ts.txt`)                                                                                                          |
| endpoint (headers · body · timeout · retry · server 실행)                                     | `types.ts:1362-1389`                   | `fetch(url, {method})` · `dataPath` · 요청 매개변수만                                                   | `api/users.ts` fetch wrapper                                                                                                                                        |
| theme · token · asset                                                                         | `types.ts:1141-1155, 1314-1321`        | 없음 — prop 안 `TokenUse` 는 **조용히 빠짐** (`generate.ts:2399`)                                       | `theme.css` `:root {--tint}` · `var(--token)` · `import aloe from './plants/aloe.jpg'`                                                                              |
| `{kind}` 객체 prop (CalendarDuration · NumberFormat)                                          | `types.ts:245-252`                     | 조용히 빠짐 (`generate.ts:2399`)                                                                        | `visibleDuration={{months: 2}}` · `formatOptions={{…}}`                                                                                                             |

### 1c. 이벤트 · 동작의 gap (어휘 결함)

규칙 저장 형식 `InteractionEntry {ownerId, address?, trigger, actions[]}` — 「조건 · 분기 없음 (ADR-158)」 이 주석으로 고정 (`types.ts:1182-1193`). Do 15 opcode.

| #   | gap                                                                                                                                                         | 근거                                                                                                                                                   | 종류               |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------ |
| E1  | 숨김 When (press 부수 · hover · focus · keyboard · item 이벤트) 은 출력되지만 고치면 `outsideVocabulary`                                                    | `codeViewEdit.ts:1263` 이 registry `events` 만 받음 (`capabilityRegistry.ts:242-244`)                                                                  | 비대칭             |
| E2  | 공통 `show` · `hide` · `toggle` 은 출력되지만 read 0                                                                                                        | `capabilityAt` 가 `def.prop === "isVisible"` 로 찾는데 실제 `def.prop` 은 `"style.display"` (`codeViewEdit.ts:1370` · `capabilityRegistry.ts:141-163`) | 출력만             |
| E3  | Form `submit` · `reset` = `formRef.current?.submit()` 인데 `useRef` · `ref=` 출력 없음, read 없음                                                           | `generate.ts:1983-1986`                                                                                                                                | 불완전 코드        |
| E4  | 대상 참조 `{address}` · `{local}` · `{unset}` (ADR-283) = 주석                                                                                              | `generate.ts:1972-1973`                                                                                                                                | 빠짐               |
| E5  | instance 안 노드 규칙 (`address`) 이 instance 요소의 handler 로 출력, read 는 제외                                                                          | `generate.ts:413-418` · `codeViewEdit.ts:1256`                                                                                                         | 잘못된 자리        |
| E6  | 원본 상속 규칙 · instance 의 `"off"` · 대체 맵 표현 없음                                                                                                    | `resolution/effectiveInteractions.ts`                                                                                                                  | 빠짐               |
| E7  | page 루트 (body) 의 상속 prop (`isDisabled` · `colorScheme`) · 규칙 · body 대상 Do                                                                          | body 를 fragment 로 평탄화 (`generate.ts:2080-2084`)                                                                                                   | 빠짐               |
| E8  | 프로젝트 변수의 `setState` · `!var.<id>`                                                                                                                    | `generate.ts:229-235, 1525, 1855`                                                                                                                      | 빠짐               |
| E9  | 같은 When 의 규칙 N 개를 handler 하나로 펼치고, read 는 첫 id 로 합침 — 독립 실행 → 「앞 Do 실패 시 중단」 으로 **의미가 바뀐다**                           | `generate.ts:2414` · `codeViewEdit.ts:1258-1278` · 실행 `bindings.ts:96-104`                                                                           | 의미 결함          |
| E10 | tree `parentKey` · `toParentKey` 출력 없음 — 왕복하면 사라짐                                                                                                | `generate.ts:1883-1943`                                                                                                                                | 손실               |
| E11 | `callEndpoint` 를 URL 로 식별 (같은 URL 둘이면 모호) · 코드는 `await` 인데 실행은 기다리지 않음                                                             | `codeViewEdit.ts:1604-1620` · `catalogPreviewInteractions.ts:442-454`                                                                                  | 의미 결함          |
| E12 | `remove(...단수)` · `increment` 참조 값 원문 출력                                                                                                           | `generate.ts:1922, 1865`                                                                                                                               | emit 결함 후보     |
| E13 | 대상 state 가 없으면 Do 를 아무 표시 없이 생략 → handler 를 고치면 그 Do 가 조용히 사라질 수 있음                                                           | `generate.ts:1975, 1989`                                                                                                                               | 조용한 손실        |
| E14 | 스키마에 없음: 조건부 실행 (`if`) · 분기 (`else`) · 응답 → 변수 (`then`) · 실패 처리 (`catch`) · 지연                                                       | `types.ts:1189-1191` · `interactionRule.types.ts:10-12`                                                                                                | **모델 결정 필요** |
| E15 | 등록 안 된 RAC callback: `useDragAndDrop` 의 `onDragStart` · `onDragMove` · `onDrop` · `onDropEnter/Exit` · Table `onResize*` · 입력 `onCopy` · `onPaste` … | `concepts/collectionDragDrop.ts` (5 개만)                                                                                                              | 표면 누락          |

`vocabulary.ts` 는 「모든 형태에 reader 가 있다」 고 적지만 E2 · E3 · E4 는 reader 가 없다 — 어휘표 정적 테스트가 「이름이 있는가」 만 보고 「그 모양을 실제로 읽는가」 는 안 본다 (§5 G1 이 고친다).

## 2. 목표 모양 — 프로젝트 = 가상 파일 트리

레퍼런스 fixture 가 여러 파일 (plants 4 · photos 3) 이듯, 코드 편집기는 문서 전체를 **표준 React 프로젝트 모양의 가상 파일 트리**로 보여 준다. 파일 하나 = 문서 영역 하나. 모든 파일이 같은 규칙 (생성 → anchor → 편집 연산 추적 → 역문법 → 차이 → 명령 → 재생성 대조) 을 따른다.

```
index.html                 사이트 설정 (lang · title · favicon · meta · theme-color)       ← ProjectEntry.site
site.config.ts             검색 (색인 · sitemap · robots) · redirect · 방문자 접근 (비밀 없음)  ← ProjectEntry.site
src/App.tsx                router (pages · 중첩 · layout route) · ToastRegion · Provider · theme 선택
src/theme.css              :root {--tint …} · 사용자 token (var(--name))                       ← theme · token
src/state/project.ts       프로젝트 변수 (createContext + useProjectState)                      ← projectVariable
src/data/<collection>.ts   type <Row> = {…} · export default [행 …] · 계산 필드                 ← collection
src/api/<endpoint>.ts      fetch wrapper (method · URL · headers · query · body · 응답 경로 · timeout · retry)
src/components/<Name>.tsx  Local 원본 = 함수 컴포넌트 (props = properties · children / 이름 붙은 slot)
src/components/<Name>.css  원본 template 의 스타일
src/pages/<Page>.tsx       page (지금 생성기 — useParams · <title> · body 상속 prop 추가)
src/pages/<Page>.css       page 노드의 스타일 (class · @media · 상태 선택자)
public/…                   asset (목록 · 읽기 전용 — 파일 업로드는 Assets 패널)
node_modules/@composition/library/*   Library 원본 (읽기 전용 — 고치려면 unlock, ADR-282)
```

### 2a. 파일별 어휘 (각 행 = emit 하나 · read 하나 · 명령)

| 파일                 | 코드 모양 (닫힌 어휘)                                                                                                                                                                                                                                                                                               | 문서 명령 (기존 · 신설)                                                     |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `index.html`         | `<html lang>` · `<title>` · `<meta name=description>` · `<link rel=icon>` (밝은 · 어두운 `media`) · `og:image` · `theme-color`                                                                                                                                                                                      | 사이트 명령 (ADR-286)                                                       |
| `site.config.ts`     | `export default {search: {index, sitemap, robots}, redirects: [{from, to, status}], access: {kind: 'password' \| 'sso', pages: […]}}` — 리터럴 객체만                                                                                                                                                               | 사이트 명령                                                                 |
| `App.tsx`            | `createBrowserRouter([{path, element: <Page/>, children}])` · layout route = `<Outlet/>` 을 둔 원본 · `<ToastRegion placement>` · `<ProjectStateProvider>` · `<Theme name>`                                                                                                                                         | page 추가 · 삭제 · 이동 (`parentId`) · route 변경 · toast 배치 · 활성 theme |
| `theme.css`          | `:root` 의 정해진 custom property (tint · neutral · radius · 다크 모드) + 사용자 token 선언                                                                                                                                                                                                                         | theme 명령 · token 추가 · 삭제 · 이름 · 값                                  |
| `state/project.ts`   | `export const projectState = {name: initial, …}` 한 객체 + 타입 (`string` · `number` · `boolean` · date (`parseDate`) · JSON) · persist 표기                                                                                                                                                                        | projectVariable 명령 (ADR-286 · 292)                                        |
| `data/<c>.ts`        | `export type <Row> = {field: T}` · `export default [{…}]` (≤ 1,000 행, ADR-286) · `export const fields = {key: {type, formula}}` (ADR-291)                                                                                                                                                                          | collection 스키마 · 행 · 계산 필드 명령                                     |
| `api/<e>.ts`         | `export default endpoint({method, url, headers, query, body, response: 'data.items', timeout, retry, run: 'server'})` — `endpoint()` 는 생성 코드가 import 하는 고정 도우미 (호출 = 선언, 실행 아님) · 비밀은 `secret('NAME')` 이름만                                                                               | endpoint 명령                                                               |
| `components/<N>.tsx` | `export function N({label, isActive, children, header}: NProps)` · 본문 JSX = template · prop 사용 = property 바인딩 · `children` / `{header}` = slot                                                                                                                                                               | definition 명령 · template 노드 명령 · properties                           |
| `pages/<P>.tsx`      | 지금 어휘 + `<N label="…" header={<…/>}>…</N>` (instance — 이름 그대로) · prop = override patch · slot 채움 · `useParams` · `<title>` · `<meta>` · 상속 prop 은 루트 `<Page isDisabled colorScheme>` 래퍼                                                                                                           | 지금 명령 + instance patch · fillSlot · replace · page meta                 |
| `*.css`              | 노드 하나 = 클래스 하나 (`.p-hero-title` — 노드 이름에서, anchor 가 identity) · 속성 = `VisualField` · `LayoutField` 1:1 · `@media (max-width: …)` = `responsive.tablet/mobile` · `[data-hovered]` · `[data-pressed]` · `[data-selected]` = `stateRules` · `var(--token)` = `TokenUse` · 여러 배경 = `fills` 레이어 | Design 패널이 쓰는 같은 명령                                                |

### 2b. 이벤트 · 동작 — 규칙의 닫힌 스크립트 문법

handler 본문은 **문 (statement) 목록**이고, 각 문은 Do 하나 또는 아래 제어문 하나다. 문서에는 구조 (트리) 로 저장되고 문자열은 저장하지 않는다.

```tsx
<Button onPress={async () => {
  if (selectedKeys.size === 0) {                       // 조건 = 보기 조건과 같은 비교표 (18 비교 · 변수 · 행 필드 · event)
    toasts.add({title: '먼저 고르세요'});
    return;
  }
  try {
    let result = await saveOrder({body: form});        // api/<e>.ts — 응답을 기다린다
    setOrderId(result.id);                             // 응답 경로 → 변수 (then)
    navigate(`/orders/${result.id}`);
  } catch {
    toasts.add({title: '저장 실패'});                   // 실패 처리
  }
}}>
```

| 문                                         | 뜻                          | 문서 (신설 자리)                                                                                                                                                                                                                    |
| ------------------------------------------ | --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Do 호출 (지금 15 opcode + capability)      | 그대로                      | `InteractionAction`                                                                                                                                                                                                                 |
| `if (cond) {…} else {…}`                   | 조건부 · 분기               | `{opcode: "if", when: Condition, then: Action[], else?: Action[]}` — `Condition` = ADR-284 조건 트리 재사용 (새 비교 언어 금지)                                                                                                     |
| `return;`                                  | 이후 Do 중단                | `{opcode: "stop"}`                                                                                                                                                                                                                  |
| `let r = await <endpoint>(…)` · `r.<path>` | 응답을 기다리고 값으로 쓰기 | `callEndpoint` 에 `await: true` · `resultName` · 값 표기 `!result.<name>.<path>`                                                                                                                                                    |
| `try {…} catch {…}`                        | 실패 처리                   | `{opcode: "try", body, catch}`                                                                                                                                                                                                      |
| `await wait(ms)`                           | 지연                        | `{opcode: "wait", ms}` — 고정 도우미                                                                                                                                                                                                |
| 규칙 여러 개                               | 같은 When 의 독립 규칙      | 규칙마다 handler 블록 분리 — `onPress={[ruleA, ruleB]}` 가 아니라 **이름 붙은 handler 함수** `function onSaveClick() {…}` 를 page 함수 안에 두고 `onPress={() => { onSaveClick(); onLogClick(); }}` (E9 해결 — id · 독립 실행 보존) |

규칙: 식은 비교표 · 값 표기 (`!event` · `!item` · `!var` · `!result`) · 리터럴 · 템플릿 글자뿐. 산술 · 함수 호출 · 반복문 · 임의 변수는 거절 (계산은 계산 필드 · 집계로 — ADR-291). 실행기 (`dispatcher.ts`) 는 트리를 해석한다 — 코드를 실행하지 않는다. Interactions 패널은 같은 트리를 「조건」 · 「그 외」 · 「응답으로」 · 「실패하면」 묶음으로 보여 준다 (패널 · 코드 동등 — 원칙 「누가 해도 같은 결과」).

### 2c. 투영 원칙 — 조용한 생략 0

- 문서 필드마다 **emit · read 가 있거나, 「코드에 없음」 목록에 이름과 이유가 있다** (예: Canvas 배치 `placement` · guide · `displayState` — 화면 도구 상태, 레퍼런스 앱에 대응 없음). 목록은 정적 테스트가 문서 타입의 모든 필드와 대조한다 (§5 G1).
- 코드로 표현 못 하는 값 (mesh fill · CSS 로 재현 불가한 효과) 은 생략하지 않고 **읽기 전용 표지** `/* composition: mesh fill — Design 패널 */` 로 내고 anchor 를 둔다 — 지우면 거절, 그대로면 보존.
- 1b 의 「조용히 빠짐」 4 곳 (`TokenUse` · `{kind}` prop · instance 이름 · 대상 없는 Do) 은 Phase 1 에서 먼저 없앤다.

## 3. 편집기 확장

| 기능                          | 내용                                                                                                                                                        |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 파일 트리 · 탭                | §2 트리. 파일 단위 lazy 생성 (열 때 생성) · 파일마다 anchor                                                                                                 |
| 편집 세션 = 프로젝트 baseline | `{projectId, baselineRevision, files: {path → result}}` — page 단위 세션 (ADR-285 Decision 4) 을 프로젝트로. 여러 파일 편집을 Apply 한 번 = history 한 항목 |
| 파일 간 참조                  | 변수 · token · 원본 · endpoint · collection 이름 변경이 다른 파일의 사용처를 따라간다 (문서 rename 명령 — 코드가 아니라 문서가 따라가고 재생성)             |
| 정의로 이동 · 사용처          | 닫힌 어휘 안 이름만 (`<Sidebar>` → `components/Sidebar.tsx`, `saveOrder` → `api/`, `var(--brand)` → `theme.css`)                                            |
| 커서 ↔ Canvas 선택 동기       | anchor 로 양방향 (10-27 후보 C)                                                                                                                             |
| Apply 전 diff                 | 계획된 명령 목록을 사람 말로 (「Text 1 추가 · 배경 색 변경 · 규칙 1 조건 추가」)                                                                            |
| 스니펫 = 패널 동작 전부       | 패널 동작 registry (`codeViewActions.ts`) 를 모든 패널 명령으로 — 「패널에 있는데 스니펫에 없음」 을 정적 테스트가 막는다                                   |
| 자동완성                      | 파일별 어휘 (CSS 파일 = `VisualField` · `LayoutField` 이름 · token · 상태 선택자, `site.config.ts` = 키 목록)                                               |
| 거절 대안 한 번에 적용        | 「이 식은 계산 필드로」 → 계산 필드 스니펫 (10-27 후보 C)                                                                                                   |
| 레퍼런스 통째 붙여넣기        | 예제 `App.tsx` 를 붙이면 어휘 안 부분은 문서로, 밖은 줄 거절 (10-27 후보 A)                                                                                 |

## 4. 대안 (ADR 의 Alternatives 초안)

| 대안                                          | 설명                                                                                     | 위험 (기술 / 성능 / 유지보수 / 마이그레이션)                                                                                                             | 판정      |
| --------------------------------------------- | ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| A. page 파일만 넓히기                         | 지금 한 파일에 스타일 (`style={{}}`) · 메타 · instance 를 더 싣는다                      | M / L / **H** (사이트 · 데이터 · 원본 · 라우팅이 page 에 없어 계속 패널 의존 — 지시 미충족) / L                                                          | 기각 후보 |
| **B. 가상 파일 트리 + 규칙 스키마 확장 (§2)** | 파일 = 문서 영역 · 같은 왕복 규칙 · 규칙 트리에 `if` · `stop` · `try` · `await` · `wait` | M / M (파일별 lazy 생성 · 파서 공유) / M (어휘표 · 필드 대조 게이트가 묶음) / M (규칙 스키마 확장 — 개발 단계, 마이그레이션 코드 0: 새 opcode 는 추가만) | **권고**  |
| C. 스크립트 문자열 저장 + 샌드박스 실행       | handler 본문을 문서에 문자열로, Preview · Publish 가 실행                                | **H** / M / **H** / **H** — 사용자 기각 (10-26 · 10-27)                                                                                                  | 기각      |
| D. 코드 = 정본 (코드에서 문서 재생성)         | —                                                                                        | **H** (id · 스타일 손실) / L / **H** / **H** — ADR-285 대안 C 와 같음                                                                                    | 기각      |

## 5. Gates 초안

| Gate | 통과 조건                                                                                                                                                                                                                                                                                                             |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| G0   | inventory freeze — 문서 타입의 모든 필드 → (파일 · emit · read · 명령) 또는 「코드에 없음」 이유. §1c E1 ~ E15 RED (`it.fails`) · 번들 착수 실측                                                                                                                                                                      |
| G1   | **필드 대조 게이트**: 문서 타입 필드 전부가 표의 한 칸 (조용한 생략 0) · 어휘표 정적 테스트가 이름 존재가 아니라 **각 형태의 golden 조각을 실제로 read** (E2 · E3 같은 「출력만」 RED) · 프로젝트 왕복 불변식 (모든 파일 문서 → 코드 → 명령 0) · golden 6 + 새 golden (사이트 · 원본 · 스타일 · 라우팅 · 제어문 규칙) |
| G2   | 파일마다 차이 → 명령 반례 (추가 · 삭제 · 이동 · 이름 · 값) + 파일 간 Apply 한 번 = history 1 · 하나 거절 = 전체 0 · baseline 반례 (다른 page 편집 · 사이트 패널 변경 뒤 Apply → 0)                                                                                                                                    |
| G3   | 규칙 제어문: 실행기가 트리를 해석 (eval 0 정적 검사) · `await` 의미 일치 (응답 전 다음 Do 안 감 — 실행 순서 기록 단언) · 같은 When 규칙 독립 실행 보존 (E9 반례) · 패널 · 코드가 같은 트리 (단언)                                                                                                                     |
| G4   | 스니펫 = 패널 명령 전부 (registry 대조) · 자동완성 = 어휘 밖 제안 0 · 커서 ↔ Canvas 선택                                                                                                                                                                                                                              |
| G5   | 번들: 파일 생성기 · 역문법 · 편집기 전부 lazy, Builder initial Δ ≤ +1 KB gz · Preview Δ = 규칙 실행기 증분만 (상한 명시)                                                                                                                                                                                              |
| G6   | live (별도 dev 서버): 빈 프로젝트에서 **패널을 열지 않고** 코드만으로 — page 2 + route · collection + 행 · endpoint · 원본 1 + instance 2 · 스타일 (색 · 반응형 · hover) · 사이트 제목 · 규칙 (조건 · await · catch) 을 만들고 Preview 동작 · Undo · 새로고침 유지 · 같은 결과를 패널로 만든 문서와 모양 대조         |

## 6. Phase 초안 (각 phase 끝 = 커밋 가능)

| Phase | 내용                                                                                    |
| ----- | --------------------------------------------------------------------------------------- |
| 0     | inventory · RED · 번들 실측 · 사용자 결정                                               |
| 1     | 지금 page 파일의 결함 수리 (E1 ~ E13 · 조용한 생략 4) + 필드 대조 게이트                |
| 2     | 가상 파일 트리 · 프로젝트 세션 · `App.tsx` (라우팅) · `useParams` · page meta           |
| 3     | 데이터 파일 (`data/` · `api/` · `state/project.ts`) — 정의 편집 (지금 `derivedChanged`) |
| 4     | 스타일 파일 (`*.css` · `theme.css`)                                                     |
| 5     | 컴포넌트 원본 · instance · slot · override · Library 읽기 전용 · 원본 규칙 상속 (E6)    |
| 6     | 규칙 스키마 확장 (§2b) — 문서 · 실행기 · Interactions 패널 · 코드 동시                  |
| 7     | 사이트 파일 · 편집기 기능 (§3) · 등록 안 된 RAC callback (E15)                          |
| 8     | 번들 · 문서 · live (G5 · G6)                                                            |

## 7. 사용자 결정 (ADR 작성 때 묻는다)

| #   | 항목                                                                                                                                                                                                                                       | 권고                                                                                                                                                                                                                                                                      |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | 스타일의 코드 모양 — CSS 파일 + class / `style={{}}` / tailwind                                                                                                                                                                            | **CSS 파일 + class** — 반응형 · 상태 · token 을 다 담는 유일한 모양, fixture (photos · emoji) 와 같음. `style={{}}` 는 `@media` · `:hover` 를 못 담고, tailwind 는 임의 값이 class 이름 문법이 되어 닫힌 어휘가 커진다                                                    |
| 2   | 규칙 제어문 (§2b) — ADR-158 「한 줄 · 조건 없음」 · 281 대안 C 기각을 뒤집는다. 158 은 사용자 재제기 「여전히 너무 복잡한 구조」 (2026-07-20) 로 조건 · 타이밍을 **일부러 뺐다** (`158-interactions-rules-capability-registry.md:19, 115`) | `if` · `else` · `stop` · `await` + 응답 값 · `try/catch` · `wait` 전부 넣는다 (지시 「모든 기능」 · 원칙 「불가 = 결함」). 조건은 보기 조건 트리 재사용. 패널 복잡도가 158 이전으로 돌아가지 않게, 패널의 규칙 행 기본 모양은 그대로 두고 제어문은 접힌 묶음으로만 보인다 |
| 3   | 패널 동등성 — 코드로 만든 제어문을 Interactions 패널도 보여 주고 고치는가                                                                                                                                                                  | 예 (비개발자 경로 유지 · 「누가 해도 같은 결과」). 코드 전용 기능은 두지 않는다                                                                                                                                                                                           |
| 4   | Library 원본 코드                                                                                                                                                                                                                          | 읽기 전용 + 「unlock」 스니펫 (ADR-282 fork 명령) — 고치면 Local 로                                                                                                                                                                                                       |
| 5   | 사이트 설정 파일 모양                                                                                                                                                                                                                      | `index.html` (표준 메타) + `site.config.ts` (검색 · redirect · 접근) 둘                                                                                                                                                                                                   |
| 6   | 숨김 When (hover · focus · keyboard) 을 코드에서 받는가                                                                                                                                                                                    | 받는다 — 숨김은 패널 노출 정책이지 문서 제약이 아니다. keyboard 는 패널에서는 계속 숨김                                                                                                                                                                                   |
| 7   | 프로젝트 변수 모양                                                                                                                                                                                                                         | `state/project.ts` 객체 + `useProjectState()` — page 에서 `let {cart, setCart} = useProjectState()`                                                                                                                                                                       |
| 8   | 코드 내보내기 (zip)                                                                                                                                                                                                                        | 이 ADR 범위 밖 유지 (`project-publish-link-only-defer-until-builder-stable`) — 가상 파일 트리가 그 형태를 미리 맞춘다                                                                                                                                                     |

## 8. 남은 확인 (Phase 0 에서 실측)

- 파일 수 × 생성 비용: 22 page · 17 collection 프로젝트에서 전체 트리 생성 시간 (열 때 생성이면 파일 하나 기준).
- 노드 class 이름 규칙의 충돌 (같은 이름 노드) — anchor identity 와 별개로 class 이름은 표시용 · 결정적 접미사.
- `stateRules` · `responsive` 의 CSS 왕복이 Canvas 해석과 같은 cascade 인지 (`responsive` desktop base → tablet → mobile, `types.ts:826-837`).
- 실행기 증분 (Preview) — 제어문 해석기 크기.

## 9. 재구성 (2026-10-30) — 기능 × 다섯 표면

사용자 원칙 (2026-10-30): 「catalog · Canvas · code · Interactions · Design 은 개별이 아니다」. 기능 하나는 문서 (catalog 스키마) + Canvas + Design/Properties + Interactions + Code 를 한 번에 설계하는 단위다. 이 기준으로 §6 Phase 를 다시 자르면 두 성격으로 갈린다 — **투영 수리** (다른 네 표면은 이미 있고 Code 열만 비었다) 와 **기능 ADR** (다섯 표면이 함께 비었다). 둘 다 한다. 가르는 이유는 ADR 묶음과 순서다.

| 기능                                                                             | catalog | Canvas        | Design/Properties | Interactions                     | Code        | 성격                       |
| -------------------------------------------------------------------------------- | ------- | ------------- | ----------------- | -------------------------------- | ----------- | -------------------------- |
| 요소 · prop · 글자 · 변수 · 보기 · 단순 규칙 · dnd · 계산 필드                   | ✓       | ✓             | ✓                 | ✓                                | ✓           | 완성 (Step 0)              |
| show/hide · submit/reset · 대상 참조 · 같은 When 규칙 N · tree 위치 · token prop | ✓       | ✓             | ✓                 | ✓                                | ✗ 거절·누락 | 투영 수리 (Step 1)         |
| 프로젝트 변수 · useParams · page meta · className/id                             | ✓       | ✓             | ✓                 | ✓                                | ✗           | 투영 수리 (Step 2)         |
| collection · endpoint 정의                                                       | ✓ (286) | ✓             | Data 패널 ✓       | ✓                                | ✗           | 투영 수리 (Step 3)         |
| 라우팅 · 사이트                                                                  | ✓ (286) | —             | Site 패널 ✓       | ✓                                | ✗           | 투영 수리 (Step 4)         |
| 스타일 · theme · token                                                           | ✓       | ✓             | ✓                 | —                                | ✗           | 투영 수리 (Step 5)         |
| 원본 · instance · slot · override · 원본 규칙 상속                               | ✓       | ✓             | ✓                 | ✓                                | ✗ (E6)      | 투영 수리 (Step 6)         |
| **컴포넌트 event / variable property** (원본이 값을 내보내고 · 받는다)           | ✗       | — (시각 없음) | ✗ 종류 3개뿐      | ✗ `emit` Do · instance When 없음 | ✗           | **기능 ADR**               |
| **규칙 제어문** `if` · `await` 응답 · `try/catch` · `wait`                       | ✗       | —             | —                 | ✗                                | ✗           | **기능 ADR** (+ 실행기)    |
| **미등록 RAC callback** `onDragStart` · `onResize` …                             | ✗ spec  | 일부          | —                 | ✗                                | ✗           | **기능 ADR** (등록표 확장) |
| 편집기 UX — 파일 트리 · diff · 커서↔Canvas · 스니펫 = 패널 전부                  | —       | 선택 동기     | —                 | —                                | ✓ 편집기만  | 편집기                     |

### 9a. 시나리오 대조 — 「버튼 → 사용자 컴포넌트 팝오버 → API 목록 검색 → 선택값을 부모 page 로」

emoji-picker 레퍼런스 (수용 fixture) 와 같은 모양. 패널로는 팝오버 · API 목록 · 검색까지 되고, 「선택값 → 부모 page」 만 우회 (instance 가 원본 규칙을 자기 규칙으로 대체 — `DescendantPatchFields.interactions`, 또는 프로젝트 변수) 다. 원인은 컴포넌트 property 종류가 text · boolean · instance 뿐이라 (`types.ts:953`) 원본이 「값이 나간다」 를 선언할 자리가 없는 것 — 그래서 원본 규칙의 Set state 후보에 부모 page 변수가 없고 (`StateActionFields.tsx:73` → `catalogVisibleVariableEntries`, Local page 에서 끝) 원본 규칙은 page 의 DialogTrigger 를 닫지 못한다 (`graph.ts:1927` `TARGET_IN_TEMPLATE`). 이 둘은 event property 가 생기면 고칠 필요가 없다 — 받는 쪽 page 규칙이 변수 쓰기 · 닫기를 한다.

레퍼런스 코드 모양 (목표):

```tsx
// pages/Home.tsx
const [picked, setPicked] = useState<User | null>(null);
<DialogTrigger>
  <Button>Pick user</Button>
  <Popover><UserPicker onSelect={(item) => { setPicked(item); close(); }} /></Popover>
</DialogTrigger>
// components/UserPicker.tsx
export function UserPicker({ onSelect }: { onSelect: (item: User) => void }) { … }
```

다섯 표면: catalog `ComponentProperty.kind: "event"` (+ 입력 쪽 `"variable"` 은 사용자 결정 9) · Canvas 해당 없음 · Properties 패널의 property 종류에 event · Interactions 원본 쪽 Do `emit <property>` (값은 `!item` · `!event` · `!var` 그대로), instance 쪽 When 에 그 property 이름 (인자 하나) · Code 는 위 모양. 새 어휘는 Do 하나 · When 하나.

### 9b. ADR 묶음과 순서

| 순서 | ADR                                            | 내용                                                                                                            | 선행                    |
| ---- | ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ----------------------- |
| 1    | **A. 컴포넌트 event/variable property** (기능) | §9a 다섯 표면. 작고 독립적 · 지금 시나리오를 막는 유일한 것. 실행기는 `emit` → instance 의 규칙 dispatch 하나. **ADR-294 Accepted — Phase 0 ~ 4 구현 · Phase 5 사용자 판단 대기 (2026-10-30)** | —                       |
| 2    | **B. code view 투영 수리 + 가상 파일 트리**    | Step 1 ~ 6 (§6 Phase 1 ~ 5). 스키마 변경 0. A 가 들어가면 `components/*.tsx` 의 props 에 event 가 함께 투영된다 | A (Step 6 만)           |
| 3    | **C. 규칙 제어문** (기능)                      | §2b. 문서 · 실행기 · Interactions · Code 동시. ADR-158 재결정 (사용자 결정 2)                                   | B Step 1 (규칙 분리 E9) |
| 4    | **D. RAC callback 등록 확장 + 편집기 UX**      | E15 (spec 줄 추가 = 패널 · 코드 동시) · §3                                                                      | B                       |

B 가 가장 크므로 Phase (§6) 단위로 커밋한다. A 는 B 와 병렬 가능 — A 의 Code 열은 B 의 Step 6 에서 투영한다.

### 9c. 사용자 결정 추가

| #   | 항목                                                             | 권고                                                                                                                                                                       |
| --- | ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 9   | 컴포넌트 property 에 event 만 넣는가, 입력 쪽 variable 도 넣는가 | 둘 다 — 「부모가 조건을 넘긴다」 (variable) 와 「고른 값을 돌려준다」 (event) 는 같은 경계의 두 방향이고, 한쪽만 있으면 §9a 시나리오의 「조건에 맞게」 가 다시 우회가 된다 |
| 10  | A 를 B 앞에 따로 가는가                                          | 예 — 작고, 패널 기능 누락이라 code view 와 무관하게 먼저 필요하다                                                                                                          |
