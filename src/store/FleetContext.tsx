import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { ArmadaStatus, Driver, Truck } from "../types";
import { api } from "../utils/apiClient";
import { useAuth } from "./AuthContext";

export interface TruckRow {
  id: string;
  nomor_unit: string;
  jenis: string;
  kapasitas: string;
  driver_id: string | null;
  status: ArmadaStatus;
  keterangan: string | null;
  driver_nama: string | null;
  driver_telepon: string | null;
  dedicated_customer_id?: string | null;
  dedicated_customer_nama?: string | null;
}

export interface TruckFormData {
  nomorUnit: string;
  jenis: string;
  kapasitas: string;
  driverNama: string;
  driverTelepon: string;
  status: ArmadaStatus;
  keterangan?: string;
}

export interface TruckWithDriver extends Truck {
  driver?: Driver;
}

export function toTruckWithDriver(row: TruckRow): TruckWithDriver {
  return {
    id: row.id,
    nomorUnit: row.nomor_unit,
    jenis: row.jenis,
    kapasitas: row.kapasitas,
    driverId: row.driver_id ?? "",
    status: row.status,
    keterangan: row.keterangan ?? undefined,
    dedicatedCustomerId: row.dedicated_customer_id ?? undefined,
    dedicatedCustomerNama: row.dedicated_customer_nama ?? undefined,
    driver: row.driver_nama ? { id: row.driver_id ?? "", nama: row.driver_nama, telepon: row.driver_telepon ?? "" } : undefined,
  };
}

interface FleetContextValue {
  trucks: Truck[];
  trucksWithDriver: TruckWithDriver[];
  isLoading: boolean;
  refresh: () => Promise<void>;
  getTruck: (id: string) => TruckWithDriver | undefined;
  createTruck: (data: TruckFormData) => Promise<void>;
  updateTruck: (id: string, data: TruckFormData) => Promise<void>;
  setTruckStatus: (id: string, status: ArmadaStatus) => Promise<void>;
}

const FleetContext = createContext<FleetContextValue | null>(null);

export function FleetProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [trucksWithDriver, setTrucksWithDriver] = useState<TruckWithDriver[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Lookup list for dropdowns / duplicate checks (a fleet is tens of units);
  // the Armada table itself is paged by the API (see FleetList).
  async function refresh() {
    setIsLoading(true);
    try {
      const res = await api.get<{ items: TruckRow[] }>("/api/trucks");
      setTrucksWithDriver(res.items.map(toTruckWithDriver));
    } catch {
      setTrucksWithDriver([]);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (isAuthenticated) refresh();
    else setTrucksWithDriver([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  function getTruck(id: string) {
    return trucksWithDriver.find((t) => t.id === id);
  }

  async function createTruck(data: TruckFormData) {
    await api.post("/api/trucks", data);
    await refresh();
  }

  async function updateTruck(id: string, data: TruckFormData) {
    await api.patch(`/api/trucks/${id}`, data);
    await refresh();
  }

  async function setTruckStatus(id: string, status: ArmadaStatus) {
    await api.patch(`/api/trucks/${id}`, { status });
    await refresh();
  }

  const trucks: Truck[] = trucksWithDriver.map(({ driver: _driver, ...t }) => t);

  return (
    <FleetContext.Provider value={{ trucks, trucksWithDriver, isLoading, refresh, getTruck, createTruck, updateTruck, setTruckStatus }}>
      {children}
    </FleetContext.Provider>
  );
}

export function useFleet() {
  const ctx = useContext(FleetContext);
  if (!ctx) throw new Error("useFleet must be used within FleetProvider");
  return ctx;
}
