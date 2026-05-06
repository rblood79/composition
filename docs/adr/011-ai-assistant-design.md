# composition AI 기능 업그레이드 설계

> **Superseded by [ADR-054](054-local-llm-architecture.md)** — 로컬 LLM 아키텍처 (Ollama → node-llama-cpp)

> 작성일: 2026-01-31
> 참고: `docs/RENDERING_ARCHITECTURE.md` (렌더링 전환 계획)
> 대상: `apps/builder/src/services/ai/`, `apps/builder/src/builder/panels/ai/`
> LLM 공급자: Groq SDK (무료 tier, llama-3.3-70b-versatile)

---

## 1. 현재 상태 분석

### 1.1 AI 파일 구조

> **Phase A1~A4 구현 완료** (2026-02-06)
> **코드 대조 검증 완료** (2026-03-03)

```
apps/builder/src/
├── types/integrations/
│   ├── ai.types.ts              # ✅ AgentEvent, ToolCall, ToolExecutor, AIAgentProvider 타입
│   │                            #    (기존 AIProvider, AIResponse는 @deprecated 유지)
│   └── chat.types.ts            # ✅ tool role, ToolCallInfo, ConversationState 확장
│                                #    (appendToLastMessage 액션 포함)
├── types/theme/
│   └── generation.types.ts      # 테마 생성 타입
├── services/ai/
│   ├── GroqAgentService.ts      # ✅ Tool Calling + Agent Loop 핵심 서비스
│   │                            #    (MAX_TURNS=10, MAX_RETRIES=3, temperature=0.7, max_tokens=2048)
│   ├── GroqService.ts           # ⚠️ deprecated — IntentParser fallback 전용
│   ├── IntentParser.ts          # 유지 (최후 fallback)
│   ├── systemPrompt.ts          # ✅ 동적 시스템 프롬프트 빌더
│   │                            #    (컴포넌트 목록, Mock 엔드포인트, 현재 빌더 상태 포함)
│   ├── styleAdapter.ts          # ✅ CSS-like → 내부 스키마 변환 레이어
│   │                            #    ⚠️ AI-A5a: rem/em/vh/vw → px 단위 정규화 구현됨
│   └── tools/                   # ✅ 도구 구현 디렉토리
│       ├── index.ts             # 도구 레지스트리 (7개 도구)
│       ├── definitions.ts       # 도구 JSON Schema 정의
│       ├── createElement.ts     # create_element (G.3 flash 연동, HierarchyManager 사용)
│       ├── updateElement.ts     # update_element (G.3 flash 연동)
│       ├── deleteElement.ts     # delete_element (body 보호)
│       ├── getEditorState.ts    # get_editor_state (childrenMap 기반 트리 구조)
│       ├── getSelection.ts      # get_selection (elementsMap 기반)
│       ├── searchElements.ts    # search_elements (tag/propName/propValue/styleProp 필터)
│       └── batchDesign.ts       # batch_design (최대 20개, 실패 시 나머지 중단)
├── services/theme/
│   └── ThemeGenerationService.ts # AI 테마 생성
├── builder/panels/ai/
│   ├── AIPanel.tsx              # ✅ useAgentLoop 기반, Tool 피드백 UI
│   │                            #    (ChatMessage, ChatInput, ChatContainer 내부 정의)
│   │                            #    ⚠️ ToolCallMessage는 AIPanel에서 직접 import 안 함
│   │                            #    (ChatMessage 내부에서 role='tool' 시 ToolResultMessage 호출)
│   ├── AIPanel.css
│   ├── components/              # ✅ 패널 하위 컴포넌트
│   │   ├── ToolCallMessage.tsx  # 도구 호출 상태 표시 (아이콘+라벨+스피너) — activeToolCalls 전용
│   │   ├── ToolResultMessage.tsx # 도구 실행 결과 표시 (role='tool' 메시지)
│   │   └── AgentControls.tsx    # 중단 버튼 + 현재 turn 표시 (isAgentRunning=true 시 노출)
│   └── hooks/
│       └── useAgentLoop.ts      # ✅ Agent Loop React hook (G.3 연동, IntentParser fallback)
├── builder/panels/themes/components/
│   └── AIThemeGenerator.tsx     # 테마 생성 UI
└── builder/stores/
    ├── conversation.ts          # ✅ agent 상태, tool events, appendToLastMessage 확장
    └── aiVisualFeedback.ts      # ✅ G.3 시각 피드백 (generating/flash)
                                 #    (독립 Zustand 스토어, 렌더 루프에서 getState() 직접 읽기)
```

### 1.2 기존 아키텍처의 문제점 및 해결 상태

| 문제                      | 상세                                                              | 해결                                                     |
| ------------------------- | ----------------------------------------------------------------- | -------------------------------------------------------- |
| **JSON 텍스트 파싱 방식** | AI가 JSON 텍스트를 출력 → `parseIntent()`로 파싱 → 형식 깨짐 빈번 | ✅ Tool Calling으로 대체 (GroqAgentService)              |
| **대화 히스토리 미전달**  | 매 메시지가 독립적 — AI에 이전 대화 컨텍스트 없음                 | ✅ 전체 대화 히스토리 전달 (runAgentLoop)                |
| **컨텍스트 부족**         | 최근 5개 요소의 간략 정보만 전달                                  | ✅ get_editor_state/get_selection 도구로 풍부한 컨텍스트 |
| **Tool Calling 미사용**   | groq-sdk가 tool calling을 지원하지만 활용하지 않음                | ✅ 7개 도구 정의 + tool_choice: 'auto'                   |
| **단일 메시지 구조**      | tool 실행 과정, 중간 결과 표시 불가                               | ✅ ToolCallMessage/ToolResultMessage 컴포넌트            |
| **에이전트 제어 없음**    | 중단 버튼, 재시도 등 제어 기능 없음                               | ✅ AgentControls + AbortController                       |
| **시각 피드백 없음**      | AI 작업 중 캔버스 레벨 피드백 없음                                | ✅ G.3 완전 구현 (generating + flash)                    |
| **배치 작업 미지원**      | 복수 요소 일괄 생성/수정 불가                                     | ✅ batch_design 도구 (최대 20개 작업)                    |
| **Rate Limit 미대응**     | Groq 무료 tier 30 req/min 제한 시 에러                            | ✅ 429 지수 백오프 (3회 재시도)                          |

### 1.3 미해결 한계점 (Phase A 완료 후)

> **Phase A1~A4는 코드 구조를 완성했으나, AI의 "설계 지능"은 미구현 상태.**
> 현재 AI는 도구를 호출할 수 있지만, **무엇을 어떻게 만들지 모른다.**

#### 1.3.1 컴포넌트 지식 격차

| 영역                   | 실제 시스템                                                                           | AI가 아는 것     | Gap                        |
| ---------------------- | ------------------------------------------------------------------------------------- | ---------------- | -------------------------- |
| **컴포넌트 수**        | 46+ (9개 카테고리)                                                                    | 29개 (평면 나열) | 17+ 컴포넌트 누락          |
| **카테고리**           | Layout, Inputs, Actions, Collections, Feedback, Date&Time, Overlays, Structure, Other | 없음             | 카테고리 구조 모름         |
| **Compositional 구조** | Card→CardHeader(Heading)+CardContent(Description)                                     | 없음             | 단일 요소만 생성 가능      |
| **팩토리 패턴**        | `createTabsDefinition()` 등 9개 팩토리 파일                                           | 없음             | children/tabId 페어링 불가 |
| **variant/size**       | variant: default/primary/secondary/surface, size: xs~xl                               | 없음             | 유효값 모름                |

**결과:** "Card 만들어줘" → 빈 Card 껍데기만 생성. CardHeader/CardContent children 없음.

#### 1.3.2 레이아웃 지식 격차

| 영역         | 스타일 패널 지원                                         | AI 시스템 프롬프트    | Gap                |
| ------------ | -------------------------------------------------------- | --------------------- | ------------------ |
| **display**  | block/flex/inline/inline-block/inline-flex/grid/none     | 없음                  | 배치 개념 없음     |
| **Flexbox**  | flexDirection, alignItems, justifyContent, gap, flexWrap | 없음                  | 정렬 불가          |
| **Spacing**  | padding/margin 4방향, gap                                | "camelCase CSS" 한 줄 | 구체적 가이드 없음 |
| **Sizing**   | width(px/%/vh/vw/fit-content/auto), height 동일          | 없음                  | 크기 설정 모름     |
| **3x3 정렬** | leftTop~rightBottom 9방위 매핑                           | 없음                  | 정렬 감각 없음     |

**결과:** 여러 요소 생성 시 모두 겹침. flex 컨테이너 없이 나열.

#### 1.3.3 데이터 바인딩 격차

| 영역                 | 데이터 패널 지원                                    | AI가 아는 것      | Gap                     |
| -------------------- | --------------------------------------------------- | ----------------- | ----------------------- |
| **Mock 엔드포인트**  | 40+ (/users, /products, /audit-logs, /engines 등)   | 10개만 나열       | 30+ 엔드포인트 누락     |
| **DataBinding 타입** | collection/value/field + Transform 3단계            | endpoint 문자열만 | 완전한 바인딩 설정 불가 |
| **DataTable 프리셋** | 18종 (users-auth, ecommerce, manufacturing, system) | 없음              | 프로토타이핑 불가       |
| **Transform**        | Level1(매핑) + Level2(JS) + Level3(커스텀)          | 없음              | 데이터 변환 불가        |
| **bindings**         | 필드별 `{ type: "dataTable", field: "name" }`       | 없음              | 셀 매핑 불가            |

**결과:** "사용자 테이블 만들어줘" → 빈 Table 생성. 데이터 바인딩 없음.

#### 1.3.4 모델/프롬프트 한계

| 항목                | 현재 상태                           | 문제                                       |
| ------------------- | ----------------------------------- | ------------------------------------------ |
| **모델**            | llama-3.3-70b-versatile (Groq 무료) | Tool Calling 정확도 낮음, 디자인 추론 부족 |
| **시스템 프롬프트** | 51줄, 규칙 5개                      | 디자인 원칙/레이아웃 패턴 가이드 전무      |
| **max_tokens**      | 2048                                | 복잡한 batch 작업 시 응답 잘림             |
| **temperature**     | 0.7                                 | Tool Calling에는 과도 (0.3~0.5 권장)       |
| **결과 검증**       | 없음                                | AI가 잘못된 props/style 넣어도 통과        |
| **자기 수정**       | 없음                                | 실패 후 재시도/수정 메커니즘 없음          |
| **멀티스텝 계획**   | 없음                                | "대시보드 만들어줘" 수준 요청 불가         |
| **API 키 보안**     | `dangerouslyAllowBrowser: true`     | 브라우저에서 API 키 노출                   |

#### 1.3.5 한계점 종합 평가

```
Phase A 성과: "도구를 호출할 수 있는 구조" ✅
Phase B 목표: "도구를 제대로 활용하는 지능" ← 미구현
```

**사용자 체감:** AI가 "버튼 만들어줘" 수준만 처리 가능.
"사용자 관리 대시보드 만들어줘"처럼 여러 컴포넌트+레이아웃+데이터가 필요한 요청은 **사실상 불가능.**

### 1.4 기존 메시지 흐름

```
사용자 입력
    ↓
[AIPanel] ChatInput
    ↓
addUserMessage() → Conversation Store
    ↓
[GroqService] chatStream() — 시스템 프롬프트에 JSON 형식 강제
    ↓
AI가 JSON 텍스트 출력 (형식 깨짐 가능)
    ↓
parseIntent() — JSON 파싱 시도
    ↓ 실패 시
[IntentParser] Rule-based fallback
    ↓
executeIntent() — 단일 요소 생성/수정/삭제
```

---

## 2. Pencil AI 기능 분석

> 출처: Pencil AI 아키텍처 분석 기반

### 2.1 Pencil AI 아키텍처

