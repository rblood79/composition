# ADR-923 Phase 5 후속 — 미import 생성 CSS 의 DOM 도달 (착수 9)

> 2026-09-04. 남은 항목 "generated CSS 생성기 skip (dead 생성물 93 vs import 66) — 정리 작업" 착수. **결론부터: 삭제 근거가 서지 않았다.** 27 개 중 3 개는 지우면 안 되는 미배선 결함이고, 22 개는 이 측정으로는 dead 라고 말할 수 없다.

## 1. 착수 시점 사실

`packages/shared/src/components/styles/generated/*.css` **93** 개 중 `styles/index.css` 가 import 하는 것은 **66** 개. 나머지 **27** 개는 번들에 실리지 않아 런타임 기여가 0 이다 (약 62KB).

## 2. "그러니 지워도 된다" 가 성립하지 않는 이유

미import 는 두 가지를 동시에 의미할 수 있고, 파일 목록으로는 갈리지 않는다:

| 갈래         | 뜻                                                   | 옳은 처방                   |
| ------------ | ---------------------------------------------------- | --------------------------- |
| 구조적 dead  | 그 클래스가 DOM 에 아예 없다 — import 해도 안 걸린다 | 생성 skip · 삭제            |
| 미배선 (gap) | 클래스는 DOM 에 붙는데 CSS 만 안 실려 있다           | **배선** — 지우면 채널 상실 |

선례가 이미 있다: TextArea 는 rule key ≠ RAC `source.component` 라 `.react-aria-TextArea` 가 컨테이너에 영영 미매칭이고 (`generate-css.ts` 의 binding 파생 게이트가 그 형태를 막는다), 그건 **구조적 dead** 다. 나머지 27 이 같은 성질인지는 별개 사실이다.

렌더러 코드 grep 으로는 안 갈린다 (메모리 `feedback-collection-subpart-not-all-homomorphic-dom-class` · `feedback-grep-zero-refs-is-not-dead-code`). 그래서 **live 로 셌다**.

## 3. 측정 — 팔레트 전수 production preview 마운트

`apps/builder/tests/parity/adr923GeneratedCssReach.browser.test.ts` (신규 4 케이스). 팔레트 전수 production 트리 (`allPaletteCreationTrees`) 를 preview 실경로 (`rendererMap`, `mountProductionRoot`) 로 마운트하고, 27 이름 각각의 `.react-aria-{name}` 출현 수와 번들 CSS 안의 담당 규칙 수를 센다. 실 번들 (`index.css?inline`) + Preview 전역 reset 을 같이 싣는다.

artifact: `apps/builder/tests/parity/.artifacts/adr923-generated-css-reach.json`.

### 결과

| 분류           | 수  | 이름                                                                                                                                                                                                                                                                                               |
| -------------- | --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `covered`      | 2   | **FieldError** (dom 0 · 번들 규칙 61 — base.css + parent delegation) · **Input** (dom 7 · 번들 규칙 56)                                                                                                                                                                                            |
| `gap` (미배선) | 0   | **없음** — 착수 11 (2026-09-06) 정정. 아래 §7 참조                                                                                                                                                                                                                                                 |
| `unobserved`   | 22  | Avatar · AvatarGroup · Body · ButtonGroup · CalendarHeader · CardView · DialogFooter · DisclosureHeader · FileTrigger · FormField · IllustratedMessage · Image · MeterTrack · MeterValue · Nav · ProgressBarTrack · ProgressBarValue · ProgressCircle · Section · StatusLight · TailSwatch · Toast |

`rendererMap` 항목이 없어 이 경로로 마운트되지 않은 팔레트 type: `Text` · `InlineAlert` · `frame` · `Section`.

### `unobserved` 는 dead 가 아니다

이 sweep 이 보는 것은 **팔레트 기본 상태**뿐이다. 상태 의존 자식 (FieldError 는 invalid 일 때만 — 그래서 dom 0 인데 covered), 팔레트 밖 표면 (Toast · overlay), 팔레트 미등재 type 이 전부 dom 0 으로 떨어진다. 그래서 게이트는 이 갈래를 `dead` 가 아니라 **`unobserved`** 로 부른다 — "이 측정으로는 못 봤다" 는 기록이지 삭제 근거가 아니다.

## 4. 판정

- **삭제·생성 skip 은 하지 않았다.** 27 중 3 은 지우면 안 되고 (미배선), 22 는 dead 임을 이 측정이 증명하지 못한다. 파일 수 (93 vs 66) 는 정리 신호이지 정리 근거가 아니었다.
- 대신 **분류를 게이트로 고정**했다: 새 미import 생성물이 생기면 `covered` / `gap` / `unobserved` 중 하나로 답해야 통과하고, `unobserved` 로 둔 이름이 나중에 DOM 에 나타나면 RED 로 승격을 요구한다.

## 5. 발견 — 미배선 3건 (별도 판단) — **철회 (2026-09-06, §7)**

> 아래 절은 착수 9 시점의 판정이며 **착수 11 에서 철회**됐다. 원인은 sweep 오라클이
> 로드 채널 하나만 봤기 때문이고, 세 건 모두 실제로는 담당 CSS 가 로드된다. 기록은
> 판정 이력으로 남긴다 — 결론은 §7 이 정본.

`Breadcrumb` · `DropZone` · `Skeleton` 은 production DOM 에 `.react-aria-{name}` 을 달고 나오는데 그 클래스를 담당하는 CSS 가 번들에 하나도 없다. 즉 catalog D3 값이 DOM 에 도달할 채널이 끊겨 있다 (Canvas 는 catalog 를 읽으므로 두 consumer 가 갈린다). `Skeleton` 은 수동 `Skeleton.css` 가 있으나 그 파일의 선택자가 이 클래스를 담당하지 않는다.

