"use client";

import React, { useState, useEffect, useRef } from "react";

interface ViewportVirtualizerProps {
  id: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
  className?: string;
}

export function ViewportVirtualizer({
  id,
  children,
  fallback,
  className = "",
}: ViewportVirtualizerProps) {
  // Selalu pertahankan render (hasRendered = true) setelah pertama kali dimuat atau jika sudah ada di sessionStorage.
  // Jangan pernah melakukan toggling `display: none` atau unload ketika discroll agar layout tidak collapse / loncat.
  // Cukup gunakan IntersectionObserver dan content-visibility / opacity / min-height untuk efisiensi rendering browser,
  // serta simpan ke sessionStorage agar state navigasi terjaga sepenuhnya.
  const [hasRendered, setHasRendered] = useState<boolean>(true);
  const [isMounted, setIsMounted] = useState<boolean>(false);

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsMounted(true);
    try {
      const cached = sessionStorage.getItem(`tsg_virt_${id}`);
      if (cached) {
        setHasRendered(JSON.parse(cached));
      }
    } catch {}
  }, [id]);

  useEffect(() => {
    if (!isMounted) return;
    const el = containerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setHasRendered(true);
            try {
              sessionStorage.setItem(`tsg_virt_${id}`, JSON.stringify(true));
            } catch {}
          }
        });
      },
      {
        rootMargin: "600px 0px", // Margin diperbesar agar elemen sudah siap jauh sebelum masuk viewport (mencegah kedip/loncat saat scroll cepat)
        threshold: 0,
      }
    );

    observer.observe(el);
    return () => {
      observer.unobserve(el);
    };
  }, [id, isMounted]);

  return (
    <div 
      ref={containerRef} 
      className={className} 
      data-virtualizer-id={id}
      style={{
        contentVisibility: isMounted && hasRendered ? "auto" : "initial",
        containIntrinsicSize: "auto 800px",
      }}
    >
      {isMounted && !hasRendered ? (
        <div style={{ minHeight: "400px" }} className="w-full flex items-center justify-center">
          {fallback || (
            <div className="py-12 text-zinc-500 text-sm animate-pulse">
              Memuat bagian...
            </div>
          )}
        </div>
      ) : (
        children
      )}
    </div>
  );
}
