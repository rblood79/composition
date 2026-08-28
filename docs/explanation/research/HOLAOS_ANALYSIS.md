# holaOS 분석 — 멀티 하니스 로컬 워크스페이스 + ADR-134 노선 근거

**작성일**: 2026-08-18
**분석 대상**: [holaboss-ai/holaOS](https://github.com/holaboss-ai/holaOS) — shallow clone `HEAD fcdb405fc` (2026-08-18, PR #481 머지 직후. 당일 커밋이 있는 활성 저장소)
**분석 방법**: 저장소 shallow clone 후 README / 전 workspace `package.json` / 디렉터리 구조 / 핵심 모듈 파일 목록 / LICENSE 직접 read + 대상 grep. **소스 정독은 하지 않음** — 아래 서술은 의존성·모듈 경계·문서 수준의 실측이며, 내부 알고리즘 주장은 포함하지 않는다.
**관련 ADR**: [ADR-134](../../adr/completed/134-ai-assistant-llm-infrastructure-unification.md) (2026-08-18 노선 개정의 수렴 근거 4번째 reference)
**관련 문서**: [PENCIL_ECOSYSTEM_ANALYSIS.md](PENCIL_ECOSYSTEM_ANALYSIS.md) §격차 5 대응 축 — Pencil 생태계 3제품과 동일 방향 수렴의 독립 사례

---

## 1. 정체

**"The Computer for You and Your Agent"** — Claude Code / Codex / 자체 에이전트(Hola)를 하나의 로컬 우선(local-first) Electron 워크스페이스에서 나란히 실행하고, 공유 메모리·도구·앱을 함께 쓰게 하는 에이전트 워크스테이션 제품. Bun 1.3 + Turborepo monorepo, TS 파일 약 1,230개.

- **라이선스**: modified Apache 2.0 — SaaS/매니지드 재판매 및 상용 임베드에 별도 상업 라이선스 필요 + 프론트엔드 로고·저작권 표시 유지 조건 (Dify 와 사실상 동일 구조). 단일 조직 내부 사용은 자유
- **운영 방식 3종**: 데스크톱 앱 (내장 모델, zero-setup) / 오픈소스 self-host (BYOK) / 엔터프라이즈 (SSO + 역할별 권한 + 감사 로그)
- 중국계 팀 흔적: Feishu(Lark)/WeCom/DingTalk 채널 우선 지원

## 2. 구조

```
holaOS/
├── apps/desktop/          # Electron (holaboss-local) — React 19 + Vite + Tailwind v4,
│                          #   base-ui/shadcn, jotai + TanStack Query, tiptap 3, oRPC, electron-updater
├── runtime/               # 데스크톱에 번들되는 in-process 런타임 (독립 실행 가능)
│   ├── api-server/        # Fastify + WebSocket — 에이전트 실행 파이프라인, 메모리, 채널, cron 자동화
│   ├── harness-host/      # 하니스 실행 계층 — pi.ts / claude-code.ts / codex.ts
│   ├── harnesses/         # 문서 생성 등 하니스 공용 도구
│   ├── state-store/       # better-sqlite3 + sqlite-vec — store.ts 단일 파일 1만 줄+
│   └── channel-gateway/   # 메신저 채널 연결 (Slack / Lark / WeCom / DingTalk / Discord SDK)
├── packages/              # app-sdk / app-host / app-builder-sdk (HolaApps),
│                          #   remote-api (oRPC 계약), runtime-client, editor, ui
└── scripts/hola.mts       # 데스크톱 없이 자체 브레인을 in-process 실행하는 디버그 CLI
```

## 3. ADR-134 관련 실측 — AI 인프라 축

### 3-1. 하니스 추상화 (핵심 정체성)

`runtime/harness-host` 가 세 하니스를 같은 계약으로 감싼다:

| 하니스         | 구현 근거 (의존성 실측)                                                                 |
| -------------- | --------------------------------------------------------------------------------------- |
| 자체 (Hola/pi) | `@earendil-works/pi-coding-agent` 0.80.2 고정 (Mario Zechner 의 오픈소스 pi) 위 `pi.ts` |
| Claude Code    | `@anthropic-ai/claude-agent-sdk` 경유 `claude-code.ts`                                  |
| Codex          | `openai` SDK 경유 `codex.ts`                                                            |

하니스 간 도구 표면 정규화 모듈: `harness-registry` / **`deferred-tool-gateway`** (도구 스키마 지연 로드 — Claude Code 의 ToolSearch 와 동일 발상) / `consolidate-tool-family` (도구 패밀리 통합). MCP 는 `@modelcontextprotocol/sdk` 로 별도 지원.

### 3-2. 모델 공급 — built-in + BYOK 병존

내장 모델 (제품 계정 경유, 키 관리 없음) + **BYOK** (OpenAI / Anthropic / OpenAI·Anthropic-compatible endpoint — 사용자 계정 요금). 자체 로컬 LLM 내장 (node-llama-cpp 류) 은 **없다**. API 키·인증은 브라우저(렌더러)가 아니라 메인 프로세스/런타임 소관 (`better-auth` + Electron 어댑터, 데스크톱 로그인을 CLI/런타임이 재사용).

### 3-3. 공유 메모리 (2계층)

마케팅 문구는 "로컬 평문 파일로 읽고 편집 가능"이지만, 실체는 2계층 — 평문 파일 + `state-store` 의 구조화 저장/임베딩 검색. api-server 에 메모리 관련 파일만 40개+: embedding index (sqlite-vec vec0 가상 테이블), hybrid retrieval, reranker, memory governance, turn 단위 writeback, workspace memory graph, memory repair, 사용자 승인형 memory proposal. 하니스(에이전트) 간 컨텍스트가 이 계층으로 공유된다.

### 3-4. 기타 표면 (참고)

- **실산출물 지향**: exceljs / html-to-docx / pptx-renderer / docx-editor-react / unpdf — 결과를 채팅 텍스트가 아닌 실제 `.xlsx`/`.pptx`/`.docx` 로 저장·렌더·편집
- **브라우저 자동화**: `playwright-core` 를 Electron browser-pane 으로 통합
- **외부 통합**: Composio API 위임 (50+ OAuth 통합 — 자체 구현 아님)
- **HolaApps**: 에이전트 옆에 실제 앱 UI 를 띄우고 에이전트가 조작하는 side-by-side 모델 (app-sdk/app-host)
- **debug CLI** (`scripts/hola.mts`): 데스크톱의 실제 실행 파이프라인을 그대로 태우고 하니스 서브프로세스만 in-process 로 교체하는 "faithful debug" + live DB(`data.db-wal` hot) 감지 시 실행 거부하는 쓰기 경합 가드

## 4. ADR-134 노선 β 와의 정합 — 무엇의 근거인가

holaOS 는 Pencil 생태계 3제품과 **독립적으로 같은 방향에 도달**한 4번째 사례다:

| ADR-134 노선 β 요소                   | holaOS 대응물                                                                          |
| ------------------------------------- | -------------------------------------------------------------------------------------- |
| 멀티 프로바이더 BYOK                  | built-in + BYOK (OpenAI / Anthropic / 호환 endpoint) 병존                              |
| 자체 로컬 LLM 내장 없음               | 동일 — 없음 (노선 α 고립성의 4번째 방증)                                               |
| 외부 코딩 에이전트 통합 (D11/Phase 9) | harness-host 3-way (pi / Claude Code / Codex) — **하니스 계약이 제품 정체성**          |
| MCP 도구 표면 (D11)                   | MCP SDK + deferred-tool-gateway (도구 스키마 지연 로드)                                |
| secret isolation (D10)                | 키·인증이 렌더러 밖 (메인 프로세스/런타임) — browser 노출 구조 자체가 없음             |
| R2 (BYOK 온보딩 공백) 의 해소 사례    | "built-in 모델 + BYOK 병존" — 제품 부담 proxy 운영의 실존 사례 (scope 밖 판정 시 참조) |

## 5. 차용 후보 / 차용 불가

### 차용 후보

1. **deferred tool gateway 패턴** — MCP/도구 표면이 커질 때 스키마 지연 로드로 컨텍스트 예산 방어. ADR-134 Phase 9 (composition MCP server) 설계 시 reference
2. **하니스 계약 경계** — 에이전트 종류와 무관하게 도구·컨텍스트·이벤트 스트림을 동일 계약으로 감싸는 harness-host 구조. Phase 9 의 "자체 AgentLoop 와 embed 에이전트 병존 계약" reference
3. **메모리 2계층 (평문 파일 + 임베딩 인덱스)** — AI 컨텍스트/메모리는 ADR-134 scope 밖이나, 후속 ADR 에서 하니스 간 공유 컨텍스트 설계 시 reference
4. **faithful debug CLI** — 실제 파이프라인을 유지한 채 하니스만 in-process 교체 + live DB 경합 가드. AI agent loop 디버깅 도구화 시 reference

### 차용 불가 / 보류

1. **Electron 전제 subprocess 하니스** — Claude Agent SDK / Codex SDK embed 는 subprocess 실행 필요. composition 웹앱 현 단계에서 차단 (ADR-134 R1 과 동일 축 — Phase 9 Electron 의존의 재확인)
2. **Composio 위임** — 외부 SaaS 의존. composition 의 통합 요구가 생기면 별도 판정
3. **채널 게이트웨이 / HolaApps side-by-side** — composition product scope 밖
4. **modified Apache 2.0 조항** — 코드 차용 시 라이선스 조건 (상업 임베드 제한) 검토 필수. 본 분석은 패턴 reference 로 한정

## 6. 한계

- shallow clone 1회 스냅샷 (`fcdb405fc`, 2026-08-18) — 이후 변경 미추적
- 의존성·모듈 경계·문서 수준 실측 — 내부 알고리즘 (메모리 랭킹, 하니스 이벤트 계약 상세) 은 소스 정독 전이라 주장하지 않음
- 성능 수치 없음 — 본 문서는 아키텍처 방향 근거로만 사용할 것
