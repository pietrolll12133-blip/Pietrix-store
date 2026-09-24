require("dotenv").config();
const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const ROOT = __dirname;

app.use(express.json({ limit: "2mb" }));
app.use(express.static(path.join(ROOT, "public")));

const readJson = (file, fallback) => {
  try { return JSON.parse(fs.readFileSync(path.join(ROOT, file), "utf8")); }
  catch { return fallback; }
};
const writeJson = (file, data) =>
  fs.writeFileSync(path.join(ROOT, file), JSON.stringify(data, null, 2));

async function printful(pathname, options = {}) {
  if (!process.env.PRINTFUL_TOKEN) throw new Error("PRINTFUL_TOKEN não configurado.");
  const response = await fetch("https://api.printful.com" + pathname, {
    ...options,
    headers: {
      Authorization: "Bearer " + process.env.PRINTFUL_TOKEN,
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });
  const text = await response.text();
  let body;
  try { body = JSON.parse(text); } catch { body = { raw: text }; }
  if (!response.ok) throw new Error(body?.error?.message || body?.result?.message || "Erro na Printful.");
  return body;
}

app.get("/api/products", (req, res) => {
  res.json(readJson("data/products.json", []));
});

app.get("/api/printful/products", async (req, res) => {
  try {
    const data = await printful("/store/products");
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/subscribe", (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
    return res.status(400).json({ error: "E-mail inválido." });

  const list = readJson("data/subscribers.json", []);
  if (!list.some(x => x.email === email))
    list.push({ email, createdAt: new Date().toISOString() });
  writeJson("data/subscribers.json", list);
  res.json({ ok: true });
});

app.post("/api/orders", async (req, res) => {
  try {
    const { customer, items } = req.body;
    if (!customer?.name || !customer?.email || !customer?.address)
      return res.status(400).json({ error: "Preencha nome, e-mail e endereço." });
    if (!Array.isArray(items) || !items.length)
      return res.status(400).json({ error: "Carrinho vazio." });

    const catalog = readJson("data/products.json", []);
    const orderItems = items.map(item => {
      const product = catalog.find(p => p.id === item.productId);
      if (!product) throw new Error("Produto não encontrado: " + item.productId);
      if (!product.printfulSyncVariantId)
        throw new Error("O produto '" + product.name + "' ainda não foi vinculado a um sync_variant_id da Printful.");
      return {
        sync_variant_id: Number(product.printfulSyncVariantId),
        quantity: Math.max(1, Number(item.quantity || 1))
      };
    });

    const draft = await printful("/orders", {
      method: "POST",
      body: JSON.stringify({
        recipient: {
          name: customer.name,
          email: customer.email,
          address1: customer.address,
          city: customer.city || "",
          state_code: customer.state || "",
          country_code: customer.country || "BR",
          zip: customer.zip || ""
        },
        items: orderItems,
        confirm: false
      })
    });

    const orders = readJson("data/orders.json", []);
    const saved = {
      id: draft.result?.id || draft.id,
      printful: draft.result || draft,
      customer,
      items,
      status: "draft",
      createdAt: new Date().toISOString()
    };
    orders.push(saved);
    writeJson("data/orders.json", orders);
    res.json({ ok: true, order: saved });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/orders/:id", async (req, res) => {
  const orders = readJson("data/orders.json", []);
  const local = orders.find(o => String(o.id) === String(req.params.id));
  if (!local) return res.status(404).json({ error: "Pedido não encontrado." });
  try {
    const live = await printful("/orders/" + encodeURIComponent(req.params.id));
    res.json({ local, printful: live });
  } catch {
    res.json({ local });
  }
});

app.post("/api/orders/:id/confirm", async (req, res) => {
  if (!process.env.ADMIN_KEY || req.headers["x-admin-key"] !== process.env.ADMIN_KEY)
    return res.status(401).json({ error: "Não autorizado." });

  try {
    const result = await printful("/orders/" + encodeURIComponent(req.params.id), {
      method: "POST",
      body: JSON.stringify({ confirm: true })
    });
    const orders = readJson("data/orders.json", []);
    const order = orders.find(o => String(o.id) === String(req.params.id));
    if (order) order.status = "confirmed";
    writeJson("data/orders.json", orders);
    res.json({ ok: true, result });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/admin/orders", (req, res) => {
  if (!process.env.ADMIN_KEY || req.headers["x-admin-key"] !== process.env.ADMIN_KEY)
    return res.status(401).json({ error: "Não autorizado." });
  res.json(readJson("data/orders.json", []));
});

app.get("*", (req, res) => res.sendFile(path.join(ROOT, "public", "index.html")));

app.listen(PORT, () => console.log("Pietrix Store rodando na porta " + PORT));
