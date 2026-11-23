const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const oldVhost = `<IfModule mod_ssl.c>
<VirtualHost *:443>
    ServerName dev3.memogadget.com
    ProxyPass "/tavski/assets/" "!"
    Alias "/tavski/assets/" "/home/www/dev3.memogadget.com/public_html/tavski/.output/public/assets/"
    <Directory "/home/www/dev3.memogadget.com/public_html/tavski/.output/public/assets">
        AllowOverride None
        Options -Indexes
        Require all granted
    </Directory>
    ProxyPass "/tavski/" "http://127.0.0.1:3103/tavski/"
    ProxyPassReverse "/tavski/" "http://127.0.0.1:3103/tavski/"
    DocumentRoot /home/www/dev3.memogadget.com/public_html
    SSLCertificateFile /etc/letsencrypt/live/dev3.memogadget.com/fullchain.pem
    IncludeOptional /etc/erp-test-20261118/apache-aliases.conf
</VirtualHost>
</IfModule>`;

test("Apache migration replaces only Tavski rules and is repeatable", async () => {
  const { rewriteApache } = await import(pathToFileURL(path.resolve(__dirname, "../scripts/configure-admin-apache.mjs")).href);
  const updated = rewriteApache(oldVhost);
  assert.ok(updated.includes("Include /etc/apache2/tavski/admin.conf"));
  assert.ok(!updated.includes('ProxyPass "/tavski/"'));
  assert.ok(updated.includes("DocumentRoot /home/www/dev3.memogadget.com/public_html"));
  assert.ok(updated.includes("IncludeOptional /etc/erp-test-20261118/apache-aliases.conf"));
  assert.ok(updated.includes("SSLCertificateFile /etc/letsencrypt/live/dev3.memogadget.com/fullchain.pem"));
  assert.equal(rewriteApache(updated), updated);
  assert.throws(() => rewriteApache(oldVhost.replace("ServerName dev3.memogadget.com", "ServerName another.example")));
  assert.throws(() => rewriteApache(oldVhost.replace('ProxyPass "/tavski/"', 'ProxyPass "/different/"')));
});

test("public landing has only TAVSKI, no scripts, login fields or external dependencies", () => {
  const html = fs.readFileSync(path.resolve(__dirname, "../../index.html"), "utf8");
  assert.match(html, /<title>TAVSKI<\/title>/);
  assert.match(html, /<h1>TAVSKI<\/h1>/);
  assert.ok(!/<script|<form|<input|supabase|https?:\/\//i.test(html));
});

test("deployment scopes proxy and static assets to admin and blocks filesystem source access", () => {
  const snippet = fs.readFileSync(path.resolve(__dirname, "../ops/tavski-admin.apache.conf"), "utf8");
  assert.ok(!/^ProxyPass "\/tavski\/"/m.test(snippet));
  assert.match(snippet, /ProxyPass "\/tavski\/admin\/" "http:\/\/127\.0\.0\.1:3103\/tavski\/admin\/"/);
  assert.match(snippet, /<Directory "[^"\n]+\/tavski\/admin">\s+AllowOverride None\s+Require all denied/);
  assert.match(snippet, /DirectoryIndex index.html/);
  assert.ok(snippet.includes('<DirectoryMatch "^/home/www/dev3[.]memogadget[.]com/public_html/tavski/[.]">'));
});
