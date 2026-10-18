// ============================================
//  CONFIGURACIÓN DE FIREBASE
// ============================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyC1VnkczVVRwNDj6G1kPPdHNZXWNPy_JXA",
    authDomain: "sistema-escolar-8fcee.firebaseapp.com",
    projectId: "sistema-escolar-8fcee",
    storageBucket: "sistema-escolar-8fcee.firebasestorage.app",
    messagingSenderId: "1017912885647",
    appId: "1:1017912885647:web:ba6746d5605d281b1dcbfa"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

console.log("✅ Firebase inicializado en admin.js");

// ============================================
// 📊 VARIABLES GLOBALES
// ============================================
let todosLosUsuarios = [];

// ============================================
//  VERIFICACIÓN DE AUTENTICACIÓN
// ============================================
export function verificarSesionAdmin() {
    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            console.log("⚠️ No hay usuario autenticado, redirigiendo al login...");
            window.location.href = 'index.html';
            return;
        }

        const userData = JSON.parse(localStorage.getItem('usuario'));
        
        if (!userData || userData.rol !== 'admin') {
            console.log("️ Usuario no es administrador, redirigiendo...");
            window.location.href = 'dashboard.html';
            return;
        }

        console.log("✅ Administrador autenticado:", userData.nombre);
        
        // Actualizar interfaz con datos del usuario
        document.getElementById('userName').textContent = userData.nombre;
        document.getElementById('welcomeName').textContent = userData.nombre;
        document.getElementById('userAvatar').textContent = userData.nombre.charAt(0).toUpperCase();

        // Cargar datos del sistema
        await cargarDatos();
        
        // Ocultar loading después de 800ms
        setTimeout(() => {
            const loadingOverlay = document.getElementById('loadingOverlay');
            if (loadingOverlay) {
                loadingOverlay.style.display = 'none';
            }
        }, 800);
    });
}

// ============================================
// 📥 CARGAR DATOS DEL SISTEMA
// ============================================
export async function cargarDatos() {
    try {
        console.log("🔄 Cargando datos del sistema...");
        
        const snapshot = await getDocs(collection(db, 'usuarios'));
        todosLosUsuarios = [];
        let docentesCount = 0;

        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            todosLosUsuarios.push(data);
            if (data.rol === 'docente') {
                docentesCount++;
            }
        });

        console.log(`📊 ${todosLosUsuarios.length} usuarios cargados, ${docentesCount} docentes`);

        // Contar alumnos
        let alumnosCount = 0;
        try {
            const alumnosSnap = await getDocs(collection(db, 'alumnos'));
            alumnosCount = alumnosSnap.size;
            console.log(`‍🎓 ${alumnosCount} alumnos registrados`);
        } catch(e) {
            console.log("⚠️ Colección 'alumnos' no existe o está vacía");
            alumnosCount = 0;
        }

        // Actualizar estadísticas en la interfaz
        document.getElementById('statDocentes').textContent = docentesCount;
        document.getElementById('statAlumnos').textContent = alumnosCount;

        // Renderizar tabla de usuarios
        renderizarTabla(todosLosUsuarios);
        
        console.log("✅ Datos cargados exitosamente");
        
    } catch (error) {
        console.error('❌ Error al cargar datos:', error);
        
        const tablaUsuarios = document.getElementById('tablaUsuarios');
        if (tablaUsuarios) {
            tablaUsuarios.innerHTML = `
                <tr>
                    <td colspan="5" class="text-center text-danger">
                        <i class="bi bi-exclamation-triangle-fill"></i>
                        Error al cargar datos. Verifica la consola (F12).
                    </td>
                </tr>
            `;
        }
    }
}

// ============================================
// 📋 RENDERIZAR TABLA DE USUARIOS
// ============================================
export function renderizarTabla(usuarios) {
    const tbody = document.getElementById('tablaUsuarios');
    
    if (!tbody) {
        console.error("❌ No se encontró el elemento 'tablaUsuarios'");
        return;
    }

    if (usuarios.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="text-center text-muted">
                    <i class="bi bi-inbox"></i> No hay usuarios registrados
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = usuarios.map(u => `
        <tr>
            <td><strong>${u.usuario || 'N/A'}</strong></td>
            <td>${u.nombreCompleto || u.nombre || 'N/A'}</td>
            <td>${u.correo || 'N/A'}</td>
            <td>
                <span class="badge-rol ${u.rol === 'admin' ? 'badge-admin' : 'badge-docente'}">
                    ${u.rol === 'admin' ? 'Administrador' : 'Docente'}
                </span>
            </td>
            <td>${u.grado || 'N/A'}</td>
        </tr>
    `).join('');
    
    console.log(`📋 Tabla renderizada con ${usuarios.length} usuarios`);
}

// ============================================
//  FUNCIÓN DE BÚSQUEDA
// ============================================
export function configurarBusqueda() {
    const searchInput = document.getElementById('searchInput');
    
    if (!searchInput) {
        console.error("❌ No se encontró el elemento 'searchInput'");
        return;
    }

    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase().trim();
        
        if (query === '') {
            renderizarTabla(todosLosUsuarios);
            return;
        }

        const filtrados = todosLosUsuarios.filter(u => 
            (u.nombreCompleto || '').toLowerCase().includes(query) ||
            (u.nombre || '').toLowerCase().includes(query) ||
            (u.correo || '').toLowerCase().includes(query) ||
            (u.usuario || '').toLowerCase().includes(query)
        );

        console.log(`🔍 Búsqueda: "${query}" - ${filtrados.length} resultados`);
        renderizarTabla(filtrados);
    });
}

// ============================================
// 🚪 CERRAR SESIÓN
// ============================================
export function configurarLogout() {
    const btnLogout = document.getElementById('btnLogout');
    
    if (!btnLogout) {
        console.error("❌ No se encontró el elemento 'btnLogout'");
        return;
    }

    btnLogout.addEventListener('click', async () => {
        if (confirm('¿Cerrar sesión de administrador?')) {
            try {
                console.log("🚪 Cerrando sesión...");
                await signOut(auth);
                localStorage.removeItem('usuario');
                console.log("✅ Sesión cerrada, redirigiendo al login...");
                window.location.href = 'index.html';
            } catch (error) {
                console.error(' Error al cerrar sesión:', error);
                alert('Error al cerrar sesión: ' + error.message);
            }
        }
    });
}

// ============================================
// 🚀 INICIALIZACIÓN
// ============================================
export function inicializarAdmin() {
    console.log("🚀 Inicializando panel administrativo...");
    
    verificarSesionAdmin();
    configurarBusqueda();
    configurarLogout();
    
    console.log("✅ Panel administrativo inicializado");
}

// Auto-inicializar si el DOM está listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inicializarAdmin);
} else {
    inicializarAdmin();
}
