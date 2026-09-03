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
| `gap` (미배선) | 3   | **Breadcrumb** (dom 3) · **DropZone** (dom 1) · **Skeleton** (dom 1) — 셋 다 번들 담당 규칙 **0**                                                                                                                                                                                                  |
| `unobserved`   | 22  | Avatar · AvatarGroup · Body · ButtonGroup · CalendarHeader · CardView · DialogFooter · DisclosureHeader · FileTrigger · FormField · IllustratedMessage · Image · MeterTrack · MeterValue · Nav · ProgressBarTrack · ProgressBarValue · ProgressCircle · Section · StatusLight · TailSwatch · Toast |

`rendererMap` 항목이 없어 이 경로로 마운트되지 않은 팔레트 type: `Text` · `InlineAlert` · `frame` · `Section`.

### `unobserved` 는 dead 가 아니다

이 sweep 이 보는 것은 **팔레트 기본 상태**뿐이다. 상태 의존 자식 (FieldError 는 invalid 일 때만 — 그래서 dom 0 인데 covered), 팔레트 밖 표면 (Toast · overlay), 팔레트 미등재 type 이 전부 dom 0 으로 떨어진다. 그래서 게이트는 이 갈래를 `dead` 가 아니라 **`unobserved`** 로 부른다 — "이 측정으로는 못 봤다" 는 기록이지 삭제 근거가 아니다.

## 4. 판정

- **삭제·생성 skip 은 하지 않았다.** 27 중 3 은 지우면 안 되고 (미배선), 22 는 dead 임을 이 측정이 증명하지 못한다. 파일 수 (93 vs 66) 는 정리 신호이지 정리 근거가 아니었다.
- 대신 **분류를 게이트로 고정**했다: 새 미import 생성물이 생기면 `covered` / `gap` / `unobserved` 중 하나로 답해야 통과하고, `unobserved` 로 둔 이름이 나중에 DOM 에 나타나면 RED 로 승격을 요구한다.

## 5. 발견 — 미배선 3건 (별도 판단)

`Breadcrumb` · `DropZone` · `Skeleton` 은 production DOM 에 `.react-aria-{name}` 을 달고 나오는데 그 클래스를 담당하는 CSS 가 번들에 하나도 없다. 즉 catalog D3 값이 DOM 에 도달할 채널이 끊겨 있다 (Canvas 는 catalog 를 읽으므로 두 consumer 가 갈린다). `Skeleton` 은 수동 `Skeleton.css` 가 있으나 그 파일의 선택자가 이 클래스를 담당하지 않는다.

배선 (import 추가) 은 각각 **시각 변화를 만드는** 변경이라 이 커밋에 넣지 않았다 — 대칭 실측 후 별도 판단.

## 6. 검증

- 신규 게이트 4 PASS · browser parity **1090** PASS (기존 2 실패: `catalogComponentBox` GridListItem · Tooltip)
- `pnpm type-check` PASS
