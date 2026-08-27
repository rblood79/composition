# ADR-073 구현 상세 — Select/ComboBox items SSOT + wiring 정리

> **관련 ADR**: [073-select-combobox-items-ssot.md](../completed/073-select-combobox-items-ssot.md)
> **선례**: [ADR-066 Tabs items SSOT](../completed/066-tabs-items-ssot-migration.md), [ADR-068 Menu items SSOT + MenuItem Spec](../completed/068-menu-items-ssot-and-menuitem-spec.md)
> **SSOT 맥락**: [ssot-hierarchy.md](../../../.claude/rules/ssot-hierarchy.md) D2(Props/API) 정렬 + D3(시각 스타일) 보완.
> **2026-04-18 Codex 2차 리뷰 반영**: widening scope 4건(ItemsManager Menu 전용 / 선택 상태 역매핑 재설계 / dataBinding 우선순위 / Factory·Hierarchy·canvas 연쇄) + DB migration 경로 정정.

## 목표

ADR-066/068 패턴을 Select/ComboBox 로 확장. 현재 `items?: string[]` primitive 수준 + SelectItem/ComboBoxItem element tree 공존 구조를 **`items?: StoredSelectItem[]` / `StoredComboBoxItem[]` 풀 인터페이스 단일 SSOT** 로 전환.

Scope α: Select + ComboBox 한정. ListBox 는 `[data-orientation]`/`--lb-*` 표현 한계 실측이 선행되어야 하므로 후속 ADR (ADR-074 또는 연동) 에서 처리.

## 현재 상태 (main `8ed33889` 기준)

- **`Select.spec.ts:64`**: `items?: string[]`
- **`ComboBox.spec.ts:54`**: `items?: string[]`
- **element tree**: SelectItem / ComboBoxItem child element 가 store 에 물리적 존재 (metadata.ts:905/918 등록)
- **Editors**: `SelectItemEditor`, `ComboBoxItemEditor` (Property Panel 에서 개별 element 편집)
- **Renderer 파일 분리 (CRITICAL)**:
  - `packages/shared/src/renderers/SelectionRenderers.tsx:619` `renderSelect`
  - `packages/shared/src/renderers/SelectionRenderers.tsx:882` `renderComboBox`
  - `packages/shared/src/renderers/CollectionRenderers.tsx:751` `renderMenu` (Bonus 영역)
- **선택 상태 역매핑 로직 (CRITICAL)**:
  - `SelectionRenderers.tsx:795-812` (Select) + `:1057-1075` (ComboBox) 가 `selectedKey.startsWith("react-aria-")` → index parse → `selectItemChildren[index]` 역매핑
  - items SSOT 전환 시 이 로직 **items[index] 기반으로 재설계** 필수
- **shared component dataBinding 우선순위 (CRITICAL)**:
  - `packages/shared/src/components/Select.tsx:145-162` + `ComboBox.tsx:145-163` 가 `hasDataBinding` true 시 `boundData` 우선, items fallback
  - ADR 초안의 "items 우선, dataBinding fallback" 서술은 현 구현과 **역방향** → 정정 또는 component 수정 필요
- **ItemsManager Menu 전용 (CRITICAL)**:
  - `apps/builder/src/builder/panels/properties/generic/ItemsManager.tsx:168-184` 가 `addMenuItem`/`removeMenuItem`/`updateMenuItem` 하드코딩
  - `apps/builder/src/builder/stores/elements.ts:1461-1463` 이 `menu.tag !== "Menu"` early return
  - P4 에서 "items-manager type 붙이면 재사용" 전제가 **틀림** → store API 일반화 + 컴포넌트 확장 필수
- **Factory/Hierarchy/canvas 연쇄 (CRITICAL)**:
  - `apps/builder/src/builder/factories/definitions/SelectionComponents.ts:87, 215` factory 가 SelectItem/ComboBoxItem child 자동 생성
  - `apps/builder/src/builder/utils/HierarchyManager.ts:402-409` 가 Select/ComboBox tag 분기로 child filter
  - `apps/builder/src/builder/workspace/canvas/layout/engines/utils.ts:1978-1983` `SELECT_HIDDEN_CHILDREN` Set 에 SelectItem/ComboBoxItem/ListBoxItem
  - P6 에서 metadata + editor 만 지우면 위 3 파일이 여전히 legacy 동작 → 계층/레이아웃 어긋남

