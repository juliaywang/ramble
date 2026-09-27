import { distanceMiles, type LatLng } from "../pipeline/geo";

export const QUEST_RADIUS_FEET = 200;
export const QUEST_RADIUS_METERS = QUEST_RADIUS_FEET * 0.3048;

export function validateQuestLocation(position: GeolocationPosition, destination: LatLng) {
  const { latitude: lat, longitude: lng } = position.coords;
  if (![lat, lng, destination.lat, destination.lng].every(Number.isFinite) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    throw new Error("Could not determine your coordinates. Please check your device location settings.");
  }
  if (!Number.isFinite(position.timestamp) || Date.now() - position.timestamp > 120000) {
    throw new Error("The displayed location is out of date. Your device has not sent a fresh reading. Refresh location, then try again.");
  }
  const feet = distanceMiles({ lat, lng }, destination) * 5280;
  if (feet > QUEST_RADIUS_FEET) {
    throw new Error(`You're about ${Math.round(feet)} feet away. Get within ${QUEST_RADIUS_FEET} feet of the destination and try again.`);
  }
}

let recentPosition: GeolocationPosition | null = null;

export function rememberLocation(position: GeolocationPosition | null) {
  recentPosition = position;
}

function usable(position: GeolocationPosition) {
  const { latitude, longitude } = position.coords;
  return [latitude, longitude, position.timestamp].every(Number.isFinite)
    && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180
    && Date.now() - position.timestamp >= -10000 && Date.now() - position.timestamp <= 600000;
}

function readLocation(high: boolean): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    // A watchdog also covers browsers that leave a permission prompt pending.
    const timer = setTimeout(() => reject({ code: 3 }), high ? 12000 : 8000);
    navigator.geolocation.getCurrentPosition(
      (position) => { clearTimeout(timer); resolve(position); },
      (error) => { clearTimeout(timer); reject(error); },
      { enableHighAccuracy: high, maximumAge: 120000, timeout: high ? 10000 : 7000 },
    );
  });
}

export async function verifyQuestLocation(destination: LatLng, currentOrigin?: LatLng | null) {
  if (!navigator.geolocation) throw new Error("Location isn't available in this browser. Use a browser with location access.");
  if (currentOrigin && Number.isFinite(currentOrigin.lat) && Number.isFinite(currentOrigin.lng)) {
    validateQuestLocation(
      { coords: { latitude: currentOrigin.lat, longitude: currentOrigin.lng }, timestamp: Date.now() } as GeolocationPosition,
      destination,
    );
    return;
  }
  if (recentPosition && usable(recentPosition)) {
    validateQuestLocation(recentPosition, destination);
    return;
  }
  try {
    let position: GeolocationPosition;
    try {
      position = await readLocation(false);
    } catch (error) {
      if ((error as { code?: number }).code === 1) throw error;
      position = await readLocation(true);
    }
    rememberLocation(position);
    validateQuestLocation(position, destination);
  } catch (error) {
    if (error instanceof Error) throw error;
    const code = (error as { code?: number }).code;
    if (code !== 1) {
      if (currentOrigin && Number.isFinite(currentOrigin.lat) && Number.isFinite(currentOrigin.lng)) {
        validateQuestLocation(
          { coords: { latitude: currentOrigin.lat, longitude: currentOrigin.lng }, timestamp: Date.now() } as GeolocationPosition,
          destination,
        );
        return;
      }
      if (recentPosition && Number.isFinite(recentPosition.coords.latitude) && Number.isFinite(recentPosition.coords.longitude)) {
        validateQuestLocation(recentPosition, destination);
        return;
      }
    }
    throw new Error(code === 1
      ? "Allow location access in your browser and device settings, then try again."
      : "Your device couldn't provide your location. Check location services and browser permissions, then try again.");
  }
}
