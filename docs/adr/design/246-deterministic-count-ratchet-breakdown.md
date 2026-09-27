# ADR-246 구현 상세 — 결정적 카운트 ratchet 게이트 + begin-frame 하니스

> 본문: [completed/246-deterministic-count-ratchet-and-begin-frame-harness.md](../completed/246-deterministic-count-ratchet-and-begin-frame-harness.md)
> 이 문서는 Phase · 파일 변경표 · 측정 절차 · 판정 규칙만 담는다. 결정·위험·Gate 정본은 ADR 본문.

## 0. 전제 lock-in (fork 아님)

이 ADR 은 기존 ADR 을 나누거나 합치지 않는다. 1단계 (하니스 카운트 수집 · §8) 는 커밋 `80a824e18` · `0ae25aba7` 로 main 에 있고, 본 ADR 은 그 위의 게이트 층이다.

| 질문                    | 답                                                                                                                                           |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| base / 응용             | 본 ADR 은 측정 인프라 (base 쪽). ADR-243 (Event Timing 판정) 과 직교 — 서로 의존 없음, 243 하니스가 생기면 Phase 2 참고 열만 교체            |
| schema 직교성           | 저장 스키마 · canonical · history 변경 0. 새 파일은 `ratchet.json` (도구 설정) 하나                                                          |
| 선행 ADR 전제 승계      | ADR-201 의 `APPROVED` · 만료일 규약과 ADR-198 의 경로 스코프 · 탈출구 규약을 **형식만** 승계 — 상한 값 · 경로는 Phase 0 실측으로 새로 정한다 |
| 결정 지점 (사용자 질문) | 본문 Decision 의 3개 (Phase 2 포함 여부 · 게이트 부류·시드 · 등급 B 밴드) 만                                                                 |

## 1. Phase 개요

| Phase | 내용                                                                                | 산출                                                                                                                                 | Gate |
| ----- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ---- |
| 0     | 3회 동일성 · call-counts 동일성 · 실행 시간 · 초기 ratchet · 스코프 대조            | evidence `246-phase0-ratchet-baseline.md` · `apps/builder/perf/ratchet.json`                                                         | G0   |
| 1     | 게이트 스크립트 + 판정 단위 테스트 + pre-push 연동 + 탈출구                         | `perf-ratchet-gate.mjs` · `.githooks/pre-push` 블록 · `gate:perf-ratchet`                                                            | G1   |
| 2     | (사용자 결정 1) 첫 하향 1건 — 카운트 RED → 수정 → 상한 하향 + taskMs A/B            | 수정 커밋 + ratchet 하향 커밋 · evidence                                                                                             | G2   |
| 3     | begin-frame go/no-go — Linux 실행 환경이 있을 때만 (사용자 결정 4), 없으면 Deferred | `--begin-frame` 옵션 · evidence · §8 갱신 (또는 Deferred 사유)                                                                       | G3   |
| 4     | 완료 (G4 PASS)                                                                      | 실제 push 차단 1회 (92초 · 재실행 같은 값) · 스코프 밖 push 통과 · 게이트 실전 통과 2회 (`ba7fb9828` 42초 · `cfa012e55` 41초) — §8-3 |

Phase 0 → 1 → (2) → 3 → 4. Phase 3 no-go 는 정상 종결이며 Phase 4 로 진행한다.

## 2. Phase 0 — 기준 고정

### 2-1. 실행

```bash
for i in 1 2 3; do pnpm perf:baseline -- --lane frame --seed-count 60 --fixed-inputs --out /private/tmp/perf-ratchet/p0-60-$i; done
for i in 1 2;   do pnpm perf:baseline -- --lane frame --seed-count 600 --fixed-inputs --classes select,edit --out /private/tmp/perf-ratchet/p0-600-$i; done
for i in 1 2;   do pnpm perf:baseline -- --lane frame --seed-count 60 --fixed-inputs --call-counts --classes select,edit,page-switch,panel-toggle --out /private/tmp/perf-ratchet/p0-cc-$i; done
```

