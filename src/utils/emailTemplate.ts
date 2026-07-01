export const generateEmailTemplate = (title: string, content: string, details?: Record<string, string>) => {
  const detailsHtml = details
    ? `
    <div style="background-color: #f4f4f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
      <h3 style="margin-top: 0; color: #18181b;">Detail Permintaan:</h3>
      <table style="width: 100%; border-collapse: collapse;">
        ${Object.entries(details)
          .map(
            ([key, value]) => `
          <tr>
            <td style="padding: 6px 0; color: #52525b; font-weight: bold; width: 140px;">${key}</td>
            <td style="padding: 6px 0; color: #27272a;">${value}</td>
          </tr>
        `
          )
          .join('')}
      </table>
    </div>
    `
    : '';

  return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <style>
      body {
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        line-height: 1.6;
        color: #27272a;
        background-color: #f4f4f5;
        margin: 0;
        padding: 40px 20px;
      }
      .container {
        max-width: 600px;
        margin: 0 auto;
        background-color: #ffffff;
        border-radius: 12px;
        overflow: hidden;
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
      }
      .header {
        background-color: #eb9c25ff;
        padding: 30px 20px;
        text-align: center;
      }
      .header h1 {
        margin: 0;
        color: #ffffff;
        font-size: 24px;
        letter-spacing: 0.5px;
      }
      .content {
        padding: 30px;
      }
      .content p {
        margin: 0 0 16px 0;
        font-size: 16px;
      }
      .footer {
        background-color: #fafafa;
        padding: 20px;
        text-align: center;
        border-top: 1px solid #e4e4e7;
        color: #71717a;
        font-size: 14px;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <h1>${title}</h1>
      </div>
      <div class="content">
        ${content}
        ${detailsHtml}
        <p>Terima kasih telah menggunakan Ruumi,<br><strong>Tim Ruumi</strong></p>
      </div>
      <div class="footer">
        &copy; ${new Date().getFullYear()} Ruumi Rental Platform. Hak cipta dilindungi.
      </div>
    </div>
  </body>
  </html>
  `;
};
