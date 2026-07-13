# ADR-093: 중간 컨테이너 spec 신설 — TagList / RadioItems / CheckboxItems

## Status

Implemented — 2026-04-21

## Context

composition SSOT 체인 (ADR-036/063) 에서 **부모-자식 사이 중간 컨테이너 3 종**의 spec 이 부재. ADR-072 `_hasChildren` 3분류에서 부모는 `SYNTHETIC_CHILD_PROP_MERGE_TAGS` 에 등록되어 있으나, 실제 factory 는 부모 생성 시 중간 컨테이너 element 를 자동 생성하여 자식 Tag/Radio/Checkbox 를 그 안에 배치.

### 실측 — 현재 구조

- **SYNTHETIC_CHILD_PROP_MERGE_TAGS Set (10 태그)**: Breadcrumbs, ComboBox, GridList, ListBox, Select, Table, Tabs, **TagGroup**, Toolbar, Tree. **TagList/RadioItems/CheckboxItems 는 Set 에 없음** — 이들은 부모 자체가 아닌 중간 컨테이너
- **Factory 자동 생성 element** (`apps/builder/src/builder/factories/definitions/GroupComponents.ts`):
  - `:220` CheckboxGroup 생성 시 `tag: "CheckboxItems"` 자식 자동 생성
  - `:329` RadioGroup 생성 시 `tag: "RadioItems"` 자식 자동 생성
  - `:433` TagGroup 생성 시 `tag: "TagList"` 자식 자동 생성 (부모 column → Label + TagList row wrap → Tags)
- **Spec 부재 3 tag**: `TagList.spec.ts` / `RadioItems.spec.ts` / `CheckboxItems.spec.ts` 모두 없음
- **implicitStyles 분기 존재**:
  - `taglist` (`:565-612`): orientation row/column, flexWrap wrap, gap:4, labelPosition="side" 시 flex:1/minWidth:0, Tag 자식 whiteSpace:nowrap 주입, maxRows 근사 계산 (대량 runtime 로직)
  - `radioitems/checkboxitems` (`:880-896`): orientation row/column, size-based gap (sm:8/md:12/lg:16), alignItems:center (horizontal)

### D3 domain 판정 ([ssot-hierarchy.md](../../../.claude/rules/ssot-hierarchy.md))

**D3 (시각 스타일) symmetric consumer 의 대칭 복구**. 중간 컨테이너의 layout primitive (display/flexDirection/flexWrap/alignItems) 가 spec 부재로 implicitStyles 분기에 runtime 할당. orientation/size 기반 runtime 분기는 유지하되 base primitive 는 spec 으로 리프팅.

### Hard Constraints

1. **Skia ↔ CSS 2-consumer 대칭 복구** — 본 ADR 은 [ADR-094](094-childspecs-registry-auto-registration.md) (childSpecs 자동 registry 등록) 에 의존. ADR-094 없이는 Skia 축 미공급 → 대칭 실패 (Codex round 2 H2 지적)
2. **parent prop 사실 관계 정확 반영** (Codex round 2 M2 지적):
   - TagGroup 에는 `orientation` prop **없음** (`TagGroup.spec.ts:35` / `GroupComponents.ts:403`). 현재 `implicitStyles.ts:570` 는 prop 없을 때 **row + wrap** 로 동작 → TagList.spec.containerStyles 기본값은 **`flexDirection:"row"` + `flexWrap:"wrap"`** (vertical 기본 가정 금지)
   - RadioGroup/CheckboxGroup 은 `orientation` prop 있음 (`RadioGroup.spec.ts:35` default vertical) → RadioItems/CheckboxItems.spec.containerStyles 기본값은 `flexDirection:"column"`
3. **runtime fork 축 3 spec 각자 상이 유지**:
   - TagList = `parentProps.orientation` (TagGroup 미지원 시 "undefined" 처리) + `parentLabelPos==="side"` (flex:1/minWidth:0 주입) 2축
   - RadioItems/CheckboxItems = `parentProps.orientation` + `parentProps.size` (size-based gap) 2축
4. **TagList runtime 로직 (maxRows, Tag whiteSpace injection) 유지** — 자식 Element 조작/수량 조정은 spec 커버 영역 아님
5. **Factory element 자동 생성 호환 유지** — 기존 저장 데이터의 TagList/RadioItems/CheckboxItems element 그대로 동작
6. **본 ADR scope = spec 신설 + 기본 layout primitive containerStyles 리프팅**. maxRows/injection/orientation fork 는 분기 유지
7. `pnpm type-check` 3/3 + specs 166/166 + builder 217/217 PASS

