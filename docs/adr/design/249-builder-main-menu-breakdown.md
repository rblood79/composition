# ADR-249 구현 상세 — 빌더 전체 메뉴 개편

> 본문: [ADR-249](../completed/249-builder-main-menu.md). 이 문서는 인벤토리 · 메뉴 구조 초안 · phase · 파일 경계 · gate 측정 방법을 둔다.

## 1. 전제 lock-in (fork 4 질문)

1. **base / 응용**: 이 ADR 은 응용 (표시 surface) 이다. base 는 명령 정의 (`SHORTCUT_DEFINITIONS`, ADR-195 이전부터) · 실행 레지스트리 (ADR-195) · 정적 metadata (ADR-196) · 라벨 (ADR-200) · 패널 레지스트리 (`PanelRegistry`) 이며 전부 Implemented. 이 ADR 은 그것들을 읽기만 한다.
2. **schema 직교성**: 새 저장 schema 없음. 문서 · 프로젝트 데이터 무변경. `ShortcutDefinition` 타입도 바꾸지 않는다 (헤더 전용 액션은 별도 타입).
3. **선행 전제 reverse**: 선행 ADR 의 의존 방향을 뒤집지 않는다. 단 하나 소비 확장이 있다 — `COMMAND_META.precondition` 이 agent 외에 메뉴 활성 판정에도 쓰인다 (§4-2). ADR-196 본문은 precondition 을 "handler 앞단 조건을 그대로 옮긴 것" 으로 정의하므로 새 의미를 얹지 않는다. 1차 리뷰 뒤 ADR-195 `CommandEntry` 에 선택 필드 둘이 생긴다 (§4-2 등록자 실행 조건 · §4-5 실행 인자). 등록 · 해석 규칙은 그대로이고 기존 등록은 수정 없이 통과하므로 의존 방향은 바뀌지 않는다.
4. **리뷰 단계**: 위 1~3 은 작성 시점에 확인했다. 사용자 확인이 필요한 결정은 §7 에 모았다.

## 2. Phase 0 인벤토리 (2026-09-29 실측)

### 2-1. 명령 정의 71 분류

`SHORTCUT_DEFINITIONS` (`apps/builder/src/builder/config/keyboardShortcuts.ts`) 는 71 정의 (`category:` 71행). 이전 대화에서 말한 69 는 grep 패턴 누락이었다.

| 분류                                                                                                        |   개수 | 메뉴              | 사유                                                                  |
| ----------------------------------------------------------------------------------------------------------- | -----: | ----------------- | --------------------------------------------------------------------- |
| system (undo · redo · openProject)                                                                          |      3 | 포함              |                                                                       |
| navigation (zoomIn · zoomOut · zoomToFit · zoomToSelection · zoom100 · zoom200)                             |      6 | 포함              |                                                                       |
| navigation `zoomInNumpad`                                                                                   |      1 | 제외              | `zoomIn` 별칭                                                         |
| panels (toggle 9 · toggleRulers · toggleWorkflowOverlay · openSettings · commandPalette)                    |     13 | 포함              | 패널 토글 9 는 §2-2 의 레지스트리 파생 목록에 합류                    |
| canvas 편집 (cut · copy · paste · duplicate · delete · selectAll)                                           |      6 | 포함              |                                                                       |
| canvas 구조 (group · ungroup · z-order 4 · align 6 · distribute 2 · toggleComponentOrigin · detachInstance) |     16 | 포함              |                                                                       |
| canvas `deleteAlt` · `escape` · `nextElement` · `prevElement` · `arrow*` 8                                  |     12 | 제외              | 별칭 · 연속 키 · 선택 이동 (COMMAND_META `off`)                       |
| properties (copy/paste Styles · copy/paste Properties · toggleFocusMode)                                    |      5 | 포함              | 패널 헤더 버튼과 같은 명령 (§2-3) — 소속 패널이 보일 때만 활성 (§4-2) |
| properties `toggleSections`                                                                                 |      1 | 제외              | 패널 UI 전용 (`view(false)`)                                          |
| navigator `tree*`                                                                                           |      8 | 제외              | RAC TreeBase 네이티브 · `palette:false`                               |
| **합계**                                                                                                    | **71** | 포함 49 · 제외 22 |                                                                       |

### 2-2. 패널 레일 · dock 버튼 (사용자 요청 2026-09-29 "left, right, dock panel 의 버튼들도 전체메뉴에 포함")

레일은 `PanelWorkspace.tsx:1471-1483` 이 left · right 두 개만 렌더한다. 저장 모델은 `railOrder.bottom` 도 허용한다 — `railSideForPanel` (`:85-92`) 이 세 방향을 보고, V2 migration (`panelWorkspaceLayoutV2Migration.ts:275` `bottomPanels`) · reset 테스트 (`panelWorkspacePolicyV4.test.ts:454-459`) 가 bottom 패널을 다룬다. bottom 에 놓인 패널은 레일 버튼이 없어 지금은 단축키로만 열린다. 목록은 `PanelRegistry` (`panels/core/panelConfigs.ts:302` 등록) 에서 파생하고 `hiddenFromRail` 을 거른다 (`layout/PanelToggleGroup.tsx`).

