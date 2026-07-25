# ADR-166: 그림자 토큰 theme-aware 승격 + 값 언어 TokenRef 통일 + 스케일 Spectrum 재정의

## Status

Accepted — 2026-07-25 (리뷰 round 1 승인 — 이슈 5건 전건 fixed, [reviews/166.md](reviews/166.md))

### 진행 로그

| Phase                                      | 상태          | 비고                                      |
| ------------------------------------------ | ------------- | ----------------------------------------- |
| Phase 0 (inventory + G1)                   | ✅ 2026-07-25 | G1 dark glow live 실측 통과 (design §0-3) |
| Phase 1 (토큰 theme-aware + 스케일 재정의) | —             |                                           |
| Phase 2 (값 언어 TokenRef 통일)            | —             |                                           |
| Phase 3 (Skia 소비 배선)                   | —             |                                           |
| Phase 4 (primitive 은퇴)                   | —             |                                           |
| Phase 5 (검증·가드)                        | —             |                                           |

## Context

**SSOT domain**: **D3 (시각 스타일)** 단독. 그림자는 catalog(`COMPONENT_RULES_TABLE`) + theme/tokens 가 SSOT 이고 Builder(Skia)/Preview(DOM+CSS)가 대등 consumer 다. D1(DOM/ARIA)·D2(Props/API) 경계는 교차하지 않는다 — 새 prop 도, DOM 구조 변경도 없다.

2026-07-25 작업(커밋 `47b26a8cc` / `bec606ec7`)으로 Popover / Tooltip / Modal 의 elevation 을 수동 CSS 에서 catalog `structure.containerStyles.boxShadow` 로 옮겼다. CSS 축은 정합해졌으나, 그 과정에서 **그림자 값이 D3 SSOT 체계 안에서 유일하게 토큰화되지 않은 시각 속성**이라는 사실이 드러났다. 세 가지 결함이 같은 뿌리에서 나온다.

**결함 1 — Skia 가 값을 해석하지 못한다.** 등록된 값 `color-mix(in srgb, var(--fg) N%, transparent)` 는 그림자 파서의 색 추출 정규식(`rgba?\(…\)` / `hsla?\(…\)` / `#hex`)에 걸리지 않아 기본값 `rgba(0,0,0,1)` 로 떨어진다. 실측: `buildSkiaEffects` 가 `alpha 1.0` 불투명 검정 반환(대조군 `rgba(0,0,0,0.15)` → `0.15` 정상). 파서는 두 벌(`specs/primitives/shadows.ts::parseShadow`, `builder/…/styleConverter.ts::parseOneShadow`)이 있고 둘 다 같은 공백을 갖는다.

**결함 2 — dark 에서 방향이 뒤집힌다.** `--fg` 는 light `--color-neutral-900`(근-검정) / dark `--color-neutral-100`(근-흰색)이다. 따라서 `color-mix(var(--fg) 20%)` 는 dark 에서 20% 흰 번짐 — 그림자가 아니라 glow 다. 같은 프로젝트의 `--shadow-*` 는 정반대 정책(검정 유지 + 불투명도 0.05→0.2 상향)을 이미 쓰고 있다.

> **2026-07-25 live 실측 — Gate G1 통과.** preview 문서에서 `[data-theme="dark"]` 하위 computed `box-shadow` 를 직접 읽었다. light `--fg` = `rgb(23,23,23)` → 그림자 색 `color(srgb 0.09 0.09 0.09 / 0.2)`(검정) / dark `--fg` = `rgb(245,245,245)` → **`color(srgb 0.96 0.96 0.96 / 0.2)`(흰색)**. 같은 조건의 대조군 `--shadow-md` 는 light `rgba(0,0,0,0.1)` → dark `rgba(0,0,0,0.3)` 으로 검정을 유지하며 불투명도만 올린다. 렌더 확인에서도 dark 의 Popover / Modal 은 박스 둘레에 밝은 후광이 보인다. 결함 2 는 도출이 아니라 **확증된 사실**이다.

