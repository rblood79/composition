# ADR-205 Phase 0 — 텍스트 시각 축 격차표

> [ADR-205](../205-text-visual-axis-computed-seam.md) · [breakdown §2](../design/205-text-visual-axis-computed-seam-breakdown.md)
> Gate **G0** 의 산출물. 아래 표는 `scripts/generate-text-axis-matrix.mjs` 가 코드에서 생성한다 —
> 추정으로 범위를 잡지 않는다 (breakdown §2 Phase 0 산출물).

## 1. 격차표 (생성물)

<!-- text-axis-matrix:begin -->

> 이 절은 `scripts/generate-text-axis-matrix.mjs` 가 코드에서 생성한다. 손으로 고치지 않는다.

- 속성 집합 = A ∪ B — A: `cssResolver.INHERITABLE_PROPERTIES` 텍스트 항목 16개 (`visibility` 제외) · B: ADR-057 블록이 `child.text.*` 로 옮기는 인라인 속성 14개 → 합집합 **22개**
- S1 DOM/Preview 는 renderer root 의 `style={element.props.style}` 통과 (62곳 — F13) — 인라인 전 속성이 브라우저 cascade 로 도달하므로 열을 따로 두지 않는다
- S4 상속 채널: Skia scene build 의 `ComputedStyle` 참조 **0건** → 상속 축은 전 속성 미도달 (ADR-205 F20 · R7)
- **측정** 열이 `—` 인 속성은 줄 수·폭을 바꾸지 않아 S2/S3 가 해당 없다 (측정 축 = `TextMeasureStyle` 필드 ∪ 폭 leg 실참조)

| 속성                  |  상속  | 측정 축 | S2 폭 leg 인라인 | S2 폭 leg 상속 | S3 wrap leg | S4 Skia 인라인 | S4 Skia 상속 |
| --------------------- | :----: | :-----: | :--------------: | :------------: | :---------: | :------------: | :----------: |
| `color`               |  상속  |    —    |        —         |       —        |      —      |       ✅       |      ❌      |
| `fontFamily`          |  상속  |  측정   |        ✅        |       ✅       |     ✅      |       ❌       |      ❌      |
| `fontSize`            |  상속  |  측정   |        ✅        |       ✅       |     ✅      |       ✅       |      ❌      |
| `fontStretch`         |  상속  |  측정   |        ✅        |       ✅       |     ❌      |    ✅ ⁽⁰⁵⁷⁾    |      ❌      |
| `fontStyle`           |  상속  |  측정   |        ✅        |       ✅       |     ❌      |       ❌       |      ❌      |
| `fontVariant`         |  상속  |  측정   |        ✅        |       ✅       |     ❌      |    ✅ ⁽⁰⁵⁷⁾    |      ❌      |
| `fontWeight`          |  상속  |  측정   |        ✅        |       ✅       |     ✅      |       ✅       |      ❌      |
| `letterSpacing`       |  상속  |  측정   |        ✅        |       ✅       |     ❌      |       ❌       |      ❌      |
| `lineHeight`          |  상속  |  측정   |        ✅        |       ✅       |     ✅      |    ✅ ⁽⁰⁵⁷⁾    |      ❌      |
| `overflowWrap`        |  상속  |  측정   |        ❌        |       ❌       |     ✅      |    ✅ ⁽⁰⁵⁷⁾    |      ❌      |
| `textAlign`           |  상속  |    —    |        —         |       —        |      —      |       ✅       |      ❌      |
| `textDecoration`      | 비상속 |    —    |        —         |       —        |      —      |    ✅ ⁽⁰⁵⁷⁾    |      ❌      |
| `textDecorationColor` | 비상속 |    —    |        —         |       —        |      —      |    ✅ ⁽⁰⁵⁷⁾    |      ❌      |
| `textDecorationStyle` | 비상속 |    —    |        —         |       —        |      —      |    ✅ ⁽⁰⁵⁷⁾    |      ❌      |
| `textIndent`          |  상속  |    —    |        —         |       —        |      —      |    ✅ ⁽⁰⁵⁷⁾    |      ❌      |
| `textOverflow`        | 비상속 |    —    |        —         |       —        |      —      |    ✅ ⁽⁰⁵⁷⁾    |      ❌      |
| `textShadow`          | 비상속 |    —    |        —         |       —        |      —      |    ✅ ⁽⁰⁵⁷⁾    |      ❌      |
| `textTransform`       |  상속  |  측정   |        ✅        |       ✅       |     ❌      |       ❌       |      ❌      |
| `verticalAlign`       | 비상속 |    —    |        —         |       —        |      —      |    ✅ ⁽⁰⁵⁷⁾    |      ❌      |
| `whiteSpace`          |  상속  |  측정   |        ❌        |       ❌       |     ✅      |    ✅ ⁽⁰⁵⁷⁾    |      ❌      |
| `wordBreak`           |  상속  |  측정   |        ❌        |       ❌       |     ✅      |    ✅ ⁽⁰⁵⁷⁾    |      ❌      |
| `wordSpacing`         |  상속  |  측정   |        ✅        |       ✅       |     ❌      |    ✅ ⁽⁰⁵⁷⁾    |      ❌      |

