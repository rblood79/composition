# ADR-205: 텍스트 시각 축 computed 단일 seam — letterSpacing 결선

## Status

Proposed — 2026-09-05

## Context

Styles 패널이 노출하는 `letter-spacing` 이 **Preview 에만 반영되고 Canvas(Skia) 에는 도달하지
않는다**. 2026-09-05 live 실측 — 인라인 `letterSpacing: "2px"` 인 Text 의 Skia scene node
`text` 객체에는 그 키 자체가 없고 (`fontSize`·`lineHeight`·`fontFamilies` 는 도달), 줄바꿈이
Chrome 의 `letter-spacing: 0` 결과와 일치했다
([evidence](evidence/051-letterspacing-canvas2d.md) §5).

이것은 D3(시각 스타일)의 **symmetric consumer 위반**이다 — 같은 SSOT 에서 Builder 와
Preview 가 같은 시각 결과를 내야 하는데, 두 소비자가 서로 다른 입력을 읽는다.

- **DOM/Preview**: renderer root 에 `style={element.props.style}` 를 그대로 실어
  브라우저 cascade 가 상속·초기값을 처리한다 (ADR-907 Layer C, 62곳).
- **Skia**: cascade 가 없다. 속성마다 사람이 경로를 써야 한다.
  `letterSpacing` 은 `shape.letterSpacing` 에서만 오고 (`specShapeConverter.ts:891`)
  catalog·잔존 spec 에 그 정의가 **0건**이라 production 에서 항상 undefined 다.
- **레이아웃 측정**도 같다 — 유일 유입이 spec text shape 에서 온
  `inlineSpecStyle?.letterSpacing` (`utils.ts:2101`) 이다.

문제의 본질은 letterSpacing 하나가 아니라 **입력 해소 지점이 없다는 것**이다.
`cssResolver` 는 이미 텍스트 CSS 17종을 상속 속성으로 선언하고 `resolveStyle()` 이
inline + cascade 키워드 + 상속을 해소한 `ComputedStyle` 을 만든다 (`letterSpacing: number`
포함). 텍스트 측정 함수 `enrichWithIntrinsicSize` 는 그 `_computedStyle` 을 **이미 인자로
받고 있다**. 그런데 거기서 computed 를 읽는 텍스트 속성은 `whiteSpace` **하나뿐**이다
(`resolveTextLeafWhiteSpace`, `utils.ts:5026`). 나머지는 호출 지점마다
`parseNumericValue(style?.fontSize) ?? spec ?? default` 로 각자 조립한다 — fontSize 만
`utils.ts` 안에 **21곳**이다. 인프라는 있고 소비 경로가 없다.

그 결과 두 가지가 따라온다. (1) 새 텍스트 시각 속성은 매번 N개 지점을 손으로 배선해야 하고,
빠뜨리면 "Preview 에만 반영" 이 조용히 생긴다 — 그것을 잡는 게이트가 없다. (2) 지점마다
자기 규칙이라 CSS **상속**이 반영되지 않는다 (부모에 건 letter-spacing 이 자식 텍스트에
안 먹는다).

측정기 자체는 준비돼 있다 — 2026-09-05 `8b6c1bd22` 가 Canvas 2D 측정에 letterSpacing 을
CSS 규칙(`base + grapheme 수 × spacing`, 마지막 글자 뒤 간격 포함)대로 반영했다. 결선만 없다.

**Generator 지원 선언**: 본 ADR 은 spec/catalog schema 를 확장하지 않으므로 CSSGenerator 의
자식 selector/variant emit 지원 여부에 의존하지 않는다. Generator 는 이미
`size.letterSpacing` 을 `letter-spacing` 으로 emit 하고 있고
(`packages/specs/src/renderers/CSSGenerator.ts:969-971`), 그 채널은 본 ADR 이 다루는
**인라인 style 채널과 별개**다 — 둘의 우선순위만 R6 에서 고정한다.

