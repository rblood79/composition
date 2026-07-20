# ADR-158: Interactions 재설계 — EventsPanel 대체 (한 줄 규칙 + RAC capability registry + Preview 발화 수직 슬라이스)

## Status

Proposed — 2026-07-20

## Context

**Domain 판정 (ssot-hierarchy.md)**: D2 (Props/API) 중심 — 이벤트/기능 어휘를 RAC/RSP 레퍼런스 실존 callback·controlled prop 으로 재정의. D1 은 RAC callback 을 관찰·소비만 (침범 없음). D3 무관 (시각 스타일 비대상).

### 문제

ADR-149 Wave 1 (Implemented 2026-07-19) 은 EventsPanel 을 2-depth UX 로 재배열했으나, 사용자 재제기 (2026-07-20): **"여전히 너무 복잡한 구조이며, 기존 방식에서 달라진 것이 별로 없다"** — 복잡성 4축 (개념·단계 / 액션 25종 과잉 / 화면 밀도 / 코드 규모) 전부 문제로 확인. 전제 확정 종결 계약의 재개 조건 (a) 사용자 재제기 성립.

실측 (2026-07-20):

- `apps/builder/src/builder/panels/events/` **92파일 / 14,317 LOC** — 액션 에디터만 26파일
- `apps/builder/src/types/events/events.registry.ts` — DOM 별칭 이벤트 (`onClick`/`onMouseEnter`/`onKeyDown`) 와 RAC 이벤트 (`onPress`/`onSelectionChange`) **혼재**
- 동 파일 `IMPLEMENTED_ACTION_TYPES` — camelCase 28종 + snake_case 별칭 19종 이중 등록
- **이벤트를 올바로 소비하는 런타임 0개** (ADR-149 recon 확정: EventHandlerFactory dead / Preview 미발화 / publish `element.events` mismatch) — 14K LOC 편집기가 작동하지 않는 데이터를 생산 중

### Hard constraints

- **어휘 정합**: When 축 = RAC/RSP 레퍼런스 (`.claude/skills/react-aria/references/components/*.md`) 실존 callback 만. Do 축 capability = RAC controlled prop 1:1 근거 필수 (레퍼런스 전수 검증 완료 — breakdown §3 표)
- **canonical 자산 유지**: `CompositionDocument.events` root collection (ADR-131) + 단일 write 진입점 (ADR-149 `updateEventsRootCollection`) 계승 — entry 스키마만 교체
- **live behavior 게이트**: Preview 실제 발화를 Chrome MCP 로 exercise 하기 전 종결 금지 (CLAUDE.md 완료 기준)
- **성능**: 발화 dispatch 는 이벤트 시 1회 store patch — 60fps hot path 침범 금지
- **Generator 관여 없음**: 본 ADR 은 spec/CSS Generator 확장 아님 (D3 비대상) — Generator 지원 질문 해당 없음

### Soft constraints

- 신규 패널 ≤ 15파일 (목표 10) — 92파일 재발 방지
- dev 단계 — BC migration 불요 원칙 (기존 저장 이벤트 데이터 drop 허용 근거는 §Decision)

## Alternatives Considered

### 대안 A: 수직 슬라이스 전면 재작성 (한 줄 규칙 + capability registry + Preview 발화)

- 설명: 새 `panels/interactions/` 모듈 (10파일). 규칙 = `When(RAC callback) → Do(앱 액션 2종 | 대상 capability)` 한 줄. capability 는 RAC controlled prop 선언으로 registry 화 → 런타임 dispatcher 가 generic prop patch 1개 + 특례 2건 (Toast queue / Form requestSubmit) 로 수렴. Preview 발화 1경로를 같은 scope 에 포함. 기존 92파일·구 registry 은퇴.
- 위험: 기술(M — Preview controlled 배선 선행 조건) / 성능(L — 이벤트 시 1회 patch) / 유지보수(L — 14K→~2K LOC, 어휘 SSOT 단일 파일) / 마이그레이션(M — 기존 데이터 drop, 단 소비 런타임 0)

### 대안 B: 패널만 재작성, 런타임은 후속 ADR 유지

- 설명: UI 만 한 줄 규칙형으로 새로 만들고 발화 bridge 는 기존 backlog (ADR-149 이관분) 대로 별도 진행.
- 위험: 기술(L) / 성능(L) / 유지보수(**H** — "편집만 되는 패널" 3번째 반복. ADR-149 와 동일 함정: 작동 검증 불가능한 UI 를 또 생산) / 마이그레이션(L)

### 대안 C: 기존 구조 유지 + UI 축소 (trim)

- 설명: EventAccordionItem 을 규칙형 행으로 교체하고 액션 25종 중 core 만 노출 (나머지 숨김). 코드 구조는 유지.
- 위험: 기술(L) / 성능(L) / 유지보수(**H** — 92파일/14K LOC 와 어휘 이중 등록이 그대로 잔존. 복잡성 4축 중 1축만 대응) / 마이그레이션(L)

### Risk Threshold Check

| 대안  | HIGH+ 항목                       | 판정                                         |
| ----- | -------------------------------- | -------------------------------------------- |
| **A** | 없음 (기술 M / 마이그레이션 M)   | 통과                                         |
| B     | 유지보수 H (dead 편집기 3회째)   | 기각 — HIGH 회피 대안 A 존재                 |
| C     | 유지보수 H (규모·어휘 과잉 잔존) | 기각 — 사용자 진단 (4축 전부 문제) 과 불합치 |

모든 대안 HIGH 1+ 아님 (A 가 HIGH 0) — 추가 루프 불요.

## Decision

**대안 A 채택.** 사용자 confirm 완료 (2026-07-20 brainstorm — 복잡성 4축 확인 → 한 줄 규칙형 선택 → "각 컴포넌트마다 고유의 기능 위주 제공" + 앱 액션 2종(navigate/toast) 유지 → RAC 레퍼런스 controlled prop 전수 검증 반영 승인 → ADR 생성 명시 발의).

> 구현 상세: [158-interactions-rules-capability-registry-breakdown.md](design/158-interactions-rules-capability-registry-breakdown.md)

**위험 수용 근거**:

- 마이그레이션 M (기존 저장 이벤트 데이터 drop): **사용자 영향 0% 수식화** — 기존 데이터를 소비하는 런타임이 0개 (ADR-149 recon 실측) 이므로 drop 으로 소실되는 사용자-가시 동작이 존재하지 않음. dev 단계 BC migration 불요 원칙 부합.
- 기술 M (Preview controlled 배선): capability 등재 게이트 (G1) 로 전환 — uncontrolled 렌더 컴포넌트는 controlled 전환 완료 전 registry 등재 금지, 미배선 capability 가 사용자에게 노출될 경로 원천 차단.

**기각 사유**:

- B 기각: 소비 런타임 0 상태에서 편집기만 다시 만들면 ADR-149 와 동일하게 live 검증 불가능 — "작동하는 최소 체인" 없이는 재설계 성공 판정 자체가 불가.
- C 기각: 사용자 진단이 4축 전부 (코드 규모 포함) — UI 축소만으로는 재제기 원인 미해소.

**어휘 은퇴 결정**: `EVENT_REGISTRY` DOM 별칭 10종 (onClick/onDoubleClick/onMouseEnter/onMouseLeave/onMouseDown/onMouseUp/onKeyDown/onKeyUp/onKeyPress/onInput) 및 `IMPLEMENTED_ACTION_TYPES` 28종+별칭 19종 전체 은퇴. `condition`/`debounce`/`throttle`/다중 `actions[]`/템플릿·추천 엔진 스키마 원천 제거.

## Risks

| ID  | 위험                                                                                                      | 심각도 | 대응                                                                                                      |
| --- | --------------------------------------------------------------------------------------------------------- | :----: | --------------------------------------------------------------------------------------------------------- |
| R1  | Preview uncontrolled 렌더 컴포넌트 (기존 확인: Table selection uncontrolled 패턴) 에 capability 발화 불가 |  MED   | G1 — controlled 배선 완료 전 registry 등재 금지. Phase 0 inventory 에 controlled/uncontrolled 실태 표     |
| R2  | RAC `ToastQueue` 가 `UNSTABLE_` 접두 API — 업스트림 변경 가능                                             |  LOW   | 앱 액션 `toast` 1곳에 격리 — 변경 시 단일 파일 수정                                                       |
| R3  | 기존 저장 이벤트 데이터 drop — 잠재적 사용자 데이터 손실 인식                                             |  LOW   | 소비 런타임 0 실측 (영향 0%). CHANGELOG Breaking Changes 명기                                             |
| R4  | 구 92파일 삭제 시점 오판 — 신규 검증 전 삭제 시 회귀 불가                                                 |  MED   | G3 — G2 (live 발화) PASS + 사용자 명시 삭제 승인 전 삭제 금지                                             |
| R5  | publish 발화 미포함 (Preview 만) — Preview·publish 동작 격차 잔존                                         |  MED   | 스키마를 publish 가 그대로 소비 가능한 형태로 설계 (dispatcher 재사용 전제). 후속 ADR 이관 (breakdown §7) |

잔존 HIGH 위험 없음.

## Gates

| Gate | 시점       | 통과 조건                                                                                                      | 실패 시 대안                                       |
| ---- | ---------- | -------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| G1   | Phase 1    | capability registry 전 항목에 RAC controlled prop 근거 (`racRef`) 명시 + 정적 테스트로 근거 누락 차단          | 근거 없는 capability 등재 보류 (공통 show/hide 만) |
| G2   | Phase 3    | 실제 builder 에서 규칙 생성 → Preview 발화 4종 (navigate / toast / hide·show / modal open) Chrome MCP exercise | 발화 실패 원인 수정 전 Phase 4 진입 금지           |
| G3   | Phase 4    | G2 PASS + 구 panels/events 92파일 삭제에 대한 **사용자 별도 명시 승인**                                        | 삭제 보류 — 신규 패널만 활성 상태 유지             |
| G4   | Phase 2, 4 | 신규 모듈 ≤ 15파일 + type-check PASS + 구 registry 심볼 참조 grep 0건 (Phase 4)                                | 초과 시 파일 통합 재설계                           |

## Consequences

### Positive

- 사용자 개념 3개 (When / Do / 대상) — 조건·타이밍·템플릿·추천 제거로 1규칙 = 1행
- 코드 92파일/14.3K LOC → 목표 10파일 (~2K LOC 이내). 액션 핸들러 25종 → generic dispatcher 1 + 특례 2 + 앱 액션 2
- **빌더 최초의 실작동 이벤트 체인** — 규칙이 Preview 에서 실제 발화 (기존: 소비 런타임 0)
- 어휘가 RAC/RSP 레퍼런스와 1:1 — D2 정합, ADR-149 가 이관한 "Wave 2 RAC convention" 을 흡수 완결
- capability = controlled prop 선언이라 신규 컴포넌트 확장 시 registry 1항목 추가로 끝

### Negative

- 조건부 실행 / debounce·throttle / 다중 액션 체인 기능 소실 (의도적 — 필요 실증 시 후속 ADR)
- 기존 저장 이벤트 데이터 drop (영향 0% — 상기 수식화)
- publish 발화는 본 ADR 범위 밖 — Preview·publish 격차가 후속 ADR 까지 잔존 (R5)
- `panels/events/` 에 있던 ExecutionDebugger 등 부속 도구 동반 은퇴
