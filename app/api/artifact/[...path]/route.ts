import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  try {
    const { path } = params;

    if (!path || path.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Path is required'
      }, { status: 400 });
    }

    // Build the file path within artifacts directory
    const baseDir = join(process.cwd(), 'artifacts');
    const filePath = join(baseDir, ...path);

    // Security check: ensure the path is within artifacts directory
    if (!filePath.startsWith(baseDir)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid path'
      }, { status: 400 });
    }

    // Check if file exists
    if (!existsSync(filePath)) {
      return NextResponse.json({
        success: false,
        error: 'File not found'
      }, { status: 404 });
    }

    // Read the file
    const fileBuffer = await readFile(filePath);

    // Determine content type based on file extension
    const extension = path[path.length - 1].split('.').pop()?.toLowerCase();
    let contentType = 'application/octet-stream';

    switch (extension) {
      case 'png':
        contentType = 'image/png';
        break;
      case 'jpg':
      case 'jpeg':
        contentType = 'image/jpeg';
        break;
      case 'json':
        contentType = 'application/json';
        break;
      case 'html':
        contentType = 'text/html';
        break;
      case 'css':
        contentType = 'text/css';
        break;
      case 'js':
        contentType = 'application/javascript';
        break;
      case 'txt':
        contentType = 'text/plain';
        break;
    }

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600'
      }
    });

  } catch (error) {
    console.error('Error serving artifact:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to serve artifact'
    }, { status: 500 });
  }
}