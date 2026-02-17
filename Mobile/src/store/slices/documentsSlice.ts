import { createSlice } from '@reduxjs/toolkit';

export interface OcrData {
  docNumber?: string;
  issueDate?: string;
  expiry?: string;
  issuer?: string;
  vehicleNumber?: string;
  [key: string]: string | undefined;
}

export interface DocumentItem {
  id: string;
  type: string;
  vehicle: string;
  imageUri: string;
  ocrData: OcrData;
  status: 'verified' | 'expiring' | 'expired';
  createdAt: string;
}

const initialState: { documents: DocumentItem[] } = {
  documents: [],
};

const documentsSlice = createSlice({
  name: 'documents',
  initialState,
  reducers: {
    addDocument: (state, action: { payload: Omit<DocumentItem, 'id' | 'createdAt' | 'status'> }) => {
      const id = `doc_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      const createdAt = new Date().toISOString();
      const expiry = action.payload.ocrData.expiry;
      let status: DocumentItem['status'] = 'verified';
      if (expiry) {
        try {
          const expDate = new Date(expiry);
          const now = new Date();
          if (expDate < now) status = 'expired';
          else if (expDate.getTime() - now.getTime() < 30 * 24 * 60 * 60 * 1000) status = 'expiring';
        } catch {
          /* keep verified */
        }
      }
      state.documents.unshift({
        ...action.payload,
        id,
        createdAt,
        status,
      });
    },
    removeDocument: (state, action: { payload: string }) => {
      state.documents = state.documents.filter((d) => d.id !== action.payload);
    },
  },
});

export const { addDocument, removeDocument } = documentsSlice.actions;
export default documentsSlice.reducer;
