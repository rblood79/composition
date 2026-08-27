# ADR-195 Breakdown: 명령 팔레트 실행 경로 — command registry 승격

> 2026-08-27 초안. ADR 본문: [195-command-palette-execution-registry.md](../195-command-palette-execution-registry.md).
> Phase 0 inventory 는 본 문서의 표를 갱신하는 commit 으로 freeze 한다 (M3 — 추정/실측 gap 은
> inventory 보강이지 fork 사유가 아님).

## 1. 전제 lock-in (fork 아님 — 완전 신규 주제)

- 본 ADR 은 기존 ADR 의 분리/fork 가 아니다. `rg -il "command ?palette|명령 팔레트|커맨드 팔레트" docs/adr` 실측 —
  팔레트 **실행 경로**를 다룬 결정 0건. 팔레트는 2025-12-29 "Phase 7" 구현으로 들어왔고 ADR 없이
  `executeCommand` 의 `default` 주석("키보드 이벤트로 시뮬레이션 — 향후 command registry 통합 시 개선")
  만 남겼다. 본 ADR 이 그 주석의 결정이다.
- 의존 방향: 2026-08-27 단축키 재배치 세션 (정의 SSOT `SHORTCUT_DEFINITIONS` · 표기 SSOT `formatShortcut` ·
  정적 게이트 4조항) 이 base. 본 ADR 은 **실행 축**에 같은 형태를 적용하는 응용이다. ADR-182(컨텍스트
  메뉴)/192(액션 바) 와는 직교 — 두 표면은 `canvasActions.ts` 액션 층을 직접 부르고 단축키 id 는 표기에만
  쓴다 (§2). 본 ADR 은 그 액션 층을 건드리지 않는다.
- SSOT 경계: 빌더 시스템 UI (builder-system layer). D1/D2/D3 3-domain 과 무관 — catalog/spec/Generator
  확장 없음 (ADR-163/192 와 같은 위상).

## 2. Current Baseline (2026-08-27 실측 — HEAD `8b6672189`)

