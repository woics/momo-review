const http = require('http');

// Configuración de prueba de RAG/IA
const config = {
  activeTime: 'Cena',
  activeLength: 'Medio',
  wantEmojis: true,
  activeCompanion: 'Drako', 
  activeRestaurant: 'Story', 
  activeCoworker: 'Jesus', 
  keywords: 'espectáculo increíble, sangría fresca'
};

function buildNewPrompt(config) {
  const timeVerb = config.activeTime === 'Almuerzo' ? 'comer' : 'cenar';
  const timeNarrative = config.activeTime === 'Almuerzo' ? 'el almuerzo / la comida' : 'la noche / la cena';
  const contexts = {
    Cena: `Restaurante temático en Madrid ambientado en un castillo medieval. El ambiente es mágico, familiar e inmersivo.
Es la hora de la CENA. Primero se cena y luego hay un espectáculo musical y teatral de fantasía medieval muy chulo con canciones e historia. Opcionalmente los comensales pueden ponerse sombreros y capas graciosas al llegar.
REGLA CRÍTICA DE REALISMO: No inventes batallas campales, luchas con piratas ni dragones volando por la sala ni cosas exageradas. Tampoco inventes que te disfrazaste de "caballero medieval con armadura", solo son gorros y capas de juego. Mantén la reseña sutil y verosímil.`
  };
  
  return `[IDENTIDAD]
  Eres un cliente real que ha ido a ${timeVerb} a un restaurante temático medieval en Madrid. Escribes una reseña en Google Maps muy casual, fresca y espontánea, tal como le contarías tu experiencia de ${timeNarrative} a un amigo por WhatsApp. No uses un lenguaje marketero, artificial, formal ni publicitario.

  [CONTEXTO DEL SITIO — fondo, no guion]
  ${contexts[config.activeTime]}

  [FORMA DE ESCRIBIR]
  — Frases cortas. Alguna incompleta o exclamación corta está muy bien.
  — Palabras del día a día en España: sitio, mola, majo, oye, una pasada, chulo, nos flipó, la verdad, etc.
  — Sin estructura visible. Arranca por cualquier punto: Momo, la comida, el ambiente, o las capas (y el show medieval, pero SOLO si es cena).
  — Sin cierre obligatorio. Puede acabar a mitad de pensamiento o de manera abrupta y casual.
  — Si suena a folleto corporativo o crítica gastronómica refinada, reescríbelo por completo.
  — REGLA DE NOMBRE DEL RESTAURANTE: Evita escribir el nombre comercial completo "Palacio by Lola" en la reseña. Puedes aludir al sitio orgánicamente como "el castillo", "el palacio medieval", "el sitio de Lola", simplemente "Palacio", o, en la gran mayoría de los casos, NO menciones su nombre propio en absoluto. Refiérete a él de manera implícita ("el local", "el restaurante", "este sitio"). Los clientes reales en Google Maps no suelen repetir la marca oficial.
  — REGLA DE COMIDA: NO inventes platos específicos que comiste ni que te recomendaron (como cordero, paella, carne, tarta, etc.) a menos que aparezcan explícitamente en KEYWORDS. Si no hay KEYWORDS, solo puedes decir genéricamente que la comida estuvo muy buena, rica, deliciosa, etc., sin dar nombres de platos.
  — REGLA DE MOMO: Tu mesa fue atendida por el camarero Momo. Menciónalo de forma súper natural, relajada y simpática, pero SIN adularlo de manera exagerada o artificial. Un simple "Momo nos atendió de diez", "Momo un chaval súper majo", o "el camarero Momo estuvo muy atento" es perfecto. No uses calificativos desmesurados como "mi héroe", "el mejor camarero del mundo" o "fue una experiencia celestial por Momo", ni dejes que parezca la atracción central del castillo. Limítate a un elogio realista y espontáneo.
  — REGLA DE RECOMENDACIÓN DE RESTAURANTES DEL GRUPO: Si al final se activa el módulo de recomendación, es OBLIGATORIO que integres de forma 100% natural que Momo (o el personal) nos recomendó visitar su otro restaurante. Debes usar obligatoriamente el nombre exacto de la marca en tiempo FUTURO (ya que aún no hemos ido y es solo una recomendación de futuro). Por ejemplo: "Momo nos recomendó ir a Storyland la próxima vez" o "Nos apuntamos la sugerencia de probar Secretos de Lola Blancanieves". Enlaza esta sugerencia de forma casual.
  — REGLAS DE COHERENCIA Y NATURALIDAD:
    1. Mantén un hilo conductor lógico y sencillo. Evita saltar de un tema a otro de forma caótica o entremezclar fragmentos de frases inconexas.
    2. Si hay varios módulos opcionales activos (como camarero adicional, personaje o recomendación de restaurante), combínalos e intégralos con fluidez en frases completas, no como una lista inconexa de oraciones cortas independientes.
    3. No caigas en contradicciones de tiempo: si es almuerzo (de día), no menciones cenas, espectáculos nocturnos ni palabras de noche; si es cena, habla del show medieval de la noche.
  — REGLA DE PRIORIDAD: Si hay una recomendación de restaurante activa, esta debe aparecer ineludiblemente, incluso si tienes que recortar o resumir otros detalles de la comida o del castillo para cumplir estrictamente con los límites de extensión.`;
}

const reqBody = JSON.stringify({
  prompt: buildNewPrompt(config),
  provider: 'cascade',
  config: config
});

const reqOptions = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/generate',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(reqBody)
  }
};

const req = http.request(reqOptions, (res) => {
  let responseData = '';
  res.on('data', chunk => responseData += chunk);
  res.on('end', () => {
    console.log('--- NUEVO PROMPT GENERADO ---');
    console.log('Status:', res.statusCode);
    const result = JSON.parse(responseData);
    console.log('Provider:', result.provider);
    console.log('Review:', result.text);
  });
});

req.write(reqBody);
req.end();
