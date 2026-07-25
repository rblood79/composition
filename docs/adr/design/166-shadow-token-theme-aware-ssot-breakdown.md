# ADR-166 구현 상세 — 그림자 토큰 theme-aware 승격 + boxShadow 값 언어 통일

> 본 문서는 [ADR-166](../166-shadow-token-theme-aware-ssot.md) 의 구현 상세다. 결정·위험·Gate 는 ADR 본문에 있다.

## §0. Phase 0 — inventory freeze (실측 baseline)

착수 시 아래 표를 재측정하여 갱신한다. 아래 값은 **2026-07-25 실측**.

### 0-1. catalog 그림자 선언 전수 (`componentRulesTable.ts`)

| 채널                                  | 건수 |                       값 언어                        | 해석 주체                                            | Skia 도달 |
| ------------------------------------- | ---: | :--------------------------------------------------: | ---------------------------------------------------- | :-------: |
| `structure.containerStyles.boxShadow` |    3 |   `color-mix(in srgb, var(--fg) N%, transparent)`    | 없음 — `emitContainerStyles` 가 **원문 그대로** emit |    ❌     |
| `structure.states.*.boxShadow`        |    1 |         raw rgba (`inset 0 1px 2px rgba(…)`)         | `CSSGenerator.resolveBoxShadow` (local)              |    ❌     |
| `indicatorMode.boxShadow`             |    1 |               TokenRef (`{shadow.sm}`)               | `CSSGenerator.resolveBoxShadow` (local)              |    ❌     |
| `staticSelectors` `"box-shadow"`      |    8 | `var(--shadow-sm/lg)` 6 · `var(--inset-shadow-xs)` 2 | 없음 (CSS 축 전용 채널)                              |    ❌     |
| `staticSelectors` `"box-shadow"`      |   30 |                       `"none"`                       | —                                                    |     —     |

- 소속: `containerStyles` 3 = Popover / Tooltip / Modal (2026-07-25 커밋 `47b26a8cc`·`bec606ec7`) · `states.pressed` = FileTrigger · `indicatorMode` = ToggleButtonGroup.
- **값 언어 4종**(color-mix+var / raw rgba / TokenRef / CSS var)이 한 카탈로그에 공존한다. 이 중 Skia 파서가 해석 가능한 것은 **raw rgba 뿐**이다.

### 0-2. 그림자 파서 2개 (SSOT 부재)

| 파서             | 위치                                            | 색 추출 정규식                         | 미스매치 시 색             |
| ---------------- | ----------------------------------------------- | -------------------------------------- | -------------------------- |
| `parseShadow`    | `packages/specs/src/primitives/shadows.ts:61`   | `rgba?\(…\)` \| `#hex`                 | `rgba(0, 0, 0, 0.1)`       |
| `parseOneShadow` | `apps/builder/…/sprites/styleConverter.ts:1174` | `rgba?\(…\)` \| `hsla?\(…\)` \| `#hex` | **`rgba(0,0,0,1)` 불투명** |

- 둘 다 `color-mix(` / `var(` 를 매칭하지 않는다.
- `parseOneShadow` 는 색 매칭 실패 시 원문에서 색 부분을 **제거하지 않은 채** 숫자를 추출하므로, `color-mix(… 15%, …)` 의 `15` 가 spread 자리로 흡수된다. 현재 3개 값은 spread 미사용이라 기하는 우연히 맞지만, 색이 있는 위치에 숫자가 더 늘면 blur 까지 오염된다.
- 전 세션 실측: `buildSkiaEffects({ boxShadow: "0 4px 12px color-mix(in srgb, var(--fg) 15%, transparent)" })` → `color = [0,0,0,1]` (불투명 검정). 대조군 `rgba(0,0,0,0.15)` → `alpha 0.15` 정상.

### 0-3. 토큰 층 — theme 인지 비대칭

|                     | light                             | dark                            | theme 분기 |
| ------------------- | --------------------------------- | ------------------------------- | :--------: |
| `--shadow-sm` (CSS) | `0 1px 2px 0 rgb(0 0 0 / 0.05)`   | `0 1px 2px 0 rgb(0 0 0 / 0.2)`  |     ✅     |
| `shadows.sm` (TS)   | `0 1px 2px 0 rgba(0, 0, 0, 0.05)` | (동일 — flat map)               |     ❌     |
| `--fg`              | `--color-neutral-900` (근-검정)   | `--color-neutral-100` (근-흰색) |     ✅     |