## Phase 구조 (Codex 리뷰 후 재설계)

### P1 — Types 신설 (`packages/specs/src/types/`)

- `select-items.ts` 신설: `StoredSelectItem` (직렬화) + `RuntimeSelectItem` (함수 변환)
- `combobox-items.ts` 신설: `StoredComboBoxItem` (직렬화) + `RuntimeComboBoxItem` (함수 변환)
- 필드: `id / label / value / textValue? / isDisabled? / icon? / description? / onActionId?`
- `types/index.ts` 에 re-export
- `toRuntimeSelectItem(stored, resolveActionId)` / `toRuntimeComboBoxItem(...)` 변환 함수 signature 준비 (구현은 P3)

### P2 — Select.spec.ts / ComboBox.spec.ts `items` 필드 타입 전환

- `items?: string[]` → `items?: StoredSelectItem[]` / `StoredComboBoxItem[]`
- properties 섹션에 `items-manager` field type 추가 (ADR-068 패턴 — 단 P4 에서 ItemsManager 일반화 이전까지는 no-op)
- defaultItem + itemSchema 정의 (Menu.spec 의 itemSchema 참조)
- **`render.shapes` 무회귀 확증** — Select/ComboBox 는 trigger button 을 Skia 로 렌더. spec 내부 `render.shapes(props, size, state)` 가 `props.items` 배열 길이/label 참조하면 타입 변경 영향 가능 → P2 작업 시 grep 으로 전수 점검, 참조 없으면 변경 불필요, 참조 있으면 new type 에 맞게 재작성
- **`_hasChildren` 분기** (`items` 존재 시 trigger-only 렌더) 로직 유지

### P3 — SelectionRenderers wiring + 선택 상태 items[] 재설계 (재설계됨)

**주의**: 파일은 `SelectionRenderers.tsx` (NOT `CollectionRenderers.tsx`).

변경 경로:

- `items` 배열 존재 시 RAC `<Select items={runtime}>{(item) => <SelectItem id={item.id}/>}` render function 경로 사용
- **Canonical selection contract (Codex 3차 리뷰 반영 — 고정)**:
  - RAC `<SelectItem id={item.id}>` — id 는 **항상 `StoredSelectItem.id`** (value 아님)
  - `element.props.selectedKey` ← `StoredSelectItem.id` 저장 (RAC 반환 키)
  - `element.props.selectedValue` ← `StoredSelectItem.value` 저장 (실제 데이터 값)
  - `element.props.inputValue` (ComboBox 전용) — **두 경우 구분 (Codex 4차 리뷰 반영)**:
    - **선택 상태** (selectedKey 존재): `inputValue = items.find(it => it.id === selectedKey)?.label` (derived value)
    - **미선택 + allowsCustomValue** (user typing, items 외 custom value): RAC `onInputChange` 로 들어온 raw 값 유지 (`SelectionRenderers.tsx:1176-1182` 현 동작 보존)
    - 전환 규칙: RAC `onSelectionChange` 발생 시 inputValue 를 items label 로 동기화 / `onInputChange` 발생 시 raw 값 그대로 저장. `allowsCustomValue: false` 일 때는 선택 상태만 허용
  - 기존 `selectedKey || selectedValue` fallback (`SelectionRenderers.tsx:1025`) 은 items SSOT 전환 후 **제거**. items 경로에서는 `selectedKey` 만 참조.
  - id !== value 인 경우에도 재선택/표시값 복원 예측 가능 (id 로 lookup, value 는 저장만)
- `react-aria-${index}` 역매핑 로직 **완전 불필요화** (id 가 `react-aria-N` 이 아닌 실제 id)
- `toRuntimeSelectItem` / `toRuntimeComboBoxItem` 변환 (onActionId → onAction 함수)
- 기존 element tree 의 SelectItem/ComboBoxItem children 은 **fallback 경로**로 유지 (P6 에서 소멸). items[] 존재 시 이 fallback 미사용.

**보존 필수 기능**:

- **Sub-element 관계**: `SelectionRenderers.tsx:649-665` 에서 Select 의 child element tree 에서 Label/SelectTrigger/SelectValue 읽어 label/placeholder 구성. items SSOT 전환 후에도 **이 sub-element 는 element tree 유지** (SelectItem/ComboBoxItem 만 items[] 로 흡수). P6 metadata 정리 시 Label/SelectTrigger/SelectValue entry 는 건드리지 않음.
- **columnMapping / PropertyDataBinding 우선순위 재결정**: shared `Select.tsx:145-162` / `ComboBox.tsx:145-163` 는 현재 `hasDataBinding` true 시 `boundData` 우선. 두 경로 중 선택:
  - (a) **현 동작 유지** — "dataBinding 우선, items fallback". ADR 본문/breakdown 문구 정정만 (이 경로 권장 — shared component 변경 0)
  - (b) **shared component 수정** — "items 우선, dataBinding fallback" 으로 역전. `Select.tsx`/`ComboBox.tsx` 의 `hasDataBinding` 분기 전환. 기존 dataBinding 사용자 영향 유의
- **ComboBox `allowsCustomValue` 저장 계약 (Codex 4차+5차 리뷰 반영 — 고정)**:

  **Stale selection 방지 — `onInputChange` 내 명시적 clear/reconcile 규칙 (5차 리뷰 추가)**:

  현재 `SelectionRenderers.tsx:1176-1182` 의 `onInputChange` 는 `inputValue` 만 갱신하고 `selectedKey/selectedValue` 는 건드리지 않음. 사용자가 **이미 선택된 item 의 텍스트를 수정하기 시작하면 stale selection 이 남음** (이전 selectedKey/selectedValue 가 inputValue 와 불일치한 상태로 잔존). 복원 시 `selectedKey` 우선 정책 → 사용자가 타이핑한 custom value 가 덮어씌워짐.

  ```ts
  // items SSOT 전환 후 P3 재설계 — onInputChange reconcile 로직
  onInputChange={(inputValue) => {
    // inputValue 와 정확히 일치하는 label 을 가진 item 탐색
    const matchedItem = runtimeItems.find(it => it.label === inputValue);
    updateElementProps(element.id, {
      ...element.props,
      inputValue,
      selectedKey: matchedItem?.id,      // 일치 시 id, 불일치 시 undefined
      selectedValue: matchedItem?.value, // 일치 시 value, 불일치 시 undefined
    });
  }}
  ```

  이 방식이 **RAC `onSelectionChange` / `onInputChange` 이벤트 순서에 무관하게 일관성 보장** — RAC 가 어떤 순서로 둘을 동작하든 최종 state 는 inputValue 와 items 의 label 일치 여부로 결정됨.

  **통합 저장 계약**:

  | 사용자 행동                                           | RAC 이벤트                                       | selectedKey | selectedValue | inputValue |
  | ----------------------------------------------------- | ------------------------------------------------ | ----------- | ------------- | ---------- |
  | Item A 선택 (dropdown click)                          | onSelectionChange(A.id) + onInputChange(A.label) | A.id        | A.value       | A.label    |
  | Custom text 타이핑 (allowsCustomValue:true, items 외) | onInputChange("custom")                          | undefined   | undefined     | "custom"   |
  | 타이핑 중 items 의 label 과 정확히 일치               | onInputChange(A.label) → reconcile               | A.id        | A.value       | A.label    |
  | Clear (X 버튼)                                        | onSelectionChange(undefined)                     | undefined   | undefined     | ""         |
  | `allowsCustomValue: false` + 미선택 + 타이핑          | RAC 가 input 블록 or 무효화                      | undefined   | undefined     | ""         |

  **복원 시점 (페이지 로드)**:
  - `selectedKey` 존재 → items lookup → `defaultSelectedKey={selectedKey}` + `defaultInputValue={matchedItem.label}` 렌더링
  - `selectedKey` 없고 `inputValue` 있음 (custom value) → `defaultInputValue={inputValue}` 만 렌더링
  - `allowsCustomValue: false` + `selectedKey` 없음 → default empty 상태

  Gate G2 실측 (Chrome MCP):
  1. item A 선택 → selectedKey/selectedValue/inputValue 동기화 확증
  2. 이어서 사용자가 inputValue 를 "custom" 으로 수정 → selectedKey/selectedValue undefined 확증 (reconcile)
  3. 페이지 새로고침 → custom value 복원 확증
  4. 다시 item B 선택 → selectedKey=B.id 동기화 + 이전 custom value 대체 확증

### P4 — ItemsManager 일반화 + Editors 전환 (재설계됨)

**명칭 구분 (CRITICAL)**:

- `ItemsManagerField` — `packages/specs/src/types/spec.types.ts` 의 properties field type **interface**
- `ItemsManager` — `apps/builder/src/builder/panels/properties/generic/ItemsManager.tsx` 의 React **component**
- Spec field type 문자열: `"items-manager"` (kebab-case)

**Store API 일반화 (Codex 리뷰 반영 — 필수 선행 작업)**:

- **경로 정정 (Codex 3차 리뷰)**: `packages/shared/src/stores/elements.ts` 는 **존재하지 않음**. 실제 store 위치는 `apps/builder/src/builder/stores/elements.ts:210, 1461`
- `apps/builder/src/builder/stores/elements.ts` 에 tag-agnostic 액션 신규 추가:
  ```ts
  addItem: async (elementId: string, itemsKey: string, item: Record<string, unknown>) => { ... }
  removeItem: async (elementId: string, itemsKey: string, itemId: string) => { ... }
  updateItem: async (elementId: string, itemsKey: string, itemId: string, patch: Record<string, unknown>) => { ... }
  ```
- 기존 `addMenuItem`/`removeMenuItem`/`updateMenuItem` 은 이 일반 액션의 thin wrapper 로 리팩토링 (Menu 회귀 0)
- `menu.tag !== "Menu"` early return 제거

**ItemsManager 컴포넌트 tag-agnostic 변환**:

- `ItemsManager.tsx:168-184` 의 하드코딩된 `useStore.getState().addMenuItem(...)` 호출을:
  ```ts
  useStore.getState().addItem(elementId, itemsKey, field.defaultItem);
  ```
  로 교체 (`itemsKey` 는 이미 props 로 받음)
- 3 handler 모두 동일 패턴 적용

**Editors 전환**:

- `SelectItemEditor` / `ComboBoxItemEditor` 제거
- Select.spec / ComboBox.spec 의 properties 섹션에 `type: "items-manager"` field 추가 → `SpecField.tsx` 가 자동으로 일반화된 `ItemsManager` 호출 → Select/ComboBox 도 정상 작동
- Property Panel UX 일관성 (Menu/Tabs 와 동일 편집 경험)
- **Menu 회귀 검증** 필수 — `addMenuItem` wrapper 가 기존과 동일 결과

### P5 — Data migration (경로 정정)

**런타임 레벨**:

- 기존 저장된 element tree 의 SelectItem/ComboBoxItem children → Select/ComboBox.items[] 로 변환
- `migrateSelectItemsToArray` / `migrateComboBoxItemsToArray` 유틸 신설 (`packages/shared/src/utils/migrateSelectComboBoxItems.ts`)
- 마이그레이션 실행 시점: 프로젝트 로드 시 자동 실행 + 1회 flag (`migrated_at` 기록)

**DB 레벨 (경로 재결정 — Codex OQ 반영)**:

- 저장소에 `./supabase/` 디렉토리 **부재**. composition 의 기존 migration 위치는 `./docs/migrations/` (현재 `001_g1_g2_data_model.sql` 1 파일만).
- ADR-068 Menu items SSOT 선례 확인 결과 DB migration 파일 신설 0 (런타임 마이그레이션만 수행)
- 본 ADR-073 에서 두 경로 중 선택 (P5 착수 시 확정):
  - (a) **런타임 마이그레이션 + 명시적 orphan delete (히스토리 비기록)** (Codex 3차+4차 리뷰 반영):
    - 프로젝트 로드 시 element tree → items[] 변환 (부모 `props.items` 업데이트)
    - **즉시 후속 단계**로 자식 row 명시 삭제 — 단 **`removeElements(...)` 직접 호출 금지**. 이유: `apps/builder/src/builder/stores/utils/elementRemoval.ts:183-194` 가 내부에서 `historyManager.addEntry({ type: "remove", ... })` 수행 → 마이그레이션이 undo 스택 오염
    - **대응 방안 (P5 착수 시 택일)**:
      - (a-1) **`removeElementsSilent(ids)` 유틸 신설** — `removeElements` 로직에서 `historyManager.addEntry` 호출 제외한 버전. migration 전용
      - (a-2) **`removeElements(ids, { skipHistory: true })` 옵션 추가** — 기존 함수에 migration mode guard. Menu-items 마이그레이션에도 향후 재사용 가능
      - 권장: (a-2) — 함수 일원화 + 일반화 가능. P5 구현 시 확정
    - 근거: 현 저장 경로 (`elementUpdate.ts:286-295` + `ElementsApiService.ts:200`) 는 부모 props 업데이트만 수행하고 자식 row 삭제 로직 **없음**. "다음 save cycle 에서 cleanup" 가정은 오류 — 명시적 삭제 단계 필수. 그리고 그 삭제는 반드시 **히스토리 비기록** 모드여야 undo 스택 보존
    - ADR-068 Menu 선례 정확 검증 필요 (MenuItem 의 경우 자식 row 가 남아 있는지, 아니면 별도 삭제 수행했는지, 수행했다면 히스토리 모드)
  - (b) **`docs/migrations/00N_select_combobox_items_backfill.sql` 신설** — 서버 측 일괄 정리 (Supabase SQL editor 로 수동 실행). backfill SQL 에 `DELETE FROM elements WHERE tag IN ('SelectItem','ComboBoxItem') AND parent_id IN (...)` 포함
- rollback 경로: backup snapshot + `migrated_at` flag 기반 역방향 변환 유틸

### P6 — SelectItem / ComboBoxItem element 소멸 (범위 확장 — Codex 리뷰 반영)

metadata + editor 만 지우는 수준이 아니라 **Factory / Hierarchy / canvas utils 3 파일 연쇄 수정** 필수:

1. `packages/shared/src/components/metadata.ts` — SelectItem/ComboBoxItem entry 제거 (Label/SelectTrigger/SelectValue entry 유지)
2. `apps/builder/src/builder/panels/properties/editors/SelectItemEditor.tsx` + `ComboBoxItemEditor.tsx` — 파일 삭제
3. **`apps/builder/src/builder/factories/definitions/SelectionComponents.ts:87, 215`** — Select/ComboBox factory 에서 SelectItem/ComboBoxItem child 자동 생성 블록 제거 + 기본 `items[]` prop 에 default items 2~3 개 삽입 (대체)
4. **`apps/builder/src/builder/utils/HierarchyManager.ts:402-409`** — Select/ComboBox tag 분기 제거 or items[] 기반 재작성. 현재는 `children.filter(c => c.tag === "SelectItem")` 반환 → items[] 기반에서는 `element.props.items` 읽음
5. **`apps/builder/src/builder/workspace/canvas/layout/engines/utils.ts:1978-1983`** — `SELECT_HIDDEN_CHILDREN` Set 에서 SelectItem/ComboBoxItem 제거 (ListBoxItem 만 남김 — ADR-074 전)
6. store validation — element tree 의 SelectItem/ComboBoxItem 허용 중단

**Menu 회귀 검증**: P6 변경이 Menu 관련 Factory/Hierarchy/canvas utils 를 건드리지 않는지 grep 확증.

### Bonus — ADR-070 Negative 연관 이슈: `renderMenu` wiring

- `packages/shared/src/renderers/CollectionRenderers.tsx:751` (NOT :761) `renderMenu` 가 `element.props.selectionMode / selectedKeys / onSelectionChange` 를 `<MenuButton>` 에 미전달
- 본 ADR scope 포함 (별도 commit 으로 분리 — scope 추적 용이)
- 수정 내용: `<MenuButton>` 에 3 props 추가 + `onSelectionChange` 콜백이 `updateElementProps` 로 `selectedKeys` 동기화

## 영향 범위 (Codex 리뷰 후 확장)

| 영역                      | 파일                                                                        | 변경                                                                                                                                                                    |
| ------------------------- | --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Types                     | `packages/specs/src/types/select-items.ts`                                  | 신설 (Stored/Runtime interface + toRuntime 함수)                                                                                                                        |
| Types                     | `packages/specs/src/types/combobox-items.ts`                                | 신설                                                                                                                                                                    |
| Types                     | `packages/specs/src/types/index.ts`                                         | re-export 추가                                                                                                                                                          |
| Spec                      | `packages/specs/src/components/Select.spec.ts`                              | `items` 타입 전환 + properties `items-manager` + render.shapes 타입 호환 점검                                                                                           |
| Spec                      | `packages/specs/src/components/ComboBox.spec.ts`                            | 동일                                                                                                                                                                    |
| **Renderer**              | **`packages/shared/src/renderers/SelectionRenderers.tsx`**                  | **renderSelect (L619) / renderComboBox (L882) wiring + 선택 상태 items[] 기반 재설계 (L795-812 / L1057-1075) + sub-element 보존 + dataBinding 경로 확정**               |
| **Renderer**              | **`packages/shared/src/renderers/CollectionRenderers.tsx`**                 | **Bonus: renderMenu (L751) 에 selectionMode/selectedKeys/onSelectionChange 전달 추가**                                                                                  |
| **Store (일반화)**        | **`apps/builder/src/builder/stores/elements.ts`** (Codex 3차 경로 정정)     | **L210, L1461-1463 근처 `addItem`/`removeItem`/`updateItem` tag-agnostic 액션 신설 + `addMenuItem` 등 thin wrapper 리팩토링 + `menu.tag !== "Menu"` early return 제거** |
| **ItemsManager (일반화)** | **`apps/builder/src/builder/panels/properties/generic/ItemsManager.tsx`**   | **L168-184 하드코딩 `addMenuItem` → `addItem(elementId, itemsKey, ...)` 로 교체**                                                                                       |
| Editors                   | `apps/builder/src/builder/panels/properties/editors/SelectItemEditor.tsx`   | 제거 (P4)                                                                                                                                                               |
| Editors                   | `apps/builder/src/builder/panels/properties/editors/ComboBoxItemEditor.tsx` | 제거 (P4)                                                                                                                                                               |
| Migration runtime         | `packages/shared/src/utils/migrateSelectComboBoxItems.ts`                   | 신설 (P5 runtime 레벨)                                                                                                                                                  |
| Migration SQL             | `docs/migrations/00N_select_combobox_items_backfill.sql`                    | (P5 선택) 신설 — 경로: `docs/migrations/` (NOT `supabase/migrations/`). ADR-068 선례는 런타임만 수행                                                                    |
| Metadata                  | `packages/shared/src/components/metadata.ts`                                | P6 — SelectItem/ComboBoxItem entry 제거 (Label/SelectTrigger/SelectValue 유지)                                                                                          |
| **Factory**               | **`apps/builder/src/builder/factories/definitions/SelectionComponents.ts`** | **P6: L87, 215 Select/ComboBox factory 의 SelectItem/ComboBoxItem child 자동 생성 블록 제거 + default `items[]` 2~3 개로 대체**                                         |
| **Hierarchy**             | **`apps/builder/src/builder/utils/HierarchyManager.ts`**                    | **P6: L402-409 Select/ComboBox tag 분기 items[] 기반 재작성 or 제거**                                                                                                   |
| **Canvas layout**         | **`apps/builder/src/builder/workspace/canvas/layout/engines/utils.ts`**     | **P6: L1978-1983 `SELECT_HIDDEN_CHILDREN` Set 에서 SelectItem/ComboBoxItem 제거 (ListBoxItem 만 유지)**                                                                 |

## Gate 기준 (확장)

| Gate           | 시점                         | 통과 조건                                                                                                                                                                                                                                                                                                                                      | 실패 시 대안                                                                      |
| -------------- | ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| **G1**         | P1~P2 완료 후                | `pnpm type-check` 3/3 + `CSSGenerator.snapshot` 무회귀 + Select/ComboBox spec `render.shapes(props, size, state)` 가 `props.items` 새 타입에 호환 (grep 전수 점검)                                                                                                                                                                             | 타입 미스 / snapshot 충돌 지점 식별 후 재조정                                     |
| **G2**         | P3 완료 후                   | Chrome MCP 실측: Select/ComboBox dropdown 옵션 목록 표시 + **선택 상태 올바른 value/id 반환 확증** (`react-aria-N` 내부 key 가 props 에 저장되지 않음) + placeholder + disabled 시각 ADR-073 이전과 동등. **Skia trigger button** 시각 불변. **ComboBox `allowsCustomValue`** 동작 보존. **dataBinding 우선순위 결정** 사항 Chrome MCP 로 검증 | RAC `<Select items>` API 재확인. `toRuntime` + id 설정 재설계                     |
| **G3**         | P4 완료 후                   | Store `addItem/removeItem/updateItem` 일반화 액션 단위 테스트 통과. **Menu 회귀 0** (`addMenuItem` wrapper 결과 identical). Property Panel `ItemsManager` 가 Menu/Select/ComboBox 모두에서 정상 작동. 구 에디터 코드 제거                                                                                                                      | Store API 설계 재검토                                                             |
| **G4**         | P5 완료 후                   | 기존 저장 프로젝트의 Select/ComboBox element tree → items[] 마이그레이션 단위 테스트 통과 + rollback 경로 검증. **경로 선택 기록**: 런타임만(a) or migration SQL(b) 중 확정                                                                                                                                                                    | 마이그레이션 실패 케이스 사용자 데이터 복구 절차 명시                             |
| **G5**         | P6 완료 후                   | Factory/Hierarchy/canvas utils 3 파일 수정 후 Chrome MCP: (1) 신규 Select 생성 시 SelectItem child 0 + default items[] 2~3 개 주입 / (2) 기존 Select 편집 시 자식 SelectItem element 가 레이어 패널에 없음 / (3) layout 계산이 items[] 수 기준. Menu 회귀 0                                                                                    | Factory default items 개수/값 재조정. Hierarchy 분기 items[] adapter 필요 시 추가 |
| **G6** (Bonus) | `renderMenu` fix commit 완료 | Menu 의 `selectionMode` / `selectedKeys` Inspector 변경이 inner Menu 에 정상 반영. `onSelectionChange` 콜백이 store 로 propagate                                                                                                                                                                                                               | `<MenuButton>` props wiring 재확인                                                |

## 금지 사항 (SSOT 보존)

- ❌ ListBox / ListBoxItem 수정 (ADR-074 scope)
- ❌ Menu/MenuItem 변경 (ADR-068 완료 영역). 단 `addMenuItem` → `addItem` wrapper 리팩토링은 허용 (회귀 0 보장)
- ❌ Tabs/Tab 변경 (ADR-066 완료 영역)
- ❌ 기존 Select/ComboBox 저장 데이터 호환성 파괴 (P5 마이그레이션 없이 P6 진행 금지)
- ❌ **`renderSelect`/`renderComboBox` 를 `CollectionRenderers.tsx` 에서 찾지 말 것** — 실제 위치는 `SelectionRenderers.tsx:619/882`
- ❌ Select 의 Label/SelectTrigger/SelectValue sub-element 를 items[] 에 흡수 (SelectItem/ComboBoxItem 만 흡수)
- ❌ ComboBox `allowsCustomValue: true` 동작 붕괴 (items 외 user input 값 허용 RAC 동작 보존 필수)
- ❌ `supabase/migrations/` 경로 사용 (저장소 부재). 필요 시 `docs/migrations/00N_*.sql` 신설
- ❌ `ItemsManager` 를 Menu 전용 가정 유지 (Codex 리뷰로 Menu 하드코딩 확증됨 — 일반화 필수)
- ❌ P6 에서 metadata + editor 만 정리 (Factory/Hierarchy/canvas 3 파일 동시 필수)

## 후속

- **ADR-074** (가칭): ListBoxItem.spec 신설 + ListBox skipCSSGeneration 해체 + Popover.spec variants.background 교정 (ADR-071 containerStyles 인프라 + ADR-073 items 패턴 재사용). ADR-073 의 store `addItem/removeItem/updateItem` 일반화 액션도 ListBox items 에 재사용.
- **renderMenu wiring fix** (Bonus): 본 ADR scope 포함 (위 Bonus Phase 참조)