각 실행의 wall-clock (부팅 포함) 을 기록한다 — 게이트 후보 조합의 합이 ≤ 90 초여야 한다. 넘으면 본문 사용자 결정 2.

### 2-2. 등급 판정 규칙 (판정 함수 `classifyCounts` 의 계약)

| 등급 | 대상 (research 문서 §8-2 실측 기준)                                                                                                                                | 상한             | 초과 판정                                                        |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------- | ---------------------------------------------------------------- |
| A    | `perfLabels.*` (longtask 제외) · `caches.*.hits/misses` · `layoutVersionDelta` · `domMutations.attributes/characterData` · (G0 통과 시) `v8.app` · `v8.topApp[].n` | 값 그대로        | 값 > 상한 → 초과 (재실행 확인 HC2)                               |
| B    | `reactRenderMeasures` · `cdp.LayoutCount` · `cdp.RecalcStyleCount` · `domMutations.childList` · rAF 경계 부류의 `render.frame` (select · zoom)                     | 값 × 1.03 (올림) | 값 > 상한 → 초과 (등급 A 초과와 함께일 때만 차단, 단독이면 경고) |
| 참고 | `gapP95` · `taskMs` · `longTasks` · `allocMBps`                                                                                                                    | 없음             | 출력만                                                           |

3회 실행에서 등급 A 에 diff 가 하나라도 있으면 그 지표는 B 로 강등하고 원인을 evidence 에 적는다. 등급 B 최대 편차가 3% 를 넘으면 밴드를 그 값 + 1% 로 올리고 본문 사용자 결정 3 으로 보고한다.

### 2-3. `ratchet.json` 형식

```jsonc
{
  "version": 1,
  "recorderSha256": "<RECORDER_SCRIPT 문자열 해시 — 불일치면 기준 재설정 필요 출력>",
  "generatedAt": "2026-09-27",
  "head": "<git sha>",
  "bandB": 1.03,
  "seeds": {
    "60": {
      "select": {
        "A": {
          "perfLabels.render.frame": 62,
          "caches.commandStream.hits": 32,
          "...": 0,
        },
        "B": { "reactRenderMeasures": 5919, "cdp.RecalcStyleCount": 190 },
      },
      "edit": { "...": 0 },
    },
    "600": { "select": {}, "edit": {} },
  },
  "raises": [
    // 올리기 이력 — 실행자가 만들지 않는다 (HC3)
    // { "path": "seeds.60.edit.A.perfLabels.scene.build", "from": 16, "to": 18, "approvedBy": "사용자", "on": "YYYY-MM-DD", "reason": "...", "expires": "YYYY-MM-DD" }
  ],
}
```

값은 평탄 키 (`a.b.c`) 로 두어 diff 가 한 줄 = 한 지표가 되게 한다.

### 2-4. pre-push 스코프 대조

§8-4 hotspot 파일의 경로가 스코프에 들어야 한다:

| 파일                                                                                                                                                           | 스코프 경로                                                                                                                                                                                      |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `apps/builder/src/builder/components/slotHostPolicy.ts`                                                                                                        | `apps/builder/src/builder/components/`                                                                                                                                                           |
| `apps/builder/src/builder/stores/canonical/canonicalDocumentStore.ts`                                                                                          | `apps/builder/src/builder/stores/`                                                                                                                                                               |
| `apps/builder/src/builder/workspace/canvas/scene/layoutCache.ts` · `buildSceneSnapshot.ts` · `skia/StoreRenderBridge.ts` · `styleConversion/borderGeometry.ts` | `apps/builder/src/builder/workspace/canvas/` (ADR-198 과 같은 경로)                                                                                                                              |
| `apps/builder/src/builder/panels/properties/FrameSlotSection.tsx`                                                                                              | `apps/builder/src/builder/panels/`                                                                                                                                                               |
| `packages/shared/src/`                                                                                                                                         | catalog · nesting · domain 술어                                                                                                                                                                  |
| `packages/engine/src/` · `packages/engine/Cargo.toml`                                                                                                          | 레이아웃 엔진 (Rust) — 게이트는 wasm 산출물 신선도 (`engine-pkg/engine_bg.wasm` mtime ≥ engine src 최신 mtime) 를 먼저 확인, 아니면 "wasm 재빌드 필요" 로 차단 (메모리: cargo stale binary 함정) |
| `packages/specs/src/`                                                                                                                                          | 잔존 spec 3 + CSS 생성기 (Canvas · Preview 소비)                                                                                                                                                 |
| `apps/builder/scripts/perf-baseline.mjs` · `apps/builder/perf/ratchet.json`                                                                                    | 하니스 · 기준 자체                                                                                                                                                                               |

