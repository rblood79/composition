# ADR-169 구현 상세 — 컨테이너 intrinsic 크기 산출

> 본문: [169-container-intrinsic-sizing-propagation.md](../169-container-intrinsic-sizing-propagation.md)

## 1. Fork checkpoint 4 질문 lock-in

본 ADR 은 ADR-165(leaf 한정 intrinsic 스칼라 계약)의 미충족 영역을 신규 ADR 로 분리한다. `.claude/rules/adr-writing.md` §"ADR Fork / 분리 결정 시 전제·관점 점검" 4 질문을 착수 전에 고정한다. 사용자 explicit confirm: 2026-07-27 "ADR 작성해" (조사 결과 보고 후 직접 지시).

1. **base / 응용 분류** — ADR-165 가 base(측정 프로토콜 off 13/19 + CSS-SIZING-3 §5 공식의 엔진 소유), 본 ADR 이 그 **범위 확장**(leaf → 컨테이너)이다. 응용이 아니라 동일 축의 미충족 영역이므로 의존 방향은 `165 → 169` 단방향이고, 165 는 이미 Implemented(2026-07-25)라 prerequisite 가 충족돼 있다. ADR-164 Consequences 후속 체인 ①의 계속.
2. **schema 직교성** — 프로토콜 슬롯을 **신설하지 않는다**. `content_main`(off 13) / `content_min_main`(off 19) 은 ADR-165 가 정의한 그대로이고, 본 ADR 이 바꾸는 것은 **그 슬롯을 채우는 주체**(컨테이너의 경우 TS 스칼라 부재 → 엔진 자체 산출)뿐이다. specialization 관계가 아니라 동일 스키마의 공백 충전.
3. **선행 ADR 전제 reverse 검증** — ADR-165 의 "측정 주체는 TS, 소비 알고리즘은 엔진" 전제가 컨테이너에도 그대로 유효한가? **유효하지 않으며, 그 판정이 본 ADR 의 핵심이다.** 텍스트 leaf 는 폰트 측정이 필요해 TS(CanvasKit/Canvas 2D)가 oracle 이지만, 컨테이너 intrinsic 은 **자식 값의 집계 또는 자기 알고리즘의 재실행**이라 엔진이 이미 보유한 정보로 산출된다. TS 가 공급하려면 레이아웃을 재구현해야 하고 그건 ADR-164 Decision 이 금지한 TS 재보정이다. 따라서 의존 방향은 유지되고, 경계는 **"폰트 측정 = TS / 구조 집계 = 엔진"** 으로 정밀화된다 (`layout-engine.md` §TS 잔존 계약 1행 갱신 대상).
4. **codex 3차까지 미루지 않음** — 전제 검증의 근거가 되는 실측(§2)을 ADR 착수 **전에** 3-leg 하니스로 완료했다. 표면 이슈/게이트 정합이 아니라 원인 지점(off 13/19 공급 주체)이 코드 인용으로 고정된 상태에서 리뷰에 들어간다.

## 2. Phase 0 inventory — 착수 전 실측 (2026-07-27 완료)

### 2-1. 원인 경로 (코드 인용)

| 지점                                                   | 내용                                                                            |
| ------------------------------------------------------ | ------------------------------------------------------------------------------- |
| `tree.rs:1069-1075` (`solve_flex` 1단계)               | 각 item 을 **컨테이너 available** 로 `solve_node` — 이 반환값이 곧 content 크기 |
| `tree.rs:2423` (`write_flex_item`)                     | `data[off + 13] = content_main` — 위 값이 그대로 base size 채널로               |
| `tree.rs:2445` (`write_flex_item`)                     | `data[off + 19]` = `cstyle.content_min_width` — **TS 텍스트 leaf 스칼라 전용**  |
| `flex.rs:288-293` (`parse_item`)                       | off 19 absent(0) → `content_main` fallback = **상한 근사를 하한으로 사용**      |
| `tree.rs:1930` (`resolve_leaf_intrinsic_width`)        | leaf 는 CSS-SIZING-3 §5 공식 보유 — 컨테이너에는 대응물 없음                    |
| `tree.rs:639/652` (`solve_node` + `subtree_has_dirty`) | 증분 캐시 게이트 — 측정 모드 도입 시 캐시 키 확장 지점                          |
| `tree.rs:92` (`INDEFINITE_AVAIL = -1.0`)               | available 음수 센티넬 — 3-값 확장의 기존 선례                                   |

### 2-2. 발산 실측 (3-leg: DOM ground truth / engine / pipeline)

