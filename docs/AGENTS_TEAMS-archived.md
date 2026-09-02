# Agent Teams 사용 매뉴얼

> 작성일: 2026-02-11
> 대상: `.claude/agents/`, `.claude/settings.json`
> 요구사항: tmux, `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`

---

## 1. 개요

Agent Teams는 여러 Claude Code 인스턴스가 tmux 세션에서 **병렬 실행**되며, 공유 task list와 메시징으로 협업하는 기능이다. 각 에이전트는 독립 프로세스로 실행되어 서로 다른 파일을 동시에 작업할 수 있다.

```
┌─────────────────────────────────────────────────────┐
│ Team Lead (현재 Claude Code 세션)                     │
│  - 작업 분배, 결과 검토, 팀 조율                        │
├──────────┬──────────┬──────────┬────────────────────┤
│ tmux pane│ tmux pane│ tmux pane│ ...                │
│ Teammate │ Teammate │ Teammate │                    │
│ (Opus)   │ (Sonnet) │ (Sonnet) │                    │
│ architect│implement │ tester   │                    │
└──────────┴──────────┴──────────┴────────────────────┘
         ↕ 공유 Task List + 메시징 ↕
```

## 2. 사전 요구사항

### 2.1 tmux 설치

```bash
brew install tmux
tmux -V  # tmux 3.6a 이상 확인
```

### 2.2 설정 확인

`.claude/settings.json`에 아래 환경변수가 있어야 한다:

```json
{
  "env": {
    "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1"
  }
}
```

> 이미 프로젝트에 설정되어 있음.

## 3. 에이전트 구성

### 3.1 역할별 에이전트

`.claude/agents/` 디렉토리에 7개 에이전트가 정의되어 있다:

| 에이전트        | 모델   | 색상       | 용도                                      |
| --------------- | ------ | ---------- | ----------------------------------------- |
| **architect**   | Opus   | 🔵 blue    | 아키텍처 설계, 시스템 디자인, ADR 작성    |
| **refactorer**  | Opus   | 🟣 magenta | 코드 리팩토링, 구조 개선, 패턴 전환       |
| **debugger**    | Opus   | 🔴 red     | 버그 디버깅, 근본 원인 분석, 성능 추적    |
| **implementer** | Sonnet | 🟢 green   | 기능 구현, 컴포넌트 작성, API 연동        |
| **reviewer**    | Sonnet | 🟡 yellow  | 코드 리뷰, 품질 검사, 컨벤션 준수         |
| **tester**      | Sonnet | 🔷 cyan    | 테스트 작성 (unit, Playwright, Storybook) |
| **documenter**  | Sonnet | 🩷 pink    | 문서화, ADR 작성, 기술 문서 업데이트      |

### 3.2 모델 선택 기준

- **Opus**: 복잡한 추론, 다중 파일 영향 분석, 근본 원인 추적이 필요한 작업
- **Sonnet**: 패턴을 따르는 구현, 반복적 작업, 읽기 중심 분석

### 3.3 에이전트 파일 구조

```markdown
---
name: agent-name # 에이전트 식별자
model: opus | sonnet # 사용할 모델
color: blue # 터미널 색상 표시
tools: ["Read", "Grep"] # (선택) 도구 제한. 생략 시 전체 접근
---

[시스템 프롬프트 - composition 규칙 + 역할별 지침]
```

## 4. 사용 방법

### 4.1 자연어로 팀 요청 (가장 간단)

Claude Code에 팀 작업을 요청하면 자동으로 팀을 구성한다:

```
"이 기능을 팀으로 구현해줘. architect가 설계하고 implementer 2명이 병렬로 구현해줘"
```

```
"reviewer와 tester를 팀으로 구성해서 이 PR을 검토해줘"
```

```
"debugger가 원인을 분석하고, implementer가 수정하고, tester가 검증하는 팀을 만들어줘"
```

### 4.2 팀 생명주기

#### Phase 1: 팀 생성

Claude Code가 `TeamCreate`를 호출하여 팀을 생성한다:

```
TeamCreate("feature-auth", "인증 기능 구현 팀")
```

생성되는 파일:

```
~/.claude/teams/feature-auth/config.json    # 팀 설정
~/.claude/tasks/feature-auth/               # 공유 task list
```

#### Phase 2: 작업 생성 및 분배

Team Lead가 task를 생성하고 teammate에게 할당한다:

```
TaskCreate("로그인 API 구현", "Supabase Auth를 사용한 로그인 엔드포인트")
TaskCreate("로그인 폼 컴포넌트", "React-Aria 기반 로그인 폼 UI")
TaskCreate("로그인 E2E 테스트", "Playwright 로그인 플로우 테스트")
```

#### Phase 3: Teammate 스폰

Team Lead가 에이전트를 teammate로 스폰한다:

```
Task(subagent_type: "implementer", team_name: "feature-auth", name: "impl-1")
Task(subagent_type: "tester", team_name: "feature-auth", name: "test-1")
```

각 teammate는 독립 tmux pane에서 실행된다.

#### Phase 4: 병렬 작업

