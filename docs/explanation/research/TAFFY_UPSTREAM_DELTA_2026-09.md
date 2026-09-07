# Taffy upstream 대조 — 0.10.0 → 0.14.0 (2026-09-07)

> `packages/composition-engine` 은 Taffy 0.10.0 을 참조해 자체 구현한 Rust 레이아웃 엔진이다 (의존 0, ADR-916). Taffy 가 그 뒤 5개 릴리스에서 고친 항목을 엔진과 대조하고, 의심 항목은 Chrome 차등 하니스 (`tests/parity/harness.ts` `domLeg` vs `engineLeg`) 로 실측했다. **오라클은 Chrome 이다** — Taffy 가 고쳤다는 사실이 아니라 Chrome 과 어긋나는지가 판정 기준이다.
>
> - Taffy 릴리스: 0.10.1 (2026-04-14) · 0.11.0 (06-12) · 0.12.0~~0.12.2 (07-03~~07-15) · 0.13.0 (08-08) · 0.14.0 (08-24). 출처 `CHANGELOG.md` (main).
> - 엔진이 마지막으로 참조한 판: 0.10.0 (2026-03-31, 구 `composition-layout` crate `Cargo.lock`).

## 0. 요약

| 구분                                             | 수  | 내용                                                                                                                                    |
| ------------------------------------------------ | --- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Taffy 변경 항목 중 엔진 모델 안에 있는 것        | 37  | flex 12 · grid 12 · block/abs/cache 13 (API·enum 변경 제외)                                                                             |
| 실측 케이스                                      | 24  | 아래 §2                                                                                                                                 |
| **Chrome 과 어긋남 확정**                        | 19  | §2 `!!` 행                                                                                                                              |
| 엔진이 이미 맞는 것 (정적 판정이 틀렸던 것 포함) | 5   | flex item aspect-ratio + stretch · `self-start` · auto margin + 음수 여유 · `minmax(60px,auto)` (2026-07-25 preset 회피 사례) · 캐시 키 |
| 모델 밖 (입력 자체가 없음 — 판정 대상 아님)      | 6   | float/clear · `contain` · scroll overflow rect · `flex-wrap: balance` · replaced element · writing-mode                                 |

