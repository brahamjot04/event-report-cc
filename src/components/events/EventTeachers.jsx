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
import {
  Table,
  Button,
  Modal,
  Form,
  Dropdown,
  Badge,
  Row,
  Col,
} from "react-bootstrap";
import readXlsxFile from "read-excel-file";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const DEFAULT_FIELDS = ["name", "designation", "department"];
const MANDATORY_FORM_FIELDS = ["incharge"];
const SYSTEM_FIELDS = ["committee", "incharge"];
const BASE_FIELD_LABELS = {
  name: "Name",
  designation: "Designation",
  department: "Department",
  incharge: "Incharge",
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

const normalizeSelectedFieldList = (fields = []) =>
  fields
    .map((field) => normalizeFieldKey(field))
    .filter((field) => field !== "committee")
    .filter(Boolean);

export default function EventTeachers({ eventId, goBack, eventTitle }) {
  const [teachers, setTeachers] = useState([]);
  const [committeeCatalog, setCommitteeCatalog] = useState([]);
  const [selectedFields, setSelectedFields] = useState(DEFAULT_FIELDS);
  const [selectedFieldsByCommittee, setSelectedFieldsByCommittee] = useState(
    {},
  );
  const [customFields, setCustomFields] = useState([]);
  const [customFieldLabels, setCustomFieldLabels] = useState({});

  const [showTeacherModal, setShowTeacherModal] = useState(false);
  const [showCommitteeModal, setShowCommitteeModal] = useState(false);
  const [editingTeacherId, setEditingTeacherId] = useState(null);
  const [editingTeacher, setEditingTeacher] = useState(null);
  const [teacherForm, setTeacherForm] = useState({});
  const [editingCommitteeName, setEditingCommitteeName] = useState("");
  const [newCommitteeName, setNewCommitteeName] = useState("");
  const [newCustomFieldLabel, setNewCustomFieldLabel] = useState("");
  const [committeeMode, setCommitteeMode] = useState("existing");
  const [customCommitteeName, setCustomCommitteeName] = useState("");

  const [activeCommittee, setActiveCommittee] = useState(null);
  const [selectedFilter, setSelectedFilter] = useState(null);

  useEffect(() => {
    fetchTeachers();
    fetchFieldConfiguration();
  }, [eventId]);

  const availableFields = useMemo(
    () => [...new Set([...Object.keys(BASE_FIELD_LABELS), ...customFields])],
    [customFields],
  );

  const activeCommitteeFields = useMemo(() => {
    if (!activeCommittee) return selectedFields;

    const committeeFields = selectedFieldsByCommittee[activeCommittee];
    return Array.isArray(committeeFields) && committeeFields.length > 0
      ? committeeFields
      : selectedFields;
  }, [activeCommittee, selectedFieldsByCommittee, selectedFields]);

  const formFields = useMemo(
    () => [...new Set([...activeCommitteeFields, ...MANDATORY_FORM_FIELDS])],
    [activeCommitteeFields],
  );

  const committeeOptions = useMemo(
    () =>
      [
        ...new Set([
          ...committeeCatalog,
          ...teachers.map((t) => (t.committee || "").toString().trim()),
        ]),
      ]
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b)),
    [teachers, committeeCatalog],
  );

  const groupedTeachers = useMemo(() => {
    const groups = committeeOptions.reduce((acc, committee) => {
      acc[committee] = [];
      return acc;
    }, {});

    teachers.reduce((acc, teacher) => {
      const committee =
        (teacher.committee || "General").toString().trim() || "General";
      if (!acc[committee]) acc[committee] = [];
      acc[committee].push(teacher);
      return acc;
    }, groups);

    return Object.entries(groups)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([committee, members]) => ({
        committee,
        members,
      }));
  }, [teachers, committeeOptions]);

  const filteredCommittees = useMemo(() => {
    if (selectedFilter === null) return groupedTeachers;
    return groupedTeachers.filter((g) => g.committee === selectedFilter);
  }, [groupedTeachers, selectedFilter]);

  const activeCommitteeData = useMemo(
    () =>
      groupedTeachers.find((group) => group.committee === activeCommittee) ||
      null,
    [groupedTeachers, activeCommittee],
  );

  const getFieldLabel = (fieldKey) =>
    customFieldLabels[fieldKey] ||
    BASE_FIELD_LABELS[fieldKey] ||
    toTitleCase(fieldKey);

  const getCommitteeInitials = (committeeName = "") =>
    committeeName
      .split(" ")
      .slice(0, 2)
      .map((word) => word[0]?.toUpperCase() || "")
      .join("") || "CM";

  const getInchargeCount = (members = []) =>
    members.filter((member) => !!member.incharge).length;

  const persistFieldConfiguration = async (
    nextSelectedFields,
    nextCustomFields,
    nextCustomFieldLabels,
    nextSelectedFieldsByCommittee = selectedFieldsByCommittee,
  ) => {
    await updateDoc(doc(db, "events", eventId), {
      teacherSelectedFields: nextSelectedFields,
      teacherCustomFields: nextCustomFields,
      teacherCustomFieldLabels: nextCustomFieldLabels,
      teacherSelectedFieldsByCommittee: nextSelectedFieldsByCommittee,
    });
  };

  const persistCommitteeCatalog = async (nextCommittees) => {
    await updateDoc(doc(db, "events", eventId), {
      teacherCommittees: nextCommittees,
    });
  };

  const fetchFieldConfiguration = async () => {
    const eventRef = doc(db, "events", eventId);
    const eventSnap = await getDoc(eventRef);
    if (!eventSnap.exists()) return;

    const data = eventSnap.data();
    const savedSelected = Array.isArray(data.teacherSelectedFields)
      ? normalizeSelectedFieldList(data.teacherSelectedFields)
      : [];
    const savedCustom = Array.isArray(data.teacherCustomFields)
      ? data.teacherCustomFields
          .map((field) => normalizeFieldKey(field))
          .filter(Boolean)
      : [];
    const savedCustomLabels =
      data.teacherCustomFieldLabels &&
      typeof data.teacherCustomFieldLabels === "object"
        ? data.teacherCustomFieldLabels
        : {};
    const savedCommittees = Array.isArray(data.teacherCommittees)
      ? data.teacherCommittees
          .map((committee) => String(committee || "").trim())
          .filter(Boolean)
      : [];
    const savedSelectedByCommittee =
      data.teacherSelectedFieldsByCommittee &&
      typeof data.teacherSelectedFieldsByCommittee === "object"
        ? Object.entries(data.teacherSelectedFieldsByCommittee).reduce(
            (acc, [committeeName, fields]) => {
              const normalizedCommitteeName = String(
                committeeName || "",
              ).trim();
              const normalizedFields = Array.isArray(fields)
                ? normalizeSelectedFieldList(fields)
                : [];

              if (normalizedCommitteeName && normalizedFields.length > 0) {
                acc[normalizedCommitteeName] = normalizedFields;
              }

              return acc;
            },
            {},
          )
        : {};

    setSelectedFields(
      savedSelected.length > 0 ? savedSelected : DEFAULT_FIELDS,
    );
    setSelectedFieldsByCommittee(savedSelectedByCommittee);
    setCustomFields(savedCustom);
    setCustomFieldLabels(savedCustomLabels);
    setCommitteeCatalog(savedCommittees);
  };

  const fetchTeachers = async () => {
    const querySnapshot = await getDocs(
      collection(db, "events", eventId, "teachers"),
    );
    const mappedTeachers = querySnapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data(),
    }));

    mappedTeachers.sort((a, b) => {
      const aCreated = typeof a.createdAt === "number" ? a.createdAt : null;
      const bCreated = typeof b.createdAt === "number" ? b.createdAt : null;

      if (aCreated === null && bCreated === null) return 0;
      if (aCreated === null) return -1;
      if (bCreated === null) return 1;
      return aCreated - bCreated;
    });

    setTeachers(mappedTeachers);
  };

  const openAddTeacherModal = (committeeName = "") => {
    const initialForm = {};
    formFields.forEach((field) => {
      if (field === "incharge") initialForm[field] = false;
      else initialForm[field] = "";
    });

    initialForm.committee = committeeName;

    setEditingTeacherId(null);
    setEditingTeacher(null);
    setTeacherForm(initialForm);
    setCommitteeMode("existing");
    setCustomCommitteeName("");
    setShowTeacherModal(true);
  };

  const openCreateCommitteeModal = () => {
    const initialForm = {};
    formFields.forEach((field) => {
      if (field === "incharge") initialForm[field] = false;
      else initialForm[field] = "";
    });
    initialForm.committee = "";

    setEditingTeacherId(null);
    setEditingTeacher(null);
    setTeacherForm(initialForm);
    setCommitteeMode("customOnly");
    setCustomCommitteeName("");
    setShowTeacherModal(true);
  };

  const openEditTeacherModal = (teacher) => {
    const formData = {};
    formFields.forEach((field) => {
      if (field === "incharge") formData[field] = !!teacher[field];
      else formData[field] = teacher[field] || "";
    });
    formData.committee = teacher.committee || "";

    setEditingTeacherId(teacher.id);
    setEditingTeacher(teacher);
    setTeacherForm(formData);
    setCommitteeMode("existing");
    setCustomCommitteeName("");
    setShowTeacherModal(true);
  };

  const openEditCommitteeModal = (committeeName) => {
    setEditingCommitteeName(committeeName);
    setNewCommitteeName(committeeName);
    setShowCommitteeModal(true);
  };

  const handleDeleteCommittee = async (committeeName) => {
    if (
      !window.confirm(
        `Delete committee "${committeeName}" and all its members?`,
      )
    ) {
      return;
    }

    const targetGroup = groupedTeachers.find(
      (group) => group.committee === committeeName,
    );

    if (targetGroup && targetGroup.members.length > 0) {
      await Promise.all(
        targetGroup.members.map((teacher) =>
          deleteDoc(doc(db, "events", eventId, "teachers", teacher.id)),
        ),
      );
    }

    const updatedCatalog = committeeCatalog.filter(
      (committee) => committee.toLowerCase() !== committeeName.toLowerCase(),
    );

    const nextSelectedFieldsByCommittee = Object.fromEntries(
      Object.entries(selectedFieldsByCommittee).filter(
        ([committee]) =>
          committee.toLowerCase() !== committeeName.toLowerCase(),
      ),
    );

    setCommitteeCatalog(updatedCatalog);
    setSelectedFieldsByCommittee(nextSelectedFieldsByCommittee);
    await persistCommitteeCatalog(updatedCatalog);
    await persistFieldConfiguration(
      selectedFields,
      customFields,
      customFieldLabels,
      nextSelectedFieldsByCommittee,
    );

    if (activeCommittee === committeeName) setActiveCommittee(null);
    if (selectedFilter === committeeName) setSelectedFilter(null);

    await fetchTeachers();
  };

  const handleSaveCommitteeName = async () => {
    const nextCommitteeName = newCommitteeName.trim();
    if (!nextCommitteeName) return;

    const oldName = editingCommitteeName;
    if (nextCommitteeName === oldName) {
      setShowCommitteeModal(false);
      return;
    }

    const exists = groupedTeachers.some(
      (group) =>
        group.committee.toLowerCase() === nextCommitteeName.toLowerCase() &&
        group.committee.toLowerCase() !== oldName.toLowerCase(),
    );

    if (exists) {
      alert("A committee with this name already exists.");
      return;
    }

    const targetGroup = groupedTeachers.find(
      (group) => group.committee === oldName,
    );
    if (!targetGroup) {
      setShowCommitteeModal(false);
      return;
    }

    await Promise.all(
      targetGroup.members.map((teacher) =>
        updateDoc(doc(db, "events", eventId, "teachers", teacher.id), {
          committee: nextCommitteeName,
        }),
      ),
    );

    const updatedCatalog = committeeCatalog
      .map((committee) =>
        committee.toLowerCase() === oldName.toLowerCase()
          ? nextCommitteeName
          : committee,
      )
      .filter(
        (committee, index, self) =>
          self.findIndex(
            (value) => value.toLowerCase() === committee.toLowerCase(),
          ) === index,
      );

    const matchedCommitteeKey = Object.keys(selectedFieldsByCommittee).find(
      (committee) => committee.toLowerCase() === oldName.toLowerCase(),
    );
    const nextSelectedFieldsByCommittee = { ...selectedFieldsByCommittee };

    if (matchedCommitteeKey) {
      nextSelectedFieldsByCommittee[nextCommitteeName] =
        nextSelectedFieldsByCommittee[matchedCommitteeKey];
      delete nextSelectedFieldsByCommittee[matchedCommitteeKey];
    }

    setCommitteeCatalog(updatedCatalog);
    setSelectedFieldsByCommittee(nextSelectedFieldsByCommittee);
    await persistCommitteeCatalog(updatedCatalog);
    await persistFieldConfiguration(
      selectedFields,
      customFields,
      customFieldLabels,
      nextSelectedFieldsByCommittee,
    );

    if (activeCommittee === oldName) setActiveCommittee(nextCommitteeName);
    if (selectedFilter === oldName) setSelectedFilter(nextCommitteeName);

    setShowCommitteeModal(false);
    setEditingCommitteeName("");
    setNewCommitteeName("");
    await fetchTeachers();
  };

  const handleSaveTeacher = async () => {
    if (committeeMode === "customOnly") {
      const createdCommitteeName = customCommitteeName.trim();
      if (!createdCommitteeName) {
        alert("Please enter a committee name.");
        return;
      }

      const exists = committeeOptions.some(
        (committee) =>
          committee.toLowerCase() === createdCommitteeName.toLowerCase(),
      );
      if (exists) {
        alert("A committee with this name already exists.");
        return;
      }

      const updatedCatalog = [...committeeCatalog, createdCommitteeName].sort(
        (a, b) => a.localeCompare(b),
      );
      setCommitteeCatalog(updatedCatalog);
      await persistCommitteeCatalog(updatedCatalog);

      setTeacherForm((prev) => ({ ...prev, committee: createdCommitteeName }));
      setCommitteeMode("existing");
      setCustomCommitteeName("");
      setShowTeacherModal(false);
      return;
    }

    const payload = editingTeacher ? { ...editingTeacher } : {};
    delete payload.id;

    const resolvedCommittee =
      committeeMode === "customWithTeacher"
        ? customCommitteeName.trim()
        : (teacherForm.committee || "").toString().trim();

    if (!resolvedCommittee) {
      alert("Please select or add a committee name.");
      return;
    }

    if (
      !committeeCatalog.some(
        (committee) =>
          committee.toLowerCase() === resolvedCommittee.toLowerCase(),
      )
    ) {
      const updatedCatalog = [...committeeCatalog, resolvedCommittee].sort(
        (a, b) => a.localeCompare(b),
      );
      setCommitteeCatalog(updatedCatalog);
      await persistCommitteeCatalog(updatedCatalog);
    }

    payload.committee = resolvedCommittee;

    formFields.forEach((field) => {
      if (field === "incharge") payload[field] = !!teacherForm[field];
      else payload[field] = (teacherForm[field] || "").toString().trim();
    });

    if (editingTeacherId) {
      await updateDoc(
        doc(db, "events", eventId, "teachers", editingTeacherId),
        payload,
      );
    } else {
      payload.createdAt = Date.now();
      await addDoc(collection(db, "events", eventId, "teachers"), payload);
    }

    setShowTeacherModal(false);
    await fetchTeachers();
  };

  const handleDeleteTeacher = async (teacherId) => {
    if (!window.confirm("Remove this teacher entry?")) return;
    await deleteDoc(doc(db, "events", eventId, "teachers", teacherId));
    await fetchTeachers();
  };

  const handleToggleField = async (fieldKey) => {
    if (fieldKey === "committee") return;

    if (activeCommittee) {
      const currentCommitteeFields =
        selectedFieldsByCommittee[activeCommittee] || selectedFields;
      const nextCommitteeSelected = currentCommitteeFields.includes(fieldKey)
        ? currentCommitteeFields.filter((field) => field !== fieldKey)
        : [...currentCommitteeFields, fieldKey];
      const nextSelectedFieldsByCommittee = {
        ...selectedFieldsByCommittee,
        [activeCommittee]: nextCommitteeSelected,
      };

      setSelectedFieldsByCommittee(nextSelectedFieldsByCommittee);
      await persistFieldConfiguration(
        selectedFields,
        customFields,
        customFieldLabels,
        nextSelectedFieldsByCommittee,
      );
      return;
    }

    const nextSelected = selectedFields.includes(fieldKey)
      ? selectedFields.filter((field) => field !== fieldKey)
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
    const nextSelectedFieldsByCommittee = { ...selectedFieldsByCommittee };
    const nextSelectedFields = activeCommittee
      ? selectedFields
      : [...selectedFields, key];

    if (activeCommittee) {
      const currentCommitteeFields =
        selectedFieldsByCommittee[activeCommittee] || selectedFields;
      nextSelectedFieldsByCommittee[activeCommittee] = [
        ...currentCommitteeFields,
        key,
      ];
    }

    const nextCustomFieldLabels = {
      ...customFieldLabels,
      [key]: label,
    };

    setCustomFields(nextCustomFields);
    setSelectedFields(nextSelectedFields);
    setSelectedFieldsByCommittee(nextSelectedFieldsByCommittee);
    setCustomFieldLabels(nextCustomFieldLabels);
    setNewCustomFieldLabel("");

    await persistFieldConfiguration(
      nextSelectedFields,
      nextCustomFields,
      nextCustomFieldLabels,
      nextSelectedFieldsByCommittee,
    );
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    const rows = await readXlsxFile(file);
    if (!rows || rows.length < 2) return;

    const headerCells = rows[0].map((value) => String(value || "").trim());
    const headerKeys = headerCells.map((header) => normalizeFieldKey(header));
    const knownFieldSet = new Set([
      ...Object.keys(BASE_FIELD_LABELS),
      ...SYSTEM_FIELDS,
      ...customFields,
    ]);

    const fieldMap = headerKeys.map((key) => (key ? key : null));

    const unknownFields = [];
    for (let index = 0; index < fieldMap.length; index += 1) {
      if (
        fieldMap[index] &&
        !Object.keys(BASE_FIELD_LABELS).includes(fieldMap[index]) &&
        !SYSTEM_FIELDS.includes(fieldMap[index]) &&
        !knownFieldSet.has(fieldMap[index])
      ) {
        unknownFields.push({ key: fieldMap[index], label: headerCells[index] });
      }
    }

    if (unknownFields.length > 0) {
      const uniqueUnknown = unknownFields.filter(
        (item, index, self) =>
          self.findIndex((x) => x.key === item.key) === index,
      );

      const nextCustomFields = [
        ...customFields,
        ...uniqueUnknown.map((item) => item.key),
      ];
      const nextSelectedFieldsByCommittee = { ...selectedFieldsByCommittee };
      const nextSelectedFields = activeCommittee
        ? selectedFields
        : [
            ...selectedFields,
            ...uniqueUnknown
              .map((item) => item.key)
              .filter((key) => !selectedFields.includes(key)),
          ];

      if (activeCommittee) {
        const currentCommitteeFields =
          selectedFieldsByCommittee[activeCommittee] || selectedFields;
        nextSelectedFieldsByCommittee[activeCommittee] = [
          ...currentCommitteeFields,
          ...uniqueUnknown
            .map((item) => item.key)
            .filter((key) => !currentCommitteeFields.includes(key)),
        ];
      }

      const nextCustomFieldLabels = { ...customFieldLabels };
      uniqueUnknown.forEach((item) => {
        nextCustomFieldLabels[item.key] = item.label || toTitleCase(item.key);
      });

      setCustomFields(nextCustomFields);
      setSelectedFields(nextSelectedFields);
      setSelectedFieldsByCommittee(nextSelectedFieldsByCommittee);
      setCustomFieldLabels(nextCustomFieldLabels);

      await persistFieldConfiguration(
        nextSelectedFields,
        nextCustomFields,
        nextCustomFieldLabels,
        nextSelectedFieldsByCommittee,
      );
    }

    const docsToAdd = rows
      .slice(1)
      .map((row, rowIndex) => {
        const record = {};
        fieldMap.forEach((fieldKey, index) => {
          if (!fieldKey) return;
          if (fieldKey === "incharge") {
            const raw =
              row[index] !== undefined && row[index] !== null
                ? String(row[index]).trim().toLowerCase()
                : "";
            record[fieldKey] = [
              "yes",
              "true",
              "1",
              "y",
              "incharge",
              "in-charge",
            ].includes(raw);
          } else {
            record[fieldKey] =
              row[index] !== undefined && row[index] !== null
                ? String(row[index]).trim()
                : "";
          }
        });
        record.createdAt = Date.now() + rowIndex;
        return record;
      })
      .filter((entry) =>
        Object.values(entry).some((value) => String(value || "").trim() !== ""),
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

    const exportCommittee = activeCommittee || selectedFilter || null;
    const exportFields = exportCommittee
      ? selectedFieldsByCommittee[exportCommittee] || selectedFields
      : selectedFields;
    const exportTeachers = exportCommittee
      ? teachers.filter(
          (teacher) =>
            ((teacher.committee || "General").toString().trim() ||
              "General") === exportCommittee,
        )
      : [...teachers];

    if (exportTeachers.length === 0) {
      alert("No teachers available for export.");
      return;
    }

    docPDF.setFont("helvetica", "bold");
    docPDF.setFontSize(14);
    docPDF.text("Guru Nanak Dev Engineering College", centerX, 15, {
      align: "center",
    });
    docPDF.setFontSize(12);
    docPDF.text("Cultural Committee", centerX, 22, { align: "center" });
    docPDF.text(
      `Teachers Report - ${eventTitle || "Event"}${
        exportCommittee ? ` (${exportCommittee})` : ""
      }`,
      centerX,
      29,
      {
        align: "center",
      },
    );

    const head = [
      ["S.No", ...exportFields.map((field) => getFieldLabel(field))],
    ];
    const body = exportTeachers.map((teacher, index) => [
      index + 1,
      ...exportFields.map((field) => {
        if (field === "incharge") return teacher[field] ? "Yes" : "No";
        return teacher[field] || "-";
      }),
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
      {activeCommitteeData ? (
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
              onClick={() => setActiveCommittee(null)}
            >
              <i className="bi bi-arrow-left"></i>
            </Button>

            <div>
              <h3 className="fw-bold mb-0">{activeCommitteeData.committee}</h3>
              <p className="text-muted small mb-0">
                {activeCommitteeData.members.length} Members •{" "}
                {getInchargeCount(activeCommitteeData.members)} Incharge
              </p>
            </div>

            <div className="ms-auto d-flex gap-2">
              <Dropdown align="end" autoClose="outside">
                <Dropdown.Toggle variant="outline-primary" size="sm">
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
                      checked={activeCommitteeFields.includes(field)}
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

              <Button
                variant="primary"
                onClick={() =>
                  openAddTeacherModal(activeCommitteeData.committee)
                }
                className="d-flex align-items-center gap-2"
              >
                <i className="bi bi-person-plus-fill"></i>
                <span className="d-none d-md-inline">Add Teacher</span>
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
                  {activeCommitteeFields.map((field) => (
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
                {activeCommitteeData.members.length === 0 ? (
                  <tr>
                    <td
                      colSpan={activeCommitteeFields.length + 2}
                      className="text-center py-4 text-muted border-0"
                    >
                      <i className="bi bi-person-vcard display-4 opacity-25 d-block mb-3 mt-2"></i>
                      No teachers in this committee yet.
                    </td>
                  </tr>
                ) : (
                  activeCommitteeData.members.map((teacher, index) => (
                    <tr
                      key={teacher.id}
                      style={{ borderBottom: "1px solid var(--border-color)" }}
                    >
                      <td className="ps-4 text-muted text-start">
                        {index + 1}
                      </td>
                      {activeCommitteeFields.map((field) => (
                        <td key={field} className="text-start text-muted">
                          {field === "name" ? (
                            <>
                              {teacher[field] || "-"}
                              {teacher.incharge && (
                                <Badge
                                  bg="light"
                                  text="dark"
                                  className="border fw-normal ms-2"
                                >
                                  Incharge
                                </Badge>
                              )}
                            </>
                          ) : field === "incharge" ? (
                            teacher.incharge ? (
                              "Yes"
                            ) : (
                              "No"
                            )
                          ) : (
                            teacher[field] || "-"
                          )}
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
        </>
      ) : (
        <>
          <div className="d-flex align-items-center mb-4">
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
              <h3 className="fw-bold mb-0">Organizing Teachers</h3>
              <p className="text-muted small mb-0">
                Manage committees and members • {groupedTeachers.length}{" "}
                Committees • {teachers.length} Total Teachers
              </p>
            </div>
            <div className="ms-auto d-flex gap-2">
              <Button
                variant="outline-danger"
                onClick={handleExportPDF}
                size="sm"
                className="d-flex align-items-center"
              >
                <i className="bi bi-file-earmark-pdf me-2"></i>Export Report
              </Button>
              <Button
                variant="primary"
                size="sm"
                className="d-flex align-items-center"
                onClick={() => openAddTeacherModal("")}
              >
                <i className="bi bi-person-plus-fill me-2"></i>Add Teacher
              </Button>
            </div>
          </div>

          <div className="mb-4 d-flex flex-wrap gap-2 align-items-center">
            <span className="text-muted small fw-bold me-2">Filter by:</span>
            <Button
              size="sm"
              variant={
                selectedFilter === null ? "primary" : "outline-secondary"
              }
              className="rounded-pill"
              onClick={() => setSelectedFilter(null)}
            >
              All Committees
            </Button>
            {groupedTeachers.map((group) => (
              <Button
                key={group.committee}
                size="sm"
                variant={
                  selectedFilter === group.committee
                    ? "primary"
                    : "outline-secondary"
                }
                className="rounded-pill"
                onClick={() => setSelectedFilter(group.committee)}
              >
                {group.committee}
              </Button>
            ))}
          </div>

          <Row className="g-4">
            <Col md={6} lg={4}>
              <div
                className="h-100 d-flex flex-column align-items-center justify-content-center text-center p-4"
                style={{
                  border: "2px dashed var(--border-dashed)",
                  borderRadius: "16px",
                  cursor: "pointer",
                  minHeight: "180px",
                  color: "var(--text-muted)",
                  backgroundColor: "transparent",
                }}
                onClick={openCreateCommitteeModal}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "#0d6efd";
                  e.currentTarget.style.color = "#0d6efd";
                  e.currentTarget.style.backgroundColor =
                    "rgba(13, 110, 253, 0.05)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "var(--border-dashed)";
                  e.currentTarget.style.color = "var(--text-muted)";
                  e.currentTarget.style.backgroundColor = "transparent";
                }}
              >
                <div
                  className="avatar-circle mb-3"
                  style={{
                    width: "50px",
                    height: "50px",
                    backgroundColor: "var(--soft-hover)",
                    color: "inherit",
                  }}
                >
                  <i className="bi bi-plus-lg fs-4"></i>
                </div>
                <h6 className="fw-bold mb-1">Create New Committee</h6>
                <small>Add committee or group</small>
              </div>
            </Col>

            {filteredCommittees.map((group) => (
              <Col md={6} lg={4} key={group.committee}>
                <div
                  className="soft-card h-100 d-flex flex-column position-relative"
                  style={{ minHeight: "180px", cursor: "pointer" }}
                  onClick={() => setActiveCommittee(group.committee)}
                >
                  <div className="position-absolute top-0 end-0 p-3">
                    <Dropdown onClick={(e) => e.stopPropagation()}>
                      <Dropdown.Toggle
                        variant="link"
                        className="text-muted p-0 no-caret"
                      >
                        <i className="bi bi-three-dots"></i>
                      </Dropdown.Toggle>
                      <Dropdown.Menu align="end">
                        <Dropdown.Item
                          className="text-primary"
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditCommitteeModal(group.committee);
                          }}
                        >
                          <i className="bi bi-pencil-square me-2"></i>Edit
                          Committee
                        </Dropdown.Item>
                        <Dropdown.Item
                          className="text-primary"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveCommittee(group.committee);
                          }}
                        >
                          <i className="bi bi-pencil me-2"></i>Manage Committee
                        </Dropdown.Item>
                        <Dropdown.Item
                          className="text-danger"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteCommittee(group.committee);
                          }}
                        >
                          <i className="bi bi-trash me-2"></i>Delete Committee
                        </Dropdown.Item>
                      </Dropdown.Menu>
                    </Dropdown>
                  </div>

                  <div className="d-flex align-items-center mb-3 mt-2">
                    <div
                      className="avatar-circle me-3 flex-shrink-0"
                      style={{
                        width: "50px",
                        height: "50px",
                        fontSize: "1.2rem",
                        backgroundColor: "var(--soft-hover)",
                        color: "var(--text-primary)",
                      }}
                    >
                      {getCommitteeInitials(group.committee)}
                    </div>
                    <div className="text-start">
                      <h5
                        className="fw-bold mb-1 text-truncate"
                        style={{ maxWidth: "180px" }}
                      >
                        {group.committee}
                      </h5>
                      <Badge
                        bg="primary"
                        className="bg-opacity-25 text-primary fw-normal border border-primary"
                      >
                        {group.members.length} Members
                      </Badge>
                      <Badge
                        bg="secondary"
                        className="ms-2 bg-opacity-25 text-secondary fw-normal border border-secondary"
                      >
                        {getInchargeCount(group.members)} Incharge
                      </Badge>
                    </div>
                  </div>

                  <div
                    className="mt-auto pt-3 border-top d-flex align-items-center justify-content-between"
                    style={{ borderColor: "var(--border-color)" }}
                  >
                    <div className="d-flex align-items-center">
                      <div className="d-flex ms-2">
                        {[1, 2, 3].map((index) => (
                          <div
                            key={index}
                            className="rounded-circle border border-white d-flex align-items-center justify-content-center text-white small"
                            style={{
                              width: "24px",
                              height: "24px",
                              marginLeft: "-8px",
                              backgroundColor: "#adb5bd",
                              fontSize: "0.6rem",
                            }}
                          >
                            <i className="bi bi-person-fill"></i>
                          </div>
                        ))}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      className="soft-open-btn rounded-pill px-3"
                    >
                      Manage <i className="bi bi-arrow-right ms-1"></i>
                    </Button>
                  </div>
                </div>
              </Col>
            ))}

            {filteredCommittees.length === 0 && (
              <Col xs={12}>
                <div
                  className="text-center p-5"
                  style={{
                    backgroundColor: "var(--soft-hover)",
                    borderRadius: "12px",
                    border: "1px solid var(--border-color)",
                  }}
                >
                  <i className="bi bi-people display-4 opacity-25 d-block mb-3"></i>
                  <p className="text-muted mb-0">
                    {selectedFilter
                      ? "No committee selected or committee not found"
                      : "No committees created yet"}
                  </p>
                </div>
              </Col>
            )}
          </Row>
        </>
      )}

      <Modal
        show={showTeacherModal}
        onHide={() => setShowTeacherModal(false)}
        centered
      >
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
            {committeeMode !== "customOnly" ? (
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
            ) : (
              <></>
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
          <Button
            variant="secondary"
            onClick={() => setShowTeacherModal(false)}
          >
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSaveTeacher}>
            {committeeMode === "customOnly" ? "Create Committee" : "Save"}
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal
        show={showCommitteeModal}
        onHide={() => setShowCommitteeModal(false)}
        centered
      >
        <Modal.Header closeButton>
          <Modal.Title>Edit Committee</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form.Group>
            <Form.Label>Committee Name</Form.Label>
            <Form.Control
              type="text"
              value={newCommitteeName}
              onChange={(e) => setNewCommitteeName(e.target.value)}
              placeholder="Enter committee name"
            />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="secondary"
            onClick={() => setShowCommitteeModal(false)}
          >
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSaveCommitteeName}>
            Update Committee
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}
