"use client";

import { HeroUIProvider } from "@heroui/react";
import { SessionProvider } from "next-auth/react";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import { useRouter } from "next/navigation";
import { SSEProvider } from "@/hooks/use-sse";

export function Providers({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  return (
    <SessionProvider>
      <SSEProvider>
        <NextThemesProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
        >
          <HeroUIProvider navigate={router.push}>
            {children}
          </HeroUIProvider>
        </NextThemesProvider>
      </SSEProvider>
    </SessionProvider>
  );
}
