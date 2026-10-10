# ADR-258 Design Breakdown — Color 조작기의 Canvas 그라데이션 · thumb + S2 색 축 prop

> 본문: [258-color-controls-canvas-gradient.md](../258-color-controls-canvas-gradient.md). 이 문서가 Phase · 파일 · 검증의 정본이다. `docs/adr/evidence/` 는 gitignore 라 실측 결론은 여기 §5 에 둔다.

## 1. 전제 (lock-in)

- 한 ADR 안의 Phase — fork 없음. 선행 ADR 의존: ADR-256 (노드 트리를 RAC 부품 그대로 · 판정 하나 · `showWhen` — 부품 노드 모델) · ADR-253 / 254 (부품 원본 · 글자 소유 = template 바인딩) · ADR-250 (Preview 조작 = 실행 상태) · ADR-248 G3 하니스. 의존 방향은 전부 「이 ADR 이 소비」 — 반전 없음.
- D2 정본 S2 1.8.0 = RAC 1.21.0 이름 (사용자 2026-10-09). 시각 값은 D3 (catalog) — 레퍼런스 값 변경은 사용자 결정 2.
- 범위 밖: ColorPicker 조립 · ColorField · ColorSwatch(Picker) · S2 장식 (체커보드 · loupe).

## 2. 사실 표 (코드 인용 — 2026-10-11 실측)

