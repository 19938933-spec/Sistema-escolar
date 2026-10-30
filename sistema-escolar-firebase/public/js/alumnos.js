import { 
    auth, 
    db, 
    doc, 
    getDoc, 
    collection, 
    addDoc, 
    updateDoc, 
    deleteDoc, 
    query, 
    where, 
    onSnapshot, 
    signOut, 
    onAuthStateChanged 
} from './firebase-config.js';

let usuarioActual = null;
let alumnos = [];
let editandoId = null;
let gradoActual = '';
let unsubscribeAlumnos = null;

const form = document.getElementById('formAlumno');
const alerta = document.getElementById('alerta');
const studentList = document.getElementById('studentList');
const searchBox = document.getElementById('searchBox');
const btnCancelar = document.getElementById('btnCancelar');

function mostrarAlerta(mensaje, tipo) {
    alerta.textContent = mensaje;
    alerta.className = `alert-custom ${tipo} show`;
    setTimeout(() => alerta.classList.remove('show'), 3500);
}

function validarNombre(nombre) {
    return /^[A-Za-zÁÉÍÓÚáéíóúÑñÜü\s]+$/.test(nombre);
}

function obtenerSexo(alumno) {
    return alumno.sexo || alumno.genero || '';
}

function obtenerGradosAsignados() {
    const grados = new Set();
    if (usuarioActual.gradoEncargado) grados.add(usuarioActual.gradoEncargado);
    (usuarioActual.materiasImpartidas || []).forEach(m => {
        (m.grados || []).forEach(g => grados.add(g));
    });
    return Array.from(grados).sort();
}

function mostrarSelectorGrado(grados) {
    document.getElementById('loadingOverlay').style.display = 'none';
    document.getElementById('contentGrid').style.display = 'none';
    document.getElementById('gradoActual').textContent = 'Seleccionar grado';

    const main = document.getElementById('mainContent');
    main.innerHTML = `
        <div class="page-header">
            <h1><i class="bi bi-people-fill"></i> Gestión de Alumnos</h1>
            <p class="subtitle">Selecciona el grado que deseas gestionar</p>
        </div>
        <div class="grado-selector-card">
            <h3 style="margin-bottom: 20px; font-size: 18px;"><i class="bi bi-list-check"></i> Tus grados asignados</h3>
            ${grados.map(g => `
                <button class="grado-btn" onclick="window.location.href='alumnos.html?grado=${encodeURIComponent(g)}'">
                    <i class="bi bi-mortarboard-fill" style="color: var(--accent-primary);"></i>
                    ${g}
                </button>
            `).join('')}
            <div style="margin-top: 25px; text-align: center;">
                <a href="dashboard.html" style="color: var(--text-secondary); text-decoration: none; font-size: 14px;">
                    ← Volver al Dashboard
                </a>
            </div>
        </div>
    `;
}

function iniciarGestion(grado) {
    gradoActual = grado;
    document.getElementById('gradoActual').textContent = gradoActual;
    document.getElementById('contentGrid').style.display = 'grid';
    cargarAlumnosTiempoReal();
    setTimeout(() => {
        document.getElementById('loadingOverlay').style.display = 'none';
    }, 600);
}

onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = 'index.html';
        return;
    }

    try {
        const userDoc = await getDoc(doc(db, 'usuarios', user.uid));

        if (!userDoc.exists() || userDoc.data().rol !== 'docente') {
            await signOut(auth);
            window.location.href = 'index.html';
            return;
        }

        const data = userDoc.data();
        usuarioActual = {
            uid: user.uid,
            nombre: data.nombre || data.nombreCompleto || 'Docente',
            correo: data.correo,
            rol: 'docente',
            gradoEncargado: data.gradoEncargado || data.grado || '',
            materiasImpartidas: data.materiasImpartidas || []
        };

        localStorage.setItem('usuario', JSON.stringify(usuarioActual));
        document.getElementById('userName').textContent = usuarioActual.nombre;
        document.getElementById('userAvatar').textContent = usuarioActual.nombre.charAt(0).toUpperCase();

        const params = new URLSearchParams(window.location.search);
        let gradoURL = params.get('grado') || '';

        if (gradoURL) {
            iniciarGestion(gradoURL);
            return;
        }

        if (usuarioActual.gradoEncargado) {
            iniciarGestion(usuarioActual.gradoEncargado);
            return;
        }

        const grados = obtenerGradosAsignados();

        if (grados.length === 0) {
            document.getElementById('loadingOverlay').style.display = 'none';
            document.getElementById('gradoActual').textContent = 'Sin grado';
            mostrarAlerta('No tienes grados asignados. Configura tu perfil primero.', 'error');
            return;
        }

        if (grados.length === 1) {
            iniciarGestion(grados[0]);
            return;
        }

        mostrarSelectorGrado(grados);

    } catch (error) {
        console.error('Error:', error);
        document.getElementById('loadingOverlay').style.display = 'none';
        mostrarAlerta('Error al cargar datos', 'error');
    }
});

