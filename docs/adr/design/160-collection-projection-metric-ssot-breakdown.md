# ADR-160 구현 상세 — collection projection 행 텍스트 측정 SSOT 단일화

> 본문: [160-collection-projection-metric-ssot.md](../completed/160-collection-projection-metric-ssot.md)
> 원칙 계승: [ADR-907](../completed/907-collection-container-style-pipeline.md) Layer D(동일 resolver 심볼 공유) · 경계: [ADR-157](../157-collection-builder-display-policy.md)(표시 정책 불변)

## §1. 전제·관점 lock-in (fork checkpoint — 완전 신규 주제라 해당 없음 확인)

본 ADR 은 기존 ADR 의 fork/분리가 아니라 **반복 parity 버그(2026-07-22 width/gap/wrap/겹침 5건)의 근본 원인에 대한 신규 결정**이다. 다음을 확인해 fork 게이트 비대상임을 명시한다.

1. **base/응용 분류**: ADR-907(container spacing resolver 공유, Implemented)의 잔여 분리가 아님. 907 은 padding/gap 축, 본 ADR 은 텍스트 wrap 높이·스택 offset 축. 서로 직교하는 별도 측정 축이다.
2. **schema 직교성**: canonical schema 변경 0. projection 행 props 에 측정 결과(파생값)를 주입하는 것으로, 저장 스키마 무변경.
3. **선행 ADR 전제 reverse 검증**: 907 Layer D("layout `render.shapes` 와 동일 resolver 심볼 공유")를 텍스트 측정으로 확장하는 방향이며, 907 의 의존 방향(spec metric ← consumer)을 그대로 승계한다. 반전 없음.
4. **ADR-157 경계**: 157 은 가상화 stride(단일 줄 균일)로 sample/hatch 표시 정책을 정의한다. 본 ADR 은 **렌더 행(§1.55b-2 / escape) 측정만** 단일화하고 **가상화 stride 는 손대지 않는다** — 157 표시 정책 불변이 Hard Constraint.

## §2. 현재 측정 지점 인벤토리 (Phase 0 freeze 대상)

동일한 "행 텍스트 높이"를 계산하는 측정 소스가 현재 **2개**(layout-util 함수 ↔ escape 별도 함수)로 갈라져 있다. M1/M2 는 이미 layout-util 함수 하나를 공유하며, escape(M3)만 패키지 경계로 별도 함수를 쓴다.

| #   | 지점                | 파일                                                                                                        | 현재 측정 방식                                               | 소비 대상                               |
| --- | ------------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ | --------------------------------------- |
| M1  | layout 렌더 행 공식 | `apps/builder/.../layout/engines/utils.ts` §1.55b-2(ListBox) / §1.55b2(GridList)                            | `measureWrappedTextHeight`(wrapContext, 2026-07-22 추가)     | 행 노드 intrinsic height                |
| M2  | 가상화 stride       | `apps/builder/.../scene/collectionVirtualization.ts` `resolveListBoxRowHeight` / `resolveGridListRowStride` | 단일 줄(getTextLineHeight) — **의도적**(ADR-157 표시 정책)   | spacer/scroll content height            |
| M3  | escape paint 스택   | `packages/specs/.../skiaPrimitives.ts` `listBoxItem` / `gridListCard`                                       | `measureSpecWrappedTextHeight`(주입 측정기, 2026-07-22 추가) | 그리기 좌표(stackY)·카드 높이·배경 밴드 |

- **M1/M2 는 이미 layout-util 함수 공유**: `resolveListBoxItemRowHeightFromStyle`(utils.ts:351) 단일 정의를 §1.55b-2(utils.ts:2475)와 가상화 stride(collectionVirtualization.ts:274)가 함께 호출. M1 은 wrapContext 로 wrap, M2 는 wrapContext 미전달 = 단일 줄(ADR-157 표시 정책).
- **layout-util(M1/M2) ↔ escape(M3) 이중화가 핵심**: escape 는 패키지 경계(specs ← shared ← builder)로 layout-util 을 import 할 수 없어 `measureSpecWrappedTextHeight`(packages/specs)로 **재측정**. 폰트 fallback·weight·lineHeight·maxWidth 산출을 layout-util 과 별도로 재현 → 미세 어긋남이 곧 parity 버그.
- **M2(가상화 stride)는 이원화 유지 대상**: 단일 줄 균일이 ADR-157 표시 정책. 본 ADR 의 SSOT 단일화 범위에서 **제외**(경계). 본 ADR 은 **렌더 행(M1)과 escape(M3)의 측정 소스 통일**만 다룬다.

