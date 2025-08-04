addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  // Configuration
  const BASEROW_TOKEN = 'kN7gNkHeBtstfqGbCfSmdYjzZmaGK9rS';
  const TABLE_ID = '540983';
  
  const url = new URL(request.url);
  const rowId = url.searchParams.get('row_id');
  const downloadAll = url.searchParams.has('download_all');
  const debug = url.searchParams.has('debug');

  // 1. Initial Request Handling
  if (!rowId) {
    return new Response(`
      <html>
        <body>
          <h1>Missing row_id</h1>
          <p>Add ?row_id=YOUR_ROW_ID to the URL</p>
          <p>For all files: ?row_id=YOUR_ROW_ID&download_all</p>
        </body>
      </html>
    `, {
      status: 400,
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

    // 3. Handle multiple files download
    if (downloadAll && files.length > 1) {
      return new Response(`
        <html>
          <head>
            <title>Download All Files</title>
            <script src="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"></script>
            <script>
              async function downloadAll() {
                const zip = new JSZip();
                const promises = [];
                
                // Add each file to ZIP
                ${files.map((file, index) => `
                  promises.push(
                    fetch('${file.url}')
                      .then(res => res.blob())
                      .then(blob => {
                        zip.file("${file.visible_name}", blob);
                      })
                  );
                `).join('')}
                
                // Wait for all files to be added
                await Promise.all(promises);
                
                // Generate and download ZIP
                const content = await zip.generateAsync({type: 'blob'});
                const url = URL.createObjectURL(content);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'files_from_row_${rowId}.zip';
                document.body.appendChild(a);
                a.click();
                setTimeout(() => {
                  document.body.removeChild(a);
                  window.URL.revokeObjectURL(url);
                }, 100);
              }
              
              // Start download automatically
              window.onload = downloadAll;
            </script>
          </head>
          <body>
            <h1>Preparing download...</h1>
            <p>If download doesn't start automatically, <a href="#" onclick="downloadAll()">click here</a>.</p>
          </body>
        </html>
      `, {
        headers: { 'Content-Type': 'text/html' }
      });
    }

    // 4. Default behavior (single file or no download_all flag)
    return Response.redirect(files[0].url, 302);

  } catch (error) {
    return new Response(`Error: ${error.message}`, { status: 500 });
  }
}
