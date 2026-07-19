# ADR-150 Breakdown: RAC·Pencil 잔여 상호작용 3축 실행

> 본 문서는 [ADR-150](../150-rac-pencil-residual-interaction-execution.md) 의 구현 상세다. 설계 원본(reference)은 [ADR-910 breakdown](910-rac-pencil-component-architecture-breakdown.md) §4.7/§4.12/§5.11 (ADR-920 흡수분) + [ADR-911](../911-rac-pencil-target-component-architecture.md) R-3/R-4 이며, 본 문서는 그 설계를 현재 코드(ADR-912 완결 상태) 위에서 실행하는 순서·파일 scope 만 소유한다. 리뷰 round 1 (2026-07-14, reviews/150.md) 반영 개정.

## §1 Fork checkpoint — 4 질문 lock-in (M2)

> 사용자 explicit confirm: **2026-07-13 AskUserQuestion — "새 실행 ADR 1건 작성" 선택** (옵션: 새 실행 ADR / 현행 유지 / 축별 분리 중 첫 번째). 차단 카테고리 인용 후 confirm 경유 — no-derived-adr-mid-execution 게이트 통과.

1. **base / 응용 분류**: base = ADR-911(비실행 목표 참조, proof gate 소유) / 응용·실행 = 본 ADR-150. 선행 실행 ADR-912(Implemented 2026-06-18)는 prerequisite 완결 — 본 ADR 은 912 가 Implemented 승격 시 명시 기록한 잔여(R-3 잔여 + R-4 잔여)만 실행한다.
2. **schema 직교성**: 신규 canonical schema 0. catalog rule schema 확장 0 — 상태 시각 데이터는 ADR-908 `FillStateTokens`(hover/pressed/selected)에 이미 존재한다. 신규 타입은 render-space 전용(projected ref / collection window)만이며 canonical 문서와 직교(ADR-135/136 Render-Space Boundary 동형).
3. **선행 ADR 전제 reverse 검증**: 912 잔여 기록 ↔ 코드 실측 일치를 grep 재검증 완료 (2026-07-13) — `racStateAttrs.ts:14-16` disabled 한정 + hover/pressed/focusVisible 후속 명시 / `resolveCollectionItems.ts:28` window cap 100 정적 / `canvasSceneNode.ts:1077,1254` "독립 hit/remove mutation 은 후속" 주석. 의존 방향: 150 → 912 완결 상태 (역방향 없음).
4. **codex 3차 review 지연 회피**: 위 1~3 을 fork 시점(본 문서 작성 시점)에 통과시킨 후 리뷰 round 1 진입 (2026-07-14 완료 — MEDIUM 4/LOW 2 본 개정으로 반영).

## §2 Phase 0 — 잔여 실측 inventory (정본)

| 축                     | 910/911 위험·Gate                     | 현재 코드 실측 (2026-07-13)                                                                                                                                                                                                                                                                                                                                                                                        | 잔여 정의                                                                                       |
| ---------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| A1 상태 threading      | 910 T-7/G-state ≡ 911 R-4             | `packages/specs/src/utils/racStateAttrs.ts` — `ComponentState` 6종 중 **disabled 만 derive**, hover/pressed/focusVisible 는 입력 자리만("후속" 명시, 사용자 결정 2026-06-03). caller = `apps/builder/src/builder/workspace/canvas/skia/buildSpecNodeData.ts`. **상태 전용 무효화 채널 부재** — command stream 캐시 4중 버전 키 단독(`renderCommands.ts:222-256`)                                                   | Skia hit-test → hovered/pressed/focusVisible id → state 시각 분기 threading + 무효화 채널 신설  |
| A2 가상화 스크롤       | 910 T-4/④.7 ≡ 911 R-3 잔여(a)         | `packages/shared/src/collections/resolveCollectionItems.ts:28` — `COLLECTION_ROW_PROJECTION_WINDOW_LIMIT = 100` **정적 cap** (910 §4.7 이 "slice(0,N) 은 culling 이 아니다"로 명시한 바로 그 상태). projection = `apps/builder/src/builder/workspace/canvas/scene/canvasSceneNode.ts` `appendXxxRowProjection`. **window 소비자 3경로** — draw/hit tree + LayerTree 패널(`useLayerTreeData.ts:12` 동일 LIMIT 공유) | scrollOffset 기반 window + overscan + 10k row 60fps + 패널 정책 분리                            |
| A3 drill-in/edit route | 910 T-DEEP/G9/§5.11 ≡ 911 R-3 잔여(b) | Table 2D C1 로 cell 깊은 노드 + columnId write-target **부분 반영**(912 기록). drill-in/drill stack 심볼 0건, `canvasSceneNode.ts:1077,1254` "독립 hit/remove mutation 은 후속(현 slice 는 시각 대칭)". **기존 land 패턴 = owner select redirect** (deepest 아님)                                                                                                                                                  | deepest hit-test + drill-in + edit route registry(template/data/override) + selection read 계약 |

