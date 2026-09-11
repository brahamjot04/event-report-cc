import { addDoc, collection } from "firebase/firestore";
import { db } from "../firebase";
import { getAuth } from "firebase/auth";
import { invalidateCache } from "./dataCache";

export const logAction = async (actionType, description) => {
  const auth = getAuth();
  const user = auth.currentUser;

  try {
    await addDoc(collection(db, "logs"), {
      action: actionType,
      description: description,
      performedBy: user?.displayName || user?.email?.split("@")[0] || "Admin",
      email: user?.email || "system@gndec.ac.in",
      role: "admin",
      timestamp: new Date(),
    });
    invalidateCache("system_activity_logs");
  } catch (error) {
    console.error("Logging failed:", error);
  }
};