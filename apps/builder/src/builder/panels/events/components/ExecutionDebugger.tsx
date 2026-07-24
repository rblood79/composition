/**
 * Execution Debugger - 이벤트 실행 디버깅 UI
 *
 * ExecutionLogger의 로그를 시각화하여 디버깅을 돕습니다.
 */

import { useState, useEffect } from "react";
import { Button } from "react-aria-components";
import {
  Crosshair,
  Zap,
  HelpCircle,
  XCircle,
  FileText,
  ChevronRight,
  ChevronDown,
} from "lucide-react";
import { iconEditProps } from "../../../../utils/ui/uiConstants";
import type {
  ExecutionLogger,
  LogEntry,
  LogLevel,
} from "../execution/executionLogger";

export interface ExecutionDebuggerProps {
  logger: ExecutionLogger;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

export function ExecutionDebugger({
  logger,
  autoRefresh = true,
  refreshInterval = 1000,
}: ExecutionDebuggerProps) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filterLevel, setFilterLevel] = useState<LogLevel | "all">("all");
  const [filterType, setFilterType] = useState<string>("all");
  const [isCollapsed, setIsCollapsed] = useState(false);

  // 로그 새로고침
  useEffect(() => {
    const updateLogs = () => {
      setLogs(logger.getLogs());
    };

    updateLogs();

    if (autoRefresh) {
      const interval = setInterval(updateLogs, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [logger, autoRefresh, refreshInterval]);

  // 필터링된 로그
  const filteredLogs = logs.filter((log) => {
    if (filterLevel !== "all" && log.level !== filterLevel) return false;
    if (filterType !== "all" && log.type !== filterType) return false;
    return true;
  });

  // 통계
  const stats = logger.getStats();

  const handleClear = () => {
    logger.clear();
    setLogs([]);
  };

  const handleExport = () => {
    const json = logger.exportLogs();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `event-logs-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getLevelColor = (level: LogLevel): string => {
    switch (level) {
      case "debug":
        return "log-level--debug";
      case "info":
        return "log-level--info";
      case "warn":
        return "log-level--warn";
      case "error":
        return "log-level--error";
      default:
        return "log-level--debug";
    }
  };

  const TypeIcon = ({ type }: { type: string }) => {
    const props = { size: iconEditProps.size, className: "log-icon" };
    switch (type) {
      case "handler":
        return <Crosshair {...props} />;
      case "action":
        return <Zap {...props} />;
      case "condition":
        return <HelpCircle {...props} />;
      case "error":
        return <XCircle {...props} />;
      default:
        return <FileText {...props} />;
    }
  };

  return (
    <div className="execution-debugger">
      <div className="debugger-header">
        <div className="header-left">
          <Button
            className="react-aria-Button sm"
            onPress={() => setIsCollapsed(!isCollapsed)}
          >
            {isCollapsed ? (
              <ChevronRight size={iconEditProps.size} />
            ) : (
              <ChevronDown size={iconEditProps.size} />
            )}{" "}
            Execution Debugger
          </Button>
          <span className="log-count">({filteredLogs.length} logs)</span>
        </div>

        {!isCollapsed && (
          <div className="header-right">
            <Button className="react-aria-Button sm" onPress={handleClear}>
              Clear
            </Button>
            <Button className="react-aria-Button sm" onPress={handleExport}>
              Export
            </Button>
          </div>
        )}
      </div>

      {!isCollapsed && (
        <>
          {/* Stats */}
          <div className="debugger-stats">
            <div className="stat-item">
              <span className="stat-label">Total:</span>
              <span className="stat-value">{stats.total}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Errors:</span>
              <span className="stat-value stat-value--error">
                {stats.byLevel.error}
              </span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Warnings:</span>
              <span className="stat-value stat-value--warn">
                {stats.byLevel.warn}
              </span>
            </div>
          </div>

          {/* Filters */}
          <div className="debugger-filters">
            <div className="filter-group">
              <label>Level:</label>
              <select
                value={filterLevel}
                onChange={(e) =>
                  setFilterLevel(e.target.value as LogLevel | "all")
                }
                className="filter-select"
              >
                <option value="all">All</option>
                <option value="debug">Debug</option>
                <option value="info">Info</option>
                <option value="warn">Warn</option>
                <option value="error">Error</option>
              </select>
            </div>

            <div className="filter-group">
              <label>Type:</label>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="filter-select"
              >
                <option value="all">All</option>
                <option value="handler">Handler</option>
                <option value="action">Action</option>
                <option value="condition">Condition</option>
                <option value="error">Error</option>
              </select>
            </div>
          </div>

          {/* Logs */}
          <div className="debugger-logs">
            {filteredLogs.length === 0 ? (
              <div className="empty-logs">No logs to display</div>
            ) : (
              filteredLogs.map((log) => (
                <div key={log.id} className={`log-entry log-${log.level}`}>
                  <div className="log-header">
                    <TypeIcon type={log.type} />
                    <span className={`log-level ${getLevelColor(log.level)}`}>
                      [{log.level.toUpperCase()}]
                    </span>
                    <span className="log-type">[{log.type}]</span>
                    <span className="log-timestamp">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <div className="log-message">{log.message}</div>
                  {Boolean(log.data) && (
                    <details className="log-data">
                      <summary>Data</summary>
                      <pre>{JSON.stringify(log.data, null, 2)}</pre>
                    </details>
                  )}
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
