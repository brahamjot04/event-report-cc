import { useEffect, useMemo, useState } from "react";
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDoc,
} from "firebase/firestore";
import { db } from "../../firebase";
import { Table, Button, Modal, Form, Dropdown } from "react-bootstrap";
import readXlsxFile from "read-excel-file";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const DEFAULT_FIELDS = ["name", "designation", "department"];
const BASE_FIELD_LABELS = {
  name: "Name",
  designation: "Designation",
  department: "Department",
  phone: "Phone",
  email: "Email",
};

const normalizeFieldKey = (value = "") =>
  value
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s_]/g, "")
    .replace(/\s+/g, "_");

const toTitleCase = (value = "") =>
  value
    .toString()
    .replace(/_/g, " ")
    .replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.slice(1));

export default function EventTeachers({ eventId, goBack, eventTitle }) {
  const [teachers, setTeachers] = useState([]);
  const [selectedFields, setSelectedFields] = useState(DEFAULT_FIELDS);
  const [customFields, setCustomFields] = useState([]);
  const [customFieldLabels, setCustomFieldLabels] = useState({});

  const [showTeacherModal, setShowTeacherModal] = useState(false);
  const [editingTeacherId, setEditingTeacherId] = useState(null);
  const [editingTeacher, setEditingTeacher] = useState(null);
  const [teacherForm, setTeacherForm] = useState({});
  const [newCustomFieldLabel, setNewCustomFieldLabel] = useState("");

  useEffect(() => {
    fetchTeachers();
    fetchFieldConfiguration();
  }, [eventId]);

  const availableFields = useMemo(
    () => [...new Set([...Object.keys(BASE_FIELD_LABELS), ...customFields])],
    [customFields],
  );

  const getFieldLabel = (fieldKey) =>
    customFieldLabels[fieldKey] ||
    BASE_FIELD_LABELS[fieldKey] ||
    toTitleCase(fieldKey);

  const persistFieldConfiguration = async (
    nextSelectedFields,
    nextCustomFields,
    nextCustomFieldLabels,
  ) => {
    await updateDoc(doc(db, "events", eventId), {
      teacherSelectedFields: nextSelectedFields,
      teacherCustomFields: nextCustomFields,
      teacherCustomFieldLabels: nextCustomFieldLabels,
    });
  };

  const fetchFieldConfiguration = async () => {
    const eventRef = doc(db, "events", eventId);
    const eventSnap = await getDoc(eventRef);
    if (!eventSnap.exists()) return;

    const data = eventSnap.data();
    const savedSelected = Array.isArray(data.teacherSelectedFields)
      ? data.teacherSelectedFields
          .map((f) => normalizeFieldKey(f))
          .filter(Boolean)
      : [];
    const savedCustom = Array.isArray(data.teacherCustomFields)
      ? data.teacherCustomFields
          .map((f) => normalizeFieldKey(f))
          .filter(Boolean)
      : [];
    const savedCustomLabels =
      data.teacherCustomFieldLabels &&
      typeof data.teacherCustomFieldLabels === "object"
        ? data.teacherCustomFieldLabels
        : {};

    setSelectedFields(
      savedSelected.length > 0 ? savedSelected : DEFAULT_FIELDS,
    );
    setCustomFields(savedCustom);
    setCustomFieldLabels(savedCustomLabels);
  };

  const fetchTeachers = async () => {
    const querySnapshot = await getDocs(
      collection(db, "events", eventId, "teachers"),
    );
    setTeachers(querySnapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
  };

  const openAddTeacherModal = () => {
    const initialForm = {};
    selectedFields.forEach((field) => {
      initialForm[field] = "";
    });
    setEditingTeacherId(null);
    setEditingTeacher(null);
    setTeacherForm(initialForm);
    setShowTeacherModal(true);
  };

  const openEditTeacherModal = (teacher) => {
    const formData = {};
    selectedFields.forEach((field) => {
      formData[field] = teacher[field] || "";
    });
    setEditingTeacherId(teacher.id);
    setEditingTeacher(teacher);
    setTeacherForm(formData);
    setShowTeacherModal(true);
  };

  const handleSaveTeacher = async () => {
    const payload = editingTeacher ? { ...editingTeacher } : {};
    delete payload.id;

    selectedFields.forEach((field) => {
      payload[field] = (teacherForm[field] || "").toString().trim();
    });

    if (editingTeacherId) {
      await updateDoc(
        doc(db, "events", eventId, "teachers", editingTeacherId),
        payload,
      );
    } else {
      await addDoc(collection(db, "events", eventId, "teachers"), payload);
    }

    setShowTeacherModal(false);
    fetchTeachers();
  };

  const handleDeleteTeacher = async (teacherId) => {
    if (!window.confirm("Remove this teacher entry?")) return;
    await deleteDoc(doc(db, "events", eventId, "teachers", teacherId));
    fetchTeachers();
  };

  const handleToggleField = async (fieldKey) => {
    const nextSelected = selectedFields.includes(fieldKey)
      ? selectedFields.filter((f) => f !== fieldKey)
      : [...selectedFields, fieldKey];

    setSelectedFields(nextSelected);
    await persistFieldConfiguration(
      nextSelected,
      customFields,
      customFieldLabels,
    );
  };

  const handleAddCustomField = async () => {
    const label = newCustomFieldLabel.trim();
    if (!label) return;

    const key = normalizeFieldKey(label);
    if (!key) return;
    if (availableFields.includes(key)) {
      alert("Field already exists.");
      return;
    }

    const nextCustomFields = [...customFields, key];
    const nextSelectedFields = [...selectedFields, key];
    const nextCustomFieldLabels = {
      ...customFieldLabels,
      [key]: label,
    };

    setCustomFields(nextCustomFields);
    setSelectedFields(nextSelectedFields);
    setCustomFieldLabels(nextCustomFieldLabels);
    setNewCustomFieldLabel("");

    await persistFieldConfiguration(
      nextSelectedFields,
      nextCustomFields,
      nextCustomFieldLabels,
    );
  };

  const ensureKnownField = async (fieldKey, displayLabel = "") => {
    if (!fieldKey || Object.keys(BASE_FIELD_LABELS).includes(fieldKey)) return;
    if (customFields.includes(fieldKey)) return;

    const nextCustomFields = [...customFields, fieldKey];
    const nextSelectedFields = selectedFields.includes(fieldKey)
      ? selectedFields
      : [...selectedFields, fieldKey];
    const nextCustomFieldLabels = {
      ...customFieldLabels,
      [fieldKey]: displayLabel || toTitleCase(fieldKey),
    };

    setCustomFields(nextCustomFields);
    setSelectedFields(nextSelectedFields);
    setCustomFieldLabels(nextCustomFieldLabels);

    await persistFieldConfiguration(
      nextSelectedFields,
      nextCustomFields,
      nextCustomFieldLabels,
    );
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;

    const rows = await readXlsxFile(file);
    if (!rows || rows.length < 2) return;

    const headerCells = rows[0].map((h) => String(h || "").trim());
    const headerKeys = headerCells.map((h) => normalizeFieldKey(h));
    const knownFieldSet = new Set([
      ...Object.keys(BASE_FIELD_LABELS),
      ...customFields,
    ]);

    const fieldMap = headerKeys.map((key, idx) => {
      if (!key) return null;
      if (knownFieldSet.has(key)) return key;
      return key;
    });

    for (let i = 0; i < fieldMap.length; i += 1) {
      if (
        fieldMap[i] &&
        !Object.keys(BASE_FIELD_LABELS).includes(fieldMap[i])
      ) {
        await ensureKnownField(fieldMap[i], headerCells[i]);
      }
    }

    const docsToAdd = rows
      .slice(1)
      .map((row) => {
        const record = {};
        fieldMap.forEach((fieldKey, idx) => {
          if (!fieldKey) return;
          record[fieldKey] =
            row[idx] !== undefined && row[idx] !== null
              ? String(row[idx]).trim()
              : "";
        });
        return record;
      })
      .filter((entry) =>
        Object.values(entry).some((v) => String(v || "").trim() !== ""),
      );

    if (docsToAdd.length === 0) return;

    await Promise.all(
      docsToAdd.map((payload) =>
        addDoc(collection(db, "events", eventId, "teachers"), payload),
      ),
    );
    await fetchTeachers();
    alert("Teachers imported successfully.");
  };

  const handleExportPDF = () => {
    const docPDF = new jsPDF({ orientation: "landscape" });
    const pageWidth = docPDF.internal.pageSize.getWidth();
    const centerX = pageWidth / 2;

    docPDF.setFont("helvetica", "bold");
    docPDF.setFontSize(14);
    docPDF.text("Guru Nanak Dev Engineering College", centerX, 15, {
      align: "center",
    });
    docPDF.setFontSize(12);
    docPDF.text("Cultural Committee", centerX, 22, { align: "center" });
    docPDF.text(`Teachers Report - ${eventTitle || "Event"}`, centerX, 29, {
      align: "center",
    });

    const head = [
      ["S.No", ...selectedFields.map((field) => getFieldLabel(field))],
    ];
    const body = teachers.map((teacher, index) => [
      index + 1,
      ...selectedFields.map((field) => teacher[field] || "-"),
    ]);

    autoTable(docPDF, {
      head,
      body,
      startY: 38,
      theme: "grid",
      headStyles: {
        fillColor: [41, 128, 185],
        textColor: 255,
        fontStyle: "bold",
      },
      styles: { fontSize: 10, cellPadding: 2 },
    });

    docPDF.save(`${eventTitle || "Event"}_Teachers_Report.pdf`);
  };

  return (
    <>
      <div className="d-flex align-items-center mb-4 gap-3">
        <Button
          variant="outline-secondary"
          className="me-3 rounded-circle shadow-sm"
          style={{
            width: "40px",
            height: "40px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          onClick={goBack}
        >
          <i className="bi bi-arrow-left"></i>
        </Button>

        <div>
          <h3 className="fw-bold mb-0">Event Teachers</h3>
          <p className="text-muted small mb-0">
            {teachers.length} Teacher Entries
          </p>
        </div>

        <div className="ms-auto d-flex gap-2">
          <Button variant="outline-danger" onClick={handleExportPDF}>
            <i className="bi bi-file-earmark-pdf-fill me-2"></i>
            Export PDF
          </Button>

          <div className="d-inline-block">
            <input
              type="file"
              id="teachers-upload"
              hidden
              accept=".xlsx,.xls"
              onChange={handleFileUpload}
            />
            <label
              htmlFor="teachers-upload"
              className="btn btn-success text-white mb-0 d-flex align-items-center"
            >
              <i className="bi bi-file-earmark-spreadsheet-fill me-2"></i>
              Import Excel
            </label>
          </div>

          <Dropdown align="end" autoClose="outside">
            <Dropdown.Toggle variant="outline-primary">
              <i className="bi bi-layout-three-columns me-2"></i>
              Fields
            </Dropdown.Toggle>
            <Dropdown.Menu className="p-3" style={{ minWidth: "280px" }}>
              <div className="fw-semibold mb-2">Select table fields</div>
              {availableFields.map((field) => (
                <Form.Check
                  key={field}
                  type="checkbox"
                  className="mb-2"
                  label={getFieldLabel(field)}
                  checked={selectedFields.includes(field)}
                  onChange={() => handleToggleField(field)}
                />
              ))}

              <hr className="my-2" />
              <div className="small text-muted mb-2">Add custom field</div>
              <div className="d-flex gap-2">
                <Form.Control
                  size="sm"
                  placeholder="e.g. Qualification"
                  value={newCustomFieldLabel}
                  onChange={(e) => setNewCustomFieldLabel(e.target.value)}
                />
                <Button
                  size="sm"
                  variant="primary"
                  onClick={handleAddCustomField}
                >
                  Add
                </Button>
              </div>
            </Dropdown.Menu>
          </Dropdown>

          <Button variant="primary" onClick={openAddTeacherModal}>
            <i className="bi bi-person-plus-fill me-2"></i>
            Add Teacher
          </Button>
        </div>
      </div>

      <div
        className="soft-card p-0 overflow-hidden shadow-sm"
        style={{ height: "fit-content" }}
      >
        <Table hover responsive className="mb-0 align-middle">
          <thead style={{ backgroundColor: "var(--soft-hover)" }}>
            <tr>
              <th
                className="ps-4 py-3 text-secondary text-uppercase small text-start"
                style={{ width: "5%" }}
              >
                #
              </th>
              {selectedFields.map((field) => (
                <th
                  key={field}
                  className="text-secondary text-uppercase small text-start"
                >
                  {getFieldLabel(field)}
                </th>
              ))}
              <th className="text-end pe-4 text-secondary text-uppercase small">
                Action
              </th>
            </tr>
          </thead>
          <tbody>
            {teachers.length === 0 ? (
              <tr>
                <td
                  colSpan={selectedFields.length + 2}
                  className="text-center py-4 text-muted border-0"
                >
                  <i className="bi bi-person-vcard display-4 opacity-25 d-block mb-3 mt-2"></i>
                  No teacher entries yet.
                </td>
              </tr>
            ) : (
              teachers.map((teacher, index) => (
                <tr
                  key={teacher.id}
                  style={{ borderBottom: "1px solid var(--border-color)" }}
                >
                  <td className="ps-4 text-muted text-start">{index + 1}</td>
                  {selectedFields.map((field) => (
                    <td key={field} className="text-start text-muted">
                      {teacher[field] || "-"}
                    </td>
                  ))}
                  <td className="text-end pe-4">
                    <div className="d-flex justify-content-end gap-2">
                      <Button
                        size="sm"
                        variant="light"
                        className="border-0 bg-transparent text-primary p-1"
                        onClick={() => openEditTeacherModal(teacher)}
                      >
                        <i className="bi bi-pencil-fill"></i>
                      </Button>
                      <Button
                        size="sm"
                        variant="light"
                        className="border-0 bg-transparent text-danger p-1"
                        onClick={() => handleDeleteTeacher(teacher.id)}
                      >
                        <i className="bi bi-trash-fill"></i>
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </Table>
      </div>

      <Modal
        show={showTeacherModal}
        onHide={() => setShowTeacherModal(false)}
        centered
      >
        <Modal.Header closeButton>
          <Modal.Title>
            {editingTeacherId ? "Edit Teacher" : "Add Teacher"}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            {selectedFields.map((field) => (
              <Form.Group key={field} className="mb-3">
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
              </Form.Group>
            ))}
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="secondary"
            onClick={() => setShowTeacherModal(false)}
          >
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSaveTeacher}>
            Save
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}
