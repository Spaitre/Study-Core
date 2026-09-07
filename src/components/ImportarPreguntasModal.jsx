import { useState } from 'react'
import { analizarArchivo, analizarTexto, confirmarImportacion } from '../api.js'

const FORMATOS = '.pdf,.docx,.txt'
const LETRAS = ['A', 'B', 'C', 'D', 'E', 'F']

// Valores cerrados de Tema/Dificultad (select, no datalist: el datalist
// nativo se posiciona mal dentro de este modal con scroll propio).
const TEMAS_CASO = ['Epidemiología', 'Etiología', 'Fisiopatología', 'Cuadro clínico', 'Tratamiento']
const DIFICULTADES_CASO = ['Fácil', 'Medio', 'Difícil']

// Opciones de un <select>: la lista fija + el valor actual si no coincide con
// ninguna (para no perder ni disfrazar datos ya guardados con otra grafía).
function opcionesSelect(valorActual, lista, etiquetaVacia) {
  const extra = valorActual && !lista.includes(valorActual) ? [valorActual] : []
  return (
    <>
      <option value="">{etiquetaVacia}</option>
      {[...lista, ...extra].map((v) => (
        <option key={v} value={v}>
          {v}
        </option>
      ))}
    </>
  )
}

// Prompts listos para copiar y pedirle a una IA que genere las preguntas/
// flashcards en el formato exacto que esta app sabe importar.
const PROMPTS = {
  caso: {
    etiqueta: 'Caso clínico',
    texto: `Quiero que conviertas los apuntes o textos que te proporcionaré en preguntas de opción múltiple de alta calidad, orientadas a evaluar conocimientos médicos mediante razonamiento, comprensión, aplicación clínica y preparación para exámenes de medicina.
Las preguntas deben parecerse a preguntas reales de un examen médico y NO a preguntas generadas mecánicamente por una IA.
1. FUENTE DE INFORMACIÓN
Utiliza como fuente principal EXCLUSIVAMENTE los apuntes o textos que te proporcionaré.

* No inventes información.
* No agregues información externa que no sea necesaria para comprender el material.
* No contradigas deliberadamente mis apuntes.
* Si un tema no aparece en el material proporcionado, no generes preguntas sobre él.
* Si la información es insuficiente para construir una pregunta válida, omítela.
* Conserva los datos específicos de los apuntes, especialmente cifras, porcentajes, nombres de medicamentos, dosis, microorganismos, autoanticuerpos, receptores, citocinas, hallazgos histológicos y criterios diagnósticos.

El objetivo es transformar MIS apuntes en material de estudio, no escribir un tratado médico nuevo.
2. OBJETIVO DE LAS PREGUNTAS
Genera preguntas que evalúen:

* Comprensión.
* Memorización de conceptos importantes.
* Fisiopatología.
* Razonamiento clínico.
* Diagnóstico.
* Diagnóstico diferencial.
* Interpretación de hallazgos.
* Histopatología.
* Tratamiento.
* Farmacología.
* Pronóstico.
* Datos característicos.
* Perlas de examen.
* Aplicación de conocimientos.

Prioriza preguntas que requieran pensar y relacionar conceptos, no únicamente recordar una definición.
Cuando sea posible, transforma información memorística en preguntas que requieran aplicar el conocimiento a una situación clínica.
3. CASOS CLÍNICOS
Cuando el contenido lo permita, utiliza casos clínicos como base de las preguntas.
El caso puede incluir:

* Edad.
* Sexo.
* Motivo de consulta.
* Tiempo de evolución.
* Antecedentes relevantes.
* Factores de riesgo.
* Síntomas.
* Signos.
* Exploración física.
* Localización y características de lesiones.
* Estudios de laboratorio.
* Estudios de imagen.
* Histología.
* Resultados de pruebas diagnósticas.
* Evolución clínica.

No agregues datos innecesarios únicamente para hacer el caso más largo.
Cada dato incluido debe tener una función.
Evita casos tan obvios que revelen inmediatamente la respuesta.
Cuando sea posible, construye el razonamiento:
datos clínicos → interpretación → diagnóstico/mecanismo/tratamiento.
4. EVITAR PREGUNTAS DEMASIADO FÁCILES
NO generes preguntas donde la respuesta pueda obtenerse simplemente identificando una palabra idéntica entre el caso y la opción.
Ejemplo que debes evitar:
"El paciente tiene acantólisis. ¿Cuál es el diagnóstico?"
A) Psoriasis
B) Pénfigo vulgar
C) Dermatitis atópica
D) Melanoma
Esto es demasiado evidente.
En su lugar, utiliza información clínica, fisiopatológica, histológica o diagnóstica que obligue a integrar datos.
5. CALIDAD DE LOS DISTRACTORES
Los distractores deben ser plausibles.
Cada opción incorrecta debe representar un error razonable que podría cometer un estudiante.
Utiliza distractores basados en:

* Enfermedades similares.
* Medicamentos alternativos.
* Mecanismos relacionados.
* Diagnósticos diferenciales.
* Hallazgos de enfermedades parecidas.
* Tratamientos utilizados para otras patologías.
* Errores conceptuales frecuentes.

NO utilices opciones absurdas o claramente irrelevantes.
Las cuatro opciones deben parecer inicialmente posibles.
6. HOMOGENEIDAD DE LAS OPCIONES
Las cuatro opciones deben pertenecer a la misma categoría.
Si pregunto por un diagnóstico:
→ Todas las opciones deben ser diagnósticos.
Si pregunto por un medicamento:
→ Todas deben ser medicamentos.
Si pregunto por un mecanismo:
→ Todas deben ser mecanismos.
Si pregunto por un hallazgo histológico:
→ Todas deben ser hallazgos histológicos.
No mezcles categorías dentro de una misma pregunta.
7. EVITAR PATRONES VISUALES
Es MUY IMPORTANTE que el estudiante no pueda identificar la respuesta correcta simplemente viendo las opciones.
Por lo tanto:

* Las opciones deben tener una longitud relativamente similar.
* No hagas que la respuesta correcta sea sistemáticamente la más larga.
* No hagas que la respuesta correcta sea sistemáticamente la más específica.
* No hagas que la respuesta correcta contenga más detalles que las demás.
* No utilices palabras innecesariamente técnicas únicamente en la respuesta correcta.
* No hagas que la respuesta correcta sea la única opción gramaticalmente perfecta.
* No hagas que tres opciones sean claramente similares y una completamente diferente.
* Mantén una estructura gramatical paralela entre las cuatro opciones.
* Evita cualquier característica visual que permita identificar la respuesta sin conocer el contenido.

Las cuatro opciones deben verse razonablemente similares a primera vista.
8. EVITAR PATRONES LINGÜÍSTICOS
No utilices características que revelen la respuesta correcta.
Evita que la respuesta correcta sea sistemáticamente la única que:

* Contiene "siempre".
* Contiene "nunca".
* Utiliza términos absolutos.
* Tiene una explicación causal mientras las otras no.
* Contiene más tecnicismos.
* Tiene mayor precisión.
* Es la única opción positiva o negativa.
* Es la única opción que responde exactamente al género o número de la pregunta.
* Utiliza palabras que aparecieron literalmente en el caso cuando las demás no.

Las cuatro opciones deben tener una construcción lingüística comparable.
9. ALEATORIZACIÓN DE LA RESPUESTA CORRECTA
La posición de la respuesta correcta debe ser impredecible.
Utiliza A, B, C y D de manera pseudoaleatoria.
NO intentes equilibrar deliberadamente la cantidad de respuestas correctas entre A, B, C y D.
NO fuerces una distribución de 25% para cada inciso.
NO sigas secuencias repetitivas o predecibles.
Evita patrones como:

* A, B, C, D, A, B, C, D.
* A, A, B, B, C, C, D, D.
* B, B, B, C, C, C.
* C, A, C, A, C, A.

Puede haber varias respuestas correctas consecutivas en el mismo inciso si la aleatorización lo determina.
Lo importante es que no exista un patrón deliberado que permita predecir la respuesta.
La posición de la respuesta correcta debe decidirse de manera independiente para cada pregunta.
No modifiques una respuesta médicamente correcta únicamente para conseguir equilibrio entre los incisos.
No muestres ni calcules la distribución de respuestas correctas al finalizar.
10. VARIEDAD EN LA ESTRUCTURA
No generes todas las preguntas utilizando exactamente la misma plantilla.
Alterna entre:
Diagnóstico
"¿Cuál es el diagnóstico más probable?"
Mecanismo
"¿Cuál de los siguientes mecanismos explica mejor este hallazgo?"
Tratamiento
"¿Cuál es la conducta terapéutica más adecuada?"
Farmacología
"¿Cuál es el mecanismo de acción del tratamiento utilizado?"
Histología
"¿Cuál de los siguientes hallazgos se espera encontrar?"
Diferencial
"¿Cuál de los siguientes datos permitiría diferenciar X de Y?"
Fisiopatología
"¿Cuál de los siguientes procesos explica mejor la manifestación?"
Integración
"Considerando los hallazgos clínicos y de laboratorio, ¿cuál es la explicación más probable?"
Varía la redacción para evitar que las preguntas parezcan generadas a partir de una plantilla.
11. NIVEL DE DIFICULTAD
Cada pregunta debe clasificarse como:
Fácil
Requiere recordar un dato fundamental y directo.
Medio
Requiere relacionar dos o más conceptos o interpretar información clínica.
Difícil
Requiere razonamiento clínico, integración de múltiples datos, diferenciación entre enfermedades similares o aplicación profunda de la fisiopatología.
La dificultad debe depender del razonamiento necesario para llegar a la respuesta, no simplemente de que el contenido sea poco común.
Como orientación general:

* 20% Fácil.
* 50% Medio.
* 30% Difícil.

No es necesario que la distribución sea matemáticamente exacta.
12. PREGUNTAS DE RAZONAMIENTO
Cuando el contenido lo permita, utiliza la estructura:
Hallazgos → interpretación → diagnóstico/mecanismo/manejo.
Por ejemplo, en lugar de:
"¿Qué anticuerpo está asociado con X?"
puedes crear:
"Un paciente presenta ampollas flácidas y erosiones mucosas. La biopsia muestra una ampolla intraepidérmica y la inmunofluorescencia evidencia un patrón determinado. ¿Cuál de los siguientes autoantígenos explica mejor estos hallazgos?"
Esto obliga a integrar clínica + histología + inmunología.
13. PREGUNTAS DE "¿POR QUÉ?"
Cuando los apuntes proporcionen una relación causal importante, genera preguntas que evalúen el razonamiento.
Ejemplo:
"¿Cuál de los siguientes mecanismos explica mejor la aparición de X en esta enfermedad?"
La respuesta debe depender de comprender la fisiopatología y no únicamente de memorizar una asociación.
14. DIAGNÓSTICOS DIFERENCIALES
Cuando existan enfermedades similares, crea preguntas donde sea necesario distinguirlas.
Incluye, cuando la información esté disponible:

* Diferencias clínicas.
* Diferencias histológicas.
* Diferencias inmunológicas.
* Diferencias etiológicas.
* Diferencias en tratamiento.
* Diferencias en evolución.

Los distractores deben ser enfermedades que realmente puedan confundirse con el diagnóstico correcto.
15. TRATAMIENTO
Cuando preguntes sobre tratamiento, evita que la respuesta sea obvia porque las demás opciones sean medicamentos completamente irrelevantes.
Las opciones deben representar tratamientos que podrían considerarse razonables para la enfermedad o para diagnósticos diferenciales.
Cuando exista información suficiente, crea preguntas como:

* ¿Cuál es el tratamiento inicial más apropiado?
* ¿Cuál sería el siguiente paso en el manejo?
* ¿Qué tratamiento actúa directamente sobre el mecanismo fisiopatológico involucrado?
* ¿Cuál es el tratamiento indicado ante enfermedad grave?

Cuando los apuntes proporcionen información sobre:

* Mecanismo de acción.
* Efectos adversos.
* Contraindicaciones.
* Interacciones.
* Tratamiento de primera línea.
* Tratamiento de segunda línea.

utiliza esa información para crear preguntas relevantes.
16. TRAMPAS DE EXAMEN
Identifica conceptos que fácilmente puedan confundirse.
Crea preguntas donde las opciones incorrectas representen errores frecuentes.
Ejemplos:

* Confundir dos autoanticuerpos.
* Confundir dos enfermedades similares.
* Confundir tratamiento inicial con tratamiento de rescate.
* Confundir un hallazgo histológico con otro.
* Confundir mecanismos de acción de medicamentos.
* Confundir manifestaciones según edad o localización.
* Confundir una característica típica con una característica de otra enfermedad.

La pregunta debe evaluar específicamente esa diferencia.
17. INFORMACIÓN EN LAS OPCIONES
No introduzcas información nueva en las opciones que no esté respaldada por los apuntes.
Las opciones deben poder evaluarse con la información proporcionada o con conocimientos directamente necesarios para interpretar los apuntes.
No conviertas las opciones en mini-explicaciones.
18. EXPLICACIÓN
La explicación debe:

1. Explicar por qué el inciso correcto es correcto.
2. Explicar brevemente por qué los demás incisos son incorrectos.
3. Reforzar el concepto médico evaluado.
4. Relacionar, cuando sea relevante, los hallazgos del caso con la respuesta.

No hagas explicaciones innecesariamente largas.
No te limites a decir:
"Esta es correcta porque es la respuesta correcta."
La explicación debe tener valor educativo.
19. CONTROL DE CALIDAD
Antes de entregar las preguntas, realiza una revisión interna.
Para cada pregunta verifica:

1. ¿Existe una sola respuesta claramente correcta?
2. ¿Las otras tres opciones son realmente incorrectas?
3. ¿Los distractores son plausibles?
4. ¿Todas las opciones pertenecen a la misma categoría?
5. ¿La respuesta correcta tiene una longitud similar a las demás?
6. ¿La respuesta correcta destaca por alguna característica visual?
7. ¿La pregunta puede resolverse por una palabra clave demasiado obvia?
8. ¿Existe algún patrón predecible en la posición de las respuestas?
9. ¿La pregunta evalúa conocimiento real y no interpretación de la redacción?
10. ¿La información está respaldada por mis apuntes?
11. ¿La pregunta tiene el nivel de dificultad indicado?
12. ¿La explicación de la respuesta es correcta?
13. ¿La pregunta aporta algo nuevo y no es redundante?

Si una pregunta falla alguno de estos criterios, reescríbela antes de entregarla.
20. REGLA CONTRA EL "PATRÓN DE IA"
Quiero que las preguntas parezcan creadas por un profesor de medicina y no por una IA que sigue una plantilla.
Por lo tanto:

* Varía la longitud de los casos.
* Varía la estructura de las preguntas.
* Varía la posición de la respuesta correcta.
* Varía la forma de los distractores.
* Evita repetir frases idénticas.
* Evita que todas las preguntas tengan el mismo ritmo.
* Evita que todas las respuestas correctas tengan el mismo estilo.
* No hagas que siempre la opción C sea la más detallada.
* No hagas que la respuesta correcta sea sistemáticamente la más "médicamente sofisticada".
* No hagas que la respuesta correcta sea sistemáticamente la más larga.
* No hagas que la respuesta correcta sea sistemáticamente la más específica.

La posición de cada respuesta correcta debe ser impredecible y no deliberadamente equilibrada.
21. FORMATO OBLIGATORIO DE CADA PREGUNTA
Todas las preguntas deben seguir exactamente el mismo formato y orden.
No agregues campos adicionales.
Cada pregunta debe contener únicamente:

1. Caso
2. Incisos
3. Respuesta correcta
4. Explicación
5. Materia
6. Tema
7. Dificultad

Utiliza exactamente esta estructura:
Pregunta 1
Caso:
[Presenta el caso clínico o situación clínica necesaria para responder la pregunta.]
Incisos:
A) [Opción A]
B) [Opción B]
C) [Opción C]
D) [Opción D]
Respuesta correcta: [Letra y texto de la respuesta correcta]
Explicación:
[Explicación de la respuesta correcta y de los distractores.]
Materia: [Materia]
Tema: [Tema]
Dificultad: [Dificultad]
22. MATERIA
El campo Materia debe identificar la especialidad o área médica principal de la pregunta.
Ejemplos:

* Cardiología
* Nefrología
* Dermatología
* Microbiología
* Infectología
* Neumología
* Gastroenterología
* Endocrinología
* Hematología
* Neurología
* Reumatología
* Inmunología
* Farmacología
* Patología
* Pediatría
* Ginecología
* Obstetricia
* Urología
* Otorrinolaringología
* Oftalmología
* Cirugía
* Psiquiatría

Si una pregunta puede relacionarse con varias materias, selecciona la materia principal que mejor represente el conocimiento evaluado.
No escribas múltiples materias.
23. TEMA
El campo Tema debe utilizar EXCLUSIVAMENTE uno de estos cinco valores:

* Epidemiología
* Etiología
* Fisiopatología
* Cuadro clínico
* Tratamiento

No utilices otros valores.
No escribas como tema:

* Diagnóstico.
* Histología.
* Farmacología.
* Pronóstico.
* Diagnóstico diferencial.
* Perlas.
* Datos característicos.

Si una pregunta evalúa alguno de estos conceptos, asígnala al tema de los cinco disponibles que mejor represente el conocimiento principal necesario para responderla.
Ejemplos:

* Identificación de un hallazgo clínico → Cuadro clínico
* Identificación de un mecanismo → Fisiopatología
* Identificación del agente causal → Etiología
* Selección de una terapia → Tratamiento
* Identificación de un grupo de riesgo → Epidemiología

24. DIFICULTAD
El campo Dificultad debe utilizar EXCLUSIVAMENTE uno de estos tres valores:

* Fácil
* Medio
* Difícil

No utilices "Básica", "Intermedia", "Avanzada" ni ninguna otra variante.
25. CANTIDAD
Genera la cantidad de preguntas que te indique.
Si no especifico una cantidad, genera suficientes preguntas para cubrir adecuadamente los conceptos importantes sin crear preguntas redundantes.
No sacrifiques calidad para aumentar el número de preguntas.
26. REGLA ABSOLUTA DE SALIDA
Quiero ÚNICAMENTE las preguntas siguiendo el formato establecido.
NO agregues al inicio:

* Introducciones.
* Comentarios.
* Explicaciones sobre lo que vas a hacer.
* Resúmenes de los apuntes.

NO agregues al final:

* Tablas.
* Estadísticas.
* Distribución de respuestas A/B/C/D.
* Porcentajes de respuestas correctas.
* Conteo de incisos.
* Análisis de patrones.
* Resúmenes.
* Conclusiones.
* Recomendaciones de estudio.
* Comentarios sobre la generación de las preguntas.
* Secciones adicionales.

Después de la última pregunta, termina la respuesta inmediatamente.
No muestres ningún análisis sobre cómo distribuiste los incisos.
No muestres ningún análisis interno de calidad.
No muestres el proceso de razonamiento utilizado para construir las preguntas.
La salida debe contener exclusivamente las preguntas en el formato solicitado.
REGLA FINAL
Mi objetivo no es memorizar la posición de una respuesta ni reconocer patrones.
Quiero que la única manera confiable de contestar correctamente sea conocer y comprender el contenido médico.
La dificultad debe venir del conocimiento y el razonamiento, NO de preguntas ambiguas, redacción confusa, datos irrelevantes o distractores injustos.
Las preguntas deben parecerse a un examen médico bien diseñado.
Utiliza mis apuntes como fuente principal, crea preguntas clínicamente útiles, utiliza distractores plausibles, evita patrones reconocibles y mantén estrictamente el formato establecido.
Ahora espera el texto o los apuntes que te proporcionaré y genera las preguntas siguiendo todas estas instrucciones.`,
  },
  flashcard: {
    etiqueta: 'Flashcards',
    texto: `Quiero que conviertas los apuntes o textos que te proporcionaré en flashcards médicas de alta calidad, diseñadas para active recall, repetición espaciada y preparación para exámenes de medicina.
El texto proporcionado puede contener una o varias patologías y puede estar organizado de manera desordenada, incompleta o con diferentes niveles de profundidad.
Tu tarea es identificar la información relevante, organizarla mentalmente y convertirla en flashcards claras, precisas y clínicamente útiles.
1. FUENTE DE INFORMACIÓN
Utiliza como fuente principal EXCLUSIVAMENTE los apuntes o textos que te proporcionaré.

* No inventes información.
* No agregues información externa.
* No supongas que algo es cierto si no aparece en el texto.
* Si una información está incompleta, no la completes con conocimiento externo.
* Si los apuntes contienen información contradictoria, conserva la información proporcionada.
* Conserva los datos específicos de los apuntes, especialmente cifras, porcentajes, nombres de medicamentos, dosis, microorganismos, autoanticuerpos, receptores, citocinas, hallazgos histológicos y criterios diagnósticos.

El objetivo es transformar MIS apuntes en material de estudio, no escribir un tratado médico nuevo.
2. OBJETIVO
Genera flashcards que permitan aprender y recordar las patologías de mis apuntes mediante recuperación activa.
Prioriza:

* Fisiopatología.
* Etiología.
* Epidemiología.
* Cuadro clínico.
* Histología.
* Diagnóstico.
* Diagnósticos diferenciales.
* Tratamiento.
* Farmacología.
* Pronóstico.
* Datos característicos.
* Relaciones causa-efecto.
* Conceptos de alto rendimiento para exámenes.

No conviertas simplemente los apuntes en un resumen.
Cada flashcard debe obligar al estudiante a recordar activamente la información.
3. ESTRUCTURA DE INFORMACIÓN A CUBRIR
Para cada patología, identifica la información disponible de:

1. Definición
2. Epidemiología
3. Etiología
4. Fisiopatología
5. Histología
6. Cuadro clínico
7. Diagnóstico
8. Diagnósticos diferenciales
9. Manejo y tratamiento
10. Pronóstico
11. Datos característicos
12. Perlas de examen
13. Trampas de examen

No es obligatorio que una patología tenga todos los apartados.
Si un apartado no aparece en los apuntes, simplemente ignóralo.
No generes una flashcard diciendo que la información no está disponible.
4. ACTIVE RECALL
Las flashcards deben estar diseñadas para recuperación activa, no para reconocimiento.
Prioriza preguntas como:

* ¿Qué es...?
* ¿Cuál es...?
* ¿Qué mecanismo explica...?
* ¿Por qué ocurre...?
* ¿Cómo produce X la manifestación Y?
* ¿Qué estructura está afectada?
* ¿Qué anticuerpo está involucrado?
* ¿Qué hallazgo caracteriza...?
* ¿Cómo se diferencia X de Y?
* ¿Cuál es el tratamiento de primera línea?
* ¿Cuál es el mecanismo de acción de...?
* ¿Qué complicación puede aparecer?
* ¿Qué dato permite reconocer...?

Evita preguntas cuya respuesta sea obvia por la forma en que está redactado el anverso.
5. UNA IDEA PRINCIPAL POR FLASHCARD
Cada flashcard debe evaluar principalmente un concepto.
No generes tarjetas excesivamente amplias como:
"¿Cuál es la fisiopatología, clínica, diagnóstico y tratamiento del pénfigo vulgar?"
Divide la información en varias tarjetas.
Una buena flashcard debe poder responderse rápidamente y tener una respuesta relativamente concisa.
6. FISIOPATOLOGÍA
Esta es una de las secciones más importantes.
Cuando exista una explicación fisiopatológica compleja, descompónla en una cadena causal.
Organiza mentalmente:
Causa → mecanismo inicial → molécula/célula implicada → alteración estructural o funcional → lesión → manifestación clínica.
Crea flashcards para los pasos importantes.
Ejemplo:
En lugar de:
Anverso: ¿Cuál es la fisiopatología del pénfigo vulgar?
Crear varias tarjetas:
Anverso: ¿Contra qué proteínas se dirigen los autoanticuerpos del pénfigo vulgar?
Anverso: ¿Qué función tienen las desmogleínas?
Anverso: ¿Cómo la alteración de las desmogleínas produce acantólisis?
Anverso: ¿Qué tipo de ampolla produce el pénfigo vulgar?
Anverso: ¿Cómo explica la fisiopatología del pénfigo vulgar la presencia de erosiones mucosas?
El objetivo es que el estudiante pueda reconstruir el mecanismo completo a partir de las tarjetas.
7. HISTOLOGÍA
Cuando los apuntes contengan información histológica, genera flashcards sobre:

* Capa afectada.
* Tejido afectado.
* Localización de la lesión.
* Tipo de lesión.
* Cambios celulares.
* Cambios arquitectónicos.
* Células predominantes.
* Alteraciones epidérmicas.
* Alteraciones dérmicas.
* Depósitos.
* Inmunofluorescencia.
* Biopsia.
* Hallazgos microscópicos característicos.

Cuando exista una relación entre fisiopatología e histología, genera flashcards que conecten ambos conceptos.
Ejemplo:
Anverso: ¿Por qué se observa acantólisis en el pénfigo vulgar?
Esto es preferible a simplemente preguntar:
Anverso: ¿Qué hallazgo histológico presenta el pénfigo vulgar?
8. CUADRO CLÍNICO
Genera flashcards sobre:

* Síntomas.
* Signos.
* Lesiones.
* Morfología.
* Distribución.
* Localización.
* Simetría.
* Evolución.
* Inicio.
* Cronología.
* Prurito.
* Dolor.
* Manifestaciones sistémicas.
* Afectación de mucosas.
* Complicaciones.

Da especial importancia a las características que permitan reconocer la enfermedad en un caso clínico.
Cuando se trate de dermatología, presta especial atención a:

* Lesión elemental.
* Color.
* Forma.
* Bordes.
* Superficie.
* Distribución.
* Localización.
* Tamaño.
* Número.
* Patrón.

9. DIAGNÓSTICO
Cuando los apuntes proporcionen información diagnóstica, genera flashcards sobre:

* Criterios diagnósticos.
* Pruebas de laboratorio.
* Estudios de imagen.
* Biopsia.
* Inmunofluorescencia.
* Marcadores.
* Cultivos.
* Serologías.
* Hallazgos característicos.
* Pruebas confirmatorias.
* Diagnóstico clínico.

Cuando sea posible, diferencia entre:
prueba inicial → prueba confirmatoria → hallazgo característico.
10. DIAGNÓSTICOS DIFERENCIALES
Cuando los apuntes mencionen enfermedades similares, genera flashcards comparativas.
No te limites a:
"¿Cuáles son los diagnósticos diferenciales de X?"
También utiliza:

* ¿Cómo diferenciar X de Y?
* ¿Qué característica favorece X sobre Y?
* ¿Qué hallazgo permite distinguir X de Y?
* ¿Qué diferencia existe entre X y Y en histología?
* ¿Qué diferencia existe entre X y Y en fisiopatología?
* ¿Qué diferencia existe entre X y Y en tratamiento?

Prioriza las diferencias que sean relevantes para exámenes.
11. MANEJO Y TRATAMIENTO
Genera flashcards sobre:

* Tratamiento de primera línea.
* Tratamientos alternativos.
* Tratamiento según gravedad.
* Tratamiento tópico.
* Tratamiento sistémico.
* Tratamiento de soporte.
* Escalamiento terapéutico.
* Situaciones especiales.
* Tratamiento de complicaciones.
* Seguimiento.

Cuando los apuntes proporcionen información farmacológica, genera también tarjetas sobre:

* Mecanismo de acción.
* Efectos adversos.
* Contraindicaciones.
* Interacciones.
* Indicaciones.

Relaciona, cuando sea posible:
medicamento → mecanismo → objetivo terapéutico → efecto clínico.
12. EPIDEMIOLOGÍA
Cuando esté disponible, genera flashcards sobre:

* Edad de presentación.
* Sexo.
* Incidencia.
* Prevalencia.
* Distribución geográfica.
* Grupos de riesgo.
* Frecuencia.
* Asociaciones epidemiológicas.

Prioriza datos útiles para reconocer una enfermedad en un caso clínico.
13. ETIOLOGÍA
Genera flashcards sobre:

* Causa.
* Agente etiológico.
* Factores desencadenantes.
* Factores predisponentes.
* Factores genéticos.
* Alteraciones inmunológicas.
* Fármacos relacionados.
* Asociaciones con otras enfermedades.
* Factores ambientales.

14. PRONÓSTICO
Cuando esté disponible, genera flashcards sobre:

* Evolución.
* Remisión.
* Recurrencia.
* Mortalidad.
* Secuelas.
* Complicaciones.
* Factores asociados con mal pronóstico.
* Respuesta al tratamiento.

15. DATOS CARACTERÍSTICOS
Busca activamente los datos que permitan reconocer rápidamente una enfermedad.
Pueden incluir:

* Signos característicos.
* Síntomas clásicos.
* Distribución típica.
* Hallazgos histológicos clásicos.
* Anticuerpos específicos.
* Mutaciones.
* Asociaciones características.
* Medicamentos relacionados.
* Patrones clínicos.
* Pruebas diagnósticas características.
* Relaciones fisiopatológicas importantes.

Convierte estos datos en flashcards cuando tengan suficiente valor educativo.
16. PERLAS Y TRAMPAS DE EXAMEN
Identifica conceptos especialmente importantes para exámenes.
Prioriza:

* Asociaciones clásicas.
* Datos diagnósticos clave.
* Hallazgos característicos.
* Tratamiento de primera línea.
* Mecanismos importantes.
* Diferenciales.
* Relaciones causa-efecto.
* Conceptos que suelen confundirse.

Cuando exista una diferencia importante entre dos enfermedades o tratamientos, crea una flashcard específica para esa diferencia.
17. EVITAR REDUNDANCIA
No generes varias flashcards que evalúen exactamente el mismo conocimiento.
Si dos tarjetas son prácticamente iguales, conserva solamente la mejor.
Sin embargo, puedes evaluar un mismo concepto desde diferentes perspectivas cuando esto mejore el aprendizaje.
Por ejemplo:
Memoria:
¿Qué autoantígeno está involucrado?
Mecanismo:
¿Cómo la alteración de este autoantígeno produce la lesión?
Clínica:
¿Qué manifestación resulta de esta alteración?
Esto NO debe considerarse redundante porque evalúa diferentes niveles de comprensión.
18. DIFICULTAD
Clasifica cada flashcard como:
Fácil
Requiere recordar un dato directo y fundamental.
Medio
Requiere relacionar dos o más conceptos.
Difícil
Requiere integración, razonamiento fisiopatológico, diferenciación entre enfermedades o aplicación clínica.
Utiliza aproximadamente:

* 20% Fácil.
* 50% Medio.
* 30% Difícil.

La dificultad debe depender del razonamiento necesario, no simplemente de que el dato sea poco frecuente.
19. MATERIA
El campo Materia debe identificar la especialidad o área médica principal.
Ejemplos:

* Cardiología
* Nefrología
* Dermatología
* Microbiología
* Infectología
* Neumología
* Gastroenterología
* Endocrinología
* Hematología
* Neurología
* Reumatología
* Inmunología
* Farmacología
* Patología
* Pediatría
* Ginecología
* Obstetricia
* Urología
* Otorrinolaringología
* Oftalmología
* Cirugía
* Psiquiatría

Si una flashcard puede pertenecer a varias materias, selecciona la materia principal.
No escribas múltiples materias.
20. TEMA
El campo Tema debe utilizar EXCLUSIVAMENTE uno de estos cinco valores:

* Epidemiología
* Etiología
* Fisiopatología
* Cuadro clínico
* Tratamiento

No utilices ningún otro valor.
Si una flashcard evalúa diagnóstico, histología, pronóstico, diagnóstico diferencial, etc., asígnala al tema de los cinco disponibles que mejor represente el conocimiento principal necesario para responderla.
Ejemplos:

* Hallazgo histológico relacionado con el mecanismo → Fisiopatología
* Identificación de una manifestación clínica → Cuadro clínico
* Diferenciación basada principalmente en signos y síntomas → Cuadro clínico
* Diferenciación basada en mecanismos → Fisiopatología
* Identificación de una prueba diagnóstica basada en la causa → Etiología
* Selección de una terapia → Tratamiento

21. FORMATO OBLIGATORIO
Todas las flashcards deben seguir exactamente este formato y orden:
Flashcard 1
Anverso:
[Pregunta que el estudiante debe responder.]
Reverso:
[Respuesta clara, concisa y suficiente.]
Materia: [Materia]
Tema: [Epidemiología / Etiología / Fisiopatología / Cuadro clínico / Tratamiento]
Dificultad: [Fácil / Medio / Difícil]
Flashcard 2
Anverso:
...
Reverso:
...
Materia: ...
Tema: ...
Dificultad: ...
22. REGLAS DEL ANVERSO
El Anverso debe contener únicamente la pregunta o estímulo que se utilizará para recuperar la información.
No incluyas la respuesta en el anverso.
Evita pistas innecesarias que revelen la respuesta.
La pregunta debe ser suficientemente específica para que exista una respuesta clara.
23. REGLAS DEL REVERSO
El Reverso debe contener la información necesaria para responder correctamente.
Debe ser:

* Claro.
* Conciso.
* Preciso.
* Fácil de repasar.
* Suficientemente completo para que la tarjeta tenga valor por sí misma.

Evita párrafos excesivamente largos.
Cuando la respuesta contenga varios elementos, utiliza listas breves.
No conviertas el reverso en una explicación de libro de texto.
24. CONTROL DE CALIDAD
Antes de entregar las flashcards, realiza una revisión interna.
Para cada flashcard verifica:

1. ¿Evalúa un concepto claro?
2. ¿La pregunta permite una respuesta concreta?
3. ¿La respuesta está respaldada por los apuntes?
4. ¿No inventé información?
5. ¿La tarjeta realmente utiliza active recall?
6. ¿Es suficientemente específica?
7. ¿La respuesta es concisa?
8. ¿Existe redundancia con otra tarjeta?
9. ¿La dificultad está correctamente asignada?
10. ¿La materia es correcta?
11. ¿El tema pertenece exclusivamente a las cinco categorías permitidas?
12. ¿La información importante de los apuntes quedó cubierta?

Si una flashcard falla alguno de estos criterios, reescríbela antes de entregarla.
25. REGLA CONTRA EL "PATRÓN DE IA"
Quiero que las flashcards parezcan creadas por un profesor de medicina y no por una IA que simplemente divide un texto en preguntas.
Por lo tanto:

* Varía la redacción de los anversos.
* Varía el tipo de pregunta.
* Alterna preguntas de memoria, mecanismo, aplicación y comparación.
* No comiences todas las tarjetas con "¿Cuál...?".
* No hagas todas las respuestas con la misma estructura.
* Evita repetir frases innecesariamente.
* No conviertas cada oración de los apuntes en una tarjeta.
* Prioriza conceptos clínicamente importantes.
* Divide mecanismos complejos en pasos lógicos.
* Evita tarjetas artificialmente difíciles.

26. REGLA ABSOLUTA DE SALIDA
Quiero ÚNICAMENTE las flashcards siguiendo el formato establecido.
NO agregues al inicio:

* Introducciones.
* Comentarios.
* Resúmenes.
* Explicaciones sobre lo que vas a hacer.

NO agregues al final:

* Tablas.
* Estadísticas.
* Conteo de flashcards por materia.
* Conteo de flashcards por tema.
* Distribución de dificultades.
* Resúmenes.
* Conclusiones.
* Recomendaciones de estudio.
* Comentarios sobre cómo generaste las flashcards.
* Secciones adicionales.

Después de la última flashcard, termina la respuesta inmediatamente.
No muestres el análisis interno utilizado para generar las tarjetas.
27. REGLA FINAL
Mi objetivo no es tener el mayor número posible de flashcards.
Mi objetivo es tener el menor número de flashcards necesario para dominar completamente la información importante de mis apuntes.
Prefiere:
calidad > cantidad
active recall > resumen
comprensión > memorización superficial
conceptos de alto rendimiento > datos triviales
Cuando una fisiopatología pueda dividirse en una cadena causal, divídela.
Cuando existan enfermedades similares, enfatiza sus diferencias.
Cuando exista un dato altamente característico, conviértelo en una tarjeta.
Cuando una información sea redundante, elimínala.
Cuando un apartado no aparezca en los apuntes, ignóralo.
Ahora espera los apuntes o textos que te proporcionaré y conviértelos en flashcards siguiendo estrictamente todas estas instrucciones.`,
  },
}

