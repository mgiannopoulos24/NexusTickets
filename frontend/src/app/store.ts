import { configureStore } from '@reduxjs/toolkit';
import { baseApi } from '@/utils/api';
import authReducer from '@/utils/authSlice';
import messagingReducer from '@/utils/messagingSlice';

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
