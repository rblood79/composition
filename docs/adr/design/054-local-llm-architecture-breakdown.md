# ADR-054 구현 상세: 로컬 LLM 아키텍처

> ADR 본문: [054-local-llm-architecture.md](../completed/054-local-llm-architecture.md)

## Phase 구조

```
═══ 환경 셋업 ═══
Phase 0: Ollama + 로컬 모델 설치 및 검증

═══ LLM 인프라 ═══
Phase 1: LLM Provider 추상화 레이어 + Groq 완전 제거
Phase 2: Ollama Provider 구현 + 난이도 라우팅 (현재 개발 환경)
Phase 3: node-llama-cpp Provider 구현 (Electron 전환 후)
Phase 4: 모델 관리 + 선택 UI

═══ AI 기능 (인프라 위) ═══
Phase 5: 컴포넌트 지능 — 카탈로그 + 선택적 문서 주입 (목표 1)
Phase 6: 디자인 지능 — Plan→Execute→Verify 에이전트 + 도구 확장 (목표 2)
Phase 7: AI 지능 확장 — 접근성 감사 + 브랜드 테마
```

---

## 로컬 모델 권장사양 + 품질 평가 요약

### 폐쇄망 지원이 로컬 LLM 기본인 이유

인터넷을 사용할 수 없는 폐쇄망 환경에서도 빌더의 AI 기능이 동작해야 한다.
로컬 모델이 기본이고, 온라인 모델은 인터넷 사용 가능 시 선택적 업그레이드이다.

### 하드웨어 티어별 권장 모델

|  티어  | 하드웨어             | 권장 모델                  | GGUF 크기  |     속도      |   BFCL   |
| :----: | -------------------- | -------------------------- | :--------: | :-----------: | :------: |
|   T1   | 16GB MacBook Air     | Qwen3 14B Q4_K_M           |    9GB     |   ~18 tok/s   |   ~68%   |
| **T2** | **36GB MacBook Pro** | **Qwen3.5-35B-A3B Q4_K_M** | **18.5GB** | **~55 tok/s** | **~73%** |
|   T3   | 64GB MacBook Pro Max | Qwen3 32B Q5_K_M           |    25GB    |   ~25 tok/s   |  75.7%   |
|   T4   | 128GB Mac Studio     | Qwen3.5-122B-A10B Q4_K_M   |   ~70GB    |   ~50 tok/s   |  최상위  |

### 문서 주입(Tier 2) 보정 효과

컴포넌트별 React Aria/Spectrum md 문서를 컨텍스트에 주입하면,
props/events 설정은 "추론"이 아닌 "독해" 수준으로 전환된다.

| 작업 유형       | BFCL 기준 | 문서 주입 보정 | 이유                                              |
| --------------- | :-------: | :------------: | ------------------------------------------------- |
| 단일 prop/event | BFCL 점수 |  **+15~20%p**  | `onPress: (e: PressEvent) => void` 가 문서에 명시 |
| enum 값 선택    | BFCL 점수 |  **+12~18%p**  | `variant: 'primary' \| 'secondary'` 가 열거됨     |
| 다중 props 조합 | BFCL 점수 |  **+8~12%p**   | 각 prop은 참조, 조합은 추론                       |
| 복합 구조/Plan  | BFCL 점수 |   **+3~8%p**   | 구조적 추론은 문서만으로 부족                     |

### 합격률 요약 (문서 주입 보정 후, 중급 개발자 90% 기준)

|       티어       |   합격   |  근접   |  미달   | 합격률  |
| :--------------: | :------: | :-----: | :-----: | :-----: |
|     T1 (14B)     |   5개    |   5개   |   5개   |   33%   |
| **T2 (35B-A3B)** | **11개** | **3개** | **1개** | **73%** |
|     T3 (32B)     |   12개   |   2개   |   1개   |   80%   |
|  Cloud (Claude)  |   14개   |   0개   |   1개   |   93%   |

> 모든 티어에서 유일한 "미달" = **Plan 복합(대시보드 수준)** — 이는 모델 크기가 아닌 추론 깊이 한계.
> 난이도 라우팅으로 온라인 전환 제안 또는 작업 자동 분할로 대응.

### 로컬 모델 인터랙션 원칙: Step-by-Step

로컬 모델은 **한 번에 전체 완성**이 아닌 **단계별 지시에 정확히 응답하는 어시스턴트** 역할이다.

| 모드              | 인터랙션 패턴                                  | 적용                    |
| ----------------- | ---------------------------------------------- | ----------------------- |
| **로컬 (기본)**   | 사용자 주도 + AI 보조. 한 번에 1~2개 작업      | 폐쇄망, 프라이버시 중시 |
| **온라인 (선택)** | AI 주도 가능. "대시보드 만들어줘" 한 번에 처리 | 인터넷 가능 환경        |

**로컬 모드 UX 제약:**

1. **시스템 프롬프트 분기**: 로컬 모델일 때 "한 번에 하나의 작업에 집중하세요" 지시 추가
2. **Agent Loop MAX_TURNS 제한**: 로컬=5턴, 온라인=10턴. 로컬에서 과도한 멀티스텝 방지
3. **복합 요청 감지 시 가이드**: "이 요청을 단계별로 나눠서 진행할까요?" UI 안내
4. **자동 분할 (auto-split)**: 폐쇄망에서 복합 요청 시 단순 시퀀스로 자동 분해

```
로컬 모드 사용 예시:

사용자: "대시보드 만들어줘"
  ↓
AI: "단계별로 진행하겠습니다:
     1단계: 전체 레이아웃을 어떤 구조로 할까요?
     - dashboard-grid (상단 카드 + 하단 테이블)
     - sidebar-content (좌측 메뉴 + 우측 콘텐츠)
     - card-grid (카드 그리드)"
  ↓
사용자: "dashboard-grid로"
  ↓
AI: apply_layout(dashboard-grid) ✓
    "레이아웃 생성 완료. 상단 영역에 어떤 컴포넌트를 넣을까요?"
  ↓
사용자: "통계 카드 4개"
  ↓
AI: create_composite(Card) × 4 ✓
    "카드 4개 배치 완료. 하단 영역은요?"
  ↓
사용자: "사용자 데이터 테이블"
  ↓
AI: create_composite(Table, dataBinding: /users) ✓
```

> 개별 단계 성공률 T2: 88~92%. 사용자 가이드 + 단계 분리로 **전체 완성률이 단일 복합 요청(72%)보다 높음**.

### 난이도 기반 자동 라우팅

```typescript
// services/ai/routing/difficultyRouter.ts

type Difficulty = "simple" | "medium" | "complex";

function assessDifficulty(
  userMessage: string,
  context: BuilderContext,
): Difficulty {
  // 1. 언급된 컴포넌트 수
  const componentCount = countMentionedComponents(userMessage);
  // 2. 레이아웃 복잡도 키워드
  const hasLayoutKeywords =
    /대시보드|dashboard|페이지|전체|레이아웃|sidebar|grid/i.test(userMessage);
  // 3. 멀티스텝 지시어
  const hasMultiStep = /그리고|또한|추가로|다음에|and then|also/i.test(
    userMessage,
  );

  if (componentCount >= 5 || (hasLayoutKeywords && hasMultiStep))
    return "complex";
  if (componentCount >= 3 || hasLayoutKeywords) return "medium";
  return "simple";
}

async function routeRequest(
  difficulty: Difficulty,
  settings: AISettings,
  providers: LLMProvider[],
): Promise<{ provider: LLMProvider; model: string; strategy: string }> {
  const localProvider = providers.find(
    (p) => p.type === "local" && p.isAvailable(),
  );
  const cloudProvider = providers.find(
    (p) => p.type === "cloud" && p.isAvailable(),
  );

  switch (difficulty) {
    case "simple":
      // 로컬 모델 (T2 기준 90~96%)
      return {
        provider: localProvider!,
        model: settings.selectedModel,
        strategy: "local",
      };

    case "medium":
      // 로컬 모델 + thinking mode 강제 (T2 기준 85~92%)
      return {
        provider: localProvider!,
        model: settings.selectedModel,
        strategy: "local-think",
      };

    case "complex":
      if (cloudProvider) {
        // 온라인 모델 자동 제안
        // UI에서: "이 작업은 온라인 모델이 더 정확합니다. 전환할까요?"
        return {
          provider: cloudProvider,
          model: "claude-sonnet-4-6",
          strategy: "cloud-suggest",
        };
      }
      // 폐쇄망: 복합 작업을 단순 작업으로 자동 분할
      return {
        provider: localProvider!,
        model: settings.selectedModel,
        strategy: "auto-split",
      };
  }
}
```

**폐쇄망 auto-split 전략:**

```
사용자: "사용자 관리 대시보드를 만들어줘 — 통계 카드 4개 + 테이블"
  ↓
assessDifficulty → 'complex'
  ↓
cloudProvider 없음 (폐쇄망)
  ↓
auto-split: 복합 요청을 단순 요청 시퀀스로 분해
  1. "전체 레이아웃 컨테이너 생성" (simple → apply_layout)
  2. "통계 카드 1 생성" (simple → create_composite Card)
  3. "통계 카드 2 생성" (simple)
  4. "통계 카드 3 생성" (simple)
  5. "통계 카드 4 생성" (simple)
  6. "데이터 테이블 생성" (medium → create_composite Table + dataBinding)
  ↓
각 단계를 순차 실행 — 개별 성공률 T2: 88~92%
전체 성공률: 개별보다 낮지만 단일 복합 요청(72%)보다 높음
```

---

## Phase 0: Ollama + Qwen3 로컬 설치 및 검증

### 0-1. Ollama 설치

**macOS (Homebrew)**:

```bash
brew install ollama
```

**macOS (직접 설치)**:

```bash
curl -fsSL https://ollama.com/install.sh | sh
```

**확인**:

```bash
ollama --version
# ollama version is 0.x.x
```

### 0-2. Ollama 서버 시작

```bash
# 포그라운드 실행 (로그 확인용)
ollama serve

# 또는 백그라운드 서비스 (macOS — 설치 시 자동 등록됨)
brew services start ollama
```

기본 엔드포인트: `http://localhost:11434`

```bash
# 서버 상태 확인
curl http://localhost:11434/api/tags
# {"models":[]}  ← 빈 배열이면 정상 (아직 모델 없음)
```

### 0-3. 모델 다운로드 (하드웨어 티어별)

