import { 
    auth, 
    db, 
    onAuthStateChanged, 
    doc, 
    getDoc, 
    updateDoc 
} from './firebase-config.js';

const materiasRegulares = [
    "Rutinas diarias (Parvularia)", "Matemáticas", "Informática", "Lenguaje", "Sociales", "Ciencia",
    "Inglés", "OPV", "Seminario", "Arte", "Educación Física"
];

const gradosDisponibles = [
    'PARVULARIA 4 SECCIÓN "A"',
    'PARVULARIA 4 SECCIÓN "B"',
    'PARVULARIA 5 SECCIÓN "A"',
    'PARVULARIA 5 SECCIÓN "B"',
    'PARVULARIA 6 SECCIÓN "A"',
    'PARVULARIA 6 SECCIÓN "B"',
    "1º GRADO SECCIÓN A",
    "2º A",
    "3º A",
    "4º A",
    "5º A",
    "6º A",
    "7º A",
    "8º A",
    "9º A",
    '1° GENERAL SECCIÓN "A"',
    '1° GENERAL SECCIÓN "B"',
    "1° ADMINISTRATIVO CONTABLE A",
    '1° SALUD Y BIENESTAR SOCIAL SECCIÓN "A"',
    '1° SALUD Y BIENESTAR SOCIAL SECCIÓN "B"',
    "1° ITSI A",
    '1° SISTEMAS ELÉCTRICOS Y ENERGÍAS RENOVABLES "A"',
    '1° SISTEMAS ELÉCTRICOS "B"',
    "2° GENERAL A",
    "2° ADMINISTRATIVO CONTABLE",
    '2° SALUD Y BIENESTAR SOCIAL SECCIÓN "A"',
    '2° SALUD Y BIENESTAR SOCIAL SECCIÓN "B"',
    "2° ITSI A",
    '2° SISTEMAS ELÉCTRICOS Y ENERGÍAS RENOVABLES "A"',
    '2° SISTEMAS ELÉCTRICOS Y ENERGÍAS RENOVABLES "B"',
    "3° ADMINISTRATIVO CONTABLE",
    "3° ITSI A",
    '3° SISTEMAS ELÉCTRICOS "A"',
    '3° SISTEMAS ELÉCTRICOS "B"',
    '3° ATENCIÓN PRIMARIA EN SALUD "A"',
    '3° ATENCIÓN PRIMARIA EN SALUD "B"'
];

let usuarioActual = null;
let fotoBase64 = null;

function generarIdSeguro(texto) {
    return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]/g, "");
}

