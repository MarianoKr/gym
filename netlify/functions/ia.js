// netlify/functions/ia.js
//
// Proxy serverless: recibe { system, messages } desde la app y llama a la API
// de Google Gemini usando la clave gratuita guardada como variable de entorno en Netlify.
//
// Configuración necesaria en Netlify:
//   Site settings → Environment variables → agregar GEMINI_API_KEY

exports.handler = async (event) => {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: "Método no permitido" }),
    };
  }

  // Cambiado a la nueva variable que configuramos en Netlify
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error:
          "Falta GEMINI_API_KEY en las variables de entorno de Netlify. Andá a Site settings → Environment variables.",
      }),
    };
  }

  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch (e) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: "Body inválido, no es JSON." }),
    };
  }

  const { system, messages } = payload;

  if (!Array.isArray(messages) || messages.length === 0) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: "Falta 'messages' en la solicitud." }),
    };
  }

  // ---- TRADUCCIÓN DE FORMATO ANTHROPIC A GOOGLE GEMINI ----
  // 1. Mapear el historial de chat (Claude usa 'user'/'assistant', Gemini usa 'user'/'model')
  const contents = messages.map(msg => {
    return {
      role: msg.role === "assistant" ? "model" : "user",
      parts: [{ text: msg.content }]
    };
  });

  // 2. Configurar el System Prompt si existe
  const systemInstruction = system ? {
    parts: [{ text: system }]
  } : undefined;

  try {
    // Llamada al endpoint oficial del modelo gratuito Gemini 2.5 Flash
    const response = await fetch(`https://googleapis.com{apiKey}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        contents,
        systemInstruction,
        generationConfig: {
          maxOutputTokens: 1000
        }
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        statusCode: response.status,
        headers,
        body: JSON.stringify({
          error: `Gemini API error (${response.status}): ${JSON.stringify(data)}`,
        }),
      };
    }

    // ---- ADAPTACIÓN DE RESPUESTA PARA TU FRONTEND ----
    // Extraemos el texto crudo devuelto por Gemini
    const textResult = data.candidates?.[0]?.content?.parts?.[0]?.text || "No se generó respuesta.";

    // Simulamos la estructura exacta que devolvía Anthropic para que tu app frontend no falle
    const anthropicFormatResponse = {
      content: [
        {
          type: "text",
          text: textResult
        }
      ]
    };

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(anthropicFormatResponse),
    };

  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Error de red al llamar a Gemini: " + err.message }),
    };
  }
};