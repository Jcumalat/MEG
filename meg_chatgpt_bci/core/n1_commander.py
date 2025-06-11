import socket
import struct
import logging

logger = logging.getLogger(__name__)

class N1Commander:
    def __init__(self, host: str = "192.168.0.10", command_port: int = 8092, timeout: float = 5.0):
        self.host = host
        self.command_port = command_port
        self.timeout = timeout
        self.socket = None

    def connect(self):
        """Establishes a TCP connection to the N1 command port."""
        if self.socket:
            self.disconnect()
        try:
            self.socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            self.socket.settimeout(self.timeout)
            self.socket.connect((self.host, self.command_port))
            logger.info(f"Connected to N1 command port {self.host}:{self.command_port}")
            return True
        except Exception as e:
            logger.error(f"Failed to connect to N1 command port: {e}")
            self.socket = None
            return False

    def disconnect(self):
        """Closes the TCP connection."""
        if self.socket:
            self.socket.close()
            self.socket = None
            logger.info("Disconnected from N1 command port.")

    def send_command(self, component: str, command: str, param1: str = "", param2: str = "") -> bool:
        """
        Sends a command to the N1 system.
        Command format: Component|Command|Parameter1|Parameter2
        """
        if not self.socket:
            logger.warning("Not connected to N1 command port. Attempting to reconnect...")
            if not self.connect():
                return False

        payload_str = f"{component}|{command}"
        if param1:
            payload_str += f"|{param1}"
        if param2:
            payload_str += f"|{param2}"

        payload_bytes = payload_str.encode('utf-8')
        payload_size = len(payload_bytes)

        # Frame structure: uint32_t Payload_Size | Payload
        # Use little-endian for uint32_t (FastAPI uses struct.unpack('<I', ...))
        header = struct.pack('<I', payload_size)
        full_command = header + payload_bytes

        try:
            self.socket.sendall(full_command)
            logger.info(f"Sent command: {payload_str} (Size: {payload_size} bytes)")
            # The PDF doesn't specify a response on this port, so we assume success if no error
            return True
        except Exception as e:
            logger.error(f"Error sending command '{payload_str}': {e}")
            self.disconnect() # Disconnect on error to force reconnect
            return False

# Example usage (for testing, not part of the class itself)
if __name__ == "__main__":
    commander = N1Commander()
    if commander.connect():
        # Example: Activate Sensor 1
        commander.send_command("Sensor", "Activate Sensor", "1")
        # Example: Set DAQ Frequency to 750 Hz
        commander.send_command("DAQ", "Set Frequency", "750 Hz")
        commander.disconnect()
    else:
        print("Could not connect to N1 command port.")
