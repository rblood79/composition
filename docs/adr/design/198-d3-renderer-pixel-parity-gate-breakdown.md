# ADR-198 Implementation Breakdown: D3 Renderer Pixel Parity Gate

## 1. Framing and Scope

### 1.1 Decision boundary

ADR-198 implements a deterministic comparison harness for the two existing D3
consumers:

1. Builder CanvasKit/Skia paint output.
2. Preview DOM/CSS paint output.

It does not choose a renderer, define new component styling, or introduce a new
visual SSOT. The only persistent source input is a canonical
`CompositionDocument` fixture plus a test environment manifest. Rendered images,
region maps, and metrics are disposable outputs.

This is a new infrastructure topic rather than a fork of ADR-921:

- ADR-198 answers: "Do the current D3 consumers produce equivalent results?"
- ADR-921 answers: "How could a renderer-neutral scene/backend contract be
  introduced while CanvasKit remains the oracle?"

ADR-198 can be implemented first and later test ADR-921 adapters. It must not
introduce `RenderSceneSnapshot`, a new backend, or any ADR-921 production seam.

### 1.2 Domain and ownership

| Domain               | ADR-198 effect                                                                                        |
| -------------------- | ----------------------------------------------------------------------------------------------------- |
| D1 DOM/accessibility | No authority change. Preview uses the existing runtime and remains responsible for DOM/ARIA behavior. |
| D2 Props/API         | No schema or public prop change. Fixtures use existing canonical nodes and catalog bindings.          |
| D3 visual style      | Adds automated symmetry verification across the equal Skia and DOM/CSS consumers.                     |

### 1.3 No-fork lock-in

1. **Base/application classification**: ADR-198 is a general verification
   capability; ADR-921 and component ADRs are consumers, not prerequisites.
2. **Schema orthogonality**: ADR-198 adds no persisted/runtime schema. Its test
   case and metrics schema are test-only and orthogonal to renderer contracts.
3. **Dependency reversal check**: current renderers are tested directly. No
   planned ADR-921 contract is treated as implemented.
4. **Early framing check**: scope is frozen before phases are split; any request
   to add a renderer, change catalog values, or repair discovered product defects
   returns to the user as a separate task.

### 1.4 Success definition

ADR-198 is successful only when a relevant source change can fail a required CI
check with reproducible evidence showing which existing consumer diverged. A
local script, a screenshot archive, or an advisory warning alone is not
build-time enforcement.

### 1.5 Risk-first review seed

- **Generator impact**: not applicable. This ADR changes no spec, catalog, or
  generated artifact. If implementation discovers a required generator change,
  the scope must return to Proposed review before code changes continue.
- **Backward compatibility**: affected stored documents are **0%** and required
  reserialization is **0 files** because all fixtures and manifests are
  test-only.
- **HIGH-risk phase split**: R1-R5 belong to one oracle-credibility boundary.
  Splitting identity, production-path, determinism, or sensitivity into a
  separately accepted partial tool would permit a misleading green result.
  Product renderer fixes discovered by the oracle remain separate work.
- **Estimate versus measurement**: no estimated result was used to create a
  forked architecture. Phase 0 must measure the current entry points,
  dependency ownership, and pilot timing before the implementation plan is
  accepted.

## 2. Current-State Evidence

### 2.1 Gap and reusable assets

