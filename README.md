# Javelin web tools

This repo contains third party web tools for [Javelin](https://lim.au/#/software/javelin-steno)

You can use the official web tools [here](https://lim.au/#/software/javelin-steno-tools)

# Table of Contents

- [Development](#Running-dev-server)
- [Creating your own web tool](#creating-your-own-web-tool)
- [Documentation](#documentation)

# Running dev server

Install all dependencies
```bash
npm i
```

```bash
npm run dev
```

Open [http://localhost:3000/javelin-webtools](http://localhost:3000/javelin-webtools) with your browser to see the result.

# Creating your own web tool

1. Duplicate the example in `tools/example`
2. Rename the tool
3. Edit `tool/<your-tool-name>/metadata.json`.
4. It should automatically be added to the tool list
5. Modify `tool/<your-tool-name>/page.tsx` to your liking

# Documentation

## Components

### Connect button

Renders a button that attempts to connect to a Javelin HID device when clicked.
Displays a loading state while a connection attempt is in progress and disables
the button to prevent duplicate connection requests.

* hid - The Javelin HID device instance to connect to.
    * Type: {JavelinHidDevice | null}
* [onConnected] - Optional callback fired when device connected via connect button
    * Type: {(device: HIDDevice | null) => void}
* [className] - Optional additional CSS classes to style the button

Example:
```tsx
import ConnectButton from "@/components/ConnectButton";

 <ConnectButton
   hid={hid}
   onConnected={(device) => console.log("Connected to:", device?.productName)}
   className="bg-blue-500"
 />
```

### Connection Status

Displays and reports the current connection status of a Javelin HID device.

 * hid - Javelin HID device instance to monitor.
    * Type: {JavelinHidDevice | null} 
 * [onStatusChange] - Optional callback fired only when the connection status changes (connect or disconnect).
    * Type: {(connected: boolean) => void}
 * [connectedText="Connected to {deviceName}"] - Custom text shown when connected.
    * Type: {string} 
    * Supports `{deviceName}` placeholder.
 * [disconnectedText="Not connected"] - Custom text shown when disconnected.
    * Type: {string} 

Example:
 ```tsx
import ConnectionStatus from "@/components/connectionStatus";


<ConnectionStatus
  hid={hid}
  connectedText="Connected to {deviceName}"
  disconnectedText="Not connected"
  onStatusChange={(isConnected) => console.log(isConnected)}
 />

 <ConnectionStatus hid={hid} />
```

## Events

### connected

ev.detail type: [HIDDevice](https://developer.mozilla.org/en-US/docs/Web/API/HIDDevice)

```tsx
hid.on("connected", (ev)=> {
  console.log("device:", ev.detail)
  console.log("device name:", ev.detail.productName)
})
```

### disconnected

ev.detail type: [HIDDevice](https://developer.mozilla.org/en-US/docs/Web/API/HIDDevice)

```tsx
hid.on("disconnected", (ev)=> {
  console.log("device:", ev.detail)
  console.log("device name:", ev.detail.productName)
})
```

### button_state

This happens when a user presses a key only if it is enabled in the layout


ev.detail type: JavButtonStateEventDetail 
```ts
interface JavButtonStateEventDetail {
  /** Array of booleans, first element = first key, etc. */
  keys: boolean[];
  /** Raw event data */
  raw: string;
}
  ```

Example:
```tsx
//                          Specifying the type is optional
hid.on("button_state", (ev: CustomEvent<JavButtonStateEventDetail>) => {
  const { keys, raw } = ev.detail;

  console.log("Raw event data:", raw);
  console.log("Button states:", keys);

  // Example: interpret pressed buttons
  keys.forEach((isPressed, index) => {
    if (isPressed) {
      console.log(`Button ${index} is pressed`);
    }
  });

  // Optional: handle specific key combinations
  if (keys[0] && keys[1]) {
    console.log("First two buttons are pressed together!");
  }
});
```

Raw event data documentation:
```jsonc
  {
    /** Event code for button_state */
    "e":"b",
    /**
    * Raw button state data encoded in base64 where each bit is a key 
    * The first bit maps to the first key, second to second key, etc
    */
    "d":"AAAAAAAAAAA="
  }
```

### dictionary_status

This happens when a dictionary is enable or disabled

ev.detail type: JavDictStatusEventDetail
```ts
interface JavDictStatusEventDetail {
  /** The name of the dictionary that changed */
  dictionary: string;
  /** The new state of the dictionary */
  enabled: boolean;
  /** Raw event data */
  raw: string;
}
```

Example:

```tsx
//                                  Specifying the type is optional
device.on("dictionary_status", (ev: CustomEvent<JavDictStatusEventDetail>) => {
  console.log(
    `Dictionary status for ${ev.detail.dictionary} is ${ev.detail.enabled.toString()}`
  );
});
```

Raw event data documentation:
```jsonc
{
  /** Event code for dictionary_status */
  "e":"d",
  /** Name of the dictionary */
  "d":"user.json",
  /** Status of the dictionary. 0 is disabled and 1 is enabled. */
  "v":0
}
```

### paper_tape

Fired each time a stroke is entered on the keyboard.

ev.detail type: JavDictStatusEventDetail
```ts
interface JavPaperTapeEventDetail {
  outline: string ;
  dictionary: string;
  translation: string;
  /** Raw event data */
  raw: string;
}
```

TODO example

Raw event documentation:
```jsonc
{
  /** Event code for dictionary_status */
  "e":"p",
  /** Dictionary outline */
  "o":"TH",
  /** Dictionary */
  "d":"main.json",
  /** Translation */
  "t":"this"
}
```

### script
Events from Javelin script

This could be a layer change event, but could also be any event triggered by the script
```jsonc
  {"text":"layer_id: 87377230", "raw": ...}
```
```jsonc
  {"text":"Any text could go here", "raw": ...}
```

ev.detail type: JavScriptEventDetail
```ts
interface JavScriptEventDetail {
  text: string
  /** Raw event data */
  raw: string;
}
```

TODO example

Raw event documentation:
```jsonc
{
  /** Event code for script event */
  "e":"c",
  /** Text given by the script */
  "t":"layer_id: 87377230"
}
```

### serial
This only exists if the keyboard has BLE(Bluetooth), I am unsure if it only works over bluetooth or works over usb too, TODO check

This is used in the web tools for the serial bridge

It outputs the raw serial data.

ev.detail type: JavSerialEventDetail
```ts
interface JavSerialEventDetail {
  /** base64 encoded data based on the steno protocol used */
  data: string;
  /** Raw event data */
  raw: string;
}
```

TODO example

Raw event docunmentation:
```jsonc
{
  /** Event code for serial event */
  "e":"l",
  "d":"BAA="
}
```

### suggestion

Fired when the keyboard identifies a more efficient outline for a given translation.

ev.detail type: JavSuggestionEventDetail
```ts
interface JavSuggestionEventDetail {
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
```

TODO example

Raw event documentation:
```jsonc
{
  /** Event code for sugguestion event */
  "e":"s",
  /** How many strokes the suggestion covers*/
  "c":2,
  /** Translation */
  "t":"this is",
  /** Outlines */
  "o":["TH-S","STKHE","STKH-B"]
}
```

### template_value

Fired when a template value changes

ev.detail type: JavTemplateValueEventDetail
```ts
interface JavTemplateValueEventDetail {
  /** The index of template value changed */
  index: number;
  /** The new value of the template value */
  value: string;
  /** Raw event data */
  raw: string;
}
```

TODO example

Raw event documentation:
```jsonc
{
  /** Event code for template value event */
  "e":"v",
  /** Index of template value that changed */
  "i":0,
  /** New value of template value */
  "v":"test"}
```

### text
The output in text for steno, this is used in the writing speed tool

ev.detail type: JavTextEventDetail
```ts
interface JavTextEventDetail {
  event: "text";
  text: string;
  /** Raw event data */
  raw: string;
}
```

TODO example

TODO raw event docs

```jsonc
{
  /** Event code for template value event */
  "e":"t",
  /** The text */
  "t":" Test"
}
```

### analog_data
Provides analog data for sliders.
This currently is only used on [Jeff's personal device](https://discord.com/channels/136953735426473984/1034560725047316530/1413829434770722936)
Each event reports the current positions of the sliders on the device.


ev.detail type: JavTextEventDetail
```ts
interface JavAnalogDataEventDetail {
  /** Raw event data */
  raw: string;
}
```

### Raw event code to event name

This map converts internal event codes (`e`) to human-readable event names.
Useful if you're parsing raw event packets manually

```ts
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
```