**결함 3 — 값 언어가 4종 공존한다.** catalog 안에서 `color-mix+var`(3) / raw rgba(1) / TokenRef `{shadow.sm}`(1) / CSS var `var(--shadow-*)`(8, staticSelectors) 이 섞여 있다. 이 중 `containerStyles.boxShadow` 만 토큰 해석을 거치지 않는다 — 형제 필드인 `states.*.boxShadow` 와 `indicatorMode.boxShadow` 는 이미 `CSSGenerator.resolveBoxShadow` 를 경유해 `{shadow.*}` 를 받는다.

**Generator 지원 여부 (선차단 확인)**: `CSSGenerator` 는 `{shadow.*}` → `var(--shadow-*)` 변환을 이미 보유한다(`resolveBoxShadow`, `CSSGenerator.ts:1057`). 따라서 본 결정에 Generator 신규 기능은 필요 없고, `emitContainerStyles` 를 그 경로에 합류시키는 배선만 남는다. 자식 selector / variant emit 축은 본 ADR 범위 밖이다 — 대상이 컨테이너 root 선언 하나이기 때문이다.

배경에는 토큰 층 자체의 비대칭이 있다. `--shadow-*` **CSS 변수는 light/dark 값이 다른데**, 같은 토큰의 TS 표현인 `resolveToken("{shadow.*}")` 는 flat map 이라 **theme 분기가 없다**(`color` 카테고리만 light/dark 이원화). 즉 `{shadow.md}` 는 지금도 CSS 축과 Skia 축에서 서로 다른 값이다.

**결함 4 — 스케일 값 자체의 출처가 섞여 있다** (2026-07-25 외부 대조에서 추가 확인 — design §9). `sm/md/lg/xl` 은 Tailwind 수치를 그대로 쓰는데, 위 overlay 3건은 offset·blur 가 **Adobe Spectrum 토큰과 정확히 일치**한다(Tooltip `0 2px 8px` = SP2 `emphasized` 최상위 레이어 / Popover `0 4px 12px` = SP2 `elevated`). 한 저장소 안에 출처가 다른 두 계열이 공존한다. 더불어 `sm`(잉크 0.06)은 Material 3 · Spectrum 어느 시스템의 최하단(SP1 `shadow-100` 0.22)보다도 **3.7배 약해** 사실상 보이지 않는 단계다. dark 정책도 방향은 Adobe 와 같으나 배수가 단계마다 3~5배로 불균일하다(Adobe 는 전 토큰 정확히 3배).

> **scope 확장 기록 (2026-07-25)**: 본 ADR 은 "값을 어떻게 표현할 것인가"(결함 1~3)로 시작했다. 외부 대조 결과 **"값이 무엇이어야 하는가"**(결함 4)가 같은 지점 — Phase 1 의 토큰 map — 에서 결정된다는 것이 드러났고, 사용자 판단으로 스케일 재정의를 본 ADR 에 포함한다. 두 축은 분리 가능하지만 `lightShadows`/`darkShadows` 정의라는 **하나의 변경 지점을 공유**하므로, 따로 진행하면 같은 파일을 두 번 고치게 된다.

현재 캔버스의 overlay 그림자는 catalog 가 아니라 하드코딩 primitive(`popover_shadow` alpha 0.15 / `dialog_shadow` alpha 0.2)가 그린다. 그 결과 Popover 는 값이 catalog 와 primitive 두 곳에 중복 존재하고, Tooltip / Modal 은 캔버스 그림자가 **아예 없다**.

**Hard Constraints**:

