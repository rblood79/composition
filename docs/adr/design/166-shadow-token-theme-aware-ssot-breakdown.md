# ADR-166 구현 상세 — 그림자 토큰 theme-aware 승격 + boxShadow 값 언어 통일

> 본 문서는 [ADR-166](../completed/166-shadow-token-theme-aware-ssot.md) 의 구현 상세다. 결정·위험·Gate 는 ADR 본문에 있다.

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
- `--shadow-*` 의 dark 정책은 "검정 유지 + 불투명도 상향"(0.05→0.2, 0.1→0.3~0.5). 반면 `containerStyles` 3건의 `color-mix(var(--fg) N%)` 는 dark 에서 `--fg` 가 근-흰색이라 **밝은 번짐(glow)** 이 된다 — 정책 반대 방향.

**G1 live 실측 (2026-07-25 — 통과)**: preview 문서에서 `[data-theme="dark"]` 하위 computed 값을 직접 읽었다.

| theme | `--fg`             | Modal 그림자 computed                   |
| ----- | ------------------ | --------------------------------------- |
| light | `rgb(23, 23, 23)`  | `color(srgb 0.09 0.09 0.09 / 0.2)` 검정 |
| dark  | `rgb(245,245,245)` | `color(srgb 0.96 0.96 0.96 / 0.2)` 흰색 |

같은 조건의 대조군 `--shadow-md` 는 light `rgba(0,0,0,0.1)` → dark `rgba(0,0,0,0.3)`. 렌더 대조에서도 dark 의 Popover / Modal 은 박스 둘레에 밝은 후광이 보인다.

### 0-4. Skia 소비 경로

- `buildSkiaEffects(style)` 는 `element.props.style.boxShadow` 만 읽는다 (`buildBaseNodeProps.ts:73` / `buildSkiaNodeData.ts:90` / `buildBoxNodeData.ts`).
- catalog `containerStyles.boxShadow` 를 읽는 Skia 소비자는 **0건**. `buildBoxNodeData` 는 같은 객체에서 `background`(:141) 와 `overflow`(:201) 만 catalog fallback 으로 읽는다.
- ~~캔버스 overlay 그림자는 하드코딩 primitive 가 그린다: `popover_shadow`(offsetY 4 / blur 12 / alpha 0.15) · `dialog_shadow`(offsetY 8 / blur 24 / alpha 0.2) — `skiaPrimitives.ts:1494-1520`, mode `prepend`.~~ **오기 — Phase 4 실행 중 반증(§4 정정)**. 두 primitive 는 **등록만 되어 있고 캔버스에 닿지 않았다**: `target:"bg"` shadow 는 bg 가 root 로 추출되면 orphan 사본에 push 되어 버려진다. 즉 착수 시점 overlay 캔버스 그림자는 Popover 포함 **전부 공백**이었다 (Phase 3 가 처음으로 공급).
- Style 패널이 쓰는 값은 `shadows[key]` **전개 문자열**(rgba)이라 Skia 파서를 통과한다 → 사용자 오소링 그림자는 현재 정상.

### 0-5. 선례 (본 ADR 이 재사용하는 기존 메커니즘)

| 선례                                                     | 위치                     | 재사용 지점                                     |
| -------------------------------------------------------- | ------------------------ | ----------------------------------------------- |
| `resolveColor()` 의 `var()` → TokenRef 역변환            | `tokenResolver.ts:68-71` | Skia 가 CSS var 리터럴을 theme 정합 색으로 해석 |
| `cssVarToTokenRef()` 역방향 lookup                       | `tokenResolver.ts:235`   | 위와 동일 (단순 `var(--x)` 한정)                |
| `resolveEffectiveOverflow()` raw-우선 + catalog fallback | `implicitStyles.ts`      | Phase 3 의 catalog fallback 해석 형태           |
| `CSSGenerator.resolveBoxShadow()` local                  | `CSSGenerator.ts:1057`   | Phase 2 의 `emitContainerStyles` 경유 대상      |

---

## §1. Phase 1 — `shadow` 토큰 카테고리 theme-aware 승격 + 스케일 Spectrum 재정의

`color` 카테고리와 동일 구조로 맞추고, **값 자체를 Adobe Spectrum 2 기반으로 재정의**한다 (사용자 결정 2026-07-25 — §9-5 A·C 판정).

### 1-0. 확정 스케일 — SP2 역할 토큰 값, 크기 이름(sm/md/lg) 유지, **3단계**

이름은 크기 축(`sm`/`md`/`lg`)을 유지한다 — 스타일 패널이 크기 축으로 노출하고 있고 소비처 40+곳이 이 이름을 쓴다. **값만** SP2 역할 토큰에서 가져온다.

| 단계     | SP2 출처     | light                                                                                 | dark (alpha ×3)                                            | 잉크 (현행 대비) |
| -------- | ------------ | ------------------------------------------------------------------------------------- | ---------------------------------------------------------- | ---------------- |
| `sm`     | `emphasized` | `0 2px 8px rgba(0,0,0,.08)`, `0 1px 4px rgba(0,0,0,.04)`, `0 0 1px rgba(0,0,0,.08)`   | `…rgba(0,0,0,.24)`, `…rgba(0,0,0,.12)`, `…rgba(0,0,0,.24)` | 0.31 (**×5.15**) |
| `md`     | `elevated`   | `0 4px 12px rgba(0,0,0,.08)`, `0 2px 6px rgba(0,0,0,.04)`, `0 0 2px rgba(0,0,0,.12)`  | `…rgba(0,0,0,.24)`, `…rgba(0,0,0,.12)`, `…rgba(0,0,0,.36)` | 0.55 (×1.32)     |
| `lg`     | `dragged`    | `0 12px 16px rgba(0,0,0,.08)`, `0 6px 8px rgba(0,0,0,.04)`, `0 0 6px rgba(0,0,0,.16)` | `…rgba(0,0,0,.24)`, `…rgba(0,0,0,.12)`, `…rgba(0,0,0,.48)` | 1.40 (×1.56)     |
| ~~`xl`~~ | —            | **제거** (Spectrum 미발행 · D3 소비처 0건)                                            | —                                                          | —                |

