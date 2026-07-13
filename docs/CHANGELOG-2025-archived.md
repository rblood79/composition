## Archived entries (former root CHANGELOG.md, consolidated 2026-04-03)

> The following block was preserved from the repository root `CHANGELOG.md` when consolidating to a single changelog file.

## [Unreleased]

### Refactored - Property Editor Spec Generic 대규모 전환 (2026-03-27)

ADR-041 Phase 0~4 완료. 수동 에디터 46개 삭제, 컴포넌트 패널 73개 중 53개(72.6%) Spec Generic 자동 생성.

#### Spec Generic 완전 전환 (10개 에디터 삭제)

- **Button, TextField**: Spec `properties`에 모든 필드 선언, propagation으로 자식 sync 자동화
- **CheckboxGroup, RadioGroup**: `children-manager` + propagation으로 아이템 CRUD/size 전파 자동화
- **ComboBox, Select**: Content/Design/Trigger Behavior + Item Management 모두 Spec properties로 전환, label/placeholder propagation 규칙 추가
- **TagGroup, Tree**: children-manager로 아이템 관리 자동화, label propagation 추가

#### Propagation 규칙 추가

- ComboBox: `label → Label.children`, `placeholder → [ComboBoxWrapper, ComboBoxInput].placeholder`
- Select: `label → Label.children`, `placeholder → [SelectTrigger, SelectValue].children`
- TagGroup: `label → Label.children`

#### Hybrid CRUD → children-manager 전환 (6개)

- ComboBox(ComboBoxItem), Select(SelectItem), ListBox(ListBoxItem), GridList(GridListItem), TagGroup(Tag), Tree(TreeItem)

#### 잔여 Hybrid (4개)

- ListBox, GridList: filtering 섹션만 수동
- Tabs: Tab+Panel 쌍 생성 (구조상 children-manager 불가)
- Slider: Range 모드 Thumb 동적 생성/삭제

### Refactored - RangeSlider 잔여 참조 제거 및 SelectBoxGroup → GridList 통합 (2026-03-23)

#### RangeSlider 잔여 참조 완전 제거

이전 커밋(a73e8933)에서 RangeSlider를 Slider로 통합 완료 후, 코드베이스에 남아있던 참조를 전면 제거했다.

- `ComponentFactory` — `RangeSlider` creator 항목 제거
- `metadata.ts` — `RangeSlider` 메타데이터 항목 제거
- `rendererMap` — `RangeSlider` 렌더러 매핑 제거
- `ElementSprite.tsx` TAG_SPEC_MAP — `RangeSlider` spec 등록 제거
- `implicitStyles.ts` SLIDER_TAGS — `RangeSlider` 태그 제거
- `ComponentRegistry.tsx` (publish) — 배포 앱 등록에서 `RangeSlider` 제거
- 개발 단계이므로 하위 호환 리다이렉트 불필요

#### SelectBoxGroup/SelectBoxItem → GridList/GridListItem 통합

React Spectrum S2의 SelectBoxGroup은 React Aria GridList를 래핑한 것으로 기능이 중복되었다. GridList에 카드형 레이아웃 지원을 추가하여 통합했다.

##### 삭제된 파일

- `packages/specs/src/components/SelectBoxGroup.spec.ts`
- `packages/specs/src/components/SelectBoxItem.spec.ts`
- `packages/shared/src/components/styles/generated/SelectBoxGroup.css`
- `packages/shared/src/components/styles/generated/SelectBoxItem.css`
- `apps/builder/src/builder/panels/properties/editors/SelectBoxGroupEditor.tsx`
- `apps/builder/src/builder/panels/properties/editors/SelectBoxItemEditor.tsx`

##### GridList 확장 — layout prop

| prop      | 값                      | 동작                                                |
| --------- | ----------------------- | --------------------------------------------------- |
| `layout`  | `"stack"` (기본)        | 1열 세로 리스트 (`grid-template-columns: 1fr`)      |
| `layout`  | `"grid"`                | 격자 배치 (`grid-template-columns: repeat(N, 1fr)`) |
| `columns` | 숫자 (layout="grid" 시) | 열 개수                                             |

- GridList 아이템: SelectBoxItem 카드형 디자인 적용 (border 카드 + accent border 선택 표시)
- React Aria `GridList`의 `layout` prop 직접 전달 (`data-layout` 수동 전달 불가)

##### 해결한 기술적 이슈

| 문제                                       | 원인                                                           | 해결                                                |
| ------------------------------------------ | -------------------------------------------------------------- | --------------------------------------------------- |
| Taffy `gridTemplateColumns` 포맷 오류      | CSS 문자열(`"1fr 1fr"`) 전달 → Taffy WASM 파싱 실패            | 배열(`["1fr","1fr"]`) 형식으로 전달                 |
| React Aria `data-layout` 미반영            | `data-layout` 수동 전달 불가 — React Aria 내부에서 설정        | `layout={layout}` prop으로 직접 전달                |
| WebGL 레이아웃 캐시 미갱신                 | `LAYOUT_PROP_KEYS`에 `"layout"` 누락 → 캐시 히트 → 변경 미반영 | `layoutCache.ts` LAYOUT_PROP_KEYS에 `"layout"` 추가 |
| Taffy incremental update display 전환 실패 | flex↔grid 전환 시 기존 Taffy 노드 재사용 → 타입 충돌           | display 타입 변경 감지 시 full rebuild 수행         |

##### 수정된 주요 파일

- **GridList.spec.ts** — `layout` prop 추가, 카드형 아이템 디자인 적용, 투명 컨테이너
- **GridList.css** — display:grid 기본, 카드형 아이템 스타일(border + accent selected), `data-layout="grid"` 시 multi-column
- **GridList.tsx** — `layout`/`columns` prop 추가, React Aria에 `layout` 직접 전달
- **unified.types.ts** — `GridListElementProps`에 `layout` prop 추가
- **GridListEditor.tsx** — Layout 선택 UI 추가
- **SelectionRenderers.tsx** — `renderGridList`에 `layout`/`columns` prop 전달
- **implicitStyles.ts** — GridList layout 처리 (stack→flex column, grid→display:grid + gridTemplateColumns 배열)
- **inspectorActions.ts** — `LAYOUT_AFFECTING_PROPS`에 `"layout"`, `"columns"` 추가
- **layoutCache.ts** — `LAYOUT_PROP_KEYS`에 `"layout"` 추가
- **fullTreeLayout.ts** — display 타입 전환(flex↔grid) 감지 시 persistent tree full rebuild
- **persistentTaffyTree.ts** — `getLastJson()` 메서드 추가

---

### Refactored - Slider / RangeSlider 통합 (2026-03-23)

#### RangeSlider → Slider Range Mode 통합

- `RangeSlider`를 별도 컴포넌트에서 제거하고 `Slider` 단일 컴포넌트로 통합
- React Aria `Slider<number | number[]>` 패턴 — `value` 타입으로 single / range 자동 분기
- Inspector "Range Mode" 토글로 single ↔ range 전환 (thumb 개수가 달라지면 Preview remount)
- `createRangeSliderDefinition` 제거 → `createSliderDefinition(context, { isRange: true })`로 리다이렉트
- ComponentList에서 "RangeSlider" 항목 제거, metadata `RangeSliderEditor` → `SliderEditor` 리다이렉트

#### Spec 변경

- `Slider.spec.ts`: `skipCSSGeneration: true`, `value: number | number[]`, 투명 배경
  - `sizes.height` = `trackHeight` (sm:4 / md:8 / lg:12) — ProgressBar dimensions 동기
- `SliderTrack.spec.ts`: `skipCSSGeneration: true`, track bg + fill + thumb 렌더링 (SliderThumb 대신)
  - range fill 지원, track bg `{color.neutral-subtle}`
  - `SLIDER_THUMB_SIZES`: sm:14 / md:18 / lg:22
- `SliderThumb.spec.ts`: `skipCSSGeneration: true`, shapes → 빈 배열 (시각 렌더링은 SliderTrack 담당, 이벤트 히트 영역 전용)
- `SliderOutput.spec.ts`: `skipCSSGeneration: true`, size 타입 `"sm"|"md"|"lg"`, text color → `{color.neutral-subdued}`

#### CSS 변경

- Slider / SliderTrack / SliderThumb / SliderOutput generated CSS 전체 삭제 (`skipCSSGeneration: true` 전환)
- 수동 `Slider.css`가 전체 담당: `.slider-track-bg` + `.slider-fill` 실제 DOM 요소, variant별 `--slider-color`, size별 trackHeight / thumbSize
- `max-width: 300px` 제거, `background: var(--bg-overlay)` 제거
- thumb border: `var(--color-white)` → `var(--bg)` (dark mode 대응)

#### Preview 변경

- `Slider.tsx`: `variant` prop + `data-variant` 속성, fill bar 렌더링 (`.slider-track-bg` + `.slider-fill`), controlled mode (`value` prop)
- `renderSlider`: `value` / `variant` prop 전달, `key`에 thumb 개수 포함 (range 전환 시 remount)

#### 레이아웃 / Skia 변경

- `implicitStyles.ts`: Slider 블록 (Label fit-content + `justifyContent: space-between`), SliderTrack 블록 (thumb absolute positioning for selection bounds)
- `SLIDER_TRACK_LAYOUT_HEIGHT` = thumbSize (14/18/22) — 시각적 trackHeight가 아닌 thumb 수용 목적
- `ElementSprite.tsx`: `parentSliderValueSerialized` / `MinValue` / `MaxValue` / `Variant` selectors, `isSliderTrack` delegation 추가
- `PARENT_SIZE_DELEGATION_TAGS`에 `SliderTrack` / `SliderOutput` / `SliderThumb` 추가
- `LAYOUT_AFFECTING_PROPS`에 `value` / `minValue` / `maxValue` / `variant` 추가
- `patchBatchStyleFromImplicit`에 `position` / `left` / `top` / `right` / `bottom` → inset 변환 추가

#### Editor 변경

- `SliderEditor`: Range Mode 토글, Start / End Value 입력, `syncSliderTrackProp()` 동기화
- `value` / `minValue` / `maxValue` 변경 시 SliderTrack에 직접 동기화

### Added - Calendar/DatePicker Compositional Architecture (2026-02-27)

#### Calendar Compositional 전환

- Calendar spec: `_hasChildren=true` → bg shapes만 반환, standalone 콘텐츠 스킵
- CalendarHeader spec: 독립 렌더링 (prev/next nav + month text)
- CalendarGrid spec: 독립 렌더링 (weekday labels + date cells)
- TAG_SPEC_MAP에 CalendarHeaderSpec, CalendarGridSpec 등록
- Factory: Calendar에 nested CalendarHeader/CalendarGrid children 추가

#### DatePicker Compositional 전환 (ComboBox 패턴)

- DatePicker spec: `_hasChildren=true` → `return []` (투명 컨테이너)
- DateField: trigger 영역 독립 렌더링 (bg + border + date text)
- Calendar: Compositional sub-children (CalendarHeader + CalendarGrid)
- Factory: Card 패턴 (`width:284px`, flex column, `gap:8px`)
- `calculateContentHeight`: datepicker (자식 합산 + gap), datefield (sm=32, md=40, lg=48)
- `treatAsBorderBox`: `isDatePickerElement` 추가
- TRANSPARENT_CONTAINER_TAGS에 'DatePicker' 추가
- DatePicker.spec.ts: width CSS 문자열 parseFloat 수정

### Fixed - 빌드 에러 17건 수정 (0 에러) (2026-02-27)

- **styleConverter.ts**: CSSStyle 인터페이스에 flexbox 속성 9개 추가 (flexWrap, justifyContent, alignItems 등)
- **AutocompleteEditor.tsx**: lucide-react `Type` 아이콘 import 추가
- **TaffyFlexEngine.ts / TaffyGridEngine.ts**: `applyCommonTaffyStyle` 호출 시 `result as Record<string, unknown>` 캐스트
- **canvaskitTextMeasurer.ts**: resolveSlant/resolveWeight/resolveWidth 반환 타입 `unknown` → `any`
- **rustWasm.ts**: `mod.default` double cast (`as unknown as () => Promise<void>`)
- **BuilderCanvas.tsx**: synthetic label 생성 시 존재하지 않는 `project_id` 필드 제거
- **TextSprite.tsx**: `boxData` 명시적 타입 + `skiaNodeData as SkiaNodeData` 캐스트

### Fixed - 폰트 메트릭 캐싱 및 CSS 상속 (2026-02-27)

#### 1px 높이 차이 수정 (Web 34px vs WebGL 35px)

- **원인**: `measureFontMetrics()`가 Pretendard 로드 전 시스템 폴백 폰트(sans-serif)의 fontBoundingBox(17px)를 캐시 → Pretendard(16px)와 1px 차이
- **수정** (`textMeasure.ts`): `document.fonts.ready` 이후에만 메트릭 캐시 저장, 로드 완료 시 캐시 클리어 + `composition:fonts-ready` 이벤트 발행
- **수정** (`BuilderCanvas.tsx`): `composition:fonts-ready` 이벤트 수신 시 레이아웃 재계산 트리거

#### 스타일 패널 CSS 상속 속성 해결

- **문제**: 자식 요소(Button 등)에 fontFamily 미지정 시 스타일 패널에 "reset" 표시 (부모의 상속값 미반영)
- **수정** (`useZustandJotaiBridge.ts`): `resolveInheritedStyle()` — 부모 체인 탐색으로 9개 CSS 상속 속성(fontFamily, fontSize, fontWeight 등) 해결 → `computedStyle`에 병합
- **수정**: Zustand 구독 조건에 `elementsMap` 추가 (부모 스타일 변경 시 상속값 재계산)

#### DEFAULT_FONT_FAMILY 상수 통일

- `customFonts.ts`에 `DEFAULT_FONT_FAMILY = 'Pretendard'` 상수 정의
- 4곳 하드코딩 제거: `unified.types.ts`, `styleAtoms.ts`, `cssResolver.ts`의 `ROOT_COMPUTED_STYLE`
- Body 기본 props에 `fontFamily: DEFAULT_FONT_FAMILY` 추가 (CSS 상속 기반)

### Docs - COMPONENT.md (구 COMPONENT_SPEC_ARCHITECTURE.md) 전체 검증 및 수정 (2026-02-27)

4개 병렬 에이전트로 전체 문서(6400+ lines)를 코드와 대조 검증, 14건 불일치 수정:

- §1.3, §2.1: 컴포넌트 수 72 → 73 (실제 spec 파일 수 반영)
- §3.2: 디렉토리 구조에 adapters, icons, utils 누락 추가
- §3.3.2: Shape union에 `icon_font` 타입 추가 + `IconFontShape` 인터페이스 문서화
- §3.3.2: TextShape/ShadowShape/BorderShape에서 코드 미구현 속성 제거 (과대 문서화 해소)
- §3.3.2: ContainerLayout에서 미구현 속성 제거 (`inline-block`, `flow-root`, `fixed`, box-model, overflow, typography)
- §9.2-9.3: Shape 변환 테이블에 `icon_font → icon_path` 매핑 추가
- §9.3.1: SkiaNodeData.type에 `icon_path`, `partial_border` 추가
- §9.8.4: Card Factory 상태 "❌ 미정의" → "✅ 정의됨" (LayoutComponents.ts 반영)
- §9.13.8: COMPLEX_COMPONENT_TAGS 수 38 → 40 (실제 코드 반영)
- §10.1: 패키지 버전 업데이트 (vitest 1→4, pixelmatch 5→7, @playwright/test 1.40→1.58, eslint 10 추가)

### Changed - 추가 라이브러리 업데이트 (2026-02-27)

| 패키지                      | 이전    | 이후    | 사용처          |
| --------------------------- | ------- | ------- | --------------- |
| lucide-react                | 0.562.0 | 0.575.0 | builder, shared |
| three                       | 0.182.0 | 0.183.1 | builder         |
| @types/three                | 0.182.0 | 0.183.1 | builder         |
| eslint-plugin-react-refresh | 0.4.26  | 0.5.2   | config          |

### Changed - ESLint 10 업그레이드 (2026-02-27)

#### 업데이트된 패키지

| 패키지     | 이전   | 이후   | 사용처                          |
| ---------- | ------ | ------ | ------------------------------- |
| eslint     | 9.39.2 | 10.0.2 | builder, publish, shared, specs |
| @eslint/js | 9.39.2 | 10.0.1 | config                          |

#### 주요 변경 사항

- `@eslint/js` 10 recommended에 새 규칙 2개 추가:
  - `no-useless-assignment` — 사용되지 않는 할당 감지 (builder 12건)
  - `preserve-caught-error` — catch 에러 원인 체인 보존 강제 (builder 5건)
- Flat Config 이미 사용 중이므로 설정 파일 변경 불필요
- 커스텀 규칙 5개 모두 호환 확인 (표준 API만 사용)
- `typescript-eslint` 8.56.1, `eslint-plugin-react-refresh` 0.4.26 — 호환 확인
- `eslint-plugin-react-hooks` 7.0.1 — peer에 ESLint 10 미포함이나 Flat Config 방식으로 정상 동작

#### 검증 결과

- `pnpm -F @composition/builder lint` — 동작 확인 (새 규칙 17건은 기존 코드 품질 이슈)
- `pnpm -F @composition/specs lint` — 통과
- `pnpm -F @composition/shared lint` — 동작 확인 (기존 에러만)

### Changed - Phase 3 라이브러리 업데이트 (2026-02-27)

#### 개요

메이저 업데이트 대상 라이브러리 7개를 업데이트했습니다 (@types/node 25는 별도 검토 필요로 제외, ESLint 10과 Vitest 4는 별도 항목으로 완료).

#### 업데이트된 패키지 (7개)

| 패키지                             | 이전   | 이후   | 사용처            | 비고                                        |
| ---------------------------------- | ------ | ------ | ----------------- | ------------------------------------------- |
| @chromatic-com/storybook           | 4.1.3  | 5.0.1  | builder           | 메이저, Storybook 10.1+ 필수 (충족)         |
| globals                            | 16.5.0 | 17.3.0 | config            | 메이저, audioWorklet 분리 (미사용)          |
| immer                              | 10.2.0 | 11.1.4 | builder (catalog) | 메이저, 코드에서 미사용 (Zustand peerDep만) |
| cross-env                          | 7.0.3  | 10.1.0 | publish (catalog) | 메이저, ESM-only (CLI 도구, 영향 없음)      |
| pixelmatch                         | 5.3.0  | 7.1.0  | specs             | 메이저, 코드에서 미사용 (향후 VRT용)        |
| @playwright/mcp                    | 0.0.53 | 0.0.68 | root              | pre-1.0, CLI 플래그 변경                    |
| @material/material-color-utilities | 0.3.0  | 0.4.0  | builder           | minor, 생성자 API 호환 유지 확인            |

#### 주요 변경 사항

- **@chromatic-com/storybook 5.0**: Storybook 10.1+ peer dependency 필수화. 이미 10.2.13 사용 중이므로 영향 없음
- **globals 17.0**: `audioWorklet` 환경이 `globals.browser`에서 분리. 프로젝트 미사용
- **immer 11.0**: loose iteration 기본값 변경, 패치 생성 방식 변경. 프로젝트에서 `produce()` 미사용 (Phase 1에서 제거 완료)
- **cross-env 10.0**: ESM-only 전환. CLI 도구로만 사용하므로 코드 변경 불필요
- **pixelmatch 7.0**: ESM-only, 반투명 픽셀 블렌딩 변경. 코드에서 import하지 않아 영향 없음
- **@playwright/mcp 0.0.68**: 기본 incognito 동작, CLI 플래그 이름 변경 (`--session` → `-s=` 등)
- **material-color-utilities 0.4**: `SpecVersion`, `DynamicScheme.from()` 도입. 기존 생성자 `new SchemeTonalSpot(hct, isDark, contrastLevel)` 호환 유지 확인. `DEFAULT_SPEC_VERSION = "2021"`이므로 `contrastLevel < 0`도 정상 동작

### Changed - Vitest 마이그레이션 (2026-02-27)

#### 개요

`@composition/specs` 패키지의 Vitest를 1.6.1 → 4.0.18로 업그레이드했습니다 (3개 메이저 버전 점프).

#### 업데이트된 패키지

| 패키지              | 이전  | 이후   | 사용처 |
| ------------------- | ----- | ------ | ------ |
| vitest              | 1.6.1 | 4.0.18 | specs  |
| @vitest/coverage-v8 | 1.6.1 | 4.0.18 | specs  |

#### 주요 변경 사항

- `vitest.config.ts` — 기존 설정 호환, 수정 불필요
- `vi.doMock`, `vi.spyOn`, `vi.fn` — 정상 동작 확인
- 스냅샷 형식 (`// Vitest Snapshot v1`) — 호환 유지, 재생성 불필요
- `AllSpecs.validation.test.ts` — `validTypes` 배열에 `icon_font` 추가 (기존 누락 수정)

#### 검증 결과

- 전체 테스트 1013/1013 통과
- 스냅샷 테스트 정상 통과

#### 미포함 (별도 검토 필요)

| 패키지      | 현재    | 최신   | 사유                                            |
| ----------- | ------- | ------ | ----------------------------------------------- |
| @types/node | 24.10.4 | 25.3.2 | Node.js 25 (non-LTS) 대상, 런타임 불일치 비권장 |

#### 검증 결과 (Phase 3 종합)

- `vite build` — 성공
- `build-storybook` — 성공
- 생성자 API 타입 호환성 — 확인 완료
- specs 테스트 1013/1013 — 통과

### Changed - Phase 2 라이브러리 업데이트 (2026-02-27)

#### 개요

Phase 1에 이어 중간 위험도 마이너 업데이트 대상 라이브러리 9개를 업데이트했습니다.

#### 업데이트된 패키지 (9개)

| 패키지                      | 이전    | 이후    | 사용처          |
| --------------------------- | ------- | ------- | --------------- |
| @storybook/addon-onboarding | 10.1.10 | 10.2.13 | builder         |
| @storybook/react            | 10.1.10 | 10.2.13 | builder         |
| @storybook/react-vite       | 10.1.10 | 10.2.13 | builder         |
| eslint-plugin-storybook     | 10.1.10 | 10.2.13 | builder         |
| storybook                   | 10.1.10 | 10.2.13 | builder         |
| @tailwindcss/postcss        | 4.1.18  | 4.2.1   | builder         |
| tailwindcss                 | 4.1.18  | 4.2.1   | builder         |
| zod                         | 4.2.1   | 4.3.6   | builder, shared |
| @supabase/supabase-js       | 2.89.0  | 2.98.0  | builder         |

#### 주요 변경 사항

- **Storybook 10.2**: Viewport/Zoom UI 리뉴얼, CSF Factories 확장, ESLint 10 호환성 추가. Breaking change 없음
- **Tailwind CSS 4.2**: 새 색상 팔레트 4개(mauve, olive, mist, taupe), Logical property 유틸리티 추가. `start-*`/`end-*` deprecated (프로젝트 미사용)
- **Zod 4.3**: `.pick()`/`.omit()` + `.refine()` 조합 시 에러 throw 정책 변경 (프로젝트 미사용 패턴), `z.fromJSONSchema()`, `z.xor()` 등 신규 API 추가
- **Supabase 2.98**: `from()` 타입 안전성 강화, orphaned navigator lock 복구, Auth signOut 시 로컬 스토리지 정리 개선

#### 검증 결과

- `pnpm build-storybook` — 성공
- `pnpm -F @composition/shared type-check` — 성공
- `vite build` — 성공

### Changed - Phase 1 라이브러리 업데이트 (2026-02-27)

#### 개요

저위험 패치/마이너 업데이트 대상 라이브러리 35개를 업데이트했습니다.

#### 업데이트된 패키지 (35개)

| 패키지                         | 이전    | 이후    | 사용처                   |
| ------------------------------ | ------- | ------- | ------------------------ |
| @playwright/test               | 1.58.0  | 1.58.2  | @composition/specs       |
| @react-aria/focus              | 3.21.3  | 3.21.4  | builder, shared          |
| @react-aria/i18n               | 3.12.14 | 3.12.15 | builder                  |
| @react-aria/utils              | 3.32.0  | 3.33.0  | builder, shared          |
| @internationalized/date        | 3.10.1  | 3.11.0  | builder, shared          |
| @tanstack/react-query          | 5.90.12 | 5.90.21 | builder                  |
| @tanstack/react-query-devtools | 5.91.1  | 5.91.3  | builder                  |
| @tanstack/react-virtual        | 3.13.13 | 3.13.19 | builder, shared          |
| @types/lodash                  | 4.17.21 | 4.17.24 | builder                  |
| @types/react                   | 19.2.7  | 19.2.14 | builder, publish, shared |
| @vitejs/plugin-react-swc       | 4.2.2   | 4.2.3   | builder, publish         |
| @vitest/browser                | 4.0.16  | 4.0.18  | builder                  |
| @vitest/coverage-v8            | 4.0.16  | 4.0.18  | builder                  |
| @vitest/ui                     | 4.0.16  | 4.0.18  | builder                  |
| autoprefixer                   | 10.4.23 | 10.4.27 | builder                  |
| lodash                         | 4.17.21 | 4.17.23 | builder                  |
| react                          | 19.2.3  | 19.2.4  | builder, publish         |
| react-dom                      | 19.2.3  | 19.2.4  | builder, publish         |
| react-aria-components          | 1.14.0  | 1.15.1  | builder, publish, shared |
| react-stately                  | 3.43.0  | 3.44.0  | builder, shared          |
| react-router                   | 7.11.0  | 7.13.1  | builder                  |
| react-router-dom               | 7.11.0  | 7.13.1  | builder                  |
| vite                           | 7.3.0   | 7.3.1   | builder, publish         |
| vitest                         | 4.0.16  | 4.0.18  | builder                  |
| zustand                        | 5.0.9   | 5.0.11  | builder                  |
| jotai                          | 2.16.0  | 2.18.0  | builder                  |
| pixi.js                        | 8.14.3  | 8.16.0  | builder                  |
| puppeteer                      | 24.34.0 | 24.37.5 | builder                  |
| tailwind-merge                 | 3.4.0   | 3.5.0   | builder, shared          |
| lucide-react                   | 0.562.0 | 0.575.0 | builder, shared          |
| @types/three                   | 0.182.0 | 0.183.1 | builder                  |
| three                          | 0.182.0 | 0.183.1 | builder                  |
| eslint-plugin-react-refresh    | 0.4.26  | 0.5.2   | config                   |
| typescript-eslint              | 8.50.1  | 8.56.1  | config                   |

#### pixi.js 업데이트 보완 조치

- **문제**: specs 패키지의 peerDependency가 `^8.0.0`으로 넓어 pixi.js 버전이 이중 resolve되어 Bounds 타입 충돌 발생
- **해결**: `packages/specs/package.json`의 pixi.js peerDependency를 `^8.16.0`으로 범위 조정하여 단일 버전 resolve 유도
- **결과**: pnpm override 없이 pixi.js 8.16.0 단일 버전 사용, elementRegistry.ts Bounds 에러 해소

#### three.js r183 마이그레이션

- **문제**: `THREE.Clock`이 r183에서 deprecated, 콘솔 경고 발생
- **해결**: 6개 Particle Canvas 파일에서 `THREE.Clock` → `THREE.Timer`로 마이그레이션
  - `ParticleCanvas.tsx`, `SmokeCanvas.tsx`, `CurlNoiseCanvas.tsx`
  - `CodeParticleCanvas.tsx`, `MatrixRainCanvas.tsx`, `MondrianArtCanvas.tsx`
- **변경 내용**: `new THREE.Clock()` → `new THREE.Timer()`, 매 프레임 `timer.update()` 호출 추가, `getElapsedTime()` → `getElapsed()`

#### 검증 결과

- type-check: 통과 (전체 패키지)
- build: @composition/builder 실패 (기존 이슈 — Element.project_id, TaffyStyle, CSSStyle, canvaskit, rustWasm 등)
- build: @composition/publish, @composition/specs 성공

---

### Refactored - Child Composition Pattern: Property Editor 리팩터링 (2026-02-25)

#### 개요

Property Editor에서 부모-자식 props 동기화 로직을 커스텀 훅으로 추출하고,
히스토리를 단일 batch 엔트리로 통합하여 Undo/Redo 원자성을 확보했습니다.

#### 신규 파일

- `builder/hooks/useSyncChildProp.ts` — 직계 자식 동기화 BatchPropsUpdate 빌더 훅
- `builder/hooks/useSyncGrandchildProp.ts` — 손자 동기화 훅 (Select, ComboBox 전용)

#### 수정 파일 (12개)

- `builder/stores/inspectorActions.ts` — `updateSelectedPropertiesWithChildren` 메서드 추가
- `builder/hooks/index.ts` — barrel export 추가
- 10개 에디터: TextFieldEditor, NumberFieldEditor, SearchFieldEditor, CheckboxEditor,
  RadioEditor, SwitchEditor, SelectEditor, ComboBoxEditor, CardEditor, SliderEditor

#### 변경 내용

- **DRY**: 10개 파일의 중복 syncChildProp 코드(각 8~26줄) → 2개 훅으로 통합
- **히스토리 단일화**: 부모+자식 변경이 1개 batch 히스토리로 기록, Ctrl+Z 1회로 동시 원복
- **API**: `updateSelectedPropertiesWithChildren(parentProps, childUpdates)` — `batchUpdateElementProps` 기반

#### 마이그레이션

- Before: `onUpdate(props)` + `syncChildProp('Label', 'children', value)` (2개 히스토리)
- After: `updateSelectedPropertiesWithChildren(props, buildChildUpdates([...]))` (1개 히스토리)

---

### Fixed - Dynamic Flex Property Changes Not Reflected Without Refresh (2026-02-05)

#### Body 요소의 justify-content/align-items 동적 변경 시 Skia 캔버스 미갱신 수정

**문제**

- Body에 `display: flex; flex-direction: column;` 적용 후 `justify-content: flex-start; align-items: flex-start;` 추가 시 시각적 변화 없음
- 페이지 새로고침 후에만 정상 렌더링됨
- 부모의 flex 정렬 속성(alignItems, justifyContent, alignContent) 변경이 자식 요소 위치에 즉시 반영되지 않는 일반적 문제

**근본 원인**

- `@pixi/layout`의 `updateLayout()` 내부에서 `container.emit('layout')`이 `container._onUpdate()`보다 **먼저** 호출됨
- 'layout' 이벤트 핸들러(`syncLayoutData`)에서 `getBounds()`를 호출할 때, `_localTransformChangeId`가 아직 갱신되지 않아 `updateTransform()`이 새 위치를 반영하지 않음
- `updateElementBounds()`의 epsilon check(0.01 오차)가 stale bounds와 이전 bounds를 동일하게 판단 → `notifyLayoutChange()` 미호출
- `registryVersion` 미증가 → Skia 렌더 트리 캐시 재사용 → 이전 위치로 렌더링

```
@pixi/layout updateLayout() 실행 순서:
1. layout._computedPixiLayout = yogaNode.getComputedLayout()  ← 새 값 설정
2. container.emit('layout')  ← syncLayoutData 실행 (getBounds는 stale)
3. container._onUpdate()     ← 이후에야 transform 변경 시그널
```

**해결**

- LayoutContainer의 'layout' 이벤트 핸들러에서 `notifyLayoutChange()` **무조건 호출**
- `hasNewLayout()`이 true인 경우에만 이벤트가 발생하므로, 불필요한 호출 없이 안전
- Skia renderFrame은 PixiJS ticker priority -50 (Application.render() 이후)에 실행되어, 이 시점에서 `worldTransform`은 이미 갱신됨
- 기존 double-RAF 방식(`useEffect` + `requestAnimationFrame` 2중)은 rAF 타이밍 불확실성으로 실패 → 제거

**추가 수정: Block 요소 레이아웃**

- `containerLayout` 스프레드에 `...blockWidthOverride`가 누락되어 flex column 부모의 block 자식이 `width: 100%`를 받지 못하는 문제 수정
- `blockWidthOverride`는 `effectiveLayout` 이후에 스프레드되어야 `width: 'auto'` 기본값을 올바르게 덮어씀

**수정된 파일**

1. `apps/builder/src/builder/workspace/canvas/BuilderCanvas.tsx`
   - LayoutContainer `syncLayoutData`: 'layout' 이벤트에서 `notifyLayoutChange()` 무조건 호출
   - double-RAF useEffect 제거 (불필요)
   - containerLayout 스프레드에 `...blockWidthOverride` 추가

**결과**

- ✅ justify-content, align-items 변경 즉시 캔버스에 반영
- ✅ alignContent, flexWrap 등 모든 부모 flex 속성 동적 변경 지원
- ✅ Block 요소(Card, Panel, Form 등)가 flex column 부모에서 정확한 너비
- ✅ 새로고침 없이 스타일 패널 변경 즉시 반영
- ✅ TypeScript 에러 없음

### Fixed - Canvas Keyboard Shortcut (Backspace/Delete) Not Working (2026-02-05)

#### 캔버스에서 선택된 요소를 Backspace/Delete 키로 삭제 가능하도록 수정

**문제**

- 캔버스에서 요소를 선택한 후 Backspace/Delete 키를 눌러도 요소가 삭제되지 않음
- 삭제는 왼쪽 트리(레이어 패널)의 휴지통 아이콘으로만 가능했음
- Figma, Pencil App 등 디자인 도구의 기본 UX와 불일치

**근본 원인**

- `canvas-container` div에 `tabIndex`가 없어서 DOM 포커스를 받을 수 없었음
- WebGL 캔버스 클릭 시 `document.activeElement`가 캔버스 영역 밖(`document.body`)에 머물러 `useActiveScope`가 `canvas-focused` 스코프를 반환하지 않음
- Delete/Backspace 단축키 스코프가 `['canvas-focused', 'panel:events']`로 정의되어 있어, 활성 우측 패널 스코프(`panel:properties`, `panel:styles` 등)에서는 동작하지 않음
- 단축키 정의(`keyboardShortcuts.ts`)와 핸들러(`useGlobalKeyboardShortcuts.ts`)는 이미 올바르게 구현되어 있었으나, DOM 포커스 문제로 스코프 매칭이 실패

**해결**

- `canvas-container` div에 `tabIndex={-1}` 추가 (프로그래밍적으로 포커스 가능하되 Tab 탐색에는 포함되지 않음)
- `onPointerDown` 핸들러 추가: 캔버스 영역 클릭 시 컨테이너에 포커스 이동 → `activeScope`가 `canvas-focused`로 전환
- 텍스트 입력 요소(`input`, `textarea`, `contenteditable`) 클릭 시에는 포커스를 가져오지 않아 텍스트 편집에 영향 없음
- 포커스 시 불필요한 outline 표시 방지를 위해 CSS에 `outline: none` 추가

**수정된 파일**

1. `apps/builder/src/builder/workspace/canvas/BuilderCanvas.tsx` — `tabIndex={-1}` + `onPointerDown` 포커스 핸들러
2. `apps/builder/src/builder/workspace/Workspace.css` — `.canvas-container`에 `outline: none`

**결과**

- ✅ 캔버스에서 요소 선택 후 Backspace/Delete 키로 삭제 가능
- ✅ 라쏘 선택 후에도 Backspace/Delete 동작
- ✅ 텍스트 편집 중 Backspace는 정상적으로 텍스트 입력에 사용
- ✅ 기존 Copy(⌘C), Paste(⌘V), Escape 등 캔버스 스코프 단축키도 함께 활성화

### Fixed - Pencil-Style 2-Pass Skia Renderer (2026-02-04)

#### Phase 6 Fix: 컨텐츠 캐시 + 오버레이 분리로 렌더 파이프라인 교체