| 패널            | 기본 위치 | 레일 | `shortcutId`     | 메뉴                                        |
| --------------- | --------- | ---- | ---------------- | ------------------------------------------- |
| navigator       | left      | O    | toggleNavigator  | 루트 상단 — 왼쪽                            |
| components      | left      | O    | toggleComponents | 루트 상단 — 왼쪽                            |
| datatable       | left      | O    | toggleDatatable  | 루트 상단 — 왼쪽                            |
| datatableEditor | left      | O    | **없음**         | 루트 상단 — 왼쪽 (단축키 표시 없음)         |
| theme           | left      | 숨김 (09-29)    | toggleTheme      | 루트 상단 — 왼쪽                            |
| ai              | right     | O    | toggleAI         | 루트 상단 — 오른쪽                          |
| properties      | right     | O    | toggleProperties | 루트 상단 — 오른쪽                          |
| styles          | right     | O    | toggleStyles     | 루트 상단 — 오른쪽                          |
| events          | right     | O    | toggleEvents     | 루트 상단 — 오른쪽                          |
| history         | right     | 숨김 (09-29)    | toggleHistory    | 루트 상단 — 오른쪽                          |
| settings        | left      | 숨김 | openSettings     | 루트 상단 — 작업 공간                       |
| datatableField  | left      | 숨김 | 없음             | 제외 — 편집기 옆에 붙는 문맥 패널 (ADR-212) |

`datatableEditor` 처럼 레일에는 있고 `shortcutId` 가 없는 패널이 있어서, 패널 항목을 `SHORTCUT_DEFINITIONS` 의 toggle 명령으로 만들면 빠진다. 그래서 **패널 항목은 `PanelRegistry` 에서 파생**하고 (레일과 같은 목록 · 같은 `hiddenFromRail` 규칙), 체크 표시는 workspace `visibility`, 실행은 레일과 같은 `togglePanel`, 단축키 표기는 `shortcutId` 가 있을 때만 붙인다. `railOrder` 세 방향 (왼쪽 · 오른쪽 · 아래) 으로 구역을 나눈다 — 사용자가 패널을 옮기면 메뉴 구역도 따라간다 (`railSideForPanel`). 아래 구역은 비어 있지 않을 때만 보이고, 그 패널을 마우스로 여는 유일한 경로가 된다.

### 2-3. 패널 헤더 액션 (dock 안 패널 프레임)

| 패널            | 헤더 버튼                                         | 메뉴                                                                                   |
| --------------- | ------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Styles          | 포커스 모드 · 스타일 복사 · 스타일 붙여넣기       | 포함 — `toggleFocusMode` · `copyStyles` · `pasteStyles` 명령                           |
| Properties      | 속성 복사 · 붙여넣기 (`PropertyClipboardActions`) | 포함 — `copyProperties` · `pasteProperties`                                            |
| History         | 실행 취소 · 다시 실행 · 스냅샷 만들기             | undo/redo 는 Edit 에 이미 포함. 스냅샷 만들기는 파일 ▸ 스냅샷 만들기 (헤더 액션, §2-4) |
| AI              | 에이전트 중지 · 고급 모드 · 대화 초기화           | 제외 — 패널 내부 상태                                                                  |
| DataTable       | 새로고침 · 탭                                     | 제외 — 패널 내부                                                                       |
| DataTableEditor | 설정                                              | 제외 — 패널 내부                                                                       |
| Navigator       | Pages/Layers/Layouts 탭                           | 제외 — 탭                                                                              |
| Themes          | 라이트/다크 미리보기 전환                         | 제외 — 패널 내부 미리보기 (빌더 테마는 View ▸ 모양)                                    |
| 모든 패널       | 닫기                                              | 루트 상단 패널 항목 체크 해제와 같은 동작 — 별도 항목 없음                             |

판정 규칙: **문서 · 선택 · 작업 공간 전체에 작용하는 버튼은 포함, 패널 자기 내부 상태만 바꾸는 버튼은 제외.**

### 2-4. 헤더 전용 액션 (명령 정의 밖)

`ShortcutDefinition.key` 는 필수 (`types/keyboard.ts:45`) 라 키 없는 동작은 정의에 넣을 수 없다. 현행 헤더 메뉴의 아래 항목은 별도 타입 (`HeaderMenuAction`) 으로 둔다.

