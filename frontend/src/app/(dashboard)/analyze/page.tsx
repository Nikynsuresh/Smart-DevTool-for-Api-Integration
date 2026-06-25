"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { 
  Cpu, 
  Globe, 
  Terminal, 
  ArrowRight, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Code2, 
  Layers, 
  ShieldCheck, 
  Sparkles,
  Info
} from "lucide-react";
import { createIntegration, getIntegration, Integration } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";

const LANGUAGES = [
  { id: "python", name: "Python", ext: ".py", desc: "Python 3 + httpx / requests client" },
  { id: "typescript", name: "TypeScript", ext: ".ts", desc: "TypeScript + native fetch / axios" },
  { id: "javascript", name: "JavaScript", ext: ".js", desc: "ES6+ fetch client wrapper" },
  { id: "go", name: "Go", ext: ".go", desc: "Go structures and net/http client" },
  { id: "java", name: "Java", ext: ".java", desc: "Modern Java HttpClient wrapper" }
];

export default function AnalyzePage() {
  const router = useRouter();
  
  // Form state
  const [url, setUrl] = useState("");
  const [useCase, setUseCase] = useState("");
  const [language, setLanguage] = useState("python");
  const [requiresSubscription, setRequiresSubscription] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  // Pipeline processing state
  const [activeIntegration, setActiveIntegration] = useState<Integration | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showErrorModal, setShowErrorModal] = useState(false);

  // Auto-fill from query parameters
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const urlParam = params.get("url");
      const useCaseParam = params.get("usecase");
      const langParam = params.get("language");
      if (urlParam) setUrl(urlParam);
      if (useCaseParam) setUseCase(useCaseParam);
      if (langParam) setLanguage(langParam);
    }
  }, []);

  // Poll status when activeIntegration is set and not completed/failed
  useEffect(() => {
    if (!activeIntegration) return;
    const isFinished = activeIntegration.status === "completed" || activeIntegration.status === "failed";
    if (isFinished) return;

    const interval = setInterval(async () => {
      try {
        const data = await getIntegration(activeIntegration.id);
        setActiveIntegration(data);
        if (data.status === "failed") {
          setError(data.error_message || "Analysis pipeline encountered an error.");
          setShowErrorModal(true);
        }
      } catch (err) {
        console.error("Failed to check status:", err);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [activeIntegration]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    
    setSubmitting(true);
    setError(null);
    try {
      const integration = await createIntegration(
        url, 
        useCase || "Authenticate and call all core endpoints.", 
        language,
        requiresSubscription
      );
      setActiveIntegration(integration);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to start documentation analysis.");
      setShowErrorModal(true);
      setSubmitting(false);
    }
  };

  // Determine active steps for the visual progress stepper
  const getStepStatus = (stepIndex: number) => {
    if (!activeIntegration) return "pending";
    const status = activeIntegration.status.toLowerCase();
    const progress = activeIntegration.progress;

    if (activeIntegration.status === "completed") return "completed";
    if (activeIntegration.status === "failed") return "failed";

    switch (stepIndex) {
      case 1: // Crawling
        if (progress > 5 && progress < 40) return "active";
        if (progress >= 40) return "completed";
        return "pending";
      case 2: // Vectorizing
        if (progress >= 40 && progress < 70) return "active";
        if (progress >= 70) return "completed";
        return "pending";
      case 3: // Analyzing schemas
        if (progress >= 70 && progress < 88) return "active";
        if (progress >= 88) return "completed";
        return "pending";
      case 4: // Generating Wrapper
        if (progress >= 88 && progress < 100) return "active";
        if (progress === 100) return "completed";
        return "pending";
      default:
        return "pending";
    }
  };

  const getStepIcon = (stepIndex: number, status: string) => {
    if (status === "completed") {
      return <CheckCircle2 className="h-5 w-5 text-emerald-400 fill-emerald-500/10 shrink-0" />;
    }
    if (status === "active") {
      return <Loader2 className="h-5 w-5 text-indigo-400 animate-spin shrink-0" />;
    }
    if (status === "failed") {
      return <AlertCircle className="h-5 w-5 text-rose-500 shrink-0" />;
    }
    
    switch (stepIndex) {
      case 1: return <Globe className="h-5 w-5 text-slate-500 shrink-0" />;
      case 2: return <Layers className="h-5 w-5 text-slate-500 shrink-0" />;
      case 3: return <ShieldCheck className="h-5 w-5 text-slate-500 shrink-0" />;
      case 4: return <Code2 className="h-5 w-5 text-slate-500 shrink-0" />;
      default: return null;
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto w-full space-y-8 animate-in fade-in duration-300">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-white">New API Integration</h1>
        <p className="text-sm text-slate-400 mt-1">Crawl new API portals and synthesize custom SDK structures.</p>
      </div>

      {error && (
        <div className="p-4.5 rounded-xl border border-rose-500/20 bg-rose-950/10 text-rose-400 text-sm flex gap-3 items-center">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <div>
            <span className="font-semibold block">Error Encountered</span>
            {error}
          </div>
        </div>
      )}

      {!activeIntegration ? (
        <form onSubmit={handleSubmit}>
          <Card className="bg-[#0c0d16] border-[#1f202e] rounded-2xl shadow-xl shadow-indigo-950/5">
            <CardHeader className="pb-6">
              <CardTitle className="text-white text-lg font-bold flex items-center gap-2">
                <Cpu className="h-5 w-5 text-indigo-400" />
                API Analysis Request
              </CardTitle>
              <CardDescription className="text-xs text-slate-400">
                Provide documentation URLs and describe the use cases you want to build.
              </CardDescription>
            </CardHeader>
            
            <CardContent className="space-y-6">
              {/* URL */}
              <div className="space-y-2">
                <Label htmlFor="url" className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Documentation Base URL
                </Label>
                <div className="relative">
                  <Globe className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-500" />
                  <Input
                    id="url"
                    type="url"
                    placeholder="https://docs.stripe.com/api"
                    required
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    className="pl-10 h-11 bg-[#10111a] border-[#1f202e] text-sm rounded-xl focus-visible:ring-indigo-600 focus-visible:ring-offset-0 text-slate-200 placeholder:text-slate-600"
                  />
                </div>
              </div>

              {/* Use Case */}
              <div className="space-y-2">
                <Label htmlFor="usecase" className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Describe your Use Case
                </Label>
                <Textarea
                  id="usecase"
                  placeholder="I want to create customers, charges, and refunds. Extract only relevant endpoints and parameters."
                  rows={4}
                  value={useCase}
                  onChange={(e) => setUseCase(e.target.value)}
                  className="bg-[#10111a] border-[#1f202e] text-sm rounded-xl focus-visible:ring-indigo-600 focus-visible:ring-offset-0 text-slate-200 placeholder:text-slate-600 resize-none leading-relaxed"
                />
              </div>
              
              {/* Subscription Toggle */}
              <div className="flex items-center space-x-3 p-3.5 rounded-xl border border-[#1f202e] bg-[#10111a]">
                <input
                  id="requires-subscription"
                  type="checkbox"
                  checked={requiresSubscription}
                  onChange={(e) => setRequiresSubscription(e.target.checked)}
                  className="h-4.5 w-4.5 rounded border-[#1f202e] bg-[#0c0d16] text-indigo-600 focus:ring-indigo-600 focus:ring-offset-0 cursor-pointer"
                />
                <div className="space-y-0.5">
                  <Label htmlFor="requires-subscription" className="text-xs font-bold text-slate-200 cursor-pointer">
                    Requires API Subscription / Paid Plan
                  </Label>
                  <p className="text-[10px] text-slate-500">
                    If this API requires a paid plan or active developer billing, this option triggers key reminder alerts.
                  </p>
                </div>
              </div>

              {/* Languages cards grid */}
              <div className="space-y-3">
                <Label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                  Preferred Language
                </Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {LANGUAGES.map((lang) => {
                    const isSelected = language === lang.id;
                    return (
                      <button
                        key={lang.id}
                        type="button"
                        onClick={() => setLanguage(lang.id)}
                        className={`p-3.5 rounded-xl border text-left flex items-start gap-3 transition-all ${
                          isSelected
                            ? "bg-indigo-600/10 border-indigo-500 text-white shadow-md shadow-indigo-500/5"
                            : "bg-[#10111a] border-[#1f202e] text-slate-400 hover:border-slate-800 hover:text-slate-200"
                        }`}
                      >
                        <Terminal className={`h-4.5 w-4.5 shrink-0 mt-0.5 ${isSelected ? "text-indigo-400" : "text-slate-500"}`} />
                        <div>
                          <span className="text-xs font-bold block">{lang.name}</span>
                          <span className="text-[10px] text-slate-500 block leading-tight mt-0.5">{lang.desc}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </CardContent>
            
            <CardFooter className="pt-6 border-t border-[#131420] flex justify-end">
              <Button 
                type="submit" 
                disabled={submitting}
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold flex items-center gap-2 rounded-xl px-6 py-2.5 shadow-lg shadow-indigo-600/20"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Initializing Scraper...
                  </>
                ) : (
                  <>
                    Run API Integration
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            </CardFooter>
          </Card>
        </form>
      ) : (
        <Card className="bg-[#0c0d16] border-[#1f202e] rounded-2xl shadow-xl p-6 space-y-8">
          <div className="flex justify-between items-center pb-4 border-b border-[#131420]">
            <div>
              <h2 className="text-md font-bold text-white flex items-center gap-2">
                <Sparkles className="h-4.5 w-4.5 text-indigo-400 animate-pulse" />
                Integration Crawler Active
              </h2>
              <span className="text-[11px] text-slate-400 font-mono mt-0.5 block">{activeIntegration.url}</span>
            </div>
            <span className="text-xs font-mono font-bold text-indigo-400 bg-indigo-500/5 border border-indigo-500/10 px-2.5 py-0.5 rounded">
              ID: {activeIntegration.id}
            </span>
          </div>

          {/* Stepper container */}
          <div className="space-y-6">
            {/* Step 1 */}
            <div className="flex gap-4 items-start">
              <div className="mt-0.5">{getStepIcon(1, getStepStatus(1))}</div>
              <div>
                <h4 className={`text-xs font-bold ${getStepStatus(1) === "pending" ? "text-slate-500" : "text-white"}`}>
                  1. Crawling API Documentation Pages
                </h4>
                <p className="text-[11px] text-slate-500 leading-normal mt-0.5">
                  Playwright is downloading and parser-cleaning sub-links sharing base hierarchy routes.
                </p>
              </div>
            </div>

            {/* Step 2 */}
            <div className="flex gap-4 items-start">
              <div className="mt-0.5">{getStepIcon(2, getStepStatus(2))}</div>
              <div>
                <h4 className={`text-xs font-bold ${getStepStatus(2) === "pending" ? "text-slate-500" : "text-white"}`}>
                  2. Document Chunking & Vectorizing (ChromaDB)
                </h4>
                <p className="text-[11px] text-slate-500 leading-normal mt-0.5">
                  Text splitting documents and generating vector index schemas for context retrieval.
                </p>
              </div>
            </div>

            {/* Step 3 */}
            <div className="flex gap-4 items-start">
              <div className="mt-0.5">{getStepIcon(3, getStepStatus(3))}</div>
              <div>
                <h4 className={`text-xs font-bold ${getStepStatus(3) === "pending" ? "text-slate-500" : "text-white"}`}>
                  3. Structuring Endpoints & SDK Detection
                </h4>
                <p className="text-[11px] text-slate-500 leading-normal mt-0.5">
                  Parsing request schemas, authentication tokens, and checking package repositories.
                </p>
              </div>
            </div>

            {/* Step 4 */}
            <div className="flex gap-4 items-start">
              <div className="mt-0.5">{getStepIcon(4, getStepStatus(4))}</div>
              <div>
                <h4 className={`text-xs font-bold ${getStepStatus(4) === "pending" ? "text-slate-500" : "text-white"}`}>
                  4. Synthesizing Wrapper Class
                </h4>
                <p className="text-[11px] text-slate-500 leading-normal mt-0.5">
                  Generating final code wrappers with robust error retry classes in target languages.
                </p>
              </div>
            </div>
          </div>

          {/* Progress bar info */}
          <div className="space-y-2 pt-4 border-t border-[#131420]">
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-400 font-medium animate-pulse">{activeIntegration.status}...</span>
              <span className="font-bold text-slate-200">{activeIntegration.progress}%</span>
            </div>
            <Progress value={activeIntegration.progress} className="h-2 bg-[#141520] [&>div]:bg-indigo-500" />
          </div>

          {activeIntegration.status === "completed" && (
            <div className="flex justify-end pt-4 animate-in zoom-in-95 duration-300">
              <Button 
                onClick={() => router.push(`/code/${activeIntegration.id}`)}
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold flex items-center gap-1.5 rounded-xl px-5 py-2.5 shadow-lg shadow-indigo-600/15"
              >
                Go to Generated Code
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </Card>
      )}

      {showErrorModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-300">
          <Card className="max-w-md w-full mx-4 bg-[#0c0d16]/95 border border-rose-500/30 shadow-2xl shadow-rose-950/10 rounded-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <CardHeader className="pb-4 pt-6 border-b border-rose-500/10 bg-rose-500/5">
              <CardTitle className="text-white text-md font-bold flex items-center gap-2.5">
                <AlertCircle className="h-5.5 w-5.5 text-rose-400 animate-bounce" />
                API Unreachable Alert
              </CardTitle>
              <CardDescription className="text-xs text-rose-200/60 mt-0.5">
                Smart DevTool could not download the documentation.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-4 text-xs text-slate-300 leading-relaxed">
              <p>
                The scraper encountered a network blockade while attempting to access:
                <strong className="block mt-1 font-mono text-slate-200 bg-[#10111a] border border-[#1f202e] p-2.5 rounded-lg text-[10px] break-all">{url}</strong>
              </p>
              
              <div className="p-3.5 rounded-xl bg-rose-500/5 border border-rose-500/10 text-[11px] text-rose-300 flex flex-col gap-1.5">
                <span className="font-bold flex items-center gap-1.5">
                  <Info className="h-4 w-4 shrink-0" />
                  Diagnostic Message:
                </span>
                <p className="font-mono bg-black/25 p-2 rounded text-[10px] leading-normal">{error}</p>
              </div>

              <div className="space-y-1.5">
                <span className="font-semibold text-slate-200 block">Common Troubleshooting Steps:</span>
                <ul className="list-disc pl-4 space-y-1 text-slate-400 text-[11px]">
                  <li>Verify that the URL exists and is typed correctly.</li>
                  <li>Check if the site requires a login, VPN, or custom credentials.</li>
                  <li>Many websites (like Cloudflare, AWS WAF, etc.) block automated scrapers. Try a public mirror or check your site's access rules.</li>
                </ul>
              </div>
            </CardContent>
            <CardFooter className="p-4 border-t border-[#131420] flex justify-end">
              <Button 
                onClick={() => setShowErrorModal(false)}
                className="bg-rose-600 hover:bg-rose-550 text-white font-semibold rounded-xl text-xs px-5 py-2"
              >
                Acknowledge & Dismiss
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}
    </div>
  );
}
