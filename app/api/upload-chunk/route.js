import { NextResponse } from "next/server";
import { writeFile, readFile, unlink } from 'fs/promises';
import path from 'path';
import { tmpdir } from 'os';

export async function POST(request) {
  try {
    const formData = await request.formData();
    const chunk = formData.get('chunk');
    const chunkIndex = parseInt(formData.get('chunkIndex'));
    const totalChunks = parseInt(formData.get('totalChunks'));
    const fileName = formData.get('fileName');
    const fileId = formData.get('fileId');

    if (!chunk || chunkIndex === undefined || totalChunks === undefined || !fileName || !fileId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Create temp directory path
    const tempDir = tmpdir();
    const chunkPath = path.join(tempDir, `${fileId}_chunk_${chunkIndex}`);

    // Save chunk to temp file
    const buffer = Buffer.from(await chunk.arrayBuffer());
    await writeFile(chunkPath, buffer);

    // Check if all chunks are uploaded
    const uploadedChunks = [];
    for (let i = 0; i < totalChunks; i++) {
      const chunkFile = path.join(tempDir, `${fileId}_chunk_${i}`);
      try {
        await readFile(chunkFile);
        uploadedChunks.push(i);
      } catch {
        // Chunk not found
      }
    }

    // If all chunks are uploaded, combine them
    if (uploadedChunks.length === totalChunks) {
      const finalBuffer = Buffer.alloc(0);
      const chunks = [];
      
      for (let i = 0; i < totalChunks; i++) {
        const chunkFile = path.join(tempDir, `${fileId}_chunk_${i}`);
        const chunkData = await readFile(chunkFile);
        chunks.push(chunkData);
      }
      
      const combinedBuffer = Buffer.concat(chunks);
      
      // Clean up chunk files
      for (let i = 0; i < totalChunks; i++) {
        const chunkFile = path.join(tempDir, `${fileId}_chunk_${i}`);
        try {
          await unlink(chunkFile);
        } catch {
          // Ignore cleanup errors
        }
      }

      return NextResponse.json({ 
        complete: true, 
        fileId,
        fileSize: combinedBuffer.length,
        buffer: combinedBuffer.toString('base64')
      });
    }

    return NextResponse.json({ 
      complete: false, 
      uploadedChunks: uploadedChunks.length,
      totalChunks 
    });

  } catch (error) {
    console.error('Chunk upload error:', error);
    return NextResponse.json({ error: 'Failed to process chunk' }, { status: 500 });
  }
} 