## §2.1. Phase 0 실측 freeze (2026-07-22 — execute-adr, ✅ 완료)

라이브(dev 5173) + 코드 실측으로 §2 인벤토리를 확정하고, ADR 본문이 담지 못한 두 가지를 추가로 발견했다. 둘 다 adr-writing.md M3(실측 gap = 절차 보강, 재-fork trigger 아님) 원칙으로 본 ADR 안에서 흡수한다 — 방향(escape 재측정 제거 → SSOT 단일화)은 불변.

**인벤토리 라인 확정(코드 실측)**:

- M1 ListBoxItem: `utils.ts:2453-2488` — `!(childElements.length>0)` gating 안에서 `resolveListBoxItemRowHeightFromStyle(style, hasDescription, slotFonts, wrapContext)` 호출.
- M1 GridListItem: `utils.ts:2501-2562` — **인라인 공식**(`resolveListBoxItemRowHeightFromStyle` 미사용). `labelBlock + (hasDesc ? gap + descBlock : 0)`. Phase 1 에서 공용 헬퍼로 추출 대상.
- M2: `collectionVirtualization.ts:38`(import) / `247→274`(`resolveListBoxRowHeight` = wrapContext 미전달) / `163`(`resolveGridListRowStride`). 단일 줄 유지(ADR-157) 확인.
- **inner metric primitive 는 이미 specs 에 존재** — `packages/specs/src/renderers/utils/collectionItemMetrics.ts`: `resolveListBoxItemMetric`(48) / `resolveListBoxItemRowHeight`(87, number 반환) / `resolveGridListItemMetric`(143) / `COLLECTION_TEXT_DEFAULT_FONT_SIZE`(128). escape(같은 패키지)가 직접 호출 가능. 재사용 불가 대상은 **builder-side wrapper** `resolveListBoxItemRowHeightFromStyle`(utils.ts) 뿐.
- escape M3: `skiaPrimitives.ts` `listBoxItem`(654) / `gridListCard`(377), `measureSpecWrappedTextHeight` 소비(515/784/794). buildSpecNodeData width injection: `buildSpecNodeData.ts:1514`(`resolvedWidth = existingW(number) ?? (w>0?w:undefined)`).

**발견 1 — icon/check-aware wrap 폭 divergence (latent parity 버그)**: M1 은 `wrapWidth = availableWidth − paddingLeft − paddingRight`(`utils.ts:402`), escape 는 `maxWidth = width − textX − paddingRight − rightReserve`(`skiaPrimitives.ts:768`, `textX`=icon 반영 / `rightReserve`=check 반영). **icon 또는 selected(check) 행에서 M1·escape 가 서로 다른 폭으로 wrap 을 측정** → 줄 수·높이 drift. 현재는 origin 샘플이 unfold 라 미노출이나, data-bound projection + icon/selected 조합에서 재현 가능한 열린 통로. → **SSOT metric 함수는 icon/check-aware maxWidth 를 캡슐화해야 한다**(측정 주체 = buildSpecNodeData 여야 하는 이유: props.icon / props.isSelected / 확정 width 를 그 시점에 모두 안다).

**발견 2 — 파이프라인 순서상 M1 은 소비자 아닌 공동 호출자**: 실행 순서 = scene(`appendListBoxRowProjection`, `_slots` 주입) → **layout(M1 §1.55b-2, availableWidth 로 측정)** → **buildSpecNodeData(확정 style.width 로 측정 → `_slotMetrics` 주입)** → escape(`_slotMetrics` 소비). M1 은 layout 단계라 buildSpecNodeData 산출물보다 **먼저** 돈다 → M1 이 `_slotMetrics` 를 소비하는 것은 순서상 불가. 올바른 설계는 **M1·buildSpecNodeData = SSOT 함수의 공동 호출자**(동일 함수·동일 width → 동일 결과), **escape = `_slotMetrics` 유일 소비자**. 측정 호출 수는 M1(1) + buildSpecNodeData(1) = **2로 불변**(기존 M1 + escape = 2), escape 는 0 으로 감소. → ADR 본문의 "측정 2→1 감소" 는 **count-neutral 로 정정**; 실 benefit 은 **SSOT 단일화 + divergence(발견 1 포함) 제거**. `fullTreeLayout` 이 `element.props` 를 write 하지 않음(grep 0)이 M1→escape 직접 흐름 불가의 근거 — 그래서 buildSpecNodeData 주입 경로가 필요.

