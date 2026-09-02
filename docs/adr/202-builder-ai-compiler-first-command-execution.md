# ADR-202: Builder AI compiler-first 명령 실행

## Status

Proposed — 2026-09-02

> 사용자 요청: 2026-09-02 — Adobe가 제공하는 RAC/RSC Markdown과 composition의 기존
> catalog/factory/tool 계약을 이용하면 단순 생성까지 Agent가 필요하지 않다는 문제 제기 후,
> 변경 범위와 대안·트레이드오프를 정리한 새 ADR 초안 작성을 명시 승인했다. 이 ADR은
> [ADR-134](completed/134-ai-assistant-llm-infrastructure-unification.md)의 Provider·도구 인프라를
> 폐기하지 않고 D6~D8의 기본 실행 순서만 부분 개정하는 응용 ADR이다. 4질문 lock-in은
> [breakdown §1](design/202-builder-ai-compiler-first-command-execution-breakdown.md)에 기록한다.

## Context

현재 Builder AI Assistant는 로컬 Ollama의 OpenAI-compatible endpoint
(`http://localhost:11434/v1`)를 사용할 수 있지만, `버튼 생성해` 같은 명시적 요청도
`useAgentLoop`가 먼저 `createAgentRunner()`로 보낸다. `AgentService`는 system prompt,
컴포넌트 catalog, tool schema를 모델에 전달하고 최대 10턴의 tool loop를 허용한다.
따라서 단순 요청의 지연은 실제 문서 변경 비용보다 provider 기동·prompt 처리·tool-call 생성에
지배될 수 있다. 정확한 시간·token 기준선은 G0에서 같은 조건으로 다시 측정하며, 이 문서는
관찰되지 않은 절대 지연 수치를 인용하지 않는다.

provider 실패 시 사용하는 `IntentParser`는 Button/Table/Form/Select와 일부 편집 intent를
인식하지만, `useAgentLoop.runFallback()`은 그 결과를 대화 metadata에만 붙이고 canonical
mutation tool을 실행하지 않는다. 즉 현 구조는 **Agent가 있으면 단순 요청도 Agent-first**,
Agent가 없으면 **인식은 해도 실행하지 않는 fallback**이다.

반면 실행에 필요한 대부분의 결정적 기반은 이미 존재한다.

- AI component catalog는 `componentCatalog`와 `resolveEditContract`에서 파생되어 type,
  placeable 여부, RAC primitive, 편집 가능한 props를 알고 있다.
- `create_element`는 leaf 생성 외에 reusable origin ref와
  `ComponentFactory.createComplexComponent()`를 사용해 팔레트와 같은 합성 생성 분기를 탄다.
- [ADR-196](completed/196-agent-command-surface.md)은 command metadata, allowlist, 승인,
  history, 실행 기록이 결합된 안전한 명령 표면을 제공한다.
- `create_element`/`update_element`/`delete_element`와 canonical read-back 도구가 이미 있다.

다만 이 기반은 아직 compiler 계약으로 닫혀 있지 않다. `toolDefinitions`의 생성 가능 type
enum은 수동 목록이고, executor 인자는 `Record<string, unknown>`이며, JSON Schema와 실행 타입이
분리돼 있다. 합성 생성에서는 leaf 경로용으로 계산한 `finalProps`가 reusable/complex 분기에는
적용되지 않아 요청한 props/styles/slot routing이 사라질 수 있다. Adobe Markdown은 RAC의
composition과 API를 설명하지만 composition 고유의 canonical id, reusable origin, history,
command 승인, Skia/Preview 정합까지 정의하지는 않는다.

외부 기준은 다음처럼 사용한다.

