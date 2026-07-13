# ADR-099 구현 상세 — Collection Section/Header 확장 (ListBox/GridList/Menu)

> ADR-099 본문: [099-collection-section-expansion.md](../completed/099-collection-section-expansion.md)
>
> 본 문서는 ADR-099 Decision (대안 A — items discriminated union + Hybrid section 엔트리) 의 Phase 단위 실행 상세. ADR-098 감사 Charter 의 "098-c 슬롯" 구현.

## Scope 매트릭스

| 컬렉션   | 현재 items 타입       | Section spec 신설 | Header 처리                                                                        | 신규 기능                   |
| -------- | --------------------- | ----------------- | ---------------------------------------------------------------------------------- | --------------------------- |
| ListBox  | `StoredListBoxItem[]` | ✅ (렌더 분기)    | `{ type: "section", header: string, items: [...] }` 엔트리 내부 `header` 필드      | section 그룹화              |
| GridList | `GridListItem[]`      | ✅ (렌더 분기)    | 동일 discriminator 패턴 (+ grid columns 분기 section 행 span 처리)                 | section 그룹화 (stack/grid) |
| Menu     | `StoredMenuItem[]`    | ✅ (렌더 분기)    | 동일 + separator 재사용 검토 (RAC `Separator` 는 section 경계 기본 시각 구분 지원) | section 그룹화              |

> **참고**: RAC `ListBoxSection` / `GridListSection` / `MenuSection` 은 DOM tree 의 독립 element 이나, composition items SSOT 구조에서는 **items 배열의 discriminated union 엔트리**로 표현한다 (Hybrid 모델). 사용자에게는 LayerTree 에서 Section 을 별도 element 로 배치하는 대신 items-manager 편집기 내부에서 "Section 추가" 버튼으로 직렬화 — element graph 복잡도 증가 회피.

## Phase 구조

### Phase 0 — RAC 공식 재검증 + 설계 확정 (Completed 2026-04-21)

- [x] `https://react-aria.adobe.com/ListBox` WebFetch — ListBoxSection / Header props 수집
- [x] `https://react-aria.adobe.com/GridList` WebFetch — GridListSection / GridListHeader / GridListLoadMoreItem props 수집
- [x] `https://react-aria.adobe.com/Menu` WebFetch — MenuSection / SubmenuTrigger / Separator 동작 수집
- [x] 각 Section 의 nested section / Header 유형 확인
- [x] 설계 조정 발견 3건 반영 (아래 매트릭스)

#### RAC 공식 API 매트릭스 (2026-04-21 WebFetch)

| 컬렉션   | Section props                                                          | Header                                                            | Nested | 특이사항                                                                                                       |
| -------- | ---------------------------------------------------------------------- | ----------------------------------------------------------------- | :----: | -------------------------------------------------------------------------------------------------------------- |
| ListBox  | `title` / `id` / `items` / `children` / `aria-label`                   | `<Header>` 첫 자식 (sticky + elevated z-index), 또는 `aria-label` |   ❌   | 단일 level 만                                                                                                  |
| GridList | `aria-label` / `children` / `id` / `items` / className / style         | `<GridListHeader>` — 자동 `grid-column: 1 / -1` span              |   ❌   | `GridListLoadMoreItem` 은 **element composition** (items SSOT 외부) — 별도 Phase 또는 099-c 로 분리            |
| Menu     | `title` / `id` / `children` / **`selectionMode`** / **`selectedKeys`** | `<Header>` 첫 자식                                                |   ❌   | **per-section selectionMode/selectedKeys 지원** — discriminated union 에 추가 필드 필요. `Separator` 수동 삽입 |

#### 설계 조정 (Phase 0 산출)

**조정 1 — MenuSection per-section selection state**:

RAC `MenuSection` 은 section 레벨 `selectionMode` / `selectedKeys` / `defaultSelectedKeys` 를 지원한다. items SSOT discriminated union 에 반영:

```ts
export interface StoredMenuSection {
  id: string;
  type: "section";
  header: string;
  items: StoredMenuItem[];
  // ADR-099 Phase 0 조정: per-section selection (Menu 전용)
  selectionMode?: "none" | "single" | "multiple";
  selectedKeys?: string[];
  defaultSelectedKeys?: string[];
}
```

ListBox/GridList 는 per-section selection 미지원 → `StoredListBoxSection` / `StoredGridListSection` 은 selection 필드 제외.

**조정 2 — GridListLoadMoreItem 분리**:

`GridListLoadMoreItem` 은 `isLoading` / `onLoadMore` / `scrollOffset` 런타임 이벤트 기반 element composition 패턴. items SSOT discriminated union 과 호환 안 됨 (async callback state). **본 ADR scope 에서 제외** → 후속 ADR-099-c 로 분리. Phase 5 의 GridList 대칭 작업은 Section + Header 만 포함.

**조정 3 — Menu Separator entry**:

Menu 는 section 간 Separator 가 **자동 삽입되지 않음** (사용자가 수동 삽입). items-manager UI 에서 "Separator 추가" 버튼 지원을 위해 discriminated union 에 separator 엔트리 추가:

```ts
export interface StoredMenuSeparator {
  id: string;
  type: "separator";
}
export type StoredMenuEntry =
  | StoredMenuItem
  | StoredMenuSection
  | StoredMenuSeparator;
```

ListBox/GridList 는 Separator 미사용 → 추가 안 함.

**조정 4 — SubmenuTrigger 분리**:

`SubmenuTrigger` 는 `<MenuItem>` + `<Menu>` (Popover 내부) 2-자식 wrapper + `delay` 200ms. items SSOT 에서 중첩 Menu 는 별도 구조 필요 (Menu 가 자체 items 배열을 가짐). **본 ADR scope 외** — 후속 ADR-099-d (Menu overlay items 데이터 모델 ADR 와 연계).

#### 최종 Scope 확정 (Phase 0 → Phase 1+)

| 본 ADR (099) scope 내                                           | 분리 후속 ADR            |
| --------------------------------------------------------------- | ------------------------ |
| ListBoxSection + Header                                         | —                        |
| GridListSection + GridListHeader                                | —                        |
| MenuSection + Header + Separator 엔트리 + per-section selection | —                        |
| **GridListLoadMoreItem**                                        | **099-c (async 이벤트)** |
| **SubmenuTrigger**                                              | **099-d (중첩 Menu)**    |

### Phase 1 — items 타입 discriminated union (ListBox 파일럿) (Completed 2026-04-21 세션 8)

- [x] `packages/specs/src/types/listbox-items.ts` 확장:
  - `StoredListBoxItem` 에 optional `type?: "item"` discriminator 추가 (BC 보존)
  - `StoredListBoxSection { id, type:"section", header, items, ariaLabel? }` 신설 — RAC 단일 level (`items: StoredListBoxItem[]` 로 nested section 차단)
  - `StoredListBoxEntry = StoredListBoxItem | StoredListBoxSection` union
  - `isListBoxSectionEntry(entry): entry is StoredListBoxSection` type guard
- [x] `packages/specs/src/types/index.ts` export 확장: `StoredListBoxSection` / `StoredListBoxEntry` / `isListBoxSectionEntry`
- [x] `packages/specs/src/types/__tests__/listbox-items.test.ts` 신규 — 10 tests (union 타입 좁히기 4 + type guard 4 + runtime 변환 1 + mixed 2)
- [ ] `ListBoxProps.items` 타입: `StoredListBoxItem[]` → `StoredListBoxEntry[]` 확장 — **Phase 2 에서 수행** (shapes 루프 확장과 함께 land 하여 타입 drift 최소화)
- [ ] `toRuntimeListBoxItem` 확장: section 엔트리 flat 전개 헬퍼 — **Phase 2 에서 수행** (shapes 루프 내부 flatten 로직 공유)
- [x] BC 0% 확증: 기존 items 엔트리는 `type` 필드 없음 → `isListBoxSectionEntry` false 반환 → default item 해석. 회귀 테스트로 검증

