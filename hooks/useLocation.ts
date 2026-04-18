import { useState, useEffect } from 'react';
import * as Location from 'expo-location';

interface LocationState {
  lat: number | null;
  lng: number | null;
  permissionGranted: boolean | null;
  loading: boolean;
  error: string | null;
}

export function useLocation() {
  const [state, setState] = useState<LocationState>({
    lat: null,
    lng: null,
    permissionGranted: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let subscriber: Location.LocationSubscription | null = null;

    (async () => {
      let { status } = await Location.getForegroundPermissionsAsync();

      if (status === 'undetermined') {
        const { status: requested } = await Location.requestForegroundPermissionsAsync();
        status = requested;
      }

      if (status !== 'granted') {
        setState((s) => ({ ...s, permissionGranted: false, loading: false }));
        return;
      }

      setState((s) => ({ ...s, permissionGranted: true }));

      try {
        // İlk konum
        const position = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        setState((s) => ({
          ...s,
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          loading: false,
        }));

        // Konum değişikliklerini izle
        subscriber = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.Balanced, distanceInterval: 50 },
          (loc) => {
            setState((s) => ({
              ...s,
              lat: loc.coords.latitude,
              lng: loc.coords.longitude,
            }));
          }
        );
      } catch (err) {
        setState((s) => ({
          ...s,
          error: 'Konum alınamadı.',
          loading: false,
        }));
      }
    })();

    return () => {
      subscriber?.remove();
    };
  }, []);

  const requestPermission = async (): Promise<boolean> => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    const granted = status === 'granted';
    setState((s) => ({ ...s, permissionGranted: granted }));
    return granted;
  };

  return { ...state, requestPermission };
}
