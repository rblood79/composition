# ADR-013 구현 상세 — Quick Connect Collection 데이터 바인딩 자동화

> 본 문서는 [ADR-013](../013-quick-connect-data-binding.md) 의 design breakdown 이다. 2026-07-16 Risk-First 재작성과 함께 원문(2026-03-02) 본문 인라인 구현 상세를 이관·정정했다. **원문 파일 목록·라인 번호 중 소멸분 (Pixi/spec/에디터 5종) 은 폐기됐고, 잔여 라인 번호도 Phase 0 재확정 대상이다.**
>
> **착수 조건 (G0)**: ADR-152 Implemented + 본 문서 §1 Phase 0 재-inventory 완료.

## §0. 재작성 요약 — 원문 대비 변경점

| 원문 (2026-03-02)                                         | 재작성 (2026-07-16)                                                                        | 사유                                                                     |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| Phase 1-A: spec placeholder 가 빈 상태 렌더 → 수정 불필요 | **Phase 0 실측 항목으로 전환** — catalog 경로의 빈 상태 Skia 렌더 동작 미확인              | ADR-142 로 컴포넌트당 spec 소멸 (`packages/specs/src/components/` 3개만) |
| Phase 1-B: PixiListBox/PixiList fallback 분기             | **폐기**                                                                                   | ADR-900 으로 파일 소멸                                                   |
| Phase 4: 에디터 6종에 개별 통합                           | **generic inspector 단일 통합** (`GenericFieldRenderer` `case "binding"` 표면)             | 에디터 5종 소멸, 패널이 catalog inspector 로 개편됨                      |
| 핵심 난관 #3: 3-Phase null-dataBinding 캐시 우회          | **Phase 0 판정 조건부** — 현행 캐시 로직에서 차단 재현 시에만 우회 설계                    | `TableRenderer.tsx:143-159` 캐시 clear 로직 재작성됨                     |
| 바인딩 기록 = `DataBindingValue` (source+name)            | **ADR-152 계약 v2** (`collectionId`+`fieldMap`) 기록 + preset schema 로 fieldMap 자동 채움 | ADR-152 선행 의존 (HC1)                                                  |
| Undo/Redo: `useStore.setState()` 직접 반영이라 미기록     | **Phase 0 실측 항목** — 현행 handler 는 `enqueuePreviewGeneratedElements` 큐 경유          | `useIframeMessenger.ts:767-782` 파이프라인 변경                          |

## §1. Phase 0 — 재-inventory (G0 구성 요소)

착수 직전 1회 실측하고 결과를 본 섹션에 기록한다 (freeze). 항목별 판정이 후속 phase 의 분기를 결정한다.

| #   | 실측 항목                                                                                                   | 방법                                                                                     | 분기                                                                                           |
| --- | ----------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| 0-1 | **빈 collection 6종의 Skia 렌더 동작** (R2) — factory 아이템 제거 시 캔버스에 무엇이 보이는가               | live builder 에서 6종 생성 → 자식 수동 삭제 → Skia 캔버스 관찰 (Chrome MCP)              | placeholder 부재 시 Phase 1 에서 Skia 빈 상태 표현 추가 (catalog/projector 경로)               |
| 0-2 | **TableRenderer 컬럼 캐시 재연결 차단 여부** (R3)                                                           | `TableRenderer.tsx:143-159` 현행 키 구성 분석 + 동일 source 다른 DataTable 재연결 실기동 | 차단 재현 시에만 우회 설계 (원문 3-Phase null 접근 재평가), 미재현 시 우회 없음                |
| 0-3 | **`enqueuePreviewGeneratedElements` 경로의 히스토리 기록 여부** (R4)                                        | `useIframeMessenger.ts:767-803` → enqueue 소비처 추적 → undo 실기동                      | 미기록이면 Quick Connect undo 범위 문서화 + 후속 통합 backlog 기재                             |
| 0-4 | **`ADD_FIELD_ELEMENTS` (ListBox field 자동 생성) 와 Quick Connect 의 관계**                                 | `useIframeMessenger.ts:786-803` + 트리거 조건 추적                                       | 중복 생성 위험 시 Quick Connect 가 해당 파이프라인을 그대로 활용 (원문 Table 결론과 동일 패턴) |
| 0-5 | **factory 기본 아이템 현행 목록** — 원문 표 (ListBoxItem×3/GridListItem×4/MenuItem×3/ComboBoxItem×1) 재확정 | `SelectionComponents.ts` / `NavigationComponents.ts` 정독                                | Phase 1 제거 대상 확정                                                                         |
| 0-6 | **ADR-152 v2 스키마 최종형** — `collectionId`/`fieldMap` 필드명·타입, `resolveBoundCollection` 시그니처     | ADR-152 Implemented 산출물 확인                                                          | Phase 2 hook 의 기록 형식 확정                                                                 |

