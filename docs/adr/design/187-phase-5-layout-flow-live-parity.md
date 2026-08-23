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
따라서 이번 라운드에는 populated Builder GREEN 증거를 주장하지 않는다.
실행 환경에서 Builder dashboard/dev server와 authenticated storage state를
제공한 뒤 위 명령을 `width`, `height`, `padding`, `gap` 각각 수행하면 된다.
