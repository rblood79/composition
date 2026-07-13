# ADR-102: SelectIcon 정당화 — RAC 미존재 시각 element 유지 결정 (ADR-098-d 슬롯)

## Status

Implemented — 2026-04-21

> 본 ADR 은 [ADR-098](098-rsp-naming-audit-charter.md) (RSP 네이밍 정합 감사 Charter) 의 "098-d 슬롯" 구현. ADR-098 Charter 후보 #3 "정당화 또는 제거 후보" 판정. **Phase 0 BC 재평가 결과 시나리오 B (BC HIGH) 확인 — 제거 불가, 대안 A (정당화 유지) 채택.**

**Phase 커밋 체인** (origin/main):

- P0 완료 — BC 재평가 + 시나리오 판정 + 3 대안 평가 (ADR-102 본문 작성, 2026-04-21 세션 12)
- P1 완료 — SelectIcon selfcontained 정당화 섹션 + runtime 경로 ADR-102 주석 sweep (code-level)
- P2 완료 — README.md ADR-102 Implemented 추가

**종결 검증**: type-check 3/3 + specs 205/205 + builder 227/227 + shared 52/52 PASS. BC 영향 0% (정당화 유지 결정 — migration 0건).

## Context

ADR-098 감사 매트릭스 (2026-04-21) 에서 composition 의 `SelectIcon` 이 RAC 공식 Select 구조에 직접 대응 컴포넌트 없음을 식별했다. RAC `<Select>` 는 `<Button slot="trigger">` 내부에 임의 icon 을 배치하는 구조이며, "SelectIcon" 이라는 이름의 primitive 는 RAC/RSP 공식 API 에 존재하지 않는다.

ADR-098 Charter 후보 #3 은 SelectIcon 을 "정당화 또는 제거 후보" 로 분류하고 본 ADR 에서 결정을 위임했다. **ADR-100 SelectItem/SelectTrigger, ADR-101 ComboBoxItem/ComboBoxTrigger 선례 패턴** (Phase 0 현장 재조사 후 BC 비대칭 결정) 을 그대로 적용한다.

### BC 재평가 매트릭스 (Phase 0)

| 식별자     |      ADR-098 분류       | Phase 0 재조사 결과                                                                        | 실질 BC  |
| ---------- | :---------------------: | ------------------------------------------------------------------------------------------ | :------: |
| SelectIcon | HIGH (정당화/제거 후보) | factory `createSelectDefinition` 이 `tag: "SelectIcon"` 자식 element 생성 — DB 직렬화 확인 | **HIGH** |

**시나리오 판정: 시나리오 B** — SelectIcon 은 DB 에 `tag: "SelectIcon"` 으로 저장되는 독립 element. 제거 불가.

#### 추가 발견: SelectIconSpec 공유 패턴

`tagSpecMap.ts` 에서 `SelectIconSpec` 이 다수 tag 의 공유 Spec 으로 사용됨:

```
SelectIcon:         SelectIconSpec  (primary)
ComboBoxTrigger:    SelectIconSpec  (ADR-101 정당화 유지)
SearchIcon:         SelectIconSpec  (SearchField 내부)
SearchClearButton:  SelectIconSpec  (SearchField 내부)
```

이 공유 구조는 SelectIcon 이 단순 이름 문제가 아니라 **composition 아이콘 element 공통 Spec** 으로 기능함을 나타낸다. 제거 또는 리네이밍 시 4개 tag 에 동시 영향.

### D1/D2/D3 domain 판정 ([ssot-hierarchy.md](../../../.claude/rules/ssot-hierarchy.md))

- **D3 (시각 스타일)**: SelectIcon 은 `render.shapes` 에서 chevron 아이콘 (`icon_font` type) + 배경 `roundRect` 를 직접 렌더링 — **100% D3 시각 스타일 domain**. Spec SSOT 관할.
- **D2 (Props/API)**: RAC 공식 API 에 SelectIcon 미존재 → D2 정합 대상 아님. composition 고유 element.
- **D1 (DOM/접근성)**: SelectIcon 은 DOM 에서 `<span>` 으로 렌더링 (`element: "span"`, `eventMode: "none"`) — 순수 시각 element. ARIA/키보드 동작 없음. D1 구조 영향 없음.

### Hard Constraints

