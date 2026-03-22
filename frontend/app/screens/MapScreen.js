import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  Alert,
  ScrollView,
  Platform,
  LayoutAnimation,
  UIManager,
} from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import * as Location from 'expo-location';
import { useAuth } from '../context/AuthContext';
import { APIClient } from '../services/api';
import {
  initializeSocket,
  subscribeToIncidents,
  joinZone,
  disconnectSocket,
} from '../services/socket';

const MapScreen = ({ navigation, route }) => {
  const { token } = useAuth();
  const [userLocation, setUserLocation] = useState(null);
  const [incidents, setIncidents] = useState([]);
  const [selectedRoute, setSelectedRoute] = useState('safest');
  const [showRouteInfo, setShowRouteInfo] = useState(false);
  const [panelExpanded, setPanelExpanded] = useState(false);
  const mapRef = useRef(null);
  const apiClient = new APIClient(token);

  // Ensure selected route exists in payload and avoid stale/undefined behaviors
  useEffect(() => {
    if (route?.params?.routes) {
      const keys = Object.keys(route.params.routes);
      if (keys.length && !keys.includes(selectedRoute)) {
        setSelectedRoute(keys[0]);
      }
    }
  }, [route?.params?.routes]);

  const getRouteConclusion = (routeOption, routeKey) => {
    if (!routeOption) return { label: 'Unknown', color: '#999', details: '' };

    const level = routeOption.riskLevel || '';
    const stats = routeOption.incidentStats || { total: 0, high: 0, medium: 0, low: 0 };
    const distance = routeOption.distance ? (routeOption.distance / 1000).toFixed(2) : '0';
    const duration = routeOption.duration ? Math.round(routeOption.duration / 60) : '0';

    let label = '';
    let color = '#999';
    let details = '';

    switch (routeKey) {
      case 'safest':
        label = 'Safest Route';
        color = '#2E7D32';
        details = `This is the safest available route with ${stats.total} incidents near the path (${stats.high} high, ${stats.medium} medium, ${stats.low} low severity). Recommended for maximum safety.`;
        break;

      case 'medium':
        label = 'Balanced Route';
        color = '#FF9800';
        details = `This balanced route offers good safety and convenience with ${stats.total} incidents near the path (${stats.high} high, ${stats.medium} medium, ${stats.low} low severity). Good compromise between safety and time.`;
        break;

      case 'fastest':
        label = 'Fastest Route';
        color = '#2196F3';
        details = `This is the fastest route (${duration} min) with ${stats.total} incidents near the path (${stats.high} high, ${stats.medium} medium, ${stats.low} low severity). Choose if time is your priority.`;
        break;

      case 'dangerous':
        label = 'Dangerous Route';
        color = '#D32F2F';
        details = `This route has the highest risk with ${stats.total} incidents near the path (${stats.high} high, ${stats.medium} medium, ${stats.low} low severity). Avoid if possible - use safer alternatives.`;
        break;

      default:
        label = 'Route';
        color = '#666';
        details = `Route with ${stats.total} incidents near the path.`;
    }

    return { label, color, details };
  };

  // For layout animation on Android old architecture only.
  // New architecture no-op warning is avoided by not calling experimental API.
  useEffect(() => {
    if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
      // Keep compatibility for older React Native versions (no-op on New Architecture).
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
  }, []);

  // Get route data from navigation params
  const passedRoutes = route?.params?.routes;
  const fromLocation = route?.params?.fromLocation;
  const toLocation = route?.params?.toLocation;

  // Request location permission and get user location
  useEffect(() => {
    let isMounted = true;

    const fetchLocation = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          console.error('❌ Location permission denied on MapScreen');
          return;
        }

        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
          timeout: 15000,
        });

        const { latitude, longitude } = location.coords;
        console.log('✅ MapScreen location:', { latitude, longitude });

        if (isMounted) {
          setUserLocation({ lat: latitude, lng: longitude });

          // Initialize socket and join user's zone
          initializeSocket();
          joinZone(latitude, longitude);

          // Fetch initial incidents
          fetchIncidents(latitude, longitude);
        }
      } catch (error) {
        console.error('❌ MapScreen location error:', error.message);
      }
    };

    fetchLocation();

    // Subscribe to new incidents
    const unsubscribe = subscribeToIncidents((newIncident) => {
      if (isMounted) {
        setIncidents((prev) => [
          { ...newIncident, id: newIncident.id || Date.now() },
          ...prev,
        ]);
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
      disconnectSocket();
    };
  }, []);

  // Auto-fit map to show the currently selected route when it loads or changes
  useEffect(() => {
    const currentCoords =
      passedRoutes?.[selectedRoute]?.geometry?.coordinates;
    if (currentCoords && mapRef.current) {
      setTimeout(() => {
        mapRef.current?.fitToCoordinates(
          currentCoords.map((c) => ({ latitude: c[1], longitude: c[0] })),
          { edgePadding: { top: 80, right: 50, bottom: 150, left: 50 }, animated: true }
        );
      }, 500);
    }
  }, [passedRoutes, selectedRoute]);

  const fetchIncidents = async (lat, lng) => {
    try {
      const response = await apiClient.getIncidents(lat, lng, 5);
      setIncidents(response.data || []);
    } catch (error) {
      console.error('Failed to fetch incidents:', error);
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

      // Refresh incidents
      if (userLocation) {
        fetchIncidents(userLocation.lat, userLocation.lng);
      }
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to report incident');
    } finally {
      setLoading(false);
    }
  };

  const handleMapPress = (e) => {
    const { latitude, longitude } = e.nativeEvent.coordinate;
    setReportLocation({ lat: latitude, lng: longitude });
    setReportModalVisible(true);
  };

  const animateRoute = (key) => {
    const coords = passedRoutes?.[key]?.geometry?.coordinates;
    if (coords && mapRef.current) {
      mapRef.current.fitToCoordinates(
        coords.map((c) => ({ latitude: c[1], longitude: c[0] })),
        { edgePadding: { top: 80, right: 50, bottom: 150, left: 50 }, animated: true }
      );
    }
  };

  const getRouteColor = (type) => {
    const colors = {
      safest: '#4CAF50', // Green
      medium: '#FF9800', // Orange
      fastest: '#2196F3', // Blue for fastest
      dangerous: '#FF1744', // Red
    };
    return colors[type] || '#999';
  };

  const currentRoute = passedRoutes?.[selectedRoute];

  // when passedRoutes is empty or undefined, do not break rendering
  if (!passedRoutes) {
    return (
      <View style={styles.container}>
        <Text style={{margin:16}}>No route data provided.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header with back button */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Route Details</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Map */}
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={
          userLocation && {
            latitude: userLocation.lat,
            longitude: userLocation.lng,
            latitudeDelta: 0.05,
            longitudeDelta: 0.05,
          }
        }
      >
        {/* From Location Marker (Blue) */}
        {fromLocation && (
          <Marker
            coordinate={{ latitude: fromLocation.lat, longitude: fromLocation.lng }}
            title="Start"
            description={fromLocation.name}
            pinColor="blue"
          />
        )}

        {/* To Location Marker (Green) */}
        {toLocation && (
          <Marker
            coordinate={{ latitude: toLocation.lat, longitude: toLocation.lng }}
            title="Destination"
            description={toLocation.name}
            pinColor="green"
          />
        )}

        {/* Route Polyline */}
        {currentRoute && currentRoute.geometry?.coordinates && (
          <Polyline
            coordinates={currentRoute.geometry.coordinates.map((c) => ({
              latitude: c[1],
              longitude: c[0],
            }))}
            strokeColor={getRouteColor(selectedRoute)}
            strokeWidth={4}
          />
        )}

        {/* Incident Markers */}
        {incidents.map((incident) => (
          <Marker
            key={incident.id || incident._id}
            coordinate={{ latitude: incident.lat, longitude: incident.lng }}
            pinColor={
              incident.severity === 'high'
                ? 'red'
                : incident.severity === 'medium'
                ? 'orange'
                : 'yellow'
            }
            title={`${incident.severity.toUpperCase()} - ${incident.description}`}
            description={new Date(incident.timestamp).toLocaleDateString()}
          />
        ))}
      </MapView>

      {/* Route Options - Bottom Sheet */}
      {passedRoutes && (
        <View style={styles.routeOptionsContainer}>
          <Text style={styles.routeTitleText}>Choose route type</Text>
          <Text style={styles.routeSubtitleText}>
            Safest, Balanced, Fastest{passedRoutes.dangerous ? ', Dangerous' : ''}
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {Object.keys(passedRoutes).map((key) => {
              const config = {
                safest: { label: 'Safest Route', color: '#4CAF50' },
                medium: { label: 'Balanced', color: '#FF9800' },
                fastest: { label: 'Fastest', color: '#2196F3' },
                dangerous: { label: 'Dangerous', color: '#FF1744' },
              }[key] || { label: key, color: '#999' };

              return (
                <TouchableOpacity
                  key={key}
                  style={[
                    styles.routeOption,
                    selectedRoute === key && styles.routeOptionActive,
                    key === 'dangerous' && styles.routeOptionDanger,
                  ]}
                  onPress={() => {
                    setSelectedRoute(key);
                    setShowRouteInfo(true);
                    animateRoute(key);
                  }}
                >
                  <View style={styles.routeOptionBadge}>
                    <View
                      style={[
                        styles.routeColorDot,
                        { backgroundColor: config.color },
                        key === 'dangerous' && styles.routeColorDotDanger,
                      ]}
                    />
                    <Text
                      style={[
                        styles.routeOptionBadgeText,
                        key === 'dangerous' && styles.routeOptionBadgeDangerText,
                      ]}
                    >
                      {config.label}
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.routeOptionCta,
                      key === 'dangerous' && styles.routeOptionCtaDanger,
                    ]}
                  >
                    {key === selectedRoute ? 'Selected' : 'Choose'}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* Route details panel (distance, explanation, etc.) */}
      {currentRoute && showRouteInfo && (
        <View style={[styles.routeDetailPanel, panelExpanded && styles.routeDetailPanelExpanded]}>
          <ScrollView style={styles.routeDetailScrollView} nestedScrollEnabled>
            <TouchableOpacity
              style={styles.panelDragHandle}
              onPress={() => {
                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                setPanelExpanded(!panelExpanded);
              }}
            >
              <View style={styles.panelDragBar} />
            </TouchableOpacity>
            <View style={styles.routeDetailHeader}>
              <Text style={styles.routeDetailPanelTitle}>Route Details</Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setShowRouteInfo(false)}
              >
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>
          <Text style={styles.routeDetailText}>
            {`Distance: ${(currentRoute.distance / 1000).toFixed(2)} km`}
          </Text>
          <Text style={styles.routeDetailText}>
            {`Duration: ${Math.round(currentRoute.duration / 60)} min`}
          </Text>
          {currentRoute.riskLevel && (
            <Text style={styles.routeDetailText}>
              {`Risk: ${currentRoute.riskLevel}`}
            </Text>
          )}
          {currentRoute.explanation && (
            <Text style={styles.routeExplanationText}>{currentRoute.explanation}</Text>
          )}

          {/* Conclusion message (safe/danger/highlight) */}
          {currentRoute && (
            <View>
              <Text
                style={[
                  styles.routeConclusionText,
                  { color: getRouteConclusion(currentRoute, selectedRoute).color },
                ]}
              >
                {`Conclusion: ${getRouteConclusion(currentRoute, selectedRoute).label}`}
              </Text>
              <Text style={styles.routeConclusionDetails}>
                {getRouteConclusion(currentRoute, selectedRoute).details}
              </Text>
            </View>
          )}

          {/* Dangerous + single route warning */}
          {selectedRoute === 'dangerous' && Object.keys(passedRoutes || {}).length === 1 && (
            <View style={styles.singleRouteWarningBox}>
              <Text style={styles.singleRouteWarningText}>
                ⚠️ Sorry, only one route is available and it is dangerous. Please stay alert and choose a safer path if possible.
              </Text>
            </View>
          )}

          {/* Close details action for users to collapse panel */}
          <TouchableOpacity
            style={styles.closeDetailsButton}
            onPress={() => setShowRouteInfo(false)}
          >
            <Text style={styles.closeDetailsButtonText}>Close</Text>
          </TouchableOpacity>

          {/* Crime Statistics Summary */}
          {incidents && incidents.length > 0 && (
            <View style={styles.crimeStatsContainer}>
              <Text style={styles.crimeStatsHeader}>Crime/Accident Data ({incidents.length} reports):</Text>
              <Text style={styles.crimeStatItem}>
                🔴 High Severity: {incidents.filter(i => i.severity === 'high').length}
              </Text>
              <Text style={styles.crimeStatItem}>
                🟠 Medium Severity: {incidents.filter(i => i.severity === 'medium').length}
              </Text>
              <Text style={styles.crimeStatItem}>
                🟡 Low Severity: {incidents.filter(i => i.severity === 'low').length}
              </Text>
            </View>
          )}

          {/* list of nearby incidents for this route */}
          {currentRoute.incidentList && currentRoute.incidentList.length > 0 && (
            <View style={styles.incidentListContainer}>
              <Text style={styles.incidentListHeader}>Nearby incidents:</Text>
              {currentRoute.incidentList.map((inc, idx) => {
                const severityColor =
                  inc.severity === 'high' ? '#D32F2F' :
                  inc.severity === 'medium' ? '#FF9800' : '#FBC02D';
                return (
                  <View key={idx} style={styles.incidentCard}>
                    <View style={[styles.incidentSeverityDot, { backgroundColor: severityColor }]} />
                    <View style={styles.incidentTextContainer}>
                      <Text style={styles.incidentSeverityText}>{inc.severity.toUpperCase()}</Text>
                      <Text style={styles.incidentDescriptionText}>{inc.description || 'Unknown incident'}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
          </ScrollView>
        </View>
      )}

      {/* Bottom Action Buttons */}
      <View style={styles.bottomButtonsContainer}>
        <TouchableOpacity
          style={styles.searchNewButton}
          onPress={() => navigation.navigate('SearchHome')}
        >
          <Text style={styles.searchNewButtonText}>🔍 Search New Route</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    paddingTop: 12,
    paddingBottom: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
    zIndex: 100,
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
  },
  headerSpacer: {
    width: 40,
  },
  map: {
    flex: 1,
  },
  routeOptionsContainer: {
    position: 'absolute',
    bottom: 160,
    left: 0,
    right: 0,
    paddingHorizontal: 12,
    maxHeight: 90,
    paddingVertical: 8,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderTopWidth: 1,
    borderTopColor: '#ddd',
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },
  routeDetailPanel: {
    position: 'absolute',
    bottom: 100,
    left: 12,
    right: 12,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 6,
    maxHeight: '55%',
    transitionProperty: 'bottom',
    transitionDuration: '300ms',
  },
  routeDetailPanelExpanded: {
    bottom: 40,
    maxHeight: '70%',
  },
  panelDragHandle: {
    alignItems: 'center',
    paddingVertical: 6,
  },
  panelDragBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#c1c1c1',
  },
  routeDetailScrollView: {
    maxHeight: 340,
    minHeight: 180,
  },
  routeTitleText: {
    fontSize: 14,
    color: '#1D4ED8',
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 2,
  },
  routeSubtitleText: {
    fontSize: 12,
    color: '#374151',
    textAlign: 'center',
    marginBottom: 6,
  },
  routeDetailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  routeDetailPanelTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
  },
  closeButton: {
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 15,
    backgroundColor: '#f0f0f0',
  },
  closeButtonText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#666',
  },
  routeDetailText: {
    fontSize: 14,
    color: '#333',
    marginBottom: 2,
  },
  routeExplanationText: {
    fontSize: 12,
    color: '#555',
    marginTop: 4,
  },
  routeConclusionText: {
    fontSize: 14,
    fontWeight: '700',
    marginTop: 10,
  },
  routeConclusionDetails: {
    fontSize: 12,
    color: '#555',
    marginTop: 4,
    lineHeight: 16,
  },
  closeDetailsButton: {
    marginTop: 10,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#E0E0E0',
    alignItems: 'center',
  },
  closeDetailsButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
  },
  incidentListContainer: {
    marginTop: 8,
  },
  incidentListHeader: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  incidentListItem: {
    fontSize: 11,
    color: '#555',
    marginLeft: 8,
  },
  crimeStatsContainer: {
    marginTop: 10,
    padding: 8,
    backgroundColor: '#f9f9f9',
    borderRadius: 6,
    borderLeftWidth: 4,
    borderLeftColor: '#FF9800',
  },
  singleRouteWarningBox: {
    marginTop: 8,
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#FFEBEE',
    borderLeftWidth: 4,
    borderLeftColor: '#D32F2F',
  },
  singleRouteWarningText: {
    color: '#D32F2F',
    fontWeight: '700',
    fontSize: 12,
  },
  crimeStatsHeader: {
    fontSize: 13,
    fontWeight: '700',
    color: '#333',
    marginBottom: 6,
  },
  crimeStatItem: {
    fontSize: 12,
    color: '#555',
    marginBottom: 3,
    lineHeight: 18,
  },
  routeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginRight: 10,
    minWidth: 170,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  routeOptionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  routeOptionBadgeText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1F2937',
    marginLeft: 8,
  },
  routeOptionCta: {
    fontSize: 10,
    fontWeight: '700',
    color: '#3B82F6',
    textTransform: 'uppercase',
  },
  routeOptionDanger: {
    borderColor: '#D32F2F',
    backgroundColor: '#FFEBEE',
  },
  routeOptionBadgeDangerText: {
    color: '#B71C1C',
  },
  routeOptionCtaDanger: {
    color: '#B71C1C',
  },
  routeColorDotDanger: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: '#B71C1C',
  },
  incidentCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  incidentSeverityDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 4,
    marginRight: 10,
  },
  incidentTextContainer: {
    flex: 1,
  },
  incidentSeverityText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 2,
  },
  incidentDescriptionText: {
    fontSize: 12,
    color: '#4B5563',
  },
  routeOptionActive: {
    backgroundColor: '#E8F0FF',
    borderColor: '#1A73E8',
  },
  routeColorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  routeOptionText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1F2937',
  },
  routeOptionTextActive: {
    color: '#0A62C7',
    fontWeight: '800',
    textShadowColor: 'rgba(0,0,0,0.15)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
  },
  bottomButtonsContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#ddd',
  },
  searchNewButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#007AFF',
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  searchNewButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});

export default MapScreen;

