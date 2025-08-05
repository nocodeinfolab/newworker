addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  // Configuration
  const BASEROW_TOKEN = 'kN7gNkHeBtstfqGbCfSmdYjzZmaGK9rS';
  const TABLE_ID = '540983';
  
  const url = new URL(request.url);
  const rowId = url.searchParams.get('row_id');
  const fileIndex = parseInt(url.searchParams.get('file_index')) || 0;
  const debug = url.searchParams.has('debug');

  // 1. Initial Request Handling
  if (!rowId) {
    return new Response(`
      <html>
        <body>
          <h1>Missing row_id</h1>
          <p>Add ?row_id=YOUR_ROW_ID to the URL to download files</p>
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

    // If specific file index is requested, download that file
    if (fileIndex >= 0 && fileIndex < files.length) {
      const file = files[fileIndex];
      const fileResponse = await fetch(file.url);
      
      if (!fileResponse.ok) {
        return new Response(`Failed to fetch file: ${await fileResponse.text()}`, {
          status: fileResponse.status
        });
      }

      // Create a new response with the file data and download headers
      const response = new Response(fileResponse.body, {
        headers: {
          'Content-Type': file.mime_type,
          'Content-Disposition': `attachment; filename="${file.visible_name}"`,
          'Content-Length': file.size.toString()
        }
      });

      // If there are more files, return HTML that auto-requests the next file
      if (fileIndex < files.length - 1) {
        const nextIndex = fileIndex + 1;
        const html = `
          <html>
            <head>
              <meta http-equiv="refresh" content="0;url=/?row_id=${rowId}&file_index=${nextIndex}">
            </head>
            <body>
              <p>Downloading files... (${fileIndex + 1} of ${files.length})</p>
              <script>
                // Ensure the download starts
                window.location.href = '/?row_id=${rowId}&file_index=${fileIndex}';
              </script>
            </body>
          </html>
        `;
        
        // First return the file download
        // Then the browser will follow the redirect to the next file
        return new Response(html, {
          headers: { 'Content-Type': 'text/html' }
        });
      }
      
      return response;
    }

    // Start the download chain with the first file
    return Response.redirect(`${url.origin}/?row_id=${rowId}&file_index=0`, 302);

  } catch (error) {
    return new Response(`Error: ${error.message}`, { status: 500 });
  }
}
