// Point d'entrée de la version bureau (Electron).
// Charge l'application déjà compilée dans `dist/` dans une fenêtre native.
const { app, BrowserWindow, shell } = require('electron')
const path = require('path')

function createWindow() {
  const win = new BrowserWindow({
    width: 480,
    height: 880,
    minWidth: 360,
    minHeight: 560,
    backgroundColor: '#f4f6fb',
    title: 'Coloriage par numéros',
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))

  // Les liens externes s'ouvrent dans le navigateur par défaut.
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })
}

app.whenReady().then(() => {
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
