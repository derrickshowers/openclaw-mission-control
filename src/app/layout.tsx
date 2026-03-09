import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { Sidebar } from "@/components/shell/sidebar";
import { MobileNav } from "@/components/shell/mobile-nav";
import { TopBar } from "@/components/shell/top-bar";

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
    <html lang="en" className="dark">
      <body className="bg-[#080808] text-white antialiased font-sans">
        <Providers>
          <div className="flex h-screen overflow-hidden">
            {/* Desktop Sidebar */}
            <div className="hidden lg:block">
              <Sidebar />
            </div>

            {/* Main Content */}
            <div className="flex flex-1 flex-col overflow-hidden">
              <TopBar />
              <main className="flex-1 overflow-y-auto p-4 lg:p-6">
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
