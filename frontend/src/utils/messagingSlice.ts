import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { WSNewMessagePayload } from '@/types/ws';

interface MessagingState {
  unreadCount: number;
  latestMessages: WSNewMessagePayload[];
}

const initialState: MessagingState = {
  unreadCount: 0,
  latestMessages: [],
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
    clearMessagingState() {
      return initialState;
    },
  },
});

export const { setUnreadCount, pushIncomingMessage, clearMessagingState } = messagingSlice.actions;
export default messagingSlice.reducer;
