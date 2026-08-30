# ADR-198: D3 Renderer Pixel Parity Gate

## Status

Proposed — 2026-08-30

> Source: user-requested architecture decision after evaluating
> [vgpu](https://github.com/vercel-labs/vgpu). This is a new verification
> infrastructure topic, not a fork of ADR-921. ADR-921 may consume this gate,
> but ADR-198 does not require a renderer-backend migration.

## Context

Composition defines Builder Skia and Preview DOM/CSS as equal consumers of the
D3 visual-style domain. Neither renderer is the source of truth; both must
derive equivalent visual output from the same catalog/spec and canonical
document inputs. The current rule explicitly records the missing enforcement:
`.claude/rules/ssot-hierarchy.md:112-116` says runtime `/cross-check` exists but
build-time visual symmetry automation is incomplete.

The current `/cross-check` workflow is valuable but not a CI oracle. It combines
static five-layer inspection, programmatic state/DOM inspection, and a final
Chrome MCP screenshot comparison. Its visual step remains human-reviewed and
may be skipped when a dev server or connected browser is unavailable
(`.agents/skills/cross-check/SKILL.md:116-149,266-285`). This leaves a failure
mode where catalog, generated CSS, Skia projection, or Preview rendering changes
can pass unit/type/registration gates while producing different pixels.

The repository already contains most of the required primitives, but they are
fragmented:

- `apps/builder/src/builder/workspace/canvas/skia/export.ts:40-114` renders a
  `SkiaRenderable` to an offscreen CanvasKit `MakeSurface` and encodes PNG.
- `apps/builder/vitest.browser.config.ts:6-65` and
  `apps/builder/tests/parity/harness.ts` compare real Chromium layout with the
  layout engine, but do not compare Skia pixels with Preview pixels.
- `apps/builder/scripts/adr190-pixel-oracle.mjs:1-64` captures and compares Skia
  output, but only checks patch execution against full rebuild execution.
- `packages/specs/package.json:52-61` already declares `pixelmatch` and `pngjs`,
  while no general D3 pixel-parity harness consumes them.
- `apps/builder/src/builder/workspace/canvas/benchmarks/constitutional.ts:8-14`
  declares `screenshotDiff_max: 0.001`, but it is not connected to a
  Skia-versus-Preview gate.

The vgpu evaluation provides a useful operating pattern, not reusable renderer
code. Its deterministic mock adapter is for command/resource tests; its own
documentation directs real render/readback snapshots to the Dawn-backed Node
adapter. The transferable pattern is therefore **controlled real rendering →
pixel readback → deterministic artifacts → automated budget**, not
`vgpu/mock` itself. Composition can implement that pattern with its existing
CanvasKit software surface and Playwright Preview runtime, with zero vgpu
dependency.

The 2026-08-30 vgpu.sh documentation review (`get-started/node`,
`guides/browser-testing`, `guides/shader-debugging`, `guides/measuring`,
`guides/agent-browser-webgpu`, `reference/render/perf`, `guides/external-ticker`)
adds seven verification disciplines that the repository does not yet enforce.
Each is recorded here with its composition evidence so the gates below can
require it:

1. **Capture success is not render success.** vgpu's `agent-browser doctor`
   rejects a screenshot whose pixel standard deviation is zero because "the
   screenshot can succeed even when WebGPU failed and the image is black".
   `apps/builder/scripts/adr190-pixel-oracle.mjs` reads the WebGL canvas via
   `toDataURL` under `--disable-gpu`; two blank legs would match exactly and
   pass. `/cross-check` has no blank-frame check either.
2. **Explicit backend selection.** vgpu requires `init({ adapter: "software" })`
   for deterministic CI and `"hardware"` when a GPU is mandatory; it never
   falls back silently. `createSurface.ts::createGPUSurface` falls back from
   WebGL to `MakeSWCanvasSurface` with only a `console.warn`.
3. **Deterministic clock.** vgpu's `clock(gpu).advance(dt)` makes "frame 90
   always land on t = 1.5s". `transitionManager.ts:40,77` and
   `animationEngine.ts:42` read `performance.now()` directly and no injection
   seam exists.
4. **Byte-level diff metrics.** vgpu `pixelDiff` reports
   `maxByte/meanByte/changedFraction` and treats `maxByte ≤ 2` as driver
   rounding noise (the `2/255` quantization floor). Composition declares only
   `screenshotDiff_max: 0.001` with no consumer; a perceptual `pixelmatch`
   threshold alone can absorb a one-token color change in low-contrast
   regions.
5. **Settle by convergence, not by frame count.** vgpu documents "two
   `requestAnimationFrame` calls and about six seconds for heavy previews";
   `adr190-pixel-oracle.mjs::settle(6)` waits a fixed frame count, which cannot
   observe late font/image decode.
6. **Environment doctor before the matrix.** vgpu's two-stage probe renders a
   known frame and verifies its pixels before any test runs; composition's
   `prepare-wasm.mjs` and `codex:preflight` only check file presence.
7. **Stable failure codes as a self-correction map.** vgpu emits
   `VGPU-R1-OWNERSHIP-FLIP`/`VGPU-R3-BUNDLE-STALE` style codes and publishes
   `shader-fix-its` keyed on them; composition hooks and oracles emit prose.

vgpu's performance model (record-once bundles, ping-pong targets, in-place
`set()`, GPU timestamp timing, miss-reason diagnostics) is already implemented
by `nodePictureCache.ts`, the dual-surface snapshot path, `gpuTimer.ts`, and
`cacheMetrics.ts::missReasons` (ADR-153/174) and is out of scope here.

