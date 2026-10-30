import {
    auth,
    db,
    onAuthStateChanged,
    doc,
    getDoc,
    updateDoc
} from './firebase-config.js';

const materiasRegulares = [
    "Rutinas diarias (Parvularia)",
    "Matemáticas",
    "Informática",
    "Lenguaje",
    "Sociales",
    "Ciencia",
    "Inglés",
    "OPV",
    "Seminario",
    "Arte",
    "Educación Física"
];

/* Nombres alineados con admin.js (sin comillas internas que rompen el HTML) */
const gradosDisponibles = [
    "PARVULARIA 4 SECCIÓN A",
    "PARVULARIA 4 SECCIÓN B",
    "PARVULARIA 5 SECCIÓN A",
    "PARVULARIA 5 SECCIÓN B",
    "PARVULARIA 6 SECCIÓN A",
    "PARVULARIA 6 SECCIÓN B",
    "1º GRADO SECCIÓN A",
    "2º A",
    "3º A",
    "4º A",
    "5º A",
    "6º A",
    "7º A",
    "8º A",
    "9º A",
    "1° GENERAL SECCIÓN A",
    "1° GENERAL SECCIÓN B",
    "1° ADMINISTRATIVO CONTABLE A",
    "1° SALUD Y BIENESTAR SOCIAL SECCIÓN A",
    "1° SALUD Y BIENESTAR SOCIAL SECCIÓN B",
    "1° ITSI A",
    "1° SISTEMAS ELÉCTRICOS Y ENERGÍAS RENOVABLES A",
    "1° SISTEMAS ELÉCTRICOS B",
    "2° GENERAL A",
    "2° ADMINISTRATIVO CONTABLE",
    "2° SALUD Y BIENESTAR SOCIAL SECCIÓN A",
    "2° SALUD Y BIENESTAR SOCIAL SECCIÓN B",
    "2° ITSI A",
    "2° SISTEMAS ELÉCTRICOS Y ENERGÍAS RENOVABLES A",
    "2° SISTEMAS ELÉCTRICOS Y ENERGÍAS RENOVABLES B",
    "3° ADMINISTRATIVO CONTABLE",
    "3° ITSI A",
    "3° SISTEMAS ELÉCTRICOS A",
    "3° SISTEMAS ELÉCTRICOS B",
    "3° ATENCIÓN PRIMARIA EN SALUD A",
    "3° ATENCIÓN PRIMARIA EN SALUD B"
];

let usuarioActual = null;
let fotoBase64 = null;

function generarIdSeguro(texto) {
    return String(texto || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9]/g, "");
}

function mostrarToast(mensaje, tipo) {
    const container = document.getElementById("toastContainer");
    if (!container) return;
    const toast = document.createElement("div");
    toast.className = `toast-notification ${tipo}`;
    toast.innerHTML = `${tipo === "success" ? "✅" : "❌"} <span>${mensaje}</span>`;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
}

function crearCheckboxGrado(grado, materiaId) {
    const safeId = `grade_${generarIdSeguro(grado)}_${materiaId}`;
    const label = document.createElement("label");
    label.className = "grade-check";
    label.style.cursor = "pointer";

    const input = document.createElement("input");
    input.type = "checkbox";
    input.value = grado;
    input.id = safeId;

    const span = document.createElement("span");
    span.textContent = grado;

    label.appendChild(input);
    label.appendChild(span);

    // Toda la etiqueta es clickeable (móvil / tacto)
    label.addEventListener("click", (e) => {
        if (e.target === input) return;
        e.preventDefault();
        input.checked = !input.checked;
        input.dispatchEvent(new Event("change", { bubbles: true }));
    });

    return label;
}

