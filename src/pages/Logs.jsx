import { useState, useEffect } from "react";
import {
  collection,
  getDocs,
  query,
  orderBy,
  limit,
} from "firebase/firestore";
import { db } from "../firebase";
import { Table, Card, Badge, Spinner, Form, InputGroup } from "react-bootstrap";
import Layout from "../components/Layout";

export default function Logs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    try {
      const q = query(
        collection(db, "logs"),
        orderBy("timestamp", "desc"),
        limit(100),
      );
      const snap = await getDocs(q);
      setLogs(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    } catch (error) {
      console.error("Error fetching logs:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredLogs = logs.filter(
    (log) =>
      log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (log.email && log.email.toLowerCase().includes(searchTerm.toLowerCase())),
  );

  const getBadgeColor = (action) => {
    if (action.includes("DELETE")) return "danger";
    if (action.includes("CREATE") || action.includes("ADD")) return "success";
    if (action.includes("UPDATE") || action.includes("EDIT")) return "warning";
    return "secondary";
  };

  // Render layout immediately and show loading state inside the page

  return (
    <Layout>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h3 className="fw-bold mb-0">System Activity Logs</h3>
          <p className="text-muted small">
            Audit trail of all actions performed in the portal
          </p>
        </div>
        <div style={{ width: "300px" }}>
          <InputGroup>
            <InputGroup.Text
              style={{ backgroundColor: "var(--soft-hover)", borderRight: 0 }}
            >
              <i className="bi bi-search"></i>
            </InputGroup.Text>
            <Form.Control
              placeholder="Search logs..."
              style={{
                backgroundColor: "var(--bg-main)",
                color: "var(--text-primary)",
                borderLeft: 0,
                borderColor: "var(--border-color)",
              }}
              className="ps-0"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </InputGroup>
        </div>
      </div>
      <Card
        className="shadow-sm"
        style={{
          backgroundColor: "var(--bg-card)",
          border: "1px solid var(--border-color)",
        }}
      >
        <Card.Body className="p-0">
          {loading ? (
            <div className="p-5 text-center">
              <Spinner animation="border" variant="primary" />
            </div>
          ) : (
            <Table hover responsive className="mb-0 align-middle">
              <thead
                style={{ backgroundColor: "var(--soft-hover)" }}
                className="small text-uppercase"
              >
                <tr>
                  <th className="ps-4">Time</th>
                  <th>Action</th>
                  <th>Description</th>
                  <th>User Name</th>
                  <th>User Email</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map((log) => (
                  <tr key={log.id}>
                    <td className="ps-4 text-nowrap small text-body-secondary">
                      {log.timestamp?.seconds
                        ? new Date(
                            log.timestamp.seconds * 1000,
                          ).toLocaleString()
                        : "Just now"}
                    </td>
                    <td>
                      <Badge
                        bg={getBadgeColor(log.action)}
                        className="fw-normal"
                      >
                        {log.action}
                      </Badge>
                    </td>
                    <td className="fw-bold text-body">{log.description}</td>
                    <td className="text-body">
                      <div className="d-flex align-items-center">
                        <div
                          className="bg-primary bg-opacity-10 text-primary rounded-circle d-flex align-items-center justify-content-center me-2 fw-bold"
                          style={{ width: 30, height: 30, fontSize: "0.8rem" }}
                        >
                          {log.performedBy?.charAt(0).toUpperCase() || "U"}
                        </div>
                        {log.performedBy}
                      </div>
                    </td>
                    <td className="text-primary small">{log.email || "N/A"}</td>
                  </tr>
                ))}
                {filteredLogs.length === 0 && (
                  <tr>
                    <td colSpan="5" className="text-center p-5 text-muted">
                      No logs found.
                    </td>
                  </tr>
                )}
              </tbody>
            </Table>
          )}
        </Card.Body>
      </Card>
    </Layout>
  );
}