1. **D3 대칭** — 동일 SSOT 에서 Skia 와 DOM+CSS 가 같은 시각 결과를 낸다 (`ssot-hierarchy.md`). 한쪽만 그림자를 갖는 현 상태는 위반이다.
2. **캔버스 theme 독립** — 캔버스 theme 은 `resolveSkiaTheme(darkMode)` 로 빌더 chrome DOM theme 과 별개다. 따라서 DOM probe 기반 해석(`cssVariableCore.resolveColorMix` 의 temp div + `getComputedStyle`)은 **빌더 theme 값**을 돌려주므로 해석 수단으로 쓸 수 없다.
3. **60fps** — 그림자 색 해석은 노드 빌드 경로(`buildBoxNodeData` / `buildSpecNodeData`)에서 요소마다 실행된다. 노드당 `getComputedStyle` 호출 금지.
4. **light 무회귀 또는 명시 승인** — 2026-07-25 커밋은 Popover/Tooltip/Modal 의 light computed 값을 byte-identical 로 보존했다. 값이 바뀌면 Gate 에서 before/after 를 제시하고 승인을 받는다.
5. **패널 왕복 보존** — `AppearanceSection.boxShadowToPresetKey` 가 프리셋 문자열을 역매핑해 Select 표시를 정한다. theme 이 바뀌어도 프리셋이 "custom" 으로 떨어지지 않아야 한다.

**Soft Constraints**:

- 그림자 파서가 2벌이고 통합 계획은 없다 — 이번 결정은 파서를 고치지 않는 방향이 바람직하다.
- `--shadow-*` 는 `var(--box-shadow-*, …)` 형태의 AI 테마 오버라이드 훅을 갖는다. TS 토큰 map 은 그 오버라이드를 모른다.
- 실사용 데이터 부재 — overlay 그림자의 시각 변경을 사용자가 어느 정도 감내하는지에 대한 근거가 없다.

> 실측 baseline 전수(값 언어 5채널 / 파서 2벌 / 토큰 비대칭 / Skia 소비 경로)는 [design breakdown §0](design/166-shadow-token-theme-aware-ssot-breakdown.md) 참조.

## Alternatives Considered

### 대안 A: Skia 파서 확장 (catalog 는 raw CSS 유지)

- 설명: `parseOneShadow` / `parseShadow` 의 색 추출에 `color-mix(` / `var(` 를 추가하고, `resolveColorMix` 에 theme 인지 CSS 변수 해석(`cssVarToTokenRef` → `resolveToken(ref, theme)`)을 주입한다. catalog 값은 손대지 않는다.
- 근거: 같은 문제를 같은 방식으로 푼 선례가 프로젝트 안에 있다 — `resolveColor()` 가 2026-07-20 에 `var()` 리터럴을 `cssVarToTokenRef` 로 역변환해 `resolveToken(theme)` 로 해석하도록 확장됐다(Selected variant 배선). 외부적으로도 CSS 문자열을 런타임 파싱해 캔버스로 넘기는 방식은 Konva `Shape.shadowColor` 등에서 통용된다.
- 위험:
  - 기술: **MED** — pure 함수인 `parseOneShadow` 에 `theme` 인자를 스레딩해야 하고, 파서 2벌을 각각 고쳐야 한다.
  - 성능: **LOW** — 문자열 파싱 + map lookup. DOM probe 없음.
  - 유지보수: **HIGH** — 값 언어 4종이 그대로 남는다. catalog 에 그림자를 추가할 때마다 "이 표현이 Skia 파서를 통과하는가" 를 개별 판단해야 하고, 파서 2벌 동기화 의무가 영구화된다.
  - 마이그레이션: **LOW** — catalog 값 무변경.
  - 추가: **결함 2(dark glow) 미해결**. 파싱에 성공해도 `color-mix(var(--fg) 20%)` 는 dark 에서 흰 번짐이다.

### 대안 B: `shadow` 토큰 theme-aware 승격 + `containerStyles.boxShadow` TokenRef 통일

