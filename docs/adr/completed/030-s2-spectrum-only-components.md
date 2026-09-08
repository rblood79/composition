# ADR-030: React Spectrum S2 전용 컴포넌트 WebGL 마이그레이션

## Status

Proposed (2026-03-07) → **Completed (2026-03-09)** — Phase 0~4 전체 완료 (SelectBoxGroup 포함)

## Context

### 문제 정의

composition는 React Aria Components 기반으로 76개 Spec과 관련 인프라를 구현했다. 그러나 React Spectrum S2에는 React Aria에 없는 **고수준 복합 컴포넌트**가 약 20개 존재하며, 이들은 실제 웹 애플리케이션에서 자주 사용되는 UI 패턴이다.

**현재 상태** (전수 조사 기준):

- Spec 정의: 76개 (구조적 완성)
- Factory 정의: **43개** — 13개 주요 컴포넌트 Factory 누락 (Button, Badge, Link 등)
- TAG_SPEC_MAP: 122 entries (alias 포함, 완전)
- Preview 렌더러: 46개 — 8개 누락 (FileTrigger, DropZone, Pagination 등)
- S2 프로퍼티 커버리지: **핵심 14개 컴포넌트 평균 ~50%**
- React Spectrum S2 전용: 22개 미구현

> **참조**: 전수 조사 상세 → `docs/audit/component-audit-report.md`

### React Aria vs React Spectrum S2 비교

| 계층                  | 역할                                | composition 현황                      |
| --------------------- | ----------------------------------- | ------------------------------------- |
| React Aria Components | 비정형 접근성 프리미티브 (unstyled) | 76개 Spec 완성, **Factory 13개 누락** |
| React Spectrum S2     | Adobe 디자인 시스템 (styled + 복합) | **22개 미구현**                       |

### 전수 조사 핵심 발견 (ADR-030 선행 조건)

|    심각도    | 발견 사항                                           | 영향                                    |
| :----------: | --------------------------------------------------- | --------------------------------------- |
| **CRITICAL** | Button/Badge/Link/ProgressBar에 Factory 정의 없음   | 빌더에서 독립 컴포넌트로 생성 불가      |
|   **HIGH**   | S2 대비 프로퍼티 커버리지 ~50%                      | variant/validation/form 지원 미흡       |
|   **HIGH**   | 이벤트 패널의 React Aria 이벤트 미연동              | onPress/onSelectionChange 등 실행 불가  |
|   **HIGH**   | Preview 렌더러 일부 누락 (FileTrigger, DropZone 등) | 8개 컴포넌트 Preview 렌더링 불가        |
|  **MEDIUM**  | Compositional 전환 불완전 (일부 자식 커스텀 불가)   | Calendar, ColorArea 등 사용자 자식 불가 |

### Hard Constraints

- 기존 Spec/Factory/Renderer/CSS 4계층 아키텍처 유지
- S2 토큰 체계(ADR-022/023) 준수
- Skia 캔버스 렌더링 60fps 유지
- Taffy WASM 레이아웃 엔진 호환
- 기존 컴포넌트와 동일한 편집 경험 (Inspector, Drag, Resize)
- **Phase 0 선행 작업 완료 후 Phase 1 착수** (G0 게이트 충족 필수)

---

## Alternatives Considered

### 대안 A: 전체 일괄 구현 (20개 동시)

- 설명: S2 전용 컴포넌트 20개를 한 번에 구현
- 위험:
  - 기술: **H** — 복잡도 높은 컴포넌트(CardView, TableView)와 낮은 컴포넌트(StatusLight) 혼재
  - 성능: **M** — 대량 Spec 추가 시 번들 크기 증가
  - 유지보수: **H** — 한 번에 20개 컴포넌트 QA/디버깅 부담
  - 마이그레이션: **L** — 신규 추가이므로 기존 데이터 영향 없음

### 대안 B: 4-Phase 점진 구현 (난이도+활용도 기반)

- 설명: 난이도(낮→높)와 활용도(높→낮)를 조합하여 4단계로 나누어 구현
- 위험:
  - 기술: **L** — 각 Phase가 독립적, 단계별 검증 가능
  - 성능: **L** — Phase별 번들 영향 측정 가능
  - 유지보수: **L** — 단계별 3~7개씩 관리 가능한 규모
  - 마이그레이션: **L** — 신규 추가, 기존 데이터 무관

