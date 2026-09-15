# ADR-202 구현 상세: Builder AI compiler-first 명령 실행

## 1. 전제·관점 lock-in

2026-09-02 사용자 요청으로 새 ADR 초안 작성을 명시 승인했다. 이 문서는
[ADR-134](../completed/134-ai-assistant-llm-infrastructure-unification.md)의 전체 대체가 아니라
그 위에 놓이는 실행 routing 응용 결정이다.

| 질문                   | lock-in                                                                                                                                                                                                           |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| base / 응용 분류       | **ADR-134가 base**다. Provider abstraction, canonical tools, secret isolation, AIPanel/MCP 준비를 제공한다. ADR-202는 그 기반을 소비해 “어떤 요청을 모델 전에 실행할 것인가”를 정하는 응용이다.                   |
| schema 직교성          | 완전 직교가 아니라 ADR-134 D6~~D8의 **specialization**이다. component/tool schema를 새로 정의하지 않고 compiler manifest/IR로 투영한다. D1~~D5·D9~~D11은 유지한다.                                                |
| 선행 전제 reverse 검증 | ADR-196 command surface는 ADR-202의 선행이며 방향을 뒤집지 않는다. ADR-202가 command 실행을 재구현하지 않고 ADR-196 executor를 소비한다. ADR-134의 Agent는 삭제되는 base가 아니라 optional fallback으로 내려간다. |
| 조기 검토              | 이 lock-in과 ADR 본문을 `review-adr`로 먼저 판독한다. Accepted 전 sub-phase/production 구현 진입 금지. “일단 Agent를 튜닝한 뒤 compiler를 붙이는” 우회도 ADR 결정 전에는 하지 않는다.                             |

명시 승인 근거: 사용자가 RAC/RSC Markdown, composition catalog, 합성 컴포넌트 처리 질문을 거쳐
“변경 범위와 대안·트레이드오프를 정리해 새 ADR 초안을 작성”하라고 요청했다. 따라서 fork 자체는
확정하되, Proposed 문서의 선택과 구현 착수는 별도 review/Accepted gate를 유지한다.

방향을 반대로 잡으면 나타나는 사용자 이상: ADR-202가 base가 되어 Provider/tool을 다시 정의하면
같은 `Button` 생성이 compiler와 Agent에서 서로 다른 schema/executor를 사용하고, provider를
바꿀 때 문서 mutation 의미까지 바뀐다. 이 ADR은 그 상태를 금지한다.

## 2. 현재 코드 기준선

2026-09-02 기준선에서 round 1 이슈와 관련된 항목을 2026-09-15 HEAD `dbb2cdb0d`의
코드로 재확인했다. Phase 0에서 전체 route/import/caller와 측정 기준 SHA를 다시 고정한다.

| 영역                                                       | 현재 사실                                                                                                                                                                         | ADR-202에서의 의미                                                                                                     |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `apps/builder/src/builder/panels/ai/hooks/useAgentLoop.ts` | `createAgentRunner(t)`가 있으면 모든 메시지를 먼저 `agent.runAgentLoop()`로 보낸다. fallback은 예외 또는 Agent 부재 뒤에만 돈다.                                                  | direct compiler를 이 hook의 Agent 앞에 배선해야 한다.                                                                  |
| `apps/builder/src/services/ai/AgentService.ts`             | system prompt와 tool definitions를 provider에 보내고 최대 10턴을 돈다.                                                                                                            | direct 요청 지연의 구조적 원인. 기존 loop는 creative fallback으로 보존한다.                                            |
| `apps/builder/src/services/ai/IntentParser.ts`             | Button/Table/Form/Select와 일부 style/layout/color/delete를 규칙으로 인식한다. `extractStyles()`는 빈 객체를 반환한다.                                                            | alias/pattern 자산은 재사용 후보지만 현재 `ComponentIntent`를 최종 실행 계약으로 승격하지 않는다.                      |
| `useAgentLoop.runFallback()`                               | parsed intent를 `addAssistantMessage(..., intent)`로만 기록한다. mutation tool 호출이 없다.                                                                                       | 기존 fallback을 “동작하는 offline 경로”로 간주하면 안 된다.                                                            |
| `apps/builder/src/services/ai/catalog/componentCatalog.ts` | `componentCatalog` + `resolveEditContract`에서 AI catalog를 파생한다. reusable prop은 active origin 없이 지어내지 않는다.                                                         | manifest의 D1/D2/D3 source. prompt 문자열 대신 구조화 데이터를 우선 소비한다.                                          |
| `apps/builder/src/services/ai/tools/definitions.ts`        | `COMPONENT_TAGS`는 이미 `getAiComponentCatalog().filter(placeable)`에서 파생되며 `definitions.test.ts:31`이 parity를 보호한다. runtime JSON Schema와 executor 타입은 분리돼 있다. | 기존 파생/가드는 보존하고 schema·executor·capability join과 IR projection만 추가한다. G1 enum 파생은 부분 충족 상태다. |
| `apps/builder/src/services/ai/tools/index.ts`              | 19개 executor를 name으로 등록한다 (`run_command` lazy adapter 포함). round 1의 20개 표기는 등록 배열 재계수로 정정한다.                                                           | compiler/LLM/Agent 공통 실행 표면.                                                                                     |
| `apps/builder/src/services/ai/tools/createElement.ts`      | `finalProps`는 leaf에만 쓰이고 composite는 early return한다. canonical fields는 composite에도 `applyCanonicalFields`로 이미 적용한다.                                             | prop/style/fill/slot 유실은 G2/G3 RED 대상, canonical fields는 기존 동작 보존 대상이다.                                |
| `apps/builder/src/services/ai/tools/compositeCreation.ts`  | reusable은 origin ref, complex는 `ComponentFactory.createComplexComponent`, leaf는 호출자에게 반환한다.                                                                           | 생성 분류와 built-in 구조의 정본. recipe가 이 자식 트리를 복제하면 안 된다.                                            |
| `apps/builder/src/services/ai/tools/batchDesign.ts`        | 기존 create/update/delete executor를 재사용하나 async 작업 중 history transaction이 열린다는 한계를 주석으로 기록한다.                                                            | multi-op direct의 atomicity를 증거 없이 이 도구에 위임하지 않는다.                                                     |
| `docs/adr/completed/196-agent-command-surface.md`          | command metadata, allowlist, confirm, execution log, human-path parity가 Implemented다.                                                                                           | `run_command`는 새 compiler executor를 만들지 않고 그대로 호출한다.                                                    |

