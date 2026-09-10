/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useCallback } from "react";
import { Toast, ToastContainer, Modal, Button } from "react-bootstrap";

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    title: "Confirm Action",
    message: "Are you sure you want to proceed?",
    confirmText: "Confirm",
    cancelText: "Cancel",
    variant: "primary",
    resolve: null,
  });

  const showToast = useCallback((message, variant = "info", title = "") => {
    const id = Date.now() + Math.random().toString(36).slice(2, 6);
    setToasts((prev) => [...prev, { id, message, variant, title }]);
  }, []);

  const showSuccess = useCallback((msg, title = "Success") => showToast(msg, "success", title), [showToast]);
  const showError = useCallback((msg, title = "Error") => showToast(msg, "danger", title), [showToast]);
  const showWarning = useCallback((msg, title = "Warning") => showToast(msg, "warning", title), [showToast]);
  const showInfo = useCallback((msg, title = "Notice") => showToast(msg, "info", title), [showToast]);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Promise-based confirmation dialog: returns true if confirmed, false if cancelled
  const confirm = useCallback(
    ({
      title = "Confirm Action",
      message = "Are you sure you want to proceed?",
      confirmText = "Confirm",
      cancelText = "Cancel",
      variant = "primary",
    } = {}) => {
      return new Promise((resolve) => {
        setConfirmDialog({
          isOpen: true,
          title,
          message,
          confirmText,
          cancelText,
          variant,
          resolve,
        });
      });
    },
    [],
  );

  const handleConfirmClose = (confirmed) => {
    if (confirmDialog.resolve) {
      confirmDialog.resolve(confirmed);
    }
    setConfirmDialog((prev) => ({ ...prev, isOpen: false, resolve: null }));
  };

  return (
    <ToastContext.Provider
      value={{
        showToast,
        showSuccess,
        showError,
        showWarning,
        showInfo,
        confirm,
      }}
    >
      {children}

      {/* Floating Toast Notifications */}
      <ToastContainer
        position="top-end"
        className="p-3"
        style={{ zIndex: 10000, position: "fixed" }}
      >
        {toasts.map((t) => (
          <Toast
            key={t.id}
            bg={t.variant === "info" ? "light" : t.variant}
            onClose={() => removeToast(t.id)}
            delay={4500}
            autohide
            className="shadow-sm border-0 mb-2"
          >
            <Toast.Header closeButton>
              <i
                className={`bi me-2 ${
                  t.variant === "success"
                    ? "bi-check-circle-fill text-success"
                    : t.variant === "danger"
                      ? "bi-exclamation-triangle-fill text-danger"
                      : t.variant === "warning"
                        ? "bi-exclamation-circle-fill text-warning"
                        : "bi-info-circle-fill text-info"
                }`}
              ></i>
              <strong className="me-auto">{t.title || "Notification"}</strong>
              <small className="text-muted">Just now</small>
            </Toast.Header>
            <Toast.Body
              className={
                t.variant === "danger" || t.variant === "success"
                  ? "text-white fw-medium"
                  : "text-dark"
              }
            >
              {t.message}
            </Toast.Body>
          </Toast>
        ))}
      </ToastContainer>

      {/* Modern Confirmation Modal */}
      <Modal
        show={confirmDialog.isOpen}
        onHide={() => handleConfirmClose(false)}
        centered
        backdrop="static"
      >
        <div
          style={{
            backgroundColor: "var(--bg-card, #fff)",
            color: "var(--text-primary, #212529)",
            borderRadius: "12px",
            overflow: "hidden",
          }}
        >
          <Modal.Header closeButton className="border-0 pb-0">
            <Modal.Title className="h5 fw-bold">
              {confirmDialog.title}
            </Modal.Title>
          </Modal.Header>
          <Modal.Body className="py-3">
            <p className="mb-0 text-secondary">{confirmDialog.message}</p>
          </Modal.Body>
          <Modal.Footer className="border-0 pt-0">
            <Button
              variant="outline-secondary"
              className="rounded-pill px-3"
              onClick={() => handleConfirmClose(false)}
            >
              {confirmDialog.cancelText}
            </Button>
            <Button
              variant={confirmDialog.variant}
              className="rounded-pill px-4"
              onClick={() => handleConfirmClose(true)}
            >
              {confirmDialog.confirmText}
            </Button>
          </Modal.Footer>
        </div>
      </Modal>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}

export default ToastContext;
