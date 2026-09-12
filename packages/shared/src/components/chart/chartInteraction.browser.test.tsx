import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { Chart } from "../Chart";
import { CHART_DESCRIPTORS, createChartInitialProps } from "@composition/specs";
let root: Root;
let host: HTMLDivElement;
afterEach(() => {
  root?.unmount();
  host?.remove();
});
const frame = () =>
  new Promise<number>((resolve) => requestAnimationFrame(resolve));
const signature = () =>
  Array.from(
    host.querySelectorAll(
      ".recharts-surface path, .recharts-surface clipPath rect",
    ),
  )
    .map((node) =>
      ["d", "width", "height", "stroke-dasharray", "transform"]
        .map((key) => node.getAttribute(key))
        .join(":"),
    )
    .join("|");
// ADR-217 — 산점도는 Recharts 그래픽 항목 없이 scene path 를 그린다 (P=5,000 점의 점별 요소가 스텝당
//   ~290 ms — P6 perf) → 진입 애니메이션이 없다. 재전송 동일성만 본다 (animation 축은 해당 없음).
for (const descriptor of CHART_DESCRIPTORS)
  for (const active of descriptor.chartType === "scatter"
    ? [false]
    : [false, true])
    it(`${descriptor.chartType} native animation=${active}과 동일 rows 재전송`, async () => {
      const props = createChartInitialProps(descriptor.chartType);
      host = document.createElement("div");
      document.body.append(host);
      root = createRoot(host);
      const render = (rows: typeof props.data) => (
        <Chart
          {...props}
          size="md"
          data={rows}
          isAnimationActive={active}
          animationBegin={0}
          animationDuration={160}
          style={{ width: 320, height: 240 }}
        />
      );
      root.render(render(props.data));
      await vi.waitFor(() =>
        expect(host.querySelector(".recharts-surface path")).toBeTruthy(),
      );
      const snapshots = new Set<string>();
      const start = performance.now();
      while (performance.now() - start < 350) {
        await frame();
        snapshots.add(signature());
      }
      if (
        active &&
        !window.matchMedia("(prefers-reduced-motion: reduce)").matches
      )
        expect(snapshots.size, descriptor.chartType).toBeGreaterThan(1);
      else expect(snapshots.size, descriptor.chartType).toBe(1);
      const final = signature();
      root.render(render(structuredClone(props.data)));
      const after = performance.now();
      while (performance.now() - after < 230) {
        await frame();
        expect(
          signature(),
          `${descriptor.chartType} unchanged rows replay`,
        ).toBe(final);
      }
    });
it("wrapper, Area 외곽/점 토큰과 native 키보드 tooltip", async () => {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  host.style.setProperty("--chart-series-1", "rgb(201, 10, 20)");
  host.style.setProperty("--chart-series-2", "rgb(20, 30, 202)");
  root.render(
    <Chart
      {...createChartInitialProps("area")}
      showDots
      showTooltip
      isAnimationActive={false}
      variant="default"
      size="lg"
      className="user-chart"
      style={{
        width: 480,
        height: 320,
        fontFamily: "monospace",
        padding: 12,
        border: "1px solid black",
        boxSizing: "border-box",
      }}
    />,
  );
  await vi.waitFor(() =>
    expect(host.querySelectorAll(".recharts-area-area").length).toBe(2),
  );
  const wrapper = host.querySelector(".react-aria-Chart")!;
  expect(wrapper.classList.contains("user-chart")).toBe(true);
  expect(wrapper.getAttribute("data-size")).toBe("lg");
  expect(wrapper.getAttribute("data-variant")).toBe("default");
  const svgBox = host
      .querySelector(".recharts-surface")!
      .getBoundingClientRect(),
    wrapperBox = wrapper.getBoundingClientRect();
  expect(Math.abs(svgBox.x - wrapperBox.x)).toBeLessThan(0.1);
  expect(Math.abs(svgBox.y - wrapperBox.y)).toBeLessThan(0.1);
  expect(svgBox.width).toBe(wrapperBox.width);
  expect(svgBox.height).toBe(wrapperBox.height);
  const area = host.querySelector(".recharts-area-area")!;
  expect(getComputedStyle(area).stroke).toBe("rgb(201, 10, 20)");
  expect(getComputedStyle(area).fill).toBe("rgb(201, 10, 20)");
  const dot = host.querySelector(".recharts-area-dots circle")!;
  expect(getComputedStyle(dot).stroke).toBe("none");
  expect(getComputedStyle(dot).fontFamily).toBe("monospace");
  const application = host.querySelector<SVGSVGElement>(
    'svg[role="application"]',
  )!;
  expect(application).toBeTruthy();
  expect(application.getAttribute("tabindex")).toBe("0");
  application.focus();
  await userEvent.keyboard("{ArrowRight}");
  await vi.waitFor(() =>
    expect(
      host.querySelector(".react-aria-Chart-tooltip")?.textContent,
    ).toContain("Tue"),
  );
  expect(wrapper.getAttribute("role")).toBe("group");
});
it("숨김과 0 크기에서는 렌더하지 않고 표시·resize 후 실측 크기를 사용한다", async () => {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  const render = (width: number, display = "block") =>
    root.render(
      <Chart
        {...createChartInitialProps("bar")}
        size="md"
        isAnimationActive={false}
        style={{ width, height: 240, display }}
      />,
    );
  render(320, "none");
  await frame();
  await frame();
  expect(host.querySelector(".recharts-surface")).toBeNull();
  render(320);
  await vi.waitFor(() =>
    expect(
      host.querySelector(".recharts-surface")?.getBoundingClientRect().width,
    ).toBe(320),
  );
  render(480);
  await vi.waitFor(() =>
    expect(
      host.querySelector(".recharts-surface")?.getBoundingClientRect().width,
    ).toBe(480),
  );
  render(0);
  await vi.waitFor(() =>
    expect(host.querySelector(".recharts-surface")).toBeNull(),
  );
  render(320);
  await vi.waitFor(() =>
    expect(
      host.querySelector(".recharts-surface")?.getBoundingClientRect().width,
    ).toBe(320),
  );
});
