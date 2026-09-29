# ADR-249: 빌더 전체 메뉴 개편 — 검색 · 계층 · 비활성 표시 (Framer 메뉴 어법)

## Status

Implemented — 2026-09-29 (Accepted 같은 날 — 리뷰 round 2 종결 · 사용자 `/execute-adr 249`). P0~P4 · G0~G3 PASS ([evidence](../evidence/249-execution.md), 로컬 전용), 사용자 커밋 지시

## Context

### 문제

빌더 왼쪽 위 전체 메뉴 (`apps/builder/src/builder/main/BuilderHeader.tsx` `<Menu className="header-menu">`) 는 1단 평면 목록 10 항목이고 프로젝트 관리 (열기 · 가져오기 · 내보내기 · 폴더 연결 · 삭제) 와 설정 몇 개만 담는다. 편집 명령은 네 곳에 흩어져 있다.

| 표면               | 담는 것                                                            | 근거                                                                                                                       |
| ------------------ | ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| 커맨드 팔레트 (⌘/) | `SHORTCUT_DEFINITIONS` 71 정의 중 `palette !== false` 전부, 6 분류 | `components/overlay/CommandPalette.tsx:255-280` (ADR-195)                                                                  |
| 우클릭 메뉴        | 선택 문맥 명령 — 쓸 수 없으면 **숨김**                             | `workspace/canvas/contextMenu/canvasContextMenuProviders.ts:95-100` (ADR-182)                                              |
| 패널 레일          | 패널 토글 10 (left 5 · right 5)                                    | `layout/PanelWorkspace.tsx:1471-1483` · `layout/PanelToggleGroup.tsx`                                                      |
| 패널 헤더          | 스타일/속성 복사·붙여넣기 · 포커스 모드 · 스냅샷 등                | `panels/styles/StylesPanel.tsx:260` · `panels/properties/PropertiesPanel.tsx:1053` · `panels/history/HistoryPanel.tsx:342` |

사용자는 "빌더가 무엇을 할 수 있는가" 를 한 곳에서 훑어볼 수 없다. 2026-09-29 Framer 전체 메뉴를 3단까지 실측한 결과 (이번 세션), Framer 는 한 버튼 아래 검색 · 이동 · 분류 하위 메뉴 · 모든 항목의 단축키 · 비활성 표시 · 체크 표시 · 문맥 라벨을 둔다. 패널 토글도 View 아래 (Show pages/layers/assets/agent/style) 에 있다.

이 과정에서 메뉴 항목과 동작 분기가 짝이 맞지 않는 결함이 이미 한 번 나왔다 (`96ab2cee1` — 삭제 · 도움말 · 정보 3 항목이 동작 없음). 수작업 목록은 원본과 어긋난다.

### SSOT domain

- **D1**: 메뉴 DOM · ARIA · 키보드는 설치된 `react-aria-components` 1.21.0 의 `Menu` · `SubmenuTrigger` · `MenuSection` · `Autocomplete` 를 그대로 쓴다 (`dist/types/exports/Menu.d.ts` · `Autocomplete.d.ts` export 확인). `Menubar` primitive 는 없다.
- **D2 · D3**: 해당 없음 — 빌더 chrome 이며 catalog 컴포넌트 · 시각 SSOT 대상이 아니다.

### 선행 결정과의 관계

응용 ADR 이다. base 는 전부 Implemented 이며 이 ADR 은 읽기만 한다 — 명령 정의 (`config/keyboardShortcuts.ts`), 실행 레지스트리 (ADR-195 `stores/commandRegistry.ts`), 정적 metadata · precondition (ADR-196 `config/commandMeta.ts`), 라벨 (ADR-200 `command.${id}`), 패널 레지스트리 (`panels/core/panelConfigs.ts`). 의존 방향 반전 없음. 전제 lock-in 은 breakdown §1.

### Hard constraints