| 항목                                         | 현행 위치                                                         | 새 위치                                                                                                                                                                                                                                                          |
| -------------------------------------------- | ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 가져오기 · 내보내기 · JSON(v1) 내보내기      | `BuilderHeader.tsx` onAction                                      | File                                                                                                                                                                                                                                                             |
| 폴더 연결… (`showDirectoryPicker` 있을 때만) | 같음                                                              | File — 플랫폼 미지원은 숨김 유지 (상태가 아니라 능력 부재)                                                                                                                                                                                                       |
| 프로젝트 삭제…                               | 같음 (2026-09-29 `96ab2cee1`)                                     | File                                                                                                                                                                                                                                                             |
| 스냅샷 만들기                                | History 패널 헤더 (`HistoryPanel.tsx:213` `handleCreateSnapshot`) | File — 기능은 store 에 있다 (`stores/history/snapshots.ts:165` `createSnapshot` · `:151` `canCreateUserSnapshot`, 상한 10). 없는 것은 단축키 정의뿐이라 헤더 액션으로 둔다. 패널 handler 를 공용 함수 하나로 옮겨 패널 · 메뉴가 같이 부른다. 상한 도달 시 비활성 |
| 패널 레이아웃 초기화                         | 같음                                                              | View                                                                                                                                                                                                                                                             |
| 모양 (시스템 · 라이트 · 다크)                | 없음 — `stores/uiStore.ts` `setThemeMode`, 설정 패널에만          | View ▸ 모양                                                                                                                                                                                                                                                      |
| 객체에 스냅                                  | 우클릭 메뉴 (`canvasContextMenuProviders.ts:510`)                 | 보기 (체크) — 환경설정 하위 메뉴는 설정이 루트로 올라가며 항목이 이것 하나라 없앤다                                                                                                                                                                              |

### 2-5. Framer 메뉴 어법 채택표 (09-29 실측 기준)

