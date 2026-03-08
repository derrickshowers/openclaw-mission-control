export { auth as middleware } from "@/lib/auth";

export const config = {
  matcher: [
    // Protect everything except auth routes, static files, and _next
    "/((?!api/auth|login|_next/static|_next/image|favicon.ico).*)",
  ],
};
