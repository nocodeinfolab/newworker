addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  // Baserow API configuration
  const BASEROW_TOKEN = 'kN7gNkHeBtstfqGbCfSmdYjzZmaGK9rS'; // REPLACE THIS
  const TABLE_ID = '540983';
  
  // Parse the URL to get query parameters
  const url = new URL(request.url)
  const rowId = url.searchParams.get('row_id')
  const fileIndex = url.searchParams.get('file_index') || 0
  const debug = url.searchParams.has('debug')

  if (!rowId) {
    return new Response('Please provide a row_id parameter', { status: 400 })
  }

  try {
    // Fetch the row data from Baserow
    const rowUrl = `https://api.baserow.io/api/database/rows/table/${TABLE_ID}/${rowId}/?user_field_names=true`
    const response = await fetch(rowUrl, {
      headers: {
        'Authorization': `Token ${BASEROW_TOKEN}`,
        'Content-Type': 'application/json'
      }
    })
    
    if (!response.ok) {
      return new Response(`Failed to fetch row data: ${response.statusText}`, { 
        status: response.status 
      })
    }

    const rowData = await response.json()
    
    // Debug output if requested
    if (debug) {
      return new Response(JSON.stringify(rowData, null, 2), {
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Access the files array - now using lowercase 'file'
    const files = rowData.file || []
    
    if (files.length === 0) {
      return new Response('No files found in this row', { status: 404 })
    }

    // Handle file index selection
    const selectedIndex = parseInt(fileIndex)
    if (selectedIndex >= 0 && selectedIndex < files.length) {
      const file = files[selectedIndex]
      
      // Fetch the file with authorization
      const fileResponse = await fetch(file.url, {
        headers: {
          'Authorization': `Token ${BASEROW_TOKEN}`
        }
      })
      
      if (!fileResponse.ok) {
        return new Response(
          `Failed to fetch file: ${fileResponse.statusText}`, 
          { status: fileResponse.status }
        )
      }
      
      // Return the requested file
      const fileData = await fileResponse.arrayBuffer()
      return new Response(fileData, {
        headers: {
          'Content-Type': file.mime_type || 'application/octet-stream',
          'Content-Disposition': `attachment; filename="${file.visible_name}"`
        }
      })
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
            .file-icon { margin-right: 8px; }
            .pdf { color: #e74c3c; }
            .image { color: #3498db; }
          </style>
        </head>
        <body>
          <h1>Multiple Files Available</h1>
          <p>Please select which file to download:</p>
          <ul>
            ${files.map((file, index) => `
              <li>
                <a href="?row_id=${rowId}&file_index=${index}">
                  <span class="file-icon ${file.is_image ? 'image' : 'pdf'}">
                    ${file.is_image ? '🖼️' : '📄'}
                  </span>
                  ${file.visible_name} (${(file.size / 1024).toFixed(1)} KB)
                </a>
              </li>
            `).join('')}
          </ul>
        </body>
      </html>
    `
    
    return new Response(selectionPage, {
      headers: { 'Content-Type': 'text/html' }
    })
    
  } catch (error) {
    return new Response(
      `An error occurred: ${error.message}`,
      { status: 500 }
    )
  }
}