- `resolveToken(ref, theme)` 는 `color` 카테고리만 light/dark 분기하고 **`shadow` 카테고리는 flat map** 이다 (`tokenResolver.ts:34-50`).
- 따라서 `{shadow.md}` 는 CSS 로는 theme 반응(`var(--shadow-md)`), Skia 로는 light 고정으로 **같은 토큰이 축마다 다른 값**이 된다.
- `--shadow-*` 의 dark 정책은 "검정 유지 + 불투명도 상향"(0.05→0.2, 0.1→0.3~0.5). 반면 `containerStyles` 3건의 `color-mix(var(--fg) N%)` 는 dark 에서 `--fg` 가 근-흰색이라 **밝은 번짐(glow)** 이 된다 — 정책 반대 방향. (정의 기반 도출, live 미실측 → Gate G1)

### 0-4. Skia 소비 경로

- `buildSkiaEffects(style)` 는 `element.props.style.boxShadow` 만 읽는다 (`buildBaseNodeProps.ts:73` / `buildSkiaNodeData.ts:90` / `buildBoxNodeData.ts`).
- catalog `containerStyles.boxShadow` 를 읽는 Skia 소비자는 **0건**. `buildBoxNodeData` 는 같은 객체에서 `background`(:141) 와 `overflow`(:201) 만 catalog fallback 으로 읽는다.
- 캔버스 overlay 그림자는 하드코딩 primitive 가 그린다: `popover_shadow`(offsetY 4 / blur 12 / alpha 0.15) · `dialog_shadow`(offsetY 8 / blur 24 / alpha 0.2) — `skiaPrimitives.ts:1494-1520`, mode `prepend`.
- Style 패널이 쓰는 값은 `shadows[key]` **전개 문자열**(rgba)이라 Skia 파서를 통과한다 → 사용자 오소링 그림자는 현재 정상.

### 0-5. 선례 (본 ADR 이 재사용하는 기존 메커니즘)

| 선례                                                     | 위치                     | 재사용 지점                                     |
| -------------------------------------------------------- | ------------------------ | ----------------------------------------------- |
| `resolveColor()` 의 `var()` → TokenRef 역변환            | `tokenResolver.ts:68-71` | Skia 가 CSS var 리터럴을 theme 정합 색으로 해석 |
| `cssVarToTokenRef()` 역방향 lookup                       | `tokenResolver.ts:235`   | 위와 동일 (단순 `var(--x)` 한정)                |
| `resolveEffectiveOverflow()` raw-우선 + catalog fallback | `implicitStyles.ts`      | Phase 3 의 catalog fallback 해석 형태           |
| `CSSGenerator.resolveBoxShadow()` local                  | `CSSGenerator.ts:1057`   | Phase 2 의 `emitContainerStyles` 경유 대상      |

---

## §1. Phase 1 — `shadow` 토큰 카테고리 theme-aware 승격

`color` 카테고리와 동일 구조로 맞춘다.

- `packages/specs/src/primitives/shadows.ts`
  - `lightShadows` / `darkShadows` 두 map 신설. 값은 `preview-system.css` 의 light/dark 선언과 **1:1 동일 문자열**(`rgb(0 0 0 / N)` 표기는 `rgba(…)` 로 정규화해도 무방 — 파서·colord 양쪽 통과 확인 후).
  - `export const shadows = lightShadows` 별칭 유지 (하위 호환 — R2).
  - `getShadowToken(name, theme)` 시그니처 확장, 기본값 `"light"`.
- `packages/specs/src/renderers/utils/tokenResolver.ts`
  - `resolveToken` 의 `case "shadow"` 를 `theme === "dark" ? darkShadows[…] : lightShadows[…]` 로 분기.
  - `resolveBoxShadow(value, theme)` 는 이미 theme 인자를 받고 있으므로 시그니처 변경 없음 — 내부 `resolveToken` 분기만으로 theme 반응.
- 검증: `{shadow.md}` 를 light/dark 로 resolve 한 값이 각각 `preview-system.css` 의 해당 선언과 일치하는 단위 테스트.

**주의**: `--shadow-*` 는 `var(--box-shadow-md, …)` 형태로 **AI 테마 오버라이드 훅**을 갖는다. TS map 은 그 오버라이드를 모른다 → R5 (범위 밖, 본문 참조).

---

## §2. Phase 2 — 값 언어 TokenRef 통일

### D1 (sub-decision) — overlay 3건을 어떤 토큰으로 표현하는가

| 안                | 내용                                                                      | 시각 변경 (light)          | 스케일 수 |
| ----------------- | ------------------------------------------------------------------------- | -------------------------- | :-------: |
| **D1-a (기본안)** | 기존 `sm/md/lg/xl` 스케일에 편입 — Tooltip→`sm`, Popover→`md`, Modal→`xl` | **있음** (현 값과 불일치)  |     1     |
| D1-b (폴백)       | `{shadow.overlay-sm/md/lg}` 신설 — 현 light 계산값을 그대로 토큰화        | 없음 (byte-identical 유지) |     2     |

