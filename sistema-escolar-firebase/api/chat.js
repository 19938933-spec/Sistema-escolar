module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método no permitido" });
  }

  const apiKey = (process.env.GEMINI_API_CLAVE || process.env.GEMINI_API_KEY || "").trim();
  if (!apiKey) {
    return res.status(500).json({
      error: "Falta API key en Vercel",
      hint: "Crea GEMINI_API_CLAVE o GEMINI_API_KEY, luego Redeploy"
    });
  }

  try {
    let body = req.body;
    if (typeof body === "string") {
      try { body = JSON.parse(body); } catch (e) { body = {}; }
    }
    body = body || {};

    const message = body.message;
    const history = body.history || [];

    if (!message || typeof message !== "string") {
      return res.status(400).json({ error: "Mensaje vacío" });
    }

    const geminiHistory = history
      .map((h) => ({
        role: h.role === "model" ? "model" : "user",
        parts: [{ text: (h.parts && h.parts[0] && h.parts[0].text) || h.text || "" }]
      }))
      .filter((h) => h.parts[0].text);

    const systemText =
      "Eres el asistente de Edu.Control del Complejo Educativo Thomas Jefferson. " +
      "Ayudas a docentes con login, perfil, alumnos, asistencia, calificaciones y fallas comunes. " +
      "Sitio: https://sistemaescolar-beta.vercel.app. Responde en español, claro y en pasos cortos.";

    const modelos = ["gemini-2.0-flash", "gemini-2.5-flash-lite", "gemini-1.5-flash"];
    let lastError = "";

    for (const model of modelos) {
      try {
        const url =
          "https://generativelanguage.googleapis.com/v1beta/models/" +
          model +
          ":generateContent?key=" +
          encodeURIComponent(apiKey);

        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemText }] },
            contents: [
              ...geminiHistory,
              { role: "user", parts: [{ text: message.slice(0, 4000) }] }
            ],
            generationConfig: { maxOutputTokens: 1024, temperature: 0.5 }
          })
        });

        const data = await response.json();

        if (!response.ok) {
          lastError = (data.error && data.error.message) || response.statusText;
          console.warn("[Fallo]", model, lastError);
          continue;
        }

        const parts = data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts;
        const reply = parts ? parts.map((p) => p.text || "").join("") : "";

        if (!reply.trim()) {
          lastError = "respuesta vacía de " + model;
          continue;
        }

        return res.status(200).json({ reply: reply, motorUsado: model });
      } catch (err) {
        lastError = err.message;
        console.warn("[Error]", model, err.message);
      }
    }

    return res.status(502).json({
      error: "No se pudo obtener respuesta de Gemini",
      detail: lastError
    });
  } catch (error) {
    console.error("[Error crítico]", error);
    return res.status(500).json({ error: error.message || "Error interno" });
  }
};