function cargarAlumnosTiempoReal() {
    if (unsubscribeAlumnos) unsubscribeAlumnos();

    const q = query(
        collection(db, 'alumnos'),
        where('grado', '==', gradoActual)
    );

    unsubscribeAlumnos = onSnapshot(q, (snapshot) => {
        alumnos = [];
        snapshot.forEach(docSnap => {
            alumnos.push({ id: docSnap.id, ...docSnap.data() });
        });
        alumnos.sort((a, b) => a.nombre.localeCompare(b.nombre));

        actualizarEstadisticas();
        renderizarLista(alumnos);
        actualizarBotones();
    }, (error) => {
        console.error('Error:', error);
        mostrarAlerta('Error al cargar alumnos', 'error');
    });
}

function actualizarEstadisticas() {
    const total = alumnos.length;
    const male = alumnos.filter(a => obtenerSexo(a) === 'Masculino').length;
    const female = alumnos.filter(a => obtenerSexo(a) === 'Femenino').length;

    document.getElementById('statTotal').textContent = total;
    document.getElementById('statMale').textContent = male;
    document.getElementById('statFemale').textContent = female;
}

function actualizarBotones() {
    const btnDescargar = document.getElementById('btnDescargarLista');
    const btnCSV = document.getElementById('btnExportarCSV');
    if (alumnos.length > 0) {
        btnDescargar.style.display = 'flex';
        btnCSV.style.display = 'flex';
    } else {
        btnDescargar.style.display = 'none';
        btnCSV.style.display = 'none';
    }
}

function renderizarLista(lista) {
    if (lista.length === 0) {
        studentList.innerHTML = `
            <div class="empty-state">
                <i class="bi bi-inbox"></i>
                <h4>No hay alumnos registrados</h4>
                <p>Comienza agregando el primer estudiante de ${gradoActual}</p>
            </div>
        `;
        return;
    }

    studentList.innerHTML = lista.map((alumno, index) => {
        const sexo = obtenerSexo(alumno);
        return `
        <div class="student-item" style="animation-delay: ${index * 0.03}s">
            <div class="student-info">
                <div class="student-avatar ${sexo === 'Masculino' ? 'male' : 'female'}">
                    ${alumno.nombre.charAt(0).toUpperCase()}
                </div>
                <div class="student-details">
                    <div class="student-name">${alumno.nombre}</div>
                    <div class="student-meta">
                        ${alumno.nie ? `<span class="me-2"><i class="bi bi-card-text"></i> ${alumno.nie}</span>` : ''}
                        <span class="gender-badge ${sexo === 'Masculino' ? 'male' : 'female'}">
                            <i class="bi bi-${sexo === 'Masculino' ? 'gender-male' : 'gender-female'}"></i>
                            ${sexo}
                        </span>
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
    `}).join('');
}

if (form) {
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const nombre = document.getElementById('nombreAlumno').value.trim();
        const nie = document.getElementById('nieAlumno').value.trim();
        const sexo = document.getElementById('sexoAlumno').value;

        if (!nombre || !sexo) {
            mostrarAlerta('Completa nombre y sexo', 'error');
            return;
        }

        if (!validarNombre(nombre)) {
            mostrarAlerta('El nombre solo puede contener letras y espacios', 'error');
            return;
        }

        const btnSubmit = document.getElementById('btnSubmit');
        btnSubmit.disabled = true;

        try {
            if (editandoId) {
                await updateDoc(doc(db, 'alumnos', editandoId), {
                    nombre: nombre,
                    nie: nie,
                    sexo: sexo,
                    genero: sexo,
                    fechaActualizacion: new Date().toISOString()
                });
                mostrarAlerta('Alumno actualizado correctamente', 'success');
                cancelarEdicion();
            } else {
                await addDoc(collection(db, 'alumnos'), {
                    nombre: nombre,
                    nie: nie,
                    sexo: sexo,
                    genero: sexo,
                    grado: gradoActual,
                    docenteId: usuarioActual.uid,
                    fechaRegistro: new Date().toISOString()
                });
                mostrarAlerta('Alumno registrado correctamente', 'success');
                form.reset();
            }
        } catch (error) {
            console.error('Error:', error);
            mostrarAlerta('Error: ' + error.message, 'error');
        }

        btnSubmit.disabled = false;
    });
}