```
┌─────────────────────────────────────────────┐
│              Main Process                    │
│  ├── Claude AI 에이전트 (claude.js)          │
│  │   └── @anthropic-ai/claude-agent-sdk     │
│  │       ├── Tool Calling (도구 직접 호출)    │
│  │       ├── Multi-turn Agent Loop           │
│  │       └── Streaming (delta)               │
│  └── MCP 어댑터 (desktop-mcp-adapter.js)     │
│      ├── Claude Code CLI                     │
│      ├── Codex CLI                           │
│      ├── Gemini CLI                          │
│      └── OpenCode CLI                        │
├──────────────── IPC ─────────────────────────┤
│            Renderer Process                  │
│  ├── AI Chat Panel (ARt)                     │
│  │   ├── 모델 선택 (Opus/Sonnet/Haiku)       │
│  │   ├── 프롬프트 입력 + 제출                 │
│  │   ├── Tool Use 실시간 표시                 │
│  │   └── 프레임 → 코드 생성                   │
│  └── renderGeneratingEffects()               │
│      └── AI 생성 중 시각 피드백 (블러+파티클)   │
└─────────────────────────────────────────────┘
```

### 2.2 Pencil AI 핵심 기능

| 기능                     | 설명                                                                                                                    |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| **Agent Tool Use**       | AI가 에디터 조작 도구를 직접 호출 (텍스트 파싱 아님)                                                                    |
| **batch-design**         | 대규모 디자인 변경 (insert/update/copy/delete 배치 처리)                                                                |
| **풍부한 컨텍스트**      | get-editor-state, get-selection, get-screenshot, get-variables, search-design-nodes, get-style-guide 등 18종 IPC Handle |
| **Frame → Code 생성**    | 디자인 프레임 선택 후 코드 자동 생성                                                                                    |
| **디자인 프롬프트**      | 자연어로 전체 디자인 생성                                                                                               |
| **Tool 이벤트 스트리밍** | chat-tool-use-start → chat-tool-use → chat-tool-result                                                                  |
| **AI 생성 이펙트**       | 생성 중 블러+파티클 시각 피드백 (CanvasKit)                                                                             |
| **에이전트 제어**        | agent-stop IPC로 중단 가능, streaming delta 실시간 표시                                                                 |
| **AI 생성 이미지**       | 생성된 이미지를 에셋으로 저장                                                                                           |

### 2.3 Pencil AI 관련 IPC 이벤트

**렌더러 → 호스트 (Notify):**

| 메서드                 | 용도                   |
| ---------------------- | ---------------------- |
| `submit-prompt`        | AI 프롬프트 제출       |
| `send-prompt`          | 에이전트 프롬프트 전달 |
| `enter-claude-api-key` | API 키 설정            |
| `clear-claude-api-key` | API 키 삭제            |
| `add-to-chat`          | 채팅 컨텍스트 추가     |

**렌더러 → 호스트 (Request):**

| 메서드                 | 용도                |
| ---------------------- | ------------------- |
| `agent-stop`           | AI 에이전트 중지    |
| `save-generated-image` | AI 생성 이미지 저장 |

**호스트 → 렌더러 (Handle — AI가 에디터 조작에 사용):**

| 메서드                            | 용도                                         |
| --------------------------------- | -------------------------------------------- |
| `get-editor-state`                | 에디터 상태 반환                             |
| `get-selection`                   | 선택 노드 반환                               |
| `get-screenshot`                  | 뷰포트 캡처                                  |
| `get-variables`                   | 디자인 변수 반환                             |
| `set-variables`                   | 디자인 변수 설정                             |
| `get-style-guide`                 | 스타일 가이드 반환                           |
| `search-design-nodes`             | 노드 검색                                    |
| `search-all-unique-properties`    | 속성 검색                                    |
| `replace-all-matching-properties` | 속성 일괄 교체                               |
| `batch-design`                    | 배치 디자인 작업 (insert/update/copy/delete) |
| `copy-nodes-by-id`                | ID로 노드 복사                               |
| `find-empty-space-on-canvas`      | 빈 공간 탐색                                 |

**호스트 → 렌더러 (이벤트 수신):**

| 이벤트                   | 용도            |
| ------------------------ | --------------- |
| `chat-tool-use-start`    | 도구 호출 시작  |
| `chat-tool-use`          | 도구 호출 진행  |
| `chat-tool-result`       | 도구 실행 결과  |
| `chat-session`           | 세션 관리       |
| `chat-assistant-delta`   | 스트리밍 텍스트 |
| `chat-assistant-final`   | 최종 응답       |
| `chat-error`             | 에러            |
| `chat-agent-message`     | 에이전트 메시지 |
| `chat-question-answered` | 질문 응답 완료  |
| `claude-status`          | AI 연결 상태    |

### 2.4 Pencil AI 모델 지원

| 환경                | 사용 가능 모델          | 기본 모델 |
| ------------------- | ----------------------- | --------- |
| Electron (데스크톱) | Sonnet, Haiku, Opus     | Opus      |
| Cursor (IDE 통합)   | Sonnet, Haiku, Composer | Composer  |

---

## 3. Groq SDK 역량 분석

### 3.1 현재 버전

- **패키지**: `groq-sdk` v0.37.0
- **환경변수**: `VITE_GROQ_API_KEY`
- **사용 모델**: `llama-3.3-70b-versatile`
- **브라우저 사용**: `dangerouslyAllowBrowser: true`

### 3.2 Pencil Claude Agent SDK 대체 가능성

| Claude Agent SDK 기능  | groq-sdk 대응                         | 가능 여부                       |
| ---------------------- | ------------------------------------- | ------------------------------- |
| Tool Calling           | `tools` + `tool_choice` 파라미터 지원 | **가능**                        |
| Streaming              | `stream: true` 지원                   | **가능**                        |
| Tool Use Events        | `delta.tool_calls` 스트리밍 지원      | **가능**                        |
| Multi-turn             | messages 배열에 tool_result 포함      | **가능**                        |
| Agent Loop             | 자체 구현 필요 (SDK에 내장 안 됨)     | **직접 구현**                   |
| MCP Protocol           | 미지원                                | **별도 구현 필요** (후순위)     |
| 이미지 입력 (스크린샷) | llama 모델 미지원                     | **불가** (텍스트 컨텍스트 우선) |

### 3.3 groq-sdk Tool Calling 지원 확인

groq-sdk v0.37.0의 `ChatCompletionCreateParams`에서 확인된 타입:

```typescript
// groq-sdk/src/resources/chat/completions.ts
interface ChatCompletionCreateParams {
  tools?: Array<ChatCompletionTool> | null;
  tool_choice?: ChatCompletionToolChoiceOption | null;
  // ...
}

interface ChatCompletionTool {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>; // JSON Schema
  };
}

type ChatCompletionToolChoiceOption =
  | "none"
  | "auto"
  | "required"
  | ChatCompletionNamedToolChoice;
```

### 3.4 무료 사용 시 제한

| 항목            | 제한                                        |
| --------------- | ------------------------------------------- |
| Rate Limit      | 30 req/min (무료 tier)                      |
| Token Limit     | 30,000 tokens/min                           |
| 모델            | llama-3.3-70b-versatile (tool calling 지원) |
| 컨텍스트 윈도우 | 128K tokens                                 |
| 속도            | Groq LPU 기반 — 매우 빠름 (장점)            |

### 3.5 위험 완화 전략

- Tool 정의를 단순하고 명확하게 유지 (llama 모델이 잘 따르도록)
- JSON mode (`response_format: { type: "json_object" }`) 활용 가능
- IntentParser를 완전 제거하지 않고 최후 fallback으로 유지
- 복잡한 작업은 여러 개의 단순한 tool로 분할
- Rate limit 대응: 요청 큐 + 지수 백오프 구현

---

## 4. 목표 아키텍처

### 4.1 전환 전후 비교

**현재 (JSON 텍스트 파싱):**

```
User → "빨간 버튼 만들어"
  → Groq chatStream() — 시스템 프롬프트에 JSON 강제
  → AI가 JSON 텍스트 출력 (파싱 실패 가능)
  → parseIntent() → executeIntent()
```

**목표 (Tool Calling + Agent Loop):**

```
User → "빨간 버튼 만들어"
  → Groq chat.completions.create({ tools, messages })
  → AI가 tool_calls 반환: [{ name: "create_element", arguments: {...} }]
  → 도구 실행 → 결과를 messages에 추가
  → AI가 추가 도구 호출 or 최종 텍스트 응답
```

### 4.2 목표 메시지 흐름

```
사용자 입력
    ↓
[AIPanel] ChatInput
    ↓
addUserMessage() → Conversation Store
    ↓
[AIAgentService] runAgentLoop()
    ↓
┌─── Agent Loop ─────────────────────────────────┐
│                                                 │
│  Groq chat.completions.create({                 │
│    tools: [create_element, update_element, ...], │
│    messages: [...대화 히스토리, 시스템 프롬프트]    │
│  })                                              │
│      ↓                                          │
│  response.choices[0].message                    │
│      ↓                                          │
│  tool_calls 있음?                                │
│  ├── Yes → 각 tool_call 실행                     │
│  │         → 결과를 tool message로 추가           │
│  │         → UI에 tool-use 피드백 표시            │
│  │         → continue (다음 턴)                   │
│  └── No  → 최종 텍스트 응답                       │
│           → 사용자에게 표시                        │
│           → break                                │
│                                                  │
│  AbortController로 언제든 중단 가능               │
└──────────────────────────────────────────────────┘
```

### 4.3 AI 도구 정의

Pencil의 IPC Handle을 참고하여 Groq tool calling에 등록할 도구:

| 도구                | 역할                                       | Pencil 대응                 | 상태     |
| ------------------- | ------------------------------------------ | --------------------------- | -------- |
| `create_element`    | 요소 생성 (타입, props, styles, 부모 지정) | batch-design → handleInsert | ✅ 구현  |
| `update_element`    | 요소 속성/스타일 수정                      | batch-design → handleUpdate | ✅ 구현  |
| `delete_element`    | 요소 삭제                                  | batch-design → handleDelete | ✅ 구현  |
| `get_editor_state`  | 현재 페이지 구조, 요소 트리 조회           | get-editor-state            | ✅ 구현  |
| `get_selection`     | 선택된 요소 상세 정보                      | get-selection               | ✅ 구현  |
| `search_elements`   | 조건으로 요소 검색 (태그, 속성 등)         | search-design-nodes         | ✅ 구현  |
| `batch_design`      | 복수 요소 일괄 변경                        | batch-design                | ✅ 구현  |
| `get_style_guide`   | 현재 테마, 디자인 토큰 조회                | get-style-guide             | Phase 5+ |
| `get_variables`     | 디자인 변수 목록 조회                      | get-variables               | Phase 5+ |
| `set_variables`     | 디자인 변수 설정                           | set-variables               | Phase 5+ |
| `create_component`  | 요소를 Master 컴포넌트로 등록 (G.1)        | —                           | Phase 5+ |
| `create_instance`   | Master의 인스턴스 배치 (G.1)               | —                           | Phase 5+ |
| `override_instance` | 인스턴스 속성 오버라이드 (G.1)             | —                           | Phase 5+ |

> **Phase 5+ (G.1/G.2 반영):** `create_component`, `create_instance`, `override_instance` 도구가 추가되어
> 컴포넌트-인스턴스 시스템을 AI가 직접 조작할 수 있다.
> `get_variables`, `set_variables`는 테마별 분기(`themeId`)와 그룹 필터(`group`)를 지원하도록 확장되었다.

### 4.4 도구 JSON Schema 예시

