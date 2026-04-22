"use client";

import { useMutation, useQuery } from "convex/react";
import { useState } from "react";

import { api } from "@/convex/_generated/api";

export function StarterScreen() {
  const messages = useQuery(api.messages.list, {});
  const addMessage = useMutation(api.messages.create);
  const [text, setText] = useState("hello from netcarta");

  return (
    <main style={{ padding: 24, fontFamily: "Arial, sans-serif" }}>
      <h1>Netcarta</h1>
      <p>This is a basic Next.js + Convex scaffold.</p>

      <section style={{ marginTop: 18 }}>
        <label htmlFor="message-input">Add a message</label>
        <div style={{ marginTop: 8, display: "flex", gap: 8, maxWidth: 520 }}>
          <input
            id="message-input"
            value={text}
            onChange={(event) => setText(event.target.value)}
            style={{ flex: 1, padding: 8 }}
          />
          <button
            type="button"
            disabled={!text.trim()}
            onClick={() => {
              void addMessage({ body: text.trim() });
              setText("");
            }}
          >
            Save
          </button>
        </div>
      </section>

      <section style={{ marginTop: 20 }}>
        <h2>Messages</h2>
        {messages === undefined ? <p>Loading...</p> : null}
        {messages?.length === 0 ? <p>No messages yet.</p> : null}
        <ul>
          {messages?.map((message) => (
            <li key={message._id}>{message.body}</li>
          ))}
        </ul>
      </section>

      <footer style={{ marginTop: 18, color: "#666" }}>
        NEXT_PUBLIC_CONVEX_URL: {process.env.NEXT_PUBLIC_CONVEX_URL ? "configured" : "missing"}
      </footer>
    </main>
  );
}
