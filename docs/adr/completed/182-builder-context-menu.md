# ADR-182: 빌더 우클릭 컨텍스트 메뉴 — 대상별 통합 컨텍스트 메뉴 시스템

## Status

Implemented — 2026-08-16 (Phase 0~~5 완결, G1~~G3 PASS. Accepted 2026-08-15 — 리뷰 승인 round 2: round 1 이슈 7건(HIGH 1 / MED 4 / LOW 2) + round 2 이슈 3건(MED 3) 전건 fixed, 잔존 pending 0, HIGH/CRITICAL 잔존 0 — [reviews/182.md](../reviews/182.md))

## Implementation Progress

- Phase 1 — Implemented 2026-08-15: RAC virtual-anchor overlay, surface provider registry, context-menu selection/policy pure functions, Builder-root native menu suppression, and regression tests (G1 anchor/action/underlay contract verified; viewport-edge flip remains RAC live-browser evidence for Phase 2).
- Phase 1.5 — Implemented 2026-08-15: extracted copy/paste/duplicate/delete/group/ungroup/align/distribute into the shared `canvasActions` layer; both shortcut consumers now inject their element map, with CanvasSceneNode alias normalization and regression tests.
- Phase 2 — Implemented 2026-08-16: wired Canvas T1/T2 providers and the shared context-menu entry, preserved interactive-map hit testing, page occlusion, `resolveClickTarget` selection normalization, page transition, editable/ruler/DEV-Alt guards, and scene-point paste. Removed the raw Canvas detach menu and legacy `interaction/canvasContextMenu.ts`; migrated the projection static guard and entry/provider tests. Type-check, preflight, and 9 related test files / 31 tests PASS.
- Phase 3 — Implemented 2026-08-16: wired LayerTree T3 to the shared T1 provider, preserved multi-selection when the row is already selected, selected an unselected row before opening, removed the legacy 3-item raw menu and duplicated CSS, and added the tokenized `@layer builder-system` context-menu stylesheet. Type-check, targeted RTL/context-menu tests (9 files / 29 tests), `reservedPrefix.static.test.ts`, and diff checks PASS.
- Phase 4 — Implemented 2026-08-16: added `resolveSiblingEdgeTarget` + the store action `moveElementToSiblingEdge` (new mutation ⇒ routed through `runCanonicalMutation`, ADR-184/185), registered `]`/`[`/⌘]/⌘[, revived the dead ⌘X definition as `cutSelection` (copy must succeed before delete), wired the T1 z-order cluster, and set `destructive` on Delete. Copy as PNG stays deferred — it is absent from the §2 T1 canonical item table. **Scope reduction (reported)**: the z-order items show for single selection only; the §2 footnote never defined relative-order preservation for multi-select and the existing shortcut path also returns early, so "condition unmet ⇒ hidden" applies.
- Phase 5 — Implemented 2026-08-16: G2 live behaviour verified in Chrome — four surfaces, multi-selection preserved on right-click, ruler strip suppressed without opening a menu, overlapping-page occlusion, the three-way T4 policy (panel suppressed / `input` native / DEV ⌥ pass-through), z-order via menu and all four shortcuts with single-step undo restore, and ⌘X cut with clipboard write plus undo recovery. Document state was restored after the probes. Type-check and 11 related test files / 53 tests PASS.
- Post-implementation corrective fix — 2026-08-27 (ADR-192 Phase 2 live 실측): `canvasActions.duplicateSelection` 이 `multiSelectMode` 가 false 면 조용히 반환해 **단일 선택 복제가 메뉴·⌘D·액션 바 어디서도 동작하지 않았다** (store 구독 0회 실측). 추출 전 `handleDuplicate` 의 다중 선택 전용 게이트를 그대로 옮긴 것이 원인. 게이트를 제거하고 (`canvasActions.ts:186`) 회귀 테스트 1건 추가 — 다중 선택 전용 게이트는 group/align/distribute 에만 남는다.
- Post-implementation corrective fix — 2026-08-24: RAC `Popover`의 기본 modal 동작이 `#root`를 inert로 만들어 열린 메뉴가 다른 대상의 후속 우클릭을 받지 못하던 문제를 수정했다. 메뉴·서브메뉴를 `isNonModal`로 전환하고, 활성 요청이 있을 때만 바깥 `pointerdown`을 닫기 이벤트로 소비하며, 메뉴 포커스를 명시적으로 복원해 바깥 클릭·Escape 닫힘과 다음 대상의 메뉴 교체를 함께 보장한다. 캔버스→캔버스 및 캔버스→LayerTree 재우클릭 교체, root inert 해제, 바깥 클릭·Escape 닫힘을 Chrome에서 확인했다. 관련 테스트 8개 파일 / 43개 테스트, type-check, preflight PASS.

## Context

빌더 안에서 우클릭이 대상에 맞는 컨텍스트 메뉴를 제공하지 못한다. 캔버스는 브라우저 기본 캔버스 메뉴("이미지 저장 / 이미지 복사 / 검사")가, DOM 패널 영역은 HTML 기본 메뉴가 뜬다. 실측 (2026-08-14, 라인은 2026-08-15 재확인):

- 캔버스: `BuilderCanvas.tsx:810-883` — **detach 가능한 인스턴스일 때만** `preventDefault` + 1항목("Detach instance") raw div 메뉴 (`:1424-1445`). 그 외 요소·빈 영역 전부 브라우저 기본 메뉴로 낙하
- 레이어 트리: `LayerTreeItemContent.tsx:120-272` — 3항목(컴포넌트 승격/해제/detach) raw div 메뉴가 별도 구현으로 존재. CSS 는 `Workspace.css:27-52` ≡ `NodesPanel.css:107-132` 완전 중복 + 둘 다 `@layer` 밖
- 우클릭이 다중 선택을 무조건 단일 선택으로 덮어쓰고 (`BuilderCanvas.tsx:863-872`), 좌클릭(`resolveClickTarget` — editingContext 경계)과 우클릭(`canDetachInstance` 필터만)의 대상 해석이 서로 다르다
- 기존 두 메뉴는 키보드 접근(roving focus/Esc/뷰포트 플립) 부재
- **메뉴가 부를 수 있는 액션이 절반뿐이다** (리뷰 round 1 실측 · round 2 정정): store/모듈 export 로 노출된 것(reorder/component 토글/detach/go-to-origin/zoom/rulers/snap)은 재사용 가능하나, copy·paste·duplicate·delete·group·ungroup·align·distribute 의 **오케스트레이션은 호출 불가능한 클로저** — delete 는 store `removeElements` 자체는 열려 있으나 primary+다중 합집합·body 필터가 `useGlobalKeyboardShortcuts.ts:265-300` 클로저 안이라 같은 부류다 — `useGlobalKeyboardShortcuts.ts:99` 는 반환값 없는 훅(`:640` registry 등록으로 종료), `CanvasSelectionShortcuts.tsx:46` 은 `CanvasSelectionShortcutsHost` 컴포넌트 1개만 export 하며, `useKeyboardShortcutsRegistry` 에 id 로 핸들러를 발화하는 API 도 없다. 하위 유틸(`multiElementCopy.ts`/`elementGrouping.ts`/`elementAlignment.ts`/`elementDistribution.ts`)만 export 되어 있다

리서치 2종을 설계 근거로 고정한다 (상세 breakdown §0): **Figma** — 공식 문서·단축키 레퍼런스·포럼 교차 (클러스터 순서, 조건 미충족 항목 숨김, 토글 라벨 교체, 파괴 액션 메뉴 배제, 단축키 병기), **Pen(구 Pencil) v1.2.4** — 앱 번들 실측 (단일 메뉴 빌더를 캔버스/레이어 리스트가 공유, `destructive` Delete 포함, 우클릭 선택 규칙: 선택 밖 요소 = 교체 / 빈 영역은 선택 bounds 밖일 때만 해제).

**위상**: 본 ADR 은 **builder-system UI layer** (ADR-163 패널 구조 규칙과 동위상) — 사용자 캔버스 컴포넌트의 SSOT 3-domain (D1/D2/D3) 체인과 무관하며 catalog/spec/**Generator emit 확장 없음**. 메뉴 UI 는 빌더 내부 RAC 사용 (선례: `ZoomControls.tsx:198-236`).

**Hard Constraints**:

1. **프레임 예산 상시 비용 0**: 메뉴는 DOM 오버레이 — Skia 렌더 루프에 상시 비용을 추가하지 않고, 우클릭 시점 hit-test 1회(`hitTestPoint` 재사용)만 허용. 캔버스 60fps 유지
2. **좌/우클릭 대상 해석 단일화**: 우클릭 대상 정규화는 좌클릭과 **동일 심볼** `resolveClickTarget` 경유 — 별도 해석 경로 신설 금지
3. **projection 정적 가드 계승**: 상호작용 read model 은 `getInteractiveElementsMap()` 경유. `BuilderCanvas.projection.static.test.ts` 의 context-menu positive assert는 핸들러 대체와 함께 `contextMenu/canvasContextMenuEntry.ts` 로 이설해 신규 entry가 interactive map을 직접 읽는 계약을 고정한다.
4. **액션 재구현 금지 — 기존 유틸 재사용 + 오케스트레이션 공유 계층 추출**: 메뉴 액션은 기존 store 액션을 직접 호출하거나, 컴포넌트 내부 클로저에 갇힌 오케스트레이션을 **호출 가능한 공유 계층으로 추출**해 메뉴·단축키가 같은 구현을 소비한다 (로직 복제 금지). 신규 mutation 은 bringToFront/sendToBack 2종 + cut 조합뿐이며 canonical 파이프라인(Memory→Index→History→DB→Preview) 준수
5. **단축키 표기 단일 파생**: `formatShortcut(SHORTCUT_DEFINITIONS[id])` 만 — 메뉴 내 단축키 문자열 하드코딩 0건
6. **ADR-163 CSS 계약**: `@layer builder-system` + 예약 prefix 회피 (`reservedPrefix.static.test.ts` PASS) + 기존 중복 CSS 2벌 제거. 이관 시 미정의 토큰 `--bg-elevated`(정의 0건 — 현행 메뉴 배경이 실제로 투명) 를 `--bg-raised` 로 정정
7. **네이티브 메뉴 보존 예외**: `input`/`textarea`/`contenteditable`/텍스트 편집 오버레이는 브라우저 기본 메뉴 유지 (Pen 동일)
8. **기존 조기 반환 가드 계승**: 대체 대상 `handleCanvasContextMenu` 의 부수 가드 — 눈금자 스트립(`isRulerEventTarget`, ADR-181 R1) / 페이지 occlusion topmost 해소(`resolveTopPageIdAtPoint`+`buildPagePaintRank`) / 페이지 전환(`selectElementWithPageTransition`) — 을 신규 경로에 1:1 계승
9. **BC**: canonical 문서 스키마 무변경 — **기존 프로젝트 영향 0% / 재직렬화 0 파일** (lock·hide 필드 추가를 비스코프로 두는 이유)

**Soft Constraints**:

- 기존 detach 메뉴·레이어트리 메뉴의 테스트 3벌 (이관된 `contextMenu/canvasContextMenuEntry.test.ts`, `LayerTreeItemContent.test.tsx`, projection 정적 가드) 이관 유지
- 단축키 정의가 이미 2원화되어 있음 (`SHORTCUT_DEFINITIONS` vs `CanvasSelectionShortcuts.tsx:694-810` 하드코딩) — 본 ADR 은 표기만 정본 참조로 회피, 통합은 비스코프

## Alternatives Considered

### 대안 A: 현행 파편 메뉴의 개별 확장

- 설명: 캔버스 raw div 메뉴 (`BuilderCanvas.tsx:1424-1445`)와 레이어트리 raw div 메뉴 (`LayerTreeItemContent.tsx:231-272`)를 각자 항목 추가로 확장하고, 빈 캔버스용 세 번째 메뉴를 추가
- 근거: 최소 변경. 그러나 외부 레퍼런스 양쪽 모두 반대 방향 — Pen 은 단일 빌더 공유 구조(번들 실측), Figma 도 표면별 메뉴가 동일 액션 체계를 공유
- 위험:
  - 기술: L — 기존 패턴 반복
  - 성능: L
  - 유지보수: **H** — 이미 3중 파편 (`BuilderCanvas.tsx:810-883` / `LayerTreeItemContent.tsx:120-272` / CSS 2벌 `Workspace.css:27-52`≡`NodesPanel.css:107-132`). 항목이 14+로 늘면 표면 간 항목·조건·스타일 발산이 구조적으로 누적. 키보드 접근성(roving focus/서브메뉴/플립)을 표면마다 수동 재구현. 액션 오케스트레이션 추출이 없으므로 표면마다 copy/group/align 로직을 **재구현**하게 되어 발산이 UI 를 넘어 동작까지 확대
  - 마이그레이션: L

### 대안 B: 단일 메뉴 시스템 (스키마 + 빌더 + RAC 렌더러) — Pen 구조 + Figma 항목 관례

- 설명: 항목 스키마(`action/toggle/submenu/separator` + `destructive` + `shortcutId`) + 순수 함수 메뉴 빌더 1개 + RAC `Menu`/`Popover` 렌더러 1개. 표면(캔버스 요소/빈 영역/레이어 행)은 request 인자만 다르게 같은 빌더를 호출. 우클릭 선택 규칙·preventDefault 전역 정책을 순수 함수/단일 리스너로 확립. 클로저에 갇힌 액션 오케스트레이션은 공유 계층(`canvasActions`)으로 추출해 메뉴·단축키가 공유. 기존 메뉴 2곳 대체
- 근거: Pen v1.2.4 번들 실측 — 단일 빌더 + 좌표 인자 분기 구조가 실제 제품에서 검증됨. 항목 구성·순서는 Figma 클러스터 관례 (클립보드→z-order→구조화→컴포넌트→파괴). RAC Menu 는 빌더 내 선례 존재 (`ZoomControls.tsx` — `triggerRef` 분리 패턴)
- 위험:
  - 기술: M — (a) RAC `Popover` 의 마우스 좌표(가상 앵커) 배치가 스파이크 필요 — 실패 시 자체 포지셔닝 래퍼 + RAC `Menu` 폴백 (G1). (b) 액션 추출이 기존 단축키 경로를 건드림 — 추출은 **호출부 이동만**(로직 무변경) 으로 제한하고 기존 단축키 회귀를 G3 에서 확인
  - 성능: L — DOM 오버레이, 우클릭 시점 비용만
  - 유지보수: L — 항목 추가 = 빌더 1곳, 액션 추가 = 공유 계층 1곳, 후속 패널 메뉴는 provider 등록으로 편입
  - 마이그레이션: L — 기존 메뉴 2곳 대체 + 테스트 3벌 이관 (동작 보존 케이스가 테스트로 고정되어 있음)

### 대안 C: 단일 메뉴 시스템 + 자체(비 RAC) 렌더러

- 설명: 대안 B 와 같은 스키마/빌더/액션 추출을 쓰되, 렌더러를 기존 raw div 방식 개선으로 자작 (포지셔닝·포커스·키보드 내비게이션·서브메뉴 직접 구현)
- 근거: 가상 앵커 리스크 원천 회피. 그러나 RAC 도입 이유(D1 접근성 권위를 라이브러리에 위임)와 역행 — 빌더 시스템 UI 도 같은 스택(RAC)을 쓰는 것이 프로젝트 관례 (`ZoomControls`, 패널 Select/Popover 전반)
- 위험:
  - 기술: M — 서브메뉴 hover 의도 판정·뷰포트 플립·roving focus 를 전부 자작
  - 성능: L
  - 유지보수: **H** — WAI-ARIA menu 패턴(키보드 내비게이션/typeahead/dismiss 계층)의 수동 유지가 영구 부채. 기존 raw div 메뉴 2곳이 실증 — `BuilderCanvas.tsx:1424-1445` / `LayerTreeItemContent.tsx:231-272` 모두 roving focus·뷰포트 플립·포커스 복귀 부재 (window pointerdown + Esc 수동 등록 `BuilderCanvas.tsx:787-807` 만)
  - 마이그레이션: L

### Risk Threshold Check

| 대안 | 기술 | 성능 | 유지보수 | 마이그레이션 | HIGH+ 개수 |
| ---- | :--: | :--: | :------: | :----------: | :--------: |
| A    |  L   |  L   |  **H**   |      L       |     1      |
| B    |  M   |  L   |    L     |      L       |     0      |
| C    |  M   |  L   |  **H**   |      L       |     1      |

루프 판정: HIGH 0 대안(B)이 존재 — 새 대안 추가 루프 불요. CRITICAL 없음.

## Decision

**대안 B: 단일 메뉴 시스템 (스키마 + 순수 빌더 + RAC 렌더러 + 액션 공유 계층)** 을 선택한다.

선택 근거:

1. **잔존 위험 수용 근거**: M(기술)은 두 갈래이며 둘 다 조기 판정 가능하다 — (a) RAC 가상 앵커는 Phase 1 최선두 스파이크(G1)로 판정하고 실패 시 폴백(자체 포지셔닝 래퍼 + RAC `Menu` 내용물)이 대안 C 의 유지보수 HIGH 를 물려받지 않는 부분 채택 형태로 존재한다. (b) 액션 추출은 로직을 옮기지 않고 **호출부만 이동**하므로 기존 단축키 동작이 회귀 표면이며, G3 의 기존 테스트로 즉시 드러난다
2. 두 레퍼런스가 같은 방향을 실증한다 — Pen 은 단일 빌더 공유(번들 실측), Figma 는 표면 불문 동일 액션 체계. 파편 확장(A)은 양쪽 모두에 반례
3. 기존 구현 재사용률이 높다 — 신규 구현은 bringToFront/sendToBack/cut 소형 3종뿐이고, 나머지는 store 액션 직접 호출(7항목) 또는 기존 클로저의 위치 이동(7항목)이다

**핵심 정책 결정** (상세 항목 표는 breakdown §2):

- **표면 4종**: T1 캔버스 요소 / T2 캔버스 빈 영역 / T3 레이어 트리 행(= T1 재사용, Pen 모델) / T4 그 외 빌더 셸(자체 메뉴 없음 + 기본 메뉴 전역 억제, editable·눈금자·DEV ⌥ 예외)
- **액션 계층**: 메뉴가 부르는 액션은 `canvasActions` 공유 계층 단일 소스 (breakdown §3-7). 단축키 등록부(`useGlobalKeyboardShortcuts` / `CanvasSelectionShortcutsHost`)는 같은 계층을 소비하는 두 번째 consumer 가 된다 — 메뉴가 로직을 복제하지 않는다
- **확장 계약**: 표면별 항목 산출은 surface → provider 레지스트리 (breakdown §3-2) — 후속 표면(`panel-*`)은 provider 등록 + 진입 리스너만으로 편입. 모드별 메뉴 전체 교체는 dispatch 앞 override 훅으로 예약 (Pen `contextMenuItems?.(pos)` 동형 / Figma "모드가 메뉴를 교체" 원칙 — v1 소비자 0)
- **우클릭 선택 규칙**: `resolveClickTarget` 경유 정규화 → 선택 집합 안이면 유지(다중 선택 보존)/밖이면 교체, 빈 영역은 선택 bounds 밖일 때만 해제 (Pen 규칙)
- **노출 정책**: 조건 미충족 항목 숨김 (disabled 아님), 토글은 라벨 교체 — Figma/Pen 공통 관례
- **레퍼런스와의 의도적 발산 3건**: ① Delete 를 메뉴에 포함 (`destructive` 스타일 + 최하단 — Pen 모델; Figma 는 배제하나 레이어트리에 delete 버튼이 이미 있어 배제 일관성 부재) ② Duplicate 포함 (양쪽 모두 미노출이나 비전문가 대상 웹빌더의 발견가능성 우선) ③ Align ▸ 서브메뉴 포함 (기존 8액션이 단축키 외 마우스 경로가 없음)

기각 사유:

- **대안 A 기각**: 3중 파편(코드 경로 `BuilderCanvas.tsx:810-883` / `LayerTreeItemContent.tsx:120-272` / CSS 2벌)이 항목 수 증가에 비례해 발산 — 유지보수 HIGH. 액션 추출 없이 표면마다 오케스트레이션을 재구현하므로 발산이 동작 층까지 확대. 레퍼런스 실증 구조와도 역행
- **대안 C 기각**: WAI-ARIA menu 패턴 수동 유지가 영구 부채 (유지보수 HIGH). 빌더 시스템 UI 의 기존 RAC 스택 관례와 불일치. 단, 그 포지셔닝 계층만은 B 의 G1 폴백으로 조건부 차용

> 구현 상세: [182-builder-context-menu-breakdown.md](../design/182-builder-context-menu-breakdown.md) — 대상별 메뉴 항목 정본(§2), 시스템 설계(§3), 액션 공유 계층(§3-7), Phase 0~5(§4), 검증 체크리스트(§5), 비스코프(§6)

## Risks

| ID  | 위험                                                                                                           | 심각도 | 대응                                                                                                                                                                                               |
| --- | -------------------------------------------------------------------------------------------------------------- | :----: | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | RAC `Popover` 가상 앵커(마우스 좌표) 배치 미지원/불안정                                                        |  MED   | G1 스파이크를 Phase 1 최선두 배치 — 실패 시 자체 포지셔닝 래퍼 + RAC `Menu` 폴백 (스키마/빌더는 무영향)                                                                                            |
| R2  | 기본 메뉴 전역 억제가 개발·사용자 워크플로 차단 (Inspect 등)                                                   |  MED   | editable·눈금자 요소 예외 + DEV 빌드 ⌥+우클릭 통과. 억제는 전역 단일 리스너 1곳 — 회수 지점 단일                                                                                                   |
| R3  | 우클릭 선택 규칙 변경이 기존 좌클릭/detach 경로 회귀 (다중 선택 유지·editingContext 정규화가 기존 동작을 바꿈) |  MED   | `resolveContextMenuSelection` 순수 함수 분리 + 단위 테스트, 기존 테스트 3벌 이관 (`contextMenu/canvasContextMenuEntry.test.ts` 로 케이스 보존), G2 live                                            |
| R4  | 단축키 표기-실바인딩 불일치 (정의 2원화 상속 — `CanvasSelectionShortcuts` 관할 ⌘D/⌘G/⌘⇧G)                      |  LOW   | 메뉴는 `shortcutId` → `SHORTCUT_DEFINITIONS` 만 참조. 관할 항목의 정의 존재를 Phase 2 에서 대조. SSOT 통합은 비스코프 (breakdown §6)                                                               |
| R5  | bringToFront/sendToBack 신규 mutation 의 canonical 파이프라인 위반 (히스토리 누락/순서 역전)                   |  MED   | 기존 `reorderElementWithinParent` 패턴 준수 (canonical mutation 1차 → store mirror set → persist, `elements.ts:1767-1810`) + undo 1회 복귀 테스트                                                  |
| R6  | 액션 오케스트레이션 추출이 기존 단축키 동작을 회귀시킴 (8항목 · 640+873줄 2파일)                               |  MED   | 추출은 **로직 무변경 호출부 이동**으로 제한 (동일 함수 본문을 `canvasActions` 로 옮기고 등록부는 참조만) + elements map 은 인자 주입 (breakdown §3-7) + 신규 `canvasActions` 단위 테스트 G3 게이트 |
| R7  | 대체 시 기존 조기 반환 가드 유실 (눈금자 우클릭 오좌표 · 페이지 occlusion 오선택) 및 정적 가드 무력화          |  MED   | HC8 계승 목록을 §3-4/§3-5 에 1:1 명시 + 정적 가드를 신규 모듈 대상으로 이설 (Phase 2 산출물, 무변경 PASS 아님)                                                                                     |

잔존 HIGH 위험 없음.

## Gates

| Gate | 시점                | 통과 조건                                                                                                                                                                            | 실패 시 대안                                            |
| ---- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------- |
| G1   | Phase 1 착수 직후   | RAC `Popover` 가 임의 클릭 좌표 앵커에서 열림·플립·dismiss 정상 + **dismiss 클릭이 캔버스 포인터 파이프라인으로 전달되지 않음**(선택/마퀴 미발화) 확인 (스파이크 1파일)              | 자체 포지셔닝 래퍼 + RAC `Menu` 로 렌더러만 교체 (§3-3) |
| G2   | Phase 5 (종결 직전) | live behavior — Chrome MCP 로 4표면(요소 단일·다중/빈 영역/레이어 행/패널 억제+input 예외) 각 1회 exercise, 다중 선택 유지 + 눈금자 우클릭 오좌표 미발생 확인                        | 해당 표면 Phase 재개 — 종결 금지 (CLAUDE.md §완료 기준) |
| G3   | 각 Phase 커밋 전    | `pnpm type-check` + 이관 테스트 3벌 + `reservedPrefix.static.test.ts` + **이설된** `BuilderCanvas.projection.static.test.ts` + 신규 `canvasActions` 단위 테스트(액션 추출 회귀) PASS | 해당 Phase 내 수정 (다음 Phase 진입 금지)               |

## Consequences

### Positive

- 캔버스·레이어 트리·패널 전 표면에서 브라우저 기본 메뉴 노출 종료 — 보고된 증상("이미지저장/이미지복사/검사") 근본 해소
- 기존 결함 동반 해소: 우클릭의 다중 선택 파괴 (`BuilderCanvas.tsx:863-872`), 좌/우클릭 대상 해석 불일치, CSS 2벌 중복·`@layer` 이탈, 미정의 토큰 `--bg-elevated` 로 투명하던 메뉴 배경
- 액션 오케스트레이션이 **호출 가능한 공유 계층**으로 나오면서 단축키·메뉴가 같은 구현을 소비 — 이후 툴바/커맨드 팔레트 등 세 번째 consumer 도 재구현 없이 편입
- 메뉴 인프라가 후속 확장 통로가 됨 — 패널 항목 메뉴(DataTable/Pages), lock·hide, Select layer ▸ 는 provider 등록만으로 편입 (breakdown §6)
- 신규 액션 4종(bringToFront/sendToBack/cut/`[`·`]` 단축키)이 메뉴와 무관하게 키보드 사용자에게도 제공

### Negative

- `BuilderCanvas.tsx` / `LayerTreeItemContent.tsx` 의 기존 메뉴 코드 대체 — 테스트 3벌 이관 + projection 정적 가드 이설 비용 (동작 보존 검증 부담)
- 액션 추출이 `useGlobalKeyboardShortcuts.ts`(640줄) / `CanvasSelectionShortcuts.tsx`(873줄) 2파일을 건드린다 — 로직 무변경 이동이지만 단축키 경로가 회귀 표면이 됨 (R6)
- 기본 메뉴 전역 억제로 패널 빈 영역에서 브라우저 편의 기능(뒤로가기 등) 상실 — 앱형 UX 로의 의도된 전환이나 웹 관성 사용자에게 마찰 (DEV ⌥ 예외로 개발 마찰만 완화)
- 단축키 정의 2원화가 메뉴 표기라는 세 번째 소비자를 얻음 — 통합 전까지 대조 의무 발생 (R4)