```typescript
const tools: ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "create_element",
      description: "캔버스에 새 요소를 생성합니다.",
      parameters: {
        type: "object",
        properties: {
          tag: {
            type: "string",
            description: "요소 타입",
            enum: [
              "Button",
              "TextField",
              "Select",
              "Table",
              "Card",
              "Checkbox",
              "Radio",
              "Switch",
              "Tabs",
              "Modal",
              "DatePicker",
              "ProgressBar",
              "Tooltip",
              "div",
              "span",
            ],
          },
          parentId: {
            type: "string",
            description: "부모 요소 ID. 없으면 body에 추가.",
          },
          props: {
            type: "object",
            description: "요소 속성 (children, variant, placeholder 등)",
          },
          styles: {
            type: "object",
            description: "CSS 스타일 (backgroundColor, padding, fontSize 등)",
          },
          dataBinding: {
            type: "object",
            description: "데이터 바인딩 설정",
            properties: {
              endpoint: {
                type: "string",
                description: "Mock API 엔드포인트 (/countries, /users 등)",
              },
            },
          },
        },
        required: ["tag"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_element",
      description: "기존 요소의 속성이나 스타일을 수정합니다.",
      parameters: {
        type: "object",
        properties: {
          elementId: {
            type: "string",
            description: '수정할 요소 ID. "selected"이면 현재 선택된 요소.',
          },
          props: { type: "object", description: "변경할 속성" },
          styles: { type: "object", description: "변경할 스타일" },
        },
        required: ["elementId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_element",
      description: "요소를 삭제합니다.",
      parameters: {
        type: "object",
        properties: {
          elementId: {
            type: "string",
            description: '삭제할 요소 ID. "selected"이면 현재 선택된 요소.',
          },
        },
        required: ["elementId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_editor_state",
      description:
        "현재 에디터 상태를 조회합니다. 페이지 구조, 요소 트리, 선택 상태 등.",
      parameters: {
        type: "object",
        properties: {
          includeStyles: {
            type: "boolean",
            description: "스타일 정보 포함 여부",
          },
          maxDepth: { type: "number", description: "트리 탐색 최대 깊이" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_selection",
      description: "현재 선택된 요소의 상세 정보를 조회합니다.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "search_elements",
      description: "조건에 맞는 요소를 검색합니다.",
      parameters: {
        type: "object",
        properties: {
          tag: { type: "string", description: "요소 타입으로 검색" },
          prop: { type: "string", description: "속성명으로 검색" },
          value: { type: "string", description: "속성값으로 검색" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "batch_design",
      description: "복수 요소를 일괄 생성/수정/삭제합니다.",
      parameters: {
        type: "object",
        properties: {
          operations: {
            type: "array",
            items: {
              type: "object",
              properties: {
                action: {
                  type: "string",
                  enum: ["create", "update", "delete"],
                },
                tag: { type: "string" },
                elementId: { type: "string" },
                parentId: { type: "string" },
                props: { type: "object" },
                styles: { type: "object" },
              },
              required: ["action"],
            },
          },
        },
        required: ["operations"],
      },
    },
  },
];
```

#### Phase 5+ 도구 스키마 (G.1/G.2/G.4 반영)

컴포넌트-인스턴스 시스템(G.1)과 변수 참조(G.2) 지원을 위한 추가 도구:

```typescript
// G.1: 컴포넌트-인스턴스 도구
{
  type: 'function',
  function: {
    name: 'create_component',
    description: '현재 요소를 재사용 가능한 Master 컴포넌트로 등록합니다.',
    parameters: {
      type: 'object',
      properties: {
        elementId: { type: 'string', description: 'Master로 등록할 요소 ID' },
        componentName: { type: 'string', description: '컴포넌트 이름' },
      },
      required: ['elementId', 'componentName'],
    },
  },
},
{
  type: 'function',
  function: {
    name: 'create_instance',
    description: 'Master 컴포넌트의 인스턴스를 생성하여 캔버스에 배치합니다.',
    parameters: {
      type: 'object',
      properties: {
        masterId: { type: 'string', description: 'Master 컴포넌트 ID' },
        parentId: { type: 'string', description: '부모 요소 ID' },
      },
      required: ['masterId'],
    },
  },
},
{
  type: 'function',
  function: {
    name: 'override_instance',
    description: '인스턴스의 속성을 오버라이드합니다. Master 원본에는 영향 없음.',
    parameters: {
      type: 'object',
      properties: {
        instanceId: { type: 'string', description: '인스턴스 요소 ID' },
        overrides: { type: 'object', description: '오버라이드할 속성' },
      },
      required: ['instanceId', 'overrides'],
    },
  },
},

// G.2: 변수 참조 확장
// 기존 get_variables, set_variables 도구에 테마별 분기 지원 추가:
{
  type: 'function',
  function: {
    name: 'get_variables',
    description: '디자인 변수 목록을 조회합니다. 테마별 값 포함.',
    parameters: {
      type: 'object',
      properties: {
        themeId: { type: 'string', description: '특정 테마의 값만 조회 (선택)' },
        group: { type: 'string', description: '변수 그룹으로 필터 (선택)' },
      },
    },
  },
},
{
  type: 'function',
  function: {
    name: 'set_variables',
    description: '디자인 변수를 설정하거나 수정합니다.',
    parameters: {
      type: 'object',
      properties: {
        variables: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string', description: '변수 이름 ($-- 접두사 없이)' },
              type: { type: 'string', enum: ['color', 'string', 'number'] },
              defaultValue: { description: '기본값' },
              themeOverrides: { type: 'object', description: '테마별 오버라이드 {테마명: 값}' },
            },
            required: ['name', 'type', 'defaultValue'],
          },
        },
      },
      required: ['variables'],
    },
  },
},
```

**batch_design 확장 (G.1 반영):**
기존 `batch_design` 도구의 `action` enum에 컴포넌트 작업 추가:

```typescript
action: {
  type: 'string',
  enum: [
    'create', 'update', 'delete',
    // Phase 5+ G.1 추가:
    'create_component', 'create_instance', 'override_instance', 'detach_instance',
  ],
}
```

---

## 5. 목표 파일 구조

```
apps/builder/src/
├── types/integrations/
│   ├── ai.types.ts              # ★ 재작성: AITool, AgentLoop, ToolCall 타입
│   └── chat.types.ts            # ★ 확장: ToolCallMessage, ToolResultMessage 추가
├── services/ai/
│   ├── GroqAgentService.ts      # ★ 신규: Tool Calling + Agent Loop 핵심 서비스
│   ├── tools/                   # ★ 신규: 도구 구현 디렉토리
│   │   ├── index.ts             # 도구 등록 레지스트리
│   │   ├── definitions.ts       # 도구 JSON Schema 정의
│   │   ├── createElement.ts     # create_element 구현
│   │   ├── updateElement.ts     # update_element 구현
│   │   ├── deleteElement.ts     # delete_element 구현
│   │   ├── getEditorState.ts    # get_editor_state 구현
│   │   ├── getSelection.ts      # get_selection 구현
│   │   ├── searchElements.ts    # search_elements 구현
│   │   └── batchDesign.ts       # batch_design 구현
│   ├── styleAdapter.ts          # ★ 신규: CSS-like → 내부 스키마 변환 레이어
│   ├── systemPrompt.ts          # ★ 신규: 시스템 프롬프트 관리
│   ├── GroqService.ts           # ⚠️ deprecated — IntentParser fallback 전용으로 유지
│   └── IntentParser.ts          # 유지 (최후 fallback)
├── builder/panels/ai/
│   ├── AIPanel.tsx              # ★ 재작성: Tool 실행 피드백, 중단 버튼
│   ├── AIPanel.css              # 스타일 업데이트
│   ├── components/              # ★ 신규: 패널 하위 컴포넌트
│   │   ├── ToolCallMessage.tsx  # Tool 호출 메시지 표시
│   │   ├── ToolResultMessage.tsx # Tool 결과 표시
│   │   └── AgentControls.tsx    # 중단/재시도 버튼
│   └── hooks/
│       └── useAgentLoop.ts      # ★ 신규: Agent loop React hook
└── builder/stores/
    └── conversation.ts          # ★ 확장: tool events, agent 상태
```

---

## 6. 핵심 구현 설계

### 6.1 Agent Loop (GroqAgentService)

```typescript
// services/ai/GroqAgentService.ts

class GroqAgentService {
  private client: Groq;
  private tools: ChatCompletionTool[];
  private toolExecutors: Map<string, ToolExecutor>;
  private abortController: AbortController | null = null;

  async *runAgentLoop(
    messages: ChatMessage[],
    context: BuilderContext,
  ): AsyncGenerator<AgentEvent> {
    this.abortController = new AbortController();
    const conversationMessages = this.buildMessages(messages, context);

    const MAX_TURNS = 10; // 무한 루프 방지
    let turn = 0;

    while (turn < MAX_TURNS) {
      if (this.abortController.signal.aborted) {
        yield { type: "aborted" };
        return;
      }

      turn++;

      // Groq API 호출 (streaming)
      const stream = await this.client.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages: conversationMessages,
        tools: this.tools,
        tool_choice: "auto",
        stream: true,
      });

      let assistantMessage = "";
      const toolCalls: ToolCall[] = [];

      // 스트리밍 처리
      for await (const chunk of stream) {
        if (this.abortController.signal.aborted) break;

        const delta = chunk.choices[0]?.delta;

        // 텍스트 스트리밍
        if (delta?.content) {
          assistantMessage += delta.content;
          yield { type: "text-delta", content: delta.content };
        }

        // Tool call 스트리밍
        if (delta?.tool_calls) {
          for (const tc of delta.tool_calls) {
            // tool call 조립
            if (tc.index !== undefined) {
              if (!toolCalls[tc.index]) {
                toolCalls[tc.index] = { id: tc.id, name: "", arguments: "" };
              }
              if (tc.function?.name)
                toolCalls[tc.index].name = tc.function.name;
              if (tc.function?.arguments)
                toolCalls[tc.index].arguments += tc.function.arguments;
            }
          }
        }
      }

      // Tool calls 없으면 → 최종 응답, 루프 종료
      if (toolCalls.length === 0) {
        yield { type: "final", content: assistantMessage };
        return;
      }

      // Assistant message를 대화에 추가
      conversationMessages.push({
        role: "assistant",
        content: assistantMessage || null,
        tool_calls: toolCalls.map((tc) => ({
          id: tc.id,
          type: "function",
          function: { name: tc.name, arguments: tc.arguments },
        })),
      });

      // 각 Tool 실행
      for (const tc of toolCalls) {
        yield { type: "tool-use-start", toolName: tc.name, toolCallId: tc.id };

        try {
          const args = JSON.parse(tc.arguments);
          const executor = this.toolExecutors.get(tc.name);

          if (!executor) throw new Error(`Unknown tool: ${tc.name}`);

          const result = await executor.execute(args);

          yield {
            type: "tool-result",
            toolName: tc.name,
            toolCallId: tc.id,
            result,
          };

          // Tool result를 대화에 추가
          conversationMessages.push({
            role: "tool",
            tool_call_id: tc.id,
            content: JSON.stringify(result),
          });
        } catch (error) {
          const errorMsg =
            error instanceof Error ? error.message : "Unknown error";
          yield {
            type: "tool-error",
            toolName: tc.name,
            toolCallId: tc.id,
            error: errorMsg,
          };

          conversationMessages.push({
            role: "tool",
            tool_call_id: tc.id,
            content: JSON.stringify({ error: errorMsg }),
          });
        }
      }

      // 다음 턴으로 (AI가 추가 도구 호출 또는 최종 응답)
    }

    yield { type: "max-turns-reached" };
  }

  stop(): void {
    this.abortController?.abort();
  }
}
```

### 6.2 Agent Event 타입

```typescript
// types/integrations/ai.types.ts

type AgentEvent =
  | { type: "text-delta"; content: string }
  | { type: "tool-use-start"; toolName: string; toolCallId: string }
  | {
      type: "tool-result";
      toolName: string;
      toolCallId: string;
      result: unknown;
    }
  | { type: "tool-error"; toolName: string; toolCallId: string; error: string }
  | { type: "final"; content: string }
  | { type: "aborted" }
  | { type: "max-turns-reached" };
```

### 6.3 메시지 타입 확장