- **기본안 D1-a 근거**: Material 3 elevation(레벨 0~5 + 컴포넌트가 레벨 참조) / Tailwind shadow scale 모두 **단일 스케일 + 컴포넌트가 레벨을 참조**하는 구조다. 현재 `--shadow-*` 값 자체가 Tailwind 스케일과 동일 수치이므로, overlay 전용 2번째 스케일을 만드는 것은 같은 축의 중복이다.
- **폴백 조건**: Gate G2 에서 before/after 시각 diff 를 제시했을 때 사용자가 현 외형 유지를 선택하면 D1-b.
- 어느 쪽이든 **dark 값은 신규 정의**다 (현재 dark 는 glow 결함 상태이므로 "유지" 대상이 아님).

### 2-1. `emitContainerStyles` 토큰 해석 경유

- `packages/specs/src/renderers/CSSGenerator.ts`
  - `emitContainerStyles` 의 `if (c.boxShadow) lines.push(\` box-shadow: ${c.boxShadow};\`)`를 **local`resolveBoxShadow(c.boxShadow)` 경유\*\*로 교체.
  - 결과: `{shadow.md}` → `var(--shadow-md)` (states / indicatorMode 와 동일 경로). raw CSS 문자열은 그대로 통과하므로 기존 동작 보존.
- `packages/specs/src/types/spec.types.ts`
  - `ContainerStylesSchema.boxShadow?: string` → `string | ShadowTokenRef`. 주석의 "TokenRef 로 제약하지 않는다" 근거(=복합 그림자 표현 필요)는 Phase 1 로 해소되므로 **갱신 필수**.

### 2-2. catalog 3건 전환

- `packages/shared/src/catalog/generated/componentRulesTable.ts` (direct-edit SSOT)
  - Popover / Tooltip / Modal 의 `structure.containerStyles.boxShadow` 를 D1 결과 TokenRef 로 교체.
- `pnpm build:specs` → `generated/{Popover,Tooltip,Modal}.css` 재생성. diff 는 각 1줄(`box-shadow:` 값)이어야 한다.

---

## §3. Phase 3 — Skia 소비 배선

- 진입점: `buildBoxNodeData` / `buildSpecNodeData` 가 `element.props.style.boxShadow` 부재 시 catalog `containerStyles.boxShadow` 를 fallback 으로 읽는다 (`resolveEffectiveOverflow` 동형 — type 키 메모이즈, raw 우선).
- 해석: fallback 값이 TokenRef 면 `resolveBoxShadow(ref, skiaTheme)` → 전개 rgba 문자열 → **기존 `parseOneShadow` 그대로 통과**. 파서 수정 0.
  - `skiaTheme` 조달 경로는 기존 `specShapesToSkia(shapes, skiaTheme)` 계약과 동일 (`resolveSkiaTheme(darkMode)`).
- **파서는 이번 범위에서 수정하지 않는다.** 값 언어가 TokenRef 로 수렴하면 `color-mix`/`var` 가 파서에 도달하지 않는다. (도달 가능한 잔존 경로 = 사용자가 임의 CSS 를 붙여넣은 경우 → §8 범위 밖)

---

## §4. Phase 4 — Skia primitive 은퇴

- 순서 고정: **Phase 3 live 확인 → primitive 제거**. 역순 금지 (제거 먼저 하면 Popover 캔버스 그림자가 공백 구간을 갖는다 — R4).
- `packages/specs/src/renderers/skiaPrimitives.ts`
  - `popoverShadow` / `dialogShadow` 정의 + `SKIA_PRIMITIVES` 등록(:3070-3071) + mode 표(:3127-3128) 제거.
- `packages/shared/src/catalog/bindings/{Popover,Dialog}.binding.ts`
  - `skiaPrimitive` 배열에서 해당 항목 제거. Popover 는 `popover_arrow` 존치, Dialog 는 `overlay_backdrop` 존치.
- **Dialog 는 catalog `containerStyles.boxShadow` 미보유**다. `dialog_shadow` 를 제거하려면 Dialog 또는 Modal 중 어느 쪽이 dialog elevation 을 소유하는지 먼저 확정해야 한다 — 2026-07-25 판정은 "Modal 이 소유"(RAC starter `Dialog.css` 에 그림자 없음)였으므로, `dialog_shadow` 제거 후 Modal 의 catalog 그림자가 캔버스에 나오는지로 대체 검증한다.

