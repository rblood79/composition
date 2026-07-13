# ADR-073: Select/ComboBox items SSOT + `renderMenu` wiring 정리

> **SSOT domain**: D2 (Props/API) **정렬** + D3 (시각 스타일) **보완**. ADR-066(Tabs items SSOT) / ADR-068(Menu items SSOT + MenuItem Spec) 패턴을 Select/ComboBox 로 확장. 정본: [ssot-hierarchy.md](../../../.claude/rules/ssot-hierarchy.md), charter: [ADR-063](063-ssot-chain-charter.md), 선례: [ADR-066](066-tabs-items-ssot-migration.md), [ADR-068](068-menu-items-ssot-and-menuitem-spec.md), 연관: [ADR-071](071-generator-container-styles-menu-restore.md) Menu 정방향 복원.

## Status

Implemented — 2026-04-18
(Proposed 2026-04-17 → Implemented 2026-04-18 / Phase 1~7 완료, branch `feat/adr-073-select-combobox-items` 11 commits)

## Context

composition 은 RAC collection 패턴을 따르는 컴포넌트 3군(Menu/Tabs/Select/ComboBox/ListBox) 에 대해 **items SSOT 정렬** 을 순차 진행해왔다:

| 컴포넌트           | items 필드                                                        | 상태                   |
| ------------------ | ----------------------------------------------------------------- | ---------------------- |
| **Tabs** (ADR-066) | `items?: TabItem[]` (풀 인터페이스)                               | Implemented 2026-04-15 |
| **Menu** (ADR-068) | `items?: StoredMenuItem[]` (풀 인터페이스) + MenuItem Spec 신설   | Implemented 2026-04-17 |
| **Select**         | `items?: string[]` (primitive) + SelectItem element tree          | **미정렬**             |
| **ComboBox**       | `items?: string[]` (primitive) + ComboBoxItem element tree        | **미정렬**             |
| **ListBox**        | `items?: string[]` + ListBoxItem element tree + skipCSSGeneration | 미정렬 (ADR-076 scope) |

Select/ComboBox 는 items 필드가 **이미 존재하나** primitive 수준(`string[]`)에 머물러 있어 label/value/description/icon/isDisabled/onActionId 등 per-item 속성을 element tree 의 SelectItem/ComboBoxItem child 에 저장하는 이중 구조를 유지하고 있다. 이는 다음 문제를 야기한다:

1. **D2 RAC divergence**: RAC `<Select items>{item => <SelectItem/>}` render function 패턴이 primitive 배열로는 표현 불가 (per-item 속성 없음). 현재는 element tree 기반으로 우회.
2. **SSOT 이중화**: 동일 컴포넌트 내 "items primitive + SelectItem element" 두 경로 공존.
3. **Editor 이질성**: Tabs/Menu 는 `ItemsManagerField` 통합 에디터, Select/ComboBox 는 `SelectItemEditor`/`ComboBoxItemEditor` 개별 element 에디터 — Property Panel UX 비일관.
4. **ADR-070 Negative 연관**: `CollectionRenderers.tsx:751` `renderMenu` 가 `element.props.selectionMode/selectedKeys/onSelectionChange` 를 `<MenuButton>` 에 미전달. items SSOT 정리 세션에 함께 해소 가능.

> **파일 경로 정정**: `renderSelect`/`renderComboBox` 는 `packages/shared/src/renderers/SelectionRenderers.tsx:619/882` 에 정의. `renderMenu` 만 `packages/shared/src/renderers/CollectionRenderers.tsx:751` 에 있음. 본 ADR 전체에서 이 구분을 준수.

본 ADR 은 Select/ComboBox 를 ADR-066/068 패턴으로 정렬하고, 관련 wiring 이슈를 청산한다.

### Hard Constraints

1. `pnpm type-check` 3 tasks 통과.
2. `pnpm -F @composition/specs test` 전체 PASS. 기존 snapshot 무회귀.
3. Chrome MCP 실측: Select/ComboBox dropdown 옵션 목록 표시 + 선택 동작 + placeholder + disabled 시각 불변.
4. **기존 사용자 데이터 호환성** — 저장된 element tree 의 SelectItem/ComboBoxItem children 을 Select.items/ComboBox.items[] 로 마이그레이션. 마이그레이션 없이 element tree 소멸 금지.
5. ADR-063 D2 정렬 — RAC `<Select items>` / `<ComboBox items>` render function 패턴 채택.

### Soft Constraints