```typescript
// types/integrations/chat.types.ts

export type MessageRole = "user" | "assistant" | "system" | "tool";

export type MessageStatus = "pending" | "streaming" | "complete" | "error";

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  status: MessageStatus;
  timestamp: number;
  metadata?: {
    toolCalls?: ToolCallInfo[]; // assistant 메시지에 포함된 tool calls
    toolCallId?: string; // tool 결과 메시지의 대응 ID
    toolName?: string; // tool 이름
    toolResult?: unknown; // tool 실행 결과
    error?: string;
  };
}

export interface ToolCallInfo {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  status: "pending" | "running" | "success" | "error";
  result?: unknown;
  error?: string;
}
```

### 6.4 Conversation Store 확장

```typescript
// builder/stores/conversation.ts

interface ConversationState {
  messages: ChatMessage[];
  isStreaming: boolean;
  isAgentRunning: boolean; // 에이전트 루프 실행 중
  currentTurn: number; // 현재 에이전트 턴
  activeToolCalls: ToolCallInfo[]; // 실행 중인 도구 호출
  currentContext: BuilderContext | null;

  // 기존 액션
  addUserMessage: (content: string) => void;
  addAssistantMessage: (content: string, toolCalls?: ToolCallInfo[]) => void;
  updateLastMessage: (content: string) => void;
  setStreamingStatus: (isStreaming: boolean) => void;
  updateContext: (context: BuilderContext) => void;
  clearConversation: () => void;

  // 신규 액션
  setAgentRunning: (running: boolean) => void;
  addToolMessage: (
    toolCallId: string,
    toolName: string,
    result: unknown,
  ) => void;
  updateToolCallStatus: (
    toolCallId: string,
    status: ToolCallInfo["status"],
    result?: unknown,
  ) => void;
  incrementTurn: () => void;
}
```

### 6.5 시스템 프롬프트

> ⚠️ 실제 구현과 차이 있음 — 코드 대조 검증 (2026-03-03) 기준으로 갱신

```typescript
// services/ai/systemPrompt.ts (실제 구현)

export function buildSystemPrompt(context: BuilderContext): string {
  const { currentPageId, selectedElementId, elements } = context;

  const selectedElement = selectedElementId
    ? elements.find((el) => el.id === selectedElementId)
    : null;

  return `당신은 composition 웹 빌더의 AI 디자인 어시스턴트입니다.
사용자의 자연어 요청을 분석하여 제공된 도구를 사용해 디자인 요소를 생성, 수정, 삭제합니다.

## 사용 가능한 컴포넌트
Button, TextField, Checkbox, Radio, ToggleButton, ToggleButtonGroup,
CheckboxGroup, RadioGroup, Select, ComboBox, Slider,
Tabs, Panel, Tree, Calendar, DatePicker, DateRangePicker,
Switch, Table, Card, TagGroup, ListBox, GridList,
Text, Div, Section, Nav

## 사용 가능한 Mock Data 엔드포인트
/countries, /cities, /timezones, /products, /categories,
/status, /priorities, /tags, /languages, /currencies,
/users, /departments, /projects, /component-tree

## 현재 빌더 상태
- 페이지 ID: ${currentPageId}
- 선택된 요소: ${selectedElement ? `${selectedElement.tag} (ID: ${selectedElementId})` : "없음"}
- 총 요소 수: ${elements.length}개
${
  selectedElement
    ? `
## 선택된 요소 정보
- 태그: ${selectedElement.tag}
- Props: ${JSON.stringify(selectedElement.props, null, 2)}
- 부모 ID: ${selectedElement.parent_id || "root"}
`
    : ""
}
## 규칙
1. 요소를 생성/수정하기 전에 get_editor_state나 get_selection으로 현재 상태를 파악하세요.
2. "현재 선택된 요소"를 수정할 때는 elementId에 "selected"를 사용하세요.
3. 스타일은 CSS 속성명을 camelCase로 사용하세요 (backgroundColor, fontSize 등).
4. 항상 한국어로 응답하세요.
5. 작업 완료 후 사용자에게 무엇을 했는지 간략히 설명하세요.`;
}
```

**설계 대비 실제 차이점:**
| 항목 | ADR 설계 | 실제 구현 |
|------|----------|----------|
| 컴포넌트 목록 | Modal, Dialog, TimeField, ColorPicker, Meter, Tooltip 포함 | ToggleButton, ToggleButtonGroup, Text, Div, Section, Nav 포함; Modal/Dialog 미포함 |
| 규칙 항목 | batch_design 사용 권장 포함 (6개 규칙) | batch_design 규칙 없음 (5개 규칙) |
| 현재 상태 | 정적 정보만 | 동적 컨텍스트 (페이지ID, 선택 요소 상세, 총 요소 수) 포함 |

#### Phase 5+ 확장 (G.1/G.2/G.4 반영)

시스템 프롬프트에 컴포넌트 라이브러리, 디자인 변수, 현재 테마 정보를 추가:

```typescript
export function buildSystemPrompt(context: EnhancedBuilderContext): string {
  let prompt = `... (기존 프롬프트) ...`;

  // G.1: 컴포넌트 라이브러리 컨텍스트
  if (context.masterComponents?.length) {
    prompt += `\n\n## 재사용 가능한 컴포넌트 (Master)
${context.masterComponents.map((m) => `- ${m.name} (${m.tag}, ${m.instanceCount} instances)`).join("\n")}

create_instance 도구를 사용하여 위 컴포넌트의 인스턴스를 배치할 수 있습니다.
override_instance로 인스턴스별 속성을 변경할 수 있습니다.`;
  }

  // G.2: 디자인 변수 컨텍스트
  if (context.designVariables?.length) {
    prompt += `\n\n## 디자인 변수
${context.designVariables.map((v) => `- $--${v.name} (${v.type}): ${v.defaultValue}`).join("\n")}

스타일 값에 "$--변수명" 형식으로 변수를 참조할 수 있습니다.
예: { backgroundColor: "$--primary", borderRadius: "$--radius-md" }`;
  }

  // G.4: 현재 테마 정보
  if (context.activeTheme) {
    prompt += `\n\n## 현재 활성 테마: ${context.activeTheme.name}`;
  }

  return prompt;
}
```

**EnhancedBuilderContext 확장 필드:**
| 필드 | 타입 | 출처 |
|------|------|------|
| `masterComponents` | `MasterComponentSummary[]` | elements store → componentIndex |
| `designVariables` | `DesignVariable[]` | themeStore → designVariables |
| `activeTheme` | `DesignTheme \| null` | themeStore → activeTheme |
| ~~`appliedKitIds`~~ | ~~`string[]`~~ | ~~designKitStore → appliedKitIds~~ — _[ADR-054 Superseded + ADR-115 (DesignKit 제거) 로 무효화]_ |

### 6.6 스타일 변환 레이어

> 렌더링 전환(CanvasKit)과의 독립성을 보장하는 핵심 레이어.
> AI 도구는 CSS-like 형식을 출력하고, 이 레이어가 내부 스키마로 변환한다.
> ⚠️ AI-A5a 구현됨: CSS 단위 정규화 (rem/em/vh/vw → px) 추가됨 (코드 대조 검증 2026-03-03)

```typescript
// services/ai/styleAdapter.ts (실제 구현 — AI-A5a 단위 정규화 포함)

/** CSS 크기 속성 목록 — 이 속성들만 단위 정규화 대상 */
const SIZE_PROPERTIES = new Set([
  "width",
  "height",
  "minWidth",
  "minHeight",
  "maxWidth",
  "maxHeight",
  "padding",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
  "margin",
  "marginTop",
  "marginRight",
  "marginBottom",
  "marginLeft",
  "gap",
  "rowGap",
  "columnGap",
  "top",
  "right",
  "bottom",
  "left",
  "fontSize",
  "lineHeight",
  "letterSpacing",
  "borderWidth",
  "borderRadius",
  "outlineWidth",
  "outlineOffset",
]);

/**
 * CSS 스타일을 내부 스타일 형식으로 변환.
 * AI-A5a: rem/em/vh/vw 등의 CSS 단위를 px 숫자로 정규화.
 * % 포함 값은 레이아웃 엔진이 처리하므로 그대로 유지.
 */
export function adaptStyles(cssStyles: Record<string, unknown>): {
  style: Record<string, unknown>;
} {
  const normalized: Record<string, unknown> = {};
  const ctx: CSSValueContext = {};

  for (const [key, value] of Object.entries(cssStyles)) {
    if (SIZE_PROPERTIES.has(key) && typeof value === "string") {
      // % 포함 값은 레이아웃 엔진이 처리 → 그대로 유지
      if (value.includes("%")) {
        normalized[key] = value;
        continue;
      }
      const px = resolveCSSSizeValue(value, ctx); // cssValueParser 사용
      normalized[key] = px !== undefined && px >= 0 ? px : value;
    } else {
      normalized[key] = value;
    }
  }
  return { style: normalized };
}

export function adaptPropsForElement(
  _tag: string,
  props: Record<string, unknown>,
  styles: Record<string, unknown>,
): Record<string, unknown> {
  if (Object.keys(styles).length === 0) {
    return props;
  }
  return {
    ...props,
    ...adaptStyles(styles),
  };
}
```

**현재 구현 상태 (2026-03-03 기준):**
| 기능 | 상태 |
|------|------|
| CSS-like → `props.style` 저장 | ✅ |
| rem/em/vh/vw → px 정규화 (AI-A5a) | ✅ 구현됨 |
| CanvasKit fills/effects/stroke 변환 | ⏸ 차단됨 (ENGINE_CHECKLIST RC-3 선행 필요) |
| $-- 변수 참조 지원 (Phase 5+) | ⏸ 미구현 |

#### Phase 5+ 확장 (G.2 변수 참조 지원)

AI 도구가 `$--` 접두사 변수 참조를 직접 사용할 수 있도록 어댑터 확장:

```typescript
// Phase 5+: $-- 변수 참조를 AI가 스타일 값으로 사용
// AI 출력 예시: { backgroundColor: "$--primary", borderRadius: "$--radius-md" }

export function adaptStyles(
  cssStyles: Record<string, unknown>,
): Record<string, unknown> {
  // $-- 변수 참조가 포함된 스타일 키 추출
  const variableBindings: string[] = [];

  for (const [key, value] of Object.entries(cssStyles)) {
    if (typeof value === "string" && value.startsWith("$--")) {
      variableBindings.push(value);
    }
  }

  return {
    style: cssStyles, // $-- 참조는 그대로 유지
    variableBindings, // useResolvedElement에서 resolve
  };
}
```

**변환 흐름:**

```
AI 도구 출력 → adaptStyles() → Element.props.style ($-- 유지)
                              → Element.variableBindings 자동 추출
                              → useResolvedElement → resolveElementVariables()
                              → 최종 렌더링 값
```

---

## 7. 렌더링 전환(WASM/CanvasKit)과의 영향 분석

> 참고: `docs/RENDERING_ARCHITECTURE.md` Phase 5-6

### 7.1 아키텍처 계층 관계

```
┌─────────────────────────────────────────────────┐
│  AI Layer (Groq Tool Calling + Agent Loop)       │ ← AI 전환 범위
│  ┌───────────────────────────────────────────┐   │
│  │  Tool Definitions                         │   │
│  │  (create_element, update_element, ...)     │   │
│  └──────────────┬────────────────────────────┘   │
└─────────────────┼────────────────────────────────┘
                  │  Element CRUD (Zustand Store)
                  │  ← ★ 접점: Element Data Model ★
