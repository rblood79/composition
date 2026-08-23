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

## 검증

- registry/classifier/Preview/paragraph-key/parity/converter/Skia focused gate: 8 files / 39 tests PASS.
- `pnpm run codex:typecheck`: baseline 43 known errors 외 신규 오류 없음.
- fixed Text `fontSize`/`fontWeight`는 focused gate까지 통과했으나 paragraph/rect parity Builder
  live는 아직 실행 대상이다. 나머지 metrics/resource/structure는 원자 consumer가
  없어 Builder live를 실행하지 않는다.

검증 명령:

```text
pnpm exec vitest run --config vitest.config.ts src/preview/components/presentationTextMetricProps.test.ts src/builder/presentation/editorPresentationTextMetricValue.test.ts src/builder/presentation/editorPresentationTextMetricParity.test.ts src/builder/presentation/invalidation/editorMutationEffectRegistry.test.ts src/builder/presentation/editorMutationClassifier.test.ts src/builder/workspace/canvas/skia/specShapeConverter.presentation.test.ts src/builder/workspace/canvas/skia/StoreRenderBridge.presentation.test.ts src/builder/workspace/canvas/skia/textParagraphKey.test.ts
pnpm run codex:typecheck
git diff --check
```

결과는 8 files/39 tests PASS, `git diff --check` PASS, typecheck는 baseline 43 known
errors 외 신규 오류 없음이다. 이 범위는 owner가 없으므로 populated Builder live
trace를 성공으로 기록하지 않았다.

## 승격 판정

이 slice는 fixed Text `fontSize`/`fontWeight`만 안전한 최소 범위로 확장하고 나머지는 재발 방지
가드로 닫은 것이다. `fontSize` Builder live와 나머지 text/resource/structure
consumer가 마련되기 전에는 ADR-187 Phase 5 전체를 Implemented로 승격하지 않는다.

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