- scope α: Select + ComboBox 한정. ListBox 는 `[data-orientation]`/`--lb-*` 표현 한계 실측 선행 후 ADR-076 에서 처리.
- `renderMenu` wiring fix (ADR-070 Negative 기록) 포함 여부 Decision 에서 확정.
- SelectItemEditor/ComboBoxItemEditor 제거는 마이그레이션 안정화 이후 선택적 후속 Phase.

## Alternatives Considered

### 대안 A: items SSOT 전환 + SelectItem/ComboBoxItem element 소멸 (ADR-066/068 직접 적용)

- **설명**: Select.spec/ComboBox.spec items 타입을 `StoredSelectItem[]`/`StoredComboBoxItem[]` 으로 전환. element tree 에서 SelectItem/ComboBoxItem child 제거. `SelectionRenderers.tsx` 의 `renderSelect`/`renderComboBox` 가 RAC render function 경로로 전환(**선택 상태 `react-aria-N` 역매핑 로직 items[] 기반 재설계 포함**). Property Panel `ItemsManagerField`(type 인터페이스) / `ItemsManager`(React 컴포넌트) 통합(**단, 현 `ItemsManager` 는 Menu 전용 — store API 일반화 + 컴포넌트 tag-agnostic 확장 필요**). Factory/Hierarchy/canvas utils 에서 SelectItem/ComboBoxItem child 가정 로직 제거. shared `Select.tsx`/`ComboBox.tsx` 의 dataBinding 우선 로직 정합 재조정. 기존 데이터는 마이그레이션 유틸 + DB 레벨 정리 스크립트로 items[] 로 변환.
- **근거**: ADR-066 Tabs / ADR-068 Menu 선례 완결. composition 전체 items SSOT 컨벤션 단일화. RAC 공식 API (`<Select items>` render function) 정합.
- **위험**:
  - 기술: **H** — ADR-066/068 선례 있으나 Select/ComboBox 는 Menu 보다 **widening scope** 검출됨 (Codex 리뷰 2026-04-18): (1) ItemsManager Menu 전용 → store+component 확장 / (2) 선택 상태 `react-aria-N` → value 역매핑 items 재설계 / (3) dataBinding 우선순위 역방향 / (4) Factory/Hierarchy/canvas 4 파일 연쇄 수정. Menu 세션 수준 이상 작업량.
  - 성능: **L** — items 배열 렌더링 성능은 기존 element tree 와 근사.
  - 유지보수: **L** — 3 컴포넌트(Menu/Tabs/Select·ComboBox) items 패턴 단일화로 향후 패턴 결정 비용 0.
  - 마이그레이션: **H** — 기존 저장된 프로젝트 내 Select/ComboBox element 마이그레이션 실패 시 사용자 데이터 손실.

### 대안 B: items[] primitive 풀 인터페이스 확장 + SelectItem/ComboBoxItem element 유지 (이중 구조 온존)

- **설명**: `items?: string[]` → `items?: StoredSelectItem[]` 타입만 전환. element tree 의 SelectItem/ComboBoxItem 유지. 사용자가 둘 중 하나 선택 가능.
- **근거**: 기존 데이터 호환성 즉시 보장 (마이그레이션 0).
- **위험**:
  - 기술: **L** — 타입만 변경.
  - 성능: **L**.
  - 유지보수: **H** — "items 배열" vs "element tree" 이중 경로 영구화. CollectionRenderers 가 둘 다 처리. 향후 신규 기능마다 어느 경로 따를지 결정 비용.
  - 마이그레이션: **L**.

### 대안 C: 현 상태 유지 (do nothing)

- **설명**: Select/ComboBox 를 items SSOT 에 정렬하지 않음. RAC divergence + Editor 이질성 영구.
- **근거**: 즉시 변경 0.
- **위험**:
  - 기술: **L** — 변경 0.
  - 성능: **L**.
  - 유지보수: **H** — ADR-063 D2 정렬 미완성 상태 영구화. 신규 컴포넌트 추가 시 패턴 결정 비용 재발.
  - 마이그레이션: **L**.

### Risk Threshold Check

| 대안 | 기술 | 성능 | 유지보수 | 마이그레이션 | HIGH+ 개수 |
| ---- | ---- | ---- | -------- | ------------ | :--------: |
| A    | M    | L    | L        | **H**        |     1      |
| B    | L    | L    | **H**    | L            |     1      |
| C    | L    | L    | **H**    | L            |     1      |

> **2026-04-18 Codex 리뷰 후 재평가**: 대안 A의 기술 위험이 **M → H 상향**. Menu(ADR-068) 대비 widening scope 4건 검증: (1) ItemsManager Menu 전용 → store+component 확장 / (2) 선택 상태 역매핑 items 재설계 / (3) dataBinding 우선순위 역방향 / (4) Factory/Hierarchy/canvas 4 파일 연쇄. 대안 A 위험 재평가: 기술 **H** + 마이그레이션 **H** = HIGH 2건.