### 대안 C: 활용도 상위 10개만 선택 구현

- 설명: 가장 많이 사용되는 컴포넌트만 구현, 나머지 보류
- 위험:
  - 기술: **L** — 범위 축소로 안전
  - 성능: **L** — 최소 추가
  - 유지보수: **L** — 적은 수량
  - 마이그레이션: **M** — 향후 나머지 추가 시 일관성 재검토 필요

## Decision

**대안 B: 4-Phase 점진 구현** 채택

위험 수용 근거: Phase별 독립적 구현/검증이 가능하고, 각 Phase 완료 후 다음 Phase 진행 여부를 재평가할 수 있다. 대안 A의 HIGH 위험(기술/유지보수)을 단계 분할로 해소.

## Gates

### G0: Phase 0 선행 조건 (ADR-030 착수 전 필수)

| Gate | 조건                                                 | 현재 상태 | 검증 방법                                                      |
| :--: | ---------------------------------------------------- | :-------: | -------------------------------------------------------------- |
| G0-1 | Button/Badge/Link/ProgressBar/Separator Factory 완료 |    ✅     | 단순 leaf → defaultPropsMap 생성, 팔레트 13개 등록 완료        |
| G0-2 | S2 프로퍼티 커버리지 70%+ (핵심 14개 컴포넌트)       |  ✅ ~85%  | name/value/isInvalid/isRequired/isReadOnly 대부분 구현         |
| G0-3 | 이벤트 패널 React Aria 이벤트 실행 검증              |    ✅     | 8 이벤트 + 26 액션, onPress/onSelectionChange/onAction 구현    |
| G0-4 | Form 제출 props (name/value) 추가 완료               |    ✅     | Checkbox/Switch/RadioGroup/Select/Slider/TextField Spec에 포함 |
| G0-5 | 누락 Preview 렌더러 보완 (최소 Pagination, Toast)    |    ✅     | 8개 모두 rendererMap 등록 완료                                 |
| G0-6 | `pnpm type-check` 통과                               |    ✅     | CI                                                             |

### G1~G4: Phase별 진행 조건

| Gate | 조건                                     | 현재 상태 | 검증 방법                         |
| :--: | ---------------------------------------- | :-------: | --------------------------------- |
|  G1  | Phase 1 완료 후 타입 체크 통과           |    ✅     | `pnpm type-check` 통과            |
|  G2  | 각 Phase 완료 후 Canvas FPS 60fps 유지   |    ✅     | Phase 1~3 완료, 성능 유지         |
|  G3  | 각 Phase 완료 후 기존 컴포넌트 회귀 없음 |    ✅     | Phase 1~3 기존 컴포넌트 영향 없음 |
|  G4  | Phase 3~4 진입 전 Phase 1~2 안정성 확인  |    ✅     | Phase 1~3 안정 확인, Phase 4 착수 |

---

## 구현 계획

### Phase 0: 기존 컴포넌트 완성도 보강 (선행 작업)

> **목적**: ADR-030 신규 컴포넌트 추가 전 기존 인프라의 gap을 해소하여 안정적인 기반 확보
> **참조**: `docs/audit/component-audit-report.md`

#### 0-1. Factory 누락 컴포넌트 보완 (CRITICAL)

Spec과 TAG_SPEC_MAP은 존재하지만 Factory 정의가 없어 빌더 팔레트에서 독립 생성 불가한 13개 컴포넌트:

| #   | 컴포넌트        | 분류     | 난이도 | 비고                           |
| --- | --------------- | -------- | :----: | ------------------------------ |
| 1   | **Button**      | Actions  |  낮음  | 가장 기본적인 컴포넌트, 최우선 |
| 2   | **Badge**       | Feedback |  낮음  | 단일 컴포넌트, 자식 없음       |
| 3   | **Link**        | Actions  |  낮음  | href 기본값 필요               |
| 4   | **ProgressBar** | Feedback |  낮음  | value 기본값 필요              |
| 5   | **Separator**   | Layout   |  낮음  | 최소 구성                      |
| 6   | **Meter**       | Feedback |  낮음  | ProgressBar와 유사             |
| 7   | **Nav**         | Layout   |  중간  | 컨테이너, 자식 구성 필요       |
| 8   | **Panel**       | Layout   |  중간  | 컨테이너, 자식 구성 필요       |
| 9   | **ScrollBox**   | Layout   |  중간  | 컨테이너, 스크롤 설정 필요     |
| 10  | **MaskedFrame** | Display  |  중간  | 클리핑 마스크 설정 필요        |
| 11  | **Skeleton**    | Feedback |  중간  | 로딩 애니메이션 설정 필요      |
| 12  | **DropZone**    | Inputs   |  중간  | 드래그앤드롭 이벤트 연동       |
| 13  | **FileTrigger** | Inputs   |  중간  | 파일 업로드 이벤트 연동        |

