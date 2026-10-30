import { 
    auth, 
    db, 
    signOut, 
    onAuthStateChanged, 
    collection, 
    query, 
    where, 
    getDocs, 
    writeBatch, 
    doc, 
    getDoc 
} from './firebase-config.js';

let usuarioActual = null;
let alumnos = [];
let asistencias = {};
let gradoSeleccionado = '';
let modalPDF = null;

const fechaInput = document.getElementById('fechaAsistencia');
const attendanceList = document.getElementById('attendanceList');
const alerta = document.getElementById('alerta');
const btnGuardar = document.getElementById('btnGuardar');
const btnGuardarText = document.getElementById('btnGuardarText');
const btnTodosPresentes = document.getElementById('btnTodosPresentes');
const btnDescargarPDF = document.getElementById('btnDescargarPDF');
const selectGrado = document.getElementById('selectGrado');

// Configuración inicial de fecha de hoy
if (fechaInput) {
    const hoy = new Date().toISOString().split('T')[0];
    fechaInput.value = hoy;
    fechaInput.setAttribute('max', hoy);
}

function mostrarAlerta(mensaje, tipo) {
    if (!alerta) return;
    alerta.textContent = mensaje;
    alerta.className = `alert-custom ${tipo} show`;
    setTimeout(() => alerta.classList.remove('show'), 5500);
}

function validarFecha(fechaStr) {
    if (!fechaStr) return { valida: false, mensaje: 'Selecciona una fecha' };
    const fecha = new Date(fechaStr + 'T00:00:00');
    const hoyDate = new Date();
    hoyDate.setHours(0, 0, 0, 0);

    if (fecha > hoyDate) {
        return { valida: false, mensaje: '❌ No se puede registrar asistencia en fechas futuras' };
    }
    const dia = fecha.getDay();
    if (dia === 0 || dia === 6) {
        return { valida: false, mensaje: '❌ No se puede registrar asistencia en sábados o domingos' };
    }
    return { valida: true, mensaje: '' };
}

onAuthStateChanged(auth, async (user) => {
    if (!user) { window.location.href = 'index.html'; return; }

    try {
        const userDoc = await getDoc(doc(db, 'usuarios', user.uid));
        if (!userDoc.exists()) { window.location.href = 'index.html'; return; }
        
        const data = userDoc.data();
        if (data.rol !== 'docente') { window.location.href = 'admin.html'; return; }

        usuarioActual = {
            uid: user.uid,
            nombre: data.nombre || data.nombreCompleto,
            correo: data.correo,
            rol: data.rol,
            grado: data.gradoEncargado || '',
            usuario: data.usuario,
            materiasImpartidas: data.materiasImpartidas || []
        };

        localStorage.setItem('usuario', JSON.stringify(usuarioActual));
        
        const userNameEl = document.getElementById('userName');
        const userAvatarEl = document.getElementById('userAvatar');
        if (userNameEl) userNameEl.textContent = usuarioActual.nombre;
        if (userAvatarEl) userAvatarEl.textContent = usuarioActual.nombre.charAt(0).toUpperCase();

        llenarSelectorGrados();
        
        const modalEl = document.getElementById('modalPDF');
        if (modalEl && window.bootstrap) {
            modalPDF = new bootstrap.Modal(modalEl);
        }

        setTimeout(() => { 
            const loader = document.getElementById('loadingOverlay');
            if (loader) loader.style.display = 'none'; 
        }, 800);
    } catch (error) {
        console.error('Error:', error);
        mostrarAlerta('Error al cargar datos del usuario', 'error');
    }
});

function obtenerGradosAsignados() {
    const grados = new Set();
    if (usuarioActual.grado) grados.add(usuarioActual.grado);
    (usuarioActual.materiasImpartidas || []).forEach(m => {
        (m.grados || []).forEach(g => grados.add(g));
    });
    return Array.from(grados).sort();
}

function llenarSelectorGrados() {
    if (!selectGrado) return;
    const grados = obtenerGradosAsignados();
    
    selectGrado.innerHTML = '<option value="">-- Selecciona un grado --</option>';
    
    if (grados.length === 0) {
        selectGrado.innerHTML = '<option value="">No tienes grados asignados. Configura tu perfil.</option>';
        return;
    }

    grados.forEach(g => {
        const opt = document.createElement('option');
        opt.value = g;
        const esTutor = g === usuarioActual.grado;
        opt.textContent = esTutor ? `⭐ ${g} (Tutor)` : g;
        selectGrado.appendChild(opt);
    });
}

