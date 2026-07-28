# ADR-171 구현 상세 — catalog 레이아웃 값의 소비자 비대칭 해소

> 본 문서는 [ADR-171](../171-catalog-layout-delivery-unification.md) 의 구현 상세다. 결정·위험·Gate 는 ADR 본문에 있다.

## 1. Fork checkpoint 4 질문 lock-in

본 ADR 은 ADR-912 Phase 3-A-3b 가 명시적으로 이연한 영역(`implicitStyles.ts:318` — "composition 부재 base 보강은 3-A-3b 별도 영역")을 이어받으므로 fork 게이트 대상이다.

| #   | 질문                       | 판정                                                                                                                                                                                                                                                                  |
| --- | -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | base / 응용 분류           | **본 ADR = 응용**. base 는 ADR-142(D3 SSOT = catalog) · ADR-912(spec → catalog cutover). 본 ADR 은 그 SSOT 를 **소비자에게 전달**하는 층만 다룬다 — 새 SSOT 를 만들지 않는다                                                                                          |
| 2   | schema 직교성              | **직교**. catalog schema(`structure.containerStyles` / `containerStyles`) 는 그대로 두고 resolver 와 CSS import 배선만 바꾼다. 단 §3 Phase 1 의 9종은 **값 정정**이라 schema 가 아닌 데이터 변경                                                                      |
| 3   | 선행 ADR 전제 reverse 검증 | ADR-912 의 보류 사유는 "`structure.composition` base 가 leaf 44 type 에 신규 진입 = surface-minimization 위반" 이었다. **그 전제는 유효하다** — 그래서 본 ADR 은 경로 B 게이트를 그냥 제거하지 않고, 실효값 정합화(Phase 1)를 선행 조건으로 둔다. 의존 방향 반전 없음 |
| 4   | codex 3차까지 미루지 않음  | fork 시점(본 문서) 에 1~3 lock-in 완료                                                                                                                                                                                                                                |

사용자 explicit confirm: 2026-07-28 세션 — 실측 4회(정적 격차 / 실효 computed / import 여부 / 라이브 주입) 후 "adr 작성해".

## 2. Phase 0 인벤토리 — **완료 2026-07-29**

ADR 본문 Context 의 수치는 2026-07-28 실측이다. 아래 3건은 **목록 크기**만 바꾸고 방향은 바꾸지 않는다 (`adr-writing.md` M3 — 추정↔실측 gap 은 Phase 0 흡수). 결과가 Decision 을 뒤집으면 그때만 ADR 재검토 — **뒤집지 않았다** (전달이 끊겼다는 진단·처방 모두 유지).

### 2-0. 가장 중요한 발견 — 차단이 한 겹이 아니라 **세 겹**이다

ADR 본문은 전달 실패를 "경로 3갈래" 로 서술했다. Phase 0 실측 결과 그것은 **어느 경로로 들어오는가**의 분류이고, 값이 실제로 막히는 지점은 **직렬로 놓인 세 층**이다. 한 층만 열면 나머지 두 층이 그대로 막는다.

| 층     | 차단 지점                                                                         | 막히는 것                                                                              | 근거                                                                                                 |
| ------ | --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| **L1** | `structure.composition` 게이트 (`implicitStyles.ts:321`)                          | `structure.containerStyles` 를 가진 **48종**이 통째로 반환 안 됨                       | catalog 스캔 — A 24 / B 도달 25 / **B 게이트 차단 48** / 미보유 26                                   |
| **L2** | `CONTAINER_STYLES_FALLBACK_KEYS` allowlist 17키 (`containerStylesFallback.ts:27`) | `height` · `rowGap`/`columnGap` · `padding{Top,Right,Bottom,Left}` 이 **allowlist 밖** | L1 을 열어도 이 키들은 필터에서 탈락                                                                 |
| **L3** | resolver 가 읽는 **소스 축**이 `containerStyles` 뿐                               | `sizes[size]` 의 `height`/`paddingX`/`paddingY`/`gap` 은 **읽지 않음**                 | catalog `MenuItem.structure.containerStyles` = `display`+`alignItems` **2키뿐**, 나머지는 `sizes.md` |

**MenuItem 으로 본 세 층** (실효 DOM 6키, iframe `getComputedStyle` 라이브 실측 2026-07-29):

| 실효 키                    | 값            | catalog 위치                 | 현행 도달 여부        |
| -------------------------- | ------------- | ---------------------------- | --------------------- |
| `display`                  | `inline-flex` | `structure.containerStyles`  | ❌ L1 차단            |
| `alignItems`               | `center`      | `structure.containerStyles`  | ❌ L1 차단            |
| `paddingTop`/`paddingLeft` | `4px`/`12px`  | `sizes.md.paddingY/paddingX` | ❌ L3 (+ L2 longhand) |
| `rowGap`/`columnGap`       | `8px`         | `sizes.md.gap`               | ❌ L3 + L2            |
| `height`                   | `32px`        | `sizes.md.height`            | ❌ L3 + L2            |

