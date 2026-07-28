import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';

const API_BASE = 'http://localhost:8000/api';

export const fetchComplaints = createAsyncThunk('complaints/fetch', async () => {
  const response = await fetch(`${API_BASE}/complaints`);
  if (!response.ok) throw new Error('Unable to load complaints');
  return response.json();
});

export const analyzeComplaint = createAsyncThunk('complaints/analyze', async (formData) => {
  const response = await fetch(`${API_BASE}/analyze-complaint`, {
    method: 'POST',
    body: formData,
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || 'Unable to analyze complaint');
  }
  return response.json();
});

export const saveComplaint = createAsyncThunk('complaints/save', async (payload) => {
  const response = await fetch(`${API_BASE}/complaints`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error('Unable to save complaint');
  return response.json();
});

const complaintsSlice = createSlice({
  name: 'complaints',
  initialState: {
    complaints: [],
    analysis: null,
    loading: false,
    error: null,
  },
  reducers: {},
  extraReducers: (builder) => {
    builder.addCase(fetchComplaints.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(fetchComplaints.fulfilled, (state, action) => {
      state.loading = false;
      state.complaints = action.payload;
    });
    builder.addCase(fetchComplaints.rejected, (state, action) => {
      state.loading = false;
      state.error = action.error.message;
    });
    builder.addCase(analyzeComplaint.pending, (state) => {
      state.loading = true;
      state.error = null;
    });
    builder.addCase(analyzeComplaint.fulfilled, (state, action) => {
      state.loading = false;
      state.analysis = action.payload;
    });
    builder.addCase(analyzeComplaint.rejected, (state, action) => {
      state.loading = false;
      state.error = action.error.message;
    });
    builder.addCase(saveComplaint.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(saveComplaint.fulfilled, (state, action) => {
      state.loading = false;
      state.complaints.unshift(action.payload);
      state.analysis = null;
    });
    builder.addCase(saveComplaint.rejected, (state, action) => {
      state.loading = false;
      state.error = action.error.message;
    });
  },
});

export default complaintsSlice.reducer;
