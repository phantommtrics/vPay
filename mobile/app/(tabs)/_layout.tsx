import { Redirect, Tabs } from 'expo-router';
import {
  CreditCard,
  Home,
  Receipt,
  User,
  Wallet,
} from 'lucide-react-native';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { useAuth } from '@/contexts/AuthContext';
import { colors } from '@/constants/theme';

export default function TabLayout() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.emerald600} />
      </View>
    );
  }

  if (!user) {
    return <Redirect href="/onboarding" />;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.emerald600,
        tabBarInactiveTintColor: colors.gray400,
        tabBarStyle: styles.tabBar,
        tabBarLabelStyle: styles.tabBarLabel,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon icon={Home} color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="cards"
        options={{
          title: 'Cards',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon icon={CreditCard} color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="fund"
        options={{
          title: 'Wallet',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon icon={Wallet} color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="transactions"
        options={{
          title: 'History',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon icon={Receipt} color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon icon={User} color={color} focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}

function TabIcon({
  icon: Icon,
  color,
  focused,
}: {
  icon: typeof Home;
  color: string;
  focused: boolean;
}) {
  return (
    <View style={styles.iconWrap}>
      {focused && <View style={styles.indicator} />}
      <Icon size={24} color={color} strokeWidth={focused ? 2.5 : 2} />
    </View>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.gray50,
  },
  tabBar: {
    backgroundColor: colors.white,
    borderTopColor: colors.gray100,
    borderTopWidth: 1,
    paddingTop: 8,
    height: 88,
  },
  tabBarLabel: {
    fontSize: 10,
    fontFamily: 'Inter_500Medium',
    marginTop: 2,
  },
  iconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 64,
    height: 32,
  },
  indicator: {
    position: 'absolute',
    top: -8,
    width: 32,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.emerald600,
  },
});
