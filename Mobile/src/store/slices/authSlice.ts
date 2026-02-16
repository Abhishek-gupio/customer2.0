import { createSlice } from '@reduxjs/toolkit';

export interface AuthState {
  isAuthenticated: boolean;
  user: { id: string; email?: string } | null;
}

const initialState: AuthState = {
  isAuthenticated: false,
  user: null,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setAuthenticated: (state, action: { payload: boolean }) => {
      state.isAuthenticated = action.payload;
      if (!action.payload) state.user = null;
    },
    setUser: (state, action: { payload: AuthState['user'] }) => {
      state.user = action.payload;
      state.isAuthenticated = !!action.payload;
    },
    logout: (state) => {
      state.isAuthenticated = false;
      state.user = null;
    },
  },
});

export const { setAuthenticated, setUser, logout } = authSlice.actions;
export default authSlice.reducer;
