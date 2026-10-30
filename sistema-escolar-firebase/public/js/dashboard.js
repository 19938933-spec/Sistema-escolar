import { 
    auth, 
    db, 
    signOut, 
    onAuthStateChanged, 
    collection, 
    query, 
    where, 
    getDocs, 
    doc, 
    getDoc, 
    updateDoc 
} from './firebase-config.js';

let usuarioActual = null;
let gradosAsignados = new Set();
let heartbeatTimer = null;

async function pingPresencia(uid) {
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
        
        if (!userDoc.exists()) {
            window.location.href = 'index.html';
            return;
        }
        const userData = { uid: user.uid, ...userDoc.data() };

        if (userData.activo === false) {
            await signOut(auth);
            alert('Tu cuenta está desactivada. Contacta al administrador.');
            window.location.href = 'index.html';
            return;
        }

        if (userData.rol !== 'docente') {
            window.location.href = 'index.html';
            return;
        }

        // Presencia en tiempo real
        await pingPresencia(user.uid);
        heartbeatTimer = setInterval(() => pingPresencia(user.uid), 60000);

        const usuarioParaGuardar = {
            uid: userData.uid,
            nombre: userData.nombre || userData.nombreCompleto || 'Docente',
            correo: userData.correo,
            rol: userData.rol,
            grado: userData.gradoEncargado || '',
            usuario: userData.usuario,
            perfilConfigurado: userData.perfilConfigurado,
            materiasImpartidas: userData.materiasImpartidas || [],
            fotoPerfil: userData.fotoPerfil || null
        };
        localStorage.setItem('usuario', JSON.stringify(usuarioParaGuardar));
        usuarioActual = usuarioParaGuardar;

        const userNameEl = document.getElementById('userName');
        const welcomeNameEl = document.getElementById('welcomeName');
        const userEmailEl = document.getElementById('userEmail');
        const userGradeEl = document.getElementById('userGrade');
        const encargadoTextEl = document.getElementById('encargadoText');

        if (userNameEl) userNameEl.textContent = usuarioActual.nombre;
        if (welcomeNameEl) welcomeNameEl.textContent = usuarioActual.nombre;
        if (userEmailEl) userEmailEl.textContent = usuarioActual.correo;

        // Foto de perfil
        const avatar = document.getElementById('userAvatar');
        if (avatar) {
            if (usuarioActual.fotoPerfil) {
                avatar.innerHTML = `<img src="${usuarioActual.fotoPerfil}" alt="">`;
            } else {
                avatar.textContent = usuarioActual.nombre.charAt(0).toUpperCase();
            }
        }

        if (usuarioActual.grado) {
            if (userGradeEl) userGradeEl.textContent = usuarioActual.grado;
            if (encargadoTextEl) encargadoTextEl.style.display = 'block';
            gradosAsignados.add(usuarioActual.grado);
        }

        const linkAlumnos = document.getElementById('linkAlumnos');
        if (usuarioActual.grado && linkAlumnos) {
            linkAlumnos.href = `alumnos.html?grado=${encodeURIComponent(usuarioActual.grado)}`;
        }

        renderizarAsignaciones();
        await cargarEstadisticas();
    } catch (error) {
        console.error('Error al cargar el panel:', error);
    }

    setTimeout(() => {
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) {
            overlay.style.opacity = '0';
            setTimeout(() => { overlay.style.display = 'none'; }, 500);
        }
    }, 700);
});

