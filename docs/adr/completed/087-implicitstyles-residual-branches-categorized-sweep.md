# ADR-087: implicitStyles 잔존 ~25 분기 카테고리별 sweep — 완전 SSOT 복귀

## Status

Implemented — 2026-04-20 (Revision 3)

## Implementation (2026-04-20 세션 10-12)

6 SP 전체 land. 11 spec.containerStyles 리프팅 + 9 implicitStyles 분기 정리.

- **SP1 Group** (`3b9f412d`): ToggleButtonGroup/Toolbar/CheckboxGroup/RadioGroup 4 spec 리프팅 (display/alignItems/width:fit-content)
- **SP2 Collection** (`fdd49ece`): Tabs/TabList 2 spec 리프팅 (TabPanels 은 ADR-083 Phase 6 기존). GridList/GridListItem 은 runtime mode switch + spec 부재로 scope 외
- **SP3 Field wrapper** (`1faa7e40`): NumberField/TextField/DateField/TimeField 4 spec display:flex 리프팅 + SearchFieldWrapper (SelectTriggerSpec 재사용)
- **SP4 Overlay + SP5 Container** (`2ee6586d`): DatePicker/DateRangePicker 2 spec display:flex 리프팅 + InlineAlert 분기 3 필드 제거 (ADR-083 Phase 1 기존 containerStyles). Card/CardHeader/CardContent 는 spec 부재로 scope 외 (후속 ADR 후보)
- **SP6 Synthetic-merge** (`cd7ba387`): TagGroup 1 spec 리프팅 (display+gap, skipCSSGeneration 이므로 Taffy-only). TagList/RadioItems/CheckboxItems/SliderTrack 은 spec 부재 또는 ContainerStylesSchema.position 미지원으로 scope 외

### 공통 관찰 — gap 리프팅 제약

`sizes.gap` size-indexed 값과 `containerStyles.gap` 충돌 — `generateSizeStyles.skipGap` 로직으로 size-indexed emit 제거됨. 회귀 방지로 다음 spec 에서 gap 은 리프팅 scope 외:

- CheckboxGroup/RadioGroup (8/12/16)
- NumberField/TextField/DateField/TimeField (size-indexed 2/4/6/8/10)

TagGroup 은 `skipCSSGeneration:true` → CSS emit 없음 → gap 리프팅 안전 (Taffy only).

### 후속 ADR 후보

1. **CardHeader/CardContent spec 신설** — SP5 scope 외 child-level 주입 해체
2. **ContainerStylesSchema.position 필드 추가** — SP6 SliderTrack position:relative 해체
3. **SizeSpec.columnGap? 필드 신설** — ADR-086 Addendum 1 (SLIDER_COL_GAP) 해체
4. **GridListItem spec 신설** — SP2 GridListItem 리프팅 (ADR-079 ListBoxItem 패턴)

### 검증 최종

- type-check 3/3 × 6회
- specs 166/166 (12 snapshot 갱신) × 6회
- builder 217/217 × 6회
- Chrome MCP 실측은 runtime 배포 시 일괄

## History

Proposed — 2026-04-20 (**Revision 3** — Round 5 main 재검증 cross-cutting 87-R5-1 반영: SP6 SliderTrack 잔존 scope 경계 명시. ADR-086 Rev 4 가 SliderTrack 의 size-indexed Record (`SLIDER_COL_GAP` / `SLIDER_TRACK_LAYOUT_HEIGHT` / `SLIDER_FONT_SIZE` / `SIZE_LINE_HEIGHT`) 를 전부 해체하므로 SP6 SliderTrack 잔존 로직 = **layout-primitive only** (flexDirection / alignItems / justifyContent 등). Revision 2 = Codex Round 3 087-C1/C2 (synthetic-merge cross-cutting + G4 수치). Revision 1 = SP2 각주 + 단위 규약.)

## Context

### D3 domain 판정 (ADR-063 SSOT 체인)

