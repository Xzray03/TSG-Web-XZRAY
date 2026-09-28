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
} from "lucide-react";
import { getPublicAccountAction } from "@/actions/publicAccountActions";
import {
  getConversationsAction,
  getChatMessagesAction,
  sendChatMessageAction,
  searchUsersAction,
} from "@/actions/chatActions";
import { encryptChatMessage, decryptChatMessage } from "@/lib/e2ee";
import { PublicProfilePreviewModal } from "@/components/auth/PublicProfilePreviewModal";
import { useScrollLock } from "@/hooks/useScrollLock";
import { TsgVerificationCard } from "@/components/chat/TsgVerificationCard";

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

  // Search User Modal state
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Profile Preview Modal
  const [previewProfile, setPreviewProfile] = useState<any>(null);

  const chatEndRef = useRef<HTMLDivElement>(null);

  useScrollLock(isSearchModalOpen || !!previewProfile);

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

        // Load conversations
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

        // Decrypt last messages preview
        const decMap: Record<string, string> = {};
        for (const c of res.conversations) {
          if (c.last_message) {
            decMap[c.id] = await decryptChatMessage(c.last_message, userId, c.otherUser.id);
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

        // Decrypt messages
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
    loadMessages(conv.id, profile.id, conv.otherUser.id);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() || !profile?.id || !selectedConv?.otherUser?.id) return;

    const text = inputMessage.trim();
    setInputMessage("");
    setIsSubmitting(true);

    try {
      // E2EE Encrypt before sending
      const encrypted = await encryptChatMessage(
        text,
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

    // Check if conversation already exists
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
    }
  };

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
                  <button
                    type="button"
                    onClick={() => setIsSearchModalOpen(true)}
                    className="mt-3 text-xs text-blue-400 hover:underline font-semibold"
                  >
                    + Cari Teman Berbincang
                  </button>
                </div>
              )}

              {conversations.map((c) => {
                const isSelected = selectedConv?.id === c.id;
                const lastMsgText = decryptedMessages[c.id] || "🔒 Pesan Terenkripsi";

                return (
                  <div
                    key={c.id}
                    onClick={() => handleSelectConversation(c)}
                    className={`p-3.5 flex items-center gap-3 cursor-pointer transition-colors ${
                      isSelected ? "bg-blue-500/15 border-l-4 border-blue-500" : "hover:bg-white/5"
                    }`}
                  >
                    <div className="relative h-11 w-11 overflow-hidden rounded-full border border-white/20 bg-slate-800 flex items-center justify-center shrink-0">
                      {c.otherUser.photo ? (
                        <Image
                          src={c.otherUser.photo}
                          alt={c.otherUser.name}
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
                      <div className="flex justify-between items-center mb-0.5">
                        <span className="text-xs font-bold text-white truncate flex items-center gap-1.5">
                          <span>{c.otherUser.name}</span>
                          {c.otherUser.badge && (
                            <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold shrink-0">
                              {c.otherUser.badge}
                            </span>
                          )}
                        </span>
                        {c.last_message_at && (
                          <span className="text-[10px] text-white/40 shrink-0">
                            {new Date(c.last_message_at).toLocaleTimeString("id-ID", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-white/50 truncate flex items-center gap-1">
                        <span>{lastMsgText.startsWith('{"type":"tsg_verification_request"') ? "📋 Permohonan Pendaftaran Anggota TSG" : lastMsgText}</span>
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Main Chat Panel */}
          <div
            className={`flex-1 flex flex-col bg-slate-900/50 ${
              !selectedConv ? "hidden md:flex" : "flex"
            }`}
          >
            {selectedConv ? (
              <>
                {/* Chat Panel Header */}
                <div className="p-3.5 sm:p-4 border-b border-white/10 flex items-center justify-between bg-slate-900/90">
                  <div className="flex items-center gap-3 min-w-0">
                    <button
                      type="button"
                      onClick={() => setSelectedConv(null)}
                      className="md:hidden text-white/70 hover:text-white p-1"
                    >
                      ←
                    </button>
                    <div
                      onClick={() => setPreviewProfile(selectedConv.otherUser)}
                      className="relative h-10 w-10 overflow-hidden rounded-full border border-white/20 bg-slate-800 flex items-center justify-center shrink-0 cursor-pointer hover:scale-105 transition-transform"
                    >
                      {selectedConv.otherUser.photo ? (
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
                    try {
                      const raw = m.content && m.content.startsWith('{"type":"tsg_verification_request"') ? m.content : decText.startsWith('{"type":"tsg_verification_request"') ? decText : null;
                      if (raw) {
                        const parsed = JSON.parse(raw);
                        if (parsed.type === "tsg_verification_request") {
                          verifPayload = parsed;
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

                {/* Chat Input Bar */}
                <form
                  onSubmit={handleSendMessage}
                  className="p-3 border-t border-white/10 bg-slate-900/90 flex gap-2 items-center"
                >
                  <input
                    type="text"
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    placeholder="Tulis pesan terenkripsi..."
                    disabled={isSending}
                    className="flex-1 rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-xs text-white placeholder-white/30 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
                  />
                  <button
                    type="submit"
                    disabled={isSending || !inputMessage.trim()}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-500 hover:bg-blue-400 text-slate-950 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {isSending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </button>
                </form>
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
                        <h4 className="text-xs font-bold text-white truncate flex items-center gap-1">
                          <span>{u.name}</span>
                          {u.show_tsg_member && (
                            <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-blue-500/20 text-blue-300 font-bold">
                              TSG
                            </span>
                          )}
                        </h4>
                        <p className="text-[10px] text-blue-400 truncate">@{u.nickname}</p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleStartChatWithUser(u)}
                      className="px-3 py-1.5 rounded-xl bg-blue-500 hover:bg-blue-400 text-slate-950 font-bold text-xs transition cursor-pointer shrink-0"
                    >
                      Chat
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
    </div>
  );
}
