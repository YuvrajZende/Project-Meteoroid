import type { Metadata } from "next";
import { ChatView } from "./chat-view";

export const metadata: Metadata = { title: "Chat" };

export default function ChatPage() {
  return <ChatView />;
}