function renderizarAsignaciones() {
    const container = document.getElementById('subjectsList');
    if (!container) return;

    const materias = usuarioActual.materiasImpartidas || [];
    let html = '';

    if (usuarioActual.grado) {
        html += `<div class="section-title"><i class="bi bi-star-fill"></i> Grado a Cargo (Tutoría)</div>`;
        html += `
            <div class="subject-tag tutor">
                <i class="bi bi-star-fill"></i> 
                <strong>Tutor/Encargado de: ${usuarioActual.grado}</strong>
            </div>
        `;
    }

    if (materias.length > 0) {
        html += `<div class="section-title"><i class="bi bi-book-fill"></i> Materias que Imparto</div>`;
        
        materias.forEach(asignacion => {
            const esModulo = asignacion.nombre === "Módulo";
            const icono = esModulo ? 'bi-cpu-fill' : 'bi-book-fill';
            const nombreMostrar = esModulo 
                ? `Módulo ${asignacion.numero}: ${asignacion.nombrePersonalizado}` 
                : asignacion.nombre;
            
            const esGradoACargo = usuarioActual.grado && (asignacion.grados || []).includes(usuarioActual.grado);
            const otrosGrados = (asignacion.grados || []).filter(g => g !== usuarioActual.grado);
            
            html += `
                <div class="subject-tag">
                    <i class="bi ${icono}"></i> 
                    <strong>${nombreMostrar}</strong>
                </div>
            `;
            
            if (esGradoACargo) {
                html += `
                    <div class="subject-tag" style="background: rgba(16, 185, 129, 0.1); border-color: rgba(16, 185, 129, 0.3);">
                        <i class="bi bi-house-fill" style="color: #10b981;"></i> En mi grado a cargo: ${usuarioActual.grado}
                    </div>
                `;
            }
            
            if (otrosGrados.length > 0) {
                html += `
                    <div class="subject-tag" style="background: rgba(245, 158, 11, 0.1); border-color: rgba(245, 158, 11, 0.3);">
                        <i class="bi bi-arrow-right-circle-fill" style="color: #f59e0b;"></i> En otros grados: ${otrosGrados.join(', ')}
                    </div>
                `;
                otrosGrados.forEach(g => gradosAsignados.add(g));
            }

            (asignacion.grados || []).forEach(g => gradosAsignados.add(g));
        });
    }

    if (materias.length === 0 && !usuarioActual.grado) {
        html = `
            <p class="text-muted">
                No tienes asignaciones registradas. 
                <a href="configurar-perfil.html" style="color: var(--accent-primary);">Configura tu perfil</a>.
            </p>
        `;
    }
    container.innerHTML = html;

    const accesosRapidos = document.getElementById('accesosRapidos');
    const gradosLinks = document.getElementById('gradosLinks');
    const gradosArr = Array.from(gradosAsignados).filter(Boolean).sort((a, b) => a.localeCompare(b, 'es'));
    
    if (gradosArr.length > 0 && accesosRapidos && gradosLinks) {
        accesosRapidos.style.display = 'block';
        gradosLinks.innerHTML = gradosArr.map(g =>
            `<a class="grado-link-btn" href="alumnos.html?grado=${encodeURIComponent(g)}"><i class="bi bi-people-fill"></i> ${g}</a>`
        ).join('');
    }
}

async function cargarEstadisticas() {
    if (gradosAsignados.size === 0) {
        animarContador('statTotal', 0);
        animarContador('statMale', 0);
        animarContador('statFemale', 0);
        return;
    }
    try {
        let total = 0, male = 0, female = 0;
        for (const grado of gradosAsignados) {
            const q = query(collection(db, 'alumnos'), where('grado', '==', grado));
            const snapshot = await getDocs(q);
            
            snapshot.forEach(docSnap => {
                const data = docSnap.data();
                total++;
                const sexo = data.sexo || data.genero || '';
                if (sexo === 'Masculino') male++;
                else if (sexo === 'Femenino') female++;
            });
        }
        animarContador('statTotal', total);
        animarContador('statMale', male);
        animarContador('statFemale', female);
    } catch (error) {
        console.error("Error al cargar estadísticas:", error);
    }
}

function animarContador(elementId, target) {
    const element = document.getElementById(elementId);
    if (!element) return;
    let current = 0;
    const duration = 1000;
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

const btnLogout = document.getElementById('btnLogout');
if (btnLogout) {
    btnLogout.addEventListener('click', async () => {
        if (confirm('¿Cerrar sesión?')) {
            try {
                if (usuarioActual?.uid) {
                    await updateDoc(doc(db, 'usuarios', usuarioActual.uid), {
                        enLinea: false,
                        lastSeen: new Date().toISOString()
                    });
                }
            } catch (e) {}
            if (heartbeatTimer) clearInterval(heartbeatTimer);
            await signOut(auth);
            localStorage.removeItem('usuario');
            window.location.href = 'index.html';
        }
    });
}

window.addEventListener('beforeunload', () => {
    if (heartbeatTimer) clearInterval(heartbeatTimer);
});
