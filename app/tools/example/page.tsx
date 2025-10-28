"use client";

import { useEffect, useState, useRef } from "react";
import { JavelinHidDevice } from "@/lib/javelinHidDevice";
import ConnectButton from "@/components/connectButton";
import ConnectionStatus from "@/components/connectionStatus";

export default function JavelinHidDemo() {
  // The use state allows you to call the set functions to directly update the page content wherever corresponding variable is used 
  const [hid, setHid] = useState<JavelinHidDevice | null>(null);
  const [consoleLog, setConsoleLog] = useState<string[]>([]);
  const [commandTextbox, setCommandTextbox] = useState("");
  const [buttonFivePressed, setButtonFivePressed] = useState(false)

  const consoleRef = useRef<HTMLTextAreaElement>(null);

  // Everything that is in the useEffect runs on page load
  useEffect(() => {
    const device = new JavelinHidDevice();
    setHid(device);

    device.on("dictionary_status", (ev) => {
      console.log("dictionary_status", ev.detail);
    })

    // This only triggers if enabled in the key layout
    device.on("button_state", (ev) => {
      console.log("button_state", ev.detail)
      console.log("button 10 pressed", ev.detail.keys[10]);

      // This is all that is needed to update the page since the variable `buttonFivePressed` is used inside the page
      setButtonFivePressed(ev.detail.keys[5]);
    })
    device.on("paper_tape", (ev)=> {
      console.log("paper_tape", ev.detail);
    })
    device.on("connected", async (ev)=> {
      console.log("connected", ev.detail);
      console.log( "Test lookup results", await device.lookup("test"));

      device.lookup("hello").then((result)=> console.log("Hello lookup results", result));
      device.lookup("javelin").then((result)=> console.log("Javelin lookup results", result));
    })
    device.on("disconnected", (ev)=> {
      console.log("disconnected", ev.detail);
    })
    device.on("script", (ev)=> {
      console.log("script", ev.detail);
    })
  }, []);

  const appendLog = (msg: string) => {
    // Call setConsoleLog to directly update the page content
    setConsoleLog((prev) => [...prev, msg]);
    // Scroll to bottom
    setTimeout(() => {
      consoleRef.current?.scrollTo(0, consoleRef.current.scrollHeight);
    }, 0);
  };

  const handleSendButtonPress = async () => {
    if (!hid || !commandTextbox) return;
    appendLog(`> ${commandTextbox}`);
    try {
      // sendCommand here expects a string (see your string-based sendCommand)
      const response = await hid.sendCommand(commandTextbox);
      appendLog(`< ${response}`);
    } catch (err: unknown) {
      const e = err as Error
      
      appendLog(`< Error: ${e.message}`);
    }
    setCommandTextbox("");
  };

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-bold">Javelin HID Demo Console</h1>
      <ConnectionStatus
        hid={hid}
        connectedText="Connected to {deviceName}"
        disconnectedText="Not connected"
        onStatusChange={(isConnected) => console.log("Connection state: " + isConnected)}
      />

      <ConnectButton hid={hid} onConnected={(device) => console.log("Connected to:", device?.productName)} className="bg-blue-500"/>

      <textarea
        ref={consoleRef}
        className="w-full h-64 p-2 border border-gray-400 rounded bg-black text-green-400 font-mono resize-none"
        value={consoleLog.join("\n")}
        readOnly
      />

      <div className="flex space-x-2">
        <input
          type="text"
          className="flex-1 p-2 border border-gray-400 rounded font-mono"
          placeholder="Type command..."
          value={commandTextbox}
          onChange={(e) => setCommandTextbox(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleSendButtonPress();
            }
          }}
        />
        <button
          onClick={handleSendButtonPress}
          className="px-4 py-2 bg-green-500 text-white rounded"
        >
          Send
        </button>
      </div>

      <p className="text-sm text-gray-500">Enable Individual keys in layout tool must be enabled for this to work</p>
      Button 5 pressed: {buttonFivePressed.toString()}
    </div>
  );
}