추가 파생·승인·provider 기준선:

- `services/agent/executeAgentCommand.ts:106-125`: `listAgentCommands()`가
  `COMMAND_META` + `DATA_COMMAND_META`의 descriptor를 병합한다. 데이터 실행 adapter는
  `DATA_AGENT_COMMANDS`이며 compiler에 별도 command 표를 만들지 않는다.
- `services/ai/data/dataProposalDispatcher.ts:100-146`: 데이터 쓰기는 schema 검증 →
  `requestAgentCommandConfirmation` → 기존 적용기 → history/log다. `bindCollection.ts`의
  `bind_element`도 이 경로를 사용한다.
- `services/ai/providers/AnthropicProvider.ts:244-245`: `responseSchema`를
  `output_config.format.json_schema`로 보낸다. 현재 OpenAI-compatible/Ollama 어댑터는
  이를 전송하지 않는다 (`providers.test.ts:818`). 따라서 현 어댑터로 one-shot IR을 구현하면
  Ollama는 prompt-only JSON + 사후 validator 경로다. provider 자체 기능 부재라는 뜻은 아니다.
- AI 패널/services/compiler 예정 모듈이 initial graph에 포함되는지와 Ollama prompt-only JSON의
  유효율은 **UNVERIFIED**다. Phase 0에서 production chunk graph와 provider별 동일 corpus의
  parse/schema/semantic 성공률·표본 수를 기록한다. 팔레트 parity 실측도 G2에 남는다.

### Phase 0에서 고정할 prompt 분류

1. **direct** — type/target/action이 closed manifest로 유일하게 결정된다.
   - 생성: `버튼 생성해`, `Select 추가해`, `Card 추가해`
   - 편집: `선택한 버튼을 파란색으로`, `가운데 정렬해`
   - 삭제/command: `선택한 요소 삭제`, `캔버스 확대`
   - 등록 recipe: recipe id/alias가 유일하게 일치하는 합성 요청
2. **ambiguous** — type/target/slot/의미가 하나로 결정되지 않지만 bounded IR로 표현 가능하다.
   - `깔끔한 로그인 영역 만들어`, `카드를 좀 더 강조해`
3. **creative-multistep** — 탐색, 여러 번의 관찰·수정, 열린 목표가 필요하다.
   - `현재 화면을 분석해서 SaaS 대시보드로 다시 디자인해`

direct classifier가 한 분류라도 확정하지 못하면 아래 단계로 내린다. “비슷해 보인다”는 direct
근거가 아니다.

## 3. 목표 계약

### 3-1. 공통 contract registry와 typed IR

operation의 실행 의미는 기존 executor가 계속 소유한다. 신규 contract registry는 다음 네 사실을
한 entry에 결합하고, 기존 LLM tool definition과 compiler validator를 여기서 투영한다.

1. stable opcode/name
2. runtime schema fragment
3. semantic capability check (selection, target, placeable, confirm 등)
4. 기존 executor adapter

개념 형태:

```ts
interface BuilderCommandProgram {
  version: 1;
  source: "compiler" | "llm";
  operations: readonly BuilderCommandOperation[];
}

type BuilderCommandOperation =
  | CreateElementOperation
  | UpdateElementOperation
  | DeleteElementOperation
  | RunCommandOperation
  | RegisteredRecipeOperation;
```

실제 TypeScript union은 contract map의 generic args에서 파생하고 JSON Schema projection도 같은 map을
읽는다. `RegisteredRecipeOperation`은 실행 직전 새 mutation 의미를 갖는 executor가 아니라 검증된
기존 operation program으로 완전히 lower된다. LLM wire 결과도 이 구조 외 임의 필드를 허용하지
않는다.

### 3-2. ComponentKnowledgeManifest

manifest는 prompt 문장이 아니라 구조화 runtime data다.

| 필드                                          | 파생 source                                                                                                                   |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `type`, `kind`, `placeable`, palette category | `componentCatalog` / placeable entry universe                                                                                 |
| RAC primitive와 states                        | primitive binding                                                                                                             |
| semantic/style props, enum/default            | `resolveEditContract`                                                                                                         |
| `creationMode` (`leaf`/`complex`/`reusable`)  | `resolveCompositeMode`, `COMPLEX_COMPONENT_TAGS`, reusable origin registry                                                    |
| slot/child role                               | shared slot role/binding 계약. 없는 정보는 “unknown”이지 추론값이 아님                                                        |
| command id/capability/confirm                 | `listAgentCommands()` 병합 descriptor (`COMMAND_META` + `DATA_COMMAND_META`, 실행은 `AGENT_COMMANDS` + `DATA_AGENT_COMMANDS`) |
| locale alias                                  | 별도 alias table. alias는 identity를 만들지 않고 위 id로만 resolve                                                            |

