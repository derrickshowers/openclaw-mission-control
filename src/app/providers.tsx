"use client";

import { HeroUIProvider } from "@heroui/react";
import { SessionProvider } from "next-auth/react";
import { useRouter } from "next/navigation";
import { SSEProvider } from "@/hooks/use-sse";

export function Providers({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  return (
    <SessionProvider>
      <SSEProvider>
        <HeroUIProvider navigate={router.push}>
          {children}
        </HeroUIProvider>
      </SSEProvider>
    </SessionProvider>
  );
}
