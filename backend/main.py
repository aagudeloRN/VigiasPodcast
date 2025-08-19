import asyncio
import os
from fastapi import FastAPI, File, UploadFile, Form, HTTPException, BackgroundTasks
from fastapi.staticfiles import StaticFiles
import uvicorn
from dotenv import load_dotenv
from datetime import datetime
import jinja2
from openai import AsyncOpenAI
from pinecone import Pinecone
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail
import json

# --- CONFIGURACIÓN INICIAL ---

load_dotenv()

# Inicializar clientes
openai_client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))
pinecone_client = Pinecone(api_key=os.getenv("PINECONE_API_KEY"))
sendgrid_client = SendGridAPIClient(os.getenv("SENDGRID_API_KEY"))

# Configurar Jinja2
env = jinja2.Environment(
    loader=jinja2.FileSystemLoader('backend/templates'),
    autoescape=jinja2.select_autoescape(['html', 'xml'])
)

# Conectar a Pinecone
pinecone_index = pinecone_client.Index("mapeodinamico")

# Crear la aplicación FastAPI
app = FastAPI(title="API y Frontend de Análisis de Pitches", version="3.0.0")

# --- PROMPTS MEJORADOS ---
PROMPTS = {
    "technological_analyzer_agent": '''
Actúa como un experto en extraer la esencia tecnológica de un texto. Tu tarea es leer el siguiente pitch y generar una consulta de búsqueda densa y específica para una base de datos vectorial. La consulta debe resumir las tecnologías clave, los problemas que resuelven y el sector de aplicación. No escribas un análisis, solo la consulta optimizada para la búsqueda.

Pitch: {pitch_text}
''',
    "economic_analyzer_agent": '''
Actúa como un experto en extraer la esencia económica y de modelo de negocio de un texto. Tu tarea es leer el siguiente pitch y generar una consulta de búsqueda densa y específica para una base de datos vectorial. La consulta debe resumir el modelo de negocio, las estrategias de monetización, el mercado objetivo y los factores de escalabilidad. No escribas un análisis, solo la consulta optimizada para la búsqueda.

Pitch: {pitch_text}
''',
    "social_analyzer_agent": '''
Actúa como un experto en extraer la esencia social y cultural de un texto. Tu tarea es leer el siguiente pitch y generar una consulta de búsqueda densa y específica para una base de datos vectorial. La consulta debe resumir el público objetivo, los comportamientos del usuario, los valores que refleja y las tendencias sociales o culturales implicadas. No escribas un análisis, solo la consulta optimizada para la búsqueda.

Pitch: {pitch_text}
''',
    "technological_report_generator": '''
Eres un analista experto en vigilancia tecnológica. Se te proporcionará un contexto extraído de una base de conocimiento y un pitch de un emprendedor. Tu tarea es analizar ÚNICAMENTE la información del contexto para generar un reporte estructurado sobre el pitch. No uses ningún conocimiento externo.

**Instrucciones estrictas:**
1.  Analiza los fragmentos de información del contexto para identificar tecnologías, aplicaciones y tendencias relevantes para el pitch.
2.  Genera un reporte en formato JSON que siga exactamente el siguiente esquema:
    ```json
    {{
      "impacto": "Contenido de la sección 'Impacto o Aplicaciones'. Describe cómo las tecnologías identificadas en el contexto se aplican al emprendimiento. Genera al menos dos párrafos en formato HTML (<p>Texto</p>). Cita las fuentes usando formato APA.",
      "tendencias": "Contenido de la sección 'Tendencias o proyecciones'. Presenta las tendencias emergentes basadas en el contexto y su relación con el pitch. Genera al menos tres párrafos en formato HTML (<p>Texto</p>). Cita las fuentes usando formato APA.",
      "referencias": [
        "<p>Fuente 1 en formato APA (Autor (Año), Título.)</p>",
        "<p>Fuente 2 en formato APA (Autor (Año), Título.)</p>"
      ]
    }}
    ```
3.  Tu respuesta DEBE ser únicamente el objeto JSON, sin texto adicional antes o después.
''',
    "economic_report_generator": '''
Eres un analista experto en vigilancia económica y de mercados. Se te proporcionará un contexto extraído de una base de conocimiento y un pitch de un emprendedor. Tu tarea es analizar ÚNICAMENTE la información del contexto para generar un reporte estructurado sobre el pitch. No uses ningún conocimiento externo.

**Instrucciones estrictas:**
1.  Analiza los fragmentos de información del contexto para identificar modelos de negocio, riesgos y condiciones económicas relevantes para el pitch.
2.  Genera un reporte en formato JSON que siga exactamente el siguiente esquema:
    ```json
    {{
      "modelos": "Contenido de la sección 'Modelos de negocio emergentes'. Describe modelos de negocio del contexto que sean similares o relevantes. Genera al menos un párrafo por modelo en formato HTML (<p>Texto</p>). Cita las fuentes usando formato APA.",
      "riesgos": "Contenido de la sección 'Riesgos o condiciones económicas clave'. Identifica riesgos o tendencias económicas del contexto que puedan afectar el modelo de negocio. Genera al menos un párrafo por riesgo en formato HTML (<p>Texto</p>). Cita las fuentes usando formato APA.",
      "referencias": [
        "<p>Fuente 1 en formato APA (Autor (Año), Título.)</p>",
        "<p>Fuente 2 en formato APA (Autor (Año), Título.)</p>"
      ]
    }}
    ```
3.  Tu respuesta DEBE ser únicamente el objeto JSON, sin texto adicional antes o después.
''',
    "social_report_generator": '''
Eres un analista experto en vigilancia de tendencias sociales y culturales. Se te proporcionará un contexto extraído de una base de conocimiento y un pitch de un emprendedor. Tu tarea es analizar ÚNICAMENTE la información del contexto para generar un reporte estructurado sobre el pitch. No uses ningún conocimiento externo.

**Instrucciones estrictas:**
1.  Analiza los fragmentos de información del contexto para identificar cambios culturales, tendencias y posibles riesgos sociales relevantes para el pitch.
2.  Genera un reporte en formato JSON que siga exactamente el siguiente esquema:
    ```json
    {{
      "tendcult": "Contenido de la sección 'Tendencias y cambios culturales'. Describe cambios culturales y sociales del contexto que puedan afectar el modelo de negocio. Genera un párrafo por tendencia en formato HTML (<p>Texto</p>). Cita las fuentes usando formato APA.",
      "riesgoscult": "Contenido de la sección 'Riesgos o problemáticas a abordar'. Describe riesgos que puedan surgir con estas tendencias e impactar el negocio. Genera al menos tres párrafos en formato HTML (<p>Texto</p>). Cita las fuentes usando formato APA.",
      "referenciascult": [
        "<p>Fuente 1 en formato APA (Autor (Año), Título.)</p>",
        "<p>Fuente 2 en formato APA (Autor (Año), Título.)</p>"
      ]
    }}
    ```
3.  Tu respuesta DEBE ser únicamente el objeto JSON, sin texto adicional antes o después.
'''
}

