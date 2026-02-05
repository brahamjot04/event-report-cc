import { Routes, Route } from "react-router-dom";
import Login from "./pages/Login";
import Home from "./pages/Home";
import EventDetails from "./pages/EventDetails";
import Users from "./pages/Users";
import Profile from "./pages/Profile";
import Calendar from "./pages/Calendar"; 
import Email from "./pages/Email";
import Logs from "./pages/Logs"; 
import NotFound from "./pages/NotFound";
import 'bootstrap/dist/css/bootstrap.min.css';

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      {/* Protected Routes */}
      <Route path="/" element={<Home />} />
      <Route path="/event/:id" element={<EventDetails />} />
      <Route path="/users" element={<Users />} />
      <Route path="/profile" element={<Profile />} />
      <Route path="/calendar" element={<Calendar />} />
      <Route path="/email" element={<Email />} />
      <Route path="/logs" element={<Logs />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

export default App;