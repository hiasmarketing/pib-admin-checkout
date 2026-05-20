"use client";

import { useState, useCallback } from "react";

type Patterns = {
  sources: string[];
  mediums: string[];
  campaigns: string[];
  contents: string[];
};

type Props = {
  patterns: Patterns;
  defaultBaseUrl: string;
};

const CHANNEL_SHORTCUTS = [
  { label: "Instagram", source: "instagram", medium: "social" },
  { label: "WhatsApp", source: "whatsapp", medium: "social" },
  { label: "YouTube", source: "youtube", medium: "video" },
  { label: "Google Ads", source: "google", medium: "cpc" },
  { label: "E-mail", source: "email", medium: "email" },
];

function buildUrl(base: string, params: Record<string, string>): string {
  if (!base) return "";
  const filled = Object.entries(params).filter(([, v]) => v.trim() !== "");
  if (filled.length === 0) return base;
  const qs = filled.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v.trim())}`).join("&");
  return `${base.trim()}${base.includes("?") ? "&" : "?"}${qs}`;
}

export function UtmBuilderClient({ patterns, defaultBaseUrl }: Props) {
  const [baseUrl, setBaseUrl] = useState(defaultBaseUrl);
  const [source, setSource] = useState("");
  const [medium, setMedium] = useState("");
  const [campaign, setCampaign] = useState("");
  const [content, setContent] = useState("");
  const [term, setTerm] = useState("");
  const [copied, setCopied] = useState(false);

  const generatedUrl = buildUrl(baseUrl, {
    utm_source: source,
    utm_medium: medium,
    utm_campaign: campaign,
    utm_content: content,
    utm_term: term,
  });

  const handleCopy = useCallback(async () => {
    if (!generatedUrl) return;
    try {
      await navigator.clipboard.writeText(generatedUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // silencioso em HTTP
    }
  }, [generatedUrl]);

  const inputStyle = {
    background: "var(--admin-surface-elevated)",
    color: "var(--admin-fg)",
    borderColor: "var(--admin-border)",
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Builder */}
      <div className="lg:col-span-2 space-y-4">
        {/* Atalhos de canal */}
        <div>
          <div className="text-xs uppercase tracking-wider mb-2" style={{ color: "var(--admin-muted)" }}>
            Canal
          </div>
          <div className="flex flex-wrap gap-2">
            {CHANNEL_SHORTCUTS.map((ch) => (
              <button
                key={ch.label}
                type="button"
                onClick={() => {
                  setSource(ch.source);
                  setMedium(ch.medium);
                }}
                className="px-3 py-1.5 rounded-full text-sm border transition-colors"
                style={{
                  borderColor: source === ch.source && medium === ch.medium ? "var(--admin-brand)" : "var(--admin-border)",
                  color: source === ch.source && medium === ch.medium ? "var(--admin-brand)" : "var(--admin-muted)",
                  background: "var(--admin-surface-elevated)",
                }}
              >
                {ch.label}
              </button>
            ))}
          </div>
        </div>

        {/* Campos */}
        <div className="space-y-3">
          <div>
            <label className="text-xs uppercase tracking-wider mb-1 block" style={{ color: "var(--admin-muted)" }}>
              URL base
            </label>
            <input
              type="url"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder={defaultBaseUrl}
              className="w-full rounded-lg px-3 py-2 text-sm border"
              style={inputStyle}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs uppercase tracking-wider mb-1 block" style={{ color: "var(--admin-muted)" }}>
                utm_source
              </label>
              <input
                type="text"
                value={source}
                onChange={(e) => setSource(e.target.value)}
                className="w-full rounded-lg px-3 py-2 text-sm border"
                style={inputStyle}
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wider mb-1 block" style={{ color: "var(--admin-muted)" }}>
                utm_medium
              </label>
              <input
                type="text"
                value={medium}
                onChange={(e) => setMedium(e.target.value)}
                className="w-full rounded-lg px-3 py-2 text-sm border"
                style={inputStyle}
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wider mb-1 block" style={{ color: "var(--admin-muted)" }}>
                utm_campaign
              </label>
              <input
                type="text"
                value={campaign}
                onChange={(e) => setCampaign(e.target.value)}
                className="w-full rounded-lg px-3 py-2 text-sm border"
                style={inputStyle}
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wider mb-1 block" style={{ color: "var(--admin-muted)" }}>
                utm_content
              </label>
              <input
                type="text"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="w-full rounded-lg px-3 py-2 text-sm border"
                style={inputStyle}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs uppercase tracking-wider mb-1 block" style={{ color: "var(--admin-muted)" }}>
                utm_term
              </label>
              <input
                type="text"
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                className="w-full rounded-lg px-3 py-2 text-sm border"
                style={inputStyle}
              />
            </div>
          </div>
        </div>

        {/* URL gerada */}
        {generatedUrl && (
          <div className="rounded-xl border p-4" style={{ background: "var(--admin-surface)", borderColor: "var(--admin-border)" }}>
            <div className="text-xs uppercase tracking-wider mb-2" style={{ color: "var(--admin-muted)" }}>
              URL gerada
            </div>
            <div
              className="text-sm break-all mb-3 font-mono"
              style={{ color: "var(--admin-fg)" }}
            >
              {generatedUrl}
            </div>
            <button
              type="button"
              onClick={handleCopy}
              className="px-4 py-2 rounded-lg text-sm font-medium text-white"
              style={{ background: copied ? "var(--admin-success, #22c55e)" : "var(--admin-brand)" }}
            >
              {copied ? "Copiado!" : "Copiar URL"}
            </button>
          </div>
        )}
      </div>

      {/* Sidebar de padrões */}
      <div className="space-y-4">
        <div className="rounded-xl border p-4" style={{ background: "var(--admin-surface)", borderColor: "var(--admin-border)" }}>
          <div className="text-sm font-medium mb-4" style={{ color: "var(--admin-fg)" }}>
            Padrões da base
          </div>

          {([
            { label: "Sources", values: patterns.sources, setter: setSource },
            { label: "Mediums", values: patterns.mediums, setter: setMedium },
            { label: "Campaigns", values: patterns.campaigns, setter: setCampaign },
            { label: "Contents", values: patterns.contents, setter: setContent },
          ] as const).map(({ label, values, setter }) =>
            values.length > 0 ? (
              <div key={label} className="mb-4">
                <div className="text-xs uppercase tracking-wider mb-2" style={{ color: "var(--admin-muted)" }}>
                  {label}
                </div>
                <div className="flex flex-wrap gap-1">
                  {values.map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setter(v)}
                      className="px-2 py-1 rounded text-xs border hover:border-[var(--admin-brand)] transition-colors"
                      style={{
                        background: "var(--admin-surface-elevated)",
                        color: "var(--admin-muted)",
                        borderColor: "var(--admin-border)",
                      }}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>
            ) : null
          )}

          {patterns.sources.length === 0 &&
            patterns.mediums.length === 0 &&
            patterns.campaigns.length === 0 &&
            patterns.contents.length === 0 && (
              <div className="text-sm" style={{ color: "var(--admin-muted)" }}>
                Nenhum padrão encontrado na base de leads.
              </div>
            )}
        </div>
      </div>
    </div>
  );
}
