// scratch/test_schedule.js
// Script to test Madrid-timezone day and hour restriction logic

function getMadridStatusForDate(testDate) {
  const options = { timeZone: 'Europe/Madrid', hour: '2-digit', minute: '2-digit', weekday: 'short', hour12: false };
  const formatter = new Intl.DateTimeFormat('en-US', options);
  const parts = formatter.formatToParts(testDate);
  
  let weekday = '';
  let hour = 0;
  
  for (const part of parts) {
    if (part.type === 'weekday') weekday = part.value; // 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'
    if (part.type === 'hour') hour = parseInt(part.value, 10);
  }
  
  const isRestDay = weekday === 'Mon' || weekday === 'Tue';
  const isWorkingShift = (hour >= 12 && hour < 18) || (hour >= 20 && hour < 24);
  const isBlocked = isRestDay || !isWorkingShift;

  return {
    testDateStr: testDate.toISOString(),
    madridTime: `${weekday} ${hour}:00`,
    isRestDay,
    isWorkingShift,
    isBlocked
  };
}

// Batería de pruebas
const testCases = [
  new Date("2026-06-01T10:00:00Z"), // Lunes 10:00 UTC (Madrid: 12:00) -> Lunes siempre bloqueado
  new Date("2026-06-02T19:00:00Z"), // Martes 19:00 UTC -> Martes siempre bloqueado
  new Date("2026-06-03T09:00:00Z"), // Miércoles 09:00 UTC (Madrid: 11:00) -> Bloqueado (Antes del turno de las 12)
  new Date("2026-06-03T11:00:00Z"), // Miércoles 11:00 UTC (Madrid: 13:00) -> ACTIVO (Turno 12:00-18:00)
  new Date("2026-06-03T17:00:00Z"), // Miércoles 17:00 UTC (Madrid: 19:00) -> Bloqueado (Turno descanso 18:00-20:00)
  new Date("2026-06-03T19:00:00Z"), // Miércoles 19:00 UTC (Madrid: 21:00) -> ACTIVO (Turno 20:00-00:00)
  new Date("2026-06-03T23:30:00Z"), // Miércoles 23:30 UTC (Madrid Jueves: 01:30) -> Bloqueado (Madrugada Jueves)
];

console.log("=== VERIFICACIÓN DE HORARIOS (MADRID TIMEZONE) ===");
testCases.forEach((tc, idx) => {
  const result = getMadridStatusForDate(tc);
  console.log(`Caso ${idx + 1}:`);
  console.log(`  Entrada UTC: ${result.testDateStr}`);
  console.log(`  Madrid Local: ${result.madridTime}`);
  console.log(`  ¿Día de Descanso? ${result.isRestDay ? "SÍ" : "NO"}`);
  console.log(`  ¿En Turno de Trabajo? ${result.isWorkingShift ? "SÍ" : "NO"}`);
  console.log(`  ¿BLOQUEADO? ${result.isBlocked ? "🔴 SÍ" : "🟢 NO (Abierto)"}`);
  console.log("------------------------------------------------");
});