export default function ImportarPreguntasModal({ tema, onCerrar, onImportado }) {
  // Pasos: 'subir' | 'previa' | 'fin'
  const [paso, setPaso] = useState('subir')
  const [modoCarga, setModoCarga] = useState('archivo') // 'archivo' | 'texto'
  const [archivo, setArchivo] = useState(null)
  const [textoPegado, setTextoPegado] = useState('')
  const [sobre, setSobre] = useState(false)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState(null)
  const [preguntas, setPreguntas] = useState([])
  const [errores, setErrores] = useState([])
  const [resultado, setResultado] = useState(null)
  const [copiado, setCopiado] = useState(false)
  const [tipoPrompt, setTipoPrompt] = useState('caso')

  function copiarPrompt() {
    navigator.clipboard
      ?.writeText(PROMPTS[tipoPrompt].texto)
      .then(() => {
        setCopiado(true)
        setTimeout(() => setCopiado(false), 1800)
      })
      .catch(() => {})
  }

  function tomarArchivo(f) {
    if (!f) return
    const ext = f.name.split('.').pop().toLowerCase()
    if (!['pdf', 'docx', 'txt'].includes(ext)) {
      setError('Formato no soportado. Usa PDF, Word (.docx) o texto (.txt).')
      return
    }
    setError(null)
    setArchivo(f)
  }

  async function analizar() {
    if (!archivo || cargando) return
    setCargando(true)
    setError(null)
    try {
      const r = await analizarArchivo(tema.id, archivo)
      setPreguntas(r.preguntas || [])
      setErrores(r.errores || [])
      setPaso('previa')
    } catch (e) {
      setError(e.message)
    } finally {
      setCargando(false)
    }
  }

  async function analizarPegado() {
    if (!textoPegado.trim() || cargando) return
    setCargando(true)
    setError(null)
    try {
      const r = await analizarTexto(tema.id, textoPegado)
      setPreguntas(r.preguntas || [])
      setErrores(r.errores || [])
      setPaso('previa')
    } catch (e) {
      setError(e.message)
    } finally {
      setCargando(false)
    }
  }

  async function confirmar() {
    if (preguntas.length === 0 || cargando) return
    setCargando(true)
    setError(null)
    try {
      const r = await confirmarImportacion(tema.id, preguntas)
      setResultado(r)
      onImportado(r.totalTema)
      setPaso('fin')
    } catch (e) {
      setError(e.message)
    } finally {
      setCargando(false)
    }
  }

  // ----- Edición de la vista previa -----
  function editarPregunta(i, campo, valor) {
    setPreguntas((prev) =>
      prev.map((p, k) => (k === i ? { ...p, [campo]: valor } : p)),
    )
  }
  function editarOpcion(i, j, valor) {
    setPreguntas((prev) =>
      prev.map((p, k) =>
        k === i
          ? { ...p, opciones: p.opciones.map((o, l) => (l === j ? valor : o)) }
          : p,
      ),
    )
  }
  function marcarCorrecta(i, j) {
    setPreguntas((prev) =>
      prev.map((p, k) => (k === i ? { ...p, respuestaCorrecta: j } : p)),
    )
  }
  function agregarOpcion(i) {
    setPreguntas((prev) =>
      prev.map((p, k) =>
        k === i && p.opciones.length < 6
          ? { ...p, opciones: [...p.opciones, ''] }
          : p,
      ),
    )
  }
  function quitarOpcion(i, j) {
    setPreguntas((prev) =>
      prev.map((p, k) => {
        if (k !== i || p.opciones.length <= 2) return p
        const opciones = p.opciones.filter((_, l) => l !== j)
        let rc = p.respuestaCorrecta
        if (j === rc) rc = 0
        else if (j < rc) rc = rc - 1
        return { ...p, opciones, respuestaCorrecta: rc }
      }),
    )
  }
  function eliminarPregunta(i) {
    setPreguntas((prev) => prev.filter((_, k) => k !== i))
  }

  return (
    <div className="modal-overlay" onClick={cargando ? undefined : onCerrar}>
      <div
        className="modal modal-importar"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="modal-titulo">📥 Importar preguntas</h3>
        <p className="modal-mensaje">
          Tema: <strong>{tema.nombre}</strong>
        </p>

        {paso === 'subir' && (
          <>
            {/* Instrucciones ARRIBA del recuadro de arrastre */}
            <div className="formato-ayuda">
              <strong>¿Cómo importar las preguntas?</strong>
              <p className="formato-sub">
                Sube tus preguntas descargadas o Copia este prompt y pégalo
                en una IA (ChatGPT, Gemini, Claude…). Luego, pega tus
                apuntes o el texto que quieras convertir. Copia la
                respuesta de la IA y pégala aquí abajo.
              </p>
              <div className="prompt-tabs">
                {Object.entries(PROMPTS).map(([id, p]) => (
                  <button
                    key={id}
                    className={`prompt-tab ${tipoPrompt === id ? 'active' : ''}`}
                    onClick={() => {
                      setTipoPrompt(id)
                      setCopiado(false)
                    }}
                  >
                    {p.etiqueta}
                  </button>
                ))}
              </div>
              <pre className="formato-ejemplo">{PROMPTS[tipoPrompt].texto}</pre>
              <button className="btn-mini" onClick={copiarPrompt}>
                {copiado ? '✓ Copiado' : '📋 Copiar prompt'}
              </button>
            </div>

            <div className="tipo-toggle">
              <button
                className={`prompt-tab ${modoCarga === 'archivo' ? 'active' : ''}`}
                onClick={() => setModoCarga('archivo')}
              >
                📎 Subir archivo
              </button>
              <button
                className={`prompt-tab ${modoCarga === 'texto' ? 'active' : ''}`}
                onClick={() => setModoCarga('texto')}
              >
                📋 Pegar texto
              </button>
            </div>

            {modoCarga === 'archivo' ? (
              <label
                className={`dropzone ${sobre ? 'sobre' : ''} ${archivo ? 'con-archivo' : ''}`}
                onDragOver={(e) => {
                  e.preventDefault()
                  setSobre(true)
                }}
                onDragLeave={() => setSobre(false)}
                onDrop={(e) => {
                  e.preventDefault()
                  setSobre(false)
                  tomarArchivo(e.dataTransfer.files?.[0])
                }}
              >
                <input
                  type="file"
                  accept={FORMATOS}
                  hidden
                  onChange={(e) => tomarArchivo(e.target.files?.[0])}
                />
                {archivo ? (
                  <span className="dropzone-archivo">📎 {archivo.name}</span>
                ) : (
                  <span className="dropzone-texto">
                    Arrastra tu archivo aquí o haz clic para elegirlo
                  </span>
                )}
              </label>
            ) : (
              <textarea
                className="form-input textarea-pegar"
                rows={8}
                value={textoPegado}
                placeholder="Pega aquí el texto generado por la IA…"
                onChange={(e) => setTextoPegado(e.target.value)}
              />
            )}

            {error && <p className="form-error">⚠️ {error}</p>}

            <div className="modal-acciones">
              <button className="btn-mini" onClick={onCerrar} disabled={cargando}>
                Cancelar
              </button>
              {modoCarga === 'archivo' ? (
                <button
                  className="btn-mini primary"
                  onClick={analizar}
                  disabled={!archivo || cargando}
                >
                  {cargando ? 'Analizando…' : 'Analizar archivo'}
                </button>
              ) : (
                <button
                  className="btn-mini primary"
                  onClick={analizarPegado}
                  disabled={!textoPegado.trim() || cargando}
                >
                  {cargando ? 'Analizando…' : 'Analizar texto'}
                </button>
              )}
            </div>
          </>
        )}

        {paso === 'previa' && (
          <>
            <div className="import-resumen">
              ✅ <strong>{preguntas.length}</strong> pregunta(s) detectada(s)
              {errores.length > 0 && (
                <>
                  {' '}
                  · ⚠️ <strong>{errores.length}</strong> con error
                </>
              )}
              <span className="import-nota">
                {' '}
                — puedes editarlas antes de importar.
              </span>
            </div>

            {/* Vista previa editable de las preguntas válidas */}
            {preguntas.length > 0 && (
              <div className="import-lista">
                {preguntas.map((p, i) => (
                  <div key={i} className="previa-item editable">
                    <div className="previa-cab">
                      <span className="previa-num">
                        {p.tipo === 'flashcard'
                          ? `🃏 Flashcard ${i + 1}`
                          : `Pregunta ${i + 1}`}
                      </span>
                      <button
                        className="btn-quitar-preg"
                        title="Quitar de la importación"
                        onClick={() => eliminarPregunta(i)}
                      >
                        ✕
                      </button>
                    </div>
                    <textarea
                      className="form-input"
                      rows={2}
                      value={p.pregunta}
                      placeholder={
                        p.tipo === 'flashcard'
                          ? 'Frente de la flashcard'
                          : 'Enunciado de la pregunta'
                      }
                      onChange={(e) => editarPregunta(i, 'pregunta', e.target.value)}
                    />
                    {p.tipo !== 'flashcard' && (
                      <div className="edit-opciones">
                        {p.opciones.map((o, j) => (
                          <div key={j} className="edit-opcion">
                            <input
                              type="radio"
                              name={`correcta-${i}`}
                              checked={j === p.respuestaCorrecta}
                              onChange={() => marcarCorrecta(i, j)}
                              title="Marcar como respuesta correcta"
                            />
                            <span className="edit-letra">{LETRAS[j]}</span>
                            <input
                              className="form-input"
                              value={o}
                              placeholder={`Opción ${LETRAS[j]}`}
                              onChange={(e) => editarOpcion(i, j, e.target.value)}
                            />
                            {p.opciones.length > 2 && (
                              <button
                                className="btn-quitar-op"
                                title="Quitar opción"
                                onClick={() => quitarOpcion(i, j)}
                              >
                                ×
                              </button>
                            )}
                          </div>
                        ))}
                        {p.opciones.length < 6 && (
                          <button className="btn-mini" onClick={() => agregarOpcion(i)}>
                            + Opción
                          </button>
                        )}
                      </div>
                    )}
                    <textarea
                      className="form-input"
                      rows={2}
                      value={p.explicacion || ''}
                      placeholder={
                        p.tipo === 'flashcard'
                          ? 'Reverso de la flashcard'
                          : 'Explicación (opcional)'
                      }
                      onChange={(e) => editarPregunta(i, 'explicacion', e.target.value)}
                    />
                    <div className="meta-caso">
                      <input
                        className="form-input"
                        value={p.materiaCaso || ''}
                        placeholder="Materia"
                        onChange={(e) => editarPregunta(i, 'materiaCaso', e.target.value)}
                      />
                      <select
                        className="form-input"
                        value={p.temaCategoria || ''}
                        onChange={(e) => editarPregunta(i, 'temaCategoria', e.target.value)}
                      >
                        {opcionesSelect(p.temaCategoria, TEMAS_CASO, 'Tema')}
                      </select>
                      <select
                        className="form-input"
                        value={p.dificultad || ''}
                        onChange={(e) => editarPregunta(i, 'dificultad', e.target.value)}
                      >
                        {opcionesSelect(p.dificultad, DIFICULTADES_CASO, 'Dificultad')}
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Lista de errores para corregir manualmente */}
            {errores.length > 0 && (
              <details className="import-errores" open={preguntas.length === 0}>
                <summary>
                  ⚠️ {errores.length} bloque(s) no se pudieron interpretar
                  (corrígelos en tu archivo y vuelve a importar)
                </summary>
                {errores.map((er, i) => (
                  <div key={i} className="error-item">
                    <div className="error-motivo">Motivo: {er.motivo}</div>
                    <pre className="error-texto">{er.texto}</pre>
                  </div>
                ))}
              </details>
            )}

            {error && <p className="form-error">⚠️ {error}</p>}

            <div className="modal-acciones">
              <button
                className="btn-mini"
                onClick={() => setPaso('subir')}
                disabled={cargando}
              >
                ← Volver
              </button>
              <button
                className="btn-mini primary"
                onClick={confirmar}
                disabled={preguntas.length === 0 || cargando}
              >
                {cargando
                  ? 'Importando…'
                  : `Importar ${preguntas.length} pregunta(s)`}
              </button>
            </div>
          </>
        )}

        {paso === 'fin' && resultado && (
          <div className="import-exito">
            <p>
              ✅ Se importaron <strong>{resultado.insertadas}</strong> pregunta(s)
              nueva(s)
              {resultado.omitidas > 0 &&
                ` (${resultado.omitidas} omitidas por estar duplicadas)`}
              . El tema ahora tiene <strong>{resultado.totalTema}</strong>.
            </p>
            <div className="modal-acciones">
              <button className="btn-mini primary" onClick={onCerrar}>
                Listo
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