행 컨테이너 1920, `[sidebar, content(flexGrow:1)]`. 전 케이스에서 **engine ≡ pipeline** — TS 파이프라인 상쇄 없음.

| 형태                                       | DOM            | engine·pipeline |                판정 |
| ------------------------------------------ | -------------- | --------------- | ------------------: |
| content 자식 `width:100%`, sidebar 240     | 240 / 1680     | **0** / 1920    |                발산 |
| content 자식 auto 폭 블록, sidebar 240     | 240 / 1680     | **0** / 1920    |                발산 |
| content 자식 고정 50px                     | 240 / 1680     | 240 / 1680      |                정합 |
| content 자식 고정 3000px                   | 0 / 3000       | 0 / 3000        | 정합(DOM 동일 붕괴) |
| 텍스트 leaf 가 **item 자신**               | 205.7 / 1714.3 | 205.7 / 1714.3  |                정합 |
| 텍스트 leaf 가 **컨테이너 item 안**        | 205.7 / 1714.3 | **0** / 1920    |                발산 |
| 프리셋 실형태 (sidebar 250 `flexShrink:0`) | 250 / **1670** | 250 / **1920**  |      발산(초과 250) |

판정 요약: **leaf 는 정합, 컨테이너만 발산**. 그리고 **내용이 stretch 로만 늘어난 경우에만** 발산한다 (진짜 과폭 내용은 DOM 도 동일하게 형제를 붕괴시킨다).

### 2-3. 도달성 — 프리셋 실사용

`presetDefinitions.ts:194/229/267` 의 `sidebar-left` / `sidebar-right` / `list-detail` 이 `display:flex; flexDirection:row` + 고정폭 슬롯 형태다. 고정 슬롯에 `flexShrink: 0` 이 있어 **붕괴 대신 초과**로 나타난다 — content 슬롯이 available 전체를 차지해 컨테이너를 정확히 sidebar 폭만큼 넘는다. `flexShrink:0` 없이 사용자가 직접 구성한 고정폭 형제는 0 으로 붕괴한다.

### 2-4. grid 축 현황

`grid.rs` 에 min/max-content 표면이 **0건**이다 (`write_grid_item` 심볼 자체 부재). ADR-164 breakdown 이 "grid item automatic minimum(CSS-GRID-1 §6.6)·intrinsic track 은 범위 밖 — grid.rs 미구현 영역, ① 후속과 동반" 으로 위임했고 ADR-165 는 실사용 0건 판정으로 이연했다. 본 ADR 은 Phase 3 에서 **동일 조건부 규칙**으로 재판정한다 (실사용 발생 여부 실측 → 없으면 이연 명문화, 있으면 포함).

## 3. Phase 분해

| Phase | 내용                                                               | 산출물                                     | Gate                  |
| ----- | ------------------------------------------------------------------ | ------------------------------------------ | --------------------- |
| **0** | ✅ **Implemented 2026-07-27** — fixture 고정 (§3-0)                | `containerIntrinsic.browser.test.ts`       | red 재현 + R8 판정    |
| **1** | ✅ **Implemented 2026-07-27** — 센티넬 + 측정 캐시 (§Phase 1 결과) | `tree.rs` 센티넬 2종 + `mutation_gen` 캐시 | G1 ✅, G4 baseline ✅ |
| **2** | ✅ **Implemented 2026-07-27** — flex 소비 배선 (§Phase 2 결과)     | `tree.rs::solve_flex` + `utils.ts` R8 축소 | G2 ✅, G3 ✅          |
| **3** | ✅ **Implemented 2026-07-27** — grid 이연 + Phase 2 회귀 차단 (§Phase 3 결과) | `tree.rs` grid 가드 + I/J/K fixture + `layout-engine.md` | G5 ✅ |
| **4** | bench 게이트 + 문서·규칙 정합                                      | bench 수치 + `layout-engine.md` 갱신       | G4, G6                |

### Phase 0 결과 (2026-07-27) — fixture 확정

`apps/builder/tests/parity/containerIntrinsic.browser.test.ts` 12 케이스. 정합 3 은 `it`(회귀 가드), 발산 4 는 `it.fails`(Phase 2 목표 — 통과하면 red 가 되어 `.fails` 제거를 강제). 프리셋 실형태(G)는 파이프라인 leg 로도 걸어 **엔진만 고치고 TS 선계산이 되돌리는 상태**를 차단한다.

