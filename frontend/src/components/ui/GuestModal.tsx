import * as Dialog from "@radix-ui/react-dialog";
import { motion } from "framer-motion";
import { getGoogleLoginUrl } from "@/services/authApi";

export interface GuestModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  message?: string;
}

export function GuestModal({ open, onOpenChange, message }: GuestModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="data-[state=open]:animate-in fade-in fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm duration-200" />
        <Dialog.Content className="fixed top-1/2 left-1/2 z-[100] w-[min(calc(100vw-2rem),400px)] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-zinc-200 bg-white p-5 shadow-lg outline-none focus-visible:ring-2 focus-visible:ring-purple-500 dark:border-zinc-800 dark:bg-zinc-900">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            <Dialog.Title className="text-base font-semibold text-zinc-900 dark:text-white">
              Save your library
            </Dialog.Title>
            <Dialog.Description className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
              {message ??
                "Sign in to save your music across sessions. Playback and search stay available when you skip this."}
            </Dialog.Description>

            <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Dialog.Close asChild>
                <button
                  type="button"
                  className="order-2 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm font-medium text-zinc-800 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700 sm:order-1"
                >
                  Maybe later
                </button>
              </Dialog.Close>
              <a
                href={getGoogleLoginUrl()}
                onClick={() => {
                  try {
                    sessionStorage.setItem(
                      "lyrix_return_path",
                      window.location.pathname + window.location.search
                    );
                  } catch { /* sessionStorage unavailable */ }
                }}
                className="order-1 inline-flex items-center justify-center rounded-lg bg-purple-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-purple-700 sm:order-2"
              >
                Sign in with Google
              </a>
            </div>
          </motion.div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
