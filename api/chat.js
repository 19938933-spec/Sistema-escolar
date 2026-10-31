export default async function handler(req, res) {
  // Configuración de CORS y método
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: "Método no permitido" });

  const { message, history = [] } = req.body;
  if (!message) return res.status(400).json({ error: "Mensaje vacío" });

  // 1. Mapeo de historial para Gemini
  const geminiHistory = history.map(h => ({
    role: h.role,
    parts: [{ text: h.parts[0].text }]
  }));

  // 2. Mapeo de historial para Groq/OpenRouter (Formato OpenAI)
  const openAiHistory = history.map(h => ({
    role: h.role === "model" ? "assistant" : "user",
    content: h.parts[0].text
  }));
  const openAiMessages = [
    { role: "system", content: "Eres el asistente virtual de Edu.Control para el Complejo Educativo Thomas Jefferson. Responde breve y en español." },
    ...openAiHistory,
    { role: "user", content: message }
  ];

  // 3. Array de Motores Funcionales (Cascada)
  const motores = [
    {
      nombre: "Gemini 1.5 Flash",
      apiKey: process.env.GEMINI_API_KEY,
      url: `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [...geminiHistory, { role: "user", parts: [{ text: message }] }] }),
      parse: (data) => data.candidates[0].content.parts[0].text
    },
    {
      nombre: "Groq (Llama 3.3 70B)",
      apiKey: process.env.GROQ_API_KEY,
      url: "https://api.groq.com/openai/v1/chat/completions",
      headers: { 
        "Content-Type": "application/json", 
        "Authorization": `Bearer ${process.env.GROQ_API_KEY}` 
      },
      body: JSON.stringify({ model: "llama-3.3-70b-versatile", messages: openAiMessages }),
      parse: (data) => data.choices[0].message.content
    },
    {
      nombre: "OpenRouter (DeepSeek R1)",
      apiKey: process.env.OPENROUTER_API_KEY,
      url: "https://openrouter.ai/api/v1/chat/completions",
      headers: { 
        "Content-Type": "application/json", 
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}` 
      },
      body: JSON.stringify({ model: "deepseek/deepseek-r1:free", messages: openAiMessages }),
      parse: (data) => data.choices[0].message.content.replace(/<think>[\s\S]*?<\/think>\n?/g, "") // Limpia tags de pensamiento de Deepseek
    }
  ];

  // 4. Ejecución en Cascada (Falla uno -> Prueba el siguiente)
  for (const motor of motores) {
    if (!motor.apiKey) continue; // Salta el motor si no agregaste la llave en Vercel

    try {
      const response = await fetch(motor.url, {
        method: "POST",
        headers: motor.headers,
        body: motor.body
      });

      if (!response.ok) throw new Error(`Status ${response.status}`);
      
      const data = await response.json();
      const reply = motor.parse(data);
      
      // Retorna inmediatamente en el primer motor que funcione
      return res.status(200).json({ reply, motorUsado: motor.nombre });
      
    } catch (error) {
      console.warn(`[API Falló] ${motor.nombre}:`, error.message);
      // Continúa al siguiente ciclo iterativo
    }
  }

  // 5. Si fallan todas las APIs, lanza error para que el frontend active la Base Local (Plan B)
  return res.status(502).json({ error: "Todos los motores de IA están caídos." });
}
