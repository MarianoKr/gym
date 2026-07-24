// netlify/functions/ia.js
// 
// ==========================================
// CONTROL DE VERSIÓN MASTER: 3.2 (EMULACIÓN)
// PROVEEDOR: Google Gemini AI SDK Estable
// ==========================================

// Importación del SDK oficial de Google
const { GoogleGenAI } = require("@google/generative-ai");

const VERSION_MASTER = "3.2 - Emulación Anthropic Estricta";

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
    // Si falta la clave, devolvemos el texto simulando que habla la IA para decírtelo directamente en pantalla
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        id: "msg_error_env",
        type: "message",
        role: "assistant",
        model: "claude-sonnet-4-6-emulated",
        content: [{ type: "text", text: "⚙️ Falta configurar la variable 'GEMINI_API_KEY' en tu panel de Netlify." }],
        usage: { input_tokens: 0, output_tokens: 0 }
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
      body: JSON.stringify({ error: "JSON inválido." }),
    };
  }

  const { system, messages } = payload;

  try {
    // Inicialización del cliente unificado de Google
    const ai = new GoogleGenAI({ apiKey: apiKey });

    // Transformación limpia del historial al esquema de Google (user / model)
    const contents = messages.map(msg => ({
      role: msg.role === "assistant" ? "model" : "user",
      parts: [{ text: msg.content || "" }]
    }));

    // Ejecución de llamada con el modelo gratuito de alta velocidad
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: contents,
      config: {
        systemInstruction: system || undefined,
        maxOutputTokens: 1000
      }
    });

    const textResult = response.text || "Respuesta vacía del servidor.";

    // CLONACIÓN ESTRICTA DEL ESQUEMA ORIGINAL DE RESPUESTA DE ANTHROPIC (CLAUDE)
    // Tu frontend lee propiedades específicas como 'id', 'role' o 'content[0].text'.
    // Al rellenar este molde idéntico, el frontend procesará el mensaje sin lanzar el error visual.
    const anthropicPayloadMock = {
      id: `msg_gemini_${Date.now()}`,
      type: "message",
      role: "assistant",
      model: "claude-sonnet-4-6-emulated", // Engañamos al frontend haciéndole creer que es Claude
      content: [
        {
          type: "text",
          text: textResult
        }
      ],
      stop_reason: "end_turn",
      stop_sequence: null,
      usage: {
        input_tokens: 100,
        output_tokens: 200
      },
      backend_version: VERSION_MASTER
    };

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(anthropicPayloadMock),
    };

  } catch (err) {
    // Si ocurre un error de ejecución, también se lo inyectamos con formato limpio
    return {
      statusCode: 200, 
      headers,
      body: JSON.stringify({
        id: "msg_error_catch",
        type: "message",
        role: "assistant",
        content: [{ type: "text", text: `🚨 [Error Servidor V3.2]: ${err.message}. Revisa la consola.` }],
        usage: { input_tokens: 0, output_tokens: 0 }
      }),
    };
  }
};
