# ADR-146: ListBoxItem Ref Template and Row Projection

## Status

Proposed - 2026-05-28

진행 로그:

- 2026-05-28 - ADR 본문 + design breakdown 발의.
- 사용자 lock-in:
  - Layer Tree에는 반복 row가 표시되어야 한다.
  - `ListBoxItem` template anchor는 삭제 불가가 맞다.
  - `ListBoxItem` slot 허용 범위는 시각/content slot으로 제한한다.
  - `ListBox` parent가 모든 row를 한 번에 Skia 렌더링하는 현재 방식은 원하지 않는다.
  - 좌측 패널 1/2 분리 UX는 ADR-142/143 시도와 rollback 경험상 혼동을 주므로 사용하지 않는다.
  - `Components` page를 프로젝트 생성 시 자동 생성하고, 일반 page처럼 선택하면 Skia canvas와 Layers Tree에 구조가 그대로 나타나야 한다. 단 Preview/Publish에는 제외한다.

## Context

ADR-145는 ListBox에 `ListBoxItem` template child를 도입하고 `props.items` 기반 data SSOT를 유지했다. 하지만 ADR-145의 Skia Phase B는 여전히 `ListBoxSpec.render.shapes`가 `items`와 template style을 결합해 row를 parent 안에서 한 번에 paint하는 방향을 허용했다.

이번 사용자 검토에서 그 방향은 명확히 기각됐다. Builder authoring 모델에서 반복 row는 숨겨진 parent paint가 아니라 Layer Tree projection으로 보여야 한다. Skia도 parent가 row 전체를 composite paint하는 방식이 아니라, visible row projection을 `ListBoxItem` ref template 렌더 경로로 그려야 한다.

동시에 `ListBoxItem` origin을 여러 page의 `ListBox` 안에 중복 생성하면 Pencil/shadcn format의 reusable/ref 장점을 잃는다. `ListBoxItem/Default` 같은 reusable origin은 editor-only `Components` page에 한 번만 보관하고, 실제 page의 `ListBox`는 그 origin을 가리키는 `ref` template anchor를 가진다.

Pencil/shadcn fixture는 다음을 증명한다.

- `docs/migrations/shadcn-tabs.json`: `Tab Item/Active` origin, inactive variant `ref`, `Tabs.slot`, instance children의 `descendants` override 패턴.
- `docs/migrations/shadcn-cards.json`: `Card` origin이 header/content/actions slot frame을 갖고, variants/instances가 `ref` + `descendants`로 slot content를 교체하는 패턴.
- `docs/migrations/shadcn-design-system.json`: `Dropdown`, `Table Row`, `Table`, `Data Table Content` 등이 slot allow-list와 reusable/ref를 조합하는 패턴.

다만 Pencil/shadcn fixture에는 data-bound collection repetition 샘플이 없다. 따라서 `items`/collection data에서 row projection을 만드는 부분은 Composition-specific extension으로 명시한다. React Aria ListBox의 dynamic collection은 `items`와 render function/ListBoxItem 조합을 허용하지만, Composition Builder에서는 그 render function에 해당하는 authoring template을 canonical reusable/ref로 표현한다.

### 3-domain 분류

- **D1 DOM/접근성/상호작용**: React Aria Components `ListBox`/`ListBoxItem`가 권위다. selection, keyboard, ARIA 동작은 RAC 경로를 따른다.
- **D2 Props/API**: `ListBox.props.items` 또는 ADR-132 `collections.runtimeData`가 반복 data SSOT다. row id/text/description/selection props는 collection item에서 온다.
- **D3 시각/구조**: `ListBoxItem` reusable origin과 그 descendants/slot 구조가 row template의 시각 SSOT다. Skia는 이 template을 row projection마다 resolve해 visible row 단위로 렌더한다.

### Hard Constraints