```
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│ Team Lead    │  │ impl-1       │  │ test-1       │
│ (조율/검토)   │  │ (로그인 API)  │  │ (E2E 테스트)  │
│              │←→│ Sonnet       │  │ Sonnet       │
│              │  │ implementer  │  │ tester       │
└──────────────┘  └──────────────┘  └──────────────┘
       ↕ 메시지 + 공유 Task List ↕
```

- 각 teammate는 할당된 task를 독립적으로 수행
- 완료 시 Team Lead에게 메시지 전송
- 블로커 발생 시 Team Lead에게 알림

#### Phase 5: 팀 해산

모든 작업 완료 후 Team Lead가 shutdown 요청:

```
SendMessage(type: "shutdown_request", recipient: "impl-1")
SendMessage(type: "shutdown_request", recipient: "test-1")
```

## 5. 실전 시나리오

### 5.1 새 기능 개발

```
"Events Panel 기능을 팀으로 구현해줘"
```

자동 구성 예시:

1. **architect** (Opus) → 기능 설계 및 컴포넌트 구조 결정
2. **implementer x2** (Sonnet) → UI 컴포넌트 + 상태 관리 병렬 구현
3. **tester** (Sonnet) → 테스트 작성

### 5.2 대규모 리팩토링

```
"스타일링 시스템을 리팩토링해줘. 3명 팀으로"
```

자동 구성 예시:

1. **refactorer** (Opus) → 리팩토링 계획 및 핵심 변환
2. **implementer** (Sonnet) → 패턴 전환 실행
3. **reviewer** (Sonnet) → 변환 결과 검증

### 5.3 버그 수정 + 검증

```
"Canvas 렌더링 버그를 팀으로 해결해줘"
```

자동 구성 예시:

1. **debugger** (Opus) → 근본 원인 분석
2. **implementer** (Sonnet) → 수정 구현
3. **tester** (Sonnet) → 회귀 테스트 작성

### 5.4 PR 리뷰

```
"이 PR을 reviewer와 tester로 팀 리뷰해줘"
```

자동 구성 예시:

1. **reviewer** (Sonnet) → SKILL.md 규칙 기반 코드 리뷰
2. **tester** (Sonnet) → 테스트 커버리지 분석

## 6. 커스터마이징

### 6.1 에이전트 수정

`.claude/agents/[name].md` 파일을 편집하여 시스템 프롬프트나 도구 제한을 변경할 수 있다.

예: reviewer에 Bash 도구 추가

```yaml
tools: ["Read", "Grep", "Glob", "Bash"]
```

### 6.2 새 에이전트 추가

`.claude/agents/` 에 새 `.md` 파일을 생성하면 자동으로 인식된다:

```markdown
---
name: security-auditor
description: |
  Use this agent when you need security audit or vulnerability analysis.

  <example>
  Context: User wants security review
  user: "보안 감사를 해줘"
  assistant: "I'll use the security-auditor agent."
  <commentary>Security audit needs specialized analysis.</commentary>
  </example>
model: opus
color: red
tools: ["Read", "Grep", "Glob"]
---

You are a security specialist...
```

### 6.3 도구 제한

`tools` 필드로 에이전트가 사용할 수 있는 도구를 제한할 수 있다:

| 용도           | tools 설정                          |
| -------------- | ----------------------------------- |
| 읽기 전용 분석 | `["Read", "Grep", "Glob"]`          |
| 문서 작성      | `["Read", "Write", "Grep", "Glob"]` |
| 전체 접근      | 필드 생략                           |

## 7. 비용 최적화

### 7.1 모델별 비용 차이

Opus는 Sonnet 대비 약 5배 비용이 높다. 역할별 모델 할당으로 비용을 최적화한다:

| 작업 유형     | 모델   | 근거                           |
| ------------- | ------ | ------------------------------ |
| 아키텍처 설계 | Opus   | 복잡한 추론, 트레이드오프 분석 |
| 리팩토링 계획 | Opus   | 다중 파일 영향 분석            |
| 버그 디버깅   | Opus   | 근본 원인 추적                 |
| 기능 구현     | Sonnet | 패턴 따라 코드 작성            |
| 코드 리뷰     | Sonnet | 체크리스트 기반 검토           |
| 테스트 작성   | Sonnet | 패턴 기반 반복 작업            |
| 문서화        | Sonnet | 구조화된 글쓰기                |

### 7.2 팀 크기 가이드라인

- **소규모** (2-3명): 일반 기능 개발, 버그 수정
- **중규모** (4-5명): 대규모 기능, 리팩토링
- **주의**: teammate가 많을수록 토큰 소비가 급증. 필요 최소한으로 구성

## 8. 트러블슈팅

### tmux 세션이 보이지 않음

```bash
tmux ls                    # 활성 세션 확인
tmux attach -t [session]   # 세션 연결
```

### teammate가 응답하지 않음

Team Lead에서 메시지를 보내 teammate를 깨울 수 있다:

```
SendMessage(type: "message", recipient: "impl-1", content: "진행 상황 알려줘")
```

### 팀 정리

```bash
ls ~/.claude/teams/        # 활성 팀 목록
ls ~/.claude/tasks/        # 팀별 task 목록
```

비정상 종료된 팀은 디렉토리를 수동 삭제할 수 있다.