ADR 본문 Hard Constraint 1 의 `height:32 · inline-flex · padding 4/12 · gap 8` 과 정확히 일치한다. **게이트만 제거하면 6키 중 2키만 도달한다** — Hard Constraint 5 의 "catalog 8키 주입 → `280×32`" 재현이 성립하려면 L2·L3 도 함께 열려야 한다. 이것이 Phase 3 의 실제 작업 범위다 (design §3 Phase 3 갱신 — 게이트 제거 단독이 아니다).

### 2-1. I1 — 미import 32종의 실제 스타일 공급원 (**라이브 실측**)

방법: Vite dev 에서 `styles/index.css?inline` 로 **해소된 번들 407,951자**를 받아 iframe 에 주입 → `.react-aria-{X}` 빈 div 의 `getComputedStyle` 측정 (ADR §4 실효 computed 와 동일 방법).

| 공급원                            | 수     | 컴포넌트                                                                                                                                                                                                                                                                         |
| --------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **DOM 채널 있음** (수동 CSS)      | 2      | GridListItem (`flex column · gap 2 · pad 12/16`) · Input (`pad 4`)                                                                                                                                                                                                               |
| **DOM 채널 없음** (브라우저 기본) | **30** | 나머지 전부 — `display:block` · padding 0                                                                                                                                                                                                                                        |
| 그중 factory parent 인라인 보유   | 7      | AvatarGroup · ButtonGroup · CardView · IllustratedMessage · Nav · StatusLight · Toast                                                                                                                                                                                            |
| 그중 **어느 채널도 없음**         | **23** | Avatar · Body · Breadcrumb · CalendarHeader · Card{Content,Footer,Header,Preview} · DialogFooter · DisclosureHeader · DropZone · FieldError · FileTrigger · FormField · Image · Meter{Track,Value} · ProgressBar{Track,Value} · ProgressCircle · Section · Skeleton · TailSwatch |

- 구 추정 "미import 32 중 layout 값 보유 30" → **32종 전부** core layout 선언 보유 (방향 불변, 수치만 정정).
- `Skeleton.css`/`Toast.css` 는 존재하지만 `.react-aria-{X}` 루트에 layout 을 걸지 않는다 — 파일 존재를 채널 보유로 세면 안 된다.
- **23종은 "값이 두 소비자 모두에 도달하지 않는" 상태**다. 비대칭이 아니라 **양쪽 미도달**. 여기서 자연스러운 처방은 "import 를 추가한다" 였는데, **Phase 2 가 그 처방을 기각했다** — 이들의 `.react-aria-{X}` selector 는 DOM 에 아예 존재하지 않아 import 가 no-op 이다 (§3 Phase 2). 도달 경로는 Phase 3 의 Skia 채널뿐이다.

### 2-2. I2 — 팔레트 도달 범위 (`paletteItems.ts` 등록 61 type 대조)

| 모집단        | 직접 배치 가능                                                                                                                                                                  | 자식·조합으로만 등장                                                                            |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| 비대칭 19종   | 10 — Badge · Card · Checkbox · Dialog · Icon · Modal · Popover · Slot · Switch · Tooltip                                                                                        | 9 — Code · ColorSwatch · Header · Kbd · **MenuItem** · Radio · SliderOutput · SliderTrack · Tab |
| 미import 32종 | 14 — Avatar · AvatarGroup · ButtonGroup · CardView · DropZone · FileTrigger · IllustratedMessage · Image · Nav · ProgressCircle · Section · Skeleton · StatusLight · TailSwatch | 18                                                                                              |

**팔레트 미등록 ≠ 도달 불가**. 조합 컴포넌트의 자식으로 생성되므로 실사용 경로에 그대로 등장한다 (MenuItem 이 그 증거 — 팔레트에 없지만 ADR 의 대표 실측 대상). **Phase 3 대상에서 제외하지 않는다** — 다만 Phase 5 fixture 는 직접 배치 가능한 종부터 덮는다.

### 2-3. I3 — 수기 배선 18종의 정체

`applyImplicitStyles` 의 `containerTag === "..."` 분기는 총 39개이고, 그중 **컨테이너 자기 layout 을 주입하는 것이 정확히 18개** (ADR 수치 확증). 나머지 21개는 자식 스타일 주입·필터 전용이라 본 ADR 대상 밖이다.

| 구분                     | 수  | 태그                                                                                                                                                |
| ------------------------ | --- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| prop 의존 (런타임 분기)  | 12  | breadcrumbs · checkboxgroup · datefield · gridlist · inlinealert · separator · table · tabs · textarea · togglebutton · togglebuttongroup · toolbar |
| 정적 (catalog 대체 후보) | 6   | gridlistitem · listboxitem · tablist · tabpanels · taggroup · taglist                                                                               |

**핵심**: 이 18분기는 **L3 의 우회**다. `toolbar` 분기의 `gap = sizeName === "sm" ? 4 : "lg" ? 10 : 8` 은 catalog `Toolbar.sizes[size].gap` 을 손으로 옮겨 적은 SSOT 사본이고, `implicitStyles.ts` 에는 catalog `sizes` 조회가 **0건**이다 (같은 조회가 `utils.ts` 에는 컴포넌트별로 20곳 넘게 흩어져 있다). 즉 대안 C 가 진단한 실패 모드가 이미 코드에 들어와 있다.

