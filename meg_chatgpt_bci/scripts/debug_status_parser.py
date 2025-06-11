import socket
import struct
import time
import sys

HOST = "192.168.0.10"
PORT = 8090
TIMEOUT = 10.0 # seconds
NUM_FRAMES_TO_CAPTURE = 5 # Changed back to 5 to capture multiple frames

# Frame structure constants for Sensor Status Data (from PDF)
FRAME_START_MARKER = b'KCLB' # Direct byte representation
PAYLOAD_END_MARKER = b'DNEB' # Confirmed correct from previous run
FRAME_END_MARKER = b'KCLB' # Corrected based on observed data
HEADER_SIZE = 20 # uint32_t Frame_Start | uint32_t Frame_Number | uint32_t Payload_Size | uint32_t Number_of_Sensors | uint32_t Total_Bytes
FOOTER_SIZE = 12 # Payload_End | Checksum | Frame_End (BLCK)
EXPECTED_TOTAL_BYTES = 600 # This is the expected actual payload size for status
EXPECTED_NUM_SENSORS = 64 # Default from PDF

def parse_status_frame(buffer: bytes) -> dict:
    """Parses a single sensor status frame and returns a dictionary of parsed data."""
    # First, ensure enough buffer for header
    if len(buffer) < HEADER_SIZE:
        print(f"Buffer too small for header: {len(buffer)} bytes, need {HEADER_SIZE}")
        return None

    # Peek into header to get actual_payload_size_for_status
    header_values = struct.unpack('<5I', buffer[:HEADER_SIZE])
    frame_start_marker_int_from_header = header_values[0] # This is the integer representation of the first 4 bytes
    frame_number = header_values[1]
    payload_size_from_header_field = header_values[2] # This is the 38400 value (misleading "Payload_Size")
    num_sensors_in_frame = header_values[3] # This is the 64 value (Number_of_Sensors)
    actual_payload_size_for_status = header_values[4] # This is the 600 value (Total_Bytes / Actual Payload Size)

    # IMPORTANT CHANGE: Use payload_size_from_header_field (header_values[2]) for full_frame_size calculation
    full_frame_size = HEADER_SIZE + payload_size_from_header_field + FOOTER_SIZE

    print(f"DEBUG: Calculated full_frame_size (using payload_size_from_header_field): {full_frame_size}")
    print(f"DEBUG: payload_size_from_header_field (header_values[2]): {payload_size_from_header_field}")
    print(f"DEBUG: num_sensors_in_frame (header_values[3]): {num_sensors_in_frame}")
    print(f"DEBUG: actual_payload_size_for_status (header_values[4]): {actual_payload_size_for_status}")


    if len(buffer) < full_frame_size:
        print(f"Buffer too small for full frame: {len(buffer)} bytes, need {full_frame_size}")
        return None

    frame_data = buffer[:full_frame_size]

    try:
        # Validate frame start
        received_frame_start_bytes = frame_data[:4]
        print(f"DEBUG: Received frame start (bytes): {received_frame_start_bytes}, Script FRAME_START (bytes): {FRAME_START_MARKER}")
        if received_frame_start_bytes != FRAME_START_MARKER:
            print(f"Frame start mismatch: {received_frame_start_bytes.hex()} (expected {FRAME_START_MARKER.hex()})")
            return None

        # Validate header values
        if (struct.pack('<I', frame_start_marker_int_from_header) != FRAME_START_MARKER or # Convert back to bytes for comparison
            num_sensors_in_frame != EXPECTED_NUM_SENSORS): # Removed actual_payload_size_for_status validation here
            print(f"Header validation failed: {header_values} (expected KCLB, {EXPECTED_NUM_SENSORS} sensors)")
            return None

        # Extract payload using payload_size_from_header_field
        payload_bytes = frame_data[HEADER_SIZE : HEADER_SIZE + payload_size_from_header_field]

        # Validate footer
        footer_start = HEADER_SIZE + payload_size_from_header_field
        footer_data = frame_data[footer_start : footer_start + FOOTER_SIZE]
        
        if len(footer_data) < FOOTER_SIZE:
            print("Incomplete status footer.")
            return None

        payload_end_marker = footer_data[0:4]
        checksum_bytes = footer_data[4:8] # Added to inspect checksum
        frame_end_marker = footer_data[8:12]

        print(f"DEBUG: Raw footer data (hex): {footer_data.hex()}")
        print(f"DEBUG: Received payload_end_marker: {payload_end_marker.hex()} (expected {PAYLOAD_END_MARKER.hex()})")
        print(f"DEBUG: Received frame_end_marker: {frame_end_marker.hex()} (expected {FRAME_END_MARKER.hex()})")
        print(f"DEBUG: Received checksum_bytes: {checksum_bytes.hex()}")

        # Search for FRAME_END_MARKER from the end of the frame_data
        frame_end_marker_pos = frame_data.rfind(FRAME_END_MARKER)
        print(f"DEBUG: FRAME_END_MARKER ({FRAME_END_MARKER}) found at position: {frame_end_marker_pos} (expected {full_frame_size - 4})")


        if payload_end_marker != PAYLOAD_END_MARKER or frame_end_marker != FRAME_END_MARKER:
            print(f"Footer mismatch: {payload_end_marker.hex()} (expected {PAYLOAD_END_MARKER.hex()}), {frame_end_marker.hex()} (expected {FRAME_END_MARKER.hex()})")
            return None

        # --- Parsing Payload ---
        # Re-enable detailed payload parsing for the 600-byte status data
        # This assumes the 600 bytes are at the beginning of the 38400-byte payload
        status_strings_bytes = payload_bytes[0:300]
        status_strings = status_strings_bytes.decode('utf-8', errors='ignore')
        print(f"\n--- Status Strings (first 300 bytes) ---")
        print(status_strings)

        status_values_bytes = payload_bytes[300:600]
        print(f"\n--- Status Values (last 300 bytes) ---")
        print(f"Raw bytes (hex): {status_values_bytes.hex()}")
        print(f"Length: {len(status_values_bytes)} bytes")

        sensor_statuses = {}
        for i in range(EXPECTED_NUM_SENSORS): # 64 sensors
            offset = i * 4 # Assuming 4 bytes per sensor for ACT, LLS, SLS, FLS
            if offset + 4 <= len(status_values_bytes):
                sensor_data = status_values_bytes[offset : offset + 4]
                act, lls, sls, fls = struct.unpack('<4B', sensor_data)
                sensor_statuses[i] = {
                    'ACT': act,
                    'LLS': lls,
                    'SLS': sls,
                    'FLS': fls
                }
            else:
                print(f"Warning: Not enough bytes for sensor {i} status (expected 4, got {len(status_values_bytes) - offset})")
                break

        print(f"\nAttempted parsing (first 4 uint8_t flags per sensor):")
        for i in range(min(5, EXPECTED_NUM_SENSORS)): # Print first 5 sensors
            print(f"  Sensor {i}: {sensor_statuses.get(i)}")
        
        print(f"\nFirst 20 raw uint8_t values: {struct.unpack('<20B', status_values_bytes[:20])}")
        print(f"\nLast 20 raw uint8_t values: {struct.unpack('<20B', status_values_bytes[-20:])}")

        print(f"\nTotal Payload length (from header field 2): {len(payload_bytes)} bytes")
        print(f"First 20 total payload bytes (hex): {payload_bytes[:20].hex()}")
        print(f"Last 20 total payload bytes (hex): {payload_bytes[-20:].hex()}")


        return {
            "frame_number": frame_number,
            "payload_size_from_header_field": payload_size_from_header_field, # The 38400 value
            "num_sensors": num_sensors_in_frame,
            "actual_payload_size_for_status": actual_payload_size_for_status, # The 600 value
            "status_strings": status_strings,
            "status_values_raw_hex": status_values_bytes.hex(),
            "parsed_sensor_statuses": sensor_statuses
        }

    except Exception as e:
        print(f"Error parsing status frame: {e}")
        return None

