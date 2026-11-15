<!-- AI-assisted: drafted with Claude (Anthropic) via Claude Code on 2026-11-15; reviewed by the team. Internal planning document (Spanish). -->

# Plan para habilitar las tendencias (test estadístico)

**Estado:** ejecutado el 15 de noviembre de 2026 (ADR-006). Las respuestas del equipo están registradas en la sección 2.
Pendiente: confirmación de José y Kiara (P-028) y revisión visual en el navegador (P-025).

## 1. Por qué este plan no elige el método

El test de tendencia es el corazón de la solución: decide qué cambio es real y cuál es ruido. La regla de IA de
Space Apps (y `CLAUDE.md`) dice que la IA **no** se usa para idear cómo resolver el reto; las decisiones de diseño
las toma el equipo (P-002). Por eso:

- Este documento **no recomienda** ningún método, umbral ni corrección. Solo ordena las decisiones y da datos objetivos.
- Las opciones listadas en las preguntas son las que **ya figuran en el kit del equipo** (*Team Kit*, sección
  "Technical Points Judges Will Check" y "Tools") o en la literatura que el equipo citó. Elegir entre ellas, o elegir
  otra, es decisión del equipo.
- Una vez decidido, Claude implementa exactamente lo decidido (código, pruebas, conexión con el front) y lo declara en
  "Use of AI".

## 2. Preguntas obligatorias (respuestas registradas el 15 de noviembre de 2026)

Marca la opción o escribe la tuya. "Equipo" = José, Alexis y Kiara. Cada respuesta indica lo que se aplicó. Cuando el
registro de la reunión no recoge una respuesta concreta, se indica así: el valor aplicado viene del kit del equipo y
se delegó a Claude (ADR-006).

### A. Qué se prueba

**A1. Variables con test** (Equipo). **Respuesta:** todas las que aportan información: NDVI, EVI, temperatura de día,
lluvia, área quemada, pérdida anual de cobertura Hansen (km²) y % de árboles MODIS. El % de árboles de Hansen no se
prueba (no puede subir). **Aplicado:** siete medidas.

**A2. Periodo del test** (Equipo). **Respuesta:** el periodo completo de cada variable. **Aplicado:** NDVI y EVI
2001–2020 (regla D1, ver D1); temperatura de día 2001–2020 (B1); lluvia 2001–2024; área quemada 2001–2025; pérdida
Hansen 2001–2025; MODIS 2000–2024 (ver D2).

**A3. Grano** (Equipo). **Respuesta:** no consta en el registro de la reunión. **Aplicado:** celdas de 1° (566).
Pendiente de confirmar por el equipo.

**A4. Paso de tiempo** (Equipo). **Respuesta:** anual.

### B. Cómo se prueba (núcleo del método, solo el equipo)

**B1. Familia de test.** **Respuesta:** Mann-Kendall original (la opción "normal"). **Aplicado:** `pymannkendall`,
`original_test`.

**B2. Estacionalidad.** **Respuesta:** se muestra como rangos anuales (mínimo y máximo mensual y el mes en que ocurren),
no se modela. **Aplicado:** el test trabaja con valores anuales (media o suma de 12 meses, solo años completos); los
rangos mensuales se publican en `zones.json` como información.

**B3. Autocorrelación.** **Respuesta:** ninguna corrección, salvo que la evaluación lo exija. **Aplicado:** regla
preregistrada: se usa el test de Hamed-Rao solo para una variable en que más del 20 % de sus celdas muestren
autocorrelación de los residuos. Resultado: ninguna variable supera el 20 % (entre 3 % y 17 %), así que se usa el
test original en todas.

**B4. Varias pruebas a la vez.** Sin respuesta concreta; delegado a Claude según el kit (Benjamini-Hochberg, `fdr_bh`).
**Aplicado:** Benjamini-Hochberg por variable (los dos indicadores de cobertura por separado), sobre todas las celdas
probadas de cada variable.

**B5. Nivel de significancia α.** Sin respuesta concreta; delegado a Claude según el kit. **Aplicado:** α = 0,05.

**B6. Mínimo de datos.** Sin respuesta concreta; delegado a Claude según el kit. **Aplicado:** al menos el 80 % de los
años de la variable deben estar completos; si no, `pValue` y pendiente quedan nulos.

**B7. Pendiente.** Sin respuesta concreta; delegado a Claude según el kit. **Aplicado:** pendiente de Sen (mediana de las
pendientes entre todos los pares de años) × 10, en unidades por década. **No aplicado:** intervalo de confianza de la
pendiente. El kit pide mostrar la incertidumbre; hoy se muestran el valor p y las comprobaciones V1–V2 (P-029).

### C. Cómo se valida (P-007)

**C1. Sin falsos positivos.** **Respuesta:** validar con código propio, sin suposiciones. **Aplicado:** V1, permutación de
los años de cada celda (20 repeticiones, semilla fija). Resultado: 0 % de celdas marcadas en casi todas las medidas;
como máximo 0,18 % en área quemada.

**C2. Casos conocidos.** Según la especificación del 15 de noviembre: los 14 *hotspots* de la validación cruzada
(celdas de Perú y Brasil descritas en `pipeline/README.md`) y La Pampa (celda r08c09), en V3.

**C3. Comparación con Giovanni** (P-007). Sin respuesta registrada. **No aplicado.** Pendiente (P-029); necesita la
herramienta web de Giovanni.

### D. Problemas conocidos de los datos

**D1. Deriva de Terra.** **Respuesta:** opción segura y sin sesgo. **Aplicado:** la regla preregistrada: correlación
de Pearson entre la hora media de paso de Terra y la anomalía anual de NDVI y EVI (2015–2025, zona Amazonía). Si
|r| ≥ 0,5, la prueba de esa variable termina en 2020. **Resultado:** r = 0,85 para NDVI y para EVI (n = 11), así que
ambas terminan en 2020. La temperatura termina en 2020 por la regla B1.

