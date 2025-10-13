"use client";

const options: HIDDeviceRequestOptions = {
  filters: [
    {
      usagePage: 65329,
      usage: 116
    },
  ],
};

// My documentation of the Javelin event system, TODO, move or delete this
// e: event
//   p: paper tape
//     o: outline
//     d: dictionary
//     t: translation
//   c: script // script events like layer changes
//     t: text
//   b: button_state // when pressing down buttons
//     d: data
//   s: suggestion
//     c: combined, how many strokes the suggestion covers(last x strokes)
//     t: translation
//     o: array of outlines
//   v: template value // when setting a template value
//     i: index
//     v: value
//   l: serial // when communicating over serial, used for serial bridge
//     d: data
//   d: dictionary status
//     d: dictionary
//     v: value, 1 or 0, 0 means disabled 1 means enabled
//   t: text // The text of the stuff typed in steno, used for wpm tool
//     t: text
//  
//
// static constexpr const char *EVENT_NAMES[] = {
//     "button_state",      //
//     "dictionary_status", //
//     "paper_tape",        //
//     "script",            //
// #if JAVELIN_BLE
//     "serial", //
// #endif
//     "suggestion",     //
//     "template_value", //
//     "text",           //
//     "analog_data",    //
// };
//
// EV {"e":"b","d":"AAAAAAAAAAA="} // button state
// EV {"e":"d","d":"user.json","v":0} // dictionary status
// EV {"e":"p","o":"TH","d":"main.json","t":"this"} // paper tape
// EV {"e":"c","t":"layer_id: 87377230"} // script I think
// EV {"e":"l","d":"BAA="} // serial
// EV {"e":"s","c":2,"t":"this is","o":["TH-S","STKHE","STKH-B"]} // suggestion
// EV {"e":"v","i":0,"v":"test"} // template value
// EV {"e":"t","t":" Test"} // text

// List of events that should trigger `enable_events`
const JAVELIN_EVENT_NAMES: (keyof JavEventMap)[] = [
  "button_state",
  "dictionary_status",
  "paper_tape",
  "script",
  "serial",
  "suggestion",
  "template_value",
  "text",
  "analog_data",
] as const;

export interface JavEventMap {
  connected: HIDDevice;
  disconnected: HIDDevice;
  
  // Javelin events
  button_state: JavButtonStateEventDetail;
  dictionary_status: JavDictStatusEventDetail;
  paper_tape: JavPaperTapeEventDetail;
  script: JavScriptEventDetail;
  serial: JavSerialEventDetail;
  suggestion: JavSuggestionEventDetail;
  template_value: JavTemplateValueEventDetail;
  text: JavTextEventDetail;
  analog_data: JavAnalogDataEventDetail;
}

type CoercibleType = "number" | "boolean" | "boolean[]" | "string" | "string[]" | "unknown";

interface AliasMapping<T> {
  key: keyof T;
  type: CoercibleType;
}

/**
 * **Event:** `button_state`
 * 
 * This happens when a user presses a key only if it is enabled in the layout
 */
export interface JavButtonStateEventDetail {
  /** Array of booleans, first element = first key, etc. */
  keys: boolean[];
  /** Raw event data */
  raw: string;
}

export const JavButtonStateAliases: Record<string, AliasMapping<JavButtonStateEventDetail>> = {
  d: { key: "keys", type: "boolean[]" },
};

/**
 * **Event:** `dictionary_status`
 * 
 * This happens when a dictionary is enable or disabled
 */
export interface JavDictStatusEventDetail {
  /** The name of the dictionary that changed */
  dictionary: string;
  /** The new state of the dictionary */
  enabled: boolean;
  /** Raw event data */
  raw: string;
}

const JavDictStatusAliases: Record<string, AliasMapping<JavDictStatusEventDetail>> = {
  d: { key: "dictionary", type: "string" },
  v: { key: "enabled", type: "boolean" },
};


/**
 * **Event:** `paper_tape`
 * 
 * Fired each time a stroke is entered on the keyboard.
*/
export interface JavPaperTapeEventDetail {
  outline: string ;
  dictionary: string;
  translation: string;
  /** Raw event data */
  raw: string;
}

