# ADR-195: 명령 팔레트 실행 경로 — command registry 승격 (단축키 핸들러 SSOT)

## Status

Proposed — 2026-08-27

> 출처: 2026-08-27 단축키 재배치 세션 — 정의(`SHORTCUT_DEFINITIONS`)·표기(`formatShortcut`) 를 SSOT 로 세운 뒤 팔레트를 재점검하니 **71개를 나열하고 12개만 실행**된다. 사용자 판정 "버그" 후 ADR 착수 지시. 완전 신규 주제 (fork 아님) — 전제 기록은 [breakdown §1](design/195-command-palette-execution-registry-breakdown.md).

## Context

**SSOT 3-domain 위치**: 빌더 시스템 UI (builder-system layer). D1/D2/D3 어느 domain 에도 속하지 않는다 — catalog/spec/Generator 확장 0, 캔버스 컴포넌트 시각·DOM·props 무관 (ADR-163/192 와 같은 위상). Generator 지원 여부 선언 대상 아님.

### 문제 — 명령 팔레트가 실행을 약속하고 지키지 않는다

2026-08-27 실측 (breakdown §2):

- 팔레트(`CommandPalette.tsx`) 는 정의 71개를 전부 나열하고 footer 에 `↵ 실행` 을 표시하며 `ListBox onAction` 을 건다. 그러나 `executeCommand` 의 switch (`CommandPalette.tsx:168-216`) 는 **12 case** (패널 토글 11 + 프로젝트 열기) 뿐이고 `default` 는 _"키보드 이벤트로 시뮬레이션 — 향후 command registry 통합 시 개선"_ 주석만 있다. 나머지 **59개는 골라도 팔레트만 닫힌다.** 키보드 경로는 전부 정상(26/26 발화) — 팔레트라는 두 번째 진입점만 핸들러에 닿지 못한다.
- 근본 원인은 **핸들러가 registry 의 `useEffect` 클로저 안에 갇혀 있다**는 것이다 (`useKeyboardShortcutsRegistry.ts:293-352`). `KeyboardShortcut` 에는 `id` 조차 없어(`:63-99`) 등록된 뒤에는 어느 정의의 핸들러인지 알 수 없다. 핸들러는 7곳에 흩어져 각 컴포넌트의 로컬 컨텍스트를 잡고 있다 — StylesPanel 의 `collapsedSections`, BuilderCanvas 의 `computeSelectionBoundsForHitTest`, CanvasSelectionShortcuts 의 `getLegacyElementsMap`. 팔레트가 12개만 구현한 이유도 그것만 `usePanelLayout` 으로 팔레트가 직접 부를 수 있었기 때문이다.
- 팔레트가 열리면 `useActiveScope` 가 `modal` 을 돌려주므로(`useActiveScope.ts:212-218` `determineScope` 1순위) 열린 뒤에는 **원래 컨텍스트(캔버스인지 어느 패널인지)를 알 수 없다** — 실행 가능 여부를 판정하려면 열기 전 scope 를 잡아 둬야 한다.
- 액션 층은 이미 공유돼 있다: 정렬·분배·그룹은 `canvasActions.ts` 를 컨텍스트 메뉴(ADR-182, `canvasContextMenuProviders.ts:196-208`)와 단축키(`CanvasSelectionShortcuts.tsx:206-211`)가 같이 부른다. 중복된 것은 액션이 아니라 **바인딩**(컨텍스트 조립 + 로컬 state) 이다. 따라서 필요한 것은 핸들러 재구현이 아니라 **등록된 바인딩을 두 번째 소비자가 조회할 수 있게 하는 것**이다.
- 같은 세션에서 정의 SSOT (등록이 정의에서 key/scope 를 읽음) 와 표기 SSOT (툴팁·메뉴·팔레트가 `formatShortcut` 하나에서 파생) 를 세웠다. **실행 축만 SSOT 가 없다.** 이번에 `toggleDatatable`/`toggleTheme`/`toggleAI` 가 정의만 늘고 팔레트가 안 따라온 것이 그 형태의 첫 재발이었고, 정적 게이트 조항 4 로 임시 봉합했다.

**Hard Constraints**:

1. **키보드 경로 무변경** — 등록 hook 의 `handleKeyEvent`·listener 부착(capture/target)·우선순위 판정은 한 줄도 바뀌지 않는다. 회귀 oracle = 2026-08-27 재점검 스크립트 (실물 macOS 형태 26 조합 발화 **26/26** · 입력창 포커스 7 조합 · 툴팁 16/16, breakdown §6) 동일 결과 + 정적 게이트 기존 3조항 PASS.
2. **팔레트 실행 가능 = 등록된 전부** — 팔레트에서 골라 아무 일도 안 나는 항목은 `palette: false` 로 명시한 것(breakdown §3-4, 9개 상한) 외 **0**. 등록이 있고 scope 가 맞는데 실행되지 않는 항목 0. 현재 12/71 → 목표 62/71 — 등록 실측 unique 63 (71 − tree 8; tree 8 은 RAC `TreeBase` 네이티브 키보드라 registry 밖, breakdown §2) 에서 `commandPalette` 자신을 뺀 수. Phase 0 inventory 가 확정.
3. **팔레트 자체 핸들러 0** — `executeCommand` 의 switch case 12 → 0. 팔레트는 registry 조회만 한다.
4. **per-keydown 비용 증가 0** — registry 게시는 effect 본문(마운트/deps 변경)에서만, keydown 경로에 코드 추가 없음. 팔레트 열기 p95 는 종전과 같다 (목록은 71 항목 memo).
5. **번들** — 신규 store 모듈 Δ ≤ +2KB gz. 외부 의존 0.
6. **언마운트 = 실행 불가** — 등록 컴포넌트가 사라지면(StylesPanel 은 선택 없으면 `EmptyState`) 팔레트도 그 항목을 실행 불가로 표시한다. stale 핸들러 실행 0.

**Soft Constraints**:

- RAC `ModalOverlay` 는 닫힐 때 트리거 요소로 포커스를 복원한다. 핸들러 실행은 복원 뒤로 미룬다 — 대부분의 핸들러는 store 를 읽지 DOM 포커스를 읽지 않지만 `handleEscape` 류 예외가 있다.
- 헤더 메뉴 "Shortcuts" 경유 열기(`open-command-palette` 이벤트) — RAC Popover 1.20 은 `role=dialog` 만 두고 `aria-modal` 을 쓰지 않아 `isModalOpen()` 에 잡히지 않는다 (`dist/private/Popover.mjs:118,180`). 문제는 `modal` 이 아니라 **메뉴에 포커스가 들어간 동안 `determineScope` 가 canvas → global/활성 패널로 이미 밀린 값**을 `scopeAtOpen` 이 잡는 것 — Phase 0 실측 대상은 그 값이다.
- 컨텍스트 메뉴(182)·액션 바(192) 의 바인딩 통합은 본 ADR 밖 — provider 모델이라 id → handler 조회보다 풍부한 계약이 필요하고, 액션 층 공유로 drift 폭이 이미 좁다 (breakdown §7).
- 손수 선언 등록 4건(Space ×2 · 대시보드 ⌘K · `panel:properties` ⌘C/⌘V) 은 정의가 없어 registry 밖에 남는다 — 키보드 전용이 맞는 항목들이다.

## Alternatives Considered

### 대안 A: command registry 게시 — 등록 hook 이 `(id → handler, scope)` 를 store 에 추가로 올리고 팔레트가 조회 (권장)

