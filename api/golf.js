export default async function handler(req, res) {
  // Tu URL del Apps Script
  const baseUrl = "https://script.google.com/macros/s/AKfycbxhZHiDn6_DPUIZocP5c9iQTNGTuKn_Sx0mDGx6izvzw-EiPT3hLwjbSMb-ooxE2KCY/exec";

  // Headers CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // Manejar OPTIONS (preflight)
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    let response;

    if (req.method === "GET") {
      // Construir URL con parámetros
      const params = new URLSearchParams(req.query);
      const targetUrl = params.toString() ? `${baseUrl}?${params.toString()}` : baseUrl;
      
      console.log("GET Request to:", targetUrl);
      response = await fetch(targetUrl, {
        method: "GET",
        headers: {
          "User-Agent": "Mozilla/5.0"
        }
      });

    } else if (req.method === "POST") {
      console.log("POST Request body:", JSON.stringify(req.body));
      
      response = await fetch(baseUrl, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "User-Agent": "Mozilla/5.0"
        },
        body: JSON.stringify(req.body)
      });

    } else {
      return res.status(405).json({ error: "Método no permitido: " + req.method });
    }

    // Verificar respuesta
    if (!response.ok) {
      console.error("Apps Script error:", response.status, response.statusText);
      return res.status(response.status).json({ 
        error: `Apps Script respondió con error: ${response.status} ${response.statusText}` 
      });
    }

    // Parsear respuesta
    const text = await response.text();
    console.log("Response from Apps Script:", text);

    let data;
    try {
      data = JSON.parse(text);
    } catch (parseErr) {
      console.error("Error parsing JSON:", parseErr, "Text:", text);
      return res.status(500).json({ 
        error: "Respuesta de Apps Script inválida", 
        raw: text.substring(0, 200) // Primeros 200 caracteres
      });
    }

    // Retornar data
    return res.status(200).json(data);

  } catch (err) {
    console.error("Proxy error:", err);
    return res.status(500).json({ 
      error: "Error en el proxy: " + err.message,
      stack: err.stack 
    });
  }
}