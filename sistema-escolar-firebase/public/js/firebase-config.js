import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
    getAuth, 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword,
    GoogleAuthProvider, 
    signInWithPopup, 
    signOut 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { 
    getFirestore, 
    doc, 
    getDoc, 
    setDoc, 
    addDoc, 
    collection 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyCw67F3rEOSH5RaibMeE0gkLFbn9363opM",
    authDomain: "educontrol-6c5aa.firebaseapp.com",
    projectId: "educontrol-6c5aa",
    storageBucket: "educontrol-6c5aa.firebasestorage.app",
    messagingSenderId: "86350226997",
    appId: "1:86350226997:web:b2104fd545d71faef9337c"
};

// Inicializar instancias
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();

// Exportar métodos comunes de Firebase
export { 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword,
    signInWithPopup, 
    signOut, 
    doc, 
    getDoc, 
    setDoc, 
    addDoc, 
    collection 
};
