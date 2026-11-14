# CLAUDE.md · SIGNO (repositorio)

Este repo vive **fuera de Google Drive** (`C:\Users\DiNiCHi\dev\SIGNO`) a propósito: Drive no sincroniza bien
carpetas `.git` y José quiere entender cada paso que se aplica. La carpeta `03 Proyectos IA/SIGNO` de Drive guarda
solo documentos del equipo (investigación, guion, video, póster, notas). Ver ADR-001 en `.ai-context/04-decisions-adr.md`.

Hereda las reglas del workspace (`J:\Mi unidad\03 Proyectos IA\CLAUDE.md`). La principal: tras cada cambio técnico
hay que actualizar `.ai-context/` (pestañas 01–06) y ejecutar el sync hasta que no quede ningún `FAIL`. Desde esta carpeta:

```bash
py "J:/Mi unidad/03 Proyectos IA/.claude/context-sync/context_sync.py"
```

El repo está registrado en `.claude/context-sync/projects.toml` del workspace como `SIGNO-repo`.

## Modo aprendizaje

- José necesita entender lo que se aplica: explica cada paso (qué, por qué y alternativas), trabaja en pasos
  pequeños y deja que el equipo decida.
- Nada de commits ni push sin que José lo pida.

## Reglas específicas del proyecto

- Proyecto del equipo AETHER para NASA Space Apps 2026 (evento Lima). Entrega: domingo 15 nov 2026, 23:59 hora de Lima.
- Regla de SI de la NASA: la SI no se usa para idear cómo resolver el reto; las decisiones de diseño las toma el
  equipo. Todo código o dato generado con SI se declara en el README y en los metadatos (comentario de cabecera en
  cada archivo); imágenes y videos generados con SI llevan marca de agua visible.
- Todo lo entregable (README, página del proyecto, demo) va en inglés y con todas las fuentes citadas.
- Los datos descargados van en `data/` (no versionado). Nada de credenciales de Earthdata ni `.env` en el repo.
- El repo es **público** desde el 14 nov 2026 (los enlaces de la entrega no pueden pedir login): nunca subir
  credenciales, datos personales ni datos descargados.
