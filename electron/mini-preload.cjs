'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('miniZeus', {
  onState:   (cb) => {
    const h = (_, d) => cb(d);
    ipcRenderer.on('mini:state', h);
    return () => ipcRenderer.removeListener('mini:state', h);
  },
  send:      (text) => ipcRenderer.send('mini:send', text),
  focusMain: ()     => ipcRenderer.send('mini:focus-main'),
  hide:      ()     => ipcRenderer.send('mini:hide'),
});
