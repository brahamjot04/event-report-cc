// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, GoogleAuthProvider } from "firebase/auth"; 

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyCF_-t-uGCwdX8ee_01T5qHv9nQX3HfxQw",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "event-report-cc.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "event-report-cc",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "event-report-cc.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "1069208650480",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:1069208650480:web:0e2765c0804db227b3f835"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const googleProvider = new GoogleAuthProvider();
const db = getFirestore(app);
const auth = getAuth(app);

export { db, auth, googleProvider };