# ADR-103: CheckboxItems / RadioItems 정당화 — RAC 미존재 composition 중간 컨테이너 유지 결정 (ADR-098-e 슬롯)

## Status

Implemented — 2026-04-21

> 본 ADR 은 [ADR-098](098-rsp-naming-audit-charter.md) (RSP 네이밍 정합 감사 Charter) 의 "098-e 슬롯" 구현. ADR-098 Charter 후보 #5 "정당화 문서 후보" 판정. **Phase 0 BC 재평가 결과 시나리오 B (BC HIGH) 확인 — 제거 불가, 대안 A (정당화 유지) 채택.**

**Phase 커밋 체인** (origin/main):

- P0 완료 — BC 재평가 + 시나리오 판정 + 2 대안 평가 (ADR-103 본문 작성, 2026-04-21 세션 12)
- P1 완료 — CheckboxItems/RadioItems selfcontained 정당화 섹션 + spec 파일 ADR-103 주석 sweep
- P2 완료 — README.md ADR-103 Implemented 추가

**종결 검증**: type-check 3/3 + specs 205/205 + builder 227/227 + shared 52/52 PASS. BC 영향 0% (정당화 유지 결정 — migration 0건).

## Context

ADR-098 감사 매트릭스 (2026-04-21) 에서 composition 의 `CheckboxItems` / `RadioItems` 가 RAC 공식 CheckboxGroup / RadioGroup 구조에 직접 대응 컴포넌트 없음을 식별했다. RAC `<CheckboxGroup>` 은 `<Checkbox>` 를 직접 배치하는 구조이며, "CheckboxItems" 이라는 이름의 중간 컨테이너는 RAC/RSP 공식 API 에 존재하지 않는다. `RadioItems` 도 동일하다.

ADR-098 Charter 후보 #5 는 CheckboxItems/RadioItems 를 "정당화 문서 후보" 로 분류하고 본 ADR 에서 결정을 위임했다. **ADR-100 SelectTrigger / ADR-101 ComboBoxTrigger / ADR-102 SelectIcon 선례 패턴** (Phase 0 현장 재조사 후 BC 비대칭/HIGH 결정) 을 그대로 적용한다.

### BC 재평가 매트릭스 (Phase 0)

| 식별자        |       ADR-098 분류        | Phase 0 재조사 결과                                                                                                             | 실질 BC  |
| ------------- | :-----------------------: | ------------------------------------------------------------------------------------------------------------------------------- | :------: |
| CheckboxItems | MED (정당화 문서 후보 #5) | factory `createCheckboxGroupDefinition` 이 `tag: "CheckboxItems"` 자식 element 생성 — DB 직렬화 확인 (`GroupComponents.ts:221`) | **HIGH** |
| RadioItems    | MED (정당화 문서 후보 #5) | factory `createRadioGroupDefinition` 이 `tag: "RadioItems"` 자식 element 생성 — DB 직렬화 확인 (`GroupComponents.ts:330`)       | **HIGH** |

**시나리오 판정: 시나리오 B (BC HIGH)** — CheckboxItems/RadioItems 는 DB 에 `tag: "CheckboxItems"` / `tag: "RadioItems"` 로 저장되는 독립 element. 제거 불가.

### RAC 공식 구조와의 비교

**RAC CheckboxGroup 공식 구조**:

```
<CheckboxGroup>
  <Label />
  <Checkbox />   ← 직접 배치 (중간 컨테이너 없음)
  <Checkbox />
</CheckboxGroup>
```

**composition 실제 구조**:

```
CheckboxGroup (element)
  ├── Label (element)
  └── CheckboxItems (element)  ← composition 자체 중간 컨테이너
        ├── Checkbox (element)
        └── Checkbox (element)
```

**RAC RadioGroup 공식 구조**:

```
<RadioGroup>
  <Label />
  <Radio />   ← 직접 배치 (중간 컨테이너 없음)
  <Radio />
</RadioGroup>
```

**composition 실제 구조**:

```
RadioGroup (element)
  ├── Label (element)
  └── RadioItems (element)  ← composition 자체 중간 컨테이너
        ├── Radio (element)
        └── Radio (element)
```

### D1/D2/D3 domain 판정 ([ssot-hierarchy.md](../../../.claude/rules/ssot-hierarchy.md))

- **D3 (시각 스타일)**: CheckboxItems/RadioItems 는 `containerStyles` 에서 `display:flex` / `flexDirection:column` layout primitive 를 정의하고, `sizes.sm/md/lg` 에서 `gap:8/12/16` 을 D3 Spec SSOT 로 관리 — **D3 시각 스타일 domain**. Spec 관할.
- **D2 (Props/API)**: RAC 공식 API 에 CheckboxItems/RadioItems 미존재 → D2 정합 대상 아님. composition 고유 element. ADR-098 Charter Decision "composition 고유 네이밍은 Compositional Architecture 정당화 가능 시 유지 허용" 에 해당.
- **D1 (DOM/접근성)**: CheckboxItems/RadioItems 는 `element: "div"` 로 렌더링. `eventMode` 없음 — 시각/레이아웃 전용 컨테이너. ARIA/키보드 동작 없음. D1 구조 영향 없음.

### 도입 배경 — ADR-093 결정 요약

ADR-093 (2026-04-21 Implemented) 에서 composition 이 중간 컨테이너를 도입한 D3 근거:

1. **CheckboxGroup/RadioGroup > Label + Items > Checkbox/Radio 3단 구조** — Label 과 Checkbox/Radio 집합 사이의 레이아웃 분리. Label 은 `whiteSpace:nowrap` 고정, Checkbox/Radio 집합은 `orientation` 에 따라 row/column 전환. 이 분리를 단일 container (`CheckboxGroup`) 안에서 CSS 로 처리하면 Label 과 Items 의 flex 동작이 충돌.
2. **orientation 기반 runtime fork 필요** — `CheckboxGroup.orientation = "vertical"` (기본) 이면 Items 가 column, `"horizontal"` 이면 row + alignItems:center. 이 fork 는 Items 중간 컨테이너 존재를 전제로 설계됨 (`implicitStyles.ts:760-777`).
3. **size-indexed gap SSOT** — `sizes.sm/md/lg` 에 gap 8/12/16 을 Spec SSOT 로 선언 (ADR-093 Phase 1). Taffy 엔진이 직접 sizes 를 모르므로 implicitStyles 분기에서 gap 을 주입하지만, 기준값은 spec 에서 1곳으로 관리.

### Hard Constraints

1. **BC 영향 수식화 선행** — CheckboxItems/RadioItems 저장 데이터 직렬화 확인. `tag: "CheckboxItems"` / `tag: "RadioItems"` element 존재 시 제거 = 기존 프로젝트 CheckboxGroup/RadioGroup 자식 구조 소실 (BC HIGH).
2. **ADR-093 Compositional Architecture 보전** — CheckboxItems/RadioItems 중간 컨테이너 제거 = ADR-093 의 3단 구조 결정 훼손. ADR-093 은 spec 신설 + childSpecs 배선 + implicitStyles 분기 최적화까지 완결된 Implemented ADR.
3. **spec 이미 완비 상태** — `CheckboxItems.spec.ts` / `RadioItems.spec.ts` 는 ADR-093 Phase 1 에서 신설, `skipCSSGeneration: true` / `render.shapes: () => []` / `containerStyles` / `sizes.sm/md/lg` 완전 구현. 추가 구현 불필요.
4. **testing 기준선** — type-check 3/3 + specs 205/205 + builder 227/227 + shared 52/52 PASS 유지.

### 현장 데이터 (2026-04-21)

- `CheckboxItems` 관련 파일: `CheckboxItems.spec.ts` (Spec 정의) + `GroupComponents.ts:221` (factory 생성) + `fullTreeLayout.ts:117` (LABEL_DELEGATION_PARENT_TAGS 포함) + `implicitStyles.ts:760-777` (orientation runtime fork)
- `RadioItems` 관련 파일: `RadioItems.spec.ts` (Spec 정의) + `GroupComponents.ts:330` (factory 생성) + `fullTreeLayout.ts:118` (LABEL_DELEGATION_PARENT_TAGS 포함) + `implicitStyles.ts:760-777` (동일 분기 공유)
- factory `createCheckboxGroupDefinition` 이 `tag: "CheckboxItems"` + `props: {}` 으로 CheckboxGroup 자식 생성 (`GroupComponents.ts:221`)
- factory `createRadioGroupDefinition` 이 `tag: "RadioItems"` + `props: {}` 으로 RadioGroup 자식 생성 (`GroupComponents.ts:330`)
- `fullTreeLayout.ts:117-118`: `"CheckboxItems"` / `"RadioItems"` 가 `LABEL_DELEGATION_PARENT_TAGS` Set 에 등록 — size prop 전파 경로 포함
- `implicitStyles.ts:760-777`: `containerTag === "radioitems" || containerTag === "checkboxitems"` 분기 — orientation 기반 flexDirection override + size-indexed gap 주입

### Soft Constraints

- ADR-098 Charter Decision: "composition 고유 네이밍은 Compositional Architecture 정당화 가능 시 유지 허용"
- ADR-100 SelectTrigger / ADR-101 ComboBoxTrigger / ADR-102 SelectIcon 선례 대칭 — Compositional Architecture 고유 element 정당화 패턴 통일.
- ADR-093 은 CheckboxItems/RadioItems 도입 배경을 상세히 기록 (D3 시각 스타일 layout primitive SSOT 목적).

## Alternatives Considered

### 대안 A: 정당화 유지 — CheckboxItems/RadioItems Compositional Architecture 고유 element 확증 (선정)

- 설명: CheckboxItems/RadioItems 를 D3 시각 스타일 layout 중간 컨테이너로 정당화. ADR-093 결정을 ADR-103 에서 재확인. RAC 공식 명칭 없음을 composition 고유 시각 구조 식별자로 확정. ADR-100/101/102 정당화 패턴 복제.
- 위험:
  - 기술: **LOW** — 정당화 문서 + spec 파일 주석 수준. Spec/factory/runtime 코드 변경 0.
  - 성능: **LOW**.
  - 유지보수: **LOW** — spec 이미 완비, ADR-093 Compositional Architecture 유지. 변경 0.
  - 마이그레이션: **LOW** — migration 0건. 기존 저장 데이터 그대로 유지.

### 대안 B: 제거 — CheckboxItems/RadioItems 삭제 후 RAC 직접 구조로 전환

- 설명: CheckboxItems/RadioItems element 를 소멸시키고 CheckboxGroup/RadioGroup 이 Label + Checkbox/Radio 를 직접 배치하도록 구조 변경. factory `createCheckboxGroupDefinition` / `createRadioGroupDefinition` 에서 중간 컨테이너 생성 제거. RAC 공식 구조와 일치.
- 위험:
  - 기술: **HIGH** — factory 변경 + ADR-093 spec 제거 + implicitStyles 분기 전면 재작성 (`checkboxgroup`/`radiogroup` 분기에 orientation fork 흡수) + fullTreeLayout LABEL_DELEGATION_PARENT_TAGS 재배선. 5+ 경로 동시 수정.
  - 성능: **LOW**.
  - 유지보수: **MED** — CheckboxGroup/RadioGroup Spec 이 label + checkbox/radio 모두 담당 → Spec 책임 혼합. orientation 기반 Items 전환 로직을 Group Spec 내부로 흡수 시 복잡도 증가.
  - 마이그레이션: **HIGH** — 기존 CheckboxGroup/RadioGroup 사용 프로젝트의 CheckboxItems/RadioItems element (저장 데이터) migration 필요. `applyCollectionItemsMigration` 는 items 배열 내부 객체 migration 용 — 일반 element tree migration 전례 없음. **0% 재직렬화 불가**.

### Risk Threshold Check

| 대안                            | 기술 | 성능 | 유지보수 | 마이그레이션 | HIGH+ 수 | 판정     |
| ------------------------------- | :--: | :--: | :------: | :----------: | :------: | -------- |
| A: 정당화 유지 (ADR-093 재확인) |  L   |  L   |    L     |      L       |    0     | **PASS** |
| B: 제거 후 RAC 직접 구조        |  H   |  L   |    M     |      H       |    2     | 기각     |

대안 A 가 HIGH 0 + 모든 축 LOW + BC 0% + ADR-100/ADR-101/ADR-102 패턴 대칭 → threshold pass.

**반복 패턴 선차단 체크** (adr-writing.md Top 1~4):

- ✅ **#1 코드 경로 인용**: Context 에서 `GroupComponents.ts:221,330`, `fullTreeLayout.ts:117-118`, `implicitStyles.ts:760-777` 4 경로 + occurrence 명시.
- ✅ **#2 Generator 확장 여부**: 정당화 유지 결정 — Spec/Generator/schema 확장 불필요. 주석 + 문서 수준 작업만.
- ✅ **#3 BC 훼손 수식화**: CheckboxItems/RadioItems **BC HIGH** 확인 (factory 직렬화 `tag: "CheckboxItems"` / `tag: "RadioItems"`). 대안 A 채택으로 실질 migration **0건 / 0% 파일 재직렬화**.
- ✅ **#4 Phase 분리 가능성**: Phase 0 (정당화 문서) + Phase 1 (spec 주석 sweep) + Phase 2 (README 갱신) 완전 독립.

## Decision

**대안 A (정당화 유지 — CheckboxItems/RadioItems Compositional Architecture 고유 D3 레이아웃 컨테이너 확증) 채택**.

선택 근거:

1. **D3 시각 스타일 domain 귀속** — CheckboxItems/RadioItems 는 `containerStyles` 에서 `display:flex` / `flexDirection:column` 과 `sizes.sm/md/lg` 의 `gap:8/12/16` 을 Spec SSOT 로 관리하는 D3 layout 컨테이너. RAC 공식 명칭 불일치는 D3 domain 에서 정당성 훼손 요인이 아님.
2. **BC HIGH 제거 불가** — factory `createCheckboxGroupDefinition:221` / `createRadioGroupDefinition:330` 이 `tag: "CheckboxItems"` / `tag: "RadioItems"` element 를 DB 에 직렬화. 제거 시 기존 모든 CheckboxGroup/RadioGroup 사용 프로젝트의 자식 구조 소실 → 기능 파괴. 대안 B 의 HIGH × 2 위험은 획득 가치(RAC 구조 통일) 대비 비용이 명백히 큰 불균형.
3. **ADR-093 Compositional Architecture 유지** — ADR-093 은 3단 구조 (`CheckboxGroup > CheckboxItems > Checkbox`) 를 D3 layout 분리 관점에서 결정한 Implemented ADR. 본 ADR 은 그 결정을 재확인하는 정당화 문서.
4. **spec 완비 상태 유지** — `CheckboxItems.spec.ts` / `RadioItems.spec.ts` 는 ADR-093 Phase 1 에서 이미 신설 완료. `containerStyles` / `sizes` / `skipCSSGeneration: true` / `render.shapes: () => []` 전부 구현됨. 추가 코드 변경 0.
5. **ADR-100/101/102 패턴 대칭** — SelectTrigger (ADR-100 selfcontained) / ComboBoxTrigger (ADR-101 selfcontained) / SelectIcon (ADR-102 selfcontained) 과 동일한 "Compositional Architecture 고유 element selfcontained 정당화" 경로. 판정 기준 일관성 확보.

기각 사유:

- **대안 B 기각**: HIGH 2 (기술 + 마이그레이션). 기존 저장 데이터 migration (전례 없는 일반 element migration) + implicitStyles/factory/spec/fullTreeLayout 5+ 경로 전면 재작성. RAC 구조 통일이라는 D1 편의 목적으로 D3 Compositional Architecture 를 파괴하는 것은 SSOT 원칙에 역행.

`CSSGenerator` / spec schema 확장 불필요. runtime DOM 은 이미 `<div>` 로 시각/레이아웃 전용 렌더링.

## Risks

| ID  | 위험                                                                              | 심각도 | 대응                                                                                                 |
| --- | --------------------------------------------------------------------------------- | :----: | ---------------------------------------------------------------------------------------------------- |
| R1  | RAC/RSP 가 미래에 공식 CheckboxItems / RadioItems primitive 를 추가할 경우 충돌   |  LOW   | ADR-098 Charter R1 (RSP/RAC API 변동 재검증) 에 포함. 공식 primitive 등장 시 본 ADR Superseded 전환. |
| R2  | ADR-093-A1 (items SSOT 완전 이관) 후속 ADR 발행 시 본 ADR 정당화 근거 부분 무효화 |  LOW   | ADR-093-A1 은 중간 컨테이너 element 소멸을 포함하는 별도 대형 ADR. 발행 시 본 ADR Superseded 전환.   |
| R3  | orientation runtime fork 가 spec containerStyles 와 충돌하는 edge case            |  LOW   | ADR-093 Phase 2/3 에서 이미 검증 완료. implicitStyles 분기는 spec 기본값 오버라이드 방식으로 안전.   |

잔존 HIGH 위험 없음.

## Gates

잔존 HIGH 위험 없음 — Gate 테이블 생략. 본 ADR 자체 검증 기준:

| 시점         | 통과 조건                                                                                                 |
| ------------ | --------------------------------------------------------------------------------------------------------- |
| Phase 0 완료 | BC 재평가 + 시나리오 판정 + 2 대안 평가 완료 (본 ADR 본문)                                                |
| Phase 1 완료 | CheckboxItems/RadioItems selfcontained 정당화 섹션 (runtime code-level 증거 4건) + spec 주석 sweep        |
| Phase 2 완료 | README.md ADR-103 Implemented 추가 + type-check 3/3 + specs 205/205 + builder 227/227 + shared 52/52 PASS |

## Consequences

### Positive

- **D3 domain 귀속 확증** — CheckboxItems/RadioItems 가 시각 스타일 domain (D3) layout 컨테이너임을 ADR 레벨에서 명문화. SSOT 체인 3-Domain 분할 준수 명확화.
- **BC HIGH 회피** — 기존 CheckboxGroup/RadioGroup 사용 프로젝트 저장 데이터 재직렬화 비용 0. 대안 B 의 migration 부담 (모든 CheckboxGroup/RadioGroup 프로젝트 + 중간 컨테이너 구조 migration) 완전 제거.
- **ADR-093 결정 안정화** — ADR-093 의 3단 구조 결정이 ADR-103 정당화로 이중 확인. 향후 유사 판정의 명확한 선례.
- **ADR-100/101/102/103 패턴 4종 통일** — SelectTrigger / ComboBoxTrigger / SelectIcon / CheckboxItems+RadioItems 모두 동일한 "Compositional Architecture 고유 element selfcontained 정당화" 패턴. 감사 체인 완결.

### Negative

- **RAC 미매핑 지속** — composition `CheckboxItems` / `RadioItems` element 와 RAC 공식 구조의 명칭/계층 divergence 유지. 신규 개발자 온보딩 시 문서 참조 필요.
- **ADR-093-A1 의존** — CheckboxItems/RadioItems 중간 컨테이너 소멸은 ADR-093-A1 (items SSOT 완전 이관) 으로 미룸. 궁극 RAC 정합은 별도 대형 ADR 필요.

## CheckboxItems / RadioItems 정당화 (ADR-098-e selfcontained)

ADR-098-e (composition 고유 네이밍 정당화 통합 문서) 본 ADR 이 CheckboxItems/RadioItems 정당화를 selfcontained 보존. ADR-100 SelectTrigger / ADR-101 ComboBoxTrigger / ADR-102 SelectIcon 정당화와 구조 대칭.

### 정당화 근거 4건

| #   | 근거                                                        | 코드 증거 (2026-04-21)                                                                                                                                                                     |
| --- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | **저장 식별자 고유성 — D3 layout 전용 중간 컨테이너**       | `apps/builder/src/builder/factories/definitions/GroupComponents.ts:221` (`tag:"CheckboxItems"` 자식 생성), `:330` (`tag:"RadioItems"` 자식 생성)                                           |
| 2   | **Spec SSOT 완비 — containerStyles + sizes 완전 구현**      | `packages/specs/src/components/CheckboxItems.spec.ts` (`containerStyles:{display:"flex",flexDirection:"column"}` + `sizes.sm/md/lg gap:8/12/16`), `RadioItems.spec.ts` (동일 구조)         |
| 3   | **LABEL_DELEGATION_PARENT_TAGS 등록 — size prop 전파 경로** | `apps/builder/src/builder/workspace/canvas/layout/engines/fullTreeLayout.ts:117-118` (`"CheckboxItems"` / `"RadioItems"` Set 등록 — 부모 size → 자식 Label 위임 경로)                      |
| 4   | **orientation runtime fork 전용 분기**                      | `apps/builder/src/builder/workspace/canvas/layout/engines/implicitStyles.ts:760-777` (`containerTag === "radioitems" \|\| containerTag === "checkboxitems"` 분기 — orientation + gap 주입) |

### runtime 경로 증거

- **Factory 생성**: `createCheckboxGroupDefinition` 이 CheckboxGroup element 생성 시 Label + CheckboxItems 포함 — `GroupComponents.ts:206-278`. CheckboxItems props: `{}` (size/orientation 은 CheckboxGroup 으로부터 propagation)
- **Factory 생성**: `createRadioGroupDefinition` 이 RadioGroup element 생성 시 Label + RadioItems 포함 — `GroupComponents.ts:315-409`. RadioItems props: `{}`
- **layout implicit styles**: `implicitStyles.ts:760` `containerTag === "radioitems" || containerTag === "checkboxitems"` 분기 — 부모 `orientation` 에 따라 `flexDirection:"row"` + `alignItems:"center"` override (horizontal 시), size-based gap 주입 (sm:8/md:12/lg:16)
- **LABEL_DELEGATION_PARENT_TAGS**: `fullTreeLayout.ts:117-118` `"CheckboxItems"` / `"RadioItems"` Set 등록 — 조상 CheckboxGroup/RadioGroup 의 size prop → 자손 Label 위임 경로에 포함

### 대안 B (제거) 기각 근거 재확인

CheckboxItems/RadioItems 제거 시 발생하는 구체적 문제:

- **저장 데이터 파괴**: `tag: "CheckboxItems"` / `tag: "RadioItems"` 직렬화 element 소멸 → 기존 모든 CheckboxGroup/RadioGroup 사용 프로젝트 자식 구조 파괴. `applyCollectionItemsMigration` 는 items 배열 내부 객체 migration 용 — 일반 element tree migration 전례 없음.
- **ADR-093 Compositional Architecture 훼손**: CheckboxGroup/RadioGroup > Items > Checkbox/Radio 3단 구조는 Label 과 Checkbox/Radio 집합 사이의 flex 레이아웃 분리를 위한 설계. 제거 시 CheckboxGroup Spec 이 Label + Items 레이아웃 모두 담당 → orientation fork + size-indexed gap 로직을 Group Spec 내부로 흡수 필요 (복잡도 증가).
- **implicitStyles 분기 전면 재작성**: `implicitStyles.ts:760-777` `checkboxgroup`/`radiogroup` 분기로 orientation fork 흡수 필요. `fullTreeLayout.ts:117-118` LABEL_DELEGATION_PARENT_TAGS 재배선. spec `CheckboxItems.spec.ts` / `RadioItems.spec.ts` 제거 + `CheckboxGroup.spec.childSpecs` / `RadioGroup.spec.childSpecs` 재배선.

D3 시각 SSOT 관점에서 CheckboxItems/RadioItems 는 이미 `containerStyles` + `sizes` Spec 완비 상태로 완전 정합 — 제거로 얻는 이점 없음.

## 참조

- [ADR-098](098-rsp-naming-audit-charter.md) — RSP 네이밍 정합 감사 Charter (본 ADR 의 상위 charter, 098-e 슬롯)
- [ADR-093](093-synthetic-merge-containers-spec.md) — 중간 컨테이너 spec 신설 ADR (CheckboxItems/RadioItems 도입 결정, 선행 근거)
- [ADR-100](100-select-child-naming-rsp-alignment.md) — 098-a 슬롯 (SelectTrigger 정당화 선례, 동일 패턴 적용)
- [ADR-101](101-combobox-child-naming-rsp-alignment.md) — 098-b 슬롯 (ComboBoxTrigger 정당화 선례, 동일 패턴 적용)
- [ADR-102](102-select-icon-justification.md) — 098-d 슬롯 (SelectIcon 정당화 선례, 동일 패턴 적용)
- [ADR-099](099-collection-section-expansion.md) — 098-c 슬롯 (Section 계열 확장, 병행 Implemented)
- [ADR-063](063-ssot-chain-charter.md) — SSOT 체인 D1/D2/D3 domain 원칙
- [ssot-hierarchy.md](../../../.claude/rules/ssot-hierarchy.md) — 3-domain 정본