- 설명: `shadows` flat map 을 `lightShadows` / `darkShadows` 로 이원화하고 `resolveToken` 의 `shadow` 분기를 `color` 와 같은 구조로 맞춘다. catalog 3건을 `{shadow.*}` TokenRef 로 교체하고, `emitContainerStyles` 가 기존 local `resolveBoxShadow` 를 경유하게 해 형제 필드와 같은 경로로 합류시킨다. Skia 는 `resolveBoxShadow(ref, skiaTheme)` 로 전개된 rgba 문자열을 얻으므로 **기존 파서를 그대로 통과**한다.
- 근거: 프로젝트 내부 선례 — `color` 카테고리는 이미 `lightColors`/`darkColors` 로 theme 분기하고, `--shadow-*` CSS 변수도 이미 light/dark 값이 다르다. 즉 "그림자는 theme 별 값을 갖는다" 는 정책은 이미 채택돼 있고 TS 층만 따라오지 않은 상태다. 외부 대조(2026-07-25 원본 실측 — design §9)에서도 **Material 3**(level 0~5, key+ambient 2레이어)와 **Adobe Spectrum**(SP1 `100/200/300` 3단계 · SP2 `emphasized`/`elevated`/`dragged` 역할 토큰 3레이어)가 모두 단일 토큰 집합 + 컴포넌트 참조 구조를 쓴다. **Adobe Spectrum 은 dark 에서 검정을 유지하며 불투명도를 정확히 3배로 올린다**(.12→.36 · .16→.48 · .2→.6) — 본 결정의 dark 정책과 같은 방향이고, Phase 1 의 `darkShadows` 기준선이 된다. (**Apple 은 그림자 계층을 발행하지 않아** 대조군에서 제외 — HIG `/elevation`·`/shadows` 404, 공개 토큰 패키지 없음.)
- 위험:
  - 기술: **LOW** — 신규 메커니즘 없음. 기존 두 메커니즘(`resolveToken` theme 분기 + local `resolveBoxShadow`)의 조합이다. 파서 수정 0.
  - 성능: **LOW** — map lookup 1회.
  - 유지보수: **LOW** — 값 언어가 TokenRef 로 수렴하고, 형제 필드와 해석 경로가 하나가 된다.
  - 마이그레이션: **MED** — `shadows` export 시그니처가 바뀐다(flat → theme 이원). 소비처는 `getShadowToken` / 패널 `cssToPresetMap` / Toast.css 등. 패널 역매핑이 theme 종속이 되면 dark 에서 프리셋이 "custom" 으로 표시될 수 있다.

### 대안 C: 구조화 shadow 객체

- 설명: `boxShadow` 를 CSS 문자열이 아니라 `{ offsetX, offsetY, blur, spread, color: TokenRef, alpha, inset }[]` 구조로 정의하고, CSS 축은 문자열 생성기로, Skia 축은 `DropShadowEffect` 로 각각 파생한다.
- 근거: Figma / Pencil 의 effect 모델이 구조화 배열이고, Skia `DropShadowEffect` 와 필드가 1:1 대응한다. 파싱 자체가 사라진다는 점에서 가장 근본적이다.
- 위험:
  - 기술: **MED** — CSS 문자열 생성기 신규 작성. `inset` / 다중 레이어 / 음수 spread 등 표현 범위를 직접 책임져야 한다.
  - 성능: **LOW**.
  - 유지보수: **MED** — 파싱은 사라지지만 "CSS 값 그대로 쓸 수 있다" 는 단순성을 잃는다. RAC starter 에서 값을 옮겨올 때마다 수동 분해가 필요하다.
  - 마이그레이션: **HIGH** — `states.*.boxShadow` / `indicatorMode.boxShadow` / staticSelectors 8건 / 패널 프리셋 왕복까지 그림자 관련 표현을 전부 재작성해야 한다. 본 ADR 이 고치려는 3건 대비 파급이 한 자릿수 배 크다.

### 대안 D: 현상 유지 — `containerStyles.boxShadow` 는 CSS 축 전용