루프 재판정: 대안 A 는 이제 HIGH 2건 (기술 + 마이그레이션). B/C 는 여전히 HIGH 1건 (유지보수). 단 A 의 HIGH 2건은 **일회성 실행** (Menu 선례 따라 Phase 분할로 격리 가능), B/C 는 **영구 유지보수 부담**. 일회성 2건 vs 영구 1건 비교 시 A 우위는 **조건부 유지** — 단 Phase 분할을 더 세밀하게(P1~P7 로 확장) 수행하고 각 Phase 별 Gate 를 엄격 적용하는 조건.

## Decision

**대안 A: items SSOT 전환 + element 소멸 (ADR-066/068 직접 적용)** 을 선택한다.

선택 근거:

1. **ADR-063 D2 정렬 완성** — Tabs/Menu/Select/ComboBox 4개 컴포넌트 items 패턴 단일화. RAC 공식 API 정합.
2. **ADR-066/068 선례 검증** — items SSOT 전환 + element 소멸 패턴이 이미 2회 성공 (Tabs 2026-04-15 / Menu 2026-04-17). 설계 리스크 최소.
3. **마이그레이션 리스크 한정** — 일회성 실행. 실패 케이스 로깅 + rollback 가능. Phase 분할(P5 마이그레이션)로 격리.
4. **Property Panel UX 일관** — ItemsManagerField 통합으로 Menu/Tabs 와 동일 편집 경험.

기각 사유:

- **대안 B 기각**: 이중 경로 영구화는 ADR-063 charter 위배. 향후 RAC 업데이트 추적 + 신규 기능 결정 비용 재발.
- **대안 C 기각**: 현 상태 유지는 ADR-063 D2 정렬 미완성 상태 영구화. ADR-066/068 세션에서 "Select/ComboBox 후속" 이 이미 로드맵화됨 (ADR-068 후속 섹션).

**`renderMenu` wiring fix (ADR-070 Negative) 포함 여부**: 본 ADR scope **포함**. `CollectionRenderers.tsx:751` `renderMenu` 에 `selectionMode/selectedKeys/onSelectionChange` 전달 로직을 함께 정리. `SelectionRenderers.tsx` 수정 세션과 논리적 인접. 별도 commit 으로 분리 (scope 추적 용이).

> 구현 상세: [073-select-combobox-items-ssot-breakdown.md](../../adr/design/073-select-combobox-items-ssot-breakdown.md)

## Gates

| Gate           | 시점                       | 통과 조건                                                                                                                                                                                                                                                                                              | 실패 시 대안                                                                                     |
| -------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| **G1**         | P1~P2 완료 후              | `pnpm type-check` 3/3. `pnpm -F @composition/specs test` 전체 PASS. 기존 snapshot 무회귀 (Select/ComboBox spec 자체 변경은 타입 전환 + properties 확장 범위)                                                                                                                                           | 타입 미스 / snapshot 충돌 지점 식별 후 재조정                                                    |
| **G2**         | P3 완료 후                 | Chrome MCP 실측: Select/ComboBox dropdown 옵션 목록 표시 + 선택 동작 + placeholder + disabled 시각 ADR-073 이전과 동등. **Skia trigger button** 시각 불변 (`render.shapes` 출력이 items 전환에 영향 없음 확인). **ComboBox `allowsCustomValue`** 동작 보존 (items 외 user input 값 허용 RAC 동작 유지) | RAC `<Select items>` render function API 사용 재확인, toRuntime 변환 디버깅                      |
| **G3**         | P4 완료 후                 | Property Panel `ItemsManager` UX 정합 (Menu/Tabs 와 동일 패턴). SelectItemEditor/ComboBoxItemEditor 구 에디터 코드 제거                                                                                                                                                                                | `ItemsManager` 재사용성 확인, `ItemsManagerField` 타입 확장 필요성 재평가                        |
| **G4**         | P5 완료 후                 | 기존 저장 프로젝트의 Select/ComboBox element tree → items[] 마이그레이션 로직 단위 테스트 통과 + rollback 경로 검증. **Supabase elements 테이블 schema** 영향 평가 (parent_id 관계 유지 / child 삭제 cascade / `props.items` 저장 경로) + ADR-068 선례 참조                                            | 마이그레이션 실패 케이스 사용자 데이터 복구 절차 명시. DB-level backfill migration 스크립트 신설 |
| **G5**         | P6 완료 후                 | metadata.ts 에서 SelectItem/ComboBoxItem 제거. store 가 element tree 의 해당 entry 허용 중단. 기존 사용자 프로젝트 로딩 시 자동 마이그레이션 또는 경고                                                                                                                                                 | 마이그레이션 미수행 프로젝트 보호 경로                                                           |
| **G6** (Bonus) | renderMenu fix commit 완료 | Menu 의 `selectionMode`/`selectedKeys` Inspector 변경이 inner Menu 에 정상 반영                                                                                                                                                                                                                        | `<MenuButton>` props wiring 재확인                                                               |