1. `Components` page는 프로젝트 생성 시 자동 생성되는 system page다. `Home` 왼쪽/앞에 표시하고 일반 page와 동일하게 선택한다.
2. `Components` page는 Builder Skia canvas에 일반 page처럼 렌더링된다. Layers Tree도 일반 page와 같은 경로로 표시한다.
3. `Components` page는 Preview/Publish/runtime page list/export에서는 제외한다. `page-n` 자동 이름 카운트에도 포함하지 않는다.
4. `Components` page 자체와 그 안의 system-owned origin template은 삭제 불가다. 필요하면 user-owned component origin과 system-owned component origin을 구분한다.
5. Component Panel에 `ListBoxItem`을 일반 placeable 컴포넌트로 중복 노출하지 않는다. `ListBoxItem`은 `Components` page의 reusable origin과 `ListBox` 내부 template anchor로만 다룬다.
6. 실제 content page의 `ListBox`는 삭제 불가 `ListBoxItem` ref template anchor를 가진다.
7. Layer Tree는 `ListBox` 아래에 template anchor와 row projection을 모두 표시한다.
8. Row projection은 canonical 저장 노드가 아니다. collection data에서 파생한 render/interaction projection이며, id 안정성과 selection hit-test만 제공한다.
9. Skia는 `ListBox` parent가 모든 row를 한 번에 그리는 composite paint를 사용하지 않는다. visible row마다 `ListBoxItem` template/ref renderer를 통과한다.
10. Static authoring mode는 `ListBox` children에 실제 `ListBoxItem` ref children을 저장할 수 있다. Data-bound/large collection mode는 locked template anchor 1개와 row projection을 사용한다.
11. `ListBoxItem` slot은 text, description, icon, indicator 같은 visual/content slot으로 제한한다. row 안의 nested interactive child는 허용하지 않는다. interactive row content는 GridList/Table 후속 ADR 범위다.
12. `ListBox`의 slot allow-list는 `ListBoxItem/Default`, optional `ListBoxItem/Selected` 같은 item template variants로 제한한다.
13. `descendants` override는 template instance의 content/text/style override에 사용한다. collection row data는 origin이나 ref node에 저장하지 않는다.
14. ADR-145의 factory/hydration migration 성과는 유지하되, ADR-145 Phase B의 parent composite row paint는 본 ADR이 후속 보정한다.

### Soft Constraints

- Pencil/shadcn format에서 검증된 reusable origin, `type:"ref"`, `descendants`, `slot` allow-list를 최대한 그대로 사용한다.
- 신규 schema field를 최소화한다. 가능한 경우 기존 `reusable`/`ref`/`descendants`/`slot`와 page metadata/system flag로 해결한다.
- scope는 ListBox 단일 proof다. ComboBox/Select/GridList/Table/Tree 등 다른 collection family로 일반화하지 않는다.
- 이전 ADR-142/143 시도처럼 좌측 panel 내부를 1/2 모드로 나누지 않는다.

## Target Structures

### Components page

```text
Components / Template Page  // Builder-only, Preview/Publish 제외
├─ ListBoxItem/Default      // reusable origin
├─ ListBoxItem/Selected     // optional reusable/ref variant
└─ ListBox                  // reusable origin
   └─ slot: [ListBoxItem/Default, ListBoxItem/Selected]
```

이 page는 source graph 보관소이면서 동시에 Builder가 선택하면 Skia canvas에 page처럼 렌더링되는 editor page다.

### Content page

```text
Page A
└─ ListBox
   ├─ ListBoxItem           // reusable ref instance, template anchor, 삭제 불가
   └─ Rows                  // Layer Tree projection
      ├─ Aardvark
      ├─ Cat
      └─ Kangaroo
```

`Rows` 아래 항목은 collection projection이다. Layer Tree와 selection overlay에는 보이지만 canonical document에는 row마다 저장하지 않는다.

### Static mode

```text
Page A
└─ ListBox
   ├─ ListBoxItem ref       // item 1
   ├─ ListBoxItem ref       // item 2
   └─ ListBoxItem ref       // item 3
```

