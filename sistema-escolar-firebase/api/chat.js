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

    const openAiHistory = history.map(h => ({
      role: h.role === "model" ? "assistant" : "user",
      content: h.parts?.[0]?.text || ""
    })).filter(h => h.content);

    const openAiMessages = [
      { role: "system", content: "Eres el asistente virtual de Edu.Control para el Complejo Educativo Thomas Jefferson. Responde breve y en español." },
      ...openAiHistory,
      { role: "user", content: message }
    ];

    // MODELOS ACTUALES (Noviembre 2026)
    const motores = [
      {
        nombre: "Gemini 2.5 Flash",
        apiKey: process.env.GEMINI_API_KEY,
        url: `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          contents: [...geminiHistory, { role: "user", parts: [{ text: message }] }],
          generationConfig: { maxOutputTokens: 500, temperature: 0.7 }
        }),
        parse: (data) => {
          if (!data.candidates?.[0]?.content?.parts?.[0]?.text) throw new Error("Respuesta inválida");
          return data.candidates[0].content.parts[0].text;
        }
      },
      {
        nombre: "Gemini 2.5 Pro",
        apiKey: process.env.GEMINI_API_KEY,
        url: `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${process.env.GEMINI_API_KEY}`,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          contents: [...geminiHistory, { role: "user", parts: [{ text: message }] }],
          generationConfig: { maxOutputTokens: 500, temperature: 0.7 }
        }),
        parse: (data) => {
          if (!data.candidates?.[0]?.content?.parts?.[0]?.text) throw new Error("Respuesta inválida");
          return data.candidates[0].content.parts[0].text;
        }
      },
      {
        nombre: "Gemini 2.0 Flash",
        apiKey: process.env.GEMINI_API_KEY,
        url: `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          contents: [...geminiHistory, { role: "user", parts: [{ text: message }] }],
          generationConfig: { maxOutputTokens: 500, temperature: 0.7 }
        }),
        parse: (data) => {
          if (!data.candidates?.[0]?.content?.parts?.[0]?.text) throw new Error("Respuesta inválida");
          return data.candidates[0].content.parts[0].text;
        }
      },
      {
        nombre: "Groq (Llama 3.1 8B)",
        apiKey: process.env.GROQ_API_KEY,
        url: "https://api.groq.com/openai/v1/chat/completions",
        headers: { 
          "Content-Type": "application/json", 
          "Authorization": `Bearer ${process.env.GROQ_API_KEY}` 
        },
        body: JSON.stringify({ 
          model: "llama-3.1-8b-instant", 
          messages: openAiMessages,
          max_tokens: 500,
          temperature: 0.7
        }),
        parse: (data) => {
          if (!data.choices?.[0]?.message?.content) throw new Error("Respuesta inválida");
          return data.choices[0].message.content;
        }
      },
      {
        nombre: "OpenRouter (Llama 3.2 3B Free)",
        apiKey: process.env.OPENROUTER_API_KEY,
        url: "https://openrouter.ai/api/v1/chat/completions",
        headers: { 
          "Content-Type": "application/json", 
          "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "HTTP-Referer": "https://sistemaescolar-beta.vercel.app",
          "X-Title": "Edu.Control AI"
        },
        body: JSON.stringify({ 
          model: "meta-llama/llama-3.2-3b-instruct:free", 
          messages: openAiMessages,
          max_tokens: 500
        }),
        parse: (data) => {
          if (!data.choices?.[0]?.message?.content) throw new Error("Respuesta inválida");
          return data.choices[0].message.content;
        }
      }
    ];

    for (const motor of motores) {
      if (!motor.apiKey) {
        console.warn(`[API Skip] ${motor.nombre}: API key no configurada`);
        continue;
      }

      try {
        console.log(`[API Intent] Probando ${motor.nombre}...`);
        
        const response = await fetch(motor.url, {
          method: "POST",
          headers: motor.headers,
          body: motor.body
        });

        if (!response.ok) {
          const errorText = await response.text().catch(() => "Sin detalles");
          throw new Error(`Status ${response.status}: ${errorText}`);
        }
        
        const data = await response.json();
        
        if (!data || Object.keys(data).length === 0) {
          throw new Error("Respuesta vacía");
        }
        
        const reply = motor.parse(data);
        
        if (!reply || reply.trim() === "") {
          throw new Error("Respuesta vacía");
        }
        
        console.log(`[API Success] ${motor.nombre} respondió correctamente`);
        return res.status(200).json({ reply, motorUsado: motor.nombre });
        
      } catch (error) {
        console.warn(`[API Falló] ${motor.nombre}:`, error.message);
      }
    }

    console.error("[API Error] Todos los motores fallaron");
    return res.status(502).json({ error: "Todos los motores de IA están caídos." });

  } catch (error) {
    console.error("[API Critical Error]", error);
    return res.status(500).json({ error: "Error interno: " + error.message });
  }
}
