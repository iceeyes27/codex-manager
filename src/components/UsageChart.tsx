import React, { useEffect, useRef } from "react";
import * as echarts from "echarts/core";
import { PieChart } from "echarts/charts";
import { SVGRenderer } from "echarts/renderers";
import type { ECharts, EChartsCoreOption } from "echarts/core";
import type { QuotaMetric } from "../utils/dashboard";

echarts.use([PieChart, SVGRenderer]);

interface UsageChartProps {
  metric: QuotaMetric;
}

const TONE_COLORS: Record<QuotaMetric["tone"], string> = {
  critical: "#ef4444",
  warning: "#f5b400",
  healthy: "#18b766",
};

function buildSeries(metric: QuotaMetric) {
  const usedPercent = metric.available && metric.percent !== null ? metric.percent : null;

  return {
    type: "pie",
    center: ["50%", "50%"],
    radius: ["54%", "73%"],
    startAngle: 90,
    clockwise: true,
    silent: true,
    labelLine: { show: false },
    emphasis: { disabled: true },
    data:
      usedPercent === null
        ? [
            {
              value: 100,
              itemStyle: {
                color: "#eef2f7",
                borderColor: "#cbd5e1",
                borderWidth: 1.25,
                borderType: "dashed",
              },
            },
          ]
        : [
            {
              value: usedPercent,
              itemStyle: {
                color: TONE_COLORS[metric.tone],
                shadowBlur: 14,
                shadowColor: "rgba(15, 23, 42, 0.14)",
              },
            },
            {
              value: Math.max(0, 100 - usedPercent),
              itemStyle: {
                color: "#e8edf5",
              },
            },
          ],
    label: {
      show: true,
      position: "center",
      formatter:
        usedPercent === null
          ? "{value|--}\n{name|未获取}"
          : `{value|${usedPercent}%}\n{name|已使用}`,
      rich: {
        value: {
          fontSize: 18,
          fontWeight: 700,
          lineHeight: 24,
          color: "#0f172a",
          fontFamily: "ui-sans-serif, sans-serif",
        },
        name: {
          fontSize: 10,
          lineHeight: 12,
          color: "#64748b",
          fontFamily: "ui-sans-serif, sans-serif",
        },
      },
    },
  };
}

const UsageChart: React.FC<UsageChartProps> = ({ metric }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<ECharts | null>(null);

  useEffect(() => {
    if (!containerRef.current) {
      return undefined;
    }

    const chart = echarts.init(containerRef.current, undefined, {
      renderer: "svg",
    });
    chartRef.current = chart;

    const option: EChartsCoreOption = {
      animationDuration: 450,
      animationDurationUpdate: 300,
      series: [buildSeries(metric)],
    };

    chart.setOption(option);

    const resizeObserver = new ResizeObserver(() => {
      chart.resize();
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      chart.dispose();
      chartRef.current = null;
    };
  }, [metric]);

  return <div ref={containerRef} className="h-[96px] w-full" />;
};

export default UsageChart;