- 설명: `KeyboardShortcut.id?: ShortcutId` 를 추가하고 `bindHandlersToDefinitions` 가 채운다. `useKeyboardShortcutsRegistry` 의 effect 가 종전대로 listener 를 붙이면서 **동시에** `commandRegistry` (Zustand vanilla store, `stores/commandRegistry.ts`) 에 entry 를 게시하고 cleanup 에서 해제한다. 팔레트는 열 때 `scopeAtOpen` 을 잡고, 항목마다 `resolve(id)` + `matchesScope(def.scope, scopeAtOpen)` 로 executable 을 판정해 흐림/힌트를 표시하며, 실행은 닫힌 뒤 `entry.handler()` 직접 호출. switch 12 case 삭제.
- 근거: VS Code 의 구조 — `commands.registerCommand(id, handler)` 와 keybinding 이 분리돼 있고 keybinding 은 id 로 같은 핸들러를 부른다; Command Palette 는 `when` 절이 거짓인 명령을 숨기거나 비활성으로 둔다. Figma quick actions(⌘/) 도 메뉴와 같은 명령 집합을 쓰고 불가 항목은 비활성 표시. cmdk/Linear 류는 명령을 `{id, onSelect}` 데이터로 들고 키 합성을 하지 않는다. 프로젝트 안 선례 = 같은 세션의 표기 SSOT (`shortcutDisplayFor` 가 정의에서 파생) 와 ADR-155 의 `CanvasSelectionShortcutsHost` (등록을 패널 언마운트에서 분리).
- 위험:
  - 기술: **M** — 중복 id(`escape` 2곳) 우선순위 규칙 신설 · `scopeAtOpen` 시점 정확성 · 닫힘 뒤 실행 순서. 셋 다 jsdom 테스트 가능.
  - 성능: L — effect 본문 Map set/delete, keydown 경로 무변경.
  - 유지보수: L — 등록 hook 한 곳만 바뀌고 호출부 7곳 무변경. 새 정의 + 등록이면 팔레트에 자동 등장.
  - 마이그레이션: L — additive. Phase 1 만 들어간 상태는 순수 게시라 되돌리기 1 commit.

### 대안 B: 키보드 이벤트 합성 — 팔레트가 닫힌 뒤 정의의 key/code/modifier 로 `KeyboardEvent` 를 dispatch (기존 주석의 계획)

- 설명: `executeCommand(id)` → close → 포커스 복원 대기 → `document.dispatchEvent(new KeyboardEvent("keydown", {key, code, metaKey…}))`. 기존 listener 가 받아 처리.
- 근거: Electron 앱이 `webContents.sendInputEvent` 로 쓰는 패턴. 코드 변경이 팔레트 한 곳.
- 위험:
  - 기술: **H** — 이번 세션이 실측한 함정 그대로다: ⌥ 조합은 `key` 가 문자 변환된 값이어야 실물과 같고(`code` 매칭 정의만 통과), 발화 여부가 **닫힌 뒤 포커스가 어디로 갔는가**에 달려 `useActiveScope` 재판정 타이밍(`focusin` → setState) 과 경합한다. `allowInInput` 없는 명령은 복원 포커스가 입력창이면 무시된다. 실패가 조용하다 (`defaultPrevented` 로만 판정).
  - 성능: L.
  - 유지보수: **H** — 팔레트가 registry 의 매칭 규칙(modifier 판정·capture 순서·우선순위) 을 역으로 재현해야 하고, registry 가 바뀌면 같이 깨진다. 실행 가능 여부 표시가 불가능 (dispatch 해 보기 전엔 모른다).
  - 마이그레이션: L.

### 대안 C: 핸들러 전부를 전역 명령 모듈로 끌어올림 — `commands.ts` 에 71 핸들러, 키보드·팔레트가 같은 함수를 호출

- 설명: 컴포넌트 로컬 핸들러를 폐지하고 `useStore.getState()` 만 읽는 순수 명령 모듈로 옮긴다. 등록 hook 은 id 만 넘기고, 팔레트도 같은 모듈을 부른다.
- 근거: 가장 순수한 SSOT. Photoshop/Sketch 식 "메뉴 명령이 곧 전부" 모델.
- 위험:
  - 기술: **H** — 로컬 state 에 의존하는 핸들러를 store 로 승격해야 한다: `collapsedSections`(StylesPanel) · `computeSelectionBoundsForHitTest`(BuilderCanvas 의 frameAreas/pagePositions) · `getLegacyElementsMap`(CanvasSelectionShortcuts, canonical read view) · 속성 클립보드(PropertiesPanel). 각각이 별도 결정이다.
  - 성능: M — 캔버스 컨텍스트를 store 로 미러링하면 selection 클릭 fan-out 이 늘어난다 (memory `project-selection-click-fanout-next-lever` 와 역행).
  - 유지보수: M — 완성되면 낮지만 도달까지 7 파일 전면 개편.
  - 마이그레이션: **H** — 등록 지점 7곳 + 로컬 state 4종 이동, 되돌리기 어렵다. 규모가 본 문제(팔레트 조회 불가)의 5배 이상.

### 대안 D: dispatcher 단일화 — listener N개를 없애고 registry 를 읽는 keydown listener 1개로 통합