**착수 권고 1순위 (production 도달 + 어긋남 큼)**: ① 늘어난 flex item / grid area 의 cross 크기가 자손 `%` 의 base 가 되지 않음 (Taffy #1003·#1123) ② grid 명시 배치가 explicit grid 를 넘으면 10,000 행으로 텔레포트 (#1036·#1037) ③ abs-pos used size 가 min/max clamp 를 무시 (#1096 계열) ④ template 없는 `display:grid` 의 암묵 열이 100px 고정.

## 1. 실측 방법

- 임시 파일 `tests/parity/zzTaffyDeltaProbe.browser.test.ts` (삭제됨 — 재현은 §6 fixture 로) 에 24 케이스를 실어 `vitest run --config vitest.browser.config.ts` 로 1회 실행. DOM leg 은 실 Chrome `getBoundingClientRect`, engine leg 은 같은 style 을 `buildTreeBatch` 에 그대로 전달. 허용 오차 1px.
- 텍스트가 없는 순수 기하 케이스만 — ADR-165 스칼라 채널을 타지 않아 두 leg 이 같은 입력을 본다.

## 2. 실측 결과 (dom → eng, root 상대 px)

`!!` = 어긋남. 좌표는 `(x, y, w, h)`.

| #     | 케이스                                                      | 노드  | Chrome                 | 엔진                     | 판정                                                                                           |
| ----- | ----------------------------------------------------------- | ----- | ---------------------- | ------------------------ | ---------------------------------------------------------------------------------------------- |
| F5    | `flex row h200` > item(auto) > child `h50%`                 | child | (0,0,40,**100**)       | (0,0,40,**0**)           | !! stretch 된 item cross 가 definite 로 전달 안 됨 (Taffy #1003/#1123)                         |
| F3    | `flex row h200 align stretch` > item `w100 aspect-ratio 1`  | item  | (0,0,100,200)          | (0,0,100,200)            | 일치 — Chrome 도 stretch 가 ratio 를 이긴다 (정적 판정 철회)                                   |
| F8a   | `align-items: self-start`                                   | item  | (0,0,100,50)           | (0,0,100,50)             | 일치 (미인식 → start 폴백이 우연히 같음. `self-end` 는 미확인)                                 |
| F8b   | `justify-content: safe center`                              | item  | (**150**,0,100,50)     | (**0**,0,100,50)         | !! `safe` 접두 미파싱 → start (Taffy #952)                                                     |
| F10   | 가운데 정렬 flex 300² > abs child 50² (inset 없음)          | abs   | (**125,125**,50,50)    | (**0,0**,50,50)          | !! static position 을 block 흐름으로 근사 — Flexbox §4.1 위반 (Taffy #1072)                    |
| F4    | `align-items: baseline`, 높이 30/60                         | a     | (0,**30**,50,30)       | (0,**0**,50,30)          | !! `baseline` 키워드 자체가 없음 (#1109·#1127 의 전제)                                         |
| F6    | `w100 justify center` > item `w300 margin-left auto`        | item  | (0,0,100,20)           | (0,0,100,20)             | 일치                                                                                           |
| B1d   | `grid rows 200px` > item > child `h50%`                     | child | (0,0,40,**100**)       | (0,0,40,**0**)           | !! grid area 높이가 손자 `%` base 로 전달 안 됨                                                |
| B4    | abs `left0 right0 w300 max-w100 margin auto`                | abs   | (**150**,0,**100**,20) | (**50**,0,**300**,20)    | !! `resolve_dimension` 이 clamp 결과를 덮어씀 (`tree.rs:1992-1998`)                            |
| B4c   | abs `left0 right0 max-w100` (width auto)                    | abs   | (0,0,**100**,20)       | (0,0,**400**,20)         | !! stretch 경로에 min/max 없음 (`tree.rs:5401-5404`)                                           |
| B8    | `display:flow-root` > child `margin-top 40`                 | fr    | (0,0,400,**50**)       | (0,0,400,**10**)         | !! flow-root 가 BFC 를 만들지 않아 margin 이 새어 나감 (Taffy #997)                            |
| B6    | block leaf `aspect-ratio 2` (width auto) in w300            | leaf  | (0,0,300,**150**)      | (0,0,300,**0**)          | !! 자식 없는 block 은 `aspect_needs_w` 분기 밖 (`tree.rs:1686`)                                |
| B6c   | 위 + 손자 `h50%`                                            | inner | (0,0,20,**75**)        | (0,0,20,**0**)           | !! ratio 로 파생한 높이가 definite 로 전달 안 됨 (Taffy #965)                                  |
| B5    | block `h200 align-content center` > child h50               | child | (0,**75**,400,50)      | (0,**0**,400,50)         | !! block `align-content` 미모델 (Chrome 123+, Taffy #959)                                      |
| B3x   | abs container `padding-top 10%` (CB 400×100)                | abs   | (0,0,100,**50**)       | (0,0,100,**20**)         | !! 자식 위치는 폭 기준 40 으로 맞는데 상자 높이는 높이 기준 10 으로 잰다 (`tree.rs:2006-2011`) |
| G12   | `display:grid w400` template 없음 > item                    | item  | (0,0,**400**,20)       | (0,0,**100**,20)         | !! 암묵 열 폴백 100 (`grid.rs:681-683`) — 정폭 grid 에서 암묵 열을 만들지 않음                 |
| G3    | `[a] 1fr [b] 1fr [c]`                                       | a     | (0,0,**150**,20)       | (0,0,**60**,20)          | !! 대괄호 라인 이름이 `auto` 트랙 3개로 파싱 → 5 트랙 (Taffy #1138)                            |
| G1    | `repeat(auto-fit, minmax(100px,1fr))` w600, 2 item          | a     | (0,0,**300**,20)       | (0,0,**100**,20)         | !! `_is_auto_fit` 폐기 (`grid.rs:476`) — 빈 트랙 미축소                                        |
| G1b   | `repeat(auto-fill, minmax(auto,200px))` w600, 3 item        | b     | (**200,0**,200,20)     | (**0,20**,200,20)        | !! 반복 수 계산이 `minmax.min` px 만 봐 1 반복 (Taffy #946)                                    |
| G4    | cols `100px 100px` > item `grid-column 1 / span 3`          | a     | (0,**0**,400,20)       | (0,**100000**,200,20)    | !! 10,000 반복 가드가 실패를 "행 10001" 로 배치 — root 높이 100,020 (Taffy #1036·#1037)        |
| G9    | 단일 트랙 `justify-content: space-between`                  | a     | (**0**,0,100,20)       | (**100**,0,100,20)       | !! 단일 트랙 폴백은 start 인데 center 로 (`grid.rs:1071-1076` 주석이 틀림)                     |
| G11   | `grid-auto-flow column; grid-auto-columns 1fr 2fr` w400     | a / b | 133 / 267              | 100 / 100 · root h **0** | !! `parse_implicit_track_size` 가 첫 토큰 px 만 (`grid.rs:1094`) + root 높이 0                 |
| G10   | `grid-template-rows: repeat(2, 40px)` (height auto)         | b     | (0,**40**,400,20)      | (0,**20**,**100**,20)    | !! auto 축에서 `repeat()` 토큰이 하나의 content 행으로 접힘 (`tree.rs:4640`) + 암묵 열 100     |
| P0725 | `minmax(60px, auto) 1fr` (preset 이 회피한 2026-07-25 사례) | a / b | 80 / 320               | 80 / 320                 | 일치 — ADR-923 이후 수리됨. `presetDefinitions.ts:21` 회피 주석은 낡음                         |

## 3. Taffy 항목별 판정

a = 엔진이 이미 맞음 · b = 같은 결함/gap · c = 모델 밖. "도달" = production 파이프라인이 그 입력을 엔진에 실어 보낼 수 있는가 (패널·preset·catalog·Pencil import 기준).

### 3-1. Flexbox

| Taffy       | 항목                                            | 엔진 | 근거                                                                                                                                                                        | 도달                                                                                |
| ----------- | ----------------------------------------------- | ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| #1003 #1123 | stretch 된 item 의 cross 가 자손 `%` base       | b    | F5 실측 · `tree.rs:2118-2122` `child_containing_h`                                                                                                                          | **높음** — `height:100%` 자식은 빌더 기본 패턴                                      |
| #1072       | abs 자식 static position (justify/align 반영)   | b    | F10 실측 · `tree.rs:1954-1974`                                                                                                                                              | 중 — Styles 패널에 position 있음, inset 없는 abs 는 드묾                            |
| #952        | `safe` / `unsafe` 접두                          | b    | F8b 실측 · `tree.rs:4235-4272` 정확 문자열 매치                                                                                                                             | 낮음 — 패널이 내지 않음                                                             |
| #1077       | `self-start` / `self-end`                       | b    | F8a 는 폴백이 우연히 일치, `self-end` 는 stretch/auto 로 떨어짐 (`tree.rs:4280` grid 만)                                                                                    | 낮음                                                                                |
| #1109 #1127 | baseline 정렬 (auto margin 제외 · reverse 라인) | c    | F4 실측 — `align-items: baseline` 키워드 부재                                                                                                                               | 중 — 텍스트 행 정렬에 쓰임 (ADR-923 block baseline 은 있음, flex 는 없음)           |
| #989 #1155  | aspect-ratio → flex base size / min-max 전이    | c    | `flex.rs` 에 aspect_ratio 0건 (self-size 뒤 파생만)                                                                                                                         | 낮음 — F3 처럼 흔한 조합은 우연히 일치                                              |
| #1152       | 음수 margin + `flex-basis:0px` intrinsic        | b    | 뒤 margin 이 extent 에서 빠짐 · `0px` 는 min floor 로 동결 (`flex.rs:507-514`, `tree.rs:5513`)                                                                              | 낮음                                                                                |
| #1018       | padding 있는 item 의 intrinsic 기여             | b    | 텍스트 leaf border-box 값이 content 슬롯에 실려 padding 이중 가산 (`tree.rs:4071-4110` ↔ `flex.rs:285`) · `width:max-content` 컨테이너는 자기 padding 누락 (`tree.rs:1601`) | **중** — padded 텍스트 leaf 는 흔함, 실측 필요 (텍스트 케이스라 이번 probe 범위 밖) |
| #1115       | auto margin 뒤 justify-content                  | a    | F6 실측                                                                                                                                                                     | —                                                                                   |
| #1101       | indefinite 컨테이너를 max main 에서 wrap        | a    | `solve_flex` 3.6 clamp 후 재실행                                                                                                                                            | —                                                                                   |
| #1119       | 불필요한 min-content 측정 skip (성능)           | b    | 2-b 게이트가 scroll container·명시 min 을 안 봄 (`tree.rs:2320-2354`) — 캐시로 완화                                                                                         | 성능만                                                                              |
| #1099       | `flex-basis: min/max-content`, `stretch` 키워드 | b    | `tree.rs:5503-5528` `_ => None` → auto                                                                                                                                      | 낮음                                                                                |

### 3-2. Grid

| Taffy       | 항목                                         | 엔진 | 근거                                                                                                                     | 도달                                                                                                                                                                                                                                                |
| ----------- | -------------------------------------------- | ---- | ------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| #1036 #1037 | track sizing / auto-placement 무한 루프 가드 | b    | G4 실측 — 가드가 있으나 결과가 행 10001                                                                                  | **중** — 사용자가 `grid-column: span N` 을 열 수보다 크게 줄 수 있음                                                                                                                                                                                |
| #986        | 10,000 트랙 clamp                            | b    | `grid.rs:255` `repeat(N)` 무제한 · `tree.rs:3470` row token 벡터                                                         | 낮음 (방어)                                                                                                                                                                                                                                         |
| #946        | auto-repeat 반복 수 · 최소 크기              | b    | G1 · G1b 실측 (`grid.rs:235-253`, `:476`)                                                                                | 낮음 — preset 은 repeat 회피, 패널 자유 입력 없음. Pencil import 는 미확인                                                                                                                                                                          |
| #1138 #1035 | 대괄호 라인 이름 보존 · 반복 번호            | b    | G3 실측 (`grid.rs:135-138` 미인식 → auto)                                                                                | 낮음 — 같은 이유                                                                                                                                                                                                                                    |
| #960        | item `%` 를 grid area 기준으로               | a    | `tree.rs:3740`, `:3775`                                                                                                  | —                                                                                                                                                                                                                                                   |
| #1097       | `minmax(auto, Npx)` intrinsic min            | a    | `tree.rs:4520-4560` · P0725 실측                                                                                         | — (`grid.rs` 헤더 "0 폴백" 주석은 tree 경로엔 낡음)                                                                                                                                                                                                 |
| #1084 #1001 | fr 를 content 기여로 (indefinite 컨테이너)   | a/b  | §12.7.1 구현 있음. 단 span 하는 item 기여가 **시작 트랙에만** (`tree.rs:3568`, `:3406`, `:3499`)                         | 중 — `gridColumn: span 2` + 텍스트, 실측 필요                                                                                                                                                                                                       |
| #1071 #1075 | abs-pos grid item 라인 해석                  | b/c  | 암묵 grid 성장에 안 끼는 건 맞음; containing block 이 padding box 고정, 라인 미독 (`tree.rs:1914`)                       | 낮음 (ADR-164 의도적 미지원 축과 인접)                                                                                                                                                                                                              |
| #1078       | 전 트랙 collapse 시 content 정렬             | b    | G9 실측 (단일 트랙 space-between) · auto-fit 이 collapse 를 못 해 #1078 상황 자체가 안 생김                              | 낮음                                                                                                                                                                                                                                                |
| #1024       | `grid-template-areas` `.` 초과 셀            | c    | `NodeStyle` 에 areas 필드 없음 — TS 가 숫자 line 으로 병기 (`.claude/rules/layout-engine.md` §Grid area 이름 해석)       | — (TS 소유)                                                                                                                                                                                                                                         |
| #1038       | auto-placement 점유 구간 skip (성능)         | b    | `HashSet` 셀 단위 (`grid.rs:929-996`)                                                                                    | 성능만                                                                                                                                                                                                                                              |
| —           | 암묵 열 기본 `auto` (spec)                   | b    | G12 · G10 · G11 실측 — 정폭 grid 의 암묵 열이 100px 폴백, `grid-auto-columns` 목록 첫 px 만 (`grid.rs:1094`, `:681-686`) | **중** — catalog `MeterTrack`·`ProgressBarTrack`·`SliderTrack`·`ProgressCircle`·`MeterValue`·`ProgressBarValue` 가 template 없는 `display:grid` (`componentRulesTable.ts:7261…10703`). implicitStyles 가 폭을 주입해 가려질 가능성 — live 확인 필요 |

### 3-3. Block · absolute · cache

| Taffy                     | 항목                                                        | 엔진 | 근거                                                                                                                                                            | 도달                                                        |
| ------------------------- | ----------------------------------------------------------- | ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| #1122                     | `%` 높이 base (explicit / stretch / grid area)              | a/b  | explicit 은 맞음 (`tree.rs:2964`), stretch·grid area 는 F5·B1d 로 어긋남                                                                                        | **높음**                                                    |
| #1082                     | min-height 가 used height 결정 시 하단 margin collapse 차단 | a    | `tree.rs:3171-3183` Chrome 실측 주석 포함                                                                                                                       | —                                                           |
| #1083                     | `%` padding/border 는 CB 폭 기준 (세로 포함)                | a    | `tree.rs:5276-5277` — 예외 1: abs 컨테이너 자기 상자 (B3x)                                                                                                      | 낮음                                                        |
| #1096                     | abs-pos auto margin 을 clamp 된 used size 기준              | b    | B4 · B4c 실측                                                                                                                                                   | **중** — Styles 패널 position + max-width 조합 가능         |
| #959 #1087                | block `align-content`                                       | c    | B5 실측, `solve_block` 에 0건                                                                                                                                   | 낮음 — 패널에 없음 (Chrome 123+ 신규)                       |
| #965                      | block aspect-ratio → definite height                        | b    | B6 · B6c 실측 (`tree.rs:1686` 자식 없는 leaf 제외, `:1763` explicit_h 미승격)                                                                                   | **중** — `aspectRatio` 는 Styles 패널·Pencil import 에 있음 |
| #997                      | `display: flow-root` BFC                                    | b    | B8 실측 — `display.rs` 는 파싱, `node_establishes_bfc` (`tree.rs:4859`) 가 Flex/Grid 만                                                                         | 낮음 — 패널에 없음                                          |
| #1002                     | replaced element auto width 는 stretch 안 함                | c    | replaced 개념 없음 (TS 스칼라 leaf)                                                                                                                             | — (TS 소유)                                                 |
| float / clear / `contain` | —                                                           | c    | `NodeStyle` 부재                                                                                                                                                | — (ADR-170 사각 표 기재)                                    |
| #1010 #911                | 캐시 키에 axis·available·run-mode                           | a    | `last_avail` + `last_solved` 2-키 + 측정 센티넬 −2/−3 + subtree snapshot/restore (`tree.rs:691-707`, `:1270-1302`)                                              | —                                                           |
| #1085                     | `remove` 가 이전 부모를 dirty                               | b    | `set_children` 은 새 부모만, `remove_node` 는 부모 미탐색 (`tree.rs:770-782`, `:829-840`) — TS `PersistentLayoutTree` 가 이전 부모 children 을 다시 써서 가려짐 | 낮음 — 호출 규약 의존, 엔진 직접 호출자 위험                |
| #1120                     | 치수 확정된 abs 자식 측정 skip (성능)                       | b    | `tree.rs:1978` 무조건 solve                                                                                                                                     | 성능만                                                      |
| #1114-1118                | scrollable overflow rect                                    | c    | `NodeLayout` 5 필드 (x y w h baseline)                                                                                                                          | — (렌더 층 담당, canvas-rendering.md §8)                    |

## 4. 착수 권고 — 가치 순

동작 변경이라 각 항목은 `.claude/rules/review-loop-closure.md` §3 "동작 변경" 절차 (원복 RED · 회귀 스위트 · live · ledger) 를 탄다. **ledger 규칙과 충돌하는 1건이 있다** — 아래 ①.

| 순위 | 항목                                                                                | 수리 위치                                                                        | 게이트                                                 | 비고                                                                                                                                                                         |
| ---- | ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ①    | stretch 된 flex item · grid area · aspect 파생 높이를 **definite** 로 전달          | `solve_flex` 3.5 (cross 재-solve) · `solve_grid` `tree.rs:3740` · `tree.rs:1763` | F5 · B1d · B6c fixture → `percentSize.browser.test.ts` | ledger §"백분율 크기" 의 "판정은 `explicit_h > 0` 하나" 를 **flexbox §9.8 · grid §6.6 stretch 확정** 으로 확장해야 한다. 규칙 문서 (`layout-css-parity-ledger.md`) 동시 갱신 |
| ②    | grid 명시 배치가 explicit grid 초과 시 암묵 트랙 생성 (10,000 가드 제거)            | `grid.rs:754-767` `block_fits` · `:1004-1051` 배치 루프 · 암묵 열 생성           | G4 fixture                                             | Taffy 는 CSS-GRID §8.5 대로 암묵 트랙을 늘린다. 가드는 clamp (10,000 라인) 로 바꾼다 (#986)                                                                                  |
| ③    | abs-pos used size clamp                                                             | `tree.rs:1992-1998` (덮어쓰기 제거) · `tree.rs:5401-5404` (stretch 에 clamp)     | B4 · B4c fixture → `phase4_5` E11 계열                 | 작음                                                                                                                                                                         |
| ④    | 암묵 열 기본 `auto` — 정폭 grid 의 template 없음 · `grid-auto-columns` 목록         | `grid.rs:681-686` 폴백 제거 · `:1094` 토큰 순환 · `tree.rs:3374` 분기 확장       | G12 · G10 · G11 fixture                                | 먼저 live 로 catalog 6 규칙 (MeterTrack 등) 이 실제로 어긋나는지 확인 — implicitStyles 가 가리면 우선순위 하향                                                               |
| ⑤    | block leaf `aspect-ratio`                                                           | `tree.rs:1686` `!children.is_empty()` 조건                                       | B6 fixture                                             | Pencil import 이미지 프레임에 도달                                                                                                                                           |
| ⑥    | grid 파서 — 대괄호 이름 · auto-fit collapse · auto-repeat 최소 · auto 축 `repeat()` | `grid.rs:80-140` tokenize/parse · `:235-253` · `:476` · `tree.rs:4640`           | G3 · G1 · G1b · G10 fixture                            | 도달 낮음. 함께 하면 한 phase. `presetDefinitions.ts:21` 회피 주석 정정 동반                                                                                                 |
| ⑦    | 정렬 키워드 — `baseline` (flex) · `safe`/`unsafe` · `self-*` (flex)                 | `tree.rs:4235-4272` 파서 · `flex.rs` baseline 참여                               | F4 · F8b fixture                                       | baseline 은 ADR-923 block baseline 슬롯 (`leaf_baseline`) 을 flex 로 확장하는 형태 — 가장 큼                                                                                 |
| ⑧    | `display: flow-root` BFC · block `align-content`                                    | `tree.rs:4859` `node_establishes_bfc` · `solve_block`                            | B8 · B5 fixture                                        | 도달 낮음                                                                                                                                                                    |
| ⑨    | padding 있는 텍스트 leaf 의 intrinsic 이중 가산 (#1018)                             | `tree.rs:4071-4110` ↔ `flex.rs:285` 슬롯 계약                                    | 텍스트 케이스라 `pipelineLeg` 로 실측 먼저             | 정적 판정만 — **실측 전 착수 금지**                                                                                                                                          |
| —    | `set_children` 이전 부모 dirty · abs 측정 skip · min-content 측정 게이트            | API 견고성·성능                                                                  | `tree.rs` unit                                         | 후순위                                                                                                                                                                       |

## 5. 반영 불요

- Taffy API/타입 변경 (alignment enum → struct, `Dimension` → `LengthPercentageAuto`, `DetailedGridInfo`, `compute_layout_with_measure` 시그니처, `Layout::content_size` → `scrollable_overflow_rect`) — 엔진은 자체 계약 (`NodeStyle` 55 필드 · flat f32) 이라 무관.
- 캐시 재설계 (#1010 #911) — 엔진의 `last_avail`/`last_solved` 2-키 + 측정 센티넬 + subtree snapshot 이 같은 정확성을 이미 확보 (ledger §7).
- `flex-wrap: balance` · `flex-line-count` (Flexbox L2) — Chrome 미출시.
- `contain: layout/paint/content` — 레이아웃 효과가 BFC 격리인데 float 가 없어 실효 없음.
- float/clear 계열 20여 건 — `NodeStyle` 부재, ADR-170 사각 표에 이미 "엔진 미지원 표면".

## 6. 재현 fixture (harness `ParityCase` 형식)

전부 `availW` = root width, `availH: -1`. `style` 은 두 leg 공용 (엔진은 `insetLeft` 류, DOM 은 `left` 류를 읽으므로 abs 케이스는 둘 다 실었다).

```ts
// F5
[
  { label: "inner", style: { height: "50%", width: "40px" } },
  { label: "item", style: { width: "100px" }, children: [0] },
  {
    label: "root",
    style: {
      display: "flex",
      flexDirection: "row",
      height: "200px",
      width: "400px",
    },
    children: [1],
  },
][
  // B1d
  ({ label: "inner", style: { height: "50%", width: "40px" } },
  { label: "item", style: {}, children: [0] },
  {
    label: "root",
    style: {
      display: "grid",
      gridTemplateRows: ["200px"],
      gridTemplateColumns: ["200px"],
      width: "200px",
    },
    children: [1],
  })
][
  // B4 / B4c
  ({
    label: "abs",
    style: {
      position: "absolute",
      left: "0px",
      right: "0px",
      insetLeft: "0px",
      insetRight: "0px",
      width: "300px",
      maxWidth: "100px",
      height: "20px",
      marginLeft: "auto",
      marginRight: "auto",
    },
  },
  {
    label: "root",
    style: { position: "relative", width: "400px", height: "100px" },
    children: [0],
  })
][
  // G4
  ({
    label: "a",
    style: { height: "20px", gridColumnStart: "1", gridColumnEnd: "span 3" },
  },
  {
    label: "root",
    style: {
      display: "grid",
      width: "400px",
      gridTemplateColumns: ["100px", "100px"],
      rowGap: "10px",
    },
    children: [0],
  })
][
  // G12
  ({ label: "item", style: { height: "20px" } },
  { label: "root", style: { display: "grid", width: "400px" }, children: [0] })
][
  // B6 / B6c
  ({ label: "inner", style: { height: "50%", width: "20px" } },
  { label: "ar", style: { aspectRatio: 2 }, children: [0] },
  { label: "root", style: { width: "300px" }, children: [1] })
][
  // B8
  ({ label: "child", style: { marginTop: "40px", height: "10px" } },
  { label: "fr", style: { display: "flow-root" }, children: [0] },
  { label: "sib", style: { height: "10px" } },
  { label: "root", style: { width: "400px" }, children: [1, 2] })
];
// G3 · G1 · G1b · G9 · G10 · G11 · F4 · F8b · F10 · B5 · B3x — §2 의 style 열 그대로
```

## 7. 문서 drift 발견

- `presetDefinitions.ts:21` — "`minmax(60px, auto)` 가 비정상값" 회피 주석: 현재 엔진은 Chrome 과 일치 (P0725). 주석은 낡았고 preset 이 `repeat()`/`minmax()` 를 못 쓰는 근거가 사라졌다 (단 auto-repeat 는 §2 G1/G1b 로 여전히 어긋남 — `minmax()` 만 해제 가능).
- `grid.rs` 헤더 "컨텐츠 기반 min 은 0 폴백" — tree 경로 (`resolve_track_with_contribution`) 는 기여를 반영한다. 직접 wasm 엔트리 `grid_layout` 에만 남은 서술.
- `grid.rs:1076` 주석 "단일 트랙 space-between → center (CSS)" — CSS Box Alignment §5.1 폴백은 `flex-start`. Chrome 실측 x=0.
- ledger §"백분율 크기" 의 "블록 축은 `explicit_h > 0` 하나" — CSS §10.5 만 인용하고 flexbox §9.8 (stretch 된 item 은 definite) 과 grid §6.6 을 빠뜨렸다. §4 ① 과 함께 갱신.
