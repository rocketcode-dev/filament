import { createApp, FrameworkMeta } from '../src/index';

/**
 * Example 5: Content Negotiation and Response Transformation
 * Demonstrates metadata-driven response formatting and content types
 */

interface ContentMeta extends FrameworkMeta {
  formats: ('json' | 'xml' | 'csv' | 'html')[];
  defaultFormat: 'json' | 'xml' | 'csv' | 'html';
  compress: boolean;
  prettyPrint: boolean;
  includeMetadata: boolean;
}

const app = createApp<ContentMeta>({
  formats: ['json'],
  defaultFormat: 'json',
  compress: false,
  prettyPrint: false,
  includeMetadata: false,
});

// Sample data
const books = [
  { id: 1, title: 'The Great Gatsby', author: 'F. Scott Fitzgerald', year: 1925, genre: 'Classic' },
  { id: 2, title: '1984', author: 'George Orwell', year: 1949, genre: 'Dystopian' },
  { id: 3, title: 'To Kill a Mockingbird', author: 'Harper Lee', year: 1960, genre: 'Classic' },
];

// Helper: Convert to XML
function toXML(obj: any, root: string = 'root'): string {
  if (Array.isArray(obj)) {
    return `<${root}>${obj.map((item, i) => toXML(item, 'item')).join('')}</${root}>`;
  }
  
  if (typeof obj === 'object' && obj !== null) {
    return `<${root}>${Object.entries(obj)
      .map(([key, value]) => toXML(value, key))
      .join('')}</${root}>`;
  }
  
  return `<${root}>${obj}</${root}>`;
}

// Helper: Convert to CSV
function toCSV(data: any[]): string {
  if (!data.length) return '';
  
  const headers = Object.keys(data[0]);
  const rows = data.map(item => 
    headers.map(h => JSON.stringify(item[h] ?? '')).join(',')
  );
  
  return [headers.join(','), ...rows].join('\n');
}

// Helper: Convert to HTML table
function toHTML(data: any[], title: string = 'Data'): string {
  if (!data.length) return '<html><body><p>No data</p></body></html>';
  
  const headers = Object.keys(data[0]);
  const rows = data.map(item => 
    `<tr>${headers.map(h => `<td>${item[h]}</td>`).join('')}</tr>`
  ).join('');
  
  return `
<!DOCTYPE html>
<html>
<head>
  <title>${title}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
    th { background-color: #4CAF50; color: white; }
    tr:nth-child(even) { background-color: #f2f2f2; }
  </style>
</head>
<body>
  <h1>${title}</h1>
  <table>
    <thead>
      <tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
</body>
</html>`.trim();
}

// Content negotiation middleware
app.use(async (req, res, next) => {
  const acceptHeader = req.headers.accept?.toString() || '';
  const formatParam = req.query.format as string;
  const supportedFormats = req.endpointMeta.formats;
  
  let requestedFormat = req.endpointMeta.defaultFormat;
  
  // Check query parameter first
  if (formatParam && supportedFormats.includes(formatParam as any)) {
    requestedFormat = formatParam as any;
  } 
  // Then check Accept header
  else if (acceptHeader.includes('application/xml') && supportedFormats.includes('xml')) {
    requestedFormat = 'xml';
  } else if (acceptHeader.includes('text/csv') && supportedFormats.includes('csv')) {
    requestedFormat = 'csv';
  } else if (acceptHeader.includes('text/html') && supportedFormats.includes('html')) {
    requestedFormat = 'html';
  } else if (acceptHeader.includes('application/json') && supportedFormats.includes('json')) {
    requestedFormat = 'json';
  }
  
  // Store format in request
  (req as any).responseFormat = requestedFormat;
  
  await next();
});

// Multi-format endpoints

// Books list - supports all formats
app.get('/books',
  {
    formats: ['json', 'xml', 'csv', 'html'],
    defaultFormat: 'json',
    compress: false,
    prettyPrint: true,
    includeMetadata: true,
  },
  async (req, res) => {
    res.json(books);
  }
);

