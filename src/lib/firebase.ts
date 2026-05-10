import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyBn3N7Tf7j-dYeApf13wcBidjaYVIRrXck",
  authDomain: "konatachat.firebaseapp.com",
  projectId: "konatachat",
  storageBucket: "konatachat.firebasestorage.app",
  messagingSenderId: "812486956824",
  appId: "1:812486956824:web:52db98d7bc6a08f0bb706d",
  measurementId: "G-WHH7H9QMGZ"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
