export default async function handler(req, res) {
  // Solo POST
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método no permitido" });
  }

  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    return res.status(500).json({ error: "Falta configurar GEMINI_API_KEY en Vercel" });
  }

  try {
    const { message, history } = req.body || {};
    if (!message || typeof message !== "string") {
      return res.status(400).json({ error: "Falta el mensaje" });
    }

    // Evitar mensajes enormes
    const texto = message.slice(0, 4000);

    const systemText = `Eres el asistente de Edu.Control del Complejo Educativo Thomas Jefferson.
Ayudas a docentes con: login, perfil, alumnos, asistencia, calificaciones y problemas frecuentes.
Sitio del sistema: https://sistemaescolar-beta.vercel.app
Responde en español, claro y en pasos cortos.
Si el usuario pide ir a una sección, indica la página: index.html (login), dashboard.html, asistencia.html, calificaciones.html, alumnos.html, configurar-perfil.html, admin.html.`;

    const contents = [];
    if (Array.isArray(history)) {
      history.slice(-8).forEach((h) => {
        if (h.role && h.text) {
          contents.push({
            role: h.role === "user" ? "user" : "model",
            parts: [{ text: String(h.text).slice(0, 2000) }]
          });
        }
      });
    }
    contents.push({ role: "user", parts: [{ text: texto }] });

    const url =
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=" +
      encodeURIComponent(key);

    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemText }] },
        contents,
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 1024
        }
      })
    });

    const data = await r.json();

    if (!r.ok) {
      console.error("Gemini error:", data);
      return res.status(502).json({
        error: "Error al consultar la IA",
        detail: data.error?.message || "respuesta no válida"
      });
    }

    const reply =
      data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") ||
      "No pude generar una respuesta. Intenta de nuevo.";

    return res.status(200).json({ reply });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Error interno del servidor" });
  }
}
