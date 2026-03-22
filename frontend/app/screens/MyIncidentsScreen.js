import React, { useState, useEffect } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { APIClient } from '../services/api';

const MyIncidentsScreen = () => {
  const { token } = useAuth();
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const apiClient = new APIClient(token);

  useEffect(() => {
    fetchMyIncidents();
  }, []);

  const handleToggleVerification = async (incident) => {
    try {
      const newVerified = !incident.verified;
      setLoading(true);
      await apiClient.updateIncidentVerification(incident._id, newVerified);
      // refresh list after update
      fetchMyIncidents();
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to update verification');
    } finally {
      setLoading(false);
    }
  };

  const fetchMyIncidents = async () => {
    try {
      setLoading(true);
      const response = await apiClient.getMyIncidents();
      setIncidents(response.data || []);
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to fetch incidents');
    } finally {
      setLoading(false);
    }
  };

  const getSeverityColor = (severity) => {
    const colors = {
      low: '#4CAF50',
      medium: '#FF9800',
      high: '#FF1744',
    };
    return colors[severity] || '#999';
  };

  const renderIncident = ({ item }) => (
    <View style={styles.incidentCard}>
      <View style={styles.cardHeader}>
        <View
          style={[
            styles.severityBadge,
            { backgroundColor: getSeverityColor(item.severity) },
          ]}
        >
          <Text style={styles.severityText}>{item.severity.toUpperCase()}</Text>
        </View>
        <Text style={styles.timestamp}>
          {new Date(item.timestamp).toLocaleDateString()}
        </Text>
      </View>

      <Text style={styles.description}>{item.description}</Text>

      <View style={styles.cardFooter}>
        <Text style={styles.location}>
          📍 {typeof item.lat === 'number' ? item.lat.toFixed(4) : '–'}, {typeof item.lng === 'number' ? item.lng.toFixed(4) : '–'}
        </Text>
        <View style={styles.verificationBadge}>
          <Text style={styles.verificationText}>
            {item && item.verified ? '✓ Verified' : '✗ Unverified'}
          </Text>
          <Text style={styles.confidenceText}>
            {typeof item.confidence === 'number' ? Math.round(item.confidence * 100) : 0}%
          </Text>
          {/* allow user to toggle if they want to override AI */}
          <TouchableOpacity
            onPress={() => handleToggleVerification(item)}
            style={styles.toggleButton}
          >
            <Text style={styles.toggleButtonText}>
              {item.verified ? 'Mark Unverified' : 'Mark Verified'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {incidents.length === 0 ? (
        <View style={styles.centerContainer}>
          <Text style={styles.emptyText}>No incidents reported yet</Text>
          <Text style={styles.emptySubtext}>
            Help keep your community safe by reporting incidents
          </Text>
        </View>
      ) : (
        <FlatList
          data={incidents}
          keyExtractor={(item) => item._id}
          renderItem={renderIncident}
          contentContainerStyle={styles.listContent}
          refreshing={loading}
          onRefresh={fetchMyIncidents}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  incidentCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  severityBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  severityText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  timestamp: {
    fontSize: 12,
    color: '#999',
  },
  description: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
    marginBottom: 12,
  },
  location: {
    fontSize: 12,
    color: '#666',
    fontFamily: 'monospace',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  toggleButton: {
    marginTop: 4,
  },
  toggleButtonText: {
    fontSize: 10,
    color: '#007AFF',
    textDecorationLine: 'underline',
  },
  verificationBadge: {
    alignItems: 'flex-end',
  },
  verificationText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#007AFF',
    marginBottom: 2,
  },
  confidenceText: {
    fontSize: 12,
    color: '#666',
  },
});

export default MyIncidentsScreen;
