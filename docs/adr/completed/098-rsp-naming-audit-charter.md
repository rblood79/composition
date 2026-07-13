# ADR-098: RSP 네이밍 정합 감사 Charter — 리네이밍 우선순위 + 분할 후속 ADR 체계

## Status

Implemented — 2026-04-21

> **Addendum 1 (2026-04-21)**: ADR-100 완결로 첫 후속 ADR Gate 통과 — Implemented 전환. Phase 4 Gate "첫 후속 ADR Proposed 발행 시 Implemented 전환" 은 ADR-099 Proposed 시점에 충족, ADR-100 Implemented 로 완전 완결.

## Addendum 1 — BC 재평가 정정 (2026-04-21)

### 배경

본 ADR breakdown 의 후보 #1 (SelectItem/SelectTrigger) 이 **일괄 HIGH BC** 로 분류되었으나, ADR-100 진행 중 현장 재조사에서 BC **비대칭** 이 확증되었다. 본 Addendum 은 그 정정 결과를 기록한다.

### 정정 내용

| 식별자        | 098 breakdown 분류 | ADR-100 재조사 결과                                                                 | 정정 BC 등급  |
| ------------- | :----------------: | ----------------------------------------------------------------------------------- | :-----------: |
| SelectItem    |    HIGH (일괄)     | ADR-073 items SSOT 이관 완료 → 저장 데이터에 `tag` 없음 (items 배열 내부 객체 구조) |  **실질 0%**  |
| SelectTrigger |    HIGH (일괄)     | Compositional Architecture 유지 → 저장 데이터에 `tag: "SelectTrigger"` 직렬화       | **HIGH 유지** |

**SelectItem 근거** (현장 데이터, 2026-04-21):

- `rg "\"SelectItem\"" --type ts` = 26 occurrences / 11 files
- 11 files 내역: docs 2 + migration 테스트 4 + SelectionRenderers 1 + elementRemoval 1 + runtime 3
- ADR-073 (`docs/adr/completed/073-select-combobox-items-ssot.md`) 에서 Select items 를 `StoredSelectItem[]` SSOT 로 이관 — 저장 데이터에 `element.tag === "SelectItem"` 더 이상 존재하지 않음
- **저장 데이터 migration 불필요** — 모든 occurrence 는 runtime 변환 / 테스트 / 문서. 신규 프로젝트 영향 없음, 기존 프로젝트 load-time 자동 migration 경로 유지

**SelectTrigger 근거** (현장 데이터, 2026-04-21):

- `rg "\"SelectTrigger\"" --type ts` = 23 occurrences / 14 files
- 14 files 내역: spec 2 + factory 1 + runtime 4 (utils/implicitStyles/buildSpecNodeData/HierarchyManager) + SelectionRenderers 1 + docs 3 + 기타
- ADR-073 이후에도 Compositional Architecture 유지 — Select 자식 Element 로 저장 데이터에 `tag: "SelectTrigger"` 직렬화 지속
- **저장 데이터 migration 필수** — 리네이밍 시 모든 Select 사용 프로젝트의 element tree 영향 (100% 영향)

### 채택 대안 — 대안 C (비대칭)

ADR-100 에서 **대안 C (비대칭 결정)** 채택:

- **SelectItem**: 내부 식별자/문서 수준 RSP 정합 정리 (BC 0%) — 5 runtime 경로에 RAC `ListBoxItem` alias 주석 추가 (코드 rename 없음, legacy migration 경로 보존)
- **SelectTrigger**: Compositional Architecture 정당화 유지 (HIGH BC 회피) — ADR-100 본문 selfcontained 정당화 섹션 수록 (098-e 연계)

### 대안 A (완전 리네이밍) 기각 근거

- 기술 HIGH: Button tag 충돌 → runtime `utils.ts` / `implicitStyles.ts` / `buildSpecNodeData.ts` 등 다중 위치에서 parent context 기반 discriminator 분기 추가 필요
- 마이그레이션 HIGH: 모든 Select 사용 프로젝트의 element tree 재직렬화 + `applyCollectionItemsMigration` 이 items 가 아닌 일반 Element migration 으로 확장 (전례 없음)
- 획득 가치 (네이밍 통일) 대비 비용 과다 판단

