# ADR-188 Phase 5 / G6 — live parity 및 120Hz trace

검증일: 2026-08-22  
결과: **RED — Phase 5 미완료, ADR Status 유지 (`Accepted`)**

## 실행 범위

- 인증된 실제 Builder에서 새 프로젝트를 생성하고 상단 `Compare Mode
(Preview + Skia)` split을 켰다.
- `position:absolute`인 `Box`를 추가해 Style 패널의 `Left` geometry 입력을
  `20 → 80`으로 커밋했다.
- 같은 프로젝트의 ADR-187 runtime에 수치형
  `style.patch { left: 100, top: 45 }`를 발화해 canonical/store를 건드리지
  않는 presentation overlay를 관찰했다.
- 기존 `adr187-presentation-baseline.mjs`로 120Hz 색상 드래그를
  `N=50,500,5,000`에서 실행했다.

## Live 결과

### Preview geometry

| 관측 지점             | 결과                                                                     |
| --------------------- | ------------------------------------------------------------------------ |
| geometry 입력 커밋 전 | DOM `left=20px`, `top=30px`                                              |
| geometry 입력 커밋 후 | canonical store `left=80px`, `top=30px`                                  |
| presentation patch 후 | Preview DOM `left=100px`, `top=45px`, `width=40px`, `height=50px`        |
| canonical 보호        | presentation patch 후 store는 `80px/30px` 유지                           |
| Preview transport     | delta 1건, 288 bytes, full-document message 0건(기존 canonical 1건 제외) |

따라서 Preview 쪽은 numeric absolute-position allowlist와 canonical 보호
경계가 실제 브라우저에서 동작했다. 문자열 `"100px"`/`"45px"` patch는 의도대로
fail-closed 되었고, 수치형 patch만 허용되었다.

### Skia parity 관찰 한계

동일 split 화면에서 Skia canvas를 캡처했지만, 현재 headless CanvasKit 세션의
`getCachedCommandStreamSnapshot()`이 계속 `null`이고
`getSceneBounds("adr188-target")`/hit bounds도 관측되지 않았다. presentation 전후
canvas PNG digest도 동일했다.

이 상태는 Skia subtree patch가 실제 draw/hit snapshot에 적용됐다는 증거가
아니다. 따라서 DOM 결과만으로 DOM/Skia parity GREEN을 선언하지 않는다. 다음
시도에서는 populated Canvas의 `renderNodesMap`에 포함되는 기존 Skia primitive를
대상으로 command snapshot과 `boundsMap`/`hitBoundsMap`을 직접 노출·검증해야 한다.

## 120Hz N-tier trace

실행 명령:

```text
node apps/builder/scripts/adr187-presentation-baseline.mjs \
  --base-url http://localhost:5173 \
  --duration-ms 1000 --repeats 1 --tiers 50,500,5000

node apps/builder/scripts/adr187-presentation-baseline.mjs \
  --base-url http://localhost:5173 \
  --duration-ms 3000 --repeats 1 --tiers 5000
```

|          N | apply p95/p99 계측 | long task | 최대 long task | 결과             |
| ---------: | -----------------: | --------: | -------------: | ---------------- |
|         50 |           0 / 0 ms |         0 |           0 ms | 성능 수치상 통과 |
|        500 |           0 / 0 ms |         0 |           0 ms | 성능 수치상 통과 |
| 5,000 (1s) |          0 / 0 ms* |         9 |         248 ms | **RED**          |
| 5,000 (3s) |          0 / 0 ms* |        24 |         249 ms | **RED**          |

`*` apply 계측은 이 paint-only harness에서 layout bridge apply를 관찰하지
못해 0으로 남은 값이다. 이를 120Hz layout p95/p99 GREEN 근거로 사용하지
않는다. N=5,000에서 long task가 0이 아니므로 G6 hard gate는 실패한다.

모든 tier에서 기존 React console error가 1건 관측됐다.

```text
The tag <%s> is unrecognized in this browser. If you meant to render a React component, start its name with an uppercase letter. box
```

이 error는 Phase 1부터 기록된 fixture의 lowercase `<box>` 경고이며 이번 Phase의
변경이 새로 만든 것은 아니다. 그러나 G6 문구가 `console error/warn 0`을
요구하므로, strict gate 기준으로는 0이 아니다.

## Cross-check

- layout source: `editorPresentationLayoutLane.ts`의 numeric style/geometry
  합성 및 root publication.
- Skia consumer: `skiaEditorPresentationLayoutBridge.ts`의 absolute numeric
  allowlist, `renderCommands.ts` snapshot, `subtreeCommandPatch.ts`의
  draw/hit 원자 교체, `SkiaCanvas.tsx` wiring.
- Preview consumer: `CanonicalNodeRenderer.tsx`의 동일 allowlist.
- 이번 Phase에는 component catalog, spec, factory, CSS 생성물 변경이 없다.
- focused Vitest: 6 files / 46 tests PASS.
- `pnpm run codex:typecheck`: TS 변경 없음으로 gate 스킵(exit 0).
- `pnpm run codex:guard`: 보호 파일 위반 없음(exit 0).
- `git diff --check`: PASS.

## 판정 및 다음 진입점

Phase 5는 Preview 쪽 동작과 기존 paint lane의 full rebuild 억제를 확인했지만,
Skia live snapshot parity가 관측되지 않았고 N=5,000 long task 및 console error
조건도 남았다. 따라서 이 evidence는 G6 RED를 기록하며 Phase 5를 Implemented로
표시하지 않는다.

다음 진입점은 Skia가 실제로 렌더하는 populated primitive를 대상으로
`renderNodesMap → cached command snapshot → bounds/hit revision → canvas pixel`
체인을 연결해 관측 가능하게 만든 뒤, N=5,000 long-task 원인을 layout/DOM
projection/CanvasKit 중 하나로 분리하는 것이다. 그 전에는 ADR-188을
`Accepted`에서 `Implemented`로 승격하지 않는다.
