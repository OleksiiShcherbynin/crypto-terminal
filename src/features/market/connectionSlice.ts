import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { ConnectionStatus } from '../../domain/types';

export interface ConnectionState {
  status: ConnectionStatus;
  attempt: number;
}

const initialState: ConnectionState = { status: 'connecting', attempt: 0 };

const connectionSlice = createSlice({
  name: 'connection',
  initialState,
  reducers: {
    connectionStatusChanged(_state, action: PayloadAction<ConnectionState>) {
      return action.payload;
    },
  },
});

export const { connectionStatusChanged } = connectionSlice.actions;
export default connectionSlice.reducer;