### ADR-098 Charter 재평가 패턴 확립

본 Addendum 에서 확립한 패턴: **items SSOT 이관 완료된 식별자는 저장 `tag` 없음 → BC 0% 가능**.

- ADR-066 (Tabs) / ADR-068 (Menu) / ADR-073 (Select/ComboBox) / ADR-076 (ListBox) / ADR-097 (TagGroup) 이관 완료 식별자 해당
- 후속 ADR (098-b ComboBoxItem 등) 착수 시 동일 재평가 패턴 먼저 적용 권장
- 일괄 HIGH BC 분류는 items SSOT 이관 여부 확인 후 사후 보정 필수

### 관련 커밋

- `74045739` — `docs(adr-100): Phase 1 완료 — SelectItem RAC alias 주석 sweep (BC 0)`
- `87f415cf` — `docs(adr-100): Phase 2 완료 — SelectTrigger 정당화 (selfcontained + code-level)`
- ADR-100 breakdown 참조: [100-select-child-naming-rsp-alignment-breakdown.md](../../adr/design/100-select-child-naming-rsp-alignment-breakdown.md)

## Context

ADR-092 (Implemented) 은 Card 계열 SSOT 정리 중 **"CardContent 등 RSP 공식 네이밍 정합 미검증 — 별도 후속 ADR 대기"** 를 명시. 이후 items SSOT 체인 (ADR-066/068/073/076/097) 도 각각 RAC/RSP 정합 검증을 scope 밖으로 미루며 debt 누적.

본 ADR 은 composition 117 spec 의 **RSP/RAC 공식 API 네이밍 차이를 체계적으로 감사** 하여 리네이밍 대상을 식별하고, 각 리네이밍을 후속 개별 ADR 로 분할 처리할 기반을 마련한다. 본 ADR 자체는 리네이밍을 수행하지 않으며 감사 + 우선순위 확정 + 분할 계획만 담당.

### D3 domain 판정 ([ssot-hierarchy.md](../../../.claude/rules/ssot-hierarchy.md))

**D2 (Props/API) 전용 작업**. composition 컴포넌트 네이밍은 D2 영역 — RSP 참조 기반으로 custom 확장 허용하되 공식 API 네이밍과의 불필요한 divergence 는 제거 대상. D3 (시각 스타일) / D1 (DOM/접근성) 침범 없음.

### Hard Constraints

1. **본 ADR scope = 감사 + 우선순위 결정만** — 실제 리네이밍 수행 금지. 후속 ADR (098-a, 098-b, ...) 에서 개별 진행.
2. **BC 영향 평가 선행** — 리네이밍 대상의 저장 데이터(`element.tag`) migration 필요성 / `applyCollectionItemsMigration` 확장 여부를 각 항목 별로 수식화.
3. **RSP 본체 vs RAC 구분** — Card 류 RSP 본체 컴포넌트는 react-spectrum.adobe.com 공식 docs 접근 가능성 별도 확인. RAC (react-aria.adobe.com) 은 수집 완료.
4. **testing 기준선 유지** — 각 후속 ADR 는 type-check 3/3 + specs/shared/builder 테스트 PASS 유지 의무.

### 실측 — 2026-04-21 WebFetch 매트릭스

react-aria.adobe.com 공식 docs 기준 수집. composition 117 spec 과 대조.

