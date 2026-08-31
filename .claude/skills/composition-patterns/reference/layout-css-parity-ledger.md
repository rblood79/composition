# Layout Engine — CSS 정합 실측 기록 (엔진 ↔ Chrome 대조, 2026-07-25 ~ 07-28)

> 정본 규칙: [.claude/rules/layout-engine.md](../../../rules/layout-engine.md) §"엔진 CSS 정합 규칙 색인" 의 각 행이 이 문서의 절 하나에 대응한다. 이 문서는 절별로 **규칙 · 거처(Rust/TS 심볼) · Chrome 실측 표 · fixture 민감도 · 금지 패턴** 전문을 담는다. `packages/composition-engine/**` 또는 `fullTreeLayout.ts` 의 배치 알고리즘을 바꾸기 전에 해당 절의 금지 패턴을 읽는다.
>
> 2026-08-31 `.claude/rules/layout-engine.md` 에서 원문 그대로 이관 — rule 이 path 매칭 시 116KB 전량 주입되던 것을 분리 (절 제목·본문 무변경). 새 실측 절은 여기에 추가하고 rule 색인에 한 줄만 등재한다.

## 목차

- 컨테이너의 used size 는 min/max clamp **뒤**의 값이다 — 네 축 모두 (2026-07-28)
- body 는 뷰포트가 아니다 — 상자는 뷰포트, 배치는 내용 (2026-07-28)
- 늘어날 available 이 없으면 기여는 **content** 다 — Container Align 교차축 (2026-07-28)
- shrink-to-fit 은 크기를 정한 **뒤** 한 번 더 돈다 (CSS-SIZING-3 §5.1, 2026-07-28)
- automatic minimum size (CSS-FLEXBOX-1 §4.5) — 엔진 소속 (ADR-164 Phase 1 / ADR-165 정밀화, 2026-07-25)
- 컨테이너 intrinsic — 측정 모드 센티넬 (ADR-169, 2026-07-27 / grid 축 2026-07-28)
- 증분 skip 의 키는 dirty **와 available** 둘이다 — 재부모화 (2026-07-28)
- 컨테이너의 `width: min/max/fit-content` 는 엔진이 **측정으로** 해소한다 (CSS-SIZING-3 §5, 2026-07-28)
- 그리드 자신의 min/max-content — 여유가 없을 때의 트랙 sizing (CSS-GRID-1 §12.5–§12.7.1, 2026-07-28)
- 그리드 컨테이너의 블록 크기는 **행 트랙 extent** 다 (CSS-GRID-1 §11.1, 2026-07-28)
- 교차축 라인 cross 는 컨테이너 cross **대입** (CSS-FLEXBOX §9.4 step 8, 2026-07-27)
- 넘칠 때의 정렬 — 위치 정렬은 음수 offset, 분배 정렬은 fallback (CSS-ALIGN-3 §4.2/§4.4, 2026-07-27)
- 백분율 크기 — 두 축의 "definite" 조건이 다르다 (2026-07-27)
- flex item 재-solve 는 **자기가 푼 available** 을 기준으로 한다 — `%` 의 세 번째 누수 경로 (2026-07-28)
- `margin: auto` 는 정렬보다 먼저 여유를 가져간다 — 흡수 단위는 **라인** (CSS-FLEXBOX-1 §8.1, 2026-07-27)
- `*-reverse` 는 위치만 뒤집는다 — margin 의 축 역할은 별도로 바꿔야 한다 (2026-07-27)
- 그리드 영역은 containing block 일 뿐 — 자식 크기를 강제하지 않는다 (2026-07-28)
- `auto` 트랙은 내용 크기가 **하한**일 뿐 — 남는 여유를 나눠 갖는다 (CSS-GRID-1 §12.8, 2026-07-28)
- `minmax()` 트랙은 상한까지 자란다 — 트랙 sizing 은 3단계다 (CSS-GRID-1 §12.6, 2026-07-28)
- 트랙 크기는 자식의 **content 기여**에서 나온다 (CSS-GRID-1 §12.5, 2026-07-28)
- 단독 `fr` 도 base 를 갖는다 — §12.7.1 freeze-restart (CSS-GRID-1 §7.2.4/§12.7.1, 2026-07-28)
- grid 자식의 TS 공급 3결함 — 스칼라 / 트랙 수 / 가정 폭 (2026-07-28)
- grid item 의 크기 키워드도 stretch 를 이긴다 (CSS-ALIGN-3 §4.1, 2026-07-28)

## 컨테이너의 used size 는 min/max clamp **뒤**의 값이다 — 네 축 모두 (2026-07-28)

컨테이너의 **used** size = (명시 크기 또는 내용 크기) 를 자기 `min-*`/`max-*` 로 clamp 한 값이고, 내부 배치 알고리즘은 **그 값**에 대해 돌아야 한다 (CSS-SIZING-3 §5.1, CSS-FLEXBOX-1 §9.4→§9.7, CSS-GRID-1 §11.1). 엔진은 clamp 를 **배치 뒤에만** 걸고 있었다 — root 는 `fixup_root_self_size`, flex item 은 `flex.rs` off 10·12, grid 트랙은 `track_contribution`, 인라인 축은 부모 intake (`block.rs::clamp_size`). 넷 다 "이미 배치된 결과의 상자"만 늘리고 줄이므로 안쪽 분배는 clamp 이전 값 기준으로 굳는다.

| 축         | 형태                                            | Chrome |   구 엔진 | 거처                           |
| ---------- | ----------------------------------------------- | -----: | --------: | ------------------------------ |
| flex main  | `column + minHeight:400` 안의 `flexGrow:1`      |    340 |     **0** | `solve_flex` **3.6**           |
| flex main  | `column + maxHeight:200` 안의 `height:100px` ×3 |   67씩 | **100씩** | 〃                             |
| flex cross | `row + minHeight:400` 안의 크기 미지정 자식     |    400 |     **0** | `solve_flex` **3.7**           |
| grid block | `minHeight:400` + `rows: 60px 1fr`              | 60/340 | **60/60** | `solve_grid` 재진입            |
| **인라인** | `width:120px + minWidth:200` 안의 자식          |    200 |   **120** | `solve_node` — dispatch **전** |
| 〃         | `width:auto + maxWidth:60` (block 부모) 의 자식 |     60 |   **300** | 〃                             |

- **flex** 는 `flex_layout` 을 clamp 된 값으로 한 번 더 돌린다. main 은 미결정이면 배치 extent, 확정이면 그 값이 기준이고, cross 는 `cross_definite` 를 **켜서** 다시 돈다 — §9.4 step 8 이 라인 cross 를 컨테이너 inner cross 로 잡아야 `stretch` 가 산다.
- **grid** 는 트랙 sizing 자체가 definite 여부에 매달려 있어(`1fr` 행 · `align-content` · §12.8 stretch 셋 다 `explicit_h > 0.0` 게이트) `solve_grid` 를 clamp 된 높이로 **재진입**한다. 두 번째 호출은 `explicit_h > 0.0` 이라 1회로 끝난다. 재진입 전 자식 subtree 를 `mark_subtree_dirty` — 1차 pass 가 자식을 clean 으로 만들어 그대로 부르면 증분 skip 이 stale 캐시를 돌려준다.
- 컨테이너 상자도 같은 값이어야 한다 — flex 는 `clamped_auto_main` 이 4) 의 bounding box 를 대신한다. 분배는 400 에 대해 돌리고 상자는 내용 60 으로 보고하면 부모가 그 60 을 다시 쓴다.
- **auto-main item 은 이 재분배로 찌그러지지 않는다** — §4.5 automatic minimum size 가 min-content floor 를 건다. ListBox 형태(`maxHeight:300` + auto 높이 행)는 clamp 후에도 행이 100 을 유지하고 넘쳐서 스크롤한다(실측 DOM·엔진 동형). 압축되는 것은 **주축 크기를 명시한** item 뿐이고 그게 CSS 결과다.
- **cross 축 재분배가 `height:%` 자식을 살리지는 않는다** — 해소 불가 백분율은 Chrome 도 0 이다(실측). `%` 해석은 `cross_ctx` 소관이고 여기서 바뀌는 것은 **cross 를 명시하지 않은** 자식의 stretch 대상 크기뿐이다.
- **인라인 축은 dispatch 전에 `solve_node` 가 clamp 한다** (ADR-170 군집 A). 명시 폭(키워드 해소값 포함)은 max→min 순으로 clamp 하고, **auto 폭은 조건부 definite 승격**이다 — 부모가 block(=stretch 문맥) + available 확정 + clamp 가 실제로 **바인딩**할 때만. 비바인딩이면 auto 로 두어 flex/grid item 문맥의 used 크기를 커널에 남긴다 (그쪽은 이미 자기 clamp 를 갖는다). shrink-to-fit 경로도 같은 값을 써야 해서 `shrink_to_fit_settled` 가 min/max 를 인자로 받는다.
- 블록 축의 명시 높이 clamp 도 여기서 돈다 — 자식 `%` base(`child_containing_h`) · grid definite 게이트 · flex main 이 **clamp 뒤 값**을 소비해야 하기 때문이고, flex 3.6 의 재-clamp 는 멱등이라 중복이 아니다.
- Chrome 실측 fixture: `bodyViewportBox.browser.test.ts` — 각 축을 무력화하면 flex main 2 red / flex cross 1 red / grid 1 red. 인라인 축은 `basicAxisContainerSize.browser.test.ts` (ADR-170 격자 1) — 되돌리면 ratchet 138키 재발산.

### aspect-ratio 는 이 clamp **뒤**에서 파생하고, content 를 하한으로 갖는다

`aspect-ratio` 의 축 전송은 **used size** 를 입력으로 한다 (CSS-SIZING-4 §5) — 그래서 파생이 clamp 뒤에 있어야 하고, clamp 로 정해진 폭도 stretch 로 정해진 폭도 똑같이 입력이 된다.

| 형태 (`ratio 2`, 내용 50)  | Chrome | 구 엔진 | 원인                      |
| -------------------------- | -----: | ------: | ------------------------- |
| `w:120px + maxW60`         |     50 |  **60** | clamp 전 폭으로 파생      |
| 양축 auto (block 부모 300) |    150 |  **50** | stretch 폭이 입력이 안 됨 |

- **w→h 전송은 §5.2.2 자동 최소의 대상**이다 — ratio 의존 축의 min-size = content (조건: `min-height` 미지정 + `overflow-y: visible`). 그래서 자식을 가진 상자는 전송값을 `explicit_h` 로 굳히지 않고 **dispatch 뒤 content 와 max** 한다 (`aspect_h_floor`). 굳히면 하한이 죽어 내용이 넘친다.
- 양축 auto 상자를 살리는 것은 위 auto 폭 승격의 두 번째 조건(`aspect_needs_w`) 이다 — clamp 가 없어도 aspect 가 폭을 요구하면 승격한다. 반대로 `h→w` 전송이 예정된 상자(높이 명시)는 제외 — 전송값이 stretch 를 이긴다.
- 부모 intake(`block.rs`)의 w→h 파생은 **제거**됐다. 자식이 `solve_node` 에서 낸 값이 정본이고, intake 가 `explicit` 로 덮으면 위 content 하한이 죽는다.
- fixture: `basicAxisContainerSize.browser.test.ts` aspect 소블록 30 조합 — 되돌리면 clamp 갈래 5 red / stretch 갈래 5 red.

### 금지 패턴

- ❌ clamp 후 재분배 생략 → `min-height` 로 커진 컨테이너에서 `flex-grow` 가 안 자라고, `max-height` 로 줄어든 컨테이너에서 shrink 가 안 돈다
- ❌ 한 축만 넣기 → 네 축이 같은 규칙이고, body 주입처럼 한 규칙을 전 축에 적용하는 소비자가 나머지 축에서 무너진다
- ❌ 재분배는 하고 컨테이너 상자는 bounding box 로 보고 → 분배 기준과 상자가 갈린다
- ❌ grid 재진입 전 `mark_subtree_dirty` 생략 → 증분 skip 이 stale 캐시를 돌려준다
- ❌ auto-main item 이 찌그러지는 것을 이 변경 탓으로 진단 → §4.5 floor 가 막는다 (명시 주축 크기 item 만 압축)
- ❌ auto 폭을 clamp 바인딩과 무관하게 definite 승격 → flex/grid item 의 used 크기를 커널에서 뺏는다 (부모 block 한정이 정본)
- ❌ aspect 전송값을 `explicit_h` 로 굳히기 → §5.2.2 content 하한이 죽어 내용이 상자를 넘긴다
- ❌ 부모 intake 에서 자식의 w→h 를 다시 파생 → 자식이 이미 낸 값을 덮어 하한이 사라진다

## body 는 뷰포트가 아니다 — 상자는 뷰포트, 배치는 내용 (2026-07-28)

Chrome 은 페이지를 **두 노드**로 처리한다.

| 역할        | Chrome                                  | 캔버스         |
| ----------- | --------------------------------------- | -------------- |
| 뷰포트(ICB) | 확정 높이 · clip + scroll               | **노드 없음**  |
| body        | `min-height:100vh` · height auto → 자람 | 두 역할을 겸함 |

