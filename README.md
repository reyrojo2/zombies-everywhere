# Zombies Everywhere

Browser survival prototype built on [Slop New York](https://github.com/mrdoob/slop-newyork) by Mr.doob (Three.js, WebGPURenderer and TSL).

## Primera misión: Antes de que cierren

Un 2020 alternativo y ficticio. Mientras las noticias informan de una infección desconocida, sales a comprar y hablas por teléfono con tu esposa. Un incidente junto al **Centro Médico Hudson, ficticio**, convierte el paseo en una huida hacia un refugio temporal.

Los informativos, el origen de la infección y los acontecimientos son ficción; no representan hechos de la pandemia real de COVID-19.

### Ejecutar en PC o celular

Desde la carpeta del repositorio, con Python instalado:

```sh
python -m http.server 8000
```

En la PC abre **http://localhost:8000**. Para probar en el celular, conecta ambos equipos a la misma red y abre **http://IP-DE-TU-PC:8000** en el teléfono. También puedes abrir la versión web servida por HTTPS. El juego requiere aceleración gráfica y usa WebGPU cuando está disponible, con alternativa WebGL 2. No abras `index.html` directamente con `file://`. No hay instalación del juego, cuentas ni servidor de partidas. Hace falta conexión para descargar Three.js y otros recursos externos; el primer arranque puede tardar por la construcción de Manhattan y sus shaders.

1. Selecciona Español o English y pulsa **Comenzar historia**.
2. Mira el informativo en una sala 3D: el residente está frente a la TV, se levanta, abre la puerta y sale (48 s, con opción de saltar). Tres boletines contextualizan hospital, reportes en China y alerta local en West Village. Son ilustraciones animadas procedurales, no vídeo real.
3. Sales a comprar mascarillas. Los vecinos caminan por las veredas, esperan en la parada y reciben un reparto. Una van escolar está estacionada junto al recorrido. Un herido y el vecino que intenta ayudarlo protagonizan el primer contagio visible. La llamada de **Esposa** aparece a los cinco segundos. **F** o **Contestar** responde sin detener el movimiento; el celular baja en 1,5 s y la conversación sigue en segundo plano con subtítulos.
4. Recoge la mochila de emergencia en la farmacia. Sigue la ruta hacia la radio de la patrulla y mantén la interacción durante tres segundos.
5. La central te dirige a un punto vecinal. Allí lees una nota de tu esposa y descubres dos entradas al refugio. Elige por dónde continuar, sigue la ruta hasta el acceso peatonal, abre la puerta y crúzala a pie. La puerta se cierra detrás de ti.
6. El HUD muestra la fecha y la hora ficticia de Nueva York. Si te muerden, tienes seis minutos para refugiarte. Las vendas de la mochila recuperan algo de salud, pero el contagio sigue avanzando.

| Control | Acción |
| --- | --- |
| W / S o flechas arriba / abajo | Avanzar / retroceder |
| A / D o flechas izquierda / derecha | Girar al personaje |
| Shift | Correr; consume resistencia |
| Espacio | Saltar |
| Arrastrar ratón | Girar la cámara |
| F (mantener) | Recoger la mochila, transmitir por radio o leer el aviso |
| E | Entrar al automóvil marcado en azul claro o salir con el automóvil detenido |
| Q | Provocar un ruido delante de ti, con ocho segundos entre usos |
| Esc o botón Pausar | Pausar / continuar |

En el celular, arrastra el joystick para moverte y desliza sobre la calle para mover la cámara. Mantén **Correr** para acelerar a pie. **Contestar**, **Subir** y **Bajar** se activan con un toque. Mantén **Recoger**, **Radio**, **Leer** o **Abrir** hasta completar la barra. **Distraer** hace ruido delante de ti. El menú recomienda girar el celular. En horizontal el joystick queda a la izquierda, las acciones a la derecha y los subtítulos entre ambos. También puedes jugar en vertical.

La partida también se pausa al cambiar de pestaña o perder el foco. El idioma se guarda localmente si el navegador lo permite. La misión se reinicia al recargar; no hay guardado de progreso. La resistencia agotada debe recuperar un 25% antes de volver a correr.

### Alcance de esta entrega

- West Village, con calles reales irregulares y los perfiles de viviendas/bloques bajos del generador original. El contexto visual ya no parte del corredor de torres de Midtown. La arquitectura sigue siendo procedural, no una reproducción de cada fachada.
- Apartamento animado para la introducción; no es un interior explorable. Centro médico, farmacia y refugios son ubicaciones ficticias exteriores.
- Hasta 160 civiles en celular y 224 en PC, distribuidos sobre veredas transitables y concentrados alrededor del recorrido y las esquinas. Hasta 40 residentes cercanos en celular y 72 en PC ejecutan percepción y decisiones completas. Los demás conservan estado y se actualizan con menor frecuencia. Se reutilizan residentes sanos fuera de vista y se reduce la frecuencia de animación de los lejanos. Los contagiados conservan su aspecto y cambian de postura, tono de piel y heridas durante la transformación.
- El barrio comienza en calma. El primer herido transforma su cuerpo gradualmente y puede morder al vecino que se acerca a ayudarlo. Las alarmas y las amenazas visibles hacen huir a residentes por distintas salidas. Ver el ataque adelanta el brote local. A los 90 s se activa la alerta general aunque ignores la llamada o tomes otra calle. Las nuevas oleadas aparecen lejos y fuera de la vista del jugador.
- Cuatro choques dirigidos y seis incendios a los 48, 66, 86, 108, 132 y 158 s desde que sales a la calle. Sirenas y patrulla aparecen durante el trayecto. No hay cambio repentino de hora ni congelación del tráfico al declararse el brote. Los incidentes no simulan física completa ni propagación de fuego.
- Los infectados pierden visión y movilidad con el tiempo. Investigan ruidos y posiciones recordadas. Las paredes atenúan el sonido y bloquean la visión y las mordidas.
- Las huellas de acera usan la cobertura por lotes del proyecto original en manzanas irregulares. Usar el rectángulo exterior completo cerraba calles diagonales y dejaba sin sitios de aparición al tráfico.
- Carrocerías de misión con geometría detallada original y material estándar opaco, colores por pieza y doble cara, en ambos niveles de detalle. Sustituye el shader procedural de carrocería en la misión; el explorador lo conserva.
- Farmacia situada sobre la misma vereda que su acceso y orientada hacia una fachada cuando hay espacio. La persiana baja ante infectados cercanos. La navegación indica giros siguiendo las calles. La van escolar, el reparto, la banca, los basureros y las cajas comparten una malla de color para limitar el trabajo de dibujo. Los vehículos estacionados tienen colisión y el tráfico frena ante ellos y ante residentes en fuga. Distraer cerca de la van activa su alarma, que atrae infectados y asusta a vecinos.
- Noticias y llamada en texto, con música para los boletines, tono de teléfono, bocina y alarma posicionales. El audio se detiene al pausar.
- Se usan los gruñidos CC0 de artisticdude y la música **Beyond The Clouds** de Matthew Pablo, CC BY 3.0. Las atribuciones están en [assets/audio/CREDITS.md](assets/audio/CREDITS.md).
- Salud, resistencia, navegación, pausa, victoria, derrota y reinicio.
- Interfaz y narrativa en español e inglés. Los nombres propios permanecen.
- **Sin armas todavía**: este episodio prueba la huida. El arma, el regreso a casa y la búsqueda completa de tu esposa son la siguiente entrega.
- **Lima está anunciada, pero no es seleccionable todavía.** Tendrá un escenario y una disponibilidad de armas propios.
- La historia admite teclado y ratón en PC y controles táctiles en celular.

El perfil inicial de celular genera hasta 160 civiles, 36 autos y un bus. En PC son hasta 224 civiles, 64 autos y tres buses. Se añaden una van escolar y un vehículo de reparto estacionados. Los civiles pueden contagiarse. Los infectados navegan con obstáculos estáticos.

El explorador original sigue disponible con **http://localhost:8000/?mode=explore**. Conserva sus menús originales en inglés, vehículos y teletransportes. Estos accesos están deshabilitados en la misión.

### Rendimiento y calidad

El selector aplica el perfil en el momento y conserva el estado de la misión. Cada perfil fija un rango de resolución. Si el tiempo por fotograma sube de forma sostenida, el juego reduce la resolución y la distancia de dibujo. Las vuelve a subir por pasos cuando hay margen. También limita la cantidad de píxeles en pantallas grandes.

| Perfil | Escala inicial en celular / PC | Tope de escala en celular / PC |
| --- | --- | --- |
| Rendimiento | 50% / 60% | 70% / 75% |
| Equilibrado | 64% / 80% | 88% / 100% |
| Alta | 76% / 100% | 100% / 118% |

La historia usa renderizado directo con pavimento texturizado, marcas viales del mapa, sombras de contacto y neblina que aumenta durante el brote. En PC carga hasta 500 manzanas. En celular genera el sector de la misión y un margen de 180 m alrededor. La ruta del objetivo se calcula cuando cambia el destino y se reutiliza mientras te mueves.

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
| `js/outbreak/neighborhood.js` | Distribución en veredas, residentes del primer encuentro y reutilización fuera de vista |
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
