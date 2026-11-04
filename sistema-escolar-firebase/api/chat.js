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
      hint: "Configura GEMINI_API_CLAVE o GEMINI_API_KEY y haz Redeploy"
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
    const systemKnowledge = body.systemKnowledge || "";

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
      "Sitio: https://sistemaescolar-beta.vercel.app. Responde en español, claro y en pasos cortos. " +
      "USA SOLO ESTA INFORMACIÓN REAL DEL SISTEMA:\n" + systemKnowledge;

    const modelos = [
      "gemini-3.1-flash-lite",
      "gemini-3-flash-preview",
      "gemini-flash-lite-latest",
      "gemini-flash-latest",
      "gemini-3.8-flash",
      "gemini-3.5-flash-lite",
      "gemini-pro-latest"
    ];

    const fallos = [];

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
          const msg = (data.error && data.error.message) || response.statusText;
          fallos.push(model + ": " + msg);
          console.warn("[Fallo]", model, msg);
          continue;
        }

        const parts =
          data.candidates &&
          data.candidates[0] &&
          data.candidates[0].content &&
          data.candidates[0].content.parts;
        const reply = parts ? parts.map((p) => p.text || "").join("") : "";

        if (!reply.trim()) {
          fallos.push(model + ": respuesta vacía");
          continue;
        }

        return res.status(200).json({ reply: reply, motorUsado: model });
      } catch (err) {
        fallos.push(model + ": " + err.message);
        console.warn("[Error]", model, err.message);
      }
    }

    let disponibles = [];
    try {
      const listUrl =
        "https://generativelanguage.googleapis.com/v1beta/models?key=" +
        encodeURIComponent(apiKey);
      const listRes = await fetch(listUrl);
      const listData = await listRes.json();
      disponibles = (listData.models || [])
        .map((m) => (m.name || "").replace("models/", ""))
        .filter((n) => n.indexOf("gemini") !== -1)
        .slice(0, 25);
    } catch (e) {
      disponibles = ["no se pudo listar: " + e.message];
    }

    return res.status(502).json({
      error: "No se pudo obtener respuesta de Gemini",
      fallos: fallos,
      modelosDisponibles: disponibles
    });
  } catch (error) {
    console.error("[Error crítico]", error);
    return res.status(500).json({ error: error.message || "Error interno" });
  }
};
