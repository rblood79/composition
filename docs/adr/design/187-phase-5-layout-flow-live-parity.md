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
│  └─ adr187-flow-sibling (in-flow; 100px × 60px)
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
경고 소거를 증명한다. generic non-grid flex multi-sibling fixture의 affected
`bounds`/`hitBounds`, 비영향 identity, terminal handoff 또는 Skia 내부 좌표를
증명하는 결과는 아니므로, 아래 runner blocker와 승격 조건은 유지한다.

## 현재 실행 blocker

2026-08-24 현재 이 세션에서 실행한 명령:

```bash
node apps/builder/scripts/adr187-presentation-baseline.mjs \
  --base-url http://127.0.0.1:5173/composition \
  --duration-ms 250 --repeats 1 --tiers 5 \
  --fixture-profile flow-layout --lane layout \
  --layout-property padding \
  --out /private/tmp/adr187-phase5-layout-padding.json \
  --trace-dir /private/tmp/adr187-phase5-layout-padding-traces
```

결과는 `dashboard form unavailable` timeout이며, Playwright가
`getByLabel('New project name')` 표시를 10초 동안 기다리다 실패했다.
기존 Builder URL을 재사용할 수 있도록 `--project-url` 경로를 추가하고, 다음
명령으로 동일 fixture를 시도했다.

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

이 시도는 dashboard 단계는 우회했지만 현재 세션의 Playwright Chrome 실행이
`browserType.launch: Target page, context or browser has been closed`와
`signal=SIGABRT`로 종료되어 Builder URL에 도달하지 못했다. 따라서 이번
라운드에도 populated Builder GREEN이나 Badge spot-check을 generic multi-sibling
parity로 승격하지 않는다. 실행 환경에서 Chrome/Builder dev server와
authenticated storage state를 제공하면 위 `--project-url` 명령을
`width`, `height`, `padding`, `gap` 각각 수행하고 결과 JSON의 aggregate를
승격 근거로 사용할 수 있다.