| 케이스                             | DOM(sidebar/content) | engine     | 판정 |
| ---------------------------------- | -------------------- | ---------- | ---- |
| A. 자식 고정 50px                  | 240 / 1680           | 동일       | 정합 |
| B. 자식 고정 3000px                | 0 / 3000             | 동일       | 정합 |
| C. 텍스트 leaf 가 item 자신        | 240 / 1680           | 동일       | 정합 |
| D. 자식 `width:100%`               | 240 / 1680           | 0 / 1920   | 발산 |
| E. 자식 auto 폭 블록               | 240 / 1680           | 0 / 1920   | 발산 |
| F. 텍스트 leaf 가 컨테이너 안      | 240 / 1680           | 0 / 1920   | 발산 |
| G. 프리셋 (sidebar `flexShrink:0`) | 250 / 1670           | 250 / 1920 | 발산 |

§2-2 의 7형태와 일치한다. 텍스트 leaf 케이스(C/F)는 `domAtoms`(DOM) ↔ `contentMin/MaxWidth` 스칼라(engine) 로 정확 정수화했고, F 의 leaf 에는 `height` 를 명시해 **폭 축만 격리**했다 (미명시 시 engine leg 가 leaf height 를 0 으로 내 무관한 h 발산이 섞인다).

**R8 판정 — masking 실재**. 판별 케이스(`width:fit-content` + stretch 자식)에서 engine leg 0/1920 vs pipeline leg 236.7/1683.3 으로 **두 leg 가 다르다**. `growsInFlex` 가 `width` 채널을 막으므로 작동 채널은 `minWidth` 주입 하나이고, `min_main != AUTO` 가 되어 §4.5 분기 자체가 실행되지 않는다 — Phase 2 가 off 19 을 정확히 채워도 이 형태에는 도달하지 못한다. 대조군(고정폭 자식)은 두 leg 모두 정합이라, masking 은 **발산 조건이 성립할 때만** 관측된다. 존치·축소 결론은 Phase 2 (G2).

**착수 시점 baseline 재확인**: parity 14 files / 117 (112 passed + 5 expected fail) — 신설 12 케이스 반영 전은 13 files / 105.

### Phase 1 상세 — available 3-값 + 캐시

- **센티넬 확장**: `INDEFINITE_AVAIL = -1.0` 옆에 `MIN_CONTENT_AVAIL = -2.0` / `MAX_CONTENT_AVAIL = -3.0`. **함수 시그니처를 바꾸지 않는다** — `solve_node(handle, avail_w, avail_h)` 의 음수 도메인을 확장하는 방식이라 호출부 전수 변경이 불필요하다 (Taffy 의 `AvailableSpace` enum 과 동등한 표현력, 훨씬 좁은 diff).
- **분기 지점**: `resolve_self_size` / `axis_pad_border` / `ctx_for` 등 available 을 읽는 모든 지점이 음수를 이미 "indefinite" 로 취급하므로, 신규 센티넬은 **측정 모드 판정에만** 소비되고 나머지는 기존 indefinite 경로를 그대로 탄다.
- **캐시**: 노드당 `Option<(f32 /*min*/, f32 /*max*/)>`. 무효화는 기존 `dirty` 플래그에 종속 — `mark_subtree_dirty`(`tree.rs:621`)가 캐시도 함께 비운다. **캐시 없이는 중첩 깊이에 지수적**이므로 Phase 1 의 필수 구성요소다 (Gate G4).
- **leaf 경로 재사용**: `resolve_leaf_intrinsic_width`(`tree.rs:1930`) 가 이미 min/max-content 키워드를 처리하므로 leaf 는 신규 코드 없이 센티넬을 소비한다.

### Phase 1 결과 (2026-07-27) — 설계 대비 3건 정정

센티넬·모드 판정·leaf 경로 재사용은 설계 그대로다. 구현 중 **설계가 틀린 지점 3건**을 실측으로 잡아 정정했다.

**① 캐시 무효화를 `dirty` 가 아니라 트리 mutation generation 에 건다.** 설계는 "`mark_subtree_dirty` 가 캐시도 비운다" 였지만, `propagate_dirty` 는 **이미 dirty 인 조상을 만나면 조기 종료**한다(중복 전파 비용 절감). 측정은 dirty 인 노드에도 캐시를 남기므로 "dirty ⟹ 캐시 없음" 불변식이 성립하지 않고, 자식 변경이 조상 캐시를 무효화하지 못한다 — 단위 테스트가 이를 red 로 잡았다. `LayoutTree.mutation_gen` 과 대조하는 방식은 그 구멍이 원천적으로 없고 판정이 O(1) 이다. mutation 은 layout pass **사이**에 일어나므로 한 pass 안에서는 캐시가 온전히 유효하다 — 지수 폭발이 실제로 발생하는 구간이 거기다.

