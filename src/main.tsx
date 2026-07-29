import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { ProtofaceAvatar, useProtofaceConversation } from "protoface-client/react";
import "./styles.css";

const embedId = import.meta.env.VITE_PROTOFACE_EMBED_ID;
const defaultApiBaseUrl = "https://api.protoface.com";
const apiBaseUrl = import.meta.env.VITE_PROTOFACE_API_BASE_URL || defaultApiBaseUrl;
const cameraConsentText = "Enable camera access to let the assistant see you.";

type ConversationConfig = NonNullable<ReturnType<typeof useProtofaceConversation>["config"]>;
type ConversationStatus = ReturnType<typeof useProtofaceConversation>["status"];
type TranscriptLine = {
  id: string;
  role: "agent" | "assistant" | "user";
  text: string;
  final: boolean;
};
type ControlLayout = "dock" | "staged" | "below" | "expandable";

const controlLayouts: Array<{
  id: ControlLayout;
  label: string;
  description: string;
}> = [
  { id: "dock", label: "Bottom", description: "Start button over the video" },
  { id: "staged", label: "Step by step", description: "Intro, consent, then start" },
  { id: "below", label: "Under video", description: "Start area below the video" },
  { id: "expandable", label: "Expandable", description: "Opens when hovered" }
];

