# UnNiYam Shop

An online fashion store built for the MDT312 Web Programming course at KMUTT.
Customers browse and buy, sellers manage their own products, and admins manage users and approve new sellers.

**Live demo:** https://thanyathorn74.github.io/unniyam-shop/

The live demo is a browser-only build of the shop (in `docs/`): accounts, carts and orders are stored in your browser,
payments are simulated, and you can sign in as a Customer, Seller or Admin with one click.

## Features

- Product catalogue with category filter, search, flash sale and multi-image gallery
- Register and log in with a profile photo, edit profile, role-based menus
- Cart with stock limits, collectable vouchers and discount codes
- Checkout with saved addresses and PromptPay, cash on delivery or card options
- Order history and notifications
- Seller dashboard: add, edit and delete products with up to 5 images
- Admin dashboard: change roles, suspend users, approve seller requests

## Tech stack

HTML, CSS and vanilla JavaScript on the front end; Node.js with Express, Multer (image uploads) and cookie sessions on the back end; MySQL database.

## Run the full version locally

1. Install [Node.js](https://nodejs.org/) and MySQL (for example with XAMPP).
2. Create a database named `unniyamshop` and import `unniyamshop.sql`.
3. Check the connection settings in `database.js` (default: `root` with no password on `localhost`).
4. Install packages and start the server:
   ```bash
   npm install
   npm start
   ```
5. Open http://localhost:3000

The PromptPay QR in `public/script.js` uses the example number `0812345678`. Replace it with your own PromptPay number to generate real QR codes.
