# ADR-098 구현 상세 — RSP 네이밍 정합 감사 매트릭스 + 후속 ADR 로드맵

> ADR-098 본문: [098-rsp-naming-audit-charter.md](../completed/098-rsp-naming-audit-charter.md)
>
> 본 문서는 ADR-098 Decision (대안 A — 감사 ADR + 후속 개별 리네이밍 ADR 분할) 의 실행 상세. **2026-04-21 WebFetch 매트릭스 스냅샷** 기반. 후속 ADR 발행 시 재검증 의무 (본문 Risk R1).

## 후속 ADR 후보 우선순위 (권장 순서)

| 우선 | 후속 ADR 번호 | 후보                                                                        | 범위                                       |             BC 영향              | 예상 세션 수 |
| :--: | ------------- | --------------------------------------------------------------------------- | ------------------------------------------ | :------------------------------: | :----------: |
|  1   | 098-a         | Select 자식 네이밍 정합 (SelectItem/SelectTrigger)                          | spec 2개 + factory + migration + LayerTree | **HIGH** (저장 데이터 migration) |     1-2      |
|  2   | 098-b         | ComboBox 자식 네이밍 정합 (ComboBoxItem)                                    | spec 1개 + factory + migration             |               MED                |      1       |
|  3   | 098-c         | Section 확장 (ListBoxSection/GridListSection/MenuSection + Header)          | spec 3+ 신설 + tagSpecMap + factory        |         LOW (신규 기능)          |      2       |
|  4   | 098-d         | SelectionIndicator 확장 (Tab 내부 render)                                   | spec 1 신설 + Tab propagation              |         LOW (신규 기능)          |      1       |
|  5   | 098-e         | SelectIcon / CheckboxItems / RadioItems 정당화 (composition 고유 유지 근거) | 문서 only                                  |                0                 |     0.5      |
|  6   | 098-f         | Card 계열 RSP 본체 조사 + 리네이밍 결정                                     | WebFetch 재시도 → 결과에 따라              |                ❓                |     1-2      |
|  7   | 098-g         | MenuTrigger / DisclosurePanel 부재 확인 + 추가 여부                         | spec 신설 또는 유지                        |             LOW-MED              |      1       |

**예상 총 세션**: 7-10 세션 (3-6 개월 분산 진행).

## 각 후보 상세

### 후보 1 — Select 자식 네이밍 정합 (후속 ADR-098-a)

**문제**: composition 의 `SelectItem` / `SelectTrigger` 는 RAC 공식 API 에서 각각 `ListBoxItem` / `Button` 으로 대체됨.

**RAC Select 공식 예시**:

```tsx
<Select>
  <Label />
  <Button>
    <SelectValue />
  </Button>
  <Popover>
    <ListBox>
      <ListBoxItem /> {/* composition 의 SelectItem */}
    </ListBox>
  </Popover>
</Select>
```

**리네이밍 후보**:

| composition     | RAC                                     | 근거                      |                     채택 권장                     |
| --------------- | --------------------------------------- | ------------------------- | :-----------------------------------------------: |
| `SelectItem`    | `ListBoxItem` (또는 `SelectItem` alias) | RAC 는 ListBoxItem 재사용 |      ⚠️ 혼선 — SelectItem alias 로 유지 권장      |
| `SelectTrigger` | `Button` (slot="trigger")               | RAC 는 Button 재사용      | ⚠️ Button tag 중복 위험 — SelectTrigger 유지 고려 |
| `SelectValue`   | `SelectValue`                           | 일치                      |                      ✅ 유지                      |
| `SelectIcon`    | (미존재)                                | composition 고유          |             ⚠️ 098-e 에서 정당화 문서             |

**핵심 trade-off**: RAC 의 `ListBoxItem` / `Button` 재사용 패턴은 DOM 재사용 관점에서 간결. composition 은 builder element tree 에서 각 tag 가 고유 editor/factory 를 가져야 하므로 `SelectItem` / `SelectTrigger` 고유 tag 유지가 생산성 측면 유리. 098-a 에서 **"alias 허용 + composition 고유 tag 유지"** 또는 **"완전 리네이밍 + migration"** 양쪽 대안 평가 필수.