**T1 — 16GB RAM (최소)**:

```bash
ollama pull qwen3:14b
# ~9GB (Q4_K_M) — 16GB에서 실행 가능한 최대 모델
```

**T2 — 36GB RAM (권장)**:

```bash
ollama pull qwen3.5:35b-a3b
# ~18.5GB (Q4_K_M) — MoE 3B 활성, ~55 tok/s, 합격률 73%
```

**T3 — 64GB RAM (최적)**:

```bash
ollama pull qwen3:32b
# ~25GB (Q5_K_M) — BFCL 75.7% 오픈소스 1위, 합격률 80%
```

**코딩 특화 (선택)**:

```bash
ollama pull qwen3-coder:30b-a3b
# ~18.6GB — 코드 생성 특화, T2 이상
```

**다운로드 확인**:

```bash
ollama list
# NAME                  ID            SIZE      MODIFIED
# qwen3.5:35b-a3b       xxxxxxxxxxxx  18.5 GB   Just Now
```

> **7B 모델은 비권장**: tool calling ~55%로 AI 기능 합격률 0%. 14B 이상 필수.

### 0-4. Tool Calling 검증

Ollama + Qwen3 7B의 tool calling이 정상 동작하는지 확인.

```bash
curl http://localhost:11434/api/chat -d '{
  "model": "qwen3:7b",
  "messages": [
    {
      "role": "user",
      "content": "빨간 버튼을 만들어줘"
    }
  ],
  "tools": [
    {
      "type": "function",
      "function": {
        "name": "create_element",
        "description": "캔버스에 새 요소를 생성합니다",
        "parameters": {
          "type": "object",
          "properties": {
            "tag": { "type": "string", "description": "요소 타입" },
            "props": { "type": "object", "description": "요소 속성" },
            "styles": { "type": "object", "description": "CSS 스타일" }
          },
          "required": ["tag"]
        }
      }
    }
  ],
  "stream": false
}'
```

**기대 응답** (tool_calls 포함):

```json
{
  "message": {
    "role": "assistant",
    "content": "",
    "tool_calls": [
      {
        "function": {
          "name": "create_element",
          "arguments": {
            "tag": "Button",
            "props": { "children": "버튼" },
            "styles": { "backgroundColor": "red" }
          }
        }
      }
    ]
  }
}
```

> **실패 시**: `"tool_calls"` 없이 텍스트만 반환되면 모델이 tool calling을 지원하지 않는 버전.
> `ollama pull qwen3:7b` 재실행하여 최신 버전 확인.

### 0-5. Thinking Mode 검증

Qwen3의 thinking/non-thinking 모드 전환 확인:

```bash
# Thinking mode (복잡한 요청 — 내부 추론 후 응답)
curl http://localhost:11434/api/chat -d '{
  "model": "qwen3:7b",
  "messages": [
    {
      "role": "user",
      "content": "사용자 관리 대시보드를 설계해줘. 상단에 통계 카드 4개, 하단에 테이블이 필요해. /think"
    }
  ],
  "stream": false
}'

# Non-thinking mode (단순 요청 — 빠른 응답)
curl http://localhost:11434/api/chat -d '{
  "model": "qwen3:7b",
  "messages": [
    {
      "role": "user",
      "content": "이 버튼의 색을 파란색으로 바꿔줘 /no_think"
    }
  ],
  "stream": false
}'
```

### 0-6. 스트리밍 검증

```bash
# stream: true (기본) — NDJSON 스트리밍 응답
curl http://localhost:11434/api/chat -d '{
  "model": "qwen3:7b",
  "messages": [{"role": "user", "content": "안녕"}],
  "stream": true
}'
# {"message":{"role":"assistant","content":"안"},"done":false}
# {"message":{"role":"assistant","content":"녕"},"done":false}
# {"message":{"role":"assistant","content":"하세요"},"done":false}
# ...
# {"message":{"role":"assistant","content":""},"done":true,"total_duration":...}
```

### 0-7. 시스템 요구사항 체크리스트

| 항목   | T1 최소 (16GB)        | T2 권장 (36GB)               | T3 최적 (64GB)   | 확인 방법                            |
| ------ | --------------------- | ---------------------------- | ---------------- | ------------------------------------ |
| RAM    | 16GB                  | **36GB**                     | 64GB             | `sysctl hw.memsize` (macOS)          |
| 디스크 | 15GB 여유             | 25GB+ 여유                   | 35GB+ 여유       | `df -h`                              |
| GPU    | Apple Silicon (Metal) | M3/M4 Pro                    | M3/M4 Max        | `system_profiler SPDisplaysDataType` |
| Ollama | 0.6+                  | 최신                         | 최신             | `ollama --version`                   |
| 모델   | qwen3:14b (9GB)       | **qwen3.5:35b-a3b (18.5GB)** | qwen3:32b (25GB) | `ollama list`                        |
| 합격률 | 33% (5/15)            | **73% (11/15)**              | 80% (12/15)      | —                                    |

### 0-8. 환경 변수 설정 (composition 개발용)

```bash
# .env.local (apps/builder/)
# Phase 2 구현 전까지는 수동 테스트용

# Ollama 설정
VITE_LLM_PROVIDER=ollama
VITE_OLLAMA_BASE_URL=http://localhost:11434
VITE_OLLAMA_MODEL=qwen3:7b

# 온라인 모델 (선택 — 사용할 서비스만 설정)
VITE_ANTHROPIC_API_KEY=sk-ant-xxxxx
VITE_OPENAI_API_KEY=sk-xxxxx
```

### 0-9. 온라인 모델 API 키 발급

온라인 모델 사용 시 각 서비스에서 API 키를 발급받아야 한다.

**Anthropic (Claude)**:

1. https://console.anthropic.com/ 접속
2. Settings → API Keys → Create Key
3. `.env.local`에 `VITE_ANTHROPIC_API_KEY=sk-ant-xxxxx` 설정

**OpenAI (GPT)**:

1. https://platform.openai.com/api-keys 접속
2. Create new secret key
3. `.env.local`에 `VITE_OPENAI_API_KEY=sk-xxxxx` 설정

> **보안 주의**: 현재 웹앱 상태에서는 `VITE_` 환경 변수가 클라이언트 번들에 포함된다.
> 개발 환경에서만 사용하고, 프로덕션에서는 Phase 4의 보안 저장소를 사용할 것.
> Electron 전환 후에는 `safeStorage` API로 암호화 저장.

### 0-10. 트러블슈팅

**Ollama 서버가 안 뜸**:

```bash
# 포트 충돌 확인
lsof -i :11434
# 다른 포트로 시작
OLLAMA_HOST=0.0.0.0:11435 ollama serve
```

**모델 다운로드 실패**:

```bash
# 네트워크 프록시 환경
HTTPS_PROXY=http://proxy:8080 ollama pull qwen3:7b
```

**GPU 미사용 (CPU만 사용)**:

```bash
# Metal 지원 확인 (macOS)
ollama run qwen3:7b "test" --verbose 2>&1 | grep -i metal
# "metal" 출력 없으면 GPU 미감지 → Ollama 재설치
```

**응답이 너무 느림 (< 10 tok/s)**:

```bash
# 모델 양자화 확인 — Q4_K_M이 기본, Q8은 더 느림
ollama show qwen3:7b --modelfile | grep -i quant

# 더 작은 모델로 테스트
ollama pull qwen3:4b
```

**Tool calling 미동작 (텍스트만 반환)**:

```bash
# Ollama 버전 확인 — tool calling은 0.4+ 필요
ollama --version

# 모델이 tool calling 지원하는지 확인
ollama show qwen3:7b --modelfile
# tools 관련 설정이 있어야 함
```

---

## Phase 1: LLM Provider 추상화 레이어

### 목표

`groq-sdk` 및 관련 코드를 완전 제거하고, Ollama/node-llama-cpp를 위한 Provider 인터페이스를 도입한다.

### 핵심 인터페이스

```typescript
// services/ai/providers/types.ts

export interface LLMProvider {
  readonly name: string;
  readonly type: "local" | "cloud";

  /** Provider 연결 상태 확인 */
  isAvailable(): Promise<boolean>;

  /** 사용 가능한 모델 목록 조회 */
  listModels(): Promise<ModelInfo[]>;

  /** Chat completion + Tool Calling (스트리밍) */
  chat(params: ChatParams): AsyncGenerator<AgentEvent>;

  /** 연결 종료/정리 */
  dispose(): void;
}

export interface ModelInfo {
  id: string; // "qwen3:7b", "claude-sonnet-4-6", "gpt-4o" 등
  name: string; // 표시명
  provider: string; // "ollama", "llamacpp", "anthropic", "openai"
  type: "local" | "cloud";
  size?: number; // 바이트 (로컬 모델)
  parameterSize?: string; // "7B", "14B" 등
  quantization?: string; // "Q4_K_M" 등 (로컬 모델)
  contextWindow?: number; // 토큰 수
  capabilities: {
    toolCalling: boolean;
    vision: boolean;
    thinking: boolean; // extended thinking / Qwen3 /think
  };
}

export interface ChatParams {
  model: string; // 사용할 모델 ID (예: "qwen3:7b")
  messages: LLMMessage[];
  tools?: LLMTool[];
  toolChoice?: "auto" | "none" | "required";
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
}

export interface LLMMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  toolCalls?: LLMToolCall[];
  toolCallId?: string;
}

export interface LLMTool {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface LLMToolCall {
  id: string;
  function: {
    name: string;
    arguments: string;
  };
}
```

### 파일 변경표

| 파일                                      | 변경 | 설명                                                      |
| ----------------------------------------- | ---- | --------------------------------------------------------- |
| `services/ai/providers/types.ts`          | 신규 | LLMProvider 인터페이스 (local + cloud)                    |
| `services/ai/providers/index.ts`          | 신규 | Provider 레지스트리 + 팩토리                              |
| `services/ai/providers/anthropic.ts`      | 신규 | Claude API Provider (cloud)                               |
| `services/ai/providers/openai.ts`         | 신규 | OpenAI-compatible Provider (cloud)                        |
| `services/ai/AgentService.ts`             | 신규 | Provider-agnostic Agent Loop                              |
| `services/ai/GroqAgentService.ts`         | 삭제 | groq-sdk 의존 코드 완전 제거                              |
| `services/ai/GroqService.ts`              | 삭제 | deprecated 서비스 완전 제거                               |
| `builder/panels/ai/hooks/useAgentLoop.ts` | 수정 | AgentService 참조로 전환                                  |
| `types/integrations/ai.types.ts`          | 수정 | AgentEvent → LLM-agnostic으로 정리, Groq 타입 제거        |
| `package.json`                            | 수정 | `groq-sdk` 삭제, optional: `@anthropic-ai/sdk` + `openai` |