`fullTreeLayout` **Step 1.5** 는 뷰포트 노드가 없어 body 에 `height = pageH` 를 주입해 두 역할을 겸하게 했다. `display:block` 에서는 충돌하지 않지만, body 가 **세로 flex 컨테이너**가 되는 순간 "뷰포트 크기"가 "main-size 예산"으로 재해석되어 자식을 압축한다 — 실측(components 페이지 390×844): 자식 합 1423 이 정확히 844 로 눌리고(ListBox 162→35.6 / GridList 164→29.4 / Card 322→85.6) 카드 **내용 305 가 85.6 상자를 넘어 다음 형제 위로 겹쳤다**.

- **주입은 배치 문법을 가리지 않는다**: 폭은 `width = pageW`(확정), 블록 축은 `min-height = pageH` **하나**다. Chrome 의 body 가 block/flex/grid 어느 쪽이든 `min-height:100vh` 인 것과 같다. 축별로 갈래를 두면 나머지 축이 각자 어긋난 채 남는다 — block/row flex 는 `height:%` 자식이 페이지 기준으로 **해소되어 버리고**(Chrome 0), 프레임 슬롯 정책도 축마다 달라진다. 대신 **엔진이 세 축 모두 clamp 뒤 값으로 재분배**해야 한다(위 절) — 그게 없으면 row flex 슬롯이 0 으로 접히고 grid `1fr` 행이 안 자란다.
- **보고 높이는 뷰포트 상자로 되돌린다** (Step 5). 이 값이 clip 높이이자 `maxScrollTop = 내용 extent − 이 높이` 의 기준이다. 내용 높이를 그대로 보고하면 스크롤이 0 이 되고 넘친 내용이 프레임 밖 캔버스로 흘러나온다 — **도달 수단이 없다**. 프레임 높이는 `input.pageHeight` 고정이라(`buildSceneSnapshot.ts`) 내용 따라 자라지 않는다.
- 짧은 내용에서는 `min-height` 가 body 를 페이지 높이로 채워 `justify-content`/`flex-grow` 가 종전대로 산다. 단 그러려면 위 재분배가 **먼저** 있어야 한다.
- **프레임 슬롯의 블록 축 크기 주입도 같이 빠진다** (`resolvePageSlotStyle`): body 가 `min-height` 로 서면 슬롯의 `height:100%` 는 해소되지 않는데, "크기를 명시" 한 것은 맞아 `stretch` 까지 꺼져 **0** 이 된다(Chrome 동일). 주입을 빼면 stretch 가 슬롯을 라인 cross 로 채운다(실측 80x400 / 310x400). 인라인 축(`width:100%`)은 부모 폭이 확정이라 그대로 둔다. 가드: `pageSlotStyle.test.ts`.
- **breakpoint height 가 아직 정하는 것 / 더는 정하지 않는 것**: ① 뷰포트 상자(clip + `maxScrollTop` 기준) ② 내용이 짧을 때의 **하한** — `justify-content`/`flex-grow` 여유가 여기서 나온다(실측 pageH 400→900: center 자식 y 150→400, grow 자식 400→900) ③ 아트보드 사각형. 잃은 것은 하나 — **내용이 넘칠 때 자식 크기를 정하는 힘**(실측: pageH 400 ↔ 900 이 자식 배치를 전혀 바꾸지 않는다). 그게 이번 분리의 목적이다.
- 주입 주석이 들던 근거("자식의 `height:100%` 가 페이지 크기 기준")는 **Chrome 에 없는 의미**였다 — body 가 `min-height:100vh` 인 실제 페이지에서 백분율 높이는 풀리지 않는다(실측 DOM 0). 이제 어느 배치 문법에서도 해소되지 않는다. 실사용도 0건이다 — catalog 의 `height:"100%"` 2건은 ProgressBar/Meter `.fill` 이고 부모가 `height: var(--spacing-sm)` 로 확정된 트랙 내부다.
- Chrome 실측 fixture: `bodyViewportBox.browser.test.ts` — 자식 좌표는 `viewport(확정) > body(min-height:100%)` DOM 오라클과 대조하고, body 상자 높이는 오라클 대응물이 없어 **빌더 계약**으로 따로 단언한다. 주입을 `height` 로 되돌리면 3 red.
- **잔존**: `height:%` 를 **명시한** cross 자식이 Chrome 은 0 인데 엔진은 stretch 로 채운다(실측 row 슬롯 dom 0x0 / 엔진 80x400). "해소 불가여도 _명시_ 했으면 stretch 를 끈다"는 규칙이 커널에 없어서인데, 커널은 해소된 값(AUTO)만 보고 style 문자열을 모른다. 본 변경 **이전에도 동일**했고 프레임 슬롯 주입이 사라져 실사용 경로도 없다.

### 금지 패턴

- ❌ 주입을 배치 문법별로 갈래 두기 (`display` 를 보고 `height` ↔ `min-height` 선택) → 갈래마다 Chrome 발산이 따로 남는다. 한 규칙 + 엔진 재분배가 정본
- ❌ 엔진 재분배(위 절) 없이 주입만 `min-height` 로 바꾸기 → row flex 슬롯 0 붕괴 + grid `1fr` 행 미성장
- ❌ body 보고 높이를 엔진 결과 그대로 두기 → 스크롤 0 + 프레임 밖 유출
- ❌ 프레임 높이를 내용 따라 키워 회피 → 아트보드는 breakpoint 크기이고, 그러면 뷰포트 개념 자체가 사라진다
- ❌ TS 에서 내용 높이를 미리 재서 `height` 로 주입 (2-pass 자작) → 폭·높이 축 모두 엔진 소유 (§TS 잔존 계약)

## 늘어날 available 이 없으면 기여는 **content** 다 — Container Align 교차축 (2026-07-28)

`align-items` 가 non-stretch 면 auto-cross 자식은 **shrink-to-fit** 이라 `INDEFINITE_AVAIL(-1)` 을 받는다. 그 상태에서 크기를 만들어 내는 경로가 둘 다 비어 있었다.

| 경로                         | 증상                                              | 수정                                   |
| ---------------------------- | ------------------------------------------------- | -------------------------------------- |
| 엔진 `solve_block`           | auto 폭 자식을 **센티넬로 stretch** → 폭 `-1`     | 측정 패스 전용 fit-content 대체를 확대 |
| TS `enrichWithIntrinsicSize` | `width:%` 텍스트 leaf 에 스칼라 미공급 → 폭 **0** | 백분율도 스칼라 공급 대상              |

- 근거는 한 규칙이다 — 늘어날 available 이 없으면 intrinsic 기여는 stretch 가 아니라 **content** 이고(CSS-SIZING-3 §5), containing block 이 미결정이면 `%` 는 **`auto` 처럼** 동작한다(§5.1 순환 백분율).
- **ADR-169 Phase 1 이 같은 처방을 이미 갖고 있었다** — 측정 패스(`-2`/`-3`)에만 걸려 있었을 뿐이다. `INDEFINITE_AVAIL(-1)` 도 "available 이 없다" 는 같은 상태다.
- **stretch 부모에서는 무해**하다: `%` 가 해소되면 엔진이 그 값을 쓰고(`resolve_leaf_intrinsic_width` 의 `Some(n) if n >= 0.0 => explicit_w`) 스칼라는 소비되지 않는다. 그래서 스칼라 공급을 넓혀도 stretch 경로 결과가 바뀌지 않는다.
- **B22 가 이 결함의 통로였다**: catalog `Text.containerStyles.width = "100%"` 를 `applyImplicitStyles` 가 선주입하는데, `100%` 는 키워드도 `auto` 도 아니라 스칼라 게이트에서 탈락했다. 라이브 실측 — `align-items` 지정 시 GridList **12px** / MenuItem **24px** / ListBoxItem **48px** (폭을 가진 아이콘만 남고 텍스트가 0). 수정 후 MenuItem 91 / ListBoxItem 115 / GridListItem 125.
- **Direction 미지정 + Container Align 은 row 가 된다** — 패널이 `flexDirection` 기본값 `row` 로 쓰므로 페이지 전 자식이 한 줄에 들어가 크게 shrink 한다. 그건 **CSS 대로**이고 본 결함과 무관하다. 세로 스택을 의도했다면 Direction 을 먼저 column 으로.
- Chrome 실측 fixture: `containerAlign.browser.test.ts` (engine block 4 · engine flex 3 · pipeline 3 · 잔존 1). 민감도 — 엔진 확대 되돌림 3 red / TS 게이트 되돌림 2 red.

### 잔존 1건

- **projection collection 행은 owner 폭에 의존**: 투영된 행(`projection:gridlist-row:*`)은 레이아웃 자식이 없어 shrink-to-fit 에서 폭을 못 만든다(실측 GridList 34). 별개 축이다 — memory `feedback-projection-width-dependent-fold-belongs-in-render-not-projection`.

구 잔존 ①(`%` 가 확정 크기로 재해소되지 않음)은 2026-07-28 해소 — 아래 §shrink-to-fit 은 크기를 정한 **뒤** 한 번 더 돈다.

### 금지 패턴

- ❌ 미결정 available 을 그대로 stretch 폭으로 사용 → 폭이 음수 센티넬이 된다
- ❌ 스칼라 공급 게이트를 키워드/`auto` 로만 판정 → `width:%` 텍스트 leaf 가 shrink-to-fit 부모에서 0 으로 접힌다
- ❌ 이 붕괴를 `align-items` 구현 문제로 진단 → `align-items` 자체는 정합이고(합성 도형 6케이스 전부 Chrome 일치) 무너지는 것은 **크기 공급** 쪽이다
- ❌ Container Align 이 row 로 붙어 생긴 shrink 를 결함으로 판정 → Direction 기본값이 `row` 이고 그 결과는 CSS 대로다

## shrink-to-fit 은 크기를 정한 **뒤** 한 번 더 돈다 (CSS-SIZING-3 §5.1, 2026-07-28)

인라인 available 이 미결정이면 컨테이너 크기가 **자식으로부터** 나온다. 그 pass 에서 자식의 `%` 는 참조할 확정 크기가 없어 `auto` 로 풀리고(순환 백분율), auto 폭 블록 자식은 stretch 대신 fit-content 가 된다. 둘 다 **intrinsic 기여를 구하는 동안만** 맞는 해석이고, CSS 는 크기가 정해진 뒤 그 크기를 containing block 으로 삼아 자식을 정상 배치한다. 엔진은 1차 pass 에서 멈춰 있었다.

| 자식 (상자 폭 120 확정) |        Chrome |     구 엔진 |
| ----------------------- | ------------: | ----------: |
| `width:50%`             |            60 |     **120** |
| `width:150%`            |    180 (넘침) |     **120** |
| `marginLeft:10%`        | x=147 / w=108 | x=135 / 120 |
| auto 폭 **짧은** 형제   | 120 (stretch) |      **40** |

- 거처는 `shrink_to_fit_settled` + 세 `solve_*` 말미의 **재진입** 한 형태다. 확정 폭을 `explicit_w` 로 넘겨 다시 부르므로 2차 pass 에서 게이트가 닫혀 1회로 끝난다 (flex 3.6/3.7, grid 블록 축 clamp 와 같은 모양).
- **컨테이너 상자는 1차 pass 값을 유지한다** — intrinsic 크기는 `%` 를 `auto` 로 본 값이고, 재해소로 자식이 더 커지면 CSS 도 넘치게 둔다. 그래서 재진입 뒤 `layout.width` 를 1차 값으로 되돌리고 그 값을 반환한다(auto 축 반환은 **content-box** 계약).
- **게이트가 축마다 다르다**: block/flex 는 상속 available 이 미결정(`INDEFINITE_AVAIL`)일 때, grid 는 `inline_intrinsic` — `width: max-content` 처럼 **키워드**로 shrink-to-fit 이면 상속 available 은 definite 라 앞의 조건으로는 안 잡힌다.
- **측정 모드 센티넬(`-2`/`-3`)은 대상이 아니다** — 거기서는 `%` 가 `auto` 인 것이 최종 답이다. 그래서 게이트가 `INDEFINITE_AVAIL` **등가 비교**이고 `avail < 0` 이 아니다.
- **grid 는 원본 토큰으로 다시 세운다** (2026-07-28 정정 — 구 "트랙을 얼려서 넘긴다" 는 폐기). 한때 확정 px 트랙을 2차 pass 에 주입했는데, 그 freeze 는 **§12.7.1 base 부재의 우회**였다 — `fr` 이 base 없이 균등 분배되니 재계산하면 값이 달라졌던 것이다. 단독 `fr` 이 `minmax(auto, fr)` 로 base 를 받은 뒤로는(아래 §단독 `fr`) 원본 토큰 재계산이 **같은 값을 알고리즘으로 낸다**(`1fr 1fr` / min-content → freeze-restart 가 40·30 재현). 얼리지 않아야 clamp 로 커진 컨테이너의 §12.8 stretch 와 `%` 트랙 재해소가 2차 pass 에서 살아난다.
- **암묵 열만 예외**: 원본 template 이 비어 있으면(`grid-template-columns` 미지정) 1차 pass 가 합성한 px 열을 2차 pass 에 주입한다 — 토큰이 없어 재계산이 `grid.rs` 기본 트랙으로 떨어지기 때문이다. 이 예외를 빼면 `shrinkToFitInline` 7 red (wave 5 실측, `eng=100` 기본 트랙).
- **`inline_intrinsic` 에 definite 게이트**: `explicit_w > 0.0` 이면 즉시 `None`. 2차 pass 는 settled 폭을 받은 definite 컨테이너라 intrinsic 경로로 재진입하면 안 된다 (무한 왕복).
- **명시 열이 없는 grid 도 열이 있다**: `grid-template-columns` 미지정이면 auto-placement 가 만든 암묵 열을 `grid-auto-columns`(기본 `auto`)가 정한다. 종전엔 intrinsic 경로가 "명시 토큰 없음" 으로 그냥 빠져나가 `container_w` 가 **미결정 센티넬(-1) 그대로** 폭으로 보고됐다 — 라이브 실측: `align-items:center` 아래 Toolbar 를 `display:grid` 로 바꾸면 폭 **-1** (수정 후 64). 행 축의 암묵 트랙 생성과 같은 규칙이다.
- Chrome 실측 fixture: `shrinkToFitInline.browser.test.ts` (§1 재해소 39 + 중첩 1 + grid 키워드 2 + §2 암묵 열 5 + 잔존 2). 민감도 — 재진입 무력화 19 red / 암묵 열 freeze 해제 7 red / 암묵 열 합성 무력화 6 red.

