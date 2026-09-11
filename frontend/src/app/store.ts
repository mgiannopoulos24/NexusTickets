import { configureStore } from '@reduxjs/toolkit';

import authReducer from '@/app/authSlice';
import messagingReducer from '@/app/messagingSlice';
import eventsReducer from '@/app/eventsSlice';
import { baseApi } from '@/utils/api';

import '@/app/authApi';
import '@/app/eventsApi';

export const store = configureStore({
  reducer: {
    [baseApi.reducerPath]: baseApi.reducer,
    auth: authReducer,
    messaging: messagingReducer,
    events: eventsReducer,
  },
  middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(baseApi.middleware),
  // Batch subscriber notifications on a microtask rather than an animation
  // frame: same effect in the browser, and no frame can outlive a test
  // environment (RTK's frame fallback threw once happy-dom had torn down).
  enhancers: (getDefaultEnhancers) => getDefaultEnhancers({ autoBatch: { type: 'tick' } }),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
