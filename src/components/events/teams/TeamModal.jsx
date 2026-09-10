import { Modal, Button, Form, Badge } from "react-bootstrap";

export default function TeamModal({
  show,
  onHide,
  isEditingTeam,
  newTeamName,
  setNewTeamName,
  selectedTeamHead,
  setSelectedTeamHead,
  manualTeamHead,
  setManualTeamHead,
  coreTeamMembers,
  handleAddHeadToList,
  pendingTeamHeads,
  removePendingHead,
  handleCreateTeam,
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
            {isEditingTeam ? "Edit Team" : "Create New Team"}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="p-4 text-start d-grid gap-3">
          <Form.Group>
            <Form.Label className="small fw-bold text-muted">
              TEAM NAME
            </Form.Label>
            <Form.Control
              placeholder="e.g. Discipline Committee"
              className="form-control"
              style={{
                backgroundColor: "var(--bg-main)",
                color: "var(--text-primary)",
                borderColor: "var(--border-color)",
              }}
              value={newTeamName}
              onChange={(e) => setNewTeamName(e.target.value)}
            />
          </Form.Group>

          <Form.Group>
            <Form.Label className="small fw-bold text-muted">
              TEAM HEAD (FROM CORE TEAM) - Optional
            </Form.Label>
            <div className="d-flex gap-2 align-items-center">
              <Form.Select
                style={{
                  backgroundColor: "var(--bg-main)",
                  color: "var(--text-primary)",
                  borderColor: "var(--border-color)",
                }}
                value={selectedTeamHead || ""}
                onChange={(e) => {
                  setSelectedTeamHead(e.target.value || null);
                  if (e.target.value) {
                    setManualTeamHead("");
                  }
                }}
              >
                <option value="">-- Select from Core Team --</option>
                {coreTeamMembers.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name} ({member.designation || "Member"})
                  </option>
                ))}
              </Form.Select>
              <Button
                type="button"
                variant="outline-primary"
                onClick={handleAddHeadToList}
                title="Add Team Head"
                className="d-flex align-items-center justify-content-center"
                style={{ width: "38px", height: "38px", padding: 0 }}
              >
                <i className="bi bi-plus-lg"></i>
              </Button>
            </div>
          </Form.Group>

          {!selectedTeamHead && (
            <Form.Group>
              <Form.Label className="small fw-bold text-muted">
                ADD EVENT-WISE TEAM HEAD - Optional
              </Form.Label>
              <div className="d-flex gap-2 align-items-center">
                <Form.Control
                  placeholder="e.g. Student Name"
                  className="form-control"
                  style={{
                    backgroundColor: "var(--bg-main)",
                    color: "var(--text-primary)",
                    borderColor: "var(--border-color)",
                  }}
                  value={manualTeamHead}
                  onChange={(e) => setManualTeamHead(e.target.value)}
                />
                <Button
                  type="button"
                  variant="outline-primary"
                  onClick={handleAddHeadToList}
                  title="Add Team Head"
                  className="d-flex align-items-center justify-content-center"
                  style={{ width: "38px", height: "38px", padding: 0 }}
                >
                  <i className="bi bi-plus-lg"></i>
                </Button>
              </div>
              <small className="text-muted d-block mt-1">
                Use this if Team Head is not in Core Team
              </small>
            </Form.Group>
          )}

          {pendingTeamHeads.length > 0 && (
            <div>
              <Form.Label className="small fw-bold text-muted mb-2 d-block">
                SELECTED TEAM HEADS
              </Form.Label>
              <div className="d-flex flex-wrap gap-2">
                {pendingTeamHeads.map((head, idx) => (
                  <Badge
                    key={`${head.name}-${idx}`}
                    bg="primary"
                    className="d-flex align-items-center gap-2"
                  >
                    <span>{head.name}</span>
                    <Button
                      type="button"
                      variant="link"
                      className="p-0 text-white text-decoration-none"
                      onClick={() => removePendingHead(idx)}
                      style={{ lineHeight: 1 }}
                    >
                      <i className="bi bi-x-lg"></i>
                    </Button>
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer className="border-0 p-3 pt-0">
          <Button
            variant="primary"
            onClick={handleCreateTeam}
            className="w-100"
          >
            {isEditingTeam ? "Update Team" : "Create Team"}
          </Button>
        </Modal.Footer>
      </div>
    </Modal>
  );
}