→ **L3 를 열면 prop 의존 12종도 상당수 대체 가능**하다 (`sizes[size]` 조회가 곧 size 분기이므로). 대체 불가는 `containerProps` 의 **비-size** prop 에 의존하는 것뿐 (table `heightMode` · gridlist `layout` · toolbar/togglebuttongroup `orientation`). R6 의 "size 의존 padding 은 catalog 표현 불가" 전제는 **L3 를 여는 순간 무효**가 된다 — R6 은 완화 방향으로 재평가 대상.

### 2-4. Phase 2·3 대상 목록 확정

| 목록                           | 확정 수 | 비고                                                                        |
| ------------------------------ | ------- | --------------------------------------------------------------------------- |
| 비대칭 (import 됨·엔진 미도달) | **19**  | 구 21 — 정적 경로 분류 기준. 17종이 L1 차단, 2종(Slot/Tab)만 catalog 미보유 |
| 양쪽 미도달                    | **23**  | Phase 2 의 import 추가 판정 대상                                            |
| DOM 채널만 보유                | 2       | GridListItem · Input — 수동 CSS 실효값을 catalog 로 정정                    |
| factory 인라인 유일 공급원     | 7       | Phase 4 제거 대상                                                           |
| 수기 배선                      | 18      | 정적 6 즉시 대체 · prop 의존 12 중 size 축은 L3 개방 후 대체                |

산출 데이터: `adr171-{gencss,catalog-paths,matrix,factory}.json` (세션 스크래치패드 — 재현 스크립트는 본 문서 §4 방법 그대로).

## 3. Phase 분해

### Phase 1 — 실효값 ↔ catalog 정합화 — **완료 2026-07-29 (6종)**

생성 CSS root 선언이 수동 CSS 에 덮이는 종. **실효 computed 값이 정본**이고 catalog 를 그 값으로 정정한다.

#### 대상 재산출 — 9종이 아니라 7종, 그중 6종만 정정 대상

ADR 본문 Hard Constraint 2 의 "9종" 은 생성 CSS root 파싱 결함에서 나왔다. 생성 CSS 는 **CSS 중첩**을 쓰고 root 블록 안에 `/* Base styles — archetype: X */` 주석이 있는데, 순진한 선언 정규식이 ① 중첩 규칙 본문을 root 선언으로 읽고 ② `/* … archetype: overlay */` 를 `archetype: …` 선언으로 매칭해 **그 뒤의 첫 실제 선언을 삼켰다**. 그래서 Slider 가 `position:absolute`(실은 중첩 `.slider-track-bg` 의 값)로, Popover 가 `position:fixed` 누락으로 잡혔다.

주석·중첩을 제거하고 다시 판정하면 — 그리고 판정을 정규식 비교가 아니라 **브라우저에 맡기면**(root 선언을 그대로 인라인으로 넣은 대조 div 와 클래스를 붙인 div 의 `getComputedStyle` 비교) — 불일치는 **7종**이다.

| 컴포넌트    | 구 판정    | 실측 판정 | 내용                                                        |
| ----------- | ---------- | --------- | ----------------------------------------------------------- |
| Slider      | 불일치     | **일치**  | root 가 이미 `display:grid` — 구 판정은 중첩 규칙 잘못 읽음 |
| Meter       | 불일치     | **일치**  | `gap:4px` 가 마지막 선언이라 실효와 동일                    |
| ProgressBar | 불일치     | **일치**  | 〃                                                          |
| TabPanel    | 불일치     | **일치**  | root `flex column pad 12` = 실효                            |
| TableView   | 불일치     | **일치**  | root `flex column stretch center` = 실효                    |
| Pagination  | 불일치     | 불일치    | root `inline-flex center` → 실효 `flex space-between gap 8` |
| Popover     | 불일치     | 불일치    | root 에 `display` 없음 → 실효 `flex column`                 |
| Dialog      | 불일치     | 불일치    | root 에 `overflow` 없음 → 실효 `auto`                       |
| Tab         | 불일치     | 불일치    | root `position:static` → 실효 `relative`                    |
| ListBoxItem | **미발견** | 불일치    | root `position:static` → 실효 `relative`                    |
| Switch      | **미발견** | 불일치    | root `padding 0` → 실효 `4px 0` · `position` → `relative`   |
| TextArea    | **미발견** | 불일치    | **정정 제외** — 아래 클래스 역할 충돌                       |

#### 적용한 정정 (6종)

| 컴포넌트    | catalog 변경                                                           | 실효값 출처 (수동 CSS) |
| ----------- | ---------------------------------------------------------------------- | ---------------------- |
| Dialog      | `structure.containerStyles` 신설 — `overflow: "auto"`                  | `overlays.css:49`      |
| ListBoxItem | `position: "relative"` 추가                                            | `ListBox.css:75`       |
| Pagination  | `containerStyles` 신설 — `display` / `justifyContent` / `gap`          | `Table.css`            |
| Popover     | `display: "flex"` · `flexDirection: "column"` 추가                     | `Popover.css:35`       |
| Switch      | `position: "relative"` 추가 + `sizes.{sm,md,lg,xl}.paddingY` `0` → `4` | `Switch.css:30`        |
| Tab         | `structure.containerStyles` 신설 — `position: "relative"`              | `TabsIndicator.css`    |

#### TextArea 제외 사유 — 값 결함이 아니라 **클래스 역할 충돌**