## 3. Phase 1 — 게이트

### 3-1. 파일 변경표

| 파일                                                     | 변경                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/builder/scripts/perf-ratchet-gate.mjs` (신규)      | `judge({ratchet, results})` 순수 함수 (등급 판정 · 초과 목록 · 하향 제안 · recorder 해시 대조) + CLI: `--run` (perf:baseline 을 자식 프로세스로 실행, 초과 시 1회 재실행 HC2) · `--update` (하향만 기록) · `--raise <path> --to <n> --approved-by --reason --expires` (승인 필드 전부 없으면 거부) · `--self-test` (fixture 6)                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `apps/builder/scripts/perf-ratchet-run.mjs` (신규)       | 실행부 — `revisionProblems` · `engineWasmProblem` · `prepareWorktree` · `acquireServer` · `storageStateFor` · `measureOnce` · `runGate`. 판정 순수 함수는 gate 파일에 남긴다                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `apps/builder/scripts/perf-ratchet-gate.test.mjs` (신규) | `node --test` (기존 `perf-baseline.test.mjs` 와 같은 방식) — judge fixture: 등급 A 초과 · B 단독 초과 (경고) · A+B 초과 (차단) · 재실행 불일치 (측정 불가) · recorder 해시 불일치 · 하향 제안                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `apps/builder/scripts/perf-baseline.mjs`                 | `--out-json <path>` (고정 파일명으로 결과 저장 — 게이트가 읽기 쉽게) · RECORDER_SCRIPT 해시 export                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `.githooks/pre-push`                                     | **재구성** (삽입이 아님): ① push 범위 변경 파일 수집 (기존) → ② 스코프 판정 두 개 (`D3_PATHS` → ADR-198 smoke · `PERF_RATCHET_PATHS` → 246) → ③ 해당하는 게이트를 순서대로 실행, 실패 즉시 exit 1 → ④ 마지막에 한 번 exit 0. 현재 hook 의 조기 `exit 0` **세 곳** (`:22-25` `SKIP_VISUAL_PARITY` · `:55` D3 미매칭 · `:80` 끝) 을 모두 없애고 `RUN_PARITY` · `RUN_RATCHET` 플래그로 바꾼다 — `SKIP_VISUAL_PARITY=1` 은 `RUN_PARITY=0` 만, `SKIP_PERF_RATCHET=1` 은 `RUN_RATCHET=0` 만 만든다 (각각 출력). 빈 변경 목록 (`:47`) 만 hook 전체 조기 종료로 남긴다. 246 블록: `SKIP_PERF_RATCHET=1` 탈출구 (출력) · revision 일치 (push `local_sha` = `HEAD` · 런타임 tracked 파일 staged/unstaged 0 — §3-4) 아니면 차단 · engine 변경 시 wasm 신선도 → 차단 · 서버 확보 (§3-4) 실패 → 차단 |
| `package.json`                                           | `gate:perf-ratchet`: `node apps/builder/scripts/perf-ratchet-gate.mjs --run`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `apps/builder/vite.config.ts`                            | dev 전용 plugin `devIdentityPlugin` — `GET /__composition_dev_root` → `{ root, port }`. 게이트가 서버 준비와 서빙 root 를 브라우저 없이 확인한다 (`logLevel: "warn"` 이라 Vite 가 URL 을 출력하지 않는다 — Phase 1 실측). define 안은 페이지 evaluate 가 필요해 대체                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `scripts/install-git-hooks.sh`                           | 안내 문구에 246 게이트 · 탈출구 추가                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |

### 3-2. 판정 출력 형식

```
[ADR-246] perf ratchet — seed 60 · classes select,edit,page-switch,panel-toggle,zoom · 47.3 s
  등급 A 초과 2:
    seeds.60.select.A.perfLabels.render.frame   62 → 71   (+14.5%)
    seeds.60.select.A.caches.commandStream.misses 0 → 9
  등급 B 초과 (경고) 1: seeds.60.select.B.reactRenderMeasures 5919 → 6102 (+3.1%, 밴드 3%)
  재실행: 같은 값 → 차단
  하향 가능 4 (--update 로 기록): seeds.60.edit.A.perfLabels.scene.build 16 → 14 …
