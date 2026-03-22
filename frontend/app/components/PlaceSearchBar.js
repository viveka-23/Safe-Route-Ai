import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  FlatList,
  Text,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import axios from 'axios';

// Popular locations for Hyderabad and nearby areas
const POPULAR_LOCATIONS = [
  { name: 'Hyderabad, India', lat: 17.3850, lng: 78.4867, category: '🏙️ City' },
  { name: 'Secunderabad, India', lat: 17.3600, lng: 78.5031, category: '🏙️ City' },
  { name: 'HITEC City, Hyderabad', lat: 17.4409, lng: 78.4419, category: '💼 Tech Hub' },
  { name: 'Banjara Hills, Hyderabad', lat: 17.3965, lng: 78.4735, category: '🏢 Area' },
  { name: 'Jubilee Hills, Hyderabad', lat: 17.4053, lng: 78.4573, category: '🏢 Area' },
  { name: 'Kondapur, Hyderabad', lat: 17.4539, lng: 78.3576, category: '🏢 Area' },
  { name: 'Ameerpet, Hyderabad', lat: 17.3784, lng: 78.4701, category: '🏢 Area' },
  { name: 'Kukatpally, Hyderabad', lat: 17.4629, lng: 78.4263, category: '🏢 Area' },
  { name: 'Gachibowli, Hyderabad', lat: 17.4406, lng: 78.3833, category: '🏢 Area' },
  { name: 'Manikonda, Hyderabad', lat: 17.3841, lng: 78.3528, category: '🏢 Area' },
];