| 항목                     | 실측                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 정의                     | `config/keyboardShortcuts.ts` `SHORTCUT_DEFINITIONS` **71개** (`ShortcutId = keyof typeof`, 리터럴 union). 카테고리: system 3 · navigation 7 · panels 13 · canvas 34 · properties 6 · nodes 8                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 핸들러 소재 (정의 경유)  | `bindHandlersToDefinitions` 호출 **7곳** — `hooks/useGlobalKeyboardShortcuts.ts:622-673` (42 id, `BuilderCore.tsx:377` 에서 마운트) · `panels/properties/CanvasSelectionShortcuts.tsx:269-300` (16 id, `BuilderCore.tsx:1155` host — ADR-155 Activity gating 중에도 등록 유지) · `workspace/canvas/BuilderCanvas.tsx:1032-1041` (zoomToSelection — frameAreas 컨텍스트 필요) · `panels/styles/StylesPanel.tsx:150-165` (toggleFocusMode·toggleSections — `collapsedSections` 로컬 state) · `panels/properties/PropertiesPanel.tsx:684` (copy/pasteProperties) · `components/overlay/CommandPalette.tsx:140-149` (commandPalette) · `main/BuilderHeader.tsx:101-108` (openProject). **등록 현황: unique 63 / 등록 65** — `treeNav*` 6·`treeSelect`·`treeSelectSpace` 8개는 어느 등록에도 없다 (RAC `TreeBase` 네이티브 키보드, `panels/nodes/tree/LayerTree/LayerTree.tsx:226` — D1). "Step C 미연결 11 → 0" 은 tree 8 을 뺀 집계였다 (2026-08-27 리뷰 정정) |
| 손수 선언 등록 (id 없음) | 5건 — `workspace/canvas/viewport/useViewportControl.ts:476-511` Space keydown/keyup (pan cursor) · `workspace/canvas/hooks/useCentralCanvasPointerHandlers.ts:145` Escape 드래그 취소 · `dashboard/index.tsx:431` ⌘K (다른 화면) · `CanvasSelectionShortcuts.tsx:255-268` ⌘C/⌘V `panel:properties` (canvas 쪽 `copy`/`paste` 와 동작이 달라 정의 공유 불가 — 2026-08-27 주석). 전부 **키보드 전용으로 남긴다**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 중복 id 등록             | **2건** — `escape` (global `handleEscape` / CanvasSelectionShortcuts `handleEscapeClearSelection`) · `detachInstance` (global `handleDetachInstance` `:238-263` / csel `handleDetachSelectedInstance` `:126-142`, 둘 다 `requestEditingSemanticsDetachConfirmation` 경유). 키보드는 리스너 2개가 각자 발화 (capture:document vs bubble:window, stopPropagation 없음) — `detachInstance` 는 확인 다이얼로그가 두 번 뜰 수 있는 기존 결함 (§7 후속). 나머지 61개는 1곳, tree 8 은 0곳                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| registry 내부            | `hooks/useKeyboardShortcutsRegistry.ts:293-352` — `useEffect` 안에서 `handleKeyEvent` 클로저가 `shortcuts` 배열을 잡고 `addEventListener`. **핸들러를 밖으로 노출하는 경로 없음**. `KeyboardShortcut` 에 `id` 필드 없음 (`:63-99`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| scope 판정               | `hooks/useActiveScope.ts` `determineScope` — modal(`[role=dialog][aria-modal]`) → text-editing → 선언 scope(`data-shortcut-scope`) → canvas → 포커스 패널 → 활성 패널(우측 우선) → global. `focusin`/DOM 변화로 갱신. **팔레트가 열리면 scope 는 `modal`** 이라 열린 뒤에는 원래 컨텍스트를 알 수 없다. 헤더 메뉴 popover 는 `modal` 이 **아니다** — RAC Popover 1.20 은 `role=dialog` 만 두고 `aria-modal` 없음 (`dist/private/Popover.mjs:118,180`; shared 래퍼 `packages/shared/src/components/Popover.tsx:93-98` 도 Dialog 미포함). 대신 메뉴 포커스가 canvas 판정을 global/활성 패널로 밀어낸다                                                                                                                                                                                                                                                                                                                                                        |
| 팔레트                   | `CommandPalette.tsx` — 목록 = 정의 71 전부 (`:109-116`). `executeCommand` switch **12 case** (`:168-216`): 패널 토글 11 + openProject. `default` 는 주석만. RAC `ModalOverlay` 가 닫힐 때 트리거로 포커스 복원                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 팔레트 실행 가능         | **12 / 71** (17%). 미실행 59 = 연속·포커스 전용 19 (escape·Tab·방향키 8·트리 8) + 실행돼야 하는 40 (undo/redo·줌 7·복사 3·z-order 4·복제·그룹 2·모두 선택·삭제 2·정렬 6·분배 2·속성/스타일 복사 4·포커스 모드·섹션 토글·눈금자·팔레트 자신)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 액션 층 공유             | `workspace/canvas/actions/canvasActions.ts` — `alignSelection`/`distributeSelection`/`groupSelection`/`ungroupSelection` 을 컨텍스트 메뉴 provider (`workspace/canvas/contextMenu/canvasContextMenuProviders.ts:196-208`) 와 CanvasSelectionShortcuts (`:206-211`) 가 **같이 부른다**. 중복은 액션이 아니라 **바인딩**(컨텍스트 조립 + 로컬 state) 이다                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 정적 게이트              | `config/shortcutDisplay.static.test.ts` 4조항 — glyph 격리 / 패널 정의→`shortcutId` / ⌥ 조합 `code` / **패널 정의→팔레트 case** (조항 4 는 본 ADR 로 switch 가 사라지면 재정의 대상)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 키보드 회귀 oracle       | 2026-08-27 재점검 스크립트 — 실물 macOS 형태(⌥ 문자 변환 포함) 26 조합 발화 26/26, 입력창 포커스 7 조합, 툴팁 16/16 (§6 에 재현 스니펫)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |

### Phase 0 재grep (착수 직전 필수)

```bash
rg -n "bindHandlersToDefinitions\(" apps/builder/src --glob '!*.test.*'                 # 등록 지점 수 (기대 7)
rg -n "useKeyboardShortcutsRegistry\(" apps/builder/src --glob '!*.test.*'              # 손수 선언 포함 전체 (기대 11)
rg -n "case \"" apps/builder/src/builder/components/overlay/CommandPalette.tsx | wc -l  # switch case 수 (기대 12)
rg -n "restoreFocus|shouldCloseOnInteractOutside" apps/builder/src/builder/components/overlay/CommandPalette.tsx
rg -n "treeNav|treeSelect" apps/builder/src --glob '!*.test.*' --glob '!**/config/keyboardShortcuts.ts'  # 기대 0건 (tree 8 은 registry 밖)
# 등록 리터럴 파서 주의: z-order 주석(`[` / `]`) 이 배열 종료로 오인되면 global 이 38 로 센다 — 배열은 `];` 까지 읽을 것
node -e "$(sed -n '/^\/\/ palette-count-begin/,/^\/\/ palette-count-end/p' docs/adr/design/195-command-palette-execution-registry-breakdown.md)"  # §6 스크립트
```

