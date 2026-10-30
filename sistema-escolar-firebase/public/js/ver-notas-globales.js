import { 
    auth, 
    db, 
    signOut, 
    onAuthStateChanged, 
    collection, 
    query, 
    where, 
    getDocs, 
    getDoc, 
    doc 
} from './firebase-config.js';

let datosProcesados = [];
let materiasEncontradas = [];

onAuthStateChanged(auth, async (user) => {
    if (!user) { window.location.href = 'index.html'; return; }
    try {
        const userDoc = await getDoc(doc(db, 'usuarios', user.uid));
        if (!userDoc.exists()) { window.location.href = 'index.html'; return; }
        const userData = userDoc.data();
        if (userData.rol !== 'admin') { window.location.href = 'dashboard.html'; return; }

        const userNameEl = document.getElementById('userName');
        const userAvatarEl = document.getElementById('userAvatar');
        
        if (userNameEl) userNameEl.textContent = userData.nombre || userData.nombreCompleto;
        if (userAvatarEl) userAvatarEl.textContent = (userData.nombre || userData.nombreCompleto || 'A').charAt(0).toUpperCase();

        await cargarGradosDisponibles();
    } catch (error) {
        console.error('Error al verificar autenticación:', error);
    } finally {
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) setTimeout(() => { overlay.style.display = 'none'; }, 800);
    }
});

async function cargarGradosDisponibles() {
    try {
        const snapAlumnos = await getDocs(collection(db, 'alumnos'));
        const gradosSet = new Set();
        snapAlumnos.forEach(d => { if (d.data().grado) gradosSet.add(d.data().grado); });
        
        const selectGrado = document.getElementById('selectGrado');
        if (selectGrado) {
            selectGrado.innerHTML = '<option value="">Selecciona un grado...</option>';
            Array.from(gradosSet).sort().forEach(g => {
                const opt = document.createElement('option');
                opt.value = g; opt.textContent = g;
                selectGrado.appendChild(opt);
            });
        }
    } catch (error) {
        console.error('Error cargando grados:', error);
    }
}

const btnBuscar = document.getElementById('btnBuscar');
if (btnBuscar) {
    btnBuscar.addEventListener('click', cargarDatos);
}

async function cargarDatos() {
    const selectGrado = document.getElementById('selectGrado');
    const selectPeriodo = document.getElementById('selectPeriodo');
    
    const grado = selectGrado ? selectGrado.value : '';
    const periodo = selectPeriodo ? parseInt(selectPeriodo.value) : 1;

    if (!grado) { alert('Selecciona un grado'); return; }

    const loadingOverlay = document.getElementById('loadingOverlay');
    const statsGrid = document.getElementById('statsGrid');
    const tableCard = document.getElementById('tableCard');
    const emptyState = document.getElementById('emptyState');
    const btnExportarPDF = document.getElementById('btnExportarPDF');

    if (loadingOverlay) loadingOverlay.style.display = 'flex';
    if (statsGrid) statsGrid.style.display = 'none';
    if (tableCard) tableCard.style.display = 'none';
    if (emptyState) emptyState.style.display = 'none';
    if (btnExportarPDF) btnExportarPDF.disabled = true;

    try {
        // 1. Obtener alumnos del grado
        const qAlumnos = query(collection(db, 'alumnos'), where('grado', '==', grado));
        const snapAlumnos = await getDocs(qAlumnos);
        const alumnos = [];
        snapAlumnos.forEach(docSnap => alumnos.push({ id: docSnap.id, ...docSnap.data() }));
        alumnos.sort((a, b) => a.nombre.localeCompare(b.nombre));

        if (alumnos.length === 0) { mostrarVacio(); return; }

        // 2. Obtener TODAS las notas del grado y período
        const qNotas = query(
            collection(db, 'notas'),
            where('grado', '==', grado),
            where('periodo', '==', periodo)
        );
        const snapNotas = await getDocs(qNotas);
        
        const notasPorAlumno = {};
        const materiasSet = new Set();
        
        snapNotas.forEach(docSnap => {
            const data = docSnap.data();
            if (!notasPorAlumno[data.alumnoId]) notasPorAlumno[data.alumnoId] = {};
            if (!notasPorAlumno[data.alumnoId][data.materia]) notasPorAlumno[data.alumnoId][data.materia] = [];
            notasPorAlumno[data.alumnoId][data.materia].push(parseFloat(data.nota));
            materiasSet.add(data.materia);
        });

        // 3. Lista de materias únicas
        materiasEncontradas = Array.from(materiasSet).sort();

        if (materiasEncontradas.length === 0) { mostrarVacio(); return; }

        // 4. Calcular promedios finales por materia para cada alumno
        datosProcesados = [];
        let aprobados = 0, reprobados = 0;

        alumnos.forEach(alumno => {
            const fila = { nombre: alumno.nombre, promediosMaterias: {}, promedioGeneral: 0, estado: 'Pendiente' };
            let sumaPromedios = 0, countMaterias = 0;

            materiasEncontradas.forEach(materia => {
                const notasMateria = notasPorAlumno[alumno.id]?.[materia] || [];
                
                if (notasMateria.length > 0) {
                    const sumaNotas = notasMateria.reduce((sum, nota) => sum + nota, 0);
                    const promedioMateria = sumaNotas / notasMateria.length;
                    
                    fila.promediosMaterias[materia] = promedioMateria;
                    sumaPromedios += promedioMateria;
                    countMaterias++;
                } else {
                    fila.promediosMaterias[materia] = null;
                }
            });

            if (countMaterias > 0) {
                fila.promedioGeneral = sumaPromedios / countMaterias;
                fila.estado = fila.promedioGeneral >= 7.0 ? 'Aprobado' : 'Reprobado';
                if (fila.estado === 'Aprobado') aprobados++;
                else reprobados++;
            }
            datosProcesados.push(fila);
        });

        renderizarTabla();
        actualizarEstadisticas(alumnos.length, aprobados, reprobados);
        
        if (statsGrid) statsGrid.style.display = 'grid';
        if (tableCard) tableCard.style.display = 'block';
        if (btnExportarPDF) btnExportarPDF.disabled = false;

    } catch (error) {
        console.error('Error:', error);
        alert('Error al cargar datos: ' + error.message);
    } finally {
        if (loadingOverlay) loadingOverlay.style.display = 'none';
    }
}

