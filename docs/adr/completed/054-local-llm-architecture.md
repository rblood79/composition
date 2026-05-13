# ADR-054: 로컬 LLM 아키텍처 (Ollama → node-llama-cpp)

> **Status: Deprecated — 2026-05-13** (Replaced by [ADR-134](../134-ai-assistant-llm-infrastructure-unification.md) — AI Assistant 차세대 아키텍처)
>
> **사유**: Proposed 상태로 land 0건. 본 ADR 의 Provider 추상화 base 영역 + Hard Constraints 7개 + Gates G1-G6 은 ADR-134 (단일 통합) 에 정합 갱신되어 흡수. 작성 시점 (2026-04-05) 이후 land 된 canonical document SSOT (ADR-116/122) / data_tables SSOT (ADR-132) / events/actions root collection (ADR-131) / frame canonical (ADR-130) / AIPanel UX 1년차 신입 baseline (ADR-133) 정합 미반영.
>
> **ADR-054 → ADR-134 매핑** (design breakdown §14 참조): Phase 1 (Groq 제거 + Provider) → ADR-134 Phase 1+2 / Phase 2 (로컬 모델 Tool Calling) → Phase 2+5 / Phase 3 (Canvas FPS) → Phase 9 / Phase 4-5 (카탈로그) → Phase 5 / Phase 6 (디자인 지능) → Phase 6 / Phase 7 (접근성 감사) → ADR-135+ 응용 (scope 밖)

> Supersedes [ADR-011](011-ai-assistant-design.md) — 함께 Deprecated, ADR-134 로 통합 흡수

## Status

Deprecated — 2026-05-13 (Replaced by [ADR-134](../134-ai-assistant-llm-infrastructure-unification.md))

## Context

composition AI 어시스턴트는 현재 Groq Cloud SDK(`groq-sdk`)를 통해 `llama-3.3-70b-versatile` 모델을 사용한다 (ADR-011, Phase A1~A4 구현 완료). 이 아키텍처에는 다음 근본적 한계가 있다:

1. **API 키 브라우저 노출**: `dangerouslyAllowBrowser: true`로 클라이언트에서 직접 호출 — 키 탈취 위험
2. **클라우드 의존**: 네트워크 불가 시 AI 기능 전체 불능, Groq 서비스 장애 시 동일
3. **Rate Limit**: 무료 tier 30 req/min, 30K tokens/min — 복잡한 Agent Loop에서 쉽게 소진
4. **프라이버시**: 사용자 디자인 데이터가 외부 서버로 전송
5. **비용 확장성**: 유료 전환 시 사용량 비례 과금, 사용자에게 API 키 요구 필요

composition는 Electron 데스크톱 앱으로 마이그레이션이 계획되어 있으며, 이 전환 시점에서 LLM을 앱 내부에 직접 내장할 수 있다. **기존 Groq SDK 의존은 완전 제거하고 로컬 LLM으로 전환한다.**

### 기능 목표

이 ADR의 LLM 인프라가 달성해야 할 두 가지 핵심 기능 목표:

**목표 1 — 컴포넌트 지능 (Component Intelligence)**:
React Aria Components / React Spectrum 문서를 기반으로, 자연어 명령만으로 컴포넌트의 모든 props, variants, 상태, 접근성 패턴을 자유롭게 활용할 수 있어야 한다.

- 현재: 시스템 프롬프트 51줄, 컴포넌트 나열만. Props/variant/size 유효값 없음, Compositional 패턴 미지원
- 목표: "DateRangePicker를 required로 만들고 granularity를 hour로 설정해줘" → 정확한 tool call
- 리소스: React Aria 52개 컴포넌트 문서(~216K tok), React Spectrum 71개 문서(~95K tok), composition Spec 65+ 컴포넌트
- 제약: Qwen3 7B 128K context에 전체 문서(~311K tok) 불가 → 선택적 주입 또는 RAG 필수

**목표 2 — 디자인 지능 (Design Intelligence)**:
Pencil, Google Stitch처럼 자연어로 페이지 전체를 디자인할 수 있어야 한다. 멀티스텝 계획(컴포넌트 구조 → 레이아웃 → 스타일 → 데이터)을 자동 수행한다.

- 현재: 단일 도구 호출만 가능. "대시보드 만들어줘" 수준의 복합 요청 불가
- 목표: "사용자 관리 대시보드를 만들어줘 — 상단 통계 카드 4개, 좌측 필터 사이드바, 우측 데이터 테이블" → Plan → 10+ tool calls → 완성
- 참조: Pencil(Claude AI Agent + 18종 도구), Google Stitch(자연어→인터랙티브 프로토타입), v0.dev
- 필요: `create_composite` 도구(팩토리 기반), 레이아웃 템플릿, Plan→Execute→Verify 에이전트 루프
- 업계 리서치 반영: AI 텍스트 편집, 자기 수정, 제안 모드, 접근성 감사, 브랜드 테마 자동 생성