function mostrarToast(mensaje, tipo) {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast-notification ${tipo}`;
    const icono = tipo === 'success' ? '✅' : '❌';
    toast.innerHTML = `${icono} <span>${mensaje}</span>`;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
}

function crearCheckboxGrado(grado, materiaId) {
    const safeId = `grade_${generarIdSeguro(grado)}_${materiaId}`;
    const label = document.createElement('label');
    label.className = 'grade-check';
    label.innerHTML = `<input type="checkbox" value="${grado}" id="${safeId}"><span>${grado}</span>`;
    label.addEventListener('click', (e) => {
        e.preventDefault();
        const cb = label.querySelector('input');
        cb.checked = !cb.checked;
    });
    return label;
}

function inicializarUI() {
    const selectEncargado = document.getElementById('gradoEncargado');
    if (selectEncargado) {
        gradosDisponibles.forEach(g => {
            const opt = document.createElement('option');
            opt.value = g;
            opt.textContent = g;
            selectEncargado.appendChild(opt);
        });
    }

    const listaMaterias = document.getElementById('listaMaterias');
    if (listaMaterias) {
        materiasRegulares.forEach(materia => {
            const div = document.createElement('div');
            div.className = 'mb-3';
            const materiaId = generarIdSeguro(materia);

            div.innerHTML = `
                <div class="subject-checkbox" data-materia-id="${materiaId}">
                    <input type="checkbox" id="check_${materiaId}" class="check-materia" data-materia="${materia}">
                    <label for="check_${materiaId}">${materia}</label>
                </div>
                <div class="grades-assignment" id="asignacion_${materiaId}">
                    <div class="select-all-container" data-target="${materiaId}">
                        <input type="checkbox" class="select-all-grades" data-target="${materiaId}">
                        <span>Seleccionar todos los grados</span>
                    </div>
                    <label class="form-label">Grados donde impartes ${materia}:</label>
                    <div class="grados-container" data-materia="${materia}"></div>
                </div>
            `;
            listaMaterias.appendChild(div);

            const box = div.querySelector('.subject-checkbox');
            const check = div.querySelector('.check-materia');
            box.addEventListener('click', (e) => {
                e.preventDefault();
                check.checked = !check.checked;
                const asignacion = document.getElementById(`asignacion_${materiaId}`);
                if (check.checked) asignacion.classList.add('active');
                else asignacion.classList.remove('active');
            });
        });
    }

    document.querySelectorAll('.grados-container').forEach(container => {
        if (container.id === 'gradosModulo') return;
        const materia = container.dataset.materia;
        const materiaId = generarIdSeguro(materia);
        gradosDisponibles.forEach(grado => {
            container.appendChild(crearCheckboxGrado(grado, materiaId));
        });
    });

    const gradosModulo = document.getElementById('gradosModulo');
    if (gradosModulo) {
        gradosDisponibles.forEach(grado => {
            gradosModulo.appendChild(crearCheckboxGrado(grado, 'modulo'));
        });
    }

    document.querySelectorAll('.select-all-container').forEach(box => {
        if (box.id === 'selectAllModuloBox') return;
        const targetId = box.dataset.target;
        const selectAll = box.querySelector('.select-all-grades');
        box.addEventListener('click', (e) => {
            e.preventDefault();
            selectAll.checked = !selectAll.checked;
            const container = document.getElementById(`asignacion_${targetId}`);
            if (container) {
                container.querySelectorAll('.grade-check input[type="checkbox"]').forEach(cb => {
                    cb.checked = selectAll.checked;
                });
            }
        });
    });

    const boxModulo = document.getElementById('boxModulo');
    const checkModulo = document.getElementById('checkModulo');
    if (boxModulo && checkModulo) {
        boxModulo.addEventListener('click', (e) => {
            e.preventDefault();
            checkModulo.checked = !checkModulo.checked;
            const asignacion = document.getElementById('asignacionModulo');
            if (checkModulo.checked) asignacion.classList.add('active');
            else asignacion.classList.remove('active');
        });
    }

    const selectAllModuloBox = document.getElementById('selectAllModuloBox');
    const selectAllModulo = document.getElementById('selectAllModulo');
    if (selectAllModuloBox && selectAllModulo) {
        selectAllModuloBox.addEventListener('click', (e) => {
            e.preventDefault();
            selectAllModulo.checked = !selectAllModulo.checked;
            document.querySelectorAll('#gradosModulo .grade-check input[type="checkbox"]').forEach(cb => {
                cb.checked = selectAllModulo.checked;
            });
        });
    }
}

function cargarDatosExistentes() {
    if (!usuarioActual) return;
    const nombre = usuarioActual.nombre || usuarioActual.nombreCompleto || 'D';
    const preview = document.getElementById('photoPreview');

    if (preview) {
        if (usuarioActual.fotoPerfil) {
            fotoBase64 = usuarioActual.fotoPerfil;
            preview.innerHTML = `<img src="${usuarioActual.fotoPerfil}" alt="Foto">`;
        } else {
            preview.textContent = nombre.charAt(0).toUpperCase();
        }
    }

    const gradoEncargado = document.getElementById('gradoEncargado');
    if (gradoEncargado && (usuarioActual.gradoEncargado || usuarioActual.grado)) {
        gradoEncargado.value = usuarioActual.gradoEncargado || usuarioActual.grado;
    }

    if (!usuarioActual.materiasImpartidas) return;

    usuarioActual.materiasImpartidas.forEach(asignacion => {
        if (asignacion.nombre === "Módulo") {
            const checkModulo = document.getElementById('checkModulo');
            const asignacionModulo = document.getElementById('asignacionModulo');
            const numeroModulo = document.getElementById('numeroModulo');
            const nombreModulo = document.getElementById('nombreModulo');

            if (checkModulo) checkModulo.checked = true;
            if (asignacionModulo) asignacionModulo.classList.add('active');
            if (numeroModulo) numeroModulo.value = asignacion.numero || 1;
            if (nombreModulo) nombreModulo.value = asignacion.nombrePersonalizado || '';

            (asignacion.grados || []).forEach(g => {
                const safeId = `grade_${generarIdSeguro(g)}_modulo`;
                const checkbox = document.getElementById(safeId);
                if (checkbox) checkbox.checked = true;
            });
        } else {
            const materiaId = generarIdSeguro(asignacion.nombre);
            const check = document.getElementById(`check_${materiaId}`);
            if (check) {
                check.checked = true;
                const asignacionBox = document.getElementById(`asignacion_${materiaId}`);
                if (asignacionBox) asignacionBox.classList.add('active');
                
                (asignacion.grados || []).forEach(g => {
                    const safeId = `grade_${generarIdSeguro(g)}_${materiaId}`;
                    const checkbox = document.getElementById(safeId);
                    if (checkbox) checkbox.checked = true;
                });
            }
        }
    });
}

const btnElegirFoto = document.getElementById('btnElegirFoto');
const inputFoto = document.getElementById('inputFoto');

if (btnElegirFoto && inputFoto) {
    btnElegirFoto.addEventListener('click', () => inputFoto.click());

    inputFoto.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size > 500 * 1024) {
            mostrarToast('La imagen debe pesar menos de 500 KB', 'error');
            e.target.value = '';
            return;
        }
        if (!file.type.startsWith('image/')) {
            mostrarToast('Solo se permiten imágenes', 'error');
            return;
        }
        const reader = new FileReader();
        reader.onload = () => {
            fotoBase64 = reader.result;
            const preview = document.getElementById('photoPreview');
            if (preview) preview.innerHTML = `<img src="${fotoBase64}" alt="Foto">`;
        };
        reader.readAsDataURL(file);
    });
}

onAuthStateChanged(auth, async (user) => {
    if (!user) { window.location.href = 'index.html'; return; }
    try {
        const userDoc = await getDoc(doc(db, 'usuarios', user.uid));
        if (!userDoc.exists()) { window.location.href = 'index.html'; return; }
        const data = userDoc.data();
        if (data.activo === false) {
            window.location.href = 'index.html';
            return;
        }
        usuarioActual = { uid: user.uid, ...data };
        inicializarUI();
        cargarDatosExistentes();
    } catch (error) {
        console.error('Error al cargar perfil:', error);
        mostrarToast('Error al cargar los datos del perfil', 'error');
    }
});

const formConfiguracion = document.getElementById('formConfiguracion');
if (formConfiguracion) {
    formConfiguracion.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('btnGuardar');
        const originalBtnText = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Guardando...';

        try {
            const gradoEncargadoVal = document.getElementById('gradoEncargado').value || null;
            const materiasImpartidas = [];

            document.querySelectorAll('.check-materia:checked').forEach(check => {
                const materia = check.dataset.materia;
                const materiaId = generarIdSeguro(materia);
                const grados = [];
                document.querySelectorAll(`#asignacion_${materiaId} .grade-check input:checked`).forEach(g => {
                    grados.push(g.value);
                });
                if (grados.length > 0) {
                    materiasImpartidas.push({ nombre: materia, grados: grados });
                }
            });

            const checkModuloEl = document.getElementById('checkModulo');
            if (checkModuloEl && checkModuloEl.checked) {
                const numero = document.getElementById('numeroModulo').value;
                const nombre = document.getElementById('nombreModulo').value.trim();
                const grados = [];
                document.querySelectorAll('#gradosModulo .grade-check input:checked').forEach(g => {
                    grados.push(g.value);
                });
                
                if (nombre && grados.length > 0) {
                    materiasImpartidas.push({
                        nombre: "Módulo",
                        numero: parseInt(numero),
                        nombrePersonalizado: nombre,
                        grados: grados
                    });
                } else if (!nombre || grados.length === 0) {
                    mostrarToast('Completa nombre y grados del módulo técnico', 'error');
                    btn.disabled = false;
                    btn.innerHTML = originalBtnText;
                    return;
                }
            }

            if (materiasImpartidas.length === 0 && !gradoEncargadoVal) {
                mostrarToast('Debes seleccionar al menos una materia o un grado a cargo', 'error');
                btn.disabled = false;
                btn.innerHTML = originalBtnText;
                return;
            }

            const datosUpdate = {
                perfilConfigurado: true,
                gradoEncargado: gradoEncargadoVal,
                materiasImpartidas: materiasImpartidas,
                fechaActualizacion: new Date().toISOString()
            };

            if (fotoBase64) {
                datosUpdate.fotoPerfil = fotoBase64;
            }

            await updateDoc(doc(db, 'usuarios', usuarioActual.uid), datosUpdate);

            const usuarioLocal = JSON.parse(localStorage.getItem('usuario') || '{}');
            usuarioLocal.grado = gradoEncargadoVal;
            usuarioLocal.materiasImpartidas = materiasImpartidas;
            usuarioLocal.perfilConfigurado = true;
            if (fotoBase64) usuarioLocal.fotoPerfil = fotoBase64;
            localStorage.setItem('usuario', JSON.stringify(usuarioLocal));

            mostrarToast('¡Perfil actualizado exitosamente!', 'success');
            setTimeout(() => { window.location.href = 'dashboard.html'; }, 1500);
        } catch (error) {
            console.error('Error detallado:', error);
            mostrarToast('Error al guardar: ' + error.message, 'error');
            btn.disabled = false;
            btn.innerHTML = originalBtnText;
        }
    });
}