function inicializarUI() {
    const selectEncargado = document.getElementById("gradoEncargado");
    if (selectEncargado) {
        // evita duplicar opciones si se llama dos veces
        selectEncargado.innerHTML = '<option value="">-- Sin grado a cargo --</option>';
        gradosDisponibles.forEach((g) => {
            const opt = document.createElement("option");
            opt.value = g;
            opt.textContent = g;
            selectEncargado.appendChild(opt);
        });
    }

    const listaMaterias = document.getElementById("listaMaterias");
    if (listaMaterias) {
        listaMaterias.innerHTML = "";
        materiasRegulares.forEach((materia) => {
            const div = document.createElement("div");
            div.className = "mb-3";
            const materiaId = generarIdSeguro(materia);

            const box = document.createElement("div");
            box.className = "subject-checkbox";
            box.dataset.materiaId = materiaId;

            const check = document.createElement("input");
            check.type = "checkbox";
            check.id = `check_${materiaId}`;
            check.className = "check-materia";
            check.dataset.materia = materia;

            const lab = document.createElement("label");
            lab.htmlFor = `check_${materiaId}`;
            lab.textContent = materia;

            box.appendChild(check);
            box.appendChild(lab);

            const asignacion = document.createElement("div");
            asignacion.className = "grades-assignment";
            asignacion.id = `asignacion_${materiaId}`;

            const selectAll = document.createElement("div");
            selectAll.className = "select-all-container";
            selectAll.dataset.target = materiaId;
            selectAll.innerHTML = `
                <input type="checkbox" class="select-all-grades" data-target="${materiaId}">
                <span>Seleccionar todos los grados</span>
            `;

            const formLabel = document.createElement("label");
            formLabel.className = "form-label";
            formLabel.textContent = `Grados donde impartes ${materia}:`;

            const gradosCont = document.createElement("div");
            gradosCont.className = "grados-container";
            gradosCont.dataset.materia = materia;

            asignacion.appendChild(selectAll);
            asignacion.appendChild(formLabel);
            asignacion.appendChild(gradosCont);

            div.appendChild(box);
            div.appendChild(asignacion);
            listaMaterias.appendChild(div);

            box.addEventListener("click", (e) => {
                if (e.target === check || e.target.tagName === "LABEL") {
                    // label ya maneja el check nativo si for=id
                    if (e.target === check) {
                        // ok
                    }
                } else {
                    e.preventDefault();
                    check.checked = !check.checked;
                }
                if (check.checked) asignacion.classList.add("active");
                else asignacion.classList.remove("active");
            });

            check.addEventListener("change", () => {
                if (check.checked) asignacion.classList.add("active");
                else asignacion.classList.remove("active");
            });
        });
    }

    // Llenar checkboxes de grados en cada materia
    document.querySelectorAll(".grados-container").forEach((container) => {
        if (container.id === "gradosModulo") return;
        const materia = container.dataset.materia;
        const materiaId = generarIdSeguro(materia);
        container.innerHTML = "";
        gradosDisponibles.forEach((grado) => {
            container.appendChild(crearCheckboxGrado(grado, materiaId));
        });
    });

    // Módulo técnico
    const gradosModulo = document.getElementById("gradosModulo");
    if (gradosModulo) {
        gradosModulo.innerHTML = "";
        gradosDisponibles.forEach((grado) => {
            gradosModulo.appendChild(crearCheckboxGrado(grado, "modulo"));
        });
    }

    // Seleccionar todos
    document.querySelectorAll(".select-all-grades").forEach((sa) => {
        sa.addEventListener("change", () => {
            const target = sa.dataset.target;
            const box = document.getElementById(`asignacion_${target}`);
            if (!box) return;
            box.querySelectorAll(".grade-check input").forEach((cb) => {
                cb.checked = sa.checked;
            });
        });
    });

    const selectAllModulo = document.getElementById("selectAllModulo");
    if (selectAllModulo) {
        selectAllModulo.addEventListener("change", () => {
            document.querySelectorAll("#gradosModulo .grade-check input").forEach((cb) => {
                cb.checked = selectAllModulo.checked;
            });
        });
    }

    const checkModulo = document.getElementById("checkModulo");
    const asignacionModulo = document.getElementById("asignacionModulo");
    const boxModulo = document.getElementById("boxModulo");
    if (checkModulo && asignacionModulo) {
        const toggleModulo = () => {
            if (checkModulo.checked) asignacionModulo.classList.add("active");
            else asignacionModulo.classList.remove("active");
        };
        checkModulo.addEventListener("change", toggleModulo);
        if (boxModulo) {
            boxModulo.addEventListener("click", (e) => {
                if (e.target === checkModulo) return;
                if (e.target.closest("input, select, label.grade-check")) return;
                checkModulo.checked = !checkModulo.checked;
                toggleModulo();
            });
        }
    }
}