┌─────────────────┼────────────────────────────────┐
│  Rendering Layer│                                 │ ← WASM 전환 범위
│  ┌──────────────▼────────────────────────────┐   │
│  │  CanvasKit renderSkia() / PixiJS render() │   │
│  └───────────────────────────────────────────┘   │
└─────────────────────────────────────────────────┘
```

AI는 **데이터 레이어**(요소 CRUD)를 조작하고, 렌더링은 **표현 레이어**(화면 출력)를 담당한다.
두 레이어의 다리는 **Element Data Model(Zustand store)** 이다.

### 7.2 영향 없음 (독립적)

| AI 전환 항목                    | 이유                          |
| ------------------------------- | ----------------------------- |
| Groq tool calling 아키텍처      | API 호출 패턴은 렌더링과 독립 |
| Agent loop 구현                 | AI 내부 루프                  |
| Conversation store 개선         | 채팅 상태 관리                |
| 대화 히스토리 전달              | 텍스트 데이터                 |
| IntentParser fallback           | 데이터 레이어                 |
| AIPanel UI 개선                 | React UI 영역                 |
| 에이전트 제어 (AbortController) | 제어 로직                     |

### 7.3 중간 영향 — Element 스키마 확장

Phase 5-6에서 렌더링 전환 시 요소의 스타일 모델이 확장된다:

| 현재 스키마                     | CanvasKit 전환 후                             | AI 도구 영향              |
| ------------------------------- | --------------------------------------------- | ------------------------- |
| `styles.backgroundColor: "red"` | `fills: [{ type: "color", rgba: [1,0,0,1] }]` | 스타일 어댑터 업데이트    |
| CSS 문자열 값                   | 6종 Fill Shader                               | 시스템 프롬프트 업데이트  |
| `styles.boxShadow` (문자열)     | `effects: [{ type: "drop-shadow", ... }]`     | 이펙트 도구 파라미터 변경 |
| 블렌드 모드 없음                | `blendMode: "multiply"` (18종)                | 신규 속성                 |
| Stroke 단순                     | 구조화된 stroke 객체                          | Stroke 도구 확장          |

**해결:** §6.6의 `styleAdapter.ts` 변환 레이어가 이 문제를 흡수한다.
AI 도구는 항상 CSS-like 형식을 출력하고, 렌더링 전환 시 변환 레이어만 업데이트하면 된다.

### 7.4 ~~낮은 영향~~ → ✅ 구현 완료 — AI 생성 시각 피드백

> **G.3 AI 시각 피드백 시스템이 CanvasKit 렌더 루프에 완전 통합됨** (2026-02-02)

Pencil의 렌더 루프에는 `renderGeneratingEffects()`가 존재한다 (§21.2):

```
render()
├── displayContentCanvas()          ← 디자인 노드 렌더링
├── renderGeneratingEffects()       ← AI 생성 이펙트 (블러+파티클)
├── renderFlashes()                 ← 시각 피드백 애니메이션
└── surface.flush()
```

~~이 기능은 **CanvasKit 렌더러 위에서 구현해야** 한다.~~
~~AI 전환 1단계에서는 React UI 수준 피드백만 구현하고, Phase 5-6 완료 후 캔버스 레벨 피드백을 추가한다.~~

#### Phase 5+ 변경사항 (G.3 AI 시각 피드백 반영)

G.3 AI 시각 피드백 시스템이 구현되어, CanvasKit 렌더 루프에 통합:

**구현 완료:**

- `aiVisualFeedback.ts` — 독립 Zustand 스토어 (generatingNodes, flashAnimations)
- `aiEffects.ts` — `renderGeneratingEffects()` (블러 + 회전 파티클), `renderFlashes()` (스트로크 + 스캔라인)
  - `buildNodeBoundsMap()`: 계층적 Skia 트리에서 부모 오프셋을 누적하여 절대 좌표 복원 (2026-02-02 수정)
- `SkiaOverlay.tsx` — Pencil 방식 2-pass(content/overlay 분리)에서 **overlay pass**로 AI 이펙트 렌더링

**렌더 루프 (Phase 5+):**

```
content pass (변경 시)
├── renderNode()                    ← 디자인 노드 → contentSurface 렌더링
└── contentSnapshot 캐시

present/overlay pass (매 프레임)
├── snapshot blit (camera-only: 아핀 변환)
├── renderGeneratingEffects()       ← AI 생성 중 (블러 + 파티클)
└── renderFlashes()                 ← AI 완료 후 (스트로크 + 스캔라인)
```

**AIPanel 연동:**

- 스트리밍 시작 전: `startGenerating([selectedElementId])`
- 완료: `completeGenerating(affectedIds)` → flash 전환
- 에러/취소: `cancelGenerating()`
- 개별 create/modify: `addFlashForNode(id, { scanLine: true })`

**이펙트 상세:**
| 이펙트 | 트리거 | 시각 표현 | 지속 |
|--------|--------|----------|------|
| Generating | AI 스트리밍 중 | 블러 오버레이 + 6개 파란 파티클 회전 (currentTime/2000) | 무기한 (AI 응답까지) |
| Flash | AI 작업 완료 | 스트로크 RRect + 스캔라인 (이즈-아웃 페이드) | 500ms (longHold: 2000ms) |

### 7.5 낮은 영향 — AI 컨텍스트 (스크린샷)

Pencil의 AI는 `get-screenshot`으로 뷰포트 캡처를 컨텍스트로 사용한다.

| 현재                                   | CanvasKit 전환 후                       |
| -------------------------------------- | --------------------------------------- |
| PixiJS `app.renderer.extract.canvas()` | CanvasKit `surface.makeImageSnapshot()` |

단, Groq의 llama 모델은 **이미지 입력을 지원하지 않으므로** 당장 불필요하다.
텍스트 기반 컨텍스트(요소 트리, 스타일 정보)가 우선이다.

### 7.6 영향 매트릭스

| 영향도            | AI 전환 항목                        | 렌더링 영향         | 대응 전략                     |
| ----------------- | ----------------------------------- | ------------------- | ----------------------------- |
| **없음**          | Tool calling, Agent loop, Store, UI | 독립적              | 선행 착수 가능                |
| **중간**          | AI 도구 스타일 출력                 | 스키마 확장 시 변경 | `styleAdapter.ts` 변환 레이어 |
| **낮음**          | AI 컨텍스트 (스크린샷)              | Export API 변경     | 텍스트 컨텍스트 우선          |
| ~~낮음~~ **완료** | AI 생성 시각 피드백                 | CanvasKit 기반      | ✅ G.3 구현 완료              |

### 7.7 결론

**렌더링 전환은 AI 전환에 블로킹 요소가 아니다.**
`styleAdapter.ts` 변환 레이어를 통해 두 작업이 완전히 분리된다.
AI 전환을 먼저 진행해도 무방하다.

---

## 8. 실행 로드맵

```
═══════════════════════════════════════════════════════════════
  AI 전환 (렌더링과 독립)
═══════════════════════════════════════════════════════════════

Phase A1: 기반 구조 구축 ✅ (2026-02-06 완료)
  └── types/integrations/ai.types.ts 재작성 (AgentEvent, ToolCall 타입)
  └── types/integrations/chat.types.ts 확장 (tool 메시지 타입)
  └── services/ai/tools/definitions.ts (도구 JSON Schema — 7개)
  └── services/ai/systemPrompt.ts (동적 시스템 프롬프트)
  └── services/ai/styleAdapter.ts (스타일 변환 레이어)

