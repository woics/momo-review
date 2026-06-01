// toggle-dev.js — Script de Automatización para activar/desactivar el panel de pruebas
const fs = require('fs');
const path = require('path');

const indexHtmlPath = path.join(__dirname, 'index.html');
const action = process.argv[2]?.toLowerCase();

if (!action || !['enable', 'disable', 'on', 'off'].includes(action)) {
  console.log('\x1b[36m%s\x1b[0m', '==================================================');
  console.log('\x1b[36m%s\x1b[0m', '      ⚙️  CONTROLADOR DE MODO TEST/DEV - MOMO ⚙️');
  console.log('\x1b[36m%s\x1b[0m', '==================================================');
  console.log('Uso del comando:');
  console.log('  \x1b[32mnode toggle-dev.js enable\x1b[0m  (o "on")  -> Activa el panel de testeo matricial (?dev=true)');
  console.log('  \x1b[31mnode toggle-dev.js disable\x1b[0m (o "off") -> Desactiva y bloquea por completo el panel de testeo');
  console.log('==================================================\n');
  process.exit(0);
}

try {
  if (!fs.existsSync(indexHtmlPath)) {
    console.error(`\x1b[31m[ERROR] No se encontró el archivo index.html en: ${indexHtmlPath}\x1b[0m`);
    process.exit(1);
  }

  let content = fs.readFileSync(indexHtmlPath, 'utf8');
  
  const shouldEnable = ['enable', 'on'].includes(action);
  const targetString = shouldEnable 
    ? 'const ALLOW_DEV_PANEL = true; // SWITCH_DEV_PANEL'
    : 'const ALLOW_DEV_PANEL = false; // SWITCH_DEV_PANEL';

  // Buscar ambas posibilidades de reemplazo
  const patternTrue = /const ALLOW_DEV_PANEL\s*=\s*true;\s*\/\/\s*SWITCH_DEV_PANEL/;
  const patternFalse = /const ALLOW_DEV_PANEL\s*=\s*false;\s*\/\/\s*SWITCH_DEV_PANEL/;

  let updated = false;

  if (content.match(patternTrue) || content.match(patternFalse)) {
    content = content.replace(patternTrue, targetString);
    content = content.replace(patternFalse, targetString);
    updated = true;
  }

  if (updated) {
    fs.writeFileSync(indexHtmlPath, content, 'utf8');
    if (shouldEnable) {
      console.log('\n\x1b[32m%s\x1b[0m', '==================================================');
      console.log('\x1b[32m%s\x1b[0m', '   🟢 MODO TEST ACTIVADO CORRECTAMENTE (ALLOW_DEV_PANEL = true)');
      console.log('   Ya puedes entrar a: http://localhost:3000/?dev=true');
      console.log('\x1b[32m%s\x1b[0m', '==================================================\n');
    } else {
      console.log('\n\x1b[31m%s\x1b[0m', '==================================================');
      console.log('\x1b[31m%s\x1b[0m', '   🔴 MODO TEST DESACTIVADO Y BLOQUEADO (ALLOW_DEV_PANEL = false)');
      console.log('   El panel de pruebas y selector de IA están 100% apagados.');
      console.log('   Incluso usando "?dev=true" en la URL quedarán ocultos.');
      console.log('\x1b[31m%s\x1b[0m', '==================================================\n');
    }
  } else {
    console.log('\x1b[33m%s\x1b[0m', '\n[AVISO] No se encontró el marcador SWITCH_DEV_PANEL en index.html. Revisa el archivo.');
  }

} catch (err) {
  console.error('\x1b[31m%s\x1b[0m', `\x1b[31m[ERROR] Ocurrió un fallo al modificar index.html: ${err.message}\x1b[0m`);
}
