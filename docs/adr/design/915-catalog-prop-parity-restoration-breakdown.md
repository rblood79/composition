# ADR-915 구현 상세 — catalog binding.accepts prop parity 복원

> ADR 본문: [915-catalog-prop-parity-restoration.md](../915-catalog-prop-parity-restoration.md)
> 감사 근거: [docs/reference/adr-912-prop-parity-audit.md](../../reference/adr-912-prop-parity-audit.md)

## §1. base/응용 분류 lock-in (adr-writing.md 4 질문)

1. **base/응용**: ADR-912(spec→catalog cutover) = base 메커니즘. 본 ADR = 응용(전환된 `accepts` Record의 prop 커버리지 복원). → ADR-912 후속.
2. **schema 직교성**: 본 작업은 ADR-912 binding schema의 `accepts` 항목 추가 = specialization(채우기). 직교 아님.
3. **선행 ADR 전제 reverse**: ADR-912는 prop 축소를 의도하지 않음(cutover는 메커니즘 전환). 축소는 spec→binding 이전의 부수적 결손 → 본 작업은 미완성 복원이지 전제 충돌 아님.
4. **추정 vs 실측 gap**: 본 ADR은 gap을 fork 정당화로 인용하지 않음. 별도 주제(공식 대비 prop 커버리지).

## §2. 작업 순서 (사용자 지정: P0 정정 → P1 폼 복원)

### Phase 0 — P0 정정 (추가 아님, 오류 수정)

| #   | 정정                                                  | 위치                                                   | 변경                                                                                                                                                                                                                                                                |
| --- | ----------------------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0-1 | InlineAlert variant `informative` → `info`            | `InlineAlert.binding.ts` + theme/catalog variant 값    | 옵션 값 정정 (공식 RSP: `neutral\|info\|positive\|notice\|negative`)                                                                                                                                                                                                |
| 0-2 | TableView `allowsResizingColumns` → 명칭 확정         | `TableView.binding.ts`                                 | 공식 `allowsResizing` 정렬 또는 루트 추상화 의도 주석 명시                                                                                                                                                                                                          |
| 0-3 | Radio `isSelected` — **live consumer 있음**           | `Radio.binding.ts` / `FormRenderers.tsx`               | `FormRenderers.tsx` 가 `defaultSelected={Boolean(props.isSelected)}` 로 "초기 선택" 의미 소비 → dead 아님. **제거 금지**. RAC 명명과 불일치만 문서/명명 정합 검토, 대체 설계(RadioGroup `value` 복원) 없으면 **보류**                                               |
| 0-4 | MeterTrack `isIndeterminate` — **live consumer 있음** | `MeterTrack.binding.ts` / `skiaPrimitives.ts`          | `skiaPrimitives.ts` 정적 indeterminate 막대 렌더 + `buildSpecNodeData.ts` propagation 소비 → dead 아님. **제거 금지** (제거 시 indeterminate 시각 깨짐). **보류**                                                                                                   |
| 0-5 | 폼 컨트롤 `variant` 문자열 → `isEmphasized`           | Checkbox/CheckboxGroup/Radio/RadioGroup/Switch/Form    | D2 정책(ADR-062 선례). **개별 사용자 확인** — D3 시각 variant로 정당화되면 보류                                                                                                                                                                                     |
| 0-6 | `Input.variant` kind `enum` → `variant`               | `Input.binding.ts`                                     | 중복 점검(audit §1.6-B): Input 만 `kind:"enum"`, 나머지 46개는 `kind:"variant"`. enum 은 React prop 통과 → theme `data-*` 시각 라우팅 이탈. 정정 후 `data-variant` emit 1회 확인(toRacProps)                                                                        |
| 0-7 | `color`/`step` 이중 노출 dedup                        | `resolveEditContract.ts` (또는 4 binding)              | 중복 점검(audit §1.6-D): `accepts` ∩ `UNIVERSAL_STYLE_CONTRACTS` → 동명 필드 2회 노출(ColorSwatch/TailSwatch `color`, NumberField/Slider `step`). **구조 변경** — accepts 키가 universal 과 겹치면 semantic 우선 + style 제외(dedup). **live behavior 게이트 필수** |
| 0-8 | label 표기 흔들림 정합 (선택)                         | `minValue`/`maxValue`/`href`/`type`/`iconName` binding | 중복 점검(audit §1.6-C): 기능 영향 없음, 표기만 갈림. **본 ADR scope 밖 가능** — P3 이하 또는 별도 정합 작업                                                                                                                                                        |

> **P0 정정 ≠ 안전한 제거** (codex 2026-06-25): 0-3/0-4 는 grep 으로 live consumer 확인됨 → **기본값은 보류**. 0-1(InlineAlert 값)만 consumer 무관 안전 정정. P0 단위는 "제거"가 아니라 "live consumer 확인 → 대체 설계 있으면 정정, 없으면 보류".
>
> **중복 점검 추가 (2026-06-25)**: 0-6/0-7/0-8 은 누락이 아니라 **중복·불일치** 정정(audit §1.6, 층위 B 와 직교). 0-6(Input.variant)은 kind 정정으로 안전. 0-7(color/step dedup)은 `resolveEditContract` 구조 변경이라 **dead 아님 → 보류 가능, 정정 시 Gate G1 + live behavior 게이트 적용**(패널 동명 필드 2개→1개 확인). 0-8 은 선택적, scope 밖 가능.