```

### 3-3. HC2 자기검증

첫 실행 초과 → 같은 조건 재실행 → (a) 두 번 다 초과이고 값이 같으면 차단, (b) 재실행이 통과면 "측정 불가 — 하니스 결함 의심 (같은 코드 · 다른 값)" 출력 후 통과 (exit 0) 하되 결과 JSON 두 개 경로를 남긴다.

### 3-4. 측정 대상 · 서버 확보 (round 1·2 h2 → Phase 1 개정)

push 대상 코드만 잰다. Phase 1 실행 중 개정: 리뷰 확정안의 "런타임 경로 dirty → 차단" 은 병렬 세션의 미커밋 WIP 가 흔한 이 checkout 에서 거의 모든 push 를 막는다 (세션 시작 시점 dirty 17 파일 · 2026-09-27). 차단 대신 push 대상 sha 를 따로 checkout 해 잰다.

1. **빠른 경로** — push `local_sha` = `HEAD` 이고 `git status --porcelain -- apps packages package.json pnpm-lock.yaml pnpm-workspace.yaml patches turbo.json` 의 tracked 항목 (`??` 제외) 이 0 → 메인 워킹트리를 잰다. 서버: `http://localhost:5173/__composition_dev_root` 의 root 가 이 저장소면 재사용, 아니면 5179.
2. **worktree 경로** — 아니면 `<git common dir>/perf-ratchet/wt` (없으면 `git worktree add --detach`, 있으면 `checkout --detach --force <sha>` — 게이트 전용이라 강제 checkout 이 다른 작업을 지우지 않는다) → `pnpm install --offline --frozen-lockfile` (실패 시 온라인 1회 · postinstall 이 canvaskit · specs · upload 산출물을 만든다) → gitignored engine wasm · 라이선스 토큰을 메인에서 복사 → 그 root 를 5179 로 서빙. engine wasm 은 복사이므로 메인의 `packages/engine` 이 push 대상과 다르거나 (`git diff --quiet <sha> -- packages/engine` ≠ 0) wasm 이 소스보다 오래되면 차단.
3. **자체 서버** — `pnpm exec vite --port 5179 --strictPort` (cwd = 측정 root 의 `apps/builder`, `DEV_PORTS` 는 `dev:kill` 전용이라 쓰지 않는다). 준비 판정 = `/__composition_dev_root` 가 측정 root 를 돌려줄 때 (상한 60 초). 5179 를 다른 root 가 쓰고 있으면 차단. 저장된 `.auth-session.json` 의 origin 을 5179 로 바꾼 임시 storage state 로 하니스 실행 · 종료 시 서버 kill.
4. 서버 · worktree 확보 실패 → 차단 (exit 1) + 원인 출력. 통과시키는 길은 `SKIP_PERF_RATCHET=1` 뿐.

