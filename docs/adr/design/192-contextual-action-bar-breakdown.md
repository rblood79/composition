# ADR-192 Design Breakdown — Contextual Action Bar

> 본문: [192-contextual-action-bar.md](../192-contextual-action-bar.md) · 리서치 정본: [ACTION_BAR_BENCHMARK.md](../../explanation/research/ACTION_BAR_BENCHMARK.md) · 선행 base: [ADR-182](../completed/182-builder-context-menu.md) + [breakdown](182-builder-context-menu-breakdown.md)

## §1. Fork lock-in (ADR-016 → ADR-192) — 4 질문

| #   | 질문                       | 답 (1줄)                                                                                                                                                                                                                                               |
| --- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | base / 응용 분류           | **ADR-182 가 base** (액션 공유 계층 `canvasActions` + surface→provider 레지스트리 + `ContextMenuItem` 스키마), ADR-192 는 그 위의 **응용 표면** 1개. 182 Implemented (2026-08-16) 이므로 prerequisite 충족                                             |
| 2   | schema 직교성              | 192 는 항목 스키마를 신설하지 않고 182 `ContextMenuItem` 을 **소비만** 한다. 신규 상태는 `canvasSettings` slice 의 additive 필드 (`actionBar: {hidden, pinned, offset}`) — canonical document / project data 와 직교                                   |
| 3   | 선행 ADR 전제 reverse 검증 | 016 §5.1 "신규 `builder/actions/` 계층" 전제는 182 가 `canvas/actions/` 로 이미 구현해 **무효** (grep `ContextualActionBar\|builder/actions/` 0건). 016 §5.2 "선택 bounds 부착 + zoom/pan 추적" 전제는 리서치 §3 으로 **기각** — 본문 대안 A 로 재평가 |
| 4   | codex 1차 진입 시점        | 본문·breakdown 작성 직후 `review-adr` round 1 (전제 layer 는 본 표 + 사용자 결정 기록으로 확정, codex 는 정합 layer)                                                                                                                                   |

사용자 confirm 기록: 2026-08-26 "016 을 Superseded 로 닫고, Action Bar 는 photoshop-online 과 figma 의 액션바를 리서치부터 한 후 ADR 설계 시작해" — fork + 리서치 선행 + 신규 ADR 3건 명시. 전제 확정 종결 계약 성립 (CLAUDE.md §전제·관점 의문 처리 2번).

## §2. 항목 정본 — 컨텍스트별 노출 (≤5 + ⋯)

표기: 항목 = 182 §2 T1 번호. `⋯` = 오버플로 버튼 — 클릭 시 **기존 컨텍스트 메뉴** (`surface: "canvas-element"`, 앵커 = ⋯ 버튼 rect) 를 연다. 바 전용 항목 정의 없음. 조건 미충족 항목은 **숨김** (182 노출 정책 동일). 단축키 표기는 `ShortcutTooltip shortcutId=` 파생.

| 컨텍스트                                | 판정 조건 (선택 집합)                                 | 노출 순서 (좌→우)                                                                                                | 비고                                                                                    |
| --------------------------------------- | ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| C0 없음 / body 만 / 적격 0              | `selectedElementIds` 비어 있거나 전부 body            | **바 미마운트**                                                                                                  | Photoshop 자동 숨김                                                                     |
| C1 단일 일반 요소                       | 1개, body·frame·인스턴스 아님                         | T1-3 복제 · T1-8 그룹 만들기 · T1-11 컴포넌트 만들기↔해제 · **E1 텍스트 편집** (조건부) · ⋯                      | E1 은 Phase 0 에서 진입 predicate 실측 후 확정 — 미실측 시 v1 제외                      |
| C2 단일 frame / group                   | 1개, `type` frame 또는 legacy group                   | T1-9 그룹 해제 · T1-3 복제 · T1-11 컴포넌트 토글 · ⋯                                                             |                                                                                         |
| C3 단일 인스턴스 (ref)                  | 1개, origin 존재                                      | T1-12 원본으로 이동 · T1-13 인스턴스 분리 · T1-3 복제 · ⋯                                                        | 182 조건 그대로                                                                         |
| C4 다중 (2+)                            | 2개 이상, body 제외 후 1개 이상                       | **A1 정렬** (popover: 정렬 6 + 분배 2 아이콘) · T1-8 그룹 만들기 · T1-3 복제 · T1-13 인스턴스 분리 (해당 시) · ⋯ | A1 = T1-10 서브메뉴의 popover 표현 — 액션은 `alignSelection`/`distributeSelection` 동일 |
| M1 텍스트 편집 중 / 페이지 제목 편집 중 | `TextEditOverlay` / page-title 편집 활성              | **바 미마운트**                                                                                                  | Photoshop 은 서식 바로 전환 — v1 비스코프 (§7)                                          |
| M2 드래그·리사이즈·마퀴 중              | `useDragInteraction.isDragging` 등 상호작용 세션 활성 | **바 숨김** (마운트 유지, `visibility:hidden`)                                                                   | 프레임 중 DOM 변이 0 유지                                                               |
| M3 frame 편집 모드 / compare 모드       | `isFrameEditMode` / preview compare                   | Phase 0 실측 후 판정 — 기본은 C1~C4 동일                                                                         |                                                                                         |