## 3. 시스템 설계

### 3-1. 데이터 흐름 (등록 1회 → 소비자 2)

```
컴포넌트/훅
  └ bindHandlersToDefinitions(ids, handlers)          ← id 를 KeyboardShortcut 에 실어 준다 (신규 필드)
      └ useKeyboardShortcutsRegistry(shortcuts, deps, opts)
           ├ (기존) addEventListener(keydown) → matchesScope/matchesShortcut → handler()   ← 무변경
           └ (신규) commandRegistry.register({id, handler, scope, priority, allowInInput, disabled})
                     effect cleanup 에서 unregister                                          ← 언마운트 = 실행 불가
CommandPalette
  ├ 열릴 때  scopeAtOpen = useActiveScope() 현재값   (모달이 DOM 에 들어가기 전이라 원래 컨텍스트)
  ├ 목록     SHORTCUT_DEFINITIONS 중 palette !== false, id !== "commandPalette"
  │          각 항목: entry = commandRegistry.resolve(id) · executable = entry && matchesScope(def.scope, scopeAtOpen) && !entry.disabled
  └ 실행     close → (RAC 포커스 복원 뒤) entry.handler()                                  ← 키 이벤트 합성 없음
```

- **키보드 경로는 한 줄도 바뀌지 않는다.** 등록 hook 이 effect 안에서 store 에 **추가로** 게시할 뿐이고,
  `handleKeyEvent` 는 종전 클로저 그대로다. 26/26 발화 oracle 이 회귀 판정이다.
- 핸들러는 **컴포넌트 클로저를 그대로 담는다** — StylesPanel 의 `collapsedSections`, BuilderCanvas 의
  `computeSelectionBoundsForHitTest` 를 store 로 끌어올리지 않는다. 그래서 컴포넌트가 언마운트되면
  (StylesPanel 은 선택 없으면 `EmptyState` 로 갈아끼움) 등록이 사라지고 팔레트에서도 실행 불가로 표시된다 —
  그것이 맞는 상태다.

### 3-2. `commandRegistry` (신규 — `apps/builder/src/builder/stores/commandRegistry.ts`)

- 형태: Zustand vanilla `createStore` 또는 module-level `Map` + `useSyncExternalStore`. **Zustand vanilla 로
  간다** — 팔레트가 구독해야 하고(등록/해제 시 목록 재계산), 구독자가 팔레트 하나뿐이라 root store 슬라이스에
  넣을 이유가 없다. `stores/` 에 vanilla `createStore` 선례는 없다 (`canvasSettings.ts:4` 는 `StateCreator`
  슬라이스) — 본 store 가 첫 사례.
- Entry: `{ id: ShortcutId; handler: () => void; scope: ShortcutScope | readonly ShortcutScope[] | undefined;
priority: number; allowInInput: boolean; disabled: boolean; seq: number }` — `seq` 는 단조 증가 등록 순번.
- 저장: `Map<ShortcutId, Entry[]>` — 같은 id 다중 등록 허용 (`escape`).
- API: `register(entry): () => void` (unregister 반환) · `resolve(id): Entry | undefined` (**priority 내림차순 →
  seq 내림차순** — 키보드의 "정렬 후 첫 매치" 와 같은 방향, 동률이면 나중 등록) · `getSnapshot()` (팔레트 구독) ·
  테스트용 `reset()`.
- 게시 시점: `useKeyboardShortcutsRegistry` effect 본문. `shortcuts` 중 `id` 가 있는 항목만 게시 (손수 선언 4건은
  자연히 제외). cleanup 에서 전부 해제. deps 가 바뀌어 effect 가 재실행되면 해제→재등록 (seq 갱신) —
  핸들러 stale 없음. global 등록부는 deps 에 `activeScope` 가 있어(`useGlobalKeyboardShortcuts.ts:683`) focusin
  마다 42건 재게시된다 — 비용은 Map 조작뿐이지만 **팔레트는 열린 동안만 구독**해 닫힌 팔레트가 포커스 이동마다
  재렌더되지 않게 한다.
