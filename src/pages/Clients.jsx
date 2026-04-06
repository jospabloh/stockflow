import React, { useState, useEffect } from "react";
import { useBusinessContext } from "@/components/BusinessContext";
import ClientsManager from "@/components/settings/ClientsManager";

export default function Clients() {
  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <ClientsManager />
    </div>
  );
}