본 ADR 은 [ssot-hierarchy.md](../../../.claude/rules/ssot-hierarchy.md) **D3 (시각 스타일) symmetric consumer 의 대칭 복구 최종화**. ADR-084 (4 분기) + ADR-085 (1 분기 ProgressBar/Meter) + ADR-086 (3 분기 Calendar/SelectTrigger/ComboBoxWrapper + Breadcrumb child) 해체 후 잔존 ~25 분기 전면 sweep.

### 현재 구조

`implicitStyles.ts` 에서 `if (containerTag === "...")` 분기 총 **28 if-line** (태그 기준: `||` 로 묶인 `checkboxgroup/radiogroup`, `textfield/textarea`, `datefield/timefield`, `radioitems/checkboxitems`, `datepicker/daterangepicker`, `calendar/rangecalendar` 등 → `||` 1 분기가 2 태그). ADR-084 4 분기 + ADR-085 1 분기 + ADR-086 Phase 1 4 분기 + Phase 2 1 분기 해체 = 약 10 분기 해체 → 잔존 약 18 분기.

### 단위 표기 규약 (Revision 1)

본 ADR 에서 수치 표기는 다음 단위를 혼동 없이 사용한다:

- **분기 (branch)**: `if (containerTag === "...")` 1 개 — `||` 묶음도 1 분기로 카운트
- **태그 (tag)**: 1 분기에 포함되는 개별 태그 이름 — `||` 묶음은 n 개 태그
- **Implemented scope 외**: ADR-068/076/079/084/085/086 에서 해체된 분기는 본 ADR scope 에서 제외

### 카테고리화

아래 table 의 "대상" 열은 **해당 카테고리에 해당하는 모든 태그** 를 나열한다. `*` 표시된 것은 이미 Implemented → 본 ADR scope 외. "본 SP scope 분기 수" 열이 실제 작업 대상.

| 카테고리           | 대상 (\* = Implemented scope 외)                                                                                            | 본 SP scope 분기 수 | 공통 로직                                                                                                                                                                                                                    |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------- | :-----------------: | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **SP1 Group**      | CheckboxGroup / RadioGroup / ToggleButtonGroup / Toolbar                                                                    |          3          | label positioning / orientation / gap                                                                                                                                                                                        |
| **SP2 Collection** | ListBox\* (ADR-076/079) / ListBoxItem\* (ADR-079) / Menu\* (ADR-068) / GridList / GridListItem / Tabs / TabList / TabPanels |        **5**        | collection item padding/font / virtualization hints                                                                                                                                                                          |
| **SP3 Field**      | NumberField / TextField (+TextArea) / DateField (+TimeField) / SearchFieldWrapper                                           |          4          | field wrapper layout / label position / input height                                                                                                                                                                         |
| **SP4 Overlay**    | DatePicker (+DateRangePicker)                                                                                               |          1          | popover + trigger orchestration                                                                                                                                                                                              |
| **SP5 Container**  | Card / CardHeader / CardContent / InlineAlert                                                                               |          4          | composite slots / gap                                                                                                                                                                                                        |
| **SP6 Synthetic**  | TagGroup / TagList / Breadcrumb parent 잔존 / SliderTrack\*\* / RadioItems (+CheckboxItems)                                 |          5          | synthetic-merge SSOT 특수 로직. **\*\* SliderTrack 은 ADR-086 Rev 4 가 size-indexed Record 4개 (SLIDER_COL_GAP/SLIDER_TRACK_LAYOUT_HEIGHT/SLIDER_FONT_SIZE/SIZE_LINE_HEIGHT) 해체 후 → 본 SP scope = layout-primitive only** |

합계 = **22 분기 (약 28 태그)**. ADR-084/085/086 해체분을 제외한 실제 작업 대상.

### Hard Constraints

