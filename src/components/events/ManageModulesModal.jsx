import { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { Modal, Button, Form, Badge, Alert, Spinner } from "react-bootstrap";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../../firebase";
import { invalidateCache } from "../../utils/dataCache";
import { logAction } from "../../utils/logger";
import { getApplicableModules } from "../../utils/moduleRegistry";

export default function ManageModulesModal({
  show,
  onHide,
  eventId,
  eventData,
  onModulesUpdated,
  user,
  showSuccess,
  showError,
}) {
  const [disabledSet, setDisabledSet] = useState(new Set());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (show && eventData) {
      setDisabledSet(new Set(eventData.disabledModules || []));
    }
  }, [show, eventData]);

  const applicableModules = getApplicableModules(eventData);

  const handleToggle = (moduleId) => {
    setDisabledSet((prev) => {
      const next = new Set(prev);
      if (next.has(moduleId)) {
        next.delete(moduleId);
      } else {
        next.add(moduleId);
      }
      return next;
    });
  };

  const handleEnableAll = () => {
    setDisabledSet(new Set());
  };

  const handleSave = async () => {
    if (!eventId || saving) return;
    setSaving(true);
    try {
      const newDisabledList = Array.from(disabledSet);
      await updateDoc(doc(db, "events", eventId), {
        disabledModules: newDisabledList,
        updatedAt: new Date(),
      });

      invalidateCache(`event_details_${eventId}`);
      invalidateCache("all_events_list");

      await logAction(
        "UPDATE_EVENT_MODULES",
        `Updated active modules for "${eventData?.title || "Event"}" (${applicableModules.length - newDisabledList.length}/${applicableModules.length} active)`,
        user
      );

      if (onModulesUpdated) {
        onModulesUpdated(newDisabledList);
      }

      showSuccess("Module settings updated successfully.");
      onHide();
    } catch (err) {
      console.error("Error saving module settings:", err);
      showError("Failed to update module settings: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const enabledCount = applicableModules.length - disabledSet.size;

  // Group modules by category
  const categories = {};
  applicableModules.forEach((mod) => {
    const cat = mod.category || "General";
    if (!categories[cat]) categories[cat] = [];
    categories[cat].push(mod);
  });

  return (
    <Modal show={show} onHide={onHide} size="lg" centered scrollable>
      <div
        className="soft-card border-0"
        style={{
          backgroundColor: "var(--bg-card)",
          color: "var(--text-primary)",
        }}
      >
        <Modal.Header closeButton className="border-0 pb-0">
          <div>
            <Modal.Title className="fw-bold fs-5">
              <i className="bi bi-toggles2 text-primary me-2"></i>
              Manage Event Modules
            </Modal.Title>
            <p className="text-muted small mb-0 mt-1">
              Choose which modules appear on the dashboard for this event.
            </p>
          </div>
        </Modal.Header>

        <Modal.Body className="pt-3">
          <Alert
            variant="info"
            className="py-2 px-3 small d-flex align-items-center gap-2 mb-3"
            style={{
              backgroundColor: "var(--soft-hover)",
              borderColor: "var(--border-color)",
              color: "var(--text-primary)",
            }}
          >
            <i className="bi bi-info-circle-fill text-primary flex-shrink-0 fs-5"></i>
            <div>
              <strong>Data is always preserved:</strong> Disabling a module only
              hides its card from the dashboard. Any existing data in the
              background remains safe and will immediately reappear when re-enabled.
            </div>
          </Alert>

          <div className="d-flex justify-content-between align-items-center mb-3">
            <div>
              <span className="text-muted small me-2">Active Modules:</span>
              <Badge
                bg={enabledCount > 0 ? "primary" : "secondary"}
                className="rounded-pill px-3 py-1"
              >
                {enabledCount} of {applicableModules.length} Active
              </Badge>
            </div>
            {disabledSet.size > 0 && (
              <Button
                variant="outline-primary"
                size="sm"
                className="rounded-pill py-0 px-3 small"
                style={{ fontSize: "12px" }}
                onClick={handleEnableAll}
              >
                <i className="bi bi-check-all me-1"></i> Enable All
              </Button>
            )}
          </div>

          <div
            className="rounded border p-2"
            style={{
              backgroundColor: "var(--bg-main)",
              borderColor: "var(--border-color)",
              maxHeight: "380px",
              overflowY: "auto",
            }}
          >
            {Object.keys(categories).map((catName) => (
              <div key={catName} className="mb-3">
                <div className="small fw-bold text-muted text-uppercase px-2 mb-2">
                  {catName} Modules
                </div>
                {categories[catName].map((mod) => {
                  const isEnabled = !disabledSet.has(mod.id);
                  return (
                    <div
                      key={mod.id}
                      className={`d-flex align-items-center justify-content-between p-3 rounded mb-2 transition-all ${
                        isEnabled ? "bg-card shadow-xs" : "opacity-75"
                      }`}
                      style={{
                        backgroundColor: "var(--bg-card)",
                        border: "1px solid var(--border-color)",
                        cursor: "pointer",
                      }}
                      onClick={() => handleToggle(mod.id)}
                    >
                      <div className="d-flex align-items-center gap-3">
                        <div
                          className={`rounded-circle d-flex align-items-center justify-content-center bg-${mod.colorClass}-subtle text-${mod.colorClass}`}
                          style={{ width: "40px", height: "40px", flexShrink: 0 }}
                        >
                          <i className={`bi ${mod.icon} fs-5`}></i>
                        </div>
                        <div>
                          <div className="fw-semibold text-body d-flex align-items-center gap-2">
                            <span>{mod.title}</span>
                            {isEnabled ? (
                              <Badge
                                bg="success"
                                className="bg-opacity-10 text-success rounded-pill px-2 py-0"
                                style={{ fontSize: "11px" }}
                              >
                                Active
                              </Badge>
                            ) : (
                              <Badge
                                bg="secondary"
                                className="bg-opacity-10 text-secondary rounded-pill px-2 py-0"
                                style={{ fontSize: "11px" }}
                              >
                                Disabled
                              </Badge>
                            )}
                          </div>
                          <div className="text-muted small">{mod.subtitle}</div>
                        </div>
                      </div>

                      <Form.Check
                        type="switch"
                        id={`module-switch-${mod.id}`}
                        checked={isEnabled}
                        onChange={() => handleToggle(mod.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="ms-3 fs-5 mb-0"
                      />
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </Modal.Body>

        <Modal.Footer className="border-0 pt-0">
          <Button
            variant="secondary"
            className="rounded-pill px-4"
            onClick={onHide}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            className="rounded-pill px-4"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? (
              <>
                <Spinner animation="border" size="sm" className="me-2" />
                Saving...
              </>
            ) : (
              "Save Changes"
            )}
          </Button>
        </Modal.Footer>
      </div>
    </Modal>
  );
}

ManageModulesModal.propTypes = {
  show: PropTypes.bool.isRequired,
  onHide: PropTypes.func.isRequired,
  eventId: PropTypes.string.isRequired,
  eventData: PropTypes.object,
  onModulesUpdated: PropTypes.func,
  user: PropTypes.object,
  showSuccess: PropTypes.func.isRequired,
  showError: PropTypes.func.isRequired,
};