**배경**

- Skia 단일 패스(컨텐츠+오버레이 동시 렌더) + dirty rect/clip 기반 최적화는 좌표계/클리핑 이슈로 잔상·미반영 버그를 유발할 수 있음

**해결**

- **컨텐츠(contentSurface)**: 디자인 노드만 렌더링하여 `contentSnapshot` 캐시 생성
- **표시(mainSurface)**: 스냅샷 blit(카메라 델타는 아핀 변환) 후 **Selection/AI/PageTitle 오버레이를 별도 패스로 덧그리기**
- contentSurface에 **padding(기본 512px)** 을 추가하여 camera-only 아핀 blit의 가장자리 클리핑을 방지하고, `canBlitWithCameraTransform()` 가드로 안전성 확보
- Dirty rect 기반 부분 렌더링 경로는 제거(보류)하고, 컨텐츠 invalidation은 registryVersion 기반 full rerender로 단순화

**수정된 파일**

- `apps/builder/src/builder/workspace/canvas/skia/SkiaRenderer.ts`
- `apps/builder/src/builder/workspace/canvas/skia/SkiaOverlay.tsx`
- `apps/builder/src/builder/workspace/canvas/skia/useSkiaNode.ts`
- `apps/builder/src/builder/workspace/canvas/elementRegistry.ts`
- `docs/WASM.md`, `docs/PENCIL_APP_ANALYSIS.md`

### Fixed - Pencil 2-Pass Renderer Stabilization & Profiling (2026-02-05)

#### Phase 6 후속: 고배율 줌/리사이즈 안정화 + 관측 + 스타일 변경 Long Task 저감

**추가 개선**

- **contentSurface 백엔드 정합**: offscreen surface를 `mainSurface.makeSurface()`로 생성하여 메인과 동일 백엔드(GPU/SW) 사용 (`ck.MakeSurface()` raster-direct 경로 제거).
- **줌 스냅샷 보간**: zoomRatio != 1이면 `drawImageCubic` 우선 적용(미지원 환경 `drawImage` 폴백)으로 확대/축소 품질 개선.
- **Paragraph LRU 캐시**: 텍스트 `Paragraph`를 (내용+스타일+maxWidth) 키로 캐시(최대 500), 폰트 교체/페이지 전환/HMR에서 무효화.
- **리사이즈/DPR/컨텍스트 복원 안정화**: surface 재생성 직후 `invalidateContent()+clearFrame()`로 1-frame stale/잔상 방지.
- **Dev 관측(오버레이)**: `GPUDebugOverlay` 추가 — `RAF FPS`와 `Present/s`, `Content/s`, `Registry/s`, `Idle%`를 분리 관측.
- **스타일 변경 Long Task 저감**: `updateElementProps`/`batchUpdateElementProps`에서 `_rebuildIndexes()` 제거, IndexedDB 저장 백그라운드화, 멀티 선택은 batch 경로로 통합.

**수정된 파일**

- `apps/builder/src/builder/workspace/canvas/skia/SkiaRenderer.ts`
- `apps/builder/src/builder/workspace/canvas/skia/SkiaOverlay.tsx`
- `apps/builder/src/builder/workspace/canvas/skia/nodeRenderers.ts`
- `apps/builder/src/builder/workspace/canvas/utils/GPUDebugOverlay.tsx`
- `apps/builder/src/builder/stores/utils/elementUpdate.ts`
- `apps/builder/src/builder/panels/properties/PropertiesPanel.tsx`

### Fixed - Flex Layout CSS Parity & Style Reactivity (2026-02-02)

#### Phase 12 Fix: Flex 자식의 percentage width 오버플로우 및 스타일 즉시 반영

**문제 1: flex 부모에서 `width:100%` 자식이 오버플로우**

- `display:flex, flex-direction:row` 부모에 `width:100%` 버튼 2개 배치 시 body를 벗어남
- CSS 브라우저에서는 정상 동작하지만 WebGL(@pixi/layout)에서는 겹침 발생

**근본 원인:**

- CSS: `flex-shrink` 기본값 = 1 (축소 허용), `min-width` 기본값 = auto
- Yoga: `flex-shrink` 기본값 = 0 (축소 안 함), `min-width` 기본값 = 0
- 기존 코드에서 모든 요소에 `flexShrink: 0` 강제 적용

**해결:**

- 조건부 flexShrink 기본값: 퍼센트 width → `flexShrink: 1`, 고정 width → `flexShrink: 0`
- 사용자가 명시적 flexShrink 설정 시 그 값이 우선

```typescript
const hasPercentSize =
  (typeof effectiveLayout.width === "string" &&
    effectiveLayout.width.endsWith("%")) ||
  (typeof effectiveLayout.flexBasis === "string" &&
    String(effectiveLayout.flexBasis).endsWith("%"));
const flexShrinkDefault =
  effectiveLayout.flexShrink !== undefined
    ? {}
    : { flexShrink: hasPercentSize ? 1 : 0 };
```

**문제 2: 퍼센트 width가 시각적으로 반영되지 않음**

- Yoga가 올바른 위치를 계산하지만 BoxSprite/PixiButton이 raw CSS `width:'100%'`를 직접 사용
- `parseCSSSize('100%', undefined, 100)` → 100px으로 해석

**해결:**

- `LayoutComputedSizeContext` (React Context) 생성하여 Yoga 계산 결과를 자식에 전달
- `ElementSprite`에서 Context를 소비하여 퍼센트 width/height를 정확한 픽셀로 변환
- `container._layout.computedLayout`에서 Yoga 결과 직접 읽기 (`getBounds()`는 콘텐츠 bounding box)

**문제 3: 스타일 패널 변경 후 즉시 반영되지 않음**

- 스타일 변경 후 캔버스를 팬(이동)해야 반영됨

**근본 원인 (복합):**

1. **LayoutContainer 타이밍**: `requestAnimationFrame` 콜백이 @pixi/layout의 `prerender`보다 먼저 실행, rAF는 1회만 실행
2. **Skia Dirty Rect 좌표계 불일치** (주 원인): `registerSkiaNode()`이 dirty rect를 CSS 로컬 좌표(`data.x/y`)로 계산하지만, 실제 Skia 렌더링은 카메라 변환(`translate+scale`) 후 스크린 좌표에서 수행. `renderContent()`의 `clipRect`이 실제 렌더 위치와 불일치하여 변경 사항이 클립 밖에 그려짐. 팬(이동) 시 `camera-only` 프레임이 전체 렌더링을 수행하여 비로소 변경 표시.

**해결:**

1. LayoutContainer: `container.on('layout', handler)` 이벤트 리스너로 교체
2. SkiaRenderer: `content` 프레임에서 dirty rect 부분 렌더링 대신 전체 렌더링 수행

```typescript
// LayoutContainer: @pixi/layout 'layout' 이벤트 구독
container.on('layout', syncLayoutData);
const rafId = requestAnimationFrame(syncLayoutData); // 최초 마운트 시 fallback

// SkiaRenderer: dirty rect 좌표 불일치 → 전체 렌더링으로 안전 처리
case 'content':
  this.renderContent(cullingBounds); // dirtyRects 미전달 → 전체 렌더링
  this.blitToMain();
  break;

// SkiaOverlay: ticker priority 분리 (Yoga 레이아웃 후 렌더링)
app.ticker.add(syncPixiVisibility, undefined, 25);  // HIGH: before Application.render()
app.ticker.add(renderFrame, undefined, -50);         // UTILITY: after Application.render()
```

**수정된 파일:**

1. `apps/builder/src/builder/workspace/canvas/BuilderCanvas.tsx`
   - LayoutContainer: 조건부 flexShrink, layout 이벤트 구독
2. `apps/builder/src/builder/workspace/canvas/layoutContext.ts` (신규)
   - `LayoutComputedSizeContext` — 순환 참조 방지용 별도 파일
3. `apps/builder/src/builder/workspace/canvas/sprites/ElementSprite.tsx`
   - Context 소비, 퍼센트 width/height를 Yoga 계산 결과 기반으로 해석
4. `apps/builder/src/builder/workspace/canvas/skia/SkiaRenderer.ts`
   - `content` 프레임: dirty rect 부분 렌더링 → 전체 렌더링으로 변경
5. `apps/builder/src/builder/workspace/canvas/skia/SkiaOverlay.tsx`
   - renderFrame: NORMAL(0) → UTILITY(-50) priority (Yoga 레이아웃 후 실행)
   - syncPixiVisibility: HIGH(25) priority로 분리 (alpha=0 설정)

**결과:**

- ✅ flex 부모에서 `width:100%` 자식이 CSS처럼 비례 축소
- ✅ 퍼센트 기반 width/height가 정확한 픽셀로 변환
- ✅ 스타일 패널 변경 즉시 캔버스에 반영
- ✅ display: block ↔ flex 전환 시 플리커 없음
- ✅ TypeScript 에러 없음

---

### Fixed - Hybrid Layout Engine CSS/WebGL Parity (2026-01-28)

#### Phase 9: display: flex 지원 및 CSS/WebGL 레이아웃 정합성 개선

**문제 1: Button 크기 불일치**

- WebGL에서 버튼들이 겹치거나 잘못된 위치에 렌더링됨
- BUTTON_SIZE_CONFIG 값이 @composition/specs ButtonSpec과 일치하지 않음

**해결:**

- `utils.ts`의 BUTTON_SIZE_CONFIG를 ButtonSpec 값으로 동기화
- padding 구조를 `paddingLeft`/`paddingRight`로 분리하여 유연성 확보

```typescript
const BUTTON_SIZE_CONFIG = {
  xs: { paddingLeft: 8, paddingRight: 8, fontSize: 12, height: 24 },
  sm: { paddingLeft: 12, paddingRight: 12, fontSize: 14, height: 32 },
  md: { paddingLeft: 16, paddingRight: 16, fontSize: 16, height: 40 },
  lg: { paddingLeft: 24, paddingRight: 24, fontSize: 18, height: 48 },
  xl: { paddingLeft: 32, paddingRight: 32, fontSize: 20, height: 56 },
};
```

**문제 2: StylesPanel에서 width가 0으로 표시됨**

- `fit-content` 등 CSS intrinsic sizing 키워드가 KEYWORDS에 없어서 파싱 실패

**해결:**

- `PropertyUnitInput.tsx`의 KEYWORDS에 intrinsic sizing 키워드 추가

```typescript
const KEYWORDS = [
  "reset",
  "auto",
  "inherit",
  "initial",
  "unset",
  "normal",
  "fit-content",
  "min-content",
  "max-content", // CSS intrinsic sizing
];
```

**문제 3: Page padding이 WebGL에 적용되지 않음**

- CSS에서는 page padding이 적용되지만 WebGL에서는 무시됨

**해결:**

- `BuilderCanvas.tsx`의 `renderWithCustomEngine`에 padding 처리 추가
- 부모의 padding을 파싱하여 자식 요소의 사용 가능 공간 계산
- 자식 위치에 padding offset 적용

```typescript
const parentPadding = parsePadding(parentStyle);
const availableWidth = pageWidth - parentPadding.left - parentPadding.right;
const availableHeight = pageHeight - parentPadding.top - parentPadding.bottom;
// 자식 위치에 padding offset 적용
left: layout.x + parentPadding.left,
top: layout.y + parentPadding.top,
```

**문제 4: display: flex가 WebGL에서 작동하지 않음**

- page나 component에 `display: flex`를 적용해도 시각적 변화 없음
- `rootLayout`에 `display: 'flex'`가 기본값으로 없어서 @pixi/layout이 flex 컨테이너로 인식하지 못함

**해결:**

- `rootLayout` 기본값에 `display: 'flex'` 명시적 추가
- `styleToLayout`에서 `display: 'flex'`와 `flexDirection` 처리 추가

```typescript
// rootLayout 기본값
const result = {
  display: "flex" as const, // 🚀 Phase 9: 명시적 추가
  flexDirection: "row" as const,
  flexWrap: "wrap" as const,
  // ...bodyLayout으로 덮어쓰기
  ...bodyLayout,
};

// styleToLayout에서 display: flex 처리
if (style.display === "flex" || style.display === "inline-flex") {
  layout.display = "flex";
  layout.flexDirection =
    (style.flexDirection as LayoutStyle["flexDirection"]) ?? "row";
}
```

**수정된 파일:**

1. `apps/builder/src/builder/workspace/canvas/layout/engines/utils.ts`
   - BUTTON_SIZE_CONFIG를 @composition/specs ButtonSpec과 동기화
   - padding → paddingLeft/paddingRight 구조 변경

2. `apps/builder/src/builder/components/property/PropertyUnitInput.tsx`
   - KEYWORDS에 `fit-content`, `min-content`, `max-content` 추가

3. `apps/builder/src/builder/workspace/canvas/BuilderCanvas.tsx`
   - `renderWithCustomEngine`에 부모 padding 처리 추가
   - `rootLayout`에 `display: 'flex'` 기본값 추가

4. `apps/builder/src/builder/workspace/canvas/layout/styleToLayout.ts`
   - `display: 'flex'` 및 `inline-flex` 처리 추가

**결과:**

- ✅ Button 크기가 CSS와 WebGL에서 일치
- ✅ StylesPanel에서 fit-content 등 intrinsic sizing 값 정상 표시
- ✅ Page/Component padding이 WebGL에 정상 적용
- ✅ display: flex, flexDirection이 WebGL에서 정상 동작
- ✅ TypeScript 에러 없음

---

### Refactored - @pixi/layout Migration Phase 7-8: Percentage Unit Support (2026-01-06)

#### Phase 7: SelectionBox 좌표 변환 수정

**문제:**

- SelectionBox와 렌더링된 요소의 위치가 일치하지 않음
- `getBounds()`가 글로벌 좌표를 반환하지만, SelectionBox는 Camera Container 안에서 렌더링됨

**해결:**

- `SelectionLayer.tsx`에 `panOffset` prop 추가
- 글로벌 좌표 → Camera 로컬 좌표 변환 로직 추가

```typescript
// 글로벌 좌표 → Camera 로컬 좌표 변환
const localX = (bounds.x - panOffset.x) / zoom;
const localY = (bounds.y - panOffset.y) / zoom;
const localWidth = bounds.width / zoom;
const localHeight = bounds.height / zoom;
```

**수정된 파일:**

- `apps/builder/src/builder/workspace/canvas/selection/SelectionLayer.tsx`
- `apps/builder/src/builder/workspace/canvas/BuilderCanvas.tsx`

#### Phase 8: 퍼센트(%) 단위 지원 - parseCSSSize 제거

**문제:**

- 스타일 패널에서 `width: 100%`를 설정해도 픽셀 값으로만 계산됨
- `parseCSSSize(style?.width, undefined, 300)` 호출 시 `parentSize`가 `undefined`이므로 % 값이 무시됨
- @pixi/layout은 % 값을 자동으로 처리하지만, 수동 계산이 이를 덮어씀

**근본적인 해결책:**

- UI 컴포넌트에서 `parseCSSSize` 호출 제거
- `layout` prop에 `style?.width`를 문자열 그대로 전달
- @pixi/layout이 부모 크기 기준으로 % 값을 자동 계산하도록 위임

**적용된 패턴:**

```typescript
// 이전 (% 지원 안됨)
const tabsWidth = parseCSSSize(style?.width, undefined, 300);
const rootLayout = { width: tabsWidth };

// 이후 (@pixi/layout이 % 자동 처리)
const styleWidth = style?.width;
const fallbackWidth = 300;
const rootLayout = { width: styleWidth ?? fallbackWidth };
```

**핵심 원칙:**

1. **layout prop에 style 값 직접 전달** - `'100%'`, `'50%'` 등 문자열 그대로 전달
2. **자식 레이아웃은 `100%` 또는 flex 사용** - `width: '100%'`, `flexGrow: 1`
3. **Graphics는 fallback 값 사용** - 픽셀 값이 필요한 경우 기본값 사용
4. **@pixi/layout 내장 스타일 활용** - `backgroundColor`, `borderColor`, `borderRadius`

**수정된 파일 (3개):**

1. `apps/builder/src/builder/workspace/canvas/ui/PixiTabs.tsx`
   - `parseCSSSize` import 제거
   - `rootLayout.width`에 `style?.width` 직접 전달
   - `tabListLayout`, `panelLayout`을 flex 기반으로 변경
   - Graphics border를 @pixi/layout `backgroundColor`로 대체

2. `apps/builder/src/builder/workspace/canvas/ui/PixiPanel.tsx`
   - `parseCSSSize` import 제거
   - `panelLayout`에 `styleWidth ?? fallbackWidth` 전달
   - `titleLayout`, `contentLayout`을 `width: '100%'`, `flexGrow: 1`로 변경
   - Graphics 배경을 layout `backgroundColor`, `borderColor` 기반으로 대체
   - 히트 영역을 layout 기반 `position: 'absolute'`로 변경

3. `apps/builder/src/builder/workspace/canvas/ui/PixiInput.tsx`
   - `parseCSSSize` import 제거
   - `inputLayout.width`에 `styleWidth ?? fallbackWidth` 전달
   - Graphics `drawBackground`에서 `fallbackWidth` 사용

**남은 작업 (25개 파일):**
동일한 패턴으로 수정 필요:

- PixiButton, PixiCheckbox, PixiCard, PixiList, PixiListBox
- PixiSlider, PixiProgressBar, PixiMeter, PixiSeparator
- PixiSelect, PixiScrollBox, PixiMaskedFrame 등

**결과:**

- ✅ Tabs, Panel, Input 컴포넌트에서 `width: 100%` 정상 동작
- ✅ @pixi/layout이 부모 크기 기준으로 % 자동 계산
- ✅ SelectionBox와 요소 위치 일치
- ✅ TypeScript 에러 없음

---

### Added - Export/Import Phase 1-4 Complete & Static HTML Generation (2026-01-03)

#### Export/Import 기능 완성 (Phase 1-4)

**Phase 1: 데이터 검증 강화**

- Zod 스키마 기반 검증 (`packages/shared/src/schemas/project.schema.ts`)
- 보안 JSON 파싱 (Prototype Pollution 방지)
- 파일 크기 제한 (10MB)
- 상세 에러 메시지 및 에러 코드

**Phase 2: 멀티 페이지 네비게이션**

- `PageNav` 컴포넌트 (`apps/publish/src/components/PageNav.tsx`)
- URL 해시 기반 라우팅 (`#page-{pageId}`)
- 브라우저 뒤로/앞으로 버튼 지원
- 페이지 전환 시 상태 유지

**Phase 3: 이벤트 런타임**

- `ActionExecutor` 클래스 (`packages/shared/src/runtime/ActionExecutor.ts`)
- 지원 액션 타입:
  - `CONSOLE_LOG`: 콘솔 로그 출력
  - `SHOW_ALERT`: 알림 팝업 표시
  - `OPEN_URL`: 외부 URL 열기
  - `NAVIGATE_TO_PAGE`: 페이지 내 이동
- `ElementRenderer`에서 이벤트 바인딩 (`apps/publish/src/renderer/ElementRenderer.tsx`)

**Phase 4: 버전 마이그레이션**

- 마이그레이션 시스템 (`packages/shared/src/utils/migration.utils.ts`)
- v0.9.0 → v1.0.0 마이그레이션 지원
- 마이그레이션 발생 시 알림 배너 표시
- 버전 호환성 검사

**Static HTML Generation**

- `generateStaticHtml()`: standalone HTML 파일 생성
- `downloadStaticHtml()`: HTML 파일 다운로드
- 외부 의존성 없이 동작하는 단일 HTML 파일
- 프로젝트 데이터 인라인 임베딩
- 기본 CSS 스타일 및 JavaScript 렌더러 포함

**ComponentRegistry 업데이트**

- `body` 컴포넌트 등록 (div로 렌더링)
- `Text` 컴포넌트 등록 (span으로 렌더링)
- @composition/shared 컴포넌트 통합

**수정된 파일:**

1. `packages/shared/src/schemas/project.schema.ts` (신규)
2. `packages/shared/src/runtime/ActionExecutor.ts` (신규)
3. `packages/shared/src/runtime/index.ts` (신규)
4. `packages/shared/src/utils/migration.utils.ts` (신규)
5. `packages/shared/src/utils/export.utils.ts` (확장)
6. `packages/shared/src/types/export.types.ts` (확장)
7. `apps/publish/src/components/PageNav.tsx` (신규)
8. `apps/publish/src/hooks/usePageRouting.ts` (신규)
9. `apps/publish/src/renderer/ElementRenderer.tsx` (이벤트 바인딩 추가)
10. `apps/publish/src/registry/ComponentRegistry.tsx` (body, Text 추가)
11. `apps/publish/public/project.json` (이벤트 및 멀티 페이지 테스트)
12. `apps/publish/public/project-v09.json` (마이그레이션 테스트)

**결과:**

- ✅ Export/Import 기능 100% 완성
- ✅ 이벤트 동작 테스트 완료 (CONSOLE_LOG, SHOW_ALERT, OPEN_URL, NAVIGATE_TO_PAGE)
- ✅ 멀티 페이지 네비게이션 테스트 완료
- ✅ v0.9.0 → v1.0.0 마이그레이션 테스트 완료
- ✅ Static HTML 내보내기 구현
- ✅ TypeScript 에러 없음

---

### Added - Project Export/Import JSON Functionality (2026-01-02)

#### 프로젝트 데이터 내보내기/가져오기 기능

**목적:**

- Builder에서 작업한 프로젝트를 JSON 파일로 내보내기
- Publish 앱에서 JSON 파일을 로드하여 프로젝트 미리보기
- 로컬 파일 기반 프로젝트 공유 및 백업 지원

**구현된 기능:**

1. **Export Utilities (`packages/shared/src/utils/export.utils.ts`)**
   - `ExportedProjectData` 인터페이스: 내보내기 데이터 구조 정의
   - `downloadProjectAsJson()`: 프로젝트 데이터를 JSON 파일로 다운로드
   - `loadProjectFromUrl()`: URL에서 프로젝트 JSON 로드
   - `loadProjectFromFile()`: File 객체에서 프로젝트 JSON 로드
   - `ImportResult` 타입: 로드 결과 (success/error) 처리

   ```typescript
   export interface ExportedProjectData {
     version: string;
     exportedAt: string;
     project: { id: string; name: string };
     pages: Page[];
     elements: Element[];
     currentPageId?: string | null;
   }
   ```

2. **Builder Export (`apps/builder/src/builder/main/BuilderCore.tsx`)**
   - `handlePublish` 함수 구현
   - Publish 버튼 클릭 시 프로젝트 JSON 다운로드
   - Store에서 elements, pages, currentPageId 추출
   - 프로젝트 ID와 이름 포함

   ```typescript
   const handlePublish = useCallback(() => {
     const state = useStore.getState();
     const { elements, pages, currentPageId } = state;
     downloadProjectAsJson(id, name, pages, elements, currentPageId);
   }, [projectId, projectInfo]);
   ```

3. **Publish App Rewrite (`apps/publish/src/App.tsx`)**
   - URL 파라미터에서 프로젝트 로드 (`?url=...`)
   - 기본 `/project.json` 파일 로드
   - 드래그 앤 드롭 파일 업로드 지원
   - 로딩/에러 상태 UI
   - Dropzone 스타일링

4. **Vite Alias Configuration (`apps/builder/vite.config.ts`)**
   - 객체 기반 alias에서 배열 + 정규식 패턴으로 변경
   - `@composition/shared/components/styles/*` 경로 지원
   - `@composition/shared/components/*` 경로 지원
   - 정규식 순서: 가장 구체적인 패턴부터 처리

   ```typescript
   resolve: {
     alias: [
       { find: "@", replacement: `${import.meta.dirname}/src` },
       { find: /^@composition\/shared\/components\/styles\/(.*)$/,
         replacement: `${import.meta.dirname}/../../packages/shared/src/components/styles/$1` },
       { find: /^@composition\/shared\/components\/(.*)$/,
         replacement: `${import.meta.dirname}/../../packages/shared/src/components/$1` },
       { find: "@composition/shared/components",
         replacement: `${import.meta.dirname}/../../packages/shared/src/components/index.tsx` },
       // ... more aliases
     ],
   },
   ```

**수정된 파일:**

1. `packages/shared/src/utils/export.utils.ts` (신규)
   - 프로젝트 내보내기/가져오기 유틸리티

2. `packages/shared/src/utils/index.ts`
   - export.utils 내보내기 추가

3. `apps/builder/src/builder/main/BuilderCore.tsx`
   - handlePublish 함수 구현

4. `apps/builder/vite.config.ts`
   - 정규식 기반 alias 패턴 추가

5. `apps/publish/src/App.tsx`
   - JSON 로딩 및 드롭존 UI로 완전 재작성

6. `apps/publish/src/styles/index.css`
   - `.publish-dropzone`, `.dropzone-content` 스타일 추가

7. `apps/publish/public/project.json`
   - 테스트용 샘플 프로젝트 JSON

**Export JSON 구조:**

```json
{
  "version": "1.0.0",
  "exportedAt": "2026-01-02T07:35:52.219Z",
  "project": {
    "id": "db1e4339-e9d1-40e5-a268-8df9d4bfc49d",
    "name": "AAA"
  },
  "pages": [
    {
      "id": "336554c4-c9ba-48e1-a278-d389c7519b72",
      "title": "Home",
      "slug": "/",
      "project_id": "db1e4339-e9d1-40e5-a268-8df9d4bfc49d",
      "parent_id": null,
      "order_num": 0,
      "layout_id": null
    }
  ],
  "elements": [
    {
      "id": "element-id",
      "tag": "Button",
      "props": { "children": "Button", "variant": "primary" },
      "parent_id": "parent-id",
      "page_id": "page-id",
      "order_num": 0
    }
  ],
  "currentPageId": "336554c4-c9ba-48e1-a278-d389c7519b72"
}
```

**결과:**

- ✅ Builder에서 Publish 버튼으로 프로젝트 JSON 다운로드
- ✅ Publish 앱에서 JSON 파일 로드 및 렌더링
- ✅ Builder와 Publish 앱 동일한 콘텐츠 렌더링 확인
- ✅ 드래그 앤 드롭 파일 업로드 지원
- ✅ URL 파라미터로 외부 JSON 로드 지원
- ✅ TypeScript 에러 없음

**사용 방법:**

1. **내보내기 (Builder)**
   - Builder에서 프로젝트 편집
   - 우측 상단 "Publish" 버튼 클릭
   - `{프로젝트명}.json` 파일 다운로드

2. **가져오기 (Publish)**
   - `pnpm --filter publish dev` 실행
   - 방법 1: `public/project.json`에 파일 배치
   - 방법 2: URL 파라미터 사용 (`?url=https://...`)
   - 방법 3: 파일을 드롭존에 드래그 앤 드롭

---

### Refactored - Monorepo Structure Cleanup (2026-01-02)

#### 레거시 파일 정리 및 구조 개선

**삭제된 파일:**

1. **`docs/archive/`** (11개 파일, 7,266줄)
   - CSS_INSPECTOR_ANALYSIS.md
   - CSS_REFACTORING_SUMMARY.md
   - ELECTRON_PUBLISH_FEATURE.md
   - PR_DESCRIPTION.md
   - REACT_STATELY_PROGRESS.md
   - REALTIME_SAVE_FIX.md
   - REALTIME_SAVE.md
   - REFACTOR_EXECUTION_PLAN.md
   - REFACTORING_PLAN.md
   - REFACTORING_SUMMARY.md
   - SAVE_MODE.md

2. **`apps/builder/src/types/componentVariants.ts`** (345줄)
   - M3Variant, TextFieldVariant 타입 미사용
   - 활성 타입은 `types/builder/componentVariants.types.ts`에 있음

**이동된 파일:**

3. **`apps/builder/src/shared/`** → 적절한 위치로 이동
   - `ComponentList.tsx` → `apps/builder/src/builder/panels/components/`
   - `ComponentSearch.tsx` → `apps/builder/src/builder/panels/components/`
   - `src/shared/` 디렉토리 삭제

**현재 모노레포 구조:**

```
composition/
├── apps/
│   ├── builder/          # Builder 앱
│   │   └── src/
│   │       ├── builder/  # Builder 전용 로직
│   │       │   ├── components/  # Builder UI (PanelHeader 등)
│   │       │   └── panels/      # 패널 (ComponentList 등)
│   │       └── types/    # Builder 전용 타입
│   └── publish/          # Publish 앱
│
└── packages/
    ├── shared/           # 공유 패키지 (@composition/shared)
    │   └── src/
    │       ├── components/  # 공유 UI (Button, Badge 등)
    │       ├── renderers/   # PageRenderer
    │       ├── hooks/
    │       ├── types/
    │       └── utils/
    └── config/           # 공유 설정
```

**분리 원칙:**

| 위치                        | 용도                                        |
| --------------------------- | ------------------------------------------- |
| `packages/shared/`          | 앱 간 공유 (Button, Badge, Element 타입)    |
| `apps/builder/src/builder/` | Builder 전용 (PanelHeader, PropertySection) |

**결과:**

- ✅ 7,611줄 레거시 코드 삭제
- ✅ 혼란스러운 `src/shared/` 디렉토리 제거
- ✅ 모든 @composition/shared import 정상 동작 (74개 파일)
- ✅ TypeScript 에러 없음

---

### Fixed - WebGL Canvas Performance Optimization (2025-12-19)

#### Phase 20: INP Performance Fix for Panel Resize

**Problem:**

- WebGL 모드에서 패널 열고 닫을 때 INP가 1468ms로 극심한 프레임 드랍 발생
- iframe 모드는 100ms 초반대 유지하는 반면, WebGL은 400ms+ 초과
- 줌 비율이 패널 토글 시 재설정되는 문제

**Root Causes Identified:**

1. `SelectionLayer.tsx`의 `hasChildrenIdSet` useMemo가 O(n) 순회
2. `BoxSprite`, `TextSprite`, `ImageSprite`에 `memo` 누락
3. `Workspace.tsx`의 ResizeObserver가 매 프레임 상태 업데이트
4. `BuilderCanvas.tsx`의 `ClickableBackground`가 resize 이벤트마다 리렌더링

**Solutions Applied:**

1. **SelectionLayer.tsx - O(n) → O(selected) 최적화**
   - `elementsMap.forEach()` 대신 `childrenMap` 활용
   - 선택된 요소만 순회하여 성능 개선

   ```typescript
   // Before: O(n) - 모든 요소 순회
   elementsMap.forEach((element, id) => {
     if (selectedElementIds.includes(id) && element.children?.length > 0) {
       set.add(id);
     }
   });

   // After: O(selected) - 선택된 요소만 순회
   const childrenMap = getChildrenMap();
   for (const id of selectedElementIds) {
     const children = childrenMap.get(id);
     if (children && children.length > 0) {
       set.add(id);
     }
   }
   ```

2. **Sprite Components - memo 추가**
   - `BoxSprite.tsx`, `TextSprite.tsx`, `ImageSprite.tsx`에 `memo()` 래퍼 적용
   - 불필요한 리렌더링 방지

3. **Workspace.tsx - ResizeObserver 최적화**
   - RAF 스로틀링 + 값 비교 추가
   - 패널 애니메이션 중 매 프레임 상태 업데이트 방지

   ```typescript
   const throttledUpdate = () => {
     if (rafId !== null) return;
     rafId = requestAnimationFrame(() => {
       rafId = null;
       updateSize();
     });
   };
   ```

4. **BuilderCanvas.tsx - CSS-First Resize Strategy**
   - `resizeTo={containerEl}` 제거
   - `CanvasSmoothResizeBridge`: requestIdleCallback 기반 리사이즈
   - debounce/setTimeout 대신 브라우저 유휴 시간 활용

   ```typescript
   const requestIdle =
     window.requestIdleCallback || ((cb) => setTimeout(cb, 1));
   idleCallbackRef.current = requestIdle(() => {
     renderer.resize(width, height);
   });
   ```

5. **ClickableBackground - Resize Listener 제거**
   - `screenSize` state 제거 (리렌더링 원인)
   - `renderer.on("resize", update)` 리스너 제거
   - 고정 크기 사용: `-5000, -5000, 10000, 10000` (모든 뷰포트 커버)

   ```typescript
   // Before: resize마다 리렌더링
   const [screenSize, setScreenSize] = useState(...);
   renderer.on("resize", update); // setScreenSize 호출

   // After: 고정 크기, 리렌더링 없음
   const draw = useCallback((g) => {
     g.rect(-5000, -5000, 10000, 10000);
     g.fill({ color: 0xffffff, alpha: 0 });
   }, []); // 의존성 없음
   ```

6. **PixiButton.tsx - WebGL Destroy Error Fix**
   - 이미 파괴된 Graphics 객체 중복 destroy 방지
   ```typescript
   if (!buttonRef.current.destroyed) {
     buttonRef.current.destroy({ children: true });
   }
   ```

**Modified Files:**

1. `src/builder/workspace/canvas/selection/SelectionLayer.tsx`
   - hasChildrenIdSet: O(n) → O(selected) 최적화

2. `src/builder/workspace/canvas/sprites/BoxSprite.tsx`
   - memo() 래퍼 추가

3. `src/builder/workspace/canvas/sprites/TextSprite.tsx`
   - memo() 래퍼 추가

4. `src/builder/workspace/canvas/sprites/ImageSprite.tsx`
   - memo() 래퍼 추가

5. `src/builder/workspace/Workspace.tsx`
   - ResizeObserver에 RAF 스로틀링 + 값 비교 추가

6. `src/builder/workspace/canvas/BuilderCanvas.tsx`
   - CanvasSmoothResizeBridge: requestIdleCallback 기반 리사이즈
   - Application에서 resizeTo 제거
   - ClickableBackground: screenSize state 및 resize 리스너 제거

7. `src/builder/workspace/canvas/ui/PixiButton.tsx`
   - destroyed 체크 후 destroy 호출

**Results:**

- ✅ 패널 열고 닫을 때 프레임 드랍 대폭 감소
- ✅ 줌 비율 재설정 문제 해결
- ✅ requestIdleCallback 활용으로 시간 기반 debounce 제거
- ✅ WebGL destroy 에러 해결
- ✅ No TypeScript errors

**Research References:**

- Figma: CSS-First Resize Strategy (CSS 스트레치 → GPU 버퍼는 안정 시에만)
- PixiJS v8: requestIdleCallback 패턴
- WebGL Fundamentals: 리사이즈 최적화 가이드

---

### Added - WebGL Canvas Phase 19: hitArea Pattern (2025-12-18)

#### Phase 19: Click Selection Fix for WebGL Components

**Problem:**

- Form components (TextField, Input, RadioGroup, CheckboxGroup, Switch) couldn't be clicked/selected in WebGL canvas
- `pixiContainer` alone doesn't have hitArea, so events don't register
- Initial hitArea placement at beginning of render didn't work (z-order issue)

**Solution - hitArea Pattern:**

- Add transparent `pixiGraphics` with `alpha: 0` as hitArea
- **CRITICAL**: hitArea must be rendered LAST in container (PixiJS z-order: later children on top)
- Use `eventMode="static"` and `onPointerDown` for click detection

**Modified Files (8 components):**

1. `src/builder/workspace/canvas/ui/PixiInput.tsx`
   - Added drawHitArea with full input area coverage
   - Moved hitArea to render LAST in container

2. `src/builder/workspace/canvas/ui/PixiTextField.tsx`
   - Added drawHitArea covering label + input + description
   - Moved hitArea to render LAST

3. `src/builder/workspace/canvas/ui/PixiRadio.tsx`
   - Added groupDimensions calculation for hitArea sizing
   - Added drawHitArea covering entire RadioGroup
   - Fixed duplicate key error: `key={option.value}` → `key={`${option.value}-${index}`}`

