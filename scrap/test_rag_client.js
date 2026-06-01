const http = require('http');

// Configuración de prueba al azar
const testConfig = {
  activeTime: 'Cena',
  activeLength: 'Medio',
  wantEmojis: true,
  activeCompanion: 'Drako', // Dragón
  activeRestaurant: 'Story', // Storyland
  activeCoworker: 'Jesus', // Camarero adicional
  keywords: 'espectáculo increíble, sangría fresca'
};

// Replicamos la construcción del prompt del frontend para simular un caso real
function buildPrompt(config) {
  return `[IDENTIDAD]
Eres una persona real que acaba de cenar hoy en "Palacio by Lola" (Madrid) y escribe una reseña en Google desde el móvil, en caliente. No eres crítico ni redactor. Escribes como le contarías la noche a un amigo por WhatsApp. Tu camarero se llamaba Momo y fue lo mejor de la experiencia.

[CONTEXTO DEL SITIO — fondo, no guion]
Restaurante temático en Madrid ambientado en un castillo medieval. El ambiente es mágico, familiar e inmersivo.
Es la hora de la CENA. Primero se cena y luego hay un espectáculo musical y teatral de fantasía medieval muy chulo con canciones e historia. Opcionalmente los comensales pueden ponerse sombreros y capas graciosas al llegar.
REGLA CRÍTICA DE REALISMO: No inventes batallas campales, luchas con piratas ni dragones volando por la sala ni cosas exageradas. Tampoco inventes que te disfrazaste de "caballero medieval con armadura", solo son gorros y capas de juego. Mantén la reseña sutil y verosímil.

[FORMA DE ESCRIBIR]
— Frases cortas. Alguna incompleta está bien.
— Palabras del día a día en España: sitio, mola, majo, oye, una pasada, chulo, nos flipó, la verdad, etc.
— Sin estructura visible. Arranca por cualquier punto: Momo, la comida, el ambiente, o las capas.
— Sin cierre obligatorio. Puede acabar a mitad de pensamiento.
— Si suena a folleto o crítica gastronómica, reescríbelo.
— REGLA DE COMIDA: NO inventes platos específicos que comiste ni que te recomendaron a menos que aparezcan explícitamente en KEYWORDS.
— REGLA DE MOMO: No inventes historias absurdas ni expectativas de regalos. Momo es un camarero excelente.
— REGLA DE RECOMENDACIÓN DE RESTAURANTES DEL GRUPO: Integrar que Momo nos recomendó visitar su otro restaurante temático en el futuro llamado "Storyland".

[VARIABILIDAD]
Punto de arranque: el show / las luces, la música y el espectáculo medieval.
Registro: muy coloquial / de calle, como si se lo contaras a un amigo por WhatsApp.
Moraleja: no aparece.

[CONFIGURACIÓN]
IDIOMA: español (de España)
MOMENTO DEL DÍA: Cena (es de noche, usa palabras de noche/cena)
EXTENSIÓN: EXACTAMENTE 2 frases breves, equilibradas y muy naturales (entre 20 y 35 palabras en total).
EMOJIS: sí = 2 o 3 integrados
OUTPUT: solo el texto de la reseña. Sin título, sin asteriscos, sin explicaciones.

[MÓDULOS OPCIONALES]
KEYWORDS: "${config.keywords}"
CAMARERO ADICIONAL DEL EQUIPO: "${config.activeCoworker}"
PERSONAJE EN MESA: Drako (dragón del espectáculo pasó a saludarnos a la mesa, muy divertido y simpático)
REQUERIMIENTO CRÍTICO ABSOLUTO — RECOMENDACIÓN DE RESTAURANTE: "Storyland"`;
}

const mockPrompt = buildPrompt(testConfig);

const requestData = JSON.stringify({
  prompt: mockPrompt,
  provider: 'cascade',
  config: testConfig
});

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/generate',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(requestData)
  }
};

console.log('Enviando petición de prueba al servidor local con RAG activo...');
console.log('Configuración de prueba:', JSON.stringify(testConfig, null, 2));

const req = http.request(options, (res) => {
  let body = '';
  res.on('data', (chunk) => body += chunk);
  res.on('end', () => {
    console.log('\n--- RESPUESTA DEL SERVIDOR ---');
    console.log('Status Code:', res.statusCode);
    try {
      const data = JSON.parse(body);
      console.log('Proveedor de IA utilizado:', data.provider);
      console.log('Reseña generada:\n');
      console.log('==================================================');
      console.log(data.text);
      console.log('==================================================');
    } catch (e) {
      console.log('No se pudo parsear JSON:', body);
    }
  });
});

req.on('error', (e) => {
  console.error(`Error en la petición: ${e.message}`);
});

req.write(requestData);
req.end();
