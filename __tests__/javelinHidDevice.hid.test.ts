/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { JavelinHidDevice } from "@/lib/javelinHidDevice";
import { TextEncoder, TextDecoder } from "util";

(global as any).TextEncoder = TextEncoder;
(global as any).TextDecoder = TextDecoder;

// Tiny helper to create a DataView like HIDInputReportEvent.data
function dataViewFromString(s: string) {
  const u8 = new TextEncoder().encode(s);
  return new DataView(u8.buffer);
}

class FakeHIDDevice {
  opened = false;
  collections = [{ usagePage: 65329, usage: 116 }];

  private handlers = new Map<string, Set<(e: any) => void>>();
  sendReportResponder: ((reportId: number, data: Uint8Array) => void | Promise<void>) | null = null;
  lastSentReport?: { reportId: number; data: Uint8Array } = undefined;

  async open() {
    this.opened = true;
  }

  addEventListener(name: string, handler: (e: any) => void) {
    if (!this.handlers.has(name)) this.handlers.set(name, new Set());
    this.handlers.get(name)!.add(handler);
  }

  removeEventListener(name: string, handler: (e: any) => void) {
    this.handlers.get(name)?.delete(handler);
  }

  async sendReport(reportId: number, data: Uint8Array) {
    this.lastSentReport = { reportId, data };
    if (this.sendReportResponder) {
      await this.sendReportResponder(reportId, data);
    }
  }

  emitInputReport(reportId: number, dataView: DataView) {
    const handlers = this.handlers.get("inputreport");
    if (!handlers) return;
    const ev = { reportId, data: dataView };
    for (const h of Array.from(handlers)) h(ev);
  }
}