현재 create enum의 catalog 파생을 재사용하고 contract map으로 schema·executor·capability를
결합한다. 별도 수동 subset을 신설하지 않는다. internal/placeable=false는 direct create에서 거부한다.
command id/args/confirm은 병합 descriptor에서 파생하되, `data.runEndpoint`처럼 인자에 따라 달라지는
confirm은 기존 executor가 최종 판정한다. descriptor의 boolean으로 동적 승인 정책을 대체하지 않는다.

### 3-3. 생성과 합성 recipe

| 종류            | 구조 owner                                 | compiler 동작                               | 사용자 prop/style 적용                             |
| --------------- | ------------------------------------------ | ------------------------------------------- | -------------------------------------------------- |
| leaf            | `getDefaultProps` + canonical element path | `create_element` 1 op                       | root에 적용                                        |
| complex         | `ComponentFactory`                         | type만 넘겨 factory 생성 후 root/slot patch | edit contract가 허용하는 root/slot에 적용          |
| reusable        | Components page origin                     | ref instance 생성 후 instance prop route    | origin schema/instance contract가 허용한 값만 적용 |
| composed recipe | versioned recipe registry                  | recipe를 검증된 기존 op program으로 lower   | recipe의 명시적 prop/slot route만 적용             |

composed recipe는 “로그인 폼”, “검색 툴바” 같은 제품 패턴을 추가할 자리다. 그러나 recipe 안에
Select의 Button/Popover/ListBox 자식 트리를 다시 적는 것은 금지한다. `Select`는 complex owner가
만들고 recipe는 어느 parent/slot에 놓고 어떤 허용 prop을 전달할지만 표현한다.

recipe 등록 조건:

- 모든 referenced type/prop/slot/command가 manifest에 존재한다.
- compile 결과를 mutation 없이 정적으로 검증할 수 있다.
- 같은 input에 같은 program을 반환한다.
- built-in complex/reusable child structure literal이 없다.
- palette/factory 또는 사람이 만든 canonical fixture가 독립 oracle로 있다.

등록 recipe가 없는 자유 조합은 one-shot LLM IR로 내려간다. LLM도 기존 operation만 조합할 수 있고,
semantic validator가 target/slot/prop을 확인한다. 실행 후 결과를 다시 읽어 고치기 위해 반복이
필요하면 그때만 creative Agent route다.

### 3-4. routing과 실행

```text
user message + current BuilderContext
  -> normalize / exact capability match
  -> direct compile 성공?
       yes -> validate whole program -> execute existing tools -> canonical read-back
       no  -> one-shot LLM returns same IR -> validate -> execute/read-back
                 schema/semantic fail -> mutation 0 + 사용자에게 불확실성 표시
                 iterative design 필요 -> explicit creative-multistep Agent route
```

- direct 결과는 Agent streaming/progress를 거치지 않는다.
- one-shot LLM은 tool loop가 아니며 도구를 직접 호출하지 않는다.
- Agent가 필요해도 Agent tool call은 같은 contract registry와 validator를 통과한다.
- `data.*`를 direct로 허용할 때 기존 command executor와 adapter를 소비한다. 데이터 쓰기와
  `bind_element`는 반드시 `dispatchDataProposal`을 경유하고 데이터 적용기를 직접 호출하지 않는다.
  `data.importPaste`의 `confirm=false`는 dispatcher 승인 위임이다. 승인 거부 시 mutation 0,
  성공 시 history/log 1건을 보존하며 compiler가 중복 승인·기록을 추가하지 않는다.
  이 계약을 충족하지 못한 데이터 operation은 direct manifest에서 제외한다.
- canonical read-back은 compiler가 예상한 자기 출력을 다시 비교하는 oracle이 아니다. 결과 존재,
  target identity, requested prop/slot 반영, history/log contract를 확인하며, 구조 parity oracle은
  palette/human path가 제공한다.

### 3-5. host 경계

compiler core는 string/context/manifest를 받아 program 또는 no-match를 반환하는 순수 계층이다.
execution은 `BuilderCommandHost`가 기존 store/tool/command executor에 연결한다. 브라우저에서 app을
서버가 제공하더라도 문서 mutation은 현재 Builder client store에서 실행되므로 direct compiler도
client module이다. 향후 desktop renderer는 같은 core와 manifest를 번들하고 host adapter만 바꾼다.

현재 repo에는 `apps/desktop`과 Electron runtime이 없다. 이 ADR은 desktop 앱을 만든다는 결정이
아니라, browser 전용 API가 compiler core에 들어가지 못하게 하는 계약이다.

### 3-6. client 번들 경계

- Phase 0은 같은 lockfile·build mode·gzip 집계 도구로 production before artifact를 보존한다.
  AI 패널, services, compiler 예정 진입점의 정적 import와 dynamic import 전이 그래프를 기록한다.
- 본 ADR의 제안 예산은 Builder initial 순증 ≤ 3.5 KiB gzip, Preview 순증 0 B다.
  별도로 ADR-219 재승인 절대 상한 Builder ≤ 1,319,829 / Preview ≤ 675,021 B gzip
  (만료 2026-10-14)을 만족해야 한다. baseline이 이미 상한을 넘으면 이를 사전 실패로 기록하고
  before를 새 상한으로 삼지 않는다. 예산·만료 재승인은 별도 사용자 결정이다.
