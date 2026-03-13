"use client";

import { Button } from "@heroui/react";
import { signIn } from "next-auth/react";

const authBypass = process.env.NEXT_PUBLIC_AUTH_BYPASS === "true";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-[#080808]">
      <div className="w-full max-w-sm space-y-6 rounded border border-gray-200 dark:border-[#222222] bg-white dark:bg-[#121212] p-8 shadow-sm dark:shadow-none">
        <div className="text-center">
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">☔ Mission Control</h1>
          <p className="mt-2 text-sm text-gray-500 dark:text-[#888888]">
            Raincheck Dashboard
          </p>
        </div>
        {authBypass ? (
          <Button
            fullWidth
            variant="flat"
            className="border border-gray-200 dark:border-[#333333] bg-gray-50 dark:bg-[#1a1a2e]"
            onPress={() => signIn("dev-bypass", { callbackUrl: "/" })}
          >
            Sign in as Dev User
          </Button>
        ) : (
          <Button
            fullWidth
            variant="flat"
            className="border border-gray-200 dark:border-[#222222] bg-white dark:bg-[#080808]"
            onPress={() => signIn("google", { callbackUrl: "/" })}
          >
            Sign in with Google
          </Button>
        )}
        <p className="text-center text-xs text-gray-500 dark:text-[#666666]">
          {authBypass ? "Dev mode — auth bypass enabled" : "Authorized users only"}
        </p>
      </div>
    </div>
  );
}
