# Zombies Everywhere

Browser survival prototype built on [Slop New York](https://github.com/mrdoob/slop-newyork) by Mr.doob (Three.js, WebGPURenderer and TSL).

## Primera misión: Antes del silencio

Un 2020 alternativo y ficticio. Mientras las noticias informan de una infección desconocida, sales a comprar y hablas por teléfono con Elena, tu esposa. Un incidente junto al **Centro Médico Hudson, ficticio**, convierte el paseo en una huida hacia un refugio temporal.

Los informativos, el origen de la infección y los acontecimientos son ficción; no representan hechos de la pandemia real de COVID-19.

### Ejecutar en tu PC

Desde la carpeta del repositorio, con Python instalado:

```sh
python -m http.server 8000
```

Abre **http://localhost:8000** en un navegador de escritorio con aceleración gráfica. No abras `index.html` directamente con `file://`. No hay instalación del juego, cuentas ni servidor de partidas. Hace falta conexión para descargar Three.js y otros recursos externos; el primer arranque puede tardar por la construcción de Manhattan y sus shaders.

1. Selecciona Español o English y pulsa **Comenzar historia**.
2. Lee las tres emisiones de noticias (42 segundos), o pulsa **Salir a la calle**.
3. Sigue el marcador ámbar hacia el centro médico y escucha la llamada.
4. Cuando empieza el brote, sigue el marcador verde hasta el refugio. Los personajes de piel gris verdosa y ropa oscura son zombis; en el minimapa aparecen en rojo, los civiles en azul y las personas contagiadas en ámbar.
5. Si pierdes toda la salud, puedes reiniciar. Llegar al refugio termina esta primera misión.

| Control | Acción |
| --- | --- |
| W / S o flechas arriba / abajo | Avanzar / retroceder |
| A / D o flechas izquierda / derecha | Girar al personaje |
| Shift | Correr; consume resistencia |
| Espacio | Saltar |
| Arrastrar ratón | Girar la cámara |
| Esc o botón Pausar | Pausar / continuar |

La partida también se pausa al cambiar de pestaña o perder el foco. El idioma se guarda localmente si el navegador lo permite. La misión se reinicia al recargar; no hay guardado de progreso. La resistencia agotada debe recuperar un 25% antes de volver a correr.

### Alcance de esta entrega

- Manhattan, sector delimitado; noticias y llamada mediante texto, sin doblaje.
- Centro médico y refugio señalizados en el exterior; no hay interiores de hospital o apartamento.
- Doce zombis iniciales con marcha rápida (2,15–2,31 m/s), sin carrera y 40 peatones de misión. Los peatones cercanos detectan amenazas visibles, huyen e intentan alcanzar el refugio. Los zombis pueden atacar al jugador o a un civil visible más cercano.
- Un ataque a corta distancia contagia al peatón: 6 segundos herido, 2 segundos de transformación y después se convierte en un zombi. El proceso está identificado por el color ámbar en el minimapa y un contador de contagios. Las paredes bloquean el contacto; los refugiados están a salvo. El total de actores nunca aumenta por el contagio. Hay hasta cuatro entradas adicionales de cuatro zombis por las calles 44 a 47, con separación mínima de 22 metros respecto al jugador y un máximo de 68 actores contando los refuerzos.
- Apariencia de zombi propia con piel gris verdosa, ropa oscura, heridas, inclinación corporal, brazos adelantados y paso lento. Modelos procedurales sencillos dibujados mediante instancias compartidas.
- El brote activa la huida de todos los civiles de misión, un choque dirigido entre dos autos, la llegada de una patrulla con dos agentes, tres focos de incendio y humo y una transición al anochecer. Estos incidentes usan el reloj de misión y se congelan durante la pausa; no son una simulación física completa de accidentes o propagación de fuego. Acercarse a los focos de incendio causa daño.
- Efectos sintetizados: entrada de noticias, teléfono, desconexión, alarma del hospital, sirenas repetidas, impacto y gruñidos espaciales de zombis cercanos con ruido y frecuencias medias audibles en altavoces pequeños. Sin archivos de audio externos ni doblaje. Los efectos comparten mute y volumen con el audio urbano; se detienen al pausar o reiniciar.
- Salud, resistencia, navegación, pausa, victoria, derrota y reinicio.
- Interfaz y narrativa en español e inglés. Los nombres propios permanecen.
- **Sin armas todavía**: este episodio prueba la huida. El arma, el regreso a casa y la búsqueda completa de Elena son la siguiente entrega.
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
| Cinemático | 100% por eje | Sombras; la misión mantiene desactivados SSR y bloom |

La misión construye suelo, aceras y edificios únicamente para los bloques reales que intersectan el sector y un margen visual de 100 metros. No genera los distritos lejanos, los monumentos del mapa completo, sus autopistas o sus detalles de calle. El explorador original conserva la ciudad completa y sus efectos. Los datos geográficos compartidos y el grafo de tráfico original siguen cargándose; esta entrega no incorpora streaming de nuevos sectores.

La cámara alcanza 700 metros en los perfiles ligeros y 1000 metros en el cinemático. La población tiene un máximo de 68 actores; el contagio reutiliza al civil. No se garantiza una tasa de FPS sin medir el equipo objetivo.

### Estructura

| Módulo | Responsabilidad |
| --- | --- |
| `js/outbreak/mission.js` | Reglas de progreso, salud, resistencia y configuración del capítulo |
| `js/outbreak/navigation.js` | Rejilla local de obstáculos y campo de rutas compartido |
| `js/outbreak/actors.js` | Movimiento y presentación de la población |
| `js/outbreak/sector.js` | Suelo y aceras del sector; filtro geográfico de bloques |
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
