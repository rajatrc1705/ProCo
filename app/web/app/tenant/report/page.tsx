"use client";

import { Suspense, useState, useRef, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ChatMessage, type Message } from "@/components/chat/chat-message";
import { ChatInput } from "@/components/chat/chat-input";
import { TypingIndicator } from "@/components/chat/typing-indicator";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { 
  MessageSquare, 
  CheckCircle, 
  Home, 
  History, 
  Plus, 
  Building2, 
  ChevronLeft,
  Menu,
  X
} from "lucide-react";
import { fetchIssueMessages, fetchIssues, postChat } from "@/lib/api";
import { useActiveTenant } from "@/lib/tenant";

interface ChatSession {
  id: string;
  title: string;
  date: string;
  preview: string;
}

function TenantReportContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { tenantId, propertyId } = useActiveTenant();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [activeChat, setActiveChat] = useState<string>("new");
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "initial",
      content:
        "Hello! I'm ProCo, your AI property assistant. I'm here to help you report any maintenance issues you're experiencing. What seems to be the problem?",
      role: "assistant",
      timestamp: new Date(),
    },
  ]);
  const [isTyping, setIsTyping] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [issueId, setIssueId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping, scrollToBottom]);

  useEffect(() => {
    const chatId = searchParams.get("chat");
    if (!chatId) return;

    setActiveChat(chatId);
    setIsSubmitted(true);
    setIssueId(chatId);

    fetchIssueMessages(chatId)
      .then((apiMessages) => {
        const mapped = apiMessages.map((message) => ({
          id: message.id,
          content: message.content,
          imageBase64: message.image_base64 ?? null,
          role:
            message.role === "user"
              ? "user"
              : message.role === "landlord"
                ? "landlord"
                : "assistant",
          timestamp: new Date(message.created_at),
        }));
        if (mapped.length > 0) {
          setMessages(mapped);
        }
      })
      .catch((error) => {
        console.error(error);
      });
  }, [searchParams]);

  useEffect(() => {
    if (!tenantId) return;

    fetchIssues()
      .then((issues) => {
        const filtered = issues
          .filter((issue) => issue.tenant_id === tenantId)
          .filter((issue) => (!propertyId ? true : issue.property_id === propertyId))
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

        const sessions: ChatSession[] = filtered.map((issue) => ({
          id: issue.id,
          title: issue.summary || "Maintenance Issue",
          date: new Date(issue.created_at).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          }),
          preview: issue.description || "Tap to view conversation",
        }));
        setChatSessions(sessions);
      })
      .catch((error) => {
        console.error(error);
      });
  }, [tenantId, propertyId]);

  const handleSendMessage = async (content: string, imageBase64?: string | null) => {
    if (isSubmitted || isTyping) return;
    if (!tenantId) {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          content: "Missing tenant ID. Set NEXT_PUBLIC_DEMO_TENANT_ID to continue.",
          role: "assistant",
          timestamp: new Date(),
        },
      ]);
      return;
    }

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      content,
      imageBase64: imageBase64 ?? null,
      role: "user",
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsTyping(true);

    try {
      const response = await postChat({
        tenant_id: tenantId,
        message: content,
        image_base64: imageBase64 ?? null,
        issue_id: issueId,
        property_id: propertyId ?? null,
      });

      const aiMessage: Message = {
        id: `ai-${Date.now()}`,
        content: response.response,
        role: "assistant",
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, aiMessage]);
      setIsTyping(false);

      if (response.issue_id) {
        setIssueId(response.issue_id);
      }
      if (response.issue_created) {
        setIsSubmitted(true);
      }
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          content: "Sorry, I couldn't reach the server. Please try again.",
          role: "assistant",
          timestamp: new Date(),
        },
      ]);
      setIsTyping(false);
    }
  };

  const handleNewChat = () => {
    setActiveChat("new");
    setMessages([
      {
        id: "initial-new",
        content:
          "Hello! I'm ProCo, your AI property assistant. I'm here to help you report any maintenance issues you're experiencing. What seems to be the problem?",
        role: "assistant",
        timestamp: new Date(),
      },
    ]);
    setIsSubmitted(false);
    setIssueId(null);
    setMobileSidebarOpen(false);
  };

  const handleSelectChat = (chatId: string) => {
    setActiveChat(chatId);
    setIssueId(chatId);
    setIsSubmitted(true);

    fetchIssueMessages(chatId)
      .then((apiMessages) => {
        const mapped = apiMessages.map((message) => ({
          id: message.id,
          content: message.content,
          imageBase64: message.image_base64 ?? null,
          role:
            message.role === "user"
              ? "user"
              : message.role === "landlord"
                ? "landlord"
                : "assistant",
          timestamp: new Date(message.created_at),
        }));
        if (mapped.length > 0) {
          setMessages(mapped);
        }
      })
      .catch((error) => {
        console.error(error);
      });
    setMobileSidebarOpen(false);
  };

  return (
    <div className="flex h-screen bg-background">
      {/* Mobile Sidebar Overlay */}
      {mobileSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed lg:static inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-border bg-card transition-transform lg:translate-x-0",
          mobileSidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Sidebar Header */}
        <div className="flex h-14 items-center justify-between border-b border-border px-4">
          <Link href="/" className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            <span className="font-semibold text-foreground">ProCo</span>
          </Link>
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setMobileSidebarOpen(false)}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* New Chat Button */}
        <div className="p-3">
          <Button
            onClick={handleNewChat}
            className="w-full justify-start gap-2"
            variant={activeChat === "new" ? "default" : "outline"}
          >
            <Plus className="h-4 w-4" />
            New Chat
          </Button>
        </div>

        {/* Chat History */}
        <ScrollArea className="flex-1 px-3">
          <div className="space-y-1 pb-4">
            <p className="px-2 py-2 text-xs font-medium text-muted-foreground">Recent Chats</p>
            {chatSessions.map((chat) => (
              <button
                type="button"
                key={chat.id}
                onClick={() => handleSelectChat(chat.id)}
                className={cn(
                  "w-full rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-muted",
                  activeChat === chat.id && "bg-muted"
                )}
              >
                <div className="flex items-start gap-2">
                  <MessageSquare className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">{chat.title}</p>
                    <p className="text-xs text-muted-foreground">{chat.date}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </ScrollArea>

        {/* Back to Home */}
        <div className="border-t border-border p-3">
          <Button
            variant="ghost"
            asChild
            className="w-full justify-start gap-2"
          >
            <Link href="/tenant">
              <ChevronLeft className="h-4 w-4" />
              Back to Home
            </Link>
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Header */}
        <header className="flex h-14 items-center gap-4 border-b border-border bg-card px-4">
          {/* Back to Home Button - Always visible on upper left */}
          <Button
            variant="ghost"
            size="sm"
            asChild
            className="gap-1 hidden lg:flex"
          >
            <Link href="/tenant">
              <ChevronLeft className="h-4 w-4" />
              Back to Home
            </Link>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setMobileSidebarOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2 lg:ml-auto lg:mr-auto">
            <MessageSquare className="h-5 w-5 text-primary" />
            <h1 className="font-semibold text-foreground">
              {activeChat === "new"
                ? "New Issue Report"
                : chatSessions.find((c) => c.id === activeChat)?.title || "Chat"}
            </h1>
          </div>
          {/* Spacer for centering on desktop */}
          <div className="hidden lg:block w-[120px]" />
        </header>

        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-3xl">
            {messages.map((message) => (
              <ChatMessage key={message.id} message={message} />
            ))}
            {isTyping && <TypingIndicator />}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Success Banner */}
        {isSubmitted && activeChat === "new" && (
          <div className="mx-auto max-w-3xl px-4 py-4">
            <Card className="border-success/20 bg-success/5">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-success text-success-foreground">
                    <CheckCircle className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-foreground">
                      Issue Submitted Successfully
                    </h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Your maintenance request has been submitted and your landlord will review it shortly.
                    </p>
                    <div className="flex flex-wrap gap-3 mt-4">
                      <Button onClick={handleNewChat} variant="outline" className="gap-2 bg-transparent">
                        <MessageSquare className="h-4 w-4" />
                        Report Another
                      </Button>
                      <Button onClick={() => router.push("/tenant")} variant="outline" className="gap-2 bg-transparent">
                        <Home className="h-4 w-4" />
                        Go to Home
                      </Button>
                      <Button onClick={() => router.push("/tenant/history")} className="gap-2">
                        <History className="h-4 w-4" />
                        View History
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Input Area */}
        <div className="border-t border-border bg-background">
          <div className="mx-auto max-w-3xl">
            <ChatInput
              onSend={handleSendMessage}
              disabled={isTyping || isSubmitted}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function TenantReportPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center text-muted-foreground">
          Loading...
        </div>
      }
    >
      <TenantReportContent />
    </Suspense>
  );
}