**`ShadowTokens` 나머지 4키 처리** — 타입은 7키(`none`/`sm`/`md`/`lg`/`xl`/`inset`/`focus-ring`)다(`token.types.ts:ShadowTokens`, `shadows.ts:17-35`). 위 표가 다루지 않는 4키의 방침:

| 키           | 현행 값                             | 처리                                                                                                                                                        |
| ------------ | ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `none`       | `"none"`                            | **유지** — theme 불변. light/dark map 양쪽에 동일 값                                                                                                        |
| `xl`         | Tailwind 4단계                      | **제거** (위 표)                                                                                                                                            |
| `inset`      | `inset 0 2px 8px 0 rgba(0,0,0,.16)` | **유지 + dark alpha ×3**(`.16`→`.48`). Spectrum 에 대응 토큰이 없으므로 재정의 대상 아님 — elevation 이 아니라 오목 효과다. 프로덕션 소비처 0건(테스트만)   |
| `focus-ring` | `0 0 0 2px var(--accent)`           | **제거 검토 대상 — Phase 1 에서 확정.** 실사용 0건이고, focus ring 은 ADR-061 의 `{focus.ring.*}` + `FOCUS_RING_TOKENS` 가 소유한다(`tokenResolver.ts:310`) |

> **`focus-ring` 이 Decision 근거 2 의 반례인 점 (2026-07-25 리뷰 발견)**: 본 ADR 은 "값 언어가 TokenRef 로 수렴하면 `color-mix`/`var` 가 파서에 도달하지 않는다"(ADR Decision 근거 2)를 파서 미수정 근거로 든다. 그런데 `shadows["focus-ring"]` 은 값 자체에 `var(--accent)` 를 담아, `resolveToken("{shadow.focus-ring}")` 결과가 그대로 `var()` 다 — TokenRef 를 거쳐도 파서가 해석하지 못한다. **실사용 0건이라 현재 무해**하지만 근거 2 는 "모든 `{shadow.*}` 가 파서 통과 가능"이 아니라 "**본 ADR 이 쓰는 키가** 통과 가능"으로 한정된다. §5 정적 가드에 "`lightShadows`/`darkShadows` 값에 `var(` / `color-mix(` 미포함" 단언을 추가해 이 한정을 기계 집행한다.

- **dark = 전 레이어 alpha ×3** (Spectrum 규칙, §9-2). 현행의 3~5배 불균일을 정규화한다.
- SP2 는 `emphasized-hover` 도 발행하지만 **hover 상태 토큰이라 크기 단계로 쓰지 않는다**(`elevated` 와 잉크 0.53/0.55 로 사실상 동일 — 크기 스케일에서 중복).
- **`xl` 제거**: Spectrum 이 4번째 단계를 발행하지 않고, D3 `--shadow-xl` 소비처가 0건이다. 유일한 `var(--shadow-xl)` 사용처(`DataTablePresetSelector.css`)는 빌더 chrome 이라 `App.css` 별도 정의를 읽으므로 영향받지 않는다(§1-2).
  - 사용자 노출 변화: 스타일 패널 Select 가 `none/sm/md/lg/xl` → `none/sm/md/lg`. 기존 프로젝트가 저장한 xl 값은 보존되고 "custom" 으로 표시된다(`AppearanceSection` 의 동적 custom 항목 경로).

### 1-1. 토큰 정의

- `packages/specs/src/primitives/shadows.ts`
  - `lightShadows` / `darkShadows` 두 map 신설. 값은 §1-0 표.
  - `export const shadows = lightShadows` 별칭 유지 (하위 호환 — R2).
  - `getShadowToken(name, theme)` 시그니처 확장, 기본값 `"light"`.
- `packages/specs/src/renderers/utils/tokenResolver.ts`
  - `resolveToken` 의 `case "shadow"` 를 `theme === "dark" ? darkShadows[…] : lightShadows[…]` 로 분기.
  - `resolveBoxShadow(value, theme)` 는 이미 theme 인자를 받고 있으므로 시그니처 변경 없음 — 내부 `resolveToken` 분기만으로 theme 반응.
- `packages/shared/src/components/styles/theme/preview-system.css`
  - `--shadow-sm/md/lg` 를 §1-0 값으로 교체, `--shadow-xl` 제거. `--box-shadow-*` 오버라이드 훅 형태는 유지.
- 검증: `{shadow.md}` 를 light/dark 로 resolve 한 값이 각각 `preview-system.css` 의 해당 선언과 일치하는 단위 테스트 + light/dark 가 서로 다름 단언.

### 1-2. 적용 범위 — D3 만. 빌더 chrome 은 손대지 않는다

**같은 토큰 이름이 두 벌 정의돼 있다** (2026-07-25 실측):

| 정의처                     | 계층                   | `--shadow-sm` 값                                                           |
| -------------------------- | ---------------------- | -------------------------------------------------------------------------- |
| `theme/preview-system.css` | **D3 (사용자 캔버스)** | `0 1px 2px 0 rgb(0 0 0 / .05)` — Tailwind `shadow-sm`                      |
| `apps/builder/src/App.css` | 빌더 chrome            | `0 1px 3px 0 #0000001a, 0 1px 2px -1px #0000001a` — Tailwind 기본 `shadow` |

- 두 정의가 **한 단계 어긋나 있다**. D3 쪽 `sm` 이 Tailwind 최하단이라 §9-3 의 이탈(잉크 0.06)이 생겼다.
- **본 ADR 의 재정의 대상은 D3 (`preview-system.css` + TS `shadows`) 뿐이다.** 빌더 chrome(`App.css`)은 builder-system layer 라 D3 SSOT 체인 밖이다(`panel-structure.md`). 이름 충돌 정리는 별도 판단 대상 → §8.
- 계층별 소비처(파일 수): `sm` D3 10 / chrome 7 · `md` D3 1 / chrome 9 · `lg` D3 3 / chrome 11 · `xl` D3 **0** / chrome 1.

### 1-3. `sm` 소비처 개별 검토 (Phase 2 선행)

