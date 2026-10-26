// Isolated profile for native UI checks; never touches the user's saved collection.
const {app}=require('electron');
const fs=require('node:fs');
const path=require('node:path');
const profile=path.join(__dirname,'runtime-v7');
fs.mkdirSync(profile,{recursive:true});
app.setPath('userData',profile);
require('../electron/main.cjs');