**변경 대상 파일**:

```
apps/builder/src/builder/factories/definitions/{Category}Components.ts  — Factory 정의 추가
apps/builder/src/builder/factories/ComponentFactory.ts                   — creator 등록
```

#### 0-2. S2 프로퍼티 정합성 보강 (HIGH)

핵심 14개 컴포넌트의 S2 프로퍼티 커버리지를 ~50% → 70%+로 향상:

| #   | 작업                         | 대상 컴포넌트                                      | 난이도 |
| --- | ---------------------------- | -------------------------------------------------- | :----: |
| 1   | Form 제출 props (name/value) | Checkbox, Switch, Radio, Select, Slider, TextField |  중간  |
| 2   | Validation props             | Checkbox, RadioGroup, Select, ComboBox             |  중간  |
| 3   | isEmphasized variant         | Checkbox, Switch, RadioGroup, Slider               |  낮음  |
| 4   | isReadOnly 상태              | Checkbox, Switch, RadioGroup                       |  낮음  |
| 5   | Button isPending 상태        | Button                                             |  중간  |
| 6   | Dialog 기능 보완             | isDismissible, AlertDialog variant                 |  중간  |

**공통 누락 패턴**:

| 패턴                              | 대상                                               | 우선순위 |
| --------------------------------- | -------------------------------------------------- | :------: |
| Form 제출 (name/value)            | Checkbox, Switch, Radio, Select, Slider, TextField |   HIGH   |
| Validation (isInvalid/isRequired) | Checkbox, RadioGroup, Select, ComboBox             |   HIGH   |
| isEmphasized                      | Checkbox, Switch, Radio, Slider                    |  MEDIUM  |
| isReadOnly                        | Checkbox, Switch, RadioGroup                       |  MEDIUM  |
| staticColor                       | Button, ProgressBar, Link, Badge                   |  MEDIUM  |
| isPending/isLoading               | Button, Select                                     |  MEDIUM  |

#### 0-3. 이벤트 패널 React Aria 이벤트 연동 (HIGH)

| #   | 작업                             | 설명                                                   | 난이도 |
| --- | -------------------------------- | ------------------------------------------------------ | :----: |
| 1   | React Aria 이벤트 실행 매핑 검증 | onPress, onSelectionChange, onAction 등 실제 동작 확인 |  높음  |
| 2   | 이벤트 타입 표준화               | DOM 이벤트(onClick) ↔ React Aria 이벤트(onPress) 통합  |  높음  |
| 3   | 이벤트 실행 테스트               | 주요 컴포넌트별 이벤트 동작 검증                       |  중간  |

#### 0-4. Preview 렌더러 누락 보완 (HIGH)

| 컴포넌트    | Spec | Factory | 렌더러 | 우선순위 |
| ----------- | :--: | :-----: | :----: | :------: |
| Pagination  |  O   |    O    | **X**  |   HIGH   |
| Toast       |  O   |    O    | **X**  |   HIGH   |
| FileTrigger |  O   |    X    | **X**  |  MEDIUM  |
| DropZone    |  O   |    X    | **X**  |  MEDIUM  |
| ColorArea   |  O   |    X    | **X**  |   LOW    |
| ColorSlider |  O   |    X    | **X**  |   LOW    |
| ColorWheel  |  O   |    X    | **X**  |   LOW    |
| Skeleton    |  O   |    X    | **X**  |   LOW    |

#### 0-5. 불필요한 옵션 정리 (MEDIUM)

| #   | 작업                             | 설명                                      | 난이도 |
| --- | -------------------------------- | ----------------------------------------- | :----: |
| 1   | Card variant 이름 S2 정합성 검토 | primary/secondary/tertiary → S2 명칭 대조 |  낮음  |
| 2   | Size 표기법 통일                 | sm/md/lg vs S/M/L 혼용 정리               |  낮음  |

