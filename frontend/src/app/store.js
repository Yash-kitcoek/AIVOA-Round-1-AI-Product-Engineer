import { configureStore } from '@reduxjs/toolkit';
import complaintsReducer from '../features/complaints/complaintsSlice';

export default configureStore({
  reducer: {
    complaints: complaintsReducer,
  },
});