**검증**: type-check 3/3 + specs **176/176** (166 → +10 신규) + shared 52/52 + builder 227/227 PASS.

**파일 변경 (3)**:

- `packages/specs/src/types/listbox-items.ts` (types 확장 + type guard)
- `packages/specs/src/types/__tests__/listbox-items.test.ts` (신규 테스트 파일, 10 tests)
- `packages/specs/src/types/index.ts` (export 확장)

### Phase 2 — ListBoxSpec.render.shapes section 렌더 (Completed 2026-04-21 세션 8)

- [x] `ListBoxProps.items` 타입 확장: `StoredListBoxItem[]` → `StoredListBoxEntry[]` (Phase 1 보류 항목 해소)
- [x] `ListBoxSpec.render.shapes` items 루프 재구성:
  - `entries` 변수 선언 (flatItems 와 분리)
  - `flatItems` 계산 — section 내부 items flat 전개 (selectedIdSet 검색용)
  - `selectedIdSet` 도입 — 기존 `selectedIndexSet` 대체, ID 기반 검색으로 section 내부 items 포함
  - `renderOneItem(item, y)` 헬퍼 추출 — 기존 인라인 로직을 entries 순회 내부에서 재사용
  - entries for 루프 — section entry 시 Header text shape + 내부 items 순회, non-section 시 renderOneItem 직접 호출
  - `hasRenderedEntry` 플래그로 첫 section 외 `SECTION_TOP_PAD` 가산
- [x] Header 시각 metric 인라인 상수:
  - `HEADER_HEIGHT = round(fontSize * 1.75)` — RAC 기본 sticky header 근사
  - `HEADER_FONT_SIZE = round(fontSize * 0.85)` — 작게
  - `SECTION_TOP_PAD = round(fontSize * 0.5)` — 섹션 간 여백
  - fontWeight 700, fill `{color.neutral-subdued}` — RAC 기본 muted header 스타일
- [x] `calculateContentHeight` (`apps/builder/src/builder/workspace/canvas/layout/engines/utils.ts:1512-1557`) listbox 분기 확장:
  - `isListBoxSectionEntry` import 추가
  - entries 순회로 `totalItems` + `sectionCount` + `nonFirstSectionCount` 집계
  - 공식: `paddingY*2 + totalItems*itemH + sectionCount*HEADER_HEIGHT + (entryCount-1)*gap + nonFirstSectionCount*SECTION_TOP_PAD + border*2`
  - `@sync ListBoxSpec.render.shapes` 주석 명시
- [ ] `resolveListBoxItemMetric` header height 추가 — **Phase 3 에서 HeaderSpec 신설 시 이관** (metric SSOT 를 HeaderSpec.sizes.md 에서 소유)
- [ ] Skia 렌더 + CSS emit 대칭 — `childSpecs` 에 `HeaderSpec` 추가는 **Phase 3** (Phase 2 는 Skia-only, 인라인 상수)

**검증**: type-check 3/3 (3.2s) + specs **176/176** (snapshot 변동 0 → BC 0% 확증) + builder 227/227 + shared 52/52 PASS.

**파일 변경 (2)**:

- `packages/specs/src/components/ListBox.spec.ts` — imports + items 타입 + shapes 재구성 (~60 LOC)
- `apps/builder/src/builder/workspace/canvas/layout/engines/utils.ts` — import + listbox 분기 entries 공식 (~30 LOC)

**BC 보장 증거**: snapshot 변동 0 — 기존 items 배열 (section 미사용) 의 shapes 출력 이전과 동일. BC 0% 확증.