Phase A2: Agent 서비스 구현 ✅ (2026-02-06 완료)
  └── services/ai/GroqAgentService.ts (Tool Calling + Agent Loop + 429 지수 백오프)
  └── services/ai/tools/*.ts (7개 도구: CRUD 5개 + search + batch)
  └── builder/stores/conversation.ts 확장 (agent 상태, tool events)

Phase A3: UI 개선 ✅ (2026-02-06 완료)
  └── builder/panels/ai/AIPanel.tsx 재작성 (useAgentLoop hook 기반)
  └── builder/panels/ai/hooks/useAgentLoop.ts (G.3 피드백 연동)
  └── builder/panels/ai/components/ToolCallMessage.tsx
  └── builder/panels/ai/components/ToolResultMessage.tsx
  └── builder/panels/ai/components/AgentControls.tsx

Phase A4: 고급 기능 ✅ (2026-02-06 완료)
  └── batch_design 도구 구현 (최대 20개 작업, 실패 시 중단)
  └── search_elements 도구 구현 (tag/propName/propValue/styleProp 필터)
  └── Rate limit 대응 (429 지수 백오프, 3회 재시도)

Phase A5: 캔버스 통합 (Phase 5-6 이후)
  └── ✅ AI 생성 시각 피드백 (CanvasKit renderGeneratingEffects — G.3 완료, 2026-02-02)
  └── ✅ AI-A5a: styleAdapter.ts CSS 단위 정규화 (rem/em/vh/vw → px, resolveCSSSizeValue 사용, 2026-03-03)
  └── ⏸ styleAdapter.ts → CanvasKit fills/effects/stroke 스키마 변환 (차단됨: ENGINE_CHECKLIST RC-3 단위 정규화 선행 필요)
  └── ⏸ 스크린샷 기반 컨텍스트 (차단됨: 멀티모달 LLM 전환 — Groq Vision API 미지원 대기)
  └── 📋 get_style_guide, get_variables, set_variables 도구 (보류: 컴포넌트 인스턴스 시스템 Phase 5+ 선행 필요)

═══════════════════════════════════════════════════════════════
  렌더링 전환 (AI와 독립) — docs/RENDERING_ARCHITECTURE.md 참조
═══════════════════════════════════════════════════════════════

Phase 0: 벤치마크 → Phase 5: CanvasKit → Phase 6: 고급 렌더링

두 경로는 styleAdapter.ts 변환 레이어를 통해 독립적으로 진행 가능
═══════════════════════════════════════════════════════════════

═══════════════════════════════════════════════════════════════
  Phase B: AI 품질 강화 ("설계 지능" 구현)
  — Pencil AI 아키텍처 참조, §1.3 한계점 해결
═══════════════════════════════════════════════════════════════

Phase B1: 시스템 프롬프트 3-Layer 강화 (§9.1)
  └── Layer 1: Component Catalog (46+ 컴포넌트, 9카테고리, children 구조)
  └── Layer 2: Layout & Style Guide (flex/grid, spacing, variant/size 유효값)
  └── Layer 3: Data Binding Guide (40+ Mock 엔드포인트, DataTable 프리셋 18종)

Phase B2: create_composite 도구 + batch_design $bindAs (§9.2, §9.3)
  └── create_composite: 팩토리 정의 직접 호출 (Card, Tabs, Table 등)
  └── batch_design bindAs: 생성 ID를 후속 operation에서 참조

Phase B3: 레이아웃 템플릿 시스템 (§9.4)
  └── apply_layout 도구: dashboard-grid, form-layout, sidebar-content 등
  └── 시스템 프롬프트에 레이아웃 예시 포함

Phase B4: LLM 모델 전략 (§9.5) — Pencil AI 참조
  └── 단기: temperature/max_tokens 튜닝 + 프롬프트 강화
  └── 중기: Supabase Edge Function → Claude API 서버 프록시
  └── 장기: 멀티모델 (Pencil 방식 — Opus/Sonnet/Haiku 선택)

Phase B5: 도구 검증 & 자기 수정 (§9.6)
  └── validate_result 도구: 생성 후 구조/스타일 검증
  └── Plan → Execute → Verify 루프 (Pencil Agent Loop 참조)

Phase B6: API 키 보안 (§9.7)
  └── Supabase Edge Function 프록시 → dangerouslyAllowBrowser 제거

═══════════════════════════════════════════════════════════════
```

---

## 9. Phase B: AI 품질 강화 설계

> **목표:** Phase A의 "도구 호출 구조" 위에 "설계 지능"을 추가하여,
> "사용자 관리 대시보드 만들어줘" 수준의 요청을 처리할 수 있는 AI로 업그레이드.
> **참조:** Pencil AI 아키텍처 (§2) — 18종 IPC, 멀티모델, 풍부한 컨텍스트.

### 9.1 시스템 프롬프트 3-Layer 강화

> Phase A의 51줄 프롬프트 → Phase B에서 **Component Catalog + Layout Guide + Data Binding** 3계층으로 확장.
> Pencil AI가 `get-style-guide`, `get-variables` 등 풍부한 컨텍스트를 제공하는 것과 동일한 효과를
> **시스템 프롬프트 내장**으로 달성한다 (별도 도구 호출 없이 즉시 참조 가능).

#### Layer 1: Component Catalog (정적, 빌드 타임 생성 가능)

컴포넌트 패널에 등록된 전체 목록 + 카테고리 + children 구조 + 주요 Props:

```
## 사용 가능한 컴포넌트 (9개 카테고리)

### Layout (7개)
- Panel: 범용 컨테이너. variant: default | tab
- Card: 카드 컴포넌트. **반드시 create_composite 사용** (children: CardHeader→Heading + CardContent→Description).
  variant: default | primary | secondary | surface. size: xs | sm | md | lg | xl
- Tabs: 탭 컴포넌트. **반드시 create_composite 사용** (children: TabList→Tab×N + TabPanels→Panel×N).
  orientation: horizontal | vertical
- Breadcrumbs, Link, Separator, Nav

### Inputs (11개 — Form Controls)
- TextField: 텍스트 입력. type: text | email | password | search | tel | url. isRequired, isDisabled, placeholder
- NumberField: 숫자 입력. minValue, maxValue, step
- SearchField: 검색 입력
- Checkbox, CheckboxGroup, RadioGroup
- Select: 드롭다운 선택. **create_composite 권장** (children: SelectTrigger + SelectValue + SelectIcon)
- ComboBox: 자동완성 선택
- Switch, Slider, TailSwatch

### Actions (5개)
- Button: variant: default | primary | secondary | surface. size: xs | sm | md | lg | xl
- ToggleButton, ToggleButtonGroup, Menu, Toolbar

### Collections (6개 — 데이터 연동 가능)
- Table: 데이터 테이블. **create_composite 권장** + dataBinding 설정. selectionMode: single | multiple
- ListBox: 리스트. dataBinding 지원. selectionMode: single | multiple
- GridList: 그리드 리스트. dataBinding 지원
- Tree, TagGroup, Field

### Feedback (4개)
- ProgressBar: value, maxValue. Tooltip, Meter, Badge

### Date & Time (5개)
- Calendar: **create_composite** (CalendarHeader + CalendarGrid)
- DatePicker: **create_composite** (DateField + Calendar)
- DateRangePicker, DateField, TimeField

### Overlays (4개)
- Dialog, Modal, Popover, Tooltip

### Structure (3개 — 기본 요소)
- Text: 텍스트 블록. children으로 내용 설정
- Section: flex 컨테이너. display: flex, flexDirection, gap
- Div: 범용 컨테이너

### Other
- Form: 폼 래퍼
```

#### Layer 2: Layout & Style Guide (정적)

스타일 패널이 지원하는 레이아웃 시스템을 AI에 가이드:

```
## 레이아웃 규칙 (필수)

### 컨테이너 배치
- 여러 요소를 나열하려면 **부모 Section/Div에 flex 레이아웃** 설정
- 수직 나열: { display: 'flex', flexDirection: 'column', gap: 16 }
- 수평 나열: { display: 'flex', flexDirection: 'row', gap: 16 }
- 그리드 배치: { display: 'grid' } (고급)

### 정렬
- alignItems: 교차축 정렬 (flex-start | center | flex-end | stretch | baseline)
- justifyContent: 주축 정렬 (flex-start | center | flex-end | space-between | space-around | space-evenly)

### 크기
- width: '100%' (부모 채우기), 'fit-content' (내용 맞춤), px 수치
- height: 'auto' (내용에 맞춤, 기본), px 수치

### 간격
- gap: 요소 간 간격 (px 수치)
- padding: 내부 여백 (px 수치 또는 '16px 24px' 형태)

### variant & size (공통)
- variant: 'default' | 'primary' | 'secondary' | 'surface'
- size: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
- Button, Card, Badge, TextField, Select 등에 적용 가능

### 스타일 속성명
- CSS camelCase 사용: backgroundColor, fontSize, fontWeight, borderWidth, borderRadius
- 색상: CSS 색상값 사용 (hex, rgb, hsl, 색상명)
```

#### Layer 3: Data Binding Guide (정적)

데이터 패널과 연동하는 방법:

```
## 데이터 바인딩

### Mock 엔드포인트 (전체 목록)
/countries, /cities, /timezones, /products, /categories,
/status, /priorities, /tags, /languages, /currencies,
/users, /posts, /comments, /albums, /photos, /todos,
/organizations, /departments, /projects, /roles, /permissions,
/engines, /components, /audit-logs, /invitations, /project-memberships

### 데이터 연동 컴포넌트
Table, ListBox, GridList 등 Collections 카테고리 컴포넌트는 dataBinding을 지원합니다.
create_element 또는 create_composite의 dataBinding 파라미터에 endpoint를 지정하세요.

예시: { "endpoint": "/users" } → 사용자 목록 자동 연결
예시: { "endpoint": "/products" } → 상품 목록 자동 연결

### DataTable 프리셋 카테고리
- users-auth: Users, Roles, Permissions, Invitations
- organization: Organizations, Departments, Projects
- ecommerce: Products, Categories, Orders
- manufacturing: Engines, Components (BOM)
- system: AuditLogs, ProjectMemberships

### 규칙
- 대시보드/목록 화면 생성 시 **반드시** 적절한 Mock 엔드포인트를 연결하세요.
- Table 생성 시 create_composite + dataBinding을 함께 사용하세요.
```

#### 동적 컨텍스트 (기존 유지)

Layer 1~3은 **정적**이며 빌드 타임에 생성 가능. 기존의 동적 컨텍스트(페이지ID, 선택 요소, 총 요소 수)는 그대로 유지.

#### 프롬프트 규칙 확장 (5개 → 12개)

```
## 규칙
1. 요소를 생성/수정하기 전에 get_editor_state나 get_selection으로 현재 상태를 파악하세요.
2. "현재 선택된 요소"를 수정할 때는 elementId에 "selected"를 사용하세요.
3. 스타일은 CSS 속성명을 camelCase로 사용하세요.
4. 항상 한국어로 응답하세요.
5. 작업 완료 후 사용자에게 무엇을 했는지 간략히 설명하세요.
6. Card, Tabs, Table, Calendar, DatePicker 등 복합 컴포넌트는 반드시 create_composite를 사용하세요.
7. 여러 요소를 배치할 때 반드시 부모 Section/Div에 flex 레이아웃을 설정하세요.
8. 대시보드/목록 화면에는 적절한 Mock 데이터 엔드포인트를 연결하세요.
9. 여러 요소를 한 번에 생성할 때 batch_design을 사용하고, $bindAs로 부모-자식 관계를 설정하세요.
10. variant와 size는 유효한 값만 사용하세요 (variant: default|primary|secondary|surface, size: xs|sm|md|lg|xl).
11. 복잡한 요청은 먼저 계획을 세운 후 단계별로 실행하세요 (Plan → Execute → Verify).
12. 생성 후 get_editor_state로 결과를 확인하고, 문제가 있으면 update_element로 수정하세요.
```

### 9.2 create_composite 도구

> **Pencil의 batch-design이 insert/copy/update를 한 번에 처리하는 것처럼,**
> **composition의 팩토리 정의를 AI가 직접 호출하여 Compositional 구조를 일괄 생성.**

#### 목적

현재 `create_element`는 단일 요소만 생성 → Card, Tabs, Table 등 **복합 컴포넌트는 빈 껍데기**만 생성됨.
`create_composite`는 기존 팩토리 정의(`factories/definitions/`)를 래핑하여 children 포함 완전한 구조를 생성.

#### JSON Schema

```typescript
{
  type: 'function',
  function: {
    name: 'create_composite',
    description: '복합 컴포넌트를 팩토리 정의에 따라 children 포함 완전한 구조로 생성합니다. Card, Tabs, Table, Calendar, DatePicker 등에 사용하세요.',
    parameters: {
      type: 'object',
      properties: {
        tag: {
          type: 'string',
          description: '컴포넌트 태그',
          enum: ['Card', 'Tabs', 'Table', 'Calendar', 'DatePicker', 'DateRangePicker',
                 'Tree', 'Select', 'ComboBox', 'Slider', 'Menu', 'Breadcrumbs',
                 'TextField', 'NumberField', 'SearchField', 'CheckboxGroup', 'RadioGroup',
                 'Disclosure', 'DisclosureGroup'],
        },
        parentId: {
          type: 'string',
          description: '부모 요소 ID. 없으면 현재 선택 요소 또는 body',
        },
        props: {
          type: 'object',
          description: '루트 요소 props 오버라이드 (variant, size, title 등)',
        },
        styles: {
          type: 'object',
          description: '루트 요소 스타일 오버라이드',
        },
        dataBinding: {
          type: 'object',
          description: '데이터 바인딩 설정 (Table, ListBox 등)',
          properties: {
            endpoint: { type: 'string', description: 'Mock API 엔드포인트' },
          },
        },
      },
      required: ['tag'],
    },
  },
}
```

#### 구현 설계

```typescript
// services/ai/tools/createComposite.ts

export const createCompositeTool: ToolExecutor = {
  execute: async (args) => {
    const { tag, parentId, props, styles, dataBinding } = args;

    // 1. 팩토리 정의 조회 (factories/definitions/ 매핑)
    const factoryFn = COMPOSITE_FACTORY_MAP[tag];
    if (!factoryFn) {
      // 팩토리 없으면 단일 요소 생성으로 fallback
      return createElementTool.execute(args);
    }

    // 2. ComponentCreationContext 구성
    const context: ComponentCreationContext = {
      parentElement: parentId ? elementsMap.get(parentId) : getBody(),
      pageId: currentPageId,
      elements: getAllElements(),
      layoutId: null,
    };

    // 3. 팩토리 실행 → ComponentDefinition 반환
    const definition = factoryFn(context);

    // 4. props/styles 오버라이드 적용
    if (props) Object.assign(definition.parent.props, props);
    if (styles)
      Object.assign(
        definition.parent.props.style || {},
        adaptStyles(styles).style,
      );
    if (dataBinding?.endpoint) {
      definition.parent.dataBinding = {
        type: "collection",
        source: "api",
        config: { baseUrl: "MOCK_DATA", endpoint: dataBinding.endpoint },
      };
    }

    // 5. 재귀적 요소 생성 (parent → children → grandchildren)
    const createdIds = await createElementTree(definition);

    // 6. G.3 시각 피드백
    createdIds.forEach((id) => addFlashForNode(id, { scanLine: true }));

    return {
      success: true,
      data: {
        rootElementId: createdIds[0],
        tag,
        totalCreated: createdIds.length,
        structure: describeStructure(definition),
      },
      affectedElementIds: createdIds,
    };
  },
};

// 팩토리 매핑
const COMPOSITE_FACTORY_MAP: Record<string, FactoryFunction> = {
  Card: createCardDefinition,
  Tabs: createTabsDefinition,
  Table: createTableDefinition,
  Tree: createTreeDefinition,
  Calendar: createCalendarDefinition,
  DatePicker: createDatePickerDefinition,
  DateRangePicker: createDateRangePickerDefinition,
  Select: createSelectDefinition,
  ComboBox: createComboBoxDefinition,
  Slider: createSliderDefinition,
  Menu: createMenuDefinition,
  Breadcrumbs: createBreadcrumbsDefinition,
  TextField: createTextFieldDefinition,
  NumberField: createNumberFieldDefinition,
  SearchField: createSearchFieldDefinition,
  CheckboxGroup: createCheckboxGroupDefinition,
  RadioGroup: createRadioGroupDefinition,
  Disclosure: createDisclosureDefinition,
  DisclosureGroup: createDisclosureGroupDefinition,
};
```

### 9.3 batch_design 변수 참조 시스템 ($bindAs)

> **Pencil의 batch-design이 `insertedNodeId=I(parent, ...)` 바인딩을 지원하는 것처럼,**
> **composition의 batch_design에 `$bindAs` 변수 참조를 추가.**

#### 현재 문제

batch_design에서 첫 번째 create의 결과 ID를 두 번째 create의 parentId로 **참조 불가**.
→ AI가 컨테이너+자식 구조를 한 번의 batch로 만들 수 없음.

#### 해결: 임시 변수 바인딩

```typescript
// batch_design operations에 bindAs 필드 추가
{
  "operations": [
    { "action": "create", "args": { "tag": "Section", "styles": { "display": "flex", "flexDirection": "column", "gap": "16" } }, "bindAs": "$container" },
    { "action": "create", "args": { "tag": "Text", "parentId": "$container", "props": { "children": "사용자 관리" } } },
    { "action": "create_composite", "args": { "tag": "Table", "parentId": "$container", "dataBinding": { "endpoint": "/users" } } }
  ]
}
```

#### 구현

```typescript
// tools/batchDesign.ts 확장

async execute(args: { operations: BatchOperation[] }) {
  const bindings = new Map<string, string>();  // $name → elementId

  for (const op of operations) {
    // parentId에서 $ 참조 resolve
    if (op.args.parentId?.startsWith('$')) {
      const resolvedId = bindings.get(op.args.parentId);
      if (!resolvedId) {
        results.push({ error: `Unresolved binding: ${op.args.parentId}` });
        break;
      }
      op.args.parentId = resolvedId;
    }

    // 도구 실행
    const result = await executor.execute(op.args);

    // bindAs 등록
    if (op.bindAs && result.success) {
      const elementId = result.data.elementId || result.data.rootElementId;
      bindings.set(op.bindAs, elementId);
    }
  }
}
```

#### JSON Schema 확장

```typescript
// batch_design operations item에 추가
{
  bindAs: {
    type: 'string',
    description: '생성된 요소 ID를 변수에 저장. 후속 operation에서 $변수명으로 parentId 참조.',
  },
  action: {
    type: 'string',
    enum: ['create', 'update', 'delete', 'create_composite'],  // create_composite 추가
  },
}
```

### 9.4 레이아웃 템플릿 시스템

> **"대시보드 만들어줘" 수준의 요청에 대응하기 위한 사전 정의 레이아웃.**
> Pencil AI가 `get-style-guide`로 디자인 가이드를 참조하는 것과 유사하게,
> 레이아웃 템플릿을 시스템 프롬프트에 내장.

#### 템플릿 종류 (시스템 프롬프트 내장)

```
## 레이아웃 템플릿 (복합 화면 생성 시 참조)

### single-column (기본)
Section(display:flex, flexDirection:column, gap:16, padding:24)
  └── [요소들 수직 나열]

### two-column
Section(display:flex, flexDirection:row, gap:24, padding:24)
  ├── Section(flex:1, display:flex, flexDirection:column, gap:16)
  └── Section(flex:1, display:flex, flexDirection:column, gap:16)

### sidebar-content
Section(display:flex, flexDirection:row, gap:0)
  ├── Nav(width:240px, padding:16)
  └── Section(flex:1, display:flex, flexDirection:column, gap:16, padding:24)

### dashboard-grid
Section(display:flex, flexDirection:column, gap:24, padding:24)
  ├── Text("Dashboard Title", fontSize:24, fontWeight:bold)
  ├── Section(display:flex, flexDirection:row, gap:16)  ← stats row
  │   ├── Card(variant:primary, flex:1) ← KPI 1
  │   ├── Card(variant:secondary, flex:1) ← KPI 2
  │   └── Card(variant:surface, flex:1) ← KPI 3
  └── Table(dataBinding: /users or /products) ← 메인 데이터

### form-layout
Section(display:flex, flexDirection:column, gap:16, padding:24, maxWidth:480)
  ├── Text("Form Title", fontSize:20, fontWeight:bold)
  ├── TextField(label:"이름", isRequired:true)
  ├── TextField(label:"이메일", type:email)
  ├── Select(label:"역할")
  └── Button(variant:primary, children:"제출")

### list-detail
Section(display:flex, flexDirection:row, gap:16, padding:24)
  ├── ListBox(width:300, dataBinding: /users) ← 목록
  └── Card(flex:1) ← 상세 정보
```

#### apply_layout 도구 (선택사항 — 프롬프트 가이드로도 충분)

```typescript
{
  name: 'apply_layout',
  description: '사전 정의된 레이아웃 템플릿을 적용합니다.',
  parameters: {
    type: 'object',
    properties: {
      template: {
        type: 'string',
        enum: ['single-column', 'two-column', 'sidebar-content',
               'dashboard-grid', 'form-layout', 'list-detail'],
      },
      parentId: { type: 'string' },
      title: { type: 'string', description: '화면 제목' },
      dataEndpoint: { type: 'string', description: '메인 데이터 엔드포인트' },
    },
    required: ['template'],
  },
}
```

### 9.5 LLM 모델 전략

> **Pencil AI가 Opus/Sonnet/Haiku 멀티모델을 지원하는 것을 참고.**
> composition는 단기→중기→장기 3단계로 모델 품질을 개선.

#### 현재 상태

| 항목              | 값                                              |
| ----------------- | ----------------------------------------------- |
| 모델              | llama-3.3-70b-versatile (Groq 무료)             |
| API 호출          | 브라우저 직접 (`dangerouslyAllowBrowser: true`) |
| 비용              | $0                                              |
| Tool Calling 품질 | 낮음 (복잡한 파라미터에서 오류 빈번)            |
| Vision            | 미지원                                          |

#### 3단계 전략

**Phase B4-1: 단기 — 프롬프트 최적화 (비용 $0)**

| 변경            | 현재   | 목표              | 효과                               |
| --------------- | ------ | ----------------- | ---------------------------------- |
| temperature     | 0.7    | 0.3               | Tool Calling 정확도 향상           |
| max_tokens      | 2048   | 4096              | 복잡한 batch 응답 잘림 방지        |
| 시스템 프롬프트 | 51줄   | 300줄+ (3-Layer)  | 컴포넌트/레이아웃/데이터 지식 제공 |
| tool_choice     | 'auto' | 상황별 'required' | 도구 호출 보장 (디자인 요청 시)    |

**Phase B4-2: 중기 — 서버 프록시 + Claude API**

Pencil AI가 Claude를 사용하는 것처럼, 서버 프록시를 통해 Claude API 연동:

```
┌─────────────────┐     ┌─────────────────────┐     ┌──────────────┐
│  Builder Client  │ ──→ │  Supabase Edge Fn   │ ──→ │  Claude API  │
│  (브라우저)       │     │  (API 키 서버 보관)  │     │  (Sonnet)    │
└─────────────────┘     └─────────────────────┘     └──────────────┘
```

| 항목         | 설명                                         |
| ------------ | -------------------------------------------- |
| **구현**     | `supabase/functions/ai-proxy/` Edge Function |
| **인증**     | Supabase Auth JWT 검증                       |
| **API 키**   | 서버 환경변수 (브라우저 노출 없음)           |
| **모델**     | Claude 3.5 Sonnet (Tool Calling 최적)        |
| **비용**     | $3/$15 per MTok (사용량 기반)                |
| **스트리밍** | Server-Sent Events (SSE)                     |

```typescript
// GroqAgentService → AIAgentService로 추상화
interface AIAgentService {
  runAgentLoop(messages, context): AsyncGenerator<AgentEvent>;
  stop(): void;
}

class GroqAgentService implements AIAgentService {
  /* 기존 */
}
class ClaudeProxyService implements AIAgentService {
  // Supabase Edge Function 경유 Claude API 호출
  // 동일한 AgentEvent 인터페이스 반환
}
```

**Phase B4-3: 장기 — 멀티모델 선택 (Pencil 방식)**

Pencil AI처럼 사용자가 모델을 선택할 수 있는 UI:

| 모델          | 용도                             | 비용                 |
| ------------- | -------------------------------- | -------------------- |
| Claude Sonnet | 일반 디자인 요청 (기본)          | $3/$15 per MTok      |
| Claude Haiku  | 단순 수정, 빠른 응답             | $0.25/$1.25 per MTok |
| Claude Opus   | 복잡한 대시보드/전체 페이지 생성 | $15/$75 per MTok     |
| Groq llama    | 무료 fallback                    | $0                   |

```typescript
// AIPanel.tsx에 모델 선택기 추가
<ModelSelector
  options={[
    { id: 'sonnet', label: 'Sonnet', description: '일반 (권장)', default: true },
    { id: 'haiku', label: 'Haiku', description: '빠르고 저렴' },
    { id: 'opus', label: 'Opus', description: '복잡한 작업' },
    { id: 'groq', label: 'Groq (무료)', description: '기본 작업' },
  ]}
  onChange={(modelId) => setSelectedModel(modelId)}