### 3-domain classification

This decision is D3 verification infrastructure. It observes D3 outputs from
Builder Skia and Preview DOM/CSS without changing D1 DOM/accessibility authority
or D2 Props/API authority. The canonical document and catalog/spec remain the
input authorities; PNG files and diff metrics are disposable test artifacts,
never a new SSOT.

### Relationship to existing decisions

- ADR-139 blocks missing component registrations at build time; it does not
  compare rendered output.
- ADR-156 compares CSS layout geometry with the composition engine; it does not
  execute the full Skia and Preview paint paths.
- ADR-189/190 pixel oracles compare two Skia execution paths, not Skia against
  DOM/CSS.
- ADR-921 defines CanvasKit as a future backend-migration oracle. ADR-198
  supplies a reusable D3 parity gate independently of whether ADR-921 proceeds.

### Hard Constraints

1. **No renderer adoption** — `vgpu`, Dawn, WebGPU wrappers, and any replacement
   renderer remain dependency count **0**. Production runtime bundle delta is
   **0 bytes**.
2. **One fixture authority** — each comparison starts from one immutable
   `CompositionDocument` fixture and one environment manifest. Separate
   hand-authored Skia and DOM scenes are forbidden. Both legs must report the
   same fixture checksum.
3. **Production consumer paths** — the Skia leg must execute the production
   scene/render path into CanvasKit `MakeSurface`; the DOM leg must execute the
   real Preview canonical-document/message path and generated CSS. Test-only
   drawing or simplified Preview replicas are forbidden.
4. **Controlled environment** — CanvasKit/WASM hash, Chromium major, repository
   font/image bytes, viewport, DPR, theme, locale, color scheme, reduced motion,
   and time are pinned. External network resources are **0**. The environment
   manifest records the Skia surface backend; the Skia leg must report
   `surfaceBackend: "sw"` (`MakeSurface`), and any other backend or a silent
   WebGL→SW fallback fails the case instead of producing pixels. Production
   Builder rasterizes through `MakeWebGLCanvasSurface`
   (`createSurface.ts::createGPUSurface`), so pinning the leg to the software
   backend makes SW≈GL raster equivalence a **premise this gate must measure,
   not assume**: Phase 0 renders one pilot fixture through both backends in the
   pinned environment and records the `maxByte`/`changedFraction` delta. If that
   delta exceeds the L3 budget, the gate's claim is narrowed to
   "software-rasterized Skia versus Preview" in this ADR and in `/cross-check`
   before any budget becomes blocking; it may not be described as
   Builder↔Preview parity.
