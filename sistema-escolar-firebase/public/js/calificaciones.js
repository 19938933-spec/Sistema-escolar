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
    deleteDoc, 
    addDoc, 
    getDoc 
} from './firebase-config.js';

let usuarioActual = null;
let alumnos = [];
let actividades = [];
let notas = {};
let periodoActual = 1;
let materiaActual = '';
let gradoActual = '';
let periodoCerrado = false;
let modalActividad = null;
let documentoPeriodoCerradoId = null;

/** Normaliza texto de grado para comparar (quita comillas, espacios de más) */
function normalizarGrado(g) {
    return String(g || '')
        .replace(/"/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
}

/** Carga alumnos por grado exacto; si no hay, busca coincidencia normalizada */
async function cargarAlumnosPorGrado(gradoBuscado) {
    const gradoNorm = String(gradoBuscado || '').replace(/"/g, '').trim();
    if (!gradoNorm) return [];

    const lista = [];
    try {
        const q = query(collection(db, 'alumnos'), where('grado', '==', gradoNorm));
        const snapshot = await getDocs(q);
        snapshot.forEach(docSnap => lista.push({ id: docSnap.id, ...docSnap.data() }));
    } catch (e) {
        console.warn('Query exacta falló:', e.message);
    }

    if (lista.length === 0) {
        // Intento con el valor original (por si tenía comillas guardadas)
        try {
            const q2 = query(collection(db, 'alumnos'), where('grado', '==', gradoBuscado));
            const snap2 = await getDocs(q2);
            snap2.forEach(docSnap => lista.push({ id: docSnap.id, ...docSnap.data() }));
        } catch (e) {}
    }

    if (lista.length === 0) {
        // Respaldo: recorrer y comparar normalizado
        const todos = await getDocs(collection(db, 'alumnos'));
        const objetivo = normalizarGrado(gradoNorm);
        todos.forEach(docSnap => {
            const data = docSnap.data();
            if (normalizarGrado(data.grado) === objetivo) {
                lista.push({ id: docSnap.id, ...data });
            }
        });
    }

    lista.sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '', 'es'));
    return lista;
}


function mostrarToast(mensaje, tipo) {
    const container = document.getElementById('toastContainer');
    if (!container) return alert(mensaje);

    const toast = document.createElement('div');
    toast.className = `toast-notification ${tipo}`;
    const icono = tipo === 'success' ? '<i class="bi bi-check-circle-fill"></i>' : 
                  tipo === 'error' ? '<i class="bi bi-x-circle-fill"></i>' : 
                  '<i class="bi bi-info-circle-fill"></i>';
    toast.innerHTML = `${icono} <span>${mensaje}</span>`;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 5000);
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
            nombre: data.nombre || data.nombreCompleto || 'Docente',
            correo: data.correo,
            rol: data.rol,
            grado: data.gradoEncargado || data.grado || '',
            gradoEncargado: data.gradoEncargado || data.grado || '',
            usuario: data.usuario,
            perfilConfigurado: data.perfilConfigurado,
            materiasImpartidas: data.materiasImpartidas || []
        };

        localStorage.setItem('usuario', JSON.stringify(usuarioActual));
        
        const userName = document.getElementById('userName');
        const userAvatar = document.getElementById('userAvatar');
        const docenteNombre = document.getElementById('docenteNombre');

        if (userName) userName.textContent = usuarioActual.nombre;
        if (userAvatar) userAvatar.textContent = usuarioActual.nombre.charAt(0).toUpperCase();
        if (docenteNombre) docenteNombre.textContent = usuarioActual.nombre;

        const modalEl = document.getElementById('modalActividad');
        if (modalEl && window.bootstrap) {
            modalActividad = new bootstrap.Modal(modalEl);
        }

        llenarSelectorMaterias();
    } catch (error) {
        console.error("Error:", error);
        mostrarToast('Error al cargar datos: ' + error.message, 'error');
    }

    setTimeout(() => {
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) {
            overlay.style.opacity = '0';
            setTimeout(() => { overlay.style.display = 'none'; }, 500);
        }
    }, 700);
});