`.react-aria-TextArea` 가 두 DOM 역할에 동시에 쓰인다: 생성 CSS 는 이것을 **field wrapper**(`flex column · gap 6`)로 보고, `base.css:4` 는 `.react-aria-Input` 과 묶어 **실제 `<textarea>` 요소**(`padding: var(--input-padding)`)로 본다. 실효 padding 4px 는 후자에서 온다. 이걸 "실효값" 이라며 catalog wrapper 에 옮기면 **wrapper 에 input padding 을 박는 것**이다. 값 축이 아니라 이름 축 문제라 Phase 2 판정 항목으로 넘긴다 (동일 충돌: `Input` — 생성 CSS 미import 라 표면화만 안 됐다).

#### G1 — 실효 computed 불변 확증

- 재빌드 결과 변경된 생성 CSS 파일은 **정확히 6개**이고 diff 는 의도한 선언뿐이다 (나머지 87개 byte 불변 → 실효가 바뀔 수 없다).
- 변경 6종의 실효 computed 를 정정 전후로 대조 — **전건 불변**. Dialog `overflow:auto` · Popover `flex column pad16 gap12 fixed` · Pagination `flex space-between gap8` · Tab `inline-flex center pad4/12 relative h29` · Switch `inline-flex center gap10 padY4 relative h8` · ListBoxItem `flex column flex-start center gap2 pad4/12 relative`.
- 정정 후 root↔실효 불일치: **7종 → 1종**(TextArea, 위 사유로 의도적 잔존).
- 라이브: 실행 중인 dev 서버의 모듈 그래프에서 `COMPONENT_RULES_TABLE` 을 직접 import 해 6종 정정값 반영 확인.

**Why 값이 안 바뀌는데 고치는가**: 이 정정이 옮기는 것은 값이 아니라 **소유권**이다. 실효값이 수동 CSS 에만 있으면 catalog 를 읽는 소비자(Style Panel · Skia · Phase 3 이후의 resolver)가 그 값을 **모른다**. Popover 의 `boxShadow` 가 같은 이유로 2026-07-25 에 이관됐고(`Popover.css:27` 주석), Phase 1 은 같은 작업을 layout 축으로 넓힌 것이다.

### Phase 2 — 미import 32종 판정 — **판정 완료 2026-07-29 (import 추가 0건)**

생성 CSS 94개 중 62개만 `index.css` 에 import 됨. 나머지 32개는 DOM 도 못 받는다.

#### 판정을 뒤집은 사실 — 미import 32종의 selector 는 **DOM 에 존재하지 않는다**

"import 를 추가하면 DOM 에 도달한다" 는 전제가 성립하려면 DOM 요소가 `.react-aria-{X}` 클래스를 달아야 한다. 실측 결과 32종 중 **어느 것도 RAC 컴포넌트가 아니다** (`renderers/*.tsx` 가 `react-aria-components` 에서 import 하는 심볼 10개에 32종이 0건 포함) — 전부 composition 자체 렌더러가 그리고, 그 렌더러는 `className={element.props.className}` 을 통과시킬 뿐이다. Card 계열은 아예 **다른 이름**을 쓴다 (`renderCardHeader` → `className="card-header"`, `LayoutRenderers.tsx:372`).

즉 이 32개 생성 CSS 는 **selector 가 아무것도 매치하지 않는 dead CSS** 이고, import 를 추가해도 DOM 은 변하지 않는다. R4("일괄 import 하면 수동 CSS 와 충돌해 DOM 이 바뀐다")가 걱정한 충돌은 발생 자체가 불가능하다 — 대신 **import 가 해결책이 아니라는** 더 근본적인 사실이 드러났다.

| 판정                                             | 수     | 처리                                                                                               |
| ------------------------------------------------ | ------ | -------------------------------------------------------------------------------------------------- |
| **A. dead selector** — DOM 에 클래스 자체가 없음 | **30** | **import 추가 불요** (no-op). 미import 유지 명문화. catalog 값은 Phase 3 의 Skia 채널로만 소비된다 |
| **B. DOM 채널 보유 + 실효 layout 있음**          | 2      | GridListItem · Input — 수동 CSS 실효값이 정본, catalog 정정                                        |

- DropZone / FieldError / Skeleton / Toast 는 소스에 `react-aria-{X}` 문자열이 있지만 **실측 computed 는 브라우저 기본**이다 (해당 CSS 가 layout 을 걸지 않음) → A 로 분류.
- A 30종의 생성 CSS 파일 **삭제는 하지 않는다**. 파일이 catalog→CSS 생성기의 출력물이라 지워도 재생성되고, Phase 3 이후 catalog 값의 정합성 점검에 대조본으로 쓰인다. `index.css` 미import 상태를 유지하는 것이 결론이다.

#### 적용한 정정 (1종) + 보류 (1종)

| 컴포넌트     | 판정                                                                          | 처리                                            |
| ------------ | ----------------------------------------------------------------------------- | ----------------------------------------------- |
| GridListItem | 실효 DOM 이 `justify-content: center` 인데 catalog 에 없어 Skia 만 flex-start | `structure.containerStyles.justifyContent` 추가 |
| Input        | **보류** — 측정 방법의 한계                                                   | Phase 5 fixture 로 재측정 후 판정               |

