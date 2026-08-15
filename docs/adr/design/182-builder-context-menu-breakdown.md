# ADR-182 Design Breakdown: 빌더 우클릭 컨텍스트 메뉴

> 본문: [../182-builder-context-menu.md](../182-builder-context-menu.md)
> 작성: 2026-08-14. 리서치 3종 (Figma 공식 문서 / Pen v1.2.4 번들 실측 / composition 코드 인벤토리) 기반.
> 개정: 2026-08-15 — 리뷰 round 1 반영 (액션 도달 가능성 실측 §1, 액션 공유 계층 §3-7, 계승 가드 §3-4·§3-5, 토큰 정정 §3-6, snap-to-grid 제거 반영, Phase 1.5 신설).

## §0. 리서치 요약 (설계 근거 고정)

### 0-1. Figma (help.figma.com + 단축키 레퍼런스 + 포럼 교차 확인)

- **클러스터 순서 원칙** (위→아래): ① 클립보드 → ② 선택 보조(Select layer ▸) → ③ 구조화(group/frame/auto layout/component/mask/flatten) → ④ 배치(z-순서 4종/flip) → ⑤ 상태 토글(Show/Hide·Lock/Unlock) → ⑥ 확장(Plugins/Widgets)
- **조건 미충족 항목은 숨김** (disabled 아님) — "해당 객체에 적용 가능한 액션의 부분집합"만 표시 (Figma 스태프 표현, 포럼)
- **토글은 라벨 교체** (Show ↔ Hide, Lock ↔ Unlock) — 체크마크 아님
- **파괴적 액션(Delete/Cut) 을 메뉴에서 배제**하고 키보드에 위임 (레이어 우클릭에 Delete 추가 요청 포럼 스레드가 부재 증거). 예외는 페이지 목록의 Delete page 뿐
- **단축키 우측 병기** — 사실상 단축키 학습 UI
- **서브메뉴는 변형 계열에만** (Copy/Paste as ▸, Select layer ▸, Plugins ▸) — 1-depth 기본
- 정렬(align/distribute)은 컨텍스트 메뉴에 **없음** (우측 패널 소속). Duplicate 도 메뉴에 없음 (⌘D 단축키 전용)
- instance 전용: Go to main component / Detach instance ⌥⌘B / Reset all changes — main component 우클릭에서는 사라짐
- 빈 캔버스: Paste here / Show/Hide UI / cursor chat / Plugins·Widgets 등 뷰·협업 토글 중심
- 모드별 메뉴 분리 (Design / Dev Mode / FigJam / 텍스트 편집) — 한 메뉴에 모드 분기를 쌓지 않고 메뉴 자체를 교체

### 0-2. Pen(구 Pencil) v1.2.4 — 앱 번들 실측 (전 항목 found-in-bundle, 추론 0)

- **단일 메뉴 빌더 함수를 캔버스/레이어 리스트가 공유** — 월드 좌표 인자 유무만 다름 (좌표 있으면 "Paste here", 없으면 "Paste"). 레이어 전용 항목 없음
- 항목 스키마: `{kind: "action"|"submenu"|"separator"|"config-toggle", id, label, shortcut?, destructive?, run}` — Delete 는 `destructive: true` (빨간 스타일) 로 **메뉴에 포함**
- 요소 메뉴 (순서 그대로): Copy ⌘C / Copy as ▸ (HTML+CSS·HTML+Tailwind·JSON·PNG ⌘⇧C) / Paste here ─ Bring to Front `]` / Send to Back `[` ─ Group selection ⌘G / Ungroup ⌘⇧G (조건) / Frame selection ⌘⌥G ─ Create Component ⌘⌥K / Go to component (조건) / Detach Instance ⌘⌥X (조건) ─ **Delete ⌫ (destructive)** ─ Settings ▸ (캔버스 토글 3종 + Open settings…, 상시)
- 빈 영역: Paste here ─ Settings ▸ 만
- **우클릭 선택 규칙**: 선택 트리 밖 요소 우클릭 → 그 요소로 교체. 빈 영역은 클릭 지점이 **현 선택의 world bounds 밖일 때만** 선택 해제. 프레임 타이틀 우클릭 = 프레임 우클릭
- 텍스트 편집 중 우클릭은 stopPropagation — 네이티브 텍스트 메뉴 위임
- Duplicate ⌘D / Rename / show·hide 는 메뉴에 없음 (단축키·인라인 UI 전용). 툴 상태 override 훅 (`contextMenuItems?.(pos)`) 으로 벡터 편집 모드가 메뉴 전체 교체

### 0-3. composition 현재 상태 (2026-08-14 실측 · 라인 2026-08-15 재확인)

