export interface ChatRoom {
  id: string;
  is_group: boolean;
  name?: string;
  event_id?: string;
  is_read_only: boolean;
}

export interface ChatMessage {
  id: string;
  room_id: string;
  sender_id: string;
  sender?: ChatUser;
  content?: string;
  image_url?: string;
  file_url?: string;
  file_name?: string;
  gif_url?: string;
  reactions: MessageReaction[];
  created_at: string;
}

export interface ChatUser {
  id: string;
  username: string;
  first_name: string;
  last_name: string;
  photo_url?: string;
}

export interface MessageReaction {
  id: string;
  user_id: string;
  user?: ChatUser;
  reaction_type: string;
}

export interface Conversation {
  id: string;
  other_user?: ChatUser;
  last_message?: ChatMessage;
  unread_count: number;
  is_online: boolean;
}

export interface CreateChatRoomRequest {
  user_id?: string;
  event_id?: string;
}

export interface SendMessageRequest {
  content?: string;
  image_url?: string;
  file_url?: string;
  file_name?: string;
  gif_url?: string;
}

export interface ReactRequest {
  reaction_type: string;
}