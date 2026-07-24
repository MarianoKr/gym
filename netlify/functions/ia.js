// netlify/functions/ia.js
// 
// ==========================================
// CONTROL DE VERSIÓN MASTER: 3.1 (PRO-DOCKER)
// PROVEEDOR: Google Gemini AI SDK Estable
// ==========================================

// Importamos el SDK oficial de Google
const { GoogleGenAI } = require("@google/generative-ai");

const VERSION_MASTER = "3.1 - SDK Gemini Producción (Estable)";

exports.handler = async (event) => {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };

  // 1. Control de Preflight CORS
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

  // 2. Validación de Credenciales
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: "Falta GEMINI_API_KEY en Netlify.",
        version: VERSION_MASTER
      }),
    };
  }

  // 3. Parseo Seguro del Body
  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch (e) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: "JSON inválido enviado por el cliente.", version: VERSION_MASTER }),
    };
  }

  const { system, messages } = payload;

  if (!Array.isArray(messages) || messages.length === 0) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: "Falta el arreglo 'messages'.", version: VERSION_MASTER }),
    };
  }

  try {
    // Inicialización explícita y robusta del SDK de Google
    const ai = new GoogleGenAI({ apiKey: apiKey });

    // Mapeo seguro del historial de mensajes al formato de Google (user / model)
    const contents = messages.map(msg => ({
      role: msg.role === "assistant" ? "model" : "user",
      parts: [{ text: msg.content || "" }]
    }));

    // Ejecución de la solicitud usando la API unificada
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: contents,
      config: {
        systemInstruction: system || undefined,
        maxOutputTokens: 1000
      }
    });

    // Extracción limpia del string de respuesta
    const textResult = response.text || "Respuesta vacía.";

    // Estructura idéntica al formato clásico de Anthropic para que tu frontend no diga "No pude procesar."
    const responsePayload = {
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
      body: JSON.stringify(responsePayload),
    };

  } catch (err) {
    // Captura explícita del error para que no muera en silencio el servidor
    return {
      statusCode: 200, // Forzamos 200 para inyectar el error directamente en el texto del chat y poder leerlo
      headers,
      body: JSON.stringify({
        content: [
          {
            type: "text",
            text: `[Error Servidor V3.1]: ${err.message}. Verifica las variables en Netlify.`
          }
        ],
        backend_version: VERSION_MASTER
      }),
    };
  }
};
