# ADR-189 Phase 4 / G4 — live parity and 120Hz gate

## 판정

**G4 통과 — Phase 4 Complete (2026-08-23)**

실제 Builder의 상단 `Compare Mode (Preview + Skia)` 토글로 CSS Preview iframe과
Skia Canvas를 동시에 열고, populated canonical document에서 paint·style/layout·
structure 편집을 각각 exercise했다. 현재 typed commit descriptor가 연결된
`fills.replace`는 증분 patch/damage 경로를 탔고, generic style/layout·structure
mutation은 의도된 full-rebuild 경로로 수렴했다. 두 경로 모두 DOM/Skia target
geometry와 최종 화면을 stale 상태로 남기지 않았다.

## 실행 환경과 fixture

- Chrome `151.0.7922.170`, viewport `1440 × 900`, dev server `localhost:5173`
- dashboard에서 새 프로젝트를 생성한 뒤 canonical document를 hydration
- active node `258`개: body + target frame + 256개 sibling frame
- top ToggleButtonGroup의 `Compare Mode (Preview + Skia)`를 활성화해 좌측 CSS
  Preview iframe과 우측 Canvas pane을 함께 표시
- console `error/warning = 0/0`

## 편집 유형별 live 결과

| 유형         | 실제 조작                              | command 경로                                                            | 결과                                                                                      |
| ------------ | -------------------------------------- | ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| paint        | `fills.replace` 색상 commit 8회        | `patchSuccess=1`, `patchFallback=0`, subtree visits `1`, full build `0` | 매회 committed, damage render/fallback `1/0`                                              |
| style/layout | `updateElementProps(style.left=220px)` | descriptor 없는 canonical mutation → full rebuild visits `314`          | target DOM/Skia 위치 일치, frame p95/p99 `2.2/2.2ms`                                      |
| structure    | sibling `addComplexElement` 1회        | descriptor 없는 canonical mutation → full rebuild visits `315`          | active node `258→259`, 기존 target 불변 확인. 추가 sibling 자체 oracle은 아래 G5에서 보강 |

style/layout·structure의 `patchSuccess=0`은 silent stale가 아니라 typed terminal
descriptor가 없는 generic mutation이므로 commit lane에 진입하지 않고 기존
full-rebuild 경로를 사용한 결과다. 이 범위는 G4에서 시각·안전 수렴을 확인하고,
향후 해당 descriptor emitter를 추가할 때 별도 phase로 재개할 수 있도록 남긴다.

## CSS Preview ↔ Skia cross-check

paint 8회와 후속 style/layout·structure 상태에서 target의 CSS Preview DOM
`[data-element-id="adr189-g4-target"]`와 Skia command debug를 비교했다.

- CSS DOM target rect: `left/top/width/height = 24/24/120/120` (paint),
  style commit 후 `220/24/120/120`
- Canvas pane의 화면 offset `x=470`을 정규화하면 Skia `hitBounds`는 각각
  `24/24/120/120`, `220/24/120/120`으로 일치
- Preview computed background color는 각 `fills.replace` 색상과 일치했다
  (`rgb(209,75,75)`, `rgb(75,209,107)` 등 8회)
- paint commit의 `presentationRevision`은 `3→10`, `baseCanonicalRevision`은
  `15→22`로 함께 증가했고, hit id와 command span이 같은 target을 계속 가리켰다
- G3에서 동일 fixture의 patch/full backing-buffer oracle은 `1440 × 852`,
  differing pixels `0`, max/mean channel delta `0`으로 이미 닫혔다

### G5 structure affected-output 보강 (2026-08-24)

Round 2는 위 structure exercise가 새 sibling이 아니라 기존 target만 다시 읽었다는
증적 결함을 지적했다. 별도 실제 Chrome 탭을 foreground한 상태에서 dashboard로
`codex-adr189-round2-*` 프로젝트를 만들고 Component panel의 `button`을 클릭해 body
아래 새 `Button` 노드를 추가했다. 이후 실제 Style UI에서 fixed `80 × 40`과
`#35B85AFF` fill을 commit하고 Compare Mode를 열었다.

- Layers: body 아래 `Button` 1개, 생성 직후 history `1/1`.
- Preview iframe: role `button`, text `Button`, visible count `1`, rect `80 × 40`,
  background `rgb(53, 184, 90)`, radius `6px`.
- Skia Canvas: 새 Button 자체에 selection outline과 `80 × 40` bounds badge가 표시되고,
  같은 `Button` text와 green fill이 렌더됐다. 이는 기존 target 유지가 아니라 새로
  추가한 노드의 draw와 hit-selection 결과를 직접 확인한 것이다.
- cold region clear 예열 보정 뒤 같은 실제 Chrome에서 paint commit 8회가
  `damageRender/fallback=8/0`, duration p50/p95 `0.4/0.5ms`, sparse command
  `11 × 8`로 관측됐다.

따라서 structure cross-check는 affected output인 신규 sibling 자체를 대상으로
Preview DOM과 Skia draw/hit를 1:1로 닫았다.

## 120Hz performance gate

paint commit 8회에서 수집한 `render.frame`의 요약은 다음과 같다.

| 지표                   |  측정값 |      기준 | 판정                    |
| ---------------------- | ------: | --------: | ----------------------- |
| p50                    | `0.9ms` |         — | PASS                    |
| p95                    | `1.3ms` |    `<4ms` | PASS                    |
| p99                    | `1.3ms` | `<8.33ms` | PASS                    |
| max                    | `1.3ms` |         — | commit-after spike 없음 |
| `violations50ms/100ms` |   `0/0` |       `0` | PASS                    |

style/layout과 structure의 full-rebuild exercise도 각각 p95/p99 `2.2/2.2ms`,
`1.7/1.7ms`로 이 populated fixture의 120Hz gate 안에 있었다.

## 검증 명령

- Builder live harness: `/private/tmp/adr189-phase4-g4-live.json`
- Phase 3 full-rebuild pixel oracle: [189-phase-3-g3-damage-clip.md](189-phase-3-g3-damage-clip.md)
- Builder-local targeted Vitest: sparse damage/patch/static guard 3 files / 39 tests PASS
- `pnpm run codex:preflight`: guard, format, type-check baseline, registration `14/14` PASS

## 잔존 범위

현재 production editor presentation runtime의 canonical commit adapter는
`fills.replace`를 typed terminal descriptor로 연결한다. style/layout·structure의
generic mutation은 full-rebuild fallback으로 안전하게 동작하지만 증분 patch를
주장하지 않는다. 해당 emitter를 추가하는 경우 새 descriptor별 dirty-root,
Preview/Skia parity, N-tier 120Hz gate를 다시 통과해야 한다.
