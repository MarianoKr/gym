// netlify/functions/ia.js
// 
// VERSIÓN ACTUAL DEL ARCHIVO: 2.1 (Parche de Enrutamiento de Red IPv4)
//
// Proxy serverless optimizado para Google Gemini en Netlify.

// CORRECCIÓN CRÍTICA DE RED: Forzamos al resolvedor DNS de Node.js en Netlify
// a buscar siempre direcciones IPv4 primero para evitar el bloqueo del 'fetch failed'.
const dns = require('dns');
if (typeof dns.setDefaultResultOrder === 'function') {
  dns.setDefaultResultOrder('ipv4first');
}

const VERSION_ACTUAL = "2.1 - Modo Gemini IPv4 Estable";

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
      body: JSON.stringify({ error: "Método no permitido", version: VERSION_ACTUAL }),
    };
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: "Falta GEMINI_API_KEY en las variables de entorno de Netlify.",
        version: VERSION_ACTUAL
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
      body: JSON.stringify({ error: "Body inválido, no es JSON.", version: VERSION_ACTUAL }),
    };
  }

  const { system, messages } = payload;

  if (!Array.isArray(messages) || messages.length === 0) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: "Falta 'messages' en la solicitud.", version: VERSION_ACTUAL }),
    };
  }

  // Estructura de historial mapeada para Gemini
  const contents = messages.map(msg => ({
    role: msg.role === "assistant" ? "model" : "user",
    parts: [{ text: msg.content }]
  }));

  const systemInstruction = system ? { parts: [{ text: system }] } : undefined;

  try {
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
        body: JSON.stringify({ 
          error: `Error de Gemini API: ${errorText}`, 
          version: VERSION_ACTUAL 
        }),
      };
    }

    const data = await response.json();
    const textResult = data?.candidates?.[0]?.content?.parts?.[0]?.text || "No se pudo generar una respuesta.";

    // Estructura adaptada para tu frontend que incluye la versión del backend para verificar
    const anthropicFormatResponse = {
      content: [{ type: "text", text: textResult }],
      backend_version: VERSION_ACTUAL
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
      body: JSON.stringify({ 
        error: "Error de red al llamar a Gemini: " + err.message,
        details: err.cause ? err.cause.message : "Sin detalles adicionales",
        version: VERSION_ACTUAL // Así sabrás si el error lo da el archivo viejo o el nuevo
      }),
    };
  }
};