def main():
    print(f"Attempting to connect to N1 Sensor Status Port {HOST}:{PORT}")
    sock = None
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(TIMEOUT)
        sock.connect((HOST, PORT))
        print("Successfully connected.")

        buffer = b''
        frames_captured = 0
        start_time = time.time()

        while frames_captured < NUM_FRAMES_TO_CAPTURE and (time.time() - start_time < TIMEOUT * 2):
            try:
                # Increased buffer size to handle potentially larger frames
                chunk = sock.recv(65536) # Receive a reasonable chunk size
                if not chunk:
                    print("No data received, connection closed by peer.")
                    break
                buffer += chunk
                
                # Attempt to parse frames from the buffer
                # Need to handle variable frame size based on header
                
                # First, ensure enough buffer for header
                if len(buffer) < HEADER_SIZE:
                    continue

                # Peek into header to get payload_size_from_header_field (header_peek[2])
                header_peek = struct.unpack('<5I', buffer[:HEADER_SIZE])
                payload_size_from_header_field_peek = header_peek[2] # This is the 38400 value
                full_frame_size = HEADER_SIZE + payload_size_from_header_field_peek + FOOTER_SIZE

                if len(buffer) < full_frame_size:
                    print(f"DEBUG: Current buffer size: {len(buffer)}, Need: {full_frame_size}. Waiting for more data...")
                    continue # Not enough data for full frame yet

                parsed_data = parse_status_frame(buffer)
                if parsed_data:
                    print(f"\n--- Successfully parsed Frame {frames_captured + 1} ---")
                    print(f"Frame Number: {parsed_data['frame_number']}")
                    print(f"Payload Size (from header field 2): {parsed_data['payload_size_from_header_field']}")
                    print(f"Num Sensors (from header field 3): {parsed_data['num_sensors']}")
                    print(f"Actual Payload Size (from header field 4): {parsed_data['actual_payload_size_for_status']}")
                    frames_captured += 1
                    # Remove the parsed frame from the buffer
                    buffer = buffer[full_frame_size:]
                else:
                    # If parsing failed, try to find the next frame start to resync
                    sync_pos = buffer.find(FRAME_START_MARKER, 1) # Use byte representation for find
                    if sync_pos != -1:
                        print(f"Resyncing buffer, discarding {sync_pos} bytes.")
                        buffer = buffer[sync_pos:]
                    else:
                        # No sync found, clear buffer or wait for more data
                        buffer = b'' # Clear buffer if no sync found to prevent infinite loop on bad data
                        break
                    
                if frames_captured >= NUM_FRAMES_TO_CAPTURE:
                    break

            except socket.timeout:
                print("Socket timeout, no data received for a while.")
                break
            except Exception as e:
                print(f"An error occurred during data reception: {e}")
                break

    except Exception as e:
        print(f"Failed to connect or an error occurred: {e}")
    finally:
        if sock:
            sock.close()
            print("Socket closed.")
        print("Debug script finished.")

if __name__ == "__main__":
    main()
