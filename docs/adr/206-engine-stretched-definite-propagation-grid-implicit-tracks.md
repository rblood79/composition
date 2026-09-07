# ADR-206: 엔진 늘어난 크기 definite 전파 + grid 암묵 트랙 준수

## Status

Proposed — 2026-09-07

## Context

**Domain: D3 (시각 스타일).** Builder(Skia) 와 Preview/Publish(DOM+CSS) 는 catalog SSOT 의 대등 consumer 다 (ADR-063 · ADR-142). Preview 는 실제 Chrome 이 배치하므로, 자체 레이아웃 엔진 (`packages/composition-engine`, ADR-916) 이 CSS 명세와 어긋나면 그 자체가 **대칭 위반**이다. D1/D2 무관 — DOM 구조·props 는 건드리지 않는다.

Taffy 0.10.0 을 참조해 구현한 엔진을 Taffy 0.14.0 (2026-08-24) 까지의 변경 37건과 대조하고 Chrome 차등 하니스로 실측했다 ([TAFFY_UPSTREAM_DELTA_2026-09.md](../explanation/research/TAFFY_UPSTREAM_DELTA_2026-09.md) §2 — 24 케이스 중 19 어긋남). 그중 production 에 도달하면서 격차가 큰 항목이 넷이고, A 묶음 (③ absolute clamp · ⑤ 빈 상자 aspect) 은 `0b1cecb4a` 로 닫았다. 본 ADR 은 남은 세 항목이다.

| #   | 결함 (Chrome vs 엔진)                                                                                                          | 원인 위치 (`0b1cecb4a`)                                                                           | Taffy                        |
| --- | ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- | ---------------------------- |
| ①   | `flex row height:200` 안 item 의 `height:50%` 자식 100 → **0**. grid area · aspect 파생 높이도 같음                            | `tree.rs:2131` `explicit_h > 0` 단일 게이트 · `:2576` 3.5 가 main 만 재-solve · `:3753` · `:1768` | #1003 #1123 #965             |
| ②   | 2열 grid 에 `grid-column: 1 / span 3` → item y **100,000**, 컨테이너 높이 100,020 (Chrome 0 / 암묵 3열)                        | `grid.rs:754` `block_fits` 열 한계 · `:1008/1014/1038/1044` 10,000 가드가 실패 위치 반환          | #1036 #1037 #986             |
| ④   | 정폭 grid 에 template 없음 → item **100px** (Chrome 컨테이너 폭) · `grid-auto-columns: 1fr 2fr` 무시 · auto 축 `repeat()` 접힘 | `grid.rs:682` 폴백 100 · `:1094` 첫 토큰 px · `:1186` column-flow 한정 · `tree.rs:3390` · `:4446` | 암묵 트랙 기본 `auto` (§7.6) |

①이 닿는 production 입력은 **사용자가 Styles 패널에서 넣는 `%` 높이뿐**이다 — 빌더 factory · preset 은 `height:%` 를 생성하지 않고 (grep 0건), catalog 의 `height: "100%"` 2곳 (`componentRulesTable.ts:7058 · 8339`) 은 `.fill` static selector (Preview DOM 의 막대) 라 canonical 노드에 닿지 않는다 (Phase 0 F19). 로컬 프로젝트 인벤토리는 N = 0 / M = 269 (breakdown §2 Phase 0) — 영향 규모를 추정으로 말하지 않는다. ②는 사용자가 span 을 열 수보다 크게 줄 수 있다. ④는 catalog 6 규칙 (Meter · ProgressBar · Slider 의 Track/Value · ProgressCircle) 이 template 없는 `display:grid` 지만 Phase 0 live 판정 (2026-09-07) 에서 Track 폭 = 컨테이너 폭이고 Track 은 canonical 자식이 없어 **잠복** 이다 — 사용자가 template 없는 grid Frame 에 자식을 넣을 때만 드러난다.

①은 ledger 정본 규칙과 충돌한다 — §백분율 크기 "판정은 `explicit_h > 0` 하나" (CSS §10.5 만 인용) 는 flexbox §9.8 (stretch 된 item 의 cross 는 definite) 와 grid §6.6 을 빠뜨렸다. Chrome 은 multi-line (`flex-wrap: wrap`) 의 stretch item 도 확정으로 본다 — 리뷰 round 1 실측 W3 (2 라인 · 라인 100) inner 50 · W4 (`align-content: stretch` 분배 라인 115) inner 57.5, 엔진 둘 다 0. §9.8 본문의 "single-line" 한정과 다르므로 oracle 은 Chrome 이고 채널의 기준은 **분배 뒤 라인 cross** 다. ADR-170 격자 2,702 조합 0 발산은 **1단 전파만** 잠갔고, 이 결함은 2단 (부모 stretch → 자식 → 손자 `%`) 이라 격자 green 이 반증이 아니다 (`layout-engine.md` 사각 표 "중첩 2단 이상").

