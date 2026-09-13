"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get("from") || "/";

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    // 检查是否已经登录
    fetch("/api/auth")
      .then((res) => res.json())
      .then((data) => {
        if (data.loggedIn) {
          router.replace(from);
        }
      })
      .catch(() => {})
      .finally(() => setChecking(false));
  }, [from, router]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError("请输入用户名和密码");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "login", username, password })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "登录失败");
      }

      // 登录成功，跳转
      router.push(from);
      router.refresh();
    } catch (err) {
      setError(err.message || "登录出现异常，请稍后重试");
    } finally {
      setLoading(false);
    }
  }

  if (checking) {
    return (
      <div style={{ color: "var(--color-text-secondary)", fontSize: 14 }}>
        正在检查登录状态…
      </div>
    );
  }

  return (
    <div
      style={{
        width: "100%",
        maxWidth: 420,
        background: "var(--color-surface, #ffffff)",
        border: "1px solid var(--color-border)",
        borderRadius: 12,
        padding: "36px 32px",
        boxShadow: "0 16px 40px rgba(0,0,0,0.08)",
        position: "relative",
        zIndex: 10
      }}
    >
      {/* 头部 Branding */}
      <div style={{ textAlign: "center", marginBottom: 28 }}>
        <div
          style={{
            width: 48,
            height: 48,
            margin: "0 auto 14px",
            borderRadius: 8,
            background: "#86bc25",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 16,
            fontWeight: 700,
            color: "#ffffff",
            boxShadow: "0 4px 14px rgba(134,188,37,0.3)"
          }}
        >
          AI
        </div>
        <h1 style={{ margin: "0 0 6px", fontSize: 20, color: "var(--color-text, #111827)", fontWeight: 700 }}>
          AI安全合规雷达<span style={{ color: "#86bc25", fontSize: "1.2em", marginLeft: 2 }}>.</span>
        </h1>
        <p style={{ margin: 0, fontSize: 13, color: "var(--color-text-secondary, #4b5563)" }}>
          系统管理与大模型配置认证
        </p>
      </div>

      {error && (
        <div
          style={{
            background: "#fef2f2",
            border: "1px solid #fecaca",
            color: "#991b1b",
            padding: "10px 14px",
            borderRadius: 6,
            fontSize: 13,
            marginBottom: 20,
            display: "flex",
            alignItems: "center",
            gap: 8
          }}
        >
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#dc2626", flexShrink: 0 }} />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: "grid", gap: 18 }}>
        <label style={{ display: "grid", gap: 6, fontSize: 13, color: "var(--color-text, #111827)" }}>
          <span>用户名</span>
          <input
            type="text"
            required
            autoComplete="username"
            placeholder="请输入管理员账号"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            style={{
              minHeight: 42,
              padding: "9px 12px",
              background: "var(--color-page, #f8f9fa)",
              border: "1px solid var(--color-border, #e5e7eb)",
              borderRadius: 6,
              color: "var(--color-text, #111827)",
              fontSize: 14,
              outline: "none"
            }}
          />
        </label>

        <label style={{ display: "grid", gap: 6, fontSize: 13, color: "var(--color-text, #111827)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>登录密码</span>
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              style={{
                background: "transparent",
                border: 0,
                color: "var(--color-brand-strong, #15803d)",
                cursor: "pointer",
                fontSize: 12,
                padding: 0
              }}
            >
              {showPassword ? "隐藏" : "显示"}
            </button>
          </div>
          <input
            type={showPassword ? "text" : "password"}
            required
            autoComplete="current-password"
            placeholder="请输入管理员密码"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{
              minHeight: 42,
              padding: "9px 12px",
              background: "var(--color-page, #f8f9fa)",
              border: "1px solid var(--color-border, #e5e7eb)",
              borderRadius: 6,
              color: "var(--color-text, #111827)",
              fontSize: 14,
              outline: "none"
            }}
          />
        </label>

        <button
          type="submit"
          disabled={loading}
          style={{
            minHeight: 42,
            marginTop: 6,
            background: "var(--color-brand, #86bc25)",
            color: "#ffffff",
            border: "none",
            borderRadius: 6,
            fontWeight: 700,
            fontSize: 14,
            cursor: loading ? "not-allowed" : "pointer",
            opacity: loading ? 0.7 : 1,
            transition: "all 0.15s ease",
            boxShadow: "0 4px 14px rgba(134,188,37,0.25)"
          }}
        >
          {loading ? "正在验证身份…" : "立即登录"}
        </button>
      </form>

      {/* 底部初始提示与返回 */}
      <div
        style={{
          marginTop: 24,
          paddingTop: 18,
          borderTop: "1px solid var(--color-border, #e5e7eb)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontSize: 12,
          color: "var(--color-text-muted, #6b7280)"
        }}
      >
        <span>安全合规认证 · 内部受控访问</span>
        <Link
          href="/"
          style={{
            color: "var(--color-brand-strong, #15803d)",
            textDecoration: "none",
            fontWeight: 500
          }}
        >
          返回大屏 →
        </Link>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "radial-gradient(ellipse at 50% 15%, rgba(134,188,37,0.08) 0%, transparent 60%), #f8f9fa",
        padding: 20
      }}
    >
      <Suspense fallback={<div style={{ color: "var(--color-text-secondary)" }}>加载中…</div>}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
