# Bestral — Diseño de producto y arquitectura

Fecha: 2026-09-05
Estado: aprobado en brainstorming, pendiente de plan de implementación

---

## 1. Qué es

Bestral es una aplicación web donde describes en lenguaje natural el techno que quieres,
suena en segundos dividido en pistas, y lo esculpes hablando o tocando mandos — sin que se
te rompa lo que ya te gustaba.

**Propuesta de valor, en una frase:**

> El único generador de techno que te deja cambiar una sola cosa.

Todo lo demás en el mercado regenera. Suno regenera la canción entera y te cobra el intento.
Los proyectos existentes de Strudel con LLM reescriben el bloque de código, y con él se va tu
kick. En Bestral el kick se queda porque tiene un candado, y el candado es una comprobación en
el código, no una frase en el prompt.

## 2. Usuario objetivo

**Prosumer musical.** Oído entrenado como oyente de techno, cero horas de DAW. Sabe
perfectamente cuándo algo suena mal y no tiene ninguna herramienta para arreglarlo.

Es el hueco exacto entre Suno (no controlas nada) y Ableton (lo controlas todo, en seis meses).

**Usuario secundario:** live coder o perfil técnico, atraído por el modo código y por que el
producto sea AGPL. No es a quien optimizamos, pero es a quien evangeliza.

## 3. El bucle de producto

1. Describe: *"techno hipnótico a 132, kick seco, bajo rodante"*
2. Suena en cinco segundos, y se ve dividido en pistas
3. Toca mandos con nombre musical, o vuelve a hablar
4. **Pone candados en lo que le gusta**
5. Repite sin miedo, porque hay deshacer

El paso 4 es el que nadie más tiene. Todo lo técnico existe para sostenerlo.

## 4. Alcance del MVP

### Dentro

- Loop de 8-16 compases, sin línea de tiempo (la longitud emerge de los patrones, ver §6)
- **Cinco pistas fijas**: kick, bass, hats, perc, atmos. No se crean ni se borran
- Generación inicial desde texto
- Edición iterativa por texto
- Por pista: mute, solo, volumen, **candado**
- Por pista: 3 macros semánticos (nombres musicales, no parámetros de DSP; tabla en §6)
- Panel de código Strudel: solo lectura por defecto, editable por pista (ver §7)
- Deshacer / rehacer
- Guardar y recuperar proyectos
- Compartir con enlace que reproduce el loop

### Fuera, deliberadamente

Línea de tiempo y secciones · exportar audio · exportar MIDI · cuentas de pago ·
colaboración · samples subidos por el usuario · más de un patrón por pista · móvil.

### Riesgos del alcance, asumidos

- **"Bonito, ¿y ahora qué?"** — es el riesgo propio de elegir loop sin timeline.
  Mitigación en v1: compartir con enlace. Convierte el callejón sin salida en algo enseñable,
  que es lo que un prosumer quiere hacer con lo que ha creado. Barato de construir.
- **El usuario no sabe qué pedir.** Mitigación: los macros con nombre le enseñan el
  vocabulario. Ve un mando llamado "acidez" y aprende que puede pedir acidez.

## 5. Arquitectura

```
UI (React)  ──edición directa──┐
                               ├──►  PROYECTO (JSON, fuente única de verdad)
Chat  ──►  LLM  ──►  OPERACIONES ──►  APLICADOR (valida + candados) ──┘
                                                                      │
                                              COMPILADOR (función pura) ──► Strudel Pattern ──► audio
```

**Regla que gobierna todo el sistema:** el LLM nunca toca el proyecto ni escribe código Strudel
suelto. Emite operaciones. El aplicador decide si pasan.

### Decisión: híbrida, no Strudel-first

Se evaluaron tres arquitecturas.

**Strudel-first** (el código es la fuente de verdad) se descartó por cuatro motivos:
no hay round-trip fiable de código a estructura, así que la UI de macros se desincroniza y
miente al usuario; "no cambies el kick" pasa a ser una súplica al prompt en lugar de una
garantía; un error del LLM es un error de sintaxis que produce silencio y el prosumer no puede
depurar; y mover un knob costaría una llamada al LLM, con segundos de latencia y coste por gesto.

