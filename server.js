// server.js — Servidor unificado de producción y desarrollo (sin npm install / dependencias externas)
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

// Cargar variables de entorno desde .env si existe (solo para desarrollo local)
try {
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
      const [k, ...v] = line.split('=');
      if (k && v.length) {
        process.env[k.trim()] = v.join('=').trim();
      }
    });
  }
} catch (e) {
  console.warn("No se pudo cargar el archivo .env:", e.message);
}

const PORT = process.env.PORT || 3000;

// Utilidad auxiliar para peticiones POST HTTPS en Node.js nativo (0 dependencias)
function postJson(url, headers, body) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const bodyStr = JSON.stringify(body);
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...headers,
        'Content-Length': Buffer.byteLength(bodyStr)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({ status: res.statusCode, body: data });
      });
    });

    req.on('error', reject);
    req.write(bodyStr);
    req.end();
  });
}

// --- LLAMADAS NATIVAS A LOS PROVEEDORES DE IA CON RETROCESO EXPONENCIAL ---

async function callGemini(prompt, retries = 3) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY no configurada");

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
  const body = { contents: [{ parts: [{ text: prompt }] }] };

  for (let i = 0; i < retries; i++) {
    try {
      const res = await postJson(url, {}, body);
      if (res.status === 429 || res.status >= 500) throw new Error(`LIMIT_ERROR:${res.status}`);
      if (res.status !== 200) throw new Error(`HTTP_${res.status}: ${res.body}`);

      const data = JSON.parse(res.body);
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) return text.trim();
      throw new Error("Respuesta vacía de Gemini");
    } catch (err) {
      if (i === retries - 1) throw err;
      const wait = Math.pow(2, i) * 1000 + Math.random() * 1000;
      console.warn(`[Servidor - Gemini Intento ${i + 1}/${retries}] Reintentando en ${Math.round(wait)}ms: ${err.message}`);
      await new Promise(r => setTimeout(r, wait));
    }
  }
}

async function callGroq(prompt, retries = 3) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY no configurada");

  const url = "https://api.groq.com/openai/v1/chat/completions";
  const headers = { 'Authorization': `Bearer ${apiKey}` };
  const body = {
    model: "llama-3.1-8b-instant",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.7
  };

  for (let i = 0; i < retries; i++) {
    try {
      const res = await postJson(url, headers, body);
      if (res.status === 429 || res.status >= 500) throw new Error(`LIMIT_ERROR:${res.status}`);
      if (res.status !== 200) throw new Error(`HTTP_${res.status}: ${res.body}`);

      const data = JSON.parse(res.body);
      const text = data.choices?.[0]?.message?.content;
      if (text) return text.trim();
      throw new Error("Respuesta vacía de Groq");
    } catch (err) {
      if (i === retries - 1) throw err;
      const wait = Math.pow(2, i) * 1000 + Math.random() * 1000;
      console.warn(`[Servidor - Groq Intento ${i + 1}/${retries}] Reintentando en ${Math.round(wait)}ms: ${err.message}`);
      await new Promise(r => setTimeout(r, wait));
    }
  }
}

async function callOpenRouter(prompt, retries = 3) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY no configurada");

  const url = "https://openrouter.ai/api/v1/chat/completions";
  const headers = {
    'Authorization': `Bearer ${apiKey}`,
    'HTTP-Referer': 'http://localhost:3000',
    'X-Title': 'Momo Palacio'
  };

  const models = [
    "meta-llama/llama-3.3-70b-instruct:free",
    "google/gemma-4-31b-it:free",
    "google/gemma-4-26b-a4b-it:free",
    "deepseek/deepseek-v4-flash:free",
    "meta-llama/llama-3.2-3b-instruct:free"
  ];

  for (const model of models) {
    const body = {
      model: model,
      messages: [{ role: "user", content: prompt }]
    };

    for (let i = 0; i < retries; i++) {
      try {
        console.log(`[Servidor - OpenRouter] Intentando con modelo: ${model} (Intento ${i + 1}/${retries})...`);
        const res = await postJson(url, headers, body);
        if (res.status === 429 || res.status >= 500) throw new Error(`LIMIT_ERROR:${res.status}`);
        if (res.status !== 200) throw new Error(`HTTP_${res.status}: ${res.body}`);

        const data = JSON.parse(res.body);
        const text = data.choices?.[0]?.message?.content;
        if (text) return text.trim();
        throw new Error("Respuesta vacía de OpenRouter");
      } catch (err) {
        console.warn(`[Servidor - OpenRouter Modelo ${model} Intento ${i + 1}/${retries}] Reintentando en retry loop: ${err.message}`);
        if (i === retries - 1) {
          console.warn(`[Servidor - OpenRouter] Modelo ${model} falló definitivamente en los reintentos. Pasando al siguiente modelo libre...`);
        } else {
          const wait = Math.pow(2, i) * 1000 + Math.random() * 1000;
          await new Promise(r => setTimeout(r, wait));
        }
      }
    }
  }

  throw new Error("Todos los modelos libres de OpenRouter están temporalmente saturados.");
}