정적 아이템 수가 작고 사용자 authoring 대상이면 실제 ref child를 저장할 수 있다. 이 경우 Pencil `Tabs` fixture와 같은 구조다.

## Alternatives Considered

### 대안 A: Components page + ListBoxItem ref template + row projection (채택)

- 설명:
  - system `Components` page에 `ListBoxItem` reusable origin을 한 번만 보관한다.
  - content page의 `ListBox`는 origin을 가리키는 locked `ListBoxItem` ref template anchor를 가진다.
  - Layer Tree는 template anchor와 data-bound row projection을 구분해 표시한다.
  - Skia는 visible row projection마다 template/ref renderer를 사용한다.
- 위험:
  - 기술 MED - Layer Tree projection, selection hit-test, Skia renderer 경계가 필요하다.
  - 성능 MED - row projection은 visible range/virtualization과 결합해야 한다.
  - 유지보수 MED - Components page system semantics와 content page projection semantics가 추가된다.
  - 마이그레이션 MED - 기존 ADR-145 local template child를 origin/ref anchor로 전환해야 한다.

### 대안 B: ADR-145 local template child + ListBox parent composite paint 유지 (기각)

- 설명: `ListBoxItem` template child는 두되, `ListBoxSpec.render.shapes`가 `items`와 template style을 결합해 parent에서 row를 paint한다.
- 기각 사유:
  - 사용자 요구와 충돌한다. 반복 row가 Layer Tree projection으로 보여야 하며 parent가 한 번에 렌더하는 방식은 원하지 않는다.
  - `ListBoxItem` template이 실제 row renderer 권위가 아니라 style payload 보관소로 축소된다.
  - Skia authoring path와 canonical/ref/slot 모델이 계속 어긋난다.
- 위험:
  - 기술 LOW
  - 성능 LOW
  - 유지보수 HIGH
  - 마이그레이션 LOW

### 대안 C: data-bound row를 모두 canonical `ListBoxItem` ref child로 저장 (기각)

- 설명: collection data의 row 수만큼 canonical `ListBoxItem` ref child를 materialize한다.
- 기각 사유:
  - 1,000/10,000 row에서 document size, history, persistence, Layer Tree mutation cost가 폭증한다.
  - RAC dynamic collection의 `items` 모델과 반대로 data를 구조 노드로 복제한다.
  - collection refresh 시 canonical tree churn이 발생한다.
- 위험:
  - 기술 MED
  - 성능 HIGH
  - 유지보수 MED
  - 마이그레이션 HIGH

### 대안 D: hidden registry `itemTemplateRef`만 두고 Components page를 숨김 (기각)

- 설명: `ListBox.props.itemTemplateRef` 같은 hidden pointer로 template origin을 참조하고, Builder UI에는 별도 source page를 노출하지 않는다.
- 기각 사유:
  - origin 편집 위치가 숨겨져 사용자가 template source를 찾기 어렵다.
  - 이전 1/2 방식처럼 authoring mental model을 분리해 혼동을 만든다.
  - Pencil/Google Stitch/Pencil app식 source page 패턴을 활용하지 못한다.
- 위험:
  - 기술 LOW
  - 성능 MED
  - 유지보수 HIGH
  - 마이그레이션 MED

### Risk Threshold Check

| 대안 | 기술 | 성능 | 유지보수 | 마이그레이션 | HIGH+ 개수 |
| ---- | :--: | :--: | :------: | :----------: | :--------: |
| A    |  M   |  M   |    M     |      M       |     0      |
| B    |  L   |  L   |    H     |      L       |     1      |
| C    |  M   |  H   |    M     |      H       |     2      |
| D    |  L   |  M   |    H     |      M       |     1      |

대안 A는 구현 범위가 가장 크지만 HIGH+ 위험이 없다. 대안 B는 단기 구현이 가장 작지만 사용자 lock-in과 Skia authoring 모델을 깨뜨린다. 대안 C는 data-bound collection의 크기 특성을 무시한다. 대안 D는 source visibility를 숨겨 UX와 유지보수 위험을 만든다.