/>
```

### 9.6 도구 검증 & 자기 수정 (Plan → Execute → Verify)

> **Pencil AI가 Agent Loop에서 자동으로 결과를 확인하고 수정하는 것처럼,**
> **composition AI도 생성 후 검증 → 수정 루프를 실행.**

#### 현재 문제

AI가 잘못된 props/styles를 설정해도 **검증 없이 통과** → 사용자에게 깨진 결과물 전달.

#### 해결: 3단계 루프

```
사용자 요청
    ↓
[Plan] AI가 작업 계획 수립 (시스템 프롬프트 규칙 11)
    ↓
[Execute] 도구 호출 (create_composite, batch_design 등)
    ↓
[Verify] get_editor_state로 결과 확인 (시스템 프롬프트 규칙 12)
    ↓ 문제 발견?
    ├── Yes → update_element로 수정 → Verify 반복 (최대 2회)
    └── No  → 최종 응답
```

#### validate_result 내부 도구 (AI가 자동 호출)

시스템 프롬프트에 검증 패턴을 포함하여 AI가 자발적으로 검증:

```
규칙 12. 생성 후 get_editor_state로 결과를 확인하고, 아래를 검증하세요:
  - 부모-자식 관계가 올바른지 (orphan 요소 없음)
  - flex 컨테이너에 display: flex가 설정되어 있는지
  - 데이터 바인딩이 올바르게 연결되어 있는지
  - variant/size 값이 유효한지
  문제가 있으면 update_element로 수정하세요.
```

#### Props 검증 레이어 (도구 내부)

```typescript
// services/ai/tools/validation.ts

/** 도구 실행 전 args 검증 */
export function validateCreateArgs(args: CreateElementArgs): ValidationResult {
  const errors: string[] = [];

  // tag 유효성
  if (!TAG_SPEC_MAP[args.tag] && !COMPOSITE_FACTORY_MAP[args.tag]) {
    errors.push(
      `Unknown tag: ${args.tag}. Available: ${Object.keys(TAG_SPEC_MAP).join(", ")}`,
    );
  }

  // variant 유효성
  if (args.props?.variant) {
    const validVariants = ["default", "primary", "secondary", "surface"];
    if (!validVariants.includes(args.props.variant)) {
      errors.push(
        `Invalid variant: ${args.props.variant}. Use: ${validVariants.join(", ")}`,
      );
    }
  }

  // size 유효성
  if (args.props?.size) {
    const validSizes = ["xs", "sm", "md", "lg", "xl"];
    if (!validSizes.includes(args.props.size)) {
      errors.push(
        `Invalid size: ${args.props.size}. Use: ${validSizes.join(", ")}`,
      );
    }
  }

  // parentId 존재 확인
  if (args.parentId && args.parentId !== "body") {
    const parent = elementsMap.get(args.parentId);
    if (!parent) {
      errors.push(`Parent element not found: ${args.parentId}`);
    }
  }

  return { valid: errors.length === 0, errors };
}
```

### 9.7 API 키 보안 — 서버 프록시

> Phase B4-2의 Supabase Edge Function 프록시가 이 문제를 해결.

#### 현재 문제

```typescript
// GroqAgentService.ts
new Groq({ apiKey, dangerouslyAllowBrowser: true });
// → API 키가 브라우저 DevTools에서 노출됨
```

#### 해결 설계

```typescript
// supabase/functions/ai-proxy/index.ts