- `KeyboardShortcut.id?: ShortcutId` 추가 (`useKeyboardShortcutsRegistry.ts:63`) — `bindHandlersToDefinitions`
  가 채운다. optional 이라 손수 선언 호출부 무변경.

### 3-3. 팔레트 소비 (`CommandPalette.tsx`)

- `scopeAtOpen`: `handleOpenChange(true)` 에서 `activeScope` 현재값을 ref 에 저장. ⌘/ 핸들러가 도는 시점에는
  모달이 아직 DOM 에 없어 `useActiveScope` 값이 원래 컨텍스트다 (`determineScope` 는 `focusin`/DOM 변화 뒤에
  갱신). 헤더 메뉴 "Shortcuts" 경유(`open-command-palette` 이벤트) 는 다르다 — popover 는 `modal` 이 아니지만
  (§2 scope 판정) 메뉴에 포커스가 있던 동안 scope 가 global/활성 패널로 밀려 있다. Phase 0 에서 그 값을 실측하고,
  canvas 가 밀려 있으면 `scopeAtOpen` 을 "직전 non-overlay scope" 로 잡는다 (overlay 열림 전 마지막 값을 ref 로 유지).
- 목록 항목 상태 3종: **executable** (entry 있음 + scope 일치 + !disabled) / **scope 불일치** (entry 있음,
  scope 불일치 — 흐리게 + `def.scope` 에서 만든 힌트 "캔버스 선택 필요"·"스타일 패널 필요") / **미등록**
  (entry 없음 — 흐리게 + "지금은 실행할 수 없음"). 숨기지 않는다 — 사용자가 단축키의 존재를 배우는 자리다
  (Figma quick actions 가 불가 항목을 비활성으로 두는 방식). `palette: false` 만 목록에서 뺀다.
- 실행: `handleOpenChange(false)` → RAC 가 트리거로 포커스 복원 → `requestAnimationFrame` 한 번 뒤
  `entry.handler()`. 핸들러 대부분은 store 를 읽지 DOM 포커스를 읽지 않지만 (`handleEscape` 류 예외),
  복원 뒤로 미루면 양쪽 다 안전하다. scope 판정은 **실행 시점이 아니라 `scopeAtOpen`** 으로 이미 끝났다 —
  닫힌 뒤 포커스가 어디로 가든 사용자가 열 때 본 컨텍스트가 기준이다.
- `executeCommand` switch **12 case 삭제** — 패널 토글 11 은 `useGlobalKeyboardShortcuts` 에 이미 등록돼
  있어 registry 로 해소되고, `openProject` 는 BuilderHeader 등록으로 해소된다. `usePanelLayout` import 제거.
- `aria-disabled` + `data-executable="false"` 로 상태 표시. `onAction` 은 executable 만 실행, 나머지는 무시
  (RAC ListBox `disabledKeys` 사용 — 키보드 ↑↓ 는 건너뛰지 않고 표시만 흐리게 두는 쪽이 학습에 유리하므로
  `disabledKeys` 대신 `onAction` 에서 거른다. Phase 2 에서 둘 중 실측으로 확정).

### 3-4. 정의 확장 — `palette?: false`

| 대상                                          | 사유                                                                                                                                                                                |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `commandPalette`                              | 자기 자신                                                                                                                                                                           |
| `treeNav*` 6 · `treeSelect`·`treeSelectSpace` | `panel:nodes` 트리의 **포커스된 행**에 작용 — 팔레트가 닫히며 복원되는 포커스가 그 행이라는 보장이 없다. 게다가 registry 등록 자체가 없다 (RAC `TreeBase` 네이티브 키보드, D1 — §2) |

- `escape`·`Tab`/`⇧Tab`·방향키 8 은 **뺀다고 미리 정하지 않는다** — `arrowUp` 은 "이전 형제로 이동"(순서 재배치)
  이라 1회 실행이 성립하고, `nextElement` 도 선택 이동 1회다. scope 필터가 `canvas-focused` 로 자연히
  가른다. Phase 0 에서 실제로 실행해 보고 어긋나는 것만 `palette: false` 로 옮긴다 (§5 체크리스트).