## Decision

**대안 A: Components page + ListBoxItem ref template + row projection**을 선택한다.

세부 결정:

1. 프로젝트 생성 시 system `Components` page를 자동 생성한다.
2. `Components` page는 Page list에서 일반 page와 동일하게 선택 가능하며, Builder Skia와 Layers Tree가 같은 render path로 보여준다.
3. `Components` page는 Preview/Publish/runtime export에서는 제외한다.
4. `Components` page에는 `ListBoxItem/Default` reusable origin, optional `ListBoxItem/Selected` variant, `ListBox` reusable origin을 둔다.
5. `ListBox` origin의 slot allow-list는 `ListBoxItem` template variants로 제한한다.
6. content page에 배치된 `ListBox`는 locked `ListBoxItem` ref template anchor를 가진다. 이 anchor는 삭제 불가이며 row 1개가 아니라 row render template이다.
7. Layer Tree는 `ListBox` 아래에 `Rows` projection group을 만든다. row projection은 collection item id를 기반으로 stable projection id를 가진다.
8. row projection을 선택하면 Inspector는 collection item data binding 또는 row template override 가능한 surface를 표시한다. row projection 자체를 canonical child로 저장하지 않는다.
9. Skia renderer는 visible row마다 `ListBoxItem` ref template을 resolve해 렌더한다. `ListBox` parent composite row paint는 제거하거나 compatibility fallback으로만 격리한다.
10. Preview/Publish DOM 경로는 RAC dynamic collection 패턴을 유지한다. 다만 Builder canonical authoring source는 template ref anchor와 `items` data를 분리해 표현한다.
11. static authoring mode는 실제 `ListBoxItem` ref child 저장을 허용한다. data-bound/large collection mode는 locked template anchor + projection model을 사용한다.
12. `ListBoxItem` 내부 slot은 text/description/icon/indicator 등 non-interactive visual slot으로 제한한다.

> 구현 상세: [146-listboxitem-ref-template-row-projection-breakdown.md](design/146-listboxitem-ref-template-row-projection-breakdown.md)

## Risks

| ID  | 위험                                                                                            | 심각도 | 대응                                                                                                                     |
| --- | ----------------------------------------------------------------------------------------------- | :----: | ------------------------------------------------------------------------------------------------------------------------ |
| R1  | Components page가 일반 page처럼 보이면서도 preview/publish에서 제외되어야 한다.                 |  MED   | page metadata/system flag와 page list/export allowlist를 Gate G1에서 동시에 검증한다.                                    |
| R2  | row projection id와 canonical node id가 섞이면 selection, hover, drag/drop mutation이 깨진다.   |  MED   | projection id namespace와 canonical target resolver를 분리하고 Gate G3에 mutation no-op/route fixture를 둔다.            |
| R3  | Skia가 parent composite paint와 row template renderer를 혼용하면 CSS/Preview drift가 남는다.    |  MED   | Gate G4에서 ListBox parent row paint direct path 0건 또는 compatibility-only 격리를 검증한다.                            |
| R4  | data-bound collection이 큰 경우 Layer Tree row projection이 UI를 느리게 만들 수 있다.           |  MED   | Layer Tree도 visible/expanded range projection을 사용한다. 전체 rows materialization은 금지한다.                         |
| R5  | `ListBoxItem` slot에 interactive child를 허용하면 RAC ListBox semantics가 깨진다.               |  MED   | Slot allow-list와 insert guard를 둔다. interactive child는 GridList/Table ADR로 보낸다.                                  |
| R6  | 기존 ADR-145 프로젝트의 local template child migration이 origin/ref 구조로 바뀌며 깨질 수 있다. |  MED   | migration helper와 round-trip fixture를 추가한다. 기존 local template style은 `ListBoxItem/Default` origin으로 승격한다. |
| R7  | `Components` page 삭제/rename/duplicate 동작이 일반 page 조작과 충돌할 수 있다.                 |  LOW   | system page delete guard, rename policy, duplicate policy를 명시하고 UI affordance를 제한한다.                           |

