# FaceVault — Contexto de producto

> Documento para el equipo de producto. Describe **qué hace** la solución, cómo se usa, sus reglas, resultados medidos y limitaciones. No cubre infraestructura ni despliegue.
> Estado: **prueba de concepto (PoC)**, versión 0.2.0 · Última actualización: octubre 2026.

---

## 1. Qué es

FaceVault es una solución de **reconocimiento facial** compuesta por:

- **Una API** que registra personas a partir de fotos de su cara, las identifica después y analiza atributos faciales.
- **Una web de demostración** (escritorio y celular) que usa la cámara del dispositivo para registrar, identificar y analizar.
- **Un backoffice** para administrar las personas registradas.

**Problema que resuelve:** saber *quién es* una persona (o confirmar que *es quien dice ser*) con solo mirar a una cámara, sin tarjetas, claves ni documentos.

**Dos operaciones base:**

| Operación | Pregunta que responde | Ejemplo de uso |
|---|---|---|
| **Identificar (1 a N)** | ¿Quién de todos los registrados es esta persona? | Control de acceso, fichaje de asistencia |
| **Verificar (1 a 1)** | ¿Estas dos fotos son de la misma persona? | Validar identidad contra la foto de un documento |

---

## 2. Usuarios

| Usuario | Qué hace | Dónde |
|---|---|---|
| **Persona final** | Se registra con su cara, se identifica, prueba el análisis | Web de demo |
| **Administrador / operador** | Consulta registros, ve fotos, borra registros | Backoffice (`/back`, con clave propia) |
| **Integrador** (sistema de un cliente) | Consume las mismas funciones vía API | API REST |

---

## 3. Funcionalidades

### 3.1 Registrar
1. La persona carga **nombre** (obligatorio) y **email** (opcional en la API; en la demo viene precargado con un email aleatorio para agilizar pruebas).
2. Se abre la cámara y la **captura es automática**: cuando hay una cara de frente, quieta y bien detectada durante ~2 segundos.
3. Antes de registrar, el sistema **busca si esa cara ya existe**:
   - Si existe → **no registra** y avisa: *"Ya estás registrado — esta cara ya corresponde a `email` — Similitud N%"*, con opción de ir a Identificar.
   - Si no existe → crea el registro y muestra el resultado.
4. **Mejorar el reconocimiento:** después de registrarse, la persona puede **agregar más fotos** (con lentes, con la cabeza girada, con otra luz). Hasta 10 por persona.
   - Una foto nueva solo se acepta si **se parece a las anteriores** de esa persona (evita que alguien agregue su cara a la identidad de otro).

### 3.2 Identificar
1. La persona mira la cámara; la captura es automática.
2. El sistema compara la cara contra **todas las fotos de todos los registrados** y usa, para cada persona, su foto más parecida.
3. Resultado:
   - **Coincidencia:** muestra el email de la persona y una barra de **similitud** (%).
   - **Sin coincidencia:** "No se encontró la persona en la base de datos".
4. Tiempo de respuesta medido: **~0,5–0,7 s**.

### 3.3 Analizar
- Desde la cámara o **subiendo una foto**.
- Para cada cara detectada (puede haber varias) estima: **edad**, **género** (con %), **emoción** (7 categorías) y **origen étnico** (6 categorías), con barras de probabilidad.
- Marca cada cara con un recuadro numerado sobre la foto.
- Si no hay ninguna cara, lo informa (no inventa resultados).
- **La foto no se guarda.**
- Muestra un aviso: son estimaciones automáticas que pueden equivocarse.
- Tiempo de respuesta medido: **~1,5 s**.

### 3.4 Backoffice (`/back`)
- Acceso con una **clave de administrador** distinta de la de la API; queda guardada solo en la pestaña del navegador.
- Accesible desde un botón **"Backoffice"** en el encabezado de la demo.
- **Listado** de personas registradas: foto, nombre, email, ID externo, modelo, cantidad de fotos, estado y fecha. 25 por página, ordenado del más nuevo al más viejo.
- **Búsqueda** por nombre, email o ID externo.
- **Detalle** de cada registro (tocando la fila): todos los datos y **todas sus fotos** (foto de registro y adicionales, con fecha).
- **Borrar registro** (con confirmación): elimina definitivamente la persona y todas sus fotos. Deja de ser reconocida y puede volver a registrarse con el mismo email.