- compiler/manifest/alias/recipe는 AI 기능의 lazy 경계 안에 두는 것을 우선한다. G5에서 실제
  chunk graph와 AI 패널을 열기 전/첫 요청 network를 대조한다. 정적 import나 preload로 initial에
  도달하는 모듈은 initial 집계에 포함한다. 파일명과 `import()` 존재만으로 lazy 판정하지 않는다.
- initial 감소만 보고 통과시키지 않는다. 새/변경된 lazy chunk의 gzip 크기, 공유 chunk 중복,
  첫 AI 요청 다운로드·초기화 비용을 before/after로 함께 기록한다. provider SDK·Markdown index는
  compiler chunk에서 제외하며 기존 provider/tool lazy 경계를 eager로 바꾸지 않는다.
- 상한 초과 시 lazy 분리·중복 제거 후 재측정한다. 축소 불가·상한 만료는 G5 실패로 남기며,
  제안 수치를 실측 PASS나 사용자 재승인으로 표기하지 않는다.

## 4. 변경 범위

파일명은 review에서 조정할 수 있으나 owner/의존 방향은 바꿀 수 없다.

| 범위               | 예상 파일/모듈                                                                              | 변경                                                                                                                      |
| ------------------ | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| compiler core      | `apps/builder/src/services/ai/compiler/` 신규                                               | contract map, IR, manifest projection, normalizer/classifier, validator, recipe resolver, router                          |
| panel routing      | `apps/builder/src/builder/panels/ai/hooks/useAgentLoop.ts`                                  | Agent 호출 전에 direct/one-shot/creative route를 실행하고 동일 conversation/feedback 결과로 투영                          |
| 기존 parser        | `apps/builder/src/services/ai/IntentParser.ts`, 인접 tests                                  | 재사용 가능한 alias/pattern만 compiler로 이동. metadata-only fallback 제거 또는 compatibility adapter로 축소              |
| catalog projection | `apps/builder/src/services/ai/catalog/componentCatalog.ts`                                  | prompt format과 구조 manifest projection을 분리하되 기존 D1/D2/D3 derivation 유지                                         |
| tool contract      | `apps/builder/src/services/ai/tools/definitions.ts`, `tools/index.ts`, AI integration types | schema/name/executor join, IR validator projection. mutation 구현 재작성 금지                                             |
| creation routing   | `tools/createElement.ts`, `tools/compositeCreation.ts`                                      | complex/reusable prop/style/fill/slot 유실 수리, 기존 canonical field 적용 보존과 read-back 검증                          |
| fallback           | `AgentService.ts`, `createAgentRunner.ts`, `systemPrompt.ts`, provider adapter              | direct에는 미로딩. one-shot IR과 creative Agent를 명확히 분리                                                             |
| command safety     | ADR-196/213 command modules, `dataProposalDispatcher.ts`                                    | 병합 descriptor 소비 추가만. `COMMAND_META`/`DATA_COMMAND_META`, 동적 confirm, dispatcher 승인/history/log 의미 변경 금지 |
| tests/evidence     | 각 모듈 인접 Vitest, AI panel integration, browser live evidence                            | direct 0-call, schema mutation, palette/human parity, offline, rollback                                                   |
| 문서               | ADR-134/202, README, CHANGELOG, AI 운영 문서                                                | Accepted/cutover 시 부분 대체와 사용자-가시 변경 기록                                                                     |

### 명시적 비범위

- Ollama/WebLLM/원격 provider의 채택·제거·모델 선택·reasoning tuning
- Adobe Markdown 전체 ingest, vector DB, RAG, 자동 문서 업데이트 서비스
- `apps/desktop`/Electron 앱, ACP/외부 coding agent embed
- component catalog/spec/RAC binding/Canvas/Skia/Preview renderer 의미 변경
- `CompositionDocument` schema와 DB migration
- recipe가 필요하다는 이유만으로 신규 UI component를 만드는 작업
- 현재 공용 작업인 ADR-923과 Canvas readiness 파일

## 5. 단계별 구현 계획

| Phase | 목적                          | 주요 작업                                                                                                                                                                             | 종료 조건 / Gate                                                           |
| ----- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| 0     | 기준선 freeze                 | route/import/caller·기존 enum 가드·병합 descriptor 재freeze, prompt/provider 기준선과 initial/lazy 그래프, palette/human oracle, composite prop/style/fill/slot RED 및 canonical 보존 | G0. production behavior 변경 0                                             |
| 1     | contract/manifest             | 기존 catalog enum 파생/가드 유지, contract map의 schema·executor·capability join, versioned IR/validator, 병합 command descriptor manifest와 sensitivity tests                        | G1. router 미배선                                                          |
| 2     | deterministic compiler/recipe | alias normalization, exact capability classifier, leaf/complex/reusable/registered recipe compile, shadow result 비교                                                                 | G2. shadow에서 mutation 0 후 결과만 비교하고 통과 뒤 direct execute enable |
| 3     | common executor/read-back     | 기존 tool/ADR-196·213 adapter/dispatcher 승인, composite prop/style/fill/slot 수리·canonical 보존, whole-program preflight와 atomicity/history/confirm/log                            | G3                                                                         |
| 4     | fallback routing              | one-shot LLM IR adapter, semantic rejection, creative Agent fallback, AIPanel 상태/피드백 분리                                                                                        | G4                                                                         |
| 5     | host/offline/rollout          | browser live/offline, host-neutral suite, initial 순증·절대 상한/만료·lazy 전이 그래프/첫 요청 비용, rollback route                                                                   | G5                                                                         |
| 6     | cutover/documentation         | dead fallback 정리·수동 enum 재도입 0 확인 (기존 catalog 파생 유지), ADR-134 부분 대체 표시, CHANGELOG/운영 문서/evidence, full gates                                                 | G6 후 Implemented 후보                                                     |

