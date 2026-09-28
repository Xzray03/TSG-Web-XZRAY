"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { FaUser } from "react-icons/fa";
import {
  MessageCircle,
  Search,
  Send,
  Loader2,
  X,
  Lock,
  UserPlus,
  ShieldCheck,
  RefreshCw,
  Globe,
  Plus,
  Paperclip,
  Link as LinkIcon,
  Image as ImageIcon,
  Film,
  Music,
  FileText,
  Archive,
  ExternalLink,
  Upload,
} from "lucide-react";
import { getPublicAccountAction } from "@/actions/publicAccountActions";
import {
  getConversationsAction,
  getChatMessagesAction,
  sendChatMessageAction,
  searchUsersAction,
} from "@/actions/chatActions";
import { uploadSocialFilesAction } from "@/actions/socialActions";
import { encryptChatMessage, decryptChatMessage } from "@/lib/e2ee";
import { detectFileType } from "@/lib/fileTypeDetector";
import { SocialMediaRenderer } from "@/components/social/SocialMediaRenderer";
import { PublicProfilePreviewModal } from "@/components/auth/PublicProfilePreviewModal";
import { useScrollLock } from "@/hooks/useScrollLock";
import { TsgVerificationCard } from "@/components/chat/TsgVerificationCard";

const VIRTUAL_ID = "00000000-0000-0000-0000-000000000001";
const MAX_FILES = 10;
const MAX_TOTAL_SIZE = 100 * 1024 * 1024; // 100MB

function formatLastMessagePreview(rawText: string): string {
  if (!rawText) return "...";
  try {
    const trimmed = rawText.trim();
    if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
      const parsed = JSON.parse(trimmed);
      if (parsed.type === "chat_media_message") {
        return parsed.text || "📎 [Lampiran Media]";
      }
      if (parsed.type === "tsg_verification_request") {
        return `Permohonan Pendaftaran Anggota: ${parsed.name || ""}`;
      }
      if (parsed.text) {
        return parsed.text;
      }
    }
  } catch (e) {}
  return rawText;
}