`sm` 이 ×5.15 로 강해지므로 **D3 소비처 10건을 일괄 승계하지 않는다**. SP2 `emphasized` 는 강조 표면용이지 입력 필드용이 아니다 — 현재 `var(--shadow-sm)` 를 쓰는 곳 중 상당수가 form field(`ComboBox`/`Select`/`NumberField`/`SearchField` generated CSS)다.

- 각 소비처를 `sm` 유지 / `none` / 다른 단계 중 하나로 판정하고 근거를 기록한다.
- Spectrum 대조: Spectrum 의 textfield 계열은 drop-shadow 를 쓰지 않는다(`drop-shadow-*` 컴포넌트 토큰이 color-handle / color-loupe / FAB 3개뿐 — §9-1 전수). 따라서 **`none` 판정이 다수일 수 있다.**
- 이 판정 결과가 G2 의 시각 diff 범위를 정한다.

#### 판정 결과 — **8건 전부 `sm` 유지** (2026-07-25 live 실측)

위 "`none` 판정이 다수일 수 있다" 는 예상은 **실측으로 반증됐다**. 두 개의 사실이 예상을 뒤집었다.

| #     | 소비처                                                            | 실체                                      |   판정    | 근거                                                                      |
| ----- | ----------------------------------------------------------------- | ----------------------------------------- | :-------: | ------------------------------------------------------------------------- |
| 1     | ComboBox `staticSelectors.bridges`                                | 드롭다운 트리거 버튼 (`--combo-btn-size`) | `sm` 유지 | ①                                                                         |
| 2     | NumberField `staticSelectors.bridges`                             | 스테퍼 버튼 (`--nf-btn-size`)             | `sm` 유지 | ①                                                                         |
| 3     | SearchField `staticSelectors.bridges`                             | clear 버튼 (`--sf-btn-size`)              | `sm` 유지 | ①                                                                         |
| 4     | Select `staticSelectors.bridges`                                  | chevron 박스 (`--select-chevron-size`)    | `sm` 유지 | ①                                                                         |
| 5     | ToggleButtonGroup `indicatorMode.boxShadow`                       | 선택 세그먼트 인디케이터                  | `sm` 유지 | SP2 `emphasized` 의 의미(강조 표면)와 정확히 일치. 이미 TokenRef — 변경 0 |
| 6·7·8 | `{ColorWheel,ColorSlider,ColorArea}.css` `.react-aria-ColorThumb` | 16px 원형 썸 + 4px 링 (3파일 동일 선언)   | `sm` 유지 | ②                                                                         |

**근거 ① — design 의 전제가 틀렸다: 이건 "form field" 가 아니라 필드 *내부의 작은 칩*이다.** 4건 모두 필드 컨테이너가 아니라 그 안의 10~28px 어포던스 버튼이고, `background: var(--bg-overlay)` 다. 그런데 **`--bg-overlay` 와 `--bg-inset` 은 같은 토큰으로 해석된다** (light 양쪽 `--color-neutral-50`, dark 양쪽 `--color-neutral-800` — `preview-system.css:166,169` / `:307,310`). 즉 칩과 필드 배경이 **동일 색**이라 그림자가 유일한 분리 수단이다. `none` 은 칩을 완전히 소실시킨다.

live 렌더 비교(18px 칩)에서 **구 `sm`(`0 1px 2px α.05`)과 `none` 이 육안 구별 불가**였다 — 구 값이 이 크기에서 사실상 아무 일도 하지 않았다. 신 `sm` 에서 비로소 칩이 분리돼 보인다. 따라서 이 4건에 대한 `sm` 승계는 회귀가 아니라 **원래 의도(raised chip 어포던스)의 최초 달성**이다.

**근거 ② — Spectrum 의 color-handle 은 "drop-shadow 를 쓴다" 가 아니라 실질 `none` 이고, 그 자리를 테두리가 대신한다.** 실측: `color-handle-drop-shadow-{x,y,blur}` 가 전부 **0** 이고(spread 토큰 없음 → 렌더 결과 없음), 분리는 `color-handle-{inner,outer}-border` 1px × black 42% 2겹이 담당한다. composition 은 대신 `border: 4px solid var(--bg-raised)` 링을 쓰는데, **밝은 배경에서는 이 링이 배경에 묻힌다**(Spectrum 의 black 42% 테두리는 안 묻힌다). live 비교에서 밝은 배경 위 `none` 은 썸 외곽이 풀렸고 신 `sm` 이 소프트 리프트를 복구했다. 링 색 선택의 차이를 그림자가 보상하는 구조라 `sm` 유지가 맞다.

**결과**: 판정에 따른 코드 변경 **0건**. `staticSelectors` 4건은 `var(--shadow-sm)` 그대로(§8 대로 TokenRef 전환은 범위 밖), indicatorMode 는 이미 `{shadow.sm}`, 수동 CSS 3건도 `var(--shadow-sm)` 그대로다. 값 자체는 Phase 1 의 토큰 재정의로 이미 바뀌었다.

> **R8 재평가**: "일괄 승계 금지" 라는 대응은 유효했다(개별 판정을 실제로 수행했다). 다만 위험의 방향은 반대였다 — `sm` 강화는 이 8건에서 **개선**이다. R8 은 해소로 본다.

#### 수정 지점 — generated CSS 를 직접 고치지 않는다 (2026-07-25 리뷰 발견)

10건은 **성격이 3종으로 갈린다**. generated CSS 를 직접 편집하면 `pnpm build:specs` 가 덮어쓴다(헤더에 `AUTO-GENERATED … DO NOT EDIT MANUALLY`).