### Agent Loop 분리 패턴

```typescript
// services/ai/AgentService.ts

export class AgentService {
  private provider: LLMProvider;
  private toolExecutors: Map<string, ToolExecutor>;

  constructor(provider: LLMProvider, tools: Map<string, ToolExecutor>) {
    this.provider = provider;
    this.toolExecutors = tools;
  }

  async *runAgentLoop(
    messages: ChatMessage[],
    context: BuilderContext,
    signal?: AbortSignal,
  ): AsyncGenerator<AgentEvent> {
    const systemPrompt = buildSystemPrompt(context);
    const llmMessages = this.toLLMMessages(systemPrompt, messages);
    const llmTools = this.toLLMTools();

    const MAX_TURNS = 10;

    for (let turn = 0; turn < MAX_TURNS; turn++) {
      if (signal?.aborted) {
        yield { type: "aborted" };
        return;
      }

      const events = this.provider.chat({
        messages: llmMessages,
        tools: llmTools,
        toolChoice: "auto",
        temperature: 0.3,
        maxTokens: 4096,
        signal,
      });

      let assistantContent = "";
      const toolCalls: LLMToolCall[] = [];

      for await (const event of events) {
        if (event.type === "text-delta") {
          assistantContent += event.content;
          yield event;
        } else if (event.type === "tool-call") {
          toolCalls.push(event.toolCall);
          yield {
            type: "tool-use-start",
            toolName: event.toolCall.function.name,
            toolCallId: event.toolCall.id,
          };
        }
      }

      if (toolCalls.length === 0) {
        yield { type: "final", content: assistantContent };
        return;
      }

      // Tool 실행 + 결과 메시지 추가 (기존 패턴과 동일)
      llmMessages.push({
        role: "assistant",
        content: assistantContent || null,
        toolCalls,
      });

      for (const tc of toolCalls) {
        const result = await this.executeTool(tc);
        yield result.event;
        llmMessages.push({
          role: "tool",
          toolCallId: tc.id,
          content: JSON.stringify(result.data),
        });
      }
    }

    yield { type: "max-turns-reached" };
  }
}
```

---

## Phase 2: Ollama Provider 구현

### 전제 조건

- 사용자 로컬에 Ollama 설치 + `ollama pull qwen3:7b` 완료
- Ollama 서버 실행 중 (`localhost:11434`)

### Ollama Provider