> **결론**: composition 커스텀 확장 variant는 유지하되, S2 표준 variant를 반드시 포함.

#### Phase 0 작업량 추정

| 작업          | 컴포넌트 수 | 파일 변경 | 예상 난이도 |
| ------------- | :---------: | :-------: | :---------: |
| 0-1 Factory   |     13      |    ~20    |    낮~중    |
| 0-2 S2 Props  |     14      |    ~30    |    중간     |
| 0-3 이벤트    |    전체     |    ~10    |     높      |
| 0-4 Preview   |      8      |    ~10    |    중간     |
| 0-5 옵션 정리 |      5      |    ~8     |    낮음     |

---

### Phase 1: 단순 Display/Feedback (7개) — 난이도 낮음

기존 Spec 패턴을 거의 그대로 재활용 가능한 컴포넌트.

| #   | 컴포넌트           | 기능                                        | Skia 렌더링                     | 기반 Spec      |
| --- | ------------------ | ------------------------------------------- | ------------------------------- | -------------- |
| 1   | **Avatar**         | 사용자 프로필 이미지 또는 이니셜(원형/사각) | 원형 클리핑 + 이미지/텍스트     | 신규 (단순)    |
| 2   | **AvatarGroup**    | Avatar 겹침 배열 + 오버플로우 카운터(+N)    | flex row + negative margin      | Avatar 래퍼    |
| 3   | **StatusLight**    | 색상 원형 점 + 텍스트 라벨 (상태 표시)      | circle + text                   | Badge 참고     |
| 4   | **InlineAlert**    | 인라인 경고/정보/성공 메시지 박스           | rect + icon + heading + text    | Card 참고      |
| 5   | **Divider**        | 수평/수직 구분선 (size S/M/L)               | 단순 rect 선                    | Separator 확장 |
| 6   | **LinkButton**     | Button 외관 + `<a>` 태그 동작               | Button Spec 동일                | Button 재활용  |
| 7   | **ContextualHelp** | `?`/`i` 아이콘 버튼 + Popover 도움말        | icon button (캔버스는 트리거만) | Button+Popover |

**변경 대상 파일** (컴포넌트당):

```
packages/specs/src/components/{Name}.spec.ts          — Spec 정의
packages/specs/src/components/index.ts                 — export 추가
packages/specs/src/index.ts                            — export 추가
packages/shared/src/types/element.types.ts             — ElementTag 추가
apps/builder/src/builder/factories/definitions/*.ts    — Factory 정의
apps/builder/src/builder/workspace/canvas/skia/nodeRenderers.ts  — Skia 렌더
apps/builder/src/builder/workspace/canvas/pixi/ElementSprite.tsx — TAG_SPEC_MAP
apps/builder/src/preview/components/*.tsx              — Preview CSS 컴포넌트
apps/builder/src/builder/styles/*.css                  — CSS 스타일
```

**Props 요약**:

| 컴포넌트       | 주요 Props                                                                            | S2 Variants     |
| -------------- | ------------------------------------------------------------------------------------- | --------------- |
| Avatar         | `src`, `alt`, `size`(16~44+)                                                          | `isDisabled`    |
| AvatarGroup    | `size`, `label`                                                                       | `isDisabled`    |
| StatusLight    | `variant`(neutral/informative/positive/notice/negative + named colors), `size`(S/M/L) | —               |
| InlineAlert    | `variant`(neutral/informative/positive/notice/negative), `autoFocus`                  | —               |
| Divider        | `size`(S/M/L), `orientation`(horizontal/vertical), `staticColor`                      | —               |
| LinkButton     | Button props + `href`, `target`, `rel`                                                | Button variants |
| ContextualHelp | `variant`("help"/"info"), `placement`                                                 | —               |

---

### Phase 2: Button/Menu 복합 (5개) — 난이도 낮~중

기존 Button/Menu Spec을 확장하는 복합 컴포넌트.

