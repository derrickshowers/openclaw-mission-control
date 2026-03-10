import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";

// Only these Google emails can access the dashboard
const ALLOWED_EMAILS = (process.env.ALLOWED_EMAILS || "").split(",").map(e => e.trim().toLowerCase()).filter(Boolean);

// Dev-only auth bypass — never active in production
const authBypass =
  process.env.NODE_ENV !== "production" &&
  process.env.AUTH_BYPASS === "true";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    }),
    // Dev-only credentials provider for local testing without Google OAuth
    ...(authBypass
      ? [
          Credentials({
            id: "dev-bypass",
            name: "Dev Login",
            credentials: {},
            async authorize() {
              return {
                id: "dev-user",
                name: "Dev User",
                email: "dev@localhost",
              };
            },
          }),
        ]
      : []),
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