4. `src/builder/workspace/canvas/ui/PixiCheckboxGroup.tsx`
   - Added groupDimensions calculation for hitArea sizing
   - Added drawHitArea covering entire CheckboxGroup
   - Fixed duplicate key error: `key={option.value}` → `key={`${option.value}-${index}`}`

5. `src/builder/workspace/canvas/ui/PixiSwitch.tsx`
   - Added missing position handling (posX, posY)
   - Added drawHitArea for switch + label area
   - Fixed `Text` → `pixiText` component name

6. `src/builder/workspace/canvas/ui/PixiBadge.tsx`
   - Added drawHitArea
   - Removed duplicate event handlers from individual elements

7. `src/builder/workspace/canvas/ui/PixiCard.tsx`
   - Added drawHitArea
   - Removed duplicate event handlers from individual elements

8. `src/builder/workspace/canvas/ui/PixiComboBox.tsx`
   - Added totalHeight calculation including dropdown
   - Added drawHitArea covering input + dropdown area

**hitArea Pattern Template:**

```tsx
// 🚀 Phase 19: 전체 크기 계산 (hitArea용)
const totalWidth = sizePreset.inputWidth;
const totalHeight = labelHeight + inputHeight;

// 🚀 Phase 19: 투명 히트 영역
const drawHitArea = useCallback(
  (g: PixiGraphics) => {
    g.clear();
    g.rect(0, 0, totalWidth, totalHeight);
    g.fill({ color: 0xffffff, alpha: 0 });
  },
  [totalWidth, totalHeight],
);

return (
  <pixiContainer x={posX} y={posY}>
    {/* Other content rendered first */}

    {/* 🚀 Phase 19: 투명 히트 영역 - 마지막에 렌더링하여 최상단 배치 */}
    <pixiGraphics
      draw={drawHitArea}
      eventMode="static"
      cursor="pointer"
      onPointerDown={handleClick}
    />
  </pixiContainer>
);
```

**Bug Fixes:**

- Fixed TextField/Input not clickable in WebGL canvas
- Fixed RadioGroup/CheckboxGroup whole group not selectable (only child options were)
- Fixed Switch not selectable
- Fixed Badge/Card/ComboBox click detection
- Fixed React duplicate key warning in RadioGroup/CheckboxGroup

**Results:**

- ✅ All 8 form components now clickable/selectable in WebGL canvas
- ✅ hitArea pattern documented for future component implementations
- ✅ No TypeScript errors
- ✅ No React key warnings

### Added - Events Panel Block-Based UI (2025-12-08)

#### Phase 5: Block-Based UI Implementation

**New Block Components:**

- `src/builder/panels/events/blocks/WhenBlock.tsx`
  - Event trigger block (onClick, onChange, etc.)
  - Visual indicator with "WHEN" label
  - EventTypePicker integration for changing trigger

- `src/builder/panels/events/blocks/IfBlock.tsx`
  - Conditional execution block
  - ConditionGroup editor integration
  - Optional block (can be removed)

- `src/builder/panels/events/blocks/ThenElseBlock.tsx`
  - Action execution blocks
  - Action list with add/edit/delete
  - Toggle enabled/disabled per action

- `src/builder/panels/events/editors/BlockActionEditor.tsx`
  - Unified action config editor
  - Supports all 21 action types
  - Type-safe config handling

**Modified Files:**

- `src/builder/panels/events/EventsPanel.tsx`
  - Refactored to use block-based components
  - WHEN → IF → THEN/ELSE visual pattern
  - Added `enabled` safeguard (defaults to `true`)
  - Debug logging for action updates

- `src/builder/events/actions/NavigateActionEditor.tsx`
  - Added `normalizePath()` function
  - Auto-adds "/" prefix to all paths
  - Consistent URL path format

- `src/builder/main/BuilderCore.tsx`
  - Fixed NAVIGATE_TO_PAGE message handler
  - Bidirectional path/slug normalization
  - Handles both "/page" and "page" formats

- `src/utils/events/eventEngine.ts`
  - Added warning for disabled actions
  - `getActionConfig<T>()` helper function
  - Dual-field support (config/value)

**Bug Fixes:**

- Fixed navigate action not executing due to `enabled: false`
- Fixed page navigation failing due to slug mismatch
- Fixed path comparison without "/" prefix normalization

**Results:**

- ✅ Block-based visual event editor
- ✅ Navigate action works correctly
- ✅ Path format standardized with "/" prefix
- ✅ All 21 action types supported

### Added - Panel System Refactoring (2025-11-16)

#### Phase 1: Stability Improvements

**Created Reusable Hooks:**

- `src/builder/hooks/useInitialMountDetection.ts` (106 lines)
  - Generic hook for distinguishing initial mount from data changes
  - Prevents database data overwriting on component mount
  - Uses JSON comparison and resetKey pattern for reliability
  - Supports custom dependencies and update callbacks

**Modified Files:**

- `src/builder/panels/data/DataPanel.tsx`
  - Replaced hardcoded empty state HTML with `EmptyState` component
  - Improved consistency across panels

- `src/builder/panels/ai/AIPanel.tsx`
  - Replaced module-level singleton with `useMemo` for Groq service initialization
  - Better lifecycle management and error handling
  - Prevents stale service instances across remounts

- `src/builder/panels/events/EventsPanel.tsx`
  - Applied `useInitialMountDetection` hook to handler and action synchronization
  - **Reduced code: 62 lines → 16 lines (76% reduction)**
  - Fixed EventType import path conflict (`@/types/events/events.types`)
  - Removed unnecessary type assertions (`as unknown as`)

**Results:**

- ✅ Zero TypeScript errors
- ✅ Zero Lint errors
- ✅ No `any` types
- ✅ 76% code reduction in EventsPanel synchronization logic

#### Phase 2: Performance Improvements

**Created Reusable Hooks:**

- `src/builder/hooks/useKeyboardShortcutsRegistry.ts` (147 lines)
  - Centralized keyboard shortcut registration system
  - Declarative shortcut definitions with modifier support
  - Automatic cleanup and conflict prevention
  - Blocks shortcuts when user is typing in input fields

**Modified Files:**

- `src/builder/panels/properties/PropertiesPanel.tsx`
  - Applied `useKeyboardShortcutsRegistry` for copy/paste shortcuts
  - **Reduced code: 30 lines → 15 lines (50% reduction)**
  - Cleaner, more maintainable keyboard handling

- `src/builder/panels/styles/StylesPanel.tsx`
  - Applied `useKeyboardShortcutsRegistry` for copy/paste shortcuts
  - **Reduced code: 38 lines → 24 lines (37% reduction)**
  - Consistent with PropertiesPanel pattern

**Results:**

- ✅ Eliminated duplicate keyboard event listener code
- ✅ Declarative shortcut definitions
- ✅ 37-50% code reduction in keyboard handling

**Attempted (Reverted):**

- `src/builder/panels/settings/SettingsPanel.tsx`
  - **Attempted:** Group 19 individual `useStore` selectors into 2-4 grouped selectors
  - **Result:** Caused infinite loop due to Zustand object reference instability
  - **Resolution:** Reverted to original code with individual selectors
  - **Lesson:** Zustand grouped selectors with object returns are unsafe

#### Phase 3: Reusability Improvements

**Created Reusable Hooks:**

- `src/builder/hooks/useCopyPaste.ts` (95 lines)
  - Generic clipboard-based copy/paste for JSON-serializable data
  - Built-in validation and transformation support
  - Consistent error handling across use cases
  - Supports custom data validation callbacks

**Modified Files:**

- `src/builder/panels/properties/PropertiesPanel.tsx`
  - Applied `useCopyPaste` hook for property copy/paste
  - **Reduced code: 15 lines → 3 lines (80% reduction)**
  - Eliminated duplicate clipboard logic

- `src/builder/panels/styles/hooks/useStyleActions.ts`
  - Applied `useCopyPaste` hook for style copy/paste
  - **Reduced code: 38 lines → 7 lines (82% reduction)**
  - Added automatic type conversion for styles (all values → strings)

**Results:**

- ✅ Generic clipboard utilities reusable across all panels
- ✅ 80%+ code reduction in copy/paste implementations
- ✅ Consistent clipboard error handling

### Overall Statistics

**Code Reduction:**

- EventsPanel: 76% reduction (62→16 lines)
- PropertiesPanel keyboard: 50% reduction (30→15 lines)
- StylesPanel keyboard: 37% reduction (38→24 lines)
- PropertiesPanel copy/paste: 80% reduction (15→3 lines)
- useStyleActions copy/paste: 82% reduction (38→7 lines)

**Reusable Hooks Created:**

1. `useInitialMountDetection` - 106 lines
2. `useKeyboardShortcutsRegistry` - 147 lines
3. `useCopyPaste` - 95 lines

**Total Code Quality:**

- ✅ Zero TypeScript errors
- ✅ Zero Lint errors
- ✅ Zero `any` types
- ✅ 100% tested and validated

### Anti-Patterns Discovered & Documented

**1. Zustand Grouped Selectors with Object Returns**

❌ **WRONG - Causes Infinite Loop:**

```typescript
const settings = useStore((state) => ({
  showOverlay: state.showOverlay,
  showGrid: state.showGrid,
  // ... more fields
}));
```

**Problem:** Every render creates a new object with a new reference, triggering infinite re-renders.

✅ **CORRECT - Individual Selectors:**

```typescript
const showOverlay = useStore((state) => state.showOverlay);
const showGrid = useStore((state) => state.showGrid);
// ... individual selectors
```

**2. useShallow Wrapper Pattern**

❌ **WRONG - Also Causes Infinite Loop:**

```typescript
import { useShallow } from "zustand/react/shallow";

const settings = useStore(
  useShallow((state) => ({
    showOverlay: state.showOverlay,
    // ...
  })),
);
```

**Problem:** `useShallow` wrapper recreates the selector function every render.