**영향 범위 수식화 (BC)**: 인라인 `style.letterSpacing` 은 factory 기본값 **0건**
(`grep -rn letterSpacing apps/builder/src/builder/factories/` → 0), pencil/import 어댑터
**0건**, theme/tokens **0건** 이다. 즉 값이 생기는 유일한 경로는 사용자가 Styles 패널
Typography 에서 직접 설정하는 것뿐이며(`TypographySection.tsx:277-280`), **그 요소만**
캔버스 시각이 바뀐다. 미설정 문서는 변화 0.

**Hard Constraints**:

1. D3 대칭 — Builder(Skia) 와 Preview(DOM/CSS) 가 같은 시각 결과를 낸다
   (`.claude/rules/ssot-hierarchy.md` §1). 판정은 Chrome DOM 오라클 대조.
2. 성능 — 텍스트 측정은 layout enrich 호출마다 도는 경로이고 결과 캐시가 없다.
   `pnpm perf:baseline --lane frame` 600 요소 p95 와 `textMeasure.bench` µs 가 회귀 0.
3. 결정성 — visual-parity G2 의 10회 연속 RGBA 해시 동일 + `maxByte 0` 유지.
4. 하위 호환 — 기존 텍스트 측정 호출 지점(fontSize 21곳 포함)의 동작을 바꾸지 않는다.
   회귀 0 을 유지한 채 수렴은 후속 phase 로 미룬다.
5. D2 — RSP 미규정 custom prop 을 신설하지 않는다. 입력은 표준 CSS 속성뿐.

**Soft Constraints**:

- ADR-051(Canvas 2D 측정)·ADR-165(intrinsic 스칼라 계약) 의 기존 계약과 공존해야 한다.
- 진행 중인 ADR-923 dirty 변경을 건드리지 않는다.
- `wordSpacing` 은 `ctx.measureText` 미반영이라 이번 범위 밖 (ADR-051 §B4-7 판정 유지).

## Alternatives Considered

### 대안 A: fontSize 패턴 복제 — 호출 지점마다 letterSpacing 추가

- 설명: `parseNumericValue(style?.fontSize)` 패턴 그대로 각 측정 호출과 shape 변환에
  `style?.letterSpacing` 을 더한다. 새 추상화 없음.
- 근거: 저장소 안의 지배적 기존 패턴이고, fontSize·lineHeight 는 이 방식으로 동작 중이다.
  외부 대조 — Figma·Penpot 같은 캔버스 편집기도 초기에는 속성별 배선으로 시작한다.
- 위험:
  - 기술: **L** — 새 구조가 없어 실패 모드가 좁다.
  - 성능: **L** — 지점당 필드 하나.
  - 유지보수: **H** — 축마다 N개 지점을 손으로 유지해야 하고 누락을 잡는 게이트가 없다.
    grep 가능한 경로: ① `layout/engines/utils.ts` 의 `parseNumericValue(style?.fontSize)`
    **21곳** (`grep -c`), ② `layout/engines/utils.ts:2101` `inlineSpecStyle?.letterSpacing`
    — spec shape 에서만 오는 유일 유입, ③ `skia/specShapeConverter.ts:891`
    `letterSpacing: shape.letterSpacing` — 인라인을 읽는 경로 없음, ④
    `skia/nodeRendererText.ts:463 · 532 · 648` 세 지점이 같은 `node.text.letterSpacing`
    을 각각 재조립. CSS **상속**도 반영되지 않아 부모의 letter-spacing 이 자식에 안 먹는
    두 번째 결함이 남는다 — 같은 병인이 이미 두 번 재현됐다 (letterSpacing 정의 0건 ·
    whiteSpace 는 ADR-923 r12h1 에서야 `utils.ts:5026` 의 computed 소비로 정정).
  - 마이그레이션: **L** — 기존 코드 변경 없음.

### 대안 B: computed 단일 seam + 두 소비자 결선 + 대칭 게이트