- **초기 번들**: Builder initial 상한 (ADR-201 → ADR-235 재승인, 만료 2026-10-17) 을 넘기지 않는다. `COMMAND_META` 는 초기 번들 3KB+ 상주를 피하려 동적 import 로만 쓴다 (`services/ai/tools/definitions.ts:546-548`, ADR-196 HC6). 메뉴는 이 결정을 깨면 안 된다.
- **새 명령 없음**: 메뉴는 이미 있는 명령 · 패널 · 헤더 동작만 보인다. 없는 명령 (도구 · 요소 잠금/숨김/이름 변경 · 부모 선택) 은 만들지 않는다.
- **정의 타입 불변**: `ShortcutDefinition.key` 는 필수 (`types/keyboard.ts:45`) — 키 없는 헤더 동작 때문에 타입을 바꾸지 않는다.
- **우클릭 메뉴 정책 불변**: 우클릭은 숨김 (ADR-182) 유지. 메뉴 막대 관례 (비활성) 는 전체 메뉴에만.

### Soft constraints

- 헤더 중앙 섬 시안 (`docs/design/header-contextual-island/`, 코드 미반영) 과 공간이 겹치지 않는다 — 전체 메뉴는 왼쪽 버튼 하나 아래에 머문다.
- Properties + Styles → "Design" 패널 병합이 ADR-248 뒤 예정 (사용자 결정 09-29). 패널 목록을 하드코딩하면 그때 어긋난다.

## Alternatives Considered

### 대안 A: 평면 메뉴 유지 + 팔레트 강화

- 설명: 헤더 메뉴는 그대로 두고 커맨드 팔레트에 분류 구역 · 최근 사용 · 빈 검색어 목록을 더한다. 발견 경로를 팔레트 하나로 모은다.
- 근거: VS Code · Linear 는 명령 팔레트가 주 발견 경로다.
- 위험: 기술(LOW) / 성능(LOW) / 유지보수(LOW) / 마이그레이션(LOW)
- 한계: 팔레트는 검색어를 알아야 쓰는 도구다. "훑어보기" (계층 · 체크 상태 · 비활성 이유) 목표를 채우지 못한다. 패널 레일 · 헤더 전용 동작은 여전히 따로 산다.

### 대안 B: 수작업 JSX 계층 메뉴

- 설명: `BuilderHeader.tsx` 안에 File/Edit/View… 하위 메뉴를 JSX 로 직접 쓰고 각 항목에 라벨 · 단축키 · 활성 조건 · 실행을 적는다.
- 근거: 현행 헤더 메뉴 방식의 확장. Penpot 메인 메뉴가 이 방식에 가깝다 (공개 UI 관찰, 실측 아님).
- 위험: 기술(LOW) / 성능(MEDIUM — `COMMAND_META` 를 쓰려면 정적 import) / 유지보수(**HIGH**) / 마이그레이션(LOW)
- 유지보수 HIGH 근거: 같은 명령의 라벨 · 단축키 · 활성 조건이 네 번째 사본이 된다 — 팔레트 (`CommandPalette.tsx:255-280`), 우클릭 (`canvasContextMenuProviders.ts`), 레일 (`PanelToggleGroup.tsx`), 그리고 메뉴. `96ab2cee1` 이 바로 이 방식의 항목 · 분기 불일치였다.

### 대안 C: 선언적 구조 표 + 기존 원본 재사용

- 설명: 메뉴에는 **순서 · 구역 · 하위 메뉴만** 적는 구조 표를 둔다. 항목은 명령 id · 레일 패널 묶음 · 헤더 전용 액션 셋 중 하나를 가리킨다. 라벨은 ADR-200 키, 단축키는 `formatShortcut`, 실행은 `resolveCommand` (ADR-195), 활성은 "등록 여부 + `COMMAND_META.precondition`" (ADR-196), 패널 목록 · 체크는 `PanelRegistry` · workspace visibility, 문맥 라벨은 `componentSemanticsActions` 에서 읽는다. 메뉴 본문은 lazy chunk. 검색은 RAC `Autocomplete`.
- 근거: Framer 실측 (09-29) — 한 버튼 아래 검색 + 분류 + 비활성 + 체크 + 문맥 라벨. Figma 메인 메뉴도 검색 + 계층 구조다 (공개 UI 관찰, 실측 아님).
- 위험: 기술(MEDIUM) / 성능(MEDIUM) / 유지보수(LOW) / 마이그레이션(LOW)
  - 기술 MEDIUM: 활성 판정을 precondition 에 기대는데 precondition 없는 명령이 있다 (`zoomToSelection` 등 `view(false)` — `config/commandMeta.ts:200`). 등록만으로 활성으로 보일 수 있다. 헤더 클릭 때 포커스가 캔버스를 떠나 scope 가 어긋나는 함정 (`CommandPalette.tsx:130-145` 주석이 실측 기록) 을 scope 미사용으로 피하지만, scope 를 가정한 handler 가 있으면 메뉴에서 틀리게 돈다.
  - 성능 MEDIUM: `COMMAND_META` · `componentSemanticsActions` · `canOperate` 가 헤더 chunk 로 새면 초기 번들이 는다.