**Motor propio desde el día uno** (Tone.js / Web Audio) se descartó para v1: reinventa
scheduler y lenguaje de patrones, semanas antes de oír nada.

**Modelo de audio con separación en stems** (estilo Suno Studio) se descartó: no es editable
simbólicamente, los stems sangran entre sí, y no competimos en cómputo. Nuestra ventaja es
precisamente ser simbólicos.

**Se elige la híbrida**, con el esquema arrancando casi vacío y creciendo por presión de uso
real, nunca por anticipación. Sobre-diseñar el esquema es la forma más fácil de hundir esto.

### Consecuencia estratégica

Como la fuente de verdad es nuestro modelo y Strudel es solo un backend de reproducción,
sustituir el motor más adelante es escribir otro compilador, no reescribir el producto.
Eso mantiene barata la decisión sobre el AGPL (§10).

## 6. Modelo de datos

```ts
{
  bpm: 132, swing: 0,
  tracks: [{
    role: "kick",              // 5 roles fijos
    sound: "kick_dry",         // id del pack
    pattern: "bd*4",           // mini-notation, string
    macros: { punch: .6, decay: .4, tune: .5 },
    raw: null,                 // override de código; null = modo macros
    gain: .9, muted: false, locked: false
  }, ...]
}
```

**El patrón rítmico es un string de mini-notation, no un AST propio.** Es la unidad que el LLM
escribe bien, cabe en un campo, y como en v1 no hay rejilla de 16 pasos no necesitamos leerla
de vuelta. El día que llegue el step sequencer, mini-notation ↔ rejilla es una conversión
acotada. Inventar un AST hoy sería el sobre-diseño que hunde el proyecto.

**Los macros son números validados de 0 a 1**, y ahí está la inteligencia real. Cada rol tiene
los suyos y una función de mapeo a síntesis: en el bajo, `acidez` sube cutoff y resonancia a la
vez por una curva que decidimos nosotros. *"Haz el bajo más ácido"* deja de ser generación y
pasa a ser `set_macro("bass", "acidez", +0.3)`: determinista, instantáneo, gratis y reversible.

Ese mapeo de macros es el trabajo artesanal que decide si Bestral suena bien. No es código
difícil, es criterio musical, y **es el foso real** — no el código, que el AGPL nos obliga a
publicar de todas formas.

Macros por rol en v1 (cerrados, para que el plan no los invente):

| Rol | Macros |
|---|---|
| kick | `punch`, `decay`, `tune` |
| bass | `acidez`, `peso`, `movimiento` |
| hats | `densidad`, `brillo`, `swing` |
| perc | `densidad`, `caos`, `espacio` |
| atmos | `amplitud`, `oscuridad`, `movimiento` |

### Longitud del loop

**No hay campo de longitud.** Un ciclo de Strudel es un compás, y los "8-16 compases" emergen
de la mini-notation con alternancias — `"<bd*4 bd*4 bd*4 [bd*4 bd]>"` varía a lo largo de
cuatro compases y luego repite. Es responsabilidad del LLM escribir patrones con variación de
ciclo largo; no hay nada que modelar para ello, y añadir un campo `bars` sería estado
redundante que habría que mantener sincronizado con los patrones.

### Protocolo: seis operaciones y ni una más

```ts
set_macro   { track, macro, value }     // 0..1
set_pattern { track, mini }
set_sound   { track, sound }
set_track   { track, gain?, muted? }
set_global  { bpm?, swing? }
set_raw     { track, code | null }      // válvula de escape, ver §7
```

Sin `add_track` ni `remove_track`: con cinco roles fijos no hacen falta.
`set_raw` es la única forma en que el LLM escribe código Strudel, y solo dentro de una pista
concreta: nunca sobre el documento entero.
El LLM devuelve un array de estas operaciones vía `generateObject` del AI SDK con esquema Zod,
a través de AI Gateway. Un fallo del modelo es una operación rechazada con motivo, no un
silencio inexplicable.