const JavPaperTapeAliases: Record<string, AliasMapping<JavPaperTapeEventDetail>> = {
  o: { key: "outline", type: "string" },
  d: { key: "dictionary", type: "string" },
  t: { key: "translation", type: "string" },
};

/**
 * **Event:** `script`
 * 
 * Events from Javelin script
 * @example
 * ```json
 * {"text":"layer_id: 87377230"}
 * ```
 */
export interface JavScriptEventDetail {
  text: string
  /** Raw event data */
  raw: string;
}

const JavScriptAliases: Record<string, AliasMapping<JavScriptEventDetail>> = {
  t: { key: "text", type: "string" },
};

/**
 * **Event:** `template_value`
 * 
 * Fired when a template value changes
 */
export interface JavTemplateValueEventDetail {
  /** The index of template value changed */
  index: number;
  /** The new value of the template value */
  value: string;
  /** Raw event data */
  raw: string;
}

const JavTemplateValueAliases: Record<string, AliasMapping<JavTemplateValueEventDetail>> = {
  i: { key: "index", type: "number" },
  v: { key: "value", type: "string" },
};

/**
 * **Event:** `serial`
 * 
 * This only exists if the keyboard has BLE(Bluetooth), I am unsure if it only works over bluetooth or works over usb too, TODO check
 * This is the raw serial output
 */
export interface JavSerialEventDetail {
  /** base64 encoded data based on the steno protocol used */
  data: string; // d
  /** Raw event data */
  raw: string;
}

const JavSerialAliases: Record<string, AliasMapping<JavSerialEventDetail>> = {
  d: { key: "data", type: "string" },
};


/** 
 * **Event:** `suggestion`
 * 
 * Fired when the keyboard identifies a more efficient outline for a given translation.
*/
export interface JavSuggestionEventDetail {
  /** How many strokes the suggestion covers*/
  strokes: number;
  /** The text that has a suggestion */
  translation: string;
  /** 
   * An array of outlines
   * @example
   * ["TH-S", "STKHE", "STKH-B"]
   */
  outlines: string[];
  /** Raw event data */
  raw: string;
}

const JavSuggestionAliases: Record<string, AliasMapping<JavSuggestionEventDetail>> = {
  c: { key: "strokes", type: "number" },
  t: { key: "translation", type: "string" },
  o: { key: "outlines", type: "string[]" },
};

/**
 * **Event:** `text`
 * 
 * The output in text for steno, this is used in the writing speed tool
*/
export interface JavTextEventDetail {
  event: "text";
  text: string;
  /** Raw event data */
  raw: string;
}

const JavTextAliases: Record<string, AliasMapping<JavTextEventDetail>> = {
  t: { key: "text", type: "string" },
};


/**
 * **Event:** `analog_data`
 * 
 * Provides analog data for sliders.
 * This currently is only used on [Jeff's personal device](https://discord.com/channels/136953735426473984/1034560725047316530/1413829434770722936)
 * Each event reports the current positions of the sliders on the device.
 */
export interface JavAnalogDataEventDetail {
  /** Raw event data */
  raw: string;
}

const JavAnalogDataAliases: Record<string, AliasMapping<JavAnalogDataEventDetail>> = {
  
};

/**
 * Used to convert the Javelin event into a human readable one
 */
const JavAliasToEventName: Record<string, keyof JavEventMap> = {
  b: 'button_state',
  d: 'dictionary_status',
  p: 'paper_tape',
  c: 'script',
  l: 'serial',
  s: 'suggestion',
  v: 'template_value',
  t: 'text',
  a: 'analog_data',
};

type EventAliases = {
  b: Record<string, AliasMapping<JavButtonStateEventDetail>>,
  d: Record<string, AliasMapping<JavDictStatusEventDetail>>,
  p: Record<string, AliasMapping<JavPaperTapeEventDetail>>,
  c: Record<string, AliasMapping<JavScriptEventDetail>>,
  l: Record<string, AliasMapping<JavSerialEventDetail>>,
  s: Record<string, AliasMapping<JavSuggestionEventDetail>>,
  v: Record<string, AliasMapping<JavTemplateValueEventDetail>>,
  t: Record<string, AliasMapping<JavTextEventDetail>>,
  a: Record<string, AliasMapping<JavAnalogDataEventDetail>>,
};