### 금지 패턴

- ❌ 재진입 뒤 컨테이너 상자를 2차 pass 결과로 갱신 → 넘치는 자식을 따라 상자가 커진다 (CSS 는 intrinsic 크기 유지)
- ❌ 재진입에 넘기는 확정 폭을 content-box 로 전달 → `explicit_w` 는 border-box 계약이라 padding 만큼 어긋난다
- ❌ 게이트를 `avail_w < 0` 로 넓히기 → 측정 패스(`-2`/`-3`)까지 재진입해 intrinsic 기여가 오염된다
- ❌ grid 재진입에서 확정 px 트랙을 다시 얼리기 → §12.8 stretch 와 `%` 재해소가 2차 pass 에서 죽는다 (base 공급 전의 우회였다)
- ❌ 암묵 열까지 원본 토큰(=빈 template)으로 재계산 → `grid.rs` 기본 트랙으로 떨어진다
- ❌ `inline_intrinsic` 의 definite 게이트 제거 → 2차 pass 가 intrinsic 경로로 되돌아간다
- ❌ 명시 열이 없다고 intrinsic 경로를 건너뛰기 → 컨테이너 폭이 음수 센티넬로 보고된다

## automatic minimum size (CSS-FLEXBOX-1 §4.5) — 엔진 소속 (ADR-164 Phase 1 / ADR-165 정밀화, 2026-07-25)

flex item 의 automatic minimum size (min-width/height:auto = content 하한) 는 **엔진 구현** (`flex.rs::parse_item` effective min 해석): 조건 `명시 min 부재 ∧ item 주축 overflow visible ∧ 주축 크기 auto` → floor = **정확 min-content** (`content_min_main`, off 19 — 공급 시) 또는 `content_main` (absent fallback — 단일줄 상한 근사), max clamp 동반. 프로토콜: off 18 = 주축 overflow (0=visible zero-init / 1=clipped), off 19 = `content_min_main` (0=absent zero-init) — `tree.rs::write_flex_item` 이 기록, `FLEX_FIELD_COUNT=20`.

- 구 **Step 5.7** (부모 overflow≠visible 기준 flexShrink:0 전면 주입, `fullTreeLayout.ts`) 은 **제거됨** — coarse 근사가 min-content 이상의 정당한 shrink 까지 막아 CSS 와 발산했다. TS 에서 overflow 기준 flexShrink 주입 보정 재도입 금지 (해당 위치 tombstone 주석 참조).
- **floor 공급 주체는 두 갈래 (ADR-169)**: 텍스트 leaf 는 TS 스칼라(`content_min_width`), **컨테이너 item 은 엔진의 측정 모드 재실행**(`measure_intrinsic_width` → off 19)이다. absent fallback(`content_main` = 상한 근사)이 남는 경우는 두 채널 모두 비었을 때뿐 — grid 서브트리(§컨테이너 intrinsic)와 leaf 아닌 비측정 형태가 여기에 해당한다.
- **측정 스칼라 계약 (ADR-165 — 구 minWidth 채널 흡수)**: 텍스트 leaf 의 intrinsic 은 `enrichWithIntrinsicSize` 가 `contentMinWidth`(최장 단어 폭)/`contentMaxWidth`(단일줄 폭) 스칼라 2종 (content-box, `Math.ceil`) 을 NodeStyle 로 공급하고, 엔진이 CSS-SIZING-3 §5 공식을 소유한다 — `tree.rs::resolve_leaf_intrinsic_width` (auto→max-content 제안 / fit-content→clamp(min-content, stretch-fit, max-content) / min·max-content 키워드) + §4.5 floor 의 정확 min-content. **Why**: 엔진은 텍스트 측정 부재로 leaf content 를 모른다 (CanvasKit/Canvas 2D = 측정 oracle 불변 — 측정 주체는 TS, 소비 알고리즘만 엔진). 구 width(단일줄 ceil)+minWidth(상한 근사) 주입 채널은 텍스트 leaf 에서 제거됨 — 재도입 금지 (스칼라와 이중 적용). INLINE_BLOCK/CIRCLE/IMAGE 합성 leaf 주입과 컨테이너 numeric 선해석은 잔존.
- **CSS base width 채널**: 텍스트 leaf 의 폭 주입 제거로 generated CSS base 규칙은 별도 채널이 담당 — `width:100%` 계열(text/heading/paragraph/description)은 B22, `width:fit-content`(label)는 ADR-165 신설 선주입 (`implicitStyles.ts` — catalog Label 은 containerStyles 부재라 CSS 실측 근거 직접 주입). 신규 텍스트 leaf 계열 추가 시 CSS base width 규칙의 엔진 채널 존재를 확인할 것.
- Chrome 실측 fixture: `apps/builder/tests/parity/autoMin.browser.test.ts` (8케이스) + `intrinsicSizing.browser.test.ts` (engine 6 — DOM 원자/스칼라 격리 + pipeline 4 — 실텍스트 end-to-end) — floor/스칼라 동작 변경 시 여기부터 갱신
- **잔존 — 스칼라 leaf 의 padding 이중 계산**: `resolve_leaf_intrinsic_width` 는 **border-box** 를 반환하는데(`+ pad_border_h`) 부모 커널의 content 슬롯은 **content-box** 를 기대한다 (`flex.rs::border_main` 이 `pad_border_main` 을 더한다). 그래서 padding 을 가진 스칼라 leaf 가 flex **주축** 에서 padding 만큼 커진다 (실측 `paddingLeft:12px` + 내용 120 → DOM 132 / 엔진 144). shrink-to-fit 과 무관하며 definite 부모에서도 같다. block 부모에서는 자식이 stretch 되어 content 슬롯을 안 읽어 드러나지 않는다. 반환값이 leaf 자신의 최종 layout(=border-box) 과 부모 슬롯(=content-box) 두 소비처를 겸하는 것이 원인이라, 고치려면 두 소비처를 분리해야 한다. 스냅샷: `shrinkToFitInline.browser.test.ts` §잔존.

## 컨테이너 intrinsic — 측정 모드 센티넬 (ADR-169, 2026-07-27 / grid 축 2026-07-28)

컨테이너 flex item 의 intrinsic 은 **엔진이 자기 알고리즘을 측정 모드로 재실행**해 얻는다 (Taffy `AvailableSpace::{MinContent,MaxContent}` / Yoga `MeasureMode` / Blink `ComputeMinMaxSizes` 와 같은 형태). `INDEFINITE_AVAIL(-1)` 옆에 `MIN_CONTENT_AVAIL(-2)` / `MAX_CONTENT_AVAIL(-3)` 센티넬을 두어 `solve_node` 시그니처는 그대로다.

- **소비 지점**: `solve_flex` 의 `is_row` 분기가 **auto-main + 자식 보유 + 스칼라 미공급** item 에 대해 `measure_intrinsic_width` 를 호출해 off 13(`content_main` = max-content)과 off 19(`content_min_main` = 정확 min-content)를 **함께** 채운다. 한쪽만 채우면 긴 텍스트 초과가 악화된다 (ADR-169 G3).
- **캐시**: 노드당 `(mutation_gen, min, max)`. 무효화 기준은 `dirty` 가 아니라 **트리 단위 세대 카운터**다 — `propagate_dirty` 는 이미 dirty 인 조상에서 조기 종료하므로 "dirty ⟹ 캐시 없음" 이 성립하지 않는다. 측정 전후로 서브트리 `layout`/`dirty` 를 스냅샷·복구해 부작용 0 을 유지한다.
- **grid 축도 열렸다 (2026-07-28)** — 종전엔 `subtree_has_grid` 가드로 grid 서브트리를 측정에서 제외했다. `resolve_grid_tracks` 2단계가 음수 available 에서 `fr_size = 0` 을 내 fr·auto 트랙이 붕괴했기 때문이다. 지금은 `solve_grid` 가 미결정 인라인 축을 감지해 트랙을 **자식 기여**로 세우므로(아래 §그리드 자신의 min/max-content) 붕괴 경로가 없고, 가드와 `subtree_has_grid` 헬퍼는 삭제됐다. `containerIntrinsic.browser.test.ts` I/J 는 이연 스냅샷에서 **발산 0** 으로 승격.
- **height 축(column main)은 결함 부재** — 빈도가 아니라 **구조상**이다. 인라인 방향은 블록 박스의 초기 동작이 stretch 라 auto 폭 자식이 available 을 채우지만, 블록 방향은 `height:auto` 가 내용 크기다. "늘어나기만 하는 내용을 고유 크기로 오인" 하는 형태가 세로에서는 성립하지 않는다 (K 케이스 실측 — 컨테이너·형제 정합). K 에 남는 `height:100%` 발산은 flex 분배 후 백분율 재해소 부재로, 별개 영역이다.

### 금지 패턴

- ❌ 캐시 무효화를 `dirty` 플래그에 종속 → `propagate_dirty` 조기 종료로 구멍이 생긴다 (`mutation_gen` 비교가 정본)
- ❌ 측정 후 `mark_subtree_dirty` 로 복구 갈음 → 자손 캐시까지 날아가 중첩 깊이에 지수적
- ❌ 측정 배선을 `is_row` 밖으로 확장 → 세로 축은 결함 부재이며, 확장 시 height-for-width 2-pass 계약(ADR-165)과 충돌

## 증분 skip 의 키는 dirty **와 available** 둘이다 — 재부모화 (2026-07-28)

`solve_node` 는 서브트리가 전부 clean 이면 저장된 layout 을 그대로 돌려준다. 그 값은 **그때 받은 available 에서만** 유효한데, 키가 dirty 하나뿐이면 노드를 **다른 부모로 옮겼을 때** 그 사실이 게이트에 안 잡힌다 — 옮겨온 노드는 자기 style/children 이 그대로라 clean 이기 때문이다.

| 상태             | 부모                                   | 결과                               |
| ---------------- | -------------------------------------- | ---------------------------------- |
| 최초             | flex column + `align-items:flex-start` | 24 (shrink-to-fit)                 |
| GridList 로 이동 | GridList(34)                           | 34 (stretch)                       |
| **undo** (복귀)  | 원래 부모                              | **34** ← 이전 부모 기준이 눌러앉음 |
| 새로고침         | 원래 부모                              | 24 (전체 재빌드라 정상)            |

- 거처는 `TreeNode::last_avail` — 저장된 layout 이 계산될 때 받은 `(avail_w, avail_h)`. 게이트는 `!subtree_has_dirty && last_avail == Some((avail_w, avail_h))`.
- **트리 단위 `last_compute` 로는 못 잡는다** — 그건 root·available 이 바뀔 때만 전체를 무효화한다. 빌더는 page body 가 고정 root 이고 available 도 그대로라 항상 통과한다. 그래서 증상이 "새로고침하면 고쳐지는" 형태로 나타난다.
- `set_children` 은 새 부모와 그 **조상**만 dirty 로 만든다 (`propagate_dirty`). 옮겨온 자식을 dirty 로 만드는 방법도 있지만, available 키가 더 넓게 정확하다 — 부모가 리사이즈돼 자식의 available 만 달라지는 경우도 같이 덮는다.
- **측정 패스 복구 3종 묶음**: `snapshot_subtree`/`restore_subtree` 가 `dirty`·`layout`·`last_avail` 을 같이 되돌린다. 측정은 센티넬 available 로 돌기 때문에 `last_avail` 을 안 되돌리면 키가 측정값으로 오염된다.
- **stretch 자식에서는 안 보인다** — 부모가 자식 폭을 덮어쓰므로 stale 반환값이 소비되지 않는다. 크기를 자식이 정하는 형태(shrink-to-fit / `align-items` non-stretch / auto 폭)에서만 드러난다.
- 회귀 감시: `tree.rs::reparent_invalidates_child_skip` (한 root 아래 두 부모 사이 이동 — root 를 바꾸면 `last_compute` 가 가려 RED 가 안 뜬다).
- 비용: 동일-머신 A/B 로 flex 마이크로벤치 3종 **+8%** (`grow_nowrap` 17.6→19.0µs 등), `tree_solve` 는 depth 12 까지 평탄. 증가분은 **종전에 잘못 skip 되던 재계산이 실제로 도는 몫**이다.

