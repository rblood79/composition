# ADR-246 구현 상세 — 결정적 카운트 ratchet 게이트 + begin-frame 하니스

> 본문: [246-deterministic-count-ratchet-and-begin-frame-harness.md](../246-deterministic-count-ratchet-and-begin-frame-harness.md)
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

| Phase | 내용                                                                                | 산출                                                                         | Gate |
| ----- | ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ---- |
| 0     | 3회 동일성 · call-counts 동일성 · 실행 시간 · 초기 ratchet · 스코프 대조            | evidence `246-phase0-ratchet-baseline.md` · `apps/builder/perf/ratchet.json` | G0   |
| 1     | 게이트 스크립트 + 판정 단위 테스트 + pre-push 연동 + 탈출구                         | `perf-ratchet-gate.mjs` · `.githooks/pre-push` 블록 · `gate:perf-ratchet`    | G1   |
| 2     | (사용자 결정 1) 첫 하향 1건 — 카운트 RED → 수정 → 상한 하향 + taskMs A/B            | 수정 커밋 + ratchet 하향 커밋 · evidence                                     | G2   |
| 3     | begin-frame go/no-go — Linux 실행 환경이 있을 때만 (사용자 결정 4), 없으면 Deferred | `--begin-frame` 옵션 · evidence · §8 갱신 (또는 Deferred 사유)               | G3   |
| 4     | Live Exercise (push 차단 1 · 통과 1) · 문서                                         | README · research §9 · (Phase 2 시) CHANGELOG · 메모리                       | G4   |

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

| 등급 | 대상 (§8-2 실측 기준)                                                                                                                                              | 상한             | 초과 판정                                                        |
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

| 파일                                                     | 변경                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/builder/scripts/perf-ratchet-gate.mjs` (신규)      | `judge({ratchet, results})` 순수 함수 (등급 판정 · 초과 목록 · 하향 제안 · recorder 해시 대조) + CLI: `--run` (perf:baseline 을 자식 프로세스로 실행, 초과 시 1회 재실행 HC2) · `--update` (하향만 기록) · `--raise <path> --to <n> --approved-by --reason --expires` (승인 필드 전부 없으면 거부) · `--self-test` (fixture 6)                                                                                                                                                                      |
| `apps/builder/scripts/perf-ratchet-gate.test.mjs` (신규) | judge fixture: 등급 A 초과 · B 단독 초과 (경고) · A+B 초과 (차단) · 재실행 불일치 (측정 불가) · recorder 해시 불일치 · 하향 제안                                                                                                                                                                                                                                                                                                                                                                    |
| `apps/builder/scripts/perf-baseline.mjs`                 | `--out-json <path>` (고정 파일명으로 결과 저장 — 게이트가 읽기 쉽게) · RECORDER_SCRIPT 해시 export                                                                                                                                                                                                                                                                                                                                                                                                  |
| `.githooks/pre-push`                                     | **재구성** (삽입이 아님): ① push 범위 변경 파일 수집 (기존) → ② 스코프 판정 두 개 (`D3_PATHS` → ADR-198 smoke · `PERF_RATCHET_PATHS` → 246) → ③ 해당하는 게이트를 순서대로 실행, 실패 즉시 exit 1 → ④ 마지막에 한 번 exit 0. 현재 hook 의 조기 `exit 0` (`:55` D3 미매칭 · `:80` 끝) 을 없애고 `RUN_PARITY` · `RUN_RATCHET` 플래그로 바꾼다. 246 블록: `SKIP_PERF_RATCHET=1` 탈출구 (출력) · 워킹트리 dirty (스코프 경로) → 차단 · engine 변경 시 wasm 신선도 → 차단 · 서버 확보 (§3-4) 실패 → 차단 |
| `package.json`                                           | `gate:perf-ratchet`: `node apps/builder/scripts/perf-ratchet-gate.mjs --run`                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `apps/builder/vite.config.ts`                            | dev 전용 `define: { __COMPOSITION_DEV_ROOT__: JSON.stringify(<repo root>) }` — 하니스가 `page.evaluate(() => __COMPOSITION_DEV_ROOT__)` 로 서빙 root 를 읽는다 (production 빌드 제외)                                                                                                                                                                                                                                                                                                               |
| `scripts/install-git-hooks.sh`                           | 안내 문구에 246 게이트 · 탈출구 추가                                                                                                                                                                                                                                                                                                                                                                                                                                                                |

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

### 3-4. 측정 서버 확보 (h2)

push 대상 코드를 제공하는 서버만 잰다. 순서:

1. `http://localhost:5173` 응답 + `__COMPOSITION_DEV_ROOT__ === git rev-parse --show-toplevel` → 재사용 (서빙 = 이 워킹트리 · HC4 dirty 차단으로 워킹트리 = push 대상).
2. 아니면 게이트가 `DEV_PORTS=5179 pnpm dev` 를 자식 프로세스로 띄우고 ready 대기 (상한 40 초) · 저장된 `.auth-session.json` 의 origin 을 `http://localhost:5179` 로 바꾼 임시 storage state 로 하니스 실행 (`--storage-state` · `BUILDER_URL`) · 종료 시 서버 kill.
3. 둘 다 실패 → 차단 (exit 1) + 원인 출력. 통과시키는 길은 `SKIP_PERF_RATCHET=1` 뿐.

G0 가 2 의 부팅 시간을 통과 경로 예산 (≤ 90 초) 안에서 실측한다 — Vite dep 캐시가 있는 상태 기준, 캐시가 없는 첫 실행은 예산 밖으로 기록.

## 4. Phase 2 — 첫 하향 1건 (사용자 결정 1)

대상 후보 (§8-4, 60 요소 · 조작 1회당):

| 후보 | 함수                                                           | 호출/op | 가설                                                                                           | RED 지표 (등급 A)                                         |
| ---- | -------------------------------------------------------------- | ------: | ---------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| ①    | `findNodeByIdInSubtree` (canonicalDocumentStore) — 선택 경로   |   2,097 | `FrameSlotSection` 의 useMemo 들이 요소 목록을 돌며 매 요소에 서브트리 탐색 → 선택 1회에 O(N²) | `v8.topApp[findNodeByIdInSubtree]` · select `v8.app`      |
| ②    | `serializeLayoutRelevantValue` · `stableSerialize` — 편집 경로 |  17,422 | 편집 1회에 전체 트리 직렬화 (layoutCache 키 · scene snapshot) — 바뀐 서브트리만이어야 한다     | `v8.topApp[serializeLayoutRelevantValue]` · edit `v8.app` |

하나만 고른다 (기본 ①: 파일 2 · 600 요소에서 O(N²) 이면 taskMs 방향이 분명). 절차: 카운트 RED (현재 값 > 새 상한) 고정 → 수정 → unit (반환값 · canonical · history 동일) → `/cross-check` 1 → 60/600 taskMs before/after 교대 3쌍 → 원복 RED → `--update` 하향 커밋. ②는 후속 (본 ADR 범위 밖 — 착수는 §8-4 순서 · ADR-243 결과와 대조 뒤).

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