### Aplicador

```
para cada op:
  si esquema inválido        → rechaza, explica
  si track.locked            → rechaza, "el kick está bloqueado"
  aplica → nuevo estado inmutable → push al historial
recompila → hot-swap en el siguiente compás
```

El candado se comprueba **aquí**, después del modelo, no antes. Da igual lo que el LLM haya
decidido: si la pista está bloqueada, la operación muere en la puerta. Es el único punto del
sistema que no puede fallar, y por eso es el primer test que se escribe.

### Compilador

Función pura `proyecto → Pattern`, sin lógica incremental. Recompila todo en cada cambio,
`.play()`, y Strudel mantiene la fase (validado, §8). Testeable sin audio, lo que permite
hacer TDD real sobre él.

## 7. Panel de código

El usuario puede ver y editar el código Strudel. Como el proyecto es la fuente de verdad, esto
crearía dos fuentes de verdad. **La salida no es sincronizar en ambos sentidos, es un
interruptor por pista.**

- Por defecto la pista está en **modo macros**: el panel muestra su código compilado, en solo
  lectura.
- Si el usuario lo edita, esa pista —y solo esa— pasa a **modo código** (`raw` deja de ser
  null): sus macros se apagan visiblemente y el compilador usa su código tal cual.
- Un botón "volver a macros" descarta el override.
- **Nunca hay round-trip. Hay un interruptor, y el usuario ve en qué modo está cada pista.**

Consecuencias:

- El techo de expresividad del esquema deja de ser un muro: el modo código es la válvula de
  escape, y el LLM puede usarla cuando le pidan algo que no cabe en las cinco operaciones.
- Una pista en modo código sigue respetando su candado, igual que las demás.
- El código editado se evalúa en `try/catch` **antes** de aplicarse. Si no compila, se mantiene
  el anterior y se muestra el error. Nunca se deja el proyecto en un estado mudo.
- En el chat, una pista en modo código recibe y devuelve código, no operaciones de macro.

## 8. Validación técnica realizada (spike)

Se ejecutó Strudel real en Chrome con una sonda que registra la posición de ciclo de cada
evento: 61 eventos, con recompilación completa del documento a mitad de reproducción.

| Comprobación | Resultado |
|---|---|
| Fase de ciclo tras recompilar | `…9.0 → 9.25 → 9.5…` monótona, sin reinicio |
| Silencio o hueco en el swap | Ninguno. Máximo intervalo 0,6 s, igual que antes del swap |
| Errores en consola | Ninguno en la síntesis |
| `bank("RolandTR909")` | **404 — los samples de drum machines no vienen precargados** |

Conclusiones:

1. **Recompilar el documento entero en caliente no corta el audio ni pierde la fase.** Por eso
   el compilador puede ser una función pura sin lógica incremental ni parches por pista.
2. El jitter observado (±0,1 s) ya existía antes del swap: no lo causa la recompilación.
3. **El cambio entra de inmediato, a mitad de compás** (entró en el ciclo 9.25, no en el 10).
   En techno eso se oye como un tropiezo: hay que cuantizar al siguiente compás.

## 9. Sonido

**Híbrido: síntesis paramétrica + pack propio corto.**

- Todo lo tonal (bass, stabs, atmos) y el kick, por síntesis. Da mandos continuos a la IA,
  que es lo que hace posible *"más ácido"* como gesto y no como regeneración.
- 10-15 samples propios o CC0 de percusión (hats, clap, ride, perc), donde la síntesis delata
  el juguete.

Los samples por defecto de Strudel (`tidal-drum-machines`, VCSL) quedan descartados: licencias
mixtas que estorban al monetizar, sonido genérico de live coding, y el spike confirmó que ni
siquiera vienen cargados. **El pack propio no es una preferencia estética, es infraestructura
obligatoria.**

## 10. Stack y licencia

Next.js en Vercel. Supabase para auth y una tabla de proyectos con el JSON en `jsonb`.
LLM vía AI Gateway con `generateObject` del AI SDK.

