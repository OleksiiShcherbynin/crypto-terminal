import { createSlice } from '@reduxjs/toolkit';

export interface AppState {
  externalChange: boolean;
}

const initialState: AppState = { externalChange: false };

const appSlice = createSlice({
  name: 'app',
  initialState,
  reducers: {
    externalChangeDetected(state) {
      state.externalChange = true;
    },
  },
});

export const { externalChangeDetected } = appSlice.actions;
export const selectExternalChange = (s: { app: AppState }): boolean => s.app.externalChange;
export default appSlice.reducer;
