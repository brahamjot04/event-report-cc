import { Routes, Route } from "react-router-dom";
import Login from "./pages/Login";
import Home from "./pages/Home";
import EventDetails from "./pages/EventDetails";
import Users from "./pages/Users"; 
import 'bootstrap/dist/css/bootstrap.min.css'; // Ensure CSS is imported here

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<Home />} />
      <Route path="/event/:id" element={<EventDetails />} />
      <Route path="/users" element={<Users />} />
    </Routes>
  );
}

export default App;