export function ChatPageClient() {
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [publicAccount, setPublicAccount] = useState<any>(null);

  const [conversations, setConversations] = useState<any[]>([]);
  const [isLoadingConvs, setIsLoadingConvs] = useState(true);
  const [selectedConv, setSelectedConv] = useState<any>(null);

  const [messages, setMessages] = useState<any[]>([]);
  const [decryptedMessages, setDecryptedMessages] = useState<Record<string, string>>({});
  const [isLoadingMsgs, setIsLoadingMsgs] = useState(false);

  const [inputMessage, setInputMessage] = useState("");
  const [isSending, setIsSubmitting] = useState(false);

  // Attachment & Link state for chat
  const [chatFiles, setChatFiles] = useState<
    { file: File; previewUrl?: string; detected: any }[]
  >([]);
  const [chatLinkUrl, setChatLinkUrl] = useState("");
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [tempLinkUrl, setTempLinkUrl] = useState("");

  // Search User Modal state
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Profile Preview Modal
  const [previewProfile, setPreviewProfile] = useState<any>(null);

  // Image viewer state
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const closeViewer = () => setViewerUrl(null);
  useEffect(() => {
    if (!viewerUrl) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeViewer();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [viewerUrl]);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatFileInputRef = useRef<HTMLInputElement>(null);

  useScrollLock(isSearchModalOpen || !!previewProfile || showLinkModal || !!viewerUrl);

  useEffect(() => {
    async function verifyAuthAndLoad() {
      try {
        const saved = localStorage.getItem("tsg_user_profile");
        if (!saved) {
          router.replace("/");
          return;
        }
        const parsed = JSON.parse(saved);
        if (!parsed || !parsed.name || !parsed.id) {
          router.replace("/");
          return;
        }
        setProfile(parsed);

        const res: any = await getPublicAccountAction(parsed.id);
        if (!res || !res.publicAccount || !res.publicAccount.nickname) {
          router.replace("/");
          return;
        }
        setPublicAccount(res.publicAccount);

        await loadConversations(parsed.id);
      } catch (e) {
        router.replace("/");
      }
    }
    verifyAuthAndLoad();
  }, [router]);

  // Polling conversations & current active chat
  useEffect(() => {
    if (!profile?.id) return;

    const interval = setInterval(async () => {
      await loadConversations(profile.id, true);
      if (selectedConv?.id) {
        await loadMessages(selectedConv.id, profile.id, selectedConv.otherUser.id, true);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [profile?.id, selectedConv?.id]);

  const loadConversations = async (userId: string, silent = false) => {
    if (!silent) setIsLoadingConvs(true);
    try {
      const res: any = await getConversationsAction(userId);
      if (res && res.conversations) {
        setConversations(res.conversations);

        const decMap: Record<string, string> = {};
        for (const c of res.conversations) {
          if (c.last_message) {
            const dec = await decryptChatMessage(c.last_message, userId, c.otherUser.id);
            decMap[c.id] = formatLastMessagePreview(dec);
          }
        }
        setDecryptedMessages((prev) => ({ ...prev, ...decMap }));
      }
    } catch (e) {
    } finally {
      if (!silent) setIsLoadingConvs(false);
    }
  };

  const loadMessages = async (
    convId: string,
    currentUserId: string,
    otherUserId: string,
    silent = false
  ) => {
    if (!silent) setIsLoadingMsgs(true);
    try {
      const res: any = await getChatMessagesAction(convId);
      if (res && res.messages) {
        setMessages(res.messages);

        const decMap: Record<string, string> = {};
        for (const m of res.messages) {
          decMap[m.id] = await decryptChatMessage(m.content, currentUserId, otherUserId);
        }
        setDecryptedMessages((prev) => ({ ...prev, ...decMap }));

        if (!silent) {
          setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
        }
      }
    } catch (e) {
    } finally {
      if (!silent) setIsLoadingMsgs(false);
    }
  };

  const handleSelectConversation = (conv: any) => {
    setSelectedConv(conv);
    setChatFiles([]);
    setChatLinkUrl("");
    loadMessages(conv.id, profile.id, conv.otherUser.id);
  };

  const isVirtualTsg =
    selectedConv?.otherUser?.id === VIRTUAL_ID ||
    selectedConv?.otherUser?.is_virtual === true ||
    selectedConv?.otherUser?.nickname === "tsg_official";

  const processChatFiles = async (newFilesArray: File[]) => {
    if (isVirtualTsg) return;
    if (!newFilesArray || newFilesArray.length === 0) return;

    if (chatFiles.length + newFilesArray.length > MAX_FILES) {
      alert(`Maksimal ${MAX_FILES} file per pesan.`);
      return;
    }

    let currentTotalSize = chatFiles.reduce((acc, curr) => acc + curr.file.size, 0);
    for (const f of newFilesArray) {
      currentTotalSize += f.size;
    }

    if (currentTotalSize > MAX_TOTAL_SIZE) {
      alert("Total ukuran file melebihi batas maksimal 100MB.");
      return;
    }

    const processed: { file: File; previewUrl?: string; detected: any }[] = [];
    for (const file of newFilesArray) {
      const detected = await detectFileType(file);
      let previewUrl: string | undefined = undefined;
      if (detected.category === "image" || detected.category === "audio") {
        previewUrl = URL.createObjectURL(file);
      }
      processed.push({ file, previewUrl, detected });
    }

    setChatFiles((prev) => [...prev, ...processed]);
  };

  const handleChatFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      await processChatFiles(Array.from(files));
    }
    e.target.value = "";
  };

  const handleRemoveChatFile = (index: number) => {
    setChatFiles((prev) => {
      const target = prev[index];
      if (target?.previewUrl) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!inputMessage.trim() && chatFiles.length === 0 && !chatLinkUrl.trim()) || !profile?.id || !selectedConv?.otherUser?.id) {
      return;
    }

    const text = inputMessage.trim();
    setInputMessage("");
    setIsSubmitting(true);
    setShowAttachmentMenu(false);

    try {
      let attachments: any[] = [];

      if (!isVirtualTsg && chatFiles.length > 0) {
        const formData = new FormData();
        chatFiles.forEach((item) => {
          formData.append("files", item.file, item.file.name);
        });

        const uploadRes: any = await uploadSocialFilesAction(formData);
        if (uploadRes?.error) {
          alert(uploadRes.error);
          setIsSubmitting(false);
          return;
        }

        attachments = (uploadRes.files || []).map((f: any, i: number) => ({
          ...f,
          type: chatFiles[i]?.detected.category || "other",
        }));
      }

      let finalContent = text;
      if (!isVirtualTsg && (attachments.length > 0 || chatLinkUrl.trim())) {
        finalContent = JSON.stringify({
          type: "chat_media_message",
          text: text || "(Lampiran media)",
          linkUrl: chatLinkUrl.trim() || undefined,
          attachments,
        });
      }

      const encrypted = await encryptChatMessage(
        finalContent,
        profile.id,
        selectedConv.otherUser.id
      );

      const res: any = await sendChatMessageAction({
        conversationId: selectedConv.id,
        senderId: profile.id,
        recipientId: selectedConv.otherUser.id,
        encryptedContent: encrypted,
      });

      if (res?.success) {
        if (!selectedConv.id) {
          setSelectedConv((prev: any) => ({ ...prev, id: res.conversationId }));
        }
        chatFiles.forEach((f) => f.previewUrl && URL.revokeObjectURL(f.previewUrl));
        setChatFiles([]);
        setChatLinkUrl("");
        await loadMessages(res.conversationId || selectedConv.id, profile.id, selectedConv.otherUser.id, true);
        await loadConversations(profile.id, true);
        setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
      }
    } catch (e) {
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSearchUsers = async (q: string) => {
    setSearchQuery(q);
    if (q.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    try {
      const res: any = await searchUsersAction(q, profile.id);
      if (res && res.users) {
        setSearchResults(res.users);
      }
    } catch (e) {
    } finally {
      setIsSearching(false);
    }
  };

  const handleStartChatWithUser = (targetUser: any) => {
    setIsSearchModalOpen(false);
    setSearchQuery("");
    setSearchResults([]);

    const existing = conversations.find((c) => c.otherUser.id === targetUser.id);
    if (existing) {
      handleSelectConversation(existing);
    } else {
      const tempConv = {
        id: "",
        user1_id: profile.id,
        user2_id: targetUser.id,
        last_message: "",
        last_message_at: new Date().toISOString(),
        otherUser: targetUser,
      };
      setSelectedConv(tempConv);
      setMessages([]);
      setChatFiles([]);
      setChatLinkUrl("");
    }
  };

  const currentTotalChatFileSize = chatFiles.reduce((acc, curr) => acc + curr.file.size, 0);

  return (
    <div className="bg-grid relative overflow-hidden pb-10 pt-36 min-h-screen flex flex-col">
      <div className="pointer-events-none absolute left-1/2 top-24 -z-10 h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-primary/10 blur-[140px]" />

      <div className="mx-auto max-w-6xl w-full px-4 sm:px-6 flex-1 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-2xl bg-blue-500/10 border border-blue-500/30 text-blue-400">
              <MessageCircle className="w-6 h-6" />
            </div>
            <div>
              <h1 className="font-display text-2xl font-bold text-white flex items-center gap-2">
                <span>Chat TSG</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-semibold flex items-center gap-1">
                  <Lock className="w-3 h-3" /> E2EE Terenkripsi
                </span>
              </h1>
              <p className="text-xs text-slate-400">
                Pesan langsung aman & terenkripsi end-to-end.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsSearchModalOpen(true)}
            className="flex items-center gap-2 rounded-xl bg-blue-500 hover:bg-blue-400 px-4 py-2.5 text-xs font-semibold text-slate-950 transition-all hover:scale-105 active:scale-95 cursor-pointer shadow-lg shadow-blue-500/20"
          >
            <UserPlus className="h-4 w-4" />
            <span className="hidden sm:inline">Cari Pengguna</span>
          </button>
        </div>

        {/* Chat Layout Container */}
        <div className="flex-1 rounded-3xl bg-slate-900/90 border border-white/15 shadow-2xl backdrop-blur-xl flex flex-col md:flex-row overflow-hidden min-h-[550px] max-h-[75vh]">
          {/* Sidebar List Conversation */}
          <div
            className={`w-full md:w-80 border-r border-white/10 flex flex-col bg-slate-950/40 ${
              selectedConv ? "hidden md:flex" : "flex"
            }`}
          >
            <div className="p-4 border-b border-white/10 flex items-center justify-between">
              <span className="text-xs font-bold text-white/70 uppercase tracking-wider">
                Pesan Masuk ({conversations.length})
              </span>
              <button
                type="button"
                onClick={() => loadConversations(profile?.id)}
                className="text-white/50 hover:text-white transition"
                title="Muat Ulang Pesan"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingConvs ? "animate-spin" : ""}`} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-white/5 scrollbar-thin">
              {conversations.length === 0 && !isLoadingConvs && (
                <div className="text-center py-12 px-4">
                  <MessageCircle className="w-8 h-8 text-white/20 mx-auto mb-2" />
                  <p className="text-xs text-white/50">Belum ada obrolan.</p>
                </div>
              )}

              {conversations.map((conv) => {
                const isSelected = selectedConv?.id === conv.id;
                const lastMsg = decryptedMessages[conv.id] || "...";
                const other = conv.otherUser;

                return (
                  <div
                    key={conv.id}
                    onClick={() => handleSelectConversation(conv)}
                    className={`flex items-center gap-3 p-3.5 cursor-pointer transition-colors ${
                      isSelected ? "bg-blue-600/20 border-l-4 border-blue-500" : "hover:bg-white/5"
                    }`}
                  >
                    <div className="relative h-11 w-11 overflow-hidden rounded-full border border-white/20 bg-slate-800 flex items-center justify-center shrink-0">
                      {other?.photo ? (
                        <Image
                          src={other.photo}
                          alt={other.name}
                          width={44}
                          height={44}
                          className="h-full w-full object-cover object-top"
                          crossOrigin="anonymous"
                        />
                      ) : (
                        <FaUser className="h-4 w-4 text-white/60" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-xs font-bold text-white truncate flex items-center gap-1">
                          {other?.name}
                          {other?.badge && (
                            <span className="text-[8px] px-1 py-0.2 rounded bg-amber-500/20 text-amber-300 font-bold">
                              {other.badge}
                            </span>
                          )}
                        </span>
                        <span className="text-[9px] text-white/40 shrink-0">
                          {new Date(conv.last_message_at).toLocaleTimeString("id-ID", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 truncate">
                        {lastMsg}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Active Chat Area */}
          <div
            className={`flex-1 flex flex-col bg-slate-900/50 ${
              selectedConv ? "flex" : "hidden md:flex"
            }`}
          >
            {selectedConv ? (
              <>
                {/* Chat Header */}
                <div className="p-3.5 border-b border-white/10 bg-slate-950/60 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setSelectedConv(null)}
                      className="md:hidden flex h-8 w-8 items-center justify-center rounded-xl bg-white/5 text-white/80 hover:bg-white/10"
                    >
                      ✕
                    </button>
                    <div
                      onClick={() => setPreviewProfile(selectedConv.otherUser)}
                      className="relative h-10 w-10 overflow-hidden rounded-full border border-white/20 bg-slate-800 flex items-center justify-center shrink-0 cursor-pointer hover:scale-105 transition-transform"
                    >
                      {selectedConv.otherUser?.photo ? (
                        <Image
                          src={selectedConv.otherUser.photo}
                          alt={selectedConv.otherUser.name}
                          width={40}
                          height={40}
                          className="h-full w-full object-cover object-top"
                          crossOrigin="anonymous"
                        />
                      ) : (
                        <FaUser className="h-4 w-4 text-white/60" />
                      )}
                    </div>
                    <div
                      onClick={() => setPreviewProfile(selectedConv.otherUser)}
                      className="min-w-0 cursor-pointer"
                    >
                      <h3 className="text-sm font-bold text-white truncate flex items-center gap-1.5">
                        <span>{selectedConv.otherUser.name}</span>
                        {selectedConv.otherUser.badge ? (
                          <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold">
                            {selectedConv.otherUser.badge}
                          </span>
                        ) : selectedConv.otherUser.is_tsg_member ? (
                          <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-blue-500/20 text-blue-300 font-bold">
                            TSG
                          </span>
                        ) : null}
                      </h3>
                      <p className="text-[10px] text-white/50 truncate">
                        @{selectedConv.otherUser.nickname || "user"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full">
                    <Lock className="w-3 h-3" />
                    <span>E2EE Active</span>
                  </div>
                </div>

                {/* Messages List Area */}
                <div className="flex-1 p-4 overflow-y-auto space-y-3 scrollbar-thin">
                  {isLoadingMsgs && messages.length === 0 && (
                    <div className="flex items-center justify-center gap-2 text-xs text-blue-300 py-8 animate-pulse">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Dekripsi & memuat pesan...</span>
                    </div>
                  )}

                  {messages.map((m) => {
                    const isMe = m.sender_id === profile.id;
                    const decText = decryptedMessages[m.id] || "🔒 Pesan Terenkripsi";

                    let verifPayload: any = null;
                    let mediaMsgPayload: any = null;

                    try {
                      const raw =
                        m.content && m.content.startsWith('{"type":"tsg_verification_request"')
                          ? m.content
                          : decText.startsWith('{"type":"tsg_verification_request"')
                            ? decText
                            : null;
                      if (raw) {
                        const parsed = JSON.parse(raw);
                        if (parsed.type === "tsg_verification_request") {
                          verifPayload = parsed;
                        }
                      }
                    } catch (e) {}

                    try {
                      const rawMedia =
                        m.content && m.content.startsWith('{"type":"chat_media_message"')
                          ? m.content
                          : decText.startsWith('{"type":"chat_media_message"')
                            ? decText
                            : null;
                      if (rawMedia) {
                        const parsed = JSON.parse(rawMedia);
                        if (parsed.type === "chat_media_message") {
                          mediaMsgPayload = parsed;
                        }
                      }
                    } catch (e) {}

                    if (verifPayload) {
                      return (
                        <div key={m.id} className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}>
                          <div className="max-w-[92%] sm:max-w-[80%]">
                            <TsgVerificationCard
                              payload={verifPayload}
                              currentUserId={profile.id}
                              isCreator={profile?.generation?.toLowerCase() === "creator"}
                              currentUserNickname={publicAccount?.nickname || profile?.name}
                            />
                          </div>
                          <span className="text-[9px] text-white/30 mt-1 px-1">
                            {new Date(m.created_at).toLocaleTimeString("id-ID", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                      );
                    }

                    if (mediaMsgPayload) {
                      return (
                        <div key={m.id} className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}>
                          <div
                            className={`max-w-[85%] sm:max-w-[75%] rounded-2xl p-3 text-xs leading-relaxed break-words whitespace-pre-wrap ${
                              isMe
                                ? "bg-blue-600 text-white rounded-br-none shadow-md shadow-blue-600/20"
                                : "bg-slate-800 text-slate-100 rounded-bl-none border border-white/10"
                            }`}
                          >
                            <SocialMediaRenderer
                              attachments={mediaMsgPayload.attachments}
                              onImageClick={(url) => setViewerUrl(url)}
                            />
                            {mediaMsgPayload.linkUrl && (
                              <a
                                href={
                                  mediaMsgPayload.linkUrl.startsWith("http")
                                    ? mediaMsgPayload.linkUrl
                                    : `https://${mediaMsgPayload.linkUrl}`
                                }
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 text-[11px] text-blue-200 hover:text-white bg-black/20 border border-white/15 rounded-xl px-3 py-2 mb-2 break-all"
                              >
                                <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                                <span className="truncate">
                                  {mediaMsgPayload.linkUrl.replace(/^https?:\/\//, "")}
                                </span>
                              </a>
                            )}
                            {mediaMsgPayload.text && <p>{mediaMsgPayload.text}</p>}
                          </div>
                          <span className="text-[9px] text-white/30 mt-1 px-1">
                            {new Date(m.created_at).toLocaleTimeString("id-ID", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={m.id}
                        className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}
                      >
                        <div
                          className={`max-w-[80%] sm:max-w-[70%] rounded-2xl p-3 text-xs leading-relaxed break-words whitespace-pre-wrap ${
                            isMe
                              ? "bg-blue-600 text-white rounded-br-none shadow-md shadow-blue-600/20"
                              : "bg-slate-800 text-slate-100 rounded-bl-none border border-white/10"
                          }`}
                        >
                          {decText}
                        </div>
                        <span className="text-[9px] text-white/30 mt-1 px-1">
                          {new Date(m.created_at).toLocaleTimeString("id-ID", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                    );
                  })}
                  <div ref={chatEndRef} />
                </div>

                {/* Attachments & Link Preview Area */}
                {(chatFiles.length > 0 || chatLinkUrl) && !isVirtualTsg && (
                  <div className="px-3 pt-2 bg-slate-950/80 border-t border-white/10 flex flex-wrap gap-2 items-center">
                    {chatFiles.map((item, idx) => (
                      <div
                        key={`chat-file-${idx}`}
                        className="relative group flex items-center gap-2 bg-slate-900 border border-white/15 rounded-xl p-2 text-xs text-white max-w-[200px]"
                      >
                        <button
                          type="button"
                          onClick={() => handleRemoveChatFile(idx)}
                          className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-rose-500 text-white hover:bg-rose-600"
                        >
                          <X className="h-3 w-3" />
                        </button>
                        {item.previewUrl && item.detected.category === "image" ? (
                          <div className="relative h-8 w-8 rounded-lg overflow-hidden shrink-0 bg-slate-950">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={item.previewUrl} alt="prev" className="h-full w-full object-cover" />
                          </div>
                        ) : (
                          <div className="flex h-8 w-8 rounded-lg shrink-0 items-center justify-center bg-blue-500/20 text-blue-300">
                            {item.detected.category === "audio" ? (
                              <Music className="h-4 w-4" />
                            ) : item.detected.category === "video" ? (
                              <Film className="h-4 w-4" />
                            ) : (
                              <FileText className="h-4 w-4" />
                            )}
                          </div>
                        )}
                        <span className="truncate">{item.file.name}</span>
                      </div>
                    ))}

                    {chatLinkUrl && (
                      <div className="relative flex items-center gap-2 bg-blue-500/10 border border-blue-500/30 rounded-xl px-3 py-1.5 text-xs text-blue-200">
                        <button
                          type="button"
                          onClick={() => setChatLinkUrl("")}
                          className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-rose-500 text-white hover:bg-rose-600"
                        >
                          <X className="h-3 w-3" />
                        </button>
                        <LinkIcon className="h-3.5 w-3.5 shrink-0 text-blue-400" />
                        <span className="truncate max-w-[180px]">{chatLinkUrl}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Chat Input Bar */}
                <div className="relative">
                  {/* Attachment Popup Menu */}
                  <AnimatePresence>
                    {showAttachmentMenu && !isVirtualTsg && (
                      <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        className="absolute bottom-full left-3 mb-2 z-20 w-56 rounded-2xl bg-slate-950 border border-white/20 p-2 shadow-2xl flex flex-col gap-1 text-white"
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setShowAttachmentMenu(false);
                            chatFileInputRef.current?.click();
                          }}
                          className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold hover:bg-white/10 transition text-left cursor-pointer"
                        >
                          <Paperclip className="w-4 h-4 text-emerald-400" />
                          <span>Unggah File / Media ({chatFiles.length}/{MAX_FILES})</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setShowAttachmentMenu(false);
                            setShowLinkModal(true);
                          }}
                          className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold hover:bg-white/10 transition text-left cursor-pointer"
                        >
                          <LinkIcon className="w-4 h-4 text-blue-400" />
                          <span>Tambahkan Tautan Link</span>
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <input
                    type="file"
                    multiple
                    ref={chatFileInputRef}
                    onChange={handleChatFileChange}
                    className="hidden"
                  />

                  <form
                    onSubmit={handleSendMessage}
                    className="p-3 border-t border-white/10 bg-slate-900/90 flex gap-2 items-center"
                  >
                    {!isVirtualTsg && (
                      <button
                        type="button"
                        onClick={() => setShowAttachmentMenu((prev) => !prev)}
                        title="Tambah lampiran file atau tautan"
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 border border-white/15 text-white/80 hover:text-white transition cursor-pointer"
                      >
                        <Plus className={`w-5 h-5 transition-transform ${showAttachmentMenu ? "rotate-45" : ""}`} />
                      </button>
                    )}

                    <input
                      type="text"
                      value={inputMessage}
                      onChange={(e) => setInputMessage(e.target.value)}
                      placeholder={
                        isVirtualTsg
                          ? "Kirim pesan teks ke Akun Resmi TSG..."
                          : "Tulis pesan atau lampirkan file..."
                      }
                      disabled={isSending}
                      className="flex-1 rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-xs text-white placeholder-white/30 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
                    />

                    <button
                      type="submit"
                      disabled={isSending || (!inputMessage.trim() && chatFiles.length === 0 && !chatLinkUrl.trim())}
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-500 hover:bg-blue-400 text-slate-950 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-blue-500/20"
                    >
                      {isSending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                    </button>
                  </form>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-6">
                <MessageCircle className="w-12 h-12 text-white/20 mb-3" />
                <h3 className="text-sm font-bold text-white/80">Pilih Obrolan</h3>
                <p className="text-xs text-white/50 max-w-xs mt-1">
                  Pilih teman berbincang di panel samping atau cari pengguna baru untuk mulai mengirim pesan E2EE.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Link Input Modal */}
      <AnimatePresence>
        {showLinkModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 overflow-y-auto"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative w-full max-w-md rounded-3xl bg-slate-900 border border-white/20 p-6 shadow-2xl text-white"
            >
              <h3 className="text-base font-bold mb-2">Tambahkan Tautan Link</h3>
              <p className="text-xs text-white/60 mb-4">
                Masukkan URL tautan yang ingin Anda sertakan dalam pesan.
              </p>
              <input
                type="url"
                value={tempLinkUrl}
                onChange={(e) => setTempLinkUrl(e.target.value)}
                placeholder="https://contoh.com"
                className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-xs text-white placeholder-white/30 focus:border-blue-500 focus:outline-none mb-4"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowLinkModal(false)}
                  className="flex-1 rounded-xl border border-white/15 bg-white/5 py-2.5 text-xs font-semibold text-white/80 hover:bg-white/10"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (tempLinkUrl.trim()) {
                      setChatLinkUrl(tempLinkUrl.trim());
                      setTempLinkUrl("");
                    }
                    setShowLinkModal(false);
                  }}
                  className="flex-1 rounded-xl bg-blue-500 hover:bg-blue-400 py-2.5 text-xs font-semibold text-slate-950"
                >
                  Sematkan Link
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal Cari Pengguna */}
      <AnimatePresence>
        {isSearchModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 overflow-y-auto"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative my-auto w-full max-w-md rounded-3xl bg-slate-900 border border-white/20 p-6 shadow-2xl text-white max-h-[85vh] flex flex-col"
            >
              <button
                type="button"
                onClick={() => setIsSearchModalOpen(false)}
                className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-white/5 text-white/70 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>

              <div className="flex items-center gap-3 mb-4">
                <div className="p-2.5 rounded-2xl bg-blue-500/10 border border-blue-500/30 text-blue-400">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold">Cari Pengguna TSG</h3>
                  <p className="text-xs text-white/60">
                    Cari berdasarkan nama atau nickname publik.
                  </p>
                </div>
              </div>

              <div className="relative mb-4">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => handleSearchUsers(e.target.value)}
                  placeholder="Ketik nickname / nama..."
                  className="w-full rounded-xl border border-white/15 bg-white/5 pl-10 pr-4 py-2.5 text-xs text-white placeholder-white/30 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="flex-1 overflow-y-auto space-y-2 pr-1 scrollbar-thin min-h-[200px]">
                {isSearching && (
                  <div className="flex items-center justify-center gap-2 text-xs text-blue-300 py-6 animate-pulse">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Mencari...</span>
                  </div>
                )}

                {!isSearching && searchResults.length === 0 && searchQuery.trim().length >= 2 && (
                  <p className="text-center text-xs text-white/50 py-6">
                    Pengguna tidak ditemukan.
                  </p>
                )}

                {!isSearching && searchResults.length === 0 && searchQuery.trim().length < 2 && (
                  <p className="text-center text-xs text-white/40 py-6">
                    Ketik minimal 2 karakter untuk mencari.
                  </p>
                )}

                {searchResults.map((u) => (
                  <div
                    key={u.id}
                    className="flex items-center justify-between p-3 rounded-2xl bg-white/5 border border-white/5 hover:border-blue-500/30 transition-colors"
                  >
                    <div
                      onClick={() => setPreviewProfile(u)}
                      className="flex items-center gap-3 cursor-pointer min-w-0 flex-1"
                    >
                      <div className="relative h-10 w-10 overflow-hidden rounded-full border border-white/20 bg-slate-800 flex items-center justify-center shrink-0">
                        {u.avatar_url ? (
                          <Image
                            src={u.avatar_url}
                            alt={u.name}
                            width={40}
                            height={40}
                            className="h-full w-full object-cover object-top"
                            crossOrigin="anonymous"
                          />
                        ) : (
                          <FaUser className="h-4 w-4 text-white/60" />
                    )}
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-xs font-bold text-white truncate flex items-center gap-1.5">
                          <span>{u.name}</span>
                          {u.show_tsg_member && (
                            <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-blue-500/20 text-blue-300 font-bold">
                              TSG
                            </span>
                          )}
                        </h4>
                        <p className="text-[10px] text-white/50 truncate">@{u.nickname}</p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleStartChatWithUser(u)}
                      className="ml-2 flex items-center gap-1 rounded-xl bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/40 px-3 py-1.5 text-xs font-semibold text-blue-300 transition cursor-pointer shrink-0"
                    >
                      <span>Chat</span>
                    </button>
                  </div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <PublicProfilePreviewModal
        isOpen={!!previewProfile}
        publicAccount={previewProfile}
        defaultAvatarUrl={previewProfile?.avatar_url || previewProfile?.photo || ""}
        onClose={() => setPreviewProfile(null)}
      />

      {/* Fullscreen Image Viewer Modal */}
      {mounted && viewerUrl && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={closeViewer}
          className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/90 backdrop-blur-md p-4 cursor-zoom-out"
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="relative max-h-[90vh] max-w-[90vw] rounded-2xl overflow-hidden border border-white/20 bg-slate-950 shadow-2xl"
          >
            <button
              type="button"
              onClick={closeViewer}
              aria-label="Tutup"
              className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white/80 hover:bg-black/90 hover:text-white transition-colors cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={viewerUrl}
              alt="Foto penuh"
              className="max-h-[90vh] max-w-[90vw] object-contain cursor-default"
              crossOrigin="anonymous"
            />
          </motion.div>
        </motion.div>
      )}
    </div>
  );
}
