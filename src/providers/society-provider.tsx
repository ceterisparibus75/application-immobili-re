"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

interface Society {
  id: string;
  name: string;
  legalForm: string;
  siret: string;
  city: string;
  isActive: boolean;
  logoUrl: string | null;
  role: string;
}

interface SocietyContextType {
  societies: Society[];
  activeSociety: Society | null;
  setActiveSociety: (society: Society) => void;
  isLoading: boolean;
}

const SocietyContext = createContext<SocietyContextType>({
  societies: [],
  activeSociety: null,
  setActiveSociety: () => {},
  isLoading: true,
});

export function SocietyProvider({
  children,
  initialSocieties,
}: {
  children: React.ReactNode;
  initialSocieties: Society[];
}) {
  const [societies] = useState<Society[]>(initialSocieties);
  const [activeSociety, setActiveSocietyState] = useState<Society | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Lire la société active depuis le cookie
    const cookieValue = document.cookie
      .split("; ")
      .find((row) => row.startsWith("active-society-id="))
      ?.split("=")[1];

    if (cookieValue) {
      const found = societies.find((s) => s.id === cookieValue);
      if (found) {
        setActiveSocietyState(found);
      } else if (societies.length > 0) {
        setActiveSocietyState(societies[0]);
        document.cookie = `active-society-id=${societies[0].id};path=/;max-age=${60 * 60 * 24 * 365}`;
      }
    } else if (societies.length > 0) {
      setActiveSocietyState(societies[0]);
      document.cookie = `active-society-id=${societies[0].id};path=/;max-age=${60 * 60 * 24 * 365}`;
    }

    setIsLoading(false);
  }, [societies]);

  const setActiveSociety = useCallback((society: Society) => {
    setActiveSocietyState(society);
    document.cookie = `active-society-id=${society.id};path=/;max-age=${60 * 60 * 24 * 365}`;
  }, []);

  return (
    <SocietyContext.Provider
      value={{ societies, activeSociety, setActiveSociety, isLoading }}
    >
      {children}
    </SocietyContext.Provider>
  );
}

export function useSociety() {
  const context = useContext(SocietyContext);
  if (!context) {
    throw new Error("useSociety must be used within a SocietyProvider");
  }
  return context;
}