G0 가 빠른 경로와 worktree 경로 각각의 준비 시간을 통과 경로 예산 (≤ 90 초) 안에서 실측한다.

## 4. Phase 2 — 첫 하향 1건 (사용자 결정 1)

대상 후보 (§8-4, 60 요소 · 조작 1회당):

| 후보 | 함수                                                           | 호출/op | 가설                                                                                           | RED 지표 (등급 A)                                         |
| ---- | -------------------------------------------------------------- | ------: | ---------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| ①    | `findNodeByIdInSubtree` (canonicalDocumentStore) — 선택 경로   |   2,097 | `FrameSlotSection` 의 useMemo 들이 요소 목록을 돌며 매 요소에 서브트리 탐색 → 선택 1회에 O(N²) | `v8.topApp[findNodeByIdInSubtree]` · select `v8.app`      |
| ②    | `serializeLayoutRelevantValue` · `stableSerialize` — 편집 경로 |  17,422 | 편집 1회에 전체 트리 직렬화 (layoutCache 키 · scene snapshot) — 바뀐 서브트리만이어야 한다     | `v8.topApp[serializeLayoutRelevantValue]` · edit `v8.app` |

하나만 고른다 (기본 ①: 파일 2 · 600 요소에서 O(N²) 이면 taskMs 방향이 분명).

**① 실측 원인 (Phase 2 착수 시 — 가설 정정)**: 상위 3000 함수 호출 수 프로브로 호출자를 좁혔다. `FrameSlotSection` 은 `findNodeById` 를 부르지 않는다. 선택 60회에 `useEditContract` → `useCanonicalNode` → `selectCanonicalNode` 가 180회 (조작당 3 — `useSyncExternalStore` snapshot) 실행되고, 매번 문서 전체 (페이지 + origin · 템플릿 포함 약 700 노드) 를 선형 탐색한다 (조회당 `findNodeByIdInSubtree` 평균 349.5). O(N²) 가 아니라 **조회 수 × 문서 크기**다. 수정: `selectCanonicalNode` 전용 id 인덱스 — 문서 identity 와 `documentVersion` 이 같을 때만 재사용 (`canonicalTraversalHelpers.ensureCache` 와 같은 무효화 규칙), `findNodeById` 와 같은 전위 DFS · 첫 일치 우선. 기존 `getNodeMap()` 은 마지막 일치 우선이고 page ref descendants 까지 담아 반환 노드가 다를 수 있어 재사용하지 않았다. mutation 경로의 `findNodeById` (새 문서마다 1회) 는 그대로 둔다. 절차: 카운트 RED (현재 값 > 새 상한) 고정 → 수정 → unit (반환값 · canonical · history 동일) → `/cross-check` 1 → 60/600 taskMs before/after 교대 3쌍 → 원복 RED → `--update` 하향 커밋. ②는 후속 (본 ADR 범위 밖 — 착수는 §8-4 순서 · ADR-243 결과와 대조 뒤).

## 5. Phase 3 — begin-frame go/no-go

| 단계 | 내용                                                                                                                                                                                                                                                                                                                                                                                                                      | 판정                                                                                                                                                |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| 3-1  | **전제**: Linux 실행 환경 (사용자 결정 4). `chromium.launch({ headless: true, args: ["--enable-begin-frame-control", "--run-all-compositor-stages-before-draw", "--disable-new-content-rendering-timeout"] })` (channel 없음 → Playwright chromium_headless_shell) → 브라우저 CDP `Target.createTarget({ url, enableBeginFrameControl: true })` 로 타깃 생성 → 그 타깃에 attach 한 세션으로 `HeadlessExperimental.enable` | 도메인 없음 · 타깃 옵션 거부 → no-go 기록                                                                                                           |
| 3-2  | 부류 idle · pan: recorder 시작 → `HeadlessExperimental.beginFrame({ frameTimeTicks: t0 + i × 8.333, interval: 8.333 })` × 240 (응답 `hasDamage` 기록) → recorder 종료                                                                                                                                                                                                                                                     | 페이지 rAF 콜백 240 (2회 동일) · idle `render.frame` 0 (2회 동일 — scheduler 는 dirty 일 때만 rAF) · pan `render.frame` = 입력 프레임 수 (2회 동일) |
| 3-3  | 프레임당 시간: 각 beginFrame 응답의 wall-clock 과 페이지 안 `render.frame` 표본 → 8.33 ms 초과 프레임 수 2회                                                                                                                                                                                                                                                                                                              | 편차 ≤ 3% → 등급 B 편입 · 아니면 참고 열                                                                                                            |
| 3-4  | 기존 `--headed` 실측 (§3) 과 대조 1회 — 초과 프레임 수의 순서 (부류 간) 가 같은가                                                                                                                                                                                                                                                                                                                                         | 다르면 참고 열로 남기고 사유 기록                                                                                                                   |