import { serve } from "https://deno.land/std/http/server.ts";

serve(async (req) => {
  // 1. Supabase Auth JWT 검증
  const authHeader = req.headers.get("Authorization");
  const { user } = await supabase.auth.getUser(authHeader);
  if (!user) return new Response("Unauthorized", { status: 401 });

  // 2. Rate limiting (사용자별)
  const rateOk = await checkRateLimit(user.id);
  if (!rateOk) return new Response("Rate limited", { status: 429 });

  // 3. Claude API 호출 (서버 환경변수)
  const response = await anthropic.messages.create({
    model: req.body.model || "claude-sonnet-4-20250514",
    messages: req.body.messages,
    tools: req.body.tools,
    stream: true,
  });

  // 4. SSE 스트리밍 응답
  return new Response(response.toReadableStream(), {
    headers: { "Content-Type": "text/event-stream" },
  });
});
```

---

## 10. 재구성 대상 파일 요약

| 파일                                                 | 변경 내용                                                                | Phase | 상태 |
| ---------------------------------------------------- | ------------------------------------------------------------------------ | ----- | ---- |
| `types/integrations/ai.types.ts`                     | 확장: AgentEvent, ToolCall, ToolExecutor, AIAgentProvider 타입           | A1    | ✅   |
| `types/integrations/chat.types.ts`                   | 확장: tool role, ToolCallInfo, ConversationState agent 필드              | A1    | ✅   |
| `services/ai/tools/definitions.ts`                   | 신규: 7개 도구 JSON Schema 정의                                          | A1    | ✅   |
| `services/ai/systemPrompt.ts`                        | 신규: `buildSystemPrompt(context)` 동적 프롬프트                         | A1    | ✅   |
| `services/ai/styleAdapter.ts`                        | 신규: CSS-like → 내부 스키마 변환 (adaptStyles, adaptPropsForElement)    | A1    | ✅   |
| `services/ai/GroqAgentService.ts`                    | 신규: Tool Calling + Agent Loop + 429 지수 백오프                        | A2    | ✅   |
| `services/ai/tools/createElement.ts`                 | 신규: create_element 도구 (G.3 flash 연동)                               | A2    | ✅   |
| `services/ai/tools/updateElement.ts`                 | 신규: update_element 도구 (G.3 flash 연동)                               | A2    | ✅   |
| `services/ai/tools/deleteElement.ts`                 | 신규: delete_element 도구 (body 보호)                                    | A2    | ✅   |
| `services/ai/tools/getEditorState.ts`                | 신규: get_editor_state 도구 (트리 구조, childrenMap)                     | A2    | ✅   |
| `services/ai/tools/getSelection.ts`                  | 신규: get_selection 도구 (elementsMap)                                   | A2    | ✅   |
| `services/ai/tools/index.ts`                         | 신규: 도구 레지스트리 (7개 도구)                                         | A2    | ✅   |
| `services/ai/tools/searchElements.ts`                | 신규: search_elements 도구 (tag/prop/style 필터)                         | A4    | ✅   |
| `services/ai/tools/batchDesign.ts`                   | 신규: batch_design 도구 (일괄 create/update/delete)                      | A4    | ✅   |
| `services/ai/GroqService.ts`                         | deprecated: IntentParser fallback 전용으로 유지                          | A2    | ✅   |
| `services/ai/IntentParser.ts`                        | 유지 (최후 fallback)                                                     | -     | ✅   |
| `builder/stores/conversation.ts`                     | 확장: agent 상태, tool events, appendToLastMessage                       | A2    | ✅   |
| `builder/panels/ai/AIPanel.tsx`                      | 재작성: useAgentLoop hook 기반, Tool 피드백 UI                           | A3    | ✅   |
| `builder/panels/ai/hooks/useAgentLoop.ts`            | 신규: Agent Loop React hook (G.3 연동)                                   | A3    | ✅   |
| `builder/panels/ai/components/ToolCallMessage.tsx`   | 신규: 도구 호출 상태 표시                                                | A3    | ✅   |
| `builder/panels/ai/components/ToolResultMessage.tsx` | 신규: 도구 실행 결과 표시                                                | A3    | ✅   |
| `builder/panels/ai/components/AgentControls.tsx`     | 신규: 중단 버튼 + turn 카운터                                            | A3    | ✅   |
| `services/ai/systemPrompt.ts`                        | 확장: 3-Layer 프롬프트 (Component Catalog + Layout Guide + Data Binding) | B1    | 📋   |
| `services/ai/tools/definitions.ts`                   | 확장: create_composite, apply_layout 도구 스키마 추가                    | B2    | 📋   |
| `services/ai/tools/createComposite.ts`               | 신규: 팩토리 정의 래핑 복합 컴포넌트 생성 도구                           | B2    | 📋   |
| `services/ai/tools/batchDesign.ts`                   | 확장: $bindAs 변수 참조 시스템 추가                                      | B2    | 📋   |
| `services/ai/tools/applyLayout.ts`                   | 신규: 레이아웃 템플릿 적용 도구                                          | B3    | 📋   |
| `services/ai/tools/validation.ts`                    | 신규: Props/styles 검증 레이어                                           | B5    | 📋   |
| `services/ai/tools/index.ts`                         | 확장: 도구 레지스트리 (7 → 10+ 도구)                                     | B2    | 📋   |
| `services/ai/GroqAgentService.ts`                    | 변경: temperature 0.7→0.3, max_tokens 2048→4096                          | B4-1  | 📋   |
| `services/ai/AIAgentService.ts`                      | 신규: 추상 인터페이스 (GroqAgentService/ClaudeProxyService 공통)         | B4-2  | 📋   |
| `services/ai/ClaudeProxyService.ts`                  | 신규: Supabase Edge Function 경유 Claude API 호출                        | B4-2  | 📋   |
| `supabase/functions/ai-proxy/index.ts`               | 신규: Claude API 서버 프록시 (JWT 인증, Rate Limit)                      | B4-2  | 📋   |
| `builder/panels/ai/AIPanel.tsx`                      | 확장: 모델 선택기 UI                                                     | B4-3  | 📋   |
| `builder/panels/ai/components/ModelSelector.tsx`     | 신규: 멀티모델 선택 컴포넌트                                             | B4-3  | 📋   |

---

## 11. AI 도구 API 레퍼런스

> 도구 정의: `services/ai/tools/definitions.ts`
> 도구 레지스트리: `services/ai/tools/index.ts`

| 도구                | 파일                       | 주요 파라미터                             | Phase |
| ------------------- | -------------------------- | ----------------------------------------- | ----- |
| `create_element`    | `tools/createElement.ts`   | tag, parentId, props, styles              | A2    |
| `update_element`    | `tools/updateElement.ts`   | elementId, props?, styles?                | A2    |
| `delete_element`    | `tools/deleteElement.ts`   | elementId (body 보호)                     | A2    |
| `get_editor_state`  | `tools/getEditorState.ts`  | — (트리 구조 + childrenMap)               | A2    |
| `get_selection`     | `tools/getSelection.ts`    | — (elementsMap 기반)                      | A2    |
| `search_elements`   | `tools/searchElements.ts`  | tag?, propName?, propValue?, styleProp?   | A4    |
| `batch_design`      | `tools/batchDesign.ts`     | operations[] (최대 20개, $bindAs 참조)    | A4+B2 |
| `create_composite`  | `tools/createComposite.ts` | tag, parentId, props, styles, dataBinding | B2    |
| `apply_layout`      | `tools/applyLayout.ts`     | template, parentId, title, dataEndpoint   | B3    |
| `validate_elements` | `tools/validation.ts`      | elementIds[] (Props/styles 검증)          | B5    |

---

## 12. 참고 자료

- Pencil AI 분석: (삭제됨 — git history 참조)
- 렌더링 전환 계획: `docs/RENDERING_ARCHITECTURE.md` Phase 5-6
- Groq SDK 문서: https://console.groq.com/docs
- Groq Tool Use: https://console.groq.com/docs/tool-use

---

## 13. 코드 대조 검증 이력

### 2026-03-03 검증 (Implementer)

**검증 대상:** Phase A1~A5 전체 파일

**검증 결과 — 일치 확인:**

| 파일                                                 | 검증 결과                                                                        |
| ---------------------------------------------------- | -------------------------------------------------------------------------------- |
| `services/ai/GroqAgentService.ts`                    | ✅ 문서와 일치. MAX_TURNS=10, MAX_RETRIES=3, 지수 백오프 구현 확인               |
| `services/ai/tools/index.ts`                         | ✅ 7개 도구 레지스트리 정확히 일치                                               |
| `services/ai/tools/createElement.ts`                 | ✅ HierarchyManager.calculateNextOrderNum, G.3 flash 연동 확인                   |
| `services/ai/tools/batchDesign.ts`                   | ✅ 최대 20개, 실패 시 나머지 중단 구현 확인                                      |
| `services/ai/tools/getEditorState.ts`                | ✅ childrenMap 기반 트리 구조, pages 조회 확인                                   |
| `types/integrations/ai.types.ts`                     | ✅ AgentEvent, ToolCall, ToolExecutor, AIAgentProvider 구현 확인                 |
| `types/integrations/chat.types.ts`                   | ✅ appendToLastMessage 포함 ConversationState 확인                               |
| `builder/stores/conversation.ts`                     | ✅ agent 상태, tool events, appendToLastMessage 확인                             |
| `builder/stores/aiVisualFeedback.ts`                 | ✅ 독립 Zustand 스토어, 6가지 액션 (start/complete/cancel/addFlash/cleanup) 확인 |
| `builder/panels/ai/hooks/useAgentLoop.ts`            | ✅ G.3 연동, IntentParser fallback 확인                                          |
| `builder/panels/ai/AIPanel.tsx`                      | ✅ useAgentLoop 기반, ChatMessage/ChatInput/ChatContainer 내부 정의 확인         |
| `builder/panels/ai/components/ToolCallMessage.tsx`   | ✅ 7개 도구 라벨, 상태 아이콘(Loader2/Check/X) 확인                              |
| `builder/panels/ai/components/ToolResultMessage.tsx` | ✅ role='tool' 메시지 렌더링 확인                                                |
| `builder/panels/ai/components/AgentControls.tsx`     | ✅ currentTurn/10 표시, 중단 버튼 확인                                           |

**검증 결과 — 문서 오류 수정:**

| 항목                            | 수정 전                          | 수정 후                                                                            |
| ------------------------------- | -------------------------------- | ---------------------------------------------------------------------------------- |
| `systemPrompt.ts` 컴포넌트 목록 | Modal, Dialog, TimeField 등 포함 | ToggleButton, ToggleButtonGroup, Text, Div, Section, Nav 포함; Modal/Dialog 미포함 |
| `systemPrompt.ts` 규칙 수       | 6개 (batch_design 포함)          | 5개 (batch_design 규칙 없음)                                                       |
| `systemPrompt.ts` 컨텍스트      | 정적 정보만 기재                 | 동적 컨텍스트 (페이지ID, 선택 요소 상세, 총 요소 수) 포함으로 수정                 |
| `styleAdapter.ts` 구현          | 단순 pass-through로 기재         | AI-A5a CSS 단위 정규화(rem/em/vh/vw → px) 구현됨으로 수정                          |
| `AIPanel.tsx` ToolCallMessage   | 직접 import로 기재               | 실제로는 activeToolCalls 전용, role='tool' 시 ToolResultMessage 호출로 수정        |
| Phase A5 styleAdapter 항목      | `차단됨` 단일 항목               | AI-A5a(단위 정규화) ✅ 완료 + CanvasKit 스키마 변환 ⏸ 차단됨으로 분리              |

**파일 경로 정확성:** 문서에 기재된 모든 파일 경로가 실제 코드베이스와 일치함을 확인.
