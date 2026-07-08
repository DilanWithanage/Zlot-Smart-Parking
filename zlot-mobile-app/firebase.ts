import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyBIERh65Ak1cBBCHVIhzD_HDaltWPbTc2s",
  authDomain: "zlot-parking-4c375.firebaseapp.com",
  projectId: "zlot-parking-4c375",
  storageBucket: "zlot-parking-4c375.firebasestorage.app",
  messagingSenderId: "681266293592",
  appId: "1:681266293592:web:339d4fb9da43596db1d32d",
  measurementId: "G-K7HMNJ41X6"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);