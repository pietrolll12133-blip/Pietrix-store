# Pietrix Store + Printful

Primeira versão recriada do zero.

## O que já tem
- Loja responsiva.
- Catálogo local.
- Carrinho.
- Cadastro de e-mail.
- Checkout com nome, e-mail e endereço.
- Backend Node/Express.
- Token da Printful protegido no servidor.
- Consulta de produtos da Printful.
- Criação de pedido na Printful como DRAFT.
- Endpoint administrativo para confirmar o pedido depois do pagamento.

## Configuração
1. Instale Node.js 18+.
2. Copie `.env.example` para `.env`.
3. Coloque o token da Printful em `PRINTFUL_TOKEN`.
4. Troque `ADMIN_KEY`.
5. Rode `npm install`.
6. Rode `npm start`.
7. Abra `http://localhost:3000`.

## Importante
Os produtos em `data/products.json` precisam receber o `printfulSyncVariantId` correspondente aos produtos/variantes que você criar ou sincronizar na Printful.

Não coloque o token da Printful no HTML ou no JavaScript do navegador.