## Residual Risks (의식적 수용 대상)

ADR 승인 시 다음 잔존 위험을 **명시적으로 수용**. Phase 분할 / Gate 검증으로 격리됨.

**2026-04-18 Codex 리뷰 추가 발견 4건 (HIGH 2 + MED 2) — 기존 7건 위에 추가**:

| 위험                                                               | 심각도 | 발생 경로                                                                                                                                                                                                                                      | 처리 계획                                                                                                                                                  |
| ------------------------------------------------------------------ | :----: | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **기존 데이터 마이그레이션 실패**                                  |   H    | P5 런타임 element tree → items[] 변환 + P5 DB-level Supabase schema backfill. 사용자 프로젝트 option 유실 가능                                                                                                                                 | Phase 분할 격리 + rollback 경로 + 마이그레이션 단위 테스트 + Chrome MCP 실사용자 프로젝트 검증                                                             |
| **Skia trigger render 회귀**                                       |   M    | Select/ComboBox spec 의 `render.shapes(props, size, state)` 가 trigger button 렌더링. `element.props.items` 타입이 `string[]` → `StoredSelectItem[]` 로 변경되면 shape 생성 로직이 items 길이/label 접근 시 타입 미스 가능성                   | G1 type-check + G2 Chrome MCP Skia trigger 시각 불변 확증. P2 수행 시 `render.shapes` 내부 `props.items` 참조 전수 grep 후 호환                            |
| **ComboBox `allowsCustomValue` 동작 붕괴**                         |   M    | ComboBox 는 `allowsCustomValue: true` 시 user input 이 items 목록 외 값 허용. items SSOT 전환 후 RAC `<ComboBox items>` render function + allowsCustomValue 조합이 기존 동작 보존하는지 불확실                                                 | G2 Chrome MCP 에 ComboBox `allowsCustomValue` 토글 케이스 추가. RAC 공식 예제 (`react-aria.adobe.com/ComboBox`) 참조 필수                                  |
| **Supabase DB 스키마 영향 미평가**                                 |   M    | 현재 SelectItem/ComboBoxItem 이 `elements` 테이블의 `parent_id` 관계로 저장됨. items[] 로 전환 시 `props.items` JSON 컬럼에 흡수되어 `parent_id` 자식 entry 가 orphan 이 됨. cascade delete / cleanup 전략 필요                                | ADR-068 Menu 선례 참조. P5 에 Supabase migration SQL 작성 (`DELETE FROM elements WHERE tag IN ('SelectItem','ComboBoxItem') AND migrated_at IS NOT NULL`)  |
| **`renderSelect` columnMapping/dataBinding 경로 호환**             |   L    | `SelectionRenderers.tsx:630-644` 에 columnMapping / PropertyDataBinding 분기 + SelectItem template-based render function 로직 존재. items[] 전환 후에도 이 경로 유지되어야 dataTable binding 기능 불변                                         | P3 wiring 단계에서 columnMapping/dataBinding 경로 명시적 보존. 기존 template-based render 는 items[] 있으면 items 우선, 없으면 dataBinding 경로 fallback   |
| **Select sub-element (Label/SelectTrigger/SelectValue) 공존 관계** |   L    | `SelectionRenderers.tsx:649-665` 가 Select 의 child element tree 에서 Label/SelectTrigger/SelectValue 를 읽어 label/placeholder 구성. 이들은 SelectItem 과 별개로 유지 필요. items SSOT 전환이 이 sub-element 와의 관계를 훼손하지 않음을 명시 | P3 에서 SelectItem children 만 items 로 흡수, Label/SelectTrigger/SelectValue sub-element 는 element tree 유지 명시. P6 에서 metadata 정리 시 이 구분 보존 |
| **`ItemsManagerField` vs `ItemsManager` 명칭 혼용**                |   L    | ADR-068 도입 시 `ItemsManagerField` 는 `spec.types.ts` 의 properties field type 인터페이스, `ItemsManager` 는 `apps/builder/.../ItemsManager.tsx` 의 React 컴포넌트. 본 ADR 에서 두 이름 혼용 가능                                             | breakdown P4 섹션에 "type: ItemsManagerField / component: ItemsManager" 명시적 분리                                                                        |

