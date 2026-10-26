
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, addDoc, updateDoc, deleteDoc, doc, query, where, onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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

console.log("✅ Firebase inicializado en alumnos.js");

let usuarioActual = null;
let alumnos = [];
let editandoId = null;

function verificarSesionDocente() {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
        if (!user) {
            window.location.href = 'index.html';
            return;
        }

        usuarioActual = JSON.parse(localStorage.getItem('usuario'));
        
        if (!usuarioActual || usuarioActual.rol !== 'docente') {
            window.location.href = 'admin.html';
            return;
        }

        console.log("✅ Docente autenticado en módulo Alumnos:", usuarioActual.nombre);

        // Actualizar UI del Navbar
        document.getElementById('userName').textContent = usuarioActual.nombre;
        document.getElementById('userAvatar').textContent = usuarioActual.nombre.charAt(0).toUpperCase();
        
        const gradoElement = document.getElementById('userGrade');
        if (gradoElement) gradoElement.textContent = usuarioActual.grado || 'Sin grado asignado';

        const gradoInput = document.getElementById('gradoAlumno');
        if (gradoInput) gradoInput.value = usuarioActual.grado || '';

        // Verificar si tiene grado asignado
        if (!usuarioActual.grado || usuarioActual.grado === 'Sin grado asignado') {
            mostrarAlerta('⚠️ No tienes un grado asignado. Contacta al administrador.', 'error');
        } else {
            cargarAlumnos();
        }

        // Ocultar loading
        setTimeout(() => {
            const loadingOverlay = document.getElementById('loadingOverlay');
            if (loadingOverlay) loadingOverlay.style.display = 'none';
        }, 800);

        unsubscribe();
    });
}


function cargarAlumnos() {
    console.log("🔄 Cargando alumnos del grado:", usuarioActual.grado);
    
    const q = query(
        collection(db, 'alumnos'),
        where('grado', '==', usuarioActual.grado)
    );

    onSnapshot(q, (snapshot) => {
        alumnos = [];
        snapshot.forEach(doc => {
            alumnos.push({ id: doc.id, ...doc.data() });
        });

        // Ordenar alfabéticamente
        alumnos.sort((a, b) => a.nombre.localeCompare(b.nombre));

        console.log(`📊 ${alumnos.length} alumnos cargados en tiempo real`);
        actualizarEstadisticas();
        renderizarLista(alumnos);
    }, (error) => {
        console.error("❌ Error al escuchar alumnos:", error);
        mostrarAlerta('Error al cargar alumnos: ' + error.message, 'error');
    });
}


function actualizarEstadisticas() {
    const total = alumnos.length;
    const male = alumnos.filter(a => a.genero === 'Masculino').length;
    const female = alumnos.filter(a => a.genero === 'Femenino').length;

    animarContador('statTotal', total);
    animarContador('statMale', male);
    animarContador('statFemale', female);
}

function animarContador(elementId, target) {
    const element = document.getElementById(elementId);
    if (!element) return;

    let current = parseInt(element.textContent) || 0;
    if (current === target) return;

    const increment = (target - current) / 20;
    const timer = setInterval(() => {
        current += increment;
        if ((increment > 0 && current >= target) || (increment < 0 && current <= target)) {
            current = target;
            clearInterval(timer);
        }
        element.textContent = Math.floor(current);
    }, 30);
}

function renderizarLista(lista) {
    const studentList = document.getElementById('studentList');
    if (!studentList) return;

    if (lista.length === 0) {
        studentList.innerHTML = `
            <div class="empty-state">
                <i class="bi bi-inbox"></i>
                <h4>No hay alumnos registrados</h4>
                <p>Comienza agregando el primer estudiante</p>
            </div>
        `;
        return;
    }

    studentList.innerHTML = lista.map((alumno, index) => `
        <div class="student-item" style="animation-delay: ${index * 0.05}s">
            <div class="student-info">
                <div class="student-avatar ${alumno.genero === 'Masculino' ? 'male' : 'female'}">
                    ${alumno.nombre.charAt(0).toUpperCase()}
                </div>
                <div class="student-details">
                    <div class="student-name">${alumno.nombre}</div>
                    <div class="student-meta">
                        <span class="gender-badge ${alumno.genero === 'Masculino' ? 'male' : 'female'}">
                            <i class="bi bi-${alumno.genero === 'Masculino' ? 'gender-male' : 'gender-female'}"></i>
                            ${alumno.genero}
                        </span>
                        <span><i class="bi bi-book"></i> ${alumno.grado}</span>
                    </div>
                </div>
            </div>
            <div class="student-actions">
                <button class="btn-action btn-edit" onclick="editarAlumno('${alumno.id}')" title="Editar">
                    <i class="bi bi-pencil-fill"></i>
                </button>
                <button class="btn-action btn-delete" onclick="eliminarAlumno('${alumno.id}', '${alumno.nombre.replace(/'/g, "\\'")}')" title="Eliminar">
                    <i class="bi bi-trash-fill"></i>
                </button>
            </div>
        </div>
    `).join('');
}