// --- ORQUESTADOR CASCADA DE IA CON CONTINGENCIA SILENCIOSA ---

async function generateTextWithFallback(prompt) {
  // 1. Intentamos con Gemini 2.5 Flash
  try {
    const text = await callGemini(prompt);
    return { text, provider: "Gemini" };
  } catch (err) {
    console.warn(">> Gemini falló o cuota agotada. Saltando a Groq de contingencia...", err.message);
  }

  // 2. Si falla Gemini, saltamos a Groq (Llama 3.1 8B)
  try {
    const text = await callGroq(prompt);
    return { text, provider: "Groq" };
  } catch (err) {
    console.warn(">> Groq de contingencia falló. Saltando a OpenRouter de contingencia...", err.message);
  }

  // 3. Si falla Groq, saltamos a OpenRouter (Llama 3.3 70B Free)
  try {
    const text = await callOpenRouter(prompt);
    return { text, provider: "OpenRouter" };
  } catch (err) {
    console.error(">> Todos los motores de IA fallaron de forma definitiva:", err.message);
  }

  throw new Error("Todos los motores de IA de contingencia están saturados o sin cuota en este momento.");
}

// --- SISTEMA DE HORARIOS Y SEGURIDAD INFRANQUEABLE (ZONA HORARIA MADRID) ---
function getMadridStatus() {
  const now = new Date();
  const options = { timeZone: 'Europe/Madrid', hour: '2-digit', minute: '2-digit', weekday: 'short', hour12: false };
  const formatter = new Intl.DateTimeFormat('en-US', options);
  const parts = formatter.formatToParts(now);
  
  let weekday = '';
  let hour = 0;
  
  for (const part of parts) {
    if (part.type === 'weekday') weekday = part.value; // 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'
    if (part.type === 'hour') hour = parseInt(part.value, 10);
  }
  
  const isRestDay = weekday === 'Mon' || weekday === 'Tue';
  const isWorkingShift = (hour >= 12 && hour < 18) || (hour >= 20 && hour < 24);
  
  return {
    isBlocked: isRestDay || !isWorkingShift,
    weekday,
    hour
  };
}

// --- RAG: INYECCIÓN DE CONTEXTO DESDE REVIEWS.JSON ---
let REVIEWS_CACHE = null;
function loadReviews() {
  if (REVIEWS_CACHE) return REVIEWS_CACHE;
  try {
    const p = path.join(__dirname, 'reviews.json');
    REVIEWS_CACHE = JSON.parse(fs.readFileSync(p, 'utf8'));
    console.log(`[RAG] Dataset cargado: ${REVIEWS_CACHE.length} reseñas reales.`);
  } catch (e) {
    console.warn('[RAG] No se pudo cargar reviews.json:', e.message);
    REVIEWS_CACHE = [];
  }
  return REVIEWS_CACHE;
}

function findRelevantReviews(config) {
  const reviews = loadReviews();
  if (!reviews.length || !config) return [];

  const COWORKER_ALIASES = {
    'Jesus': ['jesús', 'jesus'],
    'Davi': ['davi', 'daviana'],
    'Favi': ['favi', 'fabi'],
    'Dani': ['dani', 'daniela'],
    'Anto': ['anto', 'antonella'],
    'Will': ['will'],
    'Cielo': ['cielo'],
    'Lu': ['lu', 'lucía', 'lucia'],
    'Aime': ['aime', 'aimé'],
  };

  const COMPANION_ALIASES = {
    'Princesa': ['princesa', 'vera', 'ariel', 'bella', 'cenicienta'],
    'Drako': ['drako', 'draco', 'dragón', 'dragon'],
    'Principe': ['príncipe', 'principe', 'martín', 'martin'],
    'Pirata': ['pirata', 'brutus'],
  };

  const TIME_KEYWORDS = {
    'Cena': ['cena', 'cenar', 'cenamos', 'noche'],
    'Almuerzo': ['comida', 'comer', 'almuerzo', 'mediodía', 'mediodia'],
  };

  const scores = reviews.map(r => {
    const t = r.text.toLowerCase();
    let score = 0;

    const timeWords = TIME_KEYWORDS[config.activeTime] || [];
    if (timeWords.some(w => t.includes(w))) score += 1;

    if (config.activeCoworker && config.activeCoworker !== 'Momo') {
      const aliases = COWORKER_ALIASES[config.activeCoworker] || [config.activeCoworker.toLowerCase()];
      if (aliases.some(a => t.includes(a))) score += 3;
    }

    if (config.activeCompanion && config.activeCompanion !== 'Ninguno') {
      const aliases = COMPANION_ALIASES[config.activeCompanion] || [config.activeCompanion.toLowerCase()];
      if (aliases.some(a => t.includes(a))) score += 3;
    }

    if (t.includes('momo')) score += 2;

    const wordCount = r.text.split(/\s+/).length;
    if (config.activeLength === 'Corta' && wordCount < 60) score += 1;
    if (config.activeLength === 'Medio' && wordCount >= 30 && wordCount <= 120) score += 1;
    if (config.activeLength === 'Larga' && wordCount > 80) score += 1;

    return { ...r, score };
  });

  return scores
    .filter(r => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 2)
    .map(r => r.text);
}

