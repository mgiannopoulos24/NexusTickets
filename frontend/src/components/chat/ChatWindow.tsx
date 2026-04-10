import { useState, useEffect, useRef } from 'react';
import { Send, Paperclip, Image, Smile } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useGetMessagesQuery, useSendMessageMutation, useReactToMessageMutation } from '@/app/chatApi';
import type { ChatUser } from '@/types/chat';

interface ChatWindowProps {
  roomId: string;
  otherUser: ChatUser;
  currentUserId: string;
  onClose: () => void;
}

const REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🎉'];

export function ChatWindow({ roomId, otherUser, currentUserId, onClose }: ChatWindowProps) {
  const [message, setMessage] = useState('');
  const [showReactions, setShowReactions] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: messages = [], isLoading } = useGetMessagesQuery(roomId);
  const [sendMessage, { isLoading: sending }] = useSendMessageMutation();
  const [reactToMessage] = useReactToMessageMutation();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!message.trim()) return;
    try {
      await sendMessage({
        roomId,
        body: { content: message.trim() },
      }).unwrap();
      setMessage('');
    } catch (err) {
      console.error('Failed to send:', err);
    }
  };

  const handleReaction = async (messageId: string, reaction: string) => {
    try {
      await reactToMessage({
        messageId,
        body: { reaction_type: reaction },
      }).unwrap();
      setShowReactions(null);
    } catch (err) {
      console.error('Failed to react:', err);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-lg shadow-xl border border-neutral-200">
      <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-200">
            <span className="text-sm font-medium text-neutral-600">
              {otherUser.first_name?.[0] || '?'}
            </span>
          </div>
          <div>
            <p className="font-medium text-neutral-900 comfortaa-regular">
              {otherUser.first_name} {otherUser.last_name}
            </p>
            <p className="text-xs text-neutral-500 comfortaa-regular">Online</p>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          ×
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {isLoading ? (
          <p className="text-center text-neutral-500 comfortaa-regular">Loading...</p>
        ) : messages.length === 0 ? (
          <p className="text-center text-neutral-400 comfortaa-regular">
            No messages yet. Say hello!
          </p>
        ) : (
          messages.map((msg) => {
            const isOwn = msg.sender_id === currentUserId;
            return (
              <div
                key={msg.id}
                className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[75%] rounded-2xl px-4 py-2 ${
                    isOwn
                      ? 'bg-[#6d28d9] text-white'
                      : 'bg-neutral-100 text-neutral-900'
                  }`}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setShowReactions(msg.id);
                  }}
                >
                  <p className="text-sm comfortaa-regular">{msg.content}</p>
                  {msg.image_url && (
                    <img
                      src={msg.image_url}
                      alt=" attachment"
                      className="mt-2 max-w-full rounded-lg"
                    />
                  )}
                  {msg.gif_url && (
                    <img src={msg.gif_url} alt="GIF" className="mt-2 max-w-full rounded-lg" />
                  )}
                  <p
                    className={`text-xs mt-1 ${
                      isOwn ? 'text-white/70' : 'text-neutral-400'
                    } comfortaa-regular`}
                  >
                    {new Date(msg.created_at).toLocaleTimeString('el-GR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>

                  {showReactions === msg.id && (
                    <div className="flex gap-1 mt-2">
                      {REACTION_EMOJIS.map((emoji) => (
                        <button
                          key={emoji}
                          onClick={() => handleReaction(msg.id, emoji)}
                          className="hover:bg-neutral-200 rounded-full px-1"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="flex items-center gap-2 border-t border-neutral-200 p-3">
        <Button variant="ghost" size="icon" className="text-neutral-500">
          <Paperclip className="size-5" />
        </Button>
        <Button variant="ghost" size="icon" className="text-neutral-500">
          <Image className="size-5" />
        </Button>
        <Input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Type a message..."
          className="flex-1 comfortaa-regular"
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
        />
        <Button variant="ghost" size="icon" className="text-neutral-500">
          <Smile className="size-5" />
        </Button>
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
  );
}