const JavAliases: EventAliases = {
  b: JavButtonStateAliases,
  d: JavDictStatusAliases,
  p: JavPaperTapeAliases,
  c: JavScriptAliases,
  l: JavSerialAliases,
  s: JavSuggestionAliases,
  v: JavTemplateValueAliases,
  t: JavTextAliases,
  a: JavAnalogDataAliases,
};

/**
 * Decodes a Base64-encoded string into a boolean array representing bits.
 * Each bit of the decoded bytes becomes one element in the array:
 *   - true  = bit is set (1)
 *   - false = bit is clear (0)
 * The first bit of the first byte is the first element of the array, etc.
 */
export function decodeBase64ToBoolArray(data: string): boolean[] {
  const bytes = Uint8Array.from(atob(data), c => c.charCodeAt(0));
  const bits: boolean[] = [];
  for (const byte of bytes) {
    for (let i = 0; i < 8; i++) {
      bits.push((byte & (1 << i)) !== 0);
    }
  }
  return bits;
}

export type DecodedJavEvent<K extends keyof JavEventMap> = {
  event: K;
  detail: JavEventMap[K] & { raw: string };
};

/** Convert a raw event object to a typed, human-readable object */
export function decodeJavEvent<K extends keyof JavEventMap>(
  ev: { e: string; [key: string]: unknown }
): DecodedJavEvent<keyof JavEventMap> | null {
  const eventKey = JavAliasToEventName[ev.e] as K | undefined;
  if (!eventKey) return null;

  // Check if this event has aliases we know how to parse
  if (!(ev.e in JavAliases)) return null;
  const aliases = JavAliases[ev.e as keyof EventAliases];

  // Build as a plain record first
  const detailRecord: Record<string, unknown> = { raw: JSON.stringify(ev) };

  function coerceValue(value: unknown, type: CoercibleType): unknown {
    if (value === null || value === undefined) {
      if (type === "boolean[]") return [];
      if (type === "string[]") return [];
      return value;
    }

    switch (type) {
      case "boolean":
        if (value === "1" || value === 1 || value === "true") return true;
        if (value === "0" || value === 0 || value === "false") return false;
        return Boolean(value);
      case "boolean[]":
        if (typeof value === "string") return decodeBase64ToBoolArray(value);
        return Array.isArray(value) ? value.map(Boolean) : [];
      case "number":
        return typeof value === "string" && /^\d+$/.test(value)
          ? Number(value)
          : value;
      case "string":
        return String(value);
      case "string[]":
        return Array.isArray(value) ? value.map(String) : [];
      default:
        return value;
    }
  }

  for (const [key, value] of Object.entries(ev)) {
    if (key === "e") continue;
    const alias = aliases[key];
    if (!alias) continue;

    const coerced = coerceValue(value, alias.type);
    detailRecord[alias.key as string] = coerced;
  }

  // Final cast: detailRecord -> concrete event type
  return {
    event: eventKey,
    detail: detailRecord as unknown as JavEventMap[K] & { raw: string },
  };
}

/**
 *  Manages a single Javelin HID device in the browser using the WebHID API.
 */
export class JavelinHidDevice extends EventTarget {
  /** The underlying HIDDevice, or null if not connected. */
  device: HIDDevice | null = null;

  /** Whether the device is currently connected. */
  connected = false;

  /**
   * The id given by the `hello` console command
   */
  connectionId?: string = undefined;

  constructor() {
    super()
    if (!navigator?.hid) {
      throw new Error("WebHID is not available in this environment");
    }

    // Listen for devices being plugged in
    navigator.hid.addEventListener("connect", (event: HIDConnectionEvent) => {
      if (this.connected) {return};

      // Wait for device to init before sending data
      setTimeout(async ()=>{
        this.device = event.device;
        await this.setupDevice();
        this.connected = true;
        this.emit("connected", event.device)
      }, 10)
    });

    // Listen for devices being unplugged
    navigator.hid.addEventListener("disconnect", (event: HIDConnectionEvent) => {
      if (this.device && this.device === event.device) {
        this.device = null;
        this.connected = false;
        this.emit("disconnected", event.device)
      }
    });

    this.checkForConnections();
  }

