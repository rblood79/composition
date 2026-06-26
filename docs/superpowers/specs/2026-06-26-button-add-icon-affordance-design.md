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

## 결정 v2 (2026-06-26 갱신) — Content section "Icon" 셀렉트 (자식 element 백킹)

> **v1 supersede 사유 (사용자 재설계 2026-06-26)**: v1 의 "Children section + Add Icon 버튼" 은 (1) 별도 섹션이 Content 와 분리돼 있어 발견성이 낮고 (2) 생성만 가능(읽기/수정/삭제 불가)했다. v2 는 Button 자체 Content section 의 **Text 항목 아래 "Icon" 셀렉트** 로 통합 — 기본값 none, 아이콘 선택 시 자식 Icon element 생성, 다른 아이콘 선택 시 기존 자식 iconName 수정, none 복귀 시 자식 삭제. v1 의 `ButtonChildSection.tsx` 는 이 컴포넌트로 forward-fix 교체(revert 아님, 미push 6 commit 위에 새 commit).

### ADR-142 정합 재확인 (사용자 confirm 2026-06-26)

차단 메모리 `feedback-rac-leaf-vs-rsp-composite-icon-bundle` 자기-인용: "binding 에 iconName 복원 = ADR-142 역행 금지". **v2 는 차단 미적용** — 사용자 확정대로 Content section 의 "Icon" 셀렉트는 **표면 UX 일 뿐 실제로는 Button 의 자식 Icon element 를 CRUD** 한다. `Button.binding` 무수정, `iconName` prop 복원 0. DOM 은 여전히 `<Button><Icon/>Save</Button>` (RAC/RSP 공식 composite 모델). "none 기본값" 은 "자식 Icon 없음", 아이콘 선택은 "자식 Icon element 생성/지정".

### 컴포넌트: `ButtonChildSection.tsx` (Icon-셀렉트형으로 재작성)

- **게이트**: 변경 없음. `BUTTON_CHILD_HOST_TAGS = { "Button", "ToggleButton" }`. 비-host 선택 시 null.
- **위젯**: 기존 `PropertyIconPicker` (`components/property/PropertyIconPicker.tsx`) 재사용 — `value`(현재 아이콘) / `onChange`(선택) / `onClear`(none 복귀) + 빈 값 시 "None" 표시 내장. 새 picker 신설 불요.
- **표시값 (읽기)**: `useCanonicalPropertyChildren(buttonId)` 로 자식 조회 → 첫 `type==="Icon"` 자식의 `props.iconName` 을 `value` 로. 자식 Icon 없으면 `value=undefined` → "None".
- **4-way 동기화**:
  - `none → 아이콘` (자식 Icon 없는 상태에서 onChange): `handleAddElement("Icon", currentPageId, buttonId, filtered, addElement, null, doc)` 로 자식 생성 후, 생성된 Icon id 로 `updateElementProps(iconId, { iconName })`. (handleAddElement 가 새 id 를 반환하는지 확인 필요 — 미반환 시 생성 직후 자식 재조회로 id 획득.)
  - `아이콘 → 다른 아이콘` (자식 Icon 존재, onChange): `updateElementProps(existingIconId, { iconName })`. 생성 안 함.
  - `아이콘 → none` (onClear): `removeElement(existingIconId)`. cascade 로 Icon 자식(없음) 정리.
- **중복 가드**: 자식 Icon 이 이미 있으면 생성하지 않고 수정만 — v1 의 무한 중복 생성 문제 해소.
- **위치**: Button Content section 내부 Text 항목 아래. PropertiesPanel 마운트 위치는 v1 유지(`ButtonChildSection elementId={...}`), 섹션 title 만 "Content" 동조 또는 GenericFieldRenderer Content 섹션 직후 인접 배치.

### v1 결정 (superseded) — properties-panel 조건부 섹션 (FrameSlotSection 패턴)

`FrameSlotSection.tsx` 가 선례: 선택 요소 type 으로 게이트된 섹션이 `addElement` 로 자식 추가. 동형으로 `ButtonChildSection.tsx` 신설.

### 컴포넌트: `ButtonChildSection.tsx`

- **게이트**: 선택 요소가 leaf 버튼(`Button` 또는 `ToggleButton`)일 때만 렌더. `usesButtonBaseUtility` 는 ToggleButtonGroup 도 포함하나 그건 자식이 ToggleButton(leaf 버튼)이라 Icon 자식 직접 대상이 아님 → 명시 set `{ "Button", "ToggleButton" }` 으로 게이트 (usesButtonBaseUtility 직접 사용 안 함).
- **UI**: "Add Icon" 버튼 1개 (`ActionIconButton` 또는 기존 패널 버튼 컴포넌트 재사용).
- **액션**: 클릭 → `useElementCreator.handleAddElement("Icon", currentPageId, selectedElementId, elements, addElement, layoutId, doc)`. 선택된 Button 이 부모가 됨 (resolveCreationParentId).
- **중복 허용**: Icon 자식 이미 존재해도 추가 허용 (단순). 위치/순서 제어 없음.
- **icon 선택 UI 는 기존 패턴 재사용 (사용자 확인 2026-06-26)**: "Add Icon" 으로 생성된 Icon 자식의 **어떤 아이콘인지** 선택은 `Icon.binding` 의 `accepts.iconName: { kind: "icon", section: "content" }` — 즉 SelectIcon 등 여러 곳이 이미 쓰는 content section iconName 프로퍼티 패턴 그대로. 본 작업은 새 icon-picker 를 만들지 않는다 (생성 진입점 "Add Icon" 버튼만 추가). 사용자가 추가된 Icon 자식을 선택하면 기존 GenericFieldRenderer 가 `kind:"icon"` 필드를 content section 에 렌더 → icon 선택.

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

## ADR-142 와의 관계 + RSP 공식 근거

ADR-142 RAC leaf 원칙 **준수**. Button = RAC primitive 유지, 아이콘은 자식 element(RSP composite) 로 표현 — ADR-142 §3 "아이콘 붙은 Button = reusable 조합" 모델 그대로. binding/prop schema 무변경이라 ADR 신규/수정 불요 (순수 빌더 편집 affordance).

**RSP 공식 확증** (react-spectrum.adobe.com/Button, 사용자 제시 2026-06-26): RSP Button 구조 템플릿이 명시적으로

```tsx
<Button>
  <Icon />
  <Text />
</Button>
```

— RSP 에서도 아이콘은 Button **prop 이 아니라 별도 자식 element**(`<Icon/>` + `<Text/>`)다. 본 설계의 "Icon=자식 element, iconName prop 복원 0" 방향이 RAC/RSP 공식 모두와 정합. (D2 참조 = RSP, D1 권위 = RAC — 둘 다 자식 element 모델.)
