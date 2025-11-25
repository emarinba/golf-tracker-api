export default async function handler(req, res) {
  const url = "https://script.google.com/macros/s/AKfycbxhZHiDn6_DPUIZocP5c9iQTNGTuKn_Sx0mDGx6izvzw-EiPT3hLwjbSMb-ooxE2KCY/exec";

  try {
    let response;
    if (req.method === "GET") {
      response = await fetch(url);
    } else if (req.method === "POST") {
      response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req.body)
      });
    } else if (req.method === "OPTIONS") {
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type");
      return res.status(200).end();
    }

    // Intentamos parsear JSON
    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      // Si no es JSON, enviamos un error
      return res.status(500).json({ error: "Respuesta de Apps Script inválida", raw: text });
    }

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.status(200).json(data);

  } catch (err) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.status(500).json({ error: err.message });
  }
}
