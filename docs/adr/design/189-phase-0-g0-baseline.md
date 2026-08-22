# ADR-189 Phase 0 — G0 commit lane baseline

## 범위와 재현

현재 canonical commit 경로에서 한 요소의 style commit 1회를 수행하고,
다음 축을 분리 측정했다.

- command stream full DFS rebuild (JS)
- content record/replay (`render.skia.record.content`)
- content flush + snapshot (`render.skia.flush.content`)
- SpatialIndex full snapshot

재현 명령:

```bash
node apps/builder/scripts/adr189-commit-baseline.mjs --repeats 5
```

측정은 2026-08-23 (UTC 2026-08-22T15:12:52Z), Chrome 151.0.7922.170,
1440×900 headless Builder에서 수행했다. fixture는 active body 아래 canonical
`frame` 형제 노드를 N=50/500/5,000으로 만들고, `updateElementProps()`로
`adr189-target` 한 개의 `style.left`만 한 번 변경했다. browser error 0건이다.

## N-tier 결과

모든 수치는 5회 run의 p95(ms)이며, `record+stream`은 두 축의 같은 commit
샘플을 합산한 값이다.

| fixture N | full DFS visits | stream rebuild | content record | record+stream | flush+snapshot | SpatialIndex | long task |
| --------: | --------------: | -------------: | -------------: | ------------: | -------------: | -----------: | --------: |
|        50 |             106 |            0.4 |            0.6 |           1.0 |            0.3 |          0.1 |         0 |
|       500 |             556 |            0.7 |            1.1 |           1.8 |            0.4 |          0.3 |         0 |
|     5,000 |           5,056 |            6.1 |           70.2 |      **75.1** |            0.5 |          1.8 |        10 |

각 run에서 full build count는 1이었고 subtree build count는 0이었다. 즉 현재
commit은 dirty-root/subtree patch가 아니라 full command stream + full content
record 경로를 실제로 탔다.

### 방문 수 음성 계약

Builder fixture에는 N과 무관한 다른 visible page shell 56개가 함께 포함되어
있어 방문 수는 `N + 56`으로 관측됐다(106/556/5,056). 이 고정항을 분리하면
N 증가당 DFS 방문 증가량은 정확히 1이며, 다섯 회 반복 모두 같은 offset이었다.
따라서 “commit 1회가 full DFS를 방문한다”는 음성 계약은 **조정된 fixture 기준
통과**하고, literal `visits === N`은 page-shell 고정항 때문에 적용하지 않았다.
이 고정항을 숨기고 N과 동일하다고 보고하지 않는다.

## G0 판정

N=5,000의 `record+stream` p95 75.1ms는 120Hz frame budget 8.33ms의 9.0배,
ADR-189 축소 종결 기준인 budget 50%(4.165ms)의 약 18배다. 따라서 G0는
**RED**다. 비용의 주된 원인은 content record/replay 70.2ms이고, full stream
DFS 6.1ms와 SpatialIndex 1.8ms가 뒤따른다. flush+snapshot 자체는 이번
fixture에서 0.5ms로 지배 항이 아니었다.

이 결과는 commit lane을 현재 full rebuild로 유지해도 된다는 근거가 아니다.
오히려 5,000-node 한 요소 commit에서 `requestAnimationFrame` handler가
프레임 예산을 크게 초과할 수 있는 직접 근거이며, ADR-189 Phase 2 subtree
splice와 Phase 3 damage record를 계속 진행해야 한다. 특히 Phase 2는 stream
DFS와 clean-node replay를 dirty subtree 범위로 제한하고, Phase 3는 70ms
content record가 damage 면적에 비례해 줄어드는지 별도 검증해야 한다.

## 검증 명령

```bash
pnpm run codex:typecheck
pnpm exec vitest run \
  apps/builder/src/builder/workspace/canvas/skia/renderCommands.test.ts \
  apps/builder/src/builder/workspace/canvas/skia/subtreeCommandPatch.test.ts \
  apps/builder/src/builder/presentation/commitPatchPlan.test.ts
```

결과: type-check는 기존 baseline 43개 외 신규 오류 0개, 관련 테스트 44개
통과.
