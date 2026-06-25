import Link from "next/link";
import { Terminal, Cpu, ArrowRight, Zap, Code2, ShieldAlert, Sparkles, MessageSquare, Download, Globe } from "lucide-react";

export const metadata = {
  title: "Smart DevTool - AI-Powered API Integration",
  description: "Crawl documentation, vectorize schema, and generate production-ready API wrapper clients instantly using generative AI.",
};

export default function LandingPage() {
  return (
    <div className="bg-[#050508] text-slate-100 min-h-screen flex flex-col selection:bg-indigo-500/30 selection:text-indigo-200 overflow-x-hidden">
      {/* Header */}
      <header className="border-b border-[#13141f]/80 bg-[#050508]/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-md shadow-indigo-500/20 group-hover:scale-105 transition-transform">
              <Terminal className="h-4.5 w-4.5 text-white" />
            </div>
            <span className="font-extrabold text-white tracking-tight text-lg">
              Smart <span className="text-indigo-400">DevTool</span>
            </span>
          </Link>
          
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-400">
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <a href="#workflow" className="hover:text-white transition-colors">Workflow</a>
            <a href="#code-preview" className="hover:text-white transition-colors">Code Preview</a>
          </nav>

          <div className="flex items-center gap-4">
            <Link 
              id="header_cta_btn"
              href="/dashboard" 
              className="inline-flex items-center gap-1.5 px-4.5 py-2 rounded-xl text-xs font-semibold bg-indigo-600 text-white shadow-lg shadow-indigo-600/20 hover:bg-indigo-500 hover:shadow-indigo-500/30 transition-all duration-200"
            >
              Launch Dashboard
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-24 pb-20 px-6 max-w-7xl mx-auto flex flex-col items-center text-center z-10">
        {/* Glow Effects */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none -z-10" />
        <div className="absolute top-1/3 left-1/3 w-[300px] h-[300px] bg-violet-600/10 rounded-full blur-[100px] pointer-events-none -z-10 animate-pulse" />

        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-indigo-500/30 bg-indigo-950/20 text-indigo-400 text-xs font-semibold mb-8 animate-fade-in">
          <Sparkles className="h-3.5 w-3.5 animate-spin-slow text-indigo-400" />
          Next-Gen AI API Agent is Live
        </div>

        {/* Heading */}
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-white max-w-4xl leading-[1.1] mb-6">
          Integrate Any Third-Party API <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-violet-400 to-pink-500">
            In Minutes, Not Days
          </span>
        </h1>

        {/* Subtitle */}
        <p className="text-base sm:text-lg text-slate-400 max-w-2xl leading-relaxed mb-10">
          Paste any API documentation link. Our autonomous scraper crawlers harvest schemas,
          detect official SDKs, and compile complete, type-safe wrapper clients with advanced error handling and retry logic.
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 items-center mb-16">
          <Link 
            id="hero_primary_btn"
            href="/analyze" 
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl text-sm font-bold bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white shadow-xl shadow-indigo-600/20 hover:shadow-indigo-500/30 hover:translate-y-[-1px] active:translate-y-[1px] transition-all duration-200"
          >
            Start Integrating Now
            <ArrowRight className="h-4.5 w-4.5" />
          </Link>
          <Link 
            id="hero_secondary_btn"
            href="/dashboard" 
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl text-sm font-bold bg-[#131420] text-slate-300 border border-[#1f202e] hover:bg-[#1a1b2b] hover:text-white transition-all duration-200"
          >
            View Dashboard
          </Link>
        </div>

        {/* App Dashboard Preview */}
        <div className="w-full max-w-5xl rounded-2xl border border-[#1f202e] bg-[#0c0d16] p-2.5 shadow-2xl shadow-indigo-950/20 relative group">
          <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500/10 via-transparent to-violet-500/10 rounded-2xl pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <div className="rounded-xl overflow-hidden border border-[#181926] bg-[#07080c] aspect-[16/9] flex flex-col p-4">
            {/* Mock Header */}
            <div className="flex items-center justify-between pb-3 border-b border-[#141520] mb-4">
              <div className="flex gap-1.5">
                <div className="h-3 w-3 rounded-full bg-rose-500/80" />
                <div className="h-3 w-3 rounded-full bg-amber-500/80" />
                <div className="h-3 w-3 rounded-full bg-emerald-500/80" />
              </div>
              <div className="h-5 w-48 rounded bg-[#10111a] border border-[#181926] flex items-center justify-center">
                <span className="text-[10px] text-slate-500 tracking-wider">docs.stripe.com/api</span>
              </div>
              <div className="h-4 w-4 rounded bg-[#10111a]" />
            </div>
            
            {/* Mock Layout */}
            <div className="flex-1 grid grid-cols-12 gap-4 text-left">
              {/* Left sidebar info */}
              <div className="col-span-4 border-r border-[#141520] pr-4 space-y-4">
                <div className="space-y-1">
                  <div className="h-3 w-24 bg-indigo-500/20 rounded animate-pulse" />
                  <div className="h-4 w-40 bg-slate-700/80 rounded" />
                </div>
                <div className="p-3 rounded-lg bg-[#0e0f18] border border-[#181926] space-y-2.5">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] text-slate-500">Authentication</span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-semibold">Bearer Token</span>
                  </div>
                  <div className="h-2 w-full bg-slate-800 rounded" />
                  <div className="h-2 w-3/4 bg-slate-800 rounded" />
                </div>
                <div className="space-y-2">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Endpoints</span>
                  <div className="flex items-center gap-2 p-1.5 rounded bg-[#10111a] border border-indigo-500/20">
                    <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-400">POST</span>
                    <span className="text-[10px] font-mono text-slate-300">/v1/charges</span>
                  </div>
                  <div className="flex items-center gap-2 p-1.5 rounded bg-[#10111a] border border-transparent">
                    <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-400">POST</span>
                    <span className="text-[10px] font-mono text-slate-400">/v1/refunds</span>
                  </div>
                </div>
              </div>
              
              {/* Main Code preview */}
              <div className="col-span-8 flex flex-col bg-[#0b0c13] rounded-lg border border-[#141520] p-4 relative font-mono text-[11px] overflow-hidden">
                <div className="flex justify-between items-center pb-2 border-b border-[#141520] mb-3">
                  <span className="text-slate-400 flex items-center gap-1.5"><Code2 className="h-3.5 w-3.5 text-indigo-400" /> stripe_client.py</span>
                  <span className="text-[9px] text-slate-500 font-semibold uppercase">Python Wrapper</span>
                </div>
                <div className="flex-1 space-y-2 text-indigo-200">
                  <p className="text-indigo-400"><span className="text-pink-500">import</span> httpx</p>
                  <p className="text-indigo-400"><span className="text-pink-500">import</span> os</p>
                  <p className="text-slate-500"># Production-ready client wrapper with backoff retries</p>
                  <p><span className="text-violet-400">class</span> <span className="text-amber-300 font-semibold">StripeClient</span>:</p>
                  <p>&nbsp;&nbsp;&nbsp;&nbsp;<span className="text-violet-400">def</span> <span className="text-sky-300">__init__</span>(self, api_key: str = None):</p>
                  <p>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;self.api_key = api_key or os.getenv(<span className="text-emerald-300">"STRIPE_API_KEY"</span>)</p>
                  <p>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;self.base_url = <span className="text-emerald-300">"https://api.stripe.com"</span></p>
                  <p>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;self.client = httpx.Client(headers={"{"}<span className="text-emerald-300">"Authorization"</span>: f<span className="text-emerald-300">"Bearer {"{"}self.api_key{"}"}"</span>{"}"})</p>
                  <br />
                  <p>&nbsp;&nbsp;&nbsp;&nbsp;<span className="text-violet-400">def</span> <span className="text-sky-300">create_charge</span>(self, amount: int, currency: str = <span className="text-emerald-300">"usd"</span>):</p>
                  <p>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;response = self.client.post(f<span className="text-emerald-300">"{"{"}self.base_url{"}"}/v1/charges"</span>, data=...)</p>
                  <p>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span className="text-pink-500">return</span> response.json()</p>
                </div>
                <div className="absolute bottom-3 right-3 h-7 px-3 bg-indigo-600 text-white rounded-lg flex items-center gap-1.5 shadow-md shadow-indigo-500/20 text-[10px] font-bold">
                  <Zap className="h-3 w-3 text-amber-300 fill-amber-300 animate-pulse" /> Auto Generated
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Free APIs Section */}
      <section className="py-20 border-t border-[#2b2522] bg-[#0c0d16]/30 relative">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="text-indigo-400 font-bold text-xs uppercase tracking-wider block mb-2">Ready to Test</span>
            <h2 className="text-3xl font-extrabold text-white mb-4">
              Try Free Example API Integrations
            </h2>
            <p className="text-slate-400 text-sm">
              Select one of these open, free-tier APIs to test the AI scraping and client wrapper generation pipeline instantly.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Example 1: Payment Checkout */}
            <div className="p-6 rounded-2xl border border-[#1f202e] bg-[#0c0d16]/60 backdrop-blur-sm flex flex-col justify-between hover:border-[#e59b6c]/30 hover:shadow-lg hover:shadow-[#e59b6c]/5 transition-all group">
              <div className="space-y-4">
                <div className="h-10 w-10 rounded-xl bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <Zap className="h-5 w-5 text-indigo-400" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-white">Payment & Store Checkout</h3>
                    <span className="text-[9px] uppercase font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">Free</span>
                  </div>
                  <p className="text-slate-400 text-xs leading-relaxed mt-2">
                    Integrate fake store payments, carts, and customer checkouts using the public Fake Store API.
                  </p>
                </div>
                <div className="text-[10px] font-mono text-slate-500 bg-[#10111a] p-2 rounded truncate">
                  https://fakestoreapi.com
                </div>
              </div>
              <Link 
                href="/analyze?url=https://fakestoreapi.com&usecase=I want to integrate checkout payments, shopping cart items, and product lists"
                className="mt-6 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold bg-[#131420] text-slate-300 border border-[#1f202e] hover:bg-indigo-600 hover:text-white hover:border-transparent transition-all"
              >
                Try Integration
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            {/* Example 2: Question Paper Prep */}
            <div className="p-6 rounded-2xl border border-[#1f202e] bg-[#0c0d16]/60 backdrop-blur-sm flex flex-col justify-between hover:border-[#e59b6c]/30 hover:shadow-lg hover:shadow-[#e59b6c]/5 transition-all group">
              <div className="space-y-4">
                <div className="h-10 w-10 rounded-xl bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <Code2 className="h-5 w-5 text-indigo-400" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-white">Question Paper & Quiz Prep</h3>
                    <span className="text-[9px] uppercase font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">Free</span>
                  </div>
                  <p className="text-slate-400 text-xs leading-relaxed mt-2">
                    Generate exam questionnaires, curriculum quizzes, and question papers using the Open Trivia API database.
                  </p>
                </div>
                <div className="text-[10px] font-mono text-slate-500 bg-[#10111a] p-2 rounded truncate">
                  https://opentdb.com
                </div>
              </div>
              <Link 
                href="/analyze?url=https://opentdb.com/api_config.php&usecase=I want to retrieve multiple-choice quiz questions, categories, and generate curriculum exam papers"
                className="mt-6 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold bg-[#131420] text-slate-300 border border-[#1f202e] hover:bg-indigo-600 hover:text-white hover:border-transparent transition-all"
              >
                Try Integration
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            {/* Example 3: Geography & Currency */}
            <div className="p-6 rounded-2xl border border-[#1f202e] bg-[#0c0d16]/60 backdrop-blur-sm flex flex-col justify-between hover:border-[#e59b6c]/30 hover:shadow-lg hover:shadow-[#e59b6c]/5 transition-all group">
              <div className="space-y-4">
                <div className="h-10 w-10 rounded-xl bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <Globe className="h-5 w-5 text-indigo-400" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-white">Public Geography & Currency</h3>
                    <span className="text-[9px] uppercase font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">Free</span>
                  </div>
                  <p className="text-slate-400 text-xs leading-relaxed mt-2">
                    Access country demographics, geographic borders, currency exchanges, and regional demographics.
                  </p>
                </div>
                <div className="text-[10px] font-mono text-slate-500 bg-[#10111a] p-2 rounded truncate">
                  https://restcountries.com
                </div>
              </div>
              <Link 
                href="/analyze?url=https://restcountries.com&usecase=I want to search country data by name, capital city, regional currency code, and language demographics"
                className="mt-6 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold bg-[#131420] text-slate-300 border border-[#1f202e] hover:bg-indigo-600 hover:text-white hover:border-transparent transition-all"
              >
                Try Integration
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-24 border-t border-[#131420] bg-[#07080f]/40 relative">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl font-extrabold text-white mb-4">
              Equipped with Everything to Speed Up Integrations
            </h2>
            <p className="text-slate-400 text-sm">
              We automate the repetitive coding tasks involved in reading documentation, setting up models, and writing endpoints.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Feature 1 */}
            <div className="p-6 rounded-2xl border border-[#1f202e] bg-[#0c0d16]/60 backdrop-blur-sm hover:border-indigo-500/30 hover:shadow-lg hover:shadow-indigo-500/5 transition-all group">
              <div className="h-10 w-10 rounded-xl bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center mb-6 group-hover:scale-105 transition-transform">
                <Cpu className="h-5 w-5 text-indigo-400" />
              </div>
              <h3 className="text-base font-bold text-white mb-2">Docs Scraper</h3>
              <p className="text-slate-400 text-xs leading-relaxed">
                Uses Playwright to run single-page documentation portals, scraping nested API pages recursively up to 15 layers.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="p-6 rounded-2xl border border-[#1f202e] bg-[#0c0d16]/60 backdrop-blur-sm hover:border-indigo-500/30 hover:shadow-lg hover:shadow-indigo-500/5 transition-all group">
              <div className="h-10 w-10 rounded-xl bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center mb-6 group-hover:scale-105 transition-transform">
                <Terminal className="h-5 w-5 text-indigo-400" />
              </div>
              <h3 className="text-base font-bold text-white mb-2">RAG Pipeline</h3>
              <p className="text-slate-400 text-xs leading-relaxed">
                Splits documents, creates high-fidelity embeddings, and indexes them in ChromaDB for fast similarity matches against use cases.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="p-6 rounded-2xl border border-[#1f202e] bg-[#0c0d16]/60 backdrop-blur-sm hover:border-indigo-500/30 hover:shadow-lg hover:shadow-indigo-500/5 transition-all group">
              <div className="h-10 w-10 rounded-xl bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center mb-6 group-hover:scale-105 transition-transform">
                <Code2 className="h-5 w-5 text-indigo-400" />
              </div>
              <h3 className="text-base font-bold text-white mb-2">Wrapper Generator</h3>
              <p className="text-slate-400 text-xs leading-relaxed">
                Compiles clean SDK wrappers in Python, TS, JS, Go, and Java complete with connection retries and error catchers.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="p-6 rounded-2xl border border-[#1f202e] bg-[#0c0d16]/60 backdrop-blur-sm hover:border-indigo-500/30 hover:shadow-lg hover:shadow-indigo-500/5 transition-all group">
              <div className="h-10 w-10 rounded-xl bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center mb-6 group-hover:scale-105 transition-transform">
                <MessageSquare className="h-5 w-5 text-indigo-400" />
              </div>
              <h3 className="text-base font-bold text-white mb-2">Chat Assistant</h3>
              <p className="text-slate-400 text-xs leading-relaxed">
                Interactive documentation QA assistant backed by vector retrieval to answer technical API execution queries immediately.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Exporters Workflow Section */}
      <section id="workflow" className="py-24 border-t border-[#131420] relative">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <span className="text-indigo-400 font-bold text-xs uppercase tracking-wider block mb-2">Export formats</span>
              <h2 className="text-3xl font-extrabold text-white mb-6">
                One-Click Exports to Accelerate Integration Tasks
              </h2>
              <p className="text-slate-400 text-sm leading-relaxed mb-8">
                Smart DevTool compiles documentation data into portable assets ready to import into codebases or test clients, eliminating manual setup times.
              </p>
              
              <div className="space-y-4">
                <div className="flex gap-4">
                  <div className="h-9 w-9 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0 border border-emerald-500/20">
                    <Code2 className="h-4.5 w-4.5 text-emerald-400" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">Full Source Code Files</h4>
                    <p className="text-slate-400 text-xs">Download ready-to-run wrapper classes in `.py`, `.ts`, `.js`, `.go`, or `.java` extensions.</p>
                  </div>
                </div>
                
                <div className="flex gap-4">
                  <div className="h-9 w-9 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0 border border-blue-500/20">
                    <Download className="h-4.5 w-4.5 text-blue-400" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">Postman Collections</h4>
                    <p className="text-slate-400 text-xs">Includes all relevant endpoint definitions, request body templates, headers, and environmental variables.</p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="h-9 w-9 rounded-lg bg-purple-500/10 flex items-center justify-center shrink-0 border border-purple-500/20">
                    <ShieldAlert className="h-4.5 w-4.5 text-purple-400" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">OpenAPI Summary PDF Report</h4>
                    <p className="text-slate-400 text-xs">Beautifully generated reports documenting authentication, methods, payloads, and parameter constraints.</p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="rounded-2xl border border-[#1f202e] bg-[#0c0d16] p-8 flex flex-col gap-4 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/10 rounded-full blur-xl pointer-events-none" />
              <h3 className="text-md font-bold text-white flex items-center gap-2">
                <Zap className="h-4 w-4 text-amber-400" /> Sandbox Crawling Output
              </h3>
              <div className="h-[2px] bg-gradient-to-r from-indigo-500 to-transparent mb-2" />
              
              <div className="space-y-3.5">
                <div className="flex items-center justify-between text-xs pb-2 border-b border-[#141520]">
                  <span className="text-slate-400">Total crawled pages</span>
                  <span className="text-white font-mono font-bold">12</span>
                </div>
                <div className="flex items-center justify-between text-xs pb-2 border-b border-[#141520]">
                  <span className="text-slate-400">Database vectorized tokens</span>
                  <span className="text-white font-mono font-bold">18,491</span>
                </div>
                <div className="flex items-center justify-between text-xs pb-2 border-b border-[#141520]">
                  <span className="text-slate-400">Official SDK detected</span>
                  <span className="text-emerald-400 font-bold">Yes (Stripe Python 7.8.0)</span>
                </div>
                <div className="flex items-center justify-between text-xs pb-2 border-b border-[#141520]">
                  <span className="text-slate-400">Integration recommendation</span>
                  <span className="text-indigo-400 font-semibold">SDK Wrapper Method</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto border-t border-[#131420] py-8 text-center text-xs text-slate-500 bg-[#040407]">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-4">
          <p>© 2026 Smart DevTool for API Integration. Built for developer productivity.</p>
          <div className="flex gap-6">
            <Link href="/dashboard" className="hover:text-slate-300">Dashboard</Link>
            <Link href="/analyze" className="hover:text-slate-300">New Run</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