### 대안 D: 가로 메뉴 막대 (File Edit View … 헤더에 나열)

- 설명: macOS · Figma 데스크톱처럼 헤더 왼쪽에 분류를 가로로 늘어놓는다.
- 위험: 기술(**HIGH**) / 성능(LOW) / 유지보수(MEDIUM) / 마이그레이션(LOW)
- 기술 HIGH 근거: RAC 1.21.0 에 `Menubar` 가 없다 (패키지 export 목록). 메뉴 막대 ARIA (`role=menubar` · 좌우 화살표 이동 · 열린 메뉴 사이 hover 전환) 를 손으로 써야 하므로 D1 위반 (`ssot-hierarchy.md` §1 "aria 속성 수동 작성 금지"). 헤더 가로 공간을 중앙 섬 · 오른쪽 그룹과 다툰다.

### Risk Threshold Check

| 대안 | HIGH+           | 판정                                         |
| ---- | --------------- | -------------------------------------------- |
| A    | 없음            | 목표 (훑어보기) 미달로 기각 — 위험 문제 아님 |
| B    | 유지보수 HIGH   | 원본 사본이 넷이 됨 → C 가 회피안            |
| C    | 없음 (MEDIUM 2) | 채택 후보                                    |
| D    | 기술 HIGH (D1)  | RAC primitive 없음 → 기각                    |

루프 불필요 — C 가 HIGH 없이 목표를 채운다.

## Decision

**대안 C** 를 채택한다.

- 메뉴 구조: 검색 → 작업 공간 (패널 · 워크플로 · 설정) → 이동 (대시보드 · 명령 팔레트) → 파일 · 편집 · 보기 · 레이아웃 · 컴포넌트. 초안과 71 정의 분류 (포함 49 · 제외 22) 는 breakdown §2-1 · §3.
- **패널 버튼 포함** (사용자 요청 2026-09-29): left · right 레일의 패널 10 개 전부를 **루트 맨 위 작업 공간 구역** (Framer 의 영역 전환 목록 자리) 에 현재 `railOrder` 위치별 (왼쪽 · 오른쪽 · 아래) 로 두고, 워크플로 오버레이 · 설정도 같은 구역에 둔다 (사용자 제안 2026-09-29). 패널 토글이 이미 ⌥1~⌥8 이라 Framer 의 ⌥숫자 어법과 겹친다 — 다만 하나를 고르는 목록이 아니라 여러 개를 켜고 끄는 체크 목록이다. 목록은 `PanelRegistry` 에서 레일과 같은 규칙 (`hiddenFromRail`) 으로 파생한다 — `datatableEditor` 는 레일에 있으나 `shortcutId` 가 없어 명령 정의만으로 만들면 빠진다. 저장 모델은 `railOrder.bottom` 도 허용하지만 (`PanelWorkspace.tsx:85-92` `railSideForPanel`) 레일은 left · right 만 렌더해 (`:1471-1483`) 거기 놓인 패널은 레일 버튼이 없다 — 메뉴의 아래 구역은 비어 있지 않을 때만 보이며 그 패널을 여는 경로가 된다. 패널 헤더 버튼 중 문서 · 선택 · 작업 공간에 작용하는 것 (스타일/속성 복사·붙여넣기 · 포커스 모드) 은 포함, 패널 내부 상태만 바꾸는 것은 제외 (breakdown §2-3).
- **활성 = 등록 + precondition + 등록자 실행 조건 + 소속 패널 열림**. 포커스 scope 는 활성 판정에 쓰지 않는다 — 메뉴는 사용자가 명령을 직접 고른 것이라 "이 키가 어느 리스너로 가나" 를 가르는 규칙이 필요 없고, 헤더 클릭 때의 scope 어긋남 (팔레트가 `scopeAtOpen` 으로 우회한 것) 이 구조적으로 사라진다. 나머지 두 조건은 1차 리뷰 (2026-09-29, `reviews/249.md`) 로 더했다.
  - **등록자 실행 조건**: store 만으로 알 수 없는 조건은 핸들러를 등록한 쪽이 판정 함수를 같이 등록한다 (`CommandEntry` 선택 필드). `zoomToSelection` 은 선택 bounds 가 캔버스 클로저 (`BuilderCanvas.tsx:1378-1379`) 에만 있어 `COMMAND_META` precondition 으로 옮길 수 없다 (`commandMeta.ts:200`). 판정 함수와 핸들러의 early return 은 같은 함수를 부른다.
  - **소속 패널 열림**: 정의 scope 가 `panel:*` 인 명령 (스타일/속성 복사·붙여넣기 · 포커스 모드) 은 그 패널이 workspace 에서 보일 때만 활성이다. 등록 여부로는 이를 알 수 없다 — `copyStyles` · `pasteStyles` 는 ADR-155 이후 상시 마운트 host (`BuilderCore.tsx:1645` → `CanvasSelectionShortcuts.tsx:302-305`) 가 등록해 패널을 닫아도 남는다. 여기서 scope 는 포커스 경로가 아니라 소속 패널을 가리키는 값으로만 읽는다.
