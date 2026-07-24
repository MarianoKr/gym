// netlify/functions/ia.js
// 
// ==========================================
// CONTROL DE VERSIÓN MASTER: 3.0 (PRO-DOCKER)
// PROVEEDOR: Google Gemini AI SDK Oficial
// ==========================================

// Importamos el SDK oficial de Google para evitar errores de red y de fetch clásico
const { GoogleGenAI } = require("@google/generative-ai");

const VERSION_MASTER = "3.0 - SDK Oficial Gemini (Estable)";

exports.handler = async (event) => {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };

  // Manejo de peticiones CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: "Método no permitido", version: VERSION_MASTER }),
    };
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: "Falta configurar GEMINI_API_KEY en las variables de entorno de Netlify.",
        version: VERSION_MASTER
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
      body: JSON.stringify({ error: "El cuerpo de la solicitud no es un JSON válido.", version: VERSION_MASTER }),
    };
  }

  const { system, messages } = payload;

  if (!Array.isArray(messages) || messages.length === 0) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: "Falta el arreglo de 'messages' en la solicitud.", version: VERSION_MASTER }),
    };
  }

  try {
    // Inicializamos el SDK de Google de forma nativa y ultra segura
    const ai = new GoogleGenAI({ apiKey: apiKey });

    // Traducimos el historial del chat al formato esperado por el SDK (user / model)
    const contents = messages.map(msg => ({
      role: msg.role === "assistant" ? "model" : "user",
      parts: [{ text: msg.content }]
    }));

    // Ejecutamos la llamada directa utilizando la arquitectura optimizada de Google
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: contents,
      config: {
        systemInstruction: system || undefined,
        maxOutputTokens: 1000
      }
    });

    // Extraemos el texto limpio procesado por la librería oficial
    const textResult = response.text || "No se recibió respuesta del modelo.";

    // Mapeamos la salida imitando el formato clásico de Anthropic para tu frontend
    const anthropicFormatResponse = {
      content: [
        {
          type: "text",
          text: textResult
        }
      ],
      backend_version: VERSION_MASTER
    };

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(anthropicFormatResponse),
    };

  } catch (err) {
    // Si la infraestructura falla, el SDK nos proveerá el código y descripción exactos
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: "Error crítico en el backend del SDK de Gemini: " + err.message,
        version: VERSION_MASTER 
      }),
    };
  }
};