- 설명: 그림자는 CSS 축에서만 catalog 가 소유하고, 캔버스는 하드코딩 primitive 를 유지한다. Skia 소비 배선을 하지 않는다.
- 근거: 캔버스는 편집 도구이므로 그림자 같은 장식 요소의 정확도 요구가 낮다는 관점. `overlay_backdrop` 처럼 캔버스 전용 표현이 이미 존재한다는 선례도 있다.
- 위험:
  - 기술: **LOW** — 변경 없음.
  - 성능: **LOW**.
  - 유지보수: **HIGH** — Popover 값이 catalog 와 `skiaPrimitives.ts` 두 곳에 중복 존재하고(둘이 어긋나도 감지 수단 없음), Tooltip / Modal 은 캔버스 그림자 부재가 고착된다. D3 대칭 위반을 명시적으로 수용하는 선택이다.
  - 마이그레이션: **LOW**.
  - 추가: **결함 2(dark glow) 미해결** — CSS 축에 그대로 남는다.

### Risk Threshold Check

| 대안                         |  기술   | 성능 | 유지보수 | 마이그레이션 | HIGH+ 개수 |
| ---------------------------- | :-----: | :--: | :------: | :----------: | :--------: |
| A (파서 확장)                |   MED   | LOW  | **HIGH** |     LOW      |     1      |
| **B (토큰 승격 + TokenRef)** | **LOW** | LOW  | **LOW**  |   **MED**    |   **0**    |
| C (구조화 객체)              |   MED   | LOW  |   MED    |   **HIGH**   |     1      |
| D (현상 유지)                |   LOW   | LOW  | **HIGH** |     LOW      |     1      |

- CRITICAL 0건 → 근본적으로 다른 접근 추가 불필요.
- HIGH+ 가 0인 대안 B 가 존재 → 위험 회피용 새 대안 추가 불필요. **루프 종료 (1회)**.
- A / C / D 의 HIGH 는 서로 다른 축이라 조합으로 해소되지 않는다: A·D 는 값 언어 분산을 남기고, C 는 파급이 크다.

## Decision

**대안 B: `shadow` 토큰 theme-aware 승격 + `containerStyles.boxShadow` TokenRef 통일**을 선택한다.

선택 근거:

1. **HIGH+ 잔존 0.** 유일하게 4축 모두 MED 이하다. 유일한 MED(마이그레이션)는 `shadows` 를 light map 별칭으로 유지하는 하위 호환 조치로 좁힐 수 있어, 수용 가능한 잔존 위험이다.
2. **파서를 건드리지 않고 결함 1 이 사라진다.** 값 언어가 TokenRef 로 수렴하면 `color-mix`/`var` 가 애초에 파서에 도달하지 않는다. 파서 2벌이라는 기존 부채를 이번 변경의 전제로 끌어들이지 않는다.
   - **한정 (2026-07-25 리뷰)**: 이 근거는 "모든 `{shadow.*}` 가 파서를 통과한다"가 아니라 "**본 ADR 이 정의하는 키가** 통과한다"이다. 현행 `shadows["focus-ring"]` 은 값에 `var(--accent)` 를 담고 있어 TokenRef 를 거쳐도 `var()` 가 그대로 나온다(실사용 0건). design §1-0 에서 해당 키의 제거/유지를 확정하고, §5 정적 가드가 "토큰 map 값에 `var(`/`color-mix(` 미포함"을 기계 집행한다.
3. **결함 2(dark glow)를 정책으로 해소한다.** theme 별 값을 갖는 순간 dark 는 `--shadow-*` 가 이미 쓰고 있는 정책(검정 유지 + 불투명도 상향)을 그대로 따를 수 있다. A·D 는 이 결함을 남긴다.
4. **이미 채택된 정책을 완성하는 방향이다.** "그림자는 theme 별 값을 갖는다"(CSS 변수) 와 "`{shadow.*}` 는 유효한 표현이다"(형제 필드 2개)는 둘 다 이미 코드에 있다. 본 결정은 새 규칙 도입이 아니라 TS 토큰 층과 `containerStyles` 채널을 그 정책에 합류시키는 것이다.

기각 사유:

- **대안 A 기각**: 값 언어 4종을 그대로 두므로 catalog 에 그림자를 추가할 때마다 "Skia 파서 통과 여부" 를 개별 판단해야 한다(유지보수 HIGH). 파서 2벌 동기화 의무가 영구화된다. 결함 2 도 남는다.
- **대안 C 기각**: 방향은 가장 근본적이지만 마이그레이션 HIGH — 고치려는 결함 3건 대비 그림자 표현 전체 재작성이라는 파급이 불균형하다. TokenRef 통일(B)로 값 언어가 하나가 된 뒤에도 구조화가 필요하다면 그때 별도 ADR 로 판정하는 편이 순서상 옳다.
- **대안 D 기각**: D3 대칭 위반을 명시적으로 수용하는 선택인데, 그 대가로 얻는 것이 "변경 없음" 뿐이다. Popover 값 이중 보유는 감지 수단 없는 drift 원천이고, Tooltip/Modal 의 캔버스 그림자 부재는 사용자가 캔버스에서 본 것과 배포 결과가 다르다는 뜻이다.

### 결함 4 에 대한 결정 — 스케일을 Adobe Spectrum 2 기반으로 재정의 (사용자 결정 2026-07-25)

D3 그림자 스케일의 **값**을 Spectrum 2 역할 토큰에서 가져오고, **이름**은 크기 축(`sm`/`md`/`lg`)을 유지한다. `xl` 은 제거해 **3단계**로 축소한다.

| 단계 | SP2 출처     | 잉크 (현행 대비) |
| ---- | ------------ | ---------------- |
| `sm` | `emphasized` | 0.31 (**×5.15**) |
| `md` | `elevated`   | 0.55 (×1.32)     |
| `lg` | `dragged`    | 1.40 (×1.56)     |

dark 는 **전 레이어 alpha ×3** (Spectrum 규칙). overlay 3건은 `Tooltip→sm` / `Popover→md` / `Modal→lg` 로 배분된다 — 앞의 둘은 원출처로의 복귀다. 값 표와 판정 근거는 design §1-0 / §9-5.

근거:

1. **이름은 바꾸지 않는다.** 스타일 패널이 크기 축으로 노출하고 소비처 40+곳이 이 이름을 쓴다. Spectrum 의 역할 명명(`emphasized`/`elevated`/`dragged`)을 그대로 들여오면 사용자 노출 어휘까지 바뀐다 — 값 정합이 목적이지 명명 이식이 목적이 아니다.
2. **SP2 를 택한 이유** (SP1 숫자 스케일 대비): SP2 가 현행 Spectrum 이고 프로젝트가 이미 S2 정합(ADR-022 / 052 / 053)이다. overlay 매핑 오차도 더 작다(잉크비 ×0.89/0.73/0.62 vs SP1 ×0.64/0.61/0.64).
3. **3단계로 줄인 이유**: Spectrum 이 4번째 단계를 발행하지 않는다. 임의 확장보다 축소가 "Spectrum 기반"이라는 결정에 충실하고, D3 `--shadow-xl` 소비처가 0건이라 코드 파손이 없다.
4. **적용 범위는 D3 뿐**이다. 빌더 chrome(`App.css`)에도 같은 이름의 토큰이 한 단계 어긋난 값으로 존재하지만(design §1-2), builder-system layer 라 D3 SSOT 체인 밖이다.

> 구현 상세: [166-shadow-token-theme-aware-ssot-breakdown.md](design/166-shadow-token-theme-aware-ssot-breakdown.md)

## Risks