# --- LÓGICA DEL WORKFLOW ---

async def transcribe_audio(audio_file) -> str:
    print("Iniciando transcripción...")
    transcription = await openai_client.audio.transcriptions.create(model="whisper-1", file=audio_file)
    print("Transcripción completada.")
    return transcription.text

async def analyze_and_generate_report(agent_prompt: str, report_prompt: str, pitch_text: str):
    print(f"Generando consulta para el agente: {agent_prompt[:30]}...")
    agent_response = await openai_client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": agent_prompt.format(pitch_text=pitch_text)}]
    )
    search_query = agent_response.choices[0].message.content

    print(f"Buscando en Pinecone con la consulta: {search_query[:50]}...")
    query_embedding = await openai_client.embeddings.create(input=[search_query], model="text-embedding-3-small")
    vector = query_embedding.data[0].embedding
    search_results = pinecone_index.query(vector=vector, top_k=15, include_metadata=True)

    context = ""
    for i, match in enumerate(search_results['matches']):
        metadata = match.get('metadata', {})
        context += f"--- CHUNK {i} ---\nAuthor: {metadata.get('file_author', 'N/A')}\nYear: {metadata.get('file_year', 'N/A')}\nFile_name: {metadata.get('file_url', 'N/A')}\n\n{metadata.get('text', '')}\n\n"

    print("Generando reporte final estructurado...")
    final_report_prompt = f"{report_prompt}\n\nContexto de Documentación:\n{context}\n\nDevuelve únicamente un objeto JSON válido basado en el esquema solicitado."
    report_response = await openai_client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": final_report_prompt}],
        response_format={"type": "json_object"}
    )
    return json.loads(report_response.choices[0].message.content)