### Soft Constraints

- ADR-078 (ListBoxItem) + ADR-090 (GridListItem) + ADR-092 (CardHeader/CardContent) 선례 반복 4회째
- RadioItems/CheckboxItems 는 gap size-indexed → sizes.sm/md/lg 에 gap 8/12/16 선언 가능
- TagList 는 size prop 없음 → sizes.md only

## Alternatives Considered

### 대안 A: 3 spec 독립 신설 + 부모 childSpecs 배선 (선정)

- 설명: `TagList.spec.ts`, `RadioItems.spec.ts`, `CheckboxItems.spec.ts` 각각 신설. archetype:"simple", skipCSSGeneration:true (수동 CSS 는 부모 파일 `packages/shared/src/components/styles/{Checkbox,Radio,TagGroup}.css` 안에 통합되어 있어 유지), containerStyles (display:flex, orientation default), sizes.md (gap size-indexed). 부모 spec `childSpecs` 배선
- 근거: ADR-078/090/092 패턴 4회째 반복. RAC 에 TagList 독립 component 존재 (`<TagList>`), RadioItems/CheckboxItems 는 composition 자체 추상화이나 spec 모델링 부담 동일
- 위험:
  - 기술: LOW — 선례 확정, 3회 반복
  - 성능: LOW
  - 유지보수: LOW — SSOT 복귀
  - 마이그레이션: LOW — BC 0 (factory 자동 생성 호환)

### 대안 B: 통합 "ItemsContainer" 추상 spec — 3 tag 를 variant 로 분기

- 설명: 공통 `ItemsContainer.spec.ts` 1개 + 3 tag 는 해당 spec 을 variant 로 분기. 파일 수 축소
- 근거: 공통 로직 많음 (모두 orientation row/column + gap)
- 위험:
  - 기술: **MEDIUM** — TAG_SPEC_MAP 재매핑 + 3 tag 를 단일 spec 참조하는 새 구조. Generator / Skia consumer / Style Panel 영향
  - 성능: LOW
  - 유지보수: **MEDIUM** — 추상 레이어 신설 → 이원화. 다른 컴포넌트(TextField wrapper 등) 에도 적용 시 범위 확장 필요
  - 마이그레이션: LOW

### 대안 C: 부모 items SSOT 완전 이관 — 중간 컨테이너 element 제거

- 설명: ADR-066/073/076 items SSOT 확장. TagGroup.items[] / RadioGroup.items[] / CheckboxGroup.items[] 에 통합, 중간 컨테이너 element 소멸
- 근거: 궁극적 SSOT — 중간 추상 불필요
- 위험:
  - 기술: **HIGH** — factory/store/Skia/migration 대형 변경. RadioGroup 이 RAC `<RadioGroup>` 내부에 `<Radio>` 직접 배치하는 구조인데 현재 `<RadioItems>` 중간 컨테이너 존재 → 구조 변경
  - 성능: LOW
  - 유지보수: LOW (최종 상태)
  - 마이그레이션: **HIGH** — 기존 프로젝트 데이터 migration 필요. 3 tag 각자 migrations.ts 작성, skipHistory

### Risk Threshold Check

| 대안                                      | HIGH+ 수 | 판정                               |
| ----------------------------------------- | :------: | ---------------------------------- |
| A: 독립 spec + childSpecs (선례 반복 4회) |    0     | PASS                               |
| B: ItemsContainer 추상                    |    2     | (추상 레이어 투자 ROI 불명 → 기각) |
| C: items SSOT 완전 이관                   |    2     | (대형 migration → 별도 ADR)        |

대안 A HIGH+ 0. 대안 C 는 별도 후속 ADR 후보 (궁극 SSOT).

## Decision

**대안 A 채택**. 3 spec 독립 신설 + 부모 childSpecs 배선. orientation runtime fork + maxRows/injection 로직 보존.

### Phase 구성

**선행 의존성**: [ADR-094](094-childspecs-registry-auto-registration.md) (childSpecs 자동 registry 등록) 먼저 land 필수. ADR-094 없이 본 ADR 진행 시 Skia 축 SSOT 미복구.

