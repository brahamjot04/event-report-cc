import { Modal, Form, Button } from "react-bootstrap";

export default function TeacherModal({
  show,
  onHide,
  committeeMode,
  setCommitteeMode,
  editingTeacherId,
  teacherForm,
  setTeacherForm,
  committeeOptions,
  customCommitteeName,
  setCustomCommitteeName,
  formFields,
  getFieldLabel,
  handleSaveTeacher,
}) {
  return (
    <Modal show={show} onHide={onHide} centered>
      <Modal.Header closeButton>
        <Modal.Title>
          {committeeMode === "customOnly"
            ? "Add New Committee"
            : editingTeacherId
              ? "Edit Teacher"
              : "Add Teacher"}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Form>
          {committeeMode !== "customOnly" && (
            <Form.Group className="mb-3">
              <Form.Label>Committee Name</Form.Label>
              <Form.Select
                value={teacherForm.committee || ""}
                onChange={(e) => {
                  if (e.target.value === "__custom__") {
                    setCommitteeMode("customWithTeacher");
                    setTeacherForm((prev) => ({ ...prev, committee: "" }));
                    return;
                  }

                  setCommitteeMode("existing");
                  setTeacherForm((prev) => ({
                    ...prev,
                    committee: e.target.value,
                  }));
                }}
              >
                <option value="">Select committee</option>
                {committeeOptions.map((committee) => (
                  <option key={committee} value={committee}>
                    {committee}
                  </option>
                ))}
                <option value="__custom__">+ Add New Committee</option>
              </Form.Select>
            </Form.Group>
          )}

          {(committeeMode === "customWithTeacher" ||
            committeeMode === "customOnly") && (
            <Form.Group className="mb-3">
              <Form.Label>New Committee Name</Form.Label>
              <Form.Control
                type="text"
                placeholder="Enter new committee name"
                value={customCommitteeName}
                onChange={(e) => setCustomCommitteeName(e.target.value)}
              />
            </Form.Group>
          )}

          {committeeMode !== "customOnly" &&
            formFields.map((field) => (
              <Form.Group key={field} className="mb-3">
                {field === "incharge" ? (
                  <Form.Check
                    type="checkbox"
                    label={getFieldLabel(field)}
                    checked={!!teacherForm[field]}
                    onChange={(e) =>
                      setTeacherForm((prev) => ({
                        ...prev,
                        [field]: e.target.checked,
                      }))
                    }
                  />
                ) : (
                  <>
                    <Form.Label>{getFieldLabel(field)}</Form.Label>
                    <Form.Control
                      type={field === "email" ? "email" : "text"}
                      value={teacherForm[field] || ""}
                      onChange={(e) =>
                        setTeacherForm((prev) => ({
                          ...prev,
                          [field]: e.target.value,
                        }))
                      }
                    />
                  </>
                )}
              </Form.Group>
            ))}
        </Form>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onHide}>
          Cancel
        </Button>
        <Button variant="primary" onClick={handleSaveTeacher}>
          {committeeMode === "customOnly" ? "Create Committee" : "Save"}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