### Phase 1 — P1 폼 기능 결손 복원

각 prop 추가 시 4-step: (1) `binding.accepts`에 `PropContract` 추가 (2) 적절한 `kind` 지정 (3) `toRacProps` 전달 확인 (4) Skia/CSS 소비 영향 확인.

| 그룹                                 | 대상 컴포넌트                                  | 추가 prop                                              | kind                                   |
| ------------------------------------ | ---------------------------------------------- | ------------------------------------------------------ | -------------------------------------- |
| P1-a 입력 공통                       | TextField/TextArea/NumberField/SearchField     | `value`(또는 defaultValue) `name` `errorMessage`       | string/string                          |
| P1-b 텍스트 검증                     | TextField/TextArea                             | `maxLength` `minLength` `pattern`                      | number/number/string                   |
| P1-c 숫자 형식                       | NumberField                                    | `formatOptions` ⚠️                                     | object — 기존 kind 없음. **G3 gate**   |
| P1-d 토글/그룹                       | Checkbox/Switch/ToggleButton                   | `defaultSelected`                                      | boolean                                |
| P1-e 그룹 값                         | CheckboxGroup/RadioGroup                       | `value`/`defaultValue` `name` `errorMessage`           | string-array/string/string             |
| P1-f Date 형식                       | DateField/TimeField/DatePicker/DateRangePicker | `granularity` `minValue` `maxValue` **`errorMessage`** | enum/string/string/string              |
| P1-g live-consumer 결손 (audit §9-1) | 아래 표 참조                                   | 렌더러가 이미 `props.{x}` 소비 중인데 accepts 누락     | string/enum/boolean (대부분 기존 kind) |

**P1-g — "live consumer 있는데 accepts 누락" (audit §9-1, 복원 시 즉시 동작, 회귀 위험 낮음)**:

| 컴포넌트                                                                                     | 추가 prop                                                                    | live consumer 위치                       | kind                 |
| -------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ---------------------------------------- | -------------------- |
| Form                                                                                         | `action` `method` `encType` `target` `autoFocus` `restoreFocus` `isDisabled` | `FormRenderers.tsx:96-114`               | string/enum/boolean  |
| 폼 공통(CheckboxGroup/RadioGroup/TextField/TextArea/NumberField/SearchField/Select/TagGroup) | `labelAlign` `necessityIndicator` `validationBehavior` `locale`              | `FormRenderers.tsx`                      | enum/string          |
| Dialog                                                                                       | `role`(`dialog`\|`alertdialog`)                                              | `LayoutRenderers.tsx:630`                | enum                 |
| FileTrigger                                                                                  | `acceptedFileTypes` `defaultCamera`                                          | `FormRenderers.tsx:872-877`              | string/enum          |
| Image (⚠️ catalog 미등록 — binding 신규 생성 필요)                                           | `src` `alt` `objectFit`                                                      | `LayoutRenderers.tsx:1825-1828` + Skia   | string/enum          |
| Card                                                                                         | `accentColor` `asset` `assetSrc` `preview`                                   | `LayoutRenderers.tsx:254` / Card.tsx     | string/icon          |
| Link                                                                                         | `showExternalIcon`                                                           | `LayoutRenderers.tsx:1030`               | boolean              |
| Tabs                                                                                         | `density` `isQuiet` `showIndicator`                                          | `LayoutRenderers.tsx:142-171`            | enum/boolean         |
| Table                                                                                        | `columns` `rows`(별개 fallback 데이터 소스)                                  | `getTableProjectionRows`/canvasSceneNode | binding/string-array |

> **⚠️ P1-c `formatOptions` (object 값) — Gate G3**: `Intl.NumberFormatOptions` 는 object. 기존 `InspectorFieldKind` 에 object editor 없음(`types.ts:133-144` 확인). `NumberField` renderer 는 object 일 때만 RAC 로 전달(`FormRenderers.tsx`). **string JSON 으로 우회 시 parse/validation/toRacProps 처리 없으면 runtime 무시** → accepts-only 범위 초과. 신규 kind 또는 runtime work 필요 시 **사용자 surface 후 별도 ADR** (G3).
>
> **P1-f Date `errorMessage`**: Date renderer 가 이미 `errorMessage` 소비(`DateRenderers.tsx`) → 입력 공통 errorMessage(P1-a)와 동일 패턴. Date 도 P1 포함(codex 2026-06-25, 이전 누락 정정).
>
> **`minValue`/`maxValue`(날짜)**: `DateValue` 객체지만 ISO 문자열 직렬화로 string kind 표현 가능성 우선 검증.
>
> **⚠️ P1-g Image**: Image 는 catalog 미등록(palette-only overlay)이라 binding 파일 자체가 없음 → `Image.binding.ts` 신규 생성 + catalog 등록 필요. 단순 accepts 추가보다 작업량 큼 → 우선순위 후순위 또는 사용자 surface.

