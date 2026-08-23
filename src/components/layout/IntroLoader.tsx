"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";

const WORDS = [
  { id: "together", text: "Together", delay: 0.3 },
  { id: "wemake", text: "We Make", delay: 1.8 },
  { id: "abetter", text: "A Better", delay: 3.3 },
  { id: "future", text: "Future", delay: 4.8 },
];

const HOLD_AFTER_COMPLETE = 1800;
const LAST_WORD_FINISH = 3000 + 1800;
const TOTAL_DURATION = LAST_WORD_FINISH + HOLD_AFTER_COMPLETE;

export function IntroLoader() {
  const [mounted, setMounted] = useState(false);
  const [show, setShow] = useState(false);

  useEffect(() => {
    setMounted(true);

    const seen = sessionStorage.getItem("tsg-intro-seen");

    if (!seen) {
      sessionStorage.setItem("tsg-intro-seen", "1");
      setShow(true);
    }
  }, []);

  useEffect(() => {
    document.body.style.overflow = show ? "hidden" : "";

    return () => {
      document.body.style.overflow = "";
    };
  }, [show]);

  useEffect(() => {
    if (!show) return;

    const timer = setTimeout(() => {
      setShow(false);
    }, TOTAL_DURATION);

    return () => clearTimeout(timer);
  }, [show]);

  if (!mounted) return null;

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ y: 0 }}
          animate={{ y: 0 }}
          exit={{ y: "-100%" }}
          transition={{
            duration: 1.4,
            ease: [0.22, 1, 0.36, 1],
          }}
          className="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden bg-[#020617]"
        >
          <motion.div
            initial={{
              opacity: 0,
              scale: 0.8,
            }}
            animate={{
              opacity: 1,
              scale: 1,
            }}
            transition={{
              duration: 2.5,
            }}
            className="absolute h-[280px] w-[280px] rounded-full bg-cyan-400/10 blur-[120px] sm:h-[340px] sm:w-[340px]"
          />

          <div className="relative px-6 text-center">
            <div
              className="
                font-display
                font-bold
                text-white
                leading-[1.05]
                text-[clamp(2rem,8vw,4.8rem)]
              "
            >
              <div className="whitespace-nowrap">
                <motion.span
                  initial={{
                    opacity: 0,
                    y: 30,
                  }}
                  animate={{
                    opacity: 1,
                    y: 0,
                  }}
                  transition={{
                    delay: WORDS[0].delay,
                    duration: 1.8,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                >
                  Together
                </motion.span>

                {" "}
                <motion.span
                  initial={{
                    opacity: 0,
                    y: 30,
                  }}
                  animate={{
                    opacity: 1,
                    y: 0,
                  }}
                  transition={{
                    delay: WORDS[1].delay,
                    duration: 1.8,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                >
                  We Make
                </motion.span>
              </div>

              <div className="mt-2 whitespace-nowrap sm:mt-4">
                <motion.span
                  initial={{
                    opacity: 0,
                    y: 30,
                  }}
                  animate={{
                    opacity: 1,
                    y: 0,
                  }}
                  transition={{
                    delay: WORDS[2].delay,
                    duration: 1.8,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                >
                  A Better
                </motion.span>

                {" "}

                <motion.span
                  initial={{
                    opacity: 0,
                    y: 30,
                  }}
                  animate={{
                    opacity: 1,
                    y: 0,
                  }}
                  transition={{
                    delay: WORDS[3].delay,
                    duration: 1.8,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                >
                  Future
                </motion.span>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
