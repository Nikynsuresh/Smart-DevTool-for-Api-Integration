"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { 
  Send, 
  Bot, 
  User, 
  ArrowLeft, 
  Loader2, 
  Copy, 
  Check, 
  MessageSquare,
  AlertCircle,
  Code2,
  Cpu
} from "lucide-react";
import { getIntegration, getChatHistory, sendChatMessage, Integration, ChatMessage } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const SUGGESTED_PROMPTS = [
  "How do I authenticate with this API?",
  "Show me the core endpoints and methods.",
  "Give me an example of handling error exceptions.",
];

function getTempId(offset = 0) {
  return Date.now() + offset;
}

export default function ChatPage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  
  const [integration, setIntegration] = useState<Integration | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  // Load chat history & integration details
  useEffect(() => {
    async function loadData() {
      if (!id) return;
      try {
        const [integrationData, chatData] = await Promise.all([
          getIntegration(id),
          getChatHistory(id)
        ]);
        setIntegration(integrationData);
        setMessages(chatData);
      } catch (err) {
        console.error(err);
        setError("Failed to load conversation history.");
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [id]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  const handleSend = async (textToSend: string) => {
    const trimmed = textToSend.trim();
    if (!trimmed || sending) return;

    setSending(true);
    setInputText("");
    
    // Optimistically add user message to list
    const tempUserMsg: ChatMessage = {
      id: getTempId(),
      role: "user",
      content: trimmed,
      created_at: new Date().toISOString()
    };
    setMessages(prev => [...prev, tempUserMsg]);

    try {
      const response = await sendChatMessage(id, trimmed);
      setMessages(prev => {
        // Remove optimistic user message and replace with real DB responses
        return [...prev.filter(m => m.id !== tempUserMsg.id), tempUserMsg, response];
      });
      
      // Reload history to ensure IDs are matching SQLite schema
      const updatedHistory = await getChatHistory(id);
      setMessages(updatedHistory);
    } catch (err) {
      console.error(err);
      // Show warning/error message in chat
      const tempErrorMsg: ChatMessage = {
        id: getTempId(1),
        role: "assistant",
        content: "⚠️ Sorry, I failed to process that request. Please verify that the FastAPI backend is running and active.",
        created_at: new Date().toISOString()
      };
      setMessages(prev => [...prev, tempErrorMsg]);
    } finally {
      setSending(false);
    }
  };

  const handleCopy = (text: string, index: number) => {
    // Strip markdown tags before copy if any
    const cleanText = text.replace(/```[a-zA-Z]*\n/g, "").replace(/```/g, "");
    navigator.clipboard.writeText(cleanText);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  // Helper to render messages with clean formatting for code blocks
  const renderMessageContent = (content: string, msgIndex: number) => {
    const parts = content.split(/(```[a-zA-Z]*\n[\s\S]*?\n```)/g);
    
    return parts.map((part, index) => {
      if (part.startsWith("```")) {
        // Extract language and code
        const lines = part.split("\n");
        const lang = lines[0].replace("```", "").trim();
        const code = lines.slice(1, -1).join("\n");
        
        return (
          <div key={index} className="my-3 rounded-xl border border-[#1b1c2b] bg-[#040508] p-4 relative font-mono text-[11px] leading-relaxed text-indigo-300">
            <div className="absolute top-3 right-3">
              <Button 
                onClick={() => handleCopy(code, msgIndex + index)}
                size="sm" 
                variant="ghost" 
                className="h-7 w-7 p-0 hover:bg-[#12131f] hover:text-white rounded-lg text-slate-500 transition-colors"
              >
                {copiedIndex === msgIndex + index ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
              </Button>
            </div>
            {lang && <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider block mb-2">{lang}</span>}
            <pre className="overflow-x-auto pr-8">{code}</pre>
          </div>
        );
      }
      
      // Basic text rendering
      return (
        <p key={index} className="whitespace-pre-line leading-relaxed text-slate-300 py-1">
          {part.split("\n").map((line, lIdx) => {
            // Render inline bullet points nicely
            if (line.trim().startsWith("- ") || line.trim().startsWith("* ")) {
              return <li key={lIdx} className="ml-4 list-disc mt-0.5">{line.trim().replace(/^[-*]\s*/, "")}</li>;
            }
            return <span key={lIdx} className="block">{line}</span>;
          })}
        </p>
      );
    });
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center space-y-4">
        <Cpu className="h-8 w-8 text-indigo-400 animate-spin" />
        <span className="text-xs text-slate-400 font-medium">Loading assistant context...</span>
      </div>
    );
  }

  if (error || !integration) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center space-y-3">
        <AlertCircle className="h-8 w-8 text-rose-500" />
        <span className="text-sm text-slate-400 font-semibold">{error || "Integration conversation not found."}</span>
        <Button onClick={() => router.push("/dashboard")} className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold">
          Return to Dashboard
        </Button>
      </div>
    );
  }

  const host = new URL(integration.url).hostname;

  return (
    <div className="flex-1 flex flex-col h-screen bg-[#07080b] overflow-hidden">
      {/* Header */}
      <header className="border-b border-[#141520] bg-[#090a10] px-8 py-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <Link href={`/code/${integration.id}`}>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-lg hover:bg-[#12131f] text-slate-400 hover:text-white">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4.5 w-4.5 text-indigo-400" />
              <h1 className="text-sm font-bold text-white tracking-tight">{host} - Assistant</h1>
              <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                RAG Online
              </span>
            </div>
            <span className="text-[10px] text-slate-500 font-mono mt-0.5 block truncate max-w-sm sm:max-w-md">
              Ask implementation queries about this specific integration.
            </span>
          </div>
        </div>
        
        <Button 
          onClick={() => router.push(`/code/${integration.id}`)}
          size="sm" 
          className="bg-[#10111a] hover:bg-[#181926] text-slate-300 hover:text-white border border-[#1f202e] rounded-xl text-[11px] font-semibold gap-1.5 h-8.5"
        >
          <Code2 className="h-3.5 w-3.5 text-indigo-400" />
          View Code
        </Button>
      </header>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto px-6 py-8 space-y-6">
        <div className="max-w-3xl mx-auto space-y-6">
          {messages.length === 0 ? (
            <div className="space-y-8 py-8">
              {/* Welcome box */}
              <div className="text-center space-y-3.5 max-w-md mx-auto">
                <div className="h-11 w-11 rounded-2xl bg-indigo-600/10 border border-indigo-500/25 flex items-center justify-center mx-auto">
                  <Bot className="h-5.5 w-5.5 text-indigo-400" />
                </div>
                <div className="space-y-1.5">
                  <h3 className="text-sm font-bold text-white">API Integration Chatbot</h3>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    This session is grounded in the crawled API documentation database. Ask questions about authentication headers, body formats, or errors.
                  </p>
                </div>
              </div>

              {/* Suggestions Grid */}
              <div className="grid grid-cols-1 gap-3.5 max-w-lg mx-auto">
                {SUGGESTED_PROMPTS.map((prompt, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSend(prompt)}
                    className="p-3.5 rounded-xl border border-[#181926] bg-[#0c0d16]/80 text-left text-xs font-semibold text-slate-300 hover:border-indigo-500/30 hover:text-white hover:bg-[#10111f]/60 transition-all flex justify-between items-center group"
                  >
                    <span>{prompt}</span>
                    <Send className="h-3.5 w-3.5 text-slate-600 group-hover:text-indigo-400 group-hover:translate-x-0.5 transition-all shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {messages.map((msg, index) => {
                const isBot = msg.role === "assistant";
                return (
                  <div 
                    key={msg.id || index} 
                    className={`flex gap-4 p-4.5 rounded-2xl border text-xs leading-relaxed transition-all ${
                      isBot 
                        ? "bg-[#0b0c13]/70 border-[#181926] text-slate-300" 
                        : "bg-indigo-600/5 border-indigo-500/10 text-slate-200"
                    }`}
                  >
                    {/* Icon */}
                    <div className={`h-8 w-8 rounded-xl flex items-center justify-center shrink-0 border ${
                      isBot 
                        ? "bg-indigo-600/10 border-indigo-500/20 text-indigo-400" 
                        : "bg-slate-800 border-slate-700 text-slate-300"
                    }`}>
                      {isBot ? <Bot className="h-4.5 w-4.5" /> : <User className="h-4.5 w-4.5" />}
                    </div>
                    
                    {/* Content */}
                    <div className="flex-1 overflow-hidden space-y-1">
                      <span className="font-bold text-white text-[11px] block">
                        {isBot ? "API Assistant" : "Developer"}
                      </span>
                      <div className="space-y-2">
                        {renderMessageContent(msg.content, index * 10)}
                      </div>
                    </div>
                  </div>
                );
              })}
              
              {/* Sending status loader */}
              {sending && (
                <div className="flex gap-4 p-4.5 rounded-2xl border bg-[#0b0c13]/40 border-[#141520] text-xs text-slate-400 animate-pulse">
                  <div className="h-8 w-8 rounded-xl bg-[#10111a] border border-[#141520] flex items-center justify-center shrink-0">
                    <Loader2 className="h-4.5 w-4.5 text-indigo-500 animate-spin" />
                  </div>
                  <div className="flex-1 py-2 flex items-center gap-2">
                    <span className="font-semibold">Searching vectorized documentation...</span>
                  </div>
                </div>
              )}
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Box Panel */}
      <footer className="border-t border-[#141520] bg-[#090a10] px-8 py-5 shrink-0">
        <div className="max-w-3xl mx-auto">
          <form 
            onSubmit={(e) => {
              e.preventDefault();
              handleSend(inputText);
            }} 
            className="flex gap-3 relative"
          >
            <Input
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Ask anything about this API... (e.g. 'How do I create payments?')"
              disabled={sending}
              className="flex-1 h-12 bg-[#0c0d16] border-[#1f202e] text-sm rounded-xl pl-4 pr-12 focus-visible:ring-indigo-600 focus-visible:ring-offset-0 text-slate-200 placeholder:text-slate-600"
            />
            <Button 
              type="submit" 
              disabled={!inputText.trim() || sending}
              className="absolute right-2 top-2 h-8 w-8 p-0 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg flex items-center justify-center disabled:bg-transparent disabled:text-slate-600"
            >
              <Send className="h-4 w-4" />
            </Button>
          </form>
          <span className="text-[10px] text-slate-600 text-center block mt-2.5">
            Answers are synthesized by checking crawled reference document vectors.
          </span>
        </div>
      </footer>
    </div>
  );
}
