import { configureStore } from '@reduxjs/toolkit';

import authReducer from '@/app/authSlice';
import messagingReducer from '@/app/messagingSlice';
import { baseApi } from '@/utils/api';

import '@/app/authApi';

export const store = configureStore({
  reducer: {
    [baseApi.reducerPath]: baseApi.reducer,
    auth: authReducer,
    messaging: messagingReducer,
  },
  middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(baseApi.middleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