| ID  | 위험                                                                                                                                            | 심각도 | 대응                                                                                                                                                                                                                                  |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------- | :----: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | 패널 프리셋 역매핑(`cssToPresetMap`)이 light 값만 인덱싱 → dark 에서 프리셋이 "custom" 으로 표시. 값이 3레이어가 되어 문자열 비교 대상이 길어짐 |  MED   | 역매핑을 light + dark 양쪽 값으로 인덱싱. `AppearanceSection` 왕복 테스트에 dark 케이스 추가                                                                                                                                          |
| R2  | `shadows` flat map 을 import 하는 기존 소비처 회귀 (`getShadowToken` / Toast.css / 패널)                                                        |  MED   | `shadows = lightShadows` 별칭 유지(시그니처 보존) + 소비처 grep 후 명시 전환. 정적 가드로 신규 flat 접근 차단                                                                                                                         |
| R3  | overlay 매핑의 light 시각 변경 — 특히 **Modal 이 ×0.62 로 눈에 띄게 옅어진다**(blur 32 는 Spectrum 범위 밖이라 대응 없음)                       |  MED   | Spectrum 정규화의 의도된 결과. G2 에서 before/after 제시. Tooltip(×0.89)·Popover(×0.73)는 원출처 복귀라 오차가 작다                                                                                                                   |
| R4  | Skia primitive 제거 순서가 뒤바뀌면 Popover 캔버스 그림자에 공백 구간 발생                                                                      |  MED   | Phase 순서 고정(3 → live 확인 → 4). Phase 4 는 G4 통과 후에만 진행                                                                                                                                                                    |
| R5  | `--shadow-*` 의 AI 테마 오버라이드(`--box-shadow-*`)를 TS 토큰 map 이 모름 → theme studio 로 그림자를 바꾸면 재발산                             |  LOW   | 범위 밖 명시. 재개 조건 = theme studio 그림자 커스터마이즈가 실사용에 등장. 그 시점에 오버라이드 조달 경로를 판정                                                                                                                     |
| R6  | Dialog 는 `containerStyles.boxShadow` 미보유라 `dialog_shadow` 제거 시 대체 공급원이 없음                                                       |  MED   | 2026-07-25 판정(Modal 이 modal elevation 소유, RAC starter `Dialog.css` 근거)을 유지 — Modal 그림자로 대체 검증                                                                                                                       |
| R7  | ~~스케일과 overlay 의 출처 계열 미확정~~ → **해소** (사용자 결정 2026-07-25: Spectrum 2 로 수렴)                                                |   —    | design §9-5 에 결정 기록. 잔존 위험 아님                                                                                                                                                                                              |
| R8  | `sm` 이 ×5.15 로 강해져 D3 소비처 **10파일**에 광범위 시각 변경. 그중 다수가 form field(ComboBox/Select/NumberField/SearchField)                |  MED   | 일괄 승계 금지 — design §1-3 에서 **실질 8건**(catalog staticSelectors 4 + indicatorMode 1 + 수동 CSS 3)을 `sm` 유지 / `none` / 타 단계로 개별 판정. Spectrum 의 textfield 계열은 drop-shadow 미사용이라 `none` 판정이 다수일 수 있음 |
| R10 | 10건 중 5건이 `generated/*.css` — 직접 편집하면 `pnpm build:specs` 가 덮어써 판정이 소실됨                                                      |  MED   | 수정 지점을 catalog(`componentRulesTable.ts` — `generated/` 경로지만 직접 편집 SSOT)와 수동 CSS 3건으로 한정. generated CSS diff 는 판정 결과의 **검증 수단**으로만 사용 (design §1-3)                                                |
| R9  | `xl` 제거로 스타일 패널 프리셋이 4→3 개. 기존 프로젝트가 저장한 xl 값이 "custom" 으로 표시됨                                                    |  LOW   | 저장된 값 자체는 보존된다(`AppearanceSection` 동적 custom 항목 경로). D3 `--shadow-xl` 소비처 0건이라 코드 파손 없음                                                                                                                  |

잔존 HIGH 위험 없음.

## Gates

