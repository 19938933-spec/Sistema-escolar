module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método no permitido" });
  }

  const apiKey = process.env.GEMINI_API_CLAVE;
  if (!apiKey) {
    console.error("Falta GEMINI_API_CLAVE en Vercel");
    return res.status(500).json({
      error: "Falta GEMINI_API_CLAVE. Configurala en Vercel y haz Redeploy."
    });
  }

  try {
    const { message, history = [] } = req.body || {};
    if (!message || typeof message !== "string") {
      return res.status(400).json({ error: "Mensaje vacío" });
    }

    const geminiHistory = (history || [])
      .map((h) => ({
        role: h.role === "model" ? "model" : "user",
        parts: [{ text: h.parts?.[0]?.text || h.text || "" }]
      }))
      .filter((h) => h.parts[0].text);

    const systemText =
      "Eres el asistente de Edu.Control del Complejo Educativo Thomas Jefferson. " +
      "Ayudas a docentes con login, perfil, alumnos, asistencia, calificaciones y fallas comunes. " +
      "Sitio: https://sistemaescolar-beta.vercel.app. Responde en español, claro y en pasos cortos.";

    const modelos = [
      "gemini-2.0-flash",
      "gemini-2.5-flash-lite",
      "gemini-2.0-flash-lite"
    ];

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
            generationConfig: {
              maxOutputTokens: 1024,
              temperature: 0.5
            }
          })
        });

        const data = await response.json();

        if (!response.ok) {
          lastError = data?.error?.message || response.statusText;
          console.warn(`[Fallo] ${model}:`, lastError);
          continue;
        }

        const reply = data?.candidates?.[0]?.content?.parts
          ?.map((p) => p.text)
          .join("");

        if (!reply || !reply.trim()) {
          lastError = "respuesta vacía";
          continue;
        }

        return res.status(200).json({ reply, motorUsado: model });
      } catch (err) {
        lastError = err.message;
        console.warn(`[Error] ${model}:`, err.message);
      }
    }

    return res.status(502).json({
      error: "No se pudo obtener respuesta de Gemini",
      detail: lastError
    });
  } catch (error) {
    console.error("[Error crítico]", error);
    return res.status(500).json({ error: error.message });
  }
};
