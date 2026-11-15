import {
  useEffect,
  useLayoutEffect,
  useId,
  useRef,
  useState,
  type ReactElement,
} from "react";
import { Link } from "react-router";
import { ArrowsOutSimple } from "@phosphor-icons/react/dist/csr/ArrowsOutSimple";
import { ArrowsInSimple } from "@phosphor-icons/react/dist/csr/ArrowsInSimple";
import { X } from "@phosphor-icons/react/dist/csr/X";
import { PaperPlaneTilt } from "@phosphor-icons/react/dist/csr/PaperPlaneTilt";
import { ArrowCounterClockwise } from "@phosphor-icons/react/dist/csr/ArrowCounterClockwise";
import robot from "@/assets/auth/robot-happy.svg";
import { useMockSession } from "@/features/auth/hooks/useMockSession";
import { isMockApi } from "@/shared/api/config";
import { getAssistantReply, type AssistantReply } from "./assistantReply";
import "./BlueAssistant.css";
interface Message extends AssistantReply {
  id: number;
  role: "assistant" | "user";
}
const welcome: Message = {
  id: 0,
  role: "assistant",
  text: "Chào bạn! Mình là BLUE, linh vật đồng hành trên mỗi chuyến đi. Bạn cần tìm chuyến hay hỗ trợ vé đã đặt?",
};
const prompts = [
  "Tìm chuyến xe",
  "Tra cứu vé",
  "Hướng dẫn đặt vé",
  "Hủy và hoàn tiền",
];
function AssistantWidget(): ReactElement {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [messages, setMessages] = useState<Message[]>([welcome]);
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const previousBounds = useRef<DOMRect | null>(null);
  const resizeAnimation = useRef<Animation | null>(null);
  const id = useId();
  const nextId = useRef(1);
  useEffect(() => {
    if (open) inputRef.current?.focus({ preventScroll: true });
  }, [open]);
  useEffect(() => {
    const log = logRef.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, [messages, open, expanded]);
  useLayoutEffect(() => {
    const panel = panelRef.current;
    const previous = previousBounds.current;
    previousBounds.current = null;
    if (
      !panel ||
      !previous ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      typeof panel.animate !== "function"
    )
      return;
    const next = panel.getBoundingClientRect();
    if (!next.width || !next.height) return;
    const transform = getComputedStyle(panel).transform;
    const base = transform === "none" ? "" : transform;
    resizeAnimation.current = panel.animate(
      [
        {
          transform: `${base} translate(${previous.left - next.left}px, ${previous.top - next.top}px) scale(${previous.width / next.width}, ${previous.height / next.height})`,
        },
        { transform: transform },
      ],
      { duration: 360, easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
    );
  }, [expanded]);
  useEffect(() => () => resizeAnimation.current?.cancel(), []);
  function toggleExpanded(): void {
    const panel = panelRef.current;
    if (panel) {
      previousBounds.current = panel.getBoundingClientRect();
      resizeAnimation.current?.cancel();
      panel.style.animation = "none";
    }
    setExpanded((value) => !value);
  }
  function close(): void {
    resizeAnimation.current?.cancel();
    previousBounds.current = null;
    setOpen(false);
    launcherRef.current?.focus({ preventScroll: true });
  }
  function send(value: string): void {
    const text = value.trim().slice(0, 500);
    if (!text) return;
    const reply = getAssistantReply(text, isMockApi);
    const first = nextId.current++;
    const second = nextId.current++;
    const incoming: Message[] = [
      { id: first, role: "user", text },
      { id: second, role: "assistant", ...reply },
    ];
    setMessages((previous) => [...previous, ...incoming].slice(-40));
    setInput("");
    inputRef.current?.focus({ preventScroll: true });
  }
  return (
    <div className="blue-assistant">
      {open && (
        <section
          ref={panelRef}
          className={[
            "blue-assistant__panel",
            expanded && "blue-assistant__panel--expanded",
          ]
            .filter(Boolean)
            .join(" ")}
          role="dialog"
          aria-modal="false"
          aria-labelledby={`${id}-title`}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.stopPropagation();
              close();
            }
          }}
        >
          <div className="blue-assistant__header">
            <img src={robot} alt="" />
            <div>
              <h2 id={`${id}-title`}>BLUE • Trợ lý hành trình</h2>
              <span>Bản trải nghiệm</span>
            </div>
            <div className="blue-assistant__tools">
              <button
                type="button"
                aria-label="Cuộc trò chuyện mới"
                title="Cuộc trò chuyện mới"
                onClick={() => {
                  setMessages([welcome]);
                  setInput("");
                  inputRef.current?.focus();
                }}
              >
                <ArrowCounterClockwise size={17} aria-hidden="true" />
              </button>
              <button
                type="button"
                aria-label={
                  expanded ? "Thu gọn khung chat" : "Mở rộng khung chat"
                }
                title={expanded ? "Thu gọn" : "Mở rộng"}
                aria-pressed={expanded}
                onClick={toggleExpanded}
              >
                {expanded ? (
                  <ArrowsInSimple size={18} aria-hidden="true" />
                ) : (
                  <ArrowsOutSimple size={18} aria-hidden="true" />
                )}
              </button>
              <button
                type="button"
                aria-label="Đóng khung chat"
                onClick={close}
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>
          </div>
          <div
            className="blue-assistant__messages"
            ref={logRef}
            role="log"
            aria-label="Nội dung trò chuyện"
            aria-live="polite"
            aria-relevant="additions"
          >
            {messages.map((message) => (
              <div
                className={`blue-assistant__message blue-assistant__message--${message.role}`}
                key={message.id}
              >
                {message.role === "assistant" && <img src={robot} alt="BLUE" />}
                <div>
                  <p>{message.text}</p>
                  {message.actions && (
                    <div className="blue-assistant__links">
                      {message.actions.map((action) => (
                        <Link to={action.to} key={action.to}>
                          {action.label}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="blue-assistant__prompts" aria-label="Chủ đề hỗ trợ">
            {prompts.map((prompt) => (
              <button key={prompt} type="button" onClick={() => send(prompt)}>
                {prompt}
              </button>
            ))}
          </div>
          <form
            className="blue-assistant__composer"
            onSubmit={(event) => {
              event.preventDefault();
              send(input);
            }}
          >
            <label
              className="blue-assistant__input-label"
              htmlFor={`${id}-input`}
            >
              Nhắn cho BLUE
            </label>
            <input
              id={`${id}-input`}
              ref={inputRef}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              maxLength={500}
              placeholder="Bạn cần mình giúp gì?"
              autoComplete="off"
            />
            <button
              type="submit"
              aria-label="Gửi tin nhắn"
              disabled={!input.trim()}
            >
              <PaperPlaneTilt size={20} weight="fill" aria-hidden="true" />
            </button>
          </form>
        </section>
      )}
      <button
        className={[
          "blue-assistant__launcher",
          open && "blue-assistant__launcher--open",
        ]
          .filter(Boolean)
          .join(" ")}
        ref={launcherRef}
        type="button"
        aria-label="Hỏi BLUE"
        aria-expanded={open}
        onClick={() => {
          if (open) close();
          else setOpen(true);
        }}
      >
        <img src={robot} alt="Linh vật BLUE" />
        <span>Hỏi BLUE</span>
      </button>
    </div>
  );
}
export function BlueAssistant(): ReactElement | null {
  const { session, isHydrated } = useMockSession();
  if (!isHydrated) return null;
  return <AssistantWidget key={session?.userId ?? "guest"} />;
}
