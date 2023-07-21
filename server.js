require("dotenv").config();
require("./config/db");
const userRouter = require("./routes/userRoute");
const express = require("express");
const cors = require("cors");
// const jwt = require("jsonwebtoken");
// const bcrypt = require("bcrypt");
const cookieParser = require("cookie-parser");
const bodyParser = require("body-parser");

const app = express();

const port = process.env.PORT || 8000;

app.use(express.json());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(
  cors({
    origin: "*",
    methods: ["POST", "GET"],
    credentials: true,
  })
);
app.use(cookieParser());

app.use("/api", userRouter);

app.use((err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.message = err.message || "Internal server error";
  res.status(err.statusCode).json({
    message: err.message,
  });
});

// const salt = 10;

// const db = mysql.createConnection({
//   host: "localhost",
//   user: "root",
//   password: "",
//   database: "signup",
// });

// app.post("/register", (req, res) => {
//   const sql = "INSERT INTO login (`name`,`email`,`password`) VALUES (?)";

//   bcrypt.hash(req.body.password.toString(), salt, (err, hash) => {
//     if (err) return res.json({ Error: "Error for hashing password" });
//     const values = [req.body.name, req.body.email, hash];
//     db.query(sql, [values], (err, result) => {
//       if (err) return res.json({ Error: "Inserting data Error in server" });
//       return res.json({ Status: "Success" });
//     });
//   });
// });

// app.post("/login", (req, res) => {
//   const sql = "SELECT * FROM login WHERE email = ?";
//   db.query(sql, [req.body.email], (err, data) => {
//     if (err) return res.json({ Error: "Login Error in server" });
//     if (data.length > 0) {
//       bcrypt.compare(
//         req.body.passwod.toString(),
//         data[0].password,
//         (err, response) => {
//           if (err) return res.json({ Error: "Password compare error" });
//           if (response) {
//             const name = data[0].name;
//             const token = jwt.sign({ name }, "jwt secret key", {
//               expiresIn: "1d",
//             });
//             res.cookie("token", token);
//             return res.json({ Status: "Success" });
//           } else {
//             return res.json({ Error: "Password not matched" });
//           }
//         }
//       );
//     } else {
//       return res.json({ Error: "No email exists" });
//     }
//   });
// });

app.listen(port, () => {
  console.log(`API running at port ${port}`);
});
