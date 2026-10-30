import { 
    auth, 
    db, 
    signOut, 
    onAuthStateChanged, 
    collection, 
    getDocs, 
    query, 
    where, 
    deleteDoc, 
    doc, 
    getDoc, 
    updateDoc, 
    onSnapshot 
} from './firebase-config.js';

let usuarioActual = null;
let todosLosUsuarios = [];
let docentesLista = [];
let gradosConAlumnos = new Set();
let unsubUsuarios = null;
let chartAprobados = null;
let chartDocentes = null;
let fotoBase64 = null;
let heartbeatTimer = null;

const ONLINE_MS = 5 * 60 * 1000;

const gradosOficiales = [
    "PARVULARIA 4 SECCIÓN A", "PARVULARIA 4 SECCIÓN B",
    "PARVULARIA 5 SECCIÓN A", "PARVULARIA 5 SECCIÓN B",
    "PARVULARIA 6 SECCIÓN A", "PARVULARIA 6 SECCIÓN B",
    "1º GRADO SECCIÓN A", "2º A", "3º A", "4º A", "5º A", "6º A", "7º A", "8º A", "9º A",
    "1° GENERAL SECCIÓN A", "1° GENERAL SECCIÓN B",
    "1° ADMINISTRATIVO CONTABLE A",
    "1° SALUD Y BIENESTAR SOCIAL SECCIÓN A", "1° SALUD Y BIENESTAR SOCIAL SECCIÓN B",
    "1° ITSI A",
    "1° SISTEMAS ELÉCTRICOS Y ENERGÍAS RENOVABLES A", "1° SISTEMAS ELÉCTRICOS B",
    "2° GENERAL A", "2° ADMINISTRATIVO CONTABLE",
    "2° SALUD Y BIENESTAR SOCIAL SECCIÓN A", "2° SALUD Y BIENESTAR SOCIAL SECCIÓN B",
    "2° ITSI A",
    "2° SISTEMAS ELÉCTRICOS Y ENERGÍAS RENOVABLES A", "2° SISTEMAS ELÉCTRICOS Y ENERGÍAS RENOVABLES B",
    "3° ADMINISTRATIVO CONTABLE", "3° ITSI A",
    "3° SISTEMAS ELÉCTRICOS A", "3° SISTEMAS ELÉCTRICOS B",
    "3° ATENCIÓN PRIMARIA EN SALUD A", "3° ATENCIÓN PRIMARIA EN SALUD B"
];

