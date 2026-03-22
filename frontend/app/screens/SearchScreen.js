import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { APIClient } from '../services/api';
import { initializeSocket } from '../services/socket';
import PlaceSearchBar from '../components/PlaceSearchBar';
import IncidentReportModal from '../components/IncidentReportModal';
import * as Location from 'expo-location';

const SearchScreen = ({ navigation }) => {
  const { token } = useAuth();
  const [userLocation, setUserLocation] = useState(null);
  const [fromLocation, setFromLocation] = useState(null);
  const [destination, setDestination] = useState(null);
  const [loading, setLoading] = useState(false);
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [reportLocation, setReportLocation] = useState(null);
  const [locationError, setLocationError] = useState(null);
  const [gettingLocation, setGettingLocation] = useState(true);
  const apiClient = new APIClient(token);

  // Get user location on mount
  useEffect(() => {
    let isMounted = true;

    const fetchUserLocation = async () => {
      try {
        setGettingLocation(true);
        setLocationError(null);
        console.log('📍 Requesting location permissions...');

        const { status } = await Location.requestForegroundPermissionsAsync();
        console.log('📍 Permission status:', status);

        if (status !== 'granted') {
          const errorMsg = 'Location permission is required to use SafeRoute';
          setLocationError(errorMsg);
          console.error('❌ Location permission denied:', status);
          Alert.alert('Permission Denied', errorMsg);
          return;
        }

        console.log('📍 Getting current position...');
        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
          timeout: 15000, // 15 seconds timeout
        });

        const { latitude, longitude } = location.coords;
        console.log('✅ Location obtained:', { latitude, longitude });

        if (isMounted) {
          setUserLocation({ lat: latitude, lng: longitude });
          setLocationError(null);
        }

        // Initialize socket after getting location
        initializeSocket();
      } catch (error) {
        console.error('❌ Location error:', error.message, error.code);

        if (isMounted) {
          let errorMsg = 'Failed to get location';
          if (error.code === 'PERMISSION_DENIED') {
            errorMsg = 'Location permission was denied';
          } else if (error.code === 'POSITION_UNAVAILABLE') {
            errorMsg = 'Location service is unavailable';
          } else if (error.code === 'TIMEOUT') {
            errorMsg = 'Location request timed out. Please try again.';
          }
          setLocationError(errorMsg);
          console.error('⚠️ Location error message:', errorMsg);
        }
      } finally {
        if (isMounted) {
          setGettingLocation(false);
        }
      }
    };

    fetchUserLocation();

    return () => {
      isMounted = false;
    };
  }, []);

  const retryLocation = async () => {
    setGettingLocation(true);
    setLocationError(null);

    try {
      console.log('🔄 Retrying location...');
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
        timeout: 15000,
      });

      const { latitude, longitude } = location.coords;
      console.log('✅ Location obtained on retry:', { latitude, longitude });
      setUserLocation({ lat: latitude, lng: longitude });
      setLocationError(null);
      initializeSocket();
    } catch (error) {
      console.error('❌ Retry location error:', error.message);
      setLocationError('Could not get location. Try again or enable location services.');
    } finally {
      setGettingLocation(false);
    }
  };

  const handleFindRoute = async () => {
    // Use custom "From" location if selected, otherwise use current location
    const startLoc = fromLocation || userLocation;

    if (!startLoc) {
      Alert.alert('Error', 'Unable to get your location. Please enable location services.');
      return;
    }

    if (!destination) {
      Alert.alert('Error', 'Please select a destination (To location)');
      return;
    }

    setLoading(true);
    try {
      console.log('🔍 Finding route from:', { 
        from: fromLocation ? `Custom: ${fromLocation.name}` : 'Current location',
        to: destination.name 
      });

      const response = await apiClient.calculateRoute(
        startLoc.lat,
        startLoc.lng,
        destination.lat,
        destination.lng
      );

      // Navigate to MapScreen with route data
      // build a routes object using whatever keys the backend returned
      const routesObj = {};
      if (response.safestRoute) routesObj.safest = response.safestRoute;
      if (response.mediumRoute) routesObj.medium = response.mediumRoute;
      if (response.fastestRoute) routesObj.fastest = response.fastestRoute;
      if (response.dangerousRoute) routesObj.dangerous = response.dangerousRoute;

      navigation.navigate('MapHome', {
        routes: routesObj,
        fromLocation: startLoc,
        toLocation: destination,
      });
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to calculate route');
    } finally {
      setLoading(false);
    }
  };

  const handleReportIncident = async (reportData) => {
    setLoading(true);
    try {
      const response = await apiClient.reportIncident(
        reportData.lat,
        reportData.lng,
        reportData.description,
        reportData.severity
      );

      setReportModalVisible(false);
      const confPercent = ((response && typeof response.confidence === 'number') ? response.confidence : 0) * 100;
      Alert.alert(
        'Report Submitted',
        `Confidence: ${confPercent.toFixed(1)}%\nVerified: ${response && response.verified ? 'Yes' : 'No'}`
      );
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to report incident');
    } finally {
      setLoading(false);
    }
  };

  const openReportModal = () => {
    if (userLocation) {
      setReportLocation({
        lat: userLocation.lat,
        lng: userLocation.lng,
      });
      setReportModalVisible(true);
    } else {
      Alert.alert('Info', 'Getting your location...');
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>🛤️ SafeRoute</Text>
        <Text style={styles.headerSubtitle}>Find your safest route</Text>
      </View>

      {/* Search Container */}
      <ScrollView style={styles.searchContainer}>
        {/* Location Loading/Error State */}
        {gettingLocation && (
          <View style={styles.loadingBox}>
            <ActivityIndicator color="#007AFF" size="small" />
            <Text style={styles.loadingText}>📍 Getting your location...</Text>
          </View>
        )}

        {locationError && (
          <View style={styles.errorBox}>
            <Text style={styles.errorTitle}>⚠️ Location Error</Text>
            <Text style={styles.errorText}>{locationError}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={retryLocation}>
              <Text style={styles.retryButtonText}>🔄 Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {!gettingLocation && !locationError && !userLocation && (
          <View style={styles.warningBox}>
            <Text style={styles.warningText}>
              📍 Unable to get location. Please enable location services.
            </Text>
          </View>
        )}

        {/* From Location - Searchable or Current */}
        <View style={styles.locationBox}>
          <Text style={styles.locationLabel}>📍 From (Start Point)</Text>
          
          {fromLocation ? (
            // Show selected custom location
            <View style={styles.selectedFromBox}>
              <Text style={styles.selectedFromText}>{fromLocation.name}</Text>
              <TouchableOpacity
                style={styles.changeFromButton}
                onPress={() => setFromLocation(null)}
              >
                <Text style={styles.changeFromButtonText}>Change Start Point</Text>
              </TouchableOpacity>
            </View>
          ) : (
            // Show search bar with current location option
            <View>
              <PlaceSearchBar
                onPlaceSelected={(place) => {
                  console.log('From location selected:', place);
                  setFromLocation(place);
                }}
                placeholder="Search start location or use current"
                isOverlay={false}
              />
              
              {userLocation && (
                <TouchableOpacity
                  style={styles.useCurrentLocationBtn}
                  onPress={() => {
                    console.log('Using current location as From');
                    setFromLocation(null); // Keep null to use userLocation as default
                  }}
                >
                  <Text style={styles.useCurrentLocationText}>
                    📍 Use My Current Location ({userLocation.lat.toFixed(4)}, {userLocation.lng.toFixed(4)})
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>

        {/* To Location Search */}
        <View style={styles.locationBox}>
          <Text style={styles.locationLabel}>🎯 To Destination</Text>
          <PlaceSearchBar
            onPlaceSelected={(place) => {
              console.log('Destination selected:', place);
              setDestination(place);
            }}
            placeholder="Enter your destination"
            isOverlay={false}
          />
        </View>

        {/* Destination Display */}
        {destination && (
          <View style={styles.selectedDestinationBox}>
            <Text style={styles.selectedDestinationLabel}>✅ Destination Selected</Text>
            <Text style={styles.selectedDestinationText}>{destination.name}</Text>
            <TouchableOpacity onPress={() => setDestination(null)}>
              <Text style={styles.clearDestinationBtn}>Change Destination</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Route Info Box */}
        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>ℹ️ How it works</Text>
          <Text style={styles.infoText}>
            • Fill in your destination{'\n'}
            • We'll calculate the safest route{'\n'}
            • Choose between Safest, Balanced, or Fastest{'\n'}
            • View incidents on the map
          </Text>
        </View>
      </ScrollView>

      {/* Action Buttons - Fixed at bottom */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.findRouteButton, loading && styles.buttonDisabled]}
          onPress={handleFindRoute}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.findRouteButtonText}>🔍 Find Safe Route</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.reportIncidentButton}
          onPress={openReportModal}
          disabled={loading}
        >
          <Text style={styles.reportIncidentButtonText}>⚠️ Report Incident</Text>
        </TouchableOpacity>
      </View>

      {/* Incident Report Modal */}
      {reportLocation && (
        <IncidentReportModal
          visible={reportModalVisible}
          location={reportLocation}
          onSubmit={handleReportIncident}
          onCancel={() => setReportModalVisible(false)}
          loading={loading}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    backgroundColor: '#007AFF',
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
  },
  searchContainer: {
    flex: 1,
    padding: 16,
  },
  locationBox: {
    marginBottom: 20,
  },
  locationLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  currentLocationBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  currentLocationText: {
    flex: 1,
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  clearX: {
    fontSize: 18,
    color: '#999',
    marginLeft: 8,
  },
  selectedDestinationBox: {
    backgroundColor: '#E8F5E9',
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
    borderRadius: 10,
    padding: 14,
    marginBottom: 20,
  },
  selectedDestinationLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2E7D32',
    marginBottom: 4,
  },
  selectedDestinationText: {
    fontSize: 15,
    color: '#1B5E20',
    fontWeight: '600',
    marginBottom: 8,
  },
  clearDestinationBtn: {
    fontSize: 12,
    color: '#0277BD',
    fontWeight: '600',
  },
  infoBox: {
    backgroundColor: '#E3F2FD',
    borderLeftWidth: 4,
    borderLeftColor: '#007AFF',
    borderRadius: 10,
    padding: 14,
    marginTop: 10,
  },
  infoTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1565C0',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 12,
    color: '#1976D2',
    lineHeight: 18,
  },
  buttonContainer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#ddd',
    backgroundColor: '#fff',
    gap: 12,
  },
  findRouteButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#007AFF',
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  findRouteButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  reportIncidentButton: {
    backgroundColor: '#FF3B30',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#FF3B30',
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  reportIncidentButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  loadingBox: {
    backgroundColor: '#E3F2FD',
    borderRadius: 10,
    padding: 14,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderLeftWidth: 4,
    borderLeftColor: '#007AFF',
  },
  loadingText: {
    fontSize: 13,
    color: '#1565C0',
    marginLeft: 8,
    fontWeight: '500',
  },
  errorBox: {
    backgroundColor: '#FFEBEE',
    borderRadius: 10,
    padding: 14,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#D32F2F',
  },
  errorTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#C62828',
    marginBottom: 4,
  },
  errorText: {
    fontSize: 12,
    color: '#B71C1C',
    marginBottom: 10,
    lineHeight: 16,
  },
  retryButton: {
    backgroundColor: '#D32F2F',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  warningBox: {
    backgroundColor: '#FFF3E0',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#F57C00',
  },
  warningText: {
    fontSize: 12,
    color: '#E65100',
    fontWeight: '500',
  },
  disabledButton: {
    opacity: 0.7,
    flexDirection: 'row',
    alignItems: 'center',
  },
  errorButton: {
    backgroundColor: '#FFEBEE',
    borderColor: '#EF5350',
  },
  errorButtonText: {
    fontSize: 14,
    color: '#D32F2F',
    fontWeight: '500',
  },
  selectedFromBox: {
    backgroundColor: '#E8F5E9',
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
  },
  selectedFromText: {
    fontSize: 15,
    color: '#1B5E20',
    fontWeight: '600',
    marginBottom: 8,
  },
  changeFromButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  changeFromButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  useCurrentLocationBtn: {
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#E3F2FD',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2196F3',
  },
  useCurrentLocationText: {
    fontSize: 12,
    color: '#1565C0',
    fontWeight: '600',
    textAlign: 'center',
  },
});

export default SearchScreen;
