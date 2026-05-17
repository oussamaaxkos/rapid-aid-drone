Local RAG (Python + LangChain)

1) Install Python deps:
   python -m pip install -r rag/requirements.txt

2) Build index from PDFs:
   python rag/build_index.py --data .\data

3) Run app:
   corepack pnpm dev

Notes:
- Store is saved in rag/faiss-store
- Override paths with:
  - RAG_STORE_DIR
  - RAG_PYTHON
  - RAG_PYTHON_SCRIPT