- 캔버스: `BuilderCanvas.tsx:810-883` `handleCanvasContextMenu` — **detach 가능 인스턴스일 때만** `preventDefault` + 1항목("Detach instance") raw div 메뉴 (`:1424-1445`). 그 외 전부 브라우저 기본 메뉴 (= 보고된 증상 "이미지저장/이미지복사/검사")
- 그 핸들러의 **부수 가드 3종**: editable 예외(`:815-817`) / 눈금자 스트립 예외(`:819-822` `isRulerEventTarget` — ADR-181 R1) / 페이지 occlusion topmost 해소(`:832-852` `buildPagePaintRank`+`resolveTopPageIdAtPoint`+`resolveCanvasDetachContextTarget`) + 페이지 전환(`:864-868`)
- 레이어 트리: `LayerTreeItemContent.tsx:120-272` — 3항목 (Add as component / Remove component / Detach instance) raw div 메뉴, body/synthetic ref child 제외 상시 preventDefault
- CSS 2벌 완전 중복: `Workspace.css:27-52` ≡ `NodesPanel.css:107-132`, 둘 다 `@layer` 밖. 배경 토큰 `--bg-elevated` 는 **정의 0건** (사용 2건뿐 → 현행 메뉴 배경이 실제로 투명)
- `button === 2` 처리 0건 — 우클릭은 DOM `contextmenu` 이벤트로만 진입. 포인터 파이프라인은 `button !== 0` 조기 반환 (`useCentralCanvasPointerHandlers.ts:179`)
- 우클릭이 **무조건 단일 선택으로 덮어씀** (`BuilderCanvas.tsx:863-872`) — 다중 선택 파괴
- 좌클릭은 `resolveClickTarget`(editingContext 경계, `utils/hierarchicalSelection.ts:26-46` — **null 반환 경로 2개**) 경유, 우클릭은 `canDetachInstance` 필터만 (`interaction/canvasContextMenu.ts:5-23`) — **좌/우 대상 해석 불일치**
- 빌더 시스템 UI 의 RAC Menu 선례 1건: `ZoomControls.tsx:198-236` (`MenuTrigger`+`Popover triggerRef`+`Menu`+`MenuItem`+`<kbd>`) — `<kbd>` 하드코딩 5건 (`:210,214,218,222,226`)
- 단축키 표기 정본: `formatShortcut()` (`useKeyboardShortcutsRegistry.ts:317`) + `SHORTCUT_DEFINITIONS` (`config/keyboardShortcuts.ts:35`, `ShortcutId` `:784`)
- **정적 가드가 소스 문자열을 단언**: `BuilderCanvas.projection.static.test.ts:54-73` 이 `const hitElementsMap = getInteractiveElementsMap();`(유일 출현 `:831`) 과 `const hitElement = hitElementsMap.get(elementId);`(유일 출현 `:863`) 의 **존재**를 요구 — 둘 다 대체 대상 핸들러 내부

## §1. Phase 0 인벤토리 freeze — 기존 액션과 **도달 가능성**

도달 가능성 3분류: **S** = store/모듈 export (메뉴가 직접 호출) / **X** = 컴포넌트·훅 내부 클로저 (**호출 불가 — §3-7 추출 대상**) / **N** = 신규 구현.

| 액션                       | 진입점                                                                                                               | 도달 | 비고                                                                                                                                                    |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------- | :--: | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| copy                       | `useGlobalKeyboardShortcuts.ts:182` `handleCanvasCopy` → `multiElementCopy.ts` (유틸은 export)                       | `X`  | 훅이 반환값 없음 (`:640`)                                                                                                                               |
| paste                      | `useGlobalKeyboardShortcuts.ts:205` `handleCanvasPaste` → `deserializeCopiedElements`/`resolvePasteTargetParentId`   | `X`  | Paste here 좌표 확장 여부는 Phase 2 판정                                                                                                                |
| delete                     | `useGlobalKeyboardShortcuts.ts:250` `handleCanvasDelete` → store `removeElements` (`elements.ts:236,240`)            | `X`  | store 액션은 도달 가능하나 **오케스트레이션이 클로저** — primary+다중 합집합·body 필터가 `:265-300` 에 있다. 가이드 우선 분기(`:255-264`)만 단축키 전용 |
| duplicate                  | `CanvasSelectionShortcuts.tsx:226` `handleDuplicate` (⌘D, +10/+10 오프셋)                                            | `X`  |                                                                                                                                                         |
| group(frame)/ungroup       | `CanvasSelectionShortcuts.tsx:401,468` → `elementGrouping.ts` (ADR-130 frame, 유틸 export)                           | `X`  |                                                                                                                                                         |
| align 6종 / distribute 2종 | `CanvasSelectionShortcuts.tsx:540,608` → `elementAlignment.ts`/`elementDistribution.ts` (+`get*Description`)         | `X`  |                                                                                                                                                         |
| ±1 reorder                 | store `reorderElementWithinParent` (`elements.ts:259,1767`)                                                          | `S`  | Forward/Backward 에 그대로 사용                                                                                                                         |
| create/remove component    | store `toggleComponentOrigin` (`elements.ts:312,2232`)                                                               | `S`  | 라벨 토글형                                                                                                                                             |
| detach instance            | store `detachInstance` (`elements.ts:311,2228`) + `requestEditingSemanticsDetachConfirmation` + `canDetachInstance`  | `S`  | 확인 다이얼로그 유지                                                                                                                                    |
| go to origin               | store `selectElementWithPageTransition` (`elements.ts:225,1494`)                                                     | `S`  | `ComponentSemanticsSection` 이 쓰는 것과 동일 진입점                                                                                                    |
| zoom fit/100%              | `viewport/viewportActions.ts:63,155,159` (`computeFitViewport`/`applyViewportState`/`zoomViewportAtContainerCenter`) | `S`  | ZoomControls 의 `zoomToFit:77` 은 이 export 의 3줄 래퍼                                                                                                 |
| rulers 토글                | store `setShowRulers` (`canvasSettings.ts:165`)                                                                      | `S`  | ⇧R 래퍼는 `useGlobalKeyboardShortcuts.ts:162`                                                                                                           |
| 객체 스냅 토글             | store `setSnapToObjects` (`canvasSettings.ts:159`)                                                                   | `S`  | ADR-179                                                                                                                                                 |
| PNG 인코딩                 | `skia/export.ts:40,120` `exportToImage` — **dead code (외부 import 0)**                                              | `S`  | Phase 4 optional 소생                                                                                                                                   |