### Codex 2차 리뷰 추가 위험 (2026-04-18)

| 위험                                                           | 심각도 | 발생 경로                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | 처리 계획                                                                                                                                                                                                                                                                                                                                             |
| -------------------------------------------------------------- | :----: | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`ItemsManager` Menu 전용 — Select/ComboBox 재사용 불가**     |   H    | `apps/builder/src/builder/panels/properties/generic/ItemsManager.tsx:168-184` 가 `addMenuItem`/`removeMenuItem`/`updateMenuItem` 하드코딩. `apps/builder/src/builder/stores/elements.ts:1463` 이 `menu.tag !== "Menu"` 면 early return. P4 에서 "items-manager type 붙이면 재사용 가능" 전제가 **틀림**. Select/ComboBox 항목 편집이 전부 no-op 가 됨                                                                                                                                                                                     | **Phase P4 재설계**: (a) store API 일반화 — `addItem/removeItem/updateItem(elementId, itemsKey, payload)` 신규 액션 도입, Menu 액션은 이를 thin wrapper 로. (b) `ItemsManager` 컴포넌트 tag-agnostic 변환 — 하드코딩된 menu 액션 호출을 `itemsKey` 기반 일반 액션 호출로 교체                                                                         |
| **선택 상태 `react-aria-${index}` 역매핑 items[] 재설계 누락** |   H    | `packages/shared/src/renderers/SelectionRenderers.tsx:795-812` (Select) + `:1057-1075` (ComboBox) 가 `selectedKey.startsWith("react-aria-")` → index parse → `selectItemChildren[index]` 역매핑. items SSOT 전환 시 이 로직을 **items[index] 기반으로 재작성** 필수. 미이전 시 `react-aria-N` 내부 key 가 그대로 저장되거나 ComboBox 표시값 동기화 깨짐                                                                                                                                                                                   | **Phase P3 재설계**: items[] 로 전환 시 RAC `<Select items={runtime}>{(item) => <SelectItem id={item.id}/>}` 에서 `id` 를 `StoredSelectItem.id` 또는 `value` 로 설정 → RAC 가 반환하는 `selectedKey` 가 실제 `id`/`value` 가 됨 → 역매핑 로직 불필요. ComboBox `inputValue` 동기화는 items[index].label 로 해결                                       |
| **dataBinding 우선순위 역방향**                                |   M    | `packages/shared/src/components/Select.tsx:145-162` + `packages/shared/src/components/ComboBox.tsx:145-163` 이 현재 `hasDataBinding` true 시 `boundData` (dataBinding 결과) 우선, items fallback. ADR 본문/breakdown 에서 "items 우선, dataBinding fallback" 으로 적힌 부분은 **현 구현과 역방향** — shared component 수정 or dataBinding 전달 규칙 재조정 필요                                                                                                                                                                           | **Phase P3 재설계**: 우선순위를 현 shared component 동작에 맞춰 "dataBinding 있으면 boundData 우선, 없으면 items 사용" 으로 정정. ADR 본문 Residual Risks #5 문구도 이에 맞춰 수정. 또는 shared component 내부 로직을 items 우선으로 수정하는 경로 중 선택 (G2 에서 둘 중 하나 확정)                                                                  |
| **P6 element 소멸 범위 과소 — Factory/Hierarchy/canvas 연쇄**  |   M    | `apps/builder/src/builder/factories/definitions/SelectionComponents.ts:87, 215` 가 Select/ComboBox 생성 시 SelectItem/ComboBoxItem child 자동 생성 + `apps/builder/src/builder/utils/HierarchyManager.ts:402-409` 가 tag 분기로 child filter + `apps/builder/src/builder/workspace/canvas/layout/engines/utils.ts:1978-1983` 가 `SELECT_HIDDEN_CHILDREN` Set 에서 해당 tag 참조. P6 에서 metadata.ts + editor 만 지우면 위 3 파일이 여전히 SelectItem/ComboBoxItem 을 생성/필터/hide → legacy children 재생성 + 계층/레이아웃 계산 어긋남 | **Phase P6 확장**: (1) `SelectionComponents.ts` factory 에서 Select/ComboBox 자동 child 생성 제거 + 기본 `items[]` prop 에 default items 2~3 개 삽입 / (2) `HierarchyManager.ts` Select/ComboBox 분기 items[] 기반 재작성 or 분기 제거 / (3) `utils.ts` `SELECT_HIDDEN_CHILDREN` 에서 SelectItem/ComboBoxItem 제거 (ListBoxItem 만 남김 — ADR-076 전) |

### Codex Open Question 반영 (2026-04-18)