function llenarSelectorMaterias() {
    const selectMateria = document.getElementById('selectMateria');
    if (!selectMateria) return;

    const materias = usuarioActual.materiasImpartidas || [];
    selectMateria.innerHTML = '<option value="">Selecciona una materia...</option>';
    if (materias.length === 0) {
        selectMateria.innerHTML = '<option value="">No tienes materias asignadas. Configura tu perfil.</option>';
        return;
    }
    materias.forEach((asignacion, index) => {
        const option = document.createElement('option');
        if (asignacion.nombre === "Módulo") {
            option.value = `modulo_${asignacion.numero}`;
            option.textContent = `Módulo ${asignacion.numero}: ${asignacion.nombrePersonalizado}`;
        } else {
            option.value = asignacion.nombre;
            option.textContent = asignacion.nombre;
        }
        option.dataset.index = index;
        selectMateria.appendChild(option);
    });
}

const selectMateria = document.getElementById('selectMateria');
if (selectMateria) {
    selectMateria.addEventListener('change', async (e) => {
        materiaActual = e.target.value;
        const index = e.target.options[e.target.selectedIndex]?.dataset?.index;
        const selectGrado = document.getElementById('selectGrado');
        selectGrado.innerHTML = '<option value="">Selecciona un grado...</option>';
        selectGrado.disabled = true;
        document.getElementById('btnNuevaActividad').disabled = true;
        document.getElementById('btnGuardarTodo').disabled = true;
        document.getElementById('btnDescargarPDF').disabled = true;
        document.getElementById('tablaContainer').innerHTML = '<div class="empty-state"><i class="bi bi-journal-x"></i><h4>Selecciona un grado</h4></div>';
        document.getElementById('statsBar').style.display = 'none';
        document.getElementById('cerrarPeriodoSection').style.display = 'none';
        document.getElementById('reabrirPeriodoSection').style.display = 'none';
        
        if (!materiaActual || index === undefined) return;

        const materias = usuarioActual.materiasImpartidas || [];
        const asignacion = materias[parseInt(index)];
        if (asignacion && asignacion.grados && asignacion.grados.length > 0) {
            asignacion.grados.forEach(grado => {
                grado = String(grado || '').replace(/"/g, '').trim();
                if (!grado) return;
                const option = document.createElement('option');
                option.value = grado;
                option.textContent = grado;
                selectGrado.appendChild(option);
            });
            selectGrado.disabled = false;
        } else {
            selectGrado.innerHTML = '<option value="">Sin grados asignados para esta materia</option>';
        }
    });
}

const selectGrado = document.getElementById('selectGrado');
if (selectGrado) {
    selectGrado.addEventListener('change', async (e) => {
        gradoActual = e.target.value;
        if (!gradoActual) {
            document.getElementById('btnNuevaActividad').disabled = true;
            document.getElementById('btnGuardarTodo').disabled = true;
            document.getElementById('btnDescargarPDF').disabled = true;
            return;
        }
        document.getElementById('btnNuevaActividad').disabled = false;
        document.getElementById('btnGuardarTodo').disabled = false;
        document.getElementById('btnDescargarPDF').disabled = false;
        await cargarAlumnos();
        await cargarActividades();
    });
}

async function cargarAlumnos() {
    if (!gradoActual) return;
    try {
        gradoActual = String(gradoActual).replace(/"/g, '').trim();
        alumnos = await cargarAlumnosPorGrado(gradoActual);
    } catch (error) {
        console.error('Error cargando alumnos:', error);
        mostrarToast('Error al cargar alumnos', 'error');
    }
}

async function cargarActividades() {
    if (!materiaActual || !gradoActual) return;
    try {
        const q = query(
            collection(db, 'actividades'),
            where('docenteId', '==', usuarioActual.uid),
            where('materia', '==', materiaActual),
            where('grado', '==', gradoActual),
            where('periodo', '==', periodoActual)
        );
        const snapshot = await getDocs(q);
        actividades = [];
        snapshot.forEach(d => actividades.push({ id: d.id, ...d.data() }));
        actividades.sort((a, b) => (a.orden || 0) - (b.orden || 0));
        await cargarNotas();
        await verificarPeriodoCerrado();
        renderizarTabla();
    } catch (error) {
        console.error('Error cargando actividades:', error);
        mostrarToast('Error al cargar actividades', 'error');
    }
}

async function cargarNotas() {
    if (actividades.length === 0 || alumnos.length === 0) { notas = {}; return; }
    try {
        notas = {};
        for (const act of actividades) {
            const q = query(collection(db, 'notas'), where('actividadId', '==', act.id));
            const snapshot = await getDocs(q);
            snapshot.forEach(d => {
                const data = d.data();
                if (!notas[data.alumnoId]) notas[data.alumnoId] = {};
                notas[data.alumnoId][act.id] = data.nota;
            });
        }
    } catch (error) {
        console.error('Error cargando notas:', error);
    }
}

async function verificarPeriodoCerrado() {
    try {
        const q = query(
            collection(db, 'periodosCerrados'),
            where('docenteId', '==', usuarioActual.uid),
            where('materia', '==', materiaActual),
            where('grado', '==', gradoActual),
            where('periodo', '==', periodoActual)
        );
        const snapshot = await getDocs(q);
        periodoCerrado = !snapshot.empty;
        documentoPeriodoCerradoId = snapshot.empty ? null : snapshot.docs[0].id;
        document.getElementById('cerrarPeriodoSection').style.display = periodoCerrado ? 'none' : 'block';
        document.getElementById('reabrirPeriodoSection').style.display = periodoCerrado ? 'block' : 'none';
    } catch (error) {
        console.error('Error verificando período:', error);
        periodoCerrado = false;
    }
}

function renderizarTabla() {
    const container = document.getElementById('tablaContainer');
    if (!container) return;

    if (alumnos.length === 0) {
        container.innerHTML = `<div class="empty-state"><i class="bi bi-inbox"></i><h4>No hay alumnos en este grado</h4><p>Registra alumnos primero</p></div>`;
        document.getElementById('statsBar').style.display = 'none';
        return;
    }
    if (actividades.length === 0) {
        container.innerHTML = `<div class="empty-state"><i class="bi bi-journal-plus"></i><h4>Sin actividades en Período ${periodoActual}</h4><p>Haz clic en "Nueva Actividad" para comenzar</p></div>`;
        document.getElementById('statsBar').style.display = 'none';
        return;
    }

    let html = '<table class="grades-table"><thead><tr><th>Alumno</th>';
    actividades.forEach(act => {
        html += `<th><div class="activity-header"><div><div class="activity-name" title="${act.nombre}">${act.nombre}</div><small style="opacity:0.7">/${act.valorMaximo}</small></div><button class="activity-delete" onclick="eliminarActividad('${act.id}')" ${periodoCerrado ? 'disabled' : ''}><i class="bi bi-trash-fill"></i></button></div></th>`;
    });
    html += '<th>Promedio</th></tr></thead><tbody>';

    let aprobados = 0, reprobados = 0;
    alumnos.forEach(alumno => {
        html += `<tr><td><div class="student-cell"><div class="student-avatar">${alumno.nombre.charAt(0).toUpperCase()}</div><div class="student-name">${alumno.nombre}</div></div></td>`;
        let suma = 0, count = 0;
        actividades.forEach(act => {
            const nota = notas[alumno.id]?.[act.id] ?? '';
            const valorMax = parseFloat(act.valorMaximo) || 10;
            const notaNorm = nota !== '' ? (parseFloat(nota) / valorMax) * 10 : '';
            if (nota !== '') { suma += notaNorm; count++; }
            const clase = nota === '' ? '' : (notaNorm >= 7 ? 'aprobado' : 'reprobado');
            html += `<td><input type="number" class="grade-input ${clase}" data-alumno="${alumno.id}" data-actividad="${act.id}" value="${nota}" min="0" max="${valorMax}" step="0.1" onchange="actualizarNota(this)" ${periodoCerrado ? 'disabled' : ''}></td>`;
        });
        const promedio = count > 0 ? (suma / count) : 0;
        const promClase = count > 0 ? (promedio >= 7 ? 'aprobado' : 'reprobado') : '';
        const promDisplay = count > 0 ? promedio.toFixed(1) : '-';
        if (count > 0) { if (promedio >= 7) aprobados++; else reprobados++; }
        html += `<td><span class="promedio-cell ${promClase}">${promDisplay}</span></td></tr>`;
    });
    html += '</tbody></table>';
    container.innerHTML = html;
    document.getElementById('statTotal').textContent = alumnos.length;
    document.getElementById('statAprobados').textContent = aprobados;
    document.getElementById('statReprobados').textContent = reprobados;
    document.getElementById('statsBar').style.display = 'flex';
}

window.actualizarNota = (input) => {
    if (periodoCerrado) { mostrarToast('El período está cerrado', 'error'); return; }
    const alumnoId = input.dataset.alumno;
    const actividadId = input.dataset.actividad;
    const valor = input.value.trim();
    const act = actividades.find(a => a.id === actividadId);
    const valorMax = parseFloat(act?.valorMaximo) || 10;
    
    if (valor === '') {
        if (notas[alumnoId]) delete notas[alumnoId][actividadId];
        input.classList.remove('aprobado', 'reprobado');
    } else {
        const num = parseFloat(valor);
        if (isNaN(num) || num < 0 || num > valorMax) {
            mostrarToast(`La nota debe estar entre 0 y ${valorMax}`, 'error');
            input.value = '';
            return;
        }
        if (!notas[alumnoId]) notas[alumnoId] = {};
        notas[alumnoId][actividadId] = num;
        const norm = (num / valorMax) * 10;
        input.classList.remove('aprobado', 'reprobado');
        input.classList.add(norm >= 7 ? 'aprobado' : 'reprobado');
    }
    recalcularPromedios();
};

function recalcularPromedios() {
    const filas = document.querySelectorAll('.grades-table tbody tr');
    let aprobados = 0, reprobados = 0;
    filas.forEach((fila, idx) => {
        const alumno = alumnos[idx];
        if (!alumno) return;
        let suma = 0, count = 0;
        actividades.forEach(act => {
            const input = fila.querySelector(`input[data-actividad="${act.id}"]`);
            if (input && input.value !== '') {
                const num = parseFloat(input.value);
                const valorMax = parseFloat(act.valorMaximo) || 10;
                suma += (num / valorMax) * 10;
                count++;
            }
        });
        const promedio = count > 0 ? (suma / count) : 0;
        const cell = fila.querySelector('.promedio-cell');
        if (count > 0) {
            cell.textContent = promedio.toFixed(1);
            cell.className = `promedio-cell ${promedio >= 7 ? 'aprobado' : 'reprobado'}`;
            if (promedio >= 7) aprobados++; else reprobados++;
        } else {
            cell.textContent = '-';
            cell.className = 'promedio-cell';
        }
    });
    document.getElementById('statAprobados').textContent = aprobados;
    document.getElementById('statReprobados').textContent = reprobados;
}

const btnNuevaActividad = document.getElementById('btnNuevaActividad');
if (btnNuevaActividad) {
    btnNuevaActividad.addEventListener('click', () => {
        if (periodoCerrado) { mostrarToast('El período está cerrado. Reábrelo para agregar actividades.', 'error'); return; }
        document.getElementById('inputNombreActividad').value = '';
        document.getElementById('inputValorMaximo').value = '10';
        if (modalActividad) modalActividad.show();
    });
}

const btnCrearActividad = document.getElementById('btnCrearActividad');
if (btnCrearActividad) {
    btnCrearActividad.addEventListener('click', async () => {
        const nombre = document.getElementById('inputNombreActividad').value.trim();
        const valorMaximo = parseFloat(document.getElementById('inputValorMaximo').value);
        if (!nombre) { mostrarToast('Ingresa un nombre para la actividad', 'error'); return; }
        if (isNaN(valorMaximo) || valorMaximo <= 0) { mostrarToast('Valor máximo inválido', 'error'); return; }
        try {
            await addDoc(collection(db, 'actividades'), {
                nombre, valorMaximo, materia: materiaActual, grado: gradoActual,
                periodo: periodoActual, docenteId: usuarioActual.uid,
                orden: actividades.length, fechaCreacion: new Date().toISOString()
            });
            if (modalActividad) modalActividad.hide();
            mostrarToast('Actividad creada correctamente', 'success');
            await cargarActividades();
        } catch (error) {
            console.error('Error:', error);
            mostrarToast('Error al crear la actividad', 'error');
        }
    });
}

window.eliminarActividad = async (id) => {
    if (periodoCerrado) { mostrarToast('El período está cerrado', 'error'); return; }
    if (!confirm('¿Eliminar esta actividad y todas sus notas?')) return;
    try {
        await deleteDoc(doc(db, 'actividades', id));
        const q = query(collection(db, 'notas'), where('actividadId', '==', id));
        const snapshot = await getDocs(q);
        const batch = writeBatch(db);
        snapshot.forEach(d => batch.delete(d.ref));
        await batch.commit();
        mostrarToast('Actividad eliminada', 'success');
        await cargarActividades();
    } catch (error) {
        console.error('Error:', error);
        mostrarToast('Error al eliminar la actividad', 'error');
    }
};

const btnGuardarTodo = document.getElementById('btnGuardarTodo');
if (btnGuardarTodo) {
    btnGuardarTodo.addEventListener('click', async () => {
        if (periodoCerrado) { mostrarToast('El período está cerrado', 'error'); return; }
        if (!materiaActual || !gradoActual) { mostrarToast('Selecciona materia y grado', 'error'); return; }
        if (actividades.length === 0) { mostrarToast('No hay actividades para guardar', 'error'); return; }

        btnGuardarTodo.disabled = true;
        btnGuardarTodo.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Guardando...';

        try {
            const batch = writeBatch(db);
            const notasRef = collection(db, 'notas');
            for (const alumnoId in notas) {
                for (const actividadId in notas[alumnoId]) {
                    const nota = notas[alumnoId][actividadId];
                    if (nota === '' || nota === undefined) continue;
                    const q = query(notasRef, where('actividadId', '==', actividadId), where('alumnoId', '==', alumnoId));
                    const existing = await getDocs(q);
                    const notaData = {
                        actividadId, alumnoId, nota: parseFloat(nota),
                        materia: materiaActual, grado: gradoActual, periodo: periodoActual,
                        docenteId: usuarioActual.uid, fechaActualizacion: new Date().toISOString()
                    };
                    if (existing.empty) batch.set(doc(notasRef), notaData);
                    else batch.update(existing.docs[0].ref, notaData);
                }
            }
            await batch.commit();
            mostrarToast(`Calificaciones guardadas (Período ${periodoActual})`, 'success');
        } catch (error) {
            console.error('Error:', error);
            mostrarToast('Error al guardar: ' + error.message, 'error');
        }
        btnGuardarTodo.disabled = false;
        btnGuardarTodo.innerHTML = '<i class="bi bi-cloud-arrow-up-fill"></i> Guardar Todo';
    });
}

const btnCerrarPeriodo = document.getElementById('btnCerrarPeriodo');
if (btnCerrarPeriodo) {
    btnCerrarPeriodo.addEventListener('click', async () => {
        if (!confirm(`¿Cerrar el Período ${periodoActual}?\n\nPodrás reabrirlo más tarde si lo necesitas.`)) return;
        try {
            await addDoc(collection(db, 'periodosCerrados'), {
                docenteId: usuarioActual.uid, materia: materiaActual,
                grado: gradoActual, periodo: periodoActual,
                fechaCierre: new Date().toISOString()
            });
            mostrarToast(`Período ${periodoActual} cerrado correctamente`, 'success');
            await cargarActividades();
        } catch (error) {
            console.error('Error:', error);
            mostrarToast('Error al cerrar el período', 'error');
        }
    });
}

const btnReabrirPeriodo = document.getElementById('btnReabrirPeriodo');
if (btnReabrirPeriodo) {
    btnReabrirPeriodo.addEventListener('click', async () => {
        if (!confirm(`¿Reabrir el Período ${periodoActual}?\n\nPodrás volver a editar las notas.`)) return;
        if (!documentoPeriodoCerradoId) {
            mostrarToast('No se encontró el registro del período cerrado', 'error');
            return;
        }
        try {
            await deleteDoc(doc(db, 'periodosCerrados', documentoPeriodoCerradoId));
            mostrarToast(`Período ${periodoActual} reabierto correctamente`, 'success');
            await cargarActividades();
        } catch (error) {
            console.error('Error:', error);
            mostrarToast('Error al reabrir el período', 'error');
        }
    });
}

// DESCARGAR PDF
const btnDescargarPDF = document.getElementById('btnDescargarPDF');
if (btnDescargarPDF) {
    btnDescargarPDF.addEventListener('click', async () => {
        if (!materiaActual || !gradoActual || alumnos.length === 0) {
            mostrarToast('Selecciona materia y grado con alumnos', 'error');
            return;
        }
        if (actividades.length === 0) {
            mostrarToast('No hay actividades para generar el PDF', 'error');
            return;
        }

        mostrarToast('Generando PDF...', 'info');

        try {
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

            let nombreMateria = materiaActual;
            if (materiaActual.startsWith('modulo_')) {
                const selectMat = document.getElementById('selectMateria');
                const idx = selectMat ? selectMat.selectedIndex : -1;
                if (idx !== -1) nombreMateria = selectMat.options[idx].textContent;
            }

            pdf.setFontSize(12);
            pdf.text(`Calificaciones - ${nombreMateria} | ${gradoActual}`, 14, 35);
            pdf.setFontSize(9);
            pdf.setTextColor(100, 100, 100);
            pdf.text(`Período ${periodoActual}  |  Docente: ${usuarioActual.nombre}  |  Fecha: ${new Date().toLocaleDateString('es-SV')}`, 14, 42);

            const headers = [['#', 'Alumno', ...actividades.map(a => `${a.nombre} (/${a.valorMaximo})`), 'Promedio', 'Estado']];
            const body = alumnos.map((alumno, i) => {
                const row = [i + 1, alumno.nombre];
                let suma = 0, count = 0;
                actividades.forEach(act => {
                    const nota = notas[alumno.id]?.[act.id];
                    if (nota !== undefined && nota !== '') {
                        row.push(parseFloat(nota).toFixed(1));
                        const valorMax = parseFloat(act.valorMaximo) || 10;
                        suma += (parseFloat(nota) / valorMax) * 10;
                        count++;
                    } else {
                        row.push('-');
                    }
                });
                const promedio = count > 0 ? (suma / count) : 0;
                row.push(count > 0 ? promedio.toFixed(1) : '-');
                row.push(count > 0 ? (promedio >= 7 ? 'Aprobado' : 'Reprobado') : 'Sin notas');
                return row;
            });

            pdf.autoTable({
                head: headers,
                body: body,
                startY: 48,
                theme: 'grid',
                headStyles: { fillColor: [99, 102, 241], textColor: 255, fontStyle: 'bold', fontSize: 8 },
                bodyStyles: { fontSize: 8 },
                styles: { cellPadding: 2 },
                didParseCell: function(data) {
                    if (data.section === 'body') {
                        if (data.column.index === data.table.columns.length - 1) {
                            if (data.cell.raw === 'Aprobado') data.cell.styles.textColor = [16, 185, 129];
                            else if (data.cell.raw === 'Reprobado') data.cell.styles.textColor = [239, 68, 68];
                        }
                    }
                }
            });

            const finalY = pdf.lastAutoTable.finalY + 8;
            const aprobados = body.filter(r => r[r.length - 1] === 'Aprobado').length;
            const reprobados = body.filter(r => r[r.length - 1] === 'Reprobado').length;
            pdf.setFontSize(9);
            pdf.setTextColor(40, 40, 40);
            pdf.text(`Total: ${alumnos.length} alumnos   |   Aprobados: ${aprobados}   |   Reprobados: ${reprobados}`, 14, finalY);

            const nombreArchivo = `Notas_${nombreMateria.replace(/[^a-zA-Z0-9]/g, '_')}_${gradoActual.replace(/[^a-zA-Z0-9]/g, '_')}_P${periodoActual}.pdf`;
            pdf.save(nombreArchivo);
            mostrarToast('PDF generado correctamente', 'success');
        } catch (error) {
            console.error(error);
            mostrarToast('Error al generar PDF: ' + error.message, 'error');
        }
    });
}

document.querySelectorAll('.period-tab').forEach(tab => {
    tab.addEventListener('click', async () => {
        document.querySelectorAll('.period-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        periodoActual = parseInt(tab.dataset.periodo);
        if (materiaActual && gradoActual) await cargarActividades();
    });
});

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
