import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

interface MessagingState {
  /** Unread inbox total, pushed by the server over the WebSocket. */
  unreadCount: number;
}

const initialState: MessagingState = {
  unreadCount: 0,
};

const messagingSlice = createSlice({
  name: 'messaging',
  initialState,
  reducers: {
    setUnreadCount(state, action: PayloadAction<number>) {
      state.unreadCount = Math.max(0, action.payload);
    },
    clearMessagingState() {
      return initialState;
    },
  },
});

export const { setUnreadCount, clearMessagingState } = messagingSlice.actions;
export default messagingSlice.reducer;
