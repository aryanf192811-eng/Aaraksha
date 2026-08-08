// src/api/passport.api.ts
// PDF download goes through direct browser navigation (getDownloadUrl), not
// an axios blob fetch + synthetic anchor click. Blob-URL downloads have a
// real Chromium quirk where the `download` attribute's filename is
// sometimes ignored, and the file lands in history under the blob's
// internal UUID instead — confirmed happening even with a fully correct,
// deferred cleanup implementation. Navigating straight to the API URL lets
// the browser use the server's real Content-Disposition header, which is
// the standard, unambiguous way browsers name downloads. The backend's
// auth middleware accepts ?token= as a fallback specifically because a
// plain navigation can't carry an Authorization header.
import { useAuthStore } from '../store/auth.store'

const API_URL = import.meta.env.VITE_API_URL

const passportApi = {
  getDownloadUrl: (tripId: string) => {
    const token = useAuthStore.getState().token
    return `${API_URL}/journey-passport/${tripId}?token=${encodeURIComponent(token || '')}`
  },
}

export default passportApi
