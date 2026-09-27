import { afterEach, expect, it, vi } from "vitest";
import { rememberLocation, verifyQuestLocation, validateQuestLocation } from "./questLocation";
const destination = { lat: 40.8076, lng: -73.9643 };
function fix(lat = destination.lat, accuracy = 10, timestamp = Date.now()) {
  return { coords: { latitude: lat, longitude: destination.lng, accuracy }, timestamp } as GeolocationPosition;
}
it("accepts a precise fresh fix at the destination", () => {
  expect(() => validateQuestLocation(fix(), destination)).not.toThrow();
});
it("rejects distant locations even with a valid GPS reading", () => {
  expect(() => validateQuestLocation(fix(40.82), destination)).toThrow("Get within 150");
});
it("rejects inaccurate, missing, and stale readings", () => {
  expect(() => validateQuestLocation(fix(destination.lat, 500), destination)).toThrow("accuracy");
  expect(() => validateQuestLocation(fix(NaN), destination)).toThrow("accuracy");
  expect(() => validateQuestLocation(fix(destination.lat, 10, Date.now() - 120000), destination)).toThrow("out of date");
});

afterEach(() => { rememberLocation(null); vi.unstubAllGlobals(); });
it("uses a recent accurate app reading without waiting for another GPS request", async () => {
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
  await expect(verifyQuestLocation(destination)).rejects.toThrow("Get within 150");
});

it("preserves an accurate recent reading when a coarse update arrives", async () => {
  const read = vi.fn();
  vi.stubGlobal("navigator", { geolocation: { getCurrentPosition: read } });
  rememberLocation(fix());
  rememberLocation(fix(destination.lat, 1500));
  await expect(verifyQuestLocation(destination)).resolves.toBeUndefined();
  expect(read).not.toHaveBeenCalled();
});
it("explains the accuracy problem when a coarse reading cannot be improved", async () => {
  const read = vi.fn((_success, fail) => fail({ code: 3 }));
  vi.stubGlobal("navigator", { geolocation: { getCurrentPosition: read } });
  rememberLocation(fix(destination.lat, 1500));
  await expect(verifyQuestLocation(destination)).rejects.toThrow("±1500 meters");
});
