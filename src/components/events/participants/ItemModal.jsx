import { Modal, Form, Button } from "react-bootstrap";

export default function ItemModal({
  show,
  onHide,
  editingItemId,
  newItemName,
  setNewItemName,
  newItemIsGroup,
  setNewItemIsGroup,
  newItemCategory,
  setNewItemCategory,
  categories,
  onSave,
}) {
  return (
    <Modal show={show} onHide={onHide} centered>
      <div
        className="soft-card border-0 p-0 overflow-hidden"
        style={{ height: "auto" }}
      >
        <Modal.Header
          closeButton
          className="border-bottom"
          style={{ borderColor: "var(--border-color)" }}
        >
          <Modal.Title className="fw-bold h5 text-start">
            {editingItemId ? "Edit Sub-Event" : "New Sub-Event"}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="p-4 text-start">
          <Form.Group className="mb-3">
            <Form.Label className="small fw-bold text-muted">NAME</Form.Label>
            <Form.Control
              className="form-control"
              style={{
                backgroundColor: "var(--bg-main)",
                color: "var(--text-primary)",
                borderColor: "var(--border-color)",
              }}
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
            />
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Check
              type="switch"
              id="isGroupSwitch"
              label="Group Event (teams)"
              checked={newItemIsGroup}
              onChange={(e) => setNewItemIsGroup(e.target.checked)}
            />
          </Form.Group>
          <Form.Group>
            <Form.Label className="small fw-bold text-muted">
              CATEGORY
            </Form.Label>
            <Form.Select
              className="form-select"
              style={{
                backgroundColor: "var(--bg-main)",
                color: "var(--text-primary)",
                borderColor: "var(--border-color)",
              }}
              value={newItemCategory}
              onChange={(e) => setNewItemCategory(e.target.value)}
            >
              <option value="">Select...</option>
              {categories.map((c, i) => (
                <option key={i} value={c}>
                  {c}
                </option>
              ))}
            </Form.Select>
          </Form.Group>
        </Modal.Body>
        <Modal.Footer className="border-0 p-3 pt-0">
          <Button variant="secondary" onClick={onHide} className="me-2">
            Cancel
          </Button>
          <Button variant="primary" onClick={onSave} className="w-100">
            {editingItemId ? "Save Changes" : "Create Sub-Event"}
          </Button>
        </Modal.Footer>
      </div>
    </Modal>
  );
}