- `ShortcutDefinition` 타입에 `palette?: false` 추가 (`types/keyboard.ts:54` 부근). `satisfies` 로 검사.

### 3-5. 정적 게이트 재정의 (`shortcutDisplay.static.test.ts`)

- 조항 4 "panels 정의 → 팔레트 case" 는 switch 소멸로 **대상이 사라진다**. 대체 조항: **`palette !== false` 인
  정의 각각이 `bindHandlersToDefinitions` 배열 리터럴 어딘가에 등장한다** (기대 62). tree 8 은 registry 밖
  (RAC 네이티브) 이라 조항 대상이 아니다 — `palette: false` allowlist 와 정확히 겹치므로 별도 예외 목록 불요.
  현재 등록 unique 63 상태를 잠근다. 소스 grep 기반 (기존 조항과
  같은 방식, `ShortcutId[] =` 변수 전달 형태 포함 — 지난 세션 파서 오류 2건 반영).
- 신규 조항: **`palette: false` 는 §3-4 표의 id 에만** — 목록 축소가 슬며시 늘지 않게 allowlist 로 고정.

## 4. Phase 계획

| Phase | 내용                                                                                                                                                                                                                                                                                                                                                                 | 산출/검증                                                                                                                                                                         | commit |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| 0     | inventory freeze — §2 재grep, 팔레트 12/71 스크립트 재실행, 헤더 메뉴 popover 가 `modal` 로 잡히는지 실측, 연속 명령 12개(escape·Tab 2·방향키 8) 를 팔레트 경로 가정으로 1회씩 손 실행해 `palette:false` 후보 확정                                                                                                                                                   | 본 문서 §2/§3-4 표 갱신. G0                                                                                                                                                       | 1      |
| 1     | `stores/commandRegistry.ts` 신설 · `KeyboardShortcut.id` · `bindHandlersToDefinitions` 가 id 채움 · `useKeyboardShortcutsRegistry` effect 에 register/cleanup · 단위 테스트 (register/unregister · 중복 id 우선순위 `escape`·`detachInstance` · deps 재실행 시 stale 0 · 손수 선언 5건 미게시)                                                                       | `commandRegistry.test.ts` · `useKeyboardShortcutsRegistry.test.tsx` (신설 — 기존 없음) · type-check · 키보드 oracle 26/26 재실행 (§6). G1                                         | 1      |
| 2     | 팔레트: `scopeAtOpen` · 목록 3상태 · registry 실행 · switch 12 삭제 · `palette:false` 정의 8+1 · 정적 게이트 조항 4 교체 + allowlist 조항 · CSS (`command-palette-item[data-executable=false]`)                                                                                                                                                                      | `CommandPalette.test.tsx` (jsdom — scope 별 executable 집합, 실행이 handler 를 부르는지, close 뒤 실행 순서) · `shortcutDisplay.static.test.ts` 민감도 (등록 하나 지우면 RED). G2 | 1~2    |
| 3     | live 게이트 — Chrome MCP: 팔레트에서 카테고리별 대표 실행 (undo/redo · zoomIn/zoomToFit · 정렬 2 · 분배 1 · 복제 · 그룹/해제 · 복사/붙여넣기 · 스타일 복사 · 포커스 모드 · 눈금자 · 패널 토글 3) ≥ 20건 · scope 불일치 표시 5건 (패널 포커스에서 열어 정렬이 흐림) · 미등록 표시 1건 (선택 없음 → StylesPanel 언마운트 → toggleSections 흐림) · 키보드 oracle 재실행 | 결과를 본 문서 §5 에 기록. G3 · G4                                                                                                                                                | 0      |
| 4     | CHANGELOG · README Implemented · 본 문서 §5 종결                                                                                                                                                                                                                                                                                                                     | Stop hook 게이트                                                                                                                                                                  | 1      |

- Phase 1 과 2 는 분리 commit — 1 만 들어간 상태는 순수 additive 라 언제든 되돌릴 수 있다.
- Phase 3 는 code 변경 0. 결과 기록만.

## 5. 파일 변경표

