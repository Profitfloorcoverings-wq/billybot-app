"use server";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET() {
  const cookieStore = await cookies();

  const tokens = ["sb-access-token", "sb-refresh-token"];
  const response = NextResponse.redirect("/auth/login");

  tokens.forEach((name) => {
    const existing = cookieStore.get(name);
    if (existing) {
      response.cookies.set({
        name,
        value: "",
        path: "/",
        maxAge: 0,
      });
    }
  });

  return response;
}