---

## §5. Phase 5 — 검증·가드

- **cross-check**: Popover / Tooltip / Modal / Dialog × light·dark 8조합. DOM computed `box-shadow` ↔ 캔버스 렌더 대조.
- **정적 가드** (신규 테스트):
  - `containerStyles.boxShadow` 가 `color-mix(` 또는 `var(` 를 포함하지 않음 (값 언어 회귀 차단).
  - `{shadow.*}` 토큰 이름이 `lightShadows` / `darkShadows` **양쪽에 존재** (한쪽 누락 시 theme 축 하나가 undefined).
  - `emitContainerStyles` 가 `resolveBoxShadow` 를 경유함 (source-order 정적 검사 — `historyActions.static.test.ts` 동형).
- **단위 테스트**: `resolveToken("{shadow.md}", "dark") !== resolveToken("{shadow.md}", "light")`.

---

## §6. 파일 변경 목록

| 파일                                                                | Phase | 변경                                               |
| ------------------------------------------------------------------- | :---: | -------------------------------------------------- |
| `packages/specs/src/primitives/shadows.ts`                          |   1   | light/dark map 분리 + `shadows` 별칭 + getter 확장 |
| `packages/specs/src/renderers/utils/tokenResolver.ts`               |   1   | `case "shadow"` theme 분기                         |
| `packages/specs/src/types/spec.types.ts`                            |   2   | `boxShadow` 타입 + 주석 근거 갱신                  |
| `packages/specs/src/renderers/CSSGenerator.ts`                      |   2   | `emitContainerStyles` → `resolveBoxShadow` 경유    |
| `packages/shared/src/catalog/generated/componentRulesTable.ts`      |   2   | Popover / Tooltip / Modal 값 TokenRef 화           |
| `packages/shared/src/components/styles/generated/*.css`             |   2   | 재생성 (각 1줄)                                    |
| `apps/builder/…/skia/buildBoxNodeData.ts` (+`buildSpecNodeData.ts`) |   3   | catalog `boxShadow` fallback + theme resolve       |
| `packages/specs/src/renderers/skiaPrimitives.ts`                    |   4   | `popover_shadow` / `dialog_shadow` 제거            |
| `packages/shared/src/catalog/bindings/{Popover,Dialog}.binding.ts`  |   4   | `skiaPrimitive` 항목 제거                          |
| 신규 테스트 3종                                                     |   5   | §5 정적 가드 + 단위                                |

`AppearanceSection.tsx` 의 `cssToPresetMap` 은 R1 대응 시 추가된다 (light+dark 양쪽 값 인덱싱).

---

## §7. Phase 별 완료 체크리스트

- **Phase 0**: §0 표 5개 재측정 완료 · G1(dark glow) live 확인 완료
- **Phase 1**: `resolveToken` theme 분기 단위 테스트 PASS · `shadows` 별칭 소비처 grep 0 회귀
- **Phase 2**: D1 확정 기록 · generated CSS diff 가 의도한 줄 수와 일치 · G2 통과
- **Phase 3**: 캔버스에 Tooltip / Modal 그림자가 **처음으로** 나타남을 live 확인
- **Phase 4**: primitive 제거 후 Popover 캔버스 그림자 유지 live 확인 (G4)
- **Phase 5**: cross-check 8조합 · 정적 가드 3종 PASS · type-check PASS

> 각 Phase 는 commit 가능 상태로 종료한다. **test/type-check PASS 단독으로 종결 금지** — Phase 3/4 는 live 확인이 완료 조건이다.

---

## §8. 범위 밖 (명시)

| 항목                                                        | 사유                                                                                                               |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| 그림자 파서 2개 통합 (`parseShadow` ↔ `parseOneShadow`)     | 값 언어 수렴으로 증상이 사라진다. 통합 자체는 독립 리팩터 — 재개 조건 = 임의 CSS 붙여넣기 경로가 실사용에서 문제화 |
| `staticSelectors` 의 `var(--shadow-*)` 8건                  | CSS 축 전용 채널 (중첩 selector). Skia 대칭 대상이 아님                                                            |
| `--box-shadow-*` AI 테마 오버라이드의 Skia 반영             | R5 — theme studio 그림자 커스터마이즈가 실사용에 등장하면 재개                                                     |
| `overlay_backdrop` 오소링 표현 (Dialog 배치 시 프레임 암전) | 성격이 다른 UX 결정. 별도 판정 대상                                                                                |
| `--drop-shadow-*` / `--inset-shadow-*` 토큰 정리            | 2026-07-25 로 오용 0건 도달. 정의만 남은 상태 유지                                                                 |
