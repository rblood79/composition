# ADR-187 Phase 5 — text metrics/resource/structure fail-closed slice

## 범위

`fontFamily`, `lineHeight`, `letterSpacing`, intrinsic resource
(`prop:src`)와 `structure.patch`는 현재 continuous publish를 열지 않는다. 단,
고정 크기 standalone `Text`의 `fontSize`와 명시적 numeric `fontWeight`는 paragraph
slot과 targeted invalidation을 연결한 별도 vertical slice로 열었다. 나머지 변경은 descendant metrics, resource used
size, children map, hit-test bounds를 원자적으로 갱신해야 하므로 commit-only가
정확한 계약이다.

## 구현 계약

- classifier는 text/resource/structure의 invalidation kind를 유지한다.
- shared effect registry는 `fontSize`/`fontWeight`만 fixed Text owner가 사용할 수 있도록 열고,
  나머지 text/resource/structure literal은 `continuous: false`로 고정해 독립 literal
  drift를 static guard로 막는다.
- Skia `presentationTextMetricTargets`는 retained paragraph 입력을 갱신하고,
  fixed Text owner가 Preview/Skia presentation transaction을 사용한다.
- structure는 scoped scene patch consumer가 생기기 전까지 fail-closed한다.

## Consumer 대조 결과

현재 코드에서 확인한 end-to-end 경계는 다음과 같다.

| 축                 | classifier/registry                                                                                                    | Skia consumer                                                                                                        | Preview consumer                                                                         | 현재 판정                            |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------ |
| text metrics       | `fontSize`/`fontWeight`만 fixed Text owner용 `continuous`를 허용하고 나머지는 `layout + inherited-subtree`/commit-only | standalone Text의 `presentationTextMetricTargets`가 retained paragraph 입력을 갱신하고 picture를 targeted invalidate | fixed Text owner가 Preview/Skia transaction을 사용하며 나머지 text style은 병합하지 않음 | 두 metric slice / 나머지 commit-only |
| intrinsic resource | `prop:src`는 layout cache registry에만 존재하며 presentation descriptor의 prop/resource union이 없음                   | resource decode/intrinsic size 및 affected subtree 재계산 consumer 없음                                              | resource overlay/atomic intrinsic-size channel 없음                                      | commit-only                          |
| structure          | `descriptor:structure.patch`는 structure로 분류되지만 `continuous:false`                                               | scene command stream/children map/hit bounds/spatial index를 하나의 presentation revision으로 교체하는 consumer 없음 | child graph/topology overlay 및 atomic retirement 없음                                   | commit-only                          |

따라서 단일 값만 덮어쓰는 Preview/Skia patch를 추가하면 text wrapping, intrinsic
size, descendant layout 또는 pointer hit 영역이 한 renderer에서만 갱신될 수 있다.
현재 `commitPatchPlan`은 commit lane의 부모 dirty-root 계산을 제공하지만 continuous
scene publication을 열어 주는 consumer는 아니다.

### Residual code-path evidence

- resource: `EditorMutationDescriptor` union은
  `apps/builder/src/builder/presentation/editorPresentationTypes.ts:30-51`에서
  `fills/style/geometry/structure`만 허용한다. `prop:src`는
  `apps/builder/src/builder/presentation/invalidation/editorMutationEffectRegistry.ts:483-488`의
  legacy layout-cache registry entry일 뿐 presentation descriptor가 아니다.
  `apps/builder/src/builder/workspace/canvas/skia/renderInvalidation.ts:19-55`의
  `resource` reason은 decode/load invalidation 분류이며, intrinsic-size를
  Preview overlay와 Skia `hitBoundsMap`에 같은 presentation revision으로 발행하는
  consumer가 아니다.
- structure: runtime publish는
  `apps/builder/src/builder/presentation/editorPresentationRuntime.ts:593-600`에서
  `assertContinuousEditorMutation`을 먼저 적용한다. `structure.patch`의 commit
  dirty-root 계산은
  `apps/builder/src/builder/presentation/commitPatchPlan.ts:129-148`에 있지만,
  Preview child graph와 Skia `childrenMap`/`hitBoundsMap`/spatial index를 같은
  continuous overlay revision으로 교체하지 않는다. 실제 `hitBoundsMap` 생성과
  spatial index 동기화는
  `apps/builder/src/builder/workspace/canvas/skia/renderCommands.ts:1078-1166`의
  command-stream build lane에만 존재한다.

## 검증