| #   | Framer 어법                                                                                        | 채택       | 비고                                                                                                                                                                                                                                                             |
| --- | -------------------------------------------------------------------------------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | 루트 맨 위 검색창                                                                                  | O          | RAC `Autocomplete` — 검색어가 있으면 모든 잎 항목을 경로와 함께 평면 표시                                                                                                                                                                                        |
| 2   | 작업 공간 전환 목록 — 루트 맨 위 Canvas ⌥1 · CMS ⌥2 · Localization ⌥3 · Analytics ⌥4 · Settings ⌥5 | O          | 같은 자리에 레일 패널 10 (왼쪽 ⌥1~~4 · 오른쪽 ⌥5~~8 · AI ⌘K · 데이터 편집기) + 워크플로 오버레이 ⌃⌥W + 설정 ⌘, (사용자 제안 2026-09-29). Framer 는 현재 영역 하나를 고르는 목록, composition 은 여러 개를 켜고 끄는 체크 목록 — 단축키 어법 (⌥숫자) 은 이미 같다 |
| 3   | 이동 — Go to dashboard · Quick actions ⌘K (#2 아래 구역)                                           | O          | 대시보드 ⌘O · 명령 팔레트 ⌘/                                                                                                                                                                                                                                     |
| 4   | 분류 하위 메뉴                                                                                     | O          | 파일 · 편집 · 보기 · 레이아웃 · 컴포넌트                                                                                                                                                                                                                         |
| 5   | 3단 하위 메뉴 (Copy ▸ · Align ▸ · Appearance ▸)                                                    | O          | 보기 ▸ 모양 · 레이아웃 ▸ 정렬                                                                                                                                                                                                                                    |
| 6   | 쓸 수 없는 항목은 비활성 (숨기지 않음)                                                             | O          | 위치 고정 — 우클릭 메뉴는 숨김 유지 (ADR-182)                                                                                                                                                                                                                    |
| 7   | 모든 항목에 단축키 표기                                                                            | O          | `formatShortcut` 단일 표기                                                                                                                                                                                                                                       |
| 8   | 켜고 끄는 항목은 체크 표시                                                                         | O          | 눈금자 · 워크플로 · 패널 · 스냅                                                                                                                                                                                                                                  |
| 9   | 선택에 따라 라벨이 바뀜                                                                            | O          | 컴포넌트 만들기/해제 — `componentSemanticsActions` 의 `labelKey(target)` 재사용                                                                                                                                                                                  |
| 10  | 대화상자를 여는 항목은 `…`                                                                         | O          | 가져오기… · 폴더 연결… · 프로젝트 삭제… · 설정…                                                                                                                                                                                                                  |
| 11  | Tool 메뉴 (한 글자 도구 F·S·T·R·O·P)                                                               | 후속       | 도구 명령 0 개 (`tools` 분류 정의 0). 명령이 생기면 구조 표에 한 줄로 추가 (§7-3)                                                                                                                                                                                |
| 12  | Rename · Lock · Hide · Select parent/children                                                      | 후속       | 요소 잠금·숨김은 데이터 모델에 없음, 요소 이름 변경 · 부모 선택 명령 없음. 생기면 편집 ▸ 에 추가 (§7-3)                                                                                                                                                          |
| 13  | Help (튜토리얼 · 커뮤니티 · 버전 복사)                                                             | O (자리만) | 도움말 ▸ 튜토리얼 · 버전 — 사용자 지시 2026-09-29 "메뉴만 생성". 연결 대상 (튜토리얼 URL · 버전 정보) 이 없어 **비활성**으로 둔다 — 눌러도 아무 일 없는 항목은 `96ab2cee1` 결함과 같다. 대상이 생기면 구조 표의 항목을 헤더 액션에 연결하고 활성화               |

## 3. 메뉴 구조 초안 (Phase 1 에서 표로 고정)

```
[검색…]
── 작업 공간 (열림 = 아이콘 칸 채움 · 레일과 같은 아이콘 · 방향 머리글 없음, 구분선으로 나눔) ──
  ✓내비게이터 ⌥1 · 컴포넌트 ⌥2 · 데이터 ⌥3 · 데이터 편집기 · 테마 ⌥4        (railOrder.left)
  ────
  ✓AI ⌘K · 속성 ⌥5 · 스타일 ⌥6 · 인터랙션 ⌥7 · 히스토리 ⌥8                   (railOrder.right)
  ────
  (railOrder.bottom 이 비어 있지 않을 때만)
  ────
  ✓Workflow ⌃⌥W
대시보드                   ⌘O          (구분선 없이 이어짐)          (종전 "프로젝트 열기" — 사용자 2026-09-29)
────
파일 ▸       가져오기… · 내보내기 · JSON(v1) 내보내기 · 폴더 연결… │ 스냅샷 만들기 │ 프로젝트 삭제…
편집 ▸       실행 취소 · 다시 실행 │ 잘라내기 · 복사 · 붙여넣기 · 복제 · 삭제 │ 모두 선택
             │ 스타일 복사 · 스타일 붙여넣기 · 속성 복사 · 속성 붙여넣기
보기 ▸       확대 · 축소 · 화면에 맞춤 · 선택에 맞춤 · 100% · 200%
             │ ✓눈금자 · ✓포커스 모드 · ✓객체에 스냅
             │ 모양 ▸ (시스템 · 라이트 · 다크) │ 패널 레이아웃 초기화
레이아웃 ▸   프레임으로 묶기 · 프레임 해제 │ 맨 앞으로 · 앞으로 · 뒤로 · 맨 뒤로 │ 정렬 ▸ (왼쪽·가로 가운데·오른쪽 │ 위·세로 가운데·아래 │ 가로 분배·세로 분배)
컴포넌트 ▸   컴포넌트 만들기/해제 (문맥 라벨) · 인스턴스 분리
────
명령 팔레트                ⌘/
설정                       ⌘,          (체크 없음 — 한 구역에 체크 항목과 섞지 않는다)
도움말 ▸     튜토리얼 · 버전          (둘 다 비활성 — 자리만)
```

## 4. 설계 요소

### 4-1. 메뉴 구조 표 (`builderMenuStructure.ts`)

순서 · 구역 · 구분선 · 하위 메뉴만 적는다. 항목은 `{ command: ShortcutId }` · `{ panels: "rail" }` (레지스트리 파생 묶음) · `{ action: HeaderMenuActionId }` 셋 중 하나. 라벨 · 단축키 · 실행은 표에 적지 않는다 — 원본에서 읽는다.

### 4-2. 항목 상태 판정 (`resolveMenuItemState`)

| 상태   | 명령 항목                                                                | 패널 항목                     | 헤더 액션                           |
| ------ | ------------------------------------------------------------------------ | ----------------------------- | ----------------------------------- |
| 라벨   | `t(\`command.${id}\`)`(ADR-200) · 문맥 라벨은`componentSemanticsActions` | `getPanelLabel` (레일과 같음) | 기존 `header.*` 키                  |
| 단축키 | `formatShortcut(def)`                                                    | `shortcutId` 있으면 같은 방식 | 없음 (openProject 등 명령인 것만)   |
| 활성   | 등록 · precondition · 등록자 실행 조건 · 소속 패널 (아래 네 조건 AND)    | 항상                          | 액션별 (삭제는 `projectId` 있을 때) |
| 체크   | toggle 명령은 대응 store 값                                              | workspace `visibility`        | 모양 · 스냅 store 값                |

명령 항목의 활성은 네 조건의 AND 다.

1. **등록**: `resolveCommand(id)` 가 있다 (핸들러가 지금 마운트돼 있다). 같은 id 다중 등록은 priority → seq 규칙 그대로.
2. **precondition**: `COMMAND_META[id].precondition` 이 없거나 `ok`. store (`AgentReadModel`) 로 알 수 있는 조건은 여기 둔다 — 예: `copyStyles` (`commandMeta.ts:286`, 지금 precondition 없음) 는 핸들러가 선택 없으면 return 하므로 (`CanvasSelectionShortcuts.tsx:243-249`) 단일 선택 precondition 을 더한다.
3. **등록자 실행 조건**: `CommandEntry.canRun?: () => boolean` (선택 필드). store 로 알 수 없고 등록한 쪽 클로저에만 있는 조건. 현재 대상은 `zoomToSelection` 하나 — bounds 계산이 캔버스 컨텍스트 (frameAreas · pagePositions) 를 요구한다 (`BuilderCanvas.tsx:1371-1385`). 핸들러의 early return 과 `canRun` 은 같은 함수 (`hasZoomToSelectionTarget`) 를 불러 어긋나지 않게 한다. 메뉴는 열릴 때 한 번 부른다. **전달 경로** (2차 리뷰): `BuilderCanvas` 는 `bindHandlersToDefinitions` (`useKeyboardShortcutsRegistry.ts:123-150`) 로 등록하고, 등록 hook 은 `registerCommand` 에 `id · handler · scope · priority · allowInInput · disabled` 만 넘긴다 (`:379-392`). 그래서 `KeyboardShortcut` 에 `canRun?` 을 더하고 등록 hook 이 그대로 넘기며, `BuilderCanvas` 는 `bindHandlersToDefinitions` 결과에 `canRun` 을 얹어 등록한다. `CommandEntry` 만 바꾸면 메뉴에 도달하지 않는다 (P1 unit: 등록 hook 경유 `canRun` 이 `resolveCommand` 결과에 있다).
4. **소속 패널**: 정의 scope 가 `panel:*` 인 명령은 그 패널이 workspace `visibility` 에서 보일 때만. 패널 id 는 `useActiveScope.ts` 의 `PANEL_SCOPE_MAP` (`:60`, 지금 export 없음) 역으로 파생한다 — 같은 파일에 `panelIdForScope(scope): PanelId | null` 을 export 해 맵은 한 벌만 둔다. `panel:*` 이 아니거나 맵에 없는 scope 는 `null` (소속 패널 조건 없음). 메뉴는 이 함수만 부른다 (2차 리뷰). 등록 여부로 대신할 수 없다 — `copyStyles` · `pasteStyles` 는 ADR-155 이후 상시 host (`BuilderCore.tsx:1645` `CanvasSelectionShortcutsHost` → `CanvasSelectionShortcuts.tsx:302-305`) 가 등록해 Styles 패널을 닫아도 남고, `copyProperties` · `pasteProperties` 는 PropertiesPanel 안 (`PropertiesPanel.tsx:878-891`), `toggleFocusMode` 는 StylesPanel 안 (`StylesPanel.tsx:187`) 에서 등록된다. 등록 위치가 셋으로 갈려도 사용자에게는 "패널이 열려 있을 때 쓰는 명령" 하나의 규칙으로 보이게 한다 (키보드도 그 패널 scope 에서만 받는다).

**포커스 scope 는 활성 판정에 쓰지 않는다.** 키보드의 scope 는 "이 키가 어느 리스너로 가는가" 를 가르는 규칙이고, 메뉴는 사용자가 명령을 직접 고른 것이다. 헤더 버튼을 누르면 포커스가 캔버스를 떠나 scope 가 캔버스 명령 27 개 (`canvas-focused`) 와 어긋난다 — 팔레트는 이것을 `isTransientScope` / `scopeAtOpen` (`CommandPalette.tsx:130-190`) 으로 우회했다. 4 의 `panel:*` 는 포커스 경로가 아니라 정의에 적힌 소속으로만 읽는다.

P0 표는 포함 49 명령마다 활성 조건 출처 (2 · 3 · 4 · 없음) 와 scope 분기 여부 (§4-5) 를 열로 둔다. "없음" 인 명령은 각각 "쓸 수 없는 상태가 없다" 는 사유를 적는다.

### 4-3. 지연 로딩

`COMMAND_META` 는 초기 번들 상주를 피하려 동적 import 로만 쓴다 (`services/ai/tools/definitions.ts:546-548`, ADR-196 HC6). 메뉴 내용 (`HeaderMainMenu` — 구조 표 · 상태 판정 · `COMMAND_META` · `componentSemanticsActions`) 은 별도 chunk 로 두고, `BuilderHeader` 는 트리거와 빈 Popover 만 가진다. 트리거 `onHoverStart` · `onFocus` 에서 미리 import, 누를 때 아직 없으면 Suspense fallback 한 프레임 (메모리 `feedback-suspense-fallback-throttle-masks-lazy-panel-latency` — fallback throttle 을 확인할 것).

**실행 결과 (2026-09-29, G2)**: lazy chunk 가 initial 모듈을 직접 import 하면 Rolldown 이 그 모듈이 든 initial 공유 청크를 쪼갠다 — 청크가 잘게 나뉘어 raw +353 B 가 gzip +2,680 B 가 됐다. 그래서 initial 쪽 `headerMenu/headerMenuRuntime.ts` 가 메뉴가 부르는 initial 모듈 (i18n · uiStore · panelLabels · `panelIdForScope` · `componentSemanticsActions` · `formatShortcut` · commandRegistry · SearchField · `matchesCommandSearch` · 아이콘 · 선 굵기) 을 한 번 import 해 `HeaderMenuHost.runtime` 으로 넘기고, lazy 쪽 (`HeaderMainMenu` · `menuModel` · `resolveMenuItemState` · `headerMenuActions`) 은 타입만 본다. 읽기 모델은 agent executor 경유 (`executeAgentCommand` 재수출 — executor 청크가 이미 싣는 묶음이라 canvasActions 청크가 쪼개지지 않는다). 본문 CSS 는 `HeaderMainMenu.css` (lazy chunk 의 CSS). 번역 카탈로그가 initial 이라 분류 라벨은 기존 어휘를 재사용하고 새 키는 5 개. 새 lazy 소비가 initial 모듈을 부르려면 runtime 에 더하고 G2 를 다시 잰다.

### 4-4. 검색

RAC `Autocomplete` (`react-aria-components/Autocomplete`, 1.21.0 export 확인) 를 루트 메뉴 위에 둔다. 검색어가 비면 계층 메뉴, 있으면 모든 잎 항목을 "레이아웃 › 정렬 › 왼쪽 정렬" 경로 라벨과 함께 평면 `Menu` 로 보인다 (`SubmenuTrigger` 안쪽은 Autocomplete 필터가 들어가지 않으므로 평면화가 필요). 필터 기준은 팔레트와 같게 라벨 · id · 분류 · 단축키.

### 4-5. 실행 대상 — 캔버스 scope 를 인자로 넘긴다

`copy` · `paste` · `delete` (+ 메뉴 제외인 `deleteAlt`) 핸들러는 `getScopedHandler` (`useGlobalKeyboardShortcuts.ts:496-506`) 로 감싸여 실행 시점의 `activeScope` 가 `panel:events` 면 Events 핸들러 (`:438-458`, 지금 `console.log` placeholder) 를 부른다. 메뉴가 열린 동안 포커스는 popover (`[role=menu]`) 안이라 `useActiveScope` 가 선언 scope · 캔버스 · 포커스 패널을 모두 빗나가고 6 단계 (보이는 패널 중 scope 있는 첫 패널, 오른쪽 우선 — `useActiveScope.ts:275-294`) 로 내려간다. Properties · Styles 를 닫고 인터랙션 패널만 열면 `panel:events` 다.

재현 (코드 경로 기준, live 미실행): Properties · Styles 닫음 · 인터랙션 열림 → 요소 선택 → 메뉴 ▸ 편집 ▸ 복사 → Events placeholder 실행 → 붙여넣기해도 요소 수 불변.

설계: `CommandEntry.handler` 를 `(ctx?: { scope?: ShortcutScope }) => void` 로 넓힌다 (0 인자 핸들러는 그대로 대입 가능). 메뉴는 `handler({ scope: "canvas-focused" })` 로 부르고, `getScopedHandler` 는 `ctx?.scope ?? activeScope` 로 분기한다. 키보드 경로는 인자를 넘기지 않아 지금과 같다 — keydown listener 는 `shortcut.handler()` 를 인자 없이 부른다 (`useKeyboardShortcutsRegistry.ts:364`). `KeyboardShortcut.handler` 타입도 같은 모양으로 넓힌다.

기각: popover 에 `data-shortcut-scope="canvas-focused"` 선언 (`useActiveScope.ts:119-126` 선언 scope 는 패널 추론보다 먼저 본다). 코드는 한 줄이지만 메뉴가 열린 동안 scope 가 `canvas-focused` 가 되어 화살표 8 · Delete · Escape 같은 캔버스 단축키가 메뉴 키보드 탐색과 같은 키를 받을 수 있다. `useKeyboardShortcutsRegistry.ts` 에는 `[data-shortcut-local]` (`:191`) 외에 메뉴를 거르는 조건이 없고, RAC Menu 의 키 이벤트 전파 차단에 기대는 것은 D1 내부 동작 가정이다.

## 5. Phase

| Phase | 내용                                                                                                                                                                                                                                                                                                                                                                                           | 완료 조건                           |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| P0    | §2 인벤토리를 테스트로 고정 — 71 정의 전부 "포함 위치 또는 제외 사유" 로 분류, 포함 49 의 활성 조건 출처 · scope 분기 여부, `railOrder` 세 방향 패널 전부 메뉴에 등장                                                                                                                                                                                                                          | 분류 누락 0 · 정적 테스트 RED→GREEN |
| P1    | 구조 표 + 상태 판정 순수 함수 + 단위 테스트 (등록 없음 · precondition 실패 · `canRun` false · 소속 패널 닫힘 → 비활성, 패널 bottom 이동 → 아래 구역). `CommandEntry` 선택 필드 · 실행 인자, `getScopedHandler` 인자 우선 (unit: `panel:events` 상태에서 인자 `canvas-focused` → 캔버스 핸들러), `zoomToSelection` `canRun` (등록 hook 경유 전달), `panelIdForScope`, `copyStyles` precondition | unit GREEN · 인자 제거 원복 RED     |
| P2    | `HeaderMainMenu` lazy chunk · `SubmenuTrigger` · 체크 · 문맥 라벨 · 헤더 전용 액션 이관                                                                                                                                                                                                                                                                                                        | type-check · 번들 게이트            |
| P3    | `Autocomplete` 검색 · 평면 경로 라벨                                                                                                                                                                                                                                                                                                                                                           | unit + live                         |
| P4    | live exercise · `BuilderHeader.static.test.ts` 갱신 (`not.toContain("<MenuSection")` 단언 교체) · CHANGELOG · README                                                                                                                                                                                                                                                                           | G1~G3 PASS                          |

## 6. 파일 경계

| 파일 | 변경 |
| --- | --- |
| `builder/main/BuilderHeader.tsx` | 메뉴 본문 제거 → 트리거 + lazy `HeaderMainMenu` · `HeaderMenuHost` (헤더 콜백 + runtime) · workflow prop 제거 |
| `builder/main/BuilderCore.tsx` | `onWorkflowOverlayToggle` 전달 제거 (명령 `toggleWorkflowOverlay` 와 같은 store 동작) |
| `builder/main/headerMenu/builderMenuStructure.ts` (신규) | 구조 표 · 제외 표 22 · P0 활성 조건 표 49 |
| `builder/main/headerMenu/resolveMenuItemState.ts` (신규) | 활성 판정 · 소속 패널 · 작업 공간 구역 파생 · 체크 명령 |
| `builder/main/headerMenu/menuModel.ts` (신규) | 구조 표 → 블록 모델 · 검색 평면화 |
| `builder/main/headerMenu/HeaderMainMenu.tsx` · `.css` (신규, lazy) | RAC Menu · MenuSection · SubmenuTrigger · Autocomplete |
| `builder/main/headerMenu/headerMenuActions.ts` (신규) | 헤더 전용 액션 타입 · 실행 |
| `builder/main/headerMenu/headerMenuRuntime.ts` (신규, initial) | lazy chunk 가 부르는 initial 모듈 묶음 (§4-3 실행 결과) |
| `builder/main/BuilderHeader.static.test.ts` | 단언 갱신 |
| `builder/styles/layout/header.css` | popover 세로 배치 · 메뉴 스크롤 (본문 스타일은 `HeaderMainMenu.css`) |
| `i18n/translations.ts` · `types.ts` · `i18nWiring.static.test.ts` | `headerMenu` 5 키 · 배선 단언 |
| `stores/commandRegistry.ts` | `CommandEntry.canRun?` · `CommandHandler` 실행 인자 |
| `hooks/useKeyboardShortcutsRegistry.ts` | `KeyboardShortcut.canRun?` · `bindHandlersToDefinitions` 세 번째 인자 · 게시 전달 |
| `hooks/useActiveScope.ts` | `panelIdForScope` export |
| `hooks/useGlobalKeyboardShortcuts.ts` | `createScopedHandler` (인자 우선) |
| `workspace/canvas/BuilderCanvas.tsx` | `hasZoomToSelectionTarget` · `canRun` 등록 |
| `config/commandMeta.ts` | `copyStyles` · `pasteStyles` precondition (`selectedElementId`) |
| `components/overlay/commandSearch.ts` (신규) · `CommandPalette.tsx` | 팔레트 · 메뉴 공용 검색 필터 (R7) |
| `panels/history/userSnapshotActions.ts` (신규) · `HistoryPanel.tsx` | 스냅샷 만들기 공용 함수 |
| `services/agent/agentReadModel.ts` (신규) · `executeAgentCommand.ts` | 읽기 모델 조립 분리 (재수출 유지) |

읽기만: `config/keyboardShortcuts.ts` · `config/componentSemanticsActions.ts` · `panels/core/panelConfigs.ts` · `layout/PanelToggleGroup.tsx` · `stores/uiStore.ts` · `stores/canvasSettings.ts`.

## 7. 사용자 결정

1. **작업 공간 구역** (2026-09-29 사용자 제안으로 확정): Framer 루트 맨 위 영역 전환 목록 자리에 레일 패널 10 개 (왼쪽 · 오른쪽 구역, `RAC MenuSection` + `Header`) · 워크플로 오버레이 · 설정을 둔다. 패널 토글이 이미 ⌥1~⌥8 이라 Framer 의 ⌥숫자 어법과 겹친다. 차이: Framer 는 하나를 고르는 목록이고 여기는 여러 개를 켜고 끄는 체크 목록이다. 결과로 보기 ▸ 패널 하위 메뉴와 환경설정 하위 메뉴는 없어지고 객체에 스냅은 보기로 간다.
2. **스냅샷 만들기** (2026-09-29 사용자 지적으로 확정): 기능은 있고 단축키 정의만 없다 — 파일 ▸ 스냅샷 만들기 를 헤더 액션으로 포함 (§2-4).
3. **Tool · Rename · Lock · Hide · Select parent/children** (2026-09-29 사용자 "뒤에 추가하면 되지 않나"): 제외가 아니라 후속 추가. 구조 표가 명령 id 를 한 줄씩 가리키는 형태라 해당 명령 · 데이터 모델이 생기는 ADR 에서 한 줄로 들어온다. 이 ADR 은 그 자리를 막지 않는 것만 보장한다.
4. **도움말 ▸ 튜토리얼 · 버전** (2026-09-29 사용자 지시 "help 를 넣어라 … 메뉴만 생성해둬"): 구조 표에 자리 항목 (`{ placeholder: true }`) 으로 두고 비활성으로 표시한다. G0 정적 게이트는 "활성 항목은 실행 경로가 있다 · 실행 경로 없는 항목은 자리 항목이다" 둘 중 하나를 요구해 클릭 가능한 빈 항목을 막는다.

5. **작업 공간 구역 표기** (2026-09-29 실행 중 사용자 지시): 방향 머리글 (왼쪽 · 오른쪽) 을 없애고, 패널 항목에 레일 버튼과 같은 아이콘을 넣는다.
8. **켜짐 표시** (2026-09-29 사용자 지시 — 왼쪽 체크 열이 여백을 키움): 왼쪽 체크 열을 없앤다. 열린 패널은 아이콘 칸 (20px) 을 accent 로 채워 레일의 선택 버튼처럼 보이고, 아이콘 없는 켜고 끄는 항목 (Workflow · 눈금자 · 포커스 모드 · 스냅 · 모양) 은 오른쪽 체크 (우클릭 메뉴와 같은 자리). role · `aria-checked` 는 그대로 RAC 가 붙인다.
7. **레일 버튼 축소** (2026-09-29 사용자 지시): 왼쪽 레일의 테마 · 오른쪽 레일의 작업 내역 버튼을 뺀다 (`hiddenFromRail`). 두 패널은 전체 메뉴 작업 공간 구역 · ⌥4/⌥8 로 연다 — 메뉴 노출은 `PanelConfig.hiddenFromMenu` (설정 · 필드만) 로 따로 판정해 레일에서 빠져도 메뉴에는 남는다.
6. **도움 구역 · 대시보드 라벨** (2026-09-29 실행 중 사용자 지시): 명령 팔레트 열기 · 설정 열기 · 도움말 ▸ 을 루트 맨 아래 한 구역으로 모은다. "프로젝트 열기" 라벨은 "대시보드" 로 — 명령 라벨 (`command.openProject`, ADR-200) 을 바꿔 팔레트도 같이 바뀐다. 설정은 이 구역에서 체크를 두지 않는다 (RAC selectionMode 는 구역 단위라 체크 항목과 일반 항목을 한 구역에 섞을 수 없다). 이어서 명령 라벨 "Workflow 오버레이 토글" → "Workflow" · "명령 팔레트 열기" → "명령 팔레트" · "설정 열기" → "설정" (en: Workflow · Command Palette · Settings), Workflow 와 대시보드 사이 구분선 제거 — 두 항목은 체크 여부가 달라 RAC 구역은 둘이지만 구분선은 구조 표의 `separator` 에서만 그린다 (`MenuBlock.separated`).

## 8. Gate 측정 방법

- **G0 (P0)**: `builderMenuStructure.static.test.ts` — 71 id 가 구조 표 또는 제외 표에 정확히 한 번, 포함 49 명령마다 활성 조건 출처 · scope 분기 여부가 있고 `getScopedHandler` 로 감싼 id 목록과 분기 열이 일치, `PanelRegistry` 레일 패널과 `railOrder` 세 방향 합집합이 전부 패널 묶음에 나온다.
- **G1 (P2)**: headed Playwright (Chrome MCP 는 hidden 탭 RAF 정지 — 메모리 `reference-chrome-mcp-hidden-tab-raf-pause-stale-overlay`). 선택 없음 / 단일 / 다중 3 상태에서 메뉴 열기 → 항목 활성 상태를 `COMMAND_META` precondition 기대값과 대조. 헤더 버튼을 마우스로 눌러 연 경우 캔버스 명령이 활성인지 (scope 함정). Properties · Styles 를 닫고 인터랙션 패널만 연 상태에서 요소 선택 → 메뉴 복사 → 메뉴 붙여넣기 → 캔버스 요소 수 +1 (원복: 실행 인자 제거 시 불변 = RED). 스타일 · 속성 패널을 닫은 상태에서 해당 항목 비활성, 열면 활성. 선택 없음에서 선택에 맞춤 · 스타일 복사 비활성.
- **G2 (P2)**: `adr201-bundle-gate.mjs` — Builder initial Δ ≤ 0 (메뉴 본문 lazy). 현행 상한은 ADR-235 재승인값.
- **G3 (P4)**: live — 명령 항목 5 (복사 · 정렬 왼쪽 · 컴포넌트 만들기 · 확대 · 눈금자) · 작업 공간 항목 5 (데이터 편집기 · 히스토리 · 레일 이동 후 구역 · bottom 저장 레이아웃에서 아래 구역 표시와 토글 · 설정) · 헤더 액션 3 (내보내기 · 모양 다크 · 프로젝트 삭제 취소) · 검색 2 ("정렬" → 경로 표시 · Enter 실행).

## 9. 실행 결과 (2026-09-29)

P0~P4 완료 · G0 7/7 (변이 RED 4) · G1/G3 live 23/23 (scope 인자 원복 RED) · G2 Builder initial JS gzip −50 B. 상세: [evidence/249-execution.md](../evidence/249-execution.md). 하니스 사정으로 G3 정렬은 왼쪽 대신 오른쪽 정렬 (flow 요소는 정렬이 no-op 이라 absolute 요소 폭 차이로 변화를 만든다 — 같은 3단 하위 메뉴 경로).