### Phase 3 — Header Spec 신설 + CSS emit (Completed 2026-04-21 세션 8)

- [x] `packages/specs/src/components/Header.spec.ts` 신설:
  - RAC `<Header>` (slot="section-header") 대응
  - archetype: "simple" / element: "div" / skipCSSGeneration: true (childSpecs 경로 inline emit)
  - containerStyles: position:"sticky" + background:`{color.raised}` + text:`{color.neutral-subdued}`
  - sizes: sm/md/lg — fontSize (text-xs/text-xs/text-sm) + paddingY (4/6/8) + fontWeight 700 + borderRadius `{radius.none}`
  - states: {} (Header 정적 텍스트, hover/pressed/disabled 의미 없음 — 빈 객체로 선언)
  - render.shapes: () => [] (Skia 미등록 — ListBox spec shapes 가 Header text 직접 렌더)
  - react: `role: "presentation"` (RAC 공식)
- [x] `packages/specs/src/index.ts` export 추가 — `HeaderSpec` / `HeaderProps`
- [x] `ListBoxSpec.childSpecs` 에 `HeaderSpec` 추가 (`[ListBoxItemSpec, HeaderSpec]`):
  - Generator 가 `.react-aria-ListBox .react-aria-Header` 블록을 generated/ListBox.css 에 inline emit
  - 검증: `grep "react-aria-Header" packages/shared/src/components/styles/generated/ListBox.css` PASS — Base/size sm/size md/size lg 4 블록 emit
- [x] `TAG_SPEC_MAP` 등록 — **자동** (ADR-094 `expandChildSpecs` 가 `ListBoxSpec.childSpecs` 의 HeaderSpec 을 PascalCase key `"Header"` 로 `TAG_SPEC_MAP` 에 추가). 수동 등록 불요
- [x] `pnpm build:specs` 실행 — 117 CSS files 재생성 성공 + ListBox.css 에 Header 블록 추가 확인

**검증**: type-check 3/3 (3.7s) + specs **176/176** (snapshot 1 updated: ListBox generated CSS 에 Header 블록 추가) + builder 227/227 PASS. BC 영향 0% (기존 ListBox 프로젝트 렌더 무변경 — Header 블록은 section 엔트리 사용 시에만 시각 영향).

**파일 변경 (5)**:

- `packages/specs/src/components/Header.spec.ts` (신규)
- `packages/specs/src/index.ts` (HeaderSpec export 추가)
- `packages/specs/src/components/ListBox.spec.ts` (import + childSpecs 배열 확장)
- `packages/shared/src/components/styles/generated/ListBox.css` (Header 블록 자동 emit — build 산출물)
- `packages/specs/src/renderers/__tests__/__snapshots__/CSSGenerator.snapshot.test.ts.snap` (ListBox snapshot 갱신)

### Phase 4 — items-manager UI 확장 (section 엔트리) (Completed 2026-04-21 세션 9 — `b0cb9153`)

- [x] `ListBoxPropertyEditor.tsx` + `apps/builder/src/builder/panels/inspector/editors/items-manager/` 편집기 확장:
  - "Section 추가" 버튼 — discriminator `{ type: "section", header: "New Section", items: [] }` 삽입
  - Section 엔트리 UI: header 필드 + 내부 items drag-to-reorder
  - 기존 item 을 section 안으로 이동 지원 (tree-like nested 편집)
  - Menu 전용: per-section selectionMode/selectedKeys 편집 UI
  - Menu 전용: "Separator 추가" 버튼
- [x] `registry.ts getCustomPreEditor` — section 엔트리 인식 후 기존 하단 filter 섹션 유지
- [x] `useLayerTreeData.ts virtual children` — section 엔트리는 LayerTree 에 그룹 노드로 표시 (expand/collapse)

### Phase 5 — GridList / Menu 대칭 적용