⁽⁰⁵⁷⁾ = ADR-057 블록(`buildSpecNodeData`)이 `child.text.*` 로 옮기는 축. 표식이 없는 ✅ 는 Skia scene build 의 다른 지점이 인라인 style 을 읽는다는 뜻.

**결손 — 측정 축인데 wrap leg 또는 Skia 인라인에 미도달: 7개**

- `fontFamily` — S4 Skia 인라인 미도달
- `fontStretch` — S3 wrap leg 미도달
- `fontStyle` — S3 wrap leg · S4 Skia 인라인 미도달
- `fontVariant` — S3 wrap leg 미도달
- `letterSpacing` — S3 wrap leg · S4 Skia 인라인 미도달
- `textTransform` — S3 wrap leg · S4 Skia 인라인 미도달
- `wordSpacing` — S3 wrap leg 미도달

<!-- text-axis-matrix:end -->

## 2. 읽는 법

| 열               | 뜻                                                            | 코드 출처                                                            |
| ---------------- | ------------------------------------------------------------- | -------------------------------------------------------------------- |
| 상속             | CSS 명세상 상속 속성인가                                      | `cssResolver.INHERITABLE_PROPERTIES`                                 |
| S2 폭 leg 인라인 | `calculateContentWidth` 가 `style?.X` 를 읽는가               | `layout/engines/utils.ts` `calculateContentWidth`                    |
| S2 폭 leg 상속   | 같은 함수가 `computedStyle?.X` 를 읽는가                      | 같은 함수                                                            |
| S3 wrap leg      | 줄 수를 만드는 두 계층이 그 축을 **인자로 받는가**            | `measureTextWithWhiteSpace` · `textMeasure.measureWrappedTextHeight` |
| S4 Skia 인라인   | ADR-057 블록이 인라인 `style.X` 를 `child.text.*` 로 옮기는가 | `skia/buildSpecNodeData.ts` ADR-057 블록                             |
| S4 Skia 상속     | Skia scene build 가 `ComputedStyle` 을 손에 쥐는가            | `canvas/skia/**` 의 `ComputedStyle` / `resolveStyle(` 참조 수        |

S1 (DOM/Preview) 은 열이 없다 — renderer root 가 `style={element.props.style}` 를 통째로 실어
브라우저 cascade 가 처리하므로 인라인 전 속성이 무조건 도달한다 (ADR-907 Layer C).
표의 "결손" 은 그 DOM 기준선에 대한 Canvas 쪽 격차다.

이 표가 재는 것은 **코드에 그 지점이 있는가**이지 "모든 컴포넌트가 그 값을 존중한다" 가 아니다.
`fontSize` · `color` · `textAlign` 의 S4 ✅ 는 ADR-057 블록이 아니라 자식 store style 전파
(`buildSpecNodeData.ts:1547·1562·1575`) 와 base/box 노드의 `style.color`
(`buildBaseNodeProps.ts:70` · `buildBoxNodeData.ts:115` · `buildSkiaNodeData.ts:84`) 에서 온다 —
컴포넌트 한정 경로다. "필드는 있는데 표면에 안 닿는" 형태(F15)를 이 표만으로는 구별할 수 없고,
그것이 Phase 2 **도달 검사**(G4 ②)가 따로 필요한 이유다.

## 3. F1~F21 대조 (G0 두 번째 조건)

