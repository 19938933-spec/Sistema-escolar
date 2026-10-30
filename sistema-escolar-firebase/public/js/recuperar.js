import { auth, sendPasswordResetEmail } from './firebase-config.js';

const form = document.getElementById('formRecuperar');
const btnEnviar = document.getElementById('btnEnviar');
const btnText = document.getElementById('btnText');
const btnLoading = document.getElementById('btnLoading');

function mostrarToast(mensaje, tipo) {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast-notification ${tipo}`;
    
    const icono = tipo === 'success' 
        ? '<i class="bi bi-check-circle-fill"></i>' 
        : '<i class="bi bi-x-circle-fill"></i>';
    
    toast.innerHTML = `${icono} <span>${mensaje}</span>`;
    container.appendChild(toast);

    setTimeout(() => toast.remove(), 5000);
}

if (form) {
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const correoInput = document.getElementById('correo');
        const correo = correoInput ? correoInput.value.trim() : '';

        if (!correo) {
            mostrarToast('Por favor, ingresa un correo electrónico.', 'error');
            return;
        }

        btnEnviar.disabled = true;
        if (btnText) btnText.style.display = 'none';
        if (btnLoading) btnLoading.style.display = 'inline-flex';

        try {
            await sendPasswordResetEmail(auth, correo);
            mostrarToast(`✅ Enlace enviado a ${correo}. Revisa tu bandeja de entrada (y spam).`, 'success');
            form.reset();
        } catch (error) {
            console.error("Error al enviar correo:", error);
            
            let msg = 'Error al enviar el enlace.';
            if (error.code === 'auth/user-not-found') {
                msg = '❌ No existe ninguna cuenta registrada con ese correo.';
            } else if (error.code === 'auth/invalid-email') {
                msg = '❌ El formato del correo no es válido.';
            } else if (error.code === 'auth/too-many-requests') {
                msg = '⚠️ Demasiadas solicitudes. Intenta de nuevo más tarde.';
            }
            
            mostrarToast(msg, 'error');
        } finally {
            btnEnviar.disabled = false;
            if (btnText) btnText.style.display = 'inline';
            if (btnLoading) btnLoading.style.display = 'none';
        }
    });
}
