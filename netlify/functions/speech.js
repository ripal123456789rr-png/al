export async function handler(event) {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method Not Allowed" })
    };
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "OPENAI_API_KEY belum diatur di Netlify." })
    };
  }

  try {
    const { text } = JSON.parse(event.body || "{}");

    if (!text) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Teks untuk suara tidak boleh kosong." })
      };
    }

    const response = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini-tts",
        voice: "coral",
        input: text,
        instructions: "Berbicaralah dengan suara perempuan yang lembut, ramah, hangat, dan natural dalam bahasa Indonesia."
      })
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      return {
        statusCode: response.status,
        body: JSON.stringify({
          error: errData.error?.message || "Gagal menghasilkan suara AI."
        })
      };
    }

    const arrayBuffer = await response.arrayBuffer();
    const audioBase64 = Buffer.from(arrayBuffer).toString("base64");

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ audioBase64 })
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: `Speech Error: ${error.message}` })
    };
  }
}
