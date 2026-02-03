import { Routes, Route } from "react-router-dom";
import Login from "./pages/Login";
import Home from "./pages/Home";
import EventDetails from "./pages/EventDetails";
import Users from "./pages/Users"; 
import NotFound from "./pages/NotFound"; // <--- Import the new page
import 'bootstrap/dist/css/bootstrap.min.css';

function App() {
  return (
    <Routes>
      {/* Public Route */}
      <Route path="/login" element={<Login />} />
      
      {/* Protected Routes */}
      <Route path="/" element={<Home />} />
      <Route path="/event/:id" element={<EventDetails />} />
      <Route path="/users" element={<Users />} />
      
      {/* 404 Catch-All Route (Must be last) */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

export default App;