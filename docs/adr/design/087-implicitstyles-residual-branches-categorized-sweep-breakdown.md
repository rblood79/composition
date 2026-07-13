# ADR-087 Breakdown — implicitStyles 잔존 ~25 분기 카테고리별 sweep

> ADR: [087-implicitstyles-residual-branches-categorized-sweep.md](../completed/087-implicitstyles-residual-branches-categorized-sweep.md)

## Phase 0 — 진입 감사 (모든 SP 공통 선행)

- [ ] ADR-068 / ADR-076 / ADR-079 / ADR-084 / ADR-085 / ADR-086 Implemented 확인
- [ ] `implicitStyles.ts` 각 분기 현재 구조 재확인 (line number 드리프트 대비)
- [ ] `SYNTHETIC_CHILD_PROP_MERGE_TAGS` / `SHELL_ONLY_CONTAINER_TAGS` Set 재분류 필요성 검토 (R4)

## SP1 — Group 컨테이너 (CheckboxGroup/RadioGroup/ToggleButtonGroup/Toolbar)

**분기**: `:813 togglebuttongroup` / `:824 toolbar` / `:856 checkboxgroup || radiogroup`

**공통 로직**: label positioning (side/top) / orientation (horizontal/vertical) / gap

**접근**:

- Spec `containerStyles` 에 `orientation` → `flexDirection` 매핑 규칙 선언
- label positioning 은 이미 ADR-078 `justifyContent` 리프팅 범위 — 각 Group spec 에 containerStyles 값 확인
- implicitStyles 분기의 orientation fork 제거

**Chrome MCP 샘플**: CheckboxGroup horizontal / vertical

**소요**: 1-2 세션

### SP1 체크리스트

- [ ] ToggleButtonGroup/Toolbar/CheckboxGroup/RadioGroup spec containerStyles 감사
- [ ] implicitStyles `:813/824/856` 분기 해체
- [ ] type-check + tests + MCP 실측 PASS
- [ ] `feat(adr-087): SP1 Group 컨테이너 분기 해체` 커밋

---

## SP2 — Collection item (GridList/GridListItem/Tabs/TabList/TabPanels)

**분기**: `:752 gridlist` / `:779 gridlistitem` / `:992 tabs` / `:1064 tabpanels` / `:1097 tablist`

> ListBox/ListBoxItem 은 ADR-076/078/079 Implemented, Menu 는 ADR-068 Implemented — scope 제외.

**공통 로직**: collection item padding/fontSize / virtualization hints (role/aria-layout) / orientation propagation

**SP2 순서 (의존성)**:

1. Tabs (parent) → TabList → TabPanels (label propagation 순서)
2. GridList → GridListItem

**접근**:

- Tabs.spec / TabList.spec / TabPanels.spec containerStyles 감사
- GridList / GridListItem 은 ADR-079 ListBoxItem 패턴 재사용 고려
- virtualization hints 는 기존 `aria-*` 처리 유지 (spec scope 외)

**Chrome MCP 샘플**: Tabs (horizontal/vertical) + GridList (grid/list 2 변형)

**소요**: 2 세션

### SP2 체크리스트

- [ ] Tabs/TabList/TabPanels/GridList/GridListItem spec containerStyles 감사
- [ ] GridListItem.spec 신설 여부 판단 (ADR-079 패턴 — Spec 부재 시 추가 확장)
- [ ] implicitStyles 5 분기 순서대로 해체 (Tabs → TabList → TabPanels → GridList → GridListItem)
- [ ] MCP 실측 PASS
- [ ] `feat(adr-087): SP2 Collection 분기 해체` 커밋

---

## SP3 — Field wrapper (NumberField/TextField/TextArea/DateField/TimeField/SearchFieldWrapper)

**분기**: `:1203 numberfield` / `:1415 textfield || textarea` / `:1445 datefield || timefield` / `:1497 searchfieldwrapper`

**공통 로직**: field label positioning (side/top) / input height / error/description slots

**접근**:

- 각 Field spec containerStyles 에 display/flex-direction/gap 리프팅
- label position 은 Label.spec size delegation 과 교차 확인 (ADR-060 후속)
- input height 는 ADR-086 에서 spec.sizes SSOT 로 전환됨 — 본 SP 는 parent wrapper 레이아웃만

**Chrome MCP 샘플**: TextField + NumberField (top/side label 2 변형) + DateField

**소요**: 2 세션

### SP3 체크리스트

- [ ] NumberField/TextField/TextArea/DateField/TimeField/SearchFieldWrapper spec containerStyles 감사
- [ ] label positioning logic → containerStyles 또는 별도 Schema 확장 판단 (대안 분기점)
- [ ] implicitStyles 4 분기 해체
- [ ] MCP 실측 PASS
- [ ] `feat(adr-087): SP3 Field wrapper 분기 해체` 커밋

---

## SP4 — Overlay (DatePicker/DateRangePicker)

**분기**: `:1830 datepicker || daterangepicker`

**공통 로직**: popover 자식 (Calendar/RangeCalendar) 처리 + trigger + label positioning

**접근**:

- DatePicker/DateRangePicker spec containerStyles 리프팅
- popover 자식은 이미 `POPOVER_CHILDREN_TAGS` set 기반 필터링 — 분기 로직 중 popover filter 는 별도 유지
- label positioning 은 SP3 결과 재사용

