import { 
    auth, 
    db, 
    googleProvider, 
    signInWithEmailAndPassword, 
    signInWithPopup, 
    signOut, 
    doc, 
    getDoc 
} from './firebase-config.js';

const CODIGO_SEGURIDAD = "CLASES26$COED";

// 1. Pantalla de Carga (Loading Screen)
window.addEventListener('load', () => {
    setTimeout(() => {
        const loadingScreen = document.getElementById('loadingScreen');
        if (loadingScreen) {
            loadingScreen.style.opacity = '0';
            setTimeout(() => {
                loadingScreen.style.display = 'none';
            }, 500);
        }
    }, 1200);
});

// 2. Función para Notificaciones Toast
function showToast(msg, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `custom-toast ${type}`;
    const icon = type === 'error' ? 'x-circle-fill' : (type === 'success' ? 'check-circle-fill' : 'info-circle-fill');
    toast.innerHTML = `<i class="bi bi-${icon}"></i> <span>${msg}</span>`;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 4500);
}

// Restablecer estado del botón de envío
function resetBtnUI(btn, text, loader) {
    if (btn) btn.disabled = false;
    if (text) text.classList.remove('d-none');
    if (loader) loader.classList.add('d-none');
}

// 3. Autenticación con Formulario Tradicional
const loginForm = document.getElementById('loginForm');
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const rawUser = document.getElementById('inputUser').value.trim();
        const pass = document.getElementById('inputPass').value;
        const code = document.getElementById('inputCode').value.trim();

        // Validaciones previas
        if (!rawUser || !pass || !code) {
            showToast('Completa todos los campos', 'error');
            return;
        }

        if (code !== CODIGO_SEGURIDAD) {
            showToast('Código de seguridad incorrecto', 'error');
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
            // Formatear usuario a correo institucional si no incluyó dominio
            let email = rawUser;
            if (!rawUser.includes('@')) {
                email = `${rawUser}@clases.edu.sv`;
            } else {
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(rawUser)) {
                    showToast('El formato del correo no es válido', 'error');
                    resetBtnUI(btn, btnText, btnLoader);
                    return;
                }
            }

            // Iniciar sesión en Firebase Auth
            const userCredential = await signInWithEmailAndPassword(auth, email, pass);
            const user = userCredential.user;

            // Verificar si el usuario existe en Firestore
            const userDoc = await getDoc(doc(db, 'usuarios', user.uid));

            if (userDoc.exists()) {
                const data = userDoc.data();

                if (data.activo === false) {
                    await signOut(auth);
                    showToast('Tu cuenta está desactivada. Contacta al administrador.', 'error');
                    resetBtnUI(btn, btnText, btnLoader);
                    return;
                }

                // Guardar datos de sesión local
                localStorage.setItem('usuario', JSON.stringify({
                    uid: user.uid,
                    nombre: data.nombre || data.nombreCompleto || 'Usuario',
                    correo: data.correo || email,
                    rol: data.rol,
                    grado: data.gradoEncargado || data.grado || '',
                    usuario: data.usuario || rawUser.split('@')[0],
                    perfilConfigurado: data.perfilConfigurado
                }));

                showToast(`Bienvenido, ${data.nombre || data.usuario || 'Usuario'}`, 'success');

                // Redirección por Rol
                setTimeout(() => {
                    if (data.rol === 'admin') {
                        window.location.href = 'admin.html';
                    } else if (data.rol === 'docente') {
                        if (data.perfilConfigurado === false) {
                            window.location.href = 'configurar-perfil.html';
                        } else {
                            window.location.href = 'dashboard.html';
                        }
                    } else {
                        window.location.href = 'index.html';
                    }
                }, 900);

            } else {
                await signOut(auth);
                showToast('Tu cuenta no está registrada en la base de datos.', 'error');
                resetBtnUI(btn, btnText, btnLoader);
            }

        } catch (error) {
            console.error("Error de login:", error);

            let msg = "Error al iniciar sesión";
            if (['auth/user-not-found', 'auth/wrong-password', 'auth/invalid-credential', 'auth/invalid-email'].includes(error.code)) {
                msg = "Usuario o contraseña incorrectos";
            } else if (error.code === 'auth/too-many-requests') {
                msg = "Demasiados intentos fallidos. Intenta más tarde";
            } else if (error.code === 'auth/network-request-failed') {
                msg = "Error de conexión. Verifica tu red";
            }

            showToast(msg, 'error');
            resetBtnUI(btn, btnText, btnLoader);
        }
    });
}

// 4. Autenticación con Google
const btnGoogle = document.getElementById('btnGoogle');
if (btnGoogle) {
    btnGoogle.addEventListener('click', async () => {
        try {
            const result = await signInWithPopup(auth, googleProvider);
            const user = result.user;

            // Verificar si el usuario ya está registrado en Firestore
            const userDoc = await getDoc(doc(db, 'usuarios', user.uid));

            if (userDoc.exists()) {
                const data = userDoc.data();

                if (data.activo === false) {
                    await signOut(auth);
                    showToast('Tu cuenta está desactivada. Contacta al administrador.', 'error');
                    return;
                }

                localStorage.setItem('usuario', JSON.stringify({
                    uid: user.uid,
                    nombre: data.nombre || data.nombreCompleto || user.displayName,
                    correo: data.correo || user.email,
                    rol: data.rol,
                    grado: data.gradoEncargado || '',
                    usuario: data.usuario || user.email.split('@')[0],
                    perfilConfigurado: data.perfilConfigurado
                }));

                showToast(`Bienvenido, ${data.nombre || 'Usuario'}`, 'success');

                setTimeout(() => {
                    if (data.rol === 'admin') {
                        window.location.href = 'admin.html';
                    } else if (data.perfilConfigurado === false) {
                        window.location.href = 'configurar-perfil.html';
                    } else {
                        window.location.href = 'dashboard.html';
                    }
                }, 1000);

            } else {
                // Si el correo no existe en la BD, eliminar cuenta temporal de Auth
                try {
                    await user.delete();
                } catch (e) {
                    await signOut(auth);
                }
                showToast('Tu correo no está registrado en el sistema.', 'error');
            }

        } catch (error) {
            console.error("Error Google Login:", error);

            if (error.code === 'auth/popup-closed-by-user') {
                showToast('Ventana de Google cerrada', 'info');
            } else if (error.code === 'auth/popup-blocked') {
                showToast('Popup bloqueado. Permite ventanas emergentes', 'error');
            } else if (error.code === 'auth/unauthorized-domain') {
                showToast('Dominio no autorizado en Firebase Console', 'error');
            } else {
                showToast('Error al iniciar sesión con Google', 'error');
            }
        }
    });
}
