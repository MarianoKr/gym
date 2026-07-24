// netlify/functions/ia.js
//
// Proxy serverless optimizado para Google Gemini en Netlify.

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

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: "Falta GEMINI_API_KEY en las variables de entorno de Netlify.",
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

  // Estructura de historial mapeada para Gemini
  const contents = messages.map(msg => ({
    role: msg.role === "assistant" ? "model" : "user",
    parts: [{ text: msg.content }]
  }));

  const systemInstruction = system ? { parts: [{ text: system }] } : undefined;

  try {
    // Usamos el endpoint HTTP v1beta estable de Google Gemini
    const url = `https://googleapis.com{apiKey}`;
    
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents,
        systemInstruction,
        generationConfig: { maxOutputTokens: 1000 }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        statusCode: response.status,
        headers,
        body: JSON.stringify({ error: `Error de Gemini API: ${errorText}` }),
      };
    }

    const data = await response.json();
    
    // Extracción ultra segura del texto devuelto por Gemini
    const textResult = data?.candidates?.[0]?.content?.parts?.[0]?.text || "No se pudo generar una respuesta.";

    // Estructura idéntica al formato clásico de Anthropic para tu frontend
    const anthropicFormatResponse = {
      content: [{ type: "text", text: textResult }]
    };

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(anthropicFormatResponse),
    };

  } catch (err) {
    // Si vuelve a fallar, exponemos la causa real para diagnosticar de inmediato
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: "Error de red al llamar a Gemini: " + err.message,
        details: err.cause ? err.cause.message : "Sin detalles adicionales"
      }),
    };
  }
};
