# ADR-187 Phase 5 — non-grid flow layout live parity harness

검증 범위: `in-flow width/height`, `padding`, `gap`의 populated Builder
`Compare Mode (Preview + Skia)` parity.

## 재현 하니스

기존 `apps/builder/scripts/adr187-presentation-baseline.mjs`에
`flow-layout` fixture와 `--layout-property`를 추가했다. fixture는 다음 트리를
생성한다.

```text
body
├─ adr187-flow-parent (display:flex; row; width:360px; padding:8px; gap:8px)
│  ├─ adr187-target (in-flow; 100px × 60px)
│  ├─ adr187-flow-sibling (in-flow; 100px × 60px)
│  └─ adr187-flow-visual (in-flow; 100px × 60px; visible fill)
└─ adr187-flow-filler-0 (비영향 identity sentinel)
```

각 run은 아래 상태를 같은 browser context에서 수집한다.

- Skia `bounds`, `hitBounds`, `presentationRevision`, `boundsIdentity`,
  `hitBoundsIdentity`
- target/sibling의 before·during·restored geometry
- Preview iframe의 target/sibling `getBoundingClientRect()`와 computed style
- canonical style의 before·during·terminal 값
- 비영향 filler의 bounds/hitBounds identity 유지 여부
- terminal 이후 canvas screenshot hash와 trace

실행 예:

```bash
node apps/builder/scripts/adr187-presentation-baseline.mjs \
  --base-url http://127.0.0.1:5173/composition \
  --duration-ms 1000 --repeats 1 --tiers 5 \
  --fixture-profile flow-layout --lane layout \
  --layout-property width \
  --out /private/tmp/adr187-phase5-layout-width.json \
  --trace-dir /private/tmp/adr187-phase5-layout-width-traces
```

dashboard 생성이 가능한 격리 프로젝트 대신 이미 실행 중인 Builder를 사용할 때는
같은 origin의 `/builder/<project-id>` URL을 `--project-url`로 전달한다. 이 모드는
기존 프로젝트에서 `adr187-flow-*` fixture가 없을 때만 fixture를 한 번 추가하고,
기존 문서의 다른 요소는 tier 확장 대상으로 사용하지 않는다. 따라서 기존 프로젝트
모드에서는 `--tiers`를 하나만 지정해야 한다.

```bash
node apps/builder/scripts/adr187-presentation-baseline.mjs \
  --base-url http://localhost:5173/composition \
  --project-url http://localhost:5173/builder/<project-id> \
  --duration-ms 1000 --repeats 1 --tiers 5 \
  --fixture-profile flow-layout --lane layout \
  --layout-property padding \
  --out /private/tmp/adr187-phase5-layout-existing-padding.json \
  --trace-dir /private/tmp/adr187-phase5-layout-existing-padding-traces
```

결과 JSON의 `project.mode`가 `existing`인지 확인하고, `tiers[0].runs[0].layout`의
target/sibling Skia bounds·hitBounds·identity, Preview rect, canonical terminal 값과
`diagnostics.consoleMessages`/`pageErrors`를 함께 보관한다. 이는 dashboard 생성
실패와 인증/브라우저 실행 실패를 구분해 live evidence blocker를 재현 가능하게 한다.

`--layout-property`는 `width`, `height`, `padding`, `gap` 중 하나로 반복한다.
`padding`과 `gap`은 flow parent를 target으로 삼고, `width`와 `height`는
flow child를 target으로 삼는다. 모든 경우 sibling과 filler identity를 같이
읽어 affected-root 범위와 비영향 범위를 구분한다.

## 통과 기준

1. during의 target/sibling Skia `bounds`와 `hitBounds` 좌표가 동일하다.
2. Preview rect는 Skia geometry와 compare-pane offset을 정규화했을 때 같은
   width/height/상대 sibling 배치를 가진다.
3. filler의 `boundsIdentity`와 `hitBoundsIdentity`는 before/during/restore에서
   유지된다.
4. during에는 canonical style이 변하지 않고, terminal 이후 canonical style과
   Preview/Skia가 before 값으로 복귀한다.
5. target command stream의 `presentationRevision`은 증가하고, terminal 뒤
   stale callback은 0이다.
6. Preview/Skia의 sub-pixel layout 차이는 `0.5px` 이내이며, during/restored
   Canvas hash가 각각 변경/복귀한다.

## Builder live spot-check — 2026-08-24

사용자가 실행 중인 Builder
(`http://localhost:5173/builder/36fb9ef0-94be-4389-a8ad-b7609985d188`)에서
상단 `Compare Mode (Preview + Skia)`를 열고 기존 `Badge` node를 대상으로
spacing 입력을 확인했다. Preview iframe과 Skia Canvas가 동시에 표시된 상태에서
다음 결과를 얻었다.

- 초기 Preview computed style/rect: `padding: 12px 24px`, `gap: 8px`,
  `102.109375 × 52px`.
- Padding을 `20px`로 변경한 뒤: `padding: 20px`,
  `94.109375 × 68px`.
- Gap을 `24px`로 변경한 뒤: `gap: 24px`가 적용됐다. 단일 child라서 해당
  spot-check의 최종 rect에는 gap 자체의 추가 폭 변화가 없다.
- 수정 전에는 shorthand와 longhand를 동시에 제거하려는 React 경고가 재현됐지만,
  spacing normalization 적용 후 동일 조작의 `console.error`/`console.warn`은
  `0/0`이었다. Undo 두 번으로 `padding: 12px 24px`, `gap: 8px`,
  `102.109375 × 52px`가 복귀했고 복귀 후에도 경고가 없었다.