**② 측정 패스는 스냅샷 복구로 부작용을 0 으로 만든다.** `mark_subtree_dirty` 로 갈음하면 **자손 측정 캐시까지 함께 날아가** 캐시 도입 목적 자체가 무너진다. `snapshot_subtree`/`restore_subtree` 가 `(dirty, layout)` 를 원상 복구하며, 이는 "측정 pass 가 서브트리를 clean 으로 남겨 이후 solve 가 증분 skip" 하는 선행 오염(grid 측정 pass 사례)도 함께 차단한다.

**③ block 컨테이너 측정 배선 추가 (설계 미기재).** 설계는 "컨테이너는 기존 집계 경로 그대로" 로 봤으나, `block.rs` 의 auto 폭은 `available - margin` **stretch** 라 측정 available(음수 센티넬)에서 폭이 음수가 되고 컨테이너 intrinsic 이 0 으로 붕괴한다. CSS 상 intrinsic 기여는 stretch 가 아니라 content 이므로, 측정 모드에서 auto 폭 block-level 자식을 `FIT_CONTENT`(= `content_w` 슬롯 소비)로 읽도록 `solve_block` 에 한 줄 분기를 뒀다. flex 축은 설계대로 무변경으로 통과했다.

**미해결 (Phase 2 fixture 로 판정)**: inline formatting 의 line box 줄바꿈(`block.rs:185` `current_x + total_width > available_width`)은 측정 available 이 음수라 두 번째 inline 항목부터 무조건 줄바꿈한다 — max-content 측정에서 과소가 된다. 현재 파이프라인이 inline 경로를 태우는지 Phase 2 fixture 로 먼저 확인하고, 도달하면 그때 대응한다.

**검증 (G1 — 동작 무변경)**: Rust 330 (착수 324 + 신규 6) · parity 14 files / 117 · builder 전 suite 2925 passed / 4 skipped / 14 todo · type-check 0 new violation. 신규 센티넬은 **산술로 만들어지지 않는다** — 음수 available 은 전 경로에서 감산 없이 그대로 전달되고(`else { avail_w }`) 유일한 음수 원천이 `INDEFINITE_AVAIL = -1.0` 이므로, 프로덕션 경로가 `-2.0`/`-3.0` 에 도달할 수 없다. 이것이 "동작 무변경" 의 근거다.

**G4 baseline + 회귀 상한** (`cargo bench --bench tree_solve`, Darwin 25.5.0 / release):

| 시나리오                   | baseline median | 회귀 상한 (Phase 4 판정) |
| -------------------------- | --------------- | ------------------------ |
| nested depth=1 full solve  | 24.3 µs         | ≤ 60.8 µs (2.5×)         |
| nested depth=4 full solve  | 31.4 µs         | ≤ 78.4 µs (2.5×)         |
| nested depth=8 full solve  | 41.0 µs         | ≤ 102.5 µs (2.5×)        |
| nested depth=12 full solve | 47.0 µs         | ≤ 117.6 µs (2.5×)        |
| nested depth=8 incremental | 0.46 µs         | ≤ 0.69 µs (1.5×)         |

**깊이 스케일링 상한 (R1 지수화 감지 — 이쪽이 본질)**: `median(depth=12) / median(depth=1)` 이 **≤ 3.0** 을 유지해야 한다 (baseline 1.93). 절대 수치는 머신에 따라 흔들리지만 이 비율은 알고리즘 차수를 직접 반영하므로, 캐시가 무력화되면 여기서 먼저 터진다. 증분 경로 상한이 별도인 이유도 같다 — 변경이 없을 때 측정이 돌면 안 된다.

> 벤치 자체의 함정: `mark_dirty(root)` 는 **조상 방향** 전파라 root 한 노드만 dirty 가 되고 clean 자식은 skip 된다. 초기 측정에서 depth 1~12 가 전부 같은 수치(≈3.5 µs)로 나온 원인이 이것이다. available 을 번갈아 바꿔 `last_compute` 를 어긋나게 하는 방식으로 전면 재계산을 강제한다.

### Phase 2 결과 (2026-07-27) — 발산 7형태 해소 + R8 축소

**G2 — 발산 전 형태 green.** Phase 0 의 `it.fails` 4건이 전부 "실패해야 하는데 통과" 로 뒤집혀 `.fails` 를 제거했고, 프리셋 실형태의 파이프라인 leg 도 함께 green 이다. 배선은 `solve_flex` 2-b 단계 한 곳 — `is_row` ∧ 자식 보유 ∧ main auto 인 item 에 대해 `measure_intrinsic_width` 결과로 off 13(base size = max-content)과 off 19(§4.5 floor = min-content)을 **함께** 덮는다.

