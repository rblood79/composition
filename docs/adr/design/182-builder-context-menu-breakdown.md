# ADR-182 Design Breakdown: 빌더 우클릭 컨텍스트 메뉴

> 본문: [../182-builder-context-menu.md](../182-builder-context-menu.md)
> 작성: 2026-08-14. 리서치 3종 (Figma 공식 문서 / Pen v1.2.4 번들 실측 / composition 코드 인벤토리) 기반.

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

### 0-3. composition 현재 상태 (2026-08-14 실측)

- 캔버스: `BuilderCanvas.tsx:814-886` `handleCanvasContextMenu` — **detach 가능 인스턴스일 때만** `preventDefault` + 1항목("Detach instance") raw div 메뉴. 그 외 전부 브라우저 기본 메뉴 (= 보고된 증상 "이미지저장/이미지복사/검사")
- 레이어 트리: `LayerTreeItemContent.tsx:120-272` — 3항목 (Add as component / Remove component / Detach instance) raw div 메뉴, body/synthetic ref child 제외 상시 preventDefault
- CSS 2벌 완전 중복: `Workspace.css:27-52` ≡ `NodesPanel.css:107-132`, 둘 다 `@layer` 밖
- `button === 2` 처리 0건 — 우클릭은 DOM `contextmenu` 이벤트로만 진입. 포인터 파이프라인은 `button !== 0` 조기 반환 (`useCentralCanvasPointerHandlers.ts:179`)
- 우클릭이 **무조건 단일 선택으로 덮어씀** (`BuilderCanvas.tsx:866-872`) — 다중 선택 파괴
- 좌클릭은 `resolveClickTarget`(editingContext 경계) 경유, 우클릭은 `canDetachInstance` 필터만 — **좌/우 대상 해석 불일치**
- 빌더 시스템 UI 의 RAC Menu 선례 1건: `ZoomControls.tsx:198-236` (`MenuTrigger`+`Popover triggerRef`+`Menu`+`MenuItem`+`<kbd>`)
- 단축키 표기 정본: `formatShortcut()` (`useKeyboardShortcutsRegistry.ts:317-334`) + `SHORTCUT_DEFINITIONS` (i18n.ko 전량 존재)

## §1. Phase 0 인벤토리 freeze — 배선 가능한 기존 액션

| 액션                       | 진입점                                                                                                                      | 비고                                                       |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| copy                       | `useGlobalKeyboardShortcuts.ts` `handleCanvasCopy` → `multiElementCopy.ts` `copyMultipleElements`/`serializeCopiedElements` | scope 분기 포함                                            |
| paste                      | `handleCanvasPaste` → `deserializeCopiedElements`/`pasteMultipleElements`/`resolvePasteTargetParentId`                      | Paste here 는 좌표 → 위치 지정 확장 필요 여부 Phase 2 판정 |
| duplicate                  | `CanvasSelectionShortcuts.tsx` `handleDuplicate` (⌘D, +10/+10 오프셋)                                                       |                                                            |
| delete                     | `handleCanvasDelete` (body 제외 + 가이드 우선 분기) / store `removeElement(s)`                                              |                                                            |
| group(frame)/ungroup       | `handleGroupSelection`/`handleUngroupSelection` → `elementGrouping.ts` (ADR-130 frame)                                      |                                                            |
| align 6종 / distribute 2종 | `handleAlign`/`handleDistribute` → `elementAlignment.ts`/`elementDistribution.ts` (+`get*Description` 라벨)                 |                                                            |
| ±1 reorder                 | `elements.ts` `reorderElementWithinParent(id, ±1)` + `siblingReorder.ts`                                                    | Forward/Backward 에 그대로 사용                            |
| create/remove component    | `toggleComponentOrigin` (`instanceActions.ts`) — 라벨 토글형                                                                | 레이어트리 기존 메뉴와 동일                                |
| detach instance            | `detachInstance` + `requestEditingSemanticsDetachConfirmation` + `canDetachInstance` 가드                                   | 확인 다이얼로그 유지                                       |
| go to origin               | `ComponentSemanticsSection.tsx` `handleGoToOrigin` → `selectElementWithPageTransition`                                      |                                                            |
| zoom fit/100%              | `ZoomControls.tsx` `handleAction` / `viewportActions.ts`                                                                    |                                                            |
| rulers 토글                | `handleToggleRulers` (⇧R, ADR-181)                                                                                          |                                                            |
| 스냅 토글                  | `canvasSettings.ts` (snap-to-grid / snapToObjects — ADR-179)                                                                |                                                            |
| PNG 인코딩                 | `skia/export.ts` `exportToImage` — **dead code (소비자 0)**                                                                 | Phase 4 optional 소생                                      |

