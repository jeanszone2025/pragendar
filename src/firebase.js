import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth"; // ADICIONADO
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyCWFrcEYq6aL-J7dvL-u9poWywDO5WnIgA",
  authDomain: "pragendar-6222f.firebaseapp.com",
  projectId: "pragendar-6222f",
  storageBucket: "pragendar-6222f.firebasestorage.app",
  messagingSenderId: "452462951656",
  appId: "1:452462951656:web:221463b3e7cae0ddde9d5d"
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app); // ADICIONADO
export const storage = getStorage(app);