const PlaceSearchBar = ({ onPlaceSelected, placeholder = 'Search location', isOverlay = false }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [error, setError] = useState(null);
  const searchTimeoutRef = useRef(null);
  const cacheRef = useRef({}); // Cache for search results
  const lastSearchTimeRef = useRef(0); // Track last search time for rate limiting
  const cooldownRef = useRef(0); // When set, avoid API calls until this timestamp
  const COOLDOWN_MS = 60 * 1000; // 1 minute cooldown after receiving 509

  // Filter popular locations from search
  const getPopularMatches = (text) => {
    if (text.length < 2) return [];
    const lowerText = text.toLowerCase();
    return POPULAR_LOCATIONS.filter(loc =>
      loc.name.toLowerCase().includes(lowerText)
    );
  };

  const handleSearch = async (text) => {
    setSearchQuery(text);
    setError(null);

    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (text.length < 2) {
      setResults([]);
      setShowResults(false);
      return;
    }

    // Check cache first
    if (cacheRef.current[text]) {
      console.log('📦 Using cached results for:', text);
      const cachedResults = cacheRef.current[text];
      setResults(cachedResults);
      setShowResults(cachedResults.length > 0);
      return;
    }

    // Show popular matches immediately
    const popularMatches = getPopularMatches(text);
    if (popularMatches.length > 0) {
      setResults(popularMatches);
      setShowResults(true);
      console.log('⭐ Showing popular locations:', popularMatches.length);
    }

    // Debounce API search - wait 1200ms before searching (increased from 800ms)
    searchTimeoutRef.current = setTimeout(async () => {
      // Rate limiting: wait at least 2 seconds between API calls (increased from 1s)
      const now = Date.now();
      const timeSinceLastSearch = now - lastSearchTimeRef.current;
      if (timeSinceLastSearch < 2000) {
        console.log('⏳ Rate limiting: waiting', 2000 - timeSinceLastSearch, 'ms');
        setTimeout(() => performSearch(text), 2000 - timeSinceLastSearch);
        return;
      }

      performSearch(text);
    }, 1200);
  };

  const performSearch = async (text, retryCount = 0) => {
    setLoading(true);
    // If we're in a cooldown window due to recent 509 responses, skip the API call
    if (Date.now() < cooldownRef.current) {
      console.log('⏸️ Search skipped due to recent rate-limit. Cooldown active.');
      setError('Search temporarily paused due to service limits. Showing popular locations.');
      const popularMatches = getPopularMatches(text);
      if (popularMatches.length > 0) {
        setResults(popularMatches);
        setShowResults(true);
      } else {
        setResults([]);
        setShowResults(false);
      }
      setLoading(false);
      return;
    }
    try {
      const NOMINATIM_API = 'https://nominatim.openstreetmap.org/search';
      console.log('🔍 API Search for:', text, `(Attempt ${retryCount + 1})`);
      
      const response = await axios.get(NOMINATIM_API, {
        params: {
          q: text,
          format: 'json',
          limit: 5,
          addressdetails: 1,
        },
        timeout: 10000,
        headers: {
          'User-Agent': 'SafeRoute-AI-Mobile/1.0',
        },
      });

      lastSearchTimeRef.current = Date.now();
      console.log('✅ API results:', response.data.length);
      
      // Combine API results with popular matches
      const apiResults = response.data.map(item => ({
        ...item,
        display_name: item.display_name || item.name,
      }));
      
      const combinedResults = [...apiResults];
      
      // Cache the results
      cacheRef.current[text] = combinedResults;
      
      setResults(combinedResults);
      setShowResults(combinedResults.length > 0);
      setError(null);
      setLoading(false);
    } catch (error) {
      console.error('❌ API search error:', error.message, 'Status:', error.response?.status);

      // If we receive a 509 (bandwidth/rate limit), set a cooldown and provide a fallback
      if (error.response?.status === 509) {
        cooldownRef.current = Date.now() + COOLDOWN_MS;
        console.log('⚠️ Received 509 from API. Entering cooldown for', COOLDOWN_MS, 'ms');
        setError('Search service temporarily overloaded. Showing popular locations.');
        const popularMatches = getPopularMatches(text);
        if (popularMatches.length > 0) {
          setResults(popularMatches);
          setShowResults(true);
        } else {
          setResults([]);
          setShowResults(false);
        }
        setLoading(false);
        return;
      }

      // For connection timeouts, network errors and other failures show helpful messages
      if (error.code === 'ECONNABORTED') {
        setError('Search took too long. Try a shorter or more specific query.');
      } else if (error.message === 'Network Error' || !error.response) {
        setError('Network error. Check your connection and try again.');
      } else {
        setError('Search failed. Showing popular locations instead.');
      }

      const popularMatches = getPopularMatches(text);
      if (popularMatches.length > 0) {
        setResults(popularMatches);
        setShowResults(true);
      } else {
        setResults([]);
        setShowResults(false);
      }

      setLoading(false);
    }
  };

  const selectPlace = (place) => {
    const displayName = place.display_name || place.name || '';
    const lat = parseFloat(place.lat);
    const lng = parseFloat(place.lng || place.lon); // Handle both 'lng' and 'lon'
    
    console.log('📍 Place selected:', displayName, `(${lat.toFixed(4)}, ${lng.toFixed(4)})`);
    onPlaceSelected({
      lat,
      lng,
      name: displayName,
    });
    setSearchQuery(displayName);
    setShowResults(false);
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  return (
    <View style={styles.container}>
      <View style={[styles.searchContainer, !isOverlay && styles.searchContainerEmbedded]}>
        <TextInput
          style={styles.searchInput}
          placeholder={placeholder}
          value={searchQuery}
          onChangeText={handleSearch}
          placeholderTextColor="#888"
        />
        {loading && <ActivityIndicator color="#007AFF" size="small" />}
      </View>

      {error && (
        <View style={[styles.errorBox, !isOverlay && styles.errorBoxEmbedded]}>
          <Text style={styles.errorText}>⚠️ {error}</Text>
        </View>
      )}

      {showResults && results.length > 0 && (
        <FlatList
          data={results}
          keyExtractor={(item, index) => `${item.lat}-${item.lng || item.lon}-${index}`}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.resultItem, item.category && styles.resultItemPopular]}
              onPress={() => selectPlace(item)}
            >
              <View style={styles.resultItemContent}>
                <Text style={styles.resultText} numberOfLines={1}>
                  {item.display_name || item.name}
                </Text>
                {item.category && (
                  <Text style={styles.resultCategory}>{item.category}</Text>
                )}
              </View>
              {item.category && <Text style={styles.starIcon}>⭐</Text>}
            </TouchableOpacity>
          )}
          style={[styles.resultsList, !isOverlay && styles.resultsListEmbedded]}
          scrollEnabled={false}
          nestedScrollEnabled={false}
        />
      )}

      {searchQuery.length >= 2 && showResults && results.length === 0 && !loading && !error && (
        <View style={[styles.noResultsBox, !isOverlay && styles.noResultsBoxEmbedded]}>
          <Text style={styles.noResultsText}>No locations found for "{searchQuery}"</Text>
          <Text style={styles.noResultsHint}>Try a different search term</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    zIndex: 100,
  },
  searchContainer: {
    position: 'absolute',
    top: 50,
    left: 15,
    right: 15,
    zIndex: 10,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 20,
    padding: 5,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },
  searchContainerEmbedded: {
    position: 'relative',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 2,
    marginBottom: 8,
  },
  searchInput: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 15,
    fontSize: 16,
    flex: 1,
    elevation: 5,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    color: '#333',
  },
  errorBox: {
    position: 'absolute',
    top: 110,
    left: 15,
    right: 15,
    backgroundColor: '#FFE5E5',
    borderRadius: 8,
    padding: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#FF6B6B',
    zIndex: 5,
  },
  errorBoxEmbedded: {
    position: 'relative',
    top: 0,
    left: 0,
    right: 0,
    marginBottom: 8,
  },
  errorText: {
    color: '#C92A2A',
    fontSize: 12,
    fontWeight: '500',
  },
  resultsList: {
    backgroundColor: '#fff',
    borderRadius: 8,
    marginTop: 8,
    maxHeight: 200,
  },
  resultsListEmbedded: {
    marginTop: 0,
    maxHeight: 150,
  },
  resultItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  resultItemPopular: {
    backgroundColor: '#FFF9E6',
  },
  resultItemContent: {
    flex: 1,
  },
  resultText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  resultCategory: {
    fontSize: 11,
    color: '#999',
    marginTop: 2,
  },
  starIcon: {
    fontSize: 12,
    marginLeft: 8,
  },
  noResultsBox: {
    position: 'absolute',
    top: 110,
    left: 15,
    right: 15,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 15,
    borderWidth: 1,
    borderColor: '#ddd',
    zIndex: 5,
  },
  noResultsBoxEmbedded: {
    position: 'relative',
    top: 0,
    left: 0,
    right: 0,
  },
  noResultsText: {
    color: '#666',
    fontSize: 14,
    fontWeight: '500',
  },
  noResultsHint: {
    color: '#999',
    fontSize: 12,
    marginTop: 4,
  },
});

export default PlaceSearchBar;