| #   | 사실                                                                                                                                                                                                                                                  | 위치                                                                                                                                                            |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F1  | 세 binding 의 accepts 에 `value` · `defaultValue` · 색 축이 없다                                                                                                                                                                                      | `bindings/ColorArea.binding.ts:29-33` · `ColorSlider.binding.ts:30-45` · `ColorWheel.binding.ts:31-39`                                                          |
| F2  | Canvas 는 generic rule 상자 — binding 에 `skiaPrimitive` 없음, Color 전용 Canvas 코드 0 (ColorWheel 지름 · ColorSwatch 정사각만)                                                                                                                      | `canvasBinding.ts:376-417` · `ruleShapes.ts:196-233` · `compositionRoot.ts:926-937` · `resolveCatalogRuleCanvasBox.ts:402-410`                                  |
| F3  | Preview 는 `RAC[component]` 를 자식 없이 그린다 (세 type 은 `DOM_LEAF_TYPES`) · 공용 래퍼 3 파일은 catalog runtime 이 import 하지 않는다                                                                                                              | `domBinding.tsx:1574-1577` · `nestingRules.ts:197-200` · `packages/shared/src/components/Color{Area,Slider,Wheel}.tsx`                                          |
| F4  | 설치 RAC 는 value · defaultValue 없는 ColorSlider 에서 던진다 — `renderToString` THROW `useColorSliderState requires a value or defaultValue`                                                                                                         | `react-stately/dist/private/color/useColorSliderState.mjs:22` (실측 2026-10-11, channel 유무 무관)                                                              |
| F5  | ColorArea 기본값 `#ffffff` · ColorWheel `hsl(0, 100%, 50%)` · 축 기본 = 첫 채널 ≠ 다른 축                                                                                                                                                             | `useColorAreaState.mjs:20,23` · `useColorWheelState.mjs:18,52` · `Color.mjs:118-122` `getColorSpaceAxes`                                                        |
| F6  | ColorArea 그라데이션 — rgb 3 층 + `screen`, hsl/hsb 두 층 (뒤집음) + z=hue 면 바탕색, thumb `left/top %` · `translate(-50%, -50%)` · `background-color` 표시색                                                                                        | `react-aria/dist/private/color/useColorAreaGradient.mjs:17-103` · `react-aria-components/dist/private/ColorThumb.mjs:23-24`                                     |
| F7  | ColorSlider 그라데이션 — hue 7 · lightness 3 · 그 외 2 stop, `to right` (가로 ltr) / `to top` (세로), **track** `background`                                                                                                                          | `useColorSlider.mjs:42-108`                                                                                                                                     |
| F8  | ColorWheel — track `conic-gradient(from 90deg, hsl 13 stop)` + `clipPath: path(evenodd, 바깥, 안)` · `outerRadius × 2` · thumb px (반지름 `(inner + outer) / 2`)                                                                                      | `useColorWheel.mjs:37,208-244`                                                                                                                                  |
| F9  | Skia — `applyFill` linear / radial / angular 셰이더, `screen` BlendMode, evenodd path, `GradientShape` (한 층) + 변환기 — production 생산자 0, 옛 spec 이 썼다                                                                                        | `skia/fills.ts:83-171` · `blendModes.ts:40` · `nodeRendererBorders.ts:177` · `shape.types.ts:364-382` · `specShapeConverter.ts:1056-1131` · `9a0e90f4c^` spec 3 |
| F10 | 값 → thumb 위치 선례 (Slider) · 고리 선례 (ProgressCircle `value_fill_arc`)                                                                                                                                                                           | `presence.ts:995-1027` `catalogSliderThumbLayout` · `SliderThumb.binding.ts:26` · `ProgressCircle.binding.ts:95` · `skiaPrimitives.ts:1876-`                    |
| F11 | 수동 CSS — thumb 16px · 테두리 4px `--bg-raised` · `--shadow-sm` · focus 20px (3 파일 중복), ColorArea 180px · `radius-md`, track 20px (세로 150 · 폭 20), disabled `gray !important`                                                                 | `components/styles/ColorArea.css:5-37` · `ColorSlider.css:2-81` · `ColorWheel.css:2-27` · `index.css:118-119,146`                                               |
| F12 | rule — ColorArea sizes 120/180/240 (binding `size` 없음 → M 만 닿음), ColorSlider 16/20/24 (같음), ColorWheel height 0 (지름은 prop)                                                                                                                  | `componentRulesTable.ts:2411-2462` · `:2710-2748` · `:2902-2945`                                                                                                |
| F13 | 팔레트 — Color 계열은 ColorField 뿐 · 카테고리 7 에 `color` 없음 · 원본 template 0 (ColorField · ColorSwatch · ColorSwatchPicker 만) · `componentTraits` 항목 없음                                                                                    | `paletteItems.ts:205-260` · `componentCatalog.ts:1341-1370,1441-1447` · `reusableOriginLibrary.ts` grep 0 · `componentTraits.ts`                                |
| F14 | G3 하니스는 팔레트 밖 type 도 `catalogTypeDefinitionId` 로 넣는다                                                                                                                                                                                     | `paletteInsert.ts:39-48` · `tests/adr248-g3/propAxisCanvasDom.browser.test.ts`                                                                                  |
| F15 | S2 1.8.0 — ColorArea `size: 192, minSize: 64` · ColorWheel thickness 24 · floor 175 · handle 16 (focus 32) · S2 전용 prop 없음 (ColorSlider `label` · ColorWheel `size` 뿐)                                                                           | 격리 사본 `…/1f6cc74d…/scratchpad/s2pkg/node_modules/@react-spectrum/s2/src/Color{Area,Wheel,Handle}.tsx:67-68,62-63,21` · `s2props.json`                       |
| F16 | `LIBRARY_CONTRACT_VERSION = 37` (2026-10-11 — ADR-256 동시 변경으로 36 → 37, 착수 시점 최신 값 + 1 을 쓴다)                                                                                                                                           | `document/types.ts:95`                                                                                                                                          |
| F17 | `parseColor` 가 받는 구문 — hex `#rgb` · `#rgba` · `#rrggbb` · `#rrggbbaa`, 쉼표 `rgb/rgba` · `hsl/hsla` · `hsb/hsba`; 그 밖은 `Invalid color value` (`red` · `rgb(255 0 0)` 실측)                                                                    | `react-stately/dist/private/color/Color.mjs:25-29` · RGB `parse` · `:397` HSB_REGEX · `:537` HSL_REGEX                                                          |
| F18 | 세 state hook 은 `useControlledState` — 첫 `defaultValue` 만 `useState` 에. 같은 key 에서 기본값을 바꿔도 상태 유지 (round 1 JSDOM 재현) · Slider 는 `key: ${id}:${value}` 로 다시 시작                                                               | `useColorAreaState.mjs:27` · `useColorSliderState.mjs:26` · `useColorWheelState.mjs:56` · `utils/useControlledState.mjs:19` · `delegatedDom.tsx` `slider`       |
| F19 | RAC 글자 소유 경로는 Slider 전용 — `RAC_TEXT_OWNERS = { SliderOutput: "Slider" }` + 숫자 포맷 · DOM 이 빈 children 을 넘겨 RAC 기본 글자 (ColorSlider Label 채널 이름 · Output `120°`) 를 지운다 · `SliderOutput` · `SliderTrack` owners 는 Slider 만 | `valueBindings.ts:164-184,235` · `domBinding.tsx:753-758` · `ColorSlider.mjs:77` · `useColorSliderState.mjs:76-80` · `componentTraits.ts:350-351`               |
| F20 | 패널 prop 편집은 키 하나씩 patch                                                                                                                                                                                                                      | `CatalogPropertiesPanel.tsx:333` `handlePatch({ [key]: value })`                                                                                                |