**BC 영향**: 저장 데이터의 `element.tag === "SelectItem"` / `"SelectTrigger"` → `ListBoxItem` / `Button` 변환 시 **모든 Select 사용 프로젝트 영향**. 수식화 필요 ("X% 사용자 / 평균 Y 파일 재직렬화").

### 후보 2 — ComboBox 자식 네이밍 (후속 ADR-098-b)

**문제**: composition `ComboBoxItem` ↔ RAC `ListBoxItem` (또는 `ComboBoxItem` alias).

**RAC 구조**:

```tsx
<ComboBox>
  <Label />
  <Input />
  <Button>
    <ChevronDown />
  </Button>
  <Popover>
    <ListBox>
      <ComboBoxItem /> {/* 또는 ListBoxItem */}
    </ListBox>
  </Popover>
</ComboBox>
```

**리네이밍 고려**: ComboBoxItem 은 RAC 에도 alias 로 존재 — composition 유지 가능성 HIGH. 098-b 는 **"alias 공식 등록 + ListBoxItem 동등 수용"** 방향 검토.

### 후보 3 — Section 확장 (후속 ADR-098-c)

**문제**: RAC 는 `ListBoxSection` / `GridListSection` / `MenuSection` / `Header` 를 통해 컬렉션 내부 그룹화 지원. composition 미구현.

**추가 대상**:

- ListBoxSection + Header (items 그룹화)
- GridListSection + GridListHeader + GridListLoadMoreItem (section + 무한 스크롤)
- MenuSection + SubmenuTrigger (서브메뉴)

**영향**: 신규 기능 추가 → BC 0%. items SSOT 모델에 `section?: string` 같은 필드 추가 또는 nested items 구조 고려.

### 후보 4 — SelectionIndicator 확장 (후속 ADR-098-d)

**문제**: RAC Tab 내부에 `SelectionIndicator` 를 포함하여 애니메이션 지원. composition 현재 Tab active 표시는 spec shapes underline 만.

**추가 대상**: `SelectionIndicator.spec.ts` 신설 + Tab propagation 배선 (active state 기반 렌더).

**영향**: 신규 기능 → BC 0%. 시각적 활성 강조 개선.

### 후보 5 — SelectIcon / CheckboxItems / RadioItems 정당화 (후속 ADR-098-e)

**문제**: composition 고유 네이밍이지만 RAC 미존재. 삭제? 유지? 정당화 문서?

- **SelectIcon**: Select trigger 내부 chevron icon 별도 렌더. 정당화 근거 = Skia 성능 최적화 / 시각 일관성
- **CheckboxItems / RadioItems**: ADR-093 도입 중간 컨테이너. 정당화 근거 = TagList 선례 (spec-only container)

**영향**: 문서 only → BC 0%. ADR-093 연장선 문서화.

### 후보 6 — Card 계열 RSP 본체 조사 (후속 ADR-098-f)

**문제**: ADR-092 debt. react-spectrum.adobe.com 접근 불가 (2026-04-21 WebFetch 404). Card / CardContent / CardHeader / CardFooter / CardView 중 일부가 RSP S2 에서 삭제 / 리네이밍된 가능성.

**재시도 경로**:

1. `react-spectrum.adobe.com/react-spectrum/Card.html` — 기존 URL (2026-04-21 404)
2. `react-spectrum.adobe.com/s2/Card` — S2 신규 경로
3. `spectrum.adobe.com/page/card/` — Spectrum Design System docs
4. React Spectrum GitHub `packages/@react-spectrum/card` / `@react-spectrum/s2/src/Card.tsx` 소스 직접 확인

**영향**: 조사 결과 Card 리네이밍 필요 시 MED BC (사용자 프로젝트의 Card element 다수 migration).

### 후보 7 — MenuTrigger / DisclosurePanel 부재 확인 (후속 ADR-098-g)

**조사**: composition 이 MenuTrigger / DisclosurePanel 을 내부 구조로 이미 처리하는지 (spec-only fold), 아니면 별도 element 로 추가해야 하는지.

- MenuTrigger: RAC 에서 Menu 를 열기 위한 필수 wrapper. composition Menu 가 어떻게 열리는지 확인 필요
- DisclosurePanel: RAC Disclosure 의 content 영역. composition 이 자식 element 로 해당 역할을 하는지 확인

