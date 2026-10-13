// The emulator lives in its own module: a test importing `session` from the
// setup file itself would get a second copy of it, and a second emulator.
import './emulator';