**Hard Constraints**:

1. Chrome 차등 게이트 Δ ≤ 1px — 대조 문서 §6 fixture (F5 · B1d · B6c · G4 · G12 · G10 · G11) 전부 GREEN, 원복 시 RED (동작 변경 — `review-loop-closure.md` §3 절차).
2. 기존 parity 1,122 케이스 회귀 0 (ADR-170 격자 2,702 조합 포함). 착수 전 기존 실패 2건 (catalogComponentBox GridListItem · Tooltip — `0b1cecb4a` baseline 에서도 실패) 은 분리 기록.
3. `cargo bench tree_solve` p50 ≤ baseline +5% (ADR-169 G4 회귀 게이트 — 같은 머신·조건, `measurement-validity.md`). 무조건적 2차 pass 금지 — cross 재-solve 는 stretch 로 확정된 item 에만.
4. `NodeStyle` 55 필드 무변경 (`NODESTYLE_FIELD_COUNT` 가드). TS 보정 재도입 금지 (ADR-164 잔존 계약 — "CSS 표준 의미론의 새 gap 은 엔진 구현이 기본 경로").
5. 10,000 트랙 clamp 는 Chrome 과 같은 값.

**Soft Constraints**:

- ①은 기존 문서의 캔버스 배치를 바꾼다 (지금 0 높이로 접힌 `height:%` 자식이 부모를 채움). Preview 와 같아지는 방향이지만 사용자에게는 "레이아웃이 달라졌다" — CHANGELOG 와 live exercise 로 알린다. 영향 규모는 Phase 0 에서 N/M 으로 잰다 (breakdown §2).
- 다른 세션의 Canvas readiness WIP (`.agent/task-state.json`) 과 파일이 겹치지 않는다 — 엔진 Rust + parity 테스트 + 문서만.
- C 묶음 (⑥ 파서 · ⑦ 정렬 키워드 · ⑧ flow-root/align-content) 은 production 도달 사례가 없어 **scope 밖** — 사용자 결정 2026-09-07 (breakdown §5).

## Alternatives Considered

### 대안 A: 엔진 안에서 definite 채널 + 암묵 트랙 성장 (명세 직접 구현)

- 설명: `solve_node` 에 available 과 별도의 "이 축은 확정" 입력을 두고, flex 3.5 가 stretch item 의 cross 를 used 값으로 재-solve 하며, grid 셀·aspect 전송값도 같은 채널로 손자에 내린다. grid 는 명시 배치의 열/행 한계를 풀고 배치 결과로 암묵 트랙을 만들며 (`grid-auto-*` 토큰 순환), 10,000 가드를 라인 clamp 로 바꾼다.
- 근거: Taffy #1003/#1123 가 같은 문제를 "definite 를 중첩 레이아웃과 `%` 자손까지 추적" 으로 고쳤고 (0.14.0 CHANGELOG), Blink 는 `ConstraintSpace` 의 fixed-block-size 로 stretch 를 자식에 확정값으로 넘긴다 (`StretchBlockSizeIfAuto`), Yoga 는 stretch 된 cross 를 `MeasureMode::Exactly` 로 내린다. 암묵 트랙은 CSS-GRID-1 §8.5 가 규정하고 Chrome·Taffy (#1037) 모두 explicit grid 밖 배치에 트랙을 늘린다.
- 위험:
  - 기술: **M** — 3.5 재-solve 는 `%` 누수 경로 3건의 이력이 있는 지점 (ledger §flex item 재-solve). 채널을 잘못 열면 ledger §백분율 금지 패턴 1 (`explicit || avail >= 0` 가짜 확정) 이 재발. 대조군 fixture 로 잠근다.
  - 성능: **M** — stretch item 의 cross 재-solve 1회 추가. 조건부 (stretch + definite 라인) 라 항상 도는 pass 가 아니다. bench 게이트.
  - 유지보수: **L** — 규칙이 명세 그대로라 향후 변경 비용 낮음. ledger 개정 동반.
  - 마이그레이션: **M** — 기존 문서의 캔버스 배치 변화 (Positive 방향). 롤백은 엔진 wasm 한 파일.