**이미 완료라 본 ADR scope 밖**: R-1 generic 공통 기반 / R-2 base⊕override 어댑터(`toReactStyle`/`toSkiaStyle`) / spec 전수 삭제 / `skiaLegacy` 플래그 제거 / G8 부분 증명(Table columnId write-target). **직교라 scope 밖**: reusable·slot(ADR-148) / prop parity(ADR-915) / theme 다축(911 R-5 — 다축 요구 컴포넌트 실재 확인 후 별도 판단).

**선행 의존 (round 1 반영)**: A2 는 ADR-916 사후 parity sweep 의 collection 축 발산(Table/Tree/Card 잔여 백로그 — 메모리 `project-adr916-post-cutover-parity-sweep-inventory`) 정리 또는 fixture 영향 격리 확인이 선행 (본문 R6/G-A2).

## §3 Phase A1 — Skia hover/pressed/focusVisible 상태 threading

> **✅ Implemented 2026-07-19** — 무효화 채널 = hovered/pressed/focused 노드 한정 overlay draw pass(후보 b, `overlayVersion` 재사용 → scene rebuild 0). 커밋: S2 hover `d2b7a1b2f` · S3 pressed `99947f241` · S4 focus `e98ab8887` · cross-check 색 정정 `433ba3a6c`. 신규 파일 `hoverStateOverlay.ts` / `useElementPressInteraction.ts` / `useFocusVisibleModality.ts`. focus 소스 = keyboard modality ∩ 선택 요소(빌더 캔버스 요소 keyboard focus 부재). exact pixel 시각/FPS 는 foreground 확인(hidden-탭 RAF pause).

**목표**: Builder Skia 화면이 hover/pressed(+selected 확증, focusVisible) 상태 시각을 Preview DOM(RAC `data-hovered`/`data-pressed`/`data-selected`)과 동일 규칙으로 표시.

- 시각 데이터·소비 분기는 기존재: catalog rule `FillStateTokens.hover/pressed`(ADR-908, rule 값 실측 hover 341/pressed 271) + `buildCatalogShapes.ts:163-170` state→fill 분기. **실제 공백은 둘** — ① threading(hit-test → 노드별 상태 주입), ② **상태 전용 무효화 채널**(현 command stream 캐시는 4중 버전 키 단독이라 상태 변화가 그리기에 도달 불가).
- 작업 항목:
  1. pointer 경로(EventBoundary hit-test)에서 `hoveredElementId` / `pressedElementId` 유지 (기존 hover outline 경로 `useElementHoverInteraction` 의 id 소스 재사용 검토 — 신규 상태 store 추가 전 기존 소스 우선).
  2. `buildSpecNodeData` caller 가 노드별 `isHovered`/`isPressed`/`isFocusVisible` boolean 주입 (racStateAttrs JSDoc 의 caller 계약 그대로). focusVisible threading 은 기존 focus ring 활성화 대기 지점(`buildSpecNodeData.ts:1541-1542`)을 잇는다 — 912 기록 잔여 3종 전부 본 phase 에서 소진.
  3. **상태 전용 무효화 채널 신설 (A1 의 1차 설계 산출물, round 1 MEDIUM 반영)** — 전체 scene rebuild 금지 + sceneVersion signature 입력에 상태 미포함(ADR-136, `.claude/rules/canvas-rendering.md` §9) 제약 하에서 상태 변화를 그리기에 도달시키는 경로. 후보: (a) command stream 캐시 5번째 버전 키 — 상태 변화마다 stream 전량 재수집이라 비권장 / (b) **hovered·pressed 노드 한정 overlay draw pass** — 기존 hover outline 오버레이(`skiaOverlayBuilder`) 선례 동형, 우선 검토. 선정·검증이 G-A1 통과 조건.
