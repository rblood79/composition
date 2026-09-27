# ADR-246: 결정적 카운트 ratchet 게이트 + 120Hz begin-frame 결정적 프레임 하니스

## Status

Accepted — 2026-09-27 · **Phase 0 · 1 완료 (G0 · G1 PASS) · Phase 2 완료 (사용자 결정 1 — G2 PASS: select `selectCanonicalNode` id 인덱스, `findNodeByIdInSubtree` 62,910 → 0 · 원복 RED · taskMs 방향만) · Phase 3 Deferred (macOS 미지원 — 사용자 결정 4 기본안) · Phase 4 (실제 push 차단 1회) 남음** — 결과 breakdown §8 (로컬 상세 `evidence/246-phase0-ratchet-baseline.md`, gitignored). Phase 1 실행 중 개정 2 (dirty 워킹트리 차단 → push 대상 sha worktree 측정 · dev define → dev endpoint `/__composition_dev_root`). (사용자 `/execute-adr 246` — round 2 수리 뒤 판독 종결, `reviews/246.md` pending 0). Proposed — 2026-09-27 (사용자 `/create-adr 2단계 ratchet 게이트 + 120Hz begin-frame`. 출처: claude.dev "How we made claude.ai faster" 의 측정 원칙 1단계 적용 — [BUILDER_PERF_BASELINE_2026-09.md §8](../explanation/research/BUILDER_PERF_BASELINE_2026-09.md) 2026-09-27)

## Context

### 문제

이 저장소에는 **성능 회귀를 push 전에 막는 게이트가 없다.** ratchet (상한이 내려가기만 하는 게이트) 은 번들 크기 하나뿐이고 (`apps/builder/scripts/adr201-bundle-gate.mjs` — `BUILDER_CEILING` · `APPROVED` · `CEILING_EXPIRES`), 프레임·상호작용 비용은 `pnpm perf:baseline` 이 재기만 하고 판정하지 않는다. 판정하지 못하는 이유는 지표가 wall-clock 이기 때문이다.

- 같은 코드로 60 요소와 600 요소를 잰 headless 실행에서 pan 은 taskMs 575 → 506, zoom 은 1757 → 1547 로 **문서가 10배 커졌는데 더 빠르게** 나왔다 — 카운트는 전부 동일했다 (§8-3). 이 폭의 노이즈 위에 상한을 두면 게이트는 늘 통과하거나 늘 실패한다.
- 반면 같은 시드 + `--fixed-inputs` 로 2회 실행한 카운트는 278 값 중 262 가 정확히 같았고, 나머지 16 은 React dev 렌더 measure (≤ 1%) · RecalcStyle/Layout (±1~5) · rAF 경계의 ±1 프레임이었다 (§8-2). 즉 **등급 A (정확 동일) 와 등급 B (밴드 ≤ 3%)** 로 나누면 ratchet 이 성립한다.
- `--call-counts` (CDP precise coverage) 는 조작 1회당 함수 호출 수를 냈고, 60 요소 문서에서 선택 1회에 `findNodeByIdInSubtree` 2,097회 · 편집 1회에 `serializeLayoutRelevantValue` 17,422회가 바로 보였다 (§8-4). 글이 "같은 ID 를 세 번 해석" 을 Valgrind 명령어 수로 잡은 것과 같은 종류다.

프레임 축도 같은 문제다. headless 는 rAF 가 60Hz 로 잘리고 (§1) 부류당 "3초 동안 몇 프레임" 이라 프레임 수 자체가 흔들린다. 글은 headless Chrome 의 DevTools begin-frame 제어로 **240 begin-frame → 정확히 240 프레임** 을 그려 120Hz 프레임 예산 (8.33 ms) 판정을 결정적으로 만들었다. CLAUDE.md 성능 기준 ("native refresh target, 60Hz floor (p95)") 은 지금 `--headed` 실측으로만 확인할 수 있다.

### 이 ADR 이 다루지 않는 것 — ADR-243 과의 경계

[ADR-243](243-interaction-responsiveness-long-task-yield.md) 의 판정 지표는 **Event Timing (입력 → 다음 paint) — 실제 입력 · production · CPU 4x** 다. 그것은 사용자 체감의 외부 oracle 이고 (measurement-validity Q5), 본 ADR 의 카운트는 **회귀 감지용 내부 지표** 다. 카운트가 줄었다고 체감이 좋아졌다고 판정하지 않으며 (Q3 — 총비용 A/B 병기), 카운트가 같다고 체감 회귀가 없다고 판정하지 않는다. 두 ADR 은 서로 의존하지 않는다 — 243 의 Phase 0 하니스가 생기면 본 ADR 의 Phase 2 taskMs 참고 열을 Event Timing 으로 바꿀 수 있다.

### SSOT 3-Domain 판정

D1 · D2 · D3 어느 것도 아니다 — 측정 인프라 (하니스 · 게이트 · hook) 만 다룬다. Phase 2 의 첫 ratchet 하향 1건은 코드 수정을 포함하지만 canonical 문서 · props · catalog 시각 결과를 바꾸지 않는 호출 수 감소로 한정한다 (HC5).

### Hard constraints

- **HC1 판정 대상은 결정적 값만** — 등급 A (같은 시드·옵션 2회 실행 diff 0: perf 라벨 count · Skia 캐시 hit/miss · layout version Δ · DOM attributes/characterData) 는 상한 = 값, 등급 B (React dev 렌더 measure · LayoutCount · RecalcStyleCount · childList · ±1 프레임 count) 는 상한 = 값 × 1.03. wall-clock (gap · taskMs · longtask) 은 참고 열이며 판정에 쓰지 않는다. `--call-counts` 값은 등급 A 후보이되 Phase 0 에서 2회 동일성을 확인한 뒤에만 편입한다.
- **HC2 게이트 자기검증** — 등급 A 초과가 나오면 게이트는 같은 조건으로 1회 재실행해 **두 번 다 초과일 때만** 차단한다. 재실행에서 등급 A 값이 첫 실행과 다르면 결과는 "측정 불가" 로 통과도 차단도 아니며 그 사실을 출력한다 (같은 코드 · 다른 값 = 하니스 결함 신호, measurement-validity #8).
- **HC3 상한은 내려가기만** — 게이트 스크립트는 상한을 낮추는 갱신만 자동 제안한다. 올리기는 ADR-201 규약과 같이 **사용자 승인 기록 (누가 · 언제 · 사유) + 만료일** 이 파일에 있어야 하며 실행자가 임의로 켜지 않는다.
- **HC4 흐름을 끊지 않는다 — 그러나 fail-open 은 없다** — pre-push 는 경로 스코프 (캔버스 · store · 패널 · components · shared · engine · specs · 하니스 · ratchet 파일) 에 닿은 push 에서만 돈다. 스코프 안 push 는 **측정 없이 통과하지 않는다**: 게이트가 push 대상 코드를 제공하는 dev 서버를 스스로 확보한다 (5173 이 같은 저장소 root 를 서빙한다는 것을 dev 전용 endpoint `/__composition_dev_root` 로 확인했을 때만 재사용, 아니면 자체 포트 5179 `--strictPort` 에 띄운다 — breakdown §3-4). 서버를 못 띄우거나 root 가 다르면 **차단** (exit 1) 이고, 건너뛰는 길은 `SKIP_PERF_RATCHET=1` 뿐이며 조용하지 않게 출력한다 (ADR-198 규약). **탈출구는 자기 게이트만 끈다** — 기존 `SKIP_VISUAL_PARITY=1` 이 hook 전체를 `exit 0` 으로 끝내는 분기 (`.githooks/pre-push:22-25`) 는 ADR-198 smoke 만 끄는 플래그로 바꾸고, 두 탈출구는 서로를 우회하지 않는다. **측정 코드 = push 대상 revision** 을 두 경로로 보장한다 (Phase 1 실행 중 개정 — 병렬 세션의 미커밋 WIP 가 흔해 "dirty 면 차단" 은 거의 모든 push 를 막는다): **빠른 경로** — push 되는 `local_sha` 가 `HEAD` 이고 런타임 tracked 파일 (`apps/` · `packages/` · 루트 `package.json` · `pnpm-lock.yaml` · `pnpm-workspace.yaml` · `patches/` · `turbo.json`) 에 변경이 0 이면 메인 워킹트리를 잰다. **worktree 경로** — 아니면 push 대상 sha 를 전용 worktree (`<git common dir>/perf-ratchet/wt`, 재사용) 에 checkout 하고 `pnpm install --offline --frozen-lockfile` 뒤 그 root 를 5179 로 서빙해 잰다. engine wasm 은 gitignored 라 메인에서 복사하므로, 메인의 `packages/engine` 이 push 대상과 다르거나 wasm 이 소스보다 오래되면 차단. 시간 예산: **통과 경로 (부팅 + 1회 실행) ≤ 90 초, 초과 재실행 포함 최악 ≤ 180 초** — G0 가 둘 다 실측한다. hook 삽입은 기존 ADR-198 블록의 조기 `exit 0` 뒤가 아니라 **스코프 판정 → 해당 게이트들 실행 → 마지막에 한 번 exit** 구조로 hook 을 재구성한다 (breakdown §3-1).
- **HC5 Phase 2 의 동작 불변** — 첫 하향 대상의 수정은 반환값 · canonical 문서 · history · 시각 결과가 바이트 동일해야 하고, 원복 RED (수정을 되돌리면 카운트 상한 초과로 게이트 FAIL) 를 남긴다.
- **HC6 begin-frame 은 브라우저 tick 수의 결정성만 계약한다** — N begin-frame → 페이지 rAF 콜백 N 이 2회 동일. Canvas 의 `render.frame` 은 필요할 때만 rAF 를 요청하는 scheduler (`frameScheduler.ts:24-32` — dirty 일 때만 request) 의 결과이므로 **tick 수와 분리해 판정**한다: idle 은 `render.frame` 0 (또는 초기 안정화 소수 · 2회 동일), pan 은 `--fixed-inputs` 입력 프레임 수와 같다. 연속 240 render 를 기대하는 부류는 지속 갱신 fixture (예: 애니메이션 요소) 를 따로 둘 때만. 프레임당 시간 (8.33 ms 예산 초과 수) 은 wall-clock 파생이라 Phase 3 에서 2회 편차를 잰 뒤에 등급 B 편입 여부를 정한다 — 편차 > 3% 면 참고 열. **플랫폼**: CDP 정본은 begin-frame 제어 타깃 (`Target.createTarget({ enableBeginFrameControl: true })`) 을 "headless shell only, not supported on MacOS yet" 으로 명시한다 — 이 작업 환경 (macOS, Docker 없음) 에서는 기능 검증 전에 플랫폼 no-go 가 확정이다. Phase 3 는 Linux 실행 환경이 있을 때만 열리고 (사용자 결정 4), 없으면 Deferred 로 닫는다.

### Soft constraints

- 하니스는 `perf-baseline.mjs` 하나를 보강한다 — 별도 벤치 프레임워크 (vitest bench · tinybench) 도입 없음.
- ratchet 파일은 사람이 diff 로 읽을 수 있는 JSON 한 개, 부류 × 시드 × 지표.
- 야간 잡 (글의 120Hz nightly regression) 은 이 저장소의 push 흐름 (web PR 금지 · CI status check 없음) 에 차단 지점이 없으므로 범위 밖 — pre-push 가 첫 차단 지점이다.

## Alternatives Considered

### 대안 A: 결정적 카운트 ratchet JSON + 경로 스코프 pre-push 게이트 + begin-frame 하니스

- 설명: §8 의 `counts` 를 등급 A/B 로 나눠 `apps/builder/perf/ratchet.json` 에 상한으로 고정하고, `perf-ratchet-gate.mjs` 가 `perf:baseline --fixed-inputs` 를 돌려 비교 · 자기검증 (HC2) · 하향 제안을 한다. `.githooks/pre-push` 가 경로 스코프로 호출한다. 첫 하향 1건 (§8-4 hotspot) 으로 "카운트 ↓ ↔ taskMs ↓" 상관을 변경 전/후 A/B 로 증명한다. begin-frame 은 `--begin-frame` 옵션 (chromium_headless_shell + `--enable-begin-frame-control`, `HeadlessExperimental.beginFrame` N회) 으로 프레임 수를 고정한다.
- 근거: 글의 운영 모델 그대로 (결정적 카운트 → ratchet → 필드 확인 → 하향). 이 저장소 선례: ADR-201 번들 ratchet (`APPROVED` · 만료일) · ADR-198 경로 스코프 pre-push + 탈출구 · ADR-236 AST ratchet.
- 위험: 기술(M) / 성능(L) / 유지보수(M) / 마이그레이션(L)
  - 기술 M: begin-frame 제어는 CDP 정본상 chrome-headless-shell 전용 + begin-frame 제어 타깃 생성 필요 + **macOS 미지원** — 이 환경에서는 Linux 실행 경로가 없으면 Phase 3 가 열리지 않는다 (사용자 결정 4). React 렌더 measure 는 dev 빌드 전용 (production 게이트 불가 — 등급 B 로만 쓴다).
  - 유지보수 M: 하니스 recorder 자체를 바꾸면 카운트가 바뀌어 기준 재설정이 필요하다 — ratchet 파일에 하니스 버전 (recorder 해시) 을 같이 기록해 재설정을 명시화.
  - 성능 L: 게이트 ≤ 90 초 · 경로 스코프.

### 대안 B: wall-clock 통계 게이트 (N회 실행 중앙값 + 허용치)

- 설명: 같은 부류를 5회 돌려 gap p95 · taskMs 의 중앙값을 상한과 비교. 허용치는 같은 코드 편차로 정한다.
- 근거: 일반적인 벤치 게이트 형태 (Lighthouse CI · benchmark.js 류).
- 위험: 기술(M) / 성능(H) / 유지보수(M) / 마이그레이션(L)
  - 성능 H: 5회 × 부류 × 시드 = 게이트 5분 이상 → HC4 위반. 그래도 §8-3 의 "600 이 60 보다 빠름" 급 노이즈는 중앙값으로 안 지워진다 (headless SwiftShader · 병렬 세션 CPU 경합).
  - 기술 M: 허용치를 넓히면 회귀를 못 잡고 좁히면 false block — 글이 "milliseconds are too flaky" 로 버린 형태.

### 대안 C: 게이트 없이 야간 회귀 잡 (원격 러너 · 120Hz rig)

- 설명: GitHub Actions 또는 로컬 cron 이 매일 `perf:baseline` 을 돌리고 결과 diff 를 기록한다. push 는 막지 않는다.
- 근거: 글의 "120 Hz rig became a nightly regression-detection job".
- 위험: 기술(L) / 성능(L) / 유지보수(M) / 마이그레이션(H)
  - 마이그레이션 H: 회귀가 push 뒤에 발견되고, 이 저장소는 PR 이 없어 되돌릴 자리가 revert 커밋뿐이다 — 병렬 세션 활동 중 revert 는 경합 위험 (메모리 `feedback-git-add-all-swallows-parallel-session-wip`). 원격 러너는 GPU · Chrome 버전이 로컬과 달라 카운트 기준이 두 벌이 된다.
  - 유지보수 M: 결과를 읽는 사람이 없으면 잡은 돌기만 한다 (글은 Claude 가 스레드를 열었다 — 이 저장소엔 그 역할이 없다).

### 대안 D: Valgrind 명령어 수 (node `--predictable` + Ir)

- 설명: 글의 1차 지표를 그대로 — 순수 함수 벤치를 Node 에서 Valgrind 아래 돌려 명령어 수를 센다.
- 위험: 기술(H) / 성능(L) / 유지보수(M) / 마이그레이션(M)
  - 기술 H: macOS (Darwin 27) 에 Valgrind 가 없고, 비용의 대부분이 브라우저 안 (Skia · React · 엔진 wasm) 이라 Node 단독 벤치가 대표성이 없다 (Q1). CDP precise coverage 의 함수 호출 수가 같은 역할을 브라우저 안에서 한다 (§8-4) — 대안 A 에 흡수.

### Risk Threshold Check

| 대안 | HIGH+          | 판정                                                                                                      |
| ---- | -------------- | --------------------------------------------------------------------------------------------------------- |
| A    | 없음           | 채택 — 기술 M (begin-frame macOS 미지원 · dev 전용 measure) 은 Phase 3 사용자 결정 4 + 등급 B 격리로 관리 |
| B    | 성능 H         | 기각 — HC4 위반 · 노이즈 제거 안 됨                                                                       |
| C    | 마이그레이션 H | 기각 — 차단 지점 없음. 대안 A 뒤 보조 (범위 밖)                                                           |
| D    | 기술 H         | 기각 — 플랫폼 · 대표성. A 의 `--call-counts` 가 대체                                                      |

루프 1회 — 대안 A 에 HIGH 없음.

## Decision

**대안 A.** 위험 수용 근거: 등급 A/B 분리는 §8-2 실측 (262/16) 위에 있고, 게이트 자기검증 (HC2) 이 하니스 결함을 차단과 구별한다. begin-frame 은 프레임 수 결정성만 계약하고 (HC6) 불가 판정이 나도 Phase 0~2 의 가치는 남는다.

기각 사유 — B: 시간 5배에 노이즈는 그대로. C: push 뒤 발견은 이 저장소에서 되돌릴 자리가 없다. D: 플랫폼에 없고 브라우저 비용을 못 잰다.

**사용자 결정 지점 (본문에 둔다)**:

1. **Phase 2 포함 여부** — 첫 하향 1건 (select `findNodeByIdInSubtree` 2,097/op 또는 edit `serializeLayoutRelevantValue` 17,422/op 중 하나) 은 사용자가 지시한 "ratchet 게이트 + begin-frame" 보다 넓다. 포함하는 이유는 글이 한 "카운트 ↔ wall-clock 상관 증명" 이 최적화 전/후 A/B 로만 성립하기 때문이다 (§8-3 은 규모 비교뿐). 제외하면 G2 는 후속 ADR 로 옮기고 본 ADR 은 게이트만으로 Implemented 가 된다.
2. **게이트 부류·시드** — Phase 0 실측 시간이 90 초를 넘으면 무엇을 뺄지 (제안: 60 요소 × select · edit · page-switch · panel-toggle · zoom, 600 은 edit · select 만). → **Phase 0 결과: 60 요소 call-counts × select · edit · page-switch · panel-toggle (25초) + 600 요소 × select · edit (16초)**. 시간 예산 안이라 축소 불요. zoom 은 60 요소 3회째에 등급 A 성격 값이 움직여 (layout.publish 14 → 19) 제외.
3. **등급 B 밴드 3%** — §8-2 최대 편차 (panel-resize React measure 556 → 572, 2.9%) 로 정한 값. Phase 0 3회 실측이 더 크면 재설정. → **Phase 0 결과: 1.05 로 재설정** (게이트 부류 값 ≥ 20 의 최대 편차 4.2% — page-switch `RecalcStyleCount` 99/98/95). 사용자 확인 대상.
4. **Phase 3 실행 환경** — begin-frame 제어는 macOS 미지원 (CDP `Target.createTarget.enableBeginFrameControl`) 이고 이 환경에 Docker 가 없다. 선택지: (a) Linux 러너 (GitHub Actions ubuntu · 별도 Linux 머신) 에 하니스 + dev 서버 + 라이선스 세션을 옮겨 Phase 3 실행 — 비용은 CI 환경 구축, (b) Phase 3 를 **Deferred** 로 닫고 프레임 축은 `--headed` 실측 유지 (재개 조건: Linux 실행 환경 확보). 기본 제안은 (b) — Phase 0~2 의 가치가 Phase 3 에 의존하지 않는다. → **기본안 (b) Deferred 적용** — Linux 러너를 원하면 재개.

> 구현 상세: [246-deterministic-count-ratchet-breakdown.md](design/246-deterministic-count-ratchet-breakdown.md)

## Risks

| ID  | 위험                                                                                                                                                            | 심각도 | 대응                                                                                                                                                                                          |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----: | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | 등급 B 밴드 밖 자연 변동으로 false block (rAF 배칭 · transition 시점)                                                                                           |  MED   | HC2 재실행 확인 · Phase 0 3회 편차로 밴드 확정 · 등급 B 는 단독으로 차단하지 않고 등급 A 초과와 함께일 때만 (G1)                                                                              |
| R2  | 카운트 감소가 체감 개선으로 오인됨 (dev 전용 React measure · headless)                                                                                          |  MED   | HC1 참고 열 · Phase 2 taskMs A/B 병기 · 판정 oracle 은 ADR-243 Event Timing 이라고 문서에 고정                                                                                                |
| R3  | 상한 올리기가 형식 승인으로 굳음 (번들 상한이 09-17 → 09-25 → 09-26 세 번 재승인된 이력)                                                                        |  MED   | HC3 사유 + 만료일 필수 · 올린 항목은 README 열림 절에 노출 · 만료 뒤 게이트가 다시 원 상한으로 판정                                                                                           |
| R4  | begin-frame 제어가 macOS 미지원 (CDP 정본) · chrome-headless-shell 전용 · GPU 는 SwiftShader 고정 — 이 환경에서 Phase 3 는 플랫폼 no-go                         |  MED   | 사용자 결정 4 (Linux 러너 또는 Deferred) · Deferred 면 §8 에 사유 기록 · 프레임 축은 `--headed` 실측 유지                                                                                     |
| R5  | 하니스 recorder 변경이 카운트를 바꿔 기준 재설정을 요구 · 병렬 세션이 하니스를 같이 수정                                                                        |  LOW   | ratchet 파일에 recorder 해시 기록 · 불일치면 "기준 재설정 필요" 출력 (차단 아님)                                                                                                              |
| R6  | 게이트 경로 스코프가 회귀 경로를 놓침 (engine · specs · shared 유틸) 또는 너무 넓어 매 push 90 초 · engine 변경이 wasm 재빌드 없이 측정돼 stale 바이너리를 잰다 |  MED   | 스코프에 `packages/engine/` · `packages/specs/` 포함 · engine 변경 push 는 wasm 산출물 신선도 (engine src 최신 mtime ≤ `engine_bg.wasm` mtime) 를 확인, 아니면 차단 · 실행 시간 실측 · 탈출구 |

잔존 HIGH 위험 없음.

## Gates

측정 공통: dev 서버 5173 · headless Chrome (channel chrome, Phase 3 만 chromium_headless_shell) · `--fixed-inputs` · 시드 60 (+ 600 일부) · 결과 JSON 은 run 별 고유 파일 · 같은 코드 동일성은 **2회 실행 diff** 로 (등급 A 0 · 등급 B 밴드 안). 게이트 실행 시간은 부팅 포함 wall-clock 으로 기록.

| Gate | 시점    | 통과 조건                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | 실패 시 대안                                                                                                                                          |
| ---- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| G0   | Phase 0 | 같은 옵션 3회: 등급 A diff 0 · 등급 B 최대 편차 ≤ 3% (아니면 밴드 재설정 + 사용자 결정 3) · `--call-counts` 2회 동일성 (앱 코드 함수 상위 20 의 count) · 게이트 후보 부류·시드의 **통과 경로 시간 (자체 dev 서버 부팅 + 1회) ≤ 90 초와 초과 경로 (재실행 포함) ≤ 180 초** 둘 다 실측 · `ratchet.json` 초기값 + recorder 해시 · pre-push 스코프가 §8-4 hotspot 파일 4 + `packages/engine/` · `packages/specs/` 를 덮는지 대조 · dev define (서빙 root) 이 5173 과 자체 서버 양쪽에서 읽히는지                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | 시간 초과면 사용자 결정 2 (부류·시드 축소) · 등급 A 에 diff 가 있으면 그 지표를 등급 B 또는 참고 열로 강등하고 원인 (드라이버 벽시계 잔여 등) 을 기록 |
| G1   | Phase 1 | `perf-ratchet-gate.mjs`: (a) 상한을 인위적으로 1 낮춘 ratchet 으로 FAIL · (b) 호출 수를 올리는 임시 변경 (예: 선택 경로에 중복 탐색 1회) 으로 FAIL 뒤 원복 GREEN · (c) HC2 자기검증 — 첫 실행 초과 · 재실행 통과 시 "측정 불가" 출력 · (d) 하향 제안 diff 만 자동, 올리기는 승인 필드 없으면 거부 · (e) **설치된 hook** (`core.hooksPath=.githooks`) 으로 스코프 밖 push 즉시 통과 · 스코프 안 push 가 246 블록에 **도달** (로그) · 5173 부재 → 자체 서버로 측정 · 5173 이 다른 root → 자체 서버 · 서버 확보 실패 → 차단 · 워킹트리 dirty (스코프) → 차단 · `SKIP_PERF_RATCHET=1` 출력 · **`SKIP_VISUAL_PARITY=1` + 스코프 안 push → 246 블록 도달 · 측정** (visual 탈출구가 ratchet 을 우회하지 않음) · `SKIP_PERF_RATCHET=1` + D3 경로 push → ADR-198 smoke 실행 · 자체 서버가 정확히 `localhost:5179` 에서 ready (5179 점유 시 `--strictPort` 실패 → 차단) · push 대상 ≠ HEAD 또는 런타임 파일 dirty → worktree 경로로 측정 (차단 아님, 다른 세션 WIP 보존) · worktree 경로에서 메인 engine ≠ push 대상 → 차단 · (f) 단위 테스트 (판정 함수 순수 — fixture 6) · (g) engine 변경 fixture 로 wasm 신선도 차단 1회 | (e) 시간 초과면 사용자 결정 2                                                                                                                         |
| G2   | Phase 2 | 첫 하향 1건: 카운트 RED 고정 (수정 전 값이 새 상한 초과) → 수정 → 등급 A 카운트 ≥ 30% 감소 · 60/600 taskMs before/after 교대 3쌍 중앙값 감소 (Q3 — 방향만, 크기 판정 아님) · 반환값 · canonical · history 바이트 동일 (unit) · 시각 결과 동일 (`/cross-check` 1 컴포넌트) · **원복 RED** (수정 되돌리면 게이트 FAIL) · 상한 하향 커밋                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | 카운트는 줄고 taskMs 가 안 줄면 그 지표를 참고 열로 강등하고 사유 기록 (상관 반증 = 값어치 있는 결과)                                                 |
| G3   | Phase 3 | **Linux 실행 환경이 있을 때만** (사용자 결정 4): chromium_headless_shell + `--enable-begin-frame-control --run-all-compositor-stages-before-draw` + `Target.createTarget({ enableBeginFrameControl: true })` 로 만든 타깃에 `HeadlessExperimental.beginFrame({ frameTimeTicks, interval: 8.333 })` × 240 → 페이지 rAF 콜백 240 (2회 동일) · idle `render.frame` 0 (2회 동일) · pan `render.frame` = 입력 프레임 수 (2회 동일) · 프레임당 시간 2회 편차 → ≤ 3% 면 등급 B, 아니면 참고 열 · 환경이 없으면 Phase 3 Deferred 기록 (no-go 는 실패가 아니다)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Deferred — 프레임 축은 `--headed` 유지 · 재개 조건 = Linux 환경                                                                                       |
| G4   | Phase 4 | Live Exercise: 실제 push 에서 게이트가 1회 차단 (G1 (b) 임시 변경 커밋 → push 거부 → 원복) + 스코프 밖 push 즉시 통과 1회 · README · research 문서 §9 · (Phase 2 포함 시) CHANGELOG · 메모리                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | —                                                                                                                                                     |

### Live Exercise

(Implemented 승격 시 기재 — G4 의 push 차단 1회 · 통과 1회 · 날짜 · Chrome MCP / 사용자 confirm 구분)

## Consequences

### Positive

- 성능 회귀가 push 직전에 잡힌다 — 번들 크기 외에 처음으로 프레임 · 상호작용 축의 ratchet 이 생긴다.
- "최적화 스레드" 의 착수 규약이 하나로 고정된다: 카운트 RED → 수정 → 상한 하향. `--call-counts` 가 다음 대상을 자동으로 보여 준다 (§8-4).
- Phase 2 (포함 시) 가 "카운트 ↔ wall-clock" 상관을 최적화 전/후로 증명해 이후 게이트 판정의 근거가 된다.
- begin-frame go 면 프레임 축이 headless 에서 결정적으로 잡혀 CLAUDE.md 의 60Hz floor 판정을 `--headed` 없이 반복할 수 있다.

### Negative

- 스코프 안 push 마다 최대 90 초 — ADR-198 smoke 와 겹치면 2~3 분. 탈출구가 있지만 습관화되면 게이트가 없는 것과 같다 (R3 와 같은 종류).
- ratchet 파일 갱신 커밋이 성능 변경마다 따라붙는다 (하향 제안 diff 를 같은 커밋에).
- React 렌더 measure 는 dev 전용이라 production 회귀 (dev 에만 있는 measure 비용 포함) 와 다를 수 있다 — 등급 B 로 격리했지만 판정 근거로 오인될 여지 (R2).
- 하니스 변경이 잦은 시기엔 기준 재설정이 반복된다 (R5).