**Input 보류 사유 — bare probe 는 부모 문맥을 못 잡는다**: `base.css:9` 는 `padding: var(--input-padding, var(--spacing))` 이고 `--input-padding` 은 **부모 field 의 생성 CSS** 가 정한다 (`TextField.css:137` · `ComboBox.css:220` · `ColorField.css:141` · `NumberField.css:186` — NumberField 는 `0`). 빈 div 에 클래스만 붙인 측정은 fallback(`--spacing` = 4px)을 읽으므로 실효값이 아니다. catalog `Input.sizes.md.paddingX = 12` 를 이 4px 로 "정정" 하면 오히려 틀어진다.

> 이 한계는 **Phase 5 fixture 설계 제약**이기도 하다 — fixture 는 클래스만 붙인 probe 가 아니라 **실제 컴포넌트 트리**를 렌더해야 한다 (부모가 정하는 custom property 가 값의 일부다).

- **판정 없이 일괄 import 금지** 원칙은 유지된다. 이번 판정의 결론이 "추가할 대상 0건" 이었을 뿐이다.

### Phase 3 — 전달 경로 일원화 — **완료 2026-07-29 (G2 PASS)**

**Phase 0 이 확정한 작업 범위 — 세 층을 모두 연다** (§2-0). 한 층만 열면 MenuItem 실효 6키 중 2키만 도달한다.

| 층  | 작업                                                                                                       | 대상                                           |
| --- | ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| L1  | 경로 A/B 2분기를 **단일 판정**으로 통합 + `structure.composition` 게이트 제거                              | `structure.containerStyles` 보유 48종          |
| L2  | `CONTAINER_STYLES_FALLBACK_KEYS` 확장 — `height` · `rowGap`/`columnGap` · `padding{Top,Right,Bottom,Left}` | 현행 17키 → 실효 키 집합                       |
| L3  | resolver 가 **`sizes[size]` 축도 읽는다** — `height`/`paddingX`/`paddingY`/`gap` → longhand 정규화         | 전 종 (수기 배선 18분기가 우회하던 바로 그 축) |

- L1 게이트 제거는 **Phase 1 완료 후에만** 허용 (게이트가 지금 잘못된 값의 유출을 막고 있다).
- L2 확장 시 store longhand 정책 준수 — `padding` shorthand 가 아니라 4-way longhand 로 낸다 (`style-ssot.md`).
- L3 는 `sizes` 를 읽되 **`parentStyle` 우선 규칙은 그대로**다 (사용자·factory 편집이 항상 이긴다).
- 수기 배선 18분기 중 **정적 6종**(gridlistitem · listboxitem · tablist · tabpanels · taggroup · taglist)은 L1+L2 만으로 대체. **prop 의존 12종** 중 size 축 의존분은 L3 개방으로 대체되고, 비-size prop 의존(table `heightMode` · gridlist `layout` · toolbar/togglebuttongroup `orientation`)만 존치 — 사유를 주석으로 남긴다.
- **R6 재평가**: "size 의존 padding 은 catalog 표현 불가" 전제는 L3 를 여는 순간 성립하지 않는다 (§2-3). 존치 사유는 size 축이 아니라 비-size prop 의존으로 좁힌다.
- **기존 계약 테스트가 필연적으로 RED 가 된다** (R8): `resolveContainerStylesFallback.test.ts` 는 47 케이스가 `toEqual` 로 반환값을 통째로 고정한다(ADR-080 G1). 특히 `listboxitem`/`gridlistitem` → `{}` lock(102~110행)은 Phase 3 이 바꾸려는 동작 그 자체다. 케이스별로 **새 기대값이 실효 CSS 와 일치함**을 근거로 갱신한다 — 통째 삭제·`skip` 금지.

#### 실행 결과 — L1 은 "merge" 가 아니라 "top-level 이 있으면 대체" 였다

L1 을 문자 그대로 단일 merge(`resolveCatalogContainerBase`)로 구현하자 55 케이스 중 22 가 RED 였고, 그중 **`menu` 가 결정적 반례**였다. Menu 의 top-level `containerStyles` 는 `inline-flex / center / fit-content`(트리거 박스, ADR-151 B7 **사용자 결정**)인데 `structure.containerStyles` 는 `flex column / maxHeight 300 / overflow auto`(popover 목록 패널)다. merge 하면 top-level 에 없는 키(maxHeight/overflow/padding/gap/flexDirection)가 새어 들어와 B7 결정이 뒤집힌다.

→ **top-level `rule.containerStyles` 는 override 가 아니라 캔버스 박스의 *대체* 선언**이다. CSS 생성기는 merge 의미를 쓰는 게 맞다(DOM Menu root 는 popover 니까). 두 소비자의 의미가 갈리는 지점이고, 이건 legacy 갈래가 아니라 실재하는 구분이다. 판정은 한 줄(`topLevelBox ?? resolveCatalogContainerBase(...)`)로 유지해 precedence 가 두 벌이 되지 않게 했다.

