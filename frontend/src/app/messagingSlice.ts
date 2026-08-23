import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { WSNewMessagePayload } from '@/types/ws';

interface MessagingState {
  unreadCount: number;
  latestMessages: WSNewMessagePayload[];
  /** user id -> epoch ms of their last typing hint. */
  typingBy: Record<string, number>;
}

const initialState: MessagingState = {
  unreadCount: 0,
  latestMessages: [],
  typingBy: {},
};

const messagingSlice = createSlice({
  name: 'messaging',
  initialState,
  reducers: {
    setUnreadCount(state, action: PayloadAction<number>) {
      state.unreadCount = action.payload;
    },
    pushIncomingMessage(state, action: PayloadAction<WSNewMessagePayload>) {
      state.latestMessages = [action.payload, ...state.latestMessages].slice(0, 50);
    },
    /** Records a typing hint; the UI decides how long to keep showing it. */
    markTyping(state, action: PayloadAction<{ userId: string; at: number }>) {
      state.typingBy[action.payload.userId] = action.payload.at;
    },
    clearTyping(state, action: PayloadAction<string>) {
      delete state.typingBy[action.payload];
    },
    clearMessagingState() {
      return initialState;
    },
  },
});

export const {
  setUnreadCount,
  pushIncomingMessage,
  markTyping,
  clearTyping,
  clearMessagingState,
} = messagingSlice.actions;
export default messagingSlice.reducer;
