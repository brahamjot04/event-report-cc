import { addDoc, collection } from "firebase/firestore";
import { db } from "../firebase";
import { getAuth } from "firebase/auth";

export const logAction = async (actionType, description) => {
  const auth = getAuth();
  const user = auth.currentUser;

  if (!user) return; 

  try {
    await addDoc(collection(db, "logs"), {
      action: actionType,       
      description: description, 
      performedBy: user.displayName || "Unknown User",
      email: user.email, // <--- THIS LINE IS CRITICAL
      role: "admin", 
      timestamp: new Date()
    });
  } catch (error) {
    console.error("Logging failed:", error);
  }
};