function formatearNombreMateria(materia) {
    if (materia.startsWith('modulo_')) {
        const num = materia.replace('modulo_', '');
        return `Módulo ${num}`;
    }
    return materia;
}

function renderizarTabla() {
    const headerRow = document.getElementById('tablaHeader');
    if (!headerRow) return;

    headerRow.innerHTML = '<th>Nombre del Alumno</th>';
    
    materiasEncontradas.forEach(materia => {
        headerRow.innerHTML += `<th>${formatearNombreMateria(materia)}</th>`;
    });
    headerRow.innerHTML += '<th>Promedio General</th><th>Estado</th>';

    const tbody = document.getElementById('tablaBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    datosProcesados.forEach(fila => {
        let rowHtml = `<tr><td>${fila.nombre}</td>`;
        
        materiasEncontradas.forEach(materia => {
            const promedio = fila.promediosMaterias[materia];
            if (promedio === null || promedio === undefined) {
                rowHtml += `<td class="nota-vacia">-</td>`;
            } else {
                const clase = promedio >= 7.0 ? 'nota-aprobada' : 'nota-reprobada';
                rowHtml += `<td class="${clase}">${promedio.toFixed(1)}</td>`;
            }
        });

        const badgeClass = fila.estado === 'Aprobado' ? 'badge-aprobado' : (fila.estado === 'Reprobado' ? 'badge-reprobado' : '');
        const promDisplay = fila.promedioGeneral > 0 ? fila.promedioGeneral.toFixed(1) : '-';
        const promClass = fila.promedioGeneral >= 7.0 ? 'nota-aprobada' : (fila.promedioGeneral > 0 ? 'nota-reprobada' : 'nota-vacia');

        rowHtml += `<td class="${promClass}">${promDisplay}</td>`;
        rowHtml += `<td><span class="badge-estado ${badgeClass}">${fila.estado}</span></td></tr>`;
        tbody.innerHTML += rowHtml;
    });
}

function actualizarEstadisticas(total, aprobados, reprobados) {
    const statTotal = document.getElementById('statTotal');
    const statAprobados = document.getElementById('statAprobados');
    const statReprobados = document.getElementById('statReprobados');
    const statPorcentaje = document.getElementById('statPorcentaje');

    if (statTotal) statTotal.textContent = total;
    if (statAprobados) statAprobados.textContent = aprobados;
    if (statReprobados) statReprobados.textContent = reprobados;
    
    const conNota = aprobados + reprobados;
    const porcentaje = conNota > 0 ? ((aprobados / conNota) * 100).toFixed(1) : 0;
    if (statPorcentaje) statPorcentaje.textContent = `${porcentaje}%`;
}