| Area                      | Current evidence                                                                                          | Reusable asset                                                                 | Missing contract                                                                                                                                                                                                             |
| ------------------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D3 policy                 | `.claude/rules/ssot-hierarchy.md:112-116`                                                                 | Explicit Skia↔Preview parity requirement                                       | Build-time automation is recorded as incomplete                                                                                                                                                                              |
| Manual/live verification  | `.agents/skills/cross-check/SKILL.md:116-149,266-285`                                                     | Real Builder/Preview/Style Panel setup and visual inspection                   | No blocking machine pixel verdict; live step is skippable                                                                                                                                                                    |
| CanvasKit software output | `apps/builder/src/builder/workspace/canvas/skia/export.ts:40-114`                                         | `MakeSurface` → `SkiaRenderable.renderSkia` → PNG                              | No deterministic test host, resource manifest, or Preview pairing                                                                                                                                                            |
| CanvasKit initialization  | `apps/builder/src/builder/workspace/canvas/skia/initCanvasKit.ts:31-68`                                   | Pinned npm CanvasKit/WASM                                                      | Current initializer assumes `window` and Vite `BASE_URL`; Node test loading is not yet a supported seam                                                                                                                      |
| Browser parity            | `apps/builder/vitest.browser.config.ts:6-65`; `apps/builder/tests/parity/harness.ts`                      | Pinned headless Chromium and real DOM geometry                                 | Compares DOM with layout engine, not final Skia/Preview paint                                                                                                                                                                |
| Existing pixel oracle     | `apps/builder/scripts/adr190-pixel-oracle.mjs:1-64`                                                       | Settle/capture/metrics/artifact operating pattern                              | Compares Skia patch with Skia rebuild and is ADR-specific                                                                                                                                                                    |
| Diff dependencies         | `packages/specs/package.json:52-61`                                                                       | `pixelmatch@7.2.0`, `pngjs@7.0.0`                                              | No declared owner for a Builder visual parity harness; no imports found                                                                                                                                                      |
| Declared budget           | `apps/builder/src/builder/workspace/canvas/benchmarks/constitutional.ts:8-14`                             | `screenshotDiff_max: 0.001`                                                    | Not connected to a real two-consumer check                                                                                                                                                                                   |
| Preview consumer          | `apps/builder/src/preview/App.tsx`; `messaging/messageHandler.ts`; `components/CanonicalNodeRenderer.tsx` | Isolated Preview app, canonical postMessage ingestion, production DOM renderer | No deterministic fixture injection/readiness protocol for screenshots                                                                                                                                                        |
| Surface backend selection | `apps/builder/src/builder/workspace/canvas/skia/createSurface.ts:29-33`                                   | `MakeSurface` CPU path exists in `export.ts`                                   | Production `createGPUSurface` falls back WebGL→SW with only `console.warn`; no manifest records which backend painted; production rasterizes GL (`SkiaRenderer.ts:1126`) while the leg pins SW, and that delta is unmeasured |
| Wall-clock time sources   | `skia/transitionManager.ts:40,77`; `skia/animationEngine.ts:42`; `skia/types.ts:247,273`                  | `nodePictureCache.ts::setVolatileNodeIds` already isolates in-place mutation   | No injectable `now()`; a leg can read scheduling-dependent time during capture                                                                                                                                               |
| Degenerate-frame guard    | `adr190-pixel-oracle.mjs::captureCanvas` (`toDataURL` under `--disable-gpu`); `cross-check/SKILL.md` §5   | —                                                                              | No blank/black/single-color frame check; two failed legs compare equal                                                                                                                                                       |
| Diff metric shape         | `benchmarks/constitutional.ts::screenshotDiff_max`                                                        | ratio constant                                                                 | No `maxByte/meanByte/changedFraction`; no exact-byte rule for same-rasterizer runs                                                                                                                                           |

### 2.2 Existing gates that must not be misrepresented

- ADR-139 registration tests prove presence across registries, not rendered
  equality.
- `test:parity` proves layout engine versus real CSS geometry for authored test
  cases, not complete component paint parity.
- ADR-189/190 artifacts prove incremental and full Skia execution converge, not
  that DOM/CSS matches Skia.
- `/cross-check` remains required for exploratory, interactive, and unmodeled
  states even after ADR-198.

### 2.3 External pattern extracted from vgpu

Primary sources:

