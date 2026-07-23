// netlify/functions/ia.js
// Proxy serverless para el Entrenador IA de GymWork.
// La API key NUNCA se expone al navegador: vive solo como variable de entorno en Netlify.
//
// Configuración requerida en Netlify:
//   Site settings → Environment variables → agregar ANTHROPIC_API_KEY con tu key (sk-ant-...)

exports.handler = async function (event) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Falta configurar ANTHROPIC_API_KEY en las variables de entorno de Netlify.' }),
    };
  }

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch (e) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'JSON inválido' }) };
  }

  const { system, messages } = payload;
  if (!Array.isArray(messages)) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Falta "messages"' }) };
  }

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1000,
        system: system || undefined,
        messages,
      }),
    });

    const data = await r.json();
    return { statusCode: r.status, headers, body: JSON.stringify(data) };
  } catch (err) {
    return { statusCode: 502, headers, body: JSON.stringify({ error: 'Error al contactar la API: ' + err.message }) };
  }
};