### 돌려주는 값은 `layout` 이 아니라 **직전 반환값**이다 (2026-07-28)

키를 맞춰도, skip 이 **무엇을 돌려주는가**가 따로 틀려 있었다. `solve_*` 는 auto 축에서 **content-box** 를 반환하는데, 그 뒤 배치 단계에서 **부모가 같은 노드의 `layout` 을 border-box 로 덮어쓴다**. skip 이 `node.layout` 을 돌려주면 부모가 `pad+border` 를 **다시** 더한다.

| 상태                      | GridListItem origin (pad 12·border 1) | ListBoxItem (pad 4) | Form (pad 0) |
| ------------------------- | ------------------------------------: | ------------------: | -----------: |
| 정상 (내용 42)            |                                    68 |                  76 |          168 |
| 다른 요소 1회 편집        |                              120→ 146 |                  92 |          168 |
| 2회                       |                                   198 |                 108 |          168 |
| 증가분 = `2×(pad+border)` |                               **+52** |             **+16** |       **+0** |

- 거처는 `TreeNode::last_solved` — `solve_node` 의 **반환값**을 따로 저장하고 skip 은 그것을 돌려준다. 두 return 지점(leaf early return · dispatch tail) 모두에서 기록한다.
- **증상이 "편집한 요소가 아니라 다른 요소가 자란다"** 로 나타난다 — 편집 대상은 dirty 라 skip 되지 않고, 그 **형제/무관 요소**가 skip 대상이기 때문이다. 그래서 원인 요소를 찾을 때 편집한 쪽을 보면 안 된다.
- **패딩 0 인 요소는 무증상**이다(Form). padding/border 를 가진 auto-크기 컨테이너에서만 드러나 컴포넌트별 결함처럼 보인다.
- 빌더는 편집당 `computeLayout` 을 2회 돌리므로(1-pass + Step 4.5) 화면 증가분은 `2×(pad+border)` 다. 엔진 단위 테스트는 1회라 `1×` 로 잡힌다.
- 회귀 감시: `tree.rs::incremental_skip_is_idempotent_for_padded_auto_container` (형제만 3회 바꾸고 skip 대상 높이 불변 단언 — 되돌리면 회당 +26 으로 RED).
- 이 결함은 **기준값도 오염시킨다**: 최초 로드 직후 이미 1회 skip 이 섞여 GridListItem 94(정답 68) / iconButton 40(정답 30) 이었다. "누적" 만 고쳐졌는지 보지 말고 **첫 값이 CSS 계산과 맞는지** 같이 확인할 것.

### 금지 패턴

- ❌ 증분 skip 게이트를 dirty 단독으로 판정 → 재부모화·부모 리사이즈에서 stale 크기 반환
- ❌ skip 이 `node.layout` 을 반환 → 부모가 배치 때 border-box 로 덮어쓴 값이라 `pad+border` 가 매번 재가산된다 (`last_solved` 가 정본)
- ❌ 재부모화를 `set_children` 에서 자식 subtree dirty 마킹으로만 해결 → available 이 바뀌는 다른 경로(부모 리사이즈)는 여전히 샌다
- ❌ 측정 패스 복구에서 `last_avail`·`last_solved` 누락 → 센티넬 available 과 측정 반환값이 키·값에 남아 이후 solve 판정이 오염된다
- ❌ 이 증상을 store/canonical 문제로 진단 → 새로고침으로 정상값이 돌아오면 **레이아웃 캐시**다 (데이터는 멀쩡 — store·canonical 스냅샷 diff 로 1분 안에 배제된다)
- ❌ 자라는 요소를 컴포넌트 결함으로 진단 → padding 유무로 갈릴 뿐이라 "컬렉션 item 만 이상하다" 로 잘못 귀속된다

## 컨테이너의 `width: min/max/fit-content` 는 엔진이 **측정으로** 해소한다 (CSS-SIZING-3 §5, 2026-07-28)

키워드 폭은 "부모가 주는 available" 이 아니라 **자기 내용의 min/max-content** 다. 종전 엔진은 이 값을 부모 intake 의 `CONTENT` 센티넬로만 처리해서, 실제 소비된 값이 일반 solve 의 **content bounding box** (auto 자식이 stretch 된 폭까지 포함) 였다.

| 자식 종류        | `width:min-content` 의 소비값    | Chrome | 구 엔진 |
| ---------------- | -------------------------------- | -----: | ------: |
| 확정 폭 자식     | min==max==bbox — **우연히** 일치 |     90 |      90 |
| 측정 스칼라 leaf | stretch 폭이 bbox 를 밀어 올린다 |     50 | **300** |

두 줄이 갈린다는 것이 진단의 핵심이었다 — 확정 폭 대조군이 없으면 "엔진이 키워드를 무시한다" 로 **잘못 귀속**된다 (실제로는 처리하되 스칼라 기여를 못 읽는다).

- 거처는 `solve_node` — `resolve_self_size` 직후, clamp **앞**. `width_intrinsic_keyword` 가 키워드를 알아보면 `measure_intrinsic_width` 로 해소해 `explicit_w` 로 굳힌다. `fit-content` 는 `clamp(min-content, stretch-fit, max-content)` (available 미결정이면 max-content).
- **측정 패스 안에서는 재진입하지 않는다** — 키워드가 요구하는 모드로 상속 센티넬을 **갈아끼운다** (§5.2: min-content 상자의 max-content 기여도 min-content 다). 측정 안에서 측정을 부르면 캐시 계약이 깨진다.
- **grid 는 제외** — §12.5 트랙 경로가 자체로 처리한다(아래 §그리드 자신의 min/max-content). 여기서 선해소하면 확정 폭을 `fr` 이 재분배해 §12.7.1 계약과 충돌한다 (probe 실측으로 grid 갈래는 이미 정합).
- **TS 선해석은 제거됐다**: `enrichWithIntrinsicSize` 의 폭 주입 통과 게이트가 grid 한정(`isIntrinsicGrid`)에서 **자식 보유 컨테이너 전체**(`isIntrinsicContainer`)로 넓어졌다. `calculateContentWidth` 근사가 엔진의 정확값을 덮고 있었다 (실측 손자 70px 를 품은 block 의 `fit-content`: DOM 70 / 주입값 80). **합성 leaf(INLINE_BLOCK/CIRCLE — 자식 0)는 주입 잔존** — 엔진이 그 content 를 모른다.
- fixture: `basicAxisContainerSize.browser.test.ts` (ADR-170 격자 1). 민감도 — 엔진 해소를 되돌리면 109키 재발산 / TS 선해석을 되살리면 pipeline 20키 재발산.

### 금지 패턴

- ❌ 키워드 폭을 부모 intake 의 `CONTENT` 센티넬로만 처리 → 소비값이 stretch 포함 bbox 가 된다
- ❌ 측정 패스 안에서 `measure_intrinsic_width` 재진입 → 센티넬 교체가 정본
- ❌ grid 컨테이너의 키워드를 `solve_node` 에서 선해소 → `fr` 재분배로 §12.7.1 붕괴
- ❌ TS 에서 컨테이너 키워드를 px 로 주입 → 근사가 엔진 정확값을 덮는다 (합성 leaf 만 예외)
- ❌ 키워드 발산을 확정 폭 자식만으로 진단 → 그 갈래는 우연히 정합이라 결함이 안 보인다

## 그리드 자신의 min/max-content — 여유가 없을 때의 트랙 sizing (CSS-GRID-1 §12.5–§12.7.1, 2026-07-28)

인라인 축이 미결정이면 **나눠 줄 여유가 없다**. 세 진입이 같은 상태이고 한 경로로 모인다:

| 진입                         | 예                                   |
| ---------------------------- | ------------------------------------ |
| 측정 모드 센티넬             | flex item 의 shrink-to-fit base size |
| `width` 가 intrinsic 키워드  | `width: max-content` 인 그리드       |
| 상속 available 이 indefinite | 미결정 폭 컨테이너 안의 그리드       |

판정은 `solve_grid` 의 `inline_intrinsic` 한 곳. `Some(mode)` 면 트랙을 자식 기여로 세워 **px 로 확정**하고 `container_w` 를 그 합으로 둔다 — 이후 경로는 definite 컨테이너를 받은 것과 똑같이 돈다.

| 트랙             | min-content 모드 | max-content 모드                 |
| ---------------- | ---------------- | -------------------------------- |
| `px`             | 그 값            | 그 값                            |
| `%`              | min-content 기여 | max-content 기여 (`auto` 동형)   |
| `auto`           | min-content 기여 | max-content 기여                 |
| `min-content`    | min-content      | min-content                      |
| `max-content`    | max-content      | max-content                      |
| `fit-content(L)` | min-content      | clamp(min, L, max)               |
| `minmax(a,b)`    | a 의 base        | b 의 상한 (b 가 fr 이면 §12.7.1) |
| `fr`             | min-content 기여 | flex factor × used fraction      |

- **`%` 는 `auto` 처럼 동작한다** — 백분율의 기준이 지금 구하려는 크기 자신이라 해소할 수 없다 (실측 `50% auto` / max-content → 180 = `auto auto` 와 동일).
- **min-content 모드에서 `fr` 은 펴지 않는다** — base 그대로다 (실측 `3fr 1fr` → 70). §12.7.1 의 used flex fraction 은 max-content 모드에서만 돈다: 후보는 (a) 각 flexible 트랙의 base ÷ factor(factor ≤ 1 이면 base 그대로), (b) 그 트랙 아이템의 max-content 기여 ÷ Σfactor(Σ < 1 이면 1 로 본다). 실측 — `3fr 1fr` uff 60 → 180·60 / `0.5fr 0.5fr` uff 120 → 60·60.
- **재계산해도 값이 안 변해야 한다** (2026-07-28 정정 — 구 "fr 은 얼리는 것이 맞다" 는 폐기). 컨테이너 확정 후 트랙을 다시 세우면 `1fr 1fr` / min-content 가 35·35 로 갈라졌는데, 그건 fr 분배가 §12.7.1 의 "base 를 밑도는 fr 은 inflexible 로 freeze 후 재시작" 을 안 돌던 탓이다. 지금은 재계산이 40·30 을 그대로 재현하므로 **얼릴 이유가 없다** (§shrink-to-fit 의 재진입).
- **컨테이너 폭은 트랙 extent** 다 — 셀 bounding box(`max_right`)는 자식이 **점유한** 칸까지라 빈 트랙이 빠진다 (실측 `1fr 1fr` + 자식 1개 / max-content → DOM 240, 점유 셀 기준이면 120). definite 경로의 `max_right` 는 기존 계약 유지.
- **인라인 축은 stretch-fit 도 definite** 다 — block-level `width:auto` 는 containing block 을 채우므로(§10.3.3) §12.8 stretch 대상이다. 그 구분을 `inline_intrinsic` 이 준다(`Some` = shrink-to-fit). **블록 축은 아니다** — `height:auto` 는 내용 크기라 진짜 미결정 (§여유가 없는 것과 음수인 것은 다르다).
- **TS 는 컨테이너의 intrinsic 키워드를 선해석하지 않는다** — grid 는 트랙을 몰라 자식 폭 합 근사를 냈고(실측 자식 120·60 / `auto auto` → DOM 180, 주입값 80), 2026-07-28 부터 **자식을 가진 컨테이너 전체**가 같은 판정이다 (§컨테이너의 `width: min/max/fit-content`).
- Chrome 실측 fixture: `gridContainerIntrinsic.browser.test.ts` (engine 키워드 47 + flex item 11 + 규칙 2 + `%` 트랙 내부 배분 5, pipeline 6). 민감도 — intrinsic 경로 차단 5 red / §12.7.1 제거 25 red / 트랙 extent → 셀 bbox 4 red / stretch-fit 게이트 축소 1 red / TS 선해석 복원 6 red.
- **구 잔존 해소 (2026-07-28)**: `%` 트랙의 **내부 배분**은 재진입 freeze 제거로 함께 풀렸다 (`50% auto` / max-content → DOM 90·90 = 엔진). 확정 폭으로 재진입하면 `%` 가 그 폭에 해소되고 `fr` 은 §12.7.1 이 같은 값을 재현하므로, "트랙 sizing 2-pass 재설계" 로 봤던 것이 실은 base 공급 하나였다. 스냅샷이던 5케이스는 정합 단언으로 승격됐다.

### 금지 패턴

- ❌ 미결정 available 을 그대로 `resolve_grid_tracks` 에 넘기기 → `remaining.max(0.0)` 이 0 을 내 fr·auto 트랙이 붕괴한다 (ADR-169 이 grid 를 이연했던 바로 그 경로)
- ❌ `fr` 분배에서 §12.7.1 freeze-restart 생략 → base 를 밑도는 트랙이 균등 분배로 눌려 재계산마다 값이 갈린다 (35·35 vs 40·30)
- ❌ intrinsic 컨테이너 폭을 셀 bounding box 로 산출 → 빈 트랙이 빠진다
- ❌ 블록 축(`align_content`)에 stretch-fit definite 완화를 적용 → `height:auto` 는 진짜 미결정이다
- ❌ TS 에서 컨테이너의 `min-content`/`max-content`/`fit-content` 를 px 로 선해석해 주입 → 근사가 엔진 결과를 덮는다 (grid 는 트랙을, flex/block 은 자식 stretch 를 모른다)

