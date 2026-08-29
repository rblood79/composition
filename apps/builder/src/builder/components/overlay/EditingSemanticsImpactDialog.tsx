import { useEffect, useState } from "react";
import {
  Button,
  Dialog,
  Heading,
  Modal,
  ModalOverlay,
} from "react-aria-components";
import { AlertTriangle } from "lucide-react";
import {
  resolveEditingSemanticsImpactConfirmation,
  subscribeEditingSemanticsImpactConfirmation,
  type EditingSemanticsConfirmationRequest,
} from "../../utils/editingSemanticsImpactConfirmation";
import "./EditingSemanticsImpactDialog.css";

export function EditingSemanticsImpactDialogHost() {
  const [request, setRequest] =
    useState<EditingSemanticsConfirmationRequest | null>(null);

  useEffect(() => {
    return subscribeEditingSemanticsImpactConfirmation(setRequest);
  }, []);

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen && request) {
      resolveEditingSemanticsImpactConfirmation(false);
    }
  };

  const handleCancel = () => {
    resolveEditingSemanticsImpactConfirmation(false);
  };

  const handleContinue = () => {
    resolveEditingSemanticsImpactConfirmation(true);
  };

  const isDetachRequest = request?.kind === "detach-instance";
  const instanceCount = isDetachRequest ? 1 : (request?.instanceCount ?? 0);
  const instanceLabel =
    instanceCount === 1 ? "1 instance" : `${instanceCount} instances`;
  const previewInstanceIds =
    request && !isDetachRequest ? request.impactedInstanceIds.slice(0, 5) : [];
  const hiddenInstanceCount = Math.max(
    0,
    instanceCount - previewInstanceIds.length,
  );
  const title = isDetachRequest ? "Detach instance" : "Component impact";
  const body = isDetachRequest ? (
    <p>
      Detaching <strong>{request?.instanceLabel ?? "this instance"}</strong>{" "}
      will turn it into a standalone element. Future origin changes will no
      longer update this instance.
    </p>
  ) : (
    <>
      <p>
        Editing {request?.originLabel ?? "this component"} will affect{" "}
        <strong>{instanceLabel}</strong>.
      </p>
      <p className="editing-impact-meta">
        Counted in {request?.countDurationMs.toFixed(1) ?? "0.0"}ms.
      </p>
    </>
  );

  return (
    <ModalOverlay
      className="editing-impact-overlay"
      isDismissable
      isOpen={Boolean(request)}
      onOpenChange={handleOpenChange}
    >
      <Modal className="editing-impact-modal">
        <Dialog aria-label="Component impact preview">
          <div className="editing-impact-header">
            <AlertTriangle aria-hidden="true" size={18} />
            <Heading className="editing-impact-title" slot="title">
              {title}
            </Heading>
          </div>
          <div className="editing-impact-body">
            {body}
            {previewInstanceIds.length > 0 && (
              <div
                aria-label="Affected instances"
                className="editing-impact-list"
              >
                {previewInstanceIds.map((instanceId) => (
                  <span className="editing-impact-list-item" key={instanceId}>
                    {instanceId}
                  </span>
                ))}
                {hiddenInstanceCount > 0 && (
                  <span className="editing-impact-list-more">
                    +{hiddenInstanceCount} more
                  </span>
                )}
              </div>
            )}
          </div>
          <div className="editing-impact-actions">
            <Button
              className="control-button"
              onPress={handleCancel}
            >
              Cancel
            </Button>
            <Button
              autoFocus
              className="control-button"
              data-variant="primary"
              onPress={handleContinue}
            >
              Continue
            </Button>
          </div>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}