5. **Determinism** — each pilot leg must produce the same normalized RGBA hash
   across **10 consecutive runs** in the pinned environment before visual
   budgets can become blocking. No leg may read wall-clock time during
   capture: fixtures must leave the transition/animation volatile set at **0**
   (asserted per case), or Phase 0 selects one injected `now()` seam for
   `transitionManager.ts`/`animationEngine.ts`; scattered `performance.now()`
   guards are forbidden.
6. **Layered comparison** — matching node geometry must differ by at most
   **1 CSS px**. Normalized non-text regions use `pixelmatch` threshold `0.1`
   and differing-pixel ratio `≤ 0.001`. Text/raster regions require explicit
   structural metrics and fixture-specific ratcheting; a whole-frame tolerance
   may not hide them. Every pixel comparison also reports byte-level
   `maxByte`, `meanByte`, and `changedFraction`; same-rasterizer comparisons
   (G2 determinism runs and any Skia-versus-Skia oracle) require `maxByte = 0`
   rather than a perceptual threshold. A differing-pixel ratio may **never be
   the sole blocking metric**: Phase 0 measured a blur/shadow fixture where
   19.6% of frame bytes differ between two Skia rasterizers while the largest
   channel delta is `3/255`, and an antialiased round-rect where 1.2% differ at
   up to `59/255` — ratio alone would rank the imperceptible case as the worse
   regression. Every region budget therefore declares **both** a
   `maxDiffRatio` and a `maxByte` ceiling, and a region fails only when both
   are exceeded.
7. **Oracle sensitivity** — six negative probes must each fail the intended
   layer with the intended failure code: a `1px` geometry shift, a one-token
   color change (failing on `maxByte`, not ratio alone), a `1px` border/radius
   change, a font metric change, both legs blank (`PARITY-LIVE`), and a Skia leg
   painted by a non-`sw` backend (`PARITY-ENV`).
8. **No silent exemptions** — every mask or exception records fixture, region,
   reason, owner, measured budget, and review date. New fixtures cannot inherit
   a wildcard mask or increase a budget automatically.
9. **Actionable failure output** — every failure emits Skia PNG, Preview PNG,
   diff PNG, normalized metrics JSON, fixture/environment checksums, the
   first failing region, and one stable failure code from a closed set
   (`PARITY-ENV`, `PARITY-LIVE`, `PARITY-L0-IDENTITY`, `PARITY-L1-GEOMETRY`,
   `PARITY-L2-STYLE`, `PARITY-L3-PIXEL`, `PARITY-L4-TEXT`, `PARITY-RESOURCE`).
   Codes key the exception ledger and `/fix` routing. CI setup/determinism
   failures are failures, not skips.
10. **Bounded CI cost** — the required push smoke matrix completes in **≤90s**
    and the full matrix in **≤5min** on the pinned CI runner. If either limit
    is exceeded, scope is reduced before the check becomes required.
    "Required" is defined by this repository's git policy
    (`.claude/rules/git-workflow.md`: web PRs are forbidden, `main` is pushed
    directly, and `.github/workflows/deploy.yml` deploys on `push: main`): the
    smoke matrix must (a) run as a local pre-push gate before
    `git push origin main` and (b) run in a `push: main` workflow that the
    deploy job depends on (`needs:`), so a failing smoke blocks deployment and
    is reported on the commit. A PR status check is not the enforcement
    mechanism here and must not be the only one.
11. **Frame liveness precedes parity** — before identity or pixel comparison,
    each leg must prove a non-degenerate frame: expected painted node count
    **≥1**, and every non-masked region's pixel variance above the fixture's
    declared floor. Two blank, black, or single-color legs are a harness error
    (`PARITY-LIVE`), never a parity pass. A doctor fixture (one node, one known
    token color) must render on both legs and match its expected pixel value
    before the matrix runs.

### Soft Constraints

- Prefer a Node-hosted CanvasKit `MakeSurface` leg. If Phase 0 proves current
  scene construction cannot run headlessly without duplicating production
  semantics, use a pinned Playwright host with offscreen `MakeSurface` while
  preserving all hard constraints.
- Preserve `/cross-check` for exploratory states, interaction behavior, and
  visual judgment that a fixed fixture matrix cannot encode.
