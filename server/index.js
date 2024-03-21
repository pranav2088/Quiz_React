

import express from "express";
import bodyParser from "body-parser";
import mysql from "mysql2"
import cors from 'cors'
import session from 'express-session'
import cookieParser from 'cookie-parser'


const app = express();
app.use(express.json())
app.use(cors({
  origin: ["http://localhost:3000"],
  methods: ["GET", "POST","DELETE"],
  credentials: true
}));
app.use(cookieParser());
app.use(bodyParser.urlencoded({ extended: true }));


app.use(session({
  key: "UserId",
  secret: 'secret',
  resave: false,
  saveUninitialized: true,
  cookie: {
    secure: false,
    maxAge: 1000 * 60 * 60 * 24
  }
}))
// Create a connection pool to the MySQL database
const db = mysql.createPool({
  host: "localhost",
  user: "root",
  password: "root",
  database: "quiz"
});


//Registering New User In DB
app.post('/api/register', (req, res) => {
  const { name, email, password, contact } = req.body;

  // Additional validation and data processing as needed
  const sqlInsert = "INSERT INTO registration (name, email, password, contact, role, status) VALUES (?, ?, ?, ?, 0, 'inactive')";
  db.query(sqlInsert, [name, email, password, contact], (error, result) => {
    if (error) {
      console.error(error);
      return res.status(500).send("An error occurred while inserting the record.");
    }
    return res.status(200).send("Record inserted successfully.");
  });
});


//Checking the User Id And Password
app.post('/api/login', (req, res) => {
  const { email, password } = req.body;

  const sqlSelect = "SELECT * FROM registration WHERE email = ? AND password = ?";
  db.query(sqlSelect, [email, password], (error, data) => {
    if (error) {
      console.error(error);
      return res.status(500).json({ error: "An error occurred while querying the database." });
    }


    if (data.length > 0) {
      const user = data[0];

      // Store user information in the session
      req.session.user = {
        id: user.id, // Assuming you have an 'id' field in the user table
        email: user.email,
        name: user.name,
        role: user.role,
        status: user.status
      };

      // Send the role value directly as numeric value
      return res.status(200).json({ message: "Success", role: user.role, status: user.status });
    } else {

      return res.status(401).json({ error: "Invalid credentials." });
    }
  });
});

//Create Session For Logged In User 
app.get('/api/login', (req, res) => {

  if (req.session.user) {
    res.send({ loggedIn: true, user: req.session.user });
  } else {
    res.send({ loggedIn: false });
  }
})

//UserList fetaching
app.get('/api/users', (req, res) => {
  // Fetch user data from the database
  const sqlSelect = "SELECT * FROM registration"; // Replace 'users' with your actual table name

  db.query(sqlSelect, (error, results) => {
    if (error) {
      console.error(error);
      return res.status(500).json({ error: "Error fetching user data." });
    }
    return res.status(200).json(results);
  });
});


//Make User Active and InActive 
app.post('/api/users/:userId/toggle', (req, res) => {
  const userId = req.params.userId;

  // Fetch the user's current status from the database
  const sqlSelect = "SELECT status FROM registration WHERE id = ?";
  db.query(sqlSelect, [userId], (error, results) => {
    if (error) {
      console.error(error);
      return res.status(500).json({ error: "An error occurred while querying the database." });
    }

    const currentStatus = results[0].status;
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active';

    // Update the user's status in the database
    const sqlUpdate = "UPDATE registration SET status = ? WHERE id = ?";
    db.query(sqlUpdate, [newStatus, userId], (error) => {
      if (error) {
        console.error(error);
        return res.status(500).json({ error: "An error occurred while updating the user's status." });
      }
      return res.status(200).json({ message: "User status updated successfully." });
    });
  });
});


//Adding Question In DB
app.post('/api/qbank', (req, res) => {
  const { question, options, answer } = req.body;

  // Convert the options array to a string or JSON before insertion
  const optionsString = JSON.stringify(options);

  // Additional validation and data processing as needed
  const sqlInsert = "INSERT INTO qbank (question, options, answer) VALUES (?, ?, ?)";

  db.query(sqlInsert, [question, optionsString, answer], (error, result) => {
    if (error) {
      console.error(error);
      return res.status(500).send("An error occurred while inserting the record.");
    }
    return res.status(200).send("Record inserted successfully.");
  });
});

// Delete Question from DB
app.delete('/api/questions/:idqbank', (req, res) => {
  const questionId = req.params.idqbank;

  // Delete the question from the database
  const sqlDelete = "DELETE FROM qbank WHERE idqbank = ?";
  db.query(sqlDelete, [questionId], (error, result) => {
    if (error) {
      console.error(error);
      return res.status(500).json({ error: "An error occurred while deleting the question." });
    }

    if (result.affectedRows === 0) {
      // If no rows were affected, the question with the given ID doesn't exist
      return res.status(404).json({ error: "Question not found." });
    }

    return res.status(200).json({ message: "Question deleted successfully." });
  });
});



//Fetching Question in Admin Panel
app.get('/api/questions', (req, res) => {
  // Fetch user data from the database
  const sqlSelect = "SELECT * FROM qbank"; // Replace 'users' with your actual table name

  db.query(sqlSelect, (error, results) => {
    if (error) {
      console.error(error);
      return res.status(500).json({ error: "Error fetching user data." });
    }
    return res.status(200).json(results);
  });
});
//UserScore fetaching
app.get('/api/score', (req, res) => {
  // Fetch score data from the database
  const sqlSelect = "SELECT * FROM score"; // Replace 'users' with your actual table name

  db.query(sqlSelect, (error, results) => {
    if (error) {
      console.error(error);
      return res.status(500).json({ error: "Error fetching user data." });
    }
    return res.status(200).json(results);
  });
});
// Logout route
app.post('/api/logout', (req, res) => {
  // Destroy the session
  req.session.destroy((err) => {
    if (err) {
      console.error('Error destroying session:', err);
      return res.status(500).json({ error: 'Logout failed.' });
    }
    return res.status(200).json({ message: 'Logout successful.' });
  });
});


//==============================================User Side========================================


// Display Quiz Question In UserSide
app.get('/api/quiz', (req, res) => {
  const sqlSelect = "SELECT * FROM qbank"; // Replace 'qbank' with your actual table name

  db.query(sqlSelect, (error, results) => {
    if (error) {
      console.error(error);
      return res.status(500).json({ error: "Error fetching quiz data." });
    }

    return res.status(200).json(results);
  });
});

//Storing Answer

app.post('/api/store-score', (req, res) => {
  const { userId, name, correctAnswers } = req.body;

  // Save the user's score to the database (as you've done)
  const sqlInsert = "INSERT INTO score (userID, name, score) VALUES (?,?,?)";
  db.query(sqlInsert, [userId, name, correctAnswers], (error, result) => {
    if (error) {
      console.error(error);
      return res.status(500).send("An error occurred while inserting the record.");
    }
    return res.status(200).send("Record inserted successfully.");
  });
});
;

const port = process.env.PORT || 5000;

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
