import { configureStore } from '@reduxjs/toolkit';
import { baseApi } from '@/utils/api';
import messagingReducer from '@/app/messagingSlice';

export const store = configureStore({
  reducer: {
    [baseApi.reducerPath]: baseApi.reducer,
    messaging: messagingReducer,
  },
  middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(baseApi.middleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
