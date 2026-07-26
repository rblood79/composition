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

| Phase | 내용                                                             | 산출물                                    | Gate     |
| ----- | ---------------------------------------------------------------- | ----------------------------------------- | -------- |
| **0** | fixture 고정 — §2-2 발산 7형태를 parity 케이스로 (red 상태 확인) | `containerIntrinsic.browser.test.ts`      | red 재현 |
| **1** | available 3-값 확장 + 노드별 측정 캐시                           | `tree.rs` 센티넬 2종 + `IntrinsicCache`   | G1, G4   |
| **2** | flex 소비 배선 — off 13 = max-content, off 19 = min-content      | `tree.rs::solve_flex` / `write_flex_item` | G2, G3   |
| **3** | grid/block 축 조건부 판정 (실사용 실측 → 포함 또는 이연 명문화)  | 실측 기록 + (해당 시) `grid.rs`           | G5       |
| **4** | bench 게이트 + 문서·규칙 정합                                    | bench 수치 + `layout-engine.md` 갱신      | G4, G6   |

### Phase 1 상세 — available 3-값 + 캐시

- **센티넬 확장**: `INDEFINITE_AVAIL = -1.0` 옆에 `MIN_CONTENT_AVAIL = -2.0` / `MAX_CONTENT_AVAIL = -3.0`. **함수 시그니처를 바꾸지 않는다** — `solve_node(handle, avail_w, avail_h)` 의 음수 도메인을 확장하는 방식이라 호출부 전수 변경이 불필요하다 (Taffy 의 `AvailableSpace` enum 과 동등한 표현력, 훨씬 좁은 diff).
- **분기 지점**: `resolve_self_size` / `axis_pad_border` / `ctx_for` 등 available 을 읽는 모든 지점이 음수를 이미 "indefinite" 로 취급하므로, 신규 센티넬은 **측정 모드 판정에만** 소비되고 나머지는 기존 indefinite 경로를 그대로 탄다.
- **캐시**: 노드당 `Option<(f32 /*min*/, f32 /*max*/)>`. 무효화는 기존 `dirty` 플래그에 종속 — `mark_subtree_dirty`(`tree.rs:621`)가 캐시도 함께 비운다. **캐시 없이는 중첩 깊이에 지수적**이므로 Phase 1 의 필수 구성요소다 (Gate G4).
- **leaf 경로 재사용**: `resolve_leaf_intrinsic_width`(`tree.rs:1930`) 가 이미 min/max-content 키워드를 처리하므로 leaf 는 신규 코드 없이 센티넬을 소비한다.

### Phase 2 상세 — flex 소비 배선

- `solve_flex` 1단계에서 **auto-main 컨테이너 item** 에 대해 min/max-content 2값을 산출해 off 13/19 에 각각 기록.
- **두 채널을 반드시 동시에** 바꾼다. max-content 만 정정하면 floor 도 함께 커져 긴 텍스트가 지금보다 크게 넘친다 (§2-2 4행 형태에서 확인된 역효과) — 부분 반영 금지가 본 phase 의 하드 제약.
- 3.5 재-solve(`tree.rs:1147~`)의 `laid_out_main` 비교 기준을 측정 모드에 맞게 갱신 — 측정이 available 이 아닌 intrinsic 으로 바뀌므로 "분배로 안 바뀜" 판정식이 그대로면 재-solve 가 부당 skip 된다.
- leaf 는 **무변경** — off 19 스칼라 공급 경로(ADR-165)를 건드리지 않는다.

## 4. 파일 변경 예상

| 파일                                                           | 변경                                          |
| -------------------------------------------------------------- | --------------------------------------------- |
| `packages/composition-engine/src/tree.rs`                      | 센티넬 2종, 측정 캐시, `solve_*` 모드 분기    |
| `packages/composition-engine/src/flex.rs`                      | (필요 시) floor 주석 갱신 — 로직 무변경 예상  |
| `packages/composition-engine/src/grid.rs`                      | Phase 3 판정 결과에 따름                      |
| `packages/composition-engine/tests/`                           | 단위 + golden 계약 가드                       |
| `apps/builder/tests/parity/containerIntrinsic.browser.test.ts` | 신규 fixture (§2-2 7형태)                     |
| `apps/builder/tests/parity/slotPercentChild.browser.test.ts`   | 헤더 §범위 밖 발산 항목 해소 반영             |
| `.claude/rules/layout-engine.md`                               | §TS 잔존 계약 1행 정밀화 + §automatic minimum |

## 5. 검증 체크리스트

- [ ] Phase 0 fixture 7형태가 착수 전 red, Phase 2 후 green
- [ ] Rust 단위 전수 PASS (착수 시점 324)
- [ ] parity 전 suite PASS (착수 시점 13 files / 105 tests)
- [ ] `apps/builder` workspace/canvas PASS (착수 시점 867)
- [ ] `pnpm type-check` 0 error
- [ ] bench — 레이아웃 pass 시간 회귀 게이트 (G4)
- [ ] live — 프리셋 3종(`sidebar-left`/`sidebar-right`/`list-detail`) × 3 breakpoint 실 빌더 확인
- [ ] 문서 정합 — `layout-engine.md` §TS 잔존 계약 / §automatic minimum

## 6. 이연 / 잔존 (착수 시점 명시)

- **grid 축**: Phase 3 조건부 판정. 실사용 0건이면 이연 명문화 + 재개 조건 기록 (ADR-164 ④ absolute 잔여와 동형 패턴).
- **flex intrinsic 정밀도**: CSS-FLEXBOX-1 §9.9.3 의 intrinsic main size 는 flex fraction 을 쓰는 별도 알고리즘이다. Phase 2 가 이를 완전 구현할지, 집계 근사로 둘지는 Phase 0 fixture 의 통과 여부로 판정 — 근사로 충분하면 그 사실과 발산 잔존 형태를 명문화한다.
- **height 축(column main)**: 폭 축과 달리 height-for-width 재줄바꿈이 얽혀 ADR-165 의 2-pass 축소 계약 영역과 겹친다. 본 ADR 은 **폭 축 우선**, height 축은 Phase 3 실측 후 판정.