> **Scope 조정 (2026-04-21)**: Menu 는 overlay popover 구조 — `render.shapes` 는 trigger button 전용이며 overlay 내부 DOM 렌더를 Skia shapes 로 표현하는 것은 별도 Phase 또는 Addendum 099-e (overlay Skia preview) 로 분리. Phase 5 의 Menu 작업 범위는 types / tests / childSpecs / index exports 준비 (shapes items 렌더 제외).

#### GridList (완료)

- [x] `packages/specs/src/types/gridlist-items.ts` 신설 (inline `GridListItem` 별도 파일 이동 + `StoredGridListSection` 추가)
- [x] `GridListSpec.render.shapes` section 렌더 — grid 모드에서 section header 전체 행 span + `isGridListSectionEntry` 분기
- [x] `GridListSpec.childSpecs` 에 `HeaderSpec` 추가 — Spec 계층 관계 SSOT 선언
- [x] `packages/specs/src/types/__tests__/gridlist-items.test.ts` 신설 — 13 tests PASS
- [x] `packages/specs/src/types/index.ts` + `packages/specs/src/index.ts` export 확장

#### Menu (완료 — shapes items 렌더는 overlay Phase 분리)

- [x] `packages/specs/src/types/menu-items.ts` 확장 — `StoredMenuSection` (per-section selection 3 필드) + `StoredMenuSeparator` + `StoredMenuEntry` union + `isMenuSeparatorEntry` type guard
- [x] `packages/specs/src/types/__tests__/menu-items.test.ts` 신설 — 16 tests PASS
- [x] `packages/specs/src/types/index.ts` + `packages/specs/src/index.ts` export 확장
- [ ] **[overlay Phase 분리]** `MenuSpec.render.shapes` section + separator 분기 — overlay 내부 Skia shapes 는 별도 Phase 또는 Addendum 099-e 로 분리. `SYNTHETIC_CHILD_PROP_MERGE_TAGS` / `SHELL_ONLY_CONTAINER_TAGS` 어느 쪽도 해당 안 되는 overlay 특수 구조임을 확인.

#### 공통

- [x] `pnpm build:specs` → CSS 재생성 117개 파일 PASS
- [x] `cd packages/specs && pnpm exec vitest run` → **205/205** PASS (신규 13 + 16 추가)

### Phase 6 — 검증 + 실측 (Completed 2026-04-21 세션 9)

- [x] `pnpm -w type-check` 3/3 PASS (2026-04-21)
- [x] `cd packages/specs && pnpm exec vitest run` **205/205** PASS (176 기존 + 13 gridlist + 16 menu)
- [x] `cd apps/builder && pnpm test -- --run` **227/227** PASS (2026-04-21)
- [x] `cd packages/shared && pnpm exec vitest run` **52/52** PASS (2026-04-21)
- [x] Preview 경로 ListBox section 분기 추가 (`SelectionRenderers.tsx`) — `isListBoxSectionEntry` 분기, `<AriaListBoxSection><AriaHeader>` RAC D1 공식 API 사용. R-A1 해소.
- [ ] Chrome MCP 실측 — Builder 에서 ListBox/GridList 에 section 엔트리 추가 → Skia 렌더 Header 표시 + Preview DOM 정합 **(후속 세션 재시도 — code-level 대체 적용)**
- [ ] `/cross-check` skill — ListBox/GridList 2 컬렉션 section 렌더 정합성 확인 (Menu shapes 는 overlay Phase 후)
- [x] Status: Proposed → Implemented 전환 + README.md 동기 갱신

**후속 분리 항목**:

- **Addendum 099-e**: `MenuSpec.render.shapes` section + separator 분기 (overlay Skia preview)
- **Addendum 099-f Part 1** ✅ **(완결 2026-04-21)**: GridList `SelectionRenderers.tsx` section 분기 (Preview DOM 경로). `renderGridList` 3-Path 구조 — Path 2 items[] canonical + `isGridListSectionEntry` 분기 + `<AriaGridListSection><AriaGridListHeader>`. R-A2 GridList 한정 해소.
- **Addendum 099-f Part 2** ✅ **(완결 2026-04-21)**: Menu `CollectionRenderers.tsx` `renderMenu` section/separator 분기 추가 — `hasStructuredEntries` 감지 → children 경로 (`AriaMenuSection` + `AriaMenuHeader` + `AriaMenuSeparator`) + items-only 기존 경로 BC 0% 유지. R-A2 Menu 한정 + R-A3 scope 축소 해소.

### Addendum 099-f Part 1 — GridList Preview 경로 section 분기 (2026-04-21)

- [x] `packages/shared/src/renderers/SelectionRenderers.tsx` — `renderGridList` 함수 확장:
  - RAC import 추가: `GridListSection as AriaGridListSection`, `GridListHeader as AriaGridListHeader`
  - specs import 추가: `StoredGridListItem`, `StoredGridListEntry` 타입 + `isGridListSectionEntry` type guard
  - `storedItems` / `hasItemsArray` 감지: `(element.props as { items?: StoredGridListItem[] }).items`
  - **3-Path 구조**:
    - Path 1 (기존 유지): 템플릿 모드 (`columnMapping` / `isPropertyBinding`)
    - Path 2 (신규): `hasItemsArray` → `renderGridListLeaf` 헬퍼 + section 분기
      - section entry → `<AriaGridListSection aria-label><AriaGridListHeader>{header}</AriaGridListHeader>{items.map(leaf)}</AriaGridListSection>`
      - item entry → `<GridListItem>` (label + description + isDisabled)
    - Path 3 (legacy fallback): 정적 `gridListChildren` (`context.renderElement`)

**검증**: type-check 3/3 PASS + shared 52/52 + specs 205/205 + builder 227/227 PASS.

## 반복 패턴 선차단 체크

- ✅ **#1 코드 경로 인용**:
  - `packages/specs/src/components/ListBox.spec.ts:396-452` — items 루프 (Phase 2 확장 대상)
  - `packages/specs/src/types/listbox-items.ts:14-26` — StoredListBoxItem 정의 (Phase 1 확장)
  - `packages/specs/src/components/GridList.spec.ts` + `Menu.spec.ts` — Phase 5 대칭
  - `apps/builder/src/layout/engines/utils.ts` (`calculateContentHeight` listbox 분기) — Phase 2 높이 공식
  - `packages/specs/src/renderers/CSSGenerator.ts` (`childSpecs` emit) — Phase 3 Header 셀렉터
- ✅ **#2 Generator 확장 여부**: Phase 3 에서 `HeaderSpec` 신설 + `ListBoxSpec.childSpecs` 에 추가 → Generator `childSpecs` inline emit 확장 경로 재사용 (ADR-078 Phase 2 선례). **지원 가능 확증**.
- ✅ **#3 BC 훼손 수식화**: **0% (BC 영향 없음)** — 기존 items 엔트리는 discriminator `type` 미지정 시 default "item" 으로 폴백. 기존 저장 프로젝트의 items 배열은 모두 호환. `applyCollectionItemsMigration` 오케스트레이터 확장 불필요.
- ✅ **#4 Phase 분리 가능성**: 6 Phase. 필요 시 Phase 5 (GridList/Menu 대칭) 를 별도 후속 ADR (099-a) 로 분리 가능. Phase 0-4 (ListBox 파일럿 + Header Spec) 를 먼저 land 하고 Phase 5 를 후속 세션에 이관하는 경로 허용.

## BC 호환성 계산