Phase 실행 중 추정 범위가 1.5배 이상 늘거나 한 Phase를 3개 이상 sub-group으로 나눠야 하면 이
breakdown에 조용히 흡수하지 않는다. `adr-writing.md` M4에 따라 사용자 확인 또는 design 재freeze가
선행한다. 단, review 승인으로 전제 확정 종결 계약이 성립한 뒤 단순 파일 수 증가만 생긴 경우에는
방향 변경이 아닌지 먼저 판정하고 사후 기록한다.

## 6. 검증 매트릭스

### 6-1. routing/실행 corpus

| 입력/상태                         | 기대 route         | 기대 결과                               | 독립 oracle                           |
| --------------------------------- | ------------------ | --------------------------------------- | ------------------------------------- |
| `버튼 생성해` / body 선택         | direct             | Button 생성, provider 0                 | 팔레트 Button 생성 canonical snapshot |
| `확인 버튼 생성해`                | direct             | Button text/children route              | Inspector/human create+edit 결과      |
| `Select 추가해`                   | direct complex     | factory 자식 구조 + 요청 prop 보존      | 팔레트 Select canonical tree          |
| `Card 추가해`                     | direct reusable    | origin ref instance + instance contract | 팔레트 Card ref                       |
| 등록된 `확인 버튼 생성해` recipe  | direct recipe      | Button 1 op + children override         | 팔레트 Button + Inspector text 편집   |
| 미등록 `로그인 폼 만들어`         | fallback           | multi-op 원자성 미보장으로 direct 제외  | G3 실패 시 대안                       |
| 미등록 `여행 예약 위젯 만들어`    | ambiguous/creative | direct mutation 0, one-shot 또는 Agent  | route expectation corpus              |
| 선택한 요소를 파란색으로          | direct update      | 선택 identity 유지, fill 반영           | Inspector human edit 결과             |
| 선택 없는 `왼쪽 정렬해`           | no-match/fallback  | mutation 0                              | ADR-196 precondition                  |
| `캔버스를 확대해`                 | direct command     | `run_command.zoomIn`, provider 0        | keyboard/command palette 결과         |
| `선택한 요소 삭제`                | direct destructive | ADR-196/기존 delete 승인·history 정책   | human delete/undo 결과                |
| 미등록 type/prop/slot을 포함한 IR | reject             | canonical diff 0                        | before/after store snapshot           |
| schema version 불일치/추가 속성   | reject             | executor 호출 0                         | executor spy                          |
| provider 없음/네트워크 offline    | direct corpus      | 전부 동일 결과                          | online direct snapshot                |

### 6-2. 생성 parity 축

각 creation mode에서 최소 다음 축을 직교 fixture로 둔다.

- 기본 생성
- semantic prop 1개
- style prop 1개
- fill 1개
- canonical field 1개 — 이미 composite에 적용되는 동작의 보존 검사이며 유실 RED 대상이 아님
- parent override
- 실존 slot route와 잘못된 slot negative
- undo 1회/redo 1회
- 동일 요청 반복 시 id 외 normalized tree가 동일

complex/reusable은 현재 early return의 영향을 받으므로 “성공 응답”이 아니라 canonical root/ref와
필요한 child/slot을 직접 읽는다. 합성 child 수만 맞는 것은 parity 통과가 아니다.

### 6-3. schema/SSOT sensitivity

- catalog placeable type 1개 추가 시 manifest/create enum이 자동 증가한다.
- placeable=false 또는 internal type을 direct create로 바꾸면 negative test가 RED다.
- edit contract enum 1개 제거 시 해당 IR validator가 RED다.
- `COMMAND_META.agentCallable`을 false로 바꾸면 병합 descriptor와 direct command schema에서 사라진다.
- `DATA_COMMAND_META`의 args/confirm을 바꾸면 병합 descriptor와 compiler capability/schema projection에
  반영된다. 동적 confirm 함수는 descriptor에서 true로 노출되고 실행 시 실제 인자로 판정된다.
  이를 무조건 승인 생략으로 바꾸거나 stale projection을 고정하면 sensitivity test가 RED다.
- `data.runEndpoint` 승인 필요/불필요 인자와 `data.importPaste` 위임 승인, `bind_element` 거부를
  각각 확인한다. 데이터 쓰기의 dispatcher 우회·거부 후 mutation·중복 기록은 RED다.
- complex/reusable 분류를 바꾸면 recipe가 아니라 factory/origin parity test가 RED다.
- schema와 executor name 중 하나만 바꾸면 join gate가 RED다.

### 6-4. focused 검증 후보

- compiler core 인접 Vitest
- `IntentParser` 기존 tests의 compatibility/삭제 판정
- `componentCatalog.test.ts`
- `canonicalVocabulary.test.ts`
- `compositeCreation.test.ts`
- `mutationVerification.test.ts`
- `runCommand.test.ts`
- `useAgentLoop` integration test
- Builder type-check, `codex:guard`, `codex:preflight`
- 사용자 flow가 바뀌므로 browser live exercise 필수

렌더링 의미는 바꾸지 않으므로 이 ADR 자체의 docs-only 단계에는 `cross-check`가 필요하지 않다.
구현 중 prop/slot routing이 Skia/Preview 결과를 바꾸면 해당 Phase에서 `cross-check`를 추가한다.

