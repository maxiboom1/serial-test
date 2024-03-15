const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');

class SerialService {
    
    constructor(initialPath) {
        this.isConnected = false;
        this.port = null;
        this.parser = null;
        this.heartbeatInterval = null;
        this.path = initialPath;
        this.reconnectIntervalId = null;
    }

    connect(newPath = undefined) {
        
        // if new setting apply same port - ignore it
        if (this.isConnected && newPath === this.path) { return; }        
        
        if (this.reconnectIntervalId) {
            clearInterval(this.reconnectIntervalId);
            this.reconnectIntervalId = null;
        }

        if(newPath && newPath !== this.path){
            this.cleanup();
            this.path = newPath; 
        }

        try {
            // Open Serial port
            this.port = new SerialPort({ path: this.path, baudRate: 9600 });
            // Pass raw serial data to parser
            this.parser = this.port.pipe(new ReadlineParser());            
            // Setup listener for port errors
            this.port.on('error', this._handlePortError.bind(this));
            // Setup listener for port close/disconnect
            this.port.on('close', () => this._handlePortClose());
            // Setup listener for parsed data
            this.parser.on('data', this._handleDataReceived.bind(this));            

            this.startHeartbeat();
            
        } catch (e) {
            console.error("Serial communication failed: ", e);
            this._attemptReconnect();
        }
    }

    _attemptReconnect() {
        // If already attempting to reconnect, don't start another interval
        if (this.reconnectIntervalId) return;
        console.log('Attempting to reconnect...');
        this.reconnectIntervalId = setInterval(() => {this.connect();}, 5000); 
    }

    startHeartbeat() {
        this.sendHeartBeat();
        if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
        this.heartbeatInterval = setInterval(() => {
            this.sendHeartBeat();
        }, 5000); 
    }

    sendHeartBeat() {
        if (this.port && this.port.isOpen) {
            this.port.write("heartbeat\n", (err) => {
                if (err) {
                    console.log('Error on write: ', err.message);
                } else {
                    console.log('Heartbeat signal sent');
                }
            });
        }
    }

    _handlePortError(err) {
        console.error(err.message);
        this.isConnected = false;
        // Proper cleanup before attempting to reconnect
        this.cleanup();
        // Attempt to reconnect
        this._attemptReconnect();
    }

    _handlePortClose() {
        console.log('Serial port disconnected.');
        this.isConnected = false;
        // Proper cleanup before attempting to reconnect
        this.cleanup();
        // Attempt to reconnect
        this._attemptReconnect();
    }

    _handleDataReceived(data) {
        console.log(data);
        if (data.trim() === "ack") {
            this.isConnected = true;
            console.log('Device connected.');
            // Successfully reconnected, so stop trying to reconnect
            if (this.reconnectIntervalId) {
                clearInterval(this.reconnectIntervalId);
                this.reconnectIntervalId = null;
            }
        }
        if (data.trim() === "tick") {
            console.log('Device fired gpio.');
        }
    }

    cleanup() {
        // Stop heartbeat
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
    
        // Close the port if it's open
        if (this.port && this.port.isOpen) {
            this.port.close((err) => {
                if (err) {
                    console.error(`Failed to close port: ${this.path}`, err.message);
                } else {
                    console.log(`Port ${this.path} closed successfully.`);
                    this.port = null;
                    this.parser = null;
                }
            });
        } else {
            this.port = null;
            this.parser = null;
        }
    }
    
}

// Usage example
const serialService = new SerialService("COM3");
serialService.connect(); 
setTimeout(()=>serialService.connect('COM2'),10000);
setTimeout(()=>serialService.connect('COM3'),16000);