**배제 (의도)**: 복사·붙여넣기 (키보드·메뉴 경로 충분, Photoshop/Figma 모두 바에 없음) · 삭제 (파괴적 — 두 레퍼런스 모두 배제, 182 메뉴에만 존재) · z-order 4종 (⋯ 로 접근).

**다중 선택 값 충돌**: 토글형 항목 (T1-11) 은 182 규칙대로 단일 선택 전용 → 다중에서 숨김. "Mixed" 표현 불필요.

## §3. 시스템 설계

### 3-1. 파일 구조 (신규 `components/overlay/actionBar/` — contextMenu 와 동위상)

```
apps/builder/src/builder/components/overlay/actionBar/
├── buildActionBarItems.ts        # 순수: (selection, elementsMap, mode) → ActionBarModel | null
├── buildActionBarItems.test.ts
├── actionBarPolicy.ts            # 컨텍스트 판정 C0~C4 / M1~M3 + allowlist·순서·cap 5 (순수)
├── actionBarPolicy.test.ts
├── ContextualActionBar.tsx       # RAC Toolbar + Button + MenuTrigger(⋯ 옵션) + 드래그 핸들
├── ContextualActionBar.test.tsx
├── useActionBarPlacement.ts      # offset 영속·clamp·Pin/Reset (canvasSettings 소비)
├── useActionBarPlacement.test.ts
├── actionBar.css
└── index.ts
```

### 3-2. 항목 산출 — 182 레지스트리 재사용 (스키마 신설 0)

```ts
// buildActionBarItems.ts (개념)
const menuItems = buildCanvasContextMenuItems(
  { surface: "canvas-element", clientX: 0, clientY: 0, targetElementIds },
  providerOptions,
); // 182 정본 그대로
const model = applyActionBarPolicy(menuItems, context); // allowlist by item.id + 순서 + cap 5
```

- 182 항목 `id` 가 두 표면의 **계약**이 된다 — Phase 0 에서 `canvasContextMenuProviders.ts:68` 의 id 생성 헬퍼가 만드는 id 문자열을 freeze (예: `"duplicate"`, `"group"`, `"toggle-component"`, `"go-to-origin"`, `"detach-instance"`, `"align"`). 헬퍼가 id 를 안정 문자열로 만들지 않으면 Phase 1 에서 **상수화 1회** (182 회귀 테스트로 보호).
- `⋯` 는 `useContextMenu().open({ surface: "canvas-element", clientX, clientY, targetElementIds })` — ⋯ 버튼 `getBoundingClientRect()` 의 좌상단을 앵커로 전달. 메뉴 렌더러·선택 규칙·preventDefault 정책 전부 182 것.
- A1 정렬 popover: RAC `MenuTrigger` + `Popover` + 아이콘 8개 (`ALIGNMENT_ICONS` 재사용). 실행은 T1-10 서브메뉴 항목의 `run` 을 그대로 호출 (submenu `items[]` 를 popover 그리드로 재배열).

### 3-3. 렌더러