1. **BC 영향 수식화 선행** — SelectIcon 저장 데이터 직렬화 확인. `tag: "SelectIcon"` element 존재 시 제거 = 기존 프로젝트 SelectTrigger 자식 소실 (BC HIGH).
2. **SelectIconSpec 공유 구조 보전** — `ComboBoxTrigger` / `SearchIcon` / `SearchClearButton` 이 동일 Spec 사용. 제거 또는 Spec 분리 시 4개 tag 동시 영향.
3. **Compositional Architecture 유지** — SelectTrigger > [SelectValue, SelectIcon] 계층이 저장 데이터에 직렬화. 이 구조를 유지해야 icon 크기/색상 독립 제어 가능.
4. **testing 기준선** — type-check 3/3 + specs 205/205 + builder 227/227 + shared 52/52 PASS 유지.

### 현장 데이터 (2026-04-21)

- `SelectIcon` 관련 파일: `SelectIcon.spec.ts` (Spec 정의) + `SelectionComponents.ts:93-100` (factory 생성) + `tagSpecMap.ts:215,218,221,222` (4 tag 공유 매핑) + `buildSpecNodeData.ts:458-482` (icon delegation 로직) + `implicitStyles.ts:1113-1130` (SelectIcon 전용 iconName 전파 분기)
- factory `createSelectDefinition` 이 `tag: "SelectIcon"` + `props: {style: {width:18, height:18, flexShrink:0}}` 으로 SelectTrigger 자식 생성 (`SelectionComponents.ts:93-100`)
- `buildSpecNodeData.ts:458-463`: `resolveIconDelegation()` 함수 — `element.tag !== "SelectIcon" && element.tag !== "ComboBoxTrigger"` 조건으로 SelectIcon 전용 grandparent iconName 위임 처리
- `implicitStyles.ts:1113`: `child.tag === "SelectIcon"` 분기 — 조부모(Select) iconName 전파 + 크기 주입

### Soft Constraints

- ADR-098 Charter Decision: "composition 고유 네이밍은 Compositional Architecture 정당화 가능 시 유지 허용"
- ADR-100 SelectTrigger / ADR-101 ComboBoxTrigger 선례 대칭 — Compositional Architecture 고유 element 정당화 패턴 통일.
- ADR-019 Phase C4: SelectIcon+ComboBox 연동, Phase C5: ComboBoxEditor IconPicker — 기존 기능 의존성 존재.

## Alternatives Considered

### 대안 A: 정당화 유지 — SelectIcon Compositional Architecture 고유 element 확증 (선정)

- 설명: SelectIcon 을 D3 시각 스타일 element 로 정당화. `SelectIconSpec` 공유 구조 유지. RAC 공식 명칭 없음을 composition 고유 시각 식별자로 확정. ADR-100 SelectTrigger / ADR-101 ComboBoxTrigger 패턴 복제.
- 위험:
  - 기술: **LOW** — 정당화 문서 + 주석 수준. Spec/factory/runtime 코드 변경 0.
  - 성능: **LOW**.
  - 유지보수: **LOW** — SelectIconSpec 공유 구조가 4 tag 에 일관성 부여. 변경 1곳으로 4 tag 동시 적용.
  - 마이그레이션: **LOW** — migration 0건. 기존 저장 데이터 그대로 유지.

### 대안 B: 제거 — SelectIcon 삭제 후 SelectTrigger 직접 아이콘 렌더

- 설명: SelectIcon element 를 소멸시키고 SelectTrigger Spec 이 직접 chevron 아이콘 shapes 를 포함하도록 리팩토링. factory `createSelectDefinition` 에서 SelectIcon 자식 생성 제거.
- 위험:
  - 기술: **HIGH** — `buildSpecNodeData.ts:458-482` icon delegation 로직 전면 재작성. SelectTrigger Spec 에 아이콘 shapes 추가. factory 변경 + Spec 변경 + runtime 4곳 변경 + tagSpecMap 4 entry 재배선.
  - 성능: **LOW**.
  - 유지보수: **MED** — SelectTrigger Spec 이 아이콘 size/색상 담당 → Spec 책임 혼합. 향후 아이콘 독립 제어(크기/색상 별도 override) 불가.
  - 마이그레이션: **HIGH** — 기존 Select 사용 프로젝트의 SelectIcon element (저장 데이터) 를 migration 필요. `applyCollectionItemsMigration` 범위 외 일반 element migration — 전례 없음. **0% 재직렬화 불가**.