- 설명: `resolveTextRenderStyle(style, computed)` 하나를 두고, 레이아웃 텍스트 측정과
  Skia 텍스트 노드가 **그 seam 만** 읽는다. 규칙은 이미 있는 선례
  `resolveTextLeafWhiteSpace(style, _computedStyle)` 와 같다 — inline 우선, 없으면
  computed, cascade 키워드는 computed 해석값. 여기에 "DOM 이 소비하는 텍스트 CSS 속성
  집합 ↔ seam 필드 집합" 대조 게이트를 붙인다. letterSpacing 이 첫 소비자.
- 근거: 인프라가 이미 있다 — `cssResolver` 가 텍스트 17종을 상속 속성으로 계산하고
  (`ComputedStyle.letterSpacing: number`), 측정 함수가 그 값을 이미 인자로 받는다.
  없는 것은 소비뿐이다 (메모리 `feedback-infra-exists-vs-wired-consumption-path`).
  외부 대조 — 브라우저 엔진(Blink/Gecko)은 shaping 직전 하나의 computed style 을 읽고,
  fulgur 도 Stylo computed 를 단일 입력으로 Parley 에 넘긴다
  (`EXTERNAL_PATTERN_DELTA_2026-09` §A1). 속성별 배선은 캐스케이드가 없는 캔버스 쪽의
  임시 형태이지 목표 형태가 아니다.
- 위험:
  - 기술: **M** — seam 이 텍스트 측정 경로를 관통하므로 회귀 표면이 넓다. 완화: Phase 1
    을 letterSpacing 한 축으로 제한하고 fontSize 21곳은 건드리지 않는다 (Hard 4).
  - 성능: **M** — 측정 호출마다 computed 조회가 는다. 완화: `_computedStyle` 은 이미
    같은 호출에 전달돼 있어 추가 조회가 아니라 **읽기 한 번**이다. Hard 2 로 계측.
  - 유지보수: **L** — 축이 하나로 모이고, 누락은 게이트가 커밋 시점에 잡는다.
  - 마이그레이션: **M** — fontSize 수렴(Phase 4)은 조건부·후속. 그 전까지 seam 과
    기존 패턴이 공존한다 (두 규칙이 한동안 같이 산다).

### 대안 C: catalog 에 letterSpacing 축을 추가하고 spec/catalog 경유로만 지원

- 설명: `COMPONENT_RULES_TABLE` 의 size 축에 `letterSpacing` 을 넣어 shape 로 흐르게 한다.
  인라인 `style.letterSpacing` 은 계속 미지원.
- 근거: D3 SSOT 가 catalog 라는 ADR-142 정의에 가장 곧게 맞고, 기존 `shape.letterSpacing`
  소비 경로(F10·F11)를 그대로 쓴다. CSSGenerator 도 이미 `size.letterSpacing` 을 emit 한다.
- 위험:
  - 기술: **L** — 기존 경로 재사용.
  - 성능: **L** — 변화 없음.
  - 유지보수: **M** — catalog 축이 하나 늘지만 인라인 경로의 결손은 그대로라 두 채널이
    영구 공존한다.
  - 마이그레이션: **L**.

### Risk Threshold Check

| 대안 | 기술 | 성능 | 유지보수 | 마이그레이션 | HIGH+ 개수 |
| ---- | :--: | :--: | :------: | :----------: | :--------: |
| A    |  L   |  L   |  **H**   |      L       |     1      |
| B    |  M   |  M   |    L     |      M       |     0      |
| C    |  L   |  L   |    M     |      L       |     0      |

루프 판정: HIGH 0 인 대안이 둘(B·C) 있으므로 새 대안 추가 없이 진행한다. C 는 위험이
낮지만 **문제를 풀지 않는다** (아래 기각 사유).

## Decision

**대안 B: computed 단일 seam + 두 소비자 결선 + 대칭 게이트**를 선택한다.

선택 근거:

1. 잔존 위험이 전부 M 이고, 둘 다 완화 수단이 코드 사실로 확인된다 — 기술 M 은 Phase 1
   범위를 letterSpacing 한 축으로 묶어 좁히고, 성능 M 은 `_computedStyle` 이 이미 같은
   호출에 전달돼 있어(F5) 추가 조회가 아니라 읽기 한 번이다.
