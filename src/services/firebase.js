// src/services/firebase.js
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// TODO: Replace this object with your actual Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyB7ecW4IVRdcRBi2HFNVsJ4Zd6L-rYoCfw",
  authDomain: "pos-billing-jaffer.firebaseapp.com",
  projectId: "pos-billing-jaffer",
  storageBucket: "pos-billing-jaffer.firebasestorage.app",
  messagingSenderId: "569069661860",
  appId: "1:569069661860:web:fc0c122097c5ce7b848031"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Export Auth and Database for use in other files
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);