### 대안 C: Alias 주석만 (ADR-101 ComboBoxItem 패턴)

- 설명: SelectIcon 은 RAC 공식 명칭이 없으므로 alias 주석 자체가 불필요. 그러나 "composition 고유 element" 를 명시하는 정당화 주석은 추가 가능.
- 위험:
  - 기술: **LOW** — 주석 추가만.
  - 성능: **LOW**.
  - 유지보수: **LOW**.
  - 마이그레이션: **LOW** — 0건.

  단, 대안 C 는 "정당화 문서 없이 주석만" 이라는 점에서 대안 A 의 완전한 부분집합. 대안 A 에 흡수됨.

### Risk Threshold Check

| 대안            | 기술 | 성능 | 유지보수 | 마이그레이션 | HIGH+ 수 | 판정                  |
| --------------- | :--: | :--: | :------: | :----------: | :------: | --------------------- |
| A: 정당화 유지  |  L   |  L   |    L     |      L       |    0     | **PASS**              |
| B: 제거         |  H   |  L   |    M     |      H       |    2     | 기각                  |
| C: Alias 주석만 |  L   |  L   |    L     |      L       |    0     | pass — 대안 A 에 흡수 |

대안 A 가 HIGH 0 + 모든 축 LOW + BC 0% + ADR-100/ADR-101 패턴 대칭 → threshold pass.

**반복 패턴 선차단 체크** (adr-writing.md Top 1~4):

- ✅ **#1 코드 경로 인용**: Context 에서 `SelectionComponents.ts:93-100`, `tagSpecMap.ts:215,218,221,222`, `buildSpecNodeData.ts:458-482`, `implicitStyles.ts:1113-1130` 4 경로 + occurrence 명시.
- ✅ **#2 Generator 확장 여부**: 정당화 유지 결정 — Spec/Generator/schema 확장 불필요. 주석 + 문서 수준 작업만.
- ✅ **#3 BC 훼손 수식화**: SelectIcon **BC HIGH** 확인 (factory 직렬화 `tag: "SelectIcon"`). 대안 A 채택으로 실질 migration **0건 / 0% 파일 재직렬화**.
- ✅ **#4 Phase 분리 가능성**: Phase 1 (정당화 섹션 + runtime 주석) + Phase 2 (README 갱신) 완전 독립.

## Decision

**대안 A (정당화 유지 — SelectIcon Compositional Architecture 고유 D3 시각 element 확증) 채택**.

선택 근거:

1. **D3 시각 스타일 domain 100% 귀속** — SelectIcon 은 `render.shapes` 에서 chevron `icon_font` + 배경 `roundRect` 를 직접 렌더링. DOM/접근성(D1) 과 무관. SSOT 체인 3-Domain 분할에서 D3 Spec 관할 element 이며, RAC 공식 명칭 불일치는 D3 domain 에서 정당성 훼손 요인이 아님.
2. **BC HIGH 제거 불가** — factory `createSelectDefinition:93-100` 이 `tag: "SelectIcon"` element 를 DB 에 직렬화. 제거 시 기존 모든 Select 사용 프로젝트의 SelectTrigger 자식 소실 → 기능 파괴. 대안 B 의 HIGH × 2 위험은 획득 가치(RAC 명칭 통일) 대비 비용이 명백히 큰 불균형.
3. **SelectIconSpec 공유 구조 유지** — `ComboBoxTrigger` (ADR-101) / `SearchIcon` / `SearchClearButton` 이 동일 Spec 재사용. 단일 Spec 으로 4 tag 의 시각 일관성 보장. 제거 시 이 공유 구조 전체 재설계 필요.
4. **ADR-100/ADR-101 패턴 대칭** — SelectTrigger (ADR-100 selfcontained) / ComboBoxTrigger (ADR-101 selfcontained) 와 동일한 "Compositional Architecture 고유 element 정당화" 경로. 판정 기준 일관성 확보.
5. **Compositional Architecture 기능 보존** — SelectIcon 독립 element 구조가 icon 크기/색상의 독립 style override 를 가능하게 함. 통합 시 이 제어 분리 불가.

기각 사유:

- **대안 B 기각**: HIGH 2 (기술 + 마이그레이션). 기존 저장 데이터 migration (전례 없는 일반 element migration) + runtime 4 경로 전면 재작성. RAC 명칭 통일이라는 D2 편의 목적으로 D3 구조를 파괴하는 것은 SSOT 원칙에 역행.
- **대안 C 기각**: 대안 A 의 완전한 부분집합 — 별도 대안이 아님. 대안 A 에 흡수.

