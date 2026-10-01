import os
import json
from langchain_community.document_loaders import (
    PyPDFLoader,
    TextLoader,
    Docx2txtLoader,
    CSVLoader,
)
from langchain_core.documents import Document

def load_document(file_path, filename):
    ext = os.path.splitext(filename)[1].lower()
    if ext == ".pdf":
        loader = PyPDFLoader(file_path)
        docs = loader.load()
    elif ext == ".txt":
        loader = TextLoader(file_path)
        docs = loader.load()
    elif ext == ".docx":
        loader = Docx2txtLoader(file_path)
        docs = loader.load()
    elif ext == ".csv":
        loader = CSVLoader(file_path)
        docs = loader.load()
    elif ext == ".json":
        docs = load_json(file_path)
    else:
        raise ValueError(f"Unsupported file type: {ext}")
    for doc in docs:
        doc.metadata["source"] = filename
    return docs

def load_json(file_path):
    with open(file_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    text = json.dumps(data, indent=2)
    return [Document(page_content=text)]