## 3. Phase

### Phase 0 — 인벤토리 · oracle 고정 (G0)

1. 저장 문서 집계 — IndexedDB 로컬 프로젝트 · seed · library · 예제 fixture 의 ColorArea · ColorSlider · ColorWheel 노드 수 (자식 없음 · prop) → 사용자 결정 1 의 수.
2. Preview 지금 표시 live 캡처 — ColorSlider (F4 가 실제로 어떻게 보이는가 — 오류 경계 · 빈 상자) · ColorArea (thumb 없음) · ColorWheel (track 없음).
3. **oracle 파일** — `apps/builder/scripts/adr258-rac-gradient-oracle.mjs`: 설치 RAC 를 `renderToString` 으로 마운트해 입력 행렬 (ColorArea: rgb/hsl/hsb × 축 기본 + 지정 2 × 값 3 (z 극단 포함) · ColorSlider: 채널 8 × 가로/세로 × 값 2 · ColorWheel: 180 · 240 × hue 3) 의 루트 `background` · `background-blend-mode` · thumb `left/top` · `background-color` 를 JSON 으로 고정 (`tests/fixtures/adr258-rac-gradient.json`). G1 의 기대값.
4. wheel 각도 ↔ 좌표 규약 — `useColorWheel.mjs` 의 좌표 함수와 `from 90deg` 의 관계를 한 줄로 고정 (thumb hue 90 이 어느 시계 방향인지).
5. Skia 경로 확인 — ① 상자 하나에 fill 여러 층 + 층별 blend 가 `buildCatalogShapes` → `renderCommands` 에서 닿는가 (`fills` 배열 · `blendModes.ts` 배선), ② `MakeLinearGradient` flags 인자 (premul) 노출 여부, ③ `GradientShape` 한 층 한계 → 확장 형태 결정 (`layers` 배열 + `blend` + `clip: ring`).
6. G3 하니스 fixture 3 type 추가 — 지금 상태의 기준선 (FAIL 기록).
7. 레퍼런스 예제 고정 — `curl react-aria.adobe.com/ColorArea.md` · `ColorSlider.md` · `ColorWheel.md` (구조 · CSS 값) → 사용자 결정 2 의 재료.
8. 쓰기 경로 전수 (Decision 8 · 1) — `defaultValue` · `colorSpace` · 채널을 쓰는 길: Properties 패치 명령 · AI prop 쓰기 · 붙여넣기 · import · library template. 패널/AI 수정/AI 생성의 호출 지점은 아래 고정 표를 따른다. 붙여넣기/import/library 는 저장된 조합을 마지막 검증기로 검사하는 경계와 구별해 표로 고정한다. 이 인벤토리만으로 실제 AI 배선 완료를 선언하지 않는다.

### Phase 1 — 공용 함수 · D2 accepts (G1)

