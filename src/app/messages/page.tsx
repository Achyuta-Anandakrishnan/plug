import { inbox, messages } from "@/lib/mock";

export default function MessagesPage() {
  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
          Messaging
        </p>
        <h1 className="font-display text-3xl text-slate-900">Secure inbox</h1>
        <p className="text-sm text-slate-600">
          All chats are logged with stream artifacts for buyer protection.
        </p>
      </div>

      <section className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        <div className="surface-panel rounded-[28px] p-4">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-lg text-slate-900">Conversations</h2>
            <span className="text-xs uppercase tracking-[0.2em] text-slate-400">
              Live
            </span>
          </div>
          <div className="space-y-3">
            {inbox.map((thread) => (
              <div
                key={thread.id}
                className="rounded-2xl border border-white/70 bg-white/70 px-4 py-3 text-sm"
              >
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-slate-900">{thread.name}</p>
                  <span className="text-xs text-slate-400">{thread.time}</span>
                </div>
                <p className="mt-1 text-slate-500">{thread.preview}</p>
                {thread.unread > 0 && (
                  <span className="mt-2 inline-flex rounded-full bg-[var(--royal)] px-2 py-0.5 text-[10px] font-semibold text-white">
                    {thread.unread} new
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="surface-panel rounded-[28px] p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-display text-lg text-slate-900">
                Cobalt Labs
              </p>
              <p className="text-xs text-slate-400">Live stream prep</p>
            </div>
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-600">
              Secure channel
            </span>
          </div>
          <div className="mt-6 space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`max-w-[70%] rounded-2xl px-4 py-3 text-sm ${
                  message.sender === "You"
                    ? "ml-auto bg-[var(--royal)]/10 text-slate-800"
                    : "bg-white/70 text-slate-600"
                }`}
              >
                <p className="text-xs font-semibold text-slate-500">
                  {message.sender}
                </p>
                <p>{message.text}</p>
                <p className="mt-1 text-xs text-slate-400">{message.time}</p>
              </div>
            ))}
          </div>
          <div className="mt-6 flex items-center gap-3">
            <input
              placeholder="Type a secure message"
              className="flex-1 rounded-full border border-slate-200 bg-white/90 px-4 py-2 text-sm text-slate-700 outline-none focus:border-[var(--royal)]"
            />
            <button className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
              Send
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