- 설명: A 의 store 를 두되 keydown 처리도 store 에서 한다. 각 `useKeyboardShortcutsRegistry` 는 등록만 하고 listener 를 붙이지 않는다.
- 근거: 구조적으로 가장 깔끔 — 우선순위가 전역 하나로 정해지고 `escape` 2중 발화 같은 것이 사라진다.
- 위험:
  - 기술: **H** — 현재 listener 들의 phase/target 이 다르다 (`useGlobalKeyboardShortcuts.ts:683-687` capture+document, 나머지 bubble+window). `escape` 는 두 리스너가 각자 발화해 모달 닫기와 선택 해제를 나눠 맡고, 액션 바(ADR-192) 는 `data-shortcut-scope` 로 캔버스 리스너를 막는다. 단일화하면 이 순서 의미가 전부 재설계 대상이고 HC1 (키보드 경로 무변경) 을 정면으로 어긴다.
  - 성능: L.
  - 유지보수: M.
  - 마이그레이션: **H** — 회귀 oracle 26 조합으로는 순서 의미 변화를 다 못 잡는다.

### Risk Threshold Check

| 대안 | 기술 | 성능 | 유지보수 | 마이그레이션 | HIGH+ 개수 |
| ---- | ---- | ---- | -------- | ------------ | :--------: |
| A    | M    | L    | L        | L            |     0      |
| B    | H    | L    | H        | L            |     2      |
| C    | H    | M    | M        | H            |     2      |
| D    | H    | L    | M        | H            |     2      |

루프 판정: HIGH 0 인 대안(A) 이 있으므로 추가 대안 불요. CRITICAL 없음.

## Decision

**대안 A: command registry 게시** 를 선택한다.

선택 근거:

1. **문제의 크기에 맞는 수정** — 결함은 "핸들러를 조회할 수 없다" 하나이고, A 는 등록 hook 한 곳에 게시 3줄 + 팔레트 소비로 그것만 고친다. 액션 층은 이미 공유돼 있어(§Context) 재구현이 필요 없다.
2. **키보드 경로를 건드리지 않는다** — HC1 을 구조적으로 만족한다. Phase 1(게시만) 은 동작 변화 0 인 additive commit 이라 회귀 oracle 이 그대로 통과해야 하고, 통과하지 않으면 그 자체가 결함 신호다.
3. **실행 가능 여부를 열기 전에 안다** — B 와 달리 dispatch 해 보지 않고도 entry 존재 + scope 일치로 판정할 수 있어, 팔레트가 "지금은 실행할 수 없음" 을 표시할 수 있다. 사용자가 단축키를 배우는 자리로서의 팔레트 가치가 여기서 나온다.
4. **잔존 위험이 전부 jsdom 으로 잠긴다** — 중복 id 우선순위 · scopeAtOpen · 닫힘 뒤 실행 순서 (§Risks R1–R3) 는 단위 테스트가 재현한다. Chrome MCP 는 최종 확인용이다.
5. **같은 세션의 표기 SSOT 와 형태가 같다** — 정의(무엇을) / 표기(어떻게 보이나) / 실행(무엇이 도나) 세 축이 모두 "한 곳에서 파생" 이 된다. 정적 게이트 조항 4 의 임시 봉합(패널 정의 → 팔레트 case) 을 "`palette !== false` 인 정의 전부에 등록 존재" 로 일반화할 수 있다 (tree 8 은 RAC `TreeBase` 네이티브 키보드 — D1 — 라 registry 밖이 맞고, `palette: false` 대상과 정확히 겹친다).

기각 사유:

- **대안 B 기각**: 이번 세션에서 실측한 함정(⌥ 문자 변환 · 포커스 복원 타이밍 · `allowInInput`) 을 팔레트 안에 그대로 옮겨 심는다. 실행 가능 여부를 미리 알 수 없어 "골라도 아무 일 없음" 이 구조적으로 남는다. 기존 주석의 계획이지만 채택하지 않는다.
- **대안 C 기각**: 결함이 아닌 것(컴포넌트 로컬 컨텍스트) 까지 옮긴다. 캔버스 컨텍스트의 store 미러링은 selection fan-out 을 키우는 방향이고, 규모가 5배 이상이며 되돌리기 어렵다. A 로 팔레트가 해결된 뒤에도 필요해지지 않는다.
- **대안 D 기각**: HC1 위반. listener phase/target 순서 의미(escape 2중 발화 · 액션 바 scope 선언) 재설계는 본 문제와 무관한 별도 결정이고, 회귀 oracle 이 순서 변화를 다 잡지 못한다. breakdown §7 에 후속 판단으로 남긴다.