**갭 (이번 스코프에서 신설 — `N`)**: bringToFront / sendToBack (children[] index 이동 — ±1 은 있으나 first/last 없음), cut (⌘X — `keyboardShortcuts.ts:266` 에 dead definition 만, 핸들러 0건), `[`/`]`/⌘[/⌘] 단축키 바인딩.

**제거된 대상 (2026-08-14 — 인벤토리 정정)**: `snapToGrid` / `showGrid` / `gridSize` 는 `canvasSettings.ts:11` 기록대로 **삭제**됐다 (상태·액션 grep 0건, 주석만 잔존). "그리드 스냅" 메뉴 항목은 §2 T2 에서 제외한다.

**갭 (비스코프 — §6)**: lock/hide (canonical 스키마 필드 자체 부재), rename UI, zoom to selection, Select layer ▸ (겹침 스택), DataTable/Events 패널 항목 액션.

## §2. 대상별 메뉴 정의 (정본)

표기 규약: `─` = separator. 조건 미충족 항목은 **숨김** (Figma/Pen 공통 관례). 단축키는 `formatShortcut(SHORTCUT_DEFINITIONS[shortcutId])` 파생 — 아래 표기는 Mac 기준 참고용. 배선 열의 `X` 표식은 §3-7 추출 대상 액션.

### T1. 캔버스 — 요소 우클릭 (단일·다중 공통)

