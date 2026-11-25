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
      body: JSON.stringify({ error: "OPENAI_API_KEY belum diatur di Environment Variables Netlify." })
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

    const inputPayload = [
      { role: "system", content: systemPrompt },
      ...messages
    ];

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        input: inputPayload,
        temperature: 0.7
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        statusCode: response.status,
        body: JSON.stringify({
          error: data.error?.message || "Gagal mendapatkan respons dari OpenAI."
        })
      };
    }

    let replyText = data.output_text;
    if (!replyText && Array.isArray(data.output)) {
      for (const item of data.output) {
        if (item.type === "message" && Array.isArray(item.content)) {
          const textBlock = item.content.find((c) => c.type === "output_text");
          if (textBlock && textBlock.text) {
            replyText = textBlock.text;
            break;
          }
        }
      }
    }

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