- Reuse the existing Playwright, `pixelmatch`, and `pngjs` versions. If package
  ownership changes, declare them in the harness owner without adding a second
  version to the lockfile.
- Keep the push smoke matrix small; run the broader component/state matrix
  post-push on `main` or a scheduled workflow, never as a pre-push blocker.
- Settle each leg by convergence — capture when two consecutive normalized
  hashes are identical after readiness barriers — with a bounded ceiling that
  fails as `PARITY-RESOURCE`; do not encode a fixed frame count as the
  readiness proof.
- Prefer fixtures with transition/animation volatile set 0 over a clock seam;
  add the seam only if Phase 0 proves a required family cannot be captured
  without it.

## Alternatives Considered

### Alternative A: Keep runtime `/cross-check` as the only visual parity gate

- Description: continue static inspection, Chrome MCP setup, programmatic DOM
  checks, and human screenshot review without a blocking pixel comparison.
- Evidence: this is the current workflow and has found real D3 defects, but the
  repository rule still records build-time automation as incomplete.
- Risks:
  - Technical: **MEDIUM** — visual coverage depends on environment and operator.
  - Performance: **LOW** — no added CI cost.
  - Maintainability: **HIGH** — repeated manual setup/evidence and inconsistent
    fixture coverage.
  - Migration: **LOW** — no code or workflow change.

### Alternative B: Require strict whole-frame pixel equality

- Description: render CanvasKit and Preview once and fail on any differing
  pixel, with one global threshold and no semantic/region classification.
- Evidence: exact pixel snapshots are simple to explain and are appropriate
  when the same rasterizer executes both legs; Skia and Chromium are different
  rasterizers with different antialiasing, font hinting, and sub-pixel behavior.
- Risks:
  - Technical: **HIGH** — expected cross-engine raster differences become false
    regressions.
  - Performance: **MEDIUM** — full-frame decode/diff for every case.
  - Maintainability: **HIGH** — frequent broad rebaselines train maintainers to
    accept real regressions.
  - Migration: **MEDIUM** — existing fixtures need unstable golden images.

### Alternative C: Layered deterministic parity harness over existing renderers

- Description: feed one canonical fixture to production Skia and Preview paths,
  normalize both outputs, compare structure/geometry first and pixels second,
  and enforce explicit per-region budgets with negative sensitivity probes.
- Evidence: combines the repository's `MakeSurface` export path, Playwright
  parity harness, ADR-190 artifact pattern, existing `pixelmatch`/`pngjs`, and
  vgpu's controlled real-render/readback discipline without adopting vgpu.
- Risks:
  - Technical: **MEDIUM** — deterministic resource loading and region mapping
    require a new test harness.
  - Performance: **MEDIUM** — two real render legs and PNG diff add CI time,
    bounded by separate smoke/full matrices.
  - Maintainability: **MEDIUM** — fixture/exception ledgers require ownership,
    but fail locally and produce actionable artifacts.
  - Migration: **LOW** — additive test infrastructure; production behavior and
    stored documents remain unchanged.

### Alternative D: Adopt vgpu/Dawn or another GPU test stack

- Description: port or wrap rendering through vgpu so its Node adapter can
  produce test snapshots, while Preview remains DOM/CSS.
- Evidence: vgpu supports real Node/Dawn readback and deterministic API tests,
  but its mock adapter explicitly is not the real-render snapshot oracle and
  vgpu does not implement composition's 2D CanvasKit semantics.
- Risks:
  - Technical: **HIGH** — requires a second renderer or translation layer.
  - Performance: **MEDIUM** — Dawn binaries and shader pipelines expand CI
    setup.
  - Maintainability: **HIGH** — duplicates SkSL/WGSL and render semantics for a
    test-only purpose.
  - Migration: **HIGH** — broad renderer/test rewrite with no product value.

### Risk Threshold Check

| Alternative | Technical | Performance | Maintainability | Migration | HIGH+ count |
| ----------- | :-------: | :---------: | :-------------: | :-------: | :---------: |
| A           |     M     |      L      |        H        |     L     |      1      |
| B           |     H     |      M      |        H        |     M     |      2      |
| C           |     M     |      M      |        M        |     L     |      0      |
| D           |     H     |      M      |        H        |     H     |      3      |