go 면 ratchet 에 `seeds.60.pan.A.beginFrame.rafCallbacks` · `…renderFrames` 등 편입, 환경이 없거나 no-go 면 §8 에 "begin-frame — macOS 미지원 (CDP Target.createTarget) · Deferred, 재개 조건 Linux 환경" 한 절.

## 6. Phase 4 — Live Exercise · 문서

- push 차단 1회: G1 (b) 의 임시 변경을 커밋 → `git push` → 게이트 FAIL 출력 확인 → 커밋 원복 (reset) → push 통과. 스코프 밖 (문서만) push 1회 즉시 통과. 둘 다 출력 원문을 evidence 에.
- README 열림 절 갱신 · research 문서 §9 (게이트 운용) · Phase 2 포함 시 CHANGELOG (사용자-가시 성능) · 메모리 (게이트 운용 함정이 나오면).

## 7. 착수 전 5-질문 (measurement-validity §1)

| Q   | 답                                                                                                                                                          |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Q1  | 합성 시드 (60 · 600) — **규모 전용**. 카운트의 절대값은 시드 모양에 묶이며 실문서 대표성을 주장하지 않는다                                                  |
| Q2  | 불리 케이스: 600 요소 edit · select 를 게이트에 포함 (사용자 결정 2)                                                                                        |
| Q3  | Phase 2 는 before/after 교대 3쌍 taskMs — 방향만 판정 (크기는 ADR-243 oracle)                                                                               |
| Q4  | 게이트가 실제로 push 를 막는지 G4 에서 1회 실증 (hook 설치 여부 포함 — `core.hooksPath`)                                                                    |
| Q5  | oracle = 하니스 자신의 카운트 (자기 참조) — 그래서 등급 A "2회 동일" 자기검증 (HC2) 과 Phase 2 의 wall-clock 방향 대조를 같이 둔다. 체감 판정은 하지 않는다 |

## 8. 실행 결과 (2026-09-27)

| Phase | 상태           | 요약                                                                                                                                                                                                       |
| ----- | -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0     | 완료 (G0 PASS) | 3회 동일성: 60 전 부류 A 164 · B 71 / 600 A 37 · B 17 / 60 call-counts A 135 · B 38. 함수별 V8 호출 수 = 등급 A. zoom 제외. 밴드 1.05. 게이트 조합 41초 · worktree 경로 50초 · 재실행 포함 ≤ 101초         |
| 1     | 완료 (G1 PASS) | 판정 함수 9/9 · 상한 하향 FAIL · 중복 탐색 회귀 2배 → block · 원복 pass · hook 시나리오 S1 ~ S7 (skip 독립 · 포트 점유 차단 · dirty → worktree 측정 · wasm stale 차단 · 회귀 block 85초) · type-check PASS |
| 2     | 완료 (G2 PASS) | select `selectCanonicalNode` id 인덱스 — `findNodeByIdInSubtree` select 62,910 → 0 · page-switch 10,050 → 0 · select `v8.app` −11.4% · 원복 RED exit 1 · taskMs 중앙값 방향만 감소 (§8-2)                  |
| 3     | Deferred       | begin-frame 제어는 macOS 미지원 · Docker 없음. 재개 조건 = Linux 실행 환경                                                                                                                                 |
| 4     | 진행 중        | Phase 0 · 1 커밋 `ba7fb9828` push 에서 게이트 첫 실전 통과 (5173 재사용 · 42초). 남은 것: 실제 push 차단 1회 · 스코프 밖 push 통과 1회 · 문서                                                              |

