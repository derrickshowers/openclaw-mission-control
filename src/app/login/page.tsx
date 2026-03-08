"use client";

import { Button } from "@heroui/react";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#080808]">
      <div className="w-full max-w-sm space-y-6 rounded border border-[#222222] bg-[#121212] p-8">
        <div className="text-center">
          <h1 className="text-xl font-semibold">☔ Mission Control</h1>
          <p className="mt-2 text-sm text-[#888888]">
            Raincheck Dashboard
          </p>
        </div>
        <Button
          fullWidth
          variant="flat"
          className="border border-[#222222] bg-[#080808]"
          onPress={() => {
            // NextAuth sign in with Google
            window.location.href = "/api/auth/signin/google";
          }}
        >
          Sign in with Google
        </Button>
        <p className="text-center text-xs text-[#555555]">
          Authorized users only
        </p>
      </div>
    </div>
  );
}
