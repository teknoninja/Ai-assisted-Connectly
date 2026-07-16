import { useEffect, useRef, useState } from "react";
import "./aiCompanion.css";
import { format } from "timeago.js";
import { useAiStore } from "../lib/aiStore";
import { sendToAI, loadAIHistory, GREET_SENTINEL } from "../lib/aiClient";

//How long the AI chat can be idle before the companion greets you with a
//fresh personalized fact when the panel opens (30 minutes).
const GREET_AFTER_MS = 30 * 60 * 1000;

const AiCompanion = () => {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);

  const { closeAi } = useAiStore();
  const endRef = useRef(null);
  const greetedRef = useRef(false); //guards against greeting twice (StrictMode double-mount)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isThinking]);

  //On open: load the persisted conversation, then — if the chat is cold —
  //ask the AI to open with a surprising, personalized fact.
  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      try {
        const history = await loadAIHistory();
        if (cancelled) return;
        setMessages(history);
        setHistoryLoaded(true);

        const last = history[history.length - 1];
        const isCold =
          !last || Date.now() - new Date(last.created_at).getTime() > GREET_AFTER_MS;

        if (isCold && !greetedRef.current) {
          greetedRef.current = true;
          setIsThinking(true);
          const reply = await sendToAI(GREET_SENTINEL);
          if (cancelled) return;
          setMessages((prev) => [
            ...prev,
            { id: `greet-${Date.now()}`, role: "assistant", content: reply, created_at: new Date().toISOString() },
          ]);
        }
      } catch (err) {
        console.error("AI companion init failed:", err);
      } finally {
        if (!cancelled) setIsThinking(false);
      }
    };

    init();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSend = async () => {
    const message = text.trim();
    if (!message || isThinking) return;

    setText("");
    //Optimistic append so the user's message shows instantly.
    setMessages((prev) => [
      ...prev,
      { id: `local-${Date.now()}`, role: "user", content: message, created_at: new Date().toISOString() },
    ]);
    setIsThinking(true);

    try {
      const reply = await sendToAI(message);
      setMessages((prev) => [
        ...prev,
        { id: `reply-${Date.now()}`, role: "assistant", content: reply, created_at: new Date().toISOString() },
      ]);
    } catch (err) {
      console.error(err);
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: "assistant",
          content: "Hmm, I couldn't reach my brain just now. Try again in a moment?",
          created_at: new Date().toISOString(),
        },
      ]);
    } finally {
      setIsThinking(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="aiCompanion">
      <div className="top">
        <div className="user">
          <div className="aiAvatar">✨</div>
          <div className="texts">
            <span>Connectly AI</span>
            <p>Your companion with a memory</p>
          </div>
        </div>
        <button className="closeButton" onClick={closeAi}>✕</button>
      </div>

      <div className="center">
        {!historyLoaded && <p className="hint">Loading your conversation…</p>}
        {historyLoaded && messages.length === 0 && !isThinking && (
          <p className="hint">Say hi — I&apos;ll remember what we talk about.</p>
        )}
        {messages.map((message) => (
          <div
            className={message.role === "user" ? "message own" : "message"}
            key={message.id}
          >
            <div className="texts">
              <p>{message.content}</p>
              <span>{format(message.created_at)}</span>
            </div>
          </div>
        ))}
        {isThinking && (
          <div className="message">
            <div className="texts">
              <p className="thinking">
                <span></span><span></span><span></span>
              </p>
            </div>
          </div>
        )}
        <div ref={endRef}></div>
      </div>

      <div className="bottom">
        <input
          type="text"
          placeholder="Chat with your AI companion..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isThinking}
        />
        <button className="sendButton" onClick={handleSend} disabled={isThinking || !text.trim()}>
          Send
        </button>
      </div>
    </div>
  );
};

export default AiCompanion;