function cargarDatosExistentes(data) {
    if (!data) return;

    const selectEncargado = document.getElementById("gradoEncargado");
    if (selectEncargado && (data.gradoEncargado || data.grado)) {
        const g = data.gradoEncargado || data.grado;
        selectEncargado.value = g;
        // si el valor viejo tenía comillas, intentar sin ellas
        if (selectEncargado.value !== g) {
            const limpio = String(g).replace(/"/g, "").trim();
            for (const opt of selectEncargado.options) {
                if (opt.value.replace(/"/g, "") === limpio) {
                    selectEncargado.value = opt.value;
                    break;
                }
            }
        }
    }

    if (data.fotoPerfil) {
        fotoBase64 = data.fotoPerfil;
        const preview = document.getElementById("photoPreview");
        if (preview) preview.innerHTML = `<img src="${fotoBase64}" alt="Foto">`;
    }

    (data.materiasImpartidas || []).forEach((asignacion) => {
        if (asignacion.nombre === "Módulo") {
            const checkModulo = document.getElementById("checkModulo");
            const asignacionModulo = document.getElementById("asignacionModulo");
            const numeroModulo = document.getElementById("numeroModulo");
            const nombreModulo = document.getElementById("nombreModulo");
            if (checkModulo) checkModulo.checked = true;
            if (asignacionModulo) asignacionModulo.classList.add("active");
            if (numeroModulo) numeroModulo.value = asignacion.numero || 1;
            if (nombreModulo) nombreModulo.value = asignacion.nombrePersonalizado || "";

            (asignacion.grados || []).forEach((g) => {
                marcarGradoCheckbox(g, "modulo");
            });
        } else {
            const materiaId = generarIdSeguro(asignacion.nombre);
            const check = document.getElementById(`check_${materiaId}`);
            if (check) {
                check.checked = true;
                const asignacionBox = document.getElementById(`asignacion_${materiaId}`);
                if (asignacionBox) asignacionBox.classList.add("active");
                (asignacion.grados || []).forEach((g) => {
                    marcarGradoCheckbox(g, materiaId);
                });
            }
        }
    });
}

function marcarGradoCheckbox(grado, materiaId) {
    const limpio = String(grado || "").replace(/"/g, "").trim();
    const candidates = [
        `grade_${generarIdSeguro(grado)}_${materiaId}`,
        `grade_${generarIdSeguro(limpio)}_${materiaId}`
    ];
    for (const id of candidates) {
        const checkbox = document.getElementById(id);
        if (checkbox) {
            checkbox.checked = true;
            return;
        }
    }
    // búsqueda por value
    document.querySelectorAll(`input[type="checkbox"]`).forEach((cb) => {
        if (cb.id && cb.id.includes(materiaId) && String(cb.value).replace(/"/g, "").trim() === limpio) {
            cb.checked = true;
        }
    });
}

// Foto de perfil
const btnElegirFoto = document.getElementById("btnElegirFoto");
const inputFoto = document.getElementById("inputFoto");
if (btnElegirFoto && inputFoto) {
    btnElegirFoto.addEventListener("click", () => inputFoto.click());
    inputFoto.addEventListener("change", (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size > 500 * 1024) {
            mostrarToast("La imagen debe pesar menos de 500 KB", "error");
            e.target.value = "";
            return;
        }
        if (!file.type.startsWith("image/")) {
            mostrarToast("Solo se permiten imágenes", "error");
            return;
        }
        const reader = new FileReader();
        reader.onload = () => {
            fotoBase64 = reader.result;
            const preview = document.getElementById("photoPreview");
            if (preview) preview.innerHTML = `<img src="${fotoBase64}" alt="Foto">`;
        };
        reader.readAsDataURL(file);
    });
}

onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = "index.html";
        return;
    }
    try {
        const userDoc = await getDoc(doc(db, "usuarios", user.uid));
        if (!userDoc.exists()) {
            window.location.href = "index.html";
            return;
        }
        const data = userDoc.data();
        if (data.activo === false) {
            window.location.href = "index.html";
            return;
        }

        usuarioActual = {
            uid: user.uid,
            nombre: data.nombre || data.nombreCompleto || "",
            correo: data.correo || user.email,
            rol: data.rol || "docente",
            grado: data.gradoEncargado || data.grado || "",
            materiasImpartidas: data.materiasImpartidas || []
        };

        inicializarUI();
        cargarDatosExistentes(data);
    } catch (error) {
        console.error("Error al cargar perfil:", error);
        mostrarToast("Error al cargar el perfil: " + error.message, "error");
        // Aun así intenta mostrar materias/grados
        try {
            inicializarUI();
        } catch (e2) {
            console.error(e2);
        }
    }
});

