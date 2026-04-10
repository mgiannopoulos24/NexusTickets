import { useState } from 'react';
import { MessageCircle, X, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useGetConversationsQuery, useSendMessageMutation } from '@/app/chatApi';
import type { Conversation } from '@/types/chat';

export function FloatingChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<Conversation | null>(null);
  const [message, setMessage] = useState('');

  const { data: conversations = [], isLoading } = useGetConversationsQuery();
  const [sendMessage, { isLoading: sending }] = useSendMessageMutation();

  const handleSend = async () => {
    if (!selectedRoom || !message.trim()) return;
    try {
      await sendMessage({
        roomId: selectedRoom.id,
        body: { content: message.trim() },
      }).unwrap();
      setMessage('');
    } catch (err) {
      console.error('Failed to send message:', err);
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 left-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-[#6d28d9] text-white shadow-lg hover:bg-[#5b21b6] transition-all"
        aria-label="Open chat"
      >
        <MessageCircle className="size-6" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 left-6 z-50 w-80 rounded-xl bg-white shadow-xl border border-neutral-200">
      <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
        <h3 className="font-semibold text-neutral-900 comfortaa-bold">Messages</h3>
        <button
          onClick={() => setIsOpen(false)}
          className="rounded-full p-1 hover:bg-neutral-100"
          aria-label="Close chat"
        >
          <X className="size-5 text-neutral-500" />
        </button>
      </div>

      {!selectedRoom ? (
        <div className="max-h-96 overflow-y-auto">
          {isLoading ? (
            <p className="p-4 text-center text-neutral-500 comfortaa-regular">Loading...</p>
          ) : conversations.length === 0 ? (
            <p className="p-4 text-center text-neutral-500 comfortaa-regular">
              No conversations yet
            </p>
          ) : (
            <ul className="divide-y divide-neutral-100">
              {conversations.map((conv) => (
                <li key={conv.id}>
                  <button
                    onClick={() => setSelectedRoom(conv)}
                    className="flex w-full items-center gap-3 p-3 text-left hover:bg-neutral-50"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-200">
                      <span className="text-sm font-medium text-neutral-600">
                        {conv.other_user?.first_name?.[0] || '?'}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-sm font-medium text-neutral-900 comfortaa-regular">
                        {conv.other_user?.first_name} {conv.other_user?.last_name}
                      </p>
                      <p className="truncate text-xs text-neutral-500 comfortaa-regular">
                        {conv.last_message?.content || 'No messages'}
                      </p>
                    </div>
                    {conv.unread_count > 0 && (
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#6d28d9] text-xs text-white">
                        {conv.unread_count}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <div className="flex flex-col h-96">
          <div className="flex items-center gap-2 border-b border-neutral-200 px-3 py-2">
            <button
              onClick={() => setSelectedRoom(null)}
              className="rounded-full p-1 hover:bg-neutral-100"
            >
              <X className="size-4 text-neutral-500" />
            </button>
            <span className="font-medium text-neutral-900 comfortaa-regular">
              {selectedRoom.other_user?.first_name} {selectedRoom.other_user?.last_name}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            <p className="text-center text-xs text-neutral-400 comfortaa-regular">
              Start a conversation
            </p>
          </div>

          <div className="flex gap-2 border-t border-neutral-200 p-3">
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type a message..."
              className="flex-1 rounded-lg border border-neutral-200 px-3 py-2 text-sm comfortaa-regular"
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            />
            <Button
              onClick={handleSend}
              disabled={sending || !message.trim()}
              size="icon"
              className="rounded-full bg-[#6d28d9] text-white hover:bg-[#5b21b6]"
            >
              <Send className="size-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}