import { Tabs } from 'expo-router';
import { SymbolView } from 'expo-symbols';

import { colors } from '../../constants/theme';
import { FeedProvider } from '../../providers/FeedProvider';

export default function TabLayout() {
  return (
    <FeedProvider>
      <Tabs
        screenOptions={{
          headerShown: false,

          tabBarActiveTintColor: colors.textPrimary,
          tabBarInactiveTintColor: colors.textMuted,

          tabBarStyle: {
            backgroundColor: colors.surface,
            borderTopColor: colors.borderSubtle,
            borderTopWidth: 1,
            height: 68,
            paddingTop: 7,
            paddingBottom: 7,
          },

          tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: '500',
          },

          tabBarHideOnKeyboard: true,
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Home',
            tabBarIcon: ({ color, focused }) => (
              <SymbolView
                name={{
                  ios: focused ? 'house.fill' : 'house',
                  android: 'home',
                  web: 'home',
                }}
                tintColor={color}
                size={22}
              />
            ),
          }}
        />

        <Tabs.Screen
          name="explore"
          options={{
            title: 'Explore',
            tabBarIcon: ({ color, focused }) => (
              <SymbolView
                name={{
                  ios: focused ? 'magnifyingglass.circle.fill' : 'magnifyingglass',
                  android: 'search',
                  web: 'search',
                }}
                tintColor={color}
                size={22}
              />
            ),
          }}
        />

        <Tabs.Screen
          name="create"
          options={{
            title: 'Create',
            tabBarIcon: ({ color, focused }) => (
              <SymbolView
                name={{
                  ios: focused ? 'plus.circle.fill' : 'plus.circle',
                  android: 'add_circle',
                  web: 'add_circle',
                }}
                tintColor={color}
                size={24}
              />
            ),
          }}
        />

        <Tabs.Screen
          name="profile"
          options={{
            title: 'Profile',
            tabBarIcon: ({ color, focused }) => (
              <SymbolView
                name={{
                  ios: focused ? 'person.fill' : 'person',
                  android: 'person',
                  web: 'person',
                }}
                tintColor={color}
                size={22}
              />
            ),
          }}
        />
      </Tabs>
    </FeedProvider>
  );
}
