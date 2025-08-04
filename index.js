addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  // Configuration
  const BASEROW_TOKEN = 'kN7gNkHeBtstfqGbCfSmdYjzZmaGK9rS';
  const TABLE_ID = '540983';
  
  const url = new URL(request.url);
  const rowId = url.searchParams.get('row_id');
  const debug = url.searchParams.has('debug');

  // 1. Initial Request Handling
  if (!rowId) {
    return new Response(`
      <html>
        <body>
          <h1>Missing row_id</h1>
          <p>Add ?row_id=YOUR_ROW_ID to the URL to view files</p>
          <p>Example: ${url.origin}/?row_id=1</p>
        </body>
      </html>
    `, {
      headers: { 'Content-Type': 'text/html' }
    });
  }

  try {
    // 2. Fetch row data
    const rowUrl = `https://api.baserow.io/api/database/rows/table/${TABLE_ID}/${rowId}/?user_field_names=true`;
    const rowResponse = await fetch(rowUrl, {
      headers: {
        'Authorization': `Token ${BASEROW_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    if (!rowResponse.ok) {
      return new Response(`Failed to fetch row data: ${await rowResponse.text()}`, {
        status: rowResponse.status
      });
    }

    const rowData = await rowResponse.json();
    const files = rowData.file || [];
    
    if (debug) {
      return new Response(JSON.stringify(rowData, null, 2), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (files.length === 0) {
      return new Response('No files found in this row', { status: 404 });
    }

    // 3. Display files as clickable links
    const html = `
      <html>
        <head>
          <title>Files in Row ${rowId}</title>
          <style>
            body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
            h1 { color: #333; }
            ul { list-style: none; padding: 0; }
            li { margin: 10px 0; padding: 10px; background: #f5f5f5; border-radius: 4px; }
            a { color: #0066cc; text-decoration: none; font-weight: bold; }
            a:hover { text-decoration: underline; }
            .file-icon { margin-right: 8px; }
            .pdf { color: #e74c3c; }
            .image { color: #3498db; }
            .other { color: #9b59b6; }
          </style>
        </head>
        <body>
          <h1>Files in Row ${rowId}</h1>
          <ul>
            ${files.map(file => `
              <li>
                <a href="${file.url}" target="_blank">
                  <span class="file-icon ${
                    file.is_image ? 'image' : 
                    file.mime_type === 'application/pdf' ? 'pdf' : 'other'
                  }">
                    ${file.is_image ? '🖼️' : 
                     file.mime_type === 'application/pdf' ? '📄' : '📁'}
                  </span>
                  ${file.visible_name} (${(file.size / 1024).toFixed(1)} KB)
                </a>
              </li>
            `).join('')}
          </ul>
        </body>
      </html>
    `;

    return new Response(html, {
      headers: { 'Content-Type': 'text/html' }
    });

  } catch (error) {
    return new Response(`Error: ${error.message}`, { status: 500 });
  }
}
