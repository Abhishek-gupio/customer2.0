import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import {
  listDocuments as fetchDocsAPI,
  getDocument as fetchDocAPI,
  deleteDocument as deleteDocAPI,
  type DocumentResponse,
  BACKEND_TYPE_MAP,
} from '../../services/documentService';

export interface DocumentItem {
  id: string;
  type: string;
  vehicle: string;
  imageUri: string;
  documentNumber: string | null;
  issueDate: string | null;
  expiryDate: string | null;
  issuerName: string | null;
  verificationStatus: string;
  source: string;
  extractedFields: any;
  status: 'verified' | 'expiring' | 'expired';
  createdAt: string;
}

function mapStatus(doc: DocumentResponse): 'verified' | 'expiring' | 'expired' {
  if (doc.verificationStatus === 'REJECTED') return 'expired';
  if (doc.expiryDate) {
    const exp = new Date(doc.expiryDate);
    const now = new Date();
    if (exp < now) return 'expired';
    if (exp.getTime() - now.getTime() < 30 * 24 * 60 * 60 * 1000) return 'expiring';
  }
  if (doc.verificationStatus === 'VERIFIED') return 'verified';
  return 'verified';
}

function toDocumentItem(doc: DocumentResponse): DocumentItem {
  return {
    id: doc.id,
    type: BACKEND_TYPE_MAP[doc.type] || doc.type,
    vehicle: doc.vehicle?.registrationNumber || '',
    imageUri: doc.fileUrl,
    documentNumber: doc.documentNumber,
    issueDate: doc.issueDate,
    expiryDate: doc.expiryDate,
    issuerName: doc.issuerName,
    verificationStatus: doc.verificationStatus,
    source: doc.source,
    extractedFields: doc.extractedFields,
    status: mapStatus(doc),
    createdAt: doc.createdAt,
  };
}

interface DocumentsState {
  documents: DocumentItem[];
  loading: boolean;
  error: string | null;
}

const initialState: DocumentsState = {
  documents: [],
  loading: false,
  error: null,
};

export const fetchDocuments = createAsyncThunk('documents/fetchAll', async () => {
  const docs = await fetchDocsAPI();
  return docs.map(toDocumentItem);
});

export const fetchDocumentById = createAsyncThunk('documents/fetchById', async (id: string) => {
  const doc = await fetchDocAPI(id);
  return toDocumentItem(doc);
});

export const removeDocumentAsync = createAsyncThunk('documents/remove', async (id: string) => {
  await deleteDocAPI(id);
  return id;
});

const documentsSlice = createSlice({
  name: 'documents',
  initialState,
  reducers: {
    addDocumentFromResponse: (state, action: { payload: DocumentItem }) => {
      state.documents.unshift(action.payload);
    },
    clearDocuments: (state) => {
      state.documents = [];
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchDocuments.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchDocuments.fulfilled, (state, action) => {
        state.loading = false;
        state.documents = action.payload;
      })
      .addCase(fetchDocuments.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch documents';
      })
      .addCase(fetchDocumentById.fulfilled, (state, action) => {
        const idx = state.documents.findIndex((d) => d.id === action.payload.id);
        if (idx >= 0) state.documents[idx] = action.payload;
        else state.documents.unshift(action.payload);
      })
      .addCase(removeDocumentAsync.fulfilled, (state, action) => {
        state.documents = state.documents.filter((d) => d.id !== action.payload);
      });
  },
});

export const { addDocumentFromResponse, clearDocuments } = documentsSlice.actions;

export function toDocItem(doc: DocumentResponse): DocumentItem {
  return toDocumentItem(doc);
}

export default documentsSlice.reducer;