**라이브 baseline(BC 대조 기준, 2026-07-22)**: project `70da5ae3` `page-components` 의 collection 은 전부 **childful-unfold**(reusable origin — slot 자식이 실 `systemOwned` scene 노드, `hasSlots:false`, `items:[]`, dataBinding 없음). 따라서 M1·escape **flat-props 분기는 `!(childElements.length>0)` gating 으로 OFF** → 본 refactoring 이 구조적으로 건드리지 못함.

| 노드                              | 렌더 높이(skia==layout)   | 경로                      |
| --------------------------------- | ------------------------- | ------------------------- |
| `component-listbox-item-default`  | 84                        | unfold(child-sum)         |
| `component-listbox-item-selected` | 84                        | unfold                    |
| `component-gridlist-item-default` | 76                        | unfold                    |
| `component-menu-item-default`     | 96                        | unfold                    |
| `component-listbox`(container)    | visible 110 / content 168 | bounded-scroll(0821da280) |

- **flat-props projection 경로(data-bound runtime rows)는 현 project 상태에 부재** → 라이브로 target 경로를 exercise 불가. **BC 1차 oracle = Phase 4 differential 계약 테스트**(layout metric == escape metric == 기대값, 합성 props). unfold 경로(84/76/96)는 gating 으로 불변임을 Phase 5 에서 재확인(회귀 방지 상한).

## §3. Decision(D+C) 구현 — Phase 분해

### Phase 0 — 인벤토리 freeze + 계약 테스트 baseline

- §2 표를 코드 실측으로 확정(심볼·라인 고정). layout-util(M1/M2)과 escape(M3)가 각자 호출하는 측정 함수 인자(fontSize/weight/family/maxWidth/lineHeight) 대조표 작성.
- 현재 라이브 실측값(70da5ae3 ListBox 인스턴스 ba6a3aec) 을 baseline 으로 기록 — Phase 3 후 무변경(BC) 대조 기준.

### Phase 1 — layout-util 측정 함수 metric 객체화 (측정 로직 SSOT 유지)

- `resolveListBoxItemRowHeightFromStyle`(utils.ts:351)가 현재 **행 높이(number)만** 반환한다. 이를 **행 metric 객체**로 확장:
  ```
  { rowHeight, slotBlocks: { label: {height, y}, description?: {height, y} }, contentTop }
  ```
  (`y` = 행 좌표계 내 각 slot 텍스트 top; escape 스택 offset SSOT)
- GridList §1.55b2 인라인 공식도 동일 metric 반환 헬퍼로 추출(현재 인라인 → 공용 함수).
- 측정 로직 SSOT 는 이 함수 하나(폰트 fallback/weight/lineHeight/maxWidth 산출 집약). **주의**: 측정 로직은 이미 M1/M2 가 공유 중이며, 본 Phase 는 반환 형태만 metric 객체로 넓힌다 — 새 SSOT 를 만드는 게 아니다.

### Phase 2 — buildSpecNodeData 산출 + projection 행 props 주입 (측정 주체 확정)

- **측정 주체 = `buildSpecNodeData`**(layout 이후, escape 직전). scene projection 시점(layout 前)엔 `style.width` 가 `%`/`calc` 라 정확한 wrap 폭(px)을 모른다 — 반면 `buildSpecNodeData` 는 width injection(layout `w` → `style.width`, `buildSpecNodeData.ts:1514`)이 **이미 실제 카드 폭을 확정한 시점**이다.
- 따라서 `buildSpecNodeData` 가 확정된 `style.width` 로 Phase 1 layout-util metric 함수를 호출해 `_slotMetrics` 를 산출하고 escape props 에 주입한다. `_slots` / `_projectedRowsContentHeight` 주입 선례와 동일 props 경로, 단 **주입 시점은 scene 이 아니라 buildSpecNodeData**(폭 확정 보장).
- **주의(측정 주체 재검토 사항)**: `appendListBoxRowProjection`(canvasSceneNode, scene 시점)에서 주입하는 대안은 폭 미정으로 배제. Phase 0 에서 buildSpecNodeData 시점에 카드 폭·slot 구성·텍스트가 모두 확정돼 있는지 실측 확인 후 진입.

