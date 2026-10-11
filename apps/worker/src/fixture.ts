export const fixtureOrigin = "https://fixture.auditcraft.test";
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="700" viewBox="0 0 1200 700"><rect width="1200" height="700" fill="#cbc6ae"/><path d="M0 700V480L300 190L700 700" fill="#929a79"/><path d="M440 700V300L810 140L1200 410V700" fill="#f3ecdc"/><path d="M810 140V700H1200V410" fill="#d8c7ad"/><rect x="530" y="380" width="190" height="320" fill="#344a3e"/><path d="M510 700V390Q625 180 740 390V700" fill="none" stroke="#b7a98b" stroke-width="18"/><circle cx="220" cy="145" r="75" fill="#e9b877"/><path d="M990 700V350M990 480Q870 330 890 270Q1040 340 990 480M990 430Q1110 270 1110 230Q940 310 990 430" stroke="#536853" stroke-width="28" fill="none"/></svg>`;
export function fixtureResponse(
  path: string,
): { body: string; type: string; status: number } | undefined {
  if (path === "/robots.txt")
    return {
      body: "User-agent: *\nAllow: /\nSitemap: https://fixture.auditcraft.test/sitemap.xml",
      type: "text/plain",
      status: 200,
    };
  if (path === "/sitemap.xml")
    return {
      body: '<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://fixture.auditcraft.test/</loc></url></urlset>',
      type: "application/xml",
      status: 200,
    };
  if (path === "/studio.svg")
    return { body: svg, type: "image/svg+xml", status: 200 };
  if (!["/", "/about", "/services", "/contact"].includes(path)) return;
  const title =
    path === "/"
      ? "Fieldwork Studio"
      : path.slice(1)[0].toUpperCase() + path.slice(2) + " | Fieldwork Studio";
  const content =
    path === "/"
      ? `<section class="hero"><div><p class="eyebrow">SPACES FOR SLOWER LIVING</p><h1>Good spaces.<br>Better days.</h1><p>Considered interiors for the places you call home.<br>A small independent design studio.</p><a class="button" href="/contact">Start a conversation ↗</a></div><img src="/studio.svg" width="1200" height="700"></section><section class="below"><p class="eyebrow">OUR APPROACH</p><h3>Less noise. More intention.</h3><p>We design warm, practical spaces around the way you live.</p><div class="cards"><article>01 / Residential interiors</article><article>02 / Space planning</article><article>03 / Material selection</article></div><a class="tiny" href="/services">Read more</a></section>`
      : path === "/contact"
        ? `<section class="below"><h1>Let’s talk about your space.</h1><p>Fictional demonstration form. Nothing is sent.</p><form onsubmit="event.preventDefault()"><input placeholder="Your name"><input placeholder="Email address" type="email"><textarea placeholder="Tell us about your project"></textarea><button type="submit">Send an enquiry</button></form></section>`
        : `<section class="below"><p class="eyebrow">FIELDWORK / ${path.slice(1).toUpperCase()}</p><h1>${path === "/about" ? "A thoughtful way to make a home." : "Spaces with purpose."}</h1><p>Fictional portfolio demonstration content, created for testing only.</p><img src="/studio.svg" alt="Illustrated room with an archway and plant" width="900" height="525"></section>`;
  return {
    status: 200,
    type: "text/html",
    body: `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title><meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1"><style>*{box-sizing:border-box}body{margin:0;background:#f7f4eb;color:#344a3e;font:16px Arial,sans-serif}header{padding:30px 6%;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #d7dacd}header strong{font:30px Georgia}nav{display:flex;gap:28px}a{color:inherit}nav a{text-decoration:none}.hero{display:grid;grid-template-columns:1fr 1fr;gap:40px;align-items:center;padding:70px 6%}.hero img{width:100%;height:440px;object-fit:cover;border-radius:160px 160px 0 0}h1{font:64px/1.02 Georgia;margin:25px 0}p{line-height:1.8}.eyebrow{font-size:11px;letter-spacing:3px}.button,button{display:inline-block;background:#344a3e;color:white;padding:17px 25px;text-decoration:none;border:0;margin-top:20px}.below{padding:55px 6%;border-top:1px solid #d7dacd}.below img{max-width:100%;height:auto}h3{font:38px Georgia}.cards{display:flex;gap:24px;margin:30px 0}.cards article{background:#e4e6d9;padding:35px;flex:1}.tiny{font-size:10px}form{max-width:500px;display:grid;gap:15px}input,textarea{padding:15px;border:1px solid #aaa;background:white}footer{padding:35px 6%;background:#344a3e;color:#f7f4eb}.demo{background:#f0cd8e;color:#493e25;padding:9px 6%;font-size:12px}@media(max-width:600px){header{padding:24px}nav{gap:10px;font-size:12px}.hero{grid-template-columns:1fr;padding:40px 24px}h1{font-size:46px}.hero img{height:300px}.cards{width:680px}.below{padding:35px 24px}}</style></head><body><div class="demo">FICTIONAL WEBSITE · Controlled AuditCraft test fixture</div><header><strong>fieldwork.</strong><nav><a href="/about">Studio</a><a href="/services">Services</a><a href="/contact">Contact</a></nav></header><main>${content}</main><footer>Fieldwork Studio · Fictional demonstration only</footer></body></html>`,
  };
}
