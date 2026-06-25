import os
import logging
from typing import List, Dict, Any, Optional
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from langchain_openai import OpenAIEmbeddings
from langchain_community.vectorstores import Chroma
from langchain_core.documents import Document
from app.config import settings

logger = logging.getLogger(__name__)

class RAGPipeline:
    def __init__(self):
        self.persist_directory = settings.CHROMA_PERSIST_DIR
        self._init_embeddings()
        
    def _init_embeddings(self):
        """Initialize the embeddings model based on available API keys."""
        # Check environment or settings for API keys
        gemini_key = settings.GEMINI_API_KEY or os.environ.get("GEMINI_API_KEY")
        openai_key = settings.OPENAI_API_KEY or os.environ.get("OPENAI_API_KEY")
        
        if gemini_key:
            logger.info("Initializing Google Generative AI Embeddings")
            self.embeddings = GoogleGenerativeAIEmbeddings(
                model="models/gemini-embedding-001",
                google_api_key=gemini_key
            )
        elif openai_key:
            logger.info("Initializing OpenAI Embeddings")
            self.embeddings = OpenAIEmbeddings(
                model="text-embedding-3-small",
                api_key=openai_key
            )
        else:
            logger.warning("No API keys found for embeddings. Please set GEMINI_API_KEY or OPENAI_API_KEY. RAG query/store functions will be disabled.")
            self.embeddings = None

    def _get_vectorstore(self) -> Chroma:
        """Get or initialize the persistent Chroma DB collection."""
        if not self.embeddings:
            raise ValueError("Neither GEMINI_API_KEY nor OPENAI_API_KEY is set. RAG pipeline requires an active API key.")
        return Chroma(
            collection_name="smart_devtool_docs",
            embedding_function=self.embeddings,
            persist_directory=self.persist_directory
        )

    def process_and_store(self, integration_id: int, pages: List[Dict[str, Any]], progress_callback=None) -> int:
        """Chunk raw content, embed, and store in vector database."""
        logger.info(f"Processing and vectorizing {len(pages)} pages for integration {integration_id}")
        
        if progress_callback:
            # RAG start (e.g. 40% to 45%)
            progress_callback(42, "Initializing chunk splitter and embeddings...")

        # Initialize text splitter
        text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=3500,
            chunk_overlap=300,
            separators=["\n\n", "\n", " ", ""]
        )
        
        documents = []
        for idx, page in enumerate(pages):
            page_content = page["content"]
            metadata = {
                "integration_id": integration_id,
                "url": page["url"],
                "title": page["title"]
            }
            # Split page content into chunks
            chunks = text_splitter.split_text(page_content)
            for chunk in chunks:
                documents.append(Document(page_content=chunk, metadata=metadata))
            
            if progress_callback and len(pages) > 1:
                pct = int(45 + (idx / len(pages)) * 15)
                progress_callback(pct, f"Chunking page {idx+1}/{len(pages)}: {page['title']}")

        if not documents:
            logger.warning("No documents chunked for embedding.")
            return 0

        logger.info(f"Generated {len(documents)} document chunks. Storing in ChromaDB...")
        if progress_callback:
            progress_callback(60, f"Indexing {len(documents)} chunks in ChromaDB vector store...")

        vectorstore = self._get_vectorstore()
        
        # Batch addition with delays to prevent rate-limit thresholds on Free Tier API keys
        import time
        batch_size = 10
        for i in range(0, len(documents), batch_size):
            batch = documents[i : i + batch_size]
            vectorstore.add_documents(batch)
            if i + batch_size < len(documents):
                logger.info("Sleeping 2 seconds between embedding batches to respect rate limits...")
                time.sleep(2.0)
            
        vectorstore.persist()
        logger.info(f"Successfully stored and indexed vectors for integration {integration_id}")
        
        if progress_callback:
            progress_callback(70, "Vector DB indexing complete.")
            
        return len(documents)

    def retrieve_context(self, integration_id: int, query: str, k: int = 6) -> List[Document]:
        """Retrieve relevant documentation chunks based on use case or chat query."""
        logger.info(f"Retrieving context for query: '{query}' in integration {integration_id}")
        vectorstore = self._get_vectorstore()
        
        # ChromaDB supports metadata filtering
        filter_dict = {"integration_id": integration_id}
        
        results = vectorstore.similarity_search(
            query=query,
            k=k,
            filter=filter_dict
        )
        logger.info(f"Retrieved {len(results)} context chunks")
        return results

    def clear_integration_vectors(self, integration_id: int):
        """Remove all vectors associated with a specific integration (e.g. for re-runs or deletes)."""
        try:
            vectorstore = self._get_vectorstore()
            # Chroma DB delete supports list of ids or where filter
            # Langchain's Chroma delete by filter
            vectorstore._collection.delete(where={"integration_id": integration_id})
            vectorstore.persist()
            logger.info(f"Cleared all vectors for integration {integration_id}")
        except Exception as e:
            logger.error(f"Error clearing vectors for integration {integration_id}: {e}")