`CSSGenerator` / spec schema 확장 불필요. runtime DOM 은 이미 `<span eventMode="none">` 으로 시각 전용 렌더링.

## Risks

| ID  | 위험                                                                                  | 심각도 | 대응                                                                                                 |
| --- | ------------------------------------------------------------------------------------- | :----: | ---------------------------------------------------------------------------------------------------- |
| R1  | SelectIconSpec 공유 tag 중 하나(SearchIcon/SearchClearButton)가 미래에 별도 Spec 필요 |  LOW   | 분기 시 `SearchIconSpec` 신설 + tagSpecMap 교체 — SelectIcon 에 무영향. 독립 대응 가능.              |
| R2  | RSP/RAC 가 미래에 공식 SelectIcon primitive 를 추가할 경우 composition 충돌 가능      |  LOW   | ADR-098 Charter R1 (RSP/RAC API 변동 재검증) 에 포함. 공식 primitive 등장 시 본 ADR Superseded 전환. |
| R3  | ADR-098-e (정당화 통합 문서 ADR) 미발행 상태 지속으로 본 ADR cross-reference stale    |  MED   | Phase 1 에서 본 ADR selfcontained 정당화 섹션 포함 — 098-e 발행 시 cross-reference 추가.             |

잔존 HIGH 위험 없음.

## Gates

잔존 HIGH 위험 없음 — Gate 테이블 생략. 본 ADR 자체 검증 기준:

| 시점         | 통과 조건                                                                                                 |
| ------------ | --------------------------------------------------------------------------------------------------------- |
| Phase 0 완료 | BC 재평가 + 시나리오 판정 + 3 대안 평가 완료 (본 ADR 본문)                                                |
| Phase 1 완료 | SelectIcon selfcontained 정당화 섹션 (runtime code-level 증거 4건) + ADR-098 비고 추가                    |
| Phase 2 완료 | README.md ADR-102 Implemented 추가 + type-check 3/3 + specs 205/205 + builder 227/227 + shared 52/52 PASS |

## Consequences

### Positive

- **D3 domain 귀속 확증** — SelectIcon 이 시각 스타일 domain (D3) element 임을 ADR 레벨에서 명문화. SSOT 체인 3-Domain 분할 준수 명확화.
- **BC HIGH 회피** — 기존 Select 사용 프로젝트 저장 데이터 재직렬화 비용 0. 대안 B 의 migration 부담 (모든 Select 프로젝트 + SelectTrigger 자식 구조 migration) 완전 제거.
- **SelectIconSpec 공유 구조 안정화** — ComboBoxTrigger (ADR-101) / SearchIcon / SearchClearButton 이 동일 Spec 재사용. 4 tag 시각 일관성 구조적 보장.
- **ADR-100/101/102 패턴 3종 통일** — SelectTrigger / ComboBoxTrigger / SelectIcon 모두 동일한 "Compositional Architecture 고유 element selfcontained 정당화" 패턴. 향후 유사 판정의 명확한 선례.

### Negative

- **RAC 미매핑 지속** — composition `SelectIcon` element 와 RAC 공식 구조의 명칭 divergence 유지. 신규 개발자 온보딩 시 문서 참조 필요.
- **ADR-098-e 정당화 통합 문서 의존** — SelectIcon 정당화가 098-e 미발행 시 본 ADR 에 selfcontained 포함 필요 → 098-e 발행 시 중복 정리 비용.

## SelectIcon 정당화 (ADR-098-e 연계 전 selfcontained)

ADR-098-e (composition 고유 네이밍 정당화 통합 문서) 미발행 상태에서 본 ADR 이 SelectIcon 정당화를 selfcontained 보존. 098-e 발행 시 본 섹션을 cross-reference 로 전환. ADR-100 SelectTrigger / ADR-101 ComboBoxTrigger 정당화와 구조 대칭.

### 정당화 근거 4건

