# ADR-187 Phase 0 — 프레젠테이션 비용·무효화 baseline

## 판정

**G0 PASS — 2026-08-22.** 구현 전 현행 경로의 production baseline, continuous
editor/RAF/invalidation inventory, DOM·Skia identity fixture, `k=1/4/16` projection
fan-out fixture, 기존 5-symbol invalidation fixture를 동결했다.

이 PASS는 현행 성능이 목표를 만족한다는 뜻이 아니다. 오히려 `N=5,000`에서
`frameApply p99=9.3ms`, 50ms 초과 long-task 118회, 5초 동안 raw input 중앙값 24회를
기록하여 현재 구조가 ADR-187의 4ms/8.33ms 목표를 만족하지 못함을 확인했다. G0의
목적은 Phase 1 이후 동일 fixture로 비용 경로가 실제로 제거됐는지 비교할 수 있게 하는
것이다.

Machine-readable 근거:

- [187-phase-0-presentation-baseline.json](./187-phase-0-presentation-baseline.json)
- [187-phase-0-invalidation-baseline.json](./187-phase-0-invalidation-baseline.json)

## 측정 경로

Preview는 독립 개발 서버나 별도 제품 surface로 측정하지 않았다. Builder 상단 토글
그룹의 `Compare Mode (Preview + Skia)`를 눌러 나타나는 **분할 화면**을 사용했다.
각 tier에서 `.workspace--compare-mode`, `iframe#previewFrame`, Preview body의
`data-preview=true`, 실제 `[data-element-id]` node 수를 확인한 뒤 color picker를
드래그했다.

```text
production Vite bundle
  -> Builder project
  -> top toggle: split (Preview + Skia)
  -> Style panel > fill color popover
  -> native pointer stream, 5 seconds, 5 runs per tier
```

재현 명령:

```bash
pnpm -F @composition/builder exec vite build
node apps/builder/scripts/adr187-presentation-baseline.mjs \
  --serve-dist \
  --tiers 50,500,5000 \
  --repeats 5 \
  --duration-ms 5000 \
  --headed \
  --out /private/tmp/adr187-phase0-presentation-baseline.json \
  --trace-dir /private/tmp/adr187-phase0-traces
```

| 항목            | 값                                                   |
| --------------- | ---------------------------------------------------- |
| source revision | `1d102fe282cd11dc806cc310cb2bd911f5b6f457`           |
| browser         | Chrome `151.0.7922.170`                              |
| viewport        | `1440 × 900`                                         |
| 반복            | tier당 5회                                           |
| 실제 drag       | run당 5.0초 이상                                     |
| target          | 단일 fill color, baseline `k=1`                      |
| Preview         | Builder 상단 토글의 split mode, DOM iframe visible   |
| trace           | CDP production trace 15개, gzip 합계 7,939,476 bytes |

계측은 `?adr187Metrics=1`에서만 활성화되는 observation-only counter를 사용한다. 평상시
제품 동작에서는 scheduling, mutation, serialization을 추가하지 않는다. raw result는
`/private/tmp/adr187-phase0-presentation-baseline.json`에 있으며 SHA-256은
`81c63c52add236d12d37114c7dd8d54964a2b78cb0e63fb8bbdb1d75a9db845d`다. 해당 raw
파일의 초기 aggregate `totalLongTasks`는 long-task summary bucket 수를 셌기 때문에,
committed JSON은 각 run의 summary `count`를 합산한 118회로 정규화했다. runner도 같은
방식으로 수정했다.

### 환경 제한

로컬 static production host에는 기존 dynamic WASM asset
`composition-engine-pkg/composition_engine.js`가 복사되지 않아 layout engine이 기존
timeout fallback을 사용했다. Pretendard production asset 경로에서도 기존 font decode
warning이 발생했다. 이 둘은 ADR-187 변경으로 생긴 오류가 아니며 Phase 0에서 수정하지
않았다.

따라서 절대 시간은 정상 배포 환경의 layout engine 수치로 일반화하지 않는다. 다만
모든 tier에서 split Preview가 실제 node를 렌더했고, 이 ADR이 제거하려는
canonical/layout/projection/full rebuild/full-document message fan-out은 production
bundle의 실제 제품 경로에서 관측됐다. counter topology와 `N` 증가에 따른 기울기는 G0
비교 근거로 유효하다.

## 현행 원인 사슬