### 3.5 Otros
- **Idiomas:** español e inglés (se detecta del navegador y se puede cambiar).
- **Diseño adaptable:** funciona en celular (navegación inferior, tarjetas) y escritorio (tabla, menú superior). Tema claro con modo oscuro automático.
- **Home:** muestra en vivo el modelo, detector y métrica configurados.
- **Errores de cámara claros:** permiso denegado, cámara no disponible o falla de inicio.

---

## 4. Reglas de negocio y parámetros

| Regla | Valor actual | Efecto |
|---|---|---|
| **Umbral de coincidencia** | Similitud ≥ **70%** (distancia ≤ 0,30) | Más bajo = reconoce más gente pero confunde más desconocidos |
| **Umbral para fotos adicionales** | Distancia ≤ **0,50** respecto de las fotos existentes de la persona | Permite variaciones (lentes, ángulo) pero rechaza otra cara |
| **Máximo de fotos por persona** | 10 (incluye la de registro) | |
| **Chequeo de duplicados al registrar** | Activado | Una cara ya registrada no puede registrarse de nuevo con otro email |
| **Email** | Único por registro | Un email solo puede estar una vez |
| **Captura automática** | Cara estable ~2 s, confianza ≥ 85%, de frente y quieta | Asegura fotos de calidad razonable |
| **Borrado** | Definitivo (persona + fotos + huella) | No hay papelera ni recuperación |
| **Análisis** | No se guarda la foto | |

Todos los umbrales son configurables sin cambiar código.

---

## 5. Resultados medidos

Pruebas con una base de **1000 personas** (fotos públicas del dataset LFW, registradas con nombres ficticios) y el modelo actual.

**Reconocimiento con una foto distinta a la registrada** (otro día, luz, ángulo):

| Escenario | Resultado |
|---|---|
| Persona registrada con **1 foto** | Reconocida en **~50%** de los casos (16/30); 1 confusión con otra persona |
| Persona registrada con **2 fotos** | Reconocida en **80%** (12/15, antes 7/15) |
| Persona **no registrada** | **0/30** identificadas por error |

**Lectura:** el sistema es **muy prudente** (casi nunca confunde a alguien) y la forma de mejorar el reconocimiento es **registrar varias fotos por persona**, no aflojar el umbral.

**Por qué no aflojar el umbral (base de 1000 personas):**

| Umbral de similitud | Personas que tienen un "parecido" en la base |
|---|---|
| 70% (actual) | 5,5% |
| 65% | 15% |
| 60% | 36% |
| 55% | 65% |

**Prueba real con lentes / de costado** (usuario registrado sin lentes): en todos los intentos la persona más parecida de las 1001 fue la correcta, pero con lentes o de costado quedó por debajo del 70%. Se resuelve agregando una foto con lentes.

**Velocidad:** identificar ~0,5–0,7 s · analizar ~1,5 s · registrar ~0,6 s.

---

## 6. Limitaciones conocidas

| Limitación | Impacto | Estado |
|---|---|---|
| **Sin detección de vida** | Mostrar una **foto o video** de otra persona a la cámara permite identificarse como ella | **Pendiente — es lo más crítico** para casos de identidad |
| **Edad poco confiable en extremos** | Ej.: niño de 8 años estimado en 19. El modelo fue entrenado mayormente con adultos | Limitación del modelo |
| **Emoción y origen étnico poco confiables** | Cambian con la luz o el ángulo de la misma persona | Solo apto como demostración |
| **Perfil completo** | No reconoce bien una cara de costado si solo tiene fotos de frente | Mitigable con fotos adicionales levemente giradas |
| **Fotos con varias caras** | Al registrar se usa la primera cara detectada, no necesariamente la principal | Pendiente (usar la más grande) |
| **Identificar muestra solo el email** | No muestra el nombre de la persona reconocida | Mejora de UX pendiente |
| **Formulario de registro precargado** | Nombre "John Doe" y email aleatorio por defecto (comodidad de la demo) | Quitar para un producto real |

---

## 7. Privacidad y datos

- Se guardan **datos biométricos** (fotos de la cara y su "huella" numérica) de cada persona registrada. En Argentina están protegidos por la **Ley 25.326** y criterios de la AAIP.
- **Pendiente para un producto real:** consentimiento explícito al registrarse, finalidad declarada, plazos de retención y borrado automático.
- El análisis de atributos **no guarda** la foto.
- El borrado desde el backoffice es **completo e irreversible**.
- **No recomendado como producto:** usar emoción u origen étnico para tomar decisiones sobre personas (contratación, evaluación, segmentación) ni identificar personas sin su consentimiento. Además de poco confiable, está restringido por regulaciones como el AI Act europeo.

