"use client";

import { Button } from "@heroui/react";
import { signIn } from "next-auth/react";

const authBypass = process.env.NEXT_PUBLIC_AUTH_BYPASS === "true";

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
        {authBypass ? (
          <Button
            fullWidth
            variant="flat"
            className="border border-[#333333] bg-[#1a1a2e]"
            onPress={() => signIn("dev-bypass", { callbackUrl: "/" })}
          >
            Sign in as Dev User
          </Button>
        ) : (
          <Button
            fullWidth
            variant="flat"
            className="border border-[#222222] bg-[#080808]"
            onPress={() => signIn("google", { callbackUrl: "/" })}
          >
            Sign in with Google
          </Button>
        )}
        <p className="text-center text-xs text-[#555555]">
          {authBypass ? "Dev mode — auth bypass enabled" : "Authorized users only"}
        </p>
      </div>
    </div>
  );
}