| Gate | 시점                     | 통과 조건                                                                                                                                                                                                                  | 실패 시 대안                                                                              |
| ---- | ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| G1   | Phase 0 (착수 전)        | **✅ 통과 — 2026-07-25 실측.** dark `--fg` = `rgb(245,245,245)` → 그림자 색 `color(srgb 0.96 0.96 0.96 / 0.2)`(흰 후광). 대조군 `--shadow-md` 는 dark 에서 `rgba(0,0,0,0.3)`                                               | (통과 — N/A)                                                                              |
| G2   | Phase 2 종료             | ① 스케일 3단계 값이 design §1-0 표와 일치(light) + dark 가 전 레이어 alpha ×3 ② overlay 매핑 `Tooltip→sm`/`Popover→md`/`Modal→lg` ③ **`sm` 소비처 10건 개별 판정표 작성 완료**(§1-3) ④ before/after 시각 diff 제시 후 승인 | 승인 없으면 해당 소비처만 `none` 또는 현행 유지로 되돌리고 스케일 정의는 유지             |
| G3   | Phase 3 종료             | 캔버스에서 Popover/Tooltip/Modal 그림자가 light·dark 각각 DOM 과 시각 일치 (`/cross-check` 8조합)                                                                                                                          | 불일치 축을 특정해 Phase 3 배선 수정. 파서 수정이 필요하다고 판명되면 대안 A 를 부분 병합 |
| G4   | Phase 4 (primitive 제거) | `popover_shadow` / `dialog_shadow` 제거 후에도 Popover / Dialog 캔버스 그림자가 유지됨을 live 확인                                                                                                                         | primitive 존치 + Phase 3 배선 재점검. 제거는 다음 사이클로 이월                           |

## Consequences

### Positive

- `containerStyles.boxShadow` 가 형제 필드(`states.*` / `indicatorMode`)와 같은 해석 경로에 합류한다 — catalog 안에서 그림자 값 언어가 TokenRef 하나로 수렴.
- Tooltip / Modal 이 캔버스에서 **처음으로** 그림자를 갖는다. Popover 는 catalog / `skiaPrimitives.ts` 이중 보유가 해소된다.
- `{shadow.*}` 가 CSS 축과 Skia 축에서 같은 값을 의미하게 된다 — 지금은 같은 토큰이 축마다 다른 값이다.
- dark 그림자가 일관된 정책(검정 유지 + 전 레이어 alpha ×3)을 따른다 — 현행의 3~5배 불균일이 사라진다.
- **D3 그림자 값의 출처가 하나가 된다.** Tailwind 스케일 + Spectrum overlay 혼재가 Spectrum 2 단일 계열로 수렴한다.
- `sm` 이 실제로 보이는 단계가 된다 — 현행 잉크 0.06 은 어느 외부 시스템 최하단보다 3.7배 약해 사실상 무효 단계였다.
- 그림자 파서 2벌을 수정하지 않고 증상이 사라진다 — 파서 통합 부채를 이번 변경의 전제로 끌어들이지 않는다.

### Negative

- `shadows` export 형태가 바뀐다. 별칭으로 시그니처를 보존하더라도 소비처는 "이 값이 어느 theme 인가" 를 의식해야 한다 (R2).
- **시각 변경 범위가 overlay 3건을 넘어선다.** `sm` 이 ×5.15 가 되어 D3 소비처 10파일(다수가 form field)에 영향한다 (R8) — design §1-3 개별 판정으로 좁히지만, 판정 자체가 Phase 2 의 실작업이 된다.
- Modal 그림자가 눈에 띄게 옅어진다(×0.62) — Spectrum 이 그만큼 넓은 그림자를 발행하지 않는다 (R3).
- 스타일 패널 프리셋이 4→3 단계로 줄어 사용자 선택지가 하나 사라진다 (R9).
- 빌더 chrome(`App.css`)과 D3 가 **같은 토큰 이름을 다른 값으로** 유지하는 상태는 그대로 남는다 (design §1-2 / §8) — 오히려 두 값의 차이는 더 벌어진다.
- Skia 노드 빌드 경로에 catalog fallback 분기가 하나 늘어난다 — `resolveEffectiveOverflow` 와 같은 형태이므로 패턴은 기존과 동일하지만, catalog 조회 지점이 `background` / `overflow` 에 이어 세 번째가 된다.
- 파서 2벌 공존과 `staticSelectors` 의 `var(--shadow-*)` 8건은 그대로 남는다 (범위 밖 — design §8).
