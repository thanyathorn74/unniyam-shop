const express = require('express');
const app = express();
const path = require('path');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const multer = require('multer');

// --- CHANGE 1: Import the connection from your database.js file ---
// This replaces the manual mysql.createConnection code
const { con, queryDB } = require('./database'); 

const port = 3000;

// --- CONFIGURATION: FINAL CATEGORY LIST ---
const MY_CATEGORIES = [
    "Accessories", "Bag", "Bottom", "Shirts", "Shoe"
];

// --- DELETE THE OLD CONNECTION CODE BELOW THIS LINE ---
// Delete: const mysql = require('mysql');
// Delete: const con = mysql.createConnection({ ... });
// Delete: const queryDB = ... (the manual promise function)
// -----------------------------------------------------

// --- Middleware ---
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());

// --- ADMIN MIDDLEWARE ---
const isAdmin = (req, res, next) => {
    const username = req.cookies.username;
    if (!username) return res.status(401).json({ error: "Not authenticated" });

    const sql = "SELECT * FROM users WHERE display_name = ?";
    con.query(sql, [username], (err, rows) => {
        if (err || rows.length === 0) return res.status(403).json({ error: "User not found" });
        if (rows[0].role.toLowerCase() !== "admin") return res.status(403).json({ error: "Admin access only" });
        next();
    });
};

