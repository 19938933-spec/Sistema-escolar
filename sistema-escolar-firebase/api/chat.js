export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: "Método no permitido" });

  try {
    const { message, history = [] } = req.body;
    if (!message) return res.status(400).json({ error: "Mensaje vacío" });

    const geminiHistory = history.map(h => ({
      role: h.role,
      parts: [{ text: h.parts?.[0]?.text || "" }]
    })).filter(h => h.parts[0].text);

    // MODELOS QUE SÍ FUNCIONAN PARA USUARIOS NUEVOS (Nov 2026)
    const modelos = [
      {
        nombre: "Gemini 2.5 Flash Lite",
        apiKey: process.env.GEMINI_API_KEY,
        url: (key) => `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${key}`,
      },
      {
        nombre: "Gemini 2.0 Flash Lite",
        apiKey: process.env.GEMINI_API_KEY,
        url: (key) => `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${key}`,
      },
      {
        nombre: "Gemini 1.5 Flash (API v1)",
        apiKey: process.env.GEMINI_API_KEY,
        url: (key) => `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${key}`,
      },
        body: (msgs) => JSON.stringify({ 
          model: "llama-3.1-8b-instant", 
          messages: [{ role: "system", content: "Eres el asistente virtual de Edu.Control para el Complejo Educativo Thomas Jefferson. Responde breve y en español." }, ...msgs],
          max_tokens: 500,
          temperature: 0.7
        }),
        isGroq: true,
      }
    ];

    const openAiHistory = history.map(h => ({
      role: h.role === "model" ? "assistant" : "user",
      content: h.parts?.[0]?.text || ""
    })).filter(h => h.content);

    for (const modelo of modelos) {
      const apiKey = modelo.apiKey;
      if (!apiKey) {
        console.warn(`[Skip] ${modelo.nombre}: sin API key`);
        continue;
      }

      try {
        console.log(`[Intent] Probando ${modelo.nombre}...`);

        let fetchOptions;
        
        if (modelo.isGroq) {
          fetchOptions = {
            method: "POST",
            headers: { 
              "Content-Type": "application/json", 
              "Authorization": `Bearer ${apiKey}` 
            },
            body: modelo.body(openAiHistory)
          };
        } else {
          fetchOptions = {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
              contents: [...geminiHistory, { role: "user", parts: [{ text: message }] }],
              generationConfig: { maxOutputTokens: 500, temperature: 0.7 }
            })
          };
        }

        const url = modelo.isGroq ? modelo.url() : modelo.url(apiKey);
        
        const response = await fetch(url, fetchOptions);

        if (!response.ok) {
          const errorText = await response.text().catch(() => "");
          console.warn(`[Fallo] ${modelo.nombre}: ${response.status} - ${errorText.substring(0, 200)}`);
          continue;
        }
        
        const data = await response.json();
        let reply;
        
        if (modelo.isGroq) {
          if (!data.choices?.[0]?.message?.content) {
            console.warn(`[Fallo] ${modelo.nombre}: respuesta vacía`);
            continue;
          }
          reply = data.choices[0].message.content;
        } else {
          if (!data.candidates?.[0]?.content?.parts?.[0]?.text) {
            console.warn(`[Fallo] ${modelo.nombre}: respuesta vacía`);
            continue;
          }
          reply = data.candidates[0].content.parts[0].text;
        }
        
        if (!reply || reply.trim() === "") {
          console.warn(`[Fallo] ${modelo.nombre}: texto vacío`);
          continue;
        }
        
        console.log(`[ÉXITO] ${modelo.nombre} funcionó!`);
        return res.status(200).json({ reply, motorUsado: modelo.nombre });
        
      } catch (error) {
        console.warn(`[Error] ${modelo.nombre}:`, error.message);
        continue;
      }
    }

    console.error("[Error] Todos los modelos fallaron");
    return res.status(502).json({ error: "Todos los modelos fallaron" });

  } catch (error) {
    console.error("[Error crítico]", error);
    return res.status(500).json({ error: error.message });
  }
}