> 구현 상세: [195-command-palette-execution-registry-breakdown.md](design/195-command-palette-execution-registry-breakdown.md)

## Risks

| ID  | 위험                                                                                                                                                                                                                                                       | 심각도 | 대응                                                                                                                                                                                                                                                                                                               |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| R1  | 중복 id **2건** — `escape`(global `handleEscape` / csel `handleEscapeClearSelection`) 와 `detachInstance`(global `handleDetachInstance` / csel `handleDetachSelectedInstance`, 둘 다 확인 다이얼로그) — 키보드는 둘 다 발화하지만 팔레트는 하나만 부른다   |  MED   | 규칙 명문화: priority 내림차순 → 등록 순번 내림차순 (`resolve`). 단위 테스트가 두 id 모두 잠금. `escape` 는 둘 다 무해하고 Phase 0 에서 `palette:false` 후보이기도 하다. `detachInstance` 는 어느 쪽이든 같은 확인 흐름이라 팔레트 결과 동일 — 키보드 경로의 이중 발화 자체는 HC1 상 본 ADR 밖 (breakdown §7 후속) |
| R2  | `scopeAtOpen` 을 잘못 잡음 — 헤더 메뉴 경유 열기에서 메뉴 포커스로 scope 가 이미 global/활성 패널로 밀려 있거나, 입력창 포커스 상태에서 ⌘/ 로 열면 `text-editing` 이 잡혀 캔버스 명령이 전부 흐림                                                          |  MED   | Phase 0 실측 항목 (breakdown 체크리스트 — 메뉴 열린 동안의 `useActiveScope` 값). `text-editing`/overlay 경유면 직전 non-overlay scope 로 fallback 하는 규칙을 둘지 실측 후 결정. jsdom 테스트가 scope 별 executable 집합을 잠근다                                                                                  |
| R3  | 닫힘 뒤 실행 순서 — RAC 포커스 복원 전에 핸들러가 돌아 DOM 포커스를 읽는 핸들러가 어긋남                                                                                                                                                                   |  MED   | `requestAnimationFrame` 1회 뒤 실행 + 테스트. scope 판정은 `scopeAtOpen` 으로 이미 끝났으므로 복원 위치는 실행 여부에 영향 없음                                                                                                                                                                                    |
| R4  | deps 변경으로 effect 재실행 시 해제→재등록 사이 팔레트가 열려 있으면 순간적으로 "미등록" 표시. global 등록부는 deps 에 `activeScope` 가 있어(`useGlobalKeyboardShortcuts.ts:683`) focusin 마다 42건 재게시 → 상시 구독이면 팔레트가 포커스 이동마다 재렌더 |  LOW   | 팔레트 목록은 `getSnapshot` 구독이라 다음 렌더에 복구. 실행 시점에 `resolve` 를 다시 부르므로 stale 실행 없음. **구독은 열린 동안만** (`isOpen` 조건) — 닫힌 팔레트는 store 를 읽지 않는다                                                                                                                         |
| R5  | 팔레트 목록 변화가 사용자-가시 — 9개가 사라지고(`palette:false`) 일부가 흐리게 표시                                                                                                                                                                        |  LOW   | CHANGELOG 필수 트리거 (사용자-가시 변경). footer 카운트가 "실행 가능 N / 전체" 로 바뀜                                                                                                                                                                                                                             |
| R6  | 컨텍스트 메뉴·액션 바 바인딩은 여전히 별도 사본 — registry 밖 표면이 남는다                                                                                                                                                                                |  LOW   | 액션 층(`canvasActions`) 공유로 drift 폭이 좁다. breakdown §7 후속. 본 ADR 은 팔레트만 대상 (scope inflation 차단)                                                                                                                                                                                                 |

잔존 HIGH 위험 없음.

## Gates