같은 이유로 **L3 도 top-level 보유 type 에는 적용하지 않는다**. 그 경우 `sizes` 는 하위 부품 크기를 뜻한다 — Tree `height 36`(행) · TagGroup `paddingX 12`(태그) · Slider `height 8`(트랙). 실제로 Tree/TagGroup 은 생성 CSS 자체가 없고 Slider 의 생성 root 에는 height 선언이 없다. 반대로 top-level 이 없는 type 은 `sizes` 가 유일한 크기 소스이고 생성 root 가 그 값을 그대로 emit 한다(MenuItem `height:32 · padding:4px 12px · gap:8px` / SliderTrack `height:8px`). 이 게이트를 넣자 RED 22 → 2 가 됐고, 남은 2 가 정확히 R8 이 지목한 `listboxitem`/`gridlistitem` lock 이었다.

부수 정정 2건: `gap` 은 row 축이고 `columnGap` 이 column 축 override 다(Slider 가 `gap 4` + `columnGap 16` 을 함께 갖는다) — 단일 `gap` 만 읽으면 columnGap 이 4 로 틀어진다. 그리고 shorthand(`padding`/`gap`)가 이미 공급된 type 에는 longhand 를 얹지 않는다(공존 금지, `style-ssot.md`).

#### 수기 배선 정리 — 2분기 제거

`gridlistitem`/`listboxitem` 분기의 base-axis·gap·padding 인라인이 전부 redundant 가 되어 제거했다. 특히 `gap: parentStyle.gap ?? 2` 는 **해로웠다** — L3 가 longhand 로 넣는데 이 줄이 shorthand 를 덧씌워 둘이 공존했다. `listboxitem` 분기는 자식 font 주입만 남았고, `gridlistitem` 은 catalog `sizes` 에 없는 `borderWidth` 만 남겼다. 제거 전후 라이브 box 가 완전히 동일해(아래) redundancy 가 실측으로 확인됐다.

나머지 16분기는 이번 phase 에서 건드리지 않았다 — prop 의존분의 대체 판정은 Phase 5 fixture 가 생긴 뒤가 안전하다.

#### G2 — 실효 DOM 대조 (20종, 2026-07-29 라이브)

resolver 출력 ↔ `getComputedStyle`(번들 CSS iframe) 를 12키(display/flexDirection/alignItems/justifyContent/rowGap/columnGap/padding 4-way/position/overflow)로 대조:

- **17/20 전건 일치** — Badge · Card · Checkbox · Code · ColorSwatch · Header · Icon · Kbd · **MenuItem** · Radio · SliderOutput · SliderTrack · Switch · Tab · Tooltip · ListBoxItem · GridListItem
- **잔존 3**: Dialog · Modal · Popover 의 `position: fixed` **미도달** — 아래 참조

대조 과정에서 **4번째 채널**이 드러났다: 생성 CSS 의 `/* Base styles — archetype: X */` 블록. catalog 에 없고 생성기만 아는 값이라 Skia 에 갈 길이 없다. Card `alignItems/justifyContent` · Header `display/alignItems` · Tab `display/alignItems/justifyContent` 3종은 Phase 1 패턴대로 catalog 로 이관해 해소했다(값 불변).

**`position: fixed` 3종은 의도적 잔존**이다. 캔버스의 Dialog/Modal/Popover 는 저작 대상 in-flow 요소이고, `fixed` 를 받으면 out-of-flow 로 빠져 배치가 무너진다 — Menu 트리거 박스(B7)와 같은 종류의 **의도된 소비자별 차이**다. 나머지 archetype 파생값은 전부 도달한다.

#### 라이브 확증 (실 builder, components 페이지)

`MenuItem` **h=96 → h=32**. ADR 본문 Hard Constraint 1 이 지목한 바로 그 수치이고, 실효 DOM `height:32px` 와 일치한다. 함께 측정한 값: ListBoxItem 76 · GridListItem 68 · Toolbar 263×29 · InlineAlert 90 · Card 322. 수기 배선 2분기 제거 전후 이 값들이 **완전히 동일**했다.

### Phase 4 — factory 인라인 제거

- catalog 가 도달하면 factory 의 layout 인라인(`display`/`flexDirection`/`alignItems`/`justifyContent`/`gap`/`padding` 계열)은 중복이다. 제거해야 catalog 가 SSOT 로 실효를 갖는다(`resolveContainerStylesFallback` 은 `parentStyle[key] !== undefined` 면 catalog 를 건너뛴다).
- 제거 전후 Skia box 가 **불변**임을 Phase 5 fixture 로 확증한 뒤 제거한다.
- **Inspector baseline 을 같은 phase 에서 함께 정리한다** (R7): `useResetStyles.ts` 는 factory 인라인을 손으로 미러한 dirty/reset baseline 을 갖고 있다(`StylesPanel.tsx:96` — "factory 가 주입한 layout default 는 제외"). 인라인만 빼고 baseline 을 두면 "수정 N" 뱃지와 reset 목적지가 어긋난다 — 반대 방향(인라인만 넣고 baseline 누락)의 회귀 이력이 이미 있다(`useResetStyles.ts:292`). 종료 조건은 Skia box 불변 **＋** 패널 표시값·dirty·reset live 확인.
- `width`/`height` 같은 layout-context 인라인은 대상 아님(요소별 저작 값).

### Phase 5 — end-to-end parity 오라클 신설 — **완료 2026-07-29 (G3 PASS)**

