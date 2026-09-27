import { afterEach, expect, it, vi } from "vitest";
import { rememberLocation, verifyQuestLocation, validateQuestLocation } from "./questLocation";
const destination = { lat: 40.8076, lng: -73.9643 };
function fix(lat = destination.lat, accuracy = 10, timestamp = Date.now()) {
  return { coords: { latitude: lat, longitude: destination.lng, accuracy }, timestamp } as GeolocationPosition;
}
it("accepts a fresh fix at the destination regardless of indoor accuracy", () => {
  expect(() => validateQuestLocation(fix(), destination)).not.toThrow();
  expect(() => validateQuestLocation(fix(destination.lat, 500), destination)).not.toThrow();
  expect(() => validateQuestLocation(fix(destination.lat, 1500), destination)).not.toThrow();
});
it("rejects distant locations even with a valid GPS reading", () => {
  expect(() => validateQuestLocation(fix(40.82), destination)).toThrow("Get within 200");
});
it("rejects invalid coordinates and stale readings", () => {
  expect(() => validateQuestLocation(fix(NaN), destination)).toThrow("coordinates");
  expect(() => validateQuestLocation(fix(destination.lat, 10, Date.now() - 150000), destination)).toThrow("out of date");
});

afterEach(() => { rememberLocation(null); vi.unstubAllGlobals(); });
it("uses a recent app reading without waiting for another GPS request", async () => {
  const read = vi.fn();
  vi.stubGlobal("navigator", { geolocation: { getCurrentPosition: read } });
  rememberLocation(fix());
  await expect(verifyQuestLocation(destination)).resolves.toBeUndefined();
  expect(read).not.toHaveBeenCalled();
});
it("retries a timed-out request and validates the fallback reading", async () => {
  const read = vi.fn()
    .mockImplementationOnce((_success, fail) => fail({ code: 3 }))
    .mockImplementationOnce((success) => success(fix()));
  vi.stubGlobal("navigator", { geolocation: { getCurrentPosition: read } });
  await expect(verifyQuestLocation(destination)).resolves.toBeUndefined();
  expect(read).toHaveBeenCalledTimes(2);
});
it("does not retry permission denial or accept a distant cached reading", async () => {
  const read = vi.fn((_success, fail) => fail({ code: 1 }));
  vi.stubGlobal("navigator", { geolocation: { getCurrentPosition: read } });
  await expect(verifyQuestLocation(destination)).rejects.toThrow("Allow location");
  expect(read).toHaveBeenCalledTimes(1);
  rememberLocation(fix(40.82));
  await expect(verifyQuestLocation(destination)).rejects.toThrow("Get within 200");
});

it("accepts coarse indoor readings without requiring outdoors", async () => {
  const read = vi.fn((success) => success(fix(destination.lat, 1500)));
  vi.stubGlobal("navigator", { geolocation: { getCurrentPosition: read } });
  await expect(verifyQuestLocation(destination)).resolves.toBeUndefined();
  expect(read).toHaveBeenCalledTimes(1);
});


it("uses current app origin directly when checking in without requiring a new GPS reading", async () => {
  const read = vi.fn();
  vi.stubGlobal("navigator", { geolocation: { getCurrentPosition: read } });
  await expect(verifyQuestLocation(destination, destination)).resolves.toBeUndefined();
  expect(read).not.toHaveBeenCalled();
});