- `packages/shared/src/catalog/runtime/colorControlGradient.ts` — `colorAreaGradient(props)` · `colorSliderGradient(props)` · `colorWheelGradient()` · `colorControlThumb(kind, props)` (위치 % 또는 px + 표시색). 입력은 문서 prop (string 색 · 축), 구현은 설치 react-stately `parseColor` (Preview 가 이미 싣는 구현 — Builder 번들 추가분은 G5 에 기록). 반환은 구조 (층 · 방향 · stop 문자열 · blend · 바탕) 와 CSS 직렬화 (G1 비교용).
- 단위: oracle JSON 전 행 문자열 동일 (G1) · 원복 RED (lightness 3 → 2 stop). 색 구문 표 · 글자 (채널 8 × en-US · ko-KR) · 정규화 전수 · 채널 보존 key (무채색 hue/소수 채널/alpha/공간 차이와 같은 tuple 의 표기 차이) · 실제 AI 수정 host 통합 (G1 — 각각 원복 RED).
- binding accepts — ColorArea `colorSpace` · `xChannel` · `yChannel` · `xName` · `yName` · `defaultValue`(기본 `#ffffff`), ColorSlider `channel`(기본 `hue`) · `colorSpace` · `label` · `defaultValue`(기본 `hsl(0, 100%, 50%)`), ColorWheel `defaultValue`(기본 `hsl(0, 100%, 50%)`).
- 색 값 타입 `racColor` (Decision 1 · round 1 h2) — `document/valueType.ts` 에 새 kind, 판정 `isRacColorString` (설치 `parseColor` 성공 ∧ 채널 유한) 하나를 검증기 · library template 검사 · binding 기본값 테스트 · import · AI 입력 경계가 부른다. 실패 = transaction 전 `VALIDATION` (revision 불변). 빈 값 = 기본값. Design 패널 색 입력 = draft + 판정 통과 시 commit (blur · Enter). resolver 의 parse 실패 폴백 = binding 기본값 (Preview 도 같은 값).
- 정규화 (Decision 8 · round 1 m1) — `colorControlGradient.ts` 옆 `normalizeColorControlPatch(type, props, patch)`: 유효 색 공간 계산 · `colorSpace` 변경 시 채널 유지 / 첫 채널 / 축 지움 · 공간 밖 채널 선택 시 공간 동반 변경 · 공간 없는 `defaultValue` 변경 시 이전 공간 고정. 패널/AI 수정은 아래 호출 지점에서 대상의 유효 문서 props 로 계산해 `setFields` 로 쓰고, AI 생성은 선택한 definition/origin 기본값을 기준으로 초기 props 를 정규화해 `insertNodes` 에 싣는다. 각각 기존 transaction/undo 한 항목을 유지한다. compiler `manifest.ts` 의 색 필드 검사도 같은 판정 함수를 써서 정상 색의 unsupported-field 거부를 막는다. 검증기 — 채널 ∉ 유효 색 공간 거부 (마지막 줄). 패널 선택지는 필터하지 않는다.
- 글자 (Decision 9 · round 1 m2) — `valueBindings.ts` `RAC_TEXT_OWNERS` 를 소유자별 글자 함수로: Slider 지금 그대로, ColorSlider `SliderOutput` → `formatChannelValue(channel, locale)` · 직계 `Label` (`{label}` 빈 값) → `getChannelName(channel, locale)`. dependent 갱신 목록에 ColorSlider `defaultValue` · `channel` · `colorSpace`. DOM 은 `catalogRacOwnsText` 부품에 children 을 넘기지 않는다 (Slider 회귀 없음 — 지금 Slider 출력과 같은지 G4). `componentTraits` `SliderOutput` · `SliderTrack` owners += ColorSlider.
- resolver — record `_colorGradient` (ADR-257 `_tableTracks` 자리 · `catalogDerivedProps` 옆) · thumb 노드 layout 파생 (`presence.ts` `catalogColorThumbLayout` — `catalogSliderThumbLayout` 과 나란히, owner 는 `catalogPartParent` 체인 루트 type 으로 판정 — R5).
- 머리말 3곳 · `componentCatalog.ts:1146-1152, 1179-1181` · `colorLeafCutover.test.ts` 의 보류 서술 삭제 · `S2_PROP_ALIGNMENT_2026-10.md` §6.1 색 축 줄 갱신.

