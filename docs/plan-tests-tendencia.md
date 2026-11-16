<!-- AI-assisted: drafted with Claude (Anthropic) via Claude Code on 2026-11-15; reviewed by the team. Internal planning document (Spanish). -->

# Plan para habilitar las tendencias (test estadístico)

**Estado:** ejecutado el 15 de noviembre de 2026 (ADR-006). Las respuestas del equipo están registradas en la sección 2.
Pendiente: confirmación de José y Kiara de ADR-006 y ADR-009 (P-028) y revisión visual en el navegador (P-025). El 15 de noviembre se revisó la pérdida de Hansen: ver la sección 6. Después de la revisión de la tarde, la pérdida de Hansen se prueba como una sola tendencia (2011–2025), cada pendiente tiene un intervalo de confianza del 95 % (P-029; comprobado con scipy) y la temperatura de día se publica hasta 2026-10.

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
prueba (no puede subir). **Aplicado:** siete medidas (la pérdida de Hansen se prueba en una sola tendencia, 2011–2025, desde el 15 de noviembre; sección 6).

**A2. Periodo del test** (Equipo). **Respuesta:** el periodo completo de cada variable. **Aplicado:** NDVI y EVI
2001–2020 (regla D1, ver D1); temperatura de día 2001–2020 (B1); lluvia 2001–2024; área quemada 2001–2025; pérdida
Hansen 2011–2025, una sola tendencia (sección 6; 2001–2010 se muestra, no se prueba); MODIS 2000–2024 (ver D2).

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
pendientes entre todos los pares de años) × 10, en unidades por década. **Aplicado el 15 de noviembre (tarde):** intervalo de confianza del 95 % de la
pendiente (método de Gilbert, 1987; varianza de Mann-Kendall, o de Hamed-Rao si se usa; las pendientes entre pares respetan los años reales). Comprobado con scipy (P-029): las pendientes coinciden (`scipy.stats.theilslopes`, SciPy 1.18.1); los límites difieren en una mediana del 0,3 % de la amplitud del intervalo (21 pruebas de zona; máximo 2,3 %), porque SciPy redondea los rangos y este código interpola.

### C. Cómo se valida (P-007)

**C1. Sin falsos positivos.** **Respuesta:** validar con código propio, sin suposiciones. **Aplicado:** V1, permutación de
los años de cada celda (20 repeticiones, semilla fija). Resultado: 0 % de celdas marcadas en casi todas las medidas;
como máximo 0,18 % en área quemada.

**C2. Casos conocidos.** Según la especificación del 15 de noviembre: los 14 *hotspots* de la validación cruzada
(celdas de Perú y Brasil descritas en `pipeline/README.md`) y La Pampa (celda r08c09), en V3.

**C3. Comparación con Giovanni** (P-007). Sin respuesta registrada. **No aplicado.** Pendiente (P-007, C3); necesita la
herramienta web de Giovanni.

### D. Problemas conocidos de los datos

**D1. Deriva de Terra.** **Respuesta:** opción segura y sin sesgo. **Aplicado:** la regla preregistrada: correlación
de Pearson entre la hora media de paso de Terra y la anomalía anual de NDVI y EVI (2015–2025, zona Amazonía). Si
|r| ≥ 0,5, la prueba de esa variable termina en 2020. **Resultado:** r = 0,85 para NDVI y para EVI (n = 11), así que
ambas terminan en 2020. El r se apoya en cinco años (2021–2025), que incluyen la sequía de 2023–2024: es una coincidencia en el tiempo, no una prueba de causa. Parar las pruebas en 2020 sigue siendo la opción segura. La temperatura se prueba hasta 2020 por la regla B1; se publica hasta 2026-10 (datos reales de NASA), y desde 2021 se muestra con una marca «?» y no se prueba.

**D2. MODIS 2025 sospechoso.** **Respuesta:** opción segura: se excluye del test. **Aplicado:** MODIS se prueba de
2000 a 2024.

**D3. Regla de calidad NDVI/EVI.** **Respuesta:** opción segura: se mantiene. **Aplicado:** se usan solo los valores de
fiabilidad 0 y 1, como se exporta.

**D4. Valores implausibles.** **Respuesta:** opción segura. **Aplicado:** la LST nocturna no está en la API web (`web/server/data`); está en `amazon_monthly.json` hasta 2020-12. No se toma
ninguna acción adicional, y queda documentado.

### E. Presentación (front)

**E1. Mapa de tendencia.** **Respuesta:** se mantienen los colores de la pendiente. **Aplicado:** escala PuOr; las celdas
no significativas se marcan con punto, además del color.