### 6-5. 번들 검증 매트릭스 (G0·G5)

| 축                | before/after 근거                                    | 통과 조건                                                                                                        |
| ----------------- | ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Builder initial   | 동일 build/gzip 도구의 initial 전이 chunk 합계와 SHA | 순증 ≤ 3.5 KiB gzip 및 절대 ≤ 1,319,829 B                                                                        |
| Preview initial   | 동일 조건의 Preview initial 합계                     | 순증 0 B 및 절대 ≤ 675,021 B                                                                                     |
| initial/lazy 판정 | production graph + AI 패널 열기 전/첫 요청 network   | compiler/manifest/alias/recipe 및 전이 의존성 분류, eager/preload는 initial에 포함, provider/tool lazy 경계 보존 |
| lazy 비용         | chunk별 gzip·공유 중복·첫 AI 요청 로드/초기화 A/B    | 누락 0, 초기 크기 감소를 총비용 감소로 오인하지 않음                                                             |
| 예산 유효성       | ADR-219 재승인 근거·측정일                           | 2026-10-14 만료 준수, 만료/초과 시 자동 재기준선 금지                                                            |

## 7. 측정 무결성

`measurement-validity.md`의 5질문을 G0 시작 전에 다음처럼 고정한다.

| 질문              | 본 ADR의 답                                                                                                                                                           | 실패 방지                                                               |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Q1 측정 대상 출처 | direct/ambiguous 핵심 문구는 실제 사용자 발화(`버튼 생성해`)와 세션에서 제기된 합성 질문을 seed로 한 사람이 검토한 corpus다. 대량 변형 합성 문장은 coverage 전용이다. | 합성 alias 정확도를 실제 사용자 분포로 주장하지 않는다.                 |
| Q2 불리한 경우    | alias 충돌, 부정문, 선택 없음, internal type, stale recipe/schema, malformed LLM IR, provider cold/offline, large document를 포함한다.                                | 쉬운 Button 1건만으로 routing 정확도/지연 통과 금지.                    |
| Q3 대조군         | routing 비용은 현 agent-first와 compiler-first를 같은 device/doc/provider 조건에서 A/B하고, mutation 결과는 palette/human command path와 대조한다.                    | compiler expected snapshot을 compiler 결과와 비교하는 순환 oracle 금지. |
| Q4 소비 경로      | 실제 `useAgentLoop` 제출 → router → validator → executor → canonical read-back까지 계측한다. isolated parser pass는 배선 증거가 아니다.                               | import/caller/host 배선 3-grep과 browser live 필수.                     |
| Q5 oracle 독립성  | 생성은 palette/factory, command는 keyboard/palette handler, mutation 안전은 canonical before/after와 history/log를 쓴다.                                              | 같은 adapter를 양쪽 arm에서 직접 호출한 diff 0을 parity로 쓰지 않는다.  |

기록 조건:

- commit/HEAD, browser, OS/device, DPR, `visibilityState`
- 문서 id가 아닌 문서 규모와 선택 상태
- provider/model/endpoint, warm/cold, context 옵션 (fallback 측정에만)
- direct/ambiguous/creative별 provider calls, agent turns, tool executions, network requests
- compile/validate/dispatch와 canonical mutation 시간을 분리
- p50/p95 sample 수와 raw evidence 경로
- build mode·lockfile·gzip 도구, before/after SHA와 initial/lazy chunk graph·크기·첫 AI 로드 비용
- provider별 responseSchema 전송 여부와 prompt-only JSON parse/schema/semantic 유효율 (표본 수 포함)

Hard Constraint의 핵심 판정은 시간 단축률이 아니라 direct의 **provider/network/agent count = 0**과
canonical parity이며, client 배포 비용은 HC12/G5 번들 예산으로 별도 판정한다. 호출 수와
parity는 모델·기기 성능에 독립적이다. 지연 수치는 UX 회귀 감시용으로 기록하되
측정 조건이 다른 숫자를 서로 비교하지 않는다.

자기 감사:

- recipe fixture를 우리가 만들고 같은 recipe로 expected를 만들지 않는다.
- 기존 Agent가 tool call을 반환했다는 사실을 “정답”으로 쓰지 않는다.
- schema-valid를 semantic-valid로 간주하지 않는다.
- offline direct PASS를 provider mock이 우연히 응답한 상태에서 측정하지 않는다.

## 8. 롤백과 후속 범위

### 롤백

- canonical schema 변경이 없으므로 저장 문서 migration rollback은 없다.
- cutover 기간에는 router entry에서 compiler direct enable만 끄면 기존 `createAgentRunner` 경로로
  복귀할 수 있게 한다.
- compiler가 이미 실행한 정상 canonical mutation은 일반 history로 사용자가 되돌린다. 잘못된
  mutation을 숨기기 위한 자동 문서 rewrite/캐시 reset은 금지한다.
- one-shot LLM 또는 creative Agent 장애는 direct route를 비활성화하는 근거가 아니다. route별로
  독립 rollback한다.
- schema/manifest version mismatch는 Agent로 조용히 내리지 않고 사용자에게 실행 불가를 알린다.

### 별도 ADR 또는 후속 product 결정

- 실제 Electron/desktop 앱과 external agent embed
- 조직적으로 관리할 composed recipe library의 배포·권한·버전 marketplace
- Adobe Markdown 자동 ingest/RAG와 license/update 정책
- visual understanding/vision model 기반 화면 분석
- async multi-op canonical transaction의 범용 인프라
- compiler IR을 외부 MCP/public API로 공개하는 계약

