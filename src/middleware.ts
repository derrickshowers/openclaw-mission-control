export { auth as middleware } from "@/lib/auth";

export const config = {
  matcher: [
    // Protect everything except auth routes, API proxy routes, uploads, avatars, core static files, PWA assets, and _next
    "/((?!api/auth|api/proxy|api/mc/uploads|api/mc/agents/.*/avatar|login|_next/static|_next/image|favicon.ico|icon\\.svg|manifest\\.webmanifest|sw\\.js|pwa/).*)",
  ],
};
