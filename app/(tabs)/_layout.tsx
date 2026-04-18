import React, { useEffect, useState } from 'react';
import { Tabs, useSegments } from 'expo-router';
import { View, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { supabase } from '@lib/supabase';

function TabIcon({
  name,
  focused,
  primaryColor,
  mutedColor,
  badge,
}: {
  name: React.ComponentProps<typeof Feather>['name'];
  focused: boolean;
  primaryColor: string;
  mutedColor: string;
  badge?: number;
}) {
  return (
    <View style={[styles.iconWrap, focused && { backgroundColor: primaryColor + '1a' }]}>
      <Feather name={name} size={21} color={focused ? primaryColor : mutedColor} />
      {badge && badge > 0 ? (
        <View style={[styles.badge, { backgroundColor: primaryColor }]}>
          <Text style={[styles.badgeText, { color: '#080808' }]}>
            {badge > 99 ? '99+' : badge}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function UploadIcon({ bgColor, iconColor }: { bgColor: string; iconColor: string }) {
  return (
    <View style={[styles.uploadBtn, { backgroundColor: bgColor, shadowColor: bgColor }]}>
      <Feather name="camera" size={20} color={iconColor} />
    </View>
  );
}

export default function TabsLayout() {
  const { colors } = useTheme();
  const segments = useSegments();
  const [unreadCount, setUnreadCount] = useState(0);
  const [profileId, setProfileId] = useState<string | null>(null);

  // Profil id'sini al ve okunmamış bildirim sayısını yükle
  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      const { data: prof } = await supabase
        .from('users').select('id').eq('auth_id', data.user.id).single();
      if (!prof) return;
      setProfileId(prof.id);

      const { count } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', prof.id)
        .eq('read', false);
      setUnreadCount(count ?? 0);

      // Realtime yeni bildirim gelince sayacı artır
      const channel = supabase
        .channel(`badge_${prof.id}`)
        .on('postgres_changes', {
          event: 'INSERT', schema: 'public', table: 'notifications',
          filter: `user_id=eq.${prof.id}`,
        }, () => {
          setUnreadCount((n) => n + 1);
        })
        .subscribe();

      return () => { supabase.removeChannel(channel); };
    });
  }, []);

  // Notifications sekmesine girilince rozeti sıfırla
  useEffect(() => {
    if (segments[segments.length - 1] === 'notifications') {
      setUnreadCount(0);
    }
  }, [segments]);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: 0.5,
          height: 72,
          paddingBottom: 8,
          paddingTop: 6,
          elevation: 0,
        },
        tabBarShowLabel: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon name="map" focused={focused} primaryColor={colors.primary} mutedColor={colors.textMuted} />
          ),
        }}
      />
      <Tabs.Screen
        name="discover"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon name="compass" focused={focused} primaryColor={colors.primary} mutedColor={colors.textMuted} />
          ),
        }}
      />
      <Tabs.Screen
        name="upload"
        options={{
          tabBarIcon: () => (
            <UploadIcon bgColor={colors.primary} iconColor={colors.background} />
          ),
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon
              name="bell"
              focused={focused}
              primaryColor={colors.primary}
              mutedColor={colors.textMuted}
              badge={unreadCount}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon name="user" focused={focused} primaryColor={colors.primary} mutedColor={colors.textMuted} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconWrap: {
    width: 40,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: 0,
    right: 0,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: { fontSize: 9, fontWeight: '800' },
  uploadBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
});
