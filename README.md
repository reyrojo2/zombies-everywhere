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
2. Mira el informativo en una sala 3D: el residente está frente a la TV, se levanta, abre la puerta y sale (48 s, con opción de saltar). Tres boletines contextualizan hospital, reportes en China y alerta local en West Village. Son ilustraciones animadas procedurales, no vídeo real.
3. Al salir ya hay vecinos; algunos huyen antes de que se declare el brote. La llamada de **Esposa** aparece a los cinco segundos. **F** o **Contestar** responde sin detener el movimiento; el celular baja en 1,5 s y la conversación sigue en segundo plano con subtítulos.
4. El peligro progresa aunque no llegues al hospital ni contestes. Puedes tomar calles laterales. Busca la patrulla y mantén **F durante 3 s** junto a la radio; después elige entre dos refugios. Los infectados aparecen en rojo en el minimapa y los contagiados en ámbar.
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

- West Village, con calles reales irregulares y los perfiles de viviendas/bloques bajos del generador original. El contexto visual ya no parte del corredor de torres de Midtown. La arquitectura sigue siendo procedural, no una reproducción de cada fachada.
- Apartamento animado para la introducción; no es un interior explorable. Centro médico, farmacia y refugios son ubicaciones ficticias exteriores.
- 104 civiles en ocho áreas, con reacciones individuales, rutas de huida distintas, separación local y reutilización de residentes fuera de la proximidad del jugador. El dibujo de civiles se limita a 220 m. Hasta 12 infectados iniciales introducidos por etapas y 16 refuerzos posteriores; máximo 132 actores. El contagio convierte al mismo actor, sin crear entidades.
- Primeros huidos desde los 2 s. Semillas de infección a los 9, 18 y 30 s. El brote se declara cerca del hospital después de 22 s, o a los 42 s en cualquier lugar. No depende de completar la llamada ni de recorrer una recta obligatoria.
- Cuatro choques dirigidos y seis incendios: 10, 23, 38, 52, 68 y 85 s desde que sales a la calle. Sirenas, gritos y patrulla aparecen durante el trayecto. No hay cambio repentino de hora ni congelación del tráfico al declararse el brote. Los incidentes no simulan física completa ni propagación de fuego.
- Marcha de infectados a 2,55–2,71 m/s; persecución y contagio por contacto con obstáculos estáticos. Incubación 6 s y transformación 2 s.
- Las huellas de acera usan la cobertura por lotes del proyecto original en manzanas irregulares. Usar el rectángulo exterior completo cerraba calles diagonales y dejaba sin sitios de aparición al tráfico.
- Carrocerías de misión con geometría detallada original y material estándar opaco, colores por pieza y doble cara, en ambos niveles de detalle. Sustituye el shader procedural de carrocería en la misión; el explorador lo conserva.
- Noticias y llamada leídas con **SpeechSynthesis**, usando voces españolas/inglesas disponibles en el navegador/sistema. No hay doblaje humano grabado; sin voces compatibles se mantienen los subtítulos. Cambiar idioma selecciona la voz correspondiente; pausa, mute y reinicio cancelan la lectura. La calidad de voz depende del equipo.
- Tres grabaciones de gruñidos CC0 de artisticdude y gritos CC0 de WuxiaScrub. Cortina musical breve **Beyond The Clouds**, Matthew Pablo, CC BY 3.0: se usa en los cambios de boletín a volumen bajo, en lugar de un bucle continuo. Los archivos están incluidos localmente y sus licencias figuran en [assets/audio/CREDITS.md](assets/audio/CREDITS.md). Teléfono, sirenas e impactos sintetizados.
- Salud, resistencia, navegación, pausa, victoria, derrota y reinicio.
- Interfaz y narrativa en español e inglés. Los nombres propios permanecen.
- **Sin armas todavía**: este episodio prueba la huida. El arma, el regreso a casa y la búsqueda completa de tu esposa son la siguiente entrega.
- **Lima está anunciada, pero no es seleccionable todavía.** Tendrá un escenario y una disponibilidad de armas propios.
- Objetivo de soporte inicial: PC, teclado y ratón; no se ha implementado el modo de supervivencia para móvil o mando.

En la misión se sustituye la multitud ambiental original por los 104 civiles del barrio, todos susceptibles al contagio. El tráfico se reduce de 200 autos y 12 buses a 24 autos y 2 buses; se desactiva el tráfico de autopistas. El explorador conserva su población original. La navegación de infectados usa obstáculos estáticos y no simula interiores, escaleras ni evasión de vehículos en movimiento.

El explorador original sigue disponible con **http://localhost:8000/?mode=explore**. Conserva sus menús originales en inglés, vehículos y teletransportes. Estos accesos están deshabilitados en la misión.

### Rendimiento y calidad

El selector aplica la calidad en el momento: mantiene la misión, la salud, el contagio y el audio. No navega ni reconstruye la ciudad. Activar sombras puede producir una compilación inicial de shaders. El idioma se conserva.

| Perfil | Resolución interna | Sombras y posprocesado |
| --- | --- | --- |
| Rendimiento | 60% por eje | Sin sombras, reflejos SSR ni bloom |
| Equilibrado (predeterminado) | 80% por eje | Sin sombras, reflejos SSR ni bloom |
| Cinemático | 100% por eje | Sombras, reflejos SSR, bloom y tratamiento de color originales |

La misión selecciona exactamente las 500 manzanas más cercanas al centro del recorrido, con sus edificios originales. Restaura los monumentos dentro de ese entorno, centrados ahora en West Village. Las aceras son losas extruidas de 22 cm con textura de concreto, juntas y caras de bordillo; ya no se pinta de verde todo un bloque clasificado como parque. Las losas se agrupan por celdas de 200 m para reducir llamadas de dibujo.

Las 500 manzanas permanecen residentes; la cámara y el culling por frustum/celdas limitan lo que se dibuja. El detalle arquitectónico cercano sigue usando el quadtree del proyecto original. Alcance de cámara: 350 m en Rendimiento, 550 m en Equilibrado y 850 m en Cinemático. No es streaming infinito ni descarga dinámica de edificios. La generación inicial y la primera compilación de efectos pueden tardar, especialmente en Cinemático.

El selector mantiene la partida. Activar Cinemático puede compilar por primera vez sus sombras/reflejos. El mapa geográfico compartido y el grafo de tráfico siguen cargándose. El máximo de población es de 132 actores; el contagio reutiliza al civil. No se garantiza una tasa de FPS sin medir el equipo objetivo.

### Estructura

| Módulo | Responsabilidad |
| --- | --- |
| `js/outbreak/mission.js` | Reglas de progreso, salud, resistencia y configuración del capítulo |
| `js/outbreak/navigation.js` | Rejilla local de obstáculos y campo de rutas compartido |
| `js/outbreak/actors.js` | Movimiento y presentación de la población |
| `js/outbreak/sector.js` | Selección de 500 manzanas, aceras y agrupación espacial |
| `js/outbreak/tv-introduction.js` | Sala, televisor 3D y planos variables de la emisión |
| `js/outbreak/phone-sequence.js` | Celular 3D, llamada entrante y bajada del teléfono sin bloquear control |
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
