import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
  Image,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  Alert,
  Share,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import {
  supabase,
  togglePinLike,
  toggleSavePin,
  checkPinLiked,
  reportPin,
  getComments,
  addComment,
  deleteComment,
  deletePin,
} from '@lib/supabase';
import { useTheme } from '../../context/ThemeContext';
import { DarkColors, Spacing, BorderRadius } from '@constants/theme';
import { Pin, PinComment } from '@/types/database';
import { PhotoCarousel } from '@components/ui/PhotoCarousel';

type C = typeof DarkColors;
const { width: SCREEN_W } = Dimensions.get('window');

type Comment = PinComment;

export default function PinDetailScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const router = useRouter();
  const { colors } = useTheme();
  const commentInputRef = useRef<TextInput>(null);
  const commentsEndRef = useRef<FlatList>(null);

  const [pin, setPin] = useState<Pin | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [isLiked, setIsLiked] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [sendingComment, setSendingComment] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      setUserId(data.user.id);
      const { data: prof } = await supabase
        .from('users').select('id').eq('auth_id', data.user.id).single();
      if (prof) setProfileId(prof.id);
    });
  }, []);

  useEffect(() => { if (id) loadPin(); }, [id]);

  useEffect(() => {
    if (!pin || !profileId) return;
    checkPinLiked(pin.id, profileId).then(setIsLiked);

    supabase
      .from('saved_pins')
      .select('pin_id')
      .eq('pin_id', pin.id)
      .eq('user_id', profileId)
      .single()
      .then(({ data }) => setIsSaved(!!data));

    loadComments();

    // Realtime: yeni yorum gelince ekle
    const channel = supabase
      .channel(`comments_${pin.id}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'pin_comments',
        filter: `pin_id=eq.${pin.id}`,
      }, (payload) => {
        const newRow = payload.new as any;
        // Kullanıcı adını ekle — kendi yorumuysa zaten listeye eklendi
        supabase
          .from('pin_comments')
          .select('*, user:users(id, username, avatar_url)')
          .eq('id', newRow.id)
          .single()
          .then(({ data }) => {
            if (data) {
              setComments((prev) => {
                if (prev.find((c) => c.id === data.id)) return prev;
                return [...prev, data as Comment];
              });
              setPin((p) => p ? { ...p, comment_count: p.comment_count + 1 } : p);
            }
          });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [pin?.id, profileId]);

  const loadPin = async () => {
    if (!id) { setLoadError('Geçersiz gönderi ID'); setLoading(false); return; }
    setLoading(true);
    setLoadError(null);
    try {
      const { data, error } = await supabase
        .from('pins')
        .select('*, user:users!user_id(id, username, avatar_url), location:locations(*)')
        .eq('id', id)
        .single();
      if (error) {
        setLoadError(error.message);
      } else if (!data) {
        setLoadError('Gönderi bulunamadı');
      } else {
        setPin(data);
        setLikeCount(data.like_count ?? 0);
      }
    } catch (e: any) {
      setLoadError(e?.message ?? 'Bilinmeyen hata');
    } finally {
      setLoading(false);
    }
  };

  const loadComments = async () => {
    if (!id) return;
    try {
      const data = await getComments(id);
      setComments(data as Comment[]);
    } catch {
      // Yorumlar yüklenemezse sessizce geç
    }
  };

  const handleLike = async () => {
    if (!profileId || !pin) return;
    const next = !isLiked;
    setIsLiked(next);
    setLikeCount((c) => c + (next ? 1 : -1));
    await togglePinLike(pin.id, profileId, next);
  };

  const handleSave = async () => {
    if (!profileId || !pin) return;
    const next = !isSaved;
    setIsSaved(next);
    await toggleSavePin(pin.id, profileId, next);
  };

  const handleShare = async () => {
    if (!pin) return;
    await Share.share({
      message: `FotoHarita'da bu yeri keşfettim: ${pin.location_name ?? pin.location?.name ?? 'Çekim noktası'}\nhttps://fotohrita.com/pin/${pin.id}`,
    });
  };

  const handleNavigate = () => {
    if (!pin?.location) return;
    Linking.openURL(
      `https://www.google.com/maps/dir/?api=1&destination=${pin.location.lat},${pin.location.lng}`
    );
  };

  const handleSendComment = async () => {
    if (!profileId || !commentText.trim() || !pin) return;
    setSendingComment(true);
    try {
      const newComment = await addComment(profileId, pin.id, commentText.trim());
      setComments((prev) => {
        if (prev.find((c) => c.id === newComment.id)) return prev;
        return [...prev, newComment as Comment];
      });
      setPin((p) => p ? { ...p, comment_count: p.comment_count + 1 } : p);
      setCommentText('');
      setTimeout(() => commentsEndRef.current?.scrollToEnd?.({ animated: true }), 100);
    } catch (err: any) {
      Alert.alert('Hata', err.message);
    } finally {
      setSendingComment(false);
    }
  };

  const handleDeleteComment = (commentId: string) => {
    if (!profileId) return;
    Alert.alert('Yorumu Sil', 'Bu yorumu silmek istiyor musun?', [
      { text: 'İptal', style: 'cancel' },
      {
        text: 'Sil', style: 'destructive', onPress: async () => {
          await deleteComment(commentId, profileId);
          setComments((prev) => prev.filter((c) => c.id !== commentId));
          setPin((p) => p ? { ...p, comment_count: Math.max((p.comment_count ?? 1) - 1, 0) } : p);
        },
      },
    ]);
  };

  const handleMenuPress = () => {
    if (!pin) return;
    const owner = pin.user_id === profileId;
    if (owner) {
      Alert.alert('Gönderi', undefined, [
        {
          text: 'Sil',
          style: 'destructive',
          onPress: () =>
            Alert.alert('Gönderini Sil', 'Bu gönderi kalıcı olarak silinecek. Emin misin?', [
              { text: 'İptal', style: 'cancel' },
              {
                text: 'Sil', style: 'destructive',
                onPress: async () => {
                  try {
                    await deletePin(pin.id, profileId!);
                    router.back();
                  } catch (err: any) {
                    Alert.alert('Hata', err.message);
                  }
                },
              },
            ]),
        },
        { text: 'İptal', style: 'cancel' },
      ]);
    } else {
      if (!profileId) return;
      Alert.alert('Şikayet Et', 'Bu içeriği neden şikayet ediyorsunuz?', [
        { text: 'Uygunsuz İçerik', onPress: () => reportPin(profileId, pin.id, 'inappropriate') },
        { text: 'Yanlış Konum', onPress: () => reportPin(profileId, pin.id, 'wrong_location') },
        { text: 'Spam', onPress: () => reportPin(profileId, pin.id, 'spam') },
        { text: 'İptal', style: 'cancel' },
      ]);
    }
  };

  const s = makeStyles(colors);

  if (loading) {
    return (
      <View style={s.loadingContainer}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (loadError || !pin) {
    return (
      <View style={s.loadingContainer}>
        <Feather name="alert-circle" size={32} color={colors.textMuted} />
        <Text style={{ color: colors.textMuted, marginTop: 12, fontSize: 14, textAlign: 'center', paddingHorizontal: 32 }}>
          {loadError ?? 'Gönderi yüklenemedi'}
        </Text>
        <TouchableOpacity
          onPress={() => loadPin()}
          style={{ marginTop: 16, paddingHorizontal: 24, paddingVertical: 10, backgroundColor: colors.primary, borderRadius: 20 }}
        >
          <Text style={{ color: colors.background, fontWeight: '700', fontSize: 14 }}>Tekrar Dene</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 10 }}>
          <Text style={{ color: colors.textMuted, fontSize: 13 }}>Geri Dön</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isOwner = pin.user_id === profileId;
  const displayName = pin.location_name || pin.location?.name || 'Çekim Noktası';
  const commentCount = pin.comment_count ?? comments.length;

  return (
    <KeyboardAvoidingView
      style={s.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Feather name="chevron-left" size={26} color={colors.text} />
        </TouchableOpacity>
        <Text style={s.headerTitle} numberOfLines={1}>{displayName}</Text>
        <TouchableOpacity onPress={handleMenuPress} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Feather name="more-horizontal" size={22} color={colors.textMuted} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={s.scroll}
        showsVerticalScrollIndicator={false}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
      >
        {/* Fotoğraf carousel */}
        <PhotoCarousel
          urls={pin.photo_urls?.length > 0 ? pin.photo_urls : [pin.photo_url]}
          width={SCREEN_W}
          aspectRatio={pin.aspect_ratio === '16:9' ? 9 / 16 : 3 / 4}
        />

        {/* Kullanıcı satırı */}
        <View style={s.userRow}>
          <TouchableOpacity
            style={s.userLeft}
            onPress={() => pin.user?.id && router.push(`/user/${pin.user.id}` as any)}
            activeOpacity={0.7}
          >
            <View style={[s.avatar, { backgroundColor: colors.primary }]}>
              <Text style={[s.avatarText, { color: colors.background }]}>
                {pin.user?.username?.[0]?.toUpperCase() ?? '?'}
              </Text>
            </View>
            <View>
              <Text style={s.username}>@{pin.user?.username}</Text>
              <Text style={s.date}>
                {new Date(pin.created_at).toLocaleDateString('tr-TR', {
                  day: 'numeric', month: 'long', year: 'numeric',
                })}
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Aksiyon çubuğu */}
        <View style={s.actions}>
          {/* Beğen */}
          <TouchableOpacity style={s.actionBtn} onPress={handleLike} activeOpacity={0.7}>
            <Feather
              name={isLiked ? 'heart' : 'heart'}
              size={26}
              color={isLiked ? colors.error : colors.textSecondary}
            />
            <Text style={[s.actionCount, isLiked && { color: colors.error }]}>{likeCount}</Text>
          </TouchableOpacity>

          {/* Yorum */}
          <TouchableOpacity
            style={s.actionBtn}
            onPress={() => commentInputRef.current?.focus()}
            activeOpacity={0.7}
          >
            <Feather name="message-circle" size={26} color={colors.textSecondary} />
            <Text style={s.actionCount}>{commentCount}</Text>
          </TouchableOpacity>

          {/* Kaydet */}
          <TouchableOpacity style={s.actionBtn} onPress={handleSave} activeOpacity={0.7}>
            <Feather
              name="bookmark"
              size={26}
              color={isSaved ? colors.primary : colors.textSecondary}
            />
          </TouchableOpacity>

          {/* Paylaş */}
          <TouchableOpacity style={s.actionBtn} onPress={handleShare} activeOpacity={0.7}>
            <Feather name="share-2" size={26} color={colors.textSecondary} />
          </TouchableOpacity>

          {/* Konuma git */}
          <TouchableOpacity style={s.actionBtn} onPress={handleNavigate} activeOpacity={0.7}>
            <Feather name="navigation" size={24} color={colors.primary} />
          </TouchableOpacity>
        </View>

        {/* Konum & açıklama */}
        <View style={s.meta}>
          {pin.location?.address && (
            <TouchableOpacity style={s.locationRow} onPress={handleNavigate}>
              <Feather name="map-pin" size={13} color={colors.textMuted} />
              <Text style={s.locationAddr} numberOfLines={1}>{pin.location.address}</Text>
            </TouchableOpacity>
          )}
          {pin.caption ? (
            <Text style={s.caption}>
              <Text style={s.captionUser}>@{pin.user?.username} </Text>
              {pin.caption}
            </Text>
          ) : null}
        </View>

        {/* Yorumlar başlığı */}
        <View style={s.commentsHeader}>
          <Text style={s.commentsTitle}>Yorumlar</Text>
          {comments.length > 0 && (
            <Text style={s.commentsCount}>{comments.length}</Text>
          )}
        </View>

        {/* Yorum listesi */}
        {comments.length === 0 ? (
          <View style={s.noComments}>
            <Text style={s.noCommentsText}>Henüz yorum yok. İlk yorumu sen yap!</Text>
          </View>
        ) : (
          comments.map((comment) => (
            <CommentRow
              key={comment.id}
              comment={comment}
              isOwn={comment.user?.id === profileId}
              onDelete={() => handleDeleteComment(comment.id)}
              colors={colors}
            />
          ))
        )}

        <View style={{ height: Spacing.xl * 2 }} />
      </ScrollView>

      {/* Yorum girişi */}
      <View style={[s.commentBar, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
        <View style={[s.commentInputWrap, { backgroundColor: colors.background, borderColor: colors.border }]}>
          <TextInput
            ref={commentInputRef}
            style={[s.commentInput, { color: colors.text }]}
            placeholder="Yorum yaz..."
            placeholderTextColor={colors.textMuted}
            value={commentText}
            onChangeText={setCommentText}
            maxLength={300}
            multiline
            returnKeyType="send"
            blurOnSubmit
            onSubmitEditing={handleSendComment}
          />
        </View>
        <TouchableOpacity
          style={[
            s.sendBtn,
            { backgroundColor: commentText.trim() ? colors.primary : colors.border },
          ]}
          onPress={handleSendComment}
          disabled={!commentText.trim() || sendingComment}
          activeOpacity={0.8}
        >
          {sendingComment
            ? <ActivityIndicator size="small" color={colors.background} />
            : <Feather name="send" size={16} color={colors.background} />
          }
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

function CommentRow({
  comment,
  isOwn,
  onDelete,
  colors,
}: {
  comment: Comment;
  isOwn: boolean;
  onDelete: () => void;
  colors: C;
}) {
  return (
    <View style={[commentStyles.row, { borderBottomColor: colors.border + '60' }]}>
      <View style={[commentStyles.avatar, { backgroundColor: colors.primary + '33' }]}>
        <Text style={[commentStyles.avatarText, { color: colors.primary }]}>
          {comment.user?.username?.[0]?.toUpperCase() ?? '?'}
        </Text>
      </View>
      <View style={commentStyles.body}>
        <View style={commentStyles.topRow}>
          <Text style={[commentStyles.username, { color: colors.text }]}>
            @{comment.user?.username}
          </Text>
          <Text style={[commentStyles.time, { color: colors.textMuted }]}>
            {new Date(comment.created_at).toLocaleDateString('tr-TR', {
              day: 'numeric', month: 'short',
            })}
          </Text>
        </View>
        <Text style={[commentStyles.content, { color: colors.textSecondary }]}>
          {comment.content}
        </Text>
      </View>
      {isOwn && (
        <TouchableOpacity onPress={onDelete} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Feather name="trash-2" size={14} color={colors.error} />
        </TouchableOpacity>
      )}
    </View>
  );
}

const commentStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
    borderBottomWidth: 0.5,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  avatarText: { fontSize: 13, fontWeight: '700' },
  body: { flex: 1, gap: 3 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  username: { fontSize: 13, fontWeight: '700' },
  time: { fontSize: 11 },
  content: { fontSize: 14, lineHeight: 20 },
});

function makeStyles(c: C) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: c.background },
    loadingContainer: {
      flex: 1, alignItems: 'center', justifyContent: 'center',
      backgroundColor: c.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: Spacing.md,
      paddingTop: 56,
      paddingBottom: Spacing.md,
      backgroundColor: c.surface,
      borderBottomWidth: 0.5,
      borderBottomColor: c.border,
      gap: Spacing.sm,
    },
    headerTitle: {
      flex: 1,
      fontSize: 16,
      fontWeight: '700',
      color: c.text,
      letterSpacing: -0.3,
    },
    scroll: { flex: 1 },
    userRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.sm,
    },
    userLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
    },
    avatar: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarText: { fontSize: 14, fontWeight: '700' },
    username: { fontSize: 14, fontWeight: '700', color: c.text },
    date: { fontSize: 11, color: c.textMuted, marginTop: 1 },
    actions: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: Spacing.lg,
      paddingBottom: Spacing.sm,
      gap: Spacing.md,
    },
    actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    actionCount: { fontSize: 14, fontWeight: '600', color: c.textSecondary },
    meta: {
      paddingHorizontal: Spacing.lg,
      paddingBottom: Spacing.md,
      gap: Spacing.xs,
    },
    locationRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    locationAddr: {
      fontSize: 12,
      color: c.textMuted,
      flex: 1,
    },
    caption: {
      fontSize: 14,
      color: c.textSecondary,
      lineHeight: 20,
    },
    captionUser: {
      fontWeight: '700',
      color: c.text,
    },
    commentsHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.sm,
      borderTopWidth: 0.5,
      borderTopColor: c.border,
    },
    commentsTitle: { fontSize: 14, fontWeight: '700', color: c.text },
    commentsCount: {
      fontSize: 12,
      fontWeight: '600',
      color: c.background,
      backgroundColor: c.primary,
      borderRadius: BorderRadius.full,
      paddingHorizontal: 7,
      paddingVertical: 2,
      overflow: 'hidden',
    },
    noComments: {
      padding: Spacing.xl,
      alignItems: 'center',
    },
    noCommentsText: {
      fontSize: 13,
      color: c.textMuted,
      textAlign: 'center',
    },
    commentBar: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      borderTopWidth: 0.5,
      gap: Spacing.sm,
    },
    commentInputWrap: {
      flex: 1,
      borderRadius: BorderRadius.full,
      borderWidth: 1,
      paddingHorizontal: Spacing.md,
      paddingVertical: Platform.OS === 'ios' ? 10 : 6,
      maxHeight: 100,
    },
    commentInput: {
      fontSize: 14,
      lineHeight: 20,
    },
    sendBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
}