✅ **CORRECT - Individual Selectors (Same as #1):**

```typescript
const showOverlay = useStore((state) => state.showOverlay);
```

**3. Manual Keyboard Event Listeners**

❌ **WRONG - Duplicate Code:**

```typescript
useEffect(() => {
  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.metaKey && event.shiftKey && event.key === "c") {
      handleCopy();
    }
  };
  window.addEventListener("keydown", handleKeyDown);
  return () => window.removeEventListener("keydown", handleKeyDown);
}, [handleCopy]);
```

✅ **CORRECT - Use Hook:**

```typescript
const shortcuts = useMemo(
  () => [
    {
      key: "c",
      modifier: "cmdShift",
      handler: handleCopy,
      description: "Copy",
    },
  ],
  [handleCopy],
);

useKeyboardShortcutsRegistry(shortcuts, [handleCopy]);
```

**4. Duplicate Clipboard Code**

❌ **WRONG - Duplicate Logic:**

```typescript
const handleCopy = useCallback(async () => {
  try {
    const json = JSON.stringify(data, null, 2);
    await navigator.clipboard.writeText(json);
  } catch (error) {
    console.error("Failed to copy:", error);
  }
}, [data]);
```

✅ **CORRECT - Use Hook:**

```typescript
const { copy } = useCopyPaste({ onPaste: handlePaste, name: "properties" });

const handleCopy = useCallback(async () => {
  await copy(data);
}, [data, copy]);
```

**5. EventType Import Path Conflicts**

❌ **WRONG - Legacy Path with Extra Types:**

```typescript
import type { EventType } from "../../events/types/eventTypes";
// This path includes 'onInput' not in registry
```

✅ **CORRECT - Registry Path:**

```typescript
import type { EventType } from "@/types/events/events.types";
// Official registry path with validated types
```

### Breaking Changes

None. All changes are internal refactoring with backward compatibility maintained.

### Migration Guide

**For developers using panels:**

No migration needed. All public APIs remain unchanged.

**For developers adding new panels:**

Consider using the new reusable hooks:

1. **Initial Mount Detection:**

   ```typescript
   import { useInitialMountDetection } from "../../hooks/useInitialMountDetection";

   useInitialMountDetection({
     data: myData,
     onUpdate: (updatedData) => saveToDatabase(updatedData),
     resetKey: selectedElement?.id, // Reset on element change
   });
   ```

2. **Keyboard Shortcuts:**

   ```typescript
   import { useKeyboardShortcutsRegistry } from "../../hooks/useKeyboardShortcutsRegistry";

   const shortcuts = useMemo(
     () => [
       {
         key: "c",
         modifier: "cmdShift",
         handler: handleCopy,
         description: "Copy",
       },
       {
         key: "v",
         modifier: "cmdShift",
         handler: handlePaste,
         description: "Paste",
       },
     ],
     [handleCopy, handlePaste],
   );

   useKeyboardShortcutsRegistry(shortcuts, [handleCopy, handlePaste]);
   ```

3. **Copy/Paste:**

   ```typescript
   import { useCopyPaste } from "../../hooks/useCopyPaste";

   const { copy, paste } = useCopyPaste({
     onPaste: (data) => updateState(data),
     validate: (data) => typeof data === "object" && data !== null,
     name: "myFeature",
   });
   ```

### References

- [Pull Request #XXX](link-to-pr)
- [Issue #XXX - Panel Refactoring](link-to-issue)
- [Zustand Best Practices](https://docs.pmnd.rs/zustand/guides/performance)

---

## Archived entries (preserved Unreleased + 2025 mixed region, consolidated 2026-05-15)

> 본 블록은 `docs/CHANGELOG.md` 가 631KB / 8282 라인으로 `.claude/rules/changelog.md §4` 500KB threshold 초과 → 아카이빙 trigger 도달.
> `[Unreleased]` 마커 이후 mixed 영역 (2025 + 2026-02-15 이전 in-progress 분량) 을 본 파일 끝에 보존. append-only 정책 정합.


## [Unreleased]

### Added

- **계층적 선택 모델 (Pencil/Figma 스타일)**: 캔버스 클릭 시 현재 깊이 레벨 요소만 선택. 더블클릭으로 컨테이너 진입, Escape로 위로 복귀. `editingContextId` 상태 및 `resolveClickTarget` 유틸리티 구현 (`stores/selection.ts`, `utils/hierarchicalSelection.ts`)
- **Deep Hover 하이라이트 (Pencil 패턴)**: 그룹/컨테이너 호버 시 내부 모든 리프 노드를 동시 하이라이트. context 레벨 히트 테스트 → `collectLeafDescendants` 재귀 수집 → 전체 리프 렌더링. 리프 직접 호버는 실선 2px, 그룹 내부 리프는 점선 1px. 선택된 요소 위에서도 호버 표시. `hoverRenderer.ts` Skia 렌더러 (blue-500, alpha 0.5). 진입한 컨테이너 경계 점선 표시 (gray-400)
- **캔버스 커서 통일 (Pencil 방식)**: 모든 캔버스 요소의 마우스 커서를 `default`로 통일. TextSprite(`text`→`default`), BoxSprite/ImageSprite/ElementSprite(`pointer`→`default`), UI 컴포넌트 55개(`pointer`/`text`/`crosshair`/조건식→`default`). Hand Tool의 `grab`/`grabbing` 및 리사이즈 핸들 커서는 유지
- **Body 요소 선택**: 캔버스 빈 영역 클릭 또는 배경 클릭으로 body 선택 가능. `buildSelectionRenderData`에 pageFrames 기반 body bounds 폴백 추가. `isOnlyBodySelected` 오버레이 스킵 로직 제거

### Changed

- **레이어 트리 직접 선택**: 레이어 트리에서 깊은 요소 선택 시 `editingContext` 자동 조정 (`resolveEditingContextForTreeSelection`)
- **Escape 키 우선순위**: editingContext 복귀 → 선택 해제 순서로 변경
- **더블클릭 동작**: 컨테이너 요소는 `enterEditingContext`, 텍스트 요소는 기존 `startEdit` 유지
- **editingContext 복귀 (Pencil 방식)**: 빈 영역 클릭 시 `exitEditingContext` 호출. context 외부 요소 클릭 시에도 한 단계 위로 복귀. Escape 키 + 빈 영역 클릭 + 외부 요소 클릭 3가지 경로 지원
- **호버 렌더 순서 변경**: Hover → Selection Box → Transform Handles 순서로 변경. 코너 핸들의 흰색 fill이 호버 선을 덮어 핸들 내부에 선이 나타나는 문제 해결

### Fixed

- **Body 선택 불가**: `resolveClickTarget`이 body에 대해 null 반환하던 문제 (`parent_id: null`). `handleElementClick`에 body 특수 처리 추가
- **Body 오버레이 미표시**: `isOnlyBodySelected` 체크가 body 선택 시 오버레이 렌더링을 스킵하던 문제 해결
- **Body Skia 선택 박스**: body가 `treeBoundsMap`에 없어 선택 박스가 렌더링되지 않던 문제. `pageFrames` 기반 폴백 추가
- **멀티페이지 호버 불가**: 아무 요소도 선택되지 않은 상태에서 `treeBoundsMap`이 빈 Map으로 설정되어 호버 히트 테스트가 작동하지 않던 문제. `needsSelectionBoundsMap`을 항상 true로 변경하여 호버용 bounds를 상시 빌드 (`SkiaOverlay.tsx`)
- **더블클릭 그룹 진입 불가**: BoxSprite와 ElementSprite 컨테이너 히트 영역에 더블클릭 감지가 없어 `enterEditingContext`가 호출되지 않던 문제. `lastPointerDownRef` 기반 300ms 더블클릭 감지 추가 (`BoxSprite.tsx`, `ElementSprite.tsx`)

---

### Fixed - Button padding:0 시 높이 미변경 (2026-02-15)

#### 증상

- Button에 `paddingTop: 0`, `paddingBottom: 0`을 설정해도 높이가 변하지 않음

#### 원인

**1. Flex 경로 — Button 높이 미결정**

- Button은 Yoga 리프 노드(자식 없음)이고, `stripSelfRenderedProps`로 padding/border가 제거됨
- `height: 'auto'`만 설정되어 Yoga가 높이를 0으로 계산 → 이전 프레임의 시각적 크기(100px)가 자기 강화적으로 유지

**2. BlockEngine 경로 — `MIN_BUTTON_HEIGHT` 제약**

- `MIN_BUTTON_HEIGHT = 24`에서 `sizeConfig.paddingY`(기본값 4)로 content-box 변환
- 인라인 padding=0이 반영되지 않아 항상 최소 높이 강제

**3. `toNum` 함수 — 문자열 '0' 무시**

- `parseFloat('0') || undefined` → `0 || undefined` → `undefined`

#### 수정 내용

**1. `styleToLayout`에서 Button `layout.height` 명시적 설정**

- `height: 'auto'` 대신 `paddingY * 2 + lineHeight + borderW * 2`로 계산
- 인라인 padding=0이면 `0 + lineHeight + 2` = 텍스트 높이 + 테두리만큼 축소
- `toNum` 함수를 `isNaN(parseFloat(v))` 체크로 수정하여 문자열 '0' 정상 처리

**2. BlockEngine `calculateContentHeight`에서 인라인 padding 시 `MIN_BUTTON_HEIGHT` 미적용**

- 사용자가 인라인 padding을 설정한 경우 `minContentHeight = 0` (padding:0으로 완전 축소 허용)
- 인라인 padding 미설정 시 기존 동작 유지 (`MIN_BUTTON_HEIGHT` 기반 최소 높이)

#### 수정 파일

| 파일                                       | 변경 내용                                                  |
| ------------------------------------------ | ---------------------------------------------------------- |
| `apps/builder/.../layout/styleToLayout.ts` | Button `layout.height` 명시적 계산 + `toNum` 0값 버그 수정 |
| `apps/builder/.../layout/engines/utils.ts` | 인라인 padding 시 `MIN_BUTTON_HEIGHT` 미적용               |

---

### Fixed - Spec 컴포넌트 텍스트 줄바꿈 시 Skia 높이 자동 확장 (2026-02-15)

#### 증상

- Button에 고정 `width` 설정 후 긴 텍스트 입력 시, CSS에서는 height가 동적으로 증가하지만 Skia 캔버스에서는 높이가 변하지 않음
- 텍스트가 잘리거나 배경 밖으로 넘침

#### 원인

- Button은 `SELF_PADDING_TAGS`로 padding이 Yoga에서 제거되고, Yoga에 텍스트 measure 함수가 없어 auto height를 계산할 수 없음
- `specShapesToSkia`는 Yoga가 결정한 고정 높이를 받아 배경과 텍스트를 그리므로, 텍스트가 줄바꿈되어도 높이가 확장되지 않음

#### 수정 내용

**1. `measureSpecTextMinHeight()` 헬퍼 추가 (ElementSprite.tsx)**

- spec shapes 내 텍스트의 word-wrap 높이를 Canvas 2D API로 측정
- TokenRef fontSize 해석, maxWidth 계산 (specShapesToSkia와 동일 로직)
- 한 줄이면 `undefined` 반환, 다중 줄이면 `paddingY * 2 + wrappedHeight` 반환

**2. contentMinHeight 계산 (ElementSprite.tsx)**

- `specShapesToSkia` 호출 전에 `measureSpecTextMinHeight`로 다중 줄 높이 측정
- 명시적 height가 없을 때만 (`hasExplicitHeight` 체크)
- `specHeight`와 `cardCalculatedHeight` 갱신 → `contentMinHeight`로 전파

**3. 다중 줄 텍스트 paddingTop 보정 (ElementSprite.tsx)**

- `specShapesToSkia`는 한 줄 lineHeight 기준으로 수직 중앙 계산
- 다중 줄일 때 `(specHeight - wrappedHeight) / 2`로 보정

**4. `updateTextChildren` box 재귀 (SkiaOverlay.tsx)**

- box 타입 자식 노드도 재귀적으로 width/height 갱신 + 내부 text 처리
- `contentMinHeight`로 높이 증가 시 specNode 내부 텍스트도 올바른 크기로 갱신

#### 수정 파일

| 파일                                         | 변경 내용                                                              |
| -------------------------------------------- | ---------------------------------------------------------------------- |
| `apps/builder/.../sprites/ElementSprite.tsx` | `measureSpecTextMinHeight()` + contentMinHeight 계산 + paddingTop 보정 |
| `apps/builder/.../skia/SkiaOverlay.tsx`      | `updateTextChildren`에 box 자식 재귀 추가                              |

#### 영향 범위

- Button, SubmitButton, FancyButton, ToggleButton (SELF_PADDING_TAGS)
- Badge, Tag, Chip 등 spec shapes 기반 모든 컴포넌트

---

### Fixed - BlockEngine 경로에서 Button 텍스트 줄바꿈 시 세로 겹침 (2026-02-15)

#### 증상

- 부모가 implicit block(display 미지정)일 때, Button(width:80px) 텍스트 2줄 + 다음 Button(width:100%)이 세로로 겹침
- 첫 번째 Button의 Skia 렌더링은 정상(높이 확장)이나 Yoga 레이아웃 영역이 확장되지 않아 아래 요소가 겹침
- 부모가 `display:flex, flex-direction:column`일 때는 정상 (Flex 경로 사용)

#### 원인

- **BlockEngine 경로의 `parseBoxModel`이 부모 `availableWidth`를 전달**: Button(width:80px)인데 `calculateContentHeight(element, 400)`처럼 부모 너비(400px)를 전달하여, 텍스트 줄바꿈이 발생하지 않는 것으로 계산 → 높이 미확장
- **`styleToLayout`의 `minHeight`는 BlockEngine 경로에서 미사용**: BlockEngine은 `parseBoxModel` → `calculateContentHeight`로 높이를 직접 계산하며, `styleToLayout`의 결과는 width/height에 사용하지 않음

#### 수정 내용

**1. `parseBoxModel`에서 요소 자체 width 전달 (engines/utils.ts)**

- border-box 변환 전 `originalBorderBoxWidth`를 저장
- `calculateContentHeight(element, elementAvailableWidth)`에 요소 자체 width 우선 전달
- Button(width:80px) → `calculateContentHeight(element, 80)` → `maxTextWidth = 80 - 24 = 56` → 올바른 줄바꿈

**2. `styleToLayout` minHeight 기본 사이즈 수정**

- Button 기본 사이즈를 `'md'` → `'sm'`으로 수정 (실제 기본값과 일치)
- ToggleButton은 기존 `'md'` 유지

#### 수정 파일

| 파일                                       | 변경 내용                                                                      |
| ------------------------------------------ | ------------------------------------------------------------------------------ |
| `apps/builder/.../layout/engines/utils.ts` | `parseBoxModel`에서 `originalBorderBoxWidth` → `calculateContentHeight`에 전달 |
| `apps/builder/.../layout/styleToLayout.ts` | minHeight 기본 사이즈 `'md'` → `'sm'` 수정                                     |

#### 두 렌더링 경로 차이

| 경로                 | 부모 조건                       | 높이 결정 방식                             | 텍스트 줄바꿈 반영                         |
| -------------------- | ------------------------------- | ------------------------------------------ | ------------------------------------------ |
| **Flex 경로**        | `display:flex` 명시적           | `styleToLayout` → `minHeight` → Yoga       | `styleToLayout`에서 계산                   |
| **BlockEngine 경로** | display 미지정 (implicit block) | `parseBoxModel` → `calculateContentHeight` | `parseBoxModel`에서 요소 자체 width로 계산 |

---

### Fixed - Button/UI 컴포넌트 width 설정 시 배경 렌더링 실패 (2026-02-14)

#### 증상

- Button에 `width: 200px` 또는 `width: 50%` 설정 시 Skia 배경(background, border, borderRadius)이 렌더링되지 않음
- Selection 영역은 정상이나 시각적 배경이 사라짐
- 동일 문제가 Section, ToggleButton, Card, Form, List, FancyButton, ScrollBox, MaskedFrame에도 존재

#### 원인

**1. Spec shapes의 배경 roundRect `width`에 `props.style?.width` 사용**

- 9개 spec 파일에서 배경 roundRect의 width를 `(props.style?.width as number) || 'auto'`로 설정
- 사용자가 `width: 200px`를 설정하면 `shape.width = 200` (숫자)이 됨
- `specShapesToSkia`의 bgBox 추출 조건은 `shape.width === 'auto' && shape.height === 'auto'`
- 숫자 width → bgBox 미추출 → 배경이 children으로 들어감 → 투명 outer box만 표시

**2. effectiveElement에서 퍼센트 값 이중 적용 (ElementSprite.tsx)**

- `computedContainerSize`는 Yoga가 이미 `%`를 resolve한 pixel 값
- 기존 코드: `(parseFloat('50%') / 100) * computedContainerSize.width` → 50% × 200px = 100px (이중 적용)
- 수정: `computedContainerSize.width` 직접 사용

**3. `@composition/specs` dist 미빌드**

- 소스 파일 수정 후 `pnpm build` 미실행 → Builder가 구 dist/ 참조

#### 수정 파일

| 파일                                                 | 변경 내용                                               |
| ---------------------------------------------------- | ------------------------------------------------------- |
| `packages/specs/src/components/Button.spec.ts`       | 배경 roundRect `width: 'auto' as const`                 |
| `packages/specs/src/components/Section.spec.ts`      | 동일 패턴 수정                                          |
| `packages/specs/src/components/ToggleButton.spec.ts` | 동일 패턴 수정                                          |
| `packages/specs/src/components/Card.spec.ts`         | 동일 패턴 수정                                          |
| `packages/specs/src/components/Form.spec.ts`         | 동일 패턴 수정                                          |
| `packages/specs/src/components/List.spec.ts`         | 동일 패턴 수정                                          |
| `packages/specs/src/components/FancyButton.spec.ts`  | 동일 패턴 수정                                          |
| `packages/specs/src/components/ScrollBox.spec.ts`    | 동일 패턴 수정                                          |
| `packages/specs/src/components/MaskedFrame.spec.ts`  | 동일 패턴 수정                                          |
| `apps/builder/.../sprites/ElementSprite.tsx`         | 퍼센트 값 이중 적용 수정                                |
| `apps/builder/.../ui/PixiButton.tsx`                 | `isWidthAuto`/`isHeightAuto` minRequiredWidth 비교 제거 |

---

### Feature - TagGroup 컨테이너 구조 전환 (2026-02-13)

#### 개요

TagGroup과 TagList를 CONTAINER_TAGS로 전환하여 웹 CSS와 동일한 3-level 계층 구조를 구현. ComponentDefinition 타입을 재귀적 ChildDefinition으로 확장하고, Factory에서 재귀 생성을 지원. 텍스트 태그의 높이 자동 계산 및 TextSprite 클릭 선택 관련 수정 포함.

#### 변경 내용

**1. TagGroup/TagList → CONTAINER_TAGS 전환**

- TagGroup과 TagList를 CONTAINER_TAGS로 등록하여 웹 CSS와 동일한 3-level 계층 구조 구현
- 구조: `TagGroup → Label + TagList → Tag[]`
- 기존 flat 렌더링에서 실제 DOM 구조와 일치하는 중첩 컨테이너 방식으로 전환

**2. ComponentDefinition 재귀적 ChildDefinition 타입 확장**

- 기존 2-level 구조(parent + flat children)에서 무한 중첩 children 지원으로 확장
- `ChildDefinition` 타입에 재귀적 `children` 필드 추가
- 복합 컴포넌트의 깊은 계층 구조를 선언적으로 정의 가능

**3. Factory 재귀 생성 (`createElementsFromDefinition`)**

- `processChildren()` 재귀 함수 도입으로 중첩 자식 요소 일괄 생성
- ChildDefinition의 재귀적 children 구조를 순회하며 각 레벨의 요소를 생성
- 기존 단일 레벨 자식 생성 로직을 재귀 패턴으로 일반화

**4. styleToLayout 텍스트 높이 자동 계산**

- `TEXT_LAYOUT_TAGS` (label, text, heading, paragraph)에 대해 size prop 기반 높이 자동 설정
- typography 토큰 매핑: `xs:12, sm:14, md:16, lg:18, xl:20`
- lineHeight 계산: fontSize × 1.4 패턴으로 height 자동 설정
- Button sizes 패턴과 동일한 `size prop → 토큰 → lineHeight` 변환 경로

**5. TextSprite 투명 히트 영역**

- backgroundColor가 없는 텍스트 요소에도 `alpha: 0.001` 사각형 추가
- 투명 배경 텍스트도 클릭으로 선택 가능하도록 수정

**6. ElementSprite useSkiaNode text spriteType 추가**

- `hasOwnSprite` 조건에 text spriteType 추가
- TextSprite가 자체적으로 Skia 데이터를 등록하므로 ElementSprite에서 이중 등록 방지

**7. isYogaSizedContainer 확장**

- TagGroup/TagList를 ToggleButtonGroup과 동일한 Yoga 크기 결정 패턴에 추가
- Yoga 레이아웃 엔진이 컨테이너 크기를 자식 기반으로 자동 계산

---

### Bugfix - ToggleButtonGroup alignSelf 강제 설정으로 부모 align-items 무시 (2026-02-13)

#### 이슈

ToggleButtonGroup을 `display: flex; justify-content: center; align-items: center` 부모 안에 배치해도 수직 가운데 정렬이 되지 않음. `align-items: flex-start` 상태처럼 상단에 고정됨.

#### 근본 원인

`styleToLayout.ts`에서 ToggleButtonGroup의 `width: fit-content` Yoga 워크어라운드 처리 시 `alignSelf: 'flex-start'`를 강제 설정하고 있었음. CSS에서 `width: fit-content`와 `align-self`는 독립적 속성이지만, 코드에서는 fit-content 처리를 위해 `alignSelf`를 같이 설정하여 부모의 `align-items` 값이 무시됨.

```typescript
// ❌ 변경 전: alignSelf 강제 설정 → 부모 align-items 무시
if (width === undefined && !isFitContentWidth) {
  layout.flexGrow = 0;
  layout.flexShrink = 0;
  if (layout.alignSelf === undefined) layout.alignSelf = "flex-start"; // ← 문제
}
if (isFitContentWidth) {
  if (layout.alignSelf === undefined) layout.alignSelf = "flex-start"; // ← 문제
}

// ✅ 변경 후: alignSelf 제거 → 부모 align-items 정상 적용
if (width === undefined && !isFitContentWidth) {
  layout.flexGrow = 0;
  layout.flexShrink = 0;
  // alignSelf 미설정 → 부모의 align-items가 교차축 정렬 결정
}
```

#### 동일 패턴 조사

| 위치                                                   | alignSelf: flex-start 사용                | 수정 필요                      |
| ------------------------------------------------------ | ----------------------------------------- | ------------------------------ |
| `styleToLayout.ts` ToggleButtonGroup                   | 사용자 CSS 스타일 변환에서 강제 설정      | **수정 완료**                  |
| `Pixi*.tsx` (10개: Popover, Disclosure, Menu, Tabs 등) | 내부 Pixi 렌더링 컴포넌트 자체 레이아웃용 | 사용자 CSS와 무관, 수정 불필요 |
| `styleToLayout.ts` Checkbox/Radio/Switch               | alignSelf 미사용                          | 해당 없음                      |
| `styleToLayout.ts` Badge/Tag/Chip                      | alignSelf 미사용                          | 해당 없음                      |

#### 수정 파일

| 파일                      | 변경                                                                              |
| ------------------------- | --------------------------------------------------------------------------------- |
| `layout/styleToLayout.ts` | ToggleButtonGroup fit-content 워크어라운드에서 `alignSelf: 'flex-start'` 2줄 제거 |

---

### Bugfix - ToggleButton spec border-radius 그룹 위치 기반 처리 (2026-02-13)

#### 이슈

ToggleButtonGroup 내부 ToggleButton의 border-radius가 CSS에서는 그룹 내 위치(first/middle/last)에 따라 모서리별로 다르게 적용되지만, Spec 기반 Skia 렌더링에서는 동일한 단일 borderRadius 값으로 렌더링됨.

**CSS 규칙** (ToggleButtonGroup.css):

- horizontal first: `border-top-right-radius: 0; border-bottom-right-radius: 0`
- horizontal last: `border-top-left-radius: 0; border-bottom-left-radius: 0`
- horizontal middle: 모든 모서리 `0`
- vertical first: `border-bottom-left-radius: 0; border-bottom-right-radius: 0`
- vertical last: `border-top-left-radius: 0; border-top-right-radius: 0`
- vertical middle: 모든 모서리 `0`

#### 수정 내용

**1. `ToggleButton.spec.ts` — `_groupPosition` props + border-radius 분기**

- `ToggleButtonProps` 인터페이스에 `_groupPosition` 추가 (orientation, isFirst, isLast, isOnly)
- `shapes()` 함수에서 그룹 위치에 따른 per-corner border-radius 계산:
  - `[tl, tr, br, bl]` 4-tuple 반환 (`specShapeConverter.ts`의 `resolveRadius()` 가 지원)

```typescript
// horizontal: first → [r,0,0,r], last → [0,r,r,0], middle → [0,0,0,0]
// vertical: first → [r,r,0,0], last → [0,0,r,r], middle → [0,0,0,0]
```

**2. `ElementSprite.tsx` — `_groupPosition` 주입**

- `toggleGroupPosition` 객체를 `_groupPosition` key로 spec shapes props에 주입
- 기존 `PixiToggleButton.tsx`의 border-radius 처리와 동일한 결과

#### 수정 파일

| 파일                                                                  | 변경                                                |
| --------------------------------------------------------------------- | --------------------------------------------------- |
| `packages/specs/src/components/ToggleButton.spec.ts`                  | `_groupPosition` props, shapes() border-radius 분기 |
| `apps/builder/src/builder/workspace/canvas/sprites/ElementSprite.tsx` | `toggleGroupPosition` → `_groupPosition` 주입       |

---

### Bugfix - Factory 정의 style 기본값 누락 (2026-02-13)

#### 근본 원인

복합 컴포넌트(children 포함)는 `ComponentFactory` → `GroupComponents.ts`의 factory 정의로 생성됨.
단순 컴포넌트는 `useElementCreator` → `getDefaultProps(tag)` (unified.types.ts)로 생성됨.
**factory 정의의 `props`에 `style` 필드가 누락**되어 생성 시점에 CSS 기본값(display, flexDirection 등)이 적용되지 않음. 리셋 버튼은 `getDefaultProps()`를 사용하므로 리셋 후에만 기본값이 복원됨.

#### 수정 내용

**1. `GroupComponents.ts` — factory 정의에 style 추가**

| 컴포넌트                      | 추가된 style                                                                            |
| ----------------------------- | --------------------------------------------------------------------------------------- |
| ToggleButtonGroup (parent)    | `{ display: 'flex', flexDirection: 'row', alignItems: 'center', width: 'fit-content' }` |
| Checkbox (CheckboxGroup 자식) | `{ display: 'flex', flexDirection: 'row', alignItems: 'center' }`                       |
| Radio (RadioGroup 자식)       | `{ display: 'flex', flexDirection: 'row', alignItems: 'center' }`                       |

**2. `unified.types.ts` — getDefaultProps 기본값 동기화**

| 함수                                  | 추가된 속성                                    |
| ------------------------------------- | ---------------------------------------------- |
| `createDefaultToggleButtonGroupProps` | `alignItems: 'center'`, `width: 'fit-content'` |

#### 전수 조사 결과

| 경로                        | style 있음 (unified.types)  | factory 정의                   | 상태          |
| --------------------------- | --------------------------- | ------------------------------ | ------------- |
| Button                      | `{ borderWidth: '1px' }`    | 단순 컴포넌트 (factory 미사용) | 문제 없음     |
| Switch                      | `{ display: 'flex', ... }`  | 단순 컴포넌트 (factory 미사용) | 문제 없음     |
| Card                        | `{ display: 'block', ... }` | 단순 컴포넌트 (factory 미사용) | 문제 없음     |
| ToggleButtonGroup           | `{ display: 'flex', ... }`  | factory 사용                   | **수정 완료** |
| Checkbox (in CheckboxGroup) | `{ display: 'flex', ... }`  | factory 자식                   | **수정 완료** |
| Radio (in RadioGroup)       | `{ display: 'flex', ... }`  | factory 자식                   | **수정 완료** |

#### 수정 파일

| 파일                                       | 변경                                                           |
| ------------------------------------------ | -------------------------------------------------------------- |
| `factories/definitions/GroupComponents.ts` | ToggleButtonGroup, Checkbox×2, Radio×2에 style 추가            |
| `types/builder/unified.types.ts`           | `createDefaultToggleButtonGroupProps`에 alignItems, width 추가 |

---

### Bugfix - ToggleButtonGroup 스타일 패널 display 기본값 + Selection 영역 (2026-02-13)

#### 이슈 1: 스타일 패널 display 기본값 오류

**문제**: ToggleButtonGroup 선택 시 스타일 패널에서 `display: block`으로 표시됨 (실제는 `display: flex`).
`styleAtoms.ts`의 displayAtom이 `element.style.display ?? element.computedStyle.display ?? 'block'` 폴백을 사용하여, 인라인 스타일/computedStyle에 display가 없는 컴포넌트는 항상 'block' 표시.

**수정**: `getLayoutDefault()` 4단계 우선순위 헬퍼 도입:

1. inline style → 2. computed style → 3. `DEFAULT_CSS_VALUES[tag]` → 4. global default

```typescript
// styleAtoms.ts
const DEFAULT_CSS_VALUES = {
  ToggleButtonGroup: {
    width: "fit-content",
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
  },
  // ...
};

function getLayoutDefault(element, prop, globalDefault): string {
  // inline → computed → tag default → global default
}
```

**영향 atoms**: `displayAtom`, `flexDirectionAtom`, `layoutValuesAtom`, `flexDirectionKeysAtom`, `flexAlignmentKeysAtom`

#### 이슈 2: Selection 영역이 실제 크기보다 작음

**문제**: ToggleButtonGroup(CONTAINER_TAGS + inline-block)의 selection bounds가 80px(DEFAULT_WIDTH 폴백)로 계산됨.
원인: BlockEngine → `calculateContentWidth()` → ToggleButtonGroup에 텍스트/명시적 width 없음 → DEFAULT_WIDTH=80px 폴백.

**수정 1 — `engines/utils.ts` calculateContentWidth()**:
ToggleButtonGroup 전용 분기 추가. `props.items`에서 자식 버튼 텍스트 폭 합산.

**수정 2 — `BuilderCanvas.tsx` containerLayout**:
ToggleButtonGroup의 containerLayout width를 `'auto'`로 오버라이드. Yoga가 자식 크기 기반 자동 계산.

```typescript
const toggleGroupWidthOverride = isToggleButtonGroup
  ? { width: "auto", flexGrow: 0, flexShrink: 0 }
  : { width: layout.width };
```

#### 동일 패턴 분석

| 조건                                       | 결과                                                     |
| ------------------------------------------ | -------------------------------------------------------- |
| CONTAINER_TAGS ∩ DEFAULT_INLINE_BLOCK_TAGS | **ToggleButtonGroup만** 해당                             |
| 다른 CONTAINER_TAGS (Card, Panel 등)       | block → width = availableWidth → 문제 없음               |
| 다른 inline-block (Toolbar 등)             | CONTAINER_TAGS 아님 → containerLayout 미사용 → 영향 없음 |

#### 수정 파일

| 파일                                 | 변경                                                              |
| ------------------------------------ | ----------------------------------------------------------------- |
| `panels/styles/atoms/styleAtoms.ts`  | `getLayoutDefault()` 헬퍼, DEFAULT_CSS_VALUES 확장, 5개 atom 수정 |
| `layout/engines/utils.ts`            | `calculateContentWidth()`에 ToggleButtonGroup 분기 추가           |
| `workspace/canvas/BuilderCanvas.tsx` | containerLayout width override for ToggleButtonGroup              |

---

### Feature - `width: fit-content` 네이티브 구현 (2026-02-13)

#### 개요

CSS intrinsic sizing `width: fit-content`를 BlockEngine + WASM 하이브리드 레이아웃 엔진에 네이티브 구현. 기존 Yoga 워크어라운드(flexGrow:0 + flexShrink:0)를 보완하여 Block 레이아웃 경로에서도 fit-content가 정확히 동작.

#### 구현 방식

`FIT_CONTENT = -2` sentinel 값을 도입하여 기존 `AUTO = -1` 패턴과 동일한 방식으로 JS ↔ WASM 직렬화. FIELD_COUNT(19) 변경 없이 width 필드에 sentinel을 전달.

```
width 값 해석:
  -1 (AUTO)         → Block: 부모 너비 채움 / Inline-block: contentWidth
  -2 (FIT_CONTENT)  → Block: contentWidth 사용 (inline-block과 동일)
  0 이상             → 명시적 px 값
```

#### 변경 내용

**1. utils.ts — FIT_CONTENT 상수 + parseSize/parseBoxModel**

- `FIT_CONTENT = -2` 상수 export
- `parseSize()`: `'fit-content'` 문자열 감지 → `FIT_CONTENT` 반환
- `parseBoxModel()`: `FIT_CONTENT` 값은 border-box 변환 건너뜀

**2. layoutAccelerator.ts — WASM 바인딩 상수**

- `FIT_CONTENT = -2` export 추가

**3. BlockEngine.ts — JS/WASM 양쪽 경로**

- JS 경로: `boxModel.width === FIT_CONTENT`일 때 `contentWidth` 사용
- WASM 경로: `FIT_CONTENT` sentinel을 WASM에 전달

**4. block_layout.rs — Rust WASM**

- `FIT_CONTENT` 상수 추가, block/inline-block 양쪽 width 로직 수정
- 6개 Rust 테스트 추가

**5. styleToLayout.ts — Flex/Yoga 경로 일반화**

- 모든 요소에 대해 fit-content Yoga 워크어라운드 적용 (`flexGrow:0, flexShrink:0`)
- ToggleButtonGroup CSS 기본값(`width: fit-content`) 유지

**6. TransformSection.tsx — StylesPanel UI**

- Width/Height units에 `fit-content` 옵션 추가 (`reset` 아래)

#### 수정 파일

| 파일                                          | 변경                                                 |
| --------------------------------------------- | ---------------------------------------------------- |
| `layout/engines/utils.ts`                     | `FIT_CONTENT` 상수, `parseSize`/`parseBoxModel` 수정 |
| `wasm-bindings/layoutAccelerator.ts`          | `FIT_CONTENT` 상수 export                            |
| `layout/engines/BlockEngine.ts`               | JS/WASM 경로 fit-content 처리                        |
| `wasm/src/block_layout.rs`                    | Rust fit-content 로직 + 6 테스트                     |
| `layout/styleToLayout.ts`                     | Yoga 워크어라운드 일반화                             |
| `panels/styles/sections/TransformSection.tsx` | Width/Height units에 fit-content 추가                |

---

### Feature - Spec Shapes 기반 Skia UI 컴포넌트 렌더링 (2026-02-12)

#### 개요

62개 UI 컴포넌트가 "배경색+텍스트" fallback 대신 ComponentSpec의 `shapes()` 함수가 반환하는 도형 배열을 기반으로 정확한 시각적 렌더링. Checkbox의 인디케이터 박스+체크마크+라벨, ToggleButton의 트랙+썸 등 세부 도형까지 Skia 캔버스에 표시.

#### 근본 원인

`ElementSprite.tsx`의 skiaNodeData useMemo에서 Card를 제외한 모든 UI 컴포넌트가 else 분기의 텍스트-전용 fallback으로 처리됨.

#### 변경 내용

**Phase 1: nodeRenderers.ts에 line 타입 추가**

- `SkiaNodeData`에 `line` 타입 추가, `renderLine()` 함수 구현

**Phase 2: specShapeConverter.ts 생성**

- `Shape[]` → `SkiaNodeData` 변환기 신규 작성
- 각 Shape 타입(rect, circle, line, text 등)별 Skia 렌더 데이터 매핑

**Phase 3: ElementSprite.tsx에 spec shapes 렌더링 통합**

- `getSpecForTag()` 헬퍼로 태그별 ComponentSpec 조회
- spec shapes가 있는 컴포넌트는 `specShapeConverter`를 통해 렌더링
- column 방향 flexDirection 재배치 지원

**패치 1-6: 호환성 및 레이아웃 수정**

- `aiEffects.ts`: borderRadius 튜플 타입 호환
- bgBox 추출 조건 수정 (auto-sized only)
- TokenRef 해석 (`resolveNum`)
- Checkbox/Radio/Switch 기본 props + `styleToLayout` flex 기본값
- `BlockEngine`: `calculateContentHeight`/`Width` 추가
- flexDirection column 레이아웃 지원

#### 수정 파일

| 파일                             | 변경                                                       |
| -------------------------------- | ---------------------------------------------------------- |
| `skia/nodeRenderers.ts`          | `SkiaNodeData`에 line 타입 추가, `renderLine()`            |
| `skia/specShapeConverter.ts`     | 신규 - `Shape[]` → `SkiaNodeData` 변환기                   |
| `skia/aiEffects.ts`              | borderRadius 튜플 타입 호환                                |
| `sprites/ElementSprite.tsx`      | `getSpecForTag()`, spec 렌더링, column 재배치              |
| `layout/styleToLayout.ts`        | Checkbox/Radio/Switch flex 기본값 + flexDirection 크기     |
| `layout/engines/utils.ts`        | `calculateContentHeight`/`Width` 폼 컨트롤 + flexDirection |
| `types/builder/unified.types.ts` | `createDefaultCheckboxProps`/`Radio`/`Switch` 기본값       |

---

### Performance - Fill 컬러피커 드래그 성능 최적화 (2026-02-12)

#### 개요

ColorArea/ColorSlider 드래그 시 FPS가 ~50에서 ~20으로 하락하던 문제를 3계층 최적화로 해결. react-aria의 `onChange`가 매 pointer move(60-120+/sec)마다 호출되며, RAF 스로틀 없이 매번 전체 elementsMap 복사 + CSS 변환 + Zustand set()이 수행되던 것이 근본 원인.

#### 근본 원인 (Hot Path)

```
onChange → setLocalColor + onChange(hex)              ← 매 pointer move (100+/sec)
  → updateFillPreview(id, {color})
    → fills.map(...)                                  ← 배열 재생성
    → store.updateSelectedFillsPreview()
      → structuredClone(element)                      ← deep clone
      → fillsToCssBackground(fills)                   ← CSS 변환 (Skia 불필요)
      → new Map(elementsMap)                          ← O(n) Map 복사
      → [...elements]                                 ← O(n) 배열 복사
      → set()                                         ← Zustand → 리렌더 연쇄
```

#### 변경 내용

**P0: Critical — RAF 스로틀 + 경량 프리뷰 (CSS 변환 제거)**

- `inspectorActions.ts`: `updateSelectedFillsPreviewLightweight(fills)` 추가
  - `fillsToCssBackground()` 호출 제거 (Skia는 `element.fills`를 직접 읽음)
  - `elements` 배열 복사/갱신 스킵 (elementsMap만 업데이트)
  - `prePreviewElement` 패턴 유지 (히스토리 정확성)
- `useFillActions.ts`: `updateFillPreviewThrottled(fillId, updates)` 추가
  - GradientBar RAF 패턴 차용: `pendingUpdateRef`로 최신 값만 유지
  - 내부에서 `updateSelectedFillsPreviewLightweight()` 호출
- `FillSection.tsx`: 모든 드래그 프리뷰 경로를 `updateFillPreviewThrottled`로 전환

**P0-2: ColorPickerPanel RAF 스로틀**

- `ColorPickerPanel.tsx`: `handleChange`에 RAF 스로틀 적용
  - `setLocalColor` + `onChange`를 프레임당 1회로 제한 (60fps cap)
  - `handleChangeEnd`에서 보류 중 RAF 취소 + 최종 값 flush

**P1: ColorInputFields 실시간 반영**

- `ColorInputFields.tsx`: `TextField` 컴포넌트에 `isFocused` 상태 추가
  - 포커스가 아닐 때 외부 `value` prop 변경 추적 (ColorArea 드래그 등)
  - HEX/CSS 모드가 드래그 중 업데이트되지 않던 문제 해결

**P2: CSS 성능 힌트**

- `ColorArea.css`: `contain: layout style` + `touch-action: none` + `will-change: transform`
- `ColorSlider.css`: `contain: layout style` + `touch-action: none` + `will-change: transform`

#### 수정 파일

| 파일                                                    | 변경                                                                         |
| ------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `stores/inspectorActions.ts`                            | `updateSelectedFillsPreviewLightweight` 추가 (CSS 변환 + elements 배열 스킵) |
| `panels/styles/hooks/useFillActions.ts`                 | `updateFillPreviewThrottled` (RAF + lightweight store) 추가                  |
| `panels/styles/sections/FillSection.tsx`                | 드래그 경로에서 throttled 프리뷰 사용                                        |
| `panels/styles/components/ColorPickerPanel.tsx`         | handleChange RAF 스로틀, handleChangeEnd flush                               |
| `panels/styles/components/ColorInputFields.tsx`         | TextField isFocused 추적으로 외부 value 동기화                               |
| `packages/shared/src/components/styles/ColorArea.css`   | contain, touch-action, will-change 힌트                                      |
| `packages/shared/src/components/styles/ColorSlider.css` | contain, touch-action, will-change 힌트                                      |

#### 하위 호환성

- 기존 `updateFillPreview` (non-throttled) 및 `updateSelectedFillsPreview` (CSS 포함) 유지
- `onChangeEnd` 경로 변경 없음 (`updateFill` → `updateSelectedFills` → full commit)

---

### Fixed - SVG Mesh Gradient 크기 불일치 수정 (2026-02-12)

#### 개요

Mesh Gradient가 SVG로 렌더링될 때 요소 크기에 맞지 않고 원본 100×100 크기로 고정되던 문제를 수정.

#### 근본 원인

SVG의 `width`/`height`가 `100%`로 설정되었으나 `viewBox`와 `preserveAspectRatio`가 미지정이어서 SVG 내부 좌표계가 요소 크기에 맞게 스케일링되지 않음.

#### 수정 내용

- `fillMigration.ts`: SVG에 `viewBox="0 0 100 100"` + `preserveAspectRatio="none"` 추가
  - SVG 내부 좌표가 요소 크기에 비례하여 스트레칭됨

#### 수정 파일

| 파일                                   | 변경                                              |
| -------------------------------------- | ------------------------------------------------- |
| `panels/styles/utils/fillMigration.ts` | SVG 태그에 viewBox, preserveAspectRatio 속성 추가 |

---

### Added - 페이지 배치 방향 설정 (2026-02-11)

#### 개요

캔버스 내 멀티페이지 배치 방향을 가로/세로/지그재그로 전환할 수 있는 설정을 추가. Settings 패널의 Grid & Guides 섹션에서 제어.

#### 변경 내용

- **Page Layout 설정**: Settings 패널 → Grid & Guides에 PropertySelect 추가 (Horizontal / Vertical / Zigzag)
- **배치 로직**: `initializePagePositions`에 `direction` 파라미터 추가, 방향별 좌표 계산 구현
- **Skia 캐시 stale 방지**: `_pagePosStaleFrames` 카운터로 방향 전환 시 PixiJS worldTransform 갱신 전 캐시 고정 방지

#### 수정 파일

| 파일                                | 변경                                                                                     |
| ----------------------------------- | ---------------------------------------------------------------------------------------- |
| `stores/canvasSettings.ts`          | `PageLayoutDirection` 타입 및 `pageLayoutDirection` / `setPageLayoutDirection` 상태 추가 |
| `stores/elements.ts`                | `initializePagePositions`에 `direction` 파라미터 추가, vertical/zigzag 배치 로직 구현    |
| `panels/settings/SettingsPanel.tsx` | Page Layout PropertySelect 추가 (Grid & Guides 섹션)                                     |
| `canvas/BuilderCanvas.tsx`          | `pageLayoutDirection` 변경 감지 및 페이지 위치 재계산                                    |
| `hooks/usePageManager.ts`           | 초기화 시 현재 방향 반영                                                                 |
| `canvas/skia/SkiaOverlay.tsx`       | `_pagePosStaleFrames` 카운터로 트리 캐시 race condition 방지                             |
| `main/BuilderHeader.tsx`            | 페이지 배치 ToggleButtonGroup 제거 (Settings 패널로 이동)                                |
| `main/BuilderCore.tsx`              | 불필요한 pageLayoutDirection props 전달 제거                                             |

---

### Fixed - 모달 패널 CSS 변수 불일치 수정 (2026-02-11)

#### 개요

Settings 모달 패널의 컴포넌트 색상이 좌우 패널과 다르게 표시되던 문제를 수정.

#### 근본 원인

1. React Aria `<Modal className="modal-panel-wrapper">`가 기본 `react-aria-Modal` 클래스를 대체하여, `builder-system.css`의 `.react-aria-Modal` 선택자가 매칭되지 않음 → 모달 내부가 `:root`/`body` 레벨의 테마 변수(블루 톤)를 상속
2. `ModalPanelContainer.css`에서 프로젝트에 정의되지 않은 `--spectrum-gray-*` 변수 사용

#### 수정 파일

| 파일                                | 변경                                                     |
| ----------------------------------- | -------------------------------------------------------- |
| `styles/1-theme/builder-system.css` | Light/Dark 모드 CSS 변수 선택자에 `.modal-panel` 추가    |
| `layout/ModalPanelContainer.css`    | 미정의 `--spectrum-gray-*` 7개소를 M3 시맨틱 변수로 교체 |

---

### Changed - Workflow 미니맵 개선 (2026-02-10)

#### 개요

워크플로우 오버레이의 미니맵을 CanvasScrollbar와 동일한 자동 표시/숨김 패턴으로 변경하고, 크기를 캔버스에 비례하도록 개선.

#### 변경 내용

- **자동 표시/숨김**: 캔버스 이동(pan/zoom) 시에만 미니맵 표시, 1.5초 비활동 후 자동 숨김
  - 패널 토글 시 미니맵 위치 갱신 타이밍 문제를 근본적으로 해소
- **동적 크기**: 고정 200×150px → 캔버스 크기의 10% 비례 (width: 80~200px, height: 60~140px clamp)
- **여백 통일**: bottom 여백을 48px → 16px로 변경하여 right 여백과 동일하게 통일

#### 수정 파일

| 파일                                                                | 변경                                                                             |
| ------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `apps/builder/src/builder/workspace/canvas/skia/SkiaOverlay.tsx`    | 미니맵 가시성 제어 (카메라 감지 + fade 타이머), 동적 크기 계산, 미사용 코드 제거 |
| `apps/builder/src/builder/workspace/canvas/skia/workflowMinimap.ts` | bottom 여백 16px, 동적 크기 상수 추가 (`MINIMAP_CANVAS_RATIO`, min/max bounds)   |

---

### Removed - @xyflow/react 의존성 및 이벤트 패널 데드 코드 제거 (2026-02-10)

#### 개요

이벤트 패널이 Phase 5 블록 기반 UI(WHEN → IF → THEN/ELSE)로 전환된 후 사용되지 않던 레거시 ViewMode 시스템(List/Simple/ReactFlow)과 `@xyflow/react` 의존성을 완전 제거.

#### 삭제된 파일

- `components/EventHandlerManager.tsx` — 레거시 3-mode 뷰 매니저
- `components/ViewModeToggle.tsx` — List/Simple/ReactFlow 토글
- `components/ActionListView.tsx` — 레거시 액션 목록 뷰
- `components/visualMode/` 전체 — ReactFlowCanvas, TriggerNode, ActionNode, SimpleFlowView, FlowNode, FlowConnector
- `hooks/useEventFlow.ts` — EventHandler → ReactFlow 노드/엣지 변환

#### 수정된 파일

| 파일                                | 변경                        |
| ----------------------------------- | --------------------------- |
| `panels/events/components/index.ts` | 삭제된 컴포넌트 export 제거 |
| `panels/events/hooks/index.ts`      | `useEventFlow` export 제거  |
| `apps/builder/package.json`         | `@xyflow/react` 의존성 제거 |

#### 효과

- 번들 크기 절감: ~45KB (gzip) — `@xyflow/react` + 18개 하위 의존성 제거
- 프로젝트에서 `@xyflow/react` 참조 완전 제거 (워크플로우 레거시 코드 포함)

---

### Fixed - WebGL Canvas 안정화 패치 (2026-02-06)

#### 개요

Section/Card 레이아웃 정합성, Selection/Lasso 좌표계, 키보드 붙여넣기 중복 실행 이슈를 한 번에 정리한 안정화 패치.

#### 1) Section 레이아웃 정합성 (display:block/flex, auto height)

- Section의 암시적 flex 처리/레거시 경로를 정리하여 `display:block` 기본 동작과 명시적 `display:flex` 동작을 분리.
- `display:block`일 때 부모(body)의 `display`, `flex-direction` 변경이 Section display 계산에 간섭하던 문제 수정.
- `height:auto` + padding 환경에서 children 크기 반영/누락이 뒤섞이던 계산 경로 정리.
- 선택 박스가 실제 렌더 영역과 어긋나던 문제를 함께 보정.

#### 2) Lasso/Selection 좌표계 보정

- 라쏘 박스는 화면(글로벌) 좌표, 요소 bounds는 로컬/혼합 좌표를 읽어 교차 판정이 실패하던 문제 수정.
- `BuilderCanvas.tsx`에서 라쏘 좌표를 글로벌 기준으로 정규화하고, 요소 bounds는 `elementRegistry.getBounds()` 우선 경로로 통일.
- `SelectionLayer.utils.ts`는 전달된 bounds 기반 AABB 판정만 수행하도록 단순화하여 SpatialIndex 경로 불일치 제거.

#### 3) Cmd/Ctrl+V 붙여넣기 2회 실행

- 글로벌 단축키와 PropertiesPanel 단축키가 동시에 `paste`를 처리하여 요소가 2개 생성되던 문제 수정.
- PropertiesPanel 단축키를 `panel:properties` 스코프로 제한하고 `activeScope`를 registry 옵션에 연결.

#### 4) Card가 Body 영역을 넘어가는 overflow

- BlockEngine `parseBoxModel()`에서 Card/Box를 content-box로 계산하던 경로 수정.
- `width/height` 명시 시 Section과 동일하게 Card/Box도 border-box로 해석해 `width:100% + padding` 초과폭 제거.

#### 수정 파일

| 파일                                                                          | 변경                                                                     |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `apps/builder/src/builder/workspace/canvas/BuilderCanvas.tsx`                 | Section/Container 레이아웃 경로 정리, Selection/Lasso bounds 좌표계 보정 |
| `apps/builder/src/builder/workspace/canvas/selection/SelectionLayer.utils.ts` | 전달 bounds 기반 AABB 교차 판정으로 단순화                               |
| `apps/builder/src/builder/panels/properties/PropertiesPanel.tsx`              | copy/paste 단축키 scope 지정 + activeScope 적용                          |
| `apps/builder/src/builder/workspace/canvas/layout/engines/utils.ts`           | Card/Box border-box 해석 추가                                            |

---

### Added - AI Tool Calling + Agent Loop (2026-02-06)

#### 개요

기존 JSON 텍스트 파싱 방식(GroqService)에서 **Tool Calling + Agent Loop** 아키텍처(GroqAgentService)로 전환.
Groq SDK의 tool calling을 활용하여 AI가 에디터 도구를 직접 호출하는 방식으로 변경.

#### Phase A1: 기반 구조

- `ai.types.ts` 확장 — AgentEvent(7-variant union), ToolCall, ToolExecutor, AIAgentProvider
- `chat.types.ts` 확장 — tool role, ToolCallInfo, ConversationState agent 필드
- `tools/definitions.ts` — 7개 도구 JSON Schema (Groq ChatCompletionTool 형식)
- `systemPrompt.ts` — `buildSystemPrompt(context)` 동적 시스템 프롬프트 빌더
- `styleAdapter.ts` — CSS-like → 내부 스키마 변환 레이어 (CanvasKit 전환 대비)
- 영향 파일: `ai.types.ts`, `chat.types.ts`, `tools/definitions.ts`, `systemPrompt.ts`, `styleAdapter.ts`

#### Phase A2: Agent 서비스

- `GroqAgentService.ts` — AsyncGenerator 기반 Agent Loop, streaming tool call 조립, MAX_TURNS=10, AbortController
- 5개 핵심 도구: `createElement.ts`, `updateElement.ts`, `deleteElement.ts`, `getEditorState.ts`, `getSelection.ts`
- `tools/index.ts` — 도구 레지스트리 (`createToolRegistry()`)
- `conversation.ts` 확장 — isAgentRunning, currentTurn, activeToolCalls 상태 + 관련 액션
- 영향 파일: `GroqAgentService.ts`, `tools/*.ts`, `conversation.ts`

#### Phase A3: UI 개선

- `useAgentLoop.ts` — Agent Loop React hook, G.3 시각 피드백 연동, IntentParser fallback
- `ToolCallMessage.tsx` — 도구 호출 상태 표시 (아이콘 + 이름 + 스피너/체크/에러)
- `ToolResultMessage.tsx` — 도구 실행 결과 표시 (생성됨/수정됨/삭제됨)
- `AgentControls.tsx` — 중단 버튼 + 현재 turn 카운터
- `AIPanel.tsx` 재작성 — useAgentLoop hook 기반, executeIntent 제거
- `GroqService.ts` — @deprecated 표시, 동작하지 않는 예시 제거
- 영향 파일: `AIPanel.tsx`, `useAgentLoop.ts`, `components/*.tsx`, `GroqService.ts`

#### Phase A4: 고급 기능

- `searchElements.ts` — tag/propName/propValue/styleProp 기반 요소 검색 (limit 지원)
- `batchDesign.ts` — operations[] 배열 순차 실행 (create/update/delete, 최대 20개, 실패 시 중단)
- 429 Rate Limit 지수 백오프 — GroqAgentService 내부 재시도 (1s→2s→4s, 3회)
- 영향 파일: `searchElements.ts`, `batchDesign.ts`, `GroqAgentService.ts`, `definitions.ts`, `index.ts`

#### 최종 결과

| 기능                            | 상태 |
| ------------------------------- | ---- |
| Tool Calling (7개 도구)         | ✅   |
| Agent Loop (multi-turn)         | ✅   |
| 대화 히스토리 전달              | ✅   |
| Streaming 텍스트 + Tool 피드백  | ✅   |
| G.3 시각 피드백 연동            | ✅   |
| 에이전트 중단 (AbortController) | ✅   |
| IntentParser fallback           | ✅   |
| Rate Limit 대응 (429 백오프)    | ✅   |
| 배치 작업 (batch_design)        | ✅   |
| 요소 검색 (search_elements)     | ✅   |

---

### Added - Card display: block 완전 지원 (2026-02-06)

#### 개요

Card 컴포넌트에 `display: 'block'` 기본값 추가 및 Preview CSS와 동일한 동작 구현.

#### Phase 1: Body 기본값 설정

- `createDefaultBodyProps()` 추가 — Body에 `display: 'block'` 기본값 설정
- Reset 시 컴포넌트 기본값 복원 (`useResetStyles.ts`)
- 영향 파일: `unified.types.ts`, `dashboard/index.tsx`, `usePageManager.ts`, `layoutActions.ts`, `useResetStyles.ts`

#### Phase 2: renderWithCustomEngine CONTAINER_TAGS 지원

- **문제**: Card에 `display: 'block'` 추가 시 children이 Card 외부에 형제로 렌더링됨
- **원인**: `renderWithCustomEngine`에서 `childElements`/`renderChildElement` props 누락
- **수정**: 정상 경로와 동일한 CONTAINER_TAGS 처리 패턴 적용
- Card 기본값에 `display: 'block'`, `width: '100%'`, `padding: '12px'` 추가
- 영향 파일: `BuilderCanvas.tsx`, `unified.types.ts`

#### Phase 3: Card padding 이중 적용 수정

- **문제**: children 없이도 불필요한 여백 발생 ("children 공간 차지")
- **원인**: `calculatedContentHeight`에 padding 포함 + `cardLayout.padding`으로 이중 적용
- **수정**: `calculatedContentHeight`와 `calculateContentHeight()`를 content-only로 변경
- 영향 파일: `PixiCard.tsx`, `layout/engines/utils.ts`

#### Phase 4: CONTAINER_TAGS 높이 변경 시 siblings 재배치

- **문제**: Card에 children 추가 → Card height 증가 → 아래 Button 위치 그대로
- **원인**: `position: absolute` + 고정 `top` 값 사용
- **수정**: flex column 래퍼 + relative positioning으로 변경
  - absolute → relative
  - top/left → marginTop/marginLeft
- 영향 파일: `BuilderCanvas.tsx`

#### Phase 5: Block 레이아웃 라인 기반 렌더링

- **문제**: Body에 Button 여러 개 추가 시 계단식 배치 (가로 배치 안됨)
- **원인**: flex column 래퍼 + marginLeft로 x 위치 표현 → 모든 요소 수직 배치
- **수정**: 같은 y 값을 가진 요소들을 라인(flex row)으로 그룹화
  - BlockEngine 결과를 y 값 기준으로 라인 그룹화
  - 각 라인은 flex row (가로 배치)
  - 라인들은 flex column (세로 쌓기)
- 영향 파일: `BuilderCanvas.tsx`

#### Phase 6: ToggleButton 사이즈 통일

- **문제**: ToggleButton/ToggleButtonGroup의 borderRadius가 Button과 다름
- **수정**: `TOGGLE_BUTTON_FALLBACKS` borderRadius를 Button과 동일하게 변경
  - sm: 6 → 4, md: 8 → 6, lg: 10 → 8
- 영향 파일: `cssVariableReader.ts`, `PixiToggleButton.tsx`

#### 최종 결과

| 기능                    | 상태 |
| ----------------------- | ---- |
| children 내부 렌더링    | ✅   |
| padding 정상 적용       | ✅   |
| height auto-grow        | ✅   |
| siblings 자동 재배치    | ✅   |
| inline 요소 가로 배치   | ✅   |
| Button 계열 사이즈 통일 | ✅   |
| Preview 일치            | ✅   |

**상세:** `.claude/plans/giggly-wibbling-mango.md`

---

### Added - Multi-Page Canvas Rendering (2026-02-05)

#### 개요

캔버스에 모든 페이지를 Pencil의 Frame처럼 동시 렌더링하는 기능 구현.
Preview iframe은 기존대로 현재 페이지 1개만 유지.

#### 주요 변경사항

**Phase 1: 페이지 위치 상태 관리**

- Store에 `pagePositions`, `pagePositionsVersion` 상태 및 `initializePagePositions()`, `updatePagePosition()` 액션 추가.
- `usePageManager`에서 초기화 시 수평 배치 계산, `addPage()` 시 동적 canvasSize 기반 위치 계산.

**Phase 2: 다중 페이지 PixiJS 씬 그래프**

- Camera 하위에 `PageContainer` memo 컴포넌트로 페이지별 독립 컨테이너 생성.
- `allPageData`: `pageIndex` 기반 O(1) 조회 (기존 `elements.find/filter` O(N\*M) 제거).
- `elementById`: store의 `elementsMap` 직접 참조 (중복 Map 생성 제거).

**Phase 3: Skia 렌더링 멀티페이지 대응**

- Skia 트리 캐시에 `pagePositionsVersion` 키 추가.
- `pagePosVersionRef` + `invalidateContent()` ref 기반 content 재렌더 트리거.
- 페이지 전환 시 `clearSkiaRegistry()` / `clearImageCache()` / `clearTextParagraphCache()` 호출 제거.
- `renderPageTitle()`: 활성 페이지 selection 색상(`#3B82F6`), 비활성 slate-500(`#64748b`).

**Phase 4: 페이지 클릭 → currentPage 전환**

- 다른 페이지 요소 클릭 시 `setCurrentPageId(element.page_id)` 호출 + Preview 갱신.

**Phase 5: Selection 페이지 경계 처리**

- 빈 영역 클릭 시 `setSelectedElements([])` — 트리/패널 포함 완전 초기화.
- 라쏘 선택은 현재 페이지 내에서만 동작.
- boundsMap 캐시에 `pagePosVersion` 분리 키 추가.

**Phase 6: Viewport Culling 페이지 단위 최적화**

- `visiblePageIds: Set<string>` — 뷰포트 밖 페이지의 `ElementsLayer` 렌더링 제외 (200px 마진).

**Phase 7: 페이지 타이틀 드래그**

- `usePageDrag` 훅: RAF 스로틀 + DOM clientX/clientY 좌표계.
- 타이틀 히트 영역: `PAGE_TITLE_HIT_HEIGHT = 24px`.

**Body 요소 보호**

- `handleCanvasDelete`에서 `tag === 'body'` 요소 필터링.
- `elementRemoval.ts`의 `removeElement`에서 body 삭제 가드 추가.

#### 성능 최적화

| 항목                 | 변경 전                           | 변경 후                     |
| -------------------- | --------------------------------- | --------------------------- |
| `allPageData`        | `elements.find/filter` O(N\*M)    | `pageIndex` O(1)            |
| `elementById`        | `new Map(elements.map())` 매 렌더 | `elementsMap` 직접 참조     |
| 페이지 컨테이너      | 인라인 JSX                        | `PageContainer` memo        |
| Skia content 감지    | 버전 합산                         | `invalidateContent()` + ref |
| 매 프레임 store 읽기 | `useStore.getState()`             | `pagePosVersionRef`         |

#### 수정 파일

| 파일                                  | 변경                                                                 |
| ------------------------------------- | -------------------------------------------------------------------- |
| `stores/elements.ts`                  | pagePositions 상태/액션 추가                                         |
| `stores/utils/elementRemoval.ts`      | Body 삭제 가드                                                       |
| `hooks/usePageManager.ts`             | 초기화/addPage 위치 계산                                             |
| `hooks/useGlobalKeyboardShortcuts.ts` | Body 삭제 필터링                                                     |
| `canvas/BuilderCanvas.tsx`            | 핵심 구조: PageContainer, allPageData, viewport culling, 페이지 전환 |
| `canvas/layers/BodyLayer.tsx`         | pageId prop 사용                                                     |
| `canvas/skia/SkiaOverlay.tsx`         | 트리 캐시 pagePosVersion, 레지스트리 초기화 제거                     |
| `canvas/skia/selectionRenderer.ts`    | renderPageTitle isActive                                             |
| `canvas/selection/SelectionLayer.tsx` | pagePositions prop 연결                                              |
| `canvas/hooks/useViewportCulling.ts`  | 페이지 단위 컬링                                                     |
| `canvas/hooks/usePageDrag.ts`         | **신규** — 페이지 드래그 훅                                          |

**상세:** `docs/MULTIPAGE.md`

### Fixed - Canvas Layout/Rendering 버그 5건 수정 (2026-02-05)

#### 개요

Canvas(PixiJS + Skia) 렌더링에서 발생한 5개 버그를 수정.
리팩토링 시 내부 store 구독→props 전환에서 render call 업데이트 누락이 근본 원인.

#### 버그 1: Body flex-direction 변경 시 Card 높이 늘어남

- **현상**: Body `row→column` 전환 시 Card가 body 전체 높이로 확대. 새로고침하면 정상.
- **원인**: `@pixi/layout`의 `formatStyles()`가 이전 스타일과 merge하여 `flexBasis:'100%'`가 잔류.
- **수정**: `blockLayoutDefaults = { flexBasis: 'auto', flexGrow: 0 }` 기본값을 containerLayout spread 최선두에 배치 (3곳).
- **파일**: `BuilderCanvas.tsx`

#### 버그 2: Card + Button children 겹침

- **현상**: Card 내부 Button이 description 텍스트와 겹침.
- **원인**: `cardLayout.height`가 텍스트만 계산한 고정값 → Yoga가 children 배치 공간 부족.
- **수정**: `height: 'auto'` + `minHeight: calculatedContentHeight` + `contentLayout.gap: 8`.
- **파일**: `PixiCard.tsx`

#### 버그 3: Body padding 적용 시 Card overflow

- **현상**: Body에 padding 적용 시 Card가 body를 벗어남. 새로고침하면 정상.
- **원인**: `ElementsLayer`가 내부 `useStore` → props 리팩토링 후 render call에서 `pageElements`, `bodyElement`, `elementById`, `depthMap` 미전달 → 모두 `undefined`.
- **수정**: `<ElementsLayer>` render call에 누락 props 추가, `bodyElement` computation을 `BuilderCanvas`에 추가.
- **파일**: `BuilderCanvas.tsx`

#### 버그 4: Body 배경색/border/selection 미표시

- **현상**: Body의 배경색, border, selection overlay가 Skia에서 렌더링되지 않음.
- **원인**: `BodyLayer`가 내부 `useStore(currentPageId)` → `pageId` prop 리팩토링 후 render call에서 `pageId` 미전달 → `bodyElement` 항상 `undefined` → Skia node 미등록.
- **수정**: `<BodyLayer pageId={currentPageId!}>` prop 추가.
- **파일**: `BuilderCanvas.tsx`

#### 버그 5: SkiaOverlay.tsx 빌드 에러

- **현상**: `"currentPageId" has already been declared` esbuild 에러.
- **원인**: `currentPageId`가 prop(line 407)과 `useStore`(line 789) 양쪽에서 중복 선언.
- **수정**: 중복 `useStore` 구독 제거 (prop으로 전달됨).
- **파일**: `SkiaOverlay.tsx`

#### 수정 파일 목록

| 파일                                                             | 변경                                                                                |
| ---------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `apps/builder/src/builder/workspace/canvas/BuilderCanvas.tsx`    | ElementsLayer/BodyLayer 누락 props 전달, blockLayoutDefaults 추가, bodyElement 계산 |
| `apps/builder/src/builder/workspace/canvas/ui/PixiCard.tsx`      | cardLayout height:'auto' + minHeight, contentLayout gap:8                           |
| `apps/builder/src/builder/workspace/canvas/skia/SkiaOverlay.tsx` | 중복 currentPageId 선언 제거                                                        |

#### 교훈

`@pixi/layout`의 `formatStyles()` merge 동작과 리팩토링 시 render call 업데이트 누락은 "새로고침하면 정상"이라는 공통 증상을 보인다.

- **formatStyles merge**: 이전 스타일이 잔류 → 새로고침으로 `_styles.custom` 초기화 시 정상
- **Props 미전달**: undefined 값으로 동작 → 새로고침으로 store 재구독 시 정상

### Added - GPUDebugOverlay (2026-02-05)

#### 개요

Skia 렌더링의 “rAF(브라우저) 프레임”과 “Skia present(실제 화면 제출)”을 분리해서 관측할 수 있는 Dev-only 오버레이를 추가.

#### 표시 항목(요약)

- `RAF FPS`, `RAF Frame(ms)` — 브라우저 rAF 기준
- `Skia(ms)`, `Content(ms)`, `Blit(ms)` — SkiaOverlay/SkiaRenderer 단계별 프레임타임
- `Present/s`, `Content/s`, `Registry/s`, `Idle%` — “실제 렌더 빈도/원인” 관측

#### 위치/마운트

- 캔버스 좌상단(Dev-only)
- `apps/builder/src/builder/workspace/canvas/BuilderCanvas.tsx`
- `apps/builder/src/builder/workspace/canvas/utils/GPUDebugOverlay.tsx`

### Added - 캔버스 Page Title 라벨 표시 (2026-02-04)

#### 개요

캔버스에서 페이지 경계(CanvasBounds) 좌측 상단 위에 현재 페이지 타이틀을 표시.
Pencil 앱의 Frame title과 동일한 방식.

#### 구현 방식

- **렌더링**: Skia 캔버스에서 직접 렌더링 (기존 `renderDimensionLabels` 패턴 활용)
- **위치**: 페이지 좌상단 (0, 0) 기준으로 위쪽 20px offset
- **폰트**: Pretendard 12px (화면 기준, zoom-independent — `fontSize * (1/zoom)`)
- **색상**: slate-500 (`#64748b`), 80% opacity
- **배경 없음**: Pencil 스타일 텍스트만 표시

#### 렌더 파이프라인 삽입 위치

```
renderNode() → AI effects → ★renderPageTitle()★ → Selection overlay → Lasso
```

- Selection 오버레이보다 먼저 렌더링되어, 선택 박스/핸들이 타이틀 위에 표시됨
- `pageTitle` 변경 감지: `lastPageTitleRef` → `overlayVersionRef++`로 리렌더 트리거

#### 수정 파일

| 파일                                                                  | 변경                                               |
| --------------------------------------------------------------------- | -------------------------------------------------- |
| `apps/builder/src/builder/workspace/canvas/skia/selectionRenderer.ts` | `renderPageTitle()` 함수 + 상수 추가               |
| `apps/builder/src/builder/workspace/canvas/skia/SkiaOverlay.tsx`      | props 확장, 타이틀 변경 감지, renderPageTitle 호출 |
| `apps/builder/src/builder/workspace/canvas/BuilderCanvas.tsx`         | SkiaOverlayLazy에 pageWidth/pageHeight 전달        |

### Fixed - 스타일 패널 프로퍼티 변경 시 저장 안 됨 / 플리커 / 실시간 프리뷰 미반영 (2026-02-04)

#### 개요

스타일 패널(Transform, Layout, Typography, Appearance)에서 프로퍼티 변경 시:

1. 값을 변경해도 새로고침하면 저장되지 않음 (DB 저장 누락)
2. 요소 선택 시 1프레임 플리커 (빈 값 → 실제 값 깜빡임)
3. 타이핑 중 캔버스에 실시간 프리뷰 미반영

Pencil 앱과 비교하여 동등한 수준의 즉시 반영 품질을 목표로 수정.

#### 버그 1: [Critical] PropertyUnitInput 프리뷰 후 DB 저장 누락

**원인:** `updateSelectedStylePreview`가 `selectedElementProps`를 업데이트 → Jotai atom 갱신 → PropertyUnitInput의 `value` prop이 프리뷰 값으로 변경 → blur 시 `valueActuallyChanged = false` 판정 → `onChange`(DB 저장) 미호출

**수정 (`inspectorActions.ts`):**

- `updateSelectedStylePreview`에서 `selectedElementProps` 업데이트 제거 (캔버스용 `elementsMap`만 업데이트)
- `prePreviewElement` closure 변수로 프리뷰 전 원본 스냅샷 보관
- `updateSelectedStyle`/`updateSelectedStyles` 커밋 시 원본 기반으로 히스토리 기록 (정확한 undo/redo)
- `updateAndSave`에 `prevElementOverride` 파라미터 추가

```
타이핑 중: onDrag → updateStylePreview → elementsMap만 업데이트 → 캔버스 반영
                                          selectedElementProps 미변경 → value prop 유지
blur/Enter: onChange → updateStyleImmediate → valueActuallyChanged=true → DB 저장
```

#### 버그 2: [Critical] FourWayGrid controlled input + updateStyleIdle 충돌

**원인:** LayoutSection FourWayGrid의 `<Input>`이 Jotai atom 값으로 제어되는 controlled component인데, `onChange`가 `updateStyleIdle`(requestIdleCallback, 100ms timeout)을 호출. store가 idle callback 이후에야 업데이트되므로 타이핑한 문자가 즉시 사라짐

**수정 (`LayoutSection.tsx`):**

- FourWayGrid에 local state 패턴 적용 (useState + useLayoutEffect 동기화)
- `updateStyleIdle` → `updateStyleImmediate`로 변경 (blur 시에만 호출되므로 즉시 업데이트 적합)
- `onPreview` 콜백 추가 (타이핑 중 실시간 캔버스 프리뷰)

#### 버그 3: [Medium] 요소 선택 시 플리커 (Two-phase hydration)

**원인:** `setSelectedElement`이 `selectedElementProps: {}` 설정 → hydration 50ms 후 실행. 첫 프레임에 모든 값이 빈 상태로 표시

**수정 (`elements.ts`):**

- `selectedElementProps: {}` → `selectedElementProps: createCompleteProps(element)` (동기적, 경량)
- hydration 콜백은 `computedStyle`만 머지 (전체 교체 대신)
- `_cancelHydrateSelectedProps` 노출하여 경쟁 상태 방지

#### 버그 4: [Medium] Zustand→Jotai Bridge useEffect 지연

**원인:** Bridge 초기값 설정이 `useEffect`(paint 이후)에서 실행되어 첫 프레임에 null 표시

**수정 (`useZustandJotaiBridge.ts`):**

- `useEffect` → `useLayoutEffect`로 변경 (paint 전 실행)
- `buildSelectedElement`에서 빈 props fallback 개선 (`element.props`에서 직접 읽기)

#### 개선: 실시간 캔버스 프리뷰 (Preview vs Commit 분리)

**목표:** Pencil 앱처럼 타이핑 중에도 캔버스에 즉시 반영

**수정:**

- `updateSelectedStylePreview` 스토어 액션 추가 (히스토리/DB 저장 없이 캔버스만 업데이트)
- `updateStylePreview` 훅 함수 추가 (RAF-throttled, `useOptimizedStyleActions.ts`)
- PropertyUnitInput: `handleInputChange`에서 `onDrag` 호출로 타이핑 중 라이브 프리뷰
- PropertyUnitInput: `useEffect` → `useLayoutEffect`로 값 동기화 (1프레임 플리커 방지)
- 전 섹션 `onDrag`를 `updateStyleRAF` → `updateStylePreview`로 전환

| 동작                  | 함수                   | 히스토리 | DB 저장 |
| --------------------- | ---------------------- | -------- | ------- |
| 타이핑 중 / 드래그 중 | `updateStylePreview`   | X        | X       |
| blur / Enter          | `updateStyleImmediate` | O        | O       |

#### 수정 파일

| 파일                                              | 변경                                                                         |
| ------------------------------------------------- | ---------------------------------------------------------------------------- |
| `stores/inspectorActions.ts`                      | prePreviewElement 추적, selectedElementProps 미업데이트, prevElementOverride |
| `stores/elements.ts`                              | 동기적 createCompleteProps, \_cancelHydrateSelectedProps                     |
| `panels/styles/hooks/useOptimizedStyleActions.ts` | updateStylePreview 추가                                                      |
| `panels/styles/hooks/useZustandJotaiBridge.ts`    | useLayoutEffect, 빈 props fallback                                           |
| `panels/styles/sections/LayoutSection.tsx`        | FourWayGrid local state, onPreview                                           |
| `panels/styles/sections/TransformSection.tsx`     | onDrag → updateStylePreview                                                  |
| `panels/styles/sections/TypographySection.tsx`    | onDrag → updateStylePreview                                                  |
| `panels/styles/sections/AppearanceSection.tsx`    | onDrag → updateStylePreview                                                  |
| `components/property/PropertyUnitInput.tsx`       | useLayoutEffect, 타이핑 중 라이브 프리뷰                                     |

### Fixed - ToggleButtonGroup 캔버스 선택 불가 및 스타일 적용 버그 수정 (2026-02-04)

### Fixed - Pencil 방식 2-pass 렌더러 안정화/성능 (2026-02-05)

#### 개요

Pencil 모델(컨텐츠 캐시 + present(blit) + 오버레이 분리)로 전환한 후, 고배율 줌/팬 및 리사이즈/DPR 변화에서 잔상·미세 버그를 방지하고 cleanup 비용을 낮춤.

#### 변경 사항(요약)

- **contentSurface 백엔드 정합**: `ck.MakeSurface()` 대신 `mainSurface.makeSurface()`로 offscreen surface를 생성해 메인과 동일 백엔드(GPU/SW) 사용.
- **줌 스냅샷 보간**: zoomRatio != 1이면 `drawImageCubic` 우선 적용(미지원 환경 `drawImage` 폴백).
- **Paragraph LRU 캐시**: 텍스트 `Paragraph`를 (내용+스타일+maxWidth) 키로 캐시(최대 500), 폰트 교체/페이지 전환/HMR에서 무효화.
- **리사이즈/DPR/컨텍스트 복원 안정화**: surface 재생성 직후 `invalidateContent()+clearFrame()`로 1-frame stale/잔상 방지.

#### 관련 파일

- `apps/builder/src/builder/workspace/canvas/skia/SkiaRenderer.ts`
- `apps/builder/src/builder/workspace/canvas/skia/SkiaOverlay.tsx`
- `apps/builder/src/builder/workspace/canvas/skia/nodeRenderers.ts`

### Fixed - 스타일 변경 Long Task 저감 (2026-02-05)

#### 개요

스타일 패널에서 클릭/드래그 시 `[Violation] 'click' handler took ...ms`(Long Task) 빈도를 낮추기 위해, 업데이트 액션의 O(n) 재빌드를 제거하고 저장을 백그라운드로 전환.

#### 변경 사항(요약)

- `updateElementProps`/`batchUpdateElementProps`: `_rebuildIndexes()` 제거, 변경된 요소만 `elementsMap` O(1) 갱신
- IndexedDB 저장을 `await`로 블로킹하지 않고 백그라운드 처리
- 멀티 선택 정렬/분배를 `batchUpdateElementProps` 경로로 전환

#### 관련 파일

- `apps/builder/src/builder/stores/utils/elementUpdate.ts`
- `apps/builder/src/builder/panels/properties/PropertiesPanel.tsx`

#### 1. ToggleButtonGroup 캔버스에서 클릭 선택 불가 (Selection)

**원인 (3가지 복합 문제):**

- `pixiGraphics`의 `eventMode="none"`으로 클릭이 관통됨
- `position: absolute` pixiContainer 래퍼가 PixiJS hit testing에서 올바른 hit area 미제공
- `LayoutComputedSizeContext`의 `computedSize.height === 0`이 `??` 연산자에서 falsy로 처리되지 않아 `bgHeight = 0` → hit area 없음

**수정 (`PixiToggleButtonGroup.tsx`):**

- `pixiContainer` 래퍼 제거 → `pixiGraphics` 직접 반환 (BoxSprite 패턴)
- `eventMode="static"` + `cursor="pointer"` + `onPointerDown` 설정
- `LayoutComputedSizeContext`에서 Yoga computed size 사용 (Skia 렌더링과 hit area 일치)
- `computedSize` 값이 0일 때 fallback하도록 `??` → `> 0` 명시적 체크로 변경

#### 2. ToggleButtonGroup width/height 스타일 미적용

**원인:** `PixiToggleButtonGroup.tsx`의 `groupLayout`이 style.width/height를 무시하고 fit-content 고정

**수정:** 외부 LayoutContainer(styleToLayout)가 width/height 처리, 내부는 배경만 렌더링

#### 3. width/height를 px/% → auto/fit-content 변경 시 새로고침 필요

**원인:** `@pixi/layout`의 `formatStyles`가 `{ ...이전스타일, ...새스타일 }`로 머지하여, 삭제된 속성(width/height)이 이전 캐시 값으로 남아있음

**수정 (`styleToLayout.ts`):** width/height가 undefined일 때 명시적으로 `'auto'` 설정하여 이전 캐시 값을 덮어씀

```typescript
// Before: 삭제된 속성이 캐시에 남음
if (width !== undefined) layout.width = width;
// After: 명시적 'auto'로 이전 값 override
layout.width = width !== undefined ? width : "auto";
```

#### 4. PropertyUnitInput 키워드 유닛 버그

**원인:** auto, fit-content 등 키워드 유닛 선택 시 "300auto" 같은 잘못된 CSS 생성

**수정 (`PropertyUnitInput.tsx`):** 키워드 유닛 감지 시 effectiveUnit을 'px'로 변환하여 숫자+키워드 조합 방지

### Fixed - WebGL 스타일/프로퍼티 변경 즉시 반영 안 되는 문제 수정 (2026-02-03)

#### 개요

우측 스타일 패널이나 프로퍼티 패널에서 값을 변경했을 때 WebGL/Skia 캔버스에 즉시 반영되지 않고, 화면 위치 이동(pan/zoom)이나 새로고침 후에야 반영되던 문제 수정

#### 버그 원인

`ElementSprite.tsx`의 `skiaNodeData` useMemo 의존성 배열에 `style`과 `props`가 누락되어 있었음

```typescript
// 수정 전: effectiveElement 참조만 비교
const skiaNodeData = useMemo(() => {
  const style = effectiveElement.props?.style;
  // ...
}, [effectiveElement, spriteType]); // ⚠️ style 변경 감지 안 됨
```

`effectiveElement` 객체 참조가 같으면 내부 `props.style`이 변경되어도 useMemo가 캐시된 값을 반환하여 Skia 렌더 데이터가 업데이트되지 않음

#### 수정 내용

useMemo 외부에서 `style`과 `props` 참조를 추출하여 의존성 배열에 추가

```typescript
// 수정 후: style/props 참조가 다르면 재계산
const elementStyle = effectiveElement.props?.style;
const elementProps = effectiveElement.props;

const skiaNodeData = useMemo(() => {
  const style = elementStyle as CSSStyle | undefined;
  // ...
}, [effectiveElement, spriteType, elementStyle, elementProps]);
```

이렇게 하면:

1. Store에서 element.props.style이 업데이트되면 새 style 객체 생성
2. `elementStyle` 참조가 변경됨
3. `skiaNodeData` useMemo가 재계산되어 새 Skia 렌더 데이터 생성
4. `useSkiaNode`의 useEffect가 재실행 → `registerSkiaNode()` 호출
5. `registryVersion++` → Skia 렌더러가 변경 감지하여 다시 렌더링

#### 참고: BoxSprite의 올바른 패턴

동일한 문제가 `BoxSprite.tsx`에서는 발생하지 않았는데, 의존성 배열에 `style`이 포함되어 있었기 때문:

```typescript
// BoxSprite.tsx - 올바른 패턴
const skiaNodeData = useMemo(() => {
  // ...
}, [transform, fill, borderRadius, borderConfig, style, skiaEffects]); // ✅ style 포함
```

#### 영향 범위

- 모든 요소 타입(Button, Box, Text, Image 등)의 스타일/프로퍼티 변경이 즉시 WebGL 캔버스에 반영
- pan/zoom 없이 스타일 패널 변경 즉시 시각적 피드백 제공

#### 변경된 파일

- `apps/builder/src/.../sprites/ElementSprite.tsx` — `skiaNodeData` useMemo 의존성 배열에 `elementStyle`, `elementProps` 추가

---

### Fixed - Dirty Rect 부분 렌더링 시 이전 프레임 잔상 문제 수정 (2026-02-03)

#### 개요

스타일 변경 시 간헐적으로 이전 렌더링의 모양이 남아있는 문제 수정

#### 버그 원인

Dirty rect 기반 부분 렌더링에서 경계 영역에 여유분(padding)이 없어서 안티앨리어싱, 부동소수점 오차, 서브픽셀 렌더링으로 인한 경계 잔상이 발생

#### 수정 내용 (2건)

**1. `useSkiaNode.ts` - nodeToDirtyRect():**

```typescript
// 수정 전
let expand = 0;

// 수정 후: 기본 2px 여유분 추가
let expand = 2; // 안티앨리어싱, 부동소수점 오차 대비
```

**2. `SkiaRenderer.ts` - screenRect 계산:**

```typescript
// 수정 전
const screenRect = {
  x: rect.x * camera.zoom + camera.panX,
  y: rect.y * camera.zoom + camera.panY,
  width: rect.width * camera.zoom,
  height: rect.height * camera.zoom,
};

// 수정 후: 2px 패딩 추가
const padding = 2;
const screenRect = {
  x: rect.x * camera.zoom + camera.panX - padding,
  y: rect.y * camera.zoom + camera.panY - padding,
  width: rect.width * camera.zoom + padding * 2,
  height: rect.height * camera.zoom + padding * 2,
};
```

#### 변경된 파일

- `apps/builder/src/.../skia/useSkiaNode.ts` — `nodeToDirtyRect()` 기본 expand 2px 추가
- `apps/builder/src/.../skia/SkiaRenderer.ts` — screenRect 계산 시 2px 패딩 추가

> **업데이트 (2026-02-05):** 이후 clipRect 기반 Dirty Rect 경로는 “팬/줌/스냅샷/padding” 조합에서
> 잔상·미반영 리스크가 커서 **2-pass 컨텐츠 캐시 + present(blit) + 오버레이 분리 모델로 대체**되었다.
> 따라서 위 수정은 “당시 시점의 Hotfix 기록”으로만 의미가 있으며, 현재 렌더 경로에는 적용되지 않는다.

---

### Fixed - Pencil 2-pass 렌더러로 Dirty Rect 제거 및 줌/팬 성능 핫픽스 (2026-02-05)

#### 개요

줌/팬 중 스타일/프로퍼티 반영 지연(팬해야 반영)과 잔상 문제를 구조적으로 제거하고,
메인 스레드 블로킹(긴 rAF 핸들러) 현상을 줄이기 위한 렌더 파이프라인 재정렬.

#### 변경 내용

- Dirty Rect(clipRect) 부분 렌더링 경로 제거(보류) → 컨텐츠 invalidation은 full rerender로 단순화
- Pencil 방식 2-pass:
  - contentSurface에 디자인 컨텐츠 렌더 → `contentSnapshot` 캐시
  - mainSurface는 present 단계에서 snapshot blit(카메라 델타 아핀 변환) + Selection/AI/PageTitle 오버레이 별도 패스
- 줌/팬 인터랙션 중에는 camera-only(스냅샷 아핀 blit) 우선 + 모션 종료 후 cleanup(full) 1회 재렌더
- Pixi 시각 비활성화 O(1): Camera 자식 전체 순회 대신 `Camera.alpha=0`
- Selection 바운드맵 `registryVersion` 캐시로 매 프레임 O(n) 순회 제거

#### 변경된 파일

- `apps/builder/src/builder/workspace/canvas/skia/SkiaRenderer.ts`
- `apps/builder/src/builder/workspace/canvas/skia/SkiaOverlay.tsx`
- `docs/RENDERING_ARCHITECTURE.md`, `docs/PENCIL_APP_ANALYSIS.md`, `docs/PENCIL_VS_composition_RENDERING.md`

### Fixed - 요소 삭제 후 화면에 남아있는 문제 수정 (2026-02-03)

#### 개요

요소를 삭제해도 화면에 남아있고 pan/zoom 같은 위치 이동이 이루어져야 화면에서 사라지던 문제 수정

#### 버그 원인

React의 `useEffect` cleanup이 비동기적으로 지연될 수 있어서, 요소가 삭제되어도 Skia 레지스트리에서 즉시 제거되지 않음

```
기존 흐름 (문제):
1. Store에서 요소 삭제
2. React reconciliation → ElementSprite 언마운트 예약
3. (지연) useEffect cleanup 실행 → unregisterSkiaNode 호출
4. 다음 렌더 프레임에서도 삭제된 요소가 여전히 표시됨
```

#### 수정 내용

`elementRemoval.ts`에서 요소 삭제 시 **직접 Skia 레지스트리에서 해당 요소들을 즉시 제거**

```typescript
// 추가된 import
import { unregisterSkiaNode } from "../../workspace/canvas/skia/useSkiaNode";

// set() 호출 전에 Skia 레지스트리 정리
for (const id of elementIdsToRemove) {
  unregisterSkiaNode(id);
}

set({
  elements: filteredElements,
  // ...
});
```

#### 수정 후 흐름

```
1. Store에서 요소 삭제 시작
2. 즉시 unregisterSkiaNode(id) 호출 → dirty rect 추가 + 레지스트리 삭제 + registryVersion++
3. Store 상태 업데이트
4. 다음 렌더 프레임에서 dirty rect 영역 클리어 → 삭제된 요소 즉시 화면에서 사라짐
```

#### 변경된 파일

- `apps/builder/src/builder/stores/utils/elementRemoval.ts` — `unregisterSkiaNode` import 및 삭제 시 즉시 호출

---

### Added - Selection 치수 표시 기능 (2026-02-03)

#### 개요

캔버스에서 요소를 선택했을 때 선택 박스 하단에 `width × height` 치수 레이블을 표시하는 Figma 스타일 기능 추가

#### 구현 내용

- **위치**: 선택 박스 하단 중앙, 8px 오프셋
- **스타일**: 파란 배경(`#51a2ff`) + 흰색 텍스트 + 둥근 모서리(4px)
- **폰트**: Pretendard 11px
- **줌 독립적**: 화면상 일정한 크기 유지 (`1/zoom` 스케일 적용)

#### 변경된 파일

- `apps/builder/src/.../skia/selectionRenderer.ts` — `renderDimensionLabels()` 함수 추가
- `apps/builder/src/.../skia/SkiaOverlay.tsx` — Selection 렌더링 시 치수 레이블 호출

---

### Fixed - Skia UI 컴포넌트 borderRadius 파싱 버그 수정 (2026-02-03)

#### 개요

UI 패널에서 Button 등 UI 컴포넌트의 `borderRadius`를 변경해도 Skia 캔버스에 반영되지 않는 문제 수정

#### 버그 원인

`ElementSprite.tsx`의 Skia 폴백 렌더링에서 `style.borderRadius`를 `typeof === 'number'` 체크로 직접 읽었으나, UI 패널은 값을 문자열(`"12px"`)로 저장하므로 항상 `0`으로 평가됨

```typescript
// 수정 전 (항상 br = 0)
const { transform, fill, stroke } = convertStyle(style);
const br = typeof style.borderRadius === "number" ? style.borderRadius : 0;
```

#### 수정 내용 (3건)

**1. CSS 문자열 파싱 누락:**
`convertStyle()`이 이미 `parseCSSSize()`를 통해 CSS 문자열을 숫자로 올바르게 변환하므로, 그 결과를 destructuring하여 사용

```typescript
// 수정 후 (올바르게 파싱)
const {
  transform,
  fill,
  stroke,
  borderRadius: convertedBorderRadius,
} = convertStyle(style);
const br =
  typeof convertedBorderRadius === "number"
    ? convertedBorderRadius
    : (convertedBorderRadius?.[0] ?? 0);
```

**2. 명시적 0 값 무시:**
기존 `br > 0 ? br : 기본값` 로직이 사용자가 명시적으로 `borderRadius: "0"`을 설정한 경우와 미설정(undefined)을 구분하지 못함

```typescript
// 수정 전: borderRadius=0 설정해도 UI 컴포넌트는 기본값 6px로 덮어씌움
const effectiveBorderRadius =
  br > 0 ? br : isUIComponent && !hasBgColor ? 6 : 0;

// 수정 후: style에 borderRadius가 명시적으로 존재하면 그 값(0 포함) 사용
const hasBorderRadiusSet =
  style?.borderRadius !== undefined &&
  style?.borderRadius !== null &&
  style?.borderRadius !== "";
const effectiveBorderRadius = hasBorderRadiusSet
  ? br
  : isUIComponent && !hasBgColor
    ? 6
    : 0;
```

**3. 하드코딩된 기본 borderRadius 6px → Spec size별 토큰 값 적용:**
기존에 UI 컴포넌트의 기본 borderRadius가 size에 관계없이 `6`으로 하드코딩되어 있었으나,
Spec의 radius 토큰 값에 따라 size별로 차등 적용하도록 수정

```typescript
// 수정 전: 모든 size에 6px 고정
const effectiveBorderRadius = hasBorderRadiusSet
  ? br
  : isUIComponent && !hasBgColor
    ? 6
    : 0;

// 수정 후: Spec radius 토큰 기반 size별 기본값 (xs/sm=4, md=6, lg/xl=8)
const size = isUIComponent ? String(props?.size || "md") : "";
const defaultBorderRadius = UI_COMPONENT_DEFAULT_BORDER_RADIUS[size] ?? 6;
const effectiveBorderRadius = hasBorderRadiusSet
  ? br
  : isUIComponent && !hasBgColor
    ? defaultBorderRadius
    : 0;
```

#### 영향 범위

- 모든 UI 컴포넌트(Button, Input, Checkbox, Select 등)의 Skia 폴백 렌더링에서 `borderRadius` 정상 반영
- `borderRadius: 0` 명시적 설정 시 직각 모서리로 정상 렌더링
- `borderRadius` 미설정 시 Spec size별 기본값 적용 (xs/sm=4px, md=6px, lg/xl=8px)

#### 변경된 파일

- `apps/builder/src/.../sprites/ElementSprite.tsx` — `convertStyle()` borderRadius destructuring + 명시적 0 값 처리 + size별 기본 borderRadius 매핑(`UI_COMPONENT_DEFAULT_BORDER_RADIUS`)

---

### Removed - WASM/Skia Feature Flag 환경변수 제거 (2026-02-02)

5개 환경변수(`VITE_RENDER_MODE`, `VITE_WASM_SPATIAL`, `VITE_WASM_LAYOUT`, `VITE_WASM_LAYOUT_WORKER`, `VITE_SKIA_DUAL_SURFACE`)를 제거하고 값을 하드코딩하여 ~30개 조건 분기 및 dead code를 제거.

- `wasm-bindings/featureFlags.ts`: 모든 `WASM_FLAGS` → `true`, `getRenderMode()` → `'skia'` 고정
- `utils/featureFlags.ts`: `isWasmSpatialIndex()`, `isWasmLayoutEngine()`, `isCanvasKitEnabled()` → `true` 고정
- `.env`, `.env.example`: WASM 관련 환경변수 5줄 삭제
- `vite-env.d.ts`: 환경변수 타입 5개 삭제
- Sprite 6개 파일: `if (!WASM_FLAGS.CANVASKIT_RENDERER)` 가드 제거
- Selection 3개 파일: `isSkiaMode` 변수 제거, 무조건 Skia 경로 사용
- `init.ts`: Feature Flag 조건 4개 제거 (무조건 초기화)
- `elementRegistry.ts`: `WASM_FLAGS` 조건 제거 (`_spatialModule` null 체크는 유지)
- `BuilderCanvas.tsx`: `WASM_FLAGS.CANVASKIT_RENDERER &&` 조건 제거
- `SkiaRenderer.ts`: `WASM_FLAGS.DUAL_SURFACE_CACHE &&` 조건 제거
- `BlockEngine.ts`, `GridEngine.ts`: `WASM_FLAGS.LAYOUT_ENGINE &&` / `WASM_FLAGS.LAYOUT_WORKER` 조건 제거
- `SelectionLayer.utils.ts`: JS 폴백 경로 dead code 제거
- `SkiaOverlay.tsx`: `renderMode` 조건 3곳 제거, `isActive` 상수화

### Fixed - Skia 렌더 트리 계층화 및 Selection 좌표 통합 (2026-02-02)

#### 개요

캔버스 팬 시 Body 내 Button이 Body를 뒤따라오는 렌더링 불일치 및 Selection 오버레이가 컨텐츠와 분리되는 문제를 근본적으로 해결

#### 버그 원인

1. **Flat 트리 + worldTransform 절대 좌표**: 기존 `buildSkiaTreeFromRegistry`는 모든 노드를 flat siblings로 수집하고 각 노드의 절대 좌표를 `(wt.tx - cameraX) / zoom`으로 독립 계산. PixiJS ticker 우선순위 차이(`NORMAL` vs `LOW`)로 worldTransform 갱신 타이밍이 달라 노드 간 상대 위치 오차 발생
2. **Selection 좌표 소스 불일치**: `buildSelectionRenderData`가 elementRegistry/하드코딩 좌표를 사용하여 컨텐츠 렌더링과 다른 좌표 소스 참조

#### 수정 내용

- `buildSkiaTreeFromRegistry` → `buildSkiaTreeHierarchical`로 교체: 계층적 트리 + worldTransform 부모-자식 상대 좌표
  - 핵심 공식: `relativeX = (child.wt.tx - parent.wt.tx) / cameraZoom` — 카메라 오프셋이 뺄셈 시 상쇄
- `buildTreeBoundsMap`: Skia 트리에서 절대 바운드 추출, Selection이 컨텐츠와 동일한 좌표 소스 참조
- `aiEffects.ts` `buildNodeBoundsMap`: 계층 트리에서 부모 오프셋 누적으로 절대 좌표 복원

#### 변경된 파일

- `apps/builder/src/builder/workspace/canvas/skia/SkiaOverlay.tsx` — 계층 트리 구성, Selection 좌표 통합
- `apps/builder/src/builder/workspace/canvas/skia/aiEffects.ts` — AI 이펙트 좌표 누적 수정

---

### Added - Skia 렌더링 파이프라인 완성 (2026-02-02)

#### 개요

Skia 렌더링 파이프라인의 남은 기능 8건을 모두 구현하여 Pencil 렌더링 아키텍처 전환 100% 완료

#### 구현 항목

1. **MeshGradient Fill** (`fills.ts`)
   - CanvasKit에 네이티브 API 없으므로 bilinear interpolation 근사: top/bottom LinearGradient + MakeBlend
   - `MeshGradientFill` 인터페이스에 rows, columns, colors, width, height 필드 추가

2. **LayerBlur 이펙트** (`effects.ts`)
   - 전경 콘텐츠에 가우시안 블러 적용: `MakeBlur(ImageFilter)` + `saveLayer()`
   - `LayerBlurEffect` 인터페이스 + `EffectStyle` 유니언에 합류

3. **Phase 6 이중 Surface 활성화** (`SkiaOverlay.tsx`)
   - `renderer.render()` 호출에 `registryVersion`, `camera`, `dirtyRects` 파라미터 전달
   - idle 프레임 스킵, camera-only 블리팅, content dirty rect 부분 렌더링 활성화

4. **변수 resolve 렌더링 경로 완성** (G.2)
   - `useResolvedElement()` → `effectiveElement` → 개별 Sprite → SkiaNodeData 파이프라인 검증 완료
   - `resolveElementVariables()`: style 객체 재귀 탐색으로 `$--` 변수 → 실제 CSS 값 변환 동작 확인

5. **KitComponentList 패널 통합** (G.4)
   - `DesignKitPanel`에 마스터 컴포넌트 목록 표시 + 인스턴스 생성 연결
   - `elements.ts` 스토어에 `createInstance` 액션 추가

6. **킷 적용 시각 피드백** (G.3 + G.4)
   - `applyKit()` 시작 시 body에 generating 이펙트, 완료 시 녹색 flash 트리거
   - 실패 시 generating 이펙트 자동 제거

7. **내장 디자인 킷 JSON** (G.4)
   - `builtinKits/basicKit.ts`: 5개 색상 변수 + Default 테마(12 토큰) + Card/Badge 마스터 컴포넌트
   - `loadAvailableKits()`: 내장 킷 메타데이터 자동 로드
   - `loadBuiltinKit()`: ID로 내장 킷 조회 + loadedKit 설정

#### 변경된 파일

- `apps/builder/src/builder/workspace/canvas/skia/types.ts` — MeshGradientFill 필드, LayerBlurEffect 인터페이스
- `apps/builder/src/builder/workspace/canvas/skia/fills.ts` — MeshGradient 셰이더 구현
- `apps/builder/src/builder/workspace/canvas/skia/effects.ts` — LayerBlur 이펙트 구현
- `apps/builder/src/builder/workspace/canvas/skia/SkiaOverlay.tsx` — Phase 6 파라미터 전달
- `panels/designKit/DesignKitPanel.tsx` — KitComponentList 통합, 내장 킷 로드
- `stores/elements.ts` — createInstance 액션 추가
- `stores/designKitStore.ts` — loadBuiltinKit, 시각 피드백 연동
- `utils/designKit/builtinKits/basicKit.ts` — 내장 킷 데이터 (신규)

---

### Fixed - Skia UI 컴포넌트 Variant 배경/테두리 색상 매핑 (2026-02-02)

#### 개요

프로퍼티 패널에서 UI 컴포넌트(Button 등)의 variant를 변경해도 Skia 캔버스에 배경색/테두리색이 반영되지 않는 문제 수정

#### 버그 원인

`ElementSprite.tsx`의 Skia 폴백 렌더링에서 배경색을 `#e2e8f0`(slate-200), 테두리색을 `#cbd5e1`(slate-300)로 하드코딩

#### 수정 내용

- `VARIANT_BG_COLORS`: variant별 배경색 매핑 (8개 variant, M3 Light Mode 기준)
- `VARIANT_BG_ALPHA`: outline/ghost variant → alpha 0 (투명 배경)
- `VARIANT_BORDER_COLORS`: variant별 테두리색 매핑 (ghost는 테두리 없음)
- 우선순위: `inline style.backgroundColor > VARIANT_BG_COLORS[variant] > 기본값`

#### 변경된 파일

- `apps/builder/src/builder/workspace/canvas/sprites/ElementSprite.tsx` — VARIANT_BG_COLORS, VARIANT_BG_ALPHA, VARIANT_BORDER_COLORS 추가
- `docs/COMPONENT_SPEC.md` — §4.5 variant 배경/테두리 색상 테이블 추가
- `docs/reference/components/PIXI_WEBGL.md` — Skia 폴백 variant 색상 매핑 섹션 추가
- `docs/RENDERING_ARCHITECTURE.md` — UI 컴포넌트 variant 배경/테두리 색상 노트 추가
- `docs/adr/003-canvas-rendering.md` — variant 색상 매핑 업데이트 항목 추가
- `docs/LAYOUT_REQUIREMENTS.md` — skiaNodeData 예시에 variant 색상 매핑 반영

---

### Fixed - Skia AABB 뷰포트 컬링 좌표계 버그 수정 (2026-02-02)

#### 개요

캔버스 팬 시 body가 화면 왼쪽/위쪽 가장자리에 닿으면 모든 Skia 렌더링이 사라지는 문제 수정

#### 버그 원인 (2가지)

1. **루트 컨테이너 zero-size 컬링**: `buildSkiaTreeFromRegistry`(현재 `buildSkiaTreeHierarchical`로 교체됨)가 생성하는 가상 루트 노드 `{x:0, y:0, width:0, height:0}`에 AABB 컬링이 적용되어, 카메라가 원점을 벗어나면 (`cameraX < 0` 또는 `cameraY < 0`) 루트가 컬링 → 전체 렌더링 소실
2. **자식 좌표계 불일치**: `canvas.translate(node.x, node.y)` 후 자식은 부모 로컬 좌표에 있지만, `cullingBounds`는 씬-로컬 좌표로 전달되어 텍스트 등 자식 노드가 잘못 컬링됨

#### 수정 내용

- `renderNode()`에서 zero-size 노드(가상 컨테이너) AABB 컬링 스킵
- 자식 재귀 시 `cullingBounds`를 `(x - node.x, y - node.y)` 로 역변환하여 로컬 좌표계 일치

#### 변경된 파일

- `apps/builder/src/.../skia/nodeRenderers.ts` — AABB 컬링 로직 수정

---

### Fixed - Skia Border-Box 렌더링 및 레이아웃 수정 (2026-02-02)

#### 개요

Skia 렌더러의 border(stroke) 렌더링이 CSS border-box 모델과 불일치하여 인접 요소의 border가 겹치는 문제를 수정

#### 버그 원인

- `nodeRenderers.ts`의 `renderBox()`가 stroke를 `(0, 0, width, height)` rect에 그림
- CanvasKit의 `PaintStyle.Stroke`는 경로 **중앙**에 그려지므로, `strokeWidth/2`만큼 요소 바운드 밖으로 넘침
- 인접 요소의 border가 서로의 바운드를 침범하여 시각적 겹침 발생

#### 수정 내용

1. **`skia/nodeRenderers.ts` — Skia stroke inset (핵심 수정)**
   - stroke rect를 `(inset, inset, width-inset, height-inset)` (inset = strokeWidth/2)로 축소
   - borderRadius도 inset만큼 조정하여 둥근 모서리에서도 정확한 border-box 동작
   - PixiJS `drawBox`의 `getBorderBoxOffset` 방식과 동일한 렌더링 결과

2. **`layers/BodyLayer.tsx` — Body Skia 데이터에 strokeColor/strokeWidth 추가**
   - Skia 모드에서 body의 borderColor가 적용되지 않던 문제 수정
   - `borderConfig` → `Float32Array` strokeColor + strokeWidth 변환 추가

3. **`BuilderCanvas.tsx` — Block 레이아웃 parentBorder 처리 정리**
   - `renderWithCustomEngine`에서 `parentBorder`를 `availableWidth` 계산 및 렌더링 offset에서 제거
   - border는 시각 렌더링 전용, 레이아웃 inset으로 사용하지 않음
   - `parseBorder` import 제거

#### 영향 범위

- 모든 Box 타입 Skia 노드 (Button, Body, div 등)의 border 렌더링
- `display:block` / `display:flex` 양쪽 레이아웃 경로에서 일관된 동작 확인

#### 변경된 파일

- `apps/builder/src/.../skia/nodeRenderers.ts` — stroke inset 렌더링
- `apps/builder/src/.../layers/BodyLayer.tsx` — Skia body border 데이터 추가
- `apps/builder/src/.../BuilderCanvas.tsx` — parentBorder 레이아웃 정리

---

### Added - WASM 성능 경로 Phase 0-4 구현 완료 (2026-02-02)

#### 개요

Rust WASM 기반 성능 가속 모듈(Phase 0-4)을 빌드/활성화하여 전체 WASM 파이프라인을 가동

#### Phase 0: 환경 구축

- Rust 1.93.0 + wasm-pack 0.14.0 설치
- `wasm-pack build --target bundler` → `composition_wasm_bg.wasm` (70KB) 빌드 성공
- `ping() = "pong"` 파이프라인 검증 통과

#### Phase 1: Spatial Index

- Grid-cell 기반 SpatialIndex (cell_size=256) — O(k) 뷰포트 컬링, 라쏘 선택, 히트 테스트
- idMapper (string UUID ↔ u32 양방향 매핑)

#### Phase 2: Layout Engine

- Block 레이아웃: margin collapse, BFC, inline-block 지원 (children > 10 시 WASM 경로)
- Grid 레이아웃: track 파싱 (fr/px/%/auto) + cell 위치 계산

#### Phase 4: Web Worker

- Worker 내 WASM 초기화 + block/grid 레이아웃 비동기 계산
- SWR 캐싱 + LayoutScheduler (RAF 기반)
- Transferable ArrayBuffer zero-copy 전송

#### 버그 수정

- `GridEngine.ts`: `calculateViaWasm()` 메서드에 누락된 `parent` 파라미터 추가

#### 브라우저 검증 결과 (콘솔 로그)

```
[RustWasm] 초기화 완료 — ping() = "pong"
[SpatialIndex] 초기화 완료 (cellSize=256)
[LayoutWorker] 초기화 완료
[LayoutWorker] scheduler 준비 완료
[WASM] 모듈 초기화 완료 {spatial: true, layout: true, worker: true, canvaskit: true}
```

#### 변경된 파일

- `apps/builder/.env` — WASM 플래그 전체 true 전환
- `apps/builder/.env.example` — WASM 플래그 업데이트
- `apps/builder/package.json` — `wasm:build` 스크립트 추가
- `apps/builder/src/.../layout/engines/GridEngine.ts` — parent 파라미터 버그 수정
- `apps/builder/src/.../wasm-bindings/pkg/` — Rust WASM 빌드 산출물 (신규)
- `docs/RENDERING_ARCHITECTURE.md` — Phase 0-4 산출물 체크리스트 ✅ 업데이트, 로드맵 상태 갱신
- `docs/WASM_DOC_IMPACT_ANALYSIS.md` — 최종 수정일 및 현재 상태 반영
- `docs/PENCIL_VS_composition_RENDERING.md` — WASM 모듈 항목 업데이트

---

### Docs - Pencil 렌더링 방식 전환 구현 현황 체크 (2026-02-01)

#### 개요

Pencil 앱과 동일한 CanvasKit/Skia 렌더링 아키텍처로의 전환 완성도를 체계적으로 점검하고 결과를 문서화

#### 체크 결과: 95% 완료 (35/37 항목)

**✅ 완전 구현:**

- 아키텍처: CanvasKit 메인 렌더러 + PixiJS 이벤트 전용 + 이중 Surface + 2-pass(컨텐츠 캐시 + present blit + 오버레이 분리) + 프레임 분류
- 노드 렌더링: Box/Text/Image/Container + AABB 컬링 + ParagraphBuilder 텍스트
- Fill 5/6종, 이펙트 4/5종, 블렌드 모드 18종 전체
- Selection 오버레이 + AI 시각 피드백 + Export (PNG/JPEG/WEBP)
- 유틸리티: 초기화, Surface, Disposable, Font(IndexedDB 캐싱), 텍스트 측정(Yoga 연결)

**❌ 미구현 (2항목):**

- MeshGradient Fill — Phase 5 후반 예정
- LayerBlur 이펙트 — effects.ts 확장 예정

#### 변경된 파일

- `docs/PENCIL_VS_composition_RENDERING.md` — §11 구현 현황 체크리스트 추가 (11.1-11.11)

---

### Changed - Selection 오버레이 Skia 전환 (Pencil 방식) (2026-02-01)

#### 개요

Selection 오버레이(선택 박스, Transform 핸들, 라쏘)를 PixiJS 듀얼 캔버스에서 Pencil 앱 방식의 CanvasKit/Skia 단일 캔버스 렌더링으로 전환

#### 아키텍처 변경

**Before (듀얼 캔버스):**

- Skia 캔버스 (z:2): 디자인 노드 + AI 이펙트
- PixiJS 캔버스 (z:3): SelectionBox/TransformHandle/Lasso 렌더링 + 이벤트

**After (Pencil 방식 단일 캔버스):**

- Skia 캔버스 (z:2): 디자인 노드 + AI 이펙트 + Selection 오버레이 (전부 렌더링)
- PixiJS 캔버스 (z:3): 투명 히트 영역 + 이벤트 처리 전용 (시각적 렌더링 없음)

#### 수정 내용

**1. 신규 파일**

- `apps/builder/src/builder/workspace/canvas/skia/selectionRenderer.ts` — Skia Selection 렌더 함수 3개 (`renderSelectionBox`, `renderTransformHandles`, `renderLasso`), SkiaDisposable 패턴

**2. SkiaOverlay.tsx**

- renderFrame에 Selection 렌더링 Phase 4-6 추가 (디자인 노드 → AI 이펙트 → Selection 순서)
- Zustand `getState()`로 매 프레임 Selection 상태 읽기 (`selectedElementIds`, `elementBounds`)
- `dragStateRef` props 추가 (라쏘 상태 전달)
- PixiJS Camera 하위 레이어 숨김: `renderable=false` → `alpha=0` 변경 (히트 테스팅 유지)

**3. PixiJS Selection 컴포넌트 (시각적 렌더링 비활성화)**

- `SelectionBox.tsx` — drawBorder 무조건 스킵 (moveArea 이벤트 영역은 유지)
- `TransformHandle.tsx` — 코너 핸들: 투명 히트 영역만 (엣지 핸들 변경 없음)
- `LassoSelection.tsx` — draw 무조건 스킵

**4. BuilderCanvas.tsx**

- `dragStateRef` 생성 및 SkiaOverlay에 전달

#### 버그 수정

- PixiJS 8.14.3 `EventBoundary._interactivePrune()` (line 317)가 `renderable=false`인 컨테이너의 전체 서브트리를 히트 테스팅에서 제외하는 문제 발견
- `renderable=false` 대신 `alpha=0` 사용으로 시각적 숨김과 이벤트 처리를 동시에 유지

#### 변경된 파일

- `apps/builder/src/builder/workspace/canvas/skia/selectionRenderer.ts` — 신규 생성
- `apps/builder/src/builder/workspace/canvas/skia/SkiaOverlay.tsx` — Selection 렌더링 통합 + alpha=0 전환
- `canvas/BuilderCanvas.tsx` — dragStateRef 전달
- `canvas/selection/SelectionBox.tsx` — Skia 모드 시각 비활성화
- `canvas/selection/TransformHandle.tsx` — Skia 모드 시각 비활성화
- `canvas/selection/LassoSelection.tsx` — Skia 모드 시각 비활성화

---

### Docs - Skill 규칙 버그 수정 반영 (2026-01-31)

#### 개요

최근 버그 수정 사항(SelectionLayer, Body borderWidth, Viewport Culling, parseBoxModel)을 `.claude/skills/composition-patterns/rules/` Skill 문서에 반영

#### 수정 내용

**1. 기존 규칙 수정 (4건)**

- `domain-o1-lookup.md` — "선택 상태 동기화" 섹션 추가: `selectedElementIds`/`selectedElementIdsSet` 삭제 시 동기화 규칙, Incorrect/Correct 예시
- `domain-component-lifecycle.md` — 삭제 패턴에 선택 상태 정리 단계(step 4) 추가: `selectedElementIds` 필터링 + `selectedElementIdsSet` 갱신
- `pixi-hybrid-layout-engine.md` — "Box Model 처리" 섹션 추가: availableWidth에 border 차감, 자식 offset padding만(Yoga border 자동 처리), content-box 기준 높이 계산, 폼 요소 treatAsBorderBox
- `perf-checklist.md` — Canvas 체크리스트에 "Viewport Culling" 4개 항목 추가: 좌표 시스템 일관성, 실시간 bounds, cull cycle 방지, overflow 자식 처리

**2. 신규 규칙 생성 (1건)**

- `pixi-viewport-culling.md` (impact: HIGH) — 스크린 좌표 기반 culling 원칙, 실시간 `getBounds()` 사용, 부모 가시성 체크로 cull/render 무한 cycle 방지 패턴

**3. SKILL.md 등록**

- HIGH > PIXI Layout 섹션에 `pixi-viewport-culling` 링크 추가

#### 변경된 파일

- `.claude/skills/composition-patterns/rules/domain-o1-lookup.md` — 선택 상태 동기화 섹션
- `.claude/skills/composition-patterns/rules/domain-component-lifecycle.md` — 삭제 시 선택 상태 정리
- `.claude/skills/composition-patterns/rules/pixi-hybrid-layout-engine.md` — Box Model 처리 섹션
- `.claude/skills/composition-patterns/rules/perf-checklist.md` — Viewport Culling 체크리스트
- `.claude/skills/composition-patterns/rules/pixi-viewport-culling.md` — 신규 생성
- `.claude/skills/composition-patterns/SKILL.md` — 규칙 링크 등록

---

### Docs - 레이아웃/버튼 버그 수정 관련 문서 동기화 (2026-01-31)

#### 개요

display/button 관련 버그 수정 사항을 `LAYOUT_REQUIREMENTS.md`(v1.29), `COMPONENT.md`(v1.13) 문서에 반영

#### 수정 내용

**1. LAYOUT_REQUIREMENTS.md**

- `calculateContentHeight` 공식 수정 — `paddingY*2 + textHeight` → 순수 `textHeight`, `MIN_BUTTON_HEIGHT`도 content-box 변환 후 비교
- `renderWithCustomEngine` availableWidth 코드 — `parseBorder` 추가, border 차감 반영, 자식 offset은 padding만 적용(Yoga 자동 처리) 주석 추가
- `parseBoxModel` 의사코드에 `treatAsBorderBox` 로직 추가 — `box-sizing: border-box` 또는 폼 요소 명시적 width/height 시 padding+border 차감
- 변경 이력 v1.29 추가

**2. COMPONENT.md**

- §4.7.4.5에 `treatAsBorderBox` 코드 및 설명 추가 — 폼 요소 자동 border-box 변환
- §4.7.4.2에 v1.13 참고 블록 추가 — parseBoxModel border-box 변환으로 이중 계산 방지 설명
- 변경 이력 v1.13 추가

#### 변경된 파일

- `docs/LAYOUT_REQUIREMENTS.md` — calculateContentHeight 공식, availableWidth border 차감, parseBoxModel treatAsBorderBox, 변경 이력 v1.29
- `docs/COMPONENT_SPEC.md` — §4.7.4.5 treatAsBorderBox, §4.7.4.2 참고, 변경 이력 v1.13

---

### Fixed - Button 레이아웃 버그 및 빌드 동기화 수정 (2026-01-31)

#### 개요

1. display:block 부모 내 width:100% 버튼과 다음 버튼 사이 불필요한 수직 여백 발생 — `calculateContentHeight` padding 이중 계산 수정
2. 다른 PC에서 `@composition/specs` 빌드 산출물 미동기화 — turbo.json dev task 의존성 추가
3. `@composition/publish` 빌드 실패 — 누락된 컴포넌트 export 및 타입 에러 수정
4. 서로 다른 명시적 높이의 inline-block 버튼 수직 정렬 실패 — `parseBoxModel` border-box 처리 추가

#### 수정 내용

**1. Button contentHeight padding 이중 계산 (핵심 버그)**

- `calculateContentHeight`가 버튼 높이에 `paddingY * 2`를 포함하여 반환
- BlockEngine이 `contentHeight + padding + border`를 계산할 때 padding 이중 합산
- 결과: BlockEngine 할당 높이(35px) > PixiButton 렌더링 높이(27px) → 8px 여백
- 수정: `contentHeight`를 텍스트 높이만 반환, `MIN_BUTTON_HEIGHT`는 content-box 기준으로 변환

**2. turbo.json dev task 의존성 누락**

- `pnpm dev` 실행 시 `@composition/specs` 빌드가 트리거되지 않음
- `dist/`가 `.gitignore`에 포함되어 git에 추적되지 않음
- 다른 PC에서 clone 후 `pnpm dev` 시 specs dist 부재로 import 실패
- 수정: dev task에 `"dependsOn": ["^build"]` 추가

**3. @composition/shared 컴포넌트 export 누락**

- `list.ts`에 Form, RangeCalendar, Pagination, Disclosure, DisclosureGroup export 누락
- `Table`은 default export이나 `export *`로 재수출 불가
- publish tsconfig의 paths가 `index.ts`(list.ts 경유)를 우선 해석하여 빌드 실패
- 수정: `list.ts`에 누락 export 추가 + `export { default as Table }` 추가

**4. @composition/publish 타입 에러**

- ComponentRegistry: Radio, Switch, Popover, Table, Pagination의 `as ComponentType<Record<string, unknown>>` 캐스팅 실패 → `as unknown as` 중간 단계 추가
- ElementRenderer: `state` 속성이 `{ get, set }` 객체로 생성되었으나 `Map<string, unknown>` 필요 → `new Map()` 사용
- ElementRenderer: `Action` 타입 config 불일치 → `as Action` 캐스팅 적용

**5. parseBoxModel border-box 처리 누락 (센터링 버그)**

- display:block 부모 내 button1(height:200px), button2(height:100px)가 inline-block으로 배치될 때 수직 센터링 미작동
- 원인: PixiButton은 명시적 height를 border-box(총 렌더링 높이)로 처리하나, `parseBoxModel`은 content-box로 취급
- BlockEngine이 content height(200) + padding(8) + border(2) = 210px를 할당 → PixiButton은 200px로 렌더링 → 10px 오차
- width:100%에서도 동일: 부모 800px → content(800) + padding(24) + border(2) = 826px → 26px 오버플로우
- Flex 경로는 `SELF_PADDING_TAGS` + `stripSelfRenderedProps()`로 자체 렌더링 요소의 padding/border를 제거하나 Block 경로에는 동등한 처리 부재
- 수정: `parseBoxModel`에 `treatAsBorderBox` 조건 추가 — 폼 요소(button, input, select)에 명시적 width/height가 있으면 border-box로 변환하여 padding/border를 차감

#### 변경된 파일

- `turbo.json` — dev task에 `"dependsOn": ["^build"]` 추가
- `packages/shared/src/components/list.ts` — Form, RangeCalendar, Pagination, Disclosure, DisclosureGroup, Table export 추가
- `apps/publish/src/registry/ComponentRegistry.tsx` — Radio, Switch, Popover, Table, Pagination 타입 캐스팅 수정
- `apps/publish/src/renderer/ElementRenderer.tsx` — state를 Map 인스턴스로 변경, Action 타입 캐스팅 수정
- `apps/builder/src/builder/workspace/canvas/layout/engines/utils.ts` — calculateContentHeight 버튼 padding 이중 계산 제거, parseBoxModel 폼 요소 border-box 변환 추가

---

### Fixed - Viewport Culling 깜빡임 및 요소 사라짐 수정 (2026-01-31)

#### 개요

캔버스 pan 이동 시 요소 깜빡임, 페이지보다 큰 자식 요소가 페이지 이동 시 사라지는 버그 수정

#### 수정 내용

**1. 좌표 시스템 불일치 → 스크린 좌표 기반 culling 전환**

- 기존: 뷰포트를 캔버스 로컬 좌표로 계산, 요소 bounds는 글로벌(스크린) 좌표로 반환 → 직접 비교 시 pan 이동량만큼 오차
- `layoutBoundsRegistry`의 stale 글로벌 좌표를 현재 panOffset으로 변환해도 저장 시점의 Camera 위치가 다르므로 틀린 결과
- 수정: 뷰포트를 스크린 좌표(화면 크기 + margin)로 계산, `container.getBounds()` 실시간 호출로 비교 → 좌표 변환 자체 불필요

**2. Cull/Render 무한 cycle**

- 요소가 culled → LayoutContainer unmount → `unregisterElement` → container 삭제
- 다음 culling: container 없음 → 재포함 → render → register → getBounds off-screen → cull → cycle 반복 = 깜빡임
- 수정: 부모 가시성 체크로 cycle 방지 — 부모가 화면에 있으면 자식은 항상 포함

**3. 부모-자식 overflow 미고려**

- CSS 기본값 `overflow: visible` — 자식이 부모 범위를 넘어서 보일 수 있음
- 버튼이 page보다 넓어도 overflow로 화면에 보이지만, culling은 각 요소를 독립 판단
- 수정: 요소가 뷰포트 밖이지만 부모가 화면에 있으면 포함 (부모 가시성 캐시로 중복 계산 방지)

#### 변경된 파일

- `apps/builder/src/builder/workspace/canvas/hooks/useViewportCulling.ts` — 스크린 좌표 기반 culling, `getElementContainer` 실시간 getBounds, 부모 가시성 체크 추가

---

### Fixed - SelectionLayer 삭제 후 (0,0) 잔존 버그 수정 (2026-01-31)

#### 개요

컴포넌트 선택 후 삭제 시 WebGL 캔버스에 SelectionLayer가 좌표 (0,0)에 남는 버그 수정

#### 수정 내용

**1. `removeElement`에서 `selectedElementIds` 미초기화 (근본 원인)**

- `removeElement`가 삭제 시 `selectedElementId`(단수)와 `selectedElementProps`만 초기화
- `selectedElementIds`(복수 배열)와 `selectedElementIdsSet`은 초기화하지 않음
- `SelectionLayer`는 `selectedElementIds`를 구독하므로 삭제된 요소 ID가 배열에 잔존
- `computeSelectionBounds`에서 삭제된 요소의 bounds 조회 실패 → fallback `{x:0, y:0}` 반환
- 수정: `selectedElementIds`에서 삭제된 요소 ID를 필터링하고 `selectedElementIdsSet`도 함께 갱신

**2. `SelectionLayer` 렌더링 가드 부재**

- `selectionBounds`가 `requestAnimationFrame` 콜백으로만 비동기 갱신됨
- 선택 해제 후 RAF 실행 전까지 stale bounds로 `SelectionBox`가 1프레임 이상 표시
- 수정: 렌더링 조건에 `selectedElements.length > 0` 가드 추가

#### 변경된 파일

- `apps/builder/src/builder/stores/utils/elementRemoval.ts` — 삭제된 요소를 `selectedElementIds`/`selectedElementIdsSet`에서 제거
- `apps/builder/src/builder/workspace/canvas/selection/SelectionLayer.tsx` — SelectionBox 렌더링 조건에 `selectedElements.length > 0` 추가

---

### Fixed - Body borderWidth 시 자식 요소 border 영역 겹침 수정 (2026-01-31)

#### 개요

display:block 부모에 borderWidth 적용 시 자식 버튼이 부모의 border 영역까지 확장되어 겹치는 버그 수정

#### 수정 내용

**`renderWithCustomEngine`에서 부모 border 미반영**

- `availableWidth` 계산 시 부모의 padding만 차감하고 border는 차감하지 않음
- 예: body width=800, borderWidth=24 → availableWidth=800 (정상: 752)
- 자식 요소가 content 영역(border 안쪽)을 초과하여 border와 겹침
- 수정: `availableWidth`/`availableHeight` 계산에 `parseBorder` 결과 차감
- 자식 offset(`left`/`top`)은 padding만 적용 — Yoga(@pixi/layout)가 `rootLayout`의 `borderWidth`를 기반으로 absolute 자식을 padding box 내에 자동 배치하므로 border offset 불필요

#### 변경된 파일

- `apps/builder/src/builder/workspace/canvas/BuilderCanvas.tsx` — `parseBorder` import 추가, `availableWidth`/`availableHeight`에 border 차감

---

### Fixed - Button borderWidth/레이아웃 이중 계산 수정 (2026-01-30)

#### 개요

WebGL 모드에서 Button borderWidth 누락, display:block 부모에서 padding 변경 시 버튼 간격 발생,
Style Panel borderWidth 0 표시 등 3건의 CSS/WebGL 정합성 버그를 수정합니다.

#### 수정 내용

1. **전 variant border/borderHover 추가** — CSS `border: 1px solid`가 모든 variant에 적용되므로 ButtonSpec에도 동일하게 border/borderHover 정의
2. **specDefaultBorderWidth=1 고정** — variant의 border 존재 여부와 무관하게 항상 1px
3. **borderHoverColor 분리** — hover/pressed 상태에서 별도 border 색상 지원
4. **parseBoxModel 폼 요소 기본값** — inline style 미지정 시 BUTTON_SIZE_CONFIG padding/border 적용
5. **calculateContentWidth 순수 텍스트 반환** — 폼 요소 padding/border를 parseBoxModel으로 분리하여 이중 계산 제거
6. **텍스트 측정 엔진 통일** — PixiButton 너비 측정을 Canvas 2D measureTextWidth로 교체
7. **createDefaultButtonProps borderWidth 기본값** — Style Panel 0 표시 해결

#### 변경된 파일

- `packages/specs/src/components/Button.spec.ts` — 전 variant border/borderHover 추가
- `packages/specs/src/renderers/PixiRenderer.ts` — getVariantColors() borderHover 반환
- `apps/builder/src/builder/workspace/canvas/ui/PixiButton.tsx` — specDefaultBorderWidth=1, borderHoverColor, Canvas 2D 측정
- `apps/builder/src/builder/workspace/canvas/layout/engines/utils.ts` — BUTTON_SIZE_CONFIG.borderWidth, parseBoxModel 기본값, calculateContentWidth 순수 텍스트, measureTextWidth export
- `apps/builder/src/types/builder/unified.types.ts` — createDefaultButtonProps style.borderWidth

---

### Docs - 구조 문서 정리 (2025-12-30)

#### 개요

Hooks 및 Store 구조 문서를 `docs/reference/`로 이동하여 문서 체계 정리

#### 이동된 파일

| 원본 경로                 | 이동 경로                           |
| ------------------------- | ----------------------------------- |
| `docs/STRUCTURE_HOOKS.md` | `docs/reference/STRUCTURE_HOOKS.md` |
| `docs/STRUCTURE_STORE.md` | `docs/reference/STRUCTURE_STORE.md` |

#### 문서 내용

- **STRUCTURE_HOOKS.md**: Builder hooks 구조 및 사용 패턴 정리
- **STRUCTURE_STORE.md**: Zustand store 구조 및 슬라이스 패턴 정리

---

### Removed - Save Mode, Preview & Overlay, Element Visualization 설정 제거 (2025-12-29)

#### 개요

WebGL Canvas 전환 및 로컬 우선(Local-first) 아키텍처 변경에 따라 더 이상 필요 없어진 설정 항목들을 제거

#### 제거된 설정

1. **Save Mode** - Supabase 실시간 동기화 제거로 불필요
2. **Preview & Overlay** - WebGL Canvas에서 오버레이 불투명도 설정 불필요
3. **Element Visualization** - iframe 기반 테두리/라벨 표시 WebGL 전환으로 불필요

#### 변경된 파일

**SettingsPanel 정리:**

- `src/builder/panels/settings/SettingsPanel.tsx` - 3개 섹션 제거, Grid & Guides와 Theme & Appearance만 유지

**SaveService 단순화:**

- `src/services/save/saveService.ts` - 항상 IndexedDB에 즉시 저장하도록 단순화
- 삭제: `isRealtimeMode`, `pendingChanges`, `saveAllPendingChanges`, `syncToCloud` 로직

**Store 상태 정리:**

- `src/builder/stores/saveMode.ts` - **파일 삭제**
- `src/builder/stores/canvasSettings.ts` - `showOverlay`, `overlayOpacity`, `showElementBorders`, `showElementLabels` 제거
- `src/builder/stores/index.ts` - `SaveModeState` 슬라이스 제거

**레거시 컴포넌트 정리:**

- `src/builder/main/BuilderCore.tsx` - `showOverlay` 조건부 렌더링 제거
- `src/builder/main/BuilderCanvas.tsx` - element visualization 로직 제거 + `@deprecated` 표시
- `src/builder/overlay/index.tsx` - `overlayOpacity` 참조 제거

#### 아키텍처 변경 배경

- **WebGL Canvas 전환**: iframe 기반 Preview에서 WebGL 기반 캔버스로 전환
- **로컬 우선 저장**: Supabase 실시간 동기화에서 IndexedDB 로컬 저장으로 변경
- **선택 시스템 통합**: WebGL SelectionLayer가 요소 테두리/라벨 표시 담당

---

### Optimized - History Panel 배치 점프 최적화 (2025-12-29)

#### 개요

History Panel에서 복구 포인트 선택 시 중간 과정이 보이는 문제 해결

#### 문제

- 히스토리 항목 클릭 시 `for` 루프로 undo/redo를 한 단계씩 호출
- 각 단계마다 UI가 업데이트되어 중간 상태가 눈에 보임

#### 해결

**1. History Manager 확장**

```typescript
// src/builder/stores/history.ts
goToIndex(targetIndex: number): { entries: HistoryEntry[]; direction: 'undo' | 'redo' } | null {
  // 현재 인덱스와 타겟 사이의 모든 엔트리를 한 번에 반환
  // 인덱스는 원자적으로 업데이트 (중간 렌더링 없음)
}
```

**2. 배치 히스토리 액션**

```typescript
// src/builder/stores/history/historyActions.ts
createGoToHistoryIndexAction() {
  // 모든 엔트리를 한 번에 적용
  // Set 기반 중복 방지로 duplicate key 에러 해결
  // Supabase 에러 try-catch 처리
}
```

**3. HistoryPanel 업데이트**

```typescript
// src/builder/panels/history/HistoryPanel.tsx
const handleJumpToIndex = useCallback(
  async (targetIndex: number) => {
    // 기존: for 루프로 undo/redo 반복
    // 변경: goToHistoryIndex(targetIndex) 단일 호출
    await goToHistoryIndex(targetIndex);
  },
  [goToHistoryIndex],
);
```

#### 수정된 파일

- `src/builder/stores/history.ts` - `goToIndex` 메서드 추가
- `src/builder/stores/history/historyActions.ts` - `createGoToHistoryIndexAction` 추가
- `src/builder/stores/elements.ts` - `goToHistoryIndex` 액션 export
- `src/builder/panels/history/HistoryPanel.tsx` - 배치 점프 사용

#### 성능 개선

| 시나리오       | 이전        | 이후       |
| -------------- | ----------- | ---------- |
| 10단계 점프    | 10회 렌더링 | 1회 렌더링 |
| 중간 상태 노출 | 눈에 보임   | 즉시 전환  |
| 사용자 경험    | 깜빡임      | 부드러움   |

---

### Fixed - PanelRegistry 중복 등록 경고 (2025-12-29)

#### 문제

HMR 또는 React StrictMode에서 패널이 중복 등록되어 콘솔 경고 발생

#### 해결

```typescript
// src/builder/panels/core/panelConfigs.ts
export function registerAllPanels() {
  if (PanelRegistry.isInitialized) {
    return; // 이미 등록된 경우 스킵
  }
  PANEL_CONFIGS.forEach((config) => {
    PanelRegistry.register(config);
  });
  PanelRegistry.markInitialized();
}
```

---

### Refactored - Keyboard Shortcuts 시스템 전면 재설계 (2025-12-29)

#### 개요

22개 파일에 분산되어 있던 키보드 단축키 시스템을 5개 핵심 파일로 통합하고, 중앙 집중식 레지스트리 패턴 적용

#### 구현 내용

**1. 중앙 설정 파일 생성**

- `src/builder/config/keyboardShortcuts.ts` - 51개 단축키 정의
- `src/builder/types/keyboard.ts` - 타입 정의

**2. 통합 레지스트리 확장**

```typescript
// src/builder/hooks/useKeyboardShortcutsRegistry.ts
// 기존 기능 + capture phase, priority, scope-aware 필터링 추가
registerShortcut({
  id: "undo",
  key: "z",
  modifiers: ["meta"],
  handler: handleUndo,
  scope: "global",
  priority: 100,
  capture: true,
  allowInInput: false,
});
```

**3. 통합 훅 생성**

- `src/builder/hooks/useGlobalKeyboardShortcuts.ts` - Undo/Redo/Zoom 통합
- `src/builder/hooks/useActiveScope.ts` - 7개 스코프 감지

**4. 개발자 도구**

- `src/builder/devtools/ShortcutDebugger.tsx` - 실시간 디버거 (개발 환경 전용)
- `src/builder/utils/detectShortcutConflicts.ts` - 충돌 감지 유틸리티

**5. 삭제된 파일**

- `src/builder/hooks/useKeyboardShortcuts.ts` → useGlobalKeyboardShortcuts.ts로 통합
- `src/builder/workspace/useZoomShortcuts.ts` → useGlobalKeyboardShortcuts.ts로 통합

#### 성능 개선

| Metric           | Before | After             | 변화 |
| ---------------- | ------ | ----------------- | ---- |
| 단축키 관련 파일 | 22개   | 5개               | -77% |
| 이벤트 리스너    | 17개   | 2개               | -88% |
| 중앙화 비율      | 45%    | 95%+              | ⬆️   |
| 스코프 시스템    | ❌     | 7개 스코프        | ✅   |
| 충돌 감지        | ❌     | ✅ 개발 시점 경고 | ✅   |

#### 관련 문서

- `docs/reference/components/KEYBOARD_SHORTCUTS.md` - 상세 설계 문서

---

### Refactored - Events Panel CSS 통합 (2025-12-29)

#### 개요

Events 패널의 3개 CSS 파일을 1개로 통합하여 중복 제거 및 유지보수성 향상

#### 구현 내용

**1. 병합된 파일**

- `events-legacy.css` (272줄) - 삭제됨
- `events.css` (1127줄) - 삭제됨
- `EventsPanel.css` (2118줄 → 2304줄) - 필수 스타일 추가

**2. 추가된 스타일 (events.css에서 이동)**

- Form Field (`.field`, `.field-label`, `.field-input`, `.field-textarea`)
- Checkbox/Switch (`.checkbox-field`, `.switch-label`)
- Select (`.select-trigger`, `.select-popover`, `.select-listbox`)
- Helper/Error (`.helper-text`, `.error-message`)
- Action Editor 전용 스타일

**3. 수정된 import**

```typescript
// src/builder/panels/events/index.ts
// 제거: import './events.css';
// 제거: import './events-legacy.css';
// EventsPanel.tsx에서 직접 import
```

#### 결과

- 파일 수: 3개 → 1개
- 총 라인: 3517줄 → 2304줄 (약 35% 감소)

---

### Refactored - Color Utilities 통합 (2025-12-29)

#### 개요

2개 위치에 분산된 색상 유틸리티를 1개 파일로 통합

#### 구현 내용

**1. 통합 파일**

- `src/utils/color/colorUtils.ts` - colord 기반 + 레거시 호환 함수

**2. 추가된 레거시 호환 함수 (12개)**

```typescript
export function hslToRgb(hsl: ColorValueHSL): ColorValueRGB;
export function rgbToHsl(rgb: ColorValueRGB): ColorValueHSL;
export function hexToRgb(hex: string): ColorValueRGB | null;
export function rgbToHex(rgb: ColorValueRGB): string;
export function hslToHex(hsl: ColorValueHSL): string;
export function hexToHsl(hex: string): ColorValueHSL | null;
export function hslToString(hsl: ColorValueHSL): string;
export function rgbToString(rgb: ColorValueRGB): string;
export function generateDarkVariant(hsl: ColorValueHSL): ColorValueHSL;
export function parseColorString(colorString: string): ColorValueHSL | null;
export function adjustLightness(hsl: ColorValueHSL, amount: number): ColorValueHSL;
export function adjustSaturationHsl(hsl: ColorValueHSL, amount: number): ColorValueHSL;
export function getSplitComplementaryColors(hsl: ColorValueHSL): [...];
```

**3. 삭제된 파일**

- `src/utils/theme/colorUtils.ts`

**4. 수정된 import (8개 파일)**

- `services/theme/FigmaService.ts`
- `services/theme/ThemeGenerationService.ts`
- `services/theme/HctThemeService.ts`
- `services/theme/ExportService.ts`
- `services/theme/FigmaPluginService.ts`
- `builder/panels/themes/components/TokenEditor.tsx`
- `utils/theme/tokenToCss.ts`
- `utils/theme/hctUtils.ts`

---

### Added - Builder Hooks Barrel Export (2025-12-29)

#### 개요

35개 builder hooks에 대한 barrel export 파일 생성

#### 구현 내용

- `src/builder/hooks/index.ts` 생성
- 카테고리별 그룹핑: Async Operations, Data Management, UI State, Keyboard & Input, Messaging, Theme, Performance, Error Handling, Utilities

---

### Optimized - StylesPanel Jotai 마이그레이션 및 성능 최적화 (2025-12-21)

#### 개요

StylesPanel의 요소 선택 시 발생하던 150-200ms handler violation을 해결하기 위한 Jotai 기반 상태 관리 마이그레이션

#### Phase 3: Jotai 기반 Fine-grained Reactivity

**1. Jotai Atoms 구현 (`atoms/styleAtoms.ts`)**

```typescript
// 35개 이상의 selectAtom 정의 (equality 체크 포함)
export const widthAtom = selectAtom(
  selectedElementAtom,
  (element) => element?.style?.width ?? 'auto',
  (a, b) => a === b  // equality 체크로 불필요한 리렌더 방지
);

// 그룹 atoms (섹션별 값 묶음)
export const transformValuesAtom = selectAtom(
  selectedElementAtom,
  (element) => ({
    width: String(element?.style?.width ?? 'auto'),
    height: String(element?.style?.height ?? 'auto'),
    top: String(element?.style?.top ?? 'auto'),
    left: String(element?.style?.left ?? 'auto'),
  }),
  (a, b) => a?.width === b?.width && a?.height === b?.height && ...
);

// StylesPanel용 atoms
export const hasSelectedElementAtom = selectAtom(...);
export const modifiedCountAtom = selectAtom(...);
export const isCopyDisabledAtom = selectAtom(...);
```

**2. Zustand-Jotai 브릿지 (`hooks/useZustandJotaiBridge.ts`)**

```typescript
export function useZustandJotaiBridge(): void {
  const setSelectedElement = useSetAtom(selectedElementAtom);
  useEffect(() => {
    const unsubscribe = useStore.subscribe((state, prevState) => {
      if (state.selectedElementId !== prevState.selectedElementId) {
        setSelectedElement(buildSelectedElement(state));
      }
    });
    return unsubscribe;
  }, [setSelectedElement]);
}
```

**3. 섹션별 Jotai 훅**

- `useTransformValuesJotai.ts` - Transform 섹션용
- `useLayoutValuesJotai.ts` - Layout 섹션용
- `useAppearanceValuesJotai.ts` - Appearance 섹션용
- `useTypographyValuesJotai.ts` - Typography 섹션용

**4. StylesPanel 최적화**

```typescript
// 이전: useSelectedElementData() 직접 사용 → 매번 리렌더
// 이후: Jotai atoms 사용 → 값이 동일하면 리렌더 없음

function StylesPanelContent() {
  const hasSelectedElement = useAtomValue(hasSelectedElementAtom);
  const modifiedCount = useAtomValue(modifiedCountAtom);
  const isCopyDisabled = useAtomValue(isCopyDisabledAtom);
  // ...
}

// AllSections, ModifiedSectionsWrapper 분리로 리렌더 격리
const AllSections = memo(function AllSections() { ... });
const ModifiedSectionsWrapper = memo(function ModifiedSectionsWrapper() { ... });
```

#### Phase 4: PropertyColor 최적화

**key={value} 패턴 유지 + Jotai 시너지**

- `key={value}` 패턴: 값 변경 시 재마운트로 상태 동기화
- Jotai selectAtom equality 체크: 동일한 값이면 리렌더 없음 → key 변경 없음 → 재마운트 없음

#### 수정된 파일

**신규 파일:**

- `src/builder/panels/styles/atoms/styleAtoms.ts` - 35+ Jotai atoms
- `src/builder/panels/styles/atoms/index.ts` - exports
- `src/builder/panels/styles/hooks/useZustandJotaiBridge.ts`
- `src/builder/panels/styles/hooks/useTransformValuesJotai.ts`
- `src/builder/panels/styles/hooks/useLayoutValuesJotai.ts`
- `src/builder/panels/styles/hooks/useAppearanceValuesJotai.ts`
- `src/builder/panels/styles/hooks/useTypographyValuesJotai.ts`

**수정된 파일:**

- `src/builder/panels/styles/StylesPanel.tsx` - Jotai atoms 사용, 컴포넌트 분리
- `src/builder/panels/styles/sections/TransformSection.tsx` - Jotai 마이그레이션
- `src/builder/panels/styles/sections/LayoutSection.tsx` - Jotai 마이그레이션
- `src/builder/panels/styles/sections/AppearanceSection.tsx` - Jotai 마이그레이션
- `src/builder/panels/styles/sections/TypographySection.tsx` - Jotai 마이그레이션
- `src/builder/panels/common/PropertyColor.tsx` - key 패턴 문서화
- `src/shared/components/ComboBox.tsx` - ClassNameOrFunction 타입 지원

#### 성능 개선

| 시나리오                      | 이전                    | 이후                   |
| ----------------------------- | ----------------------- | ---------------------- |
| 동일 스타일 요소 간 교차 선택 | 매번 리렌더 (150-200ms) | 리렌더 없음 (0ms)      |
| 스타일 값 변경                | 전체 섹션 리렌더        | 해당 섹션만 리렌더     |
| filter="all" 모드             | Zustand 구독            | Zustand 구독 완전 제거 |

---

### Added - Viewport Culling 최적화 (2025-12-20)

#### 개요

뷰포트 외부 요소를 렌더링에서 제외하여 GPU 부하를 20-40% 감소시키는 최적화 구현

#### 구현 내용

**1. useViewportCulling 훅 생성**

```typescript
// apps/builder/src/builder/workspace/canvas/hooks/useViewportCulling.ts
export function useViewportCulling({
  elements,
  layoutResult,
  zoom,
  panOffset,
  enabled = true,
}: UseViewportCullingOptions): CullingResult {
  // AABB 충돌 검사로 뷰포트 내 요소만 필터링
  const viewport = calculateViewportBounds(
    screenWidth,
    screenHeight,
    zoom,
    panOffset,
  );
  const visibleElements = elements.filter((el) =>
    isElementInViewport(el, viewport),
  );
  return { visibleElements, culledCount, totalCount, cullingRatio };
}
```

**2. ElementsLayer에 적용**

```typescript
// apps/builder/src/builder/workspace/canvas/BuilderCanvas.tsx
const { visibleElements } = useViewportCulling({
  elements: sortedElements,
  layoutResult,
  zoom,
  panOffset,
  enabled: true,
});

// visibleElements만 렌더링
{visibleElements.map((element) => (
  <ElementSprite key={element.id} element={element} ... />
))}
```

#### 성능 효과

| 시나리오                 | GPU 부하 감소 |
| ------------------------ | ------------- |
| 화면 밖 요소 50%+        | 20-40%        |
| 줌아웃 (10% 이하)        | 30-50%        |
| 대형 캔버스 (4000x4000+) | 40-60%        |

#### 특징

- **100px 마진**: 스크롤/팬 시 깜빡임 방지
- **성능 오버헤드 최소**: 단순 AABB 검사 (O(n))
- **비활성화 가능**: `enabled: false`로 끌 수 있음
- **PixiJS v8 Culler API 대신 수동 방식**: 더 간단하고 예측 가능한 동작

#### 관련 문서

- 11-canvas-resize-optimization.md

---

### Fixed - @pixi/react v8 컴포넌트 등록 및 TextField 위치 동기화 (2025-12-17)

#### 개요

@pixi/react v8 공식 패턴으로 컴포넌트 등록 방식을 개선하고, CheckboxGroup/RadioGroup의 orientation 속성 및 TextField의 레이아웃 동기화 문제를 해결

#### 문제

1. **Graphics namespace 오류**: "Graphics is not part of the PIXI namespace" 런타임 오류 발생
2. **Orientation 미작동**: CheckboxGroup/RadioGroup의 orientation (vertical/horizontal) 속성이 동작하지 않음
3. **RadioGroup 너비 불일치**: 세로 모드에서 RadioGroup의 selection 영역 너비가 PixiRadio와 다름
4. **가로 모드 너비 과대 계산**: 가로 모드에서 selection 영역이 실제 렌더링보다 넓게 설정됨
5. **TextField 위치 불일치**: TextField의 input 컨테이너가 TextField 컴포넌트와 위치가 다름
6. **TextField 크기 미측정**: LayoutEngine에 TextField용 크기 측정 함수 부재

#### 해결

**1. pixiSetup.ts - 컴포넌트 등록 개선**

```typescript
export const PIXI_COMPONENTS = {
  // pixi 접두사 컴포넌트 (JSX용)
  pixiContainer: PixiContainer,
  pixiGraphics: PixiGraphics,
  pixiSprite: PixiSprite,
  pixiText: PixiText,
  // 클래스 이름으로도 등록 (@pixi/react 내부 lookup 지원)
  Container: PixiContainer,
  Graphics: PixiGraphics,
  Sprite: PixiSprite,
  Text: PixiText,
  // ... other components
};

// 모듈 로드 시점에 즉시 등록 (렌더링 전 보장)
extend(PIXI_COMPONENTS);
```

**2. PixiCheckboxGroup/PixiRadio - Orientation 지원**

```typescript
// props.orientation 우선 체크, style.flexDirection fallback
const isHorizontal = useMemo(() => {
  const orientation = props?.orientation;
  if (orientation === "horizontal") return true;
  if (orientation === "vertical") return false;
  const flexDirection = (style as Record<string, unknown>)?.flexDirection;
  return flexDirection === "row";
}, [props?.orientation, style]);
```

**3. LayoutEngine - Orientation 및 크기 계산 동기화**

```typescript
// measureCheckboxGroupSize(), measureRadioSize() - orientation 지원 추가
// calculateRadioItemPositions(), calculateCheckboxItemPositions() - orientation 지원 추가

// RadioGroup: PixiRadio와 동일한 getRadioSizePreset() 사용
const sizeKey = (groupProps?.size as string) || "md";
const radioPreset = getRadioSizePreset(sizeKey);
const boxSize = radioPreset.radioSize;
const OPTION_GAP = radioPreset.gap;

// 가로 모드 너비: 마지막 아이템 위치 + 너비로 정확히 계산
if (isHorizontal) {
  const lastIndex = itemSizes.length - 1;
  const lastItemX = lastIndex * HORIZONTAL_ITEM_WIDTH;
  const lastItemWidth = itemSizes[lastIndex]?.width || boxSize;
  const optionsWidth = lastItemX + lastItemWidth;
  // ...
}
```

**4. PixiTextField - pixi 접두사 컴포넌트 사용 및 위치 수정**

```typescript
// 잘못된 사용 (수정 전)
<Text text={label} ... />

// 올바른 사용 (수정 후)
<pixiText text={label} style={labelStyle} x={0} y={0} />

// 위치 계산 추가
const posX = parseCSSSize(style?.left, undefined, 0);
const posY = parseCSSSize(style?.top, undefined, 0);

// 루트 컨테이너에 위치 적용
<pixiContainer x={posX} y={posY} ... >
```

**5. LayoutEngine - TextField 크기 측정 함수 추가**

```typescript
const TEXT_FIELD_TAGS = new Set(["TextField", "TextInput"]);

function isTextFieldElement(element: Element): boolean {
  return TEXT_FIELD_TAGS.has(element.tag);
}

function measureTextFieldSize(element, _style): { width; height } | null {
  const preset = getTextFieldSizePreset(sizeKey);
  const width = (props?.width as number) || 240;
  const labelHeight = label ? preset.labelFontSize + preset.gap : 0;
  const descriptionHeight = hasDescription
    ? preset.descriptionFontSize + preset.gap
    : 0;
  const totalHeight = labelHeight + preset.height + descriptionHeight;
  return { width, height: totalHeight };
}

// createYogaNode에서 호출
if (isTextFieldElement(element) && (!hasExplicitWidth || !hasExplicitHeight)) {
  const measuredSize = measureTextFieldSize(element, style);
  // ...
}
```

#### 수정된 파일

- `apps/builder/src/builder/workspace/canvas/pixiSetup.ts` - 클래스 이름 등록 + 모듈 레벨 extend()
- `apps/builder/src/builder/workspace/canvas/ui/PixiCheckboxGroup.tsx` - orientation 지원
- `apps/builder/src/builder/workspace/canvas/ui/PixiRadio.tsx` - orientation 지원
- `apps/builder/src/builder/workspace/canvas/ui/PixiTextField.tsx` - pixi 접두사 컴포넌트 + 위치 수정
- `apps/builder/src/builder/workspace/canvas/layout/LayoutEngine.ts` - orientation 동기화 + TextField 측정

---

### Added - CheckboxGroup/RadioGroup Selection Area 및 Label 지원 (2025-12-16)

#### 개요

CheckboxGroup 및 RadioGroup 컴포넌트의 선택 영역과 그룹 라벨을 지원하여 선택/편집 UX 개선

#### 문제

1. **RadioGroup 크기 미측정**: RadioGroup이 width/height 값이 없어 선택 영역이 표시되지 않음
2. **CheckboxGroup 라벨 미지원**: RadioGroup은 그룹 라벨을 지원하지만 CheckboxGroup은 미지원
3. **렌더링 중복**: CheckboxGroup과 자식 Checkbox가 각각 별도로 렌더링되어 겹침 발생
4. **자식 아이템 선택 영역 불일치**: CheckboxGroup/RadioGroup 내부 자식 아이템의 위치/크기가 정상적이지 않음
5. **Selected 상태 미반영**: 자식 아이템의 `isSelected` 프로퍼티 변경 시 시각적 상태가 업데이트되지 않음

#### 해결

**1. LayoutEngine 확장**

```typescript
// CHECKBOX_RADIO_TAGS 수정: Radio → RadioGroup
const CHECKBOX_RADIO_TAGS = new Set([
  "Checkbox",
  "CheckboxGroup",
  "RadioGroup",
]);

// 새 함수 추가
function isCheckboxItemElement(element, elements): boolean; // CheckboxGroup 자식 판별
function measureCheckboxItemSize(element, elements): { width; height }; // 자식 아이템 크기 측정
function measureCheckboxGroupSize(element, elements): { width; height }; // 그룹 크기 측정 (라벨 포함)
function calculateCheckboxItemPositions(pageElements, positions): void; // 자식 위치 계산
```

**2. PixiCheckboxGroup 신규 생성**

- PixiRadio 패턴 기반으로 전체 구현
- 그룹 라벨 지원 (상단에 bold 텍스트)
- props.options 또는 자식 Checkbox 요소에서 옵션 파싱
- 선택된 값 배열 관리

**3. PixiCheckboxItem 신규 생성**

- CheckboxGroup 자식 Checkbox용 투명 hit area 컴포넌트
- 시각적 렌더링은 부모 CheckboxGroup이 담당
- 선택을 위한 이벤트 영역만 제공 (`eventMode="static"`, `alpha: 0`)

**4. ElementSprite 분기 처리**

```typescript
// 태그 분리
const UI_CHECKBOX_GROUP_TAGS = new Set(['CheckboxGroup']);
const UI_CHECKBOX_ITEM_TAGS = new Set(['Checkbox', 'CheckBox', 'Switch', 'Toggle']);

// 조건부 렌더링
case 'checkboxItem':
  if (isCheckboxInGroup) {
    return <PixiCheckboxItem ... />;  // 투명 hit area
  }
  return <PixiCheckbox ... />;  // 독립 체크박스
```

**5. Selected 상태 연동**

```typescript
// PixiRadio.tsx - 자식 Radio의 isSelected 확인
const selectedChild = childRadios.find((radio) => {
  const radioProps = radio.props as Record<string, unknown> | undefined;
  return Boolean(
    radioProps?.isSelected ||
    radioProps?.checked ||
    radioProps?.defaultSelected,
  );
});

// PixiCheckboxGroup.tsx - 자식 Checkbox의 isSelected 확인
const selectedFromChildren = childCheckboxes
  .filter((checkbox) => {
    const checkboxProps = checkbox.props as Record<string, unknown> | undefined;
    return Boolean(
      checkboxProps?.isSelected ||
      checkboxProps?.checked ||
      checkboxProps?.defaultSelected,
    );
  })
  .map((checkbox) => String(checkboxProps?.value || checkbox.id));
```

#### 아키텍처 패턴

**투명 Hit Area 패턴:**

- 부모 컴포넌트(CheckboxGroup/RadioGroup)가 시각적 렌더링 담당
- 자식 아이템(PixiCheckboxItem/PixiRadioItem)은 투명 hit area만 제공
- 레이아웃 엔진이 자식 위치 계산하여 `layoutPosition` 전달

**Selected 상태 우선순위:**

1. 그룹 props의 `value`/`selectedValue`/`selectedValues`
2. 자식 아이템의 `isSelected`/`checked`/`defaultSelected`
3. options 배열의 `checked` 필드

**신규/수정 파일:**

- `apps/builder/src/builder/workspace/canvas/ui/PixiCheckboxGroup.tsx` - 신규 생성
- `apps/builder/src/builder/workspace/canvas/ui/PixiCheckboxItem.tsx` - 신규 생성
- `apps/builder/src/builder/workspace/canvas/ui/PixiRadio.tsx` - selectedValue 로직 수정
- `apps/builder/src/builder/workspace/canvas/ui/index.ts` - export 추가
- `apps/builder/src/builder/workspace/canvas/sprites/ElementSprite.tsx` - 분기 처리 추가
- `apps/builder/src/builder/workspace/canvas/layout/LayoutEngine.ts` - 크기/위치 계산 함수 추가
- `apps/builder/src/builder/workspace/canvas/BuilderCanvas.tsx` - 필터 로직 수정

---

### Added - Zoom ComboBox 컨트롤러 (2025-12-15)

#### 개요

줌 컨트롤러의 `<span>비율%</span>`을 React Aria ComboBox로 변경하여 프리셋 선택 및 커스텀 입력 지원

#### 변경 내용

- **ZOOM_PRESETS**: 25%, 50%, 75%, 100%, 125%, 150%, 200%, 300%, 400%, 500%
- **ComboBox 기능**:
  - 프리셋 선택 (드롭다운)
  - 커스텀 값 입력 (숫자 직접 입력)
  - Enter 키로 적용
  - Blur 시 자동 적용

**수정된 파일:**

- `src/builder/workspace/Workspace.tsx` - Zoom ComboBox 구현
- `src/builder/workspace/Workspace.css` - ComboBox 스타일

---

### Changed - 캔버스 페이지 경계선 개선 (2025-12-15)

#### 개요

캔버스 페이지 외곽선을 iframe Preview와 동일한 스타일로 통일

#### 변경 내용

- **선 두께**: 2px → 1px
- **색상**: 하드코딩 → `--outline-variant` CSS 변수 사용
- **테마 연동**: MutationObserver로 테마 변경 시 실시간 반영

**신규 함수:**

- `getOutlineVariantColor()` in `cssVariableReader.ts`

**수정된 파일:**

- `apps/builder/src/builder/workspace/canvas/BuilderCanvas.tsx` - CanvasBounds 컴포넌트
- `apps/builder/src/builder/workspace/canvas/utils/cssVariableReader.ts` - 색상 함수 추가

---

### Refactored - 선택 테두리 통합 (SelectionBox) (2025-12-15)

#### 개요

14개 UI 컴포넌트에서 중복된 선택 테두리 코드를 제거하고 공통 SelectionBox로 통합

#### 문제

- 각 컴포넌트가 자체 선택 테두리 구현 (스타일 불일치)
- Button: roundRect, width 2, offset -2
- SelectionBox: rect, width 1, offset 0

#### 해결

모든 컴포넌트에서 자체 선택 테두리 코드 제거, SelectionBox 단일 사용

**제거된 코드 (14개 파일):**

- `PixiButton.tsx` - drawSelection 콜백 및 JSX
- `PixiFancyButton.tsx` - selection useEffect
- `PixiInput.tsx` - selection useEffect
- `PixiList.tsx` - selection useEffect
- `PixiMaskedFrame.tsx` - selection useEffect
- `PixiProgressBar.tsx` - selection useEffect
- `PixiScrollBox.tsx` - selection useEffect
- `PixiSelect.tsx` - selection useEffect
- `PixiSlider.tsx` - selection useEffect
- `PixiSwitcher.tsx` - selection useEffect
- `PixiCheckbox.tsx` - selection layoutContainer
- `PixiRadio.tsx` - selection layoutContainer
- `TextSprite.tsx` - isSelected from drawBackground
- `ImageSprite.tsx` - isSelected from drawBackground/drawOverlay

---

### Added - Figma 스타일 줌 독립적 UI (2025-12-15)

#### 개요

Figma처럼 줌에 관계없이 선택 박스, 핸들, 라쏘, 경계선이 화면상 일정한 크기 유지

#### 문제

- 줌 200%: 선택 테두리가 2px로 보임 (두꺼움)
- 줌 50%: 선택 테두리가 0.5px로 보임 (희미함)
- Transform 핸들도 줌에 따라 크기 변동

#### 해결

역-스케일링 방식 적용 (`1/zoom`)

```typescript
// 줌 200%일 때: 캔버스 단위 0.5px → 화면상 1px
// 줌 50%일 때: 캔버스 단위 2px → 화면상 1px
const strokeWidth = 1 / zoom;

// 핸들 크기도 동일하게 적용
const adjustedSize = HANDLE_SIZE / zoom; // HANDLE_SIZE = 6px
```

#### pixelLine vs 역-스케일링

| 방식                    | 장점                                 | 단점                        |
| ----------------------- | ------------------------------------ | --------------------------- |
| **pixelLine** (v8.6.0+) | 내장 옵션                            | 모든 상황에서 완벽하지 않음 |
| **역-스케일링**         | 수학적 정확, 핸들 크기에도 적용 가능 | 수동 계산 필요              |

→ 역-스케일링 방식 채택

**적용 대상:**
| 요소 | 줌 50% | 줌 100% | 줌 200% |
|------|--------|---------|---------|
| 선택 테두리 | 1px | 1px | 1px |
| Transform 핸들 | 6px | 6px | 6px |
| 라쏘 테두리 | 1px | 1px | 1px |
| 페이지 경계 | 1px | 1px | 1px |

**수정된 파일:**

- `apps/builder/src/builder/workspace/canvas/selection/SelectionLayer.tsx` - zoom prop 추가
- `apps/builder/src/builder/workspace/canvas/selection/SelectionBox.tsx` - zoom prop, strokeWidth 계산
- `apps/builder/src/builder/workspace/canvas/selection/TransformHandle.tsx` - zoom prop, adjustedSize 계산
- `apps/builder/src/builder/workspace/canvas/selection/LassoSelection.tsx` - zoom prop, strokeWidth 계산
- `apps/builder/src/builder/workspace/canvas/BuilderCanvas.tsx` - CanvasBounds, SelectionLayer에 zoom 전달

---

### Refactored - PixiCheckbox Graphics 기반 (2025-12-15)

#### 개요

`@pixi/layout` 기반에서 Graphics 직접 렌더링으로 변경

#### 문제

- `layoutContainer`의 `borderWidth`, `borderColor` 등 CSS 속성이 제대로 렌더링되지 않음
- 체크박스가 사각형만 보이고 체크마크가 표시되지 않음

#### 해결

Graphics로 직접 그리기 (PixiButton 패턴 적용)

```typescript
// 체크마크 - 선으로 직접 그리기
g.setStrokeStyle({ width: 2.5, color: 0xffffff, cap: "round", join: "round" });
g.moveTo(checkStartX, checkStartY);
g.lineTo(checkMidX, checkMidY);
g.lineTo(checkEndX, checkEndY);
g.stroke();
```

**개선사항:**

- 체크마크를 "✓" 텍스트 대신 선으로 직접 그리기 (더 선명)
- 테두리, 배경색, 체크마크 모두 Graphics로 렌더링
- 라벨 텍스트는 pixiText 사용

**수정된 파일:**

- `apps/builder/src/builder/workspace/canvas/ui/PixiCheckbox.tsx` - 전체 리팩토링

---

### Refactored - PixiRadio Graphics 기반 (2025-12-15)

#### 개요

`@pixi/layout` 기반에서 Graphics 직접 렌더링으로 변경

#### 문제

- `props.options` 배열이 없으면 아무것도 렌더링되지 않음
- `layoutContainer` 렌더링 이슈

#### 해결

Graphics로 직접 그리기 + 기본 옵션 추가

```typescript
// 기본 옵션 (options가 없을 때 placeholder)
const DEFAULT_OPTIONS: RadioOption[] = [
  { value: "option1", label: "Option 1" },
  { value: "option2", label: "Option 2" },
];
```

**개선사항:**

- Graphics로 라디오 원 직접 그리기
- 선택 시 내부 dot 표시
- RadioItem 서브컴포넌트로 분리 (메모이제이션 최적화)
- 기본 옵션으로 항상 무언가 표시됨

**수정된 파일:**

- `apps/builder/src/builder/workspace/canvas/ui/PixiRadio.tsx` - 전체 리팩토링

---

### Added - WebGL Canvas 텍스트 선명도 개선 (2025-12-15)

#### 개요

Figma와 유사하게 줌 레벨에 따라 텍스트를 재래스터라이즈하여 선명도 개선

#### 문제

- PixiJS Canvas 텍스트가 Figma 대비 흐릿하게 렌더링됨
- 줌 인 시 텍스트가 스케일되어 픽셀화 발생
- `roundPixels`, `resolution` 설정만으로는 부족

#### 해결 (다층 접근)

**1. Application 설정 개선**

```typescript
<Application
  resolution={Math.max(window.devicePixelRatio || 1, 2)}  // 최소 2배
  roundPixels={true}  // 서브픽셀 흐림 방지
  // ...
/>
```

**2. 동적 폰트 크기 조절 (Figma 방식)**

```typescript
// useCrispText.ts - 줌 레벨에 따른 해상도 배율
function calculateMultiplier(zoom: number): number {
  if (zoom <= 1) return 1;
  if (zoom <= 2) return 2;
  if (zoom <= 3) return 3;
  return 4; // 최대 4x
}

// TextSprite/PixiButton에서 사용
const { textScale, multiplier } = useCrispText(baseFontSize);

// fontSize를 높이고, scale을 낮춰 시각적 크기 유지
const scaledFontSize = baseFontSize * multiplier;
textView.scale.set(textScale); // 1 / multiplier
```

#### 동작 원리

```
┌─────────────────────────────────────────────────────────────┐
│                    동적 폰트 크기 조절                        │
├─────────────────────────────────────────────────────────────┤
│  줌 1x: fontSize 16px × 1 = 16px, scale 1.0                 │
│  줌 2x: fontSize 16px × 2 = 32px, scale 0.5                 │
│  줌 3x: fontSize 16px × 3 = 48px, scale 0.33                │
├─────────────────────────────────────────────────────────────┤
│  결과: 텍스트가 항상 현재 줌에 맞는 해상도로 렌더링            │
│  → 확대해도 픽셀화 없이 선명함                               │
└─────────────────────────────────────────────────────────────┘
```

#### PixiJS 공식 권장 사항 준수

| 권장                          | 적용                      |
| ----------------------------- | ------------------------- |
| `roundPixels={true}`          | ✅                        |
| `resolution` 2배 이상         | ✅                        |
| 스케일 업 금지, fontSize 조절 | ✅                        |
| BitmapText + SDF              | 미적용 (필요시 추가 가능) |

**신규 파일:**

- `apps/builder/src/builder/workspace/canvas/hooks/useCrispText.ts`

**수정된 파일:**

- `apps/builder/src/builder/workspace/canvas/BuilderCanvas.tsx` - resolution, roundPixels 설정
- `apps/builder/src/builder/workspace/canvas/sprites/TextSprite.tsx` - 동적 폰트 크기
- `apps/builder/src/builder/workspace/canvas/ui/PixiButton.tsx` - 동적 폰트 크기

---

### Added - WebGL Canvas 동적 테마 색상 지원 (2025-12-15)

#### 개요

WebGL Canvas의 PixiButton이 테마 변경에 실시간으로 반응하도록 개선

#### 문제

- 기존 PixiButton은 하드코딩된 색상 사용 (`VARIANT_COLORS` 상수)
- 테마 변경 시 (Light ↔ Dark) WebGL 버튼 색상이 변하지 않음
- iframe Preview는 CSS 변수로 테마 변경 적용되지만 WebGL은 불변

#### 해결

CSS 변수를 런타임에 읽어 PixiJS hex 값으로 변환하는 시스템 구현

**1. cssVariableReader.ts (신규)**

```typescript
// CSS 변수에서 M3 토큰 읽기
export function getM3ButtonColors(): M3ButtonColors {
  const primary = cssColorToHex(getCSSVariable('--primary'), FALLBACK_COLORS.primary);
  // ... 모든 M3 색상 토큰 읽기
  return {
    primaryBg: primary,
    primaryBgHover: mixWithBlack(primary, 92),  // M3 hover = 92% original + 8% black
    primaryBgPressed: mixWithBlack(primary, 88), // M3 pressed = 88% original + 12% black
    // ...
  };
}

// variant별 색상 매핑
export function getVariantColors(variant: string, colors: M3ButtonColors) {
  switch (variant) {
    case 'primary': return { bg: colors.primaryBg, bgHover: colors.primaryBgHover, ... };
    // outline/ghost는 bgAlpha: 0 (투명 배경)
  }
}
```

**2. useThemeColors.ts (신규)**

```typescript
// MutationObserver로 테마 변경 감지
export function useThemeColors(): M3ButtonColors {
  const [colors, setColors] = useState(() => getM3ButtonColors());

  useEffect(() => {
    const observer = new MutationObserver(() => {
      requestAnimationFrame(() => setColors(getM3ButtonColors()));
    });

    // data-theme, data-builder-theme, class 속성 감시
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme', 'data-builder-theme', 'class'],
    });

    // prefers-color-scheme 미디어 쿼리도 감시
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', handleMediaChange);

    return () => { observer.disconnect(); mediaQuery.removeEventListener(...); };
  }, []);

  return colors;
}
```

**3. PixiButton.tsx 수정**

```typescript
// 기존: 하드코딩된 색상
const VARIANT_COLORS = { primary: { bg: 0x6750a4, ... }, ... }; // 제거

// 변경: 동적 테마 색상
const themeColors = useThemeColors();
const variantColors = useMemo(() => {
  return getVariantColors(props?.variant || 'default', themeColors);
}, [props?.variant, themeColors]);
```

#### 동작 방식

```
┌─────────────────────────────────────────────────────────────┐
│                    테마 변경 플로우                           │
├─────────────────────────────────────────────────────────────┤
│  1. 테마 토글 클릭                                           │
│     ↓                                                       │
│  2. document.documentElement에 data-theme="dark" 설정       │
│     ↓                                                       │
│  3. MutationObserver 감지 (useThemeColors)                  │
│     ↓                                                       │
│  4. getM3ButtonColors() 호출 → CSS 변수 다시 읽기            │
│     ↓                                                       │
│  5. React state 업데이트 → PixiButton 리렌더링               │
│     ↓                                                       │
│  6. FancyButton Graphics 재생성 (새 색상 적용)               │
└─────────────────────────────────────────────────────────────┘
```

#### M3 Hover/Pressed 색상 계산

```typescript
// M3 Design System 표준
// Hover: 원본 색상 92% + black 8%
function mixWithBlack(color: number, percent: number): number {
  const ratio = percent / 100;
  const r = Math.round(((color >> 16) & 0xff) * ratio);
  const g = Math.round(((color >> 8) & 0xff) * ratio);
  const b = Math.round((color & 0xff) * ratio);
  return (r << 16) | (g << 8) | b;
}

// Outline/Ghost Hover: primary 8% + white 92%
function mixWithWhite(color: number, percent: number): number {
  const whiteRatio = 1 - percent / 100;
  // ...
}
```

**신규 파일:**

- `apps/builder/src/builder/workspace/canvas/utils/cssVariableReader.ts`
- `apps/builder/src/builder/workspace/canvas/hooks/useThemeColors.ts`

**수정된 파일:**

- `apps/builder/src/builder/workspace/canvas/ui/PixiButton.tsx`

---

### Fixed - WebGL Canvas Button Size Props (2025-12-15)

#### 문제

- Button 컴포넌트의 `size` prop (xs, sm, md, lg, xl)이 WebGL Canvas에서 적용되지 않음
- 폰트 크기는 변경되지만 버튼 크기(패딩)가 변하지 않음
- Text 컴포넌트는 정상 작동

#### 원인 분석

**아키텍처 설계**: composition는 `variant`/`size`로 일관성을, `style:{}`로 커스터마이징을 담당

```
┌─────────────────────────────────────────────────────────────┐
│                    composition 스타일 시스템                      │
├──────────────────────┬──────────────────────────────────────┤
│   일관성 (Semantic)   │   커스터마이징 (Inline)               │
│   variant, size      │   style: { ... }                     │
├──────────────────────┼──────────────────────────────────────┤
│   디자인 시스템 준수    │   개별 요소 세부 조정                 │
│   브랜드 일관성 유지    │   특수 케이스 대응                    │
├──────────────────────┴──────────────────────────────────────┤
│              우선순위: style > variant/size                  │
└─────────────────────────────────────────────────────────────┘
```

**문제 흐름:**

1. `LayoutEngine`이 Button 크기 계산 시 `parsePadding(style)`만 사용
2. `style`에 padding이 없으면 (size prop으로 결정되기 때문) 0으로 계산
3. `layoutPosition`이 ElementSprite로 전달되어 `style.width/height` 오버라이드
4. PixiButton의 auto 크기 계산이 무시됨

**결론:** 라이브러리 버그 아님, **우리 코드의 semantic props 미처리**

#### 해결

**LayoutEngine.ts 수정:**

```typescript
// 1. Button Size Presets 추가 (Button.css와 동기화)
const BUTTON_SIZE_PRESETS: Record<string, ButtonSizePreset> = {
  xs: { fontSize: 10, paddingX: 8, paddingY: 2 },
  sm: { fontSize: 14, paddingX: 12, paddingY: 4 },
  md: { fontSize: 16, paddingX: 24, paddingY: 8 },
  lg: { fontSize: 18, paddingX: 32, paddingY: 12 },
  xl: { fontSize: 20, paddingX: 40, paddingY: 16 },
};

// 2. measureTextSize() 함수에서 Button size prop 처리
function measureTextSize(element, style) {
  const isButton = element.tag === "Button" || element.tag === "SubmitButton";
  const buttonSize = isButton ? getButtonSizePadding(element) : null;

  // fontSize: inline style > size preset > 기본값
  const fontSize = parseCSSValue(style?.fontSize, buttonSize?.fontSize ?? 16);

  // padding: inline style 있으면 우선, 없으면 size preset 사용
  if (buttonSize && !hasInlinePadding) {
    paddingLeft = buttonSize.paddingX;
    paddingRight = buttonSize.paddingX;
    paddingTop = buttonSize.paddingY;
    paddingBottom = buttonSize.paddingY;
  }
}
```

#### 우선순위 동작

| 설정                                       | 적용되는 패딩 | 담당                  |
| ------------------------------------------ | ------------- | --------------------- |
| `size="md"`                                | 8px 24px      | 일관성 (semantic)     |
| `size="md"` + `style: { padding: '20px' }` | 20px          | 커스터마이징 (inline) |
| `size="lg"`                                | 12px 32px     | 일관성 (semantic)     |

**수정된 파일:**

- `apps/builder/src/builder/workspace/canvas/layout/LayoutEngine.ts` - Button size prop 지원

---

### Fixed - WebGL Canvas Selection System (2025-12-14)

#### 라쏘 선택 좌표 수정

- **문제**: Shift+드래그 라쏘 선택 시 마우스 위치와 선택 영역 불일치
- **원인**: 화면 좌표를 줌/팬 변환 없이 직접 사용
- **해결**: `screenToCanvas()` 좌표 변환 함수 추가

```typescript
// BuilderCanvas.tsx - ClickableBackground
const screenToCanvas = useCallback(
  (screenX: number, screenY: number) => {
    return {
      x: (screenX - panOffset.x) / zoom,
      y: (screenY - panOffset.y) / zoom,
    };
  },
  [zoom, panOffset],
);
```

#### Cmd+클릭 다중 선택 지원

- **문제**: PixiJS 이벤트에서 modifier 키(metaKey, ctrlKey, shiftKey) 전달 안됨
- **해결**: PixiJS v8 FederatedPointerEvent 구조에 맞춰 modifier 키 추출

```typescript
// 모든 Sprite 컴포넌트에 적용된 패턴
const handleClick = useCallback(
  (e: unknown) => {
    const pixiEvent = e as {
      metaKey?: boolean;
      shiftKey?: boolean;
      ctrlKey?: boolean;
      nativeEvent?: MouseEvent | PointerEvent;
    };

    // PixiJS v8: 직접 속성 우선, nativeEvent 폴백
    const metaKey =
      pixiEvent?.metaKey ?? pixiEvent?.nativeEvent?.metaKey ?? false;
    const shiftKey =
      pixiEvent?.shiftKey ?? pixiEvent?.nativeEvent?.shiftKey ?? false;
    const ctrlKey =
      pixiEvent?.ctrlKey ?? pixiEvent?.nativeEvent?.ctrlKey ?? false;

    onClick?.(element.id, { metaKey, shiftKey, ctrlKey });
  },
  [element.id, onClick],
);
```

#### PixiButton 이벤트 처리 개선

- **문제**: `FancyButton.onPress.connect()`가 modifier 키를 제공하지 않음
- **해결**: `FancyButton.eventMode = 'none'` 설정 + 투명 히트 영역으로 클릭 처리

#### GridLayer 렌더 순서 수정

- **문제**: 그리드가 표시되지 않음 (showGrid: true 상태에서도)
- **원인**: GridLayer가 BodyLayer보다 먼저 렌더링되어 불투명 배경에 가려짐
- **해결**: 렌더 순서 변경 - BodyLayer → GridLayer (그리드가 배경 위에 표시)

```typescript
// BuilderCanvas.tsx - Camera Container 렌더 순서
<pixiContainer label="Camera">
  <BodyLayer ... />      {/* 1. Body 배경 (최하단) */}
  <GridLayer ... />      {/* 2. 그리드 (배경 위) */}
  <CanvasBounds ... />   {/* 3. 경계선 */}
  <ElementsLayer ... />  {/* 4. 요소들 */}
  <SelectionLayer ... /> {/* 5. 선택 (최상단) */}
</pixiContainer>
```

**수정된 파일:**

- `BuilderCanvas.tsx` - 라쏘 좌표 변환, GridLayer/BodyLayer 렌더 순서 변경
- `BoxSprite.tsx`, `TextSprite.tsx`, `ImageSprite.tsx` - modifier 키 지원
- `PixiButton.tsx` - 투명 히트 영역 + eventMode 설정
- `BodyLayer.tsx` - modifier 키 지원
- `GridLayer.tsx` - PixiJS v8 rect+fill 방식으로 그리드 렌더링

---

### Updated - WebGL Canvas Phase 12 (2025-12-12)

- **레이아웃 안전성**: `MAX_LAYOUT_DEPTH`와 `visited` 가드로 순환 트리 무한 재귀 방지, 페이지 단위 레이아웃 캐싱으로 Elements/Selection 중복 계산 제거.
- **선택/정렬 성능**: 깊이 맵 메모이즈로 O(n²) 정렬 제거, SelectionLayer가 전달 레이아웃을 재사용.
- **팬/줌 입력 최적화**: 팬 드래그를 `requestAnimationFrame`으로 스로틀링 후 종료 시 플러시, 휠 줌 로그 스팸 제거.

### Added - WebGL Canvas Phase 12 (2025-12-12)

#### B3.1 DOM-like Layout Calculator

Canvas에서 DOM 레이아웃 방식 재현:

- **Block Layout**: 수직 스택, margin/padding, position: relative/absolute
- **Flexbox Layout**: flexDirection, justifyContent, alignItems, gap
- 안전 기능: MAX_LAYOUT_DEPTH, 순환 참조 감지

**파일:** `apps/builder/src/builder/workspace/canvas/layout/layoutCalculator.ts`

#### B3.2 Canvas Resize Handler (Figma-style)

패널 열기/닫기 시 캔버스 깜빡임 문제 해결:

| 방식                     | 깜빡임       | 성능 |
| ------------------------ | ------------ | ---- |
| key prop remount         | ❌ 검은 화면 | 느림 |
| 직접 resize              | ❌ 깜빡임    | 빠름 |
| CSS Transform + Debounce | ✅ 없음      | 빠름 |

```typescript
// 애니메이션 중: CSS transform scale (즉시)
canvas.style.transform = `scale(${scaleX}, ${scaleY})`;

// 150ms debounce 후: 실제 WebGL resize
app.renderer.resize(width, height);
```

**파일:** `apps/builder/src/builder/workspace/canvas/BuilderCanvas.tsx:77-146`

#### B3.3 Selection System 개선

- SelectionBox: 컨테이너 요소도 테두리 표시
- Transform 핸들: 단일 선택 시 항상 표시 (컨테이너 포함)
- Move 영역: 컨테이너는 비활성화 (자식 클릭 허용)

**파일:** `apps/builder/src/builder/workspace/canvas/selection/SelectionLayer.tsx`

---

### Added - Performance Optimization Track A/B/C Complete (2025-12-11)

엔터프라이즈급 10,000개+ 요소, 24시간+ 안정 사용을 위한 성능 최적화 완료.

#### Track A: 즉시 실행 ✅

**A1. Panel Gateway 패턴 적용**

- 비활성 패널에서 훅 실행 방지로 CPU 최소화
- 적용 위치: `PropertiesPanel.tsx:241-247`, `StylesPanel.tsx:44-50`, `ComponentsPanel.tsx:27-33`

```typescript
export function Panel({ isActive }: PanelProps) {
  if (!isActive) {
    return null;  // ✅ Gateway 패턴
  }
  return <PanelContent />;
}
```

**A2. React Query 네트워크 최적화**

- Request Deduplication (내장 기능)
- 캐시 관리 (staleTime: 5분, gcTime: 30분)
- 설정 위치: `src/main.tsx`, `src/builder/hooks/useDataQueries.ts`

#### Track B: WebGL Builder ✅

**B1. WebGL Canvas 구축**

- 메인 캔버스: `apps/builder/src/builder/workspace/canvas/BuilderCanvas.tsx`
- Sprite 시스템: `sprites/` (BoxSprite, TextSprite, ImageSprite)
- Selection 시스템: `selection/` (SelectionBox, TransformHandle, LassoSelection)
- Grid/Zoom/Pan: `grid/` (GridLayer, useZoomPan)

**B2. Publish App 분리**

- 모노레포: `pnpm-workspace.yaml`
- 공통 코드: `packages/shared/src/`
- Publish App: `packages/publish/src/`

#### Track C: 검증 및 CI ✅

- Seed Generator: `scripts/lib/seedRandom.ts` (Mulberry32 PRNG)
- Long Session Test: `scripts/long-session-test.ts`
- GitHub Actions: `.github/workflows/performance-test.yml`
- SLO Verification: `scripts/verify-slo.ts`

#### 폐기된 항목

| 항목                    | 이유                           |
| ----------------------- | ------------------------------ |
| Phase 4 Delta Sync      | WebGL에서 postMessage 제거됨   |
| requestDeduplication.ts | React Query로 대체             |
| QueryPersister.ts       | React Query 메모리 캐시로 충분 |

#### 관련 문서

- [docs/performance/README.md](README.md)
- docs/performance/task.md
- docs/performance/10-webgl-builder-architecture.md

---

### Added - DATA_SYNC_ARCHITECTURE Phase 8-10 (2025-12-07)

#### Phase 8: Auto Refresh 기능

PropertyDataBinding에 자동 갱신 기능 추가

**새 타입:**

```typescript
export type RefreshMode = "manual" | "onMount" | "interval";

export interface DataBindingValue {
  source: "dataTable" | "api" | "variable" | "route";
  name: string;
  path?: string;
  defaultValue?: unknown;
  refreshMode?: RefreshMode; // 새로 추가
  refreshInterval?: number; // 새로 추가 (ms)
}
```

**UI 추가:**

- 갱신 모드 선택 (수동/마운트 시/주기적)
- 주기적 갱신 시 간격 설정 입력

**파일 수정:**

- `src/builder/panels/common/PropertyDataBinding.tsx`
- `src/builder/panels/common/PropertyDataBinding.css`
- `src/builder/hooks/useCollectionData.ts`

#### Phase 9: Error Handling UI 개선

Collection 컴포넌트용 로딩/에러/빈 상태 UI 컴포넌트 추가

**새 컴포넌트:**

- `CollectionLoadingState` - 로딩 스피너
- `CollectionErrorDisplay` - 에러 메시지 + 재시도 버튼
- `CollectionEmptyState` - 빈 데이터 표시
- `CollectionState` - 통합 상태 컴포넌트

**파일 추가:**

- `src/shared/components/CollectionErrorState.tsx`
- `src/shared/components/CollectionErrorState.css`

**ListBox 업데이트:**

- 가상화 렌더링에 로딩/에러 상태 통합
- 재시도 버튼 연동

#### Phase 10: Cache System 구현

API 호출 결과 캐싱으로 중복 요청 방지 및 성능 향상

**새 파일:** `src/builder/hooks/useCollectionDataCache.ts`

**기능:**

- TTL(Time-to-Live) 기반 자동 만료 (기본 5분)
- LRU(Least Recently Used) 정리
- 최대 100개 캐시 항목 제한
- 캐시 키 생성 (`createCacheKey`)
- 수동 캐시 무효화 (`invalidate`, `invalidateMatching`, `clear`)

**API:**

```typescript
const cache = new CollectionDataCache({ ttl: 60000, maxEntries: 100 });
cache.set("key", data);
cache.get<T>("key");
cache.invalidate("key");
cache.invalidateMatching(/pattern/);
cache.clear();
```

**useCollectionData 통합:**

- API 요청 전 캐시 확인
- 응답 데이터 캐시 저장
- `reload()` 시 캐시 무효화
- `clearCache()` 함수 제공

---

### Fixed - useCollectionData 과다 로깅 및 Hooks 순서 오류 (2025-12-07)

#### 문제 1: 과다 콘솔 로깅

**증상:** 컴포넌트 렌더링마다 수백 개의 `🔍 [ComponentName] useCollectionData 실행:` 로그 출력

**원인:** `useMemo` 내부의 디버그 로그가 의존성 변경 시마다 실행

**해결:** 모든 불필요한 `console.log` 제거

**정리된 파일:**

- `src/builder/hooks/useCollectionData.ts` - 15개+ 로그 제거
- `src/builder/hooks/useCollectionDataCache.ts` - 8개 로그 제거
- `src/shared/components/ListBox.tsx` - 6개 로그 제거

#### 문제 2: React Hooks 순서 오류

**증상:** Hot reload 시 "React has detected a change in the order of Hooks" 에러

**원인:** `clearCache` useCallback 추가로 인한 hooks 개수 변경

**해결:**

- `isCanvasContext`를 useMemo 의존성 배열에 추가
- 불필요한 `componentName` 의존성 제거

---

### Fixed - ListBox DataTable 데이터 미표시 버그 (2025-12-07)

#### 문제

DataTable 바인딩된 ListBox에서 데이터가 표시되지 않음

**증상:**

```
[DEBUG] DataTable found: poke {useMockData: false, mockDataLength: 20, runtimeDataLength: 0, resolvedDataLength: 0}
```

#### 원인

`runtimeData`가 빈 배열 `[]`일 때 `mockData`로 fallback되지 않음

```typescript
// 문제 코드
const data = table.useMockData
  ? table.mockData
  : table.runtimeData || table.mockData;
// [] || mockData = [] (빈 배열은 JavaScript에서 truthy)
```

#### 해결

빈 배열 체크 로직 추가

```typescript
// 수정된 코드
const hasRuntimeData = table.runtimeData && table.runtimeData.length > 0;
const data = table.useMockData
  ? table.mockData
  : hasRuntimeData
    ? table.runtimeData
    : table.mockData;
```

**파일:** `src/builder/hooks/useCollectionData.ts:327-333`

---

### Changed - DatasetEditorPanel Tab Management Refactoring (2025-12-03)

#### State Lifting Pattern

DatasetEditorPanel에서 탭 상태를 관리하도록 변경 (이전: 각 에디터 내부에서 관리)

**변경 사항:**

- **DatasetEditorPanel.tsx** - 모든 에디터 탭 상태 관리 (tableTab, apiTab, variableTab, creatorMode)
- **DataTableEditor.tsx** - 내부 탭 상태 제거, `activeTab` prop 수신
- **ApiEndpointEditor.tsx** - 내부 탭 상태 제거, `activeTab` prop 수신 (initialTab 제거)
- **VariableEditor.tsx** - 내부 탭 상태 제거, `activeTab` prop 수신
- **DataTableCreator.tsx** - 내부 mode 상태 제거, `mode` prop 수신

**새 타입 추가 (editorTypes.ts):**

```typescript
export type TableEditorTab = "schema" | "data" | "settings";
export type ApiEditorTab = "basic" | "headers" | "body" | "response" | "test";
export type VariableEditorTab = "basic" | "validation" | "transform";
```

**최종 구조:**

```
DatasetEditorPanel
├── PanelHeader (동적 타이틀)
├── panel-tabs 또는 creator-mode-selection (renderTabs)
└── panel-contents
    └── Editor 컴포넌트 (activeTab prop으로 탭 전달)
```

**관련 문서:** docs/features/DATA_PANEL_SYSTEM.md Section 18

---

### Changed - Dataset Panel Standardization (2025-12-02)

#### Panel Structure Refactoring

- **DatasetPanel** - `panel > panel-contents > section` 표준 구조로 변경
- **DataTableList** - `section > SectionHeader + section-content` 패턴 적용
- **ApiEndpointList** - 동일한 section 패턴 적용
- **VariableList** - section 패턴 + `dataset-subgroup`으로 Global/Page 구분
- **TransformerList** - 동일한 section 패턴 적용

#### Class Naming Standardization

- `dataset-tabs` → `panel-tabs` (일관된 패널 탭 클래스)
- `dataset-tab` → `panel-tab`
- `editor-tabs` → `panel-tabs` (DataTableEditor)
- `editor-tab` → `panel-tab`

#### Component Updates

- **DataTableEditor** - PanelHeader 컴포넌트 사용, 테이블명 편집은 Settings 탭으로 이동
- **DataTableCreator** - PanelHeader 컴포넌트 사용, 패널 형식으로 변경 (기존 popover에서)
- **SectionHeader** - 모든 리스트 컴포넌트에서 공통 SectionHeader 사용

#### Files Modified

- `src/builder/panels/dataset/DatasetPanel.tsx`
- `src/builder/panels/dataset/DatasetPanel.css`
- `src/builder/panels/dataset/components/DataTableList.tsx`
- `src/builder/panels/dataset/components/ApiEndpointList.tsx`
- `src/builder/panels/dataset/components/VariableList.tsx`
- `src/builder/panels/dataset/components/TransformerList.tsx`
- `src/builder/panels/dataset/editors/DataTableEditor.tsx`
- `src/builder/panels/dataset/editors/DataTableEditor.css`
- `src/builder/panels/dataset/editors/DataTableCreator.tsx`
- `src/builder/panels/dataset/editors/DataTableCreator.css`

#### New CSS Classes

- `.dataset-subgroup` - Variables 탭에서 Global/Page 그룹 구분
- `.dataset-subgroup-header` - 서브그룹 헤더
- `.dataset-subgroup-title` - 서브그룹 제목

---

### Fixed - Layout Preset System Critical Bugs (2025-11-28)

#### Same Preset Reapply Bug

- **문제**: 동일한 프리셋(예: 전체화면) 적용 후 다시 같은 프리셋 클릭 시 덮어쓰기 다이얼로그가 표시됨
- **원인**: `sidebar-left`와 `sidebar-right`가 동일한 Slot 이름(`sidebar`, `content`)을 가져 Set 비교로 구분 불가
- **해결**: Slot 이름 비교 대신 `appliedPreset` 키를 body element props에 저장하여 감지
- **파일**: `usePresetApply.ts`, `LayoutPresetSelector/index.tsx`, `styles.css`

```typescript
// body element props에서 직접 읽기
const currentPresetKey = useMemo((): string | null => {
  const body = elements.find((el) => el.id === bodyElementId);
  const appliedPreset = (body?.props as { appliedPreset?: string })
    ?.appliedPreset;
  // appliedPreset이 있고 slot 구성이 일치하면 유효
  if (appliedPreset && LAYOUT_PRESETS[appliedPreset]) {
    // ... slot 검증 로직
    return appliedPreset;
  }
  return null;
}, [elements, bodyElementId, existingSlots]);
```

#### LayoutsTab Body Auto-Select Bug

- **문제**: Layout 모드에서 Slot 선택 시 자동으로 body가 선택되어 버림
- **원인**: body 자동 선택 useEffect가 layout 변경 시뿐 아니라 `layoutElements` 변경 시마다 실행됨
- **해결**: `bodyAutoSelectedRef`를 추가하여 layout 당 한 번만 body 자동 선택 실행
- **파일**: `LayoutsTab.tsx`

```typescript
const bodyAutoSelectedRef = React.useRef<boolean>(false);

useEffect(() => {
  if (layoutChanged) {
    bodyAutoSelectedRef.current = false; // 레이아웃 변경 시 리셋
  }

  // 한 번만 실행
  if (!bodyAutoSelectedRef.current && bodyElement) {
    setSelectedElement(bodyElement.id, ...);
    bodyAutoSelectedRef.current = true;
  }
}, [currentLayout?.id, layoutElements, ...]);
```

#### Critical: Layout Slot Content Duplication Bug

- **문제**: Layout 프리셋 적용 시 Page body 내부의 모든 컴포넌트가 모든 Slot에 복제됨
- **원인**: `renderLayoutElement`에서 Slot 렌더링 시 `slot_name` 필터링 없이 모든 body 자식을 삽입
- **해결**: `slot_name` 매칭 필터 추가 - 각 Slot에는 해당 `slot_name`을 가진 요소만 삽입

**Before (Bug)**:

```typescript
slotContent = pageElements
  .filter((pe) => pe.parent_id === pageBody.id)  // 모든 body 자식
  .sort(...);
```

**After (Fix)**:

```typescript
slotContent = pageElements
  .filter((pe) => {
    if (pe.parent_id !== pageBody.id) return false;
    const peSlotName =
      (pe.props as { slot_name?: string })?.slot_name || "content";
    return peSlotName === slotName; // slot_name 매칭
  })
  .sort((a, b) => (a.order_num || 0) - (b.order_num || 0));
```

- **파일**: `PreviewApp.tsx`

---

### Added - Style Panel Improvements (2025-11-24)

#### PropertyUnitInput Shorthand Parsing

- **Shorthand Value Support** - CSS shorthand 값 (예: `"8px 12px"`) 파싱 시 첫 번째 값 추출
- **Smart Change Detection** - 문자열 비교 대신 파싱된 숫자값/단위 비교로 불필요한 onChange 방지
- **Focus Bug Fix** - Mixed 값에서 포커스 인/아웃만 해도 값이 변경되던 버그 수정

#### LayoutSection Figma-style Expandable Spacing

- **Expandable Spacing UI** - Figma 스타일 단일 값 ↔ 4방향 개별 입력 토글
- **Mixed Value Detection** - 4방향 값이 다를 때 "(Mixed)" 라벨 표시
- **4-Direction Grid** - T/R/B/L 개별 입력 그리드 레이아웃
- **Bulk Update** - 축소 모드에서 4방향 동시 업데이트

#### Files Modified

- `src/builder/panels/common/PropertyUnitInput.tsx` - Shorthand 파싱 및 변경 감지 로직
- `src/builder/panels/styles/sections/LayoutSection.tsx` - 확장형 Spacing UI
- `src/builder/panels/common/index.css` - `.layout-spacing`, `.spacing-4way-grid` 스타일

---

### Added - Layout/Slot System Implementation (2025-11-21)

#### Phase 1: Core Infrastructure ✅

- **Database Schema** - `layouts` and `slots` tables with RLS policies
- **Type Definitions** - Layout, Slot, LayoutSlot types in `unified.types.ts`
- **Zustand Store** - `layoutStore.ts` with layouts/slots management
- **API Service** - `LayoutsApiService.ts` for CRUD operations

#### Phase 2: Builder UI ✅

- **Nodes Panel Layouts Tab** - Layout 생성/삭제/선택 UI
- **Slot Component** - 드래그 가능한 Slot 컴포넌트 with React Aria
- **Slot Editor** - Inspector에서 Slot name/required 설정

#### Phase 3: Page-Layout Integration ✅

- **BodyEditor 업데이트** - Page에 Layout 할당 UI (Select 컴포넌트)
- **Element Inspector 업데이트** - Element에 slot_name 지정 UI
- **Preview Rendering** - Layout + Page 합성 렌더링 엔진

#### Phase 4: Complex Component Support ✅ (Bug Fix)

- **ComponentCreationContext 확장** - `layoutId` 필드 추가
- **ComponentFactory 업데이트** - `createComplexComponent()`에 `layoutId` 파라미터 전달
- **Definition 파일 업데이트** - 11개 컴포넌트 정의 함수에 `ownerFields` 패턴 적용
  - `SelectionComponents.ts`: Select, ComboBox, ListBox, GridList
  - `GroupComponents.ts`: Group, ToggleButtonGroup, CheckboxGroup, RadioGroup, TagGroup, Breadcrumbs
  - `LayoutComponents.ts`: Tabs, Tree
  - `FormComponents.ts`: TextField
  - `TableComponents.ts`: Table, ColumnGroup

#### Key Architecture Decisions

- **ownerFields Pattern** - Layout/Page 모드 구분하여 `layout_id` 또는 `page_id` 설정
  ```typescript
  const ownerFields = layoutId
    ? { page_id: null, layout_id: layoutId }
    : { page_id: pageId, layout_id: null };
  ```
- **Element 소유권** - Element는 `page_id` 또는 `layout_id` 중 하나만 가짐 (상호 배타적)
- **Slot 렌더링** - Preview에서 Slot 위치에 해당 `slot_name` Element들 삽입

#### Files Modified

- `src/builder/factories/types/index.ts`
- `src/builder/factories/ComponentFactory.ts`
- `src/builder/hooks/useElementCreator.ts`
- `src/builder/factories/definitions/SelectionComponents.ts`
- `src/builder/factories/definitions/GroupComponents.ts`
- `src/builder/factories/definitions/LayoutComponents.ts`
- `src/builder/factories/definitions/FormComponents.ts`
- `src/builder/factories/definitions/TableComponents.ts`

#### Related Documentation

- [Layout/Slot System Plan V2](features/completed/LAYOUT_SLOTS.md) - 전체 구현 계획

---

### Fixed - Theme System & iframe Communication (2025-11-14)

#### Theme Cross-Selection Bug Fix

- **Fixed theme switching between different themes** not applying to Preview
  - Root cause: Hash calculation used string interpolation on objects (incorrect serialization)
  - Solution: Serialize full token structure with `JSON.stringify({ name, value, scope })`
  - Implementation: `useThemeMessenger.ts:33-39`
  - Status: ✅ Cross-theme switching now works correctly

#### Theme Refresh Application Fix

- **Fixed theme not applying after page refresh**
  - Root cause: Zustand subscribe selector pattern had timing issues
  - Solution: Changed from selector subscribe to full store subscribe with length comparison
  - Implementation: `BuilderCore.tsx:263-286`
  - Added automatic token transmission when iframe ready
  - Status: ✅ Theme now applies correctly on refresh

#### iframe Stale Reference Detection

- **Fixed elements not appearing after dashboard → builder re-entry**
  - Root cause: MessageService cached stale iframe references (contentWindow = null)
  - Solution: Automatic stale detection and re-fetch when contentWindow is null
  - Implementation: `messaging.ts:6-16`
  - Added `clearIframeCache()` on BuilderCore unmount
  - Status: ✅ Elements now appear correctly on re-entry

#### Debug Logging Cleanup

- **Removed unnecessary console.log statements**
  - Cleaned 6 files: `useThemeMessenger.ts`, `SettingsPanel.tsx`, `messageHandlers.ts`, `BuilderCore.tsx`, `themeStore.ts`, `messaging.ts`
  - Kept essential warning and error logs
  - Improved console readability for debugging

### Added - Collection Components Data Binding (2025-10-27)

#### ComboBox Filtering Enhancement

- **Added textValue support for auto-complete filtering** in ComboBox with Field-based rendering
  - Calculates searchable text from all visible Field values
  - Concatenates field values with spaces for partial matching
  - Enables searching across multiple fields (e.g., "John" matches name OR email)
  - Implementation: `SelectionRenderers.tsx:719-741`

#### TagGroup ColumnMapping Support

- **Added columnMapping support** for dynamic data rendering in TagGroup
  - Renders Tag for each data item with Field children
  - Supports REST API, MOCK_DATA, and Supabase data sources
  - Consistent pattern with ListBox, GridList, Select, ComboBox
  - Implementation: `CollectionRenderers.tsx:174-384`

#### TagGroup Item Removal System

- **Added non-destructive item removal** with `removedItemIds` tracking
  - Tracks removed item IDs without modifying source data (REST API/MOCK_DATA)
  - Items filtered out before rendering
  - Persisted to database, survives page refresh
  - Integrated with history system for undo/redo
  - Implementation: `TagGroup.tsx:131-151`, `CollectionRenderers.tsx:321-365`

#### TagGroup Restore Functionality

- **Added Inspector UI for restoring removed items**
  - Visual indicator showing count of removed items
  - "♻️ Restore All Removed Items" button
  - One-click restoration of all hidden items
  - Implementation: `TagGroupEditor.tsx:197-214`

#### Initial Component Creation Pattern

- **Standardized initial child items** for all Collection components
  - All components now create only **1 child item** as template for dynamic data
  - **Select**: Changed from 3 SelectItems → 1 SelectItem
  - **ComboBox**: Changed from 2 ComboBoxItems → 1 ComboBoxItem
  - **GridList**: 1 GridListItem
  - **ListBox**: 1 ListBoxItem
  - Consistent template pattern for columnMapping mode
  - Implementation: `SelectionComponents.ts`

#### Collection Components Status Update

- ✅ **ListBox + ListBoxItem**: columnMapping implemented
- ✅ **GridList + GridListItem**: columnMapping implemented
- ✅ **Select + SelectItem**: columnMapping implemented
- ✅ **ComboBox + ComboBoxItem**: columnMapping + textValue filtering implemented
- ✅ **TagGroup + Tag**: columnMapping + removedItemIds implemented
- 🔄 **Menu + MenuItem**: pending
- 🔄 **Tree + TreeItem**: hierarchical data supported, columnMapping pending
- 🔄 **CheckboxGroup + Checkbox**: pending
- 🔄 **RadioGroup + Radio**: pending
- 🔄 **ToggleButtonGroup + ToggleButton**: pending

### Added - Inspector UI/UX Improvements (2025-10)

#### Compact Layout

- **One-line layouts** for related controls to improve space efficiency
  - Font Size + Line Height in a single row with action button
  - Text Align + Vertical Align in a single row
  - Text Decoration + Font Style in a single row
  - Font Weight + Letter Spacing in a single row
  - All layouts follow consistent pattern with `.fieldset-actions`

#### Icon-based Controls

- **Replaced text buttons with icons** for better visual consistency
  - Text Align: `AlignLeft`, `AlignCenter`, `AlignRight`
  - Vertical Align: `AlignVerticalJustifyStart`, `AlignVerticalJustifyCenter`, `AlignVerticalJustifyEnd`
  - Text Decoration: `RemoveFormatting`, `Underline`, `Strikethrough`
  - Font Style: `RemoveFormatting`, `Italic`, `Type` (with skew for oblique)
  - Text Transform: `RemoveFormatting`, `CaseUpper`, `CaseLower`, `CaseSensitive`
- All icon-based controls use `indicator` attribute for consistent visual feedback

#### Auto Option for Style Reset

- **Added "auto" option** to all style properties for inline style removal
  - Properties with auto: Width, Height, Left, Top, Gap, Padding, Margin
  - Properties with auto: Border Width, Border Radius, Border Style
  - Properties with auto: Font Size, Line Height, Font Family, Font Weight, Letter Spacing
- Selecting "auto" removes inline style and falls back to class-defined styles
- Implemented in both `PropertyUnitInput` and `PropertySelect` components

### Changed

#### Input Control Improvements

- **Separated immediate input from blur input** in `PropertyUnitInput`
  - Input changes only update local state during typing
  - Style changes apply on blur or Enter key press
  - Prevents value accumulation issues (e.g., "16" becoming "116")
  - Added Enter key support for immediate value application

#### PropertySelect Enhancements

- **Ellipsis handling** for long option labels
  - Added `text-overflow: ellipsis` with `overflow: hidden`
  - Fixed width constraints with `min-width: 0` throughout component hierarchy
  - Prevents Font Weight from expanding and squeezing Letter Spacing
  - Flex layout with proper width constraints in `.react-aria-Button`

### Fixed

#### Synchronization Issues

- **Element switching now properly updates styles**
  - Added `style` and `computedStyle` comparison in Inspector component
  - Previous elements' style values no longer persist when selecting new elements
  - Fixed `mapElementToSelected` to initialize style as empty object instead of undefined
  - Fixed `mapSelectedToElementUpdate` to always include style property (even empty object)

#### Style Application

- **Inline style changes now properly sync to Builder**
  - Empty style objects now transmitted to Builder for style removal
  - Fixed conditional check to use `!== undefined` instead of truthy check
  - Style deletions via "auto" option now properly reflected in preview

## Related Documentation

- [Inspector Style System](features/completed/INSPECTOR_STYLE.md) - Comprehensive guide to style management
- [ToggleButtonGroup Indicator](features/completed/TOGGLEBUTTONGROUP.md) - Indicator implementation details
- [CLAUDE.md](../CLAUDE.md) - Development guidelines and architecture

## Breaking Changes

None in this release.

## Migration Guide

No migration needed for this release. All changes are backward compatible.

---

---

**Note**: 2025년 이전 변경 이력은 [CHANGELOG-2025-archived.md](CHANGELOG-2025-archived.md)를 참조하세요.
