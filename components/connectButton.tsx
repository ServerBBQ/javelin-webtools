"use client";

import { useState } from "react";
import { JavelinHidDevice } from "@/lib/javelinHidDevice";


interface ConnectButtonProps {
  hid: JavelinHidDevice | null;
  onConnected?: (device: HIDDevice | null) => void;
}

/**
 * ConnectButton component
 *
 * Renders a button that attempts to connect to a Javelin HID device when clicked.
 * Displays a loading state while a connection attempt is in progress and disables
 * the button to prevent duplicate connection requests.
 *
 * @component
 *
 * @example
 * ```tsx
 * <ConnectButton
 *   hid={hid}
 *   onConnected={(device) => console.log("Connected to:", device?.productName)}
 * />
 * ```
 *
 * @param {Object} props - Component props.
 * @param {JavelinHidDevice | null} props.hid - The Javelin HID device instance to connect to.
 * @param {(device: HIDDevice | null) => void} [props.onConnected] - Optional callback fired
 */
export default function ConnectButton({ hid, onConnected }: ConnectButtonProps) {
  const [connecting, setConnecting] = useState(false);

  /**
   * Attempts to connect to the provided HID device.
   * If successful, triggers the `onConnected` callback with the device name.
   */
  const handleConnect = async () => {
    if (!hid) return;

    setConnecting(true);
    try {
      const device = await hid.connect();
      if (device) {
        onConnected?.(device || null);
      }
    } catch (err) {
      // Errors are caught silently; parent can observe HID connection errors directly
      console.error("Failed to connect to HID device:", err);
    } finally {
      setConnecting(false);
    }
  };

  return (
    <button
      onClick={handleConnect}
      disabled={connecting}
      className="px-4 py-2 rounded text-white bg-blue-500 hover:bg-blue-600">
      Connect Device
    </button>
  );
}