| F            | 주장                                            | 표의 대응                                                                              | 판정   |
| ------------ | ----------------------------------------------- | -------------------------------------------------------------------------------------- | ------ |
| F1           | 상속 텍스트 CSS 17종에 `letterSpacing` 포함     | 집합 A 16개 + `visibility` = 17, `letterSpacing` 행 존재                               | 일치   |
| F5·F6·F9·F9b | 폭 leg 이 인라인+computed 를 같은 규칙으로 읽음 | `letterSpacing` S2 인라인 ✅ / S2 상속 ✅ (fontSize·fontFamily·fontWeight 등 9종 동형) | 일치   |
| F9c          | spec shape 채널은 별개                          | 표의 축이 아님 — S2/S3/S4 어디에도 spec shape 열이 없다 (인라인·상속 2채널만)          | 일치   |
| F12          | catalog letterSpacing 정의 0건                  | 표는 catalog 채널을 재지 않는다 — F12 는 S4 ✅ 였더라도 값이 안 온다는 별도 사실       | 무모순 |
| F13          | DOM 통과 62곳                                   | 생성물 머리말의 62곳                                                                   | 일치   |
| F18          | ADR-057 블록 13종, `letterSpacing` 만 부재      | ⁽⁰⁵⁷⁾ 표식 14개 · `letterSpacing` 무표식                                               | 아래   |
| F19          | wrap leg 에 letterSpacing 인자 자체가 없음      | `letterSpacing` S3 ❌                                                                  | 일치   |
| F20          | Skia scene build 에 `ComputedStyle` 0건         | S4 상속 열 전 행 ❌ (스크립트가 grep 으로 확인)                                        | 일치   |

**F18 의 13 vs 표의 14 — 세는 단위가 다르다.** 블록의 번호는 13개이고 그중 6번 `clipText` 는
`style.overflow` 파생(텍스트 속성 아님 — 표에서 제외)이며, 7번 `textDecoration` 은 7a
`textDecorationStyle` · 7b `textDecorationColor` 를 거느린다. 따라서 블록이 읽는 **텍스트
CSS 키**는 12 + 2 = **14개**로 표와 맞는다. 모순 아님.

## 4. Phase 1 범위 확정 (이 표가 정한다)

측정 축(줄 수·폭을 바꾸는 축) 중 **wrap leg 과 Skia 인라인 양쪽에 미도달**인 속성은 셋뿐이다 —
`letterSpacing` · `fontStyle` · `textTransform`. 그중 ADR-205 Phase 1 범위는 **`letterSpacing`
한 축**이다 (breakdown §3). 나머지 둘은 조건부 후속의 입력으로 남긴다:

| 속성                                          | 결손                     | 처리                                                                                              |
| --------------------------------------------- | ------------------------ | ------------------------------------------------------------------------------------------------- |
| `letterSpacing`                               | S3 wrap · S4 Skia 인라인 | **Phase 1** — 사용자-가시 결함(F15·F16)의 원인                                                    |
| `fontStyle`                                   | S3 wrap · S4 Skia 인라인 | 후속 — 폭 leg 은 이미 읽는다(S2 ✅✅). live 재현 미확인이라 Phase 1 에 넣지 않는다                |
| `textTransform`                               | S3 wrap · S4 Skia 인라인 | 후속 — 폭 leg 이 `applyTextTransform` 으로 이미 반영. Skia paint 는 별도 경로 조사 필요           |
| `fontStretch` · `fontVariant` · `wordSpacing` | S3 wrap 만               | 후속 — Skia 인라인은 ADR-057 블록이 이미 운반. `wordSpacing` 은 `ctx.measureText` 미반영(범위 밖) |
| `fontFamily`                                  | S4 Skia 인라인만         | 후속 — catalog/spec 채널로는 도달(F15 live). 인라인 override 경로만 부재                          |

**결손 3자리 확증**: ADR 본문이 예상한 ① wrap leg · ② Skia 인라인 · ③ 게이트 부재 중 ①②는 위
표로 확증됐다 (`letterSpacing` 행). ③ 은 이 문서가 생성물로 존재한다는 것 자체가 아직 게이트가
아님을 보인다 — Phase 2 에서 `--check` 를 pre-push 에 배선한다.