이는 실제 Builder의 단일 `Badge` component spot-check로서 Preview geometry와
경고 소거를 증명한다. generic non-grid flex multi-sibling의 내부 좌표와
terminal handoff는 아래 dedicated runner 결과로 보완한다.

## Builder live 결과 — 2026-08-24

사용자가 실행 중인 Builder URL을 `--project-url`로 열어 generic non-grid
multi-sibling fixture를 생성하고, 각 property를 독립 browser context에서
실행했다. `project.mode=existing`, tier `5`, repeat `1`이며 네 property 모두
아래 aggregate가 전부 `true`였다.

```text
width:   allSkiaSnapshotsAvailable=true  allCanvasChangedDuring=true
         allCanvasRestored=true allCenterHitsContainTarget=true
         allClippedHitWidthsMatchPreview=true allCommandCountsStable=true
         allDrawHitBoundsAtomic=true allUnaffectedIdentityStable=true
         allAffectedDrawHitGeometryAtomic=true allTerminalCanonicalHandoff=true
         allPreviewSiblingCaptured=true
height:  allSkiaSnapshotsAvailable=true  allCanvasChangedDuring=true
         allCanvasRestored=true allCenterHitsContainTarget=true
         allClippedHitWidthsMatchPreview=true allCommandCountsStable=true
         allDrawHitBoundsAtomic=true allUnaffectedIdentityStable=true
         allAffectedDrawHitGeometryAtomic=true allTerminalCanonicalHandoff=true
         allPreviewSiblingCaptured=true
padding: allSkiaSnapshotsAvailable=true  allCanvasChangedDuring=true
         allCanvasRestored=true allCenterHitsContainTarget=true
         allClippedHitWidthsMatchPreview=true allCommandCountsStable=true
         allDrawHitBoundsAtomic=true allUnaffectedIdentityStable=true
         allAffectedDrawHitGeometryAtomic=true allTerminalCanonicalHandoff=true
         allPreviewSiblingCaptured=true
gap:     allSkiaSnapshotsAvailable=true  allCanvasChangedDuring=true
         allCanvasRestored=true allCenterHitsContainTarget=true
         allClippedHitWidthsMatchPreview=true allCommandCountsStable=true
         allDrawHitBoundsAtomic=true allUnaffectedIdentityStable=true
         allAffectedDrawHitGeometryAtomic=true allTerminalCanonicalHandoff=true
         allPreviewSiblingCaptured=true
```

Evidence JSON:

- `/private/tmp/adr187-phase5-layout-width-final2.json`
- `/private/tmp/adr187-phase5-layout-height-final.json`
- `/private/tmp/adr187-phase5-layout-padding-final.json`
- `/private/tmp/adr187-phase5-layout-gap-final.json`

대표 성능 값은 raw publish p95 `0.10–0.20ms`, runtime apply p95
`0.45–1.56ms`, Skia render-frame p95 `1.02–1.18ms`이며, 네 run 모두 long task
`0`이다. `gap`은 기존 프로젝트에 색상이 없는 형제가 남아 Canvas hash가
고정되는 하니스 결함을 확인한 뒤, 별도 visible sibling을 fixture에 추가해
실제 픽셀 변경/복귀를 재검증했다. 기존 프로젝트 초기화 시 출력되는
`documents row 미존재` warning은 persist-back을 생략하는 harness 환경 신호이며,
네 aggregate의 product console error/pageerror 판정과 분리한다.

## 원인과 수정

고정 크기 flow container의 `padding`/`gap`은 used-size parent 승격 조건에
걸려 page/body root까지 promotion되면서 unrelated bounds identity가 바뀌었다.
`isContainerSpacingMutation`이 container spacing patch를 식별하고, source
container 자체를 targeted root로 유지하도록 `createPresentationLayoutPlan`을
수정했다. 회귀 테스트는 fixed-size flow container의 root가 `parent`에
고정되고 affected set이 `parent/target/sibling`으로 제한되는지 잠근다.

이전 blocker 기록:

```bash
node apps/builder/scripts/adr187-presentation-baseline.mjs \
  --base-url http://127.0.0.1:5173/composition \
  --duration-ms 250 --repeats 1 --tiers 5 \
  --fixture-profile flow-layout --lane layout \
  --layout-property padding \
  --out /private/tmp/adr187-phase5-layout-padding.json \
  --trace-dir /private/tmp/adr187-phase5-layout-padding-traces
```

격리 dashboard 경로는 `getByLabel('New project name')` timeout으로 사용할 수
없었으므로, 위의 기존 Builder 경로를 live evidence로 사용했다.

```bash
node apps/builder/scripts/adr187-presentation-baseline.mjs \
  --base-url http://localhost:5173/composition \
  --project-url http://localhost:5173/builder/36fb9ef0-94be-4389-a8ad-b7609985d188 \
  --duration-ms 250 --repeats 1 --tiers 5 \
  --fixture-profile flow-layout --lane layout \
  --layout-property padding \
  --out /private/tmp/adr187-phase5-layout-padding-existing.json \
  --trace-dir /private/tmp/adr187-phase5-layout-padding-existing-traces
```

초기 몇 회에는 Playwright Chrome이 `SIGABRT`로 재시작되는 환경 변동이 있었지만,
재시도 후 네 property의 live evidence가 모두 수집됐다.