| 파일                                                         | 변경                                                                                   | Phase |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------------- | ----- |
| `builder/stores/commandRegistry.ts` (신규)                   | vanilla store · register/resolve/getSnapshot/reset                                     | 1     |
| `builder/stores/commandRegistry.test.ts` (신규)              | 우선순위·중복·해제                                                                     | 1     |
| `builder/hooks/useKeyboardShortcutsRegistry.ts`              | `KeyboardShortcut.id?` · `bindHandlersToDefinitions` id 채움 · effect register/cleanup | 1     |
| `builder/hooks/useKeyboardShortcutsRegistry.test.tsx` (신규) | 게시/해제 · 손수 선언 미게시 · 키보드 경로 무변경                                      | 1     |
| `builder/types/keyboard.ts`                                  | `ShortcutDefinition.palette?: false`                                                   | 2     |
| `builder/config/keyboardShortcuts.ts`                        | `palette: false` 9건 (§3-4)                                                            | 2     |
| `builder/components/overlay/CommandPalette.tsx`              | scopeAtOpen · 3상태 목록 · registry 실행 · switch 삭제 · `usePanelLayout` import 제거  | 2     |
| `builder/components/overlay/CommandPalette.css`              | `[data-executable="false"]` 흐림 + 힌트                                                | 2     |
| `builder/components/overlay/CommandPalette.test.tsx` (신규)  | jsdom — scope 필터 · 실행 · 순서                                                       | 2     |
| `builder/config/shortcutDisplay.static.test.ts`              | 조항 4 교체(전 정의 등록 존재) + allowlist 조항                                        | 2     |
| `docs/CHANGELOG.md` · `docs/adr/README.md`                   | Implemented 반영                                                                       | 4     |

### 체크리스트

- [ ] Phase 0: 재grep 6종 결과가 §2 와 일치 (불일치 시 표 갱신 commit — fork 사유 아님)
- [ ] Phase 0: 헤더 메뉴 popover 열린 상태의 `useActiveScope` 실측값 기록 — canvas 에서 열었는데 global/활성 패널로 밀려 있으면 `scopeAtOpen` 을 직전 non-overlay scope 로 잡는 경로 추가
- [ ] Phase 0: 연속 명령 12개 1회 실행 판정 → `palette:false` 최종 목록
- [ ] Phase 1: 키보드 oracle 26/26 · 입력창 7 · 툴팁 16 전부 동일
- [ ] Phase 1: 정적 게이트 4조항 PASS (변경 전과 동일)
- [ ] Phase 2: 팔레트 switch 0 case · `usePanelLayout` import 0
- [ ] Phase 2: 정적 게이트 민감도 — `bindHandlersToDefinitions` 배열에서 id 하나 제거 → RED · tree 8 은 allowlist 로 GREEN
- [ ] Phase 3: 팔레트 실행 ≥ 20 · scope 불일치 5 · 미등록 1 · 키보드 oracle 재실행
- [ ] Phase 3: 실행 불가 항목 수 = `palette:false` 9 뿐 (그 외 0) — 팔레트 footer 카운트로 확인
- [ ] Phase 4: CHANGELOG (팔레트 실행 12 → N / 흐림 표시 신규) · README Implemented

## 6. 재현 스니펫

### 팔레트 실행 가능 수 (Phase 0 / Phase 3)

```js
// palette-count-begin
const fs = require("fs");
const p = fs.readFileSync(
  "apps/builder/src/builder/components/overlay/CommandPalette.tsx",
  "utf8",
);
const cases = new Set([...p.matchAll(/case "([^"]+)":/g)].map((m) => m[1]));
const s = fs.readFileSync(
  "apps/builder/src/builder/config/keyboardShortcuts.ts",
  "utf8",
);
const body = s.slice(s.indexOf("export const SHORTCUT_DEFINITIONS"));
const re = /^  ([a-zA-Z][a-zA-Z0-9]*): \{([\s\S]*?)^  \},/gm;
let m,
  tot = 0,
  ok = 0;
while ((m = re.exec(body))) {
  tot++;
  if (cases.has(m[1])) ok++;
}
console.log("palette switch exec", ok + "/" + tot);
// palette-count-end
```

Phase 2 이후에는 switch 가 없으므로 이 수치는 0/71 이 정상이고, 실행 가능 수는 live 팔레트 DOM 의
`[data-executable="true"]` 개수로 센다.

### 키보드 회귀 oracle (Phase 1 / 3 — Chrome MCP `javascript_tool`, 캔버스 클릭 후)