| 소비처                                                                        | 성격                   | 실제 수정 지점                                                                                                                                                 |
| ----------------------------------------------------------------------------- | ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `generated/{NumberField,ComboBox,SearchField,Select,ToggleButtonGroup}.css` 5 | **생성물 — 편집 금지** | catalog `componentRulesTable.ts` 의 `staticSelectors` `"box-shadow": "var(--shadow-sm)"` (4건) 및 `indicatorMode.boxShadow: "{shadow.sm}"` (ToggleButtonGroup) |
| `{ColorWheel,ColorSlider,ColorArea}.css` 3                                    | 수동 CSS               | 파일 직접 편집                                                                                                                                                 |
| `catalog/generated/componentRulesTable.ts` 1                                  | **직접 편집 SSOT**     | 파일 직접 편집 — 경로에 `generated/` 가 있으나 ADR-912 단계5 step3 에서 생성기가 삭제돼 정본으로 승격됨(파일 헤더 참조). 위 5건의 실제 수정 지점이 여기다      |
| `CSSGenerator.ts` 1                                                           | 코드(emit 로직)        | 판정 대상 아님 — `--shadow-*` 를 emit 하는 쪽                                                                                                                  |

- 즉 **판정 대상은 실질 8건**(catalog staticSelectors 4 + indicatorMode 1 + 수동 CSS 3)이고, 반영은 catalog 와 수동 CSS 두 곳에서만 이뤄진다.
- 판정 후 `pnpm build:specs` 로 generated CSS 를 재생성해 결과를 확인한다 — generated 파일의 diff 가 판정과 일치하는지가 검증 수단이다.

**주의**: `--shadow-*` 는 `var(--box-shadow-md, …)` 형태로 **AI 테마 오버라이드 훅**을 갖는다. TS map 은 그 오버라이드를 모른다 → R5 (범위 밖, 본문 참조).

---

## §2. Phase 2 — 값 언어 TokenRef 통일

### D1 (sub-decision) — overlay 3건을 어떤 토큰으로 표현하는가 — **확정**

**Tooltip→`sm` / Popover→`md` / Modal→`lg`** (§1-0 의 Spectrum 재정의 스케일 기준).

세 overlay 가 3단계에 하나씩 배분된다. Tooltip / Popover 는 원출처로 되돌아가는 매핑이다 — §9-4 대로 두 값의 기하가 SP2 `emphasized` / `elevated` 와 정확히 일치하므로, 각각 `sm` / `md` 는 근사가 아니라 **복귀**다.

| 컴포넌트 | 현재 값           | 잉크 | → 단계   | (SP2 출처)   |         L2 | 잉크비 |
| -------- | ----------------- | ---: | :------- | :----------- | ---------: | -----: |
| Tooltip  | `0 2px 8px` α.12  | 0.35 | **`sm`** | `emphasized` | **0.0042** |  ×0.89 |
| Popover  | `0 4px 12px` α.15 | 0.75 | **`md`** | `elevated`   | **0.0096** |  ×0.73 |
| Modal    | `0 8px 32px` α.20 | 2.24 | **`lg`** | `dragged`    | **0.0238** |  ×0.62 |

- Modal 만 오차가 크다(×0.62). blur 32 는 Spectrum 이 발행하는 어느 값보다 넓어서, Spectrum 범위 안에 대응이 없다(§9-4). **Spectrum 기준으로 정규화하는 방향의 의도된 결과**이며, 시각적으로 Modal 그림자가 눈에 띄게 옅어진다 → G2 에서 제시.
- 폐기된 대안: `{shadow.overlay-*}` 별도 스케일 신설(구 D1-b) — 스케일을 하나로 수렴시킨다는 본 ADR 목적과 어긋나 채택하지 않는다.

#### 프로파일 지표 정의 (재현 방법)

box-shadow 를 하단 모서리 아래 거리 `d` 의 알파 프로파일로 환산한다 — 레이어별 σ=blur/2 가우시안 CDF, 다층은 `1-Π(1-αᵢ)` 합성. `d ∈ [0,48]` 구간에서 L2 거리와 잉크량 `∫alpha·dd` 를 비교한다. 계산 스크립트는 일회성이라 커밋하지 않았다 — Phase 0 재측정 시 같은 방식으로 다시 계산한다.

> **경과 기록**: 초안은 Tailwind 스케일 유지 + 근사 편입(Tooltip→`md`/Popover→`lg`/Modal→`xl`)이었다. §9 외부 대조에서 overlay 값의 출처가 Spectrum 이고 `sm` 이 외부 최하단 대비 3.7배 약하다는 사실이 나오면서, 사용자 판단으로 **스케일 자체를 Spectrum 기반으로 재정의**하는 방향으로 바뀌었다(2026-07-25). 그 결과 매핑이 한 단계씩 내려가 위 표가 됐다.

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

> **실행 결과 정정 (2026-07-25)**: R4 의 전제였던 "`popover_shadow` 가 Popover 캔버스 그림자를 그리고 있다"는 **틀렸다**. `specShapeConverter` 는 `target:"bg"` shadow 를 Pass 2 로 미룬 뒤 `nodeById.get("bg")` 에 effect 를 push 하는데, bg 가 root 로 추출된 경우(`bgExtracted`) 거기 담긴 것은 **spread 사본**이고 root 조립부(`specShapeConverter:206-216`)는 `bgBox`/`children` 만 읽는다 — 사본의 `effects` 는 어디서도 읽히지 않는다. border 는 `targetNode.box === bgBox` write-through 분기(`:637-640`)가 있지만 shadow 에는 없다. 일회성 probe 로 확증(`hasEffects:false`). 따라서 Phase 4 는 **시각 변화 0 의 죽은 코드 제거**이고, Phase 3 이전 Popover 도 Tooltip/Modal 과 똑같이 캔버스 그림자가 없었다. 순서 고정 자체는 그대로 지켰으므로 결과에 영향 없음.

- `packages/specs/src/renderers/skiaPrimitives.ts`
  - `popoverShadow` / `dialogShadow` 정의 + `SKIA_PRIMITIVES` 등록(:3070-3071) + mode 표(:3127-3128) 제거.
- `packages/shared/src/catalog/bindings/{Popover,Dialog}.binding.ts`
  - `skiaPrimitive` 배열에서 해당 항목 제거. Popover 는 `popover_arrow` 존치, Dialog 는 `overlay_backdrop` 존치.
