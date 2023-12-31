const { validationResult } = require("express-validator");
const bcrypt = require("bcrypt");
const speakeasy = require("speakeasy");
const qrcode = require("qrcode");
const db = require("../config/db");

const randomstring = require("randomstring");
const sendMail = require("../helpers/sendMail");

const jwt = require("jsonwebtoken");
const { JWT_SECRET } = process.env;

// const register = (req, res) => {
//   const errors = validationResult(req);

//   if (!errors.isEmpty()) {
//     return res.status(400).json({ errors: errors.array() });
//   }

//   const secret = speakeasy.generateSecret({ length: 20 });

//   db.query(
//     `SELECT * FROM users WHERE LOWER(email) = LOWER(${db.escape(
//       req.body.email
//     )});`,
//     (err, result) => {
//       if (err) {
//         return res.status(500).send({
//           message: err,
//         });
//       }

//       if (result && result.length) {
//         return res.status(409).send({
//           message: "This user already exists",
//         });
//       } else {
//         bcrypt.hash(req.body.password, 10, (err, hash) => {
//           if (err) {
//             return res.status(400).send({
//               message: err,
//             });
//           } else {
//             db.query(
//               `INSERT INTO users (name, email, password) VALUES ('${
//                 req.body.name
//               }', ${db.escape(req.body.email)}, ${db.escape(hash)});`,
//               (err, result) => {
//                 if (err) {
//                   return res.status(400).send({
//                     message: err,
//                   });
//                 }

//                 qrcode.toDataURL(secret.otpauth_url, (err, dataUrl) => {
//                   if (err) {
//                     console.error("Error generating QR code:", err);
//                     return res
//                       .status(500)
//                       .json({ message: "Error generating QR code" });
//                   }

//                   // Send the QR code data URL and user data to the client
//                   return res.json({
//                     qrCode: dataUrl,
//                     user: {
//                       id: result.insertId,
//                       name: req.body.name,
//                       email: req.body.email,
//                     },
//                   });
//                 });
//               }
//             );
//           }
//         });
//       }
//     }
//   );
// };

const register = (req, res) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const secret = speakeasy.generateSecret({ length: 20 });

  db.query(
    `SELECT * FROM users WHERE LOWER(email) = LOWER(${db.escape(
      req.body.email
    )});`,
    (err, result) => {
      if (err) {
        return res.status(500).send({
          message: err,
        });
      }

      if (result && result.length) {
        return res.status(409).send({
          message: "This user already exists",
        });
      } else {
        bcrypt.hash(req.body.password, 10, (err, hash) => {
          if (err) {
            return res.status(400).send({
              message: err,
            });
          } else {
            db.query(
              `INSERT INTO users (name, email, password, secret_key) VALUES ('${
                req.body.name
              }', ${db.escape(req.body.email)}, ${db.escape(hash)}, '${
                secret.base32
              }');`,
              (err, result) => {
                if (err) {
                  return res.status(400).send({
                    message: err,
                  });
                }

                qrcode.toDataURL(secret.otpauth_url, (err, dataUrl) => {
                  if (err) {
                    console.error("Error generating QR code:", err);
                    return res
                      .status(500)
                      .json({ message: "Error generating QR code" });
                  }

                  // Send the QR code data URL and user data to the client
                  return res.json({
                    qrCode: dataUrl,
                    user: {
                      id: result.insertId,
                      name: req.body.name,
                      email: req.body.email,
                    },
                  });
                });
              }
            );
          }
        });
      }
    }
  );
};

const enable2FA = (req, res) => {
  const { id, otp } = req.body;

  // Fetch the user's secret key from the database
  const query = "SELECT secret_key FROM users WHERE id = ?";
  db.query(query, [id], (err, result) => {
    if (err) {
      console.error("Error fetching user data from the database:", err);
      return res.status(500).json({ message: "Error enabling 2FA" });
    }

    // Verify the OTP using the secret key
    const secret = result[0].secret_key;
    const verified = speakeasy.totp.verify({
      secret,
      encoding: "base32",
      token: otp,
    });

    if (verified) {
      return res.json({ message: "2FA enabled successfully" });
    } else {
      // OTP is invalid
      return res.status(401).json({ message: "Invalid OTP" });
    }
  });
};