- **실행 대상 = 캔버스 (문서 · 선택)**. `copy` · `paste` · `delete` 핸들러는 실행 시점의 `activeScope` 로 캔버스와 Events 분기를 고른다 (`useGlobalKeyboardShortcuts.ts:496-506` `getScopedHandler`, `:540-544`). 메뉴가 열려 있는 동안 포커스는 popover 안이라 scope 판정이 활성 패널 추론까지 내려가고 (`useActiveScope.ts:275-294`), Properties · Styles 를 닫고 인터랙션 패널만 열어 두면 `panel:events` 가 된다. 그 상태에서 메뉴의 복사를 누르면 Events placeholder (`useGlobalKeyboardShortcuts.ts:438-458`, `console.log` 만) 가 실행돼 선택 요소가 복사되지 않는다. 그래서 메뉴는 실행할 때 대상 scope (`canvas-focused`) 를 인자로 넘기고, scope 분기 핸들러는 인자가 있으면 `activeScope` 보다 그것을 따른다. popover 에 `data-shortcut-scope="canvas-focused"` 를 선언하는 방법은 기각한다 — 메뉴가 열린 동안 캔버스 scope 단축키 (화살표 8 · Delete 등) 가 메뉴 키보드 탐색과 같은 키를 받을 수 있다.
- **비활성은 숨기지 않는다** (메뉴 막대 관례). 우클릭 메뉴의 숨김 정책은 그대로.
- **본문 lazy**: `BuilderHeader` 는 트리거만 가진다. 메뉴 본문 · `COMMAND_META` 는 별도 chunk 로 hover/focus 때 미리 받는다.
- 헤더 전용 동작 (가져오기 · 내보내기 · 폴더 연결 · 스냅샷 만들기 · 프로젝트 삭제 · 레이아웃 초기화 · 모양 · 스냅) 은 `ShortcutDefinition` 을 바꾸지 않고 별도 타입으로 둔다.

**위험 수용 근거**: 기술 MEDIUM (precondition 공백 · handler 의 scope 가정) 은 포함 49 정의가 유한하고 전부 열거돼 있어 P0 에서 명령마다 활성 조건의 출처 (precondition · 등록자 실행 조건 · 소속 패널 · 조건 없음) 와 scope 분기 여부를 표로 고정하고, G1 에서 선택 상태 3 가지 · 패널 구성 2 가지로 전수 대조할 수 있다. `CommandEntry` 에 선택 필드 (실행 조건) 와 핸들러 실행 인자 (대상 scope) 가 생기지만 ADR-195 의 등록 · 해석 규칙 (priority → seq) 은 그대로이고 기존 등록은 수정 없이 통과한다. 성능 MEDIUM 은 lazy 경계 하나로 막히고 G2 가 기계적으로 잰다.

**기각 사유**: A — 검색어를 알아야 하는 도구 하나로는 훑어보기 목표를 못 채운다. B — 원본 사본이 넷이 되고, 이미 그 방식에서 결함이 나왔다. D — RAC 에 메뉴 막대가 없어 ARIA 를 손으로 써야 한다 (D1 위반).

**실행 중 결정 (2026-09-29)**:

- **루트 배치** (사용자 지시): 작업 공간 (패널 · 워크플로) → 대시보드 (종전 라벨 "프로젝트 열기", 명령 라벨째 변경) → 파일 · 편집 · 보기 · 레이아웃 · 컴포넌트 → 명령 팔레트 열기 · 설정 열기 · 도움말 ▸. 설정은 체크 없는 항목이다. 명령 라벨은 Workflow · 대시보드 · 명령 팔레트 · 설정으로 줄였고 (팔레트와 공유), Workflow 와 대시보드는 구분선 없이 잇는다. 레일에서 테마 · 작업 내역 버튼을 뺐다 (메뉴 · 단축키로 연다) — 메뉴 노출은 `hiddenFromMenu` 로 레일 노출 (`hiddenFromRail`) 과 따로 판정한다.
- **작업 공간 구역**: 방향 머리글 (왼쪽 · 오른쪽 · 하단) 을 두지 않고 구분선으로만 나눈다. 패널 항목은 레일 버튼과 같은 아이콘 (`PanelConfig.icon`) 을 보인다 — 사용자 지시 ("left, right 텍스트 표기 제거 · dock bar 메뉴 항목과 동일하게 아이콘"). 아이콘 열은 우클릭 메뉴와 같이 메뉴 층 단위로 예약한다.
- **lazy 경계**: 메뉴 chunk 가 initial 모듈을 직접 import 하면 Rolldown 이 initial 공유 청크를 쪼개 gzip 이 는다 (첫 측정 +2,680 B, raw +353 B). initial 쪽 `headerMenuRuntime.ts` 가 그 모듈 (i18n · uiStore · panelLabels · `panelIdForScope` · `componentSemanticsActions` · `formatShortcut` · commandRegistry · SearchField · 검색 필터 · 아이콘) 을 한 번 import 해 `HeaderMenuHost.runtime` 으로 넘기고 lazy 쪽은 타입만 본다. 분류 라벨은 기존 어휘를 재사용하고 새 번역 키는 5 개 (파일 · 보기 · 도움말 · 튜토리얼 · 버전) — 번역 카탈로그가 initial 이다. G2 −50 B.
- **체크 항목**: RAC `MenuSection selectionMode` 로 표현한다 (켜고 끄는 항목만 모인 구역 = multiple, 모양 = single). role (`menuitemcheckbox` · `menuitemradio`) 과 `aria-checked` 는 RAC 가 붙인다 (D1).

