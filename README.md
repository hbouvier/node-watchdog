# Watchdog

## A process to easily monitor, start and stop process

### To install node-watchdog
sudo npm install -g node-watchdog

### To install in MacOSX lauchd
sudo watchdog --install

### To start the watchdog 
sudo launchctl load /Library/LaunchDaemons/node-watchdog.plist


### To stop the watchdog 
sudo launchctl unload /Library/LaunchDaemons/node-watchdog.plist

### To check the running processes
Open your browser at http://localhost:8088/