| #   | 라벨 (ko/en)                                                          | 단축키 | 조건                             | 배선                                                                                                         |
| --- | --------------------------------------------------------------------- | ------ | -------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| 1   | 복사 / Copy                                                           | ⌘C     | 상시                             | `canvasActions.copySelection` (`X` 추출)                                                                     |
| 2   | 붙여넣기 / Paste                                                      | ⌘V     | 상시                             | `canvasActions.paste` (`X` 추출)                                                                             |
| 3   | 복제 / Duplicate                                                      | ⌘D     | 상시                             | `canvasActions.duplicateSelection` (`X` 추출)                                                                |
| ─   |                                                                       |        |                                  |                                                                                                              |
| 4   | 맨 앞으로 / Bring to Front                                            | `]`    | 형제 2+                          | **신규** `bringElementToFront`                                                                               |
| 5   | 앞으로 / Bring Forward                                                | ⌘]     | 형제 2+                          | store `reorderElementWithinParent(+1)`                                                                       |
| 6   | 뒤로 / Send Backward                                                  | ⌘[     | 형제 2+                          | store `reorderElementWithinParent(−1)`                                                                       |
| 7   | 맨 뒤로 / Send to Back                                                | `[`    | 형제 2+                          | **신규** `sendElementToBack`                                                                                 |
| ─   |                                                                       |        |                                  |                                                                                                              |
| 8   | 그룹 만들기 / Group selection                                         | ⌘G     | 상시 (body 제외)                 | `canvasActions.groupSelection` (`X` 추출, ADR-130 frame)                                                     |
| 9   | 그룹 해제 / Ungroup                                                   | ⌘⇧G    | frame/group 선택 시              | `canvasActions.ungroupSelection` (`X` 추출)                                                                  |
| 10  | 정렬 ▸ / Align ▸                                                      |        | **다중 선택 2+**                 | `canvasActions.align`/`distribute` (`X` 추출, 라벨 = `getAlignmentDescription`/`getDistributionDescription`) |
| ─   |                                                                       |        |                                  |                                                                                                              |
| 11  | 컴포넌트 만들기 / Create component ↔ 컴포넌트 해제 / Remove component | ⌘⌥K    | 단일 선택 (라벨 토글)            | store `toggleComponentOrigin`                                                                                |
| 12  | 원본으로 이동 / Go to component                                       |        | 단일 인스턴스 + origin 존재      | store `selectElementWithPageTransition`                                                                      |
| 13  | 인스턴스 분리 / Detach instance                                       | ⌘⌥X    | 선택에 detach 가능 인스턴스 포함 | store `detachInstance` (기존 확인 다이얼로그 경유)                                                           |
| ─   |                                                                       |        |                                  |                                                                                                              |
| 14  | 삭제 / Delete                                                         | ⌫      | 상시 (body 제외)                 | `canvasActions.deleteSelection` (`X` 추출 — body 필터·합집합 보존) — `destructive: true` (Pen 모델)          |

- 다중 선택: 1–3, 4–7(공통 부모 형제군 한정), 8, 10, 13, 14 표시. 11·12 는 단일 선택 전용 (숨김).
- **Figma 와의 의도적 발산 2건**: Duplicate 포함 (Figma·Pen 모두 메뉴 미노출이나, composition 은 비전문가 대상 웹빌더라 발견가능성 우선) / Align ▸ 포함 (기존 액션 8종이 이미 존재하고 우측 패널 노출이 없어 메뉴가 유일한 마우스 경로). 근거 본문 Decision.
- **Delete 포함은 Pen 모델 채택** (Figma 는 배제): 레이어 트리에 delete 버튼이 이미 있어 배제 일관성이 성립하지 않고, destructive 스타일 + 최하단 격리로 오클릭을 완화.

### T2. 캔버스 — 빈 영역 우클릭 (페이지 body·캔버스 배경)

| #   | 라벨                                      | 단축키 | 배선                                                                                     |
| --- | ----------------------------------------- | ------ | ---------------------------------------------------------------------------------------- |
| 1   | 여기에 붙여넣기 / Paste here              |        | `canvasActions.paste` (`X` 추출 — 드롭 좌표 반영은 Phase 2 판정, 미지원 시 라벨 "Paste") |
| ─   |                                           |        |                                                                                          |
| 2   | 화면에 맞추기 / Zoom to fit               | ⌘0     | `viewportActions.computeFitViewport` + `applyViewportState`                              |
| 3   | 100%                                      | ⌘1     | `viewportActions.zoomViewportAtContainerCenter(1)`                                       |
| ─   |                                           |        |                                                                                          |
| 4   | 눈금자 표시 ↔ 숨기기 / Show ↔ Hide rulers | ⇧R     | store `setShowRulers` (라벨 토글)                                                        |
| 5   | 객체 스냅 / Snap to objects               |        | store `setSnapToObjects` (toggle kind — 체크 표시)                                       |

- 5항목. 구 초안의 "그리드 스냅" 은 대상 상태가 2026-08-14 에 제거되어 삭제 (§1 인벤토리 정정).
- Pen 의 "Settings ▸ 상시 노출" 대신 **빈 영역 한정 평면 노출** (Figma 절충 — 요소 메뉴를 얇게 유지).
- 빈 영역 우클릭의 선택 처리: Pen 규칙 채택 — 클릭 지점이 현 선택 bounds **밖**일 때만 선택 해제, 안이면 유지.

### T3. 레이어 트리 (Nodes 패널) — 행 우클릭

**T1 을 그대로 재사용** (Pen 모델 — 단일 빌더 + 컨텍스트 인자). 차이:

- 좌표 없음 → "Paste here" 대신 "붙여넣기 / Paste"
- 행이 미선택 노드면 먼저 선택 (기존 동작 유지), body 행·synthetic ref child 는 메뉴 미표시 (기존 가드 유지)
- 기존 3항목 raw div 메뉴 (`LayerTreeItemContent.tsx:231-272`) **대체 삭제** — Add/Remove component ↔ #11, Detach ↔ #13 으로 흡수
- 행 밖 빈 영역: preventDefault 만, 메뉴 없음 (Pen 동일)

### T4. DOM 패널 일반 영역 (그 외 빌더 셸 전체)

- **자체 메뉴 없음 + 브라우저 기본 메뉴 전역 억제** (빌더 루트 단일 `contextmenu` 리스너)
- 예외 (기본 메뉴 보존): ① `input`/`textarea`/`contenteditable` (및 텍스트 편집 오버레이 — Pen 동일) ② DEV 빌드에서 ⌥(Alt)+우클릭 → 기본 메뉴 통과 (Inspect 개발 편의)
- 억제하되 **메뉴도 열지 않는** 영역: 눈금자 스트립 (§3-5)
- DataTable 행/Pages 행 등 패널 항목 메뉴는 **비스코프** (§6) — 항목 액션 자체가 미비. 본 ADR 의 인프라 (provider 등록) 가 후속 확장 통로

## §3. 시스템 설계

### 3-1. 항목 스키마 (Pen 동형 + composition 파생)

```ts
// apps/builder/src/builder/components/overlay/contextMenu/types.ts
export type ContextMenuItem =
  | {
      kind: "action";
      id: string;
      label: string;
      shortcutId?: ShortcutId;
      destructive?: boolean;
      run: () => void;
    }
  | {
      kind: "toggle";
      id: string;
      label: string;
      checked: boolean;
      shortcutId?: ShortcutId;
      run: () => void;
    }
  | { kind: "submenu"; id: string; label: string; items: ContextMenuItem[] }
  | { kind: "separator"; id: string };

export interface ContextMenuRequest {
  surface: "canvas-element" | "canvas-empty" | "layer-item"; // 후속: "panel-*"
  clientX: number;
  clientY: number;
  scenePoint?: { x: number; y: number }; // canvas 표면만
  targetElementIds: string[]; // 확정된 선택 집합
}
```

- 단축키 라벨: `shortcutId` → `formatShortcut(SHORTCUT_DEFINITIONS[shortcutId])` 파생만 허용. 문자열 하드코딩 금지 (ZoomControls 의 `<kbd>` 5건(`:210,214,218,222,226`)은 본 ADR 범위에서 shortcutId 참조로 정리)
- 라벨: `SHORTCUT_DEFINITIONS[id].i18n.ko` 재사용 가능 항목은 재사용, 메뉴 전용 라벨은 provider 로컬 상수

### 3-2. 메뉴 빌더 — surface → provider 레지스트리 (단일 dispatch)

```ts
type ContextMenuProvider = (req: ContextMenuRequest, deps: ContextMenuDeps) => ContextMenuItem[];

const CONTEXT_MENU_PROVIDERS: Record<ContextMenuRequest["surface"], ContextMenuProvider> = {
  "canvas-element": buildElementMenuItems, // T1
  "canvas-empty": buildEmptyCanvasMenuItems, // T2
  "layer-item": buildElementMenuItems, // T3 = T1 재사용 (Paste 라벨만 surface 로 분기)
};

buildContextMenuItems(request, deps): ContextMenuItem[] // = 모드 override 판정 → 레지스트리 dispatch
```

- **확장 계약**: 후속 표면(`panel-*` — DataTable 행/Pages 행 등, §6)은 이 맵에 provider 1개 등록 + 해당 표면 진입 리스너 추가**만**으로 편입 — 스키마/렌더러/전역 억제 정책(§3-5) 무변경. §6 의 "provider 등록만으로 편입" 이 가리키는 지점이 이 맵. surface 별 분기가 provider 함수 단위로 격리되므로 표면이 이질화되어도 단일 함수 비대화가 없다
- provider 는 전부 **순수 함수** (조건 판정 + 항목 배열 산출) — 각각 단위 테스트 대상
- **`deps` 는 컴포넌트가 넘기는 클로저 묶음이 아니라 §3-7 `canvasActions` 모듈 + store getter 다.** 구 초안의 "BuilderCanvas / LayerTree 가 기존 핸들러를 넘김" 은 실행 불가 — 해당 핸들러 8종이 비-export 클로저이기 때문 (§1 `X` 표식). 표면 고유 값(좌표·행 id)만 `request` 로 전달하고, 액션은 provider 가 공유 계층에서 직접 참조한다
- 조건 판정 입력: 선택 집합, elementsMap (**`getInteractiveElementsMap()` 경유** — projection 정적 가드 준수), editingSemantics (`canDetachInstance`/`getEditingSemanticsOriginId`), 형제 수, frame/group 여부, canvasSettings 상태

**모드 override 채널 (예약 — v1 소비자 0)**: 레지스트리 dispatch **앞**에 override 훅 1개를 둔다 — 활성 편집 모드가 등록한 `(req) => ContextMenuItem[] | null` 이 non-null 을 반환하면 표면 provider 를 건너뛰고 메뉴 전체를 교체한다. Pen 의 `stateManager.state.contextMenuItems?.(pos)` 훅 동형이자 Figma "모드가 메뉴를 교체" 원칙 (한 메뉴에 모드 조건 분기를 쌓지 않음). v1 은 훅 자리만 확보 — 텍스트 입력의 네이티브 메뉴는 T4 예외로 이미 처리되고, 향후 인라인 텍스트 편집(ADR-027)·벡터 편집·프리뷰 모드가 자체 메뉴를 가질 때의 진입점이다

### 3-3. 렌더러 — RAC Menu + Popover 가상 앵커

- `ContextMenuOverlay` 1개: RAC `Popover`(`triggerRef` = 클릭 좌표에 놓인 0×0 앵커 span — ZoomControls `triggerRef` 분리 패턴 확장) + `Menu`/`MenuItem`/`SubmenuTrigger` + `Separator`
- RAC 가 제공: roving focus·타이핑 검색·Esc·outside dismiss·뷰포트 플립. **G1 spike 로 가상 앵커 동작 선검증** — 실패 시 폴백: 자체 포지셔닝 래퍼(fixed + flip 계산) 안에 RAC `Menu` 만 사용
- **dismiss 클릭 격리 (G1 조건)**: 기존 raw 메뉴는 `BuilderCanvas.tsx:1433-1434` 에서 `onPointerDown`/`onClick` 을 stopPropagation 하고 `:787-807` window pointerdown 으로 닫는다. RAC 는 underlay 기반이라 모델이 다르므로, **메뉴를 닫는 좌클릭이 캔버스 선택/마퀴를 발화하지 않는지**를 spike 에서 함께 확인한다 (발화 시 underlay 에 pointer 이벤트 차단 계층 추가)
- 상태 훅 `useContextMenu()`: `{ open(request), close, state }` — BuilderCanvas / LayerTree 공용
- destructive 항목: `data-destructive` + `--negative` 토큰 (css-tokens.md 카테고리 준수)

### 3-4. 우클릭 대상·선택 규칙 (순수 함수)

```
resolveContextMenuSelection(hitElementId | null, scenePoint, current: {selectedElementIds, editingContextId}, maps):
  { surface, nextSelection, targetIds }
```

1. hit 요소를 **좌클릭과 동일하게** `resolveClickTarget(hitElementId, editingContextId, elementsMap)` 로 정규화 — 좌/우 대상 해석 단일화
2. 정규화 결과가 현 선택 집합 안 → **선택 유지** (다중 선택 보존), 밖 → 그 요소로 교체
3. **정규화가 `null` 을 반환하면** (elementsMap 미존재·루트 도달 실패 — `hierarchicalSelection.ts:35,46`) hit 없음과 동일 취급 → 4항 빈 영역 규칙 적용 (메뉴는 열되 surface = "canvas-empty")
4. hit 없음(빈 영역): scenePoint 가 현 선택 bounds 안 → 유지, 밖 → 해제 (Pen 규칙). surface = "canvas-empty"
5. 페이지 전환 필요 시 `selectElementWithPageTransition` (기존 `handleCanvasContextMenu` 로직 계승)

**계승 계약 (HC8 — 호출 상류에서 1:1 이식)**: 신규 캔버스 우클릭 진입점은 `resolveContextMenuSelection` 호출 **전에** 기존 핸들러의 가드를 그대로 거친다.

| 계승 대상      | 원본                                         | 신규 위치                                              |
| -------------- | -------------------------------------------- | ------------------------------------------------------ |
| editable 예외  | `BuilderCanvas.tsx:815-817`                  | §3-5 전역 리스너 (표면 리스너에서 중복 판정 안 함)     |
| 눈금자 스트립  | `:819-822` `isRulerEventTarget` (ADR-181 R1) | §3-5 전역 리스너 — 억제하되 메뉴 미개방                |
| occlusion 해소 | `:832-852` paint rank + topmost hit          | 캔버스 진입 리스너 (hitElementId 산출부) — 그대로 이식 |
| 페이지 전환    | `:864-868`                                   | `resolveContextMenuSelection` 5항                      |

### 3-5. preventDefault 정책 (전역 단일 리스너)

- 빌더 루트 1곳에서 `contextmenu` 캡처. 판정 순서: ① editable(`input`/`textarea`/`contenteditable`) → 통과(네이티브) / ② DEV ⌥ → 통과 / ③ 눈금자 스트립(`isRulerEventTarget`) → `preventDefault` + **메뉴 미개방** / ④ 그 외 → `preventDefault`
- 표면별 리스너 (canvas / layer row) 는 억제가 아니라 **메뉴 열기** 만 담당 — 억제 책임을 표면마다 중복 구현하지 않음
- 기존 산발 preventDefault (`BuilderCanvas.tsx:857-864` 조건부, `LayerTreeItemContent.tsx:120-127`) 는 전역 정책으로 흡수
- ③ 이 없으면 눈금자 위 우클릭이 스트립 아래 씬 좌표로 환산되어 **잘못된 대상의 메뉴**가 열린다 (ADR-181 R1 실측 병인과 동일)

### 3-6. CSS

- 신규 단일 파일 `contextMenu.css` — `@layer builder-system`, 클래스 `context-menu`/`context-menu-item` 등 `{도메인}-{역할}` kebab-case (ADR-163 예약 prefix 회피, `reservedPrefix.static.test.ts` 통과)
- 기존 중복 2벌 삭제: `Workspace.css:27-52` (`.canvas-context-menu*`), `NodesPanel.css:107-132` (`.layer-context-menu*`)
- **토큰 정정 (복사 금지)**: 두 원본의 `background: var(--bg-elevated)` 는 **미정의 토큰**이라 선언이 무효다 (정의 grep 0건 — 현행 메뉴 배경이 투명). 신규 파일은 popover/dropdown 컨테이너 표준인 `--bg-raised` 를 쓴다 (css-tokens.md §Surface Elevation). 나머지(`--border`/`--radius-sm`/`--shadow-lg`/`--spacing-xs`/`--text-xs`)는 `:root` 정의 확인됨

### 3-7. 액션 공유 계층 `canvasActions` (신설 — 리뷰 round 1)

메뉴가 부를 수 있는 액션이 절반뿐이라는 실측(§1 `X` 8종)에 대한 처방. **로직을 복제하지 않고 위치만 옮긴다.**

```
apps/builder/src/builder/workspace/canvas/actions/canvasActions.ts
  copySelection / paste({scenePoint?}) / duplicateSelection / deleteSelection /
  groupSelection / ungroupSelection / align(kind) / distribute(kind)
```

- **추출 원칙 — 호출부 이동, 본문 무변경**: 현재 `useGlobalKeyboardShortcuts.ts:182,205,250` 와 `CanvasSelectionShortcuts.tsx:226,401,468,540,608` 의 `useCallback` 본문을 **그대로** 모듈 함수로 옮기고, 두 등록부는 그 함수를 참조만 한다. 상태 접근은 대부분 `useStore.getState()` 계열이라 훅 컨텍스트 의존이 낮다
- **주입 계약 — elements map 은 인자로 받는다 (유일한 훅 의존)**: `CanvasSelectionShortcuts` 계열 6핸들러는 `getLegacyElementsMap()` = `panelNodeMapToElementMap(useCanonicalPropertyElementsMap())` (`:62-69`, 소비 `:100,174,246,414,477,555,623` + `getElementsMap()` `:380`) 에 의존한다 — 훅 파생이라 모듈 함수로 그대로 옮길 수 없다. 따라서 `canvasActions` 는 `elementsMap` 을 **인자로 받고**, consumer 가 각자 공급한다: 단축키 등록부는 종전 훅 파생 맵을, 메뉴 provider 는 `getInteractiveElementsMap()` (§3-2 조건 판정과 동일 소스) 을 넘긴다. **두 맵의 등가성(요소 집합·parent/child 관계) 확인이 Phase 1.5 의 첫 작업**이며, 불일치하면 그 판정을 Phase 1.5 안에서 해소한다 (메뉴 쪽만 다른 맵을 쓰면 조건 판정과 실행 대상이 갈린다)
- **비추출 (그대로 둠)**: 단축키 전용 관심사 — scope 분기, 가이드 우선 delete 분기(`useGlobalKeyboardShortcuts.ts:255-264`), Tab 내비게이션, 스타일 복사/붙여넣기. 메뉴는 요소 대상 액션만 소비한다
- **consumer 2개**: ① 단축키 등록부(기존 동작 보존 — 회귀 표면) ② 메뉴 provider(§3-2 `deps`). 이후 툴바/커맨드 팔레트가 세 번째로 붙어도 재구현이 없다
- **회귀 감시**: 추출 커밋은 메뉴 없이 단독으로 검증 가능하다 — 기존 단축키 동작(⌘C/⌘V/⌘D/⌫/⌘G/⌘⇧G/정렬 8종)이 그대로면 통과. 감시 수단은 **신규 `canvasActions` 단위 테스트 + 수동 1회 exercise** 다 — 기존 `keyboardShortcuts.test.ts` 는 테스트 1건(`:4-5` 정의 등록 검증)뿐이라 동작 회귀를 감지하지 못한다
- **경계**: `canvasActions` 는 store 액션과 기존 유틸(`multiElementCopy`/`elementGrouping`/`elementAlignment`/`elementDistribution`)의 **오케스트레이션만** 담는다. 새 mutation 로직을 여기 두지 않는다 (bringToFront/sendToBack 은 store `elements.ts` 소속 — canonical 파이프라인 준수)

## §4. Phase 분해

| Phase   | 내용                                                                                                                                                                                                                                                                                            | 산출/게이트                                                                                     |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| **0**   | 인벤토리 freeze — §0·§1 (완료, 본 문서가 산출물. 리뷰 round 1 로 도달 가능성 열 보강)                                                                                                                                                                                                           | —                                                                                               |
| **1**   | 인프라: types/provider 레지스트리(모드 override 훅 자리 포함)/`useContextMenu`/`ContextMenuOverlay`(RAC)/전역 preventDefault(§3-5 4단 판정)/`resolveContextMenuSelection` + 단위 테스트                                                                                                         | **G1** RAC 가상 앵커 + dismiss 격리 spike 선행 (착수 직후, 실패 시 §3-3 폴백 전환)              |
| **1.5** | **액션 공유 계층 추출** (§3-7) — elements map 등가성 판정 → `canvasActions.ts` 신설(8종) + 두 등록부(`useGlobalKeyboardShortcuts.ts` / `CanvasSelectionShortcuts.tsx`)를 참조로 전환. 메뉴와 무관한 독립 커밋                                                                                   | 기존 단축키 회귀 0 (⌘C/⌘V/⌘D/⌫/⌘G/⌘⇧G/정렬 8종 수동 1회 + **신규 `canvasActions` 단위 테스트**) |
| **2**   | 캔버스 배선: T1/T2 provider + `handleCanvasContextMenu` 대체(가드 3종 §3-4 계승) + 기존 detach 메뉴·`canvasContextMenu.ts` 제거, `canvasContextMenu.test.ts` 이관 확장, **projection 정적 가드 이설** (`:54-73` 의 소스 문자열 단언을 신규 모듈 대상으로 재작성)                                | type-check + 이설된 `BuilderCanvas.projection.static.test.ts` PASS                              |
| **3**   | 레이어 트리 배선: T3 (T1 재사용) + 기존 3항목 메뉴 제거 + CSS 2벌 삭제·신규 `contextMenu.css`(§3-6 토큰 정정), `LayerTreeItemContent.test.tsx` 이관                                                                                                                                             | type-check + RTL 테스트 + `reservedPrefix.static.test.ts` PASS                                  |
| **4**   | 신규 소형 액션: `bringElementToFront`/`sendElementToBack` (canonical children[] first/last 이동 — `reorderElementWithinParent` 패턴·히스토리 준수) + `[`/`]`/⌘[/⌘] 단축키 등록 + cut ⌘X (copy→delete 조합, dead definition 소생) + (opt) Copy as PNG (`exportToImage` 소생 — 시간 소진 시 이연) | 단위 테스트 (reorder 경계: 이미 최전/최후, 형제 1) + undo 1회 복귀                              |
| **5**   | 검증·종결: live behavior — Chrome MCP 로 4표면 (요소/빈 영역/레이어 행/패널 억제) 각 1회 exercise + 다중 선택 유지 + 눈금자 우클릭 확인, CHANGELOG (Features), README 갱신                                                                                                                      | **G2** live 4표면 PASS / **G3** `pnpm type-check` + 관련 테스트 PASS                            |

- 커밋 단위: Phase 당 1커밋 이상, phase 종료 시 commit 가능 상태 유지 (CLAUDE.md §대규모 작업 phase 분할)
- Phase 1.5 는 Phase 1 과 독립이라 순서 교환 가능하나, **Phase 2 보다 앞서야** 한다 (provider 가 소비할 액션이 없으면 배선 불가)
- Phase 1↔2 사이 UI 골격이 서 있으면 중간 실측 (요소 우클릭 1회) 권장

### 파일 변경표 (추정)

| 구분 | 파일                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 신규 | `builder/components/overlay/contextMenu/{types,buildContextMenuItems,useContextMenu,ContextMenuOverlay,resolveContextMenuSelection}.ts(x)` + `contextMenu.css` + 테스트 / `builder/workspace/canvas/actions/canvasActions.ts` (§3-7) + 테스트                                                                                                                                                                                                         |
| 수정 | `BuilderCanvas.tsx` (기존 컨텍스트 메뉴 상태·렌더·핸들러 대체), `LayerTreeItemContent.tsx` (동), **`useGlobalKeyboardShortcuts.ts`(640줄 — 액션 참조 전환)**, **`CanvasSelectionShortcuts.tsx`(873줄 — 동)**, **`BuilderCanvas.projection.static.test.ts`(가드 이설)**, `useGlobalKeyboardShortcuts.ts`·`keyboardShortcuts.ts` (`[`/`]`/⌘[/⌘]/cut), `elements.ts` (bringToFront/sendToBack), `ZoomControls.tsx` (kbd 하드코딩 5건 → shortcutId, 부수) |
| 삭제 | `interaction/canvasContextMenu.ts` (빌더로 흡수), `Workspace.css:27-52`, `NodesPanel.css:107-132`                                                                                                                                                                                                                                                                                                                                                     |

## §5. 검증 체크리스트

- [ ] 4표면 live: 요소 우클릭(단일/다중) / 빈 영역 / 레이어 행 / 패널 영역(기본 메뉴 억제 + input 예외) — Chrome MCP 실측
- [ ] 다중 선택 중 선택 요소 우클릭 → 선택 유지 (기존 결함 해소 확인)
- [ ] 좌/우클릭 대상 해석 동일 (`resolveClickTarget` 경유) — editingContext 내부 우클릭 케이스 + 정규화 null 분기
- [ ] **눈금자 스트립 우클릭** → 기본 메뉴 억제 + 캔버스 메뉴 미개방 (ADR-181 R1 회귀 없음)
- [ ] **겹친 페이지 위 우클릭** → 최상단 페이지 대상 선택 (occlusion 계승 확인)
- [ ] **Phase 1.5 회귀**: ⌘C/⌘V/⌘D/⌫/⌘G/⌘⇧G/정렬 8종 단축키가 추출 전과 동일 동작 (신규 `canvasActions` 단위 테스트 + 수동 1회 — `keyboardShortcuts.test.ts` 는 정의 등록만 검증)
- [ ] **elements map 등가성**: 메뉴 경로(`getInteractiveElementsMap()`)와 단축키 경로(`panelNodeMapToElementMap`) 가 같은 요소 집합·부모 관계를 주는지 Phase 1.5 착수 시 확인
- [ ] detach 확인 다이얼로그 유지 + **이설된** `BuilderCanvas.projection.static.test.ts` PASS
- [ ] 단축키 표기 하드코딩 0건 (`formatShortcut` 파생만) / CSS `@layer builder-system` + `reservedPrefix.static.test.ts` PASS + `--bg-elevated` 미사용
- [ ] bringToFront/sendToBack undo 1회 복귀 (히스토리 entry)
- [ ] 캔버스 프레임 예산 영향 0 (메뉴는 DOM 오버레이 — 우클릭 시점 hit-test 1회 외 상시 비용 없음)

## §6. 비스코프 (후속)

| 항목                                                                                             | 사유                                                                              | 재개 조건                                              |
| ------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------- | ------------------------------------------------------ |
| lock/hide (Lock·Show/Hide selection)                                                             | `CanonicalNode` 에 필드 부재 — persist/history/BC 파급이 메뉴 ADR 범위 초과       | 별도 ADR (스키마 additive 필드 + 히트테스트/렌더 소비) |
| rename (요소 이름 변경)                                                                          | `CanonicalNode.name` 은 있으나 편집 UI·표시명 해석 단일화가 별개 작업             | 레이어 패널 인라인 편집 설계 시                        |
| Select layer ▸ (겹침 스택 서브메뉴)                                                              | hit-test 전 후보 열거 + z-순서 정렬 UI — Figma 고유 고급 기능                     | 겹침 선택 불편 실보고 시                               |
| zoom to selection                                                                                | 액션 자체 부재                                                                    | 뷰포트 액션 추가 시 메뉴는 1행                         |
| 그리드 스냅 토글                                                                                 | `snapToGrid`/`showGrid`/`gridSize` 가 2026-08-14 제거됨 (`canvasSettings.ts:11`)  | 격자 기능 재도입 시                                    |
| DataTable/Pages/Events 패널 항목 메뉴                                                            | 항목 액션 자체 미비 (DataTable 0건, Events placeholder)                           | 각 패널 액션 정비 시 — provider 등록만으로 편입 가능   |
| 단축키 정의 SSOT 통합 (`SHORTCUT_DEFINITIONS` ↔ `CanvasSelectionShortcuts.tsx:694-810` 하드코딩) | 메뉴는 표기만 SHORTCUT_DEFINITIONS 참조로 회피 가능 — 핸들러 통합은 별도 리팩토링 | 표기-실바인딩 불일치 실측 시 즉시                      |
| Copy as HTML/CSS/코드 (Pen Copy as ▸ 계열)                                                       | export 파이프라인 (publish 직렬화) 과의 경계 설계 필요                            | publish/export ADR 과 함께                             |
