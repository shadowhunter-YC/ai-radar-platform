"use client";

import { useState, useEffect } from "react";

const PROVIDER_PRESETS = {
  siliconflow: {
    label: "硅基流动 (SiliconFlow)",
    baseUrl: "https://api.siliconflow.cn/v1",
    defaultModel: "deepseek-ai/DeepSeek-V3",
    models: ["deepseek-ai/DeepSeek-V3", "deepseek-ai/DeepSeek-R1", "deepseek-ai/DeepSeek-V4-Pro", "Pro/deepseek-ai/DeepSeek-V3"]
  },
  deepseek: {
    label: "DeepSeek 官方 API",
    baseUrl: "https://api.deepseek.com/v1",
    defaultModel: "deepseek-chat",
    models: ["deepseek-chat", "deepseek-reasoner"]
  },
  openai: {
    label: "OpenAI 官方 API",
    baseUrl: "https://api.openai.com/v1",
    defaultModel: "gpt-4o-mini",
    models: ["gpt-4o-mini", "gpt-4o", "o3-mini"]
  },
  custom: {
    label: "自定义 / Ollama / OneAPI 中转",
    baseUrl: "http://127.0.0.1:11434/v1",
    defaultModel: "deepseek-r1:latest",
    models: ["deepseek-r1:latest", "qwen2.5:latest", "llama3.3:latest"]
  }
};