```js
const OPT = {
  1: "¡",
  2: "™",
  3: "£",
  4: "¢",
  5: "∞",
  6: "§",
  7: "¶",
  8: "•",
  a: "å",
  h: "˙",
  d: "∂",
  w: "∑",
  v: "√",
  s: "ß",
  m: "µ",
};
const OPTSHIFT = { h: "Ó", v: "◊" };
const tgt =
  document.activeElement && document.activeElement !== document.body
    ? document.activeElement
    : document.querySelector(".canvas-container") || document.body;
const run = (name, init) => {
  const ev = new KeyboardEvent("keydown", {
    bubbles: true,
    cancelable: true,
    ...init,
  });
  tgt.dispatchEvent(ev);
  return name + " → " + (ev.defaultPrevented ? "잡힘" : "무시");
};
const P = (k) => (/^[0-9]$/.test(k) ? "Digit" + k : "Key" + k.toUpperCase());
const out = [];
for (const k of "12345678")
  out.push(run("⌥" + k, { key: OPT[k], code: P(k), altKey: true }));
for (const k of "ahdwvs")
  out.push(
    run("⌥" + k.toUpperCase(), { key: OPT[k], code: P(k), altKey: true }),
  );
for (const k of "hv")
  out.push(
    run("⌥⇧" + k.toUpperCase(), {
      key: OPTSHIFT[k],
      code: P(k),
      altKey: true,
      shiftKey: true,
    }),
  );
out.push(run("⌃⌥M", { key: "µ", code: "KeyM", ctrlKey: true, altKey: true }));
out.push(run("⌘K", { key: "k", code: "KeyK", metaKey: true }));
out.push(run("⌘,", { key: ",", code: "Comma", metaKey: true }));
out.push(run("⌘/", { key: "/", code: "Slash", metaKey: true }));
out.push(run("⇧2", { key: "@", code: "Digit2", shiftKey: true }));
out.push(run("⇧R", { key: "R", code: "KeyR", shiftKey: true }));
out.push(run("Tab", { key: "Tab", code: "Tab" }));
out.push(run("⇧Tab", { key: "Tab", code: "Tab", shiftKey: true }));
out.push(run("⌘Z", { key: "z", code: "KeyZ", metaKey: true }));
out.push(run("⌘⇧Z", { key: "z", code: "KeyZ", metaKey: true, shiftKey: true }));
JSON.stringify({
  caught: out.filter((x) => /잡힘/.test(x)).length + "/" + out.length,
  out,
});
```

기대 `caught: "26/26"`. ⌘O 는 페이지를 떠나므로 마지막에 따로 1회. 파괴적 명령(delete/cut/ungroup)은
사용자 프로젝트에서 실행하지 않는다.

## 7. 비스코프 / 후속

- **컨텍스트 메뉴(ADR-182)·액션 바(ADR-192) 의 바인딩을 registry 로 통합** — 지금은 세 표면이 같은
  `canvasActions` 를 각자 감싼다. 액션 층이 이미 공유돼 drift 폭이 좁고, 두 표면은 provider 모델(선택
  컨텍스트 기반 항목 생성)이라 id → handler 조회보다 풍부한 계약이 필요하다. 본 ADR 종결 후 별도 판단.
- **손수 선언 4건** (Space ×2 · 대시보드 ⌘K · ⌘C/⌘V `panel:properties`) 은 키보드 전용 유지. 정의로 올리면
  팔레트에 실행 불가 항목이 생기거나(대시보드) 정의 하나에 동작 둘(⌘C) 이 된다.
- **`when` 조건**(VS Code 식 — "선택 2개 이상일 때만") 은 scope 보다 세밀한 게이트다. Entry 에
  `enabled?: () => boolean` 자리를 비워 두되 본 ADR 은 scope 만 쓴다 — 정렬은 `alignSelection` 이 스스로
  `multiSelectMode` 를 검사하므로 지금은 필요 없다.
- **`detachInstance` 키보드 이중 발화** — global(capture:document) 과 csel(bubble:window) 이 같은 정의로 각자
  확인 다이얼로그를 띄운다 (§2 중복 id). HC1 상 본 ADR 은 손대지 않는다 — 한쪽 등록 제거는 별도 수정.
- **키보드 dispatcher 단일화** (리스너 N개 → registry 를 읽는 1개) 는 capture/document vs bubble/window
  순서 의미를 바꾸므로 본 ADR 밖 (§Alternatives D 기각 사유).