현행 `apps/builder/tests/parity/**` 918 케이스는 전부 generic `box` + 인라인 style 이다(`harness.ts` — "노드 type 은 특수 분기(catalog/spec) 없는 generic block 컨테이너 `box`"). catalog 전달 축 fixture 는 **0건**이었다.

산출물: `apps/builder/tests/parity/catalogComponentBox.browser.test.ts` (15 케이스). 전체 parity **918 → 933**.

- leg 1 = `.react-aria-{Type}` 클래스 + **실 번들 CSS**(`index.css?inline`, 생성 CSS + 수동 CSS 캐스케이드 결과)의 `getBoundingClientRect`. leg 3 = 같은 트리를 `elementType: "{Type}"` 으로 `calculateFullTreeLayout` 에 태운 결과.
- **두 leg 사이에 인라인 style 이 없다** — 컨테이너는 catalog 에서만 스타일을 받는다. 인라인을 주는 순간 `parentStyle[key] !== undefined` 규칙이 catalog 를 건너뛰어 fixture 가 자기 자신을 검증하게 된다.
- **Phase 4 보다 뒤에 둘 수 없다** — 인라인이 살아 있으면 전부 GREEN 이 나와 아무것도 증명하지 못한다. 순서는 Phase 3 → 5(도입) → 4(인라인 제거, fixture 가 감시).

#### G3 — 민감도 실측

`resolveContainerStylesFallback` 의 catalog 보강을 통째로 되돌리면(`return specOut` 조기 반환) **6종 중 5종이 RED** 가 된다: MenuItem · ListBoxItem · GridListItem · Tooltip · InlineAlert. `DisclosureGroup` 만 GREEN 을 유지하는데, 그 종은 값이 spec fallback(`specOut`)에서 오므로 **catalog 채널의 감시자가 아니다** — fixture 가 catalog 전달을 검증했다고 말할 때 근거로 쓰면 안 된다.

#### 설계에서 걸러낸 것 — 무엇을 못 재는지가 fixture 의 절반이다

초안은 15종을 넣었다가 **13종이 RED** 였는데, 대부분 fixture 자체의 결함이었다:

| 걸러낸 축                                          | 증상                                                          | 처리                                              |
| -------------------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------- |
| inline formatting context                          | `inline-flex` 컨테이너가 DOM 은 shrink-to-fit, 엔진은 부모 폭 | root 를 flex row 로 — 양쪽 다 flex item           |
| leaf primitive (Badge/Kbd/Code/Icon/ColorSwatch/…) | host w 가 padding 무관하게 64 고정                            | 제외 — 캔버스는 `buildCatalogShapes` 로 직접 그림 |
| 합성 indicator (Checkbox/Radio/Switch)             | 자식 x 가 28/46 씩 밀림                                       | 제외 — DOM 은 `::before`, 캔버스는 자식 주입      |
| 자식 제외 컨테이너 (Menu/TabPanels)                | 자식 layout 결과 자체가 없음                                  | 제외                                              |
| dead selector (CardHeader/CardContent…)            | ground truth 가 브라우저 기본값                               | 제외 (Phase 2 판정)                               |

**엔진의 inline flow 미지원**은 ADR-170 §사각 표에 기재된 별개 표면이고, leaf box parity 는 `calculateFullTreeLayout` 자식 배치와 다른 축이다. 이 둘을 catalog 전달 실패로 세면 오라클이 거짓말을 한다.

#### 잔존 — Phase 3 의 size 축 게이트가 생성기 규칙과 갈린다 (→ Phase 3-b)

걸러낸 뒤에도 6종이 남았고, **이건 진짜 발견**이다. Phase 3 은 "top-level `containerStyles` 를 가지면 `sizes` 는 하위 부품 크기" 라는 휴리스틱으로 size 축을 갈랐는데, 생성기(`CSSGenerator.ts`)의 실제 규칙은 다르다:

- `ownsContainerBox` = `structure.composition` 이 layout/containerStyles/containerVariants 중 하나 보유 → **sizes 의 height·padding emit skip**
- `skipPadding` = ownsContainerBox ∨ 병합된 `containerStyles.padding` 존재 / `skipGap` = 병합된 `containerStyles.gap` 존재

| 종                                   | 발산                        | 원인                                                               |
| ------------------------------------ | --------------------------- | ------------------------------------------------------------------ |
| Toolbar · Form · Checkbox/RadioGroup | sizes padding **과잉 도달** | 넷 다 `composition` 보유 → 생성 CSS 는 skip, 캔버스만 넣는다       |
| TabPanel                             | sizes padding **미도달**    | `composition` 부재 → 생성 CSS 는 emit. top-level 이 있어 막혔다    |
| ListBox                              | 높이 Δ2                     | `structure.containerStyles.borderWidth` 를 top-level 대체가 건너뜀 |

**Phase 3-b 방향**: size 축 게이트를 생성기 규칙 미러로 교체한다. 생성 CSS 존재 여부는 `structure.archetype` 보유로 판정 가능하다 — 실측 **118/123 일치**(불일치 5 = spec 기반 Image/Input/Label/Slot + 페이지 루트 body). Tree/TagGroup 은 archetype 이 없어 자동 제외되고(그래서 행 높이 36 · 태그 padding 12 가 새지 않는다), Menu 트리거 박스(ADR-151 B7)만 명시 예외로 남는다.

