/**
 * ADR-279 Decision 3a — the Create component name dialog (Webflow · Plasmic): one text field
 * with the default name selected, Enter confirms, Escape or a press outside cancels (no step).
 * The ConfirmDialog's frame and grid; the input is the page title editor's.
 */
import { useEffect, useRef, useState } from "react";
import { Button } from "react-aria-components/Button";
import { Dialog } from "react-aria-components/Dialog";
import { Heading } from "react-aria-components/Heading";
import { Modal, ModalOverlay } from "react-aria-components/Modal";
import { useI18n } from "@/i18n";
import {
  resolveComponentNameRequest,
  subscribeComponentNameRequest,
  type ComponentNameRequest,
} from "../../utils/componentNamePrompt";
import "./ConfirmDialog.css";
import "./ComponentNameDialog.css";

export function ComponentNameDialogHost() {
  const { t } = useI18n();
  const [request, setRequest] = useState<ComponentNameRequest | null>(null);
  const [name, setName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(
    () =>
      subscribeComponentNameRequest((next) => {
        setRequest(next);
        setName(next?.defaultName ?? "");
      }),
    [],
  );
  const confirm = () => resolveComponentNameRequest(name);
  const cancel = () => resolveComponentNameRequest(null);
  return (
    <ModalOverlay
      className="confirm-dialog-overlay"
      isOpen={request !== null}
      isDismissable
      onOpenChange={(open) => {
        if (!open && request) cancel();
      }}
    >
      <Modal className="confirm-dialog-modal">
        <Dialog
          className="confirm-dialog component-name-dialog"
          aria-label={t("componentAction.createComponent")}
        >
          <div className="confirm-dialog-header">
            <Heading className="confirm-dialog-title" slot="title">
              {t("componentAction.createComponent")}
            </Heading>
          </div>
          <form
            className="confirm-dialog-body"
            onSubmit={(event) => {
              event.preventDefault();
              if (name.trim()) confirm();
            }}
          >
            <label className="component-name-dialog-label">
              <span>{t("componentAction.componentName")}</span>
              <input
                ref={inputRef}
                className="component-name-dialog-input"
                data-text-editing="true"
                autoFocus
                value={name}
                onFocus={(event) => event.currentTarget.select()}
                onChange={(event) => setName(event.currentTarget.value)}
                onKeyDown={(event) => {
                  event.stopPropagation();
                  if (event.key === "Escape") {
                    event.preventDefault();
                    cancel();
                  }
                }}
              />
            </label>
          </form>
          <div className="confirm-dialog-actions">
            <Button className="control-button" onPress={cancel}>
              {t("common.cancel")}
            </Button>
            <Button
              className="control-button"
              data-variant="primary"
              isDisabled={!name.trim()}
              onPress={confirm}
            >
              {t("componentAction.createComponent")}
            </Button>
          </div>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}
