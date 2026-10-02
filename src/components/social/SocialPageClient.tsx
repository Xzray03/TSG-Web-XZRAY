"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { FaUser } from "react-icons/fa";
import {
  MessageSquare,
  Plus,
  Link as LinkIcon,
  Send,
  Loader2,
  ExternalLink,
  X,
  RefreshCw,
  Trash2,
  ChevronsLeft,
  ChevronLeft,
  ChevronRight,
  ChevronsRight,
  Upload,
  FileText,
  Film,
  Music,
  Archive,
  File,
} from "lucide-react";
import { getPublicAccountAction } from "@/actions/publicAccountActions";
import { getSessionAction } from "@/actions/authActions";
import {
  getSocialPostsAction,
  createSocialPostAction,
  createSocialCommentAction,
  deleteSocialPostAction,
  uploadSocialFilesAction,
} from "@/actions/socialActions";
import { PublicProfilePreviewModal } from "@/components/auth/PublicProfilePreviewModal";
import { useScrollLock } from "@/hooks/useScrollLock";
import { detectFileType } from "@/lib/fileTypeDetector";
import { SocialMediaRenderer } from "@/components/social/SocialMediaRenderer";
import { useImageViewer } from "@/components/ui/ImageViewer";

interface SocialPageClientProps {
  initialPosts: any[];
}

const POSTS_PER_PAGE = 10;
const MAX_FILES = 10;
const MAX_TOTAL_SIZE = 100 * 1024 * 1024; // 100 MB

