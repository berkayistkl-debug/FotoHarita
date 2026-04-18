import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { supabase, getNotifications, markNotificationsRead } from '@lib/supabase';
import { useTheme } from '../../context/ThemeContext';
import { DarkColors, Spacing, BorderRadius } from '@constants/theme';

type C = typeof DarkColors;

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  read: boolean;
  created_at: string;
}

type FeatherName = React.ComponentProps<typeof Feather>['name'];

const NOTIFICATION_ICONS: Record<string, FeatherName> = {
  nearby_pin: 'map-pin',
  coin_earned: 'award',
  badge_awarded: 'star',
  like_milestone: 'heart',
};

export default function NotificationsScreen() {
  const { colors } = useTheme();
  const s = makeStyles(colors);

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;

      const { data: profile } = await supabase
        .from('users')
        .select('id')
        .eq('auth_id', data.user.id)
        .single();

      if (profile) {
        setUserId(profile.id);
        load(profile.id);

        // Gerçek zamanlı yeni bildirim aboneliği
        const channel = supabase
          .channel(`notifs_${profile.id}`)
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'notifications',
              filter: `user_id=eq.${profile.id}`,
            },
            (payload) => {
              setNotifications((prev) => [payload.new as Notification, ...prev]);
            }
          )
          .subscribe();

        return () => { supabase.removeChannel(channel); };
      }
    });
  }, []);

  const load = async (uid: string) => {
    const data = await getNotifications(uid);
    setNotifications(data);
    await markNotificationsRead(uid);
  };

  const onRefresh = async () => {
    if (!userId) return;
    setRefreshing(true);
    await load(userId);
    setRefreshing(false);
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Text style={s.title}>Bildirimler</Text>
        {unreadCount > 0 && (
          <View style={s.badge}>
            <Text style={s.badgeText}>{unreadCount}</Text>
          </View>
        )}
      </View>

      {notifications.length === 0 ? (
        <View style={s.empty}>
          <Feather name="bell-off" size={48} color={colors.textMuted} />
          <Text style={s.emptyText}>Henüz bildirim yok</Text>
          <Text style={s.emptySubtext}>
            Yakınında yeni pin eklendiğinde ve coin kazandığında burada göreceğiz.
          </Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          ItemSeparatorComponent={() => <View style={s.separator} />}
          renderItem={({ item }) => (
            <TouchableOpacity style={[s.item, !item.read && s.itemUnread]} activeOpacity={0.7}>
              <View style={[s.iconCircle, { backgroundColor: colors.primary + '18' }]}>
                <Feather
                  name={NOTIFICATION_ICONS[item.type] ?? 'mail'}
                  size={18}
                  color={colors.primary}
                />
              </View>
              <View style={s.itemContent}>
                <Text style={s.itemTitle}>{item.title}</Text>
                <Text style={s.itemBody}>{item.body}</Text>
                <Text style={s.itemTime}>
                  {new Date(item.created_at).toLocaleDateString('tr-TR', {
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </Text>
              </View>
              {!item.read && <View style={s.unreadDot} />}
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

function makeStyles(c: C) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: Spacing.lg,
      paddingTop: 60,
      gap: Spacing.sm,
      backgroundColor: c.surface,
      borderBottomWidth: 0.5,
      borderBottomColor: c.border,
    },
    title: { fontSize: 24, fontWeight: '700', color: c.text, letterSpacing: -0.5, flex: 1 },
    badge: {
      backgroundColor: c.primary,
      borderRadius: BorderRadius.full,
      minWidth: 22,
      height: 22,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 6,
    },
    badgeText: { fontSize: 12, fontWeight: '700', color: c.background },
    empty: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: Spacing.xl,
      gap: Spacing.md,
    },
    emptyText: { fontSize: 17, fontWeight: '700', color: c.text, textAlign: 'center' },
    emptySubtext: { fontSize: 14, color: c.textSecondary, textAlign: 'center', lineHeight: 20 },
    item: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      padding: Spacing.md,
      paddingHorizontal: Spacing.lg,
      gap: Spacing.md,
      backgroundColor: c.background,
    },
    itemUnread: { backgroundColor: c.surface },
    iconCircle: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 2,
    },
    itemContent: { flex: 1, gap: 2 },
    itemTitle: { fontSize: 14, fontWeight: '600', color: c.text },
    itemBody: { fontSize: 13, color: c.textSecondary, lineHeight: 18 },
    itemTime: { fontSize: 11, color: c.textMuted, marginTop: 4 },
    unreadDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: c.primary,
      marginTop: 6,
    },
    separator: { height: 0.5, backgroundColor: c.border },
  });
}