**E2. Textos.** Sin respuesta concreta registrada. **Estado:** los textos del método están en la interfaz en lenguaje
sencillo (`web/README.md`). Pendiente de revisión por el equipo. El 15 de noviembre (tarde) se aplicaron reglas de interfaz: una respuesta por medida, una marca «?» cuando un límite conocido afecta al valor, y el intervalo de confianza visible. José revisará estas reglas.

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
| 2 | Módulo del test | Hecho: `pipeline/trends.py`, `pipeline/test_trends.py` (13 pruebas sobre series sintéticas, incluida la pendiente de Sen frente a `scipy.stats.theilslopes`), constantes `TREND_*` en `pipeline/config.py` |
| 3 | Resultados en el contrato | Hecho: `web/server/data/trends/`, `cover.json` (tendencias por celda), `zones.json` |
| 4 | Validación (P-007) | Hecho para V1–V4 en `validation.json` (`trendChecks`). Pendiente: comparación con Giovanni (C3) |
| 5 | Front | Hecho: capa de tendencia en el mapa, vista Tendencias, comprobaciones de confianza y ficha de la celda. Pendiente: revisión visual (P-025) |
| 6 | Documentación | Hecha: `README.md`, `pipeline/README.md`, `web/README.md` y `.ai-context` |
| 7 | Hansen como una sola tendencia 2011–2025 (ADR-009, sección 6) | Hecho: pipeline (`trends.py`, `validate.py`, `config.py`), validación contra PRODES, interfaz con una sola cobertura de árboles. Pendiente: confirmación de José y Kiara (P-028) |
| 8 | Intervalos de confianza (P-029) y temperatura de día publicada hasta 2026-10 | Hecho (15 de noviembre, tarde): `slopeCi95` en celdas, zonas, lugares conocidos y comprobaciones; temperatura publicada, tendencia 2001–2020 (B1). Comprobado con scipy (P-029). Pendiente: registrar la respuesta A3 (rejilla de 1°) |

## 4. Datos objetivos (medidos el 2026-11-15 sobre `web/server/data/`)

| Variable | Periodo | Meses | Celdas 1° | Meses con valor por celda |
|---|---|---|---|---|
| NDVI, EVI | 2001-01 → 2026-10 | 310 | 566 | 310 (todos) |
| Temperatura de día | 2001-01 → 2020-12 (tendencia); publicada hasta 2026-10 | 240 (tendencia) | 566 | 240 (todos) |
| Lluvia | 2001-01 → 2025-09 | 297 | 566 | 297 (todos) |
| Área quemada | 2001-01 → 2026-09 | 309 | 566 | 307–309 |
| % de árboles (Hansen, MODIS) | 2000 → 2025 | 26 años | 566 | 26 |

- A 1°, el promedio de ~400 sub-celdas de 0,05° tapa los huecos por nubes: ninguna serie tiene meses vacíos.
- El ciclo estacional es fuerte en todas las variables (ver `pipeline/README.md`, *Validation of the full series*).
- El contrato y el front ya aceptan los resultados: `slopePerDecade`, `pValue`, `significant`, `method.alpha`, y el
  backend calcula el resumen (`cellsTested`, `cellsSignificant`, …).

## 5. Resultados de la primera ejecución (15 de noviembre de 2026)

Cifras de `web/server/data/validation.json` (`trendChecks`). Son los de la primera ejecución, salvo la pérdida de Hansen,
que se corrigió el mismo día y se prueba solo desde 2011 (sección 6). Una nueva ejecución puede cambiarlas ligeramente.

| Medida | Periodo | Celdas con subida clara | Celdas con bajada clara |
|---|---|---|---|
| Temperatura de día | 2001–2020 | 429 | 0 |
| NDVI | 2001–2020 | 158 | 48 |
| EVI | 2001–2020 | 68 | 3 |
| Lluvia | 2001–2024 | 0 | 69 |
| Área quemada | 2001–2025 | 27 | 20 |
| Pérdida de cobertura (Hansen), tendencia 2011–2025 | 2011–2025 | 45 | 2 |
| Cobertura de árboles (MODIS) | 2000–2024 | 27 | 135 |

- **Área quemada:** 48 celdas claras en total: las 27 que suben y las 20 que bajan, más una (r24c13) con pendiente cero (intervalo [0, 0]; 20 de sus 25 años son cero).
- **Validación.** V1 (años barajados): casi ninguna celda marcada (máximo 0,18 %, en área quemada). V2 (tendencia
  simulada del tamaño típico): el test la encuentra en 53–92 % de las celdas, según la medida. V3 (lugares conocidos):
  con la pérdida de Hansen 2011–2025, ninguno de los 14 *hotspots* es claro tras la corrección (antes, 5), y La Pampa sube de forma clara; la cobertura MODIS baja de forma clara en 9 de 14
  y en La Pampa. V4 (zonas, sin corrección: 18 pruebas de zona, tres zonas por seis medidas; Brasil y Perú son partes de la Amazonía entera): en la Amazonía entera, la temperatura sube unos 0,33 °C por
  década y el EVI sube, ambos de forma clara; la cobertura MODIS baja de forma clara; el NDVI no cambia de forma clara.
