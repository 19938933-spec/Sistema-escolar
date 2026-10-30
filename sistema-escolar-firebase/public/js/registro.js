import { 
    auth, 
    db, 
    createUserWithEmailAndPassword, 
    doc, 
    setDoc 
} from './firebase-config.js';

const CODIGO_SEGURIDAD = "CLASES26$COED";

function showToast(msg, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return alert(msg);

    const toast = document.createElement('div');
    toast.className = `custom-toast ${type}`;
    toast.innerHTML = `<i class="bi bi-${type === 'error' ? 'x-circle-fill' : 'check-circle-fill'} me-2"></i> ${msg}`;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
}

function resetBtnUI(btn, text, loader) {
    if (btn) btn.disabled = false;
    if (text) text.classList.remove('d-none');
    if (loader) loader.classList.add('d-none');
}

const formRegistro = document.getElementById('formRegistro');
if (formRegistro) {
    formRegistro.addEventListener('submit', async (e) => {
        e.preventDefault();

        const nombres = document.getElementById('nombres').value.trim();
        const apellidos = document.getElementById('apellidos').value.trim();
        const usuario = document.getElementById('usuario').value.trim().toLowerCase();
        const correo = document.getElementById('correo').value.trim();
        const contrasena = document.getElementById('contrasena').value;
        const confirmarContrasena = document.getElementById('confirmarContrasena').value;
        const codigo = document.getElementById('codigoSeguridad').value.trim();

        // Validaciones previas
        if (codigo !== CODIGO_SEGURIDAD) {
            showToast('Código de seguridad incorrecto', 'error');
            return;
        }

        if (!correo.endsWith('@clases.edu.sv')) {
            showToast('El correo debe terminar en @clases.edu.sv', 'error');
            return;
        }

        if (contrasena !== confirmarContrasena) {
            showToast('Las contraseñas no coinciden', 'error');
            return;
        }

        // Animación de carga en botón
        const btn = document.getElementById('btnSubmit');
        const btnText = document.getElementById('btnText');
        const btnLoader = document.getElementById('btnLoader');
        btn.disabled = true;
        btnText.classList.add('d-none');
        btnLoader.classList.remove('d-none');

        try {
            // 1. Crear usuario en Firebase Authentication
            const userCredential = await createUserWithEmailAndPassword(auth, correo, contrasena);
            const user = userCredential.user;

            // 2. Guardar perfil completo del docente en Firestore
            await setDoc(doc(db, 'usuarios', user.uid), {
                uid: user.uid,
                nombres: nombres,
                apellidos: apellidos,
                nombreCompleto: `${nombres} ${apellidos}`,
                usuario: usuario,
                correo: correo,
                rol: 'docente',
                perfilConfigurado: false,
                gradoEncargado: null,
                materiasImpartidas: [],
                activo: true,
                fechaRegistro: new Date().toISOString()
            });

            showToast('¡Cuenta creada exitosamente! Redirigiendo...', 'success');

            setTimeout(() => {
                window.location.href = 'index.html';
            }, 2000);

        } catch (error) {
            console.error("Error al registrar docente:", error);

            let msg = "Error al crear la cuenta";
            if (error.code === 'auth/email-already-in-use') {
                msg = "Ese correo ya está registrado";
            } else if (error.code === 'auth/weak-password') {
                msg = "La contraseña debe tener al menos 6 caracteres";
            } else if (error.code === 'auth/operation-not-allowed') {
                msg = "Habilita el método 'Correo/Contraseña' en Firebase Console";
            } else if (error.code === 'permission-denied') {
                msg = "Permiso denegado en Firestore. Revisa las Reglas de la base de datos";
            }

            showToast(msg, 'error');
            resetBtnUI(btn, btnText, btnLoader);
        }
    });
}
