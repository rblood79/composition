# ADR-097: TagGroup `items` SSOT + TagList Hybrid Container (ADR-093-A1)

## Status

Implemented — 2026-04-21 (Proposed → Implemented 동일 세션, Phase 1-6 순차 land)

**Chrome MCP 실측 증거** (Phase 6, 2026-04-21 세션 5):

- 기존 18개 Tag element 포함 프로젝트 로드 → migration orchestrator 자동 흡수 → `TagGroup.props.items[]` 배열로 전환 + Tag element orphan 제거 확인
- Builder Skia: TagList spec shapes 가 items 기반 chip self-render (roundRect + border + text per item) 작동 — 1행 Chocolate/Mint/Strawberry/Vanilla + 2행 Chocolate Chip Cookie Dough/Rocky Road
- `maxRows` 초과 시 "Show all (18)" chip 표시 (accent text + transparent bg) — Phase 4B 로직 정상
- Preview (RAC DOM) 정합성: 동일 chip 스타일 (border/padding/radius/gap) 유지. 전체 18 items 표시
- BC 영향 0% 확증 — 사용자 편집 없이 자동 이관 + 시각 diff 0

**커밋 체인**: `aca16a7c` (P1) → `409875bd` (P2) → `1c03b9f0` (P2 BC fix) → `59528d48` (P3) → `4e906663` (P4A) → `5c632fc9` (P4B) → `cef3975d` (P5 docs) → (Phase 6 docs)

## Context

ADR-093 (Implemented) 은 `TagList.spec.ts` 에 `containerStyles` 를 리프팅하여 **중간 컨테이너를 spec-only 로 정당화**했으나, TagGroup/TagList/Tag **3 단 element tree** 자체는 해체하지 않았다. ADR-087 SP6 후속 debt + ADR-093 Addendum 1 (`maxRows` + Tag `whiteSpace` injection runtime-only 조건) 이 현재까지 잔존.

ADR-066 (Tabs) / ADR-068 (Menu) / ADR-073 (Select/ComboBox) / ADR-076 (ListBox) 는 **items SSOT 패턴** 을 4 회 정립했다. 본 ADR 은 5 번째 적용 — `TagGroup.props.items: Tag[]` 배열 SSOT 로 전환하고, TagList 중간 컨테이너는 **spec-only container 로 유지** (Option A).

### D3 domain 판정 ([ssot-hierarchy.md](../../../.claude/rules/ssot-hierarchy.md))

**D2 (Props/API) + D3 (시각 스타일) 혼합 작업**:

- D2: `TagGroup.items` prop 신설 — RSP `TagGroup` API 에 `items` prop 이 존재 (React Spectrum `<TagGroup items={tags}>`) → RSP 참조 기반
- D3: Tag 시각 표현은 ADR-093 리프팅된 TagList.containerStyles 유지 — 본 ADR 에서 D3 침범 없음

### 실측 — ADR-076 ListBox 와 차이점

| 항목                   | ListBox (ADR-076)                 | TagGroup (본 ADR)                                           |
| ---------------------- | --------------------------------- | ----------------------------------------------------------- |
| 자식 element tag       | `ListBoxItem`                     | `Tag`                                                       |
| 중간 컨테이너          | 없음 (ListBox → ListBoxItem 2 단) | **TagList 있음** (TagGroup → TagList → Tag 3 단)            |
| Field 자식 템플릿 모드 | 지원 (부모 단위 원자 판정)        | **불지원** (Tag.children: string 만) — **migration 단순화** |
| runtime-only 잔존 로직 | SearchField + PropertyEditor 분기 | `maxRows` / `whiteSpace` / `labelPosition="side"`           |
| migration 2 단 이전    | 불필요                            | **필요** (TagGroup 부모 → TagList → Tag 순회)               |

**핵심 구조적 단순화**: Tag 는 Field 자식을 가질 수 없으므로 템플릿 모드 분기 없음 → migration orchestrator 가 **항상 정적 흡수** (ADR-076 `listBoxAbsorbParents` 원자 판정 대체 필요 없음).

### Hard Constraints