function App() {
  const conversation = useProtofaceConversation({ embedId, apiBaseUrl });
  const [loadedConfig, setLoadedConfig] = useState<ConversationConfig | null>(null);
  const [startRequested, setStartRequested] = useState(false);
  const [consentChecked, setConsentChecked] = useState(false);
  const [transcript, setTranscript] = useState<TranscriptLine[]>([]);
  const [selectedControlLayout, setSelectedControlLayout] = useState<ControlLayout>("dock");
  const [stagedIntroAccepted, setStagedIntroAccepted] = useState(false);
  const advancingControllerRef = useRef<typeof conversation.conversation | null>(null);
  const displayConfig = conversation.config ?? loadedConfig;
  const hasDisplayConfig = !!displayConfig;
  const avatarName = typeof displayConfig?.avatar_name === "string" ? displayConfig.avatar_name : "our avatar";
  const headline =
    !hasDisplayConfig ? "Loading conversation..." : typeof displayConfig.cta_title === "string" ? displayConfig.cta_title : `Talk with ${avatarName}`;
  const description =
    !hasDisplayConfig
      ? ""
      : typeof displayConfig.cta_description === "string"
      ? displayConfig.cta_description
      : "Ask questions and get a live voice response.";
  const portraitUrl =
    typeof displayConfig?.portrait_url === "string" ? resolveAssetUrl(displayConfig.portrait_url, apiBaseUrl) : null;
  const isLive = conversation.status === "live";
  const statusLabel = formatConversationStatus(conversation.status);
  const startLabel = startRequested
    ? "Starting..."
    : conversation.status === "failed"
    ? "Try again"
    : typeof displayConfig?.cta_button_label === "string"
    ? displayConfig.cta_button_label
    : "Start conversation";
  const helperText =
    conversation.status === "failed" && conversation.error
      ? conversation.error.message
      : startRequested && (conversation.status === "requesting_device_access" || conversation.status === "device_access_required")
      ? "Grant microphone access to start the conversation."
      : startRequested
      ? "Starting the conversation..."
      : "";
  const requiresConsentCheck = displayConfig?.consent?.enabled === true;
  const canStart =
    !startRequested &&
    (!requiresConsentCheck || consentChecked) &&
    (conversation.status === "device_access_required" ||
      conversation.status === "consent_required" ||
      conversation.status === "ready_to_begin" ||
      conversation.status === "ended" ||
      conversation.status === "failed");
  const consentText = conversation.consent?.text ?? displayConfig?.consent?.text ?? "";
  const acknowledgementText = [consentText, displayConfig?.computer_vision_enabled ? cameraConsentText : ""]
    .filter(Boolean)
    .join(" ");
  const isPreStart = !isLive && conversation.status !== "waiting_for_avatar";
  const isStagedLayout = selectedControlLayout === "staged";
  const isExpandableLayout = selectedControlLayout === "expandable";
  const showStagedIntro = isStagedLayout && isPreStart && !stagedIntroAccepted;
  const useInlineConsentStart = selectedControlLayout === "below" && displayConfig?.consent?.enabled && isPreStart && !showStagedIntro;

  useEffect(() => {
    if (conversation.config) {
      setLoadedConfig(conversation.config);
    }
  }, [conversation.config]);

  useEffect(() => {
    const offStarted = conversation.on("started", () => {
      setTranscript([]);
    });
    const offTranscript = conversation.on("transcript", (event) => {
      if (isToolLikeEvent(event)) return;
      const text = getTranscriptText(event);
      if (!text) return;
      const role: TranscriptLine["role"] = event.role === "user" ? "user" : event.role === "agent" ? "agent" : "assistant";
      const id = typeof event.id === "string" && event.id ? event.id : `${role}-${Date.now()}`;
      const final = event.final === true;
      setTranscript((items) => {
        const existingIndex = items.findIndex((item) => item.id === id);
        const next = { id, role, text, final };
        if (existingIndex === -1) return [...items, next];
        return items.map((item, index) => (index === existingIndex ? next : item));
      });
    });
    return () => {
      offStarted();
      offTranscript();
    };
  }, [conversation]);

  useEffect(() => {
    if (!startRequested) return;
    const controller = conversation.conversation;
    if (advancingControllerRef.current === controller) return;
    let cancelled = false;

    async function advanceConversation() {
      advancingControllerRef.current = controller;
      try {
        if (controller.state.ended || controller.state.failed) {
          await controller.restart();
        }
        if (!cancelled && controller.state.device_access_required) {
          await controller.requestPermissions();
        }
        if (!cancelled && controller.state.consent_required) {
          await controller.acceptConsent();
        }
        if (!cancelled && controller.state.ready_to_begin) {
          await controller.start();
        }
      } catch {
        if (!cancelled) {
          setStartRequested(false);
        }
      } finally {
        if (advancingControllerRef.current === controller) {
          advancingControllerRef.current = null;
        }
        if (!cancelled && !shouldKeepStartRequestPending(controller.state.status)) {
          setStartRequested(false);
        }
      }
    }

    void advanceConversation().catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [conversation.conversation, conversation.status, startRequested]);

  function startConversation() {
    setTranscript([]);
    setStartRequested(true);
  }

  const controlPanel = (
    <div className="stageControls" aria-label="Conversation controls">
      <div className="controlCard">
        {isPreStart ? (
          <div className="stageCta">
            <h2>{headline}</h2>
            {description && <p className={isExpandableLayout ? "expandableDetail" : undefined}>{description}</p>}
          </div>
        ) : null}

        {showStagedIntro ? (
          <div className="buttonRow callActions oneAction">
            <button className="button" disabled={!hasDisplayConfig} onClick={() => setStagedIntroAccepted(true)} type="button">
              <Icon name="arrow" />
              Continue
            </button>
          </div>
        ) : null}

        {!showStagedIntro && displayConfig?.consent?.enabled && isPreStart && !useInlineConsentStart ? (
          <label className="check consentCheck">
            <input checked={consentChecked} type="checkbox" onChange={(event) => setConsentChecked(event.currentTarget.checked)} />
            <span>{acknowledgementText}</span>
          </label>
        ) : null}

        {useInlineConsentStart ? (
          <div className="consentStartRow">
            <label className="check consentCheck">
              <input checked={consentChecked} type="checkbox" onChange={(event) => setConsentChecked(event.currentTarget.checked)} />
              <span>{acknowledgementText}</span>
            </label>
            <button
              aria-label={startLabel}
              className="iconButton startIconButton"
              disabled={startRequested || !hasDisplayConfig || !canStart}
              onClick={startConversation}
              title={startLabel}
              type="button"
            >
              <Icon name="play" />
            </button>
          </div>
        ) : null}

        {!showStagedIntro && !useInlineConsentStart ? (
          <div
            className={`buttonRow callActions ${
              isLive || conversation.status === "waiting_for_avatar" ? "twoActions iconActions" : "oneAction"
            }`}
          >
            {isPreStart ? (
              <button className="button" disabled={startRequested || !hasDisplayConfig || !canStart} onClick={startConversation}>
                <Icon name="play" />
                {startLabel}
              </button>
            ) : null}
            {isLive || conversation.status === "waiting_for_avatar" ? (
              <>
                <button
                  aria-label={conversation.conversation.state.microphoneEnabled ? "Mute microphone" : "Unmute microphone"}
                  className="iconButton secondary"
                  onClick={() => void conversation.toggleMicrophone()}
                  title={conversation.conversation.state.microphoneEnabled ? "Mute microphone" : "Unmute microphone"}
                  type="button"
                >
                  <Icon name={conversation.conversation.state.microphoneEnabled ? "mic" : "micOff"} />
                </button>
                <button aria-label="End conversation" className="iconButton danger" onClick={() => void conversation.end()} title="End conversation" type="button">
                  <Icon name="phoneOff" />
                </button>
              </>
            ) : null}
          </div>
        ) : null}
      </div>
      {helperText && <p className="stageNotice">{helperText}</p>}
    </div>
  );

  return (
    <main className="page">
      <header className="topbar">
        <a className="brand" href="https://protoface.com" target="_blank" rel="noreferrer">
          <span>Protoface</span>
        </a>

        <nav className="navLinks" aria-label="Starter links">
          <a href="https://docs.protoface.com" target="_blank" rel="noreferrer">
            Docs
          </a>
          <a href="https://app.protoface.com" target="_blank" rel="noreferrer">
            Login
          </a>
        </nav>
      </header>

      <div className="shell">
        <div className="leftColumn">
          <section className="stageLayoutPicker" aria-label="Conversation control layout">
            <div>
              <h2>Layout</h2>
              <p>Choose how the start controls appear.</p>
            </div>
            <div className="layoutOptions">
              {controlLayouts.map((layout) => (
                <button
                  aria-pressed={selectedControlLayout === layout.id}
                  className="layoutOption"
                  key={layout.id}
                  onClick={() => {
                    setSelectedControlLayout(layout.id);
                    setStagedIntroAccepted(false);
                  }}
                  type="button"
                >
                  <span>{layout.label}</span>
                  <small>{layout.description}</small>
                </button>
              ))}
            </div>
          </section>

          <section className={`stage control-layout-${selectedControlLayout}`} aria-label="Protoface avatar stage">
            <div className="stageMedia">
              <div className={isLive ? "stagePreview stagePreviewHidden" : "stagePreview"}>
                {portraitUrl ? <img className="portrait" crossOrigin="anonymous" src={portraitUrl} alt={avatarName} /> : null}
              </div>
              <ProtofaceAvatar conversation={conversation.conversation} className={isLive ? "avatar avatarLive" : "avatar"} />
              <div className="livePill">
                <span className={isLive ? "dot live" : "dot"} />
                {statusLabel}
              </div>
              {(selectedControlLayout === "dock" || selectedControlLayout === "staged" || selectedControlLayout === "expandable") && controlPanel}
            </div>
            {selectedControlLayout === "below" && controlPanel}
          </section>
        </div>

        <aside className="controls">
          <section className="intro">
            <h1>Protoface Conversations Quickstart</h1>
            <p>Test this embed exactly as it will appear to users.</p>
          </section>

          <section className="status">
            <div className="statusList">
              <div className="statusItem">
                <strong>Session</strong>
                <span className="pill">{statusLabel}</span>
              </div>
              <div className="statusItem">
                <strong>Avatar</strong>
                <span className="pill">{avatarName}</span>
              </div>
              <div className="statusItem">
                <strong>Microphone</strong>
                <span className="pill">{formatPermissionStatus(conversation.permissions.microphone, "microphone")}</span>
              </div>
              <div className="statusItem">
                <strong>Vision</strong>
                <span className="pill">{formatPermissionStatus(conversation.permissions.computer_vision, "vision")}</span>
              </div>
            </div>

            {conversation.error && conversation.status !== "failed" ? (
              <p className="error">{conversation.error.message}</p>
            ) : null}
          </section>

          <section className="log">
            <h2>Transcript</h2>
            <ol className="logList transcript" aria-label="Conversation transcript">
              {transcript.length > 0 ? (
                transcript.map((line) => (
                  <li className={`${line.role}${line.final ? "" : " interim"}`} key={line.id}>
                    <span>{line.final ? line.role : `${line.role} speaking`}</span>
                    <p>{line.text}</p>
                  </li>
                ))
              ) : (
                <li className="empty">Ready when you are.</li>
              )}
            </ol>
          </section>

          <section className="quickStart">
            <h2>Quick start</h2>
            <ol>
              <li>Add `VITE_PROTOFACE_EMBED_ID` to `.env`.</li>
              <li>Confirm the embed is enabled.</li>
              <li>Start a conversation and grant microphone access.</li>
            </ol>
          </section>
        </aside>
      </div>
    </main>
  );
}

function Icon({ name }: { name: "arrow" | "play" | "mic" | "micOff" | "phoneOff" }) {
  if (name === "arrow") {
    return (
      <svg aria-hidden="true" className="buttonIcon" viewBox="0 0 24 24">
        <path d="M5 12h13M13 6l6 6-6 6" />
      </svg>
    );
  }
  if (name === "play") {
    return (
      <svg aria-hidden="true" className="buttonIcon" viewBox="0 0 24 24">
        <path d="M8 5v14l11-7z" />
      </svg>
    );
  }
  if (name === "mic") {
    return (
      <svg aria-hidden="true" className="buttonIcon" viewBox="0 0 24 24">
        <path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3Z" />
        <path d="M5 11a7 7 0 0 0 14 0M12 18v3M8 21h8" />
      </svg>
    );
  }
  if (name === "micOff") {
    return (
      <svg aria-hidden="true" className="buttonIcon" viewBox="0 0 24 24">
        <path d="m4 4 16 16M9 9v3a3 3 0 0 0 4.5 2.6M15 10.5V6a3 3 0 0 0-5.2-2" />
        <path d="M5 11a7 7 0 0 0 11.7 5.2M19 11a7 7 0 0 1-.7 3M12 18v3M8 21h8" />
      </svg>
    );
  }
  return (
    <svg aria-hidden="true" className="buttonIcon" viewBox="0 0 24 24">
      <path d="M4.5 14.5c4.7-3.4 10.3-3.4 15 0" />
      <path d="M5.4 14 3.8 12.4a1.2 1.2 0 0 1-.2-1.5C5.4 7.8 8.4 6.2 12 6.2s6.6 1.6 8.4 4.7c.3.5.2 1.1-.2 1.5L18.6 14" />
      <path d="M8 13.1v2.3c0 .4-.2.8-.6 1l-2.2 1.2M16 13.1v2.3c0 .4.2.8.6 1l2.2 1.2" />
    </svg>
  );
}

createRoot(document.getElementById("root")!).render(<App />);

function shouldKeepStartRequestPending(status: ConversationStatus): boolean {
  return (
    status === "loading" ||
    status === "device_access_required" ||
    status === "requesting_device_access" ||
    status === "consent_required" ||
    status === "confirming_consent" ||
    status === "ready_to_begin" ||
    status === "ended"
  );
}

function resolveAssetUrl(path: string, baseUrl: string | undefined): string {
  try {
    return new URL(path, baseUrl || window.location.origin).toString();
  } catch {
    return path;
  }
}

function formatConversationStatus(status: string): string {
  const labels: Record<string, string> = {
    loading: "Loading",
    device_access_required: "Permissions",
    requesting_device_access: "Requesting Mic",
    consent_required: "Review Consent",
    confirming_consent: "Confirming",
    ready_to_begin: "Ready",
    joining: "Joining",
    waiting_for_avatar: "Connecting Avatar",
    live: "Live",
    ending: "Ending",
    ended: "Ended",
    failed: "Failed"
  };
  return labels[status] ?? titleizeStatus(status);
}

function formatPermissionStatus(status: string, permission: "microphone" | "vision"): string {
  const labels: Record<string, Record<string, string>> = {
    microphone: {
      unknown: "Not Checked",
      not_requested: "Not Checked",
      granted: "Allowed",
      denied: "Blocked"
    },
    vision: {
      unknown: "Not Checked",
      not_requested: "Off",
      granted: "Allowed",
      denied: "Unavailable"
    }
  };
  return labels[permission][status] ?? titleizeStatus(status);
}

function titleizeStatus(status: string): string {
  return status
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function isToolLikeEvent(event: Record<string, unknown>): boolean {
  const values = [event.type, event.event, event.kind, event.name];
  return values.some((value) => typeof value === "string" && /tool/i.test(value));
}

function getTranscriptText(event: Record<string, unknown>): string {
  for (const key of ["content", "text", "transcript", "message", "delta"]) {
    const value = event[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}
