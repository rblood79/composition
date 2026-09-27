# 텍스트 시각 축 격차표

> [ADR-205](../adr/completed/205-text-visual-axis-computed-seam.md) Gate G0 · G4 의 생성물. 표는 `scripts/generate-text-axis-matrix.mjs` 가 코드에서 만들고,
> pre-push (D3 경로) 와 `scripts/codex/text-axis-matrix-gate.sh` 가 `--check` 로 drift 를 막는다.
> 코드가 바뀌면 `node scripts/generate-text-axis-matrix.mjs` 로 갱신해 같이 커밋한다.
> Phase 별 실측 기록 (F1~F21 대조 · 게이트 실측 · live) 은 로컬 evidence 에만 있다.

<!-- text-axis-matrix:begin -->

> 이 절은 `scripts/generate-text-axis-matrix.mjs` 가 코드에서 생성한다. 손으로 고치지 않는다.

- 속성 집합 = A ∪ B — A: `cssResolver.INHERITABLE_PROPERTIES` 텍스트 항목 16개 (`visibility` 제외) · B: ADR-057 블록이 `child.text.*` 로 옮기는 인라인 속성 17개 → 합집합 **22개**
- S1 DOM/Preview 는 renderer root 의 `style={element.props.style}` 통과 (60곳 — F13) — 인라인 전 속성이 브라우저 cascade 로 도달하므로 열을 따로 두지 않는다
- S4 상속 채널: Skia scene build 에 `ComputedStyle` 참조는 여전히 **0건**(F20) — 대신 레이아웃이 `ComputedLayout.textAxes` 로 **선언된 축만** 실어 보낸다 (ADR-205 Phase 5). 현재 운반 축 `letterSpacing`
- **측정** 열이 `—` 인 속성은 줄 수·폭을 바꾸지 않아 S2/S3 가 해당 없다 (측정 축 = `TextMeasureStyle` 필드 ∪ 폭 leg 실참조)

| 속성                  |  상속  | 측정 축 | S2 폭 leg 인라인 | S2 폭 leg 상속 | S3 wrap leg | S4 Skia 인라인 | S4 Skia 상속 |
| --------------------- | :----: | :-----: | :--------------: | :------------: | :---------: | :------------: | :----------: |
| `color`               |  상속  |    —    |        —         |       —        |      —      |       ✅       |      ❌      |
| `fontFamily`          |  상속  |  측정   |        ✅        |       ✅       |     ✅      |       ❌       |      ❌      |
| `fontSize`            |  상속  |  측정   |        ✅        |       ✅       |     ✅      |    ✅ ⁽ᴳ⁴⁾     |      ❌      |
| `fontStretch`         |  상속  |  측정   |        ✅        |       ✅       |     ❌      |    ✅ ⁽⁰⁵⁷⁾    |      ❌      |
| `fontStyle`           |  상속  |  측정   |        ✅        |       ✅       |     ❌      |    ✅ ⁽⁰⁵⁷⁾    |      ❌      |
| `fontVariant`         |  상속  |  측정   |        ✅        |       ✅       |     ✅      |    ✅ ⁽⁰⁵⁷⁾    |      ❌      |
| `fontWeight`          |  상속  |  측정   |        ✅        |       ✅       |     ✅      |       ✅       |      ❌      |
| `letterSpacing`       |  상속  |  측정   |        ✅        |       ✅       |     ✅      | ✅ ⁽⁰⁵⁷⁾ ⁽ᴳ⁴⁾  |      ✅      |
| `lineHeight`          |  상속  |  측정   |        ✅        |       ✅       |     ✅      |    ✅ ⁽⁰⁵⁷⁾    |      ❌      |
| `overflowWrap`        |  상속  |  측정   |        ❌        |       ❌       |     ✅      |    ✅ ⁽⁰⁵⁷⁾    |      ❌      |
| `textAlign`           |  상속  |    —    |        —         |       —        |      —      |       ✅       |      ❌      |
| `textDecoration`      | 비상속 |    —    |        —         |       —        |      —      |    ✅ ⁽⁰⁵⁷⁾    |      ❌      |
| `textDecorationColor` | 비상속 |    —    |        —         |       —        |      —      |    ✅ ⁽⁰⁵⁷⁾    |      ❌      |
| `textDecorationStyle` | 비상속 |    —    |        —         |       —        |      —      |    ✅ ⁽⁰⁵⁷⁾    |      ❌      |
| `textIndent`          |  상속  |    —    |        —         |       —        |      —      |    ✅ ⁽⁰⁵⁷⁾    |      ❌      |
| `textOverflow`        | 비상속 |    —    |        —         |       —        |      —      |    ✅ ⁽⁰⁵⁷⁾    |      ❌      |
| `textShadow`          | 비상속 |    —    |        —         |       —        |      —      |    ✅ ⁽⁰⁵⁷⁾    |      ❌      |
| `textTransform`       |  상속  |  측정   |        ✅        |       ✅       |     ❌      |    ✅ ⁽⁰⁵⁷⁾    |      ❌      |
| `verticalAlign`       | 비상속 |    —    |        —         |       —        |      —      |    ✅ ⁽⁰⁵⁷⁾    |      ❌      |
| `whiteSpace`          |  상속  |  측정   |        ❌        |       ❌       |     ✅      |    ✅ ⁽⁰⁵⁷⁾    |      ❌      |
| `wordBreak`           |  상속  |  측정   |        ❌        |       ❌       |     ✅      |    ✅ ⁽⁰⁵⁷⁾    |      ❌      |
| `wordSpacing`         |  상속  |  측정   |        ✅        |       ✅       |     ✅      |    ✅ ⁽⁰⁵⁷⁾    |      ❌      |

⁽⁰⁵⁷⁾ = ADR-057 블록(`buildSpecNodeData`)이 `child.text.*` 에 **대입**하는 축. 표식이 없는 ✅ 는 Skia scene build 의 다른 지점이 인라인 style 을 읽는다는 뜻.

⁽ᴳ⁴⁾ = G4 ② 가 값 수준으로 도달을 확인한 축. **표식 없는 S4 ✅ 는 상한이지 증거가 아니다** — 이 열의 detector 는 `canvas/skia/**` 의 `style.X` 언급을 세므로, 값을 버리는 해소기가 중간에 있어도 ✅ 로 보인다. `fontSize` 가 그 사례였다 (Phase 4 live: 저장 `"23px"` → Skia 16 / DOM 23).

**결손 — 측정 축인데 wrap leg 또는 Skia 인라인에 미도달: 4개**

- `fontFamily` — S4 Skia 인라인 미도달
- `fontStretch` — S3 wrap leg 미도달
- `fontStyle` — S3 wrap leg 미도달
- `textTransform` — S3 wrap leg 미도달

<!-- text-axis-matrix:end -->

## 읽는 법

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
