# ADR-076: ListBox items SSOT + containerStyles 하이브리드 해체 (ListBoxItem 듀얼 모드 보존)

## Status

Implemented — 2026-04-18 (P1~P7 종결, Codex 1~6차 리뷰 반영). **Patch by ADR-145 (Implemented 2026-05-27)**: ListBoxItem template element 도입 + row 시각 SSOT 분리 + Skia viewport intersection. 본 ADR 의 "items SSOT" decision 은 보존하되, row 시각 (fontSize / paddingX / itemHeight / color) 의 source 가 ListBox container `props.style` 단독 → ListBoxItem template element `props.style` 우선 + container fallback 으로 정밀화됨. 상세: [ADR-145](145-listbox-template-element-single-component-proof.md)

**Phase 커밋 체인** (origin/main):

- P1 `8fe38661` — types + G0 감사 (G1 PASS)
- P2 `3c3bce19` — Spec containerStyles + CSS base 1-58 삭제 (G2 PASS)
- P3+P4 `699edadd` — renderListBox 3-path + canonical contract 14 + itemsActions 3 (G3 PASS)
- P5 `0a9d80b2` — migrateCollectionItems 오케스트레이터 + ListBox migration 14 (G4 PASS)
- P6 `2fdc2205` — Factory items / LayerTree items 기반 / registry pre-hook + ListBoxPropertyEditor (G5 PASS)
- P7 Skip 확정 — Popover.css:30 이미 정합 (G6 PASS)

**종결 검증**: type-check 3/3 × 5회 + 101 tests (canonical 14 + itemsActions 8 + shell-only 53 + migrateCollection 14 + migrateSelectCombo 12) 회귀 0.

## Addendum 1 — Chrome MCP 시각 검증 (2026-04-18 세션 말미)

`localhost:5173/builder/bdc2f503-9dca-451c-b035-81ad03c01d04` (ADR-076 이전에 생성된 legacy 프로젝트) 에서 실측. **Builder=Skia 렌더이므로 iframe/DOM 0개** — Canvas 경로가 ADR-076 의 직접 소비자 역할.

