export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: "Método no permitido" });

  try {
    const { message, history = [] } = req.body;
    if (!message) return res.status(400).json({ error: "Mensaje vacío" });

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "GEMINI_API_KEY no configurada" });
    }

    const geminiHistory = history.map(h => ({
      role: h.role,
      parts: [{ text: h.parts?.[0]?.text || "" }]
    })).filter(h => h.parts[0].text);

    // PROBAR MÚLTIPLES VERSIONES DE GEMINI
    const modelosGemini = [
      "gemini-2.5-flash",
      "gemini-2.5-pro", 
      "gemini-2.0-flash",
      "gemini-1.5-flash"
    ];

    for (const modelo of modelosGemini) {
      try {
        console.log(`[Intent] Probando ${modelo}...`);
        
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${apiKey}`;
        
        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            contents: [...geminiHistory, { role: "user", parts: [{ text: message }] }],
            generationConfig: { 
              maxOutputTokens: 500, 
              temperature: 0.7 
            }
          })
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.warn(`[Fallo] ${modelo}:`, errorData.error?.message || response.status);
          continue; // Probar siguiente modelo
        }
        
        const data = await response.json();
        
        if (!data.candidates?.[0]?.content?.parts?.[0]?.text) {
          console.warn(`[Fallo] ${modelo}: Respuesta vacía`);
          continue;
        }
        
        const reply = data.candidates[0].content.parts[0].text;
        console.log(`[Éxito] ${modelo} funcionó`);
        
        return res.status(200).json({ 
          reply, 
          motorUsado: modelo 
        });
        
      } catch (error) {
        console.warn(`[Error] ${modelo}:`, error.message);
        continue;
      }
    }

    return res.status(502).json({ error: "Todos los modelos de Gemini fallaron" });

  } catch (error) {
    console.error("[Error crítico]", error);
    return res.status(500).json({ error: error.message });
  }
}