### 정규화 호출과 통합 검증 (round 2 r2-l1)

| 경로            | 정규화 호출 지점                                                                                   | 현재 props                                                | 쓰기/완료 증거                                                                     |
| --------------- | -------------------------------------------------------------------------------------------------- | --------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Properties 수정 | `editContract.ts` `catalogPropertiesPatchCommand` → semantic 명령 생성 전                          | 각 대상의 유효 문서 props                                 | `setFields` · undo 한 항목                                                         |
| AI 수정         | `aiHost.ts` `writeCommands` → `catalogSemanticPatchCommand` 전 (패널 wrapper 경유 안 함)           | 수정 대상의 유효 문서 props                               | 실제 `update_element`/compiler → 등록 host.update → `setFields` · commit/undo 확인 |
| AI 생성         | `aiHost.ts` `createCatalogAiWriteHost.create` → `catalogCreationProps`/`insertNodes` 전 초기 props | 선택한 definition/origin 기본값, 없는 값은 binding 기본값 | 실제 `create_element`/compiler → 등록 host.create → `insertNodes` · 생성/undo 확인 |

- Phase 1: AI 수정 host 통합에서 `channel: red` → `colorSpace: rgb` 동반, 정상 색 입력 성공, 무효 색 거부/commit 없음/revision 불변. 해당 수정 호출만 끄면 RED.
- Phase 2: 새 원본 3개 후 AI 생성도 같은 색/조합 조건과 undo 한 항목을 검증한다. 생성은 props 를 수정용 `writeCommands` 에 넘기지 않으므로 생성 호출만 끄는 독립 RED 가 필요하다.
- `services/ai/compiler/manifest.ts`/필드 투영에 색 판정 연결 · `catalogRuntime/aiHost.ts` 수정/생성 배선 · `editContract.ts` 패널 배선을 파일 변경표에 포함한다. 함수 unit, Phase 0 경로 표, mock host 성공만으로 실제 catalog host 배선을 통과시킬 수 없다.
- 붙여넣기/import/library 의 검증은 조합 보존/거부 경계다. 정규화 없이 들어온 무효 색/조합도 최종 문서 검증기가 transaction 전 거부한다.

### Phase 2 — 구조 (E1) · Canvas · CSS (G2 · G4)