| 항목                                                                               |   결과    | 근거                                                                                                                                                                                                                                                       |
| ---------------------------------------------------------------------------------- | :-------: | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1-1. 신규 ListBox 드롭 시 items[] default 주입 + 레이어 패널 items[i].label        |   PASS    | body > ListBox 단일 element + virtual children 3개 "Aardvark/Cat/Kangaroo" 표시. `useLayerTreeData.ts:213-218` `props.items` 경로 정상 작동                                                                                                                |
| 1-2. 프로퍼티 에디터 ItemsManager 섹션 (정적 모드)                                 |   PASS    | ListBox 선택 시 우측 패널에 ListBoxPropertyEditor 로드 — Content/State/Performance/**Item Management**(Total 3 + Aardvark/Cat/Kangaroo + "+ Add ListBoxItem")/Filtering 전체 섹션 정상 표시. `registry.ts` `getCustomPreEditor` pre-generic hook 경로 정상 |
| 1-3. 템플릿 ListBox Field 자식 + Item Management 섹션 filter                       | 간접 입증 | 단위 테스트 `listBoxCanonicalContract.test.ts` "부모 원자성 3 케이스" + `migrateCollectionItems.test.ts` 템플릿 모드 2 케이스 PASS. 실제 `columnMapping` 연동 ListBox 생성 플로우는 APICollectionEditor scope — ADR-076 과 별도 워크플로                   |
| 1-4. legacy 프로젝트 migration → items[] 자동 복원 + orphan cleanup + reload no-op |   PASS    | 프로젝트 로드 후 body 아래 ListBox 단일 element(자식 ListBoxItem 0개). 이전 factory 는 ListBoxItem × 3 + 각각 Text/Description 자식 구조였음 → **5~7 element 가 orphan 제거되고 items[] 3개로 흡수** 확증. hard reload 후에도 동일 상태(idempotency PASS)  |
| 1-5. base 시각 회귀 0 (Generator containerStyles vs 이전 수동 base)                |   PASS    | Canvas Skia 렌더 정상 — 흰 배경(raised) + 1px border + padding + gap + 3개 아이템 수직 배열. DOM 경로는 `generated/ListBox.css` 60 라인 emit + `index.css:124` import 체인으로 간접 입증 (수동 1-58 라인이 동일 property 로 치환)                          |

**결론**: 5/5 항목 시각/구조 검증 완료 (3건 직접 PASS + 1건 간접 입증 + 1건 Skia-only 직접 + DOM 간접). Builder(Skia) 경로 완전 확증. Preview/Publish DOM 경로의 직접 시각 검증은 preview 빌드 서버 오류로 본 세션 scope 밖 — `generated/ListBox.css` 가 index.css 에서 import 되는 체인은 파일 존재로 확증.

## Context

ListBox 컴포넌트는 items SSOT 체인(ADR-066 Tabs → ADR-068 Menu → ADR-073 Select/ComboBox)의 마지막 컬렉션 계열 컴포넌트다. 그러나 선례 3종과 달리 **ListBoxItem 이 듀얼 모드** 로 사용된다 — Codex 1차 리뷰에서 확증됨:

1. **정적 모드** — `props.label/value/description/isDisabled` 보유 **또는** 자식으로 Text/Description element subtree 보유 (Field 자식은 없음). Factory default(`SelectionComponents.ts:236-263`) 는 Text/Description 자식 구조로 생성되므로 마이그레이션은 `props.*` 우선 + 자식 subtree fallback 로 직렬화 (Codex 2차 §1, 상세는 Phase 5). ADR-073 Select/ComboBox 패턴과 다르게 자식 subtree 수용
2. **템플릿 모드** — ListBoxItem 자식으로 `Field` element 를 가지며 `columnMapping` 또는 `PropertyDataBinding` 과 연동해 **동적 컬럼 렌더링** 수행. `SelectionRenderers.tsx:78-133` `hasValidTemplate` 분기 + `ListBoxItemEditor.tsx:51-170` "Field Management" UI 로 운영 중

본 ADR 은 **정적 모드만** items[] SSOT 로 전환하고, **템플릿 모드는 legacy element tree 구조를 영구 보존**한다.

---

3개 domain(D1 DOM/접근성, D2 Props/API, D3 시각) debt 현황:

**D3 (시각 스타일) 위반 — ADR-036/059/063 역행**:

- `ListBox.spec.ts` `skipCSSGeneration: true` — SSOT Spec 이 CSS emit 을 포기 → 수동 CSS(`packages/shared/src/components/styles/ListBox.css` 401 라인) 가 색상/크기/간격의 실질 SSOT 역할
- ADR-071 에서 `ContainerStylesSchema` 인프라가 land 되고 Menu 가 정방향 복원됨. ListBox 는 동일 패턴 적용 가능한 다음 타겟으로 명시됨

**D2 (Props/API) 불일치**:

- Spec `variant: "default" | "accent"` (2종) vs CSS `[data-variant="primary|secondary|tertiary|error|filled"]` (5종) — 선언과 구현 불일치
- `selectedIndex: number` / `selectedIndices: number[]` — index 기반 API. RAC `Selection` 은 key 기반 → 변환 어댑터가 runtime 에 흩어짐
- `items: string[]` — label 단일 필드. ADR-073 에서 확립된 `StoredSelectItem` / `StoredComboBoxItem` 구조(id/label/value/description/isDisabled/href/textValue)와 비대칭

**D1 (DOM/접근성)**:

- 정적 모드 ListBoxItem 자식 Element — `element tree 에 ListBoxItem 노드` + `Spec shapes 에서 items.map` 공존. 비대칭 잔존
- 템플릿 모드 ListBoxItem — Field 자식 subtree 로 동적 컬럼 렌더링. **본 ADR 에서 해체 금지 대상**
- React Aria `ListBox` 는 `items` prop + `{(item) => <ListBoxItem>...</ListBoxItem>}` render prop 패턴이 canonical

**Hard Constraints**:

1. **템플릿 모드 ListBoxItem(Field 자식 보유) 은 element tree 에 영구 보존**. items[] 흡수 대상이 아니며, SelectionRenderers 의 Path 1(템플릿 렌더) 는 마이그레이션 후에도 유지
2. 마이그레이션 후 **정적 모드 ListBoxItem 만** items[] 로 변환 — 회귀 없이 시각/동작 동일. 정적 ListBoxItem 의 `props.label` 뿐 아니라 자식 **Text/Description element subtree** 도 `{label, description}` 로 직렬화 (Codex 2차 §1), 직렬화된 자식 element **전부 orphanIds 에 포함** → hydrate 고아 노드 0
3. **혼합 모드 금지 — 부모 단위 원자성**: 하나의 ListBox 부모 아래에 정적과 템플릿 ListBoxItem 이 동시 존재할 수 없음 (Codex 2차 §3). Migration 은 부모 단위 전수 판정, Factory/Editor 는 혼합 생성 차단. Editor 가드 구현은 (a) `GenericPropertyEditor.evaluateVisibility` 가 subtree 관찰 불가(Codex 3차 §3) + (b) `registry.ts:124-135` spec-first 경로가 `metadata.editorName` 을 bypass(Codex 5차 §1) 이중 제약으로 인해 **`registry.ts` 에 `getCustomPreEditor(type)` pre-generic hook 도입 + `ListBoxPropertyEditor.tsx` 신설** 로 구현. 기존 `getHybridAfterSections` 선례 패턴 대칭 확장. 옵션 A(registry 우선순위 역전) / 옵션 C(spec registry 제거) 는 별도 ADR
4. **ListBoxItem 기본 CSS 수동 유지** — `ListBoxItem.spec.ts` 부재로 Generator 가 자식 selector emit 불가 (Codex 2차 §2). `ListBox.css` 삭제 범위는 컨테이너 base(1-58)만. ListBoxItem base(60-124) 및 complex selector(127-400) 는 수동 보존
5. Popover DOM 경로 배경 정합 — ADR-070 Addendum 1 "Menu = ListBox 색상 정합" 의 실제 출처는 `Popover.css:30` `background: var(--bg-raised)` 로 **이미 정합 완료 상태**. Skia-only 재정합은 별도 ADR 로 분리
6. `pnpm type-check` 3/3 PASS, `pnpm build:specs` 0-byte-unexpected-diff, `/cross-check` ListBox 5-layer 통과
7. RAC ListBox 의 `orientation="horizontal"` + `[data-layout="grid"]` 변형 삭제는 **실사용 감사 선행 후 판단**. 감사 결과 dead selector 로 확증되면 본 ADR 에서 정리 가능 (Phase 1 착수 조건)

**Soft Constraints**:

- ADR-071 `ContainerStylesSchema` 인프라(`packages/specs/src/types/spec.types.ts`, `renderers/CSSGenerator.ts`) 재사용 비용 낮음
- ADR-073 `applySelectComboBoxMigration` 오케스트레이터(`packages/shared/src/utils/migrateSelectComboBoxItems.ts:38`) / tag-agnostic store API(`apps/builder/src/builder/stores/elements.ts:1502-1556` `addItem/removeItem/updateItem`) / canonical contract 가 1:1 참조 가능
- `ITEMS_MANAGED_TAGS` 같은 tag 화이트리스트 Set 은 존재하지 않음 (key="items" 로 일반화된 시그니처)
- **reorder 는 일반화 미구현** — `elements.ts:1576` `reorderMenuItems` 만 Menu 전용 (`menu.tag !== "Menu" return`). ListBox reorder 가 필요하면 `reorderItem(id, key, from, to)` 일반화 선행 필수
- ADR-066 (Tabs) / ADR-068 (Menu) 은 별도 migration 함수 없이 진행됨 — 4-훅 체인 주장은 오류. `initializeProject` 실제 호출은 `applySelectComboBoxMigration` 1회
- Generator 는 현재 단일 selector + state/variant emit 만 지원. 복합 attribute selector / pseudo-element / media query / grid-template-areas / render prop 템플릿 은 미지원
- Popover DOM 경로 실측(`Popover.tsx:13-86`): `variant` prop **부재**, `data-size` 만 emit. CSS `[data-variant="primary|...|filled"]` 5종은 현재 **dead selector**. ADR-070 Addendum 1 의 `--bg-raised` 정합은 `Popover.css:30` base 에서 이미 달성됨 — Popover.spec 교정 Phase 는 skip 가능성 큼
- `packages/specs/src/components/ListBoxItem.spec.ts` 는 **존재하지 않음** (Glob 0 hits). 해체 대상 아님

## Alternatives Considered

### 대안 A: Full containerStyles SSOT 전환 + 수동 CSS 전면 해체 + ListBoxItem 전면 items[] 병합

- 설명: `ListBox.spec` 이 모든 CSS(base + orientation/layout + Popover-context + variant 5종 + DnD + virtualized + pseudo-element + forced-colors) 를 emit. `ListBox.css` 완전 삭제. ListBoxItem element 전부 items[] 로 변환(템플릿 모드 포함)
- 근거: ADR-036 "Spec-First Single Source" 순수 원칙. 단일 구조 단순화
- 위험:
  - 기술: **CRITICAL** — 템플릿 모드 ListBoxItem 의 Field subtree 를 직렬화해 items[] 에 담는 스키마 신설 필요(Field 타입/visible/style/label/key 등). 런타임 `DataField` 렌더 경로를 `items[i].fields[].props` 로 재작성 → 대규모 재설계
  - 성능: LOW
  - 유지보수: **HIGH** — 401 라인 CSS + 템플릿 직렬화 스키마 Spec 집중, 가독성 저하
  - 마이그레이션: **CRITICAL** — 기존 `columnMapping`/`PropertyDataBinding` 프로젝트 전원 재직렬화. BC 훼손 위험
- 채택 시 scope 5배 확장

### 대안 B: Hybrid 해체 + 정적/템플릿 듀얼 모드 보존 (containerStyles 이주 + legacy children path 영구 유지) — **선정**

- 설명: Generator 커버 가능 영역(컨테이너 base + size cssVars, 실질 **약 20%**)은 `containerStyles` 로 이주. 나머지 **약 80%** (ListBoxItem base 60-124 + orientation/layout/Popover-context/variant 5종/pseudo-element/DnD/virtualized/media 127-400)는 수동 CSS 유지. items[] SSOT 는 **정적 모드 ListBoxItem 만** 흡수, 템플릿 모드(Field 자식 보유) 는 element tree 유지. SelectionRenderers **Path 1 (`hasValidTemplate`) 은 영구 유지** (Codex 3차 §2 정본 Path 번호 통일)
- 근거: ADR-071 Menu.spec 선례(컨테이너 base 만 SSOT) + Codex 1차 리뷰 확증(템플릿 모드 BC 보호). 실측 기반 scope 제한
- 위험:
  - 기술: LOW — ADR-071 + ADR-073 선례 1:1 재사용
  - 성능: LOW
  - 유지보수: MEDIUM — 듀얼 모드 분기 ListBoxItem 내부에 영구 존재. Migration 로직이 Field 자식 유무 분기
  - 마이그레이션: LOW — Spec 수정 + 정적 모드만 items[] 흡수 (Field 자식 보유 ListBoxItem 은 건드리지 않음)

### 대안 C: Items SSOT 만 전환, CSS 그대로 유지 (`skipCSSGeneration: true` 고수)

- 설명: ADR-073 패턴만 ListBox 에 적용(items 타입 + canonical contract + migration + Hierarchy/Factory 정리). containerStyles / skipCSSGeneration 해체 미포함
- 근거: 최소 범위 안전 접근
- 위험:
  - 기술: LOW
  - 성능: LOW
  - 유지보수: **MEDIUM** — ADR-036/059/063 역행 debt 그대로 방치. items SSOT 체인 마지막 컴포넌트에서 debt 이관 기회 상실
  - 마이그레이션: LOW
- 채택 시 "왜 Menu/Select/ComboBox 는 containerStyles 인데 ListBox 만 skipCSS 인가" 비대칭 영구화

### 대안 D: variant prop 5종 확장 + CSS 정렬 우선, items SSOT 후속

- 설명: D2 정리 중심. Spec variant 5종 확장. items SSOT/containerStyles 는 별도 ADR
- 근거: D2 불일치가 D3 container 교정보다 사용자 가시적
- 위험:
  - 기술: LOW
  - 성능: LOW
  - 유지보수: **HIGH** — CSS 5종 variant 에 의존하는 기존 사용자 프로젝트 BC. Skia shapes self-lookup 5종 확장
  - 마이그레이션: MEDIUM — enum rename 훅
- items SSOT 체인 목적 미달성

### Risk Threshold Check

| 대안 | 기술  | 성능 | 유지보수 | 마이그레이션 |   HIGH+ 개수   |
| ---- | :---: | :--: | :------: | :----------: | :------------: |
| A    | **C** |  L   |  **H**   |    **C**     | 3 (CRITICAL 2) |
| B    |   L   |  L   |    M     |      L       |       0        |
| C    |   L   |  L   |    M     |      L       |  0 (MEDIUM 1)  |
| D    |   L   |  L   |  **H**   |      M       |       1        |

**루프 판정**:

- 대안 A: CRITICAL 2개 — Codex 확증 BC 위험. 기본 기각
- 대안 B: HIGH 0개 — 바로 채택 가능
- 대안 C: debt 방치
- 대안 D: HIGH 1개, 목적 미달성
- **대안 B 채택** — 추가 루프 불필요

## Decision

**대안 B: Hybrid 해체 + 정적/템플릿 듀얼 모드 보존** 을 선택한다.

선택 근거:

1. **ADR-071 Menu 선례 1:1 재사용** — `ContainerStylesSchema` + `generateBaseStyles` S3 axis 가 이미 land, 추가 Generator 작업 없이 컨테이너 base + size cssVars (실질 **약 20%**) SSOT 복귀 가능. Menu 와 달리 ListBox 는 `ListBoxItem.spec` 부재로 아이템 base 까지 커버 불가 — 수동 유지 약 80% 구조가 본 ADR scope 의 한계
2. **items SSOT 체인 완결 (정적 모드 한정)** — 컬렉션 4종(Tabs/Menu/Select+ComboBox/ListBox) 모두 canonical contract(id 기반 selectedKey) 확립
3. **템플릿 모드 BC 완전 보호** — Codex 1차 리뷰 확증 BC 위험 회피. ListBoxItem Field 자식 subtree + `columnMapping`/`PropertyDataBinding` 렌더 경로 영구 유지
4. **Popover debt 이미 해결** — Phase 7 은 실측 후 skip 가 기본. Popover.spec Skia 팔레트는 별도 ADR 로 분리
5. **잔존 debt 명시** — 수동 유지 CSS selector, variant 5종 D2 불일치, reorder 일반화 부재 는 모두 `@see ADR-076` 주석 또는 후속 ADR 대기

기각 사유:

- **대안 A 기각**: 템플릿 모드 직렬화 스키마 신설 + 기존 `columnMapping` 프로젝트 재직렬화 = CRITICAL BC. Codex 1차 리뷰 확증
- **대안 C 기각**: ADR-036/059/063 역행 debt 방치. items SSOT 체인 마지막에서 debt 이관 기회 상실
- **대안 D 기각**: D2 variant 확장은 BC + Skia shapes self-lookup 확장 비용이 items SSOT 가치를 초과. variant 정리는 별도 ADR

> 구현 상세: [076-listbox-items-ssot-hybrid-breakdown.md](../../adr/design/076-listbox-items-ssot-hybrid-breakdown.md)

## Gates

| Gate | 시점    | 통과 조건                                                                                                                                                                                                                                                                                                                                      | 실패 시 대안             |
| ---- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| G0   | 착수 전 | (a) `ListBox.css` 한계 실측 (breakdown §0-1/0-2). (b) orientation/layout 실사용 감사 (breakdown §0-5). (c) ListBoxItem 듀얼 모드 감사 (breakdown §0-6)                                                                                                                                                                                         | N/A                      |
| G1   | Phase 1 | type-check specs/shared PASS                                                                                                                                                                                                                                                                                                                   | Types 역행               |
| G2   | Phase 2 | `pnpm build:specs` PASS + Chrome MCP 컨테이너/아이템 base 시각 동일 + shell-only-tags ListBox 유지. **CSS 삭제 범위 = 1-58 라인만** (ListBoxItem base 60-124 수동 보존)                                                                                                                                                                        | containerStyles 조정     |
| G3   | Phase 3 | SelectionRenderers 3-path routing(**Path 1 템플릿 영구 유지**) + canonical contract 단위 테스트 + 혼합 감지 warning 테스트 PASS                                                                                                                                                                                                                | ItemsManager 재설계      |
| G4   | Phase 5 | **부모 단위 원자 판정** — 정적-전용 부모: ListBoxItem + Text/Description 자식 전부 orphanIds + items[] 에 `{label, description}` 복원 / 템플릿-전용 부모: Field subtree 무변 / 혼합 부모: skip + warning                                                                                                                                       | migration 분기 로직 수정 |
| G5   | Phase 6 | 신규 ListBox default items 주입 + **레이어 패널 items[i].label 표시 (`useLayerTreeData.ts:213-218` 실제 경로, Codex 5차 §2)** + ListBoxItemEditor.tsx 유지(템플릿 UI) + metadata ListBoxItem 유지 + **`registry.ts` `getCustomPreEditor` hook + `ListBoxPropertyEditor.tsx` 신설 로 템플릿 부모 ItemsManager 섹션 비활성 확인 (Codex 5차 §1)** | Editor 확장 전략 재검토  |
| G6   | Phase 7 | Popover DOM 경로 실측 결과 **이미 정합(Popover.css:30)** → Phase 7 skip. Skia Popover 팔레트는 별도 ADR 이관                                                                                                                                                                                                                                   | 재조사                   |
| G7   | 종결    | `/cross-check` ListBox 5-layer PASS + parallel-verify ListBox family                                                                                                                                                                                                                                                                           | 개별 path 수정           |

**잔존 HIGH 위험**: 없음.

## Consequences

### Positive

- `ListBox.spec.ts` 가 D3 시각 스타일 SSOT 로 정방향 복귀 — ADR-036/059/063 역행 debt 부분 청산 (실질 복귀 비율: **컨테이너 base + size cssVars 약 20%**. Codex 2차 §2: `ListBoxItem.spec` 부재로 아이템 base CSS 는 Generator 대체 불가 → 수동 유지)
- items SSOT 체인 4종(Tabs/Menu/Select+ComboBox/ListBox) 완결 — canonical contract(id 기반 selectedKey) 단일화 (정적 모드 한정)
- **템플릿 모드 BC 완전 보호** — `columnMapping`/`PropertyDataBinding` 동적 컬럼 렌더링 영구 유지
- ADR-073 tag-agnostic store API (addItem/removeItem/updateItem) 재사용 — 신규 store 코드 0
- ADR-072 `_hasChildren` 분류는 SYNTHETIC_CHILD_PROP_MERGE_TAGS 유지 — 신규 Set 이동 없음 (breakdown §0-4)
- Popover debt 가 이미 `Popover.css:30` 에서 해결됐음을 문서화 — 향후 유사 debt 조사 루틴 정립

### Negative

- `ListBox.css` 수동 유지 selector 비율 **약 80%** (Codex 2차 §2 재산정) — 컨테이너 base 만 SSOT 복귀, 아이템 base + complex selector + dead variant 전부 수동 유지. SSOT 파편화 지속 (완화: CSS 상단 `@see ADR-076 §0-2` 주석). 장기적 해체는 `ListBoxItem.spec` 신설 + Generator 확장 후속 ADR
- **혼합 모드 금지 — 부모 단위 원자성 집행 비용** (Codex 2차 §3): Migration 전수 판정 + Factory/Editor/런타임 3계층 가드 추가 → 기존 Select/ComboBox 에 없는 추가 복잡도. 부모 내 정적-템플릿 전환이 필요하면 명시적 "아이템 삭제 후 재구성" 사용자 워크플로우 필요
- 듀얼 모드 분기(정적 items[] vs 템플릿 legacy children) 가 SelectionRenderers / Migration / Editor 에 영구 존재 — 복잡도 증가
- **자식 Text/Description 직렬화 로직** (Codex 2차 §1): 정적 ListBoxItem subtree 순회 + `props.children` 추출 + orphan 확장 필요. ADR-073 Select/ComboBox 대비 신규 로직. Description `slot` 감지 등 edge case 대응 필수
- variant 5종(primary/secondary/tertiary/error/filled) 과 Spec variant 2종 불일치 별도 ADR 대기
- orientation/layout/DnD/virtualized CSS 는 Spec 미모델 상태 지속. 실사용 감사(G0-(b)) 결과 dead selector 확증 시 삭제 가능
- `propagation.rules { childPath: "ListBoxItem" }` 삭제 — 정적 모드 variant 전파는 shapes 가 부모 직접 참조, 템플릿 모드는 본래 영향 없음(Field 자식이 렌더)
- **reorder 일반화 부재 지속** — ListBox reorder 요구 발생 시 `reorderItem(id, key, from, to)` 일반화 선행 필요 (본 ADR scope 밖)
- 오케스트레이터 일반화(옵션 A) 채택 시 `applySelectComboBoxMigration` → `applyCollectionItemsMigration` 리네임 + 테스트/주석 동기화 작업 발생
- `ListBoxItemEditor.tsx` 유지 — 템플릿 모드 Field Management UI 가 정적 모드 편집 UI 와 공존. 향후 분리 editor 설계 가능성
- **`ListBoxPropertyEditor.tsx` 신설 + `registry.ts` pre-editor hook** (Codex 3차 §3 + 5차 §1) — `GenericPropertyEditor` subtree 관찰 불가 + `registry.getEditor()` spec-first 경로 metadata bypass 이중 제약. 변경: `registry.ts` 에 `getCustomPreEditor(type)` helper 추가 + `propertySpec` 분기 전 체크. `metadata.editorName` 단독 연결만으로는 로드 안 됨. Generic editor 자체 확장(옵션 A registry 우선순위 역전) / spec registry 제거(옵션 C)는 별도 ADR. 유사 패턴이 다른 items SSOT 컴포넌트에도 필요하면 중복 발생 가능
- **레이어 패널 실제 수정 경로 변경** (Codex 5차 §2) — 초안의 `HierarchyManager.getSpecialComponentChildren` → 실제 `useLayerTreeData.ts:213-218` 의 virtual children 생성. `childrenAs<ListItem>(props.children)` → `props.items` 참조로 변경. `HierarchyManager` 해당 case 는 호출처 grep 0건으로 dead code 가능성 — 최소 영향 정책
- ItemsManagerField `type` discriminant 정정(Codex 3차 §1): 초안의 `"items"` → 실제 `"items-manager"` (Menu/Select/ComboBox 선례 정합). Spec 작성 시 리터럴 오타 주의