// Single book - supports JSON and XML
app.get('/books/:id',
  {
    formats: ['json', 'xml'],
    defaultFormat: 'json',
    compress: false,
    prettyPrint: true,
    includeMetadata: true,
  },
  async (req, res) => {
    const book = books.find(b => b.id === parseInt(req.params.id));
    
    if (!book) {
      res.status(404).json({ error: 'Book not found' });
      return;
    }
    
    res.json(book);
  }
);

// Stats endpoint - JSON only, with metadata
app.get('/stats',
  {
    formats: ['json'],
    defaultFormat: 'json',
    compress: true,
    prettyPrint: true,
    includeMetadata: true,
  },
  async (req, res) => {
    const stats = {
      totalBooks: books.length,
      genres: [...new Set(books.map(b => b.genre))],
      yearRange: {
        earliest: Math.min(...books.map(b => b.year)),
        latest: Math.max(...books.map(b => b.year)),
      },
    };
    
    res.json(stats);
  }
);

// Response transformation
app.onTransform(async (req, res) => {
  const format = (req as any).responseFormat;
  const { prettyPrint, includeMetadata } = req.endpointMeta;
  
  if (!res.body) return;
  
  try {
    const data = JSON.parse(res.body as string);
    let transformed: string;
    let contentType: string;
    
    // Wrap with metadata if needed
    const payload = includeMetadata ? {
      data,
      meta: {
        timestamp: new Date().toISOString(),
        format,
        path: req.path,
      },
    } : data;
    
    // Transform based on format
    switch (format) {
      case 'xml':
        transformed = '<?xml version="1.0" encoding="UTF-8"?>\n' + toXML(payload, 'response');
        contentType = 'application/xml';
        break;
        
      case 'csv':
        const csvData = Array.isArray(data) ? data : [data];
        transformed = toCSV(csvData);
        contentType = 'text/csv';
        res.setHeader('Content-Disposition', `attachment; filename="${req.path.replace(/\//g, '_')}.csv"`);
        break;
        
      case 'html':
        const htmlData = Array.isArray(data) ? data : [data];
        const title = req.path.split('/').filter(Boolean).join(' > ');
        transformed = toHTML(htmlData, title || 'Data');
        contentType = 'text/html';
        break;
        
      case 'json':
      default:
        transformed = prettyPrint 
          ? JSON.stringify(payload, null, 2)
          : JSON.stringify(payload);
        contentType = 'application/json';
        break;
    }
    
    res.setHeader('Content-Type', contentType);
    res.body = transformed;
    
  } catch (e) {
    // If transformation fails, leave as-is
    console.error('Transformation error:', e);
  }
});

// Compression simulation (in real app, use actual compression)
app.onTransform(async (req, res) => {
  if (req.endpointMeta.compress && res.body) {
    const originalSize = (res.body as string).length;
    // In real implementation, use zlib or similar
    res.setHeader('Content-Encoding', 'gzip');
    res.setHeader('X-Original-Size', originalSize.toString());
    res.setHeader('X-Compressed-Size', Math.floor(originalSize * 0.7).toString());
  }
});

const PORT = 3005;
app.listen(PORT, () => {
  console.log(`\n🎨 Content negotiation example running on http://localhost:${PORT}`);
  console.log('\nEndpoints:');
  console.log('  GET /books           - List books (JSON, XML, CSV, HTML)');
  console.log('  GET /books/:id       - Single book (JSON, XML)');
  console.log('  GET /stats           - Statistics (JSON only)');
  console.log('\nTry different formats:');
  console.log('  curl http://localhost:3005/books');
  console.log('  curl http://localhost:3005/books?format=xml');
  console.log('  curl http://localhost:3005/books?format=csv');
  console.log('  curl http://localhost:3005/books?format=html');
  console.log('  curl -H "Accept: application/xml" http://localhost:3005/books');
  console.log('  curl -H "Accept: text/csv" http://localhost:3005/books');
  console.log('\nOpen http://localhost:3005/books?format=html in your browser!\n');
});
