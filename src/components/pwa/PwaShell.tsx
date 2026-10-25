"use client";

import { useEffect } from "react";
import { setupServiceWorker } from "./sw-register";
import { InstallPrompt, type InstallLabels } from "./InstallPrompt";

/**
 * PWA en la zona con sesión (F-23): registra el service worker y pinta el
 * aviso de instalación cuando toca. Lo monta `(app)/layout.tsx`, que persiste
 * entre navegaciones; los textos llegan ya traducidos del servidor (sin
 * namespace extra en el proveedor del cliente).
 */
export function PwaShell({ installLabels }: { installLabels: InstallLabels }) {
  useEffect(() => {
    void setupServiceWorker();
  }, []);

  return <InstallPrompt labels={installLabels} />;
}
