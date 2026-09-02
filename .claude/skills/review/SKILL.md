---
name: review
description: 완료 직전 코드 리뷰 — reviewer 격리 컨텍스트에서 SSOT 3-Domain + 9개 CRITICAL 체크리스트를 대조하고 신뢰도·심각도 태그로 전부 보고한다. "리뷰해", "코드 리뷰", "검토해줘", "완료 전 검증", "review" 요청 또는 작업 완료 선언 직전에 발동. ADR 문서 리뷰는 review-adr, 런타임 동작 검증은 evaluate.
argument-hint: [검토 범위 — 생략 시 dirty 변경 + HEAD 커밋]
context: fork
agent: reviewer
background: false
---

# Review — 완료 직전 코드 리뷰 (reviewer 격리 실행)

이 skill 은 `reviewer` agent 안에서 실행된다 (`context: fork`). 대화 이력은 보이지 않으므로 검토 범위를 스스로 확정한다. 수정 권한은 없다 — 보고만 하고, 수정은 메인 세션이 한다.

## 0. 검토 범위 확정

- `$ARGUMENTS` 가 있으면 그 범위 (파일 / 디렉터리 / 커밋 / 기능 설명).
- 없으면 `git status --short` + `git diff` (unstaged·staged) 를 기본으로 하고, dirty 가 없으면 `git show --stat HEAD` + `git diff HEAD~1`.
- 변경 파일마다 실제 내용을 Read 한다. 읽지 않은 코드에 대한 지적·제안 금지.
- **tool 호출 예산 20회** (실측: foreground fork 는 25회 부근에서 보고 없이 끊긴다 — 2026-09-02). diff 는 파일별로 나누지 말고 한 번에 받고, 원본 대조 (`git show HEAD:path`) 는 한 Bash 호출에 묶고, Read 는 변경 파일만. 15회를 넘기면 조사를 멈추고 그때까지의 결과로 최종 보고를 낸다 — 보고 없는 종료가 최악이다.

## 1. 근거 우선

"통과했다 / 고쳤다" 는 주장이 아니라 실행 출력이 근거다. 변경이 테스트를 동반하면 해당 테스트를 `pnpm vitest run <path>` 로 직접 실행하고 결과를 보고에 첨부한다. 실행하지 않은 것을 통과로 서술하지 않는다.

## 2. SSOT 3-Domain 위반 (CRITICAL)

- D1 침범: Spec/catalog 가 DOM 구조·ARIA 지정, RAC 컴포넌트 DOM 재작성 → 거부
- D2 위반: RSP 미규정 prop 임의 도입 → 거부 (ADR-062)
- D3 위반: 수동 CSS 가 catalog/잔존 spec 파생 아님, `@sync` CSS↔CSS 참조, "CSS 기준·Skia 따라가" 언어 → 거부
- 대칭 해석 오류: "구현 방법 일치" 요구 → 대칭은 **시각 결과 동일성**이지 구현 통일 아님

정본: `.claude/rules/ssot-hierarchy.md` / ADR-063 / ADR-142.

## 3. CRITICAL 규칙 체크리스트

### 3-1. 스타일링

- [ ] 인라인 Tailwind 클래스 없음 → tv() + CSS 파일
- [ ] React-Aria 컴포넌트에 react-aria-\* CSS prefix
- [ ] CSS 클래스 재사용, 중복 없음
- [ ] Builder 아이콘 버튼에 공유 `Button variant="ghost"` 미사용 → `ActionIconButton`

### 3-2. TypeScript

- [ ] `any` 없음 → 명시적 타입
- [ ] export 함수에 명시적 반환 타입
- [ ] 적절한 제네릭

### 3-3. Canvas (Skia)

- [ ] DirectContainer 패턴 (엔진 결과 x/y 직접 배치)
- [ ] display 별 엔진 선택 규칙 — 정본 `.claude/rules/layout-engine.md` §엔진 선택
- [ ] 신규 grid container / 신규 자식 서브트리 컨테이너 등록, `GRID_REBUILD_TRIGGER_KEYS` 20-key (padding/gap/gridTemplate/width/height/min·max) 변경은 full rebuild 필수 — 증분 갱신만 타면 stale degrade

### 3-4. 보안

- [ ] postMessage 핸들러 origin 검증
- [ ] PREVIEW_READY 버퍼링으로 초기화 처리
- [ ] 컴포넌트에서 Supabase 직접 호출 없음

### 3-5. 상태 관리