`0 = absent` 규약 때문에 **min-content 가 정확히 0 인 경우는 off 19 으로 표현할 수 없다** (그대로 쓰면 `content_main` fallback = 상한이 하한). 사용자가 min 을 명시하지 않았을 때만 같은 뜻을 **명시 `min_main` 0** 으로 적어 그 모호성을 피한다 — §4.5 의 적용 조건을 `tree.rs` 가 재구현하지 않으면서 결과는 동일하다. 프로토콜 슬롯은 손대지 않았다 (HC4).

**R8 판정 결론 = 축소.** Phase 0 의 R8-a/b 는 base size 채널로 해소돼 masking 을 가리지 못했다. 하한이 결과를 정하는 형태를 새로 만들어(R8-d: 실텍스트 + `fit-content` + `flexShrink:0` 300 압박) 재보니 **dom 40 / eng 80** 으로 갈렸고, TS `minWidth` 주입을 일시 차단하자 그대로 정합(`[]`)이 됐다 — **원인이 주입임이 대조로 확정**됐다. 주입의 원래 목적("grow item 의 intrinsic 폭을 min-width:auto 상당 하한으로 남긴다")은 이제 엔진이 정확 min-content 로 소유하므로, ADR-164 Decision 의 "엔진이 규칙을 가지면 TS 보정은 남기지 않는다" 에 따라 **컨테이너에 한해 제거**했다 (`utils.ts`). leaf 는 존치 — 비텍스트 합성 leaf(INLINE_BLOCK/CIRCLE/IMAGE)의 content 를 엔진은 여전히 모르고, 그 채널이 유일한 하한 공급원이다 (`layout-engine.md` §TS 잔존 계약과 정합).

**G3 — 부분 반영 금지.** 두 채널을 한 커밋에 묶어 중간 상태 자체를 없앴다(G3 의 명시 대안). 더해 off 19 채널이 **실제로 구속함**을 Rust 단위로 고정했다 — `container_item_floors_at_exact_min_content`: root 340 = [content(grow, 스칼라 42/118), sidebar 300 shrink:0] 에서 leftover 40 임에도 min-content 42 에서 정지한다. off 19 을 끄면 40 으로 눌리거나 max-content 118 에서 멈추므로, 어느 쪽이든 이 테스트가 red 다.

**잔존 발산 1건 (실측 기록, Phase 3 이후 판정)**: 같은 형태를 **파이프라인**으로 태운 H 케이스가 `dom 41.5 / eng 40` 로 1.5px 어긋난다. 엔진 측 floor 채널은 위 Rust 테스트가 42 정지를 확증하므로 **엔진 오배선이 아니라 파이프라인이 중첩 텍스트에 다른 하한을 공급**하는 문제다. 두 층을 분리 감시하도록 Rust 테스트(엔진)와 인라인 스냅샷(파이프라인)을 각각 남겼다 — 엔진이 깨지면 Rust 쪽이 먼저 red 가 된다.

**live 검증 (2026-07-27)**: 실행 중인 빌더(`localhost:5173`)의 **실제 진입점** `calculateFullTreeLayout` 을 페이지 모듈 그래프에서 직접 불러 재빌드된 WASM 으로 3형태를 exercise 했다 — 프리셋 실형태 `sidebar 250 / content 1670` (수정 전 250 / **1920**, 프레임 250 초과), `width:100%` 자식 `240 / 1680` (수정 전 **0** / 1920), auto 폭 블록 자식 `240 / 1680` (수정 전 **0** / 1920). 대조군인 고정 3000px 자식은 `0 / 3000` 으로 **그대로** — DOM 도 동일하게 형제를 붕괴시키는 정상 동작이다.

> 프리셋 UI 클릭으로 확인하려 했으나 "기존 Slot 을 덮어쓰기/병합" 확인 대화가 떠 **사용자 문서를 훼손**하므로 취소하고, 문서를 전혀 변경하지 않는 위 경로로 대체했다. 검증 대상(엔진 → 실 진입점 → 좌표)은 동일하다.

**검증**: Rust 331 (Phase 1 330 + floor 계약 1) · parity 14 files / 121 · builder 2925 passed / 0 failed · type-check 0 new violation. (루트 `pnpm test` 의 specs/shared 2건은 해당 패키지에 vitest 가 설치돼 있지 않은 **환경 이슈**로, 본 변경과 무관하다.)