| composition 컴포넌트                                            | RSP/RAC 공식                                                | 일치 여부 | 비고                                           |
| --------------------------------------------------------------- | ----------------------------------------------------------- | :-------: | ---------------------------------------------- |
| TagGroup / TagList / Tag                                        | RAC 동일                                                    |    ✅     | ADR-097 Implemented (items SSOT 완결)          |
| Breadcrumbs / Breadcrumb                                        | RAC 동일 (Breadcrumbs=컨테이너, Breadcrumb=item)            |    ✅     | composition 동일                               |
| Tabs / TabList / Tab / TabPanels / TabPanel                     | RAC 동일                                                    |    ✅     | composition 동일                               |
| GridList / GridListItem                                         | RAC 동일                                                    |    ✅     | 기본 일치                                      |
| ListBox / ListBoxItem                                           | RAC 동일                                                    |    ✅     | 기본 일치                                      |
| CheckboxGroup / Checkbox                                        | RAC 동일                                                    |    ✅     | 기본 일치                                      |
| RadioGroup / Radio                                              | RAC 동일                                                    |    ✅     | 기본 일치                                      |
| DisclosureGroup / Disclosure / DisclosureHeader                 | RAC 동일                                                    |    ✅     | DisclosurePanel (RAC) vs composition 확인 필요 |
| Menu / MenuItem                                                 | RAC 동일                                                    |    ✅     | composition MenuTrigger 부재 여부 확인         |
| **Select / SelectItem**                                         | RAC Select 내부 `ListBoxItem` (또는 `SelectItem` alias)     |    ⚠️     | **리네이밍 후보 #1**                           |
| **Select / SelectTrigger**                                      | RAC Select 내부 `Button` (slot="trigger")                   |    ⚠️     | **리네이밍 후보 #2**                           |
| **Select / SelectValue**                                        | RAC `SelectValue` 동일                                      |    ✅     | —                                              |
| **Select / SelectIcon**                                         | RAC 미존재 (composition 고유)                               |    ⚠️     | **정당화 또는 제거 후보 #3**                   |
| **ComboBox / ComboBoxItem**                                     | RAC ComboBox 내부 `ListBoxItem` (또는 `ComboBoxItem` alias) |    ⚠️     | **리네이밍 후보 #4**                           |
| **CheckboxItems / RadioItems**                                  | RAC 미존재 (composition 중간 컨테이너, ADR-093 도입)        |    ⚠️     | **정당화 문서 후보 #5**                        |
| **Section 계열 부재**                                           | RAC: `ListBoxSection/GridListSection/MenuSection/Header`    |    ⚠️     | **확장 후보 #6** (기능 추가)                   |
| **SelectionIndicator 부재**                                     | RAC Tab 내부 `SelectionIndicator`                           |    ⚠️     | **확장 후보 #7** (기능 추가)                   |
| **Card 계열** (Card/CardContent/CardHeader/CardFooter/CardView) | RSP 본체 Card 공식 docs 접근 불가 (404)                     |    ❓     | **조사 재시도 후보 #8**                        |

### Soft Constraints

- ADR-063 SSOT 체인 D2 원칙: "RSP 에 없는 커스텀 prop 임의 도입 (디자인 일관성 훼손) 금지". 컴포넌트 네이밍도 동일.
- ADR-022 S2 TokenRef 체계 연장선: composition 고유 네이밍 (Switcher / TailSwatch / Switcher 등) 은 RSP 참조가 아닌 **내부 primitive 위치** 명확화 필요.

## Alternatives Considered

### 대안 A: 감사 ADR + 후속 개별 리네이밍 ADR 분할 (선정)

- 설명: 본 ADR 은 매트릭스 + 우선순위 + 각 후보의 BC 영향 수식화만. 실제 spec/tag/factory/migration 변경은 후속 ADR (098-a Select items 리네이밍 / 098-b Section 확장 / 098-c Card 조사 등) 에서 개별 수행.
- 위험:
  - 기술: LOW — 감사는 문서 작업. 코드 변경 0.
  - 성능: LOW — N/A.
  - 유지보수: LOW — 개별 ADR 분할이 각 리네이밍의 복잡도 격리.
  - 마이그레이션: LOW — 본 ADR 은 migration 수행 안 함.

### 대안 B: 단일 ADR 에서 전체 리네이밍 수행

- 설명: 본 ADR 에서 Select item / trigger / ComboBox item / Section 확장 / Card 정리 등 모두 동시 진행.
- 위험:
  - 기술: **HIGH** — 5-6 리네이밍 + Section 확장 + Card 조사가 단일 세션 scope 초과. type/factory/migration/PropertyEditor/LayerTree 동시 수정 5+ 경로. 병렬 회귀 위험↑.
  - 성능: LOW.
  - 유지보수: **HIGH** — 단일 거대 PR/커밋 → 롤백 어려움. 일부 리네이밍 실패 시 전체 revert.
  - 마이그레이션: **HIGH** — `applyCollectionItemsMigration` 이 한 번에 5+ tag rename 처리 → 테스트 지옥.

