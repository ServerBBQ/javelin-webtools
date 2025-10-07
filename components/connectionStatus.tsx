"use client";

import { useEffect, useState, useRef } from "react";
import { JavelinHidDevice } from "@/lib/javelinHidDevice";


interface ConnectionStatusProps {
  hid: JavelinHidDevice | null;
  onStatusChange?: (connected: boolean) => void;
  connectedText?: string;
  disconnectedText?: string;
}

/**
 * ConnectionStatus component
 *
 * Displays and reports the current connection status of a Javelin HID device.
 *
 * @component
 *
 * @example
 * ```tsx
 * <ConnectionStatus
 *   hid={hid}
 *   connectedText="Connected to {deviceName}"
 *   disconnectedText="Not connected"
 *   onStatusChange={(isConnected) => console.log(isConnected)}
 * />
 * ```
 *
 * @param {Object} props - Component props
 * @param {JavelinHidDevice | null} props.hid - Javelin HID device instance to monitor.
 * @param {(connected: boolean) => void} [props.onStatusChange] - Optional callback fired only when the connection status changes (connect or disconnect).
 * @param {string} [props.connectedText="Connected to {deviceName}"] - Custom text shown when connected.
 * Supports `{deviceName}` placeholder.
 * @param {string} [props.disconnectedText="Not connected"] - Custom text shown when disconnected.
 */
export default function ConnectionStatus({
  hid,
  onStatusChange,
  connectedText = "Connected to {deviceName}",
  disconnectedText = "Not connected",
}: ConnectionStatusProps) {
  const [connected, setConnected] = useState(false);
  const [deviceName, setDeviceName] = useState<string | null>(null);
  const prevConnected = useRef<boolean | null>(null);

  useEffect(() => {
    if (!hid) return;

    const updateState = () => {
      const isConnected = hid.connected;
      const name = hid.device?.productName || null;
      setConnected(isConnected);
      setDeviceName(name);
    };

    // Initialize once
    updateState();

    // Listen for hardware connection changes
    hid.on("connected", updateState);
    hid.on("disconnected", updateState);

    // Cleanup function
    return () => {
      hid.off("connected", updateState);
      hid.off("disconnected", updateState);
    };
  }, [hid]);

  useEffect(() => {
    // Only fire callback if connection *status* changes
    if (prevConnected.current !== connected) {
      prevConnected.current = connected;

      onStatusChange?.(connected);
    }
  }, [connected, onStatusChange]);

  const displayText = connected
    ? connectedText.replace("{deviceName}", deviceName ?? "Unknown device")
    : disconnectedText;

  return (
    <p>
      Status:{" "}
      {connected ? (
        <span className="text-green-600 font-semibold">{displayText}</span>
      ) : (
        <span className="text-red-600 font-semibold">{displayText}</span>
      )}
    </p>
  );
}
