import os
from langchain_community.vectorstores import FAISS
from services.embeddings import get_embedding_model
from config import STORAGE_PATH

def get_workspace_path(workspace_id):
    return os.path.join(STORAGE_PATH, workspace_id)

def load_vectorstore(workspace_id):
    path = get_workspace_path(workspace_id)
    if not os.path.exists(path):
        return None
    return FAISS.load_local(
        path,
        get_embedding_model(),
        allow_dangerous_deserialization=True
    )

def save_vectorstore(vectorstore, workspace_id):
    path = get_workspace_path(workspace_id)
    os.makedirs(path, exist_ok=True)
    vectorstore.save_local(path)

def create_or_update_vectorstore(docs, workspace_id):
    existing = load_vectorstore(workspace_id)
    if existing:
        existing.add_documents(docs)
        save_vectorstore(existing, workspace_id)
        return existing
    else:
        vectorstore = FAISS.from_documents(
            docs,
            get_embedding_model()
        )
        save_vectorstore(vectorstore, workspace_id)
        return vectorstore
