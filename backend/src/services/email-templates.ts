export function welcomeEmailHtml(name: string) {
  return `
  <!DOCTYPE html><html><body style="font-family:Inter,sans-serif;background:#f8fafc;padding:24px;">
  <table width="100%" style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;padding:32px;">
    <tr><td><h1 style="color:#2563eb;margin:0;">Welcome to FirstJobPath</h1>
    <p style="color:#64748b;">Hi ${escapeHtml(name)}, your account is ready. Start your placement journey anytime.</p>
    <a href="#" style="display:inline-block;margin-top:16px;padding:12px 24px;background:linear-gradient(90deg,#2563eb,#60a5fa);color:#fff;text-decoration:none;border-radius:8px;font-weight:600;">Open dashboard</a>
    </td></tr></table></body></html>`;
}

export function otpEmailHtml(code: string, purpose: string) {
  return `
  <!DOCTYPE html><html><body style="font-family:Inter,sans-serif;background:#f8fafc;padding:24px;">
  <table width="100%" style="max-width:480px;margin:0 auto;background:#fff;border-radius:12px;padding:28px;">
    <tr><td><p style="color:#64748b;margin:0;">Your verification code for <strong>${escapeHtml(purpose)}</strong>:</p>
    <p style="font-size:32px;letter-spacing:8px;font-weight:700;color:#0f172a;margin:16px 0;">${escapeHtml(code)}</p>
    <p style="color:#94a3b8;font-size:13px;">Expires in 10 minutes. Do not share this code.</p>
    </td></tr></table></body></html>`;
}

export function genericHtml(title: string, body: string) {
  return `<!DOCTYPE html><html><body style="font-family:Inter,sans-serif;padding:24px;background:#f8fafc;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;padding:28px;">
  <h2 style="color:#0f172a;">${escapeHtml(title)}</h2>
  <div style="color:#475569;">${body}</div></div></body></html>`;
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