## §2. 재사용 자산 (2026-07-16 실측 생존)

| 자산                                       | 위치                                                                                                                      | 용도                                                         |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| preset 시스템                              | `apps/builder/src/builder/panels/datatable/presets/` (`DATATABLE_PRESETS` / `PRESET_CATEGORIES` / `getPresetsByCategory`) | Quick Connect 팝오버의 preset 목록 + schema/샘플 데이터      |
| `DataTablePreset.schema: DataField[]`      | `presets/types.ts`                                                                                                        | **fieldMap 자동 채움** 의 입력 (label/description 역할 추정) |
| `createDataTable` / `deleteCollection`     | `apps/builder/src/builder/stores/data.ts`                                                                                 | DataTable 생성/롤백                                          |
| Inspector binding 표면                     | `panels/properties/generic/GenericFieldRenderer.tsx:187` `case "binding"` → `PropertyDataBinding`                         | Quick Connect 버튼 통합 지점 (PropertyDataBinding 상단)      |
| Popover + 검색 + 카테고리 리스트 참조 패턴 | `panels/events/pickers/ActionTypePicker.tsx`                                                                              | QuickConnectButton UI 구조 (flatMap 헤더 패턴)               |
| Column/Field 자동 생성 파이프라인          | `useIframeMessenger.ts:767` (`ADD_COLUMN_ELEMENTS`) / `:786` (`ADD_FIELD_ELEMENTS`)                                       | Table/ListBox 의 하위 요소 자동 생성 (재사용, 신설 금지)     |

## §3. Phase 계획

```
Phase 0 (재-inventory, G0) → Phase 1 (factory 빈 상태 + empty state, G1)
  → Phase 2 (useQuickConnect hook) → Phase 3 (QuickConnectButton UI + inspector 통합, G2)
  → Phase 4 (Table 특수 처리 — Phase 0-2 판정 조건부) → Phase 5 (closure, G3)
```

### Phase 1 — Factory 빈 상태 + Empty State (G1)

- **factory 기본 아이템 제거** (Phase 0-5 확정 목록 기준): `SelectionComponents.ts` (ListBoxItem/GridListItem/ComboBoxItem), `NavigationComponents.ts` (MenuItem). Select/ComboBox 의 구조적 자식 (Label/Trigger/Input) 은 유지. Table 은 원문 확인대로 이미 빈 구조.
- **DOM empty state**: `packages/shared/src/components/` 6종에 `renderEmptyState` 추가 — 현재 `TagGroup.tsx` 만 보유. 메시지 `"데이터를 연결하세요"` (`.collection-empty-state`, `@layer components`). Select/ComboBox 는 popup 내부 ListBox 에, Table 은 rows 0건 분기 placeholder row 에 적용 (원문 표 승계 — 라인 번호는 재확정).
- **Skia 빈 상태**: Phase 0-1 실측 결과에 따라 catalog/projector 경로에 DOM empty state 와 대칭인 표현 추가.
- **G1**: 6종 빈 상태 `/cross-check` PASS.

### Phase 2 — useQuickConnect hook

`apps/builder/src/builder/hooks/useQuickConnect.ts` 신규. 원문 설계 중 유효 승계분:

- stale closure 방지: async 내 `useDataStore.getState()` 사용
- 이름 고유성: `name.trim().toLowerCase()` 기준 중복 검사 → 충돌 시 suffix (`Users_2`)
- 롤백 계약 (R5): `prevBinding` 보존 → 기록 실패 시 ① `onDataBindingChange(prevBinding)` 복구 ② `deleteCollection(id)` — 두 단계 실패 시 console.error + Data 패널 수동 복구 가능 상태
- `preset === null` 이면 빈 테이블 생성
- 재실행 정책: 기존 DataTable 유지 + 새 DataTable 생성 + 바인딩 교체

재작성 신규분:

- **기록 형식 = ADR-152 계약 v2** (Phase 0-6 확정형): `collectionId` 필수 + `name`(fallback 호환) + **`fieldMap` 자동 채움** — preset `schema: DataField[]` 에서 label(첫 text 계열 필드)/description(둘째 text 계열) 역할 추정. 자동 추정이 불가한 스키마는 fieldMap 생략 (152 의 휴리스틱 fallback 동작).
- 기록 위치는 `props.dataBinding` 단일 (152 R6 정규화 준수 — legacy top-level 기록 금지).

### Phase 3 — QuickConnectButton UI + Inspector 통합 (G2)

- `components/property/QuickConnectButton.tsx` + `.css` 신규 — `DialogTrigger` + `Popover` (검색 input + "빈 테이블" 고정 옵션 + `PRESET_CATEGORIES` 그룹 리스트). `ActionTypePicker.tsx` 의 flatMap 헤더 + 검색 포커스 패턴 참조. preset `icon` 은 lucide 문자열 → 컴포넌트 매핑 (원문 `PRESET_ICON_MAP` 승계).
- **통합 지점 (원문과 상이 — 단일화)**: `GenericFieldRenderer.tsx` `case "binding"` 분기에서 `PropertyDataBinding` 위에 배치. 컴포넌트별 에디터 수정 없음 — catalog `kind:"binding"` 필드를 가진 모든 collection 컴포넌트에 자동 노출. `TableEditor.tsx` 가 별도 binding UI 를 가진 경우 동일 배치 (Phase 0 확인).
- barrel export: `components/property/index.ts` + `components/index.ts`.
- **G2**: 대표 3종 (ListBox/Table/Select) 1클릭 → live 데이터 렌더 + v2 바인딩 기록 확인.

### Phase 4 — Table 특수 처리 (Phase 0-2 판정 조건부)

- 재연결 시 기존 Column + ColumnGroup **전체 교체** (clean replace) — confirm 다이얼로그 "기존 컬럼을 새 스키마로 교체합니다" 후 삭제 → `ADD_COLUMN_ELEMENTS` 파이프라인이 신규 생성 (원문 정책 승계).
- 캐시 차단이 재현되면 (Phase 0-2) 그 시점의 현행 로직에 맞는 우회를 설계 — 원문 3-Phase null-dataBinding 접근은 **전제 소멸로 자동 승계 금지**.
- 차단 미재현 시 본 phase 는 confirm + 교체 로직만.

### Phase 5 — Closure (G3)

- Table 재연결 + 롤백 시나리오 실기동, 수동 바인딩 경로 회귀 0 확인.
- `pnpm type-check` + CHANGELOG (Features — 신규 사용자 가시 기능) + ADR Status 승격 + README 갱신.

## §4. 검증 시나리오 (G2/G3 세부)

1. 빈 컴포넌트 생성 → Skia/DOM 빈 상태 대칭 (`/cross-check`)
2. Quick Connect (preset) → DataTable 생성 + v2 바인딩 (`collectionId`+`fieldMap`) 기록 + 동적 아이템 렌더
3. Quick Connect (빈 테이블) → 빈 DataTable + 바인딩만
4. Table → Column 자동 생성 + 데이터 렌더, 재실행 시 confirm + 전체 교체
5. 동일 preset 2회 → 이름 고유성 (`Users`, `Users_2`)
6. 컴포넌트 삭제 → DataTable 보존 (HC2)
7. 기록 실패 강제 → prevBinding 복구 + orphan DataTable 0 (R5)
8. 기존 수동 `PropertyDataBinding` 경로 회귀 0 (HC3)
9. undo — Phase 0-3 판정 결과와 일치하는 동작 (기록 통합 또는 문서화된 범위)