2. 이 결정만이 **재발을 막는다**. A·C 는 letterSpacing 을 고쳐도 다음 텍스트 속성에서
   같은 누락이 다시 생기고, 그것을 잡는 수단이 없다. B 의 게이트는 누락을 커밋 시점으로
   앞당긴다 (ADR-051 의 letterSpacing 분기가 5개월간 dead 였던 것을 아무도 몰랐다).
3. CSS **상속**이 자동으로 맞는다 — computed 를 읽으므로 부모에 건 letter-spacing 이
   자식 텍스트에 반영된다. A 로는 지점마다 상속 규칙을 다시 써야 한다.

**Phase 분리 질문** (HIGH 누적 착시 방지): 채택안은 HIGH 0 이라 threshold 초과가 아니다.
그럼에도 가장 무거운 Phase 4 (fontSize 21곳 수렴) 는 **본 ADR 에서 분리 가능한가**를
먼저 물었고, 답은 "분리 대신 조건부" 다 — seam 이 한 phase 를 버틴 뒤 별도 판정으로
착수하며, 착수 시점에 그 규모가 별도 ADR 을 요구하면 그때 fork 한다. Phase 1~3 만으로
G1 (사용자-가시 결함 해소) 이 닫히므로 Phase 4 는 본 ADR 의 종결 조건이 아니다.

기각 사유:

- **대안 A 기각**: 유지보수 HIGH. 축마다 N 지점 수작업 + 누락 게이트 부재 + 상속 미반영이
  현재 결함의 **원인**이다. 같은 형태를 늘리는 것은 증상 수정이다.
- **대안 C 기각**: 위험은 낮지만 요구를 충족하지 못한다. Styles 패널이 노출하는 값은
  인라인 `style.letterSpacing` 이므로(D2 상 표준 CSS 속성), catalog 축만 추가하면
  사용자가 패널에서 조정한 값은 여전히 Preview 에만 반영된다. 문제 정의를 바꾸는 대안이다.

> 구현 상세: [205-text-visual-axis-computed-seam-breakdown.md](design/205-text-visual-axis-computed-seam-breakdown.md)

## Risks

| ID  | 위험                                                                                                   | 심각도 | 대응                                                                                                                                                                                                                                             |
| --- | ------------------------------------------------------------------------------------------------------ | :----: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| R1  | seam 도입이 텍스트 측정 폭을 미세하게 바꿔 기존 줄바꿈·fit-content 가 흔들린다                         |  MED   | Phase 1 을 letterSpacing 한 축으로 제한 (다른 축은 seam 을 지나되 값이 종전과 동일). G3 결정성 + visual-parity 로 판정                                                                                                                           |
| R2  | 측정 호출당 computed 읽기가 늘어 편집·리사이즈 pass 비용 증가                                          |  MED   | `_computedStyle` 은 이미 전달돼 있어 추가 조회 아님 (F5). G2 로 계측 — perf:baseline frame lane p95 + textMeasure.bench                                                                                                                          |
| R3  | seam 과 기존 `parseNumericValue(style?.fontSize)` 패턴(21곳)이 한동안 공존해 두 규칙이 갈린다          |  MED   | 격차표(Phase 0)가 어느 속성이 어느 규칙을 타는지 명시. Phase 4 수렴은 조건부 — seam 이 한 phase 를 버틴 뒤 별도 판정                                                                                                                             |
| R4  | 게이트의 속성 집합이 손 목록이면 그 자체가 드리프트한다                                                |  MED   | 집합의 출처를 `cssResolver` 텍스트 속성 목록(F1)으로 고정. 손 목록 신설 금지                                                                                                                                                                     |
| R5  | 인라인 letterSpacing 이 Skia 에 도달하기 시작하면 **기존 문서의 시각이 바뀐다** (지금까지 무시되던 값) |  MED   | 영향 범위는 사용자가 Styles 패널에서 직접 설정한 요소뿐 — factory 기본값·import 어댑터·theme 모두 0건 (Context §영향 범위). 미설정 문서는 변화 0. 의도된 변경이므로 CHANGELOG 사용자-가시 항목으로 고지하고 Phase 3 live 로 Chrome 일치를 남긴다 |
| R6  | Skia 텍스트 노드가 seam 을 읽으면 `shape.letterSpacing`(catalog 채널)과 우선순위 충돌이 생긴다         |  LOW   | 우선순위를 CSS 와 같게 고정 — 인라인 > catalog/spec. 정적 테스트로 순서 고정                                                                                                                                                                     |

