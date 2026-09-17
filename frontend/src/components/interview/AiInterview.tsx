"use client";
import React, { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import io, { Socket } from "socket.io-client";
import Cookies from "js-cookie";
import { Mic, MicOff, PhoneOff, Send, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import toast from "react-hot-toast";
import { BACKEND_URL } from "@/lib/config";
import MarkdownText from "@/components/markdown-text";



interface AiInterviewProps {
  applicationId: number;
}

export default function AiInterview({ applicationId }: AiInterviewProps) {
  const router = useRouter();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [status, setStatus] = useState<"connecting" | "ready" | "listening" | "ai-speaking" | "processing" | "completed" | "error">("connecting");
  const [transcript, setTranscript] = useState<{ role: string; text: string }[]>([]);
  const [isMicEnabled, setIsMicEnabled] = useState(false);
  const isMicEnabledRef = useRef(isMicEnabled);
  
  // Single input state for both typing and dictation
  const [inputText, setInputText] = useState("");
  const [interimText, setInterimText] = useState("");
  const [showConfirmSubmit, setShowConfirmSubmit] = useState(false);
  
  const [streamingMessage, setStreamingMessage] = useState("");
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const statusRef = useRef(status);
  const socketRef = useRef<Socket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [transcript, streamingMessage, interimText]);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    isMicEnabledRef.current = isMicEnabled;
  }, [isMicEnabled]);
  
  useEffect(() => {
    // Check Speech APIs
    if (typeof window !== "undefined") {
      synthRef.current = window.speechSynthesis;
      const SpeechRecognition =
        window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognitionRef.current = recognition;
        recognition.continuous = true;
        recognition.interimResults = true;

        recognition.onresult = (event) => {
          let interimTranscript = '';
          let finalTranscript = '';

          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              finalTranscript += event.results[i][0].transcript;
            } else {
              interimTranscript += event.results[i][0].transcript;
            }
          }

          setInterimText(interimTranscript);

          if (finalTranscript) {
             setInputText(prev => (prev ? prev + " " : "") + finalTranscript);
          }
        };

        recognition.onend = () => {
          if (statusRef.current === "listening") {
            setTimeout(() => {
              try {
                if (statusRef.current === "listening") {
                  recognitionRef.current?.start();
                }
              } catch (err) {
                console.error("Failed to restart recognition", err);
              }
            }, 300);
          }
        };

        recognition.onerror = (event) => {
          console.error("Speech recognition error:", event.error);
          if (event.error === "not-allowed" || event.error === "audio-capture") {
            toast.error("Microphone access denied or not found. Please check browser settings.");
            setStatus("error");
            setIsMicEnabled(false);
          } else if (event.error === "network") {
            toast.error("Network error occurred with speech recognition.");
            setStatus("error");
            setIsMicEnabled(false);
          } else if (event.error !== "no-speech") {
            console.warn("Ignoring non-fatal speech error:", event.error);
          }
        };
      } else {
        toast.error("Speech Recognition is not supported in your browser. Please use Chrome.");
        setStatus("error");
      }
    }

    const token = Cookies.get("token");
    if (!token) {
      router.push("/login");
      return;
    }

    const newSocket = io(`${BACKEND_URL}/ai-interview`, {
      auth: { token },
    });

    setSocket(newSocket);
    socketRef.current = newSocket;

    newSocket.on("connect", () => {
      console.log("🤖 AI Interview socket connected!");
      newSocket.emit("start-interview", { applicationId });
    });

    newSocket.on("connect_error", (err) => {
      console.error("AI Interview socket connect_error:", err.message);
      toast.error(`Connection error: ${err.message}`);
      setStatus("error");
    });

    newSocket.on("status", () => {
      setStatus("processing");
    });

    newSocket.on("ai-message-chunk", (data: { text: string }) => {
      setStatus("processing");
      setStreamingMessage((prev) => prev + data.text);
    });

    newSocket.on("ai-message-complete", (data: { text: string; isConcluding: boolean }) => {
      setTranscript((prev) => [...prev, { role: "assistant", text: data.text }]);
      setStreamingMessage("");
      speakMessage(data.text, data.isConcluding);
    });

    newSocket.on("interview-completed", () => {
      setStatus("completed");
      toast.success("Interview completed and saved!");
      setTimeout(() => {
         router.push(`/account`);
      }, 3000);
    });

    newSocket.on("error", (err: { message: string }) => {
      toast.error(err.message);
      if (statusRef.current === "processing") {
         startListening(); // Recover from processing state on error
      } else if (statusRef.current !== "listening" && statusRef.current !== "ready") {
         setStatus("error");
      }
    });

    return () => {
      newSocket.disconnect();
      if (synthRef.current) synthRef.current.cancel();
      if (recognitionRef.current) recognitionRef.current.stop();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applicationId, router]);

  const speakMessage = (text: string, isConcluding: boolean) => {
    if (!synthRef.current) return;
    
    synthRef.current.cancel(); 
    
    setStatus("ai-speaking");
    
    setTimeout(() => {
      const utterance = new SpeechSynthesisUtterance(text);
      const voices = synthRef.current?.getVoices() || [];
      const englishVoice = voices.find(v => v.lang.startsWith("en") && v.name.includes("Google")) || voices.find(v => v.lang.startsWith("en"));
      if (englishVoice) utterance.voice = englishVoice;
      
      utterance.rate = 1.0;
      utterance.pitch = 1.0;

      utterance.onend = () => {
        if (!isConcluding) {
          setTimeout(() => {
              setStatus("ready");
              // If mic was left on, restart listening
              if (isMicEnabledRef.current) startListening();
          }, 200);
        } else {
           setStatus("processing");
        }
      };

      synthRef.current?.speak(utterance);
    }, 500);
  };

  const startListening = () => {
    if (recognitionRef.current && isMicEnabledRef.current) {
      try {
        setStatus("listening");
        recognitionRef.current.start();
      } catch (_err) {
        // Recognition might already be started
      }
    } else if (!isMicEnabledRef.current) {
       setStatus("ready");
    }
  };

  const handleManualSubmit = () => {
    const finalAnswer = inputText.trim();
    
    if (!finalAnswer) {
      toast.error("Please provide an answer before submitting.");
      return;
    }
    
    setInputText("");
    setInterimText("");
    handleUserVoiceInput(finalAnswer);
  };

  const handleUserVoiceInput = (text: string) => {
    if (!text.trim()) return;
    
    if (recognitionRef.current) {
        try { recognitionRef.current?.stop(); } catch(_err){}
    }

    setStatus("processing");
    setTranscript((prev) => [...prev, { role: "user", text }]);
    socketRef.current?.emit("user-answer", { text });
  };

  const toggleMic = () => {
    setIsMicEnabled((prev) => {
      const newState = !prev;
      isMicEnabledRef.current = newState;
      if (newState && (status === "ready" || status === "ai-speaking")) {
        startListening();
      } else if (!newState && status === "listening") {
        try { recognitionRef.current?.stop(); } catch(_err){}
        setStatus("ready");
      }
      return newState;
    });
  };

  const endCall = () => {
    if (synthRef.current) synthRef.current.cancel();
    if (recognitionRef.current) {
      try { recognitionRef.current?.stop(); } catch(_err){}
    }
    setStatus("processing");
    socket?.emit("end-interview");
  };

  const confirmSubmit = () => {
    setShowConfirmSubmit(false);
    endCall();
  };

  return (
    <div className="h-[calc(100dvh-65px)] bg-muted flex flex-col">
      {/* Header */}
      <header className="bg-card border-b border-border p-4 flex items-center justify-between z-10 sticky top-0 shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-foreground">AI Screening Interview</h1>
          <p className="text-sm text-muted-foreground capitalize flex items-center gap-2">
            {status === "connecting" && (
              <><Loader2 size={12} className="animate-spin" /> Establishing connection...</>
            )}
            {status === "processing" && (
              <><Loader2 size={12} className="animate-spin" /> AI is thinking...</>
            )}
            {status === "ai-speaking" && (
              <><span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary/70 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span></span> Alex is speaking...</>
            )}
            {status === "listening" && (
              <><span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-success"></span></span> Listening...</>
            )}
            {status === "ready" && "Ready."}
            {status === "completed" && "Interview Finished."}
            {status === "error" && "Error occurred."}
          </p>
        </div>
        <button 
          onClick={() => setShowConfirmSubmit(true)}
          className="bg-primary hover:bg-[var(--primary-hover)] text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 shadow-sm"
        >
          <CheckCircle2 size={16} />
          Submit Interview
        </button>
      </header>

      {/* Chat History */}
      <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {transcript.map((msg, idx) => (
            <div key={idx} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] rounded-2xl px-5 py-3.5 shadow-sm ${
                msg.role === "user" 
                  ? "bg-primary text-primary-foreground rounded-br-none" 
                  : "bg-card text-foreground border border-border rounded-bl-none"
              }`}>
                {msg.role === "user" ? (
                  <p className="leading-relaxed text-sm sm:text-base whitespace-pre-wrap">{msg.text}</p>
                ) : (
                  <MarkdownText content={msg.text} className="text-sm sm:text-base" />
                )}
              </div>
            </div>
          ))}

          {/* Streaming Message Bubble */}
          {streamingMessage && (
            <div className="flex justify-start">
              <div className="max-w-[85%] rounded-2xl px-5 py-3.5 shadow-sm bg-card text-foreground border border-border rounded-bl-none">
                <div className="leading-relaxed text-sm sm:text-base">
                  <MarkdownText content={streamingMessage} className="text-sm sm:text-base" />
                  <span className="animate-pulse ml-1 inline-block bg-primary w-2 h-4 align-middle"></span>
                </div>
              </div>
            </div>
          )}

          {/* Processing Indicator */}
          {status === "processing" && !streamingMessage && (
             <div className="flex justify-start">
              <div className="max-w-[85%] rounded-2xl px-5 py-3.5 shadow-sm bg-card text-foreground border border-border rounded-bl-none flex items-center gap-2">
                 <Loader2 size={16} className="animate-spin text-muted-foreground" />
                 <span className="text-sm text-muted-foreground italic">Alex is typing...</span>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>
      </main>

      {/* Input Area */}
      <footer className="bg-card border-t border-border p-4 shrink-0">
        <div className="max-w-4xl mx-auto">
          
          {/* Interim text display (shows live dictation before it's finalized) */}
          {interimText && (
            <div className="mb-2 px-4 text-sm text-muted-foreground italic">
              {interimText}
            </div>
          )}

          <div className="flex items-center gap-3">
            {/* Mic Button */}
            <button 
              onClick={toggleMic}
              disabled={status === "connecting" || status === "processing" || status === "completed"}
              className={`flex-shrink-0 p-3 rounded-full transition-all border ${
                isMicEnabled 
                  ? "bg-destructive-subtle border-destructive/25 text-destructive-subtle-foreground hover:bg-destructive-subtle" 
                  : "bg-muted border-border text-muted-foreground hover:bg-muted"
              } disabled:opacity-50 disabled:cursor-not-allowed shadow-sm`}
              title={isMicEnabled ? "Stop listening" : "Start listening"}
            >
              {isMicEnabled ? <Mic size={24} className="animate-pulse" /> : <MicOff size={24} />}
            </button>

            {/* Text Input */}
            <div className="flex-1 bg-muted rounded-2xl border border-border focus-within:border-primary/25 focus-within:ring-1 focus-within:ring-ring transition-all shadow-sm flex items-center">
              <textarea
                rows={1}
                placeholder={isMicEnabled ? "Listening... You can also type here." : "Type your answer here..."}
                className="w-full bg-transparent text-foreground placeholder-gray-500 outline-none resize-none px-4 py-3 min-h-[44px] max-h-32 overflow-y-auto"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleManualSubmit();
                  }
                }}
                disabled={status === "connecting" || status === "processing" || status === "completed"}
              />
            </div>

            {/* Send Button */}
            <button 
              onClick={handleManualSubmit}
              disabled={!inputText.trim() || status === "connecting" || status === "processing" || status === "completed"}
              className="flex-shrink-0 p-3 bg-primary hover:bg-[var(--primary-hover)] border border-primary/25 text-primary-foreground rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center shadow-sm"
            >
              <Send size={24} />
            </button>
          </div>
        </div>
      </footer>

      {showConfirmSubmit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card rounded-2xl shadow-xl max-w-md w-full p-6 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 rounded-full bg-warning-subtle flex items-center justify-center shrink-0">
                <AlertTriangle className="text-warning-subtle-foreground" size={24} />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-foreground">Submit Interview?</h3>
                <p className="text-sm text-muted-foreground">This is your only attempt.</p>
              </div>
            </div>
            <p className="text-muted-foreground mb-6">
              Are you sure you want to submit your interview now? You will not be able to retake it later, and your responses will be evaluated.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowConfirmSubmit(false)}
                className="px-4 py-2 rounded-lg text-sm font-medium text-foreground bg-muted hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmSubmit}
                className="px-4 py-2 rounded-lg text-sm font-medium text-primary-foreground bg-primary hover:bg-[var(--primary-hover)] transition-colors shadow-sm"
              >
                Submit Interview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
