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
  const downloadMode = url.searchParams.get('download');
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

    // If in download mode and specific file index is requested
    if (downloadMode && fileIndex >= 0 && fileIndex < files.length) {
      const file = files[fileIndex];
      const fileResponse = await fetch(file.url);
      
      if (!fileResponse.ok) {
        return new Response(`Failed to fetch file: ${await fileResponse.text()}`, {
          status: fileResponse.status
        });
      }

      // Create response with download headers
      const response = new Response(fileResponse.body, {
        headers: {
          'Content-Type': file.mime_type,
          'Content-Disposition': `attachment; filename="${file.visible_name}"`,
          'Content-Length': file.size.toString()
        }
      });
      
      return response;
    }

    // Show download page with JavaScript to sequence downloads
    const html = `
      <html>
        <head>
          <title>Downloading Files</title>
          <script>
            const files = ${JSON.stringify(files)};
            let currentIndex = 0;
            
            function downloadNext() {
              if (currentIndex >= files.length) {
                document.getElementById('status').innerHTML = 
                  'All downloads completed!';
                return;
              }
              
              const file = files[currentIndex];
              document.getElementById('status').innerHTML = 
                'Downloading file ' + (currentIndex + 1) + ' of ' + files.length + 
                ': ' + file.visible_name;
              
              // Create hidden iframe to trigger download
              const iframe = document.createElement('iframe');
              iframe.style.display = 'none';
              iframe.src = '/?row_id=${rowId}&file_index=' + currentIndex + '&download=true';
              document.body.appendChild(iframe);
              
              // Wait a bit before next download to avoid browser blocking
              currentIndex++;
              setTimeout(downloadNext, 1500);
            }
            
            // Start downloads when page loads
            window.onload = function() {
              // First show the files to be downloaded
              const fileList = document.getElementById('file-list');
              files.forEach((file, index) => {
                const li = document.createElement('li');
                li.textContent = file.visible_name + ' (' + 
                  Math.round(file.size/1024) + ' KB)';
                fileList.appendChild(li);
              });
              
              // Then start downloads after short delay
              setTimeout(downloadNext, 1000);
            };
          </script>
          <style>
            body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
            h1 { color: #333; }
            #status { font-weight: bold; margin: 20px 0; padding: 10px; background: #f0f0f0; }
            #file-list { list-style: none; padding: 0; }
            #file-list li { padding: 8px; border-bottom: 1px solid #eee; }
          </style>
        </head>
        <body>
          <h1>Downloading ${files.length} File(s)</h1>
          <div id="status">Preparing downloads...</div>
          <h3>Files to be downloaded:</h3>
          <ul id="file-list"></ul>
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