**Hard Constraints**:

1. Canvas 60fps 유지 — LLM 추론이 렌더링 스레드를 차단하면 안 됨
2. 기존 7개 AI 도구와 호환 + 확장 필수
3. Tool Calling 지원 필수 — 자연어 → 도구 호출 패턴이 핵심 아키텍처
4. Apple Silicon 16GB에서 실행 가능해야 하며 (Qwen3 14B Q4_K_M), **36GB 권장** (Qwen3.5-35B-A3B)
5. 초기 앱 번들 < 500KB 유지 (LLM 모델은 별도 다운로드/관리)
6. React Aria/Spectrum 문서 기반 정확한 props 설정 — 잘못된 prop 조합 생성 금지
7. **폐쇄망 지원**: 인터넷 불가 환경에서도 로컬 모델만으로 기본 AI 기능 동작 필수 — 로컬 LLM이 기본인 핵심 이유

**로컬 모델 하드웨어 티어** (품질 평가 기반, 컴포넌트 문서 Tier 2 주입 보정 포함):

|  티어  | 하드웨어             | 권장 모델                           | BFCL (tool calling) | AI 기능 합격률 (문서 주입 보정) |
| :----: | -------------------- | ----------------------------------- | :-----------------: | :-----------------------------: |
|   T1   | 16GB MacBook Air     | Qwen3 14B Q4_K_M (9GB)              |        ~68%         |           5/15 (33%)            |
| **T2** | **36GB MacBook Pro** | **Qwen3.5-35B-A3B Q4_K_M (18.5GB)** |      **~73%**       |         **11/15 (73%)**         |
|   T3   | 64GB MacBook Pro Max | Qwen3 32B Q5_K_M (25GB)             |        75.7%        |           12/15 (80%)           |

> 컴포넌트별 md 문서를 Tier 2로 동적 주입하면, props/events 설정은 "추론"이 아닌 "독해" 수준으로 전환.
> BFCL 점수 대비 단일 prop/event 설정에서 +15~20%p 보정 효과.
> **T2(36GB)에서 73% 합격** — 단순~중간 작업 대부분 중급 개발자 수준 도달.
> 7B 모델은 문서 주입해도 tool calling ~55%가 병목 → 14B 이상 필수.

**Soft Constraints**:

- Electron 마이그레이션 시점 미확정 — 현재 Vite 웹앱 상태에서도 개발/테스트 가능해야 함
- 온라인 모델도 선택 가능 — Pencil(Claude/Sonnet/Haiku), Google Stitch(모델 선택) 참조. Claude API, OpenAI API 등 사용자가 API Key를 설정하면 클라우드 모델로 전환
- 복잡한 작업(대시보드 설계, 디자인 제안)은 로컬 모델 한계 → **난이도 기반 자동 라우팅**으로 온라인 전환 제안
- composition 전용 컴포넌트 카탈로그를 React Aria/Spectrum 문서에서 파생하되, composition Spec과 동기화 유지

## Alternatives Considered

### 대안 A: Ollama 브릿지 → node-llama-cpp 내장 (2-Phase 전환)

- 설명: LLMProvider 추상화 레이어를 도입하고, 로컬(Ollama → node-llama-cpp)을 기본으로 하면서 온라인 모델(Claude API, OpenAI API 등)도 선택 가능하게 한다. 기존 `groq-sdk` 의존은 완전 제거. 사용자가 용도에 따라 로컬/온라인 모델을 자유롭게 전환할 수 있다.
- 근거: Ollama는 로컬 LLM 서버의 사실상 표준 (GitHub 120K+ stars). node-llama-cpp v3는 Electron Utility Process 지원, Metal/CUDA GPU 가속, 내장 tool calling을 제공한다. Pencil(Claude 모델 선택), Google Stitch(모델 선택)처럼 온라인 모델 지원은 사용자 경험의 핵심이다.
- 위험:
  - 기술: **LOW** — Ollama REST API는 안정적이고 단순. Anthropic/OpenAI API도 성숙한 표준
  - 성능: **MEDIUM** — 로컬 Qwen3 7B (~35 tok/s)는 클라우드 대비 느림. 온라인 모델 선택으로 완화 가능
  - 유지보수: **MEDIUM** — 로컬 2개(Ollama/LlamaCpp) + 온라인 N개 Provider. 단, 공통 인터페이스(`LLMProvider`)와 OpenAI-compatible 패턴으로 개별 Provider는 100~200줄 수준
  - 마이그레이션: **LOW** — Ollama → node-llama-cpp 전환 시 모델 포맷(GGUF) 동일, Provider 교체만 필요

### 대안 B: node-llama-cpp 직접 도입 (Ollama 스킵)

