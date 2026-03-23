import React, { createContext, useContext, useState, ReactNode } from 'react';

interface DrawerContextType {
  drawerOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
  setDrawerOpen: React.Dispatch<React.SetStateAction<boolean>>; // add this
}

const DrawerContext = createContext<DrawerContextType | undefined>(undefined);

export const useDrawer = () => {
  const ctx = useContext(DrawerContext);
  if (!ctx) throw new Error('useDrawer must be used within DrawerProvider');
  return ctx;
};

export const DrawerProvider = ({ children }: { children: ReactNode }) => {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const openDrawer = () => setDrawerOpen(true);
  const closeDrawer = () => setDrawerOpen(false);
  return (
    <DrawerContext.Provider
      value={{ drawerOpen, openDrawer, closeDrawer, setDrawerOpen }}
    >
      {children}
    </DrawerContext.Provider>
  );
};