### 대안 B: TS 층 보정 — `fullTreeLayout` 이 stretch 된 크기를 자식 style 에 명시 높이로 주입

- 설명: Step 4.5 (height-for-width 재측정) 를 확장해, 1차 배치 결과의 item 높이를 `%` 자손의 부모 style 에 `height: Npx` 로 써서 2차 배치. grid over-span 은 TS 가 `span` 을 열 수로 잘라 보낸다.
- 근거: 구 엔진 시절의 Step 5.5 (block 자식 width:100% 보정) · 5.7 (overflow 기준 flexShrink) 가 같은 발상 — ADR-164 가 "coarse 근사 재생산" 으로 흡수·삭제했고 ADR-923 Phase 5 가 TS IFC 시뮬레이션을 제거했다.
- 위험:
  - 기술: **M** — 2-pass 사이 store/batch 정합 (processedElementsMap 규칙).
  - 성능: **H** — Step 4.5 는 1회 재측정 계약. 폭 축 재보정 확장은 명시 금지 (`layout-engine.md` 금지 패턴) 이며 전 페이지 2차 배치가 프레임 예산을 먹는다 (ADR-165 Phase 2 재개 조건과 충돌).
  - 유지보수: **H** — ADR-164 잔존 계약 "재침식 금지" 위반. 같은 규칙을 TS 와 엔진 두 곳이 갖게 된다.
  - 마이그레이션: **M** — 주입 값이 store 에 새지 않게 막아야 한다.

### 대안 C: definite 전파만 하고 grid 는 over-span 을 explicit grid 안으로 자르는 최소 변경

- 설명: ①은 대안 A 대로. ②는 `block_fits` 를 유지하고 span 을 `cols - c0 + 1` 로 잘라 텔레포트만 없앤다. ④는 폴백 100 을 컨테이너 폭으로 바꾼다.
- 근거: Yoga 는 grid 가 없고, 일부 경량 엔진 (예: `stretch` crate 초기) 은 암묵 트랙을 지원하지 않았다 — "잘라서라도 안 깨지게" 가 최소 구현의 관행.
- 위험:
  - 기술: **L** — 변경이 작다.
  - 성능: **L**.
  - 유지보수: **M** — Chrome 과 여전히 다르다 (Chrome 은 3열, 엔진은 2열 안에 압축). 게이트를 못 닫으니 대칭 위반이 "덜 심한" 형태로 남고 다음 판독에서 다시 올라온다.
  - 마이그레이션: **L**.

### 대안 D: Taffy 0.14 재도입 (엔진 교체)

- 설명: 자체 엔진을 걷고 Taffy 를 다시 의존성으로. 대조한 37건이 한 번에 사라진다.
- 근거: Taffy 는 Blitz/fulgur 가 production 으로 쓰는 엔진 (fulgur 대조 문서 A).
- 위험:
  - 기술: **H** — ADR-916 결정 반전. ADR-165 스칼라 계약 · ADR-923 block/inline 경로 · `FLEX_FIELD_COUNT` flat f32 계약이 전부 무효.
  - 성능: **M** — Taffy 0.12 캐시 재설계가 "~10% (병적 케이스 60%) 성능 저하" 를 스스로 기록.
  - 유지보수: **M**.
  - 마이그레이션: **C** — 34k LOC 엔진 + 1,126 parity + ledger 24절이 기준을 잃는다.

### Risk Threshold Check

| 대안 | 기술 | 성능 | 유지보수 | 마이그레이션 | HIGH+ 개수 |
| ---- | ---- | ---- | -------- | ------------ | :--------: |
| A    | M    | M    | L        | M            |     0      |
| B    | M    | H    | H        | M            |     2      |
| C    | L    | L    | M        | L            |     0      |
| D    | H    | M    | M        | C            |  2 (C 1)   |

루프 판정: A · C 가 HIGH 0 이라 새 대안 추가 불요. D 의 CRITICAL 은 "근본적으로 다른 접근" 자체 (엔진 교체) 이므로 대안으로 기록만 하고 채택하지 않는다.

## Decision

**대안 A: 엔진 안에서 definite 채널 + 암묵 트랙 성장**을 선택한다.

선택 근거:

1. 잔존 위험이 전부 MEDIUM 이고 각각 게이트로 관리된다 — `%` 누수 재발은 대조군 fixture (비확정 케이스가 GREEN 을 유지해야 채널이 가짜 확정이 아님), 성능은 bench 5% 게이트, 배치 변화는 Phase 0 인벤토리 + CHANGELOG.
2. 규칙이 명세 그대로라 ledger 한 절을 **확장**하는 것으로 끝난다 — 규칙을 새로 발명하지 않는다 (flexbox §9.8 · grid §6.6 · §8.5 · §7.6).
3. ADR-164 의 방향 ("gap 은 엔진 구현이 기본 경로") 과 일치하고, 대안 C 와 달리 게이트를 실제로 닫는다.

기각 사유:

- **대안 B 기각**: ADR-164 잔존 계약 위반 (TS 보정 재침식 금지) + Step 4.5 1회 계약 위반. 같은 규칙이 두 층에 생긴다.
- **대안 C 기각**: 텔레포트는 없애지만 Chrome 과 다른 결과 (3열 → 2열 압축) 가 남아 대칭 게이트를 못 닫는다. "덜 틀린" 상태는 다음 판독에서 다시 HIGH 로 올라온다.
- **대안 D 기각**: ADR-916 반전 + CRITICAL 마이그레이션. Taffy 는 참조 원본이지 오라클이 아니며, 대조 결과 엔진이 이미 맞는 항목 (캐시 키 · `%` 를 grid area 기준 · `minmax` 상한 · auto margin) 도 잃는다.

> 구현 상세: [206-engine-stretched-definite-propagation-grid-implicit-tracks-breakdown.md](design/206-engine-stretched-definite-propagation-grid-implicit-tracks-breakdown.md)

## Risks

| ID  | 위험                                                                                                                            | 심각도 | 대응                                                                                                                                                                 |
| --- | ------------------------------------------------------------------------------------------------------------------------------- | :----: | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | 기존 문서의 캔버스 배치 변화 — `height:%` 자식이 0 에서 부모 채움으로 (Preview 와 같아지지만 사용자에게는 변화)                 |  LOW   | Phase 0 BC 인벤토리 **N = 0 / M = 269** (로컬 프로젝트 1, 2026-09-07) — 기존 문서 변화 없음. CHANGELOG Fixed 에 규칙 변화 명시 · live 1회                            |
| R2  | definite 채널이 `%` 누수의 4번째 경로가 된다 — 비확정 (align-self start · auto margin · height auto 부모) 까지 확정으로 새는 것 |  MED   | G1 대조군: 비확정 케이스 4종이 GREEN 유지 (RED 면 가짜 확정) · ledger §백분율 두 게이트 규칙 유지 · `tree.rs:2131 · :2977` 두 경로 동시 수정                         |
| R3  | 암묵 트랙 성장이 auto-placement 커서 · intrinsic 기여 (`col_min[col]` 인덱스) · 열/행 대칭 코드와 충돌                          |  MED   | G2 회귀 8 스위트 전량 · 원복 RED 를 타입별 diff 행으로 기록                                                                                                          |
| R4  | 재-solve 추가로 solve pass 증가 (600 요소 문서 편집 지연)                                                                       |  MED   | G3 `cargo bench tree_solve` +5% · `pnpm perf:baseline -- --lane frame` 1회                                                                                           |
| R5  | ④ 의 catalog Track 6 규칙이 implicitStyles 에 가려져 live 격차가 없는데 엔진 변경으로 배치가 바뀔 가능성                        |  LOW   | Phase 0 F14 live 판정 (2026-09-07): Track 폭 = 컨테이너 폭 (350 · 342 · 342), Track 은 canonical 자식 0 → **④ 잠복 확정**, Phase 2 후반 · `catalogComponentBox` 회귀 |
| R6  | ledger 정본 규칙 drift — §백분율을 안 고치면 다음 판독이 "게이트 하나" 를 근거로 채널을 결함으로 판정                           |  LOW   | Phase 3 에서 §백분율 개정 + 색인 13 을 코드와 같은 커밋에                                                                                                            |

잔존 HIGH 위험 없음.

## Gates