### Phase 2 상세 — flex 소비 배선

- `solve_flex` 1단계에서 **auto-main 컨테이너 item** 에 대해 min/max-content 2값을 산출해 off 13/19 에 각각 기록.
- **두 채널을 반드시 동시에** 바꾼다. max-content 만 정정하면 floor 도 함께 커져 긴 텍스트가 지금보다 크게 넘친다 (§2-2 4행 형태에서 확인된 역효과) — 부분 반영 금지가 본 phase 의 하드 제약.
- 3.5 재-solve(`tree.rs:1147~`)의 `laid_out_main` 비교 기준을 측정 모드에 맞게 갱신 — 측정이 available 이 아닌 intrinsic 으로 바뀌므로 "분배로 안 바뀜" 판정식이 그대로면 재-solve 가 부당 skip 된다.
- leaf 는 **무변경** — off 19 스칼라 공급 경로(ADR-165)를 건드리지 않는다.

### Phase 3 결과 (2026-07-27) — grid 이연 + Phase 2 회귀 1건 차단

**착수 즉시 드러난 것은 "이연할까" 가 아니라 Phase 2 가 만든 회귀였다.** Phase 2 의 2-b 단계는 `is_row` ∧ 자식 보유 ∧ auto-main 이면 display 를 가리지 않고 측정한다 — grid 컨테이너도 포함된다. 그런데 `grid.rs::resolve_grid_tracks` 2단계는 `remaining = (container - fixed - gap).max(0.0)` 이라 **음수 available 에서 `fr_size = 0`** 이 되어 fr·auto 트랙이 전부 0 이 된다. 그 0 이 `content_main` 으로 들어가면 grid item 이 통째로 사라진다.

귀속은 코드 읽기가 아니라 **토글 실험**으로 확정했다 (2회, 층을 나눠):

| 형태                          | 측정 배선 OFF | 측정 배선 ON | 가드 후 |
| ----------------------------- | ------------- | ------------ | ------- |
| grid 가 직접 flex item (Rust) | 1000          | **0**        | 1000    |
| `flex-row > block > grid`     | 1000          | **0**        | 1000    |
| 같은 형태 파이프라인 (I/J)    | —             | **0**        | 1920    |

**판정 = 이연.** `measure_intrinsic_width` 가 grid 서브트리(자기 또는 자손)에 `None` 을 돌려 **측정 자체를 하지 않는다**. 0 을 값으로 위장하지 않고 "이 노드는 intrinsic 을 낼 수 없다" 를 타입으로 신고해, 소비자가 ADR-169 이전 경로(컨테이너 available 로 solve)를 그대로 쓰게 한다. 가드는 서브트리 DFS 라 과잉 차단이 쉬워, grid 형제만 제외되는지 확인하는 테스트를 함께 뒀다.

포함(구현)을 택하지 않은 이유: grid 의 min/max-content 기여는 CSS-GRID-1 §12 track sizing 을 fr 트랙(§12.7.1)까지 따라가야 하고, 그 절반만 구현하면 본 ADR 이 R4 에서 경계한 "근사를 정확으로 오인" 패턴을 grid 축에 그대로 재생산한다. **재개 조건**: §12 기여 산출이 선행. 가드만 먼저 풀면 붕괴가 되살아난다 — 해제는 `grid_flex_item_does_not_collapse`(Rust) + I/J 스냅샷이 동시에 green 인 상태에서만.

**R6 (height 축) 판정 = 결함 부재 — 빈도가 아니라 구조.** 폭 축 발산 형태(G)를 90° 돌린 K 케이스에서 컨테이너·형제 높이는 DOM 과 정합이다. 인라인 방향은 블록 박스의 초기 동작이 **stretch** 라 auto 폭 자식이 available 을 채우지만, 블록 방향은 `height:auto` 가 **내용 크기**다 — "늘어나기만 하는 내용을 고유 크기로 오인" 하는 형태가 세로에서는 성립하지 않는다. `is_row` 한정은 범위 축소가 아니라 **결함의 실제 경계**다. K 에 남는 `k-inner.h`(dom 40 / eng 0)는 flex 분배로 부모 높이가 확정된 뒤 `height:100%` 를 재해소하는 경로 부재 — 별개 영역이라 스냅샷으로 기록만 남겼다.

**R5 해소**: 이연 사실·재개 조건·붕괴 기전을 `layout-engine.md` §"컨테이너 intrinsic" 에 기록했다 (금지 패턴 4개 포함). ADR-164 ④ absolute 잔여와 동형.

