import { Modal, Button } from "react-bootstrap";
import { usePwa } from "../context/PwaContext";

export default function IosInstallModal() {
  const { showIosGuide, setShowIosGuide } = usePwa();

  return (
    <Modal
      show={showIosGuide}
      onHide={() => setShowIosGuide(false)}
      centered
      dialogClassName="modal-dialog-centered"
      contentClassName="border-0 shadow-lg overflow-hidden"
    >
      <div
        className="soft-card p-4 border-0"
        style={{
          backgroundColor: "var(--bg-card)",
          color: "var(--text-primary)",
        }}
      >
        <div className="text-center mb-4">
          <div className="mb-3">
            <img
              src="/cc.svg"
              alt="CCGNDEC Logo"
              style={{
                width: "64px",
                height: "64px",
                objectFit: "contain",
                borderRadius: "12px",
              }}
              className="shadow-sm"
            />
          </div>
          <h5 className="fw-bold mb-1">Install Event Management Portal - CCGNDEC</h5>
          <p className="text-muted small mb-0">
            Install this portal on your iPhone or iPad home screen for quick offline access and full-screen experience.
          </p>
        </div>

        {/* Step-by-Step Instructions */}
        <div className="d-flex flex-column gap-3 mb-4">
          <div
            className="d-flex align-items-start gap-3 p-3 rounded"
            style={{
              backgroundColor: "var(--soft-hover)",
              border: "1px solid var(--border-color)",
            }}
          >
            <div
              className="badge bg-primary rounded-circle d-flex align-items-center justify-content-center flex-shrink-0"
              style={{ width: "24px", height: "24px", fontSize: "12px" }}
            >
              1
            </div>
            <div>
              <div className="fw-semibold small mb-1">
                Tap the Share button
              </div>
              <div className="text-muted small">
                In Safari&apos;s toolbar, tap the Share icon{" "}
                <i className="bi bi-box-arrow-up text-primary fw-bold fs-6 ms-1"></i>
              </div>
            </div>
          </div>

          <div
            className="d-flex align-items-start gap-3 p-3 rounded"
            style={{
              backgroundColor: "var(--soft-hover)",
              border: "1px solid var(--border-color)",
            }}
          >
            <div
              className="badge bg-primary rounded-circle d-flex align-items-center justify-content-center flex-shrink-0"
              style={{ width: "24px", height: "24px", fontSize: "12px" }}
            >
              2
            </div>
            <div>
              <div className="fw-semibold small mb-1">
                Select &ldquo;Add to Home Screen&rdquo;
              </div>
              <div className="text-muted small">
                Scroll down in the share sheet and tap{" "}
                <span className="text-body fw-bold">
                  Add to Home Screen{" "}
                  <i className="bi bi-plus-square text-primary ms-1"></i>
                </span>
              </div>
            </div>
          </div>

          <div
            className="d-flex align-items-start gap-3 p-3 rounded"
            style={{
              backgroundColor: "var(--soft-hover)",
              border: "1px solid var(--border-color)",
            }}
          >
            <div
              className="badge bg-primary rounded-circle d-flex align-items-center justify-content-center flex-shrink-0"
              style={{ width: "24px", height: "24px", fontSize: "12px" }}
            >
              3
            </div>
            <div>
              <div className="fw-semibold small mb-1">Confirm and Add</div>
              <div className="text-muted small">
                Tap <strong className="text-primary">Add</strong> in the top-right corner to finish installing.
              </div>
            </div>
          </div>
        </div>

        <div className="text-center">
          <Button
            variant="primary"
            className="rounded-pill px-4 w-100 fw-bold"
            onClick={() => setShowIosGuide(false)}
          >
            Got It
          </Button>
        </div>
      </div>
    </Modal>
  );
}
