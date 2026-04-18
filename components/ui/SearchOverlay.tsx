import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Image,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { supabase } from '@lib/supabase';
import { BorderRadius, Spacing } from '@constants/theme';

interface UserResult {
  id: string;
  username: string;
  avatar_url: string | null;
}

interface PlaceResult {
  id: string;
  name: string;
  category: string;
  lat: number;
  lng: number;
}

interface SearchResult {
  type: 'user' | 'place';
  id: string;
  title: string;
  subtitle?: string;
  avatar_url?: string | null;
  lat?: number;
  lng?: number;
}

interface Props {
  colors: any;
  placeholder?: string;
  onSelectUser: (userId: string, username: string) => void;
  onSelectPlace: (placeId: string, name: string, lat: number, lng: number) => void;
  style?: any;
}

export function SearchOverlay({ colors, placeholder = 'Kullanıcı veya mekan ara...', onSelectUser, onSelectPlace, style }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback(async (text: string) => {
    if (text.trim().length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const pattern = `%${text.trim()}%`;
      const [{ data: users }, { data: places }] = await Promise.all([
        supabase
          .from('users')
          .select('id, username, avatar_url')
          .ilike('username', pattern)
          .limit(4),
        supabase
          .from('locations')
          .select('id, name, category, lat, lng')
          .ilike('name', pattern)
          .limit(4),
      ]);

      const combined: SearchResult[] = [
        ...((users ?? []) as UserResult[]).map((u) => ({
          type: 'user' as const,
          id: u.id,
          title: `@${u.username}`,
          avatar_url: u.avatar_url,
        })),
        ...((places ?? []) as PlaceResult[]).map((p) => ({
          type: 'place' as const,
          id: p.id,
          title: p.name,
          subtitle: p.category,
          lat: p.lat,
          lng: p.lng,
        })),
      ];
      setResults(combined);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleChange = (text: string) => {
    setQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(text), 280);
  };

  const handleSelect = (item: SearchResult) => {
    if (item.type === 'user') {
      onSelectUser(item.id, item.title);
    } else {
      onSelectPlace(item.id, item.title, item.lat!, item.lng!);
    }
    setQuery('');
    setResults([]);
    setFocused(false);
  };

  const showDropdown = focused && (results.length > 0 || (loading && query.length >= 2));

  return (
    <View style={[styles.wrapper, style]}>
      <View style={[styles.bar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Feather name="search" size={15} color={colors.textMuted} />
        <TextInput
          style={[styles.input, { color: colors.text }]}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          value={query}
          onChangeText={handleChange}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          returnKeyType="search"
          autoCorrect={false}
          autoCapitalize="none"
        />
        {query.length > 0 && (
          loading
            ? <ActivityIndicator size="small" color={colors.textMuted} />
            : (
              <TouchableOpacity onPress={() => { setQuery(''); setResults([]); }}>
                <Feather name="x" size={15} color={colors.textMuted} />
              </TouchableOpacity>
            )
        )}
      </View>

      {showDropdown && (
        <View style={[styles.dropdown, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <FlatList
            data={results}
            keyExtractor={(item) => `${item.type}-${item.id}`}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.row, { borderBottomColor: colors.border }]}
                onPress={() => handleSelect(item)}
                activeOpacity={0.7}
              >
                {item.type === 'user' ? (
                  <View style={[styles.avatar, { backgroundColor: colors.primary + '22' }]}>
                    {item.avatar_url
                      ? <Image source={{ uri: item.avatar_url }} style={styles.avatarImg} />
                      : <Feather name="user" size={14} color={colors.primary} />}
                  </View>
                ) : (
                  <View style={[styles.avatar, { backgroundColor: colors.surfaceElevated }]}>
                    <Feather name="map-pin" size={14} color={colors.textMuted} />
                  </View>
                )}
                <View style={styles.rowText}>
                  <Text style={[styles.rowTitle, { color: colors.text }]} numberOfLines={1}>
                    {item.title}
                  </Text>
                  {item.subtitle && (
                    <Text style={[styles.rowSub, { color: colors.textMuted }]} numberOfLines={1}>
                      {item.subtitle}
                    </Text>
                  )}
                </View>
                <Feather name="chevron-right" size={14} color={colors.textMuted} />
              </TouchableOpacity>
            )}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { zIndex: 50 },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
  },
  input: { flex: 1, fontSize: 14 },
  dropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    marginTop: 4,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    overflow: 'hidden',
    elevation: 12,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: 11,
    borderBottomWidth: 0.5,
    gap: Spacing.sm,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImg: { width: '100%', height: '100%' },
  rowText: { flex: 1 },
  rowTitle: { fontSize: 14, fontWeight: '600' },
  rowSub: { fontSize: 12, marginTop: 1 },
});