잔존 HIGH 위험: 0건.

## Gates

| Gate | 시점                      | 통과 조건                                                                                                                                                                       | 실패 시 대안                              |
| ---- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| G0   | Fixture/inventory freeze  | `shadcn-tabs`, `shadcn-cards`, `shadcn-design-system`의 reusable/ref/descendants/slot evidence를 문서화. ADR-145와 충돌하는 Skia parent paint surface inventory 완료.           | ADR-146 구현 착수 보류                    |
| G1   | Components page bootstrap | 신규 프로젝트에 `Components` system page 자동 생성. `Home` 앞 표시. 일반 page 선택/Skia/Layers 표시 PASS. Preview/Publish/runtime list/export 제외 PASS. `page-n` 카운트 제외.  | system page semantics 먼저 고정           |
| G2   | Origin/ref/slot model     | `Components` page에 `ListBoxItem/Default`, optional selected variant, `ListBox` origin 생성. content page `ListBox`가 locked ref template anchor를 참조. 삭제 guard PASS.       | local template child fallback 유지        |
| G3   | Layer Tree row projection | `ListBox > ListBoxItem(template anchor) > Rows > row labels` 표시. row projection id 안정성, selection, hover, Inspector read path, mutation no-op/route fixture PASS.          | row projection UI 숨김 후 재설계          |
| G4   | Skia/Preview parity       | Skia visible row가 `ListBoxItem` template/ref renderer를 통과. parent composite row paint direct path 0건 또는 compatibility-only 격리. DOM Preview RAC collection parity PASS. | Skia path rollback, ADR-145 fallback 유지 |
| G5   | Migration/compat          | ADR-145 local template child가 Components page origin/ref anchor로 무손실 migration. reusable master round-trip, import/export, hydration refresh PASS.                         | migration gate 보류                       |
| G6   | Verification/closure      | targeted Vitest + ListBox cross-check + `pnpm run codex:typecheck` + 필요한 browser sanity PASS. README/CHANGELOG/ADR status sync.                                              | Proposed 유지, Implemented 승격 금지      |

## Consequences

### Positive

- `ListBoxItem` template origin이 page마다 중복되지 않는다.
- Components source가 숨겨지지 않고 일반 page 선택, Skia, Layers Tree로 편집 가능하다.
- 반복 row가 Layer Tree projection으로 보이며, Builder authoring mental model과 Skia 렌더 경로가 맞춰진다.
- data-bound collection은 canonical node 폭증 없이 `items` SSOT를 유지한다.
- Pencil/shadcn reusable/ref/descendants/slot 패턴과 RAC dynamic collection 패턴을 동시에 존중한다.

### Negative

- Components page system semantics가 새로 필요하다.
- Layer Tree에 canonical node와 projection node가 공존하므로 id namespace와 mutation routing을 엄격히 분리해야 한다.
- Skia renderer가 `ListBoxItem` template/ref를 row 단위로 resolve해야 하므로 ADR-145 parent paint보다 구현량이 크다.
- ListBox 단일 proof라서 다른 collection family에는 자동 적용되지 않는다.

## References

- React Aria ListBox: <https://react-spectrum.adobe.com/react-aria/ListBox.html>
- React Aria Collections: <https://react-spectrum.adobe.com/react-aria/collections.html>
- `docs/migrations/shadcn-tabs.json`
- `docs/migrations/shadcn-cards.json`
- `docs/migrations/shadcn-design-system.json`
- [ADR-145](completed/145-listbox-template-element-single-component-proof.md)
- [ADR-142](142-starter-spec-component-system-cutover.md)
- [ADR-132](completed/132-usecollectiondata-useasynclist-alignment.md)
- [ADR-130](completed/130-layer3-canonical-vocabulary-alignment.md)
- [ADR-076](completed/076-listbox-items-ssot.md)
