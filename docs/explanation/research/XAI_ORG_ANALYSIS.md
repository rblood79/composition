# xai-org 저장소 분석 — composition 적용 후보 패턴·알고리즘·최적화

**작성일**: 2026-08-18
**분석 대상**: [github.com/orgs/xai-org](https://github.com/orgs/xai-org) 전체 9개 저장소 (shallow clone 실측, HEAD 고정)
**분석 방법**: 9개 저장소 전부 shallow clone 후 Explore agent 3개 병렬 실측 (grok-build 축 / x-algorithm 축 / SDK·프롬프트 축) + 직접 구조 확인. 대형 2개(grok-build 1.6M LOC Rust, x-algorithm 138K LOC Rust + 101K Python)는 소스 정독 수준이나 **빌드는 하지 않음** — x-algorithm 의 요청 경로 crate 들은 내부 의존 crate (`xai_feature_switches`, `component_library` 등 ~20개) 미포함이라 애초에 빌드 불가한 열람용 export 다.
**관련 ADR**: [ADR-134](../../adr/completed/134-ai-assistant-llm-infrastructure-unification.md) (노선 β — 본 분석의 §5-1/5-2 가 직접 대응)
**관련 문서**: [PENCIL_ECOSYSTEM_ANALYSIS.md](PENCIL_ECOSYSTEM_ANALYSIS.md) · [HOLAOS_ANALYSIS.md](HOLAOS_ANALYSIS.md)

---

## 1. 조직 개요 — 9개 저장소

| 저장소               | ★     | 언어       | HEAD (2026-08-18 clone)   | 정체                                                                | 라이선스             |
| -------------------- | ----- | ---------- | ------------------------- | ------------------------------------------------------------------- | -------------------- |
| grok-1               | 52.1k | Python/JAX | `7050ed2` (2024-03, 정지) | Grok-1 314B MoE 공개 (JAX/Haiku, int8 양자화, 2-D SPMD 샤딩)        | Apache 2.0           |
| x-algorithm          | 31.8k | Rust+Py    | `b089ce6` (활성)          | X "For You" 피드 알고리즘 — 리트리벌/랭킹/필터 전체 요청 경로       | Apache 2.0           |
| grok-build           | 25.6k | Rust       | `d71f6e0` (활성)          | 코딩 에이전트 CLI/TUI (`grok`) — ACP/MCP, 91 crate, 모노레포 export | Apache 2.0           |
| grok-prompts         | 4.3k  | Jinja      | `a7c186f` (2025-11)       | Grok 챗/@grok 봇 시스템 프롬프트 10개 파일                          | **AGPL-3.0**         |
| xai-sdk-python       | 550   | Python     | `2c24a8a` (활성)          | 공식 SDK — **gRPC 전용**, sync/aio 이중 구현                        | Apache 2.0           |
| xai-cookbook         | 546   | Py/TS      | `01d8421` (2026-04)       | 예제 — 노트북 6개 + 음성 에이전트 (OpenAI-호환 REST 사용)           | 커스텀 Beta 라이선스 |
| grok-build-plugin-cc | 211   | JS         | `92b76a6` (활성)          | Claude Code → grok CLI 위임 플러그인                                | Apache 2.0           |
| plugin-marketplace   | 154   | Python     | `653bf9d` (활성)          | 공식 플러그인 마켓플레이스 (SHA 고정 카탈로그)                      | LICENSE 없음         |
| xai-proto            | 148   | proto      | `723dd2a` (활성)          | gRPC API 공개 protobuf                                              | Apache 2.0           |

**한 줄 판정**: composition 에 실질 가치가 있는 축은 ① **grok-build** (ADR-134 노선 β 의 도구 표면·provider 어댑터·외부 에이전트 통합 reference — reference 5번째 수렴 사례), ② **x-algorithm** (Rust 엔지니어링 이디엄 + 검색/다양성 알고리즘), ③ **plugin-marketplace** (public 확장 배포 계약), ④ **xai-proto/SDK** (provider API 표면 지식) 이다. grok-1 은 ML 학습 영역이라 무관, grok-prompts 는 패턴 참조만 (AGPL).

---

## 2. grok-build — 코딩 에이전트 하니스 실측 요약

91 crate / ~1.61M LOC Rust. 내부 모노레포의 일방향 export (`SOURCE_REV` 로 원 커밋 기록, 외부 기여 비수용). 핵심 소유: 에이전트 루프 = `xai-grok-shell`, TUI = `xai-grok-pager` (ratatui, Elm-style), 도구 = `xai-grok-tools` + `xai-tool-runtime`.

### 2-1. 도구 시스템 — 지연 로딩이 1급 설계다

- **MCP 도구는 모델의 도구 manifest 에 절대 실리지 않는다** (`tool_definitions_builtins_only()` 가 `server__tool` 형태 이름을 전부 필터). 대신 두 도구가 표면을 대신한다:
  - `search_tool` — MCP 도구 전체에 대한 **BM25 키워드 검색** (`bm25` crate, 검색마다 재빌드 — 수백 도구에 sub-ms). 검색 결과에 **full `input_schema`** 를 실어 모델이 바로 호출을 구성할 수 있게 함. `normalize_query()` 가 `__`/camelCase 복합 식별자를 분해해 BM25 매칭성 확보.
  - `use_tool` — 메타 디스패처 `{tool_name, tool_input}`. 존재 이유가 코드 주석에 명시: _"도구 집합을 턴 간 안정적으로 유지 — 새 MCP 도구 발견이 KV cache 를 깨지 않게"_. native 도구 이름을 넣으면 "직접 호출하라" 는 교정 에러 반환 (오프라인 eval 오염 방지용 off 스위치 포함).
- 서버 인벤토리 변경 감지는 FNV-1a fingerprint (`(tool_count, description_hash, tool_names_hash)`) 를 영속화해 **실제 변경 시에만** system-reminder 재실행.
- 도구 trait (`xai-tool-runtime/src/tool.rs`): 파라미터 스키마는 **typed `Args` 의 `schemars::JsonSchema` derive** — 수기 JSON Schema 없음. `ToolFamily`/`ToolVariant` 로 같은 `ToolId` 아래 복수 구현 공존 (`grok_build`/`grok_build_concise`/`grok_build_hashline`/`codex` port/`opencode` port). 도구별 `behavior_version` 계약 버전으로 구 세션은 구 도구 의미론 유지.
- 도구 설명은 MiniJinja 템플릿 (`${{ }}` 커스텀 딜리미터) — `tools.by_kind.read` 로 **다른 도구의 실제 client-facing 이름을 interpolate** 하므로 rename/비활성화 시 설명이 자동 추종. `system_reminders_enabled` 조건으로 "완료가 통지된다" 는 약속을 host 가 실제로 지킬 때만 렌더.
- MCP 결과 상한 20,000 bytes — 초과분은 세션 폴더로 spill.

### 2-2. Provider 계층 — 3-way 백엔드 + capability 술어

`ApiBackend { ChatCompletions, Responses, Messages }` enum 에 **capability 술어 메서드**로 차이를 중앙화: `supports_native_schema()` (Messages 는 schema 지정 시 tool use 차단 → StructuredOutput 도구로 우회), `requires_reasoning_strip()` (Messages 만), `forwards_prompt_cache_key()` (Responses 만). BYOK 설정은 `[model.<name>]` — `base_url`/`api_key`/`env_key`(배열 허용 — 첫 비공백 승리)/`api_backend`/`extra_headers`/**`env_http_headers`** (헤더값을 env 에서 클라이언트 생성 시점에 해석, 디스크 비기록 — `query_params` 는 세션에 영속되므로 secret 금지라고 문서가 명시). Anthropic/OpenAI/Ollama/OpenAI-호환 서버 설정 예시가 공식 문서에 포함.

Retry 스펙 (`retry.rs` 모듈 문서): 최대 15회 / backoff 2·4·8·16s→30s 상한 (~총 5.5분), 429 는 `Retry-After` 전액 대기 + **시도수 별도 상한 2회**, 413/이미지 오류는 **이미지 strip 후 1회 재시도**, 5xx 중 525/526 (origin TLS) 은 영구 fatal, 서버 override 헤더 `x-should-retry: false` 는 무조건 fatal. **doom-loop 감지는 서버 주도** — SSE 로 신호 이벤트가 내려오고 클라이언트가 스트림을 중단·재샘플 (backoff 는 의도적으로 ~0: "루프는 온도 확률적이라 재샘플이 처방, 대기는 무익").

### 2-3. 세션·압축·오케스트레이션

- 세션: UUIDv7, `updates.jsonl` 이 정본 스트림, 제목에서 C0/C1 + **bidi override 문자 (U+202A–E 등) 를 강제 제거** (터미널 escape/RTL 주입 차단).
- 압축(compaction) 엔진은 transport 무관 별도 crate — 3 방식 (전체 교체 요약 / tail-keep / chunk 간). 공통 계약: **tool 호출·결과 쌍을 절대 분리하지 않는 tail-keep 선택** + degenerate 요약 감지 + 압축 후 시스템 프롬프트를 stub 으로 교체.
- 서브에이전트: type 축 (general-purpose/explore/plan) 과 **persona 축이 직교** — persona 는 `inputs`/`outputs` I/O 계약 선언으로 체인 가능. 별도 **laziness 분류기** (LLM 이 "TODO 미완인데 멈췄는가" 판정 후 nudge 주입).
- **Rhai 스크립트 워크플로 엔진**: `agent()`/`parallel()`/`phase()`/`budget()` 호스트 함수, `timestamp`/`sleep`/`exit` 는 **명시적 에러로 등록** (비결정성 차단), 모든 호스트 호출이 저널에 기록되어 **결정적 replay 재개** 가능, `parallel()` 초과 방지용 2-phase budget 예약 (`ReserveAgentCalls`/`ReleaseAgentCalls`).
- 권한: hooks deny → 규칙 (deny>ask>allow, 전 scope 병합 — 글로벌 deny 는 프로젝트 allow 로 못 이김) → 기억된 승인 → read-only 자동 승인 (**체인 명령을 `&&`/`;`/pipe 로 분해해 세그먼트 단위 판정**, 단어 경계 매칭) → 모드 정책. auto 모드는 **LLM 분류기**가 판정. 샌드박스는 Landlock/Seatbelt/bubblewrap — deny 경로는 read+rename 동시 차단 (`mv secret x && cat x` 우회 봉쇄), hook 디렉터리는 커널 수준 write-deny (에이전트가 자기 샌드박스 탈출용 hook 설치 불가).
- ACP: `agent-client-protocol` crate 사용, 표준 표면 + `x.ai/*` 확장 메서드 ~120개. **TUI 자신이 shell 의 ACP 클라이언트** — 같은 표면이 에디터 embed 와 자사 TUI 를 동시에 서빙.
- TUI 렌더: 6단계 파이프라인의 캐시/핫패스 분리를 벤치 문서로 명문화 — parse/highlight/wrap 은 **generation 카운터** 로 무효화, wrap 캐시는 `(width, generation)` 키, 부분 가시 entry 만 재사용 ScratchBuffer 에 렌더 후 복사, 최종은 ratatui 셀 diff.
- 기타: hashline 앵커 편집 (3 AnchorScheme 후보 + read-amplification 벤치 하니스 동봉 — string-match 편집의 연구급 대안), 크로스 세션 메모리 (sqlite-vec 단일 캐시 + MMR + query expansion + "dream" 백그라운드 통합), Claude Code/`~/.claude/settings.json`·skills·hooks **네이티브 호환 읽기**, CoW/BTRFS 가속 worktree crate.

---

## 3. x-algorithm — 파이프라인·리트리벌·서빙 실측 요약

### 3-1. candidate-pipeline 프레임워크 (1,234 LOC — 전체 요청 경로의 뼈대)

6개 컴포넌트 trait (`QueryHydrator`/`Source`/`Hydrator`/`Filter`/`Scorer`/`Selector`/`SideEffect`). 각 trait 의 **provided `run()`** 이 사용자 구현을 tracing span + 단계별 stats 매크로 + 에러 로깅으로 균일하게 감싸는 데코레이터 — 컴포넌트 이름은 Rust 타입명에서 파생. 실행 모델: 단계 간 순차, 단계 내 `join_all` 병렬. **부분 실패가 기본값** — 실패한 Source 는 후보 0개로 강등될 뿐 요청을 죽이지 않고, Hydrator/Scorer 는 `output.len() == input.len()` 길이 계약을 강제 (위반 시 전체를 `Err` 로 대체해 index-zip 오염 차단). `tokio::task_local!` 에 per-request 요약을 담아 **요청당 1줄** (단계별 latency + source 별 fetched + filter 별 removed) 로 방출. 캐싱은 `CachedHydrator` blanket impl — hit/miss 분리 → miss 만 배치 RPC → write-back 재조립을 프레임워크가 소유하고 소비자는 key/value/fetch 만 작성.

### 3-2. 랭킹 (home-mixer, 40K LOC)

- 점수 = 26개 행동 예측 확률 × 가중치 (fav 0.5 / reply 5.0 / report −234.0 등), pos/neg 분리 누적 후 `offset_score` 정규화 — 음수 구간을 `(0, 0.001)` 로 affine 매핑해 **전부 양수화** (후속 곱셈 계수의 단조성 보존).
- **author diversity 를 1 pass 로**: 점수 내림차순 정렬 후 `FxHashMap` 으로 author 별 상위 등장 횟수 k 를 세며 `(1−floor)·decay^k + floor` 승수 (0.5/0.25 기본). 같은 pass 에서 **semantic ID prefix 를 20bit 씩 u64 에 bit-pack** 해 3 레벨 토픽 다양성 카운터를 공짜로 산출 (튜플 할당 없음).
- MPN 모드: 승수를 **양수 파트에만** 적용 (`m·pos − neg`) — 부정 신호 강한 게시물이 신규 author 라는 이유로 "구조" 되지 않게.
- 가중치 오해 방지 주석을 코드에 직접 명문화 ("가중치는 예측 확률에 곱한다 — LLM 이나 사람이 잘못 읽지 않도록") — 2026-08-14 갱신에서 추가.
- cold-start: 요청당 최대 1개 저노출 게시물을 Thompson sampling (`Beta(α₀+favs, β₀+…)`) 으로 승격 — 다른 후보를 강등하지 않는 floor 방식.
- 결정성 이디엄: 사용자 일관성이 필요한 결정은 RNG 가 아니라 해시 버킷 (`user_id × 0x9E3779B97F4A7C15 & 1` — value model gate 의 hysteresis tie-break), RNG 는 탐색적 결정에만.

### 3-3. Thunder — in-network 리트리벌 (수기 ~2.9K LOC)

inverted index 가 아니라 **author 별 시간 정렬 deque 의 샤딩 해시맵**: 16-byte `TinyPost { post_id, created_at }` 만 posting list 에 두고 본문 `CompactPost` 는 `Arc` 뒤에 1회 저장 — 전 필드 `i64`/`bool` POD 로 **`Option` 대신 sentinel 0** (discriminant 오버헤드 제거). 시간 오름차순 유지 + `.rev()` 순회로 정렬 없는 최신순, trim 은 앞에서 pop + `shrink_to(len×1.5)`. GC 는 **호출마다 author 의 20% 만** 도는 amortized sweep (`user_id % 5 == iter % 5`). 요청 처리 중 author 마다 wall-clock 을 확인해 **시간 초과 시 부분 결과 반환** (타임아웃 에러 대신 신선한 부분 결과). Kafka ingest 32 스레드는 cold-start 캐치업 동안 세마포어 우회, steady-state 는 `Semaphore(1)` 직렬화로 서빙과의 CPU 경합 제한.

### 3-4. 다양성·서빙 알고리즘

- **vm-ranker = greedy DPP (MAP) + incremental Cholesky**: 품질×다양성 커널 `L = Diag(e^{αq})·cos·Diag(e^{αq})`, 조건부 분산 argmax 를 O(k·m·k) 로 갱신, 수치 rank 소진 시 조기 종료. **rescorer 가 아니라 filter** — 선택 집합은 원 점수 유지, 탈락만 0 점. f16 임베딩 + 런타임 디스패치 SIMD dot (AVX-512/AVX2/scalar). 계측이 풍부: 선정 전/후 평균 pairwise cosine 을 직접 비교하는 diversity-gain 지표.
- **Phoenix 서빙 admission control**: gRPC deadline 헤더에서 남은 예산을 읽고, 큐 깊이 + EWMA 학습된 service time 으로 ETA 를 추정해 **큐에 넣기 전에 거절**. 배치 핸드오프는 `mem::swap` 포인터 교환 1회, 만료 항목은 enqueue/dequeue 양단에서 drop ("stale 작업은 GPU 에 도달하지 않는다").
- **mm embedding cache 의 TTL-without-timestamp**: 만료를 snowflake **ID 자체의 타임스탬프**로 계산 — per-entry 타임스탬프 저장 없음. 고정 슬롯 링 + BTreeMap 인덱스, mmap 슬롯 파일은 `MADV_POPULATE_WRITE` 로 선-fault.
- **visibility-filtering 규칙 엔진**: `Verdict { action, decided_by: Option<&'static str> }` — 어느 규칙이 결정했는지를 결과에 싣는 first-match 평가기. 정책이 문자 그대로 Rust 의 `Vec<Box<dyn Rule>>` 리터럴.
- SimClusters: sparse 임베딩을 4개 평행 배열 (점수순 + id 순 이중 정렬) 로 표현, 클러스터→상위 게시물 inverted list 에 gather-scatter 코사인, **연령 필터를 snowflake ID 정수 범위 비교**로 처리.

### 3-5. Phoenix 모델 (참고 — ML 학습 영역)

트랜스포머 랭커의 **candidate isolation**: `[user | history | candidates]` 시퀀스에서 후보는 history 전체 + 자기 자신에게만 attend 하는 마스크를 [T,T] 행렬 실체화 없이 **flash-attention 커널 내부 술어**로 평가 — 후보의 logit 이 배치 구성과 무관해져 서빙이 batch-invariant. 6×256 semantic ID 는 residual-quantization k-means 산출물. 이 축은 composition 무관 (관찰 가치만 기록).

---

## 4. SDK · proto · cookbook · prompts · grok-1 요약

- **xai-sdk-python 은 gRPC 전용** (REST 없음) — protobuf v5/v6 이중 vendoring, retry 는 수제가 아니라 gRPC service config (`maxAttempts 5, UNAVAILABLE 한정`), sync/aio 는 shim 이 아니라 이중 수기 구현. 도구 파라미터는 proto 에서도 **JSON Schema 문자열** (`Function.parameters`).
- **API 설계 특이점** (xai-proto): ① **서버측 agentic loop** — `max_turns` 로 모델↔도구 반복이 단일 RPC 안에서 실행 (서버측 도구: web/X search, code execution, collections search, **원격 MCP 서버**, image gen — 클라이언트 함수와 같은 `Tool` oneof 에 공존, `ToolCallType` 만이 판별자) ② deferred 응답이 1급 패턴 (video 는 동기 형태 자체가 없음) ③ 상태 유지 2중 기제 — `store_messages`+`previous_response_id` (서버측) vs `use_encrypted_content` (클라이언트가 암호화 reasoning 을 재전송) ④ **`CompactContext` RPC** — 서버측 대화 요약을 API 표면으로 제공.
- **xai-cookbook** 예제는 전부 **OpenAI-호환 REST** (`base_url="https://api.x.ai/v1"` + openai SDK) — 자사 gRPC SDK 미사용. 주목 패턴: 저가 모델을 관련성 필터 (ID 만 반환하는 structured output) 로 앞세우고 고가 모델이 뒤에서 채점하는 2단 게이트; vision 호출을 도구 안에 중첩 (도구 내부에서 별도 LLM 호출).
- **grok-prompts**: 의도적으로 **최소 Jinja** — 전 파일에 `if/else` 와 보간만 (extends/include/macro/loop 0건). surface 변형은 상속이 아니라 **파일 복제**, 버전은 파일명 (`_v8`). 도구 지시는 스키마가 아니라 산문. 모델에게 안 보이는 Jinja 주석으로 개발자 메모를 프롬프트 옆에 병기.
- **grok-1**: 314B MoE (8 expert / top-2), GQA 48Q/8KV, 8-bit weight-only 양자화 (`(weight, scales)` pytree), 2-D SPMD 샤딩. 2024 이후 정지 — 관찰만.

---

## 5. composition 적용 매핑

### 5-1. ADR-134 노선 β 직결 (AI 인프라)

| #   | 패턴                                                                                                                                       | 출처                                       | composition 대응                                                                                                                                                                                                                      |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **도구 지연 로딩 표면** (BM25 search + use_tool 디스패처, manifest 안정 = KV cache 보존, 검색 결과에 full schema)                          | grok-build §2-1                            | ADR-134 D11/Phase 9 — composition MCP 표면 + 도구 확장 시의 설계 정본. **3중 독립 수렴** 확인: grok-build / holaOS deferred-tool-gateway / Claude Code ToolSearch — 이제 업계 표준 패턴으로 봐도 된다                                 |
| 2   | **Provider capability 술어** (`ApiBackend` enum + `supports_native_schema()` 류 메서드 중앙화)                                             | grok-build §2-2                            | Phase 1 D1 — 2-way 어댑터 (Anthropic Messages/OpenAI-호환) 의 차이를 if 산개가 아니라 백엔드 술어로 구현. R8 (format 차이) 의 구체 처방. Messages 의 "schema ↔ tool use 상충 → StructuredOutput 도구 우회" 는 그대로 부딪힐 실무 지식 |
| 3   | **Retry/backoff 행동 스펙** (429 Retry-After 전액 대기 + 별도 시도 상한, 413 이미지 strip 1회, 영구-fatal 분류, 서버 override 헤더)        | grok-build §2-2                            | Phase 1 어댑터의 retry 정책 초안으로 이식 — 현행 GroqAgentService 의 429 retry 를 대체하는 명세                                                                                                                                       |
| 4   | **시스템 프롬프트 = 도구 렌더러와 동일 템플릿** (실존 도구 이름 interpolate, host 가 지킬 약속만 렌더)                                     | grok-build §2-1 + grok-prompts §4          | Phase 2 systemPrompt 재편 — 도구 rename/비활성과 프롬프트 drift 를 구조적으로 차단. grok-prompts 의 "상속 없는 파일 복제 + 최소 조건문" 교훈도 함께 (프롬프트에 템플릿 복잡도를 넣지 말 것)                                           |
| 5   | **Compaction 3계약** (tool 쌍 비분리 tail-keep / degenerate 요약 감지 / 압축 후 프롬프트 stub)                                             | grok-build §2-3 + xai API `CompactContext` | AIPanel 장기 대화 설계 시 (Phase 8 이후) — 지금은 계약만 기록                                                                                                                                                                         |
| 6   | **권한 5단 파이프라인** (deny>ask>allow 전 scope 병합, 체인 명령 세그먼트 단위 read-only 판정, LLM auto 분류기, hook 설치 경로 write-deny) | grok-build §2-3                            | Phase 9 — embed 에이전트의 도구 권한 scope (D11 "mutation 범위 제한 + 사용자 승인 게이트") 설계 reference                                                                                                                             |
| 7   | **결정적 replay 워크플로** (호스트 호출 저널, 비결정성 API 를 명시 에러로 등록, 2-phase budget 예약)                                       | grok-build Rhai 엔진 §2-3                  | D7 Plan→Execute→Verify 의 재시작 가능성·budget 상한 설계 reference (자기 수정 max 2회 계약과 동형 사상)                                                                                                                               |
| 8   | **위임 플러그인 mechanics** (2-PID 추적, locked CAS 종결 상태, 세션 이관 = 일방향 import + `~/.claude/projects` 밖 경로 거부)              | grok-build-plugin-cc                       | Phase 9 외부 에이전트 연동 시 잡 추적·취소 경합·전사 이관의 실무 세부                                                                                                                                                                 |

**ADR-134 격차 5 보강 사실**: grok-build 는 노선 β 수렴의 **5번째 독립 사례**다 — BYOK 멀티 백엔드 (Anthropic/OpenAI/Ollama/호환 3-way `ApiBackend`) + ACP 지원 + MCP 클라이언트 + 자체 로컬 LLM 내장 없음. 또한 Claude Code 설정 (`~/.claude/settings.json`·skills·hooks) 을 네이티브로 읽는 **하니스 간 설정 호환**이 업계 관행이 되고 있다 (holaOS 의 하니스 공유와 같은 방향).

### 5-2. 확장 생태계 / public SDK 경계 (후속 영역)

plugin-marketplace 의 배포 계약은 PENCIL_ECOSYSTEM_ANALYSIS §10 "public SDK capability boundary" 조사의 정본 reference 다:

- **2계층 content-addressable 고정**: 카탈로그의 40-hex full SHA (tag/branch/축약 거부) + 설치기가 clone 후 `git rev-parse HEAD == sha` 재검증
- 생성 인덱스 (`plugin-index.json`) 를 CI 가 **원격 fetch 로 재생성** — 도달 불가/force-push 된 커밋은 조용히 썩지 않고 CI 실패
- 일일 SHA bump 는 **version 게이트** (upstream `plugin.json` version 도 변해야 갱신 — docs-only 커밋으로 카탈로그 churn 방지) + stacked PR + 수동 리뷰 전용
- 보안 리뷰 기각 목록에 **"SKILL.md/description 에 설치측 에이전트를 노리는 프롬프트 주입"** 이 명시 — 에이전트 시대의 supply-chain 위협 모델을 문서화한 드문 사례
- 스캐너 하드닝: 항목 수/문자열 길이/읽기 바이트 상한 + symlink·`..` 경로 봉쇄 (`resolve_inside`)

### 5-3. 엔진·캔버스 (Rust/성능 이디엄)

composition-engine 과 Skia 씬 자료구조에 적용 가능한 **이디엄 카탈로그** (당장 반영이 아니라 다음 최적화·리팩토링 때 꺼내 쓰는 목록):

- **2-tier record 분리** (Thunder): hot 순회 리스트에는 16-byte 최소 레코드만, 본문은 1회 저장 — boundsMap/hitBoundsMap·renderCommands 류의 후보 구조 재설계 시
- **hot POD 에서 `Option` 대신 sentinel** — discriminant/niche 오버헤드 제거 (엔진 NodeStyle 해석 결과 같은 f32 다발 구조에 해당)
- **amortized shard sweep** (호출당 20% 만 GC) + **요청 내 조기 종료 → 부분 결과** — 프레임 예산이 있는 캔버스 쪽 정리 작업 (캐시 퇴거·인덱스 정리) 을 프레임에 나눠 싣는 표준형. **1차 소비처 후보**: 5k 프레임 드랍 지도 ([BUILDER_FRAME_DROP_BASELINE_5K.md](BUILDER_FRAME_DROP_BASELINE_5K.md) — 편집 205ms / 줌 p50 133ms / 스크롤 registry storm) 후속 최적화 착수 시 이 목록부터 참조
- **bit-pack 된 prefix 를 맵 키로** (SID 3-level 카운터) — 계층 키 집계를 튜플 할당 없이
- **`decided_by` 판정 체인** (visibility-filtering `Verdict`): composition 의 다단 판정 함수들 (`resolveSelectionDragIntent` / `resolveHoverGroupState` / 히트 판정 체인) 에 "어느 규칙이 결정했나" 를 결과에 싣는 저비용 디버깅 표면 — canvas-rendering.md 의 "선택이 가끔 안 되는 증상" 류 진단 시간을 직접 줄인다
- **균일 계측 데코레이터 + 요청당 1줄 요약** (candidate-pipeline): fullTreeLayout/renderCommands 단계 계측을 ADR-153 프로파일러 위에 얹을 때의 형태 — 단계별 latency/size 를 task-local 로 모아 프레임당 1줄
- **TUI 6단계 캐시 파이프라인**은 composition ADR-153 (Picture 캐시 + generation 무효화 + AABB 컬링) 과 **평행 진화 확인** — 새 차용이 아니라 현 설계의 교차 검증. 유일하게 가져올 것은 벤치 문서 형식: 단계 × (복잡도, 캐시 여부, 핫패스 여부) 표를 렌더 문서에 명문화하는 규율

### 5-4. AI 메모리·검색 (후속 ADR 영역)

- grok-build 메모리 스택: **sqlite-vec 가상 테이블이 곧 임베딩 캐시** (이중 캐시 없음) + chunker + query expansion + **MMR** + 백그라운드 "dream" 통합 (게이트: 세션 수/경과 시간, cross-process lock) — holaOS 메모리 (sqlite-vec + hybrid retrieval + reranker) 와 동일 계열. 두 사례가 같은 저장소 선택에 수렴.
- 다양성 재랭킹은 두 강도: **MMR** (grok-build 메모리 — 단순) ↔ **greedy DPP + incremental Cholesky** (vm-ranker — 품질×다양성 커널, O(k·m·k), filter-not-rescorer). composition 의 카탈로그 RAG (ADR-134 G5 실패 시 대안) 또는 메모리 검색 도입 시 MMR 먼저, DPP 는 중복이 실측 문제가 될 때.
- **snowflake/UUIDv7 ID-as-clock TTL**: composition 의 canonical id 가 시간 정보를 가진다면 (UUIDv7 채택 시) per-entry 타임스탬프 없는 시간 퇴거가 가능 — 캐시 설계 이디엄으로 기록.

---

## 6. 차용 불가 / 보류

1. **Phoenix 학습 스택 전체** (candidate isolation attention, semantic ID 학습, 커널 4종) — ML 학습 영역, composition 무관. "마스크 설계로 batch-invariance 달성" 이라는 관찰만 기록
2. **SIMD AVX 커널류** (f16 dot, embedding gather, non-temporal store) — composition 은 WASM 타깃 (AVX 부재). wasm simd128 검토는 별개이며, 실측상 현 병목은 커널 연산이 아니라 record/flush (`project-render-frame-decomposition-flush-vs-js`) — 측정 gate 없이 착수 금지
3. **deadline admission control / 배치 큐** — 서버 서빙 패턴. composition 은 클라이언트 — "stale 작업이 렌더러에 도달하지 않게" 원리만 (프레임 coalescing 으로 기구현)
4. **feature-switch 190-param 시스템** — 스케일·도메인 불일치. composition 은 featureFlags registry 계약 (canvas-rendering.md §10) 으로 충분. per-request 불변 스냅샷 원칙만 참고
5. **x-algorithm 도메인 로직** (랭킹 가중치, 필터 목록, 광고 blender) — 소셜 피드 고유
6. **grok-build wholesale** — 1.6M LOC 하니스 이식은 대상 아님 (Apache 2.0 이라 코드 차용 자체는 가능하나, 차용 단위는 §5-1 의 패턴·계약). 프롬프트 XOR 난독화는 composition 오픈 개발 방식과 상충 — 비차용
7. **grok-prompts 텍스트 복제** — AGPL-3.0. 구성 패턴 참조만, 문구 복제 금지. xai-cookbook 도 커스텀 Beta 라이선스라 코드 복제 주의

---

## 7. 한계

- 전 저장소 1회 스냅샷 (2026-08-18, §1 표의 HEAD 고정) — 이후 변경 미추적
- 빌드·실행 검증 없음. x-algorithm 요청 경로는 내부 crate 미포함으로 구조적으로 비빌드 (열람용 export) — 성능 수치는 전부 코드·문서상 주장
- Explore agent 실측 기반 — grok-build 91 crate 중 소형 유틸 ~50개는 역할 확인 수준
- 수치·경로 인용은 clone 시점 소스 기준. 코드 수준 차용 시 해당 파일 라이선스 헤더 재확인 필수 (특히 grok-build 의 codex/opencode port 디렉터리는 THIRD_PARTY_NOTICES 별도)
