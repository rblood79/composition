# ADR-101: ComboBox 자식 네이밍 RSP 정합 — ComboBoxItem/ComboBoxTrigger 비대칭 결정 (ADR-098-b 슬롯)

## Status

Implemented — 2026-04-21

> 본 ADR 은 [ADR-098](098-rsp-naming-audit-charter.md) (RSP 네이밍 정합 감사 Charter) 의 "098-b 슬롯" (breakdown Follow-up 표 #4) 구현. ADR-098 에서 HIGH BC 일괄 분류된 ComboBoxItem 에 대해 **ADR-100 SelectItem 선례 패턴 복제** — 현장 재조사 결과 BC 비대칭을 확인, 각 식별자 별 차등 결정을 내린다.

**Phase 커밋 체인** (origin/main):

- P0 완료 — BC 재평가 + ComboBoxTrigger 대칭 조사 + 3 대안 평가 (ADR-101 본문 작성, 2026-04-21 세션 10)
- P1 완료 — ComboBoxItem 6 runtime 경로 RAC alias 주석 sweep (BC 0%, App.tsx ADR-100 주석 기존 포함 확인)
- P2 완료 — ComboBoxTrigger selfcontained 정당화 섹션 (SelectTrigger 선례 대칭)
- P3 완료 — README.md ADR-101 Implemented 전환
- P4 완료 — type-check 3/3 + specs 205/205 + builder 227/227 + shared 52/52 PASS

**종결 검증**: type-check 3/3 + specs 205/205 + builder 227/227 + shared 52/52 PASS. BC 영향 0% (ComboBoxItem 0% 확증, ComboBoxTrigger 유지 결정 → migration 0건).

## Context

ADR-098 감사 매트릭스 (2026-04-21 WebFetch) 에서 composition 의 `ComboBoxItem` / `ComboBoxTrigger` 가 RAC 공식 ComboBox 구조의 `ListBoxItem` / `Button` (slot="trigger" 대응) 과 네이밍 차이를 식별했다. ADR-098 breakdown 은 이를 일괄 HIGH BC (저장 데이터 migration 필요) 로 분류했으나, 본 ADR Phase 0 재조사 (ADR-100 SelectItem 선례 패턴 적용) 에서 두 식별자의 BC 영향이 **비대칭** 임을 확인.

### BC 재평가 매트릭스

| 식별자          | ADR-098 분류 | 현장 재조사 결과                                                                  | 실질 BC  |
| --------------- | :----------: | --------------------------------------------------------------------------------- | :------: |
| ComboBoxItem    | HIGH (일괄)  | ADR-073 에서 items SSOT 로 이관 — 저장 데이터에 `tag` 없음 (items 배열 내부 객체) | **LOW**  |
| ComboBoxTrigger | HIGH (일괄)  | Compositional Architecture 유지 — 저장 데이터에 `tag: "ComboBoxTrigger"` 직렬화   | **HIGH** |

### D1/D2 domain 판정 ([ssot-hierarchy.md](../../../.claude/rules/ssot-hierarchy.md))

- **D2 (Props/API)**: 네이밍 정합 영역. RSP 참조 기준 적용.
- **D1 (DOM/접근성)**: ComboBoxTrigger factory 는 **runtime DOM 에서 RAC ComboBox 내부 버튼을 실제 렌더** — D1 은 이미 정합. 본 ADR 의 논의는 composition **element tree 저장 식별자 (tag)** 수준이며 이는 D1/D2 와 별개의 "builder element graph 분류" 축.

### Hard Constraints

1. **BC 영향 수식화 선행** — `ComboBoxItem` 과 `ComboBoxTrigger` 각각 독립적으로 재직렬화 비용 계산. ADR-098 breakdown 정정.
2. **runtime DOM 정합성 유지** — RAC 공식 ComboBox 구조는 이미 factory 경로에서 정합. 본 ADR 은 **저장 식별자 수준** 만 다룸.
3. **Compositional Architecture 유지** — `ComboBoxTrigger` 는 ComboBox 내부 자식 Element 로 독립 spec + factory 분기 보유. ComboBoxWrapper 내부의 ComboBoxInput + ComboBoxTrigger 구조가 저장 데이터에 직렬화됨.
4. **testing 기준선** — type-check 3/3 + specs 205/205 + builder 227/227 + shared 52/52 PASS 유지.

### 현장 데이터 (2026-04-21)

- `rg "\"ComboBoxItem\"" --type ts` = 6 occurrences / 5 files (runtime 경로: `migrateCollectionItems.ts` / `SelectionRenderers.tsx` / `elementRemoval.ts` / `App.tsx` / `utils.ts`)
- `rg "\"ComboBoxTrigger\"" --type ts` = 14+ occurrences / 10+ files (spec 1 + factory 2 + runtime 4 (buildSpecNodeData/implicitStyles/fullTreeLayout/tagSpecMap) + HierarchyManager + SelectionRenderers + FormComponents)
- ADR-073 `completed/073-select-combobox-items-ssot.md` — Select/ComboBox items SSOT 이관 완료 (저장 데이터 `tag: "ComboBoxItem"` 제거)
- App.tsx L499~505 에 이미 ADR-100 Phase 1 주석이 `SelectItem`/"ComboBoxItem" 양쪽 포함 — **ComboBoxItem 주석 sweep 은 기존 완료**
- `ComboBox.tsx` 에 React 렌더 컴포넌트 `ComboBoxItem` (`extends ListBoxItemProps`) 존재 — 이는 element tree 저장 식별자가 아니라 **외부 소비자 API 컴포넌트** (별개 축)

### RAC 공식 ComboBoxItem 명칭과 동일성 (특이사항)

ADR-100 SelectItem 의 경우 RAC 공식 명칭은 `ListBoxItem` 이었다 (이름 다름). 반면 composition `ComboBoxItem` 과 RAC 공식 `ComboBoxItem` alias 는 **이름이 동일**. 따라서:

- composition element tag `"ComboBoxItem"` ≡ RAC alias `ComboBoxItem` (이름 일치)
- ADR-100 Phase 1 에서 "RAC 공식: ListBoxItem. composition 고유 식별자 유지" 형식의 alias 주석이 `SelectItem` 과 `ComboBoxItem` 양쪽에 이미 달려있음 (`App.tsx:499`)
- **실제 추가 주석 sweep scope = 0** (기존 ADR-100 주석이 ComboBoxItem 도 커버)

### Soft Constraints

- ADR-098 Charter Decision: "composition 고유 네이밍은 Compositional Architecture 정당화 가능 시 유지 허용" (098-e 정당화 ADR 예고).
- ADR-100 SelectItem/SelectTrigger 선례 대칭 — 동일 패턴의 ComboBox 판정.

## Alternatives Considered

### 대안 A: 완전 리네이밍 — ComboBoxItem → ListBoxItem + ComboBoxTrigger → Button

- 설명: 두 식별자 모두 RAC 공식 네이밍으로 완전 이관. ComboBoxTrigger migration 을 위해 `applyCollectionItemsMigration` 확장 또는 새 migration path 신설.
- 위험:
  - 기술: **HIGH** — ComboBoxTrigger tag 를 Button 으로 변경 시 일반 Button element 와 discriminator 필요 (parent context 기반 분기). runtime 4 files (buildSpecNodeData / implicitStyles / fullTreeLayout / HierarchyManager) + factory + 내부 구조 (ComboBoxWrapper > ComboBoxTrigger 계층) 분기 추가 복잡도. FormComponents.ts 의 NumberField 내 ComboBoxTrigger 분기도 영향.
  - 성능: LOW.
  - 유지보수: MED — discriminator 분기가 장기 debt. ComboBoxWrapper > ComboBoxInput + ComboBoxTrigger 3단 구조에서 부모 context 추적 비용.
  - 마이그레이션: **HIGH** — 모든 ComboBox 사용 프로젝트 영향. `applyCollectionItemsMigration` 이 items 가 아닌 일반 Element (ComboBoxWrapper/ComboBoxInput/ComboBoxTrigger) migration 으로 확장 (전례 없음).

### 대안 B: Alias 유지 — 두 식별자 현상 유지 + 문서에 RAC 공식 명칭 alias 표기

- 설명: ComboBoxItem / ComboBoxTrigger 내부 식별자 유지. 문서/주석에 RAC alias 표기. 코드 변경 0.
- 위험:
  - 기술: LOW.
  - 성능: LOW.
  - 유지보수: MED — RSP 정합 debt 가 문서 수준에서만 해소.
  - 마이그레이션: 0% (코드 변경 0).

### 대안 C: 비대칭 결정 — ComboBoxItem 내부 정리 (BC 0) + ComboBoxTrigger 정당화 유지 (HIGH BC 회피) (선정)

- 설명: Phase 0 재조사 결과 반영. ComboBoxItem 은 items SSOT 로 이미 내부화 → runtime 식별자/문서 수준 RSP 정합 정리 (BC 0). ComboBoxTrigger 는 Compositional Architecture 정당화 유지 (098-e 연계). runtime DOM 은 이미 정합.
- 위험:
  - 기술: LOW — Phase 1 (ComboBoxItem) 은 runtime 주석 수준. App.tsx ADR-100 주석 기존 포함. Phase 2 (ComboBoxTrigger) 는 정당화 문서.
  - 성능: LOW.
  - 유지보수: LOW — ComboBoxTrigger 고유 tag 유지로 Compositional Architecture 일관성 보존. SelectTrigger 선례와 대칭.
  - 마이그레이션: 0% (ComboBoxItem 은 items SSOT 내부, ComboBoxTrigger 는 유지).

### 대안 D: 전부 정당화 — 두 식별자 모두 098-e 정당화 문서로 이관

- 설명: ComboBoxItem 도 "composition 고유" 로 정당화. 코드 변경 0.
- 위험:
  - 기술: LOW.
  - 성능: LOW.
  - 유지보수: **MED** — ComboBoxItem 은 실제로 items SSOT 로 내부화 되어 RAC `ListBoxItem`/`ComboBoxItem` 와 **기능적으로 동일** 하게 동작. "정당화" 는 실질 근거 부재.
  - 마이그레이션: 0%.

### Risk Threshold Check

| 대안                                                 | 기술 | 성능 | 유지보수 | 마이그레이션 | HIGH+ 수 | 판정                 |
| ---------------------------------------------------- | :--: | :--: | :------: | :----------: | :------: | -------------------- |
| A: 완전 리네이밍                                     |  H   |  L   |    M     |      H       |    2     | 기각                 |
| B: Alias 유지                                        |  L   |  L   |    M     |      L       |    0     | pass — 유지보수 debt |
| C: 비대칭 (ComboBoxItem 정리 + ComboBoxTrigger 유지) |  L   |  L   |    L     |      L       |    0     | **PASS**             |
| D: 전부 정당화                                       |  L   |  L   |    M     |      L       |    0     | pass — 유지보수 열위 |

대안 C 가 HIGH 0 + 모든 축 LOW + BC 0% + ADR-100 SelectItem/SelectTrigger 선례 대칭 → threshold pass.

**반복 패턴 선차단 체크** (adr-writing.md Top 1~4):

- ✅ **#1 코드 경로 인용**: Context/Hard Constraints 에서 `migrateCollectionItems.ts:78`, `elementRemoval.ts:35`, `App.tsx:499-504`, `tagSpecMap.ts:218`, `implicitStyles.ts:1195-1196`, `buildSpecNodeData.ts:458-463`, `SelectionComponents.ts:193` 7 경로 + occurrence count 명시.
- ✅ **#2 Generator 확장 여부**: Phase 1/2 모두 문서 + 주석 + runtime 내부 정리. `CSSGenerator` / spec schema 확장 **불필요**. ADR 본문 Decision 에 명시.
- ✅ **#3 BC 훼손 수식화**:
  - ComboBoxItem: **0% / 0 파일 재직렬화** (items SSOT 내부 구조)
  - ComboBoxTrigger: **100% 저장 영향이었으나 본 ADR 대안 C 에서 유지 결정 → 실제 migration 0건**
- ✅ **#4 Phase 분리 가능성**: 2 Phase. Phase 1 (ComboBoxItem 주석 확인) 과 Phase 2 (ComboBoxTrigger 정당화) 완전 독립.

## Decision

**대안 C (비대칭 — ComboBoxItem 내부 정리 + ComboBoxTrigger 고유 유지) 채택**.

선택 근거:

1. **ADR-100 SelectItem/SelectTrigger 선례 대칭** — 동일 패턴 (items SSOT 이관 → BC 0% + Compositional Architecture trigger 유지) 을 ComboBox 에 재적용. 일관성 확보.
2. **BC 재평가 반영** — ADR-098 breakdown 의 일괄 HIGH BC 분류는 현장 데이터와 불일치. ComboBoxItem 0% / ComboBoxTrigger HIGH 비대칭 반영이 정확.
3. **ComboBoxItem 명칭 동일성** — composition tag `"ComboBoxItem"` 과 RAC alias `ComboBoxItem` 이 **이름 일치** (SelectItem vs ListBoxItem 과 달리). runtime 정합이 이미 100%.
4. **ComboBoxTrigger Compositional Architecture 보존** — ComboBoxWrapper > ComboBoxInput + ComboBoxTrigger 3단 구조가 저장 데이터에 직렬화. 리네이밍 시 Button tag 충돌 + discriminator 분기 비용 SelectTrigger 경우보다 더 복잡 (3단 계층 context 추적).
5. **HIGH BC 회피** — 대안 A 의 migration 비용 (모든 ComboBox 프로젝트 재직렬화 + 3단 계층 migration path) 대비 획득 가치 (네이밍 통일) 불균형.
6. **App.tsx 주석 기존 포함** — ADR-100 Phase 1 에서 `App.tsx:499` 에 "legacy 'SelectItem'/'ComboBoxItem' tag fallback" 주석이 이미 ComboBoxItem 을 명시. 추가 sweep scope = 실질 0.

기각 사유:

- **대안 A 기각**: HIGH 2 (기술 + 마이그레이션). ComboBoxWrapper > ComboBoxInput + ComboBoxTrigger 3단 구조 → discriminator context 추적이 SelectTrigger 보다 복잡. migration 지옥.
- **대안 B 기각**: 유지보수 MED — 문서 alias 만으로는 RSP 정합 debt 가 실질 해소되지 않음. ComboBoxItem 은 실제 runtime 동작이 ListBoxItem 과 동일 (ADR-073 migration).
- **대안 D 기각**: ComboBoxItem 을 "정당화" 하는 것은 BC 0% 상황에서 근거 부재 (편의). ADR-100 대안 D 기각과 동일 근거.

`CSSGenerator` / spec schema 확장 불필요. runtime DOM 은 이미 RAC 구조 정합 (factory ComboBox.tsx rendering 경로).

## Risks

| ID  | 위험                                                                          | 심각도 | 대응                                                                                                       |
| --- | ----------------------------------------------------------------------------- | :----: | ---------------------------------------------------------------------------------------------------------- |
| R1  | Phase 1 ComboBoxItem 문서/runtime 정리 중 일부 occurrence 누락 (용어 비일관)  |  LOW   | App.tsx ADR-100 주석 기존 포함 확인. `rg "\"ComboBoxItem\""` 5 files 전수 확인 + Phase 완결 시 grep 재확증 |
| R2  | ComboBoxTrigger 정당화 근거가 향후 약화 (RSP 공식이 명칭을 강제 변경)         |  LOW   | ADR-098 Charter R1 (RSP/RAC API 변동 재검증) 에 포함. 변동 감지 시 본 ADR Superseded 전환                  |
| R3  | ADR-098-e (정당화 문서 ADR) 미발행 상태 지속으로 본 ADR cross-reference stale |  MED   | Phase 2 에서 본 ADR selfcontained 정당화 섹션 포함 — 098-e 발행 시점에 cross-reference 추가                |
| R4  | ComboBoxWrapper/ComboBoxInput 도 유사한 네이밍 debt 존재 (미조사)             |  LOW   | 본 ADR scope 는 ComboBoxItem/ComboBoxTrigger 한정. 추후 ADR-098 Addendum 에서 별도 조사 가능.              |

잔존 HIGH 위험 없음.

## Gates

잔존 HIGH 위험 없음 — Gate 테이블 생략. 본 ADR 자체 검증 기준:

| 시점         | 통과 조건                                                                                      |
| ------------ | ---------------------------------------------------------------------------------------------- |
| Phase 0 완료 | BC 재평가 + 3 대안 평가 완료 (본 ADR 본문)                                                     |
| Phase 1 완료 | ComboBoxItem 5 files runtime 주석 확인 (App.tsx ADR-100 주석 기존 포함 확증) + type-check PASS |
| Phase 2 완료 | ComboBoxTrigger selfcontained 정당화 섹션 (factory code-level 증거 3건) + ADR-098 비고 추가    |
| Phase 3 완료 | README.md ADR-101 Implemented 전환 + 최상위 요약                                               |
| Phase 4 완료 | type-check 3/3 + specs 205/205 + builder 227/227 + shared 52/52 PASS + Status Implemented      |

## Consequences

### Positive

- **ADR-098 charter BC 분류 재정정** — ComboBoxItem 도 ADR-100 SelectItem 선례와 동일하게 items SSOT 이관 확증 → BC 0% 정정. 체계적 패턴 확립.
- **HIGH BC 회피** — ComboBox 프로젝트 저장 데이터 재직렬화 비용 0. 대안 A 대비 최대 수백 프로젝트 migration 부담 제거.
- **ComboBoxItem 명칭 동일성 확증** — RAC alias 와 이름 일치 → 실질 D2 정합 달성 상태.
- **SelectTrigger/ComboBoxTrigger 패턴 통일** — 두 trigger 식별자 모두 동일한 Compositional Architecture 정당화 경로 채택. 향후 DatePicker trigger 등 동일 패턴 재사용 기반.

### Negative

- **네이밍 divergence 지속 (ComboBoxTrigger)** — composition 내부 tag 식별자 (ComboBoxTrigger) 와 RAC 공식 구조 차이 유지. 문서/주석 수준 alias 표기 필요.
- **ADR-098-e 정당화 문서 의존** — ComboBoxTrigger 정당화가 098-e 미발행 시 본 ADR 본문에 selfcontained 포함 필요.
- **ComboBoxWrapper/ComboBoxInput 조사 보류** — 본 ADR scope 에서 제외. 추후 별도 조사 필요.

## ComboBoxTrigger 정당화 (ADR-098-e 연계 전 selfcontained)

ADR-098-e (composition 고유 네이밍 정당화 통합 문서) 미발행 상태에서 본 ADR 이 ComboBoxTrigger 정당화를 selfcontained 보존. 098-e 발행 시 본 섹션을 cross-reference 로 전환. SelectTrigger 정당화 (ADR-100 selfcontained 섹션) 와 구조 대칭.

### 정당화 근거 3건

| #   | 근거                                                  | 코드 증거 (2026-04-21)                                                                                                                |
| --- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **저장 식별자 고유성** — ComboBox 내부 버튼 전용      | `apps/builder/src/builder/factories/definitions/SelectionComponents.ts:193` (`tag:"ComboBoxTrigger"` 자식 생성, ComboBoxWrapper 내부) |
| 2   | **Compositional Architecture 3단 계층 보존**          | `packages/specs/src/components/ComboBox.spec.ts:684` (`childPath: ["ComboBoxWrapper", "ComboBoxTrigger"]` — 계층 구조 명시)           |
| 3   | **runtime 다중 분기 고유 처리** — 일반 Button 과 구분 | `apps/builder/src/builder/workspace/canvas/layout/engines/implicitStyles.ts:1195-1196` (ComboBoxTrigger 전용 iconName 전파 분기)      |

### runtime 경로 증거

- **Factory 생성**: `createComboBoxDefinition` 이 ComboBox element 생성 시 ComboBoxWrapper 내 자식으로 ComboBoxInput + ComboBoxTrigger 포함 — `SelectionComponents.ts:172-200`
- **Skia icon delegation**: `buildSpecNodeData.ts:458-463` 가 `"SelectIcon" || "ComboBoxTrigger"` 동일 경로로 grandparent iconName 위임 처리 — ComboBoxTrigger 전용 로직
- **layout implicit styles**: `implicitStyles.ts:1195` `child.tag === "ComboBoxTrigger"` 분기 — 조부모(ComboBox) iconName 전파
- **tagSpecMap**: `tagSpecMap.ts:218` `ComboBoxTrigger: SelectIconSpec` — Spec 매핑

### 대안 α (완전 리네이밍) 기각 근거 재확인

ComboBoxTrigger → Button 리네이밍 시 발생하는 구체적 문제:

- **3단 계층 context 추적**: ComboBoxWrapper > ComboBoxInput + ComboBoxTrigger 구조에서 `parent.tag === "ComboBox"` 가 아닌 `grandparent.tag === "ComboBox"` 판정 필요 → `buildSpecNodeData.ts` / `implicitStyles.ts` / `fullTreeLayout.ts` 다중 위치에서 조부모 조회 비용
- **migration 복잡도**: ComboBoxWrapper/ComboBoxInput 도 같이 migration path 필요 (SelectTrigger 단순 구조 대비 3단 계층 전체)
- **FormComponents.ts 분리**: NumberField 도 내부적으로 ComboBoxTrigger 패턴 재사용 (`FormComponents.ts:497-506`) — migration 범위 확장

SelectTrigger (ADR-100) 보다 3단 계층 복잡도가 더 높아, 리네이밍 비용이 명백히 크다.

## 참조

- [ADR-098](098-rsp-naming-audit-charter.md) — RSP 네이밍 정합 감사 Charter (본 ADR 의 상위 charter)
- [ADR-100](100-select-child-naming-rsp-alignment.md) — 098-a 슬롯 (SelectItem/SelectTrigger 선례, 동일 패턴 적용)
- [ADR-099](099-collection-section-expansion.md) — 098-c 슬롯 (본 ADR 과 병행 Implemented)
- [ADR-073](073-select-combobox-items-ssot.md) — Select/ComboBox items SSOT 이관 (본 ADR 의 BC 재평가 기반)
- [ADR-063](063-ssot-chain-charter.md) — SSOT 체인 D1/D2 domain 원칙
- [ssot-hierarchy.md](../../../.claude/rules/ssot-hierarchy.md) — 3-domain 정본