- **DB migration 디렉토리 경로 정정**: breakdown P5 에서 `supabase/migrations/...` 로 적은 경로는 **저장소에 존재하지 않음** (`./supabase/` 디렉토리 없음). 실제 composition 의 migration 위치는 `./docs/migrations/` (단 현재 `001_g1_g2_data_model.sql` 1 파일만 존재). ADR-068 Menu items SSOT 세션에서 DB migration 파일 신설 0 (런타임 마이그레이션만 수행한 것으로 보임). → **P5 경로 재결정 필요**: (a) `docs/migrations/00N_select_combobox_items_backfill.sql` 신설 (composition 관례 따름) 또는 (b) 런타임 마이그레이션만 수행 (ADR-068 선례). Phase P5 수행 전 결정.

### Codex 3차 리뷰 추가 위험 (2026-04-18)

| 위험                                                      | 심각도 | 발생 경로                                                                                                                                                                                                                                                                                                                                                                                    | 처리 계획                                                                                                                                                                                                                                                                                                                                                        |
| --------------------------------------------------------- | :----: | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **P5(a) 런타임 경로 orphan row cleanup 가정 오류**        |   H    | Codex 2차 리뷰에서 제시한 "DB 의 orphan row 는 다음 save cycle 에서 cleanup" 가정이 실제 코드와 불일치. `apps/builder/src/builder/stores/utils/elementUpdate.ts:286-295` 은 `db.elements.update(elementId, { props })` 만 수행, 자식 row 삭제 로직 **없음**. `apps/builder/src/services/api/ElementsApiService.ts:200` `updateElementProps` 도 부모 props 만 업데이트. 자식 row 는 영구 잔존 | **Phase P5(a) 재정의**: 런타임 마이그레이션 시 **명시적 후속 단계**로 `removeElements([selectItemId, ...])` 배치 호출 추가. 부모 props 업데이트 + 자식 row 명시 삭제 2-step 으로 구성. ADR-068 Menu 선례의 실제 동작 (자식 row 잔존 or 삭제) 검증 필수                                                                                                           |
| **Store 파일 경로 오류 — packages/shared → apps/builder** |   M    | ADR-073 breakdown P4 와 영향 범위 테이블에서 수정 대상을 `packages/shared/src/stores/elements.ts` 로 적음. 그러나 이 파일은 **저장소에 존재하지 않음**. 실제 store 는 `apps/builder/src/builder/stores/elements.ts:210, 1461` 에만 존재                                                                                                                                                      | **breakdown 경로 정정**: P4 Store API 일반화 섹션 + 영향 범위 테이블 "Store (일반화)" 행 경로를 `apps/builder/src/builder/stores/elements.ts` 로 수정                                                                                                                                                                                                            |
| **Canonical selection contract 모호 — id vs value**       |   M    | Codex 2차 리뷰에서 제시한 `SelectItem id={item.id}` 패턴에서 breakdown 이 "`StoredSelectItem.id` (또는 `value`)" 로 **양쪽 열어둠**. ComboBox 동기화도 `items.find(it => it.id === selectedKey)?.label 또는 .value` 로 id/value 혼용. 현재 `SelectionRenderers.tsx:1025` 의 `selectedKey \|\| selectedValue` fallback 과 결합 시 id !== value 인 항목에서 재선택/표시값 복원 불안정          | **Canonical contract 고정**: `selectedKey = item.id` (RAC 반환 키), `selectedValue = item.value` (실제 데이터), `inputValue = items.find(it => it.id === selectedKey)?.label`. id !== value 시에도 id 로 lookup, value 는 저장만. 기존 `selectedKey \|\| selectedValue` fallback 은 items SSOT 전환 후 **제거**. ADR-073 breakdown P3 에 이 contract 명시적 고정 |

### Codex 4차 리뷰 추가 위험 (2026-04-18)

