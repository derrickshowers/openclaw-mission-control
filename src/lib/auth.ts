import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

// Only these Google emails can access the dashboard
const ALLOWED_EMAILS = (process.env.ALLOWED_EMAILS || "").split(",").map(e => e.trim().toLowerCase()).filter(Boolean);

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    }),
  ],
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async signIn({ user }) {
      // If no allowlist configured, allow anyone (dev mode)
      if (ALLOWED_EMAILS.length === 0) return true;
      // Only allow emails on the list
      const email = user.email?.toLowerCase() || "";
      return ALLOWED_EMAILS.includes(email);
    },
    authorized({ auth, request }) {
      const isLoggedIn = !!auth?.user;
      const isOnLogin = request.nextUrl.pathname.startsWith("/login");

      if (isOnLogin) {
        if (isLoggedIn) return Response.redirect(new URL("/", request.nextUrl));
        return true;
      }

      return isLoggedIn;
    },
  },
});
