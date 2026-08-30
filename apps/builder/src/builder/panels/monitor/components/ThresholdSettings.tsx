/**
 * ThresholdSettings Component
 *
 * 메모리 임계값 설정
 * - Warning threshold (노란색 경고)
 * - Danger threshold (빨간색 경고)
 * - localStorage 저장
 */

import { useState, useEffect } from "react";
import { Settings, X, RotateCcw } from "lucide-react";
import { Button } from "@composition/shared/components";
import { Dialog, DialogTrigger, Popover } from "react-aria-components";
import { iconSmall, iconEditProps } from "../../../../utils/ui/uiConstants";
import { ActionIconButton, PropertySlider } from "../../../components";
import {
  type ThresholdConfig,
  saveThresholdConfig,
} from "../utils/thresholdConfig";
import { translateKey, useOptionalI18n } from "../../../../i18n";

// 외부에서 사용하는 경우 별도 파일에서 직접 import하세요:
// import { loadThresholdConfig, type ThresholdConfig } from "../utils/thresholdConfig";

interface ThresholdSettingsProps {
  config: ThresholdConfig;
  onChange: (config: ThresholdConfig) => void;
}

export function ThresholdSettings({
  config,
  onChange,
}: ThresholdSettingsProps) {
  const i18n = useOptionalI18n();
  const localize = (key: string, fallback: string) =>
    i18n ? translateKey(i18n.t, `monitor.${key}`, fallback) : fallback;
  const [isOpen, setIsOpen] = useState(false);
  const [localConfig, setLocalConfig] = useState(config);

  useEffect(() => {
    queueMicrotask(() => {
      setLocalConfig(config);
    });
  }, [config]);

  const handleSave = () => {
    // danger가 warning보다 커야 함
    const validConfig = {
      warning: Math.min(localConfig.warning, localConfig.danger - 5),
      danger: localConfig.danger,
    };
    saveThresholdConfig(validConfig);
    onChange(validConfig);
    setIsOpen(false);
  };

  const handleReset = () => {
    const defaultConfig = { warning: 60, danger: 75 };
    setLocalConfig(defaultConfig);
  };

  const handleOpenChange = (open: boolean) => {
    if (open) {
      setLocalConfig(config);
    }
    setIsOpen(open);
  };

  return (
    <DialogTrigger isOpen={isOpen} onOpenChange={handleOpenChange}>
      <ActionIconButton
        className="threshold-settings-btn"
        aria-label={localize("thresholdSettings", "Threshold settings")}
      >
        <Settings size={iconEditProps.size} aria-hidden="true" />
      </ActionIconButton>

      <Popover
        className="monitor-threshold-popover"
        placement="top end"
        offset={4}
      >
        <Dialog
          className="monitor-threshold-dialog"
          aria-label={localize("thresholdSettings", "Threshold Settings")}
        >
          <div className="monitor-threshold-header">
            <h3>{localize("thresholdSettings", "Threshold Settings")}</h3>
            <ActionIconButton
              className="monitor-threshold-close"
              onPress={() => setIsOpen(false)}
              aria-label={localize(
                "closeThresholdSettings",
                "Close threshold settings",
              )}
            >
              <X size={iconEditProps.size} />
            </ActionIconButton>
          </div>

          <div className="monitor-threshold-content">
            <div className="monitor-threshold-slider">
              <PropertySlider
                label={localize("warningThreshold", "Warning threshold")}
                min={30}
                max={90}
                step={5}
                value={localConfig.warning}
                onChange={(warning) =>
                  setLocalConfig((prev) => ({
                    ...prev,
                    warning,
                  }))
                }
              />
              <p className="monitor-threshold-hint">
                {localize(
                  "warningThresholdHint",
                  "Memory usage that shows the yellow warning",
                )}
              </p>
            </div>

            <div className="monitor-threshold-slider">
              <PropertySlider
                label={localize("dangerThreshold", "Danger threshold")}
                min={40}
                max={95}
                step={5}
                value={localConfig.danger}
                onChange={(danger) =>
                  setLocalConfig((prev) => ({
                    ...prev,
                    danger,
                  }))
                }
              />
              <p className="monitor-threshold-hint">
                {localize(
                  "dangerThresholdHint",
                  "Memory usage that shows the red danger warning",
                )}
              </p>
            </div>

            <div className="monitor-threshold-preview" aria-hidden="true">
              <div className="monitor-threshold-preview-bar">
                <div
                  className="monitor-threshold-zone safe"
                  style={{ width: `${localConfig.warning}%` }}
                >
                  Safe
                </div>
                <div
                  className="monitor-threshold-zone warning"
                  style={{
                    width: `${localConfig.danger - localConfig.warning}%`,
                  }}
                >
                  Warn
                </div>
                <div
                  className="monitor-threshold-zone danger"
                  style={{ width: `${100 - localConfig.danger}%` }}
                >
                  Danger
                </div>
              </div>
            </div>
          </div>

          <div className="monitor-threshold-footer">
            <Button variant="secondary" size="sm" onPress={handleReset}>
              <RotateCcw size={iconSmall.size} />
              {i18n ? i18n.t("common.reset") : "Reset"}
            </Button>
            <Button size="sm" onPress={handleSave}>
              {i18n ? i18n.t("common.save") : "Save"}
            </Button>
          </div>
        </Dialog>
      </Popover>
    </DialogTrigger>
  );
}