**Chrome MCP 샘플**: DatePicker + DateRangePicker (2 샘플)

**소요**: 1 세션

### SP4 체크리스트

- [ ] DatePicker/DateRangePicker spec containerStyles 감사
- [ ] implicitStyles `:1830` 분기에서 layout-primitive 만 제거 (popover filter 유지)
- [ ] MCP 실측 PASS
- [ ] `feat(adr-087): SP4 Overlay 분기 해체` 커밋

---

## SP5 — Container (Card/CardHeader/CardContent/InlineAlert)

**분기**: `:1902 card` / `:1918 cardheader` / `:1934 cardcontent` / `:2032 inlinealert`

**공통 로직**: composite slots (header/content/footer) / gap / padding

**접근**:

- Card/CardHeader/CardContent.spec containerStyles 감사
- InlineAlert.spec 은 ADR-064 Implemented 에서 self-lookup 전환 — 분기 잔존 확인 후 해체
- slot ordering 은 spec render.shapes 에 유지

**Chrome MCP 샘플**: Card (with header/content) + InlineAlert (neutral/negative 2 변형)

**소요**: 1 세션

### SP5 체크리스트

- [ ] Card/CardHeader/CardContent/InlineAlert spec containerStyles 감사
- [ ] implicitStyles 4 분기 해체
- [ ] MCP 실측 PASS
- [ ] `feat(adr-087): SP5 Container 분기 해체` 커밋

---

## SP6 — Synthetic-merge (TagGroup/TagList/Breadcrumb parent 잔존/SliderTrack/RadioItems/CheckboxItems)

**분기**: `:543 taggroup` / `:585 taglist` / `:895 radioitems || checkboxitems` / `:916 breadcrumbs parent 잔존 gap/height` / `:1781 slidertrack`

**공통 로직**: synthetic-merge SSOT 특수 로직 — `SYNTHETIC_CHILD_PROP_MERGE_TAGS` Set 참조 (ADR-072)

**R4 대응**: SP6 진입 전 Set 감사 → 이동 필요 시 ADR-072 Addendum 또는 본 ADR scope 외 분리

**접근**:

- 각 분기의 layout-primitive 만 spec containerStyles 리프팅
- synthetic-merge child prop 병합 로직은 유지 (Set 관리)
- Breadcrumbs `:916` 잔존 gap/height 는 ADR-086 에서 SSOT 복귀됐는지 재확인 후 잔존 로직 해체

**Chrome MCP 샘플**: TagGroup + Slider (track-based 2 변형) + RadioGroup/CheckboxGroup synthetic merge

**소요**: 1-2 세션

### SP6 체크리스트

- [ ] `SYNTHETIC_CHILD_PROP_MERGE_TAGS` Set 감사 (Set 내 태그 중 layout 분기와 충돌 없음 확인)
- [ ] TagGroup/TagList/SliderTrack/RadioItems/CheckboxItems spec containerStyles 감사
- [ ] Breadcrumbs parent 잔존 로직 확인 (ADR-086 Phase 5 완료 후 기준)
- [ ] implicitStyles 5 분기 해체
- [ ] MCP 실측 PASS
- [ ] `feat(adr-087): SP6 Synthetic-merge 분기 해체` 커밋

---

## 최종 Gate (G4)

- [ ] implicitStyles `if (containerTag === "...")` 분기 grep 결과 — layout primitive 직접 할당 0 개
- [ ] 잔존 분기: size-based padding/gap (ADR-086 scope) / 특수 동작 (popover filter / synthetic merge) 만
- [ ] ADR Status Proposed → Implemented
- [ ] README.md entry 갱신 (ADR-084~087 체인 완결 기록)

## 커밋 계획

| 순서 | 커밋                                           | SP  |
| :--: | ---------------------------------------------- | :-: |
|  1   | `feat(adr-087): SP1 Group 컨테이너 분기 해체`  | SP1 |
|  2   | `feat(adr-087): SP2 Collection 분기 해체`      | SP2 |
|  3   | `feat(adr-087): SP3 Field wrapper 분기 해체`   | SP3 |
|  4   | `feat(adr-087): SP4 Overlay 분기 해체`         | SP4 |
|  5   | `feat(adr-087): SP5 Container 분기 해체`       | SP5 |
|  6   | `feat(adr-087): SP6 Synthetic-merge 분기 해체` | SP6 |
|  7   | `docs(adr-087): Status Proposed → Implemented` | G4  |

## 롤백 전략

- 각 SP 는 독립 커밋 → 단일 SP revert 가능 (다른 SP 영향 없음)
- Partial-Implemented 기간 관리: ADR Status 필드에 "SP{n} land 완료, 잔존 SP 명시"
- G4 PASS 전까지 Status Proposed 유지 (부분 land 라도 본 ADR 은 ongoing)

## 후속 ADR 후보

- 본 ADR 완료 후 잔존 로직 (popover filter / synthetic merge Set 관리 / size-based special cases) 중 SSOT 복귀 가능 항목이 발견되면 별도 ADR
- Spec Schema 추가 확장 필요 시 (예: orientation prop → flexDirection 선언적 매핑) 본 ADR Addendum 또는 후속 ADR