- 설명: Electron 전환을 선행하여 node-llama-cpp를 Utility Process에 바로 내장한다. Ollama 단계를 건너뛴다.
- 근거: 중간 단계 없이 최종 목표에 직행. Provider 구현이 하나만 필요.
- 위험:
  - 기술: **HIGH** — Electron 마이그레이션이 선행 필수. 현재 웹앱 상태에서 개발/테스트 불가. node-llama-cpp는 Node.js 네이티브 모듈로 브라우저에서 실행 불가
  - 성능: **MEDIUM** — 대안 A와 동일한 모델 성능 특성
  - 유지보수: **LOW** — 단일 Provider만 유지
  - 마이그레이션: **HIGH** — Electron 전환 완료 시점까지 AI 개선 작업 전면 차단. 개발 병렬성 상실

### 대안 C: WebLLM (브라우저 내 WASM 추론)

- 설명: WebLLM을 사용하여 브라우저 WebGPU에서 직접 LLM을 실행한다. 서버/데스크톱 앱 없이 순수 웹 환경에서 로컬 추론.
- 근거: 서버 의존 완전 제거, 설치 불필요, 순수 웹앱 유지.
- 위험:
  - 기술: **HIGH** — WebGPU 브라우저 지원 제한적 (Safari 미완성). WASM + WebGPU 추론은 네이티브 대비 2~5배 느림
  - 성능: **HIGH** — 7B 모델 브라우저 내 추론 시 ~10 tok/s 수준. Agent Loop에 부적합. Canvas 렌더링과 GPU 경합
  - 유지보수: **MEDIUM** — WebLLM 라이브러리 의존, 모델 캐시 관리
  - 마이그레이션: **HIGH** — Electron 전환 시 WebGPU → node-llama-cpp로 완전 재작성. 투자 회수 불가

### Risk Threshold Check

| 대안                       | 기술  | 성능  | 유지보수 | 마이그레이션 | HIGH+ 개수 |
| -------------------------- | ----- | ----- | -------- | ------------ | :--------: |
| A: Ollama → node-llama-cpp | L     | M     | M        | L            |     0      |
| B: node-llama-cpp 직접     | **H** | M     | L        | **H**        |     2      |
| C: WebLLM                  | **H** | **H** | M        | **H**        |     3      |

- 대안 B: HIGH 2개 — Electron 선행 의존이 핵심 차단. 현재 개발 불가.
- 대안 C: HIGH 3개 — 성능/기술/마이그레이션 모두 위험. 근본적으로 부적합.
- 대안 A: HIGH 없음 — 즉시 실행 가능하며 최종 목표에 정렬.

루프 판정: HIGH 0개 대안(A) 존재. 추가 대안 불필요.

## Decision

**대안 A: 로컬 기본(Ollama → node-llama-cpp) + 온라인 선택(Claude/GPT)**을 선택한다.

선택 근거:

1. **즉시 시작 가능**: Ollama REST API는 현재 웹앱 환경에서 바로 연동 가능. Electron 전환을 기다리지 않아도 됨
2. **최종 목표 정렬**: node-llama-cpp Utility Process 내장은 프라이버시, 오프라인, 비용 문제를 근본적으로 해결
3. **모델 포맷 통일**: Ollama와 node-llama-cpp 모두 GGUF 포맷 사용 → 하드웨어에 맞는 모델(14B/35B-A3B/32B)로 전환 무마찰
4. **하드웨어 티어별 모델 전략**: 16GB=Qwen3 14B, 36GB=Qwen3.5-35B-A3B(권장), 64GB=Qwen3 32B. 품질 평가 결과 T2(36GB)에서 AI 기능 53% 합격, 7B(0%)에서 극적 개선
5. **난이도 기반 자동 라우팅**: 단순 작업은 로컬 모델(T2 기준 87~90%), 복합 작업(대시보드 설계)은 온라인 모델 전환 자동 제안. 폐쇄망에서는 복합 작업을 단순 작업으로 자동 분할
6. **Groq 완전 제거**: `groq-sdk` 의존 및 관련 코드를 전부 삭제. 온라인 모델은 표준 API(Anthropic Messages API, OpenAI Chat Completions API)로 통일
7. **모델 선택의 자유**: Pencil/Google Stitch처럼 사용자가 로컬/온라인 모델을 자유롭게 전환. Provider 인터페이스가 모든 백엔드를 동일하게 추상화

기각 사유:

- **대안 B 기각**: Electron 마이그레이션 시점 미확정. 그때까지 AI 개발 전면 차단은 비용 과다
- **대안 C 기각**: WebGPU 성능이 Agent Loop + Canvas 렌더링 동시 실행에 부적합. Electron 전환 시 투자 회수 불가