if (selectGrado) {
    selectGrado.addEventListener('change', async (e) => {
        gradoSeleccionado = e.target.value;
        
        if (!gradoSeleccionado) {
            document.getElementById('statsGrid').style.display = 'none';
            document.getElementById('attendanceCard').style.display = 'none';
            btnGuardar.disabled = true;
            btnTodosPresentes.disabled = true;
            btnDescargarPDF.disabled = true;
            return;
        }

        const validacion = validarFecha(fechaInput.value);
        if (!validacion.valida) {
            mostrarAlerta(validacion.mensaje, 'error');
            document.getElementById('statsGrid').style.display = 'none';
            document.getElementById('attendanceCard').style.display = 'none';
            btnGuardar.disabled = true;
            btnTodosPresentes.disabled = true;
            btnDescargarPDF.disabled = true;
            return;
        }

        document.getElementById('statsGrid').style.display = 'grid';
        document.getElementById('attendanceCard').style.display = 'block';
        btnGuardar.disabled = false;
        btnTodosPresentes.disabled = false;
        btnDescargarPDF.disabled = false;

        await cargarAlumnos();
        await cargarAsistencias();
    });
}

if (fechaInput) {
    fechaInput.addEventListener('change', async () => {
        const validacion = validarFecha(fechaInput.value);
        
        if (!validacion.valida) {
            mostrarAlerta(validacion.mensaje, 'error');
            document.getElementById('statsGrid').style.display = 'none';
            document.getElementById('attendanceCard').style.display = 'none';
            btnGuardar.disabled = true;
            btnTodosPresentes.disabled = true;
            btnDescargarPDF.disabled = true;
            return;
        }

        if (!gradoSeleccionado) return;

        document.getElementById('statsGrid').style.display = 'grid';
        document.getElementById('attendanceCard').style.display = 'block';
        btnGuardar.disabled = false;
        btnTodosPresentes.disabled = false;
        btnDescargarPDF.disabled = false;

        asistencias = {};
        await cargarAsistencias();
        renderizarLista();
    });
}

async function cargarAlumnos() {
    if (!gradoSeleccionado) return;
    try {
        const q = query(collection(db, 'alumnos'), where('grado', '==', gradoSeleccionado));
        const snapshot = await getDocs(q);
        alumnos = [];
        snapshot.forEach(docSnap => alumnos.push({ id: docSnap.id, ...docSnap.data() }));
        alumnos.sort((a, b) => a.nombre.localeCompare(b.nombre));
        
        actualizarEstadisticas();
        renderizarLista();
    } catch (error) {
        console.error('Error al cargar alumnos:', error);
        mostrarAlerta('❌ Error al cargar alumnos: ' + error.message, 'error');
    }
}

async function cargarAsistencias() {
    const fecha = fechaInput.value;
    if (!fecha || !gradoSeleccionado) return;

    try {
        const q = query(
            collection(db, 'asistencias'),
            where('fecha', '==', fecha),
            where('grado', '==', gradoSeleccionado)
        );
        const snapshot = await getDocs(q);
        asistencias = {};
        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            asistencias[data.alumnoId] = data.estado;
        });

        actualizarUIEstados();
        actualizarEstadisticas();

        if (Object.keys(asistencias).length > 0) {
            mostrarAlerta(`ℹ️ Asistencia previamente registrada para el ${fecha}`, 'info');
        }
    } catch (error) {
        console.error('Error al cargar asistencias:', error);
    }
}

