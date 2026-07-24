// netlify/functions/ia.js
// 
// =========================================================
// CONTROL DE VERSIÓN MASTER: 4.0 (NATIVA Y AUTOCONTENIDA)
// PROVEEDOR: Google Gemini API (Sin librerías externas)
// =========================================================

// Usamos el módulo HTTPS nativo de Node.js para asegurar compatibilidad total en Netlify
const https = require("https");

const VERSION_MASTER = "4.0 - Conexión Nativa HTTPS (Estable)";

exports.handler = async (event) => {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };

  // Manejo de Preflight CORS
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
      statusCode: 200,
      headers,
      body: JSON.stringify(emulateAnthropicResponse("⚙️ Falta configurar 'GEMINI_API_KEY' en las variables de entorno de Netlify.")),
    };
  }

  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch (e) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: "JSON inválido enviado por el cliente." }),
    };
  }

  const { system, messages } = payload;

  if (!Array.isArray(messages) || messages.length === 0) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: "Falta el arreglo 'messages' en la solicitud." }),
    };
  }

  // Mapeo del historial al formato oficial de Google (user / model)
  const contents = messages.map(msg => ({
    role: msg.role === "assistant" ? "model" : "user",
    parts: [{ text: msg.content || "" }]
  }));

  // Payload estructurado para la API de Gemini
  const apiPayload = JSON.stringify({
    contents,
    systemInstruction: system ? { parts: [{ text: system }] } : undefined,
    generationConfig: { maxOutputTokens: 1000 }
  });

  // Opciones de conexión HTTP nativa
  const options = {
    hostname: "://googleapis.com",
    path: `/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(apiPayload)
    }
  };

  // Envolvemos la petición nativa en una Promesa para cumplir con la arquitectura async/await de Netlify
  return new Promise((resolve) => {
    const req = https.request(options, (res) => {
      let responseBody = "";

      res.on("data", (chunk) => { responseBody += chunk; });

      res.on("end", () => {
        try {
          const data = JSON.parse(responseBody);

          if (res.statusCode !== 200) {
            const errText = data?.error?.message || "Error desconocido de API.";
            resolve({
              statusCode: 200,
              headers,
              body: JSON.stringify(emulateAnthropicResponse(`🚨 [Gemini API Error ${res.statusCode}]: ${errText}`))
            });
            return;
          }

          // Extracción segura del texto generado por Gemini
          const textResult = data?.candidates?.[0]?.content?.parts?.[0]?.text || "Respuesta vacía del servidor.";
          
          resolve({
            statusCode: 200,
            headers,
            body: JSON.stringify(emulateAnthropicResponse(textResult))
          });

        } catch (err) {
          resolve({
            statusCode: 200,
            headers,
            body: JSON.stringify(emulateAnthropicResponse(`🚨 [Error de Parseo Backend]: No se pudo procesar el JSON de Google.`))
          });
        }
      });
    });

    req.on("error", (err) => {
      resolve({
        statusCode: 200,
        headers,
        body: JSON.stringify(emulateAnthropicResponse(`🚨 [Error Crítico de Red Nativa]: ${err.message}`))
      });
    });

    // Enviamos los datos y cerramos la conexión HTTP
    req.write(apiPayload);
    req.end();
  });
};

// Función auxiliar para imitar estrictamente la estructura exacta de Anthropic
function emulateAnthropicResponse(text) {
  return {
    id: `msg_gemini_master_${Date.now()}`,
    type: "message",
    role: "assistant",
    model: "claude-sonnet-4-6-emulated",
    content: [{ type: "text", text: text }],
    stop_reason: "end_turn",
    usage: { input_tokens: 10, output_tokens: 20 },
    backend_version: VERSION_MASTER
  };
}