## 그리드 컨테이너의 블록 크기는 **행 트랙 extent** 다 (CSS-GRID-1 §11.1, 2026-07-28)

`height:auto` 그리드의 높이는 자식 셀들의 bounding box 가 아니라 **행 트랙 합 + row gap + 자기 padding/border** 다. 종전 엔진은 `max_bottom`(셀 bbox)을 썼고, 그건 CSS 와 **두 방향으로** 어긋난다.

| 형태                       | 셀 bbox | CSS (트랙 extent) |
| -------------------------- | ------: | ----------------: |
| 30px 행 + 20px 자식        |      20 |            **30** |
| 30px 행 + 100px 자식(넘침) |     100 |            **30** |
| `30px 40px` + 자식 1개     |      20 |  **70** (빈 트랙) |
| 자식 `marginBottom:50px`   |      10 |            **30** |

넘치는 자식은 흘러넘치고(`overflow` 소관), 빈 트랙도 자리를 차지하며, margin 은 트랙을 늘리지 않는다 — "트랙이 크기를 정하고 자식은 그 안에 놓인다" 는 한 규칙의 세 얼굴이다.

- **미결정 블록 축의 행 토큰은 전부 자식 기여로 세운다** — 인라인 축의 §12.5–§12.7.1 과 같은 규칙(위 §그리드 자신의 min/max-content). `1fr`/`%` 는 나눠 줄 여유가 없어 content 크기가 되고, `minmax(auto,60px)` 는 §12.6 으로 상한까지 자란다. **두 변경은 한 묶음**이다: 종전엔 `1fr` 이 상속 available 로 0 이 되고 그 0 위에서 셀 bbox 가 우연히 CSS 값과 맞았다 — extent 로 바꾸면 그 우연이 사라진다.
- 블록 축은 **min-content == max-content** 다 (`(h, h)` 공급). 높이는 폭이 정해진 뒤의 내용 크기 하나뿐이다.
- 반환값은 **content-box** 다 — 부모 커널(`write_block_item` off 15 `content_h` 등)이 자식의 pad_border 를 더한다. 여기서 `own_pb_v` 를 더하면 이중 계산이다(실측 padding 12 → 42 대신 54).
- **행 목록 = 명시 토큰 ++ 암묵 토큰**. 암묵 행 크기는 `grid-auto-rows` 가 정하고(기본 `auto`, 여러 값이면 **첫 암묵 행부터** 순환), 자식이 쓰는 최대 row 까지 만든다. 종전엔 명시 토큰이 하나라도 있으면 암묵 행을 안 만들어 범위 밖 자식이 크기 0 트랙에 얹혔다 — 같은 y 에 겹치고 컨테이너도 짧아진다(실측 `30px` 1행 + 자식 3개: DOM 70 / 엔진 50). 암묵 **행**은 row-flow 에서만 생긴다 — col-flow 는 행을 명시 트랙으로 고정하고 열을 늘린다(그 확장은 grid.rs 소관).
- **자식 → 트랙 매핑은 `grid::resolve_child_cells`** (실제 배치) 로 구한다. 트랙을 재려면 어느 자식이 어느 트랙에 있는지 알아야 하는데, 거기엔 CSS §8.5 커서 규칙(definite column 이 커서보다 왼쪽이면 다음 행)이 들어간다. `i / col_count` 근사는 그걸 몰라 **측정한 행과 배치된 행이 갈린다** (실측: definite-column 자식 2개가 CSS 는 2행인데 근사는 1행 → DOM 400 / 근사 200). `place_children` 과 **같은 함수**를 쓴다.
- Chrome 실측 fixture: `gridContainerBlockSize.browser.test.ts` (engine 30 + pipeline 16 + 잔존 1). 민감도 — 트랙 extent 되돌림 25 red / 미결정 축 기여 해소 무력화 130 red / 암묵 행 생성 무력화 4 red / 배치 매핑 근사 복원 6 red.
- **잔존**: 자식이 **없는** 그리드는 트랙을 세우지 않는다 — `solve_node` 가 in-flow 자식 0 이면 leaf 로 조기 반환해 `solve_grid` 자체가 안 돈다(실측 `30px 40px` → DOM 70 / 엔진 0). 같은 방향의 미구현이지만 거처가 트랙 sizing 이 아니라 dispatch 다.

### 금지 패턴

- ❌ 컨테이너 크기를 셀 bounding box(`max_bottom`/`max_right`)로 산출 → 빈 트랙 누락 + 넘치는 자식을 따라 늘어남
- ❌ `final_h` 에 `own_pb_v` 를 더해 border-box 로 반환 → 부모 커널이 또 더한다 (auto 축 반환은 content-box 계약)
- ❌ 미결정 블록 축에서 `1fr`/`%` 행을 상속 available 로 해소 → 없는 여유를 나눈다
- ❌ 명시 행이 있을 때 암묵 행 생성을 건너뛰기 → 범위 밖 자식이 크기 0 트랙에 겹친다
- ❌ 자식 → 트랙 매핑을 `i / col_count` 로 근사 → 측정한 행과 배치된 행이 갈린다 (`resolve_child_cells` 가 정본)
- ❌ col-flow 에서 암묵 **행**을 늘리기 → 행은 명시 트랙 고정, 늘어나는 건 열이다

## 교차축 라인 cross 는 컨테이너 cross **대입** (CSS-FLEXBOX §9.4 step 8, 2026-07-27)

single-line(`flex-wrap:nowrap`) + definite cross 컨테이너에서 flex 라인의 outer cross size 는 컨테이너의 inner cross size **그 자체**다 — "**is** the flex container's inner cross size". `flex.rs::flex_layout` 의 라인 승격은 `max` 가 아니라 대입이어야 한다.

- `max` 로 라인을 아이템에 맞춰 키우면 `align-items:stretch` 가 그 커진 라인을 채워 **auto-cross 아이템이 내용까지 자란다**. CSS 는 컨테이너에서 자르고 내용이 라인 밖으로 흘러넘친다. 실측: 확정 높이 100 밴드 + `height:auto` 자식 + 내용 300 → DOM 100 / 구 엔진 300 (row·column 동형, 파이프라인까지 전파).
- `align-items:flex-start` 는 아이템이 자기 크기를 유지하므로 **종전에도 정합**이었다 — 증상이 stretch 에서만 나오는 이유. 확정 밴드 + auto 자식은 프리셋 row 레이아웃의 기본 형태라 라이브 도달 가능.
- **사각지대였다가 닫혔다**: `flexSweep` 가 오래 definite cross 를 줄 합보다 **크게**만 잡아 양수 free space 조합만 훑었고, 정렬 결함 3건이 전부 거기 있었다. 2026-07-27 에 음수 free space 축을 더해 1152 조합(교차축 576 + main 576)으로 확장했다 — `CROSS_SIZE`에 `definite-overflow`, main 축에 `MAIN_SPACE`.

## 넘칠 때의 정렬 — 위치 정렬은 음수 offset, 분배 정렬은 fallback (CSS-ALIGN-3 §4.2/§4.4, 2026-07-27)

여유 공간이 **음수**(내용이 컨테이너보다 큼)일 때 정렬은 두 계열로 갈린다. 3축(`justify-content` / `align-items` / `align-content`) 모두 동형이고, 한 계열의 값만으로 처리하면 반대쪽이 깨진다.

| 계열                                     | 음수 여유에서                      | 엔진 표현                                   |
| ---------------------------------------- | ---------------------------------- | ------------------------------------------- |
| **위치** (`center` / `flex-end`)         | 그대로 음수 offset (기본 `unsafe`) | `*_raw` (클램프 없는 값)                    |
| **분배** (`space-between/around/evenly`) | fallback → start 처럼 배치         | `*_free` (`.max(0.0)` 유지)                 |
| **`align-content: stretch`**             | 라인 부풀리기 없음                 | `.max(0.0)` 유지 (`stretch_extra > 0` 조건) |

- 분배값의 `.max(0.0)` 은 **결함이 아니라 정답**이다 — Chrome 실측에서 `space-between/around/evenly` 는 음수 여유에서 셋 다 start(0). 지우면 라인/아이템이 역방향으로 겹친다.
- `align-items` 에는 분배값이 없어 `place_line_cross_axis` 의 `cross_free` 는 클램프 없이 쓴다.
- Chrome 실측 기준값 — 컨테이너 100 / 아이템 300: `center` −100, `flex-end` −200. 컨테이너 cross 60 / 두 줄 합 100: `align-content:center` 줄 y = −20·30, `flex-end` = −40·10.
- Chrome 실측 fixture 2종 — **역할이 다르니 둘 다 갱신할 것**:
  - `crossAxisOverflow.browser.test.ts` — 규칙별 **기대 좌표를 명시**로 잠근다 (교차축 13 · main 6 · align-content 6 · 미결정 main 6 × engine·pipeline 2 leg). "무엇이 몇으로 틀렸나" 를 읽는 쪽.
  - `flexSweep.browser.test.ts` — 파라미터 격자를 **넓게** 훑는다 (1152 조합). "어딘가 틀렸다" 를 잡는 쪽. 음수 여유 조합의 민감도 실측: 라인 cross 승격을 `max` 로 되돌리면 교차축 48/576 red, 정렬 클램프를 되살리면 교차축 80/576 + main 32/576 red.

### 여유가 **없는 것**과 음수인 것은 다르다 — 미결정 main 센티넬 (2026-07-27)

여유 공간은 **definite main size 에서만** 산출된다 (CSS §9.7). `flex-direction:column` + `height:auto` 처럼 main 축 크기가 미결정이면 컨테이너가 내용으로 축소되므로 여유라는 개념 자체가 없고, `justify-content` 6종은 **전부 no-op** 이다. 위의 "음수 여유" 규칙과 **다른 상황**이다.

- 엔진은 미결정 main 을 **음수 센티넬**(`INDEFINITE_AVAIL = -1`)로 받는다. 그대로 빼면 `-1 − 내용합` 이라는 **가짜 음수 여유**가 생겨 위치 정렬이 자식을 컨테이너 **위로** 밀어내고, auto height 는 밀려난 만큼 줄어든다.
- 센티넬 가드는 main 축 소비 지점 **전부**에 있어야 한다: `resolve_flexible_lengths` / `collect_lines` / `place_line_main_axis` / main 축 auto margin 흡수(`tree.rs`). 셋은 원래 있었고 `place_line_main_axis` 만 없었는데, 분배값의 `.max(0.0)` 이 **결과적으로** 가려주고 있었다 — 위치 정렬에서 클램프를 걷어내자 드러났다.
- **실측(ListBoxItem origin)**: catalog `containerStyles.justifyContent:center` + `height:auto` 행에서 자식이 `(−1 − 76)/2 = −38.5` 만큼 위로 밀려 아이콘/라벨/설명이 행 밖으로 나가고 높이가 84 → 45.5 로 축소. `justifyContent` 가 없는 GridListItem 은 무증상이라 **비대칭**으로 나타났다.
- **`flexSweep` 는 이 축을 못 잡는다** — 컨테이너 main 을 항상 확정으로 주기 때문에 결함이 있어도 1152 조합 전부 green (실측). 미결정 main 은 `crossAxisOverflow.browser.test.ts` 의 `INDEFINITE_MAIN_CASES` 가 유일한 감시자다(되돌리면 center/end × 2 leg = 4 red).
- cross 축에는 같은 함정이 없다 — `place_line_cross_axis` 가 받는 `this_line_cross` 는 definite 면 컨테이너 cross, 아니면 라인 내용 max 라 **항상 실값**이다. `align_content` 는 `cross_is_definite` 로 이미 분기한다.

**grid 도 같은 규칙이되 표현이 다르다** — `solve_grid` 는 `height:auto` 일 때 트랙 sizing 을 위해 **상속 available 을 `container_h` 로 대입**한다(센티넬이 아니다). 그래서 `align-content` 여유를 `container_h − 트랙합` 으로 잡으면 없는 공간을 나눠 넣는다. 판정 기준은 `explicit_h > 0.0`(자기 height 가 definite) 이고, 그렇지 않으면 `align_content` 를 빈 문자열로 눌러 전달한다.

- **실측(2026-07-27)**: `height:auto` + `align-content:center` 그리드에서 트랙이 `(600−70)/2 = 265` 아래로 밀리고 컨테이너 높이가 `70 → 335`. `space-between` 은 `560 / 600`.
- 인라인 축(`justify-content`)은 대상 아님 — block 레벨 stretch 로 폭이 늘 definite 이다. shrink-to-fit 그리드가 생기면 그때 같은 판정을 붙인다.
- **잔존**: definite 높이 + auto 행에서 `align-content: normal`(= grid 에선 `stretch`)의 **auto 트랙 균등 분배**는 미구현. 실측 차이는 `gridAlignContent.browser.test.ts` 의 스냅샷(DOM 95 / engine 30)이 고정한다.

