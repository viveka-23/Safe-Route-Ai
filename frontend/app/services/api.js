import axios from 'axios';

const API_URL = process.env.EXPO_PUBLIC_API_URL;

export class APIClient {
  constructor(token) {
    this.token = token;
  }

  getHeaders() {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.token}`,
    };
  }

  // Incident APIs
  async getIncidents(lat, lng, radius = 5) {
    try {
      const response = await axios.get(`${API_URL}/incidents`, {
        params: { lat, lng, radius },
      });
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async reportIncident(lat, lng, description, severity) {
    try {
      const response = await axios.post(
        `${API_URL}/incidents/report`,
        {
          lat,
          lng,
          description,
          severity,
        },
        { headers: this.getHeaders() }
      );
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getMyIncidents() {
    try {
      const response = await axios.get(`${API_URL}/incidents/my-incidents`, {
        headers: this.getHeaders(),
      });
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Route APIs
  async calculateRoute(startLat, startLng, endLat, endLng) {
    try {
      const response = await axios.post(
        `${API_URL}/routes/calculate`,
        {
          startLat,
          startLng,
          endLat,
          endLng,
        },
        { headers: this.getHeaders() }
      );
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Update verification status for one of the user's incidents.
   * PATCH /api/incidents/:id/verify
   */
  async updateIncidentVerification(id, verified) {
    try {
      const response = await axios.patch(
        `${API_URL}/incidents/${id}/verify`,
        { verified },
        { headers: this.getHeaders() }
      );
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Place search using Nominatim API
  async searchPlace(query) {
    try {
      const response = await axios.get(
        process.env.EXPO_PUBLIC_NOMINATIM_API,
        {
          params: {
            q: query,
            format: 'json',
            limit: 5,
          },
        }
      );
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  handleError(error) {
    let message = 'An error occurred';
    if (error.response) {
      message = error.response.data?.error || error.response.statusText;
    } else if (error.message) {
      message = error.message;
    }
    return new Error(message);
  }
}