fixture 는 이 6종을 `[잔존]` 그룹에서 **발산이 있음**으로 고정한다 — 조용히 바뀌면 red 가 된다.

### Phase 6 — origin 재저작 + components 페이지 재구축

- 사용자 승인(2026-07-28: "components page내에 컴퍼넌트들은 전면 재작성되어도 상관없다") 범위.
- catalog 만으로 서는지 확인하는 **최종 live 게이트**.

## 4. 실측 근거 (2026-07-28)

| 측정              | 방법                                                           | 결과                                                         |
| ----------------- | -------------------------------------------------------------- | ------------------------------------------------------------ |
| 정적 전달 격차    | 생성 CSS root 92종 ↔ `resolveContainerStylesFallback(tag, {})` | 값 기준 실질 격차 69종, 수기 배선 제외 51종                  |
| import 여부       | `index.css` 의 `generated/*.css` 참조                          | 94개 중 **62개** import (unique `@import` 기준)              |
| 실효 computed     | 번들 CSS 를 iframe 에 주입 후 `getComputedStyle`               | 21종 중 **9종**이 root 선언 ≠ 실효값                         |
| 라이브 주입       | MenuItem 에 8키 주입 후 Skia box 재측정                        | 390×96 → **280×32**, 자식 x=12/44/121/199 — CSS 값 정확 재현 |
| catalog 경로 분포 | `componentRulesTable.ts` brace 매칭 스캔 (소문자 키 포함)      | 총 **123** · A 24 · B 25 · 미보유 **74**                     |
| factory 인라인    | `factories/definitions/*.ts` layout 키 grep                    | layout 축 141 선언 / **7 파일** (+ width 89 · height 15)     |

## 5. 파일 변경 예상

| 영역                   | 파일                                                                                                                                                     | Phase |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| catalog 값 정정        | `packages/shared/src/catalog/**` (9종 + Phase 2 판정분)                                                                                                  | 1·2   |
| 생성 CSS               | `packages/shared/src/components/styles/generated/*.css` (재빌드) · `index.css` (import 판정 — publish 도 `components/index.css` 경유로 같은 번들을 쓴다) | 1·2   |
| 전달 경로              | `apps/builder/src/builder/workspace/canvas/layout/engines/implicitStyles.ts` · `packages/specs/src/runtime/containerStylesFallback.ts`                   | 3     |
| **기존 계약 테스트**   | `apps/builder/src/builder/workspace/canvas/layout/engines/resolveContainerStylesFallback.test.ts` (47 케이스 `toEqual` lock — **의도된 갱신 대상**, R8)  | 3     |
| factory 인라인         | `apps/builder/src/builder/factories/definitions/*.ts` (layout 키 보유 **7 파일**: DateColor/Display/Form/Group/Navigation/Overlay/Selection)             | 4     |
| **Inspector baseline** | `apps/builder/src/builder/panels/styles/hooks/useResetStyles.ts` (factory 인라인 미러 baseline — R7)                                                     | 4     |
| fixture                | `apps/builder/tests/parity/catalogComponentBox.browser.test.ts` (신규)                                                                                   | 5     |

## 6. 체크리스트

- [x] **Phase 0 — I1/I2/I3 인벤토리 확정 (2026-07-29)** — 차단 3층(L1 게이트 / L2 키 allowlist / L3 `sizes` 축) 발견, 대상 목록 확정 (§2)
- [x] **Phase 1 — catalog 정정 6종 + 재빌드 + 실효값 불변 재측정 (G1 PASS, 2026-07-29)** — 대상이 9종이 아니라 7종(생성 CSS 파싱 결함 정정)이고 TextArea 는 클래스 역할 충돌로 Phase 2 이관
- [x] **Phase 2 — 판정 표 확정 + 처리 (2026-07-29)** — 미import 32종은 selector 가 DOM 에 없는 dead CSS 라 **import 추가 0건**. GridListItem `justifyContent` 정정 1건 · Input 은 부모 custom property 문맥 탓 Phase 5 재측정 보류 · TextArea 클래스 역할 충돌 기록
- [x] **Phase 3 — L1·L2·L3 3층 개방 + 수기 배선 2분기 제거 + 계약 테스트 갱신 (G2 PASS, 2026-07-29)** — 실효 DOM 대조 17/20 일치, 잔존 3은 overlay `position:fixed`(의도적). MenuItem h 96→32 라이브 확증
- [x] **Phase 5 — parity fixture 신설 (G3 PASS, 2026-07-29)** — `catalogComponentBox.browser.test.ts` 15 케이스(전체 918→933). Phase 3 되돌림 시 6종 중 5종 RED. 잔존 6종은 Phase 3-b(생성기 규칙 미러)로 분리
- [ ] Phase 3-b — size 축 게이트를 생성기 `ownsContainerBox` 규칙 미러로 교체 (Toolbar/Form/Checkbox·RadioGroup 과잉 · TabPanel 미도달 · ListBox borderWidth)
- [ ] Phase 4 — factory 인라인 제거 + `useResetStyles` baseline 동시 정리 (fixture GREEN + 패널 live 확인, G4)
- [ ] Phase 6 — origin 재저작 + components 페이지 live 확인 (G5)
