// netlify/functions/ia.js
//
// Proxy serverless: recibe { system, messages } desde la app y llama a la API
// de Anthropic usando la clave guardada como variable de entorno en Netlify
// (así la clave nunca queda expuesta en el HTML/JS del navegador).
//
// Configuración necesaria en Netlify:
//   Site settings → Environment variables → agregar ANTHROPIC_API_KEY
//
// Modelo: claude-sonnet-4-6 (buena calidad/costo). Si querés algo más barato
// para uso frecuente, cambiá a "claude-haiku-4-5-20251001".

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

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error:
          "Falta ANTHROPIC_API_KEY en las variables de entorno de Netlify. Andá a Site settings → Environment variables.",
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

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1000,
        system: system || undefined,
        messages,
      }),
    });

    const text = await response.text();

    if (!response.ok) {
      // Reenviamos el detalle del error de la API para poder debuggear
      return {
        statusCode: response.status,
        headers,
        body: JSON.stringify({
          error: `Anthropic API error (${response.status}): ${text.slice(0, 300)}`,
        }),
      };
    }

    // La respuesta ya viene en el formato { content: [...] } que espera el frontend
    return {
      statusCode: 200,
      headers,
      body: text,
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Error de red al llamar a Anthropic: " + err.message }),
    };
  }
};