| 단계                 | 현재 source                               | 관측된 의미                                                                                                                  |
| -------------------- | ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| control scheduler    | `ColorPickerPanel.tsx:91-131`             | raw input을 local state에 반영하고 outer RAF를 예약한다. `handleChangeEnd`는 outer RAF만 취소한다.                           |
| action scheduler     | `useFillActions.ts:170-190`               | latest fill을 다시 inner RAF로 예약한다. commit API가 pending inner RAF를 cancel/flush하지 않는다.                           |
| commit caller        | `FillSection.tsx:271-303`                 | drag는 throttled preview, end는 `updateFill`을 호출하지만 두 scheduler의 terminal 순서를 소유하지 않는다.                    |
| preview mutation     | `inspectorActions.ts:1397-1446`           | 단일 fill 변경에도 전체 `elements`/`elementsMap`, dirty subtree, `layoutVersion++`, legacy write, canonical sync가 일어난다. |
| canonical write      | `canonicalDocumentStore.ts:251`           | preview frame마다 active canonical document identity가 교체된다.                                                             |
| layout publish       | `useLayoutPublisher.ts:110-215`           | paint인 fill 변경도 layout publish effect를 깨운다.                                                                          |
| projection signature | `buildSceneSnapshot.ts:80-106`            | 전체 scene node와 page snapshot을 serialize/hash한다.                                                                        |
| Skia bridge          | `StoreRenderBridge.ts:332-407,567`        | projection/layout 변화가 full rebuild로 승격된다. baseline은 apply당 2회를 기록했다.                                         |
| Preview sender       | `useIframeMessenger.ts:303-324,1080-1107` | active canonical identity 변경을 frame/timeout으로 합쳐도 매 apply 전체 document를 보낸다.                                   |
| Preview DOM identity | `CanonicalNodeRenderer.tsx:348,409`       | renderer marker는 resolved `node.id`를 사용하고 path는 별도로 계산한다. delta revision/latch는 아직 없다.                    |

경고의 직접 trigger는 RAF callback이지만, **근본 원인은 중첩 RAF 자체보다 RAF 한 번이
문서 전체 mutation과 전역 파생 경로를 깨우는 모델**이다. baseline에서 outer/action RAF와
frame apply가 거의 1:1이므로 두 RAF는 부하를 의미 있게 coalesce하지 못했다. 이어지는
canonical write, layout publish, 전체 projection signature, Skia full rebuild 2회, Preview
전체 문서 전송이 모두 apply 수와 1:1 또는 2:1로 결합됐다.

## continuous editor·scheduler inventory

| editor/property family | continuous source                         | 현재 scheduler/preview action                                                                | terminal/commit                        | Phase 1 descriptor 초안                             |
| ---------------------- | ----------------------------------------- | -------------------------------------------------------------------------------------------- | -------------------------------------- | --------------------------------------------------- |
| solid fill color/alpha | `ColorPickerPanel`                        | outer RAF → `updateFillPreviewThrottled` inner RAF → `updateSelectedFillsPreviewLightweight` | `onChangeEnd` → `updateFill`           | `fills.replace`, paint                              |
| gradient stop color    | `GradientEditor` + `ColorPickerPanel`     | color outer RAF → fill inner RAF                                                             | `handleColorChangeEnd` → `onChangeEnd` | `fills.replace`, paint                              |
| gradient stop position | `GradientBar`                             | GradientBar RAF → fill inner RAF                                                             | pointer-up `onStopCommit`              | `fills.replace`, paint                              |
| mesh point color       | `MeshGradientEditor` + `ColorPickerPanel` | color outer RAF → fill inner RAF                                                             | point `onChangeEnd`                    | `fills.replace`, paint                              |
| typography color       | `TypographySection`                       | `updateStylePreview` RAF                                                                     | `updateStyle`                          | `style.color`, paint                                |
| border color           | `AppearanceSection`                       | `updateStylePreview` RAF                                                                     | `updateStyle`                          | `style.border*Color`, paint                         |
| box geometry           | `TransformSection` scrub inputs           | `updateStylePreview` RAF                                                                     | `updateStyleImmediate`                 | width/height/min/max/left/top, layout               |
| typography metrics     | `TypographySection` scrub inputs          | `updateStylePreview` RAF                                                                     | `updateStyleImmediate`                 | fontSize/lineHeight/letterSpacing, layout           |
| spacing/layout         | `LayoutSection` scrub inputs              | `updateStylePreview` RAF                                                                     | `updateStyleImmediate`                 | gap/padding/margin, layout                          |
| border geometry        | `AppearanceSection` scrub inputs          | `updateStylePreview` RAF                                                                     | `updateStyleImmediate`                 | borderWidth/radius, layout 또는 paint registry 판정 |
| modified style value   | `ModifiedStylesSection`                   | color preview 또는 immediate action                                                          | control commit                         | property registry lookup                            |

`ScrubInput`의 click-focus RAF는 presentation value scheduler가 아니므로 migration 대상
frame owner로 세지 않는다. 반면 `useOptimizedStyleActions.updateStyleRAF`,
`updateStylePreview`, `GradientBar`, `ColorPickerPanel`, `useFillActions`는 value publish를
소유하므로 Phase 1 runtime 도입 후 migrated control에서는 제거 대상이다.

현재 분류 source는 서로 독립된 다섯 목록이다.