- **Phase 1 (1세션)**:
  1. `TagList.spec.ts` 신설 — archetype:"simple", skipCSSGeneration:true, **containerStyles (display:flex, flexDirection:"row", flexWrap:"wrap")** (TagGroup orientation prop 없음 반영, 현재 런타임 동작 일치), sizes.md (gap:4)
  2. `RadioItems.spec.ts` 신설 — archetype:"simple", skipCSSGeneration:true, containerStyles (display:flex, **flexDirection:"column"** default — RadioGroup orientation default vertical), sizes.sm/md/lg (gap:8/12/16)
  3. `CheckboxItems.spec.ts` 신설 — RadioItems 와 동일 구조 (CheckboxGroup default vertical)
  4. `packages/specs/src/components/index.ts` + `packages/specs/src/index.ts` export 3건 추가
  5. 부모 spec childSpecs 배선 (TagGroupSpec/RadioGroupSpec/CheckboxGroupSpec)
- **Phase 2 (0.5세션)**: `implicitStyles.ts` 분기 3개 리팩토링 (ADR-094 인프라로 spec.containerStyles 자동 주입):
  - taglist 분기: display/flexDirection/flexWrap/gap 기본값 제거 (spec.containerStyles + ADR-094 경유). **runtime fork 유지**: (a) TagGroup 이 향후 orientation prop 도입 시를 대비한 `parentProps.orientation` 체크 (현재는 undefined 경로), (b) `labelPosition="side"` 시 flex:1/minWidth:0 주입, (c) maxRows/whiteSpace 자식 injection
  - radioitems/checkboxitems 분기: gap 하드코딩 `sm:8/md:12/lg:16` 제거 → `spec.sizes[sizeName].gap` 참조. **runtime fork 유지**: (a) `orientation` 에 따른 flexDirection override (horizontal:row), (b) `alignItems:center` horizontal 시 주입
- **Phase 3 (검증)**: type-check + specs + builder

### 구현 파일 변경 목록

1. `packages/specs/src/components/TagList.spec.ts` — 신규
2. `packages/specs/src/components/RadioItems.spec.ts` — 신규
3. `packages/specs/src/components/CheckboxItems.spec.ts` — 신규
4. `packages/specs/src/components/TagGroup.spec.ts` — childSpecs
5. `packages/specs/src/components/RadioGroup.spec.ts` — childSpecs
6. `packages/specs/src/components/CheckboxGroup.spec.ts` — childSpecs
7. `packages/specs/src/components/index.ts` — export 3건
8. `apps/builder/.../implicitStyles.ts:565-612 / :880-896` — 하드코딩 제거 → spec 참조

### 후속 ADR 후보

- **ADR-093-A1**: 중간 컨테이너 element 소멸 + items SSOT 완전 이관 (대안 C) — 대형 migration, 별도 세션 필요

## Risks

| ID  | 위험                                                                   | 심각도 | 대응                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| --- | ---------------------------------------------------------------------- | :----: | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | 3 spec runtime fork 축 상이 — spec.containerStyles 기본값 vs fork 충돌 |  MED   | **3 spec 각자 fork 축 상이 유지**: TagList = `orientation + labelPosition="side"` 2축 (flex:1/minWidth:0 runtime 주입, `implicitStyles.ts:571`). RadioItems/CheckboxItems = `orientation + size` 2축 (size-based gap 8/12/16, `:886`). spec 기본값은 **TagList = row+wrap** (TagGroup orientation prop 없음 반영, `implicitStyles.ts:570` 동작 일치), **RadioItems/CheckboxItems = vertical column** (RadioGroup default) + size=md 기준. runtime 은 fork 유지 (Codex round 4 M3 정정) |
| R2  | TagList maxRows/whiteSpace 로직 유지 필요 — containerStyles 커버 불가  |  LOW   | 본 ADR scope 에서 자식 element injection + 수량 조정은 spec 외 명시 (ADR-092 와 동일 패턴)                                                                                                                                                                                                                                                                                                                                                                                             |
| R3  | RAC API 에 RadioItems/CheckboxItems 없음 — composition 자체 추상화     |  LOW   | spec name 에 "composition 자체 추상" 주석 명시. RAC API 변경 영향 없음                                                                                                                                                                                                                                                                                                                                                                                                                 |

잔존 HIGH 위험 없음.

## Gates

잔존 HIGH 위험 없음. 검증 기준:

- type-check 3/3 PASS ✅ (2026-04-21 확인)
- specs 166/166 PASS ✅ (TagGroup/RadioGroup/CheckboxGroup snapshot 2 updated — childSpecs 등록으로 인한 CSS emit 반영)
- builder 227/227 PASS ✅ (ADR-094 영향 유지)
- RadioItems/CheckboxItems 분기 `gap = sizeName === "sm" ? 8 : sizeName === "lg" ? 16 : 12` **잔존 유지** (ADR scope 내 runtime fork — Hard Constraint #3 size-indexed gap 은 Taffy 가 sizes 를 모르므로 분기 주입 필요)
- Chrome MCP 실측: 현재 프로젝트 페이지에 TagGroup/RadioGroup/CheckboxGroup 없음 → code-level 검증으로 대체

## 구현 결과 (2026-04-21)

- **Phase 1 (3 spec 신설)**: `TagList.spec.ts` (`flexDirection:"row" + flexWrap:"wrap"` 기본 — Hard Constraint #2 TagGroup orientation 무 반영) / `RadioItems.spec.ts` / `CheckboxItems.spec.ts` (`flexDirection:"column"` 기본). 모두 `archetype:"simple"` / `element:"div"` / `skipCSSGeneration:true` / sizes 각 size 에 `borderRadius: "{radius.none}"` (ADR-092 실수 방지) / `render.shapes: () => []`. 부모 generated CSS 에 inline emit.
- **Phase 2 (childSpecs 배선)**: `TagGroup.spec.childSpecs: [TagListSpec]` / `RadioGroup.spec.childSpecs: [RadioItemsSpec]` / `CheckboxGroup.spec.childSpecs: [CheckboxItemsSpec]` 3건 배선. ADR-094 `expandChildSpecs` 인프라 활용 2번째 케이스 — tagSpecMap/tagToElement 수동 추가 불필요.
- **Phase 3 (implicitStyles 분기 조정)**:
  - **TagList 분기 (`:566-582`)**: `display:"flex"` + `flexDirection:"row"` + `flexWrap:"wrap"` base primitive 제거 (spec containerStyles 로 리프팅). `orientation === "vertical"` 시에만 `flexDirection:"column"` + `flexWrap:undefined` 조건부 override. gap 주입 + labelPosition="side" flex:1/minWidth:0 + Tag 자식 whiteSpace injection + maxRows 근사 계산은 runtime fork 유지 (Hard Constraint #4).
  - **RadioItems/CheckboxItems 분기 (`:881-902`)**: `display:"flex"` + `flexDirection:"column"` base primitive 제거. `orientation === "horizontal"` 시에만 `flexDirection:"row"` + `alignItems:"center"` 조건부 override. size-indexed gap (sm:8/md:12/lg:16) 은 runtime fork 유지 (Hard Constraint #3 — Taffy 가 sizes 를 직접 모름).
- **Phase 4 점검**: SYNTHETIC_CHILD_PROP_MERGE_TAGS Set 에 TagList/RadioItems/CheckboxItems 추가 불필요 — 중간 컨테이너는 부모가 아니며, 현상 유지.
- **Phase 5 (Chrome MCP 실측)**: 현재 프로젝트 페이지에 관련 element 없음 → code-level 검증으로 대체.

### 후속 ADR 후보

- **ADR-093-A1**: TagList maxRows 근사 계산 → items SSOT (Tags props.items) 완전 이관. 현 구현은 자식 element 수량 조정 런타임 로직이라 spec 커버 불가, 향후 items SSOT 패턴 (ADR-066/068/073/076 선례) 확장 시 재검토.

## Consequences

### Positive

- ADR-087 SP6 후속 후보 #2 (synthetic-merge 중간 컨테이너) 대부분 해소
- 3 spec 신설로 Style Panel / Skia / Taffy 3경로 SSOT 복귀
- ADR-078/090/092 패턴 4회 검증 — 중간 컨테이너 spec 신설 표준 확립

### Negative

- RadioItems/CheckboxItems 는 RAC 표준 API 에 없음 — composition 자체 추상이라 "Spec SSOT 존재" 해도 외부 호환성 없음
- 중간 컨테이너 element 자체의 존재 당위는 여전히 유지 — 궁극 items SSOT 이관 (대안 C) 은 별도 ADR
- 부모-자식-손자 3단 구조가 그대로 남음 (TagGroup > TagList > Tag)

## 참조

- [ADR-078](078-listboxitem-spec-and-generator-child-selector.md) — ListBoxItem spec + childSpecs 선례
- [ADR-090](090-gridlistitem-spec-and-skia-metric-ssot.md) — GridListItem spec 선례
- [ADR-092](092-card-slot-spec-modeling.md) — CardHeader/CardContent 선례 (동일 패턴 4회째)
- [ADR-072](../../adr/design/072-hasChildren-convention-shell-only-tags-breakdown.md) — `_hasChildren` 3분류 컨벤션
- [ADR-087](087-implicitstyles-residual-branches-categorized-sweep.md) — SP6 후속 후보
- [ADR-063](063-ssot-chain-charter.md) — SSOT 체인 D3 domain
