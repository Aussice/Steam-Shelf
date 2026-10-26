const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('steamShelf', Object.freeze({
  scan: () => ipcRenderer.invoke('steam:scan'),
  cover: (appid, retry = false) => ipcRenderer.invoke('steam:cover', appid, retry),
  details: (appid, locale) => ipcRenderer.invoke('steam:details', appid, locale),
  model: name => ipcRenderer.invoke('steam:model', name),
  chooseFolder: locale => ipcRenderer.invoke('steam:choose-folder', locale),
  ownedGames: input => ipcRenderer.invoke('steam:owned', input),
  launch: appid => ipcRenderer.invoke('steam:launch', appid),
  store: appid => ipcRenderer.invoke('steam:store', appid),
}));