- **Corrección por pruebas múltiples en zonas (no aplicada).** Los resultados de zona no se corrigen: se muestran 18 (3 zonas × 6 medidas; Brasil y Perú son partes de la Amazonía entera). Con una corrección de Benjamini–Hochberg sobre las 18, 8 de las 10 claras se mantienen; la pérdida de Hansen en Brasil (p 0,029; q 0,059) y en Perú (p 0,048; q 0,086) no. Ambas están en el límite y no son robustas si se deja fuera un año. La pérdida de la Amazonía entera se mantiene clara (p 0,0075; q 0,017) y al dejar fuera cualquier año (peor p 0,0215). Aplicar la corrección a las zonas es una decisión del
  equipo después de la entrega.
- **Límites.** Una tendencia es un patrón en las mediciones, no una causa. Una celda sin cambio claro no prueba que no
  haya cambio (V2). Falta la comparación con Giovanni (P-007, C3). Los intervalos de confianza de la pendiente están publicados y comprobados con scipy (P-029).
  - **Cambio de nivel en la pérdida de Hansen.** La subida 2011–2025 es un nivel más alto desde 2016 (unos 17 900 km²
    por año en 2011–2015, frente a 34 000 en 2016–2025), no una subida continua. Dentro de 2016–2025 no hay tendencia
    (p 0,86). No hay salto en Landsat 8 (2013) ni en Landsat 9 (2022), y PRODES sube en los mismos años. Empezar la
    prueba en 2013 no sería robusto; 2011 se mantiene porque es el año documentado de reprocesado, no uno elegido tras ver los datos.
  - **Celdas no independientes.** Las vecinas comparten años de clima (residuos de LST, correlación media por pares
    +0,42): las 566 celdas se comportan como unos 5 patrones independientes para LST y NDVI. Una permutación espacialmente
    coherente (la misma para todas las celdas, 10 000 repeticiones) rara vez alcanza los recuentos reales (p de campo
    ≤ 0,0006): los recuentos no son azar, pero el resultado principal es la zona con su intervalo, y los recuentos muestran dónde.
  - **Años faltantes.** Mann-Kendall usa solo el orden de los valores anuales, así que un año que falta no lo sesga; la pendiente de Sen usa los años reales.

## 6. Revisión del 15 de noviembre: Hansen como una tendencia desde 2011

Decisión de Alexis del 15 de noviembre de 2026, registrada como ADR-009 en `.ai-context/04-decisions-adr.md`. Estado:
aceptada por Alexis; pendiente de confirmación por José y Kiara junto con ADR-006 (P-028).

**Enmienda (tarde del 15 de noviembre).** Alexis pidió una sola respuesta por medida. Por eso la pérdida de Hansen se prueba en una sola tendencia, 2011–2025 (`HANSEN_LOSS_TREND_YEARS` = 2011–2025; `HANSEN_METHOD_CHANGE_YEAR` = 2011). Esta enmienda sustituye a la presentación en dos tramos. La evidencia de esa presentación se conserva en `trendChecks.hansenConsistency`. Todos los años 2001–2025 se publican y se muestran; 2001–2010 aparecen en gris y no se usan en la tendencia.

