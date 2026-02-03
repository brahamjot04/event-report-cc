// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCF_-t-uGCwdX8ee_01T5qHv9nQX3HfxQw",
  authDomain: "event-report-cc.firebaseapp.com",
  projectId: "event-report-cc",
  storageBucket: "event-report-cc.firebasestorage.app",
  messagingSenderId: "1069208650480",
  appId: "1:1069208650480:web:0e2765c0804db227b3f835"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

const db = getFirestore(app);
const auth = getAuth(app);

export { db, auth };