## Gates

| Gate | 시점         | 통과 조건                                                                                                                                                 | 실패 시 대안                                                                |
| ---- | ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| G0   | Phase 0 종료 | 텍스트 CSS 17종 × {DOM 소비 · layout 도달 · Skia 도달} 격차표가 **코드에서 생성**되고, F1~F17 이 그 표와 모순 없음                                        | 격차가 letterSpacing 1건이 아니면 Phase 1 범위를 사용자 판정으로 재확정     |
| G1   | Phase 1 종료 | 인라인 `letter-spacing: 2px` Text 의 Skia 줄바꿈 == Chrome DOM 오라클 (`evidence/051-letterspacing-canvas2d.md` §1 스크립트). ls 0 도 종전 동일           | seam 우선순위(R6) 재검토 후 재측정. 2회 실패 시 Phase 1 원복 + 사용자 보고  |
| G2   | Phase 1 종료 | `pnpm perf:baseline --lane frame` 600 요소 p95 회귀 0 · `textMeasure.bench` 파이프라인 µs 회귀 0 (유리한 경우만 측정 금지 — 600 요소 + 선택 fan-out 상태) | seam 을 텍스트 leaf 경로로만 좁히거나 prepared 캐시 도입을 별도 판정        |
| G3   | Phase 1 종료 | visual-parity smoke PASS + G2 10회 연속 RGBA 해시 동일 · `maxByte 0`                                                                                      | 발산 region 을 특정해 우선순위·상속 규칙 중 어느 쪽인지 판정                |
| G4   | Phase 2 종료 | 텍스트 속성을 seam 에서 하나 빼면 정적 테스트 RED (원복 확인). pre-push 훅과 `push:main` 워크플로에서 실행                                                | 게이트를 `codex:preflight` 로 옮겨 커밋 시점 검사로 강등                    |
| G5   | Phase 3 종료 | 관련 스위트 회귀 0 (`canvas` 1609+ · parity baseline 동일) + CHANGELOG·evidence 반영                                                                      | 회귀 원인이 seam 이면 Phase 1 원복, 기존 결함이면 baseline 대조로 분리 기록 |

## Consequences

### Positive

- Styles 패널의 `letter-spacing` 이 Canvas 와 Preview 에서 같은 결과를 낸다 — 지금은
  Preview 에만 반영된다.
- CSS 상속이 텍스트 축에 자동으로 반영된다 (`cssResolver` computed 를 읽으므로).
- 새 텍스트 시각 속성의 "한쪽에만 반영" 이 커밋 시점에 잡힌다 (G4). ADR-051 의
  letterSpacing 분기가 5개월간 dead 였던 종류의 사각이 닫힌다.
- ADR-051 `8b6c1bd22` 로 이미 갖춘 측정 능력이 실제로 쓰이기 시작한다.

### Negative

- `canvas/utils` 에 seam 파일 1개와 정적 게이트 1개가 늘어난다.
- Phase 4 전까지 텍스트 축이 두 규칙(seam · `parseNumericValue(style?.fontSize)` 21곳)으로
  갈려 있다 — 격차표를 읽어야 어느 쪽인지 안다 (R3).
- 지금까지 무시되던 인라인 letter-spacing 이 반영되므로 **그 값을 쓰던 기존 문서의 캔버스
  시각이 바뀐다** (R5). Preview 와 같아지는 방향이지만 변화는 변화다.