- 새 type `ColorThumb` (binding: RAC `ColorThumb`, prop 0) · `ColorWheelTrack` (RAC `ColorWheelTrack`, prop 0). `componentTraits` children · owners · `requiredParts` · `DOM_LEAF_TYPES` 에서 셋 제거 · `nestingRules` 소유자 계약 (`ColorThumb.owners`).
- 원본 template 3 (`reusableOriginLibrary` — ColorField 원본의 꼴): `ColorArea > ColorThumb`, `ColorSlider > Label {label} + SliderOutput + SliderTrack > ColorThumb`, `ColorWheel > ColorWheelTrack + ColorThumb`. contract 최신 + 1 (2026-10-11 현재 37 → 38). 기존 노드는 사용자 결정 1.
- Preview DOM — 노드 순서대로 RAC 부품 (ADR-256 판정 하나) · ColorSlider 의 `SliderTrack` 노드가 RAC `SliderTrack` 로 ColorSlider context 안에 (Slider 와 같은 경로 — `delegatedDom` 에 `colorslider` · `colorarea` · `colorwheel` renderer) · ColorWheel 의 radii 는 지금 `domBinding.tsx:1542-1551` 그대로. **key = `${node.id}:${canonical(defaultValue)}`** (Decision 7 · round 1 h1 · round 2 r2-h1). canonical 은 parse 된 **원래 공간 · 순서가 고정된 채널 이름/수치 전체 · alpha** 의 JSON tuple — hexa/RGB 변환이나 출력 문자열 반올림 없이 수치 보존, 빈 값/parse 실패는 binding 기본값. 무채색 hue 편집 · undo 도 다시 시작하고, key 에 끌기 값/다른 prop 은 넣지 않는다.
- Canvas 재그림 (R6) — ColorThumb · SliderTrack · ColorWheelTrack · Label · SliderOutput record 에 owner 파생값 (그라데이션 · thumb 색 · 글자) 을 실어 record diff 가 잡게 · 필요하면 owner dirty 를 자식으로 확장.
- rule — `ColorThumb` (part rule: 크기 16 · 테두리 4 `{color.raised}` · 그림자 · focus 20 · disabled 회색 · `radius.full`) · `ColorWheelTrack` (disabled 회색) · `SliderTrack` 의 ColorSlider nested 값 (높이 20 · 세로 폭 20 · `radius-md`) · ColorArea 의 disabled. 생성 CSS 가 `.react-aria-ColorThumb` 류를 내고 수동 CSS 3 파일에서 그 선언을 지운다 (남는 것: ColorSlider grid 영역 배치 — rule `structure` 로 옮길 수 있으면 같이). `pnpm build:specs` 재생성.
- Canvas — 세 binding 에 `skiaPrimitive` (replace): `color_area_fill` (층마다 linear 셰이더 · rgb `Screen` · premul flag · 모서리 radius) · `color_slider_track` (SliderTrack 노드가 그린다 — 방향 · 1 층) · `color_wheel_track` (evenodd 고리 clip 안 sweep, 시작 3시 · 회전 행렬 0 또는 Phase 0 (4) 값). `ColorThumb` 노드는 rule 상자 + record 표시색으로 원 (`slider_thumb` 와 같은 길). disabled 는 CSS 와 같은 회색 (`gray` 토큰 대응은 rule 값으로).
- G2 fixture — ColorArea rgb · hsl (hue × lightness · saturation × lightness) · hsb, ColorSlider hue · lightness · alpha · red × 가로 · 세로, ColorWheel 180 · 240 × 라이트 · 다크. 원복 RED: premul flag off → hsl saturation RED.
- G3 — AI 생성 host 통합/독립 원복 RED 및 채널 보존 key 의 무채색 hue 편집 · undo/redo; 이후 비기본 prop 편집의 진행 중 pointer drag/value 유지.
- G4 — Slider · RangeSlider? 의 G3 fixture Δ0 (R5) · G0 (a) 문서 열기 · contract 거부 메시지.

### Phase 3 — live · 팔레트 (G3 · G5)

- 사용자 결정 3 → `PALETTE_ORDER` · `PALETTE_REUSABLE_ORIGIN_TYPES` · `paletteOracle` 재캡처 · Components page 원본 3.
- live 하니스 `apps/builder/scripts/adr258-color-controls-live.mjs` — G3 전 항목 (prop 편집 새로고침 없이 · undo · 새로고침 · prop 없는 ColorSlider · Preview 끌기 revision 불변 · 끌기 → 기본값 편집 → undo · redo 다시 시작 · hsl/hue → red 한 번 선택 · 한 번 undo · `red` 입력 거부 · ColorSlider 글자 · 테마 전환 · page error 0).
- G5 — ratchet A 등급 카운트 (셰이더 생성 수: 정지 프레임 0 · 값 편집 1회당 상자 하나) `perf-ratchet-gate.mjs --update` · 번들 기록.
- CHANGELOG (Added — 색 축 prop · Canvas 그라데이션 · thumb; Changed — ColorSlider 기본값 · 수동 CSS → rule; contract 37) · README · `### Live Exercise`.

## 4. 파일 변경표 (예상)