Loop result: Alternative C has no HIGH risk and addresses the automation gap
without a renderer migration. Alternative D is the fundamentally different
approach considered for external GPU tooling; no alternative has a CRITICAL
risk, so another loop is not required.

## Decision

Select **Alternative C: layered deterministic parity harness over existing
renderers**.

Risk acceptance rationale:

1. The new complexity is confined to test infrastructure and uses renderers
   already required by the product. No second render semantics or production
   dependency is introduced.
2. Structural/geometry comparison prevents antialiasing tolerance from hiding
   layout drift, while pixel comparison catches color, border, clipping, mask,
   shadow, and paint-order differences that structure alone misses.
3. Determinism is proven before budgets become blocking. A flaky renderer or
   resource path cannot be normalized into an accepted baseline.
4. Dynamic two-leg comparison avoids checked-in whole-screen golden images as
   the primary authority. Stored PNGs are failure evidence, not a visual SSOT.
5. The gate complements rather than replaces `/cross-check`: automation covers
   stable representative fixtures; humans continue to assess novel visual and
   interaction states.
6. Frame liveness, explicit backend, and byte-level metrics are checked before
   any tolerance applies, so a degenerate or silently downgraded render cannot
   register as a perfect match (vgpu discipline 1/2/4).

Rejection rationale:

- **Alternative A rejected**: it preserves the exact gap documented by
  `ssot-hierarchy.md` and cannot block regressions in unattended CI.
- **Alternative B rejected**: a global exact-pixel rule is not credible across
  Skia and Chromium and would create rebaseline fatigue.
- **Alternative D rejected**: vgpu/Dawn would introduce a test-only renderer
  migration while composition already has a software CanvasKit path capable of
  PNG output.

> Implementation breakdown: [198-d3-renderer-pixel-parity-gate-breakdown.md](design/198-d3-renderer-pixel-parity-gate-breakdown.md)

## Risks