```typescript
// services/ai/providers/ollama.ts

export class OllamaProvider implements LLMProvider {
  readonly name = "ollama";
  private baseUrl: string;

  constructor(options?: { baseUrl?: string }) {
    this.baseUrl = options?.baseUrl ?? "http://localhost:11434";
  }

  async isAvailable(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/api/tags`, {
        signal: AbortSignal.timeout(3000),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  async listModels(): Promise<ModelInfo[]> {
    const res = await fetch(`${this.baseUrl}/api/tags`);
    if (!res.ok) return [];
    const data = await res.json();

    return (data.models ?? []).map((m: OllamaModel) => ({
      id: m.name,
      name: m.name,
      size: m.size,
      parameterSize: m.details?.parameter_size,
      quantization: m.details?.quantization_level,
      capabilities: {
        toolCalling: isToolCallingModel(m.name),
        vision: m.details?.families?.includes("clip") ?? false,
        thinking: m.name.startsWith("qwen3"),
      },
    }));
  }

  async *chat(params: ChatParams): AsyncGenerator<AgentEvent> {
    const body = {
      model: params.model,
      messages: params.messages.map(toLlamaMessage),
      tools: params.tools,
      stream: true,
      options: {
        temperature: params.temperature ?? 0.3,
        num_predict: params.maxTokens ?? 4096,
      },
    };

    const res = await fetch(`${this.baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: params.signal,
    });

    if (!res.ok) throw new Error(`Ollama error: ${res.status}`);

    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.trim()) continue;
        const chunk = JSON.parse(line);

        if (chunk.message?.content) {
          yield { type: "text-delta", content: chunk.message.content };
        }

        if (chunk.message?.tool_calls) {
          for (const tc of chunk.message.tool_calls) {
            yield {
              type: "tool-call",
              toolCall: {
                id: tc.id ?? crypto.randomUUID(),
                function: {
                  name: tc.function.name,
                  arguments: JSON.stringify(tc.function.arguments),
                },
              },
            };
          }
        }
      }
    }
  }

  dispose(): void {
    /* no-op for HTTP client */
  }
}
```

### Cloud Providers (온라인 모델)

로컬 모델 외에 Anthropic Claude, OpenAI GPT 등 클라우드 모델도 선택할 수 있다.

#### SDK 의존성 전략

| 접근                                     | 장점                                         | 단점                               |
| ---------------------------------------- | -------------------------------------------- | ---------------------------------- |
| SDK 설치 (`@anthropic-ai/sdk`, `openai`) | 타입 안전, SSE 파싱 내장, tool_use 변환 자동 | 번들 크기 증가, 의존성 관리        |
| 직접 fetch (REST API)                    | 의존성 0, 번들 경량, 유연                    | SSE 파싱 직접 구현, 타입 수동 정의 |

**결정: SDK 사용**.

- Anthropic Messages API의 SSE 스트리밍 + tool_use content block 파싱이 복잡 → SDK가 이를 추상화
- OpenAI Chat Completions API의 delta.tool_calls 조립도 SDK가 처리
- `@anthropic-ai/sdk`, `openai` 모두 tree-shakeable → 실제 번들 영향 최소
- Electron 환경에서는 번들 크기 제약이 웹 대비 낮음

```bash
# 의존성 추가 (optional peer — 사용 시만 설치)
pnpm add @anthropic-ai/sdk   # Anthropic Claude
pnpm add openai               # OpenAI + OpenAI-compatible
```

> **참고**: 두 SDK 모두 optional dependency로 등록. 로컬 모델만 사용하는 환경에서는 설치 불필요.
> Provider 초기화 시 dynamic import로 로드하여, SDK 미설치 시 graceful fallback.

```typescript
// services/ai/providers/anthropic.ts

export class AnthropicProvider implements LLMProvider {
  readonly name = "anthropic";
  readonly type = "cloud" as const;
  private client: Anthropic | null = null;
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private async getClient(): Promise<Anthropic> {
    if (!this.client) {
      // dynamic import — SDK 미설치 시 에러를 isAvailable()에서 catch
      const { default: Anthropic } = await import("@anthropic-ai/sdk");
      this.client = new Anthropic({ apiKey: this.apiKey });
    }
    return this.client;
  }

  async isAvailable(): Promise<boolean> {
    if (!this.apiKey) return false;
    try {
      await this.getClient();
      return true;
    } catch {
      return false; // SDK 미설치
    }
  }

  async listModels(): Promise<ModelInfo[]> {
    return [
      {
        id: "claude-sonnet-4-6",
        name: "Claude Sonnet 4.6",
        provider: "anthropic",
        type: "cloud",
        contextWindow: 200_000,
        capabilities: { toolCalling: true, vision: true, thinking: true },
      },
      {
        id: "claude-haiku-4-5",
        name: "Claude Haiku 4.5",
        provider: "anthropic",
        type: "cloud",
        contextWindow: 200_000,
        capabilities: { toolCalling: true, vision: true, thinking: false },
      },
    ];
  }

  async *chat(params: ChatParams): AsyncGenerator<AgentEvent> {
    const client = await this.getClient();

    // SDK의 stream 메서드 사용 — SSE 파싱 + tool_use 변환 자동 처리
    const stream = client.messages.stream({
      model: params.model,
      max_tokens: params.maxTokens ?? 4096,
      messages: toAnthropicMessages(params.messages),
      tools: toAnthropicTools(params.tools),
    });

    for await (const event of stream) {
      if (event.type === "content_block_delta") {
        if (event.delta.type === "text_delta") {
          yield { type: "text-delta", content: event.delta.text };
        }
        if (event.delta.type === "input_json_delta") {
          // tool_use input 스트리밍 — 조립은 SDK가 처리
        }
      }
      if (event.type === "content_block_stop") {
        // tool_use 완료 시 AgentEvent로 변환
        const block = stream.currentMessage?.content[event.index];
        if (block?.type === "tool_use") {
          yield {
            type: "tool-call",
            toolCall: {
              id: block.id,
              function: {
                name: block.name,
                arguments: JSON.stringify(block.input),
              },
            },
          };
        }
      }
    }

    const finalMessage = await stream.finalMessage();
    const textContent = finalMessage.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("");
    if (textContent && finalMessage.stop_reason === "end_turn") {
      yield { type: "final", content: textContent };
    }
  }

  dispose(): void {
    this.client = null;
  }
}
```

```typescript
// services/ai/providers/openai.ts
import type OpenAI from "openai";

// OpenAI-compatible Provider — GPT, Together, Fireworks, local vLLM 등 호환
export class OpenAICompatibleProvider implements LLMProvider {
  readonly name: string;
  readonly type = "cloud" as const;
  private client: OpenAI | null = null;
  private apiKey: string;
  private baseUrl: string;
  private _models: ModelInfo[];

  constructor(config: {
    name: string;
    apiKey: string;
    baseUrl: string;
    models: ModelInfo[];
  }) {
    this.name = config.name;
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl;
    this._models = config.models;
  }

  private async getClient(): Promise<OpenAI> {
    if (!this.client) {
      const { default: OpenAI } = await import("openai");
      this.client = new OpenAI({
        apiKey: this.apiKey,
        baseURL: this.baseUrl,
        dangerouslyAllowBrowser: true, // Electron 전환 시 제거
      });
    }
    return this.client;
  }

  async isAvailable(): Promise<boolean> {
    if (!this.apiKey) return false;
    try {
      await this.getClient();
      return true;
    } catch {
      return false;
    }
  }

  async listModels(): Promise<ModelInfo[]> {
    return this._models;
  }

  async *chat(params: ChatParams): AsyncGenerator<AgentEvent> {
    const client = await this.getClient();

    // SDK의 stream 메서드 — delta.tool_calls 조립 자동 처리
    const stream = await client.chat.completions.create({
      model: params.model,
      messages: toOpenAIMessages(params.messages),
      tools: params.tools as OpenAI.ChatCompletionTool[],
      tool_choice: params.toolChoice ?? "auto",
      stream: true,
      max_tokens: params.maxTokens ?? 4096,
      temperature: params.temperature ?? 0.3,
    });

    let assistantContent = "";
    const toolCalls: Map<number, LLMToolCall> = new Map();

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta;

      if (delta?.content) {
        assistantContent += delta.content;
        yield { type: "text-delta", content: delta.content };
      }

      if (delta?.tool_calls) {
        for (const tc of delta.tool_calls) {
          if (!toolCalls.has(tc.index)) {
            toolCalls.set(tc.index, {
              id: tc.id ?? "",
              function: { name: "", arguments: "" },
            });
          }
          const existing = toolCalls.get(tc.index)!;
          if (tc.id) existing.id = tc.id;
          if (tc.function?.name) existing.function.name = tc.function.name;
          if (tc.function?.arguments)
            existing.function.arguments += tc.function.arguments;
        }
      }

      if (chunk.choices[0]?.finish_reason === "tool_calls") {
        for (const tc of toolCalls.values()) {
          yield { type: "tool-call", toolCall: tc };
        }
      }
      if (chunk.choices[0]?.finish_reason === "stop") {
        yield { type: "final", content: assistantContent };
      }
    }
  }

  dispose(): void {
    this.client = null;
  }
}

// 프리셋 팩토리
export function createOpenAIProvider(apiKey: string) {
  return new OpenAICompatibleProvider({
    name: "openai",
    apiKey,
    baseUrl: "https://api.openai.com/v1",
    models: [
      {
        id: "gpt-4o",
        name: "GPT-4o",
        provider: "openai",
        type: "cloud",
        contextWindow: 128_000,
        capabilities: { toolCalling: true, vision: true, thinking: false },
      },
      {
        id: "gpt-4o-mini",
        name: "GPT-4o mini",
        provider: "openai",
        type: "cloud",
        contextWindow: 128_000,
        capabilities: { toolCalling: true, vision: true, thinking: false },
      },
      {
        id: "o3-mini",
        name: "o3-mini",
        provider: "openai",
        type: "cloud",
        contextWindow: 200_000,
        capabilities: { toolCalling: true, vision: false, thinking: true },
      },
    ],
  });
}
```

> **OpenAI-compatible 패턴**: `baseUrl`만 바꾸면 Together AI, Fireworks, local vLLM 등도 동일 Provider로 연결 가능.

### 설정 UI — 모델 선택 (Pencil / Google Stitch 참조)

Pencil은 언어 + 모델 선택을 제공하고, Google Stitch도 모델 선택이 가능하다.
composition는 **로컬 모델 + 온라인 모델**을 통합 UI에서 선택할 수 있도록 한다.

```typescript
// builder/panels/ai/components/LLMSettings.tsx

interface LLMSettingsProps {
  // AIPanel 헤더 또는 설정 패널에서 렌더링
}

// UI 구성:
// ┌──────────────────────────────────────────────────────────┐
// │ AI 모델 설정                                              │
// │                                                           │
// │ ─── 로컬 모델 (Local) ──────────────────────────────────  │
// │ Ollama: http://localhost:11434              [● 연결됨]     │
// │ ┌────────────────────────────────────────────────────┐    │
// │ │ ● qwen3:7b         4.5GB   tool✓ think✓  128K     │    │
// │ │ ○ qwen3-coder:7b   4.5GB   tool✓ think✓  128K     │    │
// │ │ ○ llama3.2:8b      4.9GB   tool✓         128K     │    │
// │ └────────────────────────────────────────────────────┘    │
// │ [+ 모델 추가]  ← "ollama pull <name>" 안내                │
// │                                                           │
// │ ─── 온라인 모델 (Cloud) ────────────────────────────────  │
// │ ┌────────────────────────────────────────────────────┐    │
// │ │ ○ Claude Sonnet 4.6   Anthropic  tool✓ think✓ 200K│    │
// │ │ ○ Claude Haiku 4.5    Anthropic  tool✓        200K│    │
// │ │ ○ GPT-4o              OpenAI     tool✓ vision 128K│    │
// │ │ ○ GPT-4o mini         OpenAI     tool✓ vision 128K│    │
// │ │ ○ o3-mini             OpenAI     tool✓ think✓ 200K│    │
// │ └────────────────────────────────────────────────────┘    │
// │ API Keys: [Anthropic ✓ 설정됨]  [OpenAI ✗ 미설정]         │
// │           [+ API Key 추가]                                │
// │                                                           │
// │ 선택됨: qwen3:7b (로컬, Q4_K_M, 4.5GB)                   │
// └──────────────────────────────────────────────────────────┘

// 로컬: provider.listModels()로 동적 조회
// 온라인: 등록된 cloud provider에서 모델 목록 병합
// API 키 미설정 provider의 모델은 비활성 표시 + "API Key 필요" 안내
// tool calling 미지원 모델은 ⚠️ 경고 + 선택은 허용
```

```typescript
// builder/stores/aiSettings.ts

interface AISettings {
  // 선택된 모델 (provider + model 조합)
  selectedProvider: string; // "ollama", "llamacpp", "anthropic", "openai"
  selectedModel: string; // "qwen3:7b", "claude-sonnet-4-6", "gpt-4o"

  // Provider별 설정
  ollama: {
    baseUrl: string; // default: "http://localhost:11434"
  };
  apiKeys: {
    anthropic?: string; // Anthropic API key
    openai?: string; // OpenAI API key
  };
  // 커스텀 OpenAI-compatible 엔드포인트 (Together, Fireworks, vLLM 등)
  customEndpoints: Array<{
    name: string;
    baseUrl: string;
    apiKey: string;
    models: ModelInfo[];
  }>;

  // 모델별 파라미터
  modelParams: {
    temperature: number; // default: 0.3
    maxTokens: number; // default: 4096
    thinkingMode: "auto" | "always" | "never"; // Qwen3/Claude 전용
  };
}
```

### 파일 변경표

| 파일                                           | 변경 | 설명                                      |
| ---------------------------------------------- | ---- | ----------------------------------------- |
| `services/ai/providers/ollama.ts`              | 신규 | Ollama REST API Provider                  |
| `services/ai/providers/index.ts`               | 수정 | Ollama Provider 등록                      |
| `builder/panels/ai/components/LLMSettings.tsx` | 신규 | Provider 설정 UI                          |
| `builder/stores/aiSettings.ts`                 | 신규 | Provider 설정 상태 (Zustand)              |
| `package.json`                                 | 수정 | `groq-sdk` 삭제 확인 (Phase 1에서 제거됨) |

---

## Phase 3: node-llama-cpp Provider 구현 (Electron 전환 후)

### 아키텍처

```
┌─────────────────────────────────────────────┐
│           Main Process                       │
│  ├── LLM Utility Process Manager             │
│  │   └── utilityProcess.fork('llm-worker')   │
│  └── IPC Bridge (MessagePort)                │
├──────────────── IPC ─────────────────────────┤
│         Utility Process (llm-worker)         │
│  ├── node-llama-cpp                          │
│  │   ├── LlamaModel (GGUF)                  │
│  │   ├── LlamaChatSession                    │
│  │   └── Tool Calling (JSON Schema)          │
│  └── GPU 가속 (Metal / CUDA / Vulkan)        │
├──────────────── IPC ─────────────────────────┤
│          Renderer Process                    │
│  ├── AgentService (LLMProvider 인터페이스)    │
│  └── AI Panel UI                             │
└─────────────────────────────────────────────┘
```

### Utility Process Worker

```typescript
// electron/workers/llm-worker.ts

import { getLlama, LlamaChatSession } from "node-llama-cpp";

let session: LlamaChatSession | null = null;

process.parentPort?.on("message", async ({ data }) => {
  switch (data.type) {
    case "init": {
      const llama = await getLlama();
      const model = await llama.loadModel({ modelPath: data.modelPath });
      const context = await model.createContext();
      session = new LlamaChatSession({
        contextSequence: context.getSequence(),
      });
      process.parentPort?.postMessage({ type: "ready" });
      break;
    }

    case "chat": {
      if (!session) throw new Error("Model not initialized");

      const response = await session.prompt(data.prompt, {
        functions: data.tools, // node-llama-cpp 내장 tool calling
        onTextChunk: (text) => {
          process.parentPort?.postMessage({
            type: "text-delta",
            content: text,
          });
        },
        signal: data.signal,
      });

      process.parentPort?.postMessage({ type: "final", content: response });
      break;
    }

    case "dispose": {
      session = null;
      process.parentPort?.postMessage({ type: "disposed" });
      break;
    }
  }
});
```

### LlamaCpp Provider (Renderer → Main → Utility)

```typescript
// services/ai/providers/llamacpp.ts (Electron Renderer)

export class LlamaCppProvider implements LLMProvider {
  readonly name = "llamacpp";

  async isAvailable(): Promise<boolean> {
    return window.electronAPI?.llm.isReady() ?? false;
  }

  async listModels(): Promise<ModelInfo[]> {
    // Electron Main Process가 모델 디렉토리를 스캔하여 GGUF 파일 목록 반환
    return window.electronAPI?.llm.listModels() ?? [];
  }

  async *chat(params: ChatParams): AsyncGenerator<AgentEvent> {
    // IPC를 통해 Utility Process에 요청
    const channel = await window.electronAPI.llm.chat({
      model: params.model,
      messages: params.messages,
      tools: params.tools,
      temperature: params.temperature,
      maxTokens: params.maxTokens,
    });

    // MessagePort 스트리밍 수신
    for await (const event of channel) {
      yield event;
    }
  }

  dispose(): void {
    window.electronAPI?.llm.dispose();
  }
}
```

### 파일 변경표

| 파일                                | 변경 | 설명                          |
| ----------------------------------- | ---- | ----------------------------- |
| `electron/workers/llm-worker.ts`    | 신규 | Utility Process LLM 워커      |
| `electron/llm-manager.ts`           | 신규 | Utility Process 생명주기 관리 |
| `services/ai/providers/llamacpp.ts` | 신규 | IPC 기반 LlamaCpp Provider    |
| `electron/preload.ts`               | 수정 | `window.electronAPI.llm` 노출 |
| `package.json`                      | 수정 | `node-llama-cpp` 의존성 추가  |

---

## Phase 4: 모델 관리 + 선택 UI

### 모델 선택 워크플로

```
사용자가 AI Panel 열기
  ↓
모든 등록된 provider에서 listModels() 병렬 호출
  ↓
┌─ 로컬 모델 ─────────────────────────────────┐
│ [●] qwen3:7b         Ollama  tool✓ think✓   │
│ [ ] qwen3-coder:7b   Ollama  tool✓ think✓   │
│ [ ] llama3.2:8b      Ollama  tool✓          │
├─ 온라인 모델 ────────────────────────────────┤
│ [ ] Claude Sonnet 4.6  Anthropic  tool✓ 200K│
│ [ ] GPT-4o             OpenAI     tool✓ 128K│
│ [ ] (OpenAI 미설정 — API Key 필요)      🔒  │
└──────────────────────────────────────────────┘
  ↓
선택 → aiSettings.selectedProvider + selectedModel 저장
  ↓
다음 chat 요청부터 해당 provider + 모델 사용
```

### 로컬 모델 관리

**Ollama (Phase 2)**:

- `provider.listModels()` → `/api/tags` 조회 → 설치된 모델 동적 목록
- 모델 추가: "모델 추가하기" → 터미널에서 `ollama pull <name>` 실행 안내
- 권장 프리셋: qwen3:7b (기본), qwen3-coder:7b (코딩), llama3.2:8b (영어 특화)

**Electron + node-llama-cpp (Phase 3)**:

- `provider.listModels()` → 모델 디렉토리 GGUF 파일 스캔
- 앱 번들에 기본 GGUF 모델 포함 또는 첫 실행 시 다운로드
- 모델 추가: 파일 브라우저로 GGUF 선택 또는 URL 다운로드
- GPU 가속 상태 + 메모리 사용량 표시

### 온라인 모델 관리 + API 키 보안

#### API 키 입력 UI

```
설정 UI → 온라인 모델 섹션:

┌─ API Keys ──────────────────────────────────────┐
│                                                  │
│ Anthropic (Claude)                               │
│ ┌──────────────────────────────┐                 │
│ │ sk-ant-••••••••••••••xxxx    │ [표시] [삭제]   │
│ └──────────────────────────────┘                 │
│ 상태: ✓ 유효 (잔액 확인됨)                        │
│                                                  │
│ OpenAI                                           │
│ ┌──────────────────────────────┐                 │
│ │ API Key를 입력하세요          │ [저장]          │
│ └──────────────────────────────┘                 │
│ 상태: 미설정                                      │
│                                                  │
│ [+ 커스텀 엔드포인트 추가]                         │
│   (Together AI, Fireworks, vLLM 등)              │
└──────────────────────────────────────────────────┘
```

#### API 키 저장 전략 (환경별)

| 환경               | 저장소                        | 보안 수준 | 비고                         |
| ------------------ | ----------------------------- | :-------: | ---------------------------- |
| 개발 (Vite 웹앱)   | `.env.local` (`VITE_*`)       |   낮음    | 번들에 포함됨 — 개발 전용    |
| 개발 (런타임 입력) | 메모리 (Zustand)              |   중간    | 새로고침 시 소실, XSS에 안전 |
| Electron           | `safeStorage` API             |   높음    | OS 키체인으로 암호화 저장    |
| 프로덕션 (웹)      | Supabase Edge Function 프록시 |   높음    | 키가 서버에만 존재           |

```typescript
// services/ai/keyStorage.ts

export interface KeyStorage {
  get(provider: string): Promise<string | null>;
  set(provider: string, key: string): Promise<void>;
  delete(provider: string): Promise<void>;
}

// 개발 환경: 메모리 + env fallback
class MemoryKeyStorage implements KeyStorage {
  private keys = new Map<string, string>();

  async get(provider: string): Promise<string | null> {
    // 1. 런타임 입력값 우선
    if (this.keys.has(provider)) return this.keys.get(provider)!;
    // 2. env fallback (개발 전용)
    const envKey = import.meta.env[`VITE_${provider.toUpperCase()}_API_KEY`];
    return envKey ?? null;
  }

  async set(provider: string, key: string): Promise<void> {
    this.keys.set(provider, key);
  }

  async delete(provider: string): Promise<void> {
    this.keys.delete(provider);
  }
}

// Electron 환경: safeStorage (OS 키체인 암호화)
class ElectronKeyStorage implements KeyStorage {
  async get(provider: string): Promise<string | null> {
    return window.electronAPI?.keyStorage.get(provider) ?? null;
  }

  async set(provider: string, key: string): Promise<void> {
    await window.electronAPI?.keyStorage.set(provider, key);
  }

  async delete(provider: string): Promise<void> {
    await window.electronAPI?.keyStorage.delete(provider);
  }
}

export function createKeyStorage(): KeyStorage {
  if (window.electronAPI?.keyStorage) return new ElectronKeyStorage();
  return new MemoryKeyStorage();
}
```

```typescript
// electron/preload.ts (Electron 환경)

contextBridge.exposeInMainWorld("electronAPI", {
  keyStorage: {
    get: (provider: string) => ipcRenderer.invoke("key-storage:get", provider),
    set: (provider: string, key: string) =>
      ipcRenderer.invoke("key-storage:set", provider, key),
    delete: (provider: string) =>
      ipcRenderer.invoke("key-storage:delete", provider),
  },
  // ...
});

// electron/main.ts
import { safeStorage } from "electron";
import Store from "electron-store";

const store = new Store({ encryptionKey: "composition-ai" });

ipcMain.handle("key-storage:get", (_, provider: string) => {
  const encrypted = store.get(`apiKeys.${provider}`) as Buffer | undefined;
  if (!encrypted) return null;
  return safeStorage.decryptString(Buffer.from(encrypted));
});

ipcMain.handle("key-storage:set", (_, provider: string, key: string) => {
  const encrypted = safeStorage.encryptString(key);
  store.set(`apiKeys.${provider}`, encrypted.toJSON());
});

ipcMain.handle("key-storage:delete", (_, provider: string) => {
  store.delete(`apiKeys.${provider}`);
});
```

#### API 키 검증 흐름

```
사용자가 API 키 입력 → [저장]
  ↓
keyStorage.set(provider, key)
  ↓
provider.isAvailable() 호출 (SDK 초기화 + 간단한 API 호출로 검증)
  ↓
성공: "✓ 유효" 표시, 해당 provider 모델 활성화
실패: "✗ 유효하지 않은 키" 에러, 모델 비활성 유지
```

- API Key 미설정 provider는 모델 목록에 🔒 비활성 표시 + "API Key 설정" 링크
- 커스텀 엔드포인트 추가 가능 (OpenAI-compatible: Together, Fireworks, vLLM 등)

### 호환성 매트릭스

**로컬 모델 (Ollama / node-llama-cpp)**:

| 모델           | Tool Calling | Thinking | 한국어 | 비용 | 권장 용도                      |
| -------------- | :----------: | :------: | :----: | :--: | ------------------------------ |
| qwen3:7b       |      ✓       |    ✓     |   ◎    | 무료 | 기본 — 디자인 대화 + 도구 호출 |
| qwen3-coder:7b |      ✓       |    ✓     |   ○    | 무료 | 복잡한 도구 로직, 코드 생성    |
| qwen3:14b      |      ✓       |    ✓     |   ◎    | 무료 | 고품질 추론 (RAM 16GB+ 권장)   |
| llama3.2:8b    |      ✓       |    ✗     |   △    | 무료 | 영어 환경, 빠른 응답           |
| mistral:7b     |      ✓       |    ✗     |   △    | 무료 | 영어 환경, 코드 보조           |

**온라인 모델 (Cloud API)**:

| 모델              | Provider  | Tool Calling | Thinking | 한국어 | Context | 비용     |
| ----------------- | --------- | :----------: | :------: | :----: | ------: | -------- |
| Claude Sonnet 4.6 | Anthropic |      ✓       |    ✓     |   ◎    |    200K | API 과금 |
| Claude Haiku 4.5  | Anthropic |      ✓       |    ✗     |   ◎    |    200K | API 과금 |
| GPT-4o            | OpenAI    |      ✓       |    ✗     |   ◎    |    128K | API 과금 |
| GPT-4o mini       | OpenAI    |      ✓       |    ✗     |   ○    |    128K | API 과금 |
| o3-mini           | OpenAI    |      ✓       |    ✓     |   ○    |    200K | API 과금 |

> Tool calling 미지원 모델 선택 시 Agent Loop가 비활성화되고 순수 텍스트 대화 모드로 전환된다.
> 온라인 모델은 더 높은 추론 품질을 제공하지만, 프라이버시/오프라인/비용 트레이드오프가 있음.
> 사용자가 용도에 따라 자유롭게 전환할 수 있도록 한다.

---

## Provider 레지스트리

```typescript
// services/ai/providers/index.ts

export function buildProviderRegistry(settings: AISettings): LLMProvider[] {
  const providers: LLMProvider[] = [];

  // 로컬
  providers.push(new LlamaCppProvider());
  providers.push(new OllamaProvider(settings.ollama));

  // 온라인
  if (settings.apiKeys.anthropic) {
    providers.push(new AnthropicProvider(settings.apiKeys.anthropic));
  }
  if (settings.apiKeys.openai) {
    providers.push(createOpenAIProvider(settings.apiKeys.openai));
  }
  for (const ep of settings.customEndpoints) {
    providers.push(new OpenAICompatibleProvider(ep));
  }

  return providers;
}

export async function getAllModels(
  providers: LLMProvider[],
): Promise<ModelInfo[]> {
  // 모든 provider에서 병렬로 모델 목록 수집
  const results = await Promise.allSettled(
    providers.filter((p) => p.isAvailable()).map((p) => p.listModels()),
  );
  return results
    .filter(
      (r): r is PromiseFulfilledResult<ModelInfo[]> => r.status === "fulfilled",
    )
    .flatMap((r) => r.value);
}

export function resolveProvider(
  providers: LLMProvider[],
  selectedProvider: string,
): LLMProvider | undefined {
  return providers.find((p) => p.name === selectedProvider);

  for (const p of providers) {
    if (await p.isAvailable()) return p;
  }

  throw new Error("No LLM provider available");
}
```

---

## Qwen3 7B 모델 사양

| 항목           | Qwen3 7B (Q4_K_M)          | Qwen3-Coder 7B (Q4_K_M)     |
| -------------- | -------------------------- | --------------------------- |
| Tool Calling   | 네이티브 지원              | 네이티브 지원               |
| Context Window | 128K                       | 128K                        |
| 추론 속도      | ~35 tok/s (M3)             | ~35 tok/s (M3)              |
| 한국어         | 우수 (다국어 학습)         | 양호                        |
| 코딩/디자인    | 범용                       | 코드 생성 특화              |
| VRAM           | ~4.5GB                     | ~4.5GB                      |
| Thinking Mode  | /think, /no_think 전환     | /think, /no_think 전환      |
| 용도           | 디자인 대화, 레이아웃 계획 | 복잡한 도구 호출, 코드 로직 |

## Qwen3 Thinking Mode 활용

Qwen3는 `/think` 모드를 지원하여 복잡한 디자인 요청 시 내부 추론 후 응답:

```
사용자: "대시보드 레이아웃 만들어줘"
→ Qwen3 /think: 컴포넌트 구조 계획 → 레이아웃 결정 → 도구 호출 순서 결정
→ Tool calls: create_element(Section, flex) → create_composite(Card) × 4 → ...
```

단순 요청은 `/no_think` 모드로 빠르게 처리.

---

## Phase 5: 컴포넌트 지능 — 카탈로그 + 선택적 문서 주입 (목표 1)

### 목표

React Aria Components / React Spectrum 문서를 기반으로, 자연어 명령만으로 컴포넌트의 모든 props, variants, 상태, 접근성 패턴을 정확하게 활용할 수 있게 한다.

### 문제: 컨텍스트 윈도우 제약

| 리소스                        | 토큰 수 | Qwen3 128K 대비 |
| ----------------------------- | ------- | --------------- |
| React Aria 52개 컴포넌트 문서 | ~216K   | 169% (초과)     |
| React Spectrum 71개 문서      | ~95K    | 74%             |
| 합계                          | ~311K   | 243% (초과)     |
| 단일 컴포넌트 평균            | ~3K     | 2.3%            |

**결론**: 전체 문서를 시스템 프롬프트에 넣을 수 없음. 선택적 주입 전략 필수.

### 전략: 2-Tier Context Injection

```
Tier 1 — 항상 포함 (시스템 프롬프트 내장, ~8K tok):
  ├── Component Catalog Summary (65+ 컴포넌트, 카테고리, 핵심 props)
  ├── Layout & Style Guide (flex/grid 패턴, spacing, variant/size 유효값)
  └── Data Binding Guide (Mock 엔드포인트 목록, DataTable 프리셋)

Tier 2 — 요청 시 동적 로드 (도구 호출로 주입, ~3-10K tok/건):
  └── get_component_docs(name) → 해당 컴포넌트의 React Aria/Spectrum 상세 문서
```

### Tier 1: composition Component Catalog

React Aria/Spectrum 문서에서 composition에 맞게 파생한 축약 카탈로그. 빌드 타임에 생성 가능.

```typescript
// services/ai/catalog/componentCatalog.ts
// 빌드 스크립트로 React Aria/Spectrum 문서 + composition Spec에서 자동 생성

export const COMPONENT_CATALOG = `
## 사용 가능한 컴포넌트 (7개 카테고리, 65+개)

### Content (2개)
- **Text**: 텍스트 블록. props: children(string)
- **Heading**: 제목. props: children(string), level(1-6)

### Layout (7개)
- **Section**: flex 컨테이너. props: children. styles: display(flex|grid), flexDirection, gap, padding
- **Div**: 범용 컨테이너
- **Card**: 카드. **create_composite 필수** (CardHeader→Heading + CardContent→Description).
  variant: default|primary|secondary|surface. size: xs|sm|md|lg|xl
- **Tabs**: 탭. **create_composite 필수** (TabList→Tab×N + TabPanels→Panel×N)
- **Panel**: 범용 컨테이너. variant: default|tab
- **Breadcrumbs**: 경로 탐색. children: BreadcrumbItem[]
- **Separator**: 구분선

### Forms (12개)
- **TextField**: 텍스트 입력. props: label, placeholder, isRequired, isDisabled, isReadOnly, type(text|email|password|search|tel|url), description, errorMessage, validationState(valid|invalid). size: xs-xl
- **NumberField**: 숫자. props: label, minValue, maxValue, step, formatOptions
- **SearchField**: 검색. props: label, placeholder, onSubmit
- **Select**: 드롭다운. **create_composite 권장**. props: label, items, selectedKey, isRequired. size: xs-xl
- **ComboBox**: 자동완성. props: label, items, inputValue, allowsCustomValue
- **Checkbox**: 체크박스. props: children, isSelected, isIndeterminate, isDisabled
- **CheckboxGroup**: 그룹. props: label, children(Checkbox[])
- **RadioGroup**: 라디오 그룹. props: label, children(Radio[])
- **Switch**: 토글. props: children, isSelected
- **Slider**: 슬라이더. props: label, minValue, maxValue, step, value
- **DatePicker**: 날짜 선택. **create_composite**. props: label, granularity(day|hour|minute|second), isRequired
- **DateRangePicker**: 날짜 범위. **create_composite**

### Actions (4개)
- **Button**: 버튼. props: children, onPress. variant: default|primary|secondary|surface. size: xs-xl
- **ToggleButton**: 토글 버튼. props: isSelected, children
- **ToggleButtonGroup**: 그룹. props: selectionMode(single|multiple)
- **Menu**: 메뉴. props: children(MenuItem[])

### Collections (4개)
- **Table**: 데이터 테이블. **create_composite + dataBinding**. props: selectionMode(single|multiple)
- **ListBox**: 리스트. props: items, selectionMode. dataBinding 지원
- **GridList**: 그리드 리스트. dataBinding 지원
- **TagGroup**: 태그 그룹. props: label, children(Tag[])

### Date & Time (4개)
- **Calendar**: 달력. **create_composite**
- **DateField**: 날짜 필드. props: label, granularity
- **TimeField**: 시간 필드. props: label, granularity
- **DateRangePicker**: 범위. **create_composite**

### Feedback (4개)
- **ProgressBar**: 진행률. props: label, value, maxValue
- **Meter**: 측정값. props: label, value, maxValue
- **Badge**: 배지. props: children, variant(19종 색상). size: xs-xl
- **Tooltip**: 툴팁. props: children, placement

### Overlays (3개)
- **Dialog**: 대화상자. props: children, isDismissable
- **Modal**: 모달 래퍼
- **Popover**: 팝오버. props: placement, offset
`;
```

### Tier 2: get_component_docs 도구

사용자 요청에서 언급된 컴포넌트의 상세 문서를 동적으로 로드.

```typescript
// services/ai/tools/getComponentDocs.ts

export const getComponentDocsTool: LLMTool = {
  type: "function",
  function: {
    name: "get_component_docs",
    description:
      "특정 컴포넌트의 상세 API 문서를 조회합니다. props, 이벤트, 접근성 패턴, 코드 예시를 포함합니다. 복잡한 props 설정이 필요할 때 호출하세요.",
    parameters: {
      type: "object",
      properties: {
        componentName: {
          type: "string",
          description: "컴포넌트 이름 (예: DateRangePicker, Table, Select)",
        },
      },
      required: ["componentName"],
    },
  },
};

// 구현: .claude/skills/react-aria/references/components/{name}.md 로드
// composition Spec props와 병합하여 반환
export async function executeGetComponentDocs(args: {
  componentName: string;
}): Promise<string> {
  // 1. React Aria 문서 로드
  const ariaDoc = await loadReactAriaDoc(args.componentName);
  // 2. composition Spec에서 실제 지원 props 추출
  const specProps = getSpecProps(args.componentName);
  // 3. 병합: React Aria 문서 + composition 실제 지원 범위
  return mergeDocWithSpec(ariaDoc, specProps);
}
```

### 카탈로그 빌드 파이프라인

```
React Aria 문서 (52개 .md)
  + React Spectrum 문서 (71개 .md)
  + composition Spec 정의 (packages/specs/src/)
  + composition Factory 정의 (componentDefinitions/)
  ↓ 빌드 스크립트
composition Component Catalog (Tier 1 요약 + Tier 2 상세)
```

### 파일 변경표

| 파일                                      | 변경 | 설명                                         |
| ----------------------------------------- | ---- | -------------------------------------------- |
| `services/ai/catalog/componentCatalog.ts` | 신규 | Tier 1 컴포넌트 카탈로그 (시스템 프롬프트용) |
| `services/ai/catalog/layoutGuide.ts`      | 신규 | Tier 1 레이아웃 가이드                       |
| `services/ai/catalog/dataBindingGuide.ts` | 신규 | Tier 1 데이터 바인딩 가이드                  |
| `services/ai/catalog/buildCatalog.ts`     | 신규 | 빌드 스크립트 — Spec+문서→카탈로그 생성      |
| `services/ai/tools/getComponentDocs.ts`   | 신규 | Tier 2 동적 문서 로드 도구                   |
| `services/ai/tools/editText.ts`           | 신규 | AI 텍스트 생성/편집/번역 도구                |
| `services/ai/systemPrompt.ts`             | 수정 | Tier 1 카탈로그 통합 (51줄→~200줄)           |
| `services/ai/tools/definitions.ts`        | 수정 | get_component_docs, edit_text 도구 등록      |

### 신규 도구: edit_text (AI 텍스트 생성/편집)

선택된 텍스트 요소의 콘텐츠를 AI로 생성, 리라이트, 번역, 톤 변경한다.
Webflow/Wix/Framer 전체에서 table stakes 기능.

```typescript
// services/ai/tools/editText.ts

export const editTextTool: LLMTool = {
  type: "function",
  function: {
    name: "edit_text",
    description: "텍스트 요소의 콘텐츠를 AI로 생성하거나 편집합니다.",
    parameters: {
      type: "object",
      properties: {
        elementId: {
          type: "string",
          description: '대상 텍스트 요소 ID. "selected"이면 현재 선택된 요소.',
        },
        action: {
          type: "string",
          enum: [
            "generate",
            "rewrite",
            "shorten",
            "expand",
            "translate",
            "change_tone",
          ],
          description: "텍스트 편집 동작",
        },
        instruction: {
          type: "string",
          description:
            '추가 지시 (예: "좀 더 친근하게", "영어로 번역", "CTA 문구로")',
        },
        targetLanguage: {
          type: "string",
          description: 'translate 시 대상 언어 (예: "en", "ja", "ko")',
        },
        context: {
          type: "string",
          description:
            '콘텐츠 맥락 (예: "SaaS 랜딩 페이지", "이커머스 상품 설명")',
        },
      },
      required: ["elementId", "action"],
    },
  },
};
```

**사용 예시:**

```
사용자: "이 제목을 좀 더 임팩트 있게 바꿔줘"
→ edit_text(elementId: "selected", action: "rewrite", instruction: "임팩트 있게")

사용자: "이 카드 설명을 영어로 번역해줘"
→ edit_text(elementId: "card-desc-1", action: "translate", targetLanguage: "en")

사용자: "이 버튼 텍스트를 CTA 문구로 만들어줘"
→ edit_text(elementId: "btn-1", action: "rewrite", instruction: "CTA 전환율 높은 문구")
```

### AI 플레이스홀더 콘텐츠 자동 생성

컴포넌트 생성 시 컨텍스트 기반 현실적 더미 데이터를 자동 주입한다.
Wix, Framer에서 table stakes 수준.

시스템 프롬프트의 디자인 에이전트 가이드에 추가:

```
## 콘텐츠 생성 규칙

컴포넌트 생성 시 빈 텍스트 대신 **맥락에 맞는 현실적 콘텐츠**를 넣으세요:
- Card 생성 시: 주제에 맞는 제목 + 설명 (예: "월간 활성 사용자", "전월 대비 12% 증가")
- Table 생성 시: 엔드포인트 데이터 필드에 맞는 컬럼 헤더 (예: /users → 이름, 이메일, 역할, 상태)
- Button 생성 시: 동작에 맞는 라벨 (예: "저장", "다음", "시작하기")
- Form 생성 시: 필드별 적절한 label + placeholder (예: "이메일 주소", "name@example.com")

업종 컨텍스트가 주어지면 해당 도메인에 맞는 용어를 사용하세요:
- SaaS: 구독, 플랜, 사용량, 대시보드
- 이커머스: 상품, 카트, 결제, 배송
- 관리자: 사용자, 권한, 로그, 설정
```

---

## Phase 6: 디자인 지능 — Plan→Execute→Verify 에이전트 + 도구 확장 (목표 2)

### 목표

Pencil/Google Stitch처럼 자연어로 페이지 전체를 디자인할 수 있는 멀티스텝 에이전트 워크플로를 구현한다.

### 에이전트 워크플로: Plan → Execute → Verify

```
사용자: "사용자 관리 대시보드를 만들어줘"

┌─── Plan (thinking mode) ──────────────────────────────┐
│ 1. 전체 구조 결정:                                     │
│    - 최상위 Section (flex, column, gap: 24)            │
│    - 상단: 통계 카드 4개 (Section, flex, row)           │
│    - 하단: 좌측 필터 + 우측 테이블 (Section, flex, row) │
│                                                        │
│ 2. 컴포넌트 선택:                                      │
│    - Card × 4 (variant: surface, Heading+Description)  │
│    - TextField (검색)                                   │
│    - Select (필터)                                      │
│    - Table (dataBinding: /users)                        │
│                                                        │
│ 3. 실행 순서 결정:                                      │
│    - create_composite(Section, root container)          │
│    - create_composite(Section, stats row)               │
│    - create_composite(Card) × 4                         │
│    - create_composite(Section, content row)             │
│    - create_element(TextField, search)                  │
│    - create_element(Select, filter)                     │
│    - create_composite(Table, dataBinding: /users)       │
└────────────────────────────────────────────────────────┘
    ↓
┌─── Execute (tool calls) ──────────────────────────────┐
│ batch_design([                                         │
│   { action: "create", tag: "Section", styles: {...} }, │
│   { action: "create_composite", tag: "Card", ... },    │
│   { action: "create_composite", tag: "Card", ... },    │
│   ...                                                  │
│ ])                                                     │
│                                                        │
│ → 시각 피드백: generating effect (블러+파티클)          │
│ → 완료 피드백: flash effect per element                 │
└────────────────────────────────────────────────────────┘
    ↓
┌─── Verify (자기 검증) ────────────────────────────────┐
│ get_editor_state() → 생성된 구조 확인                  │
│ - 레이아웃 올바른가? (flex/grid 설정 확인)             │
│ - 컴포넌트가 모두 생성되었는가?                        │
│ - 데이터 바인딩이 설정되었는가?                        │
│                                                        │
│ 문제 발견 시 → 자동 수정 (update_element)              │
└────────────────────────────────────────────────────────┘
    ↓
사용자에게 결과 보고:
"대시보드를 생성했습니다:
 - 상단: 총 사용자 / 활성 / 신규 / 비활성 통계 카드 4개
 - 하단: 검색+필터 사이드바 + 사용자 데이터 테이블 (/users 연동)
 수정이 필요하면 말씀해주세요."
```

### 신규 도구: create_composite

팩토리 정의를 직접 호출하여 children 구조를 자동 생성.

```typescript
// services/ai/tools/createComposite.ts

export const createCompositeTool: LLMTool = {
  type: "function",
  function: {
    name: "create_composite",
    description:
      "복합 컴포넌트를 children 구조와 함께 일괄 생성합니다. Card, Tabs, Table, Calendar, DatePicker 등 children이 필요한 컴포넌트에 사용하세요.",
    parameters: {
      type: "object",
      properties: {
        tag: {
          type: "string",
          enum: [
            "Card",
            "Tabs",
            "Table",
            "Calendar",
            "DatePicker",
            "DateRangePicker",
            "Select",
            "ComboBox",
          ],
          description: "복합 컴포넌트 타입",
        },
        parentId: { type: "string", description: "부모 요소 ID" },
        props: {
          type: "object",
          description: "루트 컴포넌트 props (variant, size 등)",
        },
        styles: { type: "object", description: "CSS 스타일" },
        childrenConfig: {
          type: "object",
          description:
            "자식 요소 커스터마이징 (예: Card의 heading 텍스트, Tab 개수/라벨)",
          properties: {
            heading: { type: "string", description: "Card 제목" },
            description: { type: "string", description: "Card 설명" },
            tabLabels: {
              type: "array",
              items: { type: "string" },
              description: "Tab 라벨 목록",
            },
            columns: {
              type: "array",
              items: { type: "object" },
              description: "Table 컬럼 정의",
            },
          },
        },
        dataBinding: {
          type: "object",
          description: "데이터 바인딩 (Collections 컴포넌트용)",
          properties: {
            endpoint: { type: "string", description: "Mock API 엔드포인트" },
          },
        },
      },
      required: ["tag"],
    },
  },
};
```

### 신규 도구: apply_layout

레이아웃 템플릿을 적용하여 구조적 배치를 한 번에 생성.

```typescript
// services/ai/tools/applyLayout.ts

export const applyLayoutTool: LLMTool = {
  type: "function",
  function: {
    name: "apply_layout",
    description: "레이아웃 템플릿을 적용하여 페이지 구조를 생성합니다.",
    parameters: {
      type: "object",
      properties: {
        template: {
          type: "string",
          enum: [
            "dashboard-grid", // 상단 통계 + 하단 테이블/차트
            "sidebar-content", // 좌측 사이드바 + 우측 콘텐츠
            "form-layout", // 필드 그룹 수직 나열
            "card-grid", // 카드 그리드 (2-4 컬럼)
            "split-view", // 좌우 분할
            "header-body-footer", // 3단 구조
          ],
          description: "레이아웃 템플릿 이름",
        },
        parentId: { type: "string", description: "부모 요소 ID" },
        options: {
          type: "object",
          description: "템플릿 옵션 (컬럼 수, gap, padding 등)",
        },
      },
      required: ["template"],
    },
  },
};
```

### 시스템 프롬프트 확장: 디자인 에이전트 가이드

```typescript
// Tier 1 시스템 프롬프트에 추가

const DESIGN_AGENT_GUIDE = `
## 디자인 워크플로

복합 디자인 요청(페이지, 대시보드, 폼 등)을 받으면 다음 순서로 처리하세요:

### Step 1: Plan (구조 설계)
- 전체 레이아웃 구조 결정 (apply_layout 또는 수동 Section/flex/grid)
- 필요한 컴포넌트 목록 작성
- 데이터 바인딩 대상 결정

### Step 2: Execute (도구 호출)
- 최상위 컨테이너부터 생성 (top-down)
- create_composite로 복합 컴포넌트 생성 (개별 create_element 대신)
- batch_design으로 여러 요소 일괄 생성
- 데이터 바인딩 설정

### Step 3: Verify (검증)
- get_editor_state()로 생성된 구조 확인
- 레이아웃 오류 발견 시 update_element로 수정
- 누락된 컴포넌트 추가

### 레이아웃 필수 규칙
- 여러 요소를 나열하려면 **부모 Section에 flex 레이아웃 설정**
- 수직: { display: 'flex', flexDirection: 'column', gap: 16 }
- 수평: { display: 'flex', flexDirection: 'row', gap: 16 }
- 그리드: { display: 'grid', gridTemplateColumns: 'repeat(N, 1fr)', gap: 16 }
- 요소 없이 나열하면 **모두 겹침** — 반드시 컨테이너로 감싸기
`;
```

### batch_design 확장

```typescript
// 기존 batch_design의 action enum 확장
action: {
  type: 'string',
  enum: [
    'create', 'update', 'delete',
    'create_composite',  // 팩토리 기반 복합 생성
    'apply_layout',      // 레이아웃 템플릿 적용
  ],
}

// $bindAs 지원: 생성된 요소 ID를 후속 operation에서 참조
// 예: { action: 'create', tag: 'Section', $bindAs: 'container' }
//     { action: 'create', tag: 'Button', parentId: '$container' }
```

### 파일 변경표

| 파일                                          | 변경 | 설명                                         |
| --------------------------------------------- | ---- | -------------------------------------------- |
| `services/ai/tools/createComposite.ts`        | 신규 | 복합 컴포넌트 생성 도구                      |
| `services/ai/tools/applyLayout.ts`            | 신규 | 레이아웃 템플릿 도구                         |
| `services/ai/tools/suggestImprovements.ts`    | 신규 | 제안 모드 도구                               |
| `services/ai/tools/batchDesign.ts`            | 수정 | create_composite, apply_layout, $bindAs 지원 |
| `services/ai/tools/definitions.ts`            | 수정 | 신규 도구 등록                               |
| `services/ai/systemPrompt.ts`                 | 수정 | 디자인 에이전트 가이드 + 콘텐츠 생성 규칙    |
| `services/ai/layoutTemplates.ts`              | 신규 | 레이아웃 템플릿 정의 (6종)                   |
| `services/ai/AgentService.ts`                 | 수정 | Plan→Execute→Verify + 자기 수정 루프         |
| `builder/panels/ai/components/Suggestion.tsx` | 신규 | 제안 수락/거부 UI                            |

### Verify 자기 수정 (Self-Correction)

Framer, Figma AI에서 채택한 패턴. Plan→Execute 후 Verify에서 문제 발견 시 자동 재시도.

```typescript
// services/ai/AgentService.ts — Verify 단계 확장

async *runAgentLoop(/* ... */): AsyncGenerator<AgentEvent> {
  // ... Plan → Execute 완료 후 ...

  // Verify + Self-Correction (최대 2회)
  const MAX_CORRECTIONS = 2;
  for (let correction = 0; correction < MAX_CORRECTIONS; correction++) {
    // 1. 현재 상태 조회
    const state = await this.executeTool({
      id: 'verify', function: { name: 'get_editor_state', arguments: '{}' }
    });

    // 2. LLM에 검증 요청 (시스템 프롬프트에 검증 기준 포함)
    const verifyMessages: LLMMessage[] = [
      ...llmMessages,
      {
        role: 'user',
        content: `생성 결과를 검증하세요:
${JSON.stringify(state.data)}

확인 항목:
1. 레이아웃: flex/grid 컨테이너가 설정되었는가? 요소가 겹치지 않는가?
2. 구조: 요청된 컴포넌트가 모두 생성되었는가?
3. 콘텐츠: 텍스트가 빈 문자열이 아닌가?
4. 데이터: dataBinding이 필요한 컴포넌트에 설정되었는가?

문제가 있으면 update_element로 수정하세요. 없으면 "검증 완료"라고 답하세요.`,
      },
    ];

    yield { type: 'text-delta', content: `\n🔍 검증 중... (${correction + 1}/${MAX_CORRECTIONS})\n` };

    // 3. LLM이 수정 도구 호출 또는 "검증 완료" 응답
    let needsCorrection = false;
    for await (const event of this.provider.chat({
      model: params.model,
      messages: verifyMessages,
      tools: llmTools,
      toolChoice: 'auto',
    })) {
      yield event;
      if (event.type === 'tool-call') needsCorrection = true;
      if (event.type === 'final' && event.content.includes('검증 완료')) break;
    }

    if (!needsCorrection) {
      yield { type: 'text-delta', content: '✅ 검증 완료\n' };
      break;
    }
  }
}
```

### 신규 도구: suggest_improvements (제안 모드)

Figma Quick Actions, Cursor 인라인 제안 패턴. 선택 요소에 대한 개선안을 제안.

```typescript
// services/ai/tools/suggestImprovements.ts

export const suggestImprovementsTool: LLMTool = {
  type: "function",
  function: {
    name: "suggest_improvements",
    description:
      "선택된 요소의 디자인 개선안을 제안합니다. 사용자가 수락하면 적용, 거부하면 무시합니다.",
    parameters: {
      type: "object",
      properties: {
        elementId: {
          type: "string",
          description: '대상 요소 ID. "selected"이면 현재 선택.',
        },
        aspects: {
          type: "array",
          items: {
            type: "string",
            enum: [
              "layout",
              "spacing",
              "color",
              "typography",
              "accessibility",
              "content",
            ],
          },
          description: "개선할 측면. 미지정 시 전체 분석.",
        },
      },
      required: ["elementId"],
    },
  },
};
```

**제안 흐름:**

```
사용자: "이 카드 디자인 개선해줘"
  ↓
suggest_improvements(elementId: "selected", aspects: ["layout", "spacing", "color"])
  ↓
AI 분석 → 개선안 목록 반환:
  ┌─ 제안 #1 ─────────────────────────────────────┐
  │ padding 16px → 24px (콘텐츠 여백 부족)         │
  │ [수락] [거부]                                   │
  ├─ 제안 #2 ─────────────────────────────────────┤
  │ gap 8px → 16px (자식 간격 좁음)                │
  │ [수락] [거부]                                   │
  ├─ 제안 #3 ─────────────────────────────────────┤
  │ variant default → surface (시각적 구분 강화)    │
  │ [수락] [거부]                                   │
  └────────────────────────────────────────────────┘
  ↓
사용자가 수락한 제안만 update_element로 적용
```

```typescript
// AgentEvent 확장 — 제안 이벤트 타입 추가
type AgentEvent =
  | { type: "text-delta"; content: string }
  | { type: "tool-call"; toolCall: LLMToolCall }
  | { type: "final"; content: string }
  | { type: "aborted" }
  | { type: "max-turns-reached" }
  // 신규
  | {
      type: "suggestion";
      suggestions: Array<{
        id: string;
        description: string;
        changes: {
          elementId: string;
          props?: Record<string, unknown>;
          styles?: Record<string, unknown>;
        };
      }>;
    };
```

---

## Phase 7: AI 지능 확장 — 접근성 감사 + 브랜드 테마

### 목표

디자인 품질과 브랜드 일관성을 AI가 자동으로 보장한다.

### 접근성 AI 감사 (Accessibility Audit)

Stark AI 참조. composition는 React Aria 기반이라 ARIA 패턴이 이미 내장되어 있어 구현이 자연스럽다.

```typescript
// services/ai/tools/auditAccessibility.ts

export const auditAccessibilityTool: LLMTool = {
  type: "function",
  function: {
    name: "audit_accessibility",
    description:
      "현재 페이지 또는 선택 요소의 접근성(WCAG) 위반을 감지하고 수정안을 제시합니다.",
    parameters: {
      type: "object",
      properties: {
        scope: {
          type: "string",
          enum: ["page", "selected"],
          description: "감사 범위 — 전체 페이지 또는 선택 요소",
        },
        autoFix: {
          type: "boolean",
          description: "true면 자동 수정, false면 리포트만",
        },
      },
    },
  },
};
```

**감사 항목:**

```
1. 색상 대비 (WCAG AA 4.5:1 기준)
   → Spec TokenRef 색상 + CSS 변수 값으로 대비 계산
   → 위반 시: fg/bg 색상 토큰 변경 제안

2. 텍스트 대체 (이미지 alt 속성)
   → Image 요소에 alt prop 누락 감지
   → AI가 이미지 컨텍스트 기반 alt 텍스트 자동 생성

3. 키보드 네비게이션
   → tabIndex, focus 순서 분석
   → React Aria 훅 미사용 요소 감지

4. 라벨 연결
   → Form 컴포넌트에 label prop 누락 감지
   → AI가 필드 컨텍스트 기반 라벨 자동 생성

5. Heading 계층
   → h1 → h2 → h3 순서 위반 감지
   → level prop 수정 제안
```

### 브랜드 기반 자동 테마 (Brand Theme Generation)

Squarespace Blueprint, Wix 참조. 브랜드 자산을 입력하면 디자인 토큰을 자동 생성.
composition의 Tint Color System(ADR-021)과 직접 연동.

```typescript
// services/ai/tools/generateBrandTheme.ts

export const generateBrandThemeTool: LLMTool = {
  type: "function",
  function: {
    name: "generate_brand_theme",
    description: "브랜드 정보를 기반으로 디자인 테마를 자동 생성합니다.",
    parameters: {
      type: "object",
      properties: {
        brandName: { type: "string", description: "브랜드명" },
        primaryColor: { type: "string", description: "주요 브랜드 색상 (hex)" },
        industry: {
          type: "string",
          enum: [
            "tech",
            "ecommerce",
            "healthcare",
            "finance",
            "education",
            "creative",
            "saas",
          ],
          description: "업종",
        },
        mood: {
          type: "string",
          enum: ["professional", "playful", "minimal", "bold", "elegant"],
          description: "디자인 분위기",
        },
        fontPreference: {
          type: "string",
          enum: ["sans-serif", "serif", "monospace", "mixed"],
          description: "선호 폰트 스타일",
        },
      },
      required: ["brandName"],
    },
  },
};
```

**테마 생성 흐름:**

```
사용자: "Tech 스타트업 SaaS 느낌으로 테마 만들어줘, 주 색상은 #6366f1"
  ↓
generate_brand_theme(brandName: "composition", primaryColor: "#6366f1", industry: "saas", mood: "professional")
  ↓
AI가 Tint System 연동:
  - --tint 변수를 #6366f1 (indigo) 기반으로 설정
  - 폰트: Inter (sans-serif, SaaS 표준)
  - 라운딩: 8px (modern)
  - 간격: 16/24/32px 체계
  ↓
ThemeStore에 저장 → Preview/Canvas 즉시 반영
```

### 파일 변경표

| 파일                                      | 변경 | 설명                     |
| ----------------------------------------- | ---- | ------------------------ |
| `services/ai/tools/auditAccessibility.ts` | 신규 | 접근성 AI 감사 도구      |
| `services/ai/tools/generateBrandTheme.ts` | 신규 | 브랜드 테마 생성 도구    |
| `services/ai/tools/definitions.ts`        | 수정 | Phase 7 도구 등록        |
| `services/ai/a11y/contrastChecker.ts`     | 신규 | WCAG 색상 대비 계산 유틸 |
| `services/ai/a11y/auditRules.ts`          | 신규 | 접근성 감사 규칙 정의    |

---

## Phase 의존성 그래프

```
Phase 1 (Provider 추상화 + Groq 제거) ← 선행 필수
  ↓
Phase 2 (Ollama)     Phase 5 (컴포넌트 지능 + 텍스트 편집) ← 병렬 가능
  ↓                    ↓
Phase 4 (모델 관리)  Phase 6 (디자인 지능 + 자기 수정 + 제안 모드) ← Phase 5 이후
  ↓                    ↓
Phase 3 (Electron)   Phase 7 (접근성 감사 + 브랜드 테마) ← Phase 6 이후
```

**즉시 시작 가능**: Phase 1 → Phase 2 + Phase 5 병렬 → Phase 6 → Phase 7
**Electron 이후**: Phase 3 → Phase 4

**즉시 시작 가능**: Phase 1 → Phase 2 + Phase 5 병렬 → Phase 6
**Electron 이후**: Phase 3 → Phase 4