function mostrarVacio() {
    const emptyState = document.getElementById('emptyState');
    const btnExportarPDF = document.getElementById('btnExportarPDF');
    if (emptyState) emptyState.style.display = 'block';
    if (btnExportarPDF) btnExportarPDF.disabled = true;
}

// EXPORTAR PDF
const btnExportarPDF = document.getElementById('btnExportarPDF');
if (btnExportarPDF) {
    btnExportarPDF.addEventListener('click', async () => {
        const { jsPDF } = window.jspdf;
        const pdfDoc = new jsPDF('l', 'mm', 'a4');

        const selectGrado = document.getElementById('selectGrado');
        const selectPeriodo = document.getElementById('selectPeriodo');
        
        const grado = selectGrado ? selectGrado.value : '';
        const periodo = selectPeriodo ? selectPeriodo.options[selectPeriodo.selectedIndex].text : '';

        // Intentar cargar logo
        let logoImg = null;
        try {
            const logoResp = await fetch('img/fondos/logo.png');
            if (logoResp.ok) {
                const logoBlob = await logoResp.blob();
                logoImg = await new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result);
                    reader.readAsDataURL(logoBlob);
                });
            }
        } catch (e) { console.log('Logo no disponible'); }

        // Encabezado
        if (logoImg) pdfDoc.addImage(logoImg, 'PNG', 14, 10, 20, 20);
        pdfDoc.setFontSize(16);
        pdfDoc.setTextColor(40, 40, 40);
        pdfDoc.text("Complejo Educativo Thomas Jefferson", logoImg ? 38 : 14, 18);
        pdfDoc.setFontSize(12);
        pdfDoc.text("Sistema de Gestión Académica", logoImg ? 38 : 14, 26);
        pdfDoc.setFontSize(14);
        pdfDoc.text(`Reporte de Calificaciones - ${grado}`, 14, 42);
        pdfDoc.setFontSize(10);
        pdfDoc.setTextColor(100, 100, 100);
        pdfDoc.text(`${periodo} | Fecha: ${new Date().toLocaleDateString('es-SV')}`, 14, 48);

        // Construir tabla
        const headers = [['#', 'Alumno', ...materiasEncontradas.map(m => formatearNombreMateria(m)), 'Prom. Gral.', 'Estado']];
        
        const body = datosProcesados.map((fila, idx) => {
            const row = [idx + 1, fila.nombre];
            materiasEncontradas.forEach(materia => {
                const promedio = fila.promediosMaterias[materia];
                row.push(promedio !== null && promedio !== undefined ? promedio.toFixed(1) : '-');
            });
            const promDisplay = fila.promedioGeneral > 0 ? fila.promedioGeneral.toFixed(1) : '-';
            row.push(promDisplay, fila.estado);
            return row;
        });

        pdfDoc.autoTable({
            head: headers, body: body, startY: 55, theme: 'grid',
            headStyles: { fillColor: [99, 102, 241], textColor: 255, fontStyle: 'bold', fontSize: 9 },
            bodyStyles: { fontSize: 9, textColor: 50 },
            alternateRowStyles: { fillColor: [240, 240, 245] },
            columnStyles: { 0: { cellWidth: 10 }, 1: { cellWidth: 50 } },
            didParseCell: function(data) {
                if (data.section === 'body') {
                    const val = parseFloat(data.cell.raw);
                    if (!isNaN(val) && data.column.index > 1 && data.column.index < data.table.columns.length - 2) {
                        data.cell.styles.textColor = val >= 7.0 ? [16, 185, 129] : [239, 68, 68];
                        data.cell.styles.fontStyle = 'bold';
                    }
                    if (data.column.index === data.table.columns.length - 1) {
                        if (data.cell.raw === 'Aprobado') data.cell.styles.textColor = [16, 185, 129];
                        else if (data.cell.raw === 'Reprobado') data.cell.styles.textColor = [239, 68, 68];
                    }
                }
            }
        });

        const pageCount = pdfDoc.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            pdfDoc.setPage(i);
            pdfDoc.setFontSize(8);
            pdfDoc.setTextColor(150, 150, 150);
            pdfDoc.text(`Página ${i} de ${pageCount} - Sistema Escolar Thomas Jefferson`, pdfDoc.internal.pageSize.getWidth() - 60, pdfDoc.internal.pageSize.getHeight() - 10);
        }

        pdfDoc.save(`Notas_${grado.replace(/[^a-zA-Z0-9]/g, '_')}_P${selectPeriodo.value}.pdf`);
    });
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