- 컨테이너: `Workspace.tsx:88` 의 `.workspace-overlay` (이미 `position:absolute; inset:0; pointer-events:none`) 안에 마운트. 바 루트만 `pointer-events:auto`.
- 기본 위치: overlay 하단 중앙, `bottom: 16px; left: 50%; translateX(-50%)`. 사용자 드래그 시 `offset {dx, dy}` 를 기본 위치 기준 상대값으로 저장 → 뷰포트 리사이즈에도 중앙 기준이 유지된다. 마운트/리사이즈 시 overlay rect 로 clamp.
- 구조: `<Toolbar aria-label="선택 액션">` (shared RAC 래퍼, HistoryPanel 선례) → `[핸들] [Button×≤5] [⋯] [옵션 ▾]`. 옵션 = RAC `MenuTrigger` (Pin bar position 토글 / Reset bar position / Hide bar) — Photoshop ⋯ 메뉴 동형.
- 버튼: shared `Button variant="ghost" size="sm"` + `ShortcutTooltip shortcutId` (단축키 학습 UI). 아이콘 `ACTION_ICONS` (182 와 동일 키).
- **포커스 정책**: 버튼은 RAC `Button` 의 `preventFocusOnPress` 로 캔버스 포커스를 유지 — 클릭 후 `canvas-focused` scope 단축키 27개가 계속 동작. 키보드로 바에 진입한 경우 (Tab) 에만 Toolbar 화살표 탐색, `Escape` 로 캔버스 복귀.
- 갱신 트리거: `selectedElementIds` / elementsMap 의 선택 요소 변화 / 모드 플래그 — Zustand selector 구독. **프레임 루프·bounds 구독 없음.**

### 3-4. 상태 (canvasSettings additive)

```ts
actionBar: {
  hidden: boolean;                  // Hide bar — 재표시는 SettingsPanel 토글
  pinned: boolean;                  // Pin — 드래그 핸들 비활성
  offset: { dx: number; dy: number } | null; // null = 기본 위치 (Reset)
}
```

- 영속: `showRulers` 와 같은 경로 (Phase 0 에서 canvasSettings 의 localStorage 여부 실측 — 미영속이면 본 필드만 `persist` partialize 로 추가).
- 재표시 경로: `SettingsPanel.tsx:110` 눈금자 토글 옆에 "선택 액션 바 표시" 토글 (Photoshop `Window > Contextual Task Bar` 대응). 신규 단축키 없음.

### 3-5. CSS

- `actionBar.css` — 패널 시각 어법 (line-art 아이콘, accent-subtle gray wash) 준수. `contextMenu.css` 의 surface 토큰 재사용, 신규 색 토큰 없음. 그림자·radius 는 기존 팝오버와 동일 값.

## §4. Phase 분해

| Phase | 내용                                                                                                                                                                                                                                                                                                                                                     | 산출/검증                                                                                                 |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| 0     | **인벤토리 freeze** (실측 5건): ① provider 항목 id 문자열 전수 (`canvasContextMenuProviders.ts:68` 헬퍼) ② 요소 텍스트 편집 진입점·predicate (Skia dblclick → `startEdit` 경로) ③ `canvasSettings` 영속 메커니즘 ④ 드래그/리사이즈/마퀴 세션 플래그의 store 노출 여부 (`useDragInteraction.isDragging` 은 훅 로컬) ⑤ frame 편집 모드·compare 모드 플래그 | breakdown §2 E1/M2/M3 확정 + §3-4 영속 경로 확정. 결과를 본 표 아래 "Phase 0 결과" 로 기록                |
| 1     | 순수 계층: `actionBarPolicy` (C0~~C4/M1~~M3 판정 + allowlist/순서/cap) + `buildActionBarItems` (182 빌더 호출 → 모델)                                                                                                                                                                                                                                    | 단위 테스트: 컨텍스트 8종 × 노출 순서 / cap 5 / body 필터 / 다중 토글 숨김 / 182 항목 id 변경 시 실패     |
| 2     | UI: `ContextualActionBar.tsx` + CSS + `.workspace-overlay` 마운트 + selector 구독 + 자동 숨김 + `preventFocusOnPress` + ⋯ → 182 메뉴 + A1 popover                                                                                                                                                                                                        | 컴포넌트 테스트 + **live**: 선택→표시 / 빈 선택→미마운트 / 버튼 실행 / 클릭 후 ⌘D·⌫ 동작                  |
| 3     | 배치: 드래그 핸들 · Pin/Reset/Hide 옵션 메뉴 · `canvasSettings.actionBar` 영속 · clamp · SettingsPanel 재표시 토글                                                                                                                                                                                                                                       | 단위: offset 상대값·clamp·reset. **live**: 드래그→리로드 유지 / Pin 시 드래그 불가 / Hide→Settings 재표시 |
| 4     | 종결: G1~G3 통과 기록 · README/CHANGELOG · 본문 Implemented                                                                                                                                                                                                                                                                                              | CLAUDE.md §완료 기준 — live exercise 항목 명시                                                            |

