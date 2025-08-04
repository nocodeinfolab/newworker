export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const rowId = url.searchParams.get("id");

    if (!rowId) {
      return new Response("Missing row ID.", { status: 400 });
    }

    const tableId = '540983'; // replace this
    const baserowToken = env.BASEROW_TOKEN;

    const rowRes = await fetch(`https://api.baserow.io/api/database/rows/table/${tableId}/${rowId}/?user_field_names=true`, {
      headers: {
        Authorization: `Token ${baserowToken}`,
      },
    });

    if (!rowRes.ok) {
      return new Response("Failed to fetch row from Baserow", { status: 500 });
    }

    const row = await rowRes.json();
    const files = row["file"]; // replace with your actual field name

    if (!files || files.length === 0) {
      return new Response("No files available.", { status: 404 });
    }

    const html = `
      <!DOCTYPE html>
      <html>
      <head><title>Downloading Files...</title></head>
      <body>
        <h3>Preparing your downloads...</h3>
        ${files.map((f, i) => `<a id="dl${i}" href="${f.url}" download="${f.name}" style="display:none"></a>`).join('')}
        <script>
          window.onload = function() {
            ${files.map((_, i) => `document.getElementById('dl${i}').click();`).join('\n')}
          }
        </script>
      </body>
      </html>
    `;

    return new Response(html, {
      headers: { "Content-Type": "text/html" },
    });
  }
};