### 금지 패턴

- ❌ 라인 cross 승격을 `this_line_cross.max(available_cross)` 로 재도입 (§9.4 step 8 은 대입)
- ❌ 넘치는 아이템을 라인/컨테이너 크기로 **자르는** 보정 — 넘침은 흘러넘치는 것이 정상이고, 자르는 것은 `overflow` 소관
- ❌ 위치 정렬(center/end)에 클램프된 여유(`.max(0.0)`) 사용 → overflow 에서 조용히 start 로 무너진다
- ❌ 분배 정렬·`align-content:stretch` 에 클램프 없는 여유 사용 → 음수 분배로 역방향 겹침
- ❌ 두 계열을 한 변수로 통일 (`free_main`/`free_main_raw`, `cross_free`/`cross_free_raw` 쌍이 정본)
- ❌ main 축 available 을 **센티넬 가드 없이** 소비 (`available_main - total` 직접 사용) → 미결정 main 에서 가짜 음수 여유
- ❌ grid `align-content` 여유를 `container_h` 로 산출 (`height:auto` 면 상속값이라 가짜 여유) → `explicit_h > 0.0` 판정 필수
- ❌ 미결정 main 결함을 `flexSweep` 로 검증했다고 판단 — 그 격자는 main 을 항상 확정으로 준다

## 백분율 크기 — 두 축의 "definite" 조건이 다르다 (2026-07-27)

`%` 크기는 containing block 의 해당 축이 definite 일 때만 해소되고, 아니면 `auto` 다. **성립 조건이 축마다 다르다**:

| 축             | 부모가 definite available 을 내려주면 | 근거                                           |
| -------------- | ------------------------------------- | ---------------------------------------------- |
| 인라인 (width) | **확정**                              | block 레벨 자식은 부모 폭으로 stretch          |
| 블록 (height)  | **미확정**                            | `height:auto` 는 내용 크기 — 세로 stretch 없음 |

- 판정은 `explicit_h > 0.0` **하나**다. 상속 available(`avail_h >= 0`)은 높이를 확정하지 않는다 (CSS §10.5).
- **게이트는 두 경로에 다 있어야 한다** — `%` 를 푸는 ctx (`cross_ctx`/`main_ctx`) 와 **자식 재귀 solve 에 내려주는 available** (`child_containing_h`). 한쪽만 막으면 자식이 자기 `solve_node` 에서 상속 available 로 다시 해소한다. `solve_block` 은 원래 두 곳 다 있었고 `solve_flex` 는 둘 다 없었다.
  - 민감도 실측: ctx 게이트만 되돌리면 8 red(row 만), 재귀 available 게이트만 되돌리면 16 red(row+column).
- 폭 축의 `avail_w >= 0` 조항은 **유지**한다 — 지우면 stretch 부모 안의 `width:100%` 손자가 다시 수축한다 (DatePicker 2026-07-14). `percentSize.browser.test.ts` 의 `SHRINK_WRAP_CASES` 가 양쪽(stretch/shrink-wrap)을 같이 잠근다.
- **실측(2026-07-27)**: `flex(row, width:300, height 미지정)` 안의 `height:50%` 자식이 상속 600 의 절반인 300 (DOM 0). 컨테이너도 그만큼 부풀었다.

### 금지 패턴

- ❌ 두 축을 한 규칙으로 묶어 `explicit || avail >= 0` 판정 → 블록 축에서 가짜 확정
- ❌ `%` ctx 만 막고 자식 재귀 available 은 그대로 전달 (또는 그 반대) → 한 경로로 새어 나간다
- ❌ 폭 축에서 `avail_w >= 0` 제거 → stretch 부모의 `width:100%` 수축 회귀

## flex item 재-solve 는 **자기가 푼 available** 을 기준으로 한다 — `%` 의 세 번째 누수 경로 (2026-07-28)

`solve_flex` 3.5 는 item 의 used main 이 1차 solve 때 쓴 available 과 다르면 그 item 을 다시 푼다. 이 재-solve 는 `used_main` 을 **상속 available 로 내려주므로**, 발생 조건이나 override 범위가 틀리면 위 §백분율 규칙의 두 게이트를 **우회한다** — 게이트가 있어도 `%` 가 컨테이너의 content 크기에 풀린다.

| 결함                            | 형태                                  | Chrome | 구 엔진 |
| ------------------------------- | ------------------------------------- | -----: | ------: |
| fallback 이 음수 센티넬         | `column(h:auto)` 안의 `h=50%`         |     50 |  **25** |
| override 가 "해소된 값" 만      | `h=50% + maxH40`                      |     40 |  **20** |
| 커널 `cross_definite` 가 명시만 | `column(w:auto)` 안 auto-cross 스칼라 |    300 |  **90** |

- **fallback = 자식이 실제로 solve 된 main available**, 그것이 미결정이었으면 **content 크기**. 종전엔 음수 센티넬을 기준으로 잡아 auto 컨테이너에서 **항상** 재-solve 가 발생했고, 그 재-solve 가 위 누수를 열었다. 고치면 `used == content` 라 불필요 재-solve 자체가 사라진다 — 게이트 우회 경로가 소멸하는 형태다.
- **override 는 auto 가 아닌 모든 main 스타일**에 건다. "해소된 값" 만 override 하면 `main_ctx` 에서 못 푼 `%` 가 style 에 남아 재-solve 의 상속 available(=clamp 된 used 40)에 다시 풀린다 (`h=50%+maxH40` → 20. CSS 는 `%` → auto → content 50 → clamp 40).
- **커널 `cross_definite` 는 `cross_definite_self` 와 같아야 한다.** column 컨테이너의 cross(=width)는 명시가 없어도 block-level stretch 로 확정이다(§백분율 (b) 인라인 축). 커널 플래그만 `explicit_w` 를 보면 라인 cross 가 content 로 떨어지고, §9.4 step 11 stretch 가 auto-cross leaf 를 거기까지만 늘린다. **row cross(=height)는 블록 축이라 명시만 확정** — 축 비대칭은 유지된다.
- fixture: `basicAxisContainerSize.browser.test.ts` (ADR-170 격자 1). 민감도 — fallback 되돌리면 198키 / override 축소 12키 / `cross_definite` 되돌리면 12키 재발산.

### 금지 패턴

- ❌ 재-solve 발생 판정을 자식이 **받은** available 이 아니라 부모가 계산한 센티넬로 → auto 컨테이너에서 상시 발생
- ❌ 재-solve override 를 "해소된 값" 으로 한정 → 미해소 `%` 가 상속 available 에 다시 풀린다
- ❌ 커널 cross definite 판정을 `explicit_w` 단독으로 → column 의 stretch 확정 폭을 놓친다
- ❌ 이 누수를 §백분율 게이트 결함으로 진단 → 게이트는 정상이고 우회 경로가 문제다

## `margin: auto` 는 정렬보다 먼저 여유를 가져간다 — 흡수 단위는 **라인** (CSS-FLEXBOX-1 §8.1, 2026-07-27)

auto margin 은 해당 축의 양의 여유를 흡수하고, 그 결과 그 축의 정렬 속성은 **무효**가 된다. 세 규칙이 한 묶음이라 하나만 넣으면 나머지가 어긋난다:

| 규칙         | 내용                                                                      |
| ------------ | ------------------------------------------------------------------------- |
| §9.6 step 13 | cross auto margin 이 **라인** cross 여유를 균등 흡수 (음수 여유면 0)      |
| §9.6 step 14 | cross margin 중 하나라도 auto 면 `align-self` 무효                        |
| §9.4 step 11 | `stretch` 는 cross margin 이 **둘 다 auto 가 아닐 때만** 적용 (크기 유지) |
| §8.1 (main)  | main auto margin 흡수 시 `justify-content` 무효                           |

- **거처는 flex 커널** (`flex.rs::place_line_main_axis` / `place_line_cross_axis`) — 흡수량이 그 라인의 여유와 라인 cross 에 달려 있어 라인을 소유한 층이 아니면 계산할 수 없다. 구 구현은 tree.rs 후처리(step 3.8)로 main 축만, 그것도 **단일 라인 근사**여서 (a) cross 축은 통째로 미구현, (b) wrap 컨테이너는 main 축 흡수조차 없었다. tree.rs 에 auto margin 후처리를 재도입하면 커널 흡수와 **이중 적용**된다.
- **채널이 따로 있어야 한다**: `resolve_signed` 가 `auto` 를 0 으로 주므로 값만으로는 `margin: 0` 과 구분되지 않는다. flex 입력 off 20 `margin_auto_mask`(물리 4비트, 0=없음 zero-init)가 그 채널이고, 기록(`tree.rs::write_flex_item`)과 해석(`parse_item`)이 **같은 상수**(`flex::MARGIN_AUTO_*`)를 쓴다.
- 크기 계산(라인 cross, outer main 합)은 auto 를 **0 으로 본 값이 정답**이다 — 흡수는 배치 단계에서만 일어난다.
- **실측(2026-07-27)**: `align-items` 무엇이든 `marginTop:auto` 아이템이 y=0 (DOM 160) / `height:auto`+cross auto margin 이 라인 높이로 stretch (DOM 은 내용 0) / wrap 2줄에서 `marginLeft:auto` x=100 (DOM 150). 민감도 — cross 분기 무력화 38 red, main 흡수 무력화 20 red (`autoMargin.browser.test.ts` 79건 기준).
- **패널에서는 아직 authoring 불가**: Inspector margin 입력(`FourWayGrid.commitValue`)이 `replace(/[^0-9.-]/g, "")` 로 숫자만 남겨 `auto` 가 빈 값이 된다. catalog `containerStyles` 에도 auto margin 0건 — 그래서 이 발산이 오래 안 보였다. 반대로 preview/publish DOM 쪽 CSS 는 `margin-left:auto` 를 4곳(GridList/Tree/Toast/ChatMessage) 쓰고 있어, 그 offset 은 Skia 축에 대응물이 없다(D3 비대칭, 본 변경과 별개).
- **잔존**: grid item 의 auto margin 미구현. 단 그 케이스는 **선행 결함에 가려져 있다** — 명시 width 를 가진 grid item 이 트랙 폭으로 stretch 되는 ADR-156 §Residual 이 먼저 걸린다. 두 결함의 선후는 `autoMargin.browser.test.ts` 의 스냅샷이 고정한다.

### 금지 패턴

- ❌ tree.rs 후처리로 auto margin 재도입 → 커널 흡수와 이중 적용
- ❌ auto 판정을 margin **값이 0 인가**로 대체 → `margin: 0` 과 구분 불가
- ❌ 흡수량을 컨테이너 여유로 산출 → multi-line 에서 라인마다 여유가 다르다
- ❌ cross auto margin 을 넣으면서 stretch·align-self 억제를 빼기 (§9.4 step 11 / §9.6 step 14 는 같은 묶음)
- ❌ 음수 여유에서 auto margin 에 음수 분배 → 0 흡수 = 아이템이 라인 시작에 붙고 넘치는 것이 정답

## `*-reverse` 는 위치만 뒤집는다 — margin 의 축 역할은 별도로 바꿔야 한다 (2026-07-27)

엔진은 `flex-direction: *-reverse` / `flex-wrap: wrap-reverse` 를 **정방향 배치 + 기하 반사**로 구현한다 (`tree.rs` 3.9 — 커널은 reverse 를 모른다). 반사는 좌표를 뒤집지만 **margin 이 아이템의 어느 쪽에 붙는지**는 못 바꾼다.

- `row-reverse` 의 main-start 는 **오른쪽**이므로 main-start margin = physical `margin-right` 다. 물리 margin 을 그대로 커널에 넘기면 커널이 `margin-left` 를 main-start 로 써서, 반사 후 margin 이 반대편에 남는다.
- 그래서 `write_flex_item` 이 **반전 축의 물리 margin 쌍을 맞바꿔** 커널에 정방향 논리로 넘긴다 (`MarginAxisReverse::vertical/horizontal` — 논리축↔물리축 매핑이 `is_row` 에 달려 있어 호출부가 직접 계산하지 않는다). **값과 auto 마스크를 같이** 뒤집어야 흡수 쪽도 맞는다.
- **auto margin 과 무관한 결함**이다 — 고정 margin 에서도 재현되고, 어긋남이 **정확히 margin 값**이라 진단이 쉽다. 실측: `row-reverse`+`marginLeft:20px` DOM 260/구 엔진 240 · `column-reverse`+`marginTop:20px` 160/140 · `wrap-reverse`+`marginTop:20px` 260/240.
- 컨테이너 수준 정렬(`justify-content`)과 비대칭 padding 은 **종전에도 정합**이었다 — 반사 자체는 정상이고 어긋난 것은 아이템별 margin 의 축 역할 하나다. 두 대조군이 `reverseMargin.browser.test.ts` 에 들어 있는 이유다(민감도: 스왑을 되돌리면 18/44 red, `autoMargin` 은 전부 green 유지).

### 금지 패턴