### Phase 3 — M1·escape 소비 전환 (재측정 제거)

- escape(`listBoxItem` / `gridListCard`, skiaPrimitives.ts)가 `props._slotMetrics` 존재 시 **자체 `measureSpecWrappedTextHeight` 호출을 skip** 하고 주입값(slotBlocks.height / y)으로 stackY·카드 높이·배경 밴드를 그린다.
- layout 렌더 행(M1 §1.55b-2, utils.ts:2475)도 `_slotMetrics` 존재 시 이를 소비하도록 전환 — **렌더 행당 측정 1회**(buildSpecNodeData 산출) 수렴 성립. 미전환 시 scene 신규 측정 + M1 자체 측정 = 2회 유지(성능 개선 무효).
- `_slotMetrics` 부재(legacy/비-projection) → escape 자체 측정 fallback(BC — 주입 측정기 경로 유지, escape 에 `measureSpecWrappedTextHeight` 잔존).
- 결과: 측정 산출 주체 = `buildSpecNodeData`, M1·escape = 소비자.

### Phase 4 — differential 계약 테스트 (C)

- `layout 행 height == escape 카드/행 height == CSS DOM 행 height` 3자 일치를 검증하는 계약 테스트.
- ADR-156 engine-css-parity differential oracle 선례(실 Chrome `getBoundingClientRect` ground truth) 준용 — 가능하면 브라우저 하니스, 최소는 M1/M3 동일 입력 → 동일 출력 단위 검증.
- **가상화 stride(M2)는 검증 대상 제외**(단일 줄 유지가 정상 계약, 157).

### Phase 5 — 회귀 검증 + closure

- 2026-07-22 5건(width `1506f237b` / gap `fc69a3c1e` / 행높이 `bc2c0ebd2` / 컨테이너동결 `0821da280` / 겹침 `a52a91905` + GridList `cb04c922c`) 재현 안 됨 라이브 확인.
- ListBox(라이브 재현 가능) + GridList(컨테이너 배치 후) 각 1회 exercise.

## §4. 파일 변경 예상

| 파일                                         | Phase | 변경                                                                                  |
| -------------------------------------------- | ----- | ------------------------------------------------------------------------------------- |
| `apps/builder/.../layout/engines/utils.ts`   | 1     | `resolveListBoxItemRowHeightFromStyle` metric 객체 반환 + GridList 공용 헬퍼 추출     |
| `apps/builder/.../skia/buildSpecNodeData.ts` | 2     | 확정 `style.width` 로 metric 산출 → `_slotMetrics` 주입 (측정 주체, 폭 확정 시점)     |
| `packages/specs/.../skiaPrimitives.ts`       | 3     | `listBoxItem`/`gridListCard` `_slotMetrics` 소비 + 재측정 skip (fallback 분기만 잔존) |
| `apps/builder/.../layout/engines/utils.ts`   | 3     | §1.55b-2 가 `_slotMetrics` 소비 전환 (측정 1회 수렴 — 미전환 시 2회 유지)             |
| `apps/builder/.../__tests__/*`               | 4     | differential 계약 테스트 신규                                                         |
| (회귀 테스트)                                | 5     | 기존 5건 재현 가드 유지                                                               |

## §5. 체크리스트

