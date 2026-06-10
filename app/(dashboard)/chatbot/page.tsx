"use client"

import { useState, useRef, useEffect } from "react"
import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport, type UIMessage } from "ai"
import {
  Send,
  Paperclip,
  Plus,
  MessageSquare,
  Sparkles,
  MoreVertical,
  Trash2,
  PenLine,
  Menu,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { Card } from "@/components/ui/card"

interface StoredConversation {
  id: string
  title: string
  lastMessage: string
  timestamp: Date
}

const suggestedPrompts = [
  "What is the overall sentiment breakdown from the comments?",
  "What are the top customer complaints and issues mentioned?",
  "Show me examples of positive and negative comments",
  "Which products have the best and worst sentiment?",
]

function formatTime(date: Date): string {
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const minutes = Math.floor(diff / (1000 * 60))
  const hours = Math.floor(diff / (1000 * 60 * 60))
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))

  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  return `${days}d ago`
}

function ConversationSidebar({
  conversations,
  activeId,
  onSelect,
  onNew,
  onDelete,
  isOpen,
  onClose,
}: {
  conversations: StoredConversation[]
  activeId: string
  onSelect: (id: string) => void
  onNew: () => void
  onDelete: (id: string) => void
  isOpen: boolean
  onClose: () => void
}) {
  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      )}
      
      {/* Sidebar */}
      <div className={cn(
        "fixed inset-y-0 left-0 z-50 flex h-full w-72 flex-col border-r border-border/50 bg-card/95 backdrop-blur transition-transform duration-300 lg:relative lg:translate-x-0",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex items-center justify-between border-b border-border/50 p-4">
          <h2 className="font-semibold">Conversations</h2>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={onNew} className="h-8 w-8">
              <Plus className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 lg:hidden">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <ScrollArea className="flex-1 nice-scroll">
          <div className="flex flex-col gap-1 p-2">
            {conversations.map((conv) => (
              <div
                key={conv.id}
                role="button"
                tabIndex={0}
                onClick={() => {
                  onSelect(conv.id)
                  onClose()
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault()
                    onSelect(conv.id)
                    onClose()
                  }
                }}
                className={cn(
                  "group flex w-full cursor-pointer flex-col gap-1 rounded-lg p-3 text-left transition-colors duration-200",
                  activeId === conv.id
                    ? "bg-primary/10 text-foreground"
                    : "hover:bg-muted/60"
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-muted-foreground" />
                    <span className="line-clamp-1 text-sm font-medium">
                      {conv.title}
                    </span>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 opacity-0 group-hover:opacity-100"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MoreVertical className="h-3.5 w-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem>
                        <PenLine className="mr-2 h-4 w-4" />
                        Rename
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        className="text-destructive"
                        onClick={(e) => {
                          e.stopPropagation()
                          onDelete(conv.id)
                        }}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <p className="line-clamp-1 text-xs text-muted-foreground">
                  {conv.lastMessage || "New conversation"}
                </p>
                <span className="text-[10px] text-muted-foreground/60">
                  {formatTime(conv.timestamp)}
                </span>
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>
    </>
  )
}

function getMessageText(message: UIMessage): string {
  if (!message.parts || !Array.isArray(message.parts)) return ""
  return message.parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("")
}

function ChatMessage({ message }: { message: UIMessage }) {
  const isUser = message.role === "user"
  const content = getMessageText(message)

  return (
    <div className="flex gap-3 px-4 py-3 sm:gap-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <Avatar className="h-8 w-8 shrink-0">
        <AvatarFallback
          className={cn(
            "text-xs",
            isUser
              ? "bg-primary text-primary-foreground"
              : "bg-accent text-accent-foreground"
          )}
        >
          {isUser ? "You" : "AI"}
        </AvatarFallback>
      </Avatar>
      <div
        className={cn(
          "min-w-0 flex-1 space-y-2 rounded-2xl px-4 py-3 shadow-sm",
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-muted"
        )}
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">
            {isUser ? "You" : "Samsung AI Assistant"}
          </span>
          {!isUser && (
            <Sparkles className="h-3.5 w-3.5 text-primary" />
          )}
        </div>
        <div className="prose prose-sm dark:prose-invert max-w-none break-words">
          {content.split("\n").map((line, i) => {
            if (line.startsWith("###")) {
              return (
                <h3 key={i} className="mt-4 mb-2 text-base font-semibold">
                  {line.replace("### ", "")}
                </h3>
              )
            }
            if (line.startsWith("##")) {
              return (
                <h2 key={i} className="mt-4 mb-2 text-lg font-semibold">
                  {line.replace("## ", "")}
                </h2>
              )
            }
            if (line.startsWith("**") && line.endsWith("**")) {
              return (
                <p key={i} className="font-semibold">
                  {line.replace(/\*\*/g, "")}
                </p>
              )
            }
            if (line.startsWith("- ") || line.match(/^\d+\./)) {
              return (
                <li key={i} className="ml-4 opacity-90">
                  {line.replace(/^[-\d.]+\s*/, "").replace(/\*\*/g, "")}
                </li>
              )
            }
            if (line.trim() === "") {
              return <br key={i} />
            }
            return (
              <p key={i} className="opacity-90">
                {line.replace(/\*\*/g, "")}
              </p>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function EmptyState({ onPromptClick }: { onPromptClick: (prompt: string) => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 sm:mb-8">
        <Sparkles className="h-8 w-8 text-primary" />
      </div>
      <h2 className="mb-2 text-xl font-semibold sm:text-2xl">Samsung AI Assistant</h2>
      <p className="mb-6 max-w-md text-center text-sm text-muted-foreground sm:mb-8 sm:text-base">
        Ask me anything about customer sentiment, product insights, or market trends across GCC markets.
      </p>
      <div className="grid w-full max-w-2xl gap-2 sm:grid-cols-2 sm:gap-3">
        {suggestedPrompts.map((prompt) => (
          <Card
            key={prompt}
            className="cursor-pointer hover-lift p-3 transition-all hover:border-primary/50 sm:p-4"
            onClick={() => onPromptClick(prompt)}
          >
            <p className="text-xs text-foreground/90 sm:text-sm">{prompt}</p>
          </Card>
        ))}
      </div>
    </div>
  )
}

// Separate component for the chat interface to properly handle useChat
function ChatInterface({ 
  conversationId, 
  onMessageUpdate 
}: { 
  conversationId: string
  onMessageUpdate: (title: string, lastMessage: string) => void 
}) {
  const [input, setInput] = useState("")
  const [error, setError] = useState<string | null>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const onMessageUpdateRef = useRef(onMessageUpdate)
  
  // Keep ref updated
  onMessageUpdateRef.current = onMessageUpdate

  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({ api: "/api/chat" }),
    id: conversationId,
    onError: (err) => {
      setError(err.message || "An error occurred. Please try again.")
    },
  })

  const isLoading = status === "streaming" || status === "submitted"

  // Update parent with message info - use ref to avoid dependency issues
  useEffect(() => {
    if (messages.length > 0) {
      const firstUserMessage = messages.find(m => m.role === "user")
      const lastMessage = messages[messages.length - 1]
      const lastMessageText = getMessageText(lastMessage)
      const title = firstUserMessage 
        ? getMessageText(firstUserMessage).slice(0, 35) + "..."
        : "New Conversation"
      onMessageUpdateRef.current(title, lastMessageText.slice(0, 50) + (lastMessageText.length > 50 ? "..." : ""))
    }
  }, [messages])

  // Scroll to bottom when messages change
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight
    }
  }, [messages])

  const handleSend = async () => {
    if (!input.trim() || isLoading) return
    const message = input.trim()
    setInput("")
    setError(null)
    sendMessage({ text: message })
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handlePromptClick = (prompt: string) => {
    setError(null)
    sendMessage({ text: prompt })
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {messages.length === 0 ? (
        <EmptyState onPromptClick={handlePromptClick} />
      ) : (
        <div ref={scrollContainerRef} className="flex-1 overflow-auto nice-scroll">
          <div className="mx-auto max-w-3xl space-y-1 py-3">
            {messages.map((message) => (
              <ChatMessage key={message.id} message={message} />
            ))}
            {isLoading && (
              <div className="flex gap-3 px-4 py-3 sm:gap-4 animate-in fade-in duration-300">
                <Avatar className="h-8 w-8 shrink-0">
                  <AvatarFallback className="bg-accent text-accent-foreground text-xs">
                    AI
                  </AvatarFallback>
                </Avatar>
                <div className="flex items-center gap-1 rounded-2xl bg-muted px-4 py-3 shadow-sm">
                  <div className="h-2 w-2 animate-bounce rounded-full bg-primary [animation-delay:-0.3s]" />
                  <div className="h-2 w-2 animate-bounce rounded-full bg-primary [animation-delay:-0.15s]" />
                  <div className="h-2 w-2 animate-bounce rounded-full bg-primary" />
                </div>
              </div>
            )}
            {error && (
              <div className="mx-4 my-4 rounded-lg border border-destructive/50 bg-destructive/10 p-4">
                <p className="text-sm text-destructive">{error}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  The AI Gateway requires a valid credit card on your Vercel account, or you can configure a custom API key in the settings.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className="border-t border-border/50 bg-background p-3 sm:p-4">
        <div className="mx-auto max-w-3xl">
          <div className="relative flex items-end gap-2 rounded-xl border border-border/50 bg-card p-2 shadow-sm transition-shadow focus-within:shadow-md focus-within:border-primary/50">
            <Button
              variant="ghost"
              size="icon"
              className="hidden h-9 w-9 shrink-0 text-muted-foreground hover:text-foreground sm:flex"
            >
              <Paperclip className="h-5 w-5" />
            </Button>
            <Textarea
              ref={textareaRef}
              placeholder="Ask about Galaxy S26 sentiment, GCC market insights..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              className="min-h-[40px] max-h-[200px] flex-1 resize-none border-0 bg-transparent p-2 text-sm focus-visible:ring-0 sm:text-base"
            />
            <Button
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              size="icon"
              className="h-9 w-9 shrink-0 rounded-lg"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
          <p className="mt-2 text-center text-[10px] text-muted-foreground sm:text-xs">
            Samsung AI Assistant can make mistakes. Verify important information.
          </p>
        </div>
      </div>
    </div>
  )
}

export default function ChatbotPage() {
  const [conversations, setConversations] = useState<StoredConversation[]>([
    {
      id: "default",
      title: "New Conversation",
      lastMessage: "",
      timestamp: new Date(),
    },
  ])
  const [activeConversationId, setActiveConversationId] = useState("default")
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const activeConversation = conversations.find((c) => c.id === activeConversationId)

  const handleMessageUpdate = (title: string, lastMessage: string) => {
    setConversations((prev) =>
      prev.map((conv) =>
        conv.id === activeConversationId
          ? {
              ...conv,
              title: conv.title === "New Conversation" ? title : conv.title,
              lastMessage,
              timestamp: new Date(),
            }
          : conv
      )
    )
  }

  const handleNewConversation = () => {
    const newConv: StoredConversation = {
      id: Date.now().toString(),
      title: "New Conversation",
      lastMessage: "",
      timestamp: new Date(),
    }
    setConversations([newConv, ...conversations])
    setActiveConversationId(newConv.id)
  }

  const handleDeleteConversation = (id: string) => {
    if (conversations.length === 1) {
      setConversations([{
        id: Date.now().toString(),
        title: "New Conversation",
        lastMessage: "",
        timestamp: new Date(),
      }])
      setActiveConversationId(conversations[0].id)
    } else {
      const newConversations = conversations.filter((c) => c.id !== id)
      setConversations(newConversations)
      if (activeConversationId === id) {
        setActiveConversationId(newConversations[0].id)
      }
    }
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden">
      <ConversationSidebar
        conversations={conversations}
        activeId={activeConversationId}
        onSelect={setActiveConversationId}
        onNew={handleNewConversation}
        onDelete={handleDeleteConversation}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="flex flex-1 flex-col">
        {/* Mobile header */}
        <div className="flex items-center gap-3 border-b border-border/50 p-3 lg:hidden">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(true)}
            className="h-8 w-8"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <span className="text-sm font-medium truncate">{activeConversation?.title}</span>
        </div>

        {/* Chat interface with key to force remount on conversation change */}
        <ChatInterface 
          key={activeConversationId}
          conversationId={activeConversationId}
          onMessageUpdate={handleMessageUpdate}
        />
      </div>
    </div>
  )
}