| 영역         | 파일                                                                                                                                                                                                                              | 변경                                             |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| shared 함수  | `packages/shared/src/catalog/runtime/colorControlGradient.ts` (+test)                                                                                                                                                             | 신설                                             |
| AI/패널 쓰기 | `apps/builder/src/builder/catalogRuntime/editContract.ts` · `aiHost.ts` · `services/ai/compiler/manifest.ts`/필드 투영                                                                                                            | 패널·AI 수정·AI 생성 정규화와 racColor 검사 연결 |
| binding      | `bindings/ColorArea.binding.ts` · `ColorSlider.binding.ts` · `ColorWheel.binding.ts` · `ColorThumb.binding.ts` · `ColorWheelTrack.binding.ts` · `bindings/index.ts`                                                               | accepts · 신설 2 · skiaPrimitive                 |
| catalog      | `componentCatalog.ts` (entry 2 · 머리말) · `generated/componentRulesTable.ts` (rule 2 신설 · nested 값) · `document/generated/reusableOriginLibrary.ts` (원본 3) · `document/types.ts` (contract 37) · 검증기 (채널 ∉ 색 공간)    | 수정                                             |
| 도메인       | `domain/componentTraits.ts` · `nesting/nestingRules.ts` (`DOM_LEAF_TYPES` − 3 · owners) · `nesting/requiredParts.ts`                                                                                                              | 수정                                             |
| resolver     | `resolution/resolver.ts` (`_colorGradient`) · `runtime/presence.ts` (`catalogColorThumbLayout`) · `runtime/compositionRoot.ts` (`styleFor` 합류)                                                                                  | 수정                                             |
| DOM          | `runtime/domBinding.tsx` (ColorSlider SliderTrack context · ColorThumb 부품)                                                                                                                                                      | 수정                                             |
| Canvas       | `packages/rendering/src/renderers/skiaPrimitives.ts` (primitive 3) · `types/shape.types.ts` (`GradientShape` 층 · blend · ring clip) · `apps/builder/.../skia/specShapeConverter.ts` · `fills.ts` (premul flag) · `ruleShapes.ts` | 수정                                             |
| CSS          | `components/styles/ColorArea.css` · `ColorSlider.css` · `ColorWheel.css` (축소) · 생성 CSS (`pnpm build:specs`)                                                                                                                   | 수정 · 재생성                                    |
| 팔레트       | `panels/components/paletteItems.ts` · `paletteOracle.ts` (사용자 결정 3)                                                                                                                                                          | 수정                                             |
| 테스트       | `apps/builder/src/builder/catalogRuntime/__tests__/colorControls*.test.ts` · `tests/adr248-g3/propAxisCanvasDom.browser.test.ts` (fixture) · `apps/builder/scripts/adr258-*.mjs` · `tests/fixtures/adr258-rac-gradient.json`      | 신설                                             |
| 문서         | ADR 본문 · README · CHANGELOG · `S2_PROP_ALIGNMENT_2026-10.md` · `.claude/rules/ssot-hierarchy.md` (Color 조작기 한 줄 — thumb 노드 · 그라데이션 함수)                                                                            | 수정                                             |

## 5. Phase 0 결과

(착수 후 기록 — G0 (a) ~ (f) 의 수치 · oracle 행 수 · 각도 규약 · Skia 경로 판정.)

## 6. 검증 체크리스트

- [ ] G1 oracle 전 행 문자열 동일 · 색 구문 표 · 글자 · 정규화 전수 · 채널 보존 key · AI 수정 host 통합 · 해당 원복 RED
- [ ] G2 fixture 전부 pixelmatch 0.1 ≤ 0.001 (라이트 · 다크) · premul 원복 RED
- [ ] G3 live 전 항목 · AI 생성 host 통합/독립 원복 RED · 무채색 hue/undo/redo · 진행 중 drag 의 비기본 prop 편집 · page error 0
- [ ] G4 Slider fixture Δ0 · 기존 문서 · contract 거부
- [ ] G5 ratchet 카운트 · 번들
- [ ] `pnpm type-check` · `pnpm codex:preflight` · `pnpm docs:stale-symbols`
- [ ] 머리말 · 보류 서술 삭제 · CHANGELOG · README · Live Exercise
