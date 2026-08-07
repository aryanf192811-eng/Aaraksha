// src/api/passport.api.ts
// Returns a raw PDF binary stream (Content-Type: application/pdf), not the
// standard JSON envelope — verified against passport.controller.js, which
// pipes a PDFKit stream directly to the response.
import api from './client'

const passportApi = {
  generate: (tripId: string) =>
    api.post(`/journey-passport/${tripId}`, {}, { responseType: 'blob' }),
}

export default passportApi