| Gate | 시점           | 통과 조건                                                                                                                                                                                                                               | 실패 시 대안                                                                    |
| ---- | -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| G0   | Phase 0 종료   | 코드 사실 표 F1~F19 전수 대조 · F14 live 판정 기록 · BC 인벤토리 N/M 수치 · bench baseline 기록 — **통과 2026-09-07** (breakdown §2 Phase 0 산출: F14 잠복 · N 0/M 269 · depth 12 median 27,167 ns)                                     | 착수 보류 — inventory 보강 (M3: gap 은 절차 결함, fork 사유 아님)               |
| G1   | Phase 1 종료   | F5 · B1d · B6c · W3 · W4 (multi-line wrap, 분배 라인 기준) GREEN + 대조군 (align-self start · auto margin · auto 부모 · grid align start) GREEN + 원복 시 5건만 RED · `percentSize` `basicAxis*` `flexSweep` `crossAxisOverflow` 회귀 0 | 대조군 RED = 가짜 확정 → 채널을 stretch item 한정으로 좁힘, 재측정              |
| G2   | Phase 2 종료   | G4 · G12 · G10 · G11 · 10,000 clamp GREEN + 원복 RED (타입별 diff) · grid 회귀 8 스위트 0 · 기존 실패 2건 분리 기록                                                                                                                     | 암묵 트랙 생성을 명시 배치 축에만 한정하고 auto-columns 순환은 후속 phase 로    |
| G3   | Phase 2 종료   | `cargo bench tree_solve` p50 ≤ baseline +5% (같은 머신·조건) · `perf:baseline frame` 600 요소 편집 p95 악화 없음                                                                                                                        | cross 재-solve 를 "자손에 `%` 높이가 있는 item" 으로 게이트 (measure 캐시 활용) |
| G4   | Implemented 전 | live 3 시나리오 (`height:100%` 자식 · span 초과 grid · Track 1종) — Chrome MCP 또는 사용자 confirm, `### Live Exercise` 기재 — **3/3 기재 (2026-09-07)**                                                                                  | 승격 보류                                                                       |
| G5   | Implemented 전 | ledger §백분율 개정 + §25 · 색인 13/25 · CHANGELOG · 대조 문서 §4 ✅ · preset 주석 정정                                                                                                                                                 | Stop hook block (README/CHANGELOG/Live Exercise)                                |

### Live Exercise

(Implemented 승격 시 3 시나리오 전부 기재 — 시나리오 · 결과 · 날짜 · Chrome MCP / 사용자 confirm 구분.)

- **Phase 2 (b) span 초과 grid · (c) Track — 2026-09-07, Chrome MCP** (로컬 `qwe`, hidden 탭 · `getSharedLayoutMap()` 299 rect): factory 로 심은 Frame `grid w400 cols 100px 100px rowGap 10` > Frame `h20 grid-column 1 / span 3` → **(0,0,400,20)** + 자동 Frame `h20` → **(0,30,100,20)**, grid 높이 **50** (종전 y 100,000 · 높이 100,020). template 없는 Frame `grid w400` > Frame `h20` → 폭 **400** (종전 100). ProgressBar 의 `ProgressBarTrack` → **(0,24,342,8)** = Phase 0 F14 값 (④ 잠복 회귀 0). 시드 3건 `removeElement` (잔여 0).
- **Phase 1 (a) `height:100%` 자식 — 2026-09-07, Chrome MCP** (로컬 `qwe`, hidden 탭 · `getSharedLayoutMap()`): factory 로 심은 Frame `flex row 300×200` > Frame `height:100%` → **200** > Frame `height:50%` → **100** (3단 전파, 종전 0 · 0). 시드는 `removeElement` 로 제거 (잔여 0).

## Consequences

### Positive

- Builder 캔버스와 Preview 가 `height:%` 자식 · grid span 초과 · template 없는 grid 에서 같은 배치를 낸다 — D3 대칭 위반 3건 해소. 사용자가 회피하던 패턴 (span 을 열 수 이하로만) 이 필요 없어진다.
- ledger §백분율이 CSS 세 명세 (§10.5 · flexbox §9.8 · grid §6.6) 를 모두 인용하는 완전한 규칙이 된다. 다음 판독이 "게이트 하나" 를 근거로 오판하지 않는다.
- grid 배치 실패가 "행 10001" 이라는 무음 폭발 대신 Chrome 과 같은 clamp 로 끝난다.

### Negative

- 기존 문서의 캔버스 배치가 바뀐다 (`height:%` 자식이 펼쳐짐). CHANGELOG 와 live 로 알려야 하고, 사용자가 "버그" 로 볼 수 있다.
- `solve_flex` 3.5 · `solve_node` 진입부 · `grid.rs` 배치 루프가 한 번 더 복잡해진다. `tree.rs` 는 이미 9k 행이다.
- stretch item 의 cross 재-solve 만큼 solve pass 가 는다 (bench 로 상한).
- C 묶음 (파서 · 정렬 키워드 · flow-root) 은 그대로 남는다 — 도달 사례가 나타날 때까지.
