export default async function handler(req, res) {
  const url = "https://script.google.com/macros/s/AKfycbxhZHiDn6_DPUIZocP5c9iQTNGTuKn_Sx0mDGx6izvzw-EiPT3hLwjbSMb-ooxE2KCY/exec";

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

  const data = await response.text();

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.status(200).send(data);
}