**Todo el motor vive en el cliente** — Strudel es Web Audio, no hay nada que renderizar en
servidor. El servidor solo guarda JSON y habla con el modelo. Coste de infraestructura cerca
de cero.

**Licencia:** Strudel es AGPL-3.0, y su documentación es explícita: el código fuente debe
distribuirse junto con la publicación web, los derivados usan la misma licencia, y no se puede
combinar con librerías propietarias incompatibles. Servir Strudel al navegador cuenta como
distribución.

Decisión tomada: **usar Strudel ahora bajo AGPL y revisar la postura si la idea se valida.**
Esa decisión es barata precisamente porque la capa de proyecto es nuestra desde el día uno.

## 11. Detalles que arruinan productos

Cuatro. Tres observados en el spike, no imaginados.

1. **Precargar samples antes de sonar.** En el spike `bank()` dio 404 y el kick no existió, en
   silencio. Si el usuario le da a play y suena a medias la primera vez, ya perdimos. El play se
   bloquea hasta que el pack está cargado.
2. **Cuantizar los cambios al siguiente compás.** Sin esto, cada edición entra a contratiempo.
3. **AudioContext necesita un gesto real del usuario.** El primer botón tiene que ser un botón,
   no un efecto al montar.
4. **Latencia asimétrica.** Mover un macro responde en menos de 50 ms porque no pasa por el
   modelo; una frase del chat tardará segundos. La UI debe dejar clarísimo cuál de las dos cosas
   está ocurriendo, o el usuario creerá que está rota.

## 12. Competencia

| Producto | Qué hace | Por qué no cubre esto |
|---|---|---|
| Suno Studio | Timeline, stems, MIDI | Modelo de audio: los stems sangran, cada regeneración fallida consume créditos, no es editable simbólicamente |
| WavTool | DAW con chat GPT-4 | **Cerró a finales de 2024** |
| AIVA | Multipista por lanes | No es techno ni lenguaje natural iterativo |
| strudel-mcp-bridge, strudel-claude-music-generator, apfelstrudel, strands-strudel, StrudelLM | LLM escribe un bloque de Strudel y suena | Ninguno tiene estado de proyecto, pistas como entidades ni edición quirúrgica. El mcp-bridge lo dice literalmente: "el servidor solo reenvía" |

**El hueco es el mismo en los cinco proyectos de Strudel: nadie puede cambiar una sola cosa.**

## 13. Modelo de negocio

Gratis con límite de proyectos y de mensajes de IA al día. Suscripción mensual para quitar
límites, más packs de sonido.

**Nada de créditos por generación.** Penalizar la iteración es exactamente lo que hunde la
experiencia de Suno, y nuestra ventaja es justo que iterar sea barato: la mayoría de las
ediciones ni siquiera llaman al modelo, porque mover un macro se recompila en local.

## 14. Limitaciones, dichas ahora y no después

- **Techo de expresividad:** solo existe lo que el esquema modela. Mitigado por el modo código
  (§7), pero no eliminado.
- **El LLM puede escribir mini-notation válida pero musicalmente mala.** No hay validación
  posible contra eso. Se ataca con ejemplos few-shot de techno bueno: es iteración de prompt,
  no de código.
- **Solo escritorio en v1.** Web Audio en Safari móvil da más problemas de los que podemos pagar.
- **El AGPL sigue ahí**, dormido hasta que se monetice en serio.
- **La calidad del sonido depende del mapeo de macros**, que es criterio musical artesanal y no
  se puede automatizar ni delegar.

## 15. Qué se testea

- **Aplicador:** una operación sobre pista bloqueada se rechaza. Es el primer test y el que
  define el producto.
- **Aplicador:** operación con esquema inválido se rechaza con motivo; deshacer restaura el
  estado anterior.
- **Compilador:** proyecto conocido → código esperado. Puro, sin audio.
- **Modo código:** raw que no compila deja el proyecto en su estado anterior.

No se testea el audio.
