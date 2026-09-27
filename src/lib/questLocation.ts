import { distanceMiles, type LatLng } from "../pipeline/geo";

export const QUEST_RADIUS_METERS = 150;

export function validateQuestLocation(position: GeolocationPosition, destination: LatLng) {
  const { latitude: lat, longitude: lng, accuracy } = position.coords;
  if (![lat, lng, accuracy, destination.lat, destination.lng].every(Number.isFinite) || accuracy < 0 || accuracy > 100) {
    throw new Error(`Your device reports location accuracy of ${Number.isFinite(accuracy) ? `±${Math.round(accuracy)} meters` : "unknown"}. Check-in needs accuracy within 100 meters, even if the map pin looks close. Enable precise location or try outdoors.`);
  }
  if (!Number.isFinite(position.timestamp) || Date.now() - position.timestamp > 60000) {
    throw new Error("The displayed location is out of date. Your device has not sent a fresh reading. Refresh location or check device location settings, then try again.");
  }
  const meters = distanceMiles({ lat, lng }, destination) * 1609.344;
  if (meters > QUEST_RADIUS_METERS) {
    throw new Error(`You're about ${Math.round(meters)} meters away. Get within ${QUEST_RADIUS_METERS} meters of the destination and try again.`);
  }
}

let recentPosition: GeolocationPosition | null = null;
let accuratePosition: GeolocationPosition | null = null;

export function rememberLocation(position: GeolocationPosition | null) {
  recentPosition = position;
  if (!position) accuratePosition = null;
  else if (usable(position)) accuratePosition = position;
}

function usable(position: GeolocationPosition) {
  const { latitude, longitude, accuracy } = position.coords;
  return [latitude, longitude, accuracy, position.timestamp].every(Number.isFinite)
    && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180
    && accuracy >= 0 && accuracy <= 100
    && Date.now() - position.timestamp >= 0 && Date.now() - position.timestamp <= 60000;
}

function readLocation(high: boolean): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    // A watchdog also covers browsers that leave a permission prompt pending.
    const timer = setTimeout(() => reject({ code: 3 }), high ? 9000 : 6000);
    navigator.geolocation.getCurrentPosition(
      (position) => { clearTimeout(timer); resolve(position); },
      (error) => { clearTimeout(timer); reject(error); },
      { enableHighAccuracy: high, maximumAge: 30000, timeout: high ? 8000 : 5000 },
    );
  });
}

export async function verifyQuestLocation(destination: LatLng) {
  if (!navigator.geolocation) throw new Error("Location isn't available in this browser. Use a browser with location access.");
  if (accuratePosition && usable(accuratePosition)) {
    validateQuestLocation(accuratePosition, destination);
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
    if (!usable(position)) { position = await readLocation(true); rememberLocation(position); }
    validateQuestLocation(position, destination);
  } catch (error) {
    if (error instanceof Error) throw error;
    const code = (error as { code?: number }).code;
    if (code !== 1 && accuratePosition && usable(accuratePosition)) {
      validateQuestLocation(accuratePosition, destination);
      return;
    }
    if (code !== 1 && recentPosition) validateQuestLocation(recentPosition, destination);
    throw new Error(code === 1
      ? "Allow location access in your browser and device settings, then try again."
      : "Your device couldn't provide a precise location. Check location services and browser permissions, or check in from your phone at the destination.");
  }
}