**후속 추가** (breakdown §2-5 #11~~13, 사용자 2026-09-29 "뒤에 추가하면 되지 않나"): Tool 메뉴 · 요소 이름 변경/잠금/숨김 · 부모/자식 선택은 명령 · 데이터 모델이 아직 없어 이 ADR 에서 만들지 않고, 그것들이 생기는 ADR 에서 구조 표에 한 줄씩 추가한다. 스냅샷 만들기는 기능이 있어 이번에 포함한다 (단축키 정의만 없음). **도움말 ▸ 튜토리얼 · 버전** 은 사용자 지시 (2026-09-29 "메뉴만 생성") 로 자리만 두고 **비활성** 표시한다 — 연결 대상이 없는 항목을 클릭 가능하게 두면 `96ab2cee1` 결함 (눌러도 동작 없음) 이 재발한다.

> 구현 상세: [249-builder-main-menu-breakdown.md](../design/249-builder-main-menu-breakdown.md)

## Risks

| ID  | 위험                                                                                                                                                  | 심각도 | 대응                                                                                                                                                                                                 |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | :----: | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | 실행 조건이 없는 명령이 쓸 수 없는데 활성으로 보임 (`zoomToSelection` `commandMeta.ts:200` · `copyStyles` `:286` 은 선택 없으면 핸들러가 바로 return) |  MED   | P0 에서 포함 49 명령마다 활성 조건 출처를 표로 고정. store 로 알 수 있으면 precondition 추가, 캔버스 클로저에만 있으면 등록자 실행 조건 (핸들러 early return 과 같은 함수). G1 선택 3 상태 전수 대조 |
| R2  | scope 분기 핸들러가 메뉴 실행에서 Events 쪽으로 감 (`useGlobalKeyboardShortcuts.ts:496-506`) — 1차 리뷰 HIGH                                          |  MED   | 메뉴 실행은 대상 scope `canvas-focused` 를 인자로 넘기고 분기 핸들러는 인자 우선. P0 표에 분기 여부 열. G1 불리 케이스 (인터랙션 패널만 열림) 에서 복사 → 붙여넣기 결과로 확인                       |
| R3  | 메뉴 본문이 초기 chunk 로 새어 번들 증가 · ADR-196 HC6 파기                                                                                           |  MED   | lazy 경계 · G2 번들 게이트 Δ ≤ 0                                                                                                                                                                     |
| R4  | 패널 소속 명령이 패널을 닫아도 활성으로 보임 (`copyStyles` · `pasteStyles` 상시 host 등록 `CanvasSelectionShortcuts.tsx:302-305`) — 1차 리뷰 HIGH     |  MED   | 정의 scope `panel:*` → 소속 패널 visibility 조건. 패널 id 는 `useActiveScope.ts` `PANEL_SCOPE_MAP` 의 역으로 파생 (손으로 적지 않음). G1 패널 닫힘 케이스                                            |
| R5  | 패널 병합 (Design 패널, 예정) 뒤 메뉴 어긋남                                                                                                          |  LOW   | 패널은 `PanelRegistry` 파생, 명령은 id 참조라 삭제 시 type error. 소속 패널 역매핑도 `PANEL_SCOPE_MAP` 하나라 병합 때 같이 바뀐다                                                                    |
| R6  | `railOrder.bottom` 패널이 메뉴 구역에서 빠짐                                                                                                          |  LOW   | 구역을 `railOrder` 세 방향에서 파생 · 아래 구역은 비어 있지 않을 때만. G0 정적 (세 방향 합집합 = 메뉴 패널) · G3 이동 시나리오                                                                       |
| R7  | 팔레트와 메뉴 검색의 필터 기준이 갈림                                                                                                                 |  LOW   | 같은 필드 (라벨 · id · 분류 · 단축키) 사용 — P3 unit                                                                                                                                                 |

잔존 HIGH 위험 없음 — 1차 리뷰 HIGH 2 (R2 · R4) 는 설계에 대응을 넣고 G1 불리 케이스로 확인한다.

## Gates

| Gate | 시점 | 통과 조건                                                                                                                                                                                                                                                   | 실패 시 대안                |
| ---- | ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| G0   | P0   | 71 정의가 구조 표 또는 제외 표에 정확히 한 번 · 포함 49 명령 전부 활성 조건 출처 · scope 분기 여부가 표에 있음 · `railOrder` 세 방향 패널 합집합 = 메뉴 패널 · 모든 항목이 실행 경로를 갖거나 자리 항목 (비활성) 이다 (정적 테스트)                         | 분류 누락 수리 후 재측정    |
| G1   | P2   | 선택 없음 / 단일 / 다중에서 항목 활성 = 기대값 · 헤더를 마우스로 연 경우 캔버스 명령 활성 · 인터랙션 패널만 열린 상태에서 메뉴 복사 → 붙여넣기로 요소 수 +1 · 스타일/속성 패널 닫힘 → 해당 항목 비활성 · 선택 없음 → 선택에 맞춤 비활성 (headed Playwright) | R1 · R2 · R4 대응 후 재측정 |
| G2   | P2   | `adr201-bundle-gate.mjs` Builder initial Δ ≤ 0                                                                                                                                                                                                              | lazy 경계 재조정            |
| G3   | P4   | live — 명령 5 · 작업 공간 5 · 헤더 동작 3 · 검색 2 시나리오 (breakdown §8)                                                                                                                                                                                  | 실패 항목 수리 후 재실행    |

측정 조건 (`measurement-validity.md` §1):

- **대상**: 실제 builder (5173 · headed Playwright · `visibilityState=visible` 기록). Chrome MCP 는 hidden 탭에서 캔버스 RAF 가 멈춰 쓰지 않는다 (09-29 재현).
- **불리 케이스**: G1 은 네 가지를 필수로 포함한다 — 헤더 버튼을 마우스로 눌러 연 경우 (포커스가 캔버스를 떠남) · Properties · Styles 를 닫고 인터랙션 패널만 연 경우 (scope 추론이 `panel:events` 로 감) · 스타일 · 속성 패널을 닫은 경우 (상시 host 등록이 남음) · 선택 없음 (bounds 없음).
- **대조군**: G1 기대값의 출처는 메뉴 자신이 아니라 `COMMAND_META` precondition 과 명령을 캔버스 포커스에서 키보드로 실행했을 때의 실제 결과다. 복사 케이스는 실행 인자를 빼면 (원복) 요소 수가 그대로여야 한다 (RED). G2 는 같은 빌드 설정의 변경 전 커밋이 대조 arm.
- **oracle 독립성**: G0 은 정의 표 (`SHORTCUT_DEFINITIONS`) · `PanelRegistry` · workspace `railOrder` 가 입력이고 메뉴 구조 표가 채점 대상이라, 채점자가 자기 표를 확인하는 순환이 아니다. G1 복사 케이스는 캔버스 요소 수 (store) 로 판정한다 — 메뉴 상태가 아니다.

### Live Exercise

2026-09-29 · headed Playwright (Chrome MCP 아님) · dev 5173 · `visibilityState=visible` · 하니스 `apps/builder/scripts/adr249-menu-live.mjs` **23/23 PASS** ([`249-g1-g3-live.json`](../evidence/249-g1-g3-live.json)). 메뉴는 전부 헤더 버튼 마우스 클릭으로 열었다.

- G1: 선택 없음 / 단일 / 다중 3 × 12 항목 활성 = 선택 수 기대값 · Properties · Styles 닫고 인터랙션만 연 상태에서 스타일/속성/포커스 모드 비활성 + 메뉴 복사 → 붙여넣기 요소 3 → 4 (scope 인자 원복 시 3 → 3, [`249-g1-scope-red.json`](../evidence/249-g1-scope-red.json)) · Styles 재오픈 → 스타일 복사 활성.
- G3: 명령 5 (복사 · 레이아웃 ▸ 정렬 ▸ 오른쪽 정렬 · 컴포넌트 만들기 + 문맥 라벨 · 확대 · 눈금자 체크) · 작업 공간 5 (데이터 편집기 · 히스토리 체크 · 왼쪽 레일 이동 · bottom 구역 · 설정) · 헤더 3 (내보내기 download · 모양 ▸ 어둡게 radio · 프로젝트 삭제 취소) · 검색 2 ("정렬" 경로 머리글 · "눈금자" Enter 실행) · 패널 아이콘 10 · 방향 머리글 0 · page error 0.
- G2: Builder initial JS gzip −50 B · Preview −3 B ([`249-g2-201-gate.json`](../evidence/249-g2-201-gate.json)).

## Consequences

### Positive

- 빌더의 명령 · 패널 · 프로젝트 동작을 한 버튼 아래에서 훑어볼 수 있다. 비활성 항목이 "지금 왜 못 쓰는가" 를 자리로 보여준다.
- 메뉴가 원본 (정의 · 레지스트리 · precondition · 패널 레지스트리) 을 읽으므로 항목 · 분기 불일치 (`96ab2cee1` 류) 가 구조적으로 생기지 않는다. 새 명령 · 새 패널은 구조 표 한 줄 또는 자동으로 들어온다.
- 레일에만 있던 `datatableEditor` 같은 단축키 없는 패널도 키보드 · 검색으로 열 수 있다.

### Negative

- `COMMAND_META.precondition` 의 소비자가 agent 하나에서 메뉴까지 둘로 는다. precondition 을 고칠 때 메뉴 활성도 같이 바뀐다 (의도된 결합이지만 ADR-196 수정 시 확인 대상이 된다).
- 헤더 메뉴 첫 열림에 lazy chunk 대기가 생길 수 있다 (hover 미리 받기로 완화).
- `BuilderHeader.static.test.ts` 의 `not.toContain("<MenuSection")` 단언을 바꿔야 한다.
- `CommandEntry` (ADR-195) 에 선택 필드 (등록자 실행 조건) 와 핸들러 실행 인자 (대상 scope) 가 생긴다. 키보드 경로는 인자를 넘기지 않아 동작이 같지만, scope 분기 핸들러 (`getScopedHandler`) 를 새로 만들 때 인자 우선 규칙을 따라야 한다.
- Framer 어법 중 Tool · 요소 잠금/숨김은 해당 기능이 생길 때까지 없고, 도움말은 자리만 있다 — 그동안 메뉴가 Framer 보다 짧다.
