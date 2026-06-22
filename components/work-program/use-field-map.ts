"use client";

import { useEffect, useState } from "react";
import type { FieldFeatureCollection } from "@/lib/work-program/analytics";

const emptyCollection: FieldFeatureCollection = { type: "FeatureCollection", features: [] };

export function useFieldMap() {
  const [fieldMap, setFieldMap] = useState<FieldFeatureCollection>(emptyCollection);

  useEffect(() => {
    let active = true;
    fetch("/data/field-map-data.geojson")
      .then((response) => {
        if (!response.ok) throw new Error("Field map unavailable.");
        return response.json() as Promise<FieldFeatureCollection>;
      })
      .then((data) => {
        if (active) setFieldMap(data);
      })
      .catch(() => {
        if (active) setFieldMap(emptyCollection);
      });
    return () => {
      active = false;
    };
  }, []);

  return fieldMap;
}