**갭 (이번 스코프에서 신설)**: bringToFront / sendToBack (children[] index 이동 — ±1 은 있으나 first/last 없음), cut (⌘X — `keyboardShortcuts.ts` 에 dead definition 만 존재), `[`/`]`/⌘[/⌘] 단축키 바인딩.

**갭 (비스코프 — §6)**: lock/hide (canonical 스키마 필드 자체 부재), rename UI, zoom to selection, Select layer ▸ (겹침 스택), DataTable/Events 패널 항목 액션.

## §2. 대상별 메뉴 정의 (정본)

표기 규약: `─` = separator. 조건 미충족 항목은 **숨김** (Figma/Pen 공통 관례). 단축키는 `formatShortcut(SHORTCUT_DEFINITIONS[shortcutId])` 파생 — 아래 표기는 Mac 기준 참고용.

### T1. 캔버스 — 요소 우클릭 (단일·다중 공통)

| #   | 라벨 (ko/en)                                                          | 단축키 | 조건                             | 배선                                                                                                   |
| --- | --------------------------------------------------------------------- | ------ | -------------------------------- | ------------------------------------------------------------------------------------------------------ |
| 1   | 복사 / Copy                                                           | ⌘C     | 상시                             | handleCanvasCopy                                                                                       |
| 2   | 붙여넣기 / Paste                                                      | ⌘V     | 상시                             | handleCanvasPaste                                                                                      |
| 3   | 복제 / Duplicate                                                      | ⌘D     | 상시                             | handleDuplicate                                                                                        |
| ─   |                                                                       |        |                                  |                                                                                                        |
| 4   | 맨 앞으로 / Bring to Front                                            | `]`    | 형제 2+                          | **신규** bringElementToFront                                                                           |
| 5   | 앞으로 / Bring Forward                                                | ⌘]     | 형제 2+                          | reorderElementWithinParent(+1)                                                                         |
| 6   | 뒤로 / Send Backward                                                  | ⌘[     | 형제 2+                          | reorderElementWithinParent(−1)                                                                         |
| 7   | 맨 뒤로 / Send to Back                                                | `[`    | 형제 2+                          | **신규** sendElementToBack                                                                             |
| ─   |                                                                       |        |                                  |                                                                                                        |
| 8   | 그룹 만들기 / Group selection                                         | ⌘G     | 상시 (body 제외)                 | handleGroupSelection (ADR-130 frame)                                                                   |
| 9   | 그룹 해제 / Ungroup                                                   | ⌘⇧G    | frame/group 선택 시              | handleUngroupSelection                                                                                 |
| 10  | 정렬 ▸ / Align ▸                                                      |        | **다중 선택 2+**                 | handleAlign 6종 + handleDistribute 2종 (라벨 = `getAlignmentDescription`/`getDistributionDescription`) |
| ─   |                                                                       |        |                                  |                                                                                                        |
| 11  | 컴포넌트 만들기 / Create component ↔ 컴포넌트 해제 / Remove component | ⌘⌥K    | 단일 선택 (라벨 토글)            | toggleComponentOrigin                                                                                  |
| 12  | 원본으로 이동 / Go to component                                       |        | 단일 인스턴스 + origin 존재      | handleGoToOrigin 로직 (selectElementWithPageTransition)                                                |
| 13  | 인스턴스 분리 / Detach instance                                       | ⌘⌥X    | 선택에 detach 가능 인스턴스 포함 | detachInstance (기존 확인 다이얼로그 경유)                                                             |
| ─   |                                                                       |        |                                  |                                                                                                        |
| 14  | 삭제 / Delete                                                         | ⌫      | 상시 (body 제외)                 | handleCanvasDelete — `destructive: true` (Pen 모델)                                                    |

- 다중 선택: 1–3, 4–7(공통 부모 형제군 한정), 8, 10, 13, 14 표시. 11·12 는 단일 선택 전용 (숨김).
- **Figma 와의 의도적 발산 2건**: Duplicate 포함 (Figma·Pen 모두 메뉴 미노출이나, composition 은 비전문가 대상 웹빌더라 발견가능성 우선) / Align ▸ 포함 (기존 액션 8종이 이미 존재하고 우측 패널 노출이 없어 메뉴가 유일한 마우스 경로). 근거 본문 Decision.
- **Delete 포함은 Pen 모델 채택** (Figma 는 배제): 레이어 트리에 delete 버튼이 이미 있어 배제 일관성이 성립하지 않고, destructive 스타일 + 최하단 격리로 오클릭을 완화.

### T2. 캔버스 — 빈 영역 우클릭 (페이지 body·캔버스 배경)

| #   | 라벨                                      | 단축키 | 배선                                                                       |
| --- | ----------------------------------------- | ------ | -------------------------------------------------------------------------- |
| 1   | 여기에 붙여넣기 / Paste here              |        | handleCanvasPaste (드롭 좌표 반영은 Phase 2 판정 — 미지원 시 라벨 "Paste") |
| ─   |                                           |        |                                                                            |
| 2   | 화면에 맞추기 / Zoom to fit               | ⌘0     | handleZoomToFit                                                            |
| 3   | 100%                                      | ⌘1     | handleZoom100                                                              |
| ─   |                                           |        |                                                                            |
| 4   | 눈금자 표시 ↔ 숨기기 / Show ↔ Hide rulers | ⇧R     | handleToggleRulers (라벨 토글)                                             |
| 5   | 객체 스냅 / Snap to objects               |        | canvasSettings.snapToObjects (toggle kind — 체크 표시)                     |
| 6   | 그리드 스냅 / Snap to grid                |        | canvasSettings snap-to-grid (toggle kind)                                  |

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

- 단축키 라벨: `shortcutId` → `formatShortcut(SHORTCUT_DEFINITIONS[shortcutId])` 파생만 허용. 문자열 하드코딩 금지 (ZoomControls 의 `<kbd>⌘0</kbd>` 하드코딩은 본 ADR 범위에서 shortcutId 참조로 정리)
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
- provider 는 전부 **순수 함수** (조건 판정 + 항목 배열 산출) — 각각 단위 테스트 대상. `deps` 는 액션 핸들러 주입 (BuilderCanvas / LayerTree 가 기존 핸들러를 넘김) — 표면별 capability 객체로 유지해 deps 비대화 방지
- 조건 판정 입력: 선택 집합, elementsMap (**`getInteractiveElementsMap()` 경유** — projection 정적 가드 준수), editingSemantics (`canDetachInstance`/`getEditingSemanticsOriginId`), 형제 수, frame/group 여부, canvasSettings 상태

**모드 override 채널 (예약 — v1 소비자 0)**: 레지스트리 dispatch **앞**에 override 훅 1개를 둔다 — 활성 편집 모드가 등록한 `(req) => ContextMenuItem[] | null` 이 non-null 을 반환하면 표면 provider 를 건너뛰고 메뉴 전체를 교체한다. Pen 의 `stateManager.state.contextMenuItems?.(pos)` 훅 동형이자 Figma "모드가 메뉴를 교체" 원칙 (한 메뉴에 모드 조건 분기를 쌓지 않음). v1 은 훅 자리만 확보 — 텍스트 입력의 네이티브 메뉴는 T4 예외로 이미 처리되고, 향후 인라인 텍스트 편집(ADR-027)·벡터 편집·프리뷰 모드가 자체 메뉴를 가질 때의 진입점이다

### 3-3. 렌더러 — RAC Menu + Popover 가상 앵커

- `ContextMenuOverlay` 1개: RAC `Popover`(`triggerRef` = 클릭 좌표에 놓인 0×0 앵커 span — ZoomControls `triggerRef` 분리 패턴 확장) + `Menu`/`MenuItem`/`SubmenuTrigger` + `Separator`
- RAC 가 제공: roving focus·타이핑 검색·Esc·outside dismiss·뷰포트 플립. **G1 spike 로 가상 앵커 동작 선검증** — 실패 시 폴백: 자체 포지셔닝 래퍼(fixed + flip 계산) 안에 RAC `Menu` 만 사용
- 상태 훅 `useContextMenu()`: `{ open(request), close, state }` — BuilderCanvas / LayerTree 공용
- destructive 항목: `data-destructive` + `--negative` 토큰 (css-tokens.md 카테고리 준수)

### 3-4. 우클릭 대상·선택 규칙 (순수 함수)

```
resolveContextMenuSelection(hitElementId | null, scenePoint, current: {selectedElementIds, editingContextId}, maps):
  { surface, nextSelection, targetIds }
```

1. hit 요소를 **좌클릭과 동일하게** `resolveClickTarget(hitElementId, editingContextId, elementsMap)` 로 정규화 — 좌/우 대상 해석 단일화
2. 정규화 결과가 현 선택 집합 안 → **선택 유지** (다중 선택 보존), 밖 → 그 요소로 교체
3. hit 없음(빈 영역): scenePoint 가 현 선택 bounds 안 → 유지, 밖 → 해제 (Pen 규칙). surface = "canvas-empty"
4. 페이지 전환 필요 시 `selectElementWithPageTransition` (기존 `handleCanvasContextMenu` 로직 계승)

### 3-5. preventDefault 정책 (전역 단일 리스너)

- 빌더 루트 1곳에서 `contextmenu` 캡처: editable 예외 / DEV ⌥ 예외 판정 → 그 외 `preventDefault()`
- 표면별 리스너 (canvas / layer row) 는 억제가 아니라 **메뉴 열기** 만 담당 — 억제 책임을 표면마다 중복 구현하지 않음
- 기존 산발 preventDefault (`BuilderCanvas.tsx:857-864` 조건부, `LayerTreeItemContent.tsx:120-127`) 는 전역 정책으로 흡수

### 3-6. CSS

- 신규 단일 파일 `contextMenu.css` — `@layer builder-system`, 클래스 `context-menu`/`context-menu-item` 등 `{도메인}-{역할}` kebab-case (ADR-163 예약 prefix 회피, `reservedPrefix.static.test.ts` 통과)
- 기존 중복 2벌 삭제: `Workspace.css:27-52` (`.canvas-context-menu*`), `NodesPanel.css:107-132` (`.layer-context-menu*`)

## §4. Phase 분해

| Phase | 내용                                                                                                                                                                                                                                                                                            | 산출/게이트                                                                  |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| **0** | 인벤토리 freeze — §0·§1 (완료, 본 문서가 산출물)                                                                                                                                                                                                                                                | —                                                                            |
| **1** | 인프라: types/provider 레지스트리(모드 override 훅 자리 포함)/`useContextMenu`/`ContextMenuOverlay`(RAC)/전역 preventDefault/`resolveContextMenuSelection` + 단위 테스트                                                                                                                        | **G1** RAC 가상 앵커 spike 선행 (Phase 1 착수 직후, 실패 시 §3-3 폴백 전환)  |
| **2** | 캔버스 배선: T1/T2 provider + `handleCanvasContextMenu` 대체 + 기존 detach 메뉴·`canvasContextMenu.ts` 제거, `canvasContextMenu.test.ts` 이관 확장 (다중 선택 유지/빈 영역 bounds 규칙/editingContext 정규화)                                                                                   | type-check + 기존 정적 가드 (`BuilderCanvas.projection.static.test.ts`) PASS |
| **3** | 레이어 트리 배선: T3 (T1 재사용) + 기존 3항목 메뉴 제거 + CSS 2벌 삭제, `LayerTreeItemContent.test.tsx` 이관                                                                                                                                                                                    | type-check + RTL 테스트 PASS                                                 |
| **4** | 신규 소형 액션: `bringElementToFront`/`sendElementToBack` (canonical children[] first/last 이동 — `reorderElementWithinParent` 패턴·히스토리 준수) + `[`/`]`/⌘[/⌘] 단축키 등록 + cut ⌘X (copy→delete 조합, dead definition 소생) + (opt) Copy as PNG (`exportToImage` 소생 — 시간 소진 시 이연) | 단위 테스트 (reorder 경계: 이미 최전/최후, 형제 1)                           |
| **5** | 검증·종결: live behavior — Chrome MCP 로 4표면 (요소/빈 영역/레이어 행/패널 억제) 각 1회 exercise + 다중 선택 유지 확인, CHANGELOG (Features), README 갱신                                                                                                                                      | **G2** live 4표면 PASS / **G3** `pnpm type-check` + 관련 테스트 PASS         |

- 커밋 단위: Phase 당 1커밋 이상, phase 종료 시 commit 가능 상태 유지 (CLAUDE.md §대규모 작업 phase 분할)
- Phase 1↔2 사이 UI 골격이 서 있으면 중간 실측 (요소 우클릭 1회) 권장

### 파일 변경표 (추정)

| 구분 | 파일                                                                                                                                                                                                                                                                                         |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 신규 | `apps/builder/src/builder/components/overlay/contextMenu/{types,buildContextMenuItems,useContextMenu,ContextMenuOverlay,resolveContextMenuSelection}.ts(x)` + `contextMenu.css` + 테스트                                                                                                     |
| 수정 | `BuilderCanvas.tsx` (기존 컨텍스트 메뉴 상태·렌더·핸들러 대체), `LayerTreeItemContent.tsx` (동), `useGlobalKeyboardShortcuts.ts`·`keyboardShortcuts.ts` (`[`/`]`/⌘[/⌘]/cut), `elements.ts` (`bringElementToFront`/`sendElementToBack`), `ZoomControls.tsx` (kbd 하드코딩 → shortcutId, 부수) |
| 삭제 | `interaction/canvasContextMenu.ts` (빌더로 흡수), `Workspace.css:27-52`, `NodesPanel.css:107-132`                                                                                                                                                                                            |

## §5. 검증 체크리스트

- [ ] 4표면 live: 요소 우클릭(단일/다중) / 빈 영역 / 레이어 행 / 패널 영역(기본 메뉴 억제 + input 예외) — Chrome MCP 실측
- [ ] 다중 선택 중 선택 요소 우클릭 → 선택 유지 (기존 결함 8번 해소 확인)
- [ ] 좌/우클릭 대상 해석 동일 (`resolveClickTarget` 경유) — editingContext 내부 우클릭 케이스
- [ ] detach 확인 다이얼로그 유지 + `BuilderCanvas.projection.static.test.ts` PASS
- [ ] 단축키 표기 하드코딩 0건 (`formatShortcut` 파생만) / CSS `@layer builder-system` + `reservedPrefix.static.test.ts` PASS
- [ ] bringToFront/sendToBack undo 1회 복귀 (히스토리 entry)
- [ ] 캔버스 프레임 예산 영향 0 (메뉴는 DOM 오버레이 — 우클릭 시점 hit-test 1회 외 상시 비용 없음)

## §6. 비스코프 (후속)

| 항목                                                                                             | 사유                                                                              | 재개 조건                                              |
| ------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------- | ------------------------------------------------------ |
| lock/hide (Lock·Show/Hide selection)                                                             | `CanonicalNode` 에 필드 부재 — persist/history/BC 파급이 메뉴 ADR 범위 초과       | 별도 ADR (스키마 additive 필드 + 히트테스트/렌더 소비) |
| rename (요소 이름 변경)                                                                          | `CanonicalNode.name` 은 있으나 편집 UI·표시명 해석 단일화가 별개 작업             | 레이어 패널 인라인 편집 설계 시                        |
| Select layer ▸ (겹침 스택 서브메뉴)                                                              | hit-test 전 후보 열거 + z-순서 정렬 UI — Figma 고유 고급 기능                     | 겹침 선택 불편 실보고 시                               |
| zoom to selection                                                                                | 액션 자체 부재                                                                    | 뷰포트 액션 추가 시 메뉴는 1행                         |
| DataTable/Pages/Events 패널 항목 메뉴                                                            | 항목 액션 자체 미비 (DataTable 0건, Events placeholder)                           | 각 패널 액션 정비 시 — provider 등록만으로 편입 가능   |
| 단축키 정의 SSOT 통합 (`SHORTCUT_DEFINITIONS` ↔ `CanvasSelectionShortcuts.tsx:694-810` 하드코딩) | 메뉴는 표기만 SHORTCUT_DEFINITIONS 참조로 회피 가능 — 핸들러 통합은 별도 리팩토링 | 표기-실바인딩 불일치 실측 시 즉시                      |
| Copy as HTML/CSS/코드 (Pen Copy as ▸ 계열)                                                       | export 파이프라인 (publish 직렬화) 과의 경계 설계 필요                            | publish/export ADR 과 함께                             |