배선 (import 추가) 은 각각 **시각 변화를 만드는** 변경이라 이 커밋에 넣지 않았다 — 대칭 실측 후 별도 판단.

## 6. 검증

- 신규 게이트 4 PASS · browser parity **1090** PASS (기존 2 실패: `catalogComponentBox` GridListItem · Tooltip)
- `pnpm type-check` PASS

## 7. 착수 11 — 분류 정정 (2026-09-06, 사용자 판단 "sweep 방법론 검증 후 분류 정정")

착수 9 의 `gap` 3 건을 배선하려고 열었는데, 코드 대조에서 **전제가 성립하지 않았다.** 셋 다
담당 CSS 가 실제로 로드된다 — 다만 sweep 이 보지 않던 채널로.

### 7-1. 오라클 결함 (경로:라인)

| 사실                                                | 위치                                                                   | 확인                                             |
| --------------------------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------ |
| "imported" 집합을 `index.css` 문자열에서만 뽑았다   | `adr923GeneratedCssReach.browser.test.ts` `unimportedGeneratedNames()` | `indexCssSource.matchAll(/generated\/…/)` 하나뿐 |
| 담당 규칙 수를 `index.css?inline` 문자열에서만 셌다 | 같은 파일 `bundleRules`                                                | `bundleCss.matchAll(/\.react-aria-X\b/)`         |

로드 채널은 둘이다 — `index.css` 의 `@import`, **그리고 컴포넌트·binding 모듈의 import**. 뒤의
채널은 하루 앞선 게이트 `generatedCssLoadInventory.static.test.ts` 머리말이 이미 유효 채널로
명시하고 있었고, 그 게이트는 같은 세 이름을 `gap` 이 아니라 covered/미등재로 판정한다. 두
ADR-923 산출물이 어긋나 있었다.

### 7-2. 세 건의 실제 로드 경로

| 이름       | 담당 CSS                                                                       | 진입                                                                                                   |
| ---------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| Breadcrumb | 수동 `styles/Breadcrumbs.css` — `.react-aria-Breadcrumb` (singular) 규칙 **7** | `Breadcrumbs.tsx:11`                                                                                   |
| Skeleton   | 수동 `styles/Skeleton.css:65` — `.react-aria-Skeleton { display: block; … }`   | `Skeleton.tsx:29`                                                                                      |
| DropZone   | `styles/generated/DropZone.css` **직접**                                       | `DropZone.tsx:11` (렌더러는 `FormRenderers.tsx:21` 이 `../components/list` 에서 이 래퍼를 가져다 쓴다) |

`generated/Breadcrumbs.css` (복수) 는 index.css 가 싣지만 `.react-aria-Breadcrumbs` 만 담당한다 —
singular 는 수동 파일 몫이다. 정규식 `\.react-aria-Breadcrumb\b` 는 복수형에 매칭되지 않으므로
옛 오라클은 이 7 규칙을 통째로 못 봤다.

### 7-3. 수리 — 오라클을 "실제 로드된 규칙" 으로

`bundleRules` → `loadedRules`. 마운트 후 `document.styleSheets` 를 순회해 최상위 규칙의
`cssText` 를 모은다 (그 텍스트가 `@layer`·`@media`·CSS nesting 중첩을 이미 품는다).

**중간에 드러난 함정 하나**: 처음엔 "`cssRules` 가 있으면 그룹이니 재귀하고 자신은 건너뛴다" 로
썼는데, CSS Nesting 이후 평범한 `CSSStyleRule` 도 (빈) `cssRules` 를 갖는다. 그래서 거의 모든
규칙이 그룹으로 오인돼 본문이 버려졌다 — 수집 길이 15,245 (index.css 만 456,841). 최상위
`cssText` 만 모으는 방식으로 고치니 725,240.

### 7-4. 결과와 원복 RED

- `Breadcrumb` · `DropZone` · `Skeleton` → **`covered`**. `gap` 범주는 유지하되 현재 0 건.
- 원복 RED: `loadedCss` 를 옛 `bundleCss` 로 되돌리면 `Breadcrumb 로드된 담당 규칙 수: expected 0 to be greater than 0` FAIL.
- 수리 전 새 오라클 + 옛 분류로 돌렸을 때도 RED (`expected 7 to be +0`) — 방법론 결함을 양방향으로 실증.

### 7-5. 배선하지 않은 이유

정정으로 끝이고 `@import` 추가는 하지 않는다. 셋 다 이미 도달하므로 배선은 채널 복구가 아니라
**중복 주입**이고, Skeleton 은 값까지 충돌한다 (수동 `--skeleton-bg` vs 생성 `--bg-inset`, 생성본은
`height: 20px` 과 `inline-flex` base 를 더한다). `generatedCssLoadInventory.static.test.ts` 는
목록의 파일이 로드되면 FAIL 하도록 설계돼 있어, 배선은 그 게이트도 설계상 깨뜨린다.

### 7-6. 검증

- reach 게이트 4 PASS (수리 후) · 정적 인벤토리 게이트 4 PASS (두 산출물 정합)
- browser parity **1110 PASS** / 2 실패 = 착수 9 와 동일한 기존 실패 (`catalogComponentBox` GridListItem · Tooltip)
- `pnpm type-check` PASS
- 제품 코드 변경 **0** — 시각 변화 없음