- 검증: `/cross-check` 상태 시각 대칭 — **hover/pressed/selected 3축** (911 G-state 정합; selected 는 기존 isSelected 직교 경로의 parity 확증 겸용. selection family fixture — Button/ToggleButton/Checkbox 우선) + focus ring 활성화 확인 + pointermove 중 FPS 무회귀 실측 + Chrome MCP live 1회 exercise.
- 커밋 단위: 무효화 채널 → threading 인프라 → family 적용 → 회귀 테스트, phase 종료 시 commit 가능 상태.

## §4 Phase A2 — collection 가상화 스크롤 (CollectionWindow)

> **진행 상태 (2026-07-20): ListBox + GridList + Table 전 family delivered · 시각 최종 확인 대기** — ListBox proof(2026-07-19): 작업 항목 1~5 반영, 커밋 `b9698aa4c` · `90dd52b32` · `73e7b367b` · `360a12201`(ref 인스턴스) · `34c56ea70`(정확 행 높이). GridList 확산(`4a29fcf5a`): 공유 인프라 일반화(`CollectionWindowResolution.columns` + spacer helper + generic spacer id), grid 모드는 시각 행 공간 window → numCols 배수 item 환산. Table 확산(`e994822b9`): `getTableProjectionRows` window 위드닝(header 항상 + data windowing + 절대 rowIndex), header 높이 scrollTop 보정, 행 높이 균일(catalog TableRow.sizes). G-A2 핵심(노드 수 상한 · 재투영 · spacer 총 높이 보존 · 경계 게이팅 · 정확 행 높이)은 3 family 전부 실행 중 builder HMR 모듈 합성 probe(10k, 프로젝트 무mutation)로 확증(GridList grid 28 카드·Table md 16 data행 등). 유닛 30/30 + scene 100/100 회귀 0. **잔여 = 실제 canvas 60fps 스크롤 픽셀의 foreground 사용자 확인 1회** (실제 대량 요소 렌더 필요 — 실제 요소 무접촉 지시로 자동화 보류). 재실행 시 재실행 금지 — 시각 확인 후 ADR Status 승격만 남음. GridList grid 는 rowGap 1개 근사(스크롤바 미소 오차, ListBox/Table 은 gap 0 정확).

**목표**: 정적 cap(100) 제거 → scrollOffset 기반 window 로 10k row 에서도 draw/hit 노드 수 ≤ window+overscan, 60fps.

- **선행 조건 (R6, round 1 MEDIUM 반영)**: ADR-916 사후 parity sweep 백로그 중 collection 축 발산(Table/Tree/Card) 정리 **또는** 10k fixture 에서 발산 영향 격리 확인 — row height/content height 판정 기반이 엔진 layout 결과이기 때문.
- 작업 항목:
  1. `resolveCollectionItems.ts` 에 `CollectionWindow`([startIndex, endIndex] + overscan) 도입 — scrollOffset + 측정 row height 로 산출. `COLLECTION_ROW_PROJECTION_WINDOW_LIMIT` 정적 cap 은 fallback 격하 후 제거.
  2. draw tree 와 hit tree 가 **같은 window 공유** (projection append 경로와 hit-test bounds 경로 동일 소스).
  3. 전체 content height 는 전 row 합산으로 유지(스크롤바 정확성) — 자식 좌표는 부모 `scrollOffset` 차감(`.claude/rules/canvas-rendering.md` §8 계약 준수, `scrollState.scrollVersion` 무효화).
  4. row height 측정: template subtree 기반 측정값 캐시 — 캐시 무효화는 기존 layout publish / projectionVersion / synthetic invalidation 신호에 연결(독립 cache 금지 — 910 T-TPL).
  5. **LayerTree 패널 소비자 정책 분리 (round 1 MEDIUM 반영)**: `useLayerTreeData.ts:12` → `layers/listBoxRowProjection.ts` 가 동일 LIMIT 를 공유 — window 는 캔버스 draw/hit 전용으로 한정하고, 패널은 별도 정책(현행 cap 유지 또는 전체 목록 + 자체 스크롤) 을 결정·명시 후 검증. 패널 row 목록이 캔버스 viewport 종속으로 변하면 안 됨.
