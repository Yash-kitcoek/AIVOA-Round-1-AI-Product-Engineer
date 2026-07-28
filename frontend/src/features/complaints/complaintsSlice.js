import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';

const API_BASE = 'http://localhost:8000/api';

// ─── Thunks ───────────────────────────────────────────────────────────────

export const fetchComplaints = createAsyncThunk('complaints/fetch', async () => {
  const res = await fetch(`${API_BASE}/complaints`);
  if (!res.ok) throw new Error('Unable to load complaints');
  return res.json();
});

export const fetchStats = createAsyncThunk('complaints/fetchStats', async () => {
  const res = await fetch(`${API_BASE}/complaints/stats`);
  if (!res.ok) throw new Error('Unable to load stats');
  return res.json();
});

export const analyzeComplaint = createAsyncThunk('complaints/analyze', async (formData) => {
  const res = await fetch(`${API_BASE}/analyze-complaint`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(errorText || 'Unable to analyze complaint');
  }
  return res.json();
});

export const saveComplaint = createAsyncThunk('complaints/save', async (payload) => {
  const res = await fetch(`${API_BASE}/complaints`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Unable to save complaint');
  return res.json();
});

export const updateComplaint = createAsyncThunk('complaints/update', async ({ id, data }) => {
  const res = await fetch(`${API_BASE}/complaints/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Unable to update complaint');
  return res.json();
});

export const deleteComplaint = createAsyncThunk('complaints/delete', async (id) => {
  const res = await fetch(`${API_BASE}/complaints/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Unable to delete complaint');
  return id;
});

// ─── Slice ────────────────────────────────────────────────────────────────

const complaintsSlice = createSlice({
  name: 'complaints',
  initialState: {
    complaints: [],
    stats: null,
    analysis: null,
    selectedComplaint: null,
    view: 'dashboard', // 'dashboard' | 'new' | 'register' | 'detail'
    loading: false,
    statsLoading: false,
    error: null,
    saveSuccess: false,
  },
  reducers: {
    setView: (state, action) => {
      state.view = action.payload;
      state.error = null;
      state.saveSuccess = false;
    },
    setSelectedComplaint: (state, action) => {
      state.selectedComplaint = action.payload;
    },
    clearAnalysis: (state) => {
      state.analysis = null;
      state.error = null;
      state.saveSuccess = false;
    },
    clearError: (state) => {
      state.error = null;
    },
    clearSaveSuccess: (state) => {
      state.saveSuccess = false;
    },
  },
  extraReducers: (builder) => {
    // fetchComplaints
    builder
      .addCase(fetchComplaints.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(fetchComplaints.fulfilled, (state, action) => {
        state.loading = false;
        state.complaints = action.payload;
      })
      .addCase(fetchComplaints.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message;
      });

    // fetchStats
    builder
      .addCase(fetchStats.pending, (state) => { state.statsLoading = true; })
      .addCase(fetchStats.fulfilled, (state, action) => {
        state.statsLoading = false;
        state.stats = action.payload;
      })
      .addCase(fetchStats.rejected, (state) => { state.statsLoading = false; });

    // analyzeComplaint
    builder
      .addCase(analyzeComplaint.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.analysis = null;
      })
      .addCase(analyzeComplaint.fulfilled, (state, action) => {
        state.loading = false;
        state.analysis = action.payload;
      })
      .addCase(analyzeComplaint.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message;
      });

    // saveComplaint
    builder
      .addCase(saveComplaint.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(saveComplaint.fulfilled, (state, action) => {
        state.loading = false;
        state.complaints.unshift(action.payload);
        state.analysis = null;
        state.saveSuccess = true;
        // Update stats totals
        if (state.stats) {
          state.stats.total += 1;
          state.stats.open += 1;
        }
      })
      .addCase(saveComplaint.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message;
      });

    // updateComplaint
    builder
      .addCase(updateComplaint.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(updateComplaint.fulfilled, (state, action) => {
        state.loading = false;
        const idx = state.complaints.findIndex((c) => c.id === action.payload.id);
        if (idx !== -1) state.complaints[idx] = action.payload;
        if (state.selectedComplaint?.id === action.payload.id) {
          state.selectedComplaint = action.payload;
        }
        state.saveSuccess = true;
      })
      .addCase(updateComplaint.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message;
      });

    // deleteComplaint
    builder
      .addCase(deleteComplaint.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(deleteComplaint.fulfilled, (state, action) => {
        state.loading = false;
        state.complaints = state.complaints.filter((c) => c.id !== action.payload);
        if (state.selectedComplaint?.id === action.payload) {
          state.selectedComplaint = null;
          state.view = 'register';
        }
        if (state.stats) {
          state.stats.total = Math.max(0, state.stats.total - 1);
        }
      })
      .addCase(deleteComplaint.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message;
      });
  },
});

export const { setView, setSelectedComplaint, clearAnalysis, clearError, clearSaveSuccess } = complaintsSlice.actions;
export default complaintsSlice.reducer;
