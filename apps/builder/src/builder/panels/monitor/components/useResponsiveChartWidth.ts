import { useLayoutEffect, useRef, useState } from "react";

export function useResponsiveChartWidth(fallbackWidth: number) {
  const chartRef = useRef<SVGSVGElement>(null);
  const [chartWidth, setChartWidth] = useState(fallbackWidth);

  useLayoutEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;

    const updateWidth = (nextWidth: number) => {
      if (!Number.isFinite(nextWidth) || nextWidth <= 0) return;
      const roundedWidth = Math.round(nextWidth);
      setChartWidth((currentWidth) =>
        currentWidth === roundedWidth ? currentWidth : roundedWidth,
      );
    };

    updateWidth(chart.getBoundingClientRect().width);

    if (typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver(([entry]) => {
      updateWidth(entry.contentRect.width);
    });
    observer.observe(chart);

    return () => observer.disconnect();
  }, []);

  return { chartRef, chartWidth };
}
