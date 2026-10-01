import os
import tempfile
from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from services.loader import load_document
from services.chunker import chunk_documents
from services.vectorstore import create_or_update_vectorstore, load_vectorstore
from services.retriever import get_mmr_retriever
from services.llm import get_llm

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

PROMPT_TEMPLATE = """You are a helpful assistant. Answer the question using ONLY the context below.
If the answer is not in the context, say "I couldn't find that in the uploaded document."

Context:
{context}

Question:
{question}

Answer:"""


@app.post("/upload/")
def upload_file(
    file: UploadFile = File(...),
    workspace_id: str = Form(...)
):
    ext = os.path.splitext(file.filename)[1].lower()
    temp_path = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp:
            tmp.write(file.file.read())
            temp_path = tmp.name

        docs = load_document(temp_path, file.filename)
        chunks = chunk_documents(docs)
        create_or_update_vectorstore(chunks, workspace_id)
        return {"status": "indexed"}
    finally:
        if temp_path and os.path.exists(temp_path):
            os.remove(temp_path)


@app.post("/query/")
def query(
    workspace_id: str = Form(...),
    question: str = Form(...)
):
    try:
        vectorstore = load_vectorstore(workspace_id)
        if not vectorstore:
            return {"answer": "No documents indexed yet."}

        retriever = get_mmr_retriever(vectorstore)
        docs = retriever.invoke(question)
        context = "\n\n".join(d.page_content for d in docs)

        llm = get_llm()
        result = llm.invoke(PROMPT_TEMPLATE.format(context=context, question=question))

        sources = sorted({d.metadata.get("source", "") for d in docs if d.metadata.get("source")})
        return {"answer": result.content, "sources": sources}
    except Exception as e:
        print("ERROR IN QUERY:", str(e))
        return {"answer": f"Backend error: {str(e)}"}