async def send_email_report(email_to: str, company_name: str, analysis_results: dict):
    print(f"Renderizando y enviando correo a {email_to}...")
    template = env.get_template("report_template.html")
    html_content = template.render(
        nombre_empresa=company_name,
        generation_date=datetime.now().strftime("%d %b %Y"),
        analisis_tecnologico=analysis_results["tech"],
        analisis_economico=analysis_results["econ"],
        analisis_social=analysis_results["social"]
    )
    message = Mail(
        from_email=os.getenv("SENDGRID_FROM_EMAIL"),
        to_emails=email_to,
        subject=f"Desde Ruta N te compartimos un informe de tendencias para {company_name}",
        html_content=html_content
    )
    try:
        response = sendgrid_client.send(message)
        print(f"Correo enviado con éxito a {email_to}, Status Code: {response.status_code}")
    except Exception as e:
        print(f"Error al enviar correo: {e}")

async def full_analysis_workflow(email: str, empresa: str, audio_file):
    try:
        pitch_text = await transcribe_audio(audio_file)
        print("Iniciando los 3 análisis en paralelo...")
        tech_task = analyze_and_generate_report(PROMPTS["technological_analyzer_agent"], PROMPTS["technological_report_generator"], pitch_text)
        econ_task = analyze_and_generate_report(PROMPTS["economic_analyzer_agent"], PROMPTS["economic_report_generator"], pitch_text)
        social_task = analyze_and_generate_report(PROMPTS["social_analyzer_agent"], PROMPTS["social_report_generator"], pitch_text)
        results = await asyncio.gather(tech_task, econ_task, social_task)
        print("Todos los análisis completados.")
        analysis_results = {"tech": results[0], "econ": results[1], "social": results[2]}
        await send_email_report(email, empresa, analysis_results)
    except Exception as e:
        print(f"ERROR en el workflow de análisis para {empresa}: {e}")

# --- ENDPOINTS DE LA API ---

@app.post("/api/analyze")
async def analyze_pitch_endpoint(background_tasks: BackgroundTasks, email: str = Form(...), empresa: str = Form(...), audio: UploadFile = File(...) ):
    print(f"Recibida nueva solicitud de análisis para la empresa: {empresa}, email: {email}")
    audio_file = (audio.filename, await audio.read(), audio.content_type)
    background_tasks.add_task(full_analysis_workflow, email, empresa, audio_file)
    return {"message": "¡Excelente! Hemos recibido tu pitch. El análisis está en proceso y recibirás el reporte en tu correo en unos minutos."}

# --- SERVIR FRONTEND Y PUNTO DE ENTRADA ---

# Montar el directorio del frontend unificado
# Esto debe ir después de definir las rutas de la API
app.mount("/", StaticFiles(directory="frontend", html=True), name="static")

if __name__ == "__main__":
    print("Para iniciar el servidor unificado (backend + frontend), ejecuta:")
    print("uvicorn main:app --host 0.0.0.0 --port 8000 --reload")