> 구현 상세: [054-local-llm-architecture-breakdown.md](../design/054-local-llm-architecture-breakdown.md) — Deprecated 영역, ADR-134 design breakdown 으로 흡수

## Gates

| Gate                           | 시점         | 통과 조건                                                          | 실패 시 대안                                             |
| ------------------------------ | ------------ | ------------------------------------------------------------------ | -------------------------------------------------------- |
| G1: Groq 제거 + Provider 도입  | Phase 1 완료 | groq-sdk 완전 제거, Ollama Provider로 기존 7개 도구 전수 통과      | Provider 인터페이스 재설계                               |
| G2: 로컬 모델 Tool Calling     | Phase 2 완료 | 권장 모델(35B-A3B)의 tool calling 성공률 ≥ 75%, 14B ≥ 68%          | 모델 업그레이드 (32B), thinking mode 강제, 프롬프트 튜닝 |
| G3: Canvas FPS 영향            | Phase 3 완료 | Utility Process 추론 중 Canvas 60fps 유지 (±5fps 이내)             | Utility Process 우선순위 조정, 추론 배치 크기 제한       |
| G4: 컴포넌트 지능 Props 정확도 | Phase 5 완료 | 카탈로그 기반 props 성공률 ≥ 90%, 텍스트 편집 정상 동작            | 카탈로그 형식 재설계, 문서 로딩 전략 변경                |
| G5: 디자인 지능 복합 레이아웃  | Phase 6 완료 | "대시보드" 요청 시 올바른 레이아웃 + 자기 수정 1회 이내 완료       | 레이아웃 템플릿 확대, Plan 단계 프롬프트 튜닝            |
| G6: 접근성 감사 정확도         | Phase 7 완료 | WCAG AA 색상 대비 위반 감지율 ≥ 90%, 자동 수정 시 기존 디자인 유지 | 감사 규칙 보강, 수정 범위 제한                           |

## Consequences

### Positive

- `groq-sdk` 완전 제거 → 벤더 종속 해소, 번들 크기 감소
- `dangerouslyAllowBrowser: true` 제거 → API 키 브라우저 노출 위험 해소
- 로컬 기본: 오프라인 AI 사용, Rate Limit 없음, 디자인 데이터 외부 전송 없음
- 온라인 선택: Claude/GPT 등 고성능 모델로 전환 가능 — 복잡한 디자인 요청에 적합
- 모델 선택의 자유: Pencil/Stitch처럼 로컬↔온라인 자유 전환, 사용자가 용도에 따라 결정
- Qwen3 128K context / Claude 200K context — 풍부한 컴포넌트 문서 컨텍스트 주입 가능
- Thinking mode (Qwen3 /think, Claude extended thinking) → 복잡한 디자인 요청 시 내부 추론
- 컴포넌트 카탈로그(React Aria/Spectrum 파생)로 props/variant/size 정확한 설정 가능
- AI 텍스트 생성/편집 (`edit_text`) — 리라이트, 번역, 톤 변경, CTA 문구 생성. 업계 table stakes
- AI 플레이스홀더 콘텐츠 — 컴포넌트 생성 시 업종 맥락 기반 현실적 더미 데이터 자동 주입
- `create_composite` 도구 + 레이아웃 템플릿으로 Pencil/Stitch 수준의 멀티스텝 디자인 가능
- Plan→Execute→Verify + 자기 수정 — Verify 실패 시 자동 재시도 (max 2회), Framer/Figma AI 패턴
- 제안 모드 (`suggest_improvements`) — 선택 요소에 스타일/레이아웃 개선안 제안 → 수락/거부
- 접근성 AI 감사 (`audit_accessibility`) — WCAG 대비/라벨/키보드 위반 자동 감지 + 수정. React Aria 기반 강점
- 브랜드 테마 자동 생성 (`generate_brand_theme`) — 색상/업종/분위기 → Tint System 연동 디자인 토큰

### Negative

- 로컬 모델 사용 시 Ollama 별도 설치 필요 + 권장 모델(35B-A3B) 다운로드 ~18.5GB
- 권장 하드웨어 36GB RAM — 16GB에서는 14B 모델로 제한적 (합격률 33%)
- 복합 디자인(대시보드 수준)은 로컬 모델로 한계 (T2: 72%) — 난이도 라우팅으로 온라인 전환 제안 또는 작업 자동 분할로 완화
- 온라인 모델 사용 시 API 비용 발생 + 디자인 데이터 외부 전송 (사용자 선택에 의한 트레이드오프)
- 다수 Provider 유지보수: Ollama + LlamaCpp + Anthropic + OpenAI-compatible — 공통 인터페이스로 완화
- Electron 전환 전까지 Phase 3 (node-llama-cpp 내장) 실행 불가
- 컴포넌트 카탈로그 유지보수: React Aria/Spectrum 업데이트 시 재생성 필요
