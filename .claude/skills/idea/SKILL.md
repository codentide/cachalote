---
name: idea
description: Captura y prioriza ideas de features, mejoras y bugs de Cachalote como issues de GitHub en codentide/cachalote, pesando impacto contra esfuerzo antes de anotarlas. Usar cuando el usuario diga /idea, "se me ocurrió algo", "anotá esta idea", "qué hay en el backlog", "qué hago ahora en Cachalote", o pida repriorizar las ideas.
---

# /idea — backlog priorizado de Cachalote

El backlog vive en los issues de `codentide/cachalote`. Orca ya los lista en la app y
arranca un worktree desde uno, así que no hay que construir nada para verlos.

El objetivo no es juntar ideas: es que lo de arriba de la lista sea siempre lo que más
rinde. Una idea que no pasa el filtro se anota igual, pero **aparcada**, y se dice por qué.

**El repo es público.** Nada de nombres de clientes, datos de Turinng, rutas con
información personal, tokens ni capturas con datos. Si la idea nace de un caso de
trabajo, se describe en abstracto.

## Modos

| El usuario dice | Modo |
| --- | --- |
| `/idea <texto>`, "se me ocurrió…" | **Capturar** |
| `/idea`, "qué hay", "qué hago ahora" | **Backlog** |
| "repriorizá", "revisá las ideas" | **Revisar** |
| "terminé #N", al commitear el feature | **Cerrar** |

## Capturar

### 1. El problema, no la solución

La idea suele llegar como solución ("un botón que…"). Reescribila como fricción: qué
pasa hoy, cuándo, qué cuesta. Si no está claro **cada cuánto** pasa o **cuánto duele**,
hacé UNA pregunta que cubra lo que falta. No más.

### 2. Antes de puntuar, descartá lo que ya existe

En este orden, y cortá en el primero que la resuelva:

1. **Duplicado:** `gh issue list -R codentide/cachalote --state all --search "<palabras>"`.
   Si existe, sumá el caso nuevo como comentario y, si cambia la frecuencia o el dolor,
   repuntuá ese issue en vez de crear otro.
2. **Orca ya lo trae:** buscá en el código (`rg` en `src/`) y en los releases nuevos
   (`git log --oneline refs/cachalote/base..upstream/main --grep "<palabra>"`). Si
   upstream lo hace o está por hacerlo, decilo y no se crea el issue.
3. **Se resuelve con configuración:** una setting de Orca, un `orca.yaml`, una skill.

### 3. Puntuá

**Frecuencia** — cada cuánto aparece la fricción:
- 3 = todos los días
- 2 = todas las semanas
- 1 = de vez en cuando

**Dolor** — qué cuesta cada vez:
- 3 = bloquea, rompe algo o corta la concentración
- 2 = minutos perdidos
- 1 = molestia

**Impacto = frecuencia × dolor** (1 a 9): alto 6–9, medio 3–4, bajo 1–2.

**Esfuerzo** — contá el costo de sync, no solo el código:
- S = hasta 2 horas y hasta 2 archivos de upstream tocados
- M = hasta un día
- L = más de un día, o muchas líneas en archivos de upstream (cada una puede chocar en
  cada release)

**Prioridad:**

| | S | M | L |
| --- | --- | --- | --- |
| Impacto alto | P1 | P1 | P2 |
| Impacto medio | P2 | P3 | P3 |
| Impacto bajo | aparcada | aparcada | aparcada |

Si queda en L, proponé el **corte más chico** que entregue la mayor parte del impacto, y
puntuá ese corte. Es lo que se anota como propuesta; el resto va a "Después".

### 4. Veredicto antes de crear

Una línea con el puntaje y la prioridad, sin pedir permiso para crear:

> P2 · impacto 6 (diaria × minutos) · esfuerzo L → anoto el corte M: solo X.

Si queda aparcada, decilo de frente: "Impacto 2: hoy no rinde. La anoto aparcada; si te
pasa más seguido, se repuntúa".

### 5. Crear el issue

Título: el resultado en español, no la solución técnica ("Ver el modo plan en el chat",
no "Agregar slot a NativeChatHeader").

```bash
gh issue create -R codentide/cachalote --title "<resultado>" \
  --label "<P1|P2|P3|aparcada>,impacto:<alto|medio|bajo>,esfuerzo:<S|M|L>,<enhancement|bug>" \
  --body-file <archivo>
```

Cuerpo:

```markdown
## Problema
Qué pasa hoy y cuándo. Una o dos líneas.

## Puntaje
Frecuencia N (por qué) × dolor N (por qué) = impacto N · esfuerzo X

## Propuesta
El corte mínimo. Qué archivos propios y cuántas líneas en upstream, estimadas.

## Done
Cómo se comprueba que quedó: un estado de UI, un comando, un valor.

## Descartado
Lo que se miró y no sirve (Orca ya lo trae a medias, configuración, otra forma).

## Después
Lo que queda fuera del corte. Omitir si no hay.
```

Cerrá con el link del issue y su posición en el backlog ("queda 2.º de los P1").

## Backlog

```bash
gh issue list -R codentide/cachalote --state open --limit 100 \
  --json number,title,labels,createdAt
```

Ordená: P1 → P2 → P3, y dentro de cada uno, impacto alto antes que medio, esfuerzo S
antes que M y M antes que L. Las aparcadas no se muestran salvo que las pidan.

Mostrá **máximo 5**, una línea cada uno: `#N título — P1 · impacto 9 · S`. Debajo, una
sola recomendación: cuál arrancar y por qué ese. Si hay un S de impacto alto, va primero
aunque haya algo más grande arriba.

## Revisar

Para cada issue abierto, preguntá solo lo que pudo cambiar: ¿sigue pasando?, ¿más o menos
seguido? Repuntuá, cambiá las etiquetas con `gh issue edit --add-label/--remove-label`, y
cerrá con `--reason "not planned"` lo que ya no aplica (upstream lo resolvió, cambió el
flujo). Reportá solo lo que se movió.

## Cerrar

Los commits van a `mine`, no a la rama por defecto, así que `Closes #N` no cierra nada.
Al commitear el feature:

```bash
gh issue close <N> -R codentide/cachalote --comment "En <sha corto>: <qué quedó, en una línea>"
```

Si se entregó solo el corte, abrí un issue nuevo con lo de "Después" y puntualo de cero:
la urgencia del original no se hereda.