| #   | 컴포넌트              | 기능                                                | Skia 렌더링                        | 기반 Spec              |
| --- | --------------------- | --------------------------------------------------- | ---------------------------------- | ---------------------- |
| 1   | **ActionButton**      | 아이콘 전용/아이콘+텍스트 (quiet 기본, 도구 모음용) | Button Spec 변형 (quiet 기본)      | Button 확장            |
| 2   | **ActionButtonGroup** | ActionButton 수평/수직 배열                         | flex 컨테이너                      | ToggleButtonGroup 참고 |
| 3   | **ButtonGroup**       | Button 수평/수직 배열 + alignment                   | flex 컨테이너                      | ToggleButtonGroup 참고 |
| 4   | **ActionMenu**        | 트리거 버튼 + Menu 드롭다운 (더보기 메뉴)           | 캔버스는 트리거만, 메뉴는 오버레이 | Button + Menu          |
| 5   | **Accordion**         | Disclosure 그룹 래퍼 (단일/다중 확장 모드)          | DisclosureGroup과 거의 동일        | DisclosureGroup 확장   |

**Props 요약**:

| 컴포넌트          | 주요 Props                                                               | S2 특화                  |
| ----------------- | ------------------------------------------------------------------------ | ------------------------ |
| ActionButton      | `size`(XS~XL), `isQuiet`, `isDisabled`, `staticColor`                    | quiet 기본               |
| ActionButtonGroup | `size`, `isDisabled`, `isQuiet`, `isJustified`, `orientation`, `density` | density(compact/regular) |
| ButtonGroup       | `size`, `orientation`, `align`(start/center/end)                         | align                    |
| ActionMenu        | `align`, `direction`, `shouldFlip` + Menu props                          | 복합 트리거              |
| Accordion         | `allowsMultipleExpanded`, `defaultExpandedKeys`, `expandedKeys`          | 확장 제어                |

---

### Phase 3: 확장 Control/Display (5개) — 난이도 중

기존 컴포넌트의 변형이지만 추가적인 Skia 렌더링 로직이 필요한 컴포넌트.

| #   | 컴포넌트           | 기능                                         | Skia 렌더링                  | 기반 Spec     |
| --- | ------------------ | -------------------------------------------- | ---------------------------- | ------------- |
| 1   | **RangeSlider**    | 양쪽 thumb으로 범위 선택 (min~max 구간)      | 트랙 + 2 thumb + 범위 영역   | Slider 확장   |
| 2   | **ProgressCircle** | 원형 진행률 표시 (determinate/indeterminate) | Skia arc + 애니메이션        | 신규          |
| 3   | **Image**          | 반응형 이미지 (로딩/fallback/object-fit)     | 이미지 로딩 + Skia drawImage | 신규          |
| 4   | **Picker**         | Select 대안 — Spectrum 고유 트리거 디자인    | Select 트리거 변형           | Select 확장   |
| 5   | **RangeCalendar**  | 날짜 범위 선택 달력 + 범위 하이라이트        | Calendar + 범위 색칠         | Calendar 확장 |

**Props 요약**:

| 컴포넌트       | 주요 Props                                                 | 특수 렌더링                       |
| -------------- | ---------------------------------------------------------- | --------------------------------- |
| RangeSlider    | `defaultValue`/`value` (2개 배열), `thumbLabels`           | 2-thumb 좌표 계산                 |
| ProgressCircle | `size`(S/M/L), `value`, `isIndeterminate`, `staticColor`   | Skia arc 그리기                   |
| Image          | `src`, `alt`, `objectFit`(cover/contain/fill/none)         | drawImage + object-fit 에뮬레이션 |
| Picker         | Select와 유사 + `isQuiet`, `menuWidth`, `isLoading`        | 트리거 UI 변형                    |
| RangeCalendar  | Calendar props + 범위 `value`, `allowsNonContiguousRanges` | 범위 하이라이트                   |

---

### Phase 4: 고급 복합 컴포넌트 (5개) — 난이도 높 ✅ **구현 완료 (2026-03-09)**

가상 스크롤, 복잡한 레이아웃, 고급 인터랙션이 필요한 컴포넌트.

> **구현 결과**: 5개 컴포넌트 전체 구현 완료.
> SegmentedControl은 자식 컴포넌트(SegmentedControlItem), SelectBoxGroup은 자식 컴포넌트(SelectBoxItem)도 함께 구현.
> CardView/TableView는 정적 레이아웃으로 구현 (가상 스크롤은 Preview에서 처리).

