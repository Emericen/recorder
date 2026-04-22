/* prettier-ignore */
export const SHIFT_KEY_MAP = {
  // shift key mappings are the same across platforms
  "1": "!", "2": "@", "3": "#", "4": "$", "5": "%",
  "6": "^", "7": "&", "8": "*", "9": "(", "0": ")",

  "-": "_", "=": "+", "[": "{", "]": "}", "\\": "|",
  ";": ":", "'": '"', ",": "<", ".": ">", "/": "?", "`": "~",

  a: "A", b: "B", c: "C", d: "D", e: "E", f: "F", g: "G",
  h: "H", i: "I", j: "J", k: "K", l: "L", m: "M", n: "N",
  o: "O", p: "P", q: "Q", r: "R", s: "S", t: "T", u: "U",
  v: "V", w: "W", x: "X", y: "Y", z: "Z"
}

/* prettier-ignore */
export const MACOS_KEYCODE_TO_KEY = {
    // Source: https://eastmanreference.com/complete-list-of-applescript-key-codes
    12: "q", 13: "w", 14: "e", 15: "r", 17: "t", 16: "y", 32: "u", 34: "i", 31: "o", 35: "p",
    0: "a", 1: "s", 2: "d", 3: "f", 5: "g", 4: "h", 38: "j", 40: "k", 37: "l",
    6: "z", 7: "x", 8: "c", 9: "v", 11: "b", 45: "n", 46: "m",
    18: "1", 19: "2", 20: "3", 21: "4", 23: "5", 22: "6", 26: "7", 28: "8", 25: "9", 29: "0",
    50: "`", 27: "-", 24: "=",
    33: "[", 30: "]", 42: "\\", 41: ";", 39: "'", 43: ",", 47: ".", 44: "/",
    36: "return", 48: "tab", 49: "space", 51: "delete", 53: "escape",
    123: "left", 124: "right", 125: "down", 126: "up"
}

export const MACOS_KEY_TO_KEYCODE = Object.fromEntries(
  Object.entries(MACOS_KEYCODE_TO_KEY).map(([keyCode, key]) => [key, keyCode])
)

/* prettier-ignore */
export const WINDOWS_RAWCODE_TO_KEY = {
  // raw codes are hardware-level and layout-independent
  81: "q", 87: "w", 69: "e", 82: "r", 84: "t", 89: "y", 85: "u", 73: "i", 79: "o", 80: "p",
  65: "a", 83: "s", 68: "d", 70: "f", 71: "g", 72: "h", 74: "j", 75: "k", 76: "l",
  90: "z", 88: "x", 67: "c", 86: "v", 66: "b", 78: "n", 77: "m",
  49: "1", 50: "2", 51: "3", 52: "4", 53: "5", 54: "6", 55: "7", 56: "8", 57: "9", 48: "0",
  192: "`", 189: "-", 187: "=",
  219: "[", 221: "]", 220: "\\", 186: ";", 222: "'", 188: ",", 190: ".", 191: "/",
  13: "return", 9: "tab", 32: "space", 8: "backspace", 46: "delete", 27: "escape",
  37: "left", 39: "right", 40: "down", 38: "up"
}

export const WINDOWS_MODIFIER_RAWCODE_TO_KEY = {
  16: "shift",
  17: "control",
  18: "alt",
  91: "command",
  92: "command",
  160: "shift",
  161: "shift",
  162: "control",
  163: "control",
  164: "alt",
  165: "alt"
}

export const KEYCODE_TO_KEY =
  process.platform === "darwin" ? MACOS_KEYCODE_TO_KEY : WINDOWS_RAWCODE_TO_KEY

// Keys that should trigger hotkey when combined with shift (e.g., text selection)
export const ARROW_KEYS = ["left", "right", "up", "down"]

// Keys that should NOT be shift-mapped (remain lowercase)
export const SPECIAL_KEYS = ["space", "return", "tab", "delete", "backspace", "escape", ...ARROW_KEYS]
