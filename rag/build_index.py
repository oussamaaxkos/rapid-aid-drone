import argparse
import os
from pathlib import Path

from langchain_community.document_loaders import PyPDFLoader
from langchain_community.vectorstores import FAISS
from langchain_openai import OpenAIEmbeddings
from langchain_text_splitters import RecursiveCharacterTextSplitter


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--data", default=str(Path(__file__).resolve().parents[1] / "data"))
    parser.add_argument("--store", default=str(Path(__file__).resolve().parent / "faiss-store"))
    parser.add_argument("--model", default="text-embedding-3-small")
    args = parser.parse_args()

    if not os.environ.get("OPENAI_API_KEY"):
        raise SystemExit("Missing OPENAI_API_KEY")

    data_dir = Path(args.data)
    pdfs = sorted(data_dir.glob("*.pdf"))
    if not pdfs:
        raise SystemExit("No PDF files found in data directory")

    docs = []
    for pdf_path in pdfs:
        loader = PyPDFLoader(str(pdf_path))
        docs.extend(loader.load())

    splitter = RecursiveCharacterTextSplitter(chunk_size=1200, chunk_overlap=200)
    split_docs = splitter.split_documents(docs)

    embeddings = OpenAIEmbeddings(model=args.model)
    store = FAISS.from_documents(split_docs, embeddings)

    store_dir = Path(args.store)
    store_dir.mkdir(parents=True, exist_ok=True)
    store.save_local(str(store_dir))
    print(f"Saved FAISS store to {store_dir}")


if __name__ == "__main__":
    main()