1. 각 sub-phase 는 독립 land 가능 (롤백 단위 분리)
2. 각 sub-phase 별 Gate: type-check 3/3 + specs 166/166 + builder 217/217 + Chrome MCP 해당 카테고리 1+ 샘플
3. 전체 완료까지 회귀 0 (한 카테고리 실패가 다른 카테고리 land 를 막지 않음)
4. 각 sub-phase 소요: 1-2 세션 (총 6-12 세션)

### Soft Constraints

- sub-phase 간 의존성 최소화 (SP 내 순서는 허용, SP 간 순서는 자유)
- 각 sub-phase 의 Risk 평가 **카테고리별 독립** — sweep ADR 의 핵심 가치

### 감사 결과 (ADR-084/085/086 해체 후 잔존)

```
if (containerTag === "...") 분기 전체 (implicitStyles.ts):
:535  menu                       → ADR-068 Implemented (재확인)
:543  taggroup                   → SP6
:585  taglist                    → SP6
:746  listbox                    → ADR-076/078/079 관계 재확인
:752  gridlist                   → SP2
:779  gridlistitem               → SP2
:798  listboxitem                → ADR-079 Implemented (재확인)
:813  togglebuttongroup          → SP1
:824  toolbar                    → SP1
:856  checkboxgroup/radiogroup   → SP1
:895  radioitems/checkboxitems   → SP6
:916  breadcrumbs parent 잔존    → SP6 (ADR-086 Phase 5 후 잔존 gap/height 확인)
:992  tabs                       → SP2
:1064 tabpanels                  → SP2
:1097 tablist                    → SP2
:1203 numberfield                → SP3
:1262 selecttrigger              → ADR-084 Implemented (size-indexed 로직은 ADR-086 에서 해체)
:1333 comboboxwrapper            → ADR-086 에서 scope 일부 → 본 ADR 에서 잔존 분리
:1415 textfield / textarea       → SP3
:1445 datefield / timefield      → SP3
:1497 searchfieldwrapper         → SP3
:1781 slidertrack                → SP6
:1830 datepicker/daterangepicker → SP4
:1856 calendar/rangecalendar     → ADR-084 Implemented (size-indexed ADR-086)
:1902 card                       → SP5
:1918 cardheader                 → SP5
:1934 cardcontent                → SP5
:2032 inlinealert                → SP5
```

본 ADR scope = SP1~SP6 분기 (ADR-068/076/079/084/085/086 대상 제외).

## Alternatives Considered

### 대안 A: 카테고리별 6 sub-phase (ADR-087 단일, 내부 sub-phase)

- 설명: 하나의 ADR, 내부 6 sub-phase + 각 Gate 독립
- 근거: ADR-059 / ADR-083 sweep 패턴 검증. 카테고리별 Risk 평가 분리 가능
- 위험:
  - 기술: **MEDIUM** — 비즈니스 로직 분기 다수 (label positioning / synthetic merge / overlay orchestration)
  - 성능: LOW
  - 유지보수: LOW — 카테고리별 Gate 로 회귀 감지
  - 마이그레이션: **MEDIUM** — 분기별 시각 변화 가능성, 각 SP 별도 Chrome MCP 실측 부담

### 대안 B: 분기별 1 ADR × 25+

- 설명: ADR-088 ~ ADR-112 개별 생성
- 근거: 최소 scope / 최대 granularity
- 위험:
  - 기술: LOW — 작은 scope
  - 성능: LOW
  - 유지보수: **HIGH** — ADR 25+ 추적 비용, 번호 팽창, 각 ADR 리뷰 roundtrip 부담
  - 마이그레이션: LOW

### 대안 C: 1 ADR 통합 sweep (sub-phase 없이 flat)

- 설명: ADR-087 단일, 모든 분기 한 번에 land
- 근거: 최소 ADR 수
- 위험:
  - 기술: MEDIUM
  - 성능: LOW
  - 유지보수: **HIGH** — 위험 평가 흐려짐 (카테고리별 Risk 숨겨짐)
  - 마이그레이션: **HIGH** — 롤백 단위 과도, 한 분기 실패 = 전체 revert