## 잠재 차이 후보 (본 ADR 미조사)

117 spec 중 WebFetch 미조사 컴포넌트. 사용자 신고 / 향후 RSP API 업데이트 시 즉시 후속 ADR 발행:

- Accordion
- Autocomplete (RAC 존재 확인, sub-component 상세 미조사)
- Pagination
- StatusLight
- IllustratedMessage
- InlineAlert
- MaskedFrame
- Switcher / TailSwatch (composition 고유 의심)
- Kbd / Code / Paragraph / Heading / Text / Link / Separator / Nav
- ColorArea / ColorField / ColorPicker / ColorSlider / ColorSwatch / ColorSwatchPicker / ColorWheel
- Calendar / CalendarGrid / CalendarHeader / DateField / DateInput / DatePicker / DateRangePicker / DateSegment / RangeCalendar / TimeField
- Form / FieldError / Field
- Slider / SliderOutput / SliderThumb / SliderTrack
- Meter / MeterTrack / MeterValue / ProgressBar / ProgressBarTrack / ProgressBarValue / ProgressCircle
- Tree / TreeItem
- Table / TableView
- DropZone / FileTrigger
- DialogModal / Popover / Tooltip / Toast

## 2026-04-21 WebFetch 매트릭스 스냅샷 (재검증 시 갱신)

| URL                                                  | Status | 수집 대상                                                                                                                                            |
| ---------------------------------------------------- | :----: | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| https://react-aria.adobe.com/Select                  |   ✅   | Select / SelectValue / Button / ListBox / ListBoxItem / Popover / Label / Text / FieldError                                                          |
| https://react-aria.adobe.com/ListBox                 |   ✅   | ListBox / ListBoxItem / ListBoxSection / Header / ListBoxLoadMoreItem                                                                                |
| https://react-aria.adobe.com/Menu                    |   ✅   | MenuTrigger / Menu / MenuItem / MenuSection / SubmenuTrigger / Separator / Popover / Header / Text / Keyboard                                        |
| https://react-aria.adobe.com/ComboBox                |   ✅   | ComboBox / Input / Label / FieldButton / Popover / ListBox / ComboBoxItem / ListBoxItem / ComboBoxValue / Description / FieldError / ComboBoxSection |
| https://react-aria.adobe.com/Tabs                    |   ✅   | Tabs / TabList / Tab / SelectionIndicator / TabPanels / TabPanel                                                                                     |
| https://react-aria.adobe.com/TagGroup                |   ✅   | TagGroup / TagList / Tag (composition 일치)                                                                                                          |
| https://react-aria.adobe.com/GridList                |   ✅   | GridList / GridListItem / GridListSection / GridListHeader / GridListLoadMoreItem                                                                    |
| https://react-aria.adobe.com/Breadcrumbs             |   ✅   | Breadcrumbs / Breadcrumb (composition 일치)                                                                                                          |
| https://react-aria.adobe.com/CheckboxGroup           |   ✅   | CheckboxGroup / Checkbox / Label / Description / FieldError                                                                                          |
| https://react-aria.adobe.com/Disclosure              |   ✅   | Disclosure / DisclosureHeader / DisclosurePanel / Button (slot="trigger") / Heading                                                                  |
| https://react-aria.adobe.com/Autocomplete            |   ✅   | (SearchField 또는 TextField) + (Menu/ListBox/TagGroup/GridList/Table)                                                                                |
| https://react-aria.adobe.com/Card                    | ❌ 404 | RAC 미존재                                                                                                                                           |
| https://react-spectrum.adobe.com/react-spectrum/Card | ❌ 404 | RSP 본체 docs 접근 불가                                                                                                                              |

## 검증 체크리스트 (본 ADR 완료 기준)

- [x] 매트릭스 8 카테고리 수집 (2026-04-21)
- [x] 후속 ADR 우선순위 표 (1-7, 예상 세션 수 포함)
- [x] 각 후보에 BC 영향 분류 (리네이밍 / 확장 / 정당화 / 조사)
- [x] 잠재 차이 후보 섹션 (117 spec 중 미조사분 목록화)
- [ ] 첫 후속 ADR (098-a) Proposed 발행 — 본 ADR Implemented 전환 트리거