- **Dialog 는 catalog `containerStyles.boxShadow` 미보유**다. `dialog_shadow` 를 제거하려면 Dialog 또는 Modal 중 어느 쪽이 dialog elevation 을 소유하는지 먼저 확정해야 한다 — 2026-07-25 판정은 "Modal 이 소유"(RAC starter `Dialog.css` 에 그림자 없음)였으므로, `dialog_shadow` 제거 후 Modal 의 catalog 그림자가 캔버스에 나오는지로 대체 검증한다.

---

## §5. Phase 5 — 검증·가드

**완료 2026-07-25.** 계획된 항목 전부 + 계획에 없던 CSS↔토큰 대칭 가드 1건 추가.

### cross-check — 8조합 전수 통과

Preview iframe 에 probe 요소를 붙여 실제 스타일시트 cascade 를 태운 computed 값 ↔ Skia 노드 effects 대조. RAC overlay 는 열려야 DOM 에 나타나므로 열림 상태 의존 없이 규칙 자체를 측정했다.

| 컴포넌트                           | light DOM | light Skia | dark DOM | dark Skia |
| ---------------------------------- | --------- | ---------- | -------- | --------- |
| Popover (+`[data-variant=filled]`) | `md`      | `md`       | `md`     | `md`      |
| Tooltip                            | `sm`      | `sm`       | `sm`     | `sm`      |
| Modal                              | `lg`      | `lg`       | `lg`     | `lg`      |
| Dialog                             | `none`    | effects 0  | `none`   | effects 0 |

- dark Popover 실측: DOM `α .24/.12/.36 · dy 4/2/0 · blur 12/6/2` ↔ Skia `dy4/σ5.10 · dy2/σ2.55 · dy0/σ0.85`, α 동일. **σ = blur / 2.355 변환까지 일치.**
- `[data-variant="filled"]` 가 base 와 같은 값 — Phase 2 에서 고친 명시도 override 가 live 에서 유지됨을 확인.
- 테마 전환이 리로드 없이 양 consumer 에 동시 반영.

### 가드 (신규 4파일)

| 가드              | 위치                                                     | 내용                                                                                                                                                                                                                                                                                                              |
| ----------------- | -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| catalog 값 언어   | `shared/…/catalog/__tests__/shadowTokenContract.test.ts` | `boxShadow` **키 이름 깊이 탐색**(컴포넌트 열거 X) → `var(`/`color-mix(` 0건 · `{shadow.X}` 가 light·dark **양쪽** 존재 · overlay 서열 `sm<md<lg` · Dialog elevation 부재. traversal 이 0건이 되면 나머지가 vacuous 통과하므로 **탐색 자체도 단언**                                                               |
| CSS↔토큰 대칭     | `shared/…/theme/__tests__/shadowCssParity.test.ts`       | **계획 외 추가.** `preview-system.css --shadow-*` ↔ `lightShadows`/`darkShadows` 수치 일치 (색 표기 `rgb(0 0 0 / .08)` ↔ `rgba(0,0,0,.08)` 정규화 후 비교) + `xl` 양쪽 부재. **두 벌이 서로를 참조하지 않는 손-유지 사본**이라 한쪽만 고치면 조용히 발산하는데, 양쪽 다 "그림자가 보여서" 시각 점검으로 안 잡힌다 |
| generator 경유    | `specs/…/__tests__/cssGenerator.shadow.static.test.ts`   | `emitContainerStyles` 가 `resolveBoxShadow` 경유 (source-order). 우회하면 CSS 에 리터럴 `{shadow.md}` 가 박혀 **선언이 통째로 무효**가 되는데, 브라우저가 조용히 버려 스냅샷도 통과한다 — 값이 아니라 경유를 봐야 잡힌다                                                                                          |
| resolveToken 분기 | `specs/…/utils/__tests__/tokenResolver.test.ts` (증설)   | 3단계 전부 light≠dark · 기본값 light · 기하 동일 + alpha ×3 · 전개 결과 `var(`/`color-mix(` 미포함                                                                                                                                                                                                                |

`lightShadows`/`darkShadows` map 자체의 값 계약(3단계·×3·`var(` 미포함)은 Phase 1 의 `shadows.test.ts` 가 이미 소유 — 중복 작성하지 않았다.

---

## §6. 파일 변경 목록