- 검증: 10k row ListBox/GridList/Table fixture — draw/hit 노드 수 상한 assert + 스크롤 중 60fps 실측 + 스크롤 후 hit 정확성(화면 좌표 ↔ window row 매핑) + LayerTree 패널 정책 검증.
- ListBox 선행 proof → GridList/Table 확산 (910 roadmap 의 ListBox-first 순서 승계).
- **ADR-148 Phase 4 표면 공유**: projection 주입 경로(`canvasSceneNode.ts` slotRole 소비)가 148 Phase 4(collection item slot 이식)와 동일 표면 — 후행 착수 측이 선행 측 land 상태를 phase 진입 시 재실측 (148 breakdown Phase 4 조정 조항과 대칭. A3 도 동일).

## §5 Phase A3 — drill-in / data edit route UI

**목표**: collection row 내부 깊은 노드(Text/Icon/Cell)를 Skia editor 에서 직접 선택·편집.

- 작업 항목:
  1. deepest projected child hit-test: click → 가장 깊은 projected 노드 선택 (A2 의 hit tree 공유).
  2. **selection read 계약 확정 (round 1 MEDIUM 반영)**: 기존 land 패턴은 owner select redirect(`canvasSceneNode.ts:1077` chip, 912 Table cell live 검증)로 deepest 와 정반대 — 정책(예: 1클릭 = 기존 redirect 유지, drill-in 진입 후에만 deepest)을 A3 설계 산출물로 확정하고, deepest 선택이 `selectedElementIds` 에 들어갈 때의 하류 계약 — ADR-137 Selection Consumer Contract(ImmediateSelectionSnapshot) / Pointer→Move(canvas-rendering.md §6) — 정합을 명시. projected id 의 page-bound mutation 유입은 route 변환 경유만.
  3. double-click → drill-in(drill stack, Esc/breadcrumb pop) 또는 data edit 진입.
  4. **edit route registry** (910 §5.11): projected 노드 편집을 template(구조/스타일) / data(row 값) / item-override 3-route 로 명시 변환. 기본 write policy 는 910 §5.11 표 승계.
  5. projected render id ↔ canonical write target 분리: `resolveCanonicalMoveTarget` 동형 변환기 — projected id 는 canonical mutation/history/IndexedDB 유입 금지(ADR-135/136 §9 계약). Table columnId write-target(기존 부분 반영)과 단일 계열로 정합.
- 검증 (G-A3): ① row 내부 Text 클릭 → deepest 선택(확정 정책 기준) / 더블클릭 → data edit route 진입 live exercise, ② selection read 계약 검증(인스펙터/Move 하류 정상), ③ projected id → canonical update/remove/move API 직접 유입 **negative fixture PASS**, ④ refresh 후 `elementsMap` synthetic projected id 0건, ⑤ 기존 collection 편집·selection·정렬 동작 회귀 0 (910 G-parity collection 승계).

## §6 게이트 검증 절차

각 phase = ADR-150 본문 Gates 표의 G-A1/G-A2/G-A3 과 1:1. 공통 절차:

1. type-check PASS (baseline 외 신규 0)
2. 관련 vitest PASS + 신규 회귀 fixture
3. `/cross-check` 시각·상태 대칭
4. **live behavior 게이트**: Chrome MCP 로 실제 builder 에서 해당 축 1회 exercise — test/type-check PASS 단독 종결 금지(CLAUDE.md 완료 기준)
5. commit 검증 블록에 exercise 내용 명시

phase 실패 시: 해당 phase hold(다음 phase 진행 금지 아님 — A1 은 A2/A3 과 독립, A3 은 A2 의 hit tree 에 의존하므로 A2 실패 시 A3 hold).

## §7 참조

- 설계 원본: [910 breakdown](910-rac-pencil-component-architecture-breakdown.md) §4.7(windowing)/§4.12(Interactive Projected Tree)/§5.11(edit route) — ADR-920 흡수분
- proof gate 매핑: [ADR-911](../911-rac-pencil-target-component-architecture.md) G-state(R-4) / G-projected(R-3) — 본 ADR 완료 시 두 proof gate 의 잔여 증명이 충족됨 (G-A1 은 selected 포함 3축)
- 잔여 기록 원본: [ADR-912](../completed/912-rac-pencil-rebuild-cutover.md) R-3/R-4 증명 상태 (Implemented 승격 시점 잔여 명시)
- 경계 계약: `.claude/rules/canvas-rendering.md` §8(overflow scroll)/§9(Render-Space Interaction Boundary) + ADR-137 Selection Consumer Contract
- 리뷰 기록: `docs/adr/reviews/150.md` round 1 (2026-07-14 — 본 개정이 MEDIUM 4/LOW 2 전건 반영)