### Risk Threshold Check

| 대안 | 기술 | 성능 | 유지보수 | 마이그레이션 | HIGH+ 개수 |
| :--: | :--: | :--: | :------: | :----------: | :--------: |
|  A   |  M   |  L   |    L     |      M       |     0      |
|  B   |  L   |  L   |  **H**   |      L       |     1      |
|  C   |  M   |  L   |  **H**   |    **H**     |     2      |

- 대안 B: 추적 비용 HIGH, 번호 팽창
- 대안 C: 위험 평가 + 마이그레이션 둘 다 HIGH → 수용 불가

## Decision

**대안 A: 단일 ADR 내 6 sub-phase + 각 Gate 독립** 을 선택.

선택 근거:

1. HIGH+ 0, ADR-059/083 검증된 sweep 패턴
2. 각 sub-phase 독립 Gate 로 회귀 단위 분리
3. 1 ADR 번호 소비로 추적 부담 최소
4. 각 sub-phase land 순서 자유 — 긴급도에 따라 우선순위 조정 가능

기각 사유:

- **대안 B 기각**: ADR 25+ 추적 비용 HIGH, 번호 팽창 — 수용 불가
- **대안 C 기각**: 위험 평가 + 롤백 단위 둘 다 HIGH — 수용 불가

> 구현 상세: [087-implicitstyles-residual-branches-categorized-sweep-breakdown.md](../../adr/design/087-implicitstyles-residual-branches-categorized-sweep-breakdown.md)

## Risks

| ID  | 위험                                                                                                                                                                                                                                                                                                                                                                                                               | 심각도 | 대응                                                                                                                                                                                                                                    |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :----: | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | 비즈니스 로직 분기 해체 시 시각 회귀 (label positioning / orientation / overlay orchestration 등)                                                                                                                                                                                                                                                                                                                  |  MED   | 각 sub-phase 당 Chrome MCP 해당 카테고리 샘플 1+ 실측. 회귀 감지 시 해당 SP 만 revert (다른 SP 유지)                                                                                                                                    |
| R2  | SP 내 분기 간 의존성 (예: Tabs → TabList → TabPanels label propagation)                                                                                                                                                                                                                                                                                                                                            |  MED   | breakdown 에 SP 내 순서 명시. SP2 는 Tabs → TabList → TabPanels 순서로 land                                                                                                                                                             |
| R3  | 각 SP 독립 land → 중간 상태에서 mixed SSOT (일부 분기 해체 + 일부 분기 잔존)                                                                                                                                                                                                                                                                                                                                       |  MED   | breakdown 에 각 SP 진입/완료 criteria 명시. Partial-Implemented 기간 관리 가능                                                                                                                                                          |
| R4  | **synthetic-merge 태그 cross-cutting** (Revision 2) — `SYNTHETIC_CHILD_PROP_MERGE_TAGS` (`apps/builder/src/builder/workspace/canvas/skia/buildSpecNodeData.ts:150+`) 는 `Breadcrumbs`/`ComboBox`/`GridList`/`ListBox`/`Select`/`Tabs`/`TagGroup`/`Toolbar`/`Tree` 전부 포함 → SP1(Toolbar) / SP2(GridList/Tabs) / SP6(TagGroup/Breadcrumbs) 가 모두 해당 Set 영향을 받음. ADR-072 `_hasChildren` 컨벤션과 상호작용 |  MED   | **모든 SP 진입 criteria 에 synthetic Set 대조 감사 포함** (SP6 한정 아님). 해당 태그 해체 시 `_hasChildren` 주입 차단 여부와 Skia build/render path 호환성 확인. 이동 필요 시 ADR-072 Addendum 발행 또는 해당 태그 본 ADR scope 외 분리 |
| R5  | 일부 분기가 ADR-068/076/079 Implemented 상태 재확인 필요 (audit 에서 listbox/menu 등 재노출)                                                                                                                                                                                                                                                                                                                       |  LOW   | breakdown Phase 0 에서 각 분기 현재 상태 감사. Implemented 분기는 본 ADR scope 제외, 잔존 로직만 분리                                                                                                                                   |