**A. Comparabilidad de los años de Hansen.** Las notas de uso de Hansen y UMD para Global Forest Change v1.13
(<https://storage.googleapis.com/earthenginepartners-hansen/GFC-2025-v1.13/download.html>) dicen que los autores
reprocesaron la pérdida desde 2011 en adelante, pero no 2001–2010: "users will notice inconsistencies as a result"
(los usuarios notarán incoherencias). Landsat 8 se usa desde 2013 y Landsat 9 desde 2022. Las notas añaden que
"care must be taken when comparing change across any interval" (hay que tener cuidado al comparar cambios en cualquier
intervalo), que los datos son "a relative indicator of spatiotemporal trends" (un indicador relativo de tendencias
espacio-temporales) y que "definitive area estimation should not be made using pixel counts" (no deben estimarse áreas
definitivas con recuentos de píxeles). Nuestros documentos decían "hacia 2013", citando a Global Forest Watch; esa
frase se sustituye en todo el repositorio por esta nota.

**B. Validación contra la serie oficial de PRODES.** Fuente: INPE, "Série Histórica Taxas Prodes Amazônia",
Apresentação Coletiva Prodes 2026, 16 oct 2026, p. 4
(<https://www.gov.br/inpe/pt-br/assuntos/ultimas-noticias/brasil-alcanca-menores-taxas-de-desmatamento-da-serie-historica-na-amazonia-e-no-cerrado>).
Amazonía Legal brasileña; año PRODES de agosto a julio; tala rasa de bosque primario de al menos 6,25 ha. Pérdida de
Hansen en nuestra zona de la Amazonía brasileña frente a PRODES:

| Tramo | r | Razón Hansen / PRODES |
|---|---|---|
| 2001–2010 | 0,85 | 1,15 |
| 2011–2025 | 0,20 | 2,70 |

Desde 2011 Hansen también cuenta el dosel muerto por fuego y el dosel degradado (por eso tiene picos en 2016–2017 y en
2024), y usa el método reprocesado. Un único test de Mann-Kendall sobre 2001–2025 da una tendencia creciente en la
Amazonía (p = 0,047) mientras PRODES baja (p = 0,014). Es un artefacto del cambio de 2011, por eso no se usa. MODIS,
sensor independiente, confirma *dónde* ve Hansen la pérdida: en las 566 celdas, r = −0,79 (2001–2010) y −0,47
(2011–2025) entre la pérdida de Hansen y el cambio de cobertura de MODIS.

**C. Decisión (ADR-009).**

- La pérdida anual de Hansen se prueba en una sola tendencia, 2011–2025, nunca a través de 2011. Los valores anuales de los 25
  años siguen publicados y visibles. Los años 2001–2010 son datos reales de Hansen con el método anterior: se muestran en gris,
  con una nota de información, y no se usan en la tendencia. Cada gráfica de Hansen marca 2011 con una línea discontinua.
  La pérdida tiene su propia familia de Benjamini-Hochberg, con la misma prueba que ADR-006.
- Resultados:
  - Los años 2001–2010 no se prueban: se muestran en gris.
  - Celdas 2011–2025: 566 probadas, 45 crecientes y 2 decrecientes (antes, con 2001–2025 como una sola serie: 318 y 20; ese resultado queda superado).
  - Zonas 2011–2025 (los años 2001–2010 no se prueban): Amazonía creciente (p 0,0075; +12.040 km² por año y por década; IC 95 % +5.145 a +19.582); Brasil creciente (p 0,029; +8.709); Perú
    creciente (p 0,048; +456). PRODES: creciente (p 0,048).
  - Lugares conocidos (V3, pérdida 2011–2025): La Pampa (r08c09) sigue creciendo de forma clara (+43,5 km² por año y por década; IC 95 % +27,8 a +53,3; p 0,00025; q 0,019; la pérdida
    empieza en 2012). Ninguno de los 14 *hotspots* es claro tras la corrección (antes, 5). Los *hotspots* se eligieron por
    sus picos de pérdida (sucesos aislados, como los años de fuego), no por tendencias sostenidas.
- Una sola cobertura de árboles en la interfaz: solo se muestra la de Hansen. MODIS sale del mapa, del visor de área y de
  la vista de Tendencias; queda en Validación cruzada y en Método, como comprobación independiente de dónde ocurrió la
  pérdida. Motivos: miden cosas distintas (media de 2024 ponderada por área: Hansen 78,6 %, MODIS 62,4 %); MODIS es
  ruidoso de un año a otro (±1,5 puntos); y MODIS 2025 es anómalo (en 127 celdas con casi nada de pérdida de Hansen baja
  3,94 puntos, 2,5 desviaciones típicas por debajo de sus cambios anuales de 2001–2024). La tendencia de MODIS sigue
  calculándose en `validation.json`, pero no se muestra.
- MODIS 2025 queda fuera del cruce "cambio frente a pérdida de Hansen" (`pipeline/validate.py`). El cambio MODIS es ahora
  la media de 2023–2024 menos la de 2001–2002, frente a la pérdida de Hansen 2001–2024. Nuevas r: Amazonía −0,729
  (antes −0,719); Amazonía brasileña −0,786 (antes −0,781); Amazonía peruana −0,578 (antes −0,603).
- Datos: `web/server/data/cover.json` (por celda, `trends.lossKm2` para 2011–2025),
  `web/server/data/zones.json` (`zoneTrend`, 2011–2025) y `web/server/data/validation.json`
  (`trendChecks.hansenConsistency`).
- Intervalos de confianza del 95 % (`slopeCi95`, P-029): cada pendiente publicada los tiene. El intervalo contiene la pendiente de Sen en todas las celdas probadas. En las celdas significativas, el intervalo excluye 0 salvo en 2 celdas de área quemada (series con muchos empates). Una celda no significativa puede tener un intervalo que excluye 0, porque los intervalos no están corregidos por varias pruebas. Ejemplo: temperatura de día de la Amazonía, +0,33 °C por década, IC +0,17 a +0,55. Comprobación con scipy pendiente.