window.editarAlumno = (id) => {
    const alumno = alumnos.find(a => a.id === id);
    if (!alumno) return;

    editandoId = id;
    document.getElementById('nombreAlumno').value = alumno.nombre;
    document.getElementById('nieAlumno').value = alumno.nie || '';
    document.getElementById('sexoAlumno').value = obtenerSexo(alumno);
    document.getElementById('formTitle').textContent = 'Editar Alumno';
    document.getElementById('btnText').textContent = 'Actualizar Alumno';
    btnCancelar.style.display = 'flex';
};

function cancelarEdicion() {
    editandoId = null;
    form.reset();
    document.getElementById('formTitle').textContent = 'Nuevo Alumno';
    document.getElementById('btnText').textContent = 'Agregar Alumno';
    btnCancelar.style.display = 'none';
}

if (btnCancelar) btnCancelar.addEventListener('click', cancelarEdicion);

window.eliminarAlumno = async (id, nombre) => {
    if (!confirm(`¿Eliminar a "${nombre}"?\nEsta acción no se puede deshacer.`)) return;

    try {
        await deleteDoc(doc(db, 'alumnos', id));
        mostrarAlerta('Alumno eliminado', 'success');
    } catch (error) {
        console.error('Error:', error);
        mostrarAlerta('Error al eliminar', 'error');
    }
};

if (searchBox) {
    searchBox.addEventListener('input', (e) => {
        const q = e.target.value.toLowerCase();
        const filtrados = alumnos.filter(a => a.nombre.toLowerCase().includes(q));
        renderizarLista(filtrados);
    });
}

