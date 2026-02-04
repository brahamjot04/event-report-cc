import { Routes, Route } from "react-router-dom";
import Login from "./pages/Login";
import Home from "./pages/Home";
import EventDetails from "./pages/EventDetails";
import Users from "./pages/Users";
import Profile from "./pages/Profile"; // <--- Import this
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
      <Route path="/profile" element={<Profile />} /> {/* <--- Add this Route */}
      
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

export default App;