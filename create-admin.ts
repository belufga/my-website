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
    const fakeEmail = "Konataizumi@konata.local";
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
        displayName: "Konata Izumi"
    });

    await setDoc(doc(db, 'users', userCredential.user.uid), {
        username: "@Konataizumi",
        displayName: "Konata Izumi",
        fakeEmail: fakeEmail,
        createdAt: new Date().toISOString(),
        spyMode: true,
        antiLimit: true
    }, { merge: true });
    
    console.log("User document updated.");
    console.log("Email: " + fakeEmail);
    console.log("Password: " + password);
    console.log("Username: @Konataizumi");
    process.exit(0);
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}
run();
