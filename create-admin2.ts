import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { getFirestore, doc, setDoc } from 'firebase/firestore';

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
const auth = getAuth(app);
const db = getFirestore(app);

async function run() {
  try {
    const fakeEmail = "KonataSecret@konata.local";
    const password = "password123";
    
    let userCredential;
    try {
        console.log("Trying to login...");
        userCredential = await signInWithEmailAndPassword(auth, fakeEmail, password);
        console.log("Logged in successfully:", userCredential.user.uid);
    } catch (e) {
        console.log("Login failed, trying to create user...");
        userCredential = await createUserWithEmailAndPassword(auth, fakeEmail, password);
        console.log("User created:", userCredential.user.uid);
    }

    await updateProfile(userCredential.user, {
        displayName: "Konata (Secret Admin)"
    });

    await setDoc(doc(db, 'users', userCredential.user.uid), {
        username: "@KonataSecret",
        displayName: "Konata (Secret Admin)",
        fakeEmail: fakeEmail,
        createdAt: new Date().toISOString(),
        spyMode: true,
        antiLimit: true
    }, { merge: true });
    
    console.log("User document updated.");
    console.log("Username: @KonataSecret");
    console.log("Password: " + password);
    process.exit(0);
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}
run();
