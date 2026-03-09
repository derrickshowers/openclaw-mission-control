export { auth as middleware } from "@/lib/auth";

export const config = {
  matcher: [
    // Protect everything except auth routes, API proxy routes, uploads, static files, and _next
    "/((?!api/auth|api/proxy|api/mc/uploads|login|_next/static|_next/image|favicon.ico|icon\\.svg).*)",
  ],
};
