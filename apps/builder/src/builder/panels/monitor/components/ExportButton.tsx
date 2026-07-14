/**
 * ExportButton Component
 *
 * 메모리 통계를 CSV 또는 JSON으로 내보내기
 */

import { Download } from "lucide-react";
import { Button } from "react-aria-components";
import type { MemoryStats } from "../hooks/useMemoryStats";
import { iconEditProps } from "../../../../utils/ui/uiConstants";

interface ExportButtonProps {
  /** 내보낼 통계 데이터 */
  stats: MemoryStats | null;
  /** 내보내기 형식 */
  format?: "csv" | "json";
}

export function ExportButton({ stats, format = "json" }: ExportButtonProps) {
  const handleExport = () => {
    if (!stats) return;

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    let content: string;
    let mimeType: string;
    let extension: string;

    if (format === "csv") {
      // UTF-8 BOM for Korean support
      const BOM = "\uFEFF";
      const headers = ["Metric", "Value", "Timestamp"];
      const rows = [
        ["Page Count", stats.pageCount, timestamp],
        ["Total Entries", stats.totalEntries, timestamp],
        ["Memory Usage (bytes)", stats.estimatedMemoryUsage, timestamp],
      ];
      content =
        BOM + [headers, ...rows].map((row) => row.join(",")).join("\n");
      mimeType = "text/csv;charset=utf-8";
      extension = "csv";
    } else {
      content = JSON.stringify(
        {
          ...stats,
          exportedAt: timestamp,
        },
        null,
        2
      );
      mimeType = "application/json";
      extension = "json";
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `monitor-stats-${timestamp}.${extension}`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Button
      className="export-button"
      onPress={handleExport}
      isDisabled={!stats}
      aria-label={`Export stats as ${format.toUpperCase()}`}
    >
      <Download size={iconEditProps.size} aria-hidden="true" />
      <span>Export {format.toUpperCase()}</span>
    </Button>
  );
}