- [React Aria Getting Started](https://react-spectrum.adobe.com/react-aria/getting-started.html)는
  Select 같은 복합 UI를 여러 RAC primitive의 composition으로 설명한다. 이는 합성 recipe의
  접근성 구조 근거이지 composition 문서 mutation 절차의 대체물이 아니다.
- [JSON Schema specification](https://json-schema.org/specification)의 구조화 검증 계약을
  `BuilderCommandIR` wire format에 적용한다.
- [MCP tools specification](https://modelcontextprotocol.io/specification/2025-06-18/server/tools)의
  `inputSchema`/`outputSchema` 모델과 정렬해 기존 ADR-134 D11 tool schema를 재사용한다.

**SSOT 3-domain 위치**:

- **D1 DOM/접근성**: RAC component와 기존 binding이 계속 권위다. compiler/recipe가 DOM을
  직접 만들거나 RAC 구조를 재정의하지 않는다.
- **D2 Props/API**: `resolveEditContract`, binding, tool/command schema가 허용 prop·값·slot의
  권위다. typed IR은 이 계약을 참조하는 runtime 표현일 뿐 새 Props SSOT가 아니다.
- **D3 시각 스타일**: `COMPONENT_RULES_TABLE`과 token/spec 파생 경로가 계속 권위다.
  compiler는 catalog/spec을 편집하지 않고 허용된 props/styles/fills만 canonical mutation에
  전달한다.

따라서 본 변경은 D1~D3를 교차해 새 정본을 만드는 작업이 아니라, **자연어를 기존 정본과
executor에 연결하는 runtime routing/validation 계층**이다. Spec/Generator 확장과 신규 시각
채널은 없다.

**Hard Constraints**:

1. **명시적 direct 요청은 provider 0회** — 등록된 생성·편집·삭제·command·recipe 요청은
   `providerCalls = 0`, `agentTurns = 0`, AI 목적의 network request 0이어야 한다. provider 설정,
   모델 cold start, 인터넷 연결 여부가 direct 결과와 지연에 영향을 주면 실패다.
2. **closed typed IR** — 모든 mutation은 versioned `BuilderCommandProgram`의 tagged union과
   JSON Schema-compatible validator를 통과한다. 미등록 operation/type/prop/slot/command,
   추가 속성, schema version은 첫 mutation 전에 fail-closed한다.
3. **파생 manifest** — component type/kind/placeable/편집 계약/creation mode와 agent-callable
   command는 기존 catalog·entry universe·factory·ADR-196 registry에서 파생한다. 같은 사실의
   수동 enum/표를 두 번째 정본으로 추가하지 않는다.
4. **생성 4분류 완결** — leaf, complex factory, reusable origin ref, 등록된 composed recipe를
   모두 표현한다. recipe는 기존 component/prop/slot id만 참조하고 built-in complex/reusable의
   자식 트리를 복제하지 않는다. 미등록 자유 조합은 지어내지 않고 fallback으로 보낸다.
5. **단일 실행 표면** — compiler, one-shot LLM, optional Agent가 만든 IR은 모두 같은 validator와
   기존 tool/ADR-196 executor를 통과한다. 모델이 store/factory를 직접 호출하는 우회 경로는 0이다.
6. **팔레트 결과 정합** — 같은 type을 같은 parent에 생성했을 때 leaf/complex/reusable의
   normalized canonical tree가 팔레트 생성 결과와 일치해야 한다. 합성 루트의 요청 props,
   styles, fills, canonical fields와 slot routing도 손실 없이 적용된다.
7. **fallback 상한** — direct compile이 실패한 모호한 요청은 LLM 1회가 IR만 생성할 수 있다.
   schema/semantic 검증 실패는 mutation 0으로 종료한다. 반복 탐색이 필요한 창의적 다단계 작업만
   명시적인 `creative-multistep` route에서 bounded Agent를 사용한다.
8. **mutation 안전성** — 실행 전 전체 program을 검증하고 기존 canonical/history/confirm/log
   계약을 보존한다. 부분 성공을 원자적으로 되돌릴 수 없는 다단계 program은 direct route에서
   실행하지 않는다. destructive command는 ADR-196 승인을 우회할 수 없다.
9. **host 중립·offline direct** — compiler/manifest/validator에는 DOM, Electron, provider API
   의존이 없다. 웹 Builder와 향후 desktop renderer가 같은 module과 contract suite를 사용한다.
   현재 존재하지 않는 `apps/desktop`을 이 ADR에서 신설하지 않으며, desktop enable 전 같은
   suite 통과를 의무화한다.
10. **문서 하위 호환** — IR과 routing은 runtime-only다. `CompositionDocument` schema 변경,
    기존 프로젝트 재직렬화, migration은 0이다.
11. **Markdown 비필수** — Adobe RAC/RSC Markdown은 build-time audit/reference 입력일 수 있지만
    direct runtime prompt, RAG, 네트워크 조회의 필수 의존이 아니다. Markdown 부재·버전 차이에도
    manifest와 direct execution은 repo SSOT만으로 동작한다.

**Soft Constraints**:

- 한국어/영어 alias와 명령형 변형을 지원하되, 낮은 confidence를 억지로 direct 처리하지 않는다.
- 신규 runtime dependency는 가능하면 0으로 유지하고 기존 JSON/tool schema를 재사용한다.
- AIPanel의 대화·진행·시각 피드백은 유지하되 direct 결과는 Agent 진행 UI로 가장하지 않는다.
- Provider/BYOK/Ollama/WebLLM 선택, desktop 앱 도입, Adobe 문서 전체 ingest/RAG는 별도 결정이다.
- Proposed 단계에서는 문서만 작성하며 `review-adr` 승인 전 production 구현을 시작하지 않는다.

## Alternatives Considered

### 대안 A: 현행 agent-first 유지 + 모델·프롬프트 튜닝

- 설명: 구조는 유지하고 Ollama 모델 축소, reasoning 설정, prompt 압축, tool pruning,
  catalog Tier 조절로 지연을 줄인다.
- 근거: 현 Provider/Profile/Agent 기반을 가장 적게 바꾸며 ADR-134의 원 결정을 그대로 유지한다.
- 위험:
  - 기술: L — 설정·prompt 조정 중심이다.
  - 성능: **H** — direct 요청도 provider 호출과 모델 cold start를 피하지 못해 HC1을 구조적으로
    만족하지 못한다.
  - 유지보수: M — 모델별 prompt/tool 튜닝과 회귀 측정이 계속 필요하다.
  - 마이그레이션: L — routing 변경이 거의 없다.

### 대안 B: compiler-first hybrid + typed IR + 선택적 LLM/Agent fallback

- 설명: closed manifest와 deterministic compiler가 direct 요청을 typed IR로 만들고 기존
  executor를 호출한다. 모호한 요청은 one-shot LLM IR, 창의적 다단계 요청만 bounded Agent로
  내린다. 알려진 합성은 factory/reusable/recipe resolver로 처리한다.
- 근거: React Aria의 composition 모델은 구조 recipe에, JSON Schema/MCP tool schema는 IR 검증과
  executor 경계에 각각 대응한다. composition의 기존 catalog/factory/ADR-196을 재사용하므로
  문서 지식을 실행 지식으로 중복 작성하지 않는다.
- 위험:
  - 기술: M — classifier, typed IR, prop/slot routing, read-back 검증을 새로 결합해야 한다.
  - 성능: L — direct route는 provider·network 0이며 compiler 비용만 추가된다.
  - 유지보수: M — alias/recipe는 관리 대상이지만 manifest/schema parity gate로 정본 drift를
    차단할 수 있다.
  - 마이그레이션: M — `useAgentLoop`의 기본 routing을 바꾸되 기존 Agent를 fallback으로 남긴다.

### 대안 C: 완전 결정적 parser/compiler, LLM 제거

- 설명: 자연어 grammar와 recipe만으로 모든 요청을 처리하고 Provider/Agent 경로를 제거한다.
- 근거: 명령 palette나 slash command처럼 bounded domain에서는 결정적 parser가 가장 빠르고
  재현 가능하다.
- 위험:
  - 기술: M — 자유 문장·문맥 참조·복합 조건을 grammar로 모두 표현하기 어렵다.
  - 성능: L — 모델 호출이 없다.
  - 유지보수: **H** — 자연어 변형, locale, synonym, 조합 요구가 늘 때 grammar와 recipe가
    제품 요구 전체를 떠안는다.
  - 마이그레이션: M — 이미 구현된 Provider/Agent UX의 유효 기능을 제거한다.

### 대안 D: 모든 요청을 단일 LLM 호출의 typed IR로 변환

- 설명: Agent loop는 제거하되 모든 요청을 LLM 1회에 보내 schema-constrained IR만 받고 같은
  executor로 실행한다.
- 근거: multi-turn Agent보다 단순하고 IR 검증으로 mutation 안전성을 높일 수 있다.
- 위험:
  - 기술: M — provider별 structured output 정합과 semantic verification이 필요하다.
  - 성능: **H** — `버튼 생성해`도 provider 1회라 HC1과 offline direct를 위반한다.
  - 유지보수: M — Agent prompt보다 작지만 모델·schema 호환성은 계속 관리한다.
  - 마이그레이션: M — Agent routing과 응답 UX를 바꾼다.

### 대안 E: Adobe Markdown/RAG 중심 agent 유지

- 설명: RAC/RSC Markdown을 전부 index하거나 prompt에 주입해 현 Agent가 component API와
  합성법을 더 정확히 고르게 한다.
- 근거: Adobe 공식 문서는 RAC primitive의 props와 composition 예제를 기계가 읽을 수 있는
  형식으로 제공한다.
- 위험:
  - 기술: M — ingest/versioning/retrieval과 source pinning이 새로 필요하다.
  - 성능: **H** — retrieval과 provider 호출이 direct 요청에도 남고 prompt/context가 커진다.
  - 유지보수: M — Adobe 문서 버전과 repo binding 차이를 계속 조정해야 한다.
  - 마이그레이션: L — 현재 Agent 경로를 유지한다.

### Risk Threshold Check

| 대안 | 기술 | 성능 | 유지보수 | 마이그레이션 | HIGH+ 개수 |
| ---- | ---- | ---- | -------- | ------------ | :--------: |
| A    | L    | H    | M        | L            |     1      |
| B    | M    | L    | M        | M            |     0      |
| C    | M    | L    | H        | M            |     1      |
| D    | M    | H    | M        | M            |     1      |
| E    | M    | H    | M        | L            |     1      |

루프 판정: B가 HIGH 0이므로 새 대안 추가 조건에 해당하지 않는다. CRITICAL 0이므로 근본적으로
다른 접근 추가도 불필요하다. A/D/E의 성능 HIGH는 튜닝으로 낮출 수 있는 우발 위험이 아니라
direct 요청에 provider 호출이 남는 구조적 HC1 위반이다. C의 유지보수 HIGH는 fallback을 완전히
제거할 때 자연어·조합 범위가 grammar에 무제한 누적되는 구조에서 온다.

## Decision

**대안 B: compiler-first hybrid + typed IR + 선택적 LLM/Agent fallback**을 선택한다.

요청 처리 순서는 다음 계약으로 고정한다.

1. deterministic normalizer/classifier가 등록된 alias, 선택 상태, catalog/command capability로
   direct 가능성을 판정한다.
2. direct 요청은 versioned `BuilderCommandProgram`으로 compile하고 closed schema 및 manifest로
   전부 검증한다.
3. 검증된 program은 기존 tool registry 또는 ADR-196 command executor로만 실행하고 canonical
   read-back으로 결과를 확인한다.
4. direct compile이 성립하지 않으면 LLM 1회가 같은 IR만 생성한다. 모델은 임의 type/prop/slot/
   command를 만들 수 없고 같은 validator에서 거부된다.
5. 화면 전체 설계처럼 탐색·수정 반복이 필요한 요청만 별도 `creative-multistep` route에서
   기존 Agent orchestration을 사용한다.

합성형은 “Agent가 알아서 자식을 만든다”로 처리하지 않는다. 생성 대상은 네 종류다.

- **leaf**: 기존 `create_element` 단일 노드 경로.
- **complex**: `COMPLEX_COMPONENT_TAGS`와 `ComponentFactory`가 가진 canonical 자식 트리.
- **reusable**: Components page의 origin을 가리키는 ref instance.
- **composed recipe**: 등록된 제품 패턴이 기존 type/prop/slot을 참조해 만드는 typed program.
  built-in complex/reusable 구조는 recipe에 복사하지 않는다. 미등록 자유 조합은 one-shot IR 또는
  Agent fallback으로 보내며, 검증 전 mutation은 없다.

Adobe Markdown은 D1/D2의 공식 의미를 확인하고 alias/recipe 테스트 corpus를 작성하는 참고 자료로
사용할 수 있지만, runtime 실행 정본은 아니다. Composition 고유 실행 사실은 repo의 catalog,
binding, factory, canonical tool, command registry에서만 파생한다.

이 ADR이 **Accepted**되면 ADR-134를 다음처럼 부분 개정한다.

- **유지**: D1~D5 Provider/canonical/collections/interaction/frame 도구, D9 AIPanel UX,
  D10 secret isolation, D11 MCP-compatible schema와 ADR-196 descriptor 소비.
- **D6 부분 대체**: catalog를 모든 요청의 Agent prompt에 우선 주입하는 정책에서,
  compiler manifest의 파생 원천으로 우선 사용하고 LLM/Agent fallback에만 prompt projection을
  제공하는 정책으로 바꾼다.
- **D7 부분 대체**: Plan→Execute→Verify가 기본 진입점인 정책을 direct compiler → one-shot IR →
  bounded Agent의 단계적 fallback으로 바꾼다.
- **D8 부분 대체**: Agent profile 유무가 먼저 routing을 결정하지 않는다. capability/confidence가
  execution class를 고른 뒤 필요한 fallback profile을 선택한다.
- **ADR-196 유지**: command metadata/allowlist/confirm/history/log executor는 대체하지 않고 direct
  compiler와 fallback이 함께 소비한다.

선택 위험 M은 새 classifier와 IR/recipe 계약에서 발생하지만, mutation 전 fail-closed 검증,
팔레트·human command를 독립 oracle로 쓰는 parity gate, 기존 Agent fallback 유지로 제한할 수 있다.
canonical schema 변경이 없어 routing rollback도 문서 migration 없이 가능하다.

> 구현 상세: [202-builder-ai-compiler-first-command-execution-breakdown.md](design/202-builder-ai-compiler-first-command-execution-breakdown.md)

## Risks

| ID  | 위험                                                                                                                | 심각도 | 대응                                                                                                                       |
| --- | ------------------------------------------------------------------------------------------------------------------- | :----: | -------------------------------------------------------------------------------------------------------------------------- |
| R1  | classifier false positive가 모호한 문장을 direct mutation으로 오해                                                  | MEDIUM | exact/capability match 우선, 충돌·부정문·낮은 confidence는 fallback. negative corpus와 mutation 0 gate(G2·G4)              |
| R2  | manifest/tool schema/executor 타입이 다시 갈라져 유효하지 않은 IR이 통과                                            | MEDIUM | catalog·edit contract·tool/command registry 파생, build-time parity와 schema mutation test(G1)                             |
| R3  | 현재 `createElementTool`의 composite early return처럼 요청 props/styles/fills/slot이 complex/reusable 생성에서 유실 | MEDIUM | leaf/complex/reusable × prop/style/canonical/slot matrix를 팔레트 canonical snapshot과 대조(G2·G3)                         |
| R4  | composed recipe가 component 구조·기본값을 복제해 새로운 SSOT가 됨                                                   | MEDIUM | recipe는 등록 id와 prop/slot route만 참조, built-in child tree 금지 정적 게이트. structure owner는 factory/origin 유지(G1) |
| R5  | schema-valid LLM IR이 사용자의 의미와 다른 mutation을 수행                                                          | MEDIUM | semantic validator, 선택/대상 read-back, destructive confirm, ambiguity threshold. invalid/uncertain은 실행하지 않음(G4)   |
| R6  | 다단계 recipe 중간 실패가 부분 문서와 여러 history entry를 남김                                                     | MEDIUM | 실행 전 전 program 검증, atomicity capability 없는 program은 direct 제외, 실패 시 rollback/read-back gate(G3)              |
| R7  | 웹과 향후 desktop이 서로 다른 manifest/schema 버전을 소비                                                           |  LOW   | 동일 module artifact와 contract suite, manifest/schema version handshake. desktop host가 없으므로 enable 전 G5 의무        |
| R8  | Agent 사용 축소로 자유 설계 품질·진행 표시가 퇴행                                                                   |  LOW   | `creative-multistep` route와 기존 Agent UX 유지, direct 결과는 별도 즉시 완료 상태로 표시(G4·G5)                           |

잔존 HIGH 위험 없음.

## Gates

| Gate | 시점    | 통과 조건                                                                                                                                                                                                                                                                                                            | 실패 시 대안                                                                                                                                                               |
| ---- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| G0   | Phase 0 | `useAgentLoop → createAgentRunner`, fallback metadata-only, `AgentService` provider/turn 수, tool/catalog schema, composite `finalProps` 경계를 재확인. 실제 사용자 direct/ambiguous prompt corpus를 고정하고 현행 providerCalls·agentTurns·canonical 결과를 같은 조건에서 기록. 측정 Q1~Q5는 breakdown §7 전부 기재 | 코드 사실이 다르면 ADR Context와 phase 범위를 먼저 갱신. 측정이 provider/기기 조건을 못 고정하면 시간 수치는 의사결정에 사용하지 않고 호출 수·canonical 결과만 gate로 사용 |
| G1   | Phase 1 | `BuilderCommandProgram` tagged union + schema version + validator. placeable component/creation mode/prop/slot/command manifest가 기존 SSOT와 집합·값 parity. 미등록/추가 속성/schema mismatch mutation 0. 수동 type enum 재도입 mutation test RED                                                                   | 파생할 수 없는 사실은 D1/D2/D3 owner에 먼저 추가하거나 direct 범위에서 제외. 별도 수동 catalog 금지                                                                        |
| G2   | Phase 2 | direct corpus 전부 `providerCalls=0`, `agentTurns=0`, AI network 0. leaf/complex/reusable/registered recipe 생성과 선택 기반 update/command가 expected IR로 compile. alias 충돌·부정·미등록 type·내부 type은 mutation 0/fallback. 팔레트 normalized canonical parity                                                 | 실패 family만 fallback으로 내리고 direct allowlist를 축소. 정확도 대신 confidence threshold 완화 금지                                                                      |
| G3   | Phase 3 | 같은 validator/executor가 compiler·LLM IR 양쪽을 소비. composite prop/style/fill/canonical/slot routing 손실 0. program 전체 preflight 후 실행, 실패·승인 거부 시 canonical diff 0, 성공 시 history/confirm/log가 기존 human 경로와 일치. palette/human command가 독립 oracle                                        | atomicity를 보장 못 하는 multi-op은 Agent 또는 사용자 명시 preview/confirm 경로로 내림. 기존 `batch_design`의 async transaction을 증거 없이 atomic으로 간주 금지           |
| G4   | Phase 4 | direct·ambiguous·creative 세 route가 corpus 기대와 일치. ambiguous는 provider 호출 최대 1회, 반환 IR invalid/unknown이면 mutation 0. creative만 bounded Agent. fallback이 direct executor 우회 0. Ollama가 없어도 direct suite 전부 PASS                                                                             | one-shot structured output이 provider별 불안정하면 해당 provider는 기존 Agent fallback 유지. direct 경로는 되돌리지 않음                                                   |
| G5   | Phase 5 | 웹 Builder 실제 제출에서 Button/Select/reusable/command/offline direct 동작. host-neutral suite는 DOM/Electron/provider mock 없이 PASS. compiler bundle에 provider SDK·Adobe Markdown index 포함 0. desktop은 동일 suite를 통과하기 전 지원 표기/enable 금지                                                         | browser-only API가 나오면 host adapter 경계로 이동. desktop 앱 신설은 별도 ADR이며 이 phase의 scope 확장으로 흡수 금지                                                     |
| G6   | Phase 6 | 기존 Agent route를 rollback 가능 상태로 한 릴리스 유지하고 session-local direct 계측은 content 없이 route/call count/error code만 기록. ADR-134 D6~D8 부분 대체 표시, README/CHANGELOG/운영 문서 갱신, focused test/type-check/preflight/live evidence 후에만 Implemented 승격                                       | direct corpus에서 오류가 하나라도 재현되면 해당 family의 direct allowlist 축소 또는 route cutover 복귀. canonical migration은 없으므로 문서 rollback 불필요                |

## Consequences

### Positive

- `버튼 생성해` 같은 명시적 요청은 Ollama/인터넷/Agent cold start와 무관하게 기존 도구로 즉시
  실행된다.
- leaf뿐 아니라 complex, reusable, 등록된 composition recipe가 같은 typed contract와 팔레트
  parity를 가진다.
- Adobe 문서의 장점은 D1/D2 reference로 취하고, composition 고유 실행 사실은 catalog/factory/
  command registry에 남겨 문서 prompt와 runtime SSOT의 혼합을 피한다.
- compiler, LLM, Agent가 하나의 validator/executor를 사용하므로 모델 교체가 mutation 의미를
  바꾸지 않는다.
- 웹은 현재 client runtime에서 동작하고, 향후 desktop은 같은 host-neutral module을 재사용할 수
  있다. direct 기능은 서버·provider를 요구하지 않는다.

### Negative

- classifier/alias/recipe/IR validator라는 새 유지보수 표면이 생긴다. 파생 manifest gate가 있어도
  자연어 corpus와 제품 recipe는 사람이 관리해야 한다.
- 모든 자유 문장을 direct 처리하지 않는다. 확신이 낮으면 one-shot LLM 또는 Agent로 내려가므로
  요청별 지연 편차는 남는다.
- 합성 props/slot routing과 다단계 atomicity의 기존 결함을 드러내고 수리해야 해 routing 변경만으로
  끝나는 작업이 아니다.
- 현재 desktop 앱이 없으므로 이 ADR은 host-neutral 계약까지만 확정한다. 실제 desktop integration과
  외부 agent embed는 별도 ADR 없이는 완료로 주장할 수 없다.
- ADR-134의 D6~D8 설명과 운영 문서를 cutover 시 함께 개정해야 하며, Accepted 전에는 선행 ADR의
  현재 구현 상태를 바꾸지 않는다.