| ID  | Risk                                                                                                                                                                                                                                                                                                                                                                       |                  Severity                  | Mitigation                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----------------------------------------: | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | The Skia and Preview legs silently consume different fixture transforms, theme inputs, or resolved documents. Code boundaries include `skiaFramePipeline.ts`, Preview `messageHandler.ts`, and `CanonicalNodeRenderer.tsx`.                                                                                                                                                |                  **HIGH**                  | Immutable fixture checksum and resolved-node identity manifest emitted by both legs; G1 requires exact identity before pixel comparison.                                                                                                                                                                                                                                                                                                                                                                                                      |
| R2  | Cross-engine antialiasing/font hinting creates persistent false failures. Boundaries include `export.ts::exportToImage`, Preview `App.tsx`, and `fontManager.ts::skiaFontManager`.                                                                                                                                                                                         |                  **HIGH**                  | Layered geometry/style/pixel checks, pinned resources, explicit text/raster regions, 10-run determinism, and G2/G3 calibration.                                                                                                                                                                                                                                                                                                                                                                                                               |
| R3  | A test-only Skia draw path or simplified React renderer passes while production diverges. Boundaries include `export.ts`, `skiaFramePipeline.ts`, Preview `App.tsx`, and the canonical postMessage path.                                                                                                                                                                   |                  **HIGH**                  | Static import/entry assertions plus deliberate production-path negative probes; G1 blocks bespoke renderers.                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| R4  | Chromium, CanvasKit, font, image, DPR, time, or color-profile drift makes CI nondeterministic. Current boundaries include `initCanvasKit.ts::initCanvasKit`, Preview `index.tsx::injectCustomFonts`, and `vitest.browser.config.ts::browser`.                                                                                                                              |                  **HIGH**                  | Environment manifest + hashes, no network resources, readiness barriers, and G2 repeatability gate.                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| R5  | Masks or generous fixture budgets hide real regressions. Current comparison inputs include `cross-check/SKILL.md::Phase 5.4`, `constitutional.ts::INVARIANTS`, and `adr190-pixel-oracle.mjs::diff`.                                                                                                                                                                        |                  **HIGH**                  | Typed exception ledger, bounded regions, no wildcard masks, four mandatory negative probes, and review/expiry ratchet in G3.                                                                                                                                                                                                                                                                                                                                                                                                                  |
| R6  | Fonts/images are captured before load/decode or CanvasKit resources leak between cases.                                                                                                                                                                                                                                                                                    |                   MEDIUM                   | Explicit font/image readiness, surface/image disposal assertions, isolated case lifecycle, and G4.                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| R7  | Two real render legs make the pre-push gate or `push: main` workflow too slow or artifact-heavy, so developers bypass the local gate or deploy waits on it.                                                                                                                                                                                                                |                   MEDIUM                   | Smoke/full split, path-scoped CI, ≤90s/≤5min budgets, artifacts only on failure, and G5.                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| R8  | Both renderers can share the same wrong canonical value, so parity passes despite a product regression.                                                                                                                                                                                                                                                                    |                   MEDIUM                   | Keep catalog/spec semantic tests and CSS/layout contract tests; ADR-198 asserts consumer symmetry, not design correctness.                                                                                                                                                                                                                                                                                                                                                                                                                    |
| R9  | `pixelmatch`/`pngjs` are imported from the wrong workspace and pass only through hoisting.                                                                                                                                                                                                                                                                                 |                    LOW                     | Declare test dependencies in the owning package or centralize the harness; lockfile version count must not increase.                                                                                                                                                                                                                                                                                                                                                                                                                          |
| R10 | ADR-921 later introduces a renderer-neutral snapshot and leaves this harness coupled to stale current inputs.                                                                                                                                                                                                                                                              |                   MEDIUM                   | Fixtures remain canonical; renderer adapters are replaceable. ADR-921 must reuse the same output/metrics contract rather than create a second parity oracle.                                                                                                                                                                                                                                                                                                                                                                                  |
| R11 | Both legs produce a degenerate frame (blank canvas, black WebGL capture, failed WASM/CSS load) and the comparison reports a perfect match. Boundaries include `createSurface.ts::createGPUSurface` silent SW fallback, `adr190-pixel-oracle.mjs::captureCanvas`, and `export.ts::exportToImage` (0 production callers, so a broken seam yields an empty surface silently). |                  **HIGH**                  | Frame liveness layer before L0 (painted node count ≥1, per-region variance floor), doctor fixture with expected pixel value, backend assertion in the environment manifest, and G0/G2.                                                                                                                                                                                                                                                                                                                                                        |
| R12 | Wall-clock time sources (`transitionManager.ts`, `animationEngine.ts`) or fixed-frame settle make captures depend on scheduling, so 10-run hashes disagree or late font/image decode is captured early.                                                                                                                                                                    |                   MEDIUM                   | Per-case volatile-set-0 assertion or one injected clock seam, convergence-based settle with bounded ceiling, and G2.                                                                                                                                                                                                                                                                                                                                                                                                                          |
| R13 | The gate rasterizes with `MakeSurface` (software) for determinism while users see `MakeWebGLCanvasSurface` (Ganesh/GL) output. Boundaries: `createSurface.ts:29-33::createGPUSurface`, `SkiaRenderer.ts:1126` (`contentNode.renderSkia` into the GL main surface), `export.ts:70::exportToImage` (`ck.MakeSurface`).                                                       | MEDIUM (measured down from HIGH — Phase 0) | **Measured 2026-08-31** in pinned Chromium (`tests/visual-parity/skia/rasterDelta.browser.test.ts`): solid fill and linear gradient are **byte-identical** (`maxByte 0`); antialiased round-rect and clip edges differ only in the edge band (`changedFraction` 0.0125 / 0.0136, interior `maxByte 0`); blur/shadow differs broadly but only by `maxByte 3`. So SW stands in for GL everywhere except edge bands and sub-LSB blur rounding. Mitigation is the HC6 amplitude clause plus an explicit `edge` region kind, not a narrowed claim. |

The selected alternative has HIGH operational risks R1-R5 and R11 (R13 was
measured down to MEDIUM in Phase 0). Each has a blocking Gate below; none may
be accepted as a permanent flaky baseline.

## Gates

