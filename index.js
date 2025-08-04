addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  // Configuration - REPLACE WITH YOUR VALUES
  const BASEROW_TOKEN = 'kN7gNkHeBtstfqGbCfSmdYjzZmaGK9rS';
  const TABLE_ID = '540983';
  
  // Parse request URL
  const url = new URL(request.url);
  const rowId = url.searchParams.get('row_id');
  const debug = url.searchParams.has('debug');

  // 1. Initial Request Handling
  if (!rowId) {
    return new Response('Please add ?row_id=YOUR_ROW_ID to the URL', {
      status: 400,
      headers: { 'Content-Type': 'text/html' }
    });
  }

  try {
    // 2. Authenticate and fetch row data
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
    
    // Debug mode
    if (debug) {
      return new Response(JSON.stringify(rowData, null, 2), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 3. Handle files
    const files = rowData.file || [];
    
    if (files.length === 0) {
      return new Response('No files found in this row', { status: 404 });
    }

    // 4. DIRECTLY OPEN THE FIRST FILE'S URL
    const firstFile = files[0];
    return Response.redirect(firstFile.url, 302);

  } catch (error) {
    return new Response(`Error: ${error.message}`, { status: 500 });
  }
}
