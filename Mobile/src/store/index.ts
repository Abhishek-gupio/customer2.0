import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';
import documentsReducer from './slices/documentsSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    documents: documentsReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
