import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyADzxqmEKZ4g66Uupj48Rqh2vvfBz-wiM8",
  authDomain: "konata-58ec3.firebaseapp.com",
  projectId: "konata-58ec3",
  storageBucket: "konata-58ec3.firebasestorage.app",
  messagingSenderId: "400619209610",
  appId: "1:400619209610:web:00599103c95d31f3b6be73",
  measurementId: "G-19RDGLCE7Z"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
