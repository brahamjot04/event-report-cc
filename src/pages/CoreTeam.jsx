import { useState, useEffect, useCallback } from "react";
import {
  collection,
  getDocs,
  addDoc,
  deleteDoc,
  updateDoc,
  doc,
} from "firebase/firestore";
import { db } from "../firebase";
import {
  Row,
  Col,
  Modal,
  Form,
  Button,
  Spinner,
  Dropdown,
  Image,
} from "react-bootstrap";
import Layout from "../components/Layout";
import { uploadToGitHub, fetchImageFromGitHub } from "../utils/github";
import { useToast } from "../context/ToastContext";
import { useAuth } from "../context/AuthContext";
import { loadWithCache, invalidateCache } from "../utils/dataCache";
import { logAction } from "../utils/logger";

// Custom Toggle for the Three-Dot Menu
const CustomToggle = ({ children, onClick }) => (
  <span
    onClick={(e) => {
      e.preventDefault();
      onClick(e);
    }}
    style={{ cursor: "pointer" }}
    className="text-secondary p-2"
  >
    {children}
  </span>
);

export default function CoreTeam() {
  const { user } = useAuth();
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [imageDataUrls, setImageDataUrls] = useState({});

  const { showSuccess, showError, confirm } = useToast();

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentId, setCurrentId] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);

  const [formData, setFormData] = useState({
    name: "",
    urn: "",
    phone: "",
    branch: "",
    designation: "",
    imageUrl: "",
  });

  const loadMemberImages = useCallback(async (membersList) => {
    const newImageDataUrls = {};

    const imagePromises = membersList.map(async (member) => {
      if (member.imageUrl) {
        try {
          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Timeout")), 10000),
          );

          const dataUrl = await Promise.race([
            fetchImageFromGitHub(member.imageUrl),
            timeoutPromise,
          ]);

          if (dataUrl) {
            newImageDataUrls[member.id] = dataUrl;
          }
        } catch (error) {
          console.error(
            `Error loading image for ${member.name}:`,
            error.message,
          );
        }
      }
    });

    await Promise.all(imagePromises);
    setImageDataUrls(newImageDataUrls);
  }, []);

  const fetchMembers = useCallback(async (forceFresh = false) => {
    if (forceFresh) {
      invalidateCache("global_core_team");
    }
    await loadWithCache(
      "global_core_team",
      async () => {
        const querySnapshot = await getDocs(collection(db, "global_core_team"));
        return querySnapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            initial: data.name ? data.name.charAt(0).toUpperCase() : "?",
          };
        });
      },
      (teamList, isCached) => {
        setMembers(teamList);
        if (isCached) setLoading(false);
        loadMemberImages(teamList);
      },
      (error) => {
        console.error("Error fetching members:", error);
        setLoading(false);
      }
    );
    setLoading(false);
  }, [loadMemberImages]);

  useEffect(() => {
    document.title = "Core Team | CC GNDEC";
    fetchMembers();
  }, [fetchMembers]);

  const handleImageChange = (e) => {
    if (e.target.files[0]) {
      setSelectedImage(e.target.files[0]);
    }
  };

  const handleSubmit = async () => {
    if (!formData.name || !formData.designation) return;

    setLoading(true);
    setIsUploading(true);
    try {
      let uploadedImageUrl = formData.imageUrl;

      // Upload image to GitHub if a new one is selected
      if (selectedImage) {
        const timestamp = new Date().getTime();
        const fileName = `${timestamp}_${selectedImage.name}`;
        // Upload to 'core-team' folder
        uploadedImageUrl = await uploadToGitHub(
          selectedImage,
          fileName,
          "core-team",
        );
        if (!uploadedImageUrl) {
          showError("Image upload failed. Please try again.");
          setLoading(false);
          setIsUploading(false);
          return;
        }
      }

      const memberData = {
        ...formData,
        imageUrl: uploadedImageUrl,
      };

      if (isEditing && currentId) {
        // Update existing
        await updateDoc(doc(db, "global_core_team", currentId), {
          ...memberData,
        });
        showSuccess("Core team member updated.");
        await logAction(
          "EDIT_CORE_TEAM",
          `Updated core team member: ${formData.name} (${formData.designation})`,
          user
        );
      } else {
        // Create new
        await addDoc(collection(db, "global_core_team"), {
          ...memberData,
          createdAt: new Date(),
        });
        showSuccess("Core team member added.");
        await logAction(
          "ADD_CORE_TEAM",
          `Added core team member: ${formData.name} (${formData.designation})`,
          user
        );
      }
      invalidateCache("global_core_team");
      invalidateCache("email_recipients_core_team");
      handleCloseModal();
      await fetchMembers(true); // Refetch members and load images
    } catch (error) {
      console.error("Error saving member:", error);
      showError("Failed to save member: " + error.message);
    } finally {
      setLoading(false);
      setIsUploading(false);
    }
  };

  const handleDeleteMember = async (id) => {
    const member = members.find((m) => m.id === id);
    const confirmed = await confirm({
      title: "Remove Core Team Member",
      message: "Are you sure you want to remove this member?",
      variant: "danger",
      confirmText: "Remove",
    });
    if (confirmed) {
      try {
        await deleteDoc(doc(db, "global_core_team", id));
        invalidateCache("global_core_team");
        invalidateCache("email_recipients_core_team");
        showSuccess("Member removed.");
        await logAction(
          "DELETE_CORE_TEAM",
          `Removed core team member: ${member?.name || id}`,
          user
        );
        await fetchMembers(true);
      } catch (error) {
        console.error("Error deleting member:", error);
        showError("Failed to remove member.");
      }
    }
  };

  const handleEditClick = (member) => {
    setFormData({
      name: member.name || "",
      urn: member.urn || "",
      phone: member.phone || "",
      branch: member.branch || "",
      designation: member.designation || "",
      imageUrl: member.imageUrl || "",
    });
    setCurrentId(member.id);
    setIsEditing(true);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setIsEditing(false);
    setCurrentId(null);
    setSelectedImage(null);
    setFormData({
      name: "",
      urn: "",
      phone: "",
      branch: "",
      designation: "",
      imageUrl: "",
    });
  };

  // Helper styles for dark-mode compatible inputs
  const inputStyle = {
    backgroundColor: "var(--bg-main)",
    color: "var(--text-primary)",
    borderColor: "var(--border-color)",
  };

  if (loading && !showModal && !isUploading)
    return (
      <Layout>
        <div className="vh-100 d-flex justify-content-center align-items-center">
          <Spinner animation="border" variant="primary" />
        </div>
      </Layout>
    );

  return (
    <Layout>
      {/* HEADER */}
      <div className="mb-5">
        <small className="text-muted text-uppercase fw-bold">Management</small>
        <h2 className="fw-bold mt-1">Core Team</h2>
      </div>

      {/* TEAM GRID */}
      <Row className="g-4">
        {/* ADD MEMBER CARD */}
        <Col xs={12} sm={6} md={4} lg={3}>
          <div
            className="soft-card add-card h-100"
            onClick={() => {
              handleCloseModal(); // Reset state
              setShowModal(true);
            }}
            style={{ minHeight: "320px" }}
          >
            <i className="bi bi-person-plus-fill fs-1 mb-3"></i>
            <h6 className="fw-bold">Add Member</h6>
            <small>Click to add new</small>
          </div>
        </Col>

        {members.map((member) => (
          <Col key={member.id} xs={12} sm={6} md={4} lg={3}>
            <div className="soft-card position-relative h-100 d-flex flex-column">
              {/* THREE DOT MENU (Top Right) */}
              <div
                className="position-absolute end-0 p-2"
                style={{ top: "8px", zIndex: 1000 }}
              >
                <Dropdown align="end">
                  <Dropdown.Toggle as={CustomToggle}>
                    <i className="bi bi-three-dots-vertical fs-5"></i>
                  </Dropdown.Toggle>

                  <Dropdown.Menu
                    style={{
                      minWidth: "8rem",
                      backgroundColor: "var(--bg-card)",
                      border: "1px solid var(--border-color)",
                      zIndex: 1001,
                    }}
                  >
                    <Dropdown.Item
                      onClick={() => handleEditClick(member)}
                      style={{
                        backgroundColor: "transparent",
                        color: "var(--text-primary)",
                      }}
                      onMouseEnter={(e) => {
                        e.target.style.backgroundColor = "var(--soft-hover)";
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.backgroundColor = "transparent";
                      }}
                    >
                      <i className="bi bi-pencil me-2 text-primary"></i> Edit
                    </Dropdown.Item>
                    <Dropdown.Item
                      onClick={() => handleDeleteMember(member.id)}
                      style={{
                        backgroundColor: "transparent",
                        color: "var(--text-primary)",
                      }}
                      onMouseEnter={(e) => {
                        e.target.style.backgroundColor = "var(--soft-hover)";
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.backgroundColor = "transparent";
                      }}
                    >
                      <i className="bi bi-trash me-2 text-danger"></i> Delete
                    </Dropdown.Item>
                  </Dropdown.Menu>
                </Dropdown>
              </div>

              {/* Avatar - Displays Image if available, else initial */}
              <div className="avatar-circle text-primary bg-primary-subtle mb-3 mt-2 overflow-hidden position-relative">
                {imageDataUrls[member.id] ? (
                  <Image
                    src={imageDataUrls[member.id]}
                    alt={member.name}
                    className="w-100 h-100 object-fit-cover"
                    style={{ position: "absolute", top: 0, left: 0, zIndex: 2 }}
                    onError={(e) => {
                      console.error("Image failed to render:", member.imageUrl);
                      e.target.style.display = "none";
                    }}
                    onLoad={() => {
                      console.log(
                        "Image rendered successfully for:",
                        member.name,
                      );
                    }}
                  />
                ) : member.imageUrl ? (
                  // Show loading state while image is being fetched
                  <div className="w-100 h-100 d-flex align-items-center justify-content-center">
                    <Spinner animation="border" size="sm" variant="primary" />
                  </div>
                ) : (
                  member.initial
                )}
              </div>

              {/* Main Details */}
              <h5 className="fw-bold mb-1 text-truncate" title={member.name}>
                {member.name}
              </h5>
              <p className="text-primary small fw-bold mb-3">
                {member.designation}
              </p>

              {/* Info Block - Dark Mode Glitch Fixed here */}
              <div
                className="mt-auto text-start rounded p-3 small"
                style={{ backgroundColor: "var(--soft-hover)" }} // Removed bg-light
              >
                <div className="d-flex justify-content-between mb-1">
                  <span className="text-muted">URN:</span>
                  <span className="fw-semibold">{member.urn || "N/A"}</span>
                </div>
                <div className="d-flex justify-content-between mb-1">
                  <span className="text-muted">Branch:</span>
                  <span className="fw-semibold">{member.branch || "N/A"}</span>
                </div>
                <div className="d-flex justify-content-between">
                  <span className="text-muted">Phone:</span>
                  <span className="fw-semibold">{member.phone || "N/A"}</span>
                </div>
              </div>
            </div>
          </Col>
        ))}
      </Row>

      {/* ADD/EDIT MODAL */}
      <Modal show={showModal} onHide={handleCloseModal} centered>
        <div
          style={{
            backgroundColor: "var(--bg-card)",
            color: "var(--text-primary)",
          }}
        >
          <Modal.Header closeButton className="border-0">
            <Modal.Title className="fw-bold">
              {isEditing ? "Edit Member" : "Add Core Member"}
            </Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Form className="d-grid gap-3">
              {/* Image Upload Field */}
              <Form.Group>
                <Form.Label className="text-muted small fw-bold">
                  PROFILE IMAGE
                </Form.Label>
                <Form.Control
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  style={inputStyle}
                />
                {(selectedImage || formData.imageUrl) && (
                  <div className="mt-2">
                    <small className="text-muted">
                      Selected:{" "}
                      {selectedImage ? selectedImage.name : "Current Image"}
                    </small>
                  </div>
                )}
              </Form.Group>

              <Form.Group>
                <Form.Label className="text-muted small fw-bold">
                  STUDENT NAME
                </Form.Label>
                <Form.Control
                  placeholder="e.g. John Doe"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  style={inputStyle}
                />
              </Form.Group>

              <Row>
                <Col>
                  <Form.Group>
                    <Form.Label className="text-muted small fw-bold">
                      URN
                    </Form.Label>
                    <Form.Control
                      placeholder="e.g. 2101234"
                      value={formData.urn}
                      onChange={(e) =>
                        setFormData({ ...formData, urn: e.target.value })
                      }
                      style={inputStyle}
                    />
                  </Form.Group>
                </Col>
                <Col>
                  <Form.Group>
                    <Form.Label className="text-muted small fw-bold">
                      PHONE
                    </Form.Label>
                    <Form.Control
                      placeholder="e.g. 9876543210"
                      value={formData.phone}
                      onChange={(e) =>
                        setFormData({ ...formData, phone: e.target.value })
                      }
                      style={inputStyle}
                    />
                  </Form.Group>
                </Col>
              </Row>

              <Row>
                <Col>
                  <Form.Group>
                    <Form.Label className="text-muted small fw-bold">
                      BRANCH
                    </Form.Label>
                    <Form.Control
                      placeholder="e.g. CSE"
                      value={formData.branch}
                      onChange={(e) =>
                        setFormData({ ...formData, branch: e.target.value })
                      }
                      style={inputStyle}
                    />
                  </Form.Group>
                </Col>
                <Col>
                  <Form.Group>
                    <Form.Label className="text-muted small fw-bold">
                      DESIGNATION
                    </Form.Label>
                    <Form.Control
                      placeholder="e.g. Secretary"
                      value={formData.designation}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          designation: e.target.value,
                        })
                      }
                      style={inputStyle}
                    />
                  </Form.Group>
                </Col>
              </Row>
            </Form>
          </Modal.Body>
          <Modal.Footer className="border-0">
            <Button
              variant="outline-secondary"
              onClick={handleCloseModal}
              disabled={isUploading}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleSubmit}
              disabled={isUploading}
            >
              {isUploading ? (
                <>
                  <Spinner
                    as="span"
                    animation="border"
                    size="sm"
                    role="status"
                    aria-hidden="true"
                    className="me-2"
                  />
                  Uploading...
                </>
              ) : isEditing ? (
                "Update Member"
              ) : (
                "Add Member"
              )}
            </Button>
          </Modal.Footer>
        </div>
      </Modal>
    </Layout>
  );
}