**live 검증 (2026-07-27)**: 실행 중인 빌더의 실 진입점 `calculateFullTreeLayout` 으로 두 형태를 같은 탭에서 exercise — grid-in-flex-row `grid 1920 / side 240`(붕괴 아님), 프리셋 실형태 `content 1670 / side 250`(Phase 2 유지). 두 수치가 같이 나온다는 것이 곧 "현재 WASM 에 Phase 2 와 Phase 3 이 모두 살아 있다" 는 증거다 (Phase 2 만이면 grid 가 0, Phase 3 만이면 프리셋이 1920). 사용자 문서 무변경.

**검증**: Rust 334 (331 + grid 3) · parity 14 files / 127 (121 + I/J/K 6) · builder 2925 passed / 0 failed · type-check 0 new violation.

### Phase 4 중간 결과 (2026-07-27) — G6 통과 / **G4 실패**

**G6 통과**: `layout-engine.md` §TS 잔존 계약의 측정 스칼라 행을 **"폰트 측정은 TS / 구조 집계는 엔진"** 경계로 정밀화하고(텍스트 leaf 한정 명시 + TS 컨테이너 intrinsic 계산 금지), §automatic minimum 에 **floor 공급 주체 두 갈래**(텍스트 leaf = TS 스칼라 / 컨테이너 = 엔진 측정)를 추가했다. Phase 3 의 §컨테이너 intrinsic 과 합쳐 경계 서술이 코드와 일치한다.

**G4 실패 — 상한을 크게 초과한다.** Phase 1 baseline 은 `measure_intrinsic_width` 가 **dead code** 일 때 잰 값이라, Phase 2 배선의 실비용이 여기서 처음 드러났다.

| 시나리오        | baseline | 회귀 상한 | Phase 4 실측  |    판정 |
| --------------- | -------- | --------- | ------------- | ------: |
| depth=1  full   | 24.3 µs  | ≤ 60.8 µs | **16.9 µs**   |      ✅ |
| depth=4  full   | 31.4 µs  | ≤ 78.4 µs | **113 µs**    |      ❌ |
| depth=8  full   | 41.0 µs  | ≤ 102 µs  | **2,084 µs**  |      ❌ |
| depth=12 full   | 47.0 µs  | ≤ 118 µs  | **36,462 µs** |      ❌ |
| depth=8  증분   | 0.46 µs  | ≤ 0.69 µs | **0.21 µs**   |      ✅ |
| 깊이 스케일링비 | 1.93     | ≤ 3.0     | **2,156**     | ❌ 지수 |

**원인 — 측정 자체가 아니라 3.5 재-solve 의 연쇄.** 계측(hit/miss/solve/r35 카운터)과 토글 실험으로 분리했다:

- 측정 캐시는 **정상 작동**한다 — 2회차 pass 의 `miss = 0` (depth 8 기준 hit 2101 / miss 0). 캐시 적중률 개선으로는 해결되지 않는다 (G4 실패 시 대안 ①은 이미 100%).
- step 2-b 를 끄면 solve 호출이 **정확히 노드 수**(depth 8 → 28회)이고 depth 12 가 47 µs 로 **Phase 1 baseline 과 일치**한다. 켜면 4,913회.
- 진짜 원인은 3.5 재-solve(`tree.rs:1325~`)다. Phase 2 이전에는 base size = `available` 이라 `used_main ≈ laid_out_main` → 분기가 **아예 안 걸렸다**. 정확한 max-content 를 넣자 둘이 갈라져 **매 레벨 발화**하고, 레벨마다 서브트리를 한 번 더 solve 하므로 2^d 가 된다 (depth 8 에서 r35 = 4,209회).
- 즉 step 1 의 speculative solve(available 기준)는 측정 대상 item 에서 **주축 결과가 버려지는 낭비**이고, 그 뒤 3.5 가 used size 로 다시 푼다. 레벨당 solve 2회 → 지수.

**실사용 영향 (실 진입점 `calculateFullTreeLayout` median)**: depth 1~4 = 0.1~0.2 ms, depth 6 = 0.6 ms, depth 8 = 1.9 ms. 프리셋 실형태의 중첩은 1~2 레벨이라 **현재 사용자 체감 영향은 없지만**, 깊은 중첩에서 프레임 예산을 삼킨다. 회귀는 Phase 2 시점에 이미 main 에 반영돼 있다.

**Phase 4 미완 — 판정 필요.** 남은 선택지는 ADR G4 §실패 시 대안의 두 갈래를 실측으로 좁힌 것이다:

| 선택지                                                                                                                  | 성격                      | 비용·위험                                                                                    |
| ----------------------------------------------------------------------------------------------------------------------- | ------------------------- | -------------------------------------------------------------------------------------------- |
| ① 측정 모드 solve 가 자식 컨테이너를 **재귀 solve 대신 캐시된 intrinsic 으로** 소비 (Taffy 형 노드별 캐시) + step 1 중복 제거 | 대안 A 유지, 정공법       | `solve_flex`/`solve_block` 측정 경로 재구조 — 가장 hot 한 경로, 회귀 위험 실재                |
| ② 측정 적용 조건 축소 (예: 중첩 깊이·형태 제한)                                                                        | 대안 A 부분 유지          | 경계가 자의적 — "어떤 형태는 맞고 어떤 형태는 틀림" 이 문서로 관리돼야 함                     |
| ③ 대안 B(집계 근사) 로 fallback                                                                                        | **Decision 변경**         | Phase 1~3 상당 부분 폐기. 근사라 정밀화 수렴 경로 없음(ADR Alternatives 판정)                 |
| ④ Phase 2 revert 후 재설계                                                                                             | **Decision 보류**         | 발산 7형태 재발 (프리셋 초과 250 복귀)                                                       |

①이 ADR Decision 과 정합하지만 엔진 hot path 재구조라 착수 전 사용자 판단이 필요하다 — Gate 강제 통과 금지 원칙에 따라 Phase 4 를 미완으로 둔다.

## 4. 파일 변경 예상

| 파일                                                           | 변경                                          |
| -------------------------------------------------------------- | --------------------------------------------- |
| `packages/composition-engine/src/tree.rs`                      | 센티넬 2종, 측정 캐시, `solve_*` 모드 분기    |
| `packages/composition-engine/src/flex.rs`                      | (필요 시) floor 주석 갱신 — 로직 무변경 예상  |
| `packages/composition-engine/src/grid.rs` | **무변경** — Phase 3 판정 = 이연 (가드는 `tree.rs`) |
| `packages/composition-engine/tests/`                           | 단위 + golden 계약 가드                       |
| `apps/builder/tests/parity/containerIntrinsic.browser.test.ts` | 신규 fixture (§2-2 7형태)                     |
| `apps/builder/tests/parity/slotPercentChild.browser.test.ts`   | 헤더 §범위 밖 발산 항목 해소 반영             |
| `.claude/rules/layout-engine.md`                               | §TS 잔존 계약 1행 정밀화 + §automatic minimum |

## 5. 검증 체크리스트

- [x] Phase 0 fixture 발산 4형태 red 재현 + 정합 3형태 green (2026-07-27) — Phase 2 후 `.fails` 제거로 green 확정
- [x] **R8** — masking **실재 확인** (engine 0/1920 vs pipeline 236.7/1683.3, §Phase 0 결과). 존치·축소 결론은 Phase 2 (G2)
- [x] Rust 단위 전수 PASS — 334 (착수 324)
- [x] parity 전 suite PASS — 14 files / 127 (착수 13 / 105)
- [x] `apps/builder` 전 suite PASS — 2925 passed / 0 failed
- [x] `pnpm type-check` 0 new violation
- [ ] bench — 레이아웃 pass 시간 회귀 게이트 (G4)
- [x] live — 실 진입점 `calculateFullTreeLayout` 으로 프리셋 실형태 + grid 형태 exercise (§Phase 2·3 결과). 프리셋 UI 클릭은 사용자 Slot 덮어쓰기 대화가 떠 취소
- [ ] 문서 정합 — `layout-engine.md` §TS 잔존 계약 / §automatic minimum

## 6. 이연 / 잔존 (착수 시점 명시)

- **grid 축**: Phase 3 조건부 판정. 실사용 0건이면 이연 명문화 + 재개 조건 기록 (ADR-164 ④ absolute 잔여와 동형 패턴).
- **flex intrinsic 정밀도**: CSS-FLEXBOX-1 §9.9.3 의 intrinsic main size 는 flex fraction 을 쓰는 별도 알고리즘이다. Phase 2 가 이를 완전 구현할지, 집계 근사로 둘지는 Phase 0 fixture 의 통과 여부로 판정 — 근사로 충분하면 그 사실과 발산 잔존 형태를 명문화한다.
- **height 축(column main)**: 폭 축과 달리 height-for-width 재줄바꿈이 얽혀 ADR-165 의 2-pass 축소 계약 영역과 겹친다. 본 ADR 은 **폭 축 우선**, height 축은 Phase 3 실측 후 판정.