- `LAYOUT_AFFECTING_PROP_KEYS`
- `NON_LAYOUT_PROPS_UPDATE`
- `INHERITED_LAYOUT_PROPS_UPDATE`
- `LAYOUT_STYLE_KEYS`
- `LAYOUT_PROP_KEYS`

정확한 순서·key·axis 의미는
[187-phase-0-invalidation-baseline.json](./187-phase-0-invalidation-baseline.json)에
동결했고 static test가 원본 source와 exact equality를 검사한다. Phase 1 neutral registry는
이 baseline에서 다섯 view를 파생해야 하며 새 literal source를 추가할 수 없다. unknown
descriptor는 fail-closed한다.

## production baseline

아래 값은 각 tier 5회 중 counter 중앙값이다. bytes는 drag 구간의 Preview 전체 문서
전송 누적량이다.

|     N | raw input | frame apply | canonical / legacy write | layout / projection | full rebuild | Preview full msg / bytes | frame apply p95 / p99 |      long-task |
| ----: | --------: | ----------: | -----------------------: | ------------------: | -----------: | -----------------------: | --------------------: | -------------: |
|    50 |       203 |         202 |                202 / 202 |           202 / 202 |          404 |          202 / 8,313,512 |           0.4 / 0.4ms |              0 |
|   500 |       152 |         151 |                151 / 151 |           151 / 151 |          302 |         151 / 43,024,128 |           1.0 / 1.0ms |              0 |
| 5,000 |        24 |          23 |                  23 / 23 |             23 / 23 |           46 |          23 / 63,275,990 |           8.1 / 9.3ms | 118, max 197ms |

고정된 apply당 비율:

```text
1 frame apply
  -> canonical write 1
  -> legacy elements/map write 1
  -> layout publish 1
  -> full projection signature 1
  -> Skia full rebuild 2
  -> target incremental patch 0
  -> Preview full-document message 1
```

Preview payload 1건은 `N=50` 41,156 bytes, `N=500` 284,928 bytes,
`N=5,000` 2,751,130 bytes로 증가했다. 5초 raw input 처리율은 약 40.6/s → 30.4/s →
4.8/s로 감소했다. 즉 대상 `k=1`은 같아도 비용과 input throughput이 문서 `N`에
결합한다.

terminal 뒤 4 RAF를 기다린 모든 15개 run에서 stale scheduled callback은 0이었다.
다만 종료 자체는 canonical write 1, layout publish 1, projection signature 1, Skia full
rebuild 2, Preview full-document message 1을 추가한다. 이번 trace에서 stale race가
발생하지 않았다는 뜻일 뿐, inner RAF를 terminal owner가 취소할 수 없는 구조적 위험이
사라진 것은 아니다.

## DOM·Skia identity와 fan-out freeze

fixture는 `customId="stable-label-key"`와 canonical `id="origin-label-id"`를 의도적으로
다르게 두고 origin/ref root/descendant를 비교한다.

| semantic 위치     | canonical write target                                    | Preview DOM local id     | Skia local id                    |
| ----------------- | --------------------------------------------------------- | ------------------------ | -------------------------------- |
| origin root       | `origin-card`                                             | `origin-card`            | `origin-card`                    |
| origin descendant | origin `origin-label-id` / stable path `stable-label-key` | `origin-label-id`        | `origin-label-id`                |
| ref root          | ref instance id                                           | ref instance id          | ref instance id                  |
| ref descendant    | origin descendant semantic target                         | `origin-label-id` 재사용 | `${instanceId}/stable-label-key` |

따라서 renderer-local id를 protocol의 write target으로 사용할 수 없다. DOM은 여러 ref
subtree에서 origin child id를 재사용하고 Skia는 instance/stable-path synthetic id를
만든다. Phase 1의 `EditorPresentationTargetRef`는 origin/ref root·descendant를 semantic
target으로 보존하고, renderer마다 projection index로 local id를 찾아야 한다.

같은 fixture가 `k=1/4/16`을 고정한다. 여기서 `k`는 origin descendant 1개와 visible ref
projection 0/3/15개의 합이다. lookup 외 apply work가 문서 `N`이 아니라 이 실제 projection
수에만 비례하는지는 Phase 2/3의 G4/G5에서 검증한다.

## Phase 1 진입 계약

G0는 통과했지만 Phase 1은 ADR risk `R1`, `R2`에 매핑된 **HIGH** 단계다. 다음 단계는
renderer production path에 연결하지 않고 아래까지만 구현한다.

1. `EditorPresentationTransactionRuntime`의 immutable snapshot과 single latest-wins
   frame scheduler
2. begin/publish/finish/cancel/conflict lifecycle과 fake RAF gate
3. renderer id와 분리된 semantic target type/resolver
4. neutral `EDITOR_MUTATION_EFFECT_REGISTRY`와 기존 5-symbol derived view
5. descriptor inventory/unknown RED/parity static gate

Phase 1은 사용자 확인 뒤 시작하며, G1/G2가 통과하기 전 fill picker나 renderer의
production owner를 전환하지 않는다.