// --- 2. Database Init (Auto-Sync Categories) ---
const initDatabase = async () => {
    try {
        await queryDB("CREATE DATABASE IF NOT EXISTS unniyamshop");
        await queryDB("USE unniyamshop");

        // 1. Users
        await queryDB(`CREATE TABLE IF NOT EXISTS users (
            user_id INT AUTO_INCREMENT PRIMARY KEY,
            email VARCHAR(255) NOT NULL UNIQUE,
            password_hash VARCHAR(255) NOT NULL,
            display_name VARCHAR(100),
            first_name VARCHAR(100),
            last_name VARCHAR(100),
            profile_pic_url VARCHAR(255),
            role ENUM('customer', 'seller', 'admin') DEFAULT 'customer',
            status ENUM('active', 'suspended') DEFAULT 'active',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);

        // 2. Categories - SYNC WITH LIST
        await queryDB(`CREATE TABLE IF NOT EXISTS categories (category_id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(100) NOT NULL UNIQUE, description TEXT)`);
        
        for (const catName of MY_CATEGORIES) {
            await queryDB(`INSERT IGNORE INTO categories (name) VALUES (?)`, [catName]);
        }
        console.log("✅ Categories synced: " + MY_CATEGORIES.join(", "));

        // 3. Products
        await queryDB(`CREATE TABLE IF NOT EXISTS products (
            product_id INT AUTO_INCREMENT PRIMARY KEY,
            seller_id INT NOT NULL,
            category_id INT,
            name VARCHAR(255) NOT NULL,
            description TEXT,
            price DECIMAL(10,2) NOT NULL,
            stock_quantity INT DEFAULT 0,
            image_url VARCHAR(255),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (seller_id) REFERENCES users(user_id) ON DELETE CASCADE
        )`);

        // 4. Other Tables
        await queryDB(`CREATE TABLE IF NOT EXISTS addresses (address_id INT AUTO_INCREMENT PRIMARY KEY, user_id INT NOT NULL, address_line TEXT, city VARCHAR(100), postal_code VARCHAR(10), is_default TINYINT(1) DEFAULT 0, FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE)`);
        await queryDB(`CREATE TABLE IF NOT EXISTS orders (order_id INT AUTO_INCREMENT PRIMARY KEY, user_id INT NOT NULL, shipping_address_id INT, total_amount DECIMAL(10,2) NOT NULL, applied_voucher_code VARCHAR(50), order_status ENUM('pending','paid','shipped','delivered','cancelled') DEFAULT 'pending', payment_status ENUM('pending','success','failed') DEFAULT 'pending', order_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE)`);
        await queryDB(`CREATE TABLE IF NOT EXISTS order_items (order_item_id INT AUTO_INCREMENT PRIMARY KEY, order_id INT NOT NULL, product_id INT NOT NULL, quantity INT NOT NULL, price_at_purchase DECIMAL(10,2) NOT NULL, FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE, FOREIGN KEY (product_id) REFERENCES products(product_id))`);
        await queryDB(`CREATE TABLE IF NOT EXISTS cart_items (cart_item_id INT AUTO_INCREMENT PRIMARY KEY, user_id INT NOT NULL, product_id INT NOT NULL, quantity INT DEFAULT 1, added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE, FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE CASCADE)`);
        await queryDB(`CREATE TABLE IF NOT EXISTS notifications (notification_id INT AUTO_INCREMENT PRIMARY KEY, user_id INT, type ENUM('global', 'admin_alert', 'personal') DEFAULT 'personal', message TEXT, action_link VARCHAR(255), is_read TINYINT(1) DEFAULT 0, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE)`);

        console.log("✅ Database initialized successfully");
    } catch (err) { console.error("❌ Database Init Error:", err); }
};

// --- ROUTES ---

// File Upload
const storage = multer.diskStorage({
    destination: (req, file, cb) => { cb(null, 'public/uploads/'); },
    filename: (req, file, cb) => { cb(null, 'profile-' + Date.now() + path.extname(file.originalname)); }
});
const upload = multer({ storage: storage });

// API: Get Categories
app.get('/api/categories', async (req, res) => {
    try {
        let sql = `SELECT * FROM categories`; 
        let result = await queryDB(sql);
        res.json(result);
    } catch (err) { res.status(500).send("Database Error"); }
});

// API: Auth
app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        let sql = "SELECT * FROM users WHERE display_name = ? AND password_hash = ?";
        let result = await queryDB(sql, [username, password]);
        if (result.length > 0) {
            if(result[0].status === 'suspended') return res.json({ success: false, message: "Account Suspended." });
            res.cookie('username', username, { maxAge: 900000, path: '/' });
            res.json({ success: true, user: result[0] });
        } else { res.json({ success: false, message: "Invalid credentials" }); }
    } catch (err) { res.status(500).send(err); }
});

app.post('/register', upload.single('profile_pic'), async (req, res) => {
    const { username, email, password, first_name, last_name } = req.body;
    const img = req.file ? req.file.filename : 'default.png';
    try {
        let check = await queryDB("SELECT * FROM users WHERE display_name = ?", [username]);
        if (check.length > 0) return res.json({ success: false, message: 'Username taken' });
        await queryDB(`INSERT INTO users (display_name, email, password_hash, first_name, last_name, profile_pic_url, role) VALUES (?, ?, ?, ?, ?, ?, 'customer')`, [username, email, password, first_name, last_name, img]);
        res.json({ success: true });
    } catch (err) { res.json({ success: false, message: err.message }); }
});

app.post('/api/reset-password', async (req, res) => {
    const { email, newPassword } = req.body;
    try {
        let check = await queryDB("SELECT * FROM users WHERE email = ?", [email]);
        if (check.length === 0) return res.json({ success: false, message: "Email not found." });
        await queryDB("UPDATE users SET password_hash = ? WHERE email = ?", [newPassword, email]);
        res.json({ success: true, message: "Password updated successfully!" });
    } catch (err) { res.status(500).json({ success: false }); }
});

// API: Logout (Clear Cookie)
app.get('/logout', (req, res) => {
    res.clearCookie('username'); // This kills the zombie cookie
    res.json({ success: true });
});

// API: Products
app.get('/api/products', async (req, res) => {
    try {
        let sql = `SELECT * FROM products ORDER BY created_at DESC`; 
        let result = await queryDB(sql);
        res.json(result);
    } catch (err) { res.status(500).send("Database Error"); }
});

app.get('/api/products/:id', async (req, res) => {
    try {
        let result = await queryDB("SELECT * FROM products WHERE product_id = ?", [req.params.id]);
        if (result.length > 0) res.json(result[0]);
        else res.status(404).json({ message: "Product not found" });
    } catch (err) { res.status(500).send("Database Error"); }
});

app.post('/api/products', upload.array('product_images', 5), async (req, res) => {
    const { name, description, price, stock, category_id, seller_id } = req.body;
    let imgString = req.files && req.files.length > 0 ? req.files.map(f => f.filename).join(',') : 'default.png';
    try {
        let sql = "INSERT INTO products (name, description, price, stock_quantity, category_id, seller_id, image_url) VALUES (?, ?, ?, ?, ?, ?, ?)";
        await queryDB(sql, [name, description, price, stock, category_id, seller_id, imgString]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

app.put('/api/products/:id', upload.array('product_images', 5), async (req, res) => {
    const id = req.params.id;
    const { name, description, price, stock, category_id, kept_images } = req.body;
    try {
        let newImages = req.files && req.files.length > 0 ? req.files.map(f => f.filename).join(',') : "";
        let finalImages = kept_images || "";
        if (newImages) finalImages = finalImages ? (finalImages + "," + newImages) : newImages;
        let sql = `UPDATE products SET name=?, description=?, price=?, stock_quantity=?, category_id=?, image_url=? WHERE product_id=?`;
        await queryDB(sql, [name, description, price, stock, category_id, finalImages, id]);
        res.json({ success: true, message: "Product updated" });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

app.delete('/api/products/:id', async (req, res) => {
    try {
        await queryDB("DELETE FROM products WHERE product_id = ?", [req.params.id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ success: false }); }
});

// API: Orders & Notifications
app.post('/api/orders', async (req, res) => {
    const { user_id, cartItems, total } = req.body;
    try {
        const orderRes = await queryDB("INSERT INTO orders (user_id, total_amount, order_status) VALUES (?, ?, 'pending')", [user_id, total]);
        const orderId = orderRes.insertId;
        for (const item of cartItems) {
            await queryDB("INSERT INTO order_items (order_id, product_id, quantity, price_at_purchase) VALUES (?, ?, ?, ?)", [orderId, item.product_id, item.quantity, item.price]);
        }
        res.json({ success: true, orderId: orderId });
    } catch (err) { res.status(500).json({ success: false }); }
});

app.get('/api/notifications', async (req, res) => {
    const username = req.cookies.username;
    if (!username) return res.json([]);
    try {
        let userRes = await queryDB("SELECT user_id, role FROM users WHERE display_name = ?", [username]);
        if (userRes.length === 0) return res.json([]);
        const user = userRes[0];
        let sql = (user.role === 'admin') 
            ? "SELECT * FROM notifications WHERE type = 'global' OR type = 'admin_alert' ORDER BY created_at DESC"
            : "SELECT * FROM notifications WHERE type = 'global' OR (type = 'personal' AND user_id = ?) ORDER BY created_at DESC";
        let params = (user.role === 'admin') ? [] : [user.user_id];
        let notis = await queryDB(sql, params);
        res.json(notis);
    } catch (err) { res.status(500).json([]); }
});

app.post('/api/request-seller', async (req, res) => {
    const username = req.cookies.username;
    try {
        let userRes = await queryDB("SELECT user_id FROM users WHERE display_name = ?", [username]);
        await queryDB("INSERT INTO notifications (type, message, action_link) VALUES ('admin_alert', ?, ?)", [`User <b>${username}</b> wants to become a Seller!`, `/admin/admin-dashboard.html?highlightUser=${userRes[0].user_id}`]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ success: false }); }
});

// API: Get User's Order History
app.get('/api/my-orders', async (req, res) => {
    const username = req.cookies.username;
    if (!username) return res.status(401).json({ error: "Not logged in" });

    try {
        // 1. Get User ID
        let userRes = await queryDB("SELECT user_id FROM users WHERE display_name = ?", [username]);
        if (userRes.length === 0) return res.status(404).json({ error: "User not found" });
        const userId = userRes[0].user_id;

        // 2. Get Orders (Joined with Order Items & Products to show what was bought)
        // This query groups items by order_id so we get one row per order with a list of items
        let sql = `
            SELECT 
                o.order_id, o.total_amount, o.order_status, o.order_date,
                GROUP_CONCAT(p.name SEPARATOR ', ') as product_names,
                COUNT(oi.product_id) as total_items
            FROM orders o
            JOIN order_items oi ON o.order_id = oi.order_id
            JOIN products p ON oi.product_id = p.product_id
            WHERE o.user_id = ?
            GROUP BY o.order_id
            ORDER BY o.order_date DESC
        `;
        
        let orders = await queryDB(sql, [userId]);
        res.json(orders);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// API: Update User Profile
app.put('/api/user/update', upload.single('profile_pic'), async (req, res) => {
    const currentUsername = req.cookies.username;
    if (!currentUsername) return res.status(401).json({ success: false, message: "Not logged in" });

    const { first_name, last_name, display_name } = req.body;
    
    try {
        // 1. Get current user ID and old image
        let userRes = await queryDB("SELECT user_id, profile_pic_url FROM users WHERE display_name = ?", [currentUsername]);
        if (userRes.length === 0) return res.status(404).json({ success: false, message: "User not found" });
        
        const userId = userRes[0].user_id;
        let newImg = userRes[0].profile_pic_url; // Default to old image

        // 2. If a new file was uploaded, use it
        if (req.file) {
            newImg = req.file.filename;
        }

        // 3. Update Database
        await queryDB(
            "UPDATE users SET first_name=?, last_name=?, display_name=?, profile_pic_url=? WHERE user_id=?", 
            [first_name, last_name, display_name, newImg, userId]
        );

        // 4. Update Cookie if username changed
        if (display_name !== currentUsername) {
            res.cookie('username', display_name, { maxAge: 900000, path: '/' });
        }

        // 5. Send back the updated user object
        const updatedUser = {
            user_id: userId,
            first_name, last_name, display_name,
            profile_pic_url: newImg,
            role: 'customer' // Simplified, or fetch from DB if needed
        };

        res.json({ success: true, user: updatedUser });

    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "Update failed" });
    }
});

// API: Admin
app.get('/admin/users', isAdmin, (req, res) => {
    con.query(`SELECT user_id, display_name, email, role, status, profile_pic_url FROM users ORDER BY user_id DESC`, (err, rows) => {
        if(err) return res.status(500).json({error:"DB Error"});
        res.json(rows);
    });
});
app.put('/admin/user/update/:id', isAdmin, (req, res) => {
    const { role, status } = req.body;
    con.query(`UPDATE users SET role = ?, status = ? WHERE user_id = ?`, [role, status, req.params.id], (err) => {
        if(err) return res.status(500).json({error:"DB Error"});
        res.json({ success: true });
    });
});
app.delete('/admin/user/:id', isAdmin, (req, res) => {
    con.query("DELETE FROM users WHERE user_id = ?", [req.params.id], (err) => {
        if(err) return res.status(500).json({error:"DB Error"});
        res.json({ success: true });
    });
});
app.delete('/admin/notification/:id', isAdmin, async (req, res) => {
    await queryDB("DELETE FROM notifications WHERE notification_id = ?", [req.params.id]);
    res.json({ success: true });
});

// --- Session Restore Route ---
app.get('/api/user/me', (req, res) => {
    const username = req.cookies.username;
    if(!username) return res.json({ user: null });
    
    // Using the shared connection 'queryDB' or 'con'
    // Make sure 'con' is imported from database.js
    const sql = "SELECT * FROM users WHERE display_name = ?";
    con.query(sql, [username], (err, rows) => {
        if(err) {
            console.error("Session DB Error:", err);
            return res.json({ user: null });
        }
        if(rows && rows.length > 0) {
            res.json({ user: rows[0] });
        } else {
            res.json({ user: null });
        }
    });
});

// --- CHANGE 2: Start Server directly (Database is already connected in database.js) ---

// We don't need con.connect here anymore because database.js does it.
// We just initialize the tables and start listening.

initDatabase().then(() => {
    app.listen(port, () => {
        console.log(`🚀 Server running at http://localhost:${port}/`);
    });
});