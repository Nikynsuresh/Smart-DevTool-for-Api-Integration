# Smart DevTool for API Integration

Smart DevTool for API Integration is a full-stack, AI-powered platform that accelerates third-party API onboarding. Developers supply an API documentation URL, a target programming language, and their intended use cases. The tool automatically crawls documentation pages, vectorizes raw text to a vector store, identifies authentication headers and SDK presence, maps schemas, and outputs clean, production-ready client wrappers along with Postman collections and OpenAPI summary PDFs.

---

## Key Features

1. **Documentation Analyzer**: Asynchronously crawls portals (supporting dynamic pages and SPAs via Playwright), extracts base URLs, schemas, headers, endpoints, parameter tables, and return codes.
2. **RAG Vector Search**: Embeds crawled documents and stores them in ChromaDB. Provides semantic retrieval filtered by integration run to ground LLM prompts.
3. **Use Case Filtering**: Resolves description prompts (e.g., *"I want to create payments and refunds"*) to ignore unrelated endpoints and structure code only for matching methods.
4. **SDK Detection**: Searches documentation for package libraries (pip, npm, go, maven) and recommendations.
5. **Code Client Synthesizer**: Generates class files in Python, TypeScript, JavaScript, Go, or Java containing backoff retries, error wrappers, connection timeouts, and environment configuration loading.
6. **Chat Assistant**: A dedicated grounded conversation chatbot for developers to query specifications, endpoint structures, or code requests.
7. **Asset Exports**:
   - Client Code File downloads (.py, .ts, .js, .go, .java)
   - Standard Postman Collection JSON exports
   - Formatted PDF Summary Reports displaying authentication summaries, endpoint details, and parameters

---

## Technology Stack

### Backend
- **FastAPI** (Python 3.10+)
- **SQLAlchemy** with **SQLite** (Metadata and conversation storage)
- **ChromaDB** (Vector DB indexer)
- **Playwright** & **BeautifulSoup4** (HTML crawlers)
- **LangChain** & **LangGraph** (AI orchestrators)
- **ReportLab** (PDF compiler)

### Frontend
- **Next.js** (App Router, TypeScript)
- **Tailwind CSS** (v4.0 config)
- **ShadCN UI** (Custom theme configurations)
- **Lucide React** (Modern dashboard icons)

---

## Folder Structure

```text
├── README.md
├── docker-compose.yml
├── backend/
│   ├── app/
│   │   ├── main.py            # FastAPI Entry point & migrations
│   │   ├── config.py          # Settings and schema configuration
│   │   ├── database.py        # SQLAlchemy connections
│   │   ├── models.py          # SQLite database tables
│   │   ├── schemas.py         # Request/Response models
│   │   ├── routes/            # Router definitions (integrations, chat, exports)
│   │   └── services/          # Services (scraper, rag, llm, generator, exporter)
│   ├── tests/                 # FastAPI test suite
│   ├── requirements.txt
│   └── Dockerfile
└── frontend/
    ├── src/
    │   ├── app/               # Next.js pages and layouts
    │   ├── components/        # React components (sidebar, ui Elements)
    │   └── lib/               # API connection client
    ├── components.json
    ├── tailwind.config.ts
    ├── next.config.ts
    └── Dockerfile
```

---

## Setup Instructions

### Environment Variables

Configure backend environment keys. Create a `.env` file in the `backend/` folder matching the variables in `backend/.env.example`:

```env
# Database Configurations
DATABASE_URL=sqlite:///./data/app.db
PORT=8000

# AI Models (Provide at least one key)
GEMINI_API_KEY=your_gemini_api_key_here
OPENAI_API_KEY=your_openai_api_key_here

# RAG parameters
CHROMA_PERSIST_DIR=./data/chroma
MAX_CRAWL_PAGES=15
```

### Local Development Setup

#### 1. Start Backend Server

```bash
# Move to backend folder
cd backend

# Create and activate virtual environment
python3 -m venv .venv
source .venv/bin/activate

# Install requirements
pip install -r requirements.txt

# Install Playwright browser libraries
playwright install chromium

# Launch development server
uvicorn app.main:app --reload --port 8000
```
FastAPI Swagger documentation will be available at `http://localhost:8000/docs`.

#### 2. Start Frontend Server

In a new terminal window:
```bash
# Move to frontend folder
cd frontend

# Install package dependencies
npm install

# Launch Next.js local server
npm run dev
```
The application will run on `http://localhost:3000`.

#### 3. Run Backend Test Suite

```bash
cd backend
source .venv/bin/activate
PYTHONPATH=. pytest tests/
```

---

## Deploying with Docker

Build and run both the frontend and backend containers in a single command using Docker Compose:

```bash
# Start containers (Make sure GEMINI_API_KEY / OPENAI_API_KEY are configured in environment or docker-compose)
docker-compose up --build
```
- Frontend app: `http://localhost:3000`
- Backend server: `http://localhost:8000`
