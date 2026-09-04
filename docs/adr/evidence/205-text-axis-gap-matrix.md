# ADR-205 Phase 0 — 텍스트 시각 축 격차표

> [ADR-205](../205-text-visual-axis-computed-seam.md) · [breakdown §2](../design/205-text-visual-axis-computed-seam-breakdown.md)
> Gate **G0** 의 산출물. 아래 표는 `scripts/generate-text-axis-matrix.mjs` 가 코드에서 생성한다 —
> 추정으로 범위를 잡지 않는다 (breakdown §2 Phase 0 산출물).

## 1. 격차표 (생성물)

<!-- text-axis-matrix:begin -->

> 이 절은 `scripts/generate-text-axis-matrix.mjs` 가 코드에서 생성한다. 손으로 고치지 않는다.

- 속성 집합 = A ∪ B — A: `cssResolver.INHERITABLE_PROPERTIES` 텍스트 항목 16개 (`visibility` 제외) · B: ADR-057 블록이 `child.text.*` 로 옮기는 인라인 속성 15개 → 합집합 **22개**
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
| `letterSpacing`       |  상속  |  측정   |        ✅        |       ✅       |     ✅      |    ✅ ⁽⁰⁵⁷⁾    |      ❌      |
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

**결손 — 측정 축인데 wrap leg 또는 Skia 인라인에 미도달: 6개**

- `fontFamily` — S4 Skia 인라인 미도달
- `fontStretch` — S3 wrap leg 미도달
- `fontStyle` — S3 wrap leg · S4 Skia 인라인 미도달
- `fontVariant` — S3 wrap leg 미도달
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

## 5. Phase 1 반영 후 (2026-09-05)

`letterSpacing` 행이 S2 폭 · S3 wrap · S4 Skia 인라인 **전부 ✅** 로 바뀌었고 결손 목록에서
빠졌다 (7 → 6). 남은 `❌` 는 S4 Skia **상속** 한 칸이며 이는 R7 이 명시한 알려진 미지원
(Phase 5 입력) 이다.

생성기 자체도 이때 두 번 고쳤다 — 둘 다 **결선하는 순간 드러난** 검출기의 사각이다:

1. **주석 유출** — `skiaHasComputedStyle` 이 grep 이라, 새로 쓴 주석
   ("scene build 는 `ComputedStyle` 을 쥔 적이 없다") 을 도달 근거로 세어 S4 상속 열이 전 행
   ✅ 로 뒤집혔다. 주석을 지운 소스만 보도록 고쳤다.
2. **seam 무인지** — 검출기가 `style?.X` / `style.X` 같은 **속성별 배선**만 찾았기 때문에,
   같은 해소를 `resolveTextRenderStyle` 로 옮기자 폭 leg·Skia 가 동시에 ❌ 가 됐다.
   seam 호출을 도달로 인정하도록 고쳤다 (인자 2개면 상속 채널까지, 1개면 인라인만).

두 번째는 게이트 설계의 교훈이다 — **"어떻게 배선했는가" 로 도달을 재면 배선 방식이 바뀔 때
가짜 결손이 난다.** Phase 2 의 도달 검사는 이 사각을 피해 `TextMeasureStyle`·`child.text` 에
값이 실리는지를 본다.

## 6. Phase 2 — 대칭 게이트 (G4, 2026-09-05)

두 축을 같이 본다.

| 축          | 어디에                                                        | 무엇을                                                   |
| ----------- | ------------------------------------------------------------- | -------------------------------------------------------- |
| ① 집합 대조 | `scripts/codex/text-axis-matrix-gate.sh` (= 생성기 `--check`) | 격차표가 코드와 어긋나면 RED                             |
| ② 도달 검사 | `canvas/utils/__tests__/textAxisGate.static.test.ts`          | seam 축의 값이 두 소비자에 **실제로 실리는지** (값 수준) |

