import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email, category, message } = body;

    if (!message || !message.trim()) {
      return NextResponse.json(
        { error: "お問い合わせ内容は必須です。" },
        { status: 400 }
      );
    }

    // Save to database
    const stmt = db.prepare(
      "INSERT INTO contact_messages (name, email, category, message) VALUES (?, ?, ?, ?)"
    );
    stmt.run(
      name?.trim() || null,
      email?.trim() || null,
      category || "一般的なお問い合わせ",
      message.trim()
    );

    // Send email notification via Web3Forms
    try {
      await fetch("https://api.web3forms.com/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          access_key: "7993188c-b39f-447d-8897-1d30f0aa30b6",
          subject: `[パネマジ掲示板] ${category || "お問い合わせ"}`,
          from_name: name?.trim() || "匿名",
          email: email?.trim() || "noreply@panemaji.com",
          message: `【種別】${category}\n【名前】${name || "未入力"}\n【メール】${email || "未入力"}\n\n${message}`,
        }),
      });
    } catch {
      // Web3Forms failure is non-critical; DB save already succeeded
      console.error("Web3Forms notification failed");
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Contact form error:", error);
    return NextResponse.json(
      { error: "送信に失敗しました。しばらく経ってからお試しください。" },
      { status: 500 }
    );
  }
}
