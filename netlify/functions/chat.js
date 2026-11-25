export async function handler(event) {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method Not Allowed" })
    };
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "GEMINI_API_KEY belum diatur di Environment Variables Netlify." })
    };
  }

  try {
    const { messages } = JSON.parse(event.body || "{}");

    if (!messages || !Array.isArray(messages)) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Format pesan tidak valid." })
      };
    }

    const systemPrompt =
      "Kamu adalah HINOKAWA AI, asisten virtual perempuan yang ramah, pintar, lembut, dan berbicara dalam bahasa Indonesia yang sangat natural seperti teman chat di WhatsApp. Jawablah dengan jelas, hangat, ringkas namun informatif, dan sesekali gunakan emoji secara wajar.";

    // Ubah format OpenAI -> format Gemini
    // OpenAI: [{role: "user", content: "..."}]
    // Gemini: [{role: "user", parts: [{text: "..."}]}]
    const contents = [];
    let lastUserMessage = "";

    for (const m of messages) {
      if (m.role === "system") continue;
      const text = typeof m.content === "string" ? m.content : "";
      if (!text) continue;
      const role = m.role === "assistant" ? "model" : "user";
      contents.push({ role, parts: [{ text }] });
      if (role === "user") lastUserMessage = text;
    }

    // Kalo kosong, kasih default biar gak error
    if (contents.length === 0) {
      contents.push({ role: "user", parts: [{ text: "halo" }] });
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: contents,
          generationConfig: { temperature: 0.7 }
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return {
        statusCode: response.status,
        body: JSON.stringify({
          error: data.error?.message || "Gagal mendapatkan respons dari Gemini."
        })
      };
    }

    let replyText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reply: replyText || "Maaf, aku tidak bisa memproses pesan itu sekarang."
      })
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: `Server Error: ${error.message}` })
    };
  }
}