| Gate | 시점    | 통과 조건                                                                                                                                                                                                                                                                          | 실패 시 대안                                                                                                                                          |
| ---- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| G0   | Phase 0 | breakdown §2 재grep 6종 일치 · 헤더 메뉴 popover 열린 동안 `useActiveScope` 실측값 기록 (`modal` 아님은 코드로 확정 — 관심은 canvas 이탈 여부) · 연속 명령 12개 1회 실행 판정으로 `palette:false` 목록 확정 (상한 9)                                                               | 표 갱신 commit 으로 흡수 (fork 아님). 메뉴 경유 시 canvas 가 밀려 있으면 `scopeAtOpen` 을 메뉴 열기 전 값(직전 non-overlay scope) 으로 잡는 경로 추가 |
| G1   | Phase 1 | 키보드 oracle 26/26 · 입력창 7 · 툴팁 16 종전과 동일 · 정적 게이트 3조항 PASS · registry 단위 테스트 (등록/해제/중복 우선순위/손수 선언 미게시) PASS · type-check PASS                                                                                                             | 게시 코드 revert (additive 1 commit). 원인이 effect deps 라면 deps 배열 재검토                                                                        |
| G2   | Phase 2 | switch case 0 · jsdom: scope 별 executable 집합 정확 (canvas/panel:styles/global 3 케이스) · 실행이 handler 를 정확히 1회 부름 · 정적 게이트 신조항 민감도 (`palette !== false` 정의의 등록 하나 제거 → RED, `palette:false` allowlist 밖 추가 → RED, tree 8 은 allowlist 로 통과) | 실패 조항만 수정. `disabledKeys` vs `onAction` 필터는 실측으로 확정                                                                                   |
| G3   | Phase 3 | live: 팔레트 실행 ≥ 20 건 (카테고리별 대표) · scope 불일치 흐림 5 · 미등록 흐림 1 · 실행 불가 항목 = `palette:false` 뿐 (그 외 0) · 키보드 oracle 재실행 동일                                                                                                                      | 실행 안 되는 항목은 R1/R2/R3 중 어느 것인지 jsdom 재현 후 수정. 3건 이상이면 Phase 2 재검토                                                           |
| G4   | Phase 3 | 팔레트 열기 p95 종전 대비 +1ms 이내 · 번들 Δ ≤ +2KB gz · keydown 경로 diff 0 (git diff 로 `handleKeyEvent` 무변경 확인)                                                                                                                                                            | 목록 memo 재검토. keydown 경로에 diff 가 있으면 HC1 위반 — 되돌린다                                                                                   |

## Consequences

### Positive

- 팔레트에서 고른 명령이 실행된다 — 12/71 → 등록된 전부. 실행 불가 항목은 이유("캔버스 선택 필요" / "지금은 실행할 수 없음") 와 함께 흐리게 표시돼 단축키를 배우는 자리가 된다.
- 실행 축이 SSOT 를 얻는다 — 정의(`SHORTCUT_DEFINITIONS`) / 표기(`formatShortcut`) / 실행(`commandRegistry`) 세 축 모두 "한 곳에서 파생". 새 정의 + 등록이면 팔레트에 자동 등장하고, 정적 게이트가 `palette !== false` 정의 중 "등록 없는 정의" 를 잡는다.
- `CommandPalette.tsx` 의 switch 12 case 와 `usePanelLayout` 의존이 사라진다. 팔레트는 정의와 registry 만 안다.
- 등록 hook 호출부 7곳 무변경 — `bindHandlersToDefinitions` 를 쓰는 곳은 코드를 고치지 않고 팔레트에 노출된다.

### Negative

- `KeyboardShortcut` 에 `id` 필드가 생기고 `useKeyboardShortcutsRegistry` effect 가 store 를 만진다 — hook 이 순수 listener 에서 "listener + 게시" 로 책임이 하나 늘어난다.
- 중복 id 우선순위 규칙이 새로 생긴다 (R1 — 현재 `escape`·`detachInstance` 2건). 키보드는 리스너별로 각자 발화하지만 팔레트는 하나만 부르므로, 같은 id 를 두 곳에 등록하는 것이 앞으로는 "팔레트에서 어느 쪽이 도나" 를 고려해야 하는 결정이 된다.
- 팔레트 목록이 71 → 62 로 줄고 일부가 흐리게 보인다 — 사용자-가시 변경 (CHANGELOG 필수).
- 컨텍스트 메뉴·액션 바는 여전히 registry 밖 (R6) — 세 표면 통합은 후속 판단으로 남는다.
