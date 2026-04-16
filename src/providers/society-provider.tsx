"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

interface Society {
  id: string;
  name: string;
  legalForm: string;
  siret: string | null;
  city: string;
  isActive: boolean;
  logoUrl: string | null;
  role: string;
  ownerId?: string | null;
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
  const societies = initialSocieties;
  const [activeSociety, setActiveSocietyState] = useState<Society | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const cookieValue = document.cookie
      .split("; ")
      .find((row) => row.startsWith("active-society-id="))
      ?.split("=")[1];

    const found = cookieValue
      ? (societies.find((s) => s.id === cookieValue) ?? societies[0] ?? null)
      : (societies[0] ?? null);

    if (found) {
      setActiveSocietyState(found);
      document.cookie = `active-society-id=${found.id};path=/;max-age=${60 * 60 * 24 * 365};SameSite=Lax;Secure`;
    }
    setIsLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