| #   | 컴포넌트               | 기능                                                | Skia 렌더링                           | 기반 Spec                     |
| --- | ---------------------- | --------------------------------------------------- | ------------------------------------- | ----------------------------- |
| 1   | **SegmentedControl**   | iOS 스타일 세그먼트 전환 버튼 + 슬라이드 인디케이터 | 둥근 컨테이너 + 세그먼트 + 인디케이터 | 신규                          |
| 2   | **SelectBoxGroup**     | 카드형 체크박스/라디오 그룹 (설명 텍스트 포함)      | 카드 레이아웃 + 체크/라디오 상태      | CheckboxGroup/RadioGroup 확장 |
| 3   | **IllustratedMessage** | 일러스트 + Heading + Description 빈 상태 표시       | SVG 렌더링 + 텍스트                   | 신규                          |
| 4   | **CardView**           | Card 그리드/워터폴 레이아웃 + 가상 스크롤           | 가상화 그리드                         | Card 확장                     |
| 5   | **TableView**          | 강화된 Table — 정렬, 컬럼 리사이즈, DnD, 가상화     | 가상화 + 컬럼 인터랙션                | Table 확장                    |

> **ActionBar**는 보류 — 화면 하단 고정 오버레이 + 애니메이션으로 캔버스 렌더링 적합성 낮음.
> **TreeView**는 기존 Tree Spec 존재로 Phase 4에서 평가 후 필요시 확장.

### Property Editor 통합 (Phase 1~4 공통) — ✅ 구현 완료 (2026-03-09)

모든 Phase 1~4 컴포넌트(22개 + SegmentedControlItem/SelectBoxItem = 24개 태그)에 대해:

1. **23개 Property Editor 생성** (`apps/builder/src/builder/panels/properties/editors/`)
   - Phase 1 (7): Avatar, AvatarGroup, StatusLight, InlineAlert, Divider, LinkButton, ContextualHelp
   - Phase 2 (5): ActionButton, ActionButtonGroup, ButtonGroup, ActionMenu, Accordion
   - Phase 3 (4): RangeSlider, ProgressCircle, Image, Picker
   - Phase 4 (7): SegmentedControl, SegmentedControlItem, SelectBoxGroup, SelectBoxItem, IllustratedMessage, CardView, TableView

2. **23개 ComponentMeta 등록** (`packages/shared/src/components/metadata.ts`)
   - `hasCustomEditor: true` + `editorName` 매핑
   - `dataBindingType` 및 `supportedEvents` 정의

3. **Spec Props 보강** — 레퍼런스 문서 대조 후 누락 props 추가
   - `SegmentedControl`: `isJustified` 추가
   - `CardView`: `variant`, `selectionMode`, `selectionStyle` 추가
   - `TableView`: `selectionMode` 추가

4. **Preview/Publish 검증** — 모든 22개 컴포넌트의 렌더러(rendererMap) 및 Publish 레지스트리 등록 확인 완료

**Props 요약**:

| 컴포넌트           | 주요 Props                                          | 핵심 난제                           |
| ------------------ | --------------------------------------------------- | ----------------------------------- |
| SegmentedControl   | `selectedKey`, `onSelectionChange`, `isDisabled`    | 선택 인디케이터 슬라이드 애니메이션 |
| SelectBoxGroup     | `orientation`, `isEmphasized`, 체크박스/라디오 모드 | 카드형 선택 UI                      |
| IllustratedMessage | `size`(S/M/L), `orientation`                        | SVG 일러스트레이션 렌더링           |
| CardView           | `layout`("grid"/"waterfall"), `size`, `density`     | 가상 스크롤 + 동적 그리드           |
| TableView          | `sortDescriptor`, 컬럼 리사이즈, DnD                | 가상 스크롤 + 복합 인터랙션         |

---

## Phase별 작업량 추정

| Phase    | 컴포넌트 수 |    파일 변경    | 핵심 작업                                  |
| -------- | :---------: | :-------------: | ------------------------------------------ |
| **0**    |   13+14+8   |       ~78       | Factory 보완 + S2 Props + Preview + 이벤트 |
| **1**    |      7      | ~63 (9파일 × 7) | Spec 신규 + Factory + 렌더러 추가          |
| **2**    |      5      | ~45 (9파일 × 5) | 기존 Spec 확장 + 복합 트리거 패턴          |
| **3**    |      5      |   ~45 + alpha   | 신규 렌더링 로직 (arc, image, 범위)        |
| **4**    |      5      |   ~45 + alpha   | 가상화, SVG, 복잡 인터랙션                 |
| **합계** |   **22+**   |    **~280+**    | Phase 0 포함                               |