describe("JavelinHidDevice (WebHID mocked)", () => {
  let originalHid: any;

  beforeEach(() => {
    // Save & mock navigator.hid
    originalHid = (global as any).navigator?.hid;

    const fakeHidApi = {
      requestDevice: jest.fn().mockResolvedValue([]),
      getDevices: jest.fn().mockResolvedValue([]),
      addEventListener: jest.fn(), // connect/disconnect events
      removeEventListener: jest.fn(),
    };

    (global as any).navigator = (global as any).navigator || {};
    (global as any).navigator.hid = fakeHidApi;
  });

  afterEach(() => {
    (global as any).navigator.hid = originalHid;
    jest.resetAllMocks();
  });

  test("connect() calls navigator.hid.requestDevice and sets the device", async () => {
    const fakeDevice = new FakeHIDDevice();
    (navigator.hid.requestDevice as jest.Mock).mockResolvedValue([fakeDevice]);

    fakeDevice.sendReportResponder = async (_rid, _data) => {
      const reply = "c03 ID Hello\n\n";
      setTimeout(() => fakeDevice.emitInputReport(0, dataViewFromString(reply)), 10);
    };
    
    const j = new JavelinHidDevice();
    const d = await j.connect();

    expect(navigator.hid.requestDevice).toHaveBeenCalled();
    expect(d).toBe(fakeDevice);
    expect(j.device).toBe(fakeDevice);
    expect(j.connected).toBe(true);
  });

  test("checkForConnections selects a single matching device from getDevices", async () => {
    const fakeDevice = new FakeHIDDevice();
    (navigator.hid.getDevices as jest.Mock).mockResolvedValue([fakeDevice]);

    fakeDevice.sendReportResponder = async (_rid, _data) => {
      const reply = "c04 ID Hello\n\n";
      setTimeout(() => fakeDevice.emitInputReport(0, dataViewFromString(reply)), 10);
    };

    const j = new JavelinHidDevice();
    await j.checkForConnections();

    expect(navigator.hid.getDevices).toHaveBeenCalled();
    expect(j.device).toBe(fakeDevice);
    expect(j.connected).toBe(true);
  });

  test("startEventListener parses EV lines and emits typed events (text)", async () => {
    const fakeDevice = new FakeHIDDevice();
    const j = new JavelinHidDevice();
    j.device = (fakeDevice as unknown) as HIDDevice;
    j.connected = true;

    const textListener = jest.fn();
    j.on("text", (ev: any) => {
      textListener(ev.detail);
    });

    (j as any).startEventListener();

    const json = JSON.stringify({ e: "t", t: "Hello, HID!" });
    const line = `EV ${json}\n`;
    fakeDevice.emitInputReport(0, dataViewFromString(line));

    expect(textListener).toHaveBeenCalledTimes(1);
    const detail = textListener.mock.calls[0][0];
    expect(detail.text).toBe("Hello, HID!");
    expect(typeof detail.raw).toBe("string");
  });

  test("sendCommand resolves when device emits response ending with double newline and respects connectionId", async () => {
    const fakeDevice = new FakeHIDDevice();
    const j = new JavelinHidDevice();
    j.device = (fakeDevice as unknown) as HIDDevice;
    j.connected = true;

    // 1) Test initial hello (no connectionId yet)
    fakeDevice.sendReportResponder = async (_rid, _data) => {
      const reply = "c03 ID Hello\n\n";
      setTimeout(() => fakeDevice.emitInputReport(0, dataViewFromString(reply)), 10);
    };

    const id = await (j as any).getConnectionId(); // uses sendCommand("hello")
    expect(id).toBe("c03");
    expect(j.connectionId).toBe("c03");

    // 2) Now test sendCommand when connectionId is set
    fakeDevice.sendReportResponder = async (_rid, sentData) => {
      const sentStr = new TextDecoder().decode(sentData);
      expect(sentStr.startsWith("c03 ")).toBe(true);

      setTimeout(() => {
        const reply = "c03 Example response\n\n";
        fakeDevice.emitInputReport(0, dataViewFromString(reply));
      }, 20);
    };

    const response = await (j as any).sendCommand("info", 1000);
    expect(response).toEqual("Example response");
  });

  test("on() registering a JAVELIN event adds it to enabledEvents and triggers enable_events if connected", async () => {
    const fakeDevice = new FakeHIDDevice();
    fakeDevice.sendReportResponder = async (_rid, data) => {
      // no-op responder; lastSentReport will be populated
    };

    const j = new JavelinHidDevice();
    j.device = (fakeDevice as unknown) as HIDDevice;
    j.connected = true;

    const handler = jest.fn();
    j.on("text", (ev: any) => handler(ev.detail));

    await new Promise((r) => setTimeout(r, 0));

    expect(fakeDevice.lastSentReport).toBeDefined();
    const sentStr = new TextDecoder().decode(fakeDevice.lastSentReport!.data);
    expect(sentStr.includes("enable_events")).toBe(true);
    expect(sentStr.includes("text")).toBe(true);
  });

  test("getConnectionId() returns proper connection id", async () => {
    const fakeDevice = new FakeHIDDevice();

    // Send a proper hello response
    fakeDevice.sendReportResponder = async (_rid, _data) => {
      const reply = "c04 ID Hello\n\n";
      setTimeout(() => fakeDevice.emitInputReport(0, dataViewFromString(reply)), 0);
    };

    const j = new JavelinHidDevice();
    j.device = fakeDevice as any;
    j.connected = true;

    const id = await j.getConnectionId();
    expect(id).toBe("c04");
    expect(j.connectionId).toBe("c04");
  });

  describe("sendCommand (multi-report)", () => {
    it("should split a long command into multiple reports", async () => {
      const fakeDevice = new FakeHIDDevice();
      const j = new JavelinHidDevice();
      j.device = (fakeDevice as unknown) as HIDDevice;
      j.connected = true;
      
      const sendReportSpy = jest.spyOn(fakeDevice, "sendReport");

      const longCommand = "a".repeat(100);

      fakeDevice.sendReportResponder = async (_rid, _data) => {
        // Simulate a response after the last report is sent
        if (sendReportSpy.mock.calls.length === 2) {
            const reply = "OK\n\n";
            setTimeout(() => fakeDevice.emitInputReport(0, dataViewFromString(reply)), 10);
        }
      };

      const response = await j.sendCommand(longCommand, 1000);

      expect(response).toBe("OK");
      expect(sendReportSpy).toHaveBeenCalledTimes(2);

      const commandBytes = new TextEncoder().encode(longCommand + "\n");

      // Check first report
      const firstPacket = new Uint8Array(63);
      firstPacket.set(commandBytes.slice(0, 63));
      expect(sendReportSpy).toHaveBeenCalledWith(0, firstPacket);

      // Check second report
      const secondPacket = new Uint8Array(63);
      secondPacket.set(commandBytes.slice(63, 126));
      expect(sendReportSpy).toHaveBeenCalledWith(0, secondPacket);
    });

    it("should split a long command with connectionId into multiple reports", async () => {
        const fakeDevice = new FakeHIDDevice();
        const j = new JavelinHidDevice();
        j.device = (fakeDevice as unknown) as HIDDevice;
        j.connected = true;
        j.connectionId = "c01";
        
        const sendReportSpy = jest.spyOn(fakeDevice, "sendReport");
  
        const longCommand = "a".repeat(100);
  
        const headerBytes = new TextEncoder().encode(j.connectionId + " ");
        const chunkSize = 63 - headerBytes.length;
        const numChunks = Math.ceil((longCommand.length + 1) / chunkSize);

        fakeDevice.sendReportResponder = async (_rid, _data) => {
          // Simulate a response after the last report is sent
          if (sendReportSpy.mock.calls.length === numChunks) {
              const reply = `${j.connectionId} OK\n\n`;
              setTimeout(() => fakeDevice.emitInputReport(0, dataViewFromString(reply)), 10);
          }
        };
  
        const response = await j.sendCommand(longCommand, 1000);
  
        expect(response).toBe("OK");
        expect(sendReportSpy).toHaveBeenCalledTimes(numChunks);
  
        const commandBytes = new TextEncoder().encode(longCommand + "\n");
  
        // Check first report
        const firstChunkData = commandBytes.slice(0, chunkSize);
        const firstPacket = new Uint8Array(63);
        firstPacket.set(headerBytes);
        firstPacket.set(firstChunkData, headerBytes.length);
        expect(sendReportSpy).toHaveBeenCalledWith(0, firstPacket);
  
        // Check second report
        const secondChunkData = commandBytes.slice(chunkSize, chunkSize * 2);
        const secondPacket = new Uint8Array(63);
        secondPacket.set(headerBytes);
        secondPacket.set(secondChunkData, headerBytes.length);
        expect(sendReportSpy).toHaveBeenCalledWith(0, secondPacket);
      });
  });
});