- [vgpu README](https://github.com/vercel-labs/vgpu/blob/main/README.md): one API
  across browser, Dawn-backed Node, and deterministic mock environments.
- [adapter-mock README](https://github.com/vercel-labs/vgpu/tree/main/packages/adapter-mock):
  use mock for command/resource tests and Node for real rendering/readback
  snapshots.
- [Playwright screenshot testing](https://playwright.dev/docs/test-snapshots):
  screenshot comparison requires a controlled environment because rendering
  varies by OS, browser, hardware, and settings.
- [pixelmatch](https://github.com/mapbox/pixelmatch): small pixel-level image
  comparison with explicit antialiasing and threshold controls.

The adopted lesson is test architecture only. Source packages, adapters, WGSL,
and WebGPU runtime code are not reused.

Seven verification disciplines extracted from the 2026-08-30 vgpu.sh review
(ADR-198 Context) and where this breakdown enforces each:

| #   | vgpu discipline                                                      | Enforced in                                      |
| --- | -------------------------------------------------------------------- | ------------------------------------------------ |
| 1   | Capture success ≠ render success; verify pixels, not existence       | §3.6 L-live layer, Phase 0 doctor, Phase 4 probe |
| 2   | Explicit backend (`software`/`hardware`), no silent fallback         | §3.4 step 1, environment manifest                |
| 3   | Deterministic clock (`advance(dt)`, manual tick wins)                | §3.4 step 3, Phase 0 task 7                      |
| 4   | Byte-level `maxByte/meanByte/changedFraction`, `maxByte ≤ 2` = noise | §3.6 L3 metrics, G2 `maxByte = 0`                |
| 5   | Settle by convergence, not fixed frame count                         | §3.5 step 3                                      |
| 6   | Doctor probe renders and verifies a known frame before the suite     | Phase 0 task 3, Phase 5 task 2                   |
| 7   | Stable failure codes as a self-correction map                        | §3.7 `code` field, Phase 4 task 5                |

## 3. Target Test Architecture

### 3.1 Data flow

```text
Canonical fixture + environment manifest
                |
                +------------------------------+
                |                              |
        production Skia path            production Preview path
        CanvasKit MakeSurface            preview.html + postMessage
                |                              |
        PNG + node/bounds manifest       PNG + DOM/bounds/style manifest
        + backend/clock/readiness         + readiness/convergence
                |                              |
                +--------------+---------------+
                               |
                 frame liveness gate (per leg)
                               |
                     normalization + identity gate
                               |
              geometry/style diff -> region pixel diff
                               |
        verdict + metrics + failure code + failure artifacts
```

Frame liveness, identity, and structural checks execute before pixel
comparison. If either leg is degenerate (painted node count 0, region variance
below the fixture floor), or the document checksum, node identity/order,
viewport, resources, backend, or environment differs, the case fails as a
harness error (`PARITY-LIVE`, `PARITY-L0-IDENTITY`, `PARITY-ENV`) rather than
reporting misleading pixel drift.

### 3.2 Proposed file ownership

The exact inventory is frozen in Phase 0. The default target is:

| Target                                                   | Responsibility                                                                                                            |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `apps/builder/tests/visual-parity/cases/`                | Immutable canonical fixtures and explicit region/budget metadata                                                          |
| `apps/builder/tests/visual-parity/harness/`              | Environment manifest, normalization, geometry/style/pixel comparison, artifacts                                           |
| `apps/builder/tests/visual-parity/skia/`                 | Test-only CanvasKit loader and adapter into the production Skia scene/render path                                         |
| `apps/builder/tests/visual-parity/preview/`              | Playwright driver for the real Preview app and canonical message/readiness contract                                       |
| `apps/builder/playwright.visual-parity.config.ts`        | Pinned viewport/DPR/locale/color/reduced-motion/test output configuration                                                 |
| `apps/builder/package.json`                              | `test:visual-parity` and optional smoke/full scripts                                                                      |
| `.github/workflows/visual-parity.yml`                    | `push: main` path-scoped smoke job that `deploy.yml` gates on via `needs:`, plus full post-push/scheduled matrix          |
| local pre-push gate (git hook or scoped `codex:` script) | Runs the same smoke matrix before `git push origin main`; the repository forbids PRs, so this is the first blocking point |
| `.agents/skills/cross-check/SKILL.md`                    | Route stable fixtures to the command; retain Chrome MCP live coverage guidance                                            |

If a new workflow is inconsistent with the repository's CI topology at
implementation time, Phase 5 may attach the same smoke job to `deploy.yml`
directly. The job name and pass/fail contract must remain stable. Because
`.claude/rules/git-workflow.md` forbids web PRs and `main` is pushed directly,
"required check" throughout this breakdown means **pre-push gate + `push: main`
job that deployment depends on**, never a PR status check.

### 3.3 Fixture contract

Each case owns one object with these conceptual fields:

```ts
interface VisualParityCase {
  id: string;
  document: CompositionDocument;
  pageId: string;
  viewport: { width: number; height: number; dpr: 1 };
  theme: "light" | "dark";
  regions: VisualParityRegion[];
  expectedNodeIds: string[];
}

interface VisualParityRegion {
  id: string;
  nodeIds: string[];
  kind: "geometry" | "non-text" | "text" | "raster";
  maxDiffRatio?: number;
  mask?: Rect[];
  reason?: string;
  owner?: string;
  reviewBy?: string;
}
```

The implementation may refine names, but the following invariants are fixed:

- no separate `skiaDocument` or `previewDocument` field;
- region membership derives from stable canonical node IDs, not screenshot
  coordinates alone;
- masks are finite rectangles tied to a region and cannot cover the whole frame;
- fixture checksum includes the document, environment, region policy, and
  resource hashes;
- dynamic IDs, current time, remote URLs, user auth, and persisted local project
  state are forbidden.

### 3.4 Skia leg

1. Initialize the exact pinned `canvaskit-wasm` package and repository WASM in a
   controlled test host. Record `surfaceBackend: "sw"` in the environment
   manifest; the leg fails (`PARITY-ENV`) if any path other than
   `ck.MakeSurface` painted, including the production WebGL→SW fallback in
   `createSurface.ts`. Because production Builder rasterizes GL
   (`SkiaRenderer.ts:1126` draws `contentNode.renderSkia` into the
   `MakeWebGLCanvasSurface` main surface), the SW↔GL delta measured in Phase 0
   is carried in the manifest and bounds what this gate may claim (R13).
2. Load repository fonts/images from bytes and wait for registration/decode.
3. Resolve the canonical fixture through the same layout/scene path used by
   Builder. Assert the transition/animation volatile set is empty for the case
   (or, if Phase 0 selected the clock seam, that the injected `now()` is the
   only time source read). Any `performance.now()`/`Date.now()` read on the
   capture path fails the case (`PARITY-ENV`).
4. Render the production `SkiaRenderable` into `ck.MakeSurface(width, height)`.
5. Flush, snapshot, encode PNG, and emit node bounds/order/resolved paint
   metrics plus painted node count.
6. Dispose image/surface and all case-owned resources in verified order.

`MakeSWCanvasSurface(HTMLCanvasElement)` is not the Node path and must not be
used as evidence of headless support. If the current scene pipeline cannot run
in Node without semantic duplication, Phase 0 selects a pinned Playwright host
that still invokes `MakeSurface` and the same production renderable. A bespoke
test renderer is not an allowed fallback.

The current browser-only `initCanvasKit()` must not be made conditional through
scattered `typeof window` branches. Any Node loader is isolated under test code
or extracted as a small environment-neutral initializer with behavior-equivalent
browser tests.

### 3.5 Preview leg

1. Start the real Builder Preview bundle (`preview.html`) in pinned Chromium.
2. Inject the exact canonical fixture through the production Preview message
   handler; direct construction of a simplified DOM tree is forbidden.
3. Wait for the Preview store document checksum, React commit, generated CSS,
   `document.fonts.ready`, and repository image decode; then capture by
   convergence — two consecutive artboard captures with identical normalized
   hash — under a bounded ceiling that fails as `PARITY-RESOURCE`. A fixed
   frame count is not accepted as the readiness proof.
4. Assert expected canonical node IDs and order in the rendered DOM.
5. Capture the exact artboard region and emit DOM bounds plus normalized
   computed-style fields needed by geometry/text checks.

Network interception fails the case on any non-local resource request. Focus,
hover, pressed, selected, disabled, dark mode, and responsive state cases must
be explicit fixtures rather than incidental browser state.

### 3.6 Normalization and comparisons

Normalization is deliberately narrow:

- crop both legs to the same logical artboard bounds;
- convert to the same sRGB RGBA8 representation;
- fix transparent background treatment;
- remove PNG metadata from the comparison hash;
- do not blur, resize, erode/dilate, or shift images to make a case pass.

Comparison layers execute in order:

| Layer              | Comparison                                               | Initial blocking rule                                                         |
| ------------------ | -------------------------------------------------------- | ----------------------------------------------------------------------------- |
| L-live liveness    | per leg: painted node count, per-region pixel variance   | count ≥1; variance ≥ fixture floor; else `PARITY-LIVE`                        |
| L0 identity        | document/environment/resource checksum and node order    | exact equality                                                                |
| L1 geometry        | per-node `x/y/width/height`, clip/artboard bounds        | each delta ≤1 CSS px                                                          |
| L2 resolved style  | region-relevant color, border, radius, typography inputs | exact normalized values unless ledgered                                       |
| L3 non-text pixels | `pixelmatch` on finite regions + byte metrics            | threshold 0.1, diff ratio ≤0.001; `maxByte/meanByte/changedFraction` recorded |
| L4 text/raster     | geometry/style plus ratcheted pixel metric               | explicit per-region budget; no inherited global mask                          |

L3's `0.001` ceiling begins from the existing constitutional constant but must
be proven by Phase 0/4 pilots. It may only be changed by revising the ADR before
Accepted; implementation cannot quietly raise it.

Same-rasterizer comparisons — the 10-run determinism check in G2 and any
Skia-versus-Skia oracle reused from ADR-189/190 — use `maxByte = 0` exact
equality, never the perceptual `pixelmatch` threshold. The byte metrics exist so
that a one-token color change in a low-contrast region cannot be absorbed by the
YIQ distance alone; the Phase 4 token-color probe must fail on `maxByte` as well
as on ratio.

### 3.7 Failure artifact contract

Each failing case writes under a run-scoped artifact directory:

- `skia.png`
- `preview.png`
- `diff.png`
- `metrics.json`
- `environment.json`
- `fixture-checksum.txt`

`metrics.json` identifies one closed-set failure `code` (`PARITY-ENV`,
`PARITY-LIVE`, `PARITY-L0-IDENTITY`, `PARITY-L1-GEOMETRY`, `PARITY-L2-STYLE`,
`PARITY-L3-PIXEL`, `PARITY-L4-TEXT`, `PARITY-RESOURCE`), layer, region, first
differing node/field, pixel count and ratio, `maxByte`/`meanByte`/
`changedFraction`, surface backend, settle convergence count, resource
readiness, console/page errors, and timings. The code is the key for the
exception ledger and for `/fix` routing. Passing runs may retain JSON summaries
but do not need PNG artifacts.

## 4. Implementation Phases

Implementation requires a separate user instruction. Creating this ADR does not
authorize any phase below.

### Phase 0 — Inventory, host feasibility, and pilot freeze

**Purpose**: prove both production consumers can reach comparable artifacts
before designing broad fixtures.

Tasks:

1. Freeze the current entry functions for canonical resolution, layout,
   `SkiaRenderable` construction, Preview messaging, font/image readiness, and
   generated CSS.
2. Confirm `exportToImage` lifecycle and identify whether it is currently used
   by production or only an available seam.
3. Run the doctor fixture (one frame node with one known semantic token fill)
   on both legs and assert the expected pixel value at a fixed coordinate plus
   a non-zero variance; then run a no-text
   `frame + nested box + border/radius/token fill` pilot through Node CanvasKit
   `MakeSurface`; if blocked, document the exact browser-only dependency and
   evaluate the Playwright offscreen host.
4. Send the same canonical document through the actual Preview app and capture
   the same artboard by convergence settle.
5. Inventory CI runner/browser/font availability and dependency ownership.
6. Record 10-run raw and normalized hashes (`maxByte = 0` across runs),
   runtime, settle convergence counts, and external requests.
7. Freeze the wall-clock inventory (`transitionManager.ts:40,77`,
   `animationEngine.ts:42`, `types.ts:247,273`) and decide between
   volatile-set-0 fixtures and one injected `now()` seam; record the surface
   backend actually used by each pilot.
8. Render one pilot fixture through both `ck.MakeSurface` (SW) and
   `ck.MakeWebGLCanvasSurface` on an offscreen canvas in the same pinned
   Chromium, and record `maxByte`/`meanByte`/`changedFraction` between them
   (R13). This is the cheapest reversal of the premise that a
   software-rasterized leg speaks for what users see; run it before any fixture
   matrix work. If the delta exceeds the L3 budget, narrow the ADR's claim to
   software rasterization and record which paint families (antialiasing,
   gradient dithering, blur/shadow, clip edges) carry the difference.

**Gate G0**: doctor fixture matches its expected pixel on both legs, two PNGs
from one checksum, production path evidence, backend and clock decisions
recorded, the SW↔GL delta measured and inside the L3 budget (or the claim
narrowed), and a frozen host decision. Failure keeps the ADR Proposed and blocks
later phases.

### Phase 1 — Fixture and result contracts

**Purpose**: make shared input identity testable before pixel comparison.

Tasks:

1. Add `VisualParityCase`, region policy, environment manifest, leg result, and
   diff result test-only types.
2. Add checksum canonicalization with stable object ordering.
3. Create three pilots:
   - `basic-geometry-paint`: no text/raster;
   - `catalog-state-paint`: token, border, radius, clip, disabled/selected state;
   - `text-raster-resources`: pinned font, icon/path, and local image.
4. Add negative fixture tests proving different document/theme/resource inputs
   fail L0 before pixel comparison.

**Gate G1 (identity half)**: both legs emit the same checksums and exact expected
node identity/order for all pilots.

### Phase 2 — Production Skia software leg

**Purpose**: produce deterministic software PNGs without a duplicate renderer.

Tasks:

1. Add the isolated test CanvasKit loader or the minimal environment-neutral
   initialization seam selected by G0.
2. Reuse canonical layout/scene construction and `SkiaRenderable`; add static
   tests preventing direct test drawing primitives outside harness plumbing.
3. Load pinned fonts/images and publish readiness plus resource hashes.
4. Emit PNG, geometry/order/style metrics, and lifecycle counters.
5. Add repeated-case disposal and leak assertions.

**Gate G1 (entry half) + G2 Skia**: production-path proof, 10 identical
normalized hashes, no external requests, and balanced resources.

### Phase 3 — Production Preview DOM/CSS leg

**Purpose**: capture the actual isolated Preview consumer from the same fixture.

Tasks:

1. Add Playwright configuration and a fixture driver for `preview.html`.
2. Use the canonical postMessage/message-handler contract; add a test-only
   readiness acknowledgement keyed by fixture checksum if the runtime lacks one.
3. Pin browser context and wait for CSS/font/image/React stability.
4. Emit artboard PNG, node bounds/order, normalized styles, resource hashes, and
   console/page/network errors.
5. Prove a direct/simplified DOM fixture cannot satisfy the entry assertion.

**Gate G1 (entry half) + G2 Preview**: same checksum/order, 10 identical hashes,
external requests 0, and console/page errors 0.

### Phase 4 — Layered diff, budgets, and sensitivity probes

**Purpose**: turn artifacts into a credible blocking verdict.

Tasks:

1. Implement L0-L4 comparisons and PNG artifacts using the existing
   `pixelmatch`/`pngjs` versions under a correctly declared workspace owner.
2. Calibrate pilot budgets without image smoothing or implicit pixel shifts.
3. Add mandatory mutations that simulate:
   - `1px` geometry offset;
   - one semantic token/color change (must fail on `maxByte`, not only ratio);
   - `1px` border width or radius change;
   - font size/line-height metric change;
   - blank both legs (empty document / hidden artboard) — must fail as
     `PARITY-LIVE`, never pass as parity;
   - Skia leg painted by a non-`sw` backend — must fail as `PARITY-ENV`.
4. Add exception-ledger schema and ratchet tests: missing owner/reason/review
   date, wildcard mask, stale exception, budget increase, and an unknown
   failure code all fail.
5. Verify actual/expected/diff images, metrics, and the failure code are
   sufficient to diagnose every negative probe; the code set is closed and
   documented next to the ledger schema.

**Gate G3/G4**: all positive pilots satisfy ADR thresholds, all six negative
probes fail the correct layer with the intended failure code, and resource
cycles remain balanced.

### Phase 5 — CI and developer workflow integration

**Purpose**: make the gate automatic rather than advisory.

Tasks:

1. Register `test:visual-parity`, `test:visual-parity:smoke`, and optionally
   `test:visual-parity:full` under the Builder workspace.
2. Add the smoke gate for D3-relevant paths (catalog/spec/generated CSS,
   Canvas/Skia/layout, Preview/shared renderer, fonts/images, harness) at two
   points: a local pre-push gate before `git push origin main`, and a
   `push: main` job that `deploy.yml` depends on via `needs:`. The gate runs
   the doctor fixture first; a doctor failure fails the gate (`PARITY-ENV`)
   and skips nothing. Do not introduce a PR-based check — the repository
   forbids web PRs.
3. Run the full matrix on `main` and/or a schedule.
4. Upload failure artifacts with bounded retention.
5. Update `/cross-check` so stable fixtures run the command before live review;
   preserve live Chrome MCP checks for states not represented in the matrix.
6. Measure local and CI wall time. Only add the smoke matrix to default
   `codex:preflight` if its measured cost is ≤30s; otherwise keep it as a scoped
   rendering gate plus required CI check.

**Gate G5**: required check cannot skip, smoke ≤90s, full ≤5min, and each seeded
failure produces complete artifacts.

### Phase 6 — Representative D3 matrix and closure

**Purpose**: demonstrate that the harness covers composition, not only the
pilot.

Minimum matrix:

| Family            | Required characteristics                                                           |
| ----------------- | ---------------------------------------------------------------------------------- |
| Geometry/layout   | nested flex/grid, padding/gap, clip/overflow, responsive size                      |
| Paint             | token colors, border/radius, gradient, opacity, shadow                             |
| Stateful controls | default, disabled, selected/checked, focus-visible where both consumers support it |
| Text              | fixed Pretendard weight/size/line-height, wrapping, alignment                      |
| Vector/raster     | Lucide/icon path and local PNG/JPEG/WebP                                           |
| Composite         | at least one collection, field, overlay/clip, and reusable/ref subtree             |
| Theme             | light and dark semantic token cases                                                |

Closure tasks:

1. Record represented catalog/component/state counts and explicit residuals.
2. Demonstrate one real historical D3 defect or equivalent seeded regression is
   detected by the matrix.
3. Confirm parity check, registration check, layout parity, and manual
   `/cross-check` have non-overlapping documented responsibilities.
4. Add ADR-921 reference to this oracle only when touching ADR-921 in its own
   approved scope; do not modify ADR-921 opportunistically during ADR-198.
5. Run focused tests, type-check, `git diff --check`, and
   `pnpm run codex:preflight`; run the dedicated visual gate in the pinned
   environment.

**Gate G6**: required matrix passes, residual ledger is explicit, no duplicate
oracle exists, and status may be considered for Implemented only after a real CI
run and live handoff evidence.

## 5. Verification Matrix

| Verification                  | Source of truth                               | Expected result                                               | Gate  |
| ----------------------------- | --------------------------------------------- | ------------------------------------------------------------- | ----- |
| Frame liveness                | per-leg painted count + region variance       | count ≥1, variance ≥ floor; doctor pixel matches              | G0/G2 |
| Surface backend               | environment manifest                          | Skia leg `surfaceBackend = "sw"`; fallback = fail             | G0/G2 |
| SW↔GL raster delta            | dual-backend pilot capture                    | inside L3 budget, or claim narrowed to software rasterization | G0    |
| Time source                   | volatile set / injected clock                 | wall-clock reads on capture path 0                            | G2    |
| Document/environment identity | Canonical fixture + manifest                  | exact checksum equality between legs                          | G1    |
| Node identity/order           | Canonical resolved tree                       | exact ID/order equality                                       | G1    |
| Geometry                      | Skia bounds + DOM `getBoundingClientRect`     | each `x/y/w/h` delta ≤1 CSS px                                | G3    |
| Resolved visual inputs        | catalog/spec/theme + normalized leg manifests | exact value equality outside ledger                           | G3    |
| Non-text pixels               | normalized RGBA regions                       | threshold 0.1, differing ratio ≤0.001                         | G3    |
| Text/raster pixels            | explicit region policy                        | structural match + ratcheted bounded metric                   | G3    |
| Sensitivity                   | four negative probes                          | all fail the intended layer                                   | G3    |
| Determinism                   | pinned environment                            | 10-run normalized hash equality per leg (`maxByte = 0`)       | G2    |
| Settle                        | convergence counter                           | two identical consecutive captures under bounded ceiling      | G2    |
| Failure code                  | `metrics.json.code`                           | one closed-set code per failure; unknown code = fail          | G5    |
| Resource lifecycle            | readiness/disposal counters                   | early capture 0, unbalanced resources 0, monotonic growth 0   | G4    |
| CI behavior                   | required workflow                             | setup failure = fail, smoke ≤90s, full ≤5min                  | G5    |
| Failure evidence              | artifact schema                               | both inputs + diff + metrics + checksums                      | G5    |
| Product behavior              | existing test suites and `/cross-check`       | no production/schema behavior change                          | G6    |

### 5.1 Acceptance evidence format

The implementation record must include:

- CanvasKit package/WASM checksum;
- Chromium/Playwright version and runner image;
- font/image checksums;
- fixture count by region/family;
- 10-run determinism result with `maxByte`;
- doctor fixture result, surface backend per leg, and the SW↔GL raster delta;
- positive and negative probe results (six probes) with failure codes;
- pre-push smoke, `push: main` smoke, and full-matrix wall time;
- artifact links from at least one deliberate failure;
- explicit residual families/states.

Passing unit tests without a pinned real-render CI run cannot satisfy G5/G6.

## 6. Risk-to-Gate Mapping

| Risk                               | Blocking gate(s) | Proof                                                                                 |
| ---------------------------------- | ---------------- | ------------------------------------------------------------------------------------- |
| R1 fixture split                   | G1               | identical fixture/environment checksum and node order                                 |
| R2 cross-engine false failures     | G2, G3           | 10-run determinism + layered calibrated budgets                                       |
| R3 test-only renderer drift        | G1               | production entry assertions and negative direct-path test                             |
| R4 environment drift               | G2, G5           | pinned manifest, zero network, setup failure cannot skip                              |
| R5 masks/budgets hide regressions  | G3, G6           | ledger ratchet and four sensitivity probes across representative matrix               |
| R6 async resources/leaks           | G4               | readiness barriers and balanced lifecycle counters                                    |
| R7 CI cost                         | G5               | measured smoke/full ceilings and path scoping                                         |
| R8 shared wrong value              | G6               | explicit division from catalog/spec semantic and layout tests                         |
| R9 workspace dependency ownership  | G0, G4           | direct dependency declaration and one lockfile version                                |
| R10 ADR-921 stale coupling         | G6               | canonical fixture/output contract remains adapter-neutral; no duplicate oracle        |
| R11 degenerate-frame false pass    | G0, G2, G3       | doctor fixture, L-live layer, backend assertion, blank-both-legs probe                |
| R12 wall-clock / fixed settle      | G0, G2           | time-source inventory, volatile-0 or clock seam, convergence settle                   |
| R13 SW leg vs GL production raster | G0               | Phase 0 dual-backend delta measured, manifest-recorded, claim narrowed if over budget |

All HIGH risks R1-R5, R11, and R13 have at least one blocking gate. No HIGH risk may be moved
to a residual ledger merely to promote the ADR status.

## 7. Out of Scope

- Adding `vgpu`, Dawn, WebGPU, WGSL, or another renderer dependency.
- Replacing CanvasKit, porting SkSL shaders, or implementing ADR-921.
- Changing canonical document, catalog/spec values, Preview/Publish semantics,
  or component public APIs.
- Fixing product parity defects discovered during harness construction without
  separate user authorization and regression scope.
- Exact whole-frame equality across Skia and Chromium.
- Interaction/accessibility correctness beyond the visual state explicitly
  captured; existing D1 tests and live `/cross-check` remain responsible.
- Cross-browser parity in v1. Chromium is the pinned CI oracle; Safari/Firefox
  may be added only after the two-consumer Chromium gate is stable.
- Permanent storage of passing PNGs as product assets or a visual SSOT.