// --- SERVIDOR HTTP CON API PROXY ---

const htmlPath = path.join(__dirname, 'index.html');
const reportsPath = path.join(__dirname, 'reports.html');

http.createServer((req, res) => {
  // CORS Básico para desarrollo
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // 1. Servir el Frontend estático index.html
  if (req.method === 'GET' && (req.url === '/' || req.url === '/index.html')) {
    fs.readFile(htmlPath, 'utf8', (err, content) => {
      if (err) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end("Internal Server Error");
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(content);
    });
    return;
  }

  // 2. API Proxy Endpoint para la Cascada de Generación
  if (req.method === 'POST' && req.url === '/api/generate') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body);
        
        // --- VALIDACIÓN DE HORARIO Y PIN DE SEGURIDAD EN EL BACKEND ---
        const schedule = getMadridStatus();
        if (schedule.isBlocked) {
          const userPin = payload.bypassPin || req.headers['x-bypass-pin'];
          if (userPin !== "2055") {
            res.writeHead(403, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: "Acceso bloqueado: Fuera del horario de atención del Reino (Lunes/Martes cerrado o fuera de turno)." }));
            return;
          }
          console.log(`[Seguridad] 🔑 Acceso fuera de horario permitido mediante PIN bypass válido.`);
        }

        if (!payload.prompt) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: "Falta el prompt" }));
          return;
        }

        const config = payload.config || {};
        const ragExamples = findRelevantReviews(config);

        let enrichedPrompt = payload.prompt;
        if (ragExamples.length > 0) {
          const examplesBlock = ragExamples
            .map((t, i) => `Ejemplo real ${i + 1}: "${t}"`)
            .join('\n\n');
          enrichedPrompt += `\n\n[INSPIRACIÓN REAL — NO COPIAR]\nEstas son opiniones reales de clientes que vivieron una experiencia similar. Úsalas ÚNICAMENTE para calibrar el tono emocional, la estructura casual y el vocabulario natural del español de calle. NO reproduzcas ni parafrasees estas frases. Escribe algo completamente diferente y original:\n\n${examplesBlock}\n`;
          console.log(`[RAG] 🟢 Inyectadas ${ragExamples.length} reseñas como contexto.`);
        } else {
          enrichedPrompt += `\n\n[CALIBRACIÓN DE TONO (Ejemplos de referencia)]\nEscribo de forma casual, simple y natural, sin usar clichés artificiales de IA ni adulación extrema: "Nos gustó mucho el sitio. La comida muy rica y bien de precio. El camarero Momo fue muy majo y estuvo súper atento. Volveremos!" o "Fui con mis amigas y nos lo pasamos genial, nos reímos un montón. Muy guay todo, lo recomiendo." Ese tono sencillo y de calle es el objetivo.\n`;
          console.log(`[RAG] 🟡 No se encontraron reseñas. Usando Few-Shot fijo.`);
        }

        let result;
        const requestedProvider = payload.provider ? payload.provider.toLowerCase() : 'cascade';

        console.log(`[Servidor] Generando reseña. Proveedor solicitado: ${requestedProvider.toUpperCase()}`);

        if (requestedProvider === 'gemini') {
          const text = await callGemini(enrichedPrompt);
          result = { text, provider: "Gemini" };
        } else if (requestedProvider === 'groq') {
          const text = await callGroq(enrichedPrompt);
          result = { text, provider: "Groq" };
        } else if (requestedProvider === 'openrouter') {
          const text = await callOpenRouter(enrichedPrompt);
          result = { text, provider: "OpenRouter" };
        } else {
          result = await generateTextWithFallback(enrichedPrompt);
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ text: result.text, provider: result.provider }));
      } catch (error) {
        console.error("Error en API Proxy:", error.message);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: error.message }));
      }
    });
    return;
  }

  // 3. Página de reportes
  if (req.method === 'GET' && (req.url === '/reports' || req.url === '/reports/')) {
    fs.readFile(reportsPath, 'utf8', (err, content) => {
      if (err) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('No se pudo cargar reports.html');
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(content);
    });
    return;
  }

  // 4. API de datos para el dashboard de reportes (Histórico Momo)
  if (req.method === 'GET' && req.url === '/api/report-data') {
    try {
      const p = path.join(__dirname, 'scrap', 'momo-reviews.json');
      const reviews = fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : [];
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(reviews));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // 5. Ruta no encontrada
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end("Not Found");

}).listen(PORT, () => {
  console.log(`\n🍑 Momo Review corriendo en → http://localhost:${PORT}\n`);
});