Phase 0 결과: (착수 시 기록)

### 파일 변경표 (추정 — Phase 0 후 재freeze)

| 파일                                                         | 변경                                               |
| ------------------------------------------------------------ | -------------------------------------------------- |
| `components/overlay/actionBar/*` (신규 9)                    | §3-1                                               |
| `workspace/Workspace.tsx`                                    | `.workspace-overlay` 안에 `<ContextualActionBar/>` |
| `stores/canvasSettings.ts`                                   | `actionBar` 필드 + setter 3                        |
| `panels/settings/SettingsPanel.tsx`                          | 재표시 토글 1                                      |
| `workspace/canvas/contextMenu/canvasContextMenuProviders.ts` | (조건부) 항목 id 상수화                            |
| `components/overlay/index.ts`                                | export                                             |
| i18n 리소스                                                  | 라벨 4~6                                           |

## §5. 검증 체크리스트

- [ ] Phase 0 실측 5건 기록 (추정 vs 실측 gap 은 여기서 흡수 — fork 사유 아님)
- [ ] 182 기존 테스트 전부 PASS (항목 id 상수화 후에도)
- [ ] 컨텍스트 C0~~C4 / M1~~M2 단위 테스트
- [ ] live: 단일/frame/인스턴스/다중 4종 선택에서 바 항목이 §2 표와 일치 (스크린샷)
- [ ] live: 바 버튼 클릭 직후 ⌘D · ⌫ · ⌘G 가 캔버스에 적용 (포커스 미탈취)
- [ ] live: 드래그 중·텍스트 편집 중 바 비표시, 종료 후 복귀
- [ ] live: 드래그 이동 → 새로고침 후 위치 유지 / Reset → 하단 중앙 / Pin → 핸들 비활성 / Hide → Settings 토글로 재표시
- [ ] 성능: 선택 불변 상태에서 pan/zoom 60프레임 동안 바 DOM 변이 0 (MutationObserver 카운트)
- [ ] type-check 0 / codex:preflight PASS

## §6. 비스코프 (후속)

| 항목                                             | 사유                                                                            | 재개 조건                                   |
| ------------------------------------------------ | ------------------------------------------------------------------------------- | ------------------------------------------- |
| Properties 패널 "Quick Actions" 미러             | Photoshop 완전 모델의 절반. 바가 안정된 뒤 같은 `buildActionBarItems` 로 1 섹션 | 바 사용 실측 후 (패널 접힘 시 소실 불만 시) |
| 텍스트 편집 중 서식 바 (Photoshop Type 컨텍스트) | TextEditOverlay 와 서식 채널 (D3 catalog) 경계 설계 필요                        | 인라인 서식 편집 요구 시                    |
| 모달 워크플로 확정 컨트롤 (Done)                 | composition 에 Crop/Place 류 모달 편집 없음                                     | 해당 모드 도입 시 182 `modeOverride` 자리   |
| 바 항목 사용자 커스터마이즈                      | Illustrator 포럼 요청 수준 — 레퍼런스도 미제공                                  | —                                           |
| 신규 단축키 (바 토글)                            | 69개 레지스트리 충돌 검증 비용 대비 효용 낮음 — Settings 토글로 충분            | 요청 시 1행                                 |
| 레이어 트리 행 선택 시 바 표시 위치 변경         | 바는 캔버스 overlay 고정 — 트리 선택도 같은 `selectedElementIds` 라 자동 반영   | —                                           |
