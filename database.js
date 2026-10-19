const mysql = require('mysql');

const con = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "", 
    database: "unniyamshop", // Make sure this matches your DB name exactly (lowercase)
    multipleStatements: true
});

con.connect(err => {
    if (err) console.error("Error connecting:", err.message);
    else console.log("MySQL Connected!");
});

// Update this function to accept 'params'
const queryDB = (sql, params) => {
    return new Promise((resolve, reject) => {
        con.query(sql, params, (err, result) => {
            if (err) reject(err);
            else resolve(result);
        });
    });
};

module.exports = { con, queryDB };