window.generarListaAsistencia = function() {
    if (alumnos.length === 0) {
        alert('No hay alumnos registrados en este grado');
        return;
    }

    const ventana = window.open('', '_blank');
    const fechaActual = new Date();
    const año = fechaActual.getFullYear();
    const mes = fechaActual.toLocaleString('es-ES', { month: 'long' }).toUpperCase();
    const dias = ['L', 'M', 'M', 'J', 'V'];

    let html = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>Lista de Asistencia - ${gradoActual}</title>
        <style>
            @page { size: letter landscape; margin: 0.8cm; }
            body { font-family: Arial, sans-serif; font-size: 9px; margin: 0; padding: 12px; color: #000; }
            .header { text-align: center; margin-bottom: 12px; border-bottom: 2px solid #000; padding-bottom: 8px; }
            .header h1 { margin: 0; font-size: 15px; text-transform: uppercase; letter-spacing: 0.5px; }
            .header h2 { margin: 4px 0 0; font-size: 13px; font-weight: normal; }
            .info-row { display: flex; justify-content: space-between; align-items: center; margin-top: 8px; font-size: 11px; font-weight: bold; }
            .logo { width: 55px; height: 55px; float: left; margin-right: 12px; object-fit: contain; }
            table { width: 100%; border-collapse: collapse; margin-top: 8px; }
            th, td { border: 1px solid #000; padding: 3px 4px; text-align: center; vertical-align: middle; }
            th { background-color: #e8e8e8; font-weight: bold; font-size: 9px; }
            .numero { width: 28px; font-weight: bold; }
            .nie { width: 75px; font-size: 8px; }
            .nombre { text-align: left; padding-left: 6px; font-size: 9px; min-width: 220px; }
            .dia { width: 22px; font-size: 8px; }
            .fecha-header { font-size: 8px; }
            .footer { margin-top: 25px; font-size: 10px; }
            .firmas { display: flex; justify-content: space-between; margin-top: 35px; padding: 0 40px; }
            .firma-box { text-align: center; width: 40%; }
            .firma-linea { border-top: 1px solid #000; margin-top: 40px; padding-top: 5px; }
            @media print { button { display: none !important; } body { padding: 0; } }
        </style>
    </head>
    <body>
        <button onclick="window.print()" style="position: fixed; top: 10px; right: 10px; padding: 10px 16px; background: #2563eb; color: white; border: none; border-radius: 6px; cursor: pointer; z-index: 1000; font-size: 14px;">
            🖨️ Imprimir / Guardar PDF
        </button>

        <div class="header">
            <img src="img/fondos/logo.png" alt="Logo" class="logo" onerror="this.style.display='none'">
            <h1>COMPLEJO EDUCATIVO THOMAS JEFFERSON</h1>
            <h2>LISTAS DE ASISTENCIA</h2>
            <div class="info-row">
                <div>MES: ${mes}</div>
                <div>AÑO: ${año}</div>
                <div>${gradoActual}</div>
            </div>
        </div>

        <table>
            <thead>
                <tr>
                    <th rowspan="2" class="numero">N°</th>
                    <th rowspan="2" class="nie">NIE</th>
                    <th rowspan="2" class="nombre">NOMBRES</th>
                    <th colspan="5" class="fecha-header">SEMANA 1</th>
                    <th colspan="5" class="fecha-header">SEMANA 2</th>
                    <th colspan="5" class="fecha-header">SEMANA 3</th>
                    <th colspan="5" class="fecha-header">SEMANA 4</th>
                </tr>
                <tr>
                    ${[1,2,3,4].map(() => dias.map(d => `<th class="dia">${d}</th>`).join('')).join('')}
                </tr>
            </thead>
            <tbody>
    `;

    alumnos.forEach((alumno, index) => {
        html += `
            <tr>
                <td class="numero">${index + 1}</td>
                <td class="nie">${alumno.nie || ''}</td>
                <td class="nombre">${alumno.nombre.toUpperCase()}</td>
                ${Array(20).fill('<td class="dia" style="height: 22px;"></td>').join('')}
            </tr>
        `;
    });

    for (let i = alumnos.length; i < Math.max(alumnos.length + 3, 35); i++) {
        html += `
            <tr>
                <td class="numero">${i + 1}</td>
                <td class="nie"></td>
                <td class="nombre"></td>
                ${Array(20).fill('<td class="dia" style="height: 22px;"></td>').join('')}
            </tr>
        `;
    }

    html += `
            </tbody>
        </table>

        <div class="footer">
            <p><strong>Observaciones:</strong> _______________________________________________________________________________</p>
            <p>_________________________________________________________________________________________________</p>

            <div class="firmas">
                <div class="firma-box">
                    <div class="firma-linea">Firma del Docente</div>
                </div>
                <div class="firma-box">
                    <div class="firma-linea">Vo. Bo. Coordinación</div>
                </div>
            </div>

            <p style="margin-top: 18px; font-size: 8px; text-align: center; color: #555;">
                Generado el: ${new Date().toLocaleString('es-SV')} — Sistema Escolar Thomas Jefferson
            </p>
        </div>
    </body>
    </html>
    `;

    ventana.document.write(html);
    ventana.document.close();
};

window.exportarCSV = function() {
    if (alumnos.length === 0) {
        alert('No hay alumnos registrados');
        return;
    }

    let csv = 'N°,NIE,Nombre,Sexo\n';
    alumnos.forEach((alumno, index) => {
        csv += `${index + 1},${alumno.nie || ''},"${alumno.nombre}",${obtenerSexo(alumno)}\n`;
    });

    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `alumnos_${gradoActual.replace(/[^a-zA-Z0-9]/g, '_')}.csv`;
    link.click();
};

const btnDescargar = document.getElementById('btnDescargarLista');
const btnCSV = document.getElementById('btnExportarCSV');
if (btnDescargar) btnDescargar.addEventListener('click', window.generarListaAsistencia);
if (btnCSV) btnCSV.addEventListener('click', window.exportarCSV);

const btnLogout = document.getElementById('btnLogout');
if (btnLogout) {
    btnLogout.addEventListener('click', async () => {
        if (confirm('¿Cerrar sesión?')) {
            await signOut(auth);
            localStorage.removeItem('usuario');
            window.location.href = 'index.html';
        }
    });
}

window.addEventListener('beforeunload', () => {
    if (unsubscribeAlumnos) unsubscribeAlumnos();
});
