# 🎓 Edu.Control - Sistema Integral de Gestión Académica

> **Proyecto de Grado / Módulo 8**  
> **Especialidad:** Infraestructuras Tecnológicas y Servicios Informáticos (ITSI)  
> **Institución:** Complejo Educativo Thomas Jefferson  
> **Año:** 2026

[![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white)](https://developer.mozilla.org/es/docs/Web/HTML)
[![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white)](https://developer.mozilla.org/es/docs/Web/CSS)
[![Bootstrap](https://img.shields.io/badge/Bootstrap-7952B3?style=for-the-badge&logo=bootstrap&logoColor=white)](https://getbootstrap.com/)
[![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)](https://developer.mozilla.org/es/docs/Web/JavaScript)
[![Firebase](https://img.shields.io/badge/Firebase-FFCA28?style=for-the-badge&logo=firebase&logoColor=black)](https://firebase.google.com/)

---

## 📖 Descripción del Proyecto

**Edu.Control** es una plataforma web diseñada para digitalizar, centralizar y optimizar los procesos administrativos y académicos del Complejo Educativo Thomas Jefferson. El sistema reemplaza los métodos manuales (listas físicas, cuadernos de notas) por una solución tecnológica segura, escalable y accesible desde cualquier dispositivo con conexión a internet.

El sistema gestiona el ciclo de vida académico: desde el registro validado de docentes, la gestión de alumnos por grado/sección, el control de asistencia diario, hasta el ingreso de calificaciones por períodos y la generación de reportes globales para la administración.

---

## 🚀 Características Principales

### 👨‍🏫 Para Docentes
- **Registro Validado:** Solo se permiten correos institucionales (`@clases.edu.sv`) y código de seguridad institucional.
- **Asignación Flexible:** Un docente puede ser encargado (tutor) de un grado e impartir múltiples materias en diferentes grados/secciones.
- **Gestión de Alumnos:** CRUD (Crear, Leer, Actualizar, Eliminar) de estudiantes asignados a sus grados.
- **Control de Asistencia:** Registro diario con estados (Presente, Ausente, Tarde) y estadísticas en tiempo real por género.
- **Calificaciones Dinámicas:**
  - Registro de notas por actividades dentro de cada materia.
  - Cálculo automático de promedios finales por materia y promedio general.
  - Soporte para **Módulos Técnicos (1 al 8)** con nombres personalizados.
  - Función de "Cierre de Período" para evitar modificaciones accidentales.

### 👨‍💼 Para Administrativos (Admin)
- **Dashboard Global:** Estadísticas en tiempo real de alumnos, docentes y grados activos.
- **Vista Consolidada de Notas:** Tabla tipo "sábana" que muestra el promedio final de todas las materias por alumno, grado y período.
- **Gestión de Períodos:** Capacidad para **reabrir períodos** cerrados por error por parte de los docentes.
- **Reportes en PDF:** Generación de boletas/listados oficiales por grado y sección, incluyendo el logo institucional y códigos de color (Aprobado/Reprobado).

---

## 🛠️ Stack Tecnológico

| Categoría             | Tecnologías                                     |
| :-------------------- | :---------------------------------------------- |
| **Frontend**          | HTML5, CSS3, JavaScript (ES6+ Modules)          |
| **Framework CSS**     | Bootstrap 5.3, Bootstrap Icons                  |
| **Tipografía**        | Google Fonts (Inter)                            |
| **Backend / BaaS**    | Firebase Authentication, Cloud Firestore        |
| **Despliegue**        | Firebase Hosting / Servidor Local (Live Server) |
| **Generación de PDF** | jsPDF + jspdf-autotable                         |

---

## 📂 Estructura del Proyecto

```text
sistema-escolar/
├── public/
│   ├── img/
│   │   └── fondos/
│   │       └── logo.png              # Logo institucional
│   ├── js/
│   │   ├── admin.js                  # Lógica del panel administrativo
│   │   ├── alumnos.js                # Lógica de gestión de alumnos
│   │   └── dashboard.js              # Lógica del panel docente
│   ├── index.html                    # Login principal
│   ├── registro.html                 # Registro de docentes
│   ├── configurar-perfil.html        # Asignación de materias/grados
│   ├── dashboard.html                # Panel del docente
│   ├── alumnos.html                  # Gestión de alumnos
│   ├── asistencia.html               # Control de asistencia
│   ├── calificaciones.html           # Ingreso de notas
│   ├── admin.html                    # Panel administrativo
│   ├── ver-notas.html                # Consulta global de notas
│   └── recuperar.html                # Recuperación de contraseña
├── firestore.rules                   # Reglas de seguridad de la base de datos
└── README.md
```

---

## 🔒 Seguridad y Buenas Prácticas

Este proyecto implementa medidas de seguridad fundamentales para proteger los datos académicos:

1. **Reglas de Firestore Estrictas:** El acceso a lectura/escritura está restringido por rol (`admin` o `docente`) y por propiedad del dato (`docenteId`). *Nunca* se deja la base de datos en modo público en producción.
2. **Validación de Dominio:** El registro y el login con Google rechazan automáticamente cualquier correo que no termine en `@clases.edu.sv`.
3. **Autorización en el Servidor:** Aunque el frontend usa `localStorage` para la UI, cada acción crítica verifica el `uid` del usuario autenticado en Firebase contra los permisos de Firestore.
4. **Código de Seguridad Institucional:** Capa adicional de validación en el frontend para el registro y login de docentes.
5. **Sanitización:** Uso de las APIs nativas de Firebase, que previenen automáticamente inyecciones NoSQL y XSS en la mayoría de los casos.

---

## 👥 Equipo de Desarrollo

| Nombre                       | Rol Principal                                                |
| :--------------------------- | :----------------------------------------------------------- |
| **César Alexander Portillo** | Backend (Firebase), Base de Datos, Seguridad, Calificaciones |
| **Rodrigo Alonso Campos**    | Frontend Docente, Asistencia, Validaciones JS                |
| **Rodrigo Antonio Dueñas**   | Frontend Docente, Dashboard, Interfaz de Usuario             |
| **Andrea Michelle Paredes**  | Frontend Admin, Diseño Visual, Tablas de Notas               |
| **Mónica Liseth Ramos**      | Frontend Admin, UX/UI, Pruebas de Usabilidad                 |
| **Katherine Valeria López**  | Estilos CSS, Validaciones de Formularios, QA                 |

**Profesor Guía:** Eugenio

---

## 📜 Nota de Integridad Académica

Este proyecto fue desarrollado con el apoyo de herramientas de Inteligencia Artificial (IA) para la **investigación, organización de ideas, generación de borradores de código y resolución de dudas técnicas**.

Sin embargo, **todo el código fue revisado, comprendido, adaptado y probado manualmente** por los integrantes del equipo. No se copió ni pegó código sin entender su funcionamiento, garantizando la originalidad de la arquitectura, el diseño y la lógica de negocio, cumpliendo con los estándares de honestidad académica del Complejo Educativo Thomas Jefferson.

---

## 📄 Licencia

Este proyecto es de uso interno y académico para el Complejo Educativo Thomas Jefferson. Queda prohibida su distribución o uso comercial sin la autorización expresa de la institución y del equipo de desarrollo.
