
// CRC32 Table generation for PNG checksums
const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
        if (c & 1) c = 0xedb88320 ^ (c >>> 1);
        else c = c >>> 1;
    }
    crcTable[n] = c;
}

function crc32(buf: Uint8Array): number {
    let crc = 0xffffffff;
    for (let i = 0; i < buf.length; i++) {
        crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
    }
    return crc ^ 0xffffffff;
}

/**
 * Encodes string to Uint8Array (UTF-8)
 */
function stringToBytes(str: string): Uint8Array {
    return new TextEncoder().encode(str);
}

/**
 * Creates a PNG tEXt chunk
 * Format: Length(4) + "tEXt"(4) + Keyword + Null + Text + CRC(4)
 */
function createTextChunk(keyword: string, text: string): Uint8Array {
    const keywordBytes = stringToBytes(keyword);
    const textBytes = stringToBytes(text);
    const typeBytes = stringToBytes("tEXt");
    
    // Data = Keyword + Null Separator + Text
    const dataLen = keywordBytes.length + 1 + textBytes.length;
    const data = new Uint8Array(dataLen);
    
    data.set(keywordBytes, 0);
    data[keywordBytes.length] = 0; // Null separator
    data.set(textBytes, keywordBytes.length + 1);

    // Full chunk length: 4 (Length) + 4 (Type) + DataLen + 4 (CRC)
    const chunk = new Uint8Array(4 + 4 + dataLen + 4);
    const view = new DataView(chunk.buffer);

    // 1. Length
    view.setUint32(0, dataLen, false); // Big Endian

    // 2. Type
    chunk.set(typeBytes, 4);

    // 3. Data
    chunk.set(data, 8);

    // 4. CRC (Calculated over Type + Data)
    const crcSource = new Uint8Array(4 + dataLen);
    crcSource.set(typeBytes, 0);
    crcSource.set(data, 4);
    const crcVal = crc32(crcSource);
    
    view.setUint32(8 + dataLen, crcVal, false);

    return chunk;
}

export interface PngMetadata {
    [key: string]: string;
}

/**
 * Injects tEXt chunks into a PNG Blob.
 * Inserts them right after the IHDR chunk.
 */
export const addMetadataToPng = async (blob: Blob, metadata: PngMetadata): Promise<Blob> => {
    const arrayBuffer = await blob.arrayBuffer();
    const originalBytes = new Uint8Array(arrayBuffer);

    // Check PNG signature: 89 50 4E 47 0D 0A 1A 0A
    if (originalBytes[0] !== 0x89 || originalBytes[1] !== 0x50) {
        console.warn("Not a valid PNG, skipping metadata injection.");
        return blob;
    }

    // Find end of IHDR chunk.
    // Signature (8) + Length(4) + "IHDR"(4) + Data(13) + CRC(4) = 33 bytes usually
    // But let's read length dynamically to be safe.
    // Signature is 8 bytes. IHDR starts at 8.
    // IHDR Length is at index 8 (4 bytes).
    const view = new DataView(arrayBuffer);
    const ihdrLength = view.getUint32(8, false);
    const ihdrEndIndex = 8 + 4 + 4 + ihdrLength + 4; // 33 for standard IHDR

    // Create chunks
    const chunks: Uint8Array[] = [];
    
    // Add standard keys mapped to PNG tEXt keywords
    // Keywords must be 1-79 chars, Latin-1.
    // Common keys: Title, Author, Description, Copyright, Creation Time, Software, Source
    
    Object.entries(metadata).forEach(([key, value]) => {
        if (value) {
            chunks.push(createTextChunk(key, value));
        }
    });

    // Construct new file
    // Part 1: Signature + IHDR
    const part1 = originalBytes.slice(0, ihdrEndIndex);
    // Part 2: New Chunks
    // Part 3: Rest of file (IDAT, IEND, etc)
    const part3 = originalBytes.slice(ihdrEndIndex);

    const totalLength = part1.length + chunks.reduce((acc, c) => acc + c.length, 0) + part3.length;
    const finalBytes = new Uint8Array(totalLength);

    let offset = 0;
    
    finalBytes.set(part1, offset);
    offset += part1.length;

    chunks.forEach(chunk => {
        finalBytes.set(chunk, offset);
        offset += chunk.length;
    });

    finalBytes.set(part3, offset);

    return new Blob([finalBytes], { type: 'image/png' });
};
