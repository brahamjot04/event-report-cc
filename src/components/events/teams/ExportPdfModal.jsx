import { Modal, Button, Form } from "react-bootstrap";

export default function ExportPdfModal({
  show,
  onHide,
  includePhoneInPDF,
  setIncludePhoneInPDF,
  onExport,
}) {
  return (
    <Modal show={show} onHide={onHide} centered>
      <div className="soft-card border-0 p-0 overflow-hidden">
        <Modal.Header
          closeButton
          className="border-bottom"
          style={{ borderColor: "var(--border-color)" }}
        >
          <Modal.Title className="fw-bold h5">Export PDF</Modal.Title>
        </Modal.Header>
        <Modal.Body className="p-4 text-start">
          <Form.Check
            type="switch"
            id="include-phone-export-switch-modal"
            label="Include phone numbers in the export"
            checked={includePhoneInPDF}
            onChange={(e) => setIncludePhoneInPDF(e.target.checked)}
          />
        </Modal.Body>
        <Modal.Footer className="border-0 p-3 pt-0 d-flex gap-2">
          <Button variant="outline-secondary" onClick={onHide}>
            Cancel
          </Button>
          <Button variant="danger" onClick={onExport}>
            Export
          </Button>
        </Modal.Footer>
      </div>
    </Modal>
  );
}
