# Zombies Everywhere

Browser survival prototype built on [Slop New York](https://github.com/mrdoob/slop-newyork) by Mr.doob (Three.js, WebGPURenderer and TSL).

## Primera misión: Antes del silencio

Un 2020 alternativo y ficticio. Mientras las noticias informan de una infección desconocida, sales a comprar y hablas por teléfono con tu esposa. Un incidente junto al **Centro Médico Hudson, ficticio**, convierte el paseo en una huida hacia un refugio temporal.

Los informativos, el origen de la infección y los acontecimientos son ficción; no representan hechos de la pandemia real de COVID-19.

### Ejecutar en tu PC

Desde la carpeta del repositorio, con Python instalado:

```sh
python -m http.server 8000
```

Abre **http://localhost:8000** en un navegador de escritorio con aceleración gráfica. No abras `index.html` directamente con `file://`. No hay instalación del juego, cuentas ni servidor de partidas. Hace falta conexión para descargar Three.js y otros recursos externos; el primer arranque puede tardar por la construcción de Manhattan y sus shaders.

1. Selecciona Español o English y pulsa **Comenzar historia**.
2. Mira el informativo animado en un televisor dentro de una sala 3D (42 segundos), o pulsa **Salir a la calle**. La cámara se acerca a la pantalla; la emisión cambia de fecha, mueve al presentador y muestra un hospital con luces de emergencia. Es animación procedural, no una grabación periodística real.
3. Camina hacia la farmacia. A los pocos segundos se levanta el celular con una alerta sanitaria y la llamada de **Esposa**. Pulsa **Contestar** o **F**. La secuencia vuelve a la calle al terminar el primer diálogo; el nombre propio anterior se ha eliminado.
4. Cuando empieza el brote, busca la patrulla. Tras su llegada (17 segundos), mantén **F durante 3 segundos** junto a la radio para pedir acceso al refugio. Después sigue el marcador verde. Los personajes de piel gris verdosa y ropa oscura son zombis; en el minimapa aparecen en rojo, los civiles en azul y las personas contagiadas en ámbar.
5. Si pierdes toda la salud, puedes reiniciar. Llegar al refugio termina esta primera misión.

| Control | Acción |
| --- | --- |
| W / S o flechas arriba / abajo | Avanzar / retroceder |
| A / D o flechas izquierda / derecha | Girar al personaje |
| Shift | Correr; consume resistencia |
| Espacio | Saltar |
| Arrastrar ratón | Girar la cámara |
| F (mantener) | Solicitar acceso al refugio por la radio de la patrulla |
| Esc o botón Pausar | Pausar / continuar |

La partida también se pausa al cambiar de pestaña o perder el foco. El idioma se guarda localmente si el navegador lo permite. La misión se reinicia al recargar; no hay guardado de progreso. La resistencia agotada debe recuperar un 25% antes de volver a correr.

### Alcance de esta entrega

- Manhattan, sector jugable delimitado con 500 manzanas de entorno; informativo animado sobre una TV 3D y llamada mediante texto, sin doblaje.
- Centro médico y refugio señalizados en el exterior; no hay interiores de hospital o apartamento.
- Doce zombis iniciales con marcha rápida (2,55–2,71 m/s), sin carrera y 40 peatones de misión. Los civiles están distribuidos en varios grupos y huyen hacia cinco salidas: norte, dos al este y dos al oeste. Usan velocidades individuales y separación local para evitar una fila única; si una salida no es navegable, recurren a una ruta conectada. Algunos zombis cazadores priorizan al protagonista hasta 120 metros, sin abandonar una víctima a distancia de mordida. Los otros eligen entre el jugador y civiles cercanos. El trayecto previo ya incluye vehículos detenidos y una patrulla que pasa con luces, antes del brote.
- Un ataque a corta distancia contagia al peatón: 6 segundos herido, 2 segundos de transformación y después se convierte en un zombi. El proceso está identificado por el color ámbar en el minimapa y un contador de contagios. Las paredes bloquean el contacto; los refugiados están a salvo. El total de actores nunca aumenta por el contagio. Hay hasta cuatro entradas adicionales de cuatro zombis por las calles 44 a 47, con separación mínima de 22 metros respecto al jugador y un máximo de 68 actores contando los refuerzos.
- Apariencia de zombi propia con piel gris verdosa, ropa oscura, heridas, inclinación corporal, brazos adelantados y paso lento. Modelos procedurales sencillos dibujados mediante instancias compartidas.
- El brote activa la huida de todos los civiles de misión, cuatro choques dirigidos (ocho vehículos), la llegada de una patrulla con dos agentes, seis focos de incendio y humo que se activan a los 3, 8, 13, 18, 23 y 28 segundos y una transición al anochecer. Estos incidentes usan el reloj de misión y se congelan durante la pausa; no son una simulación física completa de accidentes o propagación de fuego. Acercarse a los focos de incendio causa daño.
- Gruñidos mediante tres grabaciones vocales CC0 de artisticdude, incluidas localmente (unos 20 KB en total). Se decodifican tras activar el audio y alternan con ligeras variaciones. Procedencia, licencia y conversión en [assets/audio/CREDITS.md](assets/audio/CREDITS.md). La TV alterna estudio y tomas ampliadas cada cinco segundos; sus tres boletines muestran hospital/ambulancia, imágenes urbanas no verificadas y un mapa internacional. Una sintonía real de noticias, **Beyond The Clouds** de **Matthew Pablo** (CC BY 3.0, extracto con atribución en el menú), acompaña la introducción. Durante la huida suenan gritos **CC0 de WuxiaScrub**. Todos los archivos están incluidos localmente. Teléfono, sirenas, impacto y ruido ambiental siguen siendo sintetizados. No hay doblaje de noticias o diálogos. Se conservan mute, pausa y límite de voces.
- Salud, resistencia, navegación, pausa, victoria, derrota y reinicio.
- Interfaz y narrativa en español e inglés. Los nombres propios permanecen.
- **Sin armas todavía**: este episodio prueba la huida. El arma, el regreso a casa y la búsqueda completa de tu esposa son la siguiente entrega.
- **Lima está anunciada, pero no es seleccionable todavía.** Tendrá un escenario y una disponibilidad de armas propios.
- Objetivo de soporte inicial: PC, teclado y ratón; no se ha implementado el modo de supervivencia para móvil o mando.

En la misión se sustituye la multitud ambiental original por los 40 civiles del brote, todos susceptibles al contagio. El tráfico se reduce de 200 autos y 12 buses a 24 autos y 2 buses; se desactiva el tráfico de autopistas. El explorador conserva su población original. La navegación de infectados usa obstáculos estáticos y no simula interiores, escaleras ni evasión de vehículos en movimiento.

El explorador original sigue disponible con **http://localhost:8000/?mode=explore**. Conserva sus menús originales en inglés, vehículos y teletransportes. Estos accesos están deshabilitados en la misión.

### Rendimiento y calidad

El selector aplica la calidad en el momento: mantiene la misión, la salud, el contagio y el audio. No navega ni reconstruye la ciudad. Activar sombras puede producir una compilación inicial de shaders. El idioma se conserva.

| Perfil | Resolución interna | Sombras y posprocesado |
| --- | --- | --- |
| Rendimiento | 60% por eje | Sin sombras, reflejos SSR ni bloom |
| Equilibrado (predeterminado) | 80% por eje | Sin sombras, reflejos SSR ni bloom |
| Cinemático | 100% por eje | Sombras, reflejos SSR, bloom y tratamiento de color originales |

La misión selecciona exactamente las 500 manzanas más cercanas al centro del recorrido, con sus edificios originales. Restaura los monumentos dentro de ese entorno, incluida la Biblioteca Pública de Nueva York y su relación con Bryant Park. Las aceras son losas extruidas de 22 cm con textura de concreto, juntas y caras de bordillo; ya no se pinta de verde todo un bloque clasificado como parque. Las losas se agrupan por celdas de 200 m para reducir llamadas de dibujo.

Las 500 manzanas permanecen residentes; la cámara y el culling por frustum/celdas limitan lo que se dibuja. El detalle arquitectónico cercano sigue usando el quadtree del proyecto original. Alcance de cámara: 350 m en Rendimiento, 550 m en Equilibrado y 850 m en Cinemático. No es streaming infinito ni descarga dinámica de edificios. La generación inicial y la primera compilación de efectos pueden tardar, especialmente en Cinemático.

El selector mantiene la partida. Activar Cinemático puede compilar por primera vez sus sombras/reflejos. El mapa geográfico compartido y el grafo de tráfico siguen cargándose. El máximo de población es de 68 actores; el contagio reutiliza al civil. No se garantiza una tasa de FPS sin medir el equipo objetivo.

### Estructura

| Módulo | Responsabilidad |
| --- | --- |
| `js/outbreak/mission.js` | Reglas de progreso, salud, resistencia y configuración del capítulo |
| `js/outbreak/navigation.js` | Rejilla local de obstáculos y campo de rutas compartido |
| `js/outbreak/actors.js` | Movimiento y presentación de la población |
| `js/outbreak/sector.js` | Selección de 500 manzanas, aceras y agrupación espacial |
| `js/outbreak/tv-introduction.js` | Sala, televisor 3D y planos variables de la emisión |
| `js/outbreak/phone-sequence.js` | Celular 3D, notificación, llamada entrante y transición de cámara |
| `js/outbreak/incidents.js` | Choque, patrulla, agentes, fuego y humo dirigidos |
| `js/outbreak/population.js` | Detección, objetivos, ataques e incubación del contagio |
| `js/outbreak/zombie-model.js` | Modelos procedurales de zombis con instancias compartidas |
| `js/outbreak/sound.js` | Efectos de teléfono, noticias, alarma y gruñidos |
| `js/outbreak/locales.js` | Textos españoles e ingleses |
| `js/outbreak/view.js` | Menú, noticias, llamada, indicadores y minimapa |
| `js/outbreak/game.js` | Conexión entre la misión y el simulador |

La configuración geográfica está separada de las reglas. Esto prepara la integración de otro capítulo, pero no convierte el generador original de Manhattan en un generador universal de ciudades.

### Comprobaciones

Con Node.js 24:

```sh
node --test tests/*.test.*
```

La suite incluye progresión y final de misión, pausa, daño con tiempo de protección, agotamiento y recuperación, rutas alrededor de paredes y equivalencia de claves entre idiomas, contagio por contacto, incubación, transformación, propagación, refugio y bloqueo por paredes, además de las pruebas heredadas. El workflow de GitHub ejecuta la suite en pushes y pull requests.

El rendimiento gráfico depende del dispositivo. Las pruebas de lógica no sustituyen una prueba de juego en una GPU real. Las importaciones de Three.js heredadas apuntan a su rama `dev`; fijar una revisión y medir el rendimiento en equipos objetivo queda pendiente antes de publicar una versión estable.

## License and data

The project code is available under the [MIT License](LICENSE). Original city simulation: Copyright (c) 2026 Mr.doob. Preserve the original copyright and permission notices in distributions.

Geographic data: NYC Open Data and © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright) (ODbL). Third-party data and dependencies retain their respective licenses.
