import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getAnalytics } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyDmubxCYCcxue_ynR4SqLefxb9jrRvRZzg",
  authDomain: "my-daily-journal-762ee.firebaseapp.com",
  projectId: "my-daily-journal-762ee",
  storageBucket: "my-daily-journal-762ee.firebasestorage.app",
  messagingSenderId: "104880107002",
  appId: "1:104880107002:web:cf0b2524a7242a2b720843",
  measurementId: "G-S70Y08S911"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app, "gs://my-daily-journal-762ee.firebasestorage.app");
export const googleProvider = new GoogleAuthProvider();
export const analytics = typeof window !== 'undefined' ? getAnalytics(app) : null;
export default app;
