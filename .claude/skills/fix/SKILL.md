---
name: fix
description: 버그 수정 파이프라인 — root-cause 4단계 (재현 → 가설 → 검증 → 수정) 로 원인을 확정한 뒤 수정하고, 렌더링이면 cross-check, 동일 패턴은 일괄 sweep, 사용자-가시 버그는 live exercise 로 닫는다. "버그", "안 돼", "깨져", "회귀", "고쳐줘", "fix" 요청 시 발동. 증상만 덮는 workaround 금지.
argument-hint: [버그 설명]
---

# Fix — root-cause 수정 파이프라인

"$ARGUMENTS" 버그를 root-cause 까지 추적하여 수정한다. 메인 컨텍스트에서 실행한다 (수정 권한 필요). 격리 조사가 필요한 복잡한 케이스만 `debugger` agent 로 넘긴다 — debugger 는 이 skill 을 preload 하므로 아래 패턴 목록을 같이 본다.

## 파이프라인

1. **root-cause 4단계** — 재현 (일관된 트리거 확보) → 가설 (해당 코드 경로 실측 인용) → 검증 (가설이 증상을 설명하는지 확인) → 수정. **수정 전에 원인 확정 필수**. 도메인 병인은 `.claude/rules/` 의 실측 "Why" 기록부터 조회 — 같은 증상이 이미 진단돼 있는 경우가 많다
2. 복잡한 경우 `debugger` agent 위임 — 읽기 전용 격리 조사 → 수정안 반환 (debugger 컨텍스트 안에서는 이 단계 없음)
3. 렌더링 관련이면 수정 후 `/cross-check` 필수
4. 동일 패턴 이슈 → codebase grep → 한 번에 일괄 sweep
5. `pnpm type-check` 통과 확인
6. 사용자-가시 버그면 실제 builder 실동작 1회 exercise (`/evaluate`, Chrome MCP 직접, 또는 사용자 confirm) + 무엇을 exercise 했는지 보고 명시 — CLAUDE.md §완료 기준
7. 완료 시 CHANGELOG 반영 판정 — 사용자-가시 버그 수정이면 docs/CHANGELOG.md Bug Fixes 반영 (rules/changelog.md 트리거 #2)

## 금지

- 증상만 덮는 workaround
- eslint-disable / @ts-ignore / `any` 신규 추가
- 근본 원인 미확인 상태로 "고쳤다" 선언

## Error Recovery Protocol (루프 감지)

1. 같은 수정을 3회 이상 반복하지 않는다. 2회 실패 후 "같은 접근 2회 실패. 접근 방식을 전환합니다." 를 명시하고 다른 전략을 시도한다
2. 에러 분류: transient 는 재시도, permanent 는 즉시 전략 전환
3. 전략 전환 후에도 해결 안 되면 사용자에게 에스컬레이션 — 시도한 것, 실패 이유, 남은 가설

## 자주 발생하는 문제 패턴 (진단 시작점)

### Canvas 렌더링

- CanvasKit WASM 초기화·기능 플래그 확인
- DirectContainer 레이아웃 속성 검사, composition-engine (Rust WASM) 계산 결과 검증 — `packages/composition-engine` 에서 `cargo test` (`tests/tree_golden.rs` 가 회귀 감시)
- grid 컨테이너 stale degrade: 신규 grid / 신규 자식 서브트리 컨테이너 등록과 `GRID_REBUILD_TRIGGER_KEYS` 20-key (padding/gap/gridTemplate/width/height/min·max) 변경은 full rebuild 필수 — 증분 갱신만 타면 1줄 degrade (정본 `.claude/rules/layout-engine.md`)
- 뷰포트 컬링·히트 영역 계산

### 상태 관리

- 파이프라인 순서 `Memory → Index → History → DB → Preview` 유지 여부
- canonical document ↔ elementsMap/childrenMap mirror 정합성 (ADR-122 — mirror 는 read-only derived)
- 히스토리 기록이 변경 전에 수행되는지, Zustand 슬라이스 경계
- ADR-137 Selection Consumer Contract: page-bound mutation 이 deferred `SelectedElement` / stale `pageId` closure 를 commit source 로 쓰지 않는지 — selection 경로는 commit 시점 `readImmediateSelectionSnapshot()` + `apply*FromSelection(snapshot, ...)`, projection/editing context 는 `apply*Explicit({ pageId, contextReason, ... })`

### 성능

- 기준: Canvas/Skia native refresh cadence, 60Hz 환경 p95 frame time 최소선, 초기 로드 < 3초, 초기 번들 < 500KB
- Canvas 루프 비싼 연산 프로파일링, React 불필요 리렌더, hot path array traversal 금지 (canonical selectors 우선, `elementsMap` 은 read-only derived fallback), 동적 임포트 기회

### 통신 (Builder ↔ Preview)

- postMessage origin 검증, PREVIEW_READY 버퍼링 초기화 경쟁 조건, Delta 메시지 형식
