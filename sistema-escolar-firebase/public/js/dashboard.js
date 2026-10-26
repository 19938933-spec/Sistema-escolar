
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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

console.log("✅ Firebase inicializado en dashboard.js");

let usuarioActual = null;

export function verificarSesionDocente() {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
        // 1. Si no hay usuario, ir al login
        if (!user) {
            console.log("️ No hay usuario autenticado, redirigiendo al login...");
            window.location.href = 'index.html';
            return;
        }

        // 2. Obtener datos del localStorage
        usuarioActual = JSON.parse(localStorage.getItem('usuario'));
        
        if (!usuarioActual) {
            console.warn("⚠️ No hay datos de usuario en localStorage, redirigiendo...");
            window.location.href = 'index.html';
            return;
        }

        // 3. Verificar que sea docente (si es admin, mandarlo a su panel)
        if (usuarioActual.rol === 'admin') {
            console.log("🔀 Usuario es admin, redirigiendo a admin.html...");
            window.location.href = 'admin.html';
            return;
        }

        console.log("✅ Docente autenticado:", usuarioActual.nombre);

        // 4. Actualizar la interfaz con los datos del docente
        document.getElementById('userName').textContent = usuarioActual.nombre;
        document.getElementById('userAvatar').textContent = usuarioActual.nombre.charAt(0).toUpperCase();
        document.getElementById('welcomeName').textContent = usuarioActual.nombre;
        document.getElementById('userGrade').textContent = usuarioActual.grado || 'Sin grado asignado';
        document.getElementById('userEmail').textContent = usuarioActual.correo;

        // 5. Cargar estadísticas si tiene un grado asignado
        if (usuarioActual.grado && usuarioActual.grado !== 'Sin grado asignado') {
            await cargarEstadisticas(usuarioActual.grado);
        } else {
            console.warn("️ El docente no tiene grado asignado. Mostrando ceros.");
        }

        // 6. Ocultar pantalla de carga
        setTimeout(() => {
            const loadingOverlay = document.getElementById('loadingOverlay');
            if (loadingOverlay) {
                loadingOverlay.style.opacity = '0';
                setTimeout(() => { loadingOverlay.style.display = 'none'; }, 500);
            }
        }, 800);

        // Dejar de escuchar cambios para evitar bucles
        unsubscribe();
    });
}


export async function cargarEstadisticas(grado) {
    try {
        console.log("📊 Cargando estadísticas para el grado:", grado);
        
        const q = query(
            collection(db, 'alumnos'),
            where('grado', '==', grado)
        );
        
        const snapshot = await getDocs(q);
        
        let total = 0;
        let male = 0;
        let female = 0;

        snapshot.forEach(doc => {
            const data = doc.data();
            total++;
            if (data.genero === 'Masculino') male++;
            else if (data.genero === 'Femenino') female++;
        });

        console.log(`📊 Resultados: Total=${total}, Varones=${male}, Niñas=${female}`);

        // Animar los contadores en la UI
        animarContador('statTotal', total);
        animarContador('statMale', male);
        animarContador('statFemale', female);

    } catch (error) {
        console.error("❌ Error al cargar estadísticas:", error);
        // En caso de error, asegurar que se muestren ceros
        document.getElementById('statTotal').textContent = '0';
        document.getElementById('statMale').textContent = '0';
        document.getElementById('statFemale').textContent = '0';
    }
}

export function animarContador(elementId, target) {
    const element = document.getElementById(elementId);
    if (!element) return;

    let current = 0;
    const duration = 1000; // 1 segundo
    const steps = 30;
    const increment = target / steps;
    const stepTime = duration / steps;
    
    const timer = setInterval(() => {
        current += increment;
        if (current >= target) {
            current = target;
            clearInterval(timer);
        }
        element.textContent = Math.floor(current);
    }, stepTime);
}

export function configurarLogout() {
    const btnLogout = document.getElementById('btnLogout');
    
    if (!btnLogout) {
        console.error("❌ No se encontró el botón de cerrar sesión");
        return;
    }

    btnLogout.addEventListener('click', async () => {
        if (confirm('¿Estás seguro que deseas cerrar sesión?')) {
            try {
                console.log("🚪 Cerrando sesión...");
                await signOut(auth);
                localStorage.removeItem('usuario');
                console.log("✅ Sesión cerrada correctamente");
                window.location.href = 'index.html';
            } catch (error) {
                console.error("❌ Error al cerrar sesión:", error);
                alert('Error al cerrar sesión: ' + error.message);
            }
        }
    });
}


export function inicializarDashboard() {
    console.log("🚀 Inicializando Panel Docente...");
    verificarSesionDocente();
    configurarLogout();
}

// Ejecutar cuando el DOM esté completamente cargado
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inicializarDashboard);
} else {
    inicializarDashboard();
}
