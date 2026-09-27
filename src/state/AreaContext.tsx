import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { areaById, CITY_AREAS, DEFAULT_AREA, type CityArea, type CityAreaId } from "../pipeline/geo";

const KEY = "ramble.area";

const AreaContext = createContext<{
  area: CityArea;
  setArea: (id: CityAreaId) => void;
}>({
  area: DEFAULT_AREA,
  setArea: () => {},
});

function storedArea(): CityArea {
  try {
    return areaById(localStorage.getItem(KEY));
  } catch {
    return DEFAULT_AREA;
  }
}

export function AreaProvider({ children }: { children: ReactNode }) {
  const [area, setAreaState] = useState(storedArea);
  const value = useMemo(
    () => ({
      area,
      setArea: (id: CityAreaId) => {
        const next = areaById(id);
        setAreaState(next);
        try {
          localStorage.setItem(KEY, next.id);
        } catch {
          // Ignore private-mode storage failures.
        }
      },
    }),
    [area],
  );
  return <AreaContext.Provider value={value}>{children}</AreaContext.Provider>;
}

export function useArea() {
  return useContext(AreaContext);
}

export { CITY_AREAS };