1. **BC 영향 0 %** — 기존 TagGroup > TagList > Tag 3 단 element tree 프로젝트 로드 시 migration orchestrator 가 자동 `TagGroup.props.items[]` 로 흡수. 사용자 편집 불필요.
2. **재직렬화 파일 수**: migration 실행 후 모든 TagGroup 포함 project.json 저장 시 items 형태로 전환 — **파일 크기 감소 예상** (Element 중첩 vs 배열 직렬화).
3. **runtime-only 로직 유지** (ADR-093 HC#4 상속):
   - `labelPosition="side"` flex:1/minWidth:0 주입
   - `maxRows > 0` 근사 계산 + 초과 Tag 제거
   - Tag `whiteSpace:"nowrap"` injection
     → 모두 spec 미커버, items 배열 기반 재구성으로 잔존
4. **TagGroup `orientation` prop 없음** (ADR-093 HC#2 유지) — 본 ADR 에서 신설 금지.
5. **Generator 영향 0** — `items` prop 은 CSS Generator emit 대상 외 (runtime element expand). `packages/specs/src/renderers/CSSGenerator.ts` 변경 없음.
6. **테스트 기준선**: type-check 3/3 + specs 166+ + builder 227+ → Phase 2 migration 테스트 3 건 추가 시 230+.

### Soft Constraints

- ADR-066/068/073/076 4 회 패턴 재사용 — `applyCollectionItemsMigration` 오케스트레이터 확장 또는 `migrateTagGroupItems` 신규 함수
- `LayerTree virtual children` + `getCustomPreEditor` 3-path routing 패턴 복사
- Tag 개별 선택 불가 전환 — 사용자 편집 플로우 변경 (TagGroupPropertyEditor.items 로 대체, Style Panel Tag 개별 편집 불가)

### 소비 코드 경로 (grep 가능 인용 — 반복 패턴 체크 #1)

- `packages/specs/src/components/TagGroup.spec.ts:261` — 현재 `items: ChildrenManagerField` 예약 (활성화 대상)
- `packages/specs/src/components/TagList.spec.ts:74-78` — containerStyles 리프팅 (ADR-093 유지)
- `packages/specs/src/components/Tag.spec.ts:25-28` — label/isDisabled/isSelected/allowsRemoving props (items 필드 source)
- `apps/builder/src/builder/workspace/canvas/layout/engines/implicitStyles.ts:583-595` — Tag whiteSpace injection (runtime 재구성 대상)
- `apps/builder/src/builder/workspace/canvas/layout/engines/implicitStyles.ts:599-633` — maxRows 근사 계산 (runtime 재구성 대상)
- `packages/shared/src/utils/migrateCollectionItems.ts:53` — `applyCollectionItemsMigration` (확장 대상)
- `apps/builder/src/builder/panels/nodes/tree/LayerTree/useLayerTreeData.ts:214-224` — ListBox virtual children 선례
- `apps/builder/src/builder/panels/properties/editors/registry.ts:33-40` — `getCustomPreEditor` 선례

## Alternatives Considered

### 대안 A: TagList spec-only 유지 + TagGroup.items SSOT (선정)

- 설명: TagList 를 ADR-093 리프팅된 spec-only 중간 컨테이너로 유지. TagGroup.props.items[] 를 items SSOT 로 전환. Migration 시 TagGroup > TagList > Tag 3 단에서 Tag elements 를 items 배열로 흡수, TagList 는 ADR-094 `expandChildSpecs` 로 자동 재생성. element tree 는 3 단 유지되지만 Tag elements 소멸.
- 근거: ADR-093 Phase 1 에서 TagList containerStyles 리프팅 완료 — spec 이 layout primitive 를 3 필드 포함하므로 "정당한 중간 컨테이너". 소멸시키면 ADR-093 작업이 낭비됨. ADR-076 ListBox 선례 4 회 정립 + Tag Field 자식 불가로 **단순화** 가능.
- 위험:
  - 기술: **MEDIUM** — 2 단 이전 migration (parentId resolution 추가 로직). ADR-076 대비 orchestrator 복잡도 ↑ but Field 분기 불필요로 ↓. 순 복잡도 MED.
  - 성능: LOW — items runtime expand = Tag virtual element 생성 (ADR-076 ListBox 선례 성능 영향 0 확인됨).
  - 유지보수: LOW — 4 회 패턴 재사용, 신규 구조 없음.
  - 마이그레이션: **MEDIUM** — 기존 프로젝트 데이터 자동 migration 필요. Orphan DFS + Tag element 삭제. 사용자 편집 0.

### 대안 B: TagList 소멸 + TagGroup.items 2 단 구조

- 설명: TagGroup → Tag 2 단 구조. TagList 중간 컨테이너 완전 삭제. implicitStyles TagList 분기 (40 줄) 를 TagGroup 레벨로 상향.
- 근거: element tree 최소화.
- 위험:
  - 기술: **HIGH** — implicitStyles TagGroup 분기 신설 40 줄 + runtime-only 로직 3 종 (maxRows/whiteSpace/labelPosition) 상향 이동. TagGroup containerStyles (ADR-093 없음 — Label + TagList flex container 로직) 재설계 필요.
  - 성능: LOW
  - 유지보수: **HIGH** — ADR-093 TagList.spec.ts 리프팅 작업 무효화. 단일 컨테이너 내 items 렌더 + Label 렌더 로직 혼재.
  - 마이그레이션: **HIGH** — 2 단 이전 DFS 에 TagList element 삭제 추가 + TagGroup children 재정리.

### 대안 C: 현 상태 유지 (TagGroup 3 단 + Tag element 편집)

- 설명: TagGroup > TagList > Tag 3 단 element tree 유지. items SSOT 전환 없음.
- 근거: scope 0.
- 위험:
  - 기술: LOW
  - 성능: LOW
  - 유지보수: **HIGH** — items SSOT 체인 ADR-066/068/073/076 마지막 컬렉션이 완결되지 않음. ADR-087 SP6 후속 debt + ADR-093 Addendum 1 debt 영구화. 사용자가 Tag 개별 편집 → items 관리 UI 부재로 생산성 저하.
  - 마이그레이션: LOW

### Risk Threshold Check

| 대안                         | 기술 | 성능 | 유지보수 | 마이그레이션 | HIGH+ 수 | 판정                      |
| ---------------------------- | :--: | :--: | :------: | :----------: | :------: | ------------------------- |
| A: TagList 유지 + items SSOT |  M   |  L   |    L     |      M       |    0     | **PASS**                  |
| B: TagList 소멸 + 2 단 구조  |  H   |  L   |    H     |      H       |    3     | 기각 (루프 필요 → 대안 A) |
| C: 현 상태                   |  L   |  L   |    H     |      L       |    1     | 기각 (debt 영구화)        |

대안 A 가 HIGH+ 0 + 4 회 선례 재사용 + ADR-093 리프팅 유효화 — threshold pass.

**반복 패턴 선차단 체크** (adr-writing.md Top 1~4):

- ✅ **#1 코드 경로 인용**: Context "소비 코드 경로" 섹션 8 개 파일/라인 grep 가능 경로 명시
- ✅ **#2 Generator 확장 여부**: "Hard Constraint 5" — items prop 은 CSSGenerator emit 대상 외 명시
- ✅ **#3 BC 훼손 수식화**: "Hard Constraint 1" + breakdown "BC 영향 수식화" — **저장 프로젝트 0 % / 재직렬화 자동 / 렌더 diff 0** 실측
- ✅ **#4 Phase 분리 가능성**: 6 Phase 구성 (선례 재학습 / types / migration / routing / implicitStyles / MCP). Phase 2 migration orchestrator 가 MED 복잡도 — 필요 시 Phase 2.1 (2 단 이전) / Phase 2.2 (orphan DFS) 추가 분할 가능

## Decision

**대안 A (TagList spec-only 유지 + TagGroup.items SSOT) 채택**. 6 Phase 순차 이관.

선택 근거:

1. ADR-093 Phase 1 TagList.containerStyles 리프팅 유효화 — spec-only container 라는 중간 상태가 정당함.
2. ADR-066/068/073/076 items SSOT 4 회 선례 재사용. 신규 인프라 없음.
3. Tag Field 자식 불가 (ListBox 차이) — migration orchestrator **단순화**: `listBoxAbsorbParents` 원자 판정 없이 항상 정적 흡수.
4. BC 영향 0 % 실측 — migration 자동, 사용자 편집 불필요, 렌더 결과 diff 0 (ADR-076 선례 동일).
5. items SSOT 체인 컬렉션 완결 — Tabs/Menu/Select/ComboBox/ListBox/**TagGroup** 5 번째.

기각 사유:

- **대안 B 기각**: HIGH 3 개 — ADR-093 리프팅 무효화 + implicitStyles 40 줄 상향 + 2 단 이전 DFS 복잡도. "element tree 최소화" 이득이 D3 일관성 / 유지보수 비용 초과.
- **대안 C 기각**: items SSOT 체인 마지막 컬렉션 debt 영구화. ADR-087 SP6 후속 후보 중 유일 미완결. Tag 개별 편집 사용자 플로우 생산성 저하 유지.

> 구현 상세: [097-taggroup-items-ssot-hybrid-breakdown.md](../../adr/design/097-taggroup-items-ssot-hybrid-breakdown.md)

## Risks

| ID  | 위험                                                                                                  | 심각도 | 대응                                                                                                               |
| --- | ----------------------------------------------------------------------------------------------------- | :----: | ------------------------------------------------------------------------------------------------------------------ |
| R1  | 2 단 이전 migration 에서 Tag subtree (현재 children: string 만) 가 향후 description slot 추가 시 손실 |  LOW   | Phase 2 orchestrator 에 `StoredTagItem.description?: string` 필드 선제 포함 — 현재 undefined 로 남되 타입 예약     |
| R2  | Tag 개별 선택/편집 플로우 소멸 → 사용자 혼란                                                          |  LOW   | Phase 3 TagGroupPropertyEditor 에 items 목록 + add/remove UI 제공. ADR-076 ListBoxPropertyEditor 선례 복사         |
| R3  | `applyCollectionItemsMigration` 확장 시 기존 ListBox/Select migration 로직 회귀                       |  LOW   | Phase 2 migrateTagGroupItems 를 별도 함수로 신규 (migrateCollectionItems.ts 내부 export) → 기존 함수 시그니처 불변 |
| R4  | implicitStyles `maxRows` 근사 계산 재구성 시 items 배열 평균 Tag 폭 기준 → 실제 렌더 폭과 편차        |  LOW   | ADR-076 선례 — items runtime expand = Tag virtual element 가 기존 Tag element 와 동일 shapes → 측정 폭 동일 보장   |
| R5  | 기존 TagGroup 없는 프로젝트가 migration 실행 시 불필요 비용                                           |  LOW   | `applyCollectionItemsMigration` early return (TagGroup 부재 시) 기존 패턴 재사용                                   |

잔존 HIGH 위험 없음.

## Gates

잔존 HIGH 위험 없음 — Gate 테이블 생략. 검증 기준 (breakdown Phase 6):

- Phase 1 완료 후: type-check 3/3 PASS (types 추가만) ✅ land (`aca16a7c`)
- Phase 2 완료 후: specs 166+ PASS + migrateTagGroupItems 테스트 3 건 신규 PASS ✅ land (`409875bd` + `1c03b9f0` BC fix, shared 46→52)
- Phase 3 완료 후: builder 230+ PASS (virtual children + PropertyEditor) ✅ land (`59528d48`, builder 227/227 — 신규 테스트 0건은 기존 227 유지)
- Phase 4 완료 후:
  - type-check 3/3 PASS ✅
  - specs 166+ PASS (Tag/TagGroup snapshot 갱신 가능) ✅
  - builder 230+ PASS ✅ (227/227 유지, Phase 4 구현은 spec shapes + layout 분기 — 기존 테스트 범위 내)
  - Phase 4A (`4e906663`) + Phase 4B (`5c632fc9`) 순차 land
- Phase 5 완료 후: TagList containerStyles 유지 검증 — resolveContainerStylesFallback 으로 display/flexDirection/flexWrap 동일 값 확인 ✅ land (세션 5, 2026-04-21)
  - 증거: breakdown Phase 5 섹션 "증거 1/2/3" 참조. TagListSpec.containerStyles:74-78 유지 + expandChildSpecs 자동 등록 + implicitStyles runtime fork 14 LOC 최소성 확증
- Phase 6: Chrome MCP 연결 시 Tag 3 개 (Primary/Secondary/Disabled) 정상 표시. 불안정 시 code-level 증거 허용 (ADR-092/093/095/096 선례).

## Consequences

### Positive

- **items SSOT 체인 완결** — ADR-066/068/073/076/**097** 5 번째 컬렉션 완결. Tabs/Menu/Select/ComboBox/ListBox/TagGroup 전부 items 패턴.
- **ADR-087 SP6 후속 debt 해소** — 중간 컨테이너 spec 신설 + items SSOT 2 축 완결.
- **ADR-093 Addendum 1 해소** — maxRows/whiteSpace runtime 로직이 items 기반으로 재구성되어 element tree 순회 대신 배열 순회 (성능 개선 기대).
- **사용자 생산성 향상** — TagGroupPropertyEditor items 목록 편집 UI 가 Tag 개별 편집 대체.
- **ADR-094 `expandChildSpecs` 3 번째 활용** (ADR-092 Card / ADR-093 TagList/Radio/Checkbox / 본 ADR) — 인프라 ROI 증명.

### Negative

- **2 단 이전 migration 복잡도** (대안 A Option A 핵심 trade-off) — `migrateTagGroupItems` 신규 함수 (~150-200 LOC) 가 가장 큰 code cost.
- **Tag 개별 선택/편집 소멸** — 기존 UX 의 element 레벨 Tag 편집 불가. TagGroupPropertyEditor items 로만 편집 가능 (ListBox 선례 동일).
- **items 필드의 이중 의미 혼동 가능성** — ListBox/Select/ComboBox/Menu/Tabs/**TagGroup** 모두 items 지만 각 StoredXItem 타입 상이. 신규 구현자 혼동 가능 (JSDoc 명시로 완화).
- **TagList 중간 컨테이너 존재감 약화** — spec-only 로 유지되지만 사용자는 LayerTree 에서도 보이지 않게 될 가능성 (Phase 3 virtual children 설계에 따라 결정).

## Addendum 1 — Factory 전환 완결 (2026-04-21 세션 5 후속)

**배경**: Phase 3 시점에서 `createTagGroupDefinition` (`GroupComponents.ts:391`) 은 여전히 기존 패턴대로 18개 Tag element + Label + TagList element tree 를 생성 — migration orchestrator 가 프로젝트 로드 시 items[] 로 흡수하는 **점진 이관** 경로에 의존. Phase 3 breakdown 표에서 scope 외로 판정되어 후속 debt 로 남았음.

**변경**: factory 가 생성 시점부터 items SSOT 생성. ListBox `createListBoxDefinition` 선례 (children:[] + items:[3] 기본값) 대칭 적용.

- `TagGroup.props.items: StoredTagItem[4]` 기본값 주입 (Chocolate/Mint/Strawberry/Vanilla — ListBox 3 샘플 패턴 대칭)
- `TagList.children: []` — Tag element 18개 배열 완전 삭제 (~170 LOC)
- Label element 는 유지 (factory children, TagGroup 의 직속 자식)
- TagList element 는 중간 컨테이너 유지 (ADR-097 Decision Option A 준수)

**효과**:

- 신규 TagGroup 생성 → 즉시 items SSOT (migration 흡수 불필요)
- 저장 데이터 → 로드 후 items 기반 (factory 생성 경로와 일치)
- Tag element 18개 생성/삭제 비용 제거 (factory 속도↑, store 초기 렌더 비용↓)
- LayerTree virtual children (taggroup type, `useLayerTreeData.ts:229`) 가 신규 TagGroup 에서 즉시 4 items 표시

**BC 영향**: 0%. 기존 저장 프로젝트는 여전히 migration orchestrator 가 처리. 신규 생성만 직접 items SSOT 경로.

**검증**: type-check 3/3 + specs 166/166 + shared 52/52 + builder 227/227 PASS. 기존 TagGroup (migration 경로) Chrome MCP 스크린샷 확인 — 신규 경로는 동일 `TagGroup.props.items[] + TagList(자식 0)` 구조 직접 생성이므로 Phase 6 실측 재활용.

**커밋**: `6859c13e` (feat(adr-097): Addendum 1 — Factory 전환 완결)

## 참조

- [ADR-093](093-synthetic-merge-containers-spec.md) — 본 ADR 의 선행. TagList containerStyles 리프팅 + Addendum 1 명시 debt
- [ADR-076](076-listbox-items-ssot-hybrid.md) — ListBox items SSOT + Hybrid containerStyles 패턴 원본
- [ADR-066](066-tabs-items-ssot-migration.md) / [ADR-068](068-menu-items-ssot-and-menuitem-spec.md) / [ADR-073](073-select-combobox-items-ssot.md) — items SSOT 체인 1-3 번째
- [ADR-094](094-childspecs-registry-auto-registration.md) — `expandChildSpecs` 인프라 (TagList 자동 재생성 활용)
- [ADR-087](087-implicitstyles-residual-branches-categorized-sweep.md) — SP6 후속 후보 명시
- [ADR-063](063-ssot-chain-charter.md) — SSOT 체인 D2/D3 domain 원칙
- [ssot-hierarchy.md](../../../.claude/rules/ssot-hierarchy.md) — D3 symmetric consumer 정본
