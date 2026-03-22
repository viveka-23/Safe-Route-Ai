import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useAuth } from '../context/AuthContext';
import AuthScreen from '../screens/AuthScreen';
import SearchScreen from '../screens/SearchScreen';
import MapScreen from '../screens/MapScreen';
import MyIncidentsScreen from '../screens/MyIncidentsScreen';
import { ActivityIndicator, View, Text } from 'react-native';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const SearchMapStack = () => (
  <Stack.Navigator
    screenOptions={{
      headerShown: false,
    }}
  >
    <Stack.Screen name="SearchHome" component={SearchScreen} />
    <Stack.Screen name="MapHome" component={MapScreen} />
  </Stack.Navigator>
);

const IncidentsStack = () => (
  <Stack.Navigator
    screenOptions={{
      headerShown: true,
      headerTitle: 'My Reports',
      headerTitleStyle: {
        fontWeight: '600',
        fontSize: 18,
      },
    }}
  >
    <Stack.Screen name="MyIncidentsHome" component={MyIncidentsScreen} />
  </Stack.Navigator>
);

const HomeTabs = () => {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#007AFF',
        tabBarInactiveTintColor: '#999',
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '500',
        },
        tabBarStyle: {
          borderTopWidth: 1,
          borderTopColor: '#e0e0e0',
          paddingBottom: 4,
        },
      }}
    >
      <Tab.Screen
        name="Routes"
        component={SearchMapStack}
        options={{
          tabBarLabel: 'Routes',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>🛤️</Text>,
        }}
      />
      <Tab.Screen
        name="MyIncidents"
        component={IncidentsStack}
        options={{
          tabBarLabel: 'My Reports',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>📋</Text>,
        }}
      />
    </Tab.Navigator>
  );
};

export const RootNavigator = () => {
  const { isSignedIn, bootstrapAsync, loading } = useAuth();

  useEffect(() => {
    bootstrapAsync();
  }, []);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
        }}
      >
        {!isSignedIn ? (
          <Stack.Screen
            name="Auth"
            component={AuthScreen}
            options={{
              animationEnabled: true,
            }}
          />
        ) : (
          <Stack.Screen
            name="Home"
            component={HomeTabs}
            options={{
              animationEnabled: true,
            }}
          />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default RootNavigator;
