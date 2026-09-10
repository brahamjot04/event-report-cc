import { Modal, Form, Button, Row, Col } from "react-bootstrap";

export default function ParticipantModal({
  show,
  onHide,
  partForm,
  setPartForm,
  activeItem,
  onSave,
}) {
  return (
    <Modal show={show} onHide={onHide} centered size="lg">
      <div
        className="soft-card border-0 p-0 overflow-hidden"
        style={{ height: "auto" }}
      >
        <Modal.Header
          closeButton
          className="border-bottom"
          style={{ borderColor: "var(--border-color)" }}
        >
          <Modal.Title className="fw-bold h5">Student Details</Modal.Title>
        </Modal.Header>
        <Modal.Body className="p-4 text-start">
          <Form className="d-grid gap-3">
            <Row>
              <Col>
                <Form.Label className="small fw-bold text-muted">
                  NAME
                </Form.Label>
                <Form.Control
                  placeholder="Name"
                  className="form-control"
                  style={{
                    backgroundColor: "var(--bg-main)",
                    color: "var(--text-primary)",
                    borderColor: "var(--border-color)",
                  }}
                  value={partForm.name || ""}
                  onChange={(e) =>
                    setPartForm({ ...partForm, name: e.target.value })
                  }
                />
              </Col>
              <Col>
                <Form.Label className="small fw-bold text-muted">
                  PHONE
                </Form.Label>
                <Form.Control
                  placeholder="Phone"
                  className="form-control"
                  style={{
                    backgroundColor: "var(--bg-main)",
                    color: "var(--text-primary)",
                    borderColor: "var(--border-color)",
                  }}
                  value={partForm.phone || ""}
                  onChange={(e) =>
                    setPartForm({ ...partForm, phone: e.target.value })
                  }
                />
              </Col>
            </Row>
            <Row>
              <Col>
                <Form.Label className="small fw-bold text-muted">CRN</Form.Label>
                <Form.Control
                  placeholder="CRN"
                  className="form-control"
                  style={{
                    backgroundColor: "var(--bg-main)",
                    color: "var(--text-primary)",
                    borderColor: "var(--border-color)",
                  }}
                  value={partForm.crn || ""}
                  onChange={(e) =>
                    setPartForm({ ...partForm, crn: e.target.value })
                  }
                />
              </Col>
              <Col>
                <Form.Label className="small fw-bold text-muted">URN</Form.Label>
                <Form.Control
                  placeholder="URN"
                  className="form-control"
                  style={{
                    backgroundColor: "var(--bg-main)",
                    color: "var(--text-primary)",
                    borderColor: "var(--border-color)",
                  }}
                  value={partForm.urn || ""}
                  onChange={(e) =>
                    setPartForm({ ...partForm, urn: e.target.value })
                  }
                />
              </Col>
            </Row>
            <Row>
              <Col>
                <Form.Label className="small fw-bold text-muted">
                  BRANCH
                </Form.Label>
                <Form.Control
                  placeholder="Branch"
                  className="form-control"
                  style={{
                    backgroundColor: "var(--bg-main)",
                    color: "var(--text-primary)",
                    borderColor: "var(--border-color)",
                  }}
                  value={partForm.branch || ""}
                  onChange={(e) =>
                    setPartForm({ ...partForm, branch: e.target.value })
                  }
                />
              </Col>
              {!activeItem?.isGroupEvent && (
                <Col>
                  <Form.Label className="small fw-bold text-muted">
                    POSITION
                  </Form.Label>
                  <Form.Control
                    placeholder="Position (Optional)"
                    className="form-control"
                    style={{
                      backgroundColor: "var(--bg-main)",
                      color: "var(--text-primary)",
                      borderColor: "var(--border-color)",
                    }}
                    value={partForm.position || ""}
                    onChange={(e) =>
                      setPartForm({ ...partForm, position: e.target.value })
                    }
                  />
                </Col>
              )}
            </Row>
            {activeItem?.isGroupEvent && (
              <Row>
                <Col>
                  <Form.Label className="small fw-bold text-muted">
                    TEAM NAME
                  </Form.Label>
                  <Form.Control
                    placeholder="Team Name"
                    className="form-control"
                    style={{
                      backgroundColor: "var(--bg-main)",
                      color: "var(--text-primary)",
                      borderColor: "var(--border-color)",
                    }}
                    value={partForm.teamName || ""}
                    onChange={(e) =>
                      setPartForm({
                        ...partForm,
                        teamName: e.target.value,
                      })
                    }
                  />
                </Col>
              </Row>
            )}
            {activeItem?.isGroupEvent && (
              <Row>
                <Col>
                  <Form.Check
                    type="checkbox"
                    id="captainCheck"
                    label="Mark as Captain"
                    checked={!!partForm.isCaptain}
                    onChange={(e) =>
                      setPartForm({
                        ...partForm,
                        isCaptain: e.target.checked,
                      })
                    }
                  />
                </Col>
              </Row>
            )}
            {activeItem?.isGroupEvent ? (
              <Row>
                <Col>
                  <Form.Text className="text-muted">
                    Position is managed at team level and will be the same
                    for all members in that team.
                  </Form.Text>
                </Col>
              </Row>
            ) : null}
          </Form>
        </Modal.Body>
        <Modal.Footer className="border-0 p-3 pt-0">
          <Button onClick={onSave} variant="primary" className="w-100">
            Save Student
          </Button>
        </Modal.Footer>
      </div>
    </Modal>
  );
}