- [x] Phase 0: 대조표 + baseline + buildSpecNodeData 시점 실측 완료 → §2.1 freeze (발견 1 icon/check divergence, 발견 2 M1=공동 호출자·count-neutral)
- [x] Phase 1: SSOT metric 함수 `resolveCollectionRowMetric`(icon/check-aware, `collectionItemMetrics.ts`) — rowHeight + slotBlocks{height,y,lineHeight} + maxWidth 반환, ListBox/GridList 공용(단일 함수가 GridList 인라인 공식도 대체). dormant(소비 배선은 Phase 3). 단위 테스트 10건 PASS(escape 74/98/50 정합) + 회귀 79 + type-check baseline. commit `822359006`
- [x] ~~Phase 2: buildSpecNodeData `_slotMetrics` 주입~~ → **직접 호출로 대체(설계 편차, §2.2)**. escape 는 이미 buildSpecNodeData width injection(`style.width`, :1514)으로 확정 폭을 받으므로 SSOT 함수를 직접 호출 — prop 주입/직접호출 둘 다 count-neutral·동일 통로 봉쇄, 직접호출이 plumbing/미사용 prop 없이 더 간단
- [x] Phase 3: escape(3a, `6b3ffd978`) + M1(3b, `fe43c833f`) 모두 `resolveCollectionRowMetric` 직접 호출로 전환 — geometry 통로 봉쇄. ListBox M1 = padding-box `.rowHeight`, GridList M1 = content-box `.contentHeight`(계약별 반환). `_slotMetrics` 부재 개념 없음(주입 미도입) → escape 는 항상 SSOT 호출(measureSpecWrappedTextHeight 는 SSOT 내부로 이동, escape 직접 호출 0건 — G1 보다 강함). 검증: 637 specs + 69 collection builder + type-check baseline
- [x] Phase 4: differential 계약 테스트 `collectionRowMetricDifferential.test.ts` 3건 PASS — M1(layout) rowHeight/contentHeight == escape(paint) 높이(ListBox check y×2 / GridList card-bg height) 직접 대조. CSS DOM oracle 은 현 project flat-props 부재로 보류(§2.1) → 폭-불문 mock 으로 geometry parity 격리 검증
- [x] Phase 5: 라이브(70da5ae3) type-check baseline + collection layout==skia mismatch 0 확인 (childful 경로) — flat-props 5건 회귀는 재현 불가(unfold), differential 이 oracle
- [x] ADR-157 표시 정책(가상화 stride M2 단일 줄) 무변경 — `resolveListBoxItemRowHeightFromStyle` wrapContext 미전달(M2) = 텍스트 미전달 → 단일 줄 유지 확인
- [x] 측정 경로 count-neutral 확인 (M1 + escape = 2 유지; §2.1 발견 2 — "1회 수렴" 아님, divergence 제거가 benefit)
- [x] BC: unfold 경로(84/76/96) gating 불변 — 라이브 layout==skia mismatch 0(46요소·5 collection) + 콘솔 에러 0 재확인
- [x] 후속 F1(§2.3): `resolveListBoxItemInset` helper + escape 채택 + gridlist descGap SSOT화 + 단위 8. commit `98e8f63f3`
- [x] 후속 F2(§2.3): M1 icon/check-aware inset(§1.55b-2) + GridList descGap(§1.55b2) + 폭-민감 differential 2. 입력 산출 잔존 (a)(b)(c) 봉쇄. commit `d9a4b402f`

## §2.2. 설계 편차 — `_slotMetrics` prop 주입 → SSOT 직접 호출 (2026-07-22 execute-adr)

ADR 대안 D 는 `buildSpecNodeData` 가 metric 을 산출해 `_slotMetrics` prop 으로 주입하고 escape 가 소비하는 경로를 규정했다(Gate G1). 실행 중 확인: **escape 는 이미 `buildSpecNodeData` width injection(`style.width` = layout `w`, `buildSpecNodeData.ts:1514`)으로 확정 폭을 받는다** → escape 가 SSOT 함수를 **직접 호출** 가능. 두 경로 비교:

| 항목          | prop 주입(ADR 원안)                                                        | 직접 호출(채택)                       |
| ------------- | -------------------------------------------------------------------------- | ------------------------------------- |
| 측정 호출 수  | M1 + buildSpecNodeData = 2                                                 | M1 + escape = 2 (동일, count-neutral) |
| geometry 통로 | 봉쇄(SSOT 공유)                                                            | 봉쇄(SSOT 공유) — 동일                |
| plumbing      | `_slotMetrics` prop + buildSpecNodeData 산출부 + escape 소비/fallback 분기 | 없음                                  |
| 미사용 prop   | scene/canonical 오염 방지 필요                                             | 없음                                  |

직접 호출이 동일 목표(측정 SSOT 단일화·divergence 제거)를 더 적은 코드/위험으로 달성. Gate G1("measureSpecWrappedTextHeight fallback 분기에만 잔존")은 **더 강한 형태로 충족** — escape 에서 `measureSpecWrappedTextHeight` 직접 호출 0건(SSOT 함수 내부로 이동). 측정 주체 계약(scene %/calc 아님, 확정 `style.width`)도 escape·M1 양쪽 충족. MED-2(측정 주체 폭 확정)는 escape 가 확정 `style.width` 를 쓰므로 유지.