function mostrarToast(mensaje, tipo) {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast-notification ${tipo}`;
    const icono = tipo === 'success' ? '✅' : tipo === 'error' ? '❌' : 'ℹ️';
    toast.innerHTML = `${icono} <span>${mensaje}</span>`;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 4500);
}

function esOnline(u) {
    if (!u.lastSeen) return false;
    const t = new Date(u.lastSeen).getTime();
    return Date.now() - t < ONLINE_MS;
}

function avatarHTML(u, sizeClass = 'avatar-sm') {
    if (u.fotoPerfil) {
        return `<img src="${u.fotoPerfil}" class="${sizeClass}" alt="" style="width:${sizeClass==='avatar-sm'?'36px':'42px'};height:${sizeClass==='avatar-sm'?'36px':'42px'};border-radius:50%;object-fit:cover;">`;
    }
    const inicial = (u.nombre || u.nombreCompleto || 'U').charAt(0).toUpperCase();
    return `<div class="${sizeClass}">${inicial}</div>`;
}

// Navegación por Pestañas
document.querySelectorAll('.nav-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.nav-tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        const target = document.getElementById('tab-' + btn.dataset.tab);
        if (target) target.classList.add('active');
    });
});

async function actualizarPresencia(uid) {
    try {
        await updateDoc(doc(db, 'usuarios', uid), {
            lastSeen: new Date().toISOString(),
            enLinea: true
        });
    } catch (e) {}
}

onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = 'index.html';
        return;
    }
    try {
        const userDoc = await getDoc(doc(db, 'usuarios', user.uid));
        if (!userDoc.exists()) { window.location.href = 'index.html'; return; }
        const userData = userDoc.data();
        if (userData.rol !== 'admin') { window.location.href = 'dashboard.html'; return; }
        if (userData.activo === false) {
            await signOut(auth);
            alert('Tu cuenta está desactivada. Contacta a otro administrador.');
            window.location.href = 'index.html';
            return;
        }

        usuarioActual = { uid: user.uid, ...userData };
        const nombre = userData.nombre || userData.nombreCompleto || 'Admin';
        
        const userNameEl = document.getElementById('userName');
        const welcomeNameEl = document.getElementById('welcomeName');
        const inputNombreAdmin = document.getElementById('inputNombreAdmin');
        const inputCorreoAdmin = document.getElementById('inputCorreoAdmin');

        if (userNameEl) userNameEl.textContent = nombre;
        if (welcomeNameEl) welcomeNameEl.textContent = nombre;
        if (inputNombreAdmin) inputNombreAdmin.value = nombre;
        if (inputCorreoAdmin) inputCorreoAdmin.value = userData.correo || user.email || '';

        const userAvatarEl = document.getElementById('userAvatar');
        const photoPreviewEl = document.getElementById('photoPreview');

        if (userData.fotoPerfil) {
            if (userAvatarEl) userAvatarEl.innerHTML = `<img src="${userData.fotoPerfil}" style="width:100%;height:100%;object-fit:cover;">`;
            if (photoPreviewEl) photoPreviewEl.innerHTML = `<img src="${userData.fotoPerfil}">`;
            fotoBase64 = userData.fotoPerfil;
        } else {
            if (userAvatarEl) userAvatarEl.textContent = nombre.charAt(0).toUpperCase();
            if (photoPreviewEl) photoPreviewEl.textContent = nombre.charAt(0).toUpperCase();
        }

        await actualizarPresencia(user.uid);
        heartbeatTimer = setInterval(() => actualizarPresencia(user.uid), 60000);

        suscribirDatos();
        llenarSelectGradosOficiales();
    } catch (error) {
        console.error(error);
        mostrarToast('Error al cargar panel', 'error');
    } finally {
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) setTimeout(() => { overlay.style.display = 'none'; }, 600);
    }
});

function suscribirDatos() {
    if (unsubUsuarios) unsubUsuarios();
    unsubUsuarios = onSnapshot(collection(db, 'usuarios'), async (snapshot) => {
        todosLosUsuarios = [];
        docentesLista = [];
        let admins = 0, docentes = 0, online = 0;

        snapshot.forEach(d => {
            const data = { uid: d.id, ...d.data() };
            todosLosUsuarios.push(data);
            if (data.rol === 'admin') admins++;
            if (data.rol === 'docente') {
                docentes++;
                docentesLista.push(data);
            }
            if (esOnline(data) && data.activo !== false) online++;
        });

        docentesLista.sort((a, b) => {
            const ga = (a.gradoEncargado || a.grado || 'ZZZ').toString();
            const gb = (b.gradoEncargado || b.grado || 'ZZZ').toString();
            if (ga !== gb) return ga.localeCompare(gb, 'es');
            return (a.nombre || a.nombreCompleto || '').localeCompare(b.nombre || b.nombreCompleto || '', 'es');
        });

        const statAdmins = document.getElementById('statAdmins');
        const statDocentes = document.getElementById('statDocentes');
        const statOnline = document.getElementById('statOnline');

        if (statAdmins) statAdmins.textContent = admins;
        if (statDocentes) statDocentes.textContent = docentes;
        if (statOnline) statOnline.textContent = online;

        renderOnline();
        renderDocentesPorGrado(docentesLista);
        try { llenarSelectEditDocente(); } catch(e) {}
        renderTablaUsuarios(todosLosUsuarios);
        llenarSelectores();
        await cargarStatsExtra();
    });
}

async function cargarStatsExtra() {
    try {
        const alumnosSnap = await getDocs(collection(db, 'alumnos'));
        gradosConAlumnos = new Set();
        let alumnosCount = 0;
        alumnosSnap.forEach(d => {
            alumnosCount++;
            if (d.data().grado) gradosConAlumnos.add(d.data().grado);
        });
        const statAlumnos = document.getElementById('statAlumnos');
        if (statAlumnos) statAlumnos.textContent = alumnosCount;

        const periodosSnap = await getDocs(collection(db, 'periodosCerrados'));
        const statPeriodos = document.getElementById('statPeriodos');
        if (statPeriodos) statPeriodos.textContent = periodosSnap.size;

        const notasSnap = await getDocs(collection(db, 'notas'));
        let suma = 0, count = 0, aprob = 0, reprob = 0;
        notasSnap.forEach(d => {
            const n = parseFloat(d.data().nota);
            if (!isNaN(n)) {
                const norm = n > 10 ? Math.min(10, n / 10) : n;
                suma += norm;
                count++;
                if (norm >= 7) aprob++; else reprob++;
            }
        });
        const prom = count > 0 ? (suma / count) : 0;
        const statPromedio = document.getElementById('statPromedio');
        if (statPromedio) statPromedio.textContent = count > 0 ? prom.toFixed(1) : '-';

        actualizarGraficos(aprob, reprob, docentesLista);
        llenarGradosPDF();
    } catch (e) {
        console.error(e);
    }
}

function actualizarGraficos(aprob, reprob, docentes) {
    const activos = docentes.filter(d => d.activo !== false).length;
    const inactivos = docentes.filter(d => d.activo === false).length;
    const sinPerfil = docentes.filter(d => d.perfilConfigurado === false).length;

    if (chartAprobados) chartAprobados.destroy();
    if (chartDocentes) chartDocentes.destroy();

    const ctx1 = document.getElementById('chartAprobados');
    if (ctx1) {
        chartAprobados = new Chart(ctx1, {
            type: 'doughnut',
            data: {
                labels: ['Aprobados (≥7)', 'Reprobados (<7)'],
                datasets: [{ data: [aprob || 0, reprob || 0], backgroundColor: ['#10b981', '#ef4444'], borderWidth: 0 }]
            },
            options: {
                plugins: { legend: { labels: { color: '#cbd5e1' } } },
                cutout: '55%'
            }
        });
    }

    const ctx2 = document.getElementById('chartDocentes');
    if (ctx2) {
        chartDocentes = new Chart(ctx2, {
            type: 'bar',
            data: {
                labels: ['Activos', 'Inactivos', 'Sin perfil'],
                datasets: [{
                    data: [activos, inactivos, sinPerfil],
                    backgroundColor: ['#6366f1', '#ef4444', '#f59e0b'],
                    borderRadius: 8
                }]
            },
            options: {
                plugins: { legend: { display: false } },
                scales: {
                    x: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255,255,255,0.05)' } },
                    y: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255,255,255,0.05)' }, beginAtZero: true }
                }
            }
        });
    }
}

function renderOnline() {
    const lista = document.getElementById('listaOnline');
    if (!lista) return;
    const onlineUsers = todosLosUsuarios
        .filter(u => esOnline(u) && u.activo !== false)
        .sort((a, b) => (a.gradoEncargado || a.grado || '').localeCompare(b.gradoEncargado || b.grado || '', 'es'));

    if (onlineUsers.length === 0) {
        lista.innerHTML = '<p class="text-muted mb-0">Nadie más está en línea en este momento.</p>';
        return;
    }
    lista.innerHTML = onlineUsers.map(u => `
        <div class="docente-item">
            <div class="d-flex align-items-center gap-3">
                ${avatarHTML(u)}
                <div>
                    <div class="docente-name"><span class="dot-online"></span>${u.nombre || u.nombreCompleto || 'Usuario'}</div>
                    <div class="docente-meta">${u.rol === 'admin' ? 'Administrador' : 'Docente'} · ${u.gradoEncargado || u.grado || 'Sin grado a cargo'}</div>
                </div>
            </div>
            <span class="badge-rol ${u.rol === 'admin' ? 'badge-admin' : 'badge-docente'}">${u.rol}</span>
        </div>
    `).join('');
}

function renderDocentesPorGrado(lista) {
    const cont = document.getElementById('listaDocentesPorGrado');
    if (!cont) return;
    if (!lista.length) {
        cont.innerHTML = '<p class="text-muted">No hay docentes registrados.</p>';
        return;
    }
    const grupos = {};
    lista.forEach(d => {
        const key = d.gradoEncargado || d.grado || 'Sin grado a cargo';
        if (!grupos[key]) grupos[key] = [];
        grupos[key].push(d);
    });
    const keys = Object.keys(grupos).sort((a, b) => a.localeCompare(b, 'es'));

    cont.innerHTML = keys.map(grado => `
        <div style="margin-bottom:18px;">
            <div style="font-weight:700;font-size:13px;color:var(--accent-primary);margin-bottom:8px;text-transform:uppercase;letter-spacing:0.3px;">
                <i class="bi bi-mortarboard-fill"></i> ${grado}
            </div>
            ${grupos[grado].map(d => `
                <div class="docente-item">
                    <div class="d-flex align-items-center gap-3">
                        ${avatarHTML(d)}
                        <div>
                            <div class="docente-name">${esOnline(d) ? '<span class="dot-online"></span>' : '<span class="dot-offline"></span>'}${d.nombre || d.nombreCompleto || 'Docente'}</div>
                            <div class="docente-meta">${d.correo || ''} · ${(d.materiasImpartidas || []).length} materia(s)</div>
                        </div>
                    </div>
                    <div>
                        <span class="badge-rol ${d.activo === false ? 'badge-inactivo' : 'badge-activo'}">${d.activo === false ? 'Inactivo' : 'Activo'}</span>
                    </div>
                </div>
            `).join('')}
        </div>
    `).join('');
}

function renderTablaUsuarios(lista) {
    const tbody = document.getElementById('tablaUsuarios');
    if (!tbody) return;
    if (!lista.length) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">Sin usuarios</td></tr>';
        return;
    }
    const ordenados = [...lista].sort((a, b) => {
        if (a.rol !== b.rol) return a.rol === 'admin' ? -1 : 1;
        return (a.gradoEncargado || a.grado || '').localeCompare(b.gradoEncargado || b.grado || '', 'es');
    });

    tbody.innerHTML = ordenados.map(u => {
        const esYo = u.uid === usuarioActual?.uid;
        return `
        <tr>
            <td>${avatarHTML(u)}</td>
            <td><strong>${u.nombre || u.nombreCompleto || 'N/A'}</strong><br><small class="text-muted">${u.gradoEncargado || u.grado || ''}</small></td>
            <td>${u.correo || 'N/A'}</td>
            <td><span class="badge-rol ${u.rol === 'admin' ? 'badge-admin' : 'badge-docente'}">${u.rol === 'admin' ? 'Admin' : 'Docente'}</span></td>
            <td><span class="badge-rol ${u.activo === false ? 'badge-inactivo' : 'badge-activo'}">${u.activo === false ? 'Inactivo' : 'Activo'}</span></td>
            <td>${esOnline(u) ? '<span class="dot-online"></span>En línea' : '<span class="dot-offline"></span>Fuera'}</td>
            <td>
                ${!esYo ? `
                    <button class="btn-sm-action btn-toggle" onclick="toggleAcceso('${u.uid}', ${u.activo === false})">${u.activo === false ? 'Activar' : 'Desactivar'}</button>
                    <button class="btn-sm-action btn-delete" onclick="eliminarUsuario('${u.uid}', '${(u.nombre || u.nombreCompleto || '').replace(/'/g, "\\'")}')">Eliminar</button>
                ` : '<small class="text-muted">Tú</small>'}
            </td>
        </tr>`;
    }).join('');
}

window.toggleAcceso = async (uid, activar) => {
    if (!confirm(activar ? '¿Activar esta cuenta?' : '¿Desactivar esta cuenta? No podrá iniciar sesión.')) return;
    try {
        await updateDoc(doc(db, 'usuarios', uid), {
            activo: activar,
            fechaActualizacion: new Date().toISOString()
        });
        mostrarToast(activar ? 'Cuenta activada' : 'Cuenta desactivada', 'success');
    } catch (e) {
        mostrarToast('Error: ' + e.message, 'error');
    }
};

window.eliminarUsuario = async (uid, nombre) => {
    if (!confirm(`¿Eliminar permanentemente a "${nombre}" del sistema?\n\nSe borrará su perfil de la base de datos. La cuenta de Authentication puede requerir borrado manual en Firebase Console.`)) return;
    try {
        await deleteDoc(doc(db, 'usuarios', uid));
        mostrarToast('Usuario eliminado de la base de datos', 'success');
    } catch (e) {
        mostrarToast('Error: ' + e.message, 'error');
    }
};

const searchDocentes = document.getElementById('searchDocentes');
if (searchDocentes) {
    searchDocentes.addEventListener('input', (e) => {
        const q = e.target.value.toLowerCase();
        const filtrados = docentesLista.filter(d =>
            (d.nombre || '').toLowerCase().includes(q) ||
            (d.nombreCompleto || '').toLowerCase().includes(q) ||
            (d.correo || '').toLowerCase().includes(q) ||
            (d.gradoEncargado || d.grado || '').toLowerCase().includes(q)
        );
        renderDocentesPorGrado(filtrados);
    });
}

const searchUsuarios = document.getElementById('searchUsuarios');
if (searchUsuarios) {
    searchUsuarios.addEventListener('input', (e) => {
        const q = e.target.value.toLowerCase();
        const filtrados = todosLosUsuarios.filter(u =>
            (u.nombre || '').toLowerCase().includes(q) ||
            (u.nombreCompleto || '').toLowerCase().includes(q) ||
            (u.correo || '').toLowerCase().includes(q)
        );
        renderTablaUsuarios(filtrados);
    });
}

function llenarSelectores() {
    const selectDocente = document.getElementById('selectDocente');
    if (!selectDocente) return;
    const current = selectDocente.value;
    selectDocente.innerHTML = '<option value="">Selecciona un docente...</option>';
    docentesLista.forEach(d => {
        const opt = document.createElement('option');
        opt.value = d.uid;
        opt.textContent = `${d.nombre || d.nombreCompleto || 'Docente'} (${d.gradoEncargado || d.grado || 'Sin grado'})`;
        selectDocente.appendChild(opt);
    });
    if (current) selectDocente.value = current;
}

function llenarGradosPDF() {
    const selectGradoPDF = document.getElementById('selectGradoPDF');
    if (!selectGradoPDF) return;
    selectGradoPDF.innerHTML = '<option value="">Selecciona un grado...</option>';
    Array.from(gradosConAlumnos).sort((a, b) => a.localeCompare(b, 'es')).forEach(g => {
        const opt = document.createElement('option');
        opt.value = g;
        opt.textContent = g;
        selectGradoPDF.appendChild(opt);
    });
}

const selectDocenteEl = document.getElementById('selectDocente');
if (selectDocenteEl) {
    selectDocenteEl.addEventListener('change', (e) => {
        const uid = e.target.value;
        const selectMateria = document.getElementById('selectMateriaReabrir');
        const selectGrado = document.getElementById('selectGradoReabrir');
        if (!selectMateria || !selectGrado) return;

        selectMateria.innerHTML = '<option value="">Selecciona materia...</option>';
        selectGrado.innerHTML = '<option value="">Selecciona grado...</option>';
        selectMateria.disabled = true;
        selectGrado.disabled = true;

        if (!uid) return;
        const docente = docentesLista.find(d => d.uid === uid);
        if (!docente) return;
        const materias = docente.materiasImpartidas || [];
        const grados = new Set();
        if (docente.gradoEncargado || docente.grado) grados.add(docente.gradoEncargado || docente.grado);
        
        materias.forEach(m => {
            const opt = document.createElement('option');
            if (m.nombre === 'Módulo') {
                opt.value = `modulo_${m.numero}`;
                opt.textContent = `Módulo ${m.numero}: ${m.nombrePersonalizado}`;
            } else {
                opt.value = m.nombre;
                opt.textContent = m.nombre;
            }
            selectMateria.appendChild(opt);
            (m.grados || []).forEach(g => grados.add(g));
        });

        selectMateria.disabled = materias.length === 0;
        selectGrado.disabled = grados.size === 0;

        Array.from(grados).sort().forEach(g => {
            const opt = document.createElement('option');
            opt.value = g;
            opt.textContent = g;
            selectGrado.appendChild(opt);
        });
    });
}

const btnBuscarPeriodos = document.getElementById('btnBuscarPeriodos');
if (btnBuscarPeriodos) {
    btnBuscarPeriodos.addEventListener('click', async () => {
        const docenteId = document.getElementById('selectDocente').value;
        const materia = document.getElementById('selectMateriaReabrir').value;
        const grado = document.getElementById('selectGradoReabrir').value;
        const periodsList = document.getElementById('periodsList');

        if (!docenteId || !materia || !grado) {
            mostrarToast('Selecciona docente, materia y grado', 'error');
            return;
        }
        if (periodsList) periodsList.innerHTML = '<p class="text-muted">Buscando...</p>';

        try {
            const q = query(
                collection(db, 'periodosCerrados'),
                where('docenteId', '==', docenteId),
                where('materia', '==', materia),
                where('grado', '==', grado)
            );
            const snapshot = await getDocs(q);
            if (!periodsList) return;

            if (snapshot.empty) {
                periodsList.innerHTML = '<p class="text-muted">No hay períodos cerrados para esta combinación.</p>';
                return;
            }
            const docente = docentesLista.find(d => d.uid === docenteId);
            periodsList.innerHTML = '';
            snapshot.forEach(docSnap => {
                const data = docSnap.data();
                const item = document.createElement('div');
                item.className = 'period-item';
                item.innerHTML = `
                    <div>
                        <div class="period-title">Período ${data.periodo} · Cerrado</div>
                        <div class="period-meta">${docente?.nombre || 'Docente'} · ${materia} · ${grado}</div>
                        <div class="period-meta">${new Date(data.fechaCierre).toLocaleString('es-SV')}</div>
                    </div>
                    <button class="btn-action btn-warning-custom btn-reopen" data-id="${docSnap.id}" data-periodo="${data.periodo}">
                        <i class="bi bi-unlock-fill"></i> Reabrir
                    </button>`;
                periodsList.appendChild(item);
            });

            document.querySelectorAll('.btn-reopen').forEach(btn => {
                btn.addEventListener('click', async () => {
                    if (!confirm(`¿Reabrir Período ${btn.dataset.periodo}?`)) return;
                    try {
                        await deleteDoc(doc(db, 'periodosCerrados', btn.dataset.id));
                        mostrarToast('Período reabierto', 'success');
                        btn.closest('.period-item').remove();
                    } catch (e) {
                        mostrarToast('Error al reabrir', 'error');
                    }
                });
            });
        } catch (e) {
            if (periodsList) periodsList.innerHTML = '<p class="text-danger">Error al buscar</p>';
        }
    });
}

const btnGenerarPDF = document.getElementById('btnGenerarPDF');
if (btnGenerarPDF) {
    btnGenerarPDF.addEventListener('click', async () => {
        const selectGradoPDF = document.getElementById('selectGradoPDF');
        const selectPeriodoPDF = document.getElementById('selectPeriodoPDF');
        const grado = selectGradoPDF ? selectGradoPDF.value : '';
        const periodo = selectPeriodoPDF ? parseInt(selectPeriodoPDF.value) : 1;

        if (!grado) { mostrarToast('Selecciona un grado', 'error'); return; }
        mostrarToast('Generando PDF...', 'info');

        try {
            const { jsPDF } = window.jspdf;
            const pdfDoc = new jsPDF('l', 'mm', 'a4');
            let logoImg = null;

            try {
                const logoResp = await fetch('img/fondos/logo.png');
                if (logoResp.ok) {
                    const blob = await logoResp.blob();
                    logoImg = await new Promise(r => { const rd = new FileReader(); rd.onloadend = () => r(rd.result); rd.readAsDataURL(blob); });
                }
            } catch (e) {}

            const snapAlumnos = await getDocs(query(collection(db, 'alumnos'), where('grado', '==', grado)));
            const alumnos = [];
            snapAlumnos.forEach(d => alumnos.push({ id: d.id, ...d.data() }));
            alumnos.sort((a, b) => a.nombre.localeCompare(b.nombre));

            if (!alumnos.length) { mostrarToast('No hay alumnos en este grado', 'error'); return; }

            const snapNotas = await getDocs(query(collection(db, 'notas'), where('grado', '==', grado), where('periodo', '==', periodo)));
            const notasPorAlumno = {};
            const materiasSet = new Set();

            snapNotas.forEach(d => {
                const data = d.data();
                if (!notasPorAlumno[data.alumnoId]) notasPorAlumno[data.alumnoId] = {};
                if (!notasPorAlumno[data.alumnoId][data.materia]) notasPorAlumno[data.alumnoId][data.materia] = [];
                notasPorAlumno[data.alumnoId][data.materia].push(parseFloat(data.nota));
                materiasSet.add(data.materia);
            });

            const materias = Array.from(materiasSet).sort();
            if (!materias.length) { mostrarToast('No hay calificaciones en este período', 'error'); return; }

            if (logoImg) pdfDoc.addImage(logoImg, 'PNG', 14, 10, 18, 18);
            pdfDoc.setFontSize(14);
            pdfDoc.text('Complejo Educativo Thomas Jefferson', logoImg ? 36 : 14, 18);
            pdfDoc.setFontSize(11);
            pdfDoc.text(`Reporte de Calificaciones - ${grado}`, 14, 38);
            pdfDoc.setFontSize(9);
            pdfDoc.setTextColor(100);
            pdfDoc.text(`Período ${periodo} | ${new Date().toLocaleDateString('es-SV')}`, 14, 44);
            pdfDoc.setTextColor(40);

            const headers = [['#', 'Alumno', ...materias.map(m => m.startsWith('modulo_') ? `Mód. ${m.split('_')[1]}` : m), 'Prom.', 'Estado']];
            const body = alumnos.map((al, i) => {
                const row = [i + 1, al.nombre];
                let suma = 0, c = 0;
                materias.forEach(m => {
                    const arr = notasPorAlumno[al.id]?.[m] || [];
                    if (arr.length) {
                        const p = arr.reduce((s, n) => s + n, 0) / arr.length;
                        row.push(p.toFixed(1));
                        suma += p; c++;
                    } else row.push('-');
                });
                const prom = c ? suma / c : 0;
                row.push(c ? prom.toFixed(1) : '-');
                row.push(c ? (prom >= 7 ? 'Aprobado' : 'Reprobado') : 'Sin notas');
                return row;
            });

            pdfDoc.autoTable({
                head: headers, body, startY: 50, theme: 'grid',
                headStyles: { fillColor: [99, 102, 241], textColor: 255, fontSize: 8 },
                bodyStyles: { fontSize: 8 },
                didParseCell: (data) => {
                    if (data.section === 'body' && data.column.index === data.table.columns.length - 1) {
                        if (data.cell.raw === 'Aprobado') data.cell.styles.textColor = [16, 185, 129];
                        if (data.cell.raw === 'Reprobado') data.cell.styles.textColor = [239, 68, 68];
                    }
                }
            });

            pdfDoc.save(`Notas_${grado.replace(/[^a-zA-Z0-9]/g, '_')}_P${periodo}.pdf`);
            mostrarToast('PDF generado', 'success');
        } catch (e) {
            mostrarToast('Error PDF: ' + e.message, 'error');
        }
    });
}

// Configuración de Perfil (Foto)
const btnElegirFoto = document.getElementById('btnElegirFoto');
if (btnElegirFoto) {
    btnElegirFoto.addEventListener('click', () => {
        const inputFoto = document.getElementById('inputFoto');
        if (inputFoto) inputFoto.click();
    });
}

const inputFoto = document.getElementById('inputFoto');
if (inputFoto) {
    inputFoto.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size > 500 * 1024) {
            mostrarToast('La imagen debe pesar menos de 500 KB', 'error');
            return;
        }
        const reader = new FileReader();
        reader.onload = () => {
            fotoBase64 = reader.result;
            const photoPreview = document.getElementById('photoPreview');
            if (photoPreview) photoPreview.innerHTML = `<img src="${fotoBase64}">`;
        };
        reader.readAsDataURL(file);
    });
}

const btnGuardarFoto = document.getElementById('btnGuardarFoto');
if (btnGuardarFoto) {
    btnGuardarFoto.addEventListener('click', async () => {
        if (!fotoBase64) { mostrarToast('Selecciona una foto primero', 'error'); return; }
        try {
            await updateDoc(doc(db, 'usuarios', usuarioActual.uid), {
                fotoPerfil: fotoBase64,
                fechaActualizacion: new Date().toISOString()
            });
            const userAvatar = document.getElementById('userAvatar');
            if (userAvatar) userAvatar.innerHTML = `<img src="${fotoBase64}" style="width:100%;height:100%;object-fit:cover;">`;
            mostrarToast('Foto de perfil guardada', 'success');
        } catch (e) {
            mostrarToast('Error al guardar foto: ' + e.message, 'error');
        }
    });
}

// Remapear Grados
let gradosEnBD = [];

function llenarSelectGradosOficiales() {
    const sel = document.getElementById('gradoNuevo');
    if (!sel) return;
    sel.innerHTML = '<option value="">Selecciona nombre oficial...</option>';
    gradosOficiales.forEach(g => {
        const o = document.createElement('option');
        o.value = g; o.textContent = g;
        sel.appendChild(o);
    });
}

const btnCargarGradosBD = document.getElementById('btnCargarGradosBD');
if (btnCargarGradosBD) {
    btnCargarGradosBD.addEventListener('click', async () => {
        const lista = document.getElementById('listaGradosBD');
        if (lista) lista.innerHTML = '<p class="text-muted">Cargando...</p>';
        try {
            const snap = await getDocs(collection(db, 'alumnos'));
            const mapa = {};
            snap.forEach(d => {
                const g = d.data().grado || '(sin grado)';
                mapa[g] = (mapa[g] || 0) + 1;
            });
            gradosEnBD = Object.keys(mapa).sort((a,b) => a.localeCompare(b, 'es'));
            const selViejo = document.getElementById('gradoViejo');
            if (selViejo) {
                selViejo.innerHTML = '<option value="">Selecciona grado actual...</option>';
                gradosEnBD.forEach(g => {
                    const o = document.createElement('option');
                    o.value = g; o.textContent = g + ' (' + mapa[g] + ' alumno(s))';
                    selViejo.appendChild(o);
                });
            }
            if (!lista) return;
            if (gradosEnBD.length === 0) {
                lista.innerHTML = '<p class="text-muted">No hay alumnos en la base de datos.</p>';
            } else {
                lista.innerHTML = '<div class="table-responsive"><table class="table"><thead><tr><th>Grado en BD</th><th>Alumnos</th><th>¿Coincide con oficial?</th></tr></thead><tbody>' +
                    gradosEnBD.map(g => {
                        const ok = gradosOficiales.includes(g);
                        return '<tr><td>' + g + '</td><td>' + mapa[g] + '</td><td>' + (ok ? '<span class="badge-rol badge-activo">Sí</span>' : '<span class="badge-rol badge-inactivo">No — remapear</span>') + '</td></tr>';
                    }).join('') + '</tbody></table></div>';
            }
            mostrarToast('Lista de grados actualizada', 'success');
        } catch (e) {
            if (lista) lista.innerHTML = '<p class="text-danger">Error: ' + e.message + '</p>';
        }
    });
}

const btnRemapear = document.getElementById('btnRemapear');
if (btnRemapear) {
    btnRemapear.addEventListener('click', async () => {
        const viejo = document.getElementById('gradoViejo').value;
        const nuevo = document.getElementById('gradoNuevo').value;
        if (!viejo || !nuevo) {
            mostrarToast('Selecciona grado actual y nombre nuevo', 'error');
            return;
        }
        if (viejo === nuevo) {
            mostrarToast('Son el mismo nombre', 'error');
            return;
        }
        if (!confirm('¿Cambiar todos los alumnos de:\n\n"' + viejo + '"\n\na:\n\n"' + nuevo + '"?')) return;
        try {
            const q = query(collection(db, 'alumnos'), where('grado', '==', viejo));
            const snap = await getDocs(q);
            if (snap.empty) {
                mostrarToast('No hay alumnos con ese grado', 'info');
                return;
            }
            let n = 0;
            for (const d of snap.docs) {
                await updateDoc(d.ref, { grado: nuevo, fechaActualizacion: new Date().toISOString() });
                n++;
            }
            mostrarToast(n + ' alumno(s) actualizados a "' + nuevo + '"', 'success');
            if (btnCargarGradosBD) btnCargarGradosBD.click();
        } catch (e) {
            mostrarToast('Error: ' + e.message, 'error');
        }
    });
}

// Editar Docente desde Admin
function llenarSelectEditDocente() {
    const sel = document.getElementById('editDocenteSelect');
    const selGrado = document.getElementById('editGradoEncargado');
    if (!sel || !selGrado) return;
    const cur = sel.value;
    sel.innerHTML = '<option value="">Selecciona un docente...</option>';
    docentesLista.forEach(d => {
        const o = document.createElement('option');
        o.value = d.uid;
        o.textContent = (d.nombre || d.nombreCompleto || 'Docente') + ' — ' + (d.gradoEncargado || d.grado || 'sin grado');
        sel.appendChild(o);
    });
    if (cur) sel.value = cur;

    if (selGrado.options.length <= 1) {
        gradosOficiales.forEach(g => {
            const o = document.createElement('option');
            o.value = g; o.textContent = g;
            selGrado.appendChild(o);
        });
    }
}

setInterval(() => {
    const sel = document.getElementById('editDocenteSelect');
    if (docentesLista.length && sel && sel.options.length <= 1) {
        llenarSelectEditDocente();
    }
}, 2000);

const editDocenteSelect = document.getElementById('editDocenteSelect');
if (editDocenteSelect) {
    editDocenteSelect.addEventListener('change', () => {
        const uid = editDocenteSelect.value;
        const info = document.getElementById('editDocenteInfo');
        const checks = document.getElementById('editGradosChecks');
        if (!uid) { if (info) info.style.display = 'none'; return; }
        const d = docentesLista.find(x => x.uid === uid);
        if (!d) return;

        if (info) info.style.display = 'block';
        const editGradoEncargado = document.getElementById('editGradoEncargado');
        if (editGradoEncargado) editGradoEncargado.value = d.gradoEncargado || d.grado || '';
        
        const mats = d.materiasImpartidas || [];
        const editDocenteMaterias = document.getElementById('editDocenteMaterias');
        if (editDocenteMaterias) {
            editDocenteMaterias.textContent = mats.length
                ? 'Materias actuales: ' + mats.map(m => m.nombre === 'Módulo' ? ('Módulo ' + (m.numero||'') + ': ' + (m.nombrePersonalizado||'')) : m.nombre).join(', ')
                : 'Sin materias registradas. Se guardará solo el grado a cargo.';
        }

        const ya = new Set();
        if (d.gradoEncargado) ya.add(d.gradoEncargado);
        if (d.grado) ya.add(d.grado);
        mats.forEach(m => (m.grados || []).forEach(g => ya.add(g)));

        if (!checks) return;
        checks.innerHTML = '';
        gradosOficiales.forEach(g => {
            const label = document.createElement('label');
            label.className = 'grade-check';
            label.style.cssText = 'display:inline-flex;cursor:pointer;user-select:none;';
            
            const input = document.createElement('input');
            input.type = 'checkbox';
            input.value = g;
            input.checked = ya.has(g);
            input.style.display = 'none';

            const span = document.createElement('span');
            span.textContent = g;
            span.style.cssText = 'display:inline-block;padding:8px 12px;background:rgba(15,23,42,0.7);border:2px solid var(--border);border-radius:20px;font-size:0.8rem;';
            if (input.checked) span.style.cssText += 'background:var(--accent-primary);border-color:var(--accent-primary);color:white;font-weight:600;';
            
            label.appendChild(input);
            label.appendChild(span);
            label.addEventListener('click', (e) => {
                e.preventDefault();
                input.checked = !input.checked;
                span.style.background = input.checked ? 'var(--accent-primary)' : 'rgba(15,23,42,0.7)';
                span.style.borderColor = input.checked ? 'var(--accent-primary)' : 'var(--border)';
                span.style.color = input.checked ? 'white' : '';
                span.style.fontWeight = input.checked ? '600' : '';
            });
            checks.appendChild(label);
        });
        llenarSelectEditDocente();
        editDocenteSelect.value = uid;
        if (editGradoEncargado) editGradoEncargado.value = d.gradoEncargado || d.grado || '';
    });
}

const btnGuardarEditDocente = document.getElementById('btnGuardarEditDocente');
if (btnGuardarEditDocente) {
    btnGuardarEditDocente.addEventListener('click', async () => {
        const uid = document.getElementById('editDocenteSelect').value;
        if (!uid) { mostrarToast('Selecciona un docente', 'error'); return; }
        const gradoEncargado = document.getElementById('editGradoEncargado').value || null;
        const gradosSel = [];
        document.querySelectorAll('#editGradosChecks input:checked').forEach(cb => gradosSel.push(cb.value));
        if (gradoEncargado && !gradosSel.includes(gradoEncargado)) gradosSel.push(gradoEncargado);

        const d = docentesLista.find(x => x.uid === uid);
        let materias = JSON.parse(JSON.stringify(d.materiasImpartidas || []));
        if (materias.length > 0 || gradosSel.length > 0) {
            materias = materias.map(m => ({ ...m, grados: [...gradosSel] }));
        }

        if (!confirm('¿Guardar grado a cargo y grados de materias para este docente?')) return;
        try {
            await updateDoc(doc(db, 'usuarios', uid), {
                gradoEncargado: gradoEncargado,
                materiasImpartidas: materias,
                perfilConfigurado: true,
                fechaActualizacion: new Date().toISOString()
            });
            mostrarToast('Docente actualizado correctamente', 'success');
        } catch (e) {
            mostrarToast('Error: ' + e.message, 'error');
        }
    });
}

// Cierre de Sesión
const btnLogout = document.getElementById('btnLogout');
if (btnLogout) {
    btnLogout.addEventListener('click', async () => {
        if (!confirm('¿Cerrar sesión de administrador?')) return;
        try {
            if (usuarioActual) {
                await updateDoc(doc(db, 'usuarios', usuarioActual.uid), {
                    enLinea: false,
                    lastSeen: new Date().toISOString()
                });
            }
        } catch (e) {}
        if (heartbeatTimer) clearInterval(heartbeatTimer);
        if (unsubUsuarios) unsubUsuarios();
        await signOut(auth);
        localStorage.removeItem('usuario');
        window.location.href = 'index.html';
    });
}

window.addEventListener('beforeunload', () => {
    if (heartbeatTimer) clearInterval(heartbeatTimer);
});
