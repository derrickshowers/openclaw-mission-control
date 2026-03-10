import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { Sidebar } from "@/components/shell/sidebar";
import { MobileNav } from "@/components/shell/mobile-nav";
import { TopBar } from "@/components/shell/top-bar";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-plus-jakarta",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Mission Control",
  description: "Raincheck Mission Control Dashboard",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`dark ${plusJakarta.variable}`}>
      <body className="bg-[#07070b] text-white antialiased font-sans">
        <Providers>
          <div className="flex h-screen overflow-hidden">
            {/* Desktop Sidebar */}
            <div className="hidden lg:block">
              <Sidebar />
            </div>

            {/* Main Content */}
            <div className="flex flex-1 flex-col overflow-hidden">
              <TopBar />
              <main className="flex-1 overflow-y-auto px-2 pb-20 pt-3 lg:px-5 lg:pb-6 lg:pt-4">
                {children}
              </main>
            </div>

            {/* Mobile Bottom Nav */}
            <div className="lg:hidden">
              <MobileNav />
            </div>
          </div>
        </Providers>
      </body>
    </html>
  );
}