## §2.3. 후속 F1/F2 — 입력 산출 잔존 봉쇄 (2026-07-23)

Phase 3 는 geometry 통로(rowHeight/블록 offset/wrap 측정)를 `resolveCollectionRowMetric` 로 봉쇄했으나, 그 함수에 넘기는 **입력**(textX/rightReserve/gap)은 M1·escape 가 독립 산출해 §2.1 발견 1 + gap-source 잔존 (a)(b)(c) 가 남았다. 후속 F1/F2 가 입력 산출도 공유 SSOT 로 봉쇄.

| 잔존                              | 형태                                                                                                                                         | 봉쇄                                                                                                                                                                                                     |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| (a) icon/check-aware maxWidth     | M1 `textX=paddingLeft, rightReserve=0` vs escape `textX=max(padL, slotInset+iconSize+slotGap)`, `rightReserve=showCheck?checkSize+slotGap:0` | 공유 `resolveListBoxItemInset({paddingLeft, slotInset, iconSize, hasIcon, showCheck})` → `{textX, rightReserve}`. escape·M1 공동 호출. M1 §1.55b-2 caller 가 slot 구성 + `isSelected` 에서 컨텍스트 추출 |
| (b) GridList within-card gap      | M1 `gap = style.gap ?? 2` vs escape `descGap = 2`(리터럴)                                                                                    | 양쪽 `resolveGridListItemMetric(labelFs).descGap`(고정 2, SSOT) 경유 — style.gap 무관                                                                                                                    |
| (c) icon slot fontSize → iconSize | M1 iconSize 미산출(=(a) 흡수) vs escape `iconSlotStyle.fontSize ?? size.iconSize ?? 16`                                                      | M1 caller 가 `slotComp.slots.icon.style.fontSize ?? 16` 를 inset 컨텍스트 `iconSize` 로 전달                                                                                                             |

**설계**: F1(specs, `98e8f63f3`) — `resolveListBoxItemInset` helper 추가 + escape `listbox_item` 채택(behavior-preserving) + escape `gridlist_card` descGap 을 `resolveGridListItemMetric` 경유로 SSOT화 + 단위 테스트 8. F2(builder, `d9a4b402f`) — M1 `resolveListBoxItemRowHeightFromStyle` 에 `insetContext` 파라미터 추가(미전달 시 icon/check 미예약 BC — 가상화 stride 단일 줄 경로), §1.55b-2 caller 배선, §1.55b2 GridList descGap 전환, **폭-민감** differential 2건.

**oracle**: 현 project 는 childful-unfold 라 flat-props 분기 gating OFF → 라이브 재현 불가. 봉쇄 증명은 **폭-민감 measurer** 를 주입한 differential 테스트(`collectionRowMetricDifferential.test.ts`) — icon+selected 행에서 `M1(inset) === escape` + `inset 미적용(구 M1) < escape`(잔존 실재·봉쇄 회귀 가드). 라이브(70da5ae3)는 childful 경로 무영향(46요소·5 collection layout==skia mismatch 0, 콘솔 에러 0) 확인.

**남은 latent(더 깊은 residual, 후속 판정 대상 아님)**: M1 caller 의 `hasIcon` 은 escape `readCardText(props.icon)` 를 `Boolean(props.icon)` 로 근사(비-string icon descriptor 는 truthy 로 동일 판정, 빈 문자열은 falsy 로 동일). `slotInset`/`iconSize` 기본값(12/16)은 ListBoxItem md catalog 값과 동일 가정 — non-md size 에서 escape `size.paddingX`/`size.iconSize` 와 갈릴 수 있으나 flat-props 미노출 + 값 동일(현 catalog).

**잔존(§2.1 발견 1/gap-source 후속, latent) — ✅ 봉쇄 완료(2026-07-23 후속 F1/F2, §2.3)**: geometry 함수는 Phase 3 에서 공유됐고, **입력 산출**(textX/rightReserve/gap) 잔존 (a)(b)(c) 는 후속 F1/F2 로 봉쇄됐다. 아래 §2.3 참조.