- ❌ reverse 를 커널에 알려 커널이 직접 배치 방향을 바꾸게 하기 → 반사(3.9)와 이중 적용
- ❌ margin 값만 스왑하고 auto 마스크는 그대로 → 흡수가 반대편에서 일어난다
- ❌ 스왑 축을 `is_row` 없이 판정 → column 계열에서 main/cross 가 뒤바뀐다 (`flex-direction:column-reverse` 는 **세로** 쌍, `wrap-reverse` 는 **가로** 쌍)

## 그리드 영역은 containing block 일 뿐 — 자식 크기를 강제하지 않는다 (2026-07-28)

grid item 의 크기·위치는 **자식 자신의 상자 모델**이 정하고, 영역(셀)은 그 기준면일 뿐이다 (CSS-GRID §10.1/§10.2 + CSS-ALIGN-3 §4.1/§4.2). 종전 엔진은 네 갈래로 어긋나 있었고, 넷 다 `solve_grid` 의 자식 배치 블록 한 곳에 있었다:

| 결함                              | 실측 (트랙 150)                             | CSS             |
| --------------------------------- | ------------------------------------------- | --------------- |
| 명시 크기 무시 → 트랙 폭 stretch  | `width:40px` → **150**                      | 40              |
| margin 미소비 (양축)              | `marginLeft:20px` → x=**0**                 | x=20            |
| auto margin 미흡수                | `marginLeft:auto` → x=**0**                 | x=110           |
| 자식 min/max 미적용 + 넘침을 자름 | `maxWidth:60` → **150** / `width:300` → 150 | 60 / 300 (넘침) |

- **거처는 `place_grid_axis` 하나** — 가로/세로가 완전 대칭이라 한 함수로 둔다. 축마다 따로 두면 한쪽에만 규칙이 붙는데, **실제로 그랬다**: 세로축은 "explicit 크기가 stretch 를 이긴다"(ADR-156 옵션 3-a)를 받았고 가로축은 못 받았다.
- **min/max 는 grid 만 빠져 있었다** — block·flex 부모에서는 각 커널이 이미 적용한다. 부모 3종 대조가 진단 도구다 (실측: block·flex 10/10 정합 vs grid 5/5 발산 — 같은 자식 스타일).
- **넘치는 아이템은 자르지 않는다**. 구 `.min(cell)` 클램프는 `min-width` 가 셀을 넘기는 경우까지 삼켰다. 위치 정렬(center/end)이 음수 offset 인 것도 flex 축과 같은 규칙(§4.2 `unsafe`).
- **트랙 폭 ≠ 자식 폭**. 이 혼동이 Rust golden 2건에 그대로 굳어 있었다 (`grid_mixed_px_and_auto_columns_preserve_px` / `grid_progressbar_realstruct_row_and_col_auto` — 자식 폭에 트랙 폭을 기대). 트랙 폭의 근거는 **형제의 x 좌표**가 대신 증명한다.
- 민감도 (`gridItemBox.browser.test.ts` 113건 기준): explicit 규칙 104 red / margin 14 / min·max 10 / 넘침 6.
- **잔존 2건** (같은 fixture 가 고정): ① 내용 없는 auto-width 자식의 shrink-to-fit (엔진은 0 붕괴 방지로 셀을 채운다 — 측정 협업 영역) ② **block-level** 박스의 `justify-self` 미지원 (CSS-ALIGN §5.1 은 block 에도 적용 — 별개 코드 경로). 구 잔존 ②(stretch-fit definite 판정)는 2026-07-28 해소 — §그리드 자신의 min/max-content.

### 금지 패턴

- ❌ 가로/세로 배치를 각각 인라인으로 재구현 → `place_grid_axis` 단일 함수 (비대칭이 이 결함의 원인이었다)
- ❌ 자식 크기를 셀 크기로 클램프 → 넘침이 정상 (`overflow` 소관)
- ❌ grid 에서 자식 min/max 생략 — 커널이 안 해준다 (block/flex 와 다르다)
- ❌ `real_size <= 0` 폴백 제거 → 빈 컨테이너가 캔버스에서 사라진다 (0 붕괴 방지, 의도된 잔존)
- ❌ 자식 폭 assertion 에 트랙 폭 기대 → 트랙 근거는 형제 x 좌표로

## `auto` 트랙은 내용 크기가 **하한**일 뿐 — 남는 여유를 나눠 갖는다 (CSS-GRID-1 §12.8, 2026-07-28)

축의 content-distribution 이 `normal`/`stretch` 일 때, 남는 **definite** 여유는 max 트랙 sizing 이 `auto` 인 트랙들에 **균등 분배**된다. 엔진은 auto 트랙을 자식 intrinsic 으로 측정한 뒤 거기서 멈춰 있었다 — 컨테이너가 트랙 합보다 커도 트랙이 자라지 않았다.

| 조건                                     | 결과                                     |
| ---------------------------------------- | ---------------------------------------- |
| distribution = `normal`/`stretch`/미설정 | auto 트랙에 여유 균등 분배               |
| `start`/`center`/`end`/`space-*`         | 트랙은 내용 크기 유지, **트랙셋**을 정렬 |
| `fr` 트랙 공존                           | fr 이 여유를 먼저 흡수 → auto 는 내용    |
| 여유 음수(넘침) / 축이 indefinite        | no-op — 트랙을 줄이지도 않는다           |

- **거처는 `solve_grid` 의 측정 직후** (`stretch_auto_tracks`, tree.rs). 측정이 `auto` 토큰을 `{n}px` 로 치환해 버리므로 **어느 트랙이 auto 였는지 인덱스로 따로 들고 가야 한다** (`row_auto_idx`/`col_auto_idx`). 치환 후 토큰만 보면 px 트랙과 구분이 안 된다.
- 참여 자격은 **max 트랙 sizing 이 `auto`** 하나다. `px`/`%`/`minmax(_, px)` 는 빠진다 — 실측 `auto minmax(50px,80px)` / 300 에서 minmax 는 80, auto 가 220. `fr` 은 별도 조건이 필요 없다: fr 이 여유를 전부 흡수해 `free == 0` 이 되므로 **자동으로** no-op 이다.
- **definite 판정은 `explicit_*` 하나** — `align-content` 게이트와 같은 근거이자 같은 신호다 (여유는 definite size 에서만 생긴다). `height:auto` 그리드, flex item 그리드 모두 stretch 없음.
- **가로축 게이트는 2026-07-28 에 넓어졌다**: 종전엔 `explicit_w > 0.0` 하나였다 — block-level `width:auto` 그리드는 CSS 상 stretch-fit 이라 definite 인데 엔진에 그 신호가 없었기 때문이다. 지금은 `inline_intrinsic`(§그리드 자신의 min/max-content)이 shrink-to-fit 여부를 주므로 `explicit_w > 0.0 || (inline_intrinsic.is_none() && avail_w >= 0.0)` 로 판정한다. 세로축은 그대로 — `height:auto` 는 진짜 미결정이다.
- **암묵 트랙**(`gridTemplateRows` 미명시)도 대상이다 — 크기를 정하는 건 `grid-auto-rows`(기본 `auto`)이므로, 고정 크기를 지정했으면 제외한다.
- Chrome 실측 fixture: `gridAutoTrackStretch.browser.test.ts` (61 정합 + 규칙 요약 + 잔존 2). 민감도 — stretch 무력화 35 red / distribution 게이트 제거 31 red / definite 게이트를 상속 available 로 완화 5 red.
- 라이브 영향: 카탈로그 grid 4곳(ProgressBar/Slider)이 전부 `1fr auto` 라 free==0 → no-op, 행은 암묵 auto 지만 컨테이너 높이가 auto 라 게이트에 걸린다.
- **암묵 트랙의 크기는 `grid-auto-rows` 가 정한다** (기본 `auto`, 값이 여러 개면 순환). 종전엔 암묵 행을 자식 intrinsic 으로만 재서 px 로 박아 `gridAutoRows` 가 통째로 무시됐다 (실측 `30px` → DOM 30 / 엔진 20). 지금은 명시 트랙과 **같은 해소기**(§12.5 기여)를 태워 `30px` / `min-content` / `minmax(auto,60px)` 가 한 규칙으로 처리되고, 고정 크기면 `auto` 가 아니라 §12.8 stretch 대상에서도 빠진다. 민감도 — 해소기를 빼고 측정값을 그대로 박으면 4 red.

### 금지 패턴

- ❌ 측정으로 px 치환된 뒤 토큰 문자열로 auto 여부 판정 → 인덱스(`*_auto_idx`)가 유일한 근거
- ❌ `fr` 을 stretch 대상에서 명시적으로 제외하는 분기 추가 → free==0 으로 이미 no-op, 중복 조건은 규칙만 흐린다
- ❌ definite 판정을 `container_*`(상속 available)로 완화 → `height:auto`/flex item 그리드가 없는 공간을 나눠 갖는다
- ❌ 여유가 음수일 때 트랙 축소 → §12.8 은 **확대만** 한다 (넘침은 넘치는 게 정상)
- ❌ distribution 게이트 생략 → `start`/`center`/`end` 에서 트랙이 자라 정렬이 무의미해진다

## `minmax()` 트랙은 상한까지 자란다 — 트랙 sizing 은 3단계다 (CSS-GRID-1 §12.6, 2026-07-28)

트랙 크기는 base size 에서 끝나지 않는다. 남는 공간이 있으면 **세 단계**가 순서대로 돈다:

| 단계  | 대상                 | content-distribution 게이트 | 거처                                 |
| ----- | -------------------- | --------------------------- | ------------------------------------ |
| §12.6 | `minmax(_, px)`      | **없음** — 항상 돈다        | `grid.rs::maximize_tracks`           |
| §12.7 | `fr`                 | 없음                        | `grid.rs::resolve_grid_tracks` 2단계 |
| §12.8 | max sizing 이 `auto` | `normal`/`stretch` 에서만   | `tree.rs::stretch_auto_tracks`       |

- **§12.6 은 정렬과 무관하다** — `justify-content:start` 여도 `minmax(50px,80px)` 는 80 까지 자란 뒤 트랙셋이 좌측 정렬된다(실측). §12.8 만 게이트가 있다. 셋을 "여유 분배" 한 덩어리로 묶어 생각하면 이 차이를 놓친다.
- 분배는 **균등 + freeze + 재분배**다. 상한에 닿은 트랙은 얼리고 남은 몫을 나머지에 다시 나눈다 (실측 `minmax(0,200) minmax(0,50)` / 300 → 200·50, 남는 50 은 §12.8 대상이 없어 **미분배로 남는다**).
- 대상은 **definite growth limit**, 즉 `minmax(_, px)` 뿐이다. `fr`/`auto` 는 상한이 유한하지 않아 §12.7/§12.8 소관이고, 여기서 같이 키우면 이중 적용된다. px/% 는 base == limit 이라 여지가 없다.
- **부작용이 컸던 곳은 fr 쪽이었다**: 구 코드는 minmax 를 base(=min)에 둔 채 fr 여유를 `container - min` 으로 잡아, 트랙 합이 컨테이너를 넘었다 (`minmax(100px,150px) 1fr` / 400 → 150+300 = **450**). 그래서 §12.6 을 넣으면 fr 분배식도 같이 맞아 떨어진다 — 성장분을 뺀 `container - Σsize` 가 정본.
- Chrome 실측 fixture: `gridMinmaxTracks.browser.test.ts` (46 정합 + 합-초과 회귀 + 잔존 1). 민감도 — §12.6 무력화 43 red.
- 라이브 영향 없음: catalog 및 앱 소스에 `minmax(` 사용 0건 (실측 grep).
- base size 를 자식 content 로 채우는 앞 단계(§12.5)는 아래 §"트랙 크기는 자식의 content 기여에서 나온다" 소관이다.

### 금지 패턴

- ❌ `fr`/`auto` 를 §12.6 대상에 포함 → §12.7/§12.8 과 이중 적용
- ❌ §12.6 에 content-distribution 게이트 부착 → `start`/`center` 에서 minmax 가 안 자란다 (§12.8 과 혼동)
- ❌ fr 여유를 `container - Σmin` 으로 산출 → 성장분 미반영으로 트랙 합이 컨테이너를 넘는다
- ❌ freeze 없이 한 번만 균등 분배 → 상한 초과분이 다른 트랙으로 흘러가지 않는다
- ❌ 트랙 폭 assertion 을 자식 폭으로 확인 → 트랙 근거는 **형제의 x 좌표** (§그리드 영역은 containing block)

## 트랙 크기는 자식의 **content 기여**에서 나온다 (CSS-GRID-1 §12.5, 2026-07-28)

`<track-size>` 는 언제나 min·max **두 개**의 sizing function 이고, 단일 값은 CSS 가 펼쳐 준다: `auto` = `minmax(auto, auto)` · `1fr` = `minmax(auto, 1fr)` · `min-content` = `minmax(min-content, min-content)` · `fit-content(L)` = `minmax(auto, fit-content(L))`. 그리고 **자리에 따라 `auto` 의 뜻이 다르다** — min 자리는 자동 최소 크기(=min-content 기여), max 자리는 max-content 기여.

| 자리 | `auto`           | `min-content` | `max-content` | `fit-content(L)`           |
| ---- | ---------------- | ------------- | ------------- | -------------------------- |
| base | min-content 기여 | min-content   | max-content   | (min 자리에 올 수 없음)    |
| 상한 | max-content 기여 | min-content   | max-content   | clamp(min-content, L, max) |