const login = (req, res) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  db.query(
    `SELECT * FROM users WHERE email = ${db.escape(req.body.email)};`,
    (err, result) => {
      if (err) {
        return res.status(400).send({
          message: err,
        });
      }

      if (!result.length) {
        return res.status(401).send({
          message: "Email or Password is incorrect",
        });
      }

      bcrypt.compare(
        req.body.password,
        result[0]["password"],
        (bcryptErr, bcryptResult) => {
          if (bcryptErr) {
            return res.status(400).send({
              message: bcryptErr,
            });
          }
          if (bcryptResult) {
            const token = jwt.sign(
              { id: result[0]["id"], is_admin: result[0]["is_admin"] },
              JWT_SECRET,
              { expiresIn: "31d" }
            );
            res.cookie("token", token);
            db.query(
              `UPDATE users SET last_login = now() WHERE id = '${result[0]["id"]}'`
            );
            return res.status(200).send({
              message: "Successfully logged in",
              token,
              user: result[0],
            });
          }

          return res.status(401).send({
            message: "Password is incorrect",
          });
        }
      );
    }
  );
};

const forgetPassword = (req, res) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const email = req.body.email;
  db.query(
    `SELECT * FROM users where email=? limit 1`,
    email,
    function (error, result, fields) {
      if (error) {
        return res.status(400).json({ message: error });
      }

      if (result.length > 0) {
        let mailSubject = "Forget Password";
        const randomString = randomstring.generate();
        let content =
          `<p>Hi, ` +
          result[0].name +
          ` \
            Please <a a href="http://localhost:3000/reset-password?token=` +
          randomString +
          `">Click here</a> to reset your password</p>\
        `;
        // let content = `<p>Hi, `+result[0].name + ` \
        // //     Please <a href="http://localhost:8000/reset-password?token=+`randomString+`">Click Here</a> to reset your password</p>\
        // // `

        sendMail(email, mailSubject, content);

        db.query(
          `DELETE FROM password_resets WHERE email=${db.escape(
            result[0].email
          )}`
        );

        db.query(
          `INSERT INTO password_resets (email, token) VALUES(${db.escape(
            result[0].email
          )}, '${randomString}')`
        );

        return res.status(200).send({
          message: "Email Sent Successfully for resetting password",
        });
      }

      return res.status(401).send({
        message: "Email does not exist",
      });
    }
  );
};

const resetPasswordLoad = (req, res) => {
  try {
    const token = req.query.token;

    if (token == undefined) {
      return res.status(404).json({ message: "Token not found" });
    }

    db.query(
      `SELECT * FROM password_resets where token=? limit 1`,
      token,
      function (error, result, fields) {
        if (error) {
          console.log(error);
        }

        if (result !== undefined && result.length > 0) {
          db.query(
            `SELECt * FROM users where email=? limit 1`,
            result[0].email,
            function (error, result, fields) {
              if (error) {
                console.log(error);
              }

              res.render("reset-password", { user: result[0] });
            }
          );
        } else {
          return res.status(404).json({ message: "Invalid token" });
        }
      }
    );
  } catch (err) {
    console.log(err.message);
  }
};

const resetPassword = (req, res) => {
  if (req.body.password != req.body.confirm_password) {
    return res.status(404).json({ message: "Passwrod not matched" });
  }

  bcrypt.hash(req.body.password, 10, (err, hash) => {
    if (err) {
      console.log(err);
    }

    db.query(`DELETE FROM password_resets where email = '${req.body.email}'`);

    db.query(
      `UPDATE users SET password = '${hash}' where id = '${req.body.user_id}'`
    );

    return res.status(200).send({
      message: "Password reset successfully",
    });
  });
};

module.exports = {
  register,
  login,
  forgetPassword,
  resetPasswordLoad,
  resetPassword,
  enable2FA,
};
