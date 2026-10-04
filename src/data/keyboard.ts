export interface KeyDef {
  id: string;
  label: string;
  hid: number;
  w?: number;
  gap?: number;
  special?: boolean;
}

const k = (id: string, label: string, hid: number, w = 1, gap = 0, special = false): KeyDef => ({ id, label, hid, w, gap, special });

export const ROWS: KeyDef[][] = [
  [k("Escape","Esc",41),k("F1","F1",58,1,1.2),k("F2","F2",59),k("F3","F3",60),k("F4","F4",61),k("F5","F5",62,1,0.45),k("F6","F6",63),k("F7","F7",64),k("F8","F8",65),k("F9","F9",66,1,0.45),k("F10","F10",67),k("F11","F11",68),k("F12","F12",69),k("PrintScreen","Print",70,1,0.35),k("ScrollLock","Scrl",71),k("Pause","Pause",72)],
  [k("Backquote","~",53),k("Digit1","1",30),k("Digit2","2",31),k("Digit3","3",32),k("Digit4","4",33),k("Digit5","5",34),k("Digit6","6",35),k("Digit7","7",36),k("Digit8","8",37),k("Digit9","9",38),k("Digit0","0",39),k("Minus","−",45),k("Equal","+",46),k("Backspace","Backspace",42,2),k("Insert","Ins",73,1,0.35),k("Home","Home",74),k("PageUp","PgUp",75)],
  [k("Tab","Tab",43,1.5),k("KeyQ","Q",20),k("KeyW","W",26),k("KeyE","E",8),k("KeyR","R",21),k("KeyT","T",23),k("KeyY","Y",28),k("KeyU","U",24),k("KeyI","I",12),k("KeyO","O",18),k("KeyP","P",19),k("BracketLeft","[",47),k("BracketRight","]",48),k("Backslash","\\",49,1.5),k("Delete","Del",76,1,0.35),k("End","End",77),k("PageDown","PgDn",78)],
  [k("CapsLock","Caps",57,1.75),k("KeyA","A",4),k("KeyS","S",22),k("KeyD","D",7),k("KeyF","F",9),k("KeyG","G",10),k("KeyH","H",11),k("KeyJ","J",13),k("KeyK","K",14),k("KeyL","L",15),k("Semicolon",";",51),k("Quote","'",52),k("Enter","Enter",40,2.25)],
  [k("ShiftLeft","Shift",225,2.25),k("KeyZ","Z",29),k("KeyX","X",27),k("KeyC","C",6),k("KeyV","V",25),k("KeyB","B",5),k("KeyN","N",17),k("KeyM","M",16),k("Comma",",",54),k("Period",".",55),k("Slash","/",56),k("ShiftRight","Shift",229,2.75),k("ArrowUp","↑",82,1,1.35)],
  [k("ControlLeft","Ctrl",224,1.25),k("MetaLeft","◆",227,1.25),k("AltLeft","Alt",226,1.25),k("Space","",44,6.25),k("AltRight","Alt",230,1.25),k("Custom_Fnkey","Fn",0,1.25,0,true),k("Menu","▤",101,1.25),k("ControlRight","Ctrl",228,1.25),k("ArrowLeft","←",80,1,0.35),k("ArrowDown","↓",81),k("ArrowRight","→",79)],
];

export const BUSHIDO_DEFAULT_MATRIX_CODES = [41,53,43,57,100,225,58,30,20,4,29,224,59,31,26,22,27,227,60,32,8,7,6,226,61,33,21,9,25,44,62,34,23,10,5,0,63,35,28,11,17,0,64,36,24,13,16,0,65,37,12,14,54,0,66,38,18,15,55,0,67,39,19,51,56,230,68,45,47,52,229,0,69,46,48,40,82,101,70,42,49,0,79,228,71,73,76,75,0,80,72,74,77,78,0,81];
export const SLOT_BY_HID = new Map<number, number>();
BUSHIDO_DEFAULT_MATRIX_CODES.forEach((hid, slot) => { if (hid !== 0 && !SLOT_BY_HID.has(hid)) SLOT_BY_HID.set(hid, slot); });
export const FN_SLOT = 71;
export const HID_OPTIONS = ROWS.flat().filter((x) => !x.special && x.hid > 0).map((x) => ({ label: x.id.replace(/^Key/, ""), hid: x.hid }));
