// src/utils/logger.js
import { db } from '../services/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

export const logAction = async (userEmail, action, details) => {
  try {
    await addDoc(collection(db, 'logs'), {
      user: userEmail || 'System',
      action: action,
      details: details,
      timestamp: serverTimestamp(),
    });
  } catch (error) {
    console.error("Failed to create log:", error);
  }
};