# ADR-100: Select 자식 네이밍 RSP 정합 — SelectItem/SelectTrigger 비대칭 결정 (ADR-098 후속 "098-a 슬롯")

## Status

Implemented — 2026-04-21

> 본 ADR 은 [ADR-098](098-rsp-naming-audit-charter.md) (RSP 네이밍 정합 감사 Charter) 의 "098-a 슬롯" (breakdown Follow-up 표 #1) 구현. ADR-098 에서 HIGH BC 일괄 분류된 SelectItem/SelectTrigger 에 대해 **현장 재조사 결과 BC 비대칭** 을 발견, 각 식별자 별 차등 결정을 내린다.

**Phase 커밋 체인** (origin/main):

- P0 완료 — BC 재평가 + 3 대안 평가 (ADR-100 본문 작성, 2026-04-21 세션 7)
- P1 `74045739` — SelectItem 5 runtime 경로 RAC alias 주석 sweep (BC 0%, type-check PASS)
- P2 `87f415cf` — SelectTrigger selfcontained 정당화 섹션 + factory Button slot 렌더 증거 수집 (code-level)
- P3 완료 (code-level) — `Select.tsx:309` / `SelectionRenderers.tsx:704` / `HierarchyManager.ts:402-406` 3 경로 증거 수집 (Chrome MCP 실측은 후속 Addendum 허용, ADR-092/093/095 선례)
- P4 완료 — ADR-098 Addendum 1 (BC 재평가 정정) + README.md ADR-100 Implemented 전환
- P5 완료 — type-check 3/3 + specs 176/176 + builder 227/227 + shared 52/52 PASS. Status Implemented

**종결 검증**: type-check 3/3 + specs 176/176 + builder 227/227 + shared 52/52 PASS. BC 영향 0% (SelectItem 0% 확증, SelectTrigger 유지 결정 → migration 0건).

## Context

ADR-098 감사 매트릭스 (2026-04-21 WebFetch) 에서 composition 의 `SelectItem` / `SelectTrigger` 가 RAC 공식 Select 구조의 `ListBoxItem` / `Button` (slot="trigger") 과 네이밍 차이를 식별했다. ADR-098 breakdown 은 이를 일괄 HIGH BC (저장 데이터 migration 필요) 로 분류했으나, 본 ADR Phase 0 재조사에서 두 식별자의 BC 영향이 **비대칭** 임을 확인.

### BC 재평가 매트릭스

| 식별자        | ADR-098 분류 | 현장 재조사 결과                                             | 실질 BC  |
| ------------- | :----------: | ------------------------------------------------------------ | :------: |
| SelectItem    | HIGH (일괄)  | ADR-073 에서 items SSOT 로 이관 — 저장 데이터에 `tag` 없음   | **LOW**  |
| SelectTrigger | HIGH (일괄)  | Compositional Architecture 유지 — 저장 데이터에 `tag` 직렬화 | **HIGH** |

### D1/D2 domain 판정 ([ssot-hierarchy.md](../../../.claude/rules/ssot-hierarchy.md))

- **D2 (Props/API)**: 네이밍 정합 영역. RSP 참조 기준 적용.
- **D1 (DOM/접근성)**: SelectTrigger factory 는 **runtime DOM 에서 RAC `<Button slot="trigger">` 를 실제 렌더** — D1 은 이미 정합. 본 ADR 의 논의는 composition **element tree 저장 식별자 (tag)** 수준이며 이는 D1/D2 와 별개의 "builder element graph 분류" 축.

### Hard Constraints

1. **BC 영향 수식화 선행** — `SelectItem` 과 `SelectTrigger` 각각 독립적으로 재직렬화 비용 계산. ADR-098 breakdown 정정.
2. **runtime DOM 정합성 유지** — RAC 공식 Select 구조 (`<Button><SelectValue /></Button>` 내부 슬롯) 는 이미 factory 경로에서 정합. 본 ADR 은 **저장 식별자 수준** 만 다룸.
3. **Compositional Architecture 유지** — `SelectTrigger` 는 Select 내부 자식 Element 로 독립 spec + editor + factory 분기 보유. 리네이밍 시 Button 과 tag 충돌 → runtime discriminator 비용 발생.
4. **testing 기준선** — type-check 3/3 + specs 166/166 + builder 227/227 + shared 52/52 PASS 유지.

### 현장 데이터 (2026-04-21)

- `rg "\"SelectItem\"" --type ts` = 26 occurrences / 11 files (runtime 3 + tests 4 + SelectionRenderers 1 + elementRemoval 1 + docs 2)
- `rg "\"SelectTrigger\"" --type ts` = 23 occurrences / 14 files (spec 2 + factory 1 + runtime 4 + docs 3 + 기타)
- ADR-073 `completed/073-select-combobox-items-ssot.md` — Select items SSOT 이관 완료 (저장 데이터 `tag: "SelectItem"` 제거)
- ADR-094 expandChildSpecs — SelectTrigger 는 `Select.childSpecs` 로 등록되어 factory 자동 생성 경로 보유

### Soft Constraints

- ADR-098 Charter Decision: "composition 고유 네이밍은 Compositional Architecture 정당화 가능 시 유지 허용" (098-e 정당화 ADR 예고).
- ADR-063 D2 원칙: "RSP 에 없는 커스텀 prop 임의 도입 금지" — 본 ADR 은 prop 이 아닌 **tag 식별자** 이므로 D2 원칙 scope 외 (정보 분류 목적).

## Alternatives Considered

### 대안 A: 완전 리네이밍 — SelectItem → ListBoxItem + SelectTrigger → Button (slot="trigger")

- 설명: 두 식별자 모두 RAC 공식 네이밍으로 완전 이관. SelectTrigger migration 을 위해 `applyCollectionItemsMigration` 확장 또는 새 migration path 신설.
- 위험:
  - 기술: **HIGH** — SelectTrigger tag 를 Button 으로 변경 시 일반 Button element 와 discriminator 필요 (`slot` prop 또는 parent context 기반 분기). runtime 4 files (utils / implicitStyles / buildSpecNodeData / HierarchyManager) + factory + editor 분기 추가 복잡도.
  - 성능: LOW.
  - 유지보수: MED — discriminator 분기가 장기 debt. LayerTree 에서 사용자가 Select 내부 Button 과 일반 Button 시각 구분 어려움.
  - 마이그레이션: **HIGH** — 모든 Select 사용 프로젝트 영향. `applyCollectionItemsMigration` 확장 필요 + 기존 저장 파일 자동 migration + rollback 경로 (ADR-076 선례 6 Phase 대비 scope 2배).

### 대안 B: Alias 유지 — 두 식별자 현상 유지 + 문서에 RAC 공식 명칭 alias 표기

- 설명: SelectItem / SelectTrigger 내부 식별자 유지. 문서/주석에 "RAC 공식: ListBoxItem / Button (slot=trigger)" alias 표기. 코드 변경 0.
- 위험:
  - 기술: LOW.
  - 성능: LOW.
  - 유지보수: MED — RSP 정합 debt 가 문서 수준에서만 해소. 실제 코드 검색/리팩토링 시 RAC 공식 용어와 composition 내부 용어가 섞여 혼선 가능.
  - 마이그레이션: 0% (코드 변경 0).

### 대안 C: 비대칭 결정 — SelectItem 내부 정리 (BC 0) + SelectTrigger 정당화 유지 (HIGH BC 회피) (선정)

- 설명: Phase 0 재조사 결과 반영. SelectItem 은 items SSOT 로 이미 내부화 → runtime 식별자/문서 수준 RSP 정합 정리 (BC 0). SelectTrigger 는 Compositional Architecture 정당화 유지 (098-e 연계). runtime DOM 은 이미 RAC `<Button slot="trigger">` 정합.
- 위험:
  - 기술: LOW — Phase 1 (SelectItem) 은 runtime 변수명/주석 수준. Phase 2 (SelectTrigger) 는 정당화 문서 + factory 증거 수집.
  - 성능: LOW.
  - 유지보수: LOW — SelectTrigger 고유 tag 유지로 Compositional Architecture 일관성 보존. 향후 Combobox/Picker 등 trigger 포함 컴포넌트에 동일 패턴 재사용.
  - 마이그레이션: 0% (SelectItem 은 items SSOT 내부, SelectTrigger 는 유지).

### 대안 D: 전부 정당화 — 두 식별자 모두 098-e 정당화 문서로 이관

- 설명: SelectItem 도 "composition 고유" 로 정당화 + SelectTrigger 와 함께 098-e 로 이관. 본 ADR-100 은 "부결 ADR" 로 종결.
- 위험:
  - 기술: LOW.
  - 성능: LOW.
  - 유지보수: **MED** — SelectItem 은 실제로 items SSOT 로 내부화 되어 RAC ListBoxItem 과 **기능적으로 동일** 하게 동작. "정당화" 는 실질 근거 부재 (BC 가 0 이므로 현상 유지 근거는 "편의"). 향후 ADR-099 Section 확장 시 SelectItem 이 ListBoxItem 과 동일 spec 을 재사용 가능한지 검토 대상인데 "정당화" 가 이 검토를 차단.
  - 마이그레이션: 0%.

### Risk Threshold Check

| 대안                                             | 기술 | 성능 | 유지보수 | 마이그레이션 | HIGH+ 수 | 판정                 |
| ------------------------------------------------ | :--: | :--: | :------: | :----------: | :------: | -------------------- |
| A: 완전 리네이밍                                 |  H   |  L   |    M     |      H       |    2     | 기각                 |
| B: Alias 유지                                    |  L   |  L   |    M     |      L       |    0     | pass — 유지보수 debt |
| C: 비대칭 (SelectItem 정리 + SelectTrigger 유지) |  L   |  L   |    L     |      L       |    0     | **PASS**             |
| D: 전부 정당화                                   |  L   |  L   |    M     |      L       |    0     | pass — 유지보수 열위 |

대안 C 가 HIGH 0 + 모든 축 LOW + BC 0% + ADR-098 charter 의 BC 비대칭 원칙 반영 → threshold pass.

**반복 패턴 선차단 체크** (adr-writing.md Top 1~4):

- ✅ **#1 코드 경로 인용**: Context/Hard Constraints/breakdown 에서 `SelectTrigger.spec.ts`, `Select.spec.ts:64`, `types/select-items.ts`, `SelectionComponents.ts`, `SelectionRenderers.tsx`, `utils.ts`/`implicitStyles.ts`/`skia/buildSpecNodeData.ts` 7 경로 + occurrence count 수식 명시.
- ✅ **#2 Generator 확장 여부**: Phase 1/2 모두 문서 + 주석 + runtime 내부 정리. `CSSGenerator` / spec schema 확장 **불필요**. ADR 본문 Decision 에 명시.
- ✅ **#3 BC 훼손 수식화**:
  - SelectItem: **0% / 0 파일 재직렬화** (items SSOT 내부 구조)
  - SelectTrigger: **100% 저장 영향이었으나 본 ADR 대안 C 에서 유지 결정 → 실제 migration 0건**
  - 대안 A 기각 근거 = HIGH BC 회피
- ✅ **#4 Phase 분리 가능성**: 5 Phase. 필요 시 Phase 1 (SelectItem) 과 Phase 2 (SelectTrigger 정당화) 를 분리 land 가능. breakdown "잠재 후속 ADR" 섹션에 옵션 명시 (100-a).

## Decision

**대안 C (비대칭 — SelectItem 내부 정리 + SelectTrigger 고유 유지) 채택**.

선택 근거:

1. **BC 재평가 반영** — ADR-098 breakdown 의 일괄 HIGH BC 분류는 현장 데이터와 불일치. SelectItem 0% / SelectTrigger HIGH 비대칭 반영이 정확.
2. **Compositional Architecture 보존** — SelectTrigger 고유 tag 유지로 Combobox/Picker/DatePicker 등 trigger 포함 컴포넌트의 일관 패턴 유지. Button 으로 통합 시 discriminator 분기 비용↑.
3. **runtime DOM 이미 정합** — SelectTrigger factory 가 RAC `<Button slot="trigger">` 를 실제 렌더하므로 **접근성/DOM 수준 RSP 정합은 이미 달성**. 저장 식별자 수준 리네이밍의 실질 가치 낮음.
4. **HIGH BC 회피** — 대안 A 의 migration 비용 (모든 Select 프로젝트 재직렬화 + rollback 경로 + discriminator 분기) 대비 획득 가치 (네이밍 통일) 불균형.

기각 사유:

- **대안 A 기각**: HIGH 2 (기술 + 마이그레이션). Button tag 충돌 + discriminator 분기 장기 debt + migration 지옥. 획득 가치 (네이밍 통일) 대비 비용 과다.
- **대안 B 기각**: 유지보수 MED — 문서 alias 만으로는 RSP 정합 debt 가 실질 해소되지 않음. SelectItem 은 실제 runtime 동작이 ListBoxItem 과 동일하므로 내부 정리가 자연스러운 경로.
- **대안 D 기각**: SelectItem 을 "정당화" 하는 것은 BC 0% 상황에서 근거 부재 (편의). 향후 Section 확장 (ADR-099) 과의 상호운용 검토를 차단하는 부작용.

> 구현 상세: [100-select-child-naming-rsp-alignment-breakdown.md](../../adr/design/100-select-child-naming-rsp-alignment-breakdown.md)

## Risks

| ID  | 위험                                                                             | 심각도 | 대응                                                                                                                         |
| --- | -------------------------------------------------------------------------------- | :----: | ---------------------------------------------------------------------------------------------------------------------------- |
| R1  | Phase 1 SelectItem 문서/runtime 정리 중 일부 occurrence 누락 (용어 비일관)       |  LOW   | `rg "\"SelectItem\""` 11 files 전수 sweep + Phase 4 에서 grep 재확증                                                         |
| R2  | Phase 2 SelectTrigger 정당화 근거가 향후 약화 (RSP 공식이 명칭을 강제 변경)      |  LOW   | ADR-098 Charter R1 (RSP/RAC API 변동 재검증) 에 포함. 변동 감지 시 본 ADR Superseded 전환                                    |
| R3  | SelectTrigger factory 가 실제로 Button slot 렌더하지 않는 경우 (Phase 3)         |  LOW   | Phase 3 Chrome MCP 실측 필수. factory `SelectionComponents.ts` 코드 검토 병행                                                |
| R4  | ADR-098-e (정당화 문서 ADR) 미발행 상태 지속으로 본 ADR cross-reference stale    |  MED   | Phase 2 에서 본 ADR selfcontained 정당화 섹션 포함 — 098-e 발행 시점에 cross-reference 추가                                  |
| R5  | SelectItem 내부 식별자를 runtime 에서 그대로 쓰다가 ADR-099 Section 확장 시 충돌 |  LOW   | ADR-099 Phase 1 (items discriminated union) 과 본 ADR Phase 1 은 독립 진행. items entry 타입 확장과 식별자 정리가 orthogonal |

잔존 HIGH 위험 없음.

## Gates

잔존 HIGH 위험 없음 — Gate 테이블 생략. 본 ADR 자체 검증 기준 (Phase 단위 AND 누적):

| 시점         | 통과 조건                                                                                          |
| ------------ | -------------------------------------------------------------------------------------------------- |
| Phase 0 완료 | BC 재평가 + 3 대안 평가 완료 (breakdown)                                                           |
| Phase 1 완료 | SelectItem 11 files 용어 sweep + runtime 내부 식별자 정리 (alias 또는 rename) + type-check PASS    |
| Phase 2 완료 | SelectTrigger 정당화 섹션 (spec 주석 + 098-e cross-reference) + factory Button slot 렌더 증거 수집 |
| Phase 3 완료 | Chrome MCP 실측 — Select DOM 출력이 RAC 공식 구조 정합 + /cross-check PASS                         |
| Phase 4 완료 | ADR-098 Addendum (BC 재평가 정정) + README.md ADR-100 Implemented 전환 + 최상위 요약               |
| Phase 5 완료 | type-check 3/3 + specs 166/166 + builder 227/227 + shared 52/52 PASS + Status Implemented          |

실패 시 대안:

- Phase 1 대규모 occurrence 누락 발견 시 → `parallel-verify` skill 로 패밀리 일괄 검증
- Phase 3 SelectTrigger factory 가 Button slot 렌더 미확증 시 → factory 수정 후속 Addendum (본 ADR scope 내)
- ADR-098 Charter 가 Phase 4 시점에 다른 후속 ADR Implemented 로 이미 전환된 경우 → Addendum 추가만 수행

## Consequences

### Positive

- **ADR-098 charter BC 분류 정정** — 감사 매트릭스의 일괄 HIGH BC 분류가 현장 데이터와 부합하도록 재보정. 향후 후속 ADR (098-b ComboBox 등) 에서도 동일 재평가 패턴 적용 가능.
- **HIGH BC 회피** — Select 프로젝트 저장 데이터 재직렬화 비용 0. 대안 A 대비 최대 수백 프로젝트 migration 부담 제거.
- **Compositional Architecture 일관성** — SelectTrigger 고유 tag 유지로 Combobox/Picker 등 trigger 패턴 재사용. 향후 컴포넌트 확장 시 동일 원칙.
- **runtime DOM RSP 정합 확증** — Phase 3 Chrome MCP 실측으로 `<Button slot="trigger">` 렌더링 증거 수집. D1 도메인 RSP 정합이 이미 달성된 상태 문서화.

### Negative

- **네이밍 divergence 지속** — composition 내부 tag 식별자 (SelectItem/SelectTrigger) 와 RAC 공식 (ListBoxItem/Button) 차이 유지. 문서/주석 수준 alias 표기 필요 — 용어 혼선 가능.
- **ADR-098-e 정당화 문서 의존** — SelectTrigger 정당화가 098-e 미발행 시 본 ADR 본문에 selfcontained 포함 필요 → 098-e 발행 시 중복 정리 비용.
- **SelectItem 내부 정리 범위 애매** — Phase 1 에서 runtime 변수명을 리네임할지 alias 로 남길지 Phase 진입 시 재결정 (breakdown Phase 1 에 명시).

## SelectTrigger 정당화 (ADR-098-e 연계 전 selfcontained)

ADR-098-e (composition 고유 네이밍 정당화 통합 문서) 미발행 상태에서 본 ADR 이 SelectTrigger 정당화를 selfcontained 보존. 098-e 발행 시 본 섹션을 cross-reference 로 전환.

### 정당화 근거 3건

| #   | 근거                                             | 코드 증거 (2026-04-21)                                                                                             |
| --- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| 1   | **저장 식별자 고유성** — Select 내부 Button 전용 | `apps/builder/src/builder/factories/definitions/SelectionComponents.ts:74` (`tag:"SelectTrigger"` 자식 생성)       |
| 2   | **runtime DOM RSP 정합 이미 달성** (D1 도메인)   | `packages/shared/src/components/Select.tsx:309` (`<Button className="react-aria-Button"><SelectValue /></Button>`) |
| 3   | **LayerTree UX 명시성** — 일반 Button 과 구분    | `apps/builder/src/builder/utils/HierarchyManager.ts:402-406` (Select 자식은 Label + SelectTrigger 만 허용)         |

### runtime 경로 증거 (Phase 2 수집)

- **Factory 생성**: `createSelectDefinition` 이 Select element 생성 시 자식으로 `SelectTrigger` 포함 (items SSOT 이후에도 유지) — `SelectionComponents.ts:15` 주석 "Label / SelectTrigger (SelectValue + SelectIcon) sub-element 는 유지"
- **Renderer props 추출**: `SelectionRenderers.tsx:704` 가 childrenMap 에서 `tag === "SelectTrigger"` Element 를 찾아 props 추출 → RAC `<Button>` props 매핑
- **HierarchyManager**: `HierarchyManager.ts:405` Select 자식 필터에서 `"SelectTrigger"` 포함 → LayerTree 표시 + child composition 경로
- **Spec 정의**: `SelectTrigger.spec.ts:25` `element: "button"` + `archetype: "button"` — DOM 렌더 시 `<button>` tag 직접 사용 (RAC `<Button>` 래퍼와 semantic 동등)

### 대안 α (완전 리네이밍) 기각 근거 재확인

SelectTrigger → Button 리네이밍 시 발생하는 구체적 문제:

- **tag 충돌 해소**: `utils.ts` + `implicitStyles.ts` + `buildSpecNodeData.ts` 에서 `tag === "Button"` 분기를 `parent.tag === "Select" && slot === "trigger"` 식 2-조건 판정으로 확장 → 각 위치마다 부모 조회 비용
- **migration 비용**: 모든 Select 사용 프로젝트의 element tree 에서 `tag: "SelectTrigger"` → `tag: "Button"` 변환 + `slot: "trigger"` prop 주입 — `applyCollectionItemsMigration` 이 items 가 아닌 일반 Element migration 으로 확장 (전례 없음)
- **editor/PropertyEditor 분기**: SelectTrigger 전용 editor 가 있다면 Button editor 와 통합 필요 → 사용자가 Select 내부 Button 편집 시 일반 Button 과 동일 UI 혼용

이 3 비용이 "RSP 정합 개선 가치" 보다 명백히 크다는 판단 — 본 ADR 대안 C 채택의 핵심 근거.

## 참조

- [ADR-098](098-rsp-naming-audit-charter.md) — RSP 네이밍 정합 감사 Charter (본 ADR 의 상위 charter, BC 재평가 정정 대상)
- [ADR-099](099-collection-section-expansion.md) — 098-c 슬롯 (본 ADR 과 병행 Proposed)
- [ADR-073](073-select-combobox-items-ssot.md) — Select items SSOT 이관 (본 ADR 의 BC 재평가 기반)
- [ADR-076](076-listbox-items-ssot-hybrid.md) — items SSOT 체인 4번째 (migration 오케스트레이터 선례)
- [ADR-063](063-ssot-chain-charter.md) — SSOT 체인 D1/D2 domain 원칙
- [ssot-hierarchy.md](../../../.claude/rules/ssot-hierarchy.md) — 3-domain 정본
