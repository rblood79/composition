# ADR-150: RAC·Pencil 잔여 상호작용 3축 실행 — Skia 상태 threading · collection 가상화 스크롤 · projected drill-in edit (ADR-912 후속)

## Status

Accepted — 2026-07-18 (리뷰 round 2 승인 — 이슈 0건, 합의 완료 → Accepted 승격 · execute-adr A1 착수)

> 진행 로그:
>
> - Proposed 2026-07-13 (리뷰 round 1 반영 개정 2026-07-14) → Accepted 2026-07-18 (reviews/150.md round 2 이슈 0건)
> - **Phase A1 (Skia hover/pressed/focusVisible 상태 threading) Implemented 2026-07-19** — S2 hover(`d2b7a1b2f`) · S3 pressed(`99947f241`) · S4 focusVisible+focus ring(`e98ab8887`, cross-check 색 정정 `433ba3a6c`). 무효화 채널 = **hovered/pressed/focused 노드 한정 overlay draw pass**(R1 후보 b — `overlayVersion` 재사용, sceneVersion signature 미변경 → scene rebuild 0, ADR-136 §9 준수). G-A1: 3축 threading 정확성 + state→fill 대칭(Skia·DOM 동일 catalog `FillStateTokens`, shared source) + focus ring theme accent(=`var(--accent)`)/2px/offset2 DOM 대칭 + disabled 우선순위 보존(회귀 0) 확증. hover/pressed live-verified, focus ring 결정적 확증(ringSet). exact pixel 3축 시각 + pointermove FPS 는 foreground 사용자 확인(hidden-탭 RAF pause 로 자동화 캡처 불가). A2/A3 미착수 — ADR Status 는 Accepted 유지.

> **문서 위상: 실행 ADR (ADR-912 후속)**. [ADR-912](completed/912-rac-pencil-rebuild-cutover.md)(백지 직행, Implemented 2026-06-18)가 승격 시점에 명시 기록한 잔여 — [ADR-911](911-rac-pencil-target-component-architecture.md) R-3 잔여(가상화 스크롤 60fps + drill-in data edit UI) + R-4 잔여(hover/pressed/focusVisible interaction threading) — 를 단일 scope 로 실행한다. 사용자 결정 2026-07-13 (AskUserQuestion "새 실행 ADR 1건 작성"). 910/911 은 비실행 참조 위상 그대로 존속하며, 본 ADR 완료 시 911 의 proof gate G-state(hover/pressed/selected 3축)/G-projected 잔여 증명이 충족된다.

## Context

ADR-912 완결로 catalog 단일 SSOT 전환·spec 전수 삭제·`skiaLegacy` 플래그 제거는 끝났으나, Skia editor surface 의 상호작용 3축이 미완으로 남아 실행 owner 가 부재하다 (2026-07-13 활성 ADR 전수 확인 — 148 reusable·slot / 915 prop parity / 149 events panel 모두 직교):