②는 배선 방식이 아니라 **값**을 본다 — wrap leg 은 기록용 measurer 를 끼워
`TextMeasureStyle[axis]` 를 확인하고, Skia 는 `buildSpecNodeData` 결과의
`child.text[field]` 를 확인한다. §5 의 두 번째 교훈("어떻게 배선했는가로 도달을 재면
배선을 바꿀 때 가짜 결손이 난다")을 피하는 형태다.

**forcing function**: `AXIS_REACH_CASES` 의 키 집합이 seam 축 집합과 같아야 한다. seam 에
축을 늘리면서 케이스를 안 쓰면 그 테스트가 먼저 RED 다.

### 원복 RED 매트릭스

| 원복한 것                                      | RED 가 된 테스트                        | 결과              |
| ---------------------------------------------- | --------------------------------------- | ----------------- |
| Skia ADR-057 블록의 letterSpacing 행 제거      | ② Skia 텍스트 노드가 인라인 값을 받는다 | 1 failed / 3 pass |
| `measureWrappedTextHeight` 의 운반 필드 제거   | ② layout wrap leg 이 값을 받는다        | 1 failed / 3 pass |
| seam `TextRenderStyle` 에서 letterSpacing 제거 | ① 격차표 drift · ② 도달 케이스 집합     | 2 failed / 2 pass |

세 지점이 **각각 다른 테스트**로 잡힌다 — 한 테스트가 셋을 뭉뚱그리지 않는다.

### 실행 지점

`codex:preflight` (커밋 전) · `.githooks/pre-push` (push 직전 — 이 저장소에는 PR status
check 가 없다) · `.github/workflows/deploy.yml` 의 `push:main` job. 셋 다 브라우저가 필요
없는 초 단위 검사다.

## 7. Phase 1 게이트 실측 (G2 · G3, 2026-09-05)

### G2 — 성능 (불리 케이스 포함)

기존 600 요소 문서에는 `ls ≠ 0` 이 0건이라 baseline 만으로는 새 경로가 실행되지 않는다.
그래서 **같은 텍스트·같은 파이프라인**을 두 arm 으로 잰다
(`canvas/skia/textAxisLetterSpacing.bench.ts`).

| arm                              |  mean (ms) | p75    | p99    | hz      |
| -------------------------------- | ---------: | ------ | ------ | ------- |
| 대조군 — ls 0                    | **0.0076** | 0.0071 | 0.0112 | 131,086 |
| 불리 arm — ls 0.5 (fontKey 분기) | **0.0096** | 0.0086 | 0.0220 | 103,639 |

텍스트 1건당 **+2.0 µs** (+26%). 최악(600 leaf 전부 ls≠0, 매 프레임 캐시 미스)을 가정해도
+1.2 ms 로 16.7 ms 예산의 7% 이며, 실제로는 세그먼트 캐시가 반복 측정을 흡수한다.

seam 자체의 호출 비용은 **48 ns**(인라인 적중) / **22 ns**(computed 폴백) 다 — R2 가 말한
"추가 조회가 아니라 읽기 한 번" 이 수치로 확인된다.

`pnpm perf:baseline --lane frame --seed-count 600` (600 요소 · 2 페이지, headless):

| 부류         |  gap p95 | 드롭% |
| ------------ | -------: | ----: |
| idle         |  17.5 ms |     0 |
| pan          |  18.7 ms |   0.6 |
| zoom         |  23.8 ms |   3.5 |
| select       | 322.3 ms |   100 |
| edit         | 478.2 ms |   9.2 |
| panel-resize |  17.7 ms |   1.1 |

select·edit 의 큰 값은 **본 변경 이전부터의 기존 병목**이다 (메모리
`project-builder-perf-baseline-2026-09-harness-and-levers` — 선택 240 ms / 편집 500 ms 대).
문서 텍스트에 `ls ≠ 0` 이 0건이라 이 lane 에서는 새 경로가 실행되지 않으며, 그래서 위 arm
벤치가 G2 의 불리 케이스를 담당한다.

### G3 — 시각 파리티 + 신규 fixture

`gate:visual-parity` smoke **98 PASS** (신규 케이스로 84 → 98, 바닥값 81 → 95).

신규 케이스 `text-letter-spacing` (`tests/visual-parity/cases/textLetterSpacing.ts`) —
같은 문자열·같은 폭의 두 문단이 자간만 다르다.

| region                               |     diffRatio | maxByte | 상자 높이    |
| ------------------------------------ | ------------: | ------: | ------------ |
| `letter-spacing-text` (ls 20)        | **0.0197** ✅ |     204 | 120 px (6줄) |
| `letter-spacing-control-text` (ls 0) |        0.0727 |     204 | 40 px (2줄)  |
| `letter-spacing-anchor`              |        0.0000 |       0 | 16 px        |

**자간이 걸린 문단이 대조군보다 파리티가 좋다** — 두 leg 이 같은 줄 수로 접힌다는 뜻이다.

원복 RED: Phase 1 을 전량 원복하면(seam · wrap leg · Skia 3곳) 같은 케이스가
**`L1:fail`** 로 떨어진다 — 두 leg 의 줄 수가 갈려 geometry 층에서 먼저 무너진다.
즉 이 fixture 는 **결선이 살아 있을 때만 통과**한다.

측정 중 두 가지를 기록해 둔다.

1. **자간 2px 로는 판정이 안 된다.** 이 문자열·폭에서 2px 는 줄 수를 바꾸지 않아(양쪽 2줄)
   diff 가 텍스트 래스터 기본 격차(대조군 0.0727)에 묻혔다. 그래서 fixture 는 20px 를 쓴다 —
   축이 잡음을 압도해야 게이트다.
2. **paint leg 만 원복하면 픽셀이 소수점 5자리까지 같다.** 즉 이 케이스에서 두 leg 을
   맞추는 것은 **layout leg** (줄 수)이고, Skia 텍스트 노드의 `letterSpacing` 이 픽셀에
   기여하는지는 이 fixture 로는 갈리지 않는다. 단위 테스트는 값이 노드에 실리는 것을
   확인하지만(도달 검사 G4 ②), **그 값이 glyph advance 로 쓰이는지**는 미확인이다 —
   Phase 3 live 와 후속 판정의 입력으로 남긴다.

케이스는 비동기 리소스 케이스보다 **앞**에 둔다 — 뒤에 두면 앞 케이스가 남긴 Preview
콘솔 에러(`<paragraph>` 미인식, 기존 known defect)를 이 케이스의 identity 판정이
물려받는다 (실측).

## 8. Phase 3 — 회귀 (G5) 와 남은 live (G1), 2026-09-05

### G5 — 회귀 0

| 스위트                 | 결과                                           |
| ---------------------- | ---------------------------------------------- |
| `@composition/builder` | **5,340 passed** / 0 failed (5 skip · 14 todo) |
| `@composition/shared`  | 972 passed / 0 failed                          |
| `@composition/specs`   | 880 passed / 0 failed                          |
| `canvas` 하위          | 1,625 passed / 0 failed                        |
| visual-parity smoke    | 98 PASS                                        |
| `pnpm type-check`      | PASS (baseline 0)                              |

### G1 — 미실행 (환경 차단)

Chrome 창이 `visibilityState: "hidden"` 이면 rAF 가 멈추고, 빌더 readiness 계약이
"실제 Skia surface flush 전에는 UI 를 노출하지 않는다" 이므로 로딩 오버레이에서 진행하지
않는다 (탭 2개로 재현, 재navigate·클릭으로도 해소되지 않음 — 메모리
`reference-chrome-mcp-hidden-tab-raf-pause-stale-overlay`). MCP 로는 OS 창을 앞으로 꺼낼 수
없다.

**Chrome 창이 보이는 상태에서 실행할 절차** (한 번에 끝나도록 고정):

1. 빌더 프로젝트를 연다 (`/builder/<projectId>`) — 오버레이가 사라질 때까지 대기.
2. 팔레트에서 Text 1개 추가 후 Styles 패널 Typography 에서
   `width 150px · fontFamily Arial · fontSize 16px · lineHeight 24px · letterSpacing 2px`,
   본문 `ab cd ef gh ij kl mn op`.
3. 판정 3축을 같은 상태에서 잰다:
   - `__composition_SKIA_DEBUG__.getSkiaNode(id).text.letterSpacing` === `2`
     (Phase 1 이전에는 **키 자체가 없었다** — §5 표)
   - 캔버스 줄바꿈이 `ab cd ef gh ij kl` / `mn op` (ls 2 결과) — 이전에는
     `ab cd ef gh ij kl mn` / `op` (ls 0 결과)
   - 같은 문자열·스타일의 Chrome DOM 오라클
     (`evidence/051-letterspacing-canvas2d.md` §1 스크립트) 과 일치
4. 부모 상속 케이스(부모에 `letter-spacing`, 자식 Text 미지정)는 **불일치가 예상 결과**다
   (R7) — 그 값을 실측해 Phase 5 착수 판정의 입력으로 기록한다.

이 절차가 끝나기 전에는 ADR-205 를 Implemented 로 올리지 않는다 (CLAUDE.md §완료 기준 ·
`adr-status-sync-check.sh` 가 `### Live Exercise` 부재를 block).
