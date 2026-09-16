import { addDoc, collection } from "firebase/firestore";
import { db } from "../firebase";
import { getAuth } from "firebase/auth";
import { invalidateCache } from "./dataCache";

export const logAction = async (actionType, description, customUser = null) => {
  const auth = getAuth();
  const user = customUser || auth.currentUser;

  try {
    await addDoc(collection(db, "logs"), {
      action: actionType,
      description: description,
      performedBy: user?.displayName || user?.name || user?.email?.split("@")[0] || "User",
      email: user?.email || "system@gndec.ac.in",
      role: user?.role || "user",
      timestamp: new Date(),
    });
    invalidateCache("system_activity_logs");
  } catch (error) {
    console.error("Logging failed:", error);
  }
};