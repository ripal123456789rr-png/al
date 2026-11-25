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
    const { audioBase64, mimeType } = JSON.parse(event.body || "{}");

    if (!audioBase64) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Data audio tidak ditemukan." })
      };
    }

    const audioBuffer = Buffer.from(audioBase64, "base64");
    const audioBlob = new Blob([audioBuffer], { type: mimeType || "audio/webm" });

    const formData = new FormData();
    formData.append("file", audioBlob, "voice_note.webm");
    formData.append("model", "gpt-4o-mini-transcribe");
    formData.append("language", "id");

    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`
      },
      body: formData
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        statusCode: response.status,
        body: JSON.stringify({
          error: data.error?.message || "Gagal mentranskripsikan audio."
        })
      };
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: data.text })
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: `Transcribe Error: ${error.message}` })
    };
  }
}
