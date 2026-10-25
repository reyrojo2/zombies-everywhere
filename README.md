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
4. Cuando empieza el brote, sigue el marcador verde hasta el refugio. Los círculos rojos identifican infectados; los puntos azules del minimapa son civiles.
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
- Doce infectados con búsqueda de caminos por obstáculos estáticos y seis civiles de la escena que huyen.
- Salud, resistencia, navegación, pausa, victoria, derrota y reinicio.
- Interfaz y narrativa en español e inglés. Los nombres propios permanecen.
- **Sin armas todavía**: este episodio prueba la huida. El arma, el regreso a casa y la búsqueda completa de Elena son la siguiente entrega.
- **Lima está anunciada, pero no es seleccionable todavía.** Tendrá un escenario y una disponibilidad de armas propios.
- Objetivo de soporte inicial: PC, teclado y ratón; no se ha implementado el modo de supervivencia para móvil o mando.

El tráfico y los peatones ambientales proceden del simulador original. La reacción de huida pertenece a seis civiles de la misión, no a toda la población. La navegación de infectados usa obstáculos estáticos y no simula interiores, escaleras ni evasión de vehículos en movimiento.

El explorador original sigue disponible con **http://localhost:8000/?mode=explore**. Conserva sus menús originales en inglés, vehículos y teletransportes. Estos accesos están deshabilitados en la misión.

### Estructura

| Módulo | Responsabilidad |
| --- | --- |
| `js/outbreak/mission.js` | Reglas de progreso, salud, resistencia y configuración del capítulo |
| `js/outbreak/navigation.js` | Rejilla local de obstáculos y campo de rutas compartido |
| `js/outbreak/actors.js` | Infectados y civiles de la secuencia |
| `js/outbreak/locales.js` | Textos españoles e ingleses |
| `js/outbreak/view.js` | Menú, noticias, llamada, indicadores y minimapa |
| `js/outbreak/game.js` | Conexión entre la misión y el simulador |

La configuración geográfica está separada de las reglas. Esto prepara la integración de otro capítulo, pero no convierte el generador original de Manhattan en un generador universal de ciudades.

### Comprobaciones

Con Node.js 24:

```sh
node --test tests/*.test.*
```

La suite incluye progresión y final de misión, pausa, daño con tiempo de protección, agotamiento y recuperación, rutas alrededor de paredes y equivalencia de claves entre idiomas, además de las pruebas heredadas. El workflow de GitHub ejecuta la suite en pushes y pull requests.

El rendimiento gráfico depende del dispositivo. Las pruebas de lógica no sustituyen una prueba de juego en una GPU real. Las importaciones de Three.js heredadas apuntan a su rama `dev`; fijar una revisión y medir el rendimiento en equipos objetivo queda pendiente antes de publicar una versión estable.

## License and data

The project code is available under the [MIT License](LICENSE). Original city simulation: Copyright (c) 2026 Mr.doob. Preserve the original copyright and permission notices in distributions.

Geographic data: NYC Open Data and © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright) (ODbL). Third-party data and dependencies retain their respective licenses.