const form = document.getElementById("formConfiguracion");
if (form) {
    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        if (!usuarioActual) {
            mostrarToast("Sesión no válida. Vuelve a iniciar sesión.", "error");
            return;
        }

        const btn = document.getElementById("btnGuardar");
        const originalBtnText = btn ? btn.innerHTML : "";
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Guardando...';
        }

        try {
            const gradoEncargadoVal = document.getElementById("gradoEncargado")?.value || null;
            const materiasImpartidas = [];

            document.querySelectorAll(".check-materia:checked").forEach((check) => {
                const materia = check.dataset.materia;
                const materiaId = generarIdSeguro(materia);
                const grados = [];
                document
                    .querySelectorAll(`#asignacion_${materiaId} .grade-check input:checked`)
                    .forEach((g) => grados.push(g.value));
                if (grados.length > 0) {
                    materiasImpartidas.push({ nombre: materia, grados });
                }
            });

            const checkModuloEl = document.getElementById("checkModulo");
            if (checkModuloEl && checkModuloEl.checked) {
                const numero = document.getElementById("numeroModulo")?.value;
                const nombre = document.getElementById("nombreModulo")?.value.trim();
                const grados = [];
                document
                    .querySelectorAll("#gradosModulo .grade-check input:checked")
                    .forEach((g) => grados.push(g.value));

                if (nombre && grados.length > 0) {
                    materiasImpartidas.push({
                        nombre: "Módulo",
                        numero: parseInt(numero, 10) || 1,
                        nombrePersonalizado: nombre,
                        grados
                    });
                } else {
                    mostrarToast("Completa nombre y grados del módulo técnico", "error");
                    if (btn) {
                        btn.disabled = false;
                        btn.innerHTML = originalBtnText;
                    }
                    return;
                }
            }

            if (materiasImpartidas.length === 0 && !gradoEncargadoVal) {
                mostrarToast("Debes seleccionar al menos una materia o un grado a cargo", "error");
                if (btn) {
                    btn.disabled = false;
                    btn.innerHTML = originalBtnText;
                }
                return;
            }

            const datosUpdate = {
                perfilConfigurado: true,
                gradoEncargado: gradoEncargadoVal,
                materiasImpartidas,
                fechaActualizacion: new Date().toISOString()
            };
            if (fotoBase64) datosUpdate.fotoPerfil = fotoBase64;

            await updateDoc(doc(db, "usuarios", usuarioActual.uid), datosUpdate);

            const usuarioLocal = JSON.parse(localStorage.getItem("usuario") || "{}");
            usuarioLocal.grado = gradoEncargadoVal;
            usuarioLocal.gradoEncargado = gradoEncargadoVal;
            usuarioLocal.materiasImpartidas = materiasImpartidas;
            usuarioLocal.perfilConfigurado = true;
            if (fotoBase64) usuarioLocal.fotoPerfil = fotoBase64;
            localStorage.setItem("usuario", JSON.stringify(usuarioLocal));

            mostrarToast("¡Perfil actualizado exitosamente!", "success");
            setTimeout(() => {
                window.location.href = "dashboard.html";
            }, 1200);
        } catch (error) {
            console.error("Error al guardar:", error);
            mostrarToast("Error al guardar: " + error.message, "error");
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = originalBtnText;
            }
        }
    });
}
