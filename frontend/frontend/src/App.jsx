import { useState, useRef, useEffect } from "react";
import "./App.css";

const BACKEND_URL = "http://127.0.0.1:8000";
const STORE_KEY = "rag_chats_v1";
const newId = () => crypto.randomUUID();

const makeChat = () => ({
  id: newId(),
  name: "New chat",
  nameEdited: false,
  fileName: "",
  uploaded: false,
  messages: [],
  updatedAt: Date.now(),
});

const loadChats = () => {
  try {
    const saved = JSON.parse(localStorage.getItem(STORE_KEY));
    if (Array.isArray(saved) && saved.length) return saved;
  } catch {}
  return [makeChat()];
};

const ICONS = {
  upload: ["M12 16V4", "M8 8l4-4 4 4", "M4 16v3a1 1 0 001 1h14a1 1 0 001-1v-3"],
  file: ["M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8z", "M14 3v5h5"],
  shield: ["M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z", "M9 12l2 2 4-4"],
  bolt: ["M13 2L4 14h7l-1 8 9-12h-7z"],
  search: ["M11 19a8 8 0 100-16 8 8 0 000 16z", "M21 21l-4.3-4.3"],
  send: ["M22 2L11 13", "M22 2l-7 20-4-9-9-4z"],
  layers: ["M12 3l9 5-9 5-9-5z", "M3 13l9 5 9-5", "M3 17l9 5 9-5"],
  plus: ["M12 5v14", "M5 12h14"],
  chat: ["M21 12a8 8 0 01-11.6 7.1L4 20l1-4.6A8 8 0 1121 12z"],
  trash: ["M4 7h16", "M10 11v6", "M14 11v6", "M6 7l1 12a1 1 0 001 1h8a1 1 0 001-1l1-12", "M9 7V4h6v3"],
};

