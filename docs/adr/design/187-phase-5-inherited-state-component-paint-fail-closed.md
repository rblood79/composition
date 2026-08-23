# ADR-187 Phase 5 — inherited/state/component paint fail-closed slice

## 판정

이번 잔여 paint 감사에서는 opacity provenance와 Button inherited color projection의
최소 계약을 추가했다. 아직 다음 범위는 consumer 계약 부족으로 canonical
commit-only에 남긴다.

### Inherited/state opacity

- CSS cascade의 `opacity`는 현재 `INHERITABLE_PROPERTIES`에 포함되지 않으므로
  inherited opacity를 독립적인 explicit style target으로 읽을 수 없다.
- Skia opacity effect에 `style`/`state`/`animation`/`presentation` source provenance를
  부여하고, `StoreRenderBridge.applyPresentationStylePatch`는 style/presentation
  slot만 갱신한다.
- state/disabled effect의 Skia patch/restore는 typed provenance 회귀 테스트로
  검증했지만, DOM state cascade와의 별도 Preview/Skia 합성 fixture는 아직 없다.
- 따라서 opacity pilot은 canonical root만 허용하고, ref-descendant 및
  `isDisabled`/`disabled` target은 fail-closed한다. 명시적 `opacity: 1`은
  기존 opacity effect가 없는 rendered root에서만 transient materialization한다.

재개 조건은 Preview에도 explicit opacity layer와 state opacity layer의 provenance를
동일하게 보존하고, inherited/disabled Builder fixture에서 두 layer를 독립적으로
patch/restore하는 공통 합성 계약을 확보하는 것이다.

### Multi-child inherited/component color

- Button root는 `propagation: inherited-subtree`를 사용하고, Skia/Preview projection
  index가 own-color가 없는 descendant만 별도 target set으로 수집한다.
- `SkiaEditorPresentationBridge`와 Preview runtime store가 같은 propagation을 소비해
  drag/cancel/terminal에서 descendant target을 원자적으로 patch/restore한다.
- standalone Text는 기존 `self` target을 유지한다.

따라서 검증된 standalone `Text`와 `Button` root 외 component type은
`TEXT_COLOR_PRESENTATION_TYPES` allowlist에서 열지 않는다. 추가 component는 root →
descendant projection fan-out, Skia text slot set, Preview descendant semantic
delta, 동일 transaction의 atomic commit/cancel fixture를 확보한 뒤에만 연다.

### Unverified component root

shell-only container, delegated/conditional primitive, indicator-only component와
자체 text를 갖는 component root는 Skia materialization이 서로 다르다. root가
실제로 어떤 text slot을 소유하는지, 자식에게 위임되는지, state/variant가 별도
paint를 추가하는지에 대한 component별 fixture가 없다. 타입명만 allowlist에
추가하는 것은 partial paint와 DOM/Skia divergence를 만들 수 있으므로 금지한다.

재개 조건은 component root별 populated Builder fixture에서 다음을 동시에 확인하는
것이다.

1. root/descendant의 Skia text target ownership
2. Preview DOM descendant color parity
3. geometry, hit-test, children-map 불변
4. drag/cancel/terminal handoff의 canonical/history/persist atomicity

## Regression guard

`editorPresentationPhase2.static.test.ts`가 opacity state/ref-descendant fail-closed와
Text/Button-only color allowlist를 고정하고, projection index tests가 inherited target
set과 self target 분리를 검증한다. 추가 component consumer 계약이 생기기 전에는
allowlist를 완화하지 않는다.

이 slice는 지원 범위를 억지로 확장하지 않은 판정 기록이며, ADR-187 Phase 5 전체를
`Implemented`로 승격하는 근거가 아니다.