**D2. MODIS 2025 sospechoso.** **Respuesta:** opción segura: se excluye del test. **Aplicado:** MODIS se prueba de
2000 a 2024.

**D3. Regla de calidad NDVI/EVI.** **Respuesta:** opción segura: se mantiene. **Aplicado:** se usan solo los valores de
fiabilidad 0 y 1, como se exporta.

**D4. Valores implausibles.** **Respuesta:** opción segura. **Aplicado:** la LST nocturna no se exporta; no se toma
ninguna acción adicional, y queda documentado.

### E. Presentación (front)

**E1. Mapa de tendencia.** **Respuesta:** se mantienen los colores de la pendiente. **Aplicado:** escala PuOr; las celdas
no significativas se marcan con punto, además del color.

**E2. Textos.** Sin respuesta concreta registrada. **Estado:** los textos del método están en la interfaz en lenguaje
sencillo (`web/README.md`). Pendiente de revisión por el equipo.

**E3. Plan de UX** (`docs/plan-ux-ui.md`). Sin respuesta concreta registrada. **Estado:** parcialmente implementado
(P-026); las 17 preguntas siguen abiertas.

### F. Tiempo y responsables

**F1. Responsable de la decisión.** Alexis registró la decisión el 15 de noviembre. **Pendiente:** confirmación de José y
Kiara (P-028).

**F2. Hora límite.** La entrega es el domingo 15 de noviembre de 2026, a las 23:59 (hora de Lima). La hora interna de
implementación no consta en el registro.

## 3. Ejecución (a cargo de Claude, según lo decidido)

| Paso | Qué | Estado |
|---|---|---|
| 1 | Registrar la decisión | Hecho: ADR-006 (`.ai-context/04`), método (`.ai-context/01`), P-002, P-007 y P-027 en `.ai-context/05` |
| 2 | Módulo del test | Hecho: `pipeline/trends.py`, `pipeline/test_trends.py` (7 pruebas sobre series sintéticas), constantes `TREND_*` en `pipeline/config.py` |
| 3 | Resultados en el contrato | Hecho: `web/server/data/trends/`, `cover.json` (tendencias por celda), `zones.json` |
| 4 | Validación (P-007) | Hecho para V1–V4 en `validation.json` (`trendChecks`). Pendiente: comparación con Giovanni (C3) |
| 5 | Front | Hecho: capa de tendencia en el mapa, vista Tendencias, comprobaciones de confianza y ficha de la celda. Pendiente: revisión visual (P-025) |
| 6 | Documentación | Hecha: `README.md`, `pipeline/README.md`, `web/README.md` y `.ai-context` |

## 4. Datos objetivos (medidos el 2026-11-15 sobre `web/server/data/`)

| Variable | Periodo | Meses | Celdas 1° | Meses con valor por celda |
|---|---|---|---|---|
| NDVI, EVI | 2001-01 → 2026-10 | 310 | 566 | 310 (todos) |
| Temperatura de día | 2001-01 → 2020-12 | 240 | 566 | 240 (todos) |
| Lluvia | 2001-01 → 2025-09 | 297 | 566 | 297 (todos) |
| Área quemada | 2001-01 → 2026-09 | 309 | 566 | 307–309 |
| % de árboles (Hansen, MODIS) | 2000 → 2025 | 26 años | 566 | 26 |

- A 1°, el promedio de ~400 sub-celdas de 0,05° tapa los huecos por nubes: ninguna serie tiene meses vacíos.
- El ciclo estacional es fuerte en todas las variables (ver `pipeline/README.md`, *Validation of the full series*).
- El contrato y el front ya aceptan los resultados: `slopePerDecade`, `pValue`, `significant`, `method.alpha`, y el
  backend calcula el resumen (`cellsTested`, `cellsSignificant`, …).

## 5. Resultados de la primera ejecución (15 de noviembre de 2026)

Cifras de `web/server/data/validation.json` (`trendChecks`). Son los de la primera ejecución; una nueva ejecución puede
cambiarlas ligeramente.

| Medida | Periodo | Celdas con subida clara | Celdas con bajada clara |
|---|---|---|---|
| Temperatura de día | 2001–2020 | 429 | 0 |
| NDVI | 2001–2020 | 158 | 48 |
| EVI | 2001–2020 | 68 | 3 |
| Lluvia | 2001–2024 | 0 | 69 |
| Área quemada | 2001–2025 | 27 | 20 |
| Pérdida de cobertura (Hansen) | 2001–2025 | 318 | 20 |
| Cobertura de árboles (MODIS) | 2000–2024 | 27 | 135 |

- **Validación.** V1 (años barajados): casi ninguna celda marcada (máximo 0,18 %, en área quemada). V2 (tendencia
  inventada del tamaño típico): el test la encuentra en 53–92 % de las celdas, según la medida. V3 (lugares conocidos):
  la pérdida sube de forma clara en 5 de 14 *hotspots* y en La Pampa; la cobertura MODIS baja de forma clara en 9 de 14
  y en La Pampa. V4 (zonas, sin corrección por ser tres zonas): en la Amazonía entera, la temperatura sube unos 0,33 °C por
  década y el EVI sube, ambos de forma clara; la cobertura MODIS baja de forma clara; el NDVI no cambia de forma clara.
- **Límites.** Una tendencia es un patrón en las mediciones, no una causa. Una celda sin cambio claro no prueba que no
  haya cambio (V2). Falta la comparación con Giovanni y el intervalo de confianza de la pendiente (P-029).