| #   | 근거                                             | 코드 증거 (2026-04-21)                                                                                                                                                             |
| --- | ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **저장 식별자 고유성 — D3 시각 전용 element**    | `apps/builder/src/builder/factories/definitions/SelectionComponents.ts:93-100` (`tag:"SelectIcon"` 자식 생성, `eventMode:"none"`, `style:{flexShrink:0}`)                          |
| 2   | **SelectIconSpec 공유 Spec — 4 tag 시각 일관성** | `apps/builder/src/builder/workspace/canvas/sprites/tagSpecMap.ts:215,218,221,222` (`SelectIcon/ComboBoxTrigger/SearchIcon/SearchClearButton: SelectIconSpec`)                      |
| 3   | **runtime 전용 icon delegation 로직**            | `apps/builder/src/builder/workspace/canvas/skia/buildSpecNodeData.ts:458-482` (`resolveIconDelegation` — `"SelectIcon" \|\| "ComboBoxTrigger"` 조건으로 grandparent iconName 위임) |
| 4   | **layout implicit styles 전용 분기**             | `apps/builder/src/builder/workspace/canvas/layout/engines/implicitStyles.ts:1113-1130` (`child.tag === "SelectIcon"` 분기 — 조부모 iconName + 크기 주입)                           |

### runtime 경로 증거

- **Factory 생성**: `createSelectDefinition` 이 Select element 생성 시 SelectTrigger 내 자식으로 SelectValue + SelectIcon 포함 — `SelectionComponents.ts:82-101`. SelectIcon props: `{children:"", style:{width:18, height:18, flexShrink:0}}`
- **Skia icon delegation**: `buildSpecNodeData.ts:458-482` 가 `"SelectIcon" || "ComboBoxTrigger"` 동일 경로로 grandparent(Select) iconName 위임 처리 — SelectIcon 전용 로직
- **layout implicit styles**: `implicitStyles.ts:1113` `child.tag === "SelectIcon"` 분기 — 조부모(Select) iconName 전파 + `specSizeField("selecttrigger", sizeName, "iconSize")` 크기 주입
- **tagSpecMap**: `tagSpecMap.ts:215` `SelectIcon: SelectIconSpec` — 기본 매핑 + 3 공유 tag 매핑 (ComboBoxTrigger/SearchIcon/SearchClearButton)

### 대안 B (제거) 기각 근거 재확인

SelectIcon 제거 시 발생하는 구체적 문제:

- **저장 데이터 파괴**: `tag: "SelectIcon"` 직렬화 element 소멸 → 기존 모든 Select 사용 프로젝트 SelectTrigger 자식 구조 파괴. `applyCollectionItemsMigration` 는 items 배열 내부 객체 migration 용 — 일반 element tree migration 전례 없음.
- **SelectIconSpec 공유 구조 재설계**: 4 tag (SelectIcon/ComboBoxTrigger/SearchIcon/SearchClearButton) 가 동일 Spec 공유. 제거 시 ComboBoxTrigger/SearchIcon/SearchClearButton 의 Spec 대안 설계 필요.
- **icon delegation 경로 전면 재작성**: `buildSpecNodeData.ts:458-482` `resolveIconDelegation` 함수 전체 + `implicitStyles.ts:1113-1130` 분기 → 모든 icon delegation 로직 SelectTrigger Spec 내부로 통합 필요.

D3 시각 SSOT 관점에서 SelectIcon 은 Spec-defined shapes (chevron `icon_font` + 배경 `roundRect`) 를 렌더링하는 구조가 이미 완전 정합 — 제거로 얻는 이점 없음.

## 참조

- [ADR-098](098-rsp-naming-audit-charter.md) — RSP 네이밍 정합 감사 Charter (본 ADR 의 상위 charter, 098-d 슬롯)
- [ADR-100](100-select-child-naming-rsp-alignment.md) — 098-a 슬롯 (SelectItem/SelectTrigger 선례, 동일 패턴 적용)
- [ADR-101](101-combobox-child-naming-rsp-alignment.md) — 098-b 슬롯 (ComboBoxItem/ComboBoxTrigger 선례, 동일 패턴 적용)
- [ADR-099](099-collection-section-expansion.md) — 098-c 슬롯 (본 ADR 과 병행 Implemented)
- [ADR-073](073-select-combobox-items-ssot.md) — Select/ComboBox items SSOT 이관 (factory 구조 근거)
- [ADR-019](019-icon-system.md) — 아이콘 시스템 (SelectIcon+ComboBox 연동 C4, IconPicker C5)
- [ADR-063](063-ssot-chain-charter.md) — SSOT 체인 D1/D2/D3 domain 원칙
- [ssot-hierarchy.md](../../../.claude/rules/ssot-hierarchy.md) — 3-domain 정본