`ratchet.json` 은 **게이트 코드와 같은 커밋**에서만 제자리 (`apps/builder/perf/ratchet.json`) 에 둔다. hook 은 워킹트리 파일이 곧 설치본이라, 기준만 먼저 생기면 다른 세션의 push 가 endpoint 없는 push 대상 sha 를 worktree 로 재다 60초 뒤 차단된다. 초기값은 Phase 0 의 3회 결과로 `--init` 한다 (60 = call-counts 3회 · 600 = 3회).

### 8-2. G2 — 첫 하향 1건 (select `findNodeByIdInSubtree`)

원인과 수정은 §4 ① 실측 원인. 결과:

| 항목                          | 결과                                                                                                                                                                                                                                                                  |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 카운트 (60 · call-counts)     | `findNodeByIdInSubtree` select 62,910 → 0 · page-switch 10,050 → 0 (등급 A −100%) · select `v8.app` 550,359 → 487,489 (−11.4%) · 다른 등급 A 초과 0                                                                                                                   |
| 상한 하향                     | `--update` — A 2 · B 1 하향, 새 지표 2 는 B (상위 20 에 새로 든 함수)                                                                                                                                                                                                 |
| 원복 RED                      | 수정 전 코드를 낮춘 상한으로 판정 → 등급 A 2 건 초과 · exit 1. 복원 뒤 파일 바이트 동일 · exit 0                                                                                                                                                                      |
| 동작 불변 (HC5)               | 반환 노드 identity = 선형 탐색 (같은 id 중복 시 첫 DFS 일치 · 문서 교체 · 프로젝트 전환) unit 2 추가 · canonical store 190/190 · builder 전체 7,991 PASS (teardown flake 1 — `ContextualActionBar.keyboard.test.tsx`, 단독 3/3 깨끗 · store 미사용) · type-check PASS |
| 실제 빌더                     | 하니스가 실제 빌더에서 select · edit · page-switch · panel-toggle (60) · select · edit (600) 를 구동 — page error 0 · console error 0                                                                                                                                 |
| taskMs A/B (select, 교대 3쌍) | 60: before 781.9 · 825.8 · 818.4 → after 821.0 · 760.1 · 816.8, 중앙값 818.4 → 816.8 (−0.2%). 600: before 671.5 · 841.0 · 862.9 → after 804.7 · 810.8 · 842.7, 중앙값 841.0 → 810.8 (−3.6%)                                                                           |

판정: G2 의 wall-clock 조건은 **방향만** 충족한다. 크기는 주장하지 않는다 — 줄어든 호출은 짧은 함수 약 6만 3천 번 (선택 60회 합계 수 ms 규모) 이고, before 쪽 600 요소 3회의 폭만 191 ms 다. 카운트 ↔ wall-clock 상관은 이 크기의 변경에서는 wall-clock 으로 확인되지 않는다 — 카운트 게이트가 필요한 이유와 같은 관찰이다. `/cross-check` 는 이 변경이 렌더 경로를 바꾸지 않고 (store 조회 결과 identity 동일) Preview 를 열지 않는 작업 보호 조건이 있어 unit identity 검증으로 갈음했다.

