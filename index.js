addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  // Baserow API configuration
  const BASEROW_TOKEN = 'kN7gNkHeBtstfqGbCfSmdYjzZmaGK9rS';
  const TABLE_ID = '540983';
  
  // Parse URL parameters
  const url = new URL(request.url);
  const rowId = url.searchParams.get('row_id');
  const fileIndex = url.searchParams.get('file_index') || 0;
  const debug = url.searchParams.has('debug');

  if (!rowId) {
    return new Response('Please provide a row_id parameter', { status: 400 });
  }

  try {
    // Fetch row data from Baserow
    const rowUrl = `https://api.baserow.io/api/database/rows/table/${TABLE_ID}/${rowId}/?user_field_names=true`;
    const response = await fetch(rowUrl, {
      headers: {
        'Authorization': `Token ${BASEROW_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      return new Response(`Failed to fetch row data: ${response.statusText}`, { 
        status: response.status 
      });
    }

    const rowData = await response.json();
    
    // Debug output if requested
    if (debug) {
      return new Response(JSON.stringify(rowData, null, 2), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Improved file field access - handles different possible field names
    let files = [];
    
    // Try common field names for files
    if (rowData.File && Array.isArray(rowData.File)) {
      files = rowData.File;
    } else if (rowData.file && Array.isArray(rowData.file)) {
      files = rowData.file;
    } else if (rowData.files && Array.isArray(rowData.files)) {
      files = rowData.files;
    } else {
      // Check all fields for arrays that look like file objects
      for (const field in rowData) {
        if (Array.isArray(rowData[field]) && rowData[field].length > 0 && 
            typeof rowData[field][0] === 'object' && rowData[field][0].url) {
          files = rowData[field];
          break;
        }
      }
    }

    if (files.length === 0) {
      return new Response(
        'No files found in this row. Add ?debug=true to see the full response.', 
        { status: 404 }
      );
    }

    // Handle file index selection
    const selectedIndex = parseInt(fileIndex);
    if (selectedIndex >= 0 && selectedIndex < files.length) {
      const file = files[selectedIndex];
      
      // Verify file object structure
      if (!file.url || !file.visible_name) {
        return new Response(
          'File object missing required properties (url or visible_name)',
          { status: 500 }
        );
      }

      const fileResponse = await fetch(file.url, {
        headers: {
          'Authorization': `Token ${BASEROW_TOKEN}`
        }
      });

      if (!fileResponse.ok) {
        return new Response(
          `Failed to fetch file: ${fileResponse.statusText}`, 
          { status: fileResponse.status }
        );
      }

      // Return the file with proper headers
      const fileData = await fileResponse.arrayBuffer();
      return new Response(fileData, {
        headers: {
          'Content-Type': file.mime_type || 'application/octet-stream',
          'Content-Disposition': `attachment; filename="${file.visible_name}"`
        }
      });
    }

    // Multiple files - show selection page
    const selectionPage = `
      <html>
        <head>
          <title>Multiple Files Available</title>
          <style>
            body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
            h1 { color: #333; }
            ul { list-style: none; padding: 0; }
            li { margin: 10px 0; }
            a { display: inline-block; padding: 8px 16px; background: #0066ff; color: white; 
                text-decoration: none; border-radius: 4px; }
            a:hover { background: #0055dd; }
            .debug { margin-top: 30px; padding: 15px; background: #f5f5f5; }
          </style>
        </head>
        <body>
          <h1>Multiple Files Available</h1>
          <p>Please select which file to download:</p>
          <ul>
            ${files.map((file, index) => `
              <li>
                <a href="?row_id=${rowId}&file_index=${index}">
                  Download: ${file.visible_name} (${(file.size / 1024).toFixed(1)} KB)
                </a>
              </li>
            `).join('')}
          </ul>
          <div class="debug">
            <p><a href="?row_id=${rowId}&debug=true">View raw API response</a></p>
          </div>
        </body>
      </html>
    `;

    return new Response(selectionPage, {
      headers: { 'Content-Type': 'text/html' }
    });

  } catch (error) {
    return new Response(
      `An error occurred: ${error.message}\n\nStack: ${error.stack}`,
      { status: 500 }
    );
  }
}