function configurarFormulario() {
    const form = document.getElementById('formAlumno');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const nombre = document.getElementById('nombreAlumno').value.trim();
        const genero = document.getElementById('generoAlumno').value;
        const grado = document.getElementById('gradoAlumno').value;

        if (!nombre || !genero || !grado) {
            mostrarAlerta('❌ Completa todos los campos', 'error');
            return;
        }

        if (!usuarioActual.grado) {
            mostrarAlerta('⚠️ No tienes un grado asignado', 'error');
            return;
        }

        const btnSubmit = document.getElementById('btnSubmit');
        btnSubmit.disabled = true;

        try {
            if (editandoId) {
                console.log("✏️ Actualizando alumno:", editandoId);
                await updateDoc(doc(db, 'alumnos', editandoId), {
                    nombre, genero, grado,
                    fechaActualizacion: new Date().toISOString()
                });
                mostrarAlerta('✅ Alumno actualizado correctamente', 'success');
                cancelarEdicion();
            } else {
                console.log("➕ Creando nuevo alumno...");
                await addDoc(collection(db, 'alumnos'), {
                    nombre, genero, grado,
                    docenteId: usuarioActual.uid,
                    fechaRegistro: new Date().toISOString()
                });
                mostrarAlerta('✅ Alumno registrado correctamente', 'success');
                form.reset();
                document.getElementById('gradoAlumno').value = grado;
            }
        } catch (error) {
            console.error("❌ Error al guardar:", error);
            mostrarAlerta('❌ Error al guardar: ' + error.message, 'error');
        }

        btnSubmit.disabled = false;
    });
}

//editar alumno
window.editarAlumno = (id) => {
    const alumno = alumnos.find(a => a.id === id);
    if (!alumno) return;

    editandoId = id;
    document.getElementById('nombreAlumno').value = alumno.nombre;
    document.getElementById('generoAlumno').value = alumno.genero;
    document.getElementById('gradoAlumno').value = alumno.grado;

    const formTitle = document.getElementById('formTitle');
    const btnText = document.getElementById('btnText');
    const btnCancel = document.getElementById('btnCancel');

    if (formTitle) formTitle.textContent = 'Editar Alumno';
    if (btnText) btnText.textContent = 'Actualizar Alumno';
    if (btnCancel) btnCancel.style.display = 'flex';

    if (window.innerWidth <= 992) {
        document.querySelector('.form-card').scrollIntoView({ behavior: 'smooth' });
    }
};

function cancelarEdicion() {
    editandoId = null;
    const form = document.getElementById('formAlumno');
    if (form) form.reset();
    
    const gradoInput = document.getElementById('gradoAlumno');
    if (gradoInput) gradoInput.value = usuarioActual.grado || '';

    const formTitle = document.getElementById('formTitle');
    const btnText = document.getElementById('btnText');
    const btnCancel = document.getElementById('btnCancel');

    if (formTitle) formTitle.textContent = 'Registrar Alumno';
    if (btnText) btnText.textContent = 'Registrar Alumno';
    if (btnCancel) btnCancel.style.display = 'none';
}


window.eliminarAlumno = async (id, nombre) => {
    if (!confirm(`¿Estás seguro de eliminar a "${nombre}"?\nEsta acción no se puede deshacer.`)) {
        return;
    }

    try {
        await deleteDoc(doc(db, 'alumnos', id));
        mostrarAlerta('🗑️ Alumno eliminado correctamente', 'success');
    } catch (error) {
        console.error(" Error al eliminar:", error);
        mostrarAlerta('❌ Error al eliminar: ' + error.message, 'error');
    }
};


function configurarBusqueda() {
    const searchBox = document.getElementById('searchBox');
    if (!searchBox) return;

    searchBox.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase();
        const filtrados = alumnos.filter(a => 
            a.nombre.toLowerCase().includes(query)
        );
        renderizarLista(filtrados);
    });
}


function mostrarAlerta(mensaje, tipo) {
    const alerta = document.getElementById('alerta');
    if (!alerta) {
        alert(mensaje); // Fallback si no existe el elemento
        return;
    }
    alerta.textContent = mensaje;
    alerta.className = `alert-custom ${tipo} show`;
    setTimeout(() => alerta.classList.remove('show'), 4000);
}


function configurarLogout() {
    const btnLogout = document.getElementById('btnLogout');
    if (!btnLogout) return;

    btnLogout.addEventListener('click', async () => {
        if (confirm('¿Estás seguro que deseas cerrar sesión?')) {
            try {
                await signOut(auth);
                localStorage.removeItem('usuario');
                window.location.href = 'index.html';
            } catch (error) {
                console.error('Error al cerrar sesión:', error);
                alert('Error al cerrar sesión: ' + error.message);
            }
        }
    });
}


export function inicializarAlumnos() {
    console.log("🚀 Inicializando módulo de Alumnos...");
    verificarSesionDocente();
    configurarFormulario();
    configurarBusqueda();
    configurarLogout();

    // Configurar botón de cancelar edición
    const btnCancel = document.getElementById('btnCancel');
    if (btnCancel) {
        btnCancel.addEventListener('click', cancelarEdicion);
    }
}

// Ejecutar cuando el DOM esté listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inicializarAlumnos);
} else {
    inicializarAlumnos();
}