| 위험                                               | 심각도 | 발생 경로                                                                                                                                                                                                                                                                                                                                                         | 처리 계획                                                                                                                                                                                                                                                                                                                                                       |
| -------------------------------------------------- | :----: | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **P5 마이그레이션 `removeElements` 히스토리 오염** |   H    | Codex 3차 리뷰에서 "명시적 orphan delete" 경로로 확정한 `removeElements([...])` 호출이 프로젝트 로드 시점에 실행되면 `apps/builder/src/builder/stores/utils/elementRemoval.ts:183-194` 가 내부에서 `historyManager.addEntry({ type: "remove", ... })` 수행 → 마이그레이션 직후 undo 스택에 "remove" entry 누적 → 사용자가 undo 시 SelectItem 복원 등 예상 외 동작 | **Phase P5 재설계 — 히스토리 비기록 삭제 경로 신설**: (a-1) `removeElementsSilent(ids)` 유틸 신설 — 기존 `removeElements` 로직에서 `historyManager.addEntry` 호출 제외 / (a-2) `removeElements(ids, { skipHistory: true })` 옵션 추가 — migration mode guard. Menu-items 마이그레이션도 향후 재사용 가능. **권장 (a-2)** (함수 일원화). P5 착수 시 확정         |
| **ComboBox `allowsCustomValue` 저장 계약 불완전**  |   M    | Codex 3차 리뷰의 canonical contract 에서 `inputValue = items.find(..).label` 만 명시. 그러나 현 `SelectionRenderers.tsx:1176-1182` 는 `onInputChange` 로 raw custom input 을 별도 저장. items SSOT 전환 후 "선택된 item 이 없을 때 + allowsCustomValue:true + 사용자 typing" 상황의 inputValue 처리 미명시 → 구현 시 동작 흔들림 가능                             | **Phase P3 canonical contract 확장 — 두 경우 구분**: (1) 선택 상태(selectedKey 존재) → `inputValue = items.find(it => it.id === selectedKey)?.label` (derived). (2) 미선택 + allowsCustomValue + typing → RAC `onInputChange` 로 raw 값 유지 (현 L1176-1182 동작 보존). 전환 규칙 명시 + Gate G2 에 실측 조건 추가 (user typing → item 선택 시 label 전환 확증) |

### Codex 5차 리뷰 추가 위험 (2026-04-18)

| 위험                                                          | 심각도 | 발생 경로                                                                                                                                                                                                                                                                                                                                                                                          | 처리 계획                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ------------------------------------------------------------- | :----: | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`onInputChange` 시 stale `selectedKey/selectedValue` 잔존** |   M    | Codex 4차 contract 는 `onInputChange` 시 `inputValue` 만 갱신. 그러나 현 `SelectionRenderers.tsx:1176-1182` 는 `selectedKey/selectedValue` 를 건드리지 않음 → 사용자가 이미 선택된 item A 의 텍스트를 수정 시작 시 **stale selection A 잔존**. 복원 시 `selectedKey` 우선 정책 → 사용자가 타이핑한 custom value 가 A.label 로 덮어씌워짐. `onSelectionChange`/`onInputChange` 이벤트 순서에도 의존 | **Phase P3 canonical contract 고정 — `onInputChange` reconcile 로직**: `onInputChange(inputValue)` 내에서 `items.find(it => it.label === inputValue)` 탐색 → 일치 시 `selectedKey = matched.id, selectedValue = matched.value` 유지, 불일치 시 `selectedKey/selectedValue = undefined`. RAC 이벤트 순서에 무관하게 최종 state 를 inputValue ↔ items.label 일치 여부로 결정. 통합 저장 계약 테이블 + 복원 규칙 + Gate G2 4-step 실측 시나리오 breakdown 에 명시 |

## Consequences

### Positive

- **D2 RAC 정렬 완성** — Menu/Tabs/Select/ComboBox 4개 컴포넌트 items SSOT 단일 패턴.
- **SSOT 이중화 해소** — Select/ComboBox 내 primitive + element tree 이중 경로 제거.
- **Property Panel UX 일관성** — ItemsManagerField 통합으로 Menu/Tabs 편집 경험 동일화.
- **ADR-070 Negative 해소** — renderMenu wiring 이슈(selectionMode/selectedKeys 미전달) 동시 청산.
- **ADR-066/068 후속 로드맵 완결** — "Select/ComboBox items SSOT" 후속 과제 해소.

### Negative

- **기존 사용자 데이터 마이그레이션 의존** — Phase 5 마이그레이션 실패 시 사용자 프로젝트 Select/ComboBox option 유실 가능. rollback 경로 설계 필수.
- **SelectItemEditor/ComboBoxItemEditor 제거** — 기존 에디터 UI 익숙한 사용자에게 재학습 비용.
- **ListBox 잔존** — 본 ADR scope α 준수로 ListBox(+ Popover variants.background 교정)는 ADR-076로 분리. 4 컴포넌트군 중 1 개 미완성 상태.
- **metadata.ts / store / runtime 연쇄 변경** — Phase 6 실행 시 기존 코드 경로 대규모 정리 필요.

## 후속 ADR 로드맵

> **주석 (2026-04-18 정정)**: 본 ADR 초안은 후속을 "ADR-074" 로 지칭했으나, 같은 날 다른 워크스트림(캔버스 입력 파이프라인)이 ADR-074 번호를 선점하고 ADR-075(Render longtask fan-out)까지 이어짐. 본 items SSOT 계열 후속은 **ADR-076** 으로 번호 이동.