### Phase 1.5 — RSP custom 복원 (audit §9-2, accepts + 렌더러 wiring 양쪽 필요)

P1-g 와 달리 **렌더러도 미forward** 라 accepts 추가 + 렌더러 wiring 양쪽 필요(작업량 큼). P1 완료 후 착수.

| 그룹                    | 대상                             | 추가 prop                                                            | 비고                                                                                                 |
| ----------------------- | -------------------------------- | -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| P1.5-a contextualHelp   | 12 컴포넌트(폼/색상/컬렉션 전반) | `contextualHelp`                                                     | **전멸**(spec 12 → binding 0). RSP 표준. accepts(string/binding) + RAC wiring                        |
| P1.5-b 텍스트 HTML attr | TextField/SearchField            | `autoComplete` `autoCorrect` `inputMode` `enterKeyHint` `spellCheck` | ✅ Implemented (2f19e3b0e). TextArea 제외(rendererMap 키 부재). RAC 공식 prop, controlled-value 직교 |
| P1.5-c field icon       | TextField/SearchField            | `icon`                                                               | ⛔ 보류 — **dead restoration**(아래 §1.5-c 결론 참조). 별도 ADR                                      |
| P1.5-d Slider 시각      | Slider                           | `fillOffset` `isFilled` `showValueLabel`(live) `trackGradient`(dead) | 일부 live, trackGradient 는 spec-only 데코(노이즈 가능)                                              |

#### §1.5-c 결론 — field `icon` 은 dead restoration (2026-06-26 보류 결정)

P1.5-c 의 field `icon?: string`("icon-name" 입력) prop 은 **삭제 전 spec 시절에도 화면에 렌더되지 않던 dead prop** 으로 확인됨. 따라서 "결손 복원"(동작하던 편집 기능 회복)이 아니라 **신규 기능 설계**이며, ADR-915 parity 복원 scope 밖. 진행하려면 별도 ADR(create-adr) 필요.

근거(코드 사실, 2026-06-26 grep):

- **삭제 spec `render.shapes` 미소비**: `TextField.spec.ts`(삭제 커밋 `91c2be0dd`~1) 의 render 블록(line 520-672)에 `props.icon` 참조 0건. `icon` 은 타입 선언(line 66) + editor field placeholder(line 159-164)에만 존재 → 삭제 전부터 Skia(Builder) 미렌더.
- **RAC 에 icon slot 부재**: RAC `TextField`/`SearchField` 는 외부 주입 `icon` prop 미노출(`node_modules/react-aria-components` 타입 grep 0건) → Preview(DOM) forward 대상 자체 없음.
- **live icon 경로는 다른 이름**: composition 실제 icon 렌더는 전부 `iconName`(Button/Date/Selection 렌더러 + `getIconData()`) → field `icon` 과 미연결.
- **검색 아이콘은 RAC 자체 합성**: builder SearchField 의 돋보기 아이콘은 `.builder-search-icon`(`SearchField.css:23`)을 RAC 가 자체 합성한 것 → 이 `icon` prop 과 무관.
- **`SpecField.tsx:40 field.icon`** 은 별개: Inspector 패널 필드 옆 lucide **장식 아이콘**(editor field 메타 `icon: Image`)이지 컴포넌트가 렌더하는 field icon 이 아님.

→ field leading icon 을 실제 표시하려면 RAC slot 합성(DOM) + Skia field icon shape(신규) 양쪽 구현 필요 → 별도 ADR scope.

## §3. Skia/CSS 3경로 소비 점검 (canonical-rendering 규칙)

`accepts`에 prop 추가 = 편집 surface 추가일 뿐, 시각 반영은 별개. 각 prop이:

- **DOM/CSS(Preview)**: `toRacProps`로 RAC에 전달되는가
- **Skia(Builder)**: render.shapes/projection이 해당 prop을 읽는가
- **Layout**: layout-affecting prop이면 `LAYOUT_PROP_KEYS`/layoutVersion 점검

대부분 P1 prop은 RAC 동작 prop(value/name/granularity 등)이라 Skia 시각 무관(DOM 전용). `granularity`처럼 세그먼트 렌더에 영향 주는 건 Skia 점검 필수.

## §4. 검증 (완료 기준 — live behavior 게이트)

- [ ] type-check PASS
- [ ] 각 P0 정정 항목: 정정 후 해당 컴포넌트 Inspector에서 옵션/필드 정상 표시 (Chrome MCP 1회 exercise)
- [ ] 각 P1 그룹: 추가 prop이 Inspector 패널에 표시 + 편집 시 store 반영 + Preview 동작 변화 1회 확인
- [ ] cross-check (granularity 등 Skia 영향 prop 한정)
- [ ] CHANGELOG Bug Fixes/Features 반영

## §5. scope 가드 (사용자 지정 — 좁게 유지)

- P2/P3(컬렉션 core, Color 채널, Heading.level, Popover placement 등)는 **본 ADR 제외**. 후속 분리.
- 신규 `InspectorFieldKind` 추가가 필요한 prop(formatOptions 등)은 scope 확장 → 사용자 surface 후 별도 판단.