const Icon = ({ name, size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    {ICONS[name].map((d, i) => <path key={i} d={d} />)}
  </svg>
);

const SUGGESTIONS = [
  "Summarize this document",
  "What are the key points?",
  "List important dates or figures",
];

export default function App() {
  const [chats, setChats] = useState(loadChats);
  const [activeId, setActiveId] = useState(() => chats[0].id);
  const [question, setQuestion] = useState("");
  const [loadingId, setLoadingId] = useState(null);
  const [uploadingId, setUploadingId] = useState(null);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const chatRef = useRef(null);
  const fileRef = useRef(null);

  const active = chats.find((c) => c.id === activeId) || chats[0];
  const loading = loadingId === active.id;
  const uploading = uploadingId === active.id;
  const sortedChats = [...chats].sort((a, b) => b.updatedAt - a.updatedAt);

  // Save chats to the browser whenever they change
  useEffect(() => {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(chats));
    } catch {}
  }, [chats]);

  useEffect(() => {
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: "smooth" });
  }, [active.messages, loading, active.id]);

  const updateChat = (id, patch) =>
    setChats((cs) =>
      cs.map((c) =>
        c.id === id ? { ...c, ...(typeof patch === "function" ? patch(c) : patch) } : c
      )
    );

  const switchChat = (id) => {
    setActiveId(id);
    setQuestion("");
    setError("");
  };

  const newChat = () => {
    if (!active.uploaded && active.messages.length === 0) return; // already empty
    const c = makeChat();
    setChats((cs) => [c, ...cs]);
    switchChat(c.id);
  };

  const deleteChat = (id, e) => {
    e.stopPropagation();
    const rest = chats.filter((c) => c.id !== id);
    if (rest.length === 0) {
      const c = makeChat();
      setChats([c]);
      setActiveId(c.id);
      return;
    }
    setChats(rest);
    if (id === activeId) switchChat(rest[0].id);
  };

  const uploadFile = async (file) => {
    if (!file || uploading) return;
    const id = active.id;
    setError("");
    setUploadingId(id);
    const form = new FormData();
    form.append("file", file);
    form.append("workspace_id", id);
    try {
      const res = await fetch(`${BACKEND_URL}/upload/`, { method: "POST", body: form });
      if (!res.ok) throw new Error();
      updateChat(id, { fileName: file.name, uploaded: true, updatedAt: Date.now() });
    } catch {
      setError("Upload failed. Please check that the backend is running.");
    } finally {
      setUploadingId(null);
    }
  };

  const sendMessage = async (text) => {
    const q = (text ?? question).trim();
    if (!q || loading || !active.uploaded) return;
    const id = active.id;

    updateChat(id, (c) => ({
      messages: [...c.messages, { role: "user", content: q }],
      ...(!c.nameEdited && c.messages.length === 0
        ? { name: q.length > 32 ? q.slice(0, 32) + "..." : q }
        : {}),
      updatedAt: Date.now(),
    }));
    setQuestion("");
    setLoadingId(id);

    const form = new FormData();
    form.append("workspace_id", id);
    form.append("question", q);
    try {
      const res = await fetch(`${BACKEND_URL}/query/`, { method: "POST", body: form });
      if (!res.ok) throw new Error();
      const data = await res.json();
      updateChat(id, (c) => ({
        messages: [...c.messages, { role: "assistant", content: data.answer, sources: data.sources }],
        updatedAt: Date.now(),
      }));
    } catch {
      updateChat(id, (c) => ({
        messages: [...c.messages, { role: "assistant", content: "Something went wrong. Please check the backend and try again." }],
      }));
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <div className="page">
      {/* NAVBAR */}
      <nav className="nav">
        <div className="container nav-inner">
          <a className="brand" href="#top">
            <span className="brand-mark"><Icon name="layers" size={18} /></span>
            Unified RAG
          </a>
          <div className="nav-links">
            <a href="#workspace">Workspace</a>
            <a href="#features">Features</a>
            <a href="#how">How it works</a>
          </div>
          <span className="status"><i /> Local model online</span>
        </div>
      </nav>

      {/* HERO */}
      <header className="hero" id="top">
        <div className="container hero-inner">
          <span className="eyebrow">Private. Local. Grounded.</span>
          <h1>Get answers from your documents, <span className="grad">instantly.</span></h1>
          <p>
            Upload a file and ask questions in plain language. Every answer is
            retrieved from your own content and generated by a model running
            entirely on your machine.
          </p>
          <div className="hero-cta">
            <a className="btn btn-primary" href="#workspace">Open workspace</a>
            <a className="btn btn-secondary" href="#how">See how it works</a>
          </div>
          <div className="trust">
            <span>Runs locally with Ollama</span>
            <span>No data leaves your machine</span>
            <span>PDF, DOCX, TXT, CSV, JSON</span>
          </div>
        </div>
      </header>

      {/* WORKSPACE */}
      <section className="section" id="workspace">
        <div className="container">
          <div className="section-head">
            <h2>Your workspace</h2>
            <p>Upload a document, then start a conversation with it.</p>
          </div>

          <div className="workspace">
            {/* Sidebar */}
            <aside className="side">
              <div className="side-top">
                <div className="side-title">Chats</div>
                <button className="new-btn" onClick={newChat} title="New chat">
                  <Icon name="plus" size={16} /> New
                </button>
              </div>

              <div className="chat-list">
                {sortedChats.map((c) => (
                  <div
                    key={c.id}
                    className={`chat-item ${c.id === active.id ? "on" : ""}`}
                    onClick={() => switchChat(c.id)}
                  >
                    <span className="ci-ic"><Icon name="chat" size={16} /></span>
                    <div className="ci-text">
                      <div className="ci-name">{c.name || "Untitled chat"}</div>
                      <div className="ci-meta">{c.fileName || "No document"}</div>
                    </div>
                    <button className="ci-del" onClick={(e) => deleteChat(c.id, e)} title="Delete chat">
                      <Icon name="trash" size={15} />
                    </button>
                  </div>
                ))}
              </div>

              <div className="doc-block">
                <div className="side-title">Document</div>
                {!active.uploaded ? (
                  <>
                    <div
                      className={`dropzone ${dragging ? "drag" : ""}`}
                      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                      onDragLeave={() => setDragging(false)}
                      onDrop={(e) => { e.preventDefault(); setDragging(false); uploadFile(e.dataTransfer.files[0]); }}
                      onClick={() => !uploading && fileRef.current?.click()}
                    >
                      <input ref={fileRef} type="file" hidden
                        accept=".pdf,.docx,.txt,.csv,.json"
                        onChange={(e) => { uploadFile(e.target.files[0]); e.target.value = ""; }} />
                      {uploading ? (
                        <>
                          <div className="spinner" />
                          <div className="dz-title">Indexing document</div>
                        </>
                      ) : (
                        <>
                          <span className="dz-icon"><Icon name="upload" size={18} /></span>
                          <div className="dz-title">Drop a file or click to upload</div>
                          <div className="dz-sub">PDF, DOCX, TXT, CSV, JSON</div>
                        </>
                      )}
                    </div>
                    {error && <div className="error">{error}</div>}
                  </>
                ) : (
                  <div className="file-card">
                    <span className="file-ic"><Icon name="file" size={18} /></span>
                    <div className="file-meta">
                      <div className="file-name" title={active.fileName}>{active.fileName}</div>
                      <div className="file-state"><i /> Indexed and ready</div>
                    </div>
                  </div>
                )}
              </div>
            </aside>

            {/* Chat panel */}
            <div className="chat-panel">
              <div className="chat-head">
                <input
                  className="title-input"
                  value={active.name}
                  maxLength={40}
                  placeholder="Name this chat"
                  onChange={(e) => updateChat(active.id, { name: e.target.value, nameEdited: true })}
                />
                <div className="chat-sub">
                  {active.uploaded ? `Asking about ${active.fileName}` : "Upload a document to begin"}
                </div>
              </div>

              <div className="chat" ref={chatRef}>
                {active.messages.length === 0 && (
                  <div className="empty">
                    <span className="empty-ic"><Icon name="search" size={22} /></span>
                    <div className="empty-title">
                      {active.uploaded ? "Ask anything about your document" : "No document yet"}
                    </div>
                    <div className="empty-sub">
                      {active.uploaded ? "Try one of these to get started" : "Add a file on the left to unlock the chat"}
                    </div>
                    {active.uploaded && (
                      <div className="chips">
                        {SUGGESTIONS.map((s) => (
                          <button key={s} className="chip" onClick={() => sendMessage(s)}>{s}</button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {active.messages.map((m, i) => (
                  <div key={i} className={`msg ${m.role}`}>
                    <div className="msg-who">{m.role === "user" ? "You" : "Retriever"}</div>
                    <div className="msg-bubble">
                      {m.content}
                      {m.sources?.length > 0 && (
                        <div className="sources">
                          <span>Sources</span>
                          {m.sources.map((s) => <em key={s}>{s}</em>)}
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {loading && (
                  <div className="msg assistant">
                    <div className="msg-who">Retriever</div>
                    <div className="msg-bubble"><span className="typing"><i /><i /><i /></span></div>
                  </div>
                )}
              </div>

              <div className="composer">
                <input
                  value={question}
                  disabled={!active.uploaded}
                  onChange={(e) => setQuestion(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                  placeholder={active.uploaded ? "Ask a question about your document" : "Upload a document first"}
                />
                <button className="send" onClick={() => sendMessage()}
                  disabled={!active.uploaded || loading || !question.trim()} aria-label="Send">
                  <Icon name="send" size={18} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="section alt" id="features">
        <div className="container">
          <div className="section-head">
            <h2>Built for trustworthy answers</h2>
            <p>Everything you need to work with private documents, nothing you do not.</p>
          </div>
          <div className="grid3">
            <div className="card">
              <span className="card-ic"><Icon name="shield" /></span>
              <h3>Fully private</h3>
              <p>Embeddings and answers are produced by local models. Your documents never leave your computer.</p>
            </div>
            <div className="card">
              <span className="card-ic"><Icon name="search" /></span>
              <h3>Grounded in your content</h3>
              <p>Answers are built from the most relevant passages found in your file, with sources shown.</p>
            </div>
            <div className="card">
              <span className="card-ic"><Icon name="bolt" /></span>
              <h3>Multiple formats</h3>
              <p>Work with PDF, Word, plain text, CSV and JSON files in the same simple workspace.</p>
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="section" id="how">
        <div className="container">
          <div className="section-head">
            <h2>How it works</h2>
            <p>Three steps from a raw file to a useful answer.</p>
          </div>
          <div className="grid3">
            <div className="step"><span className="num">1</span><h3>Upload</h3><p>Your document is split into small passages and converted into embeddings.</p></div>
            <div className="step"><span className="num">2</span><h3>Retrieve</h3><p>Your question is matched against the passages to find the most relevant context.</p></div>
            <div className="step"><span className="num">3</span><h3>Answer</h3><p>The local language model writes a clear answer using only that context.</p></div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="footer">
        <div className="container footer-inner">
          <span className="brand"><span className="brand-mark"><Icon name="layers" size={16} /></span>Unified RAG</span>
          <span className="muted">Powered by Ollama, FAISS and LangChain</span>
        </div>
      </footer>
    </div>
  );
}