### 대안 C: 감사 없이 각 컴포넌트 필요 시 개별 처리

- 설명: 본 ADR 작성 없이 Select renaming 필요 시 ADR-099, ComboBox 필요 시 ADR-100 식으로 즉시 진행.
- 위험:
  - 기술: LOW.
  - 성능: LOW.
  - 유지보수: **HIGH** — 누락 / 이중 작업 / 우선순위 불명확 / ADR-092 에서 이미 식별된 debt 가 추가 산발 ADR 로 분산.
  - 마이그레이션: LOW.

### Risk Threshold Check

| 대안                           | 기술 | 성능 | 유지보수 | 마이그레이션 | HIGH+ 수 | 판정                  |
| ------------------------------ | :--: | :--: | :------: | :----------: | :------: | --------------------- |
| A: 감사 + 분할 후속 ADR (선정) |  L   |  L   |    L     |      L       |    0     | **PASS**              |
| B: 단일 거대 ADR               |  H   |  L   |    H     |      H       |    3     | 기각                  |
| C: 감사 없이 개별 즉시         |  L   |  L   |    H     |      L       |    1     | 기각 (누락/산발 debt) |

대안 A 가 HIGH+ 0 + ADR-066/068/073/076/097 items SSOT 체인이 **개별 ADR 분할** 패턴으로 성공한 선례 존재 — threshold pass.

**반복 패턴 선차단 체크** (adr-writing.md Top 1~4):

- ✅ **#1 코드 경로 인용**: Context "실측 매트릭스" 에 composition 117 spec 중 8 카테고리 컴포넌트 경로 명시
- ✅ **#2 Generator 확장 여부**: 본 ADR scope = 감사만 → CSSGenerator 영향 0. 후속 리네이밍 ADR 각자 판단
- ✅ **#3 BC 훼손 수식화**: 매트릭스 각 후보에 "리네이밍 후보" / "확장 후보" / "정당화 후보" 라벨로 migration 필요성 사전 분류. 실제 수식화는 후속 ADR 의무
- ✅ **#4 Phase 분리 가능성**: 8 카테고리 × 평균 1-2 Phase → 후속 ADR 8+ 개 예상. 단일 ADR 내 묶음 불가 판정

## Decision

**대안 A (감사 ADR + 후속 개별 리네이밍 ADR 분할) 채택**.

선택 근거:

1. **items SSOT 체인 (ADR-066/068/073/076/097) 5 회 선례** — 각 컬렉션마다 개별 ADR 로 진행하여 위험 격리 성공. 동일 패턴 재사용.
2. **scope 관리** — 8 카테고리 동시 처리 시 단일 ADR HIGH 3 초과. 분할로 각 리네이밍 HIGH 0 유지 가능.
3. **ADR-092 debt 해소 의도 보존** — Card/CardContent 리네이밍 자체는 RSP 본체 docs 접근 재확인 후 결정 가능 (후속 098-c).
4. **우선순위 명시** — 본 ADR 에서 8 후보의 위험도 / BC 영향 / 사용자 가시성 기준 우선순위 제시 → 후속 ADR 발행 순서 결정 지원.

기각 사유:

- **대안 B 기각**: HIGH 3 초과. 단일 거대 PR → 롤백 불가 + migration 지옥. ADR-076 선례 (ListBox 단일 ADR) 도 실제로는 6 Phase 순차 land 였음 — 본 ADR 은 5-8 컴포넌트 병렬 rename 이라 선례 범위 초과.
- **대안 C 기각**: 감사 없이 개별 처리 시 ADR-092 debt 가 8 개 산발 ADR 로 분산 → debt 연속성 추적 불가. 우선순위 부재로 중요도 낮은 Card 조사가 고위험 Select renaming 보다 먼저 착수될 위험.

> 구현 상세: [098-rsp-naming-audit-charter-breakdown.md](../../adr/design/098-rsp-naming-audit-charter-breakdown.md)

## Risks

| ID  | 위험                                                                        | 심각도 | 대응                                                                                        |
| --- | --------------------------------------------------------------------------- | :----: | ------------------------------------------------------------------------------------------- |
| R1  | RSP/RAC 공식 API 변동 (향후 리네이밍 대상 자체가 변경)                      |  LOW   | 각 후속 ADR 착수 시 WebFetch 재검증 의무. 본 ADR 매트릭스는 2026-04-21 스냅샷 명시          |
| R2  | 후속 ADR 발행 지연으로 debt 지속                                            |  LOW   | 본 ADR 우선순위 표에 "권장 순서 + 예상 세션 수" 명시. 6 개월 후(2026-10) 진척 재평가        |
| R3  | Card 계열 (후보 #8) RSP 본체 docs 접근 불가 지속                            |  LOW   | 후속 098-c 에서 대안 경로 (Spectrum CSS / S2 Card 신규 docs) 탐색. 불가 시 composition 유지 |
| R4  | 감사 누락 — 117 spec 중 본 ADR 에서 다루지 않은 컴포넌트가 RSP 와 차이 발생 |  MED   | 우선순위 표 외 컴포넌트도 "잠재 차이 후보" 섹션에 목록화. 사용자 신고 시 즉시 후속 ADR 발행 |
| R5  | 본 ADR 자체가 감사 → 실제 가치 전달 지연 (코드 변경 0)                      |  LOW   | Decision 섹션에 "후속 ADR 발행 권장 순서" 명시로 실행 가능성 ↑                              |

잔존 HIGH 위험 없음.

## Gates

잔존 HIGH 위험 없음 — Gate 테이블 생략. 본 ADR 자체 검증 기준:

- 감사 매트릭스 8 카테고리 + 117 spec 커버 범위 명시 완료
- 각 후보에 BC 영향 분류 (리네이밍 / 확장 / 정당화 / 조사) 라벨
- 권장 후속 ADR 순서 제시 (breakdown Phase 6 참조)
- 본 ADR Implemented 전환 조건 = 첫 후속 ADR (098-a) Proposed 발행 시

## Consequences

### Positive

- **ADR-092 debt 체계화** — 1년간 누적된 RSP 네이밍 debt 가 8 카테고리 우선순위 표로 명확화
- **후속 ADR 발행 순서 가이드** — 우선순위 / BC 영향 / 예상 복잡도 기반 실행 로드맵 제공
- **items SSOT 체인 5 회 선례 재사용** — 동일 분할 패턴으로 위험 격리 확증
- **잠재 차이 후보 섹션** — 본 ADR 이후 발견되는 네이밍 차이도 즉시 본 ADR 에 append 하여 추적 연속성 보장

### Negative

- **실행 지연** — 실제 리네이밍 수행은 후속 ADR 8+ 개에서 점진적. 전체 정합까지 3-6 세션 예상
- **메타 debt** — 감사만 하고 실행 안 할 경우 debt 가 "감사됨 + 미해결" 상태로 유지. R5 대응 필수
- **매트릭스 유지 비용** — RSP/RAC API 변동 시 본 ADR 업데이트 의무 (Addendum 방식)

## 참조

- [ADR-092](092-card-slot-spec-modeling.md) — CardContent 리네이밍 debt 선행 기록
- [ADR-097](097-taggroup-items-ssot-hybrid.md) — items SSOT 체인 5번째 컬렉션 완결, 본 ADR 직전 Implemented
- [ADR-066](066-tabs-items-ssot-migration.md) / [ADR-068](068-menu-items-ssot-and-menuitem-spec.md) / [ADR-073](073-select-combobox-items-ssot.md) / [ADR-076](076-listbox-items-ssot-hybrid.md) — items SSOT 체인 1-4 번째 (분할 ADR 패턴 선례)
- [ADR-063](063-ssot-chain-charter.md) — SSOT 체인 D2 domain 원칙 (RSP 참조 기준)
- [ADR-022](022-s2-color-token-migration.md) — S2 토큰 리네이밍 선례 (D3 영역)
- [ssot-hierarchy.md](../../../.claude/rules/ssot-hierarchy.md) — D2 Props/API domain 정본
