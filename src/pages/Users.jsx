import { useState, useEffect } from "react";
import { collection, getDocs, doc, updateDoc, getDoc } from "firebase/firestore";
import { auth, db } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { Table, Button, Badge, Card, Spinner } from "react-bootstrap";
import Layout from "../components/Layout";

export default function Users() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // 1. Security Check (Layout handles Name, we just check Role)
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) { navigate("/login"); return; }
      
      const userDoc = await getDoc(doc(db, "users", user.uid));
      if (userDoc.exists()) {
        if (userDoc.data().role !== 'super_admin') {
            alert("Access Denied: Super Admin only.");
            navigate("/");
        }
      }
    });
    return () => unsubscribe();
  }, [navigate]);

  // 2. Fetch Users
  const fetchUsers = async () => {
    try {
      const snap = await getDocs(collection(db, "users"));
      setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    } catch (error) { console.error(error); }
  };

  useEffect(() => { fetchUsers(); }, []);

  const updateStatus = async (userId, newStatus, newRole) => {
    await updateDoc(doc(db, "users", userId), { status: newStatus, role: newRole });
    fetchUsers();
  };

  if (loading) return <div className="p-5 text-center"><Spinner animation="border" variant="primary" /></div>;

  const pendingUsers = users.filter(u => u.status === 'pending');
  const activeUsers = users.filter(u => u.status !== 'pending');

  return (
    <Layout>
      <div className="mb-4">
         <h3 className="fw-bold text-dark mb-0">User Management</h3>
         <p className="text-muted small">Manage system access and roles</p>
      </div>

      {/* PENDING REQUESTS */}
      {pendingUsers.length > 0 && (
        <Card className="border-0 shadow-sm mb-4">
          <Card.Header className="bg-warning bg-opacity-10 border-0 p-3">
             <div className="d-flex align-items-center text-warning fw-bold">
                <i className="bi bi-exclamation-triangle-fill me-2 fs-5"></i>
                Pending Approvals ({pendingUsers.length})
             </div>
          </Card.Header>
          <Card.Body className="p-0">
             <Table responsive hover className="mb-0 align-middle">
               <thead className="bg-light text-muted small text-uppercase">
                 <tr>
                   <th className="ps-4">Full Name</th><th>Email</th><th>Date</th><th className="text-end pe-4">Decision</th>
                 </tr>
               </thead>
               <tbody>
                 {pendingUsers.map(user => (
                   <tr key={user.id}>
                     <td className="ps-4 fw-bold">{user.name}</td>
                     <td>{user.email}</td>
                     <td className="text-muted small">{user.createdAt?.seconds ? new Date(user.createdAt.seconds * 1000).toLocaleDateString() : 'Today'}</td>
                     <td className="text-end pe-4">
                        <Button variant="success" size="sm" className="me-2 fw-bold" onClick={() => updateStatus(user.id, 'approved', 'admin')}>Make Admin</Button>
                        <Button variant="outline-primary" size="sm" className="fw-bold" onClick={() => updateStatus(user.id, 'approved', 'user')}>Viewer</Button>
                     </td>
                   </tr>
                 ))}
               </tbody>
             </Table>
          </Card.Body>
        </Card>
      )}

      {/* ALL USERS */}
      <Card className="border-0 shadow-sm">
        <Card.Header className="bg-white py-3"><h6 className="mb-0 fw-bold">All System Users</h6></Card.Header>
        <Card.Body className="p-0">
          <Table responsive hover className="mb-0 align-middle">
            <thead className="bg-light text-muted small text-uppercase">
              <tr><th className="ps-4 py-3">User</th><th>Role</th><th>Status</th><th className="text-end pe-4">Actions</th></tr>
            </thead>
            <tbody>
              {activeUsers.map(user => (
                <tr key={user.id}>
                  <td className="ps-4">
                    <div className="d-flex align-items-center">
                        <div className="bg-primary bg-opacity-10 text-primary rounded-circle d-flex align-items-center justify-content-center me-3 fw-bold" style={{width: 40, height: 40}}>
                            {user.name?.charAt(0).toUpperCase()}
                        </div>
                        <div><div className="fw-bold text-dark">{user.name}</div><div className="small text-muted">{user.email}</div></div>
                    </div>
                  </td>
                  <td>
                    <Badge bg={user.role === 'super_admin' ? 'danger' : user.role === 'admin' ? 'primary' : 'secondary'} className="px-2 py-1 fw-normal">
                        {user.role === 'super_admin' ? 'SUPER ADMIN' : user.role.toUpperCase()}
                    </Badge>
                  </td>
                  <td><Badge bg="success" className="rounded-pill px-2 fw-normal bg-opacity-75">Active</Badge></td>
                  <td className="text-end pe-4">
                    {user.role !== 'super_admin' && (
                        <Button variant="link" className="text-danger p-0 text-decoration-none small fw-bold" onClick={() => updateStatus(user.id, 'pending', 'user')}>Revoke Access</Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card.Body>
      </Card>
    </Layout>
  );
}