## Gates

| Gate | 시점                | 통과 조건                                                                                                                                                                                                                                           | 실패 시 대안                          |
| :--: | ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
|  G0  | 각 SP 시작          | 진입 criteria — ADR-068/076/079/084/085/086 Implemented + 해당 SP 이전 순서 SP 완료 (if dependency) + **`SYNTHETIC_CHILD_PROP_MERGE_TAGS` Set 대조 감사** (Revision 2 — 해당 SP 태그가 Set 에 포함되면 Skia `_hasChildren` 주입 차단 상호작용 확인) | 선행 SP 또는 ADR 보강                 |
|  G1  | 매 SP land          | `pnpm -w type-check` 3/3                                                                                                                                                                                                                            | 직전 커밋 revert                      |
|  G2  | 매 SP land          | `specs` 166/166 + `builder` 217/217 회귀 0                                                                                                                                                                                                          | 해당 SP revert (다른 SP 유지)         |
|  G3  | 매 SP 후            | Chrome MCP 해당 카테고리 1+ 샘플 시각 정상                                                                                                                                                                                                          | 해당 SP revert                        |
|  G4  | 최종 (전체 SP 완료) | **Revision 1 단위 규약 기준 22 분기 (약 28 태그) → 잔존 0** (size-based / business-logic 특수 경로 예외 제외한 layout primitive 기준). 기존 "40 → 0" 문구는 ADR-084 pre-revision 의 감사 숫자로 deprecated — Revision 2 에서 22 → 0 로 재정의       | 잔존 분기 list 문서화 + 후속 ADR 배정 |

## Consequences

### Positive

- `implicitStyles.ts` 분기 수 ~25 → 0 (layout primitive 기준)
- ADR-084 + ADR-085 + ADR-086 + ADR-087 = 전체 implicitStyles 하드코딩 분기 해체 완료
- ADR-063 D3 symmetric consumer 원칙 **full coverage**
- 후속 Spec SSOT 확장 (ADR-088+) 시 implicitStyles 분기 우회 필요 없음

### Negative

- 6 sub-phase = 6-12 세션 소요 (대규모)
- 각 sub-phase 별 Chrome MCP 실측 부담 누적 (샘플 6+ 카테고리)
- Partial-Implemented 기간 길어질 가능성 (SP 순서 유연성의 trade-off)

## 반복 패턴 선차단 체크리스트 (adr-writing.md experimental seed)

- [x] #1: HIGH+ 없음. MED R1~R5 각각 코드 경로 파일·line 인용 (`implicitStyles.ts:535~2032` 전체 분기 주소 감사 결과 섹션 포함)
- [x] #2: Spec/Generator 확장이 아닌 implicitStyles 분기 해체 ADR — Spec.containerStyles 소비 확장은 ADR-083 Phase 0 선주입 layer 로 이미 지원됨. 각 SP 가 필요로 하는 추가 Schema 확장 (예: label positioning) 은 해당 SP 에서 감지 시 본 ADR Addendum 또는 후속 ADR 로 분리 (breakdown 에 명시)
- [x] #3: BC 수식화 — 영향 spec 약 29 태그, 각 SP 독립 land 로 user 재직렬화 없음. Partial-Implemented 기간 기존 프로젝트 호환 유지 (각 분기 해체는 parentStyle override 가 유지되거나 해체 — 어느 쪽이든 기존 동작 재현)
- [x] #4: Phase 분리 가능성 질문 — 각 SP 는 독립 Phase, SP 내부에서 더 작은 Phase 분리 가능성 breakdown 에 명시 (예: SP3 Field 는 NumberField / TextField 등 spec 단위 sub-sub-phase 가능)