| 시나리오                            | 영향   | 비고                                                    |
| ----------------------------------- | ------ | ------------------------------------------------------- |
| 기존 ListBox items (section 미사용) | **0%** | discriminator 미지정 → default "item" 폴백              |
| 기존 GridList items                 | **0%** | Phase 5 도입 전까지 영향 없음                           |
| 기존 Menu items                     | **0%** | Phase 5 도입 전까지 영향 없음                           |
| 신규 section 사용 프로젝트          | 신규   | items-manager UI 에서 "Section 추가" 명시적 선택 시에만 |

**예상 재직렬화**: 0 파일 (기존 프로젝트 BC 100%).

## 관련 위험 (ADR 본문 Risks 재요약)

| ID  | 위험 요약                                                  | 심각도 |
| --- | ---------------------------------------------------------- | :----: |
| R1  | items discriminated union 타입 좁히기 누락 → runtime crash |  MED   |
| R2  | Skia Header 렌더 + CSS Header 셀렉터 시각 drift            |  MED   |
| R3  | GridList grid 모드 section header column span 복잡         |  MED   |
| R4  | items-manager UI nested 편집 UX 복잡                       |  MED   |
| R5  | RAC API 재검증 실패 (Phase 0)                              |  LOW   |

HIGH 위험 없음 — Phase 분할 + 각 Phase type-check/vitest gate 로 격리.

## 잠재 후속 ADR (본 ADR scope 외)

- **099-a (필요 시)**: Phase 5 분리 — GridList/Menu 만 별도 ADR (Phase 0-4 ListBox 먼저 완결 후 scope 분할)
- **099-b (Addendum 후보)**: Menu 기존 Separator spec (element) 와 discriminated union separator 엔트리 간 상호 운용 검토
- **099-c (GridListLoadMoreItem) — Phase 0 확정 분리**: `isLoading` / `onLoadMore` / `scrollOffset` async 이벤트 기반 element composition 패턴. items SSOT discriminated union 과 호환 불가 (async callback state) → 별도 ADR 필수
- **099-d (SubmenuTrigger) — Phase 0 확정 분리**: `<MenuItem>` + `<Menu>` 2-자식 wrapper + `delay` 200ms. 중첩 Menu 가 자체 items 배열 필요 → Menu overlay items 데이터 모델 ADR 와 연계 필수

## 2026-04-21 착수 기준선 (sanity)

```bash
pnpm -w type-check                                # 3/3 PASS (38ms FULL TURBO cached)
cd packages/specs && pnpm exec vitest run         # 166/166 PASS
cd apps/builder && pnpm test -- --run             # 227/227 PASS
cd packages/shared && pnpm exec vitest run        # 52/52 PASS
```

## 검증 체크리스트 (본 ADR 완료 기준)

- [x] Phase 0 RAC WebFetch 3 URL 매트릭스 완료
- [x] Phase 1 items 타입 discriminated union + 테스트 회귀 0
- [x] Phase 2 ListBoxSpec.render.shapes section 렌더 + calculateContentHeight 공식
- [x] Phase 3 HeaderSpec 신설 + childSpecs emit + TAG_SPEC_MAP 등록
- [x] Phase 4 items-manager UI "Section 추가" 작동
- [x] Phase 5 GridList/Menu 대칭 (또는 099-a 로 분리 land)
- [x] Phase 6 Preview ListBox section 분기 추가 + code-level 검증 PASS (Chrome MCP 후속 허용)
- [x] Status Proposed → Implemented + README.md 갱신
- [x] **Addendum 099-f Part 1**: GridList Preview 경로 section 분기 추가 + R-A2 GridList 한정 해소 (2026-04-21)
- [x] **Addendum 099-f Part 2**: Menu Preview 경로 — `CollectionRenderers.tsx` `renderMenu` section/separator 분기 추가. `isMenuSectionEntry` → `<AriaMenuSection><AriaMenuHeader>` + `isMenuSeparatorEntry` → `<AriaMenuSeparator>` + BC 0% items-only fallback 유지. R-A2 Menu 한정 + R-A3 scope 축소 해소 (2026-04-21)