  /**
   * Prompts the user to select a Javelin HID device using WebHID.
   *
   * @param save - If true, persist the selected device info (e.g. in localStorage) for reconnecting later.
   * @returns The selected HIDDevice, or null if no device was chosen.
   */
  async connect(): Promise<HIDDevice | null> {
    const devices = await navigator.hid.requestDevice(options);

    if (!devices || devices.length === 0) {
      console.warn("No device selected.");
      return null;
    }

    const device = devices[0];
    this.device = device;
    await this.setupDevice();
    this.connected = true;
    this.emit("connected", this.device)
    return device;
  }

  /**
   * Sends a command to the device as a string and waits for a string response.
   *
   * @param command - The command string to send
   * @param timeout - Optional timeout in ms
   * @returns A Promise that resolves to the response string from the device
    * @example
    * ```ts
    * // Basic usage
    * const response = await device.sendCommand("help");
    * console.log(response);
    *
    * // With a custom timeout
    * const response2 = await device.sendCommand("info", 2000);
    * console.log(response2);
    * ```
   */
  async sendCommand(
    command: string,
    timeout?: number
  ): Promise<string> {
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    const header = this.connectionId ? this.connectionId + " " : "";

    const headerBytes = encoder.encode(header)
    const commandBytes = encoder.encode(command + "\n");

    let timer: ReturnType<typeof setTimeout> | undefined;

    return new Promise(async (resolve, reject) => {
      if (!this.device) throw new Error("No device connected");
      if (!this.device.opened) await this.openDeviceWithRetry();

      let responseBuffer = "";
      let collecting = false; // Start collecting only after we see our connectionId

      if (!this.connectionId) {
        collecting = true; // Collect always if no connection id set
      }

      const handler = (event: HIDInputReportEvent) => {
        if (event.reportId === 0) {
          const chunk = decoder.decode(new Uint8Array(event.data.buffer))
          responseBuffer += chunk;

          // Only start collecting once we see the connection id
          if (!collecting) {
            const marker = this.connectionId + " ";
            const idx = responseBuffer.indexOf(marker);
            if (idx !== -1) {
              // Trim everything up to and including the connection id
              responseBuffer = responseBuffer.slice(idx + marker.length);
              collecting = true;
            } else {
              // Haven’t seen our connectionId yet, ignore this chunk
              responseBuffer = "";
              return;
            }
          }

          // Check for double newline
          if (responseBuffer.includes("\n\n")) {
            this.device?.removeEventListener("inputreport", handler);

            // trim responceBuffer
            responseBuffer = responseBuffer.split("\n\n")[0];
           responseBuffer = responseBuffer.replace(/^\x00+/, ''); // Strip null characters
            resolve(responseBuffer);
            clearTimeout(timer);
            this.device?.removeEventListener("inputreport", handler);
          }
        }
      };

      this.device.addEventListener("inputreport", handler);

      const splitCommandBytes = splitUint8Array(commandBytes, 63 - headerBytes.length);

      for (const commandBytesChunk of splitCommandBytes) {
        const fullPacket = new Uint8Array(63);
        fullPacket.set(headerBytes, 0);
        fullPacket.set(commandBytesChunk, headerBytes.length);

        this.device.sendReport(0, fullPacket).catch((err) => {
          this.device?.removeEventListener("inputreport", handler);
          reject(err);
        });
      }

      if (timeout && timeout > 0) {
        timer = setTimeout(() => {
          this.device?.removeEventListener("inputreport", handler);
          reject(new Error("Command timed out"));
        }, timeout);
      }
    });
  }
  async getConnectionId(){
    const helloOutput = await this.sendCommand("hello");
    const id = helloOutput.slice(0, 3);
    if (!id.match(/^c\d\d$/)) {
      console.warn("Error getting connection ID. Output from hello command:", helloOutput);
      return null;
    }

    this.connectionId = id;
    return id;
  }