function renderizarLista() {
    if (!attendanceList) return;
    if (alumnos.length === 0) {
        attendanceList.innerHTML = `
            <div class="empty-state">
                <i class="bi bi-inbox"></i>
                <h4>No hay alumnos registrados en este grado</h4>
                <p>Primero debes registrar alumnos en el módulo de Gestión de Alumnos</p>
                <a href="alumnos.html" class="btn btn-primary mt-3" style="background: var(--accent-primary); color: white; border: none; padding: 10px 20px; border-radius: 8px; text-decoration: none;">Ir a Alumnos</a>
            </div>
        `;
        return;
    }

    attendanceList.innerHTML = alumnos.map((alumno, index) => {
        const estadoActual = asistencias[alumno.id] || '';
        return `
            <div class="attendance-item ${estadoActual ? 'estado-' + estadoActual.toLowerCase() : ''}" id="item-${alumno.id}" style="animation-delay: ${index * 0.05}s">
                <div class="student-info">
                    <div class="student-avatar ${alumno.genero === 'Masculino' ? 'male' : 'female'}">
                        ${alumno.nombre.charAt(0).toUpperCase()}
                    </div>
                    <div class="student-details">
                        <div class="student-name">${alumno.nombre}</div>
                        <div class="student-meta">
                            <i class="bi bi-${alumno.genero === 'Masculino' ? 'gender-male' : 'gender-female'}"></i>
                            ${alumno.genero || 'No especificado'}
                        </div>
                    </div>
                </div>
                <div class="attendance-actions">
                    <button class="btn-estado btn-presente ${estadoActual === 'Presente' ? 'active' : ''}" onclick="marcarAsistencia('${alumno.id}', 'Presente')">
                        <i class="bi bi-check-circle-fill"></i> Presente
                    </button>
                    <button class="btn-estado btn-ausente ${estadoActual === 'Ausente' ? 'active' : ''}" onclick="marcarAsistencia('${alumno.id}', 'Ausente')">
                        <i class="bi bi-x-circle-fill"></i> Ausente
                    </button>
                    <button class="btn-estado btn-tarde ${estadoActual === 'Tarde' ? 'active' : ''}" onclick="marcarAsistencia('${alumno.id}', 'Tarde')">
                        <i class="bi bi-clock-fill"></i> Tarde
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

window.marcarAsistencia = (alumnoId, estado) => {
    asistencias[alumnoId] = estado;
    const item = document.getElementById(`item-${alumnoId}`);
    if (item) {
        item.className = 'attendance-item';
        if (estado === 'Presente') item.classList.add('estado-presente');
        else if (estado === 'Ausente') item.classList.add('estado-ausente');
        else if (estado === 'Tarde') item.classList.add('estado-tarde');

        item.querySelectorAll('.btn-estado').forEach(btn => btn.classList.remove('active'));
        const btnActivo = item.querySelector(`.btn-${estado.toLowerCase()}`);
        if (btnActivo) btnActivo.classList.add('active');
    }
    actualizarEstadisticas();
};

function actualizarUIEstados() {
    alumnos.forEach(alumno => {
        const estado = asistencias[alumno.id];
        if (estado) window.marcarAsistencia(alumno.id, estado);
    });
}

function actualizarEstadisticas() {
    let total = alumnos.length;
    let totalMale = alumnos.filter(a => a.genero === 'Masculino').length;
    let totalFemale = alumnos.filter(a => a.genero === 'Femenino').length;

    let presentes = 0, presentesMale = 0, presentesFemale = 0;
    let ausentes = 0, ausentesMale = 0, ausentesFemale = 0;
    let tardes = 0, tardesMale = 0, tardesFemale = 0;

    alumnos.forEach(alumno => {
        const estado = asistencias[alumno.id];
        const isMale = alumno.genero === 'Masculino';

        if (estado === 'Presente') { presentes++; if (isMale) presentesMale++; else presentesFemale++; }
        else if (estado === 'Ausente') { ausentes++; if (isMale) ausentesMale++; else ausentesFemale++; }
        else if (estado === 'Tarde') { tardes++; if (isMale) tardesMale++; else tardesFemale++; }
    });

    document.getElementById('statTotal').textContent = total;
    document.getElementById('statTotalSub').textContent = `♂ ${totalMale}V + ♀ ${totalFemale}N`;
    document.getElementById('statPresentes').textContent = presentes;
    document.getElementById('statPresentesSub').textContent = `♂ ${presentesMale}V + ♀ ${presentesFemale}N`;
    document.getElementById('statAusentes').textContent = ausentes;
    document.getElementById('statAusentesSub').textContent = `♂ ${ausentesMale}V + ♀ ${ausentesFemale}N`;
    document.getElementById('statTardes').textContent = tardes;
    document.getElementById('statTardesSub').textContent = `♂ ${tardesMale}V + ♀ ${tardesFemale}N`;
}

if (btnTodosPresentes) {
    btnTodosPresentes.addEventListener('click', () => {
        if (alumnos.length === 0) return;
        if (confirm('¿Marcar a todos los alumnos como Presentes?')) {
            alumnos.forEach(alumno => window.marcarAsistencia(alumno.id, 'Presente'));
            mostrarAlerta('✅ Todos los alumnos marcados como Presentes', 'success');
        }
    });
}

if (btnGuardar) {
    btnGuardar.addEventListener('click', async () => {
        const validacion = validarFecha(fechaInput.value);
        if (!validacion.valida) {
            mostrarAlerta(validacion.mensaje, 'error');
            return;
        }

        if (alumnos.length === 0) {
            mostrarAlerta('❌ No hay alumnos registrados en este grado', 'error');
            return;
        }

        const sinMarcar = alumnos.filter(a => !asistencias[a.id]);
        if (sinMarcar.length > 0) {
            if (!confirm(`Hay ${sinMarcar.length} alumno(s) sin marcar. ¿Deseas continuar? (Se marcarán como Ausente)`)) {
                return;
            }
            sinMarcar.forEach(a => { asistencias[a.id] = 'Ausente'; });
        }

        btnGuardar.disabled = true;
        btnGuardarText.textContent = 'Guardando...';

        try {
            const batch = writeBatch(db);
            const fecha = fechaInput.value;
            const fechaHora = new Date().toISOString();

            alumnos.forEach(alumno => {
                const estado = asistencias[alumno.id] || 'Ausente';
                const asistenciaRef = doc(collection(db, 'asistencias'));
                
                batch.set(asistenciaRef, {
                    alumnoId: alumno.id,
                    alumnoNombre: alumno.nombre,
                    fecha: fecha,
                    estado: estado,
                    docenteId: usuarioActual.uid,
                    docenteNombre: usuarioActual.nombre,
                    grado: gradoSeleccionado,
                    fechaRegistro: fechaHora
                });
            });

            await batch.commit();
            mostrarAlerta(`✅ Asistencia guardada correctamente para el ${fecha}`, 'success');
            await cargarAsistencias();
        } catch (error) {
            console.error('Error al guardar:', error);
            mostrarAlerta('❌ Error al guardar: ' + error.message, 'error');
        }

        btnGuardar.disabled = false;
        btnGuardarText.textContent = 'Guardar Asistencia';
    });
}

// Generación de PDF
if (btnDescargarPDF) {
    btnDescargarPDF.addEventListener('click', () => {
        if (!gradoSeleccionado || alumnos.length === 0) {
            mostrarAlerta('Selecciona un grado con alumnos primero', 'error');
            return;
        }
        if (modalPDF) modalPDF.show();
    });
}

const btnPDFDiario = document.getElementById('btnPDFDiario');
if (btnPDFDiario) {
    btnPDFDiario.addEventListener('click', async () => {
        if (modalPDF) modalPDF.hide();
        await generarPDFDiario();
    });
}

const btnPDFSemanal = document.getElementById('btnPDFSemanal');
if (btnPDFSemanal) {
    btnPDFSemanal.addEventListener('click', async () => {
        if (modalPDF) modalPDF.hide();
        await generarPDFSemanal();
    });
}

async function generarPDFDiario() {
    const fecha = fechaInput.value;
    mostrarAlerta('Generando PDF del día...', 'info');

    try {
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF('p', 'mm', 'a4');

        let logoImg = null;
        try {
            const resp = await fetch('img/fondos/logo.png');
            if (resp.ok) {
                const blob = await resp.blob();
                logoImg = await new Promise(resolve => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result);
                    reader.readAsDataURL(blob);
                });
            }
        } catch (e) {}

        if (logoImg) pdf.addImage(logoImg, 'PNG', 14, 10, 18, 18);

        pdf.setFontSize(14);
        pdf.setTextColor(40, 40, 40);
        pdf.text('Complejo Educativo Thomas Jefferson', logoImg ? 36 : 14, 18);
        pdf.setFontSize(10);
        pdf.text('Sistema de Gestión Académica', logoImg ? 36 : 14, 24);

        pdf.setFontSize(13);
        pdf.text(`Reporte de Asistencia - ${gradoSeleccionado}`, 14, 38);
        pdf.setFontSize(10);
        pdf.setTextColor(100, 100, 100);
        pdf.text(`Fecha: ${fecha}  |  Docente: ${usuarioActual.nombre}`, 14, 45);

        const headers = [['#', 'Alumno', 'Género', 'Estado']];
        const body = alumnos.map((a, i) => {
            const estado = asistencias[a.id] || 'Sin marcar';
            return [i + 1, a.nombre, a.genero || '-', estado];
        });

        pdf.autoTable({
            head: headers,
            body: body,
            startY: 52,
            theme: 'grid',
            headStyles: { fillColor: [16, 185, 129], textColor: 255, fontStyle: 'bold', fontSize: 10 },
            bodyStyles: { fontSize: 9 },
            didParseCell: function(data) {
                if (data.section === 'body' && data.column.index === 3) {
                    const val = data.cell.raw;
                    if (val === 'Presente') data.cell.styles.textColor = [16, 185, 129];
                    else if (val === 'Ausente') data.cell.styles.textColor = [239, 68, 68];
                    else if (val === 'Tarde') data.cell.styles.textColor = [245, 158, 11];
                }
            }
        });

        const finalY = pdf.lastAutoTable.finalY + 10;
        const presentes = Object.values(asistencias).filter(e => e === 'Presente').length;
        const ausentes = Object.values(asistencias).filter(e => e === 'Ausente').length;
        const tardes = Object.values(asistencias).filter(e => e === 'Tarde').length;

        pdf.setFontSize(10);
        pdf.setTextColor(40, 40, 40);
        pdf.text(`Total alumnos: ${alumnos.length}   |   Presentes: ${presentes}   |   Ausentes: ${ausentes}   |   Tardes: ${tardes}`, 14, finalY);

        pdf.save(`Asistencia_${gradoSeleccionado.replace(/[^a-zA-Z0-9]/g, '_')}_${fecha}.pdf`);
        mostrarAlerta('✅ PDF del día generado correctamente', 'success');
    } catch (error) {
        console.error(error);
        mostrarAlerta('Error al generar PDF: ' + error.message, 'error');
    }
}

async function generarPDFSemanal() {
    mostrarAlerta('Generando PDF de la semana...', 'info');

    try {
        const fechas = [];
        let d = new Date(fechaInput.value + 'T00:00:00');
        let count = 0;
        while (fechas.length < 5 && count < 15) {
            const dia = d.getDay();
            if (dia !== 0 && dia !== 6) {
                fechas.unshift(d.toISOString().split('T')[0]);
            }
            d.setDate(d.getDate() - 1);
            count++;
        }

        const asistenciasSemana = {};

        for (const f of fechas) {
            const q = query(
                collection(db, 'asistencias'),
                where('fecha', '==', f),
                where('grado', '==', gradoSeleccionado)
            );
            const snap = await getDocs(q);
            snap.forEach(docSnap => {
                const data = docSnap.data();
                if (!asistenciasSemana[data.alumnoId]) asistenciasSemana[data.alumnoId] = {};
                asistenciasSemana[data.alumnoId][f] = data.estado;
            });
        }

        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF('l', 'mm', 'a4');

        let logoImg = null;
        try {
            const resp = await fetch('img/fondos/logo.png');
            if (resp.ok) {
                const blob = await resp.blob();
                logoImg = await new Promise(resolve => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result);
                    reader.readAsDataURL(blob);
                });
            }
        } catch (e) {}

        if (logoImg) pdf.addImage(logoImg, 'PNG', 14, 10, 16, 16);

        pdf.setFontSize(13);
        pdf.setTextColor(40, 40, 40);
        pdf.text('Complejo Educativo Thomas Jefferson', logoImg ? 34 : 14, 17);
        pdf.setFontSize(10);
        pdf.text('Sistema de Gestión Académica', logoImg ? 34 : 14, 23);

        pdf.setFontSize(12);
        pdf.text(`Reporte Semanal de Asistencia - ${gradoSeleccionado}`, 14, 35);
        pdf.setFontSize(9);
        pdf.setTextColor(100, 100, 100);
        pdf.text(`Docente: ${usuarioActual.nombre}  |  Días: ${fechas.join('  →  ')}`, 14, 42);

        const headers = [['#', 'Alumno', ...fechas.map(f => f.slice(5)), 'P', 'A', 'T']];
        
        const body = alumnos.map((a, i) => {
            const row = [i + 1, a.nombre];
            let p = 0, au = 0, t = 0;
            fechas.forEach(f => {
                const est = asistenciasSemana[a.id]?.[f] || '-';
                row.push(est === 'Presente' ? 'P' : est === 'Ausente' ? 'A' : est === 'Tarde' ? 'T' : '-');
                if (est === 'Presente') p++;
                if (est === 'Ausente') au++;
                if (est === 'Tarde') t++;
            });
            row.push(p, au, t);
            return row;
        });

        pdf.autoTable({
            head: headers,
            body: body,
            startY: 48,
            theme: 'grid',
            headStyles: { fillColor: [16, 185, 129], textColor: 255, fontStyle: 'bold', fontSize: 8 },
            bodyStyles: { fontSize: 8 },
            styles: { cellPadding: 2 }
        });

        pdf.save(`Asistencia_Semanal_${gradoSeleccionado.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`);
        mostrarAlerta('✅ PDF semanal generado correctamente', 'success');
    } catch (error) {
        console.error(error);
        mostrarAlerta('Error al generar PDF semanal: ' + error.message, 'error');
    }
}

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
