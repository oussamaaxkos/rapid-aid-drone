import argparse
import json
import os
from pathlib import Path

from langchain_community.vectorstores import FAISS
from langchain_openai import OpenAIEmbeddings


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--store", required=True)
    parser.add_argument("--model", default="text-embedding-3-small")
    parser.add_argument("--top-k", type=int, default=5)
    args = parser.parse_args()

    if not os.environ.get("OPENAI_API_KEY"):
        raise SystemExit("Missing OPENAI_API_KEY")

    payload = json.loads(os.environ.get("RAG_QUERY", "{}"))
    query = (payload.get("query") or "").strip()
    if not query:
        print(json.dumps({"results": []}))
        return

    embeddings = OpenAIEmbeddings(model=args.model)
    store = FAISS.load_local(args.store, embeddings, allow_dangerous_deserialization=True)
    results = store.similarity_search_with_score(query, k=args.top_k)

    formatted = []
    for doc, score in results:
        formatted.append({
            "text": doc.page_content,
            "source": doc.metadata.get("source"),
            "page": doc.metadata.get("page"),
            "score": float(score),
        })

    print(json.dumps({"results": formatted}))


if __name__ == "__main__":
    main()