1. **Skia hover/pressed/focusVisible 상태 시각 부재** — `packages/specs/src/utils/racStateAttrs.ts:14-16` 이 disabled 만 derive 하고 hover/pressed/focusVisible 는 "후속" 명시 상태(912 기록 잔여 3종 전부 — focus ring 활성화도 이 threading 을 대기: `buildSpecNodeData.ts:1541-1542`). 시각 데이터 자체는 catalog `FillStateTokens`(ADR-908)에 이미 존재하고(hover 341/pressed 271개 값 실측, `buildCatalogShapes.ts:163-170` state→fill 분기 실재) threading 만 없다. 단 **상태 변화를 그리기에 도달시키는 무효화 채널도 부재**하다 — command stream 캐시는 4중 버전 키 단독(`renderCommands.ts:222-256`)이라 채널 신설이 A1 의 1차 설계 산출물이다 (R1).
2. **collection 가상화 스크롤 부재** — `packages/shared/src/collections/resolveCollectionItems.ts:28` 의 `COLLECTION_ROW_PROJECTION_WINDOW_LIMIT = 100` 정적 cap. 910 breakdown §4.7 이 "slice(0,N) 은 culling 이 아니다"로 규정한 바로 그 상태라 대용량 row 에서 성능·정확성이 성립하지 않는다. window 소비자는 캔버스 draw/hit 외에 **LayerTree 패널**(`useLayerTreeData.ts:12` → 동일 LIMIT 재export 체인)이 있어 패널 정책 분리가 필요하다 (R2).
3. **projected 깊은 노드 편집 부재** — `apps/builder/src/builder/workspace/canvas/scene/canvasSceneNode.ts:1077,1254` "독립 hit/remove mutation 은 후속(현 slice 는 시각 대칭)". row projection 은 시각 대칭까지만 도달했고 drill-in/data edit route 가 없어 "빌더 Skia 화면 = 직접 조작 editor" 요구(910/911 HC#7)가 미충족이다. 기존 land 패턴은 deepest 선택이 아니라 **owner select redirect**(chip/cell 클릭 → 소유 컨테이너 선택)이므로 selection read 계약 재설계가 동반된다 (R4).

**선행 의존 (리뷰 round 1 반영, 2026-07-14)**: ADR-916 사후 parity sweep 에서 라이브 발산 백로그(collection family 포함 — Table/Tree/Card 계열)가 확정돼 있다(메모리 `project-adr916-post-cutover-parity-sweep-inventory`, 재현 하니스 adr916-parity-sweep). A2 의 row height 측정·content height 정확성·G-A2 판정 환경이 이 엔진 layout 결과에 의존하므로, **A2 착수 전 collection 축 발산 정리 또는 fixture 격리 확인이 선행**돼야 한다 (R6).

**3-domain 분류 (ADR-063)**: D3 시각(상태 fill 은 기존 catalog rule 소비 — schema 확장 0) + render-space interaction(ADR-135/136 Render-Space Boundary 계약 준수). D1 은 침범하지 않는다 — DOM 쪽 hover/pressed 는 RAC 가 자동 소유하며, 본 ADR 은 Skia editor surface 한정.

**Generator 선언 (선차단 #2)**: catalog rule schema·CSS generator 확장 없음 — `FillStateTokens.hover/pressed/selected` 는 ADR-908 로 기존재하고 CSS 경로는 이미 소비 중. 본 ADR 은 Skia 소비 경로만 잇는다.

**BC 수식화 (선차단 #3)**: additive — canonical 문서 schema 무변경, 기존 프로젝트 재직렬화 0건, props/public API 변경 0.

### Hard Constraints

1. **60fps 무회귀**: pointer hot path(pointermove)에서 전체 scene rebuild 금지 — sceneVersion signature 계산은 pointer hot path 금지(ADR-136, `.claude/rules/canvas-rendering.md` §9).
2. **projected id canonical 비유입**: projected render id 는 canonical mutation/history/IndexedDB 유입 0건 (ADR-135/136 계약, negative fixture 로 강제).
3. **상태 시각 대칭**: Skia 상태 시각은 RAC `data-*` vocabulary(data-hovered/data-pressed/data-selected)와 동일 규칙으로 derive — 독자 상태 모델 금지.
4. **기존 collection 기능 회귀 0**: row 편집·selection·정렬 등 기존 동작이 window/drill-in 전환 후 회귀 없음 (910 G-parity collection 승계).

### Soft Constraints

- 축 간 공유 인프라(hit tree ↔ draw tree 동일 window)는 중복 설계 없이 단일 소스.
- ListBox 선행 proof 후 GridList/Table 확산 (910 roadmap 순서 승계).
- ADR-148 Phase 4(collection item slot 이식)와 A2/A3 이 동일 projection 표면(`canvasSceneNode.ts`)을 공유 — 후행 착수 측이 선행 측 land 상태를 phase 진입 시 재실측 (148 breakdown Phase 4 조정 조항과 대칭).

## Alternatives Considered

### 대안 A: 단일 실행 ADR — 3축 phase 순차 (A1 상태 → A2 window → A3 drill-in)

- 설명: 본 ADR 하나가 3축을 소유하고 A1(독립) → A2(토대) → A3(A2 hit tree 의존) 순으로 실행.
- 근거: 910/912 의 phase 실행 패턴 재사용. A2/A3 은 hit tree·window 를 공유하므로 한 문서에서 설계 일관성 유지. RAC 는 hover/press 를 hook(useHover/usePress) 데이터 속성으로 노출하는 것이 공식 패턴이라 A1 은 그 vocabulary 재사용으로 좁게 끝난다.
- 위험: 기술 H — pointer hot path 성능 + window↔layout 동기화 미검증 (본질 위험, 어느 대안이든 동일) / 성능 M / 유지보수 L — 잔여 기록·게이트·리뷰가 한 곳 / 마이그레이션 L — additive.

### 대안 B: 축별 독립 ADR 3건 분리

- 설명: 상태 threading / 가상화 / drill-in 을 각각 별도 ADR 로.
- 근거: 축별 리뷰 격리. 업계에서 virtualization 과 interaction 을 별개 모듈로 두는 사례(react-window 류) 존재.
- 위험: 기술 H — 동일 본질 위험이 3 문서로 분산돼 축간 공유 인프라(hit tree/window) 계약이 문서 간 drift / 성능 M / 유지보수 H — 게이트·리뷰 3배 + A2↔A3 의존이 ADR 경계를 가로질러 추적 비용 증가 / 마이그레이션 L.

### 대안 C: 실행 보류 (현행 유지)

- 설명: 912 잔여 기록 + 910/911 reference 로만 남기고 착수하지 않음.
- 근거: 변경 비용 0.
- 위험: 기술 L / 성능 H — 정적 cap 100 초과 데이터에서 성능·hit 정확성 미성립 영구화 / 유지보수 H — "Skia 화면 = 직접 조작 editor" 요구(HC#7) 미충족 영구화 + hover/pressed 시각 부재로 빌더 UX 열위 지속 / 마이그레이션 L.

### Risk Threshold Check

| 대안 | 기술  | 성능  | 유지보수 | 마이그레이션 | HIGH+ 개수 |
| ---- | :---: | :---: | :------: | :----------: | :--------: |
| A    | **H** |   M   |    L     |      L       |     1      |
| B    | **H** |   M   |  **H**   |      L       |     2      |
| C    |   L   | **H** |  **H**   |      L       |     2      |

루프 판정: A/B 의 기술 HIGH 는 동일한 본질 위험(미검증 영역 실행)이라 대안 선택으로 제거 불가하며, phase gate 로 관리 가능한 1회성이다. C 의 HIGH 2건은 요구 미충족의 영구 비용. HIGH 최소(1)이며 그 HIGH 가 gate 관리 가능한 A 채택 — 추가 대안 불요.

## Decision

**대안 A: 단일 실행 ADR — 3축 phase 순차** 를 선택한다.

선택 근거(위험 수용):

1. **기술 HIGH 는 phase gate 로 격리 가능** — A1/A2/A3 각각 독립 게이트(G-A1~G-A3)와 1:1 대응하고, phase 실패는 해당 축 hold 로 국한된다(A1 은 완전 독립, A3 만 A2 에 의존).
2. **축간 공유 인프라의 단일 설계** — draw tree ↔ hit tree 의 동일 window 공유(A2)와 deepest hit-test(A3)는 같은 소스를 쓰므로 한 문서 소유가 drift 를 차단한다.
3. **사용자 결정 정합** — 2026-07-13 AskUserQuestion 에서 "새 실행 ADR 1건 작성" 확정.

기각 사유:

- **대안 B 기각**: 게이트·리뷰 비용 3배에 축간 계약이 문서 경계를 가로질러 drift 위험이 커진다. 사용자가 축별 분리 옵션을 명시 기각했다.
- **대안 C 기각**: HC#7(Skia = 직접 조작 editor) 미충족과 상태 시각 부재가 영구화된다 — 회복 불가능한 유지보수·성능 HIGH.

> 구현 상세: [150-rac-pencil-residual-interaction-execution-breakdown.md](design/150-rac-pencil-residual-interaction-execution-breakdown.md) — §1 fork 4 질문 lock-in / §2 Phase 0 실측 inventory / §3~§5 Phase A1·A2·A3 / §6 게이트 검증 절차.

## Risks

> ID 는 910 위험축과의 승계 관계를 병기한다. 본 표는 대안 A 이행 중 관리할 잔존 운영 위험이다. R4/R6 보강과 R1 무효화 채널 명세는 리뷰 round 1 (2026-07-14, reviews/150.md) 반영.

| ID  | 위험                                                                                                                                                                                                                                                                                                                                                                        |  심각도  | 대응                                                                                                                                                                                                                                                                                                                                               |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------: | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | pointer hot path 성능 + 상태 도달 경로 부재 (910 T-7 실행면) — 현 command stream 캐시는 registryVersion/pagePosVersion/framePosVersion/layoutVersion **4중 키 단독**(`renderCommands.ts:222-256`)이라 "signature 유입 금지 + 전체 rebuild 금지" 제약 하에서 hover 변화가 shape 재도출에 도달할 경로가 0. 채널을 잘못 설계하면 60fps 붕괴                                    | **HIGH** | Gate G-A1. **상태 전용 무효화 채널 신설이 A1 의 1차 설계 산출물** — 후보 (a) 캐시 5번째 버전 키(상태 변화마다 stream 전량 재수집이라 비권장) / (b) hovered·pressed 노드 한정 overlay draw pass(기존 hover outline `skiaOverlayBuilder` 선례 동형, 우선 검토). sceneVersion signature 입력에 상태 미포함. pointermove FPS 실측을 게이트 조건에 포함 |
| R2  | window ↔ layout/hit/panel 동기화 실패 (910 T-4 실행면) — scrollOffset 기반 window 전환 시 content height·hit bounds·스크롤 좌표가 어긋나면 클릭 오배정/유령 row. window 소비자는 draw/hit tree 외 **LayerTree 패널**(`useLayerTreeData.ts:12` → `LISTBOX_ROW_PROJECTION_WINDOW_LIMIT` 공유) 3경로                                                                           | **HIGH** | Gate G-A2. draw/hit 동일 window 단일 소스 + 10k row fixture 노드 수 상한 assert + 스크롤 후 hit 정확성 + **패널 소비자 정책 분리 명시**(window 는 캔버스 전용 — LayerTree 는 별도 정책 결정 후 검증)                                                                                                                                               |
| R3  | projected id canonical 유입 (910 T-PROJECT 승계) — drill-in 편집 도입으로 projected render id 가 canonical mutation/history/IndexedDB 에 유입되면 데이터 corruption. 관련 경로: `canvasSceneNode.ts:1077,1254`, ADR-135/136 `resolveCanonicalMoveTarget` 계열                                                                                                               | **HIGH** | Gate G-A3. edit route(template/data/override) 명시 변환만 허용 + negative fixture PASS + refresh 후 synthetic projected id 0건                                                                                                                                                                                                                     |
| R4  | drill-in 의 기존 기능 회귀 + **selection read 계약 미정** (910 T-PARITY/T-DEEP 인접) — 기존 land 패턴은 deepest 가 아니라 owner select redirect(`canvasSceneNode.ts:1077` chip, 912:188 Table cell live 검증). deepest 선택이 `selectedElementIds` 에 projected id 를 넣는 정책은 ADR-137 Selection Consumer Contract·Pointer→Move 계약(canvas-rendering.md §6)과 정합 필요 |   MED    | G-A3 통과 조건에 selection 계약 검증 포함 — 정책(redirect 유지 + drill-in 시 deepest 등)을 A3 설계 항목으로 확정(breakdown §5) + 기존 collection 동작 회귀 0 (910 G-parity 승계)                                                                                                                                                                   |
| R5  | template row height cache stale (910 T-TPL 승계) — 독립 cache 도입 시 stale Skia/Layer Tree                                                                                                                                                                                                                                                                                 |   MED    | row height 측정 cache 무효화를 기존 layout publish/projectionVersion/synthetic invalidation 신호에 연결 (독립 cache 금지). G-A2 에 흡수                                                                                                                                                                                                            |
| R6  | A2 판정 환경의 선행 의존 (2026-07-14 신설) — row height/content height 가 엔진 layout 결과 기반인데 ADR-916 사후 parity sweep 의 collection 축 발산(Table/Tree/Card 잔여 백로그)이 미정리면 G-A2 fixture 가 흔들리는 기반 위에서 검증됨                                                                                                                                     |   MED    | A2 착수 전 sweep 백로그 중 collection 축 정리 **또는** 10k fixture 에서 발산 영향 격리 확인 — G-A2 선행 조건으로 명시                                                                                                                                                                                                                              |

잔존 HIGH 위험: R1 / R2 / R3 (3건) — 각각 G-A1 / G-A2 / G-A3 과 1:1 대응하며 phase 단위 격리 가능. R4/R5/R6(MED)은 G-A3/G-A2 통과 조건에 흡수.

## Gates

phase 순서 A1 → A2 → A3. A1 은 독립(실패해도 A2 진행 가능), A3 은 A2 의 hit tree 에 의존(A2 실패 시 A3 hold). 모든 게이트는 live behavior 검증(Chrome MCP 1회 exercise) 포함 — test/type-check PASS 단독 종결 금지.

| Gate | 시점                              | 통과 조건                                                                                                                                                                                                                                                                                                                                                                                                                                           | 실패 시 대안                                             |
| ---- | --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| G-A1 | Phase A1 상태 threading (R1)      | selection family fixture(Button/ToggleButton/Checkbox)가 Builder Skia 에서 **hover/pressed/selected** 시각을 Preview DOM `data-*` 와 동일 규칙으로 표시(`/cross-check` 상태 대칭 PASS — 911 G-state 3축 정합) + focusVisible threading 으로 기존 focus ring 활성화(`buildSpecNodeData.ts:1541-1542`) + 상태 전용 무효화 채널이 전체 scene rebuild 없이 동작(pointermove FPS 무회귀 실측) + disabled 기존 동작 회귀 0                                | A1 hold — 상태 시각 없이 A2 진행 가능(축 독립)           |
| G-A2 | Phase A2 가상화 window (R2/R5/R6) | **선행**: R6 — ADR-916 sweep collection 축 발산 정리 또는 fixture 영향 격리 확인. 통과: 10k row ListBox fixture — draw/hit 노드 수 ≤ window+overscan assert + 스크롤 중 60fps + 스크롤 후 hit 정확성 + content height 스크롤바 정확 + row height cache 가 기존 무효화 신호에 연결 + **LayerTree 패널 정책(window 와 분리) 명시·검증**. ListBox proof 후 GridList/Table 동일 통과                                                                    | A2 hold — 정적 cap 유지, A3 hold                         |
| G-A3 | Phase A3 drill-in/edit (R3/R4)    | row 내부 Text/Icon 클릭 → deepest projected 선택 + 더블클릭 → drill-in/data edit route 진입(live) + **selection read 계약 검증**(deepest 선택 정책이 `selectedElementIds`/ADR-137 스냅샷/Pointer→Move 계약과 정합 — projected id 의 page-bound mutation 유입은 route 변환 경유만) + projected id → canonical API 직접 유입 negative fixture PASS + refresh 후 `elementsMap` synthetic projected id 0건 + 기존 collection 편집·selection·정렬 회귀 0 | flat row selection 유지 + A3 hold(시각 대칭 상태로 잔존) |

## Consequences

### Positive

- "빌더 Skia 화면 = 직접 조작 editor"(910/911 HC#7) 요구가 실제로 충족된다 — collection 깊은 노드 선택·편집 + 상태 시각 + 대용량 row 성능.
- ADR-911 proof gate G-state/G-projected 의 잔여 증명이 충족되어 910/911/912 계열의 미증명 HIGH 영역이 소진된다.
- 상태 시각이 catalog `FillStateTokens` 단일 소스에서 DOM/Skia 대칭으로 소비된다 — 신규 스키마·정본 없음.

### Negative

- pointer hot path 와 스크롤 hot path 를 동시에 건드린다 — 성능 회귀 감시 비용이 phase 마다 발생(FPS 실측 게이트 의무).
- window 전환으로 projection 경로(`appendXxxRowProjection` 계열)와 layout §8 계약 코드, LayerTree 패널 소비 정책이 광범위하게 수정된다 — collection family 회귀 fixture 유지 부담.
- drill-in UX 는 신규 상호작용 표면이라 사용자 검증(live) 없이는 완료 선언 불가 — 자동 게이트만으로 종결할 수 없다.
- A2 는 ADR-916 sweep collection 축 정리에 선행 의존(R6) — 착수 시점이 외부 백로그에 결합된다.