---

## 컴포넌트별 구현 체크리스트 (Phase 공통)

각 컴포넌트 추가 시 아래 항목을 순서대로 완료:

```
[ ] 1. Spec 정의: packages/specs/src/components/{Name}.spec.ts
[ ] 2. Spec export: packages/specs/src/components/index.ts + packages/specs/src/index.ts
[ ] 3. pnpm build:specs
[ ] 4. ElementTag 추가: packages/shared/src/types/element.types.ts
[ ] 5. Factory 정의: apps/builder/src/builder/factories/definitions/{Category}Components.ts
[ ] 6. TAG_SPEC_MAP 등록: ElementSprite.tsx
[ ] 7. Skia 렌더러: nodeRenderers.ts (필요 시)
[ ] 8. CSS Preview 컴포넌트: apps/builder/src/preview/components/{Name}.tsx
[ ] 9. CSS 스타일: apps/builder/src/builder/styles/{name}.css
[ ] 10. Inspector 에디터: (variant/size 등 편집 UI, 필요 시)
[ ] 11. Publish 앱 대응: apps/publish/ (필요 시)
[ ] 12. 타입 체크: pnpm type-check
```

---

## Consequences

### Positive

- Phase 0으로 기존 컴포넌트 완성도 향상 (Factory 13개 보완, S2 프로퍼티 70%+ 달성)
- S2 디자인 시스템 커버리지 76개 Spec → ~98개로 확대 (Phase 1~4)
- 노코드 빌더 컴포넌트 팔레트 완성도 향상 (Avatar, StatusLight 등 실무 필수 UI)
- 기존 Spec/Factory 패턴 재활용으로 일관된 아키텍처 유지
- Phase별 독립 배포 가능, Phase 0이 기존 컴포넌트 품질 보증 역할

### Negative

- Phase 0 선행 작업 추가로 전체 일정 증가 (~78 파일 변경)
- 22개 컴포넌트 추가로 번들 크기 ~15-30KB 증가 예상
- Phase 4의 가상 스크롤 컴포넌트(CardView, TableView)는 캔버스 렌더링 성능 검증 필요
- SVG 일러스트레이션(IllustratedMessage) Skia 렌더링은 별도 SVG→Path 변환 인프라 필요
- 오버레이 컴포넌트(ActionMenu, ContextualHelp)는 캔버스에서 트리거만 렌더링 — Preview/Publish와 동작 차이 존재

---

## 보류 항목

| 컴포넌트              | 사유                                           | 재개 조건                         |
| --------------------- | ---------------------------------------------- | --------------------------------- |
| ActionBar             | 화면 하단 고정 오버레이 — 캔버스 렌더링 부적합 | 오버레이 렌더링 인프라 구축 후    |
| TreeView              | 기존 Tree Spec으로 대체 가능                   | Phase 4 완료 후 차별화 필요 시    |
| Provider              | 테마/설정 래퍼 — 시각적 컴포넌트 아님          | ADR-021 Theme System 확장 시      |
| icons / illustrations | 에셋 시스템 — 컴포넌트가 아닌 리소스           | ADR-019 Icon System에서 통합 처리 |

---

## 참조

| 문서                   | 경로                                                      |
| ---------------------- | --------------------------------------------------------- |
| **컴포넌트 전수 조사** | `docs/audit/component-audit-report.md`                    |
| React Spectrum S2 스킬 | `.claude/skills/react-spectrum-s2/references/components/` |
| React Aria 스킬        | `.claude/skills/react-aria/references/components/`        |
| S2 색상 토큰           | `docs/adr/022-s2-color-token-migration.md`                |
| S2 Variant Props       | `docs/adr/023-s2-component-variant-props.md`              |
| 컴포넌트 Spec 아키텍처 | `docs/reference/components/COMPONENT_SPEC.md`                                  |
| 렌더링 아키텍처        | `docs/RENDERING_ARCHITECTURE.md`                          |
| 아이콘 시스템          | `docs/adr/019-icon-system.md`                             |