- **거처는 tree.rs** (`resolve_track_with_contribution`) — 자식을 아는 층이 content 함수를 px 로 풀어 `grid.rs` 에 넘기고, grid.rs 는 **확정된 트랙만** sizing 한다. 모듈 헤더의 "자식 intrinsic → 트랙 크기 도출은 트리 레벨 책임" 계약과 같은 방향이며, 그래서 `grid_layout` 의 wasm 시그니처가 그대로다.
- **인라인 축은 두 값이 갈려야 한다.** 자식 min 40 / max 120, 두 열에서 컨테이너를 바꾸면 한 측정값으로는 못 맞춘다 — 150 → 75·75(§12.6 균등, 상한 미도달) / 300 → 150·150(§12.6 이 120 에서 freeze 후 §12.8 이 60 분배) / 500 → 250·250. 구현은 `measure_intrinsic_width`(ADR-169) 를 그대로 재사용한다.
- **블록 축은 `(h, h)`** — 높이는 폭이 정해진 뒤의 내용 크기 하나라 두 값이 갈리지 않는다. `auto` row 는 종전대로 측정값에 고정되고, 달라지는 것은 `minmax(auto, px)` row 의 base 뿐이다.
- **§6.6 자동 최소 크기 clamp 는 아이템 단위**다. "고정 max 트랙만 span 하는" 아이템의 content-based minimum 은 그 상한으로 잘리지만, **아이템의 선호 크기가 `auto` 처럼 동작할 때만**이다. 트랙 토큰만 보고 판정하면 틀린다 — 실측(트랙 `minmax(auto,20px)`, 내용 min 40): `width:auto`→**20** · `width:90px`→**90** · `min-width:70px`→**70** · `width:50%`→20 · `width:fit-content`→20. 트랙 쪽 조건도 좁다: min sizing 이 **`auto` 일 때만** 이고(`minmax(min-content,20px)`→40), max 는 **고정 길이**여야 한다(`%` 포함 — `minmax(auto,10%)`→30 / `1fr`·`fit-content()` 는 clamp 없음).
- `minmax()` 안의 `%` 는 grid.rs 가 **파싱 시점에** container 로 푼다. 종전엔 `%` max 가 `-1`(=1fr)로 떨어져 `minmax(auto,10%)` 가 여유를 전부 먹었다(DOM 30 / 엔진 200).
- 토큰화는 tree.rs 도 `grid::tokenize_template` 을 쓴다 — `split_whitespace` 는 `minmax(50px, 80px)` 처럼 **내부에 공백이 있는** 토큰을 쪼갠다.
- Chrome 실측 fixture: `gridTrackContribution.browser.test.ts` (engine 38 + row 7 + 규칙 요약 2 + pipeline 대조 2 + 잔존 1). 민감도 — min/max 기여를 한 값으로 합치면 14 red / §6.6 clamp 무력화 2 red / clamp 의 auto-min 게이트 제거 1 red / `minmax` % 해석 제거 1 red.
- 라이브 영향: catalog 의 content 기반 트랙은 `1fr auto` 4곳(ProgressBar/Meter/Slider)뿐이고, `auto` 열은 §12.6 이 max-content 까지 키워 종전과 같은 값에 수렴한다(실측 `1fr auto`/320 → 180·120).
- TS 층의 공급 결함 3건은 아래 §grid 자식의 TS 공급 3결함 참조 — 엔진이 준비돼도 그쪽이 끊기면 텍스트 leaf 가 0 으로 무너진다.

### 금지 패턴

- ❌ 트랙 토큰만 보고 §6.6 clamp 판정 → 아이템의 선호 크기(`auto`/%/`fit-content` 여부)가 조건의 절반이다
- ❌ min sizing 이 `min-content`/`max-content` **명시**인데 clamp 적용 → §6.6 은 _자동_ 최소 크기 규정이다
- ❌ 인라인 축 기여를 단일 값으로 축약 → 여유 구간에 따라 트랙이 base↔상한 사이에서 움직이지 못한다
- ❌ content 함수 해소를 grid.rs 로 이동 → grid.rs 는 자식을 모른다 (측정 주체는 tree.rs)
- ❌ tree.rs 에서 트랙 문자열을 `split_whitespace` 로 분해 → 괄호 안 공백에서 깨진다

## 단독 `fr` 도 base 를 갖는다 — §12.7.1 freeze-restart (CSS-GRID-1 §7.2.4/§12.7.1, 2026-07-28)

위 §12.5 표가 적어 둔 `1fr` = `minmax(auto, 1fr)` 이 **파서에는 없었다**. `split_track_sizing` 이 단독 `fr` 을 min 자리 없는 flexible 로만 갈라, 기여 machinery 가 base 를 채울 자리가 없었다. 그래서 `fr` 트랙이 자식 내용보다 작아졌고, 2단계 분배도 base 를 모르는 근사("min 보장 + share 가산")였다.

| 형태                                 |   CSS |   구 엔진 |
| ------------------------------------ | ----: | --------: |
| `1fr 1fr` / 컨테이너 120, 기여 90·30 | 90·30 | **60·60** |
| `1fr 1fr` / min-content 모드 (합 70) | 40·30 | **35·35** |
| `grid-auto` + 자식 `marginLeft:10px` |   165 |   **160** |

- **파싱**: 단독 `fr` → `(Auto, Definite(fr))`. min 자리가 `Auto` 라 §12.5 기여 경로가 base(min-content 기여)를 공급한다.
- **2단계는 freeze-restart**: `hf = leftover / Σfactor` (Σ < 1 이면 1 로 본다) → `hf × factor` 가 base 를 밑도는 트랙은 **base 로 freeze** 하고 남은 여유로 재시작. 전부 frozen 이면 base 를 그대로 쓴다. 이 알고리즘이 있어야 **재계산이 같은 값을 재현**한다 — §shrink-to-fit 재진입에서 트랙을 얼리지 않아도 되는 근거가 이것이다.
- **기여는 margin-box** (§12.5): `col_contribution` 이 가로 margin 을 min·max 양쪽에 더한다. `%` margin 은 지금 구하려는 크기가 기준이라 순환 — **0 으로 본다**. 종전엔 누락된 margin 이 §12.8 균등 분배로 갈라져 정확히 절반씩 어긋났다.
- fixture: `basicAxisContainerSize/ChildSize.browser.test.ts` — 되돌리면 232키 재발산 (D+H 합산). `gridContainerIntrinsic.browser.test.ts` 의 "§12.7.1 제거 25 red" 도 같은 알고리즘을 잠근다.

### 금지 패턴

- ❌ 단독 `fr` 을 min 자리 없이 파싱 → 기여 base 가 공급될 자리가 없다
- ❌ 2단계를 "min 보장 + share 가산" 으로 근사 → base 이중 반영 또는 base 없는 균등 분배
- ❌ 트랙 기여를 content-box 로 산출 → margin 이 §12.8 여유로 흘러 절반씩 갈라진다
- ❌ 기여 계산에서 `%` margin 을 해소 시도 → 순환 (0 이 정본)

## grid 자식의 TS 공급 3결함 — 스칼라 / 트랙 수 / 가정 폭 (2026-07-28)

엔진이 트랙 content 기여를 소비할 준비가 돼도(§트랙 크기는 자식의 content 기여) TS 층이 셋을 잘못 넘기고 있었다. 셋 다 **grid 자식에서만** 드러나며, 증상이 서로 달라 따로 봐야 한다.

| 결함                         | 거처                                | 증상                                                      |
| ---------------------------- | ----------------------------------- | --------------------------------------------------------- |
| 측정 스칼라 미공급           | `utils.ts` `needsWidth` 절          | content 트랙 안 텍스트 leaf 폭 **0**                      |
| 트랙 수를 **문자 수**로 셈   | `fullTreeLayout.ts` DFS grid 추정   | 자식 available 이 1/N 로 쪼그라들어 줄바꿈 높이 과대      |
| Step 4.5 가 가정 폭을 역추정 | `fullTreeLayout.ts` Step 4.5 트리거 | 비균등 트랙에서 재측정 자체가 안 돌아 좁은 폭 높이가 굳음 |

- **스칼라**: 주입 조건이 `isFlexChild && TEXT_LEAF_TAGS.has(type)` 였다. block 자식은 stretch 되어 스칼라가 없어도 되지만 grid 는 트랙이 content 로 정해질 수 있다. `isFlexChild` **자체를 넓히면 안 된다** — 같은 플래그가 `growsInFlex`(flex-grow 억제)와 non-container `minWidth` 주입에도 쓰인다. 스칼라 조건에만 `isGridChild` 를 별도로 쓴다.
- **트랙 수**: catalog 는 `gridTemplateColumns: "1fr auto"` 처럼 **문자열**로 저장한다. 그대로 `.length` 를 세면 8(문자 수)이 나온다 — `coerceGridTrack` 으로 배열 정규화 후 센다. gap 도 `columnGap` 을 먼저 읽어야 한다 (store 는 longhand 만 — style-ssot.md).
- **가정 폭**: Step 4.5 는 "enrichment 가 가정한 폭" 과 실배치 폭을 비교해 재측정 여부를 정하는데, 그 가정 폭을 style 로부터 역추정하면 grid 에서 어긋난다(부모 폭이 아니라 **트랙 추정폭**을 넘겼으므로). DFS 가 `enrichAvailWidth` 로 실제 사용값을 batch 노드에 남기고 트리거가 그것을 읽는다. WASM payload 는 `{style, children}` 만 뽑으므로 직렬화되지 않는다.
- 셋이 겹쳐 있어 **한 결함의 fixture 가 다른 결함을 가린다** — 실측: 가정 폭을 고치면 트랙 수 결함이 재측정으로 흡수되어 parity 가 전부 green 이 된다. 그래도 트랙 수는 고쳐 둔다(재측정이 못 도는 경로의 1-pass 정확도).
- catalog 컴포넌트가 멀쩡했던 것은 값 자식이 `fit-content` 를 달고 있어 `hasExplicitIntrinsicWidthKeyword` 로 우회했기 때문이다 — 정상 동작이 **우연**이었다.
- Chrome 실측 fixture: `gridTrackContribution.browser.test.ts` pipeline 그룹 (content 트랙 4 + 대조군 2 + 비균등 재측정 7 + 잔존 2). 민감도 — 스칼라 게이트 5 red / 가정 폭 2 red.
- grid item 의 **width 키워드**도 stretch 대상이 아니다 — 아래 §grid item 의 크기 키워드.

### 금지 패턴

- ❌ `isFlexChild` 를 grid 포함으로 재정의 → flex-grow 억제·minWidth 주입까지 grid 자식에 번진다
- ❌ 텍스트 leaf 에 width 를 다시 주입해 우회 → ADR-165 스칼라 계약과 이중 적용 (§TS 잔존 계약)
- ❌ `gridTemplateColumns` 를 정규화 없이 `.length` 로 세기 → 문자열 저장 형태에서 문자 수가 나온다
- ❌ Step 4.5 의 가정 폭을 style 로부터 역추정 → grid 자식에서 트랙 추정폭과 어긋난다

## grid item 의 크기 키워드도 stretch 를 이긴다 (CSS-ALIGN-3 §4.1, 2026-07-28)

`justify-self`/`align-self` 의 stretch 는 "the item's size in that axis is **`auto`**" 일 때만 적용된다. `fit-content` / `min-content` / `max-content` 는 auto 가 아니므로 셀 폭으로 늘어나지 않는다.

- 판정 신호가 **크기 값 하나**면 안 된다. `place_grid_axis` 의 `explicit` 은 `resolve_self_size` 결과(`child_ew > 0.0`)로 정해지는데, 그 함수는 키워드를 길이로 풀 수 없어 **0** 을 돌려준다 — 미설정과 구분되지 않아 키워드가 stretch 로 떨어졌다. `size_is_intrinsic_keyword` 를 OR 로 더한다.
- 실측(트랙 150, 자식 min-content 40 / max-content 120): `fit-content` DOM 120 / 구 엔진 150 · `min-content` 40 / 150 · `max-content` 120 / 150. **`auto` 는 종전에도 정합**(150 = 트랙 폭)이라 어긋난 것은 키워드 축 하나다.
- 같은 자식이 **flex 부모에서는 120·40 으로 정상**이었다 — 이 비대칭이 진단 신호이자 fixture 의 대조군이다.
- 명시 px(`width:40px`)는 이미 존중받고 있었다 (§그리드 영역은 containing block). 즉 "확정 크기" 개념이 px 에만 걸려 있었던 것.
- Chrome 실측 fixture: `gridTrackContribution.browser.test.ts` I 그룹 (키워드 4 × 부모 3 = 12). 민감도 — 키워드 OR 를 빼면 7 red.

### 금지 패턴

- ❌ stretch 대상 판정을 해소된 길이 값(`> 0.0`)만으로 하기 → 키워드가 미설정과 같아진다
- ❌ 키워드를 미리 길이로 치환해 우회 → 셀 크기가 정해지기 전이라 값이 없다 (판정은 style 문자열, 크기는 `solve_node` 결과)

