"use client";

import { useCallback, useEffect, useState } from "react";

export type CategoryItem = {
  id: string;
  name: string;
  slug: string;
};

export function useCategories() {
  const [data, setData] = useState<CategoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchCategories = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/categories");
      if (!response.ok) {
        setError("Unable to load categories.");
        setLoading(false);
        return;
      }
      const payload = (await response.json()) as CategoryItem[];
      setData(payload);
      setLoading(false);
    } catch {
      setError("Unable to load categories.");
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchCategories();
  }, [fetchCategories]);

  return { data, loading, error, refresh: fetchCategories };
}
