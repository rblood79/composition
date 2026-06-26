# Button 프로퍼티 "Add Icon" 편의 affordance

## 작성일

2026-06-26

## 배경 — 요청과 ADR-142 전제 점검

사용자 요청: "Button 프로퍼티에 icon 추가 가능한 기능". 두 해석이 ADR-142 설계와 정반대라 사용자 확인을 거쳐 **Icon 자식 element 추가 UX (ADR-142 정합)** 으로 확정.

**차단 메모리 자기-인용** (`feedback-rac-leaf-vs-rsp-composite-icon-bundle`, 2026-06-26 사용자 확립):

- composition Button = **RAC leaf primitive** (`<Button>text</Button>`). ADR-142 가 `iconName`/`iconPosition`/`staticColor` 를 의도적으로 제거.
- 아이콘 붙은 Button = **RSP composite = reusable 조합** (`<Button><Icon/><Text/></Button>`). `<Icon/>` 은 이미 catalog leaf.
- Button.binding 에 `iconName` prop 복원은 **ADR-142 역행 → 금지**.

본 작업은 binding 무수정, prop 무추가. Icon 을 **자식 element** 로 추가하는 빌더 UX 만 제공한다.

## 이미 동작하는 것 (재사용)

조사 결과 데이터/렌더 메커니즘은 전부 존재:

1. **parenting**: `resolveCreationParentId` (useElementCreator.ts:64) — 선택 요소가 있으면 그 id 를 부모로 반환. Button 선택 상태에서 Icon 추가 시 자동으로 Button 자식이 됨.
2. **생성**: `useElementCreator.handleAddElement("Icon", pageId, selectedId, ...)` — ComponentFactory + `getCentralDefaultProps("Icon")` 로 Icon element 생성.
3. **Preview 렌더**: `renderButton` (LayoutRenderers.tsx:545) 가 `children.map(renderElement)` 로 자식 element 렌더 (RSP composite 경로). Icon 은 `<Icon/>` 자식 → `react-aria-Icon` DOM.
4. **Skia 렌더 + color 상속**: 직전 세션 (commit 681434637) 이 부모=button-base 자식 Icon/Text 에 variant text color render-time 주입. CSS `.button-base > :is(.react-aria-Icon...)` (commit 7231737d2) 와 대칭.

즉 사용자는 **이미** Button 선택 → palette 에서 Icon 클릭 → Button 안에 Icon 추가가 가능하다. 빠진 것은 **프로퍼티 패널의 편의 버튼** — palette 까지 가지 않고 선택된 Button 컨텍스트에서 바로 Icon 자식 추가.

## SSOT 3-domain 위상

- **D1 (DOM/구조)**: 변경 없음. Icon 자식 = 기존 RAC `<Icon>` 렌더.
- **D2 (Props/API)**: 변경 없음. Button.binding 무수정, iconName 복원 0.
- **D3 (시각)**: 변경 없음. Icon 색은 직전 세션 자식 color 상속으로 이미 처리.
- **빌더 UX 레이어**: 본 작업 전부. 데이터 schema 외부의 순수 편집 affordance.

## 결정 — properties-panel 조건부 섹션 (FrameSlotSection 패턴)

`FrameSlotSection.tsx` 가 선례: 선택 요소 type 으로 게이트된 섹션이 `addElement` 로 자식 추가. 동형으로 `ButtonChildSection.tsx` 신설.

### 컴포넌트: `ButtonChildSection.tsx`

- **게이트**: 선택 요소가 leaf 버튼(`Button` 또는 `ToggleButton`)일 때만 렌더. `usesButtonBaseUtility` 는 ToggleButtonGroup 도 포함하나 그건 자식이 ToggleButton(leaf 버튼)이라 Icon 자식 직접 대상이 아님 → 명시 set `{ "Button", "ToggleButton" }` 으로 게이트 (usesButtonBaseUtility 직접 사용 안 함).
- **UI**: "Add Icon" 버튼 1개 (`ActionIconButton` 또는 기존 패널 버튼 컴포넌트 재사용).
- **액션**: 클릭 → `useElementCreator.handleAddElement("Icon", currentPageId, selectedElementId, elements, addElement, layoutId, doc)`. 선택된 Button 이 부모가 됨 (resolveCreationParentId).
- **중복 허용**: Icon 자식 이미 존재해도 추가 허용 (단순). 위치/순서 제어 없음 — 생성된 Icon 의 iconName 등은 그 Icon element 의 기존 프로퍼티 패널로 편집.

### 위치

`PropertiesPanel` Content 영역에 조건부 마운트 (FrameSlotSection 인접). 게이트가 false 면 null 반환 → 다른 컴포넌트에 무영향.

## 데이터 흐름

```
[Button 선택] → PropertiesPanel → ButtonChildSection (button-base 게이트 통과)
   "Add Icon" 클릭
      ↓ useElementCreator.handleAddElement("Icon", ..., selectedButtonId, ...)
   resolveCreationParentId → selectedButtonId (Button 이 부모)
      ↓ ComponentFactory + getCentralDefaultProps("Icon")
   addElement(IconElement { parent_id: ButtonId })
      ↓ 기존 파이프라인 (Memory→Index→History→DB→Preview→Rebalance)
   Preview renderButton children.map → <Icon/> 렌더
   Skia buildSpecNodeData → Icon 자식 (부모=Button color 상속)
```

## 검증 (완료 기준 — live behavior 게이트)

1. `pnpm type-check` PASS (baseline 69).
2. **live exercise (Chrome MCP)**: 빌더에서 Button 선택 → 프로퍼티 패널 "Add Icon" 클릭 → Button 안에 Icon 자식 element 생성 확인 (레이어 트리 + Preview + Skia 캔버스에 Icon 표시). 생성된 Icon 이 Button color 상속(직전 세션) 하는지 확인.
3. 비-button (예: Text/Frame) 선택 시 "Add Icon" 섹션 미표시 (게이트 정상).

## 범위 가드

- 빌더 UX 만. D1/D2/D3 schema 무변경. Button.binding 무수정 (iconName 복원 0 — ADR-142 정합).
- "Add Icon" 단일 버튼 (사용자 결정). Add Text / position(start/end) 제어는 본 작업 제외.
- 게이트 1차 범위 = Button/ToggleButton (leaf 버튼). ToggleButtonGroup 은 자식이 ToggleButton 이라 제외.
- 생성된 Icon 의 iconName/색 등 편집은 그 Icon element 의 기존 프로퍼티 패널 책임 (본 작업은 "추가" 진입점만).

## ADR-142 와의 관계

ADR-142 RAC leaf 원칙 **준수**. Button = RAC primitive 유지, 아이콘은 자식 element(RSP composite) 로 표현 — ADR-142 §3 "아이콘 붙은 Button = reusable 조합" 모델 그대로. binding/prop schema 무변경이라 ADR 신규/수정 불요 (순수 빌더 편집 affordance).
