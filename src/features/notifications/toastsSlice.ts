import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { Toast } from '../../domain/types';

export interface ToastsState {
  items: Toast[];
}

const initialState: ToastsState = { items: [] };

const toastsSlice = createSlice({
  name: 'toasts',
  initialState,
  reducers: {
    toastPushed(state, action: PayloadAction<Toast>) {
      state.items.push(action.payload);
    },
    toastDismissed(state, action: PayloadAction<string>) {
      state.items = state.items.filter((toast) => toast.id !== action.payload);
    },
  },
});

export const { toastPushed, toastDismissed } = toastsSlice.actions;
export default toastsSlice.reducer;