- registry/classifier/Preview/paragraph-key/populated-harness/residual-fail-closed/parity/converter/Skia focused gate: 10 files / 51 tests PASS.
- `pnpm run codex:typecheck`: baseline 43 known errors 외 신규 오류 없음.
- fixed Text `fontSize`/`fontWeight`는 populated fixture harness에서 paragraph key,
  Preview/Skia 값, rect, cancel restore 및 console error 0을 검증했다. 실제 populated
  Builder에서도 동일 문서의 Compare Mode split을 사용해 두 property 모두 paragraph
  key 변경→복귀, Skia metric↔Preview CSS parity, bounds/hitBounds 불변,
  Canvas pixel 변경→복귀, canonical during 불변/terminal handoff를 확인했다.
  Evidence는 `/private/tmp/adr187-phase5-text-fontsize-visible.json`과
  `/private/tmp/adr187-phase5-text-fontweight-visible.json`이며 두 결과의
  `allSkiaSnapshotsAvailable`, `allCanvasChangedDuring`, `allCanvasRestored`,
  `allCanonicalHandoff`, `allFixedRectStable`, `allMetricParity`,
  `allParagraphInvalidatedAndRestored`, `allPreviewRestored`가 모두 `true`다.
  초기 fixture의 x 좌표가 Canvas raster 경계에 걸려 hash가 고정되는 하니스
  관측을 분리하고, visible Text fixture로 재실행해 픽셀 gate를 닫았다. 나머지 metrics/resource/structure는
  residual deterministic harness에서 publish scheduler/overlay/commit을 열지 않고,
  structure 실패 후 명시적 cancel terminal만 통과하는 것을 검증했다. 원자 consumer가
  없어 resource/structure Builder live를 성공으로 기록하지 않는다.

실행 명령은 다음과 같다(두 번째 실행은 `--text-property fontWeight`로 교체).

```bash
node apps/builder/scripts/adr187-presentation-baseline.mjs \
  --base-url http://localhost:5173/composition \
  --project-url http://localhost:5173/builder/36fb9ef0-94be-4389-a8ad-b7609985d188 \
  --duration-ms 250 --repeats 1 --tiers 5 \
  --fixture-profile text-metrics --lane text --text-property fontSize \
  --out /private/tmp/adr187-phase5-text-fontsize-visible.json \
  --trace-dir /private/tmp/adr187-phase5-text-fontsize-visible-traces
```

검증 명령:

```text
pnpm exec vitest run --config vitest.config.ts src/preview/components/presentationTextMetricProps.test.ts src/builder/presentation/editorPresentationTextMetricValue.test.ts src/builder/presentation/editorPresentationTextMetricParity.test.ts src/builder/presentation/editorPresentationTextMetrics.liveHarness.test.ts src/builder/presentation/editorPresentationResidualFailClosed.test.ts src/builder/presentation/invalidation/editorMutationEffectRegistry.test.ts src/builder/presentation/editorMutationClassifier.test.ts src/builder/workspace/canvas/skia/specShapeConverter.presentation.test.ts src/builder/workspace/canvas/skia/StoreRenderBridge.presentation.test.ts src/builder/workspace/canvas/skia/textParagraphKey.test.ts
pnpm run codex:typecheck
git diff --check
```

결과는 10 files/51 tests PASS, `git diff --check` PASS, typecheck는 baseline 43 known
errors 외 신규 오류 없음이다. 위 live runner는 실행 중인 Builder의
`/builder/36fb9ef0-94be-4389-a8ad-b7609985d188`에서 `project.mode=existing`, tier 5,
repeat 1로 수행했으며 초기화 warning은 persist-back을 생략하는 harness 환경
신호로 분리했다.

## 승격 판정

이 slice의 fixed Text `fontSize`/`fontWeight` 범위는 deterministic 및 populated
Builder live gate를 모두 통과해 Phase 5 allowlist 승격 조건을 충족했다. `fontFamily`,
`lineHeight`, `letterSpacing`, resource, structure는 affected subtree/intrinsic/
children-map consumer가 없으므로 계속 commit-only fail-closed로 유지한다. 따라서
Phase 5의 허용 목록은 완료로 기록하되, ADR-187 전체 `Implemented` 승격은 별도 Phase 6
legacy 제거와 G0~G8 전체 조건을 만족할 때 판정한다.

## 재개 조건

다음 조건을 모두 충족한 뒤에만 text/resource/structure의 `continuous`를 다시 열 수
있다.

1. text metric/resource/structure를 구분하는 typed descriptor와 registry entry가
   마련되고, unknown/unsupported payload는 계속 RED fail-closed할 것.
2. text paragraph/font readiness 또는 resource intrinsic sizing을 포함한 affected
   subtree layout 계산이 persistent layout engine의 targeted input/result 경계로
   연결될 것. 전체 document traversal을 결과 publish로 위장하지 않을 것.
3. 하나의 revision으로 Preview DOM style/geometry, Skia command stream, `hitBoundsMap`
   및 spatial hit-test index를 함께 교체하고, cancel/finish/iframe reload 시 atomic
   restore/retirement할 것.
4. structure add/remove/reparent/order/ref/slot 각각에 대해 children map, scene order,
   affected ancestry, hit-test bounds의 origin/ref/nested fixture가 Preview와 Skia에서
   동일하게 검증될 것.
5. loaded/unloaded font와 image resource intrinsic-size 변경을 포함한 populated
   Builder live trace에서 geometry/selection hit parity, console error 0, duplicate
   canonical/legacy write 0, targeted publication만 관측될 것.