export function SocialPageClient({ initialPosts }: SocialPageClientProps) {
  const router = useRouter();
  const [posts, setPosts] = useState<any[]>(initialPosts);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [content, setContent] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<
    { file: File; previewUrl?: string; detected: any }[]
  >([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [publicAccount, setPublicAccount] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [expandedComments, setExpandedComments] = useState<Record<string, boolean>>({});
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});
  const [submittingComment, setSubmittingComment] = useState<Record<string, boolean>>({});
  const [previewProfile, setPreviewProfile] = useState<any>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(0);

  // Delete confirmation modal state
  const [postToDelete, setPostToDelete] = useState<any>(null);
  const [isDeleting, setIsDeleting] = useState(false);

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

  useScrollLock(showCreateForm || !!postToDelete || !!viewerUrl);

  useEffect(() => {
    async function verifyAuth() {
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
        const sess: any = await getSessionAction();
        if (!sess?.authenticated || sess.profile?.id !== parsed.id) {
          localStorage.removeItem("tsg_user_profile");
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
      } catch (e) {
        router.replace("/");
      }
    }
    verifyAuth();
  }, [router]);

  useEffect(() => {
    if (profile?.id) {
      fetchPosts(currentPage);
    }
  }, [currentPage, profile?.id]);

  useEffect(() => {
    if (!profile?.id) return;
    const interval = setInterval(() => {
      fetchPosts(currentPage, true);
    }, 60000);

    return () => clearInterval(interval);
  }, [currentPage, profile?.id]);

  const fetchPosts = async (pageToFetch = currentPage, silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const res: any = await getSocialPostsAction(pageToFetch, POSTS_PER_PAGE);
      if (res && res.posts) {
        setPosts(res.posts);
        setTotalCount(res.totalCount || 0);
      }
    } catch (e) {
    } finally {
      if (!silent) setIsLoading(false);
    }
  };

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    await fetchPosts(currentPage);
    setIsRefreshing(false);
  };

  const processFiles = async (newFilesArray: File[]) => {
    setErrorMsg("");
    if (!newFilesArray || newFilesArray.length === 0) return;

    if (selectedFiles.length + newFilesArray.length > MAX_FILES) {
      setErrorMsg(`Maksimal ${MAX_FILES} file per postingan.`);
      return;
    }

    let currentTotalSize = selectedFiles.reduce((acc, curr) => acc + curr.file.size, 0);
    for (const f of newFilesArray) {
      currentTotalSize += f.size;
    }

    if (currentTotalSize > MAX_TOTAL_SIZE) {
      setErrorMsg("Total ukuran file melebihi batas maksimal 100MB.");
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

    setSelectedFiles((prev) => [...prev, ...processed]);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      await processFiles(Array.from(files));
    }
    e.target.value = "";
  };

  const handleDrop = async (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const files = e.dataTransfer.files;
    if (files) {
      await processFiles(Array.from(files));
    }
  };

  const handleRemoveFile = (index: number) => {
    setSelectedFiles((prev) => {
      const target = prev[index];
      if (target?.previewUrl) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() && selectedFiles.length === 0) {
      setErrorMsg("Mohon isi konten atau unggah minimal 1 file.");
      return;
    }
    if (!profile?.id) {
      setErrorMsg("Akun tidak valid.");
      return;
    }
    setIsSubmitting(true);
    setErrorMsg("");

    try {
      let attachments: any[] = [];

      if (selectedFiles.length > 0) {
        const formData = new FormData();
        selectedFiles.forEach((item) => {
          formData.append("files", item.file, item.file.name);
        });

        const uploadRes: any = await uploadSocialFilesAction(formData);
        if (uploadRes?.error) {
          setErrorMsg(uploadRes.error);
          setIsSubmitting(false);
          return;
        }

        attachments = (uploadRes.files || []).map((f: any, i: number) => ({
          ...f,
          type: selectedFiles[i]?.detected.category || "other",
        }));
      }

      const res: any = await createSocialPostAction({
        realAccountId: profile.id,
        content: content.trim() || "(Lampiran file)",
        linkUrl: linkUrl.trim() || undefined,
        attachments,
      });

      if (res?.error) {
        setErrorMsg(res.error);
      } else {
        setContent("");
        setLinkUrl("");
        selectedFiles.forEach((f) => f.previewUrl && URL.revokeObjectURL(f.previewUrl));
        setSelectedFiles([]);
        setShowCreateForm(false);
        if (currentPage === 0) {
          await fetchPosts(0);
        } else {
          setCurrentPage(0);
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Gagal membuat postingan.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateComment = async (postId: string) => {
    const text = commentInputs[postId]?.trim();
    if (!text) return;
    if (!profile?.id) return;

    setSubmittingComment((prev) => ({ ...prev, [postId]: true }));
    try {
      const res: any = await createSocialCommentAction({
        postId,
        realAccountId: profile.id,
        content: text,
      });
      if (!res?.error) {
        setCommentInputs((prev) => ({ ...prev, [postId]: "" }));
        await fetchPosts(currentPage);
      }
    } catch (e) {
    } finally {
      setSubmittingComment((prev) => ({ ...prev, [postId]: false }));
    }
  };

  const handleDeletePostConfirm = async () => {
    if (!postToDelete || !profile?.id) return;
    setIsDeleting(true);
    try {
      const res: any = await deleteSocialPostAction({
        postId: postToDelete.id,
        realAccountId: profile.id,
      });
      if (res?.error) {
        alert(res.error);
      } else {
        setPostToDelete(null);
        await fetchPosts(currentPage);
      }
    } catch (e: any) {
      alert(e.message || "Gagal menghapus postingan.");
    } finally {
      setIsDeleting(false);
    }
  };

  const isCreator =
    profile?.generation?.toLowerCase() === "creator" ||
    profile?.name?.toLowerCase() === "creator";

  const totalPages = Math.ceil(totalCount / POSTS_PER_PAGE) || 1;
  const currentTotalFileSize = selectedFiles.reduce((acc, curr) => acc + curr.file.size, 0);

  return (
    <div className="bg-grid relative overflow-hidden pb-16 pt-36 min-h-screen">
      <div className="pointer-events-none absolute left-1/2 top-24 -z-10 h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-primary/10 blur-[140px]" />

      <div className="mx-auto max-w-3xl px-6 sm:px-10">
        <div className="text-center mb-8">
          <div className="glass mb-5 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-medium tracking-wide text-accent">
            <MessageSquare className="h-3.5 w-3.5" />
            Social
          </div>
          <h1 className="font-display text-4xl font-bold text-white sm:text-5xl">
            Komunitas <span className="text-gradient">TSG</span>
          </h1>
          <p className="mt-4 text-base text-slate-400">
            Berbagi cerita, diskusi, dan inspirasi bersama.
          </p>
        </div>

        <div className="mb-6 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => setShowCreateForm(true)}
            className="flex items-center gap-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 px-5 py-3 text-sm font-semibold text-slate-950 transition-all hover:scale-105 active:scale-95 cursor-pointer shadow-lg shadow-emerald-500/25"
          >
            <Plus className="h-4 w-4" />
            <span>Buat Postingan</span>
          </button>
          <button
            type="button"
            onClick={handleManualRefresh}
            disabled={isRefreshing || isLoading}
            title="Muat ulang postingan"
            className="flex items-center gap-2 rounded-xl border border-white/15 bg-slate-900/80 hover:bg-slate-800 px-4 py-3 text-sm font-semibold text-white transition-all hover:scale-105 active:scale-95 cursor-pointer shadow-lg disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 text-emerald-400 ${isRefreshing ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>
        </div>

        {/* Modal Buat Postingan */}
        <AnimatePresence>
          {showCreateForm && (
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
                className="relative my-auto w-full max-w-lg rounded-3xl bg-slate-900 border border-white/20 p-6 sm:p-7 shadow-2xl text-white max-h-[90vh] overflow-y-auto"
              >
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setShowCreateForm(false)}
                  className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-white/5 text-white/70 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>

                <div className="flex items-center gap-3 mb-6">
                  <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                    <MessageSquare className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold">Buat Postingan Baru</h3>
                    <p className="text-xs text-white/65">
                      Bagikan cerita, foto, video, atau file ke komunitas TSG.
                    </p>
                  </div>
                </div>

                <form onSubmit={handleCreatePost} className="space-y-4">
                  {errorMsg && (
                    <div className="text-rose-400 text-xs bg-rose-950/40 p-3 rounded-xl border border-rose-900/50">
                      {errorMsg}
                    </div>
                  )}
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">
                      Tulis Postingan
                    </label>
                    <textarea
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                      placeholder="Apa yang ingin kamu bagikan?"
                      rows={3}
                      disabled={isSubmitting}
                      className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-white/30 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-50 resize-y"
                    />
                  </div>

                  {/* File Upload Section */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-medium text-slate-300">
                        Lampiran File / Gambar / Video (Maks 10 file, total 100MB)
                      </label>
                      <span className="text-[10px] text-white/50">
                        {selectedFiles.length}/{MAX_FILES} file ({(currentTotalFileSize / 1024 / 1024).toFixed(1)} MB)
                      </span>
                    </div>

                    <label
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                      onDragEnter={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                      onDrop={handleDrop}
                      className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-white/25 bg-white/5 p-4 text-center hover:bg-white/10 transition-colors cursor-pointer"
                    >
                      <Upload className="h-6 w-6 text-emerald-400 mb-2" />
                      <span className="text-xs font-semibold text-white">
                        Klik untuk pilih file atau seret ke sini
                      </span>
                      <span className="text-[10px] text-white/50 mt-1">
                        (Gambar, Video, Audio, Dokumen, dll)
                      </span>
                      <input
                        type="file"
                        multiple
                        disabled={isSubmitting || selectedFiles.length >= MAX_FILES}
                        onChange={handleFileChange}
                        className="hidden"
                      />
                    </label>

                    {selectedFiles.length > 0 && (
                      <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-44 overflow-y-auto pr-1">
                        {selectedFiles.map((item, idx) => (
                          <div
                            key={`sel-${idx}`}
                            className="relative group flex flex-col items-center justify-center rounded-xl border border-white/15 bg-slate-950 p-2 text-center overflow-hidden"
                          >
                            <button
                              type="button"
                              onClick={() => handleRemoveFile(idx)}
                              disabled={isSubmitting}
                              className="absolute top-1 right-1 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-rose-500/80 text-white hover:bg-rose-600 transition"
                            >
                              <X className="h-3 w-3" />
                            </button>

                            {item.previewUrl && item.detected.category === "image" ? (
                              <div className="relative h-16 w-full mb-1 rounded-lg overflow-hidden bg-slate-900">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={item.previewUrl}
                                  alt="Preview"
                                  className="h-full w-full object-cover"
                                />
                              </div>
                            ) : item.detected.category === "audio" ? (
                              <div className="flex h-16 w-full flex-col items-center justify-center mb-1 rounded-lg bg-emerald-500/10 p-2 text-emerald-300">
                                <Music className="h-5 w-5 shrink-0 mb-1" />
                                <audio
                                  src={item.previewUrl}
                                  controls
                                  className="h-8 w-full max-w-full rounded-lg"
                                  style={{ fontSize: "10px" }}
                                />
                              </div>
                            ) : item.detected.category === "video" ? (
                              <div className="flex h-16 w-full items-center justify-center mb-1 rounded-lg bg-blue-500/10 text-blue-300">
                                <Film className="h-6 w-6" />
                              </div>
                            ) : (
                              <div className="flex h-16 w-full items-center justify-center mb-1 rounded-lg bg-emerald-500/10 text-emerald-300">
                                {item.detected.category === "archive" ? (
                                  <Archive className="h-6 w-6" />
                                ) : (
                                  <FileText className="h-6 w-6" />
                                )}
                              </div>
                            )}

                            <span className="text-[11px] font-medium text-white truncate w-full px-1">
                              {item.file.name}
                            </span>
                            <span className="text-[9px] uppercase tracking-wider text-emerald-400 font-bold">
                              {item.detected.category} • {(item.file.size / 1024 / 1024).toFixed(1)}MB
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">
                      Tautan / Link (Opsional)
                    </label>
                    <div className="relative">
                      <LinkIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
                      <input
                        type="url"
                        value={linkUrl}
                        onChange={(e) => setLinkUrl(e.target.value)}
                        placeholder="https://contoh.com"
                        disabled={isSubmitting}
                        className="w-full rounded-xl border border-white/15 bg-white/5 pl-10 pr-4 py-2.5 text-sm text-white placeholder-white/30 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-50"
                      />
                    </div>
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => setShowCreateForm(false)}
                      className="flex-1 rounded-xl border border-white/15 bg-white/5 py-3 text-sm font-semibold text-white/85 transition-colors hover:bg-white/10 hover:text-white cursor-pointer disabled:opacity-40"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting || (!content.trim() && selectedFiles.length === 0)}
                      className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 py-3 text-sm font-semibold text-slate-950 transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {isSubmitting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                      <span>{isSubmitting ? "Mengunggah..." : "Kirim Postingan"}</span>
                    </button>
                  </div>
                </form>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Modal Konfirmasi Hapus Postingan */}
        <AnimatePresence>
          {postToDelete && (
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
                className="relative my-auto w-full max-w-md rounded-3xl bg-slate-900 border border-rose-500/40 p-6 shadow-2xl text-white"
              >
                <h3 className="text-lg font-bold text-rose-400 mb-2">Hapus Postingan</h3>
                <p className="text-sm text-white/70 mb-6">
                  Apakah Anda yakin ingin menghapus postingan ini? Tindakan ini tidak dapat dibatalkan.
                </p>
                <div className="flex gap-3">
                  <button
                    type="button"
                    disabled={isDeleting}
                    onClick={() => setPostToDelete(null)}
                    className="flex-1 rounded-xl border border-white/15 bg-white/5 py-2.5 text-sm font-semibold text-white/80 hover:bg-white/10 transition cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    disabled={isDeleting}
                    onClick={handleDeletePostConfirm}
                    className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-rose-500 hover:bg-rose-400 py-2.5 text-sm font-semibold text-slate-950 transition cursor-pointer disabled:opacity-50"
                  >
                    {isDeleting && <Loader2 className="h-4 w-4 animate-spin" />}
                    <span>Hapus</span>
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {isLoading && (
          <div className="flex items-center justify-center gap-2 text-blue-300 text-sm py-8 animate-pulse">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Memuat postingan...</span>
          </div>
        )}

        <div className="space-y-5">
          {posts.length === 0 && !isLoading && (
            <div className="text-center py-12 rounded-3xl bg-slate-900/60 border border-white/10">
              <MessageSquare className="h-10 w-10 text-white/20 mx-auto mb-3" />
              <p className="text-sm text-white/60">Belum ada postingan. Jadilah yang pertama!</p>
            </div>
          )}

          {posts.map((post) => {
            const author = post.public_accounts;
            const comments = post.comments || [];
            const isExpanded = expandedComments[post.id];
            const isOwner = post.real_account_id === profile?.id;
            const canDelete = isOwner || isCreator;

            return (
              <article
                key={post.id}
                className="rounded-3xl bg-slate-900 border border-white/10 p-5 sm:p-6 shadow-xl relative group"
              >
                {canDelete && (
                  <button
                    type="button"
                    onClick={() => setPostToDelete(post)}
                    title="Hapus Postingan"
                    className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 hover:bg-rose-500 hover:text-white transition-all cursor-pointer opacity-80 group-hover:opacity-100"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}

                <div className="flex items-start gap-3 mb-4 pr-10">
                  <button
                    type="button"
                    onClick={() =>
                      author &&
                      setPreviewProfile({
                        ...author,
                        avatar_url: author.avatar_url,
                        real_account_created_at: post.user_accounts?.created_at || author.created_at,
                      })
                    }
                    className="relative h-11 w-11 overflow-hidden rounded-full border border-white/20 bg-slate-800 flex items-center justify-center shrink-0 cursor-pointer hover:scale-105 active:scale-95 transition-transform"
                    title="Lihat profil publik"
                  >
                    {author?.avatar_url ? (
                      <Image
                        src={author.avatar_url}
                        alt={author.name || author.nickname}
                        width={44}
                        height={44}
                        className="h-full w-full object-cover object-top"
                        crossOrigin="anonymous"
                      />
                    ) : (
                      <FaUser className="h-4 w-4 text-white/60" />
                    )}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-white truncate">
                        {author?.name || "Anonim"}
                      </span>
                      {author?.show_tsg_member && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-300 font-bold">
                          ANGGOTA TSG
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-white/40">
                      @{author?.nickname || "unknown"} •{" "}
                      {new Date(post.created_at).toLocaleString("id-ID", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </div>

                <p className="text-sm text-slate-200 leading-relaxed break-words whitespace-pre-wrap mb-3">
                  {post.content}
                </p>

                {/* Media Renderer (Images, Videos, Files streamable via Catbox) */}
                <SocialMediaRenderer
                  attachments={post.attachments}
                  mediaUrl={post.media_url}
                  mediaType={post.media_type}
                  onImageClick={(url) => setViewerUrl(url)}
                />

                {post.link_url && (
                  <a
                    href={
                      post.link_url.startsWith("http")
                        ? post.link_url
                        : `https://${post.link_url}`
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-xs text-blue-300 hover:text-blue-200 bg-blue-500/10 border border-blue-500/20 rounded-xl px-3.5 py-2.5 mb-3 break-all hover:bg-blue-500/15 transition-colors"
                  >
                    <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">
                      {post.link_url.replace(/^https?:\/\//, "")}
                    </span>
                  </a>
                )}

                <div className="pt-3 border-t border-white/5">
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedComments((prev) => ({
                        ...prev,
                        [post.id]: !prev[post.id],
                      }))
                    }
                    className="flex items-center gap-1.5 text-xs text-white/60 hover:text-white font-medium transition-colors cursor-pointer"
                  >
                    <MessageSquare className="h-3.5 w-3.5" />
                    <span>
                      {comments.length} Komentar {isExpanded ? "▾" : "▸"}
                    </span>
                  </button>

                  {isExpanded && (
                    <div className="mt-3 space-y-3">
                      {comments.map((c: any) => {
                        const cAuthor = c.public_accounts;
                        return (
                          <div
                            key={c.id}
                            className="flex items-start gap-2.5 bg-white/5 rounded-2xl p-3 border border-white/5"
                          >
                            <button
                              type="button"
                              onClick={() =>
                                cAuthor &&
                                setPreviewProfile({
                                  ...cAuthor,
                                  real_account_created_at: cAuthor.created_at,
                                })
                              }
                              className="relative h-8 w-8 overflow-hidden rounded-full border border-white/15 bg-slate-800 flex items-center justify-center shrink-0 cursor-pointer hover:scale-105 transition-transform"
                              title="Lihat profil publik"
                            >
                              {cAuthor?.avatar_url ? (
                                <Image
                                  src={cAuthor.avatar_url}
                                  alt={cAuthor.name || cAuthor.nickname}
                                  width={32}
                                  height={32}
                                  className="h-full w-full object-cover object-top"
                                  crossOrigin="anonymous"
                                />
                              ) : (
                                <FaUser className="h-3 w-3 text-white/60" />
                              )}
                            </button>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-xs font-bold text-white">
                                  {cAuthor?.name || "Anonim"}
                                </span>
                                <span className="text-[10px] text-white/40">
                                  @{cAuthor?.nickname}
                                </span>
                              </div>
                              <p className="text-xs text-slate-300 leading-relaxed break-words whitespace-pre-wrap mt-0.5">
                                {c.content}
                              </p>
                            </div>
                          </div>
                        );
                      })}

                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={commentInputs[post.id] || ""}
                          onChange={(e) =>
                            setCommentInputs((prev) => ({
                              ...prev,
                              [post.id]: e.target.value,
                            }))
                          }
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              handleCreateComment(post.id);
                            }
                          }}
                          placeholder="Tulis komentar..."
                          disabled={submittingComment[post.id]}
                          className="flex-1 rounded-xl border border-white/15 bg-white/5 px-3.5 py-2 text-xs text-white placeholder-white/30 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-50"
                        />
                        <button
                          type="button"
                          onClick={() => handleCreateComment(post.id)}
                          disabled={
                            submittingComment[post.id] ||
                            !commentInputs[post.id]?.trim()
                          }
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          {submittingComment[post.id] ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Send className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </article>
            );
          })}

          {/* Pagination Navigation */}
          {totalCount > 0 && (
            <div className="flex items-center justify-center gap-2 pt-6">
              <button
                type="button"
                onClick={() => setCurrentPage(0)}
                disabled={currentPage === 0}
                title="Paling Terbaru (Halaman Pertama)"
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 bg-slate-900 text-white hover:bg-slate-800 transition disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer shadow"
              >
                <ChevronsLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
                disabled={currentPage === 0}
                title="Sebelumnya"
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 bg-slate-900 text-white hover:bg-slate-800 transition disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer shadow"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              <span className="px-4 text-xs font-semibold text-white/70">
                Hal {currentPage + 1} dari {totalPages} ({totalCount} Post)
              </span>

              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={currentPage >= totalPages - 1}
                title="Berikutnya"
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 bg-slate-900 text-white hover:bg-slate-800 transition disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer shadow"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage(totalPages - 1)}
                disabled={currentPage >= totalPages - 1}
                title="Paling Terlama (Halaman Terakhir)"
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 bg-slate-900 text-white hover:bg-slate-800 transition disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer shadow"
              >
                <ChevronsRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>

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