**Phase 2 중 게이트 수리 1**: 함수별 호출 수 (`v8.fn.*`) 는 상위 20 만 기록되는데, 판정이 목록에 없는 키를 0 으로 읽었다. 다른 함수에 밀려 순위 밖으로 나간 것만으로 "하향 → 0" 이 제안되고, `--update` 뒤 그 함수가 순위에 돌아오면 회귀 없이 차단된다 (값이 결정적이라 재실행도 같다). 원복 판정에서 새 지표 2 개가 "→ 0" 으로 잡혀 드러났다. 순위 밖 `v8.fn.*` 키는 판정하지 않는다 — 상한 0 은 "상위 20 밖에 머문다" 는 뜻 (판정 테스트 10/10).

### 8-3. G4 — 설치된 hook 으로 실제 push

| push                                                                                   | 대상                                                | 게이트 경로                                   | 결과                                                                                                                                                     |
| -------------------------------------------------------------------------------------- | --------------------------------------------------- | --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `60904d498..ba7fb9828` (Phase 0 · 1)                                                   | 게이트 코드 · `ratchet.json` · vite 설정            | 빠른 경로 · 5173 재사용                       | pass · 42초 · push 됨                                                                                                                                    |
| `ba7fb9828..cfa012e55` (Phase 2)                                                       | store 수정 · 낮춘 상한                              | 빠른 경로 · 5173 재사용                       | pass · 41초 · push 됨                                                                                                                                    |
| `cfa012e55..1503aa323` (회귀 — Phase 2 수정을 되돌린 선형 탐색, scratch worktree 커밋) | 사용자가 `1503aa323:refs/heads/main` 으로 직접 push | worktree 경로 (준비 7초 · 5179 자체 기동 1초) | 등급 A 2 건 초과 (`findNodeByIdInSubtree` select 0 → 62,910 · page-switch 0 → 10,050) · 재실행 같은 값 → **block** · 92초 · 원격 main `cfa012e55` 그대로 |
| 이 절을 담은 문서 커밋                                                                 | 문서만                                              | 스코프 밖                                     | 게이트 미실행 · push 됨 (소요 시간은 ADR Live Exercise)                                                                                                  |

회귀 push 는 Claude 세션의 push 보호 hook (`<sha>:refs/heads/main` 형태를 main 외 branch push 로 판정) 에 막혀 사용자가 직접 실행했다. 회귀 커밋은 main 의 HEAD 를 거치지 않았다 (다른 세션이 그 위에 커밋할 여지 없음) — scratch worktree 는 확인 뒤 제거.

### 8-1. G1 hook 시나리오 (push 없이 stdin 호출 — 검증용 detached worktree)

| 시나리오 | 조건                                       | 결과                                                                           |
| -------- | ------------------------------------------ | ------------------------------------------------------------------------------ |
| S1       | 문서만 바뀐 범위                           | exit 0 · 0초                                                                   |
| S2       | `SKIP_VISUAL_PARITY=1` + D3 · 성능 경로    | 시각 파리티만 건너뜀 · ratchet 측정 (자체 서버 5179, 2초) · pass · 45초        |
| S3       | 5179 를 다른 root 가 점유                  | 차단 · 0초                                                                     |
| S4       | 런타임 tracked 파일 dirty                  | worktree 경로 (첫 생성 12초) · pass · 57초                                     |
| S5       | engine 소스 변경 + wasm 이 소스보다 오래됨 | 차단 · 1초                                                                     |
| S6       | `findNodeByIdInSubtree` 중복 호출 회귀     | 등급 A 2건 (62,910 → 125,820 · 10,050 → 20,100) · 재실행 같은 값 · 차단 · 85초 |
| S7       | `SKIP_PERF_RATCHET=1` + D3                 | ratchet 만 건너뜀 · 시각 파리티 블록 실행                                      |

S7 의 부수 발견: 시각 파리티 블록의 ADR-205 격차표 검사는 gitignored 로컬 파일 (`docs/adr/evidence/205-text-axis-gap-matrix.md`, `dcfaec4b0` 부터 추적 제외) 을 읽어 새 checkout 에서는 실패한다 — 범위 밖, 사용자 보고.

로컬 상세 (gitignored): `docs/adr/evidence/246-phase0-ratchet-baseline.md`.