  // -----------------------
  // Typed event API (for IDE autocomplete)
  // -----------------------
  private enabledEvents: string[] = []
  on<K extends keyof JavEventMap>(
    eventType: K,
    listener: (ev: CustomEvent<JavEventMap[K]>) => void,
    options?: boolean | AddEventListenerOptions
  ) {

    // Enable event in Javelin if needed
    if (JAVELIN_EVENT_NAMES.includes(eventType)) {
      if (!this.enabledEvents.includes(eventType)) {
        this.enabledEvents.push(eventType);
      }
      if (this.connected) {
        this.sendCommand(`enable_events ${eventType}`).catch(err => {
          console.warn(`Failed to enable event ${eventType}:`, err);
        });
      }
    }

    // Register event listener
    super.addEventListener(eventType as string, listener as EventListener, options);
  }

  off<K extends keyof JavEventMap>(
    type: K,
    listener: (ev: CustomEvent<JavEventMap[K]>) => void,
    options?: boolean | EventListenerOptions
  ) {
    super.removeEventListener(type as string, listener as EventListener, options);
  }

  protected emit<K extends keyof JavEventMap>(
    type: K,
    detail: JavEventMap[K]
  ) {
    this.dispatchEvent(new CustomEvent(type as string, { detail }));
  }

  /**
   * Checks for previously authorized HID devices that match the specified filters
   * and automatically selects one if exactly one matches.
  */
  async checkForConnections() {
    const devices = await navigator.hid.getDevices();

    // Filter to devices that match usagePage
    const matchingDevices = devices.filter((d) =>
      d.collections.some((c) =>
        options.filters.some(
          (f) => c.usagePage === f.usagePage && (!f.usage || c.usage === f.usage)
        )
      )
    );
  
    if (matchingDevices.length == 1) {
      this.device = matchingDevices[0]
      await this.setupDevice();
      this.connected = true;
      this.emit("connected", this.device)
    }
  }

  // Event listening
  private eventDecoder = new TextDecoder();
  private eventBuffer = "";

  // Call once after device is connected/opened
  private startEventListener() {
    if (!this.device) return;

    const handler = (event: HIDInputReportEvent) => {
      if (event.reportId !== 0) return;

      const chunk = this.eventDecoder.decode(new Uint8Array(event.data.buffer));
      this.eventBuffer += chunk;

      // Split into complete lines
      const lines = this.eventBuffer.split("\n");
      this.eventBuffer = lines.pop() ?? ""; // save incomplete tail
      for (const rawLine of lines) {
        const line = rawLine.replace(/^\x00+/, ''); // This caused so much debugging
        if (line.startsWith("EV ")) {
          const jsonPart = line.slice(3).trim();
          try {
            const ev = JSON.parse(jsonPart);

            const decoded = decodeJavEvent(ev);
            if (decoded) {
              this.emit(decoded.event, decoded.detail);
            } else {
              console.warn("Failed to parse EV JSON:", ev);
            }

          } catch (err) {
            console.warn("Failed to parse EV JSON:", jsonPart, err);
          }
        }
      }
    };

    this.device.addEventListener("inputreport", handler);
  }

  private async openDeviceWithRetry(retryInterval = 100): Promise<void> {
    if (!this.device) return;

    while (!this.device.opened) {
      try {
        await this.device.open();
        // Successfully opened, exit the loop
        break;
      } catch (err: unknown) {
        const e = err as DOMException;
        if (e.name === "InvalidStateError") {
          // Device is busy, wait a bit and retry
          await new Promise((resolve) => setTimeout(resolve, retryInterval));
        } else {
          // Other errors should propagate
          throw e;
        }
      }
    }
  }

  private async setupDevice(){
    // Open device if not opened
    await this.openDeviceWithRetry();

    if (!this.connectionId){
      await this.getConnectionId();
    }
    
    // Enable events
    this.startEventListener();

    if (this.enabledEvents.length > 0) {
      this.sendCommand(`enable_events ${this.enabledEvents.join(" ")}`).catch(err => {
        console.warn("Failed enabling events:", err);
      });
    }
  }

}

function splitUint8Array(array: Uint8Array, chunkSize: number) {
  const chunks = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
}