## 9. 완료 체크리스트

### Proposed 초안

- [x] ADR-134/196과의 base·응용·선행 방향 lock-in
- [x] D1/D2/D3 경계와 Generator 비범위 명시
- [x] 최소 3개 이상 대안과 4축 위험·threshold 판정
- [x] direct/ambiguous/creative route와 합성 4분류 결정
- [x] 현재 코드 경로와 composite prop loss 경계 기록
- [x] 측정 Q1~Q5, 독립 oracle, 불리한 경우 기록
- [x] 변경 파일 owner와 비범위, rollback 경계 기록
- [x] `review-adr` round 1 판독 및 이슈 1~5 문서 반영 (2026-09-15, [수리 검증](../reviews/202.md))
- [ ] 사용자/리뷰 합의 후 Accepted 승격

### 구현

- [x] Phase 0 기준선과 RED evidence (모델 시간·token 미측정, G0 대안 적용)
- [x] G1 contract/manifest
- [x] G2 deterministic compiler/recipe (single-op recipe)
- [x] G3 common executor/composite routing (multi-op 제외)
- [ ] G4 one-shot/creative fallback — adapter/회귀 검사 PASS, 실제 모델 품질 평가 대기
- [x] G5 browser/offline/host-neutral live (offline은 패널 로드 이후)
- [x] G6 cutover/docs/scoped preflight (main 반영 별도)
- [x] ADR-134 D6~D8 부분 대체 링크와 CHANGELOG
- [ ] Implemented 승격용 Live Exercise/evidence

## 9. 착수 실행 기록 — 2026-09-16

### 적용 범위와 보류 경계

- **core**: `services/ai/compiler/{contracts,manifest,commandArgs,compile,recipes}`는 host-neutral이다.
  catalog type/creationMode·`resolveEditContract`·병합 command descriptor는 `builderHost`에서 공급한다.
  Styles의 width/padding/CSS 단위는 기존 `STYLE_GROUP_PROPS`에서 보완한다. 배경 색은 `styles`가
  아니라 canonical `fills` 입력만 허용해 무시된 backgroundColor의 거짓 성공을 막는다.
  schema는 4개 element/command operation을 닫고, 나머지 15개 기존 도구는 전용 계약을 유지한다.
  새 provider SDK, Adobe 문서 index, desktop host는 추가하지 않았다.
- **direct**: exact type/alias 생성, `확인 버튼` recipe, 선택 삭제, 색상 fill, `set <field> to <value>`,
  alias/id가 유일한 기존 command. 부정문·충돌·미등록·지원하지 않는 field kind는 추측하지 않는다.
  canonical slot은 등록 origin id 선언만 허용하며, 신규 child/slot 역할을 추론하지 않는다.
- **one-shot**: Anthropic adapter에 schema를 보낸다. 빈 operations는 실행 불가 응답이며 mutation 0.
  최대 1 op·1 provider call이다. model source/version·target·field 검증 후 동일 registry를 쓴다.
  모델이 모호한 요청으로 delete/run_command를 추론하는 것은 거부한다.
  Ollama/OpenAI-compatible은 G4 예외로 기존 Agent fallback이며 prompt-only 유효율은 미검증이다.
- **atomicity**: multi-op direct/one-shot은 실행 전에 거부한다. 따라서 로그인 폼 같은 multi-op
  recipe는 미등록이다. 기존 creative batch의 async transaction을 atomic하다고 주장하지 않는다.
  initial props와 canonical 필드를 최초 insert에 넣어 생성 1건의 undo/redo를 보존한다.
- **rollback**: `sessionStorage.setItem("composition.ai.compiler.disabled", "true")` 후 다음 제출은
  기존 Agent/metadata fallback을 쓴다. 키를 지우면 compiler-first로 돌아온다. 문서 migration은 없다.
  `getCompilerMetrics()`는 현재 세션 최근 30건의 route/providerCalls/toolExecutions/errorCode만 반환한다.
- **모델 평가**: 사용할 endpoint/모델에 대한 사용자 답변은 아직 없고 localhost:11434도 미기동이다.
  실제 모델 latency/token/JSON·semantic 성공률은 비워 둔다. 대역 스트림 테스트를 실물 품질로 환산하지 않는다.

### gate 근거

| Gate | 현재 근거                                                                                                                                                           | 검증 경계                                                                |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| G0   | 현행 미설정 모델 입력 mutation 0, route/import/code freeze, Select/Card 초기값 RED, 동일 HEAD production before 보존                                                | 모델 추론 시간·token 비교 없음                                           |
| G1   | runtime strict schema/version, unknown field/type/command/version/source negative, catalog enum parity, registry/schema 이름 join, enum/args/field-kind sensitivity | 지원하지 않는 schema keyword는 fail-closed                               |
| G2   | shadow mutation 0 후 UI direct 실행. Button/Select/Card 팔레트 normalized subtree 3/3 동일. exact/negative/recipe compiler tests                                    | multi-op recipe 미등록                                                   |
| G3   | 초기 props/style/fill/slot 보존; Button/Select/Card/frame undo/redo 1건; frame clip/placeholder redo 보존; 명령·데이터 adapter 승인/history/dispatcher 인접 suite   | 기존 async creative batch의 원자성 보장은 추가하지 않음                  |
| G4   | direct는 provider 조회/Agent 생성 0, 대역 one-shot 최대 1회; malformed/truncated/tool-call/context/source/empty rejected; 취소 UI; 기존 Agent hook tests            | 실제 모델 응답 품질 미검증, OpenAI-compatible 기존 fallback              |
| G5   | Node suite DOM/Electron/provider mock 0; dev 및 production 실제 offline 생성/편집; fresh hydration 보존; 아래 bundle gate                                           | AI 패널 로드가 끝난 뒤 offline. 완전 offline cold app 부팅을 뜻하지 않음 |
| G6   | ADR-134 부분 대체, README/CHANGELOG, session rollback/계측, scoped checks와 로컬 evidence                                                                           | main 반영·Implemented 승격은 미수행                                      |