| Gate | Timing                             | Pass condition                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Failure path                                                                                       |
| ---- | ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| G0   | Phase 0 inventory                  | Current Skia scene entry, Preview canonical message entry, font/image readiness, wall-clock time sources, surface backend selection, package ownership, and existing oracle overlap are frozen with file/function evidence. The doctor fixture and a no-text pilot reach PNG on both legs with the expected pixel value and without production behavior changes, and the SW↔GL raster delta is measured per paint family with the amplitude ceiling recorded (R11/R12/R13). | Keep ADR Proposed; revise host/seam before implementation.                                         |
| G1   | Fixture and entry contract         | Both legs emit the same document/environment checksum and resolved node identity/order. Static/runtime assertions prove use of `skiaFramePipeline`/`SkiaRenderable` and Preview canonical message/`CanonicalNodeRenderer`; bespoke drawing/DOM replicas are 0. (R1/R3)                                                                                                                                                                                                      | Delete the duplicate test path and reconnect to production consumers.                              |
| G2   | Determinism                        | Each pilot leg passes frame liveness, reports `surfaceBackend: "sw"` for Skia, and produces one normalized RGBA hash (`maxByte = 0` across runs) across 10 consecutive runs in the pinned environment; external requests 0; fonts/images ready by convergence settle; volatile set 0 or injected clock; wall-clock reads 0. (R2/R4/R11/R12)                                                                                                                                 | Gate remains non-blocking; fix environment/resource lifecycle, do not raise tolerances.            |
| G3   | Sensitivity and budget calibration | Geometry delta ≤1 CSS px; non-text diff ratio ≤0.001 at threshold 0.1 with `maxByte/meanByte/changedFraction` recorded; text/raster regions have explicit metrics/budgets; all six negative probes (1px geometry, token color on `maxByte`, border/radius, font metric, blank-both-legs, non-`sw` backend) fail the intended layer with the intended failure code. No wildcard mask or automatic budget increase. (R2/R5/R11)                                               | Split comparison layers or reduce fixture scope; do not accept a flaky/global threshold.           |
| G4   | Resource lifecycle                 | Repeated cases wait for font/image readiness, leave CanvasKit surface/image ownership balanced, produce no monotonic WASM/JS heap growth beyond measurement noise, and have console/page errors 0. (R6)                                                                                                                                                                                                                                                                     | Isolate resource setup/teardown before adding fixtures.                                            |
| G5   | CI integration                     | `test:visual-parity:smoke` runs path-scoped as a local pre-push gate and in a `push: main` workflow that `deploy.yml` depends on (`needs:`); no PR check is assumed. Smoke ≤90s, full ≤5min post-push/scheduled, doctor/setup failures cannot skip, and failure artifacts contain both PNGs/diff/metrics/checksums plus one closed-set failure code. (R4/R7)                                                                                                                | Keep the command advisory while reducing matrix/startup cost; do not claim build-time enforcement. |
| G6   | D3 coverage and handoff            | Representative geometry, token paint, clip/mask/effect, text, raster, state, and nested layout cases pass; `/cross-check` documents when to run the automated command and when live review remains required; ADR-921 references this oracle instead of duplicating it. (R5/R8/R10)                                                                                                                                                                                          | Leave missing families in an explicit residual ledger and keep status below Implemented.           |

## Consequences

### Positive

- D3 consumer symmetry becomes an unattended, reproducible failure instead of
  only a manual review observation.
- Existing CanvasKit, Preview, Playwright, and PNG tooling is consolidated into
  one reusable oracle with no vgpu or runtime dependency.
- Failure artifacts identify whether drift is fixture identity, geometry,
  resource readiness, or paint pixels.
- ADR-921 and later renderer work gain a stable parity contract without owning
  another visual test stack.
- `/cross-check` can focus on exploratory and interaction states while stable
  regressions move into CI.

### Negative

- A pinned Chromium/font/CanvasKit environment and exception ledger require
  ongoing maintenance.
- Skia-versus-Chromium text rasterization cannot use a universal exact-pixel
  rule; layered structural and region budgets are more complex than snapshots.
- Real rendering adds CI startup and artifact costs, requiring a smoke/full
  split.
- The gate proves parity, not that a shared visual decision is correct; semantic
  catalog/spec tests remain necessary.