| 파일                                                                | Phase | 변경                                                                                                                                                                                                                    |
| ------------------------------------------------------------------- | :---: | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/specs/src/primitives/shadows.ts`                          |   1   | light/dark map 분리 + **SP2 값으로 교체 + `xl` 제거** + `shadows` 별칭 + getter 확장                                                                                                                                    |
| `packages/specs/src/renderers/utils/tokenResolver.ts`               |   1   | `case "shadow"` theme 분기                                                                                                                                                                                              |
| `packages/shared/…/theme/preview-system.css`                        |   1   | `--shadow-sm/md/lg` SP2 값 교체 + `--shadow-xl` 제거 (light/dark 양 블록)                                                                                                                                               |
| `packages/shared/…/styles/{ColorWheel,ColorSlider,ColorArea}.css`   |   2   | §1-3 판정 결과 반영 (수동 CSS 3건)                                                                                                                                                                                      |
| `packages/specs/src/primitives/__tests__/shadows.test.ts`           |   1   | `shadows.xl` 참조 제거 + 신 3단계 값으로 기대치 갱신 (`shadows.test.ts:26-29`)                                                                                                                                          |
| `apps/builder/…/panels/styles/sections/AppearanceSection.tsx`       |   2   | `SHADOW_PRESET_OPTIONS` 에서 `xl` 제거 (3단계) + "sm~xl" 주석 2곳 갱신(`:43`,`:88`)                                                                                                                                     |
| `packages/specs/src/types/spec.types.ts`                            |   2   | `boxShadow` 타입 + 주석 근거 갱신                                                                                                                                                                                       |
| `packages/specs/src/renderers/CSSGenerator.ts`                      |   2   | `emitContainerStyles` → `resolveBoxShadow` 경유                                                                                                                                                                         |
| `packages/shared/src/catalog/generated/componentRulesTable.ts`      |   2   | ① Popover / Tooltip / Modal `containerStyles.boxShadow` TokenRef 화 ② §1-3 판정에 따른 `staticSelectors` `"box-shadow"` 4건 + ToggleButtonGroup `indicatorMode.boxShadow` 갱신 (**generated/ 경로지만 직접 편집 SSOT**) |
| `packages/shared/src/components/styles/generated/*.css`             |   2   | **재생성 결과 확인 전용 — 직접 편집 금지**(`pnpm build:specs` 가 덮어씀). diff 가 §1-3 판정과 일치하는지가 검증 수단                                                                                                    |
| `apps/builder/…/skia/buildBoxNodeData.ts` (+`buildSpecNodeData.ts`) |   3   | catalog `boxShadow` fallback + theme resolve                                                                                                                                                                            |
| `packages/specs/src/renderers/skiaPrimitives.ts`                    |   4   | `popover_shadow` / `dialog_shadow` 제거                                                                                                                                                                                 |
| `packages/shared/src/catalog/bindings/{Popover,Dialog}.binding.ts`  |   4   | `skiaPrimitive` 항목 제거                                                                                                                                                                                               |
| 신규 테스트 **4종**                                                 |   5   | §5 가드 — 계획 3종 + `shadowCssParity.test.ts`(CSS↔토큰 수치 대칭, 계획 외 추가)                                                                                                                                        |

`AppearanceSection.tsx` 의 `cssToPresetMap` 은 R1 대응 시 추가된다 (light+dark 양쪽 값 인덱싱).

---

## §7. Phase 별 완료 체크리스트

- **Phase 0**: §0 표 5개 재측정 완료 · ~~G1(dark glow) live 확인~~ **완료 2026-07-25** (§0-3)
- **Phase 1**: `resolveToken` theme 분기 단위 테스트 PASS · `shadows` 별칭 소비처 grep 0 회귀 · **`xl` 제거 후 D3 참조 0건 재확인** · light/dark 잉크비 3배 단언
- **Phase 2**: D1 확정 기록 · **§1-3 `sm` 소비처 10건 판정표 작성** · 패널 프리셋 3단계 전환 · generated CSS diff 가 의도한 줄 수와 일치 · G2 통과
- **Phase 3**: 캔버스에 Tooltip / Modal 그림자가 **처음으로** 나타남을 live 확인
- **Phase 4**: ~~primitive 제거 후 Popover 캔버스 그림자 유지 live 확인 (G4)~~ **완료 2026-07-25** — Popover catalog 3레이어 유지 + arrow 생존, Dialog effects 0 + backdrop 생존 (§4 정정 포함)
- **Phase 5**: ~~cross-check 8조합 · 정적 가드 3종 PASS · type-check PASS~~ **완료 2026-07-25** — 8조합 전수 통과 · 가드 4파일(계획 3 + CSS↔토큰 대칭 1) · specs 662 / shared 749 PASS · type-check PASS

> 각 Phase 는 commit 가능 상태로 종료한다. **test/type-check PASS 단독으로 종결 금지** — Phase 3/4 는 live 확인이 완료 조건이다.

---

## §8. 범위 밖 (명시)

| 항목                                                        | 사유                                                                                                                                                                                                                                                                                                                                                                                                       |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 그림자 파서 2개 통합 (`parseShadow` ↔ `parseOneShadow`)     | 값 언어 수렴으로 증상이 사라진다. 통합 자체는 독립 리팩터 — 재개 조건 = 임의 CSS 붙여넣기 경로가 실사용에서 문제화                                                                                                                                                                                                                                                                                         |
| `staticSelectors` 의 `var(--shadow-*)` 8건                  | CSS 축 전용 채널 (중첩 selector). Skia 대칭 대상이 아님                                                                                                                                                                                                                                                                                                                                                    |
| `--box-shadow-*` AI 테마 오버라이드의 Skia 반영             | R5 — theme studio 그림자 커스터마이즈가 실사용에 등장하면 재개                                                                                                                                                                                                                                                                                                                                             |
| `overlay_backdrop` 오소링 표현 (Dialog 배치 시 프레임 암전) | 성격이 다른 UX 결정. 별도 판정 대상                                                                                                                                                                                                                                                                                                                                                                        |
| `--drop-shadow-*` / `--inset-shadow-*` 토큰 정리            | 2026-07-25 로 오용 0건 도달. 정의만 남은 상태 유지                                                                                                                                                                                                                                                                                                                                                         |
| **빌더 chrome(`App.css`)의 `--shadow-*` 이름 충돌**         | 같은 이름이 D3 와 한 단계 어긋난 값으로 두 벌 존재(§1-2). 빌더 chrome 은 builder-system layer 라 D3 SSOT 체인 밖 — 이름 정리는 별도 판단. 재개 조건 = 두 계층을 오가는 CSS 가 등장해 값이 뒤섞일 때                                                                                                                                                                                                        |
| **`specShapeConverter` 가 `target:"bg"` shadow 를 삼킴**    | Phase 4 실행 중 발견(§4 정정). bg 가 root 로 추출되면 shadow effect 가 orphan 사본에 push 되어 버려진다 — border 는 write-through 분기가 있으나 shadow 는 없는 **비대칭**. ADR-166 은 이 채널을 쓰지 않는 방향(catalog boxShadow 단일화)이라 수정 없이 종료해도 회귀가 없다. 재개 조건 = spec/primitive shadow shape 를 쓰는 신규 컴포넌트가 등장할 때 (그때는 채널을 살릴지 catalog 로 흡수할지부터 판정) |

> **Phase 2 에서 발견한 잔존 (범위 밖) — 2026-07-25 재판정 완료, 해소됨** — 패널의 **inline 오버라이드는 theme 을 따라가지 않는다**. `AppearanceSection` 의 `onChange` 가 `shadows[value]`(= light 값)를 리터럴 CSS 로 store 에 기록하므로, dark 캔버스에서 프리셋을 고르면 light 그림자가 고정된다. 이는 본 ADR 이 만든 결함이 아니라 **선행 상태**다 — Phase 1 이전에도 TS map 은 flat 이었고 CSS 변수만 theme 별이라, 리터럴을 쓰는 순간 theme 추종이 끊겼다. 판정 결과가 catalog 기본값이 아니라 사용자 inline 값에만 걸리므로 본 Phase 의 G2 범위 밖이다.
>
> **재판정 결과 (ADR-166 종결 후 후속 4 phase, commits `6f3d1da4c` / `25b50aa40` / `01e0fc553` / `d5e06cf98`)**: 위에 적었던 "근본 해법 = 패널이 `{shadow.md}` TokenRef 를 기록" 은 **기각**했다. inline `props.style` 은 두 소비자 모두에게 **원문 CSS 채널**이라, TokenRef 를 넣으면 DOM 은 유효하지 않은 선언으로 버리고 Skia 는 파서가 숫자를 못 찾아 null 로 떨어진다 — 지금보다 나빠진다. `var(--shadow-md)` 저장도 기각: CSS var 치환이 계산값 시점이라 `inset var(--shadow-md)` 가 3레이어 중 첫 레이어에만 inset 을 걸고, dirty/reset baseline 이 리터럴을 내며, 이미 저장된 프로젝트가 구제되지 않는다.
>
> 채택안은 **저장 형식 불변 + 읽기 시점 정규화**다. 저장은 light 리터럴을 정규형으로 유지하고, Skia 는 `normalizeShadowForTheme` 로 현재 theme 리터럴을, DOM 은 `shadowLiteralToCssVar` 로 `var(--shadow-*)` 를 받는다(역매핑 SSOT = `packages/specs/src/primitives/shadowNormalize.ts`). 기존 프로젝트가 마이그레이션 없이 함께 회복되고 inset 축도 손대지 않는다. 적용 범위는 elevation 3단계(sm/md/lg)의 inset 미적용 값 한정 — `--shadow-*` CSS 변수가 3개뿐이라 none/inset/inset-토글은 DOM 이 var 로 낼 수단이 없고, Skia 만 theme 을 따르면 두 소비자가 갈라지므로 양쪽 다 통과시킨다(현행 유지 = 회귀 없음). **잔존**: inset 축 theme 추종 — 재개 조건 = `--shadow-inset` 계열 CSS 변수 신설이 필요해질 때.
>
> 부수로 `adaptElementFillStyle` → `adaptElementStyle` 개명 + 조기 반환 위치 이동이 필요했다. 종전 `if (!("fills" in element)) return element` 가 fills 없는 요소를 통째로 건너뛰어, 그 자리에 그림자 정규화를 얹으면 대다수 요소에서 무반영이었다.

---

## §9. 외부 레퍼런스 대조 (2026-07-25 원본 실측)

현행 `sm/md/lg/xl` 은 Tailwind 스케일 수치를 그대로 쓴다. 같은 계층을 표현한 타 디자인 시스템과 대조해 스케일의 위치를 확인했다. **모두 배포 아티팩트 원본에서 추출** — 2차 자료 인용 아님.

| 시스템            | 출처 (실측 경로)                                                                                           |
| ----------------- | ---------------------------------------------------------------------------------------------------------- |
| Material Design 3 | `material-web/elevation/internal/_elevation.scss` · `material-color-utilities/typescript/scheme/scheme.ts` |
| Adobe Spectrum    | `@adobe/spectrum-tokens@14.15.0` `dist/json/variables.json` (unpkg)                                        |
| Apple HIG         | `developer.apple.com/design/human-interface-guidelines/*` HTTP 상태 대조 + npm 레지스트리                  |

### 9-1. 계층 구조 비교

| 시스템                      | 단계 수                                                  | 레이어/단계                    | 명명 축             |
| --------------------------- | -------------------------------------------------------- | ------------------------------ | ------------------- |
| **composition** (대조 시점) | 4 (`sm`/`md`/`lg`/`xl`)                                  | 1~2                            | **크기**            |
| **composition** (§1-0 확정) | 3 (`sm`/`md`/`lg`)                                       | 3 (SP2 레시피 승계)            | **크기** (값은 SP2) |
| Material 3                  | 6 (level 0~5)                                            | 2 (key + ambient)              | **고도(dp)**        |
| Adobe Spectrum 1            | 3 (`100`/`200`/`300`)                                    | 1                              | **숫자 스케일**     |
| Adobe Spectrum 2            | 4 (`emphasized`/`emphasized-hover`/`elevated`/`dragged`) | 3 (ambient + transition + key) | **역할(semantic)**  |
| Apple HIG                   | **없음**                                                 | —                              | —                   |

- **Spectrum 2 는 크기 스케일이 아니라 역할 토큰**이다. "얼마나 큰 그림자"가 아니라 "어떤 상태의 표면"으로 이름 짓는다. composition 의 크기 축(`sm~xl`)과 명명 철학이 다르다.
- **Apple 은 그림자 계층을 발행하지 않는다** (실측: HIG `/materials` 200 · `/layout` 200 · `/color` 200 인데 `/elevation` 404 · `/shadows` 404. npm 에 Adobe·Material 대응 토큰 패키지는 존재하나 Apple 대응 패키지 없음). 따라서 **대조군에서 제외**한다. Apple 이 그림자 대신 무엇을 쓰는지에 대한 서술은 HIG 본문이 SPA 라 이번 세션에서 원문 확인 실패 — 근거 없이 인용하지 않는다.

### 9-2. dark 정책 — 세 시스템이 서로 다르다

| 시스템          | dark 처리                 | 배수                                                                                      |
| --------------- | ------------------------- | ----------------------------------------------------------------------------------------- |
| **composition** | 검정 유지 + 불투명도 상향 | **3~5배 (들쭉날쭉)** — sm 4× · md 3× · lg 4× · xl 5×                                      |
| Adobe Spectrum  | 검정 유지 + 불투명도 상향 | **정확히 3배, 전 토큰 일관** (.12→.36 · .16→.48 · .2→.6 · .08→.24 · .04→.12)              |
| Material 3      | **변화 없음**             | `shadow` 색이 light/dark 모두 `neutral.tone(0)`(검정), 불투명도 key .3 / ambient .15 고정 |

- 우리 dark 방향(불투명도 상향)은 Adobe 와 같다. 다만 **배수가 단계마다 다르다** — 근거 없는 편차다.
- **Phase 1 적용**: `darkShadows` 값을 정할 때 Spectrum 의 균일 3배를 기준선으로 삼는다. 현행 dark 값과의 diff 는 Phase 1 에서 제시한다.
- M3 는 dark 에서 그림자를 강화하지 않는다 — 표면 색 자체를 밝혀 고도를 표현하기 때문(surface tint). 우리는 surface tint 를 쓰지 않으므로 M3 정책은 채용 대상이 아니다.

### 9-3. 잉크량 통합 정렬 — 우리 스케일의 위치

§2 와 동일한 프로파일 지표(∫alpha·dd, light 기준). 낮을수록 약한 그림자.

|     잉크 | 토큰                   |     잉크 | 토큰               |
| -------: | ---------------------- | -------: | ------------------ |
| **0.06** | **composition sm**     |     0.90 | **composition lg** |
|     0.22 | SP1 `shadow-100`       |     0.95 | M3 level2          |
|     0.31 | SP2 `emphasized`       |     1.40 | SP2 `dragged`      |
|     0.42 | **composition md**     |     1.42 | M3 level3          |
|     0.46 | SP1 `shadow-200`       |     1.43 | SP1 `shadow-300`   |
|     0.53 | SP2 `emphasized-hover` | **1.88** | **composition xl** |
|     0.55 | SP2 `elevated`         |     2.08 | M3 level4          |
|     0.64 | M3 level1              |     3.18 | M3 level5          |

- `md`(0.42) ≈ SP1 `shadow-200`(0.46) — **L2 0.0039 로 거의 동일**. `lg`·`xl` 도 타 시스템 분포 안에 들어간다.
- **`sm`(0.06) 만 이탈**한다. 외부 최근사가 SP1 `shadow-100`(0.22)로 **3.7배** 차이 — 어느 시스템의 최하단보다도 한참 아래다. 사실상 "거의 보이지 않는" 단계이며, 그래서 §2 에서 Tooltip 의 근사 후보로 부적합했다(잉크 ×0.17).

### 9-4. overlay 현재값의 출처 — Tailwind 가 아니라 Adobe 계열

| 현재 값                   | 외부 최근사            |     L2 | 기하 일치                                                                       |
| ------------------------- | ---------------------- | -----: | ------------------------------------------------------------------------------- |
| Tooltip `0 2px 8px` α.12  | SP2 `emphasized`       | 0.0042 | **정확 일치** — SP2 최상위 레이어 = `0 2px 8px`, SP1 `shadow-200` = `0 2px 8px` |
| Popover `0 4px 12px` α.15 | (SP2 `elevated` 3순위) | 0.0096 | **정확 일치** — SP2 `elevated`/`emphasized-hover` 최상위 레이어 = `0 4px 12px`  |
| Modal `0 8px 32px` α.20   | SP1 `shadow-300`       | 0.0229 | 불일치 — blur 32 는 대조군 어느 값보다 넓다                                     |

- Tooltip / Popover 의 offset·blur 가 Spectrum 토큰과 **정확히 같은 수치**다. 우연으로 보기 어렵다 — 이 값들은 Tailwind 스케일이 아니라 **Adobe Spectrum 에서 온 것**으로 보인다.
- 즉 현재 저장소에는 **출처가 다른 두 계열이 섞여 있다**: 스케일(`sm~xl`) = Tailwind, overlay 3건 = Spectrum 계열.
- **D1 에 대한 함의**: D1-a(Tailwind 스케일 편입)는 Adobe 정합이던 값을 Tailwind 쪽으로 옮기는 선택이 된다. 단 **D3(시각 스타일)는 composition 이 자체 결정하는 영역**이고 Adobe 권위는 D1(DOM/ARIA)·D2(Props)에만 걸리므로(`ssot-hierarchy.md`), "Adobe 를 따라야 한다"가 자동 결론은 아니다. 어느 계열을 정본으로 삼든 **하나로 수렴시키는 것**이 본 ADR 의 목적이며, 계열 선택 자체는 사용자 판단 사항이다.

### 9-5. 본 대조에서 파생된 판단 — **전건 확정 (사용자 결정 2026-07-25)**

| #   | 발견                                       | 결정                                                                                               |
| --- | ------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| A   | `sm` 이 외부 최하단 대비 3.7배 약함        | **상향** — SP2 `emphasized`(잉크 0.31, ×5.15). C 에 흡수됨                                         |
| B   | dark 배수가 3~5배로 불균일                 | **Spectrum 균일 3배로 정규화** (§1-0)                                                              |
| C   | overlay 값이 Adobe 계열, 스케일은 Tailwind | **스케일을 Spectrum 기반으로 재정의** — SP2 값, 크기 이름(sm/md/lg) 유지, **3단계**(xl 제거). §1-0 |

- **세대 선택 근거 (SP2 vs SP1)**: SP2 가 현행 Spectrum 이고 프로젝트가 이미 S2 정합(ADR-022 / 052 / 053)이다. overlay 매핑 오차도 SP1 보다 작다(잉크비 ×0.89/0.73/0.62 vs ×0.64/0.61/0.64). SP2 의 `emphasized-hover` 는 hover 상태 토큰이라 크기 단계에서 제외했다.
- **3단계 근거**: Spectrum 이 4번째를 발행하지 않는다. 임의 확장 대신 축소를 택했다 — D3 `--shadow-xl` 소비처가 0건이라 코드 파손이 없고, 없는 근거를 지어내지 않는 쪽이 "Spectrum 기반"이라는 결정에 충실하다.
- **결정 후 위상 변화**: A·C 는 대조 시점에 본 ADR 결정과 직교했으나, 채택되면서 **Phase 1 의 내용 자체**가 됐다. 그 결과 본 ADR 의 scope 가 "값 언어 통일"에서 "값 언어 통일 + 스케일 재정의"로 확장됐다 — ADR 본문 제목·Context·Risks 에 반영됨.