export default function LlmConfigModal({ isOpen, onClose, onSaved }) {
  const [activeTab, setActiveTab] = useState("llm"); // 'llm' | 'password'

  // LLM 配置状态
  const [provider, setProvider] = useState("siliconflow");
  const [baseUrl, setBaseUrl] = useState("https://api.siliconflow.cn/v1");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("deepseek-ai/DeepSeek-V3");
  const [temperature, setTemperature] = useState(0.3);
  const [maskedApiKey, setMaskedApiKey] = useState("");
  const [hasExistingKey, setHasExistingKey] = useState(false);
  const [showKey, setShowKey] = useState(false);

  // 状态反馈
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null); // { success: boolean, message: string }
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  // 修改密码状态
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwdLoading, setPwdLoading] = useState(false);
  const [pwdMsg, setPwdMsg] = useState("");
  const [pwdErr, setPwdErr] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    loadConfig();
  }, [isOpen]);

  async function loadConfig() {
    setLoading(true);
    setError("");
    setTestResult(null);
    try {
      const res = await fetch("/api/settings/llm");
      if (!res.ok) {
        if (res.status === 401) {
          throw new Error("请先登录系统后再配置大模型。");
        }
        throw new Error("读取大模型配置失败");
      }
      const data = await res.json();
      setProvider(data.provider || "siliconflow");
      setBaseUrl(data.baseUrl || "https://api.siliconflow.cn/v1");
      setModel(data.model || "deepseek-ai/DeepSeek-V3");
      setTemperature(typeof data.temperature === "number" ? data.temperature : 0.3);
      setHasExistingKey(Boolean(data.hasApiKey));
      setMaskedApiKey(data.maskedApiKey || "");
      setApiKey("");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function handleProviderChange(newProvider) {
    setProvider(newProvider);
    const preset = PROVIDER_PRESETS[newProvider];
    if (preset) {
      setBaseUrl(preset.baseUrl);
      setModel(preset.defaultModel);
    }
    setTestResult(null);
  }

  async function handleTest() {
    setTesting(true);
    setTestResult(null);
    setError("");
    try {
      const res = await fetch("/api/settings/llm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "test",
          provider,
          baseUrl,
          apiKey,
          model
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setTestResult({
          success: false,
          message: data.error || `连接失败 (HTTP ${res.status})`
        });
      } else {
        setTestResult({
          success: true,
          message: `接口响应正常，耗时 ${data.latencyMs}ms (模型: ${data.model})`
        });
      }
    } catch (err) {
      setTestResult({
        success: false,
        message: `测试异常: ${err.message || "网络错误"}`
      });
    } finally {
      setTesting(false);
    }
  }

  async function handleSave(e) {
    e.preventDefault();
    if (!hasExistingKey && !apiKey.trim()) {
      setError("请填写大模型 API Key");
      return;
    }

    setLoading(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/settings/llm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save",
          provider,
          baseUrl,
          apiKey,
          model,
          temperature
        })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "保存失败");
      }
      setMessage("大模型配置已更新并即时生效！");
      window.dispatchEvent(new CustomEvent('llm-config-change', { detail: data.config }));
      setHasExistingKey(true);
      if (data.config?.maskedApiKey) {
        setMaskedApiKey(data.config.maskedApiKey);
      }
      setApiKey("");
      if (onSaved) onSaved();
      setTimeout(() => setMessage(""), 3000);
    } catch (err) {
      setError(err.message || "保存配置异常");
    } finally {
      setLoading(false);
    }
  }

  async function handleChangePassword(e) {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setPwdErr("两次输入的新密码不一致");
      return;
    }
    if (newPassword.length < 6) {
      setPwdErr("新密码长度不能少于 6 位");
      return;
    }

    setPwdLoading(true);
    setPwdErr("");
    setPwdMsg("");
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "change_password",
          oldPassword,
          newPassword
        })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "修改密码失败");
      }
      setPwdMsg("密码修改成功！请牢记新密码。");
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => setPwdMsg(""), 4000);
    } catch (err) {
      setPwdErr(err.message || "修改密码失败");
    } finally {
      setPwdLoading(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(15,23,42,0.45)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1300,
        padding: 16
      }}
    >
      <div
        style={{
          background: "var(--color-surface, #ffffff)",
          border: "1px solid var(--color-border)",
          borderRadius: 10,
          maxWidth: 600,
          width: "100%",
          padding: 24,
          boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
          maxHeight: "92vh",
          overflowY: "auto"
        }}
      >
        {/* 标题栏 */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            borderBottom: "1px solid var(--color-border)",
            paddingBottom: 14
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <strong style={{ fontSize: 18, color: "var(--color-text)" }}>系统设置中心</strong>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "transparent",
              border: 0,
              color: "var(--color-text-secondary)",
              fontSize: 22,
              cursor: "pointer",
              padding: 0
            }}
          >
            ×
          </button>
        </div>

        {/* 顶部 Tab 切换 */}
        <div
          style={{
            display: "flex",
            gap: 12,
            borderBottom: "1px solid var(--color-border)",
            marginTop: 14,
            paddingBottom: 10
          }}
        >
          <button
            type="button"
            onClick={() => setActiveTab("llm")}
            style={{
              background: activeTab === "llm" ? "rgba(134,188,37,0.14)" : "transparent",
              color: activeTab === "llm" ? "var(--color-brand-strong)" : "var(--color-text-secondary)",
              border: "1px solid",
              borderColor: activeTab === "llm" ? "var(--color-brand)" : "transparent",
              padding: "6px 14px",
              borderRadius: 4,
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer"
            }}
          >
            大模型配置 (LLM)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("password")}
            style={{
              background: activeTab === "password" ? "rgba(134,188,37,0.14)" : "transparent",
              color: activeTab === "password" ? "var(--color-brand-strong)" : "var(--color-text-secondary)",
              border: "1px solid",
              borderColor: activeTab === "password" ? "var(--color-brand)" : "transparent",
              padding: "6px 14px",
              borderRadius: 4,
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer"
            }}
          >
            修改管理员密码
          </button>
        </div>

        {activeTab === "llm" ? (
          /* 大模型配置表单 */
          <form onSubmit={handleSave} style={{ display: "grid", gap: 16, marginTop: 18 }}>
            {message && (
              <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", color: "#15803d", padding: "10px 14px", borderRadius: 4, fontSize: 13 }}>
                {message}
              </div>
            )}
            {error && (
              <div style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#991b1b", padding: "10px 14px", borderRadius: 4, fontSize: 13 }}>
                错误：{error}
              </div>
            )}

            {/* 服务商快捷预选 */}
            <label style={{ display: "grid", gap: 6, fontSize: 13, color: "var(--color-text)" }}>
              <span>服务商模板</span>
              <select
                value={provider}
                onChange={(e) => handleProviderChange(e.target.value)}
                style={{
                  minHeight: 38,
                  padding: "8px 10px",
                  background: "var(--color-page)",
                  border: "1px solid var(--color-border)",
                  borderRadius: 4,
                  color: "var(--color-text)"
                }}
              >
                {Object.entries(PROVIDER_PRESETS).map(([k, p]) => (
                  <option key={k} value={k}>{p.label}</option>
                ))}
              </select>
            </label>

            {/* API Base URL */}
            <label style={{ display: "grid", gap: 6, fontSize: 13, color: "var(--color-text)" }}>
              <span>API Base URL <strong style={{ color: "var(--color-danger)" }}>*</strong></span>
              <input
                type="url"
                required
                placeholder="https://api.siliconflow.cn/v1"
                value={baseUrl}
                onChange={(e) => {
                  setBaseUrl(e.target.value);
                  setTestResult(null);
                }}
                style={{
                  minHeight: 38,
                  padding: "8px 10px",
                  background: "var(--color-page)",
                  border: "1px solid var(--color-border)",
                  borderRadius: 4,
                  color: "var(--color-text)"
                }}
              />
            </label>

            {/* API Key */}
            <label style={{ display: "grid", gap: 6, fontSize: 13, color: "var(--color-text)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span>API Key <strong style={{ color: "var(--color-danger)" }}>*</strong></span>
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  style={{ background: "transparent", border: 0, color: "var(--color-brand-strong)", cursor: "pointer", fontSize: 12, padding: 0 }}
                >
                  {showKey ? "隐藏" : "显示明文"}
                </button>
              </div>
              <input
                type={showKey ? "text" : "password"}
                placeholder={hasExistingKey ? `已配置: ${maskedApiKey} (留空则保持不变)` : "例如：sk-xxxxxxxxxxxxxx"}
                value={apiKey}
                onChange={(e) => {
                  setApiKey(e.target.value);
                  setTestResult(null);
                }}
                style={{
                  minHeight: 38,
                  padding: "8px 10px",
                  background: "var(--color-page)",
                  border: "1px solid var(--color-border)",
                  borderRadius: 4,
                  color: "var(--color-text)"
                }}
              />
              <small style={{ color: "var(--color-text-muted)", fontSize: 11 }}>
                {hasExistingKey ? `当前已存在密钥 (${maskedApiKey})，若无需变更可留空` : "请输入大模型平台提供的 API 密钥"}
              </small>
            </label>

            {/* Model 名称 */}
            <label style={{ display: "grid", gap: 6, fontSize: 13, color: "var(--color-text)" }}>
              <span>模型名称 (Model) <strong style={{ color: "var(--color-danger)" }}>*</strong></span>
              <input
                type="text"
                required
                placeholder="例如：deepseek-ai/DeepSeek-V3"
                value={model}
                onChange={(e) => {
                  setModel(e.target.value);
                  setTestResult(null);
                }}
                style={{
                  minHeight: 38,
                  padding: "8px 10px",
                  background: "var(--color-page)",
                  border: "1px solid var(--color-border)",
                  borderRadius: 4,
                  color: "var(--color-text)"
                }}
              />
              {PROVIDER_PRESETS[provider]?.models?.length > 0 && (
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 4 }}>
                  <span style={{ fontSize: 11, color: "var(--color-text-muted)" }}>常用推荐:</span>
                  {PROVIDER_PRESETS[provider].models.map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setModel(m)}
                      style={{
                        background: model === m ? "rgba(134,188,37,0.14)" : "var(--color-page)",
                        color: model === m ? "var(--color-brand-strong)" : "var(--color-text-secondary)",
                        border: "1px solid",
                        borderColor: model === m ? "var(--color-brand)" : "var(--color-border)",
                        padding: "2px 7px",
                        borderRadius: 3,
                        fontSize: 11,
                        cursor: "pointer"
                      }}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              )}
            </label>

            {/* 连通性测试结果面板 */}
            {testResult && (
              <div
                style={{
                  background: testResult.ok ? "#f0fdf4" : "#fef2f2",
                  border: `1px solid ${testResult.ok ? "#bbf7d0" : "#fecaca"}`,
                  color: testResult.ok ? "#15803d" : "#991b1b",
                  padding: "10px 14px",
                  borderRadius: 4,
                  fontSize: 12,
                  lineHeight: 1.5
                }}
              >
                {testResult.message}
              </div>
            )}

            {/* 底部操作行 */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                borderTop: "1px solid var(--color-border)",
                paddingTop: 16,
                marginTop: 8
              }}
            >
              <button
                type="button"
                onClick={handleTest}
                disabled={testing || (!hasExistingKey && !apiKey.trim())}
                style={{
                  background: "rgba(134,188,37,0.14)",
                  color: "var(--color-brand-strong)",
                  border: "1px solid rgba(134,188,37,0.35)",
                  borderRadius: 4,
                  padding: "8px 14px",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: testing ? "not-allowed" : "pointer"
                }}
              >
                {testing ? "正在探测连通性…" : "测试连通性"}
              </button>

              <div style={{ display: "flex", gap: 10 }}>
                <button
                  type="button"
                  onClick={onClose}
                  className="button button--secondary"
                  style={{ padding: "8px 16px", fontSize: 13 }}
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="button button--primary"
                  style={{ padding: "8px 18px", fontSize: 13 }}
                >
                  {loading ? "正在保存…" : "保存配置"}
                </button>
              </div>
            </div>
          </form>
        ) : (
          /* 修改密码表单 */
          <form onSubmit={handleChangePassword} style={{ display: "grid", gap: 16, marginTop: 18 }}>
            {pwdMsg && (
              <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", color: "#15803d", padding: "10px 14px", borderRadius: 4, fontSize: 13 }}>
                {pwdMsg}
              </div>
            )}
            {pwdErr && (
              <div style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#991b1b", padding: "10px 14px", borderRadius: 4, fontSize: 13 }}>
                错误：{pwdErr}
              </div>
            )}

            <label style={{ display: "grid", gap: 6, fontSize: 13, color: "var(--color-text)" }}>
              <span>原密码</span>
              <input
                type="password"
                required
                placeholder="请输入当前密码（初始默认 admin123456）"
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                style={{
                  minHeight: 38,
                  padding: "8px 10px",
                  background: "var(--color-page)",
                  border: "1px solid var(--color-border)",
                  borderRadius: 4,
                  color: "var(--color-text)"
                }}
              />
            </label>

            <label style={{ display: "grid", gap: 6, fontSize: 13, color: "var(--color-text)" }}>
              <span>新密码 (不少于 6 位)</span>
              <input
                type="password"
                required
                placeholder="请输入新密码"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                style={{
                  minHeight: 38,
                  padding: "8px 10px",
                  background: "var(--color-page)",
                  border: "1px solid var(--color-border)",
                  borderRadius: 4,
                  color: "var(--color-text)"
                }}
              />
            </label>

            <label style={{ display: "grid", gap: 6, fontSize: 13, color: "var(--color-text)" }}>
              <span>确认新密码</span>
              <input
                type="password"
                required
                placeholder="请再次输入新密码"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                style={{
                  minHeight: 38,
                  padding: "8px 10px",
                  background: "var(--color-page)",
                  border: "1px solid var(--color-border)",
                  borderRadius: 4,
                  color: "var(--color-text)"
                }}
              />
            </label>

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: 10,
                borderTop: "1px solid var(--color-border)",
                paddingTop: 16,
                marginTop: 8
              }}
            >
              <button
                type="button"
                onClick={onClose}
                className="button button--secondary"
                style={{ padding: "8px 16px", fontSize: 13 }}
              >
                取消
              </button>
              <button
                type="submit"
                disabled={pwdLoading}
                className="button button--primary"
                style={{ padding: "8px 18px", fontSize: 13 }}
              >
                {pwdLoading ? "正在更新…" : "确认修改密码"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
