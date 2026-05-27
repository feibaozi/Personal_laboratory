import mammoth from 'mammoth';

export type SupportedFileType = 'md' | 'txt' | 'pdf' | 'docx';

export function detectFileType(filename: string): SupportedFileType {
  const ext = filename.toLowerCase().split('.').pop() || '';
  switch (ext) {
    case 'md':
    case 'markdown':
      return 'md';
    case 'txt':
      return 'txt';
    case 'pdf':
      return 'pdf';
    case 'docx':
    case 'doc':
      return 'docx';
    default:
      throw new Error(`不支持的文件格式: .${ext}。支持的格式: .md, .txt, .pdf, .docx`);
  }
}

export function detectFileTypeFromBuffer(buffer: Buffer, filename: string): SupportedFileType {
  // Check magic bytes for PDF
  if (buffer.length > 4 && buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46) {
    return 'pdf';
  }
  // Check for DOCX (ZIP-based, starts with PK)
  if (buffer.length > 4 && buffer[0] === 0x50 && buffer[1] === 0x4b) {
    return 'docx';
  }
  return detectFileType(filename);
}

export async function parseFile(
  buffer: Buffer,
  filename: string
): Promise<{ content: string; fileType: SupportedFileType }> {
  const fileType = detectFileTypeFromBuffer(buffer, filename);

  switch (fileType) {
    case 'md':
    case 'txt':
      return { content: buffer.toString('utf-8'), fileType };

    case 'pdf': {
      const pdfParse = (await import('pdf-parse')).default;
      const result = await pdfParse(buffer);
      return { content: result.text, fileType: 'pdf' };
    }

    case 'docx': {
      const result = await mammoth.extractRawText({ buffer });
      return { content: result.value, fileType: 'docx' };
    }

    default:
      throw new Error(`不支持的文件格式: ${filename}`);
  }
}
