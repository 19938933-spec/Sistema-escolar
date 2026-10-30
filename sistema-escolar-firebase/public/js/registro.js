import { 
    auth, 
    db, 
    createUserWithEmailAndPassword, 
    doc, 
    setDoc 
} from './firebase-config.js';

const registroForm = document.getElementById('registroForm');

if (registroForm) {
    registroForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const nombre = document.getElementById('inputNombre').value.trim();
        const correo = document.getElementById('inputCorreo').value.trim();
        const pass = document.getElementById('inputPass').value;
        const rol = document.getElementById('selectRol') ? document.getElementById('selectRol').value : 'docente';

        try {
            // 1. Crear usuario en Authentication
            const userCredential = await createUserWithEmailAndPassword(auth, correo, pass);
            const user = userCredential.user;

            // 2. Guardar datos en la base de datos Firestore (Colección 'usuarios')
            await setDoc(doc(db, 'usuarios', user.uid), {
                uid: user.uid,
                nombre: nombre,
                correo: correo,
                rol: rol,
                activo: true,
                perfilConfigurado: false,
                fechaCreacion: new Date().toISOString()
            });

            alert('Usuario registrado exitosamente en la base de datos');
            window.location.href = 'index.html';

        } catch (error) {
            console.error("Error al guardar en Firestore:", error);
            alert("Error al guardar registro: " + error.message);
        }
    });
}