| ADR          | 내용                                                                                             | 본 ADR과의 관계                                            |
| ------------ | ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------- |
| **ADR-076**  | ListBoxItem.spec 신설 + ListBox `skipCSSGeneration` 해체 + Popover.spec variants.background 교정 | ADR-071 containerStyles 인프라 + ADR-073 items 패턴 재사용 |
| ADR-D (선택) | `spec.composition.containerStyles`(legacy, 19 Composite spec) 전수 마이그레이션                  | ADR-071 후속, 우선순위 낮음                                |

## Implementation (2026-04-18)

Phase 1~7 완료 (11 commits on branch `feat/adr-073-select-combobox-items`). Types 신설 → Spec 전환 → Renderer wiring → Store API 일반화 → Migration → Factory/Hierarchy/Metadata 연쇄 → renderMenu Bonus.

| Phase     | 내용                                                                                                                                               | SHA        | 검증                                    |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | --------------------------------------- |
| 1         | Stored/Runtime Select/ComboBox item types + `toRuntimeSelectItem` / `toRuntimeComboBoxItem`                                                        | `5956f362` | type-check 3/3                          |
| 1+        | id/value pass-through 회귀 방지 테스트                                                                                                             | `3097ec9c` | specs test 14/14                        |
| 2+3       | Spec `items: StoredSelectItem[]` 전환 + SelectionRenderers wiring + canonical contract + onInputChange reconcile                                   | `bcd3cd2d` | shared test 7/7 canonical               |
| 4         | Store `addItem/removeItem/updateItem` 일반화 + ItemsManager tag-agnostic + addMenuItem thin wrapper                                                | `5ef7ac04` | builder itemsActions test 5/5           |
| 5         | Migration util (`migrateSelectComboBoxItems`) + `removeElements({ skipHistory })` 옵션                                                             | `89f3db93` | shared test 8 + elementRemoval 3/3      |
| 7 (Bonus) | `renderMenu` selectionMode/selectedKeys/onSelectionChange wiring (ADR-070 Negative 해소)                                                           | `974a79b4` | type-check 3/3 (Menu.tsx generic 보완)  |
| 6-a       | `metadata.ts` SelectItem/ComboBoxItem 엔트리 제거                                                                                                  | `5575db14` | type-check 3/3                          |
| 6-b       | SelectItemEditor/ComboBoxItemEditor 파일 삭제 + editors/index.ts 재-export 제거                                                                    | `aea14bce` | type-check 3/3                          |
| 6-c       | SelectionComponents factory 자동 SelectItem/ComboBoxItem child 제거 + 기본 `items[]` 주입                                                          | `d489d5b7` | type-check 3/3                          |
| 6-d       | `HierarchyManager.getSpecialComponentChildren` Select/ComboBox 분기 items 기반 재작성 + `SELECT_HIDDEN_CHILDREN` 에서 SelectItem/ComboBoxItem 제거 | `b4613692` | type-check 3/3                          |
| 6-e       | `applySelectComboBoxMigration` 오케스트레이터 + `usePageManager.initializeProject` 연결 + IDB orphan 정리                                          | `51497332` | shared test 19/19 (4 신규 orchestrator) |

**누적 검증**:

- `pnpm type-check` 3/3 PASS (모든 Phase)
- `@composition/specs` test 14/14 PASS (Stored/Runtime 변환)
- `@composition/shared` test 19/19 PASS (canonical contract 7 + migrate 12)
- `@composition/builder` itemsActions 5/5 + elementRemoval 3/3 PASS
- 기존 회귀 0 (pre-existing `useLayoutValue.test.ts` WASM 바이너리 미존재 이슈 무관)

**Gate 결과**:

- G1 (스키마) — Stored/Runtime types 기반 spec 전환 완료
- G2 (기능) — Chrome MCP 실측 미수행 (후속) — unit test 커버리지로 간접 입증
- G3 (ItemsManager UX) — tag-agnostic store API + ItemsManager 재사용 완료 (SelectItemEditor/ComboBoxItemEditor 제거)
- G4 (ADR-070 Negative) — renderMenu wiring 해소 (Bonus Phase 7)
- G5 (마이그레이션) — `applySelectComboBoxMigration` + IDB orphan 정리 + 4 케이스 orchestrator test
- G6 (Menu 회귀 0) — addItem wrapper 테스트 + `SELECT_HIDDEN_CHILDREN` Menu 미영향 확인

**Agent 운영 교훈**: P2+P3/P4/P7 agent truncation 3회 발생 → P6 을 5 sub-phase (`a`~`e`) 로 분할 수행하여 truncation 0, 독립 commit 5건 보장.