- [ ] 상태 변경 전 히스토리 기록
- [ ] element 검색은 canonical selectors 또는 read-only `elementsMap` — array traversal 금지 (ADR-122)
- [ ] Zustand StateCreator factory 패턴, 슬라이스 파일 모듈화
- [ ] ADR-137 Selection Consumer Contract — page-bound mutation 이 deferred `SelectedElement` / stale `pageId` closure 를 쓰지 않고 `readImmediateSelectionSnapshot()` 기반 FromSelection 또는 `contextReason` 있는 Explicit 진입점으로 분류

### 3-6. 성능

- [ ] barrel import 번들 비대화 없음, 무거운 모듈 동적 임포트
- [ ] 독립 비동기 작업 Promise.all, 빈번 조회 Map/Set

### 3-7. 레이아웃 / Spec / catalog

- [ ] 레이아웃 영향 props 변경 시 `layoutVersion + 1`
- [ ] 요소 순서 변경이 canonical `children[]` 순서 SSOT 를 따름 (ADR-118 — `order_num` 은 mirror, 직접 재정렬 로직 신설 금지)
- [ ] shapes 내 TokenRef 를 `resolveToken()` 으로 변환
- [ ] `variant.background*` 직접 access 없음 → `resolveFillTokens()` / `resolveIndicatorFill()` (ADR-908)
- [ ] `props.style?.gap` / `padding` shorthand 단독 읽기 없음 → longhand 우선 + shorthand fallback (ADR-909)
- [ ] collection renderer root 에 `style={element.props.style}` 전달 (ADR-907 — `rendererStyleContract.test.ts` allowlist 빈 Set)
- [ ] `renderNodesMap.get(x) ?? sceneNodesMap.get(x)` 류 render fallback 없음 — `sceneNodesMap` 은 diagnostic 전용 (ADR-135/136)

### 3-8. 검증

- [ ] 경계 입력 검증에 Zod
- [ ] 컴포넌트 Error Boundary 래핑

### 3-9. ADR 품질 (설계 문서가 범위에 포함될 때)

- [ ] Alternatives Considered 최소 2개, 각 대안 4축 위험 평가 (기술/성능/유지보수/마이그레이션)
- [ ] 순서 Alternatives → Decision, Decision 에 "위험 수용 근거"
- [ ] Risks 섹션이 Decision 뒤 / Gates 앞 ID 표 (또는 "잔존 HIGH 위험 없음")
- [ ] Risk Threshold Check 표 + HIGH+ 대안 루프 판정, HIGH 잔존 시 Gates 섹션
- [ ] 모든 대안이 HIGH 면 대안 추가 필요 여부 검토

## 4. 신뢰도 점수 + coverage 정책

각 이슈에 0-100 신뢰도: 0-25 낮음 (의도적일 수 있음) · 25-50 보통 · 50-75 높음 · 75-100 심각 (확실히 수정).

**coverage 우선 — 정성 컷 금지**: 이 단계의 목표는 필터링이 아니라 coverage 다. 각 이슈에 confidence + severity 를 태그로 붙여 보고하고, 불확실하거나 low-severity 로 보이는 것도 함께 보고한다. confidence 컷 (예: ">= 80 만 보고") 으로 침묵시키지 않는다 — 최신 세대 모델은 "be conservative / only high-severity" 지시를 충실히 따라 실 버그를 누락한다 (precision 은 오르고 measured recall 이 떨어진다). **결과-기반 기준만 적용**: 오작동·테스트 실패·오해를 유발할 수 있는 이슈는 confidence 무관 전부 보고, 순수 스타일/네이밍 취향 nit 만 생략. 사용자가 "high-severity 만" 을 명시한 경우에만 그 기준으로 후속 필터링.

## 5. 출력 형식

요약 헤더: 검토 범위 · 실제로 실행한 명령과 결과 · 이슈 수 (CRITICAL / HIGH / MEDIUM / LOW). 이어서 이슈별:

```markdown
### [CRITICAL|HIGH|MEDIUM|LOW] 이슈 제목

- **파일**: path/to/file.ts:line
- **규칙**: rule-name (composition-patterns SKILL.md / .claude/rules 기준)
- **신뢰도**: XX/100
- **문제**: 문제 설명
- **제안**: 수정 방법
```

마지막에 "메인 세션 메모리 기록 후보" 를 한 줄씩: 반복 발견 패턴, false positive 로 판명된 케이스, 규칙의 의도적 예외. 한국어로 설명, 코드·기술 용어는 영어 유지.

## 6. 반환 후 메인 세션 의무 (호출자)

- CRITICAL / HIGH 즉시 수정 — 스킵 금지
- `pnpm type-check` 실행 결과 첨부
- 렌더링 변경 포함 시 `/cross-check`
- 렌더 / wiring / schema 변경 포함 시 실동작 1회 exercise — `/evaluate` 또는 사용자 confirm (CLAUDE.md §완료 기준)
- 통과 조건 충족 시에만 "완료" 선언