### production A/B와 lazy 비용

동일 `278378d40`, lockfile, Vite production mode, Node 24.15.0 / pnpm 10.26.2.
Before/after는 같은 HEAD의 별도 detached worktree에 고정했다. After에 요청 범위 source만
복사했으며 의존성·WASM 생성물은 양쪽에서 같은 기존 경로에 연결했다. 동시 Properties 커밋으로
측정 중 HEAD가 이동해 이 방식으로 A/B를 다시 고정했다.
초기 파일 graph의 per-file gzip(level 9) 합계이며 runtime memory나 전송 압축 합계가 아니다.

| surface                 |      before |       after |      순증 |   절대 상한 |
| ----------------------- | ----------: | ----------: | --------: | ----------: |
| Builder initial JS gzip | 1,322,682 B | 1,307,405 B | −15,277 B | 1,319,829 B |
| Preview initial JS gzip |   675,443 B |   669,820 B |  −5,623 B |   675,021 B |

- 재승인 만료 2026-10-14. before의 기존 상한 초과를 근거로 상한을 올리지 않았다.
- AI implementation과 runCommand는 initial에 없고 동적 entry로 남는다.
  첫 AI 패널 열림 전이 의존성의 추가 비용은 **136,606 B raw / 44,852 B gzip** (9개 JS).
  production 로컬 1회 패널 first-open 관찰 **800 ms**는 장치/브라우저 한 표본이며 속도 SLA가 아니다.
  이후 offline 직접 제출에서 네트워크 0을 별도로 확인했다.
- compiler/manifest는 AI chunk graph에 포함된다. provider adapter 코드와 UI 도구는 AI 첫 열림에서
  준비되지만 direct 요청이 provider를 resolve/호출하지는 않는다. 순수 compiler core에는 provider import가 없다.
- `adr202-bundle-gate.mjs`는 closure JSON 4개와 production manifest를 입력받아
  순증·절대 상한·만료·AI/command lazy 경계를 검사한다. 빌드 없이 고정 filename만 검사하지 않는다.

재현 순서 (before/after는 각 source snapshot에서 동일 명령):

```sh
pnpm --filter @composition/builder exec vite build --outDir /private/tmp/adr202-frozen-after-dist --manifest
node apps/builder/scripts/adr209-bundle-closure.mjs --repo . --dist /private/tmp/adr202-frozen-after-dist --entry index.html --label builder --out /private/tmp/adr202-frozen-after-builder.json
node apps/builder/scripts/adr209-bundle-closure.mjs --repo . --dist /private/tmp/adr202-frozen-after-dist --entry preview.html --label preview --out /private/tmp/adr202-frozen-after-preview.json
node apps/builder/scripts/adr202-bundle-gate.mjs --before-builder /private/tmp/adr202-frozen-before-builder.json --before-preview /private/tmp/adr202-frozen-before-preview.json --after-builder /private/tmp/adr202-frozen-after-builder.json --after-preview /private/tmp/adr202-frozen-after-preview.json --manifest /private/tmp/adr202-frozen-after-dist/.vite/manifest.json --out /private/tmp/adr202-bundle-frozen-gate.json
```

검증용 프로젝트와 상세 로그는 [실행 evidence](../evidence/202-execution-live.md)에 묶었다.

### 시각 검증에서 추가로 수리한 fill 경계

기존 AI 도구의 `props.fills` 저장은 현재 렌더러의 canonical `fills` 입력이 아니었다.
초기 props read-back만으로는 색이 바뀌지 않은 성공을 놓쳤다. 생성은 최초 insert의 canonical
`fills`, 수정은 기존 `updateElement`의 full-node history 경로를 사용하도록 수리했다.
기본 fill 값은 `createDefaultFill`로 채우며, 빈 배열은 제거로 처리한다. root canonical fills의
보존·제거·undo/redo를 테스트하고 Preview computed style로 색상 적용을 재확인했다.

### 검증 결과와 남은 경계

전체 관련 Vitest **554 PASS / 2 skipped** 후 alias 충돌 회귀를 추가해 compiler **35 PASS**. typecheck **baseline 0 / 신규 오류 0**.
전체 dirty 포맷을 피하려고 `.agents/README.md`의 명시 경로 format·guard·typecheck·관련
unit 검사를 사용한다. 모델 실측과 main 반영 전에는 Implemented로 승격하지 않는다.

production Compare의 iframe URL은 기존 코드에서 `/preview.html`로 고정되어 `/composition/`
배포 경로를 누락한다. 렌더 소비 검사는 검증용 iframe을 `/composition/preview.html`로 열어
수행했다. 기존 상대 font 경로 경고도 남으므로 production Compare 전체 UX PASS를 주장하지 않는다.
수정한 Button의 Preview `backgroundColor=rgb(0, 0, 255)`, `opacity=0.42`, canonical fills,
undo/redo 및 refresh hydration은 별도로 확인했다. Canvas/Preview 전체 픽셀 parity는 미측정이다.