---

## 8. Funciones disponibles por API (resumen)

| Función | Qué hace |
|---|---|
| Registrar persona | Crea un registro con nombre, email, ID externo y foto (rechaza caras ya registradas) |
| Agregar foto a una persona | Suma una foto adicional si se parece a las existentes |
| Identificar | Devuelve las personas que coinciden con una foto y su similitud |
| Verificar | Indica si dos fotos son de la misma persona *(sin pantalla en la demo)* |
| Analizar | Edad, género, emoción y origen étnico por cara |
| Detectar | Ubicación de las caras en una foto *(sin pantalla en la demo)* |
| Configuración activa | Modelo, detector y umbral en uso |
| Backoffice | Listar, buscar, ver detalle con fotos y borrar personas |

Todas requieren una clave de acceso; las del backoffice usan una clave separada.

---

## 9. Glosario

- **Huella facial (embedding):** lista de 512 números que resume los rasgos de una cara. Se compara entre huellas, no entre fotos.
- **Similitud:** qué tan parecidas son dos huellas (0–100%).
- **Umbral:** similitud mínima para considerar que son la misma persona.
- **Falso positivo:** identificar a alguien como otra persona. **Falso negativo:** no reconocer a alguien registrado.
- **1 a N / 1 a 1:** identificar entre todos los registrados / comparar dos fotos puntuales.
- **Detección de vida (liveness):** comprobar que frente a la cámara hay una persona real, no una foto, pantalla o máscara. *Pasiva:* analiza la imagen sin pedir nada. *Activa:* pide un gesto (parpadear, girar la cabeza).

---

## 10. Oportunidades y próximos pasos

**Casos de uso con mejor encaje** (base chica, uso recurrente, consentimiento natural):
- **Fichaje de asistencia** de empleados (evita que alguien fiche por otro).
- **Control de acceso** en gimnasios, coworkings, edificios y eventos.
- **Exámenes online**, verificación de conductores/repartidores.
- Con más requisitos: alta de clientes a distancia (KYC) en fintech, prueba de vida de jubilados, salud.

**Backlog candidato:**

| Prioridad | Iniciativa | Por qué |
|---|---|---|
| Alta | **Detección de vida** (pasiva + activa) | Cierra el fraude con fotos; requisito de cualquier caso de identidad |
| Alta | **Consentimiento y retención de datos** | Requisito legal para usarlo con personas reales |
| Media | **Producto de fichaje:** pantalla de fichaje + panel de horarios (entradas/salidas, turnos, tardanzas, exportación para sueldos) | Vertical con valor fácil de explicar |
| Media | Usar la cara más grande y **validar calidad** de la foto al registrar | Mejora precisión con poco esfuerzo |
| Media | Mostrar **nombre** en Identificar; pantalla de **Verificar 1 a 1** | UX / mostrar capacidades existentes |
| Media | Backoffice: borrar/agregar fotos sueltas, editar datos, **historial de intentos** y métricas | Operación y auditoría |
| Baja | Regla de margen entre la 1ª y 2ª coincidencia; evaluar otros modelos | Ajuste fino de precisión |

**Decisiones abiertas para producto:**
1. ¿Qué vertical priorizar (fichaje, acceso, KYC)?
2. ¿Qué tasa de reconocimiento y de error es aceptable para ese caso? (define el umbral y cuántas fotos pedir al registrar)
3. ¿Se mantiene el módulo de Analizar como parte del producto o solo como demostración?
4. ¿Política de datos: cuánto tiempo se guardan las fotos y quién puede verlas?

---

## 11. Historial (v0.1.0 → v0.2.0)

- Nueva interfaz clara y simple (antes estética "futurista").
- Backoffice: listado, búsqueda, detalle con fotos y borrado.
- Pantalla **Analizar** (cámara o foto subida).
- **Varias fotos por persona** para mejorar el reconocimiento.
- **Chequeo de duplicados** al registrar.
- Modelo de reconocimiento **Facenet512** y detector **RetinaFace** (más precisos), con respuesta en menos de 1 s.
- Umbral de coincidencia configurable y medido con 1000 identidades.
- Base de prueba con 1000 caras públicas con nombres ficticios.
- Corrección: la cámara no iniciaba